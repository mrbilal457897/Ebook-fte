# Data Model: ebook-data MCP Server

**Feature**: [spec.md](spec.md) | Shared tables follow
`specs/001-free-tier-content-generation/data-model.md`. This file documents
only (a) the assumed columns used by the 8 tools, and (b) the three tables not
yet defined in slice 001: `cover_assets`, `formatting_jobs`,
`publishing_records`.

**Status**: schema assumptions ratified inline (2026-09-21). The three tables
below shipped in `db/migrations/0003_ebook_data_mcp_tables.sql` on
2026-09-26 — that was the "separate task with its own slice" deferred here.

## Shared tables used (defined in slice 001)

- `books` — `id`, `tenant_id`, `account_id`, `status` (`draft`), `created_at`.
- `content_versions` — `id`, `book_id`, `tenant_id`, `account_id`,
  `version_num`, `content`, `is_partial`, `created_at`, `updated_at`.
- `capability_invocations` — id, tenant_id, account_id, agent, action, inputs
  (jsonb), output (jsonb), latency_ms, cost, success, created_at.
- `audit_log` — id, tenant_id, account_id, agent, action, inputs (jsonb),
  output (jsonb), timestamp, status.

## Tables assumed (migrated in `0003`, 2026-09-26)

### `cover_assets`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `book_id` | uuid FK → books | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `image_ref` | text | storage reference for the generated image |
| `is_selected` | boolean default false | at most one true per book — tool 3 enforces it in-transaction; `0003` adds a partial unique index on `(book_id) WHERE is_selected` as a backstop |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `formatting_jobs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `book_id` | uuid FK → books | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `target_format` | text | `'epub'` / `'mobi'` / `'pdf'` |
| `content_version_id` | uuid FK → content_versions | the version being formatted |
| `cover_asset_id` | uuid FK → cover_assets, nullable | |
| `status` | text | `'queued'` (then `'running'`/`'done'`/`'failed'` by the formatter, outside this server) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `publishing_records`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `book_id` | uuid FK → books | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `platform` | text | `'kdp'` / `'apple_books'` / `'ingramspark'` / `'draft2digital'` |
| `metadata` | jsonb | title, description, categories, genre, keywords (platform-mapped) |
| `status` | text | `'pending'` (intent only — no external submission by this server) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

## Audit/invocation write rules

- Writes: audit + capability rows, same transaction as the main write.
- Reads: capability row only.
- `inputs` `content`: stored as `{content_chars, content_preview}` — never the
  full streamed text in audit bloat; never secrets.