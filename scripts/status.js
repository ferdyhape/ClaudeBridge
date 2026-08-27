import spawn from "cross-spawn";
import { ROOT_DIR, CLAUDE_BIN, claudeEnv, sessionConfigDir } from "../src/config/claude.js";

const id = process.argv[2] || "_manual";
const configDir = sessionConfigDir(id);

const child = spawn(CLAUDE_BIN, ["auth", "status", "--text"], {
  cwd: ROOT_DIR,
  env: claudeEnv(configDir),
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
