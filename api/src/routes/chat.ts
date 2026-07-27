import { Router } from "express";
import { z } from "zod";

import { config } from "@/config";
import { getEmbeddingProvider, getLlmProvider } from "@/container";
import { asyncHandler } from "@/http/async-handler";
import { badRequest, HttpError } from "@/http/errors";
import { answerQuestion } from "@/services/rag";

export const chatRouter: Router = Router();

const chatRequest = z.object({
    question: z.string().trim().min(3, "Question is too short").max(500, "Question is too long"),
});

chatRouter.post(
    "/chat",
    asyncHandler(async (req, res) => {
        if (!config.RAG_ENABLED) {
            throw new HttpError(503, "RAG chat is disabled (RAG_ENABLED=false)");
        }

        const parsed = chatRequest.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
        }

        const result = await answerQuestion(
            parsed.data.question,
            getLlmProvider(),
            getEmbeddingProvider(),
        );

        res.json({
            answer: result.answer,
            citations: result.citations.map((c) => ({
                n: c.n,
                source: c.source,
                title: c.title,
                score: Number(c.score.toFixed(4)),
            })),
            usedLlm: result.usedLlm,
        });
    }),
);
