/**
 * Hybrid wildermon.
 *
 * Asked for: "50 hybrids to start. Each is a listed cross of two kinds whose trades go together"; "a listed cross
 * succeeds at 25% of the normal breed chance, needs the breeder's breeding skill >= 50 and both parents at >= 80% care;
 * otherwise the usual pairing rules. mateFor and the Stud Book preview offer the cross and state its odds"; "Two trades,
 * one worker slot ... taking whichever has work in reach ... at 75% of a pure-bred's speed in each, level the average";
 * "Infertile"; "Doesn't evolve: born at the stage of the less-evolved parent and stays there"; "Traits: 3 slots, each
 * from either parent at the usual keep chance. Hybrid vigour: +5% health, and the inbreeding penalty doesn't apply";
 * "Forms: colour form from either parent at 25% using the hybrid's own form palette"; "Pedigree: Hybrid: Kind A x Kind
 * B"; "its own field guide page. Hybrids count toward the field guide"; "Hybrids never stand up wild".
 *
 * Asked of the list and the browser:
 *
 *   * fifty crosses, each its own kind with its own name, of two kinds that breed today, no pair twice, no monster,
 *     each parent with a trade; their two trades its trades, the first parent's first;
 *   * the field guide has a page for each, after the content kinds and before the monsters, counted in every mark;
 *   * none is in the wild table, and a trap lists none;
 *   * the mate a kind is offered is its own kind before a cross, and never one for a hybrid; a cross is refused short of
 *     the husbandry or either parent's care, and the preview and the Stud Book give its odds, a quarter of the pairing's;
 *   * a hybrid's stage is its pedigree's, its health ×1.05, its task speed ×0.75, its level the mean of its trades' skills;
 *   * its colour form is a palette of its own, unlike either parent's.
 *
 * And of the island, in a world of its own rolled back, every roll off one seed:
 *
 *   * the gates refuse a cross in the browser's words; through the door a cross takes at its odds over many tries;
 *   * a cross's young is the hybrid, at the less-evolved parent's stage, which it keeps however much it learns, with
 *     three traits each from a parent or a fresh draw at the usual keep chance, the health of hybrid vigour, and its
 *     page marked tamed and bred; a parent's colour form passes at a quarter;
 *   * a hybrid is refused a mate, in the browser's words;
 *   * at work it takes up its first trade where that has work, its second where only that does, works both in a
 *     window, at three quarters of a pure-bred's pace, as one worker, learning both, its level their mean;
 *   * the Stud Book's line is the browser's.
 */
// `game` first: the root of the module graph, so nothing below comes out half-built.
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import {
  CREATURE_ATTACK_MUL, CREATURE_HEALTH_MUL, creatureLevel, evoMul, GATHER_SKILL, maxHealth, pedigreeLine, SPECIES, stageOf, WILD_SPECIES,
  type Creature,
} from '../../src/game/creatures';
import { creatureAttack, creatureHealth } from '../../src/game/limits';
import { breedChance, breedPreview, crossRefuses, infertileSays, mateFor, pairChance, pairRefuses, studBook } from '../../src/game/husbandry';
import { CROSS_CARE, CROSS_CHANCE, CROSS_SKILL, crossOf, HYBRID_HARDY, HYBRID_WORK, HYBRIDS } from '../../src/game/hybridlist';
import { FieldGuide, GUIDE_ORDER, guideCounts, guidePage, guidePages } from '../../src/game/guide';
import { formCoat } from '../../src/game/wildforms';
import { keepChance, TRAIT_SLOTS } from '../../src/game/traits';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { psql, check, finish } from './harness';


/* ---- the list ---------------------------------------------------------------------- */

const MONSTERS = Object.values(SPECIES).filter((d) => d.monster).map((d) => d.id);
const pairs = new Set(HYBRIDS.map((h) => [h.a, h.b].sort().join('|')));
check(`${HYBRIDS.length} listed crosses, no pair twice, each its own kind with a name of its own`,
  HYBRIDS.length === 50 && pairs.size === 50 && new Set(HYBRIDS.map((h) => h.name)).size === 50
    && HYBRIDS.every((h) => SPECIES[h.id]?.name === h.name && h.a !== h.b)
    && HYBRIDS.every((h) => Object.values(SPECIES).filter((d) => [d.name, ...(d.stages ?? []).map((s) => s.name), ...(d.was ?? [])].includes(h.name)).length === 1));
check('each parent is a kind that breeds today: no monster, no hybrid, each with a trade',
  HYBRIDS.every((h) => [h.a, h.b].every((id) => SPECIES[id] && !SPECIES[id].monster && !SPECIES[id].hybrid && !!SPECIES[id].gathers && !MONSTERS.includes(id))));
check('a hybrid\'s trades are its parents\', the first parent\'s first, and two of them',
  HYBRIDS.every((h) => { const d = SPECIES[h.id]; return d.gathers === SPECIES[h.a].gathers && d.trades?.join() === [SPECIES[h.a].gathers, SPECIES[h.b].gathers].join() && d.trades[0] !== d.trades[1]; }));
check('a cross is either way round', HYBRIDS.every((h) => crossOf(h.a, h.b) === h && crossOf(h.b, h.a) === h) && !crossOf('rabba', 'rabba'));
check('a hybrid never evolves and is bred only', HYBRIDS.every((h) => !SPECIES[h.id].stages && SPECIES[h.id].tameChance === 0));
check('none is in the wild table', !WILD_SPECIES.some(([id]) => SPECIES[id]?.hybrid));
check('its words are labels with its numbers',
  HYBRIDS.every((h) => SPECIES[h.id].description.includes(`Task speed: ${Math.round(HYBRID_WORK * 100)}% of a pure-bred's in each.`)
    && SPECIES[h.id].description.includes(`Health +${Math.round((HYBRID_HARDY - 1) * 100)}%.`) && SPECIES[h.id].description.includes('Infertile.')), SPECIES.millhog.description);
/*
 * Every kind's health ×3 and blow ×0.4 (`CREATURE_HEALTH_MUL`, `CREATURE_ATTACK_MUL`), a hybrid's once: its row the mean
 * of its parents' rows as written, then the multipliers, like theirs -- not left at its parents' unscaled figures, and
 * not scaled again over their scaled ones. Hybrid vigour on top, in its max health (below).
 */
const hpOnce = (h: (typeof HYBRIDS)[number]): number =>
  creatureHealth(Math.round((SPECIES[h.a].health / CREATURE_HEALTH_MUL + SPECIES[h.b].health / CREATURE_HEALTH_MUL) / 2));
const hitOnce = (h: (typeof HYBRIDS)[number]): number =>
  creatureAttack(+((SPECIES[h.a].attack / CREATURE_ATTACK_MUL + SPECIES[h.b].attack / CREATURE_ATTACK_MUL) / 2).toFixed(1));
const scaledWrong = HYBRIDS.filter((h) => SPECIES[h.id].health !== hpOnce(h) || Math.abs(SPECIES[h.id].attack - hitOnce(h)) > 1e-9
  || SPECIES[h.id].health < Math.min(SPECIES[h.a].health, SPECIES[h.b].health) - 3 || SPECIES[h.id].health > Math.max(SPECIES[h.a].health, SPECIES[h.b].health) + 3);
check(`each of the ${HYBRIDS.length} hybrids: health ×${CREATURE_HEALTH_MUL} and blow ×${CREATURE_ATTACK_MUL} once, over its parents' rows as written`,
  scaledWrong.length === 0,
  scaledWrong.map((h) => `${h.id} ${SPECIES[h.id].health}/${SPECIES[h.id].attack} vs ${hpOnce(h)}/${hitOnce(h)}`).join(', '));

/* ---- the field guide ----------------------------------------------------------------- */

const ids = HYBRIDS.map((h) => h.id);
const firstMonster = GUIDE_ORDER.findIndex((id) => SPECIES[id]?.monster);
check('the guide has the hybrids as a group after the content kinds and before the monsters',
  GUIDE_ORDER.slice(firstMonster - ids.length, firstMonster).join() === ids.join() && GUIDE_ORDER.indexOf('springlet') === firstMonster - ids.length - 1);
const empty = guideCounts(new FieldGuide());
const book = new FieldGuide();
for (const id of ids) { book.mark(id, 'tamed'); book.mark(id, 'bred'); }
const marked = guideCounts(book);
check('a hybrid\'s page counts toward seen, tamed and bred',
  marked.seen === ids.length && marked.tamed === ids.length && marked.bred === ids.length && empty.keepable === guidePages().filter((d) => !d.monster).length,
  JSON.stringify(marked));
const page = guidePage(SPECIES.millhog).flatMap((s) => [s.head, ...s.lines]).join(' | ');
check('a hybrid\'s page gives its cross, its gates and odds, its two tasks at their pace, its vigour, and that it is never wild',
  page.includes('Parents: Wheatley (body, first task) × Pigroot') && page.includes(`animal husbandry ${CROSS_SKILL}+`) && page.includes(`Success: ${Math.round(CROSS_CHANCE * 100)}% of a pairing's chance`)
    && page.includes(`Task speed: ${Math.round(HYBRID_WORK * 100)}% of a pure-bred's in each`) && page.includes('Hybrid vigour: health +5%') && page.includes('Never wild') && page.includes('Infertile'), page);

/* ---- the browser --------------------------------------------------------------------- */

const g = Game.create(5151);
let s = 77;
g.rand = (): number => { s = (s * 48271) % 2147483647; return s / 2147483647; };
g.deed = { name: 'Crossing', x: g.player.tileX + 4, y: g.player.tileY + 4, radius: 5, level: 3 };
for (const c of [...g.creatures.list.values()]) if (c.mode !== 'wild') c.mode = 'wild';
const put = (species: string, sex: 'male' | 'female', dx: number, care: number, level = 1): Creature => {
  const c = g.creatures.spawn(species, g.player.x + dx, g.player.y, 'deed', g.rand, 0);
  const skill = GATHER_SKILL[SPECIES[species].gathers!];
  Object.assign(c, { sex, hunger: 1, care, traits: [], skills: { [skill]: level } });
  return c;
};
g.skills.values.set('animal_husbandry', 60);
const dam = put('grista', 'female', 0.3, 0.9, 30);
const sire = put('seavic', 'male', -0.3, 0.9, 60);
check('browser: with none of its own kind in reach, the mate is a listed cross', mateFor(g, dam) === sire);
const own = put('grista', 'male', 1.5, 0.9);
check('browser: one of its own kind in reach comes before a cross', mateFor(g, dam) === own);
g.creatures.list.delete(own.id);
const pairIt = ACTION_BY_ID.get('pair_creature')!;
const onDam: Target = { kind: 'creature', id: dam.id };
check('browser: the menu names the cross', pairIt.labelFor?.(onDam, g) === `Cross with ${sire.name}: Millhog`, pairIt.labelFor?.(onDam, g));
const prev = breedPreview(g, dam, sire);
const want = pairChance(60, 0.9, true);
check(`browser: the preview gives the cross's odds, ${Math.round(CROSS_CHANCE * 100)}% of the pairing's`,
  prev.includes(`Cross: Millhog (Wheatley × Pigroot), success ${Math.round(want * 100)}% (25% of ${Math.round(breedChance(60, 0.9) * 100)}%); born at stage 2, stays there`)
    && Math.abs(want - breedChance(60, 0.9) * CROSS_CHANCE) < 1e-12, prev.split('\n')[2]);
g.perkFx = { stud_book: 1 };
check('browser: the Stud Book gives it too', studBook(g, dam).includes(`Cross: Millhog (Wheatley × Pigroot), success ${Math.round(want * 100)}%`), studBook(g, dam));
check('browser: a cross keeps a trait at the usual chance: no penalty for crossing',
  studBook(g, dam).includes(`inherited ${Math.round(keepChance(60, 0.9, 0, 1) * 100)}%`), studBook(g, dam));
g.skills.values.set('animal_husbandry', CROSS_SKILL - 1);
const sayLow = crossRefuses(g, dam, sire);
g.skills.values.set('animal_husbandry', 60);
sire.care = CROSS_CARE - 0.1;
const sayCare = crossRefuses(g, dam, sire);
sire.care = 0.9;
check('browser: a cross is refused short of the husbandry, and of either parent\'s care',
  sayLow === `Cross: animal husbandry ${CROSS_SKILL} needed, yours ${CROSS_SKILL - 1}.` && sayCare === `Cross: care 80% each needed, ${sire.name} 70%.`
    && pairRefuses(g, dam, sire) === null, `${sayLow} / ${sayCare}`);
const hyb = put('millhog', 'female', 0.6, 0.9);
hyb.pedigree = { dam: { id: dam.id, name: dam.name }, sire: { id: sire.id, name: sire.name }, from: {}, stage: 1 };
const hyb2 = put('millhog', 'male', 0.8, 0.9);
check('browser: a hybrid is offered no mate and says it is infertile',
  !mateFor(g, hyb) && pairIt.check?.({ kind: 'creature', id: hyb.id }, g) === infertileSays(hyb) && pairRefuses(g, hyb, hyb2) === infertileSays(hyb), infertileSays(hyb));
hyb.skills = { [GATHER_SKILL.mill]: 80, [GATHER_SKILL.farm]: 20 };
check('browser: a hybrid stays at the stage it was born at, its level the mean of its two trades\' skills',
  stageOf(hyb) === 1 && creatureLevel(hyb) === 50, `${stageOf(hyb)} ${creatureLevel(hyb)}`);
hyb.traits = [];
check('browser: a hybrid\'s health is ×1.05 over its stage\'s, its task speed ×0.75',
  Math.abs(evoMul(hyb, 'hardy') - 1.2 * HYBRID_HARDY) < 1e-9 && Math.abs(evoMul(hyb, 'work') - 1.15 * HYBRID_WORK) < 1e-9
    && maxHealth(hyb, SPECIES.millhog) === Math.round(SPECIES.millhog.health * 1.2 * HYBRID_HARDY), `${evoMul(hyb, 'hardy')} ${maxHealth(hyb, SPECIES.millhog)}`);
check('browser: its pedigree says its cross', pedigreeLine(hyb.pedigree!, 'millhog').startsWith('Hybrid: Wheatley × Pigroot · Dam '), pedigreeLine(hyb.pedigree!, 'millhog'));
const forms = HYBRIDS.map((h) => formCoat(SPECIES[h.id]).join());
check('browser: each hybrid\'s colour form is a palette of its own, unlike either parent\'s',
  HYBRIDS.every((h) => formCoat(SPECIES[h.id]).join() !== formCoat(SPECIES[h.a]).join() && formCoat(SPECIES[h.id]).join() !== formCoat(SPECIES[h.b]).join())
    && new Set(forms).size === forms.length);

/* ---- the island ---------------------------------------------------------------------- */

const SHARD = RECIPE_BY_ID.get('make_stone_brick')!.inputs[0].item;
const LOG = RECIPE_BY_ID.get('make_planks')!.inputs[0].item;
const TRIES = 800;
const U = '7e5b0000-0000-4000-8000-0000000000f1';
const out = psql(`
discard temp;
begin;
select setseed(0.31) \\g /dev/null
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_d int; v_s int; v_h int; v_h2 int; v_p int; v_y int; v_i int; v_took int := 0; v_why text; c1 creature; c2 creature;
        v_col int := 0; v_n int := 0;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Crossing', 517, 48, 16, 16, true) returning id into w;
  perform land_blank(w, 48);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 47) x, generate_series(0, 47) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Brae');
  update player set x = 16.5, y = 16.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Crossing', 16, 16, 8, 3, u);
  insert into crate (world_id, id, kind, x, y, sx, sy, deed, made_by) values (w, 7601, 'plank', 17, 16, 0, 0, true, u);
  insert into skill (world_id, uid, id, value) values (w, u, 'animal_husbandry', 60) on conflict (world_id, uid, id) do update set value = 60;

  insert into said select 'WILD', count(*)::text from wild_table t join species_def d on d.id = t.species where d.hybrid_a is not null;
  insert into said select 'KINDS', count(*)::text from species_def d where d.hybrid_a is not null;

  -- A Wheatley dam at stage 2 and a Pigroot sire at stage 3, grown, fed and well kept.
  v_d := creature_spawn(w, 'grista', 16.8, 16.5, 'deed', now() - interval '10 days', u);
  v_s := creature_spawn(w, 'seavic', 16.2, 16.5, 'deed', now() - interval '10 days', u);
  update creature set sex = 'female', hunger = 1, care = 0.9, traits = '{willing,fleet}', skills = '{"milling": 30}', from_x = to_x, from_y = to_y where world_id = w and id = v_d;
  update creature set sex = 'male', hunger = 1, care = 0.9, traits = '{thrifty}', skills = '{"farming": 60}', from_x = to_x, from_y = to_y where world_id = w and id = v_s;
  insert into said select 'MATE', ((mate_for(w, c)).id = v_s)::text from creature c where c.world_id = w and c.id = v_d;

  -- The gates.
  update skill set value = ${CROSS_SKILL - 1} where world_id = w and uid = u and id = 'animal_husbandry';
  insert into said values ('LOW', coalesce(act_refusal(w, u, 'pair_creature', jsonb_build_object('kind', 'creature', 'id', v_d)), 'none'));
  update skill set value = 60 where world_id = w and uid = u and id = 'animal_husbandry';
  update creature set care = ${CROSS_CARE - 0.1} where world_id = w and id = v_s;
  insert into said values ('CARE', coalesce(act_refusal(w, u, 'pair_creature', jsonb_build_object('kind', 'creature', 'id', v_d)), 'none'));
  update creature set care = 0.9 where world_id = w and id = v_s;
  insert into said values ('OPEN', coalesce(act_refusal(w, u, 'pair_creature', jsonb_build_object('kind', 'creature', 'id', v_d)), 'none'));
  insert into said values ('CHANCE', pair_chance(60, 0.9, true)::text || '|' || breed_chance(60, 0.9)::text);
  update player set class_mul = jsonb_build_object('fx', jsonb_build_object('stud_book', 1)) where world_id = w and uid = u;
  insert into said select 'STUD', stud_book(w, u, c) from creature c where c.world_id = w and c.id = v_d;

  -- Through the door, many times, the husbandry put back each time.
  for v_i in 1..${TRIES} loop
    update creature set bred_at = null, due = null, unborn = null where world_id = w and id in (v_d, v_s);
    update skill set value = 60 where world_id = w and uid = u and id = 'animal_husbandry';
    update player set act = null, act_queue = '[]'::jsonb where world_id = w and uid = u;
    perform act_perform(w, u, 'pair_creature', jsonb_build_object('kind', 'creature', 'id', v_d));
    if (select due from creature where world_id = w and id = v_d) is not null then v_took := v_took + 1; end if;
  end loop;
  insert into said values ('TOOK', v_took::text);

  -- A young: the hybrid, at the dam's stage (the lower), its traits, its health, its page.
  update creature set bred_at = null, due = null, unborn = null where world_id = w and id in (v_d, v_s);
  perform pair_them(w, v_d, v_s, 60, u);
  insert into said select 'UNBORN', unborn::text from creature where world_id = w and id = v_d;
  update creature set due = now() - interval '1 second' where world_id = w and id = v_d;
  v_y := give_birth(w, v_d);
  select * into c1 from creature where world_id = w and id = v_y;
  insert into said values ('YOUNG', c1.species || '|' || stage_of(c1) || '|' || array_length(c1.traits, 1) || '|' || (c1.pedigree->>'stage')
    || '|' || (c1.health = max_health(c1))::text || '|' || (evo_mul(c1, 'hardy') / power(stage_mul_hardy(), 1))::text || '|' || (c1.pedigree->'from')::text);
  insert into said select 'GUIDE', g.tamed || '|' || g.bred from guide g where g.world_id = w and g.uid = u and g.species = c1.species;
  update creature set skills = '{"milling": 90, "farming": 40}' where world_id = w and id = v_y;
  select * into c1 from creature where world_id = w and id = v_y;
  insert into said values ('STAYS', stage_of(c1) || '|' || creature_level(c1.skills, c1.species));
  perform worker_learn(w, v_y, 'milling', 5);
  select * into c1 from creature where world_id = w and id = v_y;
  insert into said values ('NOEVOLVE', stage_of(c1)::text);

  -- Infertile.
  update creature set sex = 'female', hunger = 1, care = 0.9, born = now() - interval '10 days', bred_at = null, mode = 'deed' where world_id = w and id = v_y;
  v_h2 := creature_spawn(w, 'grista', 16.6, 16.6, 'deed', now() - interval '10 days', u);
  update creature set sex = 'male', hunger = 1, care = 0.9 where world_id = w and id = v_h2;
  insert into said values ('INFERTILE', coalesce(act_refusal(w, u, 'pair_creature', jsonb_build_object('kind', 'creature', 'id', v_y)), 'none'));
  insert into said select 'NOMATE', ((mate_for(w, c)).id is null)::text from creature c where c.world_id = w and c.id = v_y;
  delete from creature where world_id = w and id = v_h2;

  -- A parent's colour form passes to a quarter of its young, the hybrid kind each time.
  update creature set form_colour = true where world_id = w and id = v_d;
  for v_i in 1..400 loop
    update creature set bred_at = null, due = null, unborn = null where world_id = w and id in (v_d, v_s);
    perform pair_them(w, v_d, v_s, 60, u);
    update creature set due = now() - interval '1 second' where world_id = w and id = v_d;
    v_p := give_birth(w, v_d);
    select * into c2 from creature where world_id = w and id = v_p;
    v_n := v_n + case when c2.species = 'millhog' then 1 else 0 end;
    v_col := v_col + case when c2.form_colour then 1 else 0 end;
    delete from creature where world_id = w and id = v_p;
  end loop;
  insert into said values ('FORMS', v_n || '|' || v_col);
  update creature set mode = 'stored' where world_id = w and id in (v_d, v_s, v_y);

  -- At work: a Sawchip (a Chipkin's chiselling first, a Logkit's sawing second) beside a pure Chipkin.
  v_h := creature_spawn(w, 'sawchip', 16.6, 16.6, 'active', now() - interval '60 days', u);
  v_p := creature_spawn(w, 'chissa', 16.6, 16.4, 'active', now() - interval '60 days', u);
  update creature set stance = 'passive', hunger = 1, care = 0.5, traits = '{}', rare = null, from_x = to_x, from_y = to_y,
      pedigree = case when id = v_h then '{"dam":{"id":1,"name":"A"},"sire":{"id":2,"name":"B"},"from":{},"stage":0}'::jsonb end
    where world_id = w and id in (v_h, v_p);
  select * into c1 from creature where world_id = w and id = v_h;
  select * into c2 from creature where world_id = w and id = v_p;
  insert into said values ('PACE', (worker_pace(w, c1, 'chisel') / worker_pace(w, c2, 'chisel'))::text || '|' || (worker_pace(w, c1, 'saw') / worker_pace(w, c2, 'saw'))::text);
  update creature set mode = 'stored' where world_id = w and id = v_p;

  -- Only logs: it saws.
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7601, '${LOG}', 30, 2);
  update creature set mode = 'deed', job = null, carrying = null, skills = '{}'::jsonb, until = now(), settled_at = now(), phase = 'idle'
   where world_id = w and id = v_h;
  perform worker_settle(w, v_h);
  insert into said select 'ONLYB', coalesce(job, '-') from creature where world_id = w and id = v_h;
  -- Shards as well, between jobs: it chisels first.
  insert into item (world_id, holder, crate, def, ql, count) values (w, 'crate', 7601, '${SHARD}', 30, 2);
  update creature set job = 'saw', carrying = null, fetching = null, until = now(), settled_at = now(), phase = 'idle', idle_why = null
   where world_id = w and id = v_h;
  perform worker_settle(w, v_h);
  insert into said select 'BOTHA', coalesce(job, '-') from creature where world_id = w and id = v_h;
  insert into said values ('SLOT', workers_on_deed(w, u)::text || '|' || deed_trade_counts(w, u)::text);
  -- A long window: both worked.
  update creature set carrying = null, fetching = null, until = now() - interval '900 seconds', settled_at = now() - interval '900 seconds', phase = 'idle', idle_why = null
   where world_id = w and id = v_h;
  perform worker_settle(w, v_h);
  insert into said select 'MADE', coalesce((select string_agg(def || ' ' || count, ',' order by def) from item where world_id = w and holder = 'crate' and crate = 7601), '-');
  select * into c1 from creature where world_id = w and id = v_h;
  insert into said values ('LEARNT', coalesce(c1.skills->>'stonecutting', '-') || '|' || coalesce(c1.skills->>'carpentry', '-') || '|' || creature_level(c1.skills, c1.species));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('island: fifty hybrid kinds, none in the wild table', at('KINDS') === '50' && at('WILD') === '0', `${at('KINDS')} ${at('WILD')}`);
check('island: with none of its own kind in reach, the mate is the cross', at('MATE') === 'true', at('MATE'));
check('island: the gates refuse a cross in the browser\'s words, and pass it at both',
  at('LOW') === `Cross: animal husbandry ${CROSS_SKILL} needed, yours ${CROSS_SKILL - 1}.` && at('CARE').startsWith('Cross: care 80% each needed, ') && at('CARE').endsWith(' 70%.')
    && at('OPEN') === 'none', `${at('LOW')} / ${at('CARE')} / ${at('OPEN')}`);
const [isleChance, isleBreed] = at('CHANCE').split('|').map(Number);
check('island: a cross\'s odds are the browser\'s, a quarter of the pairing\'s', Math.abs(isleChance - want) < 1e-9 && Math.abs(isleBreed - breedChance(60, 0.9)) < 1e-9, at('CHANCE'));
const took = Number(at('TOOK')) / TRIES;
check(`island: through the door a cross takes at its odds (${(want * 100).toFixed(1)}%) over ${TRIES} tries`,
  Math.abs(took - want) <= 4.5 * Math.sqrt((want * (1 - want)) / TRIES), `${(took * 100).toFixed(1)}%`);
check('island: the Stud Book says the cross and its odds as the browser does',
  at('STUD').includes(`Cross: Millhog (Wheatley × Pigroot), success ${Math.round(want * 100)}% (25% of ${Math.round(breedChance(60, 0.9) * 100)}%); born at stage 2, stays there`)
    && at('STUD').includes(`inherited ${Math.round(keepChance(60, 0.9, 0, 1) * 100)}%`), at('STUD'));
const unborn = JSON.parse(at('UNBORN')) as { species?: string; stage?: number; traits: string[] };
check('island: a cross carries the hybrid, at the lower parent\'s stage', unborn.species === 'millhog' && unborn.stage === 1, at('UNBORN'));
const [kind, stage, ntraits, pstage, full, vigour, from] = at('YOUNG').split('|');
const sources = Object.values(JSON.parse(from || '{}') as Record<string, string>);
check(`island: the young is a Millhog at stage 2 for good, ${TRAIT_SLOTS} traits from its parents or a fresh draw, at the health of hybrid vigour`,
  kind === 'millhog' && stage === '1' && pstage === '1' && Number(ntraits) === TRAIT_SLOTS && full === 'true' && Math.abs(Number(vigour) - HYBRID_HARDY) < 1e-9
    && sources.length === TRAIT_SLOTS, at('YOUNG'));
check('island: its page is marked tamed and bred', at('GUIDE') === 'true|true', at('GUIDE'));
check('island: however much it learns it stays at its stage, its level the mean of its trades\' skills',
  at('STAYS') === '1|65' && at('NOEVOLVE') === '1', `${at('STAYS')} ${at('NOEVOLVE')}`);
check('island: a hybrid is refused a mate, in the browser\'s words', at('INFERTILE').endsWith(': hybrid, infertile.') && at('NOMATE') === 'true', at('INFERTILE'));
const [born, coloured] = at('FORMS').split('|').map(Number);
check('island: a cross is the hybrid every time, and a parent\'s colour form passes to a quarter of the young',
  born === 400 && Math.abs(coloured / 400 - 0.25) <= 4.5 * Math.sqrt(0.25 * 0.75 / 400), at('FORMS'));
const [paceA, paceB] = at('PACE').split('|').map(Number);
check(`island: a hybrid works each trade at ${HYBRID_WORK * 100}% of a pure-bred's pace`, Math.abs(paceA - HYBRID_WORK) < 1e-9 && Math.abs(paceB - HYBRID_WORK) < 1e-9, at('PACE'));
check('island: with work only at its second trade it takes that up; with work at both, its first', at('ONLYB') === 'saw' && at('BOTHA') === 'chisel', `${at('ONLYB')} ${at('BOTHA')}`);
const [slots, counts] = [at('SLOT').split('|')[0], at('SLOT').slice(at('SLOT').indexOf('|') + 1)];
check('island: it is one worker, counted at one trade', slots === '1' && Object.values(JSON.parse(counts || '{}') as Record<string, number>).reduce((n, k) => n + k, 0) === 1, at('SLOT'));
check('island: in a window it works both trades', at('MADE').includes('plank') && at('MADE').includes('stone_brick'), at('MADE'));
const [stone, carp, level] = at('LEARNT').split('|');
check('island: it learns both trades\' skills, its level their mean', Number(stone) > 1 && Number(carp) > 1 && Number(level) === Math.max(1, Math.floor((Number(stone) + Number(carp)) / 2)), at('LEARNT'));

finish('hybrids');
