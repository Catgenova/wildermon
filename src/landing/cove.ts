import { Game } from '../game/game';
import { DAY_SECONDS } from '../game/pace';
import { SETTING_DEFAULTS, type Settings } from '../game/settings';
import { RUNESTONE_BY_ID, STONE_HALF, STONE_LEAST, stoneCentre, type RunestoneId } from '../game/runestones';
import { YEAR_FROM, SEASON_DAYS } from '../world/calendar';
import { hash2, mulberry32, Noise2D, smoothstep } from '../world/noise';
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
const SEED = 5407;
/** How far round the stone the land is laid, in tiles. */
const REACH = 46;
/** The open sea's floor. */
const DEEP = -70;
/** Hour of the day the cove is drawn at: late afternoon, long shadows and the butterflies still out. */
const COVE_HOUR = 16.6;
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
}

/**
 * The shape of the cove, in two numbers off the stone: `a`, toward the open
 * sea (down the screen at the camera's first turn), and `b`, across it
 * (right on the screen). The coast runs across at `a = coast(b)`: pushed back
 * into a bay in the middle, and out in two headlands either side of it.
 */
function coastAt(b: number, wob: number): number {
  const m = Math.abs(b);
  const bay = 7 * (1 - Math.exp(-((b / 4.6) ** 2)));
  // The west arm runs on past the screen's edge; the east one is a short point, with the open sea beyond it.
  const head = b < 0 ? 4 * Math.exp(-(((m - 8.5) / 3) ** 2)) : 2.5 * Math.exp(-(((m - 7) / 2.5) ** 2));
  const fall = b < 0 ? 7 * smoothstep(12, 19, m) : 12 * smoothstep(8.5, 14, m);
  return 4.5 + bay + head - fall + wob;
}

export function buildCove(): Cove {
  const w = SIZE;
  const cw = w + 1;
  const s = stoneCentre(RUNESTONE_BY_ID.get(COVE_STONE)!, w);
  // The bay's water lies in front of the stone, toward the open sea.
  const ox = s.x + 0.5;
  const oy = s.y + 0.5;
  const rng = mulberry32(SEED);
  const hills = new Noise2D(rng);
  const shore = new Noise2D(rng);
  const beds = new Noise2D(rng);

  const heights = new Int16Array(cw * (w + 1)).fill(DEEP);
  const tiles = new Uint8Array(w * w).fill(TileType.Sand);
  const data = new Uint8Array(w * w);
  const dirt = new Uint8Array(cw * (w + 1)).fill(12);
  const rock = new Uint8Array(w * w);

  /** How far inland a point is, in tiles (below nought: out under the water). */
  const inland = (x: number, y: number): number => {
    const dx = x - ox;
    const dy = y - oy;
    const a = (dx + dy) / Math.SQRT2;
    const b = (dx - dy) / Math.SQRT2;
    const wob = shore.fbm(x * 0.09, y * 0.09, 3) * 1.5;
    return coastAt(b + 2, wob) - a;
  };
  /** The ground's height at a corner, from how far inland it is. */
  const heightAt = (x: number, y: number): number => {
    const t = inland(x, y);
    if (t < 0) return Math.max(DEEP, -2 + t * 5 + Math.min(0, t + 5) * 7);
    // A strand, a meadow rising gently from it, and hills climbing in folds behind.
    const fold = hills.fbm(x * 0.07, y * 0.07, 3);
    const strand = Math.min(t, 3) * 1.6;
    const meadow = Math.max(0, Math.min(t, 8) - 3) * 1.6;
    const hill = Math.max(0, t - 8) * (3.2 + fold * 1.4);
    return strand + meadow + hill + fold * Math.min(Math.max(0, t - 3), 5) * 0.8;
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
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      world.corners(x, y, c);
      const min = Math.min(c[0], c[1], c[2], c[3]);
      const max = Math.max(c[0], c[1], c[2], c[3]);
      const avg = (c[0] + c[1] + c[2] + c[3]) / 4;
      const bed = beds.fbm(x * 0.12, y * 0.12, 2);
      let t: TileType = TileType.Grass;
      if (max < 0) {
        t = avg > -16 && r(x, y, 1) < 0.015 ? TileType.Kelp : TileType.Sand;
      } else if (min < 0 || avg < 4.5) {
        t = TileType.Sand;
        if (bed < -0.32) t = TileType.Clay;
      } else if (avg < 7 && bed < -0.22) {
        t = TileType.Clay;
      }
      world.tiles[y * w + x] = t;
    }
  }
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) world.rock[y * w + x] = y >= y0 && y <= y1 && x >= x0 && x <= x1 ? stoneKindAt(SEED, x, y) : 0;

  /** Put a tree down, on grass that is clear of the stone. */
  const clearOfStone = (x: number, y: number): boolean => Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) > STONE_HALF + 1;
  const plant = (x: number, y: number, kind: TileType, d: number): void => {
    if (!world.inBounds(x, y) || !clearOfStone(x, y)) return;
    const t = world.tiles[y * w + x];
    if (t !== TileType.Grass && t !== TileType.Moss && t !== TileType.Clay) return;
    world.corners(x, y, c);
    if (Math.min(...c) < 3) return;
    world.tiles[y * w + x] = kind;
    world.data[y * w + x] = d;
  };
  // By where it stands from the stone, in the cove's own `a` (toward the sea) and `b` (across): placed, not rolled,
  // so the stone is never behind a crown and the woods frame it from behind and the sides.
  const at = (a: number, b: number): [number, number] => {
    const dx = (a + b) / Math.SQRT2;
    const dy = (a - b) / Math.SQRT2;
    return [Math.round(ox + dx - 0.5), Math.round(oy + dy - 0.5)];
  };
  const tree = (a: number, b: number, name: string, age = MATURE): void => {
    const [x, y] = at(a, b);
    plant(x, y, TileType.Tree, packTreeData(species(name), age));
  };
  const shrub = (a: number, b: number, name: string): void => {
    const [x, y] = at(a, b);
    plant(x, y, TileType.Bush, bush(name));
  };
  // Behind the stone: a mixed wood up the slope, dark conifers straight behind it so the pale stone stands out
  // against them, oak and birch either side with one maple, and the fruit trees at the wood's edge.
  const wood: Array<[number, number, string, number?]> = [
    [-4, -1.5, 'Cedar', OLD], [-4.5, 1.5, 'Pine', OLD], [-3.5, -5, 'Birch'], [-3.5, 4.5, 'Cherry'], [-6, 0, 'Pine'],
    [-5.5, -3.5, 'Oak', OLD], [-5.5, 3.5, 'Birch'], [-6.5, -7, 'Birch', YOUNG], [-6.5, 7, 'Maple'], [-7.5, -1.5, 'Cedar'],
    [-8, 2, 'Oak'], [-8.5, 5.5, 'Birch'], [-8.5, -5, 'Pine'], [-9.5, -9, 'Oak', OLD], [-9.5, 9, 'Cedar'],
    [-10, -0.5, 'Pine', OLD], [-10.5, 3.5, 'Pine'], [-11, -3.5, 'Birch'], [-11.5, 7, 'Pine'], [-12, -7, 'Cedar'],
    [-12.5, 1, 'Cedar', OLD], [-13, 10.5, 'Oak'], [-13.5, -11, 'Pine'], [-14, 4.5, 'Pine'], [-14.5, -2.5, 'Pine'],
    [-4.5, -9, 'Apple'], [-7, -11.5, 'Olive'], [-4.5, 8.5, 'Pear'], [-7, 11, 'Oak', OLD], [-15.5, 8, 'Cedar'],
    [-16, -6, 'Pine', OLD], [-16.5, 1.5, 'Pine'], [-17.5, -9, 'Cedar'], [-18, 5.5, 'Pine'],
  ];
  for (const [a, b, n, age] of wood) tree(a, b, n, age ?? MATURE);
  // The west headland: willows over the water, a stand of birch and a plum.
  const west: Array<[number, number, string, number?]> = [
    [6, -9.5, 'Willow', OLD], [10, -10.5, 'Willow'], [3, -11.5, 'Birch'], [1, -9, 'Plum'], [-1, -13, 'Oak', OLD],
    [-3, -15.5, 'Pine'], [5, -14, 'Birch', YOUNG], [1.5, -15, 'Cedar'], [8, -13, 'Birch'], [12.5, -12, 'Pine'],
  ];
  for (const [a, b, n, age] of west) tree(a, b, n, age ?? MATURE);
  // The east headland: olives and a fig on the warm point, a willow at the water, a peach, pines behind.
  const east: Array<[number, number, string, number?]> = [
    [7, 6.5, 'Willow', OLD], [10.5, 8, 'Olive', OLD], [4, 9, 'Peach'], [13, 9.5, 'Fig'], [1, 8, 'Lemon'],
    [-1, 11.5, 'Pine'], [7, 11.5, 'Cedar', OLD], [-2, 13.5, 'Apricot'], [10, 12.5, 'Olive'], [3.5, 13, 'Oak'],
    [14.5, 12.5, 'Pine'], [6, 3.5, 'Olive', OLD], [8.5, 5, 'Fig'], [3, 6, 'Birch', YOUNG],
  ];
  for (const [a, b, n, age] of east) tree(a, b, n, age ?? MATURE);
  // Roses and lavender along the meadow either side of the stone, and thorn at the wood's foot.
  const shrubs: Array<[number, number, string]> = [
    [-1.5, -4, 'Rose bush'], [-0.5, 4, 'Lavender bush'], [-2.5, 6.5, 'Lavender bush'], [-2.5, -7, 'Rose bush'],
    [1.5, -6.5, 'Lavender bush'], [1, 6, 'Rose bush'], [-3, -2.5, 'Thorn bush'], [-2.5, 2.5, 'Rose bush'],
    [4.5, 6.5, 'Rose bush'], [3.5, -9.5, 'Lavender bush'], [5.5, 10.5, 'Lavender bush'], [-1, 9.5, 'Rose bush'],
  ];
  for (const [a, b, n] of shrubs) shrub(a, b, n);
  // A few young trees scattered on the grass beyond, so the wood thins out rather than stops.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (world.tiles[y * w + x] !== TileType.Grass || r(x, y, 9) > 0.022) continue;
      if (near(x, y, s.x, s.y, 9)) continue;
      const pick = ['Birch', 'Oak', 'Pine', 'Cedar', 'Birch', 'Oak'][Math.floor(r(x, y, 10) * 6)];
      plant(x, y, TileType.Tree, packTreeData(species(pick), r(x, y, 11) < 0.4 ? YOUNG : MATURE));
    }
  }

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
  return { game, stone: { x: s.x + 0.5, y: s.y + 0.5, h: level } };
}
