import crypto from "node:crypto";
import { sessionConfigDir } from "../config/claude.js";
import { ensureSession } from "../db/sessionRepository.js";
import { env } from "../config/env.js";

const UUID_RE = /^[0-9a-f-]{36}$/i;

// Assigns/reads the `csid` cookie and attaches req.uid + req.configDir.
// Only mounted on the routes that actually need it (see app.js) — static
// asset requests never touch this, so they can't race an API call for a
// fresh cookie on a browser's very first page load.
export function sessionCookie(req, res, next) {
  let id = req.cookies[env.session.cookieName];
  if (!id || !UUID_RE.test(id)) {
    id = crypto.randomUUID();
    res.cookie(env.session.cookieName, id, {
      httpOnly: true,
      sameSite: "lax",
      // Without an explicit path, RFC 6265's default-path rule scopes the
      // cookie to the directory of whichever endpoint happens to set it
      // first (e.g. "/auth" instead of "/"). Since this middleware is
      // mounted on a few different route prefixes, that can silently
      // produce several same-named cookies with different scopes instead
      // of one — and a stale one can resurface later. Pin it to "/".
      path: "/",
      maxAge: env.session.cookieMaxAgeMs,
    });
  }

  req.uid = id;
  req.configDir = sessionConfigDir(id);

  ensureSession(id, { userAgent: req.headers["user-agent"], ipAddress: req.ip })
    .then(next)
    .catch((err) => res.status(500).json({ error: "Database tidak terhubung: " + err.message }));
}

// Reads the session id if the request already has one, without ever
// minting a new cookie or writing to the database. Use this for routes
// that merely want to know "is this viewer also a registered session"
// (e.g. highlighting "you" in the admin list) — they must stay free of
// the side effect of creating a session just from being viewed.
export function peekSessionId(req) {
  const id = req.cookies[env.session.cookieName];
  return id && UUID_RE.test(id) ? id : null;
}
