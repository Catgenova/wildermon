-- A settlement's workers eat from its own stores and carry the hod to its own building work only.
--
-- Asked: "my wildermon are travelling 200 tiles to eat from my neighbor's deed". A hungry worker ate out of the
-- stores of whatever settlement it stood on (`worker_feed`: `deed_covering` where it stood), its keeper's or
-- anybody's; the browser's `feedFromStores` goes by its own (`workSite`). Now the keeper's own settlement's stores.
--
-- And asked for (yes to "a Brickling could carry your materials into a neighbour's planned walls"): a hod carrier took
-- the nearest planned wall, floor, roof, stair or span within its reach of its totem (`hod_needing`,
-- `hod_needing_stocked`, `hod_wanted`), whoever's settlement it stood on. Now only work on its keeper's settlement
-- (`on_my_deed`), as a stoker's hearth now is and a smelter worker's furnace already was.

set local lock_timeout = '3s';

-- Feeding: the keeper's own settlement's stores, as the browser has it.
do $do$
declare v text; v_n int;
  v_old text := $o$    select * into v_deed from deed_covering(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int) limit 1;
$o$;
  v_new text := $n$    -- Its keeper's own settlement's stores, wherever it stands (the browser's `workSite`).
    select * into v_deed from my_deed(p_world, c.keeper) md where md.world_id is not null;
$n$;
begin
  select pg_get_functiondef('worker_feed'::regproc) into v;
  v_n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_feed has % of the line to change, not 1', v_n; end if;
  execute replace(v, v_old, v_new);
end $do$;

-- The hod's work, with the keeper whose settlement it must stand on (none: anywhere, as before).
drop function if exists hod_needing(uuid, integer, integer, integer, text);
create function hod_needing(p_world uuid, p_cx integer, p_cy integer, p_range integer, p_holding text, p_keeper uuid default null)
 returns table(kind text, level integer, dir text, x integer, y integer, ref bigint, n integer, item text)
 language sql
 stable
as $function$
  select w.kind, w.level, w.dir, w.x, w.y, w.ref, w.n, p_holding
  from hod_work(p_world, p_cx, p_cy, p_range) w
  where p_holding is not null and coalesce((w.needed->>p_holding)::int, 0) > 0
    and (p_keeper is null or on_my_deed(p_world, p_keeper, w.x, w.y))
  order by (w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2,
           (w.needed->>p_holding)::double precision / greatest(1, coalesce((w.total->>p_holding)::double precision, 0)) desc,
           hod_rank(w.kind), w.level, w.dir collate "C", w.x, w.y
  limit 1
$function$;

drop function if exists hod_wanted(uuid, integer, integer, integer);
create function hod_wanted(p_world uuid, p_cx integer, p_cy integer, p_range integer, p_keeper uuid default null)
 returns table(items text[], n integer)
 language sql
 stable
as $function$
  with each_ as (
    select e.key as item, min((w.x - p_cx) ^ 2 + (w.y - p_cy) ^ 2) as d
    from hod_work(p_world, p_cx, p_cy, p_range) w cross join lateral jsonb_each_text(w.needed) e
    where e.value::int > 0 and (p_keeper is null or on_my_deed(p_world, p_keeper, w.x, w.y))
    group by e.key
  )
  select (array_agg(item order by d, item collate "C"))[1:idle_wants()], count(*)::int from each_
$function$;

do $do$
declare r record; v text; v_n int;
begin
  for r in select * from (values
    ('hod_needing_stocked', $o$    where e.value::int > 0
$o$, $n$    where e.value::int > 0 and on_my_deed(p_world, p_uid, w.x, w.y)
$n$),
    ('errand_step', $o$    select * into v_job from hod_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def');
$o$, $n$    select * into v_job from hod_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def', c.keeper);
$n$),
    ('errand_step', $o$        select * into v_wet from hod_wanted(p_world, dd.x, dd.y, rng);
$o$, $n$        select * into v_wet from hod_wanted(p_world, dd.x, dd.y, rng, c.keeper);
$n$),
    ('errand_do', $o$    select * into v_job from hod_needing(p_world, c.work_x, c.work_y, 0, c.carrying->>'def');
$o$, $n$    select * into v_job from hod_needing(p_world, c.work_x, c.work_y, 0, c.carrying->>'def', c.keeper);
$n$),
    ('errand_do', $o$      if (select h.item from hod_needing(p_world, v_job.x, v_job.y, work_range(c), c.carrying->>'def') h) is not null then
$o$, $n$      if (select h.item from hod_needing(p_world, v_job.x, v_job.y, work_range(c), c.carrying->>'def', c.keeper) h) is not null then
$n$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    v_n := (length(v) - length(replace(v, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the line to change, not 1', r.fn, v_n; end if;
    execute replace(v, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
