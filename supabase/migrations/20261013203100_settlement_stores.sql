/*
 * Shared settlement stores.
 *
 * A crate or a piece of storage furniture standing on a settlement may be
 * marked one of its stores, by its founder or by a rank holding the new power
 * Keep the stores (`rpc_store_mark`), and unmarked the same way. A marked
 * store:
 *
 *   * opens to the settlement's founder and to every citizen whose rank holds
 *     the new power Use the stores -- to take from it and to put into it --
 *     padlocked or not, and without asking whether they made it (Crates and
 *     stores is not asked of it either). Its padlock is not asked of them;
 *   * opens to nobody else, key or not: a citizen whose rank lacks Use the
 *     stores is told so in the words every refusal of a power says
 *     (`rank_lacks`), and a stranger is told whose store it is
 *     (`store_refusal`);
 *   * is moved, turned and picked up only by whoever set it down and the
 *     founder (`store_move_said`), padlock and all as before;
 *   * is never drawn on by a craft, a build or a drop of dirt, so that every
 *     thing that leaves it goes through the log (`craft_stock`, `hod_stock`,
 *     `spoil_near` and `take_spoil`, in the next migration);
 *   * logs every take and every put -- who, what, how many and when -- into
 *     `deed_store_log`, which keeps the settlement's last `store_log_cap()`
 *     entries and is read by its founder and by ranks holding Keep the stores
 *     (`rpc_store_log`).
 *
 * The mark is `crate.store_of` / `placed.store_of`: the founder of the
 * settlement it is a store of. It counts only while that settlement stands
 * and covers the store (`store_kept`), and disbanding clears it.
 *
 * What can be marked (`store_markable_refusal`): any crate, and a piece of
 * furniture that holds things by count or by weight -- not a stall, a trash
 * crate, a mailbox, a cart, a wagon or a boat, which are bought from, rot,
 * carry the post or are driven off the land. The browser's `storeMarkable`.
 *
 * The two powers are bits 14 and 15 of a rank's `perms`, the browser's
 * `RANK_POWERS`. No starting rank holds them: a founder gives them out.
 */
set local lock_timeout = '3s';
set check_function_bodies = off;

-- ---------------------------------------------------------------- the powers

insert into rank_power (id, bit, may, may_not) values
  ('keep_stores', 14, 'mark its settlement stores and read their log', 'mark its settlement stores or read their log'),
  ('use_stores', 15, 'take from and put into its settlement stores', 'use its settlement stores')
on conflict (id) do update set bit = excluded.bit, may = excluded.may, may_not = excluded.may_not;

/** A power's bit, written out so a check on every dig is a constant: `rank_power.bit`, and the browser's `powerBit`. */
create or replace function power_bit(p_id text) returns int language sql immutable as $fn$
  select case p_id
    when 'shape' then 1 when 'stores' then 2 when 'locks' then 4 when 'gate' then 8
    when 'served' then 16 when 'set_bauble' then 32 when 'replace_bauble' then 64
    when 'invite' then 128 when 'send_away' then 256 when 'set_ranks' then 512
    when 'upgrade' then 1024 when 'rename' then 2048 when 'notices' then 4096 when 'work' then 8192
    when 'keep_stores' then 16384 when 'use_stores' then 32768 else 0 end
$fn$;

-- ---------------------------------------------------------------- the mark

alter table crate add column if not exists store_of uuid;
alter table placed add column if not exists store_of uuid;
create index if not exists crate_store_of on crate (world_id, store_of) where store_of is not null;
create index if not exists placed_store_of on placed (world_id, store_of) where store_of is not null;

/** A settlement that goes takes its marks with it. */
create or replace function deed_stores_freed() returns trigger language plpgsql as $fn$
begin
  update crate set store_of = null where world_id = old.world_id and store_of = old.founded_by;
  update placed set store_of = null where world_id = old.world_id and store_of = old.founded_by;
  return null;
end $fn$;
drop trigger if exists deed_stores_freed on deed;
create trigger deed_stores_freed after delete on deed for each row execute function deed_stores_freed();

/** How many takes and puts a settlement's store log keeps, newest first: the browser's `STORE_LOG_CAP`. */
create or replace function store_log_cap() returns int language sql immutable as $fn$ select 50 $fn$;

/**
 * The settlement a store is marked for, while it stands and covers the store;
 * nothing for a store that is no settlement store.
 */
create or replace function store_kept(p_world uuid, p_store_of uuid, p_x int, p_y int) returns deed
  language sql stable as $fn$
  select d.* from deed d
   where p_store_of is not null and d.world_id = p_world and d.founded_by = p_store_of
     and deed_covers(d, p_x, p_y)
$fn$;

/**
 * Why a settlement store will not open for somebody, or nothing when it will:
 * its founder, and a citizen whose rank holds Use the stores. A citizen
 * whose rank lacks it is told so by rank; anybody else, whose store it is.
 * The browser's `storeUse`.
 */
create or replace function store_refusal(p_world uuid, p_uid uuid, d deed, p_what text) returns text
  language sql stable as $fn$
  select case
    when d.founded_by is null or p_uid = d.founded_by then null
    when exists (select 1 from deed_member m
                  where m.world_id = p_world and m.founder = d.founded_by and m.uid = p_uid)
      then rank_lacks(p_world, d.founded_by, p_uid, 'use_stores')
    else 'The ' || p_what || ' is a store of ' || d.name
      || '. Only its founder and the citizens whose rank holds Use the stores may open it.' end
$fn$;

/** Why a settlement store is not yours to move, turn or pick up: the browser's `storeMoveSaid`. */
create or replace function store_move_said(p_what text, p_deed text) returns text
  language sql immutable as $fn$
  select 'The ' || p_what || ' is a store of ' || p_deed
    || '. Only whoever set it down and its founder may move it or pick it up.'
$fn$;

/**
 * Whether a piece of furniture shuts against somebody: by the settlement's
 * rule when it is one of its stores, by its padlock when it is not.
 */
create or replace function store_shut_piece(p_world uuid, p_uid uuid, p placed) returns text
  language plpgsql stable as $fn$
declare k deed;
begin
  k := store_kept(p_world, p.store_of, p.x, p.y);
  if k.founded_by is not null then
    return store_refusal(p_world, p_uid, k, lower(placed_name(p)));
  end if;
  return lock_refusal(p_world, p_uid, p.lock, p.x, p.y);
end $fn$;

/**
 * Why a piece of furniture cannot be a settlement store, or nothing: it holds
 * things by count or by weight, and is not a stall, a trash crate, a mailbox
 * or anything driven, pulled or sailed off the land. The browser's
 * `storeMarkable`.
 */
create or replace function store_markable_refusal(p placed) returns text
  language sql stable as $fn$
  select case when p.kind = 'furniture' and p.crumbles_at is null
                   and (coalesce(f.capacity, 0) > 0 or coalesce(f.heft, 0) > 0)
                   and not f.stall and coalesce(f.trash, 0) = 0 and not f.cart and f.id <> 'mailbox'
                   and not exists (select 1 from vehicle_def v where v.id = f.id)
                   and not exists (select 1 from boat_def b where b.id = f.id)
              then null
              else 'Only a crate or a piece of storage furniture can be a settlement store: not a stall, a trash crate, '
                || 'a mailbox, or anything driven, pulled or sailed.' end
    from (select 1) one left join furniture_def f on f.id = p.sub
$fn$;

/** The refusal for marking a store that stands on no settlement: the browser's `STORE_UNSETTLED`. */
create or replace function store_unsettled_said() returns text language sql immutable as $fn$
  select 'Only a store standing on a settlement can be one of its stores.'
$fn$;

-- ---------------------------------------------------------------- the log

create table if not exists deed_store_log (
  id bigint generated always as identity primary key,
  world_id uuid not null,
  -- Which settlement, named by whoever founded it.
  founder uuid not null,
  at timestamptz not null default now(),
  uid uuid not null,
  -- Their name when they did it.
  who text not null,
  -- A put, or a take.
  put boolean not null,
  def text not null,
  -- What it was called, in lower case: "iron lump", "sword (iron)".
  what text not null,
  count int not null check (count > 0),
  -- The store, as it was called.
  store text not null,
  foreign key (world_id, founder) references deed (world_id, founded_by) on delete cascade
);
create index if not exists deed_store_log_newest on deed_store_log (world_id, founder, id desc);
-- Read through `rpc_store_log` and nothing else.
alter table deed_store_log enable row level security;
revoke all on deed_store_log from anon, authenticated;

/**
 * One take or put, written down, and everything older than the settlement's
 * last `store_log_cap()` let go.
 */
create or replace function store_log_add(p_world uuid, p_founder uuid, p_uid uuid, p_put boolean,
                                         p_def text, p_what text, p_count int, p_store text) returns void
  language plpgsql as $fn$
begin
  if p_count is null or p_count <= 0 then return; end if;
  insert into deed_store_log (world_id, founder, uid, who, put, def, what, count, store)
  values (p_world, p_founder, p_uid, folk_name(p_world, p_uid), p_put, p_def, p_what, p_count, p_store);
  delete from deed_store_log
   where world_id = p_world and founder = p_founder
     and id <= (select l.id from deed_store_log l where l.world_id = p_world and l.founder = p_founder
                 order by l.id desc offset store_log_cap() limit 1);
end $fn$;

-- ---------------------------------------------------------------- the doors

/**
 * Mark a crate or a piece of storage furniture as a store of the settlement
 * it stands on, or unmark it: its founder, or a citizen whose rank holds
 * Keep the stores. The store's row is locked while it is decided.
 */
create or replace function rpc_store_mark(p_world uuid, p_kind text, p_id bigint, p_on boolean) returns jsonb
  language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); v_c crate; v_pl placed; v_x int; v_y int; v_what text; v_kept uuid; v_d deed; v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
  if p_kind = 'crate' then
    select * into v_c from crate where world_id = p_world and id = p_id for update;
    if not found then return jsonb_build_object('why', 'It is gone.'); end if;
    v_x := v_c.x; v_y := v_c.y; v_what := lower(crate_name(v_c)); v_kept := v_c.store_of;
  elsif p_kind = 'furniture' then
    select * into v_pl from placed where world_id = p_world and id = p_id and kind = 'furniture' for update;
    if not found then return jsonb_build_object('why', 'It is gone.'); end if;
    v_why := store_markable_refusal(v_pl);
    if v_why is not null then return jsonb_build_object('why', v_why); end if;
    v_x := v_pl.x; v_y := v_pl.y; v_what := lower(placed_name(v_pl)); v_kept := v_pl.store_of;
  else
    return jsonb_build_object('why', store_markable_refusal(null::placed));
  end if;
  select * into v_d from deed_covering(p_world, v_x, v_y) limit 1;
  if v_d.founded_by is null then return jsonb_build_object('why', store_unsettled_said()); end if;
  v_why := rank_member_refusal(p_world, v_d.founded_by, me, 'keep_stores');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  if coalesce(p_on, false) and v_kept is not distinct from v_d.founded_by then
    return jsonb_build_object('why', 'The ' || v_what || ' is already a store of ' || v_d.name || '.');
  end if;
  if not coalesce(p_on, false) and v_kept is distinct from v_d.founded_by then
    return jsonb_build_object('why', 'The ' || v_what || ' is not a settlement store.');
  end if;
  if p_kind = 'crate' then
    update crate set store_of = case when p_on then v_d.founded_by end where world_id = p_world and id = p_id;
  else
    update placed set store_of = case when p_on then v_d.founded_by end where world_id = p_world and id = p_id;
  end if;
  return jsonb_build_object('marked', coalesce(p_on, false), 'store_of', case when p_on then v_d.founded_by end,
                            'deed', v_d.name, 'what', v_what);
end $fn$;

/**
 * A settlement's store log, newest first: its founder's, or one whose rank of
 * yours holds Keep the stores, named by its founder; left out, your own.
 */
create or replace function rpc_store_log(p_world uuid, p_founder uuid default null) returns jsonb
  language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); v_d deed; v_why text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into v_d from deed where world_id = p_world and founded_by = coalesce(p_founder, me);
  if not found then
    return jsonb_build_object('why', case when p_founder is null then 'You have founded no settlement.'
                                          else 'There is no such settlement.' end);
  end if;
  v_why := rank_member_refusal(p_world, v_d.founded_by, me, 'keep_stores');
  if v_why is not null then return jsonb_build_object('why', v_why); end if;
  return jsonb_build_object('deed', v_d.name, 'cap', store_log_cap(),
    'log', coalesce((select jsonb_agg(jsonb_build_object(
        'at', floor(extract(epoch from l.at))::bigint, 'who', l.who, 'put', l.put,
        'what', l.what, 'count', l.count, 'store', l.store) order by l.id desc)
      from deed_store_log l where l.world_id = p_world and l.founder = v_d.founded_by), '[]'::jsonb));
end $fn$;

reset check_function_bodies;
select private.lock_doors();
