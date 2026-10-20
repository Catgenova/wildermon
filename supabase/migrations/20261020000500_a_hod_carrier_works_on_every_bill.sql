-- A hod carrier works on everything on its settlement that is built a piece at a time off a bill, not only walls on
-- the ground floor.
--
-- Asked for: "If not already the case, implement that brickling can work on floors and other deed constructions as
-- well that require bricks or slabs". It was not: the Brickling's job (`wall_needing`, `wall_needing_stocked`) read
-- only `wall` at level 0. Now it reads every table with a bill a builder fits a piece at a time (`needed`, `total`):
--
--   * `wall`, on any storey: walls, fences, railings, gates and counters alike;
--   * `floor_tile`: floors, roofs, staircases and ladders, and a deck on piers, whose bill has its piers on it;
--   * `building_column`;
--   * `bridge_span`, of a bridge or an aqueduct, and of each only the span a builder works: the first still open
--     (`build_bridge`, `build_aqueduct`);
--   * `foundation`: its concrete.
--
-- Not a cellar, which is dug and has no bill.
--
-- The choice is the one it made of walls (`hod_needing`, `hod_needing_stocked`): the piece in hand first, wherever it
-- is wanted; otherwise only what the stores hold; nearest the token first; and of one piece of work's wants, what is
-- furthest behind its bill. Ties go by kind (`hod_rank`), storey, side, x, y and the thing's name, as the browser's
-- `Game.hodNeeding` has them. A piece goes in as a builder's go puts one in (`hod_fit`): the same bill comes down by
-- one, the same triggers start the moss and the ivy and make a glasshouse, a shop counter's store opens
-- (`counter_finished`), an aqueduct's last span settles the springs along it (`aqueduct_touch`), and a foundation's
-- last barrowful packs its top and stops a spring under it (`perform_foundation`'s own steps).
--
-- What it costs the world clock. The worker reads the deed's square of each table by its own index before anything
-- else (`hod_work`): `floor_tile_at`, `bridge_span_where` and `foundation_tile` are on (world, x, y); `wall` and
-- `building_column` are keyed by storey first, so the storeys that table has on the island are found by a walk down
-- the key, one probe a storey, and the square is read a storey at a time. The stores are read once a choice, and not
-- at all when nothing within reach wants anything; and `deed_store_items` now bounds `placed_near` and `crate_near` by
-- the square round the keeper's settlements, where it read every piece of furniture on the island to ask whether it
-- stood on one. On an island of 21 such settlements (8,400 walls, 6,300 floor slots, 3,210 pieces of furniture,
-- 14,000 items), a choice out of the stores took 7.6 ms with walls alone and takes 6.3 ms with all of it.

set local lock_timeout = '3s';

-- The order a hod carrier takes kinds of work in when all else is even: the browser's `HOD_WORK`.
create or replace function hod_rank(p_kind text) returns int language sql immutable as $fn$
  select case p_kind when 'wall' then 0 when 'floor' then 1 when 'column' then 2 when 'span' then 3 when 'foundation' then 4 else 5 end
$fn$;

-- Everything within `p_range` of (p_cx, p_cy) built a piece at a time off a bill with something still wanted: a wall
-- on any storey, a floor slot, a column, a bridge's or an aqueduct's open span, a foundation. Narrowed to that square
-- by each table's own index before anything is asked of a row, and what is still wanted asked by one jsonpath test
-- not by taking each bill apart.
create or replace function hod_work(p_world uuid, p_cx int, p_cy int, p_range int)
  returns table (kind text, level int, dir text, x int, y int, ref bigint, n int, needed jsonb, total jsonb)
  language sql stable as $fn$
  with recursive
  -- The storeys `wall` has on this island, a probe of its key each: `wall_pkey` leads with the storey.
  wl(l) as (
    select min(w.level) from wall w where w.world_id = p_world
    union all
    select (select min(w.level) from wall w where w.world_id = p_world and w.level > wl.l) from wl where wl.l is not null
  ),
  -- And `building_column`'s, the same way.
  cl(l) as (
    select min(c.level) from building_column c where c.world_id = p_world
    union all
    select (select min(c.level) from building_column c where c.world_id = p_world and c.level > cl.l) from cl where cl.l is not null
  )
  -- A storey at a time, so each is a range of the key: storey, side, then x.
  select 'wall'::text, w.level, w.dir, w.x, w.y, null::bigint, null::int, w.needed, w.total
    from wl cross join lateral (
      select * from wall w
       where w.world_id = p_world and w.level = wl.l and w.dir in ('h', 'v')
         and w.x between p_cx - p_range and p_cx + p_range and w.y between p_cy - p_range and p_cy + p_range
         and w.needed @? '$.* ? (@ > 0)'
      offset 0) w  -- kept a scan of its own a storey, so it is the key's range and not the whole island's walls
   where wl.l is not null
  union all
  select 'floor', f.level, '', f.x, f.y, null, null, f.needed, f.total
    from floor_tile f
   where f.world_id = p_world
     and f.x between p_cx - p_range and p_cx + p_range and f.y between p_cy - p_range and p_cy + p_range
     and f.needed @? '$.* ? (@ > 0)'
  union all
  select 'column', c.level, '', c.x, c.y, null, null, c.needed, c.total
    from cl cross join lateral (
      select * from building_column c
       where c.world_id = p_world and c.level = cl.l
         and c.x between p_cx - p_range and p_cx + p_range and c.y between p_cy - p_range and p_cy + p_range
         and c.needed @? '$.* ? (@ > 0)'
      offset 0) c
   where cl.l is not null
  union all
  -- Of a bridge or an aqueduct only the span a builder works, the first still open (`build_bridge`).
  select 'span', 0, '', s.x, s.y, s.bridge, s.n, s.needed, s.total
    from bridge_span s
   where s.world_id = p_world
     and s.x between p_cx - p_range and p_cx + p_range and s.y between p_cy - p_range and p_cy + p_range
     and not span_done(s.needed)
     and not exists (select 1 from bridge_span s2
                      where s2.world_id = p_world and s2.bridge = s.bridge and s2.n < s.n and not span_done(s2.needed))
  union all
  select 'foundation', 0, '', fo.x, fo.y, fo.id, null, fo.needed, fo.total
    from foundation fo
   where fo.world_id = p_world
     and fo.x between p_cx - p_range and p_cx + p_range and fo.y between p_cy - p_range and p_cy + p_range
     and fo.needed @? '$.* ? (@ > 0)'
$fn$;

-- The stores on the keeper's settlements, as 20261019174000 reads them, and now found by where they stand: the square
-- round all of those settlements bounds `placed_near` and `crate_near` before each piece is asked which settlement it
-- is on. Before, every piece of furniture on the island was read to ask that. The same stores, in the same order.
create or replace function deed_store_items(p_world uuid, p_uid uuid)
  returns table (kind text, sid bigint, x int, y int, cx double precision, cy double precision, it item)
  language sql stable as $fn$
  with dd as materialized (
    select d.x, d.y, d.radius from deeds_of(p_world, p_uid) d
  ),
  bb as materialized (
    select min(dd.x - dd.radius) as x0, max(dd.x + dd.radius) as x1, min(dd.y - dd.radius) as y0, max(dd.y + dd.radius) as y1 from dd
  ),
  -- Furniture on one of those settlements with something in it: cheap to find, before anything is reckoned.
  pp as materialized (
    select p from placed p
     where p.world_id = p_world
       and p.x between (select x0 from bb) and (select x1 from bb) and p.y between (select y0 from bb) and (select y1 from bb)
       and p.kind = 'furniture'
       and exists (select 1 from dd where abs(p.x - dd.x) <= dd.radius and abs(p.y - dd.y) <= dd.radius)
       -- By the piece's id alone, which `item_by_placed` answers: with the island in it too, the planner went through
       -- every item in every piece of furniture on the island for each one.
       and exists (select 1 from item i where i.placed = p.id and i.holder = 'furniture')
  ),
  -- And of that, what is a store: `furniture_holds`, worked out here from the piece's own columns. Called with the
  -- whole row it cost a millisecond a piece in setting itself up, for a few microseconds of arithmetic.
  ph as materialized (
    select pp.p from pp
      join furniture_def fd on fd.id = (pp.p).sub
      cross join lateral (select mat_hold((pp.p).material) * mark_of((pp.p).mark, 'hold') * room_mul((pp.p).enchant) as m) k
     where coalesce(fd.trash, 0) = 0
       and (room_for(coalesce(fd.capacity, fd.hive, fd.pond, 0) * k.m, (pp.p).rare) > 0
            or room_for(coalesce(fd.heft, 0) * k.m, (pp.p).rare) > 0)
  ),
  cc as materialized (
    select cr from crate cr
     where cr.world_id = p_world
       and cr.x between (select x0 from bb) and (select x1 from bb) and cr.y between (select y0 from bb) and (select y1 from bb)
       and exists (select 1 from dd where abs(cr.x - dd.x) <= dd.radius and abs(cr.y - dd.y) <= dd.radius)
  )
  select 'crate', (cc.cr).id::bigint, (cc.cr).x, (cc.cr).y, crate_centre_x(cc.cr), crate_centre_y(cc.cr), i
  from cc join item i on i.world_id = p_world and i.holder = 'crate' and i.crate = (cc.cr).id
  union all
  select 'furniture', (ph.p).id, (ph.p).x, (ph.p).y, (ph.p).cx, (ph.p).cy, i
  from ph join item i on i.placed = (ph.p).id and i.holder = 'furniture'
$fn$;

-- The nearest work within reach of (p_cx, p_cy) wanting the piece in hand, `p_holding`: where a hod carrier takes
-- what it is carrying, and, at range nought on the tile it walked to, what it fits it into.
create or replace function hod_needing(p_world uuid, p_cx int, p_cy int, p_range int, p_holding text)
  returns table (kind text, level int, dir text, x int, y int, ref bigint, n int, item text)
  language sql stable as $fn$
  select w.kind, w.level, w.dir, w.x, w.y, w.ref, w.n, p_holding
  from hod_work(p_world, p_cx, p_cy, p_range) w
  where p_holding is not null and coalesce((w.needed->>p_holding)::int, 0) > 0
  order by (w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2,
           (w.needed->>p_holding)::double precision / greatest(1, coalesce((w.total->>p_holding)::double precision, 0)) desc,
           hod_rank(w.kind), w.level, w.dir collate "C", w.x, w.y
  limit 1
$fn$;

-- The nearest work within reach of (p_cx, p_cy) wanting something its keeper's stores on the deed hold, and that
-- thing: of what it wants, what is furthest behind its bill, so brick and mortar go in together. The stores read once,
-- and only when something within reach wants anything.
create or replace function hod_needing_stocked(p_world uuid, p_uid uuid, p_cx int, p_cy int, p_range int)
  returns table (kind text, level int, dir text, x int, y int, ref bigint, n int, item text)
  language sql stable as $fn$
  with work as materialized (
    select * from hod_work(p_world, p_cx, p_cy, p_range)
  ),
  want as materialized (
    select w.*, e.key, e.value::int as left_
    from work w cross join lateral jsonb_each_text(w.needed) e
    where e.value::int > 0
  ),
  have as materialized (
    select distinct (s.it).def as def from deed_store_items(p_world, p_uid) s
     where (s.it).count > 0 and not coalesce((s.it).locked, false)
       and exists (select 1 from want)
  )
  select w.kind, w.level, w.dir, w.x, w.y, w.ref, w.n, w.key
  from want w
  where w.key in (select def from have)
  order by (w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2,
           w.left_::double precision / greatest(1, coalesce((w.total->>w.key)::double precision, 0)) desc,
           hod_rank(w.kind), w.level, w.dir collate "C", w.x, w.y, w.key collate "C"
  limit 1
$fn$;

-- One piece of `p_item` into the work a hod carrier walked to, as a builder's go puts one in: the bill down by one,
-- and what the last of it starts. Without the builder's skill, tool or words. Whether it went in. The browser's
-- `Game.fitPiece`.
create or replace function hod_fit(p_world uuid, p_kind text, p_level int, p_dir text, p_x int, p_y int,
                                   p_ref bigint, p_n int, p_item text)
  returns boolean language plpgsql as $fn$
declare w wall; s bridge_span; b bridge; fo foundation; v_left int;
begin
  if p_kind = 'wall' then
    update wall set needed = jsonb_set(needed, array[p_item], to_jsonb((needed->>p_item)::int - 1))
     where world_id = p_world and level = p_level and dir = p_dir and x = p_x and y = p_y
       and coalesce((needed->>p_item)::int, 0) > 0
    returning * into w;
    if w.world_id is null then return false; end if;
    -- A shop counter's store opens as it is finished (`counters.ts`), as `perform_building` has it.
    if bill_done(w.needed) then perform counter_finished(p_world, w); end if;
    return true;

  elsif p_kind = 'floor' then
    -- A glass roof's last pane makes a glasshouse by the floor's own triggers, as for a builder.
    update floor_tile set needed = jsonb_set(needed, array[p_item], to_jsonb((needed->>p_item)::int - 1))
     where world_id = p_world and level = p_level and x = p_x and y = p_y and coalesce((needed->>p_item)::int, 0) > 0;
    return found;

  elsif p_kind = 'column' then
    update building_column set needed = jsonb_set(needed, array[p_item], to_jsonb((needed->>p_item)::int - 1))
     where world_id = p_world and level = p_level and x = p_x and y = p_y and coalesce((needed->>p_item)::int, 0) > 0;
    return found;

  elsif p_kind = 'span' then
    update bridge_span sp set needed = jsonb_set(sp.needed, array[p_item], to_jsonb(greatest(0, (sp.needed->>p_item)::int - 1)))
     where sp.world_id = p_world and sp.bridge = p_ref and sp.n = p_n and coalesce((sp.needed->>p_item)::int, 0) > 0
    returning * into s;
    if s.world_id is null then return false; end if;
    -- An aqueduct's last span: the springs whose water reaches either end are settled again (`perform_aqueduct`).
    select * into b from bridge where world_id = p_world and id = p_ref;
    if b.kind = 'aqueduct' and span_done(s.needed) and bridge_left(p_world, b.id) = 0 then
      perform aqueduct_touch(p_world, b.ax, b.ay, b.bx, b."by");
    end if;
    return true;

  elsif p_kind = 'foundation' then
    if p_item <> 'concrete' then return false; end if;
    update foundation set needed = jsonb_build_object('concrete', greatest(0, coalesce((needed->>'concrete')::int, 0) - 1))
     where world_id = p_world and id = p_ref and coalesce((needed->>'concrete')::int, 0) > 0
    returning * into fo;
    if fo.world_id is null then return false; end if;
    v_left := (fo.needed->>'concrete')::int;
    if v_left = 0 then
      -- As `perform_foundation` finishes a pour: the top is packed ground, and a slab poured over a spring stops it.
      perform land_set_tile(p_world, fo.x, fo.y, tile_id('Packed dirt'));
      perform spring_touch_tile(p_world, fo.x, fo.y);
    end if;
    perform land_announce(p_world, fo.x, fo.y);
    return true;
  end if;
  return false;
end $fn$;

-- The worker's two steps, read through the above.
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'errand_step',
     $$    -- Carrying a piece a wall within reach still wants: that wall. Otherwise the nearest wall wanting something
    -- the stores hold, and the store nearest it holding that, crates and furniture alike (`wall_needing_stocked`).
    select * into v_job from wall_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def');
    if c.carrying is null or v_job.item is distinct from c.carrying->>'def' then
      select * into v_job from wall_needing_stocked(p_world, c.keeper, dd.x, dd.y, rng);$$,
     $$    -- Carrying a piece some work within reach still wants: that work. Otherwise the nearest work wanting something
    -- the stores hold, and the store nearest it holding that, crates and furniture alike (`hod_needing_stocked`).
    select * into v_job from hod_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def');
    if c.carrying is null or v_job.item is distinct from c.carrying->>'def' then
      select * into v_job from hod_needing_stocked(p_world, c.keeper, dd.x, dd.y, rng);$$, 1),
    (2, 'errand_do',
     $$    select * into v_job from wall_needing(p_world, c.work_x, c.work_y, 0, c.carrying->>'def');
    if v_job.item is null or v_job.item is distinct from c.carrying->>'def' then return false; end if;
    update wall set needed = jsonb_set(needed, array[v_job.item],
        to_jsonb((needed->>v_job.item)::int - 1))
      where world_id = p_world and level = 0 and dir = v_job.dir and x = v_job.x and y = v_job.y;
    -- A shop counter's store opens as its last piece goes in (`counters.ts`).
    perform counter_finished(p_world, w2) from wall w2
      where w2.world_id = p_world and w2.level = 0 and w2.dir = v_job.dir and w2.x = v_job.x and w2.y = v_job.y
        and w2.type = 'counter' and bill_done(w2.needed);$$,
     $$    -- Whatever on the tile it walked to wants what it is carrying, and in it goes as a builder's piece does.
    select * into v_job from hod_needing(p_world, c.work_x, c.work_y, 0, c.carrying->>'def');
    if v_job.item is null or v_job.item is distinct from c.carrying->>'def' then return false; end if;
    if not hod_fit(p_world, v_job.kind, v_job.level, v_job.dir, v_job.x, v_job.y, v_job.ref, v_job.n, v_job.item) then
      return false;
    end if;$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not there', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
