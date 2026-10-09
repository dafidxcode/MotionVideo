import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text, voice = "onyx", speed = 1.0, withCaptions = true } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Voiceover narration text cannot be empty." },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not defined in .env file." },
        { status: 500 },
      );
    }

    // Call OpenAI Text-to-Speech API
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text.trim(),
        voice: voice,
        speed: speed,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI TTS error:", errText);
      return NextResponse.json(
        { error: `Failed to generate voiceover from OpenAI: ${errText}` },
        { status: response.status },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString("base64");
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    // Also persist to public/voiceovers folder for lightweight referencing
    let fileUrl: string | null = null;
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const dir = path.join(process.cwd(), "public", "voiceovers");
      await fs.mkdir(dir, { recursive: true });
      const filename = `vo-${Date.now()}.mp3`;
      await fs.writeFile(path.join(dir, filename), new Uint8Array(arrayBuffer));
      fileUrl = `/voiceovers/${filename}`;
    } catch (saveErr) {
      console.warn("Could not save to public/voiceovers:", saveErr);
    }

    // Transcribe with OpenAI Whisper API for real-time word-level captions
    let words: Array<{ word: string; start: number; end: number }> = [];
    let audioDurationSec = 0;

    if (withCaptions !== false) {
      try {
        const formData = new FormData();
        const blob = new Blob([arrayBuffer], { type: "audio/mp3" });
        formData.append("file", blob, "speech.mp3");
        formData.append("model", "whisper-1");
        formData.append("response_format", "verbose_json");
        formData.append("timestamp_granularities[]", "word");

        const whisperRes = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          },
        );

        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          words = whisperData.words || [];
          audioDurationSec = whisperData.duration || 0;
        } else {
          console.warn(
            "Whisper transcription warning:",
            await whisperRes.text(),
          );
        }
      } catch (whisperErr) {
        console.warn("Whisper transcription failed:", whisperErr);
      }
    }

    return NextResponse.json({
      audioUrl,
      fileUrl: fileUrl || audioUrl,
      voice,
      text,
      duration: audioDurationSec,
      words,
    });
  } catch (error) {
    console.error("Error in /api/voiceover:", error);
    return NextResponse.json(
      { error: "An error occurred while processing voiceover." },
      { status: 500 },
    );
  }
}
