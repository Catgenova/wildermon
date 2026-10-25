/*
 * Packed dirt is not raised by Change tile.
 *
 * Reported: "can't flatten a tile of packed dirt ... you can still change the
 * level of packed dirt with 'Change tile'". Flatten and Dig leave packed
 * ground alone (it has no soil to give, `tile_def.dig_yield`); dropping a
 * spadeful on it raised it all the same. Now both Change tiles say so, in the
 * browser's words: cultivate it first.
 */
set local lock_timeout = '3s';

do $do$
declare v_def text; v_old text; v_n int;
begin
  -- On a corner of the tile pointed at.
  v_def := pg_get_functiondef('ground_refusal'::regproc);
  v_old := $$    return coalesce(level_stop(p_world, p_uid, cx, cy, 1),$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'ground_refusal has % of its drop_dirt level stop, not 1', v_n; end if;
  execute replace(v_def, v_old,
    $$    if here = 2 then return t.name || ': cultivate first.'; end if;
$$ || v_old);

  -- And on the corner nearest whoever is standing on it.
  v_def := pg_get_functiondef('terrain_refusal'::regproc);
  v_old := $$    return slope_refusal(p_world, p_uid, 'digging', cx, cy, 1);$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'terrain_refusal has % of its drop_dirt_here slope, not 1', v_n; end if;
  execute replace(v_def, v_old,
    $$    if land_tile(p_world, (select floor(x)::int from player where world_id = p_world and uid = p_uid),
                   (select floor(y)::int from player where world_id = p_world and uid = p_uid)) = 2 then
      return (select name from tile_def where id = 2) || ': cultivate first.';
    end if;
$$ || v_old);
end $do$;

select private.lock_doors();
