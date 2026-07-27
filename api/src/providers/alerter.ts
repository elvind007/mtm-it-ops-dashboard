import { config } from "@/config";
import { logger } from "@/logger";
import type { Alerter, StatusAlert } from "@/types";

const STATUS_ICON: Record<string, string> = {
    Blocked: "🔴",
    "At Risk": "🟠",
    "On Track": "🟢",
    Done: "⚪",
};

/** Slack rejects text fields over 3000 chars; summaries are far shorter, but be safe. */
function truncate(value: string, max: number): string {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function buildSlackMessage(alert: StatusAlert): Record<string, unknown> {
    const icon = STATUS_ICON[alert.toStatus] ?? "⚪";
    const transition = alert.fromStatus
        ? `${alert.fromStatus} → ${alert.toStatus}`
        : `newly tracked → ${alert.toStatus}`;

    const facts = [
        alert.owner ? `*Owner*\n${alert.owner}` : null,
        alert.category ? `*Category*\n${alert.category}` : null,
        alert.priority ? `*Priority*\n${alert.priority}` : null,
        `*Change*\n${transition}`,
    ].filter((v): v is string => v !== null);

    const blocks: Record<string, unknown>[] = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: truncate(`${icon} ${alert.toStatus} — ${alert.areaTitle}`, 150),
                emoji: true,
            },
        },
        {
            type: "section",
            fields: facts.map((text) => ({ type: "mrkdwn", text })),
        },
    ];

    if (alert.summary) {
        blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: truncate(alert.summary, 2800) },
        });
    }

    if (alert.notionUrl) {
        blocks.push({
            type: "actions",
            elements: [
                {
                    type: "button",
                    text: { type: "plain_text", text: "Open in Notion", emoji: true },
                    url: alert.notionUrl,
                },
            ],
        });
    }

    blocks.push({
        type: "context",
        elements: [
            {
                type: "mrkdwn",
                text: `Summary by \`${alert.model}\` via ${alert.providerKind}`,
            },
        ],
    });

    return {
        // Fallback for notifications and screen readers, which do not render blocks.
        text: `${alert.toStatus}: ${alert.areaTitle} (${transition})`,
        blocks,
    };
}

class SlackAlerter implements Alerter {
    readonly kind = "slack" as const;
    readonly enabled = true;

    constructor(private readonly webhookUrl: string) {}

    async send(alert: StatusAlert): Promise<void> {
        const response = await fetch(this.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildSlackMessage(alert)),
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
            // Slack returns the reason in the body, not the status text.
            const detail = await response.text().catch(() => "");
            throw new Error(`Slack webhook returned ${response.status}: ${detail.slice(0, 200)}`);
        }
    }
}

class NoopAlerter implements Alerter {
    readonly kind = "noop" as const;
    readonly enabled = false;

    async send(alert: StatusAlert): Promise<void> {
        logger.info(
            { area: alert.areaTitle, to: alert.toStatus },
            "slack disabled; transition recorded but not sent",
        );
    }
}

export function createAlerter(): Alerter {
    if (!config.slackEnabled || !config.SLACK_WEBHOOK_URL) {
        logger.info("alerter: disabled (no SLACK_WEBHOOK_URL)");
        return new NoopAlerter();
    }

    // Guard against a misconfigured webhook quietly shipping internal summaries to
    // an arbitrary host.
    let host: string;
    try {
        host = new URL(config.SLACK_WEBHOOK_URL).host;
    } catch {
        throw new Error("SLACK_WEBHOOK_URL is not a valid URL");
    }

    if (host !== "hooks.slack.com") {
        throw new Error(
            `SLACK_WEBHOOK_URL must point at hooks.slack.com (got ${host}). ` +
                "Leave it blank to disable alerting.",
        );
    }

    logger.info({ alertOn: config.SLACK_ALERT_STATUSES }, "alerter: slack webhook");
    return new SlackAlerter(config.SLACK_WEBHOOK_URL);
}
