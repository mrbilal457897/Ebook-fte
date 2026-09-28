-- 0003 — Slice 002 schema: the three tables the ebook-data MCP server needs.
-- specs/002-ebook-data-mcp/data-model.md ratified these column lists on
-- 2026-09-21; this migration is the "separate task with its own slice" that
-- data-model.md deferred. Forward-only; do not edit after being applied.

BEGIN;

-- Generated cover variants for a book. At most one row per book has
-- is_selected = true; ebook_data.save_cover_asset enforces that in the same
-- transaction as the insert (a partial unique index cannot be used because
-- `now()`-free predicates here are fine, but the tool's transactional unset
-- is the specified mechanism and must stay authoritative).
CREATE TABLE cover_assets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id     uuid NOT NULL REFERENCES books(id),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    account_id  uuid NOT NULL REFERENCES accounts(id),
    image_ref   text NOT NULL,
    is_selected boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Defensive backstop for the "exactly one selected cover per book" rule the
-- tool maintains transactionally. A plain partial index on a constant
-- predicate is IMMUTABLE, so unlike the slice-001 lease index this one is
-- appliable on every Postgres.
CREATE UNIQUE INDEX cover_assets_one_selected_per_book
    ON cover_assets (book_id) WHERE is_selected;

-- Formatting/export jobs. This server only records intent (status 'queued');
-- the formatter that moves the job to running/done/failed runs elsewhere.
CREATE TABLE formatting_jobs (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id            uuid NOT NULL REFERENCES books(id),
    tenant_id          uuid NOT NULL REFERENCES tenants(id),
    account_id         uuid NOT NULL REFERENCES accounts(id),
    target_format      text NOT NULL,
    content_version_id uuid NOT NULL REFERENCES content_versions(id),
    cover_asset_id     uuid REFERENCES cover_assets(id),
    status             text NOT NULL DEFAULT 'queued',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT formatting_jobs_target_format_valid
        CHECK (target_format IN ('epub', 'mobi', 'pdf')),
    CONSTRAINT formatting_jobs_status_valid
        CHECK (status IN ('queued', 'running', 'done', 'failed'))
);

-- Publishing intent per platform. status 'pending' records intent only; the
-- approval-gated external submission lives in the separate
-- `publishing-platforms` MCP server (Constitution Article IV.6).
CREATE TABLE publishing_records (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id    uuid NOT NULL REFERENCES books(id),
    tenant_id  uuid NOT NULL REFERENCES tenants(id),
    account_id uuid NOT NULL REFERENCES accounts(id),
    platform   text NOT NULL,
    metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
    status     text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT publishing_records_platform_valid
        CHECK (platform IN ('kdp', 'apple_books', 'ingramspark', 'draft2digital')),
    CONSTRAINT publishing_records_status_valid
        CHECK (status IN ('pending', 'submitted', 'live', 'rejected'))
);

CREATE INDEX cover_assets_book_id_idx ON cover_assets (book_id);
CREATE INDEX formatting_jobs_book_id_idx ON formatting_jobs (book_id);
CREATE INDEX publishing_records_book_platform_idx
    ON publishing_records (book_id, platform, created_at DESC);

COMMIT;
