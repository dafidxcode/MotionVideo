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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured in .env" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Anthropic API error: ${errText}` },
        { status: res.status },
      );
    }

    const keyPrefix = apiKey.slice(0, 15);
    return NextResponse.json({
      success: true,
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      data: {
        key: {
          keyPrefix,
          status: "ACTIVE",
          type: "Official Anthropic API Key",
        },
      },
      models: [
        "claude-opus-5-5",
        "claude-sonnet-5-5",
        "claude-haiku-5-5",
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to contact Anthropic endpoint" },
      { status: 500 },
    );
  }
}
