-- A body's calls counted a row a connection, so its calls no longer wait for one another.
--
-- Every door starts with `private.pace` and a hundred of them with `too_fast`, and both wrote the one `caller` row a
-- body has: an update, whose lock is held until the call's transaction ends. A browser asks several things at once
-- (the near read, its springs, what people wear, a settle, a step), so each of its calls waited for the one before
-- it to finish. On the test island a near read made while another call of the same body was open waited out the
-- whole of the other (1.5 s for 1.5 s). On the live island at 02:00 on 11-04, with one player on: `rpc_worn` 36 ms a
-- call, `rpc_settle` 37, the near read 45, a step 48; the same reads cost 6.5 ms for the load test's people, who ask
-- one thing at a time.
--
-- So `caller` keeps a row for each body on each connection that served it (`stripe`, the backend's own number), and
-- a call writes only its connection's row. What it is charged is worked out from every row of the body as committed:
--   * `pace`: the latest any connection has charged the class, or now, and one interval more (`pace_rate`), refused
--     past `pace_burst` intervals ahead, as before;
--   * `too_fast`: this minute's calls on every connection, this one included, past `calls_a_minute`, as before.
-- Calls made one after another are charged exactly as they were. Calls in flight at the same instant on different
-- connections do not see each other's charge: at most one each, as many as there are connections (the API keeps 8).
--
-- Rows of connections nobody has used for two minutes are let go of every five minutes (`once_sweep`), and a body's
-- rows are still all of `caller where uid = ...`, so clearing or reading a body's count is as it was.
set local lock_timeout = '3s';

alter table public.caller add column if not exists stripe integer not null default 0;
alter table public.caller drop constraint caller_pkey;
alter table public.caller add primary key (uid, stripe);

create or replace function private.pace(p_uid uuid, p_class text) returns void
language plpgsql as $function$
-- The interval in whole microseconds, rounded down, so `rate` calls fit in a second exactly.
declare v_slot int := private.pace_slot(p_class);
        v_every interval := make_interval(secs => floor(1e6 / private.pace_rate(p_class)) / 1e6);
        v_ahead interval; v_at timestamptz;
begin
  if p_uid is null then return; end if;
  if v_slot is null then raise exception 'no such class of door: %', p_class; end if;
  -- The latest this body's class has been charged on any connection, as committed, and this connection's own.
  select greatest(max(c.paced[v_slot]), now()) + v_every into v_at from public.caller c where c.uid = p_uid;
  insert into public.caller as c (uid, stripe, paced[v_slot]) values (p_uid, pg_backend_pid(), v_at)
  on conflict (uid, stripe) do update set paced[v_slot] = v_at;
  v_ahead := v_every * private.pace_burst(p_class);
  if v_at > now() + v_ahead then
    raise exception 'Too many requests: wait % s.', greatest(1, ceil(extract(epoch from v_at - now() - v_ahead)))::int
      using detail = p_class;
  end if;
end $function$;

create or replace function public.too_fast(p_uid uuid) returns boolean
language plpgsql as $function$
declare n int; v_minute timestamptz := date_trunc('minute', now());
begin
  if p_uid is null then return false; end if;
  insert into caller as c (uid, stripe, minute, calls) values (p_uid, pg_backend_pid(), v_minute, 1)
  on conflict (uid, stripe) do update
    set calls = case when c.minute < v_minute then 1 else c.calls + 1 end,
        minute = v_minute;
  -- This minute's calls on every connection, this one's included.
  select coalesce(sum(c.calls), 0) into n from caller c where c.uid = p_uid and c.minute = v_minute;
  return n > calls_a_minute();
end $function$;

create or replace function private.once_sweep() returns integer
language plpgsql security definer set search_path to 'public' as $function$
declare v_n int;
begin
  delete from private.once_key where at < now() - private.once_window();
  get diagnostics v_n = row_count;
  -- A connection's count nobody has used for two minutes: past every class's burst and the minute `too_fast` counts.
  delete from caller c
   where c.minute < now() - interval '2 minutes'
     and coalesce((select max(t) from unnest(c.paced) t), '-infinity') < now() - interval '2 minutes';
  return v_n;
end $function$;

select private.lock_doors();
