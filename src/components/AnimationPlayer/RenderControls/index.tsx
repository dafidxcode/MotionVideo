"use client";

import { Button } from "@/components/ui/button";
import { generateSingleHtml } from "@/lib/single-html";
import { downloadBlob } from "@/lib/zip";
import { extractScriptFromCode } from "../VoiceoverModal";
import { Download, FileCode2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRendering } from "../../../helpers/use-rendering";
import { DownloadButton } from "./DownloadButton";
import { ErrorComp } from "./Error";
import { ProgressBar } from "./ProgressBar";

export const RenderControls: React.FC<{
  code: string;
  durationInFrames: number;
  fps: number;
  projectId?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  width?: number;
  height?: number;
}> = ({
  code,
  durationInFrames,
  fps,
  projectId,
  aspectRatio = "16:9",
  width = 1920,
  height = 1080,
}) => {
  const { renderMedia, state, undo } = useRendering(
    {
      code,
      durationInFrames,
      fps,
      width,
      height,
    },
    projectId,
  );
  const previousPropsRef = useRef({ code, durationInFrames, fps, width, height });

  // Reset rendering state when code, duration, fps, or dimensions change
  useEffect(() => {
    const prev = previousPropsRef.current;
    const hasChanged =
      prev.code !== code ||
      prev.durationInFrames !== durationInFrames ||
      prev.fps !== fps ||
      prev.width !== width ||
      prev.height !== height;

    if (hasChanged && state.status !== "init") {
      undo();
    }
    previousPropsRef.current = { code, durationInFrames, fps, width, height };
  }, [code, durationInFrames, fps, width, height, state.status, undo]);

  const handleQuickHtmlExport = () => {
    const script = extractScriptFromCode(code);
    let captions: Array<{ word: string; start: number; end: number }> = [];
    try {
      const capMatch = code.match(/const\s+CAPTIONS\s*=\s*(\[[\s\S]*?\]);/);
      if (capMatch && capMatch[1]) {
        captions = JSON.parse(capMatch[1]);
      }
    } catch {}

    const htmlContent = generateSingleHtml({
      title: "Swdbot Motion Animation",
      script,
      captions,
      aspectRatio,
      width,
      height,
    });
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    downloadBlob(blob, `swdbot-motion-preview-${Date.now()}.html`);
  };

  if (
    state.status === "init" ||
    state.status === "invoking" ||
    state.status === "error"
  ) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!code}
          onClick={handleQuickHtmlExport}
          className="bg-[#232326] hover:bg-[#2C2C30] text-[#F5F5F7] border border-[#3A3A40] cursor-pointer text-xs flex items-center gap-1.5"
          title="Download standalone Single HTML player file"
        >
          <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Single HTML</span>
        </Button>

        <Button
          size="sm"
          disabled={state.status === "invoking" || !code}
          loading={state.status === "invoking"}
          onClick={renderMedia}
          className="bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs cursor-pointer shadow-md flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>
            {state.status === "invoking" ? "Starting render..." : "Render & Download"}
          </span>
        </Button>

        {state.status === "error" && (
          <ErrorComp message={state.error.message} />
        )}
      </div>
    );
  }

  if (state.status === "rendering") {
    return <ProgressBar progress={state.progress} />;
  }

  if (state.status === "done") {
    return (
      <DownloadButton
        state={state}
        undo={undo}
        code={code}
        durationInFrames={durationInFrames}
        fps={fps}
        aspectRatio={aspectRatio}
        width={width}
        height={height}
      />
    );
  }

  return null;
};
