import type { NextFunction, Request, Response } from "express";

import { logger } from "@/logger";

export class HttpError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = "HttpError";
    }
}

export function badRequest(message: string): HttpError {
    return new HttpError(400, message);
}

export function notFoundHandler(_req: Request, res: Response): void {
    res.status(404).json({ error: "Not found" });
}

/**
 * Client errors carry their message through; anything else is logged in full and
 * reported generically, so an upstream failure can never leak a key or a query
 * into an HTTP response.
 */
export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
    }

    logger.error({ err }, "unhandled request error");
    res.status(500).json({ error: "Internal server error" });
}
