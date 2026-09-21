---
name: find-similar-reference
description: Searches the shared reference library (documents/embeddings, tagged by type — past drafts, style guides, platform policy docs, resolved support cases) for content semantically similar to a current task, across any specialist agent. Use whenever a specialist would benefit from precedent — a similar past book's structure, a style reference, a past-resolved similar support question, a platform policy passage relevant to the current book. Do NOT use as a substitute for the specific platform-requirements lookup tools (lookup_platform_requirements) when an exact, authoritative answer exists there instead — this is for semantic/precedent search, not authoritative lookup.
---

## Steps
1. Identify what's being searched for and, if the library is tagged by
   type, narrow to the relevant tag (e.g. 'style_reference',
   'past_case', 'policy_doc').
2. Embed the query with the same model used to build the library (never
   mix embedding models between store and search).
3. Return the top 3-5 matches ranked by similarity, with enough context
   for the calling agent to judge relevance, not just a raw score.
4. Flag low-confidence matches explicitly rather than presenting a weak
   match with the same confidence as a strong one.

## Edge cases
- No reasonably close match exists: say so plainly ("no strong
  precedent found") rather than returning a weak match dressed up as
  relevant — a specialist agent building on a false precedent is worse
  than one that proceeds without one.