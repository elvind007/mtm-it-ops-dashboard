import type { CachedSummary } from "@/db/repositories/summaries";
import type { LlmProvider, NotionArea, SummaryInput, SummaryResult } from "@/types";

/**
 * The persistence surface enrichment needs, as a port.
 *
 * Narrowing it to two methods lets the caching behaviour — the requirement that
 * the LLM is not called on every request — be tested with a fake and a call
 * counter, rather than needing a live Postgres.
 */
export interface SummaryCache {
    find(
        areaId: string,
        contentHash: string,
        promptVersion: string,
    ): Promise<CachedSummary | null>;
    save(
        areaId: string,
        contentHash: string,
        promptVersion: string,
        provider: string,
        model: string,
        result: SummaryResult,
    ): Promise<void>;
}

export interface EnrichmentOutcome {
    summary: string | null;
    /** True when the cache was hit and no LLM call was made. */
    fromCache: boolean;
}

export function toSummaryInput(
    area: NotionArea,
    previousStatus: string | null,
    previousStatusChangedAt: string | null = null,
): SummaryInput {
    return {
        title: area.title,
        status: area.status,
        owner: area.owner,
        category: area.category,
        priority: area.priority,
        notes: area.notes,
        blockers: area.blockers,
        notionLastEditedAt: area.notionLastEditedAt,
        previousStatus,
        previousStatusChangedAt,
    };
}

/**
 * Returns an area's summary, generating it only on a cache miss.
 *
 * The cache key is (area, content hash, prompt version). A hit means neither the
 * source content nor the prompt has changed since the text was produced, so it is
 * still exactly what the model would say now — which is why this is a content
 * hash and not a TTL. On a steady-state sync every area takes the cached path and
 * the run makes zero LLM calls.
 */
export async function enrichArea(
    areaId: string,
    area: NotionArea,
    contentHash: string,
    previousStatus: string | null,
    promptVersion: string,
    llm: LlmProvider,
    cache: SummaryCache,
): Promise<EnrichmentOutcome> {
    const cached = await cache.find(areaId, contentHash, promptVersion);
    if (cached) {
        return { summary: cached.summary, fromCache: true };
    }

    const result = await llm.summarizeArea(toSummaryInput(area, previousStatus));
    await cache.save(areaId, contentHash, promptVersion, llm.kind, llm.model, result);

    return { summary: result.summary, fromCache: false };
}

/** Default port implementation, backed by the ai_summaries table. */
export function createSummaryCache(
    find: SummaryCache["find"],
    save: SummaryCache["save"],
): SummaryCache {
    return { find, save };
}
