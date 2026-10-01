# voice-agent

The Voice Agent (AGENTS.md §4): text-to-speech audiobook generation and voice
selection.

**Status: NOT WIRED. No tools, no sub-agent role.** This project is a
placeholder created during slice 001 scaffolding and deliberately left
unconnected.

## Why it is empty

Slice 003 (`specs/003-specialist-roster/spec.md` §2–3) considered wiring it and
declined: audiobook generation needs a text-to-speech provider and storage for
the resulting audio, and neither exists. The `voice-sample-selector` skill can
recommend voices on paper, but recommending a voice with no way to use it would
overstate the product's capability.

## What wiring it will require

Its own spec, and all of the following before it can be attached:

1. A **TTS provider integration** and a **`narrations`** table to hold the
   generated audio (no such table exists in `db/migrations/`).
2. A **narrow toolset** — generate narration, fetch narration status — reachable
   through an MCP server or a scoped ADK tool, following AGENTS.md §7.
3. **`build_voice_agent(...)`** replacing the module-level singleton, so double
   composition is safe.
4. Tests matching slice 003's AC1–AC7 (allowlist disjointness, no `tenant_id`
   from conversation text, prompt honesty).

## Run

Nothing to run — this module is imported by no one.

```sh
uv sync
uv run ruff check . && uv run pyright
```
