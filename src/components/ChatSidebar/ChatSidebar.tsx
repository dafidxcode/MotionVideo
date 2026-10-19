"use client";

import { Button } from "@/components/ui/button";
import { useGenerationApi } from "@/hooks/useGenerationApi";
import type {
  AssistantMetadata,
  ConversationContextMessage,
  ConversationMessage,
  EditOperation,
  ErrorCorrectionContext,
} from "@/types/conversation";
import {
  MODELS,
  type GenerationErrorType,
  type ModelId,
  type StreamPhase,
} from "@/types/generation";
import { PanelLeftClose, PanelLeftOpen, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { ChatHistory } from "./ChatHistory";
import { ChatInput } from "./ChatInput";

export interface ChatSidebarRef {
  triggerGeneration: (options?: {
    silent?: boolean;
    attachedImages?: string[];
    language?: string;
    voice?: string;
    voiceModel?: string;
    autoCaption?: boolean;
    aspectRatio?: string;
    duration?: number;
    fps?: number;
    model?: ModelId;
  }) => void;
}

interface ChatSidebarProps {
  messages: ConversationMessage[];
  pendingMessage?: {
    skills?: string[];
    startedAt: number;
  };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  hasManualEdits: boolean;
  // Generation callbacks
  onCodeGenerated?: (code: string) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  onStreamPhaseChange?: (phase: StreamPhase) => void;
  onError?: (
    error: string,
    type: GenerationErrorType,
    failedEdit?: EditOperation,
  ) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  currentCode?: string;
  conversationHistory?: ConversationContextMessage[];
  previouslyUsedSkills?: string[];
  isFollowUp?: boolean;
  onMessageSent?: (prompt: string, attachedImages?: string[]) => void;
  onGenerationComplete?: (
    code: string,
    summary?: string,
    metadata?: AssistantMetadata,
  ) => void;
  onErrorMessage?: (
    message: string,
    errorType: "edit_failed" | "api" | "validation",
  ) => void;
  errorCorrection?: ErrorCorrectionContext;
  onPendingMessage?: (skills?: string[]) => void;
  onClearPendingMessage?: () => void;
  // Frame capture props
  Component?: ComponentType | null;
  fps?: number;
  durationInFrames?: number;
  currentFrame?: number;
  // Active settings to preserve across manual revisions (BUG-16 + BUG-17)
  initialModel?: ModelId;
  language?: string;
  voice?: string;
  voiceModel?: string;
  autoCaption?: boolean;
  aspectRatio?: string;
  projectId?: string | null;
}

export const ChatSidebar = forwardRef<ChatSidebarRef, ChatSidebarProps>(
  function ChatSidebar(
    {
      messages,
      pendingMessage,
      isCollapsed,
      onToggleCollapse,
      hasManualEdits,
      onCodeGenerated,
      onStreamingChange,
      onStreamPhaseChange,
      onError,
      prompt,
      onPromptChange,
      currentCode,
      conversationHistory = [],
      previouslyUsedSkills = [],
      isFollowUp = false,
      onMessageSent,
      onGenerationComplete,
      onErrorMessage,
      errorCorrection,
      onPendingMessage,
      onClearPendingMessage,
      Component,
      fps = 30,
      durationInFrames = 150,
      currentFrame = 0,
      initialModel,
      language,
      voice,
      voiceModel,
      autoCaption,
      aspectRatio,
      projectId,
    },
    ref,
  ) {
    const [model, setModel] = useState<ModelId>(initialModel || MODELS[0].id);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [isDeletingProject, setIsDeletingProject] = useState(false);
    const promptRef = useRef<string>("");

    // Sync model if initialModel changes (BUG-16)
    useEffect(() => {
      if (initialModel) {
        setModel(initialModel);
      }
    }, [initialModel]);

    const { isLoading, runGeneration } = useGenerationApi();

    // Keep prompt ref in sync for use in triggerGeneration
    useEffect(() => {
      promptRef.current = prompt;
    }, [prompt]);

    const handleGeneration = async (options?: {
      silent?: boolean;
      attachedImages?: string[];
      language?: string;
      voice?: string;
      voiceModel?: string;
      autoCaption?: boolean;
      aspectRatio?: string;
      duration?: number;
      fps?: number;
      model?: ModelId;
    }) => {
      const currentPrompt = promptRef.current;
      if (!currentPrompt.trim()) return;

      onPromptChange(""); // Clear input immediately

      // BUG-17: Merge active settings so manual chat messages keep the user's language, ratio, duration, and voice
      const effectiveOptions = {
        language: options?.language ?? language,
        aspectRatio: options?.aspectRatio ?? aspectRatio,
        duration: options?.duration ?? durationInFrames,
        fps: options?.fps ?? fps,
        voice: options?.voice ?? voice,
        voiceModel: options?.voiceModel ?? voiceModel,
        autoCaption: options?.autoCaption ?? autoCaption,
        ...options,
      };

      const targetModel = options?.model || model;

      await runGeneration(
        currentPrompt,
        targetModel,
        {
          currentCode,
          conversationHistory,
          previouslyUsedSkills,
          isFollowUp,
          hasManualEdits,
          errorCorrection,
          frameImages: options?.attachedImages,
        },
        {
          onCodeGenerated,
          onStreamingChange,
          onStreamPhaseChange,
          onError,
          onMessageSent,
          onGenerationComplete,
          onErrorMessage,
          onPendingMessage,
          onClearPendingMessage,
        },
        effectiveOptions,
      );
    };

    // Expose triggerGeneration via ref
    useImperativeHandle(ref, () => ({
      triggerGeneration: handleGeneration,
    }));

    return (
      <div className="flex flex-col w-full h-full transition-all duration-300">
        {isCollapsed ? (
          <div className="flex flex-col items-center py-3 h-full bg-[#18181B] border border-[#28282C] rounded-2xl shadow-xl">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapse}
              className="text-[#9A9AA2] hover:text-[#F5F5F7] hover:bg-[#1F1F23] cursor-pointer"
              title="Expand Chat"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          /* Chat area container */
          <div className="flex-1 flex flex-col min-h-0 w-full h-full rounded-2xl bg-[#18181B] border border-[#28282C] shadow-xl overflow-hidden font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#28282C] shrink-0 bg-[#18181B]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-xs font-bold text-[#F5F5F7] tracking-wider uppercase">
                  Swdbot Assistant
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetDialog(true)}
                  title="Start over"
                  className="text-[#9A9AA2] hover:text-[#F5F5F7] hover:bg-[#1F1F23] text-xs gap-1.5 h-7 px-2 cursor-pointer rounded-lg"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleCollapse}
                  className="text-[#9A9AA2] hover:text-[#F5F5F7] hover:bg-[#1F1F23] h-7 w-7 cursor-pointer rounded-lg"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Reset Confirmation Dialog (BUG-35 + BUG-44) */}
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <DialogContent className="bg-[#18181B] border border-[#28282C] text-[#F5F5F7] max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold text-white">
                    Reset Animation & Chat
                  </DialogTitle>
                  <DialogDescription className="text-sm text-[#9A9AA2]">
                    How would you like to proceed? You can start a new animation while keeping this project in history, or permanently delete it.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4 sm:justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isDeletingProject}
                    onClick={() => setShowResetDialog(false)}
                    className="text-[#9A9AA2] hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isDeletingProject}
                    onClick={() => {
                      window.location.href = "/generate";
                    }}
                    className="bg-[#28282C] hover:bg-[#333338] text-white"
                  >
                    Start Fresh
                  </Button>
                  {projectId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isDeletingProject}
                      onClick={async () => {
                        try {
                          setIsDeletingProject(true);
                          await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, {
                            method: "DELETE",
                          });
                        } catch (err) {
                          console.error("Failed to delete project during reset:", err);
                        } finally {
                          window.location.href = "/generate";
                        }
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white"
                    >
                      {isDeletingProject ? "Deleting..." : "Delete & Start Over"}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Messages */}
            <ChatHistory messages={messages} pendingMessage={pendingMessage} />

            {/* Input */}
            <ChatInput
              prompt={prompt}
              onPromptChange={onPromptChange}
              model={model}
              onModelChange={setModel}
              isLoading={isLoading}
              onSubmit={(attachedImages) =>
                handleGeneration({ attachedImages })
              }
              Component={Component}
              fps={fps}
              durationInFrames={durationInFrames}
              currentFrame={currentFrame}
            />
          </div>
        )}
      </div>
    );
  },
);
