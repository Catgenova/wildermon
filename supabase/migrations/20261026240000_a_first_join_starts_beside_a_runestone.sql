/*
 * A first join starts beside the Runestone it picked.
 *
 * Asked for: "new players should select between the 5 runestones for
 * spawning, and spawn 2 tiles away from that stone on selection". The browser
 * shows somebody with no body on the island the five (`startChoices`,
 * src/ui/stonestart.ts) and sends the one picked with the join:
 *
 *   * `rpc_join` takes `p_stone text default null`. A stone that is not one of
 *     `runestones()` is refused at the door (`private.bad_request`). A caller
 *     that leaves it out joins as before.
 *   * A body made by the join (none on this island yet) starts on the first
 *     tile of `start_ring` round that stone that is free by the Telestone's
 *     own terms (`telestone_landing`): on the map, a tile a body can stand on,
 *     no stone's, dry, no steeper than `landing_stand` and under no building.
 *     The ring `START_GAP` tiles out from the stone's edge first, then the
 *     next ring out (`START_SPARE` more); with none free, or on a world the
 *     stones do not stand on, or with no stone named, the island's spawn, as
 *     before.
 *   * A body already on the island is where it was: `p_stone` changes nothing.
 *
 * The answer's `you` is the body where it starts, which the browser draws.
 */
set local lock_timeout = '3s';

/**
 * Where a body joining for the first time starts beside a stone: the first
 * tile of `start_ring` free by `telestone_landing`'s terms. None when there is
 * none, or no such stone on this island.
 */
create or replace function start_landing(p_world uuid, p_stone text) returns table (x int, y int)
  language sql stable as $$
  select c.x + r.dx, c.y + r.dy
    from world w
    cross join lateral runestone_centres(w.size) c
    cross join start_ring() r
   where w.id = p_world and c.id = p_stone
     and passable(p_world, c.x + r.dx, c.y + r.dy)
     and runestone_on(w.size, c.x + r.dx, c.y + r.dy) is null
     and not has_water(p_world, c.x + r.dx, c.y + r.dy)
     and tile_slope(p_world, c.x + r.dx, c.y + r.dy) <= landing_stand()
     and building_at(p_world, c.x + r.dx, c.y + r.dy) is null
   order by r.k
   limit 1
$$;
revoke all on function start_landing(uuid, text) from public, anon, authenticated;

do $do$
declare v_def text; v_n int; r record;
begin
  -- Run once already: the door with the stone is there and the old one gone.
  if to_regprocedure('public.rpc_join(uuid,text)') is null then return; end if;
  v_def := pg_get_functiondef('public.rpc_join(uuid,text)'::regprocedure);
  for r in select * from (values
    -- The stone, beside the name.
    (1, $$public.rpc_join(p_world uuid, p_name text DEFAULT NULL::text)$$,
        $$public.rpc_join(p_world uuid, p_name text DEFAULT NULL::text, p_stone text DEFAULT NULL::text)$$),
    (2, $$        v_since timestamptz; v_away jsonb;
$$, $$        v_since timestamptz; v_away jsonb; v_sx double precision; v_sy double precision;
$$),
    -- Refused at the door when it names no Runestone.
    (3, $$  if me is null then raise exception 'not signed in'; end if;
$$, $$  if me is null then raise exception 'not signed in'; end if;
  if p_stone is not null and not exists (select 1 from runestones() r where r.id = p_stone) then
    perform private.bad_request('rpc_join', 'p_stone: not a Runestone');
  end if;
$$),
    -- A new body starts beside it, or at the spawn when there is no free tile beside it.
    (4, $$    perform private.ip_body_take(p_world, me);
$$, $$    perform private.ip_body_take(p_world, me);
    select l.x + 0.5, l.y + 0.5 into v_sx, v_sy from start_landing(p_world, p_stone) l where p_stone is not null;
$$),
    (5, $$w.spawn_x + 0.5, w.spawn_y + 0.5,$$,
        $$coalesce(v_sx, w.spawn_x + 0.5), coalesce(v_sy, w.spawn_y + 0.5),$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'rpc_join: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  drop function public.rpc_join(uuid, text);
  execute v_def;
end $do$;

select private.lock_doors();
