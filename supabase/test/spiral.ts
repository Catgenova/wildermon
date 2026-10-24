/**
 * The spiral staircase, the same on both sides.
 *
 * A staircase with the hand 's' (`SPIRAL`): a tile a storey, wound round a
 * post, stepped onto and off at the storey it is walked on across any side,
 * a storey up or down it a climb on its own tile (`Game.liftRule`,
 * `spiral_lift_ok`), stacked a storey over a storey on one tile -- down to a
 * cellar too -- and walked on foot only. Put to both:
 *
 *   * planned: no side asked, inside, as an outside staircase and down to a
 *     cellar, in the same words; the same floor tile, with no side and the
 *     hand, and the single staircase's share of the bill; refused where a
 *     single one is, and over or under a flight of another sort, in the same
 *     words; stacked on a spiral;
 *   * built a unit at a time with the material's tool, and Examine of an
 *     outside one;
 *   * walked: onto its tile from each side at the storey walked on, up and
 *     down it on the tile, off it at the top across each side, never off its
 *     head down to the storey under it; a walk from the ground up the stack
 *     to storey 4, replayed a step at a time through `rpc_move` and never
 *     held back; a change of storey on a tile with no spiral held back on the
 *     island; down to the cellar and back up on its tile;
 *   * mounts, carts and wagons: no way onto it or up it in the browser, and a
 *     mounted walk to it says so; held back on the island, saying the same;
 *   * storey mode: a pinned storey's click answers on its tile, and a walk to
 *     it pinned ends up there.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on
 * it, on the ground `outstairs.ts` uses, and puts the ground, his settlement
 * and Dane back after.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { CELLAR_DEPTH, CELLAR_LEVEL, floorBill, isDone, SINGLE_STAIRS_SHARE, SPIRAL, SPIRAL_FOOT_SAID, SPIRAL_STAIRS_NAME, WALL_HEIGHT, type Side } from '../../src/game/building';
import { frameSays } from '../../src/game/frameActions';
import { Game } from '../../src/game/game';
import { storeyHeight, storeyTileAt } from '../../src/game/storeyview';
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
const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;

/* ---- the ground, as it was, to be put back ------------------------------- */
const X0 = 14, X1 = 28, Y0 = 19, Y1 = 33;
const heightsWere = psql(`select string_agg(gx || ',' || gy || ',' || coalesce(land_height(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1 + 1}) gx, generate_series(${Y0}, ${Y1 + 1}) gy;`);
const tilesWere = psql(`select string_agg(gx || ',' || gy || ',' || land_tile(${W}, gx, gy) || ',' || coalesce(land_data(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;`);
const daneWas = psql(`select x || ',' || y || ',' || level from player where world_id = ${W} and name = 'Dane';`);
const deedWas = psql(`select coalesce((select x || ',' || y || ',' || radius || ',' || level from deed
  where world_id = ${W} and founded_by = ${DANE}), '');`);

/* ---- the same ground on both sides: level grass at twenty ------------------ */
const BASE = 20;
const game = Game.create(4243);
const bld = game.buildings;
const world = game.world;
(game as unknown as { deed: unknown }).deed = { name: 'Latecomer', x: 21, y: 26, radius: 5, level: 1, mine: true };
for (let y = Y0; y <= Y1 + 1; y++) for (let x = X0; x <= X1 + 1; x++) world.setHeight(x, y, BASE);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) world.setTile(x, y, TileType.Grass, 0);
for (const it of [...game.inventory.items]) game.inventory.remove(it.uid, it.count);
game.inventory.add('mallet', { ql: 40 });
game.inventory.add('saw', { ql: 40 });
game.skills.values.set('carpentry', 90);
game.player.x = 18.5;
game.player.y = 30.5;
game.player.level = 0;

psql(`
do $$
declare w uuid; u uuid; gx int; gy int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w and name = 'Dane';
  delete from wall where world_id = w;
  delete from floor_tile where world_id = w;
  delete from building_column where world_id = w;
  delete from cellar_tile where world_id = w;
  delete from building_tile where world_id = w;
  delete from building where world_id = w;
  delete from bridge where world_id = w;
  delete from item where world_id = w and holder = 'player' and holder_uid = u
    and def in ('mallet', 'saw', 'trowel', 'plank', 'timber', 'log', 'nails');
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'mallet', 40, 1), (w, 'player', u, 'saw', 40, 1);
  for gx in ${X0}..${X1 + 1} loop for gy in ${Y0}..${Y1 + 1} loop perform land_set_height(w, gx, gy, ${BASE}); end loop; end loop;
  for gx in ${X0}..${X1} loop for gy in ${Y0}..${Y1} loop
    perform land_set_tile(w, gx, gy, tile_id('Grass')); perform land_set_data(w, gx, gy, 0);
  end loop; end loop;
  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', 90)
    on conflict (world_id, uid, id) do update set value = 90;
  if exists (select 1 from deed where world_id = w and founded_by = u) then
    update deed set x = 21, y = 26, radius = 5, level = 1 where world_id = w and founded_by = u;
  else
    insert into deed (world_id, name, x, y, radius, founded_by) values (w, 'Latecomer', 21, 26, 5, u);
  end if;
  update player set body_at = now(), x = 18.5, y = 30.5, level = 0, aboard = null where world_id = w and uid = u;
  update creature set rider = null where world_id = w and rider = u;
end $$;`);

/* ---- building on both sides at once ---------------------------------------- */
const sql = (s: string): void => {
  psql(`do $$ declare w uuid; u uuid; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    ${s}
  end $$;`);
};
const building = (id: number, name: string, tiles: Array<[number, number]>, levels: number): void => {
  const b = bld.create(name, tiles[0][0], tiles[0][1]);
  if (b.id !== id) throw new Error(`the browser numbered ${name} ${b.id}, not ${id}`);
  for (const [x, y] of tiles.slice(1)) bld.addTile(b, x, y);
  b.levels = levels;
  b.workLevel = levels - 1;
  sql(`insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${id}, '${name}', ${levels}, ${levels - 1}, u);
    insert into building_tile (world_id, building, x, y) values ${tiles.map(([x, y]) => `(w, ${id}, ${x}, ${y})`).join(', ')};`);
};
/** A finished floor tile on both sides: a floor, or a flight with its side and its hand. */
const floor = (id: number, level: number, x: number, y: number, kind: 'floor' | 'stairs' = 'floor', facing?: Side, hand?: 'l' | 's'): void => {
  const f = bld.setFloor(bld.list.get(id)!, level, x, y, 'plank', kind, facing, hand);
  for (const k of Object.keys(f.needed)) f.needed[k] = 0;
  sql(`delete from floor_tile where world_id = w and level = ${level} and x = ${x} and y = ${y};
    insert into floor_tile (world_id, level, x, y, building, material, kind, facing, hand, needed, total)
    values (w, ${level}, ${x}, ${y}, ${id}, 'plank', '${kind}', ${f.facing ? `'${f.facing}'` : 'null'}, ${f.hand ? `'${f.hand}'` : 'null'},
            '${JSON.stringify(f.needed)}', '${JSON.stringify(f.total)}');`);
};
const finish = (level: number, x: number, y: number): void => {
  const f = bld.floor(level, x, y)!;
  for (const k of Object.keys(f.needed)) f.needed[k] = 0;
  sql(`update floor_tile set needed = (select jsonb_object_agg(k, 0) from jsonb_object_keys(total) k)
    where world_id = w and level = ${level} and x = ${x} and y = ${y};`);
};

/** What each side says to a job: the browser's check, and the island's `build_refusal`. */
const say = (id: string, target: Record<string, unknown>): [string, string] => {
  const t = { kind: 'tile', cx: target.x, cy: target.y, ...target };
  const a = ACTION_BY_ID.get(id);
  if (!a) throw new Error(`there is no ${id}`);
  const mine = a.check?.(t as never, game) ?? 'ALLOWED';
  const theirs = psql(`select coalesce(build_refusal(${W}, ${DANE}, '${id}', '${JSON.stringify(t).replace(/'/g, "''")}'::jsonb), 'ALLOWED');`);
  return [mine, theirs];
};
const same = (what: string, id: string, target: Record<string, unknown>, want: string): void => {
  const [mine, theirs] = say(id, target);
  check(what, mine === want && theirs === want, `browser "${mine}", island "${theirs}"`);
};
/** Do a job on both sides, and what each said doing it. */
const both = (id: string, target: Record<string, unknown>, prefix: string): [string, string] => {
  const t = { kind: 'tile', cx: target.x, cy: target.y, ...target };
  game.log.length = 0;
  ACTION_BY_ID.get(id)?.perform(t as never, game);
  const mine = game.log.map((l) => l.text).find((s) => s.startsWith(prefix)) ?? 'NOTHING SAID';
  psql(`delete from event where world_id = ${W} and uid = ${DANE};`);
  psql(`select perform_building(${W}, ${DANE}, '${id}', '${JSON.stringify(t)}'::jsonb);`);
  const theirs = psql(`select text from event where world_id = ${W} and uid = ${DANE} and text like '${prefix.replace(/'/g, "''")}%' order by n desc limit 1;`) || 'NOTHING SAID';
  return [mine, theirs];
};
/** A floor tile as each side holds it: its storey, its kind, the side it is climbed from, its hand and its bill. */
const rowOf = (level: number, x: number, y: number): [string, string] => {
  const f = bld.floor(level, x, y);
  const sorted = (b: Record<string, number>): string => JSON.stringify(Object.fromEntries(Object.entries(b).sort()));
  const mine = f ? `${f.level}|${f.kind}|${f.facing ?? '-'}|${f.hand ?? '-'}|${sorted(f.needed)}|${sorted(f.total)}` : 'NONE';
  const theirs = psql(`select coalesce((select level || '|' || kind || '|' || coalesce(facing, '-') || '|' || coalesce(hand, '-')
      || '|' || needed::text || '|' || total::text from floor_tile
     where world_id = ${W} and level = ${level} and x = ${x} and y = ${y}), 'NONE');`).replace(/ /g, '');
  return [mine, theirs];
};
/** The path the body is walking, read afresh: what a call has just set. */
const pathOf = (g: Game): Array<{ x: number; y: number; level: number }> => g.player.path ?? [];
const sortedBill = (b: Record<string, number>): string => JSON.stringify(Object.fromEntries(Object.entries(b).sort()));

/* ---- a hall of nine tiles, four storeys ----------------------------------------
 *
 *   (20,24) (21,24) (22,24)    plank floors on storeys 2 to 4 but where said;
 *   (20,25) (21,25) (22,25)    the spiral stack goes on (21,25), its middle;
 *   (20,26) (21,26) (22,26)    a single staircase on storey 3 of (20,24), and
 *                              nothing over it on storey 4; nothing on storey 2
 *                              of (22,26) or of (20,26), whose cellar is dug.
 *   (23,25)                    open ground east of it: an outside spiral.
 */
const HALL: Array<[number, number]> = [];
for (let y = 24; y <= 26; y++) for (let x = 20; x <= 22; x++) HALL.push([x, y]);
building(1, 'Hall', HALL, 4);
const S = { x: 21, y: 25 };
for (let level = 1; level <= 3; level++) {
  for (const [x, y] of HALL) {
    if (x === S.x && y === S.y) continue;
    if (level === 1 && ((x === 22 && y === 26) || (x === 20 && y === 26))) continue;
    if (x === 20 && y === 24 && level === 3) continue;
    if (x === 20 && y === 24 && level === 2) floor(1, level, x, y, 'stairs', 's', 'l');
    else floor(1, level, x, y);
  }
}
bld.setCellar(1, 20, 26, CELLAR_DEPTH);
sql(`insert into cellar_tile (world_id, x, y, building, dug) values (w, 20, 26, 1, ${CELLAR_DEPTH});`);

const SPIRAL_AT = (level: number, extra: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ x: S.x, y: S.y, material: 'plank', floorKind: 'stairs', hand: SPIRAL, buildingId: 1, level, ...extra });

/* ---- planned ----------------------------------------------------------------- */
same('a spiral staircase asks for no side: allowed on storey 2 with none', 'plan_floor', SPIRAL_AT(1), 'ALLOWED');
same('a wide one with no side is still asked for one', 'plan_floor', { ...SPIRAL_AT(1), hand: undefined }, 'Choose the side to climb from.');
same('refused where a single one is: no floor planned under it on storey 3', 'plan_floor', { ...SPIRAL_AT(2), x: 22, y: 26 }, 'Plan the floor below first.');
same('nor over a single staircase', 'plan_floor', { ...SPIRAL_AT(3), x: 20, y: 24 }, 'Single staircase below: spirals stack on spirals only.');
{
  const [mine, theirs] = both('plan_floor', SPIRAL_AT(1), 'Planned: ');
  const want = `Planned: plank ${SPIRAL_STAIRS_NAME}. Needs `;
  check('planned, both sides say the same, naming a spiral staircase', mine === theirs && mine.startsWith(want), `browser "${mine}", island "${theirs}"`);
  const [rm, rt] = rowOf(1, S.x, S.y);
  const bill = floorBill('plank', 'stairs', undefined, SPIRAL);
  const single = floorBill('plank', 'stairs', undefined, 'l');
  const want2 = `1|stairs|-|s|${sortedBill(bill.needed)}|${sortedBill(bill.total)}`;
  check(`the same floor tile on both sides: no side it is climbed from, the hand s, and a single staircase's bill (${SINGLE_STAIRS_SHARE} of a wall's)`,
    rm === rt && rm === want2 && sortedBill(bill.total) === sortedBill(single.total), `browser ${rm}; island ${rt}; want ${want2}`);
}
same('planned again over itself, it is already there', 'plan_floor', SPIRAL_AT(1), 'Floor already planned here.');
same('a wide staircase on storey 3 over it is refused', 'plan_floor', { ...SPIRAL_AT(2), hand: undefined, side: 's' }, 'Spiral staircase below: spirals stack on spirals only.');
same('a spiral one stacks on it', 'plan_floor', SPIRAL_AT(2), 'ALLOWED');

/* ---- built ------------------------------------------------------------------- */
{
  const [mine, theirs] = say('build_floor', { x: S.x, y: S.y, buildingId: 1, level: 1, floorKind: 'stairs' });
  check('built as any flight of its material: short of what it needs, both sides say what', mine === theirs && mine.startsWith('Need '), `browser "${mine}", island "${theirs}"`);
}
{
  const bill = floorBill('plank', 'stairs', undefined, SPIRAL);
  for (const [def, n] of Object.entries(bill.needed)) game.inventory.add(def, { ql: 40, count: n });
  sql(`${Object.entries(bill.needed).map(([def, n]) => `insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, '${def}', 40, ${n});`).join('\n')}`);
  const t = { kind: 'tile', x: S.x, y: S.y, cx: S.x, cy: S.y, buildingId: 1, level: 1, floorKind: 'stairs' };
  const build = ACTION_BY_ID.get('build_floor')!;
  let refusedMine = '';
  for (let i = 0; i < 100 && !isDone(bld.floor(1, S.x, S.y)!); i++) {
    const why = build.check?.(t as never, game);
    if (why) { refusedMine = why; break; }
    build.perform(t as never, game);
  }
  const theirs = psql(`do $$ declare w uuid; u uuid; v text; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    for i in 1..100 loop
      exit when (select bill_done(needed) from floor_tile where world_id = w and level = 1 and x = ${S.x} and y = ${S.y});
      v := build_refusal(w, u, 'build_floor', '${JSON.stringify(t)}'::jsonb);
      if v is not null then raise notice '%', v; exit; end if;
      perform perform_building(w, u, 'build_floor', '${JSON.stringify(t)}'::jsonb);
    end loop;
  end $$;
  select case when bill_done(needed) then 'DONE' else 'NOT DONE' end from floor_tile where world_id = ${W} and level = 1 and x = ${S.x} and y = ${S.y};`);
  const mine = isDone(bld.floor(1, S.x, S.y)!);
  check('built a unit at a time, it is finished on both sides', mine && theirs === 'DONE',
    `browser ${mine ? 'finished' : `not finished${refusedMine ? `, "${refusedMine}"` : ''}`}, island ${theirs}`);
}
// The rest of the stack, on storeys 3 and 4, finished.
both('plan_floor', SPIRAL_AT(2), 'Planned: ');
finish(2, S.x, S.y);
same('and another on storey 4 over that', 'plan_floor', SPIRAL_AT(3), 'ALLOWED');
both('plan_floor', SPIRAL_AT(3), 'Planned: ');
finish(3, S.x, S.y);

/* ---- down to the cellar -------------------------------------------------------- */
const DOWN = { x: 20, y: 26, material: 'plank', floorKind: 'stairs', hand: SPIRAL, buildingId: 1, down: true };
same('a spiral staircase down to the dug cellar under its tile asks for no side, nor a foot', 'plan_floor', DOWN, 'ALLOWED');
same('a wide one down still asks for its side', 'plan_floor', { ...DOWN, hand: undefined }, 'Choose the side to climb from.');
both('plan_floor', DOWN, 'Planned: ');
finish(0, 20, 26);
same('a spiral one up from the ground floor stacks on it', 'plan_floor', { ...SPIRAL_AT(1), x: 20, y: 26, down: undefined }, 'ALLOWED');
same('a wide one up from it does not, as before', 'plan_floor', { ...SPIRAL_AT(1), x: 20, y: 26, hand: undefined, side: 'n' }, 'Staircase down to the cellar is there.');

/* ---- outside ------------------------------------------------------------------- */
const OUT = { x: 23, y: 25, material: 'plank', floorKind: 'stairs', hand: SPIRAL, buildingId: 1, level: 1 };
same('an outside spiral staircase beside the building asks for no side', 'plan_floor', OUT, 'ALLOWED');
same('to storey 2 only, as any outside staircase', 'plan_floor', { ...OUT, level: 2 }, 'Outside staircase: ground to storey 2. Switch to storey 2.');
world.setTile(23, 25, TileType.Tree, 0);
sql(`perform land_set_tile(w, 23, 25, tile_id('Tree'));`);
same('nor on a tree', 'plan_floor', OUT, 'Needs open ground: clear the tree or bush first.');
world.setTile(23, 25, TileType.Grass, 0);
sql(`perform land_set_tile(w, 23, 25, tile_id('Grass'));`);
both('plan_floor', OUT, 'Planned: ');
{
  const mine = frameSays(game, 23, 25).trim();
  const theirs = psql(`select trim(frame_says(${W}, 23, 25));`);
  check('Examine of one still planned, the same on both sides', mine === theirs && mine === `Outside ${SPIRAL_STAIRS_NAME} planned: up to Hall storey 2.`,
    `browser "${mine}", island "${theirs}"`);
  finish(1, 23, 25);
  const done = frameSays(game, 23, 25).trim();
  const doneTheirs = psql(`select trim(frame_says(${W}, 23, 25));`);
  check('and finished: climbed from any side', done === doneTheirs && done === `Outside ${SPIRAL_STAIRS_NAME}: up to Hall storey 2, climbed from any side.`,
    `browser "${done}", island "${doneTheirs}"`);
  const [rm, rt] = rowOf(1, 23, 25);
  check('kept with no side on both sides', rm === rt && rm.startsWith('1|stairs|-|s|'), `browser ${rm}; island ${rt}`);
}

/* ---- walked, in the browser ------------------------------------------------------ */
const ROUND: Array<[Side, number, number]> = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0]];
{
  const onto = ROUND.map(([side, dx, dy]) => `${side} ${[0, 1, 2, 3].map((l) => game.stepRule(S.x + dx, S.y + dy, l, S.x, S.y)).join('')}`);
  check('onto its tile from every side, at every storey, at the storey walked on', onto.every((s) => s.endsWith('0123')), onto.join(', '));
  const off = ROUND.map(([side, dx, dy]) => `${side} ${[0, 1, 2, 3].map((l) => game.stepRule(S.x, S.y, l, S.x + dx, S.y + dy)).join('')}`);
  check('and off it across every side at every storey, to the same storey', off.every((s) => s.endsWith('0123')), off.join(', '));
  const lifts = [0, 1, 2, 3].map((l) => `${l}:${[...game.liftRule(S.x, S.y, l)].sort().join('/')}`).join(' ');
  check('up and down the stack on its tile: storey 1 up, 2 and 3 up and down, 4 down', lifts === '0:1 1:0/2 2:1/3 3:2', lifts);
  const plain = [...game.liftRule(22, 25, 1)].join('/') || 'none';
  check('and no storey changed on a tile with none', plain === 'none', plain);
  const outLift = `${[...game.liftRule(23, 25, 0)].join('/')}|${[...game.liftRule(23, 25, 1)].join('/')}`;
  const jump = game.stepRule(23, 25, 1, 24, 25);
  const foot = [game.stepRule(23, 24, 0, 23, 25), game.stepRule(24, 25, 0, 23, 25), game.stepRule(23, 26, 0, 23, 25)].join('');
  check('the outside one: onto it from the ground across any side, up it on the tile, and no stepping off its head onto the ground',
    outLift === '1|0' && jump === null && foot === '000', `lifts ${outLift}, off the head ${jump}, onto it ${foot}`);
  const cellar = `${[...game.liftRule(20, 26, 0)].sort().join('/')}|${[...game.liftRule(20, 26, CELLAR_LEVEL)].join('/')}`;
  check('down to the cellar on its tile and back up', cellar === '-1|0', cellar);
}

/* ---- walked up the stack, the browser's path through rpc_move ----------------------- */
game.player.x = 18.5; game.player.y = 30.5; game.player.level = 0;
game.settings.viewLevel = 3;
const went = game.moveTo(22, 24, false, true, 3);
const path = pathOf(game);
const pathText = path.map((p) => `${p.x},${p.y}:${p.level}`).join(' ');
check('pinned on storey 4, a walk from the ground outside to a floor of storey 4 sets off and ends on storey 4',
  went && path.length > 0 && path[path.length - 1].level === 3 && path[path.length - 1].x === 22, pathText);
check('up the stack on its tile, storey by storey', ['21,25:0', '21,25:1', '21,25:2', '21,25:3'].every((s) => pathText.includes(s)), pathText);
const replay = (steps: Array<{ x: number; y: number; level: number }>, from: [number, number, number]): { held: string; at: string } => {
  psql(`update player set x = ${from[0]}, y = ${from[1]}, level = ${from[2]}, moved_at = now() - interval '10 seconds', away = false
    where world_id = ${W} and uid = ${DANE};`);
  let held = '';
  let at = '';
  for (const p of steps) {
    const answer = psql(`
      update player set moved_at = now() - interval '10 seconds', away = false where world_id = ${W} and uid = ${DANE};
      select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
      select rpc_move(${W}, ${p.x + 0.5}, ${p.y + 0.5}, ${p.level})::text;`).split('\n').pop() ?? '{}';
    const a = JSON.parse(answer) as { x: number; y: number; level: number; blocked?: boolean };
    at = `${Math.floor(a.x)},${Math.floor(a.y)}:${a.level}`;
    if ((a.blocked || Math.floor(a.x) !== p.x || Math.floor(a.y) !== p.y || a.level !== p.level) && !held) held = `${p.x},${p.y}:${p.level} -> ${at}`;
  }
  return { held, at };
};
{
  const r = replay(path, [18.5, 30.5, 0]);
  check('replayed a step at a time through rpc_move, the island holds the body back at no step, and has it on storey 4 at the end',
    r.held === '' && r.at === '22,24:3', `held ${r.held || 'nowhere'}; at ${r.at}`);
  // And walked, frame by frame: round the post on its tile, the storey eased up with the turn and taken at its end.
  const seen = new Set<string>();
  let rounds = 0;
  for (let i = 0; i < 4000 && game.player.path; i++) {
    game.player.update(0.05, world, game.stepRule, undefined, game.liftRule);
    const p = game.player;
    if (p.lifting) {
      rounds++;
      seen.add(`${p.tileX},${p.tileY}:${p.level}>${p.lifting.to}`);
    }
  }
  const p = game.player;
  check('walked frame by frame: up the stack a storey at a time on its tile, a turn a storey, and on storey 4 at the end',
    !p.path && p.tileX === 22 && p.tileY === 24 && p.level === 3 && p.visualLevel === 3 && [...seen].join(' ') === '21,25:0>1 21,25:1>2 21,25:2>3' && rounds > 30,
    `${p.tileX},${p.tileY}:${p.level} (${p.visualLevel}); ${[...seen].join(' ')}; ${rounds} frames climbing`);
  game.player.path = null;
}
{
  // And back down the stack the way the browser finds it, from storey 4 to the ground.
  game.player.x = 22.5; game.player.y = 24.5; game.player.level = 3;
  game.settings.viewLevel = 0;
  const down = game.moveTo(18, 30, false, true, 0);
  const steps = pathOf(game);
  const r = replay(steps, [22.5, 24.5, 3]);
  check('and back down to the ground outside, never held back', down && r.held === '' && r.at === '18,30:0',
    `${steps.map((p) => `${p.x},${p.y}:${p.level}`).join(' ')}; held ${r.held || 'nowhere'}; at ${r.at}`);
  game.player.path = null;
  game.settings.viewLevel = null;
}

/* ---- walked on the island, a step at a time --------------------------------------- */
const move = (x0: number, y0: number, l0: number, x1: number, y1: number, level: number): { x: number; y: number; level: number; blocked: boolean } => {
  psql(`update player set x = ${x0}, y = ${y0}, level = ${l0}, moved_at = now() - interval '10 seconds', away = false
          where world_id = ${W} and uid = ${DANE};`);
  const said = psql(`
    select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
    select rpc_move(${W}, ${x1}, ${y1}, ${level})::text;`).split('\n').pop() ?? '{}';
  return JSON.parse(said) as { x: number; y: number; level: number; blocked: boolean };
};
const at = (a: { x: number; y: number; level: number; blocked: boolean }): string => `${Math.floor(a.x)},${Math.floor(a.y)}:${a.level}${a.blocked ? '!' : ''}`;
{
  const out: string[] = [];
  for (const [side, dx, dy] of ROUND) {
    const on = move(S.x + dx + 0.5, S.y + dy + 0.5, 1, S.x + 0.5, S.y + 0.5, 1);
    const up = move(S.x + 0.5, S.y + 0.5, 1, S.x + 0.5, S.y + 0.5, 2);
    const off = move(S.x + 0.5, S.y + 0.5, 2, S.x + dx + 0.5, S.y + dy + 0.5, 2);
    out.push(`${side} ${at(on)} ${at(up)} ${at(off)}`);
  }
  const want = ROUND.map(([side, dx, dy]) => `${side} ${S.x},${S.y}:1 ${S.x},${S.y}:2 ${S.x + dx},${S.y + dy}:2`);
  check('on the island: onto its tile from each side on storey 2, up it to storey 3, and off it across the same side',
    out.join(' / ') === want.join(' / '), out.join(' / '));
  const two = move(S.x + 0.5, S.y + 0.5, 0, S.x + 0.5, S.y + 0.5, 3);
  check('and up the stack three storeys in one word, a spiral on every storey between', at(two) === `${S.x},${S.y}:3`, at(two));
  const none = move(22.5, 24.5, 1, 22.5, 24.5, 2);
  check('a change of storey on a tile with no spiral staircase is held back', at(none) === '22,24:1!', at(none));
  const gap = move(S.x + 0.5, S.y + 0.5, 3, S.x + 0.5, S.y + 0.5, 4);
  check('and up past the top of the stack too', at(gap) === `${S.x},${S.y}:3!`, at(gap));
  const cellarDown = move(20.5, 26.5, 0, 20.5, 26.5, -1);
  const cellarUp = move(20.5, 26.5, -1, 20.5, 26.5, 0);
  const cellarSide = move(20.5, 26.5, 0, 21.5, 26.5, -1);
  check('down the spiral to the cellar on its tile and back up; never off it sideways into the cellar',
    at(cellarDown) === '20,26:-1' && at(cellarUp) === '20,26:0' && at(cellarSide) === '20,26:0!',
    `${at(cellarDown)}, ${at(cellarUp)}, ${at(cellarSide)}`);
}

/* ---- on foot only ----------------------------------------------------------------- */
{
  const BORN = game.time - 3600 * 24 * 60;
  const orse = game.creatures.spawn('orse', 24.5, 25.5, 'active', game.rand, BORN);
  orse.tacked = true;
  orse.hunger = 1;
  game.player.x = 24.5; game.player.y = 25.5; game.player.level = 0;
  check('a saddled mount is mounted beside the outside spiral', game.mount(orse));
  const ride = [game.rideRule(24, 25, 0, 23, 25), game.rideRule(23, 24, 0, 23, 25)];
  const lift = game.liftRule(23, 25, 0).length;
  game.log.length = 0;
  game.moveTo(23, 25);
  const said = game.log.map((l) => l.text).find((t) => t === SPIRAL_FOOT_SAID) ?? game.log.map((l) => l.text).join(' / ');
  check('mounted, no way onto its tile nor up it, and a walk to it says so', ride.every((r) => r === null) && lift === 0 && said === SPIRAL_FOOT_SAID,
    `${ride.join(',')}, ${lift} storeys up, "${said}"`);
  game.dismount();
  game.player.path = null;
  const wheels = [game.driveRule(24, 25, 0, 23, 25), game.driveRule(21, 24, 1, S.x, S.y), game.driveRule(21, 24, 0, S.x, S.y)];
  check('nor wheels: onto its tile on the ground or up a storey', wheels.every((r) => r === null), wheels.join(','));
  const isle = psql(`begin;
    create temp table said (k text, v text) on commit drop;
    do $b$
    declare w uuid; me uuid; v_c int; v_a jsonb;
    begin
      select id into w from world where name = 'Hoarding';
      select uid into me from player where world_id = w and name = 'Dane';
      perform set_config('request.jwt.claims', json_build_object('sub', me)::text, true);
      update player set x = 24.5, y = 25.5, level = 0, aboard = null, away = false, moved_at = now() - interval '10 seconds' where world_id = w and uid = me;
      v_c := creature_spawn(w, 'orse', 24.5, 25.5, 'active', now() - interval '60 days', me);
      update creature set keeper = me, hunger = 1, tacked = true where world_id = w and id = v_c;
      perform perform_ride(w, me, 'mount_creature', jsonb_build_object('kind', 'creature', 'id', v_c));
      delete from event where world_id = w and uid = me;
      v_a := rpc_move(w, 23.5, 25.5, 0);
      insert into said values ('a', (v_a->>'blocked') || '|' || floor((v_a->>'x')::double precision) || ',' || floor((v_a->>'y')::double precision)
        || '|' || coalesce((select text from event where world_id = w and uid = me order by n desc limit 1), 'NOTHING SAID'));
    end $b$;
    select v from said;
    rollback;`).split('\n').pop() ?? '';
  check('mounted on the island, a word onto its tile is held back and says the same', isle === `true|24,25|${SPIRAL_FOOT_SAID}`, isle);
}

/* ---- storey mode ------------------------------------------------------------------- */
{
  const answers = [1, 2, 3].map((l) => storeyTileAt(game, S.x, S.y, l));
  const heights = [1, 2, 3].map((l) => storeyHeight(game, S.x, S.y, l));
  check('pinned on storeys 2 to 4, a click answers on its tile, at the height of each storey\'s floor',
    answers.every(Boolean) && heights.join(',') === [1, 2, 3].map((l) => BASE + l * WALL_HEIGHT).join(','), `${answers.join(',')}; ${heights.join(',')}`);
  game.player.x = 22.5; game.player.y = 26.5; game.player.level = 2;
  game.settings.viewLevel = 2;
  const went2 = game.moveTo(S.x, S.y, false, true, 2);
  const walk = pathOf(game);
  const end = walk[walk.length - 1];
  check('and a walk to it on storey 3 pinned ends on its tile on storey 3', went2 && !!end && end.x === S.x && end.y === S.y && end.level === 2,
    walk.map((p) => `${p.x},${p.y}:${p.level}`).join(' '));
  game.player.path = null;
  game.settings.viewLevel = null;
}

/* ---- put the ground back -------------------------------------------------- */
{
  const heights = heightsWere.split(';').map((r) => r.split(',').map(Number));
  const tiles = tilesWere.split(';').map((r) => r.split(',').map(Number));
  const [px, py, pl] = daneWas.split(',').map(Number);
  sql(`delete from wall where world_id = w;
    delete from floor_tile where world_id = w;
    delete from building_column where world_id = w;
    delete from cellar_tile where world_id = w;
    delete from building_tile where world_id = w;
    delete from building where world_id = w;
    delete from item where world_id = w and holder = 'player' and holder_uid = u and def in ('plank', 'timber', 'nails', 'saw');
    ${heights.map(([x, y, h]) => `perform land_set_height(w, ${x}, ${y}, ${h});`).join('\n')}
    ${tiles.map(([x, y, t, d]) => `perform land_set_tile(w, ${x}, ${y}, ${t}); perform land_set_data(w, ${x}, ${y}, ${d});`).join('\n')}
    update player set body_at = now(), x = ${px}, y = ${py}, level = ${pl} where world_id = w and uid = u;
    ${deedWas ? `update deed set x = ${deedWas.split(',')[0]}, y = ${deedWas.split(',')[1]}, radius = ${deedWas.split(',')[2]}, level = ${deedWas.split(',')[3]}
      where world_id = w and founded_by = u;` : 'delete from deed where world_id = w and founded_by = u;'}`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not the same on both sides`);
  process.exit(1);
}
console.log(`the spiral staircase is the same rules on both sides — ${ok.length} of ${ok.length}`);
