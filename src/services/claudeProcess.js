import spawn from "cross-spawn";
import { spawnSync } from "node:child_process";
import { ROOT_DIR, CLAUDE_BIN, claudeEnv } from "../config/claude.js";

// The only module that knows how to invoke the `claude` binary. Nothing
// else touches child_process/cross-spawn directly — services and routes
// depend on this small, fixed contract instead (Dependency Inversion):
// give it args + a config dir, get a child process or its collected
// output back, regardless of platform quirks underneath.

// For interactive use (auth login) where the caller needs to stream
// stdout/stderr live and write to stdin.
export function spawnClaude(args, configDir) {
  return spawn(CLAUDE_BIN, args, { cwd: ROOT_DIR, env: claudeEnv(configDir) });
}

// For one-shot calls where the caller just wants the final output.
export function runClaude(args, configDir) {
  return new Promise((resolve, reject) => {
    const child = spawnClaude(args, configDir);

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
export function killProcessTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
  } else {
    child.kill("SIGTERM");
  }
}
