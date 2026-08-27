# ClaudeBridge

A self-hosted API gateway that turns individual Claude logins into a multi-account API service. Each person signs in once with their own Claude subscription; everything after that — chat, keys, quotas — is scoped to that account and never touches anyone else's.

> Personal project. Not affiliated with or endorsed by Anthropic.

## Why

Claude Code CLI is built around one human, one terminal, one login. ClaudeBridge sits in front of it and turns that into something a team can share: every account gets its own isolated credentials and session history on disk, a MySQL registry tracks who's who, and an API key stands in for a login so scripts and services can call in without a browser.

## Features

- **Browser login, per account** — OAuth through the actual Claude sign-in flow, streamed live to the UI. No API keys required to authenticate.
- **Full isolation** — each account's credentials, conversation history, and settings live in their own folder. Nothing is shared.
- **API keys** — any number per account, named, individually revocable, hashed at rest.
- **Idle auto-expiry** — accounts untouched for 30+ days get logged out and cleaned up automatically.
- **Live model list** — real model ids pulled from Anthropic's API, not a hardcoded guess.
- **Locked-down inference** — every `/ask` call runs with no tool or file access on Claude's side, text in and text out.

## How it works

```
Browser  ──login──▶  Claude OAuth  ──token──▶  .claude-sessions/<account-id>/
                                                        │
API key ──Bearer──▶  resolves to account-id ──▶  claude -p <prompt>  ──▶  response
```

Every account's OAuth state lives under `.claude-sessions/<id>/`, which is also what gets handed to `claude` as its config directory — so the CLI itself never mixes accounts up. MySQL only holds metadata (who's logged in, when, which keys exist); it never sees a raw credential.

## Stack

Node.js, Express, MySQL, and the `claude` CLI as the actual inference engine. No frontend framework — the UI is plain HTML/CSS/JS, served as static files.

## Getting started

Requires Node 18+, a running MySQL server, and the [`claude` CLI](https://claude.com/product/claude-code) installed and reachable from `PATH`.

```bash
git clone <this repo>
cd claudebridge
npm install
cp .env.example .env   # fill in your MySQL credentials
npm start
```

Open `http://localhost:4577`, log in, and generate an API key from the Account page.

## Using the API

```bash
curl -X POST http://localhost:4577/ask \
  -H "Authorization: Bearer csk_..." \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Summarize this in one sentence: ..."}'
```

Full endpoint reference — including model selection, multi-turn sessions, and key management — is at `/docs.html` on a running instance.

## Layout

```
server.js              entry point
src/
  config/               env + claude CLI settings
  db/                    MySQL access (sessions, API keys)
  middleware/            cookie + API key auth
  services/              process spawning, login flow, model list, cleanup
  routes/                HTTP endpoints
public/                  the UI (Account, Docs)
```

## A few things worth knowing

- Every account needs its own active Claude Pro, Max, or Team subscription — this doesn't work with free accounts, and it isn't API-key billing.
- Login only happens through the web UI; there's no way to authenticate a new account purely over the API.
- Nothing here is exposed publicly out of the box — if you deploy it beyond localhost, put it behind your own network access controls.
