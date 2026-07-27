import { config } from "@/config";
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
 * Anthropic Messages API adapter, over global `fetch`.
 *
 * The Messages API is not chat/completions with different names: the system prompt is a
 * top-level field rather than a message, auth is `x-api-key` rather than a bearer token,
 * a dated `anthropic-version` header is mandatory, and there is no `response_format`.
 * Structured output therefore comes from a forced tool call -- the model must fill in a
 * declared JSON schema to answer at all -- with the free-text parser kept as the
 * fallback for the turns where it replies in prose anyway.
 */
export class AnthropicProvider implements LlmProvider {
    readonly kind = "anthropic";
    readonly model: string;

    private readonly endpoint: string;
    private readonly apiKey: string;
    private readonly maxTokens: number;
    private readonly timeoutMs: number;

    constructor() {
        if (!config.LLM_API_KEY) {
            throw new Error("AnthropicProvider requires LLM_API_KEY; use the mock provider instead.");
        }

        this.apiKey = config.LLM_API_KEY;
        // LLM_MODEL and LLM_BASE_URL default to OpenAI-compatible values, so honour them
        // only once they have actually been pointed at Anthropic (the API or a proxy).
        this.model = config.LLM_MODEL.startsWith("claude") ? config.LLM_MODEL : DEFAULT_MODEL;
        const baseUrl = config.LLM_BASE_URL.includes("anthropic")
            ? config.LLM_BASE_URL.replace(/\/+$/, "")
            : DEFAULT_BASE_URL;
        this.endpoint = `${baseUrl}/messages`;
        this.maxTokens = Math.max(config.LLM_MAX_TOKENS, MIN_MAX_TOKENS);
        this.timeoutMs = config.LLM_TIMEOUT_MS;
    }

    async summarizeArea(input: SummaryInput): Promise<SummaryResult> {
        const response = await this.request({
            model: this.model,
            max_tokens: this.maxTokens,
            system: `${SUMMARY_SYSTEM_PROMPT}\n\n${SUMMARY_JSON_SCHEMA_HINT}`,
            tools: [SUMMARY_TOOL],
            // Forcing the tool is what replaces `response_format: json_object` here.
            tool_choice: { type: "tool", name: SUMMARY_TOOL.name },
            messages: [{ role: "user", content: buildSummaryUserPrompt(input) }],
        });

        const toolInput = readToolInput(response.content, SUMMARY_TOOL.name);
        // Round-tripping the tool payload through the text parser reuses one set of
        // clamping and enum-coercion rules for both shapes rather than duplicating them.
        const raw = toolInput === null ? readText(response.content) : JSON.stringify(toolInput);

        return {
            ...parseSummaryResponse(raw),
            tokensIn: response.tokensIn,
            tokensOut: response.tokensOut,
        };
    }

    async answerWithContext(question: string, passages: RetrievedChunk[]): Promise<string> {
        if (passages.length === 0) {
            return NO_ANSWER_TEXT;
        }

        const response = await this.request({
            model: this.model,
            max_tokens: this.maxTokens,
            system: RAG_SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildRagUserPrompt(question, passages) }],
        });

        return readText(response.content).trim() || NO_ANSWER_TEXT;
    }

    // -----------------------------------------------------------------------
    // Transport
    // -----------------------------------------------------------------------

    private async request(body: unknown): Promise<MessageResponse> {
        for (let attempt = 1; ; attempt += 1) {
            try {
                return readMessage(await this.send(body));
            } catch (error) {
                const failure = asRequestError(error);
                if (!failure.retryable || attempt >= MAX_ATTEMPTS) {
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
                    "x-api-key": this.apiKey,
                    "anthropic-version": ANTHROPIC_VERSION,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => "");
                throw new LlmRequestError(
                    `messages returned ${response.status} ${response.statusText}: ${detail.slice(0, 300)}`,
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
                throw new LlmRequestError(`messages timed out after ${this.timeoutMs}ms`, true, {});
            }
            throw new LlmRequestError(`messages request failed: ${describe(error)}`, true, {});
        } finally {
            clearTimeout(timer);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";

/** Current Anthropic model id; overridable with any `claude-*` id via LLM_MODEL. */
const DEFAULT_MODEL = "claude-opus-5";

/** Required on every Messages API request; this is the API version, not the model date. */
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Current Claude models think by default, and thinking is drawn from the same
 * `max_tokens` budget as the visible reply -- so LLM_MAX_TOKENS, tuned at a few hundred
 * for chat/completions, would truncate the turn before the tool call ever lands.
 * Disabling thinking is the alternative, but that is the configuration where a tool call
 * can come back as plain text instead, so we leave it on and give it room.
 */
const MIN_MAX_TOKENS = 2_048;

/** One initial call plus two retries; beyond that the sync should fail and try again next tick. */
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

/**
 * `strict: true` would have the API validate this schema, but it is gated on model
 * support; `parseSummaryResponse` already tolerates a loose payload, so the request
 * stays portable across Claude models instead.
 */
const SUMMARY_TOOL = {
    name: "record_status_digest",
    description:
        "Record the status digest for one operational area. Call this exactly once with the finished digest.",
    input_schema: {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "2-3 sentences of plain prose, grounded in the DATA block.",
            },
            risk_level: {
                type: "string",
                enum: ["none", "low", "medium", "high"],
                description: "Operational risk implied by the data.",
            },
            headline_blocker: {
                anyOf: [{ type: "string" }, { type: "null" }],
                description: "Under 80 characters, or null when nothing is actively blocking.",
            },
            confidence: {
                type: "string",
                enum: ["high", "low"],
                description: "low when the source data was too thin to say anything useful.",
            },
        },
        required: ["summary", "risk_level", "headline_blocker", "confidence"],
        additionalProperties: false,
    },
} as const;

interface MessageResponse {
    content: unknown[];
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

function readMessage(payload: unknown): MessageResponse {
    if (!isRecord(payload)) {
        throw new LlmRequestError("messages returned a non-object body", false, {});
    }

    // Safety classifiers can decline a request with a 200 and an empty content array,
    // so the stop reason has to be checked before the content is read.
    if (payload["stop_reason"] === "refusal") {
        throw new LlmRequestError("messages declined the request (stop_reason: refusal)", false, {});
    }

    const content = payload["content"];
    if (!Array.isArray(content)) {
        throw new LlmRequestError("messages returned no content blocks", false, {});
    }

    const usage = payload["usage"];
    return {
        content,
        tokensIn: isRecord(usage) ? readNumber(usage["input_tokens"]) : null,
        tokensOut: isRecord(usage) ? readNumber(usage["output_tokens"]) : null,
    };
}

/** Concatenates the `text` blocks; thinking and tool blocks are skipped. */
function readText(content: unknown[]): string {
    const parts: string[] = [];
    for (const block of content) {
        if (isRecord(block) && block["type"] === "text" && typeof block["text"] === "string") {
            parts.push(block["text"]);
        }
    }
    return parts.join("\n").trim();
}

function readToolInput(content: unknown[], toolName: string): Record<string, unknown> | null {
    for (const block of content) {
        if (!isRecord(block) || block["type"] !== "tool_use" || block["name"] !== toolName) {
            continue;
        }
        const input = block["input"];
        if (isRecord(input)) {
            return input;
        }
    }
    return null;
}

function isRetryableStatus(status: number): boolean {
    // 529 is Anthropic's "overloaded", which is transient by definition.
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
