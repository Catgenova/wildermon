/*
 * Accounts: where they connect from, how many new bodies one connection may
 * make, and a second step for keepers.
 *
 * ## Where a player connects from: `private.player_ip`
 *
 * One row per account and address: first seen, last seen, and how many times
 * it was noted. Noted on `rpc_join` and on the beat (`rpc_settle`), from the
 * request's headers: `cf-connecting-ip` when the edge sets it, else the first
 * entry of `x-forwarded-for` (`private.client_ip`). No headers (psql, the
 * clock, the suite) or an address that is not one: nothing noted.
 *
 * The beat is frequent, so a known address is written at most once every
 * `ip_note_every()` (10 minutes); a new one at once. Bounded: the clock's
 * tidy deletes a row unseen for `ip_keep()` (90 days).
 *
 * ## New bodies per connection: `private.ip_body`
 *
 * `rpc_join` making a new body (a player row on an island) notes the address.
 * A connection that made `ip_body_cap()` (3) new bodies across the project in
 * the last `ip_body_window()` (24 h) is refused the next, with when the next
 * is allowed. Coming back to a body is never refused, nor a keeper of the
 * island (`private.is_island_owner`). No address, no cap. Rows older than the
 * window are deleted by the clock's tidy.
 *
 * ## Keeper doors want the code: `private.keeper_code_ok`
 *
 * An account with a verified second factor in Auth (`auth.mfa_factors`, TOTP
 * from the account page) must have given it this session (`aal` = `aal2` in
 * the token) before any `rpc_owner_*` door but `rpc_owner_am_i` does anything:
 * refused with `KEEPER_CODE` (src/game/keeper.ts) after the keeper check, so
 * nobody else learns anything. With no verified factor the doors work as
 * before, so this deploy locks nobody out.
 *
 * Nothing here is readable from a browser: RLS on, no policy, nothing granted.
 */
set local lock_timeout = '3s';

create table if not exists private.player_ip (
  uid uuid not null, ip inet not null,
  first_at timestamptz not null default now(), last_at timestamptz not null default now(), seen int not null default 1,
  primary key (uid, ip));
alter table private.player_ip enable row level security;
revoke all on table private.player_ip from public, anon, authenticated;

create table if not exists private.ip_body (
  n bigint generated always as identity primary key,
  ip inet not null,
  at timestamptz not null default now(),
  uid uuid not null,
  world_id uuid not null
);
create index if not exists ip_body_ip_at on private.ip_body (ip, at);
alter table private.ip_body enable row level security;
revoke all on table private.ip_body from public, anon, authenticated;

/* The numbers. */
create or replace function private.ip_note_every() returns interval language sql immutable as $$ select interval '10 minutes' $$;
create or replace function private.ip_keep() returns interval language sql immutable as $$ select interval '90 days' $$;
create or replace function private.ip_body_cap() returns int language sql immutable as $$ select 3 $$;
create or replace function private.ip_body_window() returns interval language sql immutable as $$ select interval '24 hours' $$;

/* The caller's address from the request's headers, or null. */
create or replace function private.client_ip() returns inet
language plpgsql stable set search_path = '' as $fn$
declare v_h text := current_setting('request.headers', true); v_j json; v text;
begin
  if v_h is null or v_h = '' then return null; end if;
  v_j := v_h::json;
  v := btrim(coalesce(nullif(btrim(v_j ->> 'cf-connecting-ip'), ''), split_part(v_j ->> 'x-forwarded-for', ',', 1)));
  if v is null or v = '' or length(v) > 64 then return null; end if;
  return v::inet;
exception when others then
  return null;
end $fn$;

/* Note where `p_uid` is calling from; returns the address, or null. Cheap when nothing is new. */
create or replace function private.note_ip(p_uid uuid) returns inet
language plpgsql volatile set search_path = '' as $fn$
declare v_ip inet := private.client_ip(); v_last timestamptz;
begin
  if v_ip is null or p_uid is null then return v_ip; end if;
  select last_at into v_last from private.player_ip where uid = p_uid and ip = v_ip;
  if not found then
    insert into private.player_ip (uid, ip) values (p_uid, v_ip)
      on conflict (uid, ip) do update set last_at = now(), seen = private.player_ip.seen + 1;
  elsif v_last < now() - private.ip_note_every() then
    update private.player_ip set last_at = now(), seen = seen + 1 where uid = p_uid and ip = v_ip;
  end if;
  return v_ip;
end $fn$;

/*
 * Before a new body: refused, in one line with when the next may be, when the
 * caller's address made the cap of new bodies in the window; else the body is
 * noted against the address. Held per address, so two joins at once count
 * each other. No address, no cap; a keeper of the island, no cap.
 */
create or replace function private.ip_body_take(p_world uuid, p_uid uuid) returns void
language plpgsql volatile set search_path = '' as $fn$
declare v_ip inet := private.client_ip(); v_n int; v_first timestamptz;
begin
  if v_ip is null then return; end if;
  perform pg_advisory_xact_lock(hashtext('ip_body:' || host(v_ip))::bigint);
  if not private.is_island_owner(p_world, p_uid) then
    select count(*), min(at) into v_n, v_first
      from private.ip_body where ip = v_ip and at > now() - private.ip_body_window();
    if v_n >= private.ip_body_cap() then
      raise exception '%', 'New bodies: ' || private.ip_body_cap() || ' per connection per '
        || extract(epoch from private.ip_body_window())::int / 3600 || ' h. Next in '
        || public.time_words(extract(epoch from v_first + private.ip_body_window() - now())) || '.';
    end if;
  end if;
  insert into private.ip_body (ip, uid, world_id) values (v_ip, p_uid, p_world);
end $fn$;

/*
 * Whether `p_uid` may use keeper doors at this session's assurance: yes with
 * no verified second factor, else only with `aal2` in the token.
 */
create or replace function private.keeper_code_ok(p_uid uuid) returns boolean
language sql stable set search_path = '' as $fn$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = p_uid and f.status = 'verified')
$fn$;

revoke all on function private.client_ip(), private.note_ip(uuid), private.ip_body_take(uuid, uuid),
  private.keeper_code_ok(uuid), private.ip_note_every(), private.ip_keep(), private.ip_body_cap(),
  private.ip_body_window() from public, anon, authenticated;

/* The deploy's role must be able to read Auth's factors, or every keeper with one is locked out: fail here instead. */
do $$ begin perform 1 from auth.mfa_factors limit 1; end $$;

/* ---- The doors ------------------------------------------------------------ */

/* A small text patch: `p_old` must be in the function exactly once, and goes back in followed by `p_add`. */
create or replace function pg_temp.patch_after(p_fn regprocedure, p_old text, p_add text) returns void
language plpgsql as $fn$
declare v text := pg_get_functiondef(p_fn); n int;
begin
  n := (length(v) - length(replace(v, p_old, ''))) / length(p_old);
  if n <> 1 then raise exception '%: % of an anchor, not 1', p_fn, n; end if;
  execute replace(v, p_old, p_old || p_add);
end $fn$;

/* The join: the address noted; and a new body counted against it, or refused. */
select pg_temp.patch_after('public.rpc_join(uuid,text)'::regprocedure,
  $q$  if not w.ready then raise exception 'that island is still being laid down'; end if;
$q$,
  $q$  perform private.note_ip(me);
$q$);
select pg_temp.patch_after('public.rpc_join(uuid,text)'::regprocedure,
  $q$  select * into p from player where world_id = p_world and uid = me;
  if not found then
$q$,
  $q$    perform private.ip_body_take(p_world, me);
$q$);

/* The beat: the address noted, after the pace check. */
select pg_temp.patch_after('public.rpc_settle(bigint,uuid,bigint,boolean,jsonb)'::regprocedure,
  $q$  if too_fast(me) then raise exception 'you are asking too quickly; slow down'; end if;
$q$,
  $q$  perform private.note_ip(me);
$q$);

/* The clock's tidy: addresses unseen for `ip_keep()`, and new bodies older than the window. */
select pg_temp.patch_after('public.world_tick()'::regprocedure,
  $q$      delete from private.tick_fault where last_at < now() - interval '7 days';
$q$,
  $q$      delete from private.player_ip where last_at < now() - private.ip_keep();
      delete from private.ip_body where at < now() - private.ip_body_window();
$q$);

/* Every keeper door but `rpc_owner_am_i`: the code, straight after the keeper check. */
do $do$
declare r record; v text; v_old text; n int; v_doors int := 0;
begin
  v_old := $q$    raise exception 'only a keeper of this island may do that';
  end if;
$q$;
  for r in
    select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname like 'rpc\_owner\_%' and p.proname <> 'rpc_owner_am_i'
  loop
    v := pg_get_functiondef(r.oid);
    n := (length(v) - length(replace(v, v_old, ''))) / length(v_old);
    if n <> 1 then raise exception '%: % of the keeper anchor, not 1', r.oid::regprocedure, n; end if;
    execute replace(v, v_old, v_old
      || $q$  if not private.keeper_code_ok(me) then raise exception 'Authenticator code needed: Island keeper window.'; end if;
$q$);
    v_doors := v_doors + 1;
  end loop;
  if v_doors < 5 then raise exception 'keeper doors: % patched, expected at least 5', v_doors; end if;
end $do$;

select private.lock_doors();
