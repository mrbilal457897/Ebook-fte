# DB Migrations

The single Postgres + pgvector database for this project (Constitution Article
V; AGENTS.md §8). This directory holds the schema for the tables this slice
touches (plan.md project structure).

## Mechanism

- One file per migration, **plain SQL**, forward-only, named with a zero-padded
  numeric prefix that doubles as the version:

  ```
  0001_create_initial_schema.sql
  0002_add_thing.sql
  ```

- **Apply:** `db/migrations/apply.sh` — idempotent. Reads `DATABASE_URL`,
  ensures the `schema_migrations` tracking table exists (created automatically,
  holds no tenant data, so it carries no `tenant_id`), then applies each `*.sql`
  file in lexicographic order that is not already recorded, recording the
  filename as the version when each succeeds. Safe to run repeatedly.

- **Authentication:** rely on psql's client auth against `DATABASE_URL`
  (defaults to the OS user / `.pgpass` on the host running it).

- **Down migrations / rollback:** forward-only for MVP. A mistake is fixed with
  a new forward migration, not by editing an applied one. A destructive manual
  rollback is documented here under "Manual rollback" only when it is ever
  needed.

## Convention (resolved at authoring time — T006)

data-model.md defers two choices to the moment the first real migration is
authored (T006), and T001 must not foreclose them:

1. **Plain SQL vs. Alembic.** **Settled: plain SQL (T006).** The `apply.sh`
   mechanism and `schema_migrations` tracking already exist and are
   idempotent; adopting Alembic would discard a working, tested mechanism with
   no countervailing benefit at this scale. Future migrations are forward-only
   `NNNN_name.sql` files applied in lexicographic order.
2. **`uuid` vs. `bigint` ids.** **Settled: `uuid`** (data-model.md default),
   generated via `gen_random_uuid()` (built-in on PostgreSQL ≥13; no pgcrypto
   extension required). All primary keys in `0001_create_slice_001_schema.sql`
   are uuid.

## Schema conventions this slice must follow (summary of data-model.md)

- Every table holding tenant data carries `tenant_id`.
- `tenant_id` is always derived from the authenticated session at the boundary,
  never from model output or client text (Article IV.5).
- `created_at` / `updated_at` (timestamptz) on every table.
- Tables in this slice: `tenants`, `accounts`, `books`, `content_versions`,
  `conversations`, `run_states`, `capability_invocations`, `audit_log`,
  `model_credentials`, `rate_limit_counts` (the one table beyond AGENTS.md §8,
  sanctioned by data-model.md for FR-002).

## Usage

```sh
export DATABASE_URL='postgres://user:pass@localhost:5432/ebookfte'
bash db/migrations/apply.sh
```

## Dev seed

`db/seeds/seeds.sql` inserts one tenant (slug `example-press`) for
sign-up-linkage testing (quickstart prerequisite). It is **data**, not schema,
so it is not tracked by `schema_migrations`; apply it explicitly:

```sh
psql -v ON_ERROR_STOP=1 -f db/seeds/seeds.sql "$DATABASE_URL"
```

Re-running is safe (idempotent `INSERT … ON CONFLICT (slug) DO NOTHING`).