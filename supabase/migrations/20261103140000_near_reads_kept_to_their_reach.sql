-- The near reads kept to their reach, and the island-wide work taken out of them.
--
-- Audited after the load test (tools/loadtest.ts) on a copy of the test island given an island's worth of rows
-- (3000 people ever on, 150 awake, 60k things in crates, 30k crops, 30k walls, 20k floors, 10k foundations, 150
-- deeds): what each browser asks once a second or once a minute was reading whole island tables to answer for the
-- forty tiles round it. Each change below gives the same answer, row for row.
--
--   * `crates_near` (the ground's fast half, every second): summed every crate's contents on the island to answer
--     for the crates in reach -- the join key cannot be pushed into a grouped subquery. Each crate's own sum now,
--     off `item_in_crate`: 32-40 ms to 0.6 ms.
--   * and asked `deed_may` of every deed on the island before keeping the asker's: 6 ms to 0.7 ms.
--   * the ground's slow half (once a minute and after anything you do): crops, notches, walls, floors, foundations,
--     buildings and cellars were each found by an exact distance alone, which no index can answer: a scan of the
--     island's table. Each is boxed first (a box is a superset of the distance, which still decides): the whole near
--     answer 101 ms to 23 ms. Walls get an index by place (`wall_at`); theirs starts by level.
--   * `folk_ashore` (20261103130000): the crowd it counts once was folded back into the list by the planner, a
--     count of everybody online again for every row. Kept apart (`materialized`): 10.8 ms to 4.2 ms.
--   * `rpc_worn` (every 20 s, every browser): what everybody ever on the island has on, for a roster of those awake;
--     the browser lays it on the awake rows only. Those awake now: 8.1 ms to 0.3 ms.
--   * `land_tile` (a tile's kind, from its land row): asked against `tile_def` by a filter, it was called once for
--     each of the 25 kinds -- 26 reads of the land row for one step (`travel_speed`), and the same in
--     `worker_wait_left`, `green_on_tile` and every rule written that way, `creature_settle` among them, once a
--     creature on the clock. Costed as what it is, the planner looks the kind up by its key with one call.
--   * `carried_weight` (every step): a SQL function that cannot be inlined is planned again on every call; the same
--     query in plpgsql keeps its plan. About 1.4 ms to 0.8 ms.
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

-- ---- the fast half: crates in reach ---------------------------------------------------------------------------

select pg_temp.patch_fn('public.crates_near(uuid,uuid,double precision)'::regprocedure,
  $o$select coalesce(array_agg(d), '{}') as ds from deeds_of(p_world, p_uid) d
     where deed_may(p_world, d.founded_by, p_uid, power_bit('stores')))$o$,
  $n$select coalesce(array_agg(d) filter (where deed_may(p_world, d.founded_by, p_uid, power_bit('stores'))), '{}') as ds
      from deeds_of(p_world, p_uid) d)$n$);

select pg_temp.patch_fn('public.crates_near(uuid,uuid,double precision)'::regprocedure,
  $o$      left join (select i.crate, sum(i.count)::int as units
                   from item i
                  where i.world_id = p_world and i.holder = 'crate'
                  group by i.crate) u on u.crate = c.id$o$,
  $n$      left join lateral (select sum(i.count)::int as units
                   from item i
                  where i.world_id = p_world and i.holder = 'crate' and i.crate = c.id) u on true$n$);

-- ---- the slow half: each table boxed before the distance ------------------------------------------------------

select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$      from crop c
      where c.world_id = p_world
        and greatest(abs(c.x + 0.5 - p.x), abs(c.y + 0.5 - p.y)) <= p_range)$o$,
  $n$      from crop c
      where c.world_id = p_world
        and c.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and c.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(c.x + 0.5 - p.x), abs(c.y + 0.5 - p.y)) <= p_range)$n$);

select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$      where n.world_id = p_world
        and greatest(abs(n.x + 0.5 - p.x), abs(n.y + 0.5 - p.y)) <= p_range)$o$,
  $n$      where n.world_id = p_world
        and n.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and n.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(n.x + 0.5 - p.x), abs(n.y + 0.5 - p.y)) <= p_range)$n$);

select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$          and exists (select 1 from building_tile bt
                       where bt.world_id = p_world and bt.building = b.id
                         and greatest(abs(bt.x + 0.5 - p.x), abs(bt.y + 0.5 - p.y)) <= p_range)$o$,
  $n$          and b.id in (select bt.building from building_tile bt
                       where bt.world_id = p_world
                         and bt.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
                         and bt.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
                         and greatest(abs(bt.x + 0.5 - p.x), abs(bt.y + 0.5 - p.y)) <= p_range)$n$);

select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$        where w.world_id = p_world
          and greatest(abs(w.x + 0.5 - p.x), abs(w.y + 0.5 - p.y)) <= p_range)$o$,
  $n$        where w.world_id = p_world
          and w.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
          and w.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
          and greatest(abs(w.x + 0.5 - p.x), abs(w.y + 0.5 - p.y)) <= p_range)$n$);

select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$        where f.world_id = p_world
          and greatest(abs(f.x + 0.5 - p.x), abs(f.y + 0.5 - p.y)) <= p_range)$o$,
  $n$        where f.world_id = p_world
          and f.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
          and f.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
          and greatest(abs(f.x + 0.5 - p.x), abs(f.y + 0.5 - p.y)) <= p_range)$n$);

select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$      where fo.world_id = p_world
        and greatest(abs(fo.x + 0.5 - p.x), abs(fo.y + 0.5 - p.y)) <= p_range)$o$,
  $n$      where fo.world_id = p_world
        and fo.x between floor(p.x - p_range)::int - 1 and floor(p.x + p_range)::int + 1
        and fo.y between floor(p.y - p_range)::int - 1 and floor(p.y + p_range)::int + 1
        and greatest(abs(fo.x + 0.5 - p.x), abs(fo.y + 0.5 - p.y)) <= p_range)$n$);

select pg_temp.patch_fn('public.cellars_near(uuid,double precision,double precision,double precision)'::regprocedure,
  $o$                          where bt.world_id = p_world
                            and greatest(abs(bt.x + 0.5 - p_x), abs(bt.y + 0.5 - p_y)) <= p_range)$o$,
  $n$                          where bt.world_id = p_world
                            and bt.x between floor(p_x - p_range)::int - 1 and floor(p_x + p_range)::int + 1
                            and bt.y between floor(p_y - p_range)::int - 1 and floor(p_y + p_range)::int + 1
                            and greatest(abs(bt.x + 0.5 - p_x), abs(bt.y + 0.5 - p_y)) <= p_range)$n$);

-- Walls by place: the key starts by level and side, which a box of tiles cannot use.
create index if not exists wall_at on wall (world_id, x, y);

-- ---- everybody ashore: the crowd counted once, kept apart -------------------------------------------------------

select pg_temp.patch_fn('public.folk_ashore(uuid,uuid)'::regprocedure,
  $o$with seen as (select folk_seen(p_world) as near)$o$,
  $n$with seen as materialized (select folk_seen(p_world) as near)$n$);

-- ---- what those awake have on ---------------------------------------------------------------------------------

select pg_temp.patch_fn('public.rpc_worn(uuid)'::regprocedure,
  $o$     where p.world_id = p_world and w.gear is not null$o$,
  $n$     where p.world_id = p_world and not p.away and w.gear is not null$n$);

-- ---- a tile's kind, called once ------------------------------------------------------------------------------

alter function public.land_tile(uuid, integer, integer) cost 10000;

-- ---- what you carry, planned once a session --------------------------------------------------------------------

do $do$
declare d text := pg_get_functiondef('public.carried_weight(uuid,uuid)'::regprocedure);
begin
  if position(' LANGUAGE sql' in d) = 0 then raise exception 'carried_weight is not LANGUAGE sql any more'; end if;
  d := replace(d, ' LANGUAGE sql', ' LANGUAGE plpgsql');
  d := regexp_replace(d, 'AS \$function\$', E'AS $function$\n#variable_conflict use_column\nbegin\n  return (\n');
  d := regexp_replace(d, '\$function\$\s*$', E'\n  );\nend\n$function$');
  execute d;
end $do$;

select private.lock_doors();
