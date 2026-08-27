import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import spawn from "cross-spawn";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { ROOT_DIR, SESSIONS_ROOT, CLAUDE_BIN, claudeEnv, sessionConfigDir, LOCKDOWN_ARGS } from "./config.js";
import * as db from "./db.js";

const PORT = process.env.PORT || 4577;
const SESSION_COOKIE = "csid";
const SESSION_MAX_IDLE_DAYS = Number(process.env.SESSION_MAX_IDLE_DAYS || 30);

function runClaude(args, configDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, { cwd: ROOT_DIR, env: claudeEnv(configDir) });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

// cross-spawn runs claude.cmd through a cmd.exe wrapper on Windows, so
// child.kill() only kills that wrapper and can leave the real process
// running. taskkill /T kills the whole tree.
function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
  } else {
    child.kill("SIGTERM");
  }
}

// --- per-browser-session state -------------------------------------------
// Each session id (from the `csid` cookie) gets its own isolated config
// folder (see config.js) and, while a login is in flight, its own
// spawned `claude auth login` process + SSE subscriber list. Nothing here
// is shared across sessions.
const loginStates = new Map(); // id -> { proc, log, clients }

function getLoginState(id) {
  let s = loginStates.get(id);
  if (!s) {
    s = { proc: null, log: "", clients: [] };
    loginStates.set(id, s);
  }
  return s;
}

function loginBroadcast(id, event) {
  const s = getLoginState(id);
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of s.clients) res.write(line);
}

function appendLoginLog(id, text) {
  const s = getLoginState(id);
  s.log += text;
  loginBroadcast(id, { type: "output", text });
}

async function refreshAuthCache(id, configDir) {
  const { stdout, code } = await runClaude(["auth", "status", "--json"], configDir);
  if (code !== 0 || !stdout) return null;
  try {
    const data = JSON.parse(stdout);
    await db.updateSessionAuth(id, { loggedIn: !!data.loggedIn, email: data.email, orgName: data.orgName });
    return data;
  } catch {
    return null;
  }
}

// Revokes the login (best-effort) and wipes everything for a session: its
// isolated folder on disk and its row in MySQL. Used both by manual admin
// deletion and by the idle auto-expiry sweep.
async function retireSession(id) {
  const configDir = sessionConfigDir(id);
  const s = loginStates.get(id);
  if (s?.proc) killTree(s.proc);
  loginStates.delete(id);
  await runClaude(["auth", "logout"], configDir).catch(() => {});
  await fs.rm(configDir, { recursive: true, force: true }).catch(() => {});
  await db.deleteSession(id).catch(() => {});
}

async function sweepStaleSessions() {
  try {
    const staleIds = await db.findStaleSessionIds(SESSION_MAX_IDLE_DAYS);
    for (const id of staleIds) {
      console.log(`[cleanup] retiring idle session ${id} (>${SESSION_MAX_IDLE_DAYS}d inactive)`);
      await retireSession(id);
    }
  } catch (err) {
    console.error("[cleanup] sweep failed:", err.message);
  }
}

// --- app -------------------------------------------------------------------

const app = express();
app.set("trust proxy", false);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// Static files (index.html, admin.html, the browser's own favicon.ico
// probe, ...) never need a session, so they're served before the session
// middleware below — that also means they never trigger a DB write.
app.use(express.static(path.join(ROOT_DIR, "public")));

// Only mounted on the routes that actually need req.uid, so a page load's
// handful of fetch() calls are the only requests that can ever race for a
// first cookie (see note in public/index.html about sequencing them).
const sessionMiddleware = async (req, res, next) => {
  let id = req.cookies[SESSION_COOKIE];
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID();
    res.cookie(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      // Without an explicit path, RFC 6265's default-path rule scopes the
      // cookie to the directory of whichever endpoint happens to set it
      // first (e.g. "/auth" instead of "/"). Since the session middleware
      // only runs on a few different route prefixes, that can silently
      // produce several same-named cookies with different scopes instead
      // of one — and a stale one can resurface later. Pin it to "/".
      path: "/",
      maxAge: 400 * 24 * 60 * 60 * 1000,
    });
  }
  req.uid = id;
  req.configDir = sessionConfigDir(id);
  try {
    await db.ensureSession(id, { userAgent: req.headers["user-agent"], ipAddress: req.ip });
  } catch (err) {
    return res.status(500).json({ error: "Database tidak terhubung: " + err.message });
  }
  next();
};
app.use(["/whoami", "/auth", "/ask", "/admin/api"], sessionMiddleware);

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/whoami", (req, res) => res.json({ uid: req.uid }));

app.get("/auth/status", async (req, res) => {
  const { stdout, stderr, code } = await runClaude(["auth", "status", "--json"], req.configDir);
  if (code !== 0 && !stdout) return res.status(500).json({ error: stderr.trim() || `exit code ${code}` });
  try {
    const data = JSON.parse(stdout);
    await db.updateSessionAuth(req.uid, { loggedIn: !!data.loggedIn, email: data.email, orgName: data.orgName });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Could not parse auth status", raw: stdout });
  }
});

app.get("/auth/login/state", (req, res) => {
  const s = getLoginState(req.uid);
  res.json({ active: !!s.proc, log: s.log });
});

app.get("/auth/login/stream", (req, res) => {
  const s = getLoginState(req.uid);
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "output", text: s.log })}\n\n`);
  s.clients.push(res);
  req.on("close", () => {
    s.clients = s.clients.filter((r) => r !== res);
  });
});

app.post("/auth/login/start", (req, res) => {
  const s = getLoginState(req.uid);
  if (s.proc) return res.status(409).json({ error: "Login sudah berjalan" });

  s.log = "";
  const child = spawn(CLAUDE_BIN, ["auth", "login"], { cwd: ROOT_DIR, env: claudeEnv(req.configDir) });
  s.proc = child;

  child.stdout.on("data", (d) => appendLoginLog(req.uid, d.toString()));
  child.stderr.on("data", (d) => appendLoginLog(req.uid, d.toString()));
  child.on("error", (err) => appendLoginLog(req.uid, `\n[error] ${err.message}\n`));
  child.on("close", async (code) => {
    s.proc = null;
    if (code === 0) await refreshAuthCache(req.uid, req.configDir).catch(() => {});
    loginBroadcast(req.uid, { type: "exit", code });
  });

  res.json({ ok: true });
});

app.post("/auth/login/input", (req, res) => {
  const s = getLoginState(req.uid);
  if (!s.proc) return res.status(409).json({ error: "Tidak ada proses login yang berjalan" });
  const { text } = req.body || {};
  if (typeof text !== "string" || !text) {
    return res.status(400).json({ error: "Field 'text' (string) is required" });
  }
  s.proc.stdin.write(text + "\n");
  res.json({ ok: true });
});

app.post("/auth/login/cancel", (req, res) => {
  const s = getLoginState(req.uid);
  if (s.proc) {
    appendLoginLog(req.uid, "\n[dibatalkan oleh pengguna]\n");
    killTree(s.proc);
  }
  res.json({ ok: true });
});

app.post("/auth/logout", async (req, res) => {
  const { stdout, stderr, code } = await runClaude(["auth", "logout"], req.configDir);
  await db.updateSessionAuth(req.uid, { loggedIn: false, email: null, orgName: null }).catch(() => {});
  res.json({ ok: code === 0, output: (stdout + stderr).trim() });
});

app.post("/ask", async (req, res) => {
  const { prompt, sessionId } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Field 'prompt' (string) is required" });
  }

  const args = ["-p", prompt, "--output-format", "json", ...LOCKDOWN_ARGS];
  if (sessionId) args.push("--resume", sessionId);

  const { stdout, stderr, code } = await runClaude(args, req.configDir);
  await db.touchSession(req.uid).catch(() => {});

  if (code !== 0 && !stdout) {
    return res.status(500).json({ error: stderr.trim() || `claude exited with code ${code}` });
  }

  try {
    res.json(JSON.parse(stdout));
  } catch {
    res.status(500).json({ error: "Could not parse claude output", raw: stdout, stderr });
  }
});

// --- admin: read-only-ish overview of every session (local tool, no
// separate auth layer — anyone who can reach this server can reach /admin
// the same way they can reach the chat itself). ---

app.get("/admin/api/sessions", async (req, res) => {
  try {
    const rows = await db.listSessions();
    res.json({ rows, maxIdleDays: SESSION_MAX_IDLE_DAYS, currentUid: req.uid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/admin/api/sessions/:id", async (req, res) => {
  await retireSession(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, async () => {
  console.log(`Claude sub-machine listening on http://localhost:${PORT}`);
  console.log(`Per-session credentials under: ${SESSIONS_ROOT}`);
  console.log(`Admin overview: http://localhost:${PORT}/admin.html`);

  try {
    await db.initDatabase();
    console.log("MySQL session registry ready.");
  } catch (err) {
    console.error("Could not initialize MySQL:", err.message);
    console.error("Set MYSQL_HOST/PORT/USER/PASSWORD/DATABASE in .env and make sure the server is running.");
    process.exit(1);
  }

  sweepStaleSessions();
  setInterval(sweepStaleSessions, 6 * 60 * 60 * 1000);
});
