import { renderStillOnWeb } from "@remotion/web-renderer";
import type { ComponentType } from "react";

interface CaptureConfig {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/**
 * Captures a frame from a Remotion composition and returns it as a base64 data URL.
 */
export async function captureFrame(
  Component: ComponentType,
  frame: number,
  config: CaptureConfig,
): Promise<string> {
  const blob = await (
    await renderStillOnWeb({
      composition: {
        component: Component,
        id: "frame-capture",
        width: config.width,
        height: config.height,
        fps: config.fps,
        durationInFrames: config.durationInFrames,
      },
      frame,
      scale: 0.5, // 960x540 - good enough for AI context
      inputProps: {},
    })
  ).blob({ format: "jpeg" });

  // Convert blob to base64 data URL
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:image/jpeg;base64,${base64}`;
}

/**
 * Converts a File to a base64 data URL.
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
    // Safety timeout agar tidak hang pada file korup
    setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Video seek timed out"));
    }, 8000);
  });
}

/**
 * Ekstrak N frame dari file VIDEO sebagai data-URL JPEG.
 * Dipakai agar model TEXT/IMAGE/VIDEO (Claude & GPT vision) bisa
 * memahami referensi video sebagai urutan frame-images.
 */
export async function extractVideoFrames(
  file: File,
  count = 3,
  maxWidth = 960,
): Promise<string[]> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error(`Cannot load video: ${file.name}`));
      setTimeout(() => reject(new Error("Video load timed out")), 10000);
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      maxWidth / (video.videoWidth || maxWidth),
    );
    canvas.width = Math.max(2, Math.round((video.videoWidth || 640) * scale));
    canvas.height = Math.max(
      2,
      Math.round((video.videoHeight || 360) * scale),
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");

    // Ambil frame di 25% / 50% / 75% durasi (atau 1 frame tengah bila pendek)
    const fractions =
      count <= 1
        ? [0.5]
        : Array.from({ length: count }, (_, i) => (i + 1) / (count + 1));
    const frames: string[] = [];
    for (const f of fractions) {
      const t = duration > 0.5 ? duration * f : 0.1;
      await seekVideo(video, t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
