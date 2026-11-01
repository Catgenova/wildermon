/*
 * Twelve kinds take up a new settlement task.
 *
 * Asked for, as a plan: each of these does what your own hands do, from the
 * settlement stores and back into them, at the same inputs, amounts and
 * outputs, levelling the skill your own go trains; quality and timing are the
 * worker's own, and its stage's batches a go (`hands_trade`) or loads a trip
 * (`load_trade`). No tool, as for every worker (`recipe_in_stores`).
 *
 *   dulla    moss      cuts moss off a moss tile (`cut_moss`), moss only, and walks home with it;
 *   rootle   vine      plants grape cuttings at your trellises with no vine (`plant_vine`);
 *   spitta   lily      plants water lily roots and lotus seeds in still water on your settlement (`plant_lily`, `plant_lotus`);
 *   crakka   concrete  mixes concrete (`mix_concrete`) at the stores;
 *   glossa   mortar    mixes mortar (`make_mortar`) at the stores;
 *   carra    timber    saws logs into timbers (`make_timbers`) at the stores;
 *   awla     shaft     carves logs into shafts (`make_shafts`) at the stores;
 *   scorcha  alloy     mixes bronze, brass, steel, pewter and electrum at a lit smelter of yours, at the lumps' quality as
 *                      your own hands do (`ql_from_inputs`);
 *   leecha   bandage   makes bandages, healing covers and salves at the stores, no Salve learned;
 *   frosta   cheese    presses cheese (`make_cheese`) at the stores;
 *   whirla   churn     churns butter at a butter churn of yours (`churn_butter`);
 *   brittla  distil    distils ale, cider, mead, wine and grape wine at a lit campfire or oven of yours, no Distil learned.
 *
 * No worker glazes or butchers any more: those two trades go, and their
 * branches with them. The ten of these that kept watch no longer do, and
 * have no ability or fighting style: that comes in with the definitions
 * (`20261101100000_defs.sql`), which are the species, the trades' skills and
 * words, and their learning paces. One of yours keeps its level: its new
 * trade's skill is put at least at its old one's, whatever it had in its arms
 * goes into your stores, and a spar it was in is over.
 */

create or replace function tend_job(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('groom', 'dairy', 'heal', 'tan', 'mill', 'lamp',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch',
                    'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'fill',
                    'spin', 'nail', 'ribbon', 'glass',
                    'vine', 'lily', 'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese', 'churn', 'alloy', 'distil')
$fn$;

create or replace function worker_job_ported(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('forage', 'botanize', 'woodcut', 'mine', 'quarry',
                    'sand', 'clay', 'peat', 'reed', 'fish', 'farm', 'fetch',
                    'hod', 'mend', 'stoke', 'plant', 'compost', 'guard', 'hunt',
                    'prospect', 'water', 'seek', 'prune', 'stump', 'fruit', 'hive',
                    'groom', 'dairy', 'heal', 'tan', 'mill', 'lamp',
                    'bush', 'grass', 'pan',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch',
                    'worm', 'sprout', 'resin', 'flower', 'scrub',
                    'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'fill',
                    'spin', 'nail', 'ribbon', 'glass',
                    'moss', 'vine', 'lily', 'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese', 'churn', 'alloy', 'distil')
$fn$;

-- The trades that work their stage's number a go (`HANDS_TRADES`).
create or replace function hands_trade(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('mend', 'restore', 'tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'cook',
                    'paper', 'ash', 'groom', 'dairy', 'heal', 'spin', 'nail', 'ribbon', 'glass',
                    'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese', 'churn', 'alloy', 'distil')
$fn$;

-- The trades that carry their stage's loads a trip (`LOAD_TRADES`).
create or replace function load_trade(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('forage', 'botanize', 'woodcut', 'farm', 'mine', 'sand', 'clay', 'quarry', 'fetch', 'peat', 'reed', 'fish',
                    'seek', 'fruit', 'bush', 'grass', 'pan', 'worm', 'sprout', 'resin', 'flower', 'compost', 'moss',
                    'water', 'hod', 'stoke', 'plant', 'lamp', 'patch', 'fill', 'vine', 'lily')
$fn$;

-- The recipes the errands at the stores and at a piece of yours work, in the order they try them (`STORE_RECIPES`,
-- `LYE_RECIPES`, `cookRecipes`, `distilRecipes`, `STATION_TRADES`, `SMELTER_TRADES`).
create or replace function tend_recipes(p_kind text) returns text[] language sql immutable as $fn$
  select case p_kind
    when 'tan' then array['tan_hide']
    when 'mill' then array['make_flour', 'make_cornmeal', 'press_olives']
    when 'saw' then array['make_planks']
    when 'chisel' then array['make_stone_brick']
    when 'brick' then array['make_clay_brick']
    when 'rope' then array['make_rope']
    when 'fletch' then array['make_arrows']
    when 'concrete' then array['mix_concrete']
    when 'mortar' then array['make_mortar']
    when 'timber' then array['make_timbers']
    when 'shaft' then array['make_shafts']
    when 'bandage' then array['make_bandage', 'make_cover_thyme', 'make_cover_basil', 'make_cover_mint', 'make_cover_sage',
                              'make_cover_rosemary', 'make_salve_thyme', 'make_salve_basil', 'make_salve_mint', 'make_salve_sage',
                              'make_salve_rosemary']
    when 'cheese' then array['make_cheese']
    when 'paper' then array['make_papyrus']
    when 'spin' then array['spin_wool', 'spin_cotton', 'spin_wemp']
    when 'churn' then array['churn_butter']
    when 'glass' then array['make_glass']
    when 'alloy' then array['make_bronze', 'make_brass', 'make_steel', 'make_pewter', 'make_electrum']
    when 'distil' then array['distil_ale', 'distil_cider', 'distil_mead', 'distil_wine', 'distil_grape_wine']
    when 'ash' then array['make_lye']
    when 'cook' then array['cook_meat', 'bake_potato', 'roast_onion', 'roast_nuts', 'roast_lotus_seeds', 'make_compote',
                           'fry_meat', 'make_pottage', 'make_preserves', 'bake_bread', 'make_porridge', 'bake_pastry',
                           'make_apple_pie', 'make_cherry_preserves', 'make_cottage_pie', 'make_stew', 'cook_minnow', 'cook_perch', 'cook_trout',
                           'cook_pike', 'cook_sturgeon'] end
$fn$;

-- What a trade that walks out to a tile looks for, for its idle words (`IDLE_SOURCE`).
create or replace function work_words(p_kind text) returns text language sql immutable as $fn$
  select case p_kind
    when 'woodcut' then 'trees to fell'
    when 'prune'   then 'trees worth pruning'
    when 'fruit'   then 'fruit on the bough'
    when 'stump'   then 'stumps to dig out'
    when 'mine'    then 'bare rock with a seam in it'
    when 'quarry'  then 'bare rock to cut'
    when 'sand'    then 'sand to collect'
    when 'clay'    then 'clay to collect'
    when 'peat'    then 'peat to collect'
    when 'reed'    then 'reeds to cut'
    when 'fish'    then 'water worth a rod'
    when 'seek'    then 'ground worth turning over'
    when 'farm'    then 'fields wanting work'
    when 'hive'    then 'hive to tend'
    when 'bush'    then 'bushes or vines to pick'
    when 'grass'   then 'grass or moss to cut'
    when 'moss'    then 'moss to cut'
    when 'pan'     then 'sand at the water to pan'
    when 'worm'    then 'ground to dig for worms'
    when 'sprout'  then 'trees to pick a sprout off'
    when 'resin'   then 'pines to tap'
    when 'flower'  then 'wildflowers to pick'
    when 'scrub'   then 'moss or ivy on your stone'
    else 'work' end
$fn$;

-- What an alloy a scorcha mixes comes out at (`ALLOY_QL`). The definitions write these again from the TypeScript;
-- written here too so the errand that reads them has them, and the doors are locked on them.
create or replace function alloy_ql_base() returns double precision language sql immutable as $fn$ select 0.78::double precision $fn$;
create or replace function alloy_ql_span() returns double precision language sql immutable as $fn$ select 460::double precision $fn$;

-- A trellis of yours within reach of the totem with no vine, at ground level on soil a vine takes (`vine_refusal`'s own
-- rule for planting one), nearest first: a rootle's.
create or replace function vine_target(p_world uuid, c creature, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = 'furniture' and p.sub = vine_kind()
     and p.vine_at is null and coalesce(p.level, 0) = 0 and vine_soil(land_tile(p_world, p.x::int, p.y::int))
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

-- Water on your settlement within a spitta's reach that a water plant takes (`plant_refusal`), with ground beside it to
-- stand on (`beside_tile`), and that ground: ring by ring out from the totem, each ring row by row (`lilySpot`).
create or replace function lily_spot(p_world uuid, c creature)
returns table(x int, y int, sx int, sy int) language plpgsql stable as $fn$
declare dd deed; v_rng int := work_range(c); v_ring int; t record; b record;
begin
  select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if not found then return; end if;
  for v_ring in 0..v_rng loop
    for t in select dd.x + gx as tx, dd.y + gy as ty
               from generate_series(-v_ring, v_ring) gy, generate_series(-v_ring, v_ring) gx
              where greatest(abs(gx), abs(gy)) = v_ring order by gy, gx loop
      continue when not in_bounds(p_world, t.tx, t.ty) or not has_water(p_world, t.tx, t.ty)
                 or not on_my_deed(p_world, c.keeper, t.tx, t.ty) or plant_refusal(p_world, 'lily', t.tx, t.ty) is not null;
      select * into b from beside_tile(p_world, t.tx, t.ty);
      continue when b.x is null;
      x := t.tx; y := t.ty; sx := b.x; sy := b.y;
      return next;
      return;
    end loop;
  end loop;
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    (1, 'errand_step',
$$  elsif kind = 'butcher' then
    declare v_s record;
    begin
      select * into v_s from store_holding(p_world, c.keeper, array['corpse'], c.to_x, c.to_y);
      if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
      gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      return next;
      return;
    end;

  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch') then$$,
$$  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese') then$$, 1),

    (2, 'errand_step',
$$  elsif kind = 'glaze' then
    declare v_g record;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      if stores_count(p_world, c.keeper, 'ash') < glaze_ash() then why := 'stock'; why_n := null; return next; return; end if;
      select * into v_g from glaze_in_stores(p_world, c.keeper, c.to_x, c.to_y);
      if v_g.id is null then why := 'stock'; why_n := null; return next; return; end if;
      gx := v_g.cx; gy := v_g.cy; want := null; wx := v_g.x; wy := v_g.y;
      return next;
      return;
    end;

  elsif kind = 'fill' then$$,
$$  elsif kind = 'fill' then$$, 1),

    (3, 'errand_step',
$$  elsif kind = 'plant' then$$,
$$  elsif kind = 'churn' then
    declare v_r record; v_p placed;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('churn'));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := station_target(p_world, c, 'butter_churn', c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'alloy' then
    declare v_r record; v_p placed;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('alloy'));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := glass_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'distil' then
    declare v_r record; v_p placed;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('distil'));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := cook_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'vine' then
    declare v_p placed; v_s record; v_hold boolean := coalesce(c.carrying->>'def' = grape_cutting_item(), false);
    begin
      if c.carrying is not null and not v_hold then
        select * into v_s from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_s.id is null then why := 'full'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      v_p := vine_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      if not v_hold then
        select * into v_s from store_holding(p_world, c.keeper, array[grape_cutting_item()], c.to_x, c.to_y);
        if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      else
        gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
      end if;
      return next;
      return;
    end;

  elsif kind = 'lily' then
    declare v_s record; v_at record; v_roots text[] := array(select w.from_item from water_plant_def w order by w.id);
            v_hold boolean := coalesce(c.carrying->>'def' = any(array(select w.from_item from water_plant_def w)), false);
    begin
      if c.carrying is not null and not v_hold then
        select * into v_s from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_s.id is null then why := 'full'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      select * into v_at from lily_spot(p_world, c);
      if v_at.x is null then why := 'range'; why_n := rng; return next; return; end if;
      if not v_hold then
        select * into v_s from store_holding(p_world, c.keeper, v_roots, c.to_x, c.to_y);
        if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      else
        gx := v_at.sx + 0.5; gy := v_at.sy + 0.5; want := null; wx := v_at.x; wy := v_at.y;
      end if;
      return next;
      return;
    end;

  elsif kind = 'plant' then$$, 1),

    (4, 'errand_do',
$$  elsif kind = 'butcher' then
    -- At the store with a carcass in it: taken apart as a butcher of its skill with a knife as good would (`butcher_yield`).
    declare v_c item; sp species_def; v_share double precision; v_ql double precision; r record; v_n int; v_got text;
    begin
      select (s.it).* into v_c from deed_store_items(p_world, c.keeper) s
       where (s.it).def = 'corpse' and not coalesce((s.it).locked, false) and s.x = c.work_x and s.y = c.work_y
       order by (s.it).id limit 1;
      if v_c.id is null then return false; end if;
      sp := corpse_species(v_c.extra);
      if sp.id is null then return false; end if;
      if not item_take_units(v_c, 1) then return false; end if;
      v_share := butcher_yield(skill, skill);
      v_ql := worker_made_ql(c, skill);
      for r in select sb.n from species_butcher sb where sb.species = sp.id and sb.part = 'hoard' loop
        for v_n in 1..round(r.n * (4 + v_share * 6))::int loop
          select item into v_got from hoard_metal order by random() limit 1;
          perform worker_put(p_world, c, v_got, 1, greatest(20, least(100, 40 + random() * 55)), c.work_x, c.work_y);
        end loop;
      end loop;
      for r in select b.part, b.item, sb.n from butcher_part b
               join species_butcher sb on sb.part = b.part and sb.species = sp.id order by b.ord loop
        v_n := floor(r.n * v_share)::int;
        if random() < r.n * v_share - v_n then v_n := v_n + 1; end if;
        if r.part = 'gland' and v_n > 0 and random() > 0.35 * (0.5 + v_share) then v_n := 0; end if;
        if v_n > 0 then perform worker_put(p_world, c, r.item, v_n, v_ql, c.work_x, c.work_y); end if;
      end loop;
      if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.3); end if;
      return true;
    end;

  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch') then
    -- A recipe worked at the stores: its inputs out of them, its tool kept in one, and what it makes back in.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item], c.work_x, c.work_y); end loop; end if;
      end loop;
      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y);$$,
$$  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'concrete', 'mortar', 'timber', 'shaft', 'bandage', 'cheese') then
    -- A recipe worked at the stores: its inputs out of them, and what it makes back in, with what the recipe stamps on it
    -- (a healing cover's herb).
    declare v_r record; r recipe; ri record; v_i int;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item], c.work_x, c.work_y); end loop; end if;
      end loop;
      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y, r.extra);$$, 1),

    (5, 'errand_do',
$$  elsif kind = 'glaze' then
    -- The ash out of the stores and brushed over it, as an Artisan's glaze is (`glaze_item`): it never decays after.
    declare v_g record; v_i int;
    begin
      if c.carrying is not null or stores_count(p_world, c.keeper, 'ash') < glaze_ash() then return false; end if;
      select * into v_g from glaze_in_stores(p_world, c.keeper, c.to_x, c.to_y);
      if v_g.id is null then return false; end if;
      for v_i in 1..glaze_ash()::int loop perform take_one_stored(p_world, c.keeper, array['ash'], v_g.x, v_g.y); end loop;
      update item set mark = coalesce(mark, '{}'::jsonb) || '{"glaze": 0}'::jsonb where id = v_g.id;
      if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.2); end if;
      return true;
    end;

  elsif kind = 'fill' then$$,
$$  elsif kind = 'fill' then$$, 1),

    (6, 'errand_do',
$$  elsif kind = 'plant' then$$,
$$  elsif kind = 'churn' then
    -- At a butter churn of yours, the milk out of the stores and the butter and the bucket back in.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      if c.carrying is not null then return false; end if;
      if not exists (select 1 from placed p where p.world_id = p_world and p.kind = 'furniture' and p.sub = 'butter_churn'
                       and on_my_deed(p_world, c.keeper, p.x, p.y)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('churn'));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item]); end loop; end if;
      end loop;
      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y);
      for ri in select * from recipe_gives where recipe = r.id and recipe_gives.kind = 'return' loop
        perform private.worker_put_back(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);
      end loop;
      if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.25); end if;
      return true;
    end;

  elsif kind = 'alloy' then
    -- At a lit smelter of yours, charged or not, the lumps out of the stores and the alloy back in, at the quality of
    -- the lumps by weight as your own hands mix it (`perform_craft`'s `ql_from_inputs`), its line's third-stage lumps
    -- on each batch.
    declare v_r record; r recipe; ri record; v_i int; v_one jsonb; v_w double precision;
            v_qls double precision := 0; v_wt double precision := 0; v_ql double precision;
    begin
      if c.carrying is not null then return false; end if;
      if not exists (select 1 from placed p where p.world_id = p_world and p.kind = 'smelter' and placed_lit(p)
                       and on_my_deed(p_world, c.keeper, p.x, p.y)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('alloy'));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        v_w := coalesce((select idf.weight from item_def idf where idf.id = ri.item), 1);
        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else
          for v_i in 1..ri.count loop
            v_one := take_one_stored(p_world, c.keeper, array[ri.item]);
            if v_one is not null then v_qls := v_qls + (v_one->>'ql')::double precision * v_w; v_wt := v_wt + v_w; end if;
          end loop;
        end if;
      end loop;
      v_ql := case when r.ql_from_inputs
                   then least(100, greatest(1, (case when v_wt > 0 then v_qls / v_wt else 1 end) * (alloy_ql_base() + skill / alloy_ql_span())
                                              * beast_mul(c, 'yield')))
                   else worker_made_ql(c, skill) end;
      perform worker_put(p_world, c, r.result, r.count + perk_n(c, 'more')::int, v_ql, c.work_x, c.work_y);
      for ri in select * from recipe_gives where recipe = r.id and recipe_gives.kind = 'return' loop
        perform private.worker_put_back(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);
      end loop;
      if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.25); end if;
      return true;
    end;

  elsif kind = 'distil' then
    -- At a lit campfire or oven of yours, the first brew the stores hold three buckets of, distilled into a bucket of
    -- spirit, as a Cook's Distil does it, and the spirit and the empty buckets put in the stores. No Distil learned.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      if not exists (select 1 from placed p where p.world_id = p_world and (p.kind = 'campfire' or is_oven(p)) and placed_lit(p)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('distil'));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item]); end loop; end if;
      end loop;
      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y);
      for ri in select * from recipe_gives where recipe = r.id and recipe_gives.kind = 'return' loop
        perform private.worker_put_back(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);
      end loop;
      if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.25); end if;
      return true;
    end;

  elsif kind = 'vine' then
    -- A trellis of yours with no vine, at ground level on soil: a grape cutting planted at its foot, as your own hands
    -- plant one (`perform_vine`). At the stores: its stage's cuttings into its arms.
    declare v_p placed; v_hold boolean := coalesce(c.carrying->>'def' = grape_cutting_item(), false);
    begin
      select p.* into v_p from placed p where p.world_id = p_world and p.kind = 'furniture' and p.sub = vine_kind()
        and p.x = c.work_x and p.y = c.work_y and p.vine_at is null and coalesce(p.level, 0) = 0
        and vine_soil(land_tile(p_world, p.x::int, p.y::int)) and on_my_deed(p_world, c.keeper, p.x, p.y)
       order by p.id limit 1;
      if v_p.id is not null and v_hold then
        update placed set vine_at = vine_now(), picked_at = null where id = v_p.id;
        update creature set carrying = load_less(carrying) where world_id = p_world and id = p_id;
        perform land_announce(p_world, v_p.x::int, v_p.y::int);
        if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.25); end if;
        return true;
      end if;
      if c.carrying is not null and not v_hold then
        perform private.worker_put_back(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int, (c.carrying->>'ql')::double precision,
                           c.work_x, c.work_y, c.carrying->>'extra');
        update creature set carrying = null where world_id = p_world and id = p_id;
        return true;
      end if;
      if not v_hold then
        update creature set carrying = take_some_stored(p_world, c.keeper, array[grape_cutting_item()], stage_loads(c), c.work_x, c.work_y)
         where world_id = p_world and id = p_id;
        return true;
      end if;
      return false;
    end;

  elsif kind = 'lily' then
    -- Water on your settlement a water plant takes: a water lily root or lotus seeds planted in it, as your own hands
    -- plant one (`perform_water_garden`). At the stores: its stage's roots or seeds into its arms.
    declare v_kind text; v_hold boolean := coalesce(c.carrying->>'def' = any(array(select w.from_item from water_plant_def w)), false);
    begin
      if v_hold then
        select w.id into v_kind from water_plant_def w where w.from_item = c.carrying->>'def';
        if c.work_x is null or not on_my_deed(p_world, c.keeper, c.work_x, c.work_y)
           or plant_refusal(p_world, v_kind, c.work_x, c.work_y) is not null then return false; end if;
        insert into water_plant (world_id, x, y, kind, planted_at, planted_by) values (p_world, c.work_x, c.work_y, v_kind, now(), c.keeper);
        update creature set carrying = load_less(carrying) where world_id = p_world and id = p_id;
        if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.25); end if;
        return true;
      end if;
      if c.carrying is not null then
        perform private.worker_put_back(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int, (c.carrying->>'ql')::double precision,
                           c.work_x, c.work_y, c.carrying->>'extra');
        update creature set carrying = null where world_id = p_world and id = p_id;
        return true;
      end if;
      update creature set carrying = take_some_stored(p_world, c.keeper, array(select w.from_item from water_plant_def w order by w.id),
                                                      stage_loads(c), c.work_x, c.work_y)
       where world_id = p_world and id = p_id;
      return true;
    end;

  elsif kind = 'plant' then$$, 1),

    (7, 'worker_gatherable',
$$  elsif p_kind = 'pan' then$$,
$$  elsif p_kind = 'moss' then
    -- Moss grown back since its last cut, as your own hands cut it (`cut_moss`).
    return here = tile_id('Moss') and creature_tile_ok(p_world, p_x, p_y) and not is_foraged(p_world, p_x, p_y, 'moss');
  elsif p_kind = 'pan' then$$, 1),

    (8, 'worker_do',
$$  elsif kind = 'pan' then$$,
$$  elsif kind = 'moss' then
    -- As your own hands cut it (`cut_moss`): the tile stays moss and is short until it has grown back.
    if here <> tile_id('Moss') then return null; end if;
    perform mark_foraged(p_world, wx, wy, 'moss');
    return jsonb_build_object('def', 'moss', 'count', moss_per_cut()::int, 'ql', made_ql);
  elsif kind = 'pan' then$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

-- Its level kept: one of yours of these kinds has its new trade's skill at least at its old one's (keeping watch,
-- glazing's pottery, butchering).
do $do$
declare r record;
begin
  for r in select * from (values
    ('dulla', 'body_strength', 'foraging'), ('rootle', 'body_strength', 'forestry'), ('spitta', 'body_strength', 'botanizing'),
    ('crakka', 'body_strength', 'masonry'), ('awla', 'body_strength', 'carpentry'), ('scorcha', 'body_strength', 'smelting'),
    ('leecha', 'body_strength', 'first_aid'), ('frosta', 'body_strength', 'cooking'), ('whirla', 'body_strength', 'cooking'),
    ('brittla', 'body_strength', 'brewing'), ('glossa', 'pottery', 'masonry'), ('carra', 'butchering', 'carpentry')
  ) as t(species, was, now) loop
    update creature set skills = jsonb_set(coalesce(skills, '{}'::jsonb), array[r.now],
             to_jsonb(greatest(coalesce((skills->>r.now)::double precision, 0), (skills->>r.was)::double precision)))
     where species = r.species and keeper is not null and skills ? r.was;
  end loop;
end $do$;

-- What one of them has in its arms from its old trade, into its keeper's stores (or onto the ground where it stands);
-- a trade of its own it was set to, and a spar it was in, over.
do $do$
declare c creature;
begin
  for c in select * from creature
            where species in ('dulla', 'rootle', 'spitta', 'crakka', 'glossa', 'carra', 'awla', 'scorcha', 'leecha', 'frosta', 'whirla', 'brittla')
              and keeper is not null and carrying is not null loop
    perform worker_put(c.world_id, c, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1),
                       coalesce((c.carrying->>'ql')::double precision, 40), floor(c.to_x)::int, floor(c.to_y)::int, c.carrying->>'extra');
    update creature set carrying = null where world_id = c.world_id and id = c.id;
  end loop;
end $do$;
update creature set spar_with = null, spar_at = null, phase = case when phase = 'spar' then 'idle' else phase end
 where spar_with is not null and (world_id, spar_with) in (select world_id, id from creature
        where species in ('dulla', 'rootle', 'spitta', 'crakka', 'awla', 'scorcha', 'leecha', 'frosta', 'whirla', 'brittla'));
update creature set job = null, spar_with = null, spar_at = null,
       phase = case when phase = 'spar' then 'idle' else phase end, idle_why = null, idle_n = null, idle_what = null
 where species in ('dulla', 'rootle', 'spitta', 'crakka', 'glossa', 'carra', 'awla', 'scorcha', 'leecha', 'frosta', 'whirla', 'brittla')
   and keeper is not null;

select private.lock_doors();
