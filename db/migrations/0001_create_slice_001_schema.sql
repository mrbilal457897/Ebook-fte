-- 0001 — Slice 001 initial schema
-- 10 tables per specs/001-free-tier-content-generation/data-model.md.
-- Forward-only; do not edit after being applied. Fix mistakes with 0002+.

BEGIN;

-- Subscribing company an end-customer belongs to (Article II.1 tenancy).
CREATE TABLE tenants (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    slug       text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- End-customer; one per tenant (data-model Clarification Q3).
-- Free-tier invariant: 0 <= free_tier_count <= free_tier_limit (FR-007),
-- enforced by the atomic admission statement (gate.py) and guarded here.
CREATE TABLE accounts (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                 uuid NOT NULL REFERENCES tenants(id),
    email                     text NOT NULL,
    auth_subject              text NOT NULL,
    free_tier_count           int  NOT NULL DEFAULT 0,
    free_tier_limit           int  NOT NULL DEFAULT 3,
    active_byok_credential_id uuid,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT accounts_free_tier_bounds
        CHECK (free_tier_count >= 0 AND free_tier_count <= free_tier_limit),
    CONSTRAINT accounts_tenant_email_unique UNIQUE (tenant_id, email),
    CONSTRAINT accounts_tenant_subject_unique UNIQUE (tenant_id, auth_subject)
);

-- Session in which generations happen (prompt -> completion).
CREATE TABLE conversations (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES tenants(id),
    account_id uuid NOT NULL REFERENCES accounts(id),
    title      text,
    summary    text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Book stub; creation is incidental on first generation (data-model.md).
CREATE TABLE books (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES tenants(id),
    account_id uuid NOT NULL REFERENCES accounts(id),
    status     text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Generated content; grows incrementally during streaming (FR-005).
-- Additive versioning: one version_num per book, enforced unique.
CREATE TABLE content_versions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id     uuid NOT NULL REFERENCES books(id),
    tenant_id   uuid NOT NULL REFERENCES tenants(id),
    account_id  uuid NOT NULL REFERENCES accounts(id),
    version_num int  NOT NULL DEFAULT 1,
    content     text NOT NULL DEFAULT '',
    is_partial  boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT content_versions_book_version_unique UNIQUE (book_id, version_num)
);

-- Single-in-flight generation lease (FR-009, Clarification Q2).
-- The partial unique index is the live-lease: at most one row per
-- (account_id, kind) whose lock_expires_at is in the future. Expired leases
-- drop out of the uniqueness scope automatically, allowing a new insert.
CREATE TABLE run_states (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id),
    account_id      uuid NOT NULL REFERENCES accounts(id),
    kind            text NOT NULL,
    state           text NOT NULL DEFAULT 'running',
    payload         jsonb,
    lock_expires_at timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX run_states_live_lease_unique
    ON run_states (account_id, kind)
    WHERE lock_expires_at > now();

-- One row per tool/agent invocation (shared spine, AGENTS.md §8).
CREATE TABLE capability_invocations (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES tenants(id),
    account_id uuid NOT NULL REFERENCES accounts(id),
    agent      text NOT NULL,
    action     text NOT NULL,
    inputs     jsonb,
    output     jsonb,
    latency_ms int,
    cost       numeric,
    success    boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Every generation action audited in the same txn as the action (Article VIII).
CREATE TABLE audit_log (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid NOT NULL REFERENCES tenants(id),
    account_id uuid NOT NULL REFERENCES accounts(id),
    agent      text NOT NULL,
    action     text NOT NULL,
    inputs     jsonb,
    output     jsonb,
    timestamp  timestamptz NOT NULL DEFAULT now(),
    status     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- BYOK keys, encrypted at rest; decrypted in-memory only (Article VII.2).
CREATE TABLE model_credentials (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id),
    account_id    uuid NOT NULL REFERENCES accounts(id),
    provider      text NOT NULL,
    encrypted_key bytea NOT NULL,
    last_status   text NOT NULL DEFAULT 'valid',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT model_credentials_provider_valid
        CHECK (provider IN ('gemini', 'openai', 'anthropic'))
);

-- Atomic per-device/per-IP counters for FR-002. scope_key is a SHA-256 hex
-- digest of the device fingerprint / client IP — never raw PII.
CREATE TABLE rate_limit_counts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL REFERENCES tenants(id),
    account_id   uuid NOT NULL REFERENCES accounts(id),
    kind         text NOT NULL,
    scope_key    text NOT NULL,
    window_start timestamptz NOT NULL,
    count        int  NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT rate_limit_counts_kind_valid CHECK (kind IN ('device', 'ip')),
    CONSTRAINT rate_limit_counts_window_unique
        UNIQUE (tenant_id, account_id, kind, scope_key, window_start)
);

-- Circular edge accounts <-> model_credentials, resolved after both exist.
ALTER TABLE accounts
    ADD CONSTRAINT accounts_active_byok_fk
    FOREIGN KEY (active_byok_credential_id) REFERENCES model_credentials(id);

-- Indexes for common lookups.
CREATE INDEX content_versions_book_id_idx ON content_versions (book_id);
CREATE INDEX capability_invocations_tenant_idx ON capability_invocations (tenant_id);
CREATE INDEX audit_log_tenant_action_idx ON audit_log (tenant_id, action);
CREATE INDEX rate_limit_counts_scope_idx ON rate_limit_counts (kind, scope_key, window_start);

COMMIT;