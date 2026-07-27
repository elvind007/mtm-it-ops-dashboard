# Policy: Patch Management & Change Freeze

**Area:** Patch & Vulnerability Management · **Category:** Security · **Priority:** P1
**Owner:** Priya Raman

This policy sets remediation SLAs for known vulnerabilities and defines when normal patching is
suspended for a change freeze.

## Purpose

Unpatched, known vulnerabilities are one of the most common ways organizations get breached — not
because patches don't exist, but because they aren't applied inside a reasonable window. This
policy exists to make "reasonable window" a specific, measurable number instead of a judgment call
made under pressure during an audit.

## Remediation SLA by Severity

| Severity (CVSS) | Remediation SLA | Applies to |
|---|---|---|
| Critical (9.0–10.0) | 30 days | All systems |
| High (7.0–8.9) | 60 days | All systems |
| Medium (4.0–6.9) | 90 days | All systems |
| Low (0.1–3.9) | Best effort, next regular cycle | All systems |

The SLA clock starts when the vulnerability is confirmed present in our environment via the
monthly scan, not when the CVE is publicly disclosed — a CVE that doesn't affect anything we run
does not start a clock at all.

## Scope by System Type

- **Workstations and cloud infrastructure** patch on a standard monthly cycle and are expected to
  stay within SLA as a matter of course — an SLA breach here is treated as a process failure worth
  investigating, not routine.
- **Legacy application servers** are the recurring exception. Several run vendor software that
  certifies against specific OS patch levels, so patching without vendor sign-off risks breaking
  the application outright. These systems get a documented compensating control (network
  segmentation, restricted access) while remediation is pending, and that control is what we point
  to during an audit — it does not stop the SLA clock.

## Change Freeze Rule

**No production changes, including security patches, are made during a declared change freeze**,
except an active Sev1/Sev2 incident fix approved by the on-call lead. Change freezes are declared
for quarter-end close and any period Finance or Leadership flags as high-risk for disruption, and
are announced in `#it-ops-alerts` at least 5 business days ahead when planned.

This is the one policy carve-out that is allowed to make an SLA go red: a Critical vulnerability
whose remediation window falls inside a change freeze does not get patched until the freeze lifts,
even though the SLA clock keeps running. This is a deliberate tradeoff — the risk of an untested
emergency patch during a freeze window is judged higher than the risk of staying exposed a few
extra days, but it means every freeze-affected CVE needs to be tracked explicitly so it isn't
mistaken for neglect once someone reviews the numbers.

## Exceptions Process

Any deviation from the SLA table — freeze-related or otherwise — needs a written exception logged
against the vulnerability, including: reason, compensating control if any, and a target date. An
exception with no target date is not an exception, it is an unpatched system with a memo attached,
and gets escalated at the next security review.

## Ownership

Priya Raman owns this policy and the monthly scan review. Legacy application server exceptions are
co-owned with whichever infra owner runs the affected system, since the compensating control
usually requires their access to implement.
