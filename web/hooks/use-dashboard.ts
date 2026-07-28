"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { dashboardApi, dashboardKeys, type LogsQuery } from "@/api/dashboardApi";

/**
 * The board refetches on an interval rather than over a socket.
 *
 * Notion is polled by the worker every SYNC_INTERVAL_MS, so pushing updates to the
 * browser faster than that would not surface anything newer. 15s keeps the UI
 * within a few seconds of the database without a transport to maintain; SSE is
 * listed as future work in the README.
 */
const REFETCH_MS = 15_000;

export function useAreas() {
    return useQuery({
        queryKey: dashboardKeys.areas,
        queryFn: async () => (await dashboardApi.areas()).data,
        refetchInterval: REFETCH_MS,
        refetchOnWindowFocus: true,
    });
}

export function useHealth() {
    return useQuery({
        queryKey: dashboardKeys.health,
        queryFn: async () => (await dashboardApi.health()).data,
        // Integration modes only change on restart, so this is effectively static.
        staleTime: 5 * 60_000,
        retry: 1,
    });
}

export function useEvents(limit = 25) {
    return useQuery({
        queryKey: dashboardKeys.events(limit),
        queryFn: async () => (await dashboardApi.events(limit)).data.events,
        refetchInterval: REFETCH_MS,
    });
}

export function useLogs(query: LogsQuery = {}) {
    return useQuery({
        queryKey: dashboardKeys.logs(query),
        queryFn: async () => (await dashboardApi.logs(query)).data.logs,
        refetchInterval: REFETCH_MS,
        refetchOnWindowFocus: true,
    });
}

/** Corpus is seed-static; only changes on re-seed / restart. */
const DOC_STALE_MS = 5 * 60_000;

export function useDocuments() {
    return useQuery({
        queryKey: dashboardKeys.documents,
        queryFn: async () => (await dashboardApi.documents()).data.documents,
        staleTime: DOC_STALE_MS,
    });
}

export function useDocument(source: string | null) {
    return useQuery({
        queryKey: dashboardKeys.document(source ?? ""),
        queryFn: async () => (await dashboardApi.document(source!)).data,
        enabled: Boolean(source),
        staleTime: DOC_STALE_MS,
    });
}

/**
 * A sync is considered fresh enough to skip an on-open auto-sync if the last one
 * finished within this window. Roughly one frontend refetch cadence: long enough that
 * opening/refocusing the tab doesn't hammer Notion, short enough that a page you just
 * opened reflects a Notion change made moments ago.
 */
const AUTOSYNC_STALE_MS = 15_000;

/**
 * Force a fresh sync when the dashboard opens or the tab regains focus.
 *
 * The worker already polls on a timer, but that leaves a window where a Notion change
 * made just before you look is not on screen yet. This closes it for the case that
 * actually misleads a viewer -- opening the page -- without moving the sync pipeline
 * onto every request: it fires only when the last sync is stale and none is in flight.
 *
 * Deliberately silent. The visible "Sync now" button reports success/failure; an
 * auto-sync racing the worker (409) or hitting a transient upstream error should not
 * throw a toast at someone who never asked for it. `runSync`'s advisory lock and
 * content-hash cache keep the extra call cheap and non-overlapping.
 */
export function useAutoSync(lastSyncAt: string | null) {
    const queryClient = useQueryClient();
    // Held in a ref so the focus listener always sees the latest value without being
    // re-attached on every refetch.
    const lastSyncRef = useRef(lastSyncAt);
    lastSyncRef.current = lastSyncAt;
    const inFlight = useRef(false);

    useEffect(() => {
        const maybeSync = async () => {
            if (inFlight.current || document.visibilityState !== "visible") return;
            const at = lastSyncRef.current;
            const age = at ? Date.now() - new Date(at).getTime() : Number.POSITIVE_INFINITY;
            if (age < AUTOSYNC_STALE_MS) return;

            inFlight.current = true;
            try {
                await dashboardApi.sync();
                await queryClient.invalidateQueries({ queryKey: dashboardKeys.areas });
                await queryClient.invalidateQueries({ queryKey: ["events"] });
            } catch {
                // Silent by design -- see the doc comment above.
            } finally {
                inFlight.current = false;
            }
        };

        void maybeSync();
        window.addEventListener("focus", maybeSync);
        document.addEventListener("visibilitychange", maybeSync);
        return () => {
            window.removeEventListener("focus", maybeSync);
            document.removeEventListener("visibilitychange", maybeSync);
        };
    }, [queryClient]);
}

export function useSyncNow() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => (await dashboardApi.sync()).data,
        onSuccess: (run) => {
            toast.success("Sync complete", {
                description: `${run.areasSeen} areas · ${run.summariesGenerated} summaries generated · ${run.summariesCached} served from cache · ${run.alertsSent} alerts sent`,
            });
            void queryClient.invalidateQueries({ queryKey: dashboardKeys.areas });
            void queryClient.invalidateQueries({ queryKey: ["events"] });
        },
        onError: (error: unknown) => {
            const status =
                typeof error === "object" && error !== null && "response" in error
                    ? (error as { response?: { status?: number } }).response?.status
                    : undefined;

            // 409 is the advisory lock: the worker is mid-cycle. Not an error worth alarming about.
            toast.error(
                status === 409 ? "A sync is already running" : "Sync failed",
                { description: status === 409 ? "Try again in a moment." : undefined },
            );
        },
    });
}
