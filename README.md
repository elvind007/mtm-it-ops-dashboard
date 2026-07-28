# IT Ops Dashboard


| App                           | URL                                                                  |
| ------------------------------ | -------------------------------------------------------------------- |
| Live FE DEMO                      | [https://mtm-it-ops.vercel.app/](https://mtm-it-ops.vercel.app/)                       |
| API   | [https://api.getapprovl.com/api/] (https://api.getapprovl.com/api/) |
| API Health  | [https://api.getapprovl.com/api/health] (https://api.getapprovl.com/api/health) |

A small internal dashboard for tracking operational areas, with **Notion as the source of truth**.

A background worker polls Notion, writes a local Postgres mirror, generates short AI status summaries (cached by content hash so we don't burn tokens on every sync), and fires Slack when something flips to **At Risk** or **Blocked**. The UI is a Next.js app on top of that — plus an Ask chat over a seeded IT knowledge base (pgvector), and a Documents page so you can see what Ask is actually grounded in.

**No API keys required to try it.** Copy `.env.example` → `.env`, run `docker compose up`, and you get a full board: fixture areas, a mock summarizer, Slack marked “skipped”. Plug in real Notion / LLM / Slack keys when you want the live path.


| Doc                                                          | What it's for                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| **[docs/SETUP-AND-RUN.md](docs/SETUP-AND-RUN.md)**           | Local run + production deploy steps (Vercel / DigitalOcean / Apache) |
| **[docs/SETUP-NOTION-SLACK.md](docs/SETUP-NOTION-SLACK.md)** | Free Notion, Slack, and Groq keys                                    |


---



## Quick start

You need Docker with `docker compose`. That's it.

```bash
cp .env.example .env
docker compose up --build
```


| What                           | URL                                                                  |
| ------------------------------ | -------------------------------------------------------------------- |
| Dashboard                      | [http://localhost:3000](http://localhost:3000)                       |
| API health (integration modes) | [http://localhost:8080/api/health](http://localhost:8080/api/health) |


The worker syncs on boot (`SYNC_ON_BOOT=true`), so the board fills within a few seconds. Badges show *fixtures / mock / disabled* until you add keys.

### Going live with real keys

Each integration is independent — turn on as many as you want:


| Integration        | Enable with                                               | If blank                           |
| ------------------ | --------------------------------------------------------- | ---------------------------------- |
| **Notion**         | `NOTION_API_KEY` **and** `NOTION_DATABASE_ID`             | Bundled fixtures                   |
| **LLM summaries**  | `LLM_API_KEY` (Groq / OpenAI / Anthropic)                 | Mock summarizer                    |
| **Slack**          | `SLACK_WEBHOOK_URL`                                       | Transitions logged, alerts skipped |
| **RAG embeddings** | `EMBEDDING_PROVIDER=hash` (default), `local`, or `openai` | Hash (offline)                     |


Setting only one of the two Notion values fails at boot on purpose — half-configured is a mistake, not a fallback. Details and paste-ready provider blocks live in `.env.example`.

> **Fixtures → live:** if you booted once with blank keys, those mock rows stick around in the Postgres volume after you add real keys. Check `/api/health` is all-live, then wipe and rebuild — steps in [SETUP-AND-RUN.md](docs/SETUP-AND-RUN.md#switching-from-fixtures--live-stale-mock-cards).

---



## What's in the UI

Five pages in the sidebar:

- **Dashboard** — area cards with status, owner, category, priority, AI summary, risk level, and headline blocker. KPI tiles double as filters (click *At Risk* to narrow; *Total* or click again to clear). Cards sort by urgency (Blocked first). Sync bar shows Notion / AI / Slack mode, last sync, generated vs **cached** counts, and **Sync now**. The board also auto-syncs when you open or refocus the page.
- **Activity** — status transitions and Slack outcomes (`sent` / `skipped` / `failed`).
- **Ask** — RAG chat over the seeded docs. Answers come with citations when retrieval finds chunks; if nothing clears the similarity floor, it refuses without calling the LLM.
- **Documents** — browse the indexed corpus (title, chunk count, markdown body). Useful for checking what Ask can see without guessing.
- **Logs** — recent integration calls (Notion / AI / Slack / RAG / API), filterable by level.

Integration mode badges on the dashboard (and `/api/health`) make it obvious whether you're looking at fixtures or live Notion, mock or real LLM, etc.

---



## Extras beyond the core sync loop

These aren't required for “Notion → board → Slack”, but they're in the shipped app:

- **Ask (RAG)** — chunked seed docs in `docs/seed/`, embeddings in Postgres/pgvector, grounded answers with citations.
- **Documents page** — inspect that corpus from the UI (links from Ask citations land here).
- **Three embedding backends** — `hash` (offline default), `local` MiniLM (semantic, no key, ~90MB download once), or OpenAI.
- **Auto-seed on worker boot** — empty corpus → seed docs are indexed automatically; no manual step for a fresh compose up.
- **Content-hash AI cache** — summaries regenerate only when the Notion fields (or prompt version) change; the sync bar shows the hit rate.
- **Integration logs** — append-only trail for debugging without tailing containers.
- **Defensive Notion mapper** — missing/renamed properties become nulls, not a failed sync.
- **Zero-config Docker path** — reviewers can exercise the whole product offline.
- **Deploy path** — Vercel frontend + droplet API behind Apache/Let's Encrypt ([SETUP-AND-RUN.md](docs/SETUP-AND-RUN.md)).



### RAG notes

Default `EMBEDDING_PROVIDER=hash` is lexical and works with no download. For better Ask results on paraphrased questions, use local MiniLM:

```bash
EMBEDDING_PROVIDER=local
RAG_MIN_SCORE=0.3
```

Switching embedders on an existing volume does **not** re-embed old chunks — run `docker compose exec api npm run seed:rag`, or wipe the volume and let boot auto-seed. More deploy detail is in the setup guide.

---



## Notion schema

Each row is an operational area. Names are case-sensitive; `Status` must be a Select with these exact values:


| Property   | Type   | Notes                                     |
| ---------- | ------ | ----------------------------------------- |
| `Name`     | Title  | e.g. “Backup & Disaster Recovery”         |
| `Status`   | Select | `On Track`, `At Risk`, `Blocked`, `Done`  |
| `Owner`    | Text   | Who owns it                               |
| `Category` | Select | `Infra`, `Security`, `Support`, `Network` |
| `Priority` | Select | `P0`, `P1`, `P2`                          |
| `Notes`    | Text   | Main signal for the AI summary            |
| `Blockers` | Text   | Empty when healthy                        |


“Last updated” isn't a Notion property — we use `last_edited_time` on the page.

---



## How it's put together

I kept this as a small ops tool, not a platform. 

- **web** — Next.js UI (Dashboard, Activity, Ask, Documents, Logs). TanStack Query polls ~every 15s.
- **api** — Express for reads, manual sync, chat, documents, logs. Logic lives in services.
- **worker** — Same image as the API, different command. Owns Notion → enrich → alert so LLM/Slack never sit on a page request. Also auto-seeds RAG when the corpus is empty.
- **db** — Schema is one `db/init.sql` on first boot. Fine for a take-home; I'd use real migrations if this lived longer.

`init.sql` only runs on an empty data directory. Schema adds against an existing volume need `docker compose down -v` then `up --build`.

### Decisions that mattered

**Worker, not sync-in-request.** Sync now and page loads shouldn't hang on Notion + LLM + Slack. The worker owns that pipeline; the API mostly reads what it already wrote. Sync now triggers the same `runSync` path as the timer.

**Polling over webhooks.** Webhooks need a public URL — awkward for a local Docker demo. Polling plus Sync now (and auto-sync on focus) is enough. Both paths share a Postgres advisory lock so two runs can't double-alert.

**Cache by content hash, not TTL.** A TTL either wastes tokens or serves stale text. Hash the prompt inputs (`content_hash` + `prompt_version`) and only regenerate when those change.

**Slack tied to status events.** Each transition is a row; that row is also the idempotency key (`sent` / `skipped` / `failed`). A Slack blip shows up in Activity; it doesn't kill the sync.

**Offline defaults everywhere.** Empty `.env` is intentional. Health badges make the mode visible so nobody has to dig through logs.

**Boring about prompt injection.** Notion free text is labelled data, not instructions. Ask refuses when retrieval misses the floor — grounding by retrieval, not by hoping the model behaves.

**One prompt file, two wire formats.** Groq/OpenAI and Anthropic differ on the wire; the words the model sees live in one `prompts.ts`. Bad JSON from the model should degrade a card, not fail the whole sync.

### Stack


| Layer        | Choice                                                       |
| ------------ | ------------------------------------------------------------ |
| Frontend     | Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query |
| Backend      | Node.js, Express 5, TypeScript, Zod, Pino                    |
| Database     | PostgreSQL 17 + pgvector                                     |
| AI           | Groq / OpenAI-compatible or Anthropic; mock fallback         |
| Embeddings   | hash, local MiniLM, or OpenAI                                |
| Integrations | Notion API, Slack incoming webhooks                          |


---



## Demo walkthrough

1. Open [http://localhost:3000](http://localhost:3000) — board should already have areas from the boot sync.
2. Click a KPI tile to filter; click again or *Total* to clear. Cards sort Blocked → At Risk → On Track → Done.
3. Hit **Sync now** — on a second run with unchanged content, watch cached counts climb.
4. **Activity** — transitions and alert outcomes.
5. **Ask** — try something in the seed docs (VPN outage, onboarding). Citations should show when retrieval hits.
6. **Documents** — open a cited source and skim the markdown the chat used.
7. **Logs** — flip Notion / AI / Slack / RAG / API tabs.
8. Check dashboard badges or `/api/health` for fixtures vs live.

---



## Project layout

```
api/           Express API + worker (same image, different command)
  fixtures/    Offline Notion stand-in
  src/         routes, services, providers, db repos
  tests/       Focused vitest unit tests
web/           Next.js UI (Dashboard, Activity, Ask, Documents, Logs)
db/init.sql    Schema on first Postgres boot
docs/seed/     RAG seed markdown (auto-seeded on worker boot)
docs/          SETUP-AND-RUN, SETUP-NOTION-SLACK, dbdiagram
docker-compose.yml
```

---



## Assumptions

- Notion property names/types match the table above.
- Slack alerts fire on transitions into `At Risk` or `Blocked` by default (`SLACK_ALERT_STATUSES`).
- No auth — intentional for the brief; anything that can reach the API can use it.
- One Notion database; no multi-tenant setup.
- Schema changes on an existing volume need a volume reset (no migration runner).

---



## Prompt design

Summaries come from `api/src/providers/llm/prompts.ts` (shared by Groq/OpenAI and Anthropic adapters). The model gets labelled `DATA` only — no invented activity — and must return:

`{ summary, risk_level, headline_blocker, confidence }`

Those fields drive the card chips. `PROMPT_VERSION` is part of the cache key, so prompt edits actually regenerate. Ask uses a separate grounded prompt: answer from retrieved context, or refuse without calling the model when nothing clears the floor.

---



## How I tested

**Offline:** empty `.env`, `docker compose up --build`. Boot sync filled the Dashboard; second Sync now showed cache hits; Activity recorded transitions; Ask answered from auto-seeded docs; Documents listed the corpus; Logs filled under the integration tabs.

**Live:** one integration at a time in `.env`, restart, confirm `/api/health` flipped. For Slack, forced an At Risk / Blocked transition and checked webhook delivery plus a `sent` row in Activity / Logs.

Unit tests cover the mapper, transitions/alert policy, content hash, prompt parsing, chunker, hash embedder, URL sanitizer, chat refusal, and documents routes — no network required.

```bash
cd api && npm install && npm test && npm run typecheck
cd web && npm run typecheck
```

---



## Known limitations

- Poll latency is up to `SYNC_INTERVAL_MS` unless you Sync now (or rely on focus auto-sync) — no Notion webhooks.
- Failed Slack alerts are recorded but not retried.
- `init.sql` only — existing volumes need a reset for schema adds.
- Switching fixtures → live doesn't prune old fixture rows (volume reset for now).
- `integration_logs` grows unbounded (fine for a demo).
- No auth, no live log tail, no ops metrics UI — scoped to the brief.

---



## What I'd improve with more time

- **Sync reconciliation** — drop (or archive) areas not seen in the latest Notion pull, so fixtures→live doesn't need a volume wipe.
- **Real migrations** — once the schema needs to change against data you care about keeping.
- **Push instead of poll** — Notion webhooks + something like SSE to the browser, if this left local Docker.
- **Slack retry/backoff** — for transient webhook failures.
- **Log retention** — TTL or ship somewhere other than Postgres for the UI.
- **Corpus management** — upload/edit seed docs from the Documents page instead of bind-mounted markdown only.
- **SSO** — for real internal use (auth was left out on purpose).
- **Pipeline metrics** — sync duration, token spend, cache-hit rate over time.
- **One end-to-end sync test** — fake Notion source → assert DB state.

---



## Notes for reviewers

- **No keys required** — the zero-config path is the intended way to evaluate this.
- **Demo** — screen recording / deployed URL will accompany the submission. *(Add link here.)*
- **Modes are visible at runtime** — dashboard badges and `/api/health`.
- `.env.example` is the source of truth for every knob and default.
- **Deploy / volume gotchas** — [docs/SETUP-AND-RUN.md](docs/SETUP-AND-RUN.md).

