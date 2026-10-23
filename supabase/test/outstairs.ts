/**
 * The outside staircase, the same on both sides.
 *
 * Asked for: "Allow building a staircase adjacent to a building to allow
 * stairs going directly to the floor above from outside a building".
 *
 * A staircase, wide or single, planned on the floor slot of storey
 * `OUTSIDE_STAIR_LEVEL + 1` of a tile of open ground just out past a
 * building's footprint, its head against the building and its foot out on
 * the ground: `outsideStairReason` in `src/game/frame.ts`, and
 * `frame_outside_stair_refusal` on the island. Put to both:
 *
 *   * every refusal, in the same words: not beside the building, its head
 *     turned away, the wrong storey, a building of one storey, over water,
 *     on a tree, on ground higher than the floor, on another building's
 *     footprint, and a ladder;
 *   * planned, the same floor tile on both sides: the storey, the side it is
 *     climbed from, the hand and the bill a staircase of that material and
 *     width costs anywhere;
 *   * built, it is finished;
 *   * no part of the storey: no walls asked round it (`levelGaps`,
 *     `level_gap`), not in the storey's area (`storeyArea`, `frame_storey`)
 *     nor in a room, and no wall carries it (`jettyOnWall`,
 *     `frame_bears_jetty`); nothing planned on its tile while it stands, and
 *     Examine saying what it is;
 *   * walked: up onto it from the ground, through a doorway of storey 2 off
 *     its head onto the building's floor, and down off its side onto the
 *     ground (`Game.stepRule`, `rpc_move`);
 *   * taken out as any staircase is;
 *   * and a jetty floor still planned as before.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on
 * it, on the ground `frame.ts` uses, and puts the ground, his settlement and
 * Dane back after.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID } from '../../src/game/actions';
import { floorBill, gapText, isDone, OUTSIDE_STAIR_LEVEL, type Side, type WallType } from '../../src/game/building';
import { frameSays } from '../../src/game/frameActions';
import { jettyOnWall, jettyOver } from '../../src/game/frame';
import { Game } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
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
const STOREY = OUTSIDE_STAIR_LEVEL + 1;

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
game.skills.values.set('carpentry', 90);
game.player.x = 20.5;
game.player.y = 27.5;
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
  delete from building_tile where world_id = w;
  delete from building where world_id = w;
  delete from bridge where world_id = w;
  delete from item where world_id = w and holder = 'player' and holder_uid = u
    and def in ('mallet', 'trowel', 'plank', 'timber', 'log');
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'mallet', 40, 1);
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
  update player set body_at = now(), x = 20.5, y = 27.5, level = 0 where world_id = w and uid = u;
end $$;`);

/* ---- building on both sides at once ---------------------------------------- */
const along = (x: number, y: number, side: Side): { bx: number; by: number; dir: 'h' | 'v' } => ({
  bx: side === 'e' ? x + 1 : x, by: side === 's' ? y + 1 : y, dir: side === 'n' || side === 's' ? 'h' : 'v',
});
const sql = (s: string): void => {
  psql(`do $$ declare w uuid; u uuid; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    ${s}
  end $$;`);
};
const building = (id: number, name: string, tiles: Array<[number, number]>, levels: number, work = levels - 1): void => {
  const b = bld.create(name, tiles[0][0], tiles[0][1]);
  if (b.id !== id) throw new Error(`the browser numbered ${name} ${b.id}, not ${id}`);
  for (const [x, y] of tiles.slice(1)) bld.addTile(b, x, y);
  b.levels = levels;
  b.workLevel = work;
  sql(`insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${id}, '${name}', ${levels}, ${work}, u);
    insert into building_tile (world_id, building, x, y) values ${tiles.map(([x, y]) => `(w, ${id}, ${x}, ${y})`).join(', ')};`);
};
const setLevels = (id: number, levels: number, work = levels - 1): void => {
  const b = bld.list.get(id)!;
  b.levels = levels;
  b.workLevel = work;
  sql(`update building set levels = ${levels}, work_level = ${work} where world_id = w and id = ${id};`);
};
const wall = (id: number, level: number, x: number, y: number, side: Side, type: WallType, mat: string): void => {
  const b = bld.list.get(id)!;
  const wl = bld.setWall(b, level, x, y, side, type, mat);
  for (const k of Object.keys(wl.needed)) wl.needed[k] = 0;
  const { bx, by, dir } = along(x, y, side);
  sql(`delete from wall where world_id = w and level = ${level} and dir = '${dir}' and x = ${bx} and y = ${by};
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    values (w, ${level}, '${dir}', ${bx}, ${by}, ${id}, '${type}', '${mat}', '${JSON.stringify(wl.needed)}', '${JSON.stringify(wl.total)}');`);
};
const unwall = (level: number, x: number, y: number, side: Side): void => {
  bld.removeWall(level, x, y, side);
  const { bx, by, dir } = along(x, y, side);
  sql(`delete from wall where world_id = w and level = ${level} and dir = '${dir}' and x = ${bx} and y = ${by};`);
};
const floor = (id: number, level: number, x: number, y: number, mat: string): void => {
  const b = bld.list.get(id)!;
  const f = bld.setFloor(b, level, x, y, mat, 'floor');
  for (const k of Object.keys(f.needed)) f.needed[k] = 0;
  sql(`delete from floor_tile where world_id = w and level = ${level} and x = ${x} and y = ${y};
    insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total)
    values (w, ${level}, ${x}, ${y}, ${id}, '${mat}', 'floor', '${JSON.stringify(f.needed)}', '${JSON.stringify(f.total)}');`);
};
const setTile = (x: number, y: number, t: TileType, name: string): void => {
  world.setTile(x, y, t, 0);
  sql(`perform land_set_tile(w, ${x}, ${y}, tile_id('${name}'));`);
};
const setCorner = (x: number, y: number, h: number): void => {
  world.setHeight(x, y, h);
  sql(`perform land_set_height(w, ${x}, ${y}, ${h});`);
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
/** A floor tile as each side holds it: its storey, the side it is climbed from, its hand and its bill. */
const rowOf = (x: number, y: number): [string, string] => {
  const f = bld.floor(OUTSIDE_STAIR_LEVEL, x, y);
  const sorted = (b: Record<string, number>): string => JSON.stringify(Object.fromEntries(Object.entries(b).sort()));
  const mine = f ? `${f.level}|${f.kind}|${f.facing ?? '-'}|${f.hand ?? '-'}|${sorted(f.needed)}|${sorted(f.total)}` : 'NONE';
  const theirs = psql(`select coalesce((select level || '|' || kind || '|' || coalesce(facing, '-') || '|' || coalesce(hand, '-')
      || '|' || needed::text || '|' || total::text from floor_tile
     where world_id = ${W} and level = ${OUTSIDE_STAIR_LEVEL} and x = ${x} and y = ${y}), 'NONE');`).replace(/ /g, '');
  return [mine, theirs];
};

/* ---- a hall of two tiles, two storeys ----------------------------------------
 *
 *   (20,25) (21,25)   log walls all round both storeys, finished, and plank
 *                     floors on storey 2; a door in storey 2's south wall of
 *                     the first tile.
 *   (20,26)           the tile its outside staircase goes on, climbed from
 *                     the south, its foot out on the ground at (20,27).
 *   (22,25)           a shed of one storey, east of it.
 */
building(1, 'Hall', [[20, 25], [21, 25]], 2, 1);
const OUTER: Array<[number, number, Side]> = [[20, 25, 'n'], [20, 25, 'w'], [20, 25, 's'], [21, 25, 'n'], [21, 25, 'e'], [21, 25, 's']];
for (const [x, y, side] of OUTER) wall(1, 0, x, y, side, 'solid', 'log');
floor(1, 1, 20, 25, 'plank');
floor(1, 1, 21, 25, 'plank');
for (const [x, y, side] of OUTER) wall(1, 1, x, y, side, x === 20 && side === 's' ? 'door' : 'solid', 'log');
building(2, 'Shed', [[22, 25]], 1, 0);

const STAIR = { x: 20, y: 26, material: 'plank', floorKind: 'stairs', side: 's', buildingId: 1, level: OUTSIDE_STAIR_LEVEL };
const SINGLE = { x: 19, y: 25, material: 'plank', floorKind: 'stairs', side: 'w', hand: 'l', buildingId: 1, level: OUTSIDE_STAIR_LEVEL };

/* ---- refused ----------------------------------------------------------------- */
same('a staircase not beside the building is no job of the building', 'plan_floor', { ...STAIR, y: 27 }, 'No building here.');
same('one with its head turned away from the building is told to turn it', 'plan_floor', { ...STAIR, side: 'n' },
  'Must climb toward Hall: turn it.');
same('nor turned along the wall', 'plan_floor', { ...STAIR, side: 'e' },
  'Must climb toward Hall: turn it.');
same('one asked for on the ground floor is told the storey it climbs to', 'plan_floor', { ...STAIR, level: 0 },
  `Outside staircase: ground to storey ${STOREY}. Switch to storey ${STOREY}.`);
setLevels(1, 3, 2);
same('and one asked for on storey 3 the same', 'plan_floor', { ...STAIR, level: 2 },
  `Outside staircase: ground to storey ${STOREY}. Switch to storey ${STOREY}.`);
setLevels(1, 1, 0);
same('a building of one storey is told to plan the storey it climbs to', 'plan_floor', STAIR,
  `Outside staircase: ground to storey ${STOREY}. Plan Hall storey ${STOREY} first.`);
setLevels(1, 2, 1);
same('a ladder still goes inside the footprint', 'plan_floor', { ...STAIR, floorKind: 'ladder' },
  'Ladders: inside the footprint only, not on a jetty.');
same('a staircase on the footprint of a building of one storey beside it is that building\'s, and refused as its', 'plan_floor',
  { ...STAIR, x: 22, y: 25, side: 'e' }, 'Stairs and ladders need an upper storey: plan one first.');
setCorner(19, 25, -2);
same('it stands on dry ground, not in water', 'plan_floor', { ...STAIR, x: 19, y: 25, side: 'w' },
  'Not in water.');
setCorner(19, 25, BASE);
setTile(20, 26, TileType.Tree, 'Tree');
same('nor on a tree', 'plan_floor', STAIR, 'Needs open ground: clear the tree or bush first.');
setTile(20, 26, TileType.Grass, 'Grass');
setCorner(21, 27, BASE + 3);
same('nor on ground that rises above the floor its head is level with the bottom of', 'plan_floor', STAIR,
  `Ground under it above storey ${OUTSIDE_STAIR_LEVEL} floor: dig it down first.`);
setCorner(21, 27, BASE);

/* ---- planned ----------------------------------------------------------------- */
same('turned to climb toward the building, on open ground beside it, it is allowed on both sides', 'plan_floor', STAIR, 'ALLOWED');
same('a single one beside it as well', 'plan_floor', SINGLE, 'ALLOWED');
{
  const [mine, theirs] = both('plan_floor', STAIR, 'Planned: ');
  check('planned, both sides say the same', mine === theirs && mine.startsWith('Planned: plank staircase.'), `browser "${mine}", island "${theirs}"`);
  const [mineS, theirsS] = both('plan_floor', SINGLE, 'Planned: ');
  check('and of the single one', mineS === theirsS && mineS.includes('single staircase'), `browser "${mineS}", island "${theirsS}"`);
}
{
  const want = (facing: Side, hand?: 'l'): string => {
    const b = floorBill('plank', 'stairs', undefined, hand);
    const sorted = (x: Record<string, number>): string => JSON.stringify(Object.fromEntries(Object.entries(x).sort()));
    return `${OUTSIDE_STAIR_LEVEL}|stairs|${facing}|${hand ?? '-'}|${sorted(b.needed)}|${sorted(b.total)}`;
  };
  const [mine, theirs] = rowOf(20, 26);
  check('the same floor tile on both sides: on storey 2\'s slot, climbed from the south, the bill of a wide plank staircase',
    mine === theirs && mine === want('s'), `browser ${mine}; island ${theirs}; a staircase anywhere ${want('s')}`);
  const [mineS, theirsS] = rowOf(19, 25);
  check('and the single one, west of it and climbed from the west, with its hand and the bill of a single staircase',
    mineS === theirsS && mineS === want('w', 'l'), `browser ${mineS}; island ${theirsS}; a single staircase anywhere ${want('w', 'l')}`);
}
same('planned again over itself, it is already there', 'plan_floor', STAIR, 'Floor already planned here.');
same('a jetty floor on its tile is refused the same way', 'plan_floor', { x: 20, y: 26, material: 'plank', floorKind: 'floor', buildingId: 1 },
  'Floor already planned here.');
same('nothing is planned on its tile while it stands', 'plan_building', { x: 20, y: 26, name: 'Lean-to' },
  'Hall outside staircase on that tile.');

/* ---- no part of the storey ------------------------------------------------- */
{
  const hall = bld.list.get(1)!;
  const gapMine = gapText(hall.levels, bld.levelGaps(hall, OUTSIDE_STAIR_LEVEL, 20.5, 27.5)) ?? 'CLOSED';
  const gapTheirs = psql(`select coalesce(level_gap(${W}, 1, ${OUTSIDE_STAIR_LEVEL}, 20.5::double precision, 27.5::double precision), 'CLOSED');`);
  check('storey 2 with the staircase planned off its doorway is closed in on both sides: no walls are asked round the staircase',
    gapMine === 'CLOSED' && gapTheirs === 'CLOSED', `browser "${gapMine}", island "${gapTheirs}"`);
  unwall(1, 20, 25, 's');
  const area = [...bld.storeyArea(hall, OUTSIDE_STAIR_LEVEL)].sort().join(' ');
  const areaTheirs = psql(`select string_agg(x || ',' || y, ' ' order by x || ',' || y) from frame_storey(${W}, 1, ${OUTSIDE_STAIR_LEVEL});`);
  check('with no wall between them, the storey is still its footprint and no more on both sides', area === '20,25 21,25' && areaTheirs === area,
    `browser ${area}; island ${areaTheirs}`);
  const gap2 = gapText(hall.levels, bld.levelGaps(hall, OUTSIDE_STAIR_LEVEL, 20.5, 27.5)) ?? 'CLOSED';
  const gap2Theirs = psql(`select coalesce(level_gap(${W}, 1, ${OUTSIDE_STAIR_LEVEL}, 20.5::double precision, 27.5::double precision), 'CLOSED');`);
  check('and the one side it asks a wall on is the building\'s own, not the staircase\'s',
    gap2 === gap2Theirs && gap2 === 'Storey 2 not enclosed: 1 side with no wall or columns, nearest the south side of 20,25.',
    `browser "${gap2}", island "${gap2Theirs}"`);
  const room = bld.room(OUTSIDE_STAIR_LEVEL, 20, 25)?.tiles.sort().join(' ') ?? 'NONE';
  const roomTheirs = psql(`select string_agg(x || ',' || y, ' ' order by x || ',' || y) from room_tiles(${W}, ${OUTSIDE_STAIR_LEVEL}, 20, 25);`);
  check('nor is it in the room on either side', room === '20,25 21,25' && roomTheirs === room, `browser ${room}; island ${roomTheirs}`);
  check('nor is a room of its own in the browser', bld.room(OUTSIDE_STAIR_LEVEL, 20, 26) === undefined);
  wall(1, 1, 20, 25, 's', 'door', 'log');
  const groundWall = bld.wall(0, 20, 25, 's')!;
  const bearsMine = jettyOnWall(game, groundWall);
  const bearsTheirs = psql(`select coalesce(frame_bears_jetty(${W}, w)::text, 'NONE') from wall w
    where w.world_id = ${W} and w.level = 0 and w.dir = 'h' and w.x = 20 and w.y = 26;`);
  check('and the ground floor\'s wall beside it carries nothing of it, on both sides', bearsMine === null && bearsTheirs === 'NONE',
    `browser ${bearsMine}, island ${bearsTheirs}`);
}

/* ---- built ------------------------------------------------------------------- */
{
  const bill = floorBill('plank', 'stairs');
  for (const [def, n] of Object.entries(bill.needed)) game.inventory.add(def, { ql: 40, count: n });
  sql(`${Object.entries(bill.needed).map(([def, n]) => `insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, '${def}', 40, ${n});`).join('\n')}`);
  const t = { kind: 'tile', x: 20, y: 26, cx: 20, cy: 26, buildingId: 1, level: OUTSIDE_STAIR_LEVEL, floorKind: 'stairs' };
  const build = ACTION_BY_ID.get('build_floor')!;
  let refusedMine = '';
  for (let i = 0; i < 100 && !isDone(bld.floor(OUTSIDE_STAIR_LEVEL, 20, 26)!); i++) {
    const why = build.check?.(t as never, game);
    if (why) { refusedMine = why; break; }
    build.perform(t as never, game);
  }
  const refusedTheirs = psql(`do $$ declare w uuid; u uuid; v text; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    for i in 1..100 loop
      exit when (select bill_done(needed) from floor_tile where world_id = w and level = ${OUTSIDE_STAIR_LEVEL} and x = 20 and y = 26);
      v := build_refusal(w, u, 'build_floor', '${JSON.stringify(t)}'::jsonb);
      if v is not null then raise notice '%', v; exit; end if;
      perform perform_building(w, u, 'build_floor', '${JSON.stringify(t)}'::jsonb);
    end loop;
  end $$;
  select case when bill_done(needed) then 'DONE' else 'NOT DONE' end from floor_tile where world_id = ${W} and level = ${OUTSIDE_STAIR_LEVEL} and x = 20 and y = 26;`);
  const mineDone = isDone(bld.floor(OUTSIDE_STAIR_LEVEL, 20, 26)!);
  check('built a material at a time, it is finished on both sides', mineDone && refusedTheirs === 'DONE',
    `browser ${mineDone ? 'finished' : `not finished${refusedMine ? `, "${refusedMine}"` : ''}`}, island ${refusedTheirs}`);
}
{
  const mine = frameSays(game, 20, 26).trim();
  const theirs = psql(`select trim(frame_says(${W}, 20, 26));`);
  const want = `Outside staircase: up to Hall storey ${STOREY}, climbed from the south.`;
  check('Examine says what it is, the same on both sides', mine === want && theirs === want, `browser "${mine}", island "${theirs}"`);
  const single = frameSays(game, 19, 25).trim();
  const singleTheirs = psql(`select trim(frame_says(${W}, 19, 25));`);
  check('and of one still planned', single === singleTheirs && single === `Outside staircase planned: up to Hall storey ${STOREY}.`,
    `browser "${single}", island "${singleTheirs}"`);
}

/* ---- walked ------------------------------------------------------------------ */
const up = game.stepRule(20, 27, 0, 20, 26);
const inside = game.stepRule(20, 26, OUTSIDE_STAIR_LEVEL, 20, 25);
const side = game.stepRule(20, 26, OUTSIDE_STAIR_LEVEL, 19, 26);
const foot = game.stepRule(20, 26, OUTSIDE_STAIR_LEVEL, 20, 27);
const out = game.stepRule(20, 25, OUTSIDE_STAIR_LEVEL, 20, 26);
check('in the browser, up onto it from the ground is storey 2, through the door off its head is storey 2, off its side and its foot is the ground, and back out onto it from inside is storey 2',
  up === 1 && inside === 1 && side === 0 && foot === 0 && out === 1, `up ${up}, in ${inside}, side ${side}, foot ${foot}, out ${out}`);
wall(1, 1, 20, 25, 's', 'solid', 'log');
const shut = game.stepRule(20, 26, OUTSIDE_STAIR_LEVEL, 20, 25);
check('and with a solid wall at its head there is no way in', shut === null, `${shut}`);
wall(1, 1, 20, 25, 's', 'door', 'log');
const move = (x0: number, y0: number, l0: number, x1: number, y1: number, level: number): { x: number; y: number; level: number; blocked: boolean } => {
  psql(`update player set x = ${x0}, y = ${y0}, level = ${l0}, moved_at = now() - interval '10 seconds', away = false
          where world_id = ${W} and uid = ${DANE};`);
  const said = psql(`
    select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
    select rpc_move(${W}, ${x1}, ${y1}, ${level})::text;`).split('\n').pop() ?? '{}';
  return JSON.parse(said) as { x: number; y: number; level: number; blocked: boolean };
};
{
  const a = move(20.5, 27.5, 0, 20.5, 26.5, OUTSIDE_STAIR_LEVEL);
  const b = move(20.5, 26.5, OUTSIDE_STAIR_LEVEL, 20.5, 25.4, OUTSIDE_STAIR_LEVEL);
  const c = move(20.5, 26.5, OUTSIDE_STAIR_LEVEL, 19.4, 26.5, 0);
  check('on the island, up onto it from the ground stands on storey 2, through the door off its head stands on the building\'s floor, and off its side stands on the ground',
    !a.blocked && a.level === 1 && Math.floor(a.y) === 26 && !b.blocked && b.level === 1 && Math.floor(b.y) === 25
      && !c.blocked && c.level === 0 && Math.floor(c.x) === 19,
    `up ${JSON.stringify([a.x, a.y, a.level, a.blocked])}, in ${JSON.stringify([b.x, b.y, b.level, b.blocked])}, off ${JSON.stringify([c.x, c.y, c.level, c.blocked])}`);
  const d = move(18.5, 25.5, 0, 19.5, 25.5, OUTSIDE_STAIR_LEVEL);
  check('and onto the single one still planned there is nothing up there to stand on', d.blocked && Math.floor(d.x) === 18,
    `stands at ${d.x.toFixed(2)},${d.y.toFixed(2)}`);
}

/* ---- taken out --------------------------------------------------------------- */
{
  const [mine, theirs] = both('remove_floor', { x: 19, y: 25, buildingId: 1, level: OUTSIDE_STAIR_LEVEL, floorKind: 'stairs' }, 'Removed: ');
  const [rowMine, rowTheirs] = rowOf(19, 25);
  check('the single one taken out as any staircase is, in the same words, and gone on both sides',
    mine === theirs && mine !== 'NOTHING SAID' && rowMine === 'NONE' && rowTheirs === 'NONE', `browser "${mine}", island "${theirs}"`);
  const over = jettyOver(game, 19, 25) ?? 'NOTHING';
  const overTheirs = psql(`select coalesce(frame_jetty_over(${W}, 19, 25), 'NOTHING');`);
  check('and nothing stands over its tile any more', over === 'NOTHING' && overTheirs === 'NOTHING', `browser "${over}", island "${overTheirs}"`);
}

/* ---- a jetty floor still as it was ------------------------------------------ */
same('a jetty floor on the west wall is planned as before', 'plan_floor', { x: 19, y: 25, material: 'plank', floorKind: 'floor', buildingId: 1 }, 'ALLOWED');
same('and too heavy a material for its walls refused as before', 'plan_floor', { x: 21, y: 24, material: 'marble', floorKind: 'floor', buildingId: 1 },
  'Marble too heavy past the walls: they carry timber at most.');

/* ---- put the ground back -------------------------------------------------- */
{
  const heights = heightsWere.split(';').map((r) => r.split(',').map(Number));
  const tiles = tilesWere.split(';').map((r) => r.split(',').map(Number));
  const [px, py, pl] = daneWas.split(',').map(Number);
  sql(`delete from wall where world_id = w;
    delete from floor_tile where world_id = w;
    delete from building_column where world_id = w;
    delete from building_tile where world_id = w;
    delete from building where world_id = w;
    delete from item where world_id = w and holder = 'player' and holder_uid = u and def in ('plank', 'timber');
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
console.log(`the outside staircase is the same rules on both sides — ${ok.length} of ${ok.length}`);
