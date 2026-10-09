import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type LlmProviderName = "anthropic" | "openai";
export type LlmModality = "text" | "image" | "video";

// Default models — bisa di-override dari ENV via ANTHROPIC_MODEL / OPENAI_MODEL
// (ID terverifikasi Okt 2026 dari docs resmi OpenAI & Anthropic)
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";
export const DEFAULT_ANTHROPIC_FAST_MODEL = "claude-haiku-4-5-20251001";
export const DEFAULT_OPENAI_MODEL = "gpt-6-astra";
export const DEFAULT_OPENAI_FAST_MODEL = "gpt-6-luna";

function env(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return undefined;
}

/**
 * Provider LLM default, dibaca DARI ENV.
 * Prioritas: LLM_PROVIDER > AI_PROVIDER > AI_LLM_PROVIDER > "anthropic".
 * NOTE: ini HANYA default. Pilihan model eksplisit dari user
 * (prefix "claude-" / "gpt-") SELALU menang atas ENV — lihat resolveLlm.
 */
export function getConfiguredProvider(): LlmProviderName {
  const raw = (
    env("LLM_PROVIDER") ??
    env("AI_PROVIDER") ??
    env("AI_LLM_PROVIDER") ??
    "anthropic"
  ).toLowerCase();
  if (raw === "openai" || raw === "gpt") return "openai";
  return "anthropic";
}

export function getAnthropicDefaultModel(): string {
  return env("ANTHROPIC_MODEL") ?? DEFAULT_ANTHROPIC_MODEL;
}

export function getAnthropicFastModel(): string {
  return env("ANTHROPIC_FAST_MODEL") ?? DEFAULT_ANTHROPIC_FAST_MODEL;
}

export function getOpenAIDefaultModel(): string {
  return env("OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL;
}

export function getOpenAIFastModel(): string {
  return env("OPENAI_FAST_MODEL") ?? DEFAULT_OPENAI_FAST_MODEL;
}

export function isAnthropicModelId(id: string): boolean {
  return id.startsWith("claude-");
}

export function isOpenAIModelId(id: string): boolean {
  return (
    id.startsWith("gpt-") ||
    id.startsWith("o1") ||
    id.startsWith("o3") ||
    id.startsWith("o4") ||
    id.startsWith("chatgpt")
  );
}

/**
 * Kapabilitas input per model. Semua model di katalog adalah multimodal:
 * TEXT selalu didukung; IMAGE didukung native (vision); VIDEO didukung
 * sebagai urutan frame-images yang diekstrak di client.
 */
export function getModelModalities(modelName: string): LlmModality[] {
  if (!modelName) return ["text"];
  // Semua model generasi saat ini dari kedua provider bersifat vision-capable.
  if (isAnthropicModelId(modelName) || isOpenAIModelId(modelName)) {
    return ["text", "image", "video"];
  }
  return ["text"];
}

export function supportsVision(modelName: string): boolean {
  return getModelModalities(modelName).includes("image");
}

export interface ResolvedLlm {
  provider: LlmProviderName;
  /** Model ID bersih tanpa suffix ":reasoning" */
  modelName: string;
  /** Suffix reasoning effort ala OpenAI (high/medium/low), jika ada */
  reasoningEffort?: string;
  /** Modalitas input yang didukung model ini */
  modalities: LlmModality[];
  model: LanguageModel;
}

/**
 * Resolve model LLM — FLEKSIBEL dual-provider:
 * 1. Kalau `requested` diawali "claude-" -> Anthropic (menang atas ENV).
 * 2. Kalau diawali "gpt-"/"o1"/"o3"/"chatgpt" -> OpenAI (menang atas ENV).
 * 3. Kalau kosong / tak dikenal -> pakai provider + default model dari ENV.
 * Format "model:effort" didukung (effort hanya diteruskan ke OpenAI).
 */
export function resolveLlm(
  requested?: string,
  opts?: { fast?: boolean },
): ResolvedLlm {
  const configured = getConfiguredProvider();
  const [rawName, reasoningEffort] = (requested ?? "").split(":");

  let provider: LlmProviderName = configured;
  let modelName: string;

  if (rawName && isAnthropicModelId(rawName)) {
    // Pilihan user eksplisit -> Anthropic, apa pun isi ENV.
    provider = "anthropic";
    modelName = rawName;
  } else if (rawName && isOpenAIModelId(rawName)) {
    // Pilihan user eksplisit -> OpenAI, apa pun isi ENV.
    provider = "openai";
    modelName = rawName;
  } else if (rawName) {
    // Model ID tidak dikenal — anggap milik provider yang dikonfigurasi.
    modelName = rawName;
  } else {
    // Tidak ada model dari client -> pakai default dari ENV.
    if (provider === "anthropic") {
      modelName = opts?.fast
        ? getAnthropicFastModel()
        : getAnthropicDefaultModel();
    } else {
      modelName = opts?.fast
        ? getOpenAIFastModel()
        : getOpenAIDefaultModel();
    }
  }

  const modalities = getModelModalities(modelName);

  if (provider === "anthropic") {
    const apiKey = env("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error(
        'The environment variable "ANTHROPIC_API_KEY" is not set. Add it to your .env file and try again (atau pilih model [OpenAI] bila hanya punya OPENAI_API_KEY).',
      );
    }
    const anthropic = createAnthropic({ apiKey });
    return {
      provider,
      modelName,
      reasoningEffort,
      modalities,
      model: anthropic(modelName),
    };
  }

  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error(
      'The environment variable "OPENAI_API_KEY" is not set. Add it to your .env file and try again (atau pilih model Claude bila hanya punya ANTHROPIC_API_KEY).',
    );
  }
  const openai = createOpenAI({ apiKey });
  return {
    provider,
    modelName,
    reasoningEffort,
    modalities,
    model: openai(modelName),
  };
}

/**
 * ProviderOptions untuk streamText — hanya OpenAI yang butuh reasoningEffort.
 * Anthropic tidak perlu opsi khusus (thinking opsional, di-skip agar stabil).
 */
export function getProviderOptions(resolved: ResolvedLlm) {
  if (resolved.provider === "openai" && resolved.reasoningEffort) {
    return {
      providerOptions: {
        openai: { reasoningEffort: resolved.reasoningEffort },
      },
    };
  }
  return {};
}
