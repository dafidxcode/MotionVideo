"use client";

import { Check, Copy } from "lucide-react";
import React, { useState } from "react";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, className }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy to clipboard:", err);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={
        className ??
        "flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
      }
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : copyFailed ? (
        <span className="text-rose-400">Copy failed</span>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
};
