-- The island's clock reads its land once, and stocks only blocks that are on the island.
--
-- Audited after the load test (tools/loadtest.ts) on a copy of the test island with land as large as the live
-- island's (each row of heights several kilobytes, kept out of line): the clock (`world_tick`, every second) spent
-- most of its time reading the same land again and again for every creature it walked, and the stocking clock
-- (`stock_tick`) could never finish while anybody stood near an edge. Each change keeps the answers the same.
--
--   * `line_clear` (every leg a creature walks): read its square of land into a variable, then decompressed the
--     whole of it again on every look at it, eighteen or so a step. Decompressed once as it is read, as `near_tile`
--     already does: 2.26 ms to 0.23 ms a call.
--   * `creature_tile_ok` (every tile a creature may stand on, and every try at putting one out): looked at the land
--     rows eleven times, each a decompression, and asked `runestone_on`, which is planned again on every call. Each
--     row read once, the corner heights by the four bytes it needs, and `runestone_on` in plpgsql, which keeps its
--     plan: 0.94 ms to 0.09 ms. With `line_clear`, the creatures' share of a round with 25 people about went from
--     254 ms, cut off by `settle_budget`, to 89 ms, with every creature kept up.
--   * `stock_due`: a block off the edge of the island is never stocked (`creature_stock_block` puts out nothing
--     there and keeps no record), so it was owed for ever: anybody within a block of an edge kept the stocking
--     clock's quick "nothing owed" from ever answering, spent each round's one block (`stock_a_round`) on nothing,
--     and so stopped stocking for everybody. Only blocks on the island are owed now.
--   * `near_tile` (every try at putting a creature out): asked `tile_id` of the kind it looks for once a cell, 81
--     cells a call; once a call now.
--   * `creature_spawn`: found a grazer's herd by its distance alone, a read of every creature of that kind on the
--     island; boxed first, and by an index of where herds live: 2.4 ms to 0.1 ms.
--   * `stage_of` (several times for every creature settled): worked out a creature's level twice; once now.
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

-- ---- a creature's line: its square of land decompressed once ---------------------------------------------------

select pg_temp.patch_fn('public.line_clear(uuid,double precision,double precision,double precision,double precision)'::regprocedure,
  $o$select * into k from land_chunk c where c.world_id = p_world and c.cx = kx and c.cy = ky;$o$,
  $n$select c.world_id, c.cx, c.cy, c.tiles || ''::bytea, c.heights || ''::bytea into k
        from land_chunk c where c.world_id = p_world and c.cx = kx and c.cy = ky;$n$);

-- ---- a tile a creature may stand on: each land row read once ------------------------------------------------

create or replace function public.creature_tile_ok(p_world uuid, p_x integer, p_y integer) returns boolean
  language sql stable as $fn$
  select p_x >= 0 and p_y >= 0 and p_x < q.size and p_y < q.size
     and not coalesce(q.blocks, true)
     -- Nor onto a Runestone (`runestone_on`).
     and runestone_on(q.size, p_x, p_y) is null
     and (q.a + q.b + q.c + q.d) / 4.0 >= -1
     and greatest(q.a, q.b, q.c, q.d) - least(q.a, q.b, q.c, q.d) <= stand_cap(q.tile, max_stand())
     -- Piers: and not a tile on piers, asked only on an island that has had one (`world.piers`).
     and case when q.piers then not exists (select 1 from building_tile bt
               where bt.world_id = p_world and bt.x = p_x and bt.y = p_y and bt.pier) else true end
  from (
    select w.size, w.piers, t.tile, (select d.blocks from tile_def d where d.id = t.tile) as blocks,
           h0.a, h0.b, h1.c, h1.d
    from world w
    -- The tile's kind, off its row once.
    left join lateral (
      select case when p_x >= 0 and p_x < length(lt.tiles) then get_byte(lt.tiles, p_x) end as tile
        from land_tile lt where lt.world_id = p_world and lt.y = p_y) t on true
    -- And its corners: the four bytes of each corner row it needs, read once (`b_i16` of 0 and 1 is `p_x`, `p_x + 1`).
    left join lateral (
      select case when z.ok then b_i16(z.s, 0) end as a, case when z.ok then b_i16(z.s, 1) end as b
        from (select p_x >= 0 and (p_x + 1) * 2 + 1 < length(c.heights) as ok,
                     substring(c.heights from p_x * 2 + 1 for 4) as s
                from land_corner c where c.world_id = p_world and c.y = p_y offset 0) z) h0 on true
    left join lateral (
      select case when z.ok then b_i16(z.s, 1) end as c, case when z.ok then b_i16(z.s, 0) end as d
        from (select p_x >= 0 and (p_x + 1) * 2 + 1 < length(c.heights) as ok,
                     substring(c.heights from p_x * 2 + 1 for 4) as s
                from land_corner c where c.world_id = p_world and c.y = p_y + 1 offset 0) z) h1 on true
    where w.id = p_world) q
$fn$;

-- In plpgsql, which keeps its plan: as SQL with a set in it, it could not be inlined and was planned on every call.
create or replace function public.runestone_on(p_size integer, p_x integer, p_y integer) returns text
  language plpgsql immutable as $fn$
begin
  return (select c.id from runestone_centres(p_size) c
           where abs(p_x - c.x) <= stone_half() and abs(p_y - c.y) <= stone_half()
           order by c.ord limit 1);
end $fn$;

-- ---- only blocks on the island are owed stock ------------------------------------------------------------------

create or replace function public.stock_due(p_world uuid, p_bx integer, p_by integer) returns boolean
  language sql stable as $fn$
  select p_bx >= 0 and p_by >= 0
     and exists (select 1 from world w where w.id = p_world
                  and p_bx * stock_block() < w.size and p_by * stock_block() < w.size)
     and not exists (select 1 from world_stocked s
    where s.world_id = p_world and s.bx = p_bx and s.by = p_by
      and s.at > now() - make_interval(secs => restock_every()))
$fn$;

select pg_temp.patch_fn('public.stock_tick()'::regprocedure,
  $o$       cross join generate_series(-stock_ahead(), stock_ahead()) dx) b
     where not exists (select 1 from world_stocked s$o$,
  $n$       cross join generate_series(-stock_ahead(), stock_ahead()) dx) b
     -- On the island: a block off its edge is never stocked, so it is never owed (`stock_due`).
     where b.bx >= 0 and b.by >= 0
       and exists (select 1 from world ow where ow.id = b.id
                    and b.bx * stock_block() < ow.size and b.by * stock_block() < ow.size)
       and not exists (select 1 from world_stocked s$n$);

-- ---- the kind a creature is put out near, looked up once --------------------------------------------------------

select pg_temp.patch_fn('public.near_tile(uuid,integer,integer,text,integer)'::regprocedure,
  $o$when 'clay'  then get_byte(t.b, gx) = tile_id('Clay')
         when 'trees' then get_byte(t.b, gx) = tile_id('Tree')
         else get_byte(t.b, gx) in (tile_id('Tar'), tile_id('Peat'), tile_id('Marsh')) end);$o$,
  $n$when 'clay'  then get_byte(t.b, gx) = (select tile_id('Clay'))
         when 'trees' then get_byte(t.b, gx) = (select tile_id('Tree'))
         else get_byte(t.b, gx) in ((select tile_id('Tar')), (select tile_id('Peat')), (select tile_id('Marsh'))) end);$n$);

-- ---- a herd's home, by where herds live ------------------------------------------------------------------------

create index if not exists creature_wild_home on creature (world_id, species, home_x, home_y)
  where mode = 'wild' and home_x is not null;

select pg_temp.patch_fn('public.creature_spawn(uuid,text,double precision,double precision,text,timestamp with time zone,uuid)'::regprocedure,
  $o$        and c.home_x is not null
        and (c.home_x - p_x) ^ 2 + (c.home_y - p_y) ^ 2 <= herd_reach() ^ 2$o$,
  $n$        and c.home_x is not null
        -- The box the circle is in first, for `creature_wild_home`; the circle decides.
        and c.home_x between p_x - herd_reach() and p_x + herd_reach()
        and c.home_y between p_y - herd_reach() and p_y + herd_reach()
        and (c.home_x - p_x) ^ 2 + (c.home_y - p_y) ^ 2 <= herd_reach() ^ 2$n$);

-- ---- a creature's stage: its level worked out once ---------------------------------------------------------------

select pg_temp.patch_fn('public.stage_of(creature)'::regprocedure,
  $o$select case when (select sd.stages from species_def sd where sd.id = c.species) is null then 0
              when creature_level(c.skills, c.species) >= evolve_at_2() then 2
              when creature_level(c.skills, c.species) >= evolve_at_1() then 1
              else 0 end$o$,
  $n$select case when (select sd.stages from species_def sd where sd.id = c.species) is null then 0
              else (select case when l.v >= evolve_at_2() then 2 when l.v >= evolve_at_1() then 1 else 0 end
                      from (select creature_level(c.skills, c.species) as v) l) end$n$);

select private.lock_doors();
