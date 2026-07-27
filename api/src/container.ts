import { createAlerter } from "@/providers/alerter";
import { createEmbeddingProvider } from "@/providers/embeddings";
import { createLlmProvider } from "@/providers/llm";
import { createNotionSource } from "@/providers/notion";
import type { Alerter, EmbeddingProvider, LlmProvider, NotionSource } from "@/types";

/**
 * Provider singletons, resolved on first use.
 *
 * Lazy rather than eager so that a process which never touches RAG (the worker)
 * doesn't pay to construct an embedder, and so a misconfigured optional provider
 * only fails the request that needs it.
 */

let notionSource: NotionSource | undefined;
let llmProvider: LlmProvider | undefined;
let alerter: Alerter | undefined;
let embeddingProvider: EmbeddingProvider | undefined;

export function getNotionSource(): NotionSource {
    notionSource ??= createNotionSource();
    return notionSource;
}

export function getLlmProvider(): LlmProvider {
    llmProvider ??= createLlmProvider();
    return llmProvider;
}

export function getAlerter(): Alerter {
    alerter ??= createAlerter();
    return alerter;
}

export function getEmbeddingProvider(): EmbeddingProvider {
    embeddingProvider ??= createEmbeddingProvider();
    return embeddingProvider;
}
