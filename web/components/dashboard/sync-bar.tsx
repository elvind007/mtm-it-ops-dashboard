"use client";

import { formatDistanceToNow } from "date-fns";
import { Database, MessageSquare, RefreshCw, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useHealth, useSyncNow } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";
import type { SyncRun } from "@/types/api";

/**
 * Renders which implementation each integration resolved to at boot.
 *
 * The same build runs with and without credentials, so "is this real data or the
 * offline fallback?" is a genuine question every time you look at the screen.
 * Putting the answer in the chrome means nobody has to read the logs to know.
 */
function ModeBadge({
    icon: Icon,
    label,
    value,
    live,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    live: boolean;
}) {
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[11px]"
            title={`${label}: ${value}`}
        >
            <Icon className="size-3 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">{label}</span>
            <span
                aria-hidden
                className={cn(
                    "size-1.5 rounded-full",
                    live ? "bg-[var(--status-on-track)]" : "bg-[var(--status-done)]",
                )}
            />
            <span className="font-medium">{value}</span>
        </span>
    );
}

function lastSyncLabel(run: SyncRun | null): string {
    if (!run) return "never synced";
    const when = new Date(run.finishedAt ?? run.startedAt);
    if (Number.isNaN(when.getTime())) return "never synced";
    return `synced ${formatDistanceToNow(when, { addSuffix: true })}`;
}

export function SyncBar({ lastSync }: { lastSync: SyncRun | null }) {
    const { data: health } = useHealth();
    const sync = useSyncNow();

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
                {health && (
                    <>
                        <ModeBadge
                            icon={Database}
                            label="Notion"
                            value={health.integrations.notion.mode}
                            live={health.integrations.notion.mode === "live"}
                        />
                        <ModeBadge
                            icon={Sparkles}
                            label="AI"
                            value={
                                health.integrations.llm.mode === "live"
                                    ? health.integrations.llm.model
                                    : "mock"
                            }
                            live={health.integrations.llm.mode === "live"}
                        />
                        <ModeBadge
                            icon={MessageSquare}
                            label="Slack"
                            value={health.integrations.slack.mode}
                            live={health.integrations.slack.mode === "live"}
                        />
                    </>
                )}
            </div>

            <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                    {lastSyncLabel(lastSync)}
                    {lastSync && (
                        <>
                            {" · "}
                            <span className="tabular-nums">
                                {lastSync.summariesGenerated} generated
                            </span>
                            {" · "}
                            <span className="tabular-nums">
                                {lastSync.summariesCached} cached
                            </span>
                        </>
                    )}
                </span>
                <Button
                    size="sm"
                    onClick={() => sync.mutate()}
                    disabled={sync.isPending}
                    aria-label="Sync now"
                >
                    <RefreshCw className={cn("size-3.5", sync.isPending && "animate-spin")} />
                    {sync.isPending ? "Syncing…" : "Sync now"}
                </Button>
            </div>
        </div>
    );
}
