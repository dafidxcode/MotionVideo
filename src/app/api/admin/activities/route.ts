import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isAdminUser, verifySessionToken } from "@/lib/auth";
import { getMotionActivities } from "@/lib/credits";

function checkAdmin(req: NextRequest) {
  const token =
    req.cookies.get(COOKIE_NAME)?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { ok: false, status: 401, error: "Authentication required" };
  const verified = verifySessionToken(token);
  if (!verified.valid || !verified.email || !isAdminUser(verified.email)) {
    return { ok: false, status: 403, error: "Access denied: Admin accounts only" };
  }
  return { ok: true, email: verified.email };
}

export async function GET(req: NextRequest) {
  const auth = checkAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, parseInt(searchParams.get("limit") || "100", 10));

  try {
    const activities = await getMotionActivities(limit);
    return NextResponse.json({
      success: true,
      activities,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
