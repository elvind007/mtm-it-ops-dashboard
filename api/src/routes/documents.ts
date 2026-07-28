import { Router } from "express";

import { asyncHandler } from "@/http/async-handler";
import { HttpError } from "@/http/errors";
import { getDocumentBySource, listDocuments } from "@/services/rag/repository";

/**
 * Read-only viewer for the seeded RAG corpus. Serves the same `documents` rows the
 * retrieval reads from, so the page shows exactly what an Ask answer is grounded in
 * -- the point is to let a reader verify a response against its source.
 */
export const documentsRouter: Router = Router();

documentsRouter.get(
    "/documents",
    asyncHandler(async (_req, res) => {
        const documents = await listDocuments();
        res.json({ documents });
    }),
);

documentsRouter.get(
    "/documents/:source",
    asyncHandler(async (req, res) => {
        const source = typeof req.params.source === "string" ? req.params.source : "";
        const document = await getDocumentBySource(source);
        if (!document) {
            throw new HttpError(404, `No indexed document named '${source}'`);
        }
        res.json(document);
    }),
);
