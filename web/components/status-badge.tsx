import { Check, Circle, Square, Triangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const AREA_STATUSES = [
    "On Track",
    "At Risk",
    "Blocked",
    "Done",
] as const;

export type AreaStatus = (typeof AREA_STATUSES)[number];

type StatusMeta = {
    label: string;
    icon: LucideIcon;
    /** Badge fill + text, tuned for both themes. */
    badge: string;
    /** Left rail on the area card. */
    rail: string;
    /** Standalone icon/number colour for KPI tiles. */
    accent: string;
};

/**
 * Status is never communicated by colour alone — every entry pairs a hue with a
 * distinct shape, so the board stays readable for colour-blind users and in
 * greyscale screenshots.
 */
export const STATUS_META: Record<AreaStatus, StatusMeta> = {
    "On Track": {
        label: "On Track",
        icon: Circle,
        badge: "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
        rail: "bg-emerald-500",
        accent: "text-emerald-600 dark:text-emerald-400",
    },
    "At Risk": {
        label: "At Risk",
        icon: Triangle,
        badge: "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
        rail: "bg-amber-500",
        accent: "text-amber-600 dark:text-amber-400",
    },
    Blocked: {
        label: "Blocked",
        icon: Square,
        badge: "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
        rail: "bg-rose-500",
        accent: "text-rose-600 dark:text-rose-400",
    },
    Done: {
        label: "Done",
        icon: Check,
        badge: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:border-zinc-400/20 dark:bg-zinc-400/10 dark:text-zinc-400",
        rail: "bg-zinc-400",
        accent: "text-zinc-500 dark:text-zinc-400",
    },
};

const UNKNOWN_META: StatusMeta = {
    label: "Unknown",
    icon: Circle,
    badge: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    rail: "bg-zinc-300 dark:bg-zinc-700",
    accent: "text-zinc-500",
};

/** Tolerates anything Notion hands us, including a status that was renamed upstream. */
export function statusMeta(status: string): StatusMeta {
    return STATUS_META[status as AreaStatus] ?? { ...UNKNOWN_META, label: status || "Unknown" };
}

export const StatusBadge = ({
    status,
    className,
}: {
    status: string;
    className?: string;
}) => {
    const meta = statusMeta(status);
    const Icon = meta.icon;

    return (
        <Badge
            variant="outline"
            className={cn("gap-1.5 font-medium", meta.badge, className)}
        >
            <Icon className="size-3 fill-current" aria-hidden />
            {meta.label}
        </Badge>
    );
};
