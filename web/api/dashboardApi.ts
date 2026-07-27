import Axi from "@/services/interceptors/Axi";
import type {
    AreasResponse,
    ChatResponse,
    HealthResponse,
    IntegrationLog,
    StatusEvent,
    SyncRun,
} from "@/types/api";

export interface LogsQuery {
    integration?: string;
    level?: string;
    limit?: number;
}

export const dashboardKeys = {
    areas: ["areas"] as const,
    health: ["health"] as const,
    events: (limit: number) => ["events", limit] as const,
    runs: (limit: number) => ["sync-runs", limit] as const,
    logs: (query: LogsQuery) => ["logs", query] as const,
};

export const dashboardApi = {
    areas: () => Axi.get<AreasResponse>("/areas"),
    health: () => Axi.get<HealthResponse>("/health"),
    events: (limit = 25) => Axi.get<{ events: StatusEvent[] }>("/events", { params: { limit } }),
    runs: (limit = 10) => Axi.get<{ runs: SyncRun[] }>("/sync/runs", { params: { limit } }),
    sync: () => Axi.post<SyncRun & { ok: boolean }>("/sync"),
    chat: (question: string) => Axi.post<ChatResponse>("/chat", { question }),
    logs: ({ integration, level, limit = 50 }: LogsQuery = {}) =>
        Axi.get<{ logs: IntegrationLog[] }>("/logs", {
            params: { integration, level, limit },
        }),
};
