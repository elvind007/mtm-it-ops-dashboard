import type { EmbeddingProvider } from "@/types";

/**
 * Embedding provider for any OpenAI-compatible `/embeddings` endpoint (OpenAI
 * itself, or a compatible gateway via `EMBEDDING_BASE_URL`). Real semantic
 * recall, at the cost of a key and a network call per query.
 */

export interface OpenAiEmbeddingProviderOptions {
    apiKey: string;
    baseUrl: string;
    model: string;
    dimensions: number;
    /** Inputs per request. OpenAI-compatible endpoints accept a batch of strings. */
    batchSize?: number;
    maxRetries?: number;
}

interface EmbeddingsResponse {
    data: { embedding: number[]; index: number }[];
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
    readonly kind = "openai";
    readonly model: string;
    readonly dimensions: number;

    readonly #apiKey: string;
    readonly #baseUrl: string;
    readonly #batchSize: number;
    readonly #maxRetries: number;

    constructor(opts: OpenAiEmbeddingProviderOptions) {
        this.model = opts.model;
        this.dimensions = opts.dimensions;
        this.#apiKey = opts.apiKey;
        this.#baseUrl = opts.baseUrl.replace(/\/+$/, "");
        this.#batchSize = opts.batchSize ?? 100;
        this.#maxRetries = opts.maxRetries ?? 3;
    }

    async embed(texts: string[]): Promise<number[][]> {
        const out: number[][] = [];
        for (let i = 0; i < texts.length; i += this.#batchSize) {
            const batch = texts.slice(i, i + this.#batchSize);
            out.push(...(await this.#embedBatch(batch)));
        }
        return out;
    }

    async #embedBatch(batch: string[]): Promise<number[][]> {
        let attempt = 0;

        for (;;) {
            const res = await fetch(`${this.#baseUrl}/embeddings`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // Never log this header or the key itself -- errors below only ever
                    // surface status/text, which an OpenAI-compatible server does not
                    // echo credentials into.
                    Authorization: `Bearer ${this.#apiKey}`,
                },
                body: JSON.stringify({ model: this.model, input: batch }),
            });

            if (res.ok) {
                const body = (await res.json()) as EmbeddingsResponse;
                const vectors = body.data
                    .slice()
                    .sort((a, b) => a.index - b.index)
                    .map((item) => l2Normalize(item.embedding));

                for (const vec of vectors) {
                    if (vec.length !== this.dimensions) {
                        throw new Error(
                            `embedding provider "${this.model}" returned a ${vec.length}-dim ` +
                                `vector but EMBEDDING_DIM is ${this.dimensions}.`,
                        );
                    }
                }

                return vectors;
            }

            const retryable = res.status === 429 || res.status >= 500;
            attempt += 1;

            if (!retryable || attempt > this.#maxRetries) {
                const bodyText = await res.text().catch(() => "");
                throw new Error(
                    `embedding request failed: ${res.status} ${res.statusText}${bodyText ? ` -- ${bodyText}` : ""}`,
                );
            }

            await sleep(backoffMs(res, attempt));
        }
    }
}

/** Honors `Retry-After` when the server sends one, otherwise exponential backoff with jitter. */
function backoffMs(res: Response, attempt: number): number {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    }
    return 2 ** attempt * 250 + Math.random() * 100;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function l2Normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map((v) => v / norm);
}
