import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isAdminUser, verifySessionToken } from "@/lib/auth";
import {
  adminToggleUserBlock,
  adminUpdateUserQuota,
  getAllProfilesForAdmin,
} from "@/lib/credits";

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

  try {
    const users = await getAllProfilesForAdmin();
    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = checkAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { action, email, amount, mode, blocked } = body;

    if (!email) {
      return NextResponse.json({ error: "User email is required" }, { status: 400 });
    }

    if (action === "update_quota") {
      if (typeof amount !== "number") {
        return NextResponse.json({ error: "Amount must be a number" }, { status: 400 });
      }
      const res = await adminUpdateUserQuota(email, amount, mode === "set" ? "set" : "add");
      if (!res.success) {
        return NextResponse.json({ error: res.error || "Failed to update quota" }, { status: 400 });
      }
      return NextResponse.json({ success: true, newQuota: res.newQuota });
    }

    if (action === "toggle_block") {
      const res = await adminToggleUserBlock(email, Boolean(blocked));
      if (!res.success) {
        return NextResponse.json({ error: res.error || "Failed to update block status" }, { status: 400 });
      }
      return NextResponse.json({ success: true, blocked: Boolean(blocked) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
