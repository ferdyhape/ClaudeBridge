import { spawnClaude, killProcessTree } from "./claudeProcess.js";
import { getAuthStatus } from "./authStatusService.js";

// Bridges `claude auth login`'s interactive terminal flow onto SSE, one
// state slot per browser session id. This is the only module that knows
// about that in-memory map — routes/auth.js just asks it to start/cancel/
// feed input and to open a stream, without knowing how the bookkeeping
// works underneath (Single Responsibility + Interface Segregation).
const loginStates = new Map(); // id -> { proc, log, clients }

function getState(id) {
  let s = loginStates.get(id);
  if (!s) {
    s = { proc: null, log: "", clients: [] };
    loginStates.set(id, s);
  }
  return s;
}

function broadcast(id, event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of getState(id).clients) res.write(line);
}

function appendLog(id, text) {
  const s = getState(id);
  s.log += text;
  broadcast(id, { type: "output", text });
}

export function getLoginState(id) {
  const s = getState(id);
  return { active: !!s.proc, log: s.log };
}

export function subscribe(id, res) {
  const s = getState(id);
  s.clients.push(res);
  return () => {
    s.clients = s.clients.filter((r) => r !== res);
  };
}

export function isActive(id) {
  return !!getState(id).proc;
}

export function startLogin(id, configDir) {
  const s = getState(id);
  if (s.proc) return false;

  s.log = "";
  const child = spawnClaude(["auth", "login"], configDir);
  s.proc = child;

  child.stdout.on("data", (d) => appendLog(id, d.toString()));
  child.stderr.on("data", (d) => appendLog(id, d.toString()));
  child.on("error", (err) => appendLog(id, `\n[error] ${err.message}\n`));
  child.on("close", async (code) => {
    s.proc = null;
    if (code === 0) await getAuthStatus(id, configDir).catch(() => {});
    broadcast(id, { type: "exit", code });
  });

  return true;
}

export function sendInput(id, text) {
  const s = getState(id);
  if (!s.proc) return false;
  s.proc.stdin.write(text + "\n");
  return true;
}

export function cancelLogin(id) {
  const s = getState(id);
  if (!s.proc) return;
  appendLog(id, "\n[cancelled by user]\n");
  killProcessTree(s.proc);
}

// Used when a session is being retired entirely (see sessionLifecycle.js)
// so an in-flight login doesn't keep running against a folder that's
// about to be deleted.
export function killAndForget(id) {
  const s = loginStates.get(id);
  if (s?.proc) killProcessTree(s.proc);
  loginStates.delete(id);
}
