-- Evolved wildermon in the wild, rarely; and food quality matters.
--
-- Asked for: "When a wild one of an evolving kind is spawned, one time in WILD_STAGE_ODDS[0] = 20 it comes in at stage 2
-- (its level set to a random level in [EVOLVE_AT[0], EVOLVE_AT[1]) on its work/level skill), and one time in
-- WILD_STAGE_ODDS[1] = 200 at stage 3 (level in [EVOLVE_AT[1], EVOLVE_AT[1]+10)). It is named by its stage ..., drawn
-- at its stage, has the stage's stat multipliers", and "Taming it is harder: the taming skill it needs is tameLevel +
-- WILD_STAGE_TAME (= 15) per stage above the first, and its tame chance is tameChance × WILD_STAGE_CHANCE (= 0.5) per
-- stage." One stood up by the stocking (`creature_stock_block`, `creature_stock`) is rolled for (`wild_stage_put`, the
-- browser's `standWild`), and every check of taming -- an offering, its refusal, a trap's catch and its taking out, a
-- Call of the Wild -- reads what its stage asks (`tame_needs`, the browser's `tameNeeds`). The island sends a wild one's
-- skills now, so a browser names and draws it at its stage.
--
-- And: "when a tame wildermon eats a food item of quality q (0–100), it gets a learning bonus of FED_LEARN (= 0.2) ×
-- q/100 for FED_FOR (= one island hour) ..., replacing any smaller current bonus (no stacking: take the larger, refresh
-- the timer if equal or larger). If the food is the FIRST item of its diet list (its favourite), the bonus is doubled.
-- Grazing grass counts as quality 0 (no bonus)", and "each food item eaten adds FED_CARE (= 0.05) × q/100 to care
-- (clamped to 1)". Feeding put nothing into care before this, so that is all of it. A meal by hand (`perform_creature`)
-- and one out of the stores on a deed (`worker_feed`) go through `beast_fed`, which keeps the learning on the row
-- (`fed_bonus`, `fed_until`), and `beast_mul` reads it on the learning channel, so every gain a beast makes
-- (`worker_learn`) is that much more. Grazing puts nothing on, and nor does a bucket of whey, which is drunk. The
-- browser's `fedOn`, `fedNow`. The numbers come in with the definitions; these are what they are until then.

set local lock_timeout = '3s';

create or replace function wild_stage_odds_1() returns double precision language sql immutable as $fn$ select 20::double precision $fn$;
create or replace function wild_stage_odds_2() returns double precision language sql immutable as $fn$ select 200::double precision $fn$;
create or replace function wild_stage_tame() returns double precision language sql immutable as $fn$ select 15::double precision $fn$;
create or replace function wild_stage_chance() returns double precision language sql immutable as $fn$ select 0.5::double precision $fn$;
create or replace function wild_stage_span() returns double precision language sql immutable as $fn$ select 10::double precision $fn$;
create or replace function fed_learn() returns double precision language sql immutable as $fn$ select 0.2::double precision $fn$;
create or replace function fed_for() returns double precision language sql immutable as $fn$ select 9000::double precision $fn$;
create or replace function fed_favourite() returns double precision language sql immutable as $fn$ select 2::double precision $fn$;
create or replace function fed_care() returns double precision language sql immutable as $fn$ select 0.05::double precision $fn$;

-- Its favourite food, the first of its diet, which the definitions fill in (`favouriteOf`).
alter table species_def add column if not exists favourite text;
-- And a meal's learning on a beast, and when it runs out.
select private.shut('alter table creature add column if not exists fed_bonus double precision');
select private.shut('alter table creature add column if not exists fed_until timestamptz');

/* ---- Evolved in the wild ----------------------------------------------------------------------------------------- */

-- The skill a kind's level is: its trade's, its own for one with none, or what a draught beast keeps in the traces (`levelSkill`).
create or replace function level_skill(p_species text) returns text language sql stable as $fn$
  select coalesce((select g.skill from gather_def g where g.id = sd.gathers), sd.learns,
                  case when sd.draught then haul_skill() end)
    from species_def sd where sd.id = p_species
$fn$;

-- The stage one put out in the wild comes in at, off one roll: its third under one in `wild_stage_odds_2`, its second
-- under that and one in `wild_stage_odds_1`, its first otherwise; always its first for a kind that does not evolve (`wildStageRoll`).
create or replace function wild_stage_roll(p_species text, p_roll double precision) returns int language sql stable as $fn$
  select case when sd.stages is null then 0
              when p_roll < 1 / wild_stage_odds_2() then 2
              when p_roll < 1 / wild_stage_odds_2() + 1 / wild_stage_odds_1() then 1
              else 0 end
    from species_def sd where sd.id = p_species
$fn$;

-- The levels one put out at a stage may be at, the first in and the last out (`stageLevels`).
create or replace function wild_stage_levels(p_stage int, out lo double precision, out hi double precision) language sql immutable as $fn$
  select case when p_stage = 1 then evolve_at_1() else evolve_at_2() end,
         case when p_stage = 1 then evolve_at_2() else evolve_at_2() + wild_stage_span() end
$fn$;

-- One just put out in the country, of a kind that evolves: now and then already past its first stage, at a level in that
-- stage's span on the skill its level is, called and as big as that stage, as one that evolved is (`standWild`). Its id.
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
    where world_id = p_world and id = p_id returning * into c;
  update creature set name = kind_name_at(c), health = max_health(c) where world_id = p_world and id = p_id;
  return p_id;
end $fn$;

-- What it takes to win one over at its stage: its kind's taming and `wild_stage_tame` more for each stage past its
-- first, and its kind's base chance times `wild_stage_chance` for each (`tameNeeds`).
create or replace function tame_needs(c creature, out level double precision, out chance double precision) language sql stable as $fn$
  select sd.tame_level + wild_stage_tame() * stage_of(c), sd.tame_chance * wild_stage_chance() ^ stage_of(c)
    from species_def sd where sd.id = c.species
$fn$;

/* ---- Food quality matters ---------------------------------------------------------------------------------------- */

-- One of yours eats something: the learning it is worth replaces a smaller one still on it and starts its time again
-- (one as large starts it again too), a smaller one leaves it be; and its care goes up by `fed_care` at the top quality.
-- Its care is the one given where the caller holds it as it stands (`creature_settle`). A wild one is fed nothing by this (`fedOn`).
create or replace function beast_fed(p_world uuid, p_id int, p_item text, p_ql double precision, p_care double precision default null)
returns void language plpgsql as $fn$
declare v_q double precision := least(ql_top(), greatest(0, coalesce(p_ql, 0))); v_bonus double precision;
begin
  select fed_learn() * v_q / ql_top() * case when sd.favourite = p_item then fed_favourite() else 1 end into v_bonus
    from creature c join species_def sd on sd.id = c.species
   where c.world_id = p_world and c.id = p_id and c.mode <> 'wild';
  if not found then return; end if;
  update creature set
      fed_bonus = case when v_bonus > 0 and v_bonus >= case when fed_until > now() then coalesce(fed_bonus, 0) else 0 end
                       then v_bonus else fed_bonus end,
      fed_until = case when v_bonus > 0 and v_bonus >= case when fed_until > now() then coalesce(fed_bonus, 0) else 0 end
                       then now() + make_interval(secs => fed_for()) else fed_until end,
      care = least(1, coalesce(p_care, care) + fed_care() * v_q / ql_top())
    where world_id = p_world and id = p_id;
end $fn$;

-- What a deed worker eats out of the stores, with its care as the settle holds it (`p_care`): a meal, as before, and
-- what it is worth (`beast_fed`). The old two-argument one goes, as the new one answers the same call.
do $do$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'worker_feed' and p.pronargs = 2;
  if v_def is null then raise exception 'worker_feed(uuid, integer) is not on this island'; end if;
  v_old := 'public.worker_feed(p_world uuid, p_id integer)';
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'worker_feed has no one header'; end if;
  v_def := replace(v_def, v_old, 'public.worker_feed(p_world uuid, p_id integer, p_care double precision DEFAULT NULL::double precision)');
  v_old := $$  update creature set hunger = least(1, hunger + graze_fill())
    where world_id = p_world and id = p_id;
  return v_it.def;$$;
  v_new := $$  update creature set hunger = least(1, hunger + graze_fill())
    where world_id = p_world and id = p_id;
  -- And what it is worth to its learning and its care, by its quality (`beast_fed`).
  perform beast_fed(p_world, p_id, v_it.def, v_it.ql, p_care);
  return v_it.def;$$;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then raise exception 'worker_feed has no one meal'; end if;
  drop function worker_feed(uuid, integer);
  execute replace(v_def, v_old, v_new);
end $do$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- Taming at its stage (`tame_needs`): the chance an offering,
    (1, 'tame_chance', $$(d.tame_chance
      + (skill_of(p_world, p_uid, 'taming') - d.tame_level) / 200$$,
                       $$((tame_needs(c)).chance
      + (skill_of(p_world, p_uid, 'taming') - (tame_needs(c)).level) / 200$$, 1),
    -- the refusal,
    (2, 'creature_refusal', $$    if skill_of(p_world, p_uid, 'taming') < d.tame_level then
      return 'You need taming ' || to_char(d.tame_level, 'FM990.#') || ' to try.';$$,
                            $$    if skill_of(p_world, p_uid, 'taming') < (tame_needs(c)).level then
      return 'You need taming ' || to_char((tame_needs(c)).level, 'FM990.#') || ' to try.';$$, 1),
    -- how wary it is of a trap,
    (3, 'catch_chance', $$s.tame_level / (trap_holds(p) * 1.8)$$, $$(tame_needs(c)).level / (trap_holds(p) * 1.8)$$, 1),
    -- whether it is too much trap for,
    (4, 'trap_settle', $$    if s.tame_level > trap_holds(p) then$$, $$    if (tame_needs(v_best)).level > trap_holds(p) then$$, 1),
    -- taking it out of one,
    (5, 'trap_refusal', $$    if skill_of(p_world, p_uid, 'taming') < s.tame_level then
      return 'A ' || lower(s.name) || ' takes taming ' || to_char(s.tame_level, 'FM990')$$,
                        $$    if skill_of(p_world, p_uid, 'taming') < (tame_needs(c)).level then
      return 'A ' || lower(s.name) || ' takes taming ' || to_char((tame_needs(c)).level, 'FM990')$$, 1),
    (6, 'perform_trap', $$s.tame_level + 10, p.ql,$$, $$(tame_needs(c)).level + 10, p.ql,$$, 1),
    -- and a Call of the Wild.
    (7, 'class_spell_cast', $$    if coalesce(d.tame_level, 0) > skill_of(p_world, p_uid, 'taming') then
      return jsonb_build_object('why', 'The ' || lower(d.name) || ' wants ' || round(d.tame_level)::int || ' taming; you have '$$,
                            $$    if coalesce((tame_needs(c)).level, 0) > skill_of(p_world, p_uid, 'taming') then
      return jsonb_build_object('why', 'The ' || lower(d.name) || ' wants ' || round((tame_needs(c)).level)::int || ' taming; you have '$$, 1),

    -- One stood up in the country, now and then already past its first stage (`wild_stage_put`).
    (8, 'creature_stock_block', $$    perform creature_spawn(p_world, v_got, v_x + 0.5, v_y + 0.5, 'wild',
      now() - make_interval(secs => random() * 6 * 3600 * 1.6));$$,
                                $$    -- And now and then, of a kind that evolves, already past its first stage (`wild_stage_put`).
    perform wild_stage_put(p_world, creature_spawn(p_world, v_got, v_x + 0.5, v_y + 0.5, 'wild',
      now() - make_interval(secs => random() * 6 * 3600 * 1.6)));$$, 1),
    (9, 'creature_stock', $$    perform creature_spawn(p_world, got, gx + 0.5, gy + 0.5, 'wild',
      now() - make_interval(secs => random() * 6 * 3600 * 1.6));$$,
                          $$    -- And now and then, of a kind that evolves, already past its first stage (`wild_stage_put`).
    perform wild_stage_put(p_world, creature_spawn(p_world, got, gx + 0.5, gy + 0.5, 'wild',
      now() - make_interval(secs => random() * 6 * 3600 * 1.6)));$$, 1),

    -- A meal by hand is worth what its quality says (`beast_fed`); whey is drunk, not eaten.
    (10, 'perform_creature', $$      if not consume(p_world, p_uid, food, 1, v_fed.id) then return; end if;$$,
                             $$      if not consume(p_world, p_uid, food, 1, v_fed.id) then return; end if;
      -- What it eats is worth something to its learning and its care, by its quality (`beast_fed`).
      perform beast_fed(p_world, c.id, food, v_fed.ql);$$, 1),
    -- And one out of the stores, at the care the settle holds, which it reads back so the settle writes what the meal made of it.
    (11, 'creature_settle', $$    if worker_feed(p_world, p_id) is not null then
      c.hunger := least(1, c.hunger + graze_fill());$$,
                            $$    if worker_feed(p_world, p_id, c.care) is not null then
      c.hunger := least(1, c.hunger + graze_fill());
      select cr.care into c.care from creature cr where cr.world_id = p_world and cr.id = p_id;$$, 1),
    -- What a meal puts on its learning, while it lasts (`fedNow`).
    (12, 'beast_mul', $$       * case when p_channel in ('work', 'learn') then care_mul(c) else 1 end$$,
                      $$       * case when p_channel in ('work', 'learn') then care_mul(c) else 1 end
       -- And a good meal's learning, while it lasts (`beast_fed`).
       * case when p_channel = 'learn' and c.fed_until > now() then 1 + coalesce(c.fed_bonus, 0) else 1 end$$, 1),

    -- The browser hears what a meal is putting on one of yours, and a wild one's skills, so it names and draws one
    -- that came in past its first stage as it is.
    (13, 'rpc_creatures', $$           'care', c.care, 'xp', c.xp, 'skills', c.skills,$$,
                          $$           'care', c.care, 'xp', c.xp, 'skills', c.skills,
           -- What a meal is putting on its learning, and the seconds of it left (`beast_fed`).
           'fed', case when c.fed_until > now() then c.fed_bonus end,
           'fedLeft', case when c.fed_until > now() then extract(epoch from (c.fed_until - now())) end,$$, 1),
    (14, 'rpc_creatures', $$         else '{}'::jsonb end
      /*
       * And its pedigree,$$,
                          $$         else '{}'::jsonb end
      -- And a wild one's skills, which are its level and so its stage (`wild_stage_put`).
      || case when c.mode = 'wild' then jsonb_build_object('skills', c.skills) else '{}'::jsonb end
      /*
       * And its pedigree,$$, 1)
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
