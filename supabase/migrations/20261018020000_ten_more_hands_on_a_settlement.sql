-- Ten more hands on a settlement.
--
-- Asked for, off a list of work players still did by hand with no wildermon
-- to give it to: a kemma brushes the herd, a sheela milks and shears it, a
-- salva dresses its hurts, a carra butchers the carcasses in the stores, a
-- tanna tans the hides, a grista mills the grain and presses the olives, a
-- wicka keeps the lanterns, a brambo picks the bushes and the vines, a grazza
-- cuts grass and moss, and a siffa pans the sand at the water's edge. The
-- species and their trades come in with the definitions; this is what each
-- trade does, the same as the browser's (`Creatures.herdStep`, `butcherStep`,
-- `recipeStep`, `lampStep`, `finishHands`).
--
-- The first seven are errands (`TEND_JOBS`): worked at the stores or at one
-- of your own, they walk to it, do one go, and bring nothing home in their
-- arms; what they make goes into the stores where it was made, then into
-- whichever store on the settlement will take it, and failing all of them
-- onto the ground there (`worker_put`). The last three walk out to a tile
-- and carry the load home, as every gatherer does.

-- The trades, among those the island works, and the seven among its errands.
create or replace function worker_job_ported(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('forage', 'botanize', 'woodcut', 'mine', 'quarry',
                    'sand', 'clay', 'peat', 'reed', 'fish', 'farm', 'fetch',
                    'hod', 'mend', 'stoke', 'plant', 'compost', 'guard', 'hunt',
                    'prospect', 'water', 'seek', 'prune', 'stump', 'fruit', 'hive',
                    'groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp',
                    'bush', 'grass', 'pan')
$fn$;

create or replace function tend_job(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp')
$fn$;

create or replace function worker_errand(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('hod', 'mend', 'stoke', 'plant', 'prospect', 'water') or tend_job(p_kind)
$fn$;

-- What a worker with nothing to do says it could not find.
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
    else 'work' end
$fn$;

-- What a worker set to the deed will do: a swarm at the hives and the seven
-- errands bring nothing to the crate, and their own words say where what they
-- make goes (`deedJobLine`).
create or replace function deed_job_line(c creature) returns text language sql stable as $fn$
  select coalesce((select g.plain || ' within ' || work_range(c) || ' tiles of the token'
                          || case when g.id = 'hive' or tend_job(g.id) then '' else ' and bring what it finds to the crate' end
                     from gather_def g
                    where g.id = coalesce(c.job, (select s.gathers from species_def s where s.id = c.species))),
                  'stay around the settlement')
$fn$;

/* ---- the numbers, the browser's ------------------------------------------------------- */

-- Care under which a kemma brushes one (`CARE_WANTING`).
create or replace function care_wanting() returns double precision language sql immutable as $fn$ select 0.4::double precision $fn$;
-- How far grown back a fleece or a cudda's milk is before a sheela takes it (`DAIRY_FULL`).
create or replace function dairy_full() returns double precision language sql immutable as $fn$ select 0.9::double precision $fn$;
-- The share of its health under which a salva dresses one (`HEAL_BELOW`).
create or replace function heal_below() returns double precision language sql immutable as $fn$ select 0.75::double precision $fn$;
-- What a salva puts on (`DRESSINGS`).
create or replace function dressings() returns text[] language sql immutable as $fn$ select array['bandage', 'cover'] $fn$;
-- A siffa's chance of something in the pan (`panFind`): an eighth at no skill, a quarter at a hundred.
create or replace function pan_find(p_skill double precision) returns double precision language sql immutable as $fn$
  select 1 / 8.0 + (1 / 4.0 - 1 / 8.0) * greatest(0, least(100, p_skill)) / 100
$fn$;
-- The recipes a tanna and a grista work at the stores (`TAN_RECIPES`, `MILL_RECIPES`).
create or replace function tend_recipes(p_kind text) returns text[] language sql immutable as $fn$
  select case p_kind when 'tan' then array['tan_hide'] when 'mill' then array['make_flour', 'make_cornmeal', 'press_olives'] end
$fn$;
-- A dressing's share of a life at a first aid and a quality (`healAmount`).
create or replace function heal_amount(p_skill double precision, p_ql double precision) returns double precision language sql immutable as $fn$
  select 0.06 + (p_skill / 100) * 0.24 + (p_ql / 100) * 0.1
$fn$;
-- One brushing, at a husbandry and a brush's quality (`groomGain`).
create or replace function groom_gain(p_skill double precision, p_ql double precision) returns double precision language sql immutable as $fn$
  select 0.18 + (p_skill / 100) * 0.34 + (least(100, p_ql) / 100) * 0.22
$fn$;
-- What a worker of this skill makes a thing at: the same spread a tile's load is taken at (`madeQl`).
create or replace function worker_made_ql(c creature, p_skill double precision) returns double precision language sql volatile as $fn$
  select least(100, greatest(1, p_skill * (0.6 + random() * 0.8) + 1) * beast_mul(c, 'yield'))
$fn$;
-- Whether a sheela milks this kind rather than shearing it: one that fills a bucket at a milking (`Creatures.milker`).
create or replace function milker(d species_def) returns boolean language sql stable as $fn$
  select coalesce(d.milk, false) and milk_litres(d.id) >= bucket_litres()
$fn$;

/* ---- the stores ----------------------------------------------------------------------- */

/*
 * Every thing in a store on a settlement of yours: the crates and the pieces
 * that hold things, but not a trash crate, as the browser's `deedStores` has
 * them. Where each store stands, its middle, and the row.
 */
create or replace function deed_store_items(p_world uuid, p_uid uuid)
returns table(kind text, sid bigint, x int, y int, cx double precision, cy double precision, it item)
language sql stable as $fn$
  select 'crate', cr.id::bigint, cr.x, cr.y, crate_centre_x(cr), crate_centre_y(cr), i
  from crate cr join item i on i.world_id = cr.world_id and i.holder = 'crate' and i.crate = cr.id
  where cr.world_id = p_world and on_my_deed(p_world, p_uid, cr.x, cr.y)
  union all
  select 'furniture', p.id, p.x, p.y, p.cx, p.cy, i
  from placed p join furniture_def fd on fd.id = p.sub
       join item i on i.world_id = p.world_id and i.holder = 'furniture' and i.placed = p.id
  where p.world_id = p_world and p.kind = 'furniture' and furniture_holds(p) and coalesce(fd.trash, 0) = 0
    and on_my_deed(p_world, p_uid, p.x, p.y)
$fn$;

-- The nearest store holding one of these (unlocked), from where a worker stands.
create or replace function store_holding(p_world uuid, p_uid uuid, p_defs text[], p_x double precision, p_y double precision)
returns table(kind text, sid bigint, x int, y int, cx double precision, cy double precision)
language sql stable as $fn$
  select s.kind, s.sid, s.x, s.y, s.cx, s.cy from deed_store_items(p_world, p_uid) s
  where (s.it).def = any(p_defs) and (s.it).count > 0 and not coalesce((s.it).locked, false)
  order by (s.cx - p_x) ^ 2 + (s.cy - p_y) ^ 2, s.sid limit 1
$fn$;

-- How many of a thing the stores hold between them.
create or replace function stores_count(p_world uuid, p_uid uuid, p_def text) returns bigint language sql stable as $fn$
  select coalesce(sum((s.it).count), 0) from deed_store_items(p_world, p_uid) s
  where (s.it).def = p_def and not coalesce((s.it).locked, false)
$fn$;

/*
 * One of these taken out of the stores, as a load: out of a store standing
 * on the tile given when there is one, and otherwise out of whichever has it.
 */
create or replace function take_one_stored(p_world uuid, p_uid uuid, p_defs text[], p_x int default null, p_y int default null)
returns jsonb language plpgsql as $fn$
declare v item;
begin
  select (s.it).* into v from deed_store_items(p_world, p_uid) s
   where (s.it).def = any(p_defs) and (s.it).count > 0 and not coalesce((s.it).locked, false)
   order by (p_x is not null and s.x = p_x and s.y = p_y) desc, s.kind, s.sid, (s.it).id limit 1;
  if v.id is null then return null; end if;
  if v.count > 1 then update item set count = count - 1 where id = v.id;
  else delete from item where id = v.id; end if;
  return jsonb_build_object('def', v.def, 'count', 1, 'ql', v.ql, 'extra', v.extra);
end $fn$;

/*
 * Something made at the stores, put into them (`intoStores`): the store at
 * the tile it was made at while that will take it, then whichever store on
 * the settlement will, and failing all of them onto the ground there.
 */
create or replace function worker_put(p_world uuid, c creature, p_def text, p_count int, p_ql double precision,
                                      p_x int, p_y int, p_extra text default null) returns void language plpgsql as $fn$
declare v_at record; v_in boolean := false;
begin
  for v_at in
    select 'crate'::text as kind, cr.id::bigint as id from crate cr
     where cr.world_id = p_world and cr.x = p_x and cr.y = p_y
       and crate_units(p_world, cr.id) + p_count <= crate_capacity(cr)
    union all
    select 'furniture', p.id from placed p
     where p.world_id = p_world and p.kind = 'furniture' and p.x = p_x and p.y = p_y
       and furniture_holds(p) and furniture_refuses(p, p_def) is null and p_count <= furniture_room(p, p_def)
    union all
    select w.kind, w.id from worker_store(p_world, c, p_def, p_count) w
  loop
    if v_at.kind = 'crate' then v_in := crate_add(p_world, v_at.id::int, p_def, p_count, p_ql, p_extra);
    else v_in := furniture_add(p_world, v_at.id, p_def, p_count, p_ql, p_extra); end if;
    if v_in then return; end if;
  end loop;
  perform drop_on_ground(p_world, p_x, p_y, p_def, p_ql, p_extra, p_count);
end $fn$;

/* ---- your own wildermon ---------------------------------------------------------------- */

/*
 * Whether one of yours wants a kemma, a sheela or a salva (`herdWants`):
 * care under `care_wanting`; a fleece, feathers or milk `dairy_full` grown
 * back, and for a milker an empty bucket to be had (`p_has`); bleeding, or
 * under `heal_below` of its health, and a dressing to be had (`p_has`).
 */
create or replace function herd_wants(c creature, o creature, p_kind text, p_has boolean) returns boolean language plpgsql stable as $fn$
declare d species_def;
begin
  if o.id = c.id or o.keeper is distinct from c.keeper or o.mode not in ('deed', 'active') or o.health <= 0 then return false; end if;
  select * into d from species_def where id = o.species;
  if coalesce(d.monster, false) then return false; end if;
  if p_kind = 'groom' then return o.care < care_wanting(); end if;
  if p_kind = 'dairy' then return d.fleece is not null and o.fleece >= dairy_full() and (not milker(d) or p_has); end if;
  if p_kind = 'heal' then return p_has and (coalesce(o.bleed_until > now(), false) or o.health < max_health(o) * heal_below()); end if;
  return false;
end $fn$;

-- The nearest of yours within reach of the token that wants this, from a point; what it would carry to one asked once for the herd.
create or replace function herd_target(p_world uuid, c creature, p_kind text, p_x double precision, p_y double precision)
returns creature language plpgsql stable as $fn$
declare dd deed; rng int := work_range(c); o creature; v_carry text[]; v_has boolean;
begin
  select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if dd.world_id is null then return null; end if;
  v_carry := case when p_kind = 'heal' then dressings() else array['bucket'] end;
  v_has := p_kind <> 'groom' and (coalesce(c.carrying->>'def' = any(v_carry), false)
           or exists (select 1 from deed_store_items(p_world, c.keeper) s
                       where (s.it).def = any(v_carry) and (s.it).count > 0 and not coalesce((s.it).locked, false)));
  select * into o from creature x
   where x.world_id = p_world and x.keeper = c.keeper and x.id <> c.id and x.mode in ('deed', 'active')
     and greatest(abs(floor(creature_x(x)) - dd.x), abs(floor(creature_y(x)) - dd.y)) <= rng
     and herd_wants(c, x, p_kind, v_has)
   order by (creature_x(x) - p_x) ^ 2 + (creature_y(x) - p_y) ^ 2, x.id limit 1;
  return o;
end $fn$;

-- What a sheela or a salva carries to this one: an empty bucket for a milker, a dressing for a hurt, or nothing.
create or replace function herd_need(p_kind text, o creature) returns text[] language sql stable as $fn$
  select case when p_kind = 'heal' then dressings()
              when p_kind = 'dairy' and milker((select d from species_def d where d.id = o.species)) then array['bucket'] end
$fn$;

/* ---- the recipes at the stores, and the lanterns --------------------------------------- */

/*
 * The first of these recipes the stores hold everything for (`recipeInStores`):
 * its tool in one of them and every input across them, and the store holding
 * its first input, which is where the work is done.
 */
create or replace function recipe_in_stores(p_world uuid, p_uid uuid, p_recipes text[])
returns table(rid text, x int, y int, cx double precision, cy double precision)
language plpgsql stable as $fn$
declare r recipe; v_at record; v_id text;
begin
  foreach v_id in array p_recipes loop
    select * into r from recipe where id = v_id;
    if r.id is null then continue; end if;
    if r.tool is not null and stores_count(p_world, p_uid, r.tool) < 1 then continue; end if;
    if exists (select 1 from recipe_input ri where ri.recipe = r.id and stores_count(p_world, p_uid, ri.item) < ri.count) then continue; end if;
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

-- What a lantern post or pillar wants of a wicka (`lampWants`): a candle, a light after dark, or putting out by day.
create or replace function lamp_wants(p_world uuid, p placed) returns text language sql stable as $fn$
  select case when lamp_kind(p.sub) is null or p.state->'lamp' is null then null
              when placed_fuel(p) <= 0 then 'candle'
              when is_night(p_world) and not placed_lit(p) then 'light'
              when not is_night(p_world) and placed_lit(p) then 'douse' end
$fn$;

-- The nearest of yours within reach of the token wanting a wicka, skipping one wanting a candle when there is none to be had.
create or replace function lamp_target(p_world uuid, c creature, p_candles boolean, p_x double precision, p_y double precision)
returns placed language sql stable as $fn$
  select p.* from placed p, my_deed(p_world, c.keeper) dd
   where dd.world_id is not null and p.world_id = p_world and p.kind = 'furniture' and lamp_kind(p.sub) is not null
     and greatest(abs(p.x - dd.x), abs(p.y - dd.y)) <= work_range(c) and on_my_deed(p_world, c.keeper, p.x, p.y)
     and lamp_wants(p_world, p) is not null and (p_candles or lamp_wants(p_world, p) <> 'candle')
   order by (p.cx - p_x) ^ 2 + (p.cy - p_y) ^ 2, p.id limit 1
$fn$;

/* ---- the errands: where to go ---------------------------------------------------------- */

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Where each of the seven goes next: a store for what it needs, or the one it is for.
    (1, 'errand_step', $$  elsif kind = 'plant' then$$,
                       $$  elsif kind in ('groom', 'dairy', 'heal') then
    declare o creature; need text[]; v_s record;
    begin
      o := herd_target(p_world, c, kind, c.to_x, c.to_y);
      need := case when o.id is not null then herd_need(kind, o) end;
      -- Anything in its arms it has no use for goes back to the stores first.
      if c.carrying is not null and (o.id is null or need is null or not (c.carrying->>'def' = any(need))) then
        select * into v_s from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_s.id is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      if o.id is null then return; end if;
      if need is not null and c.carrying is null then
        select * into v_s from store_holding(p_world, c.keeper, need, c.to_x, c.to_y);
        if v_s.x is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
        return next;
        return;
      end if;
      gx := creature_x(o); gy := creature_y(o); want := null; wx := floor(gx)::int; wy := floor(gy)::int;
      return next;
      return;
    end;

  elsif kind = 'butcher' then
    declare v_s record;
    begin
      select * into v_s from store_holding(p_world, c.keeper, array['corpse'], c.to_x, c.to_y);
      if v_s.x is null then return; end if;
      gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      return next;
      return;
    end;

  elsif kind in ('tan', 'mill') then
    declare v_r record;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
      if v_r.rid is null then return; end if;
      gx := v_r.cx; gy := v_r.cy; want := null; wx := v_r.x; wy := v_r.y;
      return next;
      return;
    end;

  elsif kind = 'lamp' then
    declare v_p placed; v_s record; v_hold boolean := coalesce(c.carrying->>'def' = 'candle', false);
    begin
      if c.carrying is not null and not v_hold then
        select * into v_s from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_s.id is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      v_p := lamp_target(p_world, c, v_hold or stores_count(p_world, c.keeper, 'candle') > 0, c.to_x, c.to_y);
      if v_p.id is null then return; end if;
      if lamp_wants(p_world, v_p) = 'candle' and not v_hold then
        select * into v_s from store_holding(p_world, c.keeper, array['candle'], c.to_x, c.to_y);
        if v_s.x is null then return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      else
        gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
      end if;
      return next;
      return;
    end;

  elsif kind = 'plant' then$$, 1),

    -- And what each does when it gets there.
    (2, 'errand_do', $$  elsif kind = 'plant' then$$,
                     $$  elsif kind in ('groom', 'dairy', 'heal') then
    declare o creature; od species_def; need text[]; v_top double precision; v_yield text; v_n int; v_ql double precision;
    begin
      o := herd_target(p_world, c, kind, c.work_x + 0.5, c.work_y + 0.5);
      need := case when o.id is not null then herd_need(kind, o) end;
      -- Put back what it has no use for, at the store it walked to.
      if c.carrying is not null and (o.id is null or need is null or not (c.carrying->>'def' = any(need))) then
        perform worker_put(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int, (c.carrying->>'ql')::double precision,
                           c.work_x, c.work_y, c.carrying->>'extra');
        update creature set carrying = null where world_id = p_world and id = p_id;
        return true;
      end if;
      if o.id is null then return false; end if;
      -- At the store, for the bucket or the dressing.
      if need is not null and c.carrying is null then
        update creature set carrying = take_one_stored(p_world, c.keeper, need, c.work_x, c.work_y)
         where world_id = p_world and id = p_id;
        return true;
      end if;
      -- Beside it, or it has gone off and the next step will find it again.
      if sqrt((creature_x(o) - c.to_x) ^ 2 + (creature_y(o) - c.to_y) ^ 2) > 3 then return false; end if;
      select * into od from species_def where id = o.species;
      v_top := max_health(o);
      if kind = 'groom' then
        -- As a keeper of its skill with a brush as good (`groom_gain`), and the small hurts seen to with it.
        update creature set care = least(1, care + groom_gain(skill, skill)),
               health = least(v_top, health + v_top * groom_heal())
         where world_id = p_world and id = o.id;
        perform worker_learn(p_world, p_id, skill_id, 0.25);
      elsif kind = 'dairy' then
        if milker(od) then
          -- A bucket off it, as the keeper's own milking fills one (`milk_go`).
          perform worker_put(p_world, c, 'milk_bucket', 1, greatest(1, least(100, 20 + o.fleece * 40 + o.hunger * 30)),
                             floor(creature_x(o))::int, floor(creature_y(o))::int);
          update creature set carrying = null where world_id = p_world and id = p_id;
        else
          -- A full fleece is three, a full crop of feathers six, and quality follows what was there.
          v_yield := coalesce(od.shear_yield, 'wool');
          v_n := greatest(1, round(o.fleece * case when v_yield = 'wool' then 3 else 6 end)::int);
          v_ql := greatest(1, least(100, 15 + o.fleece * 45 + skill * 0.4));
          perform worker_put(p_world, c, v_yield, v_n, v_ql, floor(creature_x(o))::int, floor(creature_y(o))::int);
        end if;
        update creature set fleece = 0 where world_id = p_world and id = o.id;
        perform worker_learn(p_world, p_id, skill_id, 0.25);
      else
        -- A dressing's share of a life (`heal_amount`), and the bleeding stopped.
        update creature set health = least(v_top, health + v_top * heal_amount(skill, coalesce((c.carrying->>'ql')::double precision, 1))),
               bleed_until = null, bleed_rate = null
         where world_id = p_world and id = o.id;
        update creature set carrying = null where world_id = p_world and id = p_id;
        perform worker_learn(p_world, p_id, skill_id, 0.25);
      end if;
      return true;
    end;

  elsif kind = 'butcher' then
    -- At the store with a carcass in it: taken apart as a butcher of its skill with a knife as good would (`butcher_yield`).
    declare v_c item; sp species_def; v_share double precision; v_ql double precision; r record; v_n int; v_got text;
    begin
      select (s.it).* into v_c from deed_store_items(p_world, c.keeper) s
       where (s.it).def = 'corpse' and not coalesce((s.it).locked, false) and s.x = c.work_x and s.y = c.work_y
       order by (s.it).id limit 1;
      if v_c.id is null then return false; end if;
      sp := corpse_species(v_c.extra);
      if sp.id is null then return false; end if;
      if v_c.count > 1 then update item set count = count - 1 where id = v_c.id;
      else delete from item where id = v_c.id; end if;
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
      perform worker_learn(p_world, p_id, skill_id, 0.3);
      return true;
    end;

  elsif kind in ('tan', 'mill') then
    -- A recipe worked at the stores: its inputs out of them, its tool kept in one, and what it makes back in.
    declare v_r record; r recipe; ri record; v_i int;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
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

  elsif kind = 'lamp' then
    declare v_p placed; v_want text; v_hold boolean := coalesce(c.carrying->>'def' = 'candle', false);
    begin
      select * into v_p from placed p where p.world_id = p_world and p.kind = 'furniture' and lamp_kind(p.sub) is not null
        and p.x = c.work_x and p.y = c.work_y and on_my_deed(p_world, c.keeper, p.x, p.y) order by p.id limit 1;
      v_want := case when v_p.id is not null then lamp_wants(p_world, v_p) end;
      if v_want is not null and (v_want <> 'candle' or v_hold) then
        if v_want = 'candle' then
          -- A candle in it, as a person sets one (`candle_burn`), and lit if it is dark.
          update placed set fuel = round(candle_burn((state->'lamp'->>'ql')::double precision)), lit = is_night(p_world), since = now()
           where id = v_p.id;
          update creature set carrying = null where world_id = p_world and id = p_id;
        else
          update placed set fuel = placed_fuel(v_p), lit = v_want = 'light', since = now() where id = v_p.id;
        end if;
        perform land_announce(p_world, v_p.x, v_p.y);
        perform worker_learn(p_world, p_id, skill_id, 0.2);
        return true;
      end if;
      if c.carrying is not null and not v_hold then
        perform worker_put(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int, (c.carrying->>'ql')::double precision,
                           c.work_x, c.work_y, c.carrying->>'extra');
        update creature set carrying = null where world_id = p_world and id = p_id;
        return true;
      end if;
      if not v_hold then
        update creature set carrying = take_one_stored(p_world, c.keeper, array['candle'], c.work_x, c.work_y)
         where world_id = p_world and id = p_id;
        return true;
      end if;
      return false;
    end;

  elsif kind = 'plant' then$$, 1),

    -- The three that walk out: a bush or a ripe vine, grass or moss, sand at the water.
    (3, 'worker_gatherable', $$  if p_kind = 'woodcut' then$$,
                             $$  if p_kind = 'bush' then
    if not creature_tile_ok(p_world, p_x, p_y) then return false; end if;
    -- A trellis with its vine ripe (`ripeTrellisAt`).
    if exists (select 1 from placed pl where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = vine_kind()
                 and pl.x = p_x and pl.y = p_y and vine_stage(pl, vine_now()) = 'ripe') then return true; end if;
    -- A bush in its season with nothing taken off it today.
    return here = tile_id('Bush') and not is_foraged(p_world, p_x, p_y, 'forage')
       and exists (select 1 from bush_def b where b.id = bush_species(land_data(p_world, p_x, p_y))
                    and b.yields is not null and fruits_now(b.yields));
  elsif p_kind = 'grass' then
    if not creature_tile_ok(p_world, p_x, p_y) then return false; end if;
    if here = tile_id('Moss') then return not is_foraged(p_world, p_x, p_y, 'moss'); end if;
    return here in (tile_id('Grass'), tile_id('Steppe'), tile_id('Lawn'), tile_id('Tundra'))
       and not is_foraged(p_world, p_x, p_y, 'grass');
  elsif p_kind = 'pan' then
    -- Sand with the water at one of its corners, as a person's pan wants.
    return here = tile_id('Sand') and creature_tile_ok(p_world, p_x, p_y)
       and exists (select 1 from tile_corners(p_x, p_y) k where land_height(p_world, k.cx, k.cy) < 0);
  end if;

  if p_kind = 'woodcut' then$$, 1),

    -- What each brings home: as much as a person's hands would take at its skill (`finishHands`).
    (4, 'worker_do', $$  made_ql := least(100, greatest(1, skill * (0.6 + random() * 0.8) + 1) * careful);
$$,
                     $$  made_ql := least(100, greatest(1, skill * (0.6 + random() * 0.8) + 1) * careful);
  if kind = 'bush' then
    declare v_pl placed; v_yields text;
    begin
      select * into v_pl from placed pl where pl.world_id = p_world and pl.kind = 'furniture' and pl.sub = vine_kind()
        and pl.x = wx and pl.y = wy and vine_stage(pl, vine_now()) = 'ripe' order by pl.id limit 1;
      if v_pl.id is not null then
        update placed set picked_at = vine_now() where id = v_pl.id;
        perform land_announce(p_world, wx, wy);
        return jsonb_build_object('def', grape_item(), 'count', grapes_for(skill), 'ql', made_ql);
      end if;
      if here <> tile_id('Bush') then return null; end if;
      select b.yields into v_yields from bush_def b where b.id = bush_species(land_data(p_world, wx, wy));
      if v_yields is null then return null; end if;
      perform mark_foraged(p_world, wx, wy, 'forage');
      -- As a person's sickle takes off a bush: more to a practised hand, and never nothing.
      return jsonb_build_object('def', v_yields,
        'count', greatest(1, round(3 * (0.5 + skill / 130.0) * (0.7 + random() * 0.6))::int), 'ql', made_ql);
    end;
  elsif kind = 'grass' then
    if here = tile_id('Moss') then
      perform mark_foraged(p_world, wx, wy, 'moss');
      return jsonb_build_object('def', 'moss', 'count', moss_per_cut()::int, 'ql', made_ql);
    end if;
    perform mark_foraged(p_world, wx, wy, 'grass');
    -- Grass kept cut on a settlement becomes lawn, as under your own hands.
    if here = tile_id('Grass') and on_deed(p_world, wx, wy) then
      perform land_set_data(p_world, wx, wy, (land_data(p_world, wx, wy) & 3) | 4);
      perform land_announce(p_world, wx, wy);
    end if;
    return jsonb_build_object('def', 'mixed_grass', 'count', grass_per_cut()::int, 'ql', made_ql);
  elsif kind = 'pan' then
    if random() >= pan_find(skill) then return null; end if;
    return jsonb_build_object('def', (select o.item from pan_ore o order by random() limit 1), 'count', 1, 'ql', made_ql);
  end if;
$$, 1)
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
