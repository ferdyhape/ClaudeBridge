import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SESSIONS_ROOT = path.join(ROOT_DIR, ".claude-sessions");
export const CLAUDE_BIN = process.platform === "win32" ? "claude.cmd" : "claude";

// Only pass through the bare minimum Windows/Node needs to run a child
// process. We deliberately do NOT spread the parent's full process.env:
// if this server is ever started from inside another Claude Code session,
// that parent session leaks in ambient auth via vars such as
// CLAUDE_CODE_MESSAGING_SOCKET / CLAUDE_CODE_MESSAGING_TOKEN /
// CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH, which silently authenticate the
// child WITHOUT a real browser login. Allowlisting closes that off, so the
// only way any session here ever gets credentials is a genuine login
// through that session's own browser flow.
const PASSTHROUGH_VARS = [
  "PATH",
  "SystemRoot",
  "windir",
  "TEMP",
  "TMP",
  "ComSpec",
  "PATHEXT",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
];

// One isolated "home" per browser session — credentials, settings, session
// history, plugins — instead of the real %USERPROFILE%\.claude. Each id
// is a per-session UUID (see server.js), so accounts never mix.
export function sessionConfigDir(id) {
  return path.join(SESSIONS_ROOT, id);
}

// Telemetry/error reporting and plugin auto-sync are disabled so nothing
// calls home or touches disk beyond this project folder.
export function claudeEnv(configDir) {
  const env = {};
  for (const key of PASSTHROUGH_VARS) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return {
    ...env,
    CLAUDE_CONFIG_DIR: configDir,
    DISABLE_TELEMETRY: "1",
    DISABLE_ERROR_REPORTING: "1",
    CLAUDE_CODE_SYNC_PLUGIN_INSTALL: "0",
  };
}

// Flags that lock a non-interactive `claude -p` call down to plain text
// chat: no built-in tools, and no MCP servers (project/user .mcp.json are
// ignored since we never pass --mcp-config), so there is no tool-calling
// surface at all — the model can only respond with text.
export const LOCKDOWN_ARGS = ["--tools", "", "--strict-mcp-config"];
