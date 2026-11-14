/**
 * Volcano Isle's lava, laid fresh at every dawn, and the heat of being up there.
 *
 * The lava. Each daily reset (`TREE_DAWN_UTC`) a maze of lava lies across the
 * upper slopes of Volcano Isle: the island's ground from `LAVA_BAND.foot` up to
 * `LAVA_BAND.caldera`, below which nothing is lava and above which (the
 * caldera, round the summit) nothing is either. It is worked out, never
 * written into the ground: `lavaAt` here and `lava_at` on the island ask the
 * same rule of the same numbers, off the world's seed and the day.
 *
 *   * The cone's box (`LAVA_BOX`, thousandths of the map, laid over any world
 *     by scale as the chart is) is cut into blocks of `LAVA_CELL` tiles a side.
 *     Every other block both ways is a room; between two rooms is a wall
 *     block; where four walls meet, a pillar.
 *   * The day's maze is a spanning tree of the rooms: every wall weighed by
 *     `hashTile(wall, day, seed)` and Kruskal's rule taking the lightest
 *     that joins two rooms not yet joined (`lavaPasses`). With every weight
 *     different the tree is the one tree, however it is worked out, so the
 *     island's (cached a day at a time in `lava_day`) is this one.
 *   * A wall block the tree goes through, and every room, is never lava. Any
 *     other wall block, and every pillar, is lava where its middle tile is on
 *     Volcano Isle in the band -- unless it holds something that must be
 *     reached (`lavaMustReach`): ground of the caldera, a lair's piece, or a
 *     seryll seam. Such a block is open, and so is the wall east of such a
 *     pillar, which takes it to the rooms either side.
 *   * And a tile is never lava where a settlement is, on a road or a laid
 *     path (`LAVA_SPARED_TILES`), under a building or a foundation, or where
 *     anything is set down (a lair's own piece among them).
 *
 * So from any room to any other there is a way with no lava on it, the tree's,
 * whatever the heights are: off the band a block is never lava, and on it a
 * room or a wall the tree goes through is not. The foot of the band, the
 * caldera, the summit lair and every seryll seam are joined to it.
 *
 * Standing on lava costs `LAVA_BURN` of your health a second; nothing can be
 * dug, built, set down or founded on it (`LAVA_GUARDED`, `LAVA_SAID`); no
 * creature steps on it (`creature_tile_ok`).
 *
 * The heat. While you are on Volcano Isle at the band's foot or above it, a
 * heat meter fills at `HEAT_FILL` a second, `HEAT_NEAR` times that with lava
 * on your tile or one beside it; full, it takes `HEAT_BURN` of your health a
 * second. Below the foot it drains at `HEAT_DRAIN` a second. What you wear and
 * drink slows the filling (`heatMul`): every dragon-scale piece by
 * `HEAT_SCALE`, every piece infused with ice by its share of
 * `INFUSE_INTO.ice.most`, and a cooling draught (`COOLING_DRAUGHT`) halves it
 * for `DRAUGHT_SECS`, taking `DRAUGHT_DROP` of the heat off as it goes down.
 *
 * The island keeps the heat on the player (`stats.heat`) and settles it with
 * the body (`body_settle`); the browser shows what it is told.
 * `supabase/test/lava.ts` holds the two sides together.
 */
import type { ActionDef } from './actions';
import type { Game } from './game';
import type { LightSource } from './light';
import { REGIONS } from '../world/regions';
import { chartRegion } from '../world/chart';
import { hashTile } from '../world/ore';
import { ROAD_TILES, ROCK_VARIANTS, TileType, TREE_DAWN_UTC } from '../world/tiles';
import { INFUSE_INTO, infusedShare, type Infusable } from './infusion';
import { ARMOUR } from './gear';
import { LAIR_BY_ID } from './lairs';
import { percent, waitWords } from './words';
import { describeFrom } from './items';

/* ---- The maze -------------------------------------------------------------------------------------------------- */

/** Tiles to a side of one block of the maze: a room, a wall or a pillar. */
export const LAVA_CELL = 3;
/**
 * The band the maze lies on, in tenths of a metre: Volcano Isle's ground from `foot` up, to under `caldera`. Ground
 * at `caldera` and above is the caldera, round the summit, and is never lava.
 */
export const LAVA_BAND = { foot: 450, caldera: 550 } as const;
/**
 * The cone's box, in thousandths of the map across and down (west, north, east, south): every block of the maze lies
 * in it, laid over any world by scale as the chart is. Measured off the chart's ground: Volcano Isle's ground at
 * `LAVA_BAND.foot` and over is inside it with room to spare (`supabase/test/lava.ts` asks it of a 4096 island).
 */
export const LAVA_BOX = [440, 40, 575, 170] as const;
/** The island the lava is on, by its place in `REGIONS`: Volcano Isle. */
export const LAVA_ISLE = REGIONS.findIndex((r) => r.key === 'Volcano');
/** The seam a block must be open to: seryll, by its place in `ROCK_VARIANTS`. */
export const LAVA_SEAM = ROCK_VARIANTS.findIndex((r) => r.yields === 'seryll_ore');
/** Health a second while standing on a tile of lava. */
export const LAVA_BURN = 0.04;
/** Laid ground lava never lies on: the roads, a flight of garden steps, stepping stones. */
export const LAVA_SPARED_TILES: readonly TileType[] = [...ROAD_TILES, TileType.Steps, TileType.SteppingStones];
/** Seconds in a day: the maze is laid again at every dawn (`TREE_DAWN_UTC`). */
const DAY = 86400;

/** The day the maze is laid for at `now` (epoch seconds): whole days since the first dawn of 1970. The island's `lava_day_of`. */
export const lavaDay = (now: number): number => Math.floor((now - TREE_DAWN_UTC * 3600) / DAY);
/** Seconds from `now` until the next maze is laid. */
export const lavaChangesIn = (now: number): number => (lavaDay(now) + 1) * DAY + TREE_DAWN_UTC * 3600 - now;
/** What the map says of it: "Lava: changes at dawn, in 3 h". */
export const lavaLine = (now: number): string => {
  const s = lavaChangesIn(now);
  return `Lava: changes at dawn, in ${s >= 3600 ? `${Math.floor(s / 3600)} h` : waitWords(s)}`;
};

/** Where the rooms are: the block of the first, and how many across and down. The island's `lava_grid`. */
export interface LavaGrid {
  bx0: number;
  by0: number;
  cols: number;
  rows: number;
}
export function lavaGrid(size: number): LavaGrid {
  const at = (k: number): number => Math.floor((LAVA_BOX[k] * size) / (1000 * LAVA_CELL));
  const bx0 = at(0), by0 = at(1);
  return { bx0, by0, cols: Math.max(1, Math.floor((at(2) - bx0) / 2) + 1), rows: Math.max(1, Math.floor((at(3) - by0) / 2) + 1) };
}

/** A world's seed as the maze's hash takes it: nought up to 2³¹. The island's `lava_salt`. */
export const lavaSalt = (seed: number): number => ((seed % 2 ** 31) + 2 ** 31) % 2 ** 31;

/** What a room's byte holds: the wall to its east is open, the wall to its south is open. */
export const PASS_EAST = 1;
export const PASS_SOUTH = 2;

const passMemo = new Map<string, Uint8Array>();
/**
 * The day's maze: a byte for every room (`PASS_EAST`, `PASS_SOUTH`), the walls of a spanning tree of the rooms.
 * Wall `k` is room `k >> 1`'s east wall when `k` is even and its south wall when odd, weighed by
 * `hashTile(k, day, lavaSalt(seed))`; lightest first, and the wall number between two of a weight, each is taken
 * where it joins two rooms not yet joined. The island's `lava_passes_make`, kept a day at a time in `lava_day`.
 */
export function lavaPasses(size: number, seed: number, day: number): Uint8Array {
  const key = `${size}:${seed}:${day}`;
  const had = passMemo.get(key);
  if (had) return had;
  const g = lavaGrid(size);
  const n = g.cols * g.rows;
  const salt = lavaSalt(seed);
  const walls: number[] = [];
  const weight = new Float64Array(2 * n);
  for (let k = 0; k < 2 * n; k++) {
    const r = k >> 1;
    if ((k & 1) === 0 ? r % g.cols < g.cols - 1 : Math.floor(r / g.cols) < g.rows - 1) {
      walls.push(k);
      weight[k] = Math.floor(hashTile(k, day, salt) * 4294967296);
    }
  }
  walls.sort((a, b) => weight[a] - weight[b] || a - b);
  const up = new Int32Array(n);
  for (let i = 0; i < n; i++) up[i] = i;
  const root = (i: number): number => {
    while (up[i] !== i) {
      up[i] = up[up[i]];
      i = up[i];
    }
    return i;
  };
  const out = new Uint8Array(n);
  for (const k of walls) {
    const a = k >> 1;
    const b = (k & 1) === 0 ? a + 1 : a + g.cols;
    const ra = root(a), rb = root(b);
    if (ra === rb) continue;
    up[ra] = rb;
    out[a] |= (k & 1) === 0 ? PASS_EAST : PASS_SOUTH;
  }
  if (passMemo.size >= 4) passMemo.delete(passMemo.keys().next().value as string);
  passMemo.set(key, out);
  return out;
}

/** What the maze asks of the ground: the browser's `Game` (`gameLava`), or a test's world. */
export interface LavaLand {
  size: number;
  seed: number;
  /** A corner's height. */
  height(cx: number, cy: number): number;
  /** The rock under a tile, by its place in `ROCK_VARIANTS`. */
  rock(x: number, y: number): number;
  /** A tile's kind. */
  tile(x: number, y: number): number;
  /** A settlement, a building, a foundation or a piece set down on the tile. */
  spared(x: number, y: number): boolean;
  /** A lair's own piece on the tile. */
  lair(x: number, y: number): boolean;
}

/** A tile's middle height, four times over: the sum of its corners. */
const sum4 = (L: LavaLand, x: number, y: number): number => L.height(x, y) + L.height(x + 1, y) + L.height(x + 1, y + 1) + L.height(x, y + 1);
/** Whether a tile is on Volcano Isle, at or over a height in tenths of a metre, off its middle (`centre_height`). */
const upAt = (L: LavaLand, x: number, y: number, h: number): boolean =>
  chartRegion(x + 0.5, y + 0.5, L.size) === LAVA_ISLE && sum4(L, x, y) >= 4 * h;

/** Whether a tile is in the cone's box, where every block of the maze lies. The island's `lava_in_box`. */
export function lavaInBox(size: number, x: number, y: number): boolean {
  const g = lavaGrid(size);
  return x >= g.bx0 * LAVA_CELL && y >= g.by0 * LAVA_CELL && x < (g.bx0 + 2 * g.cols - 1) * LAVA_CELL && y < (g.by0 + 2 * g.rows - 1) * LAVA_CELL;
}

/** Whether a tile is in the heat: in the box, Volcano Isle at the band's foot or above it (the band and the caldera). The island's `lava_heat_on`. */
export const inHeat = (L: LavaLand, x: number, y: number): boolean => lavaInBox(L.size, x, y) && upAt(L, x, y, LAVA_BAND.foot);

/** Whether a block's middle tile is in the band: Volcano Isle, from its foot to under the caldera. */
export const lavaBand = (L: LavaLand, bx: number, by: number): boolean => {
  const x = bx * LAVA_CELL + 1, y = by * LAVA_CELL + 1;
  return upAt(L, x, y, LAVA_BAND.foot) && !upAt(L, x, y, LAVA_BAND.caldera);
};

/** Whether a block holds what must be reached: caldera ground at its middle, a lair's piece, or a seryll seam. The island's `lava_must_reach`. */
export function lavaMustReach(L: LavaLand, bx: number, by: number): boolean {
  const x0 = bx * LAVA_CELL, y0 = by * LAVA_CELL;
  if (upAt(L, x0 + 1, y0 + 1, LAVA_BAND.caldera)) return true;
  for (let y = y0; y < y0 + LAVA_CELL; y++) {
    for (let x = x0; x < x0 + LAVA_CELL; x++) if (L.rock(x, y) === LAVA_SEAM || L.lair(x, y)) return true;
  }
  return false;
}

/** What a block of the maze is: outside the box, a room, a room's east wall, its south wall, or a pillar. */
export type LavaPart = 'out' | 'room' | 'east' | 'south' | 'pillar';
export function lavaPart(size: number, bx: number, by: number): { part: LavaPart; room: number } {
  const g = lavaGrid(size);
  const i = bx - g.bx0, j = by - g.by0;
  if (i < 0 || j < 0 || i > 2 * (g.cols - 1) || j > 2 * (g.rows - 1)) return { part: 'out', room: -1 };
  const room = (j >> 1) * g.cols + (i >> 1);
  const part: LavaPart = (i & 1) === 0 ? ((j & 1) === 0 ? 'room' : 'south') : (j & 1) === 0 ? 'east' : 'pillar';
  return { part, room };
}

/** Whether a whole block is lava today, but for what is spared tile by tile (`lavaAt`). The island's `lava_block`. */
export function lavaBlock(L: LavaLand, day: number, bx: number, by: number): boolean {
  const { part, room } = lavaPart(L.size, bx, by);
  if (part === 'out' || part === 'room') return false;
  if (!lavaBand(L, bx, by) || lavaMustReach(L, bx, by)) return false;
  if (part === 'pillar') return true;
  const pass = lavaPasses(L.size, L.seed, day)[room];
  if (part === 'east') return (pass & PASS_EAST) === 0;
  if ((pass & PASS_SOUTH) !== 0) return false;
  // The wall east of a pillar that must be reached is its way out.
  const g = lavaGrid(L.size);
  return !(bx > g.bx0 && lavaMustReach(L, bx - 1, by));
}

/** Whether a tile is lava today: in a block of it, and not on ground lava spares. The island's `lava_at`. */
export function lavaAt(L: LavaLand, day: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= L.size || y >= L.size) return false;
  if (!lavaBlock(L, day, Math.floor(x / LAVA_CELL), Math.floor(y / LAVA_CELL))) return false;
  return !LAVA_SPARED_TILES.includes(L.tile(x, y) as TileType) && !L.spared(x, y);
}

/** Whether lava is on a tile or one of the eight round it: where the heat fills `HEAT_NEAR` times as fast. */
export function lavaBeside(L: LavaLand, day: number, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lavaAt(L, day, x + dx, y + dy)) return true;
  return false;
}

/* ---- What it refuses ------------------------------------------------------------------------------------------- */

/** What both sides say of a job aimed at lava. The island's `lava_said`. */
export const LAVA_SAID = 'Lava: no digging, building, setting down or founding.';
/**
 * The jobs lava refuses: every one a Runestone's ground refuses that digs, builds, sets something down or founds
 * (`STONE_GUARDED`), less those that only take what grows or lies there. The island's `lava_guarded`.
 */
export const LAVA_GUARDED: ReadonlySet<string> = new Set([
  'dig', 'dig_tile', 'dredge', 'flatten', 'drop_dirt', 'drop_dirt_here', 'change_tile', 'rubble_fill', 'raise_rock', 'mine', 'chip_corner',
  'pack', 'cultivate', 'pave_cobble', 'pave_slabs', 'remove_paving', 'dig_spring', 'stop_spring', 'dig_pool', 'fill_pool',
  'lay_steps', 'lay_timber_steps', 'take_up_steps', 'plant_moss', 'plant_grass', 'lay_stones', 'lift_stones', 'dig_worms', 'unearth',
  'plant', 'dig_stump', 'till', 'plant_seed', 'sow_patch',
  'plan_building', 'add_to_building', 'plan_wall', 'plan_fence', 'plan_floor', 'build_wall', 'build_floor',
  'dig_cellar', 'mine_cellar', 'fill_cellar', 'plan_column', 'build_column',
  'plan_bridge', 'build_bridge', 'plan_aqueduct', 'build_aqueduct', 'plan_foundation', 'pour_foundation', 'strike_foundation',
  'build_campfire', 'place_smelter', 'place_kiln', 'place_furniture', 'place_anvil', 'place_post', 'place_crate',
  'set_trap', 'found_settlement',
]);

/* ---- The heat -------------------------------------------------------------------------------------------------- */

/** The meter's fill a second in the heat, and how many times that with lava on your tile or one beside it. */
export const HEAT_FILL = 1 / 240;
export const HEAT_NEAR = 2;
/** Its drain a second out of the heat. */
export const HEAT_DRAIN = 1 / 60;
/** Health a second while the meter is full and you are in the heat. */
export const HEAT_BURN = 0.01;
/** The fill taken off by each dragon-scale piece worn: ×(1 − this) a piece. */
export const HEAT_SCALE = 0.15;
/** The dragon-scale pieces, by item id. The island's `heat_scale_pieces`. */
export const HEAT_SCALE_PIECES: readonly string[] = ARMOUR.filter((a) => a.cls === 'scale').map((a) => a.id);
/** The fill taken off by a piece worn infused with ice, at a share of one: ×(1 − this × share) a piece. */
export const HEAT_ICE = INFUSE_INTO.ice?.most ?? 0;
/** The cooling draught: its item, the fill while it lasts (×), how long, in real seconds, and the heat it takes off at once. */
export const COOLING_DRAUGHT = 'cooling_draught';
export const DRAUGHT_FILL = 0.5;
export const DRAUGHT_SECS = 600;
export const DRAUGHT_DROP = 0.5;
/** Seconds between two of the same warning (lava, a full meter). */
export const HEAT_WARN = 8;

/** The fill's multiplier for what you wear and drank: dragon-scale pieces, ice infusions' shares, a draught. The island's `heat_mul`. */
export const heatMul = (scalePieces: number, iceShares: readonly number[], draught: boolean): number =>
  (1 - HEAT_SCALE) ** scalePieces * iceShares.reduce((m, s) => m * (1 - HEAT_ICE * s), 1) * (draught ? DRAUGHT_FILL : 1);

/** What a stretch of seconds does: where you were, and the fill's multiplier. */
export interface HeatAt {
  /** In the heat (`inHeat`). */
  up: boolean;
  /** Lava on your tile or beside it (`lavaBeside`). */
  near: boolean;
  /** Lava on your tile. */
  on: boolean;
  mul: number;
}

/**
 * The meter and your health after `secs` seconds: filling in the heat (the burn only for the part of the stretch the
 * meter was full), draining out of it, and lava's own burn on top. The island's `heat_settle`.
 */
export function heatStep(heat: number, health: number, secs: number, at: HeatAt): { heat: number; health: number; full: boolean } {
  const s = Math.max(0, secs);
  const lava = at.on ? s * LAVA_BURN : 0;
  if (!at.up) return { heat: Math.max(0, heat - s * HEAT_DRAIN), health: Math.max(0, health - lava), full: false };
  const rate = HEAT_FILL * (at.near ? HEAT_NEAR : 1) * at.mul;
  const toFull = rate > 0 ? Math.max(0, (1 - heat) / rate) : Infinity;
  const burnt = Math.max(0, s - toFull) * HEAT_BURN;
  return { heat: Math.min(1, heat + rate * s), health: Math.max(0, health - burnt - lava), full: s > toFull };
}

/** How many dragon-scale pieces, and the shares of the ice infusions, among what is worn. */
export function heatGear(worn: ReadonlyArray<(Infusable & { id: string }) | undefined | null>, nowSecs: number): { scale: number; ice: number[] } {
  let scale = 0;
  const ice: number[] = [];
  for (const it of worn) {
    if (!it) continue;
    if (HEAT_SCALE_PIECES.includes(it.id)) scale++;
    const s = infusedShare(it, 'ice', nowSecs);
    if (s > 0) ice.push(s);
  }
  return { scale, ice };
}

/** The meter's words, as the hud's title and the help have them. */
export const HEAT_SAID = {
  label: 'Heat',
  rule: `Heat: Volcano Isle at ${LAVA_BAND.foot / 10} m and up; fill +${percent(HEAT_FILL)}/s, ×${HEAT_NEAR} beside lava; full: health −${percent(HEAT_BURN)}/s; below: drain ${percent(HEAT_DRAIN)}/s.`,
  cool: `Fill ×${1 - HEAT_SCALE} per dragon-scale piece; ×(1 − ${HEAT_ICE} × strength) per ice-infused piece; cooling draught ×${DRAUGHT_FILL}, ${DRAUGHT_SECS / 60} min.`,
  full: `Heat full: health −${percent(HEAT_BURN)}/s.`,
  lava: `Lava: health −${percent(LAVA_BURN)}/s.`,
} as const;

describeFrom(COOLING_DRAUGHT, { drop: DRAUGHT_DROP, fill: DRAUGHT_FILL, mins: DRAUGHT_SECS / 60 });

/** What drinking a cooling draught says. The island says the same. */
export const draughtSaid = `Drank: cooling draught. Heat −${percent(DRAUGHT_DROP)}; heat fill ×${DRAUGHT_FILL} for ${DRAUGHT_SECS / 60} min.`;

/* ---- The browser's ground -------------------------------------------------------------------------------------- */

/** The ground as the browser holds it, for `lavaAt`: the world, and what is settled, built or set down on it. */
export function gameLava(g: Game): LavaLand {
  return {
    get size() {
      return g.world.w;
    },
    get seed() {
      return g.world.seed;
    },
    height: (cx, cy) => g.world.getHeight(cx, cy),
    rock: (x, y) => g.world.rockKind(x, y),
    tile: (x, y) => g.world.getTile(x, y),
    spared: (x, y) => !!(g.deedAt(x, y) || g.deedOfMineAt(x, y) || g.buildings.buildingAt(x, y) || g.foundationAt(x, y) || g.anythingPlaced(x, y)),
    lair: (x, y) => {
      for (const f of g.placed.furniture.at(x, y)) if (LAIR_BY_ID.has(f.kind)) return true;
      return false;
    },
  };
}

/** How far round you the lava's light is thrown from, in tiles; how far it carries, how hard, and in what colour. */
export const LAVA_LIGHT_NEAR = 24;
export const LAVA_REACH = 4.5;
export const LAVA_GLOW = 0.55;
export const LAVA_CAST = '255, 118, 38';

/**
 * The lava's light after dark: one from the middle of every two blocks by two with lava in them, within
 * `LAVA_LIGHT_NEAR` tiles of (`px`, `py`). Drawn only, never asked about by any rule.
 */
export function lavaLights(g: Game, px: number, py: number): LightSource[] {
  const box = g.lavaBox();
  const near = LAVA_LIGHT_NEAR;
  if (px < box[0] - near || py < box[1] - near || px > box[2] + near || py > box[3] + near) return [];
  const step = 2 * LAVA_CELL;
  const out: LightSource[] = [];
  for (let gy = Math.floor((py - near) / step); gy <= Math.floor((py + near) / step); gy++) {
    for (let gx = Math.floor((px - near) / step); gx <= Math.floor((px + near) / step); gx++) {
      if (!g.lavaBlockAt(gx * 2, gy * 2) && !g.lavaBlockAt(gx * 2 + 1, gy * 2) && !g.lavaBlockAt(gx * 2, gy * 2 + 1) && !g.lavaBlockAt(gx * 2 + 1, gy * 2 + 1)) continue;
      out.push({ x: gx * step + LAVA_CELL, y: gy * step + LAVA_CELL, radius: LAVA_REACH, strength: LAVA_GLOW, steady: true, cast: LAVA_CAST, castAlpha: 0.2 });
    }
  }
  return out;
}

/** Why a job will not be done on lava, or null: the island's `lava_ground_refusal`, asked of the tiles a stone's ground is (`stoneJobTiles`). */
export function lavaGroundRefusal(g: Game, tiles: ReadonlyArray<readonly [number, number]>): string | null {
  for (const [x, y] of tiles) if (g.lavaAt(x, y)) return LAVA_SAID;
  return null;
}

/* ---- The draught ----------------------------------------------------------------------------------------------- */

/** What a draught will not be drunk for. The island's `item_refusal` says the same. */
export const DRAUGHT_GONE = 'It is gone.';
export const DRAUGHT_NOT = 'That is not a cooling draught.';

export const LAVA_ACTIONS: ActionDef[] = [
  {
    id: 'drink_draught',
    label: 'Drink it',
    verb: 'drinking',
    stamina: 0,
    baseTime: 2,
    applies: (t, g) => t.kind === 'item' && g.inventory.get(t.uid)?.id === COOLING_DRAUGHT,
    check: (t, g) => {
      const it = t.kind === 'item' ? g.inventory.get(t.uid) : undefined;
      return !it ? DRAUGHT_GONE : it.id !== COOLING_DRAUGHT ? DRAUGHT_NOT : null;
    },
    perform: (t, g) => {
      const it = t.kind === 'item' ? g.inventory.get(t.uid) : undefined;
      if (!it || !g.inventory.remove(it.uid, 1)) return;
      g.logMsg(draughtSaid, 'event');
    },
  },
];
