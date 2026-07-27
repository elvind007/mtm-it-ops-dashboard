import { config } from "@/config";
import { pool } from "@/db/pool";
import { listDashboardAreas, upsertArea } from "@/db/repositories/areas";
import { markAlertOutcome, recordStatusEvent } from "@/db/repositories/events";
import { insertIntegrationLog } from "@/db/repositories/integration-logs";
import { findCachedSummary, saveSummary } from "@/db/repositories/summaries";
import { finishSyncRun, startSyncRun } from "@/db/repositories/sync-runs";
import { logger } from "@/logger";
import { PROMPT_VERSION } from "@/providers/llm/prompts";
import { computeContentHash } from "@/services/content-hash";
import { createSummaryCache, enrichArea } from "@/services/enrichment";
import { hasStatusChanged, shouldAlert, type TransitionPolicy } from "@/services/transitions";
import type {
    Alerter,
    LlmProvider,
    NotionArea,
    NotionSource,
    SyncCounters,
    SyncTrigger,
} from "@/types";

const summaryCache = createSummaryCache(findCachedSummary, saveSummary);

export interface SyncDeps {
    source: NotionSource;
    llm: LlmProvider;
    alerter: Alerter;
}

export interface SyncOutcome extends SyncCounters {
    runId: string;
    source: string;
    skipped?: "locked";
    errors: number;
}

/**
 * Arbitrary but fixed key. Both the worker's timer and the API's "Sync now"
 * endpoint run this code in separate processes, so the mutual exclusion has to
 * live in Postgres rather than in-process. Without it, two concurrent runs could
 * each record a transition for the same change and post to Slack twice.
 */
const SYNC_ADVISORY_LOCK_KEY = 4_820_711;

export async function runSync(
    trigger: SyncTrigger,
    deps: SyncDeps,
): Promise<SyncOutcome> {
    const client = await pool.connect();

    try {
        const lock = await client.query<{ acquired: boolean }>(
            "SELECT pg_try_advisory_lock($1) AS acquired",
            [SYNC_ADVISORY_LOCK_KEY],
        );

        if (!lock.rows[0]?.acquired) {
            logger.info({ trigger }, "sync already in progress, skipping");
            return {
                runId: "",
                source: deps.source.kind,
                skipped: "locked",
                errors: 0,
                areasSeen: 0,
                areasChanged: 0,
                summariesGenerated: 0,
                summariesCached: 0,
                alertsSent: 0,
            };
        }

        try {
            return await executeSync(trigger, deps);
        } finally {
            await client.query("SELECT pg_advisory_unlock($1)", [SYNC_ADVISORY_LOCK_KEY]);
        }
    } finally {
        client.release();
    }
}

async function executeSync(trigger: SyncTrigger, deps: SyncDeps): Promise<SyncOutcome> {
    const { source, llm, alerter } = deps;
    const policy: TransitionPolicy = {
        alertStatuses: config.SLACK_ALERT_STATUSES,
        alertOnFirstSeen: config.ALERT_ON_FIRST_SEEN,
    };

    const runId = await startSyncRun(trigger, source.kind);
    const startedAt = Date.now();
    // Attributed to notion: a sync is fundamentally the Notion poll cycle, and the
    // Logs page surfaces it under the Notion tab alongside the HTTP calls it makes.
    void insertIntegrationLog({
        integration: "notion",
        kind: "sync",
        message: `sync started (${trigger}, source=${source.kind})`,
        syncRunId: runId,
        meta: { trigger, source: source.kind },
    });
    const counters: SyncCounters = {
        areasSeen: 0,
        areasChanged: 0,
        summariesGenerated: 0,
        summariesCached: 0,
        alertsSent: 0,
    };
    let errors = 0;

    try {
        const areas = await source.listAreas();
        counters.areasSeen = areas.length;

        for (const area of areas) {
            try {
                const contentHash = computeContentHash(area);
                const { areaId, previousStatus, previousContentHash } = await upsertArea(
                    area,
                    contentHash,
                );

                if (previousContentHash !== contentHash) counters.areasChanged += 1;

                // Record the transition before enriching, so the audit trail is
                // complete even if the LLM call fails.
                const statusChanged = hasStatusChanged(previousStatus, area.status);
                const alerting = shouldAlert(previousStatus, area.status, policy);
                const eventId = statusChanged
                    ? await recordStatusEvent(
                          areaId,
                          previousStatus,
                          area.status,
                          alerting ? "pending" : "skipped",
                      )
                    : null;

                const enriched = await enrichArea(
                    areaId,
                    area,
                    contentHash,
                    previousStatus,
                    PROMPT_VERSION,
                    llm,
                    summaryCache,
                );
                if (enriched.fromCache) counters.summariesCached += 1;
                else counters.summariesGenerated += 1;
                const summary = enriched.summary;

                if (eventId && alerting) {
                    await dispatchAlert(runId, eventId, area, previousStatus, summary, alerter, llm, counters);
                }
            } catch (err) {
                // One bad area must not abandon the rest of the sync.
                errors += 1;
                logger.error(
                    { err, area: area.title, notionPageId: area.notionPageId },
                    "failed to sync area",
                );
            }
        }

        await finishSyncRun(runId, counters);
        logger.info({ trigger, ...counters, errors }, "sync complete");
        void insertIntegrationLog({
            integration: "notion",
            kind: "sync",
            level: errors > 0 ? "warn" : "info",
            message: `sync complete: ${counters.areasSeen} seen, ${counters.areasChanged} changed, ${counters.summariesGenerated} generated, ${counters.summariesCached} cached, ${counters.alertsSent} alerts, ${errors} errors`,
            durationMs: Date.now() - startedAt,
            syncRunId: runId,
            meta: { ...counters, errors },
        });

        return { runId, source: source.kind, errors, ...counters };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await finishSyncRun(runId, counters, message);
        logger.error({ err, trigger }, "sync failed");
        void insertIntegrationLog({
            integration: "notion",
            kind: "error",
            level: "error",
            message: `sync failed: ${message}`,
            durationMs: Date.now() - startedAt,
            syncRunId: runId,
            meta: { error: message.slice(0, 200) },
        });
        throw err;
    }
}

async function dispatchAlert(
    runId: string,
    eventId: string,
    area: NotionArea,
    previousStatus: string | null,
    summary: string | null,
    alerter: Alerter,
    llm: LlmProvider,
    counters: SyncCounters,
): Promise<void> {
    if (!alerter.enabled) {
        await markAlertOutcome(eventId, "skipped");
        void insertIntegrationLog({
            integration: "slack",
            kind: "alert",
            message: `alert skipped (disabled) — ${area.title} → ${area.status}`,
            syncRunId: runId,
        });
        return;
    }

    try {
        await alerter.send({
            areaTitle: area.title,
            fromStatus: previousStatus,
            toStatus: area.status,
            owner: area.owner,
            category: area.category,
            priority: area.priority,
            summary,
            notionUrl: area.notionUrl,
            model: llm.model,
            providerKind: llm.kind,
        });
        await markAlertOutcome(eventId, "sent");
        counters.alertsSent += 1;
        void insertIntegrationLog({
            integration: "slack",
            kind: "alert",
            message: `alert sent — ${area.title} → ${area.status}`,
            syncRunId: runId,
        });
    } catch (err) {
        // A Slack outage must not fail the sync; the failure is recorded on the
        // event row so it is visible in the Activity feed.
        const message = err instanceof Error ? err.message : String(err);
        await markAlertOutcome(eventId, "failed", message);
        logger.error({ err, area: area.title }, "slack alert failed");
        void insertIntegrationLog({
            integration: "slack",
            kind: "error",
            level: "error",
            message: `alert failed — ${area.title} → ${area.status}: ${message}`,
            syncRunId: runId,
            meta: { error: message.slice(0, 200) },
        });
    }
}

export { listDashboardAreas };
