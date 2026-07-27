import { config } from "@/config";
import { closeDatabase, waitForDatabase } from "@/db/pool";
import { logger } from "@/logger";
import { seedRagCorpus } from "@/services/rag/seed";

// Thin CLI wrapper around the shared seed path (`seedRagCorpus`), so `npm run
// seed:rag` and the worker's boot-time auto-seed cannot diverge.
async function main(): Promise<void> {
    if (!config.RAG_ENABLED) {
        logger.warn("RAG_ENABLED=false; seeding anyway so the corpus is ready if it is turned on");
    }

    await waitForDatabase();
    await seedRagCorpus();
    await closeDatabase();
}

main().catch((err) => {
    logger.fatal({ err }, "RAG seed failed");
    process.exitCode = 1;
    void closeDatabase();
});
