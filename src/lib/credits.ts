import fs from "fs";
import path from "path";
import {
  getSwdbotProfileByEmail,
  isAdminUser,
  type SwdbotUserProfile,
} from "./auth";

export interface MotionStudioSettings {
  initialGenerationCost: number; // default: 5
  chatbotCost: number; // default: 1
  renderCost: number; // default: 10
  developerFeePercent: number; // default: 50%
  updatedAt?: string;
  updatedBy?: string;
}

export interface MotionStudioActivity {
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

const DEFAULT_SETTINGS: MotionStudioSettings = {
  initialGenerationCost: 2, // 2 Credits per 10 seconds (e.g. 10s = 2, 20s = 4, 30s = 6, 60s/1m = 12, 120s/2m = 24)
  chatbotCost: 1,
  renderCost: 10,
  developerFeePercent: 50,
  updatedAt: new Date().toISOString(),
  updatedBy: "System",
};

const DATA_DIR = path.join(process.cwd(), "src", "data");
const SETTINGS_FILE = path.join(DATA_DIR, "motion_settings.json");
const ACTIVITIES_FILE = path.join(DATA_DIR, "motion_activities.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ── Supabase REST Helpers ───────────────────────────────────────────────────
function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://mqlyjlqusvhrnxobwplt.supabase.co";
  const apiKey =
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return { supabaseUrl, apiKey };
}

// ── Motion Settings Management ──────────────────────────────────────────────
export async function getMotionStudioSettings(): Promise<MotionStudioSettings> {
  ensureDataDir();

  // 1. Try fetching from Supabase provider_cache first
  const { supabaseUrl, apiKey } = getSupabaseConfig();
  if (apiKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/provider_cache?key=eq.motion_studio_settings&select=payload`,
        {
          headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
        },
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.payload) {
          const payload = rows[0].payload as MotionStudioSettings;
          // Synchronize local cache file
          try {
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(payload, null, 2), "utf8");
          } catch {}
          return { ...DEFAULT_SETTINGS, ...payload };
        }
      }
    } catch (err) {
      console.warn("[Credits] Supabase fetch settings failed, falling back to local file:", err);
    }
  }

  // 2. Fallback to local JSON file
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf8");
      const parsed = JSON.parse(content);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}

  // 3. Return defaults
  return DEFAULT_SETTINGS;
}

export async function saveMotionStudioSettings(
  newSettings: Partial<MotionStudioSettings>,
  updatedBy: string = "Admin",
): Promise<MotionStudioSettings> {
  ensureDataDir();
  const current = await getMotionStudioSettings();
  const updated: MotionStudioSettings = {
    ...current,
    ...newSettings,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  // 1. Save to local file
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf8");
  } catch (err) {
    console.error("[Credits] Failed to save settings to local file:", err);
  }

  // 2. Persist to Supabase provider_cache
  const { supabaseUrl, apiKey } = getSupabaseConfig();
  if (apiKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/provider_cache`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          key: "motion_studio_settings",
          payload: updated,
          fetched_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("[Credits] Failed to save settings to Supabase:", err);
    }
  }

  return updated;
}

// ── Activity Logging ────────────────────────────────────────────────────────
export async function getMotionActivities(limit = 100): Promise<MotionStudioActivity[]> {
  ensureDataDir();

  // Read from local cache file first for instant speed
  let activities: MotionStudioActivity[] = [];
  try {
    if (fs.existsSync(ACTIVITIES_FILE)) {
      const content = fs.readFileSync(ACTIVITIES_FILE, "utf8");
      activities = JSON.parse(content);
    }
  } catch {}

  // Also query Supabase provider_cache if local is empty
  if (activities.length === 0) {
    const { supabaseUrl, apiKey } = getSupabaseConfig();
    if (apiKey) {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/provider_cache?key=eq.motion_studio_activities&select=payload`,
          {
            headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
            cache: "no-store",
          },
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && Array.isArray(rows[0]?.payload)) {
            activities = rows[0].payload as MotionStudioActivity[];
          }
        }
      } catch {}
    }
  }

  // Return sorted descending
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function logMotionActivity(
  activity: Omit<MotionStudioActivity, "id" | "timestamp">,
): Promise<MotionStudioActivity> {
  ensureDataDir();
  const newActivity: MotionStudioActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...activity,
  };

  let activities: MotionStudioActivity[] = [];
  try {
    if (fs.existsSync(ACTIVITIES_FILE)) {
      activities = JSON.parse(fs.readFileSync(ACTIVITIES_FILE, "utf8"));
    }
  } catch {}

  activities.unshift(newActivity);
  // Keep max 500 records
  if (activities.length > 500) {
    activities = activities.slice(0, 500);
  }

  // Save to local file
  try {
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activities, null, 2), "utf8");
  } catch {}

  // Persist to Supabase asynchronously
  const { supabaseUrl, apiKey } = getSupabaseConfig();
  if (apiKey) {
    fetch(`${supabaseUrl}/rest/v1/provider_cache`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        key: "motion_studio_activities",
        payload: activities.slice(0, 100), // persist top 100 in Supabase
        fetched_at: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  return newActivity;
}

// ── Charge User Credits & Supabase Synchronization ──────────────────────────
export async function chargeUserCredits(options: {
  email: string;
  action: "initial_generation" | "chatbot_llm" | "aws_render";
  overrideAmount?: number;
  description?: string;
  metadata?: Record<string, any>;
}): Promise<{
  success: boolean;
  error?: string;
  chargedAmount: number;
  previousQuota: number;
  newQuota: number;
  profile?: SwdbotUserProfile;
}> {
  const { email, action, overrideAmount, description, metadata } = options;
  const settings = await getMotionStudioSettings();

  // Determine required credit cost
  let cost = 0;
  if (typeof overrideAmount === "number" && overrideAmount >= 0) {
    cost = overrideAmount;
  } else if (action === "initial_generation") {
    const durationSeconds = metadata?.durationSeconds || 10;
    const baseRate = settings.initialGenerationCost || 2;
    cost = Math.max(baseRate, Math.round((durationSeconds / 10) * baseRate));
  } else if (action === "chatbot_llm") {
    cost = settings.chatbotCost;
  } else if (action === "aws_render") {
    cost = settings.renderCost;
  }

  // Fetch real-time profile from Supabase
  const profile = await getSwdbotProfileByEmail(email);
  if (!profile) {
    return {
      success: false,
      error: "User account not found on Swdbot.",
      chargedAmount: 0,
      previousQuota: 0,
      newQuota: 0,
    };
  }

  const currentQuota = Math.round((Number(profile.quota) || 0) * 1000) / 1000;
  const isAdmin = isAdminUser(email);

  // Check quota for non-admins
  if (!isAdmin && currentQuota < cost) {
    await logMotionActivity({
      userEmail: profile.email,
      userName: profile.name || profile.email.split("@")[0],
      userAvatar: profile.avatar_url,
      action,
      credits: cost,
      remainingQuota: currentQuota,
      description: description || `Failed ${action}: Insufficient balance`,
      status: "insufficient_quota",
      metadata: { ...metadata, requiredCost: cost, userQuota: currentQuota },
    });

    return {
      success: false,
      error: `Insufficient balance! You have ${currentQuota.toFixed(1)} Credits, but this action requires ${cost} Credits. Please top up your Swdbot account.`,
      chargedAmount: 0,
      previousQuota: currentQuota,
      newQuota: currentQuota,
      profile,
    };
  }

  // Calculate new quota
  const newQuota = Math.max(0, Math.round((currentQuota - cost) * 1000) / 1000);

  // 1. Update Supabase public.profiles table
  const { supabaseUrl, apiKey } = getSupabaseConfig();
  if (apiKey && profile.id) {
    try {
      const patchRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            quota: newQuota,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!patchRes.ok) {
        console.error(
          "[Credits] Supabase profile quota patch failed:",
          patchRes.status,
          await patchRes.text(),
        );
      }
    } catch (err) {
      console.error("[Credits] Error updating Supabase profile quota:", err);
    }
  }

  // 2. CRITICAL REQUIREMENT: If AWS Render, log 50% Developer Commission into Swdbot's public.redemptions table!
  if (action === "aws_render" && apiKey) {
    try {
      const devFeePercent = settings.developerFeePercent || 50;
      const devCredits = Math.round(cost * (devFeePercent / 100) * 10) / 10;
      const grossRM = cost; // 1 credit = 1 RM unit equivalent
      const devFeeRM = devCredits;
      const netAmountRM = Math.max(0, Math.round((grossRM - devFeeRM) * 100) / 100);
      const renderId = metadata?.renderId || `rnd_${Date.now()}`;
      const redemptionId = `rdm_motion_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const redemptionPayload = {
        id: redemptionId,
        userKey: profile.legacy_key || `usr_${profile.id}`,
        userEmail: profile.email,
        userName: profile.name || profile.email.split("@")[0],
        pointsRequested: cost,
        amountRM: grossRM,
        developerFeeRM: devFeeRM,
        netAmountRM: netAmountRM,
        pointsToCreditsRate: 1.0,
        bankName: "Storyboard Video Render", // exact match used by Swdbot Admin Panel fee summary
        bankAccountHolder: "Developer Commission (50%)",
        bankAccountLast4: "AWS",
        status: "completed",
        requestedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        processedBy: "System (Motion Studio AWS Render)",
        note: `50% Developer Commission from Motion Studio Video Rendering (${cost} credits deducted, ${devCredits} credits dev allocation, RenderId: ${renderId})`,
      };

      await fetch(`${supabaseUrl}/rest/v1/redemptions`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          id: redemptionId,
          user_id: profile.id,
          user_key_raw: profile.legacy_key,
          payload: redemptionPayload,
          created_at: new Date().toISOString(),
        }),
      });

      console.log(`[Credits] Logged ${devCredits} RM 50% Developer Fee to Swdbot Redemptions (${redemptionId})`);
    } catch (redemptionErr) {
      console.error("[Credits] Failed to insert into public.redemptions:", redemptionErr);
    }
  }

  // 3. Log activity for Motion Studio Admin Panel
  await logMotionActivity({
    userEmail: profile.email,
    userName: profile.name || profile.email.split("@")[0],
    userAvatar: profile.avatar_url,
    action,
    credits: cost,
    remainingQuota: newQuota,
    description: description || `Successfully charged ${cost} credits for ${action}`,
    status: "success",
    metadata: { ...metadata, previousQuota: currentQuota, newQuota },
  });

  profile.quota = newQuota;

  return {
    success: true,
    chargedAmount: cost,
    previousQuota: currentQuota,
    newQuota,
    profile,
  };
}

// ── Admin Panel Aggregated Statistics ───────────────────────────────────────
export async function getMotionStudioStats(): Promise<{
  totalUsers: number;
  totalVipUsers: number;
  totalCreditsCharged: number;
  totalGenerations: number;
  totalChatMessages: number;
  totalRenders: number;
  developerFeeCollectedRM: number;
}> {
  const activities = await getMotionActivities(500);
  const settings = await getMotionStudioSettings();

  let totalCreditsCharged = 0;
  let totalGenerations = 0;
  let totalChatMessages = 0;
  let totalRenders = 0;
  let developerFeeCollectedRM = 0;

  for (const act of activities) {
    if (act.status === "success") {
      totalCreditsCharged += Number(act.credits) || 0;
      if (act.action === "initial_generation") totalGenerations++;
      if (act.action === "chatbot_llm") totalChatMessages++;
      if (act.action === "aws_render") {
        totalRenders++;
        const devFee = (Number(act.credits) || 0) * (settings.developerFeePercent / 100);
        developerFeeCollectedRM += devFee;
      }
    }
  }

  // Query total users from Supabase profiles
  let totalUsers = 0;
  let totalVipUsers = 0;
  const { supabaseUrl, apiKey } = getSupabaseConfig();
  if (apiKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=id,vip&limit=1000`,
        {
          headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
        },
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          totalUsers = rows.length;
          totalVipUsers = rows.filter((r) => r.vip === true).length;
        }
      }
    } catch {}
  }

  return {
    totalUsers,
    totalVipUsers,
    totalCreditsCharged: Math.round(totalCreditsCharged * 10) / 10,
    totalGenerations,
    totalChatMessages,
    totalRenders,
    developerFeeCollectedRM: Math.round(developerFeeCollectedRM * 100) / 100,
  };
}

// ── Admin User Management Helpers ───────────────────────────────────────────
export async function getAllProfilesForAdmin(): Promise<SwdbotUserProfile[]> {
  const { supabaseUrl, apiKey } = getSupabaseConfig();
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?vip=eq.true&order=created_at.desc&limit=500`,
      {
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      },
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        // Strictly return only active VIP users
        return rows.filter((u: SwdbotUserProfile) => {
          if (!u.vip) return false;
          if (u.vip_expires_at) {
            const exp = new Date(u.vip_expires_at).getTime();
            if (!isNaN(exp) && exp <= Date.now()) return false;
          }
          return true;
        });
      }
    }
  } catch (err) {
    console.error("[Credits] Failed to fetch VIP profiles for admin:", err);
  }
  return [];
}

export async function adminUpdateUserQuota(
  email: string,
  amount: number,
  mode: "add" | "set",
): Promise<{ success: boolean; newQuota: number; error?: string }> {
  const profile = await getSwdbotProfileByEmail(email);
  if (!profile || !profile.id) {
    return { success: false, newQuota: 0, error: "Profile not found" };
  }

  const currentQuota = Math.round((Number(profile.quota) || 0) * 1000) / 1000;
  const newQuota =
    mode === "add"
      ? Math.max(0, Math.round((currentQuota + amount) * 1000) / 1000)
      : Math.max(0, Math.round(amount * 1000) / 1000);

  const { supabaseUrl, apiKey } = getSupabaseConfig();
  if (apiKey) {
    try {
      const patchRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quota: newQuota,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!patchRes.ok) {
        return { success: false, newQuota: currentQuota, error: "Failed to update database" };
      }
    } catch (err: any) {
      return { success: false, newQuota: currentQuota, error: err.message };
    }
  }

  return { success: true, newQuota };
}

export async function adminToggleUserBlock(
  email: string,
  blocked: boolean,
): Promise<{ success: boolean; error?: string }> {
  const profile = await getSwdbotProfileByEmail(email);
  if (!profile || !profile.id) {
    return { success: false, error: "Profile not found" };
  }

  const { supabaseUrl, apiKey } = getSupabaseConfig();
  if (apiKey) {
    try {
      const patchRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_blocked: blocked,
            blocked_at: blocked ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!patchRes.ok) {
        return { success: false, error: "Failed to update block status" };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}
