import "dotenv/config";

// Centralizes every environment-derived setting in one place, so nothing
// else in the app reads `process.env` directly. That's the only reason
// this module exists: a single, obvious source of truth for "what can be
// configured from the outside" (Single Responsibility).
export const env = {
  port: process.env.PORT || 4577,

  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "claudebridge",
  },

  session: {
    cookieName: "csid",
    cookieMaxAgeMs: 400 * 24 * 60 * 60 * 1000, // ~13 months, the common cap browsers honor
    maxIdleDays: Number(process.env.SESSION_MAX_IDLE_DAYS || 30),
    cleanupIntervalMs: 6 * 60 * 60 * 1000, // how often the idle-session sweep runs
  },

  // On by default (personal/portfolio use). Deployments that don't want
  // personal branding — e.g. once this is registered as an internal
  // company tool — can turn it off without patching the served files.
  showBrandFooter: process.env.SHOW_BRAND_FOOTER !== "false",

  // MCP servers this deployment is willing to expose to /ask, shaped as
  // {name: {command, args, runIdFlag?}}. Empty by default, which leaves
  // /ask text-only exactly as it has always been.
  //
  // Declared HERE, by the operator, and never accepted from a request: an
  // MCP server definition carries a `command` to spawn, so letting a
  // caller supply one would hand every API key holder arbitrary code
  // execution on this host. A request may only NAME a server that already
  // appears in this list — see routes/ask.js.
  mcpServers: parseMcpServers(process.env.MCP_SERVERS_JSON),
};

/**
 * Parses MCP_SERVERS_JSON, dropping anything malformed instead of
 * throwing: a bad value here must not stop the server from booting and
 * serving plain text chat, which is exactly what it does when no MCP
 * server is configured at all.
 *
 * @returns {Record<string, {command: string, args: string[], runIdFlag?: string}>}
 */
function parseMcpServers(raw) {
  if (!raw) return {};

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn("MCP_SERVERS_JSON is not valid JSON — no MCP servers will be available.");
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.warn("MCP_SERVERS_JSON must be a JSON object of {name: {command, args}} — ignoring.");
    return {};
  }

  const out = {};
  for (const [name, def] of Object.entries(parsed)) {
    // The name becomes part of a tool identifier (mcp__<name>) and is
    // matched against caller-supplied input, so keep it a plain token.
    if (!/^[a-z0-9_-]{1,64}$/i.test(name)) {
      console.warn(`MCP server "${name}" ignored: name must be 1-64 chars of [A-Za-z0-9_-].`);
      continue;
    }
    if (!def || typeof def.command !== "string" || !def.command) {
      console.warn(`MCP server "${name}" ignored: "command" (non-empty string) is required.`);
      continue;
    }
    if (def.args !== undefined && !Array.isArray(def.args)) {
      console.warn(`MCP server "${name}" ignored: "args" must be an array when present.`);
      continue;
    }

    out[name] = {
      command: def.command,
      args: (def.args || []).map(String),
      // Optional flag this particular server accepts so a caller can
      // correlate one /ask call with whatever that server records on its
      // own side. Declared per server because it is that server's own CLI
      // contract, not something this bridge can assume.
      ...(typeof def.runIdFlag === "string" && def.runIdFlag ? { runIdFlag: def.runIdFlag } : {}),
    };
  }
  return out;
}
