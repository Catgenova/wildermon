/*
 * The island's watch: where things come from, whether they add up, and four
 * checks a keeper is shown as flags.
 *
 * ## Provenance
 *
 * `private.watch_made`: per island, UTC day, item and source, how many stacks
 * came into being and how many things were in them (`made_n`, `made_qty`), and
 * the same for stacks that went (`gone_n`, `gone_qty`). A stack that grows
 * counts what it grew by as made, one that shrinks what it lost as gone, and
 * one that turns into something else as the old thing gone and the new made.
 * The source is the door that did it:
 *
 *   act:<action>   a go of an action, whichever call settled it (`settle` names it);
 *   rpc_<door>     the door the browser knocked on;
 *   <job>          a function the clock or a test called (`world_tick`, ...);
 *   sql            anything else: a statement written straight against the table.
 *
 * Written by triggers on `item`, never a row per action: the triggers append
 * to `private.watch_made_new`, which no two transactions ever contend for, and
 * the sweep folds it into `watch_made` every five minutes. Kept 30 days.
 *
 * ## Reconciling
 *
 * Nightly, for each island: what is in the world now, less what the ledger says
 * came and went today, is what there was at the start of today (`watch_stock`).
 * That should be the last such count plus everything made and less everything
 * gone since. Off by more than 1 in 1000 (any amount under a thousand) is a
 * `stock` flag: more than the ledger accounts for is a duplicate, fewer is a
 * leak. Things made with source `sql` are a `no_door` flag.
 *
 * ## The checks
 *
 *   shared_ip  things or silver passed between two accounts that have both
 *              been seen on one IP (`private.player_ip`, filled on join): by
 *              trade, deal, parcel, stall, or dropped by one and picked up by
 *              the other within a day. Once a day per giver and getter.
 *   awake      a body moving or acting for over 20 hours with no break of 30
 *              minutes. Sampled every 5 minutes: a sample that finds nothing
 *              for 25 minutes is a break, so every 30-minute break is seen.
 *   skill      a skill risen over an hour by more than 3 times what that hour
 *              could teach at most: its fastest go at that level, with the
 *              best tool and the body's own pace, over and over, every go a
 *              full one at the best roll and the body's own multiplier
 *              (`act_duration`, `skill_gain_of`, `skill_mult`).
 *   stock, no_door as above.
 *
 * Every flag is kept 30 days; `rpc_owner_flags` lists them for a keeper and
 * `rpc_owner_flag_seen` marks one, or all, seen.
 */
set local lock_timeout = '3s';

-- ------------------------------------------------------------------ numbers

/** Days a flag, and the ledger, are kept. */
create or replace function private.watch_keep_days() returns int language sql immutable as $fn$ select 30 $fn$;
/** Hours of activity with no break that raise `awake`. */
create or replace function private.watch_awake_hours() returns int language sql immutable as $fn$ select 20 $fn$;
/** Minutes with nothing moved or done that are a break. */
create or replace function private.watch_break_mins() returns int language sql immutable as $fn$ select 30 $fn$;
/** Minutes between sweeps. */
create or replace function private.watch_sweep_mins() returns int language sql immutable as $fn$ select 5 $fn$;
/** How many times an hour's ceiling a skill must rise by to be flagged. */
create or replace function private.watch_skill_times() returns int language sql immutable as $fn$ select 3 $fn$;
/** Minutes a skill's rise is measured over. */
create or replace function private.watch_skill_mins() returns int language sql immutable as $fn$ select 60 $fn$;
/** Parts in a thousand an item's count may be off the ledger. */
create or replace function private.watch_stock_per_mille() returns int language sql immutable as $fn$ select 1 $fn$;
/** The best roll a go has at a skill: `skill_raise` rolls 0.6 + 0.8 × random(). */
create or replace function private.watch_best_roll() returns double precision language sql immutable as $fn$ select 1.4::double precision $fn$;

-- ------------------------------------------------------------------ tables

-- The IPs each account has been seen on. Filled elsewhere (on join and heartbeat); read here.
create table if not exists private.player_ip (
  uid uuid not null, ip inet not null,
  first_at timestamptz not null default now(), last_at timestamptz not null default now(), seen int not null default 1,
  primary key (uid, ip));
alter table private.player_ip enable row level security;
revoke all on table private.player_ip from public, anon, authenticated;

create table if not exists private.watch_made (
  world_id uuid not null,
  day date not null,
  def text not null,
  source text not null,
  made_n bigint not null default 0,
  made_qty bigint not null default 0,
  gone_n bigint not null default 0,
  gone_qty bigint not null default 0,
  primary key (world_id, day, def, source)
);
-- Appended to by the triggers, folded into `watch_made` by the sweep. No key and no index: an insert here waits on nobody.
create table if not exists private.watch_made_new (
  world_id uuid not null,
  day date not null,
  def text not null,
  source text not null,
  made_n bigint not null default 0,
  made_qty bigint not null default 0,
  gone_n bigint not null default 0,
  gone_qty bigint not null default 0
);
-- What each island held of each thing at the start of a UTC day, as the night worked it out.
create table if not exists private.watch_stock (
  world_id uuid not null,
  day date not null,
  def text not null,
  qty bigint not null,
  primary key (world_id, day, def)
);
-- Things and silver passed from one account to another, per day, door and direction.
create table if not exists private.watch_hand (
  world_id uuid not null,
  day date not null,
  giver uuid not null,
  getter uuid not null,
  via text not null,
  n bigint not null default 0,
  things bigint not null default 0,
  silver bigint not null default 0,
  at timestamptz not null default now(),
  primary key (world_id, day, giver, getter, via)
);
-- Who put a thing on the ground, until somebody picks it up or a day passes.
create table if not exists private.watch_drop (
  item bigint primary key,
  world_id uuid not null,
  uid uuid not null,
  at timestamptz not null default now()
);
-- Each body's run of activity: since when, last seen active, last sampled, and whether this run is flagged.
create table if not exists private.watch_body (
  world_id uuid not null,
  uid uuid not null,
  run_from timestamptz,
  last_at timestamptz,
  sampled_at timestamptz not null default now(),
  flagged boolean not null default false,
  primary key (world_id, uid)
);
-- Each skill as it stood at the start of the hour it is measured over.
create table if not exists private.watch_skill (
  world_id uuid not null,
  uid uuid not null,
  id text not null,
  value double precision not null,
  at timestamptz not null default now(),
  primary key (world_id, uid, id)
);
create table if not exists private.watch_flag (
  n bigint generated always as identity primary key,
  world_id uuid not null,
  uid uuid,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  seen boolean not null default false
);
create index if not exists watch_flag_world on private.watch_flag (world_id, n);
create index if not exists watch_flag_kind on private.watch_flag (world_id, kind, at);
create index if not exists watch_flag_at on private.watch_flag (at);
create index if not exists watch_drop_at on private.watch_drop (at);

do $do$
declare t text;
begin
  foreach t in array array['watch_made', 'watch_made_new', 'watch_stock', 'watch_hand', 'watch_drop',
                           'watch_body', 'watch_skill', 'watch_flag'] loop
    execute format('alter table private.%I enable row level security', t);
    execute format('revoke all on table private.%I from public, anon, authenticated', t);
  end loop;
end $do$;

-- ------------------------------------------------------------------ the source

/*
 * Who is making or unmaking things: `wurm.source` if something set it (a go
 * of an action, from `settle`), else the door in the statement the session
 * is running -- the first `rpc_` name in it, or the function a bare `select`
 * calls (the clock's jobs) -- else `sql`.
 */
create or replace function private.watch_source() returns text
language plpgsql stable set search_path = public as $fn$
declare v text := current_setting('wurm.source', true); q text; m text[];
begin
  if v is not null and v <> '' then return v; end if;
  q := current_query();
  if q is null then return 'sql'; end if;
  m := regexp_match(q, '(rpc_[a-z0-9_]+)', 'i');
  if m is null then
    m := regexp_match(q, '^\s*(?:set\s[^;]*;\s*)*select\s+(?:[a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)\s*\(', 'i');
  end if;
  return coalesce(left(lower(m[1]), 63), 'sql');
end $fn$;

-- ------------------------------------------------------------------ the ledger

create or replace function private.watch_items_in() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty)
  select f.world_id, (now() at time zone 'utc')::date, f.def, private.watch_source(), count(*), sum(f.count)
    from fresh f group by f.world_id, f.def;
  return null;
end $fn$;

create or replace function private.watch_items_out() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  insert into private.watch_made_new (world_id, day, def, source, gone_n, gone_qty)
  select s.world_id, (now() at time zone 'utc')::date, s.def, private.watch_source(), count(*), sum(s.count)
    from stale s group by s.world_id, s.def;
  return null;
end $fn$;

/* Things or silver passed from one account to another, counted on the day's row for that door. */
create or replace function private.watch_handed(p_world uuid, p_from uuid, p_to uuid, p_via text, p_things bigint, p_silver bigint)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if p_from is null or p_to is null or p_from = p_to then return; end if;
  insert into private.watch_hand as h (world_id, day, giver, getter, via, n, things, silver, at)
  values (p_world, (now() at time zone 'utc')::date, p_from, p_to, coalesce(p_via, private.watch_source()), 1,
          coalesce(p_things, 0), coalesce(p_silver, 0), now())
  on conflict (world_id, day, giver, getter, via) do update
    set n = h.n + 1, things = h.things + excluded.things, silver = h.silver + excluded.silver, at = excluded.at;
end $fn$;

/*
 * One stack changed: grown, shrunk or turned into something else (the
 * ledger), passed to another account (who had it: its last holder, the
 * owner of the stall it was bought off, or whoever put it on the ground),
 * or put on the ground (who did).
 */
create or replace function private.watch_item_changed() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_day date := (now() at time zone 'utc')::date; v_src text; v_from uuid; v_via text;
begin
  if new.count <> old.count or new.def <> old.def then
    v_src := private.watch_source();
    if new.def = old.def then
      insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty, gone_n, gone_qty)
      values (new.world_id, v_day, new.def, v_src,
              (new.count > old.count)::int, greatest(new.count - old.count, 0),
              (new.count < old.count)::int, greatest(old.count - new.count, 0));
    else
      insert into private.watch_made_new (world_id, day, def, source, made_n, made_qty, gone_n, gone_qty)
      values (old.world_id, v_day, old.def, v_src, 0, 0, 1, old.count),
             (new.world_id, v_day, new.def, v_src, 1, new.count, 0, 0);
    end if;
  end if;
  if new.holder_uid is not null and new.holder_uid is distinct from old.holder_uid then
    v_from := old.holder_uid;
    if v_from is null and old.holder = 'ground' then
      delete from private.watch_drop d where d.item = old.id returning d.uid into v_from;
      v_via := 'ground';
    elsif v_from is null and old.price is not null and old.placed is not null then
      select pl.made_by into v_from from public.placed pl where pl.id = old.placed;
    end if;
    if v_from is not null and v_from <> new.holder_uid then
      perform private.watch_handed(new.world_id, v_from, new.holder_uid, coalesce(v_via, v_src, private.watch_source()),
                                   new.count, 0);
    end if;
  end if;
  if new.holder = 'ground' and old.holder <> 'ground' and old.holder_uid is not null then
    insert into private.watch_drop (item, world_id, uid, at) values (new.id, new.world_id, old.holder_uid, now())
    on conflict (item) do update set world_id = excluded.world_id, uid = excluded.uid, at = excluded.at;
  end if;
  return null;
end $fn$;

select private.shut('drop trigger if exists watch_in on public.item');
select private.shut($ddl$create trigger watch_in after insert on public.item
  referencing new table as fresh for each statement execute function private.watch_items_in()$ddl$);
select private.shut('drop trigger if exists watch_out on public.item');
select private.shut($ddl$create trigger watch_out after delete on public.item
  referencing old table as stale for each statement execute function private.watch_items_out()$ddl$);
select private.shut('drop trigger if exists watch_changed on public.item');
select private.shut($ddl$create trigger watch_changed after update on public.item
  for each row when (old.count <> new.count or old.def <> new.def
                     or (new.holder_uid is not null and new.holder_uid is distinct from old.holder_uid)
                     or (new.holder = 'ground' and old.holder <> 'ground' and old.holder_uid is not null))
  execute function private.watch_item_changed()$ddl$);

/* The ledger's new rows folded into the day's totals. Only the sweep and the night write `watch_made`. */
create or replace function private.watch_merge() returns bigint
language plpgsql security definer set search_path = public as $fn$
declare v_n bigint;
begin
  with moved as (delete from private.watch_made_new returning *),
       put as (
         insert into private.watch_made as m (world_id, day, def, source, made_n, made_qty, gone_n, gone_qty)
         select v.world_id, v.day, v.def, v.source, sum(v.made_n), sum(v.made_qty), sum(v.gone_n), sum(v.gone_qty)
           from moved v group by v.world_id, v.day, v.def, v.source
         on conflict (world_id, day, def, source) do update
           set made_n = m.made_n + excluded.made_n, made_qty = m.made_qty + excluded.made_qty,
               gone_n = m.gone_n + excluded.gone_n, gone_qty = m.gone_qty + excluded.gone_qty
         returning 1)
  select count(*) into v_n from put;
  return v_n;
end $fn$;

-- ------------------------------------------------------------------ flags

/* A flag, unless one of the same kind and key was raised on this island within `p_within`. */
create or replace function private.watch_raise(p_world uuid, p_uid uuid, p_kind text, p_key text, p_detail jsonb,
                                               p_within interval default interval '1 day')
returns boolean language plpgsql security definer set search_path = public as $fn$
begin
  if p_key is not null and exists (
       select 1 from private.watch_flag f
        where f.world_id = p_world and f.kind = p_kind and f.at > now() - p_within and f.detail->>'key' = p_key) then
    return false;
  end if;
  insert into private.watch_flag (world_id, uid, kind, detail)
  values (p_world, p_uid, p_kind, coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('key', p_key));
  return true;
end $fn$;

-- ------------------------------------------------------------------ reconciling

/*
 * One island's count against its ledger. What is there now less what the
 * ledger has for today is what there was at the start of today; the last
 * such count plus what the ledger has since should come to the same. Read in
 * one statement, so the count and the ledger are of the same instant. Run
 * again on the same day, it holds today's start against itself: anything
 * that came or went since unledgered is the difference.
 */
create or replace function private.watch_reconcile(p_world uuid) returns int
language plpgsql security definer set search_path = public as $fn$
declare v_day date := (now() at time zone 'utc')::date; v_from date; v_rows jsonb; v_n int := 0; r record;
begin
  select max(s.day) into v_from from private.watch_stock s where s.world_id = p_world and s.day <= v_day;
  with t as (select i.def, sum(i.count)::bigint as q from public.item i where i.world_id = p_world group by i.def),
       l as (select m.def,
                    sum(m.made_qty - m.gone_qty) filter (where m.day = v_day)::bigint as today,
                    sum(m.made_qty - m.gone_qty) filter (where m.day < v_day)::bigint as since
               from (select a.def, a.day, a.made_qty, a.gone_qty from private.watch_made a
                      where a.world_id = p_world and a.day >= coalesce(v_from, v_day)
                     union all
                     select b.def, b.day, b.made_qty, b.gone_qty from private.watch_made_new b
                      where b.world_id = p_world and b.day >= coalesce(v_from, v_day)) m
              group by m.def),
       s as (select s.def, s.qty as q from private.watch_stock s where s.world_id = p_world and s.day = v_from and s.def <> '')
  select coalesce(jsonb_agg(jsonb_build_object('def', x.def, 'found', x.found, 'expected', x.expected)), '[]'::jsonb)
    into v_rows
    from (
      select k.def,
             coalesce(t.q, 0) - coalesce(l.today, 0) as found,
             case when v_from is not null then coalesce(s.q, 0) + coalesce(l.since, 0) end as expected
        from (select def from t union select def from l union select def from s) k
        left join t on t.def = k.def
        left join l on l.def = k.def
        left join s on s.def = k.def) x
   where x.found <> 0 or coalesce(x.expected, 0) <> 0;

  -- Today's start, and a row with no thing in it that says the count was taken even where everything came to nothing.
  delete from private.watch_stock s where s.world_id = p_world and s.day = v_day;
  insert into private.watch_stock (world_id, day, def, qty)
  select p_world, v_day, j.def, j.found from jsonb_to_recordset(v_rows) as j(def text, found bigint, expected bigint)
   where j.found <> 0
  union all select p_world, v_day, '', 0;

  for r in
    select j.def, j.found, j.expected, j.found - j.expected as diff,
           coalesce((select d.name from public.item_def d where d.id = j.def), j.def) as name
      from jsonb_to_recordset(v_rows) as j(def text, found bigint, expected bigint)
     where j.expected is not null
       and abs(j.found - j.expected) > floor(abs(j.expected) * private.watch_stock_per_mille() / 1000.0)
  loop
    perform private.watch_raise(p_world, null, 'stock', null, jsonb_build_object(
      'def', r.def, 'name', r.name, 'found', r.found, 'expected', r.expected, 'diff', r.diff, 'day', v_day, 'since', v_from));
    v_n := v_n + 1;
  end loop;

  -- Made by no door, no action and no job of the clock.
  for r in
    select m.def, m.day, sum(m.made_qty)::bigint as made,
           coalesce((select d.name from public.item_def d where d.id = m.def), m.def) as name
      from (select a.def, a.day, a.made_qty from private.watch_made a
             where a.world_id = p_world and a.source = 'sql' and a.day >= coalesce(v_from, v_day)
            union all
            select b.def, b.day, b.made_qty from private.watch_made_new b
             where b.world_id = p_world and b.source = 'sql' and b.day >= coalesce(v_from, v_day)) m
     group by m.def, m.day having sum(m.made_qty) > 0
  loop
    if private.watch_raise(p_world, null, 'no_door', r.def || '@' || r.day, jsonb_build_object(
         'def', r.def, 'name', r.name, 'count', r.made, 'day', r.day), interval '3 days') then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $fn$;

-- ------------------------------------------------------------------ the sweep

/* The most an hour could teach, as goes: how many full goes at the best roll a rise from `p_from` to `p_to` takes. */
create or replace function private.watch_goes(p_from double precision, p_to double precision, p_mult double precision)
returns double precision language sql immutable set search_path = public as $fn$
  select coalesce(sum(((p_to - p_from) / 16)
                      / public.skill_gain_of(p_from + (p_to - p_from) * (k + 0.5) / 16, p_mult, private.watch_best_roll())), 0)
    from generate_series(0, 15) k
$fn$;

/* Seconds of the fastest go that teaches a skill, at a level, with the best tool and this body's pace. */
create or replace function private.watch_fastest(p_world uuid, p_uid uuid, p_id text, p_v double precision)
returns double precision language sql stable set search_path = public as $fn$
  select coalesce(min(public.act_duration(a.base_time, least(p_v, public.skill_top()), 100,
                                          public.control_speed(p_world, p_uid))),
                  public.act_duration(0, 0, 0, 1))
    from public.action_def a where a.skill = p_id
$fn$;

/*
 * Every five minutes: the ledger folded in, then the three checks that read
 * the island as it goes.
 */
create or replace function private.watch_sweep() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare r record; v_folded bigint; v_flags int := 0; v_break interval; v_goes double precision;
        v_allowed double precision; v_times double precision; v_secs double precision;
begin
  if not pg_try_advisory_xact_lock(hashtext('watch_sweep')::bigint) then
    return jsonb_build_object('busy', true);
  end if;
  v_folded := private.watch_merge();

  -- Awake: last seen active is the latest of a step, the start of a go, a go in hand now and the last sample that saw one.
  v_break := make_interval(mins => private.watch_break_mins() - private.watch_sweep_mins());
  for r in
    select p.world_id, p.uid, b.run_from, b.sampled_at, coalesce(b.flagged, false) as flagged,
           greatest(b.last_at, p.moved_at, p.act_started,
                    case when p.act is not null and p.act_ends > now() - make_interval(mins => private.watch_sweep_mins())
                         then now() end) as active_at
      from public.player p
      left join private.watch_body b on b.world_id = p.world_id and b.uid = p.uid
  loop
    if r.active_at is null or now() - r.active_at >= v_break then
      -- A break: no run. Nothing to write for a body already on one.
      continue when r.run_from is null and r.sampled_at is not null;
      r.run_from := null;
      r.flagged := false;
    elsif r.run_from is null or r.sampled_at < now() - make_interval(mins => 3 * private.watch_sweep_mins()) then
      -- Active, after a break or after a gap in the sampling that might have hidden one: a run starts.
      r.run_from := r.active_at;
      r.flagged := false;
    end if;
    insert into private.watch_body (world_id, uid, run_from, last_at, sampled_at, flagged)
    values (r.world_id, r.uid, r.run_from, r.active_at, now(), r.flagged)
    on conflict (world_id, uid) do update
      set run_from = excluded.run_from, last_at = excluded.last_at, sampled_at = excluded.sampled_at, flagged = excluded.flagged;
    if r.run_from is not null and not r.flagged
       and now() - r.run_from > make_interval(hours => private.watch_awake_hours()) then
      perform private.watch_raise(r.world_id, r.uid, 'awake', null, jsonb_build_object(
        'since', r.run_from, 'hours', floor(extract(epoch from now() - r.run_from) / 3600)::int));
      update private.watch_body set flagged = true where world_id = r.world_id and uid = r.uid;
      v_flags := v_flags + 1;
    end if;
  end loop;

  -- Skill: each risen skill, an hour after its mark; a mark gone stale is only set again.
  for r in
    select s.world_id, s.uid, s.id, s.value, k.value as was, k.at,
           coalesce((select d.name from public.skill_def d where d.id = s.id), s.id) as name
      from public.skill s
      join public.player p on p.world_id = s.world_id and p.uid = s.uid
      left join private.watch_skill k on k.world_id = s.world_id and k.uid = s.uid and k.id = s.id
     where p.skills_at > now() - make_interval(mins => private.watch_skill_mins() + 2 * private.watch_sweep_mins())
       and (k.at is null or k.at <= now() - make_interval(mins => private.watch_skill_mins()))
  loop
    if r.was is not null and r.value > r.was
       and r.at > now() - make_interval(mins => private.watch_skill_mins() + 3 * private.watch_sweep_mins()) then
      v_secs := extract(epoch from now() - r.at);
      v_goes := private.watch_goes(r.was, r.value, public.skill_mult(r.world_id, r.uid, r.id));
      v_allowed := v_secs / private.watch_fastest(r.world_id, r.uid, r.id, r.was);
      v_times := v_goes / greatest(v_allowed, 1);
      if v_times > private.watch_skill_times() then
        if private.watch_raise(r.world_id, r.uid, 'skill', r.uid || ':' || r.id, jsonb_build_object(
             'id', r.id, 'skill', r.name, 'from', r.was, 'to', r.value, 'mins', round(v_secs / 60)::int,
             'goes', round(v_goes::numeric, 1), 'ceiling', round(v_allowed::numeric, 1),
             'times', round(v_times::numeric, 1))) then
          v_flags := v_flags + 1;
        end if;
      end if;
    end if;
    insert into private.watch_skill as k (world_id, uid, id, value, at) values (r.world_id, r.uid, r.id, r.value, now())
    on conflict (world_id, uid, id) do update set value = excluded.value, at = excluded.at;
  end loop;

  -- Shared IP: whoever passed anything to whom, today or yesterday, between two accounts seen on one IP.
  for r in
    select h.world_id, h.giver, h.getter, sum(h.n)::bigint as n, sum(h.things)::bigint as things,
           sum(h.silver)::bigint as silver, jsonb_agg(distinct h.via) as via,
           (select host(a.ip) from private.player_ip a join private.player_ip b on b.ip = a.ip and b.uid = h.getter
             where a.uid = h.giver order by a.last_at desc limit 1) as ip
      from private.watch_hand h
     where h.day >= (now() at time zone 'utc')::date - 1
     group by h.world_id, h.giver, h.getter
  loop
    continue when r.ip is null;
    if private.watch_raise(r.world_id, r.getter, 'shared_ip', r.giver || '>' || r.getter, jsonb_build_object(
         'giver', r.giver, 'getter', r.getter,
         'giver_name', public.folk_name(r.world_id, r.giver), 'getter_name', public.folk_name(r.world_id, r.getter),
         'ip', r.ip, 'via', r.via, 'n', r.n, 'things', r.things, 'silver', r.silver)) then
      v_flags := v_flags + 1;
    end if;
  end loop;

  delete from private.watch_drop d where d.at < now() - interval '1 day';
  return jsonb_build_object('folded', v_folded, 'flags', v_flags);
end $fn$;

/* Every night: each island counted against its ledger, and everything past keeping let go. */
create or replace function private.watch_night() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare w record; v_flags int := 0; v_isles int := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('watch_night')::bigint) then
    return jsonb_build_object('busy', true);
  end if;
  perform private.watch_merge();
  for w in select id from public.world loop
    v_flags := v_flags + private.watch_reconcile(w.id);
    v_isles := v_isles + 1;
  end loop;
  delete from private.watch_flag f where f.at < now() - make_interval(days => private.watch_keep_days());
  delete from private.watch_made m where m.day < (now() at time zone 'utc')::date - private.watch_keep_days();
  delete from private.watch_stock s where s.day < (now() at time zone 'utc')::date - 8;
  delete from private.watch_hand h where h.day < (now() at time zone 'utc')::date - 2;
  delete from private.watch_made m where not exists (select 1 from public.world x where x.id = m.world_id);
  delete from private.watch_stock s where not exists (select 1 from public.world x where x.id = s.world_id);
  delete from private.watch_flag f where not exists (select 1 from public.world x where x.id = f.world_id);
  delete from private.watch_body b
   where not exists (select 1 from public.player p where p.world_id = b.world_id and p.uid = b.uid);
  delete from private.watch_skill k
   where not exists (select 1 from public.player p where p.world_id = k.world_id and p.uid = k.uid);
  return jsonb_build_object('isles', v_isles, 'flags', v_flags);
end $fn$;

do $do$
declare f text;
begin
  foreach f in array array['watch_keep_days()', 'watch_awake_hours()', 'watch_break_mins()', 'watch_sweep_mins()',
    'watch_skill_times()', 'watch_skill_mins()', 'watch_stock_per_mille()', 'watch_best_roll()', 'watch_source()',
    'watch_items_in()', 'watch_items_out()', 'watch_handed(uuid, uuid, uuid, text, bigint, bigint)',
    'watch_item_changed()', 'watch_merge()', 'watch_raise(uuid, uuid, text, text, jsonb, interval)',
    'watch_reconcile(uuid)', 'watch_goes(double precision, double precision, double precision)',
    'watch_fastest(uuid, uuid, text, double precision)', 'watch_sweep()', 'watch_night()'] loop
    execute format('revoke all on function private.%s from public, anon, authenticated', f);
  end loop;
end $do$;

-- ------------------------------------------------------------------ the doors that name what they did

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A go of an action is named for the action, whichever call settles it.
    (1, 'settle', $$      perform act_perform(p_world, p_uid, p.act, p.act_target);
$$, $$      perform set_config('wurm.source', 'act:' || p.act, true);
      perform act_perform(p_world, p_uid, p.act, p.act_target);
      perform set_config('wurm.source', '', true);
$$),
    -- Silver across a trade, each way.
    (2, 'rpc_barter_accept', $$        perform give_coins(p_world, b.other, b.asker_coins);
$$, $$        perform give_coins(p_world, b.other, b.asker_coins);
        perform private.watch_handed(p_world, b.asker, b.other, 'rpc_barter_accept', 0, b.asker_coins);
$$),
    (3, 'rpc_barter_accept', $$        perform give_coins(p_world, b.asker, b.other_coins);
$$, $$        perform give_coins(p_world, b.asker, b.other_coins);
        perform private.watch_handed(p_world, b.other, b.asker, 'rpc_barter_accept', 0, b.other_coins);
$$),
    -- A deal taken: what the buyer paid, and what the seller put up.
    (5, 'rpc_deal_answer', $$    perform give_coins(p_world, d.seller, d.want);
$$, $$    perform give_coins(p_world, d.seller, d.want);
    perform private.watch_handed(p_world, me, d.seller, 'rpc_deal_answer', 0, d.want);
$$),
    (6, 'rpc_deal_answer', $$  if d.give > 0 then perform give_coins(p_world, me, d.give); end if;
$$, $$  if d.give > 0 then
    perform give_coins(p_world, me, d.give);
    perform private.watch_handed(p_world, d.seller, me, 'rpc_deal_answer', 0, d.give);
  end if;
$$),
    -- And off a stall, to its owner's till.
    (4, 'rpc_buy', $$  update placed set till = till + v_it.price where world_id = p_world and id = v_pl.id;
$$, $$  update placed set till = till + v_it.price where world_id = p_world and id = v_pl.id;
  perform private.watch_handed(p_world, me, v_pl.made_by, 'rpc_buy', 0, v_it.price);
$$)
  ) as t(ord, fn, old, new) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of change %, not 1', r.fn, v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

-- ------------------------------------------------------------------ the keeper's doors

/*
 * Every flag kept on the island, newest first, at most 200, and how many are
 * not seen yet. A look within ten minutes of the same keeper's last look is
 * counted on that look's row of the trail.
 */
create or replace function public.rpc_owner_flags(p_world uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v_flags jsonb; v_open int;
begin
  if not private.is_island_owner(p_world, me) then
    raise exception 'only a keeper of this island may do that';
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'n', f.n, 'kind', f.kind, 'uid', f.uid,
           'name', case when f.uid is not null then folk_name(p_world, f.uid) end,
           'ago', greatest(0, floor(extract(epoch from now() - f.at)))::bigint,
           'seen', f.seen, 'detail', f.detail - 'key')
         order by f.n desc), '[]'::jsonb)
    into v_flags
    from (select * from private.watch_flag q where q.world_id = p_world order by q.n desc limit 200) f;
  select count(*) into v_open from private.watch_flag q where q.world_id = p_world and not q.seen;
  update private.owner_log l
     set detail = l.detail || jsonb_build_object('open', v_open, 'looks', coalesce((l.detail->>'looks')::int, 1) + 1, 'last', now())
   where l.n = (select max(q.n) from private.owner_log q where q.world_id = p_world and q.owner = me and q.what = 'flags')
     and coalesce((l.detail->>'last')::timestamptz, l.at) > now() - interval '10 minutes';
  if not found then
    perform private.owner_note(me, p_world, 'flags', null, jsonb_build_object('open', v_open, 'looks', 1, 'last', now()));
  end if;
  return jsonb_build_object('flags', v_flags, 'open', v_open);
end $function$;

/* One flag marked seen, or with no number every open flag on the island. */
create or replace function public.rpc_owner_flag_seen(p_world uuid, p_n bigint default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); v_n int;
begin
  if not private.is_island_owner(p_world, me) then
    raise exception 'only a keeper of this island may do that';
  end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  update private.watch_flag f set seen = true
   where f.world_id = p_world and not f.seen and (p_n is null or f.n = p_n);
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('why', 'No open flag.'); end if;
  perform private.owner_note(me, p_world, 'flag_seen', null, jsonb_build_object('n', p_n, 'flags', v_n));
  return jsonb_build_object('seen', v_n);
end $function$;

-- ------------------------------------------------------------------ on the clock

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  -- `cron.schedule` is an upsert on the name, so a second deploy re-times the job rather than winding another.
  perform cron.schedule('watch-sweep', '*/5 * * * *', 'select private.watch_sweep()');
  perform cron.schedule('watch-night', '37 0 * * *', 'set statement_timeout = ''5min''; select private.watch_night()');
exception when others then
  raise notice 'could not wind the watch (%)', sqlerrm;
end $$;

select private.lock_doors();
