-- One device at a time on an account.
--
-- Asked for: "Implement sign in gates to prevent signing into one account from two devices simultaneously". An
-- account was as much at home in two browsers at once as in one: both walked, both worked, both drew on the same
-- body and the same pack.
--
-- So an account has one seat (`private.play_seat`), held by one game tab: the tab sends its seat with every call
-- (`x-wildermon-seat`, `private.seat_header`; a fresh one for each tab, kept while the tab is open, so a reload keeps
-- it). Every door the game uses starts with `private.pace`, and there `private.seat_check` asks it: no seat yet,
-- the seat is this one's; this one's, heard from; somebody else's not heard from in `seat_stale`, this one's now;
-- otherwise refused, "Playing on another device." (WK423). A call without the header -- the account page, the stud
-- book -- is not asked. `rpc_take_seat` (Play here) gives the seat to the tab asking and tells the other
-- (`elsewhere`, on the body's own channel), which stops as the island refuses it.

set local lock_timeout = '3s';

create table if not exists private.play_seat (
  uid uuid primary key,
  seat uuid not null,
  seen_at timestamptz not null default now()
);
revoke all on private.play_seat from public, anon, authenticated;

create or replace function private.seat_header() returns text language sql immutable as $$ select 'x-wildermon-seat'::text $$;
create or replace function private.seat_stale() returns interval language sql immutable as $$ select interval '45 seconds' $$;
create or replace function private.seat_elsewhere_said() returns text language sql immutable as $$ select 'Playing on another device.'::text $$;

/** The seat a call came with, or null: none sent. */
create or replace function private.seat_sent() returns uuid
language plpgsql stable as $f$
declare v_h text; v_k text;
begin
  v_h := nullif(current_setting('request.headers', true), '');
  if v_h is null or position(private.seat_header() in v_h) = 0 then return null; end if;
  v_k := v_h::json ->> private.seat_header();
  if v_k is null then return null; end if;
  if v_k !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Bad request: % is not a seat.', private.seat_header() using errcode = '22023';
  end if;
  return v_k::uuid;
end $f$;

/** Whether this call may go on for this body: its seat, or one free (`seat_stale`), or refused. */
create or replace function private.seat_check(p_uid uuid) returns void
language plpgsql as $f$
declare v_seat uuid; s private.play_seat;
begin
  if p_uid is null or current_setting('wildermon.seat_take', true) = '1' then return; end if;
  v_seat := private.seat_sent();
  if v_seat is null then return; end if;
  select * into s from private.play_seat where uid = p_uid;
  if not found then
    insert into private.play_seat (uid, seat, seen_at) values (p_uid, v_seat, now()) on conflict (uid) do nothing;
    return;
  end if;
  if s.seat = v_seat then
    -- Heard from: a write every ten seconds at most, not every call.
    if s.seen_at < now() - interval '10 seconds' then
      update private.play_seat set seen_at = now() where uid = p_uid and seat = v_seat;
    end if;
    return;
  end if;
  if s.seen_at < now() - private.seat_stale() then
    update private.play_seat set seat = v_seat, seen_at = now() where uid = p_uid and seat = s.seat;
    return;
  end if;
  raise exception '%', private.seat_elsewhere_said() using errcode = 'WK423';
end $f$;

-- Every door's first word: the seat, then the pace.
create or replace function pg_temp.patch_fn(p_sig regprocedure, p_old text, p_new text, p_times int default 1) returns void
language plpgsql as $p$
declare v_def text; v_n int;
begin
  v_def := pg_get_functiondef(p_sig);
  v_n := (length(v_def) - length(replace(v_def, p_old, ''))) / length(p_old);
  if v_n <> p_times then
    raise exception '%: % of "%", wanted %', p_sig, v_n, left(p_old, 120), p_times;
  end if;
  execute replace(v_def, p_old, p_new);
end $p$;

select pg_temp.patch_fn('private.pace(uuid,text)'::regprocedure,
  $o$  if p_uid is null then return; end if;
  if v_slot is null then raise exception 'no such class of door: %', p_class; end if;$o$,
  $n$  if p_uid is null then return; end if;
  if v_slot is null then raise exception 'no such class of door: %', p_class; end if;
  -- One device at a time on an account (`seat_check`).
  perform private.seat_check(p_uid);$n$);

/** Play here: the seat to the tab asking, and the other told. */
create or replace function public.rpc_take_seat()
returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare me uuid := auth.uid(); v_seat uuid; v_was uuid; r record;
begin
  if me is null then raise exception 'not signed in'; end if;
  perform set_config('wildermon.seat_take', '1', true);
  perform private.pace(me, 'act');
  v_seat := private.seat_sent();
  if v_seat is null then return jsonb_build_object('why', 'No seat sent.'); end if;
  select seat into v_was from private.play_seat where uid = me;
  insert into private.play_seat (uid, seat, seen_at) values (me, v_seat, now())
  on conflict (uid) do update set seat = excluded.seat, seen_at = now();
  if v_was is not null and v_was <> v_seat then
    for r in select world_id from player where uid = me loop
      -- The seat that took it, so the tab holding it lets this go by.
      perform private.send('own:' || r.world_id || ':' || me, 'elsewhere', jsonb_build_object('seat', v_seat));
    end loop;
  end if;
  perform set_config('wildermon.seat_take', '', true);
  return '{}'::jsonb;
end $f$;
revoke execute on function public.rpc_take_seat() from public, anon;
grant execute on function public.rpc_take_seat() to authenticated;

revoke execute on function private.seat_sent(), private.seat_check(uuid) from public;

select private.lock_doors();
