#!/usr/bin/env bash
# Payment integration tests: the real Express API and Stripe webhook handler
# against Postgres 16 (every migration applied) behind PostgREST, both in
# throwaway Docker containers. Stripe events are signed locally with a test
# secret, so no Stripe or Supabase account is ever contacted.
#
#   scripts/test-integration.sh
set -euo pipefail
cd "$(dirname "$0")/.."

NET="iman-it-$$"
DB="$NET-db"
REST="$NET-rest"
JWT_SECRET="$(openssl rand -hex 32)"
cleanup() {
  docker rm -f "$DB" "$REST" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$NET" >/dev/null
docker run -d --name "$DB" --network "$NET" -e POSTGRES_PASSWORD=postgres "${TEST_PG_IMAGE:-postgres:16-alpine}" >/dev/null
until docker exec "$DB" pg_isready -U postgres -q 2>/dev/null; do sleep 1; done
sleep 1

PSQL=(docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login password 'authenticator' noinherit;
grant anon, authenticated, service_role to authenticator;
SQL
sed '/^create role /d' supabase/tests/supabase_stub.sql | "${PSQL[@]}" -f - >/dev/null
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -1 -f - < "$f" >/dev/null || { echo "Migration failed: $f" >&2; exit 1; }
done
"${PSQL[@]}" -f - < tests/integration/seed.sql >/dev/null

docker run -d --name "$REST" --network "$NET" -p 127.0.0.1::3000 \
  -e PGRST_DB_URI="postgres://authenticator:authenticator@$DB:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" \
  "${TEST_POSTGREST_IMAGE:-public.ecr.aws/supabase/postgrest:v16.4}" >/dev/null
REST_PORT="$(docker port "$REST" 3000/tcp | head -1 | sed 's/.*://')"
for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$REST_PORT/" >/dev/null && break; sleep 1; done

IT_REST_URL="http://127.0.0.1:$REST_PORT" IT_JWT_SECRET="$JWT_SECRET" \
  npx vitest run --config vitest.integration.config.ts
