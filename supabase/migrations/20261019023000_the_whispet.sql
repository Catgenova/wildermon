-- The Whispet, the Lanternveil and the Hallowmire.
--
-- Asked for: "Add a Halloween event wildermon only available October 15-november 15. Combat creature, has a fear
-- ability on cooldown". The kind itself comes in with the definitions; this is what is new under it, the same as the
-- browser's:
--
--   * a season (`SpeciesDef.season`, `WildSeason`): the days of the year, by the calendar in UTC and both ends in, a
--     kind is put down wild on (`season_from`, `season_to`, each `month * 100 + day`). On any other day `suits` refuses
--     it, so nothing stands it up, and the spawner takes the wild ones it finds standing off the island
--     (`wild_out_of_season`), as the browser's streaming does. One tamed, kept, bred, penned or in a trap is not wild,
--     or is the trap's, and stays all year.
--   * a Fear (`AbilityId` 'fear'): instead of a blow, what it fights runs from it for `fear_secs`, as a Chaos Fright
--     runs it (`flee_from`, which is `faith_flee` without the settle in front of it), and not again for `fear_rest`.
--     Monsters are not frightened, as a Fright does not frighten them: it strikes a monster as it would anything
--     else. One already running from it is left to run. A wild one fights as any other does (`beast_ability`).

-- What the definitions bring in, ahead of them, for what is written here to be read against: the columns a season is
-- kept in, and a Fear's two numbers (`FEAR_SECS`, `FEAR_REST`), which the definitions after this write again from the
-- browser's.
set local lock_timeout = '3s';
alter table species_def add column if not exists season_from int, add column if not exists season_to int;
create or replace function fear_secs() returns double precision language sql immutable as $fn$ select 5::double precision $fn$;
create or replace function fear_rest() returns double precision language sql immutable as $fn$ select 20::double precision $fn$;

-- The moment the wild's seasons are read at: now, or the one a test pins (epoch seconds), as `vine_now` is pinned.
create or replace function wild_now() returns timestamptz language sql stable as $fn$
  select coalesce(to_timestamp(nullif(current_setting('wurm.wild_now', true), '')::double precision), now())
$fn$;

-- Whether a season holds at a moment: the day it falls on in UTC is one of its days, both ends in; always, for none.
-- One that runs past the new year runs from its first day to the year's end and from the year's start (`seasonHolds`).
create or replace function season_holds(p_from int, p_to int, p_at timestamptz default wild_now()) returns boolean
language sql stable as $fn$
  select p_from is null or p_to is null
      or case when p_from <= p_to then q.d between p_from and p_to else q.d >= p_from or q.d <= p_to end
    from (select (extract(month from p_at at time zone 'UTC') * 100 + extract(day from p_at at time zone 'UTC'))::int as d) q
$fn$;

-- Whether a kind may be put down wild, or stay wild, now (`wildInSeason`).
create or replace function wild_in_season(p_species text) returns boolean language sql stable as $fn$
  select coalesce((select season_holds(s.season_from, s.season_to) from species_def s where s.id = p_species), true)
$fn$;

/*
 * The wild ones of a kind whose season is over, standing in a stretch of country: taken off, whether or not anything
 * is fighting them, and nothing left fighting them or marked for them. One in a trap is the trap's and stays. How many.
 */
create or replace function wild_out_of_season(p_world uuid, p_x0 int, p_y0 int, p_w int, p_h int) returns int
language plpgsql as $fn$
declare v_n int;
begin
  with gone as (
    delete from creature c using species_def s
     where c.world_id = p_world and c.mode = 'wild' and c.trapped is null
       and s.id = c.species and s.season_from is not null and not season_holds(s.season_from, s.season_to)
       and c.to_x >= p_x0 and c.to_x < p_x0 + p_w and c.to_y >= p_y0 and c.to_y < p_y0 + p_h
    returning c.id
  ), freed as (
    update creature e set enemy = null from gone g where e.world_id = p_world and e.enemy = g.id returning 1
  ), unmarked as (
    delete from class_mark m using gone g where m.world_id = p_world and m.creature_id = g.id returning 1
  )
  select count(*) into v_n from gone;
  return v_n;
end $fn$;

/*
 * A creature running from a spot for so long: its hunt and its fight dropped and none taken up meanwhile, and a leg
 * away as far as it runs in that time at the pace a nerve gone makes it (`flee_pace`), round whatever is in the way.
 * Until that time is out it strikes nothing (`until`). Stunned, it runs when the stun is over. What a Fright and a
 * Fear both do (`fleeFrom`); `faith_flee` settles it first, a Fear's blow comes in the middle of a settle and does not.
 */
create or replace function flee_from(p_world uuid, p_id int, p_fx double precision, p_fy double precision, p_secs double precision)
returns void language plpgsql as $fn$
declare c creature; d species_def; a age_def; v_cx double precision; v_cy double precision; v_d double precision;
        v_pace double precision; v_run double precision; v_step record; v_tx double precision; v_ty double precision;
        v_go timestamptz;
begin
  select * into c from creature where world_id = p_world and id = p_id for update;
  if not found then return; end if;
  select * into d from species_def where id = c.species;
  a := age_row(c.born, old_of(c), age_pace(c));
  v_cx := creature_x(c); v_cy := creature_y(c);
  v_d := greatest(0.001, sqrt((v_cx - p_fx) ^ 2 + (v_cy - p_fy) ^ 2));
  v_pace := greatest(0.1, d.speed * a.speed * beast_mul(c, 'speed') * flee_pace());
  v_run := v_pace * p_secs;
  select * into v_step from chase_leg(p_world, v_cx, v_cy, v_cx + (v_cx - p_fx) / v_d * v_run, v_cy + (v_cy - p_fy) / v_d * v_run);
  v_tx := coalesce(v_step.x, v_cx); v_ty := coalesce(v_step.y, v_cy);
  -- Stunned, it runs when the stun is over and not before (`enchant_stun`): the leg starts then, and the fright holds as long from then.
  v_go := now() + make_interval(secs => coalesce(stun_left(p_world, p_id), 0));
  update creature set hunting = null, windup_at = null, brawl = null,
      hunt_again = v_go + make_interval(secs => p_secs),
      from_x = v_cx, from_y = v_cy, to_x = v_tx, to_y = v_ty, leg_at = v_go,
      leg_ends = v_go + make_interval(secs => greatest(0.2, sqrt((v_tx - v_cx) ^ 2 + (v_ty - v_cy) ^ 2) / v_pace)),
      until = v_go + make_interval(secs => p_secs), settled_at = now()
    where world_id = p_world and id = p_id;
  perform fx_beast(p_id, p_secs, 'fright');
end $fn$;

create or replace function faith_flee(p_world uuid, p_id int, p_fx double precision, p_fy double precision, p_secs double precision)
returns void language plpgsql as $fn$
begin
  perform creature_settle(p_world, p_id);
  perform flee_from(p_world, p_id, p_fx, p_fy, p_secs);
end $fn$;

-- Seconds between goes at an ability, and its name: its spell's, a frost breath's or a Fear's (`abilityRest`, `abilityName`).
create or replace function ability_rest(p_id text) returns double precision language sql stable as $fn$
  select case when p_id = 'frost_breath' then frost_breath_rest() when p_id = 'fear' then fear_rest()
              else (select s.rest from class_spell s where s.id = p_id) end
$fn$;
create or replace function ability_name(p_id text) returns text language sql stable as $fn$
  select case when p_id = 'frost_breath' then 'Frost Breath' when p_id = 'fear' then 'Fear'
              else (select s.name from class_spell s where s.id = p_id) end
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Only in its season, for a kind with one.
    (1, 'suits', $$  if d.nocturnal and not is_night(p_world) then return false; end if;$$,
                 $$  if d.nocturnal and not is_night(p_world) then return false; end if;
  -- And only in its season, for a kind with one (`WildSeason`).
  if not season_holds(d.season_from, d.season_to) then return false; end if;$$, 1),

    -- A Fear: what it fights runs from it, and a monster, or one already running, takes a blow instead.
    (2, 'beast_ability', $$  when 'binder_root' then$$,
                         $$  when 'fear' then
    if coalesce(td.monster, false) or t.mode <> 'wild' or beast_mark(p_world, t.id, 'fear', 0) > 0 then return null; end if;
    perform flee_from(p_world, t.id, creature_x(a), creature_y(a), fear_secs());
    insert into class_mark (world_id, creature_id, kind, val, until, by_uid)
      values (p_world, t.id, 'fear', 1, now() + make_interval(secs => fear_secs()), a.keeper)
      on conflict (world_id, creature_id, kind) do update
        set val = 1, until = greatest(class_mark.until, excluded.until), by_uid = excluded.by_uid;
  when 'binder_root' then$$, 1),

    -- The spawner, looking at a stretch of country again, takes off what is out of its season there first, so what
    -- stands up in its place counts it gone.
    (3, 'creature_stock_block', $$  v_w := least(v_block, v_size - v_x0);
  v_h := least(v_block, v_size - v_y0);$$,
                                $$  v_w := least(v_block, v_size - v_x0);
  v_h := least(v_block, v_size - v_y0);
  -- What is out of its season here is taken off before anything is counted (`wild_out_of_season`).
  perform wild_out_of_season(p_world, v_x0, v_y0, v_w, v_h);$$, 1),
    (4, 'creature_stock', $$  select w.size into size from world w where w.id = p_world;$$,
                          $$  select w.size into size from world w where w.id = p_world;
  -- What is out of its season is taken off before anything is counted (`wild_out_of_season`).
  perform wild_out_of_season(p_world, 0, 0, size, size);$$, 1)
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
