# How Ask / RAG works

Ask is a grounded Q&A chat over a small IT knowledge base (runbooks, SOPs, policies, notes). It does **not** read Notion. Notion powers the Dashboard sync loop; Ask only sees markdown that was indexed into Postgres/pgvector.

For setup and deploy, see [SETUP-AND-RUN.md](./SETUP-AND-RUN.md). Product overview stays in the root [README.md](../README.md).

---

## What you get in the UI

| Page | Role |
| ---- | ---- |
| **Ask** (`/ask`) | Type a question (or click an example). Answers come with citation chips when retrieval finds useful chunks. |
| **Documents** (`/documents`) | Browse the same indexed corpus Ask uses. Citation chips deep-link here (`?doc=<source>`). |

Chat history is client-side only — each question is answered independently. There is no multi-turn memory on the server.

---

## End-to-end flow

```
docs/seed/*.md
        │
        ▼  worker boot (seed if empty)  OR  npm run seed:rag
chunk → embed → upsert into Postgres (documents + document_chunks)
        │
        ▼
User on /ask  →  POST /api/chat { question }
        │
        ▼
embed(question) → cosine nearest-neighbor search (top-K)
        │
        ├─ no chunk ≥ RAG_MIN_SCORE ──► refuse immediately (no LLM call)
        │
        └─ hits clear the floor ──► LLM answers from those passages only
                                      + citation chips → /documents?doc=…
```

The important safety rule: **grounding is enforced by retrieval**, not by hoping the model behaves. If nothing clears the similarity floor, the API returns the refusal string and never calls the LLM.

Refusal text (exact):

> I don't have that in the indexed documents.

---

## What gets indexed

Only files under `docs/seed/` (or `RAG_SEED_DIR` if set). Today that is six markdown files:

| File | Topic |
| ---- | ----- |
| `runbook-vpn-outage.md` | Site-wide VPN outage runbook |
| `escalation-matrix.md` | Escalation & on-call |
| `sop-employee-onboarding.md` | New-hire IT provisioning |
| `policy-patch-management.md` | Patch management & change freeze |
| `postmortem-2026-05-backup-failure.md` | Backup restore test failure |
| `notes-okta-sso-migration.md` | Okta tenant migration notes |

**Not in Ask:** Notion areas, free-text Notion pages, or user uploads. Uploads are a known future improvement.

Docker Compose bind-mounts `./docs/seed` into the containers and sets `RAG_SEED_DIR=/app/docs/seed` so api + worker see the same files.

---

## Ingestion (indexing)

1. Read every `*.md` from the seed directory.
2. Title = first `# ` heading, else the filename.
3. Split into chunks (`chunkDocument`) — headings are hard boundaries; paragraphs stay whole; default size **800** chars with **150** overlap on size breaks.
4. Embed each chunk with the configured embedding provider.
5. Upsert into Postgres in one transaction: update/insert the `documents` row by unique `source`, delete old chunks, insert new ones with vectors.

### When seeding runs

- **Auto:** on worker boot, if `RAG_ENABLED` and the chunk table is empty (`seedRagIfEmpty`). Failures are logged; sync still continues.
- **Manual:** `docker compose exec api npm run seed:rag` — use this after changing seed files or switching embedding providers.

Switching `EMBEDDING_PROVIDER` does **not** re-embed existing rows. Re-run `seed:rag`, or wipe the DB volume and let boot auto-seed.

---

## Embeddings

All vectors are **384-dimensional** (matches `vector(384)` in `db/init.sql` and the HNSW cosine index).

| `EMBEDDING_PROVIDER` | Behavior |
| -------------------- | -------- |
| `hash` (default) | Offline FNV-1a bag-of-words → 384-dim L2-normalized. Lexical only — good enough for demos, weaker on paraphrase. |
| `local` | `Xenova/all-MiniLM-L6-v2` via Transformers.js (~90MB download once). Real semantic similarity, no API key. |
| `openai` | OpenAI-compatible `/embeddings`. Needs `EMBEDDING_API_KEY`. |

For better Ask results on paraphrased questions:

```bash
EMBEDDING_PROVIDER=local
RAG_MIN_SCORE=0.3
```

With hash embeddings, on-topic scores often peak around ~0.34, which is why the default floor is **0.25**.

---

## Retrieval + answer

Implemented in `api/src/services/rag/index.ts` as `answerQuestion`:

1. Embed the question with the same provider used at index time.
2. Search `document_chunks` by cosine distance; take `RAG_TOP_K` (default 10).
3. Keep only hits with similarity ≥ `RAG_MIN_SCORE`.
4. If none remain → return the refusal, `usedLlm: false`, empty citations.
5. Otherwise call `llm.answerWithContext(question, passages)`.
6. If the model replies with exactly the refusal string → drop citations (weak embeddings can clear the floor with off-topic chunks that the model then correctly rejects).

The model is instructed (in `api/src/providers/llm/prompts.ts`) to:

- Answer **only** from numbered CONTEXT passages
- Cite as `[1]`, `[2]`, …
- Refuse with the exact no-answer string if context is insufficient
- Stay concise (1–4 sentences, or a short numbered list for procedures)

### LLM providers

Ask shares the same LLM stack as dashboard summaries (`LLM_*` env vars). If `LLM_API_KEY` is blank (or `LLM_PROVIDER=mock`), a mock provider returns a short grounded excerpt from the top passage — still useful offline.

---

## API & frontend wiring

| Piece | Path |
| ----- | ---- |
| Chat route | `POST /api/chat` — `api/src/routes/chat.ts` |
| Documents API | `GET /api/documents`, `GET /api/documents/:source` |
| RAG service | `api/src/services/rag/` |
| Ask UI | `web/app/(pages)/ask/` |
| Documents UI | `web/app/(pages)/documents/` |
| Client | `web/api/dashboardApi.ts` → `chat()` |

**Request:** `{ "question": "..." }` (trimmed, 3–500 characters).

**Response (shape):** answer text, citations (`n`, `source`, `title`, `score` — chunk body is **not** sent to the browser), and `usedLlm`.

If `RAG_ENABLED=false`, chat returns **503**.

When `usedLlm` is false, the Ask UI shows a clear “nothing cleared the similarity threshold” style message instead of treating it like a normal model answer.

---

## Config knobs

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `RAG_ENABLED` | `true` | Gate chat + auto-seed |
| `EMBEDDING_PROVIDER` | `hash` | `hash` \| `local` \| `openai` |
| `EMBEDDING_MODEL` | `hash-384` | Model id (OpenAI uses this) |
| `EMBEDDING_DIM` | `384` | Must match pgvector column |
| `EMBEDDING_API_KEY` | blank | Required for `openai` |
| `EMBEDDING_BASE_URL` | OpenAI API | Embeddings endpoint |
| `RAG_TOP_K` | `10` | Candidates before the floor |
| `RAG_MIN_SCORE` | `0.25` | Cosine floor; refuse below |
| `RAG_CHUNK_SIZE` | `800` | Chunk char target |
| `RAG_CHUNK_OVERLAP` | `150` | Overlap on size breaks |
| `RAG_SEED_DIR` | `docs/seed` | Seed path |

Shared generation settings: `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, etc. (see `.env.example`).

---

## Zero-config path

With an empty `.env` and `docker compose up`:

- Notion = fixtures (dashboard only)
- LLM = mock
- Embeddings = hash
- Worker auto-seeds `docs/seed/`

Ask still works: ask about VPN outage or onboarding and you should get an answer plus citation chips. Ask something clearly off-corpus and you should get the honest refusal.

---

## Design choices & limits

1. **Floor short-circuit** — the real anti-hallucination control; the prompt is a second line of defense.
2. **Seed-only corpus** — small, reviewable, and identical to what Documents shows.
3. **Fixed 384-dim schema** — changing dimension means recreating `document_chunks`.
4. **Same embedder at index and query time** — mismatch after a provider switch needs a re-seed.
5. **Stateless questions** — no conversation context on the server.
6. **RAG events in Logs** — retrieval is logged under the RAG integration tab (`integration_logs`).

---

## Quick smoke checks

1. Open **Ask**, click an example (e.g. VPN outage) → expect an answer and citation chips.
2. Click a chip → **Documents** opens that source.
3. Ask something unrelated to the seed set → expect the refusal (often with `usedLlm: false`).
4. **Documents** lists the six seed titles with chunk counts.
5. **Logs** → RAG tab shows retrieve messages after Ask calls.
