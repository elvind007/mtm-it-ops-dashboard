-- IT Ops Dashboard schema.
--
-- Applied once by the postgres image on first boot (mounted into
-- /docker-entrypoint-initdb.d). A single idempotent file rather than a migration
-- tool: the schema is small, ships in one release, and a reviewer can read the
-- whole data model in one screen. See README "What I'd improve" for the point at
-- which this should become real migrations.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- areas: local mirror of the Notion database. Notion remains the source of
-- truth; this table exists so we can diff against the previous observation,
-- serve the dashboard without hitting Notion on every request, and keep history.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS areas (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notion_page_id         text        NOT NULL UNIQUE,
    notion_url             text,
    title                  text        NOT NULL,
    status                 text        NOT NULL,
    owner                  text,
    category               text,
    priority               text,
    notes                  text,
    blockers               text,
    notion_last_edited_at  timestamptz,

    -- sha256 over exactly the fields that feed the summary prompt. Drives the
    -- AI cache: unchanged hash means the cached summary is still valid.
    content_hash           text        NOT NULL,

    first_seen_at          timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS areas_status_idx ON areas (status);

-- ---------------------------------------------------------------------------
-- status_events: append-only audit trail of every observed status transition.
-- Doubles as the Slack idempotency record — an alert is attempted once per
-- event row, and its outcome is written back here, so a retried or overlapping
-- sync can never double-post.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_events (
    id            bigserial PRIMARY KEY,
    area_id       uuid        NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
    from_status   text,                      -- NULL on first observation
    to_status     text        NOT NULL,
    changed_at    timestamptz NOT NULL DEFAULT now(),

    -- 'pending' | 'sent' | 'skipped' | 'failed'
    -- 'skipped' covers both "not an alertable status" and "alerting disabled".
    alert_status  text        NOT NULL DEFAULT 'pending',
    alert_error   text,
    alerted_at    timestamptz
);

CREATE INDEX IF NOT EXISTS status_events_area_idx       ON status_events (area_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS status_events_changed_at_idx ON status_events (changed_at DESC);

-- ---------------------------------------------------------------------------
-- ai_summaries: the LLM cache.
--
-- The UNIQUE constraint *is* the caching strategy. A summary is regenerated only
-- when the prompt inputs change (content_hash) or the prompt itself changes
-- (prompt_version) -- not on a timer. A TTL would either burn tokens on
-- unchanged rows or serve stale text; a content hash is exact.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_summaries (
    id               bigserial PRIMARY KEY,
    area_id          uuid        NOT NULL REFERENCES areas (id) ON DELETE CASCADE,
    content_hash     text        NOT NULL,
    prompt_version   text        NOT NULL,

    summary          text        NOT NULL,
    risk_level       text,                   -- none | low | medium | high
    headline_blocker text,
    confidence       text,                   -- high | low

    provider         text        NOT NULL,
    model            text        NOT NULL,
    tokens_in        integer,
    tokens_out       integer,
    generated_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ai_summaries_cache_key UNIQUE (area_id, content_hash, prompt_version)
);

CREATE INDEX IF NOT EXISTS ai_summaries_area_idx ON ai_summaries (area_id, generated_at DESC);

-- ---------------------------------------------------------------------------
-- sync_runs: one row per poll cycle. Makes the cache observable -- the dashboard
-- surfaces summaries_cached vs summaries_generated, which is how you prove the
-- LLM is not being called on every request.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
    id                   bigserial PRIMARY KEY,
    started_at           timestamptz NOT NULL DEFAULT now(),
    finished_at          timestamptz,
    status               text        NOT NULL DEFAULT 'running',  -- running | ok | error
    trigger              text        NOT NULL DEFAULT 'schedule', -- schedule | manual | boot
    source               text,                                    -- notion | fixtures
    areas_seen           integer     NOT NULL DEFAULT 0,
    areas_changed        integer     NOT NULL DEFAULT 0,
    summaries_generated  integer     NOT NULL DEFAULT 0,
    summaries_cached     integer     NOT NULL DEFAULT 0,
    alerts_sent          integer     NOT NULL DEFAULT 0,
    error                text
);

CREATE INDEX IF NOT EXISTS sync_runs_started_at_idx ON sync_runs (started_at DESC);

-- ---------------------------------------------------------------------------
-- RAG corpus. Dimension is fixed at 384 to match the default embedding provider
-- (all-MiniLM-L6-v2, and the zero-dependency hash embedder that mirrors it).
-- Changing EMBEDDING_DIM requires recreating this table -- documented in README.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source     text        NOT NULL UNIQUE,   -- filename, so reseeding is idempotent
    title      text        NOT NULL,
    content    text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id            bigserial PRIMARY KEY,
    document_id   uuid        NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    chunk_index   integer     NOT NULL,
    content       text        NOT NULL,
    embedding     vector(384) NOT NULL,
    embed_model   text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT document_chunks_unique UNIQUE (document_id, chunk_index)
);

-- Cosine distance, matching the normalized embeddings both providers emit.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- integration_logs: append-only operational log of what each integration did,
-- in the same style as status_events / sync_runs. Powers the Logs page.
--
-- Deliberately additive: the Pino console logs remain the primary record. These
-- rows exist so the UI can show a filterable, per-integration trail without
-- shipping a log aggregator. Never store secrets here -- `url` is host + path
-- only, and `meta` carries small safe extras (model, tokens, a short error),
-- never API keys, webhook URLs, Authorization headers, or full bodies.
--
-- Retention is out of scope for this sample: the table grows unbounded. A real
-- deployment would add a TTL / partition-by-day drop, noted in README.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_logs (
    id           bigserial PRIMARY KEY,
    created_at   timestamptz NOT NULL DEFAULT now(),
    integration  text        NOT NULL,   -- notion | llm | slack | rag | http
    kind         text        NOT NULL,   -- api_call | sync | alert | error | info
    level        text        NOT NULL,   -- info | warn | error
    message      text        NOT NULL,
    method       text,
    url          text,                    -- host + path only, never secrets/query tokens
    status_code  integer,
    duration_ms  integer,
    sync_run_id  bigint      REFERENCES sync_runs (id) ON DELETE SET NULL,
    meta         jsonb                    -- small safe extras only (tokens, model, short error <=200 chars)
);

CREATE INDEX IF NOT EXISTS integration_logs_integration_idx ON integration_logs (integration, created_at DESC);
CREATE INDEX IF NOT EXISTS integration_logs_created_at_idx  ON integration_logs (created_at DESC);
