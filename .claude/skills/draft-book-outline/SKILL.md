---
name: draft-book-outline
description: Turns a customer's raw book idea, genre, and any notes into a structured chapter-by-chapter outline before any chapter text is written. Use when the customer gives a book concept and has no outline yet, asks to "plan out my book," "help me structure this," or "what chapters should this have," or when a generation request implies a full book but no outline exists in content_versions yet. Do NOT use when the customer already has an approved outline and is asking for chapter text (that's direct generation, not outlining), and do NOT use for revising an existing outline's tone — only for producing the initial structure or a substantial restructure the customer explicitly requests.
---

## What this produces
A structured outline: working title, one-line premise, and a numbered
chapter list where each chapter has a one-to-two sentence summary of what
it covers and (for fiction) what changes for the protagonist by its end.

## Steps
1. Read the customer's stated idea, genre, and any notes/constraints
   (length target, audience, must-include elements).
2. If genre or audience is ambiguous and materially changes structure
   (e.g. a children's book vs. a business book have very different
   chapter shapes), ask one clarifying question — no more than one.
3. Draft the chapter list. Match length to what the customer implied
   (a "short guide" gets 5-8 chapters, not 30).
4. For nonfiction: make sure the outline builds logically (foundational
   concepts before advanced ones). For fiction: make sure it has a
   recognizable arc (setup, rising complication, resolution), even if
   the customer's genre bends the convention.
5. Present the outline for approval before any chapter is drafted in
   full — call `save_content_version` with `is_partial=true` and the
   outline as content, tagged as the outline version, not a chapter.
6. Do not proceed to full chapter generation until the customer approves
   or edits the outline.

## Edge cases
- Customer gives almost no information ("write me a book"): propose a
  genre-neutral outline shape and say explicitly that you're guessing at
  direction, inviting correction, rather than committing to unstated
  assumptions.
- Customer explicitly says "just start writing, no outline needed": skip
  this Skill entirely and let the Content Agent generate directly — don't
  force an outline step nobody asked for.