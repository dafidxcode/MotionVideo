import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type LlmProviderName = "anthropic" | "openai";
export type LlmModality = "text" | "image" | "video";

// Default models — Anthropic Claude API
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";
export const DEFAULT_ANTHROPIC_FAST_MODEL = "claude-haiku-5-5";

// Backward compatibility aliases
export const DEFAULT_SHITERU_MODEL = DEFAULT_ANTHROPIC_MODEL;
export const DEFAULT_SHITERU_FAST_MODEL = DEFAULT_ANTHROPIC_FAST_MODEL;
export const DEFAULT_OPENAI_MODEL = DEFAULT_ANTHROPIC_MODEL;
export const DEFAULT_OPENAI_FAST_MODEL = DEFAULT_ANTHROPIC_FAST_MODEL;

export const ANTHROPIC_MODEL_IDS = new Set([
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
]);

export const SHITERU_MODEL_IDS = ANTHROPIC_MODEL_IDS;

function env(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return undefined;
}

/**
 * Provider LLM default, dibaca DARI ENV.
 * Prioritas: LLM_PROVIDER > "anthropic".
 */
export function getConfiguredProvider(): LlmProviderName {
  const raw = (
    env("LLM_PROVIDER") ??
    env("AI_PROVIDER") ??
    env("AI_LLM_PROVIDER") ??
    "anthropic"
  ).toLowerCase();
  if (raw === "openai") return "openai";
  return "anthropic";
}

export function getAnthropicDefaultModel(): string {
  return env("ANTHROPIC_MODEL") ?? DEFAULT_ANTHROPIC_MODEL;
}

export function getAnthropicFastModel(): string {
  return env("ANTHROPIC_FAST_MODEL") ?? DEFAULT_ANTHROPIC_FAST_MODEL;
}

// Aliases for compatibility
export const getShiteruDefaultModel = getAnthropicDefaultModel;
export const getShiteruFastModel = getAnthropicFastModel;
export const getOpenAIDefaultModel = getAnthropicDefaultModel;
export const getOpenAIFastModel = getAnthropicFastModel;

export function isAnthropicModelId(id: string): boolean {
  const base = id.split(":")[0];
  return ANTHROPIC_MODEL_IDS.has(base) || id.startsWith("claude-");
}

export function isShiteruModelId(id: string): boolean {
  return isAnthropicModelId(id);
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
 * Kapabilitas input per model. Semua model Claude 5.5 mendukung teks, gambar (vision),
 * dan video (sebagai sequence frame-images).
 */
export function getModelModalities(_modelName: string): LlmModality[] {
  return ["text", "image", "video"];
}

export function supportsVision(_modelName: string): boolean {
  return true;
}

export interface ResolvedLlm {
  provider: LlmProviderName;
  /** Model ID bersih tanpa suffix ":reasoning" */
  modelName: string;
  /** Suffix reasoning effort jika ada */
  reasoningEffort?: string;
  /** Modalitas input yang didukung model ini */
  modalities: LlmModality[];
  model: LanguageModel;
}

/**
 * Resolve model LLM — Anthropic Claude API:
 * 1. Kalau requested ada di daftar model Anthropic -> gunakan model tersebut.
 * 2. Kalau kosong / model lama (gpt-*) -> fallback ke default model (claude-opus-5-5 atau claude-haiku-5-5 untuk fast).
 */
export function resolveLlm(
  requested?: string,
  opts?: { fast?: boolean },
): ResolvedLlm {
  const [rawName, reasoningEffort] = (requested ?? "").split(":");

  let modelName: string;

  if (rawName && isAnthropicModelId(rawName)) {
    modelName = rawName;
  } else {
    modelName = opts?.fast
      ? getAnthropicFastModel()
      : getAnthropicDefaultModel();
  }

  // Ensure modelName is one of the valid Anthropic models
  if (!ANTHROPIC_MODEL_IDS.has(modelName)) {
    modelName = opts?.fast
      ? DEFAULT_ANTHROPIC_FAST_MODEL
      : DEFAULT_ANTHROPIC_MODEL;
  }

  const modalities = getModelModalities(modelName);

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      'The environment variable "ANTHROPIC_API_KEY" is not set. Add it to your .env file and try again.',
    );
  }

  const anthropic = createAnthropic({ apiKey });
  return {
    provider: "anthropic",
    modelName,
    reasoningEffort,
    modalities,
    model: anthropic(modelName),
  };
}

/**
 * ProviderOptions untuk streamText / generateObject.
 */
export function getProviderOptions(_resolved: ResolvedLlm) {
  return {};
}
