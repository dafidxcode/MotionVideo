"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  History,
  X,
  Play,
  Download,
  Trash2,
  Clock,
  Loader2,
  RefreshCw,
  Film,
  CheckCircle2,
} from "lucide-react";
import type { MotionProject } from "@/lib/projects";

interface ProjectHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectHistoryModal({
  isOpen,
  onClose,
}: ProjectHistoryModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [projects, setProjects] = useState<MotionProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects)) {
          setProjects(data.projects);
        }
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen, fetchProjects]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project from history?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenProject = (id: string) => {
    onClose();
    router.push(`/generate?projectId=${encodeURIComponent(id)}`);
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Only render once mounted in browser and when open
  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] bg-[#121214] border border-[#28282C] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#28282C] flex items-center justify-between bg-[#18181B] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0084FF]/15 border border-[#0084FF]/30 flex items-center justify-center text-[#0084FF] shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="history-modal-title"
                  className="text-base sm:text-lg font-bold text-white tracking-tight"
                >
                  History
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchProjects}
              disabled={isLoading}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh history"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-neutral-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#0084FF]" />
              <p className="text-xs">Loading...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#1E1E24] border border-[#28282C] flex items-center justify-center text-neutral-400 mb-3 shadow-inner">
                <Film className="w-7 h-7 text-neutral-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                No project history yet
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
                Every animation and motion graphic you create in Swdbot Motion Studio is automatically saved here so you can resume editing anytime.
              </p>
            </div>
          ) : (
            projects.map((project) => {
              const seconds = (project.durationInFrames / (project.fps || 30)).toFixed(1);
              const hasRender = Boolean(project.renderUrl);
              const isRendering = project.renderStatus === "rendering";

              return (
                <div
                  key={project.id}
                  onClick={() => handleOpenProject(project.id)}
                  className="group relative bg-[#18181C] hover:bg-[#1E1E24] border border-[#28282C] hover:border-[#3E3E48] rounded-xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
                    {/* Title & Badge */}
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="text-sm font-bold text-white group-hover:text-[#38a3ff] transition-colors truncate">
                        {project.title || "Untitled Motion Project"}
                      </h4>
                      {hasRender && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Rendered MP4
                        </span>
                      )}
                      {isRendering && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Rendering
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 shrink-0">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span>{formatDate(project.updatedAt || project.createdAt)}</span>
                    </div>
                  </div>

                  {/* Prompt preview */}
                  <p className="text-xs text-neutral-300 line-clamp-2 mb-3 font-normal leading-relaxed">
                    {project.prompt}
                  </p>

                  {/* Footer Meta & Actions */}
                  <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-white/5">
                    {/* Specs */}
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5">
                        {seconds}s ({project.durationInFrames} frames)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/5">
                        {project.fps || 30} FPS
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Download MP4 button if rendered */}
                      {project.renderUrl && (
                        <a
                          href={project.renderUrl}
                          download={`motion-${project.id}.mp4`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors"
                          title="Download rendered MP4 video"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download MP4</span>
                        </a>
                      )}

                      {/* Resume / Open Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenProject(project.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084FF] hover:bg-[#0070D8] text-white transition-colors cursor-pointer shadow-sm shadow-[#0084FF]/20"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(project.id, e)}
                        disabled={deletingId === project.id}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete project"
                      >
                        {deletingId === project.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
