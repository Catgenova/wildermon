/**
 * Where water meets land: the wet band on the land side of a shore, and a line
 * of broken foam that runs up the beach and back.
 *
 * Both are bands across the shore, measured in tiles from the waterline. A
 * corner's distance from the water is worked out once, from its height over
 * the surface and how steeply the ground rises there (`ShoreField`), so a
 * cliff and a shelving beach are measured alike: a band a fifth of a tile wide
 * is a fifth of a tile wide on either. Each tile cuts its own piece of a band
 * out of itself between two distances, worked out at its four corners and
 * taken straight along its edges, which is how the water's own edge is found;
 * the pieces meet at the tiles' edges, so the line runs on round the coast
 * with no steps in it.
 *
 * The foam runs up the shore and back with a slow wave, a little later the
 * further along the shore, and is filled from a picture of soft broken
 * flecks laid on the ground, so it is a broken line rather than a stripe.
 */
import type { Camera } from '../engine/camera';
import { hash2 } from '../world/noise';
import { TileType } from '../world/tiles';
import type { World } from '../world/world';
import {
  FOAM, FOAM_ALPHA, FOAM_WIDE, POND_FOAM, POND_SURGE, WET_POND, SHORE_FAR, SHORE_ROCK, SURGE_BACK, SURGE_PERIOD, SURGE_UP, WET_ALPHA, WET_GROUND, WET_ROCK, WET_SAND,
} from './water';

/** How far out the second line of foam is, in tiles from the waterline on sand, and how far behind the first it comes in, as a share of a wave. */
const OUT_AT = 0.5;
const OUT_LAG = 0.4;

/** The foam's colour, unbroken; and the wet ground's tint. */
const FOAM_CSS = `rgb(${FOAM.join(',')})`;
const WET_CSS = `rgb(${WET_GROUND.join(',')})`;
/** What each of the gathered bands (`ShorePainter.flush`) is filled with: the foam's core, its lace, what it leaves, the line out and its core; the wet band, in two; and the core's flecks, which are flecks wherever they are laid. */
const SLOT_STYLE = [FOAM_CSS, 'flecks', 'flecks', 'flecks', FOAM_CSS, WET_CSS, WET_CSS, 'broken'] as const;
/** A tile's corners, in the order they are walked round. */
const SQUARE: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];


/** Tiles a side in one block of `ShoreField`. */
const BLOCK = 32;
const KEEP = 400;
/** The least rise of the ground across a corner reckoned with, in height units a tile: flatter ground than this is measured as this. */
const RISE_LEAST = 1.2;
/** Farther from the waterline than this, in tiles, either way, nothing of the shore is drawn. */
const REACH_LAND = WET_SAND + SURGE_UP + 0.05;
const REACH_SEA = SURGE_BACK + 3 * FOAM_WIDE + 0.75;
/** How much of a sand shore's band a ground has, by its type; anything not named, `SHORE_OTHER`. */
const SANDY: Partial<Record<TileType, number>> = {
  [TileType.Sand]: 1, [TileType.Dirt]: 0.85, [TileType.PackedDirt]: 0.85, [TileType.Clay]: 0.85, [TileType.Marsh]: 0.9, [TileType.Peat]: 0.85,
  [TileType.Kelp]: 0.85, [TileType.Reed]: 0.85, [TileType.Rock]: 0, [TileType.Cobblestone]: 0.3, [TileType.Slabs]: 0.3,
};
const SHORE_OTHER = 0.7;
/** How many steps the wet band darkens in, toward the water. */
const WET_STEPS = 2;
/** How far from the water a dry corner with no wet one beside it is taken to be, at the least, in tiles. */
const FLAT_AWAY = 1.2;
/** The rise of the ground, in height units a tile, from which a shore starts to count as rock whatever is on it, and is rock through. */
const STEEP_FROM = 5;
const STEEP_FULL = 16;

/** The foam's picture, in pixels a side, and how many tiles of ground it covers. */
const FLECKS_PX = 128;
/** How big the flecks are drawn, in their picture's pixels to the screen's at zoom 1. */
const FLECKS_SCALE = 0.66;

interface Block {
  /** Each corner's distance from the waterline in tiles, land positive, and its share of a sand shore's band. */
  v: Float32Array;
  k: Float32Array;
  /** Each tile that has any of the shore on it. */
  on: Uint8Array;
  /** The same tiles as a list, as their place in the block. */
  list: Int32Array;
}

const ease = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The sea's shore, a block of corners at a time: how far each corner is from
 * the waterline, how sandy its shore is, and which tiles have any of the shore
 * on them. Made when first drawn and again when the ground under it changes.
 */
export class ShoreField {
  private blocks = new Map<number, Block>();

  constructor(private readonly world: World) {}

  /** Whether the sea is on a corner. */
  private readonly sea = (cx: number, cy: number): boolean => this.world.getHeight(cx, cy) < 0;

  private lastKey = NaN;
  private last: Block | null = null;

  touched(x: number, y: number): void {
    this.last = null;
    // A corner's distance reads the corners round it, so the change reaches a corner further than the tile's own.
    for (let by = Math.floor((y - 2) / BLOCK); by <= Math.floor((y + 2) / BLOCK); by++) {
      for (let bx = Math.floor((x - 2) / BLOCK); bx <= Math.floor((x + 2) / BLOCK); bx++) this.blocks.delete(by * 65536 + bx);
    }
  }

  clear(): void {
    this.blocks.clear();
    this.last = null;
  }

  /** Each tile with any of the shore on it in a rectangle of tiles, inclusive. */
  each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => void): void {
    for (let by = Math.floor(y0 / BLOCK); by <= Math.floor(y1 / BLOCK); by++) {
      for (let bx = Math.floor(x0 / BLOCK); bx <= Math.floor(x1 / BLOCK); bx++) {
        const list = this.block(bx * BLOCK, by * BLOCK).list;
        for (let q = 0; q < list.length; q++) {
          const x = bx * BLOCK + (list[q] % BLOCK), y = by * BLOCK + Math.floor(list[q] / BLOCK);
          if (x >= x0 && x <= x1 && y >= y0 && y <= y1) fn(x, y);
        }
      }
    }
  }

  private block(x: number, y: number): Block {
    const bx = Math.floor(x / BLOCK), by = Math.floor(y / BLOCK);
    const key = by * 65536 + bx;
    // Asked a tile at a time along a line: mostly the block it was last asked about.
    if (key === this.lastKey && this.last) return this.last;
    let b = this.blocks.get(key);
    if (b) {
      this.lastKey = key;
      this.last = b;
      return b;
    }
    if (this.blocks.size >= KEEP) this.blocks.delete(this.blocks.keys().next().value as number);
    const n = BLOCK + 1;
    const w = this.world;
    const x0 = bx * BLOCK, y0 = by * BLOCK;
    const v = new Float32Array(n * n), k = new Float32Array(n * n), on = new Uint8Array(BLOCK * BLOCK);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const [d, s] = cornerShore(w, x0 + i, y0 + j, 0, this.sea);
        v[j * n + i] = d;
        k[j * n + i] = s;
      }
    }
    for (let j = 0; j < BLOCK; j++) {
      for (let i = 0; i < BLOCK; i++) {
        const a = v[j * n + i], b2 = v[j * n + i + 1], c = v[(j + 1) * n + i + 1], d = v[(j + 1) * n + i];
        const lo = Math.min(a, b2, c, d), hi = Math.max(a, b2, c, d);
        on[j * BLOCK + i] = lo < REACH_LAND && hi > -REACH_SEA ? 1 : 0;
      }
    }
    const list: number[] = [];
    for (let i = 0; i < on.length; i++) if (on[i]) list.push(i);
    b = { v, k, on, list: Int32Array.from(list) };
    this.blocks.set(key, b);
    this.lastKey = key;
    this.last = b;
    return b;
  }

  /** Whether any of the sea's shore is on a tile. */
  on(x: number, y: number): boolean {
    const b = this.block(x, y);
    return b.on[(y - Math.floor(y / BLOCK) * BLOCK) * BLOCK + x - Math.floor(x / BLOCK) * BLOCK] === 1;
  }

  /** A corner's distance from the waterline, and its share of a sand shore's band, into `out`. */
  corner(cx: number, cy: number, out: Float64Array, at: number): void {
    // A corner on a block's far edge is in the next block too; the block the tile is in is asked, which has it.
    const bx = Math.floor(Math.min(cx, cx - 1 + 1e-9) / BLOCK);
    const by = Math.floor(Math.min(cy, cy - 1 + 1e-9) / BLOCK);
    const b = this.block(bx * BLOCK, by * BLOCK);
    const i = (cy - by * BLOCK) * (BLOCK + 1) + cx - bx * BLOCK;
    out[at] = b.v[i];
    out[at + 1] = b.k[i];
  }
}

/**
 * How far a corner is from water standing at `level`, in tiles across the
 * shore, land positive; and how sandy its shore is. `wet` says which corners
 * the water is on.
 *
 * Ground no higher than the water but not under it -- a pond full to the brim
 * of flat ground, a flat at the sea's own level -- is measured by how far it is
 * from a corner that is: nought beside one, the half-diagonal of a tile across one, and more otherwise, so
 * the shore stays at the water and is not drawn over the whole flat.
 */
export function cornerShore(w: World, cx: number, cy: number, level: number, wet: (cx: number, cy: number) => boolean): [number, number] {
  const h = w.getHeight(cx, cy) - level;
  const gx = (w.getHeight(cx + 1, cy) - w.getHeight(cx - 1, cy)) / 2;
  const gy = (w.getHeight(cx, cy + 1) - w.getHeight(cx, cy - 1)) / 2;
  const rise = Math.max(RISE_LEAST, Math.hypot(gx, gy));
  let d = h / rise;
  if (d < FLAT_AWAY && !wet(cx, cy)) {
    // The water's edge comes up to a corner with water beside it, and to the diagonal short of one with water across a tile from it.
    const side = wet(cx - 1, cy) || wet(cx + 1, cy) || wet(cx, cy - 1) || wet(cx, cy + 1);
    const across = !side && (wet(cx - 1, cy - 1) || wet(cx + 1, cy - 1) || wet(cx - 1, cy + 1) || wet(cx + 1, cy + 1));
    d = Math.max(d, side ? 0 : across ? Math.SQRT1_2 : FLAT_AWAY);
  }
  let s = 0;
  for (let k = 0; k < 4; k++) {
    const tx = cx - (k & 1), ty = cy - (k >> 1);
    s += SANDY[w.inBounds(tx, ty) ? w.getTile(tx, ty) : TileType.Sand] ?? SHORE_OTHER;
  }
  return [d, (s / 4) * (1 - ease(STEEP_FROM, STEEP_FULL, rise))];
}

const NONE_WET = (): boolean => false;

/* ---- Cutting a band out of a tile ---------------------------------------- */

/** Per point of a tile's outline: x, y, the height drawn at, distance from the water, the band's low and high edge. */
const ATTRS = 6;
const bufA = new Float64Array(12 * ATTRS);
const bufB = new Float64Array(12 * ATTRS);

/** Keep the part of an outline where `attr hi - dist` (when `high`) or `dist - attr lo` is not below nought. */
function clip(src: Float64Array, n: number, dst: Float64Array, high: boolean): number {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const a = i * ATTRS, b = ((i + 1) % n) * ATTRS;
    const fa = high ? src[a + 5] - src[a + 3] : src[a + 3] - src[a + 4];
    const fb = high ? src[b + 5] - src[b + 3] : src[b + 3] - src[b + 4];
    if (fa >= 0) {
      for (let q = 0; q < ATTRS; q++) dst[m * ATTRS + q] = src[a + q];
      m++;
    }
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      for (let q = 0; q < ATTRS; q++) dst[m * ATTRS + q] = src[a + q] + (src[b + q] - src[a + q]) * t;
      m++;
    }
  }
  return m;
}

/** What a tile of shore is drawn with. */
export interface ShoreScene {
  cam: Camera;
  /** The drawing clock, in seconds. */
  t: number;
  /** Which way the swell runs, for when along the shore the foam comes in. */
  dirX: number;
  dirY: number;
}

/**
 * The soft broken flecks the foam is filled from: a picture that repeats, made
 * for each size it is drawn at (`fleckFill`), its blots squashed as the ground
 * is so they lie on it.
 */
const flecks = new Map<number, HTMLCanvasElement>();
function flecksPicture(scale: number): HTMLCanvasElement {
  let cv = flecks.get(scale);
  if (cv) return cv;
  cv = document.createElement('canvas');
  const P = Math.max(8, Math.round(FLECKS_PX * scale));
  cv.width = cv.height = P;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const [r, gg, b] = FOAM;
  // Blots of foam of every size, wrapped round the edges so the picture repeats with no seam.
  for (let i = 0; i < 150; i++) {
    const x = hash2(i, 3, 71) * P, y = hash2(i, 5, 72) * P;
    const rad = (2.5 + hash2(i, 7, 73) ** 2 * 9) * scale;
    const a = 0.45 + 0.55 * hash2(i, 9, 74);
    for (const ox of [-P, 0, P]) {
      for (const oy of [-P, 0, P]) {
        const cx = x + ox, cy = y + oy;
        if (cx + rad < 0 || cy + rad * 0.5 < 0 || cx - rad > P || cy - rad * 0.5 > P) continue;
        g.save();
        g.translate(cx, cy);
        g.scale(1, 0.5);
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, rad);
        grad.addColorStop(0, `rgba(${r},${gg},${b},${a})`);
        grad.addColorStop(0.55, `rgba(${r},${gg},${b},${a * 0.8})`);
        grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(0, 0, rad, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }
  flecks.set(scale, cv);
  return cv;
}

/**
 * The shore drawn a tile at a time, in with the ground (`Renderer`): the wet
 * band before the tile's water, the foam after it.
 */
export class ShorePainter {
  /** The flecks' pictures as fills, by the size they are drawn at. */
  private readonly patterns = new Map<number, CanvasPattern>();
  private s: ShoreScene | null = null;
  /** How strong the shore is drawn this frame: less from far out. */
  private far = 1;
  private layers = 1;
  /** A tile's four corners: x, y, height, distance, sand share. */
  private readonly cs = new Float64Array(20);
  private readonly tmp = new Float64Array(2);
  private readonly at = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  begin(s: ShoreScene): void {
    this.s = s;
    this.far = SHORE_FAR + (1 - SHORE_FAR) * ease(1, 2, s.cam.zoom);
    // Soft edges only show close up: from far out a band is drawn once.
    this.layers = s.cam.zoom >= 2.5 ? 3 : s.cam.zoom >= 1.5 ? 2 : 1;
  }

  /** The surge at a corner, in tiles up the shore from the waterline: up fast, back slow. */
  private surge(cx: number, cy: number, pond: boolean, lag = 0): number {
    const s = this.s!;
    const along = (cx * s.dirX + cy * s.dirY) / 9.5 + 0.12 * Math.sin(cx * 0.53 + cy * 0.37);
    const period = pond ? SURGE_PERIOD * 1.6 : SURGE_PERIOD;
    let u = (s.t / period - along - lag) % 1;
    if (u < 0) u += 1;
    const up = u < 0.35 ? Math.sin((u / 0.35) * Math.PI * 0.5) : 0.5 + 0.5 * Math.cos(((u - 0.35) / 0.65) * Math.PI);
    return -SURGE_BACK + (SURGE_UP + SURGE_BACK) * up;
  }

  /**
   * The foam's flecks, laid on the water at `level` this frame: what a wake is
   * filled with too. Laid square to the screen at a whole pixel, at the size
   * the zoom gives them, so filling with them is a copy of their picture and
   * never a stretch of it; they go with the ground as the view moves.
   */
  fleckFill(ctx: CanvasRenderingContext2D, level: number): CanvasPattern {
    const t = ctx.getTransform();
    const cam = this.s!.cam;
    // How big, to a quarter, in the pixels it is drawn to.
    const scale = Math.max(0.25, Math.round(cam.zoom * t.a * FLECKS_SCALE * 4) / 4);
    let p = this.patterns.get(scale);
    if (!p) {
      p = ctx.createPattern(flecksPicture(scale), 'repeat') as CanvasPattern;
      this.patterns.set(scale, p);
    }
    // Pinned to a point on the water, drifting slowly along, so it is never quite the same foam twice.
    const dx = (this.s!.t * 0.035) % 2;
    const ax = Math.round(t.a * cam.worldToScreenX(dx, 0) + t.e), ay = Math.round(t.d * cam.worldToScreenY(dx, 0, level) + t.f);
    const at = this.at;
    at.a = 1 / t.a;
    at.b = 0;
    at.c = 0;
    at.d = 1 / t.d;
    at.e = (ax - t.e) / t.a;
    at.f = (ay - t.f) / t.d;
    p.setTransform(at);
    return p;
  }

  /** Read a tile's corners: from the sea's field, or worked out for a pond's level. */
  load(w: World, field: ShoreField | null, x: number, y: number, co: readonly (readonly [number, number])[], c: readonly number[], level: number, wet: (cx: number, cy: number) => boolean = NONE_WET): boolean {
    const cs = this.cs;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 4; i++) {
      const cx = x + co[i][0], cy = y + co[i][1];
      cs[i * 5] = cx;
      cs[i * 5 + 1] = cy;
      cs[i * 5 + 2] = c[i];
      if (field) field.corner(cx, cy, this.tmp, 0);
      else [this.tmp[0], this.tmp[1]] = cornerShore(w, cx, cy, level, wet);
      cs[i * 5 + 3] = this.tmp[0];
      cs[i * 5 + 4] = this.tmp[1];
      if (this.tmp[0] < lo) lo = this.tmp[0];
      if (this.tmp[0] > hi) hi = this.tmp[0];
    }
    this.vlo = lo;
    this.vhi = hi;
    return lo < REACH_LAND && hi > -REACH_SEA;
  }

  /** The nearest and furthest the loaded tile's corners are from the water. */
  private vlo = 0;
  private vhi = 0;

  /**
   * Fill the part of the loaded tile between two distances from the water,
   * each worked out at a corner as `(a + b * surge)`, times the corner's
   * share of a sand shore's band where `shared`.
   */
  private band(ctx: CanvasRenderingContext2D | Path2D, level: number, loA: number, loB: number, hiA: number, hiB: number, shared: boolean, fill = true): boolean {
    const cs = this.cs;
    const cam = this.s!.cam;
    for (let i = 0; i < 4; i++) {
      const sh = !shared || this.still ? 1 : SHORE_ROCK + (1 - SHORE_ROCK) * cs[i * 5 + 4];
      const sg = this.sgUse[i];
      const lo = sh * (loA + loB * sg), hi = sh * (hiA + hiB * sg);
      bufA[i * ATTRS] = cs[i * 5];
      bufA[i * ATTRS + 1] = cs[i * 5 + 1];
      bufA[i * ATTRS + 2] = cs[i * 5 + 2];
      bufA[i * ATTRS + 3] = cs[i * 5 + 3];
      bufA[i * ATTRS + 4] = this.part === 'land' ? Math.max(0, lo) : lo;
      bufA[i * ATTRS + 5] = this.part === 'water' ? Math.min(0, hi) : hi;
    }
    let n = clip(bufA, 4, bufB, false);
    if (n < 3) return false;
    n = clip(bufB, n, bufA, true);
    if (n < 3) return false;
    const solo = ctx instanceof CanvasRenderingContext2D;
    if (solo) ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const o = i * ATTRS;
      const h = Math.max(bufA[o + 2], level);
      const sx = cam.worldToScreenX(bufA[o], bufA[o + 1]);
      const sy = cam.worldToScreenY(bufA[o], bufA[o + 1], h);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    if (solo && fill) ctx.fill();
    return true;
  }

  private readonly surgeAt = new Float64Array(4);
  /** The same for the line further out, which comes in behind. */
  private readonly outAt = new Float64Array(4);
  /** Which of the two the band being cut reads. */
  private sgUse = this.surgeAt;

  /** Which side of the waterline the bands being cut are kept to: both, the land's (drawn with the ground), or the water's (in the sea's picture). */
  private part: 'all' | 'land' | 'water' = 'all';

  /** The wet band on the land side of the loaded tile's shore: darkest at the water, gone by its top, in steps one inside another. */
  wet(ctx: CanvasRenderingContext2D, level: number, pond: boolean): void {
    const cs = this.cs;
    let kk = 0;
    for (let i = 0; i < 4; i++) kk += cs[i * 5 + 4] / 4;
    const top = (WET_ROCK + (WET_SAND - WET_ROCK) * kk) * (pond ? WET_POND : 1);
    if (Math.min(cs[3], cs[8], cs[13], cs[18]) > top || Math.max(cs[3], cs[8], cs[13], cs[18]) < 0) return;
    if (!this.batching) {
      this.wetSmooth(ctx, level, top, WET_ALPHA * (pond ? 0.8 : 1));
      return;
    }
    const was = ctx.globalAlpha;
    ctx.fillStyle = WET_CSS;
    for (let i = 0; i < WET_STEPS; i++) {
      const reach = top * (1 - i / WET_STEPS);
      const alpha = (WET_ALPHA * (pond ? 0.8 : 1)) / WET_STEPS;
      if (this.batching) this.slotBand(5, i, alpha, level, -0.02, 0, reach, 0, false);
      else {
        ctx.globalAlpha = alpha;
        this.band(ctx, level, -0.02, 0, reach, 0, false);
      }
    }
    ctx.globalAlpha = was;
  }

  /**
   * The wet band in one fill shaded from the waterline up, where it is drawn
   * once rather than every frame -- into a block of the ground's picture, or on
   * a pond's bank: a gradient laid across the tile along the flat slope that
   * best fits its corners' distances from the water on the screen.
   */
  private wetSmooth(ctx: CanvasRenderingContext2D, level: number, top: number, alpha: number): void {
    if (!this.band(ctx, level, -0.02, 0, top, 0, false, false)) return;
    const cs = this.cs;
    const cam = this.s!.cam;
    const px = this.px;
    let mx = 0, my = 0, mv = 0;
    for (let i = 0; i < 4; i++) {
      px[i * 2] = cam.worldToScreenX(cs[i * 5], cs[i * 5 + 1]);
      px[i * 2 + 1] = cam.worldToScreenY(cs[i * 5], cs[i * 5 + 1], Math.max(cs[i * 5 + 2], level));
      mx += px[i * 2] / 4;
      my += px[i * 2 + 1] / 4;
      mv += cs[i * 5 + 3] / 4;
    }
    let sxx = 0, sxy = 0, syy = 0, sxv = 0, syv = 0;
    for (let i = 0; i < 4; i++) {
      const dx = px[i * 2] - mx, dy = px[i * 2 + 1] - my, dv = cs[i * 5 + 3] - mv;
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
      sxv += dx * dv;
      syv += dy * dv;
    }
    const det = sxx * syy - sxy * sxy;
    const ga = Math.abs(det) > 1e-9 ? (sxv * syy - syv * sxy) / det : 0;
    const gb = Math.abs(det) > 1e-9 ? (syv * sxx - sxv * sxy) / det : 0;
    const g2 = ga * ga + gb * gb;
    const [r, g, b] = WET_GROUND;
    if (g2 < 1e-12) ctx.fillStyle = `rgba(${r},${g},${b},${(alpha * 0.5).toFixed(3)})`;
    else {
      const k0 = -mv / g2, k1 = (top - mv) / g2;
      const grad = ctx.createLinearGradient(mx + ga * k0, my + gb * k0, mx + ga * k1, my + gb * k1);
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${(alpha * 0.45).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
    }
    ctx.fill();
  }

  private readonly px = new Float64Array(8);

  /** A band into one of the gathered fills: `slot` the band, `layer` the step of it. */
  private slotBand(slot: number, layer: number, alpha: number, level: number, loA: number, loB: number, hiA: number, hiB: number, shared: boolean): void {
    const at = slot * 3 + layer;
    // The wet band's steps run on into the slot after its own.
    this.slotAlpha[at] = alpha;
    if (this.band((this.slots[at] ??= new Path2D()), level, loA, loB, hiA, hiB, shared)) this.pending = true;
  }

  /** A band of the foam drawn soft: `layers` of it one inside another about its middle, so it fades to its edges. */
  private soft(ctx: CanvasRenderingContext2D, level: number, slot: number, alpha: number, loA: number, loB: number, hiA: number, hiB: number): void {
    const n = this.layers;
    for (let i = 0; i < n; i++) {
      const f = (i / n) * 0.42;
      const a0 = loA + (hiA - loA) * f, b0 = loB + (hiB - loB) * f;
      const a1 = hiA - (hiA - loA) * f, b1 = hiB - (hiB - loB) * f;
      if (this.batching) this.slotBand(slot, i, alpha / n, level, a0, b0, a1, b1, true);
      else {
        ctx.globalAlpha = alpha / n;
        this.band(ctx, level, a0, b0, a1, b1, true);
      }
    }
  }

  /** A pond's foam is not drawn wider on sand than on rock: still water leaves a line, whatever the bank. */
  private still = false;

  /**
   * The sea's shore is gathered a line of the ground at a time and laid when
   * the line's tiles are down (`flush`), a fill for each band rather than for
   * each band of each tile: before anything stands up on the line, and before
   * anything drawn on one of its tiles that has to be over it. In the sea's
   * picture (`lace`), the same, a fill a band for all of it.
   */
  batching = false;
  private pending = false;
  private readonly slots: Array<Path2D | undefined> = [];
  private readonly slotAlpha: number[] = [];

  /** Lay what was gathered so far: the foam's lace in its flecks where `broken`, or in its colour. */
  flush(ctx: CanvasRenderingContext2D, broken = false): void {
    if (!this.pending) return;
    this.pending = false;
    const was = ctx.globalAlpha;
    const fl = broken ? this.fleckFill(ctx, 0) : null;
    for (let i = 0; i < this.slots.length; i++) {
      const p = this.slots[i];
      if (!p) continue;
      const style = SLOT_STYLE[Math.floor(i / 3)];
      // The land's side of the lace is a strip too thin to show its flecks: laid in its colour, a little fainter.
      ctx.fillStyle = style === 'broken' ? this.fleckFill(ctx, 0) : style !== 'flecks' ? style : fl ?? FOAM_CSS;
      ctx.globalAlpha = this.slotAlpha[i] * (style === 'flecks' && !fl ? 0.35 : 1);
      ctx.fill(p);
      this.slots[i] = undefined;
    }
    ctx.globalAlpha = was;
  }

  /**
   * The water's side of the sea's foam, over a rectangle of the screen, into
   * the sea's picture (`Renderer.drawSea`), which is laid under everything;
   * the land's side is drawn with the ground, tile by tile.
   */
  lace(g: CanvasRenderingContext2D, field: ShoreField, w: World, sx0: number, sy0: number, sx1: number, sy1: number): void {
    const cam = this.s!.cam;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [sx, sy] of [[sx0, sy0], [sx1, sy0], [sx0, sy1], [sx1, sy1]]) {
      const p = cam.screenToWorld(sx, sy, 0);
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    const c = this.heights;
    const co = SQUARE;
    this.part = 'water';
    this.batching = true;
    // Soft enough at the picture's half size without a second step, but from close up.
    const layers = this.layers;
    this.layers = this.s!.cam.zoom >= 2.5 ? 2 : 1;
    field.each(Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(w.w - 1, Math.ceil(x1)), Math.min(w.h - 1, Math.ceil(y1)), (x, y) => {
      for (let i = 0; i < 4; i++) c[i] = w.getHeight(x + co[i][0], y + co[i][1]);
      if (c[0] >= 0 && c[1] >= 0 && c[2] >= 0 && c[3] >= 0) return;
      if (this.load(w, field, x, y, co, c, 0)) this.foamBands(g, 0, 'picture');
    });
    this.layers = layers;
    this.flush(g, true);
    this.batching = false;
    this.part = 'all';
  }

  private readonly heights = [0, 0, 0, 0];

  /** The foam on the loaded tile of the sea's shore drawn with the ground, gathered for its line (`flush`): the line's core, either side of the waterline. */
  foamLand(ctx: CanvasRenderingContext2D): void {
    // None of the tile is between as far out as the line goes back and as far up as it ever runs.
    if (this.vhi <= -(SURGE_BACK + FOAM_WIDE * 0.32) || this.vlo >= SURGE_UP + FOAM_WIDE * 0.1) return;
    this.batching = true;
    // In one step: its flecks are soft at their edges of themselves.
    const layers = this.layers;
    this.layers = 1;
    this.foamBands(ctx, 0, 'tile');
    this.layers = layers;
    this.batching = false;
  }

  /** The wet band on the loaded tile of the sea's shore, gathered for its line (`flush`). */
  wetLand(ctx: CanvasRenderingContext2D): void {
    this.batching = true;
    this.wet(ctx, 0, false);
    this.batching = false;
  }

  /** The foam on the loaded tile of a pond's bank, laid now. */
  foam(ctx: CanvasRenderingContext2D, level: number): void {
    this.foamBands(ctx, level, 'pond');
  }

  /** The foam's bands: a lace line along the waterline running up the shore and back, the lace it leaves going back, and a second line out in the shallows that comes in behind it. */
  private foamBands(ctx: CanvasRenderingContext2D, level: number, mode: 'pond' | 'picture' | 'tile'): void {
    const pond = mode === 'pond';
    const cs = this.cs;
    for (let i = 0; i < 4; i++) {
      const sg = this.surge(cs[i * 5], cs[i * 5 + 1], pond);
      this.surgeAt[i] = pond ? sg * POND_SURGE : sg;
      this.outAt[i] = this.surge(cs[i * 5], cs[i * 5 + 1], pond, OUT_LAG);
    }
    this.sgUse = this.surgeAt;
    this.still = pond;
    const strength = FOAM_ALPHA * this.far * (pond ? POND_FOAM : 1);
    // How wide the line is, before a corner's share of a sand shore's.
    const W = FOAM_WIDE * (pond ? POND_SURGE * 1.6 : 1);
    const was = ctx.globalAlpha;
    /*
     * The line's core, unbroken: drawn with the ground at the screen's own
     * size, either side of the waterline, so it stays sharp over the sea's
     * picture; more of it from further out, where the flecks are too small to
     * carry the line.
     */
    if (mode !== 'picture') {
      this.part = 'all';
      const core = strength * (0.65 + 0.25 * (1 - ease(1, 2, this.s!.cam.zoom)));
      ctx.fillStyle = FOAM_CSS;
      // Faint and whole under it from further out, broken over it: a line of foam rather than a painted edge.
      if (this.s!.cam.zoom < 1.5) this.soft(ctx, level, 0, core * 0.3, -W * 0.4, 1, W * 0.1, 1);
      if (!this.batching) ctx.fillStyle = this.fleckFill(ctx, level);
      this.soft(ctx, level, 7, core, -W * 0.32, 1, W * 0.1, 1);
    }
    // With the ground, that is all: the lace is in the sea's picture.
    if (mode === 'tile') {
      this.still = false;
      this.part = 'all';
      ctx.globalAlpha = was;
      return;
    }
    if (!this.batching) ctx.fillStyle = this.fleckFill(ctx, level);
    // The lace either side of it, broken: in the sea's picture, on the water's side.
    this.part = mode === 'picture' ? 'water' : 'all';
    this.soft(ctx, level, 1, strength * 0.95, -W, 1, W * 0.15, 1);
    // What follows is all out in the water: in the sea's picture.
    if (mode === 'picture') {
      // What it leaves on the wet sand as it goes back.
      this.soft(ctx, level, 2, strength * 0.3, -W * 2.4, 1, -W * 0.9, 1);
      // The second line further out, coming in behind the first: its own lap, a share of the first's reach.
      this.sgUse = this.outAt;
      this.soft(ctx, level, 3, strength * 0.5, -OUT_AT - W * 0.55, 0.6, -OUT_AT, 0.6);
      this.soft(ctx, level, 4, strength * 0.25, -OUT_AT - W * 0.25, 0.6, -OUT_AT, 0.6);
      this.sgUse = this.surgeAt;
    }
    this.still = false;
    this.part = 'all';
    ctx.globalAlpha = was;
  }
}
