"use client";

import { Player, type ErrorFallback, type PlayerRef } from "@remotion/player";
import { CheckCircle2, Film, Sparkles } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { getAspectRatioDimensions, type AspectRatioId } from "@/types/aspect-ratio";
import { ErrorDisplay, type ErrorType } from "../ErrorDisplay";
import { RenderControls } from "./RenderControls";

const errorTitles: Record<ErrorType, string> = {
  validation: "Invalid Prompt",
  api: "API Error",
  compilation: "Compilation Error",
};

const renderErrorFallback: ErrorFallback = ({ error }) => {
  return (
    <ErrorDisplay
      error={error.message || "An error occurred while rendering"}
      title="Runtime Error"
      variant="fullscreen"
      size="lg"
    />
  );
};

interface AnimationPlayerProps {
  Component: React.ComponentType | null;
  durationInFrames: number;
  fps: number;
  projectId?: string;
  aspectRatio?: AspectRatioId;
  onDurationChange?: (duration: number) => void;
  onFpsChange?: (fps: number) => void;
  isCompiling: boolean;
  isStreaming: boolean;
  error: string | null;
  errorType?: ErrorType;
  code: string;
  onCodeChange?: (newCode: string) => void;
  onRuntimeError?: (error: string) => void;
  onFrameChange?: (frame: number) => void;
  initialVoice?: string;
  initialVoiceModel?: string;
  initialLanguage?: string;
  initialAutoCaption?: boolean;
}

export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
  Component,
  durationInFrames,
  fps,
  projectId,
  aspectRatio = "16:9",
  isCompiling,
  isStreaming,
  error,
  errorType = "compilation",
  code,
  onRuntimeError,
  onFrameChange,
}) => {
  const playerRef = useRef<PlayerRef>(null);

  const { width: compWidth, height: compHeight } = getAspectRatioDimensions(aspectRatio);

  const aspectClass =
    aspectRatio === "9:16"
      ? "aspect-[9/16] max-w-[420px] mx-auto"
      : aspectRatio === "1:1"
        ? "aspect-square max-w-[560px] mx-auto"
        : "aspect-video w-full";

  // Listen for runtime errors from the Player's error boundary
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !onRuntimeError) return;

    const handleError = (e: { detail: { error: Error } }) => {
      onRuntimeError(e.detail.error.message);
    };

    player.addEventListener("error", handleError);
    return () => {
      player.removeEventListener("error", handleError);
    };
  }, [onRuntimeError, Component]);

  // Listen for frame changes and report to parent
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !onFrameChange) return;

    const handleFrameUpdate = (e: { detail: { frame: number } }) => {
      onFrameChange(e.detail.frame);
    };

    player.addEventListener("frameupdate", handleFrameUpdate);
    return () => {
      player.removeEventListener("frameupdate", handleFrameUpdate);
    };
  }, [onFrameChange, Component]);

  const renderContent = () => {
    if (isStreaming) {
      return (
        <div className={`w-full ${aspectClass} max-h-[calc(100%-80px)] flex flex-col justify-center items-center gap-4 bg-background-elevated rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] border border-[#28282C]`}>
          <div className="w-10 h-10 border-3 border-neutral-700 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-muted-foreground text-xs font-medium">
            Generating motion animation & voiceover...
          </p>
        </div>
      );
    }

    if (isCompiling) {
      return (
        <div className={`w-full ${aspectClass} max-h-[calc(100%-80px)] flex flex-col justify-center items-center gap-3 bg-background-elevated rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] border border-[#28282C]`}>
          <div className="w-10 h-10 border-3 border-neutral-700 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-muted-foreground text-xs">Compiling synchronized video...</p>
        </div>
      );
    }

    if (error) {
      return (
        <ErrorDisplay
          error={error}
          title={errorTitles[errorType]}
          variant="fullscreen"
          size="lg"
        />
      );
    }

    if (!Component) {
      return (
        <div className={`w-full ${aspectClass} max-h-[calc(100%-80px)] flex justify-center items-center bg-background-elevated rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] text-muted-foreground-dim text-sm font-sans border border-[#28282C]`}>
          Select an example or generate to get started
        </div>
      );
    }

    const hasAudio = /<Audio\b/.test(code);
    const hasCaptions = /<AnimatedCaptions\b/.test(code);

    return (
      <>
        <div className={`w-full ${aspectClass} max-h-[calc(100%-80px)] rounded-xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] border border-[#28282C] relative bg-black`}>
          <Player
            ref={playerRef}
            key={`${Component.toString()}-${aspectRatio}`}
            component={Component}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionHeight={compHeight}
            compositionWidth={compWidth}
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "transparent",
            }}
            controls
            autoPlay
            loop
            errorFallback={renderErrorFallback}
            spaceKeyToPlayOrPause={true}
            clickToPlay={true}
            initiallyMuted={false}
          />
        </div>

        {/* Bottom Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-semibold px-2 py-1 rounded-md bg-[#1F1F23] border border-[#28282C] text-[#F5F5F7] flex items-center gap-1.5">
              <Film className="w-3 h-3 text-amber-400" />
              <span>{aspectRatio}</span>
              <span className="text-[#6E6E76]">({compWidth}x{compHeight})</span>
            </span>

            {hasAudio && (
              <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>Voiceover Synced</span>
              </span>
            )}

            {hasCaptions && (
              <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-amber-400/10 border border-amber-400/20 text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Kinetic Subtitles</span>
              </span>
            )}
          </div>

          <RenderControls
            code={code}
            durationInFrames={durationInFrames}
            fps={fps}
            projectId={projectId}
            aspectRatio={aspectRatio}
            width={compWidth}
            height={compHeight}
          />
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col bg-background min-w-0 h-full">
      <div className="w-full h-full flex flex-col">{renderContent()}</div>
    </div>
  );
};
