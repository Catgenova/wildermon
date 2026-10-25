/*
 * A poured slab is floor, whatever water stands round it.
 *
 * Reported: "it would appear the water takes precedence and i swim through
 * the foundation while on foot." A slab poured in a pond or the sea has its
 * top above the water, but `in_deep_water` measured down from the water to
 * the ground under the slab, so a body standing on it was swimming: slowed,
 * spending wind, and drowning in time. A finished slab with no pool dug in it
 * holds you up as a deck on piers does (`Game.dryTop`, `Game.onFloor`).
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_n int;
begin
  v_def := pg_get_functiondef('in_deep_water'::regproc);
  v_old := $$    -- Piers: on the finished deck of a tile on piers, whatever is under it (`deck_surface`).$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'in_deep_water has % of its piers line, not 1', v_n; end if;
  execute replace(v_def, v_old, $$    -- A finished slab with no pool in it: its top is dry floor (`dryTop`).
    when exists (select 1 from foundation fo where fo.world_id = p_world and fo.x = floor(p.x)::int and fo.y = floor(p.y)::int
                   and not fo.pool and bill_done(fo.needed)) then false
$$ || v_old);
end $do$;

select private.lock_doors();
