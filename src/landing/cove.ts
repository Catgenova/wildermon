import { Game } from '../game/game';
import { DAY_SECONDS } from '../game/pace';
import { SETTING_DEFAULTS, type Settings } from '../game/settings';
import { RUNESTONE_BY_ID, STONE_HALF, STONE_LEAST, stoneCentre, type RunestoneId } from '../game/runestones';
import { YEAR_FROM, SEASON_DAYS } from '../world/calendar';
import { hash2, mulberry32, Noise2D } from '../world/noise';
import { stoneKindAt } from '../world/ore';
import { TileType, TREE_DEFS, BUSH_DEFS, packTreeData } from '../world/tiles';
import { World } from '../world/world';

/**
 * The cove behind the landing page: a small bay laid by hand round one of the
 * Runestones, for the game's own renderer to draw (`./backdrop.ts`).
 *
 * Nothing here is played. There is no island behind it and no body in it:
 * the game's rules are only what the renderer reads the ground through. The
 * world is the smallest the Runestones stand on (`STONE_LEAST`), deep sea
 * everywhere but the few dozen tiles round the stone, which are all a screen
 * ever shows.
 */

/** The stone the cove is laid round. */
export const COVE_STONE: RunestoneId = 'sunreach';
/** The world: the smallest a Runestone stands on. */
const SIZE = STONE_LEAST;
/** The seed the ground, the wind and the wildflowers are rolled from. */
const SEED = 5587;
/** How far round the stone the land is laid, in tiles. */
const REACH = 46;
/** The open sea's floor. */
const DEEP = -70;
/** Hour of the day the cove is drawn at: late afternoon, long shadows and the butterflies still out. */
const COVE_HOUR = 12.5;
/** Day of the island's year it is drawn on: high summer, flowers out. */
const COVE_DAY = SEASON_DAYS + 30;

const species = (name: string): number => TREE_DEFS.findIndex((t) => t.name === name);
const bush = (name: string): number => BUSH_DEFS.findIndex((b) => b.name === name);

/** Tree ages by id (`TREE_AGES`): young, mature, old. */
const YOUNG = 0;
const MATURE = 1;
const OLD = 2;

export interface Cove {
  game: Game;
  /** The stone's centre, the point the camera is laid out round. */
  stone: { x: number; y: number; h: number };
  /** A point of the world by where it is from the stone: `a` toward the sea, `b` across (`waterAt`). */
  spot: (a: number, b: number) => { x: number; y: number };
}

/**
 * The shape of the cove, in two numbers off the stone: `a`, toward the open
 * sea (down the screen at the camera's first turn), and `b`, across it
 * (right on the screen).
 *
 * The bay is a round one: a disc of water `BAY_R` across, its middle `BAY_A`
 * in front of the stone, cut through to the open sea where the coast outside
 * it (`SEA_A`, falling back either side past the bay) crosses it. What is
 * left between the two either side is an arm, its tip rounded off where the
 * two meet (`ROUND`). Measured as a distance, so the strand, the meadow and
 * the hills follow the bay's curve rather than the grid.
 */
const BAY_A = 9;
const BAY_B = -0.5;
const BAY_R = 4.7;
/** Where the open sea's coast runs across, in front of the bay; and how far either side of the bay's middle it starts falling back. */
const SEA_A = 13.2;
const ARM = 5.2;
/** How far the bay's rim and the sea's coast are blended where they meet: the arms' tips are rounded by about this many tiles. */
const ROUND = 1.1;

/** How far a point is out in the water from the nearest shore, in tiles: below nought on land, by as far inland as it is. */
function waterAt(a: number, b: number): number {
  const bay = BAY_R - Math.hypot(a - BAY_A, b - BAY_B);
  const off = Math.max(0, Math.abs(b - BAY_B) - ARM);
  const sea = a - (SEA_A - 1.15 * off ** 1.3);
  // A smooth maximum of the two: water where either is.
  return ROUND * Math.log(Math.exp(bay / ROUND) + Math.exp(sea / ROUND));
}

export function buildCove(): Cove {
  const w = SIZE;
  const cw = w + 1;
  const s = stoneCentre(RUNESTONE_BY_ID.get(COVE_STONE)!, w);
  const ox = s.x + 0.5;
  const oy = s.y + 0.5;
  const rng = mulberry32(SEED);
  const hills = new Noise2D(rng);
  const shore = new Noise2D(rng);

  const heights = new Int16Array(cw * (w + 1)).fill(DEEP);
  const tiles = new Uint8Array(w * w).fill(TileType.Sand);
  const data = new Uint8Array(w * w);
  const dirt = new Uint8Array(cw * (w + 1)).fill(12);
  const rock = new Uint8Array(w * w);

  /** A point's place in the cove's own terms: `a` toward the sea and `b` across, off the stone. */
  const ab = (x: number, y: number): [number, number] => [(x - ox + y - oy) / Math.SQRT2, (x - ox - (y - oy)) / Math.SQRT2];
  /** How far inland a point is, in tiles (below nought: out under the water). */
  const inland = (x: number, y: number): number => {
    const [a, b] = ab(x, y);
    return -waterAt(a, b) + shore.fbm(x * 0.11, y * 0.11, 2) * 0.35;
  };
  /** The ground's height at a corner, from how far inland it is. */
  const heightAt = (x: number, y: number): number => {
    const t = inland(x, y);
    // A shelf of shallows, then the bay's floor falling away.
    if (t < 0) return Math.max(DEEP, -1 + t * 3 + Math.min(0, t + 2) * 4);
    // A strand, a meadow rising gently from it, and hills climbing in folds behind.
    const fold = hills.fbm(x * 0.07, y * 0.07, 3);
    const strand = Math.min(t, 2.2) * 1.5;
    const meadow = Math.max(0, Math.min(t, 7) - 2.2) * 1.3;
    const hill = Math.max(0, t - 7) * (3 + fold * 1.4);
    return 1 + strand + meadow + hill + fold * Math.min(Math.max(0, t - 2.2), 5) * 0.7;
  };

  const x0 = s.x - REACH, x1 = s.x + REACH, y0 = s.y - REACH, y1 = s.y + REACH;
  for (let cy = y0; cy <= y1 + 1; cy++) {
    for (let cx = x0; cx <= x1 + 1; cx++) heights[cy * cw + cx] = Math.round(heightAt(cx, cy));
  }
  // The stone's three by three, and a tile round it, level.
  const level = Math.max(7, heights[s.y * cw + s.x]);
  for (let cy = s.y - STONE_HALF - 1; cy <= s.y + STONE_HALF + 2; cy++) {
    for (let cx = s.x - STONE_HALF - 1; cx <= s.x + STONE_HALF + 2; cx++) {
      const ring = cy === s.y - STONE_HALF - 1 || cy === s.y + STONE_HALF + 2 || cx === s.x - STONE_HALF - 1 || cx === s.x + STONE_HALF + 2;
      const i = cy * cw + cx;
      heights[i] = ring ? Math.round((heights[i] + level) / 2) : level;
    }
  }

  const world = new World(w, w, heights, tiles, data, dirt, rock);
  world.seed = SEED;
  const c = [0, 0, 0, 0];
  const r = (x: number, y: number, salt: number): number => hash2(x, y, SEED + salt);
  const near = (x: number, y: number, rx: number, ry: number, rad: number): boolean => Math.hypot(x - rx, y - ry) <= rad;
  /*
   * The strand: tiles whose middle is within this of the water. Narrow, so most of the sand there is is on the
   * tiles the waterline crosses, which the renderer cuts along the water's own smooth line; a wide band of whole
   * tiles was a staircase across every curve of the bay.
   */
  const STRAND = 0.7;
  // A bank of clay on the west arm, from the water's edge up into the meadow: one patch, not a scatter.
  const CLAY: Array<[number, number, number]> = [[8, -6.6, 1.8]];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      world.corners(x, y, c);
      const max = Math.max(c[0], c[1], c[2], c[3]);
      const [a, b] = ab(x + 0.5, y + 0.5);
      const t = inland(x + 0.5, y + 0.5);
      let tile: TileType = TileType.Grass;
      if (max >= 0 && t < 3.2 && CLAY.some(([ca, cb, cr]) => Math.hypot(a - ca, b - cb) <= cr)) tile = TileType.Clay;
      else if (max < 0 || t < STRAND) tile = TileType.Sand;
      world.tiles[y * w + x] = tile;
    }
  }
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) world.rock[y * w + x] = y >= y0 && y <= y1 && x >= x0 && x <= x1 ? stoneKindAt(SEED, x, y) : 0;

  /** Put a tree down, on grass that is clear of the stone. */
  const clearOfStone = (x: number, y: number): boolean => Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) > STONE_HALF + 1;
  const plant = (x: number, y: number, kind: TileType, d: number): void => {
    if (!world.inBounds(x, y) || !clearOfStone(x, y)) return;
    const t = world.tiles[y * w + x];
    if (t !== TileType.Grass && t !== TileType.Moss) return;
    world.corners(x, y, c);
    if (Math.min(...c) < 2) return;
    world.tiles[y * w + x] = kind;
    world.data[y * w + x] = d;
  };
  // By where it stands from the stone, in the cove's own `a` (toward the sea) and `b` (across).
  const at = (a: number, b: number): [number, number] => {
    const dx = (a + b) / Math.SQRT2;
    const dy = (a - b) / Math.SQRT2;
    return [Math.round(ox + dx - 0.5), Math.round(oy + dy - 0.5)];
  };
  /** Nothing grows in front of the stone, between it and the bay: its foot and the flowers round it stay in sight. */
  const open = (a: number, b: number): boolean => a > -1.5 && Math.abs(b) < 3.5;
  const shrub = (a: number, b: number, name: string): void => {
    const [x, y] = at(a, b);
    plant(x, y, TileType.Bush, bush(name));
  };
  /*
   * Birch and cherry and nothing else, as asked: birch up the hills behind
   * and on the arms' roots, cherry nearer the meadow and the stone. Each grove
   * is a drift of trees round a middle, thrown out from it by a roll of the
   * seed, of mixed ages so a grove is not one tree repeated.
   */
  const BIRCH = species('Birch');
  const CHERRY = species('Cherry');
  const groves: Array<[a: number, b: number, reach: number, trees: number, kind: number]> = [
    // The birch wood up the hill.
    [-6.5, -5, 2.6, 7, BIRCH], [-7.5, 3, 2.8, 8, BIRCH], [-11.5, -1, 3.4, 10, BIRCH], [-12.5, 7, 3, 7, BIRCH],
    [-10.5, -9, 2.8, 6, BIRCH], [-16, 2.5, 3.6, 9, BIRCH], [-15.5, -6.5, 3.2, 7, BIRCH], [-18, 10, 3, 5, BIRCH],
    // Birch on the arms' roots.
    [1.5, -10.5, 1.9, 4, BIRCH], [0, 11.5, 1.9, 4, BIRCH],
    // Cherry in the meadow either side of the stone, and down toward the water.
    [-3.2, -5.6, 1.7, 4, CHERRY], [-3, 5.6, 1.7, 4, CHERRY], [2.4, -7.4, 1.4, 3, CHERRY], [2.2, 7.8, 1.4, 3, CHERRY],
    [-5.2, 0.4, 1.3, 2, CHERRY], [-8.5, 8.5, 1.6, 3, CHERRY], [-9, -12, 1.6, 3, CHERRY],
  ];
  const roll = mulberry32(SEED + 17);
  for (const [ga, gb, reach, n, kind] of groves) {
    for (let i = 0; i < n; i++) {
      const turn = roll() * Math.PI * 2;
      const out = reach * Math.sqrt(roll());
      const a = ga + Math.cos(turn) * out, b = gb + Math.sin(turn) * out;
      if (open(a, b)) continue;
      const age = roll();
      const [x, y] = at(a, b);
      plant(x, y, TileType.Tree, packTreeData(kind, age < 0.25 ? YOUNG : age < 0.8 ? MATURE : OLD));
    }
  }
  // A lone tree here and there between the groves, so they thin out into the meadow rather than stop.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (world.tiles[y * w + x] !== TileType.Grass || r(x, y, 9) > 0.018) continue;
      const [a, b] = ab(x + 0.5, y + 0.5);
      if (open(a, b) || near(x, y, s.x, s.y, 4)) continue;
      plant(x, y, TileType.Tree, packTreeData(inland(x + 0.5, y + 0.5) > 7 ? BIRCH : CHERRY, r(x, y, 11) < 0.4 ? YOUNG : MATURE));
    }
  }
  // Roses and lavender in the meadow either side of the stone, and thorn at the wood's foot.
  const shrubs: Array<[number, number, string]> = [
    [-1.5, -3.8, 'Rose bush'], [0, 3.8, 'Lavender bush'], [-2, 6.5, 'Lavender bush'], [-1.8, -6.8, 'Rose bush'],
    [1.5, -5.5, 'Lavender bush'], [1.5, 5.5, 'Rose bush'], [-4.5, -2.5, 'Thorn bush'], [-4.2, 2.8, 'Rose bush'],
    [3.5, -8.5, 'Lavender bush'], [-0.5, 8.8, 'Rose bush'],
  ];
  for (const [a, b, n] of shrubs) shrub(a, b, n);

  const game = new Game({ seed: SEED, world, spawn: { x: 1, y: 1 } });
  // No body on the screen: whoever the game would draw stands in the far corner of the sea.
  game.putBody(1.5, 1.5, 0);
  // Its own settings, kept nowhere: the game's are in this browser's storage, and nothing here may change them.
  const settings: Settings = { ...SETTING_DEFAULTS, viewLevel: null, grid: false, fog: false, deedBorder: false, markThreats: false, stationRings: false, graphics: 'full', lowPower: false, timings: false };
  Object.defineProperty(game, 'settings', { value: settings });
  // A fixed hour of a summer's day, with the clock still running under it for the wind and the small life.
  const began = performance.now() / 1000;
  const summer = YEAR_FROM + COVE_DAY * DAY_SECONDS;
  game.islandClock = () => summer + (COVE_HOUR / 24) * DAY_SECONDS + (performance.now() / 1000 - began);
  game.wallClock = () => summer + (COVE_HOUR / 24) * DAY_SECONDS;
  game.hourOfDay = () => COVE_HOUR;
  game.creatures.fromIsland = true;
  game.springs.fromIsland = true;
  return { game, stone: { x: s.x + 0.5, y: s.y + 0.5, h: level }, spot: (a, b) => ({ x: ox + (a + b) / Math.SQRT2, y: oy + (a - b) / Math.SQRT2 }) };
}
