# Notes: Okta Tenant Migration

**Area:** Identity & Access Management · **Category:** Security · **Priority:** P1
**Owner:** Priya Raman

Working notes for the migration off our legacy identity provider onto a single Okta tenant as the
SSO source of truth for every internal and SaaS application.

## Background

Before this migration, application access was a mix of local accounts, a legacy SAML IdP nearing
end of vendor support, and, for a handful of tools, no SSO at all. That mix is what let
inconsistent access accumulate — a departing contractor's access to a niche tool was easy to miss
because it wasn't governed by the same offboarding checklist as everything else. Consolidating on
one Okta tenant is what makes group-based access (see `sop-employee-onboarding.md`) actually
enforceable rather than aspirational.

## Migration Plan

1. **Discovery** — inventory every application currently using the legacy IdP or local auth, and
   classify each as SAML-ready, OIDC-ready, or "needs a workaround" (a handful of older internal
   tools fall in the last bucket and get a scoped exception, tracked separately).
2. **Pilot group** — migrate a ~40-person cross-functional pilot first: IT, a Security team subset,
   and a few volunteers from other departments. This is deliberately not all-IT, because IT staff
   self-select for tolerance of rough edges that a general user would report as broken.
3. **Staged rollout** — migrate by department in waves, largest-blast-radius departments last, so
   early waves surface issues while the number of affected people is still small.
4. **Cutover** — decommission the legacy IdP once every application is confirmed running on Okta
   and no authentication has hit the legacy system in 14 consecutive days.

## Timeline

- Pilot group live and reporting no auth failures as of this week.
- Staged rollout for remaining departments targeted to complete by the 12th of next month.
- Legacy IdP decommission follows 14 days after the last department's cutover, contingent on the
  quiet-period check above — this is not a fixed calendar date, it moves if cutover slips.

## Current Status

Rollout has reached roughly 60% of staff. No authentication failures reported from the pilot group.
This is on schedule against the plan above.

## Risks

- **Legacy app compatibility.** Two internal tools do not support modern SAML/OIDC and need either
  a proxy-based workaround or to be retired outright — retiring is preferred where the tool has a
  modern equivalent already in the Okta app catalog.
- **VPN dependency.** VPN authentication is Okta-backed (see `runbook-vpn-outage.md`) — an Okta
  outage during the migration window has a wider blast radius than usual, since both the old and
  new paths are live simultaneously and a failure in either can look like the other's fault.
- **Helpdesk load.** Each rollout wave produces a predictable bump in Service Desk tickets for the
  following two business days. Aisha Kone's team is briefed ahead of each wave so it doesn't read
  as backlog growth in the weekly ops review.

## Rollback Plan

Each department wave can be individually reverted to the legacy IdP without affecting waves already
migrated — accounts are provisioned in both systems in parallel until the quiet-period check passes,
specifically so a bad wave doesn't force reverting people who are already working fine on Okta.

## Owner & Contacts

Priya Raman owns this migration end to end. Questions from other areas — particularly anything
that touches VPN auth or onboarding — should go through her rather than directly to Okta support,
so the discovery inventory stays authoritative.
