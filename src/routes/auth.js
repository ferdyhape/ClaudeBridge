import { Router } from "express";
import { runClaude } from "../services/claudeProcess.js";
import { getAuthStatus } from "../services/authStatusService.js";
import * as loginManager from "../services/loginSessionManager.js";
import * as apiKeyService from "../services/apiKeyService.js";
import { listModels } from "../services/modelsService.js";
import { updateSessionAuth } from "../db/sessionRepository.js";

// Everything under /auth: current status, the interactive login flow
// bridged over SSE, and logout. Routes only translate HTTP <-> service
// calls — all the actual process/state logic lives in the services they
// call (loginSessionManager, authStatusService, claudeProcess).
export const authRouter = Router();

authRouter.get("/status", async (req, res) => {
  const result = await getAuthStatus(req.uid, req.configDir);
  if (!result.ok) return res.status(500).json(result);
  res.json(result.data);
});

authRouter.get("/login/state", (req, res) => {
  res.json(loginManager.getLoginState(req.uid));
});

authRouter.get("/login/stream", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "output", text: loginManager.getLoginState(req.uid).log })}\n\n`);

  const unsubscribe = loginManager.subscribe(req.uid, res);
  req.on("close", unsubscribe);
});

authRouter.post("/login/start", (req, res) => {
  const started = loginManager.startLogin(req.uid, req.configDir);
  if (!started) return res.status(409).json({ error: "A login is already in progress" });
  res.json({ ok: true });
});

authRouter.post("/login/input", (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== "string" || !text) {
    return res.status(400).json({ error: "Field 'text' (string) is required" });
  }
  const sent = loginManager.sendInput(req.uid, text);
  if (!sent) return res.status(409).json({ error: "No login is currently in progress" });
  res.json({ ok: true });
});

authRouter.post("/login/cancel", (req, res) => {
  loginManager.cancelLogin(req.uid);
  res.json({ ok: true });
});

authRouter.post("/logout", async (req, res) => {
  const { stdout, stderr, code } = await runClaude(["auth", "logout"], req.configDir);
  await updateSessionAuth(req.uid, { loggedIn: false, email: null, orgName: null }).catch(() => {});
  res.json({ ok: code === 0, output: (stdout + stderr).trim() });
});

// Live model list for this account, fetched from Anthropic's own API
// using the OAuth token the CLI already stores after login — see
// modelsService.js for why this exists (the CLI has no such command).
authRouter.get("/models", async (req, res) => {
  try {
    res.json({ models: await listModels(req.configDir) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// API keys let this same identity (whichever session req.uid resolved
// to — cookie or an existing key) be driven from outside a browser, e.g.
// `curl -H "Authorization: Bearer csk_..." .../ask`. Management is
// self-service only: there's no admin visibility into key values or
// listings, by design (see the earlier scoping discussion).

authRouter.get("/api-keys", async (req, res) => {
  res.json({ rows: await apiKeyService.listApiKeys(req.uid) });
});

authRouter.post("/api-keys", async (req, res) => {
  const { name } = req.body || {};
  const created = await apiKeyService.createApiKey(req.uid, typeof name === "string" ? name.trim() : "");
  res.json(created);
});

authRouter.delete("/api-keys/:id", async (req, res) => {
  const removed = await apiKeyService.revokeApiKey(req.uid, req.params.id);
  if (!removed) return res.status(404).json({ error: "Key not found" });
  res.json({ ok: true });
});
