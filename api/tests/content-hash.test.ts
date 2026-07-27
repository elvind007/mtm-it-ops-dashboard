import { describe, expect, it } from "vitest";

import { computeContentHash, type HashableArea } from "@/services/content-hash";

const base: HashableArea = {
    title: "Identity & Access Management",
    status: "On Track",
    owner: "Priya Raman",
    category: "Security",
    priority: "P1",
    notes: "SSO rollout has reached 60% of staff.",
    blockers: null,
};

describe("computeContentHash", () => {
    it("is stable across calls", () => {
        expect(computeContentHash(base)).toBe(computeContentHash(base));
    });

    it("ignores surrounding whitespace", () => {
        expect(computeContentHash({ ...base, notes: "  SSO rollout has reached 60% of staff.  " })).toBe(
            computeContentHash(base),
        );
    });

    it("treats null and empty string as equivalent", () => {
        expect(computeContentHash({ ...base, blockers: "" })).toBe(computeContentHash(base));
    });

    it.each([
        ["title", { title: "Identity and Access" }],
        ["status", { status: "Blocked" }],
        ["owner", { owner: "Someone Else" }],
        ["category", { category: "Infra" }],
        ["priority", { priority: "P0" }],
        ["notes", { notes: "Rollout paused." }],
        ["blockers", { blockers: "Waiting on vendor." }],
    ])("changes when %s changes", (_field, patch) => {
        expect(computeContentHash({ ...base, ...patch })).not.toBe(computeContentHash(base));
    });

    it("does not collide when content shifts across field boundaries", () => {
        const a = computeContentHash({ ...base, owner: "ab", category: "c" });
        const b = computeContentHash({ ...base, owner: "a", category: "bc" });
        expect(a).not.toBe(b);
    });
});
