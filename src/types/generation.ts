export type LlmProviderName = "anthropic" | "openai";
export type LlmModality = "text" | "image" | "video";

export interface ModelOption {
  id: string;
  name: string;
  provider: LlmProviderName;
  /** Input modalities yang didukung model ini (semua model Claude di bawah mendukung vision/multimodal). */
  modalities: LlmModality[];
  description: string;
}

/**
 * Katalog model resmi Anthropic Claude API.
 * Mendukung modalitas input: TEXT, IMAGE, dan VIDEO (diekstrak ke sequence frame-images).
 */
export const MODELS: ModelOption[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "anthropic",
    modalities: ["text", "image", "video"],
    description:
      "Most powerful flagship model from Anthropic for complex motion graphics & storytelling.",
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "anthropic",
    modalities: ["text", "image", "video"],
    description:
      "High-capability balanced model for fast, high-quality animation code generation.",
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    provider: "anthropic",
    modalities: ["text", "image", "video"],
    description:
      "Ultra-fast generation for rapid animation previews and validations.",
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
