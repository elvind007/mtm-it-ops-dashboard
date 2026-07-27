import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Sparkles, Zap } from "lucide-react";

import { StatusBadge, statusMeta } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Area } from "@/types/api";

function relative(iso: string | null): string {
    if (!iso) return "unknown";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "unknown";
    return formatDistanceToNow(date, { addSuffix: true });
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

export function AreaCard({ area }: { area: Area }) {
    const meta = statusMeta(area.status);
    const summary = area.summary;

    const meta_line = [area.owner, area.category, area.priority].filter(Boolean).join(" · ");

    return (
        <Card className="relative gap-0 overflow-hidden p-0">
            {/* Reinforcement only -- the badge below carries the actual encoding. */}
            <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: meta.hue }}
            />

            <div className="flex flex-col gap-3 p-4 pl-5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm leading-snug font-semibold">
                        {area.notionUrl ? (
                            <a
                                href={area.notionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-1.5 hover:underline"
                            >
                                {area.title}
                                <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                            </a>
                        ) : (
                            area.title
                        )}
                    </h3>
                    <StatusBadge status={area.status} />
                </div>

                {meta_line && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {area.owner && (
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground">
                                {initials(area.owner)}
                            </span>
                        )}
                        <span className="truncate">{meta_line}</span>
                    </div>
                )}

                {summary ? (
                    <div className="rounded-md bg-muted/50 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                            <Sparkles className="size-3" aria-hidden />
                            AI summary
                            {summary.confidence === "low" && (
                                <span className="rounded-sm bg-muted px-1 py-px text-[10px] normal-case">
                                    limited data
                                </span>
                            )}
                        </div>
                        <p className="text-xs leading-relaxed text-foreground/90">
                            {summary.text}
                        </p>
                    </div>
                ) : (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Summary pending — will be generated on the next sync.
                    </div>
                )}

                {area.blockers && (
                    <div
                        className="flex items-start gap-2 rounded-md px-2.5 py-2 text-xs"
                        style={{
                            color: statusMeta("Blocked").ink,
                            backgroundColor:
                                "color-mix(in oklab, var(--status-blocked) 10%, transparent)",
                        }}
                    >
                        <span className="mt-0.5 font-semibold">Blocked on:</span>
                        <span className="min-w-0 flex-1">{area.blockers}</span>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span>Updated {relative(area.notionLastEditedAt ?? area.updatedAt)}</span>
                    {summary && (
                        <>
                            <span aria-hidden>·</span>
                            <span className="font-mono">{summary.model}</span>
                            {/* Makes the caching requirement visible in the product,
                                not just in the code. Derived from whether the last
                                sync regenerated this summary. */}
                            {summary.cached && (
                                <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-px">
                                    <Zap className="size-2.5 fill-current" aria-hidden />
                                    cached
                                </span>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
}

export function AreaCardSkeleton() {
    return (
        <Card className="gap-0 p-4">
            <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3 w-32" />
            <Skeleton className="mt-3 h-16 w-full rounded-md" />
            <Skeleton className="mt-3 h-3 w-44" />
        </Card>
    );
}
