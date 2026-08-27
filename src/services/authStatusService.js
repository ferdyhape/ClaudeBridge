import { runClaude } from "./claudeProcess.js";
import { updateSessionAuth } from "../db/sessionRepository.js";

// Asks the CLI for a session's current login state and mirrors it into
// the MySQL registry, so the admin view can list every account without
// having to shell out to `claude` for each row. Shared by the /auth/status
// route and by loginSessionManager after a login attempt finishes.
export async function getAuthStatus(uid, configDir) {
  const { stdout, stderr, code } = await runClaude(["auth", "status", "--json"], configDir);
  // `claude auth status` exits non-zero when logged out even though it
  // still prints valid JSON — only treat it as a real failure if there's
  // no output to parse at all.
  if (code !== 0 && !stdout) {
    return { ok: false, error: stderr.trim() || `exit code ${code}` };
  }

  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    return { ok: false, error: "Could not parse auth status", raw: stdout };
  }

  await updateSessionAuth(uid, { loggedIn: !!data.loggedIn, email: data.email, orgName: data.orgName });
  return { ok: true, data };
}
