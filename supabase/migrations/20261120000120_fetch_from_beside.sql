/*
 * What lies on a tile a worker cannot stand on is picked up from the tile beside it.
 *
 * Reported: "Hoardback will not pick up dirt on the settlement ground to bring to raw material bin named Dirt", and
 * before it "isn't picking up any of the dropped dirt on my deed". Dirt is dropped where its digger stands, and its
 * digger stands at the dig: ground dug steeper than a worker stands on (`max_stand`; a player with climbing stands on
 * steeper), or sunk under the water. A fetcher (and a composter) asked `creature_tile_ok` of the tile the item lay on
 * and passed over it, so nothing lying on dug ground was ever picked up, and the Hoardback said it had nothing to move.
 *
 * Now, as a feller works a tree (`beside_tile`): a tile with something lying on it that a worker cannot stand on is
 * worked from a tile beside it that it can (`worker_gatherable`, `worker_settle`). With nowhere beside it to stand
 * either, it is passed over as before.
 *
 * The browser's half: `Creatures.worksBeside` and `Creatures.gatherable` in `src/game/creatures.ts`.
 */
set local lock_timeout = '3s';

create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

-- Lying on its settlement, on a tile it stands on or beside one it stands on: fetch and compost alike.
select pg_temp.patch_fn('worker_gatherable(uuid, integer, integer, text, creature)',
  $o$return on_home_deed(p_world, c.keeper, p_x, p_y) and creature_tile_ok(p_world, p_x, p_y)$o$,
  $n$return on_home_deed(p_world, c.keeper, p_x, p_y)
       and (creature_tile_ok(p_world, p_x, p_y) or exists (select 1 from beside_tile(p_world, p_x, p_y)))$n$, 2);

-- And walked to the tile beside it when it cannot stand on it.
select pg_temp.patch_fn('worker_settle(uuid, integer)',
  $o$or (kind in ('mine', 'quarry') and not creature_tile_ok(p_world, spot.x, spot.y)) then$o$,
  $n$or (kind in ('mine', 'quarry', 'fetch', 'compost') and not creature_tile_ok(p_world, spot.x, spot.y)) then$n$);

select private.lock_doors();
