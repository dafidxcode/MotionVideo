import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isAdminUser, verifySessionToken } from "@/lib/auth";
import { getMotionStudioSettings, saveMotionStudioSettings } from "@/lib/credits";

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
    const settings = await getMotionStudioSettings();
    return NextResponse.json({ success: true, settings });
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
    const {
      initialGenerationCost,
      chatbotCost,
      renderCost,
      developerFeePercent,
    } = body;

    const patch: any = {};
    if (typeof initialGenerationCost === "number" && initialGenerationCost >= 0) {
      patch.initialGenerationCost = initialGenerationCost;
    }
    if (typeof chatbotCost === "number" && chatbotCost >= 0) {
      patch.chatbotCost = chatbotCost;
    }
    if (typeof renderCost === "number" && renderCost >= 0) {
      patch.renderCost = renderCost;
    }
    if (typeof developerFeePercent === "number" && developerFeePercent >= 0 && developerFeePercent <= 100) {
      patch.developerFeePercent = developerFeePercent;
    }

    const updated = await saveMotionStudioSettings(patch, auth.email);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
