import { describe, expect, it } from "vitest";

import { sanitizeUrl } from "@/db/repositories/integration-logs";

describe("sanitizeUrl", () => {
    it("keeps host and path", () => {
        expect(sanitizeUrl("https://api.notion.com/v1/databases/abc/query")).toBe(
            "api.notion.com/v1/databases/abc/query",
        );
    });

    it("drops the query string, where tokens hide", () => {
        expect(sanitizeUrl("https://example.com/webhook?token=secret&sig=abc")).toBe(
            "example.com/webhook",
        );
    });

    it("drops the fragment", () => {
        expect(sanitizeUrl("https://example.com/path#section")).toBe("example.com/path");
    });

    it("tolerates a relative path by stripping its query", () => {
        expect(sanitizeUrl("/api/logs?limit=50")).toBe("/api/logs");
    });

    it("returns a non-URL string unchanged up to the first ?", () => {
        expect(sanitizeUrl("not a url")).toBe("not a url");
    });
});
