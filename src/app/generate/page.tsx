"use client";

import { Loader2, MessageSquare } from "lucide-react";
import type { NextPage } from "next";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AnimationPlayer } from "../../components/AnimationPlayer";
import {
  extractScriptFromCode,
  injectAudioAndCaptionsIntoCode,
} from "../../components/AnimationPlayer/VoiceoverModal";
import { ChatSidebar, type ChatSidebarRef } from "../../components/ChatSidebar";
import { CodeEditor } from "../../components/CodeEditor";
import { PageLayout } from "../../components/PageLayout";
import { TabPanel } from "../../components/TabPanel";
import { examples } from "../../examples/code";
import { useAnimationState } from "../../hooks/useAnimationState";
import { useAutoCorrection } from "../../hooks/useAutoCorrection";
import { useConversationState } from "../../hooks/useConversationState";
import type {
  AssistantMetadata,
  EditOperation,
  ErrorCorrectionContext,
} from "../../types/conversation";
import type { GenerationErrorType, StreamPhase } from "../../types/generation";

const MAX_CORRECTION_ATTEMPTS = 3;

function GeneratePageContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") || "";
  const initialLanguage = searchParams.get("language") || "en";
  const initialVoiceModel = searchParams.get("voiceModel") || "auto";
  const initialVoice = searchParams.get("voice") || "";
  const initialAutoCaption = searchParams.get("autoCaption") !== "false";

  // If we have an initial prompt from URL, start in streaming state
  // so syntax highlighting is disabled from the beginning
  const willAutoStart = Boolean(initialPrompt);

  const initialDurationParam = searchParams.get("duration");
  const initialFpsParam = searchParams.get("fps");
  const parsedDuration = initialDurationParam ? parseInt(initialDurationParam, 10) : null;
  const parsedFps = initialFpsParam ? parseInt(initialFpsParam, 10) : null;

  const [durationInFrames, setDurationInFrames] = useState(
    parsedDuration && !isNaN(parsedDuration) ? parsedDuration : (examples[0]?.durationInFrames || 150),
  );
  const [fps, setFps] = useState(
    parsedFps && !isNaN(parsedFps) ? parsedFps : (examples[0]?.fps || 30),
  );
  const autoVoiceoverAppliedRef = useRef(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isStreaming, setIsStreaming] = useState(willAutoStart);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>(
    willAutoStart ? "reasoning" : "idle",
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [mobileView, setMobileView] = useState<"preview" | "chat" | "code">("preview");
  const [generationError, setGenerationError] = useState<{
    message: string;
    type: GenerationErrorType;
    failedEdit?: EditOperation;
  } | null>(null);

  // Self-correction state
  const [errorCorrection, setErrorCorrection] =
    useState<ErrorCorrectionContext | null>(null);

  // Conversation state for follow-up edits
  const {
    messages,
    hasManualEdits,
    pendingMessage,
    addUserMessage,
    addAssistantMessage,
    addErrorMessage,
    markManualEdit,
    getFullContext,
    getPreviouslyUsedSkills,
    getLastUserAttachedImages,
    setPendingMessage,
    clearPendingMessage,
    isFirstGeneration,
  } = useConversationState();

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const {
    code,
    Component,
    error: compilationError,
    isCompiling,
    setCode,
    compileCode,
  } = useAnimationState(examples[0]?.code || "");

  // Runtime errors from the Player (e.g., "cannot access variable before initialization")
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Combined error for display - either compilation or runtime error
  const codeError = compilationError || runtimeError;

  // Refs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef(isStreaming);
  const codeRef = useRef(code);
  const chatSidebarRef = useRef<ChatSidebarRef>(null);

  // Auto-correction hook - use combined code error (compilation + runtime)
  const { markAsAiGenerated, markAsUserEdited } = useAutoCorrection({
    maxAttempts: MAX_CORRECTION_ATTEMPTS,
    compilationError: codeError,
    generationError,
    isStreaming,
    isCompiling,
    hasGeneratedOnce,
    code,
    errorCorrection,
    onTriggerCorrection: useCallback(
      (correctionPrompt: string, context: ErrorCorrectionContext) => {
        setErrorCorrection(context);
        setPrompt(correctionPrompt);
        // Get attached images from the last user message to include in retry
        const lastImages = getLastUserAttachedImages();
        setTimeout(() => {
          // Use silent mode to avoid showing retry as a user message
          // Include images from the last user message so image-based requests can be retried
          chatSidebarRef.current?.triggerGeneration({
            silent: true,
            attachedImages: lastImages,
          });
        }, 100);
      },
      [getLastUserAttachedImages],
    ),
    onAddErrorMessage: addErrorMessage,
    onClearGenerationError: useCallback(() => setGenerationError(null), []),
    onClearErrorCorrection: useCallback(() => setErrorCorrection(null), []),
  });

  // Sync refs
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const wasStreaming = isStreamingRef.current;
    isStreamingRef.current = isStreaming;

    // Compile when streaming ends - mark as AI change
    if (wasStreaming && !isStreaming) {
      markAsAiGenerated();
      compileCode(codeRef.current);
    }
  }, [isStreaming, compileCode, markAsAiGenerated]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      setHasGeneratedOnce(true);

      // Mark as manual edit if not streaming (user typing)
      if (!isStreamingRef.current) {
        markManualEdit(newCode);
        markAsUserEdited();
      }

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Skip compilation while streaming - will compile when streaming ends
      if (isStreamingRef.current) {
        return;
      }

      // Set new debounce
      debounceRef.current = setTimeout(() => {
        compileCode(newCode);
      }, 500);
    },
    [setCode, compileCode, markManualEdit, markAsUserEdited],
  );

  // Handle message sent for history
  const handleMessageSent = useCallback(
    (promptText: string, attachedImages?: string[]) => {
      addUserMessage(promptText, attachedImages);
    },
    [addUserMessage],
  );

  // Handle generation complete for history & auto-attach voiceover
  const handleGenerationComplete = useCallback(
    async (generatedCode: string, summary?: string, metadata?: AssistantMetadata) => {
      const content =
        summary || "Generated your animation, any follow up edits?";
      addAssistantMessage(content, generatedCode, metadata);
      markAsAiGenerated();

      // Automatically synthesize the HeyGen voiceover and captions on first generation
      if (!autoVoiceoverAppliedRef.current && initialVoice) {
        autoVoiceoverAppliedRef.current = true;
        const script = extractScriptFromCode(generatedCode) || initialPrompt;
        if (script && !/<Audio\s+[^>]*\/>/.test(generatedCode)) {
          try {
            const res = await fetch("/api/voiceover", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: script.trim(),
                voice: initialVoice,
                engine: initialVoiceModel,
                language: initialLanguage,
                speed: 1.0,
                withCaptions: initialAutoCaption,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.audioUrl) {
                const completeCode = injectAudioAndCaptionsIntoCode(
                  generatedCode,
                  data.audioUrl,
                  initialAutoCaption && data.words ? data.words : [],
                );
                setCode(completeCode);
                compileCode(completeCode);

                if (data.duration) {
                  const neededFrames = Math.ceil(data.duration * fps) + 15;
                  setDurationInFrames((prev) => Math.max(prev, neededFrames));
                } else {
                  // HeyGen occasionally omits duration; measure the rendered
                  // audio instead so the narration is never cut off.
                  const probe = new window.Audio(data.audioUrl);
                  probe.addEventListener("loadedmetadata", () => {
                    if (!Number.isFinite(probe.duration) || probe.duration <= 0) {
                      return;
                    }
                    const neededFrames = Math.ceil(probe.duration * fps) + 15;
                    setDurationInFrames((prev) => Math.max(prev, neededFrames));
                  });
                }

                const engineLabel =
                  data.engine && data.engine !== "auto" ? data.engine : "HeyGen";
                addAssistantMessage(
                  `🎙️ **Voiceover & Captions Ready!**\nAuto-applied HeyGen TTS (${engineLabel}) with ${initialAutoCaption ? "word-level synced captions" : "clean audio narration"}. You can preview the complete video now or customize anything below.`,
                  completeCode,
                );
              }
            } else {
              const errData = await res.json().catch(() => ({}));
              console.warn("Auto voiceover failed:", errData?.error);
            }
          } catch (err) {
            console.error("Auto voiceover generation error:", err);
          }
        }
      }
    },
    [
      addAssistantMessage,
      markAsAiGenerated,
      initialVoice,
      initialVoiceModel,
      initialLanguage,
      initialAutoCaption,
      initialPrompt,
      fps,
      setCode,
      compileCode,
      setDurationInFrames,
    ],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleStreamingChange = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
    // Clear errors when starting a new generation
    if (streaming) {
      setGenerationError(null);
      setRuntimeError(null);
      // Reset error correction state for fresh retry attempts
      setErrorCorrection(null);
    }
  }, []);

  const handleError = useCallback(
    (
      message: string,
      type: GenerationErrorType,
      failedEdit?: EditOperation,
    ) => {
      setGenerationError({ message, type, failedEdit });
    },
    [],
  );

  // Handle runtime errors from the Player (e.g., "cannot access variable before initialization")
  const handleRuntimeError = useCallback((errorMessage: string) => {
    // Set runtime error - this will be combined with compilation errors via codeError
    // The useAutoCorrection hook will pick this up via the compilationError prop
    setRuntimeError(errorMessage);
  }, []);

  // Auto-trigger generation if prompt came from URL
  useEffect(() => {
    if (initialPrompt && !hasAutoStarted && chatSidebarRef.current) {
      setHasAutoStarted(true);
      // Check for initial attached images from sessionStorage
      const storedImagesJson = sessionStorage.getItem("initialAttachedImages");
      let storedImages: string[] | undefined;
      if (storedImagesJson) {
        try {
          storedImages = JSON.parse(storedImagesJson);
        } catch {
          // Ignore parse errors
        }
        sessionStorage.removeItem("initialAttachedImages");
      }
      setTimeout(() => {
        chatSidebarRef.current?.triggerGeneration({
          attachedImages: storedImages,
          language: initialLanguage,
          voice: initialVoice,
          voiceModel: initialVoiceModel,
          autoCaption: initialAutoCaption,
        });
      }, 100);
    }
  }, [initialPrompt, hasAutoStarted, initialLanguage, initialVoice, initialVoiceModel, initialAutoCaption]);

  return (
    <PageLayout showLogoAsLink>
      {/* Mobile View Switcher (Visible on mobile/tablet < 1000px, hidden on desktop >= 1000px) */}
      <div className="flex min-[1000px]:hidden items-center justify-between px-3 py-2 bg-neutral-900/90 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1 bg-neutral-800/90 p-1 rounded-xl border border-white/10 w-full">
          <button
            type="button"
            onClick={() => setMobileView("preview")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              mobileView === "preview"
                ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                : "text-neutral-400 hover:text-white",
            )}
          >
            <span>Output</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView("chat")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer relative",
              mobileView === "chat"
                ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                : "text-neutral-400 hover:text-white",
            )}
          >
            <span>Agent</span>
            {messages.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileView("code")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              mobileView === "code"
                ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                : "text-neutral-400 hover:text-white",
            )}
          >
            <span>Code</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-[1000px]:flex-row min-w-0 overflow-hidden">
        {/* Chat History Sidebar */}
        <div
          className={cn(
            "h-full min-[1000px]:flex flex-col",
            mobileView === "chat" ? "flex flex-1" : "hidden min-[1000px]:flex",
          )}
        >
          <ChatSidebar
            ref={chatSidebarRef}
            messages={messages}
            pendingMessage={pendingMessage}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            hasManualEdits={hasManualEdits}
            // Generation props for embedded input
            onCodeGenerated={handleCodeChange}
            onStreamingChange={handleStreamingChange}
            onStreamPhaseChange={setStreamPhase}
            onError={handleError}
            prompt={prompt}
            onPromptChange={setPrompt}
            currentCode={code}
            conversationHistory={getFullContext()}
            previouslyUsedSkills={getPreviouslyUsedSkills()}
            isFollowUp={!isFirstGeneration}
            onMessageSent={handleMessageSent}
            onGenerationComplete={handleGenerationComplete}
            onErrorMessage={addErrorMessage}
            errorCorrection={errorCorrection ?? undefined}
            onPendingMessage={setPendingMessage}
            onClearPendingMessage={clearPendingMessage}
            // Frame capture props
            Component={Component}
            fps={fps}
            durationInFrames={durationInFrames}
            currentFrame={currentFrame}
          />
        </div>

        {/* Main content area */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 px-3 sm:px-6 min-[1000px]:pl-0 min-[1000px]:pr-12 pb-4 sm:pb-8 overflow-hidden",
            mobileView !== "chat" ? "flex" : "hidden min-[1000px]:flex",
          )}
        >
          <TabPanel
            activeTab={mobileView === "code" ? "code" : "preview"}
            onTabChange={(tab) => setMobileView(tab)}
            hideHeaderOnMobile
            codeContent={
              <CodeEditor
                code={hasGeneratedOnce && !generationError ? code : ""}
                onChange={handleCodeChange}
                isStreaming={isStreaming}
                streamPhase={streamPhase}
              />
            }
            previewContent={
              <div className="flex flex-col h-full min-h-0 overflow-y-auto min-[1000px]:overflow-hidden [scrollbar-width:none]">
                <AnimationPlayer
                  Component={generationError ? null : Component}
                  durationInFrames={durationInFrames}
                  fps={fps}
                  onDurationChange={setDurationInFrames}
                  onFpsChange={setFps}
                  isCompiling={isCompiling}
                  isStreaming={isStreaming}
                  error={generationError?.message || codeError}
                  errorType={generationError?.type || "compilation"}
                  code={code}
                  onCodeChange={handleCodeChange}
                  onRuntimeError={handleRuntimeError}
                  onFrameChange={setCurrentFrame}
                  initialVoice={initialVoice}
                  initialVoiceModel={initialVoiceModel}
                  initialLanguage={initialLanguage}
                  initialAutoCaption={initialAutoCaption}
                />
                {/* Mobile Quick Revise Banner */}
                <div className="flex min-[1000px]:hidden items-center justify-between mt-3 p-3 rounded-xl bg-neutral-900/90 border border-white/10 shrink-0">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">
                      Need changes or edits?
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      Ask assistant to adjust timing, colors, or script
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileView("chat")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold transition-colors cursor-pointer shrink-0 ml-3 shadow-md shadow-amber-400/20"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open Chat</span>
                  </button>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </PageLayout>
  );
}

function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-foreground" />
    </div>
  );
}

const GeneratePage: NextPage = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GeneratePageContent />
    </Suspense>
  );
};

export default GeneratePage;
