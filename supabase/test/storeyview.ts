/**
 * Storey mode: one storey pinned on the storey control, every other one hidden.
 *
 * Asked for: "Navigating and building 2nd+ storey is super clumsy. We have a
 * storey toggle UI, lets lean into that. Clicking that toggle hides all other
 * storey, allowing players to move onto and along that storey and build
 * options exclusively for that storey".
 *
 * On a hall of two storeys with a staircase up inside it, a jetty and an
 * outside staircase, pinned on storey 2 (`storeyview.ts`):
 *
 *   * a click answers on the hall's floor, the jetty, the outside staircase's
 *     head and the open air beside the hall where a jetty could go, each at
 *     the height its floor is drawn at, and not on far ground; on the roof's
 *     own level, the roof;
 *   * a walk to a tile of it ends on storey 2, up the staircase, and replayed
 *     a step at a time through `rpc_move` the island never holds it back and
 *     has the body on storey 2 at the end; a tile with no floor up there is
 *     refused in the same words every time;
 *   * the jetty's and the footprint's rows name storey 2 in every job they
 *     ask for;
 *   * on Auto a walk aims where it always did.
 *
 * And drawn in Chromium (`storeyview-page.ts`): pinned on storey 2 no wall
 * of the ground floor is drawn, nor the chest on it, and a click on a floor
 * tile of storey 2 picks it, on storey 2, with that storey's menu and none of
 * the ground's jobs; pinned on the ground floor no wall of storey 2 is drawn;
 * on Auto both are. Needs a Chromium as `crowd.ts` does; without one the
 * drawing is skipped, unless `STOREY_STRICT` is set, as it is in CI.
 *
 * Runs against the database the suite leaves behind: Hoarding, and Dane on
 * it, on the ground `outstairs.ts` uses, and puts the ground and Dane back.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, type LaunchOptions } from 'playwright-core';
import type { ActionDef, Target } from '../../src/game/actions';
import { WALL_HEIGHT, type Side, type WallType } from '../../src/game/building';
import { Game } from '../../src/game/game';
import { storeyHeight, storeyTileAt } from '../../src/game/storeyview';
import { frameFootprintEntries, frameJettyEntries } from '../../src/ui/frameMenu';
import type { MenuItem } from '../../src/ui/contextmenu';
import type { Pick } from '../../src/render/renderer';
import { TileType } from '../../src/world/tiles';
import type { StoreyLook } from './storeyview-page';

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

/** The path the body is walking, read afresh: what a call has just set. */
const pathOf = (g: Game): Array<{ x: number; y: number; level: number }> => g.player.path ?? [];

/* ---- the ground, as it was, to be put back ------------------------------- */
const X0 = 14, X1 = 28, Y0 = 19, Y1 = 33;
const heightsWere = psql(`select string_agg(gx || ',' || gy || ',' || coalesce(land_height(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1 + 1}) gx, generate_series(${Y0}, ${Y1 + 1}) gy;`);
const tilesWere = psql(`select string_agg(gx || ',' || gy || ',' || land_tile(${W}, gx, gy) || ',' || coalesce(land_data(${W}, gx, gy), 0), ';')
  from generate_series(${X0}, ${X1}) gx, generate_series(${Y0}, ${Y1}) gy;`);
const daneWas = psql(`select x || ',' || y || ',' || level from player where world_id = ${W} and name = 'Dane';`);

/* ---- the same ground on both sides: level grass at twenty ------------------ */
const BASE = 20;
const game = Game.create(4243);
const bld = game.buildings;
const world = game.world;
(game as unknown as { deed: unknown }).deed = { name: 'Latecomer', x: 21, y: 26, radius: 5, level: 1, mine: true };
for (let y = Y0; y <= Y1 + 1; y++) for (let x = X0; x <= X1 + 1; x++) world.setHeight(x, y, BASE);
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) world.setTile(x, y, TileType.Grass, 0);
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
  for gx in ${X0}..${X1 + 1} loop for gy in ${Y0}..${Y1 + 1} loop perform land_set_height(w, gx, gy, ${BASE}); end loop; end loop;
  for gx in ${X0}..${X1} loop for gy in ${Y0}..${Y1} loop
    perform land_set_tile(w, gx, gy, tile_id('Grass')); perform land_set_data(w, gx, gy, 0);
  end loop; end loop;
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
const building = (id: number, name: string, tiles: Array<[number, number]>, levels: number): void => {
  const b = bld.create(name, tiles[0][0], tiles[0][1]);
  if (b.id !== id) throw new Error(`the browser numbered ${name} ${b.id}, not ${id}`);
  for (const [x, y] of tiles.slice(1)) bld.addTile(b, x, y);
  b.levels = levels;
  b.workLevel = levels - 1;
  sql(`insert into building (world_id, id, name, levels, work_level, planned_by) values (w, ${id}, '${name}', ${levels}, ${levels - 1}, u);
    insert into building_tile (world_id, building, x, y) values ${tiles.map(([x, y]) => `(w, ${id}, ${x}, ${y})`).join(', ')};`);
};
const wall = (id: number, level: number, x: number, y: number, side: Side, type: WallType): void => {
  const wl = bld.setWall(bld.list.get(id)!, level, x, y, side, type, 'log');
  for (const k of Object.keys(wl.needed)) wl.needed[k] = 0;
  const { bx, by, dir } = along(x, y, side);
  sql(`delete from wall where world_id = w and level = ${level} and dir = '${dir}' and x = ${bx} and y = ${by};
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    values (w, ${level}, '${dir}', ${bx}, ${by}, ${id}, '${type}', 'log', '${JSON.stringify(wl.needed)}', '${JSON.stringify(wl.total)}');`);
};
const floor = (id: number, level: number, x: number, y: number, kind: 'floor' | 'stairs' = 'floor', facing?: Side): void => {
  const f = bld.setFloor(bld.list.get(id)!, level, x, y, 'plank', kind, facing);
  for (const k of Object.keys(f.needed)) f.needed[k] = 0;
  sql(`delete from floor_tile where world_id = w and level = ${level} and x = ${x} and y = ${y};
    insert into floor_tile (world_id, level, x, y, building, material, kind, facing, needed, total)
    values (w, ${level}, ${x}, ${y}, ${id}, 'plank', '${kind}', ${facing ? `'${facing}'` : 'null'}, '${JSON.stringify(f.needed)}', '${JSON.stringify(f.total)}');`);
};

/* ---- a hall of six tiles, two storeys ----------------------------------------
 *
 *   (20,24) (21,24) (22,24)   log walls all round both storeys; a door in the
 *   (20,25) (21,25) (22,25)   ground floor's south wall of (20,25); plank
 *                             floors on storey 2, but for a staircase up on
 *                             (22,24), climbed from the south; a door in
 *                             storey 2's west wall of (20,24).
 *   (19,24)                   a jetty off it, on storey 2.
 *   (21,26)                   an outside staircase up to storey 2, its head
 *                             against a solid wall.
 *   (23,24)                   open air beside it, where a jetty could go.
 */
const HALL: Array<[number, number]> = [[20, 24], [21, 24], [22, 24], [20, 25], [21, 25], [22, 25]];
building(1, 'Hall', HALL, 2);
const OUTER: Array<[number, number, Side]> = [
  [20, 24, 'n'], [21, 24, 'n'], [22, 24, 'n'], [22, 24, 'e'], [22, 25, 'e'],
  [20, 25, 's'], [21, 25, 's'], [22, 25, 's'], [20, 24, 'w'], [20, 25, 'w'],
];
for (const [x, y, side] of OUTER) wall(1, 0, x, y, side, x === 20 && y === 25 && side === 's' ? 'door' : 'solid');
for (const [x, y, side] of OUTER) wall(1, 1, x, y, side, x === 20 && y === 24 && side === 'w' ? 'door' : 'solid');
for (const [x, y] of HALL) {
  if (x === 22 && y === 24) floor(1, 1, x, y, 'stairs', 's');
  else floor(1, 1, x, y);
}
floor(1, 1, 19, 24);
floor(1, 1, 21, 26, 'stairs', 's');

/* ---- pinned on storey 2 ------------------------------------------------------- */
game.settings.viewLevel = 1;
check('pinned on storey 2, the storey pinned is storey 2', game.pinnedStorey() === 1, `${game.pinnedStorey()}`);
{
  const answers = (x: number, y: number, level = 1): boolean => storeyTileAt(game, x, y, level);
  check('a click answers on the hall\'s floor, its staircase, the jetty, the outside staircase\'s head and the open air beside it',
    answers(21, 25) && answers(22, 24) && answers(19, 24) && answers(21, 26) && answers(23, 24),
    `floor ${answers(21, 25)}, staircase ${answers(22, 24)}, jetty ${answers(19, 24)}, outside staircase ${answers(21, 26)}, open air ${answers(23, 24)}`);
  check('and not on far ground, nor two tiles out', !answers(26, 30) && !answers(25, 24) && !answers(21, 28),
    `far ${answers(26, 30)}, two east ${answers(25, 24)}, two south ${answers(21, 28)}`);
  check('on the roof\'s own level, the hall\'s tiles answer and nothing round them does; a storey over the roof is nothing',
    answers(21, 24, 2) && !answers(19, 24, 2) && !answers(23, 24, 2) && !answers(21, 24, 3));
  const want = BASE + WALL_HEIGHT;
  const heights = [[21, 25], [19, 24], [21, 26], [23, 24]].map(([x, y]) => storeyHeight(game, x, y, 1));
  check('each at the height its floor is drawn at: the ground at the footprint, a storey up', heights.every((h) => h === want),
    `${heights.join(', ')}; want ${want}`);
}

/* ---- walked up to it ------------------------------------------------------------ */
{
  const went = game.moveTo(20, 24, false, true, 1);
  const path = pathOf(game);
  const end = path[path.length - 1];
  const stair = path.findIndex((p) => p.x === 22 && p.y === 24 && p.level === 1);
  check('a walk to a tile of storey 2 from the ground outside sets off, and ends on storey 2 on that tile', went && !!end && end.x === 20 && end.y === 24 && end.level === 1,
    `${went}, ends ${end ? `${end.x},${end.y} storey ${end.level + 1}` : 'nowhere'}`);
  check('up the staircase inside, in the door at the foot of the hall', stair > 0 && path.slice(0, stair).every((p) => p.level === 0),
    path.map((p) => `${p.x},${p.y}:${p.level}`).join(' '));

  // The same walk, a step at a time, to the island: as `Island.move` says it, one tile at a time on its storey.
  let x = 20.5, y = 27.5, level = 0;
  const said: string[] = [];
  let held = '';
  for (const p of path) {
    const answer = psql(`
      update player set moved_at = now() - interval '10 seconds', away = false where world_id = ${W} and uid = ${DANE};
      select set_config('request.jwt.claims', json_build_object('sub', ${DANE})::text, false) \\g /dev/null
      select rpc_move(${W}, ${p.x + 0.5}, ${p.y + 0.5}, ${p.level})::text;`).split('\n').pop() ?? '{}';
    const a = JSON.parse(answer) as { x: number; y: number; level: number; blocked?: boolean };
    said.push(`${Math.floor(a.x)},${Math.floor(a.y)}:${a.level}${a.blocked ? '!' : ''}`);
    if ((a.blocked || Math.floor(a.x) !== p.x || Math.floor(a.y) !== p.y || a.level !== p.level) && !held) held = `${p.x},${p.y}:${p.level}`;
    ({ x, y, level } = a);
  }
  check('replayed a step at a time through rpc_move, the island holds the body back at no step', held === '', `held at ${held}; ${said.join(' ')}`);
  check('and has it on storey 2 on that tile at the end', Math.floor(x) === 20 && Math.floor(y) === 24 && level === 1, `${x.toFixed(2)},${y.toFixed(2)} level ${level}`);
  game.player.path = null;
}
{
  game.player.x = 20.5; game.player.y = 27.5; game.player.level = 0;
  game.log.length = 0;
  const went = game.moveTo(26, 30, false, false, 1);
  const said = game.log.map((l) => l.text).pop() ?? 'NOTHING SAID';
  check('a walk to storey 2 over far ground is refused, and says so', !went && said === 'No floor on storey 2.', `${went}, "${said}"`);
  game.log.length = 0;
  const twice = game.moveTo(25, 30, false, false, 1);
  const again = game.log.map((l) => l.text).pop() ?? 'NOTHING SAID';
  check('in the same words every time', !twice && again === said, `"${again}"`);
}

/* ---- the rows for storey 2 name storey 2 -------------------------------------- */
{
  const asked: Target[] = [];
  const was = game.requestAction.bind(game);
  (game as unknown as { requestAction: (def: ActionDef, t: Target) => void }).requestAction = (_def: ActionDef, t: Target) => { asked.push(t); };
  const press = (rows: MenuItem[]): void => {
    for (const r of rows) {
      if (r.children) press(r.children);
      else if (!r.disabled) r.onSelect?.();
    }
  };
  const pick = (x: number, y: number): Pick => ({ x, y, wx: x + 0.9, wy: y + 0.5, cx: x + 1, cy: y + 1, level: 1 });
  press(frameJettyEntries(game, pick(19, 24), undefined, 1));
  const jetty = asked.splice(0);
  press(frameJettyEntries(game, pick(23, 24), undefined, 1));
  const air = asked.splice(0);
  press(frameFootprintEntries(game, pick(21, 25), bld.list.get(1)!, 1));
  const footprint = asked.splice(0);
  const levels = (ts: Target[]): string => ts.map((t) => (t.kind === 'tile' ? String(t.level) : '-')).join(',');
  check('the jetty\'s rows ask for jobs on storey 2, every one', jetty.length > 0 && jetty.every((t) => t.kind === 'tile' && t.level === 1), levels(jetty));
  check('and the open air\'s: a jetty floor on storey 2', air.length > 0 && air.every((t) => t.kind === 'tile' && t.level === 1), levels(air));
  check('and the footprint\'s columns, on storey 2', footprint.length > 0 && footprint.every((t) => t.kind === 'tile' && t.level === 1), levels(footprint));
  game.settings.viewLevel = 2;
  press(frameJettyEntries(game, pick(23, 24), undefined, 2));
  check('pinned on the roof\'s level, a hall of two storeys has no jetty to plan beside it', asked.length === 0, levels(asked.splice(0)));
  (game as unknown as { requestAction: typeof was }).requestAction = was;
}

/* ---- on Auto, as before --------------------------------------------------------- */
{
  game.settings.viewLevel = null;
  check('on Auto no storey is pinned, and a building\'s storey is the one being worked', game.pinnedStorey() === null && game.storeyFor(bld.list.get(1)!) === 1);
  game.player.x = 20.5; game.player.y = 27.5; game.player.level = 0; game.player.path = null;
  const aim = game.walkFloor(21, 25);
  game.moveTo(21, 25, false, true);
  const mine = pathOf(game).map((p) => `${p.x},${p.y}:${p.level}`).join(' ');
  game.player.path = null;
  const { rule, levels, below } = game.movement();
  game.player.walkTo(world, 21, 25, rule, levels, below, aim);
  const before = pathOf(game).map((p) => `${p.x},${p.y}:${p.level}`).join(' ');
  game.player.path = null;
  check('a walk aims where it always did: no storey asked, and the path the walk always took', aim === undefined && mine === before && mine.endsWith(':0'),
    `aim ${aim}; ${mine} / ${before}`);
}

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
    ${heights.map(([x, y, h]) => `perform land_set_height(w, ${x}, ${y}, ${h});`).join('\n')}
    ${tiles.map(([x, y, t, d]) => `perform land_set_tile(w, ${x}, ${y}, ${t}); perform land_set_data(w, ${x}, ${y}, ${d});`).join('\n')}
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
const options = browserOptions();
if (!options) {
  console.log('storeyview: no Chromium here (set CHROME_PATH), so nothing was drawn.');
  if (process.env.STOREY_STRICT) bad.push('FAIL drawn: no Chromium');
} else {
  const bundled = await build({
    entryPoints: [resolve('supabase/test/storeyview-page.ts')],
    bundle: true, format: 'iife', write: false, logLevel: 'error',
    loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
    define: { 'import.meta.env': '{}' },
  });
  const browser = await chromium.launch(options);
  try {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
    const tab = await ctx.newPage();
    const thrown: string[] = [];
    tab.on('pageerror', (e) => thrown.push(e.message));
    await tab.setContent('<html><body style="margin:0;overflow:hidden"></body></html>');
    await tab.addScriptTag({ content: bundled.outputFiles[0].text });
    type Page = { look: (view: number | null, x: number, y: number, level: number) => StoreyLook; hx: number; hy: number; CHEST: number; BED: number };
    const look = (view: number | null, x: number, y: number, level: number): Promise<StoreyLook> =>
      tab.evaluate(([view, x, y, level]) => (window as unknown as { storeyview: Page }).storeyview.look(view, x, y, level), [view, x, y, level] as const);
    const at = await tab.evaluate(() => { const s = (window as unknown as { storeyview: Page }).storeyview; return { hx: s.hx, hy: s.hy, CHEST: s.CHEST, BED: s.BED }; });
    const tx = at.hx + 1, ty = at.hy + 2;
    const auto = await look(null, tx, ty, 0);
    const up = await look(1, tx, ty, 1);
    const down = await look(0, tx, ty, 0);
    const storeys = (l: StoreyLook, building: number): string => [...new Set(l.walls.filter((w) => w.building === building).map((w) => w.level))].sort().join(',') || 'none';
    check('on Auto the hall\'s walls of both storeys are drawn', storeys(auto, 1) === '0,1', storeys(auto, 1));
    check('pinned on storey 2, no wall of the ground floor is drawn, of any building; storey 2\'s are',
      !up.walls.some((w) => w.level === 0) && storeys(up, 1) === '1', `hall ${storeys(up, 1)}, shed ${storeys(up, 2)}`);
    check('nor the chest on the ground floor; the bed on storey 2 is', !up.pieces.includes(at.CHEST) && up.pieces.includes(at.BED), up.pieces.join(','));
    check('pinned on the ground floor, no wall of storey 2 is drawn, nor the bed', !down.walls.some((w) => w.level === 1) && storeys(down, 1) === '0'
      && !down.pieces.includes(at.BED) && down.pieces.includes(at.CHEST), `hall ${storeys(down, 1)}; pieces ${down.pieces.join(',')}`);
    check('a click on a floor tile of storey 2 picks that tile, on storey 2', up.pick?.x === tx && up.pick?.y === ty && up.pick?.level === 1 && up.pick?.furniture === undefined,
      JSON.stringify(up.pick));
    check('and its menu is storey 2\'s', up.title === `Hall · storey 2 (${tx}, ${ty})` && up.rows.some((r) => r.startsWith('Plan wall')), `${up.title}: ${up.rows.join(' / ')}`);
    // Build bridge from here is on both: storey to storey, roof to roof (What's new 355).
    check('and Build bridge from here is on it, as on the ground\'s', up.rows.includes('Build bridge from here'), up.rows.join(' / '));
    const groundOnly = [...up.ground.filter((r) => r !== 'Build bridge from here'), 'Found a settlement here', 'Dig out the cellar', 'Remove from plan', 'Work on storey 2', 'Pick up'];
    const leaked = up.rows.filter((r) => groundOnly.includes(r));
    check('with none of the ground\'s jobs in it', up.ground.length > 0 && leaked.length === 0, leaked.join(' / ') || `${up.ground.length} ground jobs left out`);
    check('the ground floor\'s menu, pinned, is the ground\'s, on the ground floor', down.pick?.level === 0 && down.rows.some((r) => up.ground.includes(r)),
      `${down.title}: ${down.rows.join(' / ')}`);
    check('and the page threw nothing', thrown.length === 0, thrown.join('; '));
  } finally {
    await browser.close();
  }
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} storey mode checks failed`);
  process.exit(1);
}
console.log(`storey mode — ${ok.length} of ${ok.length}`);
