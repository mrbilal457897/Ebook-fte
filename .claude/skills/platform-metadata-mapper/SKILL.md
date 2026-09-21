---
name: platform-metadata-mapper
description: Maps a book's general metadata (title, description, genre, keywords, author name) to the specific field names, character limits, and category taxonomies required by a target publishing platform (KDP, Apple Books, IngramSpark, Draft2Digital). Use when preparing a submission package for a specific platform, or when the customer asks "what categories should I pick" or "why does my description need to be shorter for this platform." Do NOT use for the actual submission call — this only prepares/validates the metadata; submit_for_publishing handles the gated submission itself.
---

## Steps
1. Pull the book's general metadata from its record.
2. Look up the target platform's field requirements via
   `lookup_platform_requirements`.
3. Map each field, truncating or restructuring only where the platform
   requires it (e.g. shorter description limit) — never silently drop
   content the customer wrote without flagging the truncation.
4. Suggest 2-3 category/keyword options per platform's taxonomy, with a
   one-line reason each, rather than picking one unexplained.
5. Return the mapped package for the customer's review before it's ever
   passed to the gated submission step.

## Edge cases
- A platform's category taxonomy has no close match for the book's genre
  (common for cross-genre or unusual nonfiction): say so explicitly and
  suggest the closest reasonable fit rather than forcing a poor match
  silently.