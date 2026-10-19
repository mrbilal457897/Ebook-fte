import { readFileSync } from "fs"
import { join } from "path"

import { describe, expect, it } from "vitest"

/*
 * Regression guard for the two schema defects that made every auth endpoint
 * fail (sign-up, sign-in, Google OAuth, get-session):
 *
 *  1. The `user`/`session`/`account`/`verification` tables had lowercased
 *     columns (`userid`, `createdat`). better-auth queries them with quoted
 *     camelCase, so every write failed with "Database schema mismatch" -> 500.
 *     Fixed by db/migrations/0005_better_auth_camelcase_columns.sql.
 *
 *  2. Their `id` columns had no default. With `advanced.database.generateId =
 *     "uuid"`, the Kysely adapter reports supportsUUIDs for Postgres, which
 *     makes better-auth omit `id` from the INSERT and rely on a database-side
 *     uuid default — so it arrived as NULL -> "violates not-null constraint".
 *     Fixed by db/migrations/0006_better_auth_id_uuid_default.sql.
 *
 * Both were invisible to the unit tests: they mock the pool. The real database
 * is the system of record here (AGENTS.md §8), so these checks read the
 * migration files that repair it. They fail if a future migration drops the
 * fix, or if a fresh database is built without ever running 0005/0006.
 */

const MIGRATIONS_DIR = join(process.cwd(), "..", "db", "migrations")
const MIGRATION_0002 = readFileSync(
  join(MIGRATIONS_DIR, "0002_better_auth.sql"),
  "utf8",
)
const MIGRATION_0005 = readFileSync(
  join(MIGRATIONS_DIR, "0005_better_auth_camelcase_columns.sql"),
  "utf8",
)
const MIGRATION_0006 = readFileSync(
  join(MIGRATIONS_DIR, "0006_better_auth_id_uuid_default.sql"),
  "utf8",
)

// The migrations align their array/column literals for readability, so compare
// against a whitespace-collapsed copy rather than the raw layout.
const squeezed = (sql: string) => sql.replace(/\s+/g, " ")

describe("Better Auth tables match what better-auth@1.7.5 sends", () => {
  it("0005 renames every lowercased column to better-auth's exact name", () => {
    // 0002 writes these unquoted (`createdAt`), which Postgres folds to lower
    // case — the original defect. 0005's renames are what put the real case in
    // the database, so each target name here is load-bearing.
    const renames = [
      ["user", "emailverified", "emailVerified"],
      ["user", "createdat", "createdAt"],
      ["user", "updatedat", "updatedAt"],
      ["session", "expiresat", "expiresAt"],
      ["session", "ipaddress", "ipAddress"],
      ["session", "useragent", "userAgent"],
      ["session", "userid", "userId"],
      ["account", "accountid", "accountId"],
      ["account", "providerid", "providerId"],
      ["account", "accesstoken", "accessToken"],
      ["account", "refreshtoken", "refreshToken"],
      ["account", "idtoken", "idToken"],
      ["account", "accesstokenexpiresat", "accessTokenExpiresAt"],
      ["account", "refreshtokenexpiresat", "refreshTokenExpiresAt"],
      ["verification", "expiresat", "expiresAt"],
      ["verification", "createdat", "createdAt"],
      ["verification", "updatedat", "updatedAt"],
    ] as const
    const flat = squeezed(MIGRATION_0005)
    for (const [table, lowered, camel] of renames) {
      expect(flat).toContain(`'${table}:${lowered}:${camel}'`)
    }
    // The quoted DDL after the rename keeps the FKs and indexes on the renamed
    // "userId", which is the only renamed column referenced outside the array.
    expect(MIGRATION_0005).toContain('FOREIGN KEY ("userId") REFERENCES "user"(id)')
    expect(MIGRATION_0005).toContain('CREATE INDEX IF NOT EXISTS session_user_id_idx ON session ("userId")')
    // Every OAuth callback resolves an account by this pair.
    expect(MIGRATION_0005).toContain(
      'ON account ("providerId", "accountId")',
    )
  })

  it("0002 cannot be trusted on its own — it never quotes an identifier", () => {
    // Documents why 0005 is mandatory for every database, including one built
    // fresh from the current 0002, rather than only for the drifted one.
    expect(MIGRATION_0002).toMatch(/\bcreatedAt\s+timestamptz/)
    expect(MIGRATION_0002).not.toContain('"createdAt"')
  })

  it("0005 is idempotent, so a fresh database built from 0002 can run it", () => {
    // A rename must fire only when its lowercased source actually exists: the
    // live database is already camelCase, and a database freshly built from the
    // current 0002 is too (0002 writes unquoted, which folds to lower case, and
    // 0005 is what repairs both). Re-running must be a no-op, never an error.
    expect(MIGRATION_0005).toMatch(/attname = lower\(old_name\)/)
    expect(MIGRATION_0005).toMatch(/IF EXISTS \(/)
    expect(MIGRATION_0005).toContain("BEGIN;")
    expect(MIGRATION_0005).toContain("COMMIT;")
  })

  it("0006 gives every auth table id a database-side uuid default", () => {
    // The exact default better-auth's own migration generator emits for
    // Postgres (dist/db/get-migration.mjs), scoped to all four tables.
    expect(MIGRATION_0006).toContain("pg_catalog.gen_random_uuid()")
    for (const table of ['"user"', "session", "account", "verification"]) {
      expect(MIGRATION_0006).toMatch(
        new RegExp(`ALTER TABLE ${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+ALTER COLUMN id SET DEFAULT`),
      )
    }
  })

  it("0002's id columns have no default, so 0006 is required, not cosmetic", () => {
    // Guards against someone "simplifying" by trusting 0002 as shipped.
    expect(MIGRATION_0002).toContain("id            uuid PRIMARY KEY")
    expect(MIGRATION_0002).not.toContain("gen_random_uuid")
    expect(MIGRATION_0002).not.toMatch(/id\s+uuid PRIMARY KEY DEFAULT/i)
  })
})
