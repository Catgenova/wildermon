-- A skill of each line's own at its third stage, and a trait slot more at each stage.
--
-- Asked for: "every evolving line gains one perk of its own at its third stage ... concrete and modest, with a
-- number". One to a line, from the definitions (`species_def.perk`, `perk_n`, `perk_channel`; the browser's
-- `STAGE_PERKS`), from the stage at `perk_stage` on, over what every stage gives:
--
--   more   +n to what one go of its trade brings in, a worker's gather (`perk_more`, in `worker_settle`)
--   loads  +n loads a trip or things a go (`stage_loads`)
--   rest   its ability's cooldown -n (`beast_ability`, `beast_pounce`)
--   stun   its stun n seconds longer (`style_blow`, `enchant_stun`)
--   wool   +n wool a shearing, by you or a worker (`perform_creature`, `errand_do`)
--   blood  one channel of its blood xn (`evo_mul`, and so `beast_mul`)
--
-- And asked for: "reaching stage 2 opens one more trait slot, and stage 3 one more". A wildermon of a kind that
-- evolves has `trait_slots` at its first stage and `slots_per_stage` more at each after (`stage_slots`; the browser's
-- `stageSlots`). One that evolves gains a trait for each slot its new stage opens, drawn as a young one's short draw is
-- topped up, a fresh roll off the wild table by its keeper's husbandry (`roll_trait`), and one time in `mutation_odds`
-- a mutation, one rarity above the best it carries (`slot_draw`, `open_slots`, in `worker_learn`); one put out in the
-- wild at a later stage has its stage's slots (`wild_stage_put`); a young one is born with `trait_slots`, as before.
-- And every evolved one on the island now is given the slots it is missing, once, by the same draw.

set local lock_timeout = '3s';

/* ---- A line's own skill at its third stage ----------------------------------------------------------------------- */

-- What its line's skill of a kind comes to now: its number at `perk_stage` and over, nought below it or of another
-- kind (`perkN`). A blood one is read by `evo_mul`.
-- Its stage (`stage_of`, which is most of the cost) is only asked of one whose kind has a skill of that kind.
create or replace function perk_n(c creature, p_kind text) returns double precision language sql stable as $fn$
  select coalesce((select case when stage_of(c) >= perk_stage() then sd.perk_n else 0 end
                     from species_def sd where sd.id = c.species and sd.perk = p_kind), 0)
$fn$;

-- One go's gather, with its line's `more` on it, but for seed carried off a field (`perkMore`).
create or replace function perk_more(c creature, p_load jsonb) returns jsonb language sql stable as $fn$
  select case when p_load is null or perk_n(c, 'more') <= 0 or exists (select 1 from crop_def cd where cd.seed = p_load->>'def') then p_load
              else jsonb_set(p_load, '{count}', to_jsonb(coalesce((p_load->>'count')::int, 1) + perk_n(c, 'more')::int)) end
$fn$;

-- Its stage's loads, and its line's own third-stage loads with them (`stageLoads`), its stage asked once.
create or replace function stage_loads(c creature) returns int language plpgsql stable as $fn$
declare v_stage int := stage_of(c); v_n double precision;
begin
  select sd.perk_n into v_n from species_def sd where sd.id = c.species and sd.perk = 'loads';
  return stage_loads_at(v_stage) + case when v_n is not null and v_stage >= perk_stage() then v_n::int else 0 end;
end $fn$;

/*
 * What its stage makes of one channel of its blood, and its line's own third-stage skill on it (`evoMul`). Every
 * `beast_mul` asks it, the clock's among them, so its stage (`stage_of`, nearly all of what this costs) is asked only
 * of a kind that evolves, on a channel its stages or its skill change; less than it cost before on every other.
 */
create or replace function evo_mul(c creature, p_channel text) returns double precision language plpgsql stable as $fn$
declare sd record; v_stage int;
begin
  select s.stages is not null as evolves, s.perk, s.perk_n, s.perk_channel into sd from species_def s where s.id = c.species;
  if not coalesce(sd.evolves, false) then return 1; end if;
  if p_channel not in ('hardy', 'tough', 'speed', 'work', 'grow') and sd.perk_channel is distinct from p_channel then return 1; end if;
  v_stage := stage_of(c);
  if v_stage = 0 then return 1; end if;
  return (case p_channel when 'hardy' then stage_mul_hardy() when 'tough' then stage_mul_tough()
                         when 'speed' then stage_mul_speed() when 'grow' then stage_mul_grow()
                         when 'work' then stage_mul_work() else 1 end) ^ v_stage
         * case when sd.perk = 'blood' and sd.perk_channel = p_channel and v_stage >= perk_stage() then sd.perk_n else 1 end;
end $fn$;

-- A stun of so many seconds: as `enchant_stun`, for a stun that runs longer than `stun_secs`.
create or replace function enchant_stun(p_world uuid, p_id integer, p_secs double precision) returns void language plpgsql as $fn$
begin
  if not exists (select 1 from creature c where c.world_id = p_world and c.id = p_id and c.health > 0) then return; end if;
  perform class_hold(p_world, p_id, p_secs);
  insert into class_mark (world_id, creature_id, kind, val, until)
    values (p_world, p_id, 'stun', 1, now() + make_interval(secs => p_secs))
    on conflict (world_id, creature_id, kind) do update set val = 1, until = greatest(class_mark.until, excluded.until);
end $fn$;

/* ---- Trait slots by stage ---------------------------------------------------------------------------------------- */

-- The trait slots at a stage (`stageSlots`).
create or replace function stage_slots(p_stage int) returns int language sql immutable as $fn$
  select trait_slots() + slots_per_stage() * greatest(0, coalesce(p_stage, 0))
$fn$;

-- The trait for a slot a stage opens, and where it came from: one time in `mutation_odds` a mutation, a name it does
-- not carry one rarity above the best it carries; else a fresh roll by its keeper's husbandry (`slotDraw`). Null with
-- nothing left to draw.
create or replace function slot_draw(p_traits text[], p_husbandry double precision) returns jsonb language plpgsql volatile as $fn$
declare v text;
begin
  if random() < 1.0 / mutation_odds() then
    v := lamp_trait(mutation_tier(coalesce(p_traits, '{}'), '{}'), coalesce(p_traits, '{}'));
    if v is not null then return jsonb_build_object('id', v, 'from', 'mutation'); end if;
  end if;
  v := roll_trait(coalesce(p_traits, '{}'), coalesce(p_husbandry, 0));
  return case when v is null then null else jsonb_build_object('id', v, 'from', 'roll') end;
end $fn$;

-- A trait for each slot its stages from `p_from` to `p_to` open, up to the slots it has at `p_to`, each by `slot_draw`;
-- where each came from into its pedigree, on one that has one (`openSlots`). How many it gained.
create or replace function open_slots(p_world uuid, p_id int, p_from int, p_to int, p_husbandry double precision)
returns int language plpgsql as $fn$
declare v_traits text[]; v_ped jsonb; d jsonb; n int := 0;
begin
  if coalesce(p_to, 0) <= coalesce(p_from, 0) then return 0; end if;
  select coalesce(traits, '{}'), pedigree into v_traits, v_ped from creature where world_id = p_world and id = p_id;
  if not found then return 0; end if;
  while n < (p_to - p_from) * slots_per_stage() and coalesce(array_length(v_traits, 1), 0) < stage_slots(p_to) loop
    d := slot_draw(v_traits, p_husbandry);
    exit when d is null;
    v_traits := v_traits || (d->>'id');
    if v_ped is not null then
      v_ped := jsonb_set(v_ped, '{from}', coalesce(v_ped->'from', '{}'::jsonb) || jsonb_build_object(d->>'id', d->>'from'));
    end if;
    n := n + 1;
  end loop;
  if n > 0 then update creature set traits = v_traits, pedigree = v_ped where world_id = p_world and id = p_id; end if;
  return n;
end $fn$;

-- The husbandry a draw for one of yours is made by: its keeper's; nobody's for a wild one.
create or replace function keeper_husbandry(p_world uuid, c creature) returns double precision language sql stable as $fn$
  select case when c.keeper is null or c.mode = 'wild' then 0 else coalesce(skill_of(p_world, c.keeper, 'animal_husbandry'), 0) end
$fn$;

-- Every evolved one given the slots it is missing, by the same draw: what this migration does once, kept so the test
-- can hold it to the rule. How many traits it gave.
create or replace function open_missing_slots() returns int language plpgsql as $fn$
declare c creature; n int := 0;
begin
  for c in select cr.* from creature cr join species_def sd on sd.id = cr.species
            where sd.stages is not null and coalesce(array_length(cr.traits, 1), 0) < stage_slots(stage_of(cr)) and stage_of(cr) > 0
            order by cr.world_id, cr.id loop
    n := n + open_slots(c.world_id, c.id, 0, stage_of(c), keeper_husbandry(c.world_id, c));
  end loop;
  return n;
end $fn$;

-- One put out in the wild at a later stage: its stage's slots, by nobody's husbandry, before it is made as big as it.
create or replace function wild_stage_put(p_world uuid, p_id int) returns int language plpgsql as $fn$
declare c creature; v_stage int; v_skill text; v_at record;
begin
  if p_id is null then return null; end if;
  select * into c from creature where world_id = p_world and id = p_id;
  if not found or c.mode <> 'wild' then return p_id; end if;
  -- Rolled only for a kind that evolves, as the browser rolls.
  if (select sd.stages from species_def sd where sd.id = c.species) is null then return p_id; end if;
  v_stage := wild_stage_roll(c.species, random());
  v_skill := level_skill(c.species);
  if v_stage = 0 or v_skill is null then return p_id; end if;
  v_at := wild_stage_levels(v_stage);
  update creature set skills = coalesce(skills, '{}'::jsonb) || jsonb_build_object(v_skill, v_at.lo + random() * (v_at.hi - v_at.lo))
    where world_id = p_world and id = p_id;
  -- And the trait slots its stage has opened, each drawn as at an evolution (`open_slots`).
  perform open_slots(p_world, p_id, 0, v_stage, 0);
  select * into c from creature where world_id = p_world and id = p_id;
  update creature set name = kind_name_at(c), health = max_health(c) where world_id = p_world and id = p_id;
  return p_id;
end $fn$;

/* ---- Where each is read ------------------------------------------------------------------------------------------ */

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A gather, with its line's `more` on it.
    (1, 'worker_settle', $$      load := worker_do(p_world, p_id);
      select * into c from creature where world_id = p_world and id = p_id;
$$, $$      load := worker_do(p_world, p_id);
      select * into c from creature where world_id = p_world and id = p_id;
      -- And its line's own third-stage more of it (`perk_more`).
      load := perk_more(c, load);
$$),
    -- An ability's rest, less its line's `rest`.
    (2, 'beast_ability', $$    values (p_world, a.id, 'ability', 1, now() + make_interval(secs => ability_rest(v_ab)))$$,
                         $$    values (p_world, a.id, 'ability', 1, now() + make_interval(secs => ability_rest(v_ab) * (1 - perk_n(a, 'rest'))))$$),
    (3, 'beast_pounce', $$    values (p_world, c.id, 'ability', 1, now() + make_interval(secs => ability_rest(v_ab)))$$,
                        $$    values (p_world, c.id, 'ability', 1, now() + make_interval(secs => ability_rest(v_ab) * (1 - perk_n(c, 'rest'))))$$),
    -- A stun, its line's `stun` longer.
    (4, 'style_blow', $$perform enchant_stun(p_world, p_target);$$,
                      $$perform enchant_stun(p_world, p_target, stun_secs() + perk_n(a, 'stun'));$$),
    -- Shorn by you, and by a worker: its line's `wool` more.
    (5, 'perform_creature', $$      + floor(pk(p_world, p_uid, 'plus:' || coalesce(d.shear_yield, 'wool'), 0))::int;$$,
                            $$      + floor(pk(p_world, p_uid, 'plus:' || coalesce(d.shear_yield, 'wool'), 0))::int
      -- And its line's own third-stage wool (`perk_n`).
      + perk_n(c, 'wool')::int;$$),
    (6, 'errand_do', $$          v_n := greatest(1, round(o.fleece * case when v_yield = 'wool' then 3 else 6 end)::int);$$,
                     $$          v_n := greatest(1, round(o.fleece * case when v_yield = 'wool' then 3 else 6 end)::int)
            -- And its line's own third-stage wool (`perk_n`).
            + perk_n(o, 'wool')::int;$$),
    -- And at an evolution, a trait for each slot its new stage opens, by its keeper's husbandry.
    (7, 'worker_learn', $$        name = case when kind_named(c) then kind_name_at(c2) else name end
      where world_id = p_world and id = p_id;$$,
                        $$        name = case when kind_named(c) then kind_name_at(c2) else name end
      where world_id = p_world and id = p_id;
    -- And a trait for each slot the stage opens (`stage_slots`), by its keeper's husbandry (`open_slots`).
    perform open_slots(p_world, p_id, stage_of(c), stage_of(c2), keeper_husbandry(p_world, c));$$)
  ) as t(ord, fn, old, new) order by ord loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = r.fn;
    if v_def is null then raise exception '% is not on this island', r.fn; end if;
    v_n := (length(v_def) - length(replace(v_def, r.old, ''))) / length(r.old);
    if v_n <> 1 then raise exception '% has % of change %, not 1', r.fn, v_n, r.ord; end if;
    execute replace(v_def, r.old, r.new);
  end loop;
end $do$;

-- Every evolved one on the island now, given the slots it is missing, once.
select open_missing_slots();

select private.lock_doors();
