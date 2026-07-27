import { describe, expect, it } from "vitest";

import { mapNotionPage } from "@/providers/notion/mapper";

function titleProp(text: string) {
    return { id: "title", type: "title", title: [{ type: "text", plain_text: text }] };
}

function richTextProp(runs: string[]) {
    return {
        id: "rt",
        type: "rich_text",
        rich_text: runs.map((text) => ({ type: "text", plain_text: text })),
    };
}

function selectProp(name: string | null) {
    return { id: "sel", type: "select", select: name === null ? null : { id: "opt", name, color: "blue" } };
}

function fullyPopulatedPage() {
    return {
        id: "page-1",
        url: "https://notion.so/page-1",
        last_edited_time: "2026-07-27T10:00:00.000Z",
        properties: {
            Name: titleProp("Identity & Access Management"),
            Status: selectProp("On Track"),
            Owner: richTextProp(["Priya Raman"]),
            Category: selectProp("Security"),
            Priority: selectProp("P1"),
            Notes: richTextProp(["SSO rollout has reached 60% of staff."]),
            Blockers: richTextProp(["Vendor RMA open 9 days."]),
        },
    };
}

describe("mapNotionPage", () => {
    it("maps a fully-populated page", () => {
        const area = mapNotionPage(fullyPopulatedPage());

        expect(area).toEqual({
            notionPageId: "page-1",
            notionUrl: "https://notion.so/page-1",
            title: "Identity & Access Management",
            status: "On Track",
            owner: "Priya Raman",
            category: "Security",
            priority: "P1",
            notes: "SSO rollout has reached 60% of staff.",
            blockers: "Vendor RMA open 9 days.",
            notionLastEditedAt: "2026-07-27T10:00:00.000Z",
        });
    });

    it("degrades a missing Blockers property to null instead of throwing", () => {
        const page = fullyPopulatedPage();
        const properties = page.properties as Record<string, unknown>;
        delete properties.Blockers;

        const area = mapNotionPage(page);

        expect(area).not.toBeNull();
        expect(area?.blockers).toBeNull();
    });

    it("treats an empty rich_text array as null, not an empty string", () => {
        const page = fullyPopulatedPage();
        page.properties.Notes = richTextProp([]);

        const area = mapNotionPage(page);

        expect(area?.notes).toBeNull();
    });

    it("degrades a null Status select to an empty string", () => {
        const page = fullyPopulatedPage();
        page.properties.Status = selectProp(null);

        const area = mapNotionPage(page);

        expect(area).not.toBeNull();
        expect(area?.status).toBe("");
    });

    it("returns null when the page has no Name property at all", () => {
        const page = fullyPopulatedPage();
        const properties = page.properties as Record<string, unknown>;
        delete properties.Name;

        expect(mapNotionPage(page)).toBeNull();
    });

    it("concatenates plain_text across multiple rich_text runs, in order", () => {
        const page = fullyPopulatedPage();
        page.properties.Notes = richTextProp(["First part. ", "Second part. ", "Third part."]);

        const area = mapNotionPage(page);

        expect(area?.notes).toBe("First part. Second part. Third part.");
    });

    it("returns null for a page with no usable id", () => {
        const page = { ...fullyPopulatedPage(), id: "" };

        expect(mapNotionPage(page)).toBeNull();
    });

    it("does not throw on a completely malformed page", () => {
        expect(mapNotionPage(null)).toBeNull();
        expect(mapNotionPage(undefined)).toBeNull();
        expect(mapNotionPage("not a page")).toBeNull();
        expect(mapNotionPage({})).toBeNull();
        expect(mapNotionPage({ id: "page-2", properties: "unexpected" })).toBeNull();
    });
});
