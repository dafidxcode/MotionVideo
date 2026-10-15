export type AspectRatioId = "16:9" | "9:16" | "1:1";

export interface AspectRatioOption {
  id: AspectRatioId;
  label: string;
  sublabel: string;
  width: number;
  height: number;
}

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    id: "16:9",
    label: "16:9 Landscape",
    sublabel: "1920x1080 - YouTube, Desktop",
    width: 1920,
    height: 1080,
  },
  {
    id: "9:16",
    label: "9:16 Vertical",
    sublabel: "1080x1920 - TikTok, Reels, Shorts",
    width: 1080,
    height: 1920,
  },
  {
    id: "1:1",
    label: "1:1 Square",
    sublabel: "1080x1080 - Instagram, Feed",
    width: 1080,
    height: 1080,
  },
];

export function getAspectRatioDimensions(id: string | null | undefined): {
  width: number;
  height: number;
  aspectRatio: AspectRatioId;
} {
  if (id === "9:16") {
    return { width: 1080, height: 1920, aspectRatio: "9:16" };
  }
  if (id === "1:1") {
    return { width: 1080, height: 1080, aspectRatio: "1:1" };
  }
  return { width: 1920, height: 1080, aspectRatio: "16:9" };
}
