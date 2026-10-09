import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not defined in .env." },
        { status: 500 },
      );
    }

    const contentType = req.headers.get("content-type") || "";

    let fileBuffer: Buffer | null = null;
    let fileName = "audio.mp3";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as Blob | null;
      if (!file) {
        return NextResponse.json(
          { error: "Audio file not found in FormData." },
          { status: 400 },
        );
      }
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      if (body.audioUrl && body.audioUrl.startsWith("data:audio")) {
        const base64Data = body.audioUrl.split(",")[1];
        fileBuffer = Buffer.from(base64Data, "base64");
      } else {
        return NextResponse.json(
          { error: "Invalid request format. Provide base64 audioUrl or multipart file." },
          { status: 400 },
        );
      }
    }

    const whisperFormData = new FormData();
    const blob = new Blob([fileBuffer as unknown as BlobPart], { type: "audio/mp3" });
    whisperFormData.append("file", blob, fileName);
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("response_format", "verbose_json");
    whisperFormData.append("timestamp_granularities[]", "word");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Failed to transcribe audio with Whisper: ${errText}` },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json({
      text: data.text,
      duration: data.duration,
      words: data.words || [],
    });
  } catch (error) {
    console.error("Error in /api/transcribe:", error);
    return NextResponse.json(
      { error: "An error occurred while processing audio transcription." },
      { status: 500 },
    );
  }
}
