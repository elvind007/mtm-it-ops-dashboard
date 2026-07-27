import { beforeEach, describe, expect, it } from "vitest";

import type { CachedSummary } from "@/db/repositories/summaries";
import { enrichArea, toSummaryInput, type SummaryCache } from "@/services/enrichment";
import type { LlmProvider, NotionArea, SummaryResult } from "@/types";

const PROMPT_VERSION = "v1";

const area: NotionArea = {
    notionPageId: "page-1",
    notionUrl: null,
    title: "Identity & Access Management",
    status: "At Risk",
    owner: "Priya Raman",
    category: "Security",
    priority: "P1",
    notes: "SSO rollout at 60%.",
    blockers: "Waiting on the Okta SAML cert.",
    notionLastEditedAt: "2026-07-26T14:03:00.000Z",
};

/** Counts calls so we can assert the LLM is genuinely skipped, not just fast. */
class CountingLlm implements LlmProvider {
    readonly kind = "counting";
    readonly model = "counting-model";
    summarizeCalls = 0;

    async summarizeArea(): Promise<SummaryResult> {
        this.summarizeCalls += 1;
        return {
            summary: `generated #${this.summarizeCalls}`,
            riskLevel: "medium",
            headlineBlocker: null,
            confidence: "high",
            tokensIn: 100,
            tokensOut: 50,
        };
    }

    async answerWithContext(): Promise<string> {
        throw new Error("not used");
    }
}

/** In-memory stand-in for the ai_summaries table, keyed exactly as the DB is. */
class FakeCache implements SummaryCache {
    private readonly entries = new Map<string, CachedSummary>();
    saveCalls = 0;

    private key(areaId: string, hash: string, version: string): string {
        return `${areaId}|${hash}|${version}`;
    }

    async find(areaId: string, hash: string, version: string): Promise<CachedSummary | null> {
        return this.entries.get(this.key(areaId, hash, version)) ?? null;
    }

    async save(
        areaId: string,
        hash: string,
        version: string,
        provider: string,
        model: string,
        result: SummaryResult,
    ): Promise<void> {
        this.saveCalls += 1;
        this.entries.set(this.key(areaId, hash, version), {
            summary: result.summary,
            riskLevel: result.riskLevel,
            headlineBlocker: result.headlineBlocker,
            confidence: result.confidence,
            provider,
            model,
            generatedAt: new Date().toISOString(),
        });
    }
}

describe("enrichArea", () => {
    let llm: CountingLlm;
    let cache: FakeCache;

    beforeEach(() => {
        llm = new CountingLlm();
        cache = new FakeCache();
    });

    const run = (hash: string, version = PROMPT_VERSION) =>
        enrichArea("area-1", area, hash, "On Track", version, llm, cache);

    it("calls the LLM on a cold cache", async () => {
        const result = await run("hash-a");

        expect(result.fromCache).toBe(false);
        expect(result.summary).toBe("generated #1");
        expect(llm.summarizeCalls).toBe(1);
        expect(cache.saveCalls).toBe(1);
    });

    it("does not call the LLM again when the content hash is unchanged", async () => {
        await run("hash-a");
        const second = await run("hash-a");

        expect(second.fromCache).toBe(true);
        expect(second.summary).toBe("generated #1");
        // The requirement: summaries are cached, not regenerated per request.
        expect(llm.summarizeCalls).toBe(1);
        expect(cache.saveCalls).toBe(1);
    });

    it("stays cached across many reads", async () => {
        await run("hash-a");
        for (let i = 0; i < 10; i += 1) await run("hash-a");

        expect(llm.summarizeCalls).toBe(1);
    });

    it("regenerates when the content hash changes", async () => {
        await run("hash-a");
        const second = await run("hash-b");

        expect(second.fromCache).toBe(false);
        expect(second.summary).toBe("generated #2");
        expect(llm.summarizeCalls).toBe(2);
    });

    it("regenerates when the prompt version changes", async () => {
        await run("hash-a", "v1");
        const second = await run("hash-a", "v2");

        // Editing the prompt must invalidate the cache on its own -- otherwise a
        // deploy silently mixes text from two different prompt generations.
        expect(second.fromCache).toBe(false);
        expect(llm.summarizeCalls).toBe(2);
    });

    it("keeps caches separate per area", async () => {
        await enrichArea("area-1", area, "hash-a", null, PROMPT_VERSION, llm, cache);
        await enrichArea("area-2", area, "hash-a", null, PROMPT_VERSION, llm, cache);

        expect(llm.summarizeCalls).toBe(2);
    });
});

describe("toSummaryInput", () => {
    it("carries the previous status through for transition context", () => {
        const input = toSummaryInput(area, "On Track", "2026-07-25T09:00:00.000Z");

        expect(input.previousStatus).toBe("On Track");
        expect(input.previousStatusChangedAt).toBe("2026-07-25T09:00:00.000Z");
        expect(input.title).toBe(area.title);
        expect(input.blockers).toBe(area.blockers);
    });

    it("defaults the change timestamp to null", () => {
        expect(toSummaryInput(area, null).previousStatusChangedAt).toBeNull();
    });
});
