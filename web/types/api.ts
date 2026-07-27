/** Mirrors the Express API response shapes. */

export interface AreaSummary {
    text: string;
    riskLevel: string | null;
    headlineBlocker: string | null;
    confidence: string | null;
    provider: string;
    model: string;
    generatedAt: string;
    /** True when the last sync reused this summary instead of regenerating it. */
    cached: boolean;
}

export interface AreaLastChange {
    fromStatus: string | null;
    toStatus: string;
    changedAt: string;
    alertStatus: string;
}

export interface Area {
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
    updatedAt: string;
    summary: AreaSummary | null;
    lastChange: AreaLastChange | null;
}

export interface SyncRun {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    trigger: string;
    source: string | null;
    areasSeen: number;
    areasChanged: number;
    summariesGenerated: number;
    summariesCached: number;
    alertsSent: number;
    error: string | null;
}

export interface AreasResponse {
    areas: Area[];
    counts: {
        total: number;
        onTrack: number;
        atRisk: number;
        blocked: number;
        done: number;
    };
    lastSync: SyncRun | null;
}

export interface StatusEvent {
    id: string;
    areaId: string;
    areaTitle: string;
    fromStatus: string | null;
    toStatus: string;
    changedAt: string;
    alertStatus: string;
    alertError: string | null;
}

export interface HealthResponse {
    status: string;
    database: string;
    integrations: {
        notion: { mode: string; detail: string };
        llm: { mode: string; provider: string; model: string };
        slack: { mode: string; alertOn: string[] };
        rag: { mode: string; embeddingProvider: string; embeddingModel: string };
    };
}

export interface IntegrationLog {
    id: string;
    createdAt: string;
    integration: string;
    kind: string;
    level: string;
    message: string;
    method: string | null;
    url: string | null;
    statusCode: number | null;
    durationMs: number | null;
    syncRunId: string | null;
    meta: Record<string, unknown> | null;
}

export interface Citation {
    n: number;
    source: string;
    title: string;
    score: number;
}

export interface ChatResponse {
    answer: string;
    citations: Citation[];
    /** False when retrieval found nothing above the similarity floor. */
    usedLlm: boolean;
}
