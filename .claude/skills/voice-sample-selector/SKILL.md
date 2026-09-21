---
name: voice-sample-selector
description: Recommends 2-3 narration voice options for a book based on its genre and tone, with a short description of each voice's qualities, before committing to a full-book narration run. Use when the customer is starting an audiobook and hasn't chosen a voice, or asks "what voice would fit this." Do NOT use once a voice is already selected and confirmed — that goes straight to generate_narration, not back through selection.
---

## Steps
1. Read the book's genre and tone (from its content/outline record).
2. Call `list_available_voices` for the book's language.
3. Narrow to 2-3 options that genuinely fit (not a generic default list)
   — e.g. a warm, measured voice for literary fiction vs. an energetic
   voice for a business/self-help title.
4. Describe each in one line (pace, tone, best-fit genre), and suggest
   generating a short sample of an opening passage before committing to
   full-book narration.

## Edge cases
- Book has mixed tone across chapters (e.g. a memoir with both somber
  and light moments): recommend a versatile voice option and note that
  tone will vary by content rather than promising a single voice fits
  every passage perfectly.