"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Clock,
  Mic,
  Music,
  RotateCcw,
  Sparkles,
  Subtitles,
  Volume2,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CaptionWord } from "@/remotion/AnimatedCaptions";

interface VoiceoverModalProps {
  code: string;
  onCodeChange?: (newCode: string) => void;
  durationInFrames: number;
  fps: number;
  onDurationChange?: (duration: number) => void;
  initialVoice?: string;
  initialAutoCaption?: boolean;
}

const VOICES = [
  {
    id: "onyx",
    name: "Onyx (Male)",
    desc: "Deep, authoritative, documentary & history style",
    tag: "Recommended",
  },
  {
    id: "nova",
    name: "Nova (Female)",
    desc: "Energetic, clear, and engaging modern explainer",
    tag: "Popular",
  },
  {
    id: "alloy",
    name: "Alloy (Neutral)",
    desc: "Balanced, clean, modern tech voice",
    tag: "Neutral",
  },
  {
    id: "echo",
    name: "Echo (Male)",
    desc: "Warm, natural, conversational storytelling",
    tag: "Natural",
  },
  {
    id: "fable",
    name: "Fable (Expressive)",
    desc: "Dynamic narrative tone with storytelling cadence",
    tag: "Story",
  },
  {
    id: "shimmer",
    name: "Shimmer (Female)",
    desc: "Soft, graceful, elegant premium brand voice",
    tag: "Elegant",
  },
];

// Helper to extract voiceover script from code
export function extractScriptFromCode(sourceCode: string): string {
  if (!sourceCode) return "";

  // 1. Look for const VOICEOVER_SCRIPT / VOICEOVER / NARRATION / SCRIPT = `...` or "..."
  const match = sourceCode.match(
    /(?:const|let|var|export\s+const)\s+(?:VOICEOVER_SCRIPT|VOICEOVER|NARRATION|SCRIPT)\s*=\s*(?:`([\s\S]*?)`|"([^"]*)"|'([^']*)')/,
  );
  if (match) {
    const val = (match[1] || match[2] || match[3] || "").trim();
    if (val) return val;
  }

  // 2. Look for comment like // VOICEOVER: ... or // NARRATION: ...
  const commentMatch = sourceCode.match(
    /\/\/\s*(?:VOICEOVER|SCRIPT|NARRATION|VOICEOVER_SCRIPT):\s*(.+)/i,
  );
  if (commentMatch && commentMatch[1]) {
    return commentMatch[1].trim();
  }

  return "";
}

// Helper to inject Audio and kinetic Whisper Captions into Remotion code
export function injectAudioAndCaptionsIntoCode(
  sourceCode: string,
  audioUrl: string,
  words?: CaptionWord[],
): string {
  let updated = sourceCode;

  // 1. Ensure Audio is imported from remotion
  if (!/import\s*\{[^}]*\bAudio\b[^}]*\}\s*from\s*["']remotion["']/.test(updated)) {
    updated = updated.replace(
      /import\s*\{([^}]+)\}\s*from\s*["']remotion["']/,
      (match, p1) => `import { ${p1.trim()}, Audio } from "remotion"`,
    );
  }

  const hasWords = words && words.length > 0;

  // 2. Clean existing CAPTIONS constant if present
  updated = updated.replace(/\/\/\s*Auto-Captions from OpenAI Whisper[\s\S]*?const\s+CAPTIONS\s*=\s*\[[\s\S]*?\];\n*/g, "");
  updated = updated.replace(/const\s+CAPTIONS\s*=\s*\[[\s\S]*?\];\n*/g, "");

  // 3. Inject `const CAPTIONS = [...]` before component declaration
  if (hasWords) {
    const minifiedWords = JSON.stringify(
      words.map((w) => ({
        word: w.word,
        start: Number(w.start.toFixed(2)),
        end: Number(w.end.toFixed(2)),
      })),
    );
    const captionsDeclaration = `// Auto-Captions from OpenAI Whisper\nconst CAPTIONS = ${minifiedWords};\n\n`;

    if (updated.includes("export const MyAnimation")) {
      updated = updated.replace("export const MyAnimation", `${captionsDeclaration}export const MyAnimation`);
    } else if (updated.includes("const MyAnimation")) {
      updated = updated.replace("const MyAnimation", `${captionsDeclaration}const MyAnimation`);
    } else if (updated.includes("export const DynamicAnimation")) {
      updated = updated.replace("export const DynamicAnimation", `${captionsDeclaration}export const DynamicAnimation`);
    } else if (updated.includes("const DynamicAnimation")) {
      updated = updated.replace("const DynamicAnimation", `${captionsDeclaration}const DynamicAnimation`);
    } else {
      updated = captionsDeclaration + updated;
    }
  }

  // 4. Update or insert <Audio src="..." />
  if (/<Audio\s+[^>]*\/>/.test(updated)) {
    updated = updated.replace(
      /<Audio\s+[^>]*\/>/,
      `<Audio src="${audioUrl}" />`,
    );
  } else {
    const absFillRegex = /(<AbsoluteFill\b[^>]*>)/;
    if (absFillRegex.test(updated)) {
      updated = updated.replace(
        absFillRegex,
        `$1\n      {/* OpenAI Voiceover Audio */}\n      <Audio src="${audioUrl}" />`,
      );
    }
  }

  // 5. Clean previous <AnimatedCaptions ... /> if present
  updated = updated.replace(/\s*\{\/\*\s*Real-time Whisper Kinetic Captions\s*\*\/\}[\s\S]*?<AnimatedCaptions\s+[^>]*\/>/g, "");
  updated = updated.replace(/\s*<AnimatedCaptions\s+[^>]*\/>/g, "");

  // 6. Insert <AnimatedCaptions words={CAPTIONS} /> inside the root container before closing </AbsoluteFill>
  if (hasWords) {
    const closingAbsFill = /(<\/AbsoluteFill>)/;
    if (closingAbsFill.test(updated)) {
      updated = updated.replace(
        closingAbsFill,
        `\n      {/* Real-time Whisper Kinetic Captions */}\n      <AnimatedCaptions words={CAPTIONS} highlightColor="#f59e0b" />\n    $1`,
      );
    }
  }

  return updated;
}

export function VoiceoverModal({
  code,
  onCodeChange,
  durationInFrames,
  fps,
  onDurationChange,
  initialVoice = "onyx",
  initialAutoCaption = true,
}: VoiceoverModalProps) {
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(initialVoice);
  const [speed, setSpeed] = useState(1.0);
  const [withCaptions, setWithCaptions] = useState(initialAutoCaption);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [words, setWords] = useState<CaptionWord[]>([]);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync script when modal opens or code changes
  useEffect(() => {
    if (open) {
      const extracted = extractScriptFromCode(code);
      if (extracted) {
        setScript(extracted);
      }
      setApplied(false);
    }
  }, [open, code]);

  const handleGenerateVoiceover = async () => {
    if (!script.trim()) {
      setError("Please enter a narration script before generating voiceover.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    setApplied(false);
    setWords([]);

    try {
      const res = await fetch("/api/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: script.trim(),
          voice: selectedVoice,
          speed: speed,
          withCaptions: withCaptions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate voiceover audio.");
      }

      setGeneratedAudioUrl(data.audioUrl);
      if (data.words && Array.isArray(data.words)) {
        setWords(data.words);
      }

      if (data.duration) {
        setAudioDuration(data.duration);
      } else {
        const tempAudio = new window.Audio(data.audioUrl);
        tempAudio.addEventListener("loadedmetadata", () => {
          setAudioDuration(tempAudio.duration);
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred while generating voiceover.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyToVideo = () => {
    if (!generatedAudioUrl || !onCodeChange) return;

    const newCode = injectAudioAndCaptionsIntoCode(
      code,
      generatedAudioUrl,
      withCaptions ? words : [],
    );
    onCodeChange(newCode);
    setApplied(true);

    // If audio is longer than current video duration, automatically extend
    if (audioDuration && onDurationChange) {
      const neededFrames = Math.ceil(audioDuration * fps);
      if (neededFrames > durationInFrames) {
        onDurationChange(neededFrames);
      }
    }
  };

  const handleSyncFromCode = () => {
    const extracted = extractScriptFromCode(code);
    if (extracted) {
      setScript(extracted);
      setError(null);
    } else {
      setError("No VOICEOVER_SCRIPT declaration found in current animation code.");
    }
  };

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round((wordCount / 2.3) / speed);
  const currentVideoSeconds = (durationInFrames / fps).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="relative bg-background border-border hover:bg-background-elevated hover:text-primary transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Mic className="w-4 h-4 text-primary" />
          <span>Voiceover & Captions</span>
          {code.includes("<Audio") && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto bg-background-elevated border-border text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-lg">
            <Mic className="w-5 h-5" />
            <DialogTitle>OpenAI Voiceover & Auto-Captions (Whisper)</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            Generate professional voiceover narration and kinetic word-level subtitles synchronized with animation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-3">
          {/* Script Input */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="script-textarea" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Narration Script
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground-dim">
                  {wordCount} words (~{estimatedSeconds}s)
                </span>
                <button
                  type="button"
                  onClick={handleSyncFromCode}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Sync from Code
                </button>
              </div>
            </div>
            <textarea
              id="script-textarea"
              rows={4}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Enter the voiceover narration script to be spoken by OpenAI TTS..."
              className="w-full p-3 rounded-lg border border-border bg-input text-foreground text-sm font-sans focus:outline-none focus:border-primary resize-y leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground-dim">
              Every word is automatically transcribed with millisecond precision timestamps by OpenAI Whisper-1.
            </p>
          </div>

          {/* Voice Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              OpenAI Voice (TTS-1)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVoice(v.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border hover:border-border-hover bg-background/50"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {v.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded ${isSelected
                            ? "bg-primary text-black font-semibold"
                            : "bg-background-elevated text-muted-foreground"
                          }`}
                      >
                        {v.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                      {v.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed & Video Duration Sync Info */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-background/60 border border-border">
            <div>
              <label htmlFor="voice-speed-select" className="text-xs font-medium text-muted-foreground block mb-1">
                Speech Speed
              </label>
              <select
                id="voice-speed-select"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded border border-border bg-input text-foreground text-xs focus:outline-none focus:border-primary"
              >
                <option value={0.85}>0.85x (Deliberate & Solemn)</option>
                <option value={1.0}>1.0x (Standard / Normal)</option>
                <option value={1.1}>1.1x (Brisk & Dynamic)</option>
                <option value={1.2}>1.2x (Fast Pace)</option>
              </select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-1">
                Current Video Duration
              </span>
              <div className="flex items-center gap-1.5 text-xs text-foreground mt-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>
                  {currentVideoSeconds}s ({durationInFrames} frames)
                </span>
              </div>
            </div>
          </div>

          {/* Toggle Whisper Auto-Caption */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2.5">
              <Subtitles className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Enable Kinetic Auto-Captions (Whisper Word Timestamps)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Displays Bang Motion style animated subtitles highlighting each word as it is spoken.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              id="whisper-toggle"
              checked={withCaptions}
              onChange={(e) => setWithCaptions(e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs">
              {error}
            </div>
          )}

          {/* Generated Audio & Caption Preview */}
          {generatedAudioUrl && (
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Audio Preview ({selectedVoice.toUpperCase()})
                  </span>
                </div>
                {audioDuration && (
                  <span className="text-xs text-muted-foreground">
                    Duration: {audioDuration.toFixed(1)}s
                  </span>
                )}
              </div>

              <audio
                ref={audioRef}
                src={generatedAudioUrl}
                controls
                className="w-full h-8"
              />

              {/* Whisper Words Chip Preview */}
              {words.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> {words.length} Words Synchronized (Whisper)
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Range: {words[0]?.start.toFixed(1)}s - {words[words.length - 1]?.end.toFixed(1)}s
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 rounded bg-background/50 border border-border/40">
                    {words.slice(0, 18).map((w, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-background-elevated text-foreground border border-border/50"
                      >
                        <span className="text-muted-foreground-dim mr-1">{w.start.toFixed(1)}s</span>
                        <strong className="text-amber-400">{w.word}</strong>
                      </span>
                    ))}
                    {words.length > 18 && (
                      <span className="text-[10px] text-muted-foreground px-1 self-center">
                        +{words.length - 18} more words
                      </span>
                    )}
                  </div>
                </div>
              )}

              {audioDuration && Math.ceil(audioDuration * fps) > durationInFrames && (
                <div className="text-[11px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                  ⚠️ Audio duration ({audioDuration.toFixed(1)}s) is longer than video duration ({currentVideoSeconds}s).
                  Clicking &quot;Apply to Video&quot; will automatically adjust video length to {Math.ceil(audioDuration * fps)} frames.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="sm:w-auto w-full cursor-pointer"
          >
            Close
          </Button>

          <Button
            type="button"
            onClick={handleGenerateVoiceover}
            disabled={isGenerating || !script.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground sm:w-auto w-full cursor-pointer"
          >
            {isGenerating ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                Generating Speech & Whisper...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Voice & Captions
              </>
            )}
          </Button>

          {generatedAudioUrl && (
            <Button
              type="button"
              onClick={handleApplyToVideo}
              disabled={applied}
              className={`sm:w-auto w-full transition-all cursor-pointer ${applied
                  ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
                }`}
            >
              {applied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Applied to Video!
                </>
              ) : (
                <>
                  <Music className="w-4 h-4 mr-2" />
                  Apply to Video
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
