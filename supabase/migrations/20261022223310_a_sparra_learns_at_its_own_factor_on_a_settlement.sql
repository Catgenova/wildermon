-- A Sparra's spar with a guard on a settlement teaches it at a factor of its own.
--
-- Asked for, of the spar on a settlement: both gain experience from it. A spar there comes round once a guard's go at
-- its task, where yours comes round once a swing, so at the factor your spar teaches it (`learn_pace_def` 'spar') a
-- Sparra on a settlement took about fifteen times the median trade's time to level. It now learns there at
-- `learn_pace_def` 'bout', measured as every trade's factor is (`supabase/test/learnrate.ts`), the base the same as your
-- swing's (`learns_gain_bout`); your spar keeps its own. The browser's `LEARN_PACE.bout`.
--
-- `worker_learn_paced` is `worker_learn` at a given factor in place of its own trade's (`gainSkill`'s `pace`), and
-- `worker_learn` asks it at its own.

set local lock_timeout = '3s';

do $do$
declare v_def text;
begin
  -- The whole of a worker's gain, at a given factor or (null) its own trade's.
  select pg_get_functiondef('worker_learn(uuid, int, text, double precision)'::regprocedure) into v_def;
  if (length(v_def) - length(replace(v_def, 'learn_pace(c, p_skill)', ''))) / length('learn_pace(c, p_skill)') <> 1 then
    raise exception 'worker_learn: its factor not found exactly once';
  end if;
  if (length(v_def) - length(replace(v_def, 'p_base double precision)', ''))) / length('p_base double precision)') <> 1 then
    raise exception 'worker_learn: its arguments not found exactly once';
  end if;
  v_def := replace(v_def, 'public.worker_learn(', 'public.worker_learn_paced(');
  v_def := replace(v_def, 'p_base double precision)', 'p_base double precision, p_pace double precision)');
  v_def := replace(v_def, 'learn_pace(c, p_skill)', 'coalesce(p_pace, learn_pace(c, p_skill))');
  execute v_def;

  -- And a Sparra's spar on a settlement at its own factor (`sparBlows`).
  select pg_get_functiondef('spar_go(uuid, int, int, timestamptz)'::regprocedure) into v_def;
  if (length(v_def) - length(replace(v_def, $a$  perform beast_learns(p_world, p_sparra, 'spar');$a$, '')))
     / length($a$  perform beast_learns(p_world, p_sparra, 'spar');$a$) <> 1 then
    raise exception 'spar_go: its lesson not found exactly once';
  end if;
  execute replace(v_def, $a$  perform beast_learns(p_world, p_sparra, 'spar');$a$,
    $a$  perform worker_learn_paced(p_world, p_sparra, sd.learns, learns_gain_bout(), (select lp.pace from learn_pace_def lp where lp.id = 'bout'))
    from species_def sd where sd.id = s.species and sd.learns is not null;$a$);
end $do$;

-- A gain at its own trade's factor.
create or replace function worker_learn(p_world uuid, p_id integer, p_skill text, p_base double precision)
returns double precision language sql
set search_path to 'public', 'extensions' as $fn$
  select worker_learn_paced(p_world, p_id, p_skill, p_base, null)
$fn$;

select private.lock_doors();
