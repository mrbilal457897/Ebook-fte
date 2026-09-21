---
name: audience-targeting-suggester
description: Suggests audience targeting parameters (interests, demographics, platform, rough budget range) for a book's ad campaign, based on its genre and comparable titles. Use when the customer is setting up a new campaign and hasn't specified targeting, or asks "who should I target" or "how much should I spend." Do NOT use to actually create the campaign or commit any budget — that's the gated create_ad_campaign tool; this only proposes parameters for the customer to approve.
---

## Steps
1. Identify genre, comparable titles, and any customer-stated budget
   ceiling.
2. Propose targeting (interest categories, rough age range if relevant,
   platform choice between Meta/Google based on genre fit) with a
   one-line rationale per choice.
3. Propose a starting budget range, not a single number, and explain
   it's a starting point to test and adjust, not a fixed commitment.
4. State plainly that final budget confirmation happens at the approval
   gate on `create_ad_campaign` before anything spends.

## Edge cases
- Customer has a very small stated budget: say plainly if that budget is
  unlikely to produce meaningful reach on the suggested platform, rather
  than proposing targeting that will just quietly underperform.