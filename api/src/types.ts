/**
 * Domain contracts.
 *
 * Every external dependency (Notion, the LLM, embeddings, Slack) sits behind one of
 * these interfaces with a zero-config fallback implementation. That is what lets
 * `docker compose up` produce a fully populated dashboard with no API keys at all.
 */

export const AREA_STATUSES = ["On Track", "At Risk", "Blocked", "Done"] as const;
export type AreaStatus = (typeof AREA_STATUSES)[number];

// ---------------------------------------------------------------------------
// Notion
// ---------------------------------------------------------------------------

/** A Notion page normalized into our shape. Every optional field may be absent upstream. */
export interface NotionArea {
    notionPageId: string;
    notionUrl: string | null;
    title: string;
    /** Kept as a plain string: a status renamed in Notion must not crash the sync. */
    status: string;
    owner: string | null;
    category: string | null;
    priority: string | null;
    notes: string | null;
    blockers: string | null;
    /** ISO-8601, from Notion's built-in `last_edited_time`. */
    notionLastEditedAt: string | null;
}

export interface NotionSource {
    /** Reported on /api/health and shown as a badge in the UI. */
    readonly kind: "notion" | "fixtures";
    listAreas(): Promise<NotionArea[]>;
}

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

export interface SummaryInput {
    title: string;
    status: string;
    owner: string | null;
    category: string | null;
    priority: string | null;
    notes: string | null;
    blockers: string | null;
    notionLastEditedAt: string | null;
    /** Null when this is the first time we have seen the area. */
    previousStatus: string | null;
    previousStatusChangedAt: string | null;
}

export type RiskLevel = "none" | "low" | "medium" | "high";
export type Confidence = "high" | "low";

export interface SummaryResult {
    /** 2-3 sentences, plain prose. */
    summary: string;
    riskLevel: RiskLevel;
    /** Max ~80 chars, or null when nothing is blocking. */
    headlineBlocker: string | null;
    /** `low` when the source data was too thin to say anything useful. */
    confidence: Confidence;
    tokensIn: number | null;
    tokensOut: number | null;
}

export interface RetrievedChunk {
    /** 1-based citation marker used in the answer text. */
    n: number;
    source: string;
    title: string;
    content: string;
    /** Cosine similarity in [0, 1]; higher is closer. */
    score: number;
}

export interface LlmProvider {
    /** e.g. "openai-compatible", "anthropic", "mock". */
    readonly kind: string;
    /** Human-readable, shown in the UI and Slack footer. e.g. "openai/gpt-oss-120b". */
    readonly model: string;
    summarizeArea(input: SummaryInput): Promise<SummaryResult>;
    /** Answers strictly from `passages`; must refuse when they do not contain the answer. */
    answerWithContext(question: string, passages: RetrievedChunk[]): Promise<string>;
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export interface EmbeddingProvider {
    readonly kind: string;
    readonly model: string;
    readonly dimensions: number;
    /** Returns L2-normalized vectors, so cosine distance is meaningful. */
    embed(texts: string[]): Promise<number[][]>;
}

// ---------------------------------------------------------------------------
// Alerting
// ---------------------------------------------------------------------------

export interface StatusAlert {
    areaTitle: string;
    fromStatus: string | null;
    toStatus: string;
    owner: string | null;
    category: string | null;
    priority: string | null;
    summary: string | null;
    notionUrl: string | null;
    model: string;
    providerKind: string;
}

export interface Alerter {
    readonly kind: "slack" | "noop";
    readonly enabled: boolean;
    send(alert: StatusAlert): Promise<void>;
}

// ---------------------------------------------------------------------------
// Persistence rows (shapes returned by the repositories)
// ---------------------------------------------------------------------------

export interface AreaRow {
    id: string;
    notionPageId: string;
    notionUrl: string | null;
    title: string;
    status: string;
    owner: string | null;
    category: string | null;
    priority: string | null;
    notes: string | null;
    blockers: string | null;
    notionLastEditedAt: string | null;
    contentHash: string;
    firstSeenAt: string;
    updatedAt: string;
}

export interface SyncCounters {
    areasSeen: number;
    areasChanged: number;
    summariesGenerated: number;
    summariesCached: number;
    alertsSent: number;
}

export type SyncTrigger = "schedule" | "manual" | "boot";
