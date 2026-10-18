-- Twelve more hands on a settlement.
--
-- Asked for, off a second list of work only a player did: a forga charges the
-- smelters and a potta the kilns and each takes out what they have made, a
-- cindra rakes the ashes and leaches lye, a hoppa sets the brews going, a
-- simma cooks, a relka restores relics, a bedda keeps the planters, a wurla
-- digs worms, a sprigga picks sprouts, an ambra taps the pines for tar, a
-- petta picks wildflowers, and a scurra scrubs the moss and clears the ivy.
-- The species and their trades come in with the definitions; this is what
-- each trade does, the same as the browser's (`Creatures.furnaceStep`,
-- `ashStep`, `brewStep`, `cookStep`, `restoreStep`, `planterStep`,
-- `finishHands`). The first seven are errands, the last five walk out to a
-- tile; a scurra's tile is worked where it stands and nothing comes home.

create or replace function worker_job_ported(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('forage', 'botanize', 'woodcut', 'mine', 'quarry',
                    'sand', 'clay', 'peat', 'reed', 'fish', 'farm', 'fetch',
                    'hod', 'mend', 'stoke', 'plant', 'compost', 'guard', 'hunt',
                    'prospect', 'water', 'seek', 'prune', 'stump', 'fruit', 'hive',
                    'groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp',
                    'bush', 'grass', 'pan',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch',
                    'worm', 'sprout', 'resin', 'flower', 'scrub')
$fn$;

create or replace function tend_job(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch')
$fn$;

create or replace function work_words(p_kind text) returns text language sql immutable as $fn$
  select case p_kind
    when 'woodcut' then 'trees to fell'
    when 'prune'   then 'trees worth pruning'
    when 'fruit'   then 'fruit on the bough'
    when 'stump'   then 'stumps to dig out'
    when 'mine'    then 'bare rock with a seam in it'
    when 'quarry'  then 'bare rock to cut'
    when 'sand'    then 'sand to dig'
    when 'clay'    then 'clay to dig'
    when 'peat'    then 'peat to cut'
    when 'reed'    then 'reeds to cut'
    when 'fish'    then 'water worth a rod'
    when 'seek'    then 'ground worth turning over'
    when 'farm'    then 'fields wanting work'
    when 'hive'    then 'hive to tend'
    when 'bush'    then 'bushes or vines to pick'
    when 'grass'   then 'grass or moss to cut'
    when 'pan'     then 'sand at the water to pan'
    when 'worm'    then 'ground to dig for worms'
    when 'sprout'  then 'trees to pick a sprout off'
    when 'resin'   then 'pines to tap'
    when 'flower'  then 'wildflowers to pick'
    when 'scrub'   then 'moss or ivy on your stone'
    else 'work' end
$fn$;

-- A scurra's scrubbing brings nothing to the crate, and its words say what it does (`deedJobLine`).
create or replace function deed_job_line(c creature) returns text language sql stable as $fn$
  select coalesce((select g.plain || ' within ' || work_range(c) || ' tiles of the token'
                          || case when g.id in ('hive', 'scrub') or tend_job(g.id) then '' else ' and bring what it finds to the crate' end
                     from gather_def g
                    where g.id = coalesce(c.job, (select s.gathers from species_def s where s.id = c.species))),
                  'stay around the settlement')
$fn$;

-- The recipes the errands at the stores work, in the order they try them: a tanna's, a grista's, a cindra's lye,
-- and a simma's, which are the recipes worked at a lit campfire or oven that no perk gates (`cookRecipes`).
create or replace function tend_recipes(p_kind text) returns text[] language sql immutable as $fn$
  select case p_kind
    when 'tan' then array['tan_hide']
    when 'mill' then array['make_flour', 'make_cornmeal', 'press_olives']
    when 'ash' then array['make_lye']
    when 'cook' then array['cook_meat', 'bake_potato', 'roast_onion', 'roast_nuts', 'roast_lotus_seeds', 'make_compote',
                           'fry_meat', 'make_pottage', 'make_preserves', 'bake_bread', 'make_porridge', 'bake_pastry',
                           'make_apple_pie', 'make_cherry_preserves', 'make_stew', 'cook_minnow', 'cook_perch', 'cook_trout',
                           'cook_pike', 'cook_sturgeon'] end
$fn$;

-- The brews a hoppa tries, in the order the brews are listed (`BREWS`).
create or replace function brew_order() returns text[] language sql immutable as $fn$
  select array['ale', 'cider', 'mead', 'wine', 'grape_wine']
$fn$;

-- Tar a tap of a pine gives an ambra (`RESIN_TAPPED`).
create or replace function resin_tapped() returns int language sql immutable as $fn$ select 1 $fn$;

/* ---- the stores, a stack at a time ------------------------------------------------------ */

-- Up to `p_n` of the first stack of one of these out of the stores, preferring a store on the tile given (`takeFrom`).
create or replace function take_some_stored(p_world uuid, p_uid uuid, p_defs text[], p_n int, p_x int, p_y int)
returns jsonb language plpgsql as $fn$
declare v item; k int;
begin
  select (s.it).* into v from deed_store_items(p_world, p_uid) s
   where (s.it).def = any(p_defs) and (s.it).count > 0 and not coalesce((s.it).locked, false)
   order by (s.x = p_x and s.y = p_y) desc, s.kind, s.sid, (s.it).id limit 1;
  if v.id is null then return null; end if;
  k := least(p_n, v.count);
  if v.count > k then update item set count = count - k where id = v.id;
  else delete from item where id = v.id; end if;
  return jsonb_build_object('def', v.def, 'count', k, 'ql', v.ql, 'extra', v.extra);
end $fn$;

/* ---- what the errands look for -------------------------------------------------------- */

-- What a smelter takes, or a kiln: ore, or unfired pottery.
create or replace function furnace_fits(p_kind text) returns text[] language sql stable as $fn$
  select case when p_kind = 'smelt' then (select array_agg(m.ore) from metal_def m where m.ore is not null)
              else (select array_agg(pd.unfired) from pottery_def pd) end
$fn$;

-- A smelter or a kiln of yours within reach of the token: with something made in it (`p_output`), or with room.
create or replace function furnace_target(p_world uuid, c creature, p_kind text, p_output boolean, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = case when p_kind = 'smelt' then 'smelter' else 'kiln' end
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
     and case when p_output then jsonb_array_length(furnace_output(p)) > 0
              else jsonb_array_length(furnace_jobs(p)) < furnace_capacity(p) end
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

-- Something of yours with a whole ash in it to rake: a campfire, an oven, a smelter or a kiln.
create or replace function ash_target(p_world uuid, c creature, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world
     and (p.kind in ('campfire', 'smelter', 'kiln') or is_oven(p))
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
     and floor(placed_ash(p)) >= 1
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

-- A lit campfire or oven of yours to cook at.
create or replace function cook_target(p_world uuid, c creature, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and (p.kind = 'campfire' or is_oven(p)) and placed_lit(p)
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

-- The first brew whose makings are all in the stores (`brewInStores`).
create or replace function brew_in_stores(p_world uuid, p_uid uuid) returns brew_def language sql stable as $fn$
  select b.* from brew_def b join unnest(brew_order()) with ordinality o(id, n) on o.id = b.id
   where stores_count(p_world, p_uid, b.input) >= b.count order by o.n limit 1
$fn$;

-- A barrel of yours with water enough in it for a brew and nothing working.
create or replace function brew_target(p_world uuid, c creature, b brew_def, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = 'furniture'
     and holds_liquid(p) and not is_well(p) and not is_working(p)
     and coalesce(placed_liquid(p), '') = 'water' and placed_litres(p) >= b.litres
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

-- The first relic, by name, every piece of which is in the stores, and the store holding its first piece (`relicInStores`).
create or replace function relic_in_stores(p_world uuid, p_uid uuid)
returns table(name text, x int, y int, cx double precision, cy double precision)
language sql stable as $fn$
  with pieces as (
    select fragment_relic((s.it).extra) as relic, fragment_part((s.it).extra) as part, s.x, s.y, s.cx, s.cy, s.kind, s.sid
      from deed_store_items(p_world, p_uid) s
     where (s.it).def = 'fragment' and not coalesce((s.it).locked, false))
  select r.name, f.x, f.y, f.cx, f.cy from relic_def r
    join lateral (select p.x, p.y, p.cx, p.cy from pieces p where lower(p.relic) = lower(r.name) and p.part = 1
                   order by p.kind, p.sid limit 1) f on true
   where (select count(distinct p.part) from pieces p where lower(p.relic) = lower(r.name) and p.part between 1 and r.parts) = r.parts
   order by r.name collate "C" limit 1
$fn$;

-- A planter of yours wanting a bedda: a ripe crop, one not tended at this stage, or empty with seed to be had.
create or replace function planter_target(p_world uuid, c creature, p_seed boolean, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = 'furniture' and is_planter(p.sub)
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
     and case when exists (select 1 from planter_crop pc where pc.placed = p.id)
              then exists (select 1 from planter_crop pc where pc.placed = p.id and (pc.stage >= crop_ripe() or not pc.tended_now))
              else p_seed end
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

/* ---- moss and ivy on a tile of yours ---------------------------------------------------- */

/*
 * The most days anything on a tile of yours has been greening (`greenOnTile`):
 * its paving and its slab, a statue standing on it, and the stone walls along
 * its north and its west edges; nought on a tile that is not yours.
 */
create or replace function green_on_tile(p_world uuid, p_uid uuid, p_x int, p_y int) returns int language plpgsql stable as $fn$
declare v_from timestamptz; v_days int := 0;
begin
  if not on_my_deed(p_world, p_uid, p_x, p_y) then return 0; end if;
  select w.green_from into v_from from world w where w.id = p_world;
  if coalesce((select td.paved from tile_def td where td.id = land_tile(p_world, p_x, p_y)), false) then
    v_days := green_days(green_start((select g.since from green_since g where g.world_id = p_world
                and g.thing = 'paving' and g.x = p_x and g.y = p_y and g.k = 0), v_from), now());
  end if;
  if (slab_at(p_world, p_x, p_y)).id is not null then
    v_days := greatest(v_days, green_days(green_start((select g.since from green_since g where g.world_id = p_world
                and g.thing = 'slab' and g.x = p_x and g.y = p_y and g.k = 0), v_from), now()));
  end if;
  v_days := greatest(v_days, coalesce((select max(green_days(green_start(greatest(pc.made_at, (select g.since from green_since g
                where g.world_id = p_world and g.thing = 'piece' and g.x = pc.x and g.y = pc.y and g.k = pc.id)), v_from), now()))
      from placed pc join furniture_def f on f.id = pc.sub and f.mossy
     where pc.world_id = p_world and pc.kind = 'furniture' and pc.x = p_x and pc.y = p_y), 0));
  v_days := greatest(v_days, coalesce((select max(green_days(green_start(g.since, v_from), now()))
      from (select * from border_of(p_x, p_y, 'n') union all select * from border_of(p_x, p_y, 'w')) bo
      join wall wl on wl.world_id = p_world and wl.dir = bo.dir and wl.x = bo.x and wl.y = bo.y
      join build_material_def m on m.id = wl.material and m.kind = 'stone'
      left join green_since g on g.world_id = p_world and g.thing = 'wall' and g.x = wl.x and g.y = wl.y
                             and g.k = green_wall_k(wl.level, wl.dir)
     where bill_done(wl.needed)), 0));
  return v_days;
end $fn$;

-- All of it back to bare stone, as Scrub the moss and Clear the ivy leave it (`scrubTile`).
create or replace function scrub_tile(p_world uuid, p_uid uuid, p_x int, p_y int) returns void language plpgsql as $fn$
begin
  if not on_my_deed(p_world, p_uid, p_x, p_y) then return; end if;
  if coalesce((select td.paved from tile_def td where td.id = land_tile(p_world, p_x, p_y)), false) then
    perform green_mark(p_world, 'paving', p_x, p_y, 0);
  end if;
  if (slab_at(p_world, p_x, p_y)).id is not null then perform green_mark(p_world, 'slab', p_x, p_y, 0); end if;
  perform green_mark(p_world, 'piece', pc.x, pc.y, pc.id)
     from placed pc join furniture_def f on f.id = pc.sub and f.mossy
    where pc.world_id = p_world and pc.kind = 'furniture' and pc.x = p_x and pc.y = p_y;
  insert into green_since (world_id, thing, x, y, k, since)
    select p_world, 'wall', wl.x, wl.y, green_wall_k(wl.level, wl.dir), now()
      from (select * from border_of(p_x, p_y, 'n') union all select * from border_of(p_x, p_y, 'w')) bo
      join wall wl on wl.world_id = p_world and wl.dir = bo.dir and wl.x = bo.x and wl.y = bo.y
      join build_material_def m on m.id = wl.material and m.kind = 'stone'
     where bill_done(wl.needed)
  on conflict (world_id, thing, x, y, k) do update set since = excluded.since;
end $fn$;

/* ---- the trades, into the worker's day ------------------------------------------------- */

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A sprout and a tap are taken from beside the tree, as fruit is.
    (1, 'worker_settle', $$        if kind in ('woodcut', 'prune', 'fish', 'fruit')$$,
                         $$        if kind in ('woodcut', 'prune', 'fish', 'fruit', 'sprout', 'resin')$$, 1),

    -- Where each of the seven errands goes next.
    (2, 'errand_step', $$  elsif kind = 'plant' then$$,
                       $$  elsif kind in ('smelt', 'kiln') then
    declare v_p placed; v_s record; v_fits text[] := furnace_fits(kind);
            v_hold boolean := coalesce(c.carrying->>'def' = any(furnace_fits(kind)), false);
    begin
      -- What it has made, out first, while its arms are empty.
      if c.carrying is null then
        v_p := furnace_target(p_world, c, kind, true, c.to_x, c.to_y);
        if v_p.id is not null then
          gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
          return next;
          return;
        end if;
      end if;
      v_p := furnace_target(p_world, c, kind, false, c.to_x, c.to_y);
      -- Anything in its arms with nowhere to go goes back to the stores.
      if c.carrying is not null and (not v_hold or v_p.id is null) then
        select * into v_s from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_s.id is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      if v_p.id is null then return; end if;
      if not v_hold then
        select * into v_s from store_holding(p_world, c.keeper, v_fits, c.to_x, c.to_y);
        if v_s.x is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      else
        gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
      end if;
      return next;
      return;
    end;

  elsif kind = 'ash' then
    declare v_p placed; v_r record;
    begin
      v_p := ash_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is not null then
        gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
        return next;
        return;
      end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('ash'));
      if v_r.rid is null then return; end if;
      gx := v_r.cx; gy := v_r.cy; want := null; wx := v_r.x; wy := v_r.y;
      return next;
      return;
    end;

  elsif kind = 'brew' then
    declare v_b brew_def; v_p placed;
    begin
      v_b := brew_in_stores(p_world, c.keeper);
      if v_b.id is null then return; end if;
      v_p := brew_target(p_world, c, v_b, c.to_x, c.to_y);
      if v_p.id is null then return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
      return next;
      return;
    end;

  elsif kind = 'cook' then
    declare v_r record; v_p placed;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('cook'));
      if v_r.rid is null then return; end if;
      v_p := cook_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'restore' then
    declare v_r record;
    begin
      select * into v_r from relic_in_stores(p_world, c.keeper);
      if v_r.name is null then return; end if;
      gx := v_r.cx; gy := v_r.cy; want := null; wx := v_r.x; wy := v_r.y;
      return next;
      return;
    end;

  elsif kind = 'patch' then
    declare v_p placed; v_s record; v_seeds text[] := (select array_agg(cd.seed) from crop_def cd);
            v_hold boolean := coalesce(c.carrying->>'def' = any(array(select cd.seed from crop_def cd)), false);
    begin
      if c.carrying is not null and not v_hold then
        select * into v_s from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_s.id is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      v_p := planter_target(p_world, c, v_hold or exists (select 1 from deed_store_items(p_world, c.keeper) s
               where (s.it).def = any(v_seeds) and not coalesce((s.it).locked, false)), c.to_x, c.to_y);
      if v_p.id is null then return; end if;
      if not exists (select 1 from planter_crop pc where pc.placed = v_p.id) and not v_hold then
        select * into v_s from store_holding(p_world, c.keeper, v_seeds, c.to_x, c.to_y);
        if v_s.x is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      else
        gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
      end if;
      return next;
      return;
    end;

  elsif kind = 'plant' then$$, 1),

    -- What each does when it gets there.
    (3, 'errand_do', $$  elsif kind = 'plant' then$$,
                     $$  elsif kind in ('smelt', 'kiln') then
    declare v_p placed; v_fits text[] := furnace_fits(kind); v_hold boolean := coalesce(c.carrying->>'def' = any(furnace_fits(kind)), false);
            v_jobs jsonb; v_one jsonb; v_n int; v_secs double precision; v_metal metal_def; v_i int; v_makes text; v_room int;
            v_furnace text := case when kind = 'smelt' then 'smelter' else 'kiln' end;
    begin
      select p.* into v_p from placed p where p.world_id = p_world and p.kind = v_furnace
        and p.x = c.work_x and p.y = c.work_y and on_my_deed(p_world, c.keeper, p.x, p.y) order by p.id limit 1;
      if v_p.id is not null then
        perform furnace_settle(p_world, v_p.id);
        select * into v_p from placed where id = v_p.id;
        -- What it has made, into the stores.
        if c.carrying is null and jsonb_array_length(furnace_output(v_p)) > 0 then
          for v_one in select * from jsonb_array_elements(furnace_output(v_p)) loop
            perform worker_put(p_world, c, v_one->>'def', (v_one->>'count')::int, (v_one->>'ql')::double precision,
                               v_p.x, v_p.y, v_one->>'extra');
          end loop;
          update placed set state = jsonb_set(state, '{output}', '[]'::jsonb) where id = v_p.id;
          perform worker_learn(p_world, p_id, skill_id, 0.25);
          return true;
        end if;
        -- What it carries, in: a job to a piece, as a person's charging makes one (`smelt_ore`, `load_kiln`).
        v_jobs := furnace_jobs(v_p);
        v_room := furnace_capacity(v_p) - jsonb_array_length(v_jobs);
        if v_hold and v_room > 0 then
          v_n := least((c.carrying->>'count')::int, v_room);
          if kind = 'smelt' then
            v_metal := metal_by_ore(c.carrying->>'def');
            v_secs := smelt_seconds(v_metal.id, (c.carrying->>'ql')::double precision, v_p.ql);
            for v_i in 1..v_n loop
              v_jobs := v_jobs || jsonb_build_object('makes', v_metal.lump, 'left', v_secs, 'total', v_secs, 'ql', (c.carrying->>'ql')::double precision);
            end loop;
          else
            v_makes := (select pd.fired from pottery_def pd where pd.unfired = c.carrying->>'def');
            v_secs := fire_seconds(c.carrying->>'def', v_p.ql);
            for v_i in 1..v_n loop
              v_jobs := v_jobs || jsonb_build_object('makes', v_makes, 'left', v_secs, 'total', v_secs,
                'ql', fired_ql((c.carrying->>'ql')::double precision, v_p.ql));
            end loop;
          end if;
          update placed set state = jsonb_set(coalesce(state, '{}'::jsonb), '{jobs}', v_jobs) where id = v_p.id;
          update creature set carrying = case when (carrying->>'count')::int > v_n
                   then jsonb_set(carrying, '{count}', to_jsonb((carrying->>'count')::int - v_n)) end
           where world_id = p_world and id = p_id;
          perform worker_learn(p_world, p_id, skill_id, 0.25);
          return true;
        end if;
      end if;
      if c.carrying is not null and not v_hold then
        perform worker_put(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int, (c.carrying->>'ql')::double precision,
                           c.work_x, c.work_y, c.carrying->>'extra');
        update creature set carrying = null where world_id = p_world and id = p_id;
        return true;
      end if;
      -- At a store: as much as the nearest furnace with room will take.
      if not v_hold then
        v_p := furnace_target(p_world, c, kind, false, c.work_x + 0.5, c.work_y + 0.5);
        if v_p.id is null then return false; end if;
        update creature set carrying = take_some_stored(p_world, c.keeper, v_fits,
                 furnace_capacity(v_p) - jsonb_array_length(furnace_jobs(v_p)), c.work_x, c.work_y)
         where world_id = p_world and id = p_id;
        return true;
      end if;
      return false;
    end;

  elsif kind = 'ash' then
    declare v_p placed; v_whole int; v_r record; r recipe; ri record; v_i int;
    begin
      select p.* into v_p from placed p where p.world_id = p_world and (p.kind in ('campfire', 'smelter', 'kiln') or is_oven(p))
        and p.x = c.work_x and p.y = c.work_y and floor(placed_ash(p)) >= 1 and on_my_deed(p_world, c.keeper, p.x, p.y)
        order by p.id limit 1;
      if v_p.id is not null then
        -- Every whole ash in it, as a person's rake takes them (`perform_fire`).
        perform placed_settle(v_p.id);
        select * into v_p from placed where id = v_p.id;
        v_whole := floor(v_p.ash)::int;
        if v_whole < 1 then return false; end if;
        update placed set ash = ash - v_whole where id = v_p.id;
        perform worker_put(p_world, c, 'ash', v_whole, 20, v_p.x, v_p.y);
        perform worker_learn(p_world, p_id, skill_id, 0.2);
        return true;
      end if;
      -- Nothing to rake here: lye out of the stores.
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('ash'));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item], c.work_x, c.work_y); end loop;
      end loop;
      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y);
      for ri in select * from recipe_gives where recipe = r.id and recipe_gives.kind = 'return' loop
        perform worker_put(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);
      end loop;
      perform worker_learn(p_world, p_id, skill_id, 0.25);
      return true;
    end;

  elsif kind = 'brew' then
    -- A brew set going as a person sets one (`start_brew`): never spoiled, at the makings' quality and its brewing, half and half.
    declare v_b brew_def; v_p placed; v_i int; v_ql double precision := 0; v_one jsonb;
    begin
      v_b := brew_in_stores(p_world, c.keeper);
      if v_b.id is null then return false; end if;
      select p.* into v_p from placed p where p.world_id = p_world and p.kind = 'furniture' and p.x = c.work_x and p.y = c.work_y
        and holds_liquid(p) and not is_well(p) and not is_working(p) and coalesce(placed_liquid(p), '') = 'water'
        and placed_litres(p) >= v_b.litres and on_my_deed(p_world, c.keeper, p.x, p.y) order by p.id limit 1;
      if v_p.id is null then return false; end if;
      for v_i in 1..v_b.count loop
        v_one := take_one_stored(p_world, c.keeper, array[v_b.input], c.work_x, c.work_y);
        v_ql := v_ql + coalesce((v_one->>'ql')::double precision, 20);
      end loop;
      update placed set litres = v_b.litres, liquid = v_b.id, ferment = v_b.seconds, since = now(), knack = null,
             ql = greatest(1, least(100, (v_ql / v_b.count + skill) / 2))
       where id = v_p.id;
      perform worker_learn(p_world, p_id, skill_id, 0.3);
      return true;
    end;

  elsif kind = 'cook' then
    -- At a lit campfire or oven of yours, the first recipe the stores hold the makings of, cooked and put in the stores.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      if not exists (select 1 from placed p where p.world_id = p_world and (p.kind = 'campfire' or is_oven(p)) and placed_lit(p)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('cook'));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item]); end loop;
      end loop;
      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y);
      for ri in select * from recipe_gives where recipe = r.id and recipe_gives.kind = 'return' loop
        perform worker_put(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);
      end loop;
      perform worker_learn(p_world, p_id, skill_id, 0.25);
      return true;
    end;

  elsif kind = 'restore' then
    -- Every piece of the relic out of the stores, the least damaged of each, and the relic back in at what they were worth.
    declare v_r record; rd relic_def; v_part int; v_it item; v_worth double precision := 0;
    begin
      select * into v_r from relic_in_stores(p_world, c.keeper);
      if v_r.name is null then return false; end if;
      select * into rd from relic_def where name = v_r.name;
      for v_part in 1..rd.parts loop
        select (s.it).* into v_it from deed_store_items(p_world, c.keeper) s
         where (s.it).def = 'fragment' and not coalesce((s.it).locked, false)
           and lower(fragment_relic((s.it).extra)) = lower(rd.name) and fragment_part((s.it).extra) = v_part
         order by (s.it).dmg, (s.it).id limit 1;
        if v_it.id is null then return false; end if;
        v_worth := v_worth + v_it.ql * (1 - v_it.dmg / 200.0);
        if v_it.count > 1 then update item set count = count - 1 where id = v_it.id;
        else delete from item where id = v_it.id; end if;
      end loop;
      perform worker_put(p_world, c, rd.result, 1, greatest(1, least(100, v_worth / rd.parts * (0.72 + skill / 260))), c.work_x, c.work_y);
      perform worker_learn(p_world, p_id, skill_id, 0.3);
      return true;
    end;

  elsif kind = 'patch' then
    -- A planter: harvested when ripe, tended when it wants it, sown when empty, as a person's hands do each.
    declare v_p placed; v_c planter_crop; cd crop_def; v_yld int[]; v_ql double precision; v_made double precision;
            v_hold boolean := coalesce(c.carrying->>'def' = any(array(select x.seed from crop_def x)), false);
    begin
      select p.* into v_p from placed p where p.world_id = p_world and p.kind = 'furniture' and is_planter(p.sub)
        and p.x = c.work_x and p.y = c.work_y and on_my_deed(p_world, c.keeper, p.x, p.y) order by p.id limit 1;
      if v_p.id is not null then
        perform planter_settle(p_world, v_p.id);
        select * into v_c from planter_crop where placed = v_p.id;
        v_made := worker_made_ql(c, skill);
        if v_c.placed is null and v_hold then
          select * into cd from crop_def where seed = c.carrying->>'def';
          insert into planter_crop (placed, world_id, id, ql, sown_by, pace)
          values (v_p.id, p_world, cd.id, (c.carrying->>'ql')::real, c.keeper, 1)
          on conflict (placed) do update set id = excluded.id, stage = 0, stage_at = now(),
            tended = 0, tended_now = false, ql = excluded.ql, sown_by = excluded.sown_by, pace = 1;
          update placed set state = coalesce(state, '{}'::jsonb) || jsonb_build_object('sown', cd.id) where id = v_p.id;
          update creature set carrying = null where world_id = p_world and id = p_id;
          perform land_announce(p_world, v_p.x, v_p.y);
          perform worker_learn(p_world, p_id, skill_id, 0.25);
          return true;
        elsif v_c.placed is not null and v_c.stage >= crop_ripe() then
          select * into cd from crop_def where id = v_c.id;
          v_yld := crop_yield(v_c.tended);
          v_ql := greatest(1, least(100, (v_c.ql + v_made) / 2));
          perform worker_put(p_world, c, cd.produce, v_yld[2], v_ql, v_p.x, v_p.y);
          perform worker_put(p_world, c, cd.seed, v_yld[1], v_ql, v_p.x, v_p.y);
          delete from planter_crop where placed = v_p.id;
          perform land_announce(p_world, v_p.x, v_p.y);
          perform worker_learn(p_world, p_id, skill_id, 0.25);
          return true;
        elsif v_c.placed is not null and not v_c.tended_now then
          update planter_crop set tended_now = true, tended = tended + 1,
                 ql = (ql * (tended + 1) + v_made) / (tended + 2)
           where placed = v_p.id;
          perform worker_learn(p_world, p_id, skill_id, 0.25);
          return true;
        end if;
      end if;
      if c.carrying is not null and not v_hold then
        perform worker_put(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int, (c.carrying->>'ql')::double precision,
                           c.work_x, c.work_y, c.carrying->>'extra');
        update creature set carrying = null where world_id = p_world and id = p_id;
        return true;
      end if;
      if not v_hold then
        update creature set carrying = take_some_stored(p_world, c.keeper, (select array_agg(x.seed) from crop_def x), 1, c.work_x, c.work_y)
         where world_id = p_world and id = p_id;
        return true;
      end if;
      return false;
    end;

  elsif kind = 'plant' then$$, 1),

    -- The five that walk out: worms, a sprout, a tap, wildflowers, and moss and ivy.
    (4, 'worker_gatherable', $$  if p_kind = 'woodcut' then$$,
                             $$  if p_kind = 'worm' then
    return coalesce(t.wormy, false) and not has_water(p_world, p_x, p_y) and creature_tile_ok(p_world, p_x, p_y)
       and not is_foraged(p_world, p_x, p_y, 'worm');
  elsif p_kind in ('sprout', 'resin') then
    if here <> tile_id('Tree') or not exists (select 1 from beside_tile(p_world, p_x, p_y)) then return false; end if;
    if p_kind = 'sprout' then
      return coalesce((select a.alive from tree_age_def a where a.id = tree_age(land_data(p_world, p_x, p_y))), false)
         and not is_foraged(p_world, p_x, p_y, 'sprout');
    end if;
    return tree_species(land_data(p_world, p_x, p_y)) = resin_tree()
       and coalesce((select a.alive and a.logs > 0 from tree_age_def a where a.id = tree_age(land_data(p_world, p_x, p_y))), false)
       and not exists (select 1 from foraged f where f.world_id = p_world and f.x = p_x and f.y = p_y
                         and f.kind = 'resin' and f.at >= tree_last_dawn());
  elsif p_kind = 'flower' then
    -- In flower, and not where a skep gathers: its honey is the flowers in reach of it.
    return flowers_on(p_world, p_x, p_y, now()) > 0 and creature_tile_ok(p_world, p_x, p_y)
       and not exists (select 1 from placed pl where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = 'skep'
                         and greatest(abs(pl.x - p_x), abs(pl.y - p_y)) <= skep_reach());
  elsif p_kind = 'scrub' then
    return creature_tile_ok(p_world, p_x, p_y) and green_on_tile(p_world, c.keeper, p_x, p_y) > 0;
  end if;

  if p_kind = 'woodcut' then$$, 1),

    (5, 'worker_do', $$  if kind = 'bush' then$$,
                     $$  if kind = 'worm' then
    -- As a person's spade turns them up: more in a marsh or under moss, and now and then none.
    perform mark_foraged(p_world, wx, wy, 'worm');
    declare v_rich boolean := coalesce((select td.rich_worms from tile_def td where td.id = here), false); v_n int;
    begin
      v_n := floor(random() * case when v_rich then 5 else 3 end)::int + case when v_rich then 1 else 0 end;
      if v_n <= 0 then return null; end if;
      return jsonb_build_object('def', 'worm', 'count', v_n, 'ql', 20 + random() * 40);
    end;
  elsif kind = 'sprout' then
    if here <> tile_id('Tree') then return null; end if;
    perform mark_foraged(p_world, wx, wy, 'sprout');
    return jsonb_build_object('def', 'sprout', 'count', 1, 'ql', made_ql,
      'extra', (select td.name from tree_def td where td.id = tree_species(land_data(p_world, wx, wy))));
  elsif kind = 'resin' then
    if here <> tile_id('Tree') then return null; end if;
    perform mark_foraged(p_world, wx, wy, 'resin');
    return jsonb_build_object('def', 'tar', 'count', resin_tapped(), 'ql', made_ql);
  elsif kind = 'flower' then
    -- A wildflower for each clump, and the tile picked bare until the year turns.
    declare v_n int := flowers_on(p_world, wx, wy, now());
    begin
      if v_n <= 0 then return null; end if;
      perform land_set_data(p_world, wx, wy, land_data(p_world, wx, wy) | flowers_picked()::int);
      perform land_announce(p_world, wx, wy);
      return jsonb_build_object('def', 'wildflowers', 'count', v_n, 'ql', made_ql);
    end;
  elsif kind = 'scrub' then
    perform scrub_tile(p_world, c.keeper, wx, wy);
    return null;
  end if;
  if kind = 'bush' then$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
