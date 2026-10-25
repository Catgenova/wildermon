/*
 * A settlement at a glance: its visitor log, and its wildermon orders on the island.
 *
 * Asked for: "Deed and settlement management. Put ranks, permissions, upkeep
 * and specialties in one clear panel, plus a visitor log and guard
 * settings." The ranks, the permissions, the upkeep (`creature.unfed`) and
 * the specialties (`deed_trade_workers`) are already the island's and the
 * Settlement window draws them on its Ranks and Workers tabs. Two things were
 * not the island's at all:
 *
 *   * **The visitor log.** `rpc_move` writes a row (`private.deed_visit`) the
 *     first time in an hour somebody stands inside a settlement's border who
 *     is not its founder and not on its roll: the hour is in the key, so every
 *     other word that hour writes nothing, and nothing is asked at all unless
 *     the walk left the tile it was on. A schedule lets every row older than
 *     `private.visit_keep_days()` go, hourly. Its founder, and a rank holding
 *     the new power Visitor log (`visitors`), read it through
 *     `rpc_deed_watch`: each visitor once, the latest first, at most
 *     `private.visit_list_max()` of them, with the first and last hour they
 *     were seen in and how many hours.
 *   * **The orders.** The Settlement window's Passive, Defensive and
 *     Aggressive set the stance of the browser's own copy of each worker and
 *     nothing else: the next creature read put every one back. Now
 *     `rpc_deed_orders` sets them on the island -- every settlement worker on
 *     it, its founder's and its citizens', posts included -- for its founder
 *     and a rank holding the new power Wildermon orders (`orders`); keeps
 *     them (`private.deed_orders`); and every wildermon assigned to the
 *     settlement after takes them (`private.creature_takes_orders`).
 *     `rpc_deed_watch` says them back, with how many workers hold each
 *     stance and how many are at the guard trade.
 *
 * The browser keeps the same powers (`RANK_POWERS`), limits (`visitors.ts`)
 * and words; `supabase/test/deedmanage.ts` holds the two to each other.
 */
set local lock_timeout = '3s';

-- ---------------------------------------------------------------- two powers

insert into rank_power (id, bit, may, may_not) values
  ('visitors', 16, 'read its visitor log', 'read its visitor log'),
  ('orders', 17, 'set the orders of its settlement wildermon', 'set the orders of its settlement wildermon')
on conflict (id) do update set bit = excluded.bit, may = excluded.may, may_not = excluded.may_not;

/** A power's bit, written out so a check on every dig is a constant: `rank_power.bit`, and the browser's `powerBit`. */
create or replace function power_bit(p_id text) returns int language sql immutable as $fn$
  select case p_id
    when 'shape' then 1 when 'stores' then 2 when 'locks' then 4 when 'gate' then 8
    when 'served' then 16 when 'set_bauble' then 32 when 'replace_bauble' then 64
    when 'invite' then 128 when 'send_away' then 256 when 'set_ranks' then 512
    when 'upgrade' then 1024 when 'rename' then 2048 when 'notices' then 4096 when 'work' then 8192
    when 'keep_stores' then 16384 when 'use_stores' then 32768
    when 'visitors' then 65536 when 'orders' then 131072 else 0 end
$fn$;

-- ---------------------------------------------------------------- the visitor log

/** How many days a visit is kept (`VISIT_KEEP_DAYS`), and how many visitors the log lists (`VISIT_LIST_MAX`). */
create or replace function private.visit_keep_days() returns int language sql immutable as $fn$ select 7 $fn$;
create or replace function private.visit_list_max() returns int language sql immutable as $fn$ select 50 $fn$;

/*
 * One row per visitor per settlement per hour: the hour is in the key, so a
 * second word in the same hour is one index probe that writes nothing.
 */
create table if not exists private.deed_visit (
  world_id uuid not null,
  -- Which settlement, named by whoever founded it.
  founder uuid not null,
  uid uuid not null,
  -- The start of the hour they were seen in.
  hour timestamptz not null,
  primary key (world_id, founder, uid, hour),
  foreign key (world_id, founder) references public.deed (world_id, founded_by) on delete cascade
);
create index if not exists deed_visit_hour on private.deed_visit (hour);
alter table private.deed_visit enable row level security;
revoke all on table private.deed_visit from public, anon, authenticated;

/**
 * Somebody standing at (x, y): written down on every settlement whose border
 * that is inside, that they did not found and are not a citizen of, once
 * this hour. Called by `rpc_move` only when the walk left the tile it was on.
 */
create or replace function private.deed_visit_note(p_world uuid, p_uid uuid, p_x double precision, p_y double precision)
  returns void language plpgsql as $fn$
declare v_x int := floor(p_x)::int; v_y int := floor(p_y)::int;
begin
  insert into private.deed_visit (world_id, founder, uid, hour)
  select p_world, d.founded_by, p_uid, date_trunc('hour', now())
    from deed d
   where d.world_id = p_world and d.founded_by <> p_uid
     and abs(v_x - d.x) <= d.radius and abs(v_y - d.y) <= d.radius
     and not exists (select 1 from deed_member m
                      where m.world_id = p_world and m.founder = d.founded_by and m.uid = p_uid)
  on conflict do nothing;
end $fn$;

/** Every visit older than `visit_keep_days`, let go: hourly. */
create or replace function private.deed_visit_sweep() returns int language plpgsql as $fn$
declare n int;
begin
  delete from private.deed_visit where hour < now() - make_interval(days => private.visit_keep_days());
  get diagnostics n = row_count;
  return n;
end $fn$;

revoke all on function private.visit_keep_days(), private.visit_list_max(),
  private.deed_visit_note(uuid, uuid, double precision, double precision), private.deed_visit_sweep()
  from public, anon, authenticated;

/* And `rpc_move` writes it, after the walk is decided and only when it left the tile it was on. */
do $do$
declare v_def text; v_n int;
  v_old text := $$  perform journal_move(p_world, me, p, p_x, p_y, cart, v_xs, v_ys);$$;
begin
  v_def := pg_get_functiondef('rpc_move(uuid, double precision, double precision, integer, jsonb)'::regprocedure);
  if position('private.deed_visit_note' in v_def) > 0 then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'rpc_move has % of journal_move, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || $$
  -- And who came onto a settlement not theirs: a row an hour (`deed_visit_note`), asked only when the walk left its tile.
  if floor(p_x) <> floor(p.x) or floor(p_y) <> floor(p.y) then
    perform private.deed_visit_note(p_world, me, p_x, p_y);
  end if;$$);
end $do$;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  -- `cron.schedule` is an upsert on the name, so a second deploy re-times the job rather than winding another.
  perform cron.schedule('deed-visit-keep', '23 * * * *', 'select private.deed_visit_sweep()');
exception when others then
  raise notice 'could not wind the visitor log keeping (%)', sqlerrm;
end $$;

-- ---------------------------------------------------------------- the orders

/** The stances a settlement's orders may set its workers to: `ORDER_STANCES`. A companion's Guarding you is not one. */
create table if not exists private.deed_orders (
  world_id uuid not null,
  founder uuid not null,
  stance text not null check (stance in ('passive', 'defensive', 'aggressive')),
  set_by uuid not null,
  set_at timestamptz not null default now(),
  primary key (world_id, founder),
  foreign key (world_id, founder) references public.deed (world_id, founded_by) on delete cascade
);
alter table private.deed_orders enable row level security;
revoke all on table private.deed_orders from public, anon, authenticated;

/** A settlement's workers: every wildermon at work for it, its founder's and its citizens', posts included. */
create or replace function private.deed_workers(p_world uuid, p_founder uuid) returns setof creature
  language sql stable as $fn$
  select c.*
    from (select p_founder as uid
          union select m.uid from deed_member m where m.world_id = p_world and m.founder = p_founder) k
    join creature c on c.world_id = p_world and c.keeper = k.uid and c.mode = 'deed'
   where (select d.founded_by from deed_of(p_world, k.uid) d) = p_founder
$fn$;

/** A wildermon put to work on a settlement takes its orders, where it has any. */
create or replace function private.creature_takes_orders() returns trigger language plpgsql as $fn$
declare v_stance text;
begin
  select o.stance into v_stance
    from private.deed_orders o
   where o.world_id = new.world_id and o.founder = (select d.founded_by from deed_of(new.world_id, new.keeper) d);
  if v_stance is not null then
    new.stance := v_stance;
    new.enemy := null;
  end if;
  return new;
end $fn$;
drop trigger if exists creature_takes_orders on creature;
create trigger creature_takes_orders before update of mode on creature for each row
  when (new.mode = 'deed' and old.mode is distinct from 'deed' and new.keeper is not null)
  execute function private.creature_takes_orders();

revoke all on function private.deed_workers(uuid, uuid), private.creature_takes_orders() from public, anon, authenticated;

-- ---------------------------------------------------------------- the doors

/**
 * Every settlement worker on a settlement set to one stance, and every one
 * assigned to it after: its founder, or a citizen whose rank holds Wildermon
 * orders.
 */
create or replace function rpc_deed_orders(p_world uuid, p_founder uuid, p_stance text) returns jsonb
  language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); v_d deed; v_why text; n int;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into v_d from deed where world_id = p_world and founded_by = p_founder;
  if not found then return jsonb_build_object('why', 'There is no such settlement.'); end if;
  if p_stance is null or p_stance not in ('passive', 'defensive', 'aggressive') then
    return jsonb_build_object('why', 'Passive, defensive or aggressive.');
  end if;
  v_why := rank_member_refusal(p_world, v_d.founded_by, me, 'orders');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  insert into private.deed_orders (world_id, founder, stance, set_by) values (p_world, v_d.founded_by, p_stance, me)
  on conflict (world_id, founder) do update set stance = excluded.stance, set_by = excluded.set_by, set_at = now();
  update creature c set stance = p_stance, enemy = null
    from private.deed_workers(p_world, v_d.founded_by) w
   where c.world_id = p_world and c.id = w.id and c.stance is distinct from p_stance;
  get diagnostics n = row_count;
  return jsonb_build_object('orders', p_stance, 'changed', n);
end $fn$;

/**
 * A settlement's watch, for its founder and its citizens: the orders set on
 * it, its workers by stance, how many of them guard -- and, for its founder
 * and a rank holding Visitor log, who came onto it; for anybody else, the
 * sentence that says why not.
 */
create or replace function rpc_deed_watch(p_world uuid, p_founder uuid) returns jsonb
  language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); v_d deed; v_why text; v_out jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into v_d from deed where world_id = p_world and founded_by = p_founder;
  if not found then return jsonb_build_object('why', 'There is no such settlement.'); end if;
  if me <> v_d.founded_by and not exists (select 1 from deed_member m
      where m.world_id = p_world and m.founder = v_d.founded_by and m.uid = me) then
    return jsonb_build_object('why', 'You are not a citizen of ' || v_d.name || '.');
  end if;
  select jsonb_build_object(
      'deed', v_d.name, 'founder', v_d.founded_by,
      'orders', (select o.stance from private.deed_orders o where o.world_id = p_world and o.founder = v_d.founded_by),
      'order', rank_member_refusal(p_world, v_d.founded_by, me, 'orders') is null,
      'stances', coalesce((select jsonb_object_agg(s.stance, s.n)
                             from (select w.stance, count(*)::int as n from private.deed_workers(p_world, v_d.founded_by) w
                                    group by w.stance) s), '{}'::jsonb),
      'guards', (select count(*)::int from private.deed_workers(p_world, v_d.founded_by) w
                   join species_def sd on sd.id = w.species where coalesce(w.job, sd.gathers) = 'guard'))
    into v_out;
  v_why := rank_member_refusal(p_world, v_d.founded_by, me, 'visitors');
  if v_why is not null then return v_out || jsonb_build_object('visitorsWhy', v_why); end if;
  return v_out || jsonb_build_object(
    'total', (select count(distinct v.uid)::int from private.deed_visit v
               where v.world_id = p_world and v.founder = v_d.founded_by
                 and v.hour >= now() - make_interval(days => private.visit_keep_days())),
    'visitors', coalesce((select jsonb_agg(jsonb_build_object(
        'name', folk_name(p_world, t.uid), 'last', floor(extract(epoch from t.last))::bigint,
        'first', floor(extract(epoch from t.first))::bigint, 'hours', t.hours) order by t.last desc, t.uid)
      from (select v.uid, max(v.hour) as last, min(v.hour) as first, count(*)::int as hours
              from private.deed_visit v
             where v.world_id = p_world and v.founder = v_d.founded_by
               and v.hour >= now() - make_interval(days => private.visit_keep_days())
             group by v.uid
             order by max(v.hour) desc, v.uid
             limit private.visit_list_max()) t), '[]'::jsonb));
end $fn$;

select private.lock_doors();
