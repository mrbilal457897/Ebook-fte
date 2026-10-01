# Tasks: ebook-data MCP Server (Slice 2)

**Input**: Design documents from `specs/002-ebook-data-mcp/`

**Prerequisites**: spec.md (present), data-model.md (present).
`research.md` / `plan.md` were never authored for this slice — the spec was
ratified inline by the project owner on 2026-09-21 and the server was built
directly from it. That gap is recorded as T101 below rather than papered over.

**Tests**: spec.md §5 states eight acceptance criteria, and Constitution
Article X requires the criteria of a spec to become actual checks. This slice
has no user stories (it is infrastructure), so the test tasks are grouped by
acceptance criterion instead and every one is DB-backed — the criteria are
about transaction behaviour and tenant isolation, neither of which a mock can
establish.

**Status at 2026-09-28**: all 20 tasks are complete (Phases 1–4). 31 DB-backed
tests pass against real Postgres; `ruff` and `pyright` are green; all eight
spec acceptance criteria are ticked in spec.md §5. Phase 4 (wiring) closed the
same day: the server is no longer dead code — the Content Agent reaches
`content_versions` through it via `save_content_version`, and the Orchestrator's
43 DB-backed tests pass unchanged after that wiring. See T101 for the recorded
direct-SQL exception covering the Orchestrator's three streaming transaction
shapes.

## Format

- `- [ ] T### [P] Description with exact file path`
- `[P]` = parallelizable (different files, no cross-dependencies)

---

## Phase 1: Schema (Blocking)

**Purpose**: the three tables the tools write to do not exist yet

- [X] T001 Author `db/migrations/0003_ebook_data_mcp_tables.sql` creating `cover_assets`, `formatting_jobs`, `publishing_records` exactly as ratified in data-model.md, plus the `CHECK` constraints the tools' error messages assume (`formatting_jobs.target_format IN ('epub','mobi','pdf')` and its status set; `publishing_records.platform IN ('kdp','apple_books','ingramspark','draft2digital')` and its status set). Every table carries `tenant_id`; forward-only per `db/migrations/README.md`.
- [X] T002 Add `CREATE UNIQUE INDEX cover_assets_one_selected_per_book ON cover_assets (book_id) WHERE is_selected` as a database-level backstop for the "exactly one selected cover" rule that `save_cover_asset` maintains transactionally. A partial index on a constant predicate is IMMUTABLE, so unlike the slice-001 lease index this one is appliable on every Postgres.
- [X] T003 Apply `0003` to the target database and record the result in this file.

## Phase 2: Tool Verification

**Purpose**: the eight tools were written but never executed

- [X] T004 Add `pytest` to the `dev` dependency group of `mcp-servers/ebook-data/pyproject.toml` (range is acceptable for test tooling per AGENTS.md §5) and `uv sync`.
- [X] T005 Create `mcp-servers/ebook-data/tests/conftest.py`: a session `DATABASE_URL` gate that **skips explicitly** when unset (never silently passes — Constitution Article X), a `db` connection fixture, and `seed_scope` / `seed_book` helpers that give every test its own fresh tenant + account so no test can observe another's rows.
- [X] T006 AC1 — assert the live server exposes exactly the 8 tools and nothing broader. The test calls `server.list_tools()` rather than reading the local `TOOLS` list, so a tool registered-but-not-exposed (or exposed-but-not-declared) fails. A second test asserts every tool's published input schema declares `tenant_id` and `account_id`, because that is what an MCP client actually sees.
- [X] T007 AC2 — parametrized over all 8 tools: both scope values are declared parameters, a missing scope raises, and a malformed uuid raises **before any SQL runs** (proven by an unchanged `capability_invocations` count, not by the exception alone).
- [X] T008 AC3 — one test per write tool asserting exactly one `audit_log` + one `capability_invocations` row with the specified action name, one test asserting reads record `capability_invocations` only, and `test_ac3_rolled_back_write_leaves_no_orphan_rows` which drives a real rollback through `db.transaction()` and then asserts no orphan rows survived.
- [X] T009 AC4 — `save_content_version` twice on one book yields two rows with `version_num` 1 and 2, and the first row's content is still its original value.
- [X] T010 AC5 — selecting a second cover unsets the first, leaving exactly one selected; saving with `is_selected=false` leaves an existing selection alone.
- [X] T011 AC6 — a real foreign-tenant `job_id` raises "not found", and a guessed-but-unused uuid is indistinguishable from it. Plus `test_ac6_tenant_isolation_holds_for_every_read` across every read tool, and `test_ac6_write_against_foreign_book_is_rejected` for the three writes.
- [X] T012 AC7 — intent-only proof, two ways: an AST sweep of every module in the `ebook_data` package asserting no network client is imported, and `socket.socket` / `socket.create_connection` monkeypatched to raise during the call. A companion test asserts a formatting job is left `queued` and a foreign `content_version` / `cover_asset` is rejected before any insert.
- [X] T013 Audit hygiene per spec §4 — `content` is stored in `audit_log.inputs` as `content_chars` + a 100-char preview, never the full text; audit rows carry the `ebook-data` agent identity and the caller's own `tenant_id` / `account_id`.
- [X] T014 Run `uv run ruff check .` and `uv run pyright` in `mcp-servers/ebook-data/`; fix to green (AGENTS.md §5, Article X). Also re-run the full suite after the fixes.

## Phase 3: Spec Bookkeeping

- [X] T015 Tick all eight acceptance criteria in `spec.md` §5, each naming the test that proves it, and record the two behavioural decisions verification surfaced (the `IndeterminateDatatype` fix in `run_formatting_job`; `get_cover_assets` returning `[]` rather than raising for a foreign book).
- [X] T016 Update `data-model.md` — the "not yet migrated — flagged to the owner" deferral is resolved; point it at `0003` and record the backstop index.

## Phase 4: Wiring (Complete)

**Purpose**: the server is verified but nothing calls it yet. The Content
Agent still persists through the Orchestrator's own `persistence.py`, so the
MCP server is currently dead code in production terms.

- [X] T101 Write `specs/002-ebook-data-mcp/research.md` and `plan.md`, or record an explicit decision that this slice is spec-complete without them. **The Orchestrator is the only MCP client so far and it reaches the database directly — Principle 8/AGENTS.md §7.3 say shared book data belongs behind this server, so the direct path is a known deviation, not a sanctioned one.** Decide and document it before T103. **Resolved by the recorded exception in `spec.md` §7 (owner decision 2026-09-28): the Orchestrator's direct-SQL path narrows to exactly three transaction shapes — `persist_chunk`, `finalize_generation`, `fail_generation` — because the streaming path must share one commit with the in-flight lease row. §7.3 now carries a standing obligation: no new direct-SQL call may be added to `persistence.py` without updating §7 first, and the three shapes must not grow a general branch. The missing `research.md`/`plan.md` are recorded as a procedural gap for future slices, not papered over.**
- [X] T102 Add `EBOOK_DATA_URL` to the repo-root `.env.example` (and the real `.env`) so the URL is configured in one place per AGENTS.md §5. Added at `.env.example:31` (`EBOOK_DATA_URL=http://localhost:8081/mcp`) alongside `EBOOK_DATA_PORT`; read by `content_agent.bookdata.ebook_data_url()` with the same value as its module default, so one edit covers both places.
- [X] T103 Wire an MCP client into the specialist agents per spec §2: the Content Agent reaches `content_versions` through `save_content_version`, and `agents/orchestrator/src/orchestrator/persistence.py` narrows to the streaming/incremental work that genuinely needs a direct transaction. Keep `tenant_id` derived from the authenticated session at the boundary — never from model output (Constitution Article IV.5). **New `agents/content-agent/src/content_agent/bookdata.py`: `build_book_data_toolset()` returns an `McpToolset` over `StreamableHTTPConnectionParams` with `tool_filter=CONTENT_AGENT_TOOLS` — an explicit two-tool allowlist (`save_content_version`, `get_book_status`) so a tool added to the server later is not silently exposed to this agent. `build_content_agent(with_book_data_tools=...)` gates the toolset; the Orchestrator passes `with_book_data_tools=not streaming` because during a stream it owns the write transaction (lease renewal shares the commit) and a second writer on the same row would race it (spec §7.2). `tenant_id`/`account_id` are supplied by the Orchestrator from the authenticated session and passed as tool arguments; the module never derives them from conversation text, and the server rejects a missing or malformed scope before running any SQL, so a wrong value fails closed.**
- [X] T104 Re-run the Orchestrator's 43 DB-backed tests after T103. The incremental-persistence path (FR-005) commits per chunk and renews a lease per chunk; that behaviour must not regress by moving the final write behind an HTTP hop. **43 passed, 0 failed against real Postgres (Neon), 6 skipped (non-DB). Three regressions were found and fixed while doing this, all in the T103 wiring rather than in the persistence path itself: (1) `tools=build_book_data_toolset()` passed the toolset as a bare value — ADK's `LlmAgent._pre_validate_tools` iterates `data['tools']`, so a single `McpToolset` raised `TypeError: 'McpToolset' object is not iterable` at import; now wrapped in a list. (2) The free-tier resolution path calls `Settings.require_platform_key()` before any model runs and refuses an empty key (FR-008, no silent fallback), so admission tests using `fake_llm.FakeLlm` — which never contact a provider — still failed on a missing `GOOGLE_API_KEY`; conftest now supplies a placeholder **only when the environment has none**, so a real key still wins. (3) `build_orchestrator` gained the `streaming` keyword, which `fake_orchestrator`/`failing_orchestrator` did not accept (`TypeError: got an unexpected keyword argument 'streaming'`); the fakes now take and ignore it to stay signature-compatible. `test_per_chunk_lease_renewal_extends_the_live_lease` and `test_content_never_diverges_from_ui_at_any_chunk_boundary` pass unchanged, so FR-005's per-chunk commit and per-chunk lease renewal did not regress.**

## Dependencies & Execution Order

1. Phase 1 (schema) blocks everything — the tools cannot run without the tables.
2. T005 (fixtures) blocks T006–T013.
3. T006–T013 are independent of each other and were written to be parallelizable.
4. T015/T016 are bookkeeping on T006–T014's results.
5. Phase 4 depended on the T101 decision and was deliberately left open — it
   changes which process owns each write, which was a design call for the
   project owner, not a mechanical one. **Closed 2026-09-28**: the owner
   recorded the direct-SQL exception in `spec.md` §7 and T101–T104 are now
   complete. **No task in this file is open.**
