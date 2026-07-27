import { pool, query } from "@/db/pool";
import type { RetrievedChunk } from "@/types";

/**
 * pgvector expects a bracketed, comma-separated literal (e.g. `[0.1,0.2]`). It is
 * built as a string and bound as a parameter -- never interpolated into the SQL --
 * so a vector can't carry an injection payload.
 */
function toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
}

/**
 * Replaces a document and its chunks atomically.
 *
 * Idempotent on `source` (the filename): reseeding overwrites in place rather than
 * duplicating, so `npm run seed:rag` is safe to run repeatedly. The old chunks are
 * deleted and reinserted inside one transaction so a crash mid-seed can't leave a
 * document half-embedded.
 */
export async function upsertDocument(
    source: string,
    title: string,
    content: string,
    chunks: string[],
    embeddings: number[][],
    embedModel: string,
): Promise<void> {
    if (chunks.length !== embeddings.length) {
        throw new Error(
            `chunk/embedding count mismatch for ${source}: ${chunks.length} vs ${embeddings.length}`,
        );
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const doc = await client.query<{ id: string }>(
            `INSERT INTO documents (source, title, content)
             VALUES ($1, $2, $3)
             ON CONFLICT (source) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content
             RETURNING id`,
            [source, title, content],
        );
        const documentId = doc.rows[0]?.id;
        if (!documentId) throw new Error(`upsert of document ${source} returned no id`);

        await client.query("DELETE FROM document_chunks WHERE document_id = $1", [documentId]);

        for (let i = 0; i < chunks.length; i += 1) {
            await client.query(
                `INSERT INTO document_chunks (document_id, chunk_index, content, embedding, embed_model)
                 VALUES ($1, $2, $3, $4, $5)`,
                [documentId, i, chunks[i], toVectorLiteral(embeddings[i] as number[]), embedModel],
            );
        }

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Cosine nearest-neighbour search over the chunk embeddings.
 *
 * `<=>` is pgvector's cosine *distance* in [0, 2]; similarity is `1 - distance`,
 * which for the normalized vectors both providers emit lands in [0, 1]. The `n`
 * field is the 1-based rank, matching the citation markers the RAG prompt asks the
 * model to reproduce.
 */
export async function searchChunks(
    embedding: number[],
    topK: number,
): Promise<RetrievedChunk[]> {
    const { rows } = await query<Record<string, unknown>>(
        `SELECT c.content, d.source, d.title,
                1 - (c.embedding <=> $1) AS score
         FROM document_chunks c
         JOIN documents d ON d.id = c.document_id
         ORDER BY c.embedding <=> $1
         LIMIT $2`,
        [toVectorLiteral(embedding), topK],
    );

    return rows.map((r, index) => ({
        n: index + 1,
        source: r.source as string,
        title: r.title as string,
        content: r.content as string,
        score: Number(r.score ?? 0),
    }));
}

export async function countChunks(): Promise<number> {
    const { rows } = await query<{ count: string }>("SELECT COUNT(*) AS count FROM document_chunks");
    return Number(rows[0]?.count ?? 0);
}
