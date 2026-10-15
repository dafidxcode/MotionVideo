"use client";

import { Button } from "@/components/ui/button";
import { createZipArchive, downloadBlob } from "@/lib/zip";
import { generateSingleHtml } from "@/lib/single-html";
import { extractScriptFromCode } from "../VoiceoverModal";
import {
  Archive,
  CheckCircle2,
  FileCode2,
  FileVideo,
  Loader2,
  RotateCcw,
} from "lucide-react";
import React, { useState } from "react";
import type { State } from "../../../helpers/use-rendering";

const Megabytes: React.FC<{ sizeInBytes: number }> = ({ sizeInBytes }) => {
  const megabytes = Intl.NumberFormat("en", {
    notation: "compact",
    style: "unit",
    unit: "byte",
    unitDisplay: "narrow",
  }).format(sizeInBytes);
  return <span className="opacity-75">{megabytes}</span>;
};

interface DownloadButtonProps {
  state: State;
  undo: () => void;
  code: string;
  durationInFrames: number;
  fps: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  width?: number;
  height?: number;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  state,
  undo,
  code,
  durationInFrames,
  fps,
  aspectRatio = "16:9",
  width = 1920,
  height = 1080,
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const [zipSuccess, setZipSuccess] = useState(false);

  if (state.status === "rendering") {
    return <Button disabled>Rendering in progress...</Button>;
  }

  if (state.status !== "done") {
    return null;
  }

  // Extract narration & captions from source code
  const script = extractScriptFromCode(code);
  let captions: Array<{ word: string; start: number; end: number }> = [];
  try {
    const capMatch = code.match(/const\s+CAPTIONS\s*=\s*(\[[\s\S]*?\]);/);
    if (capMatch && capMatch[1]) {
      captions = JSON.parse(capMatch[1]);
    }
  } catch {}

  const handleDownloadSingleHtml = () => {
    const htmlContent = generateSingleHtml({
      title: "Swdbot Motion Animation",
      videoUrl: state.url,
      script,
      captions,
      aspectRatio,
      width,
      height,
    });
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    downloadBlob(blob, `swdbot-motion-${Date.now()}.html`);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      setZipSuccess(false);

      // 1. Fetch rendered MP4 video
      const videoRes = await fetch(state.url);
      if (!videoRes.ok) throw new Error("Could not download rendered video");
      const videoBuffer = await videoRes.arrayBuffer();

      // 2. Generate Single HTML player
      const htmlContent = generateSingleHtml({
        title: "Swdbot Motion Animation",
        videoUrl: "video.mp4", // relative path inside zip
        script,
        captions,
        aspectRatio,
        width,
        height,
      });

      // 3. Narration text file
      const scriptFileContent = [
        "========================================",
        "SWDBOT MOTION GRAPHICS - EXPORT PACKAGE",
        "========================================",
        `Export Date: ${new Date().toISOString()}`,
        `Aspect Ratio: ${aspectRatio} (${width}x${height})`,
        `Duration: ${(durationInFrames / fps).toFixed(1)}s (${durationInFrames} frames @ ${fps}fps)`,
        "",
        "--- SPOKEN NARRATION SCRIPT ---",
        script || "(No script declared)",
        "",
        "--- WORD TIMESTAMPS ---",
        captions.length > 0
          ? captions.map((c) => `[${c.start.toFixed(2)}s - ${c.end.toFixed(2)}s] ${c.word}`).join("\n")
          : "(No word timestamps)",
      ].join("\n");

      // 4. Create ZIP
      const zipBlob = createZipArchive([
        { filename: "video.mp4", data: videoBuffer },
        { filename: "index.html", data: htmlContent },
        { filename: "script.txt", data: scriptFileContent },
        { filename: "code.tsx", data: code },
      ]);

      downloadBlob(zipBlob, `swdbot-motion-package-${Date.now()}.zip`);
      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 4000);
    } catch (err) {
      console.error("ZIP creation error:", err);
      alert("Failed to build ZIP archive. Please download the video directly.");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={undo}
        className="text-[#9A9AA2] hover:text-white hover:bg-[#28282C] cursor-pointer"
        title="Reset render state"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>

      {/* 1. Direct MP4 Video Download */}
      <a href={state.url} download={`swdbot-motion-${Date.now()}.mp4`}>
        <Button
          size="sm"
          className="bg-amber-400 hover:bg-amber-300 text-black font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
        >
          <FileVideo className="w-4 h-4" />
          <span>Download Video</span>
          <span className="text-[11px] bg-black/20 px-1.5 py-0.5 rounded ml-1 font-mono">
            <Megabytes sizeInBytes={state.size} />
          </span>
        </Button>
      </a>

      {/* 2. Standalone Single HTML */}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleDownloadSingleHtml}
        className="bg-[#232326] hover:bg-[#2C2C30] text-[#F5F5F7] border border-[#3A3A40] cursor-pointer flex items-center gap-1.5"
        title="Download self-contained offline HTML player"
      >
        <FileCode2 className="w-4 h-4 text-amber-400" />
        <span>Single HTML</span>
      </Button>

      {/* 3. Full ZIP Export Package (Video + HTML + Script) */}
      <Button
        variant="secondary"
        size="sm"
        disabled={isZipping}
        onClick={handleDownloadZip}
        className="bg-[#232326] hover:bg-[#2C2C30] text-[#F5F5F7] border border-[#3A3A40] cursor-pointer flex items-center gap-1.5"
        title="Download complete ZIP containing Video, Single HTML, Script, and Source"
      >
        {isZipping ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        ) : zipSuccess ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <Archive className="w-4 h-4 text-amber-400" />
        )}
        <span>{isZipping ? "Packing ZIP..." : zipSuccess ? "ZIP Downloaded!" : "Export ZIP"}</span>
      </Button>
    </div>
  );
};
