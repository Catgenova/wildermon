import { rand } from '../../ivy';
import { add, cross, css, hex, inlay, mix, mul, nail, sub, TAU, unit, type RGB, type Tone, type V3 } from '../core';
import { BUILDERS, FORM_HIGH, FORM_TIERS, U, boardPaint, byRole, refugeGaps, ownerOf, turned, type BridgePainter, type Builders, type FaceInfo, type Form, type Kit, type L, type Part3, type Pier, type Role } from './core';
import { grainPaint, timberBase } from './base';

/**
 * Plank: plank beams on X-braced timber piers, plank railings -- and the
 * carpentry every timber bridge is built with (`Carpentry`), which the log
 * and the timbercraft bridges take up in their own sizes and finish.
 *
 * Every member here is a solid run from one point to another with a cross
 * section (`bar`), its faces clipped to the slice's cuts (`lay`), so a beam
 * that runs over several slices is drawn a slice at a time with no seam.
 *
 * By drop (`Form`): beams on posts with knee braces (`low`), a trestle of
 * battered posts X-braced across and girted along (`high`), and two tiers of
 * it, a girt and a sill between them (`tiers`). A ramp's deck is stair
 * treads between two closed stringers, its railing raked to the slope.
 */

/* ---- members ------------------------------------------------------------------------------------ */

type P2 = [number, number];
const EPS = 1e-6;

/** A face as laid: its points in the bridge's frame, which way it looks, and what is painted on it. */
export interface Fc { pts: L[]; out: L; tone: Tone; info?: FaceInfo; frame?: { o: L; a: L; b: L } }

export const finfo = (role: Role, x0: number, x1: number, y0: number, y1: number, seed: number): FaceInfo => ({ role, x0, x1, y0, y1, seed });

/** The slice's cuts inside the bridge, along (`s`) and across (`t`): [axis, at, the side kept]. */
function cutPlanes(k: Kit, clip: string): Array<[0 | 1, number, number]> {
  const { sl, plan } = k;
  const c: Array<[0 | 1, number, number]> = [];
  if (clip.includes('s')) {
    if (sl.s0 > EPS) c.push([0, sl.s0, 1]);
    if (sl.s1 < plan.n - EPS) c.push([0, sl.s1, -1]);
  }
  if (clip.includes('t')) {
    if (sl.t0 > plan.tLo + EPS) c.push([1, sl.t0, 1]);
    if (sl.t1 < plan.tHi - EPS) c.push([1, sl.t1, -1]);
  }
  return c;
}

function clipPoly(pts: L[], planes: Array<[0 | 1, number, number]>): L[] {
  let out = pts;
  for (const [ax, v, sg] of planes) {
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const da = (a[ax] - v) * sg, db = (b[ax] - v) * sg;
      if (da >= -EPS) {
        if (Math.abs(da) <= EPS) { const q: L = [a[0], a[1], a[2]]; q[ax] = v; out.push(q); } else out.push(a);
      }
      if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
        const f = da / (da - db);
        const p: L = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        p[ax] = v;
        out.push(p);
      }
    }
    if (out.length < 3) return [];
  }
  return out;
}

/** Faces laid as one solid of `part`, clipped to the slice's cuts on the axes in `clip`; nothing where none is left. */
export function lay(k: Kit, part: Part3, order: number, faces: Fc[], clip = 'st'): void {
  const planes = cutPlanes(k, clip);
  let started = false;
  for (const f of faces) {
    const pts = planes.length ? clipPoly(f.pts, planes) : f.pts;
    if (pts.length < 3) continue;
    if (!started) { k.solid(part, order); started = true; }
    k.face(part, pts, f.out, f.tone, f.info, f.frame);
  }
}

/** A square section `w` units either side across and `h` up. */
export const sq = (w: number, h = w): P2[] => [[-w, -h], [w, -h], [w, h], [-w, h]];
/** A round one, `n` sides. */
export const rnd = (r: number, n = 8): P2[] => Array.from({ length: n }, (_, i) => [Math.cos(((i + 0.5) / n) * TAU) * r, Math.sin(((i + 0.5) / n) * TAU) * r] as P2);

const toL = (p: V3): L => [p[0] / U, p[1] / U, p[2]];
const toV = (p: L): V3 => [p[0] * U, p[1] * U, p[2]];

export interface BarOpts {
  /** Close it at its start and its end. */
  caps?: [boolean, boolean];
  /** What its sides are painted as, and its ends. */
  paint?: Role;
  capPaint?: Role;
  capTone?: Tone;
  seed?: number;
}

/**
 * A straight member from `a` to `b` of section `sec` ([across, up] in units:
 * across is level and square to it, up square to both; a post's across runs
 * along the bridge and its up across it).
 */
export function bar(a: L, b: L, sec: P2[], tone: Tone, o: BarOpts = {}): Fc[] {
  const A = toV(a), B = toV(b);
  const d = sub(B, A);
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-6) return [];
  const dn = mul(d, 1 / len);
  const u = unit(cross(dn, Math.abs(dn[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1]));
  const v = cross(u, dn);
  const off = (c: P2): V3 => add(mul(u, c[0]), mul(v, c[1]));
  const P = sec.map((c) => toL(add(A, off(c)))), Q = sec.map((c) => toL(add(B, off(c))));
  const seed = o.seed ?? Math.round(a[0] * 31 + a[1] * 17 + a[2]);
  const out: Fc[] = [];
  const n = sec.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const e = sub(off(sec[j]), off(sec[i]));
    const el = Math.hypot(e[0], e[1], e[2]) || 1;
    const f: Fc = { pts: [P[i], P[j], Q[j], Q[i]], out: toL(add(off(sec[i]), off(sec[j]))), tone };
    if (o.paint) { f.info = finfo(o.paint, 0, len, 0, el, seed + i); f.frame = { o: P[i], a: toL(dn), b: toL(mul(e, 1 / el)) }; }
    out.push(f);
  }
  const r = Math.max(...sec.map((c) => Math.hypot(c[0], c[1])));
  for (const [end, pts, ctr, sgn] of [[0, P, a, -1], [1, Q, b, 1]] as Array<[number, L[], L, number]>) {
    if (!o.caps?.[end]) continue;
    const f: Fc = { pts, out: toL(mul(dn, sgn)), tone: o.capTone ?? tone };
    if (o.capPaint) { f.info = finfo(o.capPaint, -r, r, -r, r, seed); f.frame = { o: ctr, a: toL(mul(u, sgn)), b: toL(v) }; }
    out.push(f);
  }
  return out;
}

/** A level slab of outline `poly` ([s, t]) from `z0` to `z1`: its top and its sides. */
export function slab(poly: P2[], z0: number, z1: number, top: Tone, side: Tone, topInfo?: FaceInfo, sideRole?: Role): Fc[] {
  const out: Fc[] = [{ pts: poly.map(([s, t]) => [s, t, z1] as L), out: [0, 0, 1], tone: top, info: topInfo, frame: topInfo ? { o: [0, 0, z1], a: [1 / U, 0, 0], b: [0, 1 / U, 0] } : undefined }];
  let cx = 0, cy = 0;
  for (const [s, t] of poly) { cx += s / poly.length; cy += t / poly.length; }
  for (let i = 0; i < poly.length; i++) {
    const [s0, t0] = poly[i], [s1, t1] = poly[(i + 1) % poly.length];
    const len = Math.hypot(s1 - s0, t1 - t0) * U;
    const f: Fc = { pts: [[s0, t0, z0], [s1, t1, z0], [s1, t1, z1], [s0, t0, z1]], out: [(s0 + s1) / 2 - cx, (t0 + t1) / 2 - cy, 0], tone: side };
    if (sideRole && len > 0) { f.info = finfo(sideRole, 0, len, z0, z1, i); f.frame = { o: [s0, t0, 0], a: [(s1 - s0) / len, (t1 - t0) / len, 0], b: [0, 0, 1] }; }
    out.push(f);
  }
  return out;
}

/** Whether this slice draws something running from `a` to `b` along the bridge that stands under the deck: the slice it is in, and of two the one further from the eye, so all under that nearer tile is laid over it. */
export function ownFar(k: Kit, a: number, b: number): boolean {
  const { sl, plan } = k;
  if (b < sl.s0 - EPS || a > sl.s1 + EPS) return false;
  const loIn = a >= sl.s0 - EPS || sl.s0 <= EPS, hiIn = b <= sl.s1 + EPS || sl.s1 >= plan.n - EPS;
  if (loIn && hiIn) return true;
  const toward = k.A[0] * k.e.toward[0] + k.A[1] * k.e.toward[1];
  if (!loIn) return toward < 0;
  return toward >= 0;
}

/** Of something on an outer face or on the deck, whether this slice draws it (`ownerOf`: the nearer where it straddles a cut), what runs past an end of the bridge taken as ending there. */
export const ownNear = (k: Kit, a: number, b: number): boolean => ownerOf(k, Math.max(a, 0), Math.min(b, k.plan.n)) !== null;

/* ---- what a timber bridge is built of ------------------------------------------------------------ */

/** A railing's make: how high, how far apart its posts, a post, and the rails between two of them. */
export interface RailSpec {
  H: number;
  spacing: number;
  /** A post standing on the deck at (s, t, z), on outer edge `edge`: its faces, the posts of a run laid as one solid; and anything drawn on top of it. */
  post: (s: number, t: number, z: number, edge: number) => Fc[];
  top?: (k: Kit, part: Part3, order: number, s: number, t: number, z: number) => void;
  /** The rails from `a` to `b` (points on the deck under them), posts standing at `posts` (fractions of the way). */
  run: (k: Kit, part: Part3, order: number, a: L, b: L, posts: number[], edge: number) => void;
  /** How far in from the deck's edge the railing stands, in tiles. */
  inset: number;
}

export interface Carpentry {
  /** Round members (logs), or sawn. */
  round: boolean;
  /** Half the thickness of a post, of a stringer's depth (and a round one's radius), of a cap beam's, of a brace's, in units. */
  post: number;
  stringer: number;
  stringerW: number;
  cap: number;
  brace: number;
  /** Tone of the posts and of the beams, of a log's cut end; sides of rails. */
  postTone: (k: Kit) => Tone;
  beamTone: (k: Kit) => Tone;
  endTone?: Tone;
  rail: RailSpec;
  /** A newel at each end of the bridge, standing at (s, t, z). */
  newel: (k: Kit, part: Part3, s: number, t: number, z: number, edge: number) => void;
  /** A rune plaque at the middle of each bay, on the outer face at (s, t, z), looking out along `edge`: the part of it in the slice, its rune's glow if `glow`. */
  plaque: (k: Kit, part: Part3, order: number, s: number, t: number, z: number, edge: number, glow: boolean) => void;
  /** The edge of the deck: the boards' ends and anything dressing them, on outer edge `edge` at `te`. */
  deckEdge: (k: Kit, edge: number, te: number) => void;
  /** The banner on a refuge of a bridge three lanes wide. */
  banner: (k: Kit, part: Part3, s: number, t: number, z: number, edge: number) => void;
  /** Anything more under the deck (the timbercraft's arch), after the bents. */
  more?: (k: Kit) => void;
  /** No knee braces at the top of the bents, no sway braces along the faces (where an arch takes the beam instead). */
  noKnees?: boolean;
  /** How far the outer posts splay, of the trestle's own; nought for posts straight down, the girts then laid inside them. */
  splay?: number;
}

/* ---- the bents ----------------------------------------------------------------------------------- */

export interface Bent { s: number; zTop: number; capB: number; foot: number; form: Form; batter: number; end: boolean }

/** A pier's bent: where it stands (an abutment's a hair in from the end), its cap beam's top and bottom, its foot and its form. */
export function bentOf(k: Kit, c: Carpentry, p: Pier): Bent {
  const { plan } = k;
  const s = p.end ? (p.s < plan.n / 2 ? p.s + 0.08 : p.s - 0.08) : p.s;
  const zTop = plan.deck(s) - plan.thick - 2 * c.stringer;
  const drop = plan.deck(s) - (p.foot + 1.5);
  const form: Form = drop <= FORM_HIGH ? 'low' : drop <= FORM_TIERS ? 'high' : 'tiers';
  return { s, zTop, capB: zTop - 2 * c.cap, foot: p.foot, form, batter: (form === 'low' ? 0 : form === 'high' ? 0.1 : 0.12) * (c.splay ?? 1), end: !!p.end };
}

/** The posts of a bent in this slice's lane: on an outer edge just in from it, splayed out at the foot; else a quarter tile in from the lane's side. */
export function postsOf(k: Kit, c: Carpentry): Array<{ t: number; out: number }> {
  const { sl, plan } = k;
  const e = c.post / U + 0.012;
  return [
    sl.t0 <= plan.tLo + EPS ? { t: sl.t0 + e, out: -1 } : { t: sl.t0 + 0.25, out: 0 },
    sl.t1 >= plan.tHi - EPS ? { t: sl.t1 - e, out: 1 } : { t: sl.t1 - 0.25, out: 0 },
  ];
}
/** Where a post is across at height `z`: splayed out the further down. */
export const postT = (b: Bent, p: { t: number; out: number }, z: number): number => p.t + p.out * b.batter * Math.max(0, b.capB - z) / U;

/** The heights of a bent's tiers: one, or two for a deep drop; each [bottom, top]. */
function tiersOf(k: Kit, b: Bent): Array<[number, number]> {
  const lo = b.foot + 2.5, hi = b.capB - 1.2;
  if (hi - lo < 9) return [];
  if (b.form !== 'tiers') return [[lo, hi]];
  // Split at the girt level nearest its middle, so the girts along the faces meet it.
  const mid = (lo + hi) / 2;
  const m = girtLevels(k, b).reduce((a, z) => (Math.abs(z - mid) < Math.abs(a - mid) ? z : a), mid);
  return [[lo, m - 1.2], [m + 1.2, hi]];
}

/** The heights the girts along a bridge's faces run at: every `GIRT` units over the lowest ground under it, the same for every bent. */
const GIRT = 38;
function girtLevels(k: Kit, b: Bent): number[] {
  const out: number[] = [];
  for (let z = k.plan.base + 3.5 + GIRT; z < b.capB - 10; z += GIRT) if (z > b.foot + 6) out.push(z);
  return out;
}

function bents(k: Kit, c: Carpentry): void {
  const { plan, sl } = k;
  const postTone = c.postTone(k), beam = c.beamTone(k);
  const w = c.post / U;
  const toward = k.A[0] * k.e.toward[0] + k.A[1] * k.e.toward[1];
  const face = toward >= 0 ? 1 : -1;
  const posts = postsOf(k, c);
  const postSec = c.round ? rnd(c.post, 6) : sq(c.post);
  const braceSec = c.round ? rnd(c.brace, 5) : sq(c.brace * 0.45, c.brace);
  const bs = plan.piers.map((p) => bentOf(k, c, p));
  for (const b of bs) {
    if (b.capB - b.foot < 2) continue;
    if (!ownFar(k, b.s - w * 1.5, b.s + w * 1.5)) continue;
    // The posts, their feet on stone pads.
    const pads: Fc[] = [];
    lay(k, 'front', -2, posts.flatMap((p, j) => {
      const tf = postT(b, p, b.foot);
      const g = plan.ground(b.s, tf);
      if (g > b.foot + 0.5 && g < b.capB - 4) pads.push(...bar([b.s, tf, g - 1], [b.s, tf, g + 1.4], sq(c.post + 0.9), PAD));
      return bar([b.s, tf, b.foot], [b.s, p.t, b.capB], postSec, postTone, { paint: 'post', seed: j + Math.round(b.s * 7) });
    }), '');
    lay(k, 'front', -2.1, pads, '');
    // The cap beam across the whole bent, its ends proud of the outer faces.
    const over = c.round ? 0.07 : 0.04;
    const capSec = c.round ? rnd(c.cap, 6) : sq(c.cap, c.cap);
    lay(k, 'front', -1.6, bar([b.s, plan.tLo - over, b.capB + c.cap], [b.s, plan.tHi + over, b.capB + c.cap], capSec, beam,
      { caps: [true, true], paint: c.round ? undefined : 'beam', capTone: c.endTone, capPaint: c.round ? 'plinth' : undefined }), 't');
    // The braces across, on the face toward the eye: an X in each tier, a girt between two.
    const sb = b.s + face * (w + c.brace * 0.45 / U);
    const tiers = tiersOf(k, b);
    const [p0, p1] = posts;
    lay(k, 'front', -1.9, tiers.flatMap(([z0, z1]) => [
      ...bar([sb, postT(b, p0, z0), z0], [sb, postT(b, p1, z1), z1], braceSec, beam),
      ...bar([sb, postT(b, p1, z0), z0], [sb, postT(b, p0, z1), z1], braceSec, beam),
    ]), '');
    if (tiers.length === 2) {
      const zm = (tiers[0][1] + tiers[1][0]) / 2;
      lay(k, 'front', -1.8, bar([sb, sl.t0 - 0.02, zm], [sb, sl.t1 + 0.02, zm], c.round ? rnd(c.brace * 1.2, 6) : sq(c.brace * 0.5, c.brace * 1.3), beam), 't');
    }
  }
  // Along each outer face: knee braces up from every post to the stringer, and for a trestle a girt at each tier's top between like bents.
  for (const edge of k.sl.edges) {
    const p = posts.find((q) => q.out === edge)!;
    const ord = k.ord(edge, -1.7);
    const knees: Fc[] = [], girts: Fc[] = [], sway: Fc[] = [];
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.capB - b.foot < 6 || c.noKnees || b.s < sl.s0 - 0.4 || b.s > sl.s1 + 0.4) continue;
      const drop = Math.min(9, (b.capB - b.foot) * 0.5);
      for (const dir of [-1, 1]) {
        if ((dir < 0 && i === 0) || (dir > 0 && i === bs.length - 1)) continue;
        const reach = Math.min(0.3, Math.abs(bs[i + dir].s - b.s) * 0.3);
        knees.push(...bar([b.s + dir * w, p.t, b.capB - drop], [b.s + dir * reach, p.t, b.capB + c.cap * 0.5], braceSec, beam));
      }
    }
    for (let i = 0; i + 1 < bs.length; i++) {
      const b0 = bs[i], b1 = bs[i + 1];
      if (b0.form === 'low' && b1.form === 'low') continue;
      if (b1.s < sl.s0 - 0.01 || b0.s > sl.s1 + 0.01) continue;
      const gt = (b: Bent, z: number): number => postT(b, p, z) + (c.splay === 0 ? -edge : edge) * (c.post + c.brace) / U;
      const gs = c.round ? rnd(c.brace * 1.1, 6) : sq(c.brace * 0.5, c.brace * 1.2);
      // A girt along the face at each level both bents reach, level from one to the next.
      const top1 = girtLevels(k, b1);
      const lv = girtLevels(k, b0).filter((z) => top1.some((q) => Math.abs(q - z) < 1e-6));
      for (const z of lv) girts.push(...bar([b0.s, gt(b0, z), z], [b1.s, gt(b1, z), z], gs, beam));
      // A sway brace across each panel between them, turning one way and the next the other.
      const zs = [Math.max(b0.foot, b1.foot) + 3, ...lv, Math.min(b0.capB, b1.capB) - 1.5];
      for (let q = 0; q + 1 < zs.length; q++) {
        const za = zs[q] + 0.8, zb = zs[q + 1] - 0.8;
        if (zb - za < 10 || c.noKnees) continue;
        const up = (i + q) % 2 === 0;
        const [sa, sb2] = up ? [b0.s + w, b1.s - w] : [b1.s - w, b0.s + w];
        const ba = up ? b0 : b1, bb = up ? b1 : b0;
        sway.push(...bar([sa, gt(ba, za), za], [sb2, gt(bb, zb), zb], braceSec, beam));
      }
    }
    lay(k, 'front', ord, knees, 's');
    lay(k, 'front', ord + 0.02, sway, 's');
    lay(k, 'front', ord + 0.05, girts, 's');
  }
}

/** The stone pads the posts stand on. */
const PAD: Tone = { lit: hex('#e2dad6'), shade: hex('#857d96') };

/** Stringers under the deck: one over each line of posts, the length of the slice. */
function stringers(k: Kit, c: Carpentry): void {
  const { plan, sl } = k;
  const beam = c.beamTone(k);
  const sec = c.round ? rnd(c.stringer, 8) : sq(c.stringerW, c.stringer);
  const z = (s: number): number => plan.deck(s) - plan.thick - c.stringer;
  // Over the outer posts only: the deck's own thickness spans the rest, out of sight under it.
  for (const p of postsOf(k, c).filter((q) => q.out !== 0)) {
    lay(k, 'front', -1.5, bar([sl.s0, p.t, z(sl.s0)], [sl.s1, p.t, z(sl.s1)], sec, beam,
      { caps: [sl.s0 <= EPS, sl.s1 >= plan.n - EPS], paint: 'beam', capTone: c.endTone, capPaint: c.round ? 'plinth' : undefined, seed: sl.i * 5 + Math.round(p.t * 9) }), '');
  }
}

/* ---- the deck ------------------------------------------------------------------------------------------ */

function deck(k: Kit, c: Carpentry): void {
  const { plan, sl, st } = k;
  const top = plan.deck;
  k.solid('front', 0);
  if (plan.ramp) {
    // Treads, three a tile, each level at the height its upper end reaches, and the riser up to the next.
    const n = 3;
    const up = plan.deck(sl.s1) >= plan.deck(sl.s0);
    for (let j = 0; j < n; j++) {
      const a = sl.s0 + ((sl.s1 - sl.s0) * j) / n, b = sl.s0 + ((sl.s1 - sl.s0) * (j + 1)) / n;
      const z = up ? top(b) : top(a);
      k.face('front', [[a, sl.t0, z], [b, sl.t0, z], [b, sl.t1, z], [a, sl.t1, z]], [0, 0, 1], st.deck,
        finfo('tread', a * U, b * U, sl.t0 * U, sl.t1 * U, sl.i * 7 + j), { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
      const zn = up ? (j + 1 < n ? top(sl.s0 + ((sl.s1 - sl.s0) * (j + 2)) / n) : z) : (j > 0 ? top(sl.s0 + ((sl.s1 - sl.s0) * (j - 1)) / n) : z);
      if (up && j + 1 < n) k.face('front', [[b, sl.t0, z], [b, sl.t1, z], [b, sl.t1, zn], [b, sl.t0, zn]], [-1, 0, 0], c.beamTone(k));
      if (!up && j > 0) k.face('front', [[a, sl.t0, z], [a, sl.t1, z], [a, sl.t1, zn], [a, sl.t0, zn]], [1, 0, 0], c.beamTone(k));
    }
  } else {
    k.face('front', [[sl.s0, sl.t0, top(sl.s0)], [sl.s1, sl.t0, top(sl.s1)], [sl.s1, sl.t1, top(sl.s1)], [sl.s0, sl.t1, top(sl.s0)]], [0, 0, 1], st.deck,
      finfo('deck', sl.s0 * U, sl.s1 * U, sl.t0 * U, sl.t1 * U, sl.i * 7 + sl.o), { o: [0, 0, top(sl.s0)], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
  }
  // The boards' thickness where the deck ends.
  for (const [s, dir] of [[0, -1], [plan.n, 1]] as Array<[number, number]>) {
    if (Math.abs(s - (dir < 0 ? sl.s0 : sl.s1)) > EPS) continue;
    const z = top(s);
    k.face('front', [[s, sl.t0, z - plan.thick], [s, sl.t1, z - plan.thick], [s, sl.t1, z], [s, sl.t0, z]], [dir, 0, 0], c.beamTone(k));
  }
  for (const edge of sl.edges) {
    const te = edge > 0 ? sl.t1 : sl.t0;
    if (plan.ramp) stairStringer(k, c, edge, te);
    else c.deckEdge(k, edge, te);
  }
}

/** The ends of a run of board along an outer edge from `ti` to `to`, `z0` to `z1` (as functions of `s`), where it meets the bridge's ends. */
function endCaps(k: Kit, ti: number, to: number, z0: (s: number) => number, z1: (s: number) => number, tone: Tone): Fc[] {
  const { sl, plan } = k;
  const out: Fc[] = [];
  for (const [s, dir] of [[0, -1], [plan.n, 1]] as Array<[number, number]>) {
    if (Math.abs(s - (dir < 0 ? sl.s0 : sl.s1)) > EPS) continue;
    out.push({ pts: [[s, ti, z0(s)], [s, to, z0(s)], [s, to, z1(s)], [s, ti, z1(s)]], out: [dir, 0, 0], tone });
  }
  return out;
}

/** On a ramp, each outer edge's closed stringer: a raking board over the treads' ends, from under the stringers to a hand over the highest tread. */
function stairStringer(k: Kit, c: Carpentry, edge: number, te: number): void {
  const { plan, sl } = k;
  const rise = Math.abs(plan.deck(plan.n) - plan.deck(0)) / plan.n / 3;
  const zb = (s: number): number => plan.deck(s) - plan.thick - 2 * c.stringer + 0.6;
  const zt = (s: number): number => plan.deck(s) + rise + 0.7;
  const T = 0.028;
  const [ti, to] = [te - edge * 0.004, te + edge * T];
  const tone = c.beamTone(k);
  const a = sl.s0, b = sl.s1;
  const len = (b - a) * U;
  lay(k, 'front', 1, [
    { pts: [[a, to, zb(a)], [b, to, zb(b)], [b, to, zt(b)], [a, to, zt(a)]], out: [0, edge, 0], tone, info: finfo('beam', 0, len, 0, zt(a) - zb(a), sl.i), frame: { o: [a, to, zb(a)], a: [1 / U, 0, (zb(b) - zb(a)) / len], b: [0, 0, 1] } },
    { pts: [[a, ti, zb(a)], [b, ti, zb(b)], [b, ti, zt(b)], [a, ti, zt(a)]], out: [0, -edge, 0], tone },
    { pts: [[a, ti, zt(a)], [b, ti, zt(b)], [b, to, zt(b)], [a, to, zt(a)]], out: [0, 0, 1], tone },
    { pts: [[a, ti, zb(a)], [b, ti, zb(b)], [b, to, zb(b)], [a, to, zb(a)]], out: [0, 0, -1], tone },
    ...endCaps(k, ti, to, zb, zt, tone),
  ], '');
}

/** A fascia board along the deck's edge, over the boards' ends; `tone` its own. */
export function fascia(k: Kit, edge: number, te: number, tone: Tone, role: Role = 'cornice'): void {
  const { plan, sl } = k;
  const top = plan.deck;
  const T = 0.016;
  const to = te + edge * T;
  const z0 = (s: number): number => top(s) - plan.thick - 1.6, z1 = (s: number): number => top(s) + 0.3;
  const len = (sl.s1 - sl.s0) * U;
  lay(k, 'front', 1, [
    { pts: [[sl.s0, to, z0(sl.s0)], [sl.s1, to, z0(sl.s1)], [sl.s1, to, z1(sl.s1)], [sl.s0, to, z1(sl.s0)]], out: [0, edge, 0], tone, info: finfo(role, sl.s0 * U, sl.s0 * U + len, 0, z1(sl.s0) - z0(sl.s0), sl.i), frame: { o: [sl.s0, to, z0(sl.s0)], a: [edge > 0 ? 1 / U : 1 / U, 0, 0], b: [0, 0, 1] } },
    { pts: [[sl.s0, te, z1(sl.s0)], [sl.s1, te, z1(sl.s1)], [sl.s1, to, z1(sl.s1)], [sl.s0, to, z1(sl.s0)]], out: [0, 0, 1], tone },
    { pts: [[sl.s0, te, z0(sl.s0)], [sl.s1, te, z0(sl.s1)], [sl.s1, to, z0(sl.s1)], [sl.s0, to, z0(sl.s0)]], out: [0, 0, -1], tone },
    ...endCaps(k, te, to, z0, z1, tone),
  ], '');
}

/* ---- railings ------------------------------------------------------------------------------------------ */

/** Half the length of a refuge along the bridge, in tiles. */
const REFUGE = 0.3;

/** The runs of railing along the bridge: its length less the refuges' gaps. */
function railRuns(k: Kit): Array<[number, number]> {
  let runs: Array<[number, number]> = [[0, k.plan.n]];
  const gaps = refugeGaps(k.plan).map(([a, b]): [number, number] => [(a + b) / 2 - REFUGE, (a + b) / 2 + REFUGE]);
  for (const [g0, g1] of gaps) {
    runs = runs.flatMap(([a, b]): Array<[number, number]> => (g1 <= a || g0 >= b ? [[a, b]] : [...(g0 > a + 0.02 ? [[a, g0] as [number, number]] : []), ...(g1 < b - 0.02 ? [[g1, b] as [number, number]] : [])]));
  }
  return runs;
}

/** The railing along an outer edge: posts every `spacing` and at a refuge's gap, rails from newel to newel. */
function railing(k: Kit, c: Carpentry, edge: number, part: Part3): void {
  const { plan, sl } = k;
  const R = c.rail;
  const te = edge > 0 ? sl.t1 : sl.t0;
  const t = te - edge * R.inset;
  // After the deck it stands on, near or far.
  const order = 2;
  for (const [ra, rb] of railRuns(k)) {
    if (rb < sl.s0 - EPS || ra > sl.s1 + EPS) continue;
    const sa = ra <= EPS ? 0.07 : ra, sb = rb >= plan.n - EPS ? plan.n - 0.07 : rb;
    const posts: number[] = [];
    if (ra > EPS) posts.push(sa);
    for (let s = R.spacing / 2; s < plan.n; s += R.spacing) if (s > sa + R.spacing * 0.4 && s < sb - R.spacing * 0.4) posts.push(s);
    if (rb < plan.n - EPS) posts.push(sb);
    const all = [sa, ...posts.filter((s) => s > sa + EPS && s < sb - EPS), sb];
    railPosts(k, part, order + 0.5, posts.filter((s) => s >= sl.s0 - EPS && s < sl.s1 - EPS).map((s): L => [s, t, plan.deck(s)]), edge, R);
    R.run(k, part, order, [sa, t, plan.deck(sa)], [sb, t, plan.deck(sb)], all.map((s) => (s - sa) / (sb - sa)), edge);
  }
}

/** Railing posts standing at `at`, one solid, and what tops them. */
function railPosts(k: Kit, part: Part3, order: number, at: L[], edge: number, R: RailSpec): void {
  lay(k, part, order, at.flatMap(([s, t, z]) => R.post(s, t, z, edge)), '');
  if (R.top) for (const [s, t, z] of at) R.top(k, part, order + 0.05, s, t, z);
}

/** Rails as bars `zs` over the deck between two points, clipped to the slice, the top one glowing at night. */
export function bars(k: Kit, part: Part3, order: number, a: L, b: L, zs: Array<{ z: number; sec: P2[]; tone: Tone; role?: Role }>, glowZ: number): void {
  lay(k, part, order, zs.flatMap((r) => bar([a[0], a[1], a[2] + r.z], [b[0], b[1], b[2] + r.z], r.sec, r.tone, { paint: r.role })), 'st');
  glowAlong(k, a, b, glowZ);
}

/** The rune line along a railing from `a` to `b`, at `z` over it: the part of it in this slice. */
export function glowAlong(k: Kit, a: L, b: L, z: number): void {
  const { sl } = k;
  const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
  const s0 = Math.max(lo, sl.s0), s1 = Math.min(hi, sl.s1);
  if (Math.abs(b[0] - a[0]) < EPS) {
    if (a[0] < sl.s0 - EPS || a[0] > sl.s1 + EPS) return;
    k.glow.lines.push([k.m([a[0], a[1], a[2] + z]), k.m([b[0], b[1], b[2] + z])]);
    return;
  }
  if (s1 - s0 < EPS) return;
  const at = (s: number): L => { const f = (s - a[0]) / (b[0] - a[0]); return [s, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f + z]; };
  k.glow.lines.push([k.m(at(s0)), k.m(at(s1))]);
}

/* ---- refuges, ends, plaques ----------------------------------------------------------------------------- */

/**
 * Over each pier of a bridge two lanes wide or more, on each outer edge, a
 * refuge: a platform with its front corners cut, carried on two knee braces
 * from the bent, railed round its three outer sides; three lanes wide, a
 * banner in it.
 */
function refuges(k: Kit, c: Carpentry): void {
  const { plan, sl, st } = k;
  const beam = c.beamTone(k);
  for (const p of plan.piers) {
    if (p.end) continue;
    if (p.s < sl.s0 - 0.5 || p.s > sl.s1 + 0.5) continue;
    const w = REFUGE;
    const out = 0.22;
    const z = plan.deck(p.s);
    for (const edge of sl.edges) {
      const te = edge > 0 ? sl.t1 : sl.t0;
      const part: Part3 = edge === sl.near ? 'rail' : 'front';
      const tf = te + edge * out;
      const B0: P2 = [p.s - w, te], F0: P2 = [p.s - w * 0.5, tf], F1: P2 = [p.s + w * 0.5, tf], B1: P2 = [p.s + w, te];
      const zb = z - plan.thick - 0.8;
      lay(k, 'front', k.ord(edge, 0.9), slab([B0, F0, F1, B1], zb, z, st.deck, beam, finfo('deck', 0, w * 2 * U, 0, out * U, Math.round(p.s * 3)), 'beam'), 's');
      // The outrigger under it, and two knee braces up to its front corners.
      const sec = c.round ? rnd(c.brace * 1.2, 6) : sq(c.brace * 0.5, c.brace * 1.2);
      lay(k, 'front', k.ord(edge, 0.85), bar([p.s, te - edge * 0.05, zb - c.cap], [p.s, tf - edge * 0.01, zb - c.cap], c.round ? rnd(c.cap, 8) : sq(c.cap * 0.8, c.cap), beam,
        { caps: [false, true], paint: 'beam', capTone: c.endTone, capPaint: c.round ? 'plinth' : undefined }), 's');
      for (const ds of [-1, 1]) {
        lay(k, 'front', k.ord(edge, 0.8), bar([p.s + ds * w * 0.35, te - edge * 0.02, zb - 13], [p.s + ds * w * 0.45, tf - edge * 0.02, zb - 0.5], sec, beam), 's');
      }
      // Its railing: back corner to front, across the front, front to back.
      const R = c.rail;
      const inset = R.inset;
      const tin = tf - edge * inset;
      const b0: L = [B0[0] + inset * 0.6, te - edge * inset, z], f0: L = [F0[0] + inset * 0.4, tin, z], f1: L = [F1[0] - inset * 0.4, tin, z], b1: L = [B1[0] - inset * 0.6, te - edge * inset, z];
      const order = 2;
      R.run(k, part, order, b0, f0, [0, 1], edge);
      R.run(k, part, order, f0, f1, [0, 1], edge);
      R.run(k, part, order, f1, b1, [0, 1], edge);
      railPosts(k, part, order + 0.5, [f0, f1].filter((q) => q[0] >= sl.s0 - EPS && q[0] < sl.s1 - EPS), edge, R);
      if (plan.width >= 3 && ownNear(k, p.s - 0.03, p.s + 0.03)) c.banner(k, part, p.s, (te + tf) / 2 + edge * 0.02, z, edge);
    }
  }
}

function ends(k: Kit, c: Carpentry): void {
  const { plan, sl } = k;
  for (const edge of sl.edges) {
    const te = edge > 0 ? sl.t1 : sl.t0;
    const t = te - edge * c.rail.inset;
    const part: Part3 = edge === sl.near ? 'rail' : 'front';
    if (sl.i === 0 && ownNear(k, 0, 0.14)) c.newel(k, part, 0.07, t, plan.deck(0.07), edge);
    if (sl.i === plan.n - 1 && ownNear(k, plan.n - 0.14, plan.n)) c.newel(k, part, plan.n - 0.07, t, plan.deck(plan.n - 0.07), edge);
  }
}

/**
 * A rune plaque at the middle of each bay on each outer face, on the stringer
 * under the deck's edge. One on a cut is laid in halves, each slice its own,
 * so neither is laid over the other's.
 */
function plaques(k: Kit, c: Carpentry): void {
  const { plan, sl } = k;
  for (const bay of plan.bays) {
    if (bay.c + 0.12 < sl.s0 || bay.c - 0.12 > sl.s1) continue;
    const glow = ownNear(k, bay.c - 0.08, bay.c + 0.08);
    for (const edge of sl.edges) {
      const te = edge > 0 ? sl.t1 : sl.t0;
      const z = plan.deck(bay.c) - plan.thick - c.stringer + 0.6;
      c.plaque(k, 'front', k.ord(edge, 1.2), bay.c, te + edge * 0.02, z, edge, glow);
    }
  }
}

/** The builders of a timber bridge of carpentry `c`. */
export function carpentry(c: Carpentry): Partial<Builders> {
  return {
    deck: (k) => deck(k, c),
    trestle: (k) => {
      bents(k, c);
      stringers(k, c);
      c.more?.(k);
      plaques(k, c);
    },
    parapet: (k, edge, part) => railing(k, c, edge, part),
    ends: (k) => ends(k, c),
    refuges: (k) => refuges(k, c),
    unfinished: BUILDERS.unfinished,
  };
}

/* ---- painters ------------------------------------------------------------------------------------------ */

/**
 * A plaque's face, `w` by `h` units either side of its middle, from its
 * frame's corner: a bevelled border and the rune inlaid in gold. Sized by
 * the plaque, not by the face it is told of, as one on a cut is laid in halves.
 */
export function plaquePaint(glyph: string, w: number, h: number): BridgePainter {
  return (g, k) => {
    const x1 = 2 * w, y1 = 2 * h;
    g.strokeStyle = css(mix(k.fill, hex('#4a3640'), 0.45), 0.8);
    g.lineWidth = 0.22;
    g.strokeRect(0.5, 0.5, x1 - 1, y1 - 1);
    g.strokeStyle = css(mix(k.fill, [255, 248, 232], 0.5), 0.6);
    g.lineWidth = 0.14;
    g.beginPath(); g.moveTo(0.65, 0.65); g.lineTo(0.65, y1 - 0.65); g.lineTo(x1 - 0.65, y1 - 0.65); g.stroke();
    inlay(g, k.fill, glyph, w, h, Math.min(w, h) * 0.72, 0.34);
  };
}

/** A rune inlaid in a roundel `r` units round, its middle at its frame's nought. */
export function roundRune(glyph: string, r: number): BridgePainter {
  return (g, k) => {
    g.strokeStyle = css(mix(k.fill, hex('#6a4a40'), 0.4), 0.7);
    g.lineWidth = 0.18;
    g.beginPath(); g.arc(0, 0, r * 0.82, 0, TAU); g.stroke();
    inlay(g, k.fill, glyph, 0, 0, r * 0.62, 0.36);
  };
}

/** Growth rings on a log's cut end, its pith at the frame's nought; a check split out from it. */
export const ringsPaint: BridgePainter = (g, k, f) => {
  const r = Math.max(Math.abs(f.x0), Math.abs(f.x1));
  g.strokeStyle = css(mix(k.fill, hex('#7a5a48'), 0.4), 0.55);
  g.lineWidth = 0.13;
  for (let q = r * 0.25; q < r * 0.95; q += r * 0.24) { g.beginPath(); g.arc(0, 0, q, 0, TAU); g.stroke(); }
  g.strokeStyle = css(mix(k.fill, hex('#5a4048'), 0.5), 0.6);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(r * 0.75, r * 0.3); g.stroke();
};

/** Sawn timber: grain, and a bolt now and then. */
export const sawnPaint: BridgePainter = (g, k, f, st) => {
  grainPaint(g, k, f, st);
  const len = Math.abs(f.x1 - f.x0), h = Math.abs(f.y1 - f.y0);
  if (h < 1.6 || len < 6) return;
  const T = rand(f.seed * 13 + 1);
  if (T() < 0.5) nail(g, k.fill, len * (0.15 + T() * 0.1), h / 2, 0.24);
};

/** A tone a step deeper or paler. */
export const shade = (t: Tone, k: number): Tone => (k > 0 ? { lit: mix(t.lit, t.shade, k), shade: mix(t.shade, hex('#3e3040'), k * 0.6) } : { lit: mix(t.lit, [255, 250, 240], -k), shade: mix(t.shade, t.lit, -k * 0.6) });
export const tone = (lit: string, sh: string): Tone => ({ lit: hex(lit), shade: hex(sh) });
export const rgb = (h: string): RGB => hex(h);

/** A pennant on a pole, a rune on it and a lantern under its arm. */
export function pennant(k: Kit, part: Part3, s: number, t: number, z: number, pole: Tone, cloth: Tone, lanternTone: Tone): void {
  const H = 30;
  turned(k, part, s, t, z, [[0, 0.024], [2, 0.02], [H, 0.014], [H + 1, 0.026], [H + 2.4, 0]], 6, pole, 4.1);
  // The arm out along the bridge, the pennant hanging from it.
  lay(k, part, 4.15, bar([s, t, z + H - 2], [s + 0.2, t, z + H - 2], sq(0.4, 0.5), pole), '');
  const top = z + H - 2.6;
  k.solid(part, 4.2);
  const pts: L[] = [[s + 0.015, t, top], [s + 0.19, t, top], [s + 0.19, t, top - 9], [s + 0.1, t, top - 6.5], [s + 0.015, t, top - 9]];
  k.face(part, pts, [0, 1, 0], cloth, finfo('lamp', 0, 0.175 * U, -9, 0, 1), { o: [s + 0.015, t, top], a: [1 / U, 0, 0], b: [0, 0, 1] });
  // A lantern hung from the pole under the arm.
  const lz = z + H - 9;
  lay(k, part, 4.25, bar([s, t + 0.0, lz], [s, t, lz + 3.4], sq(1.1), lanternTone, { caps: [true, true] }), '');
  k.glow.lamps.push(k.m([s, t, lz + 1.7]));
}

/** A pennant's cloth: a band along its foot and the rune. */
export function clothPaint(glyph: string): BridgePainter {
  return (g, k, f) => {
    g.strokeStyle = css(mix(k.fill, [255, 248, 236], 0.55), 0.7);
    g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(0.6, -1.2); g.lineTo(f.x1 - 0.6, -1.2); g.stroke();
    inlay(g, k.fill, glyph, f.x1 * 0.45, -4.3, 1.8, 0.3);
  };
}

/* ---- the plank bridge ------------------------------------------------------------------------------------ */

const base = timberBase('plank', { parapet: 'rail', rune: 'kenaz' });
const P = {
  post: tone('#c09a72', '#6a5468'),
  beam: tone('#b48c64', '#62505e'),
  rail: tone('#e3c49a', '#8a7078'),
  cap: tone('#ecd2a8', '#94787c'),
  fascia: tone('#d6b488', '#7e6670'),
  plaque: tone('#8e6e62', '#4a3a4c'),
};

const plankRail: RailSpec = {
  H: 9,
  spacing: 0.5,
  inset: 0.035,
  // The post, and a shallow pyramid cap over the rail.
  post: (s, t, z) => [...bar([s, t, z], [s, t, z + 9.6], sq(1.15), P.post), ...pyramid(s, t, z + 9.6, 1.45, 1.3, P.cap)],
  run: (k, part, order, a, b, _posts, edge) => {
    bars(k, part, order, a, b, [
      { z: 9.0, sec: sq(1.6, 0.5), tone: P.cap, role: 'rail' },
      { z: 7.5, sec: sq(0.55, 0.85), tone: P.rail },
      { z: 3.8, sec: sq(0.55, 0.85), tone: P.rail },
    ], 9.6);
    void edge;
  },
};

/** A shallow pyramid: a square cap `w` either side at `z`, rising `h` to a point. */
export function pyramid(s: number, t: number, z: number, w: number, h: number, tn: Tone): Fc[] {
  const W = w / U;
  const c: L[] = [[s - W, t - W, z], [s + W, t - W, z], [s + W, t + W, z], [s - W, t + W, z]];
  const apex: L = [s, t, z + h];
  const out: Fc[] = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    out.push({ pts: [a, b, apex], out: [(a[0] + b[0]) / 2 - s, (a[1] + b[1]) / 2 - t, 0.02], tone: tn });
  }
  return out;
}

const plankCarpentry: Carpentry = {
  round: false,
  post: 1.7,
  stringer: 2.4,
  stringerW: 1.3,
  cap: 1.5,
  brace: 1.3,
  postTone: () => P.post,
  beamTone: () => P.beam,
  rail: plankRail,
  newel: (k, part, s, t, z) => {
    lay(k, part, 3, bar([s, t, z], [s, t, z + 11.5], sq(2.1), P.post, { paint: 'post' }), '');
    lay(k, part, 3.05, bar([s, t, z + 11.5], [s, t, z + 12.4], sq(2.6), P.cap), '');
    lay(k, part, 3.1, pyramid(s, t, z + 12.4, 2.6, 2.6, P.cap), '');
  },
  plaque: (k, part, order, s, t, z, edge, glow) => plankPlaque(k, part, order, s, t, z, edge, glow, P.plaque, base.rune),
  deckEdge: (k, edge, te) => fascia(k, edge, te, P.fascia, 'beam'),
  banner: (k, part, s, t, z) => pennant(k, part, s, t, z, P.post, tone('#f1c4b8', '#9a6a80'), tone('#ffe7a4', '#e9b468')),
};

/** A square plaque pegged to the outer face at (s, t, z), its rune toward `edge`. */
export function plankPlaque(k: Kit, part: Part3, order: number, s: number, t: number, z: number, edge: number, glow: boolean, tn: Tone, glyph: string, w = 3.5, h = 3.9): void {
  const W = w / U;
  const to = t + edge * 0.016;
  const zs = [z - h, z + h];
  const pts: L[] = edge > 0
    ? [[s - W, to, zs[0]], [s + W, to, zs[0]], [s + W, to, zs[1]], [s - W, to, zs[1]]]
    : [[s + W, to, zs[0]], [s - W, to, zs[0]], [s - W, to, zs[1]], [s + W, to, zs[1]]];
  const faces: Fc[] = [{ pts, out: [0, edge, 0], tone: tn, info: finfo('key', 0, 2 * w, 0, 2 * h, Math.round(s * 10)), frame: { o: pts[0], a: [edge > 0 ? 1 / U : -1 / U, 0, 0], b: [0, 0, 1] } }];
  for (const [sx, dn] of [[s - W, -1], [s + W, 1]] as Array<[number, number]>) faces.push({ pts: [[sx, t, zs[0]], [sx, to, zs[0]], [sx, to, zs[1]], [sx, t, zs[1]]], out: [dn, 0, 0], tone: tn });
  faces.push({ pts: [[s - W, t, zs[1]], [s + W, t, zs[1]], [s + W, to, zs[1]], [s - W, to, zs[1]]], out: [0, 0, 1], tone: tn });
  faces.push({ pts: [[s - W, t, zs[0]], [s + W, t, zs[0]], [s + W, to, zs[0]], [s - W, to, zs[0]]], out: [0, 0, -1], tone: tn });
  lay(k, part, order, faces, 's');
  // Glowing at night when it looks toward the eye.
  const n = edge * (k.P[0] * k.e.toward[0] + k.P[1] * k.e.toward[1]);
  if (glow && n > 0) k.glow.runes.push({ at: k.m([s, to, z]), s: h * 0.55, glyph });
}

export const plank = timberBase('plank', {
  parapet: 'rail',
  rune: 'kenaz',
  stone: base.stone,
  post: P.post,
  rail: P.rail,
  ring: P.beam,
  trim: P.cap,
  paint: byRole({
    deck: boardPaint(3.2),
    tread: boardPaint(3.2),
    beam: sawnPaint,
    post: grainPaint,
    rail: grainPaint,
    key: plaquePaint('kenaz', 3.5, 3.9),
    lamp: clothPaint('kenaz'),
  }),
  build: carpentry(plankCarpentry),
});
