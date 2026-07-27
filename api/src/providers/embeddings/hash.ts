import type { EmbeddingProvider } from "@/types";

/**
 * Deterministic, zero-dependency, fully offline embedding provider.
 *
 * Be honest about what this is: it is a hashed bag-of-words vector, not a learned
 * semantic representation. It retrieves well on literal term overlap (the question
 * shares words with the right passage) and poorly on paraphrase or synonymy (the
 * question means the same thing in different words). It exists so `RAG_ENABLED=true`
 * works out of the box with zero setup and zero API keys -- `local`
 * (`@huggingface/transformers`, opt-in) or `openai` are what you would point at for
 * real semantic recall.
 */
export class HashEmbeddingProvider implements EmbeddingProvider {
    readonly kind = "hash";
    readonly model: string;
    readonly dimensions: number;

    constructor(dimensions: number, model = "hash-lexical-v1") {
        this.dimensions = dimensions;
        this.model = model;
    }

    async embed(texts: string[]): Promise<number[][]> {
        return Promise.resolve(texts.map((text) => embedOne(text, this.dimensions)));
    }
}

function embedOne(text: string, dimensions: number): number[] {
    const tokens = tokenize(text);

    const termFrequency = new Map<string, number>();
    for (const token of tokens) {
        termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    const vector = new Array<number>(dimensions).fill(0);
    for (const [token, count] of termFrequency) {
        const bucket = fnv1aHash(token) % dimensions;
        const weight = 1 + Math.log(count); // sub-linear -- a token appearing 10x isn't 10x more important
        vector[bucket] = (vector[bucket] ?? 0) + weight; // '+=' sums across tokens that collide into the same bucket
    }

    return l2Normalize(vector);
}

/** Lowercase word tokens. Good enough for a lexical hash; no stemming or stopwording. */
function tokenize(text: string): string[] {
    return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * FNV-1a: a simple, stable, well-distributed string hash. Stable across Node
 * versions and platforms, which a hash embedder depends on for determinism.
 */
function fnv1aHash(value: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0; // unsigned, so `% dimensions` is never negative
}

function l2Normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    // A zero vector (e.g. empty/whitespace-only text) has no direction to normalize --
    // returning it as-is is safer than dividing by zero into a vector of NaNs.
    if (norm === 0) return vector;
    return vector.map((v) => v / norm);
}
