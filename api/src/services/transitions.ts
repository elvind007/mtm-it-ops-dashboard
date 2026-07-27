/**
 * Status transition rules — the trigger for Slack alerts.
 *
 * Kept as pure functions with no I/O so the alerting policy is exhaustively
 * testable without a database, a Slack webhook, or a clock.
 */

export interface TransitionPolicy {
    /** Statuses that warrant an alert when entered. Compared case-insensitively. */
    alertStatuses: readonly string[];
    /** Whether the very first observation of an area can raise an alert. */
    alertOnFirstSeen: boolean;
}

/** True when the observed status differs from what we last recorded. */
export function hasStatusChanged(
    previousStatus: string | null,
    nextStatus: string,
): boolean {
    return previousStatus !== nextStatus;
}

/**
 * The brief asks for an alert when a status *changes to* At Risk or Blocked.
 *
 * Two consequences fall out of that wording:
 *  - Staying in an alertable status does not re-alert. Nobody needs "still blocked"
 *    every sync interval.
 *  - First observation is not a change. On the seed run every area is new, so
 *    alerting then would fire once per area for a state nobody just changed.
 *    Overridable via ALERT_ON_FIRST_SEEN for anyone who wants the opposite.
 */
export function shouldAlert(
    previousStatus: string | null,
    nextStatus: string,
    policy: TransitionPolicy,
): boolean {
    if (!hasStatusChanged(previousStatus, nextStatus)) return false;
    if (previousStatus === null && !policy.alertOnFirstSeen) return false;

    const target = nextStatus.trim().toLowerCase();
    return policy.alertStatuses.some((s) => s.trim().toLowerCase() === target);
}
