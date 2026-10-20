-- Each stage lets a deed worker do more at once.
--
-- Asked for: "Each stage unlocks something, not just bigger numbers": "a stage-2 worker carries 2 loads a trip, a
-- stage-3 worker 3", for every trade that carries a load between where it gets it and where it goes, and "a stage-2
-- worker handles 2 targets per go" for the trades worked in place on things in your stores, "where there are that
-- many to do". One rule, `stage_loads` (the browser's `STAGE_LOADS`): 1, 2 and 3 at a kind's three stages.
--
--   * A trade that walks out to the ground and brings a load home (`load_trade`) carries its stage's loads a trip: with
--     room in its arms for another, a go that brings a load sends it on to the next tile rather than home, and with
--     none to be had it goes home with what it has. The loads ride in `carrying`, the first first and the rest in its
--     `more` (`load_join`), and are put away one after another when it gets there (`load_next`). Where a go already
--     brings several, a trip is that many goes, never more a go.
--   * The errands that carry carry their stage's: a water carrier fills that many buckets (at a well as many whole as
--     it holds, `fill_buckets`) and pours as many as the barrel has room for in one go; a hod carrier fetches as many
--     pieces as the work still wants (`hod_left`) and fits them in one go; a stoker as much fuel as the hearth has room
--     for and feeds it in one go (`errand_fetch_n`); a planter, a lantern keeper and a planter-keeper that many
--     sprouts, candles and seeds, each set in a go of its own; a Dippa that many buckets; a dresser of hurts and a
--     milker that many dressings and buckets.
--   * A trade worked in place (`hands_trade`) does its stage's number in the one go: a mender the most damaged things
--     in the stores, each once; the rest by going again where it stands (`errand_go`, `errand_do`'s `p_again`), which
--     neither fetches nor puts back, and stops at the first it finds nothing to do.
--
-- One go teaches what one go teaches: the loads of a trip are each a go of their own as they always were, and what a
-- go handles more of teaches nothing more (`p_again` learns nothing). And whatever is put down when a worker stops --
-- called to heel, shut in a crate, its settlement given up -- is every load in its arms (`drop_more`).

set local lock_timeout = '3s';

-- How many loads a trip, or things a go, at each stage (`STAGE_LOADS`); and at the stage it is at.
create or replace function stage_loads_at(p_stage int) returns int language sql immutable as $fn$
  select (array[1, 2, 3])[least(2, greatest(0, p_stage)) + 1]
$fn$;
create or replace function stage_loads(c creature) returns int language sql stable as $fn$
  select stage_loads_at(stage_of(c))
$fn$;

-- The trades that carry their stage's loads a trip, and those that handle their stage's number a go (`LOAD_TRADES`,
-- `HANDS_TRADES`).
create or replace function load_trade(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('forage', 'botanize', 'woodcut', 'farm', 'mine', 'sand', 'clay', 'quarry', 'fetch', 'peat', 'reed', 'fish',
                    'seek', 'fruit', 'bush', 'grass', 'pan', 'worm', 'sprout', 'resin', 'flower', 'compost',
                    'water', 'hod', 'stoke', 'plant', 'lamp', 'patch', 'fill')
$fn$;
create or replace function hands_trade(p_kind text) returns boolean language sql immutable as $fn$
  select p_kind in ('mend', 'butcher', 'restore', 'glaze', 'tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'cook',
                    'paper', 'ash', 'groom', 'dairy', 'heal')
$fn$;

-- A load more in a worker's arms: the first stays where it is, and the rest follow it in `more`, in the order gathered.
create or replace function load_join(p_arms jsonb, p_load jsonb) returns jsonb language sql immutable as $fn$
  select case when p_load is null then p_arms
              when p_arms is null then p_load
              else jsonb_set(p_arms, '{more}', coalesce(p_arms->'more', '[]'::jsonb) || jsonb_build_array(p_load)) end
$fn$;
-- How many loads are in its arms.
create or replace function loads_in(p_arms jsonb) returns int language sql immutable as $fn$
  select case when p_arms is null then 0 else 1 + coalesce(jsonb_array_length(p_arms->'more'), 0) end
$fn$;
-- What is in its arms once the first load is put away: the next, with the rest after it.
create or replace function load_next(p_arms jsonb) returns jsonb language sql immutable as $fn$
  select case when coalesce(jsonb_array_length(p_arms->'more'), 0) = 0 then null
              when jsonb_array_length(p_arms->'more') = 1 then p_arms->'more'->0
              else jsonb_set(p_arms->'more'->0, '{more}', (p_arms->'more') - 0) end
$fn$;
-- And once `p_n` of what it carries is used: the rest of the stack, or nothing.
create or replace function load_less(p_arms jsonb, p_n int default 1) returns jsonb language sql immutable as $fn$
  select case when p_arms is null or coalesce((p_arms->>'count')::int, 1) <= p_n then null
              else jsonb_set(p_arms, '{count}', to_jsonb((p_arms->>'count')::int - p_n)) end
$fn$;
-- Every load after the first in its arms, put down where it stands, as the first is wherever a worker stops.
create or replace function drop_more(p_world uuid, p_x int, p_y int, p_arms jsonb) returns void language plpgsql as $fn$
declare m jsonb;
begin
  for m in select * from jsonb_array_elements(coalesce(p_arms->'more', '[]'::jsonb)) loop
    perform drop_on_ground(p_world, p_x, p_y, m->>'def', coalesce((m->>'ql')::double precision, 1), m->>'extra',
                           coalesce((m->>'count')::int, 1));
  end loop;
end $fn$;

-- How many buckets a trip it fills: its stage's, at a well as many whole ones as the well holds and one at the least.
-- The well is the one `water_source` sends it to. The browser's `bucketsAt`.
create or replace function fill_buckets(p_world uuid, c creature) returns int language sql stable as $fn$
  select coalesce((select greatest(1, least(stage_loads(c), floor(placed_litres(p) / bucket_litres())::int))
                     from placed p
                    where p.world_id = p_world and p.kind = 'furniture' and is_well(p) and placed_litres(p) >= 1
                      and on_my_deed(p_world, c.keeper, p.x, p.y)
                    order by p.id limit 1), stage_loads(c))
$fn$;

-- How many more of a thing a piece of planned work wants (the browser's `hodWants`).
create or replace function hod_left(p_world uuid, p_kind text, p_level int, p_dir text, p_x int, p_y int, p_ref bigint,
                                    p_n int, p_item text) returns int language sql stable as $fn$
  select coalesce((select greatest(0, coalesce((w.needed->>p_item)::int, 0)) from hod_work(p_world, p_x, p_y, 0) w
                    where w.kind = p_kind and w.level is not distinct from p_level and w.dir is not distinct from p_dir
                      and w.x = p_x and w.y = p_y and w.ref is not distinct from p_ref and w.n is not distinct from p_n
                    limit 1), 0)
$fn$;

-- How many of what an errand fetches out of the stores it takes: its stage's, for a hod carrier as many as the work it
-- fetches for still wants, and for a stoker as many as the hearth it fetches for has room for, one at the least.
create or replace function errand_fetch_n(p_world uuid, c creature) returns int language plpgsql stable as $fn$
declare v_kind text; dd deed; v_job record; v_h placed; n int := stage_loads(c);
begin
  if n <= 1 then return 1; end if;
  v_kind := (select sd.gathers from species_def sd where sd.id = c.species);
  select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if v_kind = 'hod' then
    select * into v_job from hod_needing_stocked(p_world, c.keeper, dd.x, dd.y, work_range(c));
    if v_job.item is null then return 1; end if;
    return greatest(1, least(n, hod_left(p_world, v_job.kind, v_job.level, v_job.dir, v_job.x, v_job.y, v_job.ref, v_job.n, v_job.item)));
  elsif v_kind = 'stoke' then
    v_h := cold_hearth(p_world, dd.x, dd.y, work_range(c));
    if v_h.id is null or coalesce(fuel_value(c.fetching), 0) <= 0 then return 1; end if;
    return greatest(1, least(n, floor((fire_capacity() - placed_fuel(v_h)) / fuel_value(c.fetching))::int));
  end if;
  return n;
end $fn$;

-- The errand's go: and for a trade worked in place, its stage's number in the one go, going again where it stands,
-- which teaches nothing more, until it has done that many or finds nothing more to do (`HANDS_TRADES`). A mender does
-- its own (`errand_do`), and a go that fetched a bucket or a dressing out of the stores was the fetching, not a go at
-- one of yours.
create or replace function errand_go(p_world uuid, p_id int) returns boolean language plpgsql as $fn$
declare c creature; was jsonb; v_kind text; v_n int;
begin
  was := (select cr.carrying from creature cr where cr.world_id = p_world and cr.id = p_id);
  if not errand_do(p_world, p_id) then return false; end if;
  select * into c from creature where world_id = p_world and id = p_id;
  if c.carrying is not null and (was is null or c.carrying->>'def' is distinct from was->>'def'
                                 or coalesce((c.carrying->>'count')::int, 1) > coalesce((was->>'count')::int, 1)) then
    return true;
  end if;
  v_kind := (select sd.gathers from species_def sd where sd.id = c.species);
  if hands_trade(v_kind) and v_kind <> 'mend' then
    for v_n in 2..stage_loads(c) loop
      exit when not errand_do(p_world, p_id, true);
    end loop;
  end if;
  return true;
end $fn$;

/*
 * The worker's own round. A load into its arms with the rest of the trip's, and out again while there is room for
 * another; home with what it has when there is no more to be had; and every load put away when it gets there. An
 * errand's fetch takes its stage's, and an errand's go is `errand_go`.
 */
do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('worker_settle', $$        load := take_one_stored(p_world, c.keeper, array[c.fetching], c.work_x, c.work_y);
$$, $$        -- Its stage's loads of it, as many as the errand wants (`errand_fetch_n`).
        load := take_some_stored(p_world, c.keeper, array[c.fetching], errand_fetch_n(p_world, c), c.work_x, c.work_y);
$$),
    ('worker_settle', $$        if errand_do(p_world, p_id) then
$$, $$        if errand_go(p_world, p_id) then
$$),
    ('worker_settle', $$          work_x = c.work_x, work_y = c.work_y, idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger,
          settled_at = now()
        where world_id = p_world and id = p_id;
      load := worker_do(p_world, p_id);
      select * into c from creature where world_id = p_world and id = p_id;
      done := done + 1;
      c.ledger := ledger_add(c.ledger, v_day, 1, 0, null, 0);
      c.idle_why := null; c.idle_n := null;
      c.carrying := load;
      c.work_x := null; c.work_y := null;
      if load is null then
$$, $$          work_x = c.work_x, work_y = c.work_y, idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger,
          carrying = c.carrying, settled_at = now()
        where world_id = p_world and id = p_id;
      load := worker_do(p_world, p_id);
      select * into c from creature where world_id = p_world and id = p_id;
      done := done + 1;
      c.ledger := ledger_add(c.ledger, v_day, 1, 0, null, 0);
      c.idle_why := null; c.idle_n := null;
      -- Into its arms with what it has gathered already this trip; and with room in them for another of its stage's
      -- loads (`stage_loads`), out to the next tile rather than home.
      c.carrying := load_join(c.carrying, load);
      c.work_x := null; c.work_y := null;
      if load is null or (load_trade(kind) and loads_in(c.carrying) < stage_loads(c)) then
$$),
    ('worker_settle', $$        select * into v_store from worker_store(p_world, c, load->>'def', (load->>'count')::int);
$$, $$        select * into v_store from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
$$),
    ('worker_settle', $$          perform away_count(p_world, c.keeper, 'haul', c.carrying->>'def', (c.carrying->>'count')::bigint);
          c.ledger := ledger_add(c.ledger, v_day, 0, 0, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1));
          c.carrying := null;
        end if;
$$, $$          perform away_count(p_world, c.keeper, 'haul', c.carrying->>'def', (c.carrying->>'count')::bigint);
          c.ledger := ledger_add(c.ledger, v_day, 0, 0, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1));
          -- And the next load of the trip, put away the same way, until its arms are empty.
          c.carrying := load_next(c.carrying);
          if c.carrying is not null then continue; end if;
        end if;
$$),
    ('worker_settle', $$      if spot.x is null then
        -- Nothing of its trade anywhere it can reach. It wanders a few tiles
$$, $$      if spot.x is null and c.carrying is not null then
        -- Nothing more to be had, and loads in its arms: home with what it has.
        select * into v_store from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_store.id is not null then
          dist := sqrt((v_store.cx - cx) ^ 2 + (v_store.cy - cy) ^ 2);
          c.from_x := cx; c.from_y := cy; c.to_x := v_store.cx; c.to_y := v_store.cy;
          c.leg_at := c.until;
          c.leg_ends := c.leg_at + make_interval(secs => greatest(0.2, dist / greatest(0.1, pace)));
          c.until := c.leg_ends;
          c.phase := 'home';
          continue;
        end if;
      end if;
      if spot.x is null then
        -- Nothing of its trade anywhere it can reach. It wanders a few tiles
$$),
    -- Called to heel, killed, shut in a crate, or let go with its settlement: every load in its arms goes down.
    ('perform_creature', $$        coalesce((c.carrying->>'count')::int, 1));
    end if;
    update creature set mode = 'active', keeper = p_uid, post = null, carrying = null, phase = 'idle',
$$, $$        coalesce((c.carrying->>'count')::int, 1));
      perform drop_more(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int, c.carrying);
    end if;
    update creature set mode = 'active', keeper = p_uid, post = null, carrying = null, phase = 'idle',
$$),
    ('perform_creature', $$        c.carrying->>'extra', coalesce((c.carrying->>'count')::int, 1));
      update creature set carrying = null where world_id = p_world and id = c.id;
$$, $$        c.carrying->>'extra', coalesce((c.carrying->>'count')::int, 1));
      perform drop_more(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int, c.carrying);
      update creature set carrying = null where world_id = p_world and id = c.id;
$$),
    ('crate_shut_in', $$      coalesce((v_c.carrying->>'count')::int, 1));
  end if;
$$, $$      coalesce((v_c.carrying->>'count')::int, 1));
    perform drop_more(p_world, floor(creature_x(v_c))::int, floor(creature_y(v_c))::int, v_c.carrying);
  end if;
$$),
    ('perform_settlement', $$          (c.carrying->>'count')::int);
      end if;
$$, $$          (c.carrying->>'count')::int);
        perform drop_more(p_world, floor(creature_x(c))::int, floor(creature_y(c))::int, c.carrying);
      end if;
$$)
  ) as t(fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of the line to change, not 1', r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

/*
 * The errands themselves. `p_again` is a go after the first in the same go, for a trade worked in place: it learns
 * nothing, and fetches and puts back nothing. A mender mends its stage's number of the most damaged; and every errand
 * that carries takes, carries and uses its stage's.
 */
do $do$
declare r record; v_def text; v_n int;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'errand_do' and p.pronargs = 2;
  if v_def is null then raise exception 'errand_do is not on this island'; end if;
  for r in select * from (values
    ($$CREATE OR REPLACE FUNCTION public.errand_do(p_world uuid, p_id integer)
$$, $$CREATE OR REPLACE FUNCTION public.errand_do(p_world uuid, p_id integer, p_again boolean DEFAULT false)
$$),
    ($$        v_vessel placed;
begin
$$, $$        v_vessel placed; v_k int;
begin
$$),
    -- A mender: the most damaged and, at a stage, the next most damaged after it, each once.
    ($$        ql = greatest(1, ql - greatest(0.05, 0.6 - skill / 220))
      where id = v_it.id;
$$, $$        ql = greatest(1, ql - greatest(0.05, 0.6 - skill / 220))
      -- The most damaged and, at a stage, the next most damaged after it, its stage's number in the one go (`stage_loads`).
      where id in (select i.id from item i join crate cr on cr.world_id = i.world_id and cr.id = i.crate
                    where i.world_id = p_world and i.holder = 'crate' and i.dmg > 1 and not unrestored(i.def)
                      and on_my_deed(p_world, c.keeper, cr.x, cr.y)
                    order by i.dmg desc, i.id limit stage_loads(c));
$$),
    -- A hod carrier: every piece it carries that the work still wants, in the one go.
    ($$    if not hod_fit(p_world, v_job.kind, v_job.level, v_job.dir, v_job.x, v_job.y, v_job.ref, v_job.n, v_job.item) then
      return false;
    end if;
    update creature set carrying = null where world_id = p_world and id = p_id;
$$, $$    if not hod_fit(p_world, v_job.kind, v_job.level, v_job.dir, v_job.x, v_job.y, v_job.ref, v_job.n, v_job.item) then
      return false;
    end if;
    -- And every other piece it carries that the work still wants, in the one go; any over go on to the next work.
    v_k := 1;
    while v_k < coalesce((c.carrying->>'count')::int, 1)
      and hod_fit(p_world, v_job.kind, v_job.level, v_job.dir, v_job.x, v_job.y, v_job.ref, v_job.n, v_job.item) loop
      v_k := v_k + 1;
    end loop;
    update creature set carrying = load_less(carrying, v_k) where world_id = p_world and id = p_id;
$$),
    -- A stoker: every piece it carries, fed in the one go.
    ($$    update placed set fuel = least(fire_capacity(), placed_fuel(placed) + v_per),
$$, $$    update placed set fuel = least(fire_capacity(), placed_fuel(placed) + v_per * coalesce((c.carrying->>'count')::int, 1)),
$$),
    -- A water carrier: its stage's buckets filled, and as many as the barrel has room for poured in the one go.
    ($$      update placed set litres = least(liquid_capacity(v_vessel),
                                       placed_litres(v_vessel) + bucket_litres()),
          liquid = 'water', since = now()
        where id = v_vessel.id;
      update creature set carrying = null where world_id = p_world and id = p_id;
$$, $$      v_k := greatest(1, least(coalesce((c.carrying->>'count')::int, 1),
                               ceil((liquid_capacity(v_vessel) - placed_litres(v_vessel)) / bucket_litres())::int));
      update placed set litres = least(liquid_capacity(v_vessel),
                                       placed_litres(v_vessel) + v_k * bucket_litres()),
          liquid = 'water', since = now()
        where id = v_vessel.id;
      update creature set carrying = load_less(carrying, v_k) where world_id = p_world and id = p_id;
$$),
    ($$    if v_vessel.id is not null and not draw_from(v_vessel.id, bucket_litres()) then return false; end if;
    if v_vessel.id is null and not has_water(p_world, c.work_x, c.work_y) then return false; end if;
    update creature set carrying = jsonb_build_object('def', 'water_bucket', 'count', 1, 'ql', 40)
$$, $$    v_k := fill_buckets(p_world, c);
    if v_vessel.id is not null and not draw_from(v_vessel.id, v_k * bucket_litres()) then return false; end if;
    if v_vessel.id is null and not has_water(p_world, c.work_x, c.work_y) then return false; end if;
    update creature set carrying = jsonb_build_object('def', 'water_bucket', 'count', v_k, 'ql', 40)
$$),
    -- The herd: a go after the first neither puts back nor fetches; it fetches its stage's buckets or dressings, and
    -- uses one for each.
    ($$      if c.carrying is not null and (o.id is null or need is null or not (c.carrying->>'def' = any(need))) then
$$, $$      if c.carrying is not null and (o.id is null or need is null or not (c.carrying->>'def' = any(need))) then
        if p_again then return false; end if;
$$),
    ($$      if need is not null and c.carrying is null then
        update creature set carrying = take_one_stored(p_world, c.keeper, need, c.work_x, c.work_y)
$$, $$      if need is not null and c.carrying is null then
        if p_again then return false; end if;
        update creature set carrying = take_some_stored(p_world, c.keeper, need, stage_loads(c), c.work_x, c.work_y)
$$),
    ($$                             floor(creature_x(o))::int, floor(creature_y(o))::int);
          update creature set carrying = null where world_id = p_world and id = p_id;
$$, $$                             floor(creature_x(o))::int, floor(creature_y(o))::int);
          update creature set carrying = load_less(carrying) where world_id = p_world and id = p_id;
$$),
    ($$               bleed_until = null, bleed_rate = null
         where world_id = p_world and id = o.id;
        update creature set carrying = null where world_id = p_world and id = p_id;
$$, $$               bleed_until = null, bleed_rate = null
         where world_id = p_world and id = o.id;
        update creature set carrying = load_less(carrying) where world_id = p_world and id = p_id;
$$),
    -- Lanterns, planters and planting: its stage's candles, seeds and sprouts a trip, each set in a go of its own.
    ($$           where id = v_p.id;
          update creature set carrying = null where world_id = p_world and id = p_id;
        else
$$, $$           where id = v_p.id;
          update creature set carrying = load_less(carrying) where world_id = p_world and id = p_id;
        else
$$),
    ($$        update creature set carrying = take_one_stored(p_world, c.keeper, array['candle'], c.work_x, c.work_y)
$$, $$        update creature set carrying = take_some_stored(p_world, c.keeper, array['candle'], stage_loads(c), c.work_x, c.work_y)
$$),
    ($$          update placed set state = coalesce(state, '{}'::jsonb) || jsonb_build_object('sown', cd.id) where id = v_p.id;
          update creature set carrying = null where world_id = p_world and id = p_id;
$$, $$          update placed set state = coalesce(state, '{}'::jsonb) || jsonb_build_object('sown', cd.id) where id = v_p.id;
          update creature set carrying = load_less(carrying) where world_id = p_world and id = p_id;
$$),
    ($$(select array_agg(x.seed) from crop_def x), 1, c.work_x, c.work_y)
$$, $$(select array_agg(x.seed) from crop_def x), stage_loads(c), c.work_x, c.work_y)
$$),
    ($$    perform land_announce(p_world, c.work_x, c.work_y);
    update creature set carrying = null where world_id = p_world and id = p_id;
$$, $$    perform land_announce(p_world, c.work_x, c.work_y);
    update creature set carrying = load_less(carrying) where world_id = p_world and id = p_id;
$$),
    -- A Dippa: as many buckets as it will fill, filled in the one go.
    ($$        v_one := take_one_stored(p_world, c.keeper, array['bucket'], c.work_x, c.work_y);
        if v_one is null then return false; end if;
        update creature set carrying = jsonb_build_object('def', 'bucket', 'count', 1, 'ql', v_one->'ql')
$$, $$        v_one := take_some_stored(p_world, c.keeper, array['bucket'], fill_buckets(p_world, c), c.work_x, c.work_y);
        if v_one is null then return false; end if;
        update creature set carrying = jsonb_build_object('def', 'bucket', 'count', v_one->'count', 'ql', v_one->'ql')
$$),
    ($$        if (v_well.id is not null and draw_from(v_well.id, bucket_litres()))
$$, $$        if (v_well.id is not null and draw_from(v_well.id, bucket_litres() * coalesce((c.carrying->>'count')::int, 1)))
$$)
  ) as t(old, new) loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'errand_do has % of %, not 1', v_n, left(r.old, 80); end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  -- And a go after the first learns nothing: every gain in it, and there is one to each step that teaches.
  v_n := (select count(*) from regexp_matches(v_def, 'perform worker_learn\(p_world, p_id, skill_id, [0-9.]+\);', 'g'));
  if v_n < 20 then raise exception 'errand_do has % gains to keep from a go after the first, not the 25 it had', v_n; end if;
  v_def := regexp_replace(v_def, 'perform worker_learn\(p_world, p_id, skill_id, ([0-9.]+)\);',
                          'if not p_again then perform worker_learn(p_world, p_id, skill_id, \1); end if;', 'g');
  drop function errand_do(uuid, integer);
  execute v_def;
end $do$;

select private.lock_doors();
