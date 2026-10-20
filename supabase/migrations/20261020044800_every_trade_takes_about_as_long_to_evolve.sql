-- Every trade takes about as long to evolve.
--
-- Asked for: "Even out the time to evolve across trades". A deed worker learns its level skill on the curve a player
-- does, a gain a go, but each trade's go came round at its own rate: a water carrier fills at the shore and pours at a
-- barrel for every gain, a Dippa fetches, fills and puts back, a Lume learns only after dark, a Cloudlet only when it
-- is shorn, and a sparring partner with every swing. So some lines reached the first stage in a fraction of the time
-- others took, and some never in any time anybody would wait.
--
-- Every gain of a worker's level skill -- the skill its trade trains, or for a kind with no trade the skill what
-- teaches it trains -- is now multiplied by its trade's own factor (`learn_pace`, off `learn_pace_def`, which is the
-- browser's `LEARN_PACE`): the median trade's minutes from level 1 to the first stage and on to the second over its
-- own, measured from each trade's go on this island (`supabase/test/learnrate.ts`), held to between a quarter and four.
-- Any other skill it learns is as it was. `worker_learn` is every gain a beast makes here, so this is one line in it.

set local lock_timeout = '3s';

-- The definitions migration fills it; made here too, so that this does not wait on the order the two are applied in.
create table if not exists learn_pace_def (id text primary key, pace double precision not null);

-- What a gain of this skill is multiplied by for its trade, or for a kind with no trade by what teaches it: its level
-- skill only, and 1 for anything else it learns (`learnPace`).
create or replace function learn_pace(c creature, p_skill text) returns double precision
language sql stable as $fn$
  select coalesce((
    select lp.pace from species_def sd
      join learn_pace_def lp on lp.id = coalesce(c.job, sd.gathers, sd.learns_by)
     where sd.id = c.species
       and p_skill = coalesce((select g.skill from gather_def g where g.id = coalesce(c.job, sd.gathers)), sd.learns)), 1)
$fn$;

do $do$
declare v_def text; v_n int; v_old text := $$now_v := least(100, was + skill_gain_of(was, p_base * beast_mul(c, 'learn'), 0.6 + 0.8 * random()));$$;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'worker_learn';
  if v_def is null then raise exception 'worker_learn is not on this island'; end if;
  v_n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_n <> 1 then raise exception 'worker_learn has % of the gain, not 1', v_n; end if;
  execute replace(v_def, v_old, $$-- Its level skill at what its trade's goes are worth against every other trade's (`learn_pace`).
  now_v := least(100, was + skill_gain_of(was, p_base * beast_mul(c, 'learn') * learn_pace(c, p_skill), 0.6 + 0.8 * random()));$$);
end $do$;

select private.lock_doors();
