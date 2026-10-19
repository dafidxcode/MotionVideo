import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { MEDIA_DIR } from "@/lib/localMediaStorage";
import { parseHttpRange } from "@/lib/http-range";

export const dynamic = "force-dynamic";

const MIME_MAP: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  const filePath = path.join(MEDIA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Media not found or expired (>24 hours).", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";

  // Handle Range request for smooth video/audio playback (BUG-22)
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const parsedRange = parseHttpRange(rangeHeader, stat.size);
    if (!parsedRange) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }

    const { start, end } = parsedRange;
    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    
    // Convert Node ReadStream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunksize),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  }

  // Full file streaming
  const stream = fs.createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Length": String(stat.size),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
