-- 0005 — Better Auth table columns: normalise to better-auth's exact camelCase.
--
-- WHY: the live `user`/`session`/`account`/`verification` tables were created
-- with fully lowercased column names (`userid`, `createdat`, `expiresat`).
-- better-auth@1.7.5 issues its queries with quoted camelCase identifiers
-- (`"userId"`, `"createdAt"`, `"expiresAt"`), so every INSERT into those tables
-- failed with "Database schema mismatch" and every auth endpoint — sign-up,
-- sign-in, get-session, Google OAuth — returned HTTP 500.
--
-- 0002_better_auth.sql already declares the correct camelCase columns, but the
-- database recorded 0002 as applied from an earlier all-lowercase revision, so
-- apply.sh never re-ran it. Migrations are forward-only, so this reconciles the
-- live columns rather than editing the applied 0002.
--
-- PostgreSQL folds unquoted identifiers to lower case, which is exactly how the
-- wrong names got there. Every rename below is therefore quoted on both sides:
-- the quoted source matches what is physically in the table today, and the
-- quoted target preserves the mixed case better-auth sends.
--
-- IDEMPOTENT ON PURPOSE: on a database freshly built from the current 0002 the
-- columns are already camelCase, so every rename must be skipped rather than
-- fail. Each rename runs only when its lowercased source actually exists.

BEGIN;

DO $$
DECLARE
    -- One 'table:current_name:target_name' triple per column. A flat text[]
    -- keeps FOREACH valid (it cannot iterate a multi-dimensional array) and
    -- avoids depending on any particular unnest/row-type behaviour.
    renames text[] := ARRAY[
        'user:emailverified:emailVerified',
        'user:createdat:createdAt',
        'user:updatedat:updatedAt',
        'session:expiresat:expiresAt',
        'session:createdat:createdAt',
        'session:updatedat:updatedAt',
        'session:ipaddress:ipAddress',
        'session:useragent:userAgent',
        'session:userid:userId',
        'account:accountid:accountId',
        'account:providerid:providerId',
        'account:userid:userId',
        'account:accesstoken:accessToken',
        'account:refreshtoken:refreshToken',
        'account:idtoken:idToken',
        'account:accesstokenexpiresat:accessTokenExpiresAt',
        'account:refreshtokenexpiresat:refreshTokenExpiresAt',
        'account:createdat:createdAt',
        'account:updatedat:updatedAt',
        'verification:expiresat:expiresAt',
        'verification:createdat:createdAt',
        'verification:updatedat:updatedAt'
    ];
    r text;
    tbl text;
    old_name text;
    new_name text;
BEGIN
    FOREACH r IN ARRAY renames LOOP
        tbl := split_part(r, ':', 1);
        old_name := split_part(r, ':', 2);
        new_name := split_part(r, ':', 3);
        IF EXISTS (
            SELECT 1
            FROM pg_attribute
            WHERE attrelid = tbl::regclass
              AND attname = lower(old_name)
              AND attnum > 0
              AND NOT attisdropped
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I RENAME COLUMN %I TO %I',
                tbl, lower(old_name), new_name
            );
        END IF;
    END LOOP;
END $$;

-- The session/user FK and its lookup index followed the old column name; keep
-- both pointing at the renamed column. Dropped by constraint name first, since
-- the live database's auto-generated name was derived from the lowercase
-- column, then re-added against the correctly-cased one.
ALTER TABLE session DROP CONSTRAINT IF EXISTS session_userId_fkey;
ALTER TABLE session DROP CONSTRAINT IF EXISTS session_userid_fkey;
ALTER TABLE session
    ADD CONSTRAINT session_userId_fkey
    FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS session_user_id_idx;
CREATE INDEX IF NOT EXISTS session_user_id_idx ON session ("userId");

ALTER TABLE account DROP CONSTRAINT IF EXISTS account_userId_fkey;
ALTER TABLE account DROP CONSTRAINT IF EXISTS account_userid_fkey;
ALTER TABLE account
    ADD CONSTRAINT account_userId_fkey
    FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;

-- Better Auth looks accounts up by (providerId, accountId) on every OAuth
-- callback. The old all-lowercase revision shipped no such index.
CREATE INDEX IF NOT EXISTS account_provider_account_idx
    ON account ("providerId", "accountId");

COMMIT;
