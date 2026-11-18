-- A slow think, kept with what else the database was doing (seen 11-17: two Snouts at 19-46 s and Meri's mola at
-- 2.6-3.3 s in the same 90 s at 22:20 and again at 22:46, every think in those rounds 30 to 65 times its usual; the
-- clock's rounds of those minutes were already gone, `tick_time` keeping an hour).
--
-- * `private.slow_think.at` is when the think began (`clock_timestamp()`), not when its round's transaction began.
-- * A think of `slow_stall_ms()` or more keeps `others`: every other backend not idle at its end, with its kind, user,
--   state, what it waits on, how long its query has run and the query's start (autovacuum workers included).
-- * `tick_time` keeps 6 hours of the clock's rounds, not 1.

set local lock_timeout = '3s';

alter table private.slow_think add column if not exists others jsonb;

create or replace function public.slow_stall_ms() returns double precision language sql immutable as $fn$ select 5000::double precision $fn$;

create or replace function private.settle_timed(p_world uuid, p_id integer) returns boolean
language plpgsql as $fn$
declare t0 timestamptz := clock_timestamp(); v_ok boolean; v_ms double precision; v_others jsonb;
begin
  v_ok := creature_settle(p_world, p_id);
  v_ms := extract(epoch from clock_timestamp() - t0) * 1000;
  if v_ms >= slow_think_ms() then
    -- Held this long, what else was running: a stall of the whole database shows here, a slow think of its own does not.
    if v_ms >= slow_stall_ms() then
      -- An empty list when nothing else was: looked at, and nothing found.
      select coalesce(jsonb_agg(jsonb_build_object(
               'pid', a.pid, 'type', a.backend_type, 'user', a.usename, 'state', a.state,
               'wait', coalesce(a.wait_event_type || ':' || a.wait_event, ''),
               'secs', round(extract(epoch from clock_timestamp() - coalesce(a.query_start, a.backend_start))::numeric, 1),
               'query', left(regexp_replace(coalesce(a.query, ''), '\s+', ' ', 'g'), 160))
             order by a.query_start), '[]'::jsonb)
        into v_others
        from pg_stat_activity a
       where a.pid <> pg_backend_pid() and coalesce(a.state, '') <> 'idle'
         and a.backend_type in ('client backend', 'autovacuum worker', 'background worker', 'pg_cron', 'walsender');
    end if;
    insert into private.slow_think (at, world_id, creature, species, mode, job, phase, idle_why, keeper, ms, others)
      select t0, p_world, p_id, c.species, c.mode, c.job, c.phase, c.idle_why, c.keeper, v_ms, v_others
        from creature c where c.world_id = p_world and c.id = p_id;
    delete from private.slow_think where at < now() - slow_think_keep();
  end if;
  return v_ok;
end $fn$;

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

select pg_temp.patch_fn('public.world_tick()'::regprocedure,
  $o$      -- An hour of rounds is all anybody needs to see where the time went.
      delete from tick_time where at < now() - interval '1 hour';$o$,
  $n$      -- Six hours of rounds: a stall is looked into after it, and an hour had gone by the time anybody asked.
      delete from tick_time where at < now() - interval '6 hours';$n$);

select private.lock_doors();
