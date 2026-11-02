-- A worker looks for room, and for its stations, on its own ground only.
--
-- Asked for: "streamline cpu". `worker_store`, which says where a worker takes a load, asked the room of every piece of
-- furniture and every crate on the island (`furniture_holds`, `furniture_refuses`, `furniture_room`, `crate_units`:
-- a millisecond a piece) and only then whether it stood on the worker's settlement. On an island built like the live
-- one (supabase/test/bench-stir.ts: fifteen hundred pieces of other people's furniture and two hundred crates about it)
-- that was 860 ms a call, and a worker catching up on its day asks it once a load: the rounds of nine to forty-seven
-- seconds the live island has had are the shape of that.
--
-- The same pieces are asked the same questions now, but only those inside the square of the settlement (or the post)
-- the old test already demanded, read off the `placed_near` and `crate_near` indexes; the old test is kept as it was
-- on top. The workers' stations (`cook_target`, `station_target` and the rest) and the stores a worker eats out of
-- (`worker_feed`) are found the same way: inside the square of its range round its settlement, which they already
-- demanded, before anything is asked of a piece.

set local lock_timeout = '3s';

create or replace function public.worker_store(p_world uuid, c creature, p_def text, p_count integer)
 returns table(kind text, id bigint, cx double precision, cy double precision)
 language plpgsql
 stable
as $function$
declare v_site record; v_d deed;
begin
  /*
   * A purpose-built bin takes the load first, when the load is what it was
   * built for.
   *
   * Asked for: "molas should prioritize storing into raw material bins." A
   * bin holds four hundred where a crate holds a fraction of that, and it
   * takes nothing a bench has touched -- so it is the one store built for
   * exactly what a worker brings home by the cartload, and it was competing
   * for the job on distance alone. Worse, a worker that filled the deed crate
   * with ore left nowhere for the things only a crate will hold.
   *
   * Only ahead of the ordering that was already here: nearest bin first, and
   * failing a bin the same deed crate and the same nearest store as before.
   *
   * The load is never tested against the bin here. Anything in this list has
   * already been through `furniture_refuses`, so a bin in it is the bin built
   * for exactly this thing -- which is how the craft material bin, and then
   * the larder, the seed bin and the sprout bin, joined the rule without a
   * clause each: `fd.takes is not null` is the whole of it.
   *
   * Only the pieces inside the square the test below demands are asked
   * anything: the room of a piece is a millisecond, and the island has
   * thousands of pieces on nobody's settlement (`box`, `crates`).
   */
  select * into v_site from work_site(p_world, c);
  if v_site.x is null then return; end if;
  -- Beside the post first, when it is working off one.
  if v_site.post is not null then
    return query
    with crates as materialized (
      select cr from crate cr
       where cr.world_id = p_world
         and cr.x between v_site.x - v_site.radius - 1 and v_site.x + v_site.radius + 1
         and cr.y between v_site.y - v_site.radius - 1 and v_site.y + v_site.radius + 1
       order by cr.ctid),
    box as materialized (
      select p from placed p
       where p.world_id = p_world and p.kind = 'furniture'
         and p.x between v_site.x - v_site.radius - 1 and v_site.x + v_site.radius + 1
         and p.y between v_site.y - v_site.radius - 1 and v_site.y + v_site.radius + 1
       order by p.ctid),
    room as (
      select 'crate'::text as kind, (k.cr).id::bigint as id, crate_centre_x(k.cr) as cx, crate_centre_y(k.cr) as cy,
             false as bin
      from crates k
      where abs((k.cr).x + 0.5 - v_site.x) <= v_site.radius and abs((k.cr).y + 0.5 - v_site.y) <= v_site.radius
        and crate_units(p_world, (k.cr).id) + p_count <= crate_capacity(k.cr)
        and ((k.cr).level <= 0 or storey_reached(p_world, (k.cr).x, (k.cr).y, (k.cr).level))
      union all
      select 'furniture', (b.p).id, (b.p).x + 0.5, (b.p).y + 0.5, fd.takes is not null
      from box b join furniture_def fd on fd.id = (b.p).sub
      where abs((b.p).x + 0.5 - v_site.x) <= v_site.radius and abs((b.p).y + 0.5 - v_site.y) <= v_site.radius
        and furniture_holds(b.p) and furniture_refuses(b.p, p_def) is null
        and p_count <= furniture_room(b.p, p_def) and ((b.p).level <= 0 or storey_reached(p_world, (b.p).x, (b.p).y, (b.p).level)))
    select r.kind, r.id, r.cx, r.cy from room r
    order by r.bin desc, (r.cx - creature_x(c)) ^ 2 + (r.cy - creature_y(c)) ^ 2
    limit 1;
    if found then return; end if;
  end if;
  -- Then home: the settlement's own crate while it has room, and the nearest
  -- thing on the deed that will take it after.
  select * into v_d from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if v_d.world_id is null then return; end if;
  return query
  with crates as materialized (
    select cr from crate cr
     where cr.world_id = p_world
       and cr.x between v_d.x - v_d.radius and v_d.x + v_d.radius
       and cr.y between v_d.y - v_d.radius and v_d.y + v_d.radius
     order by cr.ctid),
  box as materialized (
    select p from placed p
     where p.world_id = p_world and p.kind = 'furniture'
       and p.x between v_d.x - v_d.radius and v_d.x + v_d.radius
       and p.y between v_d.y - v_d.radius and v_d.y + v_d.radius
     order by p.ctid),
  room as (
    select 'crate'::text as kind, (k.cr).id::bigint as id, crate_centre_x(k.cr) as cx, crate_centre_y(k.cr) as cy,
           (k.cr).deed as own, false as bin
    from crates k
    where abs((k.cr).x - v_d.x) <= v_d.radius and abs((k.cr).y - v_d.y) <= v_d.radius
      and crate_units(p_world, (k.cr).id) + p_count <= crate_capacity(k.cr)
      and ((k.cr).level <= 0 or storey_reached(p_world, (k.cr).x, (k.cr).y, (k.cr).level))
    union all
    select 'furniture', (b.p).id, (b.p).x + 0.5, (b.p).y + 0.5, false, fd.takes is not null
    from box b join furniture_def fd on fd.id = (b.p).sub
    where abs((b.p).x - v_d.x) <= v_d.radius and abs((b.p).y - v_d.y) <= v_d.radius
      and furniture_holds(b.p) and furniture_refuses(b.p, p_def) is null
      and p_count <= furniture_room(b.p, p_def) and ((b.p).level <= 0 or storey_reached(p_world, (b.p).x, (b.p).y, (b.p).level)))
  select r.kind, r.id, r.cx, r.cy from room r
  order by r.bin desc, r.own desc,
           (r.cx - creature_x(c)) ^ 2 + (r.cy - creature_y(c)) ^ 2
  limit 1;
end $function$;

/*
 * The stations: inside the square of its range round its settlement, which every one of them already demanded, read
 * off `placed_near` before anything is asked of a piece (`is_oven`, `placed_lit`, `lamp_kind` and the rest).
 */
do $do$
declare v_fn text; v_def text; v_n int;
  v_old text := $$and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed$$;
  v_new text := $$and p.x between dd.x - work_range(c) and dd.x + work_range(c) and p.y between dd.y - work_range(c) and dd.y + work_range(c)
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed$$;
begin
  foreach v_fn in array array['anvil_target', 'ash_target', 'brew_target', 'cook_target', 'furnace_target', 'glass_target',
                              'lamp_target', 'planter_target', 'press_target', 'station_target', 'vine_target'] loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = v_fn;
    if v_def is null then raise exception 'public.% is not on this island', v_fn; end if;
    v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_n <> 1 then raise exception 'public.% has % of the lines to change, not 1', v_fn, v_n; end if;
    execute replace(v_def, v_old, v_new);
  end loop;
end $do$;

/*
 * And what a worker eats: the stores of its settlement, or of the post it works, inside that square before anything
 * else is asked of them.
 */
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'worker_feed',
     $$       where k.world_id = p_world
         and case when v_post is not null$$,
     $$       where k.world_id = p_world
         and case when v_post is not null then k.x between v_px - v_pr and v_px + v_pr and k.y between v_py - v_pr and v_py + v_pr
                  else k.x between v_deed.x - v_deed.radius and v_deed.x + v_deed.radius
                   and k.y between v_deed.y - v_deed.radius and v_deed.y + v_deed.radius end
         and case when v_post is not null$$),
    ('public', 'worker_feed',
     $$       where p.world_id = p_world and p.kind = 'furniture'
         and coalesce(fd.capacity, 0) > 0$$,
     $$       where p.world_id = p_world and p.kind = 'furniture'
         and case when v_post is not null then p.x between v_px - v_pr and v_px + v_pr and p.y between v_py - v_pr and v_py + v_pr
                  else p.x between v_deed.x - v_deed.radius and v_deed.x + v_deed.radius
                   and p.y between v_deed.y - v_deed.radius and v_deed.y + v_deed.radius end
         and coalesce(fd.capacity, 0) > 0$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
