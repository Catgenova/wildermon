-- A hod carrier brings a wall what the settlement's stores hold, from any store of its keeper's on the deed.
--
-- Asked about: "Cibbe at level 1 isnt bringing marble bricks and mortar to planned solid marble wall 7 tiles away".
-- Three things stood in the way:
--
--   * the job took the nearest wall wanting anything, and the first thing it wanted, whether or not any of it was in
--     the stores, and when there was none it stood idle rather than going on to what there was;
--   * it looked for that only in crates (`stocked`), never in a bin, a chest or anything else that keeps things;
--   * and in any crate on any deed in the world, not its keeper's (`take_from_stores` took the same way).
--
-- Now it takes the nearest wall wanting something its keeper's stores on the deed hold, crates and furniture alike,
-- and of that, what is furthest behind the wall's bill (`wall_needing_stocked`, over `deed_store_items`), goes to the store nearest it holding that (`store_holding`), and
-- takes one there (`take_one_stored`, as the jobs that tend the settlement already do). A worker on any errand
-- fetches from its keeper's stores in the same way. Carrying a piece a wall within reach still wants, it takes it
-- there, as before.

set local lock_timeout = '3s';

-- The nearest planned wall within reach of (p_cx, p_cy) wanting something these stores hold, and that thing.
create or replace function wall_needing_stocked(p_world uuid, p_uid uuid, p_cx int, p_cy int, p_range int)
  returns table (dir text, x int, y int, item text) language sql stable as $fn$
  select w.dir, w.x, w.y, e.key
  from wall w
  cross join lateral jsonb_each_text(w.needed) e
  where w.world_id = p_world and w.level = 0 and e.value::int > 0
    and greatest(abs(w.x - p_cx), abs(w.y - p_cy)) <= p_range
    and exists (select 1 from deed_store_items(p_world, p_uid) s
                 where (s.it).def = e.key and (s.it).count > 0 and not coalesce((s.it).locked, false))
  -- Nearest first, and of what it wants, what is furthest behind its bill, so brick and mortar go in together.
  order by (w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2, e.value::double precision / greatest(1, (w.total->>e.key)::double precision) desc, e.key
  limit 1
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'errand_step',
     $$    select * into v_job from wall_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def');
    if v_job.item is null then return; end if;
    if c.carrying->>'def' is distinct from v_job.item then
      v_store := stocked(p_world, v_job.item);
      if v_store.id is null then return; end if;
      select * into v_crate from crate where world_id = p_world and id = v_store.crate;
      gx := crate_centre_x(v_crate); gy := crate_centre_y(v_crate);
      want := v_job.item; wx := v_crate.x; wy := v_crate.y;
    else$$,
     $$    -- Carrying a piece a wall within reach still wants: that wall. Otherwise the nearest wall wanting something
    -- the stores hold, and the store nearest it holding that, crates and furniture alike (`wall_needing_stocked`).
    select * into v_job from wall_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def');
    if c.carrying is null or v_job.item is distinct from c.carrying->>'def' then
      select * into v_job from wall_needing_stocked(p_world, c.keeper, dd.x, dd.y, rng);
      if v_job.item is null then return; end if;
      select * into v_spot from store_holding(p_world, c.keeper, array[v_job.item], v_job.x + 0.5, v_job.y + 0.5);
      if v_spot.sid is null then return; end if;
      gx := v_spot.cx; gy := v_spot.cy;
      want := v_job.item; wx := v_spot.x; wy := v_spot.y;
    else$$, 1),
    (2, 'worker_settle',
     $$load := take_from_stores(p_world, c.fetching);$$,
     $$load := take_one_stored(p_world, c.keeper, array[c.fetching], c.work_x, c.work_y);$$, 1)
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
