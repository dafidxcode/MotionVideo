import {
  heygenLanguageName,
  isVoiceEngineId,
  type VoiceEngineId,
  type VoiceLanguageCode,
  type VoiceOption,
} from "@/types/voice";

const HEYGEN_API_BASE = "https://api.heygen.com/v3";
const VOICES_PAGE_SIZE = 100;
const MAX_VOICE_PAGES = 3;
const VOICE_CACHE_TTL_MS = 10 * 60 * 1000;

export interface HeyGenSynthesisResult {
  audioUrl: string;
  duration: number;
  engine: string | null;
  words: Array<{ word: string; start: number; end: number }>;
}

export function getHeyGenApiKey(): string | undefined {
  const value = process.env.HEYGEN_API_KEY;
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return undefined;
}

function heygenHeaders(apiKey: string): Record<string, string> {
  return {
    "X-Api-Key": apiKey,
    "Content-Type": "application/json",
  };
}

interface HeyGenVoiceItem {
  voice_id?: string;
  name?: string;
  language?: string;
  gender?: string;
  preview_audio_url?: string | null;
  default_engine?: string;
  available_engines?: string[];
}

interface HeyGenVoicesResponse {
  data?: HeyGenVoiceItem[];
  has_more?: boolean;
  next_token?: string;
}

const ENGINE_LABELS: Record<string, string> = {
  starfish: "Starfish studio voice",
  orca: "HeyGen Voice engine",
  elevenlabs: "ElevenLabs neural voice",
};

function normalizeEngines(
  engines: string[] | undefined,
): VoiceEngineId[] | undefined {
  if (!engines) return undefined;
  const known = engines.filter((e): e is VoiceEngineId => isVoiceEngineId(e) && e !== "auto");
  return known.length > 0 ? known : undefined;
}

function describeVoice(item: HeyGenVoiceItem): string {
  const defaultEngine = item.default_engine ?? "";
  const engineLabel = ENGINE_LABELS[defaultEngine] ?? "HeyGen catalog voice";
  const genderLabel = item.gender ? ` • ${item.gender}` : "";
  const previewHint = item.preview_audio_url ? " • preview available" : "";
  return `${engineLabel}${genderLabel}${previewHint}`;
}

/**
 * Fetches the HeyGen catalog filtered by language name.
 * The API is cursor-paginated; we walk a bounded number of pages so a single
 * request never fans out without limit.
 */
export async function listHeyGenVoices(
  language: VoiceLanguageCode,
): Promise<VoiceOption[]> {
  const apiKey = getHeyGenApiKey();
  if (!apiKey) return [];

  const languageName = heygenLanguageName(language);
  if (!languageName) return [];

  const collected: VoiceOption[] = [];
  let token: string | undefined;
  let page = 0;

  do {
    const params = new URLSearchParams({
      type: "public",
      language: languageName,
      limit: String(VOICES_PAGE_SIZE),
    });
    if (token) params.set("token", token);

    const res = await fetch(`${HEYGEN_API_BASE}/voices?${params.toString()}`, {
      headers: heygenHeaders(apiKey),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `HeyGen voices request failed (${res.status}): ${body.slice(0, 300)}`,
      );
    }

    const payload = (await res.json()) as HeyGenVoicesResponse;
    const items = payload.data ?? [];

    for (const item of items) {
      if (!item.voice_id) continue;
      collected.push({
        id: item.voice_id,
        name: item.name || "Unnamed voice",
        tag: item.gender === "male" ? "Male" : "Female",
        desc: describeVoice(item),
        language,
        gender: item.gender,
        previewUrl: item.preview_audio_url ?? null,
        engines: normalizeEngines(item.available_engines),
      });
    }

    token = payload.has_more ? payload.next_token : undefined;
    page += 1;
  } while (token && page < MAX_VOICE_PAGES);

  return collected;
}

const voiceCache = new Map<
  string,
  { expiresAt: number; voices: VoiceOption[] }
>();

export async function getCachedHeyGenVoices(
  language: VoiceLanguageCode,
): Promise<VoiceOption[]> {
  const cached = voiceCache.get(language);
  if (cached && cached.expiresAt > Date.now()) return cached.voices;

  const voices = await listHeyGenVoices(language);
  if (voices.length > 0) {
    voiceCache.set(language, {
      expiresAt: Date.now() + VOICE_CACHE_TTL_MS,
      voices,
    });
  }
  return voices;
}

/**
 * HeyGen caps a single speech request at 5000 characters.
 */
export const HEYGEN_MAX_CHARS = 5000;

export function clampHeyGenText(text: string): {
  text: string;
  truncated: boolean;
} {
  const trimmed = text.trim();
  if (trimmed.length <= HEYGEN_MAX_CHARS) {
    return { text: trimmed, truncated: false };
  }
  return { text: trimmed.slice(0, HEYGEN_MAX_CHARS), truncated: true };
}

export async function synthesizeWithHeyGen(params: {
  text: string;
  voiceId: string;
  language: VoiceLanguageCode;
  engine?: VoiceEngineId;
  speed?: number;
}): Promise<HeyGenSynthesisResult> {
  const apiKey = getHeyGenApiKey();
  if (!apiKey) {
    throw new Error("HEYGEN_API_KEY is not defined in .env file.");
  }

  const { text, truncated } = clampHeyGenText(params.text);
  if (!text) {
    throw new Error("Voiceover narration text cannot be empty.");
  }

  const body: Record<string, unknown> = {
    text,
    voice_id: params.voiceId,
    input_type: "text",
  };

  if (params.speed && params.speed > 0) {
    body.speed = Math.min(Math.max(params.speed, 0.5), 2);
  }

  // Base language code (en|ms|id). HeyGen normalizes regional tags to base.
  body.language = params.language;

  if (params.engine && params.engine !== "auto") {
    body.engine = params.engine;
    if (params.engine === "elevenlabs") {
      body.settings = { model_id: "eleven_v4" };
    }
  }

  const res = await fetch(`${HEYGEN_API_BASE}/voices/speech`, {
    method: "POST",
    headers: heygenHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const detail = errText.slice(0, 500);
    throw new Error(`Failed to generate voiceover from HeyGen: ${detail}`);
  }

  const payload = (await res.json()) as {
    data?: {
      audio_url?: string;
      duration?: number;
      engine?: string;
      word_timestamps?: Array<{
        word?: string;
        start?: number;
        end?: number;
      }>;
    };
  };

  const audioUrl = payload.data?.audio_url;
  if (!audioUrl) {
    throw new Error("HeyGen returned no audio_url for this request.");
  }

  const words = (payload.data?.word_timestamps ?? [])
    .filter((w) => typeof w.word === "string" && typeof w.start === "number")
    .map((w) => ({
      word: w.word as string,
      start: w.start as number,
      end: typeof w.end === "number" ? w.end : (w.start as number),
    }));

  if (truncated) {
    console.warn(
      `HeyGen text truncated to ${HEYGEN_MAX_CHARS} characters for this narration.`,
    );
  }

  return {
    audioUrl,
    duration:
      typeof payload.data?.duration === "number" ? payload.data.duration : 0,
    engine: payload.data?.engine ?? null,
    words,
  };
}

/** Downloads the synthesized audio so it can be embedded inline. */
export async function downloadHeyGenAudio(
  audioUrl: string,
): Promise<ArrayBuffer> {
  const res = await fetch(audioUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to download HeyGen audio (${res.status}): ${audioUrl}`,
    );
  }
  return res.arrayBuffer();
}