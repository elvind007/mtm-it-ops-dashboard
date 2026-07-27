import { config } from "@/config";
import type { EmbeddingProvider } from "@/types";

import { HashEmbeddingProvider } from "@/providers/embeddings/hash";
import { LocalEmbeddingProvider } from "@/providers/embeddings/local";
import { OpenAiEmbeddingProvider } from "@/providers/embeddings/openai";

/**
 * Builds the configured embedding provider and checks it against the pgvector
 * column dimension up front. `document_chunks.embedding` is `vector(384)` --
 * inserting a vector of any other length fails at the database, but only after
 * we have already spent the time (and, for `openai`, the money) computing it.
 * Failing here instead is immediate and points at the actual mismatch.
 */
export function createEmbeddingProvider(): EmbeddingProvider {
    const provider = buildProvider();

    if (provider.dimensions !== config.EMBEDDING_DIM) {
        throw new Error(
            `Embedding provider "${provider.kind}" (${provider.model}) produces ` +
                `${provider.dimensions}-dim vectors, but EMBEDDING_DIM is ${config.EMBEDDING_DIM}. ` +
                "These must match the vector(N) column in db/init.sql -- update EMBEDDING_DIM " +
                "or choose a different provider.",
        );
    }

    return provider;
}

function buildProvider(): EmbeddingProvider {
    switch (config.EMBEDDING_PROVIDER) {
        case "hash":
            return new HashEmbeddingProvider(config.EMBEDDING_DIM, config.EMBEDDING_MODEL);

        case "local":
            return new LocalEmbeddingProvider();

        case "openai": {
            if (!config.EMBEDDING_API_KEY) {
                throw new Error("EMBEDDING_PROVIDER=openai requires EMBEDDING_API_KEY to be set.");
            }
            return new OpenAiEmbeddingProvider({
                apiKey: config.EMBEDDING_API_KEY,
                baseUrl: config.EMBEDDING_BASE_URL,
                model: config.EMBEDDING_MODEL,
                dimensions: config.EMBEDDING_DIM,
            });
        }

        default: {
            const exhaustive: never = config.EMBEDDING_PROVIDER;
            throw new Error(`Unknown EMBEDDING_PROVIDER: ${String(exhaustive)}`);
        }
    }
}
