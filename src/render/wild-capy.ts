import {
  ACT_SECS, add, disc, lighter, beat, clamp, coatPalette, cross, curve, cyc, DEG, dot, frac, lerp, lifted, merge, mix, orbAlong, paint,
  quadBones, quadPose, scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
  type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The capybara line: the Pailbara, a small round young capybara with a
 * garland of vine round its neck, lilac and white flowers in it, and one
 * small wooden pail on its back brimming with water that runs over its rim
 * down one side; which grows into the Caskybara, bigger and standing tall in
 * a leafy vine harness looped over its back, flowers in it, a wooden bucket
 * slung either side of it like panniers, both full and running over; and then
 * the Reservara, large and heavy, thick leafy vines hanging from its
 * shoulders and back and a lashed pair of casks on its back held by bamboo
 * hoops and rope, water pouring from a tap low in the rear one into a puddle
 * at its heels. All three are warm caramel with darker brown legs and feet, a
 * blunt square muzzle, small round ears, and calm half-lidded dark eyes under
 * a heavy lid, a lilac flower tucked behind an ear. The species is still
 * `dippa` underneath, as saves and the database know it: the filler, that
 * fills empty buckets from the settlement stores at the shore or a well.
 *
 * Built the way the badger line is (`./wild-badger`): one set of functions
 * from a description of the stage (`Capy`), every foot given a point on the
 * ground to be at and its leg bent to reach it, the knee always the same way
 * round, so a planted foot stays where it was put. It walks an unhurried
 * four-beat plod, its back steady, its head nodding a little; at a run it
 * trots. What it carries is a pail, a bucket or a cask of staves (`Vessel`):
 * a slung bucket hangs plumb from its harness and swings, and the water in
 * every one is a surface of its own on a bone that is kept level in the world,
 * so as the body pitches and rolls the water stays flat and only sloshes.
 * Water running over a rim, dripping and pouring is drawn by hand round it.
 *
 * At its task it fills: it wades in and lowers itself into the water on
 * folding legs, its slung buckets let down on their bails into it and tipped
 * to scoop, and as it rocks from side to side the water splashes up into the
 * pail or casks on its back; the water rises in each from near empty; then it
 * rises with the water running off it and shakes its head, full.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }
type HeadRings = Rings & { pitch: number };

/**
 * Something it carries water in, in the trunk's frame: on its back, its foot's middle on its back and tipped forward and to its
 * right (degrees); slung at a side (`sling`, one its right and minus one its left), hung plumb from `at` on its harness by a bail
 * handle, its mouth `drop` under it.
 */
interface Vessel {
  kind: 'pail' | 'bucket' | 'cask';
  at: V3;
  tip: [number, number];
  sling?: number;
  drop?: number;
  /** Its radius at the mouth, at the foot, and how tall. */
  r: number; foot: number; h: number;
  /** Leaves wrapped round its lower half, how many. */
  wrap: number;
  /** Where water runs over its rim: angles round its mouth from its right, toward its front (radians). */
  spill: number[];
  /** A tap low in its side that pours, at this angle round it. */
  tap?: number;
}

/** A vine on it: through these points on its body (along it, round it from its right side, off it), closed into a loop or not. */
interface Vine {
  pts: ReadonlyArray<readonly [number, number, number]>;
  closed?: boolean;
  /** How thick (a radius), and a leaf every this far along it, how long. */
  w: number; every: number; leaf: number;
  /** Flowers on it: how far along it (nought to one), how big, which colour. */
  flowers: ReadonlyArray<readonly [number, number, Mat]>;
}

interface Capy {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest. */
  body: Rings;
  /** Shoulder to hip. */
  len: number;
  /** The fore legs and the hind: upper, lower, and the drop from the ankle to the sole; how thick at the top. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  /** How far out from the middle its hips and shoulders are, as a share of the body's width there; how thick its hind legs are against its fore. */
  hip: number;
  hindThick: number;
  /** Standing: each leg's upper pitched forward, and its lower against it, in degrees. Its sign says which way the knee bends, for good. */
  stand: { fore: [number, number]; hind: [number, number] };
  paw: number;
  hindPaw: number;
  neck: { at: V3; len: number; w: number; lean: number };
  /** The head's rings, the back of its skull to the end of its muzzle, squared off (`SQUARE`). */
  head: HeadRings;
  /** The eye: how far along the head, how far up round it (radians from its side), how big, and how far its lid is down (nought to one). */
  eye: { y: number; up: number; size: number; lid: number };
  /** Its ears: how long, how wide, and where on the head (along it, up round it). */
  ear: { len: number; w: number; at: [number, number] };
  vessels: Vessel[];
  vines: Vine[];
  /** Strands of leafy vine hanging down its flanks from its back, how many a side, how long: the Reservara's. */
  drape: { n: number; len: number; from: number; to: number };
  /**
   * How it goes: how far its body drops at each footfall, a walk's and a run's; how much of a stride a foot is down; how far a leg
   * swings (degrees); how high a foot is lifted; how far the barrel rolls and the head nods.
   */
  gait: { bob: [number, number]; duty: [number, number]; swing: [number, number]; step: number; roll: number; nod: number };
  /** Its strike: a hop and a butt, a shove, or reared up and stamped down. */
  strike: 0 | 1 | 2;
  /** How far its body goes down into the water at its task, as a share of how high it stands. */
  sink: number;
  size: number;
}

/** How square a head's rings are: two is an ellipse, more is a box with its corners rounded. */
const SQUARE = 2.2;

/**
 * A barrel's rings from its length rump to chest and its half-width and half-depth at its middle: a capybara's, the rump high
 * and round, the chest deep, a little higher in front where the neck goes up out of it.
 */
function barrelOf(L: number, W: number, H: number): Rings {
  return {
    y: [-0.5, -0.49, -0.46, -0.41, -0.34, -0.24, -0.12, 0, 0.2, 0.33, 0.41, 0.465, 0.49].map((v) => v * L),
    z: [0.08, 0.1, 0.13, 0.16, 0.17, 0.14, 0.07, 0, -0.02, 0.04, 0.1, 0.17, 0.22].map((v) => v * H),
    w: [0.12, 0.36, 0.56, 0.72, 0.85, 0.94, 0.99, 1.0, 0.96, 0.86, 0.72, 0.5, 0.18].map((v) => v * W),
    h: [0.12, 0.38, 0.58, 0.74, 0.86, 0.95, 0.99, 1.0, 0.97, 0.88, 0.74, 0.52, 0.2].map((v) => v * H),
  };
}
/**
 * A head's rings from its length and its half-width and half-depth: the back of the skull round, the cheeks broad, the top flat
 * on to a deep blunt muzzle with a flat front; nose up `pitch` degrees.
 */
function skullOf(L: number, W: number, H: number, pitch: number): HeadRings {
  return {
    y: [-0.42, -0.37, -0.22, 0.0, 0.22, 0.42, 0.53, 0.575, 0.59].map((v) => v * L),
    z: [0.16, 0.16, 0.12, 0.07, 0.0, -0.05, -0.08, -0.1, -0.1].map((v) => v * H),
    w: [0.3, 0.86, 1.0, 0.96, 0.84, 0.74, 0.66, 0.5, 0.2].map((v) => v * W),
    h: [0.3, 0.84, 1.0, 1.0, 0.9, 0.84, 0.76, 0.56, 0.22].map((v) => v * H),
    pitch,
  };
}
/** A loop of vine round its body, `off` off it: over the top at `top` along it and under it at `bottom`. */
function loop(top: number, bottom: number, off: number): Array<[number, number, number]> {
  return Array.from({ length: 10 }, (_, k) => {
    const th = Math.PI / 2 - (k / 10) * TAU;
    return [lerp(top, bottom, (1 - Math.sin(th)) / 2), th, off];
  });
}
/** A vine over its back from its right side to its left at `y`, `from` up its side (radians from level). */
function over(y: number, from: number, off: number): Array<[number, number, number]> {
  return Array.from({ length: 7 }, (_, k) => [y, lerp(from, Math.PI - from, k / 6), off]);
}

/** A Pailbara: small and round, a big blunt head, a garland of vine and flowers round its neck and a pail of water on its back. */
const PAILBARA_LOOK: Capy = {
  stage: 0,
  body: barrelOf(1.44, 0.54, 0.42),
  len: 0.9,
  fore: [0.19, 0.17, 0.06], hind: [0.21, 0.18, 0.06], thick: 0.19, hip: 0.56, hindThick: 1.2,
  stand: { fore: [-4, 12], hind: [24, -42] },
  paw: 0.135, hindPaw: 0.145,
  neck: { at: [0, 0.52, 0.3], len: 0.24, w: 0.36, lean: 30 },
  head: skullOf(0.82, 0.26, 0.29, 8),
  eye: { y: -0.03, up: 0.6, size: 0.078, lid: 0.36 },
  ear: { len: 0.09, w: 0.08, at: [-0.25, 1.12] },
  vessels: [
    { kind: 'pail', at: [0.0, -0.24, 0.45], tip: [-12, -5], r: 0.27, foot: 0.21, h: 0.3, wrap: 5, spill: [Math.PI + 0.65] },
  ],
  vines: [
    // The garland: round the root of its neck, low over its chest in front.
    { pts: loop(0.36, 0.66, 0.05), closed: true, w: 0.02, every: 0.06, leaf: 0.14,
      flowers: [[0.04, 0.085, 'petal'], [0.17, 0.065, 'cap'], [0.3, 0.07, 'petal'], [0.46, 0.075, 'cap'], [0.6, 0.07, 'petal'], [0.74, 0.065, 'cap'], [0.88, 0.08, 'cap']] },
    // Leaves round the foot of the pail, trailing down its left side.
    { pts: [[-0.12, 2.0, 0.06], [-0.3, 2.3, 0.06], [-0.5, 2.6, 0.05], [-0.62, 3.0, 0.04]], w: 0.016, every: 0.07, leaf: 0.11, flowers: [[0.55, 0.055, 'cap']] },
  ],
  drape: { n: 0, len: 0, from: 0, to: 0 },
  gait: { bob: [0.02, 0.05], duty: [0.66, 0.46], swing: [26, 34], step: 0.38, roll: 3, nod: 3 },
  strike: 0,
  sink: 0.36,
  size: 3.8,
};

/** A Caskybara: bigger and standing tall, a leafy vine harness looped over its back, a full bucket slung either side of it. */
const CASKYBARA_LOOK: Capy = {
  stage: 1,
  body: barrelOf(2.3, 0.76, 0.5),
  len: 1.42,
  fore: [0.33, 0.29, 0.08], hind: [0.36, 0.31, 0.08], thick: 0.3, hip: 0.56, hindThick: 1.18,
  stand: { fore: [-4, 12], hind: [24, -42] },
  paw: 0.18, hindPaw: 0.19,
  neck: { at: [0, 0.86, 0.4], len: 0.4, w: 0.5, lean: 22 },
  head: skullOf(1.18, 0.35, 0.39, 16),
  eye: { y: -0.04, up: 0.6, size: 0.1, lid: 0.42 },
  ear: { len: 0.12, w: 0.105, at: [-0.35, 1.12] },
  vessels: [
    { kind: 'bucket', at: [1.12, -0.2, 0.52], tip: [0, 0], sling: 1, drop: 0.06, r: 0.36, foot: 0.3, h: 0.48, wrap: 0, spill: [0.2] },
    { kind: 'bucket', at: [-1.12, -0.2, 0.52], tip: [0, 0], sling: -1, drop: 0.06, r: 0.36, foot: 0.3, h: 0.48, wrap: 0, spill: [Math.PI - 0.2] },
  ],
  vines: [
    // Over its back from one bucket's hook to the other.
    { pts: [[-0.2, 0.75, 0.38], ...over(-0.2, 1.0, 0.05), [-0.2, Math.PI - 0.75, 0.38]], w: 0.03, every: 0.085, leaf: 0.19, flowers: [[0.5, 0.11, 'bloom'], [0.2, 0.09, 'cap'], [0.8, 0.09, 'petal']] },
    // A loop over its shoulders and round its chest, knotted low in front.
    { pts: loop(0.62, 1.04, 0.06), closed: true, w: 0.03, every: 0.075, leaf: 0.19, flowers: [[0.06, 0.11, 'bloom'], [0.5, 0.1, 'cap'], [0.3, 0.085, 'petal'], [0.72, 0.085, 'petal'], [0.18, 0.08, 'cap'], [0.88, 0.08, 'cap']] },
  ],
  drape: { n: 0, len: 0, from: 0, to: 0 },
  gait: { bob: [0.03, 0.07], duty: [0.66, 0.46], swing: [24, 32], step: 0.34, roll: 2.5, nod: 3 },
  strike: 1,
  sink: 0.32,
  size: 3.8,
};

/** A Reservara: large and heavy, thick leafy vines hanging from its shoulders and back, two casks lashed on its back, one pouring. */
const RESERVARA_LOOK: Capy = {
  stage: 2,
  body: barrelOf(3.2, 1.06, 0.74),
  len: 1.98,
  fore: [0.47, 0.4, 0.11], hind: [0.51, 0.42, 0.11], thick: 0.44, hip: 0.56, hindThick: 1.18,
  stand: { fore: [-4, 12], hind: [24, -42] },
  paw: 0.25, hindPaw: 0.26,
  neck: { at: [0, 1.2, 0.58], len: 0.5, w: 0.72, lean: 20 },
  head: skullOf(1.52, 0.46, 0.5, 18),
  eye: { y: -0.05, up: 0.6, size: 0.125, lid: 0.46 },
  ear: { len: 0.15, w: 0.135, at: [-0.46, 1.12] },
  vessels: [
    { kind: 'cask', at: [0, -0.86, 0.82], tip: [-6, 0], r: 0.5, foot: 0.44, h: 0.82, wrap: 7, spill: [Math.PI + 1.0], tap: Math.PI + 0.3 },
    { kind: 'cask', at: [0.03, 0.2, 0.8], tip: [7, 4], r: 0.4, foot: 0.35, h: 0.6, wrap: 6, spill: [0.5] },
  ],
  vines: [
    // A thick vine over its shoulders and round in front of its chest.
    { pts: loop(0.86, 1.4, 0.08), closed: true, w: 0.05, every: 0.085, leaf: 0.3, flowers: [[0.04, 0.12, 'cap'], [0.28, 0.11, 'petal'], [0.5, 0.11, 'cap'], [0.72, 0.1, 'petal']] },
  ],
  drape: { n: 7, len: 0.95, from: 0.95, to: -1.25 },
  gait: { bob: [0.04, 0.09], duty: [0.68, 0.5], swing: [22, 30], step: 0.3, roll: 2, nod: 2.5 },
  strike: 2,
  sink: 0.3,
  size: 3.8,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a pattern is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A knock ringing out: nothing before, then a wave of `f` a second dying away. */
const ringOut = (since: number, k: number, f = 2.6, damp = 3): number => (since < 0 ? 0 : k * Math.exp(-since * damp) * Math.sin(since * TAU * f));
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const sgnPow = (x: number, p: number): number => Math.sign(x) * Math.abs(x) ** p;

/** Where a point on a body of rings is, `y` along it and `th` round it from its right side (up positive), and the way out of it there. */
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
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** A point on a squared-off body of rings (`SQUARE`), `y` along it and `th` round it from its right side. */
function sqPoint(R: Rings, y: number, th: number): V3 {
  const r = ringAt(R, y), c = Math.cos(th), s = Math.sin(th), e = 2 / SQUARE;
  return [r.w * sgnPow(c, e), y, r.z + r.h * sgnPow(s, e)];
}
/** That point, and the way out of the surface there. */
function onSq(R: Rings, y: number, th: number): { p: V3; n: V3 } {
  const p = sqPoint(R, y, th), d = 0.01;
  const py = sub(sqPoint(R, y + d, th), sqPoint(R, y - d, th)), pt = sub(sqPoint(R, y, th + d), sqPoint(R, y, th - d));
  return { p, n: unit(cross(py, pt)) };
}

/** `v` pitched about x by `deg` degrees, as a joint's pitch turns it. */
function rotX(v: V3, deg: number): V3 {
  const a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
/** A path through the air from `a` to `b`, `u` of the way, rising `up` over the straight line at its middle. */
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}
/** A beat once a turn at `x` nought, smooth all the way round: a footfall's jolt. */
const pulse = (x: number): number => Math.max(0, Math.cos(TAU * x)) ** 14;

/** A frame whose up is `up` and whose front is as near `fwd` as that allows. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (Math.hypot(Y[0], Y[1], Y[2]) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** A frame scaled along its own three axes. */
const scaled = (x: Xf, k: V3): Xf => { const m = x.m; return { m: [m[0] * k[0], m[1] * k[1], m[2] * k[2], m[3] * k[0], m[4] * k[1], m[5] * k[2], m[6] * k[0], m[7] * k[1], m[8] * k[2]], t: x.t }; };

/** Each face wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
function wound(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}
/** A flat shape's corners, wound to face along `n`. */
function facing(pts: V3[], n: V3, m: Mat, o: { lit?: boolean; at?: V3 } = {}): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, lit: o.lit, at: o.at };
}
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- the strike and the task, in time ------------------------------------------------------- */

/** When each stage's blow lands, as a share of its strike: the Pailbara's butt, the Caskybara's shove, the Reservara's stamp. */
export const CAPY_HITS: readonly number[] = [0.5, 0.52, 0.58];
/**
 * A go at its task, as shares of it: its fore feet stepped into the water by `wade`; lowered into it until `under`, where it
 * lands with a splash; the water rising in what it carries from `fill[0]` to `fill[1]` as it rocks; up out of it by `rise`, the
 * water running off; and its head shaken at `shake`. Its fore feet are stepped back to where they stood by the end.
 */
export const CAPY_WORK = { wade: 0.14, under: 0.36, fill: [0.36, 0.64] as const, rise: 0.8, shake: 0.88 } as const;

/* ---- its legs, by where its feet go ---------------------------------------------------------- */

/** How far a knee folds for a fold of one: the poses here give a knee in degrees, through this. */
const FOLD = 60;

/** A stage's body on four legs (`QuadSpec`). */
const specOf = (s: Capy): QuadSpec => ({
  high: s.fore[0] + s.fore[1] + 0.5,
  fore: { at: [ringAt(s.body, s.len * 0.5).w * s.hip, s.len * 0.5, -ringAt(s.body, s.len * 0.5).h * 0.42], len: s.fore, rest: [s.stand.fore[0], s.stand.fore[1], 0], fold: [FOLD, FOLD], toe: [s.paw * 1.3, s.paw * 0.6] },
  hind: { at: [ringAt(s.body, -s.len * 0.5).w * s.hip * 1.04, -s.len * 0.5, -ringAt(s.body, -s.len * 0.5).h * 0.42], len: s.hind, rest: [s.stand.hind[0], s.stand.hind[1], 0], fold: [FOLD, FOLD], toe: [s.hindPaw * 1.4, s.hindPaw * 0.6] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  ears: { at: earRoot(s), out: 70, back: 8 },
  swing: s.gait.swing,
  duty: s.gait.duty,
  graze: 30,
  nose: 16,
  bow: 4,
  rock: 2,
});

/** Where a leg's ankle is from its hip, the upper pitched `a` and the lower `b` against it (degrees). */
function ankleAt(len: readonly number[], a: number, b: number): V3 {
  const A = a * DEG, B = (a + b) * DEG;
  return [0, len[0] * Math.sin(A) + len[1] * Math.sin(B), -(len[0] * Math.cos(A) + len[1] * Math.cos(B))];
}

/**
 * A leg bent so its ankle is at `T` (from the body's middle, level, along the ground): the swing of its upper and the fold of its
 * knee. The knee bends the way it does standing whatever the foot is asked, so it never flips; a point out of reach is reached
 * for as far as the leg goes.
 */
function legTo(spec: QuadSpec, i: number, pitch: number, T: V3): [number, number] {
  const L = i < 2 ? spec.fore : spec.hind, rest = L.rest ?? [0, 0, 0];
  const loc = sub(rotX(T, -pitch), [SIDE[i] * L.at[0], L.at[1], L.at[2]]);
  const L0 = L.len[0], L1 = L.len[1];
  const most = (L0 + L1) * 0.985, ease = (L0 + L1) * 0.95, d0 = Math.hypot(loc[1], loc[2]);
  const D = clamp(d0 > ease ? ease + (most - ease) * Math.tanh((d0 - ease) / (most - ease)) : d0, Math.abs(L0 - L1) + 0.02 * (L0 + L1), most);
  const b = (rest[1] >= 0 ? 1 : -1) * Math.acos(clamp((D * D - L0 * L0 - L1 * L1) / (2 * L0 * L1), -1, 1));
  const a = Math.atan2(loc[1], -loc[2]) - Math.atan2(L1 * Math.sin(b), L0 + L1 * Math.cos(b));
  return [a / DEG - rest[0], (rest[1] - b / DEG) / FOLD];
}

/** A stage standing: how far its body is tipped to stand on all four feet, how high its middle is, and where each ankle is. */
interface Rest { pitch: number; h: number; ankle: V3[]; nose: V3; sole: V3[][]; chin: V3[] }
function restOf(s: Capy, spec: QuadSpec): Rest {
  const ankle = (i: number, pitch: number): V3 => {
    const L = i < 2 ? spec.fore : spec.hind, r = L.rest ?? [0, 0, 0];
    return add(rotX([SIDE[i] * L.at[0], L.at[1], L.at[2]], pitch), rotX(ankleAt(L.len, r[0], r[1]), pitch));
  };
  const gap = (pitch: number): number => (ankle(0, pitch)[2] - spec.fore.len[2]) - (ankle(2, pitch)[2] - spec.hind.len[2]);
  let lo = -30, hi = 30;
  for (let q = 0; q < 40; q++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) > 0) hi = mid;
    else lo = mid;
  }
  const pitch = (lo + hi) / 2;
  const h = -(ankle(0, pitch)[2] - spec.fore.len[2]);
  const H = s.head, last = H.y.length - 1;
  return {
    pitch, h,
    ankle: [0, 1, 2, 3].map((i) => { const a = ankle(i, pitch); return [a[0], a[1], (i < 2 ? spec.fore : spec.hind).len[2]] as V3; }),
    nose: [0, H.y[last], H.z[last] + H.h[last - 1] * 0.5],
    // The underside of the head, from the jaw to the end of the muzzle: what would go into the ground first.
    chin: H.y.map((y, q) => [0, y, H.z[q] - H.h[q]] as V3),
    // The points of each foot that could touch the ground, in its frame: the sole's toe and heel.
    sole: [0, 1, 2, 3].map((i) => {
      const L = i < 2 ? spec.fore : spec.hind, [ahead, behind] = L.toe ?? [0.3, 0.3];
      return [[0, ahead, -L.len[2]], [0, -behind, -L.len[2]]] as V3[];
    }),
  };
}

/**
 * Where its feet are to be this moment and how the rest of it is carried: for each leg the point its ankle is to be at (from
 * under the body's middle along the ground, and its height over the ground) and how its foot is pitched past level; how high
 * the body's middle is, how far it is carried forward, and how far the barrel rolls and rocks over its legs.
 */
interface Plan { at: V3[]; foot: number[]; H: number; surge: number; roll: number; rock: number }

/** Standing: every foot where it stands. */
function stillPlan(R: Rest, p: QuadPose): Plan {
  return { at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0], H: R.h, surge: 0, roll: p.roll, rock: 0 };
}

/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const SWING_EDGE = 0.1;

/**
 * Going: each foot down for its share of a stride, swept back under the body at the speed the ground goes by, and brought
 * forward again through the air, leaving the ground and landing on it at the ground's speed so it never skates. Four beats at
 * a walk, an unhurried plod, the back steady over the feet so what it carries barely stirs; at a run, the diagonals together.
 */
function goingPlan(s: Capy, spec: QuadSpec, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const trot = g >= 0.5;
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const legLen = Math.min(spec.fore.len[0] + spec.fore.len[1], spec.hind.len[0] + spec.hind.len[1]);
  const half = legLen * Math.sin(amp * DEG);
  const beats = trot ? [0, 0.5, 0.5, 0] : [0.25, 0.75, 0, 0.5];
  const mid = trot ? duty / 2 : frac(0.75 + duty / 2);
  const bob = lerp(G.bob[0], G.bob[1], g);
  const drop = bob * (0.5 + 0.5 * Math.cos(4 * Math.PI * (w - mid)));
  let air = 0;
  if (trot && duty < 0.5) {
    const x = frac(w * 2) * 0.5;
    if (x >= duty) air = bob * 1.4 * Math.sin((Math.PI * (x - duty)) / (0.5 - duty)) ** 2;
  }
  const at: V3[] = [], foot: number[] = [];
  for (let i = 0; i < 4; i++) {
    const ph = frac(a.u + beats[i]), A = R.ankle[i];
    if (ph < duty) {
      at.push([A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]]);
      foot.push(0);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty), e = SWING_EDGE;
    const L = (i < 2 ? spec.fore : spec.hind).len, lift = G.step * (L[0] + L[1]) * (1 + 0.2 * g);
    const y0 = A[1] - half - v * e, y1 = A[1] + half + v * e;
    const y = u < e ? A[1] - half - v * u : u > 1 - e ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * e), -v * (1 - 2 * e), (u - e) / (1 - 2 * e));
    at.push([A[0], y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)]);
    // The foot let hang toes down as it comes forward, a capybara's flat foot peeled off the ground heel first.
    foot.push((i < 2 ? -22 : -16) * Math.sin(Math.PI * u) ** 2);
  }
  const roll = G.roll * Math.sin((w - mid) * TAU + Math.PI / 2) * (trot ? 0.5 : 1);
  const rock = trot ? 1.6 * Math.sin(w * TAU * 2) : 0.6 * Math.sin((w - mid) * TAU * 2);
  return { at, foot, H: R.h - drop + air, surge: 0, roll, rock };
}

/** A plan `k` of the way from `a` to `b`. */
function mixPlan(a: Plan, b: Plan, k: number): Plan {
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)),
    foot: a.foot.map((x, i) => lerp(x, b.foot[i], k)),
    H: lerp(a.H, b.H, k), surge: lerp(a.surge, b.surge, k), roll: lerp(a.roll, b.roll, k), rock: lerp(a.rock, b.rock, k),
  };
}

/* ---- the task ------------------------------------------------------------------------------- */

/** How high the top of the water it wades into is over the ground. */
const poolZ = (R: { h: number }): number => R.h * 0.13;
/** How far down into the water it is through a go at its task: lowered after it wades in, held, and up again. */
const sunkOf = (t: number): number => ramp(t, CAPY_WORK.wade, CAPY_WORK.under) * (1 - ramp(t, CAPY_WORK.fill[1] + 0.02, CAPY_WORK.rise));
/** How far its fore feet are stepped forward into the water: in at the start of a go, back at its end. */
const wadeOf = (t: number): number => ramp(t, 0.0, CAPY_WORK.wade) * (1 - ramp(t, CAPY_WORK.shake + 0.02, 0.99));
/** The rocking from side to side as the water comes into what it carries. */
const rockOf = (t: number): number => Math.sin(((t - CAPY_WORK.fill[0]) / (CAPY_WORK.fill[1] - CAPY_WORK.fill[0])) * TAU * 1.5) * hump(t, (CAPY_WORK.fill[0] + CAPY_WORK.fill[1]) / 2, 0.16);

/**
 * A go at its task, filling: its fore feet stepped one and then the other forward into the water, its body let down into it on
 * folding legs, its chin held up out of it; rocked from side to side as the water rises in what it carries; lifted out again,
 * and its head shaken, its ears flicking; its fore feet stepped back.
 */
function workPlan(s: Capy, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), W = CAPY_WORK;
  plan.roll *= 0.3;
  const sunk = sunkOf(t), L = s.fore[0] + s.fore[1];
  plan.H -= R.h * s.sink * sunk;
  plan.surge = s.len * 0.08 * wadeOf(t);
  // Each fore foot stepped forward in turn, and back in turn at the end.
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0], A[1] + s.len * 0.14, A[2]];
    const [a0, a1] = i ? [0.06, W.wade + 0.02] : [0.0, W.wade - 0.04];
    const [b0, b1] = i ? [W.shake + 0.02, 0.97] : [W.shake - 0.04, 0.92];
    if (t < a0) plan.at[i] = A;
    else if (t < a1) plan.at[i] = arc(A, fwd, ramp(t, a0, a1), L * 0.35);
    else if (t < b0) plan.at[i] = fwd;
    else if (t < b1) plan.at[i] = arc(fwd, A, ramp(t, b0, b1), L * 0.3);
    plan.foot[i] = -14 * Math.sin(Math.PI * ramp(t, a0, a1)) - 14 * Math.sin(Math.PI * ramp(t, b0, b1));
  }
  // Rocked from side to side as it fills, a nod of its whole body with it.
  const rk = rockOf(t);
  plan.roll += 6 * rk;
  plan.rock += 1.5 * Math.sin(t * TAU * 3) * hump(t, 0.5, 0.15);
  // Chin up out of the water, eyes to the sky, and its ears pricked; the head shaken when it is up.
  p.neck[0] -= 10 * sunk;
  p.head[0] += 10 * sunk;
  p.head[2] += 4 * rk;
  const sh = hump(t, W.shake + 0.02, 0.07);
  p.head[1] += 22 * sh * Math.sin((t - W.shake) * TAU * 9);
  p.head[2] += 14 * sh * Math.sin((t - W.shake) * TAU * 9 + 0.6);
  for (const e of p.ears) e[0] += 26 * sh * Math.sin((t - W.shake) * TAU * 12) - 8 * sunk;
  return plan;
}

/** The neck and the head bowed together toward the ground, `x` of the way. */
function bow(p: QuadPose, x: number): void {
  p.neck[0] += 70 * x;
  p.head[0] -= 34 * x;
}
/** How high its muzzle is over the ground, bowed `x` (`bow`). */
function noseOver(spec: QuadSpec, R: Rest, p: QuadPose, plan: Plan, x: number): number {
  const q: QuadPose = { ...p, neck: [p.neck[0], p.neck[1]], head: [p.head[0], p.head[1], p.head[2]] };
  bow(q, x);
  const b = quadBones(spec, q);
  return Math.min(...R.chin.map((c) => place(b.head, c)[2])) - b.body.t[2] + plan.H;
}

/**
 * Grazing: its head bowed to the grass, cropping it -- a tug and a chew, in bursts -- its weight let onto its fore legs.
 */
function grazePlan(s: Capy, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim, k: number): Plan {
  const plan = stillPlan(R, p);
  plan.roll *= 1 - k;
  plan.H -= R.h * 0.04 * k;
  const burst = 0.5 + 0.5 * Math.max(0, cyc(a.t, 8));
  const chew = cyc(a.t, 72) * burst;
  p.head[0] -= k * 4 * chew;
  for (const e of p.ears) e[0] += k * 10;
  const stand = noseOver(spec, R, p, plan, 0);
  const want = Math.max(0.012, lerp(stand, 0.02 + 0.02 * Math.max(0, chew), k));
  let lo = -0.6, hi = 1.2;
  for (let q = 0; q < 16; q++) {
    const mid = (lo + hi) / 2;
    if (noseOver(spec, R, p, plan, mid) > want) lo = mid;
    else hi = mid;
  }
  bow(p, (lo + hi) / 2);
  return plan;
}

/* ---- the strike ------------------------------------------------------------------------------ */

/**
 * The Pailbara's butt: it crouches, its rump wiggling, springs forward with all four feet off the ground and its head down, and
 * butts what is in front of it with the top of its head; then hops back to where it was.
 */
function buttPlan(s: Capy, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = CAPY_HITS[0];
  const L = s.fore[0] + s.fore[1], J = s.len * 0.45;
  const crouch = ramp(t, 0.02, 0.2) * (1 - ramp(t, 0.2, 0.3));
  const out = ramp(t, 0.22, 0.48) * (1 - ramp(t, 0.66, 0.88));
  plan.surge = J * out;
  const fly = hump(t, 0.36, 0.15), hop = hump(t, 0.77, 0.1);
  const land = hump(t, hit + 0.02, 0.07);
  plan.H += R.h * (-0.12 * crouch + 0.45 * fly + 0.2 * hop - 0.08 * land);
  p.pitch += -6 * crouch + 8 * fly - 7 * hump(t, hit, 0.08);
  plan.roll += 5 * crouch * Math.sin(t * TAU * 6);
  // The head lowered as it flies, the brow forward, and snapped down onto the blow.
  const butt = ramp(t, 0.24, hit) * (1 - ramp(t, hit + 0.06, 0.82));
  p.neck[0] += 22 * butt + 10 * hump(t, hit, 0.05);
  p.head[0] -= 26 * butt;
  for (const e of p.ears) e[0] += 30 * crouch + 25 * butt;
  for (let i = 0; i < 4; i++) {
    const A = R.ankle[i], there: V3 = [A[0], A[1] + J, A[2]];
    const [t0, t1] = i < 2 ? [0.22, 0.47] : [0.25, 0.49];
    if (t > t0 && t < t1) plan.at[i] = arc(A, there, ramp(t, t0, t1), L * (i < 2 ? 0.6 : 0.4));
    else if (t >= t1 && t < 0.68) plan.at[i] = there;
    else if (t >= 0.68 && t < 0.87) plan.at[i] = arc(there, A, ramp(t, 0.68, 0.87), L * 0.35);
    plan.foot[i] = -18 * Math.sin(Math.PI * ramp(t, t0, t1)) - 12 * Math.sin(Math.PI * ramp(t, 0.68, 0.87));
  }
  return plan;
}

/**
 * The Caskybara's shove: it draws back onto its haunches, its head lowered, then drives forward off its hind legs, a fore foot
 * stepping into it, and shoves with its shoulder and the side of its head, its buckets swinging; and settles back.
 */
function shovePlan(s: Capy, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = CAPY_HITS[1];
  const L = s.fore[0] + s.fore[1];
  const back = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.3, 0.44));
  const drive = ramp(t, 0.32, hit) * (1 - ramp(t, 0.66, 0.96));
  plan.surge = s.len * (-0.1 * back + 0.26 * drive);
  plan.H += R.h * (-0.08 * back - 0.05 * drive);
  p.pitch += 4 * back - 5 * drive;
  p.neck[0] += 16 * (back + drive) + 12 * hump(t, hit, 0.05);
  p.neck[1] += 24 * drive;
  p.head[0] -= 14 * drive;
  p.head[2] -= 16 * drive;
  plan.roll += -8 * drive + 4 * hump(t, hit, 0.06);
  for (const e of p.ears) e[0] += 34 * (back + drive);
  // The right fore foot steps out ahead into the shove and back; the others stay down.
  const A = R.ankle[1], step: V3 = [A[0] * 1.1, A[1] + s.len * 0.32, A[2]];
  if (t > 0.34 && t < hit) plan.at[1] = arc(A, step, ramp(t, 0.34, hit), L * 0.4);
  else if (t >= hit && t < 0.72) plan.at[1] = step;
  else if (t >= 0.72 && t < 0.94) plan.at[1] = arc(step, A, ramp(t, 0.72, 0.94), L * 0.3);
  plan.foot[1] = -16 * Math.sin(Math.PI * ramp(t, 0.34, hit)) - 12 * Math.sin(Math.PI * ramp(t, 0.72, 0.94));
  return plan;
}

/** How long the Reservara's stamp takes to come down, as a share of its strike. */
const STAMP_DROP = 0.14;
/**
 * The Reservara's stamp: it rears its fore end up off the ground on its hind legs, both fore feet lifted, and brings them down
 * together in front of it, the whole of it shaking and the water in its casks thrown up; then it steps its feet back.
 */
function stampPlan(s: Capy, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = CAPY_HITS[2];
  const L = s.fore[0] + s.fore[1];
  const top = hit - STAMP_DROP;
  const rear = ramp(t, 0.04, top - 0.04) * (1 - clamp((t - top) / (hit - top)) ** 2);
  const shake = t > hit ? Math.sin((t - hit) * 70) * (1 - ramp(t, hit, 0.9)) : 0;
  const land = hump(t, hit + 0.03, 0.08);
  plan.H += R.h * (0.16 * rear - 0.08 * land) + 0.02 * shake;
  p.pitch += 16 * rear - 3 * land;
  p.neck[0] += -14 * rear + 10 * land;
  p.head[0] += -6 * rear;
  plan.rock += 2 * shake;
  plan.roll += 1.5 * shake;
  for (const e of p.ears) e[0] += 24 * rear;
  for (const i of [0, 1]) {
    const A = R.ankle[i];
    const high: V3 = [A[0] * 1.05, A[1] + L * 0.4, A[2] + L * 0.9];
    const down: V3 = [A[0], A[1] + s.len * 0.12, A[2]];
    const [b0, b1] = i ? [0.78, 0.96] : [0.68, 0.86];
    if (t < top) plan.at[i] = arc(A, high, ramp(t, 0.06, top - 0.04), 0);
    else if (t < hit) plan.at[i] = mixV(high, down, ((t - top) / (hit - top)) ** 2);
    else if (t < b0) plan.at[i] = down;
    else if (t < b1) plan.at[i] = arc(down, A, ramp(t, b0, b1), L * 0.16);
    plan.foot[i] = -20 * ramp(t, 0.06, top - 0.04) * (1 - ramp(t, top, hit)) - 6 * hump(t, hit, 0.04);
  }
  return plan;
}

/** Evolving: hunched as the light gathers and its vines grow over it, then drawn up tall at the turn, a shake of the head, and settled. */
function evolvePlan(R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p);
  const hunch = ramp(t, 0.06, 0.38) * (1 - ramp(t, 0.38, 0.54)), up = ramp(t, 0.44, 0.6) * (1 - ramp(t, 0.72, 0.94));
  plan.H += R.h * -0.08 * hunch;
  p.pitch += -3 * hunch + 4 * up;
  p.neck[0] += 18 * hunch - 14 * up;
  p.head[0] += -10 * hunch + 16 * up;
  p.head[2] += 12 * hump(t, 0.62, 0.1) * Math.sin(t * 60);
  for (const e of p.ears) e[0] += 25 * hunch;
  plan.roll += 2 * hump(t, 0.62, 0.1) * Math.sin(t * 60);
  return plan;
}

/* ---- its bones ------------------------------------------------------------------------------- */

/** Where each ear is rooted on the head (the right one). */
function earRoot(s: Capy): V3 {
  const q = onSq(s.head, s.ear.at[0], s.ear.at[1]);
  return sub(q.p, scale(q.n, 0.02));
}

/**
 * Its pose for what it is doing, over the one a body on four legs has (`quadPose`), and where its feet go.
 */
function planOf(s: Capy, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
  p.pitch += R.pitch;
  const act = a.act;
  if (act?.kind === 'strike') return [buttPlan, shovePlan, stampPlan][s.strike](s, R, p, act.t);
  if (act?.kind === 'work') return workPlan(s, R, p, act.t);
  if (act?.kind === 'evolve') return evolvePlan(R, p, act.t);
  if (a.graze > 0 && a.go <= 0) return grazePlan(s, spec, R, p, a, a.graze);
  if (a.go <= 0) return still(s, R, p, a);
  const going = goingPlan(s, spec, R, a), g = smooth(a.go);
  const G = s.gait, w = frac(a.u);
  // Going: the head carried a little lower and nodding with the stride, the ears easy.
  p.neck[0] += g * (4 + 6 * a.gait);
  p.neck[1] *= 1 - g * 0.7;
  p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.8) - g * 2;
  p.squash += g * (s.stage === 2 ? 0.02 : 0.012) * (pulse(w - 0.78) + pulse(w - 0.28));
  return a.go >= 1 ? going : mixPlan(still(s, R, p, a), going, g);
}

/**
 * Standing about, serene: breathing, its head drifting a little, now and then its chin lifted and its eyes on the sky, a slow
 * chew in bursts, an ear flicked, its weight shifted from side to side.
 */
function still(s: Capy, R: Rest, p: QuadPose, a: Anim): Plan {
  const plan = stillPlan(R, p);
  const lift = beat(a.t, [3.2, 14.8], 3.6);
  const chew = beat(a.t, [8.4, 19.6], 2.6) * Math.sin(a.t * TAU * 2.5);
  p.neck[0] = -1 - 10 * lift;
  p.neck[1] *= 0.6;
  p.head[0] = 1.5 * cyc(a.t, 5) + 12 * lift + 2.2 * chew;
  p.head[1] *= 0.7;
  p.head[2] *= 0.6;
  for (const e of p.ears) e[0] *= 0.6;
  plan.roll = 1.4 * cyc(a.t, 2, 0.4);
  // The young one's ears flicked now and then.
  if (s.stage === 0) for (const e of p.ears) e[0] -= 14 * beat(a.t, [5.2, 16.4], 0.5);
  return plan;
}

/** How low a leg's shin and knee come, the rings of their tubes as `legPieces` builds them: the lowest point of any. */
function shinLow(s: Capy, b: Bones, i: number): number {
  const fore = i < 2, key = LEGS4[i], L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick);
  const end = w * 0.56;
  const rings: Array<[string, V3, number]> = [
    [`${key}0`, [0, 0, -L[0]], w * 0.62],
    [`${key}1`, [0, 0, -L[1] * 0.5], w * 0.55], [`${key}1`, [0, 0.02, -L[1]], end],
  ];
  let low = Infinity;
  for (const [bone, at, r] of rings) {
    const c = place(b[bone], at), d = sub(place(b[bone], add(at, [0, 0, -1])), c);
    low = Math.min(low, c[2] - r * Math.sqrt(Math.max(0, 1 - d[2] * d[2])));
  }
  return low;
}

/**
 * The water in what it carries this moment: how full it is (nought to one), how far its top is tipped forward and to its left
 * against level (degrees) as it sloshes, and how far a slung bucket swings forward and out to its right (degrees). Standing, it
 * barely stirs; going, at a plod it rocks a little at each step and swings a little more at a run; struck, it sloshes after the
 * knock; at its task it fills from near empty, sloshing as it rocks, and the buckets lift as they float.
 */
interface Water { fill: number; tilt: [number, number]; swing: [number, number] }
function waterOf(s: Capy, a: Anim): Water {
  const act = a.act;
  let fill = 0.97, fwd = 1.2 * cyc(a.t, 4), lft = 1.2 * cyc(a.t, 3, 1), sp = 1.2 * cyc(a.t, 2), sr = 1.6 * cyc(a.t, 3, 0.5);
  if (a.go > 0 && !act) {
    const g = smooth(Math.min(1, a.go)), w = frac(a.u), run = a.gait;
    fwd = lerp(fwd, lerp(2.4, 6, run) * Math.sin(2 * TAU * (w - 0.15)), g);
    lft = lerp(lft, lerp(2.6, 4, run) * Math.sin(TAU * (w - 0.1)), g);
    sp = lerp(sp, lerp(3, 9, run) * Math.sin(2 * TAU * (w - 0.22)), g);
    sr = lerp(sr, lerp(4.5, 7, run) * Math.sin(TAU * (w - 0.28)), g);
  } else if (act?.kind === 'strike') {
    const since = (act.t - CAPY_HITS[s.strike]) * ACT_SECS.strike;
    fwd = -6 * hump(act.t, 0.3, 0.15) + ringOut(since, 16, 2.4);
    lft = ringOut(since, s.strike === 1 ? -14 : 6, 2.1, 3.4);
    sp = -8 * hump(act.t, 0.3, 0.16) + ringOut(since, 22, 1.8, 2.6);
    sr = s.strike === 1 ? 10 * ramp(act.t, 0.32, CAPY_HITS[1]) * (1 - ramp(act.t, 0.6, 0.95)) + ringOut(since, -18, 1.6, 2.4) : ringOut(since, 8, 1.6, 2.4);
  } else if (act?.kind === 'work') {
    const t = act.t, W = CAPY_WORK;
    fill = lerp(0.12, 0.97, ramp(t, W.fill[0] - 0.02, W.fill[1]));
    // Before the water reaches it, what it carries is near empty: from the walk's full, emptied as it wades in.
    fill = lerp(0.97, fill, ramp(t, 0, 0.06));
    const rk = rockOf(t);
    fwd = 3 * Math.sin(t * TAU * 3) * hump(t, 0.5, 0.2) + ringOut((t - W.rise) * ACT_SECS.work, 10, 2.2);
    lft = 12 * rk + ringOut((t - W.under) * ACT_SECS.work, 8, 2.4);
    sp = ringOut((t - W.rise) * ACT_SECS.work, 14, 1.8, 2.6);
    sr = 8 * rk;
  } else if (act?.kind === 'evolve') {
    lft = 14 * hump(act.t, 0.62, 0.1) * Math.sin(act.t * 60);
    sr = 10 * hump(act.t, 0.62, 0.1) * Math.sin(act.t * 50);
  }
  return { fill, tilt: [fwd, lft], swing: [sp, sr] };
}

/** A vessel's mouth and foot, how high up its own axis, in its own frame. */
const mouthZ = (V: Vessel): number => (V.sling ? -(V.drop ?? 0) : V.h);
const footZ = (V: Vessel): number => mouthZ(V) - V.h;

/**
 * The bones of a stage: its pose, every leg bent to put its foot where the pose says (`legTo`), the body raised to the height
 * the pose says and carried forward as far, and the barrel rolled and rocked over its legs, so the feet stay where they are;
 * then what it carries, each on a bone of its own (`v0`..), and the water in each (`w0`..), level in the world.
 */
function capyBones(s: Capy): (a: Anim) => Bones {
  const spec = specOf(s), R = restOf(s, spec);
  return (a) => {
    const p = quadPose(spec, { ...a, graze: 0, go: a.act ? 0 : a.go });
    const plan = planOf(s, spec, R, p, a);
    // However it is posed, its head never down in the ground.
    if (noseOver(spec, R, p, plan, 0) < 0.012) {
      let lo = -1.5, hi = 0;
      for (let q = 0; q < 14; q++) {
        const mid = (lo + hi) / 2;
        if (noseOver(spec, R, p, plan, mid) < 0.012) hi = mid;
        else lo = mid;
      }
      bow(p, lo);
    }
    for (let i = 0; i < 4; i++) {
      const g = plan.at[i], floor = Math.max(...R.sole[i].map((q) => -rotX(q, plan.foot[i])[2]));
      if (g[2] < floor) g[2] = floor;
      p.foot[i] = plan.foot[i];
    }
    p.roll = 0;
    const solve = (): Bones => {
      for (let i = 0; i < 4; i++) {
        const g = plan.at[i];
        const [sw, fold] = legTo(spec, i, p.pitch, [g[0], g[1] - plan.surge, g[2] - plan.H]);
        p.legs[i] = [sw, fold, 0];
      }
      return lifted(quadBones(spec, p), 0);
    };
    let b = solve();
    b = lifted(b, plan.H - b.body.t[2]);
    // Nor its shins or knees: down in the water at its task, or in a strike, the body is raised by as much as keeps them out;
    // otherwise the foot is put up by as much.
    const planted = !!a.act;
    for (let pass = 0; pass < (a.act?.kind === 'work' ? 0 : 3); pass++) {
      let again = false, rise = 0;
      for (let i = 0; i < 4; i++) {
        const dip = 0.012 - shinLow(s, b, i);
        if (dip <= 0) continue;
        again = true;
        if (planted && (i >= 2 || a.act?.kind === 'work')) rise = Math.max(rise, dip * 1.15);
        else plan.at[i][2] += dip * 1.15;
      }
      if (!again) break;
      plan.H += rise;
      b = solve();
      b = lifted(b, plan.H - b.body.t[2]);
    }
    b.shadow = shadowOf(b.body, Math.max(0, plan.H - R.h));
    if (plan.surge) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + plan.surge, b[k].t[2]] };
    if (plan.roll || plan.rock) b.trunk = joint(b.trunk, [0, 0, 0], plan.rock, plan.roll, 0);
    // What it carries, and its water.
    const W = waterOf(s, a);
    const f = turn(b.body, [0, 1, 0]), [X, Y, Z] = frameOf([0, 0, 1], [f[0], f[1], 0]);
    const dip = a.act?.kind === 'work' ? smooth(sunkOf(a.act.t) * 1.15) : 0;
    s.vessels.forEach((V, q) => {
      let vb = V.sling
        ? joint(xfOf(X, Y, Z, place(b.trunk, V.at)), [0, 0, 0], W.swing[0], W.swing[1] + V.sling * 14 * dip, 0)
        : joint(b.trunk, V.at, V.tip[0], V.tip[1], 0);
      // A slung bucket let down on its bail into the water as it goes down, tipped out to scoop, and drawn up again.
      if (V.sling && dip > 0) {
        const low = place(vb, [0, 0, footZ(V)])[2], want = poolZ(R) - V.h * 0.3;
        if (low > want) vb = { m: vb.m, t: [vb.t[0], vb.t[1], vb.t[2] - (low - want) * dip] };
      }
      b[`v${q}`] = vb;
      const k = clamp(W.fill) * 0.96;
      const c = place(vb, [0, 0, footZ(V) + V.h * k]), r = lerp(V.foot, V.r, k) * 0.93;
      b[`w${q}`] = scaled(joint(xfOf(X, Y, Z, c), [0, 0, 0], W.tilt[0], -W.tilt[1], 0), [r, r, 1]);
    });
    return b;
  };
}

/* ---- leaves, flowers, vines ------------------------------------------------------------------- */

/**
 * A leaf: a broad rounded blade from `root` out along `dir`, its face turned toward `face`, `L` long, its tip drooping; a shallow
 * V along its middle rib, a face either side of it and the same under it.
 */
function leafMesh(root: V3, dir: V3, face: V3, L: number, droop = 0.2, mat: Mat = 'leaf'): Mesh {
  const d = unit(dir), n0 = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n0));
  const pts = [root, add(add(root, scale(d, L * 0.45)), scale(n0, L * 0.02)), add(add(root, scale(d, L)), scale(n0, -L * droop))];
  const ws = [L * 0.07, L * 0.36, L * 0.02], th = L * 0.03;
  const v: V3[] = [];
  for (let k = 0; k < pts.length; k++) {
    const lift = scale(n0, ws[k] * 0.16);
    v.push(add(add(pts[k], scale(side, -ws[k])), lift), pts[k], add(add(pts[k], scale(side, ws[k])), lift));
  }
  for (let k = 0; k < pts.length; k++) for (let j = 0; j < 3; j++) v.push(sub(v[k * 3 + j], scale(n0, th)));
  const f: Face[] = [], want: V3[] = [], B = pts.length * 3;
  for (let k = 0; k < pts.length - 1; k++) {
    for (const j of [0, 1]) {
      f.push({ i: [k * 3 + j, k * 3 + j + 1, (k + 1) * 3 + j + 1, (k + 1) * 3 + j], m: j ? mat : k === 0 ? 'leafDark' : mat });
      want.push(n0);
      f.push({ i: [B + k * 3 + j, B + k * 3 + j + 1, B + (k + 1) * 3 + j + 1, B + (k + 1) * 3 + j], m: 'leafDark' });
      want.push(scale(n0, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/**
 * A flower: five rounded petals round a yellow middle, `r` across, facing along `n`, cupped a little: one surface, its petals
 * joined at the middle so it is inked round its edge only, in the petal's colour; its middle a spot of the ember's.
 */
function flowerMesh(c: V3, n: V3, r: number, mat: Mat, spin = 0): Mesh {
  const N = unit(n);
  const u = unit(cross(Math.abs(N[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], N)), w = cross(N, u);
  const R = 15, v: V3[] = [add(c, scale(N, r * 0.02))];
  for (let j = 0; j < R; j++) {
    const a = spin + (j / R) * TAU, lobe = ((1 + Math.cos(5 * (a - spin))) / 2) ** 0.35, rho = r * (0.5 + 0.5 * lobe);
    v.push(add(add(c, add(scale(u, Math.cos(a) * rho), scale(w, Math.sin(a) * rho))), scale(N, r * 0.28 * (rho / r) ** 2)));
  }
  const f: Face[] = [], want: V3[] = [];
  for (let j = 0; j < R; j++) {
    const a = 1 + j, b = 1 + ((j + 1) % R);
    f.push({ i: [0, a, b], m: mat });
    want.push(N);
    f.push({ i: [0, b, a], m: mat });
    want.push(scale(N, -1));
  }
  const heart = disc(add(c, scale(N, r * 0.06)), N, r * 0.26, r * 0.26, 7, 'ember', { lit: true });
  return merge(mesh(v, wound(v, f, want)), paint([heart]));
}

/** What stirs, as one mesh: each corner's root (what it sways on), a phase of its own, and how far it goes. */
interface Stir { mesh: Mesh; root: V3[]; ph: number[]; k: number[] }
interface Sprig { mesh: Mesh; root: V3; id: number; k?: number }
function stirOf(parts: readonly Sprig[]): Stir {
  const root: V3[] = [], ph: number[] = [], k: number[] = [];
  for (const p of parts) for (let q = 0; q < p.mesh.v.length; q++) { root.push(p.root); ph.push(jitter(p.id + 31) * TAU); k.push(p.k ?? 1); }
  return { mesh: merge(...parts.map((p) => p.mesh)), root, ph, k };
}

/**
 * How what hangs on it stirs this moment: how far each leaf sways on its root and how fast, and how far grown it is. A breeze
 * standing; stirred with each step as it goes, shaken as a blow lands and as it comes up out of the water; and as it evolves,
 * growing out from under half its size.
 */
function stirring(s: Capy, a: Anim): { jig: number; at: number; grow: number } {
  let jig = 0.05 * (1 - a.go) * (0.6 + 0.4 * cyc(a.t, 3)), at = a.t * TAU * 0.5, grow = 1;
  if (a.go > 0) {
    jig += smooth(a.go) * (0.1 + 0.06 * a.gait);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    jig += 0.2 * hump(act.t, CAPY_HITS[s.strike] + 0.05, 0.16);
    at = act.t * 60;
  } else if (act?.kind === 'work') {
    jig += 0.08 * Math.abs(rockOf(act.t)) + 0.2 * hump(act.t, CAPY_WORK.shake + 0.02, 0.08) + 0.1 * hump(act.t, CAPY_WORK.rise - 0.05, 0.08);
    at = act.t * 50;
  } else if (act?.kind === 'evolve') {
    const t = act.t;
    grow = 0.45 + 0.55 * ramp(t, 0.04, 0.5) + 0.12 * hump(t, 0.54, 0.08);
    jig += 0.08 * hump(t, 0.62, 0.1);
    at = t * 70;
  }
  return { jig: Math.min(0.3, jig), at, grow };
}

/** A piece of things that stir and grow (`stirring`): each whole, scaled from its root and swayed on it, a beat of its own. */
function stirred(s: Capy, G: Stir, hang = 0): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { jig, at, grow } = stirring(s, a);
    // A strand hanging down its flank swings out and back with the stride.
    const swing = hang && a.go > 0 ? hang * smooth(a.go) * Math.sin(frac(a.u) * TAU - 0.6) : 0;
    if (!jig && grow === 1 && !swing) return v as V3[];
    return v.map((p, i) => {
      const r = G.root[i], ph = G.ph[i], kk = G.k[i];
      let [x, y, z] = scale(sub(p, r), grow);
      const side = jig * kk * Math.sin(at + ph), fore = jig * kk * 0.6 * Math.cos(at * 1.3 + ph * 1.3) + swing * kk;
      const cs = Math.cos(side), ss = Math.sin(side), cf = Math.cos(fore), sf = Math.sin(fore);
      [x, z] = [x * cs + z * ss, -x * ss + z * cs];
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      return [r[0] + x, r[1] + y, r[2] + z];
    });
  };
}

/** A vine's line through its points on the body, off it as far as each says, smoothed and evenly spaced. */
function vineLine(s: Capy, V: Vine): V3[] {
  const B = s.body;
  const raw = V.pts.map(([y, th, off]) => { const q = onRings(B, y, th); return add(q.p, scale(q.n, off)); });
  const ctrl = V.closed ? [...raw, raw[0]] : raw;
  // A Catmull-Rom curve through them, a few points between each two.
  const out: V3[] = [];
  const K = ctrl.length, per = 4;
  const P = (i: number): V3 => (V.closed ? ctrl[(i + K - 1) % (K - 1)] : ctrl[clamp(i, 0, K - 1)]);
  for (let i = 0; i < K - 1; i++) {
    for (let q = 0; q < per; q++) {
      const t = q / per, p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as V3);
    }
  }
  out.push(V.closed ? out[0] : ctrl[K - 1]);
  return out;
}

/** The way out of the body from a point near it: from its long axis. */
const outOf = (s: Capy, p: V3): V3 => { const r = ringAt(s.body, clamp(p[1], s.body.y[0], s.body.y[s.body.y.length - 1])); return unit([p[0], 0, (p[2] - r.z) * 0.9]); };

/**
 * A vine on it: a twisted green stem along its line, leaves out of it every so far, turned out from the body and to either side
 * by turns, and its flowers; the stem as one mesh, the leaves and flowers as things that stir.
 */
function vineOf(s: Capy, V: Vine, lod: number, id0: number): { stem: Mesh; sprigs: Sprig[] } {
  const pts = vineLine(s, V);
  const stem = tube(pts, V.w, V.w, lod ? 5 : 4, (k) => (k % 3 === 0 ? 'leafDark' : 'stem'), { start: !V.closed, end: !V.closed });
  const sprigs: Sprig[] = [];
  // Along it by length.
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(...(sub(pts[k], pts[k - 1]) as [number, number, number])));
  const total = cum[cum.length - 1];
  const at = (d: number): { p: V3; t: V3 } => {
    let k = 1;
    while (k < cum.length - 1 && cum[k] < d) k++;
    const f = clamp((d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]));
    return { p: mixV(pts[k - 1], pts[k], f), t: unit(sub(pts[k], pts[k - 1])) };
  };
  const n = Math.max(1, Math.floor(total / V.every));
  for (let q = 0; q < n; q++) {
    const id = id0 + q;
    const { p, t } = at((q + 0.5) * (total / n));
    const out = outOf(s, p), sd = q % 2 ? 1 : -1;
    const side = unit(cross(t, out));
    const dir = unit(add(add(scale(out, 0.55 + 0.3 * jitter(id)), scale(side, sd * (0.7 + 0.3 * jitter(id + 1)))), scale(t, (jitter(id + 2) - 0.5) * 0.8)));
    const face = unit(add(out, scale(dir, -dot(out, dir))));
    const L = V.leaf * (0.8 + 0.4 * jitter(id + 3));
    const tint = jitter(id + 4);
    sprigs.push({ mesh: leafMesh(p, dir, add(face, [0, 0, 0.3]), L, 0.22, tint < 0.4 ? 'moss' : 'leaf'), root: p, id, k: 1 });
    // A second, smaller, out of the same node the other way: a vine's leaves grow in pairs and threes.
    if (jitter(id + 5) < 0.5) {
      const d2 = unit(add(dir, scale(side, -sd * 1.3)));
      sprigs.push({ mesh: leafMesh(p, d2, add(face, [0, 0, 0.3]), L * 0.75, 0.2, 'leaf'), root: p, id: id + 400, k: 1.2 });
    }
  }
  for (const [f, r, m] of V.flowers) {
    const { p } = at(f * total), out = outOf(s, p);
    sprigs.push({ mesh: flowerMesh(add(p, scale(out, V.w * 1.4)), add(out, [0, 0.25, 0.6]), r, m, jitter(id0 + f * 50) * TAU), root: p, id: id0 + 900 + Math.round(f * 100), k: 0.6 });
  }
  return { stem, sprigs };
}

/**
 * The Reservara's strands of vine hanging down its flanks from its back, as their leaves: each strand a line of them going down
 * over its side and on below it, overlapping so its stem is not seen, the longest from its shoulders.
 */
function drapeOf(s: Capy): Sprig[] {
  const D = s.drape, sprigs: Sprig[] = [];
  if (!D.n) return sprigs;
  for (const sd of [1, -1]) {
    for (let q = 0; q < D.n; q++) {
      const id = 1200 + q * 23 + (sd > 0 ? 0 : 11);
      const f = q / Math.max(1, D.n - 1);
      const y = lerp(D.from, D.to, f) + (jitter(id) - 0.5) * 0.3;
      const top = onRings(s.body, y, Math.PI / 2 - sd * (0.5 + 0.15 * jitter(id + 1)));
      const r = ringAt(s.body, y);
      const len = D.len * (1.05 - 0.45 * f) * (0.65 + 0.5 * jitter(id + 2));
      // Down over its flank, held out by its widest, and hanging free below it, curving a little back.
      const K = 6, pts: V3[] = [];
      for (let k = 0; k <= K; k++) {
        const u = k / K, z = top.p[2] - len * u;
        const zz = clamp((z - r.z) / r.h, -1, 1), x = r.w * Math.sqrt(Math.max(0, 1 - zz * zz)) * (z < r.z ? 0.94 : 1) + 0.05;
        pts.push([sd * Math.max(Math.abs(top.p[0]) * (1 - u), x * Math.min(1, u * 4)), y - 0.12 * u * u, z]);
      }
      // Leaves all down it, overlapping, each hanging out and down off it and to one side or the other by turns.
      for (let k = 1; k <= K; k++) {
        const p = pts[k], lid = id * 11 + k, out: V3 = [sd, 0, 0.15];
        const across = k % 2 ? 1 : -1, big = 0.27 * (1.05 - 0.3 * (k / K)) * (0.85 + 0.3 * jitter(lid + 3));
        const dir = unit([sd * (0.45 + 0.3 * jitter(lid)), across * (0.6 + 0.4 * jitter(lid + 1)), -0.55 - 0.3 * jitter(lid + 2)]);
        sprigs.push({ mesh: leafMesh(p, dir, out, big, 0.2, jitter(lid + 4) < 0.45 ? 'moss' : 'leaf'), root: pts[0], id: lid, k: 0.35 + 0.1 * k });
      }
    }
  }
  // A flower or two among them.
  for (const [sd, y, m] of [[-1, 0.7, 'cap'], [1, 0.3, 'petal'], [-1, -0.5, 'cap']] as Array<[number, number, Mat]>) {
    const q0 = onRings(s.body, y, Math.PI / 2 - sd * 0.7), q = q0;
    sprigs.push({ mesh: flowerMesh(add(q.p, scale(q.n, 0.1)), add(q.n, [0, 0, 0.3]), 0.1, m, y * 3), root: q.p, id: 1900 + Math.round(y * 10), k: 0.5 });
  }
  return sprigs;
}

/* ---- what it carries ------------------------------------------------------------------------- */

/** Faces drawn only while the way out of the vessel's axis to them is not away from the viewer: what is round its far side, outside it, is behind it. */
function outside(m: Mesh, axisAt: V3): Mesh {
  return mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const d = unit([c[0] - axisAt[0], c[1] - axisAt[1], 0]);
    return { ...f, unless: [-d[0], -d[1], -0.35] as V3 };
  }));
}

/** A closed loop of tube round a vessel's axis at height `z`, `r` out, `w` thick. */
function hoop(z: number, r: number, w: number, n: number, mat: Mat): Mesh {
  const pts = Array.from({ length: n + 1 }, (_, q) => [Math.cos((q / n) * TAU) * r, Math.sin((q / n) * TAU) * r, z] as V3);
  return tube(pts, w, w, 4, mat, { start: false, end: false });
}

/**
 * A vessel, as the three pieces it is drawn as: its inside (the staves' inner faces and the bottom), drawn before the water; and
 * its outside -- the staves, their hoops of green bamboo, the rim, a bail handle, leaves wrapped round its foot and lashing --
 * drawn after it, so the near wall covers the water and the far wall shows over it. Staves by turns a lighter and a darker wood;
 * a cask bellied.
 */
function vesselOf(V: Vessel, lod: number, id0: number): { inner: Mesh; outer: Mesh } {
  const n = cut(lod, 12, 16), z0 = footZ(V), z1 = mouthZ(V), cask = V.kind === 'cask';
  const zs = cask ? [z0, lerp(z0, z1, 0.5), z1] : [z0, z1];
  const rs = cask ? [V.foot, Math.max(V.r, V.foot) * 1.1, V.r] : [V.foot, V.r];
  const wall = tube(zs.map((z) => [0, 0, z] as V3), rs, rs, n, (_k, j) => (j % 2 ? 'wood' : 'woodDark'), { start: true, end: false });
  const inner0 = tube(zs.map((z) => [0, 0, z] as V3), rs.map((r) => r * 0.9), rs.map((r) => r * 0.9), n, 'bark', { start: false, end: false });
  const inner = mesh(inner0.v, inner0.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
  const bottom = mesh(Array.from({ length: n }, (_, j) => [Math.cos((j / n) * TAU) * V.foot * 0.9, Math.sin((j / n) * TAU) * V.foot * 0.9, z0 + V.h * 0.06] as V3), [{ i: Array.from({ length: n }, (_, j) => j), m: 'bark' }]);
  const rim = hoop(z1, V.r * 0.96, V.r * 0.075, n, 'wood');
  const hz = cask ? [0.18, 0.82] : [0.22, 0.72];
  const rAt = (k: number): number => (cask ? lerp(V.foot, Math.max(V.r, V.foot) * 1.1, 1 - Math.abs(k - 0.5) * 2) : lerp(V.foot, V.r, k));
  const hoops = hz.map((k) => hoop(lerp(z0, z1, k), rAt(k) * 1.02, V.r * 0.06, n, 'stem'));
  // A cask lashed round its belly with rope as well.
  if (cask) hoops.push(hoop(lerp(z0, z1, 0.5), rAt(0.5) * 1.03, V.r * 0.045, n, 'bark'));
  const parts: Mesh[] = [outside(merge(...hoops), [0, 0, 0])];
  // A slung bucket's bail handle of bamboo, up from either side of its mouth, its front and its back, to its hook.
  if (V.sling) {
    const top: V3 = [0, 0, 0], a: V3 = [0, V.r, z1 - V.h * 0.12], b: V3 = [0, -V.r, a[2]];
    const mid = (e: V3): V3 => [0, e[1] * 0.62, lerp(e[2], top[2], 0.75)];
    parts.push(tube([...curve(a, mid(a), top, 4), ...curve(top, mid(b), b, 4).slice(1)], V.r * 0.05, V.r * 0.05, 5, 'stem'));
    parts.push(...[a, b].map((e) => orbAlong(e, [0, e[1], 0], [V.r * 0.09, V.r * 0.09, V.r * 0.09], 6, 3, 'woodDark')));
  }
  // A tap low in its side.
  if (V.tap !== undefined) {
    const d: V3 = [Math.cos(V.tap), Math.sin(V.tap), 0], at: V3 = add(scale(d, rAt(0.2)), [0, 0, lerp(z0, z1, 0.2)]);
    parts.push(tube([add(at, scale(d, -0.02)), add(at, scale(d, V.r * 0.28)), add(add(at, scale(d, V.r * 0.34)), [0, 0, -V.r * 0.06])], V.r * 0.07, V.r * 0.07, 6, 'woodDark'));
  }
  // Leaves wrapped round its foot, pointing up its sides, and a vine round it among them.
  const leaves: Mesh[] = [];
  for (let q = 0; q < V.wrap; q++) {
    const id = id0 + q, a = (q / V.wrap) * TAU + jitter(id) * 0.6;
    const d: V3 = [Math.cos(a), Math.sin(a), 0];
    const root: V3 = add(scale(d, rAt(0.05) * 1.04), [0, 0, z0 + V.h * 0.04]);
    const L = V.h * (0.55 + 0.25 * jitter(id + 1));
    leaves.push(leafMesh(root, unit(add(scale(d, 0.25), [0, 0, 1])), d, L, 0.05, jitter(id + 2) < 0.5 ? 'moss' : 'leaf'));
  }
  if (V.wrap) parts.push(outside(merge(...leaves), [0, 0, 0]));
  parts.push(wall, rim);
  return { inner: merge(inner, bottom), outer: merge(...parts) };
}

/** The water's top in a vessel: a disc a unit across, on its own level bone, scaled to the vessel there; a pale light on it toward the sky. */
function waterTop(n: number): Mesh {
  const v: V3[] = Array.from({ length: n }, (_, j) => [Math.cos((j / n) * TAU), Math.sin((j / n) * TAU), 0] as V3);
  const top = mesh(v, wound(v, [{ i: Array.from({ length: n }, (_, j) => j), m: 'water' }], [[0, 0, 1]]));
  const light: Disc[] = [
    facing(Array.from({ length: 8 }, (_, j) => { const a = (j / 8) * TAU; return [-0.28 + Math.cos(a) * 0.42, 0.2 + Math.sin(a) * 0.22, 0.01] as V3; }), [0, 0, 1], 'shell'),
    facing(Array.from({ length: 6 }, (_, j) => { const a = (j / 6) * TAU; return [-0.42 + Math.cos(a) * 0.16, 0.26 + Math.sin(a) * 0.08, 0.02] as V3; }), [0, 0, 1], 'eyeWhite', { lit: true }),
  ];
  return merge(top, paint(light));
}

/* ---- the head ------------------------------------------------------------------------------- */

/** A body of rings, squared off (`SQUARE`): faces round each band, a cap at either end. */
function sqTube(R: Rings, n: number, mat: (ring: number, up: number, side: number) => Mat): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], K = R.y.length;
  for (let q = 0; q < K; q++) for (let j = 0; j < n; j++) v.push(sqPoint(R, R.y[q], ((j + 0.5) / n) * TAU));
  for (let q = 0; q < K - 1; q++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, t = ((j + 1) / n) * TAU;
      f.push({ i: [q * n + j, q * n + j2, (q + 1) * n + j2, (q + 1) * n + j], m: mat(q, Math.sin(t), Math.cos(t)) });
      const c = scale(add(add(v[q * n + j], v[q * n + j2]), add(v[(q + 1) * n + j2], v[(q + 1) * n + j])), 0.25);
      want.push([c[0], 0, c[2] - lerp(R.z[q], R.z[q + 1], 0.5)]);
    }
  }
  f.push({ i: Array.from({ length: n }, (_, j) => j), m: mat(0, 0, 0) });
  want.push([0, -1, 0]);
  f.push({ i: Array.from({ length: n }, (_, j) => (K - 1) * n + j), m: mat(K - 1, 0, 0) });
  want.push([0, 1, 0]);
  return mesh(v, wound(v, f, want));
}

/** A shape painted on the head, every corner on its surface: round `cy` along it and `cu` up it from (`y`, `th`), `ry` by `ru`. */
function onHead(s: Capy, side: number, y: number, th: number, pts: ReadonlyArray<readonly [number, number]>, m: Mat, lift: number, o: { lit?: boolean; unless?: boolean } = {}): Disc {
  const H = s.head, c0 = onSq(H, y, th), rho = Math.max(0.05, Math.hypot(c0.p[0], c0.p[2] - ringAt(H, y).z));
  const v = pts.map(([dy, du]) => {
    const r0 = onSq(H, y + dy, th + du / rho), r = side > 0 ? r0 : left(r0);
    return add(r.p, scale(r.n, lift));
  });
  const q = side > 0 ? c0 : left(c0);
  return facing(v, q.n, m, { lit: o.lit, at: sub(q.p, scale(q.n, H.w[3] * 0.1)) });
}
const ellipsePts = (rx: number, ry: number, n: number, cx = 0, cy = 0, rot = 0): Array<[number, number]> =>
  Array.from({ length: n }, (_, j) => { const a = ((j + 0.5) / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });

/**
 * Its eyes: small and dark, set high on the side of the head, half shut under a heavy lid -- the lower half of an almond under a
 * straight dark lid line, a glint in it -- which is what makes it calm. Shut, the lid line alone, lower. All of an eye goes out
 * of sight together round the far side of the head.
 */
function eyesOf(s: Capy, shut: boolean): Mesh {
  const E = s.eye, r = E.size, out: Mesh[] = [];
  for (const side of [1, -1]) {
    const d: Disc[] = [];
    const top = r * 0.72 * (0.5 - E.lid);
    if (!shut) {
      const shape: Array<[number, number]> = [];
      for (let j = 0; j <= 8; j++) { const a = Math.PI + (j / 8) * Math.PI; shape.push([Math.cos(a) * r * 1.25, Math.sin(a) * r * 0.72]); }
      // The lid's edge across its top, a little lower toward the front, where a capybara's eye narrows.
      shape.push([r * 1.1, top * 0.8], [0, top], [-r * 1.15, top * 1.15]);
      d.push(onHead(s, side, E.y, E.up, shape.map(([a, b]) => [a, b]), 'eye', 0.012));
      d.push(onHead(s, side, E.y, E.up, ellipsePts(r * 0.2, r * 0.13, 6, -r * 0.35, top - r * 0.2), 'glint', 0.018, { lit: true }));
    }
    // The lid line: a heavy dark brow-line along the top of the eye, past both its corners.
    const y0 = shut ? -r * 0.2 : top;
    const line: Array<[number, number]> = [[-r * 1.45, y0 + r * 0.05], [-r * 0.5, y0 + r * 0.2], [r * 0.5, y0 + r * 0.16], [r * 1.4, y0 - r * 0.08],
      [r * 1.35, y0 - r * 0.24], [r * 0.5, y0 + r * 0.0], [-r * 0.5, y0 + r * 0.04], [-r * 1.4, y0 - r * 0.14]];
    d.push(onHead(s, side, E.y, E.up, line, 'lid', 0.02));
    // A softer crease over it, the heavy lid's fold.
    d.push(onHead(s, side, E.y, E.up, [[-r * 1.1, y0 + r * 0.52], [0, y0 + r * 0.66], [r * 1.1, y0 + r * 0.42], [r * 1.0, y0 + r * 0.32], [0, y0 + r * 0.54], [-r * 1.0, y0 + r * 0.42]], 'coatDark', 0.014));
    const m = paint(d);
    const away: V3 = side > 0 ? [-1, -0.2, 0.7] : [1, -0.2, 0.7];
    m.f.forEach((f) => { f.unless = away; });
    out.push(m);
  }
  return merge(...out);
}

/**
 * The head: a big square block, the back of the skull rounded and the muzzle deep and blunt, its front flat; the fur its coat,
 * a little darker down the bridge and over the front of the muzzle; two dark nostrils high on the front of the muzzle, a cleft
 * down from them to a small closed mouth under it, turned up in the faintest smile; and its eyes.
 */
function headOf(s: Capy, n: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1;
  const skull = sqTube(H, n, (ring, up) => {
    if (ring >= last - 1 && up > -0.3) return 'muzzle';
    if (up < -0.75 && ring >= 2) return 'belly';
    return 'coat';
  });
  const parts: Mesh[] = [skull];
  const fr = H.w[last - 1], frontY = H.y[last];
  const dec: Disc[] = [];
  // The front of the muzzle, flat, `x` across it and `k` up it (a share of its depth): its nose a darker patch high on it, the
  // nostrils two slits slanting down and out, and a cleft down from them.
  const fz = (k: number): number => H.z[last] + H.h[last - 1] * k;
  const nose = (pts: Array<[number, number]>, m: Mat, lift: number): Disc => facing(pts.map(([x, k]) => {
    const yy = frontY - 0.04 * (Math.abs(x) / fr) ** 2 * H.h[last - 1];
    return [x, yy + lift, fz(k)] as V3;
  }), [0, 1, 0.2], m);
  dec.push(nose(ellipsePts(fr * 0.62, 0.2, 10, 0, 0.5), 'nose', 0.004));
  for (const sd of [1, -1]) dec.push(nose([[sd * fr * 0.22, 0.6], [sd * fr * 0.48, 0.5], [sd * fr * 0.52, 0.38], [sd * fr * 0.28, 0.44]], 'pad', 0.012));
  dec.push(nose([[-fr * 0.03, 0.4], [fr * 0.03, 0.4], [fr * 0.03, -0.25], [-fr * 0.03, -0.25]], 'lid', 0.012));
  parts.push(paint(dec));
  // The mouth: back from the foot of the cleft along the underside of the muzzle each side, turned up at its corner.
  const mouth: Disc[] = [];
  for (const sd of [1, -1]) {
    const pts = Array.from({ length: 5 }, (_, q) => {
      const f = q / 4, y = lerp(H.y[last] - 0.01, H.y[last - 3], f);
      const at = onSq(H, y, -Math.PI / 2 + sd * (0.15 + 0.55 * f));
      return { p: add(at.p, [0, 0, H.h[last - 1] * (0.22 + 0.1 * f * f)]), n: at.n };
    });
    const w = H.h[3] * 0.025;
    const band = [...pts.map((q) => add(add(q.p, scale(q.n, 0.01)), [0, 0, w])), ...[...pts].reverse().map((q) => add(add(q.p, scale(q.n, 0.01)), [0, 0, -w]))];
    mouth.push(facing(band, pts[2].n, 'lid', { at: sub(pts[2].p, scale(pts[2].n, 0.06)) }));
  }
  parts.push(paint(mouth));
  parts.push(eyesOf(s, shut));
  return merge(...parts);
}

/** Solids inside the head that hide what is round the far side of them. */
function headSolids(s: Capy): Array<{ c: V3; r: V3 }> {
  const H = s.head, last = H.y.length - 1;
  return [
    { c: [0, H.y[2], H.z[2]], r: [H.w[2] * 0.85, (H.y[3] - H.y[0]) * 0.5, H.h[2] * 0.85] },
    { c: [0, (H.y[4] + H.y[last - 1]) / 2, H.z[5]], r: [H.w[5] * 0.88, (H.y[last - 1] - H.y[4]) / 2, H.h[5] * 0.88] },
    { c: [0, H.y[3], H.z[3]], r: [H.w[3] * 0.85, (H.y[4] - H.y[2]) * 0.5, H.h[3] * 0.85] },
  ];
}

/** An ear: small and round, a thick cup of fur, darker at its rim, its inside a warm pinkish brown. */
function earOf(s: Capy, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  return merge(
    tube(curve([0, 0, -0.02], [0, 0.02, L * 0.5], [0, -0.01, L], 4), [w * 0.75, w, w, w * 0.7, 0.01], w * 0.4, n, (ring) => (ring >= 3 ? 'coatDark' : 'coat'), { up: [0, 1, 0], seam: 'start' }),
    paint([{ v: Array.from({ length: 8 }, (_, j) => { const a = ((j + 0.5) / 8) * TAU; return [Math.cos(a) * w * 0.55, w * 0.42, L * 0.48 + Math.sin(a) * L * 0.32] as V3; }), m: 'inner' }]),
  );
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A foot (the right; the left is its mirror): broad and dark, its toes a little splayed, each with a short dark nail. */
function footOf(r: number, drop: number, toes: number, n: number, k: number): Mesh {
  const sole = orbAlong([0, r * 0.45, -drop + r * 0.46], [0, 1, 0], [r * 1.0, r * 0.58, r * 1.1], Math.min(n, 7), 4, 'pad');
  const out: Mesh[] = [sole], nails: Disc[] = [];
  for (let q = 0; q < toes; q++) {
    const f = toes > 1 ? q / (toes - 1) - 0.5 : 0;
    const root: V3 = [f * r * 1.3, r * 1.0, -drop + r * 0.32];
    out.push(orbAlong(root, [f * 0.6, 1, -0.2], [r * 0.3, r * 0.26, r * 0.4], 5, 3, 'pad'));
    nails.push(disc(add(root, [f * r * 0.12, r * 0.4, -r * 0.08]), [f * 0.4, 1, 0.1], r * 0.13, r * 0.1, 5, 'claw'));
  }
  return merge(...out, paint(nails));
}

/** The barrel as one solid, a little inside its skin: its middle and its half-sizes. */
function barrelSolid(s: Capy): { c: V3; r: V3 } {
  const B = s.body, y0 = B.y[0], y1 = B.y[B.y.length - 1];
  return { c: [0, (y0 + y1) / 2, 0], r: [Math.max(...B.w) * 0.88, ((y1 - y0) / 2) * 0.88, Math.max(...B.h) * 0.88] };
}

/** The legs: short and thick, rooted up inside the body, the fur dark brown from the knee down, broad dark feet. */
function legPieces(s: Capy, n: number, k: number): Piece[] {
  const out: Piece[] = [];
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick);
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const upper = tube([0, 1, 2, 3, 4].map((q) => [0, 0, lerp(w * 0.6, -L[0], q / 4)] as V3), [w * 0.6, w * 1.05, w * 1.0, w * 0.86, w * 0.66], [w * 0.6, w * 1.0, w * 0.96, w * 0.82, w * 0.62], n, (ring) => (ring >= 3 ? 'coatDark' : 'coat'), { seam: 'end' });
    const end = w * 0.56;
    const lower = tube([0, 1, 2, 3].map((q) => [0, 0.02 * (q / 3), lerp(w * 0.3, -L[1], q / 3)] as V3), [w * 0.6, w * 0.6, lerp(w * 0.58, end, 0.5), end], [w * 0.6, w * 0.6, lerp(w * 0.58, end, 0.5), end], n, 'coatDark', { seam: 'both' });
    const foot = footOf(fore ? s.paw : s.hindPaw, L[2], fore ? 4 : 3, n, k);
    const hide = [barrelSolid(s)];
    const thigh = fore ? upper : merge(upper, orbAlong([-side * w * 0.04, -w * 0.1, -L[0] * 0.12], [0, 0, 1], [w * 1.15, w * 1.1, w * 1.05], n, k, 'coat'));
    const hideF = fore ? hide : undefined, hideIn = fore ? 'trunk' : undefined;
    out.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, under: 'body', convex: fore },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: 'body', front, convex: fore, hide: hideF, hideIn },
      { key: `${key}2`, mesh: side < 0 ? mirror(foot) : foot, bone: `${key}2`, bias: 0.03, after: 'body', front, hide: hideF, hideIn },
    );
  }
  return out;
}

/** A stage's pieces: a body on four legs with its own head, ears and feet; its vines and flowers; and what it carries, with water in it. */
function capyBuild(s: Capy, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6);
  const B = s.body, skull = headSolids(s)[0];
  const R = B;
  const nb = cut(lod, 10, 14);
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, nb,
    (ring, j) => (ring > 1 && ring < R.y.length - 2 && Math.sin(((j + 1) / nb) * TAU) < -0.6 ? 'belly' : 'coat'));
  // Its underside tucked in, so from behind it is a round loaf on its legs rather than an egg.
  const body = mesh(barrel.v.map((p, i) => {
    const q = Math.min(R.y.length - 1, Math.floor(i / nb)), t = clamp((R.z[q] - p[2]) / R.h[q]);
    return [p[0] * (1 - 0.18 * t * t), p[1], p[2] + R.h[q] * 0.05 * t * t] as V3;
  }), barrel.f);
  const solid = barrelSolid(s);
  const extras: Piece[] = [];
  // Its vines and what grows on them.
  const stems: Mesh[] = [], sprigs: Sprig[] = [];
  s.vines.forEach((V, q) => { const o = vineOf(s, V, lod, 100 + q * 100); stems.push(o.stem); sprigs.push(...o.sprigs); });
  // The neck's front, a solid: what hides the far side of a garland round it.
  const yN = B.y[B.y.length - 1] * 0.8, rN = ringAt(B, yN);
  const neckHide = { c: [0, yN, rN.z + rN.h * 0.2] as V3, r: [rN.w * 0.8, B.y[B.y.length - 1] * 0.3, rN.h * 0.85] as V3 };
  extras.push({ key: 'vines', mesh: merge(...stems), bone: 'trunk', bias: 0.08, after: ['body'], hide: [solid, neckHide], thin: true });
  if (sprigs.length) {
    const G = stirOf(sprigs);
    extras.push({ key: 'leaves', mesh: G.mesh, bone: 'trunk', bias: 0.1, after: ['body', 'vines'], hide: [solid, neckHide], bent: stirred(s, G), lines: false });
  }
  const D = drapeOf(s);
  if (D.length) {
    const G = stirOf(D);
    extras.push({ key: 'drape', mesh: G.mesh, bone: 'trunk', bias: 0.11, after: ['body', 'vines'], hide: [solid], bent: stirred(s, G, 0.12), lines: false });
  }
  // What it carries: its inside, its water, its outside, in that order; a slung one under the body seen from its far side.
  s.vessels.forEach((V, q) => {
    const P = vesselOf(V, lod, 700 + q * 40);
    const front: V3 | undefined = V.sling ? [V.sling, 0, 0] : undefined;
    extras.push({ key: `v${q}i`, mesh: P.inner, bone: `v${q}`, bias: 0.06, after: ['body', ...(V.sling ? [] : ['vines', 'leaves'])], front, lines: false });
    extras.push({ key: `w${q}`, mesh: waterTop(cut(lod, 12, 16)), bone: `w${q}`, bias: 0.002, after: [`v${q}i`] });
    extras.push({ key: `v${q}`, mesh: P.outer, bone: `v${q}`, bias: 0.002, after: [`w${q}`] });
  });
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.9, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -30,
    fore: { upper: [0, -s.fore[0], s.thick, s.thick], lower: [0, -s.fore[1], s.thick, s.thick], foot: footOf(s.paw, s.fore[2], 4, n, k) },
    hind: { upper: [0, -s.hind[0], s.thick, s.thick], lower: [0, -s.hind[1], s.thick, s.thick], foot: footOf(s.hindPaw, s.hind[2], 3, n, k) },
    breath: 0.03,
    extras,
  }).filter((pc) => !/^(fl|fr|hl|hr)[012]$/.test(pc.key));
  pieces.push(...legPieces(s, n, k));
  // A lilac flower tucked behind its left ear, and a leaf or two with it.
  const H = s.head, at = left(onSq(H, s.ear.at[0] * 0.8, 0.92));
  const fr = 0.085 + 0.03 * s.stage;
  const flower = merge(
    flowerMesh(add(at.p, scale(at.n, fr * 0.45)), add(at.n, [0, 0.3, 0.55]), fr, 'petal', 0.3),
    leafMesh(add(at.p, scale(at.n, 0.01)), unit(add(at.n, [0, -1.2, 0.3])), at.n, fr * 1.6, 0.2, 'leaf'),
    leafMesh(add(at.p, scale(at.n, 0.01)), unit(add(at.n, [0, -0.6, -0.9])), at.n, fr * 1.3, 0.2, 'moss'),
  );
  pieces.push({ key: 'headFlower', mesh: flower, bone: 'head', bias: 0.23, after: ['head', 'ear0', 'ear1'], front: [-1, 0, 0.4], lines: false });
  return pieces.map((pc) => {
    // Its head over the vines on its neck and shoulders while its face is toward the viewer, and under them while it is turned away.
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n + 2, false), shut: headOf(s, n + 2, true), hide: headSolids(s), after: ['leaves', 'vines', 'drape'], front: [0, 1, 0] as V3 };
    if (pc.key === 'body') return { ...pc, mesh: body };
    // Its neck going up out of its chest under the body's outline, so no line of its own crosses its shoulder.
    if (pc.key === 'neck') return { ...pc, under: ['head', 'body'] };
    return pc;
  });
}

/* ---- water drawn round it ----------------------------------------------------------------- */

const css = (c: RGB, al = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const WATER_RGB: RGB = [150, 204, 236], WATER_DEEP: RGB = [92, 156, 206], WATER_LIGHT: RGB = [226, 246, 255], WATER_INK: RGB = [58, 104, 150];
const LEAF_RGB: readonly RGB[] = [[140, 168, 96], [176, 196, 120], [110, 140, 78]];
const GRAVITY = 9;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** The size of a pixel in the canvas's own units, for things drawn by hand. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
/** How big a stage's water is drawn, against the Caskybara's. */
const bigOf = (s: Capy): number => s.len / 1.4;

/** A drop of water: a round pale-blue bead, an inked edge and a light glint, never under a pixel and a bit across. */
function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, stretch = 1): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.1 * px);
  g.fillStyle = css(WATER_INK, al * 0.9);
  g.beginPath();
  g.ellipse(x, y, r + 0.45 * px, r * stretch + 0.45 * px, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(WATER_RGB, al);
  g.beginPath();
  g.ellipse(x, y, r, r * stretch, 0, 0, TAU);
  g.fill();
  if (r > 1.3 * px) {
    g.fillStyle = css(WATER_LIGHT, al);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.35 * stretch, r * 0.36, 0, TAU);
    g.fill();
  }
}

/**
 * A flat ring of water on the ground at `c`, `rx` by `ry`, as a puddle or a ripple: filled if `fill`, its rim in `rim`; with `half`,
 * only its half nearer the viewer.
 */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, rx: number, ry: number, fill: RGB | null, rim: RGB, al: number, width: number, half = 0): void {
  if (al <= 0.01 || rx <= 0) return;
  const N = 24, pts: Array<[number, number]> = [];
  const a0 = Math.atan2(view.T[1] * ry, view.T[0] * rx) + Math.PI / 2;
  for (let q = 0; q <= N; q++) {
    const a = half ? a0 + (q / N) * Math.PI : (q / N) * TAU;
    pts.push(onScreen(view, [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry, c[2]]));
  }
  g.beginPath();
  pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (!half) g.closePath();
  if (fill) { g.fillStyle = css(fill, al); g.fill(); }
  if (width > 0) {
    g.strokeStyle = css(rim, al);
    g.lineWidth = width;
    g.stroke();
  }
}

/** A run of water through screen points, `w` wide at its top and `w1` at its foot: an inked edge, pale blue, a light core. */
function runOf(g: CanvasRenderingContext2D, pts: ReadonlyArray<[number, number]>, w: number, w1: number, al: number): void {
  if (pts.length < 2 || al <= 0.02) return;
  const px = pxOf(g);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const pass = (c: RGB, a: number, extra: number, k: number): void => {
    g.strokeStyle = css(c, a);
    for (let q = 0; q < pts.length - 1; q++) {
      const f = q / (pts.length - 1);
      g.lineWidth = Math.max(px, lerp(w, w1, f) * k + extra);
      g.beginPath();
      g.moveTo(pts[q][0], pts[q][1]);
      g.lineTo(pts[q + 1][0], pts[q + 1][1]);
      g.stroke();
    }
  };
  pass(WATER_INK, 0.85 * al, 1.2 * px, 1);
  pass(WATER_RGB, al, 0, 1);
  pass(WATER_LIGHT, 0.85 * al, 0, 0.35);
}

/** Where something thrown from `p` going `v` is `t` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number, fall = GRAVITY): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];

/** Drops thrown from `from`, `since` seconds after, out and up, falling; each drawn on its side of the body, gone by `life`. */
function splash(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.55, dir: V3 = [0, 0, 0]): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.7 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp + dir[0], Math.sin(a) * sp + dir[1], up * (0.6 + 0.7 * jitter(k + 2)) + dir[2]];
    const p = thrown(from, v, since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    drop(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), 1 - smooth((since - life * 0.6) / (life * 0.4)), 1.15);
  }
}

/**
 * How the water drawn round it moves this moment, as a phase going round once every `n`th of its loop standing, or once a
 * stride going: so the pictures kept of it standing and going each run in a loop.
 */
function flow(a: Anim, n: number, perStride: number): number {
  if (a.act) return frac(a.act.t * ACT_SECS[a.act.kind] * (n / 6));
  return a.go > 0.5 ? frac(a.u * perStride) : frac((a.t * n) / 24);
}

/**
 * Water running over a vessel's rim, and from a tap: from where it spills, out a little and down, as a thin stream of water that
 * falls to the ground, thinning and breaking into drops as it goes, and a ring where it lands; drops running down it. Each drawn
 * on its own side of the body. Standing, a trickle; going, more over the side the water sloshes to.
 */
function spills(g: CanvasRenderingContext2D, view: View, s: Capy, b: Bones, a: Anim, front: boolean): void {
  const mid = b.body.t, big = bigOf(s), px = pxOf(g), W = waterOf(s, a);
  if (W.fill < 0.85) return;
  const working = a.act?.kind === 'work' ? 1 - hump(a.act.t, 0.5, 0.42) : 1;
  s.vessels.forEach((V, q) => {
    const vb = b[`v${q}`];
    if (!vb) return;
    const runs: Array<{ p: V3; d: V3; v: number; w: number; tap: boolean }> = [];
    for (const ang of V.spill) {
      const d: V3 = [Math.cos(ang), Math.sin(ang), 0];
      runs.push({ p: add(scale(d, V.r * 1.04), [0, 0, mouthZ(V) + V.r * 0.04]), d, v: 0.35, w: 0.05, tap: false });
    }
    if (V.tap !== undefined) {
      const d: V3 = [Math.cos(V.tap), Math.sin(V.tap), 0], z0 = footZ(V);
      runs.push({ p: add(scale(d, V.r * 1.32), [0, 0, z0 + V.h * 0.2 - V.r * 0.08]), d, v: 0.7, w: 0.075, tap: true });
    }
    runs.forEach((r, k) => {
      const p0 = place(vb, r.p), dir = unit(turn(vb, r.d));
      if (nearSide(add(p0, scale(dir, 0.2)), mid, view) !== front) return;
      // How hard it runs: more as the water sloshes toward it.
      const toward = dot(dir, unit(turn(b.trunk, [-W.tilt[1] * 0.1, W.tilt[0] * 0.1, 0])));
      const on = r.tap ? 1 : clamp(0.65 + 0.35 * toward) * working;
      const vel: V3 = scale(dir, r.v * Math.sqrt(big));
      const T = Math.sqrt((2 * p0[2]) / GRAVITY + (vel[2] * vel[2]) / (GRAVITY * GRAVITY)) + 0.0001;
      const pts: Array<[number, number]> = [];
      const N = 10;
      const solid = r.tap ? 0.85 : 0.55;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * T * solid;
        // Hugging the outside of the vessel for its first stretch before it falls free.
        const hug = r.tap ? 0 : Math.max(0, 1 - i / 3) * 0.6;
        pts.push(onScreen(view, [p0[0] + vel[0] * t * (1 - hug), p0[1] + vel[1] * t * (1 - hug), p0[2] - 0.5 * GRAVITY * t * t]));
      }
      const w0 = r.w * big * (0.7 + 0.3 * on), w1 = r.w * big * 0.4;
      runOf(g, pts, Math.max(1.6 * px, w0), Math.max(1.2 * px, w1), on);
      // Below the stream, drops: falling the rest of the way.
      const ph = flow(a, 48, 3);
      for (let j = 0; j < 3; j++) {
        const u = frac(ph + j / 3 + jitter(q * 9 + k) * 0.3);
        const t = lerp(T * solid, T, u);
        const p: V3 = [p0[0] + vel[0] * t, p0[1] + vel[1] * t, p0[2] - 0.5 * GRAVITY * t * t];
        if (p[2] < 0.01) continue;
        const [x, y] = onScreen(view, p);
        drop(g, x, y, r.w * big * 0.45, on, 1.3);
      }
      // Beads running down the stream.
      for (let j = 0; j < 2; j++) {
        const u = frac(ph * 2 + j / 2 + 0.3 * k);
        const [x, y] = pts[Math.min(N, Math.floor(u * N))];
        g.fillStyle = css(WATER_LIGHT, 0.9 * on);
        g.beginPath();
        g.arc(x, y, Math.max(0.8 * px, r.w * big * 0.22), 0, TAU);
        g.fill();
      }
      // Where it lands: a ring spreading on the ground.
      const land: V3 = [p0[0] + vel[0] * T, p0[1] + vel[1] * T, 0.005], age = frac(ph * 2 + 0.1 * k);
      groundRing(g, view, land, (0.06 + 0.16 * age) * big, (0.05 + 0.13 * age) * big, null, WATER_LIGHT, 0.8 * (1 - age) * on, 1.1 * px);
    });
  });
}

/** Drips: now and then a bead swells under a vessel's rim or its foot, and falls; going, more of them, shaken off. */
function drips(g: CanvasRenderingContext2D, view: View, s: Capy, b: Bones, a: Anim, front: boolean): void {
  const mid = b.body.t, big = bigOf(s), size = 0.032 * Math.sqrt(big);
  s.vessels.forEach((V, q) => {
    const vb = b[`v${q}`];
    if (!vb) return;
    const spots: V3[] = [];
    for (const j of [0, 2]) {
      const ang = (V.spill[0] ?? 0) + Math.PI * (0.5 + 0.5 * j) + jitter(q * 5 + j) * 0.8;
      const d: V3 = [Math.cos(ang), Math.sin(ang), 0];
      spots.push(V.sling && j === 2 ? [0, 0, footZ(V) - 0.01] : add(scale(d, V.r * (j === 2 ? 0.95 : 1.06)), [0, 0, j === 2 ? footZ(V) + 0.02 : mouthZ(V) - V.h * 0.12]));
    }
    spots.forEach((sp, j) => {
      const src = place(vb, sp);
      if (nearSide(src, mid, view) !== front) return;
      const per = a.go > 0.5 ? 1 : 3;
      const u = frac(flow(a, a.go > 0.5 ? 12 : 6, per) + jitter(q * 11 + j * 3));
      if (u < 0.4) {
        const [x, y] = onScreen(view, src);
        drop(g, x, y + size * 0.6 * (u / 0.4), size * (0.4 + 0.6 * u / 0.4), 0.9, 1.2);
        return;
      }
      const ft = (u - 0.4) * 1.1, p: V3 = [src[0], src[1], src[2] - 0.5 * GRAVITY * ft * ft];
      if (p[2] > 0.02) {
        const [x, y] = onScreen(view, p);
        drop(g, x, y, size, 0.9, 1.4);
      } else {
        const land = Math.sqrt((2 * src[2]) / GRAVITY), age = (ft - land) / 0.3;
        if (age >= 0 && age < 1) groundRing(g, view, [src[0], src[1], 0.01], size * (1 + 3 * age), size * (0.8 + 2.4 * age), null, WATER_RGB, 0.8 * (1 - age), pxOf(g) * 1.1);
      }
    });
  });
}

/** The Reservara's puddle under its tap: a pool of water on the ground, darker at its rim. */
function tapPuddle(g: CanvasRenderingContext2D, view: View, s: Capy, b: Bones, a: Anim): void {
  const big = bigOf(s), px = pxOf(g);
  s.vessels.forEach((V, q) => {
    if (V.tap === undefined) return;
    const vb = b[`v${q}`], d: V3 = [Math.cos(V.tap), Math.sin(V.tap), 0];
    const p0 = place(vb, add(scale(d, V.r * 1.32), [0, 0, footZ(V) + V.h * 0.2])), dir = unit(turn(vb, d));
    const vel = scale(dir, 0.7 * Math.sqrt(big)), T = Math.sqrt((2 * p0[2]) / GRAVITY);
    const c: V3 = [p0[0] + vel[0] * T, p0[1] + vel[1] * T, 0.004];
    // Standing, a pool of it gathered under the tap; going, it is left behind, and what falls is only a splash.
    const r = 0.42 * big * (1 - smooth(a.go));
    if (r < 0.02) return;
    groundRing(g, view, c, r * 1.1, r * 0.8, [176, 216, 238], WATER_DEEP, 0.85, 1.1 * px);
    groundRing(g, view, [c[0] - r * 0.25, c[1] + r * 0.1, c[2]], r * 0.4, r * 0.25, [214, 238, 250], [214, 238, 250], 0.7, 0);
  });
}

/**
 * Filling: the water it wades into, round it on the ground -- the far half of its top under it, the near half over its legs, a
 * pale sheet with a darker rim -- rings going out across it as it goes in and as it rocks; a splash up round it as it lands in
 * the water, spouts thrown up into what it carries as it rocks, and the water running off it and its buckets as it comes up,
 * and drops flung from its head as it shakes. Each drawn on its own side of the body.
 */
function fillSpray(g: CanvasRenderingContext2D, view: View, s: Capy, b: Bones, t: number, front: boolean, R: Rest): void {
  const W = CAPY_WORK, big = bigOf(s), px = pxOf(g), mid = b.body.t;
  const k = ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1));
  if (k <= 0.01) return;
  const B = s.body, rx = Math.max(...B.w) * 1.7 + 0.25 * big + Math.max(0, ...s.vessels.map((V) => (V.sling ? V.r * 2.2 : 0))), ry = (B.y[B.y.length - 1] - B.y[0]) * 0.72 + 0.3 * big;
  // Shallow: its top over its feet, a little way up its legs.
  const c: V3 = [0, s.len * 0.1, poolZ(R) * k];
  const sheet: RGB = [168, 214, 240];
  if (!front) {
    groundRing(g, view, c, rx * k, ry * k, sheet, WATER_DEEP, 0.92, 1.3 * px);
    groundRing(g, view, [c[0] - rx * 0.3, c[1] + ry * 0.2, c[2]], rx * 0.35 * k, ry * 0.18 * k, [214, 238, 250], [214, 238, 250], 0.75, 0);
  } else {
    // Over each foot on its near side, and the foot of each slung bucket let down into it, the water's top lapping round it: they
    // stand in it.
    const wet: Array<[V3, number]> = [];
    for (const [leg, r] of [['fl2', s.paw], ['fr2', s.paw], ['hl2', s.hindPaw], ['hr2', s.hindPaw]] as Array<[string, number]>) {
      const f = b[leg] && place(b[leg], [0, r * 0.4, 0]);
      if (f && f[2] < c[2] + r && nearSide(f, mid, view)) wet.push([[f[0], f[1], c[2]], r * 2.1]);
    }
    s.vessels.forEach((V, q) => {
      const f = V.sling && b[`v${q}`] ? place(b[`v${q}`], [0, 0, footZ(V)]) : undefined;
      if (f && f[2] < c[2] && nearSide(f, mid, view)) wet.push([[f[0], f[1], c[2]], V.r * 1.25]);
    });
    for (const [at, r] of wet) {
      groundRing(g, view, at, r * k, r * k, [206, 234, 250], WATER_DEEP, 0.22, 0, 0);
      groundRing(g, view, at, r * k, r * k, null, WATER_LIGHT, 0.95, 1.3 * px, 1);
      groundRing(g, view, at, r * k * 1.4, r * k * 1.4, null, WATER_LIGHT, 0.45, 0.9 * px, 1);
    }
  }
  // Rings going out from it as it goes in and as it rocks.
  for (const [t0, r0] of [[W.under - 0.02, 0.5], [0.46, 0.7], [0.56, 0.7], [W.rise - 0.08, 0.6]] as Array<[number, number]>) {
    const age = (t - t0) / 0.35;
    if (age > 0 && age < 1) groundRing(g, view, c, rx * (r0 + 0.5 * age), ry * (r0 + 0.5 * age), null, WATER_LIGHT, 0.9 * (1 - age), 1.2 * px, front ? 1 : 0);
  }
  // A splash up round it as it lands in the water.
  const since = (t - W.under + 0.03) * ACT_SECS.work;
  for (const sd of [1, -1]) {
    const at = place(b.trunk, [sd * ringAt(B, 0).w * 1.05, 0, -ringAt(B, 0).h * 0.7]);
    splash(g, view, mid, [at[0], at[1], c[2]], since, front, 7, 40 + sd * 3, 0.9 * big, 2.6 * Math.sqrt(big), 0.05 * Math.sqrt(big), 0.5, [sd * 0.4, 0, 0]);
  }
  // Spouts thrown up into what it carries as it rocks: a curve of drops from the water's top up and over into each mouth.
  s.vessels.forEach((V, q) => {
    const vb = b[`v${q}`];
    if (!vb) return;
    const mouth = place(vb, [0, 0, mouthZ(V)]);
    for (let j = 0; j < 3; j++) {
      const t0 = W.fill[0] + 0.02 + j * 0.08 + q * 0.03;
      const u = (t - t0) / 0.16;
      if (u < 0 || u > 1) continue;
      const side = turn(b.trunk, [j % 2 ? 1 : -1, 0, 0]), out = V.sling ? unit([mouth[0] - mid[0], mouth[1] - mid[1], 0]) : unit([side[0], side[1], 0]);
      const from: V3 = [mouth[0] + out[0] * (V.sling ? V.r * 1.6 : ringAt(B, 0).w * 1.35), mouth[1] + out[1] * (V.sling ? V.r * 1.6 : ringAt(B, 0).w * 1.35), c[2]];
      for (let d = 0; d < 6; d++) {
        const f = clamp(u * 1.5 - d * 0.09);
        if (f <= 0 || f >= 1) continue;
        const p = arc(from, mouth, f, 0.2 + 0.4 * big);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        drop(g, x, y, (0.085 - d * 0.008) * Math.sqrt(big), 1 - f * 0.3, 1.1);
      }
    }
  });
  // The water running off it as it comes up: drops falling from its belly and from the foot of each slung bucket.
  const off = ramp(t, W.fill[1], W.rise) * (1 - ramp(t, 0.9, 1));
  if (off > 0.01) {
    const srcs: V3[] = [];
    for (let j = 0; j < 6; j++) srcs.push(place(b.trunk, [(j % 2 ? 1 : -1) * ringAt(B, 0).w * (0.5 + 0.4 * jitter(j)), lerp(B.y[0] * 0.8, B.y[B.y.length - 1] * 0.75, j / 5), -ringAt(B, 0).h * 0.85]));
    s.vessels.forEach((V, q) => { if (V.sling) srcs.push(place(b[`v${q}`], [0, 0, footZ(V)])); });
    srcs.forEach((p0, j) => {
      for (let d = 0; d < 2; d++) {
        const u = frac(t * 7 + jitter(j * 3 + d));
        const p: V3 = [p0[0], p0[1], p0[2] - 0.5 * GRAVITY * (u * 0.3) ** 2];
        if (p[2] < c[2] || nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        drop(g, x, y, 0.03 * Math.sqrt(big), off, 1.4);
      }
    });
  }
  // Drops flung from its head as it shakes.
  const shake = (t - W.shake + 0.02) * ACT_SECS.work;
  if (b.head) splash(g, view, mid, place(b.head, [0, 0, 0]), shake, front, 8, 90, 1.6 * Math.sqrt(big), 1.6, 0.04 * Math.sqrt(big), 0.4);
}

/** What a strike throws: water out of what it carries at the blow, and a splash where its feet come down. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Capy, b: Bones, t: number, front: boolean): void {
  const big = bigOf(s), mid = b.body.t, since = (t - CAPY_HITS[s.strike]) * ACT_SECS.strike;
  if (since <= 0) return;
  s.vessels.forEach((V, q) => {
    const vb = b[`v${q}`];
    if (!vb) return;
    const top = place(vb, [0, 0, mouthZ(V)]), fwd = unit(turn(b.body, [0, 1, 0]));
    splash(g, view, mid, top, since, front, 5 + 2 * s.stage, 20 + q * 11, 0.6 * Math.sqrt(big), 2.4, 0.045 * Math.sqrt(big), 0.5, scale(fwd, 0.6));
  });
  if (s.strike === 2) {
    for (const leg of ['fl2', 'fr2']) {
      const f = place(b[leg], [0, 0, 0]);
      splash(g, view, mid, [f[0], f[1], 0.05], since, front, 6, leg === 'fl2' ? 61 : 67, 1.0 * big, 2.2, 0.05 * Math.sqrt(big), 0.45);
    }
  }
}

/** Evolving: a burst of water off it at the start, then drops and leaves spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Capy, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], B = s.body;
  if (t < 0.3) splash(g, view, mid, place(b.trunk, [0, 0, ringAt(B, 0).h * 0.8]), t * ACT_SECS.evolve, front, 18, 5, 1.4 * big, 3.2, 0.045 * big, 0.55);
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = ringAt(B, 0).w * 1.6 + 0.3 * big, ry = s.len * 0.9 + 0.3 * big, high = ringAt(B, 0).h * 2.4 + 0.8 * big;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32), ang = (q / 18) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -ringAt(B, 0).h * 0.3 + u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3 === 0) {
      const c = LEAF_RGB[q % 3], r = 0.1 * big;
      g.fillStyle = css(c, swirl);
      g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), swirl);
      g.lineWidth = Math.max(pxOf(g) * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.45, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    } else drop(g, x, y, 0.05 * big * (1 - 0.4 * u), swirl * ramp(u, 0, 0.15), 1.1);
  }
}

/** Light over it as it evolves: a pale watery glow as it begins, and over its back at the turn. */
function capyGlow(s: Capy, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.trunk, [0, 0, ringAt(s.body, 0).h * 0.6]), r: s.body.y[s.body.y.length - 1] - s.body.y[0], c: [190, 228, 240], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.trunk, [0, 0, ringAt(s.body, 0).h * 1.4]), r: s.len * 0.9 + 0.5, c: [214, 238, 220], a: k });
  return out;
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the water it spills, fills and throws about. */
function capyKind(s: Capy): Kind {
  const bones = capyBones(s);
  const R = restOf(s, specOf(s));
  return {
    bones,
    build: (lod) => capyBuild(s, lod),
    // The variant's coat for its fur, warmed to caramel; its markings for the flower behind its ear and the lilac ones on its vines.
    // Its legs and feet a darker brown of its fur, its water pale blue, its leaves sage and olive, on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, [206, 154, 104], 0.35);
      const dark = mix(fur, [92, 58, 40], 0.5);
      const petal = mix(lighter(mark, 0.2), [214, 190, 240], 0.4);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: dark,
        coatLight: mix(fur, [255, 240, 220], 0.3),
        belly: mix(fur, [246, 222, 190], 0.3),
        muzzle: mix(fur, [120, 84, 64], 0.28),
        nose: mix(fur, [70, 50, 44], 0.62),
        pad: mix(dark, [50, 34, 30], 0.45),
        claw: [62, 46, 42],
        lid: [62, 40, 34],
        eye: [40, 26, 24],
        glint: [255, 252, 244],
        inner: mix(fur, [196, 120, 112], 0.4),
        petal,
        bloom: [240, 168, 176],
        cap: [252, 246, 226],
        ember: [240, 200, 96],
        leaf: [150, 176, 104],
        moss: [118, 144, 82],
        leafDark: [84, 112, 62],
        stem: [128, 160, 84],
        wood: [176, 128, 84],
        woodDark: [148, 104, 68],
        bark: [110, 78, 54],
        water: [164, 214, 240],
        shell: [206, 236, 250],
        eyeWhite: [246, 252, 255],
      }, 30);
    },
    shadow: [s.len * 0.9 + 0.3, Math.max(...s.body.w) * (s.vessels.some((v) => v.sling) ? 1.5 : 1.05)],
    stride: 1.3,
    size: s.size,
    blinks: 6,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are water's pale blue and a leaf's green.
    motes: [[160, 214, 240], [156, 186, 112]],
    glow: (b, a) => capyGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') fillSpray(g, view, s, b, act.t, front, R);
      if (under) tapPuddle(g, view, s, b, a);
      spills(g, view, s, b, a, front);
      drips(g, view, s, b, a, front);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const PAILBARA = capyKind(PAILBARA_LOOK);
export const CASKYBARA = capyKind(CASKYBARA_LOOK);
export const RESERVARA = capyKind(RESERVARA_LOOK);
