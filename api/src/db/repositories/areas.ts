import { query } from "@/db/pool";
import type { NotionArea } from "@/types";

export interface UpsertResult {
    areaId: string;
    /** Null when this area had never been observed before. */
    previousStatus: string | null;
    previousContentHash: string | null;
    isNew: boolean;
}

/**
 * Writes the observed Notion state and reports what it replaced.
 *
 * The caller needs the *previous* status and content hash to decide whether to
 * alert and whether to re-summarize, so the read happens before the write rather
 * than relying on RETURNING (which yields post-update values).
 */
export async function upsertArea(
    area: NotionArea,
    contentHash: string,
): Promise<UpsertResult> {
    const existing = await query<{ id: string; status: string; content_hash: string }>(
        "SELECT id, status, content_hash FROM areas WHERE notion_page_id = $1",
        [area.notionPageId],
    );

    const previous = existing.rows[0] ?? null;

    const upserted = await query<{ id: string }>(
        `INSERT INTO areas (
             notion_page_id, notion_url, title, status, owner, category, priority,
             notes, blockers, notion_last_edited_at, content_hash, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (notion_page_id) DO UPDATE SET
             notion_url            = EXCLUDED.notion_url,
             title                 = EXCLUDED.title,
             status                = EXCLUDED.status,
             owner                 = EXCLUDED.owner,
             category              = EXCLUDED.category,
             priority              = EXCLUDED.priority,
             notes                 = EXCLUDED.notes,
             blockers              = EXCLUDED.blockers,
             notion_last_edited_at = EXCLUDED.notion_last_edited_at,
             content_hash          = EXCLUDED.content_hash,
             updated_at            = now()
         RETURNING id`,
        [
            area.notionPageId,
            area.notionUrl,
            area.title,
            area.status,
            area.owner,
            area.category,
            area.priority,
            area.notes,
            area.blockers,
            area.notionLastEditedAt,
            contentHash,
        ],
    );

    const row = upserted.rows[0];
    if (!row) throw new Error(`upsert of area ${area.notionPageId} returned no row`);

    return {
        areaId: row.id,
        previousStatus: previous?.status ?? null,
        previousContentHash: previous?.content_hash ?? null,
        isNew: previous === null,
    };
}

export interface DashboardArea {
    id: string;
    notionPageId: string;
    notionUrl: string | null;
    title: string;
    status: string;
    owner: string | null;
    category: string | null;
    priority: string | null;
    notes: string | null;
    blockers: string | null;
    notionLastEditedAt: string | null;
    updatedAt: string;
    summary: {
        text: string;
        riskLevel: string | null;
        headlineBlocker: string | null;
        confidence: string | null;
        provider: string;
        model: string;
        generatedAt: string;
        /** True when this summary predates the current sync, i.e. it was served from cache. */
        cached: boolean;
    } | null;
    lastChange: {
        fromStatus: string | null;
        toStatus: string;
        changedAt: string;
        alertStatus: string;
    } | null;
}

/**
 * Dashboard payload: every area with the summary matching its *current* content
 * hash, plus its most recent transition.
 *
 * The summary join is on `content_hash`, so a card whose Notion content changed
 * since the last enrichment correctly shows no summary rather than a stale one.
 * Ordered by operational urgency, not alphabetically -- Blocked first is what a
 * reader scanning the board actually wants.
 *
 * `cached` is derived rather than stored: a summary generated before the most
 * recent successful sync started is one that sync reused instead of regenerating.
 * That is what the UI's "cached" chip reports, so the badge cannot drift from
 * what actually happened.
 */
export async function listDashboardAreas(): Promise<DashboardArea[]> {
    const { rows } = await query<Record<string, unknown>>(
        `WITH last_run AS (
             SELECT started_at
             FROM sync_runs
             WHERE status = 'ok'
             ORDER BY started_at DESC
             LIMIT 1
         )
         SELECT
             a.id, a.notion_page_id, a.notion_url, a.title, a.status, a.owner,
             a.category, a.priority, a.notes, a.blockers,
             a.notion_last_edited_at, a.updated_at,
             s.summary, s.risk_level, s.headline_blocker, s.confidence,
             s.provider, s.model, s.generated_at,
             COALESCE(s.generated_at < (SELECT started_at FROM last_run), false) AS cached,
             e.from_status, e.to_status, e.changed_at, e.alert_status
         FROM areas a
         LEFT JOIN LATERAL (
             SELECT * FROM ai_summaries s
             WHERE s.area_id = a.id AND s.content_hash = a.content_hash
             ORDER BY s.generated_at DESC
             LIMIT 1
         ) s ON true
         LEFT JOIN LATERAL (
             SELECT * FROM status_events e
             WHERE e.area_id = a.id
             ORDER BY e.changed_at DESC
             LIMIT 1
         ) e ON true
         ORDER BY
             CASE a.status
                 WHEN 'Blocked'  THEN 0
                 WHEN 'At Risk'  THEN 1
                 WHEN 'On Track' THEN 2
                 WHEN 'Done'     THEN 3
                 ELSE 4
             END,
             COALESCE(a.priority, 'P9'),
             a.title`,
    );

    return rows.map((r) => ({
        id: r.id as string,
        notionPageId: r.notion_page_id as string,
        notionUrl: (r.notion_url as string | null) ?? null,
        title: r.title as string,
        status: r.status as string,
        owner: (r.owner as string | null) ?? null,
        category: (r.category as string | null) ?? null,
        priority: (r.priority as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        blockers: (r.blockers as string | null) ?? null,
        notionLastEditedAt: toIso(r.notion_last_edited_at),
        updatedAt: toIso(r.updated_at) ?? new Date(0).toISOString(),
        summary: r.summary
            ? {
                  text: r.summary as string,
                  riskLevel: (r.risk_level as string | null) ?? null,
                  headlineBlocker: (r.headline_blocker as string | null) ?? null,
                  confidence: (r.confidence as string | null) ?? null,
                  provider: r.provider as string,
                  model: r.model as string,
                  generatedAt: toIso(r.generated_at) ?? new Date(0).toISOString(),
                  cached: r.cached === true,
              }
            : null,
        lastChange: r.to_status
            ? {
                  fromStatus: (r.from_status as string | null) ?? null,
                  toStatus: r.to_status as string,
                  changedAt: toIso(r.changed_at) ?? new Date(0).toISOString(),
                  alertStatus: r.alert_status as string,
              }
            : null,
    }));
}

function toIso(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return null;
}
