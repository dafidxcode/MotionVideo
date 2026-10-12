"use client";

import { useAuth } from "@/lib/auth-context";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  Crown,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  Video,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

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
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "overview" | "activities" | "settings" | "users" | "renders"
  >("overview");

  // Admin Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [settings, setSettings] = useState<AdminSettings>({
    initialGenerationCost: 2,
    chatbotCost: 1,
    renderCost: 10,
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
  const [formInitialGenCost, setFormInitialGenCost] = useState("2");
  const [formChatbotCost, setFormChatbotCost] = useState("1");
  const [formRenderCost, setFormRenderCost] = useState("10");
  const [formDevFeePercent, setFormDevFeePercent] = useState("50");

  const isAdmin =
    user &&
    ALLOWED_ADMIN_EMAILS.some(
      (email) => email.toLowerCase() === user.email.toLowerCase().trim(),
    );

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
          setFormInitialGenCost(String(data.settings.initialGenerationCost ?? 2));
          setFormChatbotCost(String(data.settings.chatbotCost ?? 1));
          setFormRenderCost(String(data.settings.renderCost ?? 10));
          setFormDevFeePercent(
            String(data.settings.developerFeePercent ?? 50),
          );
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

  // Periodic Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !isAdmin) return;
    const interval = setInterval(() => {
      fetchData();
    }, 6000);
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
        const data = await res.json();
        setSettings(data.settings);
        setSaveSuccessMessage(
          "Credit pricing settings updated successfully across Motion Studio!",
        );
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        fetchData();
      } else {
        alert("Failed to save settings. Please try again.");
      }
    } catch (err) {
      console.error("[Admin Settings Error]", err);
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
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update quota");
      }
    } catch {
      alert("Network error while adjusting quota");
    }
  };

  // Toggle User Block Handler
  const handleToggleBlock = async (email: string, currentBlocked?: boolean) => {
    const confirmMsg = currentBlocked
      ? `Unblock user ${email}?`
      : `Block user ${email}? They will immediately lose access to Motion Studio.`;
    if (!window.confirm(confirmMsg)) return;

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
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update block status");
      }
    } catch {
      alert("Network error while toggling block");
    }
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0B] flex items-center justify-center text-[#F5F5F7] font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-xs text-[#9A9AA2]">Verifying administrator credentials…</p>
        </div>
      </div>
    );
  }

  // Access Denied Screen (Strictly only the 2 authorized Gmails)
  if (!user || !isAdmin) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0B] flex items-center justify-center p-4 font-sans text-[#F5F5F7]">
        <div className="max-w-md w-full bg-[#18181B] border border-[#28282C] rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert size={28} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-xs text-[#9A9AA2] leading-relaxed mb-4">
            The Swdbot Motion Studio Admin Panel is strictly restricted to authorized administrators:
          </p>
          <div className="bg-[#1F1F23] rounded-xl p-3 border border-[#28282C] mb-5 text-left">
            <span className="text-[10px] uppercase font-mono text-[#6E6E76] font-bold block mb-1">
              Authorized Accounts:
            </span>
            <div className="space-y-1">
              {ALLOWED_ADMIN_EMAILS.map((em) => (
                <div key={em} className="text-xs font-mono text-amber-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {em}
                </div>
              ))}
            </div>
            {user?.email && (
              <div className="mt-2 pt-2 border-t border-[#28282C] text-[11px] text-[#9A9AA2]">
                Your signed-in email: <span className="text-white font-mono">{user.email}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex-1 py-2.5 rounded-xl bg-[#1F1F23] hover:bg-[#26262B] border border-[#28282C] text-xs font-semibold text-[#F5F5F7] transition-colors"
            >
              Back to Studio
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold transition-colors"
            >
              Switch Account
            </button>
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
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0A0A0B]/90 backdrop-blur-md border-b border-[#28282C] px-4 sm:px-8 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/swdbot-logo.png"
            alt="Swdbot"
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0"
          />
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
              Swdbot Motion Studio
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-black text-[10px] font-extrabold uppercase tracking-wider font-mono">
              Admin Panel
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">

          <button
            type="button"
            onClick={() => fetchData()}
            disabled={isLoadingData}
            className="p-2 rounded-xl bg-[#18181B] border border-[#28282C] text-[#9A9AA2] hover:text-white hover:bg-[#1F1F23] transition-colors cursor-pointer"
            title="Refresh now"
          >
            <RefreshCw
              size={15}
              className={isLoadingData ? "animate-spin text-amber-400" : ""}
            />
          </button>

          {/* Admin Email Pill */}
          <div className="hidden md:flex items-center px-3 py-1.5 rounded-full bg-[#1F1F23] border border-[#28282C]">
            <span className="text-xs font-medium text-white font-mono">
              {user.email}
            </span>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold transition-colors shadow-md shadow-amber-400/20"
          >
            <span>Studio</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* ── Main Dashboard Content ──────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 pb-40 space-y-7">
        {/* Metric Cards Row - 4 Luxury Glassmorphic Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total VIP Users */}
          <div className="relative group overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#121626]/90 via-[#10121C]/90 to-[#0C0D14]/90 border border-blue-500/25 shadow-xl shadow-blue-950/20 backdrop-blur-xl hover:border-blue-400/50 hover:shadow-blue-500/10 transition-all duration-300">
            <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/20 transition-all" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider font-mono">
                VIP Members
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Users size={16} />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-3xl font-black text-white font-mono tracking-tight">
                {stats?.totalVipUsers ?? filteredUsers.length}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active Swdbot Accounts</span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Credits Deducted */}
          <div className="relative group overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#211A10]/90 via-[#18140D]/90 to-[#100E08]/90 border border-amber-500/25 shadow-xl shadow-amber-950/20 backdrop-blur-xl hover:border-amber-400/50 hover:shadow-amber-500/10 transition-all duration-300">
            <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider font-mono">
                Credits Deducted
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Coins size={16} />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-3xl font-black text-amber-300 font-mono tracking-tight">
                {stats?.totalCreditsCharged ?? 0}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-200/70">
                <span>Total system consumption</span>
              </div>
            </div>
          </div>

          {/* Card 3: Service Developer Royalty (50%) */}
          <div className="relative group overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#0F1E17]/90 via-[#0B1510]/90 to-[#080E0B]/90 border border-emerald-500/25 shadow-xl shadow-emerald-950/20 backdrop-blur-xl hover:border-emerald-400/50 hover:shadow-emerald-500/10 transition-all duration-300">
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider font-mono">
                Dev Royalty (50%)
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Zap size={16} />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                RM {(stats?.developerFeeCollectedRM ?? 0).toFixed(2)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-300/80 font-medium">
                <span>Logged to Swdbot Redemptions</span>
              </div>
            </div>
          </div>

          {/* Card 4: Total Renders & Generations */}
          <div className="relative group overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#1E1328]/90 via-[#150D1C]/90 to-[#0E0914]/90 border border-purple-500/25 shadow-xl shadow-purple-950/20 backdrop-blur-xl hover:border-purple-400/50 hover:shadow-purple-500/10 transition-all duration-300">
            <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider font-mono">
                Jobs Completed
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Video size={16} />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-3xl font-black text-purple-300 font-mono tracking-tight">
                {(stats?.totalGenerations ?? 0) + (stats?.totalRenders ?? 0)}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-purple-200/70">
                <span>{stats?.totalGenerations ?? 0} Steps • {stats?.totalRenders ?? 0} Renders</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher Navigation - Luxury Glossy Pill Bar */}
        <div className="flex items-center gap-2 p-1.5 bg-[#14151C]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === "overview" || activeTab === "activities"
              ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold shadow-md shadow-amber-400/20"
              : "text-[#9A9AA2] hover:text-white hover:bg-white/[0.05]"
              }`}
          >
            <Activity size={14} />
            <span>Live Activities</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "overview" || activeTab === "activities" ? "bg-black/20 text-black" : "bg-white/10 text-neutral-300"}`}>
              {activities.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === "settings"
              ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold shadow-md shadow-amber-400/20"
              : "text-[#9A9AA2] hover:text-white hover:bg-white/[0.05]"
              }`}
          >
            <Coins size={14} />
            <span>Credit Rates & Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === "users"
              ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold shadow-md shadow-amber-400/20"
              : "text-[#9A9AA2] hover:text-white hover:bg-white/[0.05]"
              }`}
          >
            <Users size={14} />
            <span>VIP Users</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "users" ? "bg-black/20 text-black" : "bg-white/10 text-neutral-300"}`}>
              {filteredUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("renders")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === "renders"
              ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold shadow-md shadow-amber-400/20"
              : "text-[#9A9AA2] hover:text-white hover:bg-white/[0.05]"
              }`}
          >
            <Video size={14} />
            <span>AWS Renders</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "renders" ? "bg-black/20 text-black" : "bg-white/10 text-neutral-300"}`}>
              {renderActivities.length}
            </span>
          </button>
        </div>

        {/* ── TAB 1: LIVE ACTIVITY MONITOR ────────────────────────────────────── */}
        {(activeTab === "overview" || activeTab === "activities") && (
          <div className="bg-[#18181B] border border-[#28282C] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#28282C]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity size={16} className="text-emerald-400" />
                  Live Activity Stream
                </h3>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-56">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E76]"
                  />
                  <input
                    type="text"
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    placeholder="Search by user email or prompt…"
                    className="w-full bg-[#1F1F23] border border-[#28282C] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#6E6E76] focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>

                {/* Filter */}
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="bg-[#1F1F23] border border-[#28282C] rounded-xl px-2.5 py-1.5 text-xs text-[#F5F5F7] focus:outline-none cursor-pointer"
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
                  <tr className="border-b border-[#28282C] text-[#9A9AA2] uppercase tracking-wider font-mono text-[10px]">
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
                      <td colSpan={7} className="py-8 text-center text-[#6E6E76]">
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
                          className="hover:bg-[#1F1F23]/50 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-[#9A9AA2] whitespace-nowrap font-mono text-[11px]">
                            <span>{timeStr}</span>
                            <span className="text-[10px] text-[#6E6E76] block">
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
                                <div className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center text-[10px] font-bold">
                                  {act.userName?.[0] || "U"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-semibold text-white truncate block">
                                  {act.userName || "User"}
                                </span>
                                <span className="text-[10px] text-[#9A9AA2] truncate block font-mono">
                                  {act.userEmail}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {act.action === "initial_generation" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-medium text-[11px]">
                                <Sparkles size={11} />
                                Step 1 Gen
                              </span>
                            )}
                            {act.action === "chatbot_llm" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-medium text-[11px]">
                                <MessageSquare size={11} />
                                Chatbot Edit
                              </span>
                            )}
                            {act.action === "aws_render" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 font-medium text-[11px]">
                                <Video size={11} />
                                AWS Render
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                            <span className="text-amber-400">
                              -{act.credits}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 max-w-xs truncate text-[#E0E0E6]" title={act.description}>
                            {act.description}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[#9A9AA2] whitespace-nowrap">
                            {act.remainingQuota.toFixed(1)} Credits
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {act.status === "success" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                                <CheckCircle2 size={10} />
                                Deducted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/25">
                                <AlertTriangle size={10} />
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

        {/* ── TAB 2: CREDIT RATES & PRICING CONFIGURATION ──────────────────────── */}
        {activeTab === "settings" && (
          <div className="bg-[#13141C]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-7 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2.5">
                  <Coins size={18} className="text-amber-400" />
                  Credit Pricing Settings & Dynamic Rules
                </h3>
                <p className="text-xs text-[#9A9AA2] mt-0.5">
                  Configure real-time deduction rates for AI generations, edits, and cloud rendering.
                </p>
              </div>
              <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-lg bg-amber-400/10 border border-amber-400/25 text-amber-300 w-fit">
                Live Engine Active
              </span>
            </div>

            {saveSuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                <Check size={16} className="text-emerald-400 shrink-0" />
                <span>{saveSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Initial Generation Cost (Dynamic 2 Credits per 10s) */}
                <div className="relative group rounded-2xl p-5 bg-gradient-to-br from-[#1E1910]/80 via-[#16130D]/80 to-[#110F0A]/80 border border-amber-500/30 shadow-lg hover:border-amber-400/50 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Sparkles size={15} className="text-amber-400" />
                      Step 1 Motion Generation Rate
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 font-bold border border-amber-400/30">
                      Dynamic Duration
                    </span>
                  </div>

                  <p className="text-[11px] text-[#9A9AA2] leading-relaxed">
                    Set the base rate per 10 seconds. Longer videos scale proportionally:
                  </p>

                  <div className="flex items-center gap-2.5 pt-1">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formInitialGenCost}
                        onChange={(e) => setFormInitialGenCost(e.target.value)}
                        className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                      />
                    </div>
                    <span className="text-xs text-amber-300 font-bold font-mono px-2.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
                      Credits / 10s
                    </span>
                  </div>

                  {/* Live Duration Breakdown Pill Chips */}
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <span className="text-[10px] text-[#6E6E76] uppercase tracking-wider font-semibold block">
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
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10 text-neutral-300 flex items-center gap-1"
                          >
                            <span className="text-[#9A9AA2]">{item.label}:</span>
                            <span className="font-bold text-amber-300">{total} Cr</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Chatbot Assistant Message Cost */}
                <div className="relative group rounded-2xl p-5 bg-gradient-to-br from-[#101924]/80 via-[#0D141C]/80 to-[#0A0F15]/80 border border-cyan-500/30 shadow-lg hover:border-cyan-400/50 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <MessageSquare size={15} className="text-cyan-400" />
                      Chatbot AI LLM Revision
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-400/15 text-cyan-300 font-bold border border-cyan-400/30">
                      Per Prompt Edit
                    </span>
                  </div>

                  <p className="text-[11px] text-[#9A9AA2] leading-relaxed">
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
                        className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
                      />
                    </div>
                    <span className="text-xs text-cyan-300 font-bold font-mono px-2.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                      Credits / Msg
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[11px] text-[#6E6E76]">
                      Standard follow-up rate: 1 credit per revision query.
                    </span>
                  </div>
                </div>

                {/* 3. AWS Video Render Cost */}
                <div className="relative group rounded-2xl p-5 bg-gradient-to-br from-[#24101A]/80 via-[#1C0D15]/80 to-[#140A0F]/80 border border-rose-500/30 shadow-lg hover:border-rose-400/50 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Video size={15} className="text-rose-400" />
                      AWS Video Lambda Render
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-400/15 text-rose-300 font-bold border border-rose-400/30">
                      Full MP4 Export
                    </span>
                  </div>

                  <p className="text-[11px] text-[#9A9AA2] leading-relaxed">
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
                        className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/30"
                      />
                    </div>
                    <span className="text-xs text-rose-300 font-bold font-mono px-2.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                      Credits / Render
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[11px] text-[#6E6E76]">
                      Includes S3 storage, parallel worker rendering, and download links.
                    </span>
                  </div>
                </div>

                {/* 4. Service Developer Fee Percent */}
                <div className="relative group rounded-2xl p-5 bg-gradient-to-br from-[#10241A]/80 via-[#0D1C15]/80 to-[#0A140F]/80 border border-emerald-500/30 shadow-lg hover:border-emerald-400/50 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-2">
                      <Zap size={15} className="text-emerald-400" />
                      Service Developer Fee (%)
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-400/15 text-emerald-300 font-bold border border-emerald-400/30">
                      Auto-Logged RM
                    </span>
                  </div>

                  <p className="text-[11px] text-[#9A9AA2] leading-relaxed">
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
                        className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30"
                      />
                    </div>
                    <span className="text-xs text-emerald-300 font-bold font-mono px-2.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                      % Revenue Share
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[11px] text-[#6E6E76]">
                      Automatically syncs with public.redemptions table in real-time.
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Bar with Luxury Amber Button */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-4 border-t border-white/10">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-bold text-xs transition-all shadow-lg shadow-amber-400/25 active:scale-[0.99] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Saving New Rates…</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Save Pricing Settings</span>
                    </>
                  )}
                </button>
                <div className="text-[11px] text-[#6E6E76] font-mono">
                  Engine Timestamp:{" "}
                  <span className="text-neutral-400">
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
          <div className="bg-[#18181B] border border-[#28282C] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#28282C]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users size={16} className="text-blue-400" />
                  VIP Members ({filteredUsers.length})
                </h3>
              </div>

              <div className="relative w-full sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E76]"
                />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name or email…"
                  className="w-full bg-[#1F1F23] border border-[#28282C] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#6E6E76] focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#28282C] text-[#9A9AA2] uppercase tracking-wider font-mono text-[10px]">
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Credits</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28282C]/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6E6E76]">
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
                          className="hover:bg-[#1F1F23]/50 transition-colors"
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
                                <div className="w-7 h-7 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                                  {u.name?.[0] || u.email[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-white">
                                    {u.name || "User"}
                                  </span>
                                  {isUserAdmin && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#9A9AA2] font-mono">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => {
                                const custom = window.prompt(
                                  `Set credit quota for ${u.email}:`,
                                  String(u.quota || 0),
                                );
                                if (custom !== null) {
                                  const val = parseFloat(custom);
                                  if (!isNaN(val)) {
                                    handleAdjustQuota(u.email, val, "set");
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-1 hover:bg-[#1F1F23] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                              title="Click to adjust quota"
                            >
                              <span className="font-mono font-bold text-amber-400 text-sm">
                                {(Number(u.quota) || 0).toFixed(1)}
                              </span>
                              <span className="text-[10px] text-[#6E6E76]">
                                Credits
                              </span>
                            </button>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                              <Crown size={10} />
                              VIP
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            {!isUserAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleBlock(u.email, u.is_blocked)
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${u.is_blocked
                                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30"
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
          <div className="bg-[#18181B] border border-[#28282C] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="pb-3 border-b border-[#28282C]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Video size={16} className="text-rose-400" />
                AWS Video Renders
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#1F1F23] border border-[#28282C]">
              <div>
                <span className="text-[11px] text-[#9A9AA2] block">
                  Total AWS Lambda Renders
                </span>
                <span className="text-xl font-black text-white font-mono">
                  {renderActivities.length} Jobs
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#9A9AA2] block">
                  Gross Credits Deducted
                </span>
                <span className="text-xl font-black text-rose-400 font-mono">
                  {renderActivities.length * settings.renderCost} Credits
                </span>
              </div>
              <div>
                <span className="text-[11px] text-amber-300 block font-semibold">
                  Total 50% Developer Fee Logged
                </span>
                <span className="text-xl font-black text-amber-400 font-mono">
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
                  <tr className="border-b border-[#28282C] text-[#9A9AA2] uppercase tracking-wider font-mono text-[10px]">
                    <th className="py-2.5 px-3">Render Time</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Gross Deduction</th>
                    <th className="py-2.5 px-3">50% Dev Fee (RM)</th>
                    <th className="py-2.5 px-3">Swdbot Redemptions Record</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28282C]/60">
                  {renderActivities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6E6E76]">
                        No AWS video render jobs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    renderActivities.map((rnd) => (
                      <tr
                        key={rnd.id}
                        className="hover:bg-[#1F1F23]/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#9A9AA2]">
                          {new Date(rnd.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {rnd.userEmail}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-rose-400 font-bold">
                          -{rnd.credits} Credits
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-400 font-bold">
                          RM {(rnd.credits * 0.5).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#9A9AA2]">
                          Storyboard Video Render (AWS)
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                            <CheckCircle2 size={10} />
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
      </main>
    </div>
  );
}
