import { describe, expect, it } from "vitest";

import { MockLlmProvider } from "@/providers/llm/mock";
import { NO_ANSWER_TEXT } from "@/providers/llm/prompts";
import type { RetrievedChunk, SummaryInput } from "@/types";

const BASE: SummaryInput = {
    title: "Network Refresh",
    status: "On Track",
    owner: "Priya Raman",
    category: "Infrastructure",
    priority: "High",
    notes: "Switch firmware staged in lab. Rollout window booked for Saturday.",
    blockers: null,
    notionLastEditedAt: "2026-07-27T10:00:00.000Z",
    previousStatus: null,
    previousStatusChangedAt: null,
};

const PASSAGE: RetrievedChunk = {
    n: 1,
    source: "runbooks/network-refresh.md",
    title: "Network refresh runbook",
    content: "Uplink swaps run during the Saturday window. Roll back with the staged image.",
    score: 0.82,
};

describe("MockLlmProvider.summarizeArea", () => {
    it("is deterministic: the same input yields byte-identical output", async () => {
        const provider = new MockLlmProvider();

        const first = await provider.summarizeArea(BASE);
        const second = await provider.summarizeArea(BASE);

        expect(first).toEqual(second);
    });

    it("mentions the status, the owner and the blocker", async () => {
        const provider = new MockLlmProvider();

        const result = await provider.summarizeArea({
            ...BASE,
            status: "Blocked",
            blockers: "Waiting on vendor RMA for two failed uplinks.",
        });

        expect(result.summary).toContain("blocked");
        expect(result.summary).toContain("Priya Raman");
        expect(result.summary).toContain("vendor RMA");
        expect(result.headlineBlocker).toBe("Waiting on vendor RMA for two failed uplinks.");
    });

    it("derives a high risk level from a Blocked status", async () => {
        const provider = new MockLlmProvider();

        const result = await provider.summarizeArea({ ...BASE, status: "Blocked" });

        expect(result.riskLevel).toBe("high");
    });

    it("derives risk from the other statuses too", async () => {
        const provider = new MockLlmProvider();

        const risks = await Promise.all(
            ["At Risk", "Done", "On Track"].map(async (status) =>
                (await provider.summarizeArea({ ...BASE, status })).riskLevel,
            ),
        );

        expect(risks).toEqual(["medium", "none", "low"]);
    });

    it("reports low confidence when notes and blockers are both empty", async () => {
        const provider = new MockLlmProvider();

        const thin = await provider.summarizeArea({ ...BASE, notes: null, blockers: null });
        const populated = await provider.summarizeArea(BASE);

        expect(thin.confidence).toBe("low");
        expect(thin.summary).toContain("not enough detail");
        expect(populated.confidence).toBe("high");
    });
});

describe("MockLlmProvider.answerWithContext", () => {
    it("refuses with the exact no-answer text when nothing was retrieved", async () => {
        const provider = new MockLlmProvider();

        await expect(provider.answerWithContext("How do we roll back?", [])).resolves.toBe(
            NO_ANSWER_TEXT,
        );
    });

    it("cites the top passage", async () => {
        const provider = new MockLlmProvider();

        const answer = await provider.answerWithContext("When do uplink swaps run?", [PASSAGE]);

        expect(answer).toContain("Uplink swaps run during the Saturday window");
        expect(answer).toContain("[1]");
    });
});
