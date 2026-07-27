"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

import { LoadingData, NoRecordFound, ServerError } from "@/components/placeholders";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useLogs } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

/** Tab label → the `integration` value the API filters on. `undefined` means "All". */
const INTEGRATION_TABS: { label: string; value?: string }[] = [
    { label: "All" },
    { label: "Notion", value: "notion" },
    { label: "AI", value: "llm" },
    { label: "Slack", value: "slack" },
    { label: "RAG", value: "rag" },
    { label: "API", value: "http" },
];

const LEVEL_TABS: { label: string; value?: string }[] = [
    { label: "All" },
    { label: "Warnings", value: "warn" },
    { label: "Errors", value: "error" },
];

/** Log level, always paired with its label -- never colour alone (matches Activity). */
function LevelPill({ level }: { level: string }) {
    const token =
        level === "error"
            ? "var(--status-blocked)"
            : level === "warn"
              ? "var(--status-at-risk)"
              : "var(--status-on-track)";

    return (
        <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{
                color: token,
                borderColor: `color-mix(in oklab, ${token} 35%, transparent)`,
                backgroundColor: `color-mix(in oklab, ${token} 12%, transparent)`,
            }}
        >
            {level}
        </span>
    );
}

function relative(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "unknown" : formatDistanceToNow(date, { addSuffix: true });
}

/** status_code and duration_ms into one compact cell. */
function StatusDuration({
    statusCode,
    durationMs,
}: {
    statusCode: number | null;
    durationMs: number | null;
}) {
    if (statusCode === null && durationMs === null) {
        return <span className="text-muted-foreground">—</span>;
    }
    return (
        <span className="whitespace-nowrap tabular-nums text-muted-foreground">
            {statusCode !== null && <span className="font-mono">{statusCode}</span>}
            {statusCode !== null && durationMs !== null && " · "}
            {durationMs !== null && `${durationMs}ms`}
        </span>
    );
}

export function LogsView() {
    const [integration, setIntegration] = useState<string | undefined>(undefined);
    const [level, setLevel] = useState<string | undefined>(undefined);

    const { data: logs, isPending, isError, refetch } = useLogs({ integration, level });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1.5">
                    {INTEGRATION_TABS.map((tab) => (
                        <Chip
                            key={tab.label}
                            active={integration === tab.value}
                            onClick={() => setIntegration(tab.value)}
                        >
                            {tab.label}
                        </Chip>
                    ))}
                </div>
                <div className="ml-auto flex flex-wrap gap-1.5">
                    {LEVEL_TABS.map((tab) => (
                        <Chip
                            key={tab.label}
                            active={level === tab.value}
                            onClick={() => setLevel(tab.value)}
                        >
                            {tab.label}
                        </Chip>
                    ))}
                </div>
            </div>

            <LogsTable logs={logs} isPending={isPending} isError={isError} refetch={refetch} />
        </div>
    );
}

function Chip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-accent",
            )}
        >
            {children}
        </button>
    );
}

function LogsTable({
    logs,
    isPending,
    isError,
    refetch,
}: {
    logs: ReturnType<typeof useLogs>["data"];
    isPending: boolean;
    isError: boolean;
    refetch: () => void;
}) {
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

    if (isPending) return <LoadingData rows={6} />;
    if (!logs || logs.length === 0) return <NoRecordFound />;

    return (
        <div aria-live="polite" className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Integration</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Kind</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                        <TableRow key={log.id}>
                            <TableCell
                                className="whitespace-nowrap text-muted-foreground"
                                title={log.createdAt}
                            >
                                {relative(log.createdAt)}
                            </TableCell>
                            <TableCell className="font-medium">{log.integration}</TableCell>
                            <TableCell>
                                <LevelPill level={log.level} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">{log.kind}</TableCell>
                            <TableCell className="max-w-md">
                                <span className="block truncate" title={log.message}>
                                    {log.message}
                                </span>
                            </TableCell>
                            <TableCell>
                                <StatusDuration
                                    statusCode={log.statusCode}
                                    durationMs={log.durationMs}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
