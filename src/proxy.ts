import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy guard for paid API routes (BUG-03).
 *
 * The routes themselves re-verify the session against the live Swdbot profile
 * (`requireActiveUser`). This proxy is the first, cheap barrier that
 * rejects unauthenticated calls before any provider (Anthropic, HeyGen, AWS,
 * OpenAI) or Supabase resource is touched.
 *
 * It uses WebCrypto only, so it stays compatible with the Edge runtime.
 */

const COOKIE_NAME = "swdbot_session";

/** Routes that must always be reachable without a session. */
const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/config",
  "/api/voices",
  "/api/media/",
  "/api/audio/",
];

/** Paid / resource-consuming routes that require a valid session cookie. */
const PROTECTED_API_PREFIXES = [
  "/api/generate",
  "/api/voiceover",
  "/api/transcribe",
  "/api/lambda/",
  "/api/projects",
  "/api/admin/",
];

const encoder = new TextEncoder();

/** Copy a string into a standalone, non-shared byte buffer. */
function toBytes(input: string): Uint8Array<ArrayBuffer> {
  const encoded = encoder.encode(input);
  const out = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  out.set(encoded);
  return out;
}

function base64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeBase64UrlUtf8(input: string): string {
  return new TextDecoder().decode(base64urlToBytes(input));
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    toBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, toBytes(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function readSessionToken(req: NextRequest): string {
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return "";
}

/** Returns a session payload when the signature and expiry check out. */
async function verifySession(
  token: string,
  secrets: string[],
): Promise<{ email?: string } | null> {
  if (!token || !token.includes(".")) return null;
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  const base64Data = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  let matched = false;
  for (const secret of secrets) {
    if (timingSafeStringEqual(await hmacHex(secret, base64Data), signature)) {
      matched = true;
      break;
    }
  }
  if (!matched) return null;

  try {
    const payload = JSON.parse(decodeBase64UrlUtf8(base64Data)) as {
      email?: string;
      exp?: number;
    };
    if (!payload.email) return null;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  const secrets = [
    process.env.AUTH_SESSION_SECRET,
    process.env.AUTH_SESSION_SECRET_PREVIOUS,
  ]
    .filter((s): s is string => typeof s === "string" && s.trim().length >= 32)
    .map((s) => s.trim());

  // Fail closed: no configured secret means sessions cannot be verified.
  if (secrets.length === 0) {
    return NextResponse.json(
      { error: "Server authentication is not configured." },
      { status: 503 },
    );
  }

  const session = await verifySession(readSessionToken(req), secrets);
  if (!session?.email) {
    return NextResponse.json(
      { authenticated: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};