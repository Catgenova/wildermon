-- The island's clocks keep their connection a minute at a time.
--
-- `pg_cron` starts every job in a backend of its own: a second's round of `world_tick` began by compiling the clock
-- and everything it calls, every second. On a copy of the test island the same round cost 73 ms cold and 17 ms warm
-- (stir 56 against 15, sweeps 11.5 against 1); with 25 people, 104 against 48. So each clock now turns in one
-- backend for a minute (`private.clock_loop`): a round, a commit (which is what moves `now()` on and lets go of
-- whatever the round held), and a sleep to the next second. The rounds are the same rounds on the same beat.
--
-- The jobs that ran every second stay, as the clock that turns when the loop is not: each asks whether a loop holds
-- its clock (`private.tick_unless_looping`) and goes back to bed if one does. So if a loop cannot run here at all --
-- a `pg_cron` that will not let a procedure commit, a statement timeout shorter than a minute -- the clock turns as it
-- did, a backend a second, and nothing is lost but the saving.
set local lock_timeout = '3s';

/*
 * One clock, turned for `p_secs` seconds in this backend: `world_tick` and `stock_tick` every `tick_seconds()`, the
 * woods' `tree_tick` every five, as their jobs were. Holds a lock of its own for the whole of it, so a second loop on
 * the same clock (the next minute's, if this one ran long) goes straight back to bed.
 */
create or replace procedure private.clock_loop(p_job text, p_secs double precision default 58)
language plpgsql as $fn$
declare v_key bigint := hashtext('clock_loop:' || p_job)::bigint;
        v_every double precision := case p_job when 'tree' then 5 else tick_seconds() end;
        v_until timestamptz := clock_timestamp() + make_interval(secs => p_secs);
        v_t timestamptz; v_left double precision;
begin
  if p_job not in ('world', 'stock', 'tree') then raise exception 'no clock called %', p_job; end if;
  if not pg_try_advisory_lock(v_key) then return; end if;
  loop
    v_t := clock_timestamp();
    begin
      if p_job = 'world' then perform public.world_tick();
      elsif p_job = 'stock' then perform public.stock_tick();
      else perform public.tree_tick();
      end if;
    exception when others then
      -- A round that failed is the next round's to do, as a failed job was the next second's.
      raise warning 'clock % round failed: %', p_job, sqlerrm;
    end;
    commit;
    exit when clock_timestamp() >= v_until;
    v_left := v_every - extract(epoch from clock_timestamp() - v_t);
    if v_left > 0 then perform pg_sleep(v_left); end if;
  end loop;
  perform pg_advisory_unlock(v_key);
end $fn$;
revoke all on procedure private.clock_loop(text, double precision) from public;

/*
 * The clock as it was, for whenever no loop holds it: a backend a second. Asks the loop's lock and lets it straight
 * go; a loop that starts in that instant finds it taken and leaves this minute to the jobs.
 */
create or replace function private.tick_unless_looping(p_job text) returns jsonb language plpgsql as $fn$
declare v_key bigint := hashtext('clock_loop:' || p_job)::bigint;
begin
  if not pg_try_advisory_lock(v_key) then return jsonb_build_object('looping', true); end if;
  perform pg_advisory_unlock(v_key);
  if p_job = 'world' then return public.world_tick(); end if;
  if p_job = 'stock' then return public.stock_tick(); end if;
  perform public.tree_tick();
  return jsonb_build_object('tree', true);
end $fn$;
revoke all on function private.tick_unless_looping(text) from public;

-- Wound only where there is a `pg_cron`: the suite's postgres has none, and there nothing changes.
do $$
declare j record;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  for j in select * from (values ('world', 'world-tick'), ('stock', 'stock-tick'), ('tree', 'tree-tick')) v(clock, job) loop
    -- The job a second, kept on its own schedule, now asking first whether a loop has its clock.
    if exists (select 1 from cron.job where jobname = j.job) then
      perform cron.schedule(j.job, (select schedule from cron.job where jobname = j.job limit 1),
        format('select private.tick_unless_looping(%L)', j.clock));
    end if;
    -- And the loop, a minute at a time.
    perform cron.schedule(j.clock || '-loop', '* * * * *', format('call private.clock_loop(%L)', j.clock));
  end loop;
  raise notice 'the clocks loop a minute at a time, with the jobs a second behind them';
exception when others then
  raise notice 'could not wind the clock loops (%)', sqlerrm;
end $$;

select private.lock_doors();
