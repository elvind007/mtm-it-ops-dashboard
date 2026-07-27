import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// The chat route pulls providers from the container and the RAG service from the
// database; both are mocked so this exercises only the route's own contract --
// validation, status codes, and response shaping.
vi.mock("@/container", () => ({
    getLlmProvider: () => ({ kind: "mock", model: "mock" }),
    getEmbeddingProvider: () => ({ kind: "hash", model: "hash", dimensions: 384 }),
}));

const answerQuestion = vi.fn();
vi.mock("@/services/rag", () => ({ answerQuestion: (...args: unknown[]) => answerQuestion(...args) }));

import { chatRouter } from "@/routes/chat";
import { errorHandler } from "@/http/errors";

function app() {
    const a = express();
    a.use(express.json());
    a.use("/api", chatRouter);
    a.use(errorHandler);
    return a;
}

describe("POST /api/chat", () => {
    it("rejects a question that is too short", async () => {
        const res = await request(app()).post("/api/chat").send({ question: "hi" });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/too short/i);
    });

    it("rejects a missing question", async () => {
        const res = await request(app()).post("/api/chat").send({});
        expect(res.status).toBe(400);
    });

    it("returns the answer and rounds citation scores", async () => {
        answerQuestion.mockResolvedValueOnce({
            answer: "Reset the concentrator [1].",
            citations: [
                { n: 1, source: "runbook-vpn-outage.md", title: "VPN Outage", content: "x", score: 0.87654 },
            ],
            usedLlm: true,
        });

        const res = await request(app())
            .post("/api/chat")
            .send({ question: "how do I fix the vpn?" });

        expect(res.status).toBe(200);
        expect(res.body.answer).toContain("[1]");
        expect(res.body.usedLlm).toBe(true);
        expect(res.body.citations[0]).toEqual({
            n: 1,
            source: "runbook-vpn-outage.md",
            title: "VPN Outage",
            score: 0.8765,
        });
        // The full chunk text is not leaked to the client.
        expect(res.body.citations[0]).not.toHaveProperty("content");
    });

    it("passes through the no-answer refusal with usedLlm false", async () => {
        answerQuestion.mockResolvedValueOnce({
            answer: "I don't have that in the indexed documents.",
            citations: [],
            usedLlm: false,
        });

        const res = await request(app())
            .post("/api/chat")
            .send({ question: "what is the airspeed of a swallow?" });

        expect(res.status).toBe(200);
        expect(res.body.usedLlm).toBe(false);
        expect(res.body.citations).toEqual([]);
    });
});
