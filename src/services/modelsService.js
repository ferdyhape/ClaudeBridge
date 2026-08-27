import fs from "node:fs/promises";
import path from "node:path";

const ANTHROPIC_API_BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const CACHE_TTL_MS = 10 * 60 * 1000; // model lineups don't change minute-to-minute

// keyed by configDir, so cache lifetime naturally follows session lifetime
const cache = new Map();

async function readAccessToken(configDir) {
  const raw = await fs.readFile(path.join(configDir, ".credentials.json"), "utf8");
  const data = JSON.parse(raw);
  return data?.claudeAiOauth?.accessToken || null;
}

// Lists the models available to this session's Claude account, using the
// same OAuth access token the `claude` CLI itself stores after login.
// This hits Anthropic's standard, publicly documented /v1/models endpoint
// directly — not a CLI-internal or undocumented mechanism — since the CLI
// has no equivalent "list models" command of its own (see the earlier
// --help audit). Model id strings are real names like "claude-opus-5",
// not the simple aliases (sonnet/opus/haiku) the --model flag also
// accepts, which is exactly why a live list is worth having instead of a
// hardcoded guess.
//
// Note: if the stored access token happens to be expired and hasn't been
// refreshed by a recent `/ask` call, this will fail with a 401 — we don't
// attempt our own token refresh here (that's the CLI's internal, timing
// undocumented flow, not something to reimplement). Callers should treat
// a failure as "try again after using /ask, or re-login."
export async function listModels(configDir) {
  const cached = cache.get(configDir);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const token = await readAccessToken(configDir).catch(() => null);
  if (!token) throw new Error("Not logged in");

  const res = await fetch(`${ANTHROPIC_API_BASE}/v1/models`, {
    headers: { Authorization: `Bearer ${token}`, "anthropic-version": ANTHROPIC_VERSION },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Anthropic API returned ${res.status}`);
  }

  const json = await res.json();
  const models = (json.data || []).map((m) => ({ id: m.id, displayName: m.display_name }));
  cache.set(configDir, { data: models, expiresAt: Date.now() + CACHE_TTL_MS });
  return models;
}

export function clearModelsCache(configDir) {
  cache.delete(configDir);
}
