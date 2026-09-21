#!/usr/bin/env bash
# Apply unapplied SQL migrations in this directory to $DATABASE_URL.
# Idempotent: applied versions are tracked in the schema_migrations table.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${DATABASE_URL:?DATABASE_URL is required (e.g. postgres://user:pass@localhost:5432/ebookfte)}"

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql (PostgreSQL client) is required" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (
     version text PRIMARY KEY,
     applied_at timestamptz NOT NULL DEFAULT now()
   );" >/dev/null

applied="$(psql -At "$DATABASE_URL" -c 'SELECT version FROM schema_migrations ORDER BY version;')"

for f in "$SCRIPT_DIR"/*.sql; do
  [ -e "$f" ] || continue
  version="$(basename "$f")"
  if printf '%s\n' "$applied" | grep -qx "$version"; then
    echo "skip (already applied): $version"
    continue
  fi
  echo "applying: $version"
  psql -v ON_ERROR_STOP=1 -f "$f" "$DATABASE_URL" >/dev/null
  psql -v ON_ERROR_STOP=1 "$DATABASE_URL" \
    -c "INSERT INTO schema_migrations (version) VALUES ('$version');" >/dev/null
done

echo "migrations up to date"