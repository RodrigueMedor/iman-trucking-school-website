#!/usr/bin/env bash
# Runs the portal RLS/RPC assertions (supabase/tests/portal_rls.sql) against a
# database rebuilt from every migration. Never points at a hosted project.
#
#   scripts/test-db.sh            # Supabase local stack (Docker + `npx supabase start`)
#   scripts/test-db.sh --pg       # throwaway local Postgres cluster + auth/storage stubs
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" != "--pg" ]]; then
  LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
  case "$LOCAL_DB_URL" in
    *127.0.0.1*|*localhost*) ;;
    *) echo "Refusing to run against a non-local database: $LOCAL_DB_URL" >&2; exit 1 ;;
  esac
  npx supabase db reset --local
  psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/portal_rls.sql
  exit 0
fi

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb || echo /opt/homebrew/opt/postgresql@14/bin/initdb)")}"
PORT="${TEST_PG_PORT:-54399}"
DATA_DIR="$(mktemp -d)"
cleanup() { "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA_DIR"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$DATA_DIR" -A trust -U postgres >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA_DIR" -o "-p $PORT -k $DATA_DIR -c listen_addresses=''" -l "$DATA_DIR/log" -w start >/dev/null

export PGOPTIONS="-c client_min_messages=warning"
PSQL=("$PG_BIN/psql" -h "$DATA_DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f - <<'SQL'
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
SQL
sed '/^create role /d' supabase/tests/supabase_stub.sql | "${PSQL[@]}" -f -
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -1 -f "$f" >/dev/null || { echo "Migration failed: $f" >&2; exit 1; }
done
"${PSQL[@]}" -f supabase/tests/portal_rls.sql
