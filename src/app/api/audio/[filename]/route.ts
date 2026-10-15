import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

// In-memory cache for ultra-fast audio streaming
const audioMemoryCache = new Map<string, { buffer: Buffer; contentType: string }>();

export function storeAudioInMemory(filename: string, buffer: Buffer, contentType = "audio/wav") {
  audioMemoryCache.set(filename, { buffer, contentType });
  // Keep cache bounded to 100 recent items
  if (audioMemoryCache.size > 100) {
    const oldestKey = audioMemoryCache.keys().next().value;
    if (oldestKey) audioMemoryCache.delete(oldestKey);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const sanitized = path.basename(filename);

  let audioBuffer: Buffer | null = null;
  let contentType = sanitized.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";

  // 1. Check in-memory cache first
  const cached = audioMemoryCache.get(sanitized);
  if (cached) {
    audioBuffer = cached.buffer;
    contentType = cached.contentType;
  } else {
    // 2. Check disk in public/voiceovers
    try {
      const filePath = path.join(process.cwd(), "public", "voiceovers", sanitized);
      audioBuffer = await fs.readFile(filePath);
    } catch {
      // 3. Check /tmp/voiceovers
      try {
        const tmpPath = path.join("/tmp", "voiceovers", sanitized);
        audioBuffer = await fs.readFile(tmpPath);
      } catch {
        audioBuffer = null;
      }
    }
  }

  if (!audioBuffer) {
    return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
  }

  const fileSize = audioBuffer.length;
  const rangeHeader = req.headers.get("range");

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, Content-Type");
  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=604800, immutable");

  // Handle HTTP Range requests for seamless audio seeking & Safari compatibility
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      headers.set("Content-Range", `bytes */${fileSize}`);
      return new NextResponse(null, { status: 416, headers });
    }

    const chunk = audioBuffer.subarray(start, end + 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Content-Length", String(chunk.length));

    return new NextResponse(chunk, {
      status: 206,
      headers,
    });
  }

  headers.set("Content-Length", String(fileSize));
  return new NextResponse(audioBuffer, {
    status: 200,
    headers,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  });
}
