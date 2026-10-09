"use client";

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
import { BANG_MOTION_STYLES } from "@/data/bangMotionStyles";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowUp,
  Clock,
  Globe,
  Mic,
  Paperclip,
  SlidersHorizontal,
  Sparkles,
  Subtitles,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";

export type LanguageCode = "en" | "ms" | "id";

export const LANGUAGE_OPTIONS: { id: LanguageCode; label: string; flagUrl: string }[] = [
  { id: "en", label: "English", flagUrl: "https://flagsapi.com/US/flat/64.png" },
  { id: "ms", label: "Malay", flagUrl: "https://flagsapi.com/MY/flat/64.png" },
  { id: "id", label: "Indonesian", flagUrl: "https://flagsapi.com/ID/flat/64.png" },
];

export const VOICE_OPTIONS: Record<
  LanguageCode,
  { id: string; name: string; tag: string; desc: string }[]
> = {
  en: [
    { id: "onyx", name: "Onyx", tag: "Recommended", desc: "Deep, authoritative, documentary-style" },
    { id: "nova", name: "Nova", tag: "Popular", desc: "Energetic, clear, and engaging explainer" },
    { id: "alloy", name: "Alloy", tag: "Neutral", desc: "Balanced, modern, versatile tech voice" },
    { id: "echo", name: "Echo", tag: "Natural", desc: "Warm, natural, conversational storytelling" },
    { id: "fable", name: "Fable", tag: "Story", desc: "Dynamic narrative tone with storytelling cadence" },
    { id: "shimmer", name: "Shimmer", tag: "Elegant", desc: "Soft, graceful, premium brand voice" },
  ],
  ms: [
    { id: "onyx", name: "Onyx", tag: "Disyorkan", desc: "Garau, berwibawa, sesuai dokumentari & sejarah" },
    { id: "nova", name: "Nova", tag: "Popular", desc: "Bertenaga, ceria & jelas untuk penerangan" },
    { id: "alloy", name: "Alloy", tag: "Neutral", desc: "Seimbang, kemas & profesional" },
    { id: "echo", name: "Echo", tag: "Natural", desc: "Mesra, santai & semula jadi" },
    { id: "fable", name: "Fable", tag: "Story", desc: "Gaya naratif ekspresif bercerita" },
    { id: "shimmer", name: "Shimmer", tag: "Elegan", desc: "Lembut, jernih & tenang untuk jenama" },
  ],
  id: [
    { id: "onyx", name: "Onyx", tag: "Rekomendasi", desc: "Berat, berwibawa, cocok untuk sejarah & sains" },
    { id: "nova", name: "Nova", tag: "Populer", desc: "Energik, hangat & sangat jelas untuk explainer" },
    { id: "alloy", name: "Alloy", tag: "Neutral", desc: "Seimbang, modern untuk promo & tutorial" },
    { id: "echo", name: "Echo", tag: "Natural", desc: "Ramah, santai & natural" },
    { id: "fable", name: "Fable", tag: "Story", desc: "Ekspresif, gaya bercerita / naratif" },
    { id: "shimmer", name: "Shimmer", tag: "Elegan", desc: "Jernih, lembut & artikulatif" },
  ],
};

export const DURATION_OPTIONS = [
  { value: "300", label: "10 seconds" },
  { value: "600", label: "20 seconds" },
  { value: "900", label: "30 seconds" },
  { value: "1800", label: "1 minute" },
  { value: "3600", label: "2 minutes" },
];

interface LandingPageInputProps {
  onNavigate: (
    prompt: string,
    model: ModelId,
    attachedImages?: string[],
    options?: {
      language: LanguageCode;
      voice: string;
      autoCaption: boolean;
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
}: LandingPageInputProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [model, setModel] = useState<ModelId>(MODELS[0].id);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [voice, setVoice] = useState<string>("onyx");
  const [autoCaption, setAutoCaption] = useState<boolean>(true);
  const [durationInFrames, setDurationInFrames] = useState<number>(300);
  const [fps] = useState<number>(30);
  const [mobileTab, setMobileTab] = useState<"prompt" | "styles">("prompt");
  const [isStyleDraggingOver, setIsStyleDraggingOver] = useState(false);

  const activeStyle = BANG_MOTION_STYLES.find((s) => s.id === selectedStyleId);

  const currentLang =
    LANGUAGE_OPTIONS.find((l) => l.id === language) || LANGUAGE_OPTIONS[0];

  const currentDuration =
    DURATION_OPTIONS.find((d) => d.value === String(durationInFrames)) ||
    DURATION_OPTIONS[0];

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
    if (!prompt.trim() || isNavigating) return;

    // Embed visual style instructions into prompt sent to AI Agent
    // WITHOUT touching or mutating the user's typed prompt in the input textarea!
    const finalPrompt = activeStyle
      ? `${prompt.trim()}\n\n## VISUAL STYLE & AESTHETIC DIRECTIVE (${activeStyle.name.toUpperCase()} - ${activeStyle.category}):\n${activeStyle.prompt}`
      : prompt.trim();

    onNavigate(
      finalPrompt,
      model,
      attachedImages.length > 0 ? attachedImages : undefined,
      {
        language,
        voice,
        autoCaption,
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

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-8 px-3 sm:px-6 lg:px-12 pb-4 sm:pb-8 min-h-0 overflow-hidden">
      {/* Mobile Tab Switcher (Visible on mobile/tablet, hidden on lg desktop) */}
      <div className="flex lg:hidden items-center p-1 bg-neutral-900/90 rounded-xl border border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab("prompt")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            mobileTab === "prompt"
              ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
              : "text-neutral-400 hover:text-white"
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
              : "text-neutral-400 hover:text-white"
          )}
        >
          <span>Styles</span>
        </button>
      </div>

      {/* Left Column: Prompt Input & Controls */}
      <div
        className={cn(
          "w-full lg:w-[460px] xl:w-[500px] flex flex-col justify-between shrink-0 h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          mobileTab !== "prompt" && "hidden lg:flex"
        )}
      >
        <div>
          {/* Header Title */}
          <div className="mb-4 lg:mb-5">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-2">
              What do you want to create?
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Enter your story idea or pick a style from the gallery. AI will craft a cinematic motion graphics video following Bang Motion&apos;s Anti-PPT principles.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full">

            {/* Prompt Textarea Card */}
            <div
              className={`relative bg-neutral-900/90 rounded-2xl border p-4 transition-all shadow-xl ${isStyleDraggingOver
                  ? "border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40"
                  : isDragging
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-white/10 hover:border-white/20"
                }`}
              onDragOver={handleCustomDragOver}
              onDragLeave={handleCustomDragLeave}
              onDrop={handleCustomDrop}
            >
              {/* Drop style overlay for desktop */}
              {isStyleDraggingOver && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/90 backdrop-blur-sm rounded-2xl border-2 border-dashed border-amber-400 text-amber-300 p-4 pointer-events-none animate-in fade-in zoom-in-95">
                  <Sparkles className="w-7 h-7 text-amber-400 mb-1.5 animate-bounce" />
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
                    onClick={() => setSelectedStyleId(null)}
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
                rows={6}
                className="w-full bg-transparent text-white placeholder:text-neutral-500 focus:outline-none resize-none text-sm leading-relaxed [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                <Select
                  value={model}
                  onValueChange={(value) => setModel(value as ModelId)}
                  disabled={isNavigating}
                >
                  <SelectTrigger className="w-auto bg-transparent border-none text-neutral-300 hover:text-white text-xs h-8 px-2 transition-colors cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-white/10">
                    {MODELS.map((m) => (
                      <SelectItem
                        key={m.id}
                        value={m.id}
                        title={`${m.description} • Supports: ${m.modalities.join("/")}`}
                        className="text-neutral-200 focus:bg-neutral-800 focus:text-white text-xs"
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
                    className="text-neutral-400 hover:text-white h-8 w-8 cursor-pointer"
                    title="Attach images or video (video auto-extracted to frames)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>

                  <Button
                    type="submit"
                    size="icon-sm"
                    disabled={!prompt.trim() || isNavigating}
                    loading={isNavigating}
                    className="bg-white text-black hover:bg-neutral-200 h-8 w-8 rounded-lg cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Vertically Ordered Generation Parameters */}
            <div className="w-full mt-3 bg-neutral-900/90 rounded-2xl border border-white/10 p-4 flex flex-col gap-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  Parameters
                </span>
              </div>

              {/* 1. Language Selector with Real Flags */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="language-select"
                  className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5"
                >
                  <Globe className="w-3 h-3 text-neutral-400" />
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
                    className="w-full bg-neutral-800/90 border border-white/15 text-white text-xs h-9 px-3 rounded-xl hover:bg-neutral-800 hover:border-white/30 transition-all cursor-pointer"
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
                  <SelectContent className="bg-neutral-800 border-white/15 text-white shadow-2xl">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem
                        key={lang.id}
                        value={lang.id}
                        className="text-neutral-200 focus:bg-neutral-700 focus:text-white text-xs cursor-pointer"
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

              {/* 2. Voice Model Selector (Filtered by Language) */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="voice-select"
                  className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5 text-neutral-400" />
                  Voice
                </label>
                <Select
                  value={voice}
                  onValueChange={(val) => setVoice(val)}
                  disabled={isNavigating}
                >
                  <SelectTrigger
                    id="voice-select"
                    className="w-full bg-neutral-800/90 border border-white/15 text-white text-xs h-9 px-3 rounded-xl hover:bg-neutral-800 hover:border-white/30 transition-all cursor-pointer"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-white/15 text-white shadow-2xl">
                    {VOICE_OPTIONS[language].map((v) => (
                      <SelectItem
                        key={v.id}
                        value={v.id}
                        className="text-neutral-200 focus:bg-neutral-700 focus:text-white text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{v.name}</span>
                          <span className="text-[10px] text-neutral-400">
                            — {v.desc}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Duration Selector */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="duration-select"
                  className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  Duration
                </label>
                <Select
                  value={String(durationInFrames)}
                  onValueChange={(val) => setDurationInFrames(parseInt(val, 10))}
                  disabled={isNavigating}
                >
                  <SelectTrigger
                    id="duration-select"
                    className="w-full bg-neutral-800/90 border border-white/15 text-white text-xs h-9 px-3 rounded-xl hover:bg-neutral-800 hover:border-white/30 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{currentDuration.label}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-white/15 text-white shadow-2xl">
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem
                        key={d.value}
                        value={d.value}
                        className="text-neutral-200 focus:bg-neutral-700 focus:text-white text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{d.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Auto-Captions Checkbox */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/15 bg-neutral-800/90 hover:bg-neutral-800 hover:border-white/30 transition-all">
                <label
                  htmlFor="auto-caption-toggle"
                  className="flex items-center gap-2.5 cursor-pointer flex-1"
                >
                  <Subtitles className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white">
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
            <Button
              type="submit"
              disabled={!prompt.trim() || isNavigating}
              loading={isNavigating}
              className="w-full mt-3.5 bg-amber-400 hover:bg-amber-300 text-black font-semibold h-11 rounded-xl shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Generate Motion</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Right Column: Bang Motion Style Gallery */}
      <div
        className={cn(
          "flex-1 min-w-0 h-full flex flex-col overflow-hidden",
          mobileTab !== "styles" && "hidden lg:flex"
        )}
      >
        <StylePicker
          selectedStyleId={selectedStyleId}
          onSelectStyle={(s) => {
            // Toggle selection without overwriting user's typed prompt!
            setSelectedStyleId(selectedStyleId === s.id ? null : s.id);
            setMobileTab("prompt");
          }}
        />
      </div>
    </div>
  );
}
