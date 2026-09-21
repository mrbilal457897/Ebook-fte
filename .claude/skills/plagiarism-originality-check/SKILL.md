---
name: plagiarism-originality-check
description: Runs an originality/plagiarism-risk check on a book's content before it is handed off for formatting or publishing. Use when a book's content is marked complete and the customer or Publishing Advisor Agent requests it be prepared for the next stage, when the customer explicitly asks "check this for plagiarism" or "is this original," or automatically as the last step before any content_version is flagged ready-for-formatting. Do NOT use mid-draft on incomplete chapters (it wastes the check on text that will still change), and do NOT use as a substitute for the Publishing Advisor Agent's platform-specific content-policy review — this checks originality only, not platform compliance.
---

## What this produces
A pass/flag report per chapter: either "no significant originality
concerns found" or a list of specific passages that closely match known
sources, each with enough detail (the passage, the suspected source type)
for the customer or a human reviewer to judge and revise.

## Steps
1. Confirm the content_version being checked is marked complete, not a
   mid-draft partial version — if it's still `is_partial=true`, tell the
   caller this check should wait until the chapter is finished.
2. Run the check against the configured originality-detection tool/API
   for the full chapter or book text.
3. For any flagged passage: report the passage, a similarity indicator,
   and the general nature of the match (e.g. "close paraphrase of common
   phrasing in this genre" vs. "substantial verbatim overlap with an
   identifiable external source") — do not guess at or name a specific
   copyrighted source unless the check tool actually returns one.
4. If nothing is flagged, report a clear pass — don't hedge with vague
   caveats that make a clean result sound uncertain.
5. This check's result blocks progression to formatting/publishing on a
   hard flag (Constitution Article IV.1) — report this plainly if a hard
   flag occurs, don't soften it into an optional suggestion.

## Edge cases
- A flagged passage is a common idiom or genre convention (e.g. a
  fairy-tale opening line), not real plagiarism risk: report it as
  low-confidence/likely-convention rather than treating every match
  equally, so the customer isn't alarmed by noise.
- The check tool itself errors or times out: report that the check could
  not complete — never report a false "pass" because the tool failed to
  respond.