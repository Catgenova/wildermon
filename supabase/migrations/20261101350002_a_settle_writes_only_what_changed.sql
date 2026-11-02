-- A worker's or a companion's settle writes its row only when something in it changed.
--
-- Asked for: skip unchanged creature writes. `creature_settle` writes a worker's or a companion's body and legs, and
-- then `worker_settle` or `companion_settle` writes its day on top, in the same transaction. A companion at its
-- keeper's heel with nothing to fight, and a worker whose turn is not up yet (out on a leg, at rest), have nothing in
-- that second write the first did not already say: the same legs, the same phase, `settled_at` the same `now()`.
-- Written anyway it was another row version, its WAL, a run of `work_stats_keep`, and, for a settle that wrote
-- nothing else (`creature_settle` with no time passed), a row the creatures delta (`rpc_creatures` `p_since`,
-- 20261101290001) sent again to everybody near for nothing in it having changed. Measured on an island built like
-- the live one (supabase/test/bench-stir.ts), a round of the clock doing the same work (the same seed, the budget
-- lifted) wrote 37 creature rows before and 29 after, and 1.48 kB of WAL a creature settled against 1.41 kB.
--
-- Now each of those two writes is made only when its row would be different (`is distinct from`, column for
-- column), which leaves the row exactly as writing it would have: `work_stats_keep` changes nothing when neither the
-- ledger nor `settled_at` moved, and no other trigger is asked of these columns. The one trigger that would change
-- an unchanged row is `creature_storey`, which puts a creature upstairs or on a staircase back on its footing; a row
-- it would be asked of (`storey`, `storey_from` or `way` set) is written as before. Every row whose answer could
-- change is written, so the delta misses nothing; the rows skipped are the same, byte for byte, as what is there.

set local lock_timeout = '3s';

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public', 'worker_settle',
     $$      enemy = c.enemy, spar_with = c.spar_with, spar_at = c.spar_at, storey = c.storey, storey_from = c.storey_from, way = c.way, settled_at = now()
    where world_id = p_world and id = p_id;
  if v_did is not null and c.keeper is not null then$$,
     $$      enemy = c.enemy, spar_with = c.spar_with, spar_at = c.spar_at, storey = c.storey, storey_from = c.storey_from, way = c.way, settled_at = now()
    where world_id = p_world and id = p_id
      -- Only when it changes the row (`creature_storey` asked of one upstairs or on a staircase, which may).
      and (coalesce(c.storey <> 0 or c.storey_from <> 0 or c.way is not null, false)
           or (from_x, from_y, to_x, to_y, leg_at, leg_ends, until, phase, work_x, work_y, carrying, fetching,
               idle_since, idle_why, idle_what, idle_n, ledger, worn, gear, bed, enemy, spar_with, spar_at,
               storey, storey_from, way, settled_at)
              is distinct from
              (c.from_x, c.from_y, c.to_x, c.to_y, c.leg_at, c.leg_ends, c.until, c.phase, c.work_x, c.work_y, c.carrying, c.fetching,
               c.idle_since, c.idle_why, c.idle_what, c.idle_n, c.ledger, c.worn, c.gear, c.bed, c.enemy, c.spar_with, c.spar_at,
               c.storey, c.storey_from, c.way, now()));
  if v_did is not null and c.keeper is not null then$$),
    ('public', 'companion_settle',
     $$      enemy = c.enemy, settled_at = now()
    where world_id = p_world and id = p_id;
  return done;$$,
     $$      enemy = c.enemy, settled_at = now()
    where world_id = p_world and id = p_id
      -- Only when it changes the row (`creature_storey` asked of one upstairs or on a staircase, which may).
      and (coalesce(storey <> 0 or storey_from <> 0 or way is not null, false)
           or (from_x, from_y, to_x, to_y, leg_at, leg_ends, until, phase, enemy, settled_at)
              is distinct from
              (c.from_x, c.from_y, c.to_x, c.to_y, c.leg_at, c.leg_ends, c.until, c.phase, c.enemy, now()));
  return done;$$)
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
