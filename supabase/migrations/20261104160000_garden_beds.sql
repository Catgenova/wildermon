-- Garden beds.
--
-- Asked: "Create a floor type called Garden Bed. It requires timber and iron ribbons and dirt. It functions like an
-- indoor tilled tile as long as there is no roof or a glass roof (glasshouse)".
--
-- A garden bed (`bed_material()`, written by the definitions with its bill and its `only`) is a floor and nothing
-- else (`material_only_refusal`), with the mallet, trained as carpentry, at timber's heft. Its bill is a solid wall's
-- worth, of which a floor takes its share (`floor_bill`): a tile is 4 timber, 2 iron metal ribbons and 6 dirt. Its
-- ribbons are iron ones: `build_material_bill.extra` names the make a bill item is taken in (an item's `extra`, a
-- ribbon's metal), and the pack, a crate on the site and the stores in reach are asked for that make and no other
-- (`next_material`, `take_material`, `build_to_hand`, `site_count_of`, `site_take_of`), and the bill says so
-- (`bill_text`: "2 metal ribbons (iron)"). A hod carrier fits a garden bed's timber and dirt and leaves its ribbons
-- to a builder (`hod_needed`): its errands carry a stored item by what it is, not by its make.
--
-- A finished garden bed is a field, on whatever storey it is laid: sown, tended, harvested and cleared by the same
-- jobs, Farmer's perks and patches, from the storey you stand on (`farm_level`, `bed_level_of`), and worked by a
-- settlement's farm workers on any storey a staircase reaches (`worker_bed`, `storey_reached`). What grows on it grows
-- on the glass clock in every season, winter included (`crop.glass`), while it is open to the sky or under glass
-- (`bed_open`): nothing finished over it on any storey above, or the nearest thing finished over it a roof of glass.
-- Covered, it is not sown (`bed_covered_said`) and what grows on it stands still: it goes onto the still clock, which
-- never runs, as far into its stage as it had grown (`crop.still`, `crop_rebased`, `still_at`), and back onto the
-- glass clock as far along when it is uncovered. Triggers on `floor_tile` do it (`bed_resync`), so no way of covering
-- or uncovering a bed misses it, and take the crop up with the bed when the bed is taken up or relaid in anything else.
--
-- A crop is kept by its tile (`crop_pkey`), so a tile has one crop whatever storey it is on: `crop.level` is the
-- storey of the bed it grows on, null in a field; a bed is not sown where a crop grows on another storey of the tile,
-- nor a field under a bed's crop (`bed_sow_refusal`, `bed_one_crop_said`). Every field and planter is as it was.
--
-- The browser's half is `src/game/gardenbed.ts`, and `supabase/test/gardenbed.ts` holds the two to each other.

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

alter table crop add column if not exists level integer;
alter table crop add column if not exists still boolean not null default false;
-- The make a bill item is taken in; the definitions write it (`MaterialDef.extra`).
alter table build_material_bill add column if not exists extra text;
-- What the definitions write, here until they do, so the functions below have them to call.
create or replace function bed_material() returns text language sql immutable as $fn$ select 'garden_bed' $fn$;
create or replace function bed_covered_said() returns text language sql immutable as $fn$ select 'Covered: garden beds need open sky or a glass roof.' $fn$;
create or replace function bed_one_crop_said() returns text language sql immutable as $fn$ select 'Crop on another storey of this tile: one crop per tile.' $fn$;
create or replace function bed_name() returns text language sql immutable as $fn$ select 'Garden bed' $fn$;
create or replace function bed_still_said() returns text language sql immutable as $fn$ select 'covered: no growth' $fn$;
create or replace function bed_no_deck_said() returns text language sql immutable as $fn$ select 'Garden bed: not a deck on piers.' $fn$;

/* ---- A bed's make of ribbon ------------------------------------------------------------------ */

/* The make a material takes a bill item in (an item's `extra`), or null for any: a garden bed's ribbons are iron. */
create or replace function bill_extra(p_material text, p_item text) returns text language sql stable as $fn$
  select b.extra from build_material_bill b where b.material = p_material and b.item = p_item
$fn$;

/* `site_count` of one make, or of any for a null one. */
create or replace function site_count_of(p_world uuid, p_x integer, p_y integer, p_item text, p_extra text) returns integer
language sql stable as $fn$
  select coalesce(sum(i.count), 0)::int
    from crate c
    join item i on i.world_id = c.world_id and i.holder = 'crate' and i.holder_uid is null
                and i.crate = c.id and i.def = p_item
   where c.world_id = p_world and c.x = p_x and c.y = p_y
     and (p_extra is null or i.extra is not distinct from p_extra)
$fn$;

/* `site_take` of one make, or of any for a null one. */
create or replace function site_take_of(p_world uuid, p_x integer, p_y integer, p_item text, p_extra text) returns boolean
language plpgsql as $fn$
declare v_id bigint;
begin
  select i.id into v_id
    from crate c
    join item i on i.world_id = c.world_id and i.holder = 'crate' and i.crate = c.id and i.def = p_item
   where c.world_id = p_world and c.x = p_x and c.y = p_y and i.count > 0
     and (p_extra is null or i.extra is not distinct from p_extra)
   order by i.ql, i.id limit 1;
  if v_id is null then return false; end if;
  update item set count = count - 1 where id = v_id and holder = 'crate' and count > 1;
  if found then return true; end if;
  delete from item where id = v_id and holder = 'crate' and count = 1;
  return found;
end $fn$;

/* Whether a stored item a Hod Carrier's reach finds is of the make, or any for a null one. */
create or replace function item_of_make(p_id bigint, p_extra text) returns boolean language sql stable as $fn$
  select p_extra is null or exists (select 1 from item i where i.id = p_id and i.extra is not distinct from p_extra)
$fn$;

select pg_temp.patch_fn('public.next_material(uuid,uuid,text,jsonb,integer,integer)'::regprocedure,
  $o$    and (pack_count(p_world, p_uid, e.key) > 0 or site_count(p_world, p_x, p_y, e.key) > 0
         -- And a Mason's Hod Carrier: the stores within its reach, for stone.
         or exists (select 1 from hod_stock(p_world, p_uid, e.key, build_reach(p_world, p_uid, p_material))))$o$,
  $n$    -- Of the make the material takes it in, where it takes one (`bill_extra`): a garden bed's iron ribbons.
    and (pack_count(p_world, p_uid, e.key, b.extra) > 0 or site_count_of(p_world, p_x, p_y, e.key, b.extra) > 0
         -- And a Mason's Hod Carrier: the stores within its reach, for stone.
         or exists (select 1 from hod_stock(p_world, p_uid, e.key, build_reach(p_world, p_uid, p_material)) h
                     where item_of_make(h.id, b.extra)))$n$);

select pg_temp.patch_fn('public.take_material(uuid,uuid,text,integer,integer,text)'::regprocedure,
  $o$declare v_id bigint; v_pane boolean := p_item = tinted_pane();
begin
  if pack_count(p_world, p_uid, p_item) > 0 then$o$,
  $n$declare v_id bigint; v_pane boolean := p_item = tinted_pane(); v_extra text := bill_extra(p_material, p_item);
begin
  -- Of the make the material takes it in, where it takes one (`bill_extra`): a garden bed's iron ribbons.
  if pack_count(p_world, p_uid, p_item, v_extra) > 0 then$n$);
select pg_temp.patch_fn('public.take_material(uuid,uuid,text,integer,integer,text)'::regprocedure,
  $o$    return consume(p_world, p_uid, p_item, 1);$o$,
  $n$    return consume(p_world, p_uid, p_item, 1, null, v_extra);$n$);
select pg_temp.patch_fn('public.take_material(uuid,uuid,text,integer,integer,text)'::regprocedure,
  $o$  if site_take(p_world, p_x, p_y, p_item) then return true; end if;
  select h.id into v_id from hod_stock(p_world, p_uid, p_item, build_reach(p_world, p_uid, p_material)) h
   order by h.draw limit 1;$o$,
  $n$  if site_take_of(p_world, p_x, p_y, p_item, v_extra) then return true; end if;
  select h.id into v_id from hod_stock(p_world, p_uid, p_item, build_reach(p_world, p_uid, p_material)) h
   where item_of_make(h.id, v_extra)
   order by h.draw limit 1;$n$);

CREATE OR REPLACE FUNCTION public.build_to_hand(p_world uuid, p_uid uuid, p_item text, p_x integer, p_y integer, p_material text)
 RETURNS integer
 LANGUAGE sql
 STABLE
AS $function$
  -- Of the make the material takes it in, where it takes one (`bill_extra`).
  select pack_count(p_world, p_uid, p_item, bill_extra(p_material, p_item))
       + site_count_of(p_world, p_x, p_y, p_item, bill_extra(p_material, p_item))
       + coalesce((select sum(h.count) from hod_stock(p_world, p_uid, p_item, build_reach(p_world, p_uid, p_material)) h
                    where item_of_make(h.id, bill_extra(p_material, p_item))), 0)::int
$function$;

-- And the bill says the make: "2 metal ribbons (iron)", as an item of it is named (the browser's `describeNeeds`).
select pg_temp.patch_fn('public.bill_text(text,jsonb)'::regprocedure,
  $o$(e.value::int) || ' ' || material_name(e.key, e.value::int) as part$o$,
  $n$(e.value::int) || ' ' || material_name(e.key, e.value::int) || coalesce(' (' || lower(b.extra) || ')', '') as part$n$);

-- Dirt is counted as mortar is: "6 dirt" (the browser's `materialName`).
select pg_temp.patch_fn('public.material_name(text,integer)'::regprocedure,
  $o$name in ('mortar', 'thatch', 'adobe')$o$,
  $n$name in ('mortar', 'thatch', 'adobe', 'dirt')$n$);

/* What a hod carrier fits of a floor's bill: all of it but what is taken in one make, which a builder lays. */
create or replace function hod_needed(p_material text, p_needed jsonb) returns jsonb language sql stable as $fn$
  select p_needed - coalesce((select array_agg(b.item) from build_material_bill b
                               where b.material = p_material and b.extra is not null), '{}'::text[])
$fn$;
select pg_temp.patch_fn('public.hod_work(uuid,integer,integer,integer)'::regprocedure,
  $o$  select 'floor', f.level, '', f.x, f.y, null, null, f.needed, f.total
    from floor_tile f
   where f.world_id = p_world
     and f.x between p_cx - p_range and p_cx + p_range and f.y between p_cy - p_range and p_cy + p_range
     and f.needed @? '$.* ? (@ > 0)'$o$,
  $n$  -- A garden bed's iron ribbons are a builder's to lay (`hod_needed`).
  select 'floor', f.level, '', f.x, f.y, null, null, hod_needed(f.material, f.needed), f.total
    from floor_tile f
   where f.world_id = p_world
     and f.x between p_cx - p_range and p_cx + p_range and f.y between p_cy - p_range and p_cy + p_range
     and hod_needed(f.material, f.needed) @? '$.* ? (@ > 0)'$n$);

-- A garden bed is joinery, and trains carpentry; any other floor paving.
select pg_temp.patch_fn('public.perform_building(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    sk := case f.kind when 'floor' then 'paving' when 'ladder' then 'carpentry'$o$,
  $n$    sk := case f.kind when 'floor' then case when f.material = bed_material() then coalesce(mat.skill, 'carpentry') else 'paving' end
                      when 'ladder' then 'carpentry'$n$);

-- A garden bed is no deck on piers: its piers would be soil (the browser's `BED_NO_DECK`).
select pg_temp.patch_fn('public.glass_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    return field_unfloored_said();
  end if;$o$,
  $n$    return field_unfloored_said();
  end if;
  if v_mat = bed_material() and v_kind = 'floor' and work_level(p_world, b.id) = 0
     and exists (select 1 from building_tile bt where bt.world_id = p_world and bt.x = tx and bt.y = ty and bt.pier) then
    return bed_no_deck_said();
  end if;$n$);

/* ---- A bed ----------------------------------------------------------------------------------- */

/* Whether a storey of a tile has a finished garden bed on it (the browser's `bedAt`). */
create or replace function bed_at(p_world uuid, p_level integer, p_x integer, p_y integer) returns boolean
language sql stable as $fn$
  select exists (select 1 from floor_tile f
                  where f.world_id = p_world and f.level = p_level and f.x = p_x and f.y = p_y
                    and f.material = bed_material() and f.kind = 'floor' and bill_done(f.needed))
$fn$;

/*
 * Whether a garden bed on a storey of a tile is open to the sky or under glass: nothing finished over it on any
 * storey above, or the nearest thing finished over it a roof of glass (the browser's `bedOpen`).
 */
create or replace function bed_open(p_world uuid, p_level integer, p_x integer, p_y integer) returns boolean
language sql stable as $fn$
  select coalesce((select f.kind = 'roof' and f.material = glass_material()
                     from floor_tile f
                    where f.world_id = p_world and f.x = p_x and f.y = p_y and f.level > p_level and bill_done(f.needed)
                    order by f.level limit 1), true)
$fn$;

/* The storey a farming job on a tile is worked from: the one you stand on, the ground floor from a cellar (`farmLevel`). */
create or replace function farm_level(p_world uuid, p_uid uuid) returns integer language sql stable as $fn$
  select greatest(0, coalesce((select pl.level from player pl where pl.world_id = p_world and pl.uid = p_uid), 0))
$fn$;

/* The storey of the finished garden bed a farming job on a tile is aimed at, on the storey you stand on, or null for the field (`bedLevelOf`). */
create or replace function bed_level_of(p_world uuid, p_uid uuid, p_x integer, p_y integer) returns integer
language sql stable as $fn$
  select l from (select farm_level(p_world, p_uid) as l) q where bed_at(p_world, q.l, p_x, p_y)
$fn$;

/*
 * Why a tile is not sown, as a garden bed of a storey or as a field (a null storey): the bed covered, a crop growing
 * on it, or one on another storey of the tile. The browser's `bedSowRefusal`, in the same order.
 */
create or replace function bed_sow_refusal(p_world uuid, p_x integer, p_y integer, p_level integer) returns text
language plpgsql stable as $fn$
declare c crop;
begin
  if p_level is not null and not bed_open(p_world, p_level, p_x, p_y) then return bed_covered_said(); end if;
  select * into c from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
  if c.id is null then return null; end if;
  return case when c.level is not distinct from p_level then 'Already growing a crop.' else bed_one_crop_said() end;
end $fn$;

/* Whether a tile of a Farmer's patch worked from a storey is empty ground to sow: an open bed of it, or a field on the ground. */
create or replace function patch_sowable(p_world uuid, p_level integer, p_x integer, p_y integer) returns boolean
language sql stable as $fn$
  select in_bounds(p_world, p_x, p_y)
     and not exists (select 1 from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y)
     and ((bed_at(p_world, p_level, p_x, p_y) and bed_open(p_world, p_level, p_x, p_y))
          or (p_level = 0 and land_tile(p_world, p_x, p_y) = tile_id('Field')))
$fn$;

/* ---- The still clock --------------------------------------------------------------------------- */

/*
 * A crop on a covered bed keeps how far into its stage it had grown and grows no further: its stage start is that
 * many seconds before the epoch, the still clock reading nought at every moment (the browser's `STILL_CLOCK`).
 */
create or replace function still_at(p_grown double precision) returns timestamptz language sql immutable as $fn$
  select to_timestamp(-p_grown)
$fn$;
create or replace function still_grown(p_at timestamptz) returns double precision language sql immutable as $fn$
  select -extract(epoch from p_at)::double precision
$fn$;

-- Carried onto the still clock and off it as far into its stage as it had grown; every other clock as it was.
CREATE OR REPLACE FUNCTION public.crop_rebased(p_stage_at timestamp with time zone, p_from text, p_to text, p_now timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
AS $function$
declare v_grown double precision;
begin
  v_grown := case when p_from = 'still' then still_grown(p_stage_at)
                  else crop_clock_on(p_from, p_now) - crop_clock_on(p_from, p_stage_at) end;
  if p_to = 'still' then return still_at(v_grown); end if;
  return crop_moment_on(p_to, crop_clock_on(p_to, p_now) - v_grown);
end $function$;

/*
 * The crop on a tile put right by its garden bed: taken up with the bed when the bed is gone, unfinished or relaid
 * in anything else; onto the still clock when the bed is covered, brought up to now first; and back onto the glass
 * clock when it is uncovered. A crop in a field is left alone.
 */
create or replace function bed_resync(p_world uuid, p_x integer, p_y integer) returns void language plpgsql as $fn$
declare c crop; v_open boolean;
begin
  select * into c from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
  if c.level is null then return; end if;
  if not bed_at(p_world, c.level, p_x, p_y) then
    delete from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
    perform land_announce(p_world, p_x, p_y);
    return;
  end if;
  v_open := bed_open(p_world, c.level, p_x, p_y);
  if v_open = not c.still then return; end if;
  if not v_open then
    perform crop_settle(p_world, p_x, p_y);
    update crop cr set still = true, stage_at = crop_rebased(cr.stage_at, 'glass', 'still')
     where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
  else
    update crop cr set still = false, glass = true, stage_at = crop_rebased(cr.stage_at, 'still', 'glass')
     where cr.world_id = p_world and cr.x = p_x and cr.y = p_y;
  end if;
  perform land_announce(p_world, p_x, p_y);
end $fn$;

/* A floor tile planned, finished, unfinished, relaid, moved or taken up: the crop on its tile, on whatever storey. */
create or replace function bed_floor_trigger() returns trigger language plpgsql as $fn$
begin
  if tg_op <> 'INSERT' then perform bed_resync(old.world_id, old.x, old.y); end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or (old.world_id, old.x, old.y) is distinct from (new.world_id, new.x, new.y)) then
    perform bed_resync(new.world_id, new.x, new.y);
  end if;
  return null;
end $fn$;
drop trigger if exists bed_floor_in on floor_tile;
create trigger bed_floor_in after insert on floor_tile for each row execute function bed_floor_trigger();
-- Only when it is finished or stops being, or is relaid or moved: a go that fits one more board changes nothing.
drop trigger if exists bed_floor_laid on floor_tile;
create trigger bed_floor_laid after update of needed, material, kind, level, x, y on floor_tile
  for each row when (bill_done(old.needed) is distinct from bill_done(new.needed)
                     or (old.material, old.kind, old.level, old.x, old.y) is distinct from (new.material, new.kind, new.level, new.x, new.y))
  execute function bed_floor_trigger();
drop trigger if exists bed_floor_off on floor_tile;
create trigger bed_floor_off after delete on floor_tile for each row execute function bed_floor_trigger();

-- A crop sown on a bed, by anybody or anything, begins on the glass clock, or the still one on a covered bed; in a field on its tile's clock.
CREATE OR REPLACE FUNCTION public.glass_sown_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.level is not null then
    new.glass := true;
    new.still := not bed_open(new.world_id, new.level, new.x, new.y);
    if new.still then new.stage_at := still_at(0); end if;
  else
    new.glass := glasshouse_at(new.world_id, new.x, new.y);
    new.still := false;
  end if;
  return new;
end $function$;

-- A glasshouse carries its fields' crops between clocks, and no bed's: a bed's cover is its own (`bed_resync`).
select pg_temp.patch_fn('public.glass_resync(uuid,integer)'::regprocedure,
  $o$and c.glass <> v_glass;$o$,
  $n$and c.glass <> v_glass and c.level is null;$n$);
select pg_temp.patch_fn('public.glass_resync_tile(uuid,integer,integer)'::regprocedure,
  $o$and c.glass <> v_glass;$o$,
  $n$and c.glass <> v_glass and c.level is null;$n$);

-- Settled, a night slept, and Bounty: nothing on a covered bed, which stands still.
select pg_temp.patch_fn('public.crops_settle(uuid,double precision,double precision,double precision)'::regprocedure,
  $o$     where c.world_id = p_world and c.stage < crop_ripe()$o$,
  $n$     where c.world_id = p_world and c.stage < crop_ripe() and not c.still$n$);
select pg_temp.patch_fn('public.sleep_forward(uuid,uuid,double precision)'::regprocedure,
  $o$  update crop set stage_at = stage_at - gap where world_id = p_world and glass;$o$,
  $n$  update crop set stage_at = stage_at - gap where world_id = p_world and glass and not still;$n$);
select pg_temp.patch_fn('public.hasten_crops(uuid,uuid)'::regprocedure,
  $o$     where c.world_id = p_world and c.stage < crop_ripe() and on_my_deed(p_world, p_uid, c.x, c.y)$o$,
  $n$     where c.world_id = p_world and c.stage < crop_ripe() and not c.still and on_my_deed(p_world, p_uid, c.x, c.y)$n$);

-- The ground read: a bed's crop by its storey, and one standing still with `grown` on the still clock.
select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$        'grown', case when c.hand and not c.glass then v_hand - hand_clock(c.stage_at) else crop_grown(c.glass, c.stage_at, v_field) end,$o$,
  $n$        'grown', case when c.still then still_grown(c.stage_at)
                      when c.hand and not c.glass then v_hand - hand_clock(c.stage_at) else crop_grown(c.glass, c.stage_at, v_field) end,$n$);
select pg_temp.patch_fn('public.rpc_ground(uuid,double precision,boolean,text)'::regprocedure,
  $o$        || case when c.hand then '{"hand": true}'::jsonb else '{}'::jsonb end)
      from crop c$o$,
  $n$        || case when c.hand then '{"hand": true}'::jsonb else '{}'::jsonb end
        -- And one on a garden bed, by its storey, standing still while it is covered (`gardenbed.ts`).
        || case when c.level is not null then jsonb_build_object('level', c.level) else '{}'::jsonb end
        || case when c.still then '{"still": true}'::jsonb else '{}'::jsonb end)
      from crop c$n$);

/* ---- Sown, tended, harvested and cleared on a bed ------------------------------------------------- */

-- What a sowing says on a bed (the browser's `sownSaid`).
CREATE OR REPLACE FUNCTION public.sown_said_on(p_name text, p_clock text, p_when text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select 'Sown: ' || lower(p_name)
      || case p_clock when 'planter' then ', planter' when 'glass' then ', under glass' when 'bed' then ', ' || lower(bed_name()) else '' end
      || '. ' || upper(left(p_when, 1)) || substr(p_when, 2) || '.'
$function$;

-- Sown on the storey of a bed, or in a field for none.
drop function if exists public.sow_one(uuid, uuid, integer, integer, bigint);
CREATE OR REPLACE FUNCTION public.sow_one(p_world uuid, p_uid uuid, p_x integer, p_y integer, p_seed bigint, p_level integer default null)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare it item; cd crop_def; v_kept boolean;
begin
  select * into it from item i
    where i.id = p_seed and i.world_id = p_world and i.holder = 'player' and i.holder_uid = p_uid;
  if not found then return null; end if;
  select * into cd from crop_def where seed = it.def;
  if cd.id is null then return null; end if;
  v_kept := random() < pk(p_world, p_uid, 'keep:plant_seed', 0);
  if not v_kept then
    if not consume(p_world, p_uid, it.def, 1, it.id) then return null; end if;
  end if;
  insert into crop (world_id, x, y, id, ql, sown_by, pace, level)
  values (p_world, p_x, p_y, cd.id, it.ql, p_uid, sown_pace(p_world, p_uid, p_x, p_y, cd.id), p_level)
  on conflict (world_id, x, y) do update set id = excluded.id, stage = 0, stage_at = excluded.stage_at,
    tended = 0, tended_now = false, ql = excluded.ql, sown_by = excluded.sown_by, pace = excluded.pace,
    level = excluded.level, glass = excluded.glass, still = excluded.still;
  perform crop_sown(p_world, p_x, p_y, cd.id);
  -- Seed in a field, for the journal.
  perform journal_note(p_world, p_uid, 'sowed');
  perform land_announce(p_world, p_x, p_y);
  return case when v_kept then 'kept' else 'sown' end;
end $function$;

-- The refusals: a job on a tile is aimed at the bed of the storey you stand on, or the field, and at no crop elsewhere.
select pg_temp.patch_fn('public.farm_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$declare tx int; ty int; here int; c crop; it item; v_r int; v_why text;$o$,
  $n$declare tx int; ty int; here int; c crop; it item; v_r int; v_why text; v_bed int; v_lvl int;$n$);
select pg_temp.patch_fn('public.farm_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;

  if p_action = 'till' then$o$,
  $n$  select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
  -- The garden bed of the storey you stand on (`bed_level_of`), or the field; a crop on another storey is none of this job's.
  v_lvl := farm_level(p_world, p_uid);
  v_bed := bed_level_of(p_world, p_uid, tx, ty);
  if c.id is not null and c.level is distinct from v_bed and p_action <> 'plant_seed' then c := null; end if;

  if p_action = 'till' then$n$);
select pg_temp.patch_fn('public.farm_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    if here <> tile_id('Field') then return 'Needs a tilled field.'; end if;
    if c.id is not null then return 'Already growing a crop.'; end if;$o$,
  $n$    if v_bed is null and here <> tile_id('Field') then return 'Needs a tilled field.'; end if;
    -- Covered, or a crop on the tile already, on this storey or another (`bed_sow_refusal`).
    v_why := bed_sow_refusal(p_world, tx, ty, v_bed);
    if v_why is not null then return v_why; end if;$n$);
select pg_temp.patch_fn('public.farm_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'clear_field' then
    if here <> tile_id('Field') then return 'There is no field there.'; end if;$o$,
  $n$  elsif p_action = 'clear_field' then
    -- A garden bed is pulled up, and only with something on it.
    if v_bed is not null then
      if c.id is null then return 'No crop there.'; end if;
    elsif here <> tile_id('Field') then return 'There is no field there.'; end if;$n$);
select pg_temp.patch_fn('public.farm_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$                    where case when in_bounds(p_world, gx, gy) then land_tile(p_world, gx, gy) = tile_id('Field') else false end
                      and not exists (select 1 from crop cr where cr.world_id = p_world and cr.x = gx and cr.y = gy)) then$o$,
  $n$                    where patch_sowable(p_world, v_lvl, gx, gy)) then$n$);
select pg_temp.patch_fn('public.farm_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$                      and cr.stage < crop_ripe() and not cr.tended_now) then$o$,
  $n$                      and coalesce(cr.level, 0) = v_lvl and cr.stage < crop_ripe() and not cr.tended_now) then$n$);
select pg_temp.patch_fn('public.farm_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$                      and cr.stage >= crop_ripe()) then$o$,
  $n$                      and coalesce(cr.level, 0) = v_lvl and cr.stage >= crop_ripe()) then$n$);

-- And the jobs.
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$        v_ids text[] := '{}'; v_counts int[] := '{}'; v_rares text[] := '{}'; v_rare text; v_packed boolean;$o$,
  $n$        v_ids text[] := '{}'; v_counts int[] := '{}'; v_rares text[] := '{}'; v_rare text; v_packed boolean;
        v_bed int; v_lvl int;$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
  if c.id is not null then select * into cd from crop_def where id = c.id; end if;$o$,
  $n$  select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
  -- The garden bed of the storey you stand on (`bed_level_of`), or the field; a crop on another storey is none of this job's.
  v_lvl := farm_level(p_world, p_uid);
  v_bed := bed_level_of(p_world, p_uid, tx, ty);
  if c.id is not null and c.level is distinct from v_bed then c := null; end if;
  if c.id is not null then select * into cd from crop_def where id = c.id; end if;$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    v_how := sow_one(p_world, p_uid, tx, ty, it.id);
    if v_how is null then return; end if;
    select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
    -- When it will be sprouting, in real time, from the season it was sown in -- or in any, under glass: the browser's words.
    perform tell(p_world, p_uid, sown_said_on(cd.name, crop_kind(c.glass, c.hand),$o$,
  $n$    v_how := sow_one(p_world, p_uid, tx, ty, it.id, v_bed);
    if v_how is null then return; end if;
    select * into c from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
    -- When it will be sprouting, in real time, from the season it was sown in -- or in any, under glass or on a bed: the browser's words.
    perform tell(p_world, p_uid, sown_said_on(cd.name, case when v_bed is not null then 'bed' else crop_kind(c.glass, c.hand) end,$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'tend_crop' then
    perform tend_one(p_world, p_uid, tx, ty, s);$o$,
  $n$  elsif p_action = 'tend_crop' then
    if c.id is null then return; end if;
    perform tend_one(p_world, p_uid, tx, ty, s);$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'harvest_crop' then
    select * into r from reap_one(p_world, p_uid, tx, ty, s);$o$,
  $n$  elsif p_action = 'harvest_crop' then
    if c.id is null then return; end if;
    select * into r from reap_one(p_world, p_uid, tx, ty, s);$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$      || ', QL ' || to_char(r.o_ql, 'FM990.0') || '. Field ready to sow.', 'event');$o$,
  $n$      || ', QL ' || to_char(r.o_ql, 'FM990.0') || '. ' || case when v_bed is not null then bed_name() else 'Field' end || ' ready to sow.', 'event');$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$  elsif p_action = 'clear_field' then
    delete from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;$o$,
  $n$  elsif p_action = 'clear_field' then
    -- A garden bed's crop pulled up, and the bed a bed still.
    if v_bed is not null then
      if c.id is null then return; end if;
      delete from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty;
      perform land_announce(p_world, tx, ty);
      perform tell(p_world, p_uid, 'Cleared: ' || lower(cd.name) || '.', 'event');
      return;
    end if;
    -- A field's own crop, and none on a storey over it.
    delete from crop cr where cr.world_id = p_world and cr.x = tx and cr.y = ty and cr.level is null;$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$      continue when not in_bounds(p_world, v_row.gx, v_row.gy);
      continue when land_tile(p_world, v_row.gx, v_row.gy) is distinct from tile_id('Field');
      continue when exists (select 1 from crop cr where cr.world_id = p_world and cr.x = v_row.gx and cr.y = v_row.gy);
      v_how := sow_one(p_world, p_uid, v_row.gx, v_row.gy, it.id);$o$,
  $n$      -- An empty field on the ground, or an open bed of the storey you stand on (`patch_sowable`).
      continue when not patch_sowable(p_world, v_lvl, v_row.gx, v_row.gy);
      v_how := sow_one(p_world, p_uid, v_row.gx, v_row.gy, it.id,
                       case when bed_at(p_world, v_lvl, v_row.gx, v_row.gy) then v_lvl end);$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$                    and cr.stage < crop_ripe() and not cr.tended_now$o$,
  $n$                    and coalesce(cr.level, 0) = v_lvl and cr.stage < crop_ripe() and not cr.tended_now$n$);
select pg_temp.patch_fn('public.perform_farm(uuid,uuid,text,jsonb)'::regprocedure,
  $o$                    and cr.stage >= crop_ripe()
                  order by cr.y, cr.x loop$o$,
  $n$                    and coalesce(cr.level, 0) = v_lvl and cr.stage >= crop_ripe()
                  order by cr.y, cr.x loop$n$);

/* ---- A settlement's farm workers -------------------------------------------------------------------- */

/* The lowest storey of a tile with an empty open garden bed a worker reaches by the stairs, or null. */
create or replace function worker_bed(p_world uuid, p_x integer, p_y integer) returns integer language sql stable as $fn$
  select f.level from floor_tile f
   where f.world_id = p_world and f.x = p_x and f.y = p_y
     and f.material = bed_material() and f.kind = 'floor' and bill_done(f.needed)
     and bed_open(p_world, f.level, p_x, p_y)
     and (f.level <= 0 or storey_reached(p_world, p_x, p_y, f.level))
   order by f.level limit 1
$fn$;

/* The storey a farm worker works a tile on: its crop's, or an empty field's on the ground, or an empty bed's. */
create or replace function farm_work_level(p_world uuid, p_x integer, p_y integer) returns integer language sql stable as $fn$
  select coalesce(
    (select coalesce(cr.level, 0) from crop cr where cr.world_id = p_world and cr.x = p_x and cr.y = p_y),
    case when land_tile(p_world, p_x, p_y) = tile_id('Field') then 0 end,
    worker_bed(p_world, p_x, p_y), 0)
$fn$;

select pg_temp.patch_fn('private.work_tile_may(uuid,integer,integer,integer,text,integer)'::regprocedure,
  $o$                or (p_kind = 'farm' and cr.x is not null)$o$,
  $n$                or (p_kind = 'farm' and (cr.x is not null or gb.x is not null))$n$);
select pg_temp.patch_fn('private.work_tile_may(uuid,integer,integer,integer,text,integer)'::regprocedure,
  $o$      on cr.x = g.gx and cr.y = g.gy
$o$,
  $n$      on cr.x = g.gx and cr.y = g.gy
    -- And a finished garden bed on any storey (`worker_bed` says which may be sown).
    left join (select distinct f.x, f.y from floor_tile f
                where p_kind = 'farm' and f.world_id = p_world and f.material = bed_material() and f.kind = 'floor'
                  and f.x between v_x0 and v_x1 and f.y between v_y0 and v_y1) gb
      on gb.x = g.gx and gb.y = g.gy
$n$);

select pg_temp.patch_fn('public.worker_gatherable(uuid,integer,integer,text,creature)'::regprocedure,
  $o$    if found and (v_crop.stage >= crop_ripe() or not v_crop.tended_now) then return true; end if;$o$,
  $n$    -- On a bed up a storey, only by the stairs.
    if found and coalesce(v_crop.level, 0) > 0 and not storey_reached(p_world, p_x, p_y, v_crop.level) then return false; end if;
    if found and (v_crop.stage >= crop_ripe() or not v_crop.tended_now) then return true; end if;$n$);
select pg_temp.patch_fn('public.worker_gatherable(uuid,integer,integer,text,creature)'::regprocedure,
  $o$    return here = tile_id('Field') and (sow_seed(p_world, c, p_x, p_y)).id is not null;$o$,
  $n$    -- An empty field, or an empty open bed it reaches (`worker_bed`).
    return (here = tile_id('Field') or worker_bed(p_world, p_x, p_y) is not null) and (sow_seed(p_world, c, p_x, p_y)).id is not null;$n$);

select pg_temp.patch_fn('public.worker_do(uuid,integer)'::regprocedure,
  $o$        cr crop; yld int[]; depth double precision; v_seed item; v_cd crop_def;$o$,
  $n$        cr crop; yld int[]; depth double precision; v_seed item; v_cd crop_def; v_bed int;$n$);
select pg_temp.patch_fn('public.worker_do(uuid,integer)'::regprocedure,
  $o$      if land_tile(p_world, wx, wy) <> tile_id('Field') then return null; end if;
      select * into v_seed from sow_seed(p_world, c, wx, wy);$o$,
  $n$      -- A field on the ground, or else an open bed it reaches (`worker_bed`).
      v_bed := case when land_tile(p_world, wx, wy) = tile_id('Field') then null else worker_bed(p_world, wx, wy) end;
      if land_tile(p_world, wx, wy) <> tile_id('Field') and v_bed is null then return null; end if;
      select * into v_seed from sow_seed(p_world, c, wx, wy);$n$);
select pg_temp.patch_fn('public.worker_do(uuid,integer)'::regprocedure,
  $o$      insert into crop (world_id, x, y, id, ql, sown_by)
      values (p_world, wx, wy, v_cd.id, v_seed.ql, c.keeper)
      on conflict (world_id, x, y) do update set id = v_cd.id, stage = 0, stage_at = now(),
        tended = 0, tended_now = false, ql = v_seed.ql, sown_by = c.keeper, pace = 1;$o$,
  $n$      insert into crop (world_id, x, y, id, ql, sown_by, level)
      values (p_world, wx, wy, v_cd.id, v_seed.ql, c.keeper, v_bed)
      on conflict (world_id, x, y) do update set id = v_cd.id, stage = 0, stage_at = excluded.stage_at,
        tended = 0, tended_now = false, ql = v_seed.ql, sown_by = c.keeper, pace = 1,
        level = excluded.level, glass = excluded.glass, still = excluded.still;$n$);
select pg_temp.patch_fn('public.worker_do(uuid,integer)'::regprocedure,
  $o$    delete from crop where world_id = p_world and x = wx and y = wy;
    perform land_set_tile(p_world, wx, wy, tile_id('Field'));
    perform land_announce(p_world, wx, wy);$o$,
  $n$    delete from crop where world_id = p_world and x = wx and y = wy;
    -- A field stays a field; a bed is a bed, and its tile's ground is not touched.
    if cr.level is null then perform land_set_tile(p_world, wx, wy, tile_id('Field')); end if;
    perform land_announce(p_world, wx, wy);$n$);

-- And it walks to the storey it works on, by the stairs, as a hod carrier does (`worker_way_leg`).
select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$        c.work_x := spot.x; c.work_y := spot.y;$o$,
  $n$        c.work_x := spot.x; c.work_y := spot.y;
        if kind = 'farm' then v_lv := farm_work_level(p_world, spot.x, spot.y); end if;$n$);

select private.lock_doors();
