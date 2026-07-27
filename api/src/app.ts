import cors from "cors";
import express, { type Express } from "express";

import { config } from "@/config";
import { errorHandler, notFoundHandler } from "@/http/errors";
import { requestLogger } from "@/http/request-log";
import { areasRouter } from "@/routes/areas";
import { chatRouter } from "@/routes/chat";
import { healthRouter } from "@/routes/health";

/**
 * Built as a factory so supertest can exercise routes without binding a port.
 */
export function createApp(): Express {
    const app = express();

    app.disable("x-powered-by");
    app.use(cors({ origin: config.CORS_ORIGIN }));
    app.use(express.json({ limit: "1mb" }));
    app.use(requestLogger());

    app.use("/api", healthRouter);
    app.use("/api", areasRouter);
    app.use("/api", chatRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
