import { Router } from "express";
import { runClaude } from "../services/claudeProcess.js";
import { touchSession } from "../db/sessionRepository.js";
import { LOCKDOWN_ARGS } from "../config/claude.js";

export const askRouter = Router();

askRouter.post("/ask", async (req, res) => {
  const { prompt, sessionId } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Field 'prompt' (string) is required" });
  }

  const args = ["-p", prompt, "--output-format", "json", ...LOCKDOWN_ARGS];
  if (sessionId) args.push("--resume", sessionId);

  const { stdout, stderr, code } = await runClaude(args, req.configDir);
  await touchSession(req.uid).catch(() => {});

  if (code !== 0 && !stdout) {
    return res.status(500).json({ error: stderr.trim() || `claude exited with code ${code}` });
  }

  try {
    res.json(JSON.parse(stdout));
  } catch {
    res.status(500).json({ error: "Could not parse claude output", raw: stdout, stderr });
  }
});
