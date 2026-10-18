-- Wildermon evolve.
--
-- Asked for: "add 2 evolution stages for each with 2 new names for each evolution. Each evolution add movement speed
-- and task speed and base stats. Evolutions happen at level 25 and 50." A kind that evolves (`species_def.stages`, the
-- names of its stages after its first, which come in with the definitions) is at its second stage from `evolve_at_1`
-- and its third from `evolve_at_2`, its level being its skill (`creature_level`). Each stage multiplies its health, its
-- blow, its pace and how fast it gets a task done by `stage_mul_*` over the one before, on the channels its blood is
-- counted on (`beast_mul`), so everything that reads those reads its stage. The browser's `stageOf`, `evoMul`.

-- What the definitions bring in, ahead of them: the column, and the numbers (`EVOLVE_AT`, `STAGE_MUL`), which the
-- definitions that come in after this write again from the browser's.
set local lock_timeout = '3s';
alter table species_def add column if not exists stages text[];
create or replace function evolve_at_1() returns double precision language sql immutable as $fn$ select 25::double precision $fn$;
create or replace function evolve_at_2() returns double precision language sql immutable as $fn$ select 50::double precision $fn$;
create or replace function stage_mul_hardy() returns double precision language sql immutable as $fn$ select 1.2::double precision $fn$;
create or replace function stage_mul_tough() returns double precision language sql immutable as $fn$ select 1.2::double precision $fn$;
create or replace function stage_mul_speed() returns double precision language sql immutable as $fn$ select 1.2::double precision $fn$;
create or replace function stage_mul_work() returns double precision language sql immutable as $fn$ select 1.15::double precision $fn$;

-- Which stage it is at: nought below the first, one, two; nought always for a kind that does not evolve (`stageOf`).
create or replace function stage_of(c creature) returns int language sql stable as $fn$
  select case when (select sd.stages from species_def sd where sd.id = c.species) is null then 0
              when creature_level(c.skills) >= evolve_at_2() then 2
              when creature_level(c.skills) >= evolve_at_1() then 1
              else 0 end
$fn$;

-- What its stage makes of one channel of its blood (`evoMul`).
create or replace function evo_mul(c creature, p_channel text) returns double precision language sql stable as $fn$
  select case when p_channel not in ('hardy', 'tough', 'speed', 'work') then 1::double precision
              else (case p_channel when 'hardy' then stage_mul_hardy() when 'tough' then stage_mul_tough()
                                   when 'speed' then stage_mul_speed() else stage_mul_work() end) ^ stage_of(c) end
$fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Its stage on every channel its blood is counted on.
    (1, 'beast_mul', $$  select trait_mul(c.traits, p_channel) * deed_aura(c, p_channel)$$,
                     $$  select trait_mul(c.traits, p_channel) * deed_aura(c, p_channel)
       -- And what its stage makes of it, for a kind that evolves (`evo_mul`).
       * evo_mul(c, p_channel)$$, 1),

    -- And it evolves at a level a stage begins at: what it can take grows with it, as full as it was.
    (2, 'worker_learn', $$declare c creature; was double precision; now_v double precision;$$,
                        $$declare c creature; was double precision; now_v double precision; c2 creature;$$, 1),
    (3, 'worker_learn', $$  return now_v - was;$$,
                        $$  select * into c2 from creature where world_id = p_world and id = p_id;
  if stage_of(c2) > stage_of(c) then
    update creature set health = health * stage_mul_hardy() where world_id = p_world and id = p_id;
    if c.mode <> 'wild' and c.keeper is not null then
      perform tell(p_world, c.keeper, c.name || ' evolves into a '
        || (select sd.stages[stage_of(c2)] from species_def sd where sd.id = c.species) || '!', 'event');
    end if;
  end if;
  return now_v - was;$$, 1)
  ) as t(ord, fn, old, new, n) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> r.n then raise exception '% has % of change %, not %', r.fn, v_n, r.ord, r.n; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

select private.lock_doors();
