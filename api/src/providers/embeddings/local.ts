import type { EmbeddingProvider } from "@/types";

/**
 * Real semantic embeddings via a local ONNX model (`Xenova/all-MiniLM-L6-v2`,
 * 384 dims), running fully offline once the model is downloaded and cached --
 * no API key, no per-query network call.
 *
 * `@huggingface/transformers` is deliberately NOT a dependency of this project:
 * it pulls in an ONNX runtime and is large, and the zero-setup default path
 * (`EMBEDDING_PROVIDER=hash`) does not need it. This provider loads it via a
 * dynamic import specifically so requiring it stays opt-in -- `npm install
 * @huggingface/transformers` plus `EMBEDDING_PROVIDER=local` is the entire upgrade.
 */

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const DIMENSIONS = 384;

// Minimal local shape for the optional dependency. There are no real type
// declarations to import when the package isn't installed, so the runtime module
// is loaded through an indirect specifier (below) that tsc does not statically
// resolve, and the result is narrowed to this interface.
interface FeatureExtractionOutput {
    tolist(): number[][];
}
type FeatureExtractionPipeline = (
    texts: string[],
    options?: { pooling?: "mean" | "cls" | "none"; normalize?: boolean },
) => Promise<FeatureExtractionOutput>;
interface TransformersModule {
    pipeline(task: "feature-extraction", model: string): Promise<FeatureExtractionPipeline>;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
    readonly kind = "local";
    readonly model = MODEL_ID;
    readonly dimensions = DIMENSIONS;

    // Lazily initialized and reused: loading the model is the expensive part
    // (weights download + ONNX session setup), embedding calls after that are cheap.
    #pipelinePromise: Promise<FeatureExtractionPipeline> | undefined;

    async embed(texts: string[]): Promise<number[][]> {
        this.#pipelinePromise ??= loadPipeline();
        const extract = await this.#pipelinePromise;

        // Mean-pool then L2-normalize ourselves rather than trust the library's own
        // `normalize` option -- this keeps normalization identical (and testable)
        // across all three embedding providers.
        const output = await extract(texts, { pooling: "mean" });
        return output.tolist().map(l2Normalize);
    }
}

async function loadPipeline(): Promise<FeatureExtractionPipeline> {
    // Indirect specifier: a string variable is not statically resolved by tsc, so
    // the project compiles without the optional package present. The real failure
    // surfaces here, at runtime, with an actionable message.
    const specifier = "@huggingface/transformers";
    let mod: TransformersModule;
    try {
        mod = (await import(/* @vite-ignore */ specifier)) as unknown as TransformersModule;
    } catch (err) {
        throw new Error(
            "LocalEmbeddingProvider requires the optional '@huggingface/transformers' " +
                "package, which is not installed by default (it is large, and the hash " +
                "provider covers the zero-setup path without it). Run " +
                "`npm install @huggingface/transformers` and set EMBEDDING_PROVIDER=local.",
            { cause: err },
        );
    }
    return mod.pipeline("feature-extraction", MODEL_ID);
}

function l2Normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map((v) => v / norm);
}
