# Postmortem: Quarterly Backup Restore Test Failure (May 2026)

**Area:** Backup & Disaster Recovery · **Category:** Infra · **Priority:** P0 · **Owner:** Marcus Webb
**Status:** Blocked — carried forward from this incident, still open as of this writing

## Summary

The scheduled quarterly restore test against the tape library failed twice in the same test
window. Investigation traced the failure to the tape library controller running firmware two
releases behind current, which the vendor confirmed is a known incompatibility with the backup
software's current restore path. We cannot certify disaster-recovery readiness until this is
resolved, which is why this area remains flagged Blocked rather than closed out as a one-time
incident.

## Impact

No data was lost and no production system was affected — this was a test of our ability to
restore, not a live restore under pressure. The impact is entirely in risk posture: for the
duration this remains unresolved, an actual disaster recovery event would very likely hit the same
failure, and we would discover that during the emergency rather than before it.

## Timeline

- **Day 1, morning:** Scheduled quarterly restore test begins against the tape library per the
  standard DR test procedure.
- **Day 1, midday:** Restore test fails partway through with a controller-level I/O error. Retried
  once, assuming a transient fault.
- **Day 1, afternoon:** Second attempt fails at a similar point. Escalated internally as a probable
  hardware or firmware issue rather than a one-off.
- **Day 2:** Vendor support engaged. Vendor confirms the installed firmware version is two releases
  behind and lists a known compatibility issue with the restore path used by our backup software
  version.
- **Day 3:** Vendor RMA opened for the tape controller, since a firmware update alone was not
  sufficient to fully rule out a hardware-level cause underneath the reported symptom.
- **Ongoing:** RMA has been open 9 days as of this writing with no ETA from the vendor. Backup &
  Disaster Recovery remains status Blocked until a successful restore test can be certified.

## Root Cause

Primary cause: tape library controller firmware fell two releases behind current without a
corresponding compatibility check against the backup software version in use. Contributing cause:
there was no existing process step that ties a backup software version bump to a firmware
compatibility check on the hardware it writes to — the two were being patched independently.

## What Went Well

- The quarterly test caught this before it mattered. This is exactly the scenario quarterly restore
  testing exists to surface, and it worked as intended.
- Vendor escalation happened within a day of the second failed attempt, not after a longer
  internal debugging cycle that likely would have reached the same conclusion more slowly.

## What Went Poorly

- The firmware gap existed for longer than it should have — nothing in the patch cycle (see
  `policy-patch-management.md`) currently covers tape library firmware, since it isn't a
  general-purpose server and fell outside the standard scan scope.
- The RMA has stalled for 9 days with no ETA and no internal escalation path was invoked to push it
  — it was tracked as "waiting on vendor" without a re-check cadence, which let it go quiet.

## Action Items

1. Add tape library and similar specialized hardware firmware to the scope of the patch management
   policy's scan, even though it does not carry a CVSS score the way software vulnerabilities do —
   owner: Marcus Webb, coordinating with Priya Raman on where this fits in the existing policy.
2. Establish a re-check cadence for open vendor RMAs tied to a Blocked area status — an RMA open
   more than 5 business days with no ETA update should trigger an escalation per
   `escalation-matrix.md`, not wait for the next status review.
3. Evaluate whether a secondary backup target (cloud-based, independent of the tape library) should
   cover the gap while this is unresolved, so DR readiness does not depend on a single vendor path
   being fixed.

## Owner

Marcus Webb owns closure of this postmortem's action items and the underlying Blocked status. The
area will move off Blocked only after a restore test against the repaired or replaced hardware
succeeds — not when the RMA simply closes.
