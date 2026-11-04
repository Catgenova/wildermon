/**
 * A sheet of water going over an edge, at any width: the one painter every
 * fall is drawn with -- a stream stepping down a ledge, a pond going over the
 * level stretch of its rim, a pool going over the edge of its slab.
 *
 * A fall is a lip, a stretch of edge the water goes over from a single corner
 * to many tiles long; the height it goes over at; the way it falls and how
 * far out from the lip its foot is; and the height it lands at along its
 * width, on water or on the ground. It is drawn as a sheet hung from the lip
 * on a curve that leaves the lip going straight out and meets the foot coming
 * straight down.
 *
 * What varies across a sheet -- its ropes of thicker water and the thinner
 * veil between them, where its streaks run, where it breaks up, the lumps of
 * foam at its foot -- is set by where in the world each part of it is, never
 * by the piece of it being drawn. So a wide sheet drawn in pieces, each after
 * its own line of the ground, or a tile of it at a time inside each tile of a
 * pool, is one sheet with no join in it. What moves goes down it at the pace
 * of water falling that far, which is the same pace in the world at every
 * zoom.
 *
 * A lip can also run round in a ring -- the rim of a fountain's basin --
 * with the water going over it outward all the way round: the same sheet,
 * with `u` running round the rim instead of along an axis and no ends to
 * draw back from (`Sheet.ring`). Everything below asks where the lip is and
 * which way is out through `lipAt`, which is the only place the two differ.
 *
 * Strokes are counted by the tile of width and drawn as thick as the zoom
 * says, so a curtain eight tiles wide is eight tiles of the same water rather
 * than one fall stretched, and it costs what there is of it on the screen.
 * Zoomed out below `DETAIL_FROM` a fall is its shapes and colours.
 *
 * Spring water is coloured from the one set in `./water` that everything
 * drawing it shares.
 */
import { hash2 } from '../world/noise';
import { HALF_H, HALF_W } from './iso';
import { RUNE_WHITE, STONE_INK } from './runestone';
import { SPRING_EDGE, SPRING_FOAM, SPRING_PALE, SPRING_WATER } from './water';

/** Below this zoom water is its shapes and colours: streaks, threads, rings, spray and ripples are too small to see. */
export const DETAIL_FROM = 0.6;

/** How the ground is projected this frame, and the clock the water moves by. */
export interface FallView {
  /** The screen point of the world's origin at height nought, and the screen step for one tile along x and along y. */
  ox: number;
  oy: number;
  xx: number;
  xy: number;
  yx: number;
  yy: number;
  /** Screen pixels for a unit of height. */
  hs: number;
  zoom: number;
  /** The drawing clock, in seconds. */
  t: number;
  width: number;
  height: number;
}

/** The projection out of anything that turns the world into screen points the way the camera does. */
export function fallView(
  cam: { zoom: number; worldToScreenX(x: number, y: number): number; worldToScreenY(x: number, y: number, h: number): number },
  t: number, width: number, height: number, hs: number,
): FallView {
  const ox = cam.worldToScreenX(0, 0);
  const oy = cam.worldToScreenY(0, 0, 0);
  return {
    ox, oy,
    xx: cam.worldToScreenX(1, 0) - ox, xy: cam.worldToScreenX(0, 1) - ox,
    yx: cam.worldToScreenY(1, 0, 0) - oy, yy: cam.worldToScreenY(0, 1, 0) - oy,
    hs, zoom: cam.zoom, t, width, height,
  };
}

/** A falling sheet, as the world has it. */
export interface Sheet {
  /** The axis the lip runs along, 0 for x and 1 for y, and the corner line across that axis it stands on. */
  axis: 0 | 1;
  line: number;
  /** Where along the axis the lip starts and ends, in corners: the same corner for a lip of one. */
  from: number;
  to: number;
  /** How far the water is carried past each end of the lip, in tiles. */
  half: number;
  /** The way it falls across the axis, and how far out from the lip its foot is, in tiles. */
  way: 1 | -1;
  reach: number;
  /** How far the curl carries it out from the lip before it drops, as a share of the whole curl: less for water hugging a wall. */
  curl: number;
  /** The height it goes over at. */
  top: number;
  /** The height it lands at under each corner along the lip from corner `landFrom` on, straight between, and whether that is water. */
  landFrom: number;
  land: Float64Array;
  wet: boolean;
  /** How much of the way down the first water has got, 0 to 1. */
  grow: number;
  /** Half the width of the water coming to the lip, in tiles, where that is narrower than the sheet: a stream's. */
  feed?: number;
  /**
   * A lip that runs round in a ring rather than along an axis: its middle,
   * in tiles, and its radius. `u` then runs round it from the world's east
   * toward its south, a tile of `u` a tile of rim, from `from` nought to
   * `to` the whole way round; it has no ends, `half` is nought, and it falls
   * outward, `way` being 1. `axis` and `line` then only key what varies
   * along it, so give each ring a `line` of its own.
   */
  ring?: { x: number; y: number; r: number };
  /** How far back from the lip the smooth water drawn into it begins, in tiles, where that is not `TONGUE`: a basin's rim, a hand's width in from its edge. */
  back?: number;
  /**
   * How much water goes over, as a share of what a stream or a pond sends
   * over a lip, where it is less: a fountain's rim. The foam, rings and spray
   * where it lands are that much smaller; one if left out.
   */
  flow?: number;
}

/** A fall as it lies on the screen this frame, worked out once and read by every piece of it. */
export interface Placed {
  sheet: Sheet;
  /** The lip at `from` on the screen at its height; the screen step for a tile along the lip; and the step from the lip out to the foot. */
  x0: number;
  y0: number;
  ex: number;
  ey: number;
  dx: number;
  dy: number;
  /** Screen pixels for a unit of height. */
  hs: number;
  /** The most it drops anywhere along it, in height units. */
  drop: number;
  /** How far out it curls, how tall it is against `FALL_TALL`, and how white it has gone by the foot. */
  out: number;
  tall: number;
  white: number;
  /** Seconds the water takes from the lip to the foot. */
  fallTime: number;
  /** How thinly the water is spread over the width, 0 for a narrow fall to 1 for a broad curtain. */
  thin: number;
  /** How much of the way down the first water has got. */
  grow: number;
  /** Slices down the sheet, and how far out and how far down each is, in shares of the reach and the drop. */
  n: number;
  al: Float64Array;
  dn: Float64Array;
  /** For a ring (`Sheet.ring`), with `x0` and `y0` its middle: its radius and reach in tiles, and the screen step for a tile along x and along y. */
  ring?: { r: number; reach: number; xx: number; xy: number; yx: number; yy: number };
}

/** A fall this tall, in height units, is white by its foot and throws up the most spray and mist there is. */
const FALL_TALL = 60;
/** How far the curl carries water out from the lip, as a share of the way to the foot, and how far down it has gone by then. */
const CURL_OUT = 0.55;
const CURL_DOWN = 0.3;
/** How fast water falls, in metres a second a second: slower than the world's, as everything on the island moves a little slower than the world. */
const FALL_G = 5.5;
/** Height units in a metre. */
const UNITS_A_METRE = 10;
/** How far apart the ropes of thicker water across a sheet are, in tiles, how wide one is at most either side of its middle, and how far one wanders either way as it falls. */
const ROPE_EVERY = 0.34;
const ROPE_HALF = 0.115;
const ROPE_WANDER = 0.016;
/** How far back from the lip the smooth water drawn into it begins, in tiles. */
const TONGUE = 0.16;
/** How long the lengths the light along a lip is broken into are, in tiles. */
const LIP_EVERY = 0.37;
/** How far apart the glints along a lip are, at most one to each, in tiles. */
const GLINT_EVERY = 0.85;
/** How far down a sheet it stays glassy, before the streaks begin, as a share of its fall. */
const GLASSY = 0.1;
/** How far apart the tears in a thin veil may be, in tiles, and how wide one opens at most either side of its middle. */
const TEAR_EVERY = 0.16;
const TEAR_WIDE = 0.022;
/**
 * How far past its own stretch each piece's water is laid, at least, in
 * tiles and in pixels on the screen, so two pieces meet with no hairline
 * between them: over the line a slab draws round its face where the next
 * slab's face begins, too, which the piece drawn after it would otherwise
 * leave half showing.
 */
const HAIR = 0.006;
const HAIR_PX = 1.6;
/** How far apart the lumps of foam along a foot are, in tiles, and the rings on the water in front of it. */
const LUMP_EVERY = 0.085;
const RING_EVERY = 0.45;
/** How far apart the spray drops thrown up from a foot are, in tiles, and the puffs of mist off it. */
const SPRAY_EVERY = 0.07;
const MIST_EVERY = 0.55;
/** Seconds a ring on the water in front of a foot takes to open out and go, and a puff of mist. */
const RING_LIFE = 1.9;
const MIST_LIFE = 3.4;
/** How far a circle a tile in radius on the ground reaches on screen at zoom one, to either side and up and down. */
const DISC_W = HALF_W * Math.SQRT2;
const DISC_H = HALF_H * Math.SQRT2;

/** How many streaks run down a tile of width at a zoom: fewer as it goes out, and each then drawn thicker for its size. */
function lanesAt(zoom: number): number {
  return zoom >= 1.6 ? 7 : zoom >= 1.15 ? 6 : zoom >= 0.85 ? 5 : 4;
}

/** The height a sheet's water lands at, at a point along its lip. */
function landAt(s: Sheet, u: number): number {
  const k = u - s.landFrom;
  const last = s.land.length - 1;
  if (k <= 0 || last <= 0) return s.land[0];
  if (k >= last) return s.land[last];
  const i = Math.floor(k);
  return s.land[i] + (s.land[i + 1] - s.land[i]) * (k - i);
}

/** How far out along the fall and how far down a point `f` of the way down the curve is, as shares of the reach and of the drop, into `CV`. */
function curveAt(f: number, out: number): void {
  const u = 1 - f;
  CV[0] = 3 * u * u * f * out + 3 * u * f * f + f * f * f;
  CV[1] = 3 * u * f * f * CURL_DOWN + f * f * f;
}

/** A sheet on the screen this frame. */
export function place(v: FallView, s: Sheet): Placed {
  if (s.ring) return placeRing(v, s, s.ring);
  const along = s.axis === 0 ? [1, 0] : [0, 1];
  const fall = s.axis === 0 ? [0, s.way] : [s.way, 0];
  const wx = s.axis === 0 ? s.from : s.line;
  const wy = s.axis === 0 ? s.line : s.from;
  const x0 = v.ox + v.xx * wx + v.xy * wy;
  const y0 = v.oy + v.yx * wx + v.yy * wy - s.top * v.hs;
  const ex = v.xx * along[0] + v.xy * along[1];
  const ey = v.yx * along[0] + v.yy * along[1];
  const dx = (v.xx * fall[0] + v.xy * fall[1]) * s.reach;
  const dy = (v.yx * fall[0] + v.yy * fall[1]) * s.reach;
  let drop = 0;
  for (let i = 0; i < s.land.length; i++) drop = Math.max(drop, s.top - s.land[i]);
  const tall = Math.min(1, drop / FALL_TALL);
  // Going over an edge away from you the water is seen to drop from it rather than to leap out: thrown out as far, the
  // sheet would rise up the screen as it went and stand over the edge in a hoop.
  const len = Math.hypot(dx, dy) || 1;
  const out = CURL_OUT * s.curl * (1 - 0.72 * Math.max(0, -dy / len));
  // Enough slices that the curve reads as one, and no more.
  const n = Math.max(4, Math.min(14, Math.round((len + drop * v.hs) / 14)));
  const al = new Float64Array(n + 1);
  const dn = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    curveAt((i / n) * s.grow, out);
    al[i] = CV[0];
    dn[i] = CV[1];
  }
  const width = s.to - s.from + 2 * s.half;
  return {
    sheet: s, x0, y0, ex, ey, dx, dy, hs: v.hs, drop, out, tall,
    white: 0.25 + 0.7 * Math.min(1, drop / (FALL_TALL * 0.9)),
    fallTime: Math.sqrt((2 * Math.max(drop, 4)) / UNITS_A_METRE / FALL_G),
    thin: Math.max(0, Math.min(1, (width - 1.2) / 6)),
    grow: s.grow, n, al, dn,
  };
}

/**
 * A ring on the screen this frame. Its curl is the same all the way round, as
 * much as a straight sheet going over an edge seen side on: the curve is
 * worked out once for the sheet, and a ring is seen going away from you on
 * one side and toward you on the other.
 */
function placeRing(v: FallView, s: Sheet, g: { x: number; y: number; r: number }): Placed {
  const x0 = v.ox + v.xx * g.x + v.xy * g.y;
  const y0 = v.oy + v.yx * g.x + v.yy * g.y - s.top * v.hs;
  let drop = 0;
  for (let i = 0; i < s.land.length; i++) drop = Math.max(drop, s.top - s.land[i]);
  const tall = Math.min(1, drop / FALL_TALL);
  const out = CURL_OUT * s.curl * (1 - 0.72 / Math.PI);
  const len = Math.hypot(v.xx, v.yx) * s.reach;
  const n = Math.max(4, Math.min(14, Math.round((len + drop * v.hs) / 14)));
  const al = new Float64Array(n + 1);
  const dn = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    curveAt((i / n) * s.grow, out);
    al[i] = CV[0];
    dn[i] = CV[1];
  }
  return {
    sheet: s, x0, y0, ex: v.xx, ey: v.yx, dx: v.xy * s.reach, dy: v.yy * s.reach, hs: v.hs, drop, out, tall,
    white: 0.25 + 0.7 * Math.min(1, drop / (FALL_TALL * 0.9)),
    fallTime: Math.sqrt((2 * Math.max(drop, 4)) / UNITS_A_METRE / FALL_G),
    // A ring carrying little water is spread thin however short its rim is.
    thin: Math.max(0, Math.min(1, Math.max((s.to - s.from - 1.2) / 6, 1 - (s.flow ?? 1)))),
    grow: s.grow, n, al, dn,
    ring: { r: g.r, reach: s.reach, xx: v.xx, xy: v.xy, yx: v.yx, yy: v.yy },
  };
}

/**
 * Where the lip is at `u` on the screen, at the height it goes over at, and
 * the step on the screen from there out to the foot, into `LIP`: along a
 * straight lip the same step the whole way, round a ring out from its middle.
 */
function lipAt(p: Placed, u: number): void {
  const g = p.ring;
  if (!g) {
    const du = u - p.sheet.from;
    LIP[0] = p.x0 + p.ex * du;
    LIP[1] = p.y0 + p.ey * du;
    LIP[2] = p.dx;
    LIP[3] = p.dy;
    return;
  }
  const a = u / g.r;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const ox = g.xx * c + g.xy * s;
  const oy = g.yx * c + g.yy * s;
  LIP[0] = p.x0 + ox * g.r;
  LIP[1] = p.y0 + oy * g.r;
  LIP[2] = ox * g.reach;
  LIP[3] = oy * g.reach;
}

/** The screen step along the lip at `u` for a tile of it, into `LIP[4]` and `LIP[5]`. */
function alongAt(p: Placed, u: number): void {
  const g = p.ring;
  if (!g) {
    LIP[4] = p.ex;
    LIP[5] = p.ey;
    return;
  }
  const a = u / g.r;
  const c = Math.cos(a);
  const s = Math.sin(a);
  LIP[4] = g.xy * c - g.xx * s;
  LIP[5] = g.yy * c - g.yx * s;
}

/** Where a point of a sheet is on the screen: `u` along the lip's axis, `f` of the way down it, and `off` of a tile out in front of it. */
function at(p: Placed, u: number, f: number, off: number, o: Float64Array, k: number): void {
  const s = p.sheet;
  curveAt(f * s.grow, p.out);
  const a = CV[0] + off / s.reach;
  lipAt(p, u);
  o[k] = LIP[0] + LIP[2] * a;
  o[k + 1] = LIP[1] + LIP[3] * a + p.hs * (s.top - landAt(s, u)) * CV[1];
}

/** The same at slice `i` of the sheet's own slices, without working the curve out again. */
function atSlice(p: Placed, u: number, i: number, o: Float64Array, k: number): void {
  const s = p.sheet;
  lipAt(p, u);
  o[k] = LIP[0] + LIP[2] * p.al[i];
  o[k + 1] = LIP[1] + LIP[3] * p.al[i] + p.hs * (s.top - landAt(s, u)) * p.dn[i];
}

/** How far past its own stretch a piece of a sheet lays its water, in tiles: `HAIR`, or `HAIR_PX` on the screen where that is more. */
const hairOf = (p: Placed): number => Math.max(HAIR, HAIR_PX / (Math.hypot(p.ex, p.ey) || 1));

/** Whether a stretch of a sheet, lip to foot and a margin round it, comes anywhere near the screen. */
function seen(v: FallView, p: Placed, u0: number, u1: number, margin: number): boolean {
  let lx = Infinity;
  let hx = -Infinity;
  let ly = Infinity;
  let hy = -Infinity;
  // A stretch of a ring is bounded by the whole of the ring: the four points of it furthest each way, lip and foot.
  const q = p.ring ? (p.ring.r * Math.PI) / 2 : 0;
  for (let c = 0; c < (p.ring ? 8 : 4); c++) {
    if (p.ring) atSlice(p, (c & 3) * q, c & 4 ? p.n : 0, PT, 0);
    else atSlice(p, c & 1 ? u1 : u0, c & 2 ? p.n : 0, PT, 0);
    lx = Math.min(lx, PT[0]);
    hx = Math.max(hx, PT[0]);
    ly = Math.min(ly, PT[1]);
    hy = Math.max(hy, PT[1]);
  }
  const m = margin + p.drop * v.hs * 0.3;
  return hx > -m && lx < v.width + m && hy > -m && ly < v.height + m;
}

/* ---- Across the width ------------------------------------------------------- */

/** A number for a place along a sheet's lip that is the same whichever piece of it asks: its line, its axis and a lattice step along it. */
const keyed = (s: Sheet, k: number, salt: number): number => hash2(s.line * 2 + s.axis, k, salt);

/**
 * The ropes of thicker water across a sheet between two points of its lip,
 * as middle, half width in tiles and a number of its own, three to a rope,
 * onto the end of a list: one on most steps of a lattice fixed to the world,
 * set well off the step and each its own width. A narrow fall is mostly rope;
 * a broad one has more veil between them.
 */
function ropes(p: Placed, u0: number, u1: number, out: number[]): void {
  const s = p.sheet;
  const share = 0.88 - 0.18 * p.thin;
  const reach = ROPE_HALF + ROPE_WANDER;
  for (let k = Math.floor((u0 - reach) / ROPE_EVERY) - 1; k * ROPE_EVERY <= u1 + reach; k++) {
    if (keyed(s, k, 11) > share) continue;
    const mid = (k + 0.5 + (keyed(s, k, 12) - 0.5) * 0.5) * ROPE_EVERY;
    const half = ROPE_HALF * (0.55 + 0.45 * keyed(s, k, 13)) * (1 - 0.08 * p.thin);
    if (mid + half + ROPE_WANDER < u0 || mid - half - ROPE_WANDER > u1) continue;
    out.push(mid, half, keyed(s, k, 14));
  }
}

/** Where the middle of rope `r` of a list is `f` of the way down, wandering a little either way as it falls. */
function ropeAt(list: number[], r: number, f: number): number {
  return list[r] + ROPE_WANDER * f * Math.sin((f * 1.6 + list[r + 2]) * Math.PI * 2) * (1 + list[r + 2] * 0.6);
}
/** How wide rope `r` of a list is either side of its middle `f` of the way down, narrowing as it falls. */
const ropeHalf = (list: number[], r: number, f: number): number => list[r + 1] * (1 - 0.3 * f);

/** How far in from each end of a sheet its water has drawn back at a point `f` of the way down, and ragged with it, in tiles. */
function fray(p: Placed, end: number, f: number, t: number): number {
  const s = p.sheet;
  const k = Math.floor(f * 9);
  const w = f * 9 - k;
  const a = keyed(s, end * 101 + k, 31);
  const b = keyed(s, end * 101 + k + 1, 31);
  const wob = a + (b - a) * w * w * (3 - 2 * w);
  return s.half * (0.05 + 0.2 * f + 0.22 * f * wob) + Math.sin(t * 2.3 + f * 7 + end * 2.1) * 0.01 * f;
}

/* ---- The sheet -------------------------------------------------------------- */

/**
 * The colours down a sheet in one set of `inks` -- its veil, its ropes, the
 * lit side of its ropes or the crease down their shaded side -- as a
 * gradient that runs square to its lip on the screen, from the lip to as far
 * below it as the foot is, so every piece of one sheet has the same colour at
 * the same depth under its lip wherever the piece begins. A gradient along
 * the line from one point of the lip to the foot below it would change along
 * the lip as well, and each piece would start it afresh. Made only for what a
 * piece draws.
 */
function downSheet(ctx: CanvasRenderingContext2D, p: Placed, inks: string[][], u = p.sheet.from): CanvasGradient {
  // Round a ring the lip turns as it goes, so the square to it is taken where the piece is.
  alongAt(p, u);
  const el = Math.hypot(LIP[4], LIP[5]) || 1;
  let nx = -LIP[5] / el;
  let ny = LIP[4] / el;
  atSlice(p, u, 0, PT, 0);
  atSlice(p, u, p.n, PT, 2);
  let depth = (PT[2] - PT[0]) * nx + (PT[3] - PT[1]) * ny;
  if (depth < 0) {
    nx = -nx;
    ny = -ny;
    depth = -depth;
  }
  depth = Math.max(4, depth);
  const tone = Math.round(p.white * 10);
  const x1 = PT[0] + nx * depth;
  const y1 = PT[1] + ny * depth;
  const g = ctx.createLinearGradient(PT[0], PT[1], x1, y1);
  for (let k = 0; k < STOPS.length; k++) g.addColorStop(STOPS[k], inks[tone][k]);
  return g;
}

/**
 * The stretch of a sheet from `u0` to `u1` along its lip: the veil of thin
 * water across it, bluer where it is thinnest, torn here and there near the
 * foot where the water is spread thin and at its ends, the wet rock showing
 * through; the ropes of thicker water down it, paler, and palest down the
 * thick of each; glassy for the first of its fall, then streaked in lengths
 * running down at the water's pace, near white on the ropes and fainter white
 * or darker teal on the veil; threads breaking away as it falls, and off a
 * tall fall flecks of white; and at each end the water drawing back and
 * fraying, and the wet rock beside it darkened.
 */
export function drawSheet(ctx: CanvasRenderingContext2D, v: FallView, p: Placed, u0: number, u1: number): void {
  const s = p.sheet;
  const lo = s.from - s.half;
  const hi = s.to + s.half;
  const a = Math.max(lo, u0);
  const b = Math.min(hi, u1);
  if (b <= a || !seen(v, p, a, b, 30 * v.zoom)) return;
  const z = v.zoom;
  const t = v.t;
  const n = p.n;
  // A ring has no ends: every piece of it meets another at both.
  const first = !p.ring && a <= lo + 1e-6;
  const last = !p.ring && b >= hi - 1e-6;
  // The water drawn a hair past each end of the stretch where another piece meets it.
  const hair = hairOf(p);
  const aw = first ? a : a - hair;
  const bw = last ? b : b + hair;
  const left = (f: number): number => (first ? lo + fray(p, 0, f, t) : aw);
  const right = (f: number): number => (last ? hi - fray(p, 1, f, t) : bw);
  // Both edges at each slice, worked out once for everything drawn down them.
  const SL = SLICE_L;
  const SR = SLICE_R;
  for (let i = 0; i <= n; i++) {
    SL[i] = left(i / n);
    SR[i] = right(i / n);
  }

  // The wet rock beside each end: darkened a little way out from the water, further lower down where the spray wets it, and pushed back against the face.
  if (first || last) {
    ctx.fillStyle = WET_ROCK;
    ctx.beginPath();
    for (let end = 0; end < 2; end++) {
      if ((end === 0 && !first) || (end === 1 && !last)) continue;
      const side = end === 0 ? -1 : 1;
      const E = end === 0 ? SL : SR;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        at(p, E[i] + side * (0.015 + 0.07 * f), f, -0.05, PT, 0);
        if (i === 0) ctx.moveTo(PT[0], PT[1]);
        else ctx.lineTo(PT[0], PT[1]);
      }
      for (let i = n; i >= 0; i--) {
        const f = i / n;
        at(p, E[i] - side * 0.03, f, -0.05, PT, 0);
        ctx.lineTo(PT[0], PT[1]);
      }
      ctx.closePath();
    }
    ctx.fill();
  }

  const gu = p.ring ? (a + b) / 2 : s.from;
  // Which way along the lip is screen-left here, where a rope is lit from: round a ring, where the piece is.
  alongAt(p, (a + b) / 2);
  const lit = LIP[4] >= 0 ? -1 : 1;
  const list = ROPES;
  list.length = 0;
  ropes(p, aw - ROPE_HALF, bw + ROPE_HALF, list);

  // The veil, and the tears in it where the wet rock behind shows through.
  ctx.fillStyle = downSheet(ctx, p, VEIL, gu);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    atSlice(p, SL[i], i, PT, 0);
    if (i === 0) ctx.moveTo(PT[0], PT[1]);
    else ctx.lineTo(PT[0], PT[1]);
  }
  for (let i = n; i >= 0; i--) {
    atSlice(p, SR[i], i, PT, 0);
    ctx.lineTo(PT[0], PT[1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = TEAR;
  ctx.beginPath();
  if (tears(ctx, p, a, b, lo, hi, list, t)) ctx.fill();

  /*
   * The ropes, each a rounded column of thicker water: paler the whole way
   * down, palest down its lit side, and creased down its shaded side, where
   * it turns away into the veil -- the kit's two faces and the crease
   * between them. Each drawn by every piece it crosses, solid, cut to the
   * piece, so the pieces lay the same colour over each other's edges.
   */
  // Each rope's middle and half width at each slice, worked out once.
  const ropeCount = Math.min(list.length / 3, (ROPE_MID.length / (n + 1)) | 0);
  for (let r = 0; r < ropeCount; r++) {
    for (let i = 0; i <= n; i++) {
      ROPE_MID[r * (n + 1) + i] = ropeAt(list, r * 3, i / n);
      ROPE_W[r * (n + 1) + i] = ropeHalf(list, r * 3, i / n);
    }
  }
  if (ropeCount) {
    for (const [ink, share] of [[ROPE, 1], [CORE, 0.5]] as const) {
      ctx.fillStyle = downSheet(ctx, p, ink, gu);
      ctx.beginPath();
      for (let r = 0; r < ropeCount; r++) {
        if (share < 1 && list[r * 3 + 1] < ROPE_HALF * 0.35) continue;
        for (let i = 0; i <= n; i++) {
          const half = ROPE_W[r * (n + 1) + i];
          const mid = ROPE_MID[r * (n + 1) + i] + (share < 1 ? lit * half * 0.4 : 0);
          const u = Math.max(mid - half * share, aw, SL[i]);
          const w = Math.min(mid + half * share, bw, SR[i]);
          ROPE_EDGE[i] = w > u ? w : u;
          atSlice(p, u, i, PT, 0);
          if (i === 0) ctx.moveTo(PT[0], PT[1]);
          else ctx.lineTo(PT[0], PT[1]);
        }
        for (let i = n; i >= 0; i--) {
          atSlice(p, ROPE_EDGE[i], i, PT, 0);
          ctx.lineTo(PT[0], PT[1]);
        }
        ctx.closePath();
      }
      ctx.fill();
    }
    if (z >= DETAIL_FROM) {
      // The crease, in lengths wherever it lies on this piece's water: solid, so a length two pieces both lay is the same length.
      ctx.strokeStyle = downSheet(ctx, p, CREASE, gu);
      ctx.lineWidth = Math.max(0.8, 0.85 * z);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let r = 0; r < ropeCount; r++) {
        if (list[r * 3 + 1] < ROPE_HALF * 0.35) continue;
        let down = false;
        for (let i = 1; i <= n; i++) {
          const u = ROPE_MID[r * (n + 1) + i] - lit * ROPE_W[r * (n + 1) + i] * 0.92;
          if (u < aw || u > bw || u < SL[i] + 0.01 || u > SR[i] - 0.01) {
            down = false;
            continue;
          }
          atSlice(p, u, i, PT, 0);
          if (!down) ctx.moveTo(PT[0], PT[1]);
          else ctx.lineTo(PT[0], PT[1]);
          down = true;
        }
      }
      ctx.stroke();
    }
  }
  // The ink down each end of the sheet, where it draws back and frays: the kit's rule round a solid.
  if (first || last) {
    ctx.strokeStyle = SIDE_INK;
    ctx.lineWidth = Math.max(1.2, 1.7 * z);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let end = 0; end < 2; end++) {
      if ((end === 0 && !first) || (end === 1 && !last)) continue;
      for (let i = 0; i <= n; i++) {
        atSlice(p, end === 0 ? SL[i] : SR[i], i, PT, 0);
        if (i === 0) ctx.moveTo(PT[0], PT[1]);
        else ctx.lineTo(PT[0], PT[1]);
      }
    }
    ctx.stroke();
  }
  if (z < DETAIL_FROM) return;

  // Streaks: lengths running down it at the water's pace below the glassy curl, on a lattice of lanes fixed to the world.
  const lanes = lanesAt(z);
  // Fewer streaks than there are lanes, and each the bolder for it.
  const step = 1 / (lanes - 1);
  const pale = STREAK_PALE_LIST;
  const faint = STREAK_FAINT_LIST;
  pale.length = 0;
  faint.length = 0;
  for (let k = Math.floor(a / step) - 1; k * step < b + step; k++) {
    const key = k * 7 + lanes;
    const u = (k + 0.5 + (keyed(s, key, 21) - 0.5) * 0.7) * step;
    if (u < a || u >= b || u < left(0.5) || u > right(0.5)) continue;
    const h = keyed(s, key, 22);
    let onRope = false;
    for (let r = 0; r < list.length && !onRope; r += 3) onRope = Math.abs(u - list[r]) < list[r + 1];
    // On a rope near white; on the veil now and then darker teal, now and then a fainter white, and mostly nothing.
    const into = onRope ? (h < 0.42 ? pale : null) : h < 0.08 ? faint : null;
    if (!into) continue;
    // Each lane a train of lengths, its own length, gap and pace, so no two keep step; a length is a metre or three of water, whatever the drop.
    const metres = Math.max(1, p.drop / UNITS_A_METRE);
    const long = Math.min(0.24, (0.6 + 1.4 * keyed(s, key, 23)) / metres);
    const every = long + Math.min(0.4, (0.6 + 2.6 * keyed(s, key, 24)) / metres);
    const pace = (0.9 + 0.22 * h) / p.fallTime;
    const lead = (((t * pace + keyed(s, key, 25) * 5) % every) + every) % every;
    const start = GLASSY + 0.06 * keyed(s, key, 26);
    for (let head = lead; head - long < 1; head += every) {
      const f0 = Math.max(start, head - long);
      const f1 = Math.min(1, head);
      if (f1 <= f0 + 0.01) continue;
      into.push(u, f0, f1, keyed(s, key, 27));
    }
  }
  ctx.lineCap = 'round';
  // Three widths of streak, drawn a width at a time, and each wavering a little as it falls, more down a taller fall.
  const waver = 0.006 + 0.012 * p.tall;
  for (const [items, ink, w] of [[faint, STREAK_FAINT, 1], [pale, STREAK_PALE, 1]] as const) {
    if (!items.length) continue;
    ctx.strokeStyle = ink;
    for (let width = 0; width < 2; width++) {
      ctx.lineWidth = Math.max(1.2, w * z * [1.8, 2.5][width]);
      ctx.beginPath();
      for (let i = 0; i < items.length; i += 4) {
        if (Math.floor(items[i + 3] * 2) !== width) continue;
        const q = Math.max(1, Math.min(5, Math.ceil((items[i + 2] - items[i + 1]) * 10)));
        for (let j = 0; j <= q; j++) {
          const f = items[i + 1] + ((items[i + 2] - items[i + 1]) * j) / q;
          at(p, items[i] + waver * f * Math.sin((f * 2.2 + items[i + 3] * 5) * Math.PI), f, 0, PT, 0);
          if (j === 0) ctx.moveTo(PT[0], PT[1]);
          else ctx.lineTo(PT[0], PT[1]);
        }
      }
      ctx.stroke();
    }
  }

  // Threads: water breaking away in the lower part, falling clear of the sheet in front of it and stretching as it goes.
  const threads = Math.max(2, Math.round(lanes * (0.25 + 0.35 * p.tall)));
  const tstep = 1 / threads;
  ctx.strokeStyle = THREAD;
  ctx.lineWidth = Math.max(0.9, 1.05 * z);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = Math.floor(a / tstep) - 1; k * tstep < b + tstep; k++) {
    const u = (k + 0.5 + (keyed(s, k * 5 + threads, 51) - 0.5) * 0.8) * tstep;
    if (u < a || u >= b || u < left(0.7) || u > right(0.7)) continue;
    const h = keyed(s, k * 5 + threads, 52);
    const period = (0.55 + 0.5 * h) * p.fallTime;
    for (let j = 0; j < 2; j++) {
      const age = (((t / period + h * 3.7 + j * 0.5) % 1) + 1) % 1;
      const from = 0.38 + 0.14 * h;
      const head = from + (1 - from) * age * age * (1.4 - 0.4 * age);
      const tail = Math.max(from, head - (0.05 + 0.22 * age) * (0.6 + 0.4 * p.tall));
      if (head <= from + 0.01) continue;
      strand(ctx, p, u + (h - 0.5) * 0.03 * age, tail, head, 0.015 + 0.035 * age * (0.4 + p.tall));
    }
  }
  ctx.stroke();
  if (p.tall > 0.15) {
    // Off a taller fall the lower part breaks up white: flecks of it going down fast, more the taller it is.
    const every = 1 / Math.round(lanes * 1.2);
    ctx.fillStyle = FLECK;
    ctx.beginPath();
    for (let k = Math.floor(a / every) - 1; k * every < b + every; k++) {
      const h = keyed(s, k, 57);
      if (h > p.tall * 1.1) continue;
      const u = (k + 0.5 + (keyed(s, k, 58) - 0.5) * 0.9) * every;
      if (u < a || u >= b || u < left(0.8) || u > right(0.8)) continue;
      const age = (((t / (p.fallTime * (0.5 + 0.4 * keyed(s, k, 59))) + h * 9) % 1) + 1) % 1;
      const f = 0.55 + 0.45 * age;
      at(p, u, f, 0.03 * age, PT, 0);
      const r = (0.8 + 0.9 * keyed(s, k, 56)) * z * (0.6 + 0.6 * age) * Math.min(1, age / 0.15);
      if (r < 0.3) continue;
      ctx.moveTo(PT[0] + r, PT[1]);
      ctx.ellipse(PT[0], PT[1], r, r * 1.8, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // At each end, the edge of the water drawing back as it falls, broken into lengths, and threads peeling off it.
  if (first || last) {
    ctx.strokeStyle = EDGE_LIGHT;
    ctx.lineWidth = Math.max(0.8, 0.95 * z);
    ctx.beginPath();
    for (let end = 0; end < 2; end++) {
      if ((end === 0 && !first) || (end === 1 && !last)) continue;
      const pace = 0.95 / p.fallTime;
      const every = 0.17 + 0.06 * keyed(s, end + 7, 33);
      const lead = (((t * pace + end * 0.37) % every) + every) % every;
      for (let head = lead; head - 0.12 < 1; head += every) {
        const f0 = Math.max(GLASSY, head - 0.12);
        const f1 = Math.min(0.97, head);
        if (f1 <= f0) continue;
        let firstPt = true;
        for (let q = 0; q <= 3; q++) {
          const f = f0 + ((f1 - f0) * q) / 3;
          const u = end === 0 ? lo + fray(p, 0, f, t) + 0.012 : hi - fray(p, 1, f, t) - 0.012;
          at(p, u, f, 0.004, PT, 0);
          if (firstPt) ctx.moveTo(PT[0], PT[1]);
          else ctx.lineTo(PT[0], PT[1]);
          firstPt = false;
        }
      }
      // A thread or two peeling away from the end as it falls, following it down.
      const period = 0.7 * p.fallTime;
      for (let j = 0; j < 2; j++) {
        const h = keyed(s, end * 13 + j, 34);
        const age = (((t / period + h * 2.9 + j * 0.5) % 1) + 1) % 1;
        const f1 = 0.3 + 0.65 * age;
        const f0 = Math.max(0.3, f1 - 0.12 * Math.min(1, age / 0.25));
        if (f1 <= f0 + 0.005) continue;
        const out = end === 0 ? -1 : 1;
        for (let q = 0; q <= 3; q++) {
          const f = f0 + ((f1 - f0) * q) / 3;
          const edge = end === 0 ? lo + fray(p, 0, f, t) : hi - fray(p, 1, f, t);
          at(p, edge + out * (0.008 + 0.025 * age * (f - f0) / (f1 - f0 || 1)) * (0.5 + h), f, 0.02 + 0.04 * age, PT, 0);
          if (q === 0) ctx.moveTo(PT[0], PT[1]);
          else ctx.lineTo(PT[0], PT[1]);
        }
      }
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1;
}

/**
 * The tears in a sheet's veil between `a` and `b`, as closed shapes onto the
 * path, to be filled with the wet rock behind them: narrow lenses where the
 * water is spread thin, and more of them near its ends, never across a rope,
 * each opening partway down, carried on down with the water as it widens and
 * closing again before the foot, and then another. Each is drawn by the piece
 * it lies wholly in, and one lying across the join of two pieces by neither.
 * Whether there was any.
 */
function tears(ctx: CanvasRenderingContext2D, p: Placed, a: number, b: number, lo: number, hi: number, list: number[], t: number): boolean {
  const s = p.sheet;
  if (p.grow < 1) return false;
  let any = false;
  for (let k = Math.floor(a / TEAR_EVERY) - 1; k * TEAR_EVERY < b + TEAR_EVERY; k++) {
    const u = (k + 0.5 + (keyed(s, k, 91) - 0.5) * 0.6) * TEAR_EVERY;
    const h = keyed(s, k, 92);
    const most = TEAR_WIDE * (0.45 + 0.55 * h);
    if (u - most < a || u + most > b) continue;
    const end = p.ring ? 0 : Math.max(0, 1 - Math.min(u - lo, hi - u) / 0.4);
    if (keyed(s, k, 93) > (p.thin * 0.3 + end * 0.3) * Math.min(1, p.drop / 30)) continue;
    let clear = true;
    for (let r = 0; r < list.length && clear; r += 3) clear = Math.abs(u - list[r]) > list[r + 1] + most + ROPE_WANDER;
    if (!clear || u - most < lo + s.half * 0.6 || u + most > hi - s.half * 0.6) continue;
    const age = (((t / (p.fallTime * (1.2 + 0.9 * keyed(s, k, 94))) + keyed(s, k, 95) * 4) % 1) + 1) % 1;
    const w = most * Math.pow(Math.sin(Math.PI * age), 0.7);
    if (w < 0.002) continue;
    const long = 0.22 + 0.2 * h;
    const mid = 0.4 - 0.08 * end + (0.93 - 0.4 + 0.08 * end - long / 2) * age;
    const top = Math.max(0.3, mid - long / 2);
    const bot = Math.min(0.975, mid + long / 2);
    const q = 6;
    for (let i = 0; i <= q; i++) {
      const f = top + ((bot - top) * i) / q;
      at(p, u - w * Math.sin((Math.PI * i) / q), f, 0, PT, 0);
      if (i === 0) ctx.moveTo(PT[0], PT[1]);
      else ctx.lineTo(PT[0], PT[1]);
    }
    for (let i = q - 1; i > 0; i--) {
      const f = top + ((bot - top) * i) / q;
      at(p, u + w * Math.sin((Math.PI * i) / q), f, 0, PT, 0);
      ctx.lineTo(PT[0], PT[1]);
    }
    ctx.closePath();
    any = true;
  }
  return any;
}

/** A line down a sheet at `u` along its lip from `f0` to `f1` of the way down, `off` of a tile out in front, onto the path. */
function strand(ctx: CanvasRenderingContext2D, p: Placed, u: number, f0: number, f1: number, off: number): void {
  const q = Math.max(1, Math.min(5, Math.ceil((f1 - f0) * 10)));
  for (let i = 0; i <= q; i++) {
    const f = f0 + ((f1 - f0) * i) / q;
    at(p, u, f, off * f, PT, 0);
    if (i === 0) ctx.moveTo(PT[0], PT[1]);
    else ctx.lineTo(PT[0], PT[1]);
  }
}

/* ---- The lip ---------------------------------------------------------------- */

/**
 * Where the water goes over, from `u0` to `u1` along the lip: the water
 * coming to it drawn smooth and glassy, brightening to where it turns over,
 * with lines of it drawn in toward the edge and quickening; the light along
 * the edge where it rounds, heavier where a rope of water comes off it.
 * Narrowing to nothing at the ends of the lip, where the rim comes up out of
 * the water.
 */
export function drawLip(ctx: CanvasRenderingContext2D, v: FallView, p: Placed, u0: number, u1: number): void {
  const s = p.sheet;
  const lo = s.from - s.half;
  const hi = s.to + s.half;
  const a = Math.max(lo, u0);
  const b = Math.min(hi, u1);
  if (b <= a || !seen(v, p, a, b, 20 * v.zoom)) return;
  const z = v.zoom;
  const t = v.t;
  const first = !p.ring && a <= lo + 1e-6;
  const last = !p.ring && b >= hi - 1e-6;
  const hair = hairOf(p);
  const aw = first ? a : a - hair;
  const bw = last ? b : b + hair;
  // How far back the smooth water reaches: all the way along the lip, and less toward its ends; and where a stream
  // feeds it, drawn in from the stream's own width to the sheet's. Round a ring, the same the whole way.
  const tongue = s.back ?? TONGUE;
  const reachBack = (u: number): number =>
    p.ring ? tongue : tongue * Math.min(1, 0.3 + Math.min(u - lo, hi - u) / (s.half * 1.6)) * (s.feed ? 0.55 : 1);
  const mid = (lo + hi) / 2;
  const narrow = s.feed ? Math.min(1, s.feed / ((hi - lo) / 2)) : 1;
  const inward = (u: number): number => mid + (u - mid) * narrow;
  const steps = Math.max(1, Math.ceil((b - a) / 0.25));
  // The water drawn in, on its surface, from clear to bright at the edge: shaded square to the lip, so every piece matches.
  const um = p.ring ? (a + b) / 2 : s.from;
  alongAt(p, um);
  const el = Math.hypot(LIP[4], LIP[5]) || 1;
  let nx = -LIP[5] / el;
  let ny = LIP[4] / el;
  atSlice(p, um, 0, PT, 0);
  at(p, um, 0, -tongue, PT, 2);
  let depth = (PT[0] - PT[2]) * nx + (PT[1] - PT[3]) * ny;
  if (depth < 0) {
    nx = -nx;
    ny = -ny;
    depth = -depth;
  }
  if (depth > 0.5) {
    const g = ctx.createLinearGradient(PT[0] - nx * depth, PT[1] - ny * depth, PT[0], PT[1]);
    // Two flat tones stepped hard, as the kit paints a face, over the water still clear behind them.
    for (let k = 0; k < TONGUE_STOPS.length; k++) g.addColorStop(TONGUE_STOPS[k], TONGUE_INK[k >> 1]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = TONGUE_INK[1];
  ctx.beginPath();
  for (let q = 0; q <= steps; q++) {
    const u = a + ((b - a) * q) / steps;
    at(p, inward(u), 0, -reachBack(u), PT, 0);
    if (q === 0) ctx.moveTo(PT[0], PT[1]);
    else ctx.lineTo(PT[0], PT[1]);
  }
  for (let q = steps; q >= 0; q--) {
    const u = a + ((b - a) * q) / steps;
    at(p, u, 0.04, 0, PT, 0);
    ctx.lineTo(PT[0], PT[1]);
  }
  ctx.closePath();
  ctx.fill();
  if (z >= DETAIL_FROM && s.grow >= 1) {
    // Lines of water drawn in toward the edge and quickening, each keeping to its place along the lip.
    const every = z >= 1.5 ? 0.16 : 0.26;
    ctx.strokeStyle = TONGUE_LINE;
    ctx.lineWidth = Math.max(0.8, 0.9 * z);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = Math.floor(a / every) - 1; k * every < b + every; k++) {
      const u = (k + 0.5 + (keyed(s, k, 95) - 0.5) * 0.6) * every;
      if (u < a || u >= b || u < lo + s.half * 0.7 || u > hi - s.half * 0.7) continue;
      const age = (((t / (1.1 + 0.5 * keyed(s, k, 96)) + keyed(s, k, 97) * 3) % 1) + 1) % 1;
      const back = reachBack(u) * 1.6;
      const f0 = -back * (1 - age) * (1 - age);
      const f1 = Math.min(0, f0 + back * (0.18 + 0.3 * age));
      if (f1 <= f0) continue;
      at(p, u, 0, f0, PT, 0);
      ctx.moveTo(PT[0], PT[1]);
      at(p, u, 0, f1, PT, 0);
      ctx.lineTo(PT[0], PT[1]);
    }
    ctx.stroke();
  }
  /*
   * The light along the edge where it rounds over, in lengths fixed to the
   * world, broken short of each end and here and there along it, over an
   * unbroken crease where the water rolled over meets the face of the sheet:
   * the kit's lit arris and the crease under it, both solid where two pieces
   * both lay them.
   */
  const e0 = Math.max(aw, lo + s.half * 0.45);
  const e1 = Math.min(bw, hi - s.half * 0.45);
  if (e1 > e0) {
    ctx.lineCap = 'round';
    if (z >= DETAIL_FROM && s.grow >= 1) {
      // The crease unbroken, from one end of the light to the other.
      ctx.strokeStyle = LIP_CREASE;
      ctx.lineWidth = Math.max(0.8, 0.8 * z);
      ctx.beginPath();
      const q1 = Math.max(1, Math.ceil((e1 - e0) / 0.1));
      for (let q = 0; q <= q1; q++) {
        at(p, e0 + ((e1 - e0) * q) / q1, 0.075, 0, PT, 0);
        if (q === 0) ctx.moveTo(PT[0], PT[1]);
        else ctx.lineTo(PT[0], PT[1]);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = LIP_LIGHT;
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.beginPath();
    for (let k = Math.floor(e0 / LIP_EVERY) - 1; k * LIP_EVERY < e1; k++) {
      const g0 = Math.max(e0, k * LIP_EVERY + (keyed(s, k, 98) < 0.3 ? 0.04 + 0.05 * keyed(s, k, 99) : 0));
      const g1 = Math.min(e1, (k + 1) * LIP_EVERY - (keyed(s, k + 1, 98) < 0.3 ? 0.03 : 0.004));
      if (g1 <= g0 + 0.01) continue;
      const q1 = Math.max(1, Math.ceil((g1 - g0) / 0.1));
      for (let q = 0; q <= q1; q++) {
        const u = g0 + ((g1 - g0) * q) / q1;
        at(p, u, 0.02, 0, PT, 0);
        if (q === 0) ctx.moveTo(PT[0], PT[1]);
        else ctx.lineTo(PT[0], PT[1]);
      }
    }
    ctx.stroke();
    // Heavier where a rope comes off the lip.
    const list = ROPES;
    list.length = 0;
    ropes(p, a - ROPE_HALF, b + ROPE_HALF, list);
    if (z >= DETAIL_FROM && list.length) {
      ctx.lineWidth = Math.max(1.3, 2.1 * z);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let r = 0; r < list.length; r += 3) {
        if (list[r] < a || list[r] >= b || list[r + 1] < ROPE_HALF * 0.55) continue;
        const r0 = Math.max(lo + s.half * 0.45, list[r] - list[r + 1] * 0.5);
        const r1 = Math.min(hi - s.half * 0.45, list[r] + list[r + 1] * 0.5);
        if (r1 <= r0) continue;
        at(p, r0, 0.035, 0, PT, 0);
        ctx.moveTo(PT[0], PT[1]);
        at(p, r1, 0.035, 0, PT, 0);
        ctx.lineTo(PT[0], PT[1]);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (z >= DETAIL_FROM && s.grow >= 1) glints(ctx, p, a, b, lo, hi, z, t);
  }
  ctx.lineWidth = 1;
}

/**
 * The glints along a lip, the kit's sparing accent: a four-pointed star of
 * the runes' white now and then where the light catches the water turning
 * over, each on a place of its own along the lip, keeping a beat of its own,
 * and laid by the piece it is in.
 */
function glints(ctx: CanvasRenderingContext2D, p: Placed, a: number, b: number, lo: number, hi: number, z: number, t: number): void {
  const s = p.sheet;
  ctx.fillStyle = GLINT;
  for (let k = Math.floor(a / GLINT_EVERY) - 1; k * GLINT_EVERY < b; k++) {
    const h = keyed(s, k, 111);
    const u = (k + 0.5 + (h - 0.5) * 0.6) * GLINT_EVERY;
    if (u < a || u >= b || u < lo + s.half * 0.6 || u > hi - s.half * 0.6) continue;
    const beat = Math.sin(t * (1.3 + 0.9 * keyed(s, k, 112)) + h * 40);
    if (beat < 0.55) continue;
    const k2 = (beat - 0.55) / 0.45;
    const r = (2.2 + 1.6 * keyed(s, k, 113)) * z * (0.5 + 0.5 * k2);
    at(p, u, 0.025, 0, PT, 0);
    const x = PT[0];
    const y = PT[1] - r * 0.15;
    const w = r * 0.3;
    ctx.globalAlpha = 0.35 + 0.65 * k2;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + w * 0.3, y - w * 0.3, x + w, y);
    ctx.quadraticCurveTo(x + w * 0.3, y + w * 0.3, x, y + r);
    ctx.quadraticCurveTo(x - w * 0.3, y + w * 0.3, x - w, y);
    ctx.quadraticCurveTo(x - w * 0.3, y - w * 0.3, x, y - r);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---- The foot --------------------------------------------------------------- */

/**
 * Where a stretch of a sheet lands. On water: a line of churning foam the
 * whole way along the foot, heaped where the ropes come down, over a pale
 * band of broken water spreading out in front of it, and rings going out
 * from it that run together into a line of foam. On the ground: a plume of
 * lumps of foam along the foot, taller off a taller fall. Spray thrown up out
 * of it both ways along its whole length.
 */
export function drawFoot(ctx: CanvasRenderingContext2D, v: FallView, p: Placed, u0: number, u1: number, foamTex: CanvasImageSource | null): void {
  const s = p.sheet;
  if (s.grow < 1) return;
  const lo = s.from - s.half;
  const hi = s.to + s.half;
  const a = Math.max(lo, u0);
  const b = Math.min(hi, u1);
  if (b <= a || !seen(v, p, a, b, 60 * v.zoom)) return;
  const z = v.zoom;
  const t = v.t;
  const tall = p.tall;
  const detail = z >= DETAIL_FROM;
  const flow = s.flow ?? 1;
  // Where the foot is: the foot line on the screen at `u`, `out` of a tile out beyond it, `up` height units over the landing.
  const foot = (u: number, out: number, up: number, k: number): void => {
    lipAt(p, u);
    FT[k] = LIP[0] + LIP[2] * (1 + out / s.reach);
    FT[k + 1] = LIP[1] + LIP[3] * (1 + out / s.reach) + p.hs * (s.top - landAt(s, u) - up);
  };
  // The fall's way out along the ground, as an angle round an ellipse on the screen, for the rings: round a ring, where each ring is.
  const wayAt = (u: number): number => {
    lipAt(p, u);
    return Math.atan2(LIP[3] / s.reach / (DISC_H * z), LIP[2] / s.reach / (DISC_W * z));
  };
  const way = wayAt(s.from);
  // How narrow the fall is, 1 for a thread to 0 for a sheet most of a tile wide: a narrow fall's foam spreads wide and lies low.
  const slim = p.ring ? 0 : Math.max(0, 1 - (hi - lo) / 0.9);
  // How far the foam spreads past each end of the foot, wider than a narrow fall's water: a ring has no ends.
  const spread = p.ring ? 0 : (0.05 + 0.1 * tall) * flow * (1 + 1.4 * slim);
  // Thinner toward the ends of the foot, where less water comes down; a ring has none.
  const inset = (u: number): number => (p.ring ? 1 : Math.min(1, (Math.min(u - lo, hi - u) + 0.03 + spread) / (s.half * 0.9 + spread)));
  // A narrow fall's foam heaps less high.
  const narrow = 1 - 0.85 * slim;
  // What lies past an end belongs to the piece at that end.
  const first = !p.ring && a <= lo + 1e-6;
  const last = !p.ring && b >= hi - 1e-6;

  if (s.wet && detail) {
    // The band of broken water spread in front of the foot, lying on the water.
    if (foamTex) {
      ctx.globalAlpha = 0.5;
      const every = 0.4;
      const r = (0.22 + 0.18 * tall) * flow;
      for (let k = Math.floor(a / every) - 1; k * every < b + every; k++) {
        const c = (k + 0.5 + (keyed(s, k, 61) - 0.5) * 0.5) * every;
        if (c < a || c >= b) continue;
        const u = Math.max(lo + s.half * 0.5, Math.min(hi - s.half * 0.5, c));
        foot(u, r * 0.55, 0, 0);
        const rr = r * (0.85 + 0.35 * keyed(s, k, 66)) * inset(u);
        ctx.drawImage(foamTex, FT[0] - rr * DISC_W * z * 1.25, FT[1] - rr * DISC_H * z, rr * DISC_W * z * 2.5, rr * DISC_H * z * 2);
      }
      ctx.globalAlpha = 1;
    }
    // Rings going out from the foot, each a half ring on the side away from the fall, running together into a line.
    ctx.lineWidth = Math.max(0.8, 1.15 * z);
    const ringEvery = RING_EVERY * (z >= 1.25 ? 1 : 1.5);
    for (let k = Math.floor(a / ringEvery) - 1; k * ringEvery < b + ringEvery; k++) {
      const h = keyed(s, k, 62);
      const u = (k + 0.5 + (h - 0.5) * 0.5) * ringEvery;
      if (u < a || u >= b) continue;
      const age = (((t / (RING_LIFE * (0.85 + 0.3 * h)) + h * 5.1) % 1) + 1) % 1;
      const r = (0.12 + 0.55 * age) * (0.8 + 0.4 * tall) * (0.4 + 0.6 * inset(u)) * flow;
      foot(Math.max(lo + 0.05, Math.min(hi - 0.05, u)), 0.06, 0, 0);
      ctx.strokeStyle = RINGS[Math.min(RINGS.length - 1, Math.floor((1 - age) * (1 - age) * RINGS.length))];
      const w = p.ring ? wayAt(u) : way;
      ctx.beginPath();
      ctx.ellipse(FT[0], FT[1], r * DISC_W * z * 1.35, r * DISC_H * z, 0, w - 1.5, w + 1.5);
      ctx.stroke();
    }
  }

  if (detail) {
    // Spray: drops thrown up out of the foam both ways along the foot, arcing up and falling back; more and higher off a taller fall. Laid under the
    // foam, so a drop shows only where it has risen clear of it.
    ctx.fillStyle = FOAM;
    ctx.beginPath();
    const sprayEvery = SPRAY_EVERY * (z >= 1.5 ? 1 : 1.5);
    const lift = (0.6 + 2.2 * tall) * HALF_H * z * 0.5 * flow;
    for (let k = Math.floor(a / sprayEvery) - 1; k * sprayEvery < b + sprayEvery; k++) {
      const h = keyed(s, k, 71);
      if (h > (0.55 + 0.3 * tall) * flow) continue;
      const u0k = (k + 0.5) * sprayEvery;
      if (u0k < a || u0k >= b) continue;
      const period = 0.6 + 0.5 * keyed(s, k, 72);
      const age = (((t / period + h * 7.3) % 1) + 1) % 1;
      const side = keyed(s, k, 73) < 0.5 ? -1 : 1;
      const u = u0k + side * age * (0.08 + 0.2 * tall) * (0.5 + h);
      const out = age * (0.1 + 0.25 * keyed(s, k, 74)) * (0.6 + tall);
      foot(u, out, 0, 0);
      const y = FT[1] - lift * (0.5 + h) * (age * 2 - age * age * 1.6) * inset(u0k);
      const r = Math.max(0.6, (1.3 - age) * (0.7 + 0.5 * tall) * z * (0.6 + 0.6 * h) * Math.sqrt(flow));
      ctx.moveTo(FT[0] + r, y);
      ctx.arc(FT[0], y, r, 0, Math.PI * 2);
    }
    // Each drop ruled round, from close enough to see it.
    if (z >= 1.5 && flow >= 0.6) {
      ctx.strokeStyle = SPRAY_INK;
      ctx.lineWidth = Math.min(1.2, 0.4 * z);
      ctx.stroke();
    }
    ctx.fill();
  }

  /*
   * Lumps of foam along the foot, in two rows, the back one heaped where the
   * sheet comes down and the front one lower and further out where the churn
   * spreads, and a little past each end of the foot: ruled round in ink, shaded
   * under, then white over, a heap of puffs as the kit draws one, each
   * swelling and sinking in its turn. Each is ruled and shaded by the piece it
   * lies in (one past an end by the piece at that end), and whited by that one
   * and the pieces either side, so the ink and shade of one piece's lumps
   * never lie over the white of its neighbour's.
   */
  const every = LUMP_EVERY * (z >= 1.25 ? 1 : detail ? 1.35 : 2.5);
  const lumps = LUMPS;
  let m = 0;
  const list = ROPES;
  list.length = 0;
  ropes(p, a - 0.2, b + 0.2, list);
  const size = (s.wet ? 0.05 + 0.1 * tall * tall : 0.055 + 0.12 * tall * tall) * (z >= 1.25 ? 1 : detail ? 1.18 : 1.5) * flow;
  const near = every * 1.6;
  for (let row = 0; row < 2; row++) {
    for (let k = Math.floor((a - near) / every) - 1; k * every < b + near; k++) {
      const h = keyed(s, k * 2 + row, 63 + (detail ? 0 : 1));
      const u = (k + 0.5 + (h - 0.5) * 0.8 + row * 0.5) * every;
      if (u < a - near || u >= b + near || u < lo + 0.03 - spread || u > hi - 0.03 + spread) continue;
      if (row === 1 && keyed(s, k * 2 + row, 67) > (s.wet ? 0.8 : 0.55)) continue;
      let heap = 0.45;
      for (let r = 0; r < list.length; r += 3) heap = Math.max(heap, 1 - Math.abs(u - list[r]) / (list[r + 1] + 0.14));
      const pulse = detail ? 0.5 + 0.5 * Math.sin(t * (3.1 + 2.3 * h) + h * 17) : 0.5;
      const ins = inset(u);
      const grow = row === 0 ? 0.5 + 0.8 * heap : 0.7 + 0.35 * heap;
      const r = size * DISC_W * z * grow * (1 - 0.3 * slim) * (0.8 + 0.3 * pulse) * (0.45 + 0.55 * ins) * (0.55 + 0.85 * keyed(s, k * 2 + row, 64) ** 2);
      const out = row === 0 ? (keyed(s, k, 65) - 0.35) * 0.06 : (0.08 + 0.1 * keyed(s, k, 68)) * (0.7 + tall);
      const up = (row === 0 ? (s.wet ? 0.45 : 1) * (1.2 + 5 * tall + 10 * tall * tall) * heap * (0.75 + 0.4 * pulse) * ins : (s.wet ? 0.1 : 0.5) * (1 + 3 * tall) * ins) * flow * narrow;
      foot(u, out, up, 0);
      if (m + 4 > lumps.length) break;
      lumps[m++] = FT[0];
      lumps[m++] = FT[1];
      lumps[m++] = Math.max(0.8, r);
      lumps[m++] = (u >= a || first) && (u < b || last) ? 1 : 0;
    }
  }
  // Ruled round, then shaded under, then white over: the ink and the shade by the piece each lump lies in, the white by that one and its neighbours.
  const rule = Math.max(0.7, 0.8 * z);
  for (const [ink, lift, grow, add, all] of [[FOAM_INK, -0.25, 1, rule, false], [PLUME_SHADE, -0.25, 1, 0, false], [FOAM, 0.12, 0.86, 0, true]] as const) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    for (let i = 0; i < m; i += 4) {
      if (!all && !lumps[i + 3]) continue;
      // Too small to be seen ruled round, or a thin ring's beads of foam: shaded and whited only.
      if (add && (lumps[i + 2] < 1.6 || flow < 0.6)) continue;
      // The rule no wider than a fifth of the lump, so a small one is foam and not a bead.
      const r = lumps[i + 2] * grow + Math.min(add, lumps[i + 2] * 0.2);
      const y = lumps[i + 1] - lumps[i + 2] * lift;
      ctx.moveTo(lumps[i] + r, y);
      ctx.arc(lumps[i], y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  if (!detail) return;
  if (foamTex && tall > 0.25) {
    // A skirt of spray along the foot of a tall fall, hanging over the churn and the bottom of the sheet, rising and thinning.
    const every = 0.3;
    for (let k = Math.floor(a / every) - 1; k * every < b + every; k++) {
      const c = (k + 0.5 + (keyed(s, k, 75) - 0.5) * 0.6) * every;
      if (c < a || c >= b) continue;
      const age = (((t / (2.2 + keyed(s, k, 76)) + keyed(s, k, 77) * 3) % 1) + 1) % 1;
      const r = (0.18 + 0.4 * tall) * (0.7 + 0.5 * age) * inset(c);
      foot(c, 0.05, (3 + 16 * tall) * age, 0);
      ctx.globalAlpha = 0.14 * (tall - 0.2) * Math.sin(Math.PI * age);
      ctx.drawImage(foamTex, FT[0] - r * DISC_W * z, FT[1] - r * DISC_H * z * 1.6, r * DISC_W * z * 2, r * DISC_H * z * 3.2);
    }
    ctx.globalAlpha = 1;
  }
}

/** Where the foot of a sheet is on the screen at `u` along its lip. */
export function footPoint(p: Placed, u: number): [number, number] {
  const s = p.sheet;
  lipAt(p, u);
  return [LIP[0] + LIP[2], LIP[1] + LIP[3] + p.hs * (s.top - landAt(s, u))];
}

/* ---- In the air ------------------------------------------------------------- */

/**
 * The mist off a fall: puffs along the whole of its foot, climbing and
 * carried off down the wind, more and bigger off a taller fall. Drawn with
 * the smoke, after everything on the ground, because it hangs over it.
 */
export function drawMist(
  ctx: CanvasRenderingContext2D, v: FallView, p: Placed, tex: CanvasImageSource, lean: { x: number; y: number; force: number }, dark: number,
): void {
  const s = p.sheet;
  if (s.grow < 1 || v.zoom < DETAIL_FROM || p.tall < 0.15) return;
  const lo = s.from - s.half;
  const hi = s.to + s.half;
  if (!seen(v, p, lo, hi, 90 * v.zoom)) return;
  const z = v.zoom;
  const t = v.t;
  const tall = p.tall;
  const size = Math.min(70, (10 + 30 * tall) * z);
  for (let k = Math.floor(lo / MIST_EVERY); k * MIST_EVERY < hi; k++) {
    const h = keyed(s, k, 81);
    const u = Math.max(lo + s.half, Math.min(hi - s.half, (k + 0.5 + (h - 0.5) * 0.6) * MIST_EVERY));
    for (let j = 0; j < 2; j++) {
      const age = (((t / (MIST_LIFE * (0.85 + 0.3 * h)) + h * 3.3 + j * 0.5) % 1) + 1) % 1;
      lipAt(p, u);
      const x = LIP[0] + LIP[2];
      const y = LIP[1] + LIP[3] + p.hs * (s.top - landAt(s, u));
      const blown = lean.force * age * age * 40 * z;
      const px = x + lean.x * blown + Math.sin(age * 5 + k * 2.1 + j) * 5 * z;
      const py = y - age * (14 + 50 * tall) * z + lean.y * blown * 0.4;
      const r = size * (0.4 + 0.8 * age);
      ctx.globalAlpha = 0.24 * tall * Math.sin(Math.PI * age) * (1 - 0.4 * dark);
      ctx.drawImage(tex, px - r, py - r * 0.8, r * 2, r * 1.6);
    }
  }
  ctx.globalAlpha = 1;
}

/* ---- Colours ---------------------------------------------------------------- */

/*
 * Drawn as the runestones' kit is drawn (`./runestone`, `./kit/core`): pastel
 * water in a few flat tones rather than a wash, each rope of thicker water a
 * rounded column lit on its screen-left side and creased on its right, the
 * sheet ruled down its ends in the kit's ink -- warm, never black, here taken
 * toward the water's own edge colour -- and the foam at its foot a heap of
 * puffs ruled round in the same ink, warm white over a lilac shade, as the
 * kit's shade goes toward lilac rather than toward black.
 */
type RGB = readonly [number, number, number];
const mixRgb = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgb = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c: RGB, a: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;

/** The ink water is ruled in: the kit's warm ink taken a third of the way to the water's edge colour. */
const WATER_INK: RGB = mixRgb(SPRING_EDGE, STONE_INK, 0.66);
/** The kit's warm white, which the near white of falling water and the top of its foam are. */
const WARM_WHITE: RGB = mixRgb(SPRING_FOAM, [255, 251, 234], 0.6);
/** The lilac the kit's shade goes toward, which the shade under foam is taken toward. */
const LILAC: RGB = [170, 168, 206];

/**
 * Where down a sheet its colours change, from the lip to the foot, as shares
 * of how far below the lip on the screen: four flat tones, as the kit paints
 * a face, each stepped hard into the next -- the roll over the lip, the glassy water under it,
 * the paler water breaking up, and the white over the foot.
 */
const STOPS = [0, 0.045, 0.07, 0.34, 0.36, 0.64, 0.66, 1];
/** The sheet down its length at each stop, for each of eleven steps of how white it goes by the foot. */
const BODY: RGB[][] = Array.from({ length: 11 }, (_, i) => {
  const w = i / 10;
  return [
    mixRgb(SPRING_WATER, SPRING_PALE, 0.66),
    mixRgb(SPRING_WATER, SPRING_PALE, 0.56),
    mixRgb(SPRING_WATER, SPRING_PALE, 0.1),
    mixRgb(SPRING_WATER, SPRING_PALE, 0.16),
    mixRgb(SPRING_WATER, SPRING_PALE, 0.36 + 0.14 * w),
    mixRgb(SPRING_WATER, SPRING_PALE, 0.46 + 0.2 * w),
    mixRgb(SPRING_PALE, WARM_WHITE, 0.1 + 0.45 * w),
    mixRgb(SPRING_PALE, WARM_WHITE, 0.25 + 0.7 * w),
  ];
});
/**
 * The thin veil of it, bluer where the dark rock shows through; a rope of
 * thicker water, paler; the lit side of a rope, palest; and the crease down
 * its shaded side, the rope's own colour taken toward the ink. Solid, so
 * pieces of one sheet laid over each other's edges meet without a seam.
 */
const VEIL: string[][] = BODY.map((row) => row.map((c, k) => rgb(mixRgb(c, SPRING_EDGE, [0.1, 0.12, 0.46, 0.42, 0.26, 0.22, 0.06, 0.03][k]))));
const ROPE_RGB: RGB[][] = BODY.map((row) => row.map((c, k) => mixRgb(c, SPRING_PALE, [0.3, 0.3, 0.26, 0.3, 0.26, 0.24, 0.12, 0.05][k])));
const ROPE: string[][] = ROPE_RGB.map((row) => row.map(rgb));
const CORE: string[][] = BODY.map((row) => row.map((c, k) => rgb(mixRgb(mixRgb(c, SPRING_PALE, [0.55, 0.55, 0.6, 0.66, 0.6, 0.55, 0.3, 0.15][k]), WARM_WHITE, 0.2))));
const CREASE: string[][] = ROPE_RGB.map((row) => row.map((c, k) => rgb(mixRgb(c, WATER_INK, [0.3, 0.3, 0.55, 0.52, 0.42, 0.38, 0.2, 0.12][k]))));
/** The wet rock behind a sheet. */
const WET_ROCK = 'rgba(40,58,78,0.3)';
/** The wet rock seen through a tear in a sheet. */
const TEAR = rgb(mixRgb(mixRgb(SPRING_WATER, SPRING_EDGE, 0.75), [105, 104, 111], 0.2));
/** The ink down each end of a sheet. */
const SIDE_INK = rgb(WATER_INK);
/** Streaks: near white on the ropes, fainter white on the veil. */
const STREAK_PALE = rgba(WARM_WHITE, 0.86);
const STREAK_FAINT = rgba(WARM_WHITE, 0.4);
/** Threads breaking away, and the broken edge at each end. */
const THREAD = rgba(WARM_WHITE, 0.7);
/** Flecks of white breaking out of the lower part of a tall fall. */
const FLECK = rgba(WARM_WHITE, 0.8);
const EDGE_LIGHT = rgba(WARM_WHITE, 0.75);
/** The water drawn into a lip, from clear to where it turns over; and the light along the edge. */
const TONGUE_INK = [rgba(SPRING_PALE, 0), rgba(mixRgb(SPRING_WATER, SPRING_PALE, 0.5), 0.42), rgba(mixRgb(SPRING_PALE, WARM_WHITE, 0.3), 0.85)];
/** Where down the water drawn into a lip each of those begins and ends, from the back of it to the edge. */
const TONGUE_STOPS = [0, 0.34, 0.34, 0.74, 0.74, 1];
/** The lines of water drawn in toward a lip. */
const TONGUE_LINE = rgba(WARM_WHITE, 0.6);
const LIP_LIGHT = rgb(WARM_WHITE);
/** The crease under the light along a lip, where the water rolled over meets the face of the sheet. */
const LIP_CREASE = rgb(mixRgb(mixRgb(SPRING_WATER, SPRING_PALE, 0.3), WATER_INK, 0.45));
/** A glint where the light catches the water turning over: the runes' white. */
const GLINT = RUNE_WHITE;
/** Foam: its top, the shade under a puff of it, and the ink it is ruled round with. */
const FOAM = rgb(WARM_WHITE);
const PLUME_SHADE = rgb(mixRgb(mixRgb(SPRING_PALE, LILAC, 0.42), SPRING_EDGE, 0.1));
const FOAM_INK = rgb(mixRgb(WATER_INK, SPRING_PALE, 0.18));
const SPRAY_INK = rgba(WATER_INK, 0.4);
/** A ring on the water at eight strengths, as it fades. */
const RINGS = Array.from({ length: 8 }, (_, i) => rgba(WARM_WHITE, 0.08 + (0.6 * (i + 1)) / 8));

/** Scratch: a screen point or two, the curve, the ropes of a stretch, a foot's points, lumps as x, y, radius and whether the piece owns it, and streaks as lane and span. */
const PT = new Float64Array(4);
/** Scratch for the far edge of a rope at each slice of a sheet; each end of a stretch at each slice; and each rope's middle and half width at each slice. */
const ROPE_EDGE = new Float64Array(32);
const SLICE_L = new Float64Array(32);
const SLICE_R = new Float64Array(32);
const ROPE_MID = new Float64Array(1024);
const ROPE_W = new Float64Array(1024);
const CV = new Float64Array(2);
/** Scratch for where the lip is at a point and the step out from it to the foot, and the step along it (`lipAt`, `alongAt`). */
const LIP = new Float64Array(6);
const FT = new Float64Array(4);
const ROPES: number[] = [];
const LUMPS = new Float64Array(4 * 512);
const STREAK_PALE_LIST: number[] = [];
const STREAK_FAINT_LIST: number[] = [];
