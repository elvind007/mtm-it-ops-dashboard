import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type { NotionArea, NotionSource } from "@/types";

const FIXTURES_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "fixtures",
    "areas.json",
);

/** Zero-config fallback: the bundled seed areas, no Notion credentials required. */
export class FixtureSource implements NotionSource {
    readonly kind = "fixtures" as const;

    private cached: NotionArea[] | null = null;

    async listAreas(): Promise<NotionArea[]> {
        if (!this.cached) {
            const raw = await readFile(FIXTURES_PATH, "utf-8");
            this.cached = JSON.parse(raw) as NotionArea[];
        }
        // Defensive copy -- callers must not be able to mutate the shared cache.
        return this.cached.map((area) => ({ ...area }));
    }
}
