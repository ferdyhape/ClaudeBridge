import path from "node:path";
import { fileURLToPath } from "node:url";

// Project root, regardless of how deep this file lives under src/.
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PUBLIC_DIR = path.join(ROOT_DIR, "public");
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
// is a per-session UUID (see middleware/sessionCookie.js), so accounts
// never mix.
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

// Flags that lock a non-interactive `claude -p` call down. These are
// passed on EVERY call and are never relaxed:
//
//   --tools ""            every built-in tool off — no shell, no file
//                         read/write, no web fetch. Verified against the
//                         real CLI: asked to run a shell command with
//                         this set, the model reports it has no such tool.
//   --strict-mcp-config   only MCP servers from --mcp-config are loaded.
//                         Any .mcp.json sitting in this project or the
//                         session's config dir is ignored.
//
// With no --mcp-config, that leaves no tool-calling surface at all: the
// model can only answer with text, which is the default for /ask.
//
// A request may additionally NAME an MCP server the operator has already
// declared in env.mcpServers, which adds --mcp-config for that server
// only (see routes/ask.js). --tools "" still applies, so even then the
// model gets that server's tools and nothing else. Note that MCP tools
// are not usable on their own: without a matching --allowedTools entry
// the model can see a tool but is refused permission to call it, and in
// -p mode there is nobody to grant it — confirmed live.
export const LOCKDOWN_ARGS = ["--tools", "", "--strict-mcp-config"];

// Overrides Claude Code's default system prompt (built for an interactive
// coding agent — git safety rules, tool-use conventions, none of which
// apply here since tools are off). This API is called by scripts/services
// for general task-automation help, often with a data payload (JSON,
// logs, plain text) embedded in the prompt to analyze — so the default
// leans "get straight to the task," not chatty, and not scoped to any one
// kind of request. Callers can still override it per-request (see
// routes/ask.js) for cases that need a different persona.
export const DEFAULT_SYSTEM_PROMPT =
  "You are Claude, called here as a general-purpose assistant for automated workflows and task " +
  "automation. Callers may send a data payload (JSON, logs, plain text, etc.) embedded in the prompt " +
  "and ask you to analyze, extract, summarize, or transform it — or they may ask for help with any " +
  "other task. Respond directly and concisely, focused on what was actually asked, without extra " +
  "pleasantries. You have no tools or file access in this session — work only from what's given in " +
  "the prompt.";

// The same default, minus the "you have no tools" sentence, used when a
// request enables an MCP server. That sentence is not a style choice —
// telling a model it has no tools while handing it tools actively
// suppresses their use, so the tool-enabled path must not send it. Says
// nothing about WHICH tools exist: the model discovers those from the MCP
// server itself, so this stays correct however many are exposed.
export const DEFAULT_SYSTEM_PROMPT_WITH_TOOLS =
  "You are Claude, called here as a general-purpose assistant for automated workflows and task " +
  "automation. Callers may send a data payload (JSON, logs, plain text, etc.) embedded in the prompt " +
  "and ask you to analyze, extract, summarize, or transform it — or they may ask for help with any " +
  "other task. Respond directly and concisely, focused on what was actually asked, without extra " +
  "pleasantries. Tools have been provided to you for this session: use them to verify anything you " +
  "are asked about rather than guessing, and never report a result you did not actually get back " +
  "from a tool.";
