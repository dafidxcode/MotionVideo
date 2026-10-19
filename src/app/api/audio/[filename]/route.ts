import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { parseHttpRange } from "@/lib/http-range";

// In-memory cache singleton across route module boundaries
const GLOBAL_AUDIO_CACHE_KEY = "__swdbot_audio_cache_singleton__";

function getAudioCache(): Map<string, { buffer: Buffer; contentType: string }> {
  const g = globalThis as unknown as Record<
    string,
    Map<string, { buffer: Buffer; contentType: string }> | undefined
  >;
  if (!g[GLOBAL_AUDIO_CACHE_KEY]) {
    g[GLOBAL_AUDIO_CACHE_KEY] = new Map();
  }
  return g[GLOBAL_AUDIO_CACHE_KEY];
}

export function storeAudioInMemory(filename: string, buffer: Buffer, contentType = "audio/wav") {
  const cache = getAudioCache();
  cache.set(filename, { buffer, contentType });
  // Keep cache bounded to 100 recent items
  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
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

  // 1. Check global in-memory cache first
  const cache = getAudioCache();
  const cached = cache.get(sanitized);
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

    // 4. Fallback to AWS S3 bucket if not found in local memory or disk
    if (!audioBuffer) {
      const accessKeyId =
        process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey =
        process.env.REMOTION_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

      if (accessKeyId && secretAccessKey) {
        try {
          const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
          const s3 = new S3Client({
            region: process.env.REMOTION_AWS_REGION || "ap-southeast-2",
            credentials: {
              accessKeyId: accessKeyId.trim(),
              secretAccessKey: secretAccessKey.trim(),
            },
          });
          const bucket =
            process.env.REMOTION_AWS_BUCKET || "remotionlambda-apsoutheast2-i62f0ewt1m";
          const res = await s3.send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: `voiceovers/${sanitized}`,
            }),
          );
          if (res.Body) {
            const byteArray = await res.Body.transformToByteArray();
            audioBuffer = Buffer.from(byteArray);
            // Save to memory cache for subsequent range requests
            cache.set(sanitized, { buffer: audioBuffer, contentType });
          }
        } catch {
          audioBuffer = null;
        }
      }
    }
  }

  if (!audioBuffer) {
    return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
  }

  // Inspect magic bytes to guarantee 100% correct MIME type
  if (
    audioBuffer.length >= 2 &&
    ((audioBuffer[0] === 0xff && (audioBuffer[1] & 0xe0) === 0xe0) ||
      (audioBuffer[0] === 0x49 && audioBuffer[1] === 0x44 && audioBuffer[2] === 0x33))
  ) {
    contentType = "audio/mpeg";
  } else if (
    audioBuffer.length >= 4 &&
    audioBuffer[0] === 0x52 &&
    audioBuffer[1] === 0x49 &&
    audioBuffer[2] === 0x46 &&
    audioBuffer[3] === 0x46
  ) {
    contentType = "audio/wav";
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

  // Handle HTTP Range requests for seamless audio seeking & Safari compatibility (BUG-22)
  if (rangeHeader) {
    const range = parseHttpRange(rangeHeader, fileSize);
    if (!range) {
      headers.set("Content-Range", `bytes */${fileSize}`);
      return new NextResponse(null, { status: 416, headers });
    }

    const { start, end } = range;
    const chunk = audioBuffer.subarray(start, end + 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Content-Length", String(chunk.length));

    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers,
    });
  }

  headers.set("Content-Length", String(fileSize));
  return new Response(new Uint8Array(audioBuffer), {
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
