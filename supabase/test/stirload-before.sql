-- The stir as it was before 20261101300001..300004, in a schema of its own (stir_old), for supabase/test/stirload.ts to
-- run the same island through both and find the same answers. Not a migration: the test makes the schema inside a
-- transaction it rolls back. Verbatim from pg_get_functiondef on the island before those migrations; the stations and
-- `worker_feed`, patched a line apiece, are put back by the test itself.

CREATE OR REPLACE FUNCTION stir_old.find_work_tile(p_world uuid, p_cx integer, p_cy integer, p_range integer, p_kind text, c creature)
 RETURNS TABLE(x integer, y integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare ring int; spot record;
begin
  for ring in 0..p_range loop
    for spot in
      select p_cx + dx as gx, p_cy + dy as gy
      from generate_series(-ring, ring) dx, generate_series(-ring, ring) dy
      where greatest(abs(dx), abs(dy)) = ring
      order by random()
    loop
      if worker_gatherable(p_world, spot.gx, spot.gy, p_kind, c) then
        x := spot.gx; y := spot.gy;
        return next;
        return;
      end if;
    end loop;
  end loop;
  return;
end $function$

;

CREATE OR REPLACE FUNCTION stir_old.worker_store(p_world uuid, c creature, p_def text, p_count integer)
 RETURNS TABLE(kind text, id bigint, cx double precision, cy double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_site record; v_own boolean;
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
   */
  select * into v_site from work_site(p_world, c);
  if v_site.x is null then return; end if;
  -- Beside the post first, when it is working off one.
  if v_site.post is not null then
    return query
    with room as (
      select 'crate'::text as kind, cr.id::bigint as id, crate_centre_x(cr) as cx, crate_centre_y(cr) as cy,
             false as bin
      from crate cr
      where cr.world_id = p_world
        and abs(cr.x + 0.5 - v_site.x) <= v_site.radius and abs(cr.y + 0.5 - v_site.y) <= v_site.radius
        and crate_units(p_world, cr.id) + p_count <= crate_capacity(cr) and (cr.level <= 0 or storey_reached(p_world, cr.x, cr.y, cr.level))
      union all
      select 'furniture', p.id, p.x + 0.5, p.y + 0.5, fd.takes is not null
      from placed p join furniture_def fd on fd.id = p.sub
      where p.world_id = p_world and p.kind = 'furniture'
        and abs(p.x + 0.5 - v_site.x) <= v_site.radius and abs(p.y + 0.5 - v_site.y) <= v_site.radius
        and furniture_holds(p) and furniture_refuses(p, p_def) is null
        and p_count <= furniture_room(p, p_def) and (p.level <= 0 or storey_reached(p_world, p.x, p.y, p.level)))
    select r.kind, r.id, r.cx, r.cy from room r
    order by r.bin desc, (r.cx - creature_x(c)) ^ 2 + (r.cy - creature_y(c)) ^ 2
    limit 1;
    if found then return; end if;
  end if;
  -- Then home: the settlement's own crate while it has room, and the nearest
  -- thing on the deed that will take it after.
  return query
  with mine as (select * from my_deed(p_world, c.keeper) md where md.world_id is not null),
  room as (
    select 'crate'::text as kind, cr.id::bigint as id, crate_centre_x(cr) as cx, crate_centre_y(cr) as cy,
           cr.deed as own, false as bin
    from crate cr, mine d
    where cr.world_id = p_world
      and abs(cr.x - d.x) <= d.radius and abs(cr.y - d.y) <= d.radius
      and crate_units(p_world, cr.id) + p_count <= crate_capacity(cr) and (cr.level <= 0 or storey_reached(p_world, cr.x, cr.y, cr.level))
    union all
    select 'furniture', p.id, p.x + 0.5, p.y + 0.5, false, fd.takes is not null
    from placed p join furniture_def fd on fd.id = p.sub, mine d
    where p.world_id = p_world and p.kind = 'furniture'
      and abs(p.x - d.x) <= d.radius and abs(p.y - d.y) <= d.radius
      and furniture_holds(p) and furniture_refuses(p, p_def) is null
      and p_count <= furniture_room(p, p_def) and (p.level <= 0 or storey_reached(p_world, p.x, p.y, p.level)))
  select r.kind, r.id, r.cx, r.cy from room r
  order by r.bin desc, r.own desc,
           (r.cx - creature_x(c)) ^ 2 + (r.cy - creature_y(c)) ^ 2
  limit 1;
end $function$

;

CREATE OR REPLACE FUNCTION stir_old.recipe_in_stores(p_world uuid, p_uid uuid, p_recipes text[])
 RETURNS TABLE(rid text, x integer, y integer, cx double precision, cy double precision)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare r recipe; v_at record; v_id text;
begin
  foreach v_id in array p_recipes loop
    select * into r from recipe where id = v_id;
    if r.id is null then continue; end if;
    if exists (select 1 from recipe_input ri where ri.recipe = r.id and case when ri.litres is not null then stores_litres(p_world, p_uid, ri.item) < ri.litres
                                                                            else stores_count(p_world, p_uid, ri.item) < ri.count end) then continue; end if;
    select s.x, s.y, s.cx, s.cy into v_at from deed_store_items(p_world, p_uid) s
     where (s.it).def = (select ri.item from recipe_input ri where ri.recipe = r.id order by ri.ord limit 1)
       and not coalesce((s.it).locked, false)
     order by s.kind, s.sid limit 1;
    if v_at.x is null then continue; end if;
    rid := r.id; x := v_at.x; y := v_at.y; cx := v_at.cx; cy := v_at.cy;
    return next;
    return;
  end loop;
end $function$

;

CREATE OR REPLACE FUNCTION stir_old.worker_sweep(p_world uuid, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare r record; n int := 0;
begin
  for r in
    select c.id from creature c
     cross join lateral work_site(p_world, c) s
     where c.world_id = p_world and c.mode = 'deed' and c.until <= now()
       and s.x is not null
       and greatest(abs(s.x + 0.5 - c.to_x), abs(s.y + 0.5 - c.to_y)) > s.radius + home_slack()
       and exists (select 1 from player p where p.world_id = p_world and p.uid = c.keeper and not p.away
                     and p.seen_at > now() - make_interval(secs => idle_logout()))
     order by c.until limit worker_sweep_most()
  loop
    exit when p_until is not null and clock_timestamp() > p_until;
    begin
      if creature_settle(p_world, r.id) then n := n + 1; end if;
    exception when lock_not_available then null; -- put all in: held; the next round's
    end;
  end loop;
  return n;
end $function$

;

CREATE OR REPLACE FUNCTION stir_old.creature_sweep(p_world uuid, p_x double precision, p_y double precision, p_range double precision DEFAULT 40, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone, p_slack double precision DEFAULT NULL::double precision, p_tame boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare r record; n int := 0; v_reach double precision := p_range + coalesce(p_slack, leg_slack());
begin
  for r in select id from creature
    where world_id = p_world
      and to_x between p_x - v_reach and p_x + v_reach
      and to_y between p_y - v_reach and p_y + v_reach
      and until <= now()
      and (not p_tame or mode <> 'wild')
    order by mode = 'wild', until limit 120
  loop
    exit when p_until is not null and clock_timestamp() > p_until;
    if creature_settle(p_world, r.id) then n := n + 1; end if;
  end loop;
  return n;
end $function$

;

