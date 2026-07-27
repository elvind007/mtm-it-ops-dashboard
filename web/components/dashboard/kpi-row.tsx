import { Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { statusMeta } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AreasResponse } from "@/types/api";

/**
 * Four counts, four tiles.
 *
 * Deliberately not a chart: with a single number per category there is no shape,
 * trend, or part-to-whole relationship for a plot to reveal, so a bar chart here
 * would add axes and gridlines to communicate strictly less than the number does.
 */

type Tile = {
    key: string;
    label: string;
    value: number;
    icon: LucideIcon;
    hue: string;
    ink: string;
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
        },
        {
            key: "onTrack",
            label: "On Track",
            value: counts.onTrack,
            icon: onTrack.icon,
            hue: onTrack.hue,
            ink: onTrack.ink,
        },
        {
            key: "atRisk",
            label: "At Risk",
            value: counts.atRisk,
            icon: atRisk.icon,
            hue: atRisk.hue,
            ink: atRisk.ink,
        },
        {
            key: "blocked",
            label: "Blocked",
            value: counts.blocked,
            icon: blocked.icon,
            hue: blocked.hue,
            ink: blocked.ink,
        },
    ];
}

export function KpiRow({ counts }: { counts: AreasResponse["counts"] }) {
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {buildTiles(counts).map((tile) => {
                const Icon = tile.icon;
                return (
                    <Card key={tile.key} className="gap-0 p-4">
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
