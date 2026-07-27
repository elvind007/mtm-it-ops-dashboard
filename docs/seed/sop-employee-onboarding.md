# SOP: New-Hire IT Provisioning

**Areas involved:** Identity & Access Management (Priya Raman), Endpoint Management (Sana Iqbal),
Asset Inventory & Licensing (Sana Iqbal), Service Desk Operations (Aisha Kone)

This SOP covers everything IT needs to do between a new hire's offer acceptance and their first
productive day. It is triggered by an HR ticket in the Service Desk queue tagged `onboarding`.

## Timeline at a Glance

| When | What | Owner |
|---|---|---|
| T-5 business days | Account and hardware request created | Service Desk |
| T-3 business days | Okta account provisioned, device imaged | IAM / Endpoint |
| T-1 business day | Device shipped or staged at desk | Endpoint |
| Day 1 | Access verification, welcome walkthrough | Service Desk |

If HR submits the ticket with less than 5 business days' notice, T-3 and T-1 steps compress —
flag this to the manager rather than silently missing the SLA.

## Pre-Start (T-5 business days)

1. Service Desk opens a provisioning ticket from the HR system trigger, capturing: legal name,
   start date, manager, department, and role (which determines the access template).
2. IAM creates the Okta account under the correct group based on role template. Do **not**
   hand-pick individual app assignments — group-based access is what keeps the Okta tenant
   auditable, and ad hoc grants are exactly what the SSO migration is trying to eliminate (see
   `notes-okta-sso-migration.md`).
3. Endpoint Management places a hardware order or pulls a pre-imaged laptop from stock, and
   enrolls it in Intune under the standard policy set for the role.
4. Asset Inventory logs the device serial number against the new hire's employee ID before it
   ships — this is the record that makes offboarding and license reclamation possible later.

## Day One

1. New hire receives a temporary credential packet (Okta activation link, sent to their personal
   email pre-start, per policy — never to a manager on their behalf).
2. Service Desk verifies, before 9am on start day, that: Okta login succeeds, the device is
   Intune-enrolled and shows "Compliant," email and calendar are populated, and the new hire is in
   the correct distribution lists.
3. Any verification failure is a Day One P1 for Service Desk — a new hire who cannot log in on
   their first day is the single worst first impression IT can make, and it also blocks every
   other team waiting to onboard them.
4. Service Desk walks the new hire through MFA enrollment, VPN client setup (only if their role
   requires remote access), and where to file future tickets.

## First Week

- Manager confirms in the onboarding ticket that access matches what the role actually needs. Over-
  or under-provisioned access gets corrected here, not months later during an audit.
- Endpoint Management confirms the device checks in to Intune at least once after Day One — a
  device that never phones home after activation usually means it was never actually connected to
  the corporate network, which needs following up before it becomes a compliance gap.

## Notes on Licensing

Every seat provisioned here (Okta, M365, any role-specific SaaS tool) is tracked against the asset
inventory. This is what makes the annual reconciliation possible — see the license-reclamation
numbers in the Asset Inventory & Licensing area, which depend on onboarding and offboarding both
being logged accurately at the time they happen, not reconstructed later from memory.

## Related

Offboarding is the mirror image of this process and is documented separately; the short version is
that every step here has a corresponding revoke-and-reclaim step triggered by the HR termination
event, on the same day, not the next business day.
