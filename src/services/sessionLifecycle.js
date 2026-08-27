import fs from "node:fs/promises";
import { sessionConfigDir } from "../config/claude.js";
import { runClaude } from "./claudeProcess.js";
import { killAndForget } from "./loginSessionManager.js";
import { findStaleSessionIds, deleteSession } from "../db/sessionRepository.js";
import { env } from "../config/env.js";

// Revokes the login (best-effort) and wipes everything for a session: its
// isolated folder on disk and its row in MySQL. Used both by manual admin
// deletion and by the idle auto-expiry sweep below.
export async function retireSession(id) {
  const configDir = sessionConfigDir(id);
  killAndForget(id);
  await runClaude(["auth", "logout"], configDir).catch(() => {});
  await fs.rm(configDir, { recursive: true, force: true }).catch(() => {});
  await deleteSession(id).catch(() => {});
}

export async function sweepStaleSessions() {
  try {
    const staleIds = await findStaleSessionIds(env.session.maxIdleDays);
    for (const id of staleIds) {
      console.log(`[cleanup] retiring idle session ${id} (>${env.session.maxIdleDays}d inactive)`);
      await retireSession(id);
    }
  } catch (err) {
    console.error("[cleanup] sweep failed:", err.message);
  }
}

export function scheduleCleanup() {
  sweepStaleSessions();
  setInterval(sweepStaleSessions, env.session.cleanupIntervalMs);
}
