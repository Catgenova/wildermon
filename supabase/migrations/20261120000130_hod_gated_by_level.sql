-- A hod carrier's build gates read its level, not its level in each gate's skill.
--
-- Asked for: "All materials being placed by bastiondrake should be gate determined by its overall level". A
-- Bastiondrake at masonry 82 (its level) and carpentry 1 was refused glass walls, gated at carpentry 40.
--
-- Every gate on what a hod carrier fits (a wall's, floor's, roof's, staircase's or column's material and type, a bridge
-- span's bridge) is now met at the carrier's level (`creature_level`: its level skill, masonry for the cobbe line, to
-- the whole number below) at or over the gate's level. The gate's level is as it was; only the carrier's side changes.
--
--   * `worker_build_open`, which only `hod_may` reads: every gate at or under the worker's level;
--   * `hod_may`, a bridge span: the bridge's gate at or under the carrier's level;
--   * `hod_build_gate`, the `gate` idle reason: the first gate over the carrier's level.
--
-- Every other worker's gates (felling, mining, recipes, smelting and the rest: `worker_gate_open`) still read the gate's
-- skill.
--
-- The browser's twins: `workerBuildOpen`, `hodGate`, `hodMay` (craftgates.ts), given `creatureLevel`; the card's
-- 'gate' for a hod carrier names the gate's level and the carrier's ("needs level 40 (yours 82)", `idleSays`).

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

-- Whether a worker meets every gate on building with a material as a type at its level (`creature_level`), not its
-- level in each gate's skill (`workerBuildOpen`). A hod carrier's (`hod_may`).
create or replace function public.worker_build_open(c creature, p_material text, p_wall text, p_floor text, p_hand text)
 returns boolean
 language sql
 stable
as $$
  select coalesce(max(b.level), 0) <= creature_level(c.skills, c.species) from build_gates(p_material, p_wall, p_floor, p_hand) b
$$;

-- A bridge span: its bridge's gate at or under the carrier's level.
select pg_temp.patch_fn('public.hod_may(uuid,creature,text,integer,text,integer,integer)'::regprocedure,
$o$bool_and(worker_gate_open(c, skill_gate_of('bridge', b.kind)))$o$,
$n$bool_and(coalesce((skill_gate_of('bridge', b.kind)).level, 0) <= creature_level(c.skills, c.species))$n$);

-- The `gate` idle reason: the first gate over the carrier's level.
select pg_temp.patch_fn('public.hod_build_gate(uuid,creature,integer,integer,integer)'::regprocedure,
$o$where worker_level(c, b.skill) < b.level$o$,
$n$where creature_level(c.skills, c.species) < b.level$n$);

select private.lock_doors();
