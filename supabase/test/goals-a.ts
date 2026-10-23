/**
 * Goals of the wildermon and of a settlement, counted on the island.
 *
 * Thirty-eight goals joined the journal's chapters The wildermon and Standing
 * (`src/game/journal-a.ts`): evolving, breeding and keeping wildermon, the
 * Field guide, wildermon gear, beds and spars, and what a settlement is built
 * into. Each reads either what the browser holds of your own, or a count the
 * island keeps for you (`journal_note`, read on the beat into `Game.tally`).
 * This asks, of both sides:
 *
 *   * the island: each new count is noted for whoever did the thing, at the
 *     event, by causing each event in a transaction that is rolled back, and
 *     every count a goal of this part reads is noted somewhere on the island;
 *     the Field guide's counts are kept off its own rows by a trigger, and the
 *     book kept before them is counted once;
 *   * the browser: each goal is met by the count or the state it reads, and
 *     not before;
 *   * and every goal id in the whole journal is unique, and every goal has a
 *     label, a how-to and every number filled in.
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// `game` first: the root of the module graph, so nothing below comes out half-built.
import { BROWSER_TALLY, Game, MAX_DEED_LEVEL, deedWorkersAt } from '../../src/game/game';
import '../../src/game/recipes';
import { ALL_GOALS, JOURNAL } from '../../src/game/journal';
import { STANDING_A, WILDERMON_A } from '../../src/game/journal-a';
import { EVOLVE_AT, SPECIALTY_AT, SPECIES, type Creature } from '../../src/game/creatures';
import { stageSlots, TRAITS } from '../../src/game/traits';
import { GEAR_SLOTS, gearId } from '../../src/game/wildgear';
import { ROSE_FLOWER } from '../../src/game/roses';
import { DAY_SECONDS } from '../../src/game/pace';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const PART = [...WILDERMON_A, ...STANDING_A];
const goal = (id: string) => {
  const g = PART.find((x) => x.id === id);
  if (!g) throw new Error(`no goal ${id}`);
  return g;
};

/* ---- the whole journal ----------------------------------------------------- */

const ids = ALL_GOALS.map((g) => g.id);
const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
check(`every goal id in the journal is unique (${ids.length})`, twice.length === 0, twice.join(', '));
check(`this part's ${PART.length} goals are in it, in The wildermon and Standing`,
  WILDERMON_A.every((g) => JOURNAL.find((c) => c.name === 'The wildermon')?.goals.includes(g))
  && STANDING_A.every((g) => JOURNAL.find((c) => c.name === 'Standing')?.goals.includes(g)));
const PLACEHOLDER = /\{[\w.]+(:\w+)?\}|undefined|NaN|\[object/;
const unread = PART.filter((g) => !g.text || !g.how || g.how.length < 20 || PLACEHOLDER.test(`${g.text} ${g.hint ?? ''} ${g.how}`));
check('every goal of this part has a label and a how-to, every number filled in', unread.length === 0, unread.map((g) => g.id).join(', '));
// A label: no sentence, no full stop at its end.
const sentences = PART.filter((g) => /[.!?]$/.test(g.text) || (g.hint && /[.!?]$/.test(g.hint)));
check('every label and hint is a label, not a sentence', sentences.length === 0, sentences.map((g) => g.id).join(', '));

/* ---- the browser ------------------------------------------------------------- */

const game = Game.create(4242);
const px = Math.floor(game.player.x), py = Math.floor(game.player.y);
const met = (id: string): boolean => goal(id).met(game);

// Every goal that reads a count: not met without it, met with it.
const COUNTED: Record<string, string[]> = {
  evolve2: ['evolved:1'], evolve3: [`evolved:${EVOLVE_AT.length}`], mutation: ['mutated'], line3: ['line:3'], line5: ['line:5'],
  formtame: ['tamed:form'], formbred: ['bred:form'], guidepage: ['guide:page'], tracked: ['tracked'], mirror: ['mirrored'],
  lamp: ['rekindled'], den: ['bedded:own'], spar: ['sparred'], runegate: ['built:rune_gate'],
  gates: ['built:portcullis', 'bridged:draw', 'built:hidden_door'], cellar: ['cellar', 'cellared'], spring: ['spring'],
  aqueduct: ['aqueduct'], well: ['well:own'], glasshouse: ['harvest:glass'], pier: ['pier'], outstair: ['outstair'],
  storey3: ['storey:3'], watergarden: ['stones', 'waterplant'], binfull: ['binfull'], delivered: ['delivered'],
};
/** The island's tally, as the browser holds it, put to `t`. */
const setTally = (t: Record<string, number>): void => {
  for (const k of Object.keys(game.tally)) delete game.tally[k];
  Object.assign(game.tally, t);
};
for (const [id, keys] of Object.entries(COUNTED)) {
  setTally({});
  const before = met(id);
  for (const k of keys.slice(0, -1)) game.tally[k] = 1;
  const short = keys.length > 1 && met(id);
  game.tally[keys[keys.length - 1]] = 1;
  check(`${id}: met by ${keys.join(' + ')}, not before`, !before && !short && met(id), JSON.stringify(game.tally));
}
setTally({ 'line:4': 1 });
check('line3: a line four deep is three deep', met('line3') && !met('line5'));
setTally({ 'guide:seen': 24 });
check('seen25: not at 24 kinds', !met('seen25'));
setTally({ 'guide:seen': 25 });
check('seen25: at 25', met('seen25') && !met('seenall'));
setTally({ 'guide:seen': Object.keys(SPECIES).length });
check(`seenall: at every kind (${Object.keys(SPECIES).length})`, met('seenall'));
setTally({});

// The ones read off what is yours.
const kind = 'rabba';
const level = (c: Creature, at: number): void => {
  c.skills = { ...c.skills, foraging: at };
};
const kept: Creature[] = [];
for (let i = 0; i < 3; i++) {
  const c = game.creatures.spawn(kind, px + 2 + i, py + 2, 'active');
  level(c, EVOLVE_AT[EVOLVE_AT.length - 1] - 1);
  kept.push(c);
}
check('topkept: three not yet at the last stage', !met('topkept'));
for (const c of kept) level(c, EVOLVE_AT[EVOLVE_AT.length - 1]);
check('topkept: three at the last stage', met('topkept'));
kept[0].mine = false;
check('topkept: one of them somebody else\'s', !met('topkept'));
kept[0].mine = undefined;
const full = TRAITS.slice(0, stageSlots(EVOLVE_AT.length)).map((t) => t.id);
for (const c of kept) c.traits = full.slice(0, -1);
check(`slots: not at ${stageSlots(EVOLVE_AT.length) - 1}`, !met('slots'));
kept[1].traits = full;
check(`slots: ${stageSlots(EVOLVE_AT.length)} traits on one`, met('slots'));
check('geared: none fitted', !met('geared'));
kept[2].gear = {};
for (const s of GEAR_SLOTS.slice(0, -1)) kept[2].gear[s] = game.inventory.add(gearId(s, 0), { ql: 30 });
check('geared: all but one', !met('geared'));
kept[2].gear[GEAR_SLOTS[GEAR_SLOTS.length - 1]] = game.inventory.add(gearId(GEAR_SLOTS[GEAR_SLOTS.length - 1], 0), { ql: 30 });
check('geared: every slot on one', met('geared'));
check('trade50: at the last stage, level 50 of its trade', met('trade50'));
for (const c of kept) level(c, 49);
check('trade50: not at 49', !met('trade50'));

// A settlement: its top level, its workers and a specialty.
game.deed = { name: 'Mine', x: px, y: py, radius: 20, level: MAX_DEED_LEVEL - 1 } as never;
check('deedtop: not a level short', !met('deedtop'));
(game.deed as { level: number }).level = MAX_DEED_LEVEL;
check('deedtop: at the top level', met('deedtop'));
(game.deed as { mine?: boolean }).mine = false;
check('deedtop: not on somebody else\'s', !met('deedtop'));
(game.deed as { mine?: boolean }).mine = undefined;
const workers: Creature[] = [];
for (let i = 0; i < deedWorkersAt(MAX_DEED_LEVEL); i++) {
  const c = game.creatures.spawn(kind, px + 1, py + 3 + i, 'deed');
  c.post = null;
  workers.push(c);
}
check(`workers: ${deedWorkersAt(MAX_DEED_LEVEL)} at work on the settlement`, met('workers'));
check(`specialty: ${SPECIALTY_AT} or more at one trade`, met('specialty'));
workers[0].post = 1;
check('workers: one of them at a post is not', !met('workers'));
for (const c of workers.slice(SPECIALTY_AT - 1)) game.creatures.list.delete(c.id);
check(`specialty: not at ${SPECIALTY_AT - 1}`, !met('specialty'));

// Pieces: a rose arch grown, a memorial stone, a rune lantern post.
const arch = game.addFurniture('rose_arch', px + 6, py + 6, 0, 0, 30);
arch.setAt = game.wallNow() - (ROSE_FLOWER - 0.5) * DAY_SECONDS;
check('roses: not yet grown', !met('roses'));
arch.setAt = game.wallNow() - ROSE_FLOWER * DAY_SECONDS;
check('roses: grown', met('roses'));
arch.mine = false;
check('roses: not somebody else\'s', !met('roses'));
check('memorial and runelantern: none set', !met('memorial') && !met('runelantern'));
game.addFurniture('memorial_stone', px + 8, py + 6, 0, 0, 30);
game.addFurniture('rune_lantern', px + 10, py + 6, 0, 0, 30);
check('memorial and runelantern: set', met('memorial') && met('runelantern'));

/* ---- the island ---------------------------------------------------------------- */

/*
 * Each event caused once, by Dane, on a spot of open ground away from every settlement, but for what only happens on
 * one (a worker's bed, a spar, work delivered), which is on Dane's own; Crowd1 delivers the work. The lot is rolled back.
 */
const isle = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; me uuid; them uuid; v_x int; v_y int; v_b int; c1 int; c2 int; c3 int; v_it bigint; v_pl bigint;
        v_dam creature; v_br int; v_sp bigint; v_work bigint; v_dx int; v_dy int; v_trait text; i int;
        v_stage int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  select uid into them from player where world_id = w and name = 'Crowd1';
  select x, y into v_dx, v_dy from deed where world_id = w and founded_by = me;
  -- Room for everything below, from 3 tiles west and north of it to 20 east and south, on the island and off every
  -- settlement: as tight as that, since a settlement in the middle of the test island leaves no wider room beside it.
  select gx, gy into v_x, v_y
    from world wd, generate_series(3, wd.size - 21) gx, generate_series(3, wd.size - 21) gy
   where wd.id = w
     and not exists (select 1 from deed d where d.world_id = w
                      and d.x + d.radius >= gx - 3 and d.x - d.radius <= gx + 20
                      and d.y + d.radius >= gy - 3 and d.y - d.radius <= gy + 20)
   order by gx, gy limit 1;
  if v_x is null then raise exception 'no open ground for the goals'; end if;
  update player set x = v_x + 0.5, y = v_y + 0.5, level = 0, act = null, act_queue = '[]'::jsonb, tally = '{}'::jsonb,
      stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1')
   where world_id = w and uid in (me, them);
  delete from guide where world_id = w and uid in (me, them);
  select id into v_trait from trait_def order by id limit 1;

  -- Evolving: to its second stage, then its third.
  c1 := creature_spawn(w, 'rabba', v_x + 1.5, v_y + 0.5, 'active', now() - interval '30 days', me);
  update creature set skills = jsonb_build_object(level_skill('rabba'), 24.999), sex = 'female' where world_id = w and id = c1;
  perform worker_learn(w, c1, level_skill('rabba'), 50);
  update creature set skills = jsonb_build_object(level_skill('rabba'), 49.999) where world_id = w and id = c1;
  perform worker_learn(w, c1, level_skill('rabba'), 50);
  select stage_of(c) into v_stage from creature c where c.world_id = w and c.id = c1;
  insert into said values ('SAY_it evolved twice', case when v_stage = 2 then 'ok' else 'stage ' || v_stage end);
  update creature set skills = jsonb_build_object(level_skill('rabba'), 5) where world_id = w and id = c1;

  -- A birth with a mutation, a line three deep and a colour form.
  select * into v_dam from creature where world_id = w and id = c1;
  perform drop_young(w, v_dam, jsonb_build_object('traits', jsonb_build_array(v_trait), 'sex', 'female',
    'sire', jsonb_build_object('id', c1, 'name', 'Sire'), 'from', jsonb_build_object(v_trait, 'mutation'),
    'line', jsonb_build_object('speed', 3), 'formColour', true));

  -- A trail read, of a kind in the book, a wild one beside you.
  insert into guide (world_id, uid, species) values (w, me, 'rabba') on conflict do nothing;
  c2 := creature_spawn(w, 'rabba', v_x + 2.5, v_y + 1.5, 'wild');
  perform perform_track(w, me, 'track', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'species', 'rabba'));

  -- A covering with a mirrored sire.
  c2 := creature_spawn(w, 'rabba', v_x + 0.5, v_y + 1.5, 'active', now() - interval '30 days', me);
  update creature set boosts = '{"mirror": 1}'::jsonb, traits = array[v_trait], sex = 'male' where world_id = w and id = c2;
  perform pair_them(w, c1, c2, 10, me);

  -- An ancient lamp on one with an empty slot, which it always kindles.
  update creature set traits = '{}' where world_id = w and id = c2;
  perform give(w, me, 'ancient_lamp', 1, 50);
  perform perform_artifact(w, me, 'use_ancient_lamp', (select c from creature c where c.world_id = w and c.id = c2));

  -- A worker on Dane's settlement lying down in a bed Dane built.
  c3 := creature_spawn(w, 'rabba', v_dx + 1.5, v_dy + 1.5, 'active', now() - interval '30 days', me);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'den_small', v_dx + 1, v_dy + 1, 0, 0, v_dx + 1.5, v_dy + 1.5, 30, me) returning id into v_pl;
  update creature set mode = 'deed', phase = 'bed', bed = v_pl, until = now() - interval '1 second',
      from_x = v_dx + 1.5, from_y = v_dy + 1.5, to_x = v_dx + 1.5, to_y = v_dy + 1.5
    where world_id = w and id = c3;
  perform worker_settle(w, c3);
  insert into said values ('SAY_the worker is in the bed', case when (select sleeper from placed where id = v_pl) = c3 then 'ok' else 'not' end);

  -- A spar: a Sparra of Dane's and a guard.
  c2 := creature_spawn(w, 'sparra', v_dx + 2.5, v_dy + 1.5, 'active', now() - interval '30 days', me);
  perform spar_go(w, c3, c2, now());

  -- A building of three storeys on piers, with a rune gate, a portcullis and a hidden door each a log short.
  perform give(w, me, 'mallet', 1, 50);
  perform give(w, me, 'log', 3, 30);
  perform give(w, me, 'plank', 6, 30);
  select coalesce(max(id), 0) + 1 into v_b from building where world_id = w;
  insert into building (world_id, id, name, planned_by, levels) values (w, v_b, 'Shed', me, 3);
  insert into building_tile (world_id, building, x, y, pier) values (w, v_b, v_x, v_y, true);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
  select w, 0, bd.dir, bd.x, bd.y, v_b, t.type, 'log', '{"log": 1}', wall_bill('log', 'solid'), me
    from (values ('n', 'rune_gate'), ('e', 'portcullis'), ('s', 'hidden_door')) t(side, type)
    cross join lateral border_of(v_x, v_y, t.side) bd;
  perform perform_building(w, me, 'build_wall', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'n', 'level', 0));
  perform perform_building(w, me, 'build_wall', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'e', 'level', 0));
  perform perform_building(w, me, 'build_wall', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 's', 'level', 0));
  -- Its deck on piers, its third storey's floor, and an outside staircase to its second, each a plank short.
  insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total, planned_by) values
    (w, 0, v_x, v_y, v_b, 'plank', 'floor', '{"plank": 1}', '{"plank": 1}', me),
    (w, 2, v_x, v_y, v_b, 'plank', 'floor', '{"plank": 1}', '{"plank": 1}', me),
    (w, 1, v_x - 1, v_y, v_b, 'plank', 'stairs', '{"plank": 1}', '{"plank": 1}', me);
  perform perform_building(w, me, 'build_floor', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'floorKind', 'floor', 'level', 0));
  perform perform_building(w, me, 'build_floor', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'floorKind', 'floor', 'level', 2));
  perform perform_building(w, me, 'build_floor', jsonb_build_object('kind', 'tile', 'x', v_x - 1, 'y', v_y, 'floorKind', 'stairs',
    'level', 1, 'buildingId', v_b));

  -- A drawbridge a plank short.
  insert into bridge (world_id, kind, ax, ay, bx, "by", height, made_by) values (w, 'draw', v_x + 1, v_y + 3, v_x + 3, v_y + 3, 0, me)
    returning id into v_br;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total) values (w, v_br, 0, v_x + 2, v_y + 3, '{"plank": 1}', '{"plank": 1}');
  perform perform_last(w, me, 'build_bridge', jsonb_build_object('kind', 'bridge', 'id', v_br));

  -- An aqueduct a brick short, with a spring's water along it.
  perform give(w, me, 'stone_brick', 1, 30);
  insert into bridge (world_id, kind, ax, ay, bx, "by", height, made_by) values (w, 'aqueduct', v_x + 1, v_y - 3, v_x + 3, v_y - 3, 0, me)
    returning id into v_br;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total) values (w, v_br, 0, v_x + 2, v_y - 3, '{"stone_brick": 1}', '{"stone_brick": 1}');
  insert into spring (world_id, x, y, cx, cy, made_by) values (w, v_x + 20, v_y + 20, v_x + 20, v_y + 20, me) returning id into v_sp;
  insert into aqueduct_feed (world_id, spring_id, bridge_id, x, y, fountain) values (w, v_sp, v_br, v_x + 3, v_y - 3, false);
  perform perform_aqueduct(w, me, 'build_aqueduct', jsonb_build_object('kind', 'bridge', 'id', v_br));

  -- A cellar under it dug to its depth, at whatever go the shovel bites, and a log dropped on its floor.
  perform give(w, me, 'shovel', 1, 90);
  insert into cellar_tile (world_id, x, y, building, dug) values (w, v_x, v_y, v_b, cellar_depth()::int - 1);
  for i in 1 .. 80 loop
    perform perform_cellar(w, me, 'dig_cellar', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y));
    exit when (select tally ? 'cellar' from player where world_id = w and uid = me);
  end loop;
  update player set level = -1 where world_id = w and uid = me;
  v_it := give(w, me, 'log', 1, 30);
  perform perform_cellar(w, me, 'drop', jsonb_build_object('kind', 'item', 'uid', v_it, 'count', 1));
  update player set level = 0 where world_id = w and uid = me;

  -- A spring dug, in a hollow on a plateau (as the springs test shapes one).
  perform land_set_height(w, x, y, 200) from generate_series(v_x + 4, v_x + 16) x, generate_series(v_y + 4, v_y + 16) y;
  perform land_set_height(w, x, y, 190) from generate_series(v_x + 9, v_x + 11) x, generate_series(v_y + 9, v_y + 11) y;
  perform land_set_height(w, v_x + 10, v_y + 10, 180);
  perform perform_spring(w, me, 'dig_spring', jsonb_build_object('kind', 'tile', 'x', v_x + 9, 'y', v_y + 9));

  -- A crop grown under glass, harvested.
  insert into crop (world_id, x, y, id, stage, ql, sown_by) values (w, v_x + 14, v_y, 'onion', 3, 30, me);
  update crop set glass = true where world_id = w and x = v_x + 14 and y = v_y;
  perform reap_one(w, me, v_x + 14, v_y, 50);

  -- Stepping stones, at whatever go they take, and a water lily.
  perform give(w, me, 'stone_slab', 400, 30);
  for i in 1 .. 80 loop
    perform perform_water_garden(w, me, 'lay_stones', jsonb_build_object('kind', 'tile', 'x', v_x + 16, 'y', v_y));
    exit when (select tally ? 'stones' from player where world_id = w and uid = me);
  end loop;
  perform give(w, me, 'lily_root', 1, 30);
  perform perform_water_garden(w, me, 'plant_lily', jsonb_build_object('kind', 'tile', 'x', v_x + 18, 'y', v_y));

  -- A bucket out of a well Dane built.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, liquid)
    values (w, 'furniture', 'well', v_x + 1, v_y, 0, 0, v_x + 1.5, v_y + 0.5, 30, me, 200, 'water');
  v_it := give(w, me, 'bucket', 1, 30);
  perform perform_liquid(w, me, 'fill_bucket', jsonb_build_object('kind', 'item', 'uid', v_it));

  -- A raw material bin one log from full, filled.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bulk_bin', v_x - 1, v_y - 1, 0, 0, v_x - 0.5, v_y - 0.5, 30, me) returning id into v_pl;
  insert into item (world_id, holder, placed, def, ql, count)
    select w, 'furniture', v_pl, 'log', 30, furniture_spare(p) - 1 from placed p where p.id = v_pl;
  v_it := give(w, me, 'log', 1, 30);
  perform perform_holding(w, me, 'store_in_furniture', jsonb_build_object('kind', 'item', 'uid', v_it, 'count', 1, 'into', v_pl));
  insert into said values ('SAY_the bin is full', case when (select furniture_spare(p) from placed p where p.id = v_pl) = 0 then 'ok' else 'not' end);

  -- Work Dane set on Dane's settlement, delivered by Crowd1, a citizen.
  delete from caller;
  delete from deed_member where world_id = w and uid = them;
  insert into deed_member (world_id, founder, uid, role) values (w, me, them, 'builder');
  perform place_deed_crate(w, me);
  update player set x = v_dx + 0.5, y = v_dy + 0.5 where world_id = w and uid = them;
  insert into deed_work (world_id, founder, def, want, set_by) values (w, me, 'iron_lump', 5, me) returning id into v_work;
  perform give(w, them, 'iron_lump', 1, 30);
  perform set_config('request.jwt.claims', json_build_object('sub', them)::text, true);
  insert into said values ('SAY_the work is delivered', coalesce(nullif(rpc_work_deliver(w, me, v_work)->>'delivered', '1'), 'ok'));
  perform set_config('request.jwt.claims', '', true);

  -- The Field guide: a kind seen, a kind tamed and bred, a colour form tamed, a stage seen.
  insert into guide (world_id, uid, species) values (w, me, 'vola');
  update guide set tamed = true where world_id = w and uid = me and species = 'vola';
  update guide set bred = true where world_id = w and uid = me and species = 'vola';
  insert into guide (world_id, uid, species, tamed) values (w, me, 'rabba/colour', true);
  insert into guide (world_id, uid, species) values (w, me, 'rabba:1') on conflict do nothing;

  insert into said select 'ME', tally::text from player where world_id = w and uid = me;
  insert into said select 'THEM', tally::text from player where world_id = w and uid = them;
end $$;
select k || '=' || v from said;
rollback;
`);
const island: Record<string, string> = {};
for (const line of isle.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) island[line.slice(0, i)] = line.slice(i + 1);
}
const tallyOf = (k: string): Record<string, number> => JSON.parse(island[k] ?? '{}') as Record<string, number>;
const mine = tallyOf('ME');
const theirs = tallyOf('THEM');
const ISLAND: Array<[string, string]> = [
  ['evolving to stage 2 and 3 counts each stage for its keeper', 'evolved:1,evolved:2'],
  ['a mutation, a line and a wild form at birth count for the dam\'s keeper', 'mutated,line:3,bred:form'],
  ['a trail read from the Field guide counts', 'tracked'],
  ['a bronze mirror used at a covering counts', 'mirrored'],
  ['an ancient lamp that kindles a trait counts', 'rekindled'],
  ['a worker lying down in a bed its keeper built counts', 'bedded:own'],
  ['a spar on a settlement counts for the Sparra\'s keeper', 'sparred'],
  ['a rune gate, a portcullis and a hidden door finished count each by type', 'built:rune_gate,built:portcullis,built:hidden_door'],
  ['a drawbridge finished counts by kind', 'bridged:draw'],
  ['a cellar dug out and something dropped on its floor count', 'cellar,cellared'],
  ['a spring dug counts', 'spring'],
  ['a crop harvested under glass counts', 'harvest:glass'],
  ['a floor on piers, an outside staircase and a third storey count', 'pier,outstair,storey:3'],
  ['stepping stones and a water plant count', 'stones,waterplant'],
  ['work delivered by another citizen counts for whoever set it', 'delivered'],
  ['an aqueduct finished with a spring\'s water along it counts', 'aqueduct'],
  ['a bucket out of a well you built counts', 'well:own'],
  ['a raw material bin filled to full counts', 'binfull'],
  ['a Field guide page tamed and bred, and a wild form tamed, count off the book', 'guide:page,tamed:form'],
];
for (const [what, keys] of ISLAND) {
  const missing = keys.split(',').filter((k) => !(mine[k] > 0));
  check(`island: ${what}`, missing.length === 0, missing.length ? `missing ${missing.join(', ')}; ${island.ME}` : '');
}
check('island: none of it counts for anybody else', Object.keys(theirs).length === 0, island.THEM);
check('island: a kind\'s page counts as a kind seen, a stage\'s and a form\'s do not', mine['guide:seen'] === 2, island.ME);
for (const [k, v] of Object.entries(island)) if (k.startsWith('SAY_')) check(`island: ${k.slice(4)}`, v === 'ok', v);

// Every count a goal of this part reads is noted somewhere on the island, but those only a browser sees.
const keys = new Set<string>();
for (const m of readFileSync('src/game/journal-a.ts', 'utf8').matchAll(/did\('([^']+)'/g)) keys.add(m[1]);
for (const ks of Object.values(COUNTED)) for (const k of ks) keys.add(k);
keys.add('guide:seen');
const defs = psql(`select string_agg(pg_get_functiondef(p.oid), ' ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%journal_%'`);
const prefixed = (k: string): boolean => {
  const i = k.indexOf(':');
  return i > 0 && defs.includes(`'${k.slice(0, i + 1)}'`);
};
const unnoted = [...keys].filter((k) => !BROWSER_TALLY.has(k) && !defs.includes(`'${k}'`) && !prefixed(k));
check(`every count this part reads (${keys.size}) is noted on the island`, unnoted.length === 0, unnoted.join(', '));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ngoals of the wildermon and of a settlement — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
