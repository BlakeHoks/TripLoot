#!/usr/bin/env bash
# Runs the RLS / database test-suite.
#
#   pnpm test:db
#       Spins up a throwaway local PostgreSQL (needs `initdb`/`pg_ctl`/`psql`
#       on PATH, e.g. `brew install postgresql@17`), applies a Supabase stub +
#       all migrations, runs supabase/tests/rls_test.sql and tears it down.
#
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db
#       Runs the tests against an existing database that already has the
#       migrations applied (e.g. `supabase start` local stack). Everything runs
#       inside a transaction that is rolled back.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TESTS="$ROOT/supabase/tests/rls_test.sql"

if [[ -n "${DATABASE_URL:-}" ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$TESTS" 2>&1 >/dev/null | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +/\1 /'
  exit 0
fi

TMP="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
cleanup() {
  pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

initdb -D "$TMP/data" -U postgres --auth=trust --locale=C -E UTF8 >/dev/null
pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses='' -c wal_level=logical" -l "$TMP/pg.log" -w start >/dev/null

PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/supabase/tests/_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "→ running $(basename "$TESTS")"
"${PSQL[@]}" -f "$TESTS" 2>&1 >/dev/null | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +/\1 /'
