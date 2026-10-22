import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The toad line: the Mosskip, a small round toad with a cap of leafy moss
 * tufts over its head and back and a few pink crystal chips in its sides,
 * which grows into the Craghopper, bigger and squat, its back armoured in
 * mossy rock clumps and pointed pink crystal shards, moss hanging down its
 * flanks and over its thighs; and then the Bastiontoad, large and heavy on
 * four thick legs with dark claws, a fortress of mossy rock and great pink
 * crystal spires over its back, its shoulders and its haunches. All three
 * are moss green mottled darker, cream at the throat and belly, with rosy
 * cheeks, a wide mouth and peach toes; the first two look out of big golden
 * eyes, the Bastiontoad out of smug half-lidded red-brown ones. The species is
 * still `bogga` underneath, as saves and the database know it: the peat
 * cutter, that cuts peat and tar from the bog and brings it home.
 *
 * Built the way the frog line is (`./wild-frog`): one set of functions from a
 * description of the stage (`Toad`), every foot given a point on the ground to
 * be at and its leg bent to reach it, so a planted foot stays where it was put.
 * It walks a toad's waddle, the diagonals together, its weight rolling from
 * side to side and its belly bouncing at each footfall; the two smaller ones
 * run in short heavy hops, landing squashed, and the Bastiontoad lumbers.
 *
 * At its task it digs: each forefoot in turn raked down through the peat in
 * front of it, crumbs of peat thrown back, then both together under the cut
 * to lever a block of peat up out of the bog, and its head down to shove the
 * block across to its stack, and back. Its crystals catch the light, a glint
 * opening on one tip after another.
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

/** A thing on its back, by where it stands: along the body (-1 its rump to 1 its shoulders), round it from its right side (radians; a quarter turn is the ridge), and how big. */
type Spot = readonly [number, number, number];
/** A crystal: where it stands, how long it is, and how far it is swept back (radians). */
type Shard = readonly [number, number, number, number];

interface Toad {
  stage: 0 | 1 | 2;
  body: Rings;
  marks?: Rings;
  /** How high the body's middle is carried, and how far its front is tipped up (degrees). */
  high: number;
  tilt: number;
  /**
   * The head: where it joins the body (body frame), how far forward and up its middle is from there, its half-sizes (across,
   * along, up), how far the mouth line is below its middle (a share of its height), how far its corners turn up, and its pitch.
   */
  head: { at: V3; fwd: number; up: number; r: V3; mouth: number; smile: number; pitch: number };
  /** The eyes: each on a low dome on the head, across, along and up as shares of the head's half-sizes; the dome's radius; the eye's; how far the lid is down (nought to one); the pupil's height against its width. */
  eye: { at: V3; dome: number; size: number; lid: number; round: number };
  fore: Leg;
  hind: Leg;
  /** Claws on its toes, dark; the smaller two have round pale toes. */
  claws: boolean;
  /** Its armour, each list for its right side and mirrored to its left (a spot on the ridge only once). */
  armour: {
    /** Leafy tufts of moss: on the body, and on the head (a way out of the head's middle and a size). */
    tufts: readonly Spot[]; cap: ReadonlyArray<readonly [number, number, number, number]>;
    rocks: readonly Spot[];
    shards: readonly Shard[];
    /** On each haunch and each shoulder: rocks and crystals, as a count and a size each (nought for none). */
    thigh: readonly [number, number]; shoulder: readonly [number, number];
  };
  gait: {
    duty: number; swing: [number, number];
    step: number; bob: number; roll: number; hop: number;
    /** How much its belly squashes at a footfall. */
    jiggle: number;
  };
  /** Whether it hops at a run; the Bastiontoad lumbers instead. */
  hops: boolean;
  size: number;
}

/** A Mosskip: small and round, low to the ground, a cap of leafy moss over its head and back, a few pink chips in its sides, big golden eyes. */
const MOSSKIP_LOOK: Toad = {
  stage: 0,
  body: { y: [-0.5, -0.42, -0.2, 0, 0.2, 0.36, 0.44], z: [0.02, 0.02, 0.01, 0, 0, 0.02, 0.04], w: [0.42, 0.72, 0.84, 0.86, 0.8, 0.64, 0.36], h: [0.26, 0.4, 0.47, 0.49, 0.46, 0.39, 0.24] },
  high: 0.35, tilt: 6,
  head: { at: [0, 0.34, 0.15], fwd: 0.13, up: 0.08, r: [0.58, 0.42, 0.33], mouth: 0.16, smile: 0.12, pitch: -8 },
  eye: { at: [0.52, 0.34, 0.6], dome: 0.17, size: 0.165, lid: 0.12, round: 0.92 },
  fore: { hip: [0.4, 0.26, -0.22], len: [0.22, 0.2], at: [0.5, 0.4], foot: 0.06, toe: 0.09, toes: 4, w: 0.12, turn: 16 },
  hind: { hip: [0.44, -0.26, -0.14], len: [0.28, 0.25], at: [0.66, 0.02], foot: 0.11, toe: 0.11, toes: 4, w: 0.17, turn: 28 },
  claws: false,
  armour: {
    tufts: [[0.5, 1.57, 0.3], [0.0, 1.57, 0.32], [-0.5, 1.57, 0.28], [0.3, 1.2, 0.28], [-0.25, 1.15, 0.29], [-0.72, 1.2, 0.22], [0.55, 0.85, 0.24], [0.0, 0.78, 0.25], [-0.5, 0.8, 0.22]],
    cap: [[0.3, -0.35, 0.9, 0.24], [-0.3, -0.35, 0.9, 0.24], [0, -0.15, 1, 0.22]],
    rocks: [],
    shards: [[0.25, 0.98, 0.17, 0.3], [-0.38, 0.95, 0.15, 0.4], [0.05, 0.6, 0.13, 0.2]],
    thigh: [0, 0], shoulder: [0, 0],
  },
  gait: { duty: 0.62, swing: [0.24, 0.34], step: 0.24, bob: 0.04, roll: 6, hop: 0.62, jiggle: 0.06 },
  hops: true,
  size: 3.6,
};

/** A Craghopper: bigger and squat, its back armoured in mossy rock clumps and pointed pink crystal shards, moss over its flanks and thighs, a wide smile. */
const CRAGHOPPER_LOOK: Toad = {
  stage: 1,
  body: { y: [-0.84, -0.72, -0.36, 0, 0.34, 0.6, 0.72], z: [0.02, 0.02, 0, 0, -0.02, 0, 0.02], w: [0.7, 1.18, 1.34, 1.36, 1.28, 1.04, 0.58], h: [0.48, 0.74, 0.86, 0.88, 0.84, 0.7, 0.4] },
  high: 0.7, tilt: 7,
  head: { at: [0, 0.6, 0.3], fwd: 0.16, up: 0.1, r: [0.84, 0.6, 0.46], mouth: 0.16, smile: 0.2, pitch: -10 },
  eye: { at: [0.5, 0.36, 0.6], dome: 0.22, size: 0.19, lid: 0.26, round: 0.9 },
  fore: { hip: [0.68, 0.48, -0.4], len: [0.44, 0.4], at: [0.92, 0.72], foot: 0.12, toe: 0.16, toes: 4, w: 0.25, turn: 18 },
  hind: { hip: [0.74, -0.46, -0.32], len: [0.5, 0.44], at: [1.16, 0.08], foot: 0.2, toe: 0.18, toes: 4, w: 0.31, turn: 30 },
  claws: false,
  armour: {
    tufts: [[0.45, 0.6, 0.4], [-0.08, 0.52, 0.42], [-0.58, 0.58, 0.36]],
    cap: [],
    rocks: [[0.45, 1.57, 0.34], [0.0, 1.57, 0.38], [-0.45, 1.57, 0.34], [0.58, 1.15, 0.3], [0.12, 1.08, 0.34], [-0.35, 1.1, 0.31], [-0.75, 1.2, 0.24]],
    shards: [[0.2, 1.57, 0.56, 0.6], [-0.32, 1.57, 0.5, 0.7], [0.6, 1.32, 0.4, 0.4], [-0.08, 1.3, 0.48, 0.55], [-0.6, 1.28, 0.38, 0.7], [0.32, 0.88, 0.34, 0.35]],
    thigh: [2, 0.13], shoulder: [0, 0],
  },
  gait: { duty: 0.64, swing: [0.22, 0.3], step: 0.2, bob: 0.04, roll: 6, hop: 0.42, jiggle: 0.07 },
  hops: true,
  size: 4.3,
};

/** A Bastiontoad: large and heavy on four thick legs with dark claws, a fortress of mossy rock and great pink crystal spires over its back, shoulders and haunches, smug half-lidded red-brown eyes. */
const BASTIONTOAD_LOOK: Toad = {
  stage: 2,
  body: { y: [-1.14, -1.0, -0.5, 0, 0.5, 0.86, 1.02], z: [0.04, 0.04, 0.02, 0, 0, 0.02, 0.04], w: [0.9, 1.5, 1.7, 1.72, 1.62, 1.32, 0.74], h: [0.56, 0.86, 0.96, 0.98, 0.94, 0.8, 0.46] },
  high: 1.04, tilt: 6,
  head: { at: [0, 0.86, 0.24], fwd: 0.2, up: 0.08, r: [1.06, 0.72, 0.56], mouth: 0.14, smile: 0.22, pitch: -6 },
  eye: { at: [0.5, 0.4, 0.6], dome: 0.25, size: 0.2, lid: 0.5, round: 0.8 },
  fore: { hip: [0.92, 0.6, -0.5], len: [0.6, 0.58], at: [1.2, 0.86], foot: 0.18, toe: 0.22, toes: 4, w: 0.42, turn: 16 },
  hind: { hip: [0.96, -0.62, -0.42], len: [0.64, 0.58], at: [1.34, -0.3], foot: 0.24, toe: 0.24, toes: 4, w: 0.46, turn: 26 },
  claws: true,
  armour: {
    tufts: [[0.5, 0.52, 0.46], [-0.1, 0.48, 0.5], [-0.66, 0.55, 0.42]],
    cap: [],
    rocks: [
      [0.62, 1.57, 0.46], [0.18, 1.57, 0.54], [-0.3, 1.57, 0.52], [-0.74, 1.57, 0.4], [0.48, 1.2, 0.46], [0.02, 1.14, 0.5], [-0.46, 1.16, 0.44],
      [-0.84, 1.22, 0.32], [0.66, 0.86, 0.34], [0.15, 0.78, 0.38], [-0.35, 0.8, 0.36],
    ],
    shards: [
      [-0.18, 1.57, 1.15, 0.75], [-0.62, 1.57, 0.9, 0.95], [0.42, 1.36, 0.5, 0.45], [-0.18, 1.36, 0.62, 0.65], [-0.68, 1.38, 0.5, 0.85],
      [0.6, 1.0, 0.44, 0.35], [0.12, 0.96, 0.5, 0.45], [-0.38, 0.98, 0.48, 0.6], [-0.82, 1.05, 0.36, 0.8],
    ],
    thigh: [3, 0.2], shoulder: [3, 0.2],
  },
  gait: { duty: 0.68, swing: [0.2, 0.28], step: 0.17, bob: 0.035, roll: 5, hop: 0, jiggle: 0.06 },
  hops: false,
  size: 5.1,
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
function lineOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number | readonly number[], m: Mat, lift = 0.012): Disc {
  const at = (k: number): number => (typeof w === 'number' ? w : w[Math.min(k, w.length - 1)]);
  const up = (q: { p: V3; n: V3 }, k: number, sd: number): V3 => {
    const K = pts.length, d = unit(sub(pts[Math.min(K - 1, k + 1)].p, pts[Math.max(0, k - 1)].p));
    const side = unit(cross(q.n, d));
    return add(add(q.p, scale(q.n, lift)), scale(side, sd * at(k)));
  };
  const v = [...pts.map((q, k) => up(q, k, 1)), ...[...pts].map((q, k) => up(q, k, -1)).reverse()];
  return facingDisc(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** A thin flat thing along a line of points -- a leaf of moss -- `widths` across it, its face along `face`, folded a little down its middle. */
function sheet(pts: readonly V3[], widths: readonly number[], face: V3, fold: number, mats: readonly [Mat, Mat, Mat]): Mesh {
  const K = pts.length, v: V3[] = [], f: Face[] = [], want: V3[] = [], ns: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n)), w = widths[Math.min(k, widths.length - 1)];
    const row: V3[] = [add(add(pts[k], scale(side, -w)), scale(n, fold * w)), pts[k], add(add(pts[k], scale(side, w)), scale(n, fold * w))];
    v.push(...row, ...row);
    ns.push(n);
  }
  for (let k = 0; k < K - 1; k++) {
    const A = k * 6, B = A + 6, n = unit(add(ns[k], ns[k + 1]));
    for (const j of [0, 1]) {
      f.push({ i: [A + j, A + j + 1, B + j + 1, B + j], m: mats[j] });
      want.push(n);
      f.push({ i: [B + 3 + j, B + 4 + j, A + 4 + j, A + 3 + j], m: mats[2] });
      want.push(scale(n, -1));
    }
  }
  return mesh(v, woundTo(v, f, want));
}

function about(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), sn = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), sn)), scale(k, dot(k, v) * (1 - c)));
}

/** A body's rings rounded off at its ends, as the end of an egg is. */
function rounded(R: Rings): Rings {
  const n = R.y.length, y0 = R.y[0], y1 = R.y[n - 1], mid = (y0 + y1) / 2, half = (y1 - y0) / 2;
  const core: Rings = { y: R.y.slice(1, n - 1), z: R.z.slice(1, n - 1), w: R.w.slice(1, n - 1), h: R.h.slice(1, n - 1) };
  const out: Rings = { y: [], z: [], w: [], h: [] }, N = 14, p = 2.4;
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
/** A smooth loop through keys (time, value), times nought to one in order, wrapping round. */
function loopCurve(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  const w = frac(u), n = keys.length;
  let i = n - 1;
  for (let q = 0; q < n; q++) if (keys[q][0] <= w) i = q;
  const [t0, v0] = keys[i], [t1raw, v1] = keys[(i + 1) % n];
  const t1 = i + 1 < n ? t1raw : t1raw + 1, ww = w < t0 ? w + 1 : w;
  return lerp(v0, v1, smooth((ww - t0) / Math.max(1e-6, t1 - t0)));
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Mosskip's bite, the Craghopper's belly-slam, the Bastiontoad's stomp. */
export const TOAD_HITS: readonly number[] = [0.5, 0.54, 0.56];
/** The Mosskip's mouth opening, and when the Craghopper and the Bastiontoad leave the ground or rear, as shares of the strike. */
export const TOAD_STRIKE = { open: 0.38, rise: 0.26 } as const;
/**
 * A go at its task, as shares of it: each forefoot's rake landing in the peat, the block levered up out of the cut, the shove
 * across to the stack, and the block set down on it. It loops, so a go and the next are one.
 */
export const TOAD_WORK = { rakes: [0.14, 0.32] as const, lever: 0.5, shove: [0.56, 0.78] as const, set: 0.86 } as const;
/** When it croaks as it stands about, in seconds into its loop, and for how long its throat is blown up. */
export const TOAD_CROAKS: readonly number[] = [6.2, 17.8];
export const TOAD_CROAK_LEN = 0.8;

/* ---- where its feet go ---------------------------------------------------------------- */

/**
 * A pose: where the ball of each foot is (along the ground, from under the body's middle) and how far its heel is lifted off it
 * (degrees, toes staying down); how the body is carried; the head pitched up, turned left and tilted; the jaw opened (degrees),
 * and the throat blown up (nought to one).
 */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  head: [number, number, number];
  jaw: number; throat: number;
}

interface Rest {
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
  heel: number[];
}

const rests = new Map<Toad, Rest>();
const legOfI = (s: Toad, i: number): Leg => (i < 2 ? s.fore : s.hind);
function restOf(s: Toad): Rest {
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

function restPlan(s: Toad, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    head: [0, 0, 0], jaw: 0, throat: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    jaw: m(a.jaw, b.jaw), throat: m(a.throat, b.throat),
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
    jaw: d(p.jaw, to.jaw, from.jaw), throat: d(p.throat, to.throat, from.throat),
  };
}

/** How long the body is, hip to shoulder: what its moves are measured in. */
const lenOf = (s: Toad): number => s.fore.hip[1] - s.hind.hip[1];

/** A toad's crawl: the diagonals together, the left fore with the right hind. */
const CRAWL = [0, 0.5, 0.5, 0];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/**
 * Walking, a heavy waddle, the diagonals together: each foot down for its share of a stride and swept back under the body, then
 * lifted and brought forward round out from the body. The body sinks onto each pair as it comes down, its belly squashing, and
 * rolls well over onto the side whose fore foot is down; its head swings the other way. Faster, the Bastiontoad's steps are
 * longer and its roll heavier: a lumber.
 */
function crawlPlan(s: Toad, R: Rest, a: Anim, fast = 0): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s);
  const p = restPlan(s, R);
  const duty = lerp(G.duty, 0.56, fast), amp = lerp(G.swing[0], G.swing[1], fast), step = G.step * (1 + 0.4 * fast);
  for (let i = 0; i < 4; i++) {
    const reach = R.reach[i], half = reach * amp * (i < 2 ? 0.9 : 1), A = R.ankle[i], ph = frac(a.u + CRAWL[i]);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      p.foot[i] = (i < 2 ? 10 : 18) * ramp(ph / duty, 0.72, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    const lift = step * reach * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0] + SIDE[i] * 0.08 * reach * Math.sin(Math.PI * u), y, lift];
    p.foot[i] = (i < 2 ? 10 : 18) * (1 - smooth(u / 0.7)) + (i < 2 ? -8 : -10) * hump(u, 0.75, 0.25);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.04));
  p.H += -L * G.bob * (1 + 0.5 * fast) * down;
  p.squash = G.jiggle * (1 + 0.6 * fast) * hump(frac(2 * w - 0.06), 0.12, 0.2);
  const over = Math.sin(TAU * (w + 0.25 - duty / 2));
  p.roll = G.roll * (1 + 0.5 * fast) * over;
  p.side = L * 0.035 * over;
  p.yaw = 4 * Math.sin(TAU * (w - 0.1));
  p.pitch = 2 * (down - 0.5);
  p.head = [3 * (2 * down - 1), -7 * Math.sin(TAU * (w - 0.1)), -3 * over];
  p.throat = 0.1 * (1 - down);
  return p;
}

/** A hop, as shares of a stride: the hind feet down from nought to `HOP_LIFT`, the fore from `HOP_LAND` round to `HOP_UP`. */
const HOP_LIFT = 0.5, HOP_LAND = 0.72, HOP_UP = 0.25;

/**
 * Running, the smaller two hop: short and heavy, crouched on all four, then the hind legs heave it up and forward, it is in the
 * air a moment, hind legs trailing, and it lands on its hands with a squash that runs through its belly and draws its feet in
 * under it. The air carries it the rest of the way (`Kind.leaps`).
 */
function hopPlan(s: Toad, R: Rest, a: Anim): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s), up = G.hop * s.high;
  const p = restPlan(s, R);
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, reach = R.reach[i], half = reach * G.swing[1] * (fore ? 0.7 : 1), A = R.ankle[i];
    const start = fore ? HOP_LAND : 0, duty = fore ? 1 - HOP_LAND + HOP_UP : HOP_LIFT;
    const ph = frac(w - start);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      p.foot[i] = fore ? 0 : 50 * ramp(ph / duty, 0.45, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), R2 = reach;
    if (fore) {
      const y = keysAt([[0, A[1] - half], [0.3, A[1] + 0.1 * R2], [0.62, A[1] + half + 0.05 * R2], [0.7, A[1] + half], [1, A[1] + half]], u);
      p.at[i] = [A[0] * (1 - 0.08 * Math.sin(Math.PI * u)), y, up * keysAt([[0, 0], [0.3, 0.9], [0.62, 1.0], [0.84, 0.6], [1, 0]], u)];
      p.foot[i] = -14 * Math.sin(Math.PI * u);
    } else {
      const y = keysAt([[0, A[1] - half], [0.1, A[1] - half - 0.25 * R2], [0.32, A[1] - half - 0.9 * R2], [0.62, A[1] - 0.3 * R2], [1, A[1] + half]], u);
      p.at[i] = [A[0] * (1 - 0.06 * Math.sin(Math.PI * u)), y, up * keysAt([[0, 0], [0.1, 0.7], [0.32, 1.0], [0.6, 0.9], [0.86, 0.3], [1, 0]], u)];
      p.foot[i] = 50 * (1 - smooth(u / 0.5)) + 30 * hump(u, 0.3, 0.25) - 8 * hump(u, 0.8, 0.15);
    }
  }
  p.H = s.high + up * loopCurve([[0, -0.25], [0.24, -0.2], [0.46, 0.4], [0.58, 1], [0.7, 0.55], [0.78, -0.05], [0.88, -0.32]], w);
  p.pitch = loopCurve([[0, s.tilt + 2], [0.25, s.tilt + 3], [0.46, 14], [0.56, 4], [0.66, -8], [0.74, -12], [0.86, s.tilt - 6], [0.95, s.tilt]], w) - s.tilt;
  // Its belly squashed hard as it lands and bouncing back, stretched a little in the air.
  p.squash = loopCurve([[0, 0.1], [0.12, 0.04], [0.3, 0.0], [0.46, -0.08], [0.56, -0.1], [0.68, -0.04], [0.76, 0.06], [0.82, 0.16], [0.9, 0.06]], w);
  p.surge = L * loopCurve([[0, -0.03], [0.4, 0.02], [0.6, 0.06], [0.8, 0.02]], w);
  p.head = [-0.6 * p.pitch + 3, 0, 0];
  p.throat = 0.15 * hump(w, 0.8, 0.12);
  return p;
}

function goingPlan(s: Toad, R: Rest, a: Anim): Plan {
  if (!s.hops) return crawlPlan(s, R, a, smooth(clamp(a.gait)));
  if (a.gait <= 0) return crawlPlan(s, R, a);
  if (a.gait >= 1) return hopPlan(s, R, a);
  return mixPlan(crawlPlan(s, R, a), hopPlan(s, R, a), smooth(a.gait));
}

/** How far its throat is blown up this moment as it croaks standing about, nought to one. */
function croakOf(t: number): number {
  let k = 0;
  for (const c of TOAD_CROAKS) {
    const u = (t - c) / TOAD_CROAK_LEN;
    if (u > -0.2 && u < 1.2) k = Math.max(k, ramp(u, 0, 0.25) * (1 - ramp(u, 0.75, 1)));
  }
  return k;
}

/**
 * Standing about: breathing, its throat pouch pulsing, looking about; twice a loop it croaks, its throat blown up into a great
 * cream bubble and its body swelling with it; now and then it settles its weight, and shifts a hand.
 */
function stillPlan(s: Toad, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, L = lenOf(s);
  const look = drift(t);
  p.head = [2 * cyc(t, 5) + 2 * a.breath, 12 * look, 3 * drift(t, 2)];
  p.H += 0.015 * L * (a.breath - 0.5);
  p.squash = 0.02 * (0.5 - a.breath);
  // The throat pouch going in and out, a beat a second and a little.
  p.throat = 0.1 + 0.12 * Math.max(0, Math.sin(t * TAU));
  const croak = croakOf(t);
  p.throat = Math.max(p.throat, croak);
  p.squash -= 0.05 * croak;
  p.head[0] += 5 * croak;
  p.jaw = 2 * croak;
  // Its weight settled: a little sink and a wobble through its belly.
  const settle = beat(t, [3.4, 12.0, 21.0], 0.7);
  p.H -= 0.03 * L * settle;
  p.squash += 0.05 * settle;
  // A hand shifted: the right one lifted, put down a little further out, and back.
  const shift = beat(t, [14.2], 1.2);
  if (shift > 0) {
    const A = R.ankle[1];
    p.at[1] = [A[0] + 0.04 * L * shift, A[1] + 0.03 * L * shift, R.reach[1] * 0.16 * Math.sin(Math.PI * clamp(((t - 14.2) / 1.2) * 2))];
    p.roll -= 2 * shift;
  }
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Mosskip's bite: drawn back into a crouch, a hop forward with its mouth wide, snapped shut on what is in front of it, and back. */
function lungeBite(s: Toad, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = TOAD_HITS[0], L = lenOf(s);
  const back = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.34, 0.44));
  const lunge = ramp(t, 0.34, 0.48) * (1 - ramp(t, 0.62, 0.96));
  const air = hump(t, 0.42, 0.08), jolt = hump(t, hit + 0.03, 0.06);
  p.surge = L * (-0.18 * back + 0.5 * lunge);
  p.H += L * (-0.1 * back + 0.3 * air);
  p.pitch = 6 * back - 10 * lunge + 8 * air;
  p.head = [8 * back - 4 * lunge + 6 * ramp(t, TOAD_STRIKE.open, hit - 0.04) * (1 - ramp(t, hit - 0.02, hit)), 0, 0];
  p.squash = 0.1 * back - 0.06 * air + 0.1 * jolt;
  p.jaw = 46 * ramp(t, TOAD_STRIKE.open, hit - 0.05) * (1 - ramp(t, hit - 0.03, hit));
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0], A[1] + L * 0.45, 0];
    const go = ramp(t, 0.36, hit), ret = ramp(t, 0.68 + 0.05 * i, 0.94);
    p.at[i] = t < 0.62 ? arc(A, fwd, go, R.reach[i] * 0.35) : arc(fwd, A, ret, R.reach[i] * 0.25);
  }
  for (const i of [2, 3]) p.foot[i] = 30 * hump(t, 0.4, 0.1);
  return p;
}

/** The Craghopper's belly-slam: crouched, then a heavy hop up and forward, and down on its belly onto what is in front of it. */
function bellySlam(s: Toad, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = TOAD_HITS[1], L = lenOf(s);
  const crouch = ramp(t, 0.04, 0.24) * (1 - ramp(t, TOAD_STRIKE.rise, 0.34));
  const air = ramp(t, TOAD_STRIKE.rise, 0.42) * (1 - ramp(t, 0.44, hit));
  const slam = ramp(t, 0.44, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.1 * crouch + 0.2 * air + 0.32 * slam);
  p.H += L * (-0.12 * crouch + 0.5 * air - 0.12 * slam);
  p.pitch = -4 * crouch + 16 * air - 6 * slam;
  p.head = [6 * crouch - 10 * air + 6 * slam, 0, 0];
  p.squash = 0.1 * crouch - 0.1 * air + 0.24 * jolt + 0.04 * slam;
  p.jaw = 14 * air;
  p.throat = 0.6 * air;
  for (let i = 0; i < 4; i++) {
    const A = R.ankle[i], fore = i < 2, out: V3 = [A[0] * 1.08, A[1] + L * (fore ? 0.36 : 0.2), 0];
    if (t < hit) p.at[i] = mixV(A, out, ramp(t, 0.3, hit - 0.02));
    else p.at[i] = arc(out, A, ramp(t, 0.7 + 0.05 * i, 0.94 + 0.01 * i), R.reach[i] * 0.2);
    p.at[i][2] += R.reach[i] * (fore ? 0.4 : 0.2) * air;
    p.foot[i] = fore ? -10 * air : 40 * hump(t, TOAD_STRIKE.rise + 0.04, 0.08);
  }
  return p;
}

/** The Bastiontoad's stomp: reared up on its hind legs with its forefeet high, then crashed down on them both, shaking the ground. */
function quakeStomp(s: Toad, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = TOAD_HITS[2], L = lenOf(s);
  const rear = ramp(t, 0.04, 0.4) * (1 - ramp(t, 0.44, hit));
  const down = ramp(t, 0.46, hit) * (1 - ramp(t, hit + 0.14, 0.96));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.1 * rear + 0.1 * down);
  p.H += L * (0.12 * rear - 0.08 * down);
  p.pitch = 24 * rear - 5 * down;
  p.head = [-10 * rear + 8 * down, 0, 0];
  p.squash = -0.04 * rear + 0.2 * jolt + 0.04 * down;
  p.jaw = 22 * rear * (1 - ramp(t, 0.42, hit));
  p.throat = 0.5 * rear;
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0] * 0.95, A[1] + L * 0.04, R.reach[i] * 0.75], land: V3 = [A[0] * 1.04, A[1] + L * 0.14, 0];
    if (t < hit) p.at[i] = t < 0.44 ? mixV(A, high, ramp(t, 0.06, 0.38)) : mixV(high, land, ramp(t, 0.44, hit - 0.01) ** 1.5);
    else p.at[i] = arc(land, A, ramp(t, 0.72 + 0.06 * i, 0.94), R.reach[i] * 0.18);
    p.foot[i] = -12 * rear;
  }
  for (const i of [2, 3]) p.foot[i] = 20 * rear;
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));
/** How far through the shove it is, nought to one. */
const shoveOf = (t: number): number => ramp(t, TOAD_WORK.shove[0], TOAD_WORK.shove[1]);
/** How far the block is out of the cut: flipped up by its snout from under the bog's skin, nought to one. */
const liftOf = (t: number): number => ramp(t, TOAD_WORK.lever - 0.06, TOAD_WORK.lever + 0.04);
/** How far round to its right the stack is from the cut, about the middle of its body (degrees). */
const STACK_TURN = 48;

/** A forefoot's rake, `u` nought to one through it: lifted and reached forward, driven down into the peat, and dragged back. */
function rakeOf(A: V3, reach: number, u: number): { at: V3; foot: number } {
  const y = keysAt([[0, A[1]], [0.35, A[1] + reach * 0.45], [0.5, A[1] + reach * 0.42], [0.9, A[1] - reach * 0.08], [1, A[1]]], u);
  const z = keysAt([[0, 0], [0.25, reach * 0.4], [0.4, reach * 0.34], [0.5, 0], [1, 0]], u);
  return { at: [A[0] * (1 - 0.12 * Math.sin(Math.PI * u)), y, z], foot: -26 * hump(u, 0.6, 0.35) };
}

/**
 * A go at its task: hunched over the bog in front of it, its left forefoot and then its right raked down through the peat; then
 * its head down and its snout driven in under the cut, and up, flipping the block of peat up out of the bog; then it turns to its
 * stack at its right, shoving the block along with its head, and flips it up onto the stack, and turns back. It starts and ends
 * hunched over the cut, so a go and the next are one.
 */
function workPlan(s: Toad, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s), W = TOAD_WORK;
  const duck = ramp(t, W.lever - 0.12, W.lever - 0.03) * (1 - ramp(t, W.lever - 0.02, W.lever + 0.05));
  const flip = hump(t, W.lever + 0.04, 0.07), flick = hump(t, W.set - 0.01, 0.05);
  const sh = shoveOf(t), back = ramp(t, W.set + 0.04, 0.98), turned = sh * (1 - back);
  const pushing = ramp(t, W.shove[0] - 0.04, W.shove[0] + 0.04) * (1 - ramp(t, W.set - 0.04, W.set));
  p.H -= L * (0.07 + 0.06 * duck + 0.04 * pushing);
  p.pitch = -5 - 7 * duck + 3 * flip - 3 * pushing + 3 * flick;
  p.head = [-10 - 18 * duck + 26 * flip - 8 * pushing + 22 * flick, -STACK_TURN * 0.2 * turned, 0];
  p.jaw = 6 * flip + 6 * flick;
  p.throat = 0.15 + 0.3 * flip;
  p.squash = 0.05 * hump(t, W.rakes[0] + 0.01, 0.05) + 0.05 * hump(t, W.rakes[1] + 0.01, 0.05) + 0.06 * duck;
  // Turned toward its stack at its right and leant into the shove, then round again.
  p.yaw = -STACK_TURN * 0.8 * turned;
  p.surge = L * (0.08 * duck + 0.12 * pushing);
  p.roll = 5 * pushing;
  for (let i = 0; i < 4; i++) {
    const A = R.ankle[i], reach = R.reach[i];
    // Each forefoot's rake, its weight rolling onto the other side.
    const u = i < 2 ? clamp((t - (W.rakes[i] - 0.1)) / 0.2) : 0;
    if (u > 0 && u < 1) {
      const r = rakeOf(A, reach, u);
      p.at[i] = r.at;
      p.foot[i] = r.foot;
      p.roll += (i ? 6 : -6) * Math.sin(Math.PI * u);
      p.head[2] += (i ? -4 : 4) * Math.sin(Math.PI * u);
    }
    // A step round after the body as it turns, and back, foot after foot: going, the left fore and right hind first; coming
    // back, the others.
    const k = [0, 1, 1, 0][i], go = ramp(t, W.shove[0] + 0.02 + 0.07 * k, W.shove[0] + 0.1 + 0.07 * k), ret = ramp(t, W.set + 0.03 + 0.05 * (1 - k), W.set + 0.1 + 0.05 * (1 - k));
    const st = go * (1 - ret);
    if (st > 0.001) {
      const a = -STACK_TURN * 0.8 * DEG, to: V3 = [A[0] * Math.cos(a) - A[1] * Math.sin(a), A[0] * Math.sin(a) + A[1] * Math.cos(a), 0];
      const lift = reach * (i < 2 ? 0.2 : 0.1) * (Math.sin(Math.PI * go) + Math.sin(Math.PI * ret));
      p.at[i] = add(mixV(p.at[i], to, st), [0, 0, lift]);
    }
  }
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched down small as the light gathers, then up tall at the turn with its throat blown up, a shake, and settled. */
function evolvePlan(s: Toad, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.06 * hunch + 0.08 * up);
  p.pitch = -4 * hunch + 10 * up;
  p.head = [-10 * hunch + 10 * up, 6 * shake, 10 * shake];
  p.roll = 4 * shake;
  p.squash = 0.1 * hunch - 0.06 * up + 0.08 * hump(t, 0.72, 0.05);
  p.throat = up;
  p.jaw = 6 * up;
  for (const i of [2, 3]) p.foot[i] = 20 * up;
  return p;
}

/** How much of a leg's reach any foot may take before the body is let down to it. */
const MOST_REACH = 0.94;

function heelOf(s: Toad, R: Rest, i: number, at: V3, lift: number): V3 {
  const L = legOfI(s, i), h = footHeading(i, L), F = L.foot, c = Math.cos(lift * DEG), sn = Math.sin(lift * DEG);
  return [at[0] - h[0] * F * c, at[1] - h[1] * F * c, at[2] + R.heel[i] + F * sn];
}
function footHeading(i: number, L: Leg): V3 {
  const a = SIDE[i] * -L.turn * DEG;
  return [-Math.sin(a), Math.cos(a), 0];
}

function seated(s: Toad, R: Rest, p: Plan): Plan {
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
  const H = p.H - Math.max(0, drop);
  const body2 = joint(ROOT, [p.side, p.surge, H], s.tilt + p.pitch, p.roll, p.yaw);
  for (let i = 0; i < 4; i++) {
    const hip = place(body2, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), D = len3(d);
    if (D > L) at[i] = add(at[i], scale(d, L / D - 1));
  }
  return { ...p, at, H };
}

function posedOf(s: Toad, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([lungeBite, bellySlam, quakeStomp][s.stage](s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/**
 * A leg bent to put its heel (or wrist) at `ankle`: the hind leg's knee forward, out and up beside the body, the fore leg's elbow
 * back and out, always the same way round.
 */
function legOf(s: Toad, R: Rest, body: Xf, i: number, ankle: V3, heading: V3, lift: number): [Xf, Xf, Xf] {
  const fore = i < 2, [l0, l1] = R.legs[i];
  const hip = place(body, R.hip[i]), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = len3(d);
  const Dc = clamp(D, Math.abs(l0 - l1) + 0.05 * (l0 + l1), (l0 + l1) * 0.985);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit(fore ? [SIDE[i] * 0.75, -0.7, 0.15] : [SIDE[i] * 0.6, 0.8, 0.45]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], heading);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], -lift)];
}

const skullAt = (s: Toad): V3 => [0, s.head.fwd, s.head.up];
const hingeAt = (s: Toad): V3 => { const H = s.head; return [0, H.fwd - H.r[1] * 0.55, H.up - H.r[2] * H.mouth]; };
const throatAt = (s: Toad): V3 => { const H = s.head, hg = hingeAt(s); return [0, H.fwd + H.r[1] * 0.15 - hg[1], -H.r[2] * 0.6]; };

/** Where its peat is as it works, worked out once for a stage: the cut in front of it and its stack at its right. */
interface Site { cut: V3; stack: V3; block: V3 }
const sites = new Map<Toad, Site>();
/** A block of peat's half-sizes: across, along and up. */
const blockOf = (s: Toad): V3 => { const k = lenOf(s); return [0.24 * k, 0.16 * k, 0.1 * k]; };
function siteOf(s: Toad): Site {
  const had = sites.get(s);
  if (had) return had;
  const H = s.head, B = blockOf(s);
  // The cut just in front of its snout, and the stack as far out round to its right.
  const d = H.at[1] + H.fwd + H.r[1] * 0.95 + B[1] * 1.1, a = STACK_TURN * DEG;
  const S = { cut: [0, d, 0] as V3, stack: [d * Math.sin(a), d * Math.cos(a), 0] as V3, block: B };
  sites.set(s, S);
  return S;
}
/** The top course of the stack, where the block it flips up each go comes to rest. */
const topOfStack = (s: Toad): V3 => { const S = siteOf(s); return add(S.stack, [0, 0, S.block[2] * 5]); };

function toadBones(s: Toad): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], s.tilt + P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = P.squash >= 0 ? trunkOf(body, P.squash) : scaled(body, [1 + 0.35 * P.squash, 1 - 1.4 * P.squash, 1 + 0.35 * P.squash]);
    b.head = joint(body, s.head.at, s.head.pitch + P.head[0], P.head[2], P.head[1]);
    b.jaw = joint(b.head, hingeAt(s), -P.jaw);
    const th = 0.72 + 1.1 * P.throat;
    b.throat = scaled(joint(b.jaw, throatAt(s), 0), [th, th * 0.9, th]);
    for (let i = 0; i < 4; i++) {
      const L = legOfI(s, i), g = P.at[i];
      const heading = footHeading(i, L);
      const heel = heelOf(s, R, i, [g[0], g[1], Math.max(0, g[2])], P.foot[i]);
      const [u, l, f] = legOf(s, R, body, i, heel, heading, P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
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
      const g = smooth((k - 0.03) / 0.5), S = siteOf(s);
      if (g > 0.01) {
        b.site = { m: [g, 0, 0, 0, g, 0, 0, 0, g], t: S.stack };
        b.bog = { m: [g, 0, 0, 0, g, 0, 0, 0, g], t: S.cut };
        // The block: up out of the cut, tipped as it is levered, shoved across, and set square on the stack, where it is the stack's top.
        const up = liftOf(t), sh = shoveOf(t);
        if (a.act?.kind === 'work' && up > 0.01 && t < TOAD_WORK.set + 0.04) {
          const B = S.block, d = S.cut[1], ang = STACK_TURN * DEG * sh;
          // Round an arc from the cut to the foot of the stack, then flipped up onto its top course.
          const onArc: V3 = [d * Math.sin(ang), d * Math.cos(ang), B[2] * lerp(-0.8, 1, up)];
          const flip = ramp(t, TOAD_WORK.shove[1] - 0.01, TOAD_WORK.set), top = topOfStack(s);
          const p = mixV(onArc, top, flip), hop = B[2] * 3 * Math.sin(Math.PI * flip) + B[2] * 2.5 * hump(t, TOAD_WORK.lever + 0.03, 0.06);
          const tip = 40 * hump(t, TOAD_WORK.lever + 0.03, 0.07) - 30 * Math.sin(Math.PI * flip);
          b.peat = joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: add(p, [0, 0, hop]) }, [0, 0, 0], tip, 0, -STACK_TURN * sh);
        }
      }
    }
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------------------- */

const marksOf = (s: Toad): Rings => s.marks ?? s.body;
/** How much a stage's small things are scaled, against the Craghopper's. */
const bigOf = (s: Toad): number => lenOf(s) / 0.94;

/** A painted blob lying on the body, every corner laid back onto the body's own curve. */
function blotOn(s: Toad, y: number, th: number, rx: number, ry: number, m: Mat, spin: number, id: number, sides = 9): Disc {
  const q = onRings(s.body, y, th), d = disc(add(q.p, scale(q.n, 0.01)), q.n, rx, ry, sides, m, { spin, up: [0, 0, 1] });
  return {
    ...d, v: d.v.map((v, k) => {
      const c = add(q.p, scale(sub(v, q.p), 0.82 + 0.3 * jitter(id * 13 + k)));
      const r = ringAt(s.body, c[1]), a = Math.atan2((c[2] - r.z) / r.h, c[0] / r.w);
      const e = onRings(s.body, c[1], a);
      return add(e.p, scale(e.n, 0.012 * bigOf(s)));
    }),
  };
}

/** Whether a point on the body is in its cream belly: under it, and up the front of its chest. */
function inBelly(s: Toad, c: V3): boolean {
  const M = marksOf(s), r = ringAt(s.body, c[1]), up = (c[2] - r.z) / r.h, front = (c[1] - M.y[2]) / (M.y[6] - M.y[2]);
  const across = Math.abs(c[0]) / r.w;
  return up < -0.05 - 0.15 * across || (front > 0 && across < 0.9 && up < 0.3 + 1.1 * front - 0.6 * across * across);
}

/** The body: moss green, cream underneath and up the front of its chest, mottled darker green over its flanks, a few pale warts. */
function barrelOf(s: Toad, n: number): Mesh {
  const B = s.body;
  const m0 = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, 'coat');
  const body = mesh(m0.v, m0.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m0.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return inBelly(s, c) ? { ...f, m: 'belly' as Mat } : f;
  }));
  const M = marksOf(s), spots: Disc[] = [];
  for (let q = 0; q < 12; q++) {
    const id = 300 + q * 7, sd = q % 2 ? 1 : -1;
    const y = lerp(M.y[1], M.y[5], jitter(id)), up = lerp(-0.25, 0.7, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.17 + 0.1 * jitter(id + 2)) * r.w;
    if (inBelly(s, onRings(s.body, y, th).p)) continue;
    spots.push(blotOn(s, y, th, k * 1.3, k * 0.85, 'mark', jitter(id + 4) * 3, id));
  }
  // Pale warts, a few, on its flanks.
  for (let q = 0; q < 8; q++) {
    const id = 700 + q * 5, sd = q % 2 ? 1 : -1;
    const y = lerp(M.y[1], M.y[5], jitter(id)), up = lerp(-0.1, 0.6, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.05 + 0.03 * jitter(id + 2)) * r.w;
    if (inBelly(s, onRings(s.body, y, th).p)) continue;
    spots.push(blotOn(s, y, th, k, k, 'coatLight', 0, id, 6));
  }
  const cream = paint(body.f.filter((f) => f.m === 'belly').map((f) => ({ v: f.i.map((i) => body.v[i]), m: 'belly' as Mat })));
  return merge(body, cream, paint(spots));
}

/* ---- its armour --------------------------------------------------------------------------------- */

/**
 * A clump of mossy rock: a lump of `n` sides standing along `up`, its corners knocked off true so no two are alike, moss over
 * its top and down its upper sides and pale pink-grey stone showing round its foot.
 */
function clump(c: V3, r: V3, up: V3, seed: number, n = 6): Mesh {
  const [X, Y, Z] = frameOf(up, [0, 1, 0]);
  const rings: Array<[number, number]> = [[-0.6, 0.86], [0.05, 1], [0.6, 0.78], [1, 0.32]];
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const spin = jitter(seed + 0.5) * TAU;
  const at = (x: number, y: number, z: number): V3 => add(c, add(add(scale(X, x * r[0]), scale(Y, y * r[1])), scale(Z, z * r[2])));
  rings.forEach(([z, k], q) => {
    for (let j = 0; j < n; j++) {
      const id = seed * 7.3 + q * 13 + j;
      const a = spin + ((j + 0.35 * (jitter(id) - 0.5)) / n) * TAU, kk = k * (1 + 0.32 * (jitter(id + 3) - 0.5));
      v.push(at(Math.cos(a) * kk, Math.sin(a) * kk, z + 0.24 * (jitter(id + 5) - 0.5)));
    }
  });
  const mid = add(c, scale(Z, r[2] * 0.2));
  const push = (idx: number[], m: Mat): void => {
    f.push({ i: idx, m });
    want.push(sub(scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / idx.length), mid));
  };
  push(Array.from({ length: n }, (_, j) => j), 'stoneDark');
  for (let q = 0; q < rings.length - 1; q++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, A = q * n;
      // Its foot stone, its middle mostly moss with stone where the moss has slipped, its top moss.
      const m: Mat = q === 0 ? (jitter(seed + j) < 0.25 ? 'leaf' : 'stone') : q === 1 ? (jitter(seed * 3 + j) < 0.3 ? 'stone' : 'leaf') : 'moss';
      push([A + j, A + j2, A + n + j2, A + n + j], m);
    }
  }
  push(Array.from({ length: n }, (_, j) => (rings.length - 1) * n + j), 'moss');
  want[0] = scale(Z, -1);
  want[want.length - 1] = Z;
  return mesh(v, woundTo(v, f, want));
}

/**
 * A crystal: a five-sided prism from its foot, a little sunk into whatever it grows from, along `dir` to a point -- its faces
 * pink, by turns lighter and deeper, one a pale facet that catches the light.
 */
function crystal(base: V3, dir: V3, len: number, w: number, seed: number): { mesh: Mesh; tip: V3 } {
  const [X, Y, Z] = frameOf(dir, Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]), n = 5;
  const spin = jitter(seed + 1.7) * TAU;
  const at = (x: number, y: number, z: number): V3 => add(base, add(add(scale(X, x), scale(Y, y)), scale(Z, z)));
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const shoulder = len * (0.62 + 0.12 * jitter(seed + 4));
  for (const [z, k] of [[-len * 0.15, 0.9], [shoulder, 1]] as const) {
    for (let j = 0; j < n; j++) {
      const a = spin + ((j + 0.25 * (jitter(seed * 3 + j) - 0.5)) / n) * TAU;
      v.push(at(Math.cos(a) * w * k, Math.sin(a) * w * k, z));
    }
  }
  const tip = at(w * 0.18 * (jitter(seed + 6) - 0.5), w * 0.18 * (jitter(seed + 7) - 0.5), len);
  v.push(tip);
  const mid = at(0, 0, len * 0.4);
  const lightJ = Math.floor(jitter(seed + 9) * n);
  const push = (idx: number[], m: Mat): void => {
    f.push({ i: idx, m });
    want.push(sub(scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / idx.length), mid));
  };
  push(Array.from({ length: n }, (_, j) => j), 'crystalDark');
  for (let j = 0; j < n; j++) {
    const j2 = (j + 1) % n;
    push([j, j2, n + j2, n + j], j === lightJ ? 'petal' : j % 2 ? 'crystalDark' : 'crystal');
    push([n + j, n + j2, 2 * n], j === lightJ || j === (lightJ + 1) % n ? 'petal' : 'crystal');
  }
  want[0] = scale(Z, -1);
  return { mesh: mesh(v, woundTo(v, f, want)), tip };
}

/** A tuft of leafy moss: a few pointed leaves splayed from one root, out the way `out` goes, a little toward `lean`. */
function tuft(root: V3, out: V3, lean: V3, len: number, id: number, K: number, count = 3): Mesh {
  const o = unit(out), d0 = unit(add(o, scale(lean, 0.9))), parts: Mesh[] = [];
  const tones: Array<readonly [Mat, Mat, Mat]> = [['moss', 'leaf', 'leaf'], ['leaf', 'moss', 'leafDark'], ['moss', 'moss', 'leaf']];
  for (let q = 0; q < count; q++) {
    const side = count === 1 ? 0 : (q / (count - 1)) * 2 - 1, lid = id * 7 + q;
    const d = unit(about(d0, o, side * 0.85 + (jitter(lid) - 0.5) * 0.3));
    const face = unit(add(o, scale(cross(d, o), (jitter(lid + 2) - 0.5) * 0.6)));
    const l = len * (1 - 0.18 * Math.abs(side)) * (0.85 + 0.3 * jitter(lid + 1));
    const tip = add(root, scale(d, l)), mid = add(add(root, scale(d, l * 0.5)), scale(face, l * 0.16));
    const widths = Array.from({ length: K }, (_, k) => Math.max(0.01, l * 0.5 * Math.sin(Math.PI * Math.min(0.999, (k / (K - 1)) ** 0.7)) ** 0.8));
    parts.push(sheet(curve(root, mid, tip, K - 1), widths, face, 0.25, tones[Math.floor(jitter(lid + 5) * 3)]));
  }
  return merge(...parts);
}

/** Where a spot on its back is, on the body (right side; `sd` -1 for its mirror on the left). */
function spotOn(s: Toad, f: number, th: number, sd: number): { p: V3; n: V3 } {
  const M = marksOf(s), y = lerp(M.y[0], M.y[6], 0.5 + 0.46 * f), q = onRings(s.body, y, sd > 0 ? th : Math.PI - th);
  return q;
}
/** Each spot of a list on both sides, the left a little different from the right; one on the ridge only once. */
function bothSides<T extends readonly number[]>(list: readonly T[], each: (x: T, sd: number, id: number) => void): void {
  list.forEach((x, q) => {
    each(x, 1, q * 2);
    if (Math.abs(x[1] - Math.PI / 2) > 0.05) each([x[0] + 0.08 * (jitter(q * 5 + 1) - 0.5), ...x.slice(1)] as unknown as T, -1, q * 2 + 1);
  });
}

/**
 * The armour on its back, in the trunk's frame: mossy rock clumps sunk into it, crystals standing out of it and between the rocks,
 * swept back, and leafy tufts of moss over it and hanging down its flanks. Returns the mesh, and each crystal's tip and the way it
 * points, for its glints.
 */
function armourOf(s: Toad, K: number): { mesh: Mesh; moss: Mesh; tips: Array<{ p: V3; d: V3; size: number }> } {
  const A = s.armour, big = bigOf(s), out: Mesh[] = [], moss: Mesh[] = [], tips: Array<{ p: V3; d: V3; size: number }> = [];
  bothSides(A.rocks, ([f, th, r], sd, id) => {
    const q = spotOn(s, f, th, sd), k = r * (0.88 + 0.24 * jitter(id + 40));
    const up = unit(add(q.n, [0, -0.15, 0.2]));
    out.push(clump(add(q.p, scale(q.n, -k * 0.25)), [k, k * 1.05, k * 0.72], up, 50 + id));
  });
  bothSides(A.shards, ([f, th, len, back], sd, id) => {
    const q = spotOn(s, f, th, sd), l = len * (0.88 + 0.24 * jitter(id + 60));
    const ridge = Math.abs(th - Math.PI / 2) < 0.05;
    const dir = unit(add(add(q.n, [0, -Math.sin(back), 0.15]), [ridge ? 0.25 * (jitter(id + 62) - 0.5) : sd * (0.25 + 0.2 * jitter(id + 61)), 0, 0]));
    const w = l * [0.45, 0.38, 0.42][s.stage];
    const c = crystal(add(q.p, scale(q.n, -w * 0.3)), dir, l, w, 80 + id);
    out.push(c.mesh);
    tips.push({ p: c.tip, d: dir, size: l });
    // A smaller one beside a big one, leaning away from it.
    if (l > 0.55 * big && s.stage === 2) {
      const d2 = unit(add(dir, [sd * 0.4, 0.15, -0.1])), c2 = crystal(add(q.p, add(scale(q.n, -w * 0.3), [sd * w * 0.9, w * 0.4, 0])), d2, l * 0.5, w * 0.62, 90 + id);
      out.push(c2.mesh);
    }
  });
  bothSides(A.tufts, ([f, th, len], sd, id) => {
    const q = spotOn(s, f, th, sd);
    // Up on the back they stand up and back; down the flanks they hang over and down.
    const lean: V3 = th > 1.2 ? [0, -0.5, 0.2] : [sd * 0.2, -0.25, -0.8];
    moss.push(tuft(add(q.p, scale(q.n, -0.01)), q.n, lean, len, 30 + id, K, th > 1.2 ? 3 : 2));
  });
  return { mesh: merge(...out), moss: merge(...moss), tips };
}

/** The Mosskip's cap: tufts of leafy moss over the top of its head behind its eyes, in the head's frame. */
function capOf(s: Toad, K: number): Mesh {
  const H = s.head, C = skullAt(s), out: Mesh[] = [];
  s.armour.cap.forEach(([x, y, z, len], q) => {
    const e = onEgg(C, H.r, [x, y, z]);
    out.push(tuft(add(e.p, scale(e.n, -0.01)), e.n, [0, -0.6, 0.1], len, 200 + q, K, 3));
  });
  return merge(...out);
}

/** Rocks and crystals on a haunch or a shoulder, in the upper leg's frame (down `-z`, out `+x` on the right). */
function limbArmour(s: Toad, L: Leg, l0: number, hind: boolean, side: number, seed: number): Mesh {
  const [count, size] = hind ? s.armour.thigh : s.armour.shoulder;
  if (!count) return merge();
  const out: Mesh[] = [], w = L.w * (hind ? [2.0, 2.0, 1.55][s.stage] : 1.15);
  for (let q = 0; q < count; q++) {
    const a = (side > 0 ? 0 : Math.PI) + (q - (count - 1) / 2) * 0.7 + 0.5 * side, z = -l0 * (hind ? 0.3 + 0.18 * q : 0.15 + 0.12 * q);
    const nrm: V3 = [Math.cos(a), Math.sin(a) * 0.4, 0.55];
    const at: V3 = [Math.cos(a) * w * 0.85, Math.sin(a) * w * 0.85, z];
    if (q % 2 === 0) out.push(clump(at, [size, size * 1.1, size * 0.75], nrm, seed + q * 7));
    const c = crystal(add(at, [0, 0, size * 0.3]), unit(add(nrm, [0, -0.3, 0.5])), size * (q % 2 ? 2.4 : 1.8), size * 0.55, seed + q * 11);
    out.push(c.mesh);
  }
  return merge(...out);
}

/* ---- the head ------------------------------------------------------------------------------- */

/** The height of the mouth line round the head at `phi` round from straight ahead (radians), in the head's frame: a wide smile. */
function mouthZ(s: Toad, phi: number): number {
  const H = s.head, k = clamp(Math.abs(phi) / 1.75);
  return H.up - H.r[2] * H.mouth + H.r[2] * (H.smile * k * k - 0.05 * (1 - k));
}

function eggBand(c: V3, r: V3, n: number, rows: number, top: (phi: number) => number, bottom: number, mat: (row: number, phi: number) => Mat, open: boolean): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= rows; k++) {
    for (let j = 0; j < n; j++) {
      const phi = (j / n) * TAU - Math.PI;
      const z0 = clamp((top(phi) - c[2]) / r[2], -0.999, 0.999), th0 = Math.acos(z0), th = lerp(th0, Math.acos(bottom), k / rows);
      v.push([c[0] + r[0] * Math.sin(th) * Math.sin(phi), c[1] + r[1] * Math.sin(th) * Math.cos(phi), c[2] + r[2] * Math.cos(th)]);
    }
  }
  for (let k = 0; k < rows; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, a = k * n + j, b = k * n + j2, cc = (k + 1) * n + j2, d = (k + 1) * n + j;
      const mid = scale(add(add(v[a], v[b]), add(v[cc], v[d])), 0.25);
      f.push({ i: [a, b, cc, d], m: mat(k, ((j + 0.5) / n) * TAU - Math.PI) });
      want.push(sub(mid, c));
    }
  }
  if (!open) {
    f.push({ i: Array.from({ length: n }, (_, j) => j), m: mat(0, 0) });
    want.push([0, 0, 1]);
  }
  return mesh(v, woundTo(v, f, want));
}

/**
 * The head: a broad flat dome of green, mottled darker behind its eyes, two little nostrils, rosy cheeks under its eyes, and the
 * line of its wide smile; under the mouth line the inside of its mouth, which shows only when the jaw drops. Its eyes sit on low
 * domes at the front corners of the top of its head.
 */
function headOf(s: Toad, n: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const top = eggBand(C, H.r, n + 4, 6, () => C[2] + H.r[2] * 0.999, -0.999, () => 'coat', true);
  const skull = mesh(top.v, top.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, top.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const phi = Math.atan2(c[0] - C[0], c[1] - C[1]);
    return c[2] < mouthZ(s, phi) - H.r[2] * 0.12 ? { ...f, m: 'inner' as Mat } : f;
  }));
  const out: Mesh[] = [skull], blots: Disc[] = [];
  for (const [x, y, z, k] of [[0, -0.45, 0.9, 0.3], [0.75, -0.45, 0.45, 0.16], [-0.75, -0.45, 0.45, 0.16], [0.3, 0.2, 0.92, 0.1], [-0.25, -0.05, 0.97, 0.09]] as Array<[number, number, number, number]>) {
    const e = onEgg(C, H.r, [x, y, z]);
    blots.push(disc(add(e.p, scale(e.n, 0.008)), e.n, H.r[0] * k * 1.2, H.r[0] * k * 0.8, 8, 'mark', { spin: x * 2 }));
  }
  for (const sd of [1, -1]) {
    const e = onEgg(C, H.r, [sd * 0.16, 0.9, 0.42]);
    blots.push(disc(add(e.p, scale(e.n, 0.008)), e.n, H.r[0] * 0.045, H.r[0] * 0.032, 6, 'nose', { spin: sd * 0.5 }));
    // Rosy cheeks, under and a little behind each eye, over the corner of its mouth.
    const ch = onEgg(C, H.r, [sd * 0.78, 0.55, 0.05]);
    blots.push(disc(add(ch.p, scale(ch.n, 0.01)), ch.n, H.r[0] * 0.17, H.r[0] * 0.11, 9, 'shell', { up: [0, 0, 1] }));
  }
  const lip = Array.from({ length: 15 }, (_, q) => {
    const phi = lerp(-1.8, 1.8, q / 14), z = mouthZ(s, phi) + H.r[2] * 0.02;
    const zz = clamp((z - C[2]) / H.r[2], -0.99, 0.99), sn = Math.sqrt(1 - zz * zz);
    return onEgg(C, H.r, [Math.sin(phi) * sn, Math.cos(phi) * sn, zz]);
  });
  blots.push(lineOn(lip, lip.map((_, q) => H.r[0] * 0.024 * (0.4 + 0.6 * Math.sin(Math.PI * (0.05 + 0.9 * q / 14)))), 'nose', 0.012));
  out.push(paint(blots));
  for (const sd of [1, -1]) {
    const dc = domeAt(s, sd), r = s.eye.dome;
    out.push(orb(dc, [r, r * 0.95, r * 0.85], n, 5, 'coat'));
    out.push(eyeOf(s, sd, shut));
  }
  return merge(...out);
}

const domeAt = (s: Toad, sd: number): V3 => { const H = s.head, E = s.eye, C = skullAt(s); return [sd * H.r[0] * E.at[0], C[1] + H.r[1] * E.at[1], C[2] + H.r[2] * E.at[2]]; };
/** The way an eye looks, out of its dome: out to its side, forward, and up a little. */
const eyeDir = (sd: number): V3 => unit([sd * 0.55, 0.75, 0.38]);

/**
 * An eye: a big round iris, golden, deeper toward its foot, a dark pupil and two glints; its lid of green down over the top of it
 * as far as the stage says -- a little on the young ones, half way on the Bastiontoad, which looks out smugly -- with a dark line
 * along the lid's edge.
 */
function eyeOf(s: Toad, sd: number, shut: boolean): Mesh {
  const E = s.eye, dc = domeAt(s, sd), R: V3 = [E.dome, E.dome * 0.95, E.dome * 0.85];
  const q = onEgg(dc, R, eyeDir(sd)), n = q.n, p = add(q.p, scale(n, 0.004));
  const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
  const o = { at: add(q.p, scale(n, -E.dome * 0.08)), up: [0, 0, 1] as V3 };
  const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(dc, R, sub(v, dc)); return add(e.p, scale(e.n, lift)); }) });
  const r = E.size, out: Disc[] = [];
  if (shut) {
    out.push(onto(disc(p, n, r * 1.15, r * 1.15, 10, 'coat', o), 0.006));
    out.push(onto(disc(add(p, scale(up, -r * 0.2)), n, r * 1.05, r * 0.14, 8, 'lid', o), 0.012));
    return paint(out);
  }
  out.push(onto(disc(p, n, r * 1.14, r * 1.14, 12, 'lid', o), 0.006));
  out.push(onto(disc(p, n, r, r, 12, 'bloom', o), 0.01));
  out.push(onto(disc(add(p, scale(up, -r * 0.32)), n, r * 0.8, r * 0.5, 10, 'billDark', o), 0.012));
  out.push(onto(disc(p, n, r * 0.5, r * 0.5 * E.round, 10, 'eye', o), 0.016));
  out.push(onto(disc(add(add(p, scale(up, r * 0.36)), scale(across, sd * r * 0.3)), n, r * 0.26, r * 0.26, 6, 'glint', { ...o, lit: true }), 0.022));
  out.push(onto(disc(add(add(p, scale(up, -r * 0.4)), scale(across, -sd * r * 0.28)), n, r * 0.11, r * 0.11, 5, 'glint', { ...o, lit: true }), 0.022));
  // The lid: green over the top of it, down as far as the stage says, its lower edge a dark line, tipped down a little at the outer corner.
  const hh = r * 0.8, edge = r * (1 - 2 * E.lid), c = add(p, scale(up, edge + hh));
  const spin = -sd * 0.12 * E.lid;
  out.push(onto(disc(c, n, r * 1.32, hh, 10, 'coat', { ...o, spin }), 0.024));
  out.push(onto(disc(add(p, scale(up, edge + r * 0.02)), n, r * 1.08 * Math.sqrt(Math.max(0.15, 1 - (edge / r) ** 2)), r * 0.09, 8, 'lid', { ...o, spin }), 0.026));
  return paint(out);
}

function headSolids(s: Toad): Array<{ c: V3; r: V3 }> {
  const H = s.head, E = s.eye;
  return [{ c: skullAt(s), r: scale(H.r, 0.92) }, ...[1, -1].map((sd) => ({ c: domeAt(s, sd), r: [E.dome * 0.8, E.dome * 0.8, E.dome * 0.8] as V3 }))];
}

/** The lower jaw, in its own frame from its hinge: the head's egg a little fuller under the mouth line, cream. */
function jawOf(s: Toad, n: number): Mesh {
  const H = s.head, C = skullAt(s), hg = hingeAt(s), k = 1.04;
  const r: V3 = [H.r[0] * k, H.r[1] * k, H.r[2] * k];
  // Its back, where the head meets the body, green: seen from behind with its head down, that is the nape and not the chin.
  const m = eggBand(C, r, n + 4, 4, (phi) => mouthZ(s, phi), -0.98, (row, phi) => (Math.abs(phi) > 2.1 ? 'coat' : row === 0 ? 'muzzle' : 'belly'), true);
  return flat(mesh(m.v.map((p) => sub(p, hg)), m.f));
}

/** A mesh with its own faces painted over it again, flat, so cream under a chin is cream from above. */
function flat(m: Mesh): Mesh {
  return merge(m, paint(m.f.map((f) => ({ v: f.i.map((i) => m.v[i]), m: f.m }))));
}

/** The pouch of its throat, in its own frame, blown up by the bone's scale. */
function throatOf(s: Toad, n: number): Mesh {
  const H = s.head;
  return flat(orb([0, 0, 0], [H.r[0] * 0.64, H.r[1] * 0.55, H.r[2] * 0.6], n, 5, 'muzzle'));
}

/* ---- legs and feet ------------------------------------------------------------------------------ */

/**
 * A foot in its own frame, from the heel (or wrist) at the origin along `+y`, the ground `heel` under it: the back of the foot,
 * then short thick toes splayed from the ball, each a round peach nub -- or, on the Bastiontoad, pale with a dark claw.
 */
function footOf(s: Toad, L: Leg, heel: number, hind: boolean, n: number): Mesh {
  const F = L.foot, w = L.w, z0 = -heel, parts: Mesh[] = [];
  const ball: V3 = [0, F, z0 + w * 0.3];
  parts.push(tube([[0, -w * 0.25, 0], [0, F * 0.5, z0 * 0.5 + w * 0.18], ball], [w * 0.85, w * 0.78, w * 0.7], [w * 0.6, w * 0.5, w * 0.4], Math.max(5, n - 2), 'coat', { seam: 'start' }));
  const T = L.toes, spread = hind ? 1.25 : 1.1;
  for (let k = 0; k < T; k++) {
    const u = k / (T - 1), a = lerp(-spread * 0.5, spread * 0.5, u);
    const len = L.toe * (0.82 + 0.25 * Math.sin(Math.PI * u));
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    const tw = w * (hind ? 0.3 : 0.34);
    const tip: V3 = [ball[0] + d[0] * len, ball[1] + d[1] * len, z0 + tw * 0.75];
    parts.push(tube([add(ball, [0, 0, -w * 0.05]), tip], [tw * 1.15, tw], [tw * 0.85, tw * 0.75], 5, 'pad', { start: false }));
    parts.push(orb(add(tip, [d[0] * tw * 0.3, d[1] * tw * 0.3, -tw * 0.1]), [tw * 1.05, tw * 1.1, tw * 0.75], 6, 3, 'pad'));
    if (s.claws) parts.push(tube([add(tip, [d[0] * tw * 0.6, d[1] * tw * 0.6, 0]), add(tip, [d[0] * tw * 1.7, d[1] * tw * 1.7, -tw * 0.55])], [tw * 0.45, 0.004], [tw * 0.38, 0.004], 4, 'claw', { start: false }));
  }
  return merge(...parts);
}

/** The thigh (or upper arm), in its bone's frame: down `-z` from the hip, fat at the hip, mottled, and armoured as the stage is. */
function upperOf(s: Toad, L: Leg, l0: number, hind: boolean, side: number, n: number, k: number, seed: number): Mesh {
  // The smaller two's haunch is a toad's fat drumstick folded beside it; the Bastiontoad's a thick column, for its weight.
  const w = L.w, top = hind ? 2.0 : 1.2, low = hind ? 1.1 : 0.95, fat = hind ? [2.1, 2.1, 1.6][s.stage] : 1;
  const m = hind
    ? merge(orb([0, 0, -l0 * 0.48], [w * fat, w * fat * 0.95, l0 * 0.68], n + 1, k + 1, 'coat'), orb([0, 0, -l0], w * low, n, k, 'coat'))
    : merge(
      orb([0, 0, -l0 * 0.1], [w * top, w * top, w * top * 1.05], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -l0 * 0.55], [0, 0, -l0]], [w * top * 0.95, w * (top + low) * 0.5, w * low], [w * top * 0.95, w * (top + low) * 0.5, w * low], n, 'coat', { seam: 'start' }),
      orb([0, 0, -l0], w * low, n, k, 'coat'),
    );
  const blots: Disc[] = [];
  const count = hind ? 5 : 2;
  for (let q = 0; q < count; q++) {
    const z = -l0 * (0.2 + 0.6 * (q / Math.max(1, count - 1))), a = (q / count) * TAU + jitter(q * 3 + (hind ? 9 : 2)) * 1.2;
    const rr = hind ? w * fat * 0.98 * Math.sqrt(Math.max(0.2, 1 - ((z + l0 * 0.48) / (l0 * 0.68)) ** 2)) : lerp(w * top * 0.95, w * low, -z / l0), nrm: V3 = [Math.cos(a), Math.sin(a), 0];
    blots.push(disc(add([nrm[0] * rr, nrm[1] * rr, z], scale(nrm, 0.01)), nrm, rr * 0.55, rr * 0.95, 8, q % 2 ? 'spot' : 'mark', { up: [0, 0, 1] }));
  }
  const c: V3 = [0, 0, -l0 * 0.48], R: V3 = [w * fat, w * fat * 0.95, l0 * 0.68];
  const onto = (v: V3): V3 => {
    if (hind) { const e = onEgg(c, R, sub(v, c)); return add(e.p, scale(e.n, 0.008)); }
    const rz = clamp(-v[2] / l0), r = lerp(w * top * 0.95, w * low, rz) + 0.008, h = Math.hypot(v[0], v[1]) || 1;
    return [(v[0] / h) * r, (v[1] / h) * r, v[2]];
  };
  return merge(m, paint(blots.map((d) => ({ ...d, v: d.v.map(onto) }))), limbArmour(s, L, l0, hind, side, seed));
}

/** The shin (or forearm), down `-z` from the knee to the heel: thick. */
function lowerOf(L: Leg, l1: number, hind: boolean, n: number): Mesh {
  const w = L.w, a = hind ? 1.0 : 0.95, b = hind ? 0.72 : 0.78;
  const m = tube([[0, 0, w * 0.5], [0, 0, -l1 * 0.55], [0, 0, -l1]], [w * a, w * (a + b) * 0.5, w * b], [w * a, w * (a + b) * 0.5, w * b], n, 'coat', { seam: 'start' });
  const blots: Disc[] = [];
  for (const [z, ang] of (hind ? [[0.35, 1.2], [0.7, -0.6]] : [[0.5, 0.5]]) as Array<[number, number]>) {
    const nrm: V3 = [Math.cos(ang), Math.sin(ang), 0], rr = lerp(w * a, w * b, z);
    blots.push(disc(add([nrm[0] * rr, nrm[1] * rr, -l1 * z], scale(nrm, 0.01)), nrm, rr * 0.55, rr * 1.0, 8, 'mark', { up: [0, 0, 1] }));
  }
  const onto = (v: V3): V3 => { const r = lerp(w * a, w * b, clamp(-v[2] / l1)) + 0.008, h = Math.hypot(v[0], v[1]) || 1; return [(v[0] / h) * r, (v[1] / h) * r, v[2]]; };
  return merge(m, paint(blots.map((d) => ({ ...d, v: d.v.map(onto) }))));
}

/** A leg's underside cream: every facet turned down more than `below` or in toward the body painted the belly's colour. */
function creamUnder(m: Mesh, xf: Xf, below: number): Mesh {
  const side = Math.sign(xf.t[0]) || 1;
  const faces = m.f.map((f) => {
    if (f.decal || f.m !== 'coat' || f.i.length < 3) return f;
    const a = m.v[f.i[0]], b = m.v[f.i[1]], c = m.v[f.i[2]], nl = unit(cross(sub(b, a), sub(c, a))), n = turn(xf, nl);
    return n[2] < -below || n[0] * side < -0.55 ? { ...f, m: 'belly' as Mat } : f;
  });
  const solid = faces.filter((f) => !f.decal), cream: Face[] = solid.filter((f) => f.m === 'belly').map((f) => ({ ...f, decal: true }));
  return mesh(m.v, [...solid, ...cream, ...faces.filter((f) => f.decal)]);
}

const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- its peat ----------------------------------------------------------------------------------- */

/** A block of peat, square-cut: dark brown, its cut faces a shade lighter and its top fibrous with a little moss. */
function peatBlock(B: V3, at: V3 = [0, 0, 0], spin = 0): Mesh {
  const c = Math.cos(spin * DEG), sn = Math.sin(spin * DEG);
  const v: V3[] = [];
  for (const z of [-1, 1]) for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = x * B[0], py = y * B[1];
    v.push([at[0] + px * c - py * sn, at[1] + px * sn + py * c, at[2] + z * B[2]]);
  }
  const f: Face[] = [
    { i: [0, 1, 2, 3], m: 'woodDark' }, { i: [4, 5, 6, 7], m: 'wood' },
    { i: [0, 1, 5, 4], m: 'bark' }, { i: [1, 2, 6, 5], m: 'woodDark' }, { i: [2, 3, 7, 6], m: 'bark' }, { i: [3, 0, 4, 7], m: 'woodDark' },
  ];
  const want: V3[] = [[0, 0, -1], [0, 0, 1], [sn, -c, 0], [c, sn, 0], [-sn, c, 0], [-c, -sn, 0]];
  return mesh(v, woundTo(v, f, want));
}
/** Its stack: blocks laid crossed in courses, on the ground at the stack's foot. */
function stackOf(s: Toad): Mesh {
  const B = blockOf(s), w = B[1] * 1.05, a = -STACK_TURN, c = Math.cos(a * DEG), sn = Math.sin(a * DEG);
  const at = (x: number, y: number, z: number): V3 => [x * c - y * sn, x * sn + y * c, z];
  return merge(
    peatBlock(B, at(-w, 0, B[2]), a + 90), peatBlock(B, at(w, 0, B[2]), a + 90),
    peatBlock(B, at(0, -w, B[2] * 3), a), peatBlock(B, at(0, w, B[2] * 3), a),
    // The top course, which the block it flips up each go comes to: turned as it comes round the arc from the cut.
    peatBlock(B, at(0, 0, B[2] * 5), a),
  );
}

/* ---- a stage's pieces --------------------------------------------------------------------------- */

const restBoneCache = new Map<Toad, Bones>();
function restBones(s: Toad): Bones {
  let b = restBoneCache.get(s);
  if (!b) restBoneCache.set(s, (b = toadBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 })));
  return b;
}

/** Each stage's armour, built once: its mesh and its crystals' tips for the glints. */
const armours = new Map<string, ReturnType<typeof armourOf>>();
function armourFor(s: Toad, K: number): ReturnType<typeof armourOf> {
  const key = `${s.stage}|${K}`;
  let a = armours.get(key);
  if (!a) armours.set(key, (a = armourOf(s, K)));
  return a;
}

function toadBuild(s: Toad, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), K = lod ? 4 : 3, R = restOf(s);
  const rest = restBones(s);
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 3), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.035 } });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, false), shut: headOf(s, n, true), bone: 'head', bias: 0.2, hide });
  // The jaw and the throat hidden by the skull and the body round the far side of them, seen from behind with its head down.
  const M = marksOf(s), bodyHide = { c: [0, 0, 0] as V3, r: [M.w[3] * 0.9, (M.y[6] - M.y[0]) * 0.45, M.h[3] * 0.9] as V3 };
  pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.19, after: ['head'], lines: false, hide: [{ c: skullAt(s), r: scale(s.head.r, 0.9) }], hideIn: 'head' });
  pieces.push({ key: 'throat', mesh: throatOf(s, n), bone: 'throat', bias: 0.18, after: ['body'], under: ['jaw', 'head'], lines: false, hide: [bodyHide], hideIn: 'trunk' });
  if (s.armour.cap.length) pieces.push({ key: 'cap', mesh: capOf(s, K), bone: 'head', bias: 0.22, after: ['head'], lines: false });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = legOfI(s, i), [l0, l1] = R.legs[i];
    const foot = side > 0 ? footOf(s, L, R.heel[i], !fore, n) : mirroredMesh(footOf(s, L, R.heel[i], !fore, n));
    pieces.push(
      { key: `${key}0`, mesh: creamUnder(upperOf(s, L, l0, !fore, side, n, k, 500 + i * 37), rest[`${key}0`], 0.45), bone: `${key}0`, bias: fore ? 0.02 : 0.01 },
      { key: `${key}1`, mesh: creamUnder(lowerOf(L, l1, !fore, n), rest[`${key}1`], fore ? 0.6 : 0.35), bone: `${key}1`, bias: 0.02 },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.015 },
    );
  }
  // Whatever of its armour is round the far side of its body is hidden by it; its moss is drawn as one soft mass, without lines
  // between its leaves.
  const A = armourFor(s, K);
  pieces.push({ key: 'armour', mesh: A.mesh, bone: 'trunk', bias: 0.03, after: ['body'], hide: [bodyHide] });
  pieces.push({ key: 'moss', mesh: A.moss, bone: 'trunk', bias: 0.031, after: ['body', 'armour'], hide: [bodyHide], lines: false });
  pieces.push({ key: 'stack', mesh: stackOf(s), bone: 'site', bias: 0 });
  pieces.push({ key: 'peat', mesh: peatBlock(blockOf(s)), bone: 'peat', bias: 0.01 });
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const PEAT: RGB = [92, 64, 46], PEAT_DARK: RGB = [58, 40, 32], PEAT_WET: RGB = [74, 58, 50], INK: RGB = [40, 28, 26];
const DUST: RGB = [190, 176, 150];
const CRYSTAL_RGB: readonly RGB[] = [[244, 176, 170], [252, 220, 210], [214, 128, 132]];

const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };

/** A chunk in the air: a small hard-edged lump, `r` across, turned `ang`, inked, never under a pixel and a half. */
function chunk(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.3 * px);
  g.beginPath();
  for (let q = 0; q < 4; q++) {
    const a = ang + (q / 4) * TAU, k = q % 2 ? 0.7 : 1;
    const X = x + Math.cos(a) * r * k, Y = y + Math.sin(a) * r * k * 0.85;
    if (q) g.lineTo(X, Y); else g.moveTo(X, Y);
  }
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.strokeStyle = css(INK, al * 0.9);
  g.lineWidth = Math.max(0.6 * px, r * 0.22);
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

/** A ring on the ground at `c`, `r` across, `al` its strength: a shock spreading from a blow. */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, r: number, fill: RGB | null, rim: RGB, al: number, width: number, wobble = 0, seed = 0): void {
  if (al <= 0.01 || r <= 0) return;
  const pts = Array.from({ length: 22 }, (_, q) => {
    const a = (q / 22) * TAU, k = 1 + wobble * (jitter(seed + q) - 0.5);
    return onScreen(view, [c[0] + Math.cos(a) * r * k, c[1] + Math.sin(a) * r * k, c[2]]);
  });
  g.beginPath();
  pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) { g.fillStyle = css(fill, al); g.fill(); }
  g.strokeStyle = css(rim, al);
  g.lineWidth = width;
  g.stroke();
}

/**
 * The bog it cuts: a patch of wet black peat on the ground in front of it, ragged at its edge, and the cut in it -- a dark
 * square hole where the last block came out, and the next block's outline scored in it.
 */
function bog(g: CanvasRenderingContext2D, view: View, s: Toad, b: Bones, t: number, k: number): void {
  const at = b.bog;
  if (!at || k <= 0.01) return;
  const S = siteOf(s), B = S.block, c = at.t, sc = at.m[0], px = pxOf(g), r = lenOf(s) * 0.8 * sc;
  groundRing(g, view, [c[0] + r * 0.25, c[1] - r * 0.1, 0.004], r, PEAT_WET, PEAT_DARK, 0.85 * k, 1.1 * px, 0.35, 11);
  groundRing(g, view, [c[0] + r * 0.25, c[1] + r * 0.1, 0.006], r * 0.35, PEAT, PEAT, 0.6 * k, 0.5 * px, 0.4, 5);
  // The cut: dark while the block is out of it, the block's outline scored in it while it is in.
  const out = liftOf(t) > 0.05;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => onScreen(view, [c[0] + x * B[0] * sc, c[1] + y * B[1] * sc, 0.008]));
  g.beginPath();
  corners.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = css(out ? [34, 24, 22] : PEAT, k);
  g.fill();
  g.strokeStyle = css(PEAT_DARK, k);
  g.lineWidth = 1.1 * px;
  g.stroke();
}

/** Crumbs of peat thrown back off each forefoot as its rake lands, and off the block as it comes up; each on its side of the body. */
function crumbs(g: CanvasRenderingContext2D, view: View, s: Toad, b: Bones, t: number, k: number, front: boolean): void {
  if (k <= 0.05) return;
  const mid = b.body.t, big = 0.5 + 0.5 * bigOf(s), T = ACT_SECS.work;
  const sources: Array<{ at: number; from: V3; dir: V3; id: number }> = [];
  TOAD_WORK.rakes.forEach((r, q) => {
    const f = place(b[q ? 'fr2' : 'fl2'], [0, 0, 0]), back = turn(b.body, [q ? 0.6 : -0.6, -1, 0]);
    sources.push({ at: r, from: [f[0], f[1], 0.05], dir: back, id: 10 + q * 20 });
  });
  const S = siteOf(s);
  if (b.bog) sources.push({ at: TOAD_WORK.lever - 0.02, from: add(b.bog.t, [0, 0, S.block[2]]), dir: [0, 0, 0.3], id: 60 });
  for (const src of sources) {
    const since = (t - src.at) * T;
    if (since < 0 || since > 0.45) continue;
    for (let q = 0; q < 7; q++) {
      const id = src.id + q * 3, a = (jitter(id) - 0.5) * 2.2, sp = (0.9 + 0.8 * jitter(id + 1)) * big;
      const d = unit([src.dir[0] + Math.cos(a) * 0.6, src.dir[1] + Math.sin(a) * 0.6, 0]);
      const p = thrown(src.from, [d[0] * sp, d[1] * sp, (1.6 + 1.2 * jitter(id + 2)) * big], since);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      chunk(g, x, y, (0.06 + 0.05 * jitter(id + 3)) * big, id + since * 14, jitter(id + 4) < 0.5 ? PEAT : PEAT_DARK, k * (1 - smooth((since - 0.3) / 0.15)));
    }
  }
}

/** A four-pointed glint, `r` across, white with a pink rim. */
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, spin: number): void {
  const px = pxOf(g);
  r = Math.max(r, 4.5 * px * (0.4 + 0.6 * al));
  const path = (R: number, w: number): void => {
    g.beginPath();
    for (let q = 0; q < 8; q++) {
      const a = spin + (q / 8) * TAU, k = q % 2 ? w : R;
      const X = x + Math.cos(a) * k, Y = y + Math.sin(a) * k;
      if (q) g.lineTo(X, Y); else g.moveTo(X, Y);
    }
    g.closePath();
  };
  path(r, r * 0.22);
  g.fillStyle = css([248, 196, 196], al * 0.9);
  g.fill();
  path(r * 0.66, r * 0.14);
  g.fillStyle = css([255, 252, 246], al);
  g.fill();
}

/** Its crystals catching the light: a glint opening on one tip after another, on whichever face it, eight times a loop. */
function glints(g: CanvasRenderingContext2D, view: View, s: Toad, b: Bones, a: Anim, tips: ReadonlyArray<{ p: V3; d: V3; size: number }>): void {
  if (!tips.length) return;
  const per = 3, u = frac(a.t / per), which = Math.floor(a.t / per);
  if (u > 0.36) return;
  const pick = tips[Math.floor(jitter(which * 1.7 + 3) * tips.length) % tips.length];
  const d = turn(b.trunk, pick.d), facing = d[0] * view.T[0] + d[1] * view.T[1] + d[2] * view.T[2];
  if (facing < -0.2) return;
  const [x, y] = onScreen(view, place(b.trunk, pick.p));
  const life = Math.sin((u / 0.36) * Math.PI);
  star(g, x, y, (0.3 + 0.2 * pick.size) * bigOf(s) * (0.4 + 0.6 * life), Math.sqrt(life), a.t * 1.3);
}

/** What a strike throws: dust where it comes down, and from the bigger two a shock across the ground and crystal chips. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Toad, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid = b.body.t, since = (t - TOAD_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  if (s.stage === 0) {
    for (const leg of ['fl2', 'fr2']) {
      const f = place(b[leg], [0, 0, 0]);
      if (nearSide(f, mid, view) === front) puff(g, view, [f[0], f[1], 0.05], 0.2 * big, since / 0.4, leg === 'fl2' ? 3 : 4);
    }
    return;
  }
  const at = s.stage === 1 ? place(b.trunk, [0, marksOf(s).y[5], -marksOf(s).h[5] * 0.8]) : mixV(place(b.fl2, [0, 0, 0]), place(b.fr2, [0, 0, 0]), 0.5);
  const c: V3 = [at[0], at[1], 0.01];
  if (!front) {
    const age = since / 0.35;
    if (age < 1) groundRing(g, view, c, lenOf(s) * (0.4 + 1.1 * age) * (s.stage === 2 ? 1.3 : 1), null, [120, 100, 80], 0.7 * (1 - age), pxOf(g) * (2.2 - 1.2 * age), 0.12, 7);
  }
  for (const sd of [-1, 1]) {
    const p: V3 = [c[0] + sd * 0.45 * big * (1 + 1.5 * ramp(since, 0, 0.3)), c[1] + 0.1, 0.08];
    if (nearSide(p, mid, view) === front) puff(g, view, p, 0.45 * big * (s.stage === 2 ? 1.3 : 1), since / 0.5, 7 + sd);
  }
  if (s.stage === 2) {
    // Chips of crystal shaken off its back by the blow, flying up and out.
    const back = place(b.trunk, [0, 0, marksOf(s).h[3] * 1.1]);
    for (let q = 0; q < 8; q++) {
      const a = (q / 8) * TAU + jitter(q) * 0.5, sp = (0.9 + 0.6 * jitter(q + 2)) * big;
      const p = thrown(back, [Math.cos(a) * sp, Math.sin(a) * sp, (2.4 + jitter(q + 3)) * big], since);
      if (nearSide(p, mid, view) !== front || since > 0.5) continue;
      const [x, y] = onScreen(view, p);
      chunk(g, x, y, 0.05 * big, q + since * 10, CRYSTAL_RGB[q % 3], 1 - smooth((since - 0.35) / 0.15));
    }
  }
}

/** Evolving: moss leaves and crystal chips spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Toad, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], M = marksOf(s);
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = M.w[3] * 1.6 + 0.3 * big, ry = lenOf(s) * 0.9 + 0.3 * big, high = M.h[3] * 2.4 + 0.8 * big;
  for (let q = 0; q < 16; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 16) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -M.h[3] * 0.3 + u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 2 === 0) {
      const c: RGB = q % 4 ? [168, 196, 104] : [128, 164, 80], r = 0.1 * big;
      g.fillStyle = css(c, swirl);
      g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), swirl);
      g.lineWidth = Math.max(pxOf(g) * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.45, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    } else chunk(g, x, y, 0.06 * big * (1 - 0.4 * u), ang * 1.3, CRYSTAL_RGB[q % 3], swirl * ramp(u, 0, 0.15));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function toadKind(look: Toad): Kind {
  const s: Toad = { ...look, body: rounded(look.body), marks: look.body };
  const bones = toadBones(s);
  const tips = (): ReturnType<typeof armourOf>['tips'] => armourFor(s, 3).tips;
  return {
    bones,
    build: (lod) => toadBuild(s, lod),
    // The variant's coat tints its moss green and its markings its crystals; its cream, its peach toes, its cheeks and its eyes
    // are the same on every variant, so every one is a green toad with pink-to-lilac crystals.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const green = mix([108, 146, 70], mix(coat, [108, 146, 70], 0.15), 0.7 * clamp(sat(coat) / 0.25));
      const pink = mix([234, 126, 136], mix(mark, [150, 60, 90], 0.22), 0.8 * clamp(sat(mark) / 0.2));
      return coatPalette(coat, mark, {
        coat: green,
        coatDark: mix(green, [44, 60, 40], 0.3),
        coatLight: mix(green, [244, 240, 212], 0.45),
        mark: mix(green, [52, 84, 44], 0.38),
        spot: mix([236, 206, 190], pink, 0.3),
        belly: [246, 234, 210],
        muzzle: [248, 238, 216],
        inner: [180, 86, 92],
        tongue: [232, 124, 132],
        nose: [62, 72, 46],
        lid: [70, 52, 40],
        eye: [34, 24, 24],
        glint: [255, 254, 248],
        bloom: s.stage === 2 ? [196, 98, 74] : [238, 184, 62],
        billDark: s.stage === 2 ? [140, 56, 48] : [196, 128, 40],
        shell: [244, 162, 156],
        pad: [244, 200, 170],
        claw: [60, 50, 56],
        stone: mix([222, 184, 174], pink, 0.25),
        stoneDark: [172, 140, 136],
        moss: mix([178, 204, 96], green, 0.2),
        leaf: mix([110, 148, 66], green, 0.2),
        leafDark: [76, 108, 52],
        crystal: pink,
        crystalDark: mix(pink, [160, 60, 92], 0.4),
        petal: mix(pink, [255, 240, 236], 0.45),
        wood: [96, 68, 50],
        woodDark: [62, 44, 36],
        bark: [124, 90, 64],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [lenOf(s) * 0.95 + 0.1, s.hind.at[0] * 1.1],
    stride: 1.2,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    leaps: [false, s.hops],
    motes: [[244, 176, 170], [172, 198, 108]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      const working = act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
      if (working) {
        const t = act?.kind === 'work' ? act.t : 0, k = act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
        if (under) bog(g, view, s, b, t, k);
        if (act?.kind === 'work') crumbs(g, view, s, b, t, k, front);
      }
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
      if (front) glints(g, view, s, b, a, tips());
    },
  };
}

export const MOSSKIP = toadKind(MOSSKIP_LOOK);
export const CRAGHOPPER = toadKind(CRAGHOPPER_LOOK);
export const BASTIONTOAD = toadKind(BASTIONTOAD_LOOK);
