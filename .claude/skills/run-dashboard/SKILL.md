---
name: run-dashboard
description: >-
  Launch and smoke-test the IT Ops Dashboard (this repo) end to end with Docker Compose,
  then verify it in the browser. Use this whenever the user wants to run, start, boot,
  demo, or verify the dashboard/app, check that Notion data flows into the UI, confirm
  AI summaries render, test that Slack alerts fire on a status change, or try the Ask/RAG
  chat — even if they don't say "docker" or name a specific page. Also use it to reproduce
  the zero-config (no API keys) reviewer path.
---

# Run & verify the IT Ops Dashboard

This repo is a 4-service Docker Compose stack (`db` = Postgres 17 + pgvector, `api` = Express
on :8080, `worker` = same image running the Notion→enrich→alert poll loop, `web` = Next.js on
:3000). Notion is the source of truth; the worker mirrors it into Postgres, adds a cached
AI summary per area, and fires Slack alerts on status transitions. Everything has an offline
fallback so the stack boots with **no API keys**.

## Prerequisites

- **Docker Desktop must be running.** Check with `docker info`; if it errors, start Docker
  Desktop and wait until `docker info` succeeds before continuing.
- A root `.env` must exist. If not: `cp .env.example .env` (this gives the zero-config offline
  path — fixtures for Notion, mock summarizer, Slack "skipped"). Fill in real keys to go live.

## Launch

Run from the repo root:

```bash
docker compose up --build -d
```

Then wait for the API to become healthy — poll until it returns 200:

```bash
curl -s http://localhost:8080/api/health
```

`/api/health` reports which mode each integration resolved to (`live` vs `fixtures`/`mock`/
`skipped`). Use it to confirm the stack picked up the config you expect. The web UI is at
http://localhost:3000. The boot sync (`SYNC_ON_BOOT=true`) populates the dashboard within a
few seconds.

### If the dashboard is empty or a container crash-loops
- `docker compose logs --tail=50 api worker` — read the actual error.
- **Stale schema:** if logs mention `integration_logs` (or another table) does not exist, an old
  Postgres volume predates the current `db/init.sql`. Reset once: `docker compose down -v` then
  `docker compose up --build -d`. `down -v` wipes the DB volume — only use it for this.
- **Missing fixtures:** the offline path reads `api/fixtures/areas.json` inside the container;
  the Dockerfile must `COPY fixtures ./fixtures`. If it doesn't, offline mode boots empty.

## Smoke-test in the browser

Open http://localhost:3000 (use the Browser MCP tools) and confirm:

1. **Dashboard** populates with area cards. Cards sort by urgency (Blocked → At Risk → On Track
   → Done) and each shows an AI **risk chip** + headline blocker.
2. **KPI filter:** clicking the *At Risk* / *Blocked* tile narrows the board; *Total* clears it.
3. **Update propagation:** click **Sync now** — the sync bar/toast shows *generated* vs
   *cached* counts. Click it again: the second run should be mostly **cached** (0 generated),
   proving the content-hash cache. The board refetches within ~15s (TanStack Query poll).
4. **Ask (RAG):** open Ask, click an example (e.g. VPN outage) → expect an answer with citation
   chips. Ask something off-corpus → expect the honest "not in the indexed documents" refusal
   with no citations.
5. **Activity** lists status transitions with alert outcome (`sent` / `skipped` / `failed`).
6. **Logs:** the Notion / AI / Slack / RAG / API tabs each populate.

## Verify Slack alerts fire (needs a real webhook)

Alerts fire only on a **transition into** a status in `SLACK_ALERT_STATUSES` (default
`At Risk,Blocked`), and not on first-seen unless `ALERT_ON_FIRST_SEEN=true`. With
`SLACK_WEBHOOK_URL` set to a real `hooks.slack.com` URL:

- **Authentic path:** change one area's Status to `At Risk`/`Blocked` in the Notion source, then
  click **Sync now**. Confirm a message arrives in Slack, plus a `sent` row in Activity and the
  Logs → Slack tab.
- **No-Notion-edit quick check:** set `ALERT_ON_FIRST_SEEN=true`, restart the worker
  (`docker compose up -d --force-recreate worker`) so the boot sync alerts on current
  At Risk/Blocked areas, verify Slack, then **revert the flag** so normal runs don't spam.

With `SLACK_WEBHOOK_URL` blank, the transition is still recorded and shown as **skipped** — that
is the correct, honest behaviour, and a valid thing to verify offline.

## Zero-config (reviewer) path

To reproduce what a reviewer sees with no keys: ensure the Dockerfile copies `fixtures`, point
Compose at a blank env (`docker compose --env-file .env.example up --build`), and confirm the
dashboard still fully populates (Notion=fixtures, LLM=mock, Slack=skipped, embeddings=hash).

## Tear down

```bash
docker compose down
```

Add `-v` only when you intend to wipe the Postgres volume (e.g. to re-apply `db/init.sql`).
