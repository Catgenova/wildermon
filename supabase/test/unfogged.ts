/**
 * With the fog off, the map and the world show the island, and not the generator's guess at it.
 *
 * Reported: "I turned fog of war off and found fruit trees like lemons on the volcano island, but when I turned fog
 * back on and went in person the trees weren't there." A browser works every square out from the seed and lays the
 * island's own land over the squares it reads (`Island.readLand`); with the fog off every square was drawn, read or
 * not, so the seed's trees stood where the island had others. Asked here, out of a browser, with the island's
 * window door answered from an island laid as the live one was (apple where the generator now grows lemon):
 *
 *   * a square not read is unseen with the fog off, and is asked for, once;
 *   * a square read is in sight, and shows the island's tree rather than the seed's;
 *   * the asks are read one square of `LAND_STEP` at a time, nearest the body first, no sooner than
 *     `LAND_UNFOGGED_EVERY` apart, and each read is drawn afresh (`Vision.revision`, `dirty`);
 *   * with the fog on, nothing is asked; ground that came by the old road is shown whole.
 */
import { Island, type PlayerRow } from '../../src/net/island';
import { Vision, UNSEEN, VISIBLE } from '../../src/game/vision';
import type { Game } from '../../src/game/game';
import { generateAtlasWindow, regionAt } from '../../src/world/atlas-world';
import { REGIONS } from '../../src/world/regions';
import { packTreeData, TileType, TREE_DEFS, treeSpecies, treeVariant } from '../../src/world/tiles';
import { CHUNK, World } from '../../src/world/world';
import { LAND_STEP, LAND_UNFOGGED_EVERY } from '../../src/game/keep';
import { readAtlas } from '../../tools/atlas-node';

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const SIZE = 1024;
const SEED = 4242;
const atlas = readAtlas();
const gen = (x0: number, y0: number, w: number, h: number): ReturnType<typeof generateAtlasWindow> =>
  generateAtlasWindow(SEED, atlas, x0, y0, w, h, SIZE);
const APPLE = TREE_DEFS.findIndex((t) => t.name === 'Apple');
const LEMON = TREE_DEFS.findIndex((t) => t.name === 'Lemon');
const VOLCANO = REGIONS.findIndex((R) => R.key === 'Volcano');
const CRESCENT = REGIONS.findIndex((R) => R.key === 'Crescent');

/* ---- the island, laid as the live one was ---------------------------------- */

const isleLand = new World(SIZE, SIZE);
isleLand.seed = SEED;
isleLand.streamFrom(gen);
isleLand.ensureBox(0, 0, SIZE - 1, SIZE - 1);
let lemon = -1;
for (let i = 0; i < SIZE * SIZE; i++) {
  if (isleLand.tiles[i] !== TileType.Tree || treeSpecies(isleLand.data[i]) !== LEMON) continue;
  isleLand.data[i] = packTreeData(APPLE, treeVariant(isleLand.data[i]));
  if (lemon < 0) lemon = i;
}
const lx = lemon % SIZE;
const ly = Math.floor(lemon / SIZE);
check('the seed grows a lemon on Volcano Isle where the island has an apple', lemon >= 0 && regionAt(atlas, lx, ly, SIZE) === VOLCANO, `${lx},${ly}`);

const b64 = (a: Uint8Array): string => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
/** The island's window door: the box asked for, tiles and the corners round them. */
const windowOf = (x0: number, y0: number, x1: number, y1: number): unknown => {
  const cw = SIZE + 1;
  const hb = new Uint8Array(isleLand.heights.buffer);
  const rows = [];
  for (let y = y0; y <= y1 + 1; y++) {
    const row: Record<string, unknown> = {
      y, x0,
      heights: b64(hb.subarray((y * cw + x0) * 2, (y * cw + x1 + 2) * 2)),
      dirt: b64(isleLand.dirt.subarray(y * cw + x0, y * cw + x1 + 2)),
    };
    if (y <= y1) {
      row.tiles = b64(isleLand.tiles.subarray(y * SIZE + x0, y * SIZE + x1 + 1));
      row.data = b64(isleLand.data.subarray(y * SIZE + x0, y * SIZE + x1 + 1));
      row.rock = b64(isleLand.rock.subarray(y * SIZE + x0, y * SIZE + x1 + 1));
    }
    rows.push(row);
  }
  return { n: 0, x0, y0, x1, y1, rows };
};
const asked: Array<[number, number, number, number]> = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.endsWith('/rest/v1/rpc/rpc_land_window')) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  const p = JSON.parse(String(init?.body ?? '{}')) as Record<string, number>;
  asked.push([p.p_x0, p.p_y0, p.p_x1, p.p_y1]);
  return new Response(JSON.stringify(windowOf(p.p_x0, p.p_y0, Math.min(SIZE - 1, p.p_x1), Math.min(SIZE - 1, p.p_y1))),
    { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

/* ---- a browser come ashore on the Crescent --------------------------------- */

const world = new World(SIZE, SIZE);
world.seed = SEED;
world.streamFrom(gen);
const [cx, cy] = REGIONS[CRESCENT].at.map((v) => Math.floor(v * SIZE));
check('the body stands on the Crescent', regionAt(atlas, cx, cy, SIZE) === CRESCENT, `${cx},${cy}`);
const isle = new Island({ ground: () => {} } as never);
isle.info = { id: 'w', name: 'w', seed: SEED, size: SIZE, spawn_x: cx, spawn_y: cy, ready: true, epoch: '2026-01-01T00:00:00Z' } as never;
isle.me = { x: cx + 0.5, y: cy + 0.5 } as PlayerRow;
isle.world = world;
world.trackRead();
const reach = isle as unknown as { readLand(x0: number, y0: number, x1: number, y1: number): Promise<number>; readUnfogged(now: number): Promise<void> };
await reach.readLand(cx - 192, cy - 192, cx + 192, cy + 192);

const game = { world, settings: { fog: false } } as unknown as Game;
const vision = new Vision(game);

check('the ground round the body, read, is in sight with the fog off', vision.state(cx, cy) === VISIBLE);
check('the seed\'s lemon, not read, is unseen with the fog off', vision.state(lx, ly) === UNSEEN);
const lemonSquare = Math.floor(ly / CHUNK) * Math.ceil(SIZE / CHUNK) + Math.floor(lx / CHUNK);
check('and its square is asked for', world.readWanted.has(lemonSquare));
vision.state(lx, ly);
vision.state(lx - (lx % CHUNK), ly - (ly % CHUNK));
check('once, however often it is drawn', world.readWanted.size === 1, `${world.readWanted.size}`);

// The whole map drawn, as the map window does with the fog off.
for (let y = 0; y < SIZE; y += 8) for (let x = 0; x < SIZE; x += 8) vision.state(x, y);
const wanted = world.readWanted.size;
const squares = Math.ceil(SIZE / CHUNK) ** 2;
check('the map drawn whole asks for every square not read', wanted > 0 && wanted < squares, `${wanted} of ${squares}`);

/* ---- read in turn ------------------------------------------------------------ */

let nearestX = -1, nearestY = -1, away = Infinity;
for (const c of world.readWanted) {
  const x = (c % Math.ceil(SIZE / CHUNK)) * CHUNK + CHUNK / 2, y = Math.floor(c / Math.ceil(SIZE / CHUNK)) * CHUNK + CHUNK / 2;
  const d = Math.hypot(x - cx - 0.5, y - cy - 0.5);
  if (d < away) { away = d; nearestX = x; nearestY = y; }
}
vision.update();
const rev0 = vision.revision;
asked.length = 0;
let now = 1000;
await reach.readUnfogged(now);
check('one square read at a time', asked.length === 1, JSON.stringify(asked));
const [ax0, ay0, ax1, ay1] = asked[0] ?? [0, 0, 0, 0];
check(`of ${LAND_STEP} tiles a side, on the grid`, ax1 - ax0 + 1 === Math.min(LAND_STEP, SIZE - ax0) && ax0 % LAND_STEP === 0 && ay0 % LAND_STEP === 0,
  JSON.stringify(asked[0]));
const [nx, ny] = [nearestX, nearestY];
check('the square holding the wanted ground nearest the body first', nx >= ax0 && nx <= ax1 && ny >= ay0 && ny <= ay1,
  `${JSON.stringify(asked[0])}, nearest ${nx},${ny}`);
await reach.readUnfogged(now + LAND_UNFOGGED_EVERY / 2);
check(`and no other inside ${LAND_UNFOGGED_EVERY} s`, asked.length === 1, `${asked.length}`);
vision.update();
check('what was read is drawn afresh', vision.revision === rev0 + 1 && !!vision.dirty
  && vision.dirty.x0 <= ax0 && vision.dirty.x1 >= Math.min(SIZE - 1, ax1) && vision.dirty.y0 <= ay0 && vision.dirty.y1 >= Math.min(SIZE - 1, ay1),
  JSON.stringify(vision.dirty));
check('and is in sight', vision.state(ax0, ay0) === VISIBLE);

for (let i = 0; i < squares && world.readWanted.size; i++) {
  now += LAND_UNFOGGED_EVERY;
  await reach.readUnfogged(now);
}
check('every square asked for is read in the end, each once', world.readWanted.size === 0 && asked.length <= Math.ceil(SIZE / LAND_STEP) ** 2,
  `${asked.length} reads, ${world.readWanted.size} left`);
check('Volcano Isle, read, is in sight', vision.state(lx, ly) === VISIBLE);
check('and shows the island\'s apple, not the seed\'s lemon',
  world.viewTile(lx, ly, true) === TileType.Tree && treeSpecies(world.viewData(lx, ly, true)) === APPLE,
  TREE_DEFS[treeSpecies(world.viewData(lx, ly, true))]?.name);

/* ---- the fog on, and the old road -------------------------------------------- */

world.forgetRead();
game.settings.fog = true;
vision.state(lx, ly);
check('with the fog on, nothing is asked', world.readWanted.size === 0);
world.untrackRead();
game.settings.fog = false;
check('ground that came by the old road is shown whole', vision.state(lx, ly) === VISIBLE && world.readWanted.size === 0);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
