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

    let token = sessionCookie;
    if (!token && authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    // BUG-02: the `x-user-api-key` / `x-api-key` legacy_key lookup has been
    // removed. Anyone holding a profile legacy_key could authenticate without a
    // signed session cookie. Authentication is now session-cookie (or Bearer
    // session token) only.
    let emailToLookup: string | undefined;
    let verifiedExp: number | undefined;

    if (token) {
      const verified = verifySessionToken(token);
      if (verified.valid && verified.email) {
        emailToLookup = verified.email;
        verifiedExp = verified.exp;
      }
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

    const { key: _legacyKey, ...safeUser } = user;
    void _legacyKey;
    const response = NextResponse.json({
      authenticated: true,
      user: safeUser,
      quota: user.quota,
    });

    // BUG-51: Only re-issue cookie if missing or within 48h of expiration
    const shouldRefreshCookie =
      !sessionCookie ||
      !verifiedExp ||
      verifiedExp * 1000 - Date.now() < 48 * 60 * 60 * 1000;

    if (shouldRefreshCookie) {
      const newToken = createSessionToken(user);
      response.cookies.set(COOKIE_NAME, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
    }
    return response;
  } catch (err: any) {
    console.error("[Auth Me Route Error]", err);
    return NextResponse.json(
      { authenticated: false, error: err.message },
      { status: 500 },
    );
  }
}
