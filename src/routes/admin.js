import { Router } from "express";
import { listSessions } from "../db/sessionRepository.js";
import { retireSession } from "../services/sessionLifecycle.js";
import { peekSessionId } from "../middleware/sessionCookie.js";
import { env } from "../config/env.js";

// Local-tool overview of every registered session — no separate auth
// layer, since anyone who can reach this server can reach /admin the
// same way they can reach the chat itself. Deliberately side-effect-free:
// viewing this page must never create a session of its own (see
// peekSessionId), so polling it can't pollute the registry it's showing.
export const adminRouter = Router();

adminRouter.get("/sessions", async (req, res) => {
  try {
    const rows = await listSessions();
    res.json({ rows, maxIdleDays: env.session.maxIdleDays, currentUid: peekSessionId(req) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.delete("/sessions/:id", async (req, res) => {
  await retireSession(req.params.id);
  res.json({ ok: true });
});
