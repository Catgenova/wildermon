#!/bin/bash
# The test island, up and current: a local Postgres 16 on port 5433 (socket
# /var/run/postgresql, superuser wurm) holding ci_t, the database the suite
# leaves behind (supabase/test/run.sh), that tests are run against as
#   PGHOST=/var/run/postgresql PGPORT=5433 PGUSER=wurm PGDATABASE=ci_t
#
# It has been found down at the start of a session with a postmaster.pid left
# by a container that went away; that lock is cleared only when no process
# holds it. ci_t is built from the migrations when it is missing, and any
# migration newer than it has seen is applied to it, in order, and noted in
# local_meta.applied. Idempotent: run it at the start of a session, or
# whenever a test cannot reach the database.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d node_modules ] || npm install --no-audit --no-fund >/dev/null

BIN=/usr/lib/postgresql/16/bin
ROOT=/var/lib/postgresql/wurmtest
DATA=$ROOT/data
SOCK=/var/run/postgresql
PORT=5433
if [ ! -x "$BIN/pg_ctl" ]; then
  echo "test-island: no Postgres 16 here; database tests will not run." >&2
  exit 0
fi

mkdir -p "$SOCK" && chown postgres:postgres "$SOCK"
if [ ! -f "$DATA/PG_VERSION" ]; then
  mkdir -p "$ROOT" && chown postgres:postgres "$ROOT"
  su postgres -c "$BIN/initdb -D $DATA -A trust -U wurm" >/dev/null
fi
if ! "$BIN/pg_isready" -q -h "$SOCK" -p "$PORT"; then
  pid=$(head -1 "$DATA/postmaster.pid" 2>/dev/null || true)
  if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then rm -f "$DATA/postmaster.pid"; fi
  su postgres -c "$BIN/pg_ctl -D $DATA -l $ROOT/log -o '-p $PORT -k $SOCK' -w start" >/dev/null
fi

export PGHOST=$SOCK PGPORT=$PORT PGUSER=wurm
PSQL="psql -v ON_ERROR_STOP=1 -X -q -At"
has() { [ -n "$($PSQL -d "$1" -c "$2")" ]; }
mark_all() {
  $PSQL -d ci_t -c "create schema if not exists local_meta; create table if not exists local_meta.applied (name text primary key);" >/dev/null
  for m in supabase/migrations/*.sql; do
    $PSQL -d ci_t -c "insert into local_meta.applied values ('$(basename "$m")') on conflict do nothing" >/dev/null
  done
}

if ! has postgres "select 1 from pg_database where datname = 'ci_t'"; then
  echo "test-island: building ci_t from the migrations (a few minutes)…" >&2
  $PSQL -d postgres -c "create database ci_t" >/dev/null
  PGDATABASE=ci_t bash supabase/test/run.sh >/dev/null
  mark_all
elif ! has ci_t "select 1 from information_schema.tables where table_schema = 'local_meta' and table_name = 'applied'"; then
  # A ci_t from before this script, kept up to date by hand: taken as current.
  mark_all
else
  for m in supabase/migrations/*.sql; do
    n=$(basename "$m")
    has ci_t "select 1 from local_meta.applied where name = '$n'" && continue
    if $PSQL -d ci_t -f "$m" >/dev/null 2>&1; then
      $PSQL -d ci_t -c "insert into local_meta.applied values ('$n')" >/dev/null
      echo "test-island: applied $n" >&2
    else
      echo "test-island: $n will not apply to ci_t; drop it (dropdb -h $SOCK -p $PORT -U wurm ci_t) and run this again to rebuild" >&2
      exit 1
    fi
  done
fi
echo "test-island: up, ci_t on port $PORT." >&2
