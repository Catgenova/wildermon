-- A step, an action or a heartbeat writes the player's row without touching an index.
--
-- Asked for: storage settings for the hot tables. An update that changes no indexed column, and finds room on the
-- row's own page, is a HOT update: no index is written and the old version is pruned off the page by the next reader,
-- with no vacuum. On an island built like the live one (supabase/test/bench-stir.ts) none of `player`'s updates were
-- HOT: `rpc_move`, `rpc_act`, `rpc_settle`, `rpc_cancel`, `rpc_hold` and the rest all set `seen_at`, and
-- `player_afoot` indexed it (`(world_id, seen_at) where not away`), so every step anybody took wrote a new entry into
-- all four of `player`'s indexes and left a dead row behind for vacuum.
--
-- What reads `player_afoot` asks for the people awake on an island (`world_id`, `not away`) and then those of them
-- seen lately: a handful of rows. `player_awake`, on `(world_id) where not away`, finds the same rows for every one
-- of those reads (the clock's, the sweeps', `log_out_idle`, `afoot`, `folk_seen`), with `seen_at` tested on them, and
-- nothing else indexes `seen_at`. Measured on that island with the clock's own write each round: `player` 0% HOT
-- before, 84% to 100% after (the rest a page that had no room yet), and 9 to 15 fewer B-tree inserts a round.
--
-- Looked at and left: `creature` (already `fillfactor` 85; at 70 and written out again its HOT share was the same,
-- 85% and 84%, since what is not HOT there is a move of `to_x`/`to_y`, which `creature_at` indexes), `item`
-- (95-100% HOT), `world` (100%), `tick_time` (an insert a round and an hour's rows cleared, which autovacuum keeps up
-- with). No index on them is a duplicate of another, and none is dropped.

set local lock_timeout = '3s';

create index if not exists player_awake on public.player (world_id) where not away;
drop index if exists public.player_afoot;
analyze public.player;

select private.lock_doors();
