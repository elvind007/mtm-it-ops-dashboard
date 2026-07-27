import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        // Config validation runs at import time, so any module that transitively
        // reaches it needs a valid environment. Nothing here talks to a real
        // database -- tests cover pure logic only, with integration coverage
        // called out as future work in the README.
        env: {
            NODE_ENV: "test",
            DATABASE_URL: "postgres://test:test@localhost:5432/test",
            LOG_LEVEL: "fatal",
        },
    },
});
