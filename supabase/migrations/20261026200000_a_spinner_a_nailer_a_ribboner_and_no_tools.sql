-- A spinner, a nail smith and a ribbon smith, and no worker needs a tool.
--
-- Asked for: an ulva spins wool, cotton and wemp from the stores into yarn at
-- a spindle of yours, as your own hands spin it (`spin_wool`, `spin_cotton`,
-- `spin_wemp`), and no longer guards; a dowse beats iron lumps from the stores
-- into nails at an anvil of yours, as many a lump as a nail mould's filling
-- makes, and no longer prospects; a siffa beats lumps of any metal but the
-- rare ones into metal ribbons at an anvil of yours, and no longer pans. No
-- mould, no hammer: the lump is beaten out at the anvil. The species and their
-- trades come in with the definitions, and so do `smith_mould` and
-- `smith_lumps`; this is what each trade does, the same as the browser's
-- (`Creatures.pressStep`, `anvilStep`).
--
-- And no wildermon needs or uses a tool: a recipe worked by a worker
-- (`recipe_in_stores`) no longer looks for its tool in the stores, so a rippa
-- saws with no saw, a chissa with no chisel, a cordra with no rope tool, a
-- flecha and a tanna with no carving knife, a grista with no quern and a simma
-- with no bowl, pot, jar or pan. None was ever worn by a worker. What it makes
-- comes out at its own hand's quality (`worker_made_ql`), as it always did.
--
-- An ulva, a dowse or a siffa of yours keeps its level: its new trade's skill
-- is put at least at its old one's (keeping watch, prospecting), and whatever
-- one has in its arms from its old trade goes into your stores.

create or replace function tend_job(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp',
                    'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch',
                    'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'glaze', 'fill',
                    'spin', 'nail', 'ribbon')
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
                    'spin', 'nail', 'ribbon')
$fn$;

-- The trades that work their stage's number a go (`HANDS_TRADES`).
create or replace function hands_trade(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('mend', 'butcher', 'restore', 'glaze', 'tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'cook',
                    'paper', 'ash', 'groom', 'dairy', 'heal', 'spin', 'nail', 'ribbon')
$fn$;

-- The recipes the errands at the stores and at a piece of yours work, in the order they try them (`STORE_RECIPES`,
-- `LYE_RECIPES`, `cookRecipes`, `STATION_TRADES`).
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
    when 'ash' then array['make_lye']
    when 'cook' then array['cook_meat', 'bake_potato', 'roast_onion', 'roast_nuts', 'roast_lotus_seeds', 'make_compote',
                           'fry_meat', 'make_pottage', 'make_preserves', 'bake_bread', 'make_porridge', 'bake_pastry',
                           'make_apple_pie', 'make_cherry_preserves', 'make_cottage_pie', 'make_stew', 'cook_minnow', 'cook_perch', 'cook_trout',
                           'cook_pike', 'cook_sturgeon'] end
$fn$;

-- The first of these recipes the stores hold every input for. A worker needs no tool, so a recipe's is not looked for.
create or replace function recipe_in_stores(p_world uuid, p_uid uuid, p_recipes text[])
returns table(rid text, x int, y int, cx double precision, cy double precision)
language plpgsql stable as $fn$
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
end $fn$;

-- What a dowse and a siffa smith (`SMITH_TRADES`): the mould whose piece and count a lump makes, and the lumps each
-- takes, in the order it takes them. The definitions write these again from the TypeScript; written here first so
-- that the doors are locked on them (`create or replace` keeps what may execute a function).
create or replace function smith_mould(p_kind text) returns text language sql immutable as $fn$ select case p_kind when 'nail' then 'nail_mould' when 'ribbon' then 'ribbon_mould' end $fn$;
create or replace function smith_lumps(p_kind text) returns text[] language sql immutable as $fn$ select case p_kind when 'nail' then array['iron_lump']::text[] when 'ribbon' then array['copper_lump', 'iron_lump', 'tin_lump', 'zinc_lump', 'lead_lump', 'bronze_lump', 'brass_lump', 'pewter_lump', 'electrum_lump', 'steel_lump']::text[] end $fn$;

-- A piece of furniture of yours of this kind within reach of the token, nearest first: an ulva's spindle.
create or replace function station_target(p_world uuid, c creature, p_sub text, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = 'furniture' and p.sub = p_sub
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

-- An anvil of yours within reach of the token, nearest first: a dowse's and a siffa's.
create or replace function anvil_target(p_world uuid, c creature, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = 'anvil'
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Where an ulva, a dowse and a siffa go next.
    (1, 'errand_step', $$  elsif kind = 'plant' then$$,
                       $$  elsif kind = 'spin' then
    declare v_r record; v_p placed;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('spin'));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := station_target(p_world, c, 'spindle', c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind in ('nail', 'ribbon') then
    declare v_p placed;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      if not exists (select 1 from unnest(smith_lumps(kind)) l where stores_count(p_world, c.keeper, l) > 0) then
        why := 'stock'; why_n := null; return next; return;
      end if;
      v_p := anvil_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'plant' then$$, 1),

    -- And what each does when it gets there.
    (2, 'errand_do', $$  elsif kind = 'plant' then$$,
                     $$  elsif kind = 'spin' then
    -- At a spindle of yours, the fibre out of the stores and the yarn back in.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      if c.carrying is not null then return false; end if;
      if not exists (select 1 from placed p where p.world_id = p_world and p.kind = 'furniture' and p.sub = 'spindle'
                       and on_my_deed(p_world, c.keeper, p.x, p.y)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('spin'));
      if v_r.rid is null then return false; end if;
      select * into r from recipe where id = v_r.rid;
      for ri in select * from recipe_input where recipe = r.id order by ord loop
        if ri.litres is not null then perform take_litres_stored(p_world, c.keeper, ri.item, ri.litres);
        else for v_i in 1..ri.count loop perform take_one_stored(p_world, c.keeper, array[ri.item]); end loop; end if;
      end loop;
      perform worker_put(p_world, c, r.result, r.count, worker_made_ql(c, skill), c.work_x, c.work_y);
      for ri in select * from recipe_gives where recipe = r.id and recipe_gives.kind = 'return' loop
        perform worker_put(p_world, c, ri.item, ri.count, 40, c.work_x, c.work_y);
      end loop;
      if not p_again then perform worker_learn(p_world, p_id, skill_id, 0.25); end if;
      return true;
    end;

  elsif kind in ('nail', 'ribbon') then
    -- At an anvil of yours, a lump of the first of its metals the stores hold out of them, beaten out into as many
    -- pieces as its mould's filling makes, of that metal, at its own hand's quality, and into the stores. No mould,
    -- no hammer.
    declare v_l text; v_one jsonb; v_m mould_def;
    begin
      if c.carrying is not null then return false; end if;
      if not exists (select 1 from placed p where p.world_id = p_world and p.kind = 'anvil'
                       and on_my_deed(p_world, c.keeper, p.x, p.y)
                       and sqrt((p.cx - c.to_x) ^ 2 + (p.cy - c.to_y) ^ 2) <= 3) then return false; end if;
      select u.l into v_l from unnest(smith_lumps(kind)) with ordinality u(l, o)
       where stores_count(p_world, c.keeper, u.l) > 0 order by u.o limit 1;
      if v_l is null then return false; end if;
      select * into v_m from mould_def where id = smith_mould(kind);
      if v_m.id is null then return false; end if;
      v_one := take_one_stored(p_world, c.keeper, array[v_l]);
      if v_one is null then return false; end if;
      perform worker_put(p_world, c, v_m.makes, v_m.per, worker_made_ql(c, skill), c.work_x, c.work_y,
                         (select md.name from metal_def md where md.lump = v_l));
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

-- Its level kept: an ulva's tailoring at least its keeping watch, a dowse's and a siffa's blacksmithing at least their
-- prospecting. Only on one somebody keeps.
update creature set skills = jsonb_set(coalesce(skills, '{}'::jsonb), '{tailoring}',
         to_jsonb(greatest(coalesce((skills->>'tailoring')::double precision, 0), (skills->>'body_strength')::double precision)))
 where species = 'ulva' and keeper is not null and skills ? 'body_strength';
update creature set skills = jsonb_set(coalesce(skills, '{}'::jsonb), '{blacksmithing}',
         to_jsonb(greatest(coalesce((skills->>'blacksmithing')::double precision, 0), (skills->>'prospecting')::double precision)))
 where species in ('dowse', 'siffa') and keeper is not null and skills ? 'prospecting';

-- And what one of them has in its arms from its old trade, into its keeper's stores (or onto the ground where it stands).
do $do$
declare c creature;
begin
  for c in select * from creature where species in ('ulva', 'dowse', 'siffa') and keeper is not null and carrying is not null loop
    perform worker_put(c.world_id, c, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1),
                       coalesce((c.carrying->>'ql')::double precision, 40), floor(c.to_x)::int, floor(c.to_y)::int, c.carrying->>'extra');
    update creature set carrying = null where world_id = c.world_id and id = c.id;
  end loop;
end $do$;

select private.lock_doors();
