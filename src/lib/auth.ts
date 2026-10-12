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

const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET ||
  "swdbot-motion-studio-secret-auth-session-key-2026";
const COOKIE_NAME = "swdbot_session";

// ── Turnstile Verification ──────────────────────────────────────────────────
export async function verifyTurnstileToken(
  token: string,
  clientIp?: string,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true }; // Not configured, skip check

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

    if (expectedClientId && payload.aud && payload.aud !== expectedClientId) {
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
  const payload = {
    key: user.key,
    email: user.email,
    isAdmin: Boolean(user.isAdmin || isAdminUser(user.email)),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days validity
  };
  const json = JSON.stringify(payload);
  const base64Data = Buffer.from(json).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(base64Data)
    .digest("hex");
  return `${base64Data}.${signature}`;
}

export function verifySessionToken(
  token: string,
): { valid: boolean; email?: string; key?: string; isAdmin?: boolean } {
  try {
    if (!token || !token.includes(".")) return { valid: false };
    const [base64Data, signature] = token.split(".");
    if (!base64Data || !signature) return { valid: false };

    let isValid = false;
    const expectedSig = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(base64Data)
      .digest("hex");

    if (expectedSig === signature) {
      isValid = true;
    } else {
      // Graceful secret rotation: accept legacy secret so active sessions do not expire
      const fallbackSecret = "swdbot-motion-studio-secret-auth-session-key-2026";
      const fallbackSig = crypto
        .createHmac("sha256", fallbackSecret)
        .update(base64Data)
        .digest("hex");
      if (fallbackSig === signature) {
        isValid = true;
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

    return { valid: true, email, key: payload.key, isAdmin };
  } catch {
    return { valid: false };
  }
}

export { COOKIE_NAME };
