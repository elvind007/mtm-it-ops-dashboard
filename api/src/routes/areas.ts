import { Router } from "express";

import { getAlerter, getLlmProvider, getNotionSource } from "@/container";
import { listDashboardAreas } from "@/db/repositories/areas";
import { listRecentEvents } from "@/db/repositories/events";
import { listIntegrationLogs } from "@/db/repositories/integration-logs";
import { listSyncRuns } from "@/db/repositories/sync-runs";
import { asyncHandler } from "@/http/async-handler";
import { HttpError } from "@/http/errors";
import { runSync } from "@/services/sync";

export const areasRouter: Router = Router();

const clampLimit = (raw: unknown, fallback: number, max: number): number => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(Math.floor(parsed), max);
};

areasRouter.get(
    "/areas",
    asyncHandler(async (_req, res) => {
        const areas = await listDashboardAreas();
        const [latestRun] = await listSyncRuns(1);

        res.json({
            areas,
            counts: {
                total: areas.length,
                onTrack: areas.filter((a) => a.status === "On Track").length,
                atRisk: areas.filter((a) => a.status === "At Risk").length,
                blocked: areas.filter((a) => a.status === "Blocked").length,
                done: areas.filter((a) => a.status === "Done").length,
            },
            lastSync: latestRun ?? null,
        });
    }),
);

areasRouter.get(
    "/events",
    asyncHandler(async (req, res) => {
        const events = await listRecentEvents(clampLimit(req.query.limit, 25, 200));
        res.json({ events });
    }),
);

areasRouter.get(
    "/sync/runs",
    asyncHandler(async (req, res) => {
        const runs = await listSyncRuns(clampLimit(req.query.limit, 10, 100));
        res.json({ runs });
    }),
);

const asFilter = (raw: unknown): string | undefined =>
    typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;

areasRouter.get(
    "/logs",
    asyncHandler(async (req, res) => {
        const logs = await listIntegrationLogs({
            integration: asFilter(req.query.integration),
            level: asFilter(req.query.level),
            limit: clampLimit(req.query.limit, 50, 200),
        });
        res.json({ logs });
    }),
);

/**
 * Manual sync, behind the dashboard's "Sync now" button.
 *
 * Runs in the API process rather than signalling the worker — a Postgres advisory
 * lock inside runSync keeps the two from overlapping, which is simpler than adding
 * a queue for a button that gets pressed a handful of times.
 */
areasRouter.post(
    "/sync",
    asyncHandler(async (_req, res) => {
        let outcome;
        try {
            outcome = await runSync("manual", {
                source: getNotionSource(),
                llm: getLlmProvider(),
                alerter: getAlerter(),
            });
        } catch {
            // runSync already logged the failure in full and recorded it to
            // integration_logs (visible on the Logs page). Translate it into a clean
            // 502 so "Sync now" tells the user the upstream source is unreachable
            // instead of surfacing a bare "Internal server error".
            throw new HttpError(
                502,
                "Sync failed: the Notion source could not be reached. See the Logs page for details.",
            );
        }

        if (outcome.skipped === "locked") {
            res.status(409).json({
                error: "A sync is already running. Try again in a moment.",
            });
            return;
        }

        res.json({ ok: true, ...outcome });
    }),
);
