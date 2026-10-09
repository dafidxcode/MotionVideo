import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface CaptionWord {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface AnimatedCaptionsProps {
  words: CaptionWord[];
  highlightColor?: string;
  textColor?: string;
  fontSize?: number;
  position?: "bottom" | "top" | "center";
  windowSize?: number;
  style?: React.CSSProperties;
}

export const AnimatedCaptions: React.FC<AnimatedCaptionsProps> = ({
  words = [],
  highlightColor = "#f59e0b",
  textColor = "#ffffff",
  fontSize = 38,
  position = "bottom",
  windowSize = 5,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  if (!words || words.length === 0) {
    return null;
  }

  // Check if current frame falls within the speech range
  const firstWordStart = words[0]?.start ?? 0;
  const lastWordEnd = words[words.length - 1]?.end ?? 0;

  if (currentTime < firstWordStart - 0.2 || currentTime > lastWordEnd + 0.8) {
    return null;
  }

  // Find currently active word index
  let activeIndex = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end,
  );

  // If between words, pick closest previous word
  if (activeIndex === -1) {
    for (let i = words.length - 1; i >= 0; i--) {
      if (currentTime >= words[i].end) {
        activeIndex = i;
        break;
      }
    }
  }

  if (activeIndex === -1) {
    activeIndex = 0;
  }

  // Calculate sliding word window (e.g. 5 words chunk around active word)
  const halfWindow = Math.floor(windowSize / 2);
  let startIndex = Math.max(0, activeIndex - halfWindow);
  let endIndex = Math.min(words.length, startIndex + windowSize);

  if (endIndex - startIndex < windowSize) {
    startIndex = Math.max(0, endIndex - windowSize);
  }

  const visibleWords = words.slice(startIndex, endIndex);

  // Vertical placement
  const placementStyle: React.CSSProperties =
    position === "top"
      ? { top: 70 }
      : position === "center"
        ? { top: "50%", transform: "translate(-50%, -50%)" }
        : { bottom: 70 };

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: position === "center" ? "translate(-50%, -50%)" : "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "14px 28px",
        borderRadius: 999,
        backgroundColor: "rgba(10, 15, 29, 0.78)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        pointerEvents: "none",
        ...placementStyle,
        ...style,
      }}
    >
      {visibleWords.map((item, idx) => {
        const actualIndex = startIndex + idx;
        const isActive = actualIndex === activeIndex;
        const isPast = actualIndex < activeIndex;

        // Spring pop effect for active word
        const wordStartFrame = Math.round(item.start * fps);
        const framesSinceStart = Math.max(0, frame - wordStartFrame);
        const scaleSpring = spring({
          frame: framesSinceStart,
          fps,
          config: { damping: 12, stiffness: 220 },
        });

        const scale = isActive ? 1 + scaleSpring * 0.18 : 1;
        const color = isActive ? highlightColor : textColor;
        const opacity = isActive ? 1 : isPast ? 0.85 : 0.45;
        const fontWeight = isActive ? 800 : 600;

        return (
          <span
            key={`${item.word}-${actualIndex}`}
            style={{
              fontFamily: "'Inter', -apple-system, sans-serif",
              fontSize,
              fontWeight,
              color,
              opacity,
              display: "inline-block",
              transform: `scale(${scale})`,
              transition: "color 0.1s ease, opacity 0.1s ease",
              textShadow: isActive
                ? `0 0 24px ${highlightColor}90, 0 2px 4px rgba(0,0,0,0.8)`
                : "0 2px 4px rgba(0,0,0,0.6)",
              letterSpacing: "-0.01em",
            }}
          >
            {item.word}
          </span>
        );
      })}
    </div>
  );
};
