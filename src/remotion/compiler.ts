import * as Babel from "@babel/standalone";
import { Lottie } from "@remotion/lottie";
import * as RemotionShapes from "@remotion/shapes";
import { ThreeCanvas } from "@remotion/three";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { AnimatedCaptions } from "./AnimatedCaptions";

export interface CompilationResult {
  Component: React.ComponentType | null;
  error: string | null;
}

// Strip imports and prepare code for compilation in sandbox
function prepareCodeForCompilation(code: string): {
  source: string;
  detectedComponent: string | null;
} {
  let cleaned = code;

  // 1. Remove all import statements (handles multi-line imports with newlines in braces)
  cleaned = cleaned.replace(
    /import\s+type\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g,
    "",
  );
  cleaned = cleaned.replace(
    /import\s+\w+\s*,\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g,
    "",
  );
  cleaned = cleaned.replace(
    /import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g,
    "",
  );
  cleaned = cleaned.replace(
    /import\s+\*\s+as\s+\w+\s+from\s*["'][^"']+["'];?/g,
    "",
  );
  cleaned = cleaned.replace(/import\s+\w+\s+from\s*["'][^"']+["'];?/g, "");
  cleaned = cleaned.replace(/import\s*["'][^"']+["'];?/g, "");

  // 2. Detect main component name before stripping exports
  let detectedComponent: string | null = null;
  const compMatch =
    cleaned.match(/export\s+(?:default\s+)?(?:const|function|var|let)\s+([A-Z]\w*)/) ||
    cleaned.match(/(?:const|function|var|let)\s+([A-Z]\w*)\s*(?:=|:\s*React\.FC|\()/);
  if (compMatch) {
    detectedComponent = compMatch[1];
  }

  // 3. Convert or strip export statements so code is valid in function scope
  cleaned = cleaned.replace(
    /export\s+default\s+function\s+(\w+)/g,
    "function $1",
  );
  cleaned = cleaned.replace(
    /export\s+default\s+class\s+(\w+)/g,
    "class $1",
  );
  cleaned = cleaned.replace(
    /export\s+default\s+([^;]+);?/g,
    "var __defaultExport = $1;",
  );
  cleaned = cleaned.replace(
    /export\s+(const|let|var|function|class)\s+/g,
    "$1 ",
  );
  cleaned = cleaned.replace(/export\s*\{[\s\S]*?\};?/g, "");

  cleaned = cleaned.trim();

  return { source: cleaned, detectedComponent };
}

// Standalone compile function for use outside React components
export function compileCode(code: string): CompilationResult {
  if (!code?.trim()) {
    return { Component: null, error: "No code provided" };
  }

  try {
    const { source, detectedComponent } = prepareCodeForCompilation(code);

    const transpiled = Babel.transform(source, {
      presets: ["react", "typescript"],
      filename: "dynamic-animation.tsx",
    });

    if (!transpiled.code) {
      return { Component: null, error: "Transpilation failed" };
    }

    const Remotion = {
      AbsoluteFill,
      Audio,
      interpolate,
      useCurrentFrame,
      useVideoConfig,
      spring,
      Sequence,
      Img,
    };

    const compName = detectedComponent || "MyAnimation";

    const wrappedCode = `${transpiled.code}

var __TargetComponent = (typeof ${compName} !== "undefined" ? ${compName} : null)
  || (typeof MyAnimation !== "undefined" ? MyAnimation : null)
  || (typeof DynamicAnimation !== "undefined" ? DynamicAnimation : null)
  || (typeof __defaultExport !== "undefined" ? __defaultExport : null);

var __RootDynamicComponent = function(props) {
  if (__TargetComponent) {
    return React.createElement(__TargetComponent, props);
  }
  return null;
};

return __RootDynamicComponent;`;

    const createComponent = new Function(
      "React",
      "Remotion",
      "RemotionShapes",
      "Lottie",
      "ThreeCanvas",
      "THREE",
      "AbsoluteFill",
      "Audio",
      "interpolate",
      "useCurrentFrame",
      "useVideoConfig",
      "spring",
      "Sequence",
      "Img",
      "useState",
      "useEffect",
      "useMemo",
      "useRef",
      "Rect",
      "Circle",
      "Triangle",
      "Star",
      "Polygon",
      "Ellipse",
      "Heart",
      "Pie",
      "makeRect",
      "makeCircle",
      "makeTriangle",
      "makeStar",
      "makePolygon",
      "makeEllipse",
      "makeHeart",
      "makePie",
      // Transitions
      "TransitionSeries",
      "linearTiming",
      "springTiming",
      "fade",
      "slide",
      "wipe",
      "flip",
      "clockWipe",
      "AnimatedCaptions",
      wrappedCode,
    );

    const SafeAudio = React.forwardRef((props: any, ref: any) => {
      const isRemote =
        typeof props.src === "string" &&
        (props.src.startsWith("http://") || props.src.startsWith("https://"));
      return React.createElement(Audio, {
        ...(isRemote ? { crossOrigin: "anonymous" } : {}),
        volume: 1,
        ...props,
        ref,
      });
    });

    const Component = createComponent(
      React,
      Remotion,
      RemotionShapes,
      Lottie,
      ThreeCanvas,
      THREE,
      AbsoluteFill,
      SafeAudio,
      interpolate,
      useCurrentFrame,
      useVideoConfig,
      spring,
      Sequence,
      Img,
      useState,
      useEffect,
      useMemo,
      useRef,
      RemotionShapes.Rect,
      RemotionShapes.Circle,
      RemotionShapes.Triangle,
      RemotionShapes.Star,
      RemotionShapes.Polygon,
      RemotionShapes.Ellipse,
      RemotionShapes.Heart,
      RemotionShapes.Pie,
      RemotionShapes.makeRect,
      RemotionShapes.makeCircle,
      RemotionShapes.makeTriangle,
      RemotionShapes.makeStar,
      RemotionShapes.makePolygon,
      RemotionShapes.makeEllipse,
      RemotionShapes.makeHeart,
      RemotionShapes.makePie,
      // Transitions
      TransitionSeries,
      linearTiming,
      springTiming,
      fade,
      slide,
      wipe,
      flip,
      clockWipe,
      AnimatedCaptions,
    );

    if (typeof Component !== "function") {
      return {
        Component: null,
        error: "Code must be a function that returns a React component",
      };
    }

    return { Component, error: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown compilation error";
    return { Component: null, error: errorMessage };
  }
}
