import { config } from "@/config";
import { getAlerter, getLlmProvider, getNotionSource } from "@/container";
import { closeDatabase, waitForDatabase } from "@/db/pool";
import { logger } from "@/logger";
import { runSync } from "@/services/sync";
import type { SyncTrigger } from "@/types";

/**
 * Notion poll loop.
 *
 * Runs as its own process so LLM and Slack calls never sit on a user's request
 * path. Polling rather than Notion webhooks is deliberate: webhooks need a public
 * URL and a verification handshake, which is hostile to a local Docker demo.
 * Trade-off is up to SYNC_INTERVAL_MS of latency, and the dashboard's "Sync now"
 * button exists to close that gap on demand.
 */

let stopping = false;
let activeSync: Promise<unknown> | null = null;

async function tick(trigger: SyncTrigger): Promise<void> {
    if (stopping) return;

    activeSync = runSync(trigger, {
        source: getNotionSource(),
        llm: getLlmProvider(),
        alerter: getAlerter(),
    });

    try {
        await activeSync;
    } catch (err) {
        // Never let a failed cycle kill the loop: Notion or the LLM being down is
        // a transient condition, and the next tick should still try.
        logger.error({ err }, "sync cycle failed");
    } finally {
        activeSync = null;
    }
}

async function main(): Promise<void> {
    await waitForDatabase();

    logger.info(
        {
            intervalMs: config.SYNC_INTERVAL_MS,
            syncOnBoot: config.SYNC_ON_BOOT,
            source: config.notionEnabled ? "notion" : "fixtures",
        },
        "worker started",
    );

    if (config.SYNC_ON_BOOT) await tick("boot");

    const timer = setInterval(() => {
        void tick("schedule");
    }, config.SYNC_INTERVAL_MS);

    const shutdown = async (signal: string) => {
        if (stopping) return;
        stopping = true;
        logger.info({ signal }, "worker shutting down");
        clearInterval(timer);

        // Let an in-flight cycle finish so we don't leave a sync_run row hanging
        // in 'running' forever.
        if (activeSync) await activeSync.catch(() => undefined);

        await closeDatabase();
        process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
    logger.fatal({ err }, "worker failed to start");
    process.exit(1);
});
