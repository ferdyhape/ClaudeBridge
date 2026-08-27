import spawn from "cross-spawn";
import { ROOT_DIR, CLAUDE_BIN, claudeEnv, sessionConfigDir } from "../config.js";

// Terminal fallback, mainly for troubleshooting — normal usage is the
// "Mulai Login" button per browser session in the web UI. An optional
// session id can be passed to operate on that browser's folder directly;
// with none given this uses a fixed "_manual" folder that is NOT tracked
// in the MySQL session registry.
const id = process.argv[2] || "_manual";
const configDir = sessionConfigDir(id);

console.log(`Logging in via browser. Credentials will be stored in:\n  ${configDir}\n`);

const child = spawn(CLAUDE_BIN, ["auth", "login"], {
  cwd: ROOT_DIR,
  env: claudeEnv(configDir),
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
