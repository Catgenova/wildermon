---
name: live-run-failure
description: Diagnose and fix a failed live Island run (island.yml dispatched with live true) in Wurm, then dispatch again. Use when a live run fails, a scheduled check-in finds one red, or the user reports the deploy failed.
---

# A failed live run

## Find what failed
1. **List the jobs:** `mcp__github__actions_list` with `list_workflow_jobs` on the run.
   - The result is large and gets saved to a file.
   - Read it with jq: `.jobs.jobs[] | select(.conclusion=="failure") | .id, .name, [.steps[] | select(.conclusion=="failure") | .name]`.
2. **Read each failed job's log:** `mcp__github__get_job_logs` with `job_id` and `return_content: true`, `tail_lines: 2500`.
   - This is also saved to a file.
   - Extract `.logs_content`, then `grep -n "FAIL\|##\[error\]"` and read about 40 lines above each hit.
3. **Shard failures (the rules against a Postgres of our own, k of 6):** these are tests in `supabase/test/`. The step name says which test; the CI step holds its `esbuild …` line.

## Common causes seen before
- **A new rpc or table not in `supabase/test/permissions.allow.ts`.**
- **"No function open to a player but the doors":** generated defs arrived after the doors were last locked. Add a migration with `select private.lock_doors();`.
- **A timed action with no sound:** add it to `src/audio/sound.ts`.
- **A test pinned to the wall clock:** for example `yields.ts` needed a bush in season, and bushes fruit only in spring and summer. Make the test hold in every season; don't patch around today's date.
- **Random spawn stats** (`rarity` or `form_size` through `beast_mul`) made a range test flaky. Pin them in the test.
- **A migration that sorts before one already applied live.** Rename it to sort after the last applied one.

## Fix and prove it
- Run `scripts/test-island.sh` to bring the local test DB up and apply new migrations to ci_t.
- Reproduce the failing test locally against ci_t, fix it, and show it passing.
- Re-run any neighbouring tests the fix could touch.
- `npm run build` must exit 0; check `$?`.
- Commit, rebase or merge over any CI "Rebuild site" commit (for generated-file conflicts: `--ours`, rebuild, `node scripts/sri.mjs --check`), then push to `main`.
- Dispatch `island.yml` again (`live: true, found: false, reconcile: off`) once no live run is going.
- Schedule a check-in about 40 minutes out. A run takes 30–50 minutes.

Never skip, disable or quarantine a test to get green.
