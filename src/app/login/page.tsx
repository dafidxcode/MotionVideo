"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Shield, Crown, AlertTriangle, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [isVerified, setIsVerified] = useState(false);
  const [config, setConfig] = useState<{
    googleClientId: string;
    turnstileSitekey: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileTokenRef = useRef<string>("");
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const isGoogleInitializedRef = useRef(false);

  // If already logged in, redirect to home
  useEffect(() => {
    if (user && user.vip) {
      router.push("/");
    }
  }, [user, router]);

  // 1. Fetch public config (Google Client ID & Turnstile Sitekey)
  useEffect(() => {
    fetch("/api/config")
      .then((res) => {
        if (!res.ok) throw new Error("Status " + res.status);
        return res.json();
      })
      .then((data) => {
        setConfig({
          googleClientId:
            data.googleClientId ||
            process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
            "",
          turnstileSitekey:
            data.turnstileSitekey ||
            process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY ||
            "",
        });
      })
      .catch((err) => {
        console.warn("[Login] Config fetch fallback:", err);
        setConfig({
          googleClientId:
            process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
            "",
          turnstileSitekey:
            process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY ||
            "",
        });
      });
  }, []);

  // 2. Cloudflare Turnstile Init
  useEffect(() => {
    if (!config) return;
    let widgetId: any = null;

    const renderTurnstile = () => {
      if ((window as any).turnstile && turnstileContainerRef.current) {
        try {
          turnstileContainerRef.current.innerHTML = "";
          const sitekey = config.turnstileSitekey;

          widgetId = (window as any).turnstile.render(
            turnstileContainerRef.current,
            {
              sitekey: sitekey,
              theme: "dark",
              language: "en",
              size: "normal",
              callback: (token: string) => {
                turnstileTokenRef.current = token;
                setIsVerified(true);
              },
              "error-callback": () => {
                turnstileTokenRef.current = "";
                setIsVerified(false);
              },
              "expired-callback": () => {
                turnstileTokenRef.current = "";
                setIsVerified(false);
              },
            },
          );
        } catch (e) {
          console.error("Turnstile render error:", e);
        }
      }
    };

    if (!(window as any).turnstile) {
      const existingScript = document.getElementById("cf-turnstile-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "cf-turnstile-script";
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setTimeout(renderTurnstile, 100);
        };
        document.head.appendChild(script);
      }
    } else {
      setTimeout(renderTurnstile, 100);
    }

    const checkInterval = setInterval(() => {
      if (
        (window as any).turnstile &&
        turnstileContainerRef.current &&
        widgetId === null
      ) {
        renderTurnstile();
      }
    }, 200);

    return () => {
      clearInterval(checkInterval);
      if (widgetId !== null && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetId);
        } catch { }
      }
    };
  }, [config]);

  // 3. Google Sign-In SDK Button rendering (only after Turnstile passes)
  useEffect(() => {
    if (!isVerified || !config) return;

    const initGoogleSignIn = () => {
      if ((window as any).google && (window as any).google.accounts) {
        try {
          if (!isGoogleInitializedRef.current) {
            (window as any).google.accounts.id.initialize({
              client_id: config.googleClientId,
              locale: "en",
              callback: async (response: any) => {
                if (response.credential) {
                  setIsSubmitting(true);
                  setErrorMessage(null);
                  setErrorStatus(null);

                  const res = await login(
                    response.credential,
                    turnstileTokenRef.current,
                  );

                  setIsSubmitting(false);

                  if (res.success) {
                    router.push("/");
                  } else {
                    setErrorMessage(
                      res.error || "Login failed. Please try again.",
                    );
                    setErrorStatus(res.status || null);
                  }
                }
              },
            });
            isGoogleInitializedRef.current = true;
          }

          const renderBtn = () => {
            const btnEl =
              googleBtnRef.current ||
              document.getElementById("google-login-btn");
            if (btnEl) {
              btnEl.innerHTML = "";
              (window as any).google.accounts.id.renderButton(btnEl, {
                theme: "filled_black",
                size: "large",
                width: 280,
                shape: "rectangular",
                text: "continue_with",
                logo_alignment: "left",
              });
            }
          };

          renderBtn();
          setTimeout(renderBtn, 200);
        } catch (err) {
          console.error("Google Sign-In initialization failed:", err);
        }
      }
    };

    if (!(window as any).google) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=en";
      script.async = true;
      script.defer = true;
      script.onload = initGoogleSignIn;
      document.body.appendChild(script);
    } else {
      initGoogleSignIn();
    }
  }, [isVerified, config, login, router]);

  return (
    <div className="dark min-h-screen w-full flex flex-col md:flex-row bg-[#0A0A0C] text-[#F5F5F7] font-sans antialiased overflow-x-hidden selection:bg-[#3B82F6]/30">
      {/* Left Column: Visual Cover (2/3 width on desktop) */}
      <div
        className="relative w-full md:w-2/3 h-[280px] md:h-screen shrink-0 bg-cover bg-center overflow-hidden after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-t after:from-[#0A0A0C] md:after:from-transparent after:to-transparent"
        style={{ backgroundImage: "url('/assets/underwater_login_bg.png')" }}
      >
        {/* Desktop Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/60 hidden md:block" />

        {/* Brand Caption on visual cover (Desktop) */}
        <div className="hidden md:flex absolute bottom-10 left-10 z-10 flex-col gap-3 text-left max-w-[480px]">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              VIP Exclusive
            </span>
          </div>
          <h2 className="text-2xl lg:text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Swdbot Motion Studio
          </h2>
          <p className="text-xs lg:text-sm text-neutral-300/90 leading-relaxed font-medium">
            Design cinematic animations, typography, and motion graphics instantly just with your imagination.
          </p>
        </div>

        {/* Mobile Header Placement */}
        <div className="absolute bottom-4 left-6 z-10 flex items-center gap-3 md:hidden">
          <img
            src="/swdbot-logo.png"
            alt="Swdbot Logo"
            className="w-8 h-8 object-contain shrink-0 drop-shadow-md"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white uppercase tracking-[0.2em] drop-shadow-md">
              SWDBOT
            </span>
            <span className="text-[10px] text-amber-400 font-bold tracking-wider">
              MOTION STUDIO
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Login Portal (1/3 width on desktop) */}
      <div className="w-full md:w-1/3 flex items-center justify-center px-4 py-8 md:py-10 md:px-6 lg:px-8 xl:px-12 relative min-h-[calc(100vh-280px)] md:h-screen shrink-0 overflow-y-auto">
        {/* Subtle Ambient Lighting */}
        <div className="absolute top-1/4 right-1/4 w-[280px] h-[280px] bg-[#3B82F6]/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-[220px] h-[220px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[360px] z-10 flex flex-col items-start text-left my-auto">
          {/* Logo & VIP Tag (Desktop) */}
          <div className="hidden md:flex items-center justify-between w-full mb-6">
            <div className="flex items-center gap-3">
              <img
                src="/swdbot-logo.png"
                alt="Swdbot Logo"
                className="w-8 h-8 object-contain shrink-0"
              />
              <span className="text-sm font-bold text-white uppercase tracking-[0.25em] font-sans">
                SWDBOT
              </span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
            Sign up or log in
          </h1>

          {/* Subheading with VIP condition */}
          <p className="text-xs md:text-sm text-[#9A9AA2] mt-2 leading-relaxed font-medium">
            Please complete the security check to continue.
          </p>

          {/* Error / VIP Notice Banner */}
          {errorMessage && (
            <div className="w-full mt-4 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-left flex gap-3 items-start animate-fade-in shadow-lg shadow-rose-950/20">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-rose-300">
                  {errorStatus === "not_vip"
                    ? "VIP Membership Required"
                    : errorStatus === "expired"
                      ? "VIP Membership Expired"
                      : errorStatus === "blocked"
                        ? "Account Suspended"
                        : "Access Denied"}
                </h4>
                <p className="text-[11px] text-rose-200/90 mt-1 leading-normal">
                  {errorMessage}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <a
                    href="https://swdbot.io/pricing"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold tracking-wide transition-colors cursor-pointer shadow-sm"
                  >
                    <span>Upgrade VIP on Swdbot</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://swdbot.io/support"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-zinc-400 hover:text-white underline transition-colors"
                  >
                    Support
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Verification Box: Turnstile First, Google Sign-in Second */}
          <div className="w-full bg-[#18181B] border border-[#28282C] rounded-2xl px-3 py-6 md:p-6 mt-5 flex flex-col gap-4 relative min-h-[160px] items-center justify-center shadow-xl">
            {/* Loading Spinner during VIP Verification */}
            {isSubmitting && (
              <div key="loading-state" className="flex flex-col items-center justify-center gap-2.5 py-4 w-full animate-fade-in">
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-neutral-300 font-medium">
                  Verifyin Swdbot VIP status...
                </span>
              </div>
            )}

            {/* Turnstile Security Check */}
            <div
              key="turnstile-state"
              className={isSubmitting || isVerified ? "hidden" : "flex flex-col gap-3.5 items-center w-full animate-fade-in"}
            >
              <div className="flex items-center gap-1.5 text-[#3B82F6]">
                <Shield className="w-4 h-4 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Security Check
                </span>
              </div>
              <div
                ref={turnstileContainerRef}
                id="turnstile-login-container"
                className="my-1 flex items-center justify-center min-h-[65px] w-full"
              />
              <span className="text-[9px] text-[#6E6E76]">
                Protected by Cloudflare
              </span>
            </div>

            {/* Google Sign-in Container */}
            <div
              key="google-btn-state"
              className={isSubmitting || !isVerified ? "hidden" : "flex flex-col gap-3.5 items-center w-full animate-fade-in"}
            >
              <div
                ref={googleBtnRef}
                id="google-login-btn"
                className="flex justify-center min-h-[44px] w-full"
              />
            </div>
          </div>

          {/* VIP Information Pill */}
          <div className="w-full mt-4 p-3 rounded-xl bg-[#131316] border border-[#28282C]/70 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
              <Crown className="w-3.5 h-3.5" />
            </div>
            <p className="text-[11px] text-[#8E8E93] leading-relaxed">
              Use Google account that has an <span className="text-amber-300 font-semibold">Active VIP</span> status on Swdbot.
            </p>
          </div>

          {/* Footer Agreement */}
          <p className="text-[10px] text-[#6E6E76] mt-6 leading-relaxed font-medium">
            By signing in, you agree to Swdbot&apos;s{" "}
            <a
              href="https://swdbot.io/terms"
              target="_blank"
              rel="noreferrer"
              className="text-[#22C55E] hover:text-[#4ade80] hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://swdbot.io/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-[#22C55E] hover:text-[#4ade80] hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
