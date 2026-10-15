import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs/promises";
import path from "path";

const REGION = process.env.REMOTION_AWS_REGION || "ap-southeast-2";
const BUCKET_NAME =
  process.env.REMOTION_AWS_BUCKET || "remotionlambda-apsoutheast2-i62f0ewt1m";

function getS3Client(): S3Client | null {
  const accessKeyId =
    process.env.REMOTION_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
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

export async function persistAudio(
  bytes: ArrayBuffer,
  extension: "wav" | "mp3" = "wav",
): Promise<{ s3Url: string | null; localUrl: string | null }> {
  const filename = `vo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const contentType = extension === "wav" ? "audio/wav" : "audio/mpeg";
  let s3Url: string | null = null;
  let localUrl: string | null = null;

  // 1. Upload to AWS S3 bucket for 100% reliable cloud rendering & cross-origin playback
  try {
    const s3 = getS3Client();
    if (s3) {
      const s3Key = `voiceovers/${filename}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: Buffer.from(bytes),
          ContentType: contentType,
        }),
      );

      // Generate a 7-day presigned URL so it's accessible anywhere (Lambda & client)
      s3Url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        }),
        { expiresIn: 604800 }, // 7 days
      );
    }
  } catch (s3Err) {
    console.warn("Failed to upload audio to Remotion S3 bucket:", s3Err);
  }

  // 2. Also save to public/voiceovers for local Next.js runtime fallback
  try {
    const dir = path.join(process.cwd(), "public", "voiceovers");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), new Uint8Array(bytes));
    localUrl = `/voiceovers/${filename}`;
  } catch (fsErr) {
    console.warn("Failed to write to public/voiceovers:", fsErr);
  }

  return { s3Url, localUrl };
}
