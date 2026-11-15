/**
 * A roof over an open well.
 *
 * Reported: "if previously removing a floor, the option to make a roof
 * disappears. fix". A greenhouse of two storeys with storey 2's floor taken up
 * over three tiles of its south row: no wall can be planned over those tiles
 * with no floor under them ("Build this storey's floor first"), and the roof
 * asked a wall on their outside sides all the same, so it was refused for
 * good. Pinned on storey 2, the menu had no Plan roof at all.
 *
 * Measured on both sides, on a greenhouse 5 by 3 like the reported one:
 *
 *   * with storey 2 closed in round its floor and open over the well, the
 *     storey is enclosed (`level_gap`, still asked of a storey more) and every
 *     tile of the footprint takes a roof over storey 2, the well's included,
 *     in the same words; planned over the whole roof in one plan, every tier
 *     at its own height (free roofing, `freeroof.ts`), the island lays twelve
 *     over storey 2 and the well's three over storey 1;
 *   * an outside side of a floored tile with no wall on it leaves the storey
 *     open, in the same words, and the roof is allowed all the same: no roof
 *     asks a storey closed in any more;
 *   * walls planned round the well and not built are still going up, the
 *     nearest named, and the roof is allowed;
 *   * a storey with no floor at all is asked every side, as before.
 *
 * And drawn in Chromium (`roofwell-page.ts`): over the well, pinned on storey
 * 2, on the roof's own level and on Auto, Plan roof is offered, with walls
 * planned round the well too. Needs a Chromium as `storeyview.ts` does;
 * without one the drawing is skipped, unless `STOREY_STRICT` is set.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on it.
 * The greenhouse is building 9402 at four tiles from the middle of Dane's
 * settlement, taken down after, the ground put back and Dane put back where he was.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import { ACTION_BY_ID } from '../../src/game/actions';
import { gapText, type Side } from '../../src/game/building';
import { Game } from '../../src/game/game';
import { areaAsk, areaPieces, passing } from '../../src/game/planarea';
import { TileType } from '../../src/world/tiles';
import type { WellRow } from './roofwell-page';
import { psql, ok, bad, check } from './harness';

const lit = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const W = `(select id from world where name = 'Hoarding')`;
const DANE = `(select uid from player where world_id = ${W} and name = 'Dane')`;
const ID = 9402;
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
/** The greenhouse: 5 by 3 from (TX, TY), four tiles up and to the west of the settlement's middle, clear of its totem. */
const [TX, TY, TW, TH] = [DX - 4, DY - 4, 5, 3];
const X0 = TX - 1, X1 = TX + TW, Y0 = TY - 1, Y1 = TY + TH;
const TILES: Array<[number, number]> = [];
for (let y = TY; y < TY + TH; y++) for (let x = TX; x < TX + TW; x++) TILES.push([x, y]);
/** Storey 2's floor taken up over the three middle tiles of the south row. */
const well = (x: number, y: number): boolean => y === TY + 2 && x > TX && x < TX + 4;
/** Dane, on storey 2 in the middle of the north half. */
const [PX, PY] = [TX + 2.5, TY + 1.5];

const sql = (s: string): void => {
  psql(`do $$ declare w uuid; u uuid; begin
    select id into w from world where name = 'Hoarding';
    select uid into u from player where world_id = w and name = 'Dane';
    ${s}
  end $$;`);
};
/** A door asked as Dane, its answer. */
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
const groundWas = psql(`select string_agg(gx || ',' || gy || ',' || coalesce(land_height(${W}, gx, gy), 0) || ',' || land_tile(${W}, gx, gy)
    || ',' || coalesce(land_data(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;`);
const BASE = Number(psql(`select coalesce(land_height(${W}, ${TX}, ${TY}), 10);`)) || 10;

/* ---- the greenhouse, on both sides --------------------------------------------- */
const game = Game.create(4242);
const bld = game.buildings;
const world = game.world;
for (let y = Y0; y <= Y1 + 1; y++) for (let x = X0; x <= X1 + 1; x++) world.setHeight(x, y, BASE);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) world.setTile(x, y, TileType.PackedDirt, 0);
(game as unknown as { deed: unknown }).deed = { name: 'Latecomer', x: DX, y: DY, radius: 5, level: 1, mine: true };
game.player.x = PX;
game.player.y = PY;
game.player.level = 1;
game.inventory.add('mallet', { ql: 40 });
bld.nextId = ID;
const house = bld.create('Greenhouse', TX, TY);
for (const [x, y] of TILES.slice(1)) bld.addTile(house, x, y);
house.levels = 2;
house.workLevel = 1;
const finish = (bill: { needed: Record<string, number> }): void => { for (const k of Object.keys(bill.needed)) bill.needed[k] = 0; };

const dirOf = (side: Side): 'h' | 'v' => (side === 'n' || side === 's' ? 'h' : 'v');
const bx = (x: number, side: Side): number => (side === 'e' ? x + 1 : x);
const by = (y: number, side: Side): number => (side === 's' ? y + 1 : y);
/** Every outside side of the footprint: the tile and its side. */
const OUTSIDE: Array<[number, number, Side]> = [];
for (const [x, y] of TILES) {
  for (const [side, nx, ny] of [['n', x, y - 1], ['e', x + 1, y], ['s', x, y + 1], ['w', x - 1, y]] as Array<[Side, number, number]>) {
    if (!TILES.some(([tx, ty]) => tx === nx && ty === ny)) OUTSIDE.push([x, y, side]);
  }
}
/** A wall on both sides: finished, or with `left` logs still to go. */
const wall = (level: number, x: number, y: number, side: Side, left = 0): void => {
  const w = bld.setWall(house, level, x, y, side, 'solid', 'log');
  finish(w);
  if (left) w.needed.log = left;
  sql(`delete from wall where world_id = w and level = ${level} and dir = '${dirOf(side)}' and x = ${bx(x, side)} and y = ${by(y, side)};
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    values (w, ${level}, '${dirOf(side)}', ${bx(x, side)}, ${by(y, side)}, ${ID}, 'solid', 'log', '{"log": ${left}}', '{"log": 16}');`);
};
const unwall = (level: number, x: number, y: number, side: Side): void => {
  bld.removeWall(level, x, y, side);
  sql(`delete from wall where world_id = w and level = ${level} and dir = '${dirOf(side)}' and x = ${bx(x, side)} and y = ${by(y, side)};`);
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
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${ID}, 'Greenhouse', 2, 1, u);
  insert into building_tile (world_id, building, x, y) values ${TILES.map(([x, y]) => `(w, ${ID}, ${x}, ${y})`).join(', ')};
  update player set body_at = now(), x = ${PX}, y = ${PY}, level = 1 where world_id = w and uid = u;`);
/** Storey 2's floor: every tile but the well's, finished, on both sides. */
const floors = (): void => {
  const rows: string[] = [];
  for (const [x, y] of TILES) {
    for (const level of [0, 1]) {
      if (level === 1 && well(x, y)) continue;
      finish(bld.setFloor(house, level, x, y, 'plank'));
      rows.push(`(w, ${level}, ${x}, ${y}, ${ID}, 'plank', 'floor', '{"plank": 0}', '{"plank": 2}')`);
    }
  }
  sql(`delete from floor_tile where world_id = w and building = ${ID};
    insert into floor_tile (world_id, level, x, y, building, material, kind, needed, total) values ${rows.join(', ')};`);
};
floors();
// The ground storey closed in all round, and storey 2 round its floor: over the well, no wall can be planned.
for (const [x, y, side] of OUTSIDE) wall(0, x, y, side);
for (const [x, y, side] of OUTSIDE) if (!well(x, y)) wall(1, x, y, side);

const W2 = psql(`select count(*) from wall where world_id = ${W} and building = ${ID} and level = 1;`);
check('the greenhouse stands the same on both sides: storey 2 walled round its floor, three sides over the well bare',
  Number(W2) === OUTSIDE.length - 3 && [...bld.walls.values()].filter((w) => w.building === ID && w.level === 1).length === OUTSIDE.length - 3,
  `island ${W2}, ${OUTSIDE.length} outside sides`);

/* ---- no wall over the well ---------------------------------------------------- */
const theirSay = (action: string, target: Record<string, unknown>): string =>
  psql(`select coalesce(build_refusal(${W}, ${DANE}, '${action}', ${lit(target)}), 'ALLOWED');`);
const mineSay = (action: string, target: Record<string, unknown>): string =>
  ACTION_BY_ID.get(action)?.check?.({ kind: 'tile', cx: target.x, cy: target.y, ...target } as never, game) ?? 'ALLOWED';
{
  const t = { x: TX + 2, y: TY + 2, side: 's', wallType: 'solid', material: 'log', level: 1 };
  const mine = mineSay('plan_wall', t);
  const theirs = theirSay('plan_wall', t);
  check('a wall over the well is refused on both sides: nothing to stand on', mine === 'Build this storey\'s floor first.' && theirs === mine,
    `browser "${mine}", island "${theirs}"`);
}

/* ---- the storey is closed in, the well open ------------------------------------- */
const gaps = (): [string, string] => [
  gapText(house.levels, bld.levelGaps(house, 1, PX, PY)) ?? 'CLOSED IN',
  psql(`select coalesce(level_gap(${W}, ${ID}, 1, ${PX}::double precision, ${PY}::double precision), 'CLOSED IN');`),
];
{
  const [mine, theirs] = gaps();
  check('storey 2 walled round its floor is closed in on both sides: the well asks no wall', mine === 'CLOSED IN' && theirs === mine,
    `browser "${mine}", island "${theirs}"`);
}
const roofAt = (x: number, y: number): Record<string, unknown> => ({ x, y, material: 'log', floorKind: 'roof', roofShape: 'gable', level: 1 });
{
  const apart = TILES.map(([x, y]) => [x, y, mineSay('plan_floor', roofAt(x, y)), theirSay('plan_floor', roofAt(x, y))] as const)
    .filter(([, , mine, theirs]) => mine !== 'ALLOWED' || theirs !== 'ALLOWED');
  check('a roof is allowed over every tile of the footprint on both sides, the well\'s three included', apart.length === 0,
    apart.map(([x, y, m, t]) => `${x},${y}${well(x, y) ? ' (well)' : ''}: browser "${m}", island "${t}"`).join('; ') || `${TILES.length} tiles`);
}

/* ---- an outside side with no wall is open, in the island's words ------------------ */
{
  unwall(1, TX + 4, TY + 1, 'e');
  const want = `Storey 2 not enclosed: 1 side with no wall or columns, nearest the east side of ${TX + 4},${TY + 1}.`;
  const [mine, theirs] = gaps();
  check('a floored tile\'s outside side with no wall leaves the storey open, the same words on both sides', theirs === want && mine === theirs,
    `browser "${mine}", island "${theirs}"`);
  const t = roofAt(TX + 2, TY + 2);
  const roofMine = mineSay('plan_floor', t);
  const roofTheirs = theirSay('plan_floor', t);
  check('and the roof over the well is allowed all the same on both sides: no storey closed in asked', roofTheirs === 'ALLOWED' && roofMine === roofTheirs,
    `browser "${roofMine}", island "${roofTheirs}"`);
  wall(1, TX + 4, TY + 1, 'e');
}

/* ---- walls planned round the well and not built ---------------------------------- */
{
  for (let x = TX + 1; x < TX + 4; x++) wall(1, x, TY + 2, 'n', 9);
  wall(1, TX + 1, TY + 2, 'w', 9);
  const want = `Storey 2 not enclosed: 4 still going up, nearest the north side of ${TX + 2},${TY + 2}.`;
  const [mine, theirs] = gaps();
  check('four walls planned round the well and not built are still going up, the nearest named, the same on both sides',
    theirs === want && mine === theirs, `browser "${mine}", island "${theirs}"`);
  const t = roofAt(TX, TY);
  const roofMine = mineSay('plan_floor', t);
  const roofTheirs = theirSay('plan_floor', t);
  check('and the roof is allowed all the same on both sides', roofTheirs === 'ALLOWED' && roofMine === roofTheirs,
    `browser "${roofMine}", island "${roofTheirs}"`);
  // Built, they close nothing that was open, and stand in no one's way.
  for (const w of bld.walls.values()) if (w.building === ID) finish(w);
  sql(`update wall set needed = '{"log": 0}' where world_id = w and building = ${ID};`);
  const [built, builtTheirs] = gaps();
  check('built, the storey is closed in again on both sides', built === 'CLOSED IN' && builtTheirs === built, `browser "${built}", island "${builtTheirs}"`);
  for (let x = TX + 1; x < TX + 4; x++) unwall(1, x, TY + 2, 'n');
  unwall(1, TX + 1, TY + 2, 'w');
}

/* ---- a storey with no floor at all is asked every side ------------------------------ */
{
  const kept = [...bld.floors.values()].filter((f) => f.building === ID && f.level === 1).map((f) => [f.x, f.y] as const);
  for (const [x, y] of kept) bld.removeFloor(1, x, y);
  sql(`delete from floor_tile where world_id = w and building = ${ID} and level = 1;`);
  const want = `Storey 2 not enclosed: 3 sides with no wall or columns, nearest the south side of ${TX + 2},${TY + 2}.`;
  const [mine, theirs] = gaps();
  check('a storey with no floor at all is asked every outside side, the same on both sides', theirs === want && mine === theirs,
    `browser "${mine}", island "${theirs}"`);
  floors();
}

/* ---- the whole roof, the well's at its own height ------------------------------------ */
{
  const top = areaPieces(game, { kind: 'roof', buildingId: ID, level: 1, material: 'log', roofShape: 'gable', anchor: { x: TX, y: TY } });
  check('from storey 2 pinned, the browser lays storey 2\'s twelve: the well, with no wall of storey 2 round it, is a tier of storey 1',
    top.length === TILES.length - 3 && top.every((p) => !well(p.target.x, p.target.y) && p.target.level === 1), top.map((p) => `${p.target.x},${p.target.y}`).join(' '));
  const roof = areaPieces(game, { kind: 'roof', buildingId: ID, level: 1, tiers: true, material: 'log', roofShape: 'gable', anchor: { x: TX, y: TY } });
  check('on Auto, a roof tile on each of the fifteen, the well\'s three over storey 1, every one passing',
    roof.length === TILES.length && passing(roof).length === TILES.length && roof.every((p) => p.target.level === (well(p.target.x, p.target.y) ? 0 : 1)),
    roof.map((p) => `${p.target.x},${p.target.y}@${p.target.level}:${p.why ?? 'ok'}`).join(' '));
  rested();
  const made = asDane(`rpc_plan_area(${W}, ${lit(areaAsk(roof))})`);
  const rows = psql(`select count(*) || ',' || min(level) || ',' || max(level) from floor_tile where world_id = ${W} and building = ${ID} and kind = 'roof';`);
  const overWell = psql(`select count(*) from floor_tile where world_id = ${W} and building = ${ID} and kind = 'roof' and level = 1
    and y = ${TY + 2} and x between ${TX + 1} and ${TX + 3};`);
  check('the island lays all fifteen, twelve over storey 2 and the three over the well over storey 1',
    made.planned === TILES.length && rows === `${TILES.length},1,2` && overWell === '3', `${JSON.stringify(made)}; ${rows}; over the well ${overWell}`);
}

/* ---- put the ground back -------------------------------------------------------- */
{
  clear();
  const ground = groundWas.split(';').map((r) => r.split(',').map(Number));
  const [px, py, pl] = daneWas.split(',').map(Number);
  sql(`${ground.map(([x, y, h, t, d]) => `perform land_set_height(w, ${x}, ${y}, ${h}); perform land_set_tile(w, ${x}, ${y}, ${t}); perform land_set_data(w, ${x}, ${y}, ${d});`).join('\n')}
    update player set body_at = now(), x = ${px}, y = ${py}, level = ${pl} where world_id = w and uid = u;`);
}

/* ---- drawn ------------------------------------------------------------------- */
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
type Menu = { title: string; pick: { x: number; y: number; level?: number } | null; rows: WellRow[] };
const options = browserOptions();
if (!options) {
  console.log('roofwell: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.STOREY_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/roofwell-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const css = ['src/style.css', 'src/phone.css'].map((f) => readFileSync(resolve(f), 'utf8')).join('\n');
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addStyleTag({ content: css });
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    const run = <T>(fn: string): Promise<T> => tab.evaluate(`(async () => { const p = window.roofwell; ${fn} })()`) as Promise<T>;
    const [gx, gy] = await run<[number, number]>('return [p.gx, p.gy];');
    const said = (m: Menu): string => `${m.title}: ${m.rows.filter((r) => !r.path.includes(' > ')).map((r) => `${r.path}${r.disabled ? ` [${r.hint}]` : ''}`).join(' / ')}`;
    const offered = (m: Menu): boolean => m.rows.some((r) => r.path === 'Plan roof' && !r.disabled) && m.rows.some((r) => r.path.startsWith('Plan roof > ') && !r.disabled);
    for (const [view, level, where] of [[1, 1, 'pinned on storey 2'], [2, 2, 'on the roof\'s own level'], [null, 0, 'on Auto']] as Array<[number | null, number, string]>) {
      const m = await run<Menu>(`return p.menu(${view}, p.gx + 2, p.gy + 2, ${level});`);
      check(`over the well, ${where}: picked on the well's tile, Plan roof offered`,
        m.pick?.x === gx + 2 && m.pick?.y === gy + 2 && offered(m), said(m));
    }
    await run('p.planRound();');
    for (const [view, level, where] of [[1, 1, 'pinned on storey 2'], [null, 0, 'on Auto']] as Array<[number | null, number, string]>) {
      const m = await run<Menu>(`return p.menu(${view}, p.gx + 2, p.gy + 2, ${level});`);
      check(`with four walls planned round it, ${where}: Plan roof still offered, no storey closed in asked`, offered(m), said(m));
    }
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
    await ctx.close();
  } finally {
    await browser.close();
  }
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} roof-over-a-well checks failed`);
  process.exit(1);
}
console.log(`a roof over an open well — ${ok.length} of ${ok.length}`);
