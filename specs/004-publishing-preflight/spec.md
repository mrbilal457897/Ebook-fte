# Slice 004 — Publishing pre-flight (spec)

**Date:** 2026-10-01
**Supersedes:** nothing. **Constrains:** AGENTS.md §2 Publishing (corrected
2026-10-01), §7 (MCP decision order), Principle 6 (narrow tools), Principle 10
(prefer what exists).

## 1. Goal

Make the agent genuinely useful at publishing **without** being able to submit.

Two capabilities, both real:

1. **Authoritative platform requirements.** An exact, sourced answer to "what
   does KDP require for an EPUB cover?" — replacing prompt-text invention.
2. **Package pre-flight validation.** Given the facts a customer declares about
   their package, check it against the target platform's rules and report every
   violation with the rule it broke.

The output is a package that passes review on the customer's single attempt,
plus an honest statement of what still needs their hands.

## 2. Non-goals

- **No `submit_for_publishing` tool.** No such endpoint exists for KDP, Apple
  Books, or IngramSpark (see `research.md`).
- **No browser automation.** Out of scope until the human approves it
  separately.
- **No byte-level file validation.** No artifact store exists yet.
- **No new dependencies.** The reference data is structured, versioned source in
  this repo — deliberately not scraped at runtime and not model-generated. An
  LLM that invents a trim size is worse than no answer.

## 3. Shape

### 3.1 A `platform-requirements` MCP server

Per AGENTS.md §7 step 3: reused across agents (Publishing Advisor today,
Formatting Agent next), a narrow reviewed scope, and it must outlive any single
agent's process. It is a separate `uv` project at
`mcp-servers/platform-requirements/`, stateless streamable HTTP, consistent
with the existing `ebook-data` server.

Exactly two tools. Not "get anything about publishing":

| Tool | Purpose | Approval |
|---|---|---|
| `lookup_platform_requirements(platform, aspect)` | Authoritative rules for one platform + aspect | none (read-only) |
| `validate_package(platform, package)` | Every rule the declared package breaks | none (pure, no writes) |

There is deliberately **no** tool that writes, submits, or reaches the network.
A read-only pre-flight server cannot become the thing that publishes.

### 3.2 Data provenance

`platforms.py` holds the rules as structured Python literals, each carrying
`source` (the primary document) and `as_of`. Rules are data, not prose, because
they are consumed programmatically by `validate_package`.

Coverage is deliberately the three platforms in AGENTS.md §2. An unknown
platform returns an explicit `unsupported_platform` error — never an empty
success, which a caller could read as "no requirements".

### 3.3 Validation semantics

`validate_package` takes declared facts and returns **all** violations, not the
first — a customer fixing a package one error per upload is the failure mode
this exists to prevent. Each violation carries the rule id and its source, so
the Publishing Advisor can explain *why* rather than assert.

Two rule kinds:

- **`limit`** — a numeric bound (`file_size_mb <= 650`). Integers only; a
  float in an inches field is a caller bug and is reported, not rounded.
- **`enum`** — membership (`format == 'epub'`). Reports the allowed set.

A field that is absent is `unknown`, not a pass. Required fields that are
missing are violations. This matters: silently skipping an unknown field is how
a validator ends up reporting a clean package it never actually checked.

### 3.4 The 1/16" print tolerance

IngramSpark allows 1/16" (0.0625 in) print variance. A rule expressed only as
nominal dimensions passes a file that printing then rejects. `validate_package`
therefore evaluates trim-size rules against the tolerance band, and the
tolerance is part of the rule data, not a hard-coded fudge in the comparison.

### 3.5 Wiring

The Publishing Advisor Agent gains the two tools via a second `McpToolset`,
alongside its existing `ebook-data` toolset. Its `description` and instructions
must state the boundary plainly: it validates and explains, the human submits.

## 4. Acceptance criteria

| ID | Criterion | Check |
|---|---|---|
| AC1 | `lookup_platform_requirements` returns sourced rules for all three platforms, and an explicit error for an unsupported one | unit test |
| AC2 | Every rule returned carries a non-empty `source` | unit test, no rule may be unsourced |
| AC3 | `validate_package` finds a deliberately broken package across multiple fields in one call | unit test |
| AC4 | A valid package returns zero violations | unit test |
| AC5 | A missing required field is a violation, not a silent pass | unit test |
| AC6 | IngramSpark trim size just outside nominal but inside the 1/16" band passes; just outside the band fails | unit test — the regression this guards |
| AC7 | A float in a dimension field is reported as a caller error, not rounded | unit test |
| AC8 | The server exposes exactly the two named tools and nothing that writes or reaches the network | tool-manifest test |
| AC9 | Publishing Advisor Agent's tool list contains both new tools, and its instructions do not claim it can submit | toolset test + assertion |
| AC10 | No tool description anywhere claims submission to KDP/Apple/Ingram | repo-wide text assertion |

## 5. What the customer still does

Stated by the agent, not hidden: sign in to the platform, upload, and press
publish. This slice reduces how often that fails; it does not remove it.