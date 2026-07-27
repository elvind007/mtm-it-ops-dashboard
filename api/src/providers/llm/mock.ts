import { NO_ANSWER_TEXT } from "@/providers/llm/prompts";
import type {
    Confidence,
    LlmProvider,
    RetrievedChunk,
    RiskLevel,
    SummaryInput,
    SummaryResult,
} from "@/types";

/**
 * The provider that runs when there is no API key.
 *
 * This is the first thing a reviewer sees after `docker compose up`, so it composes a
 * real digest out of the real fields rather than emitting placeholder text: the card is
 * genuinely readable, and the only thing missing is the model's judgement. It is also
 * pure -- no clock, no randomness, no network -- so the same area always yields the
 * same summary, which is what lets the summary cache and the alerting tests be
 * deterministic.
 */
export class MockLlmProvider implements LlmProvider {
    readonly kind = "mock";
    readonly model = "mock-summarizer";

    async summarizeArea(input: SummaryInput): Promise<SummaryResult> {
        const status = clean(input.status) ?? "Unknown";
        const key = status.toLowerCase();
        const notes = clean(input.notes);
        const blockers = clean(input.blockers);

        const qualifiers = [clean(input.category), clean(input.priority)].filter(
            (value): value is string => value !== null,
        );
        const label = qualifiers.length > 0
            ? `${clean(input.title) ?? "This area"} (${qualifiers.join(", ")})`
            : (clean(input.title) ?? "This area");

        const phrase = STATUS_PHRASE[key] ?? `recorded as "${status}"`;
        const owner = clean(input.owner);
        const ownerClause = owner ? `, owned by ${owner}` : ", with no owner recorded";

        const previous = clean(input.previousStatus);
        const movedClause =
            previous && previous.toLowerCase() !== key ? `, changed from ${previous}` : "";

        const sentences = [`${label} is ${phrase}${ownerClause}${movedClause}.`];

        if (notes) {
            sentences.push(`Latest note: ${firstSentence(notes)}.`);
        }

        if (blockers) {
            const opener = key === "blocked" ? "Blocked on" : "Outstanding blocker:";
            sentences.push(`${opener} ${firstSentence(blockers)}.`);
        }

        if (!notes && !blockers) {
            sentences.push(
                "No notes or blockers have been recorded, so there is not enough detail here to judge progress.",
            );
        }

        return {
            summary: sentences.join(" "),
            riskLevel: riskFromStatus(key),
            headlineBlocker: blockers ? firstSentence(blockers, MAX_BLOCKER_CHARS) : null,
            // Nothing was inferred from an empty record, and saying so is the honest signal.
            confidence: confidenceFrom(notes, blockers),
            // No tokens were spent; reporting zero would misrepresent the cost ledger.
            tokensIn: null,
            tokensOut: null,
        };
    }

    async answerWithContext(_question: string, passages: RetrievedChunk[]): Promise<string> {
        const top = passages[0];
        if (!top) {
            return NO_ANSWER_TEXT;
        }

        const excerpt = stripTrailingStop(firstSentence(top.content, MAX_EXCERPT_CHARS));
        const others = passages.length - 1;
        const tail =
            others > 0
                ? ` ${others} further passage${others === 1 ? "" : "s"} in the index cover${
                      others === 1 ? "s" : ""
                  } the same material.`
                : "";

        return `Based on the indexed documents: ${excerpt} [${top.n}].${tail}`;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MAX_SENTENCE_CHARS = 180;
const MAX_EXCERPT_CHARS = 220;
const MAX_BLOCKER_CHARS = 80;

const STATUS_PHRASE: Record<string, string> = {
    "on track": "tracking to plan",
    "at risk": "at risk of slipping",
    blocked: "blocked",
    done: "complete",
};

const RISK_BY_STATUS: Record<string, RiskLevel> = {
    blocked: "high",
    "at risk": "medium",
    done: "none",
};

function riskFromStatus(key: string): RiskLevel {
    // Anything we do not recognise is still an open piece of work, not a resolved one.
    return RISK_BY_STATUS[key] ?? "low";
}

function confidenceFrom(notes: string | null, blockers: string | null): Confidence {
    return notes === null && blockers === null ? "low" : "high";
}

function clean(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

/** First sentence of a free-text field, whitespace-collapsed and length-bounded. */
function firstSentence(value: string, max: number = MAX_SENTENCE_CHARS): string {
    const collapsed = value.replace(/\s+/g, " ").trim();
    const match = /^(.+?[.!?])(\s|$)/.exec(collapsed);
    const sentence = match?.[1] ?? collapsed;
    return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

/** Keeps the citation marker from landing after a stray full stop. */
function stripTrailingStop(value: string): string {
    return value.replace(/[.!?]+$/, "");
}
