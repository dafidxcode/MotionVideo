import crypto from "crypto";

export interface SwdbotUserProfile {
  id?: string;
  legacy_key: string;
  email: string;
  name: string;
  avatar_url?: string;
  quota: number;
  vip: boolean;
  vip_activated_at?: string | null;
  vip_expires_at?: string | null;
  is_blocked: boolean;
  role?: string;
}

export interface SwdbotSessionUser {
  key: string;
  email: string;
  name: string;
  picture?: string;
  quota: number;
  vip: boolean;
  vipExpiresAt?: string | null;
  role: string;
  isAdmin?: boolean;
}

export const DEFAULT_ADMIN_EMAILS = [
  "pembekalbaranganthailand@gmail.com",
  "bgdiecky@gmail.com",
];

export function getAdminEmails(): string[] {
  const envVal =
    process.env.ADMIN_EMAILS ||
    process.env.ADMIN_ACCOUNT ||
    process.env.ADMIN_AUTH ||
    "";
  const emails = envVal
    .split(",")
    .map((e) =>
      e
        .replace(/ADMIN_AUTH=/g, "")
        .replace(/ADMIN_ACCOUNT=/g, "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  const combined = Array.from(new Set([...DEFAULT_ADMIN_EMAILS, ...emails]));
  return combined;
}

export function isAdminUser(email?: string | null): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase().trim());
}

/**
 * Session secret resolution (BUG-01).
 *
 * SECURITY: there is NO hardcoded fallback secret. If `AUTH_SESSION_SECRET` is
 * absent the module refuses to sign or verify sessions instead of falling back
 * to a public, repository-committed key.
 */
function resolveSessionSecret(): string | null {
  const raw = process.env.AUTH_SESSION_SECRET;
  if (typeof raw !== "string") return null;
  const secret = raw.trim();
  if (secret.length < 32) {
    console.error(
      "[Auth] AUTH_SESSION_SECRET must be at least 32 characters. Sessions are disabled.",
    );
    return null;
  }
  return secret;
}

/**
 * Optional previous secret used for rotation. It must also come from the
 * environment — never from source — and is only accepted for verification.
 */
function resolvePreviousSessionSecret(): string | null {
  const raw = process.env.AUTH_SESSION_SECRET_PREVIOUS;
  if (typeof raw !== "string") return null;
  const secret = raw.trim();
  return secret.length >= 32 ? secret : null;
}

const COOKIE_NAME = "swdbot_session";

/** Constant-time signature comparison to avoid timing side channels. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    // Still perform a comparison to keep the timing roughly constant.
    crypto.timingSafeEqual(
      bufA as unknown as Uint8Array<ArrayBuffer>,
      bufA as unknown as Uint8Array<ArrayBuffer>,
    );
    return false;
  }
  return crypto.timingSafeEqual(
    bufA as unknown as Uint8Array<ArrayBuffer>,
    bufB as unknown as Uint8Array<ArrayBuffer>,
  );
}

// ── Turnstile Verification ──────────────────────────────────────────────────
export async function verifyTurnstileToken(
  token: string,
  clientIp?: string,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail closed (BUG-04). Previously this returned { ok: true }, which meant a
    // missing secret silently disabled the bot protection entirely.
    // Escape hatch for local development only.
    const allowLocalBypass =
      process.env.NODE_ENV !== "production" &&
      process.env.TURNSTILE_ALLOW_UNCONFIGURED === "true";
    if (allowLocalBypass) {
      console.warn(
        "[Turnstile] TURNSTILE_ALLOW_UNCONFIGURED=true — verification skipped (non-production only).",
      );
      return { ok: true };
    }
    console.error(
      "[Turnstile] CLOUDFLARE_TURNSTILE_SECRET_KEY is not configured — failing closed.",
    );
    return {
      ok: false,
      error:
        "Security verification is unavailable. Please contact the administrator.",
    };
  }

  if (!token) {
    return { ok: false, error: "Cloudflare Turnstile token is required" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secret);
    formData.append("response", token);
    if (clientIp && clientIp !== "unknown") {
      formData.append("remoteip", clientIp);
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      },
    );

    const outcome = await res.json();
    if (outcome.success) {
      return { ok: true };
    }
    return {
      ok: false,
      error: "Security verification failed. Please try again.",
    };
  } catch (err: any) {
    console.error("[Turnstile Verify Error]", err);
    return {
      ok: false,
      error: "Unable to verify security challenge. Please try again.",
    };
  }
}

// ── Google Credential Verification ──────────────────────────────────────────
export async function verifyGoogleToken(idToken: string): Promise<{
  ok: boolean;
  payload?: { email: string; name?: string; picture?: string; aud?: string };
  error?: string;
}> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) {
      return { ok: false, error: "Invalid or expired Google credential" };
    }
    const payload = await res.json();

    if (
      !payload.email ||
      (payload.email_verified !== "true" && payload.email_verified !== true)
    ) {
      return { ok: false, error: "Unverified Google account email" };
    }

    const expectedClientId = (
      process.env.GOOGLE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      ""
    ).trim();

    // BUG-05: the audience check used to be skipped whenever GOOGLE_CLIENT_ID
    // was unset, which meant an ID token minted for ANY client/app was accepted.
    // It is now mandatory: an unset expected client ID or a mismatch fails.
    if (!expectedClientId) {
      console.error(
        "[Google Verify] GOOGLE_CLIENT_ID is not configured — failing closed.",
      );
      return {
        ok: false,
        error: "Google sign-in is not configured on this server.",
      };
    }

    if (!payload.aud) {
      return { ok: false, error: "Google credential is missing an audience" };
    }

    if (payload.aud !== expectedClientId) {
      return { ok: false, error: "Google credential client audience mismatch" };
    }

    return {
      ok: true,
      payload: {
        email: payload.email.toLowerCase().trim(),
        name: payload.name || payload.email.split("@")[0],
        picture: payload.picture || "",
        aud: payload.aud,
      },
    };
  } catch (err: any) {
    console.error("[Google Verify Error]", err);
    return { ok: false, error: "Failed to verify Google credential" };
  }
}

// ── Supabase Profile Query & VIP Validation ─────────────────────────────────
export async function getSwdbotProfileByEmail(
  email: string,
): Promise<SwdbotUserProfile | null> {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://mqlyjlqusvhrnxobwplt.supabase.co";
  const apiKey =
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!apiKey) {
    console.error("[Supabase Error] Missing Supabase API Key");
    return null;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const endpoint = `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(normalizedEmail)}&select=*`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Supabase Profile Fetch Failed]", res.status, await res.text());
      return null;
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    return rows[0] as SwdbotUserProfile;
  } catch (err: any) {
    console.error("[Supabase Fetch Error]", err);
    return null;
  }
}

export function validateVipMembership(profile: SwdbotUserProfile | null): {
  isVip: boolean;
  status: "active" | "not_found" | "blocked" | "not_vip" | "expired";
  message: string;
} {
  if (!profile) {
    return {
      isVip: false,
      status: "not_found",
      message:
        "This Google account is not registered on Swdbot. Motion Studio access is exclusively reserved for active VIP members.",
    };
  }

  if (profile.is_blocked) {
    return {
      isVip: false,
      status: "blocked",
      message:
        "Your account has been suspended by the Swdbot administrator. Please contact customer support.",
    };
  }

  if (!profile.vip) {
    return {
      isVip: false,
      status: "not_vip",
      message:
        "Access Denied: An active Swdbot VIP membership is required to access Motion Studio.",
    };
  }

  if (profile.vip_expires_at) {
    const expTime = new Date(profile.vip_expires_at).getTime();
    if (!isNaN(expTime) && expTime <= Date.now()) {
      const expDate = new Date(profile.vip_expires_at).toLocaleDateString("en-US");
      return {
        isVip: false,
        status: "expired",
        message: `Your VIP membership expired on ${expDate}. Please renew your VIP subscription on Swdbot to continue accessing Motion Studio.`,
      };
    }
  }

  return {
    isVip: true,
    status: "active",
    message: "VIP Member Active",
  };
}

// ── Session Token Creation & Verification ───────────────────────────────────
export function createSessionToken(user: SwdbotSessionUser): string {
  const secret = resolveSessionSecret();
  if (!secret) {
    throw new Error(
      "AUTH_SESSION_SECRET is not configured. Refusing to issue session tokens.",
    );
  }
  const payload = {
    key: user.key,
    email: user.email,
    isAdmin: Boolean(user.isAdmin || isAdminUser(user.email)),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days validity
  };
  const json = JSON.stringify(payload);
  const base64Data = Buffer.from(json).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(base64Data)
    .digest("hex");
  return `${base64Data}.${signature}`;
}

export function verifySessionToken(
  token: string,
): { valid: boolean; email?: string; key?: string; isAdmin?: boolean; exp?: number } {
  try {
    const secret = resolveSessionSecret();
    if (!secret) return { valid: false };
    if (!token || !token.includes(".")) return { valid: false };
    const [base64Data, signature] = token.split(".");
    if (!base64Data || !signature) return { valid: false };

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(base64Data)
      .digest("hex");

    let isValid = safeCompare(expectedSig, signature);

    if (!isValid) {
      // Graceful secret rotation: accept the previous secret ONLY when it is
      // explicitly provided through the environment (never a hardcoded value).
      const previousSecret = resolvePreviousSessionSecret();
      if (previousSecret) {
        const previousSig = crypto
          .createHmac("sha256", previousSecret)
          .update(base64Data)
          .digest("hex");
        isValid = safeCompare(previousSig, signature);
      }
    }

    if (!isValid) return { valid: false };

    const json = Buffer.from(base64Data, "base64url").toString("utf-8");
    const payload = JSON.parse(json);

    if (!payload.exp || Date.now() > payload.exp) {
      return { valid: false };
    }

    const email = payload.email;
    const isAdmin = Boolean(payload.isAdmin || isAdminUser(email));

    return { valid: true, email, key: payload.key, isAdmin, exp: payload.exp };
  } catch {
    return { valid: false };
  }
}

// ── Server-side Auth Guard for Paid Endpoints (BUG-06) ──────────────────────

/** Extract a session token from a cookie header or an Authorization header. */
export function readSessionToken(req: Request): string {
  let token = "";
  const cookieHeader = req.headers.get("cookie") || "";
  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`${COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]+)`),
    );
    if (match) token = match[1];
  }
  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }
  return token;
}

export interface AuthGuardResult {
  ok: boolean;
  status: number;
  email?: string;
  isAdmin: boolean;
  error?: string;
  message?: string;
}

/**
 * Fail-closed guard for paid endpoints (BUG-03 + BUG-06).
 *
 * Verifies the session signature, then re-reads the live Swdbot profile so a
 * blocked, non-VIP or expired-VIP account cannot keep using previously issued
 * session cookies.
 */
export async function requireActiveUser(
  req: Request,
  opts: { allowGuest?: boolean } = {},
): Promise<AuthGuardResult> {
  const token = readSessionToken(req);
  if (!token) {
    if (opts.allowGuest) {
      return { ok: true, status: 200, isAdmin: false };
    }
    return {
      ok: false,
      status: 401,
      isAdmin: false,
      error: "Authentication required. Please sign in again.",
    };
  }

  const verified = verifySessionToken(token);
  if (!verified.valid || !verified.email) {
    return {
      ok: false,
      status: 401,
      isAdmin: false,
      error: "Invalid or expired session. Please sign in again.",
    };
  }

  const email = verified.email;
  const profile = await getSwdbotProfileByEmail(email);
  if (!profile) {
    return {
      ok: false,
      status: 403,
      isAdmin: false,
      email,
      error: "Account not found on Swdbot.",
      message: "This account is not registered on Swdbot.",
    };
  }

  const vip = validateVipMembership(profile);
  if (!vip.isVip) {
    return {
      ok: false,
      status: 403,
      isAdmin: false,
      email,
      error: vip.message,
      message: vip.message,
    };
  }

  return { ok: true, status: 200, email, isAdmin: Boolean(verified.isAdmin) };
}

export { COOKIE_NAME };
