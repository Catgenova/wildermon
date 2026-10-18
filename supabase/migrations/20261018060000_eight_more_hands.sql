-- Eight more hands on a settlement.
--
-- Asked for, off a third list of work only a player did: a rippa saws planks,
-- a chissa chisels stone brick, a mudda shapes clay brick, a cordra lays up
-- rope and a flecha fletches arrows, each at the stores off the recipe your
-- own hands use; a papra presses papyrus at a paper press of yours; a glossa
-- glazes the fired pottery in the stores with the ash in them; and a dippa
-- takes the empty buckets out of the stores, fills them at the shore or a
-- well and puts them back full. The species and their trades come in with the
-- definitions; this is what each trade does, the same as the browser's
-- (`Creatures.recipeStep`, `pressStep`, `glazeStep`, `fillStep`). All eight
-- are errands.

create or replace function worker_job_ported(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('forage', 'botanize', 'woodcut', 'mine', 'quarry',
                    'sand', 'clay', 'peat', 'reed', 'fish', 'farm', 'fetch',
                    'hod', 'mend', 'stoke', 'plant', 'compost', 'guard', 'hunt',
                    'prospect', 'water', 'seek', 'prune', 'stump', 'fruit', 'hive',
                    'groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp',
                    'bush', 'grass', 'pan',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch',
                    'worm', 'sprout', 'resin', 'flower', 'scrub',
                    'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'glaze', 'fill')
$fn$;

create or replace function tend_job(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch',
                    'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'glaze', 'fill')
$fn$;

-- The recipes the errands at the stores work, in the order they try them (`STORE_RECIPES`, `LYE_RECIPES`,
-- `cookRecipes`, `PAPER_RECIPES`).
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
    when 'ash' then array['make_lye']
    when 'cook' then array['cook_meat', 'bake_potato', 'roast_onion', 'roast_nuts', 'roast_lotus_seeds', 'make_compote',
                           'fry_meat', 'make_pottage', 'make_preserves', 'bake_bread', 'make_porridge', 'bake_pastry',
                           'make_apple_pie', 'make_cherry_preserves', 'make_stew', 'cook_minnow', 'cook_perch', 'cook_trout',
                           'cook_pike', 'cook_sturgeon'] end
$fn$;

-- A paper press of yours within reach of the token.
create or replace function press_target(p_world uuid, c creature, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = 'furniture' and p.sub = 'paper_press'
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

-- The nearest fired pot, bowl, jar or amphora in the stores with no glaze on it, and the store it is in.
create or replace function glaze_in_stores(p_world uuid, p_uid uuid, p_x double precision, p_y double precision)
returns table(id bigint, x int, y int, cx double precision, cy double precision)
language sql stable as $fn$
  select (s.it).id, s.x, s.y, s.cx, s.cy from deed_store_items(p_world, p_uid) s
   where glazeable((s.it).def) and not coalesce((s.it).mark, '{}'::jsonb) ? 'glaze' and not coalesce((s.it).locked, false)
   order by (s.cx - p_x) ^ 2 + (s.cy - p_y) ^ 2, s.kind, s.sid, (s.it).id limit 1
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The five at the stores work as a tanna and a grista do.
    (1, 'errand_step', $$  elsif kind in ('tan', 'mill') then$$,
                       $$  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch') then$$, 1),
    (2, 'errand_do', $$  elsif kind in ('tan', 'mill') then$$,
                     $$  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch') then$$, 1),

    -- Where a papra, a glossa and a dippa go next.
    (3, 'errand_step', $$  elsif kind = 'plant' then$$,
                       $$  elsif kind = 'paper' then
    declare v_r record; v_p placed;
    begin
      if c.carrying is not null then return; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('paper'));
      if v_r.rid is null then return; end if;
      v_p := press_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'glaze' then
    declare v_g record;
    begin
      if c.carrying is not null or stores_count(p_world, c.keeper, 'ash') < glaze_ash() then return; end if;
      select * into v_g from glaze_in_stores(p_world, c.keeper, c.to_x, c.to_y);
      if v_g.id is null then return; end if;
      gx := v_g.cx; gy := v_g.cy; want := null; wx := v_g.x; wy := v_g.y;
      return next;
      return;
    end;

  elsif kind = 'fill' then
    -- Full, or holding something it cannot fill: home to the stores. Empty-handed: a bucket out of them. Holding
    -- an empty bucket: to the water.
    declare v_s record; v_wet record; v_def text := c.carrying->>'def';
    begin
      select * into v_wet from water_source(p_world, dd.x, dd.y, rng, c);
      if v_def is not null and (v_def <> 'bucket' or v_wet.x is null) then
        select * into v_s from worker_store(p_world, c, v_def, (c.carrying->>'count')::int);
        if v_s.id is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      if v_wet.x is null then return; end if;
      if v_def = 'bucket' then
        gx := v_wet.gx; gy := v_wet.gy; want := null; wx := v_wet.x; wy := v_wet.y;
        return next;
        return;
      end if;
      select * into v_s from store_holding(p_world, c.keeper, array['bucket'], c.to_x, c.to_y);
      if v_s.x is null then return; end if;
      gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      return next;
      return;
    end;

  elsif kind = 'plant' then$$, 1),

    -- And what each does when it gets there.
    (4, 'errand_do', $$  elsif kind = 'plant' then$$,
                     $$  elsif kind = 'paper' then
    -- At a paper press of yours, the reeds and a bucket of water out of the stores, and the sheets and the bucket back in.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      if c.carrying is not null then return false; end if;
      if not exists (select 1 from placed p where p.world_id = p_world and p.kind = 'furniture' and p.sub = 'paper_press'
                       and on_my_deed(p_world, c.keeper, p.x, p.y)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('paper'));
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

  elsif kind = 'glaze' then
    -- The ash out of the stores and brushed over it, as an Artisan's glaze is (`glaze_item`): it never decays after.
    declare v_g record; v_i int;
    begin
      if c.carrying is not null or stores_count(p_world, c.keeper, 'ash') < glaze_ash() then return false; end if;
      select * into v_g from glaze_in_stores(p_world, c.keeper, c.to_x, c.to_y);
      if v_g.id is null then return false; end if;
      for v_i in 1..glaze_ash()::int loop perform take_one_stored(p_world, c.keeper, array['ash'], v_g.x, v_g.y); end loop;
      update item set mark = coalesce(mark, '{}'::jsonb) || '{"glaze": 0}'::jsonb where id = v_g.id;
      perform worker_learn(p_world, p_id, skill_id, 0.2);
      return true;
    end;

  elsif kind = 'fill' then
    declare v_well placed; v_one jsonb; v_def text := c.carrying->>'def';
    begin
      if v_def is null then
        -- An empty bucket out of the store it walked to.
        v_one := take_one_stored(p_world, c.keeper, array['bucket'], c.work_x, c.work_y);
        if v_one is null then return false; end if;
        update creature set carrying = jsonb_build_object('def', 'bucket', 'count', 1, 'ql', v_one->'ql')
         where world_id = p_world and id = p_id;
        return true;
      end if;
      if v_def = 'bucket' then
        -- Filled where it stands, if that is water: a well is drawn down by what is taken, a shore is not.
        select p2.* into v_well from placed p2 where p2.world_id = p_world and p2.kind = 'furniture'
          and p2.x = c.work_x and p2.y = c.work_y and is_well(p2) limit 1;
        if (v_well.id is not null and draw_from(v_well.id, bucket_litres()))
           or (v_well.id is null and has_water(p_world, c.work_x, c.work_y)) then
          update creature set carrying = jsonb_set(carrying, '{def}', '"water_bucket"')
           where world_id = p_world and id = p_id;
          perform worker_learn(p_world, p_id, skill_id, 0.2);
          return true;
        end if;
      end if;
      -- Anything else in its arms goes into the stores where it stands.
      perform worker_put(p_world, c, v_def, coalesce((c.carrying->>'count')::int, 1),
                         coalesce((c.carrying->>'ql')::double precision, 40), c.work_x, c.work_y, c.carrying->>'extra');
      update creature set carrying = null where world_id = p_world and id = p_id;
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
