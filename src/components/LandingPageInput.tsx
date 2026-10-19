"use client";

import Link from "next/link";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { StylePicker } from "@/components/StylePicker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImageAttachments } from "@/hooks/useImageAttachments";
import { MODELS, type ModelId } from "@/types/generation";
import {
  VOICE_LANGUAGES,
  type VoiceEngineId,
  type VoiceLanguageCode,
  type VoiceOption,
} from "@/types/voice";
import { BANG_MOTION_STYLES } from "@/data/bangMotionStyles";
import { EXAMPLE_PROMPTS } from "@/data/examplePrompts";
import { cn } from "@/lib/utils";
import {
  ASPECT_RATIO_OPTIONS,
  type AspectRatioId,
} from "@/types/aspect-ratio";
import {
  ArrowRight,
  ArrowUp,
  Check,
  Clock,
  Film,
  Globe,
  Loader2,
  Mic,
  Monitor,
  Paperclip,
  Play,
  SlidersHorizontal,
  Smartphone,
  Square,
  Subtitles,
  Volume2,
  X,
  ExternalLink,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type LanguageCode = VoiceLanguageCode;

export const LANGUAGE_OPTIONS = VOICE_LANGUAGES.map((l) => ({
  id: l.id,
  label: l.label,
  flagUrl: l.flagUrl,
}));

export interface VoiceCatalogPayload {
  language: VoiceLanguageCode;
  voices: VoiceOption[];
  configured: boolean;
  warning: string | null;
}

export const BASE_DURATION_CONFIGS = [
  { value: "300", label: "10 seconds", seconds: 10 },
  { value: "600", label: "20 seconds", seconds: 20 },
  { value: "900", label: "30 seconds", seconds: 30 },
  { value: "1800", label: "1 minute", seconds: 60 },
  { value: "3600", label: "2 minutes", seconds: 120 },
];

export function getDurationOptions(ratePer10s: number = 2) {
  const safeRate = Number.isFinite(ratePer10s) && ratePer10s > 0 ? ratePer10s : 2;
  return BASE_DURATION_CONFIGS.map((d) => ({
    ...d,
    credits: Math.max(safeRate, Math.round((d.seconds / 10) * safeRate)),
  }));
}

// BUG-10: Default DURATION_OPTIONS computed dynamically from default rate
export const DURATION_OPTIONS = getDurationOptions(2);

interface LandingPageInputProps {
  onNavigate: (
    prompt: string,
    model: ModelId,
    attachedImages?: string[],
    options?: {
      language: LanguageCode;
      voiceModel: VoiceEngineId;
      voice: string;
      autoCaption: boolean;
      aspectRatio?: AspectRatioId;
      duration?: number;
      fps?: number;
    },
  ) => void;
  isNavigating?: boolean;
  showCodeExamplesLink?: boolean;
}

export function LandingPageInput({
  onNavigate,
  isNavigating = false,
  showCodeExamplesLink = false,
}: LandingPageInputProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [selectedExampleId, setSelectedExampleId] = useState<string>("");
  const [model, setModel] = useState<ModelId>(MODELS[0].id);
  const [language, setLanguage] = useState<LanguageCode>("ms");
  const voiceModel: VoiceEngineId = "auto";
  const [voice, setVoice] = useState<string>("");
  const [autoCaption, setAutoCaption] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>("16:9");
  const [durationInFrames, setDurationInFrames] = useState<number>(300);
  const [fps] = useState<number>(30);
  const [mobileTab, setMobileTab] = useState<"prompt" | "styles">("prompt");
  const [isStyleDraggingOver, setIsStyleDraggingOver] = useState(false);

  const [catalog, setCatalog] = useState<VoiceCatalogPayload | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const catalogCacheRef = useRef<Record<string, VoiceCatalogPayload>>({});

  const activeStyle = BANG_MOTION_STYLES.find((s) => s.id === selectedStyleId);
  const selectedExample = EXAMPLE_PROMPTS.find(
    (p) => p.id === selectedExampleId,
  );

  const currentLang =
    LANGUAGE_OPTIONS.find((l) => l.id === language) || LANGUAGE_OPTIONS[0];

  const [ratePer10s, setRatePer10s] = useState<number>(2);

  // BUG-10: Synchronize duration credit costs dynamically from server settings
  useEffect(() => {
    let isMounted = true;
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (isMounted && data?.pricing?.initialGenerationCost) {
          const fetchedRate = Number(data.pricing.initialGenerationCost);
          if (fetchedRate > 0) setRatePer10s(fetchedRate);
        }
      })
      .catch(() => { });
    return () => {
      isMounted = false;
    };
  }, []);

  const durationOptions = useMemo(
    () => getDurationOptions(ratePer10s),
    [ratePer10s],
  );

  const currentDuration =
    durationOptions.find((d) => d.value === String(durationInFrames)) ||
    durationOptions[0];

  // Load the language-scoped voice catalog with instant client-side caching.
  const loadVoiceCatalog = useCallback(async (lang: LanguageCode) => {
    if (catalogCacheRef.current[lang]) {
      setCatalog(catalogCacheRef.current[lang]);
      return;
    }
    setIsCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch(`/api/voices?language=${lang}`);
      if (!res.ok) throw new Error(`Voice catalog failed (${res.status})`);
      const data = (await res.json()) as VoiceCatalogPayload;
      catalogCacheRef.current[lang] = data;
      setCatalog(data);
    } catch (err) {
      setCatalog(null);
      setCatalogError(
        err instanceof Error ? err.message : "Could not load the voice catalog.",
      );
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVoiceCatalog(language);
  }, [language, loadVoiceCatalog]);

  // Curate to top 25 high-quality voices strictly matching selected language
  const availableVoices: VoiceOption[] = useMemo(() => {
    if (!catalog || catalog.language !== language) return [];
    const all = catalog.voices.filter((v) => v.language === language);
    if (all.length <= 25) return all;
    const top = all.slice(0, 25);
    if (voice && !top.some((v) => v.id === voice)) {
      const current = all.find((v) => v.id === voice);
      if (current) top.push(current);
    }
    return top;
  }, [catalog, language, voice]);

  // Keep the selection valid whenever the language or voices change.
  useEffect(() => {
    if (availableVoices.length === 0) {
      if (voice !== "") setVoice("");
      return;
    }
    if (!availableVoices.some((v) => v.id === voice)) {
      setVoice(availableVoices[0].id);
    }
  }, [availableVoices, voice]);

  const selectedVoice = availableVoices.find((v) => v.id === voice);
  const catalogWarning = catalog?.warning ?? null;
  const catalogWarningForUser = catalogError ?? catalogWarning;

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const handlePreview = (voiceOption: VoiceOption, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!voiceOption.previewUrl) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      if (playingVoiceId === voiceOption.id) {
        previewAudioRef.current = null;
        setPlayingVoiceId(null);
        return;
      }
      previewAudioRef.current = null;
    }

    try {
      const audio = new Audio(voiceOption.previewUrl);
      previewAudioRef.current = audio;
      setPlayingVoiceId(voiceOption.id);

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Audio playback aborted or prevented:", err);
          setPlayingVoiceId(null);
        });
      }

      audio.onended = () => {
        setPlayingVoiceId(null);
      };
      audio.onerror = () => {
        setPlayingVoiceId(null);
      };
    } catch (err) {
      console.warn("Failed to play audio preview:", err);
      setPlayingVoiceId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const {
    attachedImages,
    isDragging,
    fileInputRef,
    removeImage,
    handleFileSelect,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    canAddMore,
    error,
    clearError,
  } = useImageAttachments();

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !activeStyle || isNavigating) return;

    // BUG-46: Server system prompt is the single source of truth for aspect ratio instructions.
    // Client only passes the active visual style in prompt, options.aspectRatio handles dimensions.
    const finalPrompt = activeStyle
      ? `${prompt.trim()}\n\n## VISUAL STYLE & AESTHETIC DIRECTIVE (${activeStyle.name.toUpperCase()} - ${activeStyle.category}):\n${activeStyle.prompt}`
      : prompt.trim();

    onNavigate(
      finalPrompt,
      model,
      attachedImages.length > 0 ? attachedImages : undefined,
      {
        language,
        voiceModel,
        voice,
        autoCaption,
        aspectRatio,
        duration: durationInFrames,
        fps,
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCustomDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const isStyle =
      e.dataTransfer.types.includes("application/x-motion-style") ||
      e.dataTransfer.types.includes("text/plain");

    if (isStyle) {
      setIsStyleDraggingOver(true);
      e.dataTransfer.dropEffect = "copy";
    } else {
      handleDragOver(e);
    }
  };

  const handleCustomDragLeave = (e: React.DragEvent) => {
    setIsStyleDraggingOver(false);
    handleDragLeave(e);
  };

  const handleCustomDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsStyleDraggingOver(false);

    // 1. Check if a motion style was dropped from desktop gallery
    const styleData =
      e.dataTransfer.getData("application/x-motion-style") ||
      e.dataTransfer.getData("text/plain");

    if (styleData) {
      const matchedStyle = BANG_MOTION_STYLES.find(
        (s) => s.id === styleData.trim(),
      );
      if (matchedStyle) {
        setSelectedStyleId(matchedStyle.id);
        // CRITICAL: Keep user's typed prompt 100% intact!
        return;
      }
    }

    // 2. Otherwise delegate to image attachments drop
    await handleDrop(e);
  };

  const handleSelectExamplePrompt = useCallback((exampleId: string) => {
    const ex = EXAMPLE_PROMPTS.find((p) => p.id === exampleId);
    if (!ex) return;
    setSelectedExampleId(exampleId);
    // BUG-49: Never destructively overwrite user's work. If existing prompt has content, append or preserve.
    setPrompt((prev) => {
      const trimmed = prev.trim();
      if (trimmed && trimmed !== ex.prompt.trim()) {
        return `${trimmed}\n\n${ex.prompt}`;
      }
      return ex.prompt;
    });
    setSelectedStyleId(ex.styleId);
  }, []);

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 px-3 sm:px-6 lg:px-10 py-2 sm:py-3 min-h-0 h-full overflow-hidden font-sans">
      {/* Mobile Tab Switcher (Visible on mobile/tablet, hidden on lg desktop) */}
      <div className="col-span-12 flex lg:hidden items-center p-1 bg-[#18181B] rounded-xl border border-[#28282C] shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab("prompt")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            mobileTab === "prompt"
              ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
              : "text-[#9A9AA2] hover:text-white"
          )}
        >
          <span>Settings</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("styles")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            mobileTab === "styles"
              ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
              : "text-[#9A9AA2] hover:text-white"
          )}
        >
          <span>Styles</span>
        </button>
      </div>

      {/* Left Column: Prompt Input & Controls (1/3 of the layout on desktop) */}
      <div
        className={cn(
          "col-span-12 lg:col-span-4 flex flex-col h-full overflow-y-auto pr-1.5 pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#2E2E34] hover:[&::-webkit-scrollbar-thumb]:bg-[#404048] [&::-webkit-scrollbar-thumb]:rounded-full min-w-0",
          mobileTab !== "prompt" && "hidden lg:flex"
        )}
      >
        <div>
          {/* Header Title */}
          <div className="mb-4 lg:mb-5">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#F5F5F7] tracking-tight leading-tight mb-2">
              What do you want to create?
            </h1>
            <p className="text-xs sm:text-sm text-[#9A9AA2] leading-relaxed">
              Enter your story idea or pick a style from the gallery. AI will craft a cinematic motion graphics video following Bang Motion&apos;s Anti-PPT principles.
            </p>
            {showCodeExamplesLink && (
              <div className="mt-2.5 flex items-center">
                <Link
                  href="/code-examples"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold tracking-wide transition-colors"
                >
                  <span>Explore</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="w-full">

            {/* Prompt Textarea Card */}
            <div
              className={`relative bg-[#18181B] rounded-2xl border p-4 transition-all shadow-xl ${isStyleDraggingOver
                ? "border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40"
                : isDragging
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-[#28282C] hover:border-[#38383E]"
                }`}
              onDragOver={handleCustomDragOver}
              onDragLeave={handleCustomDragLeave}
              onDrop={handleCustomDrop}
            >
              {/* Drop style overlay for desktop */}
              {isStyleDraggingOver && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/90 backdrop-blur-sm rounded-2xl border-2 border-dashed border-amber-400 text-amber-300 p-4 pointer-events-none animate-in fade-in zoom-in-95">
                  <Film className="w-7 h-7 text-amber-400 mb-1.5 animate-bounce" />
                  <span className="font-bold text-sm text-white">
                    Drop to Apply Motion Style
                  </span>
                  <span className="text-xs text-neutral-400 mt-0.5">
                    Your typed prompt will remain completely intact
                  </span>
                </div>
              )}

              {/* Active Style Badge (Keeps user prompt untouched) */}
              {activeStyle && (
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 mb-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs shadow-sm animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[11px] text-amber-200/70 font-semibold uppercase tracking-wider shrink-0">
                      Style:
                    </span>
                    <span className="font-bold text-amber-300 truncate">
                      {activeStyle.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/50 text-neutral-300 border border-white/10 shrink-0">
                      {activeStyle.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStyleId(null);
                      setSelectedExampleId("");
                    }}
                    className="text-neutral-400 hover:text-white hover:bg-white/10 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                    title="Remove style"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Error message */}
              {error && (
                <ErrorDisplay
                  error={error}
                  variant="inline"
                  size="md"
                  onDismiss={clearError}
                  className="mb-3"
                />
              )}

              {/* Image previews */}
              {attachedImages.length > 0 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:none]">
                  {attachedImages.map((img, index) => (
                    <div key={index} className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={`Attached ${index + 1}`}
                        className="h-16 w-auto rounded-lg border border-white/15 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-1.5 -right-1.5 bg-neutral-950 border border-white/20 rounded-full p-0.5 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  isDragging
                    ? "Drop images or video here..."
                    : "Describe your motion graphics prompt or story idea... (images/video supported)"
                }
                rows={3}
                className="w-full bg-transparent text-[#F5F5F7] placeholder:text-[#6E6E76] focus:outline-none resize-none text-sm leading-relaxed min-h-[76px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                disabled={isNavigating}
              />

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#28282C]">
                <Select
                  value={model}
                  onValueChange={(value) => setModel(value as ModelId)}
                  disabled={isNavigating}
                >
                  <SelectTrigger className="w-auto bg-transparent border-none text-[#9A9AA2] hover:text-[#F5F5F7] text-xs h-8 px-2 transition-colors cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181B] border-[#28282C] text-[#F5F5F7]">
                    {MODELS.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        title={`${m.description} • Supports: ${m.modalities.join("/")}`}
                        className="text-[#F5F5F7] focus:bg-[#1F1F23] focus:text-white text-xs cursor-pointer"
                      >
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isNavigating || !canAddMore}
                    className="text-[#9A9AA2] hover:text-[#F5F5F7] hover:bg-[#1F1F23] h-8 w-8 cursor-pointer rounded-lg"
                    title="Attach images or video (video auto-extracted to frames)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>

                  <Button
                    type="submit"
                    size="icon-sm"
                    disabled={!prompt.trim() || !activeStyle || isNavigating}
                    loading={isNavigating}
                    className={cn(
                      "h-8 w-8 rounded-lg transition-colors",
                      !prompt.trim() || !activeStyle
                        ? "bg-[#28282C] text-[#6E6E76] cursor-not-allowed opacity-40"
                        : "bg-[#F5F5F7] text-black hover:bg-neutral-200 cursor-pointer"
                    )}
                    title={
                      !activeStyle
                        ? "Please select a Visual Motion Style first"
                        : !prompt.trim()
                          ? "Please enter a prompt"
                          : "Generate"
                    }
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Style Prompt Presets Dropdown */}
            <div className="w-full mt-3 bg-[#18181B] rounded-2xl border border-[#28282C] p-3 flex flex-col gap-2 shadow-xl">
              <label
                htmlFor="example-prompt-select"
                className="text-xs font-semibold text-[#E0E0E6] flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-[#9A9AA2]" />
                <span>Style Presets</span>
              </label>

              <Select
                value={selectedExampleId}
                onValueChange={handleSelectExamplePrompt}
                disabled={isNavigating}
              >
                <SelectTrigger
                  id="example-prompt-select"
                  className="w-full bg-[#121214] border border-[#2A2A30] hover:border-[#3E3E48] text-[#F5F5F7] h-12 px-2.5 rounded-xl transition-all cursor-pointer text-xs"
                >
                  {selectedExample ? (
                    <div className="flex items-center gap-2.5 truncate w-full pr-2 text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedExample.image}
                        alt=""
                        className="w-9 h-7 rounded-md object-cover border border-white/10 shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs text-white truncate">
                          {selectedExample.title}
                        </span>
                        <span className="text-[10px] text-[#9A9AA2] truncate">
                          {selectedExample.styleName}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#8E8E93] text-xs">
                      Select a visual style preset...
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent className="bg-[#18181B] border-[#28282C] text-[#F5F5F7] shadow-2xl max-h-80 w-[var(--radix-select-trigger-width)] min-w-[340px]">
                  {EXAMPLE_PROMPTS.map((ex) => (
                    <SelectItem
                      key={ex.id}
                      value={ex.id}
                      className="text-[#F5F5F7] focus:bg-[#202025] focus:text-white data-[state=checked]:bg-[#26262D] text-xs cursor-pointer py-2 px-2.5 border-b border-[#24242A] last:border-0"
                    >
                      <div className="flex items-center gap-3 w-full text-left pr-1">
                        {/* Visual Style Banner Thumbnail */}
                        <div className="relative w-16 h-10 rounded-md overflow-hidden shrink-0 border border-white/10 shadow-sm bg-black/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ex.image}
                            alt={ex.styleName}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Preset Info */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-white truncate">
                              {ex.title}
                            </span>
                            <span className="text-[10px] font-medium text-[#A1A1AA] shrink-0">
                              {ex.styleName}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#71717A] line-clamp-1 mt-0.5">
                            {ex.prompt}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vertically Ordered Generation Parameters */}
            <div className="w-full mt-3 bg-[#18181B] rounded-2xl border border-[#28282C] p-4 flex flex-col gap-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#28282C]">
                <span className="text-xs font-bold text-[#F5F5F7] uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  Parameters
                </span>
              </div>

              {/* 1. Language Selector with Real Flags */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="language-select"
                  className="text-xs font-semibold text-[#E0E0E6] flex items-center gap-1.5"
                >
                  <Globe className="w-3 h-3 text-[#9A9AA2]" />
                  Language
                </label>
                <Select
                  value={language}
                  onValueChange={(val) => {
                    setLanguage(val as LanguageCode);
                  }}
                  disabled={isNavigating}
                >
                  <SelectTrigger
                    id="language-select"
                    className="w-full bg-[#1F1F23] border border-[#28282C] text-[#F5F5F7] text-xs h-9 px-3 rounded-xl hover:bg-[#26262B] hover:border-[#38383E] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentLang.flagUrl}
                        alt={currentLang.label}
                        className="w-4 h-4 object-contain rounded-sm shrink-0"
                      />
                      <span>{currentLang.label}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181B] border-[#28282C] text-[#F5F5F7] shadow-2xl">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem
                        key={lang.id}
                        value={lang.id}
                        className="text-[#F5F5F7] focus:bg-[#1F1F23] focus:text-white text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={lang.flagUrl}
                            alt={lang.label}
                            className="w-4 h-4 object-contain rounded-sm shrink-0"
                          />
                          <span>{lang.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Voice Character Selector */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="voice-select"
                  className="text-xs font-semibold text-[#E0E0E6] flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-[#9A9AA2]" />
                    Voice Character
                  </span>
                </label>
                <Select
                  value={voice}
                  onValueChange={(val) => setVoice(val)}
                  disabled={isNavigating || isCatalogLoading || voice === ""}
                >
                  <SelectTrigger
                    id="voice-select"
                    className="w-full bg-[#1F1F23] border border-[#28282C] text-[#F5F5F7] text-xs h-9 px-2.5 rounded-xl hover:bg-[#26262B] hover:border-[#38383E] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isCatalogLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-[#0084FF]" />
                        <span>Loading voices…</span>
                      </div>
                    ) : selectedVoice ? (
                      <div className="flex items-center gap-2 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentLang.flagUrl}
                          alt=""
                          className="w-4 h-4 object-contain rounded-sm shrink-0"
                        />
                        <span className="font-semibold text-xs truncate">
                          {selectedVoice.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-[#9A9AA2] shrink-0 font-medium">
                          {selectedVoice.tag}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[#9A9AA2]">
                        No voices available
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181B] border-[#28282C] text-[#F5F5F7] shadow-2xl max-h-72 w-[var(--radix-select-trigger-width)] min-w-[320px]">
                    {availableVoices.length === 0 ? (
                      <div className="px-3 py-3 text-[11px] text-[#9A9AA2]">
                        {catalogWarningForUser ??
                          `No voices available for ${currentLang.label}.`}
                      </div>
                    ) : (
                      availableVoices.map((v) => {
                        const isSelected = v.id === voice;
                        return (
                          <SelectItem
                            key={v.id}
                            value={v.id}
                            hideIndicator
                            className="text-[#F5F5F7] focus:bg-[#1F1F23] focus:text-white data-[state=checked]:bg-[#26262B] text-xs cursor-pointer py-2 pl-2.5 pr-16 relative w-full"
                          >
                            {/* Left: Flag + Voice Name + Gender badge in 1 row */}
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={currentLang.flagUrl}
                                alt=""
                                className="w-4 h-4 object-contain rounded-sm shrink-0"
                              />
                              <span className="font-semibold text-xs text-[#F5F5F7] truncate max-w-[185px]">
                                {v.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/5 text-[#9A9AA2] shrink-0 font-medium">
                                {v.tag}
                              </span>
                            </div>

                            {/* Right: Checkmark if selected */}
                            {isSelected && (
                              <span className="absolute right-9 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                <Check className="w-3.5 h-3.5 text-[#0084FF]" />
                              </span>
                            )}

                            {/* Far Right Edge: Preview Play Button pinned to the right edge */}
                            {v.previewUrl && (
                              <button
                                type="button"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                }}
                                onPointerUp={(e) => {
                                  e.stopPropagation();
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                                onMouseUp={(e) => {
                                  e.stopPropagation();
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handlePreview(v, e);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 text-neutral-400 hover:text-amber-300 transition-colors shrink-0 cursor-pointer"
                                title={`Preview sample`}
                              >
                                {playingVoiceId === v.id ? (
                                  <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                ) : (
                                  <Play className="w-3 h-3 text-neutral-400 hover:text-amber-300 fill-current" />
                                )}
                              </button>
                            )}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>

                {catalogWarningForUser && (
                  <p className="text-[10px] leading-snug text-amber-400/90">
                    {catalogWarningForUser}
                  </p>
                )}
              </div>

              {/* 3. Aspect Ratio Selector (9:16, 1:1, 16:9) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#E0E0E6] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-[#9A9AA2]" />
                    Aspect Ratio
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono font-medium">
                    {aspectRatio === "9:16"
                      ? "1080x1920"
                      : aspectRatio === "1:1"
                        ? "1080x1080"
                        : "1920x1080"}
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIO_OPTIONS.map((opt) => {
                    const isSelected = aspectRatio === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAspectRatio(opt.id)}
                        disabled={isNavigating}
                        className={cn(
                          "flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs transition-all cursor-pointer",
                          isSelected
                            ? "bg-amber-400/15 border-amber-400 text-amber-300 font-bold shadow-md shadow-amber-400/10"
                            : "bg-[#1F1F23] border-[#28282C] text-[#9A9AA2] hover:bg-[#26262B] hover:text-[#F5F5F7]",
                        )}
                        title={opt.sublabel}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {opt.id === "9:16" ? (
                            <Smartphone className="w-3.5 h-3.5" />
                          ) : opt.id === "1:1" ? (
                            <Square className="w-3.5 h-3.5" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5" />
                          )}
                          <span className="text-xs">{opt.id}</span>
                        </div>
                        <span className="text-[9px] opacity-75 truncate max-w-full">
                          {opt.id === "9:16"
                            ? "Vertical"
                            : opt.id === "1:1"
                              ? "Square"
                              : "Landscape"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Duration Selector */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="duration-select"
                  className="text-xs font-semibold text-[#E0E0E6] flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-[#9A9AA2]" />
                  Duration
                </label>
                <Select
                  value={String(durationInFrames)}
                  onValueChange={(val) => setDurationInFrames(parseInt(val, 10))}
                  disabled={isNavigating}
                >
                  <SelectTrigger
                    id="duration-select"
                    className="w-full bg-[#1F1F23] border border-[#28282C] text-[#F5F5F7] text-xs h-9 px-3 rounded-xl hover:bg-[#26262B] hover:border-[#38383E] transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full pr-1">
                      <span className="font-semibold">{currentDuration.label}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 text-amber-300">
                        {currentDuration.credits} Credits
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181B] border-[#28282C] text-[#F5F5F7] shadow-2xl">
                    {durationOptions.map((d) => (
                      <SelectItem
                        key={d.value}
                        value={d.value}
                        className="text-[#F5F5F7] focus:bg-[#1F1F23] focus:text-white text-xs cursor-pointer py-1.5"
                      >
                        <div className="flex items-center justify-between w-full pr-1 gap-3">
                          <span className="font-semibold text-white">{d.label}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/25 text-amber-300 shrink-0">
                            {d.credits} Credits
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 5. Auto-Captions Checkbox */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[#28282C] bg-[#1F1F23] hover:bg-[#26262B] hover:border-[#38383E] transition-all">
                <label
                  htmlFor="auto-caption-toggle"
                  className="flex items-center gap-2.5 cursor-pointer flex-1"
                >
                  <Subtitles className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#F5F5F7]">
                      Auto-Captions
                    </span>
                  </div>
                </label>
                <input
                  type="checkbox"
                  id="auto-caption-toggle"
                  checked={autoCaption}
                  onChange={(e) => setAutoCaption(e.target.checked)}
                  disabled={isNavigating}
                  className="w-4 h-4 accent-amber-400 cursor-pointer rounded shrink-0"
                />
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex flex-col gap-2 mt-3 pb-2">
              {!activeStyle && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs animate-in fade-in">
                  <span>Select a Visual Motion Style to continue</span>
                </div>
              )}
              <Button
                type="submit"
                disabled={!prompt.trim() || !activeStyle || isNavigating}
                loading={isNavigating}
                className={cn(
                  "w-full font-semibold h-11 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2",
                  !prompt.trim() || !activeStyle
                    ? "bg-[#232326] text-[#71717A] cursor-not-allowed opacity-60 shadow-none border border-[#2E2E34]"
                    : "bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/20 cursor-pointer"
                )}
              >
                <span>
                  {!activeStyle
                    ? "Select a Style to Generate"
                    : !prompt.trim()
                      ? "Enter a Prompt to Generate"
                      : `Generate Motion (${currentDuration.credits} Credits)`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column: Bang Motion Style Gallery (2/3 of the layout on desktop) */}
      <div
        className={cn(
          "col-span-12 lg:col-span-8 h-full flex flex-col overflow-hidden min-w-0",
          mobileTab !== "styles" && "hidden lg:flex"
        )}
      >
        <StylePicker
          selectedStyleId={selectedStyleId}
          onSelectStyle={(s) => {
            const nextId = selectedStyleId === s.id ? null : s.id;
            setSelectedStyleId(nextId);
            if (!nextId) {
              setSelectedExampleId("");
            }
            setMobileTab("prompt");
          }}
        />
      </div>
    </div>
  );
}
