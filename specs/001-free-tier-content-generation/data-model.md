# Data Model: Free-Tier Real-Time Content Generation

**Feature**: [spec.md](spec.md) | **Derives from**: Constitution Article V
(system of record) + AGENTS.md §8 (table list) | **Date**: 2026-09-19

One Postgres + pgvector database. Every table holding tenant data carries
`tenant_id`. `tenant_id` is always derived from the authenticated session at
the boundary — never accepted from model output (Article IV.5). No new tables
are invented beyond the shared spine and business tables already listed in
AGENTS.md §8; the single addition this slice needs is `rate_limit_counts`,
which AGENTS.md §8 does not already cover (the FR-002 store).

Naming/serial conventions: all ids `uuid` (or `bigint` per repo migration
convention — settled at migration authoring time); `created_at`/`updated_at`
on every table.

---

## Shared spine (subset used this slice)

### `tenants`

The subscribing company an end-customer belongs to.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `slug` | text | unique; used in the "arrived through" entry link/signup path |
| `created_at` | timestamptz | |

*Relationships:* one-to-many `accounts`, `books`, `conversations`, etc.

### `conversations`

Session in which generations happen. One row per generation session for this
slice (prompt → completion).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `title`/`summary` | text | brief summary of the session |
| `created_at` | timestamptz | |

### `run_states`

Paused/waiting/in-flight actions. This slice uses it for the single-in-flight
generation lease (FR-009 + Clarification Q2).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `kind` | text | `'generation'` for this slice |
| `state` | text | `'running'` |
| `payload` | jsonb | `version_id`, `conversation_id`, prompt ref (for diagnostics/audit) |
| `lock_expires_at` | timestamptz | lease expiry; renewed per streamed chunk (Q2) |
| `created_at` | timestamptz | |

*Constraint:* unique `(account_id, kind)` while a lease is live. Expired
leases (`lock_expires_at < now()`) are treated as free.

### `capability_invocations`

One row per tool/agent invocation (shared spine, AGENTS.md §8).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | this slice's association |
| `agent` | text | `'content'` |
| `action` | text | `'generate'` |
| `inputs` | jsonb | prompt, model, params used |
| `output` | jsonb | completion summary / version id |
| `latency_ms` | int | measured on the model call |
| `cost` | numeric | provider-adjusted cost estimate |
| `success` | boolean | false for provider-failed attempts |
| `created_at` | timestamptz | |

### `audit_log`

Every generation action (shared spine, AGENTS.md §8).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `agent` | text | `'orchestrator'` / `'content'` |
| `action` | text | `'generation.start'`, `'generation.chunk'`, `'generation.complete'`, `'generation.failed'`, `'generation.blocked'`, `'rate_limit.blocked'` |
| `inputs` | jsonb | prompt, model, credential provider (never the key) |
| `output` | jsonb | version_id, token count, latency |
| `timestamp` | timestamptz | |
| `status` | text | `'success'` / `'failed'` / `'blocked'` |

*Audit rule (Article VIII, FR-006):* the invariant is *one* audit row and *one*
invocation row per **generation**, committed in the same transaction as the
content write. `generation.chunk` rows are optional diagnostics and must never
break the "exactly one per generation" acceptance test (AC5) — the test counts
`generation.complete` (or terminal) rows, not chunk rows; to keep it simple
the recommended pattern is one audit row at terminal state plus optional chunk
rows clearly renamed `persistence.chunk` so AC5 can count by action.

---

## Business-specific

### `accounts`

An end-customer. **One account per tenant** (Clarification Q3): a person signs
up separately for each tenant, email unique within a tenant.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | derived from the entry/signup link the customer used |
| `email` | text | (normalized, case-folded) |
| `auth_subject` | text | vendor user id from the auth seam; hosts identity binding |
| `free_tier_count` | int default 0 | incremented atomically at admission (FR-007) |
| `free_tier_limit` | int default 3 | constant default; enforcement reads it (testable override) |
| `active_byok_credential_id` | uuid FK → model_credentials, nullable | resolved per request (FR-008) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

*Constraints:* unique `(tenant_id, email)`; unique `(tenant_id,
auth_subject)`. Free-tier invariant: `0 ≤ free_tier_count ≤ free_tier_limit`
enforced by the atomic admission statement, never negative (FR-007).

### `rate_limit_counts`

Atomic per-device/per-IP counters for FR-002, scoped to the account's tenant.
Mirrors the atomic free-tier admit on `accounts` (FR-007): check-and-increment
in one statement so concurrent requests cannot overshoot a threshold.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `kind` | text | `'device'` / `'ip'` |
| `scope_key` | text | SHA-256 of the device fingerprint / client IP — never raw PII |
| `window_start` | timestamptz | start of the current budget window (`now() - (now() % RATE_LIMIT_WINDOW_SECONDS)`) |
| `count` | int default 0 | incremented atomically; a new window starts a fresh row |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

*Constraint:* unique `(tenant_id, account_id, kind, scope_key, window_start)`.
Atomic admit == FR-002: `INSERT … ON CONFLICT (…) DO UPDATE SET count =
rate_limit_counts.count + 1 WHERE rate_limit_counts.count < :threshold
RETURNING count` — rejected when `RETURNING count` is absent or `> :threshold`.
Stale windows pruned opportunistically (`DELETE … WHERE window_start < now() - :window`).

### `model_credentials`

BYOK keys (encrypted at rest — never stored plaintext, never committed).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `provider` | text | `'gemini'` / `'openai'` / `'anthropic'` |
| `encrypted_key` | bytea | age/KMS-encrypted; decrypted in-memory only for the request duration |
| `last_status` | text | `'valid'` / `'invalid'` / `'expired'` (cached result of last auth probe) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Decrypted keys never enter logs, audit rows, or `capability_invocations`.

### `books`

A book record; minimal stub this slice (content_versions need a `book_id`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `status` | text | `'draft'` only this slice (formatting/publishing are future slices) |
| `created_at` | timestamptz | |

*Note:* book creation is incidental here (first generation creates the stub);
no book-management UI exists in this slice.

### `content_versions`

The generated book content for a generation; grows incrementally during
streaming (FR-005) and is the read-back target for interrupted sessions (AC4).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `book_id` | uuid FK → books | |
| `tenant_id` | uuid FK → tenants | |
| `account_id` | uuid FK → accounts | |
| `version_num` | int default 1 | versioning seams for future slices |
| `content` | text | appended in place as chunks persist |
| `is_partial` | boolean | `true` while streaming, `false` once complete |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | updated per persistence tick |

Read-back guarantee: at any point, `content` for `is_partial = true` equals
what the UI displayed so far (AC4). Lighter-weight alternative considered and
kept as an option: one `content_versions` row per chunk with `is_partial`
aggregation — rejected for now because an appended `content` column matches
"retrievable and matches what was visible" with the fewest moving parts at
MVP scale.

---

## State transitions — a generation

```
eligible ──(admit: atomic credit++, lease acquired)──► running
running ──(stream done, is_partial=false, audit/complete)──► complete
running ──(model/provider auth or stream error)──► failed(provider)
                                                     • credit refunded (Q1)
                                                     • is_partial stays true; content preserved
running ──(connection drop / user stop; lease renews stop)──► stopped(connection)
                                                     • credit NOT refunded (Q1)
running ──(lease expires, no terminal event)──► free (lease considered stale) (Q2)
blocked: 4th attempt / inactive lease / signed-out → nothing admitted, no model call
```

Lease lifecycle mirrors `running`: renewed per chunk, terminal events release
it, otherwise it self-expires (Clarification Q2).

## Validation rules from requirements

- Signed-out generation → rejected at the boundary before any admission work
  (FR-001); no rows anywhere (AC1).
- `free_tier_count` increment and eligibility are one atomic statement; never
  exceeds limit, never negative, retries cannot bypass (FR-007, AC2).
- Device/IP limits: atomic count per (tenant, account, kind, window); an
  over-limit request is rejected before admission with no credit consumed and
  no content/invocation/terminal rows (FR-002).
- One in-flight lease per account; second request rejected, never queued
  (FR-009, AC6).
- One `capability_invocations` + one terminal `audit_log` row per generation,
  both `tenant_id`-scoped, same transaction as the content write (FR-006,
  AC5).
- Invalid/expired BYOK → clear error, credit refunded, no fallback, nothing
  billed to the customer (FR-008, SC-008 / AC7).
- Per-device/IP rate limits: enforced but values config-driven (Q4).