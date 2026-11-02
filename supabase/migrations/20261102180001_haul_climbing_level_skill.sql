-- Asked, of "My monolithumps are leveling up quickly while driving wagon, while my Wagonox levels up slowly":
--
--   1. "Climbing in the traces at the Wagonox's rate." A tile pulled or ridden teaches climbing at `haul_learn_of`,
--      which the definitions before this one (20261102180000_defs.sql) put at the base a tile teaches a kind that
--      learns its own skill by pulling (`learns_gain_pull`, 0.003 a tile), and a steeper step the same share more as
--      before: 0.003 on the flat (was 0.05), to 0.033 at a rise of 12 or more (was 0.55). A Wagonox still learns its
--      driving at its own pace on top (`learn_pace`, pull), so it out-learns any other kind in the same traces.
--   2. "Level and evolution read only a kind's own level skill." `creature_level` reads the skill `level_skill` names
--      for its kind -- its task's, its own, or climbing for a draught kind or mount with neither -- and the highest of
--      its skills only for a kind with none. Climbing a Chiptail learns in the traces, and fighting, level and evolve
--      nothing. `stage_of`, and every place that says a creature's level, read it.
--
-- And no creature on the island loses a stage by it: one whose stage under the new rule is lower than under the old
-- one has its level skill raised to where the stage it is at begins (`evolve_at_1`, `evolve_at_2`), wild ones too.
-- The browser's `creatureLevel`, `stageOf` and `haulLearn` are the same rules; supabase/test/haullevel.ts holds the
-- two sides to each other.

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

-- ---- A kind's level skill, planned once a session -------------------------------------------------------------------

-- As it was, as PL/pgSQL (20261101350001): asked by `creature_level` for every `stage_of` now, which a settle asks in a
-- subtransaction of its own, and a SQL function that reads a table is planned again in each.
create or replace function public.level_skill(p_species text) returns text language plpgsql stable as $fn$
begin
  return (
select coalesce((select g.skill from gather_def g where g.id = sd.gathers), sd.learns,
                  case when sd.draught or sd.mount is not null then haul_skill() end)
    from species_def sd where sd.id = p_species
  );
end $fn$;

-- ---- Its level: its level skill only ----------------------------------------------------------------------------------

-- What it was: the highest of all its skills, whatever they were. The whole number below its level skill now, one
-- without it; the highest of its skills for a kind with no level skill (a monster), so none stays at one for ever.
drop function public.creature_level(jsonb);
create function public.creature_level(p_skills jsonb, p_species text) returns integer language plpgsql stable as $fn$
begin
  return (
select greatest(1, floor(coalesce(case when ls.skill is null then (select max(value::numeric) from jsonb_each_text(p_skills))
                                         else (p_skills->>ls.skill)::numeric end, 0)))::int
    from (select level_skill(p_species) as skill) ls
  );
end $fn$;

select pg_temp.patch_fn('public.stage_of(creature)'::regprocedure,
  'creature_level(c.skills)', 'creature_level(c.skills, c.species)', 2);
select pg_temp.patch_fn('public.perform_creature(uuid, uuid, text, jsonb)'::regprocedure,
  'creature_level(c.skills)', 'creature_level(c.skills, c.species)');
select pg_temp.patch_fn('public.perform_track(uuid, uuid, text, jsonb)'::regprocedure,
  'creature_level(c.skills)', 'creature_level(c.skills, c.species)');
select pg_temp.patch_fn('public.rpc_boards(uuid)'::regprocedure,
  'creature_level(c.skills)', 'creature_level(c.skills, c.species)');

-- ---- None loses a stage ------------------------------------------------------------------------------------------------

-- Each of a kind that evolves whose highest skill put it at a stage its level skill does not: that skill to where the
-- stage begins. Its health, name and trait slots are its stage's already, and stay.
do $do$
declare v_n int;
begin
  with was as (
    select c.world_id, c.id, level_skill(c.species) as skill,
           case when o.lv >= evolve_at_2() then evolve_at_2() else evolve_at_1() end as at,
           case when o.lv >= evolve_at_2() then 2 else 1 end as stage
      from creature c
      join species_def sd on sd.id = c.species and sd.stages is not null
     cross join lateral (select floor(coalesce((select max(value::numeric) from jsonb_each_text(c.skills)), 0)) as lv) o
     where o.lv >= evolve_at_1()
  )
  update creature c
     set skills = jsonb_set(c.skills, array[w.skill],
                            to_jsonb(greatest(w.at, coalesce((c.skills->>w.skill)::double precision, 0))))
    from was w
   where c.world_id = w.world_id and c.id = w.id and w.skill is not null and stage_of(c) < w.stage;
  get diagnostics v_n = row_count;
  raise notice 'kept at their stage: % creatures', v_n;
end $do$;

select private.lock_doors();
