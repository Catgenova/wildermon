#!/bin/bash
# Cloud sessions only: bring the test island up before the session starts (scripts/test-island.sh).
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
bash "$CLAUDE_PROJECT_DIR/scripts/test-island.sh"
