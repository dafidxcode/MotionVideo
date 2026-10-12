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
    flagUrl: "https://flagsapi.com/US/flat/64.png",
    heygenName: "English",
  },
  {
    id: "ms",
    label: "Malay",
    flagUrl: "https://flagsapi.com/MY/flat/64.png",
    heygenName: "Malay",
  },
  {
    id: "id",
    label: "Indonesian",
    flagUrl: "https://flagsapi.com/ID/flat/64.png",
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
    desc: "Let HeyGen pick each voice's saved default engine",
  },
  {
    id: "starfish",
    name: "Starfish",
    model: "starfish",
    desc: "Natural, expressive studio-quality narration",
  },
  {
    id: "orca",
    name: "HeyGen Voice",
    model: "orca",
    desc: "Fast, crisp, great for explainer and promo",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    model: "eleven_v4",
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