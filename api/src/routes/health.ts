import { Router } from "express";

import { config } from "@/config";
import { query } from "@/db/pool";
import { asyncHandler } from "@/http/async-handler";

export const healthRouter: Router = Router();

/**
 * Reports which implementation each integration resolved to at boot. The UI renders
 * these as badges, so the running mode is visible on screen rather than something
 * you infer from the logs -- which matters when the same build runs with and
 * without credentials.
 */
healthRouter.get(
    "/health",
    asyncHandler(async (_req, res) => {
        let database: "up" | "down" = "up";
        try {
            await query("SELECT 1");
        } catch {
            database = "down";
        }

        res.status(database === "up" ? 200 : 503).json({
            status: database === "up" ? "ok" : "degraded",
            database,
            integrations: {
                notion: {
                    mode: config.notionEnabled ? "live" : "fixtures",
                    detail: config.notionEnabled
                        ? "Notion API"
                        : "bundled fixtures (no NOTION_API_KEY)",
                },
                llm: {
                    mode: config.llmEnabled ? "live" : "mock",
                    provider: config.llmEnabled ? config.LLM_PROVIDER : "mock",
                    model: config.llmEnabled ? config.LLM_MODEL : "mock-summarizer",
                },
                slack: {
                    mode: config.slackEnabled ? "live" : "disabled",
                    alertOn: config.SLACK_ALERT_STATUSES,
                },
                rag: {
                    mode: config.RAG_ENABLED ? "enabled" : "disabled",
                    embeddingProvider: config.EMBEDDING_PROVIDER,
                    embeddingModel: config.EMBEDDING_MODEL,
                },
            },
        });
    }),
);
