"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { AreaCard, AreaCardSkeleton } from "@/components/dashboard/area-card";
import { KpiRow, KpiRowSkeleton } from "@/components/dashboard/kpi-row";
import { SyncBar } from "@/components/dashboard/sync-bar";
import { NoRecordFound, ServerError } from "@/components/placeholders";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAreas, useAutoSync, useSyncNow } from "@/hooks/use-dashboard";
import type { Area } from "@/types/api";

/** Operational urgency, most-urgent first. Unknown statuses sort last. */
const URGENCY: Record<string, number> = {
    Blocked: 0,
    "At Risk": 1,
    "On Track": 2,
    Done: 3,
};

const urgencyRank = (status: string): number => URGENCY[status] ?? 4;

/** Filter to the selected status (if any), then sort by urgency, title as tiebreaker. */
function orderAreas(areas: Area[], activeStatus: string | null): Area[] {
    return areas
        .filter((area) => activeStatus === null || area.status === activeStatus)
        .slice()
        .sort(
            (a, b) =>
                urgencyRank(a.status) - urgencyRank(b.status) ||
                a.title.localeCompare(b.title),
        );
}

export function DashboardView() {
    const { data, isPending, isError, refetch } = useAreas();
    const sync = useSyncNow();
    const [activeStatus, setActiveStatus] = useState<string | null>(null);

    // Force a fresh sync on open / refocus so a just-made Notion change is on screen
    // within seconds, not a full poll interval later. Guarded + silent (see the hook).
    useAutoSync(data?.lastSync?.finishedAt ?? data?.lastSync?.startedAt ?? null);

    const visibleAreas = useMemo(
        () => (data ? orderAreas(data.areas, activeStatus) : []),
        [data, activeStatus],
    );

    if (isError) {
        return (
            <ServerError
                action={
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                        Try again
                    </Button>
                }
            />
        );
    }

    if (isPending) {
        return (
            <div className="space-y-4">
                <KpiRowSkeleton />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <AreaCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SyncBar lastSync={data.lastSync} />
            <KpiRow counts={data.counts} activeStatus={activeStatus} onSelect={setActiveStatus} />

            {activeStatus && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Showing:</span>
                    <StatusBadge status={activeStatus} />
                    <button
                        type="button"
                        onClick={() => setActiveStatus(null)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium hover:bg-accent hover:text-foreground"
                    >
                        <X className="size-3" aria-hidden />
                        Clear
                    </button>
                </div>
            )}

            {data.areas.length === 0 ? (
                <NoRecordFound
                    action={
                        <Button
                            size="sm"
                            onClick={() => sync.mutate()}
                            disabled={sync.isPending}
                        >
                            {sync.isPending ? "Syncing…" : "Run first sync"}
                        </Button>
                    }
                />
            ) : visibleAreas.length === 0 ? (
                <NoRecordFound
                    action={
                        <Button size="sm" variant="outline" onClick={() => setActiveStatus(null)}>
                            Clear filter
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleAreas.map((area) => (
                        <AreaCard key={area.id} area={area} />
                    ))}
                </div>
            )}
        </div>
    );
}
