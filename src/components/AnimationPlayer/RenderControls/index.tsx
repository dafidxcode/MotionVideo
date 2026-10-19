"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateSingleHtml } from "@/lib/single-html";
import { downloadBlob } from "@/lib/zip";
import { extractScriptFromCode } from "../VoiceoverModal";
import { Download, FileCode2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    const [showConfirm, setShowConfirm] = useState(false);
    const [renderCost, setRenderCost] = useState<number>(30);

    useEffect(() => {
      fetch("/api/config")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (typeof data?.pricing?.renderCost === "number" && data.pricing.renderCost > 0) {
            setRenderCost(data.pricing.renderCost);
          }
        })
        .catch(() => {});
    }, []);

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
      } catch { }

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

    const handleConfirmRender = () => {
      setShowConfirm(false);
      renderMedia();
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
            title="Download standalone HTML player"
          >
            <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Single HTML</span>
          </Button>

          <Button
            size="sm"
            disabled={state.status === "invoking" || !code}
            loading={state.status === "invoking"}
            onClick={() => setShowConfirm(true)}
            className="bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {state.status === "invoking" ? "Starting render..." : "Render & Download"}
            </span>
          </Button>

          {/* BUG-34: Confirmation Dialog before debiting render credits */}
          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogContent className="sm:max-w-[420px] bg-[#18181B] border-[#28282C] text-[#F5F5F7]">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-white">Confirm Render ({renderCost} Credits)</DialogTitle>
                <DialogDescription className="text-xs text-[#9A9AA2] mt-2 leading-relaxed">
                  Rendering this animation will deduct <strong className="text-amber-400">{renderCost} credits</strong> from your account balance. Your video will be compiled at {width}x{height} on AWS Lambda.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-4 flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirm(false)}
                  className="text-xs border-[#3A3A40] text-[#9A9AA2] hover:text-white cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmRender}
                  className="bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs cursor-pointer"
                >
                  Confirm & Render
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {state.status === "error" && (
            <ErrorComp message={state.error.message} />
          )}
        </div>
      );
    }

    if (state.status === "rendering") {
      return (
        <div className="flex items-center gap-3 w-full min-w-[260px] max-w-[320px]">
          <div className="flex-1 min-w-0">
            <ProgressBar progress={state.progress} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            className="h-8 px-2.5 text-xs border-[#3A3A40] text-[#9A9AA2] hover:text-white shrink-0 cursor-pointer"
            title="Cancel render polling"
          >
            Cancel
          </Button>
        </div>
      );
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
