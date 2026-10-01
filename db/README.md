# Database

The single Postgres + pgvector system of record for the project (AGENTS.md §8).
Business records, the reference library, live state, and the audit trail all
live here. No AI action that matters exists only in a chat transcript.

**Slices:** 001 (`migrations/0001`, `0002`), 002 (`migrations/0003`). Specs:
`specs/001-free-tier-content-generation/data-model.md`,
`specs/002-ebook-data-mcp/data-model.md`.

## Layout

- **`migrations/`** — plain forward-only SQL, applied by `apply.sh` (idempotent,
  tracked in a `schema_migrations` table). Read `migrations/README.md` for the
  mechanism and the conventions every migration must follow.
- **`seeds/seeds.sql`** — one dev tenant (slug `example-press`) for sign-up
  linkage testing. Data, not schema, so not tracked as a migration.

## Apply

```sh
export DATABASE_URL='postgres://user:pass@localhost:5432/ebookfte'
bash db/migrations/apply.sh
psql -v ON_ERROR_STOP=1 -f db/seeds/seeds.sql "$DATABASE_URL"
```

## Tables today (17)

| Migration | Tables |
|---|---|
| `0001_create_slice_001_schema.sql` | `tenants`, `accounts`, `books`, `content_versions`, `conversations`, `run_states`, `capability_invocations`, `audit_log`, `model_credentials`, `rate_limit_counts` |
| `0002_better_auth.sql` | `user`, `session`, `account`, `verification` (Better Auth's own; no `tenant_id`) |
| `0003_ebook_data_mcp_tables.sql` | `cover_assets`, `formatting_jobs`, `publishing_records` |

Every table holding tenant data carries `tenant_id`, and every id is a `uuid`.
`0002`'s four tables are the one exception: they are Better Auth's internal
session store, hold no tenant data, and link to `accounts` through
`auth_subject`.

## Not yet migrated

These are in AGENTS.md §8 but do not exist yet — each needs its own spec:

- `documents` + `embeddings` — the reference library, with pgvector semantic
  search. Blocks the Support/Onboarding Agent's `search_help_library`.
- `ad_accounts` + `ad_campaigns` — connected ad-platform OAuth tokens and
  campaign spend. Blocks the Marketing/Ads Agent.
- `subscriptions` + `invoices` — Lago-backed billing records. `LAGO_API_URL` and
  `LAGO_API_KEY` are already in `.env.example`; the tables and the checkout flow
  are not.
- `narrations` — audiobook output. Not in AGENTS.md §8's list yet; the Voice
  Agent needs it.
