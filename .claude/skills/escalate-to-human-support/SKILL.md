---
name: escalate-to-human-support
description: Hands off a conversation to human support with full context when the customer explicitly asks for a human, when an issue has already been attempted twice without resolution, or when the situation involves a billing dispute, a failed publish the customer believes should have succeeded, or visible frustration/distress language. Use exactly at those trigger points. Do NOT use as a first response to any difficulty — attempt resolution via search_help_library or the relevant specialist's explanation first, unless the customer has explicitly asked for a human right away.
---

## Steps
1. Confirm the trigger condition actually applies (explicit ask, second
   failed attempt, billing/publish dispute, or clear distress) — don't
   escalate reflexively on the first sign of any difficulty.
2. Summarize the conversation: what the customer wants, what's been
   tried, what specifically is unresolved.
3. Call `escalate_to_human_support` with the account/tenant context and
   this summary.
4. Tell the customer plainly that a human will follow up, and roughly
   what to expect, rather than leaving the handoff unacknowledged.

## Edge cases
- Customer asks for a human but the issue is trivially resolvable
  (e.g. "how do I start" — covered by onboarding-first-book-walkthrough):
  still offer the quick answer first, but don't refuse the escalation if
  they still want a human after that — respect the explicit ask.