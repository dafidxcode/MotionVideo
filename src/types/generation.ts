export type LlmProviderName = "shiteru" | "openai";
export type LlmModality = "text" | "image" | "video";

export interface ModelOption {
  id: string;
  name: string;
  provider: LlmProviderName;
  /** Input modalities yang didukung model ini (semua model di bawah multimodal). */
  modalities: LlmModality[];
  description: string;
}

/**
 * Katalog model multimodal SHITERU AI (OpenAI-compatible: https://shiteru.id/v1).
 * Mendukung modalitas input: TEXT, IMAGE, dan VIDEO (dieksrak ke sequence frame-images).
 */
export const MODELS: ModelOption[] = [
  {
    id: "gpt-6.1-sol",
    name: "GPT 6.1 Sol (Flagship)",
    provider: "shiteru",
    modalities: ["text", "image", "video"],
    description:
      "Latest flagship model from Shiteru AI for motion graphics & code generation.",
  },
  {
    id: "gpt-6-astra",
    name: "GPT 6 Astra",
    provider: "shiteru",
    modalities: ["text", "image", "video"],
    description:
      "High-capability model for complex animations and visual storytelling.",
  },
  {
    id: "gpt-6-sol",
    name: "GPT 6 Sol",
    provider: "shiteru",
    modalities: ["text", "image", "video"],
    description:
      "Balanced performance and intelligence for motion graphics workflows.",
  },
  {
    id: "gpt-6-luna",
    name: "GPT 6 Luna (Fast)",
    provider: "shiteru",
    modalities: ["text", "image", "video"],
    description:
      "Ultra-fast generation for rapid animation previews and iterations.",
  },
  {
    id: "gpt-5.6-sol",
    name: "GPT 5.6 Sol",
    provider: "shiteru",
    modalities: ["text", "image", "video"],
    description:
      "High-efficiency model for motion graphics and visual components.",
  },
  {
    id: "gpt-5.6-terra",
    name: "GPT 5.6 Terra",
    provider: "shiteru",
    modalities: ["text", "image", "video"],
    description:
      "Specialized model for structured animation sequences and layout design.",
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT 5.6 Luna",
    provider: "shiteru",
    modalities: ["text", "image", "video"],
    description:
      "Lightweight fast model optimized for quick animations and edits.",
  },
];

export type ModelId = (typeof MODELS)[number]["id"];

export type StreamPhase = "idle" | "reasoning" | "generating";

export type GenerationErrorType = "validation" | "api";

/** Cari metadata model dari ID (toleran terhadap suffix ":effort"). */
export function getModelOption(
  modelId?: string,
): ModelOption | undefined {
  if (!modelId) return undefined;
  const base = modelId.split(":")[0];
  return MODELS.find((m) => m.id.split(":")[0] === base);
}
