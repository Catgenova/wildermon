/*
 * Every lane of a bridge, where only its line was asked about.
 *
 * A stone's ground taken back takes a bridge with any lane's end or deck on
 * it (`runestone_clear`); a laden cart on any lane of a bridge you built
 * counts for the journal (`journal_move`); no lane's deck wears the ground
 * under it (`wear_walk`, as the browser's `wearStep` asks `bridgeAt`); and
 * setting one out is asked about every lane's tiles on a stone's ground
 * (`stone_job_tiles`, the browser's `Game.planTiles`).
 */
set local lock_timeout = '3s';

/* Every tile of a bridge, every lane's: its ends (`n` null) and its deck (`deckTiles`, `endTiles`). */
create or replace function bridge_tiles(b bridge)
returns table (x int, y int, o int, n int) language sql stable as $fn$
  select e.x + l.o * p.px, e.y + l.o * p.py, l.o, e.n
    from bridge_lanes(b.width, b.side) l
   cross join (select case when b.ay = b.by and b.ax <> b.bx then 0 else 1 end as px,
                      case when b.ay = b.by and b.ax <> b.bx then 1 else 0 end as py) p
   cross join lateral (select b.ax as x, b.ay as y, null::int as n
                       union all select b.bx, b.by, null::int
                       union all select s.x, s.y, s.n from bridge_span s where s.world_id = b.world_id and s.bridge = b.id) e
$fn$;

/* The tiles a job works or puts something on; a bridge's every lane between its two ends (`stoneJobTiles`, `Game.planTiles`). */
create or replace function stone_job_tiles(p_world uuid, p_uid uuid, p_action text, p_target jsonb)
returns table (x integer, y integer) language plpgsql stable as $function$
declare d action_def; p player; v_cx int; v_cy int; v_x0 int; v_y0 int; v_x1 int; v_y1 int;
        v_px int := 0; v_py int := 0; v_lo int := 0; v_hi int := 0;
begin
  select * into d from action_def where id = p_action;
  select * into p from player where world_id = p_world and uid = p_uid;
  if p.uid is null then return; end if;
  if p_target->>'kind' is distinct from 'tile' then
    if p_action = 'drop_dirt_here' then
      v_cx := round(p.x)::int; v_cy := round(p.y)::int;
      return query select gx, gy from generate_series(v_cy - 1, v_cy) gy, generate_series(v_cx - 1, v_cx) gx order by gy, gx;
      return;
    end if;
    return query select floor(p.x)::int, floor(p.y)::int;
    return;
  end if;
  v_x1 := (p_target->>'x')::int; v_y1 := (p_target->>'y')::int;
  if p_action = 'plan_bridge' then
    v_x0 := floor(p.x)::int; v_y0 := floor(p.y)::int;
    -- Every lane, across the run (`bridge_lanes`).
    v_px := case when v_y0 = v_y1 and v_x0 <> v_x1 then 0 else 1 end;
    v_py := 1 - v_px;
    select min(l.o), max(l.o) into v_lo, v_hi
      from bridge_lanes(bridge_width_asked(p_target), coalesce(nullif(bridge_side_step(v_x0, v_y0, v_x1, v_y1, p_target->>'side'), 0), 1)) l;
  elsif p_action = 'plan_aqueduct' then
    if jsonb_typeof(p_target->'head') = 'array' then
      v_x0 := (p_target->'head'->>0)::int; v_y0 := (p_target->'head'->>1)::int;
    else
      v_x0 := v_x1; v_y0 := v_y1;
    end if;
  elsif coalesce(d.corner, false) then
    v_cx := (p_target->>'cx')::int; v_cy := (p_target->>'cy')::int;
    return query select gx, gy from generate_series(v_cy - 1, v_cy) gy, generate_series(v_cx - 1, v_cx) gx order by gy, gx;
    return;
  else
    v_x0 := v_x1; v_y0 := v_y1;
  end if;
  return query select gx, gy from generate_series(least(v_y0, v_y1) + v_lo * v_py, greatest(v_y0, v_y1) + v_hi * v_py) gy,
                                  generate_series(least(v_x0, v_x1) + v_lo * v_px, greatest(v_x0, v_x1) + v_hi * v_px) gx
                order by gy, gx;
end $function$;

do $do$
declare v_def text; v_old text; v_new text; v_n int;
begin
  -- runestone_clear: a bridge with any lane's end or deck on the stone, and every lane's deck said afresh.
  v_def := pg_get_functiondef('runestone_clear'::regproc);
  v_old := $$      union select sp.bridge from bridge_span sp where sp.world_id = p_world and sp.x between x0 and x1 and sp.y between y0 and y1
    ) z;$$;
  v_new := $$      union select sp.bridge from bridge_span sp where sp.world_id = p_world and sp.x between x0 and x1 and sp.y between y0 and y1
      -- Every lane's (`bridge_tiles`).
      union select b.id from bridge b where b.world_id = p_world and b.width > 1
         and least(b.ax, b.bx) - 1 <= x1 and greatest(b.ax, b.bx) + 1 >= x0 and least(b.ay, b.by) - 1 <= y1 and greatest(b.ay, b.by) + 1 >= y0
         and exists (select 1 from bridge_tiles(b) t where t.x between x0 and x1 and t.y between y0 and y1)
    ) z;$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'runestone_clear has % of the bridges on a stone, not 1', v_n; end if;
  v_def := replace(v_def, v_old, v_new);
  v_old := $$      v_touched := v_touched || array(select sp.y * w.size + sp.x from bridge_span sp where sp.world_id = p_world and sp.bridge = any(v_br));$$;
  v_new := $$      v_touched := v_touched || array(select t.y * w.size + t.x from bridge b cross join lateral bridge_tiles(b) t
                                       where b.world_id = p_world and b.id = any(v_br) and t.n is not null);$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'runestone_clear has % of the bridge tiles said, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- journal_move: a laden cart on any lane's deck of a bridge you built.
  v_def := pg_get_functiondef('journal_move(uuid,uuid,player,double precision,double precision,placed,double precision[],double precision[])'::regprocedure);
  v_old := $$       and exists (select 1 from bridge_span s join bridge b on b.world_id = s.world_id and b.id = s.bridge
                    where s.world_id = p_world and s.x = floor(p_x)::int and s.y = floor(p_y)::int and b.made_by = p_uid)$$;
  v_new := $$       and exists (select 1 from bridge b where b.world_id = p_world and b.id = bridge_at(p_world, floor(p_x)::int, floor(p_y)::int)
                    and b.made_by = p_uid and bridge_deck_lane(b, floor(p_x)::int, floor(p_y)::int) is not null)$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'journal_move has % of the cart on a bridge, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);

  -- wear_walk: no lane's deck wears the ground under it.
  v_def := pg_get_functiondef('wear_walk'::regproc);
  v_old := $$         and (not spans or not exists (select 1 from bridge_span s join bridge b on b.world_id = s.world_id and b.id = s.bridge
                                        where s.world_id = p_world and s.x = tx and s.y = ty and b.kind <> 'aqueduct')) then$$;
  v_new := $$         and (not spans or not exists (select 1 from bridge b where b.world_id = p_world and b.kind <> 'aqueduct'
                                          and tx between least(b.ax, b.bx) - 1 and greatest(b.ax, b.bx) + 1
                                          and ty between least(b.ay, b.by) - 1 and greatest(b.ay, b.by) + 1
                                          and bridge_deck_lane(b, tx, ty) is not null)) then$$;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'wear_walk has % of the deck check, not 1', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
