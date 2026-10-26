/*
 * Sleep logs you off in a bed, and the sleep bonus.
 *
 * Asked for: "beds say 'sleep over the night' when they should operate like
 * wurm beds, logging the player off and beginning the stage of sleep bonus
 * gain while the player is offline".
 *
 * Sleep (`last_refusal`, `perform_last`, `sleep_fall`), any hour of the day:
 *
 *   * refused, in this order, on what is not a bed, out of reach, on a bed
 *     neither made by you nor on a settlement of yours (`on_my_deed`), with
 *     another job going, in a fight (`is_fight`, or something wild hunting
 *     you) and mounted. Night only is gone;
 *   * done, the body has what a night in the bed gave it (wind full, health
 *     back by the bed's worth, hungrier and thirstier, body stamina raised), is
 *     written down asleep in that bed (`private.asleep`: the bed, its name,
 *     where the body lay down, where the bed stands, the sleep bonus a second
 *     it is worth, `sleep_rate`, and the time), and is logged off as the idle
 *     log-out does it (`away`). The beat says `asleep`, and the page logs off.
 *   * asleep, nothing is asked of it (`act_refusal`: `sleep_said('asleep')`),
 *     and no door brings it back on the island but `rpc_join`
 *     (`private.asleep_stays` keeps `away` set).
 *
 * The next `rpc_join` wakes it (`private.sleep_wake`): the time asleep at the
 * bed's rate is added to what is stored, to `sleep_cap` (`sleep_banked`); the
 * body stands where it lay down beside the bed, or on the first free tile
 * round the bed when that is no longer ground a body can stand on, or where
 * the bed stood when the bed is gone; and the log says `sleep_slept_said`.
 * Logged off anywhere else: no sleep bonus.
 *
 * The sleep bonus (`player.rested`, seconds stored, and `player.sleep_on`):
 * `rpc_sleep_bonus` switches it. On and online, skill gain ×`sleep_bonus_mult`
 * while any is stored (`skill_mult`, `rest_bonus`), draining a second a second
 * (`body_settle`, from `rested_at`); off, or logged off, it keeps. It used to
 * be rest, banked by a night and burned by the work: what was stored is kept
 * as sleep bonus, switched off.
 *
 * And `sleep_until_morning` is gone: it pushed the whole island's memory back
 * a night (`sleep_forward`) for every sleeper.
 */
set local lock_timeout = '3s';

alter table player add column if not exists sleep_on boolean not null default false;

/* Each body logged off asleep in a bed, until it is woken. Read by the doors only. */
create table if not exists private.asleep (
  world_id uuid not null,
  uid uuid not null,
  -- The bed, and its name when lain down in.
  bed bigint not null,
  name text not null,
  -- Where the body lay down, beside it.
  x double precision not null,
  y double precision not null,
  level int not null default 0,
  -- Where the bed stood: where the body wakes if the bed has gone.
  bed_x double precision not null,
  bed_y double precision not null,
  bed_level int not null default 0,
  -- Sleep bonus a second asleep (`sleep_rate`), and the Dreamweave's share, for the cap.
  rate double precision not null,
  dream double precision not null default 0,
  at timestamptz not null default now(),
  primary key (world_id, uid)
);
alter table private.asleep enable row level security;
revoke all on table private.asleep from public, anon, authenticated;

/* ---- the numbers and the words: `src/game/sleep.ts` ------------------------------------------------------------ */

/** A stretch of time as the sleep lines say it: "2 h 5 m", "45 m". Whole minutes, rounded down (`sleepHm`). */
create or replace function sleep_hm(p_secs double precision) returns text language sql immutable as $fn$
  select case when floor(greatest(0, coalesce(p_secs, 0)) / 60)::bigint >= 60
              then (floor(greatest(0, coalesce(p_secs, 0)) / 60)::bigint / 60) || ' h '
                   || (floor(greatest(0, coalesce(p_secs, 0)) / 60)::bigint % 60) || ' m'
              else (floor(greatest(0, coalesce(p_secs, 0)) / 60)::bigint % 60) || ' m' end
$fn$;

/** Sleep bonus a second asleep in a bed of this worth (`furniture_def.bed`), QL and Dreamweave (`sleepRate`). */
create or replace function sleep_rate(p_bed double precision, p_ql double precision, p_dream double precision default 0)
  returns double precision language sql immutable as $fn$
  select sleep_bonus_rate() * coalesce(p_bed, 1) * (1 + greatest(0, least(100, coalesce(p_ql, 0))) / sleep_bonus_ql())
         * (1 + coalesce(p_dream, 0))
$fn$;

/** The most stored after sleeping in a bed with a Dreamweave of this share (`sleepCap`). */
create or replace function sleep_cap(p_dream double precision default 0) returns double precision language sql immutable as $fn$
  select sleep_bonus_cap() * (1 + coalesce(p_dream, 0))
$fn$;

/** What is stored after this long asleep at this rate: to the cap, never less than was stored (`sleepBanked`). */
create or replace function sleep_banked(p_was double precision, p_secs double precision, p_rate double precision,
    p_dream double precision default 0) returns double precision language sql immutable as $fn$
  select greatest(p_was, least(sleep_cap(p_dream), p_was + greatest(0, p_secs) * p_rate))
$fn$;

/** The line on waking (`sleptSaid`). */
create or replace function sleep_slept_said(p_asleep double precision, p_gained double precision, p_stored double precision)
  returns text language sql immutable as $fn$
  select 'Slept ' || sleep_hm(p_asleep) || ': sleep bonus +' || sleep_hm(p_gained) || ' (' || sleep_hm(p_stored) || ' stored).'
$fn$;

/** The line when it is switched (`sleepSwitchSaid`). */
create or replace function sleep_switch_said(p_on boolean, p_left double precision) returns text language sql immutable as $fn$
  select case when p_on then 'Sleep bonus: on. Skill gain ×' || sleep_bonus_mult()::int || '; ' || sleep_hm(p_left) || ' left.'
              else 'Sleep bonus: off. ' || sleep_hm(p_left) || ' stored.' end
$fn$;

/** A bed neither yours nor on a settlement of yours (`sleepNotYours`). */
create or replace function sleep_not_yours(p_name text) returns text language sql immutable as $fn$
  select 'Not yours: ' || lower(p_name) || '.'
$fn$;

/** Where a body sleeps, as the log and the boot card say it (`asleepIn`). */
create or replace function asleep_in(p_name text) returns text language sql immutable as $fn$
  select 'Asleep in ' || lower(p_name)
$fn$;

/* ---- asleep ---------------------------------------------------------------------------------------------------- */

/** Whether this body is logged off asleep in a bed. */
create or replace function private.sleeping(p_world uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.asleep a where a.world_id = p_world and a.uid = p_uid)
$$;

/** What is stored: the sleep bonus left, in seconds. */
create or replace function rest_left(p player) returns double precision language sql stable as $$
  select greatest(0, coalesce(p.rested, 0))
$$;

/** What the sleep bonus is worth to a skill just now: ×`sleep_bonus_mult` while on and any is stored. */
create or replace function rest_bonus(p_world uuid, p_uid uuid) returns double precision
  language sql stable as $$
  select case when exists (select 1 from player p where p.world_id = p_world and p.uid = p_uid
                             and p.sleep_on and rest_left(p) > 0) then sleep_bonus_mult() else 1 end
$$;

/**
 * Lie down in a bed and log off (`fallAsleep`): what a night in it gives the
 * body, the sleep written down, and the body away.
 */
create or replace function sleep_fall(p_world uuid, p_uid uuid, pc placed) returns void
  language plpgsql as $fn$
declare p player; v_bed double precision; v_rest double precision; v_dream double precision; v_name text;
begin
  select * into p from player where world_id = p_world and uid = p_uid for update;
  if not found then return; end if;
  v_bed := coalesce((select bed from furniture_def where id = pc.sub), 1);
  -- A well-made bed gives more back than a cot, and a bed in a closed room more than one in a field.
  v_rest := v_bed * (0.6 + pc.ql / 250)
    * case when case when pc.level < 0 then cellar_done(p_world, floor(pc.x)::int, floor(pc.y)::int) -- cellar: always indoors
                     else indoors(p_world, 0, floor(pc.x)::int, floor(pc.y)::int) end -- cellar
           then indoors_rest() else 1 end; -- cellar
  -- And a Dreamweave set into it, on the sleep bonus and on the most stored.
  v_dream := coalesce(placed_enchant(pc, 'dream'), 0);
  v_name := placed_name(pc);
  update player set stats = jsonb_set(jsonb_set(jsonb_set(jsonb_set(stats,
        '{stamina}', '1'),
        '{health}', to_jsonb(least(1, coalesce((stats->>'health')::double precision, 1) + 0.25 * v_rest))),
        '{hunger}', to_jsonb(greatest(0, coalesce((stats->>'hunger')::double precision, 1) - 0.2))),
        '{thirst}', to_jsonb(greatest(0, coalesce((stats->>'thirst')::double precision, 1) - 0.25)))
   where world_id = p_world and uid = p_uid;
  perform skill_raise(p_world, p_uid, 'body_stamina', 0.3 * v_rest);
  insert into private.asleep as a (world_id, uid, bed, name, x, y, level, bed_x, bed_y, bed_level, rate, dream, at)
  values (p_world, p_uid, pc.id, v_name, p.x, p.y, coalesce(p.level, 0), coalesce(pc.cx, pc.x + 0.5), coalesce(pc.cy, pc.y + 0.5),
          coalesce(pc.level, 0), sleep_rate(v_bed, pc.ql, v_dream), v_dream, now())
  on conflict (world_id, uid) do update set bed = excluded.bed, name = excluded.name, x = excluded.x, y = excluded.y,
    level = excluded.level, bed_x = excluded.bed_x, bed_y = excluded.bed_y, bed_level = excluded.bed_level, rate = excluded.rate,
    dream = excluded.dream, at = excluded.at;
  -- Logged off, as the idle log-out does it; what was lined up behind it goes.
  update player set away = true, left_at = now(), act_queue = '[]'::jsonb, aboard = null, seat = null
   where world_id = p_world and uid = p_uid;
  perform tell(p_world, p_uid, asleep_in(v_name) || '.', 'event');
end $fn$;

/**
 * Wake a body logged off asleep (`rpc_join`): the sleep bonus of the time
 * asleep added, the body beside the bed, and the line said. Nothing for a body
 * that is not asleep.
 */
create or replace function private.sleep_wake(p_world uuid, p_uid uuid) returns void
  language plpgsql security definer set search_path = public as $fn$
declare s private.asleep; p player; pc placed; v_secs double precision; v_was double precision; v_now double precision;
        v_x double precision; v_y double precision; v_level int;
begin
  delete from private.asleep where world_id = p_world and uid = p_uid returning * into s;
  if s.uid is null then return; end if;
  select * into p from player where world_id = p_world and uid = p_uid for update;
  if not found then return; end if;
  v_secs := greatest(0, extract(epoch from now() - s.at));
  v_was := greatest(0, coalesce(p.rested, 0));
  v_now := sleep_banked(v_was, v_secs, s.rate, s.dream);
  select * into pc from placed where world_id = p_world and id = s.bed and kind = 'furniture';
  if pc.id is not null then
    -- Where it lay down beside the bed, while a body can stand there; else the first free tile round the bed.
    if passable(p_world, floor(s.x)::int, floor(s.y)::int) then
      v_x := s.x; v_y := s.y; v_level := s.level;
    else
      select l.x + 0.5, l.y + 0.5 into v_x, v_y from respawn_landing(p_world, pc.x, pc.y) l;
      v_level := coalesce(pc.level, 0);
    end if;
    if v_x is null then v_x := s.x; v_y := s.y; v_level := s.level; end if;
  else
    -- The bed is gone: where it stood.
    v_x := s.bed_x; v_y := s.bed_y; v_level := s.bed_level;
  end if;
  update player set x = v_x, y = v_y, level = v_level, moved_at = now(), body_at = now(),
         rested = v_now, rested_at = now()
   where world_id = p_world and uid = p_uid;
  perform tell(p_world, p_uid, sleep_slept_said(v_secs, v_now - v_was, v_now), 'event');
end $fn$;

/**
 * A body asleep stays logged off whatever door it knocks at, until `rpc_join`
 * wakes it; and one coming back counts its sleep bonus's drain from now.
 */
create or replace function private.asleep_stays() returns trigger
  language plpgsql security definer set search_path = public as $fn$
begin
  if exists (select 1 from private.asleep a where a.world_id = new.world_id and a.uid = new.uid) then
    new.away := true;
  else
    new.rested_at := now();
  end if;
  return new;
end $fn$;

drop trigger if exists player_asleep_stays on player;
create trigger player_asleep_stays before update of away on player
  for each row when (old.away and not new.away) execute function private.asleep_stays();

revoke all on function private.sleeping(uuid, uuid), private.sleep_wake(uuid, uuid), private.asleep_stays()
  from public, anon, authenticated;

/**
 * Switch the sleep bonus. What drained up to now is drained first
 * (`body_settle`), and the drain counts from now. The answer is whether it is
 * on and what is stored, or `why` not.
 */
create or replace function rpc_sleep_bonus(p_world uuid, p_on boolean) returns jsonb
  language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); p player;
begin
  if p_on is null then perform private.bad_request('rpc_sleep_bonus', 'p_on: want true or false'); end if;
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if not exists (select 1 from player where world_id = p_world and uid = me) then raise exception 'not on this island'; end if;
  if private.sleeping(p_world, me) then return jsonb_build_object('why', sleep_said('asleep')); end if;
  perform body_settle(p_world, me);
  update player set sleep_on = p_on, rested_at = now() where world_id = p_world and uid = me returning * into p;
  perform tell(p_world, me, sleep_switch_said(p.sleep_on, rest_left(p)), 'event');
  return jsonb_build_object('on', p.sleep_on, 'left', rest_left(p));
end $fn$;

drop function if exists sleep_until_morning(uuid, uuid, double precision, text, double precision);

/* ---- what changes ---------------------------------------------------------------------------------------------- */

/* Sleep, refused: any hour; a bed of yours or on a settlement of yours; no other job, no fight, not mounted. */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.last_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  if position('sleep_not_yours' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$    if p_action = 'sleep' and not is_night(p_world) then
      return world_clock(p_world) || ': night only.';
    end if;
$$, $$    if p_action = 'sleep' then
      if not coalesce(pc.made_by = p_uid, false) and not on_my_deed(p_world, p_uid, pc.x, pc.y) then
        return sleep_not_yours(placed_name(pc));
      end if;
      if p.act is not null and p.act <> 'sleep' then return sleep_said('busy'); end if;
      if is_fight(p.act) or exists (select 1 from creature cr where cr.world_id = p_world and cr.hunting = p_uid
                                       and cr.mode = 'wild' and cr.health > 0) then
        return sleep_said('fight');
      end if;
      if exists (select 1 from creature cr where cr.world_id = p_world and cr.rider = p_uid) then return sleep_said('mounted'); end if;
    end if;
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'last_refusal: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* Sleep, done: lain down and logged off (`sleep_fall`). */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure);
  if position('sleep_fall' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$    perform sleep_until_morning(p_world, p_uid,
      (select bed from furniture_def where id = pc.sub) * (0.6 + pc.ql / 250)
        * case when case when pc.level < 0 then cellar_done(p_world, floor(pc.x)::int, floor(pc.y)::int) -- cellar: always indoors
                         else indoors(p_world, 0, floor(pc.x)::int, floor(pc.y)::int) end -- cellar
               then indoors_rest() else 1 end, -- cellar
      lower(placed_name(pc)),
      -- And a Dreamweave set into it banks more of the night.
      placed_enchant(pc, 'dream'));
$$, $$    -- Lain down in it and logged off, asleep until the next join (`sleep_fall`, `private.sleep_wake`).
    perform sleep_fall(p_world, p_uid, pc);
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'perform_last: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* The drain: a second a second while switched on and on the island, from `rested_at`. */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.body_settle(uuid,uuid)'::regprocedure);
  if position('sleep_on' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$        v_upkeep double precision; v_free double precision;
$$, $$        v_upkeep double precision; v_free double precision; v_drain double precision;
$$),
    (2, $$  if p.act is not null and coalesce(p.rested, 0) > 0 then
    update player set rested = greatest(0, p.rested - secs)
      where world_id = p_world and uid = p_uid;
    if p.rested - secs <= 0 then
      perform tell(p_world, p_uid,
        'Rested ended: normal skill gain.', 'system');
    end if;
  end if;
$$, $$  -- Now the sleep bonus (`sleep.ts`): it drains while switched on and on the island, from when it was last counted.
  if p.sleep_on and not p.away and coalesce(p.rested, 0) > 0 then
    v_drain := least(secs, greatest(0, extract(epoch from (now() - p.rested_at))));
    update player set rested = greatest(0, p.rested - v_drain), rested_at = now()
      where world_id = p_world and uid = p_uid;
    if p.rested - v_drain <= 0 then
      perform tell(p_world, p_uid, sleep_said('used'), 'system');
    end if;
  end if;
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'body_settle: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* Skill gain ×`sleep_bonus_mult` while switched on and any is stored. */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.skill_mult(uuid,uuid,text)'::regprocedure);
  if position('sleep_bonus_mult' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$  m := case when coalesce(p.rested, 0) > 0 then rest_mult() else 1 end;
$$, $$  m := case when p.sleep_on and coalesce(p.rested, 0) > 0 then sleep_bonus_mult() else 1 end;
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'skill_mult: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* Nothing is asked of a body asleep. */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.act_refusal(uuid,uuid,text,jsonb)'::regprocedure);
  if position('private.sleeping' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$begin
  why := private.reach_refusal(p_world, p_uid, p_action, p_target); if why is not null then return why; end if;
$$, $$begin
  -- Logged off asleep in a bed: nothing until the next join wakes it (`private.sleep_wake`).
  if private.sleeping(p_world, p_uid) then return sleep_said('asleep'); end if;
  why := private.reach_refusal(p_world, p_uid, p_action, p_target); if why is not null then return why; end if;
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'act_refusal: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* The beat says whether the sleep bonus is on, and that the body is asleep, by its bed's name. */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.rpc_settle(bigint,uuid,bigint,boolean,jsonb)'::regprocedure);
  if position('sleep_on' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$    'rested', coalesce(p.rested, 0),
$$, $$    'rested', coalesce(p.rested, 0),
    -- And whether it is switched on (`rpc_sleep_bonus`).
    'sleep_on', coalesce(p.sleep_on, false),
$$),
    (2, $$    || jsonb_build_object('fallen', respawn_offer(v_world, me)));
$$, $$    || jsonb_build_object('fallen', respawn_offer(v_world, me))
    -- Logged off asleep in a bed, by its name: the page logs off (`sleep_fall`).
    || jsonb_build_object('asleep', (select a.name from private.asleep a where a.world_id = v_world and a.uid = me)));
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'rpc_settle: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

/* A join wakes a body asleep, before it is back on the island. */
do $do$
declare v_def text; v_n int; r record;
begin
  v_def := pg_get_functiondef('public.rpc_join(uuid,text,text)'::regprocedure);
  if position('sleep_wake' in v_def) > 0 then return; end if;
  for r in select * from (values
    (1, $$    delete from away_tally where world_id = p_world and uid = me;
$$, $$    delete from away_tally where world_id = p_world and uid = me;
    -- Asleep in a bed: woken beside it, with the sleep bonus of the time asleep (`private.sleep_wake`).
    perform private.sleep_wake(p_world, me);
$$)
  ) as t(ord, old, new) order by ord loop
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception 'rpc_join: % of change %, not 1', v_n, r.ord; end if;
    v_def := replace(v_def, r.old, r.new);
  end loop;
  execute v_def;
end $do$;

select private.lock_doors();
