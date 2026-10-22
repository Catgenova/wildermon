import { hash2 } from '../../world/noise';
import type { Ctx, SeamLook, Stud } from './types';

/**
 * Ore in the rock: the drawing every kind shares.
 *
 * A seam used to be a tile filled with the metal's colour, which says the one
 * thing about ore that is not true: that it comes in four-metre squares. Then
 * it was lobes of the metal's colour along the strata, built as paths every
 * frame -- a path a band, a dozen points a lobe, three passes -- which joined
 * across tiles but cost seventy-five milliseconds a frame on a hillside that
 * was ore all the way across until the outlines and corners were cut back,
 * and could never afford to look like much.
 *
 * What is drawn now is a strip of picture laid along each band. Each kind
 * paints its strips once per zoom step (`types/<name>.ts`), with all the
 * detail it likes, and a tile fills the part of itself a band crosses with
 * that picture as a pattern -- one fill a band, three to five corners a fill,
 * whatever is in the strip. What stands up off the face (a nugget catching
 * the light, a crystal) is a stud: a small picture painted once and stamped.
 *
 * The part that makes it a vein rather than a blot per tile is where the
 * bands are. Every band is worked out from world coordinates, so the tile
 * either side of a join finds the same band at the same place with the same
 * start along its strip, and each fills its own half. The strip goes onto the
 * tile through its corners, and two neighbouring tiles share their corners,
 * so along the edge between them the two agree to the pixel and the band runs
 * on through.
 *
 * Which way the bands run is a step noise over the map: one hillside's strata
 * lie one way and the next one's another, and neither changes its mind
 * halfway up.
 */

/** How many tiles of country share one answer about which way the rock lies. */
const BLOCK = 24;

/**
 * Which way the strata run here, in radians: one answer per block of country,
 * and the same answer for every tile in it.
 *
 * It has to be a step and not a slope. Everything below works out where the
 * bands are from world coordinates, so that the tile either side of a join
 * finds the same band and it runs on through; and it can only do that if both
 * tiles agree about the angle to the last bit. Smoothed over twenty tiles the
 * angle moved by a few degrees from one tile to the next, which is nothing to
 * look at and quite enough to put two neighbours' bands in two different
 * places -- the seams came out in rectangular blocks.
 *
 * The step that is left shows up where two blocks meet, as a line along which
 * the rock lies one way on one side and another on the other. Which is a
 * fault, and is what country does.
 */
export function strata(x: number, y: number): number {
  return hash2(Math.floor(x / BLOCK), Math.floor(y / BLOCK), 503) * Math.PI;
}

/** Below this zoom no seam is drawn: the wash of the ore through the stone's colour is what says it is there. */
export const SEAM_FROM = 0.9;

/**
 * Device pixels a strip is painted at per tile, per unit of zoom. A tile's
 * edge is fifty-four pixels long on the screen at zoom one, and longer up a
 * slope; a little over that keeps a strip sharp without painting it twice
 * the size it is shown.
 */
const TEX_UNIT = 64;
/** A stud's unit, in screen pixels at zoom one: a tile's edge as it looks flat. */
export const STUD_UNIT = 54;
/**
 * The most pixels a strip gets per tile. Closer in than this it is stretched
 * a little: a strip four tiles long at the full zoom of a high-density screen
 * would be eight megabytes a variant for a picture of a vein.
 */
const MAX_RES = 300;
/** How far into its tile a stud's foot must be, as a share of the tile, for it to be drawn. */
export const STUD_MARGIN = 0.14;
/**
 * The zooms strips are painted at. A zoom between two takes the one above,
 * so a strip is never shown bigger than it was painted.
 */
const STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4, 5];
/**
 * How long, after one kind's pictures are painted, before another kind's
 * may be: the next frame or two make do with the nearest zoom step that is
 * already painted. Painting a kind is a few milliseconds; a zoom that
 * crosses a step with eight kinds on the screen would otherwise do all eight
 * in the one frame.
 */
const PAINT_GAP = 40;
/** How long, in milliseconds, a kind's pictures are kept after they were last drawn with. */
const FORGET = 20000;

/** One kind's pictures at one zoom step. */
interface Baked {
  step: number;
  dpr: number;
  res: number;
  /** Tiles along the band per pixel of a strip: not quite one over `res`, as a strip is a whole number of pixels long. */
  along: number;
  /** Per strip, how far either side of the band's middle it has anything painted (`extent`). */
  reach: Array<[number, number]>;
  strips: CanvasPattern[];
  studs: Stud[][];
  sprites: HTMLCanvasElement[];
  /** When it was last drawn with, so pictures nobody has looked at for a while can go. */
  used: number;
}

/** Per kind, the pictures it has: the step in use and the one before, so a zoom back and forth does not paint again. */
const baked = new Map<number, Baked[]>();
let lastPaint = -Infinity;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** A small seeded generator, so a strip is painted the same every time. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2d context');
  return [c, g];
}

/**
 * Paint `look`'s strips at `res` pixels a tile: the canvases and where their
 * studs stand. Exported for the tools that look at a strip on its own.
 */
export function paintStrips(kind: number, look: SeamLook, res: number): { canvases: HTMLCanvasElement[]; studs: Stud[][]; along: number; reach: Array<[number, number]> } {
  const canvases: HTMLCanvasElement[] = [];
  const reach: Array<[number, number]> = [];
  const studs: Stud[][] = [];
  // Whole pixels along, so the repeat lands on the same pixel the strip
  // ends on and the join between one repeat and the next does not show.
  const wide = Math.max(1, Math.round(look.length * res));
  const sx = wide / look.length;
  for (let v = 0; v < look.variants; v++) {
    // A row of clear pixels top and bottom, so the filtering at the edge of
    // the band's fill has nothing to pick up.
    const [c, g] = canvas(wide, look.half * 2 * res + 2);
    g.setTransform(sx, 0, 0, res, 0, 1 + look.half * res);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    studs.push(look.strip(g, v, res, rng(kind * 7919 + v * 104729 + 17)) || []);
    canvases.push(c);
    reach.push(extent(g, c.width, c.height, res, look.half));
  }
  return { canvases, studs, along: 1 / sx, reach };
}

/**
 * How far across the strip anything was actually painted, either side of
 * the band's middle, in tiles, with a pixel to spare. A band fills only this
 * much of a tile: the fill is what a seam costs, and on a computer drawing
 * without a graphics card it is most of it, so a look whose `half` leaves
 * room to spare does not pay for the room.
 */
function extent(g: Ctx, w: number, h: number, res: number, half: number): [number, number] {
  const d = g.getImageData(0, 0, w, h).data;
  const row = (y: number): boolean => {
    for (let x = 0, i = y * w * 4 + 3; x < w; x++, i += 4) if (d[i] > 2) return true;
    return false;
  };
  let top = 0, bot = h - 1;
  while (top < bot && !row(top)) top++;
  while (bot > top && !row(bot)) bot--;
  if (top >= bot) return [0, 0];
  return [Math.max(-half, (top - 2) / res - half), Math.min(half, (bot + 1) / res - half)];
}

function paint(kind: number, look: SeamLook, step: number, dpr: number, into: Ctx): Baked {
  const res = Math.min(MAX_RES, TEX_UNIT * step * dpr);
  const { canvases, studs, along, reach } = paintStrips(kind, look, res);
  const strips = canvases.map((c) => {
    const p = into.createPattern(c, 'repeat');
    if (!p) throw new Error('no pattern');
    return p;
  });
  const sprites: HTMLCanvasElement[] = [];
  const st = look.studs;
  if (st) {
    const spx = STUD_UNIT * step * dpr;
    for (let k = 0; k < st.kinds; k++) {
      const [c, g] = canvas(st.w * spx, st.h * spx);
      g.setTransform(spx, 0, 0, spx, st.ax * st.w * spx, st.ay * st.h * spx);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      st.draw(g, k, spx);
      sprites.push(c);
    }
  }
  return { step, dpr, res, along, reach, strips, studs, sprites, used: now() };
}

/** The pictures to draw `kind` with at this zoom: the right ones if there are, or the nearest while the right ones wait their turn. */
function picturesFor(kind: number, look: SeamLook, zoom: number, dpr: number, g: Ctx): Baked {
  let step = STEPS[STEPS.length - 1];
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i] >= zoom - 1e-6) {
      step = STEPS[i];
      break;
    }
  }
  let have = baked.get(kind);
  if (!have) baked.set(kind, (have = []));
  const t = now();
  for (const b of have) if (b.step === step && b.dpr === dpr) {
    b.used = t;
    return b;
  }
  if (have.length && t - lastPaint < PAINT_GAP) {
    let best = have[0];
    for (const b of have) if (Math.abs(b.step - step) < Math.abs(best.step - step)) best = b;
    return best;
  }
  lastPaint = t;
  // Pictures of any kind not drawn with for a while go first: close in, a
  // kind's strips are a megabyte or more, and a walk across the island
  // passes every kind there is.
  for (const [k, list] of baked) {
    const keep = list.filter((x) => t - x.used < FORGET);
    if (keep.length !== list.length) baked.set(k, keep);
  }
  have = baked.get(kind) ?? [];
  baked.set(kind, have);
  const b = paint(kind, look, step, dpr, g);
  // The step in use and the one before it, and no more.
  have.unshift(b);
  if (have.length > 2) have.length = 2;
  return b;
}

/** Forget every painted picture: for the sheet, after a look has been changed. */
export function forgetSeams(): void {
  baked.clear();
  lastPaint = -Infinity;
}

/* ---- laying a strip onto a tile ------------------------------------------- */

/** Scratch for clipping: a polygon in the tile's square, and the one it clips into. */
const polyA = new Float64Array(16);
const polyB = new Float64Array(16);
/** The pattern's transform, one object for every fill. */
const M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const OUT: [number, number] = [0, 0];
/** Where a triangle's corner goes when each of its edges is pushed out by one: one and root two. */
const SQ = 1 + Math.SQRT2;

/**
 * Cut the polygon `n` corners long in `src` down to where `k0 + ku*u + kv*v`
 * is not negative, into `dst`; how many corners are left.
 */
function cut(src: Float64Array, n: number, dst: Float64Array, k0: number, ku: number, kv: number): number {
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ua = src[i * 2], va = src[i * 2 + 1], ub = src[j * 2], vb = src[j * 2 + 1];
    const fa = k0 + ku * ua + kv * va, fb = k0 + ku * ub + kv * vb;
    if (fa >= 0) {
      dst[m++] = ua;
      dst[m++] = va;
    }
    if ((fa >= 0) !== (fb >= 0)) {
      const s = fa / (fa - fb);
      dst[m++] = ua + (ub - ua) * s;
      dst[m++] = va + (vb - va) * s;
    }
  }
  return m / 2;
}

/**
 * The seam of kind `kind` on one tile of it, drawn over the stone already
 * there.
 *
 * `pts` is the tile's four screen corners and `rot` says which of them holds
 * the tile's own (0, 0), so a band lands on the same square foot of ground
 * whichever way the camera is round.
 *
 * A strip goes onto the tile flat: a point of the tile's square goes to the
 * screen by the map across its four corners. That map is bilinear, and a
 * pattern can only be put down through an affine one, so the tile is filled
 * as two triangles, each through the affine map its own three corners make.
 * Along every edge -- the two triangles' shared one, and each tile's with its
 * neighbours -- the two sides then agree exactly, because a bilinear map is
 * straight along an edge. On a tile whose four corners lie in a plane, which
 * is most of a smooth hillside, the map is affine already and one fill does.
 *
 * Every fill is pushed out by half a pixel or so all round. Two fills that
 * meet edge to edge each cover half of the pixels along the edge, and a vein
 * drawn that way has a faint pale line ruled through it at every join.
 */
export function paintSeam(g: Ctx, kind: number, look: SeamLook, x: number, y: number, pts: ArrayLike<number>, rot: number, zoom: number, dpr: number): void {
  const pics = picturesFor(kind, look, zoom, dpr, g);
  const ang = strata(x, y);
  const nx = Math.cos(ang), ny = Math.sin(ang);
  const { pitch, drift, half, length: L } = look;

  // The tile's corners on the screen: (0,0), (1,0), (1,1), (0,1) of its own square.
  const A = (rot & 3) * 2, B = ((rot + 1) & 3) * 2, C = ((rot + 2) & 3) * 2, D = ((rot + 3) & 3) * 2;
  const ax = pts[A], ay = pts[A + 1], bx = pts[B], by = pts[B + 1];
  const cx = pts[C], cy = pts[C + 1], dx = pts[D], dy = pts[D + 1];
  // How far the tile's corners are off one plane, in pixels.
  const twx = ax - bx - dx + cx, twy = ay - by - dy + cy;
  const flat = Math.abs(twx) + Math.abs(twy) < 1;

  // Across the strata, where the tile reaches from and to; and along them.
  const n00 = x * nx + y * ny;
  const lo = n00 + Math.min(0, nx) + Math.min(0, ny);
  const hi = n00 + Math.max(0, nx) + Math.max(0, ny);
  const t00 = -x * ny + y * nx;
  const tlo = t00 + Math.min(0, -ny) + Math.min(0, nx);
  const thi = t00 + Math.max(0, -ny) + Math.max(0, nx);

  // Half a pixel and a bit, in shares of the tile, for pushing fills out.
  const edge = Math.min(Math.hypot(bx - ax, by - ay), Math.hypot(dx - ax, dy - ay));
  const grow = edge > 1 ? 0.7 / edge : 0;
  const seed = kind * 131 + 7;
  const res = pics.res;

  const first = Math.floor((lo - half - drift) / pitch);
  const last = Math.ceil((hi + half + drift) / pitch);
  let studsOn = false;
  for (let b = first; b <= last; b++) {
    const mid = b * pitch + (hash2(b, seed, 619) - 0.5) * 2 * drift;
    const v = Math.floor(hash2(b, seed, 631) * look.variants) % look.variants;
    const [rLo, rHi] = pics.reach[v];
    if (mid + rHi < lo || mid + rLo > hi) continue;
    studsOn = true;
    const phase = hash2(b, seed, 641) * L;
    // Where along the band the strip's own start is: the repeat of it at or
    // before the tile, so every number below stays small.
    const t0 = phase + Math.floor((tlo - phase) / L) * L;
    const n0 = mid - half;
    // The strip's pixel (0, 0), in the tile's square, and a pixel along and across it.
    const u0 = n0 * nx - t0 * ny - x, v0 = n0 * ny + t0 * nx - y;
    const uAlong = -ny * pics.along, vAlong = nx * pics.along;
    const uAcross = nx / res, vAcross = ny / res;
    // Shift up by the clear row the strip is painted with.
    const u1 = u0 - uAcross, v1 = v0 - vAcross;
    // Where the band's fill stops, as `n - (mid + rLo)` and `(mid + rHi) - n` over the tile's square.
    const kLo0 = n00 - (mid + rLo), kHi0 = mid + rHi - n00;

    const pieces = flat ? 1 : 2;
    for (let p = 0; p < pieces; p++) {
      // The piece's affine map from the tile's square: O + Eu*u + Ev*v.
      let ox: number, oy: number, eux: number, euy: number, evx: number, evy: number, n: number;
      // And the piece itself in the square, pushed out by `grow` across each of its edges.
      const s = grow;
      if (flat) {
        eux = (bx - ax + cx - dx) / 2; euy = (by - ay + cy - dy) / 2;
        evx = (dx - ax + cx - bx) / 2; evy = (dy - ay + cy - by) / 2;
        ox = (ax + bx + cx + dx) / 4 - (eux + evx) / 2; oy = (ay + by + cy + dy) / 4 - (euy + evy) / 2;
        polyA[0] = -s; polyA[1] = -s; polyA[2] = 1 + s; polyA[3] = -s;
        polyA[4] = 1 + s; polyA[5] = 1 + s; polyA[6] = -s; polyA[7] = 1 + s;
        n = 4;
      } else if (p === 0) {
        // (0,0), (1,0), (1,1).
        ox = ax; oy = ay; eux = bx - ax; euy = by - ay; evx = cx - bx; evy = cy - by;
        polyA[0] = -s * SQ; polyA[1] = -s; polyA[2] = 1 + s; polyA[3] = -s;
        polyA[4] = 1 + s; polyA[5] = 1 + s * SQ;
        n = 3;
      } else {
        // (0,0), (1,1), (0,1).
        ox = ax; oy = ay; eux = cx - dx; euy = cy - dy; evx = dx - ax; evy = dy - ay;
        polyA[0] = -s; polyA[1] = -s * SQ; polyA[2] = 1 + s * SQ; polyA[3] = 1 + s;
        polyA[4] = -s; polyA[5] = 1 + s;
        n = 3;
      }
      n = cut(polyA, n, polyB, kLo0, nx, ny);
      if (n < 3) continue;
      n = cut(polyB, n, polyA, kHi0, -nx, -ny);
      if (n < 3) continue;
      M.a = eux * uAlong + evx * vAlong;
      M.b = euy * uAlong + evy * vAlong;
      M.c = eux * uAcross + evx * vAcross;
      M.d = euy * uAcross + evy * vAcross;
      M.e = ox + eux * u1 + evx * v1;
      M.f = oy + euy * u1 + evy * v1;
      const pat = pics.strips[v];
      pat.setTransform(M);
      g.fillStyle = pat;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const u = polyA[i * 2], w = polyA[i * 2 + 1];
        const px = ox + eux * u + evx * w, py = oy + euy * u + evy * w;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.fill();
    }
  }
  if (!studsOn) return;

  const st = look.studs;
  const map = (u: number, v: number, out: [number, number]): [number, number] => {
    out[0] = (ax * (1 - u) + bx * u) * (1 - v) + (dx * (1 - u) + cx * u) * v;
    out[1] = (ay * (1 - u) + by * u) * (1 - v) + (dy * (1 - u) + cy * u) * v;
    return out;
  };
  if (st && pics.sprites.length && zoom >= (st.from ?? 0)) {
    const sw = st.w * STUD_UNIT * zoom, sh = st.h * STUD_UNIT * zoom;
    const offX = st.ax * sw, offY = st.ay * sh;
    const secs = st.twinkle ? now() / 1000 : 0;
    const alpha = g.globalAlpha;
    for (let b = first; b <= last; b++) {
      const mid = b * pitch + (hash2(b, seed, 619) - 0.5) * 2 * drift;
      const v = Math.floor(hash2(b, seed, 631) * look.variants) % look.variants;
      const list = pics.studs[v];
      if (!list.length) continue;
      const phase = hash2(b, seed, 641) * L;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const nn = mid + s.n;
        if (nn < lo || nn > hi) continue;
        // Every repeat of this stud along the band that falls within the tile's reach.
        const base = phase + s.t;
        for (let k = Math.ceil((tlo - base) / L); base + k * L <= thi; k++) {
          const tt = base + k * L;
          const u = nn * nx - tt * ny - x, w = nn * ny + tt * nx - y;
          if (u < STUD_MARGIN || u > 1 - STUD_MARGIN || w < STUD_MARGIN || w > 1 - STUD_MARGIN) continue;
          map(u, w, OUT);
          const img = pics.sprites[s.kind % pics.sprites.length];
          if (st.twinkle) {
            const beat = 0.5 + 0.5 * Math.sin(secs * 1.7 + hash2(b, k * 31 + i, 653) * 40);
            g.globalAlpha = alpha * (1 - st.twinkle * beat * beat);
          }
          g.drawImage(img, OUT[0] - offX, OUT[1] - offY, sw, sh);
        }
      }
    }
    if (st.twinkle) g.globalAlpha = alpha;
  }
  if (look.extra) look.extra({ g, x, y, zoom, now: now() / 1000, at: map });
}
