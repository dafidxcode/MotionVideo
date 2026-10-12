import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  getSwdbotProfileByEmail,
  isAdminUser,
  validateVipMembership,
  verifyGoogleToken,
  verifyTurnstileToken,
  type SwdbotSessionUser,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { credential, turnstileToken } = body;

    if (!credential) {
      return NextResponse.json(
        { error: "Google credential token is required" },
        { status: 400 },
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // 1. Turnstile Check (if secret is configured)
    const turnstileResult = await verifyTurnstileToken(
      turnstileToken,
      clientIp,
    );
    if (!turnstileResult.ok) {
      return NextResponse.json(
        { error: turnstileResult.error || "Security verification failed" },
        { status: 403 },
      );
    }

    // 2. Google OAuth Token Verification
    const googleResult = await verifyGoogleToken(credential);
    if (!googleResult.ok || !googleResult.payload) {
      return NextResponse.json(
        { error: googleResult.error || "Invalid Google credential" },
        { status: 401 },
      );
    }

    const { email, name, picture } = googleResult.payload;

    // 3. Supabase Profile Lookup & VIP Verification
    const profile = await getSwdbotProfileByEmail(email);
    const vipCheck = validateVipMembership(profile);

    if (!vipCheck.isVip || !profile) {
      return NextResponse.json(
        {
          error: vipCheck.message,
          status: vipCheck.status,
          userEmail: email,
        },
        { status: 403 },
      );
    }

    // 4. User is an Active VIP Member!
    const isAdmin = isAdminUser(profile.email);
    const sessionUser: SwdbotSessionUser = {
      key: profile.legacy_key || `swdbot-vip-${profile.id || "user"}`,
      email: profile.email,
      name: profile.name || name || email.split("@")[0],
      picture: profile.avatar_url || picture || "",
      quota: Math.round((Number(profile.quota) || 0) * 1000) / 1000,
      vip: true,
      vipExpiresAt: profile.vip_expires_at || null,
      role: isAdmin ? "admin" : profile.role || "user",
      isAdmin,
    };

    const sessionToken = createSessionToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      key: sessionUser.key,
      quota: sessionUser.quota,
      email: sessionUser.email,
      name: sessionUser.name,
      picture: sessionUser.picture,
      vip: true,
      role: sessionUser.role,
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("[Google Auth Route Error]", err);
    return NextResponse.json(
      { error: err.message || "Authentication process failed" },
      { status: 500 },
    );
  }
}
