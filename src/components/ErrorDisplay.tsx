"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, X } from "lucide-react";
import React from "react";

export type ErrorVariant = "inline" | "card" | "fullscreen";
export type ErrorSize = "sm" | "md" | "lg";

interface ErrorDisplayProps {
  error: string;
  title?: string;
  variant?: ErrorVariant;
  size?: ErrorSize;
  onDismiss?: () => void;
  children?: React.ReactNode;
  className?: string;
}

const sizeStyles: Record<
  ErrorSize,
  { icon: string; title: string; description: string }
> = {
  sm: { icon: "h-3 w-3", title: "text-xs", description: "text-xs" },
  md: {
    icon: "h-4 w-4",
    title: "text-sm font-semibold",
    description: "text-sm",
  },
  lg: {
    icon: "h-5 w-5",
    title: "text-base font-semibold",
    description: "text-base",
  },
};

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  title,
  variant = "card",
  size = "md",
  onDismiss,
  children,
  className,
}) => {
  const [showFullError, setShowFullError] = React.useState(false);
  const styles = sizeStyles[size];

  // BUG-54: Truncate long raw LLM error messages to prevent layout breaking or prompt leaking
  const isLongError = error && error.length > 350;
  const displayError = isLongError && !showFullError ? `${error.slice(0, 350)}...` : error;

  if (variant === "fullscreen") {
    return (
      <div className="w-full h-full min-h-[220px] max-h-full flex flex-col justify-center items-center bg-background-elevated rounded-lg overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)] p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 max-w-[90%] w-full overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 shrink-0">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          {title && (
            <h3 className="text-base sm:text-lg font-semibold text-foreground text-center">{title}</h3>
          )}
          <div className="bg-background-error/50 border border-destructive/30 rounded-lg p-3 sm:p-4 max-w-full w-full max-h-[50vh] overflow-y-auto">
            <pre className="text-xs sm:text-sm text-destructive font-mono whitespace-pre-wrap break-words text-left">
              {displayError}
            </pre>
            {isLongError && (
              <button
                type="button"
                onClick={() => setShowFullError(!showFullError)}
                className="mt-2 text-xs font-sans text-destructive/80 hover:text-destructive underline cursor-pointer block"
              >
                {showFullError ? "Hide full details" : `Show full error details (${error.length} characters)`}
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <Alert
        variant="destructive"
        className={cn("flex items-center justify-between", className)}
      >
        <AlertDescription className={styles.description}>
          {displayError}
          {isLongError && (
            <button
              type="button"
              onClick={() => setShowFullError(!showFullError)}
              className="ml-2 text-xs underline cursor-pointer opacity-80 hover:opacity-100"
            >
              {showFullError ? "less" : "more"}
            </button>
          )}
        </AlertDescription>
        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            className={cn(
              "text-destructive hover:text-destructive hover:bg-destructive/20",
              size === "sm" ? "h-5 w-5" : "h-6 w-6",
            )}
          >
            <X className={styles.icon} />
          </Button>
        )}
      </Alert>
    );
  }

  // card variant (default)
  return (
    <Alert variant="destructive" className={cn("my-2", className)}>
      <AlertCircle className={styles.icon} />
      {title && <AlertTitle className={styles.title}>{title}</AlertTitle>}
      <AlertDescription
        className={cn(
          styles.description,
          "font-mono whitespace-pre-wrap break-words",
        )}
      >
        {displayError}
        {isLongError && (
          <div>
            <button
              type="button"
              onClick={() => setShowFullError(!showFullError)}
              className="mt-1 text-xs font-sans underline cursor-pointer opacity-80 hover:opacity-100 block"
            >
              {showFullError ? "Show less" : `Show full error details (${error.length} characters)`}
            </button>
          </div>
        )}
      </AlertDescription>
      {children}
    </Alert>
  );
};

// ErrorType is still used by AnimationPlayer for its interface
export type ErrorType = "compilation" | "api" | "validation";
