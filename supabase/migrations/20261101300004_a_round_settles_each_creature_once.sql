-- A round of the clock settles each creature once.
--
-- Asked for: "streamline cpu", and in it the sweeps of two people standing near each other. A round settles first every
-- worker and companion of somebody awake (`kept_sweep`), then what is round each person awake (`creature_sweep`, a
-- tile at a time), tame first. A companion is at its keeper's heel and its `until` is the moment it was settled, so
-- every companion was settled again by its keeper's own sweep, and again by the sweep of everybody standing near; so
-- was any worker in reach of somebody. A creature settled a second time in the same round has had no time pass: a
-- worker does nothing (its `until` is past the round already), a wild one does nothing, and a companion looks for
-- something to fight that it looked for a moment before. On an island built like the live one
-- (supabase/test/bench-stir.ts) that was half of everything the companions cost.
--
-- In the clock's round (`world_tick` says so in `wildermon.stir_round`, for the round's own transaction), a person's sweep
-- now passes over what the round has settled already. Called anywhere else, a sweep is as it was.

set local lock_timeout = '3s';

create or replace function public.creature_sweep(p_world uuid, p_x double precision, p_y double precision, p_range double precision default 40,
  p_until timestamp with time zone default null::timestamp with time zone, p_slack double precision default null::double precision,
  p_tame boolean default false)
 returns integer
 language plpgsql
as $function$
declare r record; n int := 0; v_reach double precision := p_range + coalesce(p_slack, leg_slack());
        v_round boolean := coalesce(current_setting('wildermon.stir_round', true), '') = 'on';
begin
  for r in select id from creature
    where world_id = p_world
      and to_x between p_x - v_reach and p_x + v_reach
      and to_y between p_y - v_reach and p_y + v_reach
      and until <= now()
      and (not p_tame or mode <> 'wild')
      -- In the clock's round, not what it has settled already this round (`world_tick`).
      and (not v_round or settled_at < now())
    order by mode = 'wild', until limit 120
  loop
    exit when p_until is not null and clock_timestamp() > p_until;
    if creature_settle(p_world, r.id) then n := n + 1; end if;
  end loop;
  return n;
end $function$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- The round says so for its stir, and stops saying so once its stir is done.
    ('public', 'world_tick',
     $$    v_coarse := floor(extract(epoch from v_t0))::bigint % stir_coarse_every()::bigint = 0;
$$,
     $$    v_coarse := floor(extract(epoch from v_t0))::bigint % stir_coarse_every()::bigint = 0;
    -- What this round settles, its people's sweeps pass over (`creature_sweep`).
    perform set_config('wildermon.stir_round', 'on', true);
$$),
    ('public', 'world_tick',
     $$    v_stir_ms := v_stir_ms + ms_since(v_mark);
$$,
     $$    v_stir_ms := v_stir_ms + ms_since(v_mark);
    perform set_config('wildermon.stir_round', '', true);
$$)
  ) as t(sch, fn, old, new) loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = r.sch and p.proname = r.fn;
    if v_def is null then raise exception '%.% is not on this island', r.sch, r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '%.% has % of the lines to change, not 1', r.sch, r.fn, v_n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
