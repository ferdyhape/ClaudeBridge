import { resolveApiKey } from "../services/apiKeyService.js";
import { sessionConfigDir } from "../config/claude.js";

// Lets the exact same routes that browsers hit via cookie also be driven
// by `Authorization: Bearer <key>`, for scripts/CI/other services calling
// in from outside a browser. A key just resolves to the session id it was
// minted for — from there on, request handling is identical to a cookie
// request (same config dir, same everything).
//
// If no bearer token is present at all, this steps aside so the cookie
// middleware behind it can run instead. If one IS present but invalid,
// it rejects outright rather than silently falling through to minting a
// brand new anonymous session — a bad key should fail loudly, not quietly
// start a throwaway identity.
export async function apiKeyAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return next();

  const sessionId = await resolveApiKey(match[1]);
  if (!sessionId) return res.status(401).json({ error: "API key tidak valid atau sudah dicabut" });

  req.uid = sessionId;
  req.configDir = sessionConfigDir(sessionId);
  req.authMethod = "api-key";
  next();
}
