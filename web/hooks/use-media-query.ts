"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query.
 *
 * `matchMedia` is an external store, so this uses `useSyncExternalStore` rather than
 * seeding state from an effect — that pattern causes a cascading re-render on mount and
 * is flagged by the React Compiler. The server snapshot is `false` so SSR renders the
 * desktop layout and hydration corrects it if needed.
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const media = window.matchMedia(query);
            media.addEventListener("change", onStoreChange);
            return () => media.removeEventListener("change", onStoreChange);
        },
        [query],
    );

    const getSnapshot = useCallback(
        () => window.matchMedia(query).matches,
        [query],
    );

    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
