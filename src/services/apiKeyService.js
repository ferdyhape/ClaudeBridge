import crypto from "node:crypto";
import * as apiKeyRepository from "../db/apiKeyRepository.js";

const KEY_PREFIX = "csk_"; // "ClaudeBridge key" — grep-able if one ever leaks somewhere it shouldn't
const PREFIX_VISIBLE_CHARS = 10; // shown in the UI list so a user can tell keys apart without re-seeing the secret

function hash(plaintext) {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

// Returns the plaintext key exactly once — this is the only function in
// the app that ever sees it. Everything downstream (storage, listing,
// resolution) only ever touches its hash.
export async function createApiKey(sessionId, name) {
  const plaintext = KEY_PREFIX + crypto.randomBytes(32).toString("base64url");
  const id = crypto.randomUUID();
  const keyPrefix = plaintext.slice(0, PREFIX_VISIBLE_CHARS);

  await apiKeyRepository.insertApiKey({
    id,
    sessionId,
    name: name || "Unnamed",
    keyHash: hash(plaintext),
    keyPrefix,
  });

  return { id, name: name || "Unnamed", key: plaintext, prefix: keyPrefix };
}

// Turns a presented API key into the session id it represents, or null if
// it's missing/malformed/revoked. Also bumps last_used_at, best-effort.
export async function resolveApiKey(plaintext) {
  if (!plaintext || !plaintext.startsWith(KEY_PREFIX)) return null;
  const row = await apiKeyRepository.findByHash(hash(plaintext));
  if (!row) return null;
  apiKeyRepository.touchApiKey(row.id).catch(() => {});
  return row.session_id;
}

export function listApiKeys(sessionId) {
  return apiKeyRepository.listForSession(sessionId);
}

export function revokeApiKey(sessionId, id) {
  return apiKeyRepository.deleteApiKey(sessionId, id);
}
