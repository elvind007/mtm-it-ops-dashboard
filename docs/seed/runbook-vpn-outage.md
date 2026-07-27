# Runbook: Site-Wide VPN Outage

**Area:** VPN & Remote Access · **Category:** Network · **Priority:** P2 (escalates to P0 during
a full outage) · **Owner:** Daniel Okafor · **On-call:** Network rotation (see `escalation-matrix.md`)

This runbook covers the case where remote users across the entire office cannot connect through
the VPN concentrator — not a single user's client issue, which is a Service Desk ticket, not an
outage.

## Symptoms

- Multiple simultaneous reports of "VPN won't connect" or connections that authenticate then drop.
- The concentrator's active-session count is flat or zero on the monitoring dashboard.
- Site-to-site tunnels to branch offices are also down (a strong signal this is the concentrator,
  not individual clients).

## Immediate Response (first 15 minutes)

1. **Confirm scope.** Check the monitoring dashboard for active VPN sessions and concentrator CPU
   and interface status. If only one or two users are affected, this is not a site-wide outage —
   route to the standard Service Desk queue instead.
2. **Declare the incident.** Post in `#it-ops-alerts` with area, start time, and observed impact.
   If it is business hours and more than 10 users are affected, this is Sev1 — page the on-call
   network engineer per the escalation matrix rather than waiting for a response in Slack.
3. **Check concentrator capacity first.** The concentrator has been running near its licensed
   session ceiling during peak hours (see the VPN & Remote Access area notes) — a capacity-exhaustion
   outage looks identical to a crash from the user's side. Check current session count against the
   licensed maximum before assuming hardware failure.
4. **Check upstream dependencies.** Confirm the concentrator's WAN uplink, DNS resolution, and the
   Okta SSO tenant (VPN auth is Okta-backed) are all healthy. An Okta outage presents as a VPN
   outage to end users even though the VPN hardware is fine.

## Diagnosis

- If session count is pinned at the licensed maximum: this is capacity exhaustion, not a failure.
  Skip to Mitigation.
- If session count is zero and the device is unreachable on the management interface: treat as a
  hardware or power failure. Check the concentrator's physical status page and PDU.
- If sessions connect but drop within seconds: check certificate expiry on the concentrator first —
  this is the single most common cause of a sudden, total outage with no configuration change logged.
- If Okta status page shows an incident: this is an upstream dependency failure, not ours to fix,
  but still needs to be communicated per the Communication section below.

## Mitigation

- **Capacity exhaustion:** temporarily raise the session ceiling if the license allows a burst, and
  ask non-essential remote users to disconnect. Budget approval for permanent additional licenses
  has been pending with Finance — reference that ticket rather than opening a new one.
- **Certificate expiry:** reissue and install the concentrator's certificate from the internal CA.
  This is a 10-minute fix once diagnosed, which is why diagnosis order matters.
- **Hardware failure:** fail over to the secondary concentrator if the site has one; otherwise this
  becomes a P0 vendor engagement.
- **Okta outage:** no local mitigation. Monitor the Okta status page and communicate ETAs as they
  update.

## Communication

Post an update in `#it-ops-alerts` at declaration, every 30 minutes while open, and at resolution.
Include: scope (all sites or specific ones), suspected cause, current mitigation step, and next
update time. For outages affecting more than 25 users, also post a plain-language status note for
the general company channel — end users do not need concentrator session counts, they need to know
whether to expect VPN access in the next hour.

## Escalation

If unresolved after 30 minutes, or if the cause is hardware failure, escalate to the Network on-call
lead per `escalation-matrix.md`. If the root cause is Okta, no further internal escalation helps —
track their status page and update stakeholders on the interval above.

## Post-Incident

Every site-wide VPN outage gets a short writeup, even if resolved quickly: cause, timeline, and
whether the capacity or certificate issue was a contributing factor. See
`postmortem-2026-05-backup-failure.md` for the expected format.
