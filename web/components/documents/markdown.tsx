import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Renders indexed document markdown. GFM is on (tables matter for SLA grids);
 * raw HTML is deliberately off so corpus content cannot inject markup.
 */
export function DocumentMarkdown({
    content,
    className,
}: {
    content: string;
    className?: string;
}) {
    return (
        <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    );
}
