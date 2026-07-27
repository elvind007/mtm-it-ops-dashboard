import type { NotionSource } from "@/types";
import { config } from "@/config";
import { logger } from "@/logger";
import { NotionClient } from "@/providers/notion/notion-client";
import { FixtureSource } from "@/providers/notion/fixtures-source";

/** Selects the live Notion API or the bundled fixtures based on `config.notionEnabled`. */
export function createNotionSource(): NotionSource {
    const source: NotionSource = config.notionEnabled ? new NotionClient() : new FixtureSource();
    logger.info({ source: source.kind }, "Notion source selected");
    return source;
}
