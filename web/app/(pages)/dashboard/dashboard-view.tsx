"use client";

import { AreaCard, AreaCardSkeleton } from "@/components/dashboard/area-card";
import { KpiRow, KpiRowSkeleton } from "@/components/dashboard/kpi-row";
import { SyncBar } from "@/components/dashboard/sync-bar";
import { NoRecordFound, ServerError } from "@/components/placeholders";
import { Button } from "@/components/ui/button";
import { useAreas, useSyncNow } from "@/hooks/use-dashboard";

export function DashboardView() {
    const { data, isPending, isError, refetch } = useAreas();
    const sync = useSyncNow();

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
            <KpiRow counts={data.counts} />

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
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.areas.map((area) => (
                        <AreaCard key={area.id} area={area} />
                    ))}
                </div>
            )}
        </div>
    );
}
