import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "@/config";
import { logger } from "@/logger";
import { createEmbeddingProvider } from "@/providers/embeddings";
import { chunkDocument } from "@/services/rag/chunker";
import { countChunks, upsertDocument } from "@/services/rag/repository";

/**
 * Seeding the RAG corpus, extracted so both the `seed:rag` script and the worker's
 * boot-time auto-seed share exactly one code path -- the auto-seed can never drift
 * from what the manual command does.
 */

// Module-relative default so a local `npm run seed:rag` works from any cwd. In the
// container the docs are mounted at a stable path and RAG_SEED_DIR points there,
// because the image itself only copies src/.
const DEFAULT_SEED_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "docs",
    "seed",
);

function seedDir(): string {
    return config.RAG_SEED_DIR ?? DEFAULT_SEED_DIR;
}

function deriveTitle(markdown: string, fallback: string): string {
    const heading = markdown.split("\n").find((line) => line.startsWith("# "));
    return heading ? heading.replace(/^#\s+/, "").trim() : fallback;
}

/** Chunks and embeds every seed document into pgvector. Idempotent on filename. */
export async function seedRagCorpus(): Promise<{ documents: number; chunks: number }> {
    const dir = seedDir();
    const embedder = createEmbeddingProvider();
    logger.info(
        { provider: embedder.kind, model: embedder.model, dimensions: embedder.dimensions, dir },
        "seeding RAG corpus",
    );

    const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
    if (files.length === 0) {
        throw new Error(`no .md files found in ${dir}`);
    }

    let totalChunks = 0;
    for (const file of files) {
        const content = await readFile(join(dir, file), "utf8");
        const chunks = chunkDocument(content, {
            size: config.RAG_CHUNK_SIZE,
            overlap: config.RAG_CHUNK_OVERLAP,
        });
        const embeddings = await embedder.embed(chunks);
        await upsertDocument(file, deriveTitle(content, file), content, chunks, embeddings, embedder.model);

        totalChunks += chunks.length;
        logger.info({ file, chunks: chunks.length }, "seeded document");
    }

    logger.info(
        { documents: files.length, chunks: totalChunks, totalInDb: await countChunks() },
        "RAG seed complete",
    );

    return { documents: files.length, chunks: totalChunks };
}

/**
 * Boot hook: seed only when the corpus is empty, so a reviewer who never runs
 * `seed:rag` still gets a working Ask page after `docker compose up`. A populated
 * corpus is left untouched, and any failure is logged rather than thrown -- seeding
 * must never take down the worker.
 */
export async function seedRagIfEmpty(): Promise<void> {
    try {
        const existing = await countChunks();
        if (existing > 0) {
            logger.info({ chunks: existing }, "RAG corpus already seeded, skipping auto-seed");
            return;
        }
        logger.info("RAG corpus is empty, auto-seeding on boot");
        await seedRagCorpus();
    } catch (err) {
        logger.error({ err }, "RAG auto-seed failed; run `npm run seed:rag` manually");
    }
}
