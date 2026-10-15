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
  const initialLanguage = searchParams.get("language") || "ms";
  const initialVoiceModel = searchParams.get("voiceModel") || "auto";
  const initialVoice = searchParams.get("voice") || "";
  const initialAutoCaption = searchParams.get("autoCaption") !== "false";
  const initialProjectId = searchParams.get("projectId") || null;
  const initialAspectRatio = (searchParams.get("aspectRatio") as "16:9" | "9:16" | "1:1") || "16:9";

  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">(initialAspectRatio);

  const pendingSettingsRef = useRef({
    voice: initialVoice,
    language: initialLanguage,
    voiceModel: initialVoiceModel,
    autoCaption: initialAutoCaption,
    aspectRatio: initialAspectRatio,
  });

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
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
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
    loadConversationMessages,
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

  // Load saved project from history if projectId is in query param
  useEffect(() => {
    if (!initialProjectId) return;
    let isMounted = true;
    async function loadProject() {
      try {
        const res = await fetch(`/api/projects?id=${encodeURIComponent(initialProjectId!)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.project && isMounted) {
            const p = data.project;
            setProjectId(p.id);
            if (p.prompt) setPrompt(p.prompt);
            if (p.durationInFrames) setDurationInFrames(p.durationInFrames);
            if (p.fps) setFps(p.fps);
            if (p.code) {
              setCode(p.code);
              compileCode(p.code);
              setHasGeneratedOnce(true);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load project:", err);
      }
    }
    loadProject();
    return () => {
      isMounted = false;
    };
  }, [initialProjectId, setCode, compileCode]);

  const saveProjectState = useCallback(
    async (codeToSave: string, promptText?: string) => {
      try {
        const currentId =
          projectId || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        if (!projectId) {
          setProjectId(currentId);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("projectId", currentId);
            window.history.replaceState({}, "", url.toString());
          }
        }

        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentId,
            title: (promptText || prompt || "Untitled Motion").slice(0, 45).replace(/\n/g, " "),
            prompt: promptText || prompt || "Motion Graphics Animation",
            code: codeToSave,
            durationInFrames,
            fps,
            conversationHistory: getFullContext(),
          }),
        });
      } catch (err) {
        console.warn("Auto-save project error:", err);
      }
    },
    [projectId, prompt, durationInFrames, fps, getFullContext],
  );

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
        saveProjectState(newCode);
      }, 500);
    },
    [setCode, compileCode, markManualEdit, markAsUserEdited, saveProjectState],
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
      saveProjectState(generatedCode);

      // Automatically synthesize the HeyGen voiceover and captions on initial generation
      if (!autoVoiceoverAppliedRef.current) {
        autoVoiceoverAppliedRef.current = true;
        const script = extractScriptFromCode(generatedCode) || prompt || initialPrompt;
        const currentSettings = pendingSettingsRef.current;
        const effectiveVoice = currentSettings.voice || initialVoice || "f5d7ba1dfec24c32bc3c372e210d41ed";
        const effectiveLanguage = currentSettings.language || initialLanguage || "ms";
        const effectiveVoiceModel = currentSettings.voiceModel || initialVoiceModel || "auto";
        const effectiveAutoCaption = currentSettings.autoCaption ?? initialAutoCaption;

        if (script && !/<Audio\s+[^>]*\/>/.test(generatedCode)) {
          try {
            const res = await fetch("/api/voiceover", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: script.trim(),
                voice: effectiveVoice,
                engine: effectiveVoiceModel,
                language: effectiveLanguage,
                speed: 1.0,
                withCaptions: effectiveAutoCaption,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              const reliableAudioUrl = data.remoteAudioUrl || data.audioUrl || data.fileUrl;
              if (reliableAudioUrl) {
                const completeCode = injectAudioAndCaptionsIntoCode(
                  generatedCode,
                  reliableAudioUrl,
                  effectiveAutoCaption && data.words ? data.words : [],
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
                  data.engine && data.engine !== "auto" ? data.engine : "SwdVoice";
                addAssistantMessage(
                  `🎙️ **Voiceover & Captions Ready!**\nAuto-applied SwdVoice (${engineLabel}) with ${initialAutoCaption ? "word-level synced captions" : "clean audio narration"}. You can preview the complete video now or customize anything below.`,
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

  // Check for pending generation from Landing Page or load existing project from history/refresh
  useEffect(() => {
    if (hasAutoStarted) return;

    // A. Check for fresh generation payload stored in sessionStorage (clean URL transition)
    const pendingJson = typeof window !== "undefined" ? sessionStorage.getItem("pending_generation") : null;
    if (pendingJson) {
      try {
        const pending = JSON.parse(pendingJson);
        sessionStorage.removeItem("pending_generation");
        setHasAutoStarted(true);

        const targetId = pending.projectId || projectId || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        setProjectId(targetId);

        // Instantly clean the browser URL so prompt text is NEVER displayed or stored in history/refresh
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", `/generate?projectId=${encodeURIComponent(targetId)}`);
        }

        if (pending.duration) setDurationInFrames(pending.duration);
        if (pending.fps) setFps(pending.fps);
        if (pending.aspectRatio) setAspectRatio(pending.aspectRatio);

        pendingSettingsRef.current = {
          voice: pending.voice || initialVoice,
          language: pending.language || initialLanguage,
          voiceModel: pending.voiceModel || initialVoiceModel,
          autoCaption: pending.autoCaption ?? initialAutoCaption,
          aspectRatio: pending.aspectRatio || initialAspectRatio,
        };

        setPrompt(pending.prompt);
        setIsStreaming(true);
        setStreamPhase("reasoning");

        setTimeout(() => {
          chatSidebarRef.current?.triggerGeneration({
            attachedImages: pending.attachedImages,
            language: pending.language || initialLanguage,
            voice: pending.voice || initialVoice,
            voiceModel: pending.voiceModel || initialVoiceModel,
            autoCaption: pending.autoCaption ?? initialAutoCaption,
            aspectRatio: pending.aspectRatio || initialAspectRatio,
            duration: pending.duration || durationInFrames,
            fps: pending.fps || fps,
          });
        }, 150);
        return;
      } catch (err) {
        console.warn("Failed to parse pending generation:", err);
      }
    }

    // B. Legacy URL fallback: If user opened a URL containing ?prompt=, clean it immediately!
    if (initialPrompt && typeof window !== "undefined") {
      const cleanUrl = projectId || initialProjectId
        ? `/generate?projectId=${encodeURIComponent((projectId || initialProjectId)!)}`
        : `/generate`;
      window.history.replaceState({}, "", cleanUrl);
    }

    // C. If projectId is present and NO fresh generation pending: LOAD EXISTING PROJECT (Refresh or History Modal)
    const targetProjectId = projectId || initialProjectId;
    if (targetProjectId) {
      setHasAutoStarted(true);
      setIsStreaming(false);
      setStreamPhase("idle");

      fetch(`/api/projects?id=${encodeURIComponent(targetProjectId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.project) {
            const p = data.project;
            if (p.code) {
              setCode(p.code);
              compileCode(p.code);
              setHasGeneratedOnce(true);
            }
            if (p.durationInFrames) setDurationInFrames(p.durationInFrames);
            if (p.fps) setFps(p.fps);
            if (p.prompt) setPrompt(p.prompt);
            if (p.renderUrl) setRenderedVideoUrl(p.renderUrl);

            // Restore complete conversation history & logs
            if (Array.isArray(p.conversationHistory) && p.conversationHistory.length > 0) {
              loadConversationMessages(p.conversationHistory);
            }
          }
        })
        .catch((err) => console.warn("Failed to load project from history:", err));
      return;
    }

    // D. Fallback if initialPrompt was provided via direct link without projectId:
    if (initialPrompt && chatSidebarRef.current) {
      setHasAutoStarted(true);
      setTimeout(() => {
        chatSidebarRef.current?.triggerGeneration({
          language: initialLanguage,
          voice: initialVoice,
          voiceModel: initialVoiceModel,
          autoCaption: initialAutoCaption,
          duration: durationInFrames,
          fps,
        });
      }, 100);
    }
  }, [
    hasAutoStarted,
    initialPrompt,
    projectId,
    initialProjectId,
    initialLanguage,
    initialVoice,
    initialVoiceModel,
    initialAutoCaption,
    durationInFrames,
    fps,
    compileCode,
    setCode,
    loadConversationMessages,
  ]);

  return (
    <PageLayout showLogoAsLink>
      {/* Mobile View Switcher (Visible on mobile/tablet < 1000px, hidden on desktop >= 1000px) */}
      <div className="flex min-[1000px]:hidden items-center justify-between px-3 py-2 bg-[#18181B] border-b border-[#28282C] shrink-0">
        <div className="flex items-center gap-1 bg-[#1F1F23] p-1 rounded-xl border border-[#28282C] w-full">
          <button
            type="button"
            onClick={() => setMobileView("preview")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              mobileView === "preview"
                ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                : "text-[#9A9AA2] hover:text-white",
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
                : "text-[#9A9AA2] hover:text-white",
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
                : "text-[#9A9AA2] hover:text-white",
            )}
          >
            <span>Code</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-[1000px]:flex-row min-w-0 overflow-hidden px-3 sm:px-6 min-[1000px]:px-12 pb-4 sm:pb-8 gap-4 min-[1000px]:gap-6 font-sans">
        {/* Chat History Sidebar: 1/3 of the layout on desktop (or collapsed) */}
        <div
          className={cn(
            "h-full flex flex-col transition-all duration-300 min-w-0",
            isSidebarCollapsed
              ? "min-[1000px]:w-14 shrink-0"
              : "w-full min-[1000px]:w-[calc(33.333%-1rem)] shrink-0",
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

        {/* Main content area: 2/3 of the layout on desktop */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300",
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
                {renderedVideoUrl && (
                  <div className="flex items-center justify-between px-3.5 py-2 mb-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-semibold">Rendered MP4 Ready</span>
                      <span className="text-[10px] text-emerald-400/70 font-mono">(24h auto-clean)</span>
                    </div>
                    <a
                      href={renderedVideoUrl}
                      download={`motion-${projectId || "video"}.mp4`}
                      className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 font-semibold text-emerald-200 transition-colors"
                    >
                      Download MP4
                    </a>
                  </div>
                )}
                <AnimationPlayer
                  Component={generationError ? null : Component}
                  durationInFrames={durationInFrames}
                  fps={fps}
                  projectId={projectId ?? undefined}
                  aspectRatio={aspectRatio}
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
                <div className="flex min-[1000px]:hidden items-center justify-between mt-3 p-3 rounded-xl bg-[#18181B] border border-[#28282C] shrink-0">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#F5F5F7]">
                      Need changes or edits?
                    </span>
                    <span className="text-[11px] text-[#9A9AA2]">
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
