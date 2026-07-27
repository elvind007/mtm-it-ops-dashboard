import type { NotionArea } from "@/types";

/**
 * Translates raw Notion API page objects into `NotionArea`.
 *
 * Notion's shape is untyped from our side and drifts easily -- a renamed property,
 * a cleared select, an empty rich_text run. None of that should ever crash a sync;
 * it should just come through as a null field so the rest of the pipeline (and the
 * dashboard) can display "unknown" instead of falling over.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getProperties(page: unknown): Record<string, unknown> | null {
    if (!isRecord(page)) return null;
    return isRecord(page.properties) ? page.properties : null;
}

/** Concatenates `plain_text` across every run of a Notion `title` property. */
export function readTitleText(
    properties: Record<string, unknown> | null,
    key: string,
): string {
    const prop = properties?.[key];
    if (!isRecord(prop) || !Array.isArray(prop.title)) return "";

    return prop.title
        .map((run) => (isRecord(run) && typeof run.plain_text === "string" ? run.plain_text : ""))
        .join("");
}

/** Concatenates `plain_text` across every run of a Notion `rich_text` property. */
export function readRichText(
    properties: Record<string, unknown> | null,
    key: string,
): string | null {
    const prop = properties?.[key];
    if (!isRecord(prop) || !Array.isArray(prop.rich_text)) return null;

    const text = prop.rich_text
        .map((run) => (isRecord(run) && typeof run.plain_text === "string" ? run.plain_text : ""))
        .join("");

    return text.length > 0 ? text : null;
}

/** Reads the selected option's name off a Notion `select` property. */
export function readSelect(
    properties: Record<string, unknown> | null,
    key: string,
): string | null {
    const prop = properties?.[key];
    if (!isRecord(prop) || !isRecord(prop.select)) return null;

    return typeof prop.select.name === "string" ? prop.select.name : null;
}

/**
 * Returns `null` only when the page carries nothing usable -- no id, or no title.
 * Every other missing/renamed/nulled property degrades to a null field instead.
 */
export function mapNotionPage(page: unknown): NotionArea | null {
    if (!isRecord(page)) return null;

    const id = page.id;
    if (typeof id !== "string" || id.length === 0) return null;

    const properties = getProperties(page);
    const title = readTitleText(properties, "Name");
    if (title.length === 0) return null;

    return {
        notionPageId: id,
        notionUrl: typeof page.url === "string" ? page.url : null,
        title,
        // NotionArea.status is non-nullable -- an absent/renamed Status select
        // degrades to "" rather than null so the type stays honest.
        status: readSelect(properties, "Status") ?? "",
        owner: readRichText(properties, "Owner"),
        category: readSelect(properties, "Category"),
        priority: readSelect(properties, "Priority"),
        notes: readRichText(properties, "Notes"),
        blockers: readRichText(properties, "Blockers"),
        notionLastEditedAt: typeof page.last_edited_time === "string" ? page.last_edited_time : null,
    };
}
