import { getCachedHeyGenVoices, getHeyGenApiKey } from "@/lib/heygen";
import {
  isVoiceLanguageCode,
  type VoiceLanguageCode,
  type VoiceOption,
} from "@/types/voice";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface VoiceCatalogResponse {
  language: VoiceLanguageCode;
  voices: VoiceOption[];
  configured: boolean;
  warning: string | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawLanguage = searchParams.get("language") ?? "en";
  const language: VoiceLanguageCode = isVoiceLanguageCode(rawLanguage)
    ? rawLanguage
    : "en";

  if (!getHeyGenApiKey()) {
    const payload: VoiceCatalogResponse = {
      language,
      voices: [],
      configured: false,
      warning: "HEYGEN_API_KEY is not defined in .env file.",
    };
    return NextResponse.json(payload);
  }

  try {
    const voices = await getCachedHeyGenVoices(language);
    const payload: VoiceCatalogResponse = {
      language,
      voices,
      configured: true,
      warning:
        voices.length === 0
          ? `HeyGen returned no ${language} voices for this workspace.`
          : null,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown HeyGen voices error.";
    console.error("HeyGen voice listing failed:", message);
    const payload: VoiceCatalogResponse = {
      language,
      voices: [],
      configured: true,
      warning: message,
    };
    return NextResponse.json(payload);
  }
}