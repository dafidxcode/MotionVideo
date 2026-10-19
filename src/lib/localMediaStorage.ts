import fs from "fs";
import path from "path";
import crypto from "crypto";

export const DATA_DIR = path.resolve(process.cwd(), "data");
export const MEDIA_DIR = path.resolve(DATA_DIR, "media");

// Ensure media directory exists
if (!fs.existsSync(MEDIA_DIR)) {
  try {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  } catch (err: any) {
    console.error("[LocalMedia] Failed to create MEDIA_DIR:", err.message);
  }
}

// Retention policy: exactly 24 HOURS (1 day)
export const RETENTION_HOURS = 24;
export const RETENTION_MS = RETENTION_HOURS * 60 * 60 * 1000;

// Maximum download size limit: 300 MB
const MAX_MEDIA_DOWNLOAD_BYTES = 300 * 1024 * 1024;

// Cache mapping upstream URL -> local URL to avoid redundant downloads
const mirroredMedia = new Map<string, string>();
const mediaInFlight = new Map<string, Promise<string>>();
const failedMediaDownloads = new Map<string, number>();

function detectExtensionFromBuffer(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  // WebP
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  // MP4: ftyp at offset 4
  if (buffer.length >= 8 && buffer.toString("ascii", 4, 8) === "ftyp") return "mp4";
  // WebM: 1A 45 DF A3
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "webm";
  // MP3: ID3 or FF FB
  if (buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2))) return "mp3";
  // WAV
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") return "wav";
  return null;
}

function getExtensionFromMimeOrUrl(mimeType: string, mediaUrl: string): string {
  const clean = (mimeType || "").toLowerCase();
  if (clean.includes("video/mp4") || mediaUrl.includes(".mp4")) return "mp4";
  if (clean.includes("video/webm") || mediaUrl.includes(".webm")) return "webm";
  if (clean.includes("video/quicktime") || mediaUrl.includes(".mov")) return "mov";
  if (clean.includes("image/png") || mediaUrl.includes(".png")) return "png";
  if (clean.includes("image/jpeg") || clean.includes("image/jpg") || mediaUrl.includes(".jpg")) return "jpg";
  if (clean.includes("image/webp") || mediaUrl.includes(".webp")) return "webp";
  if (clean.includes("audio/mpeg") || clean.includes("audio/mp3") || mediaUrl.includes(".mp3")) return "mp3";
  if (clean.includes("audio/wav") || mediaUrl.includes(".wav")) return "wav";
  return "mp4";
}

/**
 * Save Buffer directly to local disk (e.g. from local Remotion render or user upload).
 * Returns relative stream path `/api/media/<filename>`.
 */
export async function saveMediaBufferToLocal(
  buffer: Buffer,
  prefix: string = "render",
  forcedExt?: string,
): Promise<{ localUrl: string; filePath: string; sizeBytes: number }> {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }

  const ext = forcedExt || detectExtensionFromBuffer(buffer) || "mp4";
  const sliceBytes = Uint8Array.from(buffer.subarray(0, Math.min(buffer.length, 65536)));
  const hash = crypto.createHash("md5").update(sliceBytes).digest("hex").slice(0, 8);
  const filename = `${prefix}_${Date.now()}_${hash}.${ext}`;
  const filePath = path.join(MEDIA_DIR, filename);

  fs.writeFileSync(filePath, Uint8Array.from(buffer));

  return {
    localUrl: `/api/media/${filename}`,
    filePath,
    sizeBytes: buffer.length,
  };
}

/**
 * Save remote media URL to local storage with 24-hour retention.
 * Returns local accessible path `/api/media/<filename>`.
 */
export async function saveMediaToLocal(
  mediaUrl: string,
  fallbackFilename?: string,
): Promise<string> {
  if (!mediaUrl || typeof mediaUrl !== "string") return mediaUrl;

  const trimmed = mediaUrl.trim();
  if (trimmed.startsWith("/api/media/")) {
    return trimmed;
  }

  // Check memo cache
  const memo = mirroredMedia.get(trimmed);
  if (memo) {
    const filename = memo.replace(/^\/api\/media\//, "");
    if (fs.existsSync(path.join(MEDIA_DIR, filename))) {
      return memo;
    }
    mirroredMedia.delete(trimmed);
  }

  // Deduplicate in-flight requests
  const inFlight = mediaInFlight.get(trimmed);
  if (inFlight) return inFlight;

  const work = doSaveMediaToLocal(trimmed, fallbackFilename)
    .then((localUrl) => {
      if (localUrl && localUrl.startsWith("/api/media/")) {
        mirroredMedia.set(trimmed, localUrl);
      }
      return localUrl;
    })
    .finally(() => {
      mediaInFlight.delete(trimmed);
    });

  mediaInFlight.set(trimmed, work);
  return work;
}

async function doSaveMediaToLocal(
  mediaUrl: string,
  fallbackFilename?: string,
): Promise<string> {
  // Check failure cache (suppress retries for 1 hour for broken links)
  const lastFailedTime = failedMediaDownloads.get(mediaUrl);
  if (lastFailedTime && Date.now() - lastFailedTime < 60 * 60 * 1000) {
    return mediaUrl;
  }

  try {
    let fetchUrl = mediaUrl;
    if (fetchUrl.startsWith("/")) {
      fetchUrl = `http://127.0.0.1:3000${fetchUrl}`;
    }

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120_000);

    const resp = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Swdbot-MotionStudio/1.0",
        Accept: "*/*",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      throw new Error(`Failed to download media (${resp.status}): ${mediaUrl}`);
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const declaredSize = Number(resp.headers.get("content-length") || "0");
    if (declaredSize > MAX_MEDIA_DOWNLOAD_BYTES) {
      throw new Error(`Media too large (${(declaredSize / 1048576).toFixed(1)} MB > 300 MB limit)`);
    }

    const arrayBuf = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    let ext = detectExtensionFromBuffer(buffer);
    if (!ext) {
      ext = getExtensionFromMimeOrUrl(contentType, mediaUrl);
    }

    const sliceBytes = Uint8Array.from(buffer.subarray(0, Math.min(buffer.length, 65536)));
    const hash = crypto.createHash("md5").update(sliceBytes).digest("hex").slice(0, 8);
    const baseName = fallbackFilename ? path.parse(fallbackFilename).name : "media";
    const filename = `${baseName}_${Date.now()}_${hash}.${ext}`;
    const filePath = path.join(MEDIA_DIR, filename);

    fs.writeFileSync(filePath, Uint8Array.from(buffer));
    return `/api/media/${filename}`;
  } catch (err: any) {
    console.warn("[LocalMedia] Error saving media:", err.message);
    failedMediaDownloads.set(mediaUrl, Date.now());
    return mediaUrl;
  }
}

/**
 * Cleanup files in data/media that are older than RETENTION_HOURS (24 hours).
 * Returns the count of deleted files.
 */
export function cleanupExpiredLocalMedia(): { deletedCount: number } {
  let deletedCount = 0;
  const now = Date.now();

  try {
    if (!fs.existsSync(MEDIA_DIR)) return { deletedCount: 0 };

    const files = fs.readdirSync(MEDIA_DIR);

    for (const file of files) {
      const filePath = path.join(MEDIA_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ageMs = now - stat.mtimeMs;
          if (ageMs > RETENTION_MS) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      } catch (e: any) {
        console.warn(`[LocalMedia Cleanup Warning] Failed to inspect/unlink ${file}:`, e.message);
      }
    }

    if (deletedCount > 0) {
      console.log(`[LocalMedia Cleanup] Removed ${deletedCount} expired media files (> ${RETENTION_HOURS}h old). Storage freed.`);
    }

    // Purge expired text projects from DB & local cache as well (> 24 hours)
    import("@/lib/projects")
      .then((m) => m.pruneAllExpiredProjects())
      .catch(() => {});
  } catch (err: any) {
    console.error("[LocalMedia Cleanup Error]", err.message);
  }

  return { deletedCount };
}

const GLOBAL_SCHEDULER_KEY = "__swdbot_media_cleanup_active__";

/**
 * Start periodic 24-hour media cleanup scheduler (runs on start and every 60 minutes).
 * Uses a process-wide singleton with .unref() so it does not leak intervals across HMR (BUG-24).
 */
export function startMediaCleanupScheduler() {
  if (typeof window !== "undefined") return;

  const g = globalThis as unknown as Record<string, boolean | undefined>;
  if (g[GLOBAL_SCHEDULER_KEY]) return;
  g[GLOBAL_SCHEDULER_KEY] = true;

  // Run initial cleanup deferred by 5 seconds
  const initialTimer = setTimeout(() => {
    try {
      cleanupExpiredLocalMedia();
    } catch {}
  }, 5000);
  initialTimer.unref?.();

  // Periodic check every 60 minutes with unref so it won't prevent graceful shutdown
  const intervalTimer = setInterval(() => {
    try {
      cleanupExpiredLocalMedia();
    } catch {}
  }, 60 * 60 * 1000);
  intervalTimer.unref?.();

  console.log(`[LocalMedia] 24-Hour retention scheduler active (unref'd singleton, auto-clean every 60 mins).`);
}
