---
name: cover-brief-to-prompt
description: Converts a customer's vague or partial cover request (a mood, a few adjectives, a comparison title, or just genre + title) into a structured, detailed prompt for the image-generation model, producing 2-4 distinct concept directions. Use when the customer asks for a cover, describes a look ("something moody," "bright and fun," "like [comparable book]"), or reacts to a shown cover and wants variations. Do NOT use once a specific concept is already chosen and the customer only wants a minor tweak (color swap, font change) — that's a direct revision, not a new brief.
---

## Steps
1. Extract genre, title, tone words, and any comparison titles from the
   customer's message.
2. If genre is missing and can't be inferred from the book's content
   record, ask one question; otherwise proceed without stalling.
3. Draft 2-4 distinct prompt directions (not 4 variations of one idea) —
   vary composition, color palette, or typography approach across them.
4. Call `generate_cover_image` for each direction.
5. Present all variants together, plainly labeled (e.g. "Direction A:
   minimalist, warm palette"), so the customer compares rather than
   reacts to one at a time.

## Edge cases
- Customer names a real, currently-published book's cover to imitate
  closely: draw out the *style* (palette, composition genre-convention)
  without reproducing that specific cover's distinctive layout or
  trademarked series branding.
- Customer gives contradictory tone words ("dark but playful"): treat as
  a real creative brief, not an error — propose directions that resolve
  the tension differently (e.g. dark palette with playful typography).