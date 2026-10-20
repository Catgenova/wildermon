/**
 * The browser's errands time and teach a go as the island's do, and the island's reed cutter cuts what its words say.
 *
 * Found while evening out the time to evolve (`learnrate.ts`): in the browser a mender went at a go every second and a
 * half where the island takes a go's work time (`workDuration`, `work_duration` at its stage, its care and its pace),
 * a water carrier, a hod carrier, a planter and a stoker took no work time at all, a prospector rested two seconds;
 * clearing up rot was an errand in the browser and a trade that walks out to a tile on the island; and a fetcher, a
 * stoker and a clearer of rot learned less a go than on the island. Asked for: "Make the browser match the island (the
 * island runs the live world)". And the other way: the island's reed cutter cut 1 reed a go at any level where the
 * browser, the Reedpup's words and the help give 1 and 1 more for every `REED_LEVELS`; "Make the island match the
 * browser (that is what the text promises)." This asks:
 *
 *   * in the browser, that each of those errands holds the worker a go's work time (`workDuration` over `taskMul`) after
 *     each go, at the fill and the pour both for water, and the half second the island waits after a fetch out of the
 *     stores for a hod carrier, a planter and a stoker;
 *   * on both sides, what a go teaches a stoker, a fetcher and a clearer of rot, at the same roll;
 *   * that clearing up rot walks out to a tile in the browser, and is no errand on the island;
 *   * on both sides, the reeds a cut at levels round each step of `REED_LEVELS`;
 *   * and that the Stitchkit's words say a go's time off the rule, not a second and a half.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { GATHER_SKILL, learnPace, REED_LEVELS, SKILL_TOP, SPECIES, workDuration, type Creature, type GatherKind } from '../../src/game/creatures';
import { skillGain } from '../../src/game/skills';
import { TileType } from '../../src/world/tiles';

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
const near = (a: number, b: number, by = 1e-6): boolean => Math.abs(a - b) <= by * Math.max(1, Math.abs(b));
const T = 16;
const U = '7e5b0000-0000-4000-8000-0000000000e7';
// What a go teaches, the base of a gain, as the island has it.
const BASE: Partial<Record<GatherKind, number>> = { stoke: 0.2, fetch: 0.225, compost: 0.225 };
const REED_AT = [10, REED_LEVELS - 1, REED_LEVELS, 2 * REED_LEVELS, SKILL_TOP];

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; a int; c creature; v double precision; r double precision; x0 double precision; v_fire bigint; got jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Agree', 177, 40, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 40);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 39) x, generate_series(0, 39) y;
  perform land_set_tile(w, x, ${T + 4}, tile_id('Reed')) from generate_series(${T - 2}, ${T + 2}) x;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Agreestead', ${T}, ${T}, 10, 5, u);
  insert into said values ('ERRAND', worker_errand('compost')::text || ',' || worker_errand('mend')::text);

  -- Reeds a cut, at each level.
  a := creature_spawn(w, 'sedra', ${T} + 0.5, ${T + 3} + 0.5, 'deed', now() - interval '30 days', u);
  ${REED_AT.map((lv) => `
  update creature set traits = '{}', rare = null, care = 0, skills = jsonb_build_object('foraging', ${lv}), work_x = ${T}, work_y = ${T + 4}
   where world_id = w and id = a;
  got := worker_do(w, a);
  insert into said values ('REED${lv}', got->>'count');
  delete from foraged where world_id = w;`).join('')}
  delete from creature where world_id = w and id = a;

  -- A stoker's go at a cold campfire, with a log in its arms.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, fuel, lit)
    values (w, 'campfire', null, ${T + 3}, ${T}, 0, 0, ${T + 3} + 0.5, ${T} + 0.5, 40, u, 0, false) returning id into v_fire;
  a := creature_spawn(w, 'embra', ${T + 3} + 0.5, ${T} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, skills = jsonb_build_object('smelting', 10), work_x = ${T + 3}, work_y = ${T},
         carrying = '{"def": "log", "count": 1, "ql": 30}'::jsonb where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  v := (c.skills->>'smelting')::double precision;
  perform setseed(0.3); r := random();
  x0 := skill_gain_of(v, ${BASE.stoke} * beast_mul(c, 'learn') * learn_pace(c, 'smelting'), 0.6 + 0.8 * r);
  perform setseed(0.3);
  perform errand_do(w, a);
  insert into said select 'STOKE', ((cr.skills->>'smelting')::double precision - v) || ',' || x0 from creature cr where cr.world_id = w and cr.id = a;
  delete from creature where world_id = w and id = a;

  -- A fetcher's and a clearer's go at something lying on the deed.
  ${(['fetch', 'compost'] as const).map((k) => `
  insert into item (world_id, holder, gx, gy, def, ql, dmg, count) values (w, 'ground', ${T + 2}, ${T + 2}, 'log', 30, 60, 1);
  a := creature_spawn(w, '${k === 'fetch' ? 'magga' : 'middun'}', ${T + 2} + 0.5, ${T + 2} + 0.5, 'deed', now() - interval '30 days', u);
  update creature set traits = '{}', rare = null, care = 0, skills = jsonb_build_object('${GATHER_SKILL[k]}', 10), work_x = ${T + 2}, work_y = ${T + 2}
   where world_id = w and id = a;
  select * into c from creature where world_id = w and id = a;
  v := (c.skills->>'${GATHER_SKILL[k]}')::double precision;
  perform setseed(0.4); r := random();
  x0 := skill_gain_of(v, ${BASE[k]} * beast_mul(c, 'learn') * learn_pace(c, '${GATHER_SKILL[k]}'), 0.6 + 0.8 * r);
  perform setseed(0.4);
  got := worker_do(w, a);
  insert into said select '${k.toUpperCase()}', ((cr.skills->>'${GATHER_SKILL[k]}')::double precision - v) || ',' || x0 || ',' || coalesce(got->>'def', '-')
    from creature cr where cr.world_id = w and cr.id = a;
  delete from creature where world_id = w and id = a;
  delete from item where world_id = w and holder = 'ground';`).join('')}
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

/* ---- in the browser ---------------------------------------------------------------------------------------------- */

const g = Game.create(4259);
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
for (let y = T - 12; y <= T + 12; y++) for (let x = T - 12; x <= T + 12; x++) { g.world.setHeight(x, y, 4); g.world.setDirt(x, y, 5); g.world.setTile(x, y, TileType.Grass, 0); }
for (let x = T - 2; x <= T + 2; x++) g.world.setTile(x, T + 4, TileType.Reed, 0);
g.player.x = T + 0.5;
g.player.y = T + 0.5;
g.deed = { name: 'Agreestead', x: T, y: T, radius: 10, level: 5, mine: true };
g.crates.clear();
for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
const crate = g.addCrate('plank', T + 1, T, 0, 0, [], true);
g.rand = () => 0.5;
const ROLL = 0.6 + 0.8 * 0.5;
const cr = g.creatures as unknown as Record<string, (...a: unknown[]) => unknown>;
const call = (name: string, ...a: unknown[]): unknown => cr[name].call(g.creatures, ...a);
const yes = (): boolean => true;
const worker = (sp: string, skill: string, lv = 10, x = T + 1.5, y = T + 0.5): Creature => {
  const c = g.creatures.spawn(sp, x, y, 'deed', g.rand, g.time - 3600 * 24 * 30);
  Object.assign(c, { traits: [], rare: 0, care: 0, hunger: 1, stance: 'passive', skills: { [skill]: lv }, busyUntil: 0 });
  return c;
};
const stock = (id: string, count = 5, dmg = 0, extra?: string): void => {
  crate.items.splice(0, crate.items.length, { uid: g.inventory.nextUid++, id, ql: 40, dmg, count, ...(extra ? { extra } : {}) });
};
/** The time a go holds it, against a go's work time at its pace. */
const held = (c: Creature, kind: GatherKind): [number, number] =>
  [c.busyUntil - g.time, workDuration(c.skills[GATHER_SKILL[kind]] ?? 1) / g.creatures.taskMul(c, kind)];
const timed = (what: string, c: Creature, kind: GatherKind): void => {
  const [got, want] = held(c, kind);
  check(`in the browser, ${what} holds it a go's work time, ${want.toFixed(2)} seconds, as on the island`, near(got, want), `${got}`);
  c.busyUntil = 0;
};
const oneGain = (c: Creature, skill: string, base: number): number => skillGain(c.skills[skill], base * g.creatures.learnMul(c, g.time) * learnPace(c, skill), ROLL);

// A mender's go.
{
  stock('hatchet', 1, 60);
  const c = worker('tinka', 'repair');
  call('mendStep', g, c, yes);
  timed('a mender\'s go', c, 'mend');
  g.creatures.remove(c.id);
}
// A water carrier's fill at the well and pour into a barrel.
{
  const well = g.addFurniture('well', T + 3, T + 3, 0, 0, 40);
  well.litres = 100;
  g.addFurniture('barrel', T - 3, T, 0, 0, 40);
  const c = worker('holla', 'carrying', 10, T + 3.5, T + 3.5);
  call('waterStep', g, c, 0.05, 20, yes, yes);
  timed('a water carrier\'s fill', c, 'water');
  call('waterStep', g, c, 0.05, 20, yes, yes);
  timed('and its pour', c, 'water');
  g.creatures.remove(c.id);
}
// A planter: a sprout out of the stores, and in the ground.
{
  stock('sprout', 2, 0, 'Oak');
  const c = worker('sappa', 'forestry');
  call('plantStep', g, c, yes, yes, 8, { x: T, y: T });
  check('in the browser, a planter waits half a second after a fetch out of the stores, as the island does', near(c.busyUntil - g.time, 0.5) && c.carrying?.id === 'sprout', `${c.busyUntil - g.time}`);
  c.busyUntil = 0;
  // Where to put it is a draw of spots round the token, which one fixed roll would put on the token itself.
  let n = 0;
  g.rand = () => ((n++ * 0.618) % 1);
  call('plantStep', g, c, yes, yes, 8, { x: T, y: T });
  g.rand = () => 0.5;
  timed('a planter\'s go', c, 'plant');
  g.creatures.remove(c.id);
}
// A prospector's reading.
{
  const c = worker('dowse', 'prospecting');
  c.workX = -1;
  let n = 0;
  g.rand = () => ((n++ * 0.618) % 1);
  call('prospectStep', g, c, yes, yes, 8, { x: T, y: T });
  g.rand = () => 0.5;
  timed('a prospector\'s reading', c, 'prospect');
  g.creatures.remove(c.id);
}
// A stoker: fuel out of the stores, and into a cold campfire.
{
  stock('log', 3);
  const fire = g.addCampfire(T - 4, T - 4, 0, 0, 0, false);
  const c = worker('embra', 'smelting');
  call('stokeStep', g, c, 0.05, { x: T, y: T, radius: 10 });
  check('in the browser, a stoker waits half a second after a fetch out of the stores, as the island does', near(c.busyUntil - g.time, 0.5) && c.carrying?.id === 'log', `${c.busyUntil - g.time}`);
  c.busyUntil = 0;
  [c.x, c.y] = [c.workX + 0.5, c.workY + 0.5];
  const was = c.skills.smelting;
  const one = oneGain(c, 'smelting', BASE.stoke!);
  call('feedFire', g, c, 0.05);
  check('a stoker\'s go feeds the fire', fire.fuel > 0 && fire.lit, `${fire.fuel}`);
  timed('a stoker\'s go', c, 'stoke');
  check(`and teaches what the island's does, at the same roll (a base of ${BASE.stoke})`, near(c.skills.smelting - was, one), `${c.skills.smelting - was} against ${one}`);
  g.creatures.remove(c.id);
}
// A hod carrier: a piece out of the stores, and fitted into a floor.
{
  const shed = g.buildings.create('Shed', T + 2, T + 1);
  const floor = g.buildings.setFloor(shed, 0, T + 2, T + 1, 'stone_brick', 'floor');
  const [item] = Object.keys(floor.needed);
  stock(item, 10);
  const c = worker('cobbe', 'masonry');
  call('hodStep', g, c, 0.05, yes, yes, { x: T, y: T }, 8);
  check('in the browser, a hod carrier waits half a second after a fetch out of the stores, as the island does', near(c.busyUntil - g.time, 0.5) && c.carrying?.id === item, `${c.busyUntil - g.time}`);
  c.busyUntil = 0;
  call('hodStep', g, c, 0.05, yes, yes, { x: T, y: T }, 8);
  timed('a hod carrier\'s go', c, 'hod');
  g.creatures.remove(c.id);
}
crate.items.splice(0);

// A fetcher's and a clearer's go at something lying about.
for (const k of ['fetch', 'compost'] as const) {
  g.dropOnGround(T + 2, T + 2, { uid: g.inventory.nextUid++, id: 'log', ql: 30, dmg: 60, count: 1 });
  const c = worker(k === 'fetch' ? 'magga' : 'middun', GATHER_SKILL[k], 10, T + 2.5, T + 2.5);
  if (k === 'compost') {
    c.until = g.time - 1;
    c.x = T + 0.5;
    c.y = T + 0.5;
    call('updateWorker', c, 0.05, g);
    check('in the browser, clearing up rot walks out to the tile it lies on, a trade and no errand, as on the island',
      c.state === 'toForage' && c.workX === T + 2 && c.workY === T + 2 && at('ERRAND') === 'false,true', `${c.state} ${c.workX},${c.workY} / island ${at('ERRAND')}`);
    c.x = T + 2.5;
    c.y = T + 2.5;
  }
  c.workX = T + 2;
  c.workY = T + 2;
  const skill = GATHER_SKILL[k];
  const was = c.skills[skill];
  const one = oneGain(c, skill, BASE[k]!);
  const got = call('finishForage', g, c, k) as { id: string } | null;
  const [gain, x0, def] = at(k.toUpperCase()).split(',');
  check(`a ${k === 'fetch' ? 'fetcher' : 'clearer of rot'}'s go teaches the same on both sides, at the same roll (a base of ${BASE[k]})`,
    near(c.skills[skill] - was, one) && near(Number(gain), Number(x0)), `browser ${c.skills[skill] - was}/${one}, island ${gain}/${x0}`);
  check(`and brings home ${k === 'fetch' ? 'what lay there' : 'compost'} on both sides`, got?.id === (k === 'fetch' ? 'log' : 'compost') && def === got?.id, `${got?.id} / ${def}`);
  g.creatures.remove(c.id);
}
{
  const [gain, x0] = at('STOKE').split(',').map(Number);
  check(`on the island a stoker's go teaches a base of ${BASE.stoke}, as the browser's now does`, near(gain, x0), at('STOKE'));
}

// Reeds a cut.
for (const lv of REED_AT) {
  const c = worker('sedra', 'foraging', lv, T + 0.5, T + 3.5);
  c.workX = T;
  c.workY = T + 4;
  g.world.setTile(T, T + 4, TileType.Reed, 0);
  const got = call('finishReed', g, c) as { count: number } | null;
  const want = 1 + Math.floor(lv / REED_LEVELS);
  check(`a reed cutter at ${lv} foraging cuts ${want} a cut on both sides`, got?.count === want && at(`REED${lv}`) === String(want), `browser ${got?.count}, island ${at(`REED${lv}`)}`);
  g.creatures.remove(c.id);
}

/* ---- the words ---------------------------------------------------------------------------------------------------- */

check('the Stitchkit\'s words say a go\'s time off the rule, not a second and a half',
  SPECIES.tinka.description.includes(`Time per go: ${Math.round(workDuration(1))} seconds at level 1, ${Math.round(workDuration(SKILL_TOP))} at level ${SKILL_TOP}`)
  && !SPECIES.tinka.description.includes('a go every'), SPECIES.tinka.description);
check('and the Reedpup\'s say its armful off the rule', SPECIES.sedra.description.includes(`Reeds per cut: 1, +1 per ${REED_LEVELS} levels`), SPECIES.sedra.description);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe browser's errands and the island's reed cutter agree — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
