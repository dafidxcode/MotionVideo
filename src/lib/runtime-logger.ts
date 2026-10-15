/**
 * Standardized runtime logger for VPS Coolify logs.
 * Formats user actions, project states, and operational statuses clearly.
 */

export function logRuntime(event: {
  action: string;
  status: "START" | "SUCCESS" | "FAILED" | "INFO";
  userEmail?: string;
  projectId?: string;
  details?: Record<string, unknown>;
  error?: unknown;
}) {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const user = event.userEmail || "Guest User";
  const proj = event.projectId || "New Project";
  const icon =
    event.status === "SUCCESS"
      ? "✅ [SUCCESS]"
      : event.status === "FAILED"
        ? "❌ [FAILED]"
        : event.status === "START"
          ? "🚀 [START]"
          : "ℹ️ [INFO]";

  console.log(`\n================================================================================`);
  console.log(`[SWDBOT RUNTIME LOG] ${icon} ${event.action}`);
  console.log(`Time:       ${timestamp}`);
  console.log(`User:       ${user}`);
  console.log(`Project ID: ${proj}`);

  if (event.details) {
    for (const [key, val] of Object.entries(event.details)) {
      if (val !== undefined && val !== null) {
        console.log(`${(key + ":").padEnd(12)} ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
  }

  if (event.error) {
    const errMsg = event.error instanceof Error ? event.error.message : String(event.error);
    console.error(`Error:      ${errMsg}`);
  }
  console.log(`================================================================================\n`);
}
