---
name: tone-style-editor
description: Revises already-generated book content to change its tone, voice, formality, pacing, or reading-level, without altering its plot/factual content or structure. Use when the customer says something is "too formal," "make it punchier," "sounds robotic," "more casual," "simplify this," or names a comparable author/style ("more like [style], not the actual writer's name if it implies copying their identifiable prose"). Do NOT use when the customer is asking to change what happens or what facts are stated (that's a content edit, not a tone edit) and do NOT use for the first draft of new content — this only revises text that already exists in content_versions.
---

## What this produces
A revised version of the specified passage or chapter with tone/voice
changed, content and structure otherwise intact, saved as a new
`content_versions` row (never overwriting the prior version — versions
are additive, per the system of record's versioning principle).

## Steps
1. Identify exactly which passage/chapter the customer means; if
   ambiguous, ask which section rather than guessing and revising the
   wrong one.
2. Read the target tone description carefully — "punchier" usually means
   shorter sentences and stronger verbs, not different content;
   "more casual" usually means contractions and simpler vocabulary, not
   slang that breaks the book's genre.
3. Revise sentence-level and paragraph-level style. Do not add or remove
   plot events, facts, or structural sections unless the customer
   explicitly also asked for that.
4. Call `save_content_version` with the revised text as a new version,
   `is_partial=false`, linked to the same chapter/book.
5. Briefly tell the customer what changed in tone terms (e.g. "shortened
   sentences, cut some of the explanatory asides") so they can judge if
   it matches what they wanted, without re-reading the whole thing.

## Edge cases
- Customer names a real, identifiable author's style very specifically
  ("write exactly like [named living author]"): match general craft
  qualities they're pointing at (sentence length, dialogue-heavy vs.
  prose-heavy) without reproducing that author's specific, recognizable
  phrasing or copying passages — flag this distinction to the customer if
  their request pushes toward the latter.
- Tone request would contradict the book's stated audience (e.g. "make
  it edgier" on a children's book): apply the spirit of the request
  (more energetic pacing) while flagging the audience mismatch rather
  than silently producing age-inappropriate content.