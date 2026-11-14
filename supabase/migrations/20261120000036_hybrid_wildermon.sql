-- Hybrid wildermon.
--
-- Asked for: "50 hybrids to start. Each is a listed cross of two kinds whose trades go together"; "a listed cross
-- succeeds at 25% of the normal breed chance, needs the breeder's breeding skill >= 50 and both parents at >= 80%
-- care; otherwise the usual pairing rules"; "Two trades, one worker slot. A hybrid works both parents' trades, taking
-- whichever has work in reach ... at 75% of a pure-bred's speed in each, level the average"; "Infertile"; "Doesn't
-- evolve: born at the stage of the less-evolved parent and stays there"; "Hybrid vigour: +5% health"; "Pedigree shows
-- Hybrid: Kind A x Kind B"; "Hybrids never stand up wild".
--
-- The fifty kinds come in with the definitions (`species_def.hybrid_a`, `hybrid_b`, their two trades in `trades`; the
-- numbers `cross_chance`, `cross_skill`, `cross_care`, `hybrid_work`, `hybrid_hardy`), and none of them is in the wild
-- table. This is what they do, the same as the browser's (`hybridlist.ts`, `husbandry.ts`, `creatures.ts`):
--
--   * a mate is one of its own kind first, then one of a kind it makes a listed cross with (`mate_for`, `cross_of`);
--     a hybrid has none, and says it is infertile (`infertile_said`);
--   * a cross is refused short of the husbandry or either parent's care (`cross_refuses`), and takes at its share of
--     the pairing's chance (`pair_chance`); its young is the hybrid, at the less-evolved parent's stage, which its
--     pedigree keeps for good (`pair_them`, `drop_young`, `stage_of`);
--   * a hybrid's health is ×`hybrid_hardy` and its task speed ×`hybrid_work` (`hybrid_mul`, in `evo_mul`), its level the
--     mean of its two trades' skills (`creature_level`), its task skill the trade it is at (`task_skill`);
--   * at work, between jobs, it takes up its first trade, and with nothing of that in reach, its second; the trade it is
--     at is its `job`, so it counts as one worker at one trade (`worker_settle`, `errand_*`);
--   * a birth of one marks its page tamed and bred (`drop_young`);
--   * a Stud Book says what a cross throws and its odds (`stud_book`).

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

/* ---- the rules ------------------------------------------------------------------------------------------------------ */

-- The hybrid two kinds make, either way round; none for one kind, or a pair not listed (`crossOf`).
create or replace function cross_of(p_a text, p_b text) returns text language sql stable as $fn$
  select d.id from species_def d
   where p_a <> p_b and ((d.hybrid_a = p_a and d.hybrid_b = p_b) or (d.hybrid_a = p_b and d.hybrid_b = p_a))
   limit 1
$fn$;

-- Whether a kind is a hybrid.
create or replace function hybrid_kind(p_species text) returns boolean language sql stable as $fn$
  select coalesce((select d.hybrid_a is not null from species_def d where d.id = p_species), false)
$fn$;

-- What a hybrid says when it is put to a mate (`infertileSays`).
create or replace function infertile_said(p_name text) returns text language sql immutable as $fn$
  select p_name || ': hybrid, infertile.'
$fn$;

-- The odds a pairing takes: `breed_chance`, and `cross_chance` of it for a listed cross (`pairChance`).
create or replace function pair_chance(p_skill double precision, p_care double precision, p_cross boolean) returns double precision
language sql immutable as $fn$
  select breed_chance(p_skill, p_care) * case when p_cross then cross_chance() else 1 end
$fn$;

-- Why a listed cross will not be tried, or null: the breeder's husbandry and each parent's care (`crossRefuses`).
create or replace function cross_refuses(p_world uuid, p_uid uuid, a creature, b creature) returns text
language plpgsql stable as $fn$
declare v_skill double precision; c creature;
begin
  if cross_of(a.species, b.species) is null then return null; end if;
  v_skill := skill_of(p_world, p_uid, 'animal_husbandry');
  if v_skill < cross_skill() then
    return 'Cross: animal husbandry ' || cross_skill()::int || ' needed, yours ' || floor(v_skill)::int || '.';
  end if;
  foreach c in array array[a, b] loop
    if c.care < cross_care() then
      return 'Cross: care ' || round((cross_care() * 100)::numeric)::int || '% each needed, ' || c.name || ' '
        || round((c.care * 100)::numeric)::int || '%.';
    end if;
  end loop;
  return null;
end $fn$;

-- What being a hybrid does to a channel of its blood: health ×`hybrid_hardy`, task speed ×`hybrid_work` (`hybridMul`).
create or replace function hybrid_mul(p_channel text) returns double precision language sql immutable as $fn$
  select case p_channel when 'hardy' then hybrid_hardy() when 'work' then hybrid_work() else 1 end::double precision
$fn$;

-- The mate standing nearest: its own kind before a listed cross, the nearer of two of the same; none for a hybrid.
create or replace function mate_for(p_world uuid, c creature) returns creature language sql stable as $fn$
  select o.* from creature o
  where o.world_id = p_world and o.id <> c.id and o.sex <> c.sex
    and not hybrid_kind(c.species)
    and (o.species = c.species or cross_of(c.species, o.species) is not null)
    and o.mode in ('active', 'deed') and o.due is null
    and sqrt((creature_x(o) - creature_x(c)) ^ 2 + (creature_y(o) - creature_y(c)) ^ 2) <= pair_range()
  order by (o.species <> c.species),
           sqrt((creature_x(o) - creature_x(c)) ^ 2 + (creature_y(o) - creature_y(c)) ^ 2), o.id
  limit 1
$fn$;

-- A hybrid stays at the stage its pedigree was born with; anything else at its level's (`stageOf`).
create or replace function stage_of(c creature) returns integer language plpgsql stable as $fn$
begin
  if c.pedigree ? 'stage' then return greatest(0, least(2, (c.pedigree->>'stage')::int)); end if;
  return (
select case when (select sd.stages from species_def sd where sd.id = c.species) is null then 0
              else (select case when l.v >= evolve_at_2() then 2 when l.v >= evolve_at_1() then 1 else 0 end
                      from (select creature_level(c.skills, c.species) as v offset 0) l) end
  );
end $fn$;

-- What its stage makes of it, for a kind that evolves (`evo_mul`), and what being a hybrid does (`hybrid_mul`): only a
-- hybrid's pedigree carries a stage.
select pg_temp.patch_fn('public.evo_mul(creature,text)'::regprocedure,
  $o$    else case when stage_of(c) >= perk_stage() then evo_perk(c, p_channel) else 1 end
  end::double precision$o$,
  $n$    else case when stage_of(c) >= perk_stage() then evo_perk(c, p_channel) else 1 end
  end::double precision
  -- And a hybrid's vigour and pace (`hybrid_mul`).
  * case when c.pedigree ? 'stage' then hybrid_mul(p_channel) else 1 end$n$);

-- What its kind is called at its stage: a hybrid's name at every stage, having no stages of its own (`kindName`).
create or replace function kind_name_at(c creature) returns text language plpgsql stable as $fn$
begin
  return (
select case when stage_of(c) = 0 or sd.stages is null then sd.name else sd.stages[stage_of(c)] end from species_def sd where sd.id = c.species
  );
end $fn$;

-- A hybrid's level: the mean of its two trades' skills, one for a skill it has none of yet (`hybridLevel`).
create or replace function creature_level(p_skills jsonb, p_species text) returns integer language plpgsql stable as $fn$
declare v_sk text[];
begin
  select array(select g.skill from unnest(d.trades) with ordinality t(id, n) join gather_def g on g.id = t.id order by t.n)
    into v_sk from species_def d where d.id = p_species and d.hybrid_a is not null;
  if coalesce(array_length(v_sk, 1), 0) = 2 then
    return greatest(1, floor((coalesce((p_skills->>v_sk[1])::numeric, 1) + coalesce((p_skills->>v_sk[2])::numeric, 1)) / 2))::int;
  end if;
  return (
select greatest(1, floor(coalesce(case when ls.skill is null then (select max(value::numeric) from jsonb_each_text(p_skills))
                                         else (p_skills->>ls.skill)::numeric end, 0)))::int
    from (select level_skill(p_species) as skill offset 0) ls
  );
end $fn$;

-- Its task skill: its kind's trade's, and a hybrid's the trade it is at (`taskSkill`).
create or replace function task_skill(c creature) returns double precision language plpgsql stable as $fn$
begin
  return (
select coalesce((c.skills->>(select g.skill from gather_def g where g.id =
    (select case when sd.hybrid_a is not null then coalesce(c.job, sd.gathers) else sd.gathers end
       from species_def sd where sd.id = c.species)))::double precision, 1)
  );
end $fn$;

-- A hybrid will not be put to a mate.
select pg_temp.patch_fn('public.pair_refuses(uuid,creature,creature)'::regprocedure,
  $o$begin
  foreach c in array array[a, b] loop$o$,
  $n$begin
  foreach c in array array[a, b] loop
    if hybrid_kind(c.species) then return infertile_said(c.name); end if;
  end loop;
  foreach c in array array[a, b] loop$n$);

/* ---- the pairing ---------------------------------------------------------------------------------------------------- */

select pg_temp.patch_fn('public.last_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    if c.due is not null then return c.name || ' is already pregnant.'; end if;
    mate := mate_for(p_world, c);$o$,
  $n$    if c.due is not null then return c.name || ' is already pregnant.'; end if;
    if hybrid_kind(c.species) then return infertile_said(c.name); end if;
    mate := mate_for(p_world, c);$n$);
select pg_temp.patch_fn('public.last_refusal(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    return pair_refuses(p_world, c, mate);$o$,
  $n$    return coalesce(pair_refuses(p_world, c, mate), cross_refuses(p_world, p_uid, c, mate));$n$);

select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    if c.world_id is null or mate.id is null or pair_refuses(p_world, c, mate) is not null then return; end if;$o$,
  $n$    if c.world_id is null or mate.id is null or pair_refuses(p_world, c, mate) is not null
       or cross_refuses(p_world, p_uid, c, mate) is not null then return; end if;$n$);
select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    v_took := random() < breed_chance(v_skill, v_care);$o$,
  $n$    v_took := random() < pair_chance(v_skill, v_care, cross_of(dam.species, sire.species) is not null);$n$);
select pg_temp.patch_fn('public.perform_last(uuid,uuid,text,jsonb)'::regprocedure,
  $o$    perform wtell(p_world, p_uid, 'Paired: ' || sire.name || ' with ' || dam.name$o$,
  $n$    perform wtell(p_world, p_uid, 'Paired: ' || sire.name || ' with ' || dam.name
      || coalesce(' (cross: ' || (select x.name from species_def x where x.id = cross_of(dam.species, sire.species)) || ')', '')$n$);

-- A cross's young: its hybrid kind, and the stage it stays at.
select pg_temp.patch_fn('public.pair_them(uuid,integer,integer,double precision,uuid,text)'::regprocedure,
  $o$                          dam.traits, dam.pedigree->'line', sire.traits, sire.pedigree->'line'))
        -- And its parents' forms$o$,
  $n$                          dam.traits, dam.pedigree->'line', sire.traits, sire.pedigree->'line'))
        -- A listed cross's young: its hybrid kind, at its less-evolved parent's stage for good (`cross_of`, `stage_of`).
        || coalesce((select jsonb_build_object('species', x.id, 'stage', least(stage_of(dam), stage_of(sire)))
                       from species_def x where x.id = cross_of(dam.species, sire.species)), '{}'::jsonb)
        -- And its parents' forms$n$);

select pg_temp.patch_fn('public.give_birth(uuid,integer)'::regprocedure,
  $o$(v_coming->'twin') || jsonb_build_object('sire', v_coming->'sire')$o$,
  $n$(v_coming->'twin') || jsonb_build_object('sire', v_coming->'sire')
      || jsonb_strip_nulls(jsonb_build_object('species', v_coming->'species', 'stage', v_coming->'stage'))$n$);

select pg_temp.patch_fn('public.drop_young(uuid,creature,jsonb)'::regprocedure,
  $o$  select * into v_d from species_def where id = v_dam.species;$o$,
  $n$  -- A cross's young is its hybrid kind (`pair_them`).
  select * into v_d from species_def where id = coalesce(p_coming->>'species', v_dam.species);$n$);
select pg_temp.patch_fn('public.drop_young(uuid,creature,jsonb)'::regprocedure,
  $o$  v_born := creature_spawn(p_world, v_dam.species, v_nx, v_ny,$o$,
  $n$  v_born := creature_spawn(p_world, v_d.id, v_nx, v_ny,$n$);
select pg_temp.patch_fn('public.drop_young(uuid,creature,jsonb)'::regprocedure,
  $o$        'from', coalesce(v_coming->'from', '{}'::jsonb))
        || case when v_coming ? 'line'$o$,
  $n$        'from', coalesce(v_coming->'from', '{}'::jsonb))
        -- A hybrid's stage, for good (`stage_of`).
        || case when v_coming ? 'stage' then jsonb_build_object('stage', (v_coming->>'stage')::int) else '{}'::jsonb end
        || case when v_coming ? 'line'$n$);
select pg_temp.patch_fn('public.drop_young(uuid,creature,jsonb)'::regprocedure,
  $o$                       v_dam.species, 1);$o$,
  $n$                       v_d.id, 1);$n$);
select pg_temp.patch_fn('public.drop_young(uuid,creature,jsonb)'::regprocedure,
  $o$    if v_dam.mode <> 'wild' then perform guide_mark(p_world, v_dam.keeper, v_dam.species, 'bred'); end if;$o$,
  $n$    if v_dam.mode <> 'wild' then perform guide_mark(p_world, v_dam.keeper, v_d.id, 'bred'); end if;
    -- A hybrid is never wild, so never tamed: one born to a dam you keep marks its page tamed as well.
    if v_dam.mode <> 'wild' and v_d.hybrid_a is not null then perform guide_mark(p_world, v_dam.keeper, v_d.id, 'tamed'); end if;$n$);

-- What a Stud Book says of a pairing, and of a listed cross what it throws and its own odds (`studBook`, `crossLine`).
create or replace function stud_book(p_world uuid, p_uid uuid, c creature) returns text language plpgsql stable as $fn$
declare mate creature; v_skill double precision; v_care double precision; x species_def;
begin
  if pk(p_world, p_uid, 'stud_book', 0) <= 0 or c.keeper is distinct from p_uid or c.mode not in ('active', 'deed') then
    return '';
  end if;
  mate := mate_for(p_world, c);
  if mate.id is null then return ''; end if;
  v_skill := skill_of(p_world, p_uid, 'animal_husbandry');
  v_care := (c.care + mate.care) / 2;
  select * into x from species_def where id = cross_of(c.species, mate.species);
  return ' Paired with ' || mate.name || ': '
    || case when x.id is null then 'success ' || round((breed_chance(v_skill, v_care) * 100)::numeric)::int || '%'
            else 'Cross: ' || x.name || ' (' || (select a.name from species_def a where a.id = x.hybrid_a) || ' × '
              || (select b.name from species_def b where b.id = x.hybrid_b) || '), success '
              || round((pair_chance(v_skill, v_care, true) * 100)::numeric)::int || '% ('
              || round((cross_chance() * 100)::numeric)::int || '% of ' || round((breed_chance(v_skill, v_care) * 100)::numeric)::int
              || '%); born at stage ' || (least(stage_of(c), stage_of(mate)) + 1) || ', stays there' end
    || '; each of ' || trait_slots() || ' traits inherited '
    || round((keep_chance(v_skill, v_care, pk(p_world, p_uid, 'breed:inherit', 0), pair_fresh(c, mate)) * 100)::numeric)::int
    || '%, rarity-up '
    || round((least(1, upgrade_chance(v_skill, v_care) + pk(p_world, p_uid, 'breed:upgrade', 0)) * 100)::numeric)::int
    || '%.';
end $fn$;

/* ---- at work -------------------------------------------------------------------------------------------------------- */

-- An errand reads the trade it is at, which a hybrid's job is (a kind of one trade has none but its own).
select pg_temp.patch_fn('public.errand_step(uuid,integer,text)'::regprocedure,
  $o$  kind := coalesce(p_kind, d.gathers);$o$, $n$  kind := coalesce(p_kind, c.job, d.gathers);$n$);
select pg_temp.patch_fn('public.errand_do(uuid,integer,boolean,text)'::regprocedure,
  $o$  kind := coalesce(p_kind, d.gathers);$o$, $n$  kind := coalesce(p_kind, c.job, d.gathers);$n$);
select pg_temp.patch_fn('public.errand_go(uuid,integer,text)'::regprocedure,
  $o$  v_kind := coalesce(p_kind, (select sd.gathers from species_def sd where sd.id = c.species));$o$,
  $n$  v_kind := coalesce(p_kind, c.job, (select sd.gathers from species_def sd where sd.id = c.species));$n$);
select pg_temp.patch_fn('public.errand_fetch_n(uuid,creature)'::regprocedure,
  $o$  v_kind := (select sd.gathers from species_def sd where sd.id = c.species);$o$,
  $n$  v_kind := coalesce(c.job, (select sd.gathers from species_def sd where sd.id = c.species));$n$);

/*
 * A hybrid at work (`hybridTurn`): between jobs, idle with its arms empty, its first trade; with nothing of that in
 * reach -- no errand to run, no tile to work -- its second, once a pass. Mid-job, the trade it is at. Whichever it is
 * at is its `job`, written down as it changes, which the errands and the trade counts read.
 */
select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$        v_vine boolean := false; -- a bush picker planting vines$o$,
  $n$        v_vine boolean := false; -- a bush picker planting vines
        v_hy_tried boolean := false; -- a hybrid that has looked for its second trade's work$n$);
select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$    v_lv := null; v_routed := false;
    for v_once in 1..1 loop$o$,
  $n$    v_lv := null; v_routed := false;
    for v_once in 1..1 loop
    if d.hybrid_a is not null then
      if c.phase <> 'idle' or c.carrying is not null or c.fetching is not null then
        v_hy_tried := false;
      elsif not v_hy_tried and kind is distinct from d.trades[1] then
        kind := d.trades[1]; c.job := kind;
        update creature set job = kind where world_id = p_world and id = p_id;
      end if;
    end if;$n$);
select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$        if step.gx is null then
          -- Nothing to run. Replaying an afternoon of that produces nothing.$o$,
  $n$        if step.gx is null then
          if d.hybrid_a is not null and not v_hy_tried and c.carrying is null and not v_vine then
            v_hy_tried := true;
            kind := case when kind = d.trades[1] then d.trades[2] else d.trades[1] end; c.job := kind;
            update creature set job = kind where world_id = p_world and id = p_id;
            continue;
          end if;
          -- Nothing to run. Replaying an afternoon of that produces nothing.$n$);
select pg_temp.patch_fn('public.worker_settle(uuid,integer)'::regprocedure,
  $o$      if spot.x is null then
        -- Nothing of its trade anywhere it can reach.$o$,
  $n$      if spot.x is null and d.hybrid_a is not null and not v_hy_tried and c.carrying is null then
        v_hy_tried := true;
        kind := case when kind = d.trades[1] then d.trades[2] else d.trades[1] end; c.job := kind;
        update creature set job = kind where world_id = p_world and id = p_id;
        continue;
      end if;
      if spot.x is null then
        -- Nothing of its trade anywhere it can reach.$n$);

select private.lock_doors();
