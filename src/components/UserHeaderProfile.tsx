"use client";

import { useState, useEffect, useRef } from "react";
import { User, LogOut, Crown, History } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ProjectHistoryModal } from "./ProjectHistoryModal";

export function UserHeaderProfile() {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  if (!user) return null;

  const formattedCredits =
    typeof user.quota === "number"
      ? Number.isInteger(user.quota)
        ? user.quota.toLocaleString()
        : user.quota.toLocaleString(undefined, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : "0";

  return (
    <>
      <div
        className="flex items-center gap-2 sm:gap-2.5 shrink-0 relative"
        ref={dropdownRef}
      >
        {/* Header Left: Project History Icon Button */}
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1F1F23] hover:bg-[#26262B] text-[#9A9AA2] hover:text-white transition-all duration-150 border border-[#28282C] cursor-pointer shadow-sm focus:outline-none"
          title="Project History"
          aria-label="Project History"
        >
          <History className="w-4 h-4" />
        </button>

        {/* Credits Pill Button */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1F1F23] hover:bg-[#26262B] text-[12px] sm:text-[13px] font-medium text-[#F5F5F7] transition-all duration-150 border border-[#28282C] select-none shadow-sm"
          title={`Remaining Credits: ${user.quota} Credits`}
        >
          {/* Swdbot Diamond Star Icon */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-[#0084FF] shrink-0"
          >
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
          <span className="font-semibold text-white tracking-tight">
            {formattedCredits}
          </span>
          <span className="text-[10px] sm:text-[11px] text-[#8E8E93] font-normal ml-0.5">
            Credits
          </span>
        </div>

        {/* Profile Avatar Button Trigger */}
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="relative p-0.5 rounded-full hover:ring-2 hover:ring-white/20 transition-all cursor-pointer focus:outline-none shrink-0"
          title={user.name || "Profile"}
          aria-label="User profile menu"
          aria-expanded={dropdownOpen}
        >
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name || "Profile"}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-[#28282C] shrink-0 shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0">
              <User size={15} className="text-white" />
            </div>
          )}

          {/* Small VIP Indicator Dot */}
          {user.vip && (
            <span
              className="absolute bottom-0 right-0 w-3 h-3 bg-amber-400 border-2 border-[#0A0A0C] rounded-full"
              title="VIP Member"
            />
          )}
        </button>

        {/* Profile Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 z-[9999] bg-[#18181B] border border-[#28282C] rounded-2xl shadow-2xl p-2 animate-fade-in backdrop-blur-xl">
            {/* User Profile Header */}
            <div className="px-3 py-2.5 bg-[#1F1F23]/80 rounded-xl border border-[#28282C]/60 mb-1.5 flex items-center gap-3">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#0084FF] flex items-center justify-center text-white shrink-0">
                  <User size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-bold text-[#F5F5F7] truncate">
                    {user.name || "VIP User"}
                  </p>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    <Crown className="w-2.5 h-2.5" />
                    VIP
                  </span>
                </div>
                {user.email && (
                  <p className="text-[11px] text-[#8E8E93] truncate">
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            {/* Credits Summary Bar */}
            <div className="px-3 py-1.5 mb-1.5 flex items-center justify-between text-[11px] text-neutral-400 bg-neutral-900/60 rounded-lg border border-white/5">
              <span>Remaining Balance:</span>
              <span className="font-bold text-white font-mono">
                {formattedCredits} Credits
              </span>
            </div>

            {/* Project History Option - Exactly Above Logout as requested */}
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                setIsHistoryOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-neutral-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer mb-1"
            >
              <History size={15} className="text-[#0084FF] shrink-0" />
              <span>Project History</span>
            </button>

            {/* Action: LOGOUT */}
            <button
              type="button"
              onClick={async () => {
                setDropdownOpen(false);
                await logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut size={15} className="text-rose-400 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Project History Modal Dialog */}
      <ProjectHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
    </>
  );
}
