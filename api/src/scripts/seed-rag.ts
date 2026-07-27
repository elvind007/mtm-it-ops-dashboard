import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "@/config";
import { closeDatabase, waitForDatabase } from "@/db/pool";
import { logger } from "@/logger";
import { createEmbeddingProvider } from "@/providers/embeddings";
import { chunkDocument } from "@/services/rag/chunker";
import { countChunks, upsertDocument } from "@/services/rag/repository";

// Resolve relative to this module, not process.cwd(), so it works from any working
// directory including inside the container.
const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs", "seed");

function deriveTitle(markdown: string, fallback: string): string {
    const heading = markdown.split("\n").find((line) => line.startsWith("# "));
    return heading ? heading.replace(/^#\s+/, "").trim() : fallback;
}

async function main(): Promise<void> {
    if (!config.RAG_ENABLED) {
        logger.warn("RAG_ENABLED=false; seeding anyway so the corpus is ready if it is turned on");
    }

    await waitForDatabase();

    const embedder = createEmbeddingProvider();
    logger.info(
        { provider: embedder.kind, model: embedder.model, dimensions: embedder.dimensions },
        "seeding RAG corpus",
    );

    const files = (await readdir(SEED_DIR)).filter((f) => f.endsWith(".md")).sort();
    if (files.length === 0) {
        throw new Error(`no .md files found in ${SEED_DIR}`);
    }

    let totalChunks = 0;
    for (const file of files) {
        const content = await readFile(join(SEED_DIR, file), "utf8");
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

    await closeDatabase();
}

main().catch((err) => {
    logger.fatal({ err }, "RAG seed failed");
    process.exitCode = 1;
    void closeDatabase();
});
