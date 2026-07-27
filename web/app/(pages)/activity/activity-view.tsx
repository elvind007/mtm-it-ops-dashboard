"use client";

import { formatDistanceToNow } from "date-fns";

import { StatusBadge } from "@/components/status-badge";
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
import { useEvents } from "@/hooks/use-dashboard";

/** Alert delivery state, always paired with a text label -- never color alone. */
function AlertPill({ status, error }: { status: string; error: string | null }) {
    const token =
        status === "sent"
            ? "var(--status-on-track)"
            : status === "failed"
              ? "var(--status-blocked)"
              : "var(--status-done)";

    return (
        <div className="flex flex-col gap-0.5">
            <span
                className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{
                    color: token,
                    borderColor: `color-mix(in oklab, ${token} 35%, transparent)`,
                    backgroundColor: `color-mix(in oklab, ${token} 12%, transparent)`,
                }}
            >
                {status}
            </span>
            {error && <span className="text-[11px] text-muted-foreground">{error}</span>}
        </div>
    );
}

function relative(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "unknown" : formatDistanceToNow(date, { addSuffix: true });
}

export function ActivityView() {
    const { data: events, isPending, isError, refetch } = useEvents(50);

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
    if (events.length === 0) return <NoRecordFound />;

    return (
        // Transitions arrive by polling; announce new rows to assistive tech.
        <div aria-live="polite" className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Area</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>When</TableHead>
                        <TableHead>Alert</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event) => (
                        <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.areaTitle}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {event.fromStatus ? (
                                        <StatusBadge status={event.fromStatus} />
                                    ) : (
                                        <span className="text-xs text-muted-foreground">
                                            newly tracked
                                        </span>
                                    )}
                                    <span aria-hidden className="text-muted-foreground">
                                        →
                                    </span>
                                    <StatusBadge status={event.toStatus} />
                                </div>
                            </TableCell>
                            <TableCell
                                className="whitespace-nowrap text-muted-foreground"
                                title={event.changedAt}
                            >
                                {relative(event.changedAt)}
                            </TableCell>
                            <TableCell>
                                <AlertPill status={event.alertStatus} error={event.alertError} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
