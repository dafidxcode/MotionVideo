export type VoiceLanguageCode = "en" | "ms" | "id";

/**
 * HeyGen speech engines available on POST /v3/voices/speech.
 * "auto" omits the engine field so the voice's saved default is used.
 */
export type VoiceEngineId = "auto" | "starfish" | "orca" | "elevenlabs";

export const VOICE_LANGUAGES: {
  id: VoiceLanguageCode;
  label: string;
  flagUrl: string;
  /** Language name as the HeyGen voice catalog expects it. */
  heygenName: string;
}[] = [
  {
    id: "en",
    label: "English",
    flagUrl: "/flags/us.svg",
    heygenName: "English",
  },
  {
    id: "ms",
    label: "Malay",
    flagUrl: "/flags/my.svg",
    heygenName: "Malay",
  },
  {
    id: "id",
    label: "Indonesian",
    flagUrl: "/flags/id.svg",
    heygenName: "Indonesian",
  },
];

export const VOICE_MODELS: {
  id: VoiceEngineId;
  name: string;
  model: string;
  desc: string;
}[] = [
  {
    id: "auto",
    name: "Auto (Voice Default)",
    model: "voice default",
    desc: "Intelligent automatic voice engine selection",
  },
  {
    id: "starfish",
    name: "SwdVoice Studio",
    model: "studio",
    desc: "Natural, expressive studio-quality narration",
  },
  {
    id: "orca",
    name: "SwdVoice Fast",
    model: "fast",
    desc: "Fast, crisp, great for explainer and promo",
  },
  {
    id: "elevenlabs",
    name: "SwdVoice Neural",
    model: "neural",
    desc: "Premium multilingual neural voice",
  },
];

export interface VoiceOption {
  id: string;
  name: string;
  tag: string;
  desc: string;
  language: VoiceLanguageCode;
  gender?: string;
  previewUrl?: string | null;
  engines?: VoiceEngineId[];
}

export function isVoiceEngineId(value: unknown): value is VoiceEngineId {
  return (
    value === "auto" ||
    value === "starfish" ||
    value === "orca" ||
    value === "elevenlabs"
  );
}

export function isVoiceLanguageCode(value: unknown): value is VoiceLanguageCode {
  return value === "en" || value === "ms" || value === "id";
}

export function heygenLanguageName(code: string): string | undefined {
  return VOICE_LANGUAGES.find((l) => l.id === code)?.heygenName;
}