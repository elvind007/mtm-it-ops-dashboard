import { describe, expect, it } from "vitest";

import { HashEmbeddingProvider } from "@/providers/embeddings/hash";

const DIM = 384;
const provider = new HashEmbeddingProvider(DIM, "hash-test");

function cosine(a: number[], b: number[]): number {
    let dot = 0;
    for (let i = 0; i < a.length; i += 1) dot += (a[i] ?? 0) * (b[i] ?? 0);
    return dot; // vectors are already L2-normalized, so dot product is cosine
}

describe("HashEmbeddingProvider", () => {
    it("is deterministic", async () => {
        const [a] = await provider.embed(["the vpn concentrator is at capacity"]);
        const [b] = await provider.embed(["the vpn concentrator is at capacity"]);
        expect(a).toEqual(b);
    });

    it("produces vectors of the configured dimension", async () => {
        const [vec] = await provider.embed(["anything"]);
        expect(vec).toHaveLength(DIM);
    });

    it("produces unit-length vectors", async () => {
        const [vec] = await provider.embed(["patch management sla for critical cves"]);
        const norm = Math.sqrt((vec as number[]).reduce((sum, v) => sum + v * v, 0));
        expect(norm).toBeCloseTo(1, 5);
    });

    it("scores shared vocabulary higher than unrelated text", async () => {
        const [query] = await provider.embed(["how do I reset the vpn concentrator during an outage"]);
        const [related] = await provider.embed([
            "vpn concentrator outage: reset the device and fail traffic over",
        ]);
        const [unrelated] = await provider.embed([
            "annual license reconciliation reclaimed unused seats",
        ]);

        expect(cosine(query as number[], related as number[])).toBeGreaterThan(
            cosine(query as number[], unrelated as number[]),
        );
    });

    it("handles empty text without producing NaNs", async () => {
        const [vec] = await provider.embed([""]);
        expect((vec as number[]).every((v) => Number.isFinite(v))).toBe(true);
    });
});
