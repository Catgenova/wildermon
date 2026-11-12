#!/bin/bash
# fill.sh houses storeys pieces things crates cthings lying workers followers stored: Solara at 128,128 filled (settlement.sql).
# Runs against the Postgres in PGHOST/PGPORT/PGUSER/PGDATABASE, built from the migrations with world.sql run once.
HERE="$(cd "$(dirname "$0")" && pwd)"
PGOPTIONS="-c perf.houses=$1 -c perf.storeys=$2 -c perf.pieces=$3 -c perf.things=$4 -c perf.crates=$5 -c perf.cthings=$6 -c perf.lying=$7 -c perf.workers=$8 -c perf.followers=$9 -c perf.stored=${10}" \
  psql -X -q -f "$HERE/settlement.sql"
