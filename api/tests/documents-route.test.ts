import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// The repository hits Postgres; mock it so this exercises only the route contract --
// list shaping, get-by-source, and the 404 for an unknown document.
const listDocuments = vi.fn();
const getDocumentBySource = vi.fn();
vi.mock("@/services/rag/repository", () => ({
    listDocuments: (...args: unknown[]) => listDocuments(...args),
    getDocumentBySource: (...args: unknown[]) => getDocumentBySource(...args),
}));

import { documentsRouter } from "@/routes/documents";
import { errorHandler } from "@/http/errors";

function app() {
    const a = express();
    a.use(express.json());
    a.use("/api", documentsRouter);
    a.use(errorHandler);
    return a;
}

describe("GET /api/documents", () => {
    it("returns the document list", async () => {
        listDocuments.mockResolvedValueOnce([
            { source: "runbook-vpn-outage.md", title: "VPN Outage", chunkCount: 9, createdAt: "2026-01-01T00:00:00.000Z" },
        ]);

        const res = await request(app()).get("/api/documents");

        expect(res.status).toBe(200);
        expect(res.body.documents).toHaveLength(1);
        expect(res.body.documents[0].source).toBe("runbook-vpn-outage.md");
        expect(res.body.documents[0].chunkCount).toBe(9);
    });

    it("returns an empty list when the corpus is unseeded", async () => {
        listDocuments.mockResolvedValueOnce([]);
        const res = await request(app()).get("/api/documents");
        expect(res.status).toBe(200);
        expect(res.body.documents).toEqual([]);
    });
});

describe("GET /api/documents/:source", () => {
    it("returns the document content", async () => {
        getDocumentBySource.mockResolvedValueOnce({
            source: "runbook-vpn-outage.md",
            title: "VPN Outage",
            content: "# Runbook\n\nSteps...",
            chunkCount: 9,
            createdAt: "2026-01-01T00:00:00.000Z",
        });

        const res = await request(app()).get("/api/documents/runbook-vpn-outage.md");

        expect(res.status).toBe(200);
        expect(res.body.content).toContain("# Runbook");
        expect(getDocumentBySource).toHaveBeenCalledWith("runbook-vpn-outage.md");
    });

    it("404s an unknown document", async () => {
        getDocumentBySource.mockResolvedValueOnce(null);
        const res = await request(app()).get("/api/documents/nope.md");
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/no indexed document/i);
    });
});
