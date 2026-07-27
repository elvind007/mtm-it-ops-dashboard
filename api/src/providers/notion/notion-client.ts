import type { NotionArea, NotionSource } from "@/types";
import { config } from "@/config";
import { insertIntegrationLog, sanitizeUrl } from "@/db/repositories/integration-logs";
import { logger } from "@/logger";
import { mapNotionPage } from "@/providers/notion/mapper";

const NOTION_API_BASE = "https://api.notion.com/v1";
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

interface NotionQueryResponse {
    results: unknown[];
    has_more: boolean;
    next_cursor: string | null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

async function readErrorText(response: Response): Promise<string | null> {
    try {
        const text = await response.text();
        return text.length > 0 ? text : null;
    } catch {
        return null;
    }
}

/** `Retry-After` is seconds per HTTP spec; fall back to our own backoff when absent/unparseable. */
function retryDelayMs(response: Response, attempt: number): number {
    const header = response.headers.get("retry-after");
    const headerMs = header ? Number(header) * 1000 : NaN;
    if (!Number.isNaN(headerMs) && headerMs >= 0) return headerMs;
    return BASE_DELAY_MS * 2 ** (attempt - 1);
}

/**
 * Talks to the real Notion API. Pagination and retry live here rather than in
 * `listAreas` so the public method reads as "fetch everything", not "fetch, and
 * also mind HTTP mechanics".
 */
export class NotionClient implements NotionSource {
    readonly kind = "notion" as const;

    private readonly apiKey: string;
    private readonly databaseId: string;
    private readonly notionVersion: string;

    constructor() {
        if (!config.NOTION_API_KEY || !config.NOTION_DATABASE_ID) {
            throw new Error(
                "NotionClient requires both NOTION_API_KEY and NOTION_DATABASE_ID to be set.",
            );
        }
        this.apiKey = config.NOTION_API_KEY;
        this.databaseId = config.NOTION_DATABASE_ID;
        this.notionVersion = config.NOTION_VERSION;
    }

    async listAreas(): Promise<NotionArea[]> {
        const pages: unknown[] = [];
        let cursor: string | undefined;

        do {
            const page = await this.queryOnce(cursor);
            pages.push(...page.results);
            cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined;
        } while (cursor);

        const areas: NotionArea[] = [];
        for (const raw of pages) {
            const area = mapNotionPage(raw);
            if (area) areas.push(area);
        }
        return areas;
    }

    private async queryOnce(startCursor: string | undefined): Promise<NotionQueryResponse> {
        const url = `${NOTION_API_BASE}/databases/${this.databaseId}/query`;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const startedAt = Date.now();
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    // Never log this header -- it's the bearer credential.
                    Authorization: `Bearer ${this.apiKey}`,
                    "Notion-Version": this.notionVersion,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(startCursor ? { start_cursor: startCursor } : {}),
            });

            void insertIntegrationLog({
                integration: "notion",
                kind: response.ok ? "api_call" : "error",
                level: response.ok ? "info" : "warn",
                message: `POST databases/query → ${response.status}${attempt > 1 ? ` (attempt ${attempt})` : ""}`,
                method: "POST",
                // sanitizeUrl strips the query string; the database id in the path stays.
                url: sanitizeUrl(url),
                statusCode: response.status,
                durationMs: Date.now() - startedAt,
            });

            if (response.ok) {
                return (await response.json()) as NotionQueryResponse;
            }

            if (response.status === 404) {
                throw new Error(
                    `Notion database query returned 404 for database ${this.databaseId}. ` +
                        "This almost always means the database has not been shared with the " +
                        "integration -- see docs/SETUP-NOTION-SLACK.md section 2.4.",
                );
            }

            const canRetry = isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS;
            if (!canRetry) {
                const detail = await readErrorText(response);
                throw new Error(
                    `Notion API request failed with status ${response.status}` +
                        (detail ? `: ${detail}` : ""),
                );
            }

            const delayMs = retryDelayMs(response, attempt);
            logger.warn(
                { status: response.status, attempt, delayMs },
                "Notion API request failed, retrying",
            );
            await sleep(delayMs);
        }

        // Unreachable: the loop above always either returns or throws.
        throw new Error("Notion API request failed after retries");
    }
}
