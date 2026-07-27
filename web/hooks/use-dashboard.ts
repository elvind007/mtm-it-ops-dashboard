"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
