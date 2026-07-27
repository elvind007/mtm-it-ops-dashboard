import { query } from "@/db/pool";
import type { SyncCounters, SyncTrigger } from "@/types";

export interface SyncRunRow {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    trigger: string;
    source: string | null;
    areasSeen: number;
    areasChanged: number;
    summariesGenerated: number;
    summariesCached: number;
    alertsSent: number;
    error: string | null;
}

export async function startSyncRun(
    trigger: SyncTrigger,
    source: string,
): Promise<string> {
    const { rows } = await query<{ id: string }>(
        `INSERT INTO sync_runs (trigger, source) VALUES ($1, $2) RETURNING id`,
        [trigger, source],
    );
    const row = rows[0];
    if (!row) throw new Error("failed to start sync run");
    return row.id;
}

export async function finishSyncRun(
    id: string,
    counters: SyncCounters,
    error?: string,
): Promise<void> {
    await query(
        `UPDATE sync_runs
         SET finished_at         = now(),
             status              = $2,
             areas_seen          = $3,
             areas_changed       = $4,
             summaries_generated = $5,
             summaries_cached    = $6,
             alerts_sent         = $7,
             error               = $8
         WHERE id = $1`,
        [
            id,
            error ? "error" : "ok",
            counters.areasSeen,
            counters.areasChanged,
            counters.summariesGenerated,
            counters.summariesCached,
            counters.alertsSent,
            error ?? null,
        ],
    );
}

export async function listSyncRuns(limit: number): Promise<SyncRunRow[]> {
    const { rows } = await query<Record<string, unknown>>(
        `SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT $1`,
        [limit],
    );

    return rows.map((r) => ({
        id: String(r.id),
        startedAt: iso(r.started_at) ?? new Date(0).toISOString(),
        finishedAt: iso(r.finished_at),
        status: r.status as string,
        trigger: r.trigger as string,
        source: (r.source as string | null) ?? null,
        areasSeen: Number(r.areas_seen ?? 0),
        areasChanged: Number(r.areas_changed ?? 0),
        summariesGenerated: Number(r.summaries_generated ?? 0),
        summariesCached: Number(r.summaries_cached ?? 0),
        alertsSent: Number(r.alerts_sent ?? 0),
        error: (r.error as string | null) ?? null,
    }));
}

function iso(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return null;
}
