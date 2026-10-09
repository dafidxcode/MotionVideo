import { extractVideoFrames, fileToBase64 } from "@/helpers/capture-frame";
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";

const MAX_ATTACHED_IMAGES = 9;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per image
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per video
const VIDEO_FRAMES_PER_FILE = 3;

interface UseImageAttachmentsReturn {
  attachedImages: string[];
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  addImages: (newImages: string[]) => void;
  removeImage: (index: number) => void;
  clearImages: () => void;
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePaste: (e: ClipboardEvent) => Promise<void>;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
  canAddMore: boolean;
  error: string | null;
  clearError: () => void;
}

export function useImageAttachments(): UseImageAttachmentsReturn {
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const filterValidFiles = useCallback(
    (files: File[]): { images: File[]; videos: File[] } => {
      const images: File[] = [];
      const videos: File[] = [];
      const rejected: string[] = [];

      for (const file of files) {
        if (file.type.startsWith("image/")) {
          if (file.size > MAX_IMAGE_SIZE_BYTES) rejected.push(file.name);
          else images.push(file);
        } else if (file.type.startsWith("video/")) {
          if (file.size > MAX_VIDEO_SIZE_BYTES) rejected.push(file.name);
          else videos.push(file);
        }
      }

      if (rejected.length > 0) {
        setError(
          `File too large: ${rejected.join(", ")}. Max ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB/image, ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)}MB/video.`,
        );
      }

      return { images, videos };
    },
    [],
  );

  const addImages = useCallback((newImages: string[]) => {
    setAttachedImages((prev) => {
      const combined = [...prev, ...newImages];
      return combined.slice(0, MAX_ATTACHED_IMAGES);
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setAttachedImages([]);
  }, []);

  /** Convert image files langsung + video files via ekstraksi frames. */
  const filesToDataUrls = useCallback(
    async (files: File[]): Promise<string[]> => {
      const { images, videos } = filterValidFiles(files);
      const out: string[] = [];

      if (images.length > 0) {
        const base64Images = await Promise.all(images.map(fileToBase64));
        out.push(...base64Images);
      }

      for (const video of videos) {
        try {
          const frames = await extractVideoFrames(
            video,
            VIDEO_FRAMES_PER_FILE,
          );
          out.push(...frames);
        } catch (err) {
          console.error("Failed to extract video frames:", err);
          setError(
            `Could not read video "${video.name}" — frames could not be extracted.`,
          );
        }
      }

      return out;
    },
    [filterValidFiles],
  );

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (files.length > 0) {
        const urls = await filesToDataUrls(files);
        if (urls.length > 0) addImages(urls);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [addImages, filesToDataUrls],
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));
      if (imageItems.length > 0) {
        e.preventDefault();
        const files = imageItems
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);
        const urls = await filesToDataUrls(files);
        if (urls.length > 0) addImages(urls);
      }
    },
    [addImages, filesToDataUrls],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (files.length > 0) {
        const urls = await filesToDataUrls(files);
        if (urls.length > 0) addImages(urls);
      }
    },
    [addImages, filesToDataUrls],
  );

  return {
    attachedImages,
    isDragging,
    fileInputRef,
    addImages,
    removeImage,
    clearImages,
    handleFileSelect,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    canAddMore: attachedImages.length < MAX_ATTACHED_IMAGES,
    error,
    clearError,
  };
}
