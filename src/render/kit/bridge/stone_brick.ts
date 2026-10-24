import { cut, glyphPath, proj, RUNE_GOLD, RUNE_WHITE } from '../../runestone';
import { css, dot, faceColour, hex, mix, type Ctx, type RGB, type Tone, type V3 } from '../core';
import {
  bayAt, BUILDERS, ownerOf, refugeGaps, samples, turned, U,
  type BridgePainter, type BridgeStyle, type Builders, type FaceInfo, type Kit, type L, type Part3, type Plan, type Role, type Slice,
} from './core';

/**
 * Stone brick: the island's blue-grey ashlar, dressed in limestone, as its
 * houses are (`masonry.ts`, `STONE`), with a crenellated parapet.
 *
 * The first half of this file is what the three dressed-stone bridges --
 * stone brick, slate and cobblestone -- share: tones taken off their
 * houses' own colours, painters that lay a face in courses or rubble a
 * stone at a time, voussoirs that follow their arch, runes cut upright, and
 * `framed`, which hands every painter the true extent of its face in its own
 * frame and, for an arch ring, the arch it is on.
 */

/* ---- tones ----------------------------------------------------------------------------------- */

const clamp = (c: number): number => Math.max(0, Math.min(255, c));

/**
 * A tone off a house's own colour: `lit` as the house's sunlit face shows
 * it, and its shade such that a face turned from the light comes out as the
 * house's shaded face does (`mult` of the lit colour, by channel).
 */
export function houseTone(lit: string, mult: readonly [number, number, number]): Tone {
  const l = hex(lit);
  return { lit: l, shade: l.map((c, i) => clamp(c + (c * mult[i] - c) / 0.92)) as RGB };
}

/** Beds of a stone and how often each comes up. */
export type Beds = ReadonlyArray<readonly [Tone, number]>;

/* ---- a number off a place -------------------------------------------------------------------- */

/** Nought to one off three whole numbers, the same every time. */
export function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b) ^ Math.imul((c | 0) + 0x3c6ef372, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function pick(beds: Beds, v: number): number {
  let total = 0;
  for (const [, w] of beds) total += w;
  let at = v * total;
  for (let i = 0; i < beds.length; i++) { at -= beds[i][1]; if (at < 0) return i; }
  return beds.length - 1;
}

/* ---- faces told where they are ------------------------------------------------------------------ */

/** An arch ring's arch, in its face's frame: an ellipse round (`cx`, `cy`) of half-axes `ax`, `ay`, from angle `th0` to `th1`. */
export interface Arc { cx: number; cy: number; ax: number; ay: number; th0: number; th1: number }
/** A face's info as `framed` hands it on: its true extent in its frame, and what it is part of. */
export interface Placed extends FaceInfo {
  arc?: Arc;
  soffit?: boolean;
  /** Whether the frame lies mirrored on the screen, and which way its `x` runs along the bridge (+1, -1, or nought across it). */
  flip?: boolean;
  sx?: number;
}

const S = (v: L): V3 => [v[0] * U, v[1] * U, v[2]];
/** Where the point `p` falls in a face's frame. */
function inFrame(fr: { o: L; a: L; b: L }, p: L): [number, number] {
  const a = S(fr.a), b = S(fr.b), d = S([p[0] - fr.o[0], p[1] - fr.o[1], p[2] - fr.o[2]]);
  const aa = dot(a, a), ab = dot(a, b), bb = dot(b, b), ad = dot(a, d), bd = dot(b, d);
  const det = aa * bb - ab * ab || 1;
  return [(ad * bb - bd * ab) / det, (bd * aa - ad * ab) / det];
}

/** The arch a ring face from `s0` to `s1` at `t`, its underside at `z` there, is part of, in the face's frame. */
function arcOf(plan: Plan, fr: { o: L; a: L; b: L }, s0: number, s1: number, t: number, z: number): Arc | undefined {
  const bay = bayAt(plan, (s0 + s1) / 2);
  const upper = Math.abs(bay.arch(s0) - z) < 0.05;
  const lower = !upper && bay.lower && Math.abs(bay.lower(s0) - z) < 0.05;
  if (!upper && !lower) return undefined;
  const A = bay.a * U;
  const crown = upper ? bay.crown : bay.lowerCrown!;
  const spring = upper ? bay.spring : bay.lowerSpring!;
  const r = crown - spring;
  let zc: number, ax: number, ay: number, th0 = 0, th1 = Math.PI;
  if (upper && bay.form === 'low') {
    // A segment of a circle: its middle under the crown, its radius from the span and the rise.
    const R = (A * A + r * r) / (2 * r);
    zc = crown - R;
    ax = ay = R;
    const half = Math.asin(Math.min(1, A / R));
    th0 = Math.PI / 2 - half;
    th1 = Math.PI / 2 + half;
  } else {
    zc = spring;
    ax = A;
    ay = r;
  }
  const [cx, cy] = inFrame(fr, [bay.c, t, zc]);
  const [ex] = inFrame(fr, [bay.c + ax / U, t, zc]);
  const [, ey] = inFrame(fr, [bay.c, t, zc + ay]);
  return { cx, cy, ax: Math.abs(ex - cx), ay: Math.abs(ey - cy), th0, th1 };
}

/** A kit whose faces reach their painters with their true extent in their frames, an arch ring's arch, and a frame for the underside of a vault. */
function framedKit(k: Kit): Kit {
  const face: Kit['face'] = (part, pts, out, tone, info, frame) => {
    let inf: Placed | undefined = info;
    let fr = frame;
    if (inf && !fr && inf.role === 'ring' && pts.length === 4) {
      // The underside of an arch: `x` across the bridge, `y` along it up the slope.
      const [a, b] = [pts[0], pts[1]];
      const ds = b[0] - a[0];
      if (Math.abs(ds) > 1e-6) {
        const slope = (b[2] - a[2]) / ds;
        fr = { o: [0, 0, a[2] - a[0] * slope], a: [0, 1 / U, 0], b: [1 / U, 0, slope / U] };
        inf = { ...inf, soffit: true };
      }
    }
    if (inf && fr) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) {
        const [x, y] = inFrame(fr, p);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      // Whether the frame lies mirrored on the screen, for a rune cut in it to be turned back.
      inf = { ...inf, x0, x1, y0, y1, flip: mirrored(k, fr), sx: Math.abs(fr.a[0]) > 1e-9 ? Math.sign(fr.a[0]) : 0 };
      if (inf.role === 'ring' && !inf.soffit) inf.arc = arcOf(k.plan, fr, pts[0][0], pts[1][0], pts[0][1], pts[0][2]);
    }
    k.face(part, pts, out, tone, inf, fr);
  };
  return { ...k, face };
}

/** Whether a frame lies mirrored on the screen: its `x` turned to the left of its `y`, which runs up. */
function mirrored(k: Kit, fr: { o: L; a: L; b: L }): boolean {
  const o = proj(k.e, k.m(fr.o));
  const add3 = (d: L): L => [fr.o[0] + d[0] * U, fr.o[1] + d[1] * U, fr.o[2] + d[2]];
  const a = proj(k.e, k.m(add3(fr.a))), b = proj(k.e, k.m(add3(fr.b)));
  // On the screen y runs down: a frame the right way round turns from `x` to `y` against the clock.
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]) > 0;
}

/** A style whose builders lay their faces through `framedKit`. */
export function framed(st: BridgeStyle): BridgeStyle {
  const own = st.build ?? {};
  const wrap = <K extends keyof Builders>(key: K): Builders[K] => {
    const fn = (own[key] ?? BUILDERS[key]) as (k: Kit, ...rest: never[]) => void;
    return ((k: Kit, ...rest: never[]) => fn(framedKit(k), ...rest)) as Builders[K];
  };
  return {
    ...st,
    build: { ...own, deck: wrap('deck'), arches: wrap('arches'), parapet: wrap('parapet'), ends: wrap('ends'), refuges: wrap('refuges') },
  };
}

/* ---- painters ------------------------------------------------------------------------------------ */

/** How many pixels of the bake a unit of the model is. */
const pxPerUnit = (m: DOMMatrix): number => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));

/** The extent of a face's info, low to high. */
const ext = (f: FaceInfo): [number, number, number, number] => [Math.min(f.x0, f.x1), Math.max(f.x0, f.x1), Math.min(f.y0, f.y1), Math.max(f.y0, f.y1)];

/** Draws one stretch of a laid face, `x0` to `x1` by `y0` to `y1` in units, in the light `L`, at `res` pixels a unit. */
type Lay = (g: Ctx, L: number, x0: number, x1: number, y0: number, y1: number, res: number) => void;

/**
 * A face laid in a pattern that repeats every `px` along and `py` up: drawn
 * once for each light and fineness into a tile, and every face after that
 * one fill of it. A bridge has a few dozen faces in each light, so this is
 * most of what keeps its bake within the kit's.
 */
function tiled(lay: Lay, px: number, py: number, pad: number): BridgePainter {
  const cache = new Map<string, CanvasPattern | null>();
  return (g, k, f) => {
    const [x0, x1, y0, y1] = ext(f);
    if (x1 - x0 > 4000 || y1 - y0 > 4000) return;
    const res = Math.max(1, Math.min(4, Math.ceil(pxPerUnit(g.getTransform()) - 0.15)));
    const L = Math.round(k.L * 50) / 50;
    const key = `${L}|${res}`;
    let pat = cache.get(key);
    if (pat === undefined) {
      pat = null;
      if (typeof document !== 'undefined') {
        const c = document.createElement('canvas');
        c.width = Math.round(px * res);
        c.height = Math.round(py * res);
        const t = c.getContext('2d');
        if (t) {
          t.scale(c.width / px, c.height / py);
          lay(t, L, -pad, px + pad, -pad, py + pad, res);
          pat = t.createPattern(c, 'repeat');
          pat?.setTransform(new DOMMatrix([px / c.width, 0, 0, py / c.height, 0, 0]));
        }
      }
      if (cache.size > 48) cache.clear();
      cache.set(key, pat);
    }
    if (!pat) { lay(g, k.L, x0, x1, y0, y1, pxPerUnit(g.getTransform())); return; }
    g.fillStyle = pat;
    g.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
  };
}

/** The finest lines are left out under this many pixels a unit. */
const FINE = 1.5;
/** Blocks in a tile along, and cycles of courses up it. */
const ALONG = 12;

export interface Courses {
  /** The courses' heights in turn, in units. */
  rows: readonly number[];
  /** A block's length, and how far either way of its place a joint wanders, as a share of it. */
  len: number;
  wander?: number;
  /** The stone's beds, the first being the ground of the face, and the joint between them. */
  beds: Beds;
  joint: Tone;
  /** The paler arris along the top of each block, and its width. */
  hi?: Tone;
  bevel?: number;
  jointW?: number;
}

/** Coursed blocks: rows `rows` high, blocks `len` long, each block one of the beds, its joints and the arris along its top. */
export function coursed(c: Courses): BridgePainter {
  const P = c.rows.reduce((p, q) => p + q, 0);
  const R = c.rows.length * 2;
  const wander = c.wander ?? 0.3;
  const jw = c.jointW ?? 0.45;
  const bevel = c.bevel ?? 0.35;
  const lay: Lay = (g, L, x0, x1, y0, y1, res) => {
    const fills = c.beds.map(([t]) => faceColour(t, L));
    g.fillStyle = css(fills[0]);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const paths = c.beds.map(() => new Path2D());
    const joints = new Path2D(), arris = new Path2D();
    const len = c.len;
    let ya = Math.floor(y0 / P) * P;
    let r = Math.floor(y0 / P) * c.rows.length;
    while (ya < y1) {
      const rr = ((r % R) + R) % R;
      const yb = ya + c.rows[rr % c.rows.length];
      const off = hash(rr, 7) * len;
      const at = (q: number): number => off + q * len + (hash(rr, ((q % ALONG) + ALONG) % ALONG, 1) - 0.5) * wander * len;
      for (let q = Math.floor((x0 - off) / len) - 1; ; q++) {
        const bx = at(q), nx = at(q + 1);
        if (bx > x1) break;
        if (nx < x0) continue;
        const i = pick(c.beds, hash(rr, ((q % ALONG) + ALONG) % ALONG, 2));
        if (i) paths[i].rect(bx, ya, nx - bx, yb - ya);
        joints.moveTo(bx, ya); joints.lineTo(bx, yb);
        arris.moveTo(bx + jw, yb - jw * 0.5 - bevel * 0.5); arris.lineTo(nx - jw * 0.5, yb - jw * 0.5 - bevel * 0.5);
      }
      joints.moveTo(x0, ya); joints.lineTo(x1, ya);
      ya = yb;
      r++;
    }
    for (let i = 1; i < paths.length; i++) { g.fillStyle = css(fills[i]); g.fill(paths[i]); }
    if (c.hi && res >= FINE) {
      g.strokeStyle = css(faceColour(c.hi, L), 0.85);
      g.lineWidth = bevel;
      g.stroke(arris);
    }
    g.strokeStyle = css(faceColour(c.joint, L));
    g.lineWidth = jw;
    g.stroke(joints);
  };
  return tiled(lay, ALONG * c.len, 2 * P, Math.max(c.len, P) * 2);
}

export interface Rubble {
  /** How high its courses come, least and most, and how long a stone, least and most, in units. */
  rows: [number, number];
  len: [number, number];
  beds: Beds;
  /** The mortar it is bedded in, the paler edge each stone catches along its top, and the line round each. */
  joint: Tone;
  hi?: Tone;
  line?: Tone;
  /** How far the stones stand in from each other, in units. */
  gap?: number;
}

/** A rounded stone from (x, y), `w` by `h`, its corners `r` round. */
function pebble(p: Path2D, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.min(r, w / 2, h / 2);
  p.moveTo(x + q, y);
  p.arcTo(x + w, y, x + w, y + h, q);
  p.arcTo(x + w, y + h, x, y + h, q);
  p.arcTo(x, y + h, x, y, q);
  p.arcTo(x, y, x + w, y, q);
  p.closePath();
}

/**
 * Rubble, roughly coursed: the face in mortar, and on it rounded stones of
 * every length in courses of every height, each one of the beds, each with
 * a paler top where it catches the light.
 */
export function rubble(c: Rubble): BridgePainter {
  const gap = c.gap ?? 0.5;
  const CYC = 8, C = 2;
  const rowAt = (r: number): number => c.rows[0] + hash(r, 3) * (c.rows[1] - c.rows[0]);
  const step = ((c.rows[0] + c.rows[1]) / 2) * CYC;
  const mean = (c.len[0] + c.len[1]) / 2;
  const lay: Lay = (g, L, x0, x1, y0, y1, res) => {
    g.fillStyle = css(faceColour(c.joint, L));
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const fills = c.beds.map(([t]) => faceColour(t, L));
    const paths = c.beds.map(() => new Path2D());
    const tops = new Path2D();
    // Courses eight to a cycle, each its own height and the eight scaled to fill it.
    for (let cyc = Math.floor(y0 / step); cyc * step < y1; cyc++) {
      const cc = ((cyc % C) + C) % C;
      let sum = 0;
      for (let j = 0; j < CYC; j++) sum += rowAt(cc * CYC + j);
      let ya = cyc * step;
      for (let j = 0; j < CYC; j++) {
        const r = cc * CYC + j;
        const yb = ya + (rowAt(r) * step) / sum;
        if (yb > y0 && ya < y1) {
          const off = hash(r, 9) * mean;
          for (let q = Math.floor((x0 - off) / mean) - 1; ; q++) {
            const bx = off + q * mean;
            if (bx > x1) break;
            const qq = ((q % ALONG) + ALONG) % ALONG;
            const w = Math.min(mean * 1.45, c.len[0] + hash(r, qq, 5) * (c.len[1] - c.len[0]));
            if (bx + w < x0) continue;
            const dy = (hash(r, qq, 6) - 0.5) * gap;
            const sh = Math.max(0.6, yb - ya - gap * (1 + hash(r, qq, 8)));
            const sy = ya + gap * 0.5 + Math.max(0, dy);
            pebble(paths[pick(c.beds, hash(r, qq, 2))], bx + gap * 0.5, sy, w - gap, sh, Math.min(1.6, sh * 0.45));
            tops.moveTo(bx + gap + 0.6, sy + sh - 0.35);
            tops.lineTo(bx + w - gap - 0.6, sy + sh - 0.35);
          }
        }
        ya = yb;
      }
    }
    for (let i = 0; i < paths.length; i++) { g.fillStyle = css(fills[i]); g.fill(paths[i]); }
    if (c.hi && res >= FINE) {
      g.strokeStyle = css(faceColour(c.hi, L), 0.8);
      g.lineWidth = 0.4;
      g.stroke(tops);
    }
    if (c.line) {
      g.strokeStyle = css(faceColour(c.line, L), 0.55);
      g.lineWidth = 0.3;
      for (const p of paths) g.stroke(p);
    }
  };
  return tiled(lay, ALONG * mean, C * step, Math.max(c.len[1], c.rows[1]) * 2);
}

export interface Voussoirs {
  /** How wide a voussoir is at its foot, in units, and how much one differs from the next, as a share. */
  width: number;
  wander?: number;
  beds: Beds;
  joint: Tone;
  jointW?: number;
  /** What the underside of the arch is laid in. */
  soffit: BridgePainter;
  /** The beds strictly turn about, rather than as they fall. */
  alternate?: boolean;
  /** Rubble: each stone its own length out from the arch, by as much as this share of the ring, the mortar showing past the short ones. */
  ragged?: number;
}

/**
 * An arch ring in voussoirs: wedges that follow the arch out from its
 * underside, an odd number so that one stands at the crown, turn about in
 * the beds; the underside of the vault laid as `soffit` says.
 */
export function voussoirs(c: Voussoirs): BridgePainter {
  const wander = c.wander ?? 0;
  const jw = c.jointW ?? 0.45;
  return (g, k, f, st) => {
    const pf = f as Placed;
    if (pf.soffit || !pf.arc) { c.soffit(g, k, f, st); return; }
    const { cx, cy, ax, ay, th0, th1 } = pf.arc;
    const [x0, x1] = ext(f);
    // The ring's length round, and so how many stones.
    let len = 0;
    const N = 24;
    for (let i = 0; i < N; i++) {
      const a = th0 + ((th1 - th0) * i) / N, b = th0 + ((th1 - th0) * (i + 1)) / N;
      len += Math.hypot(ax * (Math.cos(b) - Math.cos(a)), ay * (Math.sin(b) - Math.sin(a)));
    }
    let n = Math.max(3, Math.round(len / c.width));
    if (n % 2 === 0) n++;
    const D = (f.y1 - f.y0) * 3 + 8;
    const pt = (th: number): [number, number, number, number] => {
      const px = cx + ax * Math.cos(th), py = cy + ay * Math.sin(th);
      let nx = Math.cos(th) / Math.max(1e-6, ax), ny = Math.sin(th) / Math.max(1e-6, ay);
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      return [px, py, px + nx * D, py + ny * D];
    };
    const seed = Math.round(cx * 3 + cy * 7);
    // Where each joint falls, wandering a little but never across the next.
    const th = (i: number): number => {
      if (i <= 0) return th0;
      if (i >= n) return th1;
      const w = (hash(seed, i, 4) - 0.5) * wander;
      return th0 + ((th1 - th0) * (i + w)) / n;
    };
    const fills = c.beds.map(([t]) => faceColour(t, k.L));
    const paths = c.beds.map(() => new Path2D());
    const joints = new Path2D();
    const ring = st.ringDepth ?? 3.2;
    if (c.ragged) {
      g.fillStyle = css(faceColour(c.joint, k.L));
      g.fillRect(x0 - 1, f.y0 - 1, x1 - x0 + 2, f.y1 - f.y0 + 2);
    }
    for (let i = 0; i < n; i++) {
      let a = pt(th(i)), b = pt(th(i + 1));
      if (c.ragged) {
        const out = ring * (1 - c.ragged + hash(seed, i, 6) * c.ragged * 1.6);
        const cut2 = (q: [number, number, number, number]): [number, number, number, number] => {
          const l = Math.hypot(q[2] - q[0], q[3] - q[1]) || 1;
          return [q[0], q[1], q[0] + ((q[2] - q[0]) / l) * out, q[1] + ((q[3] - q[1]) / l) * out];
        };
        a = cut2(a);
        b = cut2(b);
      }
      const lo = Math.min(a[0], a[2], b[0], b[2]), hi = Math.max(a[0], a[2], b[0], b[2]);
      if (hi < x0 - 1 || lo > x1 + 1) continue;
      const mid = i === (n - 1) / 2;
      const bi = mid ? 0 : c.alternate ? i % c.beds.length : i % 2 === 0 ? pick(c.beds, hash(seed, i, 2)) : (pick(c.beds, hash(seed, i, 3)) + 1) % c.beds.length;
      const p = paths[bi];
      if (c.ragged) {
        // A rounded wedge: its outer end bowed, its joints pulled in a hair either side.
        const ix = (b[0] - a[0]) * 0.06, iy = (b[1] - a[1]) * 0.06;
        p.moveTo(a[0] + ix, a[1] + iy); p.lineTo(b[0] - ix, b[1] - iy); p.lineTo(b[2] - ix, b[3] - iy);
        p.quadraticCurveTo((a[2] + b[2]) / 2 + (a[2] - a[0] + b[2] - b[0]) * 0.08, (a[3] + b[3]) / 2 + (a[3] - a[1] + b[3] - b[1]) * 0.08, a[2] + ix, a[3] + iy);
        p.closePath();
      } else {
        p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); p.lineTo(b[2], b[3]); p.lineTo(a[2], a[3]); p.closePath();
        joints.moveTo(a[0], a[1]); joints.lineTo(a[2], a[3]);
        if (i === n - 1) { joints.moveTo(b[0], b[1]); joints.lineTo(b[2], b[3]); }
      }
    }
    for (let i = 0; i < paths.length; i++) { g.fillStyle = css(fills[i]); g.fill(paths[i]); }
    g.strokeStyle = css(faceColour(c.joint, k.L));
    g.lineWidth = jw;
    g.stroke(joints);
  };
}

/** The glyph of `rune` drawn upright on the screen at (x, y) of a face's frame, `s` its half height. */
export function upright(g: Ctx, f: Placed, rune: string, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  if (f.flip) g.scale(-1, 1);
  glyphPath(g, rune, 0, 0, s);
  g.restore();
}

/** A rune cut in a keystone and inlaid in gold, as large as the stone will take, upright however the face lies. */
export function keystone(rune: string, size = 0.42): BridgePainter {
  return (g, k, f) => {
    const pf = f as Placed;
    const [x0, x1, y0, y1] = ext(f);
    const x = (x0 + x1) / 2, y = (y0 + y1) / 2, s = Math.min(x1 - x0, y1 - y0) * size;
    const path = (): void => upright(g, pf, rune, x, y, s);
    cut(g, k.fill, s * 0.42, path);
    path();
    g.strokeStyle = RUNE_GOLD;
    g.lineWidth = s * 0.22;
    g.lineCap = 'round';
    g.stroke();
  };
}

/** The rune line along a coping's outer face: a groove with gold laid in it, the rune upright along it every `every` units. */
export function runeBand(rune: string, every = 12): BridgePainter {
  return (g, k, f) => {
    const pf = f as Placed;
    const [x0, x1, y0, y1] = ext(f);
    const y = (y0 + y1) / 2;
    g.strokeStyle = css(mix(k.fill, hex('#5a4e5e'), 0.35), 0.8);
    g.lineWidth = 0.34;
    g.beginPath(); g.moveTo(x0 - 1, y); g.lineTo(x1 + 1, y); g.stroke();
    g.strokeStyle = css(mix(hex(RUNE_GOLD), hex(RUNE_WHITE), 0.3), 0.8);
    g.lineWidth = 0.16;
    g.stroke();
    const s = Math.min(0.55, (y1 - y0) * 0.3);
    for (let x = Math.ceil(x0 / every) * every; x < x1; x += every) {
      upright(g, pf, rune, x, y, s);
      g.strokeStyle = css(hex(RUNE_GOLD), 0.85);
      g.lineWidth = 0.14;
      g.stroke();
    }
  };
}

/** A coping's or a cornice's moulding: a paler arris along its top, a shadow line under its nose, and its stones' joints. */
export function moulding(o: { joint: Tone; hi: Tone; len: number; rune?: string; wide?: BridgePainter }): BridgePainter {
  const band = o.rune ? runeBand(o.rune) : null;
  return (g, k, f, st) => {
    const [x0, x1, y0, y1] = ext(f);
    const h = y1 - y0;
    // A top as wide as a lane, as the course between two tiers of arches is, is paved as `wide` says.
    if (h >= 12 && o.wide) { o.wide(g, k, f, st); return; }
    if (h > 0.5 && h < 12 && x1 - x0 > 0) {
      g.strokeStyle = css(faceColour(o.hi, k.L), 0.9);
      g.lineWidth = Math.min(0.6, h * 0.16);
      g.beginPath(); g.moveTo(x0 - 1, y1 - h * 0.12); g.lineTo(x1 + 1, y1 - h * 0.12); g.stroke();
      g.strokeStyle = css(faceColour(o.joint, k.L), 0.8);
      g.lineWidth = Math.min(0.5, h * 0.12);
      g.beginPath(); g.moveTo(x0 - 1, y0 + h * 0.28); g.lineTo(x1 + 1, y0 + h * 0.28); g.stroke();
      const joints = new Path2D();
      for (let x = Math.floor(x0 / o.len) * o.len; x <= x1; x += o.len) { joints.moveTo(x, y0 - 1); joints.lineTo(x, y1 + 1); }
      g.lineWidth = 0.4;
      g.strokeStyle = css(faceColour(o.joint, k.L));
      g.stroke(joints);
    }
    if (band && f.role === 'cap' && h < 12) band(g, k, f, st);
  };
}

/* ---- building -------------------------------------------------------------------------------------- */

/** The info for a face from (x0, y0) to (x1, y1). */
export const infoOf = (role: Role, x0: number, x1: number, y0: number, y1: number, seed: number): FaceInfo => ({ role, x0, x1, y0, y1, seed });

/** A box as the core's (`box`), but its top painted as `top` rather than as a cap, or not at all. */
export function block(k: Kit, part: Part3, s0: number, s1: number, t0: number, t1: number, z0: number, z1: number, tone: Tone, role: Role, top: Role | null, order?: number): void {
  const { sl } = k;
  const a = Math.max(s0, sl.s0), b = Math.min(s1, sl.s1), c = Math.max(t0, sl.t0), d = Math.min(t1, sl.t1);
  if (b - a < 1e-4 || d - c < 1e-4 || z1 - z0 < 1e-4) return;
  k.solid(part, order);
  const seed = Math.round(s0 * 97 + t0 * 13);
  const E = 1e-6;
  if (top) k.face(part, [[a, c, z1], [b, c, z1], [b, d, z1], [a, d, z1]], [0, 0, 1], tone, infoOf(top, 0, 0, 0, 0, seed), { o: [0, 0, z1], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
  else k.face(part, [[a, c, z1], [b, c, z1], [b, d, z1], [a, d, z1]], [0, 0, 1], tone);
  if (Math.abs(a - s0) < E) k.face(part, [[a, c, z0], [a, d, z0], [a, d, z1], [a, c, z1]], [-1, 0, 0], tone, infoOf(role, 0, 0, 0, 0, seed), { o: [a, 0, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
  if (Math.abs(b - s1) < E) k.face(part, [[b, c, z0], [b, d, z0], [b, d, z1], [b, c, z1]], [1, 0, 0], tone, infoOf(role, 0, 0, 0, 0, seed), { o: [b, 0, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
  if (Math.abs(c - t0) < E) k.face(part, [[a, c, z0], [b, c, z0], [b, c, z1], [a, c, z1]], [0, -1, 0], tone, infoOf(role, 0, 0, 0, 0, seed), { o: [0, c, 0], a: [1 / U, 0, 0], b: [0, 0, 1] });
  if (Math.abs(d - t1) < E) k.face(part, [[a, d, z0], [b, d, z0], [b, d, z1], [a, d, z1]], [0, 1, 0], tone, infoOf(role, 0, 0, 0, 0, seed), { o: [0, d, 0], a: [1 / U, 0, 0], b: [0, 0, 1] });
}

/** The runs of parapet along a slice: the slice less the refuges' gaps. */
export function runsOf(plan: Plan, sl: Slice): Array<[number, number]> {
  let runs: Array<[number, number]> = [[sl.s0, sl.s1]];
  for (const [g0, g1] of refugeGaps(plan)) {
    runs = runs.flatMap(([a, b]): Array<[number, number]> => {
      if (g1 <= a || g0 >= b) return [[a, b]];
      const out: Array<[number, number]> = [];
      if (g0 > a + 0.02) out.push([a, g0]);
      if (g1 < b - 0.02) out.push([g1, b]);
      return out;
    });
  }
  return runs;
}

/** The wall frame of an outer face at `t`, looking out along `out`: `x` along the bridge, `y` up. */
export const wallFrame = (t: number, out: number): { o: L; a: L; b: L } => ({ o: [0, t, 0], a: [out > 0 ? 1 / U : -1 / U, 0, 0], b: [0, 0, 1] });

export interface Wall {
  /** Across the bridge, its outer face and its inner. */
  tOut: number;
  tIn: number;
  edge: number;
  /** Its foot and its top along the bridge. */
  foot: (s: number) => number;
  top: (s: number) => number;
  tone: Tone;
  role: Role;
  order: number;
}

/** A wall along a run from `sa` to `sb`: its two faces, its top and its ends where a refuge breaks it. */
export function wallRun(k: Kit, part: Part3, sa: number, sb: number, w: Wall, step: number, withTop = true): void {
  const { sl } = k;
  const xs = samples(sa, sb, [], step);
  const [t0, t1] = w.tOut < w.tIn ? [w.tOut, w.tIn] : [w.tIn, w.tOut];
  k.solid(part, w.order);
  for (let j = 0; j + 1 < xs.length; j++) {
    const a = xs[j], b = xs[j + 1];
    for (const [t, out] of [[w.tOut, w.edge], [w.tIn, -w.edge]] as Array<[number, number]>) {
      k.face(part, [[a, t, w.foot(a)], [b, t, w.foot(b)], [b, t, w.top(b)], [a, t, w.top(a)]], [0, out, 0], w.tone,
        infoOf(w.role, 0, 0, 0, 0, sl.i * 3 + (out > 0 ? 1 : 0)), wallFrame(t, out));
    }
    if (withTop) k.face(part, [[a, t0, w.top(a)], [b, t0, w.top(b)], [b, t1, w.top(b)], [a, t1, w.top(a)]], [0, 0, 1], w.tone);
  }
  for (const [s, dirn] of [[sa, -1], [sb, 1]] as Array<[number, number]>) {
    if ((dirn < 0 && sa <= sl.s0 + 1e-6) || (dirn > 0 && sb >= sl.s1 - 1e-6)) continue;
    k.face(part, [[s, t0, w.foot(s)], [s, t1, w.foot(s)], [s, t1, w.top(s)], [s, t0, w.top(s)]], [dirn, 0, 0], w.tone);
  }
}

/** A coping along a run: its top and its two faces, overhanging `over` either side, its rune line glowing. */
export function copingRun(k: Kit, part: Part3, sa: number, sb: number, edge: number, t0: number, t1: number, z: (s: number) => number, h: number, over: number, tone: Tone, step: number, order = 2, role: Role = 'cap'): void {
  const { sl } = k;
  const xs = samples(sa, sb, [], step);
  const c0 = t0 - over, c1 = t1 + over;
  const tOut = edge > 0 ? c1 : c0;
  k.solid(part, order);
  for (let j = 0; j + 1 < xs.length; j++) {
    const a = xs[j], b = xs[j + 1];
    k.face(part, [[a, c0, z(a) + h], [b, c0, z(b) + h], [b, c1, z(b) + h], [a, c1, z(a) + h]], [0, 0, 1], tone,
      infoOf(role, 0, 0, 0, 0, sl.i), { o: [0, 0, z(0) + h], a: [1 / U, 0, (z(1) - z(0)) / U], b: [0, 1 / U, 0] });
    for (const [t, out] of [[c1, 1], [c0, -1]] as Array<[number, number]>) {
      k.face(part, [[a, t, z(a)], [b, t, z(b)], [b, t, z(b) + h], [a, t, z(a) + h]], [0, out, 0], tone,
        infoOf(role, 0, 0, 0, 0, sl.i), wallFrame(t, out));
    }
    k.glow.lines.push([k.m([a, tOut + edge * 0.004, z(a) + h * 0.5]), k.m([b, tOut + edge * 0.004, z(b) + h * 0.5])]);
  }
  for (const [s, dirn] of [[sa, -1], [sb, 1]] as Array<[number, number]>) {
    if ((dirn < 0 && sa <= sl.s0 + 1e-6) || (dirn > 0 && sb >= sl.s1 - 1e-6)) continue;
    k.face(part, [[s, c0, z(s)], [s, c1, z(s)], [s, c1, z(s) + h], [s, c0, z(s) + h]], [dirn, 0, 0], tone);
  }
}

/**
 * A keystone at the crown of every arch in the slice, larger than the core's
 * and standing proud of it, so the rune cut in it reads at the far zoom; its
 * rune glows at night at its own size.
 */
export function keystones(k: Kit, w: number, below: number, above: number): void {
  const { plan, sl, st } = k;
  const ringD = st.ringDepth ?? 3.2;
  for (const edge of sl.edges) {
    const t = edge > 0 ? sl.t1 : sl.t0;
    for (const bay of plan.bays) {
      for (const crown of [bay.crown, bay.lowerCrown]) {
        if (crown === undefined) continue;
        if (ownerOf(k, bay.c - w, bay.c + w) === null) continue;
        k.solid('front', k.ord(edge, 0.85));
        const tk = t + edge * 0.036;
        // Up to the cornice band under the deck, which would hide its head.
        const z0 = crown - below, z1 = Math.min(crown + ringD + above, plan.deck(bay.c) - plan.thick - 1.45);
        const ks = [bay.c - w, bay.c + w];
        k.face('front', [[ks[0], tk, z0], [ks[1], tk, z0], [ks[1], tk, z1], [ks[0], tk, z1]], [0, edge, 0], st.ring,
          infoOf('key', 0, 0, 0, 0, Math.round(bay.c * 10)), wallFrame(tk, edge));
        for (const s of ks) k.face('front', [[s, t, z0], [s, tk, z0], [s, tk, z1], [s, t, z1]], [s < bay.c ? -1 : 1, 0, 0], st.ring);
        k.face('front', [[ks[0], t, z1], [ks[1], t, z1], [ks[1], tk, z1], [ks[0], tk, z1]], [0, 0, 1], st.ring);
        k.face('front', [[ks[0], t, z0], [ks[1], t, z0], [ks[1], tk, z0], [ks[0], tk, z0]], [0, 0, -1], st.ring);
        k.glow.runes.push({ at: k.m([bay.c, tk, (z0 + z1) / 2]), s: (Math.min(w * 2 * U, z1 - z0) * 0.42) / 2.25, glyph: st.rune });
      }
    }
  }
}

/** The core's arches, their keystones replaced by `keystones`: the core's runes taken out of the night's glow for the new ones. */
export function archesKeyed(w: number, below: number, above: number): Builders['arches'] {
  return (k) => {
    const before = k.glow.runes.length;
    // The core's keystone, every face of it within its width of a crown and its height of the ring, is not laid at all.
    const ringD = k.st.ringDepth ?? 3.2;
    const crowns = k.plan.bays.flatMap((b) => [[b.c, b.crown], ...(b.lowerCrown === undefined ? [] : [[b.c, b.lowerCrown]])]);
    const face: Kit['face'] = (part, pts, out, tone, info, frame) => {
      const key = crowns.some(([c, z]) => pts.every((p) => Math.abs(p[0] - c) < 0.0701 && p[2] >= z - 0.61 && p[2] <= z + ringD + 0.81));
      if (!key) k.face(part, pts, out, tone, info, frame);
    };
    BUILDERS.arches({ ...k, face });
    k.glow.runes.splice(before);
    keystones(k, w, below, above);
  };
}

/** A newel at an abutment, as the core's but its own: plinth, shaft, a cap overhanging it and a finial turned on that. */
export function newelPost(k: Kit, part: Part3, s: number, t: number, z: number, o: { shaft: number; half: number; tone: Tone; trim: Tone; finial: Tone; profile: ReadonlyArray<[number, number]>; crenel?: boolean }): void {
  const h = o.half;
  if (ownerOf(k, s - h - 0.02, s + h + 0.02) === null) return;
  block(k, part, s - h - 0.015, s + h + 0.015, t - h - 0.015, t + h + 0.015, z, z + 2.4, o.trim, 'plinth', null, 3);
  block(k, part, s - h, s + h, t - h, t + h, z + 2.4, z + o.shaft, o.tone, 'post', null, 3.1);
  block(k, part, s - h - 0.018, s + h + 0.018, t - h - 0.018, t + h + 0.018, z + o.shaft, z + o.shaft + 1.8, o.trim, 'plinth', null, 3.2);
  const top = z + o.shaft + 1.8;
  if (o.crenel) {
    // Four little merlons at its corners.
    const m = h * 0.55;
    for (const [ds, dt] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>) {
      const cs = s + ds * (h - m / 2 + 0.008), ct = t + dt * (h - m / 2 + 0.008);
      block(k, part, cs - m / 2, cs + m / 2, ct - m / 2, ct + m / 2, top, top + 2.6, o.tone, 'parapet', null, 3.25);
    }
  }
  turned(k, part, s, t, top, o.profile, 8, o.finial, 3.3);
}

/* ---- stone brick --------------------------------------------------------------------------------------- */

/** The house's shade, by channel: a lilac dusk on a cool stone. */
const DUSK: [number, number, number] = [0.775, 0.775, 0.84];
const t = (h: string): Tone => houseTone(h, DUSK);

/** The blue stone and its beds, as the house's field (`STONE_PASTEL`). */
const FIELD = t('#aeb2c0');
const STONE_BEDS: Beds = [[FIELD, 5], [t('#bbb5ad'), 1.4], [t('#9da4b7'), 1.2], [t('#bdb0a0'), 0.5], [t('#a3a7b5'), 1.2], [t('#bcc0cc'), 1]];
const STONE_JOINT = t('#8c8e9c');
/** Under an arch: the field's beds, fewer of the odd ones. */
const SOFFIT_BEDS: Beds = [[FIELD, 6], [t('#a3a7b5'), 2], [t('#b4b3b4'), 1], [t('#bcc0cc'), 1]];
const STONE_HI = t('#c2c6d2');
/** The limestone it is dressed in, and its paler and deeper stones. */
const DRESS = t('#d8cfbc');
const DRESS_BEDS: Beds = [[DRESS, 3], [t('#cdc2ad'), 2], [t('#e2dacb'), 1.5]];
const DRESS_JOINT = t('#a99f8c');
const DRESS_HI = t('#e7e0d2');
const BAND = t('#d3c9b5');
/** The floor it is paved in (`flooring.ts`). */
const FLOOR = t('#c3c5cd');
const FLOOR_BEDS: Beds = [[FLOOR, 3], [t('#bbbec8'), 2], [t('#c9c6bd'), 2], [t('#b5b9c4'), 2], [t('#cdcbc3'), 1]];

const RUNE = 'algiz';

const wall = coursed({ rows: [3.6, 3.6, 3.6], len: 9, beds: STONE_BEDS, joint: STONE_JOINT, hi: STONE_HI });
const deck = coursed({ rows: [13.33], len: 20, wander: 0.15, beds: FLOOR_BEDS, joint: t('#8a8c98'), hi: t('#e1e3e9'), jointW: 0.6, bevel: 0.6 });

/** The crenellated parapet: a wall to the embrasures, a coping along it, and merlons on that, each capped. */
const LOW = 5.4;
const COPE = 1.4;
const MERLON = 5.6;
const MCAP = 1.2;
function crenelParapet(k: Kit, edge: number, part: Part3): void {
  const { plan, sl, st } = k;
  const T = 0.09;
  const tOut = edge > 0 ? sl.t1 : sl.t0;
  const tIn = tOut - edge * T;
  const [t0, t1] = edge > 0 ? [tIn, tOut] : [tOut, tIn];
  const deckAt = plan.deck;
  const step = plan.ramp ? 1 / 3 : 1;
  for (const [sa, sb] of runsOf(plan, sl)) {
    wallRun(k, part, sa, sb, { tOut, tIn, edge, foot: deckAt, top: (s) => deckAt(s) + LOW, tone: st.stone, role: 'parapet', order: 1 }, step, false);
    copingRun(k, part, sa, sb, edge, t0, t1, (s) => deckAt(s) + LOW, COPE, 0.014, st.trim, step);
    // Merlons, two a tile, a quarter of a tile long, standing on the coping.
    for (let m = Math.floor(sa * 2) / 2 + 0.125; m < sb; m += 0.5) {
      const m0 = Math.max(m, sa), m1 = Math.min(m + 0.25, sb);
      if (m1 - m0 < 0.06) continue;
      const lo = Math.min(deckAt(m0), deckAt(m1)) + LOW + COPE, hi = Math.max(deckAt(m0), deckAt(m1)) + LOW + COPE + MERLON;
      block(k, part, m0, m1, t0 + 0.004, t1 - 0.004, lo - 0.2, hi, st.stone, 'parapet', null, 2.5);
      block(k, part, m0 - 0.012, m1 + 0.012, t0 - 0.008, t1 + 0.008, hi, hi + MCAP, st.trim, 'cornice', null, 2.6);
    }
  }
}

/** Over each pier of a bridge two lanes wide or more: the core's refuge, a merlon at each front corner of it. */
function crenelRefuges(k: Kit): void {
  BUILDERS.refuges(k);
  const { plan, sl, st } = k;
  for (const p of plan.piers) {
    if (p.end) continue;
    for (const edge of sl.edges) {
      const tt = edge > 0 ? sl.t1 : sl.t0;
      const out = 0.17, w = p.half + 0.08, T = 0.07;
      const part: Part3 = edge === sl.near ? 'rail' : 'front';
      const z = plan.deck(p.s);
      const [ta, tb] = edge > 0 ? [tt, tt + out] : [tt - out, tt];
      const k2: Kit = { ...k, sl: { ...sl, t0: Math.min(sl.t0, ta), t1: Math.max(sl.t1, tb) } };
      const f0 = edge > 0 ? tb - T : ta, f1 = f0 + T;
      const H = st.parapetHeight ?? 10;
      for (const [m0, m1] of [[p.s - w, p.s - w + 0.13], [p.s + w - 0.13, p.s + w]]) {
        if (ownerOf(k2, m0, m1) === null) continue;
        block(k2, part, m0, m1, f0, f1, z + H, z + H + MERLON, st.stone, 'parapet', null, 2.5);
        block(k2, part, m0 - 0.012, m1 + 0.012, f0 - 0.01, f1 + 0.01, z + H + MERLON, z + H + MERLON + MCAP, st.trim, 'cornice', null, 2.6);
      }
    }
  }
}

/** At each end, on each outer edge: a square newel with a merlon at each corner of its cap and a ball finial between. */
function crenelEnds(k: Kit): void {
  const { plan, sl, st } = k;
  for (const edge of sl.edges) {
    const tt = edge > 0 ? sl.t1 - 0.075 : sl.t0 + 0.075;
    const part: Part3 = edge === sl.near ? 'rail' : 'front';
    const o = { shaft: LOW + COPE + MERLON + 1, half: 0.075, tone: st.stone, trim: st.trim, finial: st.ring, crenel: true, profile: [[0, 0.03], [0.8, 0.04], [2.2, 0.05], [3.6, 0.034], [4.4, 0.012], [4.9, 0]] as Array<[number, number]> };
    if (sl.i === 0) newelPost(k, part, 0.075, tt, plan.deck(0.075), o);
    if (sl.i === plan.n - 1) newelPost(k, part, plan.n - 0.075, tt, plan.deck(plan.n - 0.075), o);
  }
}

export const stone_brick: BridgeStyle = framed({
  family: 'stone',
  stone: FIELD,
  ring: DRESS,
  trim: BAND,
  deck: FLOOR,
  parapet: 'crenel',
  parapetHeight: LOW + COPE,
  ringDepth: 4.2,
  rune: RUNE,
  glow: '#bfe8ff',
  paint: {
    wall, pier: wall, parapet: wall, post: wall,
    ring: voussoirs({ width: 4.2, beds: DRESS_BEDS, joint: DRESS_JOINT, soffit: coursed({ rows: [4.2], len: 11, beds: SOFFIT_BEDS, joint: STONE_JOINT }) }),
    key: keystone(RUNE),
    cap: moulding({ joint: DRESS_JOINT, hi: DRESS_HI, len: 12, rune: RUNE, wide: deck }),
    cornice: moulding({ joint: DRESS_JOINT, hi: DRESS_HI, len: 14 }),
    plinth: moulding({ joint: DRESS_JOINT, hi: DRESS_HI, len: 10 }),
    deck, tread: deck,
  },
  build: { parapet: crenelParapet, refuges: crenelRefuges, ends: crenelEnds, arches: archesKeyed(0.11, 2.2, 1.2) },
});
