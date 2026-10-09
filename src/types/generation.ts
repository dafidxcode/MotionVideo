export type LlmProviderName = "anthropic" | "openai";
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
 * Katalog model multimodal TERBARU (Okt 2026) — TEXT + IMAGE + VIDEO-reference.
 * ID terverifikasi dari docs resmi OpenAI & Anthropic:
 * - ANTHROPIC Claude: vision native (image). VIDEO diterima sebagai
 *   frame-images yang diekstrak di client (lihat useImageAttachments).
 * - OPENAI GPT-6: input text+image native (docs resmi). VIDEO dipahami
 *   sebagai urutan frame-images. Reasoning: none/low/medium/high/xhigh/max.
 * Pilihan user di UI selalu menang — provider di-resolve dari prefix
 * model ID, BUKAN dari ENV. ENV (LLM_PROVIDER) hanya default saat
 * client tidak mengirim model.
 */
export const MODELS: ModelOption[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5 (Flagship)",
    provider: "anthropic",
    modalities: ["text", "image", "video"],
    description:
      "Most capable Opus for coding, agents & knowledge work. 1M context.",
  },
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5 (Recommended)",
    provider: "anthropic",
    modalities: ["text", "image", "video"],
    description:
      "Best speed/intelligence balance for everyday agentic work. 1M context.",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5 (Fast)",
    provider: "anthropic",
    modalities: ["text", "image", "video"],
    description: "Fastest, near-frontier quality at lowest cost.",
  },
  {
    id: "gpt-6-astra:high",
    name: "GPT-6 Astra High [OpenAI]",
    provider: "openai",
    modalities: ["text", "image", "video"],
    description:
      "OpenAI flagship for hardest end-to-end work. 1.05M context.",
  },
  {
    id: "gpt-6-sol:medium",
    name: "GPT-6 Sol Medium [OpenAI]",
    provider: "openai",
    modalities: ["text", "image", "video"],
    description:
      "Frontier coding & agentic workflows, balanced cost. 1.05M context.",
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna [OpenAI]",
    provider: "openai",
    modalities: ["text", "image", "video"],
    description:
      "Most efficient GPT-6 for focused high-volume tasks. 1.05M context.",
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
