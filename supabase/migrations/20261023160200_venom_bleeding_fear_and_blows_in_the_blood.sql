set local lock_timeout = '3s';

-- Six traits for a fight, on six channels of their own (`src/game/traits.ts`, part D).
--
--   venom     venom drain on it (`enchant_venom`): venom-proof, ×0, takes none;
--   bleed     health it loses a second to a bleed, venom and burns included (`creature_settle`): quick-clotting, in four
--             grades;
--   fear      how long a Whispet's Fear makes it flee (`beast_ability`): fearless, ×0, is never frightened;
--   heavy     its chance a blow lands as a heavy blow, `heavy_hit` as hard (`creature_attack`): crushing, in four grades;
--   rip       its chance a blow bleeds what it hits as a knife does (`creature_attack`): ripping, in four grades;
--   cooldown  seconds between goes at its ability (`beast_ability`, `beast_pounce`): quick-recovering.
--
-- Each is read off the creature's blood as every fight rule reads it (`beast_mul`). A chance channel is the points its
-- traits put over one, lifted as the rest of its blood lifts them (`beast_chance`, the browser's `chance`). The traits
-- and channels themselves come in with the definitions.

-- A chance its traits give on a channel that is a chance: the points their figure is over one, as the rest of its blood
-- lifts that figure; nought where its traits put it at one or below. The browser's `chance`. PL/pgSQL, so that a blow by
-- one with no such trait costs one `trait_mul` and nothing more: the SQL form was planned afresh on every blow.
create or replace function beast_chance(c creature, p_channel text) returns double precision language plpgsql stable as $fn$
declare t double precision := trait_mul(c.traits, p_channel);
begin
  if t <= 1 then return 0; end if;
  return (t - 1) * beast_mul(c, p_channel) / t;
end $fn$;

do $do$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    -- A trait at nought (venom-proof, fearless) multiplies to nought: a logarithm of it is no number. `trait_mul` and
    -- `trait_worth` take it already (part C's migration); the herd's aura too.
    ('deed_aura_of', 'exp(sum(ln(e.mul)))', 'case when bool_or(e.mul = 0) then 0 else exp(sum(ln(nullif(e.mul, 0)))) end', 1),
    -- Venom, as much as its blood's `venom` lets in: none, for one that is venom-proof.
    ('enchant_venom', $a$  v_rate := max_health(c) * venom_drain();
$a$, $a$  -- As much as its blood's `venom` lets in: none, for one that is venom-proof.
  v_rate := max_health(c) * venom_drain() * beast_mul(c, 'venom');
  if v_rate <= 0 then return; end if;
$a$, 1),
    -- A bleed, as much of it as its blood's `bleed` lets out.
    ('creature_settle', 'c.health - coalesce(c.bleed_rate, 0) * v_bled', 'c.health - coalesce(c.bleed_rate, 0) * beast_mul(c, ''bleed'') * v_bled', 1),
    -- A Fear, as long as its blood's `fear` lets it run: never, for one that is fearless.
    ('beast_ability', 'declare v_ab text;', 'declare v_fear double precision; v_ab text;', 1),
    ('beast_ability', $a$    if coalesce(td.monster, false) or t.mode <> 'wild' or beast_mark(p_world, t.id, 'fear', 0) > 0 then return null; end if;
    perform flee_from(p_world, t.id, creature_x(a), creature_y(a), fear_secs());
    insert into class_mark (world_id, creature_id, kind, val, until, by_uid)
      values (p_world, t.id, 'fear', 1, now() + make_interval(secs => fear_secs()), a.keeper)
$a$, $a$    v_fear := fear_secs() * beast_mul(t, 'fear');
    if coalesce(td.monster, false) or v_fear <= 0 or t.mode <> 'wild' or beast_mark(p_world, t.id, 'fear', 0) > 0 then return null; end if;
    perform flee_from(p_world, t.id, creature_x(a), creature_y(a), v_fear);
    insert into class_mark (world_id, creature_id, kind, val, until, by_uid)
      values (p_world, t.id, 'fear', 1, now() + make_interval(secs => v_fear), a.keeper)
$a$, 1),
    -- Its ability's rest, and its blood's `cooldown` on it.
    ('beast_ability', $a$ability_rest(v_ab) * (1 - perk_n(a, 'rest'))$a$, $a$ability_rest(v_ab) * (1 - perk_n(a, 'rest')) * beast_mul(a, 'cooldown')$a$, 1),
    ('beast_pounce', $a$ability_rest(v_ab) * (1 - perk_n(c, 'rest'))$a$, $a$ability_rest(v_ab) * (1 - perk_n(c, 'rest')) * beast_mul(c, 'cooldown')$a$, 1),
    -- A heavy blow and a bleed, each at its blood's chance.
    ('creature_attack', 'declare a creature;', 'declare v_chance double precision; a creature;', 1),
    ('creature_attack', $a$  v_died := wound_beast(p_world, p_target, v_dmg,$a$, $a$  -- A heavy blow, at its blood's chance (`heavy`): `heavy_hit` as hard. The dice are thrown only for one that has a chance.
  v_chance := beast_chance(a, 'heavy');
  if v_chance > 0 then
    if random() < v_chance then v_dmg := v_dmg * heavy_hit(); end if;
  end if;
  v_died := wound_beast(p_world, p_target, v_dmg,$a$, 1),
    ('creature_attack', $a$  if not v_died then perform style_blow(p_world, a, p_target, v_dmg); end if;
$a$, $a$  if not v_died then perform style_blow(p_world, a, p_target, v_dmg); end if;
  -- And a bleed, at its blood's chance (`rip`), as a knife opens it; a kind whose bites bleed already bleeds it.
  if not v_died and (a.mode = 'wild' or d.style is distinct from 'bleed') then
    v_chance := beast_chance(a, 'rip');
    if v_chance > 0 then
      if random() < v_chance then
        update creature set bleed_rate = greatest(coalesce(bleed_rate, 0), v_dmg * knife_bleed()),
            bleed_until = now() + make_interval(secs => knife_bleed_secs())
          where world_id = p_world and id = p_target and health > 0;
      end if;
    end if;
  end if;
$a$, 1)
  ) as t(fn, anchor, now, want) loop
    v_def := pg_get_functiondef(r.fn::regproc);
    v_n := (length(v_def) - length(replace(v_def, r.anchor, ''))) / length(r.anchor);
    if v_n <> r.want then raise exception '% has % of its anchor, not %: %', r.fn, v_n, r.want, r.anchor; end if;
    execute replace(v_def, r.anchor, r.now);
  end loop;
end $do$;

select private.lock_doors();
