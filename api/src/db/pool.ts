import pg from "pg";

import { config } from "@/config";
import { logger } from "@/logger";

export const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
    logger.error({ err }, "idle postgres client error");
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
): Promise<pg.QueryResult<T>> {
    return pool.query<T>(text, params as never[]);
}

/**
 * The postgres container is usually still initializing when the API starts, so
 * wait for it rather than crash-looping the whole compose stack.
 */
export async function waitForDatabase(attempts = 30, delayMs = 2_000): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            await pool.query("SELECT 1");
            logger.info("connected to postgres");
            return;
        } catch (err) {
            if (attempt === attempts) throw err;
            logger.warn({ attempt, attempts }, "postgres not ready, retrying");
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

export async function closeDatabase(): Promise<void> {
    await pool.end();
}
