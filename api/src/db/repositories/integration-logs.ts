import { query } from "@/db/pool";
import { logger } from "@/logger";

/** The integrations we attribute a log line to. Kept as a string in the DB so a
 *  new source never needs a migration, but narrowed here for call-site safety. */
export type LogIntegration = "notion" | "llm" | "slack" | "rag" | "http";
export type LogKind = "api_call" | "sync" | "alert" | "error" | "info";
export type LogLevel = "info" | "warn" | "error";

export interface IntegrationLogInput {
    integration: LogIntegration;
    kind: LogKind;
    level?: LogLevel;
    message: string;
    method?: string | null;
    url?: string | null;
    statusCode?: number | null;
    durationMs?: number | null;
    /** sync_runs.id, when the line belongs to a specific poll cycle. */
    syncRunId?: string | null;
    /** Small safe extras only -- model, tokens, a short error. Never secrets. */
    meta?: Record<string, unknown> | null;
}

export interface IntegrationLogRow {
    id: string;
    createdAt: string;
    integration: string;
    kind: string;
    level: string;
    message: string;
    method: string | null;
    url: string | null;
    statusCode: number | null;
    durationMs: number | null;
    syncRunId: string | null;
    meta: Record<string, unknown> | null;
}

const MAX_MESSAGE_CHARS = 500;

/**
 * Reduces a URL to host + path, dropping the query string and fragment.
 *
 * Query strings are where tokens hide (`?token=…`, `?sig=…`), so they never reach
 * the log. Pure and side-effect free so it can be unit-tested directly; tolerates
 * a relative path or a non-URL string by stripping everything from the first `?`.
 */
export function sanitizeUrl(raw: string): string {
    try {
        const u = new URL(raw);
        return `${u.host}${u.pathname}`;
    } catch {
        const noHash = raw.split("#", 1)[0] ?? raw;
        return noHash.split("?", 1)[0] ?? noHash;
    }
}

function truncate(value: string, max: number): string {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * Best-effort insert. A logging failure must never break the thing it is logging,
 * so every error is swallowed with a warn -- callers can `void` this in hot paths.
 */
export async function insertIntegrationLog(entry: IntegrationLogInput): Promise<void> {
    try {
        await query(
            `INSERT INTO integration_logs
                 (integration, kind, level, message, method, url, status_code, duration_ms, sync_run_id, meta)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
            [
                entry.integration,
                entry.kind,
                entry.level ?? "info",
                truncate(entry.message, MAX_MESSAGE_CHARS),
                entry.method ?? null,
                entry.url ?? null,
                entry.statusCode ?? null,
                entry.durationMs ?? null,
                entry.syncRunId ?? null,
                entry.meta ? JSON.stringify(entry.meta) : null,
            ],
        );
    } catch (err) {
        logger.warn({ err, integration: entry.integration }, "failed to write integration log");
    }
}

export interface ListIntegrationLogsParams {
    integration?: string;
    level?: string;
    limit: number;
}

export async function listIntegrationLogs({
    integration,
    level,
    limit,
}: ListIntegrationLogsParams): Promise<IntegrationLogRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (integration) {
        params.push(integration);
        conditions.push(`integration = $${params.length}`);
    }
    if (level) {
        params.push(level);
        conditions.push(`level = $${params.length}`);
    }

    params.push(limit);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query<Record<string, unknown>>(
        `SELECT id, created_at, integration, kind, level, message,
                method, url, status_code, duration_ms, sync_run_id, meta
         FROM integration_logs
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
    );

    return rows.map((r) => ({
        id: String(r.id),
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        integration: r.integration as string,
        kind: r.kind as string,
        level: r.level as string,
        message: r.message as string,
        method: (r.method as string | null) ?? null,
        url: (r.url as string | null) ?? null,
        statusCode: r.status_code === null ? null : Number(r.status_code),
        durationMs: r.duration_ms === null ? null : Number(r.duration_ms),
        syncRunId: r.sync_run_id === null ? null : String(r.sync_run_id),
        meta: (r.meta as Record<string, unknown> | null) ?? null,
    }));
}
