/**
 * Free roofing: a roof on any tile, over the tile's own top storey.
 *
 * Reported on the Southern Greenhouse, two storeys with storey 2 over part of
 * the footprint and a single-storey tier over the rest: "bug: story 2 is
 * enclosed, but cant roof because i want to tier my building", then "allow
 * free roofing". A roof sat over the top storey and nowhere else, and was
 * refused until the top storey was closed in all round ("Storey 2 not
 * enclosed: 7 sides with no wall or columns").
 *
 * Measured on both sides, on a building 5 by 3 with storey 2 over its north two
 * rows (one tile of them an open well, its floor taken up, walled on storey 2)
 * and a tier along its south row:
 *
 *   * with storey 2 not closed in, a roof is allowed over it and over the tier,
 *     in the same words, at level 2 over storey 2 and level 1 over the tier;
 *   * the tile's top storey (`roofStoreyAt`, `roof_storey_at`) is the same on
 *     both sides for every tile: the well walled on storey 2 is storey 2's, the
 *     tier under storey 2's south wall is storey 1's;
 *   * Plan roof: every tile lays each tier at its own height on Auto, and one
 *     tier alone from a pinned storey; the island lays the rows where the
 *     browser said;
 *   * refused in the same words: a second roof, at the same height and at
 *     another, a roof under a storey of the tile, a floor and a wall on the
 *     tier roof ("Remove the roof first."), a storey more while every tile is
 *     roofed, the top storey taken off under its roof, a roof with no building;
 *   * the ground storey is indoors under both tiers' roofs and the well's,
 *     and what lies in the tier rots at the indoor share, on both sides; a
 *     glass roof on the tier leaves a bed under it open to the sky, a bed under
 *     storey 2 covered, and the building no glasshouse (2 storeys).
 *
 * And drawn in Chromium (`freeroof-page.ts`): a 6 by 5 greenhouse with a tier
 * round storey 2, a hipped roof laid as two parts at their own levels and
 * heights, a click on the tier's slopes landing on the tier's tile, the menu
 * offering a roof over storey 1 on the tier and over storey 2 on storey 2;
 * pictures to FREEROOF_PNGS when it is set. Needs a Chromium as
 * `storeyview.ts` does; without one the drawing is skipped, unless
 * `STOREY_STRICT` is set.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it.
 * The building is 9403, where `roofwell.ts` puts its greenhouse, taken down
 * after, the ground, Dane and his carpentry put back.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { ACTION_BY_ID } from '../../src/game/actions';
import { INDOORS_DECAY, WALL_HEIGHT, type Side } from '../../src/game/building';
import { Game } from '../../src/game/game';
import { bedOpen } from '../../src/game/gardenbed';
import { GLASS, isGlasshouse } from '../../src/game/glasshouse';
import { areaAsk, areaPieces, passing } from '../../src/game/planarea';
import { TileType } from '../../src/world/tiles';
import type { RoofRow } from './freeroof-page';
import { psql, ok, bad, check } from './harness';

const lit = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
const ID = 9403;
/** Latecomer's middle. island.sql stakes it over a hoard, and a test run before this one in its shard may have cleared
 * it off its own ground (green, cellar), renamed it or staked a second (glasshouse): the first, or its founder's deed named
 * Latecomer again, or one staked again. */
const latecomer = (): string =>
  psql(`select x || ',' || y from deed where name = 'Latecomer' and world_id = ${W} order by x, y limit 1;`);
if (!latecomer()) {
  psql(`insert into deed (world_id, name, x, y, radius, founded_by)
    select id, 'Latecomer', 30, 32, 5, '44444444-4444-4444-4444-444444444444' from world where name = 'Hoarding'
    on conflict (world_id, founded_by) do update set name = 'Latecomer';`);
}
const [DX, DY] = latecomer().split(',').map(Number);
/** The building: 5 by 3 from (TX, TY), four tiles up and to the west of the settlement's middle, clear of its totem. */
const [TX, TY, TW, TH] = [DX - 4, DY - 4, 5, 3];
const X0 = TX - 1, X1 = TX + TW, Y0 = TY - 1, Y1 = TY + TH;
const TILES: Array<[number, number]> = [];
for (let y = TY; y < TY + TH; y++) for (let x = TX; x < TX + TW; x++) TILES.push([x, y]);
/** The tier: the south row, one storey. */
const tier = (x: number, y: number): boolean => y === TY + 2;
/** The open well on storey 2: its floor taken up, its north wall standing. */
const WELL: [number, number] = [TX + 2, TY];
const well = (x: number, y: number): boolean => x === WELL[0] && y === WELL[1];
/** Dane, on the ground in the middle. */
const [PX, PY] = [TX + 2.5, TY + 1.5];

const sql = (s: string): void => {
  psql(`do $$ declare w uuid; u uuid; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    ${s}
  end $$;`);
};
const asDane = (call: string): Record<string, unknown> => {
  const out = psql(`select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
    select (${call})::text;`).split('\n').pop() ?? '{}';
  const { pack: _pack, crates: _crates, ...said } = JSON.parse(out) as Record<string, unknown>;
  return said;
};
const rested = (): void => {
  psql(`do $$ begin
    if to_regclass('private.pace_bucket') is not null then execute 'delete from private.pace_bucket'; end if;
  end $$;
  update player set stats = jsonb_set(stats, '{stamina}', '1') where world_id = ${W} and name = 'Dane';`);
};

const daneWas = psql(`select x || ',' || y || ',' || level from player where world_id = ${W} and name = 'Dane';`);
const carpentryWas = psql(`select coalesce((select value from skill where world_id = ${W} and uid = ${DANE} and id = 'carpentry')::text, 'none');`);
const groundWas = psql(`select string_agg(gx || ',' || gy || ',' || coalesce(land_height(${W}, gx, gy), 0) || ',' || land_tile(${W}, gx, gy)
    || ',' || coalesce(land_data(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;`);
const BASE = Number(psql(`select coalesce(land_height(${W}, ${TX}, ${TY}), 10);`)) || 10;

/* ---- the building, on both sides ---------------------------------------------- */
const game = Game.create(4242);
const bld = game.buildings;
const world = game.world;
for (let y = Y0; y <= Y1 + 1; y++) for (let x = X0; x <= X1 + 1; x++) world.setHeight(x, y, BASE);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) world.setTile(x, y, TileType.PackedDirt, 0);
(game as unknown as { deed: unknown }).deed = { name: 'Latecomer', x: DX, y: DY, radius: 5, level: 1, mine: true };
game.player.x = PX;
game.player.y = PY;
game.player.level = 0;
game.inventory.add('mallet', { ql: 40 });
game.skills.values.set('carpentry', 60);
bld.nextId = ID;
const house = bld.create('Southern Greenhouse', TX, TY);
for (const [x, y] of TILES.slice(1)) bld.addTile(house, x, y);
house.levels = 2;
house.workLevel = 1;
const finish = (bill: { needed: Record<string, number> }): void => { for (const k of Object.keys(bill.needed)) bill.needed[k] = 0; };

const dirOf = (side: Side): 'h' | 'v' => (side === 'n' || side === 's' ? 'h' : 'v');
const bx = (x: number, side: Side): number => (side === 'e' ? x + 1 : x);
const by = (y: number, side: Side): number => (side === 's' ? y + 1 : y);
const wall = (level: number, x: number, y: number, side: Side): void => {
  finish(bld.setWall(house, level, x, y, side, 'solid', 'plank'));
  sql(`delete from wall where world_id = w and level = ${level} and dir = '${dirOf(side)}' and x = ${bx(x, side)} and y = ${by(y, side)};
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    values (w, ${level}, '${dirOf(side)}', ${bx(x, side)}, ${by(y, side)}, ${ID}, 'solid', 'plank', '{"plank": 0}', '{"plank": 16}');`);
};
const clear = (): void => sql(`
  delete from no_plan_side where world_id = w and building = ${ID};
  delete from wall where world_id = w and (building = ${ID} or (x between ${X0} and ${X1 + 1} and y between ${Y0} and ${Y1 + 1}));
  delete from floor_tile where world_id = w and (building = ${ID} or (x between ${X0} and ${X1} and y between ${Y0} and ${Y1}));
  delete from building_tile where world_id = w and (building = ${ID} or (x between ${X0} and ${X1} and y between ${Y0} and ${Y1}));
  delete from building where world_id = w and (id = ${ID} or not exists (select 1 from building_tile t where t.world_id = w and t.building = building.id));
  delete from private.plan_undo where world_id = w and uid = u;`);
clear();
sql(`
  for gx in ${X0}..${X1 + 1} loop for gy in ${Y0}..${Y1 + 1} loop perform land_set_height(w, gx, gy, ${BASE}); end loop; end loop;
  for gx in ${X0}..${X1} loop for gy in ${Y0}..${Y1} loop perform land_set_tile(w, gx, gy, tile_id('Packed dirt')); perform land_set_data(w, gx, gy, 0); end loop; end loop;
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'mallet';
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'mallet', 40, 1);
  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', 60) on conflict (world_id, uid, id) do update set value = 60;
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${ID}, 'Southern Greenhouse', 2, 1, u);
  insert into building_tile (world_id, building, x, y) values ${TILES.map(([x, y]) => `(w, ${ID}, ${x}, ${y})`).join(', ')};
  update player set body_at = now(), x = ${PX}, y = ${PY}, level = 0 where world_id = w and uid = u;`);
// The ground floor everywhere; storey 2's over the north two rows, the well's taken up.
{
  const rows: string[] = [];
  for (const [x, y] of TILES) {
    for (const level of [0, 1]) {
      if (level === 1 && (tier(x, y) || well(x, y))) continue;
      finish(bld.setFloor(house, level, x, y, 'plank'));
      rows.push(`(w, ${level}, ${x}, ${y}, ${ID}, 'plank', 'floor', '{"plank": 0}', '{"plank": 2}')`);
    }
  }
  sql(`insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values ${rows.join(', ')};`);
}
// The ground storey closed in all round.
const OUTSIDE: Array<[number, number, Side]> = [];
for (const [x, y] of TILES) {
  for (const [side, nx, ny] of [['n', x, y - 1], ['e', x + 1, y], ['s', x, y + 1], ['w', x - 1, y]] as Array<[Side, number, number]>) {
    if (!TILES.some(([tx, ty]) => tx === nx && ty === ny)) OUTSIDE.push([x, y, side]);
  }
}
for (const [x, y, side] of OUTSIDE) wall(0, x, y, side);

const theirSay = (action: string, target: Record<string, unknown>): string =>
  psql(`select coalesce(build_refusal(${W}, ${DANE}, '${action}', ${lit({ kind: 'tile', cx: target.x, cy: target.y, ...target })}), 'ALLOWED');`);
const mineSay = (action: string, target: Record<string, unknown>): string =>
  ACTION_BY_ID.get(action)?.check?.({ kind: 'tile', cx: target.x, cy: target.y, ...target } as never, game) ?? 'ALLOWED';
const same = (what: string, action: string, target: Record<string, unknown>, want: string): void => {
  const mine = mineSay(action, target);
  const theirs = theirSay(action, target);
  check(what, theirs === want && mine === theirs, `browser "${mine}", island "${theirs}"`);
};
const roofAt = (x: number, y: number, more: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ x, y, material: 'plank', floorKind: 'roof', roofShape: 'hip', ...more });
/** The level a roof job's roof is at, on both sides. */
const levelOf = (target: Record<string, unknown>): [number, number] => [
  bld.roofLevelFor(house, target as { x: number; y: number; level?: number }),
  Number(psql(`select frame_floor_level(${W}, ${ID}, 'roof', ${lit(target)});`)),
];

/* ---- no storey closed in, and a roof all the same -------------------------------- */
{
  const gap = psql(`select coalesce(level_gap(${W}, ${ID}, 1, ${PX}::double precision, ${PY}::double precision), 'CLOSED IN');`);
  check('storey 2 has no wall at all: not enclosed, as level_gap still says for a storey more', gap.startsWith('Storey 2 not enclosed:'), gap);
  same('a roof over storey 2, not closed in, is allowed on both sides', 'plan_floor', roofAt(TX, TY + 1), 'ALLOWED');
  same('and over the tier', 'plan_floor', roofAt(TX + 3, TY + 2), 'ALLOWED');
  const [m2, t2] = levelOf(roofAt(TX, TY + 1));
  const [m1, t1] = levelOf(roofAt(TX + 3, TY + 2));
  check('storey 2\'s roof at level 2, the tier\'s at level 1, on both sides', m2 === 2 && t2 === 2 && m1 === 1 && t1 === 1,
    `storey 2: browser ${m2}, island ${t2}; tier: browser ${m1}, island ${t1}`);
  const [mw, tw] = levelOf(roofAt(WELL[0], WELL[1]));
  check('the well with no wall round it on storey 2: over storey 1, on both sides', mw === 1 && tw === 1, `browser ${mw}, island ${tw}`);
}

/* ---- storey 2 walled round its own block, the well walled on its north side ---------- */
for (let x = TX; x < TX + TW; x++) { wall(1, x, TY, 'n'); wall(1, x, TY + 1, 's'); }
for (const y of [TY, TY + 1]) { wall(1, TX, y, 'w'); wall(1, TX + 4, y, 'e'); }
{
  const theirs = psql(`select string_agg(roof_storey_at(${W}, ${ID}, x, y)::text, ',' order by y, x) from building_tile where world_id = ${W} and building = ${ID};`);
  const mine = [...TILES].sort((p, q) => p[1] - q[1] || p[0] - q[0]).map(([x, y]) => bld.roofStoreyAt(house, x, y)).join(',');
  const want = [...TILES].sort((p, q) => p[1] - q[1] || p[0] - q[0]).map(([x, y]) => (tier(x, y) ? 0 : 1)).join(',');
  check('each tile\'s top storey the same on both sides: storey 2 over the north rows and the well walled on it, storey 1 along the tier under storey 2\'s south wall',
    mine === want && theirs === want, `browser ${mine}, island ${theirs}, want ${want}`);
}

/* ---- the whole roof, a tier at a time and every tier at once ------------------------ */
{
  const ask = (more: Record<string, unknown>) => areaPieces(game, { kind: 'roof', buildingId: ID, level: 1, material: 'plank', roofShape: 'hip', anchor: { x: TX, y: TY }, ...more });
  const lower = ask({ level: 0 });
  const upperOnly = ask({ level: 1 });
  const all = ask({ tiers: true });
  check('Plan roof: every tile, from storey 1 pinned: the tier\'s five tiles, over storey 1',
    lower.length === 5 && lower.every((p) => tier(p.target.x, p.target.y) && p.target.level === 0), lower.map((p) => `${p.target.x},${p.target.y}@${p.target.level}`).join(' '));
  check('from storey 2 pinned: storey 2\'s ten tiles, the well\'s among them, over storey 2',
    upperOnly.length === 10 && upperOnly.every((p) => !tier(p.target.x, p.target.y) && p.target.level === 1), upperOnly.map((p) => `${p.target.x},${p.target.y}@${p.target.level}`).join(' '));
  check('on Auto: all fifteen, each tier at its own height, every one passing',
    all.length === 15 && passing(all).length === 15 && all.every((p) => p.target.level === (tier(p.target.x, p.target.y) ? 0 : 1)),
    all.map((p) => `${p.target.x},${p.target.y}@${p.target.level}:${p.why ?? 'ok'}`).join(' '));
  rested();
  const made = asDane(`rpc_plan_area(${W}, ${lit(areaAsk(all))})`);
  const rows = psql(`select string_agg(level || ':' || n, ' ' order by level) from (select level, count(*) n from floor_tile
    where world_id = ${W} and building = ${ID} and kind = 'roof' group by level) q;`);
  check('the island lays them where the browser said: ten at level 2, five at level 1', made.planned === 15 && rows === '1:5 2:10',
    `${JSON.stringify(made)}; ${rows}`);
  // The browser's the same, and every roof finished on both sides.
  for (const p of all) finish(bld.setFloor(house, (p.target.level ?? 0) + 1, p.target.x, p.target.y, 'plank', 'roof'));
  house.roof = 'hip';
  sql(`update floor_tile set needed = (select jsonb_object_agg(k, 0) from jsonb_object_keys(needed) k) where world_id = w and building = ${ID} and kind = 'roof';`);
}

/* ---- every roof job finds its roof --------------------------------------------------- */
{
  const at = (x: number, y: number): string => `${levelOf(roofAt(x, y)).join('/')}`;
  check('build and remove roof name no storey and find each tier\'s roof: tier 1/1, storey 2 2/2, well 2/2',
    at(TX + 1, TY + 2) === '1/1' && at(TX + 1, TY) === '2/2' && at(WELL[0], WELL[1]) === '2/2',
    `tier ${at(TX + 1, TY + 2)}, storey 2 ${at(TX + 1, TY)}, well ${at(WELL[0], WELL[1])}`);
  same('remove roof on the tier: allowed', 'remove_floor', { x: TX + 1, y: TY + 2, floorKind: 'roof' }, 'ALLOWED');
  same('build roof on the tier, finished: refused as finished, its own roof found', 'build_floor', { x: TX + 1, y: TY + 2, floorKind: 'roof' }, 'Already finished.');
}

/* ---- refusals ------------------------------------------------------------------------ */
same('a roof where one is: refused', 'plan_floor', roofAt(TX + 1, TY + 2), 'Roof already planned here.');
same('a roof over storey 2 where the tier\'s is: refused, naming it', 'plan_floor', roofAt(TX + 1, TY + 2, { level: 1 }), 'Roof already planned here, over storey 1.');
same('a floor of storey 2 on the tier roof: remove the roof first', 'plan_floor', { x: TX + 1, y: TY + 2, material: 'plank', floorKind: 'floor', level: 1 }, 'Remove the roof first.');
same('a wall of storey 2 on the tier roof: remove the roof first', 'plan_wall', { x: TX + 1, y: TY + 2, side: 's', wallType: 'solid', material: 'plank', level: 1 }, 'Remove the roof first.');
same('the top storey taken off under its roof: refused', 'remove_storey', { x: TX + 1, y: TY }, 'Remove the roof first.');
same('a storey more with every tile roofed: refused', 'add_floor', { x: TX + 1, y: TY }, 'Remove the roof first.');
same('a roof with no building: refused', 'plan_floor', roofAt(TX - 4, TY), 'No building here.');
{
  // Storey 2's roof off one tile: a roof over storey 1 there would be inside storey 2.
  bld.removeFloor(2, TX, TY);
  sql(`delete from floor_tile where world_id = w and level = 2 and x = ${TX} and y = ${TY};`);
  same('a roof over storey 1 under storey 2\'s floor: refused', 'plan_floor', roofAt(TX, TY, { level: 0 }), 'Under storey 2 on this tile.');
  same('a roof over storey 2 there, named or not: allowed', 'plan_floor', roofAt(TX, TY), 'ALLOWED');
  const mine = mineSay('add_floor', { x: TX + 1, y: TY });
  const theirs = theirSay('add_floor', { x: TX + 1, y: TY });
  check('a storey more with a tile open to the sky: not refused for the roof, the same on both sides', mine === theirs && mine !== 'Remove the roof first.',
    `browser "${mine}", island "${theirs}"`);
  finish(bld.setFloor(house, 2, TX, TY, 'plank', 'roof'));
  sql(`insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values (w, 2, ${TX}, ${TY}, ${ID}, 'plank', 'roof', '{"plank": 0}', '{"plank": 2}');`);
}

/* ---- indoors, decay and glass per tier ------------------------------------------------- */
{
  const T: [number, number] = [TX + 2, TY + 2];
  const indoors = (level: number, x: number, y: number): [boolean, boolean] =>
    [bld.indoors(level, x, y), psql(`select indoors(${W}, ${level}, ${x}, ${y});`) === 't'];
  const decay = (x: number, y: number): [number, number] =>
    [game.decayMultiplier(x, y), Number(psql(`select decay_multiplier(${W}, ${x}, ${y});`))];
  const [mi, ti] = indoors(0, T[0], T[1]);
  check('the ground storey under the tier roof, storey 2 and the well\'s roof: indoors on both sides', mi && ti, `browser ${mi}, island ${ti}`);
  const [mc, tc] = [bld.coveredAt(0, WELL[0], WELL[1]), psql(`select covered_at(${W}, 0, ${WELL[0]}, ${WELL[1]});`) === 't'];
  check('under the well, covered by the roof two storeys up, on both sides', mc && tc, `browser ${mc}, island ${tc}`);
  const [md, td] = decay(T[0], T[1]);
  // The tier's roof not finished: the room is open to the sky over it.
  const tierRoof = bld.floor(1, T[0], T[1]);
  if (tierRoof) tierRoof.needed.plank = 1;
  sql(`update floor_tile set needed = '{"plank": 1}' where world_id = w and level = 1 and x = ${T[0]} and y = ${T[1]};`);
  const [mo, to] = indoors(0, T[0], T[1]);
  const [mdo, tdo] = decay(T[0], T[1]);
  check('a tier roof tile not finished: not indoors, on both sides', !mo && !to, `browser ${mo}, island ${to}`);
  check(`what lies in the tier rots at ×${INDOORS_DECAY} under its roof, and at the open rate without it, the same on both sides`,
    Math.abs(md - td) < 1e-9 && Math.abs(mdo - tdo) < 1e-9 && Math.abs(md / mdo - INDOORS_DECAY) < 1e-9, `roofed: browser ${md}, island ${td}; open: browser ${mdo}, island ${tdo}`);
  if (tierRoof) tierRoof.needed.plank = 0;
  // Glass on the tier: a bed under it open to the sky; one under storey 2 covered; no glasshouse at two storeys.
  for (const [x, y] of TILES) if (tier(x, y)) { const f = bld.floor(1, x, y); if (f) { f.material = GLASS; f.needed = { glass_pane: 0 }; } }
  sql(`update floor_tile set material = glass_material(), needed = '{"glass_pane": 0}' where world_id = w and building = ${ID} and kind = 'roof' and level = 1;`);
  const open = [bedOpen(bld, 0, T[0], T[1]), psql(`select bed_open(${W}, 0, ${T[0]}, ${T[1]});`) === 't'];
  const shut = [bedOpen(bld, 0, TX + 1, TY + 1), psql(`select bed_open(${W}, 0, ${TX + 1}, ${TY + 1});`) === 't'];
  check('a bed under the tier\'s glass roof is open to the sky, one under storey 2 covered, on both sides',
    open.every(Boolean) && shut.every((v) => !v), `tier: ${open.join('/')}, under storey 2: ${shut.join('/')}`);
  const gh = [isGlasshouse(bld, house), psql(`select glasshouse(${W}, ${ID});`) === 't'];
  check('glass over the tier makes no glasshouse of a building of two storeys, on both sides', gh.every((v) => !v), gh.join('/'));
}

/* ---- put the ground back -------------------------------------------------------------- */
{
  clear();
  const ground = groundWas.split(';').map((r) => r.split(',').map(Number));
  const [px, py, pl] = daneWas.split(',').map(Number);
  sql(`${ground.map(([x, y, h, t, d]) => `perform land_set_height(w, ${x}, ${y}, ${h}); perform land_set_tile(w, ${x}, ${y}, ${t}); perform land_set_data(w, ${x}, ${y}, ${d});`).join('\n')}
    update player set body_at = now(), x = ${px}, y = ${py}, level = ${pl} where world_id = w and uid = u;
    ${carpentryWas === 'none' ? `delete from skill where world_id = w and uid = u and id = 'carpentry';`
      : `update skill set value = ${carpentryWas} where world_id = w and uid = u and id = 'carpentry';`}`);
}

/* ---- drawn ------------------------------------------------------------------------- */
/** A Chromium to drive, as `crowd.ts` finds one, or null. */
function browserOptions(): LaunchOptions | null {
  const args = ['--no-sandbox', '--disable-dev-shm-usage'];
  if (process.env.CHROME_PATH) return { executablePath: process.env.CHROME_PATH, args };
  const kept = join(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers', 'chromium');
  if (existsSync(kept)) return { executablePath: kept, args };
  for (const chrome of ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(chrome)) return { executablePath: chrome, args };
  }
  return null;
}
type Menu = { title: string; pick: { x: number; y: number; level?: number } | null; rows: RoofRow[] };
const options = browserOptions();
if (!options) {
  console.log('freeroof: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.STOREY_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/freeroof-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const css = ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const pngs = process.env.FREEROOF_PNGS;
  if (pngs) mkdirSync(pngs, { recursive: true });
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: pngs ? 2 : 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    const run = <T>(fn: string): Promise<T> => tab.evaluate(`(async () => { const p = window.freeroof; ${fn} })()`) as Promise<T>;
    const [gx, gy, base] = await run<[number, number, number]>('return [p.gx, p.gy, p.base];');
    const said = (m: Menu): string => `${m.title}: ${m.rows.filter((r) => !r.path.includes(' > ')).map((r) => `${r.path}${r.note ? ` (${r.note})` : ''}${r.disabled ? ` [${r.hint}]` : ''}`).join(' / ')}`;
    const planRoof = (m: Menu): RoofRow | undefined => m.rows.find((r) => r.path === 'Plan roof');

    // No roof yet: the tier is offered one over storey 1, storey 2 one over storey 2.
    const onTier = await run<Menu>('return p.menu(null, p.gx + 2, p.gy + 4, 0);');
    check('on Auto, on the tier: Plan roof, over storey 1', onTier.pick?.x === gx + 2 && planRoof(onTier)?.note === 'over storey 1' && !planRoof(onTier)?.disabled, said(onTier));
    const onUpper = await run<Menu>('return p.menu(null, p.gx + 2, p.gy + 1, 1);');
    check('on Auto, on storey 2: Plan roof, over storey 2', planRoof(onUpper)?.note === 'over storey 2' && !planRoof(onUpper)?.disabled, said(onUpper));
    const pinnedLow = await run<Menu>('return p.menu(0, p.gx + 2, p.gy + 1, 0);');
    check('storey 1 pinned, under storey 2: no Plan roof there', !planRoof(pinnedLow), said(pinnedLow));
    const pinnedTier = await run<Menu>('return p.menu(0, p.gx + 2, p.gy + 4, 0);');
    check('storey 1 pinned, on the tier: Plan roof over storey 1', planRoof(pinnedTier)?.note === 'over storey 1', said(pinnedTier));
    const every = onTier.rows.find((r) => r.path === 'Plan roof: every tile');
    check('Plan roof: every tile on Auto: all thirty tiles, every tier', every?.note === '30 tiles', every ? `${every.path} (${every.note})` : said(onTier));
    if (pngs) {
      await run('p.stand(p.gx + 3.5, p.gy + p.gh + 1.5, 0); p.setHour(13); p.menu(null, p.gx + 2, p.gy + 4, 0, true);');
      await tab.waitForTimeout(150);
      await tab.screenshot({ path: join(pngs, 'menu-tier-plan-roof.png') });
      await tab.keyboard.press('Escape');
    }

    // A hipped roof over each tier, at its own height.
    await run('p.send(true);');
    const parts = await run<Array<{ level: number; tiles: number; eave: number }>>('return p.drawn(null);');
    const by = (l: number) => parts.find((q) => q.level === l);
    check('drawn as two roofs: the tier\'s 18 tiles at level 1, storey 2\'s 12 at level 2',
      parts.length === 2 && by(1)?.tiles === 18 && by(2)?.tiles === 12, JSON.stringify(parts));
    check('each with its eaves over its own top storey: a storey apart',
      by(1)?.eave === base + WALL_HEIGHT && by(2)?.eave === base + 2 * WALL_HEIGHT, JSON.stringify(parts));
    const pinned1 = await run<Array<{ level: number }>>('return p.drawn(1);');
    check('pinned on storey 2, the tier\'s roof drawn at its own level and storey 2\'s not', pinned1.length === 1 && pinned1[0].level === 1, JSON.stringify(pinned1));
    const click = await run<{ x: number; y: number; level?: number } | null>('return p.roofClick(1, p.gx + 2, p.gy + 4);');
    check('a click on the tier\'s slopes, pinned on storey 2, lands on the tier\'s tile at its level', click?.y === gy + 4 && click?.level === 1, JSON.stringify(click));
    const roofed = await run<Menu>('return p.menu(1, p.gx + 2, p.gy + 4, 1);');
    check('and its menu works the tier\'s roof: Remove roof', roofed.rows.some((r) => r.path === 'Remove roof'), said(roofed));
    if (pngs) {
      for (const [h, name] of [[13, 'two-tier-hipped-day.png'], [23, 'two-tier-hipped-night.png']] as Array<[number, string]>) {
        await run(`p.stand(p.gx + 3.5, p.gy + p.gh + 1.5, 0); p.renderer.camera.zoom = 1.4; p.setHour(${h}); p.frame(null); p.frame(null);`);
        await tab.waitForTimeout(100);
        await tab.screenshot({ path: join(pngs, name) });
      }
    }
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
    await ctx.close();
  } finally {
    await browser.close();
  }
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} free roofing checks failed`);
  process.exit(1);
}
console.log(`free roofing — ${ok.length} of ${ok.length}`);
