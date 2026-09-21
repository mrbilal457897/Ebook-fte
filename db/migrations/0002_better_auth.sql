-- Better Auth core tables (user, session, account, verification) for the
-- ratified auth vendor (research.md §1; frontend/lib/auth seam).
--
-- Column names/types match better-auth@1.7.5 defaults (verified against the
-- pinned package's own schema via getAuthTablesWithResolvedIndexes):
--   user:        id uuid PK, name, email UNIQUE, emailVerified, image, createdAt, updatedAt
--   session:     id uuid PK, expiresAt, token UNIQUE, createdAt, updatedAt,
--                ipAddress, userAgent, userId → user.id (cascade delete)
--   account:     id uuid PK, accountId, providerId, userId → user.id (cascade),
--                accessToken, refreshToken, idToken, accessTokenExpiresAt,
--                refreshTokenExpiresAt, scope, password, createdAt, updatedAt
--                (v1.7.5 defines NO unique constraint on account — that
--                issuer+accountId uniqueness only exists in v1.8.)
--   verification: id uuid PK, identifier, value, expiresAt, createdAt, updatedAt
--
-- uuid PKs per the repo convention; the seam sets
-- advanced.database.generateId = "uuid" so Better Auth emits uuidv4 ids.
-- "user" is quoted everywhere (reserved word in Postgres).

BEGIN;

CREATE TABLE IF NOT EXISTS "user" (
    id            uuid PRIMARY KEY,
    name          text NOT NULL,
    email         text NOT NULL UNIQUE,
    emailVerified boolean NOT NULL DEFAULT false,
    image         text,
    createdAt     timestamptz NOT NULL DEFAULT now(),
    updatedAt     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
    id         uuid PRIMARY KEY,
    expiresAt  timestamptz NOT NULL,
    token      text NOT NULL UNIQUE,
    createdAt  timestamptz NOT NULL DEFAULT now(),
    updatedAt  timestamptz NOT NULL DEFAULT now(),
    ipAddress  text,
    userAgent  text,
    userId     uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
    id                    uuid PRIMARY KEY,
    accountId             text NOT NULL,
    providerId            text NOT NULL,
    userId                uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    accessToken           text,
    refreshToken          text,
    idToken               text,
    accessTokenExpiresAt  timestamptz,
    refreshTokenExpiresAt timestamptz,
    scope                 text,
    password              text,
    createdAt             timestamptz NOT NULL DEFAULT now(),
    updatedAt             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification (
    id         uuid PRIMARY KEY,
    identifier text NOT NULL,
    value      text NOT NULL,
    expiresAt  timestamptz NOT NULL,
    createdAt  timestamptz NOT NULL DEFAULT now(),
    updatedAt  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_user_id_idx ON session (userId);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON account (userId);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification (identifier);

COMMIT;