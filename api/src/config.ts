import { z } from "zod";

/**
 * Environment contract, validated once at boot.
 *
 * Every integration is optional. A missing key selects that integration's offline
 * fallback rather than failing, which is what makes the zero-key `docker compose up`
 * path work. What *is* enforced is that a partially-configured integration fails
 * loudly -- a Notion key with no database id is a mistake, not a fallback.
 */

const csv = (value: string) =>
    value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

const bool = z
    .string()
    .transform((v) => v.toLowerCase() === "true" || v === "1")
    .pipe(z.boolean());

const blankToUndefined = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? undefined : v;

const schema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    API_PORT: z.coerce.number().int().positive().default(8080),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    CORS_ORIGIN: z.string().default("*"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // --- Notion (blank -> bundled fixtures) ---
    NOTION_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
    NOTION_DATABASE_ID: z.preprocess(blankToUndefined, z.string().optional()),
    NOTION_VERSION: z.string().default("2022-06-28"),

    // --- LLM (blank key -> deterministic mock provider) ---
    LLM_PROVIDER: z.enum(["openai-compatible", "anthropic", "mock"]).default("openai-compatible"),
    LLM_BASE_URL: z.string().default("https://api.groq.com/openai/v1"),
    LLM_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
    LLM_MODEL: z.string().default("llama-3.3-70b-versatile"),
    LLM_MAX_TOKENS: z.coerce.number().int().positive().default(300),
    LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

    // --- Slack (blank -> alerting disabled, transitions still recorded) ---
    SLACK_WEBHOOK_URL: z.preprocess(blankToUndefined, z.string().optional()),
    SLACK_ALERT_STATUSES: z.string().default("At Risk,Blocked").transform(csv),
    /**
     * On the very first sync every area is "new". Alerting on that would fire once
     * per area for a state nobody just changed, so it is off by default.
     */
    ALERT_ON_FIRST_SEEN: bool.default(false),

    // --- Sync loop ---
    SYNC_INTERVAL_MS: z.coerce.number().int().min(5_000).default(30_000),
    SYNC_ON_BOOT: bool.default(true),

    // --- RAG ---
    RAG_ENABLED: bool.default(true),
    EMBEDDING_PROVIDER: z.enum(["hash", "local", "openai"]).default("hash"),
    EMBEDDING_MODEL: z.string().default("hash-384"),
    /** Must match the vector(N) column in db/init.sql. */
    EMBEDDING_DIM: z.coerce.number().int().positive().default(384),
    EMBEDDING_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
    EMBEDDING_BASE_URL: z.string().default("https://api.openai.com/v1"),
    RAG_TOP_K: z.coerce.number().int().positive().default(5),
    /** Cosine similarity floor. Below this we answer "not in the indexed documents"
     *  without calling the LLM at all. */
    RAG_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.35),
    RAG_CHUNK_SIZE: z.coerce.number().int().positive().default(800),
    RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).default(150),
    /** Where the seed markdown lives. The image only copies src/, so in Docker the
     *  docs are bind-mounted and this points at them; blank -> module-relative default. */
    RAG_SEED_DIR: z.preprocess(blankToUndefined, z.string().optional()),
});

export type Config = z.infer<typeof schema> & {
    notionEnabled: boolean;
    llmEnabled: boolean;
    slackEnabled: boolean;
};

function build(env: NodeJS.ProcessEnv): Config {
    const parsed = schema.safeParse(env);

    if (!parsed.success) {
        const lines = parsed.error.issues.map(
            (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
        );
        throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
    }

    const cfg = parsed.data;

    // A half-configured integration is a mistake, not a fallback -- say so loudly.
    if (Boolean(cfg.NOTION_API_KEY) !== Boolean(cfg.NOTION_DATABASE_ID)) {
        throw new Error(
            "Notion is half-configured: set both NOTION_API_KEY and NOTION_DATABASE_ID, " +
                "or leave both blank to run on bundled fixtures.",
        );
    }

    if (cfg.LLM_PROVIDER !== "mock" && cfg.LLM_API_KEY && !cfg.LLM_BASE_URL) {
        throw new Error("LLM_API_KEY is set but LLM_BASE_URL is empty.");
    }

    return {
        ...cfg,
        notionEnabled: Boolean(cfg.NOTION_API_KEY && cfg.NOTION_DATABASE_ID),
        llmEnabled: cfg.LLM_PROVIDER !== "mock" && Boolean(cfg.LLM_API_KEY),
        slackEnabled: Boolean(cfg.SLACK_WEBHOOK_URL),
    };
}

export const config: Config = build(process.env);

/** Exposed for tests, which build configs from literals rather than process.env. */
export const buildConfig = build;
