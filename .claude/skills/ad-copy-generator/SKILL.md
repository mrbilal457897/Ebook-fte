---
name: ad-copy-generator
description: Drafts ad copy variants (headline + body + call-to-action) for a book, tailored to a target platform's format constraints (Meta Ads vs. Google Ads character limits and structure). Use when the customer asks for ad copy, wants variants to A/B test, or when create_ad_campaign is about to run and no copy exists yet. Do NOT use this to set budget or targeting — those are audience-targeting-suggester's and the campaign-creation tool's job; this only writes the words.
---

## Steps
1. Pull the book's title, genre, description, and key selling points.
2. Draft 3-4 distinct copy variants (not near-duplicates) varying the
   angle: e.g. one leads with premise/hook, one with a review/credibility
   signal, one with urgency/offer framing.
3. Respect the target platform's character limits and structural format
   exactly — don't hand back copy that will get truncated or rejected.
4. Never fabricate a review, rating, or bestseller claim that isn't in
   the book's actual record.
5. Present variants labeled by angle so the customer can pick or mix.

## Edge cases
- Book genre or content touches a sensitive category some ad platforms
  restrict (e.g. certain health claims): flag the likely restriction
  rather than drafting copy that will predictably get rejected at
  platform review.