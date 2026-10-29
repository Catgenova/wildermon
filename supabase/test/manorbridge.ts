/**
 * A walk from the ground onto Solara Manor's storey-4 bridge finds its way, as it is on the island.
 *
 * Reported with a screenshot: "nothing but pathing errors when trying to walk a bridge" -- "No path there." on every
 * click on the deck of a marble bridge three lanes wide between two buildings' storey 4 (west building 6, east
 * building 5), from the ground east of them. The layout is the island's own, read off it (`look.yml`, "Solara
 * Manor's two buildings and the ground round them") and kept here (`manorbridge.json`), moved into a small island.
 *
 * Before a deck counted as somewhere a walk on a pinned storey ends (`walkEnd`), every tile past its first column was
 * "No path there.". So this asks of the browser's path search (`Game.moveTo`), from where the walk began:
 *
 *   * onto every tile of the deck at storey 4, a way is found, and it ends on the deck at storey 4;
 *   * up the west building's finished flights, the east one's last flight being only planned;
 *   * and every step of it is one the step rule allows (`stepRule`).
 */
import { readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import type { PathPoint } from '../../src/world/pathfinding';
import type { TileType } from '../../src/world/tiles';
import type { Bridge } from '../../src/game/bridges';
import type { BuildingsJSON, FloorKind, Wall } from '../../src/game/building';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

type Row = { buildings: Array<{ id: number; name: string; levels: number; roof: string | null; deck: number | null; work_level: number | null }>;
  tiles: Array<[number, number, number, boolean | null]>;
  floors: Array<[number, number, number, number, string, string | null, string, boolean]>;
  walls: Array<[number, number, string, number, number, string, string, boolean, boolean | null]>;
  land: Array<[number, number, number, number]> };
const L = JSON.parse(readFileSync(new URL('./manorbridge.json', import.meta.url), 'utf8')) as Row;
/** Moved into a small island: the live coordinates less these. */
const OX = 2550, OY = 2980;
const AX = 2573 - OX, BX = 2579 - OX, Y = 3006 - OY, UP = 3;
const FROM = { x: 2588 - OX, y: 3008 - OY };
const done = { needed: {}, total: {} };
const short = { needed: { plank: 1 }, total: { plank: 1 } };

const g = Game.create(4242, 64);
/** The walk the player was just given, read through a call so a reset just before it does not narrow it away. */
const pathOf = (): PathPoint[] => g.player.path ?? [];
for (const [x, y, h, t] of L.land) {
  if (!g.world.inBounds(x - OX, y - OY) && !(x - OX === 64 || y - OY === 64)) continue;
  g.world.setHeight(x - OX, y - OY, h);
  if (g.world.inBounds(x - OX, y - OY)) g.world.setTile(x - OX, y - OY, t as TileType, 0);
}
const json: BuildingsJSON = {
  nextId: 100,
  list: L.buildings.map((b) => ({ id: b.id, name: b.name, levels: b.levels, ...(b.roof ? { roof: b.roof as never } : {}), deck: b.deck,
    ...(b.work_level !== null ? { workLevel: b.work_level } : {}),
    tiles: L.tiles.filter((t) => t[0] === b.id).map((t) => `${t[1] - OX},${t[2] - OY}`) })),
  walls: L.walls.map(([building, level, dir, x, y, type, material, finished, lowered]) => ({
    building, level, dir, x: x - OX, y: y - OY, type, material, ...(finished ? done : short), ...(lowered ? { lowered } : {}) }) as unknown as Wall),
  floors: L.floors.map(([building, level, x, y, kind, facing, material, finished]) => ({
    building, level, x: x - OX, y: y - OY, kind: kind as FloorKind, ...(facing ? { facing } : {}), material, ...(finished ? done : short) }) as never),
};
g.buildings.sawIsland(json as never);
const plan = {
  id: 1, kind: 'marble', ax: AX, ay: Y, bx: BX, by: Y, height: 91, level: UP, width: 3, side: 1, rise: 0,
  spans: Array.from({ length: BX - AX - 1 }, (_, i) => ({ x: AX + 1 + i, y: Y, needed: {}, total: {} })),
} as unknown as Bridge;
g.bridges.set(plan.id, plan);
g.reindexDecks();

const deck: Array<{ x: number; y: number }> = [];
for (let x = AX + 1; x < BX; x++) for (const o of [-1, 0, 1]) deck.push({ x, y: Y + o });
const results = deck.map((t) => {
  g.player.x = FROM.x + 0.5;
  g.player.y = FROM.y + 0.5;
  g.player.level = 0;
  g.player.path = null;
  const found = g.moveTo(t.x, t.y, false, true, UP);
  const path = pathOf();
  const end = path[path.length - 1];
  let l = 0, px = FROM.x, py = FROM.y, allowed = true;
  for (const s of path) {
    if (s.x === px && s.y === py) { l = s.level; continue; }
    const r = g.stepRule(px, py, l, s.x, s.y);
    if (r !== s.level) allowed = false;
    px = s.x; py = s.y; l = s.level;
  }
  return { t, found, end, allowed, steps: path.length, levels: [...new Set(path.map((s) => s.level))].join('') };
});
const missed = results.filter((r) => !r.found || !r.end || r.end.x !== r.t.x || r.end.y !== r.t.y || r.end.level !== UP);
check('from the ground east of the manor, a walk onto every tile of the deck at storey 4 is found and ends there',
  missed.length === 0, missed.map((r) => `${r.t.x + OX},${r.t.y + OY}: ${r.found ? `ends ${r.end?.x},${r.end?.y}@${r.end?.level}` : 'No path there.'}`).join('; '));
check('and every step of each is one the step rule allows', results.every((r) => !r.found || r.allowed),
  results.filter((r) => r.found && !r.allowed).map((r) => `${r.t.x + OX},${r.t.y + OY}`).join(' '));
console.log(results.map((r) => `${r.t.x + OX},${r.t.y + OY}: ${r.found ? `${r.steps} steps, storeys ${r.levels}` : 'none'}`).join('\n'));

/** From each building, on every storey you can stand on there, and from the ground east: storey 4 pinned, and Auto. */
const starts: Array<{ x: number; y: number; l: number }> = [{ ...FROM, l: 0 }];
for (const [bx, by] of [[2572, 3006], [2580, 3006], [2571, 3005], [2581, 3007]]) for (let l = 0; l <= UP; l++) {
  if (l === 0 || g.standable(bx - OX, by - OY, l)) starts.push({ x: bx - OX, y: by - OY, l });
}
const fails: string[] = [];
for (const s of starts) {
  for (const t of deck) {
    for (const floor of [UP, undefined]) {
      g.player.x = s.x + 0.5;
      g.player.y = s.y + 0.5;
      g.player.level = s.l;
      g.player.path = null;
      const found = g.moveTo(t.x, t.y, false, true, floor);
      const path = pathOf();
      const end = path[path.length - 1];
      const there = (s.x === t.x && s.y === t.y) || (end && end.x === t.x && end.y === t.y && (floor === undefined || end.level === floor));
      if (!found || !there) fails.push(`${s.x + OX},${s.y + OY}@${s.l} → ${t.x + OX},${t.y + OY}${floor === undefined ? ' (Auto)' : ''}: ${found ? `ends ${end?.x === undefined ? '-' : `${end.x + OX},${end.y + OY}@${end.level}`}` : 'No path there.'}`);
    }
  }
}
check(`from ${starts.length} starts (the ground east, each building on each storey), storey 4 pinned and Auto, every deck tile is reached`,
  fails.length === 0, `${fails.length}: ${fails.slice(0, 8).join('; ')}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a walk from the ground onto Solara Manor's storey-4 bridge finds its way — ${ok.length} of ${ok.length}`);
