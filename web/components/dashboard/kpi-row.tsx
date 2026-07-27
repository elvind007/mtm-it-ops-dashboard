import { Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { statusMeta } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AreasResponse } from "@/types/api";

/**
 * Four counts, four tiles.
 *
 * Deliberately not a chart: with a single number per category there is no shape,
 * trend, or part-to-whole relationship for a plot to reveal, so a bar chart here
 * would add axes and gridlines to communicate strictly less than the number does.
 *
 * The tiles double as a status filter for the board below. Each status tile toggles
 * a filter to that status; the Total tile (and re-clicking an active tile) clears it.
 */

type Tile = {
    key: string;
    label: string;
    value: number;
    icon: LucideIcon;
    hue: string;
    ink: string;
    /** The status this tile filters to; null clears the filter (the Total tile). */
    filter: string | null;
};

function buildTiles(counts: AreasResponse["counts"]): Tile[] {
    const onTrack = statusMeta("On Track");
    const atRisk = statusMeta("At Risk");
    const blocked = statusMeta("Blocked");

    return [
        {
            key: "total",
            label: "Tracked areas",
            value: counts.total,
            icon: Layers,
            hue: "var(--muted-foreground)",
            ink: "var(--foreground)",
            filter: null,
        },
        {
            key: "onTrack",
            label: "On Track",
            value: counts.onTrack,
            icon: onTrack.icon,
            hue: onTrack.hue,
            ink: onTrack.ink,
            filter: "On Track",
        },
        {
            key: "atRisk",
            label: "At Risk",
            value: counts.atRisk,
            icon: atRisk.icon,
            hue: atRisk.hue,
            ink: atRisk.ink,
            filter: "At Risk",
        },
        {
            key: "blocked",
            label: "Blocked",
            value: counts.blocked,
            icon: blocked.icon,
            hue: blocked.hue,
            ink: blocked.ink,
            filter: "Blocked",
        },
    ];
}

export function KpiRow({
    counts,
    activeStatus,
    onSelect,
}: {
    counts: AreasResponse["counts"];
    activeStatus: string | null;
    /** Toggles the board filter. Passing a tile's own status again clears it. */
    onSelect: (status: string | null) => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {buildTiles(counts).map((tile) => {
                const Icon = tile.icon;
                const active = tile.filter !== null && tile.filter === activeStatus;
                return (
                    <Card
                        key={tile.key}
                        role="button"
                        tabIndex={0}
                        aria-pressed={active}
                        aria-label={
                            tile.filter === null
                                ? "Show all areas"
                                : `Filter to ${tile.label}`
                        }
                        onClick={() => onSelect(active ? null : tile.filter)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelect(active ? null : tile.filter);
                            }
                        }}
                        className={cn(
                            "cursor-pointer gap-0 p-4 transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            active && "ring-2 ring-ring",
                        )}
                        style={active ? { borderColor: tile.hue } : undefined}
                    >
                        <div className="flex items-center gap-2">
                            <Icon
                                className="size-3.5 fill-current"
                                style={{ color: tile.ink }}
                                aria-hidden
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                                {tile.label}
                            </span>
                        </div>
                        {/* Value wears an ink token, not the series hue -- the glyph
                            beside it already carries identity. */}
                        <div className="mt-2 text-3xl font-semibold tabular-nums">
                            {tile.value}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}

export function KpiRowSkeleton() {
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="gap-0 p-4">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="mt-3 h-8 w-12" />
                </Card>
            ))}
        </div>
    );
}
