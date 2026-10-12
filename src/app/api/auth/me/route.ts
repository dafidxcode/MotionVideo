import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  getSwdbotProfileByEmail,
  isAdminUser,
  validateVipMembership,
  verifySessionToken,
  type SwdbotSessionUser,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get(COOKIE_NAME)?.value;
    const authHeader = req.headers.get("authorization");
    const apiKeyHeader =
      req.headers.get("x-user-api-key") || req.headers.get("x-api-key");

    let token = sessionCookie;
    if (!token && authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    let emailToLookup: string | undefined;

    if (token) {
      const verified = verifySessionToken(token);
      if (verified.valid && verified.email) {
        emailToLookup = verified.email;
      }
    }

    // Fallback: If apiKeyHeader is provided, lookup profile by legacy_key directly
    if (!emailToLookup && apiKeyHeader) {
      const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        "https://mqlyjlqusvhrnxobwplt.supabase.co";
      const apiKey =
        process.env.SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        "";

      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/profiles?legacy_key=eq.${encodeURIComponent(apiKeyHeader.trim())}&select=*`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
            },
            cache: "no-store",
          },
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows[0]?.email) {
            emailToLookup = rows[0].email;
          }
        }
      } catch { }
    }

    if (!emailToLookup) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const profile = await getSwdbotProfileByEmail(emailToLookup);
    const vipCheck = validateVipMembership(profile);

    if (!profile || !vipCheck.isVip) {
      // VIP expired or revoked
      const response = NextResponse.json(
        {
          authenticated: false,
          error: vipCheck.message,
          status: vipCheck.status,
        },
        { status: 403 },
      );
      response.cookies.delete(COOKIE_NAME);
      return response;
    }

    const isAdmin = isAdminUser(profile.email);
    const user: SwdbotSessionUser = {
      key: profile.legacy_key,
      email: profile.email,
      name: profile.name || profile.email.split("@")[0],
      picture: profile.avatar_url || "",
      quota: Math.round((Number(profile.quota) || 0) * 1000) / 1000,
      vip: true,
      vipExpiresAt: profile.vip_expires_at || null,
      role: isAdmin ? "admin" : profile.role || "user",
      isAdmin,
    };

    const newToken = createSessionToken(user);
    const response = NextResponse.json({
      authenticated: true,
      user,
      quota: user.quota,
    });
    response.cookies.set(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (err: any) {
    console.error("[Auth Me Route Error]", err);
    return NextResponse.json(
      { authenticated: false, error: err.message },
      { status: 500 },
    );
  }
}
