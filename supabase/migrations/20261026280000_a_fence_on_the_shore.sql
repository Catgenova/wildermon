/*
 * A fence on a shore or a waterway's edge.
 *
 * Reported: on a cobblestone path 0.1 m above the water, beside a waterway,
 * "Plan fence (west)" was refused "Not in water." -- "it is greyed out even
 * though the border is above water". `build_refusal` refused a fence, a gate or
 * a half wall standing alone whenever either tile beside the border had any
 * water on it (`has_water`: one corner below the sea, or a pond on it), so no
 * fence could stand on any shore, and a waterside tile wet by one low corner
 * of its own refused all four of its borders.
 *
 * Now the border is asked, not the tiles: refused 'Not in water.' only where a
 * corner of the border itself is under the water -- below the sea's nothing,
 * or below a pond or pool on either tile beside it (`fence_border_wet`, the
 * browser's `fenceBorderWet`). 'No room for posts.' asks the dry side: a tile
 * with no water on it must be walkable ground, the wet side need not be, and
 * one of the two must be. Everything else as it was. `build_wall` never asked
 * the water, so a fence planned is a fence that can be built.
 */
set local lock_timeout = '3s';

/** Whether a corner of a tile's border is under the water: the sea's nothing, or a pond or pool on either tile beside it. */
create or replace function fence_border_wet(p_world uuid, p_x int, p_y int, p_side text) returns boolean
  language sql stable as $fn$
  select coalesce(least(land_height(p_world, case p_side when 'e' then p_x + 1 else p_x end,
                                             case p_side when 's' then p_y + 1 else p_y end),
                        land_height(p_world, case p_side when 'w' then p_x else p_x + 1 end,
                                             case p_side when 'n' then p_y else p_y + 1 end))
                  < greatest(water_surface(p_world, p_x, p_y), water_surface(p_world, o.x, o.y)), true)
    from across(p_x, p_y, p_side) o
$fn$;

-- ---------------------------------------------------------------- the patches, each exactly once
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'build_refusal(uuid,uuid,text,jsonb)'::regprocedure, 1,
     $$    if has_water(p_world, tx, ty) or has_water(p_world, other.x, other.y) then return 'Not in water.'; end if;
    if not passable(p_world, tx, ty) or not passable(p_world, other.x, other.y) then return 'No room for posts.'; end if;
$$,
     $$    -- A shore or a waterway's edge takes one: refused only where a corner of the border itself is under the water.
    if fence_border_wet(p_world, tx, ty, side) then return 'Not in water.'; end if;
    -- Posts on the dry side; the wet side need not be walkable, but one of the two must.
    if (not passable(p_world, tx, ty) and not has_water(p_world, tx, ty))
       or (not passable(p_world, other.x, other.y) and not has_water(p_world, other.x, other.y))
       or (not passable(p_world, tx, ty) and not passable(p_world, other.x, other.y)) then
      return 'No room for posts.';
    end if;
$$)
  ) as t(ord, fn, times, old, new) order by ord loop
    v_def := pg_get_functiondef(r.fn);
    continue when position(r.new in v_def) > 0;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.times then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.times; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
