import { createApp } from "@/app";
import { config } from "@/config";
import { closeDatabase, waitForDatabase } from "@/db/pool";
import { logger } from "@/logger";

async function main(): Promise<void> {
    await waitForDatabase();

    const server = createApp().listen(config.API_PORT, () => {
        logger.info(
            {
                port: config.API_PORT,
                notion: config.notionEnabled ? "live" : "fixtures",
                llm: config.llmEnabled ? `${config.LLM_PROVIDER}/${config.LLM_MODEL}` : "mock",
                slack: config.slackEnabled ? "live" : "disabled",
            },
            "api listening",
        );
    });

    const shutdown = (signal: string) => {
        logger.info({ signal }, "shutting down");
        server.close(() => {
            void closeDatabase().finally(() => process.exit(0));
        });
        // Don't let a hung connection hold the container open forever.
        setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
    logger.fatal({ err }, "api failed to start");
    process.exit(1);
});
