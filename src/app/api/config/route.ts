import { NextResponse } from "next/server";
import { getMotionStudioSettings } from "@/lib/credits";

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

  // BUG-10: Single source of truth for pricing so landing page and forms stay synchronized
  const settings = await getMotionStudioSettings();

  return NextResponse.json(
    {
      googleClientId,
      turnstileSitekey,
      pricing: {
        initialGenerationCost: settings.initialGenerationCost,
        chatbotCost: settings.chatbotCost,
        renderCost: settings.renderCost,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      },
    },
  );
}
