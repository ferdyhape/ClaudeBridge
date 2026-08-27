import express from "express";
import cookieParser from "cookie-parser";
import { PUBLIC_DIR } from "./config/claude.js";
import { sessionCookie } from "./middleware/sessionCookie.js";
import { healthRouter } from "./routes/health.js";
import { whoamiRouter } from "./routes/whoami.js";
import { authRouter } from "./routes/auth.js";
import { askRouter } from "./routes/ask.js";
import { adminRouter } from "./routes/admin.js";

// Wires the app together: middleware order + route mounting. Nothing in
// here knows HOW any route or service works — that's Open/Closed in
// practice: adding a new route module is a one-line addition here, never
// a change to an existing router or service.
export function createApp() {
  const app = express();
  app.set("trust proxy", false);
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Static files (index.html, admin.html, the browser's own favicon.ico
  // probe, ...) never need a session, so they're served before the
  // session middleware below — that also means they never trigger a DB
  // write.
  app.use(express.static(PUBLIC_DIR));

  app.use(healthRouter);

  // sessionCookie is only mounted on the routes that actually need
  // req.uid, so a page load's handful of fetch() calls are the only
  // requests that can ever race for a first cookie. /admin/api
  // deliberately stays off this list — it's a read-mostly overview of
  // every session and must not mint a new one just from being viewed
  // (see peekSessionId in that middleware for how admin.js still knows
  // "which row is the viewer's own").
  app.use(["/whoami", "/auth", "/ask"], sessionCookie);

  app.use(whoamiRouter);
  app.use("/auth", authRouter);
  app.use(askRouter);
  app.use("/admin/api", adminRouter);

  return app;
}
