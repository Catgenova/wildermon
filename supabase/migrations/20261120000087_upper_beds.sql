/*
 * A garden bed up a storey is sown, tended and harvested as one on the ground is.
 *
 * Reported from the island, on the storey-2 garden beds of a greenhouse: "unable to sow on second floor". Two causes:
 *
 *   * a crop was kept by its tile (`crop_pkey` on world, x, y), so a tile had one crop whatever storey it grew on, and
 *     a bed on storey 2 over a bed or a field with a crop in it was refused, "one crop per tile" (`bed_one_crop_said`).
 *     A crop is kept by its tile and its storey now (`crop.storey`, its bed's storey, the ground's for a field), so
 *     each storey of a tile has a crop of its own, and a job finds the one on the storey it is for;
 *   * a job on a bed was aimed at the storey its doer stands on, and only that one: a storey-2 bed picked from the
 *     ground with storey 2 pinned had no Sow on it, and a job asked for it was taken for the field under it, "Needs a
 *     tilled field". A job names its bed's storey now (`level` on its target, the browser's `gardenbed.ts`), the
 *     browser walks its doer up to it first, and one asked from another storey is refused in so many words
 *     (`bed_storey_said`).
 *
 * A bed's crop keeps its own clock per storey as it did: the glass clock while the bed is open to the sky or under a
 * glass roof, the still clock while anything else covers it (`bed_resync`), now for each storey's crop of a tile.
 * Farm workers take a tile's storeys from the ground up: the lowest crop they reach with work on it, else an empty
 * field or an empty open bed they reach (`farm_work_level`).
 *
 * No row is moved: every crop there is keeps its tile and its storey, which it already had in `crop.level`.
 *
 * The browser's half is `src/game/gardenbed.ts`, and `supabase/test/upperbed.ts` holds the two to each other.
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

/* ---- A crop by its tile and its storey ---- */
alter table crop add column if not exists storey integer generated always as (coalesce(level, 0)) stored;
alter table crop drop constraint if exists crop_pkey;
alter table crop add constraint crop_pkey primary key (world_id, x, y, storey);

-- Why a job on a bed of one storey is refused from another: a bed is worked from its own storey (`bedStoreySaid`).
create or replace function bed_storey_said(p_level int) returns text language sql immutable as $fn$
  select 'Garden bed on storey ' || (p_level + 1) || ': stand on storey ' || (p_level + 1) || '.'
$fn$;

-- The storey a job's target names, when it names one: a pinned storey's menu writes it in (`jobFarmLevel`).
create or replace function farm_named_level(p_target jsonb) returns int language sql immutable as $fn$
  select case when jsonb_typeof(p_target->'level') = 'number' and (p_target->>'level')::numeric >= 0
              then (p_target->>'level')::numeric::int end
$fn$;

/*
 * Why a tile is not sown, as a garden bed of a storey or as a field (a null storey): the bed covered, or a crop growing
 * on that storey of the tile. One per storey: a ground-floor bed and the field it would lie on are the same storey.
 */
create or replace function bed_sow_refusal(p_world uuid, p_x int, p_y int, p_level int) returns text
language plpgsql stable as $fn$
declare c crop;
begin
  if p_level is not null and not bed_open(p_world, p_level, p_x, p_y) then return bed_covered_said(); end if;
  select * into c from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.storey = coalesce(p_level, 0);
  if c.id is null then return null; end if;
  return case when c.level is not distinct from p_level then 'Already growing a crop.' else bed_one_crop_said() end;
end $fn$;

-- An empty field on the ground, or an open bed of the storey a patch job is for, with nothing growing on that storey of it.
create or replace function patch_sowable(p_world uuid, p_level int, p_x int, p_y int) returns boolean
language sql stable as $fn$
  select in_bounds(p_world, p_x, p_y)
     and not exists (select 1 from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.storey = p_level)
     and ((bed_at(p_world, p_level, p_x, p_y) and bed_open(p_world, p_level, p_x, p_y))
          or (p_level = 0 and land_tile(p_world, p_x, p_y) = tile_id('Field')))
$fn$;

-- Tending and reaping the crop on one storey of a tile: its bed's storey, or null for the field.
drop function if exists tend_one(uuid, uuid, int, int, double precision);
create or replace function tend_one(p_world uuid, p_uid uuid, p_x int, p_y int, p_skill double precision, p_level int default null)
returns void language sql as $fn$
  update crop cr set tended_now = true, tended = cr.tended + 1,
    ql = (cr.ql * (cr.tended + 1) + product_ql(p_skill, 0)) / (cr.tended + 2)
  where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.level is not distinct from p_level
$fn$;

drop function if exists reap_one(uuid, uuid, int, int, double precision);
create or replace function reap_one(p_world uuid, p_uid uuid, p_x int, p_y int, p_skill double precision, p_level int default null,
  out o_produce text, out o_got int, out o_seed text, out o_seeds int, out o_ql double precision, out o_rare text)
returns record language plpgsql as $fn$
declare c crop; r record;
begin
  select * into c from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.level is not distinct from p_level;
  if c.id is null then return; end if;
  -- Compost spread on it (`decor.ts`).
  perform set_config('wildermon.reap_boost', case when c.fed then compost_boost()::text else '' end, true);
  select * into r from reap_what(p_world, p_uid, c.id, c.tended, c.ql, p_skill);
  perform set_config('wildermon.reap_boost', '', true);
  o_produce := r.o_produce; o_got := r.o_got; o_seed := r.o_seed; o_seeds := r.o_seeds; o_ql := r.o_ql; o_rare := r.o_rare;
  if c.glass then perform journal_note(p_world, p_uid, 'harvest:glass'); end if;
  perform journal_note(p_world, p_uid, 'harvest:' || r.o_produce);
  delete from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.storey = c.storey;
  perform land_announce(p_world, p_x, p_y);
end $fn$;

-- A sowing replaces nothing on another storey of the tile: one crop a storey.
select pg_temp.patch_fn('sow_one(uuid, uuid, integer, integer, bigint, integer)',
  $o$  on conflict (world_id, x, y) do update$o$,
  $n$  on conflict (world_id, x, y, storey) do update$n$);

/*
 * The crops of a tile put right by their garden beds, each storey's on its own: taken up with its bed when the bed is
 * gone, unfinished or relaid in anything else; carried onto the still clock when its bed is covered, and back onto the
 * glass clock when it is uncovered. A crop in a field is left alone.
 */
create or replace function bed_resync(p_world uuid, p_x int, p_y int) returns void
language plpgsql as $fn$
declare c crop; v_open boolean; v_settled boolean := false;
begin
  for c in select * from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.level is not null loop
    if not bed_at(p_world, c.level, p_x, p_y) then
      delete from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.storey = c.storey;
      perform land_announce(p_world, p_x, p_y);
      continue;
    end if;
    v_open := bed_open(p_world, c.level, p_x, p_y);
    continue when v_open = not c.still;
    if not v_open then
      if not v_settled then perform crop_settle(p_world, p_x, p_y); v_settled := true; end if;
      update crop cr set still = true, stage_at = crop_rebased(cr.stage_at, 'glass', 'still')
       where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.storey = c.storey;
    else
      update crop cr set still = false, glass = true, stage_at = crop_rebased(cr.stage_at, 'still', 'glass')
       where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.storey = c.storey;
    end if;
    perform land_announce(p_world, p_x, p_y);
  end loop;
end $fn$;

-- Settling a box of crops: each storey's of a tile by its own row.
select pg_temp.patch_fn('crops_settle(uuid, double precision, double precision, double precision)',
  $o$    select c.x, c.y, c.stage, c.stage_at, c.glass, c.hand,$o$,
  $n$    select c.x, c.y, c.storey, c.stage, c.stage_at, c.glass, c.hand,$n$);
select pg_temp.patch_fn('crops_settle(uuid, double precision, double precision, double precision)',
  $o$    select n.x, n.y, s.o_stage, s.o_stage_at, s.o_steps$o$,
  $n$    select n.x, n.y, n.storey, s.o_stage, s.o_stage_at, s.o_steps$n$, 3);
select pg_temp.patch_fn('crops_settle(uuid, double precision, double precision, double precision)',
  $o$   where c.world_id = p_world and c.x = due.x and c.y = due.y and due.o_steps > 0;$o$,
  $n$   where c.world_id = p_world and c.x = due.x and c.y = due.y and c.storey = due.storey and due.o_steps > 0;$n$);

/* ---- The refusals: the storey a job names, and the crop on the storey it is for ---- */
select pg_temp.patch_fn('farm_refusal(uuid, uuid, text, jsonb)',
  $o$  perform crop_settle(p_world, tx, ty);
  select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
  -- The garden bed of the storey you stand on (`bed_level_of`), or the field; a crop on another storey is none of this job's.
  v_lvl := farm_level(p_world, p_uid);
  v_bed := bed_level_of(p_world, p_uid, tx, ty);
  if c.id is not null and c.level is distinct from v_bed and p_action <> 'plant_seed' then c := null; end if;
$o$,
  $n$  perform crop_settle(p_world, tx, ty);
  -- The garden bed of the storey you stand on (`bed_level_of`), or the field; a crop on another storey is none of this job's.
  v_lvl := farm_level(p_world, p_uid);
  -- A job naming a garden bed's storey is done from that storey (`bedStoreySaid`): the browser walks there first.
  if farm_named_level(p_target) is not null and farm_named_level(p_target) <> v_lvl
     and bed_at(p_world, farm_named_level(p_target), tx, ty) then
    return bed_storey_said(farm_named_level(p_target));
  end if;
  v_bed := bed_level_of(p_world, p_uid, tx, ty);
  select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty and cr.level is not distinct from v_bed;
$n$);

/* ---- The jobs: the crop on the storey a job is for, and no other ---- */
select pg_temp.patch_fn('perform_farm(uuid, uuid, text, jsonb)',
  $o$  perform crop_settle(p_world, tx, ty);
  select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
  -- The garden bed of the storey you stand on (`bed_level_of`), or the field; a crop on another storey is none of this job's.
  v_lvl := farm_level(p_world, p_uid);
  v_bed := bed_level_of(p_world, p_uid, tx, ty);
  if c.id is not null and c.level is distinct from v_bed then c := null; end if;
$o$,
  $n$  perform crop_settle(p_world, tx, ty);
  -- The garden bed of the storey you stand on (`bed_level_of`), or the field; a crop on another storey is none of this job's.
  v_lvl := farm_level(p_world, p_uid);
  v_bed := bed_level_of(p_world, p_uid, tx, ty);
  select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty and cr.level is not distinct from v_bed;
$n$);
select pg_temp.patch_fn('perform_farm(uuid, uuid, text, jsonb)',
  $o$    select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
$o$,
  $n$    select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty and cr.level is not distinct from v_bed;
$n$, 2);
select pg_temp.patch_fn('perform_farm(uuid, uuid, text, jsonb)',
  $o$    perform tend_one(p_world, p_uid, tx, ty, s);$o$,
  $n$    perform tend_one(p_world, p_uid, tx, ty, s, v_bed);$n$);
select pg_temp.patch_fn('perform_farm(uuid, uuid, text, jsonb)',
  $o$    select * into r from reap_one(p_world, p_uid, tx, ty, s);$o$,
  $n$    select * into r from reap_one(p_world, p_uid, tx, ty, s, v_bed);$n$);
select pg_temp.patch_fn('perform_farm(uuid, uuid, text, jsonb)',
  $o$      delete from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;$o$,
  $n$      delete from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty and cr.level = v_bed;$n$);
-- A patch: each crop on the storey it is worked from, by its own storey.
select pg_temp.patch_fn('perform_farm(uuid, uuid, text, jsonb)',
  $o$    for v_row in select cr.x, cr.y from crop cr$o$,
  $n$    for v_row in select cr.x, cr.y, cr.level from crop cr$n$, 2);
select pg_temp.patch_fn('perform_farm(uuid, uuid, text, jsonb)',
  $o$      perform tend_one(p_world, p_uid, v_row.x, v_row.y, s);$o$,
  $n$      perform tend_one(p_world, p_uid, v_row.x, v_row.y, s, v_row.level);$n$);
select pg_temp.patch_fn('perform_farm(uuid, uuid, text, jsonb)',
  $o$      select * into r from reap_one(p_world, p_uid, v_row.x, v_row.y, s);$o$,
  $n$      select * into r from reap_one(p_world, p_uid, v_row.x, v_row.y, s, v_row.level);$n$);

/* ---- Farm workers: a tile's storeys from the ground up ---- */

-- The lowest open garden bed a worker reaches on a tile with nothing growing on it, to sow; null for none.
create or replace function worker_bed(p_world uuid, p_x int, p_y int) returns int
language sql stable as $fn$
  select f.level from floor_tile f
   where f.world_id = p_world and f.x = p_x and f.y = p_y
     and f.material = bed_material() and f.kind = 'floor' and bill_done(f.needed)
     and bed_open(p_world, f.level, p_x, p_y)
     and (f.level <= 0 or storey_reached(p_world, p_x, p_y, f.level))
     and not exists (select 1 from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.storey = f.level)
   order by f.level limit 1
$fn$;

/*
 * The storey a farm worker works a tile on: the lowest crop it reaches with work on it, to weed or reap; else an empty
 * field, or the lowest empty open bed it reaches, to sow; else the lowest crop it reaches, for the seed in the furrow.
 */
create or replace function farm_work_level(p_world uuid, p_x int, p_y int) returns int
language sql stable as $fn$
  select coalesce(
    (select cr.storey from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y
        and storey_reached(p_world, p_x, p_y, cr.storey) and (cr.stage >= crop_ripe() or not cr.tended_now)
      order by cr.storey limit 1),
    case when land_tile(p_world, p_x, p_y) = tile_id('Field')
          and not exists (select 1 from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y and cr.storey = 0) then 0 end,
    worker_bed(p_world, p_x, p_y),
    (select cr.storey from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y
        and storey_reached(p_world, p_x, p_y, cr.storey) order by cr.storey limit 1),
    0)
$fn$;

select pg_temp.patch_fn('worker_do(uuid, integer)',
  $o$        cr crop; yld int[]; depth double precision; v_seed item; v_cd crop_def; v_bed int;$o$,
  $n$        cr crop; yld int[]; depth double precision; v_seed item; v_cd crop_def; v_bed int; v_fl int;$n$);
select pg_temp.patch_fn('worker_do(uuid, integer)',
  $o$    perform crop_settle(p_world, wx, wy);
    select * into cr from crop where world_id = p_world and x = wx and y = wy;
    if not found then$o$,
  $n$    perform crop_settle(p_world, wx, wy);
    -- The storey of the tile it works (`farm_work_level`), and the crop on that storey.
    v_fl := farm_work_level(p_world, wx, wy);
    select * into cr from crop where world_id = p_world and x = wx and y = wy and storey = v_fl;
    if not found then$n$);
select pg_temp.patch_fn('worker_do(uuid, integer)',
  $o$      v_bed := case when land_tile(p_world, wx, wy) = tile_id('Field') then null else worker_bed(p_world, wx, wy) end;
      if land_tile(p_world, wx, wy) <> tile_id('Field') and v_bed is null then return null; end if;$o$,
  $n$      v_bed := case when v_fl = 0 and land_tile(p_world, wx, wy) = tile_id('Field') then null else worker_bed(p_world, wx, wy) end;
      if not (v_fl = 0 and land_tile(p_world, wx, wy) = tile_id('Field')) and v_bed is null then return null; end if;$n$);
select pg_temp.patch_fn('worker_do(uuid, integer)',
  $o$      on conflict (world_id, x, y) do update set id = v_cd.id,$o$,
  $n$      on conflict (world_id, x, y, storey) do update set id = v_cd.id,$n$);
select pg_temp.patch_fn('worker_do(uuid, integer)',
  $o$          where world_id = p_world and x = wx and y = wy;
        return null;$o$,
  $n$          where world_id = p_world and x = wx and y = wy and storey = cr.storey;
        return null;$n$);
select pg_temp.patch_fn('worker_do(uuid, integer)',
  $o$    delete from crop where world_id = p_world and x = wx and y = wy;$o$,
  $n$    delete from crop where world_id = p_world and x = wx and y = wy and storey = cr.storey;$n$);

select pg_temp.patch_fn('worker_gatherable(uuid, integer, integer, text, creature)',
  $o$    select * into v_crop from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
    -- On a bed up a storey, only by the stairs.
    if found and coalesce(v_crop.level, 0) > 0 and not storey_reached(p_world, p_x, p_y, v_crop.level) then return false; end if;
    if found and (v_crop.stage >= crop_ripe() or not v_crop.tended_now) then return true; end if;$o$,
  $n$    -- The crop on the storey it would work (`farm_work_level`): on a bed up a storey, only by the stairs.
    select * into v_crop from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y
      and cr.storey = farm_work_level(p_world, p_x, p_y) and storey_reached(p_world, p_x, p_y, cr.storey);
    if found and (v_crop.stage >= crop_ripe() or not v_crop.tended_now) then return true; end if;$n$);

-- The tiles with a crop on them, once each however many storeys of a tile have one.
select pg_temp.patch_fn('private.work_tile_may(uuid, integer, integer, integer, text, integer)',
  $o$    left join (select c.x, c.y from crop c$o$,
  $n$    left join (select distinct c.x, c.y from crop c$n$);

/*
 * Examine names what is laid on each storey of a building's tile by its material's name, as the line over the tile
 * does: " Storey 1: Plank floor. Storey 2: Garden bed floor." Finished floors, staircases and ladders; not the roof.
 * The browser's `floorsSaid`.
 */
create or replace function floors_said(p_world uuid, p_b building, p_x int, p_y int) returns text
language sql stable as $fn$
  select coalesce(string_agg(' Storey ' || (f.level + 1) || ': ' || upper(left(q.w, 1)) || substr(q.w, 2) || '.', '' order by f.level), '')
    from floor_tile f
    cross join lateral (select case when f.kind = 'ladder' then 'ladder'
                                    else lower(coalesce((select m.name from build_material_def m where m.id = f.material), replace(f.material, '_', ' ')))
                                         || ' ' || floor_name(f.kind, f.hand) end as w) q
   where f.world_id = p_world and f.x = p_x and f.y = p_y and f.building = p_b.id
     and f.level between 0 and p_b.levels - 1 and f.kind <> 'roof' and bill_done(f.needed)
$fn$;
select pg_temp.patch_fn('examine_tile_text(uuid, integer, integer, uuid)',
  $o$      v_extra := v_extra || pier_says(p_world, p_x, p_y);$o$,
  $n$      v_extra := v_extra || pier_says(p_world, p_x, p_y);
      -- And what is laid on each storey of it, by its material's name (`floors_said`).
      v_extra := v_extra || floors_said(p_world, b, p_x, p_y);$n$);

select private.lock_doors();
