-- Dev seed: one subscribing company (tenant) for sign-up-linkage testing
-- (specs/001-free-tier-content-generation/quickstart.md "Prerequisites").
--
-- This is DATA, not schema — it intentionally does NOT go through
-- apply.sh (schema_migrations tracks forward-only schema only). Apply with:
--
--   psql -v ON_ERROR_STOP=1 -f db/seeds/seeds.sql "$DATABASE_URL"
--
-- Idempotent: re-running never duplicates the tenant (ON CONFLICT on slug).

BEGIN;

INSERT INTO tenants (id, name, slug)
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    'Example Press',
    'example-press'
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;