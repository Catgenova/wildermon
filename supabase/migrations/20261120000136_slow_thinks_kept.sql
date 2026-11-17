-- A wildermon's think that held the clock's round, kept with what it was doing.
--
-- Read off the island (2026-11-17): one round of 36.4 s at 04:59:06, all of it the stir stage, and nothing in the
-- round's own row (`tick_time`) to say whose think it was. The 12 s rounds earlier that day took a Look of their own
-- (one think of every kept wildermon timed, each undone) to name the Hoardback behind them. Now every think the clock
-- asks for (`kept_sweep`, `worker_sweep`, `creature_sweep`) is timed (`private.settle_timed`), and one of
-- `slow_think_ms()` or more is kept in `private.slow_think` for `slow_think_keep()`: the creature, its kind, mode,
-- job, phase, why it idles and whose it is, and how long.

set local lock_timeout = '3s';

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

create or replace function public.slow_think_ms() returns double precision language sql immutable as $fn$ select 1000::double precision $fn$;
create or replace function public.slow_think_keep() returns interval language sql immutable as $fn$ select interval '3 days' $fn$;

create table if not exists private.slow_think (
  at timestamptz not null default now(),
  world_id uuid not null,
  creature int not null,
  species text,
  mode text,
  job text,
  phase text,
  idle_why text,
  keeper uuid,
  ms double precision not null
);
create index if not exists slow_think_at on private.slow_think (at);

-- One think, timed; kept when it is slow. What `creature_settle` says, and what it raises, as it was. On the caller's
-- search path, as the sweeps' own call to `creature_settle` was (a test's counting `creature_settle` ahead of it, `stirload.ts`).
create or replace function private.settle_timed(p_world uuid, p_id integer) returns boolean
language plpgsql as $fn$
declare t0 timestamptz := clock_timestamp(); v_ok boolean; v_ms double precision;
begin
  v_ok := creature_settle(p_world, p_id);
  v_ms := extract(epoch from clock_timestamp() - t0) * 1000;
  if v_ms >= slow_think_ms() then
    insert into private.slow_think (world_id, creature, species, mode, job, phase, idle_why, keeper, ms)
      select p_world, p_id, c.species, c.mode, c.job, c.phase, c.idle_why, c.keeper, v_ms
        from creature c where c.world_id = p_world and c.id = p_id;
    delete from private.slow_think where at < now() - slow_think_keep();
  end if;
  return v_ok;
end $fn$;

select pg_temp.patch_fn('public.kept_sweep(uuid, timestamp with time zone)'::regprocedure,
  'if creature_settle(p_world, r.id) then', 'if private.settle_timed(p_world, r.id) then');
select pg_temp.patch_fn('public.worker_sweep(uuid, timestamp with time zone)'::regprocedure,
  'if creature_settle(p_world, r.id) then', 'if private.settle_timed(p_world, r.id) then');
select pg_temp.patch_fn('public.creature_sweep(uuid, double precision, double precision, double precision, timestamp with time zone, double precision, boolean)'::regprocedure,
  'if creature_settle(p_world, r.id) then', 'if private.settle_timed(p_world, r.id) then');

select private.lock_doors();
