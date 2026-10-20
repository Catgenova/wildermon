-- A deed worker off its ground walks home whether or not anybody is standing beside it.
--
-- Reported: a Tinka sent home from about three hundred tiles away "didnt move". 20261019172000 had it walk back to
-- its ground a short leg at a time (`worker_settle`, `home_leg`), but the clock only settles what is within forty
-- tiles of somebody awake (`creature_sweep` round each player). Its keeper went home to the settlement, and the Tinka
-- stood a hundred and sixty-six tiles out from it, idle, with nobody near enough for the clock to reach it, for good.
--
-- Now every round also settles each worker of somebody awake that is off its ground by the same test `worker_settle`
-- walks it home on (further from its work site than the site's radius and `home_slack`), wherever it has got to. A
-- worker on its ground is left to the sweeps round the players, as before. It reads the workers by their own index
-- (`creature_by_world`, on world and mode) and takes at most `worker_sweep_most()` a round.

set local lock_timeout = '3s';

-- How many workers off their ground one round of the clock walks on.
create or replace function worker_sweep_most() returns int language sql immutable as $fn$ select 20 $fn$;

-- Each worker of somebody awake that is off its ground and due, settled: what walks it a leg nearer home. How many.
create or replace function worker_sweep(p_world uuid, p_until timestamptz default null)
returns int language plpgsql as $fn$
declare r record; n int := 0;
begin
  for r in
    select c.id from creature c
     cross join lateral work_site(p_world, c) s
     where c.world_id = p_world and c.mode = 'deed' and c.until <= now()
       and s.x is not null
       and greatest(abs(s.x + 0.5 - c.to_x), abs(s.y + 0.5 - c.to_y)) > s.radius + home_slack()
       and exists (select 1 from player p where p.world_id = p_world and p.uid = c.keeper and not p.away
                     and p.seen_at > now() - make_interval(secs => idle_logout()))
     order by c.until limit worker_sweep_most()
  loop
    exit when p_until is not null and clock_timestamp() > p_until;
    if creature_settle(p_world, r.id) then n := n + 1; end if;
  end loop;
  return n;
end $fn$;

-- The clock: after the sweeps round each player, the workers off their ground.
do $do$
declare v_def text; v_old text; v_n int;
begin
  v_old := $$        if v_coarse then
          v_stirred := v_stirred + creature_sweep(w.id, p.x, p.y, 40, v_deadline, null, true);
        end if;
      end loop;
$$;
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'world_tick';
  if v_def is null then raise exception 'world_tick is not there'; end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'world_tick has % of the sweep loop, not 1', v_n; end if;
  execute replace(v_def, v_old, v_old || $$      -- And every worker of somebody awake that is off its ground, wherever it has got to (`worker_sweep`).
      v_stirred := v_stirred + worker_sweep(w.id, v_deadline);
$$);
end $do$;

select private.lock_doors();
