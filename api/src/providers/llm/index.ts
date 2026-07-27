import { config } from "@/config";
import { logger } from "@/logger";
import { AnthropicProvider } from "@/providers/llm/anthropic";
import { MockLlmProvider } from "@/providers/llm/mock";
import { OpenAiCompatibleProvider } from "@/providers/llm/openai-compatible";
import type { LlmProvider } from "@/types";

/**
 * Resolves the LLM implementation from the environment.
 *
 * A missing key selects the mock rather than throwing: the whole point of the fallback
 * providers is that the dashboard boots and populates with no credentials at all. The
 * selection is logged once so the running mode is recoverable from the logs as well as
 * from /api/health -- with the provider and model only, never the key.
 */
export function createLlmProvider(): LlmProvider {
    if (!config.llmEnabled) {
        const reason =
            config.LLM_PROVIDER === "mock" ? "LLM_PROVIDER=mock" : "no LLM_API_KEY configured";
        return announce(new MockLlmProvider(), reason);
    }

    switch (config.LLM_PROVIDER) {
        case "anthropic":
            return announce(new AnthropicProvider(), "LLM_PROVIDER=anthropic");
        case "openai-compatible":
            return announce(new OpenAiCompatibleProvider(), "LLM_PROVIDER=openai-compatible");
        case "mock":
            return announce(new MockLlmProvider(), "LLM_PROVIDER=mock");
        default: {
            // Unreachable while the zod enum and this switch agree; the compiler enforces it.
            const unsupported: never = config.LLM_PROVIDER;
            throw new Error(`Unsupported LLM_PROVIDER: ${String(unsupported)}`);
        }
    }
}

/** The API server and the sync worker both build a provider; one line about it is enough. */
let announced = false;

function announce(provider: LlmProvider, reason: string): LlmProvider {
    if (!announced) {
        announced = true;
        logger.info(
            { provider: provider.kind, model: provider.model, reason },
            "LLM provider selected",
        );
    }
    return provider;
}
