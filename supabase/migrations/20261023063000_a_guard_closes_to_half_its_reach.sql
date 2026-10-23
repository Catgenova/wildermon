set local lock_timeout = '3s';

-- A guard closes to half its reach of what it is after.
--
-- Reported: a Whispet and a Sparra on a settlement not sparring. The Whispet, a guard, had a wild Tinka one tile off:
-- `fight_reach` for a guard is 1, and its chase went to `dist - 1` short of it, so it stopped right at the edge of its
-- reach; a step along one axis (`chase_leg`, round something in the way) or the arithmetic left it a hair over, and it
-- went on taking legs of nothing, never striking and never letting go. With an enemy it may not spar (`spar_may`).
-- A chase now goes to half its reach short, as a companion's does (`companion_settle`), so it ends inside it.
do $do$
declare v_def text; v_old text := '(dist - 1) / dist'; v_new text := '(dist - fight_reach(kind) / 2) / dist'; v_n int;
begin
  v_def := pg_get_functiondef('worker_settle'::regproc);
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 2 then raise exception 'worker_settle has % of the chase, not 2', v_n; end if;
  execute replace(v_def, v_old, v_new);
end $do$;

select private.lock_doors();
