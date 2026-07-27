import { describe, expect, it } from "vitest";

import { hasStatusChanged, shouldAlert, type TransitionPolicy } from "@/services/transitions";

const policy: TransitionPolicy = {
    alertStatuses: ["At Risk", "Blocked"],
    alertOnFirstSeen: false,
};

describe("hasStatusChanged", () => {
    it("detects a change", () => {
        expect(hasStatusChanged("On Track", "Blocked")).toBe(true);
    });

    it("treats an unchanged status as no change", () => {
        expect(hasStatusChanged("Blocked", "Blocked")).toBe(false);
    });

    it("treats a first observation as a change", () => {
        expect(hasStatusChanged(null, "On Track")).toBe(true);
    });
});

describe("shouldAlert", () => {
    it.each([
        ["On Track", "Blocked", true],
        ["On Track", "At Risk", true],
        ["At Risk", "Blocked", true],
        ["Blocked", "At Risk", true],
    ])("alerts on %s -> %s", (from, to, expected) => {
        expect(shouldAlert(from, to, policy)).toBe(expected);
    });

    it.each([
        ["Blocked", "On Track"],
        ["At Risk", "Done"],
        ["On Track", "Done"],
    ])("does not alert on recovery %s -> %s", (from, to) => {
        expect(shouldAlert(from, to, policy)).toBe(false);
    });

    it("does not re-alert while the status is unchanged", () => {
        expect(shouldAlert("Blocked", "Blocked", policy)).toBe(false);
        expect(shouldAlert("At Risk", "At Risk", policy)).toBe(false);
    });

    it("stays quiet on first observation by default", () => {
        expect(shouldAlert(null, "Blocked", policy)).toBe(false);
        expect(shouldAlert(null, "At Risk", policy)).toBe(false);
    });

    it("alerts on first observation when explicitly enabled", () => {
        const eager = { ...policy, alertOnFirstSeen: true };
        expect(shouldAlert(null, "Blocked", eager)).toBe(true);
        // Still only for alertable statuses.
        expect(shouldAlert(null, "On Track", eager)).toBe(false);
    });

    it("compares statuses case-insensitively", () => {
        expect(shouldAlert("On Track", "blocked", policy)).toBe(true);
        expect(shouldAlert("On Track", "  AT RISK  ", policy)).toBe(true);
    });

    it("ignores a status that is not configured as alertable", () => {
        const narrow = { ...policy, alertStatuses: ["Blocked"] };
        expect(shouldAlert("On Track", "At Risk", narrow)).toBe(false);
        expect(shouldAlert("On Track", "Blocked", narrow)).toBe(true);
    });
});
