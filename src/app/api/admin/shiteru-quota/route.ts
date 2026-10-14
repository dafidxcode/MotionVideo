import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isAdminUser, verifySessionToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token =
    req.cookies.get(COOKIE_NAME)?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const verified = verifySessionToken(token);
  if (!verified.valid || !verified.email || !isAdminUser(verified.email)) {
    return NextResponse.json({ error: "Access denied: Admin only" }, { status: 403 });
  }

  const apiKey = process.env.SHITERU_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SHITERU_API_KEY is not configured in .env" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch("https://shiteru.id/api/public/key/quota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Shiteru API error: ${errText}` },
        { status: res.status },
      );
    }

    const quotaData = await res.json();
    return NextResponse.json({
      success: true,
      provider: "shiteru",
      baseUrl: process.env.SHITERU_BASE_URL || "https://shiteru.id/v1",
      data: quotaData,
      models: [
        "gpt-6.1-sol",
        "gpt-6-astra",
        "gpt-6-sol",
        "gpt-6-luna",
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to contact Shiteru endpoint" },
      { status: 500 },
    );
  }
}
