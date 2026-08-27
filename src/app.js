import express from "express";
import cookieParser from "cookie-parser";
import { PUBLIC_DIR } from "./config/claude.js";
import { sessionCookie } from "./middleware/sessionCookie.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";
import { healthRouter } from "./routes/health.js";
import { whoamiRouter } from "./routes/whoami.js";
import { authRouter } from "./routes/auth.js";
import { askRouter } from "./routes/ask.js";

// Wires the app together: middleware order + route mounting. Nothing in
// here knows HOW any route or service works — that's Open/Closed in
// practice: adding a new route module is a one-line addition here, never
// a change to an existing router or service.
export function createApp() {
  const app = express();
  app.set("trust proxy", false);
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Static files (the built React app's index.html + assets, the
  // browser's own favicon.ico probe, ...) never need a session, so
  // they're served before the session middleware below — that also means
  // they never trigger a DB write.
  app.use(express.static(PUBLIC_DIR));

  app.use(healthRouter);

  // Identity resolution for the routes that need req.uid: try an API key
  // first (for non-browser callers), then fall back to the browser
  // cookie. This scoping is also what keeps a page load's handful of
  // fetch() calls as the only requests that can ever race for a first
  // cookie.
  app.use(["/whoami", "/auth", "/ask"], apiKeyAuth, sessionCookie);

  app.use(whoamiRouter);
  app.use("/auth", authRouter);
  app.use(askRouter);

  return app;
}
