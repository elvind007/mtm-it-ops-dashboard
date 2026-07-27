import { query } from "@/db/pool";

export type AlertStatus = "pending" | "sent" | "skipped" | "failed";

export interface StatusEventRow {
    id: string;
    areaId: string;
    areaTitle: string;
    fromStatus: string | null;
    toStatus: string;
    changedAt: string;
    alertStatus: string;
    alertError: string | null;
}

/**
 * Records an observed transition and returns its id.
 *
 * The row is created before the alert is attempted, and the outcome is written
 * back to it. That ordering is what makes alerting idempotent: the event is the
 * unit of work, so an overlapping or retried sync updates an existing row rather
 * than posting to Slack twice.
 */
export async function recordStatusEvent(
    areaId: string,
    fromStatus: string | null,
    toStatus: string,
    alertStatus: AlertStatus,
): Promise<string> {
    const { rows } = await query<{ id: string }>(
        `INSERT INTO status_events (area_id, from_status, to_status, alert_status)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [areaId, fromStatus, toStatus, alertStatus],
    );

    const row = rows[0];
    if (!row) throw new Error("failed to record status event");
    return row.id;
}

export async function markAlertOutcome(
    eventId: string,
    alertStatus: AlertStatus,
    error?: string,
): Promise<void> {
    await query(
        `UPDATE status_events
         SET alert_status = $2,
             alert_error  = $3,
             alerted_at   = now()
         WHERE id = $1`,
        [eventId, alertStatus, error ?? null],
    );
}

export async function listRecentEvents(limit: number): Promise<StatusEventRow[]> {
    const { rows } = await query<Record<string, unknown>>(
        `SELECT e.id, e.area_id, a.title AS area_title, e.from_status, e.to_status,
                e.changed_at, e.alert_status, e.alert_error
         FROM status_events e
         JOIN areas a ON a.id = e.area_id
         ORDER BY e.changed_at DESC
         LIMIT $1`,
        [limit],
    );

    return rows.map((r) => ({
        id: String(r.id),
        areaId: r.area_id as string,
        areaTitle: r.area_title as string,
        fromStatus: (r.from_status as string | null) ?? null,
        toStatus: r.to_status as string,
        changedAt:
            r.changed_at instanceof Date
                ? r.changed_at.toISOString()
                : String(r.changed_at),
        alertStatus: r.alert_status as string,
        alertError: (r.alert_error as string | null) ?? null,
    }));
}
