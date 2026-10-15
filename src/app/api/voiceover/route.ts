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
import { logRuntime } from "@/lib/runtime-logger";
import { verifySessionToken } from "@/lib/auth";
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
  projectId?: string;
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
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
  };
}

async function transcribeWithWhisper(
  audio: ArrayBuffer,
): Promise<{ words: WordTiming[]; duration: number }> {
  const empty = { words: [] as WordTiming[], duration: 0 };
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return empty;

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

    if (!res.ok) return empty;

    const data = (await res.json()) as {
      words?: WordTiming[];
      duration?: number;
    };
    return {
      words: data.words ?? [],
      duration: typeof data.duration === "number" ? data.duration : 0,
    };
  } catch (err) {
    console.warn("Whisper transcription warning:", err);
    return empty;
  }
}

export async function POST(req: Request) {
  // Extract user identity from session cookie or auth header
  const cookieHeader = req.headers.get("cookie") || "";
  const authHeader = req.headers.get("authorization");
  let token = "";
  if (cookieHeader) {
    const match = cookieHeader.match(/swdbot_session=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  let userEmail = "Guest User";
  if (token) {
    const verified = verifySessionToken(token);
    if (verified.valid && verified.email) {
      userEmail = verified.email;
    }
  }

  let projectId: string | undefined;

  try {
    const parsed = parseRequest(await req.json());

    if (typeof parsed === "string") {
      logRuntime({
        action: "VOICEOVER TEXT-TO-SPEECH (HeyGen)",
        status: "FAILED",
        userEmail,
        details: { reason: parsed },
      });
      return NextResponse.json({ error: parsed }, { status: 400 });
    }

    projectId = parsed.projectId;

    logRuntime({
      action: "VOICEOVER TEXT-TO-SPEECH (HeyGen)",
      status: "START",
      userEmail,
      projectId,
      details: {
        voice: parsed.voice,
        engine: parsed.engine,
        language: parsed.language,
        speed: `${parsed.speed}x`,
        autoCaptions: parsed.withCaptions,
        scriptSample: `"${parsed.text.slice(0, 80).replace(/\n/g, " ")}..." (${parsed.text.length} chars)`,
      },
    });

    if (!getHeyGenApiKey()) {
      const err = "HEYGEN_API_KEY is not defined in .env file.";
      logRuntime({
        action: "VOICEOVER TEXT-TO-SPEECH (HeyGen)",
        status: "FAILED",
        userEmail,
        projectId,
        error: err,
      });
      return NextResponse.json({ error: err }, { status: 500 });
    }

    if (!parsed.voice) {
      const err = "No HeyGen voice selected.";
      logRuntime({
        action: "VOICEOVER TEXT-TO-SPEECH (HeyGen)",
        status: "FAILED",
        userEmail,
        projectId,
        error: err,
      });
      return NextResponse.json({ error: err }, { status: 400 });
    }

    // 1. Synthesize with HeyGen API
    const synthesis = await synthesizeWithHeyGen({
      text: parsed.text,
      voiceId: parsed.voice,
      language: parsed.language,
      engine: parsed.engine,
      speed: parsed.speed,
    });

    // 2. Download audio bytes and persist to S3 & memory streaming route
    const audioBuffer = await downloadHeyGenAudio(synthesis.audioUrl);
    const persisted = await persistAudio(audioBuffer, "wav");

    // Order of reliability:
    // S3 presigned URL (works for browser + Lambda) > dynamic API route (/api/audio/vo-xxx.wav) > direct HeyGen CDN URL
    const reliableAudioUrl = persisted.s3Url || persisted.apiUrl || synthesis.audioUrl;
    const base64AudioUrl = `data:audio/wav;base64,${Buffer.from(audioBuffer).toString("base64")}`;

    let words = synthesis.words;
    let duration = synthesis.duration;
    if (parsed.withCaptions && words.length === 0) {
      const whisper = await transcribeWithWhisper(audioBuffer);
      words = whisper.words;
      duration = duration || whisper.duration;
    }

    logRuntime({
      action: "VOICEOVER TEXT-TO-SPEECH (HeyGen)",
      status: "SUCCESS",
      userEmail,
      projectId,
      details: {
        voice: parsed.voice,
        engine: synthesis.engine ?? parsed.engine,
        duration: `${duration.toFixed(2)}s`,
        wordCount: words.length,
        audioSource: persisted.s3Url ? "AWS S3 Presigned URL" : "Dynamic Next.js Stream Route",
        audioUrl: reliableAudioUrl,
      },
    });

    return NextResponse.json({
      provider: "heygen",
      audioUrl: reliableAudioUrl,
      fileUrl: reliableAudioUrl,
      remoteAudioUrl: reliableAudioUrl,
      apiUrl: persisted.apiUrl,
      dataUrl: base64AudioUrl,
      voice: parsed.voice,
      engine: synthesis.engine ?? parsed.engine,
      language: parsed.language,
      text: parsed.text,
      duration,
      words,
    });
  } catch (error) {
    logRuntime({
      action: "VOICEOVER TEXT-TO-SPEECH (HeyGen)",
      status: "FAILED",
      userEmail,
      projectId,
      error,
    });
    console.error("Error in /api/voiceover:", error);
    const message =
      error instanceof Error ? error.message : "Unknown voiceover error.";
    return NextResponse.json(
      { error: `Failed to generate HeyGen voiceover: ${message}` },
      { status: 500 },
    );
  }
}
