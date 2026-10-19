import fs from "fs";
import path from "path";

export interface MotionProject {
  id: string;
  userEmail: string;
  title: string;
  prompt: string;
  code: string;
  styleId?: string;
  durationInFrames: number;
  fps: number;
  conversationHistory?: any[];
  renderStatus?: "idle" | "rendering" | "completed" | "failed";
  renderId?: string;
  renderBucket?: string;
  renderUrl?: string;
  renderSize?: number;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "src", "data");
const PROJECTS_FILE = path.join(DATA_DIR, "motion_projects.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

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

// Read local cache projects
function getLocalProjects(): MotionProject[] {
  ensureDataDir();
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalProjects(projects: MotionProject[]) {
  ensureDataDir();
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), "utf-8");
  } catch {}
}

function getUserProjectsCacheKey(email: string): string {
  // BUG-12: Replace '@' and URL-special characters with '__at__' and safe chars
  // so PostgREST's query-string decoding matches the exact stored key in provider_cache.
  return `user_projects_${email.toLowerCase().trim().replace(/@/g, "__at__").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export const PROJECT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get all projects for a specific user with strict 24-hour retention filter
 */
export async function getUserProjects(userEmail: string): Promise<MotionProject[]> {
  const normalizedEmail = userEmail.toLowerCase().trim();
  const { supabaseUrl, apiKey } = getSupabaseConfig();
  const now = Date.now();

  let projectsList: MotionProject[] = [];

  // 1. Try Supabase provider_cache with safe key (BUG-12)
  if (apiKey) {
    try {
      const cacheKey = getUserProjectsCacheKey(normalizedEmail);
      const res = await fetch(
        `${supabaseUrl}/rest/v1/provider_cache?key=eq.${encodeURIComponent(cacheKey)}&select=payload`,
        {
          headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
        },
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && Array.isArray(rows[0]?.payload)) {
          projectsList = rows[0].payload as MotionProject[];
        }
      } else {
        console.warn(`[Projects] Supabase fetch responded with status ${res.status}`);
      }
    } catch (err) {
      console.warn("[Projects] Supabase fetch error, fallback to local:", err);
    }
  }

  // 2. Fallback to local storage if Supabase returned empty
  if (projectsList.length === 0) {
    const all = getLocalProjects();
    projectsList = all.filter((p) => p.userEmail.toLowerCase().trim() === normalizedEmail);
  }

  // 3. Strict 24-hour auto-prune filter: Remove all text projects older than 24 hours!
  const validProjects = projectsList.filter((p) => {
    const projectTime = new Date(p.updatedAt || p.createdAt).getTime();
    return now - projectTime < PROJECT_RETENTION_MS;
  });

  // If expired projects were dropped, synchronize Supabase & local cache immediately
  if (validProjects.length !== projectsList.length) {
    saveUserProjectsList(normalizedEmail, validProjects).catch(() => {});
  }

  return validProjects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

async function saveUserProjectsList(userEmail: string, list: MotionProject[]): Promise<void> {
  const normalizedEmail = userEmail.toLowerCase().trim();
  const now = new Date().toISOString();
  const { supabaseUrl, apiKey } = getSupabaseConfig();

  // Save to local cache first as reliable write-behind fallback
  const allLocal = getLocalProjects().filter(
    (p) => p.userEmail.toLowerCase().trim() !== normalizedEmail,
  );
  saveLocalProjects([...list, ...allLocal]);

  // BUG-13: Await Supabase writes with explicit logging instead of fire-and-forget
  if (apiKey) {
    const cacheKey = getUserProjectsCacheKey(normalizedEmail);
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/provider_cache`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          key: cacheKey,
          payload: list,
          fetched_at: now,
        }),
      });
      if (!res.ok) {
        console.error(
          `[Projects] Failed to persist projects to Supabase (HTTP ${res.status}):`,
          await res.text(),
        );
      }
    } catch (err) {
      console.error("[Projects] Network error saving projects to Supabase:", err);
    }
  }
}

/**
 * Prune all expired projects older than 24 hours globally across all users.
 */
export async function pruneAllExpiredProjects(): Promise<{ prunedCount: number }> {
  const now = Date.now();
  const allLocal = getLocalProjects();
  const validLocal = allLocal.filter((p) => {
    const projectTime = new Date(p.updatedAt || p.createdAt).getTime();
    return now - projectTime < PROJECT_RETENTION_MS;
  });

  const prunedCount = allLocal.length - validLocal.length;
  if (prunedCount > 0) {
    saveLocalProjects(validLocal);
    console.log(`[Projects Cleanup] Purged ${prunedCount} expired text projects (> 24h old) from database.`);
  }

  return { prunedCount };
}

/**
 * Get a single project by ID for a user
 */
export async function getProjectById(
  projectId: string,
  userEmail: string,
): Promise<MotionProject | null> {
  const list = await getUserProjects(userEmail);
  return list.find((p) => p.id === projectId) || null;
}

/**
 * Save or update a project
 */
/**
 * Save or update a project
 */
export async function saveUserProject(
  projectData: Partial<MotionProject> & { userEmail: string; code?: string; prompt?: string },
): Promise<MotionProject> {
  const normalizedEmail = projectData.userEmail.toLowerCase().trim();
  const existingList = await getUserProjects(normalizedEmail);

  const now = new Date().toISOString();
  const projectId = projectData.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const existingIndex = existingList.findIndex((p) => p.id === projectId);
  const existing = existingIndex >= 0 ? existingList[existingIndex] : null;

  // Generate clean title if not provided, avoiding clobbering with fallback if existing has one
  const prompt = projectData.prompt !== undefined && projectData.prompt !== "" ? projectData.prompt : (existing?.prompt || "");
  const code = projectData.code !== undefined && projectData.code !== "" ? projectData.code : (existing?.code || "");
  const title =
    projectData.title ||
    existing?.title ||
    prompt.slice(0, 45).replace(/\n/g, " ") ||
    "Motion Graphics Project";

  const savedProject: MotionProject = {
    id: projectId,
    userEmail: normalizedEmail,
    title,
    prompt,
    code,
    styleId: projectData.styleId || existing?.styleId,
    durationInFrames: projectData.durationInFrames ?? existing?.durationInFrames ?? 300,
    fps: projectData.fps ?? existing?.fps ?? 30,
    conversationHistory: projectData.conversationHistory ?? existing?.conversationHistory ?? [],
    renderStatus: projectData.renderStatus ?? existing?.renderStatus ?? "idle",
    renderId: projectData.renderId ?? existing?.renderId,
    renderBucket: projectData.renderBucket ?? existing?.renderBucket,
    renderUrl: projectData.renderUrl ?? existing?.renderUrl,
    renderSize: projectData.renderSize ?? existing?.renderSize,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  let updatedList: MotionProject[];
  if (existingIndex >= 0) {
    updatedList = [...existingList];
    updatedList[existingIndex] = savedProject;
  } else {
    updatedList = [savedProject, ...existingList];
  }

  // Keep max 50 recent projects per user
  if (updatedList.length > 50) {
    updatedList = updatedList.slice(0, 50);
  }

  // Save to Supabase and local cache using consolidated writer (BUG-12 + BUG-13)
  await saveUserProjectsList(normalizedEmail, updatedList);

  return savedProject;
}

/**
 * Partially update an existing project without overwriting code/prompt with empty strings (BUG-11).
 * Guards against creating orphan ghost projects if projectId does not belong to the user.
 */
export async function updatePartialProject(
  userEmail: string,
  projectId: string,
  patch: Partial<MotionProject>,
): Promise<MotionProject | null> {
  const normalizedEmail = userEmail.toLowerCase().trim();
  const existingList = await getUserProjects(normalizedEmail);
  const existingIndex = existingList.findIndex((p) => p.id === projectId);

  if (existingIndex < 0) {
    console.warn(
      `[Projects] updatePartialProject skipped: project "${projectId}" not found for "${normalizedEmail}".`,
    );
    return null;
  }

  const existing = existingList[existingIndex];
  const updatedProject: MotionProject = {
    ...existing,
    ...patch,
    title: patch.title !== undefined && patch.title !== "" ? patch.title : existing.title,
    code: patch.code !== undefined && patch.code !== "" ? patch.code : existing.code,
    prompt: patch.prompt !== undefined && patch.prompt !== "" ? patch.prompt : existing.prompt,
    updatedAt: new Date().toISOString(),
  };

  const updatedList = [...existingList];
  updatedList[existingIndex] = updatedProject;

  await saveUserProjectsList(normalizedEmail, updatedList);
  return updatedProject;
}

/**
 * Delete a project
 */
export async function deleteUserProject(
  projectId: string,
  userEmail: string,
): Promise<boolean> {
  const normalizedEmail = userEmail.toLowerCase().trim();
  const existingList = await getUserProjects(normalizedEmail);
  const updatedList = existingList.filter((p) => p.id !== projectId);

  await saveUserProjectsList(normalizedEmail, updatedList);
  return true;
}
