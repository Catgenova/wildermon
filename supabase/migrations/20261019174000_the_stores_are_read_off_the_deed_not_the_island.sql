-- The stores on a settlement are read off the settlement, and read once for a hod's whole choice of wall.
--
-- Reported: "The server isnt loading now", after workers stood idle and no wildermon could be crated. Every round of
-- the world clock since 16:57 ran into its 120-second statement timeout inside the hod carrier's choice of wall
-- (`wall_needing_stocked`, 20261019143000), so every round was undone: nothing moved, and while each round ran it
-- held the rows that players' own actions were waiting for.
--
-- Two things multiplied each other:
--
--   * `deed_store_items` worked out what every piece of furniture on the island could hold (`furniture_holds`, which
--     reckons its room and quality) before asking whether it stood on the keeper's settlement at all;
--   * it found what was in each piece through an index on the whole island's furniture items, not the piece's own;
--   * `wall_needing_stocked` ran it again for every planned wall and every material that wall still wanted, and a
--     worker's catch-up asks for a wall up to `worker_settle`'s 120 times.
--
-- Now the stores are first narrowed to the keeper's settlements' own squares (`deed_covers`), only furniture with
-- something in it is asked what it can hold, that is reckoned from its columns rather than by handing the whole row to
-- `furniture_holds` (a millisecond a piece, in setting the call up), and a hod's choice reads the stores once.
-- Nothing else changes: the same stores, the same walls, the same order.

set local lock_timeout = '3s';

create or replace function deed_store_items(p_world uuid, p_uid uuid)
  returns table (kind text, sid bigint, x int, y int, cx double precision, cy double precision, it item)
  language sql stable as $fn$
  with dd as materialized (
    select d.x, d.y, d.radius from deeds_of(p_world, p_uid) d
  ),
  -- Furniture on one of those settlements with something in it: cheap to find, before anything is reckoned.
  pp as materialized (
    select p from placed p
     where p.world_id = p_world and p.kind = 'furniture'
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
  )
  select 'crate', cr.id::bigint, cr.x, cr.y, crate_centre_x(cr), crate_centre_y(cr), i
  from crate cr join item i on i.world_id = cr.world_id and i.holder = 'crate' and i.crate = cr.id
  where cr.world_id = p_world
    and exists (select 1 from dd where abs(cr.x - dd.x) <= dd.radius and abs(cr.y - dd.y) <= dd.radius)
  union all
  select 'furniture', (ph.p).id, (ph.p).x, (ph.p).y, (ph.p).cx, (ph.p).cy, i
  from ph join item i on i.placed = (ph.p).id and i.holder = 'furniture'
$fn$;

-- The nearest planned wall within reach of (p_cx, p_cy) wanting something these stores hold, and that thing: the
-- stores read once, not once a wall.
create or replace function wall_needing_stocked(p_world uuid, p_uid uuid, p_cx int, p_cy int, p_range int)
  returns table (dir text, x int, y int, item text) language sql stable as $fn$
  with have as materialized (
    select distinct (s.it).def as def from deed_store_items(p_world, p_uid) s
     where (s.it).count > 0 and not coalesce((s.it).locked, false)
  )
  select w.dir, w.x, w.y, e.key
  from wall w
  cross join lateral jsonb_each_text(w.needed) e
  where w.world_id = p_world and w.level = 0 and e.value::int > 0
    and greatest(abs(w.x - p_cx), abs(w.y - p_cy)) <= p_range
    and e.key in (select def from have)
  -- Nearest first, and of what it wants, what is furthest behind its bill, so brick and mortar go in together.
  order by (w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2, e.value::double precision / greatest(1, (w.total->>e.key)::double precision) desc, e.key
  limit 1
$fn$;

select private.lock_doors();
