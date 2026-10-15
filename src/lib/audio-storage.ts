import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path from "path";
import { storeAudioInMemory } from "@/app/api/audio/[filename]/route";

const REGION = process.env.REMOTION_AWS_REGION || "ap-southeast-2";
const BUCKET_NAME =
  process.env.REMOTION_AWS_BUCKET || "remotionlambda-apsoutheast2-i62f0ewt1m";

function getS3Client(): S3Client | null {
  const accessKeyId =
    process.env.REMOTION_AWS_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.REMOTION_AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
    },
  });
}

export function detectAudioFormat(buffer: Buffer): { ext: "mp3" | "wav"; contentType: string } {
  if (
    (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) ||
    (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return { ext: "mp3", contentType: "audio/mpeg" };
  }
  return { ext: "wav", contentType: "audio/wav" };
}

export interface PersistAudioResult {
  s3Url: string | null;
  apiUrl: string;
  localUrl: string | null;
  filename: string;
}

export async function persistAudio(
  bytes: ArrayBuffer,
  requestedExt?: "wav" | "mp3",
): Promise<PersistAudioResult> {
  const buffer = Buffer.from(bytes);
  const detected = detectAudioFormat(buffer);
  const extension = requestedExt || detected.ext;
  const contentType = detected.contentType;
  const filename = `vo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  let s3Url: string | null = null;
  let localUrl: string | null = null;

  // 1. Immediately store in dynamic in-memory cache for ultra-reliable streaming via /api/audio/:filename
  try {
    storeAudioInMemory(filename, buffer, contentType);
  } catch (memErr) {
    console.warn("[SWDBOT RUNTIME] Audio memory cache warning:", memErr);
  }

  // 2. Upload to AWS S3 bucket for cloud rendering on Remotion Lambda
  try {
    const s3 = getS3Client();
    if (s3) {
      const s3Key = `voiceovers/${filename}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      // Generate 7-day presigned URL
      s3Url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        }),
        { expiresIn: 604800 }, // 7 days
      );
      console.log(`[SWDBOT RUNTIME] S3 AUDIO PERSISTENCE SUCCESS: ${s3Key} (expires in 7 days)`);
    }
  } catch (s3Err) {
    const errMessage = s3Err instanceof Error ? s3Err.message : String(s3Err);
    console.warn(`[SWDBOT RUNTIME] S3 AUDIO PERSISTENCE WARNING: ${errMessage}`);
  }

  // 3. Save to disk as secondary local cache
  try {
    const dir = path.join(process.cwd(), "public", "voiceovers");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), new Uint8Array(bytes));
    localUrl = `/voiceovers/${filename}`;
  } catch {
    try {
      const tmpDir = path.join("/tmp", "voiceovers");
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(path.join(tmpDir, filename), new Uint8Array(bytes));
      localUrl = `/api/audio/${filename}`;
    } catch {}
  }

  return {
    s3Url,
    apiUrl: `/api/audio/${filename}`,
    localUrl,
    filename,
  };
}
