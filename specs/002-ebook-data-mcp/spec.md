# Spec: ebook-data MCP Server

**Feature**: Custom MCP server for shared book-data access by the specialist
agents | **Derives from**: AGENTS.md §7 (MCP decision order: reused across
agents + sensitive scope → custom MCP server), Constitution Article IV.3–4
(narrow named tools only; no raw SQL/DB access exposed to any model)
| **Status**: ratified inline by project owner 2026-09-21

## 1. Why this server exists

Content Agent, Cover Design Agent, Formatting Agent, and Publishing Advisor
Agent all read/write the same book-related tables. Per AGENTS.md §7.3, a
capability reused across multiple agents with sensitive scope gets a **custom
MCP server** (stateless streamable HTTP), not a per-agent `function_tool`.

## 2. Transport & scope

- **Transport**: stateless streamable HTTP (`stateless_http=True`), the
  default per AGENTS.md §7.3. Not stdio (multiple agent processes call it).
- **Narrow scope**: exactly the 8 tools below. No `run_query`, no
  `update_book` catch-all, no admin/schema/migration capability. That stays a
  separate dev-time concern (AGENTS.md §7.4).
- **Non-goal**: external publishing submission. `create_publishing_record` only
  records intent (status `pending`); the actual external submission lives in a
  separate `publishing-platforms` MCP server and is human-approval-gated there
  (Constitution Article IV.6 / II.2).

## 3. Non-negotiable rules (all tools)

1. Every tool takes `tenant_id` and `account_id` and every read/write filters by
   both. The caller (each agent) passes the values from its own authenticated
   session context; this server does not second-guess them, but no tool may
   read or write without both present.
2. Parameterized queries only; no tool constructs raw SQL from parameters.
3. Every write tool inserts one `audit_log` row + one
   `capability_invocations` row in the same transaction as its main write
   (Article VIII). Read-only tools write only `capability_invocations` (for
   latency/cost tracking).
4. Every write verifies the parent row (e.g. the `book`) belongs to the given
   account/tenant before inserting; a miss raises a clear "not found" error and
   writes nothing.
5. `tenant_id`/`account_id` values are `uuid` strings; malformed uuids are
   rejected before any SQL runs.

## 4. Tools

Identifiers are returned as `uuid` strings (`str`).

### 1. `save_content_version(book_id, account_id, tenant_id, content, is_partial) -> content_version_id`

Writes to `content_versions`. Always inserts a new row (versioning additive —
never overwrites a prior version); `version_num = max(version_num for book) +
1`. `is_partial` marks streaming vs completed.

### 2. `get_book_status(book_id, account_id, tenant_id) -> {status, stage}`

Read-only. Returns the current book `status` and stage (`draft` /
`formatting` / `publishing` / `live`). In this slice `stage` mirrors `status`.

### 3. `save_cover_asset(book_id, account_id, tenant_id, image_ref, is_selected) -> cover_asset_id`

Writes to `cover_assets`. Setting `is_selected = true` unsets it on any other
asset of the same book **in the same transaction** — exactly one selected cover
per book.

### 4. `get_cover_assets(book_id, account_id, tenant_id) -> list[{id, image_ref, is_selected}]`

Read-only. Ownership-filtered list, oldest first.

### 5. `run_formatting_job(book_id, account_id, tenant_id, target_format, content_version_id, cover_asset_id) -> job_id`

Writes to `formatting_jobs` with `status = 'queued'`. Validates that
`content_version_id` (and `cover_asset_id`, when given) belong to the same
book/account/tenant before inserting. Only records the queued job — the actual
formatter runs elsewhere.

### 6. `get_formatting_job_status(job_id, account_id, tenant_id) -> {status, ...}`

Read-only. Must verify the job belongs to the given account/tenant before
returning anything — never returns another tenant's job status even if the
`job_id` is guessed or malformed.

### 7. `create_publishing_record(book_id, account_id, tenant_id, platform, metadata) -> publishing_record_id`

Writes to `publishing_records` with `status = 'pending'`. Records intent only;
does **not** submit anywhere external. The gated external submission lives in
the separate `publishing-platforms` server.

### 8. `get_publishing_record(book_id, account_id, tenant_id, platform) -> record`

Read-only. Returns the latest record for that book/platform scoped by
account/tenant, or a "not found" error.

### Audit/invocation actions

- Writes use audit action names: `content_version.save`, `cover_asset.save`,
  `formatting_job.queued`, `publishing_record.created` (status `success`).
- All tools record `capability_invocations` with action = tool name and the
  agent identity `ebook-data`.
- `audit_log.inputs`/`capability_invocations.inputs` never contain secrets or
  raw credentials; large payloads (`content`) are stored as
  preview+length, not the full text.

## 5. Acceptance criteria

- [ ] All 8 tools exposed; listing tools shows exactly those 8 names.
- [ ] Every tool requires `tenant_id` + `account_id`; malformed uuids rejected.
- [ ] Write tools create audit + invocation rows in the same transaction
      (verified under a rolled-back write: no orphan rows).
- [ ] `save_content_version` never updates an existing row (additive).
- [ ] `save_cover_asset(is_selected=true)` leaves exactly one selected asset
      per book.
- [ ] `get_formatting_job_status` on a job from another tenant raises
      "not found".
- [ ] `create_publishing_record` performs no external call.
- [ ] `ruff` + `pyright` green.

## 6. Runtime

`DATABASE_URL` required. Host/port/pool via `EBOOK_DATA_HOST`,
`EBOOK_DATA_PORT`, `EBOOK_DATA_POOL_MIN/MAX`. Run:
`uv run ebook-data` (or `uv run python -m ebook_data.server`).