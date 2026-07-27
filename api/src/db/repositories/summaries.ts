import { query } from "@/db/pool";
import type { SummaryResult } from "@/types";

export interface CachedSummary {
    summary: string;
    riskLevel: string | null;
    headlineBlocker: string | null;
    confidence: string | null;
    provider: string;
    model: string;
    generatedAt: string;
}

/**
 * Cache lookup.
 *
 * Keyed on (area, content hash, prompt version) — the same triple as the UNIQUE
 * constraint in db/init.sql. A hit means neither the source content nor the prompt
 * has changed since this text was produced, so it is still exactly what the model
 * would say now.
 */
export async function findCachedSummary(
    areaId: string,
    contentHash: string,
    promptVersion: string,
): Promise<CachedSummary | null> {
    const { rows } = await query<Record<string, unknown>>(
        `SELECT summary, risk_level, headline_blocker, confidence,
                provider, model, generated_at
         FROM ai_summaries
         WHERE area_id = $1 AND content_hash = $2 AND prompt_version = $3
         ORDER BY generated_at DESC
         LIMIT 1`,
        [areaId, contentHash, promptVersion],
    );

    const row = rows[0];
    if (!row) return null;

    return {
        summary: row.summary as string,
        riskLevel: (row.risk_level as string | null) ?? null,
        headlineBlocker: (row.headline_blocker as string | null) ?? null,
        confidence: (row.confidence as string | null) ?? null,
        provider: row.provider as string,
        model: row.model as string,
        generatedAt:
            row.generated_at instanceof Date
                ? row.generated_at.toISOString()
                : String(row.generated_at),
    };
}

export async function saveSummary(
    areaId: string,
    contentHash: string,
    promptVersion: string,
    provider: string,
    model: string,
    result: SummaryResult,
): Promise<void> {
    // DO UPDATE rather than DO NOTHING so a concurrent sync that raced us still
    // leaves the newest text in place instead of silently discarding it.
    await query(
        `INSERT INTO ai_summaries (
             area_id, content_hash, prompt_version, summary, risk_level,
             headline_blocker, confidence, provider, model, tokens_in, tokens_out
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT ON CONSTRAINT ai_summaries_cache_key DO UPDATE SET
             summary          = EXCLUDED.summary,
             risk_level       = EXCLUDED.risk_level,
             headline_blocker = EXCLUDED.headline_blocker,
             confidence       = EXCLUDED.confidence,
             provider         = EXCLUDED.provider,
             model            = EXCLUDED.model,
             tokens_in        = EXCLUDED.tokens_in,
             tokens_out       = EXCLUDED.tokens_out,
             generated_at     = now()`,
        [
            areaId,
            contentHash,
            promptVersion,
            result.summary,
            result.riskLevel,
            result.headlineBlocker,
            result.confidence,
            provider,
            model,
            result.tokensIn,
            result.tokensOut,
        ],
    );
}
