-- Traits part B: eight traits on eight new channels, read where each rule lives.
--
--   stamina    goes before it tires (`tire_goes`): `tire_of`, in `worker_settle` and `spar_may`
--   rest       its rest once tired (`rest_for`): `rest_of`, in `worker_settle`
--   gestation  how long a dam carries (`gestation`): `gestation_of`, in `pair_them` and the "Paired" line
--   twins      a dam's young per birth; past one, the chance of a second young: `twin_chance`, in `pair_them`
--   mutate     the chance of a mutation in a pair's young, the better parent's: `pair_mutate`, into `breed_traits`
--   fresh      the chance a young one's trait is a fresh draw, the better parent's: `pair_fresh`, into `breed_traits`
--   carefade   how fast a brushing wears off (`care_hours`): in `creature_settle`
--   food       what a meal below the top quality loses: `meal_ql`, in `beast_fed`
--
-- Every channel is read through `beast_mul`, as every channel is, as the browser's `bloodMul` reads it; none of them is
-- in the blood (`channel_def.blood`, part C's migration), so neither a rarity nor a line moves it. The defs (traits,
-- effects, channel rows) come in the defs migration.
set local lock_timeout = '3s';

-- Its goes before it tires: `tire_goes` as its blood makes it, to the nearest whole go (`tireOf`).
create or replace function tire_of(c creature) returns int language sql stable as $fn$
  select round(round((tire_goes() * beast_mul(c, 'stamina'))::numeric, 4))::int
$fn$;

-- How long it rests, out of a bed: `rest_for` as its blood makes it (`restFor`).
create or replace function rest_of(c creature) returns double precision language sql stable as $fn$
  select rest_for() * beast_mul(c, 'rest')
$fn$;

-- How long a dam carries: `gestation`, a breeder's Quick Gestation and her blood (`gestationOf`).
create or replace function gestation_of(p_perk double precision, dam creature) returns double precision language sql stable as $fn$
  select gestation() * p_perk * beast_mul(dam, 'gestation')
$fn$;

-- The chance a covering throws a second young: one young and a breeder's Twins, times the dam's blood, past one (`twinChance`).
create or replace function twin_chance(p_perk double precision, dam creature) returns double precision language sql stable as $fn$
  select greatest(0, least(1, (1 + p_perk) * beast_mul(dam, 'twins') - 1))
$fn$;

-- The better parent's on each breeding channel (`pairBlood`).
create or replace function pair_fresh(a creature, b creature) returns double precision language sql stable as $fn$
  select least(beast_mul(a, 'fresh'), beast_mul(b, 'fresh'))
$fn$;
create or replace function pair_mutate(a creature, b creature) returns double precision language sql stable as $fn$
  select greatest(beast_mul(a, 'mutate'), beast_mul(b, 'mutate'))
$fn$;

-- The chance a slot is drawn from the pair: husbandry, care and perks, with the pair's `fresh` on the rest (`keepChance`).
create or replace function keep_chance(p_husbandry double precision, p_care double precision, p_plus double precision,
                                       p_fresh double precision) returns double precision language sql stable as $fn$
  select case when p_fresh = 1 then k.keep else least(1, 1 - (1 - k.keep) * p_fresh) end
    from (select least(1, inherit_chance(p_husbandry, p_care) + p_plus) as keep) k
$fn$;

-- The chance a young one is born with a mutation, with the pair's `mutate` on it (`mutationChance`).
create or replace function mutation_chance(p_mutate double precision) returns double precision language sql stable as $fn$
  select least(1, p_mutate / mutation_odds())
$fn$;

-- The quality a meal counts for to one of yours: its shortfall from the top as its blood makes it (`mealQuality`).
create or replace function meal_ql(c creature, p_ql double precision) returns double precision language sql stable as $fn$
  select ql_top() - (ql_top() - least(ql_top(), greatest(0, coalesce(p_ql, 0)))) * beast_mul(c, 'food')
$fn$;

-- Each existing rule patched where it reads the number, every anchor exactly once.
create or replace function pg_temp.b_patch(p_fn regprocedure, p_pairs text[]) returns text language plpgsql as $fn$
declare v_def text := pg_get_functiondef(p_fn); i int;
begin
  for i in 1 .. array_length(p_pairs, 1) / 2 loop
    if (length(v_def) - length(replace(v_def, p_pairs[2 * i - 1], ''))) / length(p_pairs[2 * i - 1]) <> 1 then
      raise exception '%: anchor % not found exactly once', p_fn, i;
    end if;
    v_def := replace(v_def, p_pairs[2 * i - 1], p_pairs[2 * i]);
  end loop;
  return v_def;
end $fn$;

do $do$
declare v_def text;
begin
  -- A worker's stamina, read once a settle, and its rest.
  execute pg_temp.b_patch('worker_settle(uuid, int)'::regprocedure, array[
    $a$v_made int[];$a$, $a$v_made int[]; v_tire int;$a$,
    $a$          * (1 + greatest(1, task_skill(c)) / 500);
$a$, $a$          * (1 + greatest(1, task_skill(c)) / 500);
  -- Its goes before it tires, as its blood makes them (`tire_of`).
  v_tire := tire_of(c);
$a$,
    $a$c.worn >= tire_goes()$a$, $a$c.worn >= v_tire$a$,
    $a$make_interval(secs => rest_for() * bed_rest())$a$, $a$make_interval(secs => rest_of(c) * bed_rest())$a$,
    $a$make_interval(secs => rest_for());$a$, $a$make_interval(secs => rest_of(c));$a$]);

  execute pg_temp.b_patch('spar_may(uuid, creature, creature, int, int)'::regprocedure, array[
    $a$g.worn >= tire_goes()$a$, $a$g.worn >= tire_of(g)$a$]);

  -- A brushing wears off as its blood makes it; nothing is looked up for one with no care left.
  execute pg_temp.b_patch('creature_settle(uuid, int)'::regprocedure, array[
    $a$c.care := greatest(0, c.care - elapsed / (coalesce($a$,
    $a$c.care := greatest(0, c.care - elapsed * case when c.care > 0 then beast_mul(c, 'carefade') else 1 end / (coalesce($a$]);

  -- A meal counts for the quality its blood makes of it, to its learning and its care.
  execute pg_temp.b_patch('beast_fed(uuid, int, text, double precision, double precision)'::regprocedure, array[
    $a$  select fed_learn() * v_q / ql_top() * case when sd.favourite = p_item then fed_favourite() else 1 end into v_bonus$a$,
    $a$  select meal_ql(c, p_ql), fed_learn() * meal_ql(c, p_ql) / ql_top() * case when sd.favourite = p_item then fed_favourite() else 1 end
    into v_q, v_bonus$a$]);

  -- The draw: the pair's `fresh` on the chance a slot is theirs, and the pair's `mutate` on a mutation.
  v_def := pg_temp.b_patch('breed_traits(text[], text[], double precision, double precision, double precision, double precision, text[])'::regprocedure, array[
    $a$p_copy text[] DEFAULT '{}'::text[])$a$,
    $a$p_copy text[] DEFAULT '{}'::text[], p_fresh double precision DEFAULT 1, p_mutate double precision DEFAULT 1)$a$,
    $a$keep := least(1, inherit_chance(p_husbandry, p_care) + p_keep_plus);$a$,
    $a$keep := keep_chance(p_husbandry, p_care, p_keep_plus, p_fresh);$a$,
    $a$if random() < 1.0 / mutation_odds() then$a$, $a$if random() < mutation_chance(p_mutate) then$a$]);
  drop function breed_traits(text[], text[], double precision, double precision, double precision, double precision, text[]);
  execute v_def;

  -- A covering: the pair's blood into the draw, the dam's into twins and her time.
  execute pg_temp.b_patch('pair_them(uuid, int, int, double precision, uuid, text)'::regprocedure, array[
    $a$v_copy text[]; v_m creature;$a$, $a$v_copy text[]; v_m creature; v_fresh double precision; v_mutate double precision;$a$,
    $a$  v_copy := mirror_copy(dam, sire);
$a$, $a$  v_copy := mirror_copy(dam, sire);
  -- And what the pair's blood does to the draw (`pair_fresh`, `pair_mutate`).
  v_fresh := pair_fresh(dam, sire);
  v_mutate := pair_mutate(dam, sire);
$a$,
    $a$v_bred := breed_traits(sire.traits, dam.traits, p_husbandry, v_care, v_keep, v_up, v_copy);$a$,
    $a$v_bred := breed_traits(sire.traits, dam.traits, p_husbandry, v_care, v_keep, v_up, v_copy, v_fresh, v_mutate);$a$,
    $a$v_twin := breed_traits(sire.traits, dam.traits, p_husbandry, v_care, v_keep, v_up, v_copy);$a$,
    $a$v_twin := breed_traits(sire.traits, dam.traits, p_husbandry, v_care, v_keep, v_up, v_copy, v_fresh, v_mutate);$a$,
    $a$if random() < pk(p_world, p_uid, 'breed:twins', 0) then$a$,
    $a$if random() < twin_chance(pk(p_world, p_uid, 'breed:twins', 0), dam) then$a$,
    $a$make_interval(secs => gestation() * pk(p_world, p_uid, 'breed:gestation', 1))$a$,
    $a$make_interval(secs => gestation_of(pk(p_world, p_uid, 'breed:gestation', 1), dam))$a$]);

  -- The "Paired" line says when, off her blood too.
  execute pg_temp.b_patch('perform_last(uuid, uuid, text, jsonb)'::regprocedure, array[
    $a$clock_left(gestation() * pk(p_world, p_uid, 'breed:gestation', 1))$a$,
    $a$clock_left(gestation_of(pk(p_world, p_uid, 'breed:gestation', 1), dam))$a$]);

  -- A Stud Book's "inherited" off the pair's blood too.
  execute pg_temp.b_patch('stud_book(uuid, uuid, creature)'::regprocedure, array[
    $a$least(1, inherit_chance(v_skill, v_care) + pk(p_world, p_uid, 'breed:inherit', 0))$a$,
    $a$keep_chance(v_skill, v_care, pk(p_world, p_uid, 'breed:inherit', 0), pair_fresh(c, mate))$a$]);
end $do$;

drop function pg_temp.b_patch(regprocedure, text[]);

select private.lock_doors();
