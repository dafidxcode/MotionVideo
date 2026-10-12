import { NextResponse } from "next/server";

export async function GET() {
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    "";
  const turnstileSitekey =
    process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY ||
    process.env.VITE_CLOUDFLARE_TURNSTILE_SITEKEY ||
    "";

  return NextResponse.json({
    googleClientId,
    turnstileSitekey,
  });
}
