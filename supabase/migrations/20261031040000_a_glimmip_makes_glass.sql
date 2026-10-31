-- A glimmip makes glass lumps.
--
-- Asked for: "design the glassblowing wildermon line. Glass lumps from sand at a lit smelter". The Glimmip line
-- (Glimmip, Glascade at level 25, Prismetail at 50) is a new kind with a new trade, `glass`: at a lit smelter of yours
-- within its reach of the totem it melts sand from the stores into glass lumps, as your own hands do there
-- (`make_glass`), and puts them in the stores. Lumps only. A smelter is lit as a player needs one (`placed_lit`: lit and
-- fuelled) and, as for a player, may be charged with ore or not; it neither lights nor fuels one. It levels
-- glassblowing. At its third stage each batch makes one lump more (`perk_n(c, 'more')`). The species, its trade's skill
-- and words, its learning pace, its third-stage skill and its row in the wild table come in with the definitions; this
-- is what the trade does, the same as the browser's (`Creatures.glassStep`).

create or replace function tend_job(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch',
                    'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'glaze', 'fill',
                    'spin', 'nail', 'ribbon', 'glass')
$fn$;

create or replace function worker_job_ported(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('forage', 'botanize', 'woodcut', 'mine', 'quarry',
                    'sand', 'clay', 'peat', 'reed', 'fish', 'farm', 'fetch',
                    'hod', 'mend', 'stoke', 'plant', 'compost', 'guard', 'hunt',
                    'prospect', 'water', 'seek', 'prune', 'stump', 'fruit', 'hive',
                    'groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp',
                    'bush', 'grass', 'pan',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch',
                    'worm', 'sprout', 'resin', 'flower', 'scrub',
                    'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'glaze', 'fill',
                    'spin', 'nail', 'ribbon', 'glass')
$fn$;

-- The trades that work their stage's number a go (`HANDS_TRADES`): a glimmip, its stage's batches.
create or replace function hands_trade(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('mend', 'butcher', 'restore', 'glaze', 'tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'cook',
                    'paper', 'ash', 'groom', 'dairy', 'heal', 'spin', 'nail', 'ribbon', 'glass')
$fn$;

-- The recipes the errands at the stores and at a piece of yours work, in the order they try them (`STORE_RECIPES`,
-- `LYE_RECIPES`, `cookRecipes`, `STATION_TRADES`, `GLASS_RECIPES`).
create or replace function tend_recipes(p_kind text) returns text[] language sql immutable as $fn$
  select case p_kind
    when 'tan' then array['tan_hide']
    when 'mill' then array['make_flour', 'make_cornmeal', 'press_olives']
    when 'saw' then array['make_planks']
    when 'chisel' then array['make_stone_brick']
    when 'brick' then array['make_clay_brick']
    when 'rope' then array['make_rope']
    when 'fletch' then array['make_arrows']
    when 'paper' then array['make_papyrus']
    when 'spin' then array['spin_wool', 'spin_cotton', 'spin_wemp']
    when 'glass' then array['make_glass']
    when 'ash' then array['make_lye']
    when 'cook' then array['cook_meat', 'bake_potato', 'roast_onion', 'roast_nuts', 'roast_lotus_seeds', 'make_compote',
                           'fry_meat', 'make_pottage', 'make_preserves', 'bake_bread', 'make_porridge', 'bake_pastry',
                           'make_apple_pie', 'make_cherry_preserves', 'make_cottage_pie', 'make_stew', 'cook_minnow', 'cook_perch', 'cook_trout',
                           'cook_pike', 'cook_sturgeon'] end
$fn$;

-- A lit smelter of yours within reach of the totem, nearest first: lit as your own hands need one (`at_station`), charged
-- or not.
create or replace function glass_target(p_world uuid, c creature, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = 'smelter' and placed_lit(p)
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Where a glimmip goes next.
    (1, 'errand_step', $$  elsif kind = 'plant' then$$,
                       $$  elsif kind = 'glass' then
    declare v_r record; v_p placed;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('glass'));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := glass_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'plant' then$$, 1),

    -- And what it does when it gets there.
    (2, 'errand_do', $$  elsif kind = 'plant' then$$,
                     $$  elsif kind = 'glass' then
    -- At a lit smelter of yours, charged or not, the sand out of the stores and the lumps back in, its line's third-stage
    -- lumps on each batch.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      if c.carrying is not null then return false; end if;
      if not exists (select 1 from placed p where p.world_id = p_world and p.kind = 'smelter' and placed_lit(p)
                       and on_my_deed(p_world, c.keeper, p.x, p.y)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('glass'));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item]); end loop; end if;
      end loop;
      perform worker_put(p_world, c, r.result, r.count + perk_n(c, 'more')::int, worker_made_ql(c, skill), c.work_x, c.work_y);
      for ri in select * from recipe_gives where recipe = r.id and recipe_gives.kind = 'return' loop
        perform worker_put(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);
      end loop;
      if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.25); end if;
      return true;
    end;

  elsif kind = 'plant' then$$, 1)
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
