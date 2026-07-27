import { config } from "@/config";
import { insertIntegrationLog } from "@/db/repositories/integration-logs";
import { logger } from "@/logger";
import {
    NO_ANSWER_TEXT,
    RAG_SYSTEM_PROMPT,
    SUMMARY_JSON_SCHEMA_HINT,
    SUMMARY_SYSTEM_PROMPT,
    buildRagUserPrompt,
    buildSummaryUserPrompt,
    parseSummaryResponse,
} from "@/providers/llm/prompts";
import type { LlmProvider, RetrievedChunk, SummaryInput, SummaryResult } from "@/types";

/**
 * Talks to any `/chat/completions` endpoint: Groq, OpenAI, Together, vLLM, Ollama's
 * compatibility shim. That is one adapter for most of the hosted-inference market,
 * which is why it is the default -- swapping vendors is an env-var change.
 *
 * Uses global `fetch` rather than a vendor SDK so the dependency surface stays at zero
 * and the request shape is visible in the diff.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
    readonly kind = "openai-compatible";
    readonly model: string;

    private readonly endpoint: string;
    private readonly apiKey: string;
    private readonly maxTokens: number;
    private readonly temperature: number;
    private readonly timeoutMs: number;

    constructor() {
        if (!config.LLM_API_KEY) {
            throw new Error(
                "OpenAiCompatibleProvider requires LLM_API_KEY; use the mock provider instead.",
            );
        }

        this.model = config.LLM_MODEL;
        this.apiKey = config.LLM_API_KEY;
        this.endpoint = `${config.LLM_BASE_URL.replace(/\/+$/, "")}/chat/completions`;
        this.maxTokens = config.LLM_MAX_TOKENS;
        this.temperature = config.LLM_TEMPERATURE;
        this.timeoutMs = config.LLM_TIMEOUT_MS;
    }

    async summarizeArea(input: SummaryInput): Promise<SummaryResult> {
        const completion = await this.complete({
            model: this.model,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            // Server-side JSON mode; `parseSummaryResponse` still runs, because not every
            // compatible endpoint honours this field and none of them guarantee our schema.
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `${SUMMARY_SYSTEM_PROMPT}\n\n${SUMMARY_JSON_SCHEMA_HINT}`,
                },
                { role: "user", content: buildSummaryUserPrompt(input) },
            ],
        });

        return {
            ...parseSummaryResponse(completion.content),
            tokensIn: completion.tokensIn,
            tokensOut: completion.tokensOut,
        };
    }

    async answerWithContext(question: string, passages: RetrievedChunk[]): Promise<string> {
        // Nothing retrieved means the answer cannot be grounded, so skip the round trip.
        if (passages.length === 0) {
            return NO_ANSWER_TEXT;
        }

        const completion = await this.complete({
            model: this.model,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            messages: [
                { role: "system", content: RAG_SYSTEM_PROMPT },
                { role: "user", content: buildRagUserPrompt(question, passages) },
            ],
        });

        return completion.content.trim() || NO_ANSWER_TEXT;
    }

    // -----------------------------------------------------------------------
    // Transport
    // -----------------------------------------------------------------------

    private async complete(body: unknown): Promise<Completion> {
        const startedAt = Date.now();
        for (let attempt = 1; ; attempt += 1) {
            try {
                const completion = readCompletion(await this.send(body));
                void insertIntegrationLog({
                    integration: "llm",
                    kind: "api_call",
                    message: `chat/completions ${this.model} ok`,
                    durationMs: Date.now() - startedAt,
                    meta: {
                        provider: this.kind,
                        model: this.model,
                        tokensIn: completion.tokensIn,
                        tokensOut: completion.tokensOut,
                    },
                });
                return completion;
            } catch (error) {
                const failure = asRequestError(error);
                if (!failure.retryable || attempt >= MAX_ATTEMPTS) {
                    void insertIntegrationLog({
                        integration: "llm",
                        kind: "error",
                        level: "error",
                        message: `chat/completions ${this.model} failed: ${failure.message}`,
                        statusCode: failure.status ?? null,
                        durationMs: Date.now() - startedAt,
                        meta: { provider: this.kind, model: this.model, error: failure.message.slice(0, 200) },
                    });
                    throw failure;
                }

                const delayMs = failure.retryAfterMs ?? backoffMs(attempt);
                logger.warn(
                    {
                        provider: this.kind,
                        model: this.model,
                        attempt,
                        status: failure.status,
                        delayMs,
                    },
                    "LLM request failed, retrying",
                );
                await sleep(delayMs);
            }
        }
    }

    private async send(body: unknown): Promise<unknown> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    // The only place the key appears. It is never logged or re-thrown.
                    authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => "");
                throw new LlmRequestError(
                    `chat/completions returned ${response.status} ${response.statusText}: ${detail.slice(0, 300)}`,
                    isRetryableStatus(response.status),
                    {
                        status: response.status,
                        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
                    },
                );
            }

            return await response.json();
        } catch (error) {
            if (error instanceof LlmRequestError) {
                throw error;
            }
            if (isAbortError(error)) {
                throw new LlmRequestError(
                    `chat/completions timed out after ${this.timeoutMs}ms`,
                    true,
                    {},
                );
            }
            // Connection resets and DNS failures are transient far more often than not.
            throw new LlmRequestError(
                `chat/completions request failed: ${describe(error)}`,
                true,
                {},
            );
        } finally {
            clearTimeout(timer);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One initial call plus two retries; beyond that the sync should fail and try again next tick. */
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

interface Completion {
    content: string;
    tokensIn: number | null;
    tokensOut: number | null;
}

class LlmRequestError extends Error {
    readonly retryable: boolean;
    readonly status: number | undefined;
    readonly retryAfterMs: number | undefined;

    constructor(
        message: string,
        retryable: boolean,
        details: { status?: number; retryAfterMs?: number | null },
    ) {
        super(message);
        this.name = "LlmRequestError";
        this.retryable = retryable;
        this.status = details.status;
        this.retryAfterMs = details.retryAfterMs ?? undefined;
    }
}

function asRequestError(error: unknown): LlmRequestError {
    return error instanceof LlmRequestError
        ? error
        : new LlmRequestError(describe(error), false, {});
}

function readCompletion(payload: unknown): Completion {
    if (!isRecord(payload)) {
        throw new LlmRequestError("chat/completions returned a non-object body", false, {});
    }

    const choices = payload["choices"];
    const first = Array.isArray(choices) ? choices[0] : undefined;
    const message = isRecord(first) ? first["message"] : undefined;
    const content = isRecord(message) ? message["content"] : undefined;

    if (typeof content !== "string") {
        throw new LlmRequestError("chat/completions returned no message content", false, {});
    }

    const usage = payload["usage"];
    return {
        content,
        tokensIn: isRecord(usage) ? readNumber(usage["prompt_tokens"]) : null,
        tokensOut: isRecord(usage) ? readNumber(usage["completion_tokens"]) : null,
    };
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

/** `Retry-After` is either delta-seconds or an HTTP date; both are worth honouring. */
function parseRetryAfter(header: string | null): number | null {
    if (!header) {
        return null;
    }

    const seconds = Number(header.trim());
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1_000, MAX_BACKOFF_MS);
    }

    const date = Date.parse(header);
    if (Number.isNaN(date)) {
        return null;
    }
    return Math.min(Math.max(date - Date.now(), 0), MAX_BACKOFF_MS);
}

/** Exponential with jitter, so a fleet of workers does not retry in lockstep. */
function backoffMs(attempt: number): number {
    const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
    return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
