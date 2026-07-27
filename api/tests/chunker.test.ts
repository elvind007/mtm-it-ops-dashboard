import { describe, expect, it } from "vitest";

import { chunkDocument } from "@/services/rag/chunker";

describe("chunkDocument", () => {
    it("returns a single chunk for text shorter than the size", () => {
        const chunks = chunkDocument("# Title\n\nA short paragraph.", { size: 800, overlap: 150 });
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toContain("A short paragraph.");
    });

    it("splits long text into multiple chunks", () => {
        const paragraph = "word ".repeat(60).trim(); // ~300 chars
        const text = Array.from({ length: 6 }, (_, i) => `Para ${i} ${paragraph}`).join("\n\n");
        const chunks = chunkDocument(text, { size: 400, overlap: 80 });
        expect(chunks.length).toBeGreaterThan(1);
    });

    it("never emits an empty or whitespace-only chunk", () => {
        const text = "# A\n\n\n\n## B\n\n   \n\nContent here.\n\n\n\n# C\n\nMore.";
        const chunks = chunkDocument(text, { size: 100, overlap: 20 });
        expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
    });

    it("starts a new chunk at a heading boundary", () => {
        const text = "# First\n\nAlpha content.\n\n# Second\n\nBeta content.";
        const chunks = chunkDocument(text, { size: 800, overlap: 150 });
        // Two headings, each small enough to stand alone -> two chunks, not merged.
        expect(chunks).toHaveLength(2);
        expect(chunks[0]).toContain("First");
        expect(chunks[0]).toContain("Alpha");
        expect(chunks[1]).toContain("Second");
        expect(chunks[1]).toContain("Beta");
    });

    it("carries overlap across a size-forced break", () => {
        const distinctive = "MARKER_TAIL_TOKEN";
        const first = `${"x".repeat(200)} ${distinctive}`;
        const second = "y".repeat(200);
        const chunks = chunkDocument(`${first}\n\n${second}`, { size: 260, overlap: 60 });
        expect(chunks.length).toBeGreaterThan(1);
        // The distinctive tail of chunk 1 should reappear at the head of chunk 2.
        expect(chunks[1]).toContain(distinctive);
    });

    it("throws when overlap is not smaller than size", () => {
        expect(() => chunkDocument("text", { size: 100, overlap: 100 })).toThrow(/overlap/);
        expect(() => chunkDocument("text", { size: 100, overlap: 150 })).toThrow(/overlap/);
    });
});
