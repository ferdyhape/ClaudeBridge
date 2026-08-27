import { pool } from "./pool.js";

// Same shape as sessionRepository.js: narrow, purpose-built queries only.
// The plaintext key never passes through here — callers (apiKeyService)
// hash it first, so even reading this file tells you nothing about how
// to forge a valid key.

export async function insertApiKey({ id, sessionId, name, keyHash, keyPrefix }) {
  await pool.query(
    `INSERT INTO api_keys (id, session_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?, ?)`,
    [id, sessionId, name, keyHash, keyPrefix]
  );
}

export async function findByHash(keyHash) {
  const [rows] = await pool.query(`SELECT id, session_id FROM api_keys WHERE key_hash = ?`, [keyHash]);
  return rows[0];
}

export async function listForSession(sessionId) {
  const [rows] = await pool.query(
    `SELECT id, name, key_prefix, created_at, last_used_at
     FROM api_keys WHERE session_id = ? ORDER BY created_at DESC`,
    [sessionId]
  );
  return rows;
}

export async function touchApiKey(id) {
  await pool.query(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
}

// Scoped to session_id so a key can only ever revoke a key belonging to
// the same identity that's asking — never someone else's by guessing an id.
export async function deleteApiKey(sessionId, id) {
  const [result] = await pool.query(`DELETE FROM api_keys WHERE id = ? AND session_id = ?`, [id, sessionId]);
  return result.affectedRows > 0;
}
