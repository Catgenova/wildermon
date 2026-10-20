-- A deed worker says why it is standing about, and keeps a ledger of the last island day.
--
-- Asked for: "Show why a worker is idle. A wildermon set to work on a settlement (mode 'deed') often stands idle and
-- the player can't tell why" -- from a report of a Tinka sent home "from about 300 tiles away, but it didn't move" --
-- and "A work ledger: per deed worker, show what it did over the last island day".
--
-- Why it is idle. Every place the settle loop finds a worker nothing to do now records the cause on the creature, as
-- a code and a number (`idle_why`, `idle_n`), cleared when it next sets out to work. One code per cause, not per
-- place: `range` (nothing of its trade within its range, the number, of the token: `find_work_tile`, or the errand's
-- own search coming back empty), `stock` (nothing in the stores for it to work), `room` (no barrel on the settlement
-- with room for water), `full` (holding a load with nowhere on the settlement to put it), `far` (walking home, the
-- number its distance from its work). It records what the step already knew: `errand_step` hands back why it found
-- nothing with the nothing it already returned, and nothing else is looked at to work out a reason.
--
-- Two more are said where the clock is not working it at all, so nothing is stored: `rpc_creatures` reads a worker
-- whose turn is more than `idle_stale` seconds overdue as one nobody is settling, `away` when its keeper is away or
-- asleep and `unswept` (with `sweep_reach`, how far round somebody awake `world_tick` settles a tame thing) when they
-- are not. And it now sends your own deed workers wherever they are, not only within your range, which is the other
-- half of the report: "it didn't move and I couldn't select it".
--
-- The ledger. A jsonb on the creature (`ledger`): the island day it was last written on (`island_day`, `day_seconds`
-- long) and two days of counters, that day's and the one before (`ledger_roll`), each of goes at its task, skill
-- gained, and what it handled by the item, at most `ledger_items` kinds of thing a day. Counted where the loop already
-- records each: a go at `worker_do` and at every `errand_do` that did something, a load as it goes into a store, what
-- was in its arms and went into an errand's go, and the skill `worker_learn` gives a worker. No extra scans.
--
-- The browser keeps the same codes, the same ledger and the same sentences (`src/game/workerlog.ts`).

set local lock_timeout = '3s';

alter table creature add column if not exists idle_why text;
alter table creature add column if not exists idle_n real;
alter table creature add column if not exists ledger jsonb;

-- How many kinds of thing one day's ledger counts: the browser's `LEDGER_ITEMS`.
create or replace function ledger_items() returns int language sql immutable as $fn$ select 8 $fn$;
-- How far round somebody awake the clock settles a tame thing: `world_tick`'s coarse `creature_sweep`, forty tiles and
-- `leg_slack` past them, every `stir_coarse_every` seconds.
create or replace function sweep_reach() returns double precision language sql immutable as $fn$
  select 40::double precision + leg_slack()
$fn$;
-- How many seconds overdue a worker's turn is before it is read as one nobody is settling.
create or replace function idle_stale() returns double precision language sql immutable as $fn$ select 30::double precision $fn$;

-- Which of the island's days it is: the browser's `Game.islandDay`.
create or replace function island_day(p_world uuid) returns int language sql stable as $fn$
  select floor(world_time(p_world) / day_seconds())::int
$fn$;

-- The ledger as it stands on a day: rolled on to it if it was last written on an earlier one (`ledgerRoll`).
create or replace function ledger_roll(l jsonb, p_day int) returns jsonb language sql immutable as $fn$
  select case
    when l is null then jsonb_build_object('day', p_day, 'now', '{"goes": 0, "skill": 0, "made": {}}'::jsonb, 'last', null)
    when (l->>'day')::int = p_day then l
    else jsonb_build_object('day', p_day, 'now', '{"goes": 0, "skill": 0, "made": {}}'::jsonb,
                            'last', case when (l->>'day')::int = p_day - 1 then l->'now' end)
  end
$fn$;

-- Something counted to the day's work: goes, skill gained, so many of a thing handled (`ledgerAdd`). A kind of thing
-- past the first `ledger_items` of the day is left uncounted.
create or replace function ledger_add(l jsonb, p_day int, p_goes int, p_skill double precision, p_item text, p_n int)
returns jsonb language plpgsql immutable as $fn$
declare v jsonb := ledger_roll(l, p_day); d jsonb;
begin
  d := v->'now';
  d := jsonb_set(d, '{goes}', to_jsonb((d->>'goes')::int + coalesce(p_goes, 0)));
  d := jsonb_set(d, '{skill}', to_jsonb((d->>'skill')::double precision + coalesce(p_skill, 0)));
  if p_item is not null and coalesce(p_n, 0) > 0
     and (d->'made' ? p_item or (select count(*) from jsonb_object_keys(d->'made')) < ledger_items()) then
    d := jsonb_set(d, array['made', p_item], to_jsonb(coalesce((d->'made'->>p_item)::int, 0) + p_n));
  end if;
  return jsonb_set(v, '{now}', d);
end $fn$;

-- What it found to run, and now why it found nothing: a row with no place and a reason, rather than no row.
drop function if exists errand_step(uuid, integer);
create function errand_step(p_world uuid, p_id integer)
returns table(gx double precision, gy double precision, want text, wx integer, wy integer, why text, why_n double precision)
language plpgsql stable as $fn$
declare c creature; d species_def; dd deed; kind text; rng int;
        v_job record; v_store item; v_crate crate; v_hearth placed; v_spot record;
        v_vessel placed; v_wet record;
begin
  select * into c from creature where world_id = p_world and id = p_id;
  select * into d from species_def where id = c.species;
  select * into dd from my_deed(p_world, c.keeper) md where md.world_id is not null;
  if not found then return; end if;
  kind := d.gathers;
  rng := work_range(c);

  if kind = 'mend' then
    -- Nothing is carried: it works at whichever crate holds the worst of it.
    v_store := damaged_in_stores(p_world, c.keeper);
    if v_store.id is null then why := 'stock'; why_n := null; return next; return; end if;
    select * into v_crate from crate where world_id = p_world and id = v_store.crate;
    gx := crate_centre_x(v_crate); gy := crate_centre_y(v_crate);
    want := null; wx := v_crate.x; wy := v_crate.y;
    return next;
    return;

  elsif kind = 'hod' then
    -- Carrying a piece some work within reach still wants: that work. Otherwise the nearest work wanting something
    -- the stores hold, and the store nearest it holding that, crates and furniture alike (`hod_needing_stocked`).
    select * into v_job from hod_needing(p_world, dd.x, dd.y, rng, c.carrying->>'def');
    if c.carrying is null or v_job.item is distinct from c.carrying->>'def' then
      select * into v_job from hod_needing_stocked(p_world, c.keeper, dd.x, dd.y, rng);
      if v_job.item is null then why := 'range'; why_n := rng; return next; return; end if;
      select * into v_spot from store_holding(p_world, c.keeper, array[v_job.item], v_job.x + 0.5, v_job.y + 0.5);
      if v_spot.sid is null then why := 'stock'; why_n := null; return next; return; end if;
      gx := v_spot.cx; gy := v_spot.cy;
      want := v_job.item; wx := v_spot.x; wy := v_spot.y;
    else
      gx := v_job.x + 0.5; gy := v_job.y + 0.5;
      want := null; wx := v_job.x; wy := v_job.y;
    end if;
    return next;
    return;

  elsif kind = 'stoke' then
    v_hearth := cold_hearth(p_world, dd.x, dd.y, rng);
    if v_hearth.id is null then why := 'range'; why_n := rng; return next; return; end if;
    if c.carrying is null then
      v_store := fuel_in_stores(p_world, c.keeper);
      if v_store.id is null then why := 'stock'; why_n := null; return next; return; end if;
      select * into v_crate from crate where world_id = p_world and id = v_store.crate;
      gx := crate_centre_x(v_crate); gy := crate_centre_y(v_crate);
      want := v_store.def; wx := v_crate.x; wy := v_crate.y;
    else
      gx := v_hearth.cx; gy := v_hearth.cy;
      want := null; wx := v_hearth.x; wy := v_hearth.y;
    end if;
    return next;
    return;

  elsif kind = 'water' then
    -- Full: to whichever barrel on the deed has room. Empty: to the water.
    if c.carrying->>'def' = 'water_bucket' then
      v_vessel := thirsty_vessel(p_world, c.keeper);
      if v_vessel.id is null then why := 'room'; why_n := null; return next; return; end if;
      gx := v_vessel.cx; gy := v_vessel.cy;
      want := null; wx := v_vessel.x; wy := v_vessel.y;
    else
      select * into v_wet from water_source(p_world, dd.x, dd.y, rng, c);
      if v_wet.x is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_wet.gx; gy := v_wet.gy;
      want := null; wx := v_wet.x; wy := v_wet.y;
    end if;
    return next;
    return;

  elsif kind = 'prospect' then
    -- Nothing is carried and nothing is fetched: the work *is* the walk.
    select * into v_spot from unread_ground(p_world, dd.x, dd.y, rng, p_id, c);
    if v_spot.x is null then why := 'range'; why_n := rng; return next; return; end if;
    gx := v_spot.x + 0.5; gy := v_spot.y + 0.5;
    want := null; wx := v_spot.x; wy := v_spot.y;
    return next;
    return;

  elsif kind in ('groom', 'dairy', 'heal') then
    declare o creature; need text[]; v_s record;
    begin
      o := herd_target(p_world, c, kind, c.to_x, c.to_y);
      need := case when o.id is not null then herd_need(kind, o) end;
      -- Anything in its arms it has no use for goes back to the stores first.
      if c.carrying is not null and (o.id is null or need is null or not (c.carrying->>'def' = any(need))) then
        select * into v_s from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_s.id is null then why := 'full'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      if o.id is null then why := 'range'; why_n := rng; return next; return; end if;
      if need is not null and c.carrying is null then
        select * into v_s from store_holding(p_world, c.keeper, need, c.to_x, c.to_y);
        if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
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
      if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
      gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      return next;
      return;
    end;

  elsif kind in ('tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch') then
    declare v_r record;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes(kind));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      gx := v_r.cx; gy := v_r.cy; want := null; wx := v_r.x; wy := v_r.y;
      return next;
      return;
    end;

  elsif kind = 'lamp' then
    declare v_p placed; v_s record; v_hold boolean := coalesce(c.carrying->>'def' = 'candle', false);
    begin
      if c.carrying is not null and not v_hold then
        select * into v_s from worker_store(p_world, c, c.carrying->>'def', (c.carrying->>'count')::int);
        if v_s.id is null then why := 'full'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      v_p := lamp_target(p_world, c, v_hold or stores_count(p_world, c.keeper, 'candle') > 0, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      if lamp_wants(p_world, v_p) = 'candle' and not v_hold then
        select * into v_s from store_holding(p_world, c.keeper, array['candle'], c.to_x, c.to_y);
        if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      else
        gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
      end if;
      return next;
      return;
    end;

  elsif kind in ('smelt', 'kiln') then
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
        if v_s.id is null then why := 'full'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      if not v_hold then
        select * into v_s from store_holding(p_world, c.keeper, v_fits, c.to_x, c.to_y);
        if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
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
      if v_r.rid is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_r.cx; gy := v_r.cy; want := null; wx := v_r.x; wy := v_r.y;
      return next;
      return;
    end;

  elsif kind = 'brew' then
    declare v_b brew_def; v_p placed;
    begin
      v_b := brew_in_stores(p_world, c.keeper);
      if v_b.id is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := brew_target(p_world, c, v_b, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
      return next;
      return;
    end;

  elsif kind = 'cook' then
    declare v_r record; v_p placed;
    begin
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('cook'));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := cook_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'restore' then
    declare v_r record;
    begin
      select * into v_r from relic_in_stores(p_world, c.keeper);
      if v_r.name is null then why := 'stock'; why_n := null; return next; return; end if;
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
        if v_s.id is null then why := 'full'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      v_p := planter_target(p_world, c, v_hold or exists (select 1 from deed_store_items(p_world, c.keeper) s
               where (s.it).def = any(v_seeds) and not coalesce((s.it).locked, false)), c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      if not exists (select 1 from planter_crop pc where pc.placed = v_p.id) and not v_hold then
        select * into v_s from store_holding(p_world, c.keeper, v_seeds, c.to_x, c.to_y);
        if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      else
        gx := v_p.cx; gy := v_p.cy; want := null; wx := v_p.x; wy := v_p.y;
      end if;
      return next;
      return;
    end;

  elsif kind = 'paper' then
    declare v_r record; v_p placed;
    begin
      if c.carrying is not null then why := 'full'; why_n := null; return next; return; end if;
      select * into v_r from recipe_in_stores(p_world, c.keeper, tend_recipes('paper'));
      if v_r.rid is null then why := 'stock'; why_n := null; return next; return; end if;
      v_p := press_target(p_world, c, c.to_x, c.to_y);
      if v_p.id is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_p.cx; gy := v_p.cy; want := null; wx := floor(v_p.cx)::int; wy := floor(v_p.cy)::int;
      return next;
      return;
    end;

  elsif kind = 'glaze' then
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

  elsif kind = 'fill' then
    -- Full, or holding something it cannot fill: home to the stores. Empty-handed: a bucket out of them. Holding
    -- an empty bucket: to the water.
    declare v_s record; v_wet record; v_def text := c.carrying->>'def';
    begin
      select * into v_wet from water_source(p_world, dd.x, dd.y, rng, c);
      if v_def is not null and (v_def <> 'bucket' or v_wet.x is null) then
        select * into v_s from worker_store(p_world, c, v_def, (c.carrying->>'count')::int);
        if v_s.id is null then why := 'full'; why_n := null; return next; return; end if;
        gx := v_s.cx; gy := v_s.cy; want := null; wx := floor(v_s.cx)::int; wy := floor(v_s.cy)::int;
        return next;
        return;
      end if;
      if v_wet.x is null then why := 'range'; why_n := rng; return next; return; end if;
      if v_def = 'bucket' then
        gx := v_wet.gx; gy := v_wet.gy; want := null; wx := v_wet.x; wy := v_wet.y;
        return next;
        return;
      end if;
      select * into v_s from store_holding(p_world, c.keeper, array['bucket'], c.to_x, c.to_y);
      if v_s.x is null then why := 'stock'; why_n := null; return next; return; end if;
      gx := v_s.cx; gy := v_s.cy; want := null; wx := v_s.x; wy := v_s.y;
      return next;
      return;
    end;

  elsif kind = 'plant' then
    if c.carrying->>'def' is distinct from 'sprout' then
      v_store := stocked(p_world, 'sprout');
      if v_store.id is null then why := 'stock'; why_n := null; return next; return; end if;
      select * into v_crate from crate where world_id = p_world and id = v_store.crate;
      gx := crate_centre_x(v_crate); gy := crate_centre_y(v_crate);
      want := 'sprout'; wx := v_crate.x; wy := v_crate.y;
    else
      select * into v_spot from planting_spot(p_world, dd.x, dd.y, rng);
      if v_spot.x is null then why := 'range'; why_n := rng; return next; return; end if;
      gx := v_spot.x + 0.5; gy := v_spot.y + 0.5;
      want := null; wx := v_spot.x; wy := v_spot.y;
    end if;
    return next;
    return;
  end if;
  return;
end $fn$;


-- The settle loop: the reason kept where it decides it is idle, cleared where it sets out, and the ledger counted.
do $do$
declare v_def text;
  pairs text[][] := array[
    -- The day, once a settle.
    [$a$  kind := coalesce(c.job, d.gathers);
$a$, $a$  kind := coalesce(c.job, d.gathers);
  v_day := island_day(p_world);
$a$],
    [$a$        v_step record; v_site record; v_store record; v_in boolean;
$a$, $a$        v_step record; v_site record; v_store record; v_in boolean;
        v_day int; v_held jsonb; v_left int;
$a$],
    -- Walking home: `far`, and how far.
    [$a$      dist := sqrt((v_site.x + 0.5 - cx) ^ 2 + (v_site.y + 0.5 - cy) ^ 2);
      select * into v_step from chase_leg(p_world, cx, cy,
        cx + (v_site.x + 0.5 - cx) * home_leg() / dist, cy + (v_site.y + 0.5 - cy) * home_leg() / dist);
$a$, $a$      dist := sqrt((v_site.x + 0.5 - cx) ^ 2 + (v_site.y + 0.5 - cy) ^ 2);
      c.idle_why := 'far'; c.idle_n := dist;
      select * into v_step from chase_leg(p_world, cx, cy,
        cx + (v_site.x + 0.5 - cx) * home_leg() / dist, cy + (v_site.y + 0.5 - cy) * home_leg() / dist);
$a$],
    -- A fighter's load with nowhere to go.
    [$a$      if v_store.id is null then
        c.until := now() + interval '30 seconds';
        exit;
      end if;
$a$, $a$      if v_store.id is null then
        c.idle_why := 'full'; c.idle_n := null;
        c.until := now() + interval '30 seconds';
        exit;
      end if;
$a$],
    -- The row goes down before anything that reads it and writes it is asked, the reason and the ledger with it.
    [$a$          work_x = c.work_x, work_y = c.work_y, carrying = c.carrying, enemy = c.enemy,
          settled_at = now()
$a$, $a$          work_x = c.work_x, work_y = c.work_y, carrying = c.carrying, enemy = c.enemy,
          idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger, settled_at = now()
$a$],
    [$a$          work_x = c.work_x, work_y = c.work_y, carrying = c.carrying, fetching = c.fetching,
          settled_at = now()
$a$, $a$          work_x = c.work_x, work_y = c.work_y, carrying = c.carrying, fetching = c.fetching,
          idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger, settled_at = now()
$a$],
    [$a$          work_x = c.work_x, work_y = c.work_y, settled_at = now()
$a$, $a$          work_x = c.work_x, work_y = c.work_y, idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger,
          settled_at = now()
$a$],
    -- What it went to fetch has gone.
    [$a$        if load is null then
          c.phase := 'idle';
          c.leg_at := c.until; c.leg_ends := c.until;
          c.until := now() + interval '4 seconds';
          exit;
$a$, $a$        if load is null then
          c.idle_why := 'stock'; c.idle_n := null;
          c.phase := 'idle';
          c.leg_at := c.until; c.leg_ends := c.until;
          c.until := now() + interval '4 seconds';
          exit;
$a$],
    -- An errand's go: counted, with what was in its arms and went into it.
    [$a$        if errand_do(p_world, p_id) then done := done + 1; end if;
        select * into c from creature where world_id = p_world and id = p_id;
$a$, $a$        v_held := c.carrying;
        if errand_do(p_world, p_id) then
          done := done + 1;
          select * into c from creature where world_id = p_world and id = p_id;
          v_left := case when c.carrying->>'def' = v_held->>'def' then coalesce((c.carrying->>'count')::int, 1) else 0 end;
          c.ledger := ledger_add(c.ledger, v_day, 1, 0, v_held->>'def',
                                 greatest(0, coalesce((v_held->>'count')::int, 1) - v_left));
          c.idle_why := null; c.idle_n := null;
        else
          select * into c from creature where world_id = p_world and id = p_id;
        end if;
$a$],
    -- An errand with nothing to run says why.
    [$a$          -- Nothing to run. Replaying an afternoon of that produces nothing.
          c.from_x := cx; c.from_y := cy;
$a$, $a$          -- Nothing to run. Replaying an afternoon of that produces nothing.
          c.from_x := cx; c.from_y := cy;
          c.idle_why := step.why; c.idle_n := step.why_n;
$a$],
    [$a$        c.work_x := step.wx; c.work_y := step.wy;
$a$, $a$        c.work_x := step.wx; c.work_y := step.wy;
        c.idle_why := null; c.idle_n := null;
$a$],
    -- A gathering go.
    [$a$      load := worker_do(p_world, p_id);
      select * into c from creature where world_id = p_world and id = p_id;
      done := done + 1;
$a$, $a$      load := worker_do(p_world, p_id);
      select * into c from creature where world_id = p_world and id = p_id;
      done := done + 1;
      c.ledger := ledger_add(c.ledger, v_day, 1, 0, null, 0);
      c.idle_why := null; c.idle_n := null;
$a$],
    -- A load brought in.
    [$a$          perform away_count(p_world, c.keeper, 'haul', c.carrying->>'def', (c.carrying->>'count')::bigint);
          c.carrying := null;
$a$, $a$          perform away_count(p_world, c.keeper, 'haul', c.carrying->>'def', (c.carrying->>'count')::bigint);
          c.ledger := ledger_add(c.ledger, v_day, 0, 0, c.carrying->>'def', coalesce((c.carrying->>'count')::int, 1));
          c.carrying := null;
$a$],
    -- Found work.
    [$a$        -- Anything found at all, and the idle clock starts over.
        c.idle_since := null;
$a$, $a$        -- Anything found at all, and the idle clock starts over.
        c.idle_since := null;
        c.idle_why := null; c.idle_n := null;
$a$],
    -- And it all goes down at the end.
    [$a$      idle_since = c.idle_since,
$a$, $a$      idle_since = c.idle_since, idle_why = c.idle_why, idle_n = c.idle_n, ledger = c.ledger,
$a$]
  ];
  i int; n int;
begin
  select pg_get_functiondef('public.worker_settle'::regproc) into v_def;
  for i in 1 .. array_length(pairs, 1) loop
    n := (length(v_def) - length(replace(v_def, pairs[i][1], ''))) / length(pairs[i][1]);
    if n <> 1 then raise exception 'worker_settle has % of anchor %, not 1: %', n, i, pairs[i][1]; end if;
    v_def := replace(v_def, pairs[i][1], pairs[i][2]);
  end loop;
  -- The two that occur twice, each a cause wherever it occurs: nowhere to put a load, and nothing of its trade in range.
  n := (length(v_def) - length(replace(v_def, 'perform worker_nowhere(p_world, c);', ''))) / length('perform worker_nowhere(p_world, c);');
  if n <> 2 then raise exception 'worker_settle has % of worker_nowhere, not 2', n; end if;
  v_def := replace(v_def, 'perform worker_nowhere(p_world, c);', 'perform worker_nowhere(p_world, c); c.idle_why := ''full''; c.idle_n := null;');
  n := (length(v_def) - length(replace(v_def, 'c.idle_since := coalesce(c.idle_since, now());', ''))) / length('c.idle_since := coalesce(c.idle_since, now());');
  if n <> 2 then raise exception 'worker_settle has % of the idle clock, not 2', n; end if;
  v_def := replace(v_def, 'c.idle_since := coalesce(c.idle_since, now());',
    'c.idle_since := coalesce(c.idle_since, now()); c.idle_why := ''range''; c.idle_n := v_site.radius;');
  execute v_def;
end $do$;

-- What a worker learns at work, counted to its ledger as the browser's `gainSkill` counts it.
do $do$
declare v_def text;
  v_old text := $a$  update creature set skills = jsonb_set(skills, array[p_skill], to_jsonb(now_v)), xp = xp + (now_v - was)
$a$;
  v_new text := $a$  update creature set skills = jsonb_set(skills, array[p_skill], to_jsonb(now_v)), xp = xp + (now_v - was),
      ledger = case when c.mode = 'deed' and now_v > was
                    then ledger_add(ledger, island_day(p_world), 0, now_v - was, null, 0) else ledger end
$a$;
begin
  select pg_get_functiondef('public.worker_learn'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'worker_learn does not raise a skill where it was expected to';
  end if;
  execute replace(v_def, v_old, v_new);
end $do$;

-- And the browser is told: why, to anybody who looks at a worker; the ledger, to its keeper; and your own workers
-- wherever they are.
do $do$
declare v_def text;
  v_old1 text := $a$      || case when c.rare is null then '{}'::jsonb else jsonb_build_object('rare', c.rare) end
$a$;
  v_new1 text := $a$      || case when c.rare is null then '{}'::jsonb else jsonb_build_object('rare', c.rare) end
      /*
       * Why a worker is standing about, as its card says it (`idleSays`). One
       * whose turn is long overdue is one the clock is not settling at all:
       * its keeper is away, or nobody awake is near enough (`sweep_reach`).
       */
      || case when c.mode <> 'deed' then '{}'::jsonb
              when c.until < now() - make_interval(secs => idle_stale()) then jsonb_build_object(
                'idleWhy', case when exists (select 1 from player k where k.world_id = p_world and k.uid = c.keeper
                                               and not k.away and k.seen_at > now() - make_interval(secs => idle_logout()))
                                then 'unswept' else 'away' end,
                'idleN', sweep_reach(), 'idlePost', c.post is not null)
              else jsonb_build_object('idleWhy', c.idle_why, 'idleN', c.idle_n, 'idlePost', c.post is not null) end
      -- And what it did this island day and the one before, for its keeper.
      || case when c.keeper = me and c.mode = 'deed' then jsonb_build_object('ledger', c.ledger) else '{}'::jsonb end
$a$;
  v_old2 text := $a$    where (c.world_id = p_world and c.keeper = me and c.mode = 'stored')
$a$;
  v_new2 text := $a$    where (c.world_id = p_world and c.keeper = me and c.mode in ('stored', 'deed'))
$a$;
begin
  select pg_get_functiondef('public.rpc_creatures'::regproc) into v_def;
  if (length(v_def) - length(replace(v_def, v_old1, ''))) / length(v_old1) <> 1 then
    raise exception 'rpc_creatures does not say rarity where it was expected to';
  end if;
  if (length(v_def) - length(replace(v_def, v_old2, ''))) / length(v_old2) <> 1 then
    raise exception 'rpc_creatures does not send your crated wildermon where it was expected to';
  end if;
  execute replace(replace(v_def, v_old1, v_new1), v_old2, v_new2);
end $do$;

select private.lock_doors();
