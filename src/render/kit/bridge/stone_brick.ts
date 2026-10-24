import { cut, glyphPath, proj, RUNE_GOLD, RUNE_WHITE } from '../../runestone';
import { css, dot, faceColour, hex, mix, type Ctx, type RGB, type Tone, type V3 } from '../core';
import {
  bayAt, BUILDERS, ownerOf, REFUGE_OUT, refugeGaps, refugeOutline, samples, turned, U, wallEnds,
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
 * `framed`, which tells every painter whether its face lies mirrored and,
 * for an arch ring, the arch it is on.
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
  /** A tread: where its nosing is along its frame's `x`, and which way the tread runs back from it. */
  nose?: number;
  inward?: number;
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
  // A lower arch of two tiers may be narrower than its bay (`lowerHalf`).
  const A = (upper ? bay.a : bay.lowerHalf ?? bay.a) * U;
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

/** How far round an arch `f` it is from its crown at `c` to `s`, in units: less than nought on the near side of the crown. */
function arcLength(f: (s: number) => number, c: number, s: number): number {
  const n = 16;
  let len = 0;
  for (let i = 0; i < n; i++) {
    const p = c + ((s - c) * i) / n, q = c + ((s - c) * (i + 1)) / n;
    len += Math.hypot((q - p) * U, f(q) - f(p));
  }
  return s < c ? -len : len;
}

/** A kit whose faces reach their painters with which way their frames lie, an arch ring's arch, and a frame for the underside of a vault. */
function framedKit(k: Kit): Kit {
  const face: Kit['face'] = (part, pts, out, tone, info, frame) => {
    let inf: Placed | undefined = info;
    let fr = frame;
    if (inf && !fr && inf.role === 'ring' && pts.length === 4) {
      // The underside of an arch: `x` across the bridge, `y` round the arch from its crown, so its courses keep their width down to the spring.
      const [a, b] = [pts[0], pts[1]];
      const ds = b[0] - a[0], dz = b[2] - a[2];
      const chord = Math.hypot(ds * U, dz);
      if (chord > 1e-6) {
        const bay = bayAt(k.plan, (a[0] + b[0]) / 2);
        const f = bay.lower && Math.abs(bay.lower(a[0]) - a[2]) < 0.05 ? bay.lower : bay.arch;
        const round = arcLength(f, bay.c, a[0]);
        const dir: L = [ds / chord, 0, dz / chord];
        fr = { o: [a[0] - dir[0] * round, 0, a[2] - dir[2] * round], a: [0, 1 / U, 0], b: dir };
        inf = { ...inf, soffit: true };
      }
    }
    if (inf && fr) {
      // Its run in its frame the core works out from its points; here, whether the frame lies mirrored on the screen, for a rune cut in it to be turned back.
      inf = { ...inf, flip: mirrored(k, fr), sx: Math.abs(fr.a[0]) > 1e-9 ? Math.sign(fr.a[0]) : 0 };
      if (inf.role === 'ring' && !inf.soffit) inf.arc = arcOf(k.plan, fr, pts[0][0], pts[1][0], pts[0][1], pts[0][2]);
      if (inf.role === 'tread') {
        // Its nosing is at its low end going up, the high end going down.
        const a = pts[0][0], b = pts[1][0];
        const up = k.plan.deck(b) >= k.plan.deck(a);
        const [xn] = inFrame(fr, [up ? a : b, pts[0][1], pts[0][2]]), [xb] = inFrame(fr, [up ? b : a, pts[0][1], pts[0][2]]);
        inf.nose = xn;
        inf.inward = Math.sign(xb - xn);
      }
    }
    k.face(part, pts, out, tone, inf, fr);
  };
  return { ...k, face };
}

/** Whether a frame lies mirrored on the screen: its `x` turned to the left of its `y`, which runs up. */
function mirrored(k: Kit, fr: { o: L; a: L; b: L }): boolean {
  const o = proj(k.e, k.m(fr.o));
  const add3 = (d: L): L => [fr.o[0] + d[0] * 10, fr.o[1] + d[1] * 10, fr.o[2] + d[2] * 10];
  const a = proj(k.e, k.m(add3(fr.a))), b = proj(k.e, k.m(add3(fr.b)));
  // On the screen y runs down: a frame the right way round turns from `x` to `y` against the clock.
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]) > 0;
}

/** A style whose builders lay their faces through `framedKit`. */
export function framed(st: BridgeStyle, o: { riser?: Tone } = {}): BridgeStyle {
  const own = st.build ?? {};
  const wrap = <K extends keyof Builders>(key: K): Builders[K] => {
    const fn = (own[key] ?? BUILDERS[key]) as (k: Kit, ...rest: never[]) => void;
    return ((k: Kit, ...rest: never[]) => fn(framedKit(k), ...rest)) as Builders[K];
  };
  // A ramp's risers, the only faces of the deck turned along the bridge, in a tone of their own so each tread stands off the next.
  const deck: Builders['deck'] = (k) => {
    const fk = framedKit(k);
    const face: Kit['face'] = (part, pts, out, tone, info, frame) =>
      fk.face(part, pts, out, o.riser && !info && out[1] === 0 && out[2] === 0 ? o.riser : tone, info, frame);
    (own.deck ?? BUILDERS.deck)({ ...fk, face });
  };
  return {
    ...st,
    build: { ...own, deck, arches: wrap('arches'), parapet: wrap('parapet'), ends: wrap('ends'), refuges: wrap('refuges') },
  };
}

/** A tread laid as `lay` says, the stone along its nosing paler and a shadow line at its very edge, so a flight reads step by step. */
export function treadPaint(lay: BridgePainter, nose: Tone, shade: Tone): BridgePainter {
  return (g, k, f, st) => {
    lay(g, k, f, st);
    const pf = f as Placed;
    if (pf.nose === undefined || !pf.inward) return;
    const [, , y0, y1] = ext(f);
    const x = pf.nose, d = pf.inward;
    g.fillStyle = css(faceColour(nose, k.L));
    g.fillRect(Math.min(x, x + d * 2.4), y0 - 1, 2.4, y1 - y0 + 2);
    g.strokeStyle = css(faceColour(shade, k.L), 0.9);
    g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x + d * 2.4, y0 - 1); g.lineTo(x + d * 2.4, y1 + 1); g.stroke();
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
      g.strokeStyle = css(faceColour(c.line, L), 0.7);
      g.lineWidth = 0.32;
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
  /** And each stone rounded off, as a field stone is, the line round it in this tone. */
  rough?: Tone;
}

/** A closed outline through the midpoints of `pts`, each corner rounded off: a field stone. */
function roundStone(p: Path2D, pts: ReadonlyArray<readonly [number, number]>): void {
  const n = pts.length;
  const mid = (i: number): [number, number] => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  p.closePath();
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
      if (c.rough) {
        // A field stone: pulled in from its neighbours, its corners worn round, a bulge on its outer end.
        const ix = (b[0] - a[0]) * 0.1, iy = (b[1] - a[1]) * 0.1;
        const ox = (b[2] - a[2]) * 0.1, oy = (b[3] - a[3]) * 0.1;
        const bulge = 0.12 + hash(seed, i, 7) * 0.12;
        const cx2 = (a[2] + b[2]) / 2 + (a[2] - a[0] + b[2] - b[0]) * bulge * 0.5, cy2 = (a[3] + b[3]) / 2 + (a[3] - a[1] + b[3] - b[1]) * bulge * 0.5;
        roundStone(p, [[a[0] + ix, a[1] + iy], [b[0] - ix, b[1] - iy], [b[2] - ox, b[3] - oy], [cx2, cy2], [a[2] + ox, a[3] + oy]]);
      } else if (c.ragged) {
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
    if (c.rough) {
      g.strokeStyle = css(faceColour(c.rough, k.L), 0.7);
      g.lineWidth = 0.32;
      for (const p of paths) g.stroke(p);
    }
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
  // As large as the stone allows, its gold a third again as broad as the core's so it holds at the far zoom.
  return (g, k, f) => {
    const pf = f as Placed;
    const [x0, x1, y0, y1] = ext(f);
    const x = (x0 + x1) / 2, y = (y0 + y1) / 2, s = Math.min(x1 - x0, y1 - y0) * size;
    const path = (): void => upright(g, pf, rune, x, y, s);
    cut(g, k.fill, s * 0.42, path);
    path();
    g.strokeStyle = RUNE_GOLD;
    g.lineWidth = s * 0.27;
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
  const { sl, plan } = k;
  // Clipped across only at a cut between two lanes, as the core's, so what stands proud of an outer edge keeps its outer face.
  const a = Math.max(s0, sl.s0), b = Math.min(s1, sl.s1);
  const c = sl.t0 > plan.tLo + 1e-6 ? Math.max(t0, sl.t0) : t0, d = sl.t1 < plan.tHi - 1e-6 ? Math.min(t1, sl.t1) : t1;
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
 * and standing proud of it: an upper arch's runs up through the cornice to
 * the deck's edge, as a classical keystone breaks its entablature, so the
 * rune cut in it reads at the far zoom; its rune glows at night at its own size.
 */
export function keystones(k: Kit, w: number, below: number, above: number, tone?: Tone): void {
  const { plan, sl, st } = k;
  const key = tone ?? st.ring;
  const ringD = st.ringDepth ?? 3.2;
  for (const edge of sl.edges) {
    // Not on an outer edge turned from the eye, where it would show through the arches (as the core's rings).
    if (edge * dot(k.P, k.e.toward) < -1e-6) continue;
    const t = edge > 0 ? sl.t1 : sl.t0;
    for (const bay of plan.bays) {
      for (const crown of [bay.crown, bay.lowerCrown]) {
        if (crown === undefined) continue;
        if (ownerOf(k, bay.c - w, bay.c + w) === null) continue;
        const upper = crown === bay.crown;
        // Laid after the cornice, which it stands proud of.
        k.solid('front', k.ord(edge, upper ? 1.05 : 0.85));
        const tk = t + edge * 0.036;
        // Up to the top of the cornice; a lower arch's, to the band of the course over it.
        const z0 = crown - below;
        const z1 = upper ? plan.deck(bay.c) - 0.6 : Math.min(crown + ringD + above, (bay.course ?? Infinity) - 1.7);
        // A wedge, broader at its head than its foot, as a keystone is.
        const lo = [bay.c - w * 0.72, bay.c + w * 0.72], hi = [bay.c - w, bay.c + w];
        k.face('front', [[lo[0], tk, z0], [lo[1], tk, z0], [hi[1], tk, z1], [hi[0], tk, z1]], [0, edge, 0], key,
          infoOf('key', 0, 0, 0, 0, Math.round(bay.c * 10)), wallFrame(tk, edge));
        for (const j of [0, 1]) {
          const side = j ? 1 : -1;
          k.face('front', [[lo[j], t, z0], [lo[j], tk, z0], [hi[j], tk, z1], [hi[j], t, z1]], [side, 0, -side * (hi[j] - lo[j]) * U / (z1 - z0) * side], key);
        }
        k.face('front', [[hi[0], t, z1], [hi[1], t, z1], [hi[1], tk, z1], [hi[0], tk, z1]], [0, 0, 1], key);
        k.face('front', [[lo[0], t, z0], [lo[1], t, z0], [lo[1], tk, z0], [lo[0], tk, z0]], [0, 0, -1], key);
        k.glow.runes.push({ at: k.m([bay.c, tk, (z0 + z1) / 2]), s: (Math.min(w * 2 * U, z1 - z0) * 0.42) / 2.25, glyph: st.rune });
      }
    }
  }
}

/** The core's arches, their keystones replaced by `keystones`: the core's runes taken out of the night's glow for the new ones. */
export function archesKeyed(w: number, below: number, above: number, tone?: Tone): Builders['arches'] {
  return (k) => {
    const before = k.glow.runes.length;
    // The core's keystone, every face of it within its width of a crown and its height of the ring, is not laid at all.
    const ringD = k.st.ringDepth ?? 3.2;
    const crowns = k.plan.bays.flatMap((b) => [[b.c, b.crown], ...(b.lowerCrown === undefined ? [] : [[b.c, b.lowerCrown]])]);
    const face: Kit['face'] = (part, pts, out, tone, info, frame) => {
      const key = crowns.some(([c, z]) => pts.every((p) => Math.abs(p[0] - c) < 0.1 && p[2] >= z - 1.6 && p[2] <= z + ringD + 2));
      if (!key) k.face(part, pts, out, tone, info, frame);
    };
    BUILDERS.arches({ ...k, face });
    k.glow.runes.splice(before);
    keystones(k, w, below, above, tone);
  };
}

/** A newel at an abutment, as the core's but its own: plinth, shaft, a cap overhanging it and a finial turned on that. */
export function newelPost(k: Kit, part: Part3, s: number, t: number, z: number, o: { shaft: number; half: number; tone: Tone; trim: Tone; finial: Tone; profile: ReadonlyArray<[number, number]>; crenel?: boolean }): void {
  const h = o.half;
  // Its run along the bridge, kept to the bridge: at an end there is no slice beyond to own it.
  if (ownerOf(k, Math.max(0, s - h - 0.02), Math.min(k.plan.n, s + h + 0.02)) === null) return;
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

/* ---- refuges ------------------------------------------------------------------------------------------ */

type Pt2 = [number, number];
/** A polygon of the frame cut to a run along the bridge. */
function clipRun(pts: L[], s0: number, s1: number): L[] {
  let out = pts;
  for (const [lim, lo] of [[s0, true], [s1, false]] as Array<[number, boolean]>) {
    const inp = out;
    out = [];
    const keep = (q: L): boolean => (lo ? q[0] >= lim - 1e-6 : q[0] <= lim + 1e-6);
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ia = keep(a), ib = keep(b);
      if (ia) out.push(a);
      if (ia !== ib) {
        const u = (lim - a[0]) / (b[0] - a[0]);
        out.push([lim, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
      }
    }
    if (out.length < 3) return [];
  }
  return out;
}

/** The frame along a segment of the plan from `a` to `b`: `x` a unit along it, `y` up. */
const segFrame = (a: Pt2, b: Pt2): { o: L; a: L; b: L } => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { o: [a[0], a[1], 0], a: [(b[0] - a[0]) / len / U, (b[1] - a[1]) / len / U, 0], b: [0, 0, 1] };
};

/** A refuge's outline as segments, each with its outward normal across the plan, for the outer edge `edge`. */
export interface Seg { a: Pt2; b: Pt2; n: Pt2; len: number }

/**
 * A run of the outline `line` offset `d` inward (less than nought, outward),
 * its corners mitred so the faces of one segment meet the next's, its ends
 * square to the bridge where they meet its parapet.
 */
function offsetLine(segs: Seg[], d: number): Pt2[] {
  const pts: Pt2[] = [];
  for (let i = 0; i <= segs.length; i++) {
    if (i === 0 || i === segs.length) {
      // An end, on the bridge's edge: moved across only.
      const sg = segs[i === 0 ? 0 : segs.length - 1], p = i === 0 ? sg.a : sg.b;
      pts.push([p[0], p[1] - Math.sign(sg.n[1] || 1) * d]);
      continue;
    }
    const n0 = segs[i - 1].n, n1 = segs[i].n;
    const m: Pt2 = [n0[0] + n1[0], n0[1] + n1[1]];
    const ml = Math.hypot(m[0], m[1]) || 1;
    const k = d / Math.max(0.4, (m[0] * n0[0] + m[1] * n0[1]) / ml);
    pts.push([segs[i].a[0] - (m[0] / ml) * k, segs[i].a[1] - (m[1] / ml) * k]);
  }
  return pts;
}

export interface RefugeWall {
  /** The wall to under its coping, and the coping: how high, how far it overhangs, its tone. */
  top: number;
  cope: number;
  over: number;
  thick: number;
  /** What stands on the coping, segment by segment: merlons, stones on edge. */
  crown?: (k: Kit, part: Part3, face: Kit['face'], seg: Seg, inner: Seg, z: number, seed: number, front: boolean) => void;
}

/**
 * Over each pier: the core's refuge platform, corbel and lamp, its parapet
 * laid by the style instead, the same wall and coping as the bridge's own
 * run round the refuge's outline (`refugeOutline`), its rune line along it.
 */
export function refugesOwn(w: RefugeWall): Builders['refuges'] {
  return (k) => {
    // Of the core's refuge only its lamp (its solids laid from order 4): the platform, corbel and parapet are laid here.
    const order: Record<Part3, number | undefined> = { back: undefined, front: undefined, rail: undefined };
    const lines = k.glow.lines.length;
    const solid: Kit['solid'] = (part, o) => { order[part] = o; k.solid(part, o); };
    const face: Kit['face'] = (part, pts, out, tone, info, frame) => { if ((order[part] ?? 0) >= 4) k.face(part, pts, out, tone, info, frame); };
    BUILDERS.refuges({ ...k, solid, face });
    k.glow.lines.splice(lines);
    const { plan, sl, st } = k;
    for (const p of plan.piers) {
      if (p.end) continue;
      for (const edge of sl.edges) {
        const t = edge > 0 ? sl.t1 : sl.t0;
        const line = refugeOutline(plan, p, edge, t);
        if (line[line.length - 1][0] < sl.s0 - 1e-6 || line[0][0] > sl.s1 + 1e-6) continue;
        const part: Part3 = edge === sl.near ? 'rail' : 'front';
        const z = plan.deck(p.s);
        const k2: Kit = { ...k, sl: { ...sl, t0: Math.min(sl.t0, t - REFUGE_OUT - 0.1), t1: Math.max(sl.t1, t + REFUGE_OUT + 0.1) } };
        const clip: Kit['face'] = (q, pts, out, tone, info, frame) => {
          const c = clipRun(pts, sl.s0, sl.s1);
          if (c.length >= 3) k2.face(q, c, out, tone, info, frame);
        };
        const segs: Seg[] = line.slice(0, -1).map((a, q) => {
          const b = line[q + 1];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          // Its normal out of the refuge, away from the deck.
          return { a, b, n: [(-(b[1] - a[1]) / len) * edge, ((b[0] - a[0]) / len) * edge] as Pt2, len };
        });
        const outer = offsetLine(segs, 0), inner = offsetLine(segs, w.thick);
        const co = offsetLine(segs, -w.over), ci = offsetLine(segs, w.thick + w.over);
        const z1 = z + w.top, z2 = z1 + w.cope;
        // The platform, its top the deck's and its edge the cornice's, on a corbel stepping in down onto the cutwater.
        const under = z - plan.thick - 1.4;
        const lo = line.map(([s0, t0]): Pt2 => [p.s + (s0 - p.s) * 0.7, t + (t0 - t) * 0.35]);
        k2.solid('front', k.ord(edge, 0.9));
        clip('front', line.map(([s0, t0]) => [s0, t0, z] as L), [0, 0, 1], st.deck, infoOf('deck', 0, 0, 0, 0, Math.round(p.s * 10)), { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
        for (let q = 0; q < segs.length; q++) {
          const [a, b] = [line[q], line[q + 1]], [ai, bi] = [lo[q], lo[q + 1]], n = segs[q].n;
          clip('front', [[a[0], a[1], under], [b[0], b[1], under], [b[0], b[1], z], [a[0], a[1], z]], [n[0], n[1], 0], st.trim, infoOf('cornice', 0, 0, 0, 0, q), segFrame(a, b));
          clip('front', [[ai[0], ai[1], under - 4.6], [bi[0], bi[1], under - 4.6], [b[0], b[1], under], [a[0], a[1], under]], [n[0], n[1], -0.6], st.stone, infoOf('pier', 0, 0, 0, 0, q), segFrame(ai, bi));
        }
        k2.solid(part, 2);
        for (let q = 0; q < segs.length; q++) {
          const [a, b, ai, bi] = [outer[q], outer[q + 1], inner[q], inner[q + 1]];
          const n = segs[q].n;
          clip(part, [[a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], z1], [a[0], a[1], z1]], [n[0], n[1], 0], st.stone, infoOf('parapet', 0, 0, 0, 0, 11), segFrame(a, b));
          clip(part, [[bi[0], bi[1], z], [ai[0], ai[1], z], [ai[0], ai[1], z1], [bi[0], bi[1], z1]], [-n[0], -n[1], 0], st.stone, infoOf('parapet', 0, 0, 0, 0, 12), segFrame(bi, ai));
        }
        // Its ends where it leaves the bridge's edge, across its thickness: a side seen end on is seen as a wall, not through (`wallEnds`).
        wallEnds(clip, part, outer[0], outer[1], inner[0], inner[1], z, z1, st.stone, 'start');
        wallEnds(clip, part, outer[segs.length - 1], outer[segs.length], inner[segs.length - 1], inner[segs.length], z, z1, st.stone, 'end');
        k2.solid(part, 2.1);
        for (let q = 0; q < segs.length; q++) {
          const [a, b, ai, bi] = [co[q], co[q + 1], ci[q], ci[q + 1]];
          const n = segs[q].n;
          clip(part, [[a[0], a[1], z2], [b[0], b[1], z2], [bi[0], bi[1], z2], [ai[0], ai[1], z2]], [0, 0, 1], st.trim, infoOf('cap', 0, 0, 0, 0, 13),
            { o: [a[0], a[1], z2], a: segFrame(a, b).a, b: [-n[0] / U, -n[1] / U, 0] });
          clip(part, [[a[0], a[1], z1], [b[0], b[1], z1], [b[0], b[1], z2], [a[0], a[1], z2]], [n[0], n[1], 0], st.trim, infoOf('cap', 0, 0, 0, 0, 14), segFrame(a, b));
          clip(part, [[bi[0], bi[1], z1], [ai[0], ai[1], z1], [ai[0], ai[1], z2], [bi[0], bi[1], z2]], [-n[0], -n[1], 0], st.trim);
          clip(part, [[a[0], a[1], z1], [b[0], b[1], z1], [bi[0], bi[1], z1], [ai[0], ai[1], z1]], [0, 0, -1], st.trim);
          if (q === 0) wallEnds(clip, part, a, b, ai, bi, z1, z2, st.trim, 'start');
          if (q === segs.length - 1) wallEnds(clip, part, a, b, ai, bi, z1, z2, st.trim, 'end');
          const mid = (a[0] + b[0]) / 2;
          if (mid >= sl.s0 && mid < sl.s1) {
            const g = (pt: Pt2): V3 => k.m([pt[0] + n[0] * 0.004, pt[1] + n[1] * 0.004, z1 + w.cope * 0.5]);
            k.glow.lines.push([g(a), g(b)]);
          }
        }
        if (w.crown) {
          for (let q = 0; q < segs.length; q++) {
            const o2 = { a: outer[q], b: outer[q + 1], n: segs[q].n, len: segs[q].len }, i2 = { a: inner[q], b: inner[q + 1], n: segs[q].n, len: segs[q].len };
            // Cut to the slice as the rest, so a piece straddling a cut is laid half in each.
            w.crown(k2, part, clip, o2, i2, z2, Math.round(p.s * 40) * 8 + q * 2 + (edge > 0 ? 1 : 0), q > 0 && q < segs.length - 1);
          }
        }
      }
    }
  };
}

/** A block along a segment of a refuge from `u0` to `u1` of the way, between its outer line and its inner, from `z0` to `z1`, `grow` larger all round. */
export function segBlock(k: Kit, part: Part3, face: Kit['face'], o: Seg, i: Seg, u0: number, u1: number, z0: number, z1: number, tone: Tone, grow: number, order: number, role?: Role): void {
  const P = (s: Seg, u: number): Pt2 => [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u];
  const du = grow / Math.max(1e-6, o.len);
  const n = o.n;
  const out = (p: Pt2, d: number): Pt2 => [p[0] + n[0] * d, p[1] + n[1] * d];
  const a = out(P(o, u0 - du), grow), b = out(P(o, u1 + du), grow), bi = out(P(i, u1 + du), -grow), ai = out(P(i, u0 - du), -grow);
  k.solid(part, order);
  face(part, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [n[0], n[1], 0], tone, role ? infoOf(role, 0, 0, 0, 0, 15) : undefined, role ? segFrame(a, b) : undefined);
  face(part, [[bi[0], bi[1], z0], [ai[0], ai[1], z0], [ai[0], ai[1], z1], [bi[0], bi[1], z1]], [-n[0], -n[1], 0], tone);
  face(part, [[a[0], a[1], z1], [b[0], b[1], z1], [bi[0], bi[1], z1], [ai[0], ai[1], z1]], [0, 0, 1], tone);
  const along: Pt2 = [b[0] - a[0], b[1] - a[1]];
  face(part, [[ai[0], ai[1], z0], [a[0], a[1], z0], [a[0], a[1], z1], [ai[0], ai[1], z1]], [-along[0], -along[1], 0], tone);
  face(part, [[b[0], b[1], z0], [bi[0], bi[1], z0], [bi[0], bi[1], z1], [b[0], b[1], z1]], [along[0], along[1], 0], tone);
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
      // Where a refuge breaks the run, only whole merlons, and none hard by the break.
      if ((sa > sl.s0 + 1e-6 && m < sa + 0.08) || (sb < sl.s1 - 1e-6 && m + 0.25 > sb - 0.08)) continue;
      const lo = Math.min(deckAt(m0), deckAt(m1)) + LOW + COPE, hi = Math.max(deckAt(m0), deckAt(m1)) + LOW + COPE + MERLON;
      block(k, part, m0, m1, t0 + 0.004, t1 - 0.004, lo - 0.2, hi, st.stone, 'parapet', null, 2.5);
      block(k, part, m0 - 0.012, m1 + 0.012, t0 - 0.008, t1 + 0.008, hi, hi + MCAP, st.trim, 'cornice', null, 2.6);
    }
  }
}

/** Round each refuge the same crenellated parapet: one capped merlon across its front, its splayed sides left open as embrasures. */
const crenelRefuges = refugesOwn({
  top: LOW, cope: COPE, over: 0.014, thick: 0.09,
  crown: (k, part, face, o, i, z, _seed, front) => {
    if (!front) return;
    const h = Math.min(0.4, 0.1 / o.len);
    segBlock(k, part, face, o, i, 0.5 - h, 0.5 + h, z - 0.2, z + MERLON, k.st.stone, -0.004, 2.5, 'parapet');
    segBlock(k, part, face, o, i, 0.5 - h, 0.5 + h, z + MERLON, z + MERLON + MCAP, k.st.trim, 0.01, 2.6);
  },
});

/** At each end, on each outer edge: a square newel with a merlon at each corner of its cap and a ball finial between. */
function crenelEnds(k: Kit): void {
  const { plan, sl, st } = k;
  for (const edge of sl.edges) {
    const tt = edge > 0 ? sl.t1 - 0.075 : sl.t0 + 0.075;
    const part: Part3 = edge === sl.near ? 'rail' : 'front';
    const o = { shaft: LOW + COPE + MERLON + 1, half: 0.075, tone: st.stone, trim: st.trim, finial: st.ring, crenel: true, profile: [[0, 0.03], [0.8, 0.04], [2.2, 0.05], [3.6, 0.034], [4.4, 0.012], [4.9, 0]] as Array<[number, number]> };
    if (sl.i === 0) newelPost(k, part, 0.095, tt, plan.deck(0.095), o);
    if (sl.i === plan.n - 1) newelPost(k, part, plan.n - 0.095, tt, plan.deck(plan.n - 0.095), o);
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
    cap: moulding({ joint: DRESS_JOINT, hi: DRESS_HI, len: 12, rune: RUNE }),
    cornice: moulding({ joint: DRESS_JOINT, hi: DRESS_HI, len: 14 }),
    plinth: moulding({ joint: DRESS_JOINT, hi: DRESS_HI, len: 10 }),
    deck, tread: treadPaint(deck, t('#e1e3e9'), t('#6b6d7d')),
  },
  build: { parapet: crenelParapet, refuges: crenelRefuges, ends: crenelEnds, arches: archesKeyed(0.12, 1.8, 1.2) },
}, { riser: t('#9a9eab') });
