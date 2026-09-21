---
name: tenant-onboarding-setup
description: Sets up a new tenant (subscribing company) in the system — creating its tenant record, default configuration, and any tenant-scoped resources needed before its first end-customer can sign up. Use during development/ops when adding a new tenant, not something an end-customer or their support conversation ever triggers. Do NOT use for onboarding an individual end-customer within an existing tenant — that's onboarding-first-book-walkthrough's job, a completely different (runtime, per-customer) concern.
---

## Steps
1. Create the tenant record with a unique `tenant_id`.
2. Set default configuration (free-tier limits, default spend-approval
   thresholds, any tenant-level branding if the product supports it).
3. Verify tenant isolation: run a quick check that a query scoped to
   this tenant returns zero rows from any other tenant (a smoke test
   worth automating, not just eyeballing once).
4. Record the setup in an audit-appropriate way (this is dev/ops action,
   not a runtime agent action, but should still be logged for
   traceability, per Constitution Article VIII's spirit even outside the
   runtime audit_log table).

## Edge cases
- A new tenant requests a free-tier limit or approval threshold
  different from platform defaults: treat this as an explicit
  configuration decision to confirm with the project owner, not
  something to set unilaterally, since it changes financial exposure
  per Constitution Article IV.6.