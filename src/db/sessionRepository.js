import { pool } from "./pool.js";

// Registry only: which browser session maps to which isolated config
// folder, and a cached view of its login state. The Claude OAuth tokens
// themselves are never written here — they stay as files under
// .claude-sessions/<id>/, which is the only place the `claude` CLI knows
// how to read them from.
//
// Every function here does exactly one query — this repository's only
// job is translating between "session" concepts and SQL, so anything
// above it (services, routes) never writes a query of its own.

export async function ensureSession(id, { userAgent, ipAddress } = {}) {
  await pool.query(
    `INSERT INTO sessions (id, user_agent, ip_address) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE last_active_at = CURRENT_TIMESTAMP`,
    [id, userAgent || null, ipAddress || null]
  );
}

export async function touchSession(id) {
  await pool.query(`UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

export async function updateSessionAuth(id, { loggedIn, email, orgName }) {
  await pool.query(`UPDATE sessions SET logged_in = ?, email = ?, org_name = ? WHERE id = ?`, [
    loggedIn ? 1 : 0,
    email || null,
    orgName || null,
    id,
  ]);
}

export async function findStaleSessionIds(maxIdleDays) {
  const [rows] = await pool.query(
    `SELECT id FROM sessions WHERE last_active_at < (NOW() - INTERVAL ? DAY)`,
    [maxIdleDays]
  );
  return rows.map((r) => r.id);
}

export async function deleteSession(id) {
  await pool.query(`DELETE FROM sessions WHERE id = ?`, [id]);
}
