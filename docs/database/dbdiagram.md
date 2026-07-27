// IT Ops Dashboard — from db/init.sql
// Paste into https://dbdiagram.io

Table areas {
  id uuid [pk, default: `gen_random_uuid()`]
  notion_page_id text [not null, unique, note: 'Notion source of truth']
  notion_url text
  title text [not null]
  status text [not null]
  owner text
  category text
  priority text
  notes text
  blockers text
  notion_last_edited_at timestamptz
  content_hash text [not null, note: 'sha256 of summary prompt inputs']
  first_seen_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  Note: 'Local mirror of Notion DB. Diff + dashboard serve + history.'
}

Table status_events {
  id bigserial [pk]
  area_id uuid [not null]
  from_status text [note: 'NULL on first observation']
  to_status text [not null]
  changed_at timestamptz [not null, default: `now()`]
  alert_status text [not null, default: 'pending', note: 'pending | sent | skipped | failed']
  alert_error text
  alerted_at timestamptz

  Note: 'Append-only status transitions; also Slack alert idempotency.'
}

Table ai_summaries {
  id bigserial [pk]
  area_id uuid [not null]
  content_hash text [not null]
  prompt_version text [not null]
  summary text [not null]
  risk_level text [note: 'none | low | medium | high']
  headline_blocker text
  confidence text [note: 'high | low']
  provider text [not null]
  model text [not null]
  tokens_in integer
  tokens_out integer
  generated_at timestamptz [not null, default: `now()`]

  indexes {
    (area_id, content_hash, prompt_version) [unique, name: 'ai_summaries_cache_key']
  }

  Note: 'LLM cache. Regenerate only when content_hash or prompt_version changes.'
}

Table sync_runs {
  id bigserial [pk]
  started_at timestamptz [not null, default: `now()`]
  finished_at timestamptz
  status text [not null, default: 'running', note: 'running | ok | error']
  trigger text [not null, default: 'schedule', note: 'schedule | manual | boot']
  source text [note: 'notion | fixtures']
  areas_seen integer [not null, default: 0]
  areas_changed integer [not null, default: 0]
  summaries_generated integer [not null, default: 0]
  summaries_cached integer [not null, default: 0]
  alerts_sent integer [not null, default: 0]
  error text

  Note: 'One row per poll cycle; makes LLM cache hit/miss observable.'
}

Table documents {
  id uuid [pk, default: `gen_random_uuid()`]
  source text [not null, unique, note: 'filename — reseeding is idempotent']
  title text [not null]
  content text [not null]
  created_at timestamptz [not null, default: `now()`]

  Note: 'RAG corpus source documents.'
}

Table document_chunks {
  id bigserial [pk]
  document_id uuid [not null]
  chunk_index integer [not null]
  content text [not null]
  embedding vector(384) [not null, note: 'matches all-MiniLM-L6-v2 / hash embedder']
  embed_model text [not null]
  created_at timestamptz [not null, default: `now()`]

  indexes {
    (document_id, chunk_index) [unique, name: 'document_chunks_unique']
  }

  Note: 'Chunked embeddings; HNSW cosine index in Postgres (pgvector).'
}

Ref: status_events.area_id > areas.id [delete: cascade]
Ref: ai_summaries.area_id > areas.id [delete: cascade]
Ref: document_chunks.document_id > documents.id [delete: cascade]