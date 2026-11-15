/**
 * Volcano Isle's labyrinth of lava, one of ten laid each dawn, and the heat of being up there.
 *
 * The labyrinth. Round the caldera (`LAVA_CENTRE`), out to `LAVA_RADIUS` tiles and on Volcano Isle's own land kept
 * `LAVA_INLAND` chart texels in from the water (`lavaChartAt`), on a world of `LAVA_MIN_SIZE` a side or more, lies a labyrinth of lava walls with three true paths
 * through it to its heart (`LAVA_HEART` round the centre: the caldera, the summit's lair and every seryll seam, which
 * lies there and nowhere else, `rockKindFor`). There are `LAVA_DESIGNS` of them, each fixed for a size of world, and
 * each daily reset (`TREE_DAWN_UTC`) the world's seed and the day pick which one lies (`lavaDesignOf`): never the same
 * two days running. It is worked out, never written into the ground: `lavaAt` here and `lava_at` on the island ask the
 * same rule of the same numbers, and the island keeps each design it has laid (`lava_design`).
 *
 *   * The ground is cut into blocks of `LAVA_CELL` tiles a side. Every other block both ways is a room; between two
 *     rooms is a wall block; where four walls meet, a pillar. A room is the labyrinth's where its middle is on its
 *     land and within its reach, the heart's where `LAVA_HEART` reaches into it or a wall or pillar round it, and
 *     outside otherwise.
 *   * Three rays from the centre, turned by the design (`lavaRays`), part the labyrinth into three wedges. Each
 *     wedge's rooms are joined into trees by Kruskal's rule over walls weighed by `hashTile(wall, design)`; nothing
 *     joins two wedges. In each wedge one room beside the heart is opened into it, the one nearest the wedge's middle
 *     line, and one room on the labyrinth's edge, in the same tree and nearest that line, is opened to the outside.
 *   * A wall is lava where a room of the labyrinth is beside it and neither the tree nor those two openings go
 *     through it; a pillar where one is at its corner. So there are three ways in, one a wedge, each the only way
 *     through its wedge to the heart; every other corridor ends.
 *   * A block holding a lair's piece or a seryll seam, inside a wedge, is opened, joining two rooms of its own tree
 *     (`lavaMustReach`): it loops, and reaches nothing new. And a tile is never lava on water, on a settlement, on a
 *     road or a laid path (`LAVA_SPARED_TILES`), under a building or a foundation, or where anything is set down.
 *
 * Standing on lava costs `LAVA_BURN` of your health a second; nothing can be dug, built, set down or founded on it
 * (`LAVA_GUARDED`, `LAVA_SAID`); no creature steps on it (`creature_tile_ok`).
 *
 * The heat. While you are on Volcano Isle, within the labyrinth's reach, at `LAVA_BAND.foot` or above, a heat meter fills at
 * `HEAT_FILL` a second, `HEAT_NEAR` times that with lava on your tile or one beside it; full, it takes `HEAT_BURN` of
 * your health a second. Below it drains at `HEAT_DRAIN` a second. What you wear and drink slows the filling
 * (`heatMul`): every dragon-scale piece by `HEAT_SCALE`, every piece infused with ice by its share of
 * `INFUSE_INTO.ice.most`, and a cooling draught (`COOLING_DRAUGHT`) halves it for `DRAUGHT_SECS`, taking
 * `DRAUGHT_DROP` of the heat off as it goes down.
 *
 * The island keeps the heat on the player (`stats.heat`) and settles it with the body (`body_settle`); the browser
 * shows what it is told. `supabase/test/lava.ts` holds the two sides together.
 */
import type { ActionDef } from './actions';
import type { Game } from './game';
import type { LightSource } from './light';
import { REGIONS } from '../world/regions';
import { chartRegion } from '../world/chart';
import { hashTile } from '../world/ore';
import { ROAD_TILES, ROCK_VARIANTS, TileType, TREE_DAWN_UTC } from '../world/tiles';
import { LAVA_MIN_SIZE, lavaChartAt, lavaGeometry } from '../world/lavaland';
import { INFUSE_INTO, infusedShare, type Infusable } from './infusion';
import { ARMOUR } from './gear';
import { LAIR_BY_ID } from './lairs';
import { percent, waitWords } from './words';
import { describeFrom } from './items';

export { LAVA_CENTRE, LAVA_HEART, LAVA_INLAND, LAVA_MIN_SIZE, LAVA_RADIUS, LAVA_SIZE, SERYLL_HEART, inLavaHeart, lavaChartAt, lavaGeometry } from '../world/lavaland';

/* ---- The labyrinth --------------------------------------------------------------------------------------------- */

/** Tiles to a side of one block: a room, a wall or a pillar. A corridor is a block wide, a step of the labyrinth two. */
export const LAVA_CELL = 3;
/** Where the heat begins, in tenths of a metre: Volcano Isle's ground from `foot` up. */
export const LAVA_BAND = { foot: 450 } as const;
/** How many designs there are, and how many true paths each has to its heart. */
export const LAVA_DESIGNS = 10;
export const LAVA_PATHS = 3;
/** What each design's walls are weighed by: `hashTile(wall, LAVA_SALT + design)`. */
export const LAVA_SALT = 7919;
/** The island the lava is on, by its place in `REGIONS`: Volcano Isle. */
export const LAVA_ISLE = REGIONS.findIndex((r) => r.key === 'Volcano');
/** The seam a block must be open to: seryll, by its place in `ROCK_VARIANTS`. */
export const LAVA_SEAM = ROCK_VARIANTS.findIndex((r) => r.yields === 'seryll_ore');
/** Health a second while standing on a tile of lava. */
export const LAVA_BURN = 0.04;
/** Laid ground lava never lies on: the roads, a flight of garden steps, stepping stones. */
export const LAVA_SPARED_TILES: readonly TileType[] = [...ROAD_TILES, TileType.Steps, TileType.SteppingStones];
/** Seconds in a day: the labyrinth changes at every dawn (`TREE_DAWN_UTC`). */
const DAY = 86400;

/** The day the labyrinth is laid for at `now` (epoch seconds): whole days since the first dawn of 1970. The island's `lava_day_of`. */
export const lavaDay = (now: number): number => Math.floor((now - TREE_DAWN_UTC * 3600) / DAY);
/** Seconds from `now` until the next one is laid. */
export const lavaChangesIn = (now: number): number => (lavaDay(now) + 1) * DAY + TREE_DAWN_UTC * 3600 - now;
/** What the map says of it: "Lava: changes at dawn, in 3 h". */
export const lavaLine = (now: number): string => {
  const s = lavaChangesIn(now);
  return `Lava: changes at dawn, in ${s >= 3600 ? `${Math.floor(s / 3600)} h` : waitWords(s)}`;
};

/** A world's seed as the hash takes it: nought up to 2³¹. The island's `lava_salt`. */
export const lavaSalt = (seed: number): number => ((seed % 2 ** 31) + 2 ** 31) % 2 ** 31;
/** The day the designs began to be picked each day, never twice running: the dawn of 14 November 2026. */
export const LAVA_FROM_DAY = lavaDay(Date.UTC(2026, 10, 14, TREE_DAWN_UTC) / 1000);
const roll32 = (a: number, b: number, salt: number): number => Math.floor(hashTile(a, b, salt) * 4294967296);
const designMemo = new Map<number, { day: number; d: number }>();
/**
 * The design a world lays on a day: on `LAVA_FROM_DAY` one by its seed, and each day after it the one before moved on
 * by one to nine, by the seed and the day, so it is never the same two days running and every one comes round alike.
 * The island's `lava_design_of`.
 */
export function lavaDesignOf(seed: number, day: number): number {
  const salt = lavaSalt(seed);
  const from = Math.min(day, LAVA_FROM_DAY);
  const had = designMemo.get(seed);
  let at = from, d = roll32(from, 0, salt) % LAVA_DESIGNS;
  if (had && had.day <= day && had.day >= from) {
    at = had.day;
    d = had.d;
  }
  for (let k = at + 1; k <= day; k++) d = (d + 1 + (roll32(k, 1, salt) % (LAVA_DESIGNS - 1))) % LAVA_DESIGNS;
  designMemo.set(seed, { day, d });
  return d;
}

/**
 * Each design's three rays from the centre and the middle line of each wedge, as whole vectors (ten thousand long):
 * design `d` turned `d / LAVA_DESIGNS` of a third of a turn on from the first. The island's `lava_rays`.
 */
export function lavaRays(d: number): { rays: Array<[number, number]>; mids: Array<[number, number]> } {
  const vec = (a: number): [number, number] => [Math.round(10000 * Math.cos(a)), Math.round(10000 * Math.sin(a))];
  const third = (2 * Math.PI) / LAVA_PATHS;
  const turn = ((d + 0.5) / LAVA_DESIGNS) * third - Math.PI / 2;
  return {
    rays: Array.from({ length: LAVA_PATHS }, (_, k) => vec(turn + k * third)),
    mids: Array.from({ length: LAVA_PATHS }, (_, k) => vec(turn + (k + 0.5) * third)),
  };
}

/** The blocks a world's labyrinth is laid over: the first, and how many across and down (odd, a room at each end). The island's `lava_box`. */
export function lavaBoxOf(size: number): { bxa: number; bya: number; nbx: number; nby: number } {
  const g = lavaGeometry(size);
  const even = (v: number): number => v - (((v % 2) + 2) % 2);
  const bxa = even(Math.floor((g.cx - g.radius) / LAVA_CELL) - 2);
  const bya = even(Math.floor((g.cy - g.radius) / LAVA_CELL) - 2);
  const odd = (v: number): number => (v % 2 === 1 ? v : v + 1);
  return {
    bxa,
    bya,
    nbx: odd(Math.floor((g.cx + g.radius) / LAVA_CELL) + 3 - bxa),
    nby: odd(Math.floor((g.cy + g.radius) / LAVA_CELL) + 3 - bya),
  };
}

/** Whether a tile is in the labyrinth's box. The island's `lava_in_box`. */
export function lavaInBox(size: number, x: number, y: number): boolean {
  const b = lavaBoxOf(size);
  return x >= b.bxa * LAVA_CELL && y >= b.bya * LAVA_CELL && x < (b.bxa + b.nbx) * LAVA_CELL && y < (b.bya + b.nby) * LAVA_CELL;
}

/** Tiles past the labyrinth's radius a wall or a pillar of it can reach, and past which no lava lies: two blocks' worth. */
export const LAVA_REACH_PAST = 4 * LAVA_CELL;
/** Whether a tile is within the labyrinth's reach (`LAVA_REACH_PAST` past its radius). The island's `lava_in_reach`. */
export function lavaInReach(size: number, x: number, y: number): boolean {
  const g = lavaGeometry(size);
  const r = g.radius + LAVA_REACH_PAST;
  return (x - g.cx) ** 2 + (y - g.cy) ** 2 <= r * r;
}

/** What a block's byte holds: lava; a wall a lair or a seam may open; a pillar's way out, and which wall it is (E, S, W, N). */
export const LB_LAVA = 1;
export const LB_OPENS = 2;
export const LB_WAY = 16;
/** A room's sort: off the island, the island's land outside the labyrinth, the heart, the labyrinth. */
export const ROOM_OFF = 0;
export const ROOM_LAND = 1;
export const ROOM_HEART = 2;
export const ROOM_IN = 3;

/** One design laid over a world this size: its blocks' bytes, its rooms, and the walls of its ways in and out. */
export interface LavaDesign {
  size: number;
  design: number;
  bxa: number;
  bya: number;
  nbx: number;
  nby: number;
  nrx: number;
  nry: number;
  bytes: Uint8Array;
  /** Each room's sort, and its wedge (-1 for none). */
  room: Int8Array;
  wedge: Int8Array;
  /** Each wedge's way in from the outside and way out into the heart, as wall blocks; and the rooms between, in order. */
  entrances: Array<[number, number]>;
  exits: Array<[number, number]>;
  paths: Array<Array<[number, number]>>;
}

const designs = new Map<string, LavaDesign>();
/** A design laid over a world this size: worked out once and kept. The island's `lava_design_make`, kept in `lava_design`. */
export function lavaDesign(size: number, design: number): LavaDesign {
  const key = `${size}:${design}`;
  const had = designs.get(key);
  if (had) return had;
  const g = lavaGeometry(size);
  const { bxa, bya, nbx, nby } = lavaBoxOf(size);
  const nrx = (nbx + 1) / 2, nry = (nby + 1) / 2;
  const n = nrx * nry;
  const { rays, mids } = lavaRays(design);
  const room = new Int8Array(n);
  const wedge = new Int8Array(n).fill(-1);
  const px = new Int32Array(n), py = new Int32Array(n);
  for (let j = 0; j < nry; j++) {
    for (let i = 0; i < nrx; i++) {
      const r = j * nrx + i;
      const tx = (bxa + 2 * i) * LAVA_CELL + 1, ty = (bya + 2 * j) * LAVA_CELL + 1;
      const dx = tx - g.cx, dy = ty - g.cy;
      px[r] = dx;
      py[r] = dy;
      const d2 = dx * dx + dy * dy;
      const chart = lavaChartAt(tx, ty, size);
      // The heart's rooms: those the heart reaches into, or into a wall or a pillar round them, so none of it is lava.
      const hx = Math.min(Math.max(g.cx, tx - 1 - LAVA_CELL), tx - 2 + 2 * LAVA_CELL) - g.cx;
      const hy = Math.min(Math.max(g.cy, ty - 1 - LAVA_CELL), ty - 2 + 2 * LAVA_CELL) - g.cy;
      room[r] = hx * hx + hy * hy < g.heart * g.heart ? ROOM_HEART : chart === 2 && d2 <= g.radius * g.radius ? ROOM_IN : chart >= 1 ? ROOM_LAND : ROOM_OFF;
      if (room[r] !== ROOM_IN) continue;
      for (let k = 0; k < LAVA_PATHS; k++) {
        const a = rays[k], b = rays[(k + 1) % LAVA_PATHS];
        if (a[0] * dy - a[1] * dx >= 0 && b[0] * dy - b[1] * dx < 0) wedge[r] = k;
      }
    }
  }
  // The island's land that is outside the labyrinth, joined to the box's edge round it rather than shut in by it (a
  // lake's shore): what a way in may open onto.
  const outside = new Uint8Array(n);
  {
    const q: number[] = [];
    for (let r = 0; r < n; r++) {
      const i = r % nrx, j = (r - i) / nrx;
      if ((i === 0 || j === 0 || i === nrx - 1 || j === nry - 1) && room[r] < ROOM_HEART) {
        outside[r] = 1;
        q.push(r);
      }
    }
    while (q.length) {
      const r = q.pop()!;
      const i = r % nrx;
      for (const s of [i + 1 < nrx ? r + 1 : -1, i > 0 ? r - 1 : -1, r + nrx < n ? r + nrx : -1, r - nrx]) {
        if (s < 0 || outside[s] || room[s] >= ROOM_HEART) continue;
        outside[s] = 1;
        q.push(s);
      }
    }
  }
  const same = (a: number, b: number): boolean => room[a] === ROOM_IN && room[b] === ROOM_IN && wedge[a] === wedge[b];
  // The walls within a wedge, lightest first, and Kruskal's trees over them.
  const walls: number[] = [];
  const weight = new Float64Array(2 * n);
  for (let j = 0; j < nry; j++) {
    for (let i = 0; i < nrx; i++) {
      const r = j * nrx + i;
      if (i + 1 < nrx && same(r, r + 1)) {
        walls.push(2 * r);
        weight[2 * r] = roll32(bxa + 2 * i + 1, bya + 2 * j, LAVA_SALT + design);
      }
      if (j + 1 < nry && same(r, r + nrx)) {
        walls.push(2 * r + 1);
        weight[2 * r + 1] = roll32(bxa + 2 * i, bya + 2 * j + 1, LAVA_SALT + design);
      }
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
  const pass = new Uint8Array(n);
  for (const k of walls) {
    const a = k >> 1, b = (k & 1) === 0 ? a + 1 : a + nrx;
    const ra = root(a), rb = root(b);
    if (ra === rb) continue;
    up[ra] = rb;
    pass[a] |= (k & 1) === 0 ? 1 : 2;
  }
  // The ways in and out: in each wedge, the room beside the heart nearest its middle line, and the room beside the land
  // outside, in the same tree, nearest it: nearest by how far off the line, then the innermost and the outermost.
  const beside = (r: number, sort: number): number => {
    const i = r % nrx, j = (r - i) / nrx;
    const near: Array<[number, number]> = [[i + 1, j], [i, j + 1], [i - 1, j], [i, j - 1]];
    for (let s = 0; s < 4; s++) {
      const [a, b] = near[s];
      if (a < 0 || b < 0 || a >= nrx || b >= nry) continue;
      const q = b * nrx + a;
      if (room[q] === sort && (sort !== ROOM_LAND || outside[q])) return s;
    }
    return -1;
  };
  const wallOf = (r: number, s: number): [number, number] => {
    const i = r % nrx, j = (r - i) / nrx;
    const bx = bxa + 2 * i, by = bya + 2 * j;
    return s === 0 ? [bx + 1, by] : s === 1 ? [bx, by + 1] : s === 2 ? [bx - 1, by] : [bx, by - 1];
  };
  const opened = new Set<number>();
  const entrances: Array<[number, number]> = [], exits: Array<[number, number]> = [];
  const ends: Array<[number, number]> = [];
  for (let k = 0; k < LAVA_PATHS; k++) {
    const m = mids[k];
    const off = (r: number): number => Math.abs(m[0] * py[r] - m[1] * px[r]);
    const along = (r: number): number => m[0] * px[r] + m[1] * py[r];
    const d2 = (r: number): number => px[r] * px[r] + py[r] * py[r];
    const outs: number[] = [], ins: number[] = [];
    for (let r = 0; r < n; r++) {
      if (room[r] !== ROOM_IN || wedge[r] !== k || along(r) <= 0) continue;
      if (beside(r, ROOM_HEART) >= 0) outs.push(r);
      if (beside(r, ROOM_LAND) >= 0) ins.push(r);
    }
    outs.sort((a, b) => off(a) - off(b) || d2(a) - d2(b) || a - b);
    ins.sort((a, b) => off(a) - off(b) || d2(b) - d2(a) || a - b);
    const firstIn = new Map<number, number>();
    for (const r of ins) if (!firstIn.has(root(r))) firstIn.set(root(r), r);
    for (const r of outs) {
      const e = firstIn.get(root(r));
      if (e === undefined) continue;
      const ex = wallOf(r, beside(r, ROOM_HEART));
      const en = wallOf(e, beside(e, ROOM_LAND));
      exits.push(ex);
      entrances.push(en);
      opened.add((ex[1] - bya) * nbx + (ex[0] - bxa));
      opened.add((en[1] - bya) * nbx + (en[0] - bxa));
      ends.push([e, r]);
      break;
    }
  }
  // The blocks.
  const bytes = new Uint8Array(nbx * nby);
  const wallByte = (a: number, b: number, bit: number, at: number): number => {
    const ia = room[a] === ROOM_IN, ib = room[b] === ROOM_IN;
    if (!ia && !ib) return 0;
    const s = same(a, b);
    if ((s && (pass[a] & bit) !== 0) || opened.has(at)) return 0;
    return LB_LAVA | (s ? LB_OPENS : 0);
  };
  for (let v = 0; v < nby; v++) {
    for (let u = 0; u < nbx; u++) {
      const at = v * nbx + u;
      const i = u >> 1, j = v >> 1;
      if ((u & 1) === 0 && (v & 1) === 0) continue;
      if ((u & 1) === 1 && (v & 1) === 0) bytes[at] = wallByte(j * nrx + i, j * nrx + i + 1, 1, at);
      else if ((u & 1) === 0) bytes[at] = wallByte(j * nrx + i, (j + 1) * nrx + i, 2, at);
      else {
        const r = j * nrx + i;
        if (room[r] !== ROOM_IN && room[r + 1] !== ROOM_IN && room[r + nrx] !== ROOM_IN && room[r + nrx + 1] !== ROOM_IN) continue;
        // Its way out, should a lair or a seam be in it: the first wall round it, E S W N, that joins one wedge's rooms.
        const ways: Array<[number, number]> = [[r + 1, r + nrx + 1], [r + nrx, r + nrx + 1], [r, r + nrx], [r, r + 1]];
        const way = ways.findIndex(([a, b]) => same(a, b));
        bytes[at] = LB_LAVA | (way >= 0 ? LB_WAY | (way << 2) : 0);
      }
    }
  }
  // Each true path, room by room, for the map's pictures: the tree's way from the room let in to the room let out.
  const paths = ends.map(([from, to]) => roomPath(from, to, pass, nrx, n).map((r): [number, number] => [bxa + 2 * (r % nrx), bya + 2 * Math.floor(r / nrx)]));
  const out: LavaDesign = { size, design, bxa, bya, nbx, nby, nrx, nry, bytes, room, wedge, entrances, exits, paths };
  designs.set(key, out);
  return out;
}

/** The rooms of a tree between two of them, in order, over its open walls. */
function roomPath(from: number, to: number, pass: Uint8Array, nrx: number, n: number): number[] {
  const back = new Int32Array(n).fill(-1);
  back[from] = from;
  const q = [from];
  while (q.length) {
    const r = q.shift()!;
    if (r === to) break;
    const next: number[] = [];
    if (pass[r] & 1) next.push(r + 1);
    if (pass[r] & 2) next.push(r + nrx);
    if (r % nrx > 0 && pass[r - 1] & 1) next.push(r - 1);
    if (r >= nrx && pass[r - nrx] & 2) next.push(r - nrx);
    for (const s of next) {
      if (back[s] >= 0) continue;
      back[s] = r;
      q.push(s);
    }
  }
  const out: number[] = [];
  for (let r = to; back[r] >= 0 && r !== from; r = back[r]) out.push(r);
  out.push(from);
  return out.reverse();
}

/** A block's byte in a design, nought off its box. */
export function lavaByte(D: LavaDesign, bx: number, by: number): number {
  const u = bx - D.bxa, v = by - D.bya;
  return u < 0 || v < 0 || u >= D.nbx || v >= D.nby ? 0 : D.bytes[v * D.nbx + u];
}

/** What the lava asks of the ground: the browser's `Game` (`gameLava`), or a test's world. */
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

/** Whether a tile is in the heat: in the labyrinth's reach, on Volcano Isle at the band's foot or above it. The island's `lava_heat_on`. */
export const inHeat = (L: LavaLand, x: number, y: number): boolean =>
  lavaInReach(L.size, x, y) && chartRegion(x + 0.5, y + 0.5, L.size) === LAVA_ISLE && sum4(L, x, y) >= 4 * LAVA_BAND.foot;

/** Whether a block holds what must be reached: a lair's piece or a seryll seam. The island's `lava_must_reach`. */
export function lavaMustReach(L: LavaLand, bx: number, by: number): boolean {
  const x0 = bx * LAVA_CELL, y0 = by * LAVA_CELL;
  for (let y = y0; y < y0 + LAVA_CELL; y++) {
    for (let x = x0; x < x0 + LAVA_CELL; x++) if (L.rock(x, y) === LAVA_SEAM || L.lair(x, y)) return true;
  }
  return false;
}

/**
 * Whether a whole block is lava in a design, but for what is spared tile by tile: its byte, opened where it holds what
 * must be reached, or is the way out of a pillar that does. The island's `lava_block`.
 */
export function lavaBlockIn(L: LavaLand, D: LavaDesign, bx: number, by: number): boolean {
  if (D.size < LAVA_MIN_SIZE) return false;
  const b = lavaByte(D, bx, by);
  if (!(b & LB_LAVA)) return false;
  if (b & LB_WAY) return !lavaMustReach(L, bx, by);
  if (!(b & LB_OPENS)) return true;
  if (lavaMustReach(L, bx, by)) return false;
  // A pillar beside it whose way out it is: E S W N from the pillar is this wall from the W N E S.
  const odd = ((bx - D.bxa) & 1) === 1;
  const round: Array<[number, number, number]> = odd ? [[bx, by - 1, 1], [bx, by + 1, 3]] : [[bx - 1, by, 0], [bx + 1, by, 2]];
  for (const [qx, qy, way] of round) {
    const q = lavaByte(D, qx, qy);
    if (q & LB_WAY && (q >> 2) % 4 === way && lavaMustReach(L, qx, qy)) return false;
  }
  return true;
}

/** Whether a whole block is lava on a day. */
export const lavaBlock = (L: LavaLand, day: number, bx: number, by: number): boolean =>
  lavaBlockIn(L, lavaDesign(L.size, lavaDesignOf(L.seed, day)), bx, by);

/** Whether a tile is lava on a day: on a world of `LAVA_MIN_SIZE` or more, in a block of it, not on water and not where lava is spared. The island's `lava_at`. */
export function lavaAt(L: LavaLand, day: number, x: number, y: number): boolean {
  if (L.size < LAVA_MIN_SIZE || x < 0 || y < 0 || x >= L.size || y >= L.size || !lavaInReach(L.size, x, y)) return false;
  if (!lavaBlock(L, day, Math.floor(x / LAVA_CELL), Math.floor(y / LAVA_CELL))) return false;
  return !LAVA_SPARED_TILES.includes(L.tile(x, y) as TileType) && !L.spared(x, y) && sum4(L, x, y) >= 0;
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
