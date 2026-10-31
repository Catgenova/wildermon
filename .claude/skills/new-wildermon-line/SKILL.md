---
name: new-wildermon-line
description: Add or replace a wildermon line (three evolution stages, a settlement trade) in Wurm, on both the island (Postgres) and the browser, with models, voice, tests, help and What's new. Use when asked for a new wildermon line, a replacement line for an existing kind, or a new worker trade.
---

# A new wildermon line

The island and the browser must agree: every rule lives on both sides, and tests compare them.

## Read first: the closest earlier line
- **Station crafting from settlement stores** (spinner, nailer, ribboner): commit `2e91023e`, migration `20261026200000_a_spinner_a_nailer_a_ribboner_and_no_tools.sql`.
- **Glass at a smelter:** commit `081a5983`, migration `20261031040000_a_glimmip_makes_glass.sql`.
- **A whole line with models, voices and animation** (Briarling, Kilnlet, Logkit, Reedling, Springlet): commit `dcded520`.

## Browser: `src/game/creatures.ts`
- **The trade:** a new `GatherKind`, with an entry in every table keyed by it: `GATHER_SKILL`, `GATHER_VERB`, `GATHER_DO`, `GATHER_TABLE`, and the learn-rate factor table near line 1142.
- **The species:** `SPECIES` (stages, diet, wild placement, butcher, variants).
- **The worker's steps:** `gatherable` and the matching `finish…`.
- **Words:** idle words in `workerlog.ts`, help in `src/ui/panels/help.ts`, and What's new in `src/ui/panels/news.ts` (use the next free `n`, and check unmerged branches for numbers already taken).
- **Sound:** every timed action needs an entry in `src/audio/sound.ts` (`heard.ts` checks it).

## Island: a NEW migration
- Its name must sort after every migration already applied live.
- Patch functions with the replace-exactly-once block used by earlier migrations (`pg_get_functiondef` + `replace`, raising unless the old text occurs exactly once): `tend_job`, `hands_trade`, `tend_recipes`, `errand_step` / `errand_do`, `worker_gatherable` / `worker_do`.
- End with `select private.lock_doors();`.
- If defs change, run `npm run defs`. It writes a `*_defs.sql` and `supabase/defs-state.sql`; a defs migration does not lock the doors, so a later one must.
- Add any new rpc or table readable by `authenticated` to `supabase/test/permissions.allow.ts`.

## Look and voice
- Models: `src/render/wild-<kind>.ts`, one model per stage (idle, walk, work act, evolve), registered in `src/render/wildermon.ts`.
- Voice: `src/audio/voice-<kind>.ts`, registered in `src/audio/voices.ts`.
- Render each stage to PNGs and rate it against the user's reference sheet, including at game zoom next to an existing line.
- Iterate to at least 9/10, then send the PNGs.
- **Never ship visuals until the user says "ship it".** Build the line in a worktree branch and merge it only after approval.

## Tests (local DB: run `scripts/test-island.sh` first)
- Write a new test for the trade on both sides, in the style of `supabase/test/glassblower.ts`, and add a CI step to `.github/workflows/island.yml` in the right shard.
- Update every test that lists trades or species: `learnrate.ts`, `madelog.ts`, the hands tests, `magsort`, the wild-table tests and `permissions`.
- Run each with `npx esbuild supabase/test/X.ts --bundle --platform=node --format=esm --packages=external --outfile=node_modules/.cache/X.mjs && PGHOST=/var/run/postgresql PGPORT=5433 PGUSER=wurm PGDATABASE=ci_t node node_modules/.cache/X.mjs`.
- `npm run build` must exit 0. Check `$?`; don't grep the output.

## Ship
- Merge into `main`. For conflicts in generated files (`index.html`, `account.html`, `assets/*`, `wildermon.html`): `git checkout --ours`, then `npm run build` and `node scripts/sri.mjs --check`.
- Push, then dispatch `island.yml` with `live: true, found: false, reconcile: off`, never while another live run is going.
