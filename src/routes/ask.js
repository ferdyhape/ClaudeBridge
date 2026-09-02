import { Router } from "express";
import { runClaude } from "../services/claudeProcess.js";
import { touchSession } from "../db/sessionRepository.js";
import { env } from "../config/env.js";
import {
  LOCKDOWN_ARGS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_SYSTEM_PROMPT_WITH_TOOLS,
} from "../config/claude.js";

export const askRouter = Router();

// A run id becomes a command-line argument and, for a server like
// kagami's, names a file that server writes. Restricted to a plain token
// so a caller-supplied value can never carry a path or a shell
// metacharacter.
const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

askRouter.post("/ask", async (req, res) => {
  const { prompt, sessionId, model, systemPrompt, mcpServers, runId } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Field 'prompt' (string) is required" });
  }

  let mcp;
  try {
    mcp = resolveMcpServers(mcpServers, runId);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const args = ["-p", prompt, "--output-format", "json", ...LOCKDOWN_ARGS];

  // A caller's own systemPrompt still always wins. Otherwise pick the
  // default matching this session's actual capabilities — the text-only
  // default asserts "you have no tools", which would work directly
  // against a tool-enabled call.
  const fallbackSystemPrompt = mcp ? DEFAULT_SYSTEM_PROMPT_WITH_TOOLS : DEFAULT_SYSTEM_PROMPT;
  args.push(
    "--system-prompt",
    typeof systemPrompt === "string" && systemPrompt ? systemPrompt : fallbackSystemPrompt
  );

  if (typeof model === "string" && model) args.push("--model", model);
  if (sessionId) args.push("--resume", sessionId);

  if (mcp) {
    args.push("--mcp-config", JSON.stringify({ mcpServers: mcp.servers }));
    // Required, not belt-and-braces: without a matching --allowedTools
    // entry the model can SEE an MCP tool but is denied permission to
    // call it, and a -p run has nobody to approve it. The entry is the
    // SERVER name (mcp__<name>), which covers every tool that server
    // exposes — so this bridge never needs to know their names, and a
    // server adding a tool needs no change here.
    args.push("--allowedTools", mcp.allowedTools.join(","));
  }

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

/**
 * Turns a request's list of MCP server NAMES into the config to spawn.
 *
 * The security boundary of this whole feature is this function: a request
 * may only ever name a server, and the command actually spawned is looked
 * up from env.mcpServers, which only the operator can set. A request able
 * to supply its own {command, args} would be arbitrary code execution on
 * this host for anyone holding an API key.
 *
 * An unknown name is a 400, not a silent skip: a caller that expected
 * tools and quietly got a text-only session would get a confidently
 * unverified answer back, which is worse than an error.
 *
 * @returns {null | {servers: object, allowedTools: string[]}} null when none were requested
 */
function resolveMcpServers(requested, runId) {
  if (requested === undefined || requested === null) return null;

  if (!Array.isArray(requested) || requested.some((n) => typeof n !== "string")) {
    throw new Error("Field 'mcpServers' must be an array of server names (strings)");
  }
  if (requested.length === 0) return null;

  if (runId !== undefined && runId !== null && !RUN_ID_PATTERN.test(String(runId))) {
    throw new Error("Field 'runId' must be 1-64 characters of letters, digits, '_' or '-'");
  }

  const servers = {};
  const allowedTools = [];

  for (const name of requested) {
    const def = env.mcpServers[name];
    if (!def) {
      const available = Object.keys(env.mcpServers);
      throw new Error(
        `Unknown MCP server '${name}'. ` +
          (available.length
            ? `This deployment offers: ${available.join(", ")}.`
            : "This deployment has no MCP servers configured (see MCP_SERVERS_JSON).")
      );
    }

    const args = [...def.args];
    if (runId && def.runIdFlag) args.push(def.runIdFlag, String(runId));

    servers[name] = { command: def.command, args };
    allowedTools.push(`mcp__${name}`);
  }

  return { servers, allowedTools };
}
