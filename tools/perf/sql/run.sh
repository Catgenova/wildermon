#!/bin/bash
# run.sh name <fill.sh args>: fills the settlement and prints one JSON line of what the near read, its delta, the beat and the clock cost.
HERE="$(cd "$(dirname "$0")" && pwd)"
name=$1; shift
"$HERE/fill.sh" "$@" > /dev/null || exit 1
out=$(psql -X -q -f "$HERE/measure.sql" 2>&1 | grep '^{' | tail -1)
echo "{\"name\":\"$name\",\"args\":\"$*\",\"m\":$out}"
