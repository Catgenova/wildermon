-- Drop dirt at a corner of rock, an ore or a seam, allowed again.
--
-- Asked: "Dirt should be able to be dropped on rock/seam/vein and it will create a toplayer again as normal. That dirt
-- tile could then be Change Tile-d." 20261104120000 refused Drop dirt at any corner of a Rock tile ("Rock at this
-- corner.", `corner_rock`), because the reconcile after it turns a Rock tile with soil on a corner to Dirt. Change
-- tile no longer raises anything, so that is now only what Drop dirt is for: a top layer of soil over the rock, the
-- tile Dirt, and Change tile offered on it as on any dirt. The rock under it is kept (`land_rock`): its soil dug off,
-- `reconcile` lays the rock, ore or seam again.
--
-- `drop_dirt` (`ground_refusal`) and `drop_dirt_here` (`terrain_refusal`) without `corner_rock`, and `corner_rock`
-- gone. The browser's `drop_dirt` and `drop_dirt_here` (`src/game/actions.ts`) the same.

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

select pg_temp.patch_fn('public.ground_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    -- Not at a corner of rock, ore or a seam, which the reconcile after it would bury (`corner_rock`).
    return coalesce(corner_rock(p_world, cx, cy),
                    level_stop(p_world, p_uid, cx, cy, 1),
$o$,
  $n$    -- At a corner of rock, an ore or a seam too: the soil makes it dirt (`reconcile`), dug bare it is that rock again.
    return coalesce(level_stop(p_world, p_uid, cx, cy, 1),
$n$);

select pg_temp.patch_fn('public.terrain_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    return coalesce(corner_rock(p_world, cx, cy), slope_refusal(p_world, p_uid, 'digging', cx, cy, 1));$o$,
  $n$    return slope_refusal(p_world, p_uid, 'digging', cx, cy, 1);$n$);

drop function if exists public.corner_rock(uuid, integer, integer);

select private.lock_doors();
