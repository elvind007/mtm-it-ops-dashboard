import pino from "pino";

import { config } from "@/config";

export const logger = pino({
    level: config.LOG_LEVEL,
    // Redact anything that could carry a secret if an error object is ever logged whole.
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "*.apiKey",
            "*.webhookUrl",
        ],
        censor: "[redacted]",
    },
    ...(config.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : {}),
});
