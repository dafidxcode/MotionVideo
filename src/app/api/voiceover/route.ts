import {
  downloadHeyGenAudio,
  getHeyGenApiKey,
  synthesizeWithHeyGen,
} from "@/lib/heygen";
import {
  isVoiceEngineId,
  isVoiceLanguageCode,
  type VoiceEngineId,
  type VoiceLanguageCode,
} from "@/types/voice";
import { persistAudio } from "@/lib/audio-storage";
import { NextResponse } from "next/server";

const DEFAULT_LANGUAGE: VoiceLanguageCode = "en";
const DEFAULT_ENGINE: VoiceEngineId = "auto";

type WordTiming = { word: string; start: number; end: number };

interface VoiceoverRequest {
  text: string;
  voice: string;
  language: VoiceLanguageCode;
  engine: VoiceEngineId;
  speed: number;
  withCaptions: boolean;
}

function parseRequest(raw: unknown): VoiceoverRequest | string {
  const body = (raw ?? {}) as Record<string, unknown>;

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return "Voiceover narration text cannot be empty.";

  const language = isVoiceLanguageCode(body.language)
    ? body.language
    : DEFAULT_LANGUAGE;
  const engine = isVoiceEngineId(body.engine) ? body.engine : DEFAULT_ENGINE;
  const rawSpeed = typeof body.speed === "number" ? body.speed : 1.0;

  return {
    text,
    language,
    engine,
    speed: Math.min(Math.max(rawSpeed, 0.5), 2),
    withCaptions: body.withCaptions !== false,
    voice: typeof body.voice === "string" ? body.voice.trim() : "",
  };
}

/**
 * Optional word-timing fallback. HeyGen returns `word_timestamps` for most
 * voices; when it does not we can borrow Whisper timings if the app happens to
 * have OPENAI_API_KEY configured. Speech synthesis itself is always HeyGen.
 */
async function transcribeWithWhisper(
  audio: ArrayBuffer,
): Promise<{ words: WordTiming[]; duration: number }> {
  const empty = { words: [] as WordTiming[], duration: 0 };
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.warn("No word timings available for caption sync.");
    return empty;
  }

  try {
    const formData = new FormData();
    formData.append("file", new Blob([audio], { type: "audio/mpeg" }), "speech.mp3");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      console.warn(
        "Whisper transcription warning:",
        await res.text().catch(() => ""),
      );
      return empty;
    }

    const data = (await res.json()) as {
      words?: WordTiming[];
      duration?: number;
    };
    return {
      words: data.words ?? [],
      duration: typeof data.duration === "number" ? data.duration : 0,
    };
  } catch (err) {
    console.warn("Whisper transcription failed:", err);
    return empty;
  }
}

export async function POST(req: Request) {
  try {
    const parsed = parseRequest(await req.json());

    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }

    if (!getHeyGenApiKey()) {
      return NextResponse.json(
        { error: "HEYGEN_API_KEY is not defined in .env file." },
        { status: 500 },
      );
    }

    if (!parsed.voice) {
      return NextResponse.json(
        { error: "No HeyGen voice selected." },
        { status: 400 },
      );
    }

    const synthesis = await synthesizeWithHeyGen({
      text: parsed.text,
      voiceId: parsed.voice,
      language: parsed.language,
      engine: parsed.engine,
      speed: parsed.speed,
    });

    const audioBuffer = await downloadHeyGenAudio(synthesis.audioUrl);
    const persisted = await persistAudio(audioBuffer, "wav");
    const reliableAudioUrl = persisted.s3Url || persisted.localUrl || synthesis.audioUrl;
    const base64AudioUrl = `data:audio/wav;base64,${Buffer.from(audioBuffer).toString("base64")}`;

    let words = synthesis.words;
    let duration = synthesis.duration;
    if (parsed.withCaptions && words.length === 0) {
      const whisper = await transcribeWithWhisper(audioBuffer);
      words = whisper.words;
      duration = duration || whisper.duration;
    }

    return NextResponse.json({
      provider: "heygen",
      audioUrl: reliableAudioUrl,
      fileUrl: reliableAudioUrl,
      remoteAudioUrl: reliableAudioUrl,
      dataUrl: base64AudioUrl,
      voice: parsed.voice,
      engine: synthesis.engine ?? parsed.engine,
      language: parsed.language,
      text: parsed.text,
      duration,
      words,
    });
  } catch (error) {
    console.error("Error in /api/voiceover:", error);
    const message =
      error instanceof Error ? error.message : "Unknown voiceover error.";
    return NextResponse.json(
      { error: `Failed to generate HeyGen voiceover: ${message}` },
      { status: 500 },
    );
  }
}
