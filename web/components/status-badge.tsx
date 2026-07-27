import { Check, Circle, Square, Triangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const AREA_STATUSES = ["On Track", "At Risk", "Blocked", "Done"] as const;
export type AreaStatus = (typeof AREA_STATUSES)[number];

type StatusMeta = {
    label: string;
    /**
     * Shape is the primary encoding, not decoration. On Track green and Blocked
     * red separate by only ΔE 4.1 under deuteranope simulation -- effectively the
     * same color to a red-green colorblind reader. See the block comment in
     * globals.css.
     */
    icon: LucideIcon;
    /** CSS var for the saturated mark hue. */
    hue: string;
    /** CSS var for the contrast-checked text/glyph color. */
    ink: string;
};

export const STATUS_META: Record<AreaStatus, StatusMeta> = {
    "On Track": {
        label: "On Track",
        icon: Circle,
        hue: "var(--status-on-track)",
        ink: "var(--status-on-track-ink)",
    },
    "At Risk": {
        label: "At Risk",
        icon: Triangle,
        hue: "var(--status-at-risk)",
        ink: "var(--status-at-risk-ink)",
    },
    Blocked: {
        label: "Blocked",
        icon: Square,
        hue: "var(--status-blocked)",
        ink: "var(--status-blocked-ink)",
    },
    Done: {
        label: "Done",
        icon: Check,
        hue: "var(--status-done)",
        ink: "var(--status-done-ink)",
    },
};

/** Tolerates a status renamed upstream in Notion rather than rendering nothing. */
export function statusMeta(status: string): StatusMeta {
    return (
        STATUS_META[status as AreaStatus] ?? {
            label: status || "Unknown",
            icon: Circle,
            hue: "var(--status-done)",
            ink: "var(--status-done-ink)",
        }
    );
}

export function StatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const meta = statusMeta(status);
    const Icon = meta.icon;

    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                className,
            )}
            style={{
                color: meta.ink,
                borderColor: `color-mix(in oklab, ${meta.hue} 35%, transparent)`,
                backgroundColor: `color-mix(in oklab, ${meta.hue} 12%, transparent)`,
            }}
        >
            <Icon className="size-3 fill-current" aria-hidden />
            {meta.label}
        </span>
    );
}
