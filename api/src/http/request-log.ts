import type { NextFunction, Request, RequestHandler, Response } from "express";

import { insertIntegrationLog } from "@/db/repositories/integration-logs";

/**
 * Records one integration_logs row per `/api/*` request for the Logs page.
 *
 * Fires on response `finish` so the status code and duration are final. `/api/health`
 * is polled continuously by the UI, so it is kept quiet unless it actually errors --
 * otherwise the log would be nothing but health checks. The insert is best-effort and
 * never blocks the response.
 */
export function requestLogger(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const startedAt = Date.now();

        res.on("finish", () => {
            const path = req.path;
            const isError = res.statusCode >= 400;
            if (path === "/api/health" && !isError) return;

            void insertIntegrationLog({
                integration: "http",
                kind: isError ? "error" : "api_call",
                level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
                message: `${req.method} ${path} → ${res.statusCode}`,
                method: req.method,
                url: path,
                statusCode: res.statusCode,
                durationMs: Date.now() - startedAt,
            });
        });

        next();
    };
}
