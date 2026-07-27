# Escalation Matrix & On-Call

This is the reference for "who do I page." If you are not sure whether something rises to a page,
default to paging — a false alarm costs a few minutes; a missed Sev1 costs a lot more.

## Severity Definitions

| Severity | Definition | Example | Response target |
|---|---|---|---|
| Sev1 | Total loss of a critical service, org-wide | Site-wide VPN outage, Okta tenant down | Page immediately, 24/7 |
| Sev2 | Major degradation or a critical service down for a subset of users | One site's VPN down, backup restore failure | Page during business hours; after-hours if trending toward Sev1 |
| Sev3 | Limited impact, workaround exists | Single user auth issue, one degraded endpoint | Standard Service Desk queue, next business day |
| Sev4 | Cosmetic or informational | Documentation gap, minor UI issue | Backlog |

Severity can be reassessed as an incident unfolds — a Sev2 that isn't mitigated within an hour and
is trending toward affecting everyone gets re-declared Sev1, not left at its initial rating out of
inertia.

## On-Call Rotation

On-call is organized by category, not by person, so paging routes to whoever is covering that
category this week rather than a specific individual who might be out.

| Category | Primary owner | Backup |
|---|---|---|
| Network (VPN, switches, WAN) | Daniel Okafor | Rotation — see PagerDuty schedule "Network" |
| Security (IAM, patching, SSO) | Priya Raman | Rotation — see PagerDuty schedule "Security" |
| Infra (endpoints, backup/DR) | Sana Iqbal (endpoints) / Marcus Webb (backup/DR) | Rotation — see PagerDuty schedule "Infra" |
| Support (service desk, assets) | Aisha Kone | Rotation — see PagerDuty schedule "Support" |

The rotation schedules in PagerDuty are the source of truth for who is actually on call this week;
this table tells you which schedule to check, not who to call by name.

## Paging Order for a Sev1

1. Page the on-call for the category that owns the affected area (e.g., Network on-call for a VPN
   outage — see `runbook-vpn-outage.md`).
2. If no acknowledgment within 10 minutes, page the category owner directly, then their backup.
3. If the incident spans categories (for example, an Okta outage affecting both SSO and VPN auth),
   page Security on-call as primary and loop in Network on-call for awareness.
4. For any Sev1 lasting longer than 30 minutes, post a summary in `#it-ops-alerts` and loop in
   leadership even if the technical response doesn't yet need them — they should not learn about a
   30-minute-plus outage secondhand.

## Escalating a Vendor-Dependent Incident

Some incidents have no internal fix — a cloud provider outage, an Okta incident, a hardware vendor
RMA. These still get the same paging and communication treatment; escalation in this case means
opening the highest-priority support ticket the vendor contract allows and tracking their status
page, not sitting on hands. The May 2026 backup failure (`postmortem-2026-05-backup-failure.md`) is
a case study in what happens when a vendor RMA stalls without an internal escalation path pushing it.

## Contacts

Do not page a category owner for something in another category "because they're online" — routing
correctly is what keeps the rotation sustainable. When genuinely unsure which category an incident
belongs to, page Network on-call as the default first responder; they are equipped to redirect.
