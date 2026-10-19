-- 0006 — Better Auth id columns get a database-side uuid default.
--
-- WHY: sign-up failed with
--   null value in column "id" of relation "user" violates not-null constraint
-- even after the columns were correctly cased (0005).
--
-- The cause is a contract between better-auth and the adapter, not a typo.
-- frontend/lib/auth/server.ts sets `advanced.database.generateId = "uuid"`, and
-- the Kysely adapter reports `supportsUUIDs: true` for Postgres
-- (@better-auth/kysely-adapter/dist/index.mjs). better-auth's id field factory
-- (@better-auth/core/dist/db/adapter/get-id-field.mjs) then computes
-- `shouldGenerateId = !supportsUUIDs` = false, so it attaches NO defaultValue
-- to `id` and deliberately omits the column from the INSERT — it assumes the
-- database generates the uuid itself.
--
-- better-auth's own migration generator encodes exactly that assumption for
-- Postgres (dist/db/get-migration.mjs):
--   col.primaryKey().defaultTo(sql`pg_catalog.gen_random_uuid()`).notNull()
--
-- Our tables had `id uuid PRIMARY KEY` with no default, so the omitted column
-- landed as NULL. This adds the default better-auth expects.
--
-- Idempotent: re-running re-applies the same default.

BEGIN;

ALTER TABLE "user"         ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid();
ALTER TABLE session        ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid();
ALTER TABLE account        ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid();
ALTER TABLE verification   ALTER COLUMN id SET DEFAULT pg_catalog.gen_random_uuid();

-- Backstop, and it makes the invariant explicit: these four tables' ids are
-- uuid PKs exactly like every other table in this schema (db/migrations/README
-- convention), so a stray hand-written INSERT cannot reintroduce the failure.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['user', 'session', 'account', 'verification'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute
            WHERE attrelid = t::regclass AND attname = 'id' AND atttypid = 'uuid'::regtype
        ) THEN
            RAISE EXCEPTION 'expected %."id" to be a uuid primary key', t;
        END IF;
    END LOOP;
END $$;

COMMIT;
