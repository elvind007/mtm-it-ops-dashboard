import { config } from "@/config";
import { logger } from "@/logger";
import { NO_ANSWER_TEXT } from "@/providers/llm/prompts";
import { searchChunks } from "@/services/rag/repository";
import type { EmbeddingProvider, LlmProvider, RetrievedChunk } from "@/types";

export interface RagAnswer {
    answer: string;
    citations: RetrievedChunk[];
    /** False when retrieval short-circuited before reaching the model. */
    usedLlm: boolean;
}

/**
 * Answers a question strictly from the indexed corpus.
 *
 * The similarity floor is the important part. If no chunk clears
 * `RAG_MIN_SCORE`, this returns the refusal string *without calling the LLM*.
 * That does two things at once: it saves the tokens a doomed call would spend,
 * and it removes the opportunity for the model to answer from its own training
 * data -- the guarantee "answers come only from your documents" is enforced by
 * retrieval, not merely requested in the prompt.
 */
export async function answerQuestion(
    question: string,
    llm: LlmProvider,
    embedder: EmbeddingProvider,
): Promise<RagAnswer> {
    const [embedding] = await embedder.embed([question]);
    if (!embedding) {
        throw new Error("embedding provider returned no vector for the question");
    }

    const hits = await searchChunks(embedding, config.RAG_TOP_K);
    const relevant = hits
        .filter((hit) => hit.score >= config.RAG_MIN_SCORE)
        // Re-number after filtering so citations stay contiguous ([1], [2], ...).
        .map((hit, index) => ({ ...hit, n: index + 1 }));

    if (relevant.length === 0) {
        logger.info(
            { question, topScore: hits[0]?.score ?? 0, floor: config.RAG_MIN_SCORE },
            "rag: nothing cleared the similarity floor, refusing without an llm call",
        );
        return { answer: NO_ANSWER_TEXT, citations: [], usedLlm: false };
    }

    const answer = await llm.answerWithContext(question, relevant);
    return { answer, citations: relevant, usedLlm: true };
}
