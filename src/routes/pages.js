import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC_DIR } from "../config/claude.js";
import { env } from "../config/env.js";

// The only two HTML pages get a tiny bit of server-side templating —
// everything else in public/ is still served as-is by express.static.
// Reason this exists at all: env.showBrandFooter needs to strip a chunk
// of markup before the file reaches the browser, which a static file
// server can't do.
const FOOTER_RE = /\s*<footer class="app-footer">[\s\S]*?<\/footer>\s*/;

function servePage(filename) {
  return (req, res) => {
    let html = fs.readFileSync(path.join(PUBLIC_DIR, filename), "utf8");
    if (!env.showBrandFooter) html = html.replace(FOOTER_RE, "\n");
    res.type("html").send(html);
  };
}

export const pagesRouter = Router();
pagesRouter.get("/", servePage("index.html"));
pagesRouter.get("/docs.html", servePage("docs.html"));
