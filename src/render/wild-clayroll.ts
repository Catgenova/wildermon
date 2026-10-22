import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The clay-roll line: the Sliplet, a small slate-blue lizard of a thing low on
 * short legs under a great spiral shell of clay, coiled like a snail's and
 * seen side on, a fan of blue-and-clay frill plates over its back and behind
 * its head, big dark eyes and a cream muzzle; which grows into the Wheelmote,
 * bigger, its shell a thick clay wheel of three coils, more frills and a few
 * of them moss green, its skin splotched with clay; and then the Rollterra,
 * large and heavy on thick splayed legs with big pale claws, its shell built
 * of brick -- a ring of bricks round its rim, the coils jointed into bricks
 * with moss in the joints -- a stack of bricks on top, and a crown of big frill
 * plates. The species is still `mudda` underneath, as saves and the database
 * know it: the brickmaker, that shapes the lumps of clay in the settlement
 * stores into unfired bricks.
 *
 * Built the way the toad line is (`./wild-toad`): one set of functions from a
 * description of the stage (`Roll`), every foot given a point on the ground to
 * be at and its leg bent to reach it, so a planted foot stays where it was
 * put. Its shell is a wheel on an axle across its back (bone `shell`) and
 * turns as it goes: it rocks on with each step of its low crawl, it turns a
 * whole round with each brick it makes, and it rolls when it strikes, curled
 * up inside it with its head and legs drawn in.
 *
 * At its task it makes a brick: a lump of clay rolled in from the heap at its
 * left, both forepaws slammed down on it to squash it, its sides pressed
 * square by one paw and then the other, its top patted flat, and the brick
 * shoved across onto the stack at its right; its shell ratchets round a turn
 * as it presses.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** A leg: its hip or shoulder (right side, body frame), its two lengths, where its foot stands, its foot, how thick, how far its foot is turned out. */
interface Leg {
  hip: V3;
  len: [number, number];
  /** Where the ball of its foot stands, across and along, from under the body's middle. */
  at: [number, number];
  /** Heel (or wrist) to the ball of the foot; each toe's length; how many toes. */
  foot: number; toe: number; toes: number;
  /** How thick (a radius). */
  w: number;
  /** How far the foot is turned out from the way the body faces (degrees). */
  turn: number;
}

/**
 * A frill plate over its back: round the shell's rim from straight ahead (radians; a quarter turn is the top), across (a share of
 * the shell's half-thickness, to the right; mirrored to the left unless nought), how long (a share of the shell's radius), how far
 * swept back (radians), and its colours (0 blue with a clay tip, 1 clay with a blue root, 2 moss green).
 */
type Plate = readonly [number, number, number, number, number];
/** A frill plate behind its head: its root as a way out of the head's middle (mirrored unless across is nought), how long (a share of the head's length), and its colours. */
type Crest = readonly [number, number, number, number, number];

interface Roll {
  stage: 0 | 1 | 2;
  body: Rings;
  marks?: Rings;
  /** How high the body's middle is carried, and how far its front is tipped up (degrees). */
  high: number;
  tilt: number;
  /** The head: where it joins the body, its middle from there, its half-sizes (across, along, up), its snout's half-sizes (along, across, up), its pitch. */
  head: { at: V3; fwd: number; up: number; r: V3; snout: V3; pitch: number };
  /** The eyes: the way out of the head's middle each is, and how big. */
  eye: { at: V3; size: number };
  fore: Leg;
  hind: Leg;
  /**
   * The shell: its middle (body frame), its radius and half-thickness, how many turns its coil makes and how high the coil stands,
   * whether it is built of brick, how many bricks are stacked on top of it, and how much moss is in its joints.
   */
  shell: { c: V3; R: number; T: number; turns: number; h: number; bricks: boolean; stack: number; moss: number };
  plates: readonly Plate[];
  crest: readonly Crest[];
  gait: { duty: number; swing: [number, number]; step: number; bob: number; roll: number; rock: number };
  size: number;
}

/** A Sliplet: small and low, a big clay shell of two coils on its back, a fan of blue-and-clay frills, big dark eyes. */
const SLIPLET_LOOK: Roll = {
  stage: 0,
  body: { y: [-0.42, -0.3, -0.05, 0.2, 0.42, 0.6], z: [0.02, 0.01, 0, 0.01, 0.06, 0.13], w: [0.18, 0.27, 0.32, 0.3, 0.24, 0.17], h: [0.12, 0.17, 0.21, 0.2, 0.17, 0.13] },
  high: 0.29, tilt: 4,
  head: { at: [0, 0.62, 0.22], fwd: 0.14, up: 0.08, r: [0.235, 0.225, 0.2], snout: [0.15, 0.13, 0.1], pitch: -4 },
  eye: { at: [0.62, 0.52, 0.32], size: 0.1 },
  fore: { hip: [0.19, 0.42, -0.08], len: [0.17, 0.15], at: [0.27, 0.64], foot: 0.045, toe: 0.055, toes: 4, w: 0.072, turn: 12 },
  hind: { hip: [0.2, -0.28, -0.06], len: [0.14, 0.13], at: [0.34, -0.32], foot: 0.06, toe: 0.055, toes: 4, w: 0.078, turn: 24 },
  shell: { c: [0, -0.13, 0.25], R: 0.47, T: 0.36, turns: 2, h: 0.07, bricks: false, stack: 0, moss: 0 },
  plates: [
    [0.95, 0, 0.66, 0.9, 0], [1.15, 0.55, 0.64, 0.95, 1], [1.4, 0, 0.78, 1.0, 1], [1.6, 0.6, 0.68, 1.05, 0], [1.85, 0, 0.7, 1.1, 0],
    [2.05, 0.5, 0.56, 1.1, 1],
  ],
  crest: [[0.55, -0.5, 0.65, 1.15, 0], [0, -0.55, 0.85, 1.25, 1], [0.85, -0.45, 0.25, 0.8, 1]],
  gait: { duty: 0.66, swing: [0.22, 0.3], step: 0.22, bob: 0.03, roll: 4, rock: 14 },
  size: 3.4,
};

/** A Wheelmote: bigger, a thick clay wheel of a shell of three coils, more frills and a few moss green, skin splotched with clay. */
const WHEELMOTE_LOOK: Roll = {
  stage: 1,
  body: { y: [-0.66, -0.47, -0.08, 0.3, 0.62, 0.88], z: [0.03, 0.02, 0, 0.01, 0.08, 0.17], w: [0.3, 0.44, 0.52, 0.5, 0.4, 0.27], h: [0.2, 0.28, 0.34, 0.32, 0.27, 0.2] },
  high: 0.45, tilt: 4,
  head: { at: [0, 0.9, 0.3], fwd: 0.18, up: 0.1, r: [0.31, 0.3, 0.265], snout: [0.21, 0.17, 0.13], pitch: -6 },
  eye: { at: [0.64, 0.5, 0.3], size: 0.115 },
  fore: { hip: [0.32, 0.62, -0.11], len: [0.26, 0.23], at: [0.44, 0.98], foot: 0.07, toe: 0.085, toes: 4, w: 0.125, turn: 14 },
  hind: { hip: [0.32, -0.43, -0.08], len: [0.23, 0.21], at: [0.56, -0.48], foot: 0.09, toe: 0.08, toes: 4, w: 0.125, turn: 24 },
  shell: { c: [0, -0.2, 0.39], R: 0.75, T: 0.58, turns: 3, h: 0.09, bricks: false, stack: 0, moss: 0 },
  plates: [
    [0.85, 0, 0.56, 1.0, 0], [1.0, 0.6, 0.56, 1.0, 1], [1.2, 0, 0.66, 1.0, 1], [1.35, 0.7, 0.58, 1.0, 0], [1.5, 0, 0.7, 1.05, 2],
    [1.7, 0.5, 0.62, 1.05, 1], [1.9, 0, 0.64, 1.1, 2], [2.08, 0.6, 0.54, 1.1, 0], [2.25, 0, 0.5, 1.1, 2],
  ],
  crest: [[0.55, -0.5, 0.65, 1.1, 0], [0, -0.55, 0.85, 1.2, 1], [0.85, -0.45, 0.25, 0.8, 1], [0.3, -0.75, 0.45, 0.9, 0]],
  gait: { duty: 0.68, swing: [0.2, 0.28], step: 0.2, bob: 0.03, roll: 4, rock: 12 },
  size: 3.8,
};

/** A Rollterra: large and heavy on thick splayed legs, a shell built of brick with moss in its joints, bricks stacked on top, a crown of big frills. */
const ROLLTERRA_LOOK: Roll = {
  stage: 2,
  body: { y: [-0.96, -0.68, -0.1, 0.45, 0.9, 1.22], z: [0.04, 0.03, 0, 0.02, 0.1, 0.22], w: [0.44, 0.66, 0.78, 0.75, 0.6, 0.4], h: [0.3, 0.42, 0.5, 0.48, 0.4, 0.3] },
  high: 0.66, tilt: 3,
  head: { at: [0, 1.22, 0.36], fwd: 0.24, up: 0.13, r: [0.39, 0.39, 0.33], snout: [0.33, 0.22, 0.17], pitch: -6 },
  eye: { at: [0.66, 0.5, 0.28], size: 0.12 },
  fore: { hip: [0.55, 0.82, -0.16], len: [0.36, 0.32], at: [0.95, 1.3], foot: 0.11, toe: 0.15, toes: 4, w: 0.25, turn: 18 },
  hind: { hip: [0.55, -0.64, -0.1], len: [0.34, 0.3], at: [0.95, -0.72], foot: 0.14, toe: 0.13, toes: 4, w: 0.25, turn: 28 },
  shell: { c: [0, -0.3, 0.58], R: 1.12, T: 0.78, turns: 3, h: 0.11, bricks: true, stack: 2, moss: 1 },
  plates: [
    [0.72, 0.6, 0.5, 0.8, 0], [0.85, 0, 0.56, 0.85, 1], [1.05, 0.45, 0.62, 0.9, 0], [1.25, 0.65, 0.56, 0.95, 2], [1.45, 0, 0.68, 0.95, 0],
    [1.65, 0.5, 0.64, 1.0, 1], [1.9, 0.62, 0.54, 1.05, 2], [2.05, 0, 0.62, 1.1, 1], [2.3, 0.4, 0.52, 1.15, 0],
  ],
  crest: [[0.55, -0.45, 0.7, 1.2, 0], [0, -0.5, 0.86, 1.35, 1], [0.85, -0.4, 0.3, 0.95, 1], [0.35, -0.75, 0.5, 1.0, 0]],
  gait: { duty: 0.7, swing: [0.18, 0.25], step: 0.17, bob: 0.03, roll: 5, rock: 9 },
  size: 3.9,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

function onRings(R: Rings, y: number, th: number): { p: V3; n: V3 } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
function ringAt(R: Rings, y: number): { w: number; h: number; z: number } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}

function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** A frame scaled along its own three axes. */
const scaled = (x: Xf, k: V3): Xf => { const m = x.m; return { m: [m[0] * k[0], m[1] * k[1], m[2] * k[2], m[3] * k[0], m[4] * k[1], m[5] * k[2], m[6] * k[0], m[7] * k[1], m[8] * k[2]], t: x.t }; };
/** A frame shrunk by `k` toward a point `to` (in its parent's frame, already placed). */
const shrunk = (x: Xf, k: number, to: V3): Xf => { const s = scaled(x, [k, k, k]); return { m: s.m, t: add(to, scale(sub(x.t, to), k)) }; };

function woundTo(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    const w = want[q];
    if (nx * w[0] + ny * w[1] + nz * w[2] < 0) idx.reverse();
  });
  return f;
}

function facingDisc(pts: V3[], n: V3, m: Mat): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m };
}

/** A painted band along a run of points on a surface, `w` wide (half), each point's way out given. */
function lineOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number | readonly number[], m: Mat, lift = 0.008): Disc {
  const at = (k: number): number => (typeof w === 'number' ? w : w[Math.min(k, w.length - 1)]);
  const up = (q: { p: V3; n: V3 }, k: number, sd: number): V3 => {
    const K = pts.length, d = unit(sub(pts[Math.min(K - 1, k + 1)].p, pts[Math.max(0, k - 1)].p));
    const side = unit(cross(q.n, d));
    return add(add(q.p, scale(q.n, lift)), scale(side, sd * at(k)));
  };
  const v = [...pts.map((q, k) => up(q, k, 1)), ...[...pts].map((q, k) => up(q, k, -1)).reverse()];
  return facingDisc(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** `v` turned `a` (radians) about the axis `k`. */
function about(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), sn = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), sn)), scale(k, dot(k, v) * (1 - c)));
}

/** A body's rings rounded off at its ends, as the end of an egg is. */
function rounded(R: Rings): Rings {
  const n = R.y.length, y0 = R.y[0], y1 = R.y[n - 1], mid = (y0 + y1) / 2, half = (y1 - y0) / 2;
  const core: Rings = { y: R.y.slice(1, n - 1), z: R.z.slice(1, n - 1), w: R.w.slice(1, n - 1), h: R.h.slice(1, n - 1) };
  const out: Rings = { y: [], z: [], w: [], h: [] }, N = 12, p = 2.2;
  for (let k = 0; k <= N; k++) {
    const u = -Math.cos((Math.PI * k) / N), y = mid + half * u, c = ringAt(core, clamp(y, core.y[0], core.y[core.y.length - 1]));
    const cap = Math.max(0.12, (1 - Math.abs(u) ** p) ** (1 / p));
    out.y.push(y);
    out.z.push(c.z);
    out.w.push(c.w * cap);
    out.h.push(c.h * cap);
  }
  return out;
}

function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}
/** A smooth run through keys (time, value), times nought to one in order, held at either end. */
function keysAt(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  if (u <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [t0, v0] = keys[q], [t1, v1] = keys[q + 1];
    if (u <= t1) return lerp(v0, v1, smooth((u - t0) / Math.max(1e-6, t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
/** The same through keys of points. */
function keysAtV(keys: ReadonlyArray<readonly [number, V3]>, u: number): V3 {
  if (u <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [t0, v0] = keys[q], [t1, v1] = keys[q + 1];
    if (u <= t1) return mixV(v0, v1, smooth((u - t0) / Math.max(1e-6, t1 - t0)));
  }
  return keys[keys.length - 1][1];
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Sliplet's and the Wheelmote's rolling rams, the Rollterra's slam. */
export const ROLL_HITS: readonly number[] = [0.5, 0.52, 0.56];
/** When it is curled up in its shell (the smaller two), and when the Rollterra has reared, as shares of the strike. */
export const ROLL_STRIKE = { curled: 0.24, reared: 0.4 } as const;
/**
 * A go at its task, as shares of it: both forepaws slammed down on the lump, each side pressed square (left, then right), the two
 * pats on its top, the shove onto the stack and the brick set down on it, and the next lump rolled in from the heap. It loops, so
 * a go and the next are one.
 */
export const ROLL_WORK = { slam: 0.18, press: [0.34, 0.46] as const, pats: [0.58, 0.66] as const, shove: [0.72, 0.86] as const, set: 0.86, fetch: [0.88, 1] as const } as const;

/* ---- where its feet go ---------------------------------------------------------------- */

/**
 * A pose: where the ball of each foot is (along the ground, from under the body's middle) and how far its heel is lifted (degrees);
 * how the body is carried; the head pitched up, turned left and tilted; how far round its shell is turned (degrees, forward is
 * less), how far it is curled up into it (nought to one), and how far its head frills are raised (degrees).
 */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  head: [number, number, number];
  shell: number; curl: number; crest: number;
}

interface Rest {
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
  heel: number[];
}

const rests = new Map<Roll, Rest>();
const legOfI = (s: Roll, i: number): Leg => (i < 2 ? s.fore : s.hind);
function restOf(s: Roll): Rest {
  const had = rests.get(s);
  if (had) return had;
  const hip: V3[] = [], ankle: V3[] = [], reach: number[] = [], legs: Array<[number, number]> = [], heel: number[] = [];
  for (let i = 0; i < 4; i++) {
    const L = legOfI(s, i);
    hip.push([SIDE[i] * L.hip[0], L.hip[1], L.hip[2]]);
    ankle.push([SIDE[i] * L.at[0], L.at[1], 0]);
    reach.push(L.len[0] + L.len[1]);
    legs.push(L.len);
    heel.push(L.w * 0.5);
  }
  const R = { hip, ankle, legs, reach, heel };
  rests.set(s, R);
  return R;
}

function restPlan(s: Roll, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    head: [0, 0, 0], shell: 0, curl: 0, crest: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    shell: m(a.shell, b.shell), curl: m(a.curl, b.curl), crest: m(a.crest, b.crest),
  };
}

function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  return {
    at: p.at.map((x, i) => [d(x[0], to.at[i][0], from.at[i][0]), d(x[1], to.at[i][1], from.at[i][1]), d(x[2], to.at[i][2], from.at[i][2])] as V3),
    foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    shell: d(p.shell, to.shell, from.shell), curl: d(p.curl, to.curl, from.curl), crest: d(p.crest, to.crest, from.crest),
  };
}

/** How long the body is, hip to shoulder: what its moves are measured in. */
const lenOf = (s: Roll): number => s.fore.hip[1] - s.hind.hip[1];
/** How high its body's middle is with its shell down on the ground, curled up. */
const curledH = (s: Roll): number => s.shell.R - s.shell.c[2] + 0.01 * lenOf(s);

/** Curled up: the body let down until its shell is on the ground, and each foot drawn in up under it. */
function tucked(s: Roll, R: Rest, p: Plan, k: number): Plan {
  if (k <= 0) return p;
  const H = lerp(p.H, curledH(s), k);
  return {
    ...p, H, curl: Math.max(p.curl, k),
    at: p.at.map((a, i) => mixV(a, [R.hip[i][0] * 0.55, R.hip[i][1] * 0.7, Math.max(0, H + R.hip[i][2] - 0.25 * R.reach[i])], k)),
    foot: p.foot.map((f) => lerp(f, -30, k)),
  };
}

/** A lizard's crawl: the diagonals together, the left fore with the right hind. */
const CRAWL = [0, 0.5, 0.5, 0];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/**
 * Going: a low crawl, the diagonals together, each foot down for its share of a stride and swept back under it, then lifted and
 * brought forward round out from the body. Its body sways from side to side and its head swings the other way; its shell rocks on
 * with each push and back, turning a little as it goes. Faster, its steps are quicker and longer, its belly kept low.
 */
function crawlPlan(s: Roll, R: Rest, a: Anim, fast = 0): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s);
  const p = restPlan(s, R);
  const duty = lerp(G.duty, 0.58, fast), amp = lerp(G.swing[0], G.swing[1], fast), step = G.step * (1 + 0.3 * fast);
  for (let i = 0; i < 4; i++) {
    const reach = R.reach[i], half = reach * amp * (i < 2 ? 0.95 : 1), A = R.ankle[i], ph = frac(a.u + CRAWL[i]);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      p.foot[i] = (i < 2 ? 10 : 18) * ramp(ph / duty, 0.72, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    const lift = step * reach * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0] + SIDE[i] * 0.1 * reach * Math.sin(Math.PI * u), y, lift];
    p.foot[i] = (i < 2 ? 10 : 18) * (1 - smooth(u / 0.7)) + (i < 2 ? -8 : -10) * hump(u, 0.75, 0.25);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.04));
  p.H += -L * G.bob * (1 + 0.4 * fast) * down - L * 0.03 * fast;
  const over = Math.sin(TAU * (w + 0.25 - duty / 2));
  p.roll = G.roll * (1 + 0.4 * fast) * over;
  p.side = L * 0.03 * over;
  p.yaw = 5 * Math.sin(TAU * (w - 0.1));
  p.pitch = 1.5 * (down - 0.5) - 2 * fast;
  p.head = [2 * (2 * down - 1) - 3 * fast, -8 * Math.sin(TAU * (w - 0.1)), -3 * over];
  // The shell rocked on as each pair of feet pushes and back as they come down: two pushes a stride.
  p.shell = -G.rock * (1 + 0.5 * fast) * (0.5 - 0.5 * Math.cos(2 * TAU * (w - 0.08)));
  p.crest = -4 * fast + 3 * (down - 0.5);
  return p;
}

/**
 * Standing about: breathing, looking about; now and then its head frills raised and shaken, its shell rocked round a little and
 * back, and once a loop its head ducked into its shell and out again.
 */
function stillPlan(s: Roll, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, L = lenOf(s);
  const look = drift(t);
  p.head = [3 * drift(t, 1.3) + 2 * a.breath, 16 * look, 4 * drift(t, 2)];
  p.H += 0.012 * L * (a.breath - 0.5);
  p.squash = 0.02 * (0.5 - a.breath);
  const flare = beat(t, [4.2, 15.6], 1.4);
  p.crest = 20 * flare + 6 * flare * Math.sin((t - 4.2) * 26);
  const rock = beat(t, [7.4, 19.0], 1.6);
  p.shell = -14 * rock;
  p.pitch -= 1.5 * rock;
  // Its head ducked into its shell, a peek out again.
  const duck = beat(t, [11.2], 1.5);
  p.curl = 0.55 * smooth(duck * 1.4);
  p.head[0] -= 6 * duck;
  // A forefoot shifted: the right one lifted, put down a little further out, and back.
  const shift = beat(t, [21.4], 1.0);
  if (shift > 0) {
    const A = R.ankle[1];
    p.at[1] = [A[0] + 0.04 * L * shift, A[1] + 0.04 * L * shift, R.reach[1] * 0.22 * Math.sin(Math.PI * clamp(((t - 21.4) / 1.0) * 2))];
    p.roll -= 2 * shift;
  }
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/**
 * A rolling ram, the smaller two: curled up into its shell, rolled forward at what is in front of it, the shell turning over and
 * over, struck, rolled back a little, and out again. The Wheelmote's leaves the ground at the end of its roll and comes down on it.
 */
function rollRam(s: Roll, R: Rest, t: number): Plan {
  const hit = ROLL_HITS[s.stage], L = lenOf(s);
  const curl = ramp(t, 0.04, ROLL_STRIKE.curled) * (1 - ramp(t, 0.74, 0.96));
  const p = tucked(s, R, restPlan(s, R), curl);
  const go = ramp(t, ROLL_STRIKE.curled - 0.02, hit), back = ramp(t, hit + 0.02, 0.76);
  const far = L * (s.stage ? 1.2 : 1.1);
  p.surge = far * (go - 0.75 * back) - L * 0.06 * ramp(t, 0.02, ROLL_STRIKE.curled) * (1 - go);
  // Rolled: its turn is how far it goes over its radius, with a spin over: a whole turn and a quarter on, a quarter back.
  p.shell = -440 * go + 80 * back;
  const jolt = hump(t, hit + 0.025, 0.05);
  p.squash = 0.12 * jolt;
  p.pitch = -6 * jolt + 4 * hump(t, hit + 0.1, 0.08);
  if (s.stage === 1) {
    const hop = hump(t, hit - 0.08, 0.1);
    p.H += L * 0.22 * hop;
  }
  p.head = [10 * ramp(t, 0.8, 0.9) * (1 - ramp(t, 0.9, 1)), 0, 0];
  p.crest = -20 * curl + 25 * hump(t, 0.88, 0.08);
  return p;
}

/** The Rollterra's slam: reared up on its hind legs, forepaws high, then down on them with its whole weight, its shell rolling on. */
function rearSlam(s: Roll, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = ROLL_HITS[2], L = lenOf(s);
  const rear = ramp(t, 0.04, ROLL_STRIKE.reared) * (1 - ramp(t, 0.44, hit));
  const down = ramp(t, 0.46, hit) * (1 - ramp(t, hit + 0.16, 0.96));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.12 * rear + 0.16 * down);
  p.H += L * (0.22 * rear - 0.08 * down);
  p.pitch = 34 * rear - 7 * down;
  p.head = [-6 * rear + 10 * down, 0, 0];
  p.squash = -0.03 * rear + 0.16 * jolt + 0.03 * down;
  p.shell = 14 * rear - 36 * ramp(t, 0.46, hit + 0.06) * (1 - ramp(t, hit + 0.2, 0.98));
  p.crest = 24 * rear - 10 * jolt;
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0] * 0.85, A[1] - L * 0.05, R.reach[i] * 1.3], land: V3 = [A[0] * 0.92, A[1] + L * 0.18, 0];
    if (t < hit) p.at[i] = t < 0.44 ? mixV(A, high, ramp(t, 0.06, 0.38)) : mixV(high, land, ramp(t, 0.44, hit - 0.01) ** 1.5);
    else p.at[i] = arc(land, A, ramp(t, 0.72 + 0.06 * i, 0.94), R.reach[i] * 0.18);
    p.foot[i] = -16 * rear;
  }
  for (const i of [2, 3]) p.foot[i] = 16 * rear;
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));

/** Where its clay is as it works, worked out once for a stage, on the ground: the lump it shapes, the stack at its right, the heap at its left. */
interface Site { at: V3; stack: V3; heap: V3; block: V3; lump: number }
const sites = new Map<Roll, Site>();
/** A brick's half-sizes: across, along and up. */
const blockOf = (s: Roll): V3 => { const k = s.shell.R / 0.47; return [0.19 * k, 0.1 * k, 0.075 * k]; };
function siteOf(s: Roll): Site {
  const had = sites.get(s);
  if (had) return had;
  const B = blockOf(s), y = s.fore.at[1] + B[1] * 1.3;
  const S = {
    at: [0, y, 0] as V3, stack: [B[0] * 2.6 + s.fore.at[0] * 0.5, y + B[1] * 3.2, 0] as V3, heap: [-(B[0] * 2.4 + s.fore.at[0] * 0.5), y + B[1] * 2.8, 0] as V3, block: B,
    lump: Math.cbrt((6 * B[0] * B[1] * B[2]) / Math.PI),
  };
  sites.set(s, S);
  return S;
}
/** The top course of the stack, where the brick it shoves across each go comes to rest. */
const topOfStack = (s: Roll): V3 => { const S = siteOf(s); return add(S.stack, [0, 0, S.block[2] * 2]); };

/** The clay this moment of a go: squashed, squared and patted, nought to one each. */
interface Form { squash: number; square: number; pat: number }
function formOf(t: number): Form {
  const W = ROLL_WORK;
  return {
    squash: ramp(t, W.slam - 0.05, W.slam + 0.01),
    square: 0.5 * ramp(t, W.press[0] - 0.05, W.press[0] + 0.02) + 0.5 * ramp(t, W.press[1] - 0.05, W.press[1] + 0.02),
    pat: hump(t, W.pats[0] + 0.01, 0.035) + hump(t, W.pats[1] + 0.01, 0.035),
  };
}
/** How high the clay's top is, for its form. */
function topOf(S: Site, f: Form): number {
  const lump = S.lump * 1.7, flat = S.lump * 1.0, brick = S.block[2] * 2;
  return lerp(lerp(lump, flat, f.squash), brick, f.square) * (1 - 0.12 * f.pat);
}
/** How wide (half) the clay is, for its form. */
function wideOf(S: Site, f: Form): number {
  return lerp(lerp(S.lump * 1.05, S.lump * 1.35, f.squash), S.block[0], f.square);
}

/**
 * A go at its task: the lump in front of it; both forepaws lifted and slammed down on it, squashing it flat, its weight thrown on
 * and its shell rolling round with it; its left paw pressing the clay's side square, then its right, the shell turning on with each;
 * two quick pats on the top, one paw and the other; then the brick shoved across to the stack at its right with its left paw, the
 * body turned after it and the shell rolling on, and the next lump drawn in from the heap at its left. Its shell has turned a whole
 * round by the end of a go, so a go and the next are one.
 */
function workPlan(s: Roll, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s), W = ROLL_WORK, S = siteOf(s), B = S.block, F = formOf(t);
  const top = topOf(S, F), wide = wideOf(S, F), y = S.at[1];
  const slam = ramp(t, W.slam - 0.06, W.slam) * (1 - ramp(t, W.slam + 0.08, W.press[0] - 0.06));
  const raise = ramp(t, 0.02, W.slam - 0.06) * (1 - ramp(t, W.slam - 0.06, W.slam));
  const shove = ramp(t, W.shove[0], W.shove[1]) * (1 - ramp(t, W.set + 0.02, 0.98));
  const fetch = ramp(t, W.fetch[0], W.fetch[1] - 0.03);
  p.H -= L * (0.05 + 0.05 * slam - 0.03 * raise);
  p.pitch = -4 - 5 * slam + 4 * raise;
  p.head = [-6 + 6 * raise - 8 * slam + 4 * hump(t, W.pats[0], 0.05) + 4 * hump(t, W.pats[1], 0.05), 8 * hump(t, W.press[0], 0.08) - 8 * hump(t, W.press[1], 0.08) - 20 * shove + 26 * hump(t, 0.96, 0.08), 0];
  p.squash = 0.06 * hump(t, W.slam + 0.02, 0.05);
  p.surge = L * (0.05 * slam + 0.06 * shove);
  p.yaw = -14 * shove + 8 * hump(t, 0.96, 0.08);
  p.roll = -4 * hump(t, W.press[0], 0.07) + 4 * hump(t, W.press[1], 0.07) + 3 * shove;
  p.crest = 10 * raise - 8 * slam + 6 * shove;
  // The shell ratchets round with each press, a whole turn by the end of the go.
  p.shell = -keysAt([
    [0, 0], [0.1, -8], [W.slam, 80], [W.press[0] - 0.06, 88], [W.press[0] + 0.02, 140], [W.press[1] - 0.05, 148], [W.press[1] + 0.02, 196],
    [W.pats[0], 214], [W.pats[1] + 0.03, 240], [W.shove[0], 246], [W.set, 330], [1, 360],
  ], t);
  // The forepaws, left and right: on the ground either side of the lump; lifted high and slammed down on its top; each in turn
  // pressing a side square; two pats on the top; the left one pushing the brick across to the stack; the right drawing in the next lump.
  const rest = (sd: number): V3 => [sd * (B[0] + 0.08 * L), y - B[1] * 0.5, 0];
  const onTop = (sd: number): V3 => [sd * wide * 0.4, y, top];
  const brick = brickAt(s, t);
  for (const i of [0, 1]) {
    const sd = SIDE[i], reach = R.reach[i], A = rest(sd), hi: V3 = [sd * wide * 0.5, y - B[1] * 0.4, top + reach * 0.5];
    const pressAt = W.press[i], patAt = W.pats[i];
    const side: V3 = [sd * (wide + 0.03 * L), y, top * 0.55], sideOut: V3 = [sd * (wide + 0.12 * L), y - B[1] * 0.3, top * 0.6];
    const keys: Array<readonly [number, V3]> = [
      [0, A], [0.04, A], [W.slam - 0.07, hi], [W.slam, onTop(sd)], [W.slam + 0.08, onTop(sd)],
      [pressAt - 0.08, sideOut], [pressAt, side], [pressAt + 0.06, sideOut],
      [patAt - 0.05, add(onTop(sd), [0, 0, reach * 0.25])], [patAt, onTop(sd)], [patAt + 0.04, add(onTop(sd), [0, 0, reach * 0.12])],
    ];
    if (i === 0) {
      // The left paw shoves the brick across from its left, and comes back.
      const b0 = brickAt(s, W.shove[0]);
      keys.push([W.shove[0] - 0.02, [b0[0] - B[0] - 0.04 * L, y, B[2] * 1.2]]);
      keys.push([W.set, [brick[0] - B[0] * 0.9, brick[1], brick[2] + B[2]]]);
      keys.push([W.set + 0.06, A], [1, A]);
    } else {
      keys.push([W.shove[0], add(A, [0.04 * L, 0, 0])], [W.fetch[0], A]);
      // The right paw reaches across and draws in the next lump.
      const n = lumpAt(s, 0.95);
      keys.push([0.95, [n[0] + S.lump * 0.6, y - B[1] * 0.2, S.lump * 1.2]], [1, A]);
    }
    p.at[i] = keysAtV(keys, t);
    p.foot[i] = -20 * hump(t, W.slam, 0.06) - 14 * hump(t, patAt, 0.05) - 10 * hump(t, pressAt, 0.06);
  }
  p.head[1] += 10 * fetch * (1 - ramp(t, 0.97, 1));
  // Its hind feet braced back as it leans in.
  for (const i of [2, 3]) p.at[i] = add(p.at[i], [0, -0.04 * L * slam, 0]);
  const out = mixPlan(restPlan(s, R), p, down);
  // Its shell turned the whole round even on a go played once: nought and a whole turn are the same.
  out.shell = p.shell;
  return out;
}

/** Where the brick is at `t` through a go, on the ground: in front of it while it is shaped, then shoved across to the stack's top. */
function brickAt(s: Roll, t: number): V3 {
  const S = siteOf(s), W = ROLL_WORK, k = ramp(t, W.shove[0], W.set), top = topOfStack(s);
  return arc(S.at, top, k, S.block[2] * 2.5);
}
/** Where the next lump is at `t` through a go: rolled in from the heap at its left to in front of it. */
function lumpAt(s: Roll, t: number): V3 {
  const S = siteOf(s), k = ramp(t, ROLL_WORK.fetch[0], ROLL_WORK.fetch[1]);
  const from = add(S.heap, [S.lump * 0.6, 0, S.lump * 0.9]);
  return arc(from, S.at, k, S.lump * 0.4);
}

/** Evolving: curled up into its shell as the light gathers, out again at the turn with its frills raised, a shake, and settled. */
function evolvePlan(s: Roll, R: Rest, t: number): Plan {
  const curl = ramp(t, 0.06, 0.3) * (1 - ramp(t, 0.5, 0.62));
  const p = tucked(s, R, restPlan(s, R), curl), L = lenOf(s);
  const up = ramp(t, 0.52, 0.64) * (1 - ramp(t, 0.76, 0.96));
  const shake = hump(t, 0.72, 0.1) * Math.sin(t * 60);
  p.H += L * 0.06 * up;
  p.pitch = 8 * up;
  p.head = [12 * up, 6 * shake, 10 * shake];
  p.roll = 4 * shake;
  p.squash = -0.05 * up + 0.08 * hump(t, 0.74, 0.05);
  p.shell = -360 * ramp(t, 0.08, 0.5);
  p.crest = 30 * up - 20 * curl;
  return p;
}

/** How much of a leg's reach any foot may take before the body is let down to it. */
const MOST_REACH = 0.94;

function heelOf(s: Roll, R: Rest, i: number, at: V3, lift: number): V3 {
  const L = legOfI(s, i), h = footHeading(i, L), F = L.foot, c = Math.cos(lift * DEG), sn = Math.sin(lift * DEG);
  return [at[0] - h[0] * F * c, at[1] - h[1] * F * c, at[2] + R.heel[i] + F * sn];
}
function footHeading(i: number, L: Leg): V3 {
  const a = SIDE[i] * -L.turn * DEG;
  return [-Math.sin(a), Math.cos(a), 0];
}

function seated(s: Roll, R: Rest, p: Plan): Plan {
  let drop = 0;
  const body = joint(ROOT, [p.side, p.surge, p.H], s.tilt + p.pitch, p.roll, p.yaw);
  const at = p.at.map((x) => [...x] as V3);
  for (let i = 0; i < 4; i++) {
    const hip = place(body, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), flat = d[0] * d[0] + d[1] * d[1], up = -d[2];
    if (flat + up * up <= L * L) continue;
    const need = up - Math.sqrt(Math.max(0, L * L - flat)), k = 1 - smooth(at[i][2] / (0.2 * R.reach[i]));
    drop = Math.max(drop, need * k);
  }
  const H = Math.max(p.H - Math.max(0, drop), curledH(s));
  const body2 = joint(ROOT, [p.side, p.surge, H], s.tilt + p.pitch, p.roll, p.yaw);
  for (let i = 0; i < 4; i++) {
    const hip = place(body2, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), D = len3(d);
    if (D > L) at[i] = add(at[i], scale(d, L / D - 1));
  }
  return { ...p, at, H };
}

function posedOf(s: Roll, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(s.stage < 2 ? rollRam(s, R, act.t) : rearSlam(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = crawlPlan(s, R, a, smooth(clamp(a.gait)));
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** A leg bent to put its heel (or wrist) at `ankle`: the hind leg's knee out and up beside the body, the fore leg's elbow back and out. */
function legOf(s: Roll, R: Rest, body: Xf, i: number, ankle: V3, heading: V3, lift: number): [Xf, Xf, Xf] {
  const fore = i < 2, [l0, l1] = R.legs[i];
  const hip = place(body, R.hip[i]), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = len3(d);
  const Dc = clamp(D, Math.abs(l0 - l1) + 0.05 * (l0 + l1), (l0 + l1) * 0.985);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit(fore ? [SIDE[i] * 0.9, -0.55, 0.2] : [SIDE[i] * 0.5, 0.7, 0.1]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], heading);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], -lift)];
}

const skullAt = (s: Roll): V3 => [0, s.head.fwd, s.head.up];
const snoutAt = (s: Roll): V3 => { const H = s.head; return [0, H.fwd + H.r[1] * 0.7 + H.snout[0] * 0.35, H.up - H.r[2] * 0.3]; };
const snoutR = (s: Roll): V3 => { const S = s.head.snout; return [S[1], S[0], S[2]]; };
/** Where its head frills turn from, at the back of the top of its head. */
const crestAt = (s: Roll): V3 => { const H = s.head; return [0, H.fwd - H.r[1] * 0.45, H.up + H.r[2] * 0.55]; };

function rollBones(s: Roll): (a: Anim) => Bones {
  const R = restOf(s), S = s.shell;
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], s.tilt + P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    const c = P.curl;
    // Curled, its chest is drawn back into its shell.
    const sq = P.squash, base = scaled(body, [1 + 0.4 * sq - 0.2 * c, 1 + 0.2 * sq - 0.45 * c, 1 - sq - 0.15 * c]);
    b.trunk = base;
    b.back = body;
    b.shell = joint(body, S.c, P.shell);
    // The head drawn into the shell as it curls, and shrunk there out of sight.
    const into: V3 = [0, S.c[1] + S.R * 0.15, S.c[2] - S.R * 0.1];
    const head = joint(body, mixV(s.head.at, into, c), s.head.pitch + P.head[0] - 20 * c, P.head[2], P.head[1]);
    b.head = c > 0 ? shrunk(head, 1 - 0.7 * c, head.t) : head;
    b.crest = joint(b.head, crestAt(s), P.crest);
    const hipsIn = 1 - 0.55 * c;
    for (let i = 0; i < 4; i++) {
      const L = legOfI(s, i), g = P.at[i];
      const heading = footHeading(i, L);
      const heel = heelOf(s, R, i, [g[0], g[1], Math.max(0, g[2])], P.foot[i]);
      const [u, l, f] = legOf(s, R, body, i, heel, heading, P.foot[i]);
      const hip = u.t;
      b[`${LEGS4[i]}0`] = c > 0 ? shrunk(u, hipsIn, hip) : u;
      b[`${LEGS4[i]}1`] = c > 0 ? shrunk(l, hipsIn, hip) : l;
      b[`${LEGS4[i]}2`] = c > 0 ? shrunk(f, hipsIn, hip) : f;
    }
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    return b;
  };
  return (a) => {
    const P = seated(s, R, posedOf(s, R, { ...a, go: a.act ? 0 : a.go }));
    const b = pose(P);
    const working = a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
    if (working) {
      const t = a.act?.kind === 'work' ? a.act.t : 0, k = a.act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
      const g = smooth((k - 0.03) / 0.5), St = siteOf(s);
      if (g > 0.01) {
        b.site = { m: [g, 0, 0, 0, g, 0, 0, 0, g], t: St.at };
        // The clay it shapes, in front of it and then shoved across onto the stack, turned a little as it goes.
        if (t < ROLL_WORK.set + 0.01) {
          const p = brickAt(s, t), sh = ramp(t, ROLL_WORK.shove[0], ROLL_WORK.set);
          b.held = joint({ m: [g, 0, 0, 0, g, 0, 0, 0, g], t: p }, [0, 0, 0], -10 * Math.sin(Math.PI * sh), 0, -8 * Math.sin(Math.PI * sh));
        }
        // The next lump, rolled in from the heap.
        if (a.act?.kind === 'work' && t > ROLL_WORK.fetch[0]) {
          const p = lumpAt(s, t), k2 = ramp(t, ROLL_WORK.fetch[0], ROLL_WORK.fetch[1]), d = St.at[0] - St.heap[0];
          b.next = joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: p }, [0, 0, 0], 0, (d / St.lump) * (1 - k2) * (180 / Math.PI) * 0.6, 0);
        }
      }
    }
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------------------- */

const marksOf = (s: Roll): Rings => s.marks ?? s.body;

/** A painted blob lying on the body, every corner laid back onto the body's own curve. */
function blotOn(s: Roll, y: number, th: number, rx: number, ry: number, m: Mat, spin: number, id: number, sides = 8): Disc {
  const q = onRings(s.body, y, th), d = disc(add(q.p, scale(q.n, 0.01)), q.n, rx, ry, sides, m, { spin, up: [0, 0, 1] });
  return {
    ...d, v: d.v.map((v, k) => {
      const c = add(q.p, scale(sub(v, q.p), 0.8 + 0.35 * jitter(id * 13 + k)));
      const r = ringAt(s.body, c[1]), a = Math.atan2((c[2] - r.z) / r.h, c[0] / r.w);
      const e = onRings(s.body, c[1], a);
      return add(e.p, scale(e.n, 0.008 * (s.shell.R / 0.47)));
    }),
  };
}

/** Whether a point on the body is in its cream underside: under it, and up the front of its chest and throat. */
function inBelly(s: Roll, c: V3): boolean {
  const M = marksOf(s), r = ringAt(s.body, c[1]), up = (c[2] - r.z) / r.h, front = (c[1] - M.y[3]) / (M.y[5] - M.y[3]);
  const across = Math.abs(c[0]) / r.w;
  return up < -0.25 - 0.1 * across || (front > 0 && across < 0.85 && up < 0.05 + 0.5 * front - 0.6 * across * across);
}

/** The body: slate blue, cream underneath and up its throat, splotched with clay over its back and flanks, pale specks. */
function barrelOf(s: Roll, n: number): Mesh {
  const B = s.body;
  const m0 = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, 'coat');
  const body = mesh(m0.v, m0.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m0.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return inBelly(s, c) ? { ...f, m: 'belly' as Mat } : f;
  }));
  const M = marksOf(s), spots: Disc[] = [];
  const count = [8, 12, 14][s.stage];
  for (let q = 0; q < count; q++) {
    const id = 300 + q * 7, sd = q % 2 ? 1 : -1;
    const y = lerp(M.y[2], M.y[5], jitter(id)), up = lerp(-0.1, 1.2, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.16 + 0.12 * jitter(id + 2)) * r.w;
    if (inBelly(s, onRings(s.body, y, th).p)) continue;
    spots.push(blotOn(s, y, th, k * 1.3, k * 0.8, 'mark', jitter(id + 4) * 3, id));
  }
  for (let q = 0; q < 10; q++) {
    const id = 700 + q * 5, sd = q % 2 ? 1 : -1;
    const y = lerp(M.y[2], M.y[5], jitter(id)), up = lerp(0, 1.3, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.04 + 0.025 * jitter(id + 2)) * r.w;
    if (inBelly(s, onRings(s.body, y, th).p)) continue;
    spots.push(blotOn(s, y, th, k, k, 'coatLight', 0, id, 5));
  }
  const cream = paint(body.f.filter((f) => f.m === 'belly').map((f) => ({ v: f.i.map((i) => body.v[i]), m: 'belly' as Mat })));
  return merge(body, cream, paint(spots));
}

/* ---- the shell ---------------------------------------------------------------------------------- */

/** How far out the face of the shell is from its middle at `r` from its axle: domed, so the shell is a round fat wheel. */
const domeAt = (S: Roll['shell'], r: number): number => S.T * (1 + 0.32 * (1 - (r / S.R) ** 2));

/** Across a coil of the shell: where each line of the coil's corners is, nought at one groove to one at the next, and how high it stands there. */
const COIL_F = [0, 0.16, 0.5, 0.84, 1];
const COIL_UP = [0, 0.78, 1, 0.78, 0];

/**
 * One face of the shell, `sd` its side: a coil of clay laid on the face in a spiral from its middle out, each turn a rounded rope
 * standing up off the face with a groove between it and the next, the groove opening at the middle and the last turn swelling out
 * to meet the rim. Its corners are worked out along the coil and across it, so the groove runs true. Returns the mesh and, for its
 * paint, a way to find a point on the coil.
 */
function coilFace(S: Roll['shell'], sd: number, K: number, bricks: boolean): { mesh: Mesh; at: (s: number, f: number) => { p: V3; n: V3 } } {
  const N = S.turns, r0 = S.R * 0.07, p = (S.R - r0) / (N + 1), M = N * K;
  // The spiral is wound the same way round seen from either side.
  const th = (u: number): number => 0.6 + sd * u;
  const inner = (u: number): number => r0 + (p * u) / TAU;
  const swell = (u: number): number => smooth((u - (N - 1) * TAU) / (0.85 * TAU));
  const outer = (u: number): number => { const b = inner(u) + p; return b + (S.R - b) * swell(u); };
  const pt = (u: number, f: number, k: number): V3 => {
    const r = lerp(inner(u), outer(u), f), a = th(u);
    return [sd * (domeAt(S, r) + S.h * k), r * Math.cos(a), r * Math.sin(a)];
  };
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const out: V3 = [sd, 0, 0];
  const row = (u: number): number => { const at = v.length; COIL_F.forEach((ff, j) => v.push(pt(u, ff, COIL_UP[j]))); return at; };
  const rows: number[] = [];
  for (let k = 0; k <= M; k++) rows.push(row((k / K) * TAU));
  for (let k = 0; k < M; k++) {
    const A = rows[k], Bn = rows[k + 1];
    // A brick shell's coil is laid in bricks, a lighter and a darker by turns.
    const course = bricks ? Math.floor((k * 3) / K) % 2 : 0;
    for (let j = 0; j < COIL_F.length - 1; j++) {
      const m: Mat = bricks ? (j === 0 || j === 3 ? 'stoneDark' : course ? 'horn' : 'stone') : j === 1 || j === 2 ? 'horn' : 'shell';
      f.push({ i: [A + j, Bn + j, Bn + j + 1, A + j + 1], m });
      want.push(out);
    }
  }
  // The groove at the middle, opening out from the middle of the spiral round its first turn, and the middle itself.
  const mid = v.length;
  v.push([sd * domeAt(S, 0), 0, 0]);
  for (let k = 0; k <= K; k++) {
    const a = th((k / K) * TAU);
    v.push([sd * domeAt(S, r0), r0 * Math.cos(a), r0 * Math.sin(a)]);
  }
  for (let k = 0; k < K; k++) {
    f.push({ i: [mid, mid + 1 + k, mid + 2 + k], m: 'shellDark' });
    want.push(out);
    f.push({ i: [mid + 1 + k, mid + 2 + k, rows[k + 1], rows[k]], m: 'shellDark' });
    want.push(out);
  }
  // Round the last turn, the groove between the coil and the rim, narrowing to nothing as the coil swells into it.
  const rim = v.length;
  for (let k = M - K; k <= M; k++) {
    const a = th((k / K) * TAU);
    v.push([sd * S.T, S.R * Math.cos(a), S.R * Math.sin(a)]);
  }
  for (let k = M - K, q = 0; k < M; k++, q++) {
    const u = (k / K) * TAU;
    if (swell(u) > 0.98) continue;
    f.push({ i: [rows[k] + 4, rows[k + 1] + 4, rim + q + 1, rim + q], m: 'shellDark' });
    want.push(out);
  }
  // Each end of the coil closed: where it starts at the middle and where it ends at the rim.
  const ends: Array<[number, number]> = [[rows[0], rows[1]], [rows[M], rows[M - 1]]];
  for (const [e, nb] of ends) {
    f.push({ i: [0, 1, 2, 3, 4].map((j) => e + j), m: bricks ? 'stone' : 'shell' });
    want.push(sub(v[e + 2], v[nb + 2]));
  }
  const at = (u: number, ff: number): { p: V3; n: V3 } => {
    const j = clamp(Math.round(ff * 4), 0, 4);
    return { p: pt(u, ff, COIL_UP[j] * (1 - 0.15 * Math.abs(ff - 0.5))), n: out };
  };
  return { mesh: mesh(v, woundTo(v, f, want)), at };
}

/** A box: its middle, its three axes, its half-sizes along them, and what its top (along `Z`), its ends (along `X`) and its sides are of. */
function block(c: V3, X: V3, Y: V3, Z: V3, h: V3, top: Mat, end: Mat, side: Mat, bottom: Mat = side): Mesh {
  const v: V3[] = [];
  for (const z of [-1, 1]) for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) v.push(add(c, add(add(scale(X, x * h[0]), scale(Y, y * h[1])), scale(Z, z * h[2]))));
  const f: Face[] = [
    { i: [0, 1, 2, 3], m: bottom }, { i: [4, 5, 6, 7], m: top },
    { i: [0, 1, 5, 4], m: side }, { i: [1, 2, 6, 5], m: end }, { i: [2, 3, 7, 6], m: side }, { i: [3, 0, 4, 7], m: end },
  ];
  const want: V3[] = [scale(Z, -1), Z, scale(Y, -1), X, Y, scale(X, -1)];
  return mesh(v, woundTo(v, f, want));
}

/**
 * The shell, in its own frame (its axle along `x`): its rim, a band round it rounded at its edges, and a coil on each face; speckled
 * darker. The Rollterra's rim is a ring of bricks set round it like the stones of an arch, two to its width, and the coil on each face
 * laid in bricks, with moss in the joints.
 */
function shellOf(s: Roll, n: number, K: number): Mesh {
  const S = s.shell, parts: Mesh[] = [], paints: Disc[] = [];
  // The rim: rounded over at either edge into the face.
  const N = n * 2, prof: Array<[number, number]> = [[-S.T, 1], [-S.T * 0.7, 1.035], [0, 1.045], [S.T * 0.7, 1.035], [S.T, 1]];
  const rv: V3[] = [], rf: Face[] = [], rw: V3[] = [];
  prof.forEach(([x, k]) => { for (let j = 0; j < N; j++) { const a = (j / N) * TAU; rv.push([x, S.R * k * Math.cos(a), S.R * k * Math.sin(a)]); } });
  for (let q = 0; q < prof.length - 1; q++) {
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N, A = q * N;
      rf.push({ i: [A + j, A + j2, A + N + j2, A + N + j], m: S.bricks ? 'stoneDark' : 'shell' });
      const a = ((j + 0.5) / N) * TAU;
      rw.push([0, Math.cos(a), Math.sin(a)]);
    }
  }
  parts.push(mesh(rv, woundTo(rv, rf, rw)));
  const faces = [1, -1].map((sd) => coilFace(S, sd, K, S.bricks));
  parts.push(...faces.map((c) => c.mesh));
  if (S.bricks) {
    // The ring of bricks round the rim, two to its width, each course set half a brick round from the other.
    const count = 16;
    for (const [x, off] of [[-0.48, 0], [0.48, 0.5]] as const) {
      for (let q = 0; q < count; q++) {
        const a = ((q + off) / count) * TAU, r: V3 = [0, Math.cos(a), Math.sin(a)], tg: V3 = [0, -Math.sin(a), Math.cos(a)];
        const shade = jitter(q * 3 + (x > 0 ? 50 : 0)) < 0.35 ? 'horn' : 'stone';
        parts.push(block(add(scale(r, S.R * 1.03), [x * S.T, 0, 0]), [1, 0, 0], tg, r, [S.T * 0.46, ((S.R * Math.PI) / count) * 0.9, S.R * 0.07], shade, 'stoneDark', 'stoneDark', 'stoneDark'));
      }
    }
  }
  // Speckles and, on the bricks, mortar joints across the coil and moss in some of them.
  faces.forEach((c, side) => {
    const sd = side ? -1 : 1, N2 = S.turns;
    for (let q = 0; q < 14 + 6 * s.stage; q++) {
      const id = 900 + q * 11 + side * 300, u = jitter(id) * N2 * TAU, ff = 0.25 + 0.5 * jitter(id + 1);
      const e = c.at(u, ff), r = S.R * (0.012 + 0.01 * jitter(id + 2));
      paints.push(disc(add(e.p, [sd * 0.004, 0, 0]), e.n, r, r * 0.8, 5, 'hornDark', { spin: id }));
    }
    if (S.bricks) {
      for (let k = 0; k < N2 * 6; k++) {
        const u = ((k + 0.5) / 6) * TAU;
        const pts = COIL_F.slice(1, 4).map((ff) => c.at(u, ff));
        paints.push(lineOn(pts, S.R * 0.012, 'stoneDark', 0.006));
        if (S.moss && jitter(k * 7 + side) < 0.4) {
          const e = c.at(u, 0.15 + 0.7 * jitter(k * 5 + side)), r = S.R * (0.035 + 0.03 * jitter(k * 3 + side));
          paints.push(disc(add(e.p, [sd * 0.008, 0, 0]), e.n, r * 1.3, r, 7, jitter(k + side * 9) < 0.5 ? 'moss' : 'leaf', { spin: k }));
        }
      }
    }
  });
  return merge(...parts, paint(paints));
}

/** The bricks stacked on the Rollterra's shell, in the body's frame: big bricks laid across the top of its rim a little forward, one on two. */
function stackOnShell(s: Roll): Mesh {
  const S = s.shell;
  if (!S.stack) return merge();
  const B = blockOf(s), out: Mesh[] = [];
  const at = (a: number, up: number, k: number, shade: Mat): void => {
    const rad: V3 = [0, Math.cos(a), Math.sin(a)], tg: V3 = [0, -Math.sin(a), Math.cos(a)];
    const h: V3 = [B[0] * 1.1 * k, B[1] * 0.95 * k, B[2] * 0.95 * k];
    out.push(block(add(S.c, scale(rad, S.R * 1.08 + up + h[2])), [1, 0, 0], tg, rad, h, shade, 'stoneDark', 'stoneDark'));
  };
  const step = (B[1] * 2) / S.R;
  for (let q = 0; q < S.stack; q++) at(0.95 + q * step, 0, 1, q % 2 ? 'horn' : 'stone');
  at(0.95 + step * 0.5, B[2] * 1.9, 0.9, 'stone');
  // Moss in the joints between them.
  const a = 0.95 + step * 0.5, rad: V3 = [0, Math.cos(a), Math.sin(a)];
  out.push(orb(add(S.c, scale(rad, S.R * 1.08 + B[2] * 1.8)), [B[0] * 0.8, B[1] * 0.45, B[2] * 0.5], 6, 3, 'moss'));
  return merge(...out);
}

/* ---- its frills -------------------------------------------------------------------------------- */

/**
 * A frill plate: a broad leaf of a thing tapering to a point, from `root` out along `dir`, its flat side facing `face`, cupped a
 * little down its middle and curling on toward `curl`; its root part one colour and its tip another as its colouring says, each
 * side of it, and its back a shade darker.
 */
function plate(root: V3, dir: V3, face: V3, curl: V3, len: number, wide: number, tone: number, K: number): Mesh {
  const pts: V3[] = [], widths: number[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K;
    pts.push(add(add(root, scale(dir, len * u)), scale(curl, len * 0.35 * u * u)));
    widths.push(len * wide * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(0.999, u ** 0.7))) * Math.max(0, 1 - u ** 2.5) ** 0.4);
  }
  const fronts: Array<readonly [Mat, Mat]> = [['feather', 'petal'], ['petal', 'feather'], ['leaf', 'moss']];
  const backs: Array<readonly [Mat, Mat]> = [['featherDark', 'bloom'], ['bloom', 'featherDark'], ['leafDark', 'leafDark']];
  const split = Math.round(K * 0.45);
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], ns: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const d = unit(sub(pts[Math.min(K, k + 1)], pts[Math.max(0, k - 1)]));
    const nn = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, nn)), w = widths[k], fold = 0.34;
    const r: V3[] = [add(add(pts[k], scale(side, -w)), scale(nn, fold * w)), pts[k], add(add(pts[k], scale(side, w)), scale(nn, fold * w))];
    v.push(...r, ...r);
    ns.push(nn);
  }
  for (let k = 0; k < K; k++) {
    const A = k * 6, B = A + 6, nn = unit(add(ns[k], ns[k + 1])), tip = k >= split ? 1 : 0;
    for (const j of [0, 1]) {
      f.push({ i: [A + j, A + j + 1, B + j + 1, B + j], m: fronts[tone][tip] });
      want.push(nn);
      f.push({ i: [B + 3 + j, B + 4 + j, A + 4 + j, A + 3 + j], m: backs[tone][tip] });
      want.push(scale(nn, -1));
    }
  }
  return mesh(v, woundTo(v, f, want));
}

/** The frills over its back, in the body's frame: standing out of the top of its back round the shell's rim, fanned and swept back. */
function platesOf(s: Roll, K: number): Mesh {
  const S = s.shell, out: Mesh[] = [];
  s.plates.forEach(([th, across, len, back, tone], q) => {
    for (const sd of across ? [1, -1] : [1]) {
      const x = sd * across * S.T, jt = jitter(q * 7 + (sd > 0 ? 1 : 2));
      const a = th + (sd < 0 ? 0.06 * (jt - 0.5) : 0);
      const rad: V3 = [0, Math.cos(a), Math.sin(a)], tg: V3 = [0, -Math.sin(a), Math.cos(a)];
      const root = add(S.c, add([x, 0, 0], scale(rad, S.R * 0.9)));
      const b = back + 0.1 * (jt - 0.5);
      const dir = unit(add(add(scale(rad, Math.cos(b)), scale(tg, Math.sin(b))), [sd * across * 0.9, 0, 0]));
      // Its flat side square to the row it stands in, so the side rows, leaning out, face up and out.
      const face = about(unit(cross(dir, tg)), dir, (q % 2 ? 0.55 : -0.55) * sd);
      const curl = unit(add(tg, [sd * across * 0.6, 0, 0]));
      const L = len * S.R * (0.9 + 0.2 * jt);
      // A feathered plate: a broad leaf and a narrower one beside it, splayed a little apart.
      out.push(plate(root, dir, face, curl, L, 0.52, tone, K));
      const d2 = unit(add(dir, add(scale(face, 0.12), scale(cross(face, dir), 0.28 * (q % 2 ? 1 : -1)))));
      out.push(plate(add(root, scale(tg, -L * 0.06)), d2, face, curl, L * 0.7, 0.4, tone === 2 ? 2 : 1 - tone, K));
    }
  });
  return merge(...out);
}

/** The frills behind its head, in the crest bone's frame (from `crestAt`): swept back over its neck. */
function crestOf(s: Roll, K: number): Mesh {
  const H = s.head, C = skullAt(s), at = crestAt(s), out: Mesh[] = [];
  s.crest.forEach(([x, y, z, len, tone]) => {
    for (const sd of x ? [1, -1] : [1]) {
      const e = onEgg(C, H.r, [sd * x, y, z]);
      const dir = unit(add(scale(e.n, 0.55), [sd * x * 0.3, -1, 0.35]));
      // The ones at the sides turned to face forward and out, as ears are.
      const face = unit([1 - 0.5 * x, 0.9 * x * sd, 0.2 * sd * x]);
      out.push(plate(sub(add(e.p, scale(e.n, -H.r[2] * 0.08)), at), dir, face, [sd * x * 0.3, -0.4, -0.6], len * H.r[1] * 1.6, 0.32, tone, K));
    }
  });
  return merge(...out);
}

/* ---- the head ------------------------------------------------------------------------------- */

/**
 * The head: a round skull, slate blue with clay splotches over its top, a short rounded snout ahead of it, cream under the snout and
 * the jaw, a little dark nose and a pink tip, and a smile; big dark glossy eyes on the sides of it, turned forward.
 */
function headOf(s: Roll, n: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), SC = snoutAt(s), SR = snoutR(s);
  const cream = (m: Mesh, c: V3, r: V3, below: number): Mesh => mesh(m.v, m.f.map((f) => {
    const p = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return (p[2] - c[2]) / r[2] < below ? { ...f, m: 'muzzle' as Mat } : f;
  }));
  const skull = cream(egg(C, H.r, n + 4, 7), C, H.r, -0.2);
  const snout = cream(egg(SC, SR, n + 4, 6), SC, SR, -0.05);
  const paints: Disc[] = [];
  const onSkull = (d: V3, rx: number, ry: number, m: Mat, spin = 0, sides = 8): void => {
    const e = onEgg(C, H.r, d);
    paints.push(disc(add(e.p, scale(e.n, 0.006)), e.n, rx, ry, sides, m, { spin, up: [0, 1, 0] }));
  };
  // Clay splotches over the top of its head, and a few pale specks.
  onSkull([0.15, -0.2, 1], H.r[0] * 0.32, H.r[0] * 0.24, 'mark', 0.6);
  onSkull([-0.55, 0.05, 0.8], H.r[0] * 0.2, H.r[0] * 0.14, 'mark', 1.4);
  if (s.stage) onSkull([0.8, -0.35, 0.35], H.r[0] * 0.2, H.r[0] * 0.15, 'mark', 2.1);
  for (const [x, y, z] of [[0.4, 0.3, 0.85], [-0.3, 0.4, 0.86], [0.7, -0.1, 0.65], [-0.75, -0.3, 0.5]] as Array<[number, number, number]>) onSkull([x, y, z], H.r[0] * 0.045, H.r[0] * 0.045, 'coatLight', 0, 5);
  const onSnout = (d: V3, rx: number, ry: number, m: Mat, lift = 0.006): void => {
    const e = onEgg(SC, SR, d);
    paints.push(disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, 8, m, { up: [0, 0, 1] }));
  };
  // A pink tip to the snout and a small dark nose over it.
  onSnout([0, 1, 0.05], SR[0] * 0.42, SR[2] * 0.36, 'inner');
  onSnout([0, 0.8, 0.6], SR[0] * 0.28, SR[0] * 0.16, 'nose', 0.01);
  // Its smile: a dark line from the front of the snout back round under each eye, turned up at the corner.
  for (const sd of [1, -1]) {
    const pts = Array.from({ length: 7 }, (_, q) => {
      const u = q / 6, a = lerp(0.2, 1.45, u);
      return onEgg(SC, SR, [sd * Math.sin(a), Math.cos(a), -0.38 + 0.32 * u * u]);
    });
    paints.push(lineOn(pts, pts.map((_, q) => SR[0] * 0.035 * (0.5 + 0.5 * Math.sin(Math.PI * (0.1 + 0.8 * q / 6)))), 'nose', 0.008));
  }
  return merge(skull, snout, paint(paints), eyes(s, shut));
}

/** An egg in rings of latitude, its poles up and down, so a line round it at a height runs true. */
function egg(c: V3, r: V3, n: number, rows: number): Mesh {
  const v: V3[] = [[c[0], c[1], c[2] + r[2]]], f: Face[] = [], want: V3[] = [];
  for (let k = 1; k < rows; k++) {
    const th = (Math.PI * k) / rows;
    for (let j = 0; j < n; j++) {
      const ph = (j / n) * TAU;
      v.push([c[0] + r[0] * Math.sin(th) * Math.sin(ph), c[1] + r[1] * Math.sin(th) * Math.cos(ph), c[2] + r[2] * Math.cos(th)]);
    }
  }
  v.push([c[0], c[1], c[2] - r[2]]);
  const at = (k: number, j: number): number => 1 + (k - 1) * n + (j % n), bottom = v.length - 1;
  const push = (i: number[]): void => { f.push({ i, m: 'coat' }); want.push(sub(scale(i.reduce((t, q) => add(t, v[q]), [0, 0, 0] as V3), 1 / i.length), c)); };
  for (let j = 0; j < n; j++) {
    push([0, at(1, j), at(1, j + 1)]);
    for (let k = 1; k < rows - 1; k++) push([at(k, j), at(k + 1, j), at(k + 1, j + 1), at(k, j + 1)]);
    push([bottom, at(rows - 1, j + 1), at(rows - 1, j)]);
  }
  return mesh(v, woundTo(v, f, want));
}

/** Its eyes: big and dark and glossy, a brown ring low in each, two glints; shut, a lid with a dark line along it. */
function eyes(s: Roll, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), E = s.eye, r = E.size, out: Disc[] = [];
  for (const sd of [1, -1]) {
    const q = onEgg(C, H.r, [sd * E.at[0], E.at[1], E.at[2]]), n = q.n, p = add(q.p, scale(n, 0.003));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, H.r, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    if (shut) {
      out.push(onto(disc(p, n, r * 1.12, r * 1.05, 10, 'coat', o), 0.006));
      out.push(onto(disc(add(p, scale(up, -r * 0.15)), n, r * 1.05, r * 0.13, 8, 'lid', o), 0.01));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.16, r * 1.12, 12, 'lid', o), 0.005));
    out.push(onto(disc(p, n, r, r * 0.96, 12, 'eye', o), 0.009));
    out.push(onto(disc(add(p, scale(up, -r * 0.42)), n, r * 0.7, r * 0.42, 10, 'membrane', o), 0.012));
    out.push(onto(disc(add(p, scale(up, -r * 0.3)), n, r * 0.55, r * 0.5, 10, 'eye', o), 0.014));
    out.push(onto(disc(add(add(p, scale(up, r * 0.38)), scale(across, sd * r * 0.28)), n, r * 0.34, r * 0.3, 7, 'glint', { ...o, lit: true }), 0.02));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.42)), scale(across, -sd * r * 0.3)), n, r * 0.13, r * 0.13, 5, 'glint', { ...o, lit: true }), 0.02));
  }
  return paint(out);
}

/* ---- legs and feet ------------------------------------------------------------------------------ */

/** A foot in its own frame, from the heel (or wrist) at the origin along `+y`: a broad pad and short toes, each with a long pale claw. */
function footOf(s: Roll, L: Leg, heel: number, hind: boolean, n: number): Mesh {
  const F = L.foot, w = L.w, z0 = -heel, parts: Mesh[] = [];
  const ball: V3 = [0, F, z0 + w * 0.3];
  parts.push(tube([[0, -w * 0.25, 0], [0, F * 0.5, z0 * 0.5 + w * 0.18], ball], [w * 0.9, w * 0.85, w * 0.78], [w * 0.62, w * 0.5, w * 0.4], Math.max(5, n - 2), 'coat', { seam: 'start' }));
  const T = L.toes, spread = hind ? 1.2 : 1.05, claw = [1.5, 1.7, 2.1][s.stage];
  for (let k = 0; k < T; k++) {
    const u = k / (T - 1), a = lerp(-spread * 0.5, spread * 0.5, u);
    const len = L.toe * (0.82 + 0.25 * Math.sin(Math.PI * u));
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    const tw = w * (hind ? 0.3 : 0.32);
    const tip: V3 = [ball[0] + d[0] * len, ball[1] + d[1] * len, z0 + tw * 0.75];
    parts.push(tube([add(ball, [0, 0, -w * 0.05]), tip], [tw * 1.15, tw], [tw * 0.85, tw * 0.75], 5, 'coat', { start: false }));
    parts.push(tube([add(tip, [d[0] * tw * 0.2, d[1] * tw * 0.2, tw * 0.15]), add(tip, [d[0] * tw * claw, d[1] * tw * claw, -tw * 0.6])], [tw * 0.6, 0.004], [tw * 0.5, 0.004], 4, 'claw', { start: false }));
  }
  return merge(...parts);
}

/** The upper leg, in its bone's frame: down `-z` from the hip, thick at the hip, splotched with clay. */
function upperOf(s: Roll, L: Leg, l0: number, hind: boolean, n: number, k: number, seed: number): Mesh {
  const w = L.w, top = hind ? 1.5 : 1.3, low = 0.95;
  const m = merge(
    orb([0, 0, -l0 * 0.1], [w * top, w * top, w * top * 1.05], n, k, 'coat'),
    tube([[0, 0, 0], [0, 0, -l0 * 0.55], [0, 0, -l0]], [w * top * 0.95, w * (top + low) * 0.5, w * low], [w * top * 0.95, w * (top + low) * 0.5, w * low], n, 'coat', { seam: 'start' }),
    orb([0, 0, -l0], w * low, n, k, 'coat'),
  );
  return merge(m, legBlots(w * top * 0.95, w * low, l0, seed, s.stage ? 3 : 2));
}

/** The lower leg, down `-z` from the knee to the heel. */
function lowerOf(s: Roll, L: Leg, l1: number, n: number, seed: number): Mesh {
  const w = L.w, a = 0.95, b = 0.8;
  const m = tube([[0, 0, w * 0.5], [0, 0, -l1 * 0.55], [0, 0, -l1]], [w * a, w * (a + b) * 0.5, w * b], [w * a, w * (a + b) * 0.5, w * b], n, 'coat', { seam: 'start' });
  return merge(m, legBlots(w * a, w * b, l1, seed, s.stage ? 2 : 1));
}

/** Clay splotches round a leg, `r0` round at its top and `r1` at its foot, laid on it. */
function legBlots(r0: number, r1: number, l: number, seed: number, count: number): Mesh {
  const out: Disc[] = [];
  for (let q = 0; q < count; q++) {
    const z = 0.2 + 0.6 * jitter(seed + q * 3), ang = jitter(seed + q * 5) * TAU, rr = lerp(r0, r1, z);
    const nrm: V3 = [Math.cos(ang), Math.sin(ang), 0];
    out.push(disc(add([nrm[0] * rr, nrm[1] * rr, -l * z], scale(nrm, 0.008)), nrm, rr * 0.55, rr * 0.85, 7, 'mark', { up: [0, 0, 1] }));
  }
  const onto = (v: V3): V3 => { const r = lerp(r0, r1, clamp(-v[2] / l)) + 0.006, h = Math.hypot(v[0], v[1]) || 1; return [(v[0] / h) * r, (v[1] / h) * r, v[2]]; };
  return paint(out.map((d) => ({ ...d, v: d.v.map(onto) })));
}

/** A leg's underside cream: every facet turned down more than `below` or in toward the body painted the belly's colour. */
function creamUnder(m: Mesh, xf: Xf, below: number): Mesh {
  const side = Math.sign(xf.t[0]) || 1;
  const faces = m.f.map((f) => {
    if (f.decal || f.m !== 'coat' || f.i.length < 3) return f;
    const a = m.v[f.i[0]], b = m.v[f.i[1]], c = m.v[f.i[2]], nl = unit(cross(sub(b, a), sub(c, a))), n = turn(xf, nl);
    return n[2] < -below || n[0] * side < -0.6 ? { ...f, m: 'belly' as Mat } : f;
  });
  const solid = faces.filter((f) => !f.decal), cream: Face[] = solid.filter((f) => f.m === 'belly').map((f) => ({ ...f, decal: true }));
  return mesh(m.v, [...solid, ...cream, ...faces.filter((f) => f.decal)]);
}

const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- its clay ----------------------------------------------------------------------------------- */

/** A box of clay as corners on a cube, two facets to a side each way, for `bent` to shape into a lump or a brick. */
function clayMesh(): Mesh {
  const key = (p: V3): string => p.join(',');
  const v: V3[] = [], at = new Map<string, number>(), f: Face[] = [], want: V3[] = [];
  const idx = (p: V3): number => { const k = key(p); let i = at.get(k); if (i === undefined) { i = v.length; v.push(p); at.set(k, i); } return i; };
  for (let ax = 0; ax < 3; ax++) {
    for (const sg of [-1, 1]) {
      const u = (ax + 1) % 3, w = (ax + 2) % 3;
      for (let a = -1; a < 1; a++) {
        for (let b = -1; b < 1; b++) {
          const corner = (da: number, db: number): number => { const p: V3 = [0, 0, 0]; p[ax] = sg; p[u] = a + da; p[w] = b + db; return idx(p); };
          f.push({ i: [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)], m: ax === 2 && sg < 0 ? 'bark' : 'stone' });
          const n: V3 = [0, 0, 0];
          n[ax] = sg;
          want.push(n);
        }
      }
    }
  }
  return mesh(v, woundTo(v, f, want));
}

/** The clay's corners for its form: a round lump, squashed flat, squared into a brick and patted, standing on the ground. */
function clayShape(v: readonly V3[], S: Site, f: Form): V3[] {
  const B = S.block, r = S.lump;
  return v.map((p, q) => {
    const u = unit(p), lumpy = 1 + 0.1 * (jitter(q * 3.1) - 0.5) * (1 - f.square);
    const lump: V3 = [u[0] * r * 1.05 * lumpy, u[1] * r * lumpy, (u[2] + 1) * r * 0.85 * lumpy];
    const flat: V3 = [u[0] * r * 1.35 * lumpy, u[1] * r * 1.3 * lumpy, (u[2] + 1) * r * 0.5];
    const brick: V3 = [p[0] * B[0], p[1] * B[1], (p[2] + 1) * B[2] * (1 - 0.12 * f.pat)];
    return mixV(mixV(lump, flat, f.squash), brick, f.square);
  });
}

/** Its site: the stack of bricks at its right, two crossed under one, and the heap of clay lumps at its left, about the spot it works. */
function siteMesh(s: Roll): Mesh {
  const S = siteOf(s), B = S.block, out: Mesh[] = [];
  const st = sub(S.stack, S.at), hp = sub(S.heap, S.at);
  for (const sd of [-1, 1]) out.push(block(add(st, [sd * B[1] * 1.04, 0, B[2]]), [0, 1, 0], [-1, 0, 0], [0, 0, 1], [B[0], B[1], B[2]], 'stone', 'horn', 'stoneDark', 'bark'));
  out.push(block(add(st, [0, 0, B[2] * 3]), [1, 0, 0], [0, 1, 0], [0, 0, 1], B, 'stone', 'horn', 'stoneDark', 'bark'));
  const r = S.lump;
  for (const [x, y, z, k] of [[0, 0, 0, 0.9], [-r * 1.1, r * 0.5, 0, 0.8], [r * 0.2, -r * 1.0, 0, 0.75], [-r * 0.4, -r * 0.2, r * 1.0, 0.7]] as Array<[number, number, number, number]>) {
    out.push(orb(add(hp, [x, y, z + r * 0.75 * k]), [r * 1.05 * k, r * k, r * 0.8 * k], 7, 4, 'stone'));
  }
  return merge(...out);
}

/* ---- a stage's pieces --------------------------------------------------------------------------- */

const restBoneCache = new Map<Roll, Bones>();
function restBones(s: Roll): Bones {
  let b = restBoneCache.get(s);
  if (!b) restBoneCache.set(s, (b = rollBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 })));
  return b;
}

function rollBuild(s: Roll, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), K = lod ? 5 : 4, R = restOf(s), S = s.shell;
  const rest = restBones(s);
  // What is inside the shell or behind it, seen through it, is hidden by it: in the shell's own frame, which turns about its axle.
  const shellSolid = { c: [0, 0, 0] as V3, r: [S.T * 1.3, S.R * 0.98, S.R * 0.98] as V3 };
  const inShell = { hide: [shellSolid], hideIn: 'shell' };
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 2), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.03 }, ...inShell });
  pieces.push({ key: 'head', mesh: headOf(s, n, false), shut: headOf(s, n, true), bone: 'head', bias: 0.2, ...inShell });
  pieces.push({ key: 'crest', mesh: crestOf(s, K), bone: 'crest', bias: 0.21, after: ['head'], ...inShell });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = legOfI(s, i), [l0, l1] = R.legs[i];
    const foot = side > 0 ? footOf(s, L, R.heel[i], !fore, n) : mirroredMesh(footOf(s, L, R.heel[i], !fore, n));
    pieces.push(
      { key: `${key}0`, mesh: creamUnder(upperOf(s, L, l0, !fore, n, k, 500 + i * 37), rest[`${key}0`], 0.5), bone: `${key}0`, bias: fore ? 0.02 : 0.01, ...inShell },
      { key: `${key}1`, mesh: creamUnder(lowerOf(s, L, l1, n, 700 + i * 41), rest[`${key}1`], fore ? 0.6 : 0.4), bone: `${key}1`, bias: 0.02, ...inShell },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.015, ...inShell },
    );
  }
  // The shell over the body from the side and behind, under it from in front, where its chest and neck come out of it.
  pieces.push({ key: 'shell', mesh: shellOf(s, n, K * 4), bone: 'shell', bias: 0.03, after: ['body'], front: [0, -1, 0] });
  pieces.push({ key: 'plates', mesh: platesOf(s, K), bone: 'back', bias: 0.04, after: ['shell'], hide: [shellSolid], hideIn: 'shell' });
  if (S.stack) pieces.push({ key: 'load', mesh: stackOnShell(s), bone: 'back', bias: 0.035, after: ['shell'] });
  const St = siteOf(s), clay = clayMesh();
  pieces.push({ key: 'site', mesh: siteMesh(s), bone: 'site', bias: 0 });
  pieces.push({
    key: 'held', mesh: clay, bone: 'held', bias: 0.01,
    bent: (v, a) => clayShape(v, St, a.act?.kind === 'work' ? formOf(a.act.t) : formOf(0)),
  });
  pieces.push({ key: 'held2', mesh: mesh(clayShape(clay.v, St, formOf(0)), clay.f.map((f) => ({ ...f, i: [...f.i] }))), bone: 'next', bias: 0.01 });
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const CLAY: RGB = [196, 116, 76], CLAY_DARK: RGB = [150, 84, 56], INK: RGB = [62, 36, 30];
const DUST: RGB = [204, 170, 136];

const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
/** How much a stage's thrown things are scaled, against the Sliplet's. */
const bigOf = (s: Roll): number => s.shell.R / 0.47;

/** A gob of clay in the air: a small round lump, `r` across, inked, never under a pixel and a half. */
function gob(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.3 * px);
  g.beginPath();
  g.ellipse(x, y, r, r * 0.78, ang, 0, TAU);
  g.fillStyle = css(c, al);
  g.fill();
  g.strokeStyle = css(INK, al * 0.85);
  g.lineWidth = Math.max(0.6 * px, r * 0.24);
  g.stroke();
}

/** A puff of dust off the ground. */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0, base: RGB = DUST): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
  const c = mix(base, [252, 246, 236], 0.2 + 0.35 * age);
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + jitter(id) * TAU, d = q ? rr * 0.42 : 0, lr = rr * (q ? 0.72 : 1);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.6 - rr * 0.18 * age;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, lr);
    grad.addColorStop(0, css(c, al * (q ? 0.7 : 1)));
    grad.addColorStop(0.55, css(c, al * 0.45 * (q ? 0.7 : 1)));
    grad.addColorStop(1, css(c, 0));
    g.fillStyle = grad;
    g.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
  }
}

/** A ring on the ground at `c`, `r` across: a shock spreading from a blow. */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, r: number, rim: RGB, al: number, width: number, seed = 0): void {
  if (al <= 0.01 || r <= 0) return;
  g.beginPath();
  for (let q = 0; q < 22; q++) {
    const a = (q / 22) * TAU, k = 1 + 0.12 * (jitter(seed + q) - 0.5);
    const [x, y] = onScreen(view, [c[0] + Math.cos(a) * r * k, c[1] + Math.sin(a) * r * k, c[2]]);
    if (q) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.strokeStyle = css(rim, al);
  g.lineWidth = width;
  g.stroke();
}

/** Gobs of wet clay squeezed out as both paws slam down on the lump, and a puff of dust as the brick lands on the stack. */
function clayBits(g: CanvasRenderingContext2D, view: View, s: Roll, b: Bones, t: number, k: number, front: boolean): void {
  if (k <= 0.05) return;
  const mid = b.body.t, big = 0.5 + 0.5 * bigOf(s), T = ACT_SECS.work, S = siteOf(s);
  const since = (t - ROLL_WORK.slam) * T;
  if (since > 0 && since < 0.4) {
    for (let q = 0; q < 6; q++) {
      const id = 20 + q * 3, a = (q / 6) * TAU + jitter(id) * 0.6, sp = (0.5 + 0.5 * jitter(id + 1)) * big;
      const p = thrown(add(S.at, [0, 0, S.lump * 0.9]), [Math.cos(a) * sp, Math.sin(a) * sp, (0.9 + 0.8 * jitter(id + 2)) * big], since);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      gob(g, x, y, (0.025 + 0.02 * jitter(id + 3)) * big, id, jitter(id + 4) < 0.5 ? CLAY : CLAY_DARK, k * (1 - smooth((since - 0.25) / 0.15)));
    }
  }
  const land = (t - ROLL_WORK.set) * T, top = topOfStack(s);
  if (land > 0 && nearSide(top, mid, view) === front) puff(g, view, add(top, [0, 0, 0.02]), 0.14 * big, land / 0.35, 5);
}

/** What a strike throws: dust where it lands, gobs of clay thrown off its shell, and from the Rollterra a shock across the ground. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Roll, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid = b.body.t, since = (t - ROLL_HITS[s.stage]) * ACT_SECS.strike, S = s.shell;
  // Dust kicked up behind it as it rolls.
  if (s.stage < 2) {
    const roll = ramp(t, ROLL_STRIKE.curled, ROLL_HITS[s.stage]) * (1 - ramp(t, ROLL_HITS[s.stage], ROLL_HITS[s.stage] + 0.1));
    if (roll > 0.05) {
      const p = place(b.body, [0, S.c[1] - S.R * 0.6, -s.high]);
      if (nearSide(p, mid, view) === front) puff(g, view, [p[0], p[1], 0.04], 0.22 * big, 0.3 + 0.4 * frac(t * 6), 3);
    }
  }
  if (since <= 0) return;
  const at = s.stage < 2 ? place(b.shell, [0, S.R * 0.95, -S.R * 0.2]) : mixV(place(b.fl2, [0, 0, 0]), place(b.fr2, [0, 0, 0]), 0.5);
  const c: V3 = [at[0], at[1], 0.01];
  if (s.stage === 2 && !front) {
    const age = since / 0.35;
    if (age < 1) groundRing(g, view, c, lenOf(s) * (0.4 + 1.2 * age), [130, 96, 72], 0.7 * (1 - age), pxOf(g) * (2.2 - 1.2 * age), 7);
  }
  for (const sd of [-1, 1]) {
    const p: V3 = [c[0] + sd * 0.35 * big * (1 + 1.5 * ramp(since, 0, 0.3)), c[1] + 0.05, 0.06];
    if (nearSide(p, mid, view) === front) puff(g, view, p, 0.36 * big * (s.stage === 2 ? 1.3 : 1), since / 0.5, 7 + sd);
  }
  for (let q = 0; q < 7; q++) {
    const a = (q / 7) * TAU + jitter(q) * 0.5, sp = (0.8 + 0.6 * jitter(q + 2)) * big;
    const p = thrown([at[0], at[1], Math.max(0.1, at[2])], [Math.cos(a) * sp, Math.sin(a) * sp, (1.8 + jitter(q + 3)) * big], since);
    if (nearSide(p, mid, view) !== front || since > 0.45) continue;
    const [x, y] = onScreen(view, p);
    gob(g, x, y, 0.035 * big, q, q % 2 ? CLAY : CLAY_DARK, 1 - smooth((since - 0.3) / 0.15));
  }
}

/** Evolving: gobs of clay and flakes of frill spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Roll, b: Bones, t: number, front: boolean, frill: RGB): void {
  const big = 0.5 + 0.5 * bigOf(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], S = s.shell;
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = S.T * 2 + 0.3 * big, ry = S.R * 1.6 + 0.3 * big, high = S.R * 2.4 + 0.5 * big;
  for (let q = 0; q < 14; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 14) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.body, [Math.cos(ang) * rx * k, S.c[1] + Math.sin(ang) * ry * k, -s.high * 0.6 + u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 2 === 0) {
      const r = 0.08 * big;
      g.fillStyle = css(frill, swirl);
      g.strokeStyle = css(mix(frill, [30, 34, 50], 0.6), swirl);
      g.lineWidth = Math.max(pxOf(g) * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.42, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    } else gob(g, x, y, 0.045 * big * (1 - 0.4 * u), ang, q % 4 === 1 ? CLAY : CLAY_DARK, swirl * ramp(u, 0, 0.15));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function rollKind(look: Roll): Kind {
  const s: Roll = { ...look, body: rounded(look.body), marks: look.body };
  const bones = rollBones(s);
  let frill: RGB = [120, 150, 196];
  return {
    bones,
    build: (lod) => rollBuild(s, lod),
    // The variant's coat is its skin, a slate blue, and its frills; its markings the clay of its splotches, its shell and its bricks.
    // Its cream, its eyes and its claws are the same on every variant.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const blue = mix([118, 148, 192], mix(coat, [118, 148, 192], 0.15), 0.75 * clamp(sat(coat) / 0.2));
      const clay = mix([204, 128, 84], mix(mark, [204, 128, 84], 0.15), 0.75 * clamp(sat(mark) / 0.25));
      const tan = mix(clay, [226, 186, 140], 0.45);
      frill = mix(blue, [255, 255, 255], 0.15);
      return coatPalette(coat, mark, {
        coat: blue,
        coatDark: mix(blue, [40, 52, 80], 0.3),
        coatLight: mix(blue, [246, 248, 252], 0.6),
        mark: mix(clay, [222, 170, 120], 0.25),
        belly: [244, 232, 210],
        muzzle: [246, 236, 216],
        inner: [224, 150, 140],
        nose: [56, 40, 44],
        lid: [36, 28, 34],
        eye: [30, 22, 26],
        membrane: [104, 66, 48],
        glint: [255, 254, 248],
        claw: [240, 228, 206],
        pad: [214, 200, 186],
        shell: tan,
        shellDark: mix(clay, [92, 52, 36], 0.45),
        horn: mix(tan, [246, 222, 182], 0.3),
        hornDark: mix(clay, [96, 56, 40], 0.5),
        feather: mix(blue, [255, 255, 255], 0.12),
        featherDark: mix(blue, [44, 56, 88], 0.3),
        petal: mix(clay, [236, 178, 124], 0.25),
        bloom: mix(clay, [120, 66, 44], 0.3),
        leaf: [130, 156, 84],
        leafDark: [92, 118, 62],
        moss: [150, 170, 82],
        stone: clay,
        stoneDark: mix(clay, [96, 54, 38], 0.4),
        bark: mix(clay, [70, 40, 30], 0.45),
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.shell.R * 1.05 + lenOf(s) * 0.25, s.shell.T * 1.35],
    stride: 1.2,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    leaps: [false, false],
    motes: [[206, 132, 88], [140, 168, 210]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') clayBits(g, view, s, b, act.t, downOf(act.t, a.graze), front);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front, frill);
    },
  };
}

export const SLIPLET = rollKind(SLIPLET_LOOK);
export const WHEELMOTE = rollKind(WHEELMOTE_LOOK);
export const ROLLTERRA = rollKind(ROLLTERRA_LOOK);
