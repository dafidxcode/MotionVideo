"use client";

import { useAuth } from "@/lib/auth-context";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  Cpu,
  ExternalLink,
  Film,
  KeyRound,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ALLOWED_ADMIN_EMAILS = [
  "pembekalbaranganthailand@gmail.com",
  "bgdiecky@gmail.com",
];

interface AdminStats {
  totalUsers: number;
  totalVipUsers: number;
  totalCreditsCharged: number;
  totalGenerations: number;
  totalChatMessages: number;
  totalRenders: number;
  developerFeeCollectedRM: number;
}

interface AdminSettings {
  initialGenerationCost: number;
  chatbotCost: number;
  renderCost: number;
  developerFeePercent: number;
  updatedAt?: string;
  updatedBy?: string;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  action: "initial_generation" | "chatbot_llm" | "aws_render";
  credits: number;
  remainingQuota: number;
  description: string;
  status: "success" | "insufficient_quota" | "error";
  metadata?: Record<string, any>;
}

interface UserProfileItem {
  id?: string;
  legacy_key?: string;
  email: string;
  name: string;
  avatar_url?: string;
  quota: number;
  vip: boolean;
  vip_expires_at?: string | null;
  is_blocked?: boolean;
  role?: string;
  created_at?: string;
}

export default function AdminPage() {
  const { user, isLoading: authLoading, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "overview" | "activities" | "settings" | "users" | "renders" | "shiteru"
  >("overview");

  // Shiteru Quota State
  const [shiteruLoading, setShiteruLoading] = useState(false);
  const [shiteruData, setShiteruData] = useState<any>(null);
  const [shiteruError, setShiteruError] = useState<string | null>(null);

  const checkShiteruQuota = async () => {
    setShiteruLoading(true);
    setShiteruError(null);
    try {
      const res = await fetch("/api/admin/shiteru-quota");
      const json = await res.json();
      if (!res.ok || json.error) {
        setShiteruError(json.error || "Failed to fetch Shiteru quota");
      } else {
        setShiteruData(json);
      }
    } catch (err: any) {
      setShiteruError(err.message || "Network error");
    } finally {
      setShiteruLoading(false);
    }
  };

  // Admin Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [settings, setSettings] = useState<AdminSettings>({
    initialGenerationCost: 6,
    chatbotCost: 3,
    renderCost: 30,
    developerFeePercent: 50,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [users, setUsers] = useState<UserProfileItem[]>([]);

  // Loading & Action States
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null,
  );
  const autoRefresh = true;

  // Filters & Searches
  const [activitySearch, setActivitySearch] = useState("");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [userSearch, setUserSearch] = useState("");

  // Edit Settings Form State
  const [formInitialGenCost, setFormInitialGenCost] = useState("6");
  const [formChatbotCost, setFormChatbotCost] = useState("3");
  const [formRenderCost, setFormRenderCost] = useState("30");
  const [formDevFeePercent, setFormDevFeePercent] = useState("50");
  const isFormDirtyRef = useRef(false);

  // Modal dialog states to eliminate window.prompt and window.confirm (BUG-35)
  const [quotaModalUser, setQuotaModalUser] = useState<UserProfileItem | null>(null);
  const [quotaInputValue, setQuotaInputValue] = useState("");
  const [quotaMode, setQuotaMode] = useState<"add" | "set">("set");
  const [blockModalUser, setBlockModalUser] = useState<UserProfileItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // BUG-43: Rely on user.isAdmin / role from authenticated session cookie, not client email list
  const isAdmin = Boolean(user && (user.isAdmin || user.role === "admin"));

  // Fetch all admin data
  const fetchData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [statsRes, actRes, usersRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/activities?limit=150"),
        fetch("/api/admin/users"),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.stats) setStats(data.stats);
        if (data.settings) {
          setSettings(data.settings);
          // BUG-40: Do not overwrite pricing inputs while admin is actively editing
          if (!isFormDirtyRef.current) {
            setFormInitialGenCost(String(data.settings.initialGenerationCost ?? 6));
            setFormChatbotCost(String(data.settings.chatbotCost ?? 3));
            setFormRenderCost(String(data.settings.renderCost ?? 30));
            setFormDevFeePercent(
              String(data.settings.developerFeePercent ?? 50),
            );
          }
        }
      }

      if (actRes.ok) {
        const actData = await actRes.json();
        if (Array.isArray(actData.activities)) {
          setActivities(actData.activities);
        }
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (Array.isArray(usersData.users)) {
          setUsers(usersData.users);
        }
      }
    } catch (err) {
      console.error("[Admin] Failed to load data:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchData();
    }
  }, [authLoading, isAdmin, fetchData]);

  // Periodic Auto-refresh (BUG-40: 30s interval instead of 6s to avoid UI disturbance)
  useEffect(() => {
    if (!autoRefresh || !isAdmin) return;
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, isAdmin, fetchData]);

  // Save Settings Handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSaveSuccessMessage(null);

    try {
      const payload = {
        initialGenerationCost: Math.max(0, parseFloat(formInitialGenCost) || 0),
        chatbotCost: Math.max(0, parseFloat(formChatbotCost) || 0),
        renderCost: Math.max(0, parseFloat(formRenderCost) || 0),
        developerFeePercent: Math.max(
          0,
          Math.min(100, parseFloat(formDevFeePercent) || 0),
        ),
      };

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        isFormDirtyRef.current = false;
        const data = await res.json();
        setSettings(data.settings);
        setSaveSuccessMessage(
          "Credit pricing settings updated successfully across Motion Studio!",
        );
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        fetchData();
      } else {
        setActionError("Failed to save settings. Please try again.");
      }
    } catch (err) {
      console.error("[Admin Settings Error]", err);
      setActionError("Network error while saving settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Adjust User Quota Handler
  const handleAdjustQuota = async (
    email: string,
    amount: number,
    mode: "add" | "set",
  ) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_quota",
          email,
          amount,
          mode,
        }),
      });

      if (res.ok) {
        setQuotaModalUser(null);
        fetchData();
      } else {
        const err = await res.json();
        setActionError(err.error || "Failed to update quota");
      }
    } catch {
      setActionError("Network error while adjusting quota");
    }
  };

  // Toggle User Block Handler
  const handleToggleBlock = async (email: string, currentBlocked?: boolean) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_block",
          email,
          blocked: !currentBlocked,
        }),
      });

      if (res.ok) {
        setBlockModalUser(null);
        fetchData();
      } else {
        const err = await res.json();
        setActionError(err.error || "Failed to update block status");
      }
    } catch {
      setActionError("Network error while toggling block");
    }
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0B] flex items-center justify-center text-[#F5F5F7] font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#A1A1AA]" />
          <p className="text-xs text-[#8E8E93]">Verifying administrator credentials…</p>
        </div>
      </div>
    );
  }

  // Access Denied Screen (Strictly only authorized Gmails)
  if (!user || !isAdmin) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0B] flex items-center justify-center p-4 font-sans text-[#F5F5F7]">
        <div className="max-w-md w-full bg-[#141416] border border-[#28282C] rounded-2xl p-6 shadow-xl text-center">
          <div className="w-12 h-12 rounded-xl bg-[#1C1C20] border border-[#28282C] text-rose-400 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">Access Denied</h1>
          <p className="text-xs text-[#8E8E93] leading-relaxed mb-4">
            The Swdbot Motion Studio Admin Panel is strictly restricted to authorized administrators:
          </p>
          <div className="bg-[#18181B] rounded-xl p-3 border border-[#28282C] mb-5 text-left">
            <span className="text-[10px] uppercase font-mono text-[#71717A] font-semibold block mb-1">
              Authorized Accounts:
            </span>
            <div className="space-y-1">
              {ALLOWED_ADMIN_EMAILS.map((em) => (
                <div key={em} className="text-xs font-mono text-[#D4D4D8] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {em}
                </div>
              ))}
            </div>
            {user?.email && (
              <div className="mt-2 pt-2 border-t border-[#28282C] text-[11px] text-[#8E8E93]">
                Your signed-in email: <span className="text-white font-mono">{user.email}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => logout()}
              className="flex-1 px-4 py-2 rounded-xl bg-[#1F1F23] hover:bg-[#26262B] text-xs font-semibold text-white border border-[#28282C] transition-colors"
            >
              Sign in with another account
            </button>
            <Link
              href="/"
              className="flex-1 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-xs font-semibold text-black transition-colors"
            >
              Go to Studio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    const matchesFilter =
      activityFilter === "all" || act.action === activityFilter;
    const matchesSearch =
      !activitySearch.trim() ||
      act.userEmail.toLowerCase().includes(activitySearch.toLowerCase()) ||
      act.userName.toLowerCase().includes(activitySearch.toLowerCase()) ||
      act.description.toLowerCase().includes(activitySearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Filter users - STRICTLY ACTIVE VIP MEMBERS ONLY
  const filteredUsers = users.filter((u) => {
    if (!u.vip) return false;
    if (u.vip_expires_at) {
      const exp = new Date(u.vip_expires_at).getTime();
      if (!isNaN(exp) && exp <= Date.now()) return false;
    }
    if (!userSearch.trim()) return true;
    const term = userSearch.toLowerCase();
    return (
      u.email.toLowerCase().includes(term) ||
      (u.name && u.name.toLowerCase().includes(term))
    );
  });

  // Filter renders
  const renderActivities = activities.filter(
    (act) => act.action === "aws_render",
  );

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#0A0A0B] text-[#F5F5F7] font-sans flex flex-col">
      {/* ── Top Header (Unified with Frontend) ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0A0A0B]/80 backdrop-blur-md border-b border-[#28282C] px-4 sm:px-8 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/swdbot-logo.png"
            alt="Swdbot"
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0"
          />
          <div className="flex items-center gap-2.5">
            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
              Swdbot Motion Studio
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#1C1C20] border border-[#28282C] text-[#A1A1AA] text-[10px] font-mono tracking-wider uppercase font-semibold">
              Admin Panel
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 ml-auto">
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={isLoadingData}
            className="w-8 h-8 rounded-full bg-[#1F1F23] hover:bg-[#26262B] text-[#9A9AA2] hover:text-white border border-[#28282C] flex items-center justify-center transition-colors cursor-pointer"
            title="Refresh now"
            aria-label="Refresh now"
          >
            <RefreshCw
              size={14}
              className={isLoadingData ? "animate-spin text-white" : ""}
            />
          </button>

          {/* Admin Email Pill */}
          <div className="hidden md:flex items-center px-3 py-1.5 rounded-full bg-[#1F1F23] border border-[#28282C]">
            <span className="text-xs font-medium text-[#D4D4D8] font-mono">
              {user.email}
            </span>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-all shadow-sm"
          >
            <span>Studio</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* ── Main Dashboard Content ──────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 pb-40 space-y-7">
        {/* Metric Cards Row - Minimalist, Professional, Unified Dark Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total VIP Users */}
          <div className="relative rounded-2xl p-5 bg-[#141416] border border-[#28282C] hover:border-[#38383E] transition-all shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider font-mono">
                VIP Members
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#1C1C20] border border-[#28282C] flex items-center justify-center text-[#A1A1AA]">
                <ShieldCheck size={16} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white font-mono tracking-tight">
                {stats?.totalVipUsers ?? filteredUsers.length}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#8E8E93]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Active VIP / {stats?.totalUsers ?? users.length} Total Users</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Credits Deducted */}
          <div className="relative rounded-2xl p-5 bg-[#141416] border border-[#28282C] hover:border-[#38383E] transition-all shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider font-mono">
                Credits Deducted
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#1C1C20] border border-[#28282C] flex items-center justify-center text-[#A1A1AA]">
                <Coins size={16} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white font-mono tracking-tight">
                {stats?.totalCreditsCharged ?? 0}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#8E8E93]">
                <span>Total system consumption</span>
              </div>
            </div>
          </div>

          {/* Card 3: Service Developer Royalty */}
          <div className="relative rounded-2xl p-5 bg-[#141416] border border-[#28282C] hover:border-[#38383E] transition-all shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider font-mono">
                Dev Royalty ({settings.developerFeePercent}%)
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#1C1C20] border border-[#28282C] flex items-center justify-center text-[#A1A1AA]">
                <CircleDollarSign size={16} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white font-mono tracking-tight">
                RM {(stats?.developerFeeCollectedRM ?? 0).toFixed(2)}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#8E8E93]">
                <span>Logged to Redemptions</span>
              </div>
            </div>
          </div>

          {/* Card 4: Total Renders & Generations */}
          <div className="relative rounded-2xl p-5 bg-[#141416] border border-[#28282C] hover:border-[#38383E] transition-all shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider font-mono">
                Jobs Completed
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#1C1C20] border border-[#28282C] flex items-center justify-center text-[#A1A1AA]">
                <Layers size={16} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white font-mono tracking-tight">
                {(stats?.totalGenerations ?? 0) + (stats?.totalRenders ?? 0)}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#8E8E93]">
                <span>{stats?.totalGenerations ?? 0} Steps • {stats?.totalRenders ?? 0} Renders</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher Navigation - Sleek Dark Pill Bar matching Frontend */}
        <div className="flex items-center gap-1.5 p-1 bg-[#141416] rounded-2xl border border-[#28282C] overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${activeTab === "overview" || activeTab === "activities"
              ? "bg-[#222226] text-white border border-[#3A3A42] font-semibold shadow-sm"
              : "text-[#8E8E93] hover:text-white hover:bg-[#1A1A1E] border border-transparent font-medium"
              }`}
          >
            <Activity size={14} />
            <span>Live Activities</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "overview" || activeTab === "activities"
                ? "bg-[#18181B] text-[#D4D4D8] border border-[#33333A]"
                : "bg-[#1A1A1E] text-[#8E8E93] border border-[#28282C]"
                }`}
            >
              {activities.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${activeTab === "settings"
              ? "bg-[#222226] text-white border border-[#3A3A42] font-semibold shadow-sm"
              : "text-[#8E8E93] hover:text-white hover:bg-[#1A1A1E] border border-transparent font-medium"
              }`}
          >
            <Sliders size={14} />
            <span>Credit Rates & Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${activeTab === "users"
              ? "bg-[#222226] text-white border border-[#3A3A42] font-semibold shadow-sm"
              : "text-[#8E8E93] hover:text-white hover:bg-[#1A1A1E] border border-transparent font-medium"
              }`}
          >
            <Users size={14} />
            <span>VIP Users</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "users"
                ? "bg-[#18181B] text-[#D4D4D8] border border-[#33333A]"
                : "bg-[#1A1A1E] text-[#8E8E93] border border-[#28282C]"
                }`}
            >
              {filteredUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("renders")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${activeTab === "renders"
              ? "bg-[#222226] text-white border border-[#3A3A42] font-semibold shadow-sm"
              : "text-[#8E8E93] hover:text-white hover:bg-[#1A1A1E] border border-transparent font-medium"
              }`}
          >
            <Film size={14} />
            <span>AWS Renders</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "renders"
                ? "bg-[#18181B] text-[#D4D4D8] border border-[#33333A]"
                : "bg-[#1A1A1E] text-[#8E8E93] border border-[#28282C]"
                }`}
            >
              {renderActivities.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("shiteru");
              if (!shiteruData && !shiteruLoading) {
                checkShiteruQuota();
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap ${activeTab === "shiteru"
              ? "bg-[#222226] text-white border border-[#3A3A42] font-semibold shadow-sm"
              : "text-[#8E8E93] hover:text-white hover:bg-[#1A1A1E] border border-transparent font-medium"
              }`}
          >
            <Cpu size={14} />
            <span>Anthropic AI & Models</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </button>
        </div>

        {/* ── TAB 1: LIVE ACTIVITY MONITOR ────────────────────────────────────── */}
        {(activeTab === "overview" || activeTab === "activities") && (
          <div className="bg-[#141416] border border-[#28282C] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#28282C]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity size={16} className="text-[#A1A1AA]" />
                  Live Activity Stream
                </h3>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-60">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"
                  />
                  <input
                    type="text"
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    placeholder="Search by user email or prompt…"
                    className="w-full bg-[#0E0E11] border border-[#28282C] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-[#4A4A52] transition-colors"
                  />
                </div>

                {/* Filter */}
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="bg-[#0E0E11] border border-[#28282C] rounded-xl px-2.5 py-1.5 text-xs text-[#F5F5F7] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Actions</option>
                  <option value="initial_generation">Step 1 Generation</option>
                  <option value="chatbot_llm">Chatbot LLM Chat</option>
                  <option value="aws_render">AWS Video Render</option>
                </select>
              </div>
            </div>

            {/* Activities Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#28282C] text-[#8E8E93] uppercase tracking-wider font-mono text-[10px]">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Action Type</th>
                    <th className="py-2.5 px-3">Credits</th>
                    <th className="py-2.5 px-3">Description / Prompt</th>
                    <th className="py-2.5 px-3">Balance After</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28282C]/60">
                  {filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#71717A]">
                        No user activity recorded yet. As users generate animations, their usage will stream here instantly.
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((act) => {
                      const date = new Date(act.timestamp);
                      const timeStr = date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });
                      const dateStr = date.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      });

                      return (
                        <tr
                          key={act.id}
                          className="hover:bg-[#1A1A1E]/60 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-[#8E8E93] whitespace-nowrap font-mono text-[11px]">
                            <span>{timeStr}</span>
                            <span className="text-[10px] text-[#71717A] block">
                              {dateStr}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {act.userAvatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={act.userAvatar}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover border border-[#28282C]"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#1C1C20] border border-[#28282C] text-[#D4D4D8] flex items-center justify-center text-[10px] font-bold">
                                  {act.userName?.[0] || "U"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-medium text-white truncate block">
                                  {act.userName || "User"}
                                </span>
                                <span className="text-[10px] text-[#8E8E93] truncate block font-mono">
                                  {act.userEmail}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {act.action === "initial_generation" && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1C1C20] border border-[#28282C] text-[#D4D4D8] font-medium text-[11px]">
                                <Sparkles size={11} className="text-[#A1A1AA]" />
                                Step 1 Gen
                              </span>
                            )}
                            {act.action === "chatbot_llm" && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1C1C20] border border-[#28282C] text-[#D4D4D8] font-medium text-[11px]">
                                <MessageSquare size={11} className="text-[#A1A1AA]" />
                                Chatbot Edit
                              </span>
                            )}
                            {act.action === "aws_render" && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1C1C20] border border-[#28282C] text-[#D4D4D8] font-medium text-[11px]">
                                <Film size={11} className="text-[#A1A1AA]" />
                                AWS Render
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap text-white">
                            <span>-{act.credits}</span>
                          </td>

                          <td className="py-2.5 px-3 max-w-xs truncate text-[#D4D4D8]" title={act.description}>
                            {act.description}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[#8E8E93] whitespace-nowrap">
                            {act.remainingQuota.toFixed(1)} Credits
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {act.status === "success" ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#D4D4D8]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Deducted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-rose-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                Insufficient
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: DYNAMIC CREDIT PRICING & LOGGING RULES ────────────────────── */}
        {activeTab === "settings" && (
          <div className="bg-[#141416] border border-[#28282C] rounded-2xl p-5 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#28282C]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders size={16} className="text-[#A1A1AA]" />
                  Dynamic Credit Pricing Settings
                </h3>
                <p className="text-xs text-[#8E8E93] mt-0.5">
                  Adjust credit consumption across all Motion Studio features. Changes apply instantly in real-time.
                </p>
              </div>

              {saveSuccessMessage && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1C20] border border-[#28282C] text-emerald-400 text-xs font-mono font-medium animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Initial Prompt Generation Cost */}
                <div className="rounded-2xl p-5 bg-[#141417] border border-[#28282C] hover:border-[#38383E] transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Sparkles size={15} className="text-[#A1A1AA]" />
                      Initial Animation Generation
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1C1C20] text-[#D4D4D8] font-medium border border-[#28282C]">
                      Step 1 Prompt
                    </span>
                  </div>

                  <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                    Base credit cost charged per 10 seconds of generated kinetic typography or motion graphics.
                  </p>

                  <div className="flex items-center gap-2.5 pt-1">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formInitialGenCost}
                        onChange={(e) => setFormInitialGenCost(e.target.value)}
                        className="w-full bg-[#0E0E11] border border-[#28282C] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#4A4A52] transition-colors"
                      />
                    </div>
                    <span className="text-xs text-[#D4D4D8] font-mono px-2.5 py-2 rounded-xl bg-[#1C1C20] border border-[#28282C] shrink-0">
                      Credits / 10s
                    </span>
                  </div>

                  {/* Live Duration Breakdown Pill Chips */}
                  <div className="pt-2 border-t border-[#28282C] space-y-1.5">
                    <span className="text-[10px] text-[#71717A] uppercase tracking-wider font-semibold block">
                      Live Duration Breakdown ({formInitialGenCost || "2"} Cr / 10s):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { sec: 10, label: "10s", mult: 1 },
                        { sec: 20, label: "20s", mult: 2 },
                        { sec: 30, label: "30s", mult: 3 },
                        { sec: 60, label: "1 min", mult: 6 },
                        { sec: 120, label: "2 min", mult: 12 },
                      ].map((item) => {
                        const baseVal = parseFloat(formInitialGenCost) || 2;
                        const total = Math.round(baseVal * item.mult * 10) / 10;
                        return (
                          <span
                            key={item.label}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0E0E11] border border-[#28282C] text-[#D4D4D8] flex items-center gap-1"
                          >
                            <span className="text-[#8E8E93]">{item.label}:</span>
                            <span className="font-bold text-white">{total} Cr</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Chatbot Assistant Message Cost */}
                <div className="rounded-2xl p-5 bg-[#141417] border border-[#28282C] hover:border-[#38383E] transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <MessageSquare size={15} className="text-[#A1A1AA]" />
                      Chatbot AI LLM Revision
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1C1C20] text-[#D4D4D8] font-medium border border-[#28282C]">
                      Per Prompt Edit
                    </span>
                  </div>

                  <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                    Credit cost for each conversational iteration or self-healing fix with AI.
                  </p>

                  <div className="flex items-center gap-2.5 pt-1">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formChatbotCost}
                        onChange={(e) => setFormChatbotCost(e.target.value)}
                        className="w-full bg-[#0E0E11] border border-[#28282C] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#4A4A52] transition-colors"
                      />
                    </div>
                    <span className="text-xs text-[#D4D4D8] font-mono px-2.5 py-2 rounded-xl bg-[#1C1C20] border border-[#28282C] shrink-0">
                      Credits / Msg
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#28282C]">
                    <span className="text-[11px] text-[#71717A]">
                      Standard follow-up rate: 1 credit per revision query.
                    </span>
                  </div>
                </div>

                {/* 3. AWS Video Render Cost */}
                <div className="rounded-2xl p-5 bg-[#141417] border border-[#28282C] hover:border-[#38383E] transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Film size={15} className="text-[#A1A1AA]" />
                      AWS Video Lambda Render
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1C1C20] text-[#D4D4D8] font-medium border border-[#28282C]">
                      Full MP4 Export
                    </span>
                  </div>

                  <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                    Cost to render Remotion animation to high-definition MP4 on AWS cloud.
                  </p>

                  <div className="flex items-center gap-2.5 pt-1">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={formRenderCost}
                        onChange={(e) => setFormRenderCost(e.target.value)}
                        className="w-full bg-[#0E0E11] border border-[#28282C] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#4A4A52] transition-colors"
                      />
                    </div>
                    <span className="text-xs text-[#D4D4D8] font-mono px-2.5 py-2 rounded-xl bg-[#1C1C20] border border-[#28282C] shrink-0">
                      Credits / Render
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#28282C]">
                    <span className="text-[11px] text-[#71717A]">
                      Includes S3 storage, parallel worker rendering, and download links.
                    </span>
                  </div>
                </div>

                {/* 4. Service Developer Fee Percent */}
                <div className="rounded-2xl p-5 bg-[#141417] border border-[#28282C] hover:border-[#38383E] transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <CircleDollarSign size={15} className="text-[#A1A1AA]" />
                      Service Developer Fee (%)
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1C1C20] text-[#D4D4D8] font-medium border border-[#28282C]">
                      Auto-Logged RM
                    </span>
                  </div>

                  <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                    Percentage of charged render credits credited to Swdbot Developer Redemptions.
                  </p>

                  <div className="flex items-center gap-2.5 pt-1">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formDevFeePercent}
                        onChange={(e) => setFormDevFeePercent(e.target.value)}
                        className="w-full bg-[#0E0E11] border border-[#28282C] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[#4A4A52] transition-colors"
                      />
                    </div>
                    <span className="text-xs text-[#D4D4D8] font-mono px-2.5 py-2 rounded-xl bg-[#1C1C20] border border-[#28282C] shrink-0">
                      % Revenue Share
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#28282C]">
                    <span className="text-[11px] text-[#71717A]">
                      Automatically syncs with public.redemptions table in real-time.
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Bar with Clean White Button */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-4 border-t border-[#28282C]">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-black" />
                      <span>Saving New Rates…</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save Pricing Settings</span>
                    </>
                  )}
                </button>
                <div className="text-[11px] text-[#71717A] font-mono">
                  Engine Timestamp:{" "}
                  <span className="text-[#A1A1AA]">
                    {settings.updatedAt
                      ? new Date(settings.updatedAt).toLocaleString()
                      : "Default Factory Settings"}
                  </span>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── TAB 3: VIP USER MANAGEMENT ──────────────────────────────────────── */}
        {activeTab === "users" && (
          <div className="bg-[#141416] border border-[#28282C] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#28282C]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users size={16} className="text-[#A1A1AA]" />
                  VIP Members ({filteredUsers.length})
                </h3>
              </div>

              <div className="relative w-full sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]"
                />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name or email…"
                  className="w-full bg-[#0E0E11] border border-[#28282C] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-[#4A4A52] transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#28282C] text-[#8E8E93] uppercase tracking-wider font-mono text-[10px]">
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Credits</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28282C]/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#71717A]">
                        No matching users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isUserAdmin = ALLOWED_ADMIN_EMAILS.some(
                        (adm) => adm.toLowerCase() === u.email.toLowerCase(),
                      );

                      return (
                        <tr
                          key={u.id || u.email}
                          className="hover:bg-[#1A1A1E]/60 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              {u.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={u.avatar_url}
                                  alt=""
                                  className="w-7 h-7 rounded-full object-cover border border-[#28282C]"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-[#1C1C20] border border-[#28282C] text-[#D4D4D8] flex items-center justify-center font-bold text-xs">
                                  {u.name?.[0] || u.email[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-white">
                                    {u.name || "User"}
                                  </span>
                                  {isUserAdmin && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-[#1C1C20] text-[#D4D4D8] border border-[#28282C] font-mono">
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#8E8E93] font-mono">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => {
                                setQuotaModalUser(u);
                                setQuotaInputValue(String(u.quota ?? 0));
                                setQuotaMode("set");
                              }}
                              className="inline-flex items-center gap-1 hover:bg-[#1F1F23] px-2 py-1 rounded cursor-pointer transition-colors"
                              title="Click to adjust quota"
                            >
                              <span className="font-mono font-bold text-white text-sm">
                                {(Number(u.quota) || 0).toFixed(1)}
                              </span>
                              <span className="text-[10px] text-[#71717A]">
                                Credits
                              </span>
                            </button>
                          </td>

                          {/* BUG-42: Dynamically calculate user status */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {(() => {
                              const isBlocked = Boolean(u.is_blocked);
                              const isVip = Boolean(u.vip);
                              const isVipExpired = u.vip_expires_at
                                ? new Date(u.vip_expires_at).getTime() <= Date.now()
                                : false;

                              let label = "Non-VIP";
                              let dot = "bg-neutral-500";
                              let text = "text-[#8E8E93]";

                              if (isBlocked) {
                                label = "Suspended";
                                dot = "bg-rose-500";
                                text = "text-rose-400";
                              } else if (isVip && !isVipExpired) {
                                label = "Active VIP";
                                dot = "bg-emerald-400";
                                text = "text-emerald-400";
                              } else if (isVip && isVipExpired) {
                                label = "VIP Expired";
                                dot = "bg-amber-400";
                                text = "text-amber-400";
                              }

                              return (
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                  {label}
                                </span>
                              );
                            })()}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            {!isUserAdmin && (
                              <button
                                type="button"
                                onClick={() => setBlockModalUser(u)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${u.is_blocked
                                  ? "bg-[#1C1C20] text-[#D4D4D8] border border-[#28282C] hover:bg-[#24242A]"
                                  : "bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20"
                                  }`}
                              >
                                {u.is_blocked ? "Unblock" : "Block User"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: AWS RENDERS & DEVELOPER COMMISSION BREAKDOWN ─────────────── */}
        {activeTab === "renders" && (
          <div className="bg-[#141416] border border-[#28282C] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="pb-3 border-b border-[#28282C]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Film size={16} className="text-[#A1A1AA]" />
                AWS Video Renders
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#0E0E11] border border-[#28282C]">
              <div>
                <span className="text-[11px] text-[#8E8E93] block font-mono">
                  TOTAL AWS LAMBDA RENDERS
                </span>
                <span className="text-xl font-bold text-white font-mono">
                  {renderActivities.length} Jobs
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#8E8E93] block font-mono">
                  GROSS CREDITS DEDUCTED
                </span>
                <span className="text-xl font-bold text-white font-mono">
                  {renderActivities.length * settings.renderCost} Credits
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#8E8E93] block font-mono">
                  {settings.developerFeePercent}% DEVELOPER FEE LOGGED
                </span>
                <span className="text-xl font-bold text-white font-mono">
                  RM{" "}
                  {(
                    renderActivities.length *
                    settings.renderCost *
                    (settings.developerFeePercent / 100)
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#28282C] text-[#8E8E93] uppercase tracking-wider font-mono text-[10px]">
                    <th className="py-2.5 px-3">Render Time</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Gross Deduction</th>
                    <th className="py-2.5 px-3">{settings.developerFeePercent}% Dev Fee (RM)</th>
                    <th className="py-2.5 px-3">Swdbot Redemptions Record</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28282C]/60">
                  {renderActivities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#71717A]">
                        No AWS video render jobs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    renderActivities.map((rnd) => (
                      <tr
                        key={rnd.id}
                        className="hover:bg-[#1A1A1E]/60 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#8E8E93]">
                          {new Date(rnd.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-white">
                          {rnd.userEmail}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-white font-bold">
                          -{rnd.credits} Credits
                        </td>
                        <td className="py-2.5 px-3 font-mono text-white font-medium">
                          RM {(rnd.credits * (settings.developerFeePercent / 100)).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#8E8E93]">
                          Storyboard Video Render (AWS)
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#D4D4D8]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Completed
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 5: ANTHROPIC AI ENGINE & LIVE STATUS ───────────────────────────── */}
        {activeTab === "shiteru" && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-2xl p-6 bg-[#141416] border border-[#28282C] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Cpu size={18} className="text-[#A1A1AA]" />
                      Anthropic Claude - Official API
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={checkShiteruQuota}
                    disabled={shiteruLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={shiteruLoading ? "animate-spin text-black" : ""} />
                    <span>{shiteruLoading ? "Refreshing..." : "Refresh"}</span>
                  </button>
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1C20] border border-[#28282C] text-[#A1A1AA] hover:text-white text-xs font-medium transition-colors"
                  >
                    <span>Console</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* Status grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-[#28282C]">
                <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-[#28282C] space-y-1">
                  <span className="text-[10px] font-mono text-[#8E8E93] uppercase flex items-center gap-1.5">
                    <Server size={12} className="text-[#A1A1AA]" />
                    API Endpoint
                  </span>
                  <p className="text-xs font-mono text-white font-medium truncate">
                    https://api.anthropic.com/v1
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-[#28282C] space-y-1">
                  <span className="text-[10px] font-mono text-[#8E8E93] uppercase flex items-center gap-1.5">
                    <KeyRound size={12} className="text-[#A1A1AA]" />
                    Active Key
                  </span>
                  <p className="text-xs font-mono text-[#D4D4D8] font-medium truncate">
                    {shiteruData?.data?.key?.keyPrefix
                      ? `${shiteruData.data.key.keyPrefix}...`
                      : "sk-ant-usr-1Siu..."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-[#28282C] space-y-1">
                  <span className="text-[10px] font-mono text-[#8E8E93] uppercase flex items-center gap-1.5">
                    <Cpu size={12} className="text-[#A1A1AA]" />
                    Default Model
                  </span>
                  <p className="text-xs font-mono text-white font-medium">
                    claude-opus-5-5 (Fast: claude-haiku-5-5)
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0E0E11] border border-[#28282C] space-y-1">
                  <span className="text-[10px] font-mono text-[#8E8E93] uppercase flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-[#A1A1AA]" />
                    Key Status
                  </span>
                  <p className="text-xs font-mono text-white font-medium uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {shiteruData?.data?.key?.status || "ACTIVE"}
                  </p>
                </div>
              </div>
            </div>

            {/* Error banner if check failed */}
            {shiteruError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                <span>{shiteruError}</span>
              </div>
            )}

            {/* Active Models Catalog */}
            <div className="bg-[#141416] border border-[#28282C] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#28282C]">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Cpu size={15} className="text-[#A1A1AA]" />
                    Katalog Model Anthropic Aktif
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: "claude-opus-5-5",
                    name: "Claude Opus 5.5",
                    badge: "Flagship / Default",
                    desc: "Model tercanggih Anthropic untuk penalaran tinggi & arsitektur Remotion kompleks.",
                  },
                  {
                    id: "claude-sonnet-5-5",
                    name: "Claude Sonnet 5.5",
                    badge: "High-Performance",
                    desc: "Keseimbangan ideal antara kecepatan dan akurasi tinggi untuk coding animasi.",
                  },
                  {
                    id: "claude-haiku-5-5",
                    name: "Claude Haiku 5.5",
                    badge: "Fast / Validation",
                    desc: "Model ultra-cepat untuk validasi prompt, deteksi skill, dan revisi instan.",
                  },
                ].map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-[#0E0E11] border border-[#28282C] hover:border-[#38383E] transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white">
                        {m.name}{" "}
                        <span className="text-[10px] text-[#71717A]">({m.id})</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-[#1C1C20] border border-[#28282C] text-[#D4D4D8]">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal 1: Adjust Quota Dialog (BUG-35) */}
      <Dialog open={Boolean(quotaModalUser)} onOpenChange={(open) => !open && setQuotaModalUser(null)}>
        <DialogContent className="sm:max-w-[420px] bg-[#18181B] border-[#28282C] text-[#F5F5F7]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">Adjust User Credit Quota</DialogTitle>
            <DialogDescription className="text-xs text-[#9A9AA2] mt-1.5 leading-relaxed">
              Updating quota balance for <strong className="text-white font-mono">{quotaModalUser?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQuotaMode("set")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${quotaMode === "set"
                    ? "bg-amber-400 text-black border-amber-400"
                    : "bg-[#1F1F23] text-[#9A9AA2] border-[#28282C]"
                  }`}
              >
                Set Absolute
              </button>
              <button
                type="button"
                onClick={() => setQuotaMode("add")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${quotaMode === "add"
                    ? "bg-amber-400 text-black border-amber-400"
                    : "bg-[#1F1F23] text-[#9A9AA2] border-[#28282C]"
                  }`}
              >
                Add Credits
              </button>
            </div>
            <div>
              <label className="text-xs text-[#8E8E93] block mb-1">
                {quotaMode === "set" ? "New Total Quota:" : "Credits to Add:"}
              </label>
              <input
                type="number"
                step="0.5"
                value={quotaInputValue}
                onChange={(e) => setQuotaInputValue(e.target.value)}
                className="w-full bg-[#0E0E11] border border-[#28282C] rounded-xl px-3.5 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#4A4A52]"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuotaModalUser(null)}
              className="border-[#3A3A40] text-[#9A9AA2] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const val = parseFloat(quotaInputValue);
                if (quotaModalUser && !isNaN(val)) {
                  handleAdjustQuota(quotaModalUser.email, val, quotaMode);
                }
              }}
              className="bg-amber-400 hover:bg-amber-300 text-black font-semibold"
            >
              Save Quota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Block / Unblock User Confirmation Dialog (BUG-35) */}
      <Dialog open={Boolean(blockModalUser)} onOpenChange={(open) => !open && setBlockModalUser(null)}>
        <DialogContent className="sm:max-w-[420px] bg-[#18181B] border-[#28282C] text-[#F5F5F7]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              {blockModalUser?.is_blocked ? "Unblock User Access" : "Suspend User Access"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#9A9AA2] mt-2 leading-relaxed">
              {blockModalUser?.is_blocked
                ? `Are you sure you want to restore access for ${blockModalUser?.email}? They will be able to access Motion Studio again.`
                : `Are you sure you want to suspend ${blockModalUser?.email}? They will immediately be denied access from all Motion Studio endpoints.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBlockModalUser(null)}
              className="border-[#3A3A40] text-[#9A9AA2] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (blockModalUser) {
                  handleToggleBlock(blockModalUser.email, blockModalUser.is_blocked);
                }
              }}
              className={blockModalUser?.is_blocked ? "bg-emerald-500 hover:bg-emerald-400 text-white font-semibold" : "bg-rose-500 hover:bg-rose-400 text-white font-semibold"}
            >
              {blockModalUser?.is_blocked ? "Confirm Unblock" : "Confirm Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Action Error Dialog (BUG-35) */}
      <Dialog open={Boolean(actionError)} onOpenChange={(open) => !open && setActionError(null)}>
        <DialogContent className="sm:max-w-[380px] bg-[#18181B] border-rose-500/30 text-[#F5F5F7]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Admin Action Failed</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#9A9AA2] mt-2 leading-relaxed">
              {actionError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end mt-3">
            <Button
              size="sm"
              onClick={() => setActionError(null)}
              className="bg-[#24242A] text-white hover:bg-[#2C2C34]"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
