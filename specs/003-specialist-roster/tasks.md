# Tasks: Specialist Roster (Slice 3)

**Input**: `specs/003-specialist-roster/spec.md`

**Tests**: spec.md §5 states seven acceptance criteria; Constitution Article X
requires each to become an actual check. Unlike slice 001 these are structural
guarantees (what a toolset contains, what the prompt says, what a description
claims) rather than transactional behaviour, so they are proven against the
built agent objects and the prompt text — no database needed, and none used, so
the suite stays fast and deterministic.

## Phase 1: Code

- [X] T001 `agents/cover-design-agent/src/cover_design_agent/bookdata.py` — `COVER_AGENT_TOOLS` allowlist + `build_book_data_toolset()`, mirroring `content_agent/bookdata.py`: `McpToolset` over `StreamableHTTPConnectionParams` with `tool_filter`, built fresh per agent instance.
- [X] T002 Same for `formatting_agent` (`FORMATTING_AGENT_TOOLS`) and `publishing_advisor_agent` (`PUBLISHING_ADVISOR_TOOLS`).
- [X] T003 Add `mcp==2.2.0` to each of the three `pyproject.toml` files (pinned per AGENTS.md §5 — the same pin the Content Agent and Orchestrator use) and `uv sync` / commit `uv.lock` in each.
- [X] T004 `agent.py` in each: replace the module-level singleton with `build_<name>_agent(*, model=None, with_book_data_tools=True) -> LlmAgent`, matching `build_content_agent`. The singleton is not a viable export any more — the Orchestrator must build fresh instances per composition, and a module-level agent is the exact thing that breaks on a second parent build.
- [X] T005 Rewrite each `instructions.py`: correct the tool list to the real allowlist, and add the §3 "what is not available yet" clause (no image generation / no file produced / no platform submission). AC5.
- [X] T006 `agents/orchestrator/src/orchestrator/agent.py` — attach all four specialists as `sub_agents`, each built fresh.
- [X] T007 `agents/orchestrator/src/orchestrator/instructions.py` + `contracts/orchestrator-prompt.md` — replace the "only the Content Agent is wired up" special case with per-specialist routing lines scoped to real capability, and an explicit "not available yet" list. The contract is the ratified source of truth, so the prompt file and the code must not diverge.

## Phase 2: Tests

- [X] T008 AC1/AC2 — `test_specialist_toolsets.py`: every allowlist is a subset of the server's 8 tools; the allowlists are pairwise disjoint; no allowlist contains a tool belonging to another specialist's table.
- [X] T009 AC3 — extend `test_composition.py`: exactly four sub-agents, expected names in order; building the Orchestrator twice does not raise (the ADK parenting bug this composition shape is prone to).
- [X] T010 AC4 — the system prompt names each of the four wired specialists, still contains "are coming soon", and no longer contains the single-specialist special case.
- [X] T011 AC5 — each wired agent's `description` claims only what it can do, and its instructions contain the not-available-yet disclaimer. Asserted on the *text*, because an over-claiming description is exactly the failure this criterion exists to prevent and a human reviewer will not catch it in a prompt diff.
- [X] T012 AC6 — no wired specialist module derives `tenant_id`/`account_id` from anything but its arguments: an AST sweep over the three packages, mirroring slice 002 T012's proof that no network client is imported.
- [X] T013 AC7 — `ruff` + `pyright` green in the three new projects and the Orchestrator; the Orchestrator's DB-backed suite re-run in full.

## Dependencies & Execution Order

1. T001–T003 before T004 (an agent cannot attach a toolset that is not importable).
2. T004 before T006 (the Orchestrator composes built agents).
3. T005 before T010/T011 (the prompt and the disclaimers are asserted on text).
4. T008–T012 are independent of each other and parallelizable.
