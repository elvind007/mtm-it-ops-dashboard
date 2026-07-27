/**
 * Markdown-aware chunker for the RAG corpus.
 *
 * Two levels of document structure drive the split: markdown headings are hard
 * boundaries (a heading always starts a new chunk, so a citation never straddles
 * two sections), and paragraphs are the atomic unit packed inside each chunk up to
 * ~`size` characters. `overlap` characters of trailing context are carried from one
 * chunk into the next when a *size* boundary forces a break -- headings do not carry
 * overlap, since the heading text itself already re-establishes context for whoever
 * (or whatever) reads the chunk next.
 */

const HEADING_LINE = /^(#{1,6}\s+.+)$/m;

interface Unit {
    text: string;
    isHeading: boolean;
}

export function chunkDocument(text: string, opts: { size: number; overlap: number }): string[] {
    const { size, overlap } = opts;

    if (overlap >= size) {
        throw new Error(`chunkDocument: overlap (${overlap}) must be less than size (${size}).`);
    }

    const units = toUnits(text);
    const chunks: string[] = [];
    let current = "";

    const flush = () => {
        const trimmed = current.trim();
        if (trimmed.length > 0) chunks.push(trimmed);
        current = "";
    };

    for (const unit of units) {
        // A heading is a hard boundary: close out whatever chunk was accumulating
        // before it, with no overlap carried across the seam.
        if (unit.isHeading && current.trim().length > 0) {
            flush();
        }

        const candidate = current.length > 0 ? `${current}\n\n${unit.text}` : unit.text;

        if (candidate.length <= size || current.length === 0) {
            // Either it fits, or `current` is empty and this unit has to go somewhere
            // regardless of size -- paragraphs are atomic, we never split inside one.
            current = candidate;
            continue;
        }

        // Adding this unit would overflow the target size: close the current chunk
        // and seed the next one with the trailing `overlap` characters of context.
        const tail = current.slice(-overlap).trim();
        flush();
        current = tail.length > 0 ? `${tail}\n\n${unit.text}` : unit.text;
    }

    flush();

    return chunks;
}

/** Splits raw markdown into heading and paragraph units, dropping blank ones. */
function toUnits(text: string): Unit[] {
    const parts = text.split(HEADING_LINE);
    const units: Unit[] = [];

    for (const part of parts) {
        if (HEADING_LINE.test(part) && part.trim().startsWith("#")) {
            units.push({ text: part.trim(), isHeading: true });
            continue;
        }

        for (const paragraph of part.split(/\n\s*\n/)) {
            const trimmed = paragraph.trim();
            if (trimmed.length > 0) units.push({ text: trimmed, isHeading: false });
        }
    }

    return units;
}
