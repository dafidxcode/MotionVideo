import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type LlmProviderName = "shiteru" | "openai";
export type LlmModality = "text" | "image" | "video";

// Default models — Shiteru AI (OpenAI-compatible: https://shiteru.id/v1)
export const DEFAULT_SHITERU_MODEL = "gpt-6.1-sol";
export const DEFAULT_SHITERU_FAST_MODEL = "gpt-6-luna";
export const DEFAULT_SHITERU_BASE_URL = "https://shiteru.id/v1";

export const DEFAULT_OPENAI_MODEL = "gpt-6.1-sol";
export const DEFAULT_OPENAI_FAST_MODEL = "gpt-6-luna";

export const SHITERU_MODEL_IDS = new Set([
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-6-astra",
  "gpt-6-sol",
  "gpt-6-luna",
  "gpt-6.1-sol",
]);

function env(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return undefined;
}

/**
 * Provider LLM default, dibaca DARI ENV.
 * Prioritas: LLM_PROVIDER > AI_PROVIDER > AI_LLM_PROVIDER > "shiteru".
 */
export function getConfiguredProvider(): LlmProviderName {
  const raw = (
    env("LLM_PROVIDER") ??
    env("AI_PROVIDER") ??
    env("AI_LLM_PROVIDER") ??
    "shiteru"
  ).toLowerCase();
  if (raw === "openai") return "openai";
  return "shiteru";
}

export function getShiteruDefaultModel(): string {
  return env("SHITERU_MODEL") ?? DEFAULT_SHITERU_MODEL;
}

export function getShiteruFastModel(): string {
  return env("SHITERU_FAST_MODEL") ?? DEFAULT_SHITERU_FAST_MODEL;
}

export function getShiteruBaseUrl(): string {
  return env("SHITERU_BASE_URL") ?? DEFAULT_SHITERU_BASE_URL;
}

export function getOpenAIDefaultModel(): string {
  return env("OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL;
}

export function getOpenAIFastModel(): string {
  return env("OPENAI_FAST_MODEL") ?? DEFAULT_OPENAI_FAST_MODEL;
}

export function isShiteruModelId(id: string): boolean {
  const base = id.split(":")[0];
  return SHITERU_MODEL_IDS.has(base) || id.startsWith("shiteru-");
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
 * Kapabilitas input per model. Semua model Shiteru di katalog adalah multimodal:
 * TEXT selalu didukung; IMAGE didukung native (vision); VIDEO didukung
 * sebagai urutan frame-images yang diekstrak di client.
 */
export function getModelModalities(modelName: string): LlmModality[] {
  if (!modelName) return ["text"];
  if (isShiteruModelId(modelName) || isOpenAIModelId(modelName)) {
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
 * Resolve model LLM — Shiteru AI (OpenAI-compatible) & OpenAI fallback:
 * 1. Kalau requested ada di daftar model Shiteru -> Shiteru AI.
 * 2. Kalau kosong / tak dikenal -> pakai provider + default model dari ENV.
 * Base URL Shiteru default ke https://shiteru.id/v1.
 */
export function resolveLlm(
  requested?: string,
  opts?: { fast?: boolean },
): ResolvedLlm {
  const configured = getConfiguredProvider();
  const [rawName, reasoningEffort] = (requested ?? "").split(":");

  let provider: LlmProviderName = configured;
  let modelName: string;

  if (rawName && isShiteruModelId(rawName)) {
    provider = "shiteru";
    modelName = rawName;
  } else if (rawName && isOpenAIModelId(rawName)) {
    provider = configured === "openai" ? "openai" : "shiteru";
    modelName = rawName;
  } else if (rawName) {
    modelName = rawName;
  } else {
    if (provider === "shiteru") {
      modelName = opts?.fast
        ? getShiteruFastModel()
        : getShiteruDefaultModel();
    } else {
      modelName = opts?.fast
        ? getOpenAIFastModel()
        : getOpenAIDefaultModel();
    }
  }

  const modalities = getModelModalities(modelName);

  if (provider === "shiteru") {
    const apiKey = env("SHITERU_API_KEY");
    if (!apiKey) {
      throw new Error(
        'The environment variable "SHITERU_API_KEY" is not set. Add it to your .env file and try again.',
      );
    }
    const baseURL = getShiteruBaseUrl();
    const shiteru = createOpenAI({ apiKey, baseURL });
    return {
      provider,
      modelName,
      reasoningEffort,
      modalities,
      model: shiteru.chat(modelName),
    };
  }

  const apiKey = env("OPENAI_API_KEY") ?? env("SHITERU_API_KEY");
  if (!apiKey) {
    throw new Error(
      'The environment variable "OPENAI_API_KEY" or "SHITERU_API_KEY" is not set. Add it to your .env file and try again.',
    );
  }
  const baseURL =
    env("OPENAI_BASE_URL") ??
    (env("OPENAI_API_KEY") ? undefined : getShiteruBaseUrl());
  const openai = createOpenAI({ apiKey, baseURL });
  return {
    provider,
    modelName,
    reasoningEffort,
    modalities,
    model: openai.chat(modelName),
  };
}

/**
 * ProviderOptions untuk streamText / generateObject.
 * Diset structuredOutputs: false agar proxy OpenAI-compatible seperti Shiteru
 * menggunakan standard JSON mode (response_format: json_object).
 */
export function getProviderOptions(resolved: ResolvedLlm) {
  const openaiOpts: Record<string, any> = {
    structuredOutputs: false,
  };
  if (resolved.reasoningEffort) {
    openaiOpts.reasoningEffort = resolved.reasoningEffort;
  }
  return {
    providerOptions: {
      openai: openaiOpts,
    },
  };
}
