/*
 * Free roofing: a roof on any tile of a building, at the height of the tile's own top storey.
 *
 * Reported on the Southern Greenhouse, a building of two storeys with storey 2 over part of its footprint and a
 * single-storey tier over the rest: "bug: story 2 is enclosed, but cant roof because i want to tier my building",
 * then "allow free roofing". A roof sat at `building.levels` and nowhere else (`floor_level` for a roof), and was
 * refused until the top storey was closed in all round (`level_gap`): storey 2 is open to the tier on its south side,
 * so "Storey 2 not enclosed: 7 sides with no wall or columns", and the tier could never be roofed under storey 2's
 * eaves at all.
 *
 * Now:
 *
 *   * No storey has to be closed in for a roof. `level_gap` stays for a second storey over the ground storey
 *     (`add_floor`) and for a cellar dug under a building (`cellar_dig_reason`), and is asked of a roof nowhere.
 *   * A roof's level is the tile's own (`roof_level`): over the storey the job names, when it names one of the
 *     building's (a pinned storey's menu writes it in); else over the roof already on the tile; else over the
 *     tile's top storey (`roof_storey_at`): the highest storey with a floor on the tile, or with a wall on a side
 *     of it whose other side has no floor of that storey; storey 1 when there is none. A tile out past the
 *     footprint (a jetty) is roofed over the top storey, as before.
 *
 *     The wall half is for a tile with no floor of its own walled round on that storey: an open well, or a tile
 *     whose floor was taken up, which is roofed with its storey. A wall on a border with a floored tile of the
 *     same storey is that tile's, not this one's: the outside wall of storey 2 over a tier is storey 2's, and the
 *     tier is roofed over storey 1, under it.
 *   * One roof a tile. Refused: a roof where one is ("Roof already planned here."), or at another storey
 *     ("Roof already planned here, over storey N."), and a roof under a floor or a wall of a higher storey of the
 *     tile ("Under storey N on this tile."), which would be inside the building (`roof_plan_refusal`).
 *   * And the other way round, a tile at a time: a floor, a staircase or a ladder of a storey on a tile with a roof
 *     at its floor or under it, and a wall on a roof that is not a terrace's railing: "Remove the roof first." A
 *     storey is added while any tile of the footprint has no roof at all and no jetty is roofed
 *     (`add_floor`); the top storey taken off once nothing roofs it (`has_roof`, the roof over the top storey),
 *     a roof of a lower tier under it staying as it is.
 *   * A tile is covered by anything finished on any storey over it, not only on the one right over it
 *     (`covered_at`): a room under a roof over an open well is indoors, and decays at `indoors_decay`.
 *
 * Every roof job finds its roof by the same rule (`floor_level` for a roof, `frame_floor_level`, `work_kind`): plan,
 * build and remove, a plan over the whole roof, glass among them. No row is moved: every roof there is stays at its
 * level, which is the top storey's.
 *
 * The browser's half: `Buildings.roofStoreyAt`, `roofLevelFor`, `roofPlanRefusal` (`building.ts`), and
 * `supabase/test/freeroof.ts` holds the two to each other.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

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

/* ---- The storey a tile's roof sits over ---- */

-- The tile's top storey (0 for storey 1): the highest with a floor on the tile, or a wall on a side of it whose other
-- side has no floor of that storey. Out past the footprint, the building's top storey (`Buildings.roofStoreyAt`).
create or replace function roof_storey_at(p_world uuid, p_building integer, p_x integer, p_y integer) returns integer
language sql stable as $fn$
  select case when building_at(p_world, p_x, p_y) is distinct from b.id then b.levels - 1
    else least(b.levels - 1, greatest(0,
      coalesce((select max(f.level) from floor_tile f
                 where f.world_id = p_world and f.x = p_x and f.y = p_y and f.level >= 1
                   and f.kind <> 'roof' and f.building = b.id), 0),
      coalesce((select max(w.level) from (values ('n'), ('e'), ('s'), ('w')) s(side)
                  cross join lateral border_of(p_x, p_y, s.side) bd
                  cross join lateral across(p_x, p_y, s.side) a
                  join wall w on w.world_id = p_world and w.level >= 1 and w.dir = bd.dir and w.x = bd.x and w.y = bd.y
                 where w.building = b.id
                   and not exists (select 1 from floor_tile q where q.world_id = p_world and q.level = w.level
                                     and q.x = a.x and q.y = a.y and q.kind <> 'roof')), 0))) end
    from building b where b.world_id = p_world and b.id = p_building
$fn$;

-- The level a roof job's roof is at (`Buildings.roofLevelFor`): over the storey the job names, of the building's; else
-- the roof on the tile; else over the tile's top storey. Out past the footprint, over the top storey.
create or replace function roof_level(p_world uuid, p_building integer, p_target jsonb) returns integer
language sql stable as $fn$
  select case
    when building_at(p_world, t.x, t.y) is distinct from b.id then b.levels
    when jsonb_typeof(p_target->'level') = 'number'
         and (p_target->>'level')::numeric = trunc((p_target->>'level')::numeric)
         and (p_target->>'level')::numeric between 0 and b.levels - 1
      then (p_target->>'level')::int + 1
    else coalesce((select max(f.level) from floor_tile f
                    where f.world_id = p_world and f.x = t.x and f.y = t.y and f.kind = 'roof' and f.level >= 1),
                  roof_storey_at(p_world, b.id, t.x, t.y) + 1) end
    from building b
    cross join lateral (select floor((p_target->>'x')::numeric)::int as x, floor((p_target->>'y')::numeric)::int as y) t
   where b.world_id = p_world and b.id = p_building
$fn$;

-- Why a roof is not planned at `p_level` on a tile (`Buildings.roofPlanRefusal`): one roof a tile, none under a storey of it.
create or replace function roof_plan_refusal(p_world uuid, p_building integer, p_level integer, p_x integer, p_y integer) returns text
language sql stable as $fn$
  select case
    when exists (select 1 from floor_tile f where f.world_id = p_world and f.level = p_level and f.x = p_x and f.y = p_y
                   and f.kind = 'roof') then 'Roof already planned here.'
    when r.level is not null then 'Roof already planned here, over storey ' || r.level || '.'
    when s.top >= p_level then 'Under storey ' || (s.top + 1) || ' on this tile.'
  end
  from (select max(f.level) as level from floor_tile f
         where f.world_id = p_world and f.x = p_x and f.y = p_y and f.kind = 'roof' and f.level >= 1) r
  cross join (select roof_storey_at(p_world, p_building, p_x, p_y) as top) s
$fn$;

-- The roof job's level, wherever a floor job's is asked (`frame_floor_level`, `build_job_tool`, `plan_still_mine`).
create or replace function floor_level(p_world uuid, p_building integer, p_kind text, p_target jsonb) returns integer
language sql stable as $fn$
  select case when p_kind = 'roof' then roof_level(p_world, p_building, p_target)
              when coalesce((p_target->>'down')::boolean, false) then 0
              else floor_level(p_world, p_building, p_kind) end
$fn$;

-- A builder's trade for a roof is its own roof's material, wherever it sits.
select pg_temp.patch_fn('work_kind(uuid, text, jsonb)',
  $o$and f.level = floor_level(p_world, v_building, coalesce(p_target->>'floorKind', 'floor'));$o$,
  $n$and f.level = frame_floor_level(p_world, v_building, coalesce(p_target->>'floorKind', 'floor'), p_target);$n$);

-- The roof over the top storey: what is taken off before the top storey is.
create or replace function has_roof(p_world uuid, p_building integer) returns boolean
language sql stable as $fn$
  select exists (select 1 from floor_tile f join building b on b.world_id = f.world_id and b.id = f.building
                  where f.world_id = p_world and f.building = p_building and f.kind = 'roof' and f.level = b.levels)
$fn$;

-- Covered: anything finished on a storey over it, not only on the one right over it.
create or replace function covered_at(p_world uuid, p_level integer, p_x integer, p_y integer) returns boolean
language sql stable as $fn$
  select exists (select 1 from floor_tile f
                  where f.world_id = p_world and f.level = p_level + 1
                    and f.x = p_x and f.y = p_y and bill_done(f.needed))
      or exists (select 1 from generate_series(p_level + 2,
                   coalesce((select b.levels from building b where b.world_id = p_world and b.id = building_at(p_world, p_x, p_y)), 0)) l
                   join floor_tile f on f.world_id = p_world and f.level = l and f.x = p_x and f.y = p_y
                  where bill_done(f.needed))
$fn$;

/* ---- Planning a roof, and what a roof stops ---- */

-- A roof: no storey closed in, one roof a tile, none inside the building.
select pg_temp.patch_fn('build_refusal(uuid, uuid, text, jsonb)',
  $o$    if kind = 'roof' then
      v_gap := level_gap(p_world, b.id, b.levels - 1, p_uid);
      if v_gap is not null then return v_gap; end if;$o$,
  $n$    if kind = 'roof' then
      -- Free roofing: on any tile, over its own top storey or the one the job names (`roof_plan_refusal`).
      v_gap := roof_plan_refusal(p_world, b.id, lvl, tx, ty);
      if v_gap is not null then return v_gap; end if;$n$);

-- A floor, a staircase or a ladder of a storey on a tile roofed at its floor or under it.
select pg_temp.patch_fn('build_refusal(uuid, uuid, text, jsonb)',
  $o$    -- cellar: a flight or a ladder down takes up the ground floor's flooring where it goes (`flooringUnder`).
    if exists (select 1 from floor_tile f2$o$,
  $n$    -- Free roofing: a storey goes up on a tile only once the roof under it there is off.
    if kind <> 'roof' and lvl >= 1 and exists (select 1 from floor_tile r where r.world_id = p_world and r.x = tx and r.y = ty
                                                 and r.kind = 'roof' and r.level between 1 and lvl) then
      return 'Remove the roof first.';
    end if;
    -- cellar: a flight or a ladder down takes up the ground floor's flooring where it goes (`flooringUnder`).
    if exists (select 1 from floor_tile f2$n$);

-- A wall on a roof: a terrace's railing and nothing else.
select pg_temp.patch_fn('build_refusal(uuid, uuid, text, jsonb)',
  $o$      if not found or not bill_done(f.needed) then return 'Build this storey''s floor first.'; end if;$o$,
  $n$      if not found or not bill_done(f.needed) then return 'Build this storey''s floor first.'; end if;
      if f.kind = 'roof' and not coalesce((p_target->>'terrace')::boolean, false) then return 'Remove the roof first.'; end if;$n$);

-- A storey more: refused only while every tile of the footprint is roofed, at whatever height, or a jetty is.
select pg_temp.patch_fn('build_refusal(uuid, uuid, text, jsonb)',
  $o$    if has_roof(p_world, b.id) then return 'Remove the roof first.'; end if;
    if has_low_wall($o$,
  $n$    if exists (select 1 from floor_tile rf where rf.world_id = p_world and rf.building = b.id and rf.kind = 'roof'
                 and rf.level = b.levels and building_at(p_world, rf.x, rf.y) is distinct from b.id)
       or not exists (select 1 from building_tile bt where bt.world_id = p_world and bt.building = b.id
                        and not exists (select 1 from floor_tile rf where rf.world_id = p_world and rf.level >= 1
                                          and rf.x = bt.x and rf.y = bt.y and rf.kind = 'roof')) then
      return 'Remove the roof first.';
    end if;
    if has_low_wall($n$);

-- The top storey off: its floors, a lower tier's roof at its floor's level staying.
select pg_temp.patch_fn('build_refusal(uuid, uuid, text, jsonb)',
  $o$    if exists (select 1 from floor_tile where world_id = p_world and building = b.id and level = lvl) then$o$,
  $n$    if exists (select 1 from floor_tile where world_id = p_world and building = b.id and level = lvl and floor_tile.kind <> 'roof') then$n$);
select pg_temp.patch_fn('frame_refusal(uuid, uuid, text, jsonb, building)',
  $o$       or exists (select 1 from floor_tile where world_id = p_world and building = p_b.id and level = p_b.levels - 1) then$o$,
  $n$       or exists (select 1 from floor_tile where world_id = p_world and building = p_b.id and level = p_b.levels - 1
                    and floor_tile.kind <> 'roof') then$n$);

select private.lock_doors();
