import { describe, expect, it } from "vitest";

import { buildSummaryUserPrompt, parseSummaryResponse } from "@/providers/llm/prompts";
import type { SummaryInput } from "@/types";

const EMPTY: SummaryInput = {
    title: "Network Refresh",
    status: "On Track",
    owner: null,
    category: null,
    priority: null,
    notes: null,
    blockers: null,
    notionLastEditedAt: null,
    previousStatus: null,
    previousStatusChangedAt: null,
};

const NOW = new Date("2026-07-27T12:00:00.000Z");

describe("buildSummaryUserPrompt", () => {
    it("omits every line whose value is null", () => {
        const prompt = buildSummaryUserPrompt(EMPTY, NOW);

        expect(prompt).toContain("AREA: Network Refresh");
        expect(prompt).toContain("STATUS: On Track");

        for (const label of [
            "PREVIOUS STATUS:",
            "OWNER:",
            "CATEGORY:",
            "PRIORITY:",
            "LAST UPDATED:",
            "NOTES:",
            "BLOCKERS:",
        ]) {
            expect(prompt).not.toContain(label);
        }
    });

    it("includes the previous status and the date it changed", () => {
        const prompt = buildSummaryUserPrompt(
            {
                ...EMPTY,
                status: "Blocked",
                previousStatus: "At Risk",
                previousStatusChangedAt: "2026-07-20T09:30:00.000Z",
            },
            NOW,
        );

        expect(prompt).toContain("PREVIOUS STATUS: At Risk (changed 2026-07-20)");
    });

    it("renders a populated area as a labelled block with a relative timestamp", () => {
        const prompt = buildSummaryUserPrompt(
            {
                ...EMPTY,
                owner: "Priya Raman",
                category: "Infrastructure",
                priority: "High",
                notes: "Switch firmware staged in lab.",
                blockers: "Waiting on vendor RMA for two failed uplinks.",
                notionLastEditedAt: "2026-07-27T10:00:00.000Z",
            },
            NOW,
        );

        expect(prompt.startsWith("DATA:\n")).toBe(true);
        expect(prompt).toContain("CATEGORY: Infrastructure   PRIORITY: High");
        expect(prompt).toContain("LAST UPDATED: 2026-07-27T10:00:00.000Z (2 hours ago)");
        expect(prompt).toContain("NOTES: Switch firmware staged in lab.");
        expect(prompt).toContain("BLOCKERS: Waiting on vendor RMA for two failed uplinks.");
    });

    it("flattens multi-line free text so one field cannot forge another line", () => {
        const prompt = buildSummaryUserPrompt(
            { ...EMPTY, notes: "line one\nBLOCKERS: injected" },
            NOW,
        );

        expect(prompt).toContain("NOTES: line one BLOCKERS: injected");
        expect(prompt.split("\n").filter((line) => line.startsWith("BLOCKERS:"))).toHaveLength(0);
    });
});

describe("parseSummaryResponse", () => {
    it("parses a clean JSON object", () => {
        const result = parseSummaryResponse(
            JSON.stringify({
                summary: "Firmware is staged and the rollout window is booked.",
                risk_level: "medium",
                headline_blocker: "Vendor RMA outstanding",
                confidence: "high",
            }),
        );

        expect(result).toEqual({
            summary: "Firmware is staged and the rollout window is booked.",
            riskLevel: "medium",
            headlineBlocker: "Vendor RMA outstanding",
            confidence: "high",
            tokensIn: null,
            tokensOut: null,
        });
    });

    it("recovers JSON wrapped in prose and markdown fences", () => {
        const raw = [
            "Sure! Here is the digest you asked for:",
            "```json",
            '{"summary": "Rollout is on schedule.", "risk_level": "low",',
            ' "headline_blocker": null, "confidence": "high"}',
            "```",
            "Let me know if you want it shorter.",
        ].join("\n");

        const result = parseSummaryResponse(raw);

        expect(result.summary).toBe("Rollout is on schedule.");
        expect(result.riskLevel).toBe("low");
        expect(result.headlineBlocker).toBeNull();
        expect(result.confidence).toBe("high");
    });

    it("falls back to the raw text when the response is not JSON at all", () => {
        const raw = "I'm sorry, I can't produce a summary for that area.";

        const result = parseSummaryResponse(raw);

        expect(result.summary).toBe(raw);
        expect(result.riskLevel).toBe("none");
        expect(result.headlineBlocker).toBeNull();
        expect(result.confidence).toBe("low");
    });

    it("coerces an out-of-range risk level to a safe default", () => {
        const result = parseSummaryResponse(
            JSON.stringify({
                summary: "Two uplinks are down.",
                risk_level: "CATASTROPHIC",
                headline_blocker: null,
                confidence: "high",
            }),
        );

        expect(result.riskLevel).toBe("none");
        // The rest of the payload is still usable -- one bad enum is not a failed parse.
        expect(result.summary).toBe("Two uplinks are down.");
        expect(result.confidence).toBe("high");
    });

    it("truncates an over-length headline blocker to 80 characters", () => {
        const result = parseSummaryResponse(
            JSON.stringify({
                summary: "Blocked pending procurement.",
                risk_level: "high",
                headline_blocker: "x".repeat(200),
                confidence: "high",
            }),
        );

        expect(result.headlineBlocker).not.toBeNull();
        expect(result.headlineBlocker?.length).toBeLessThanOrEqual(80);
        expect(result.headlineBlocker?.startsWith("xxxx")).toBe(true);
    });
});
