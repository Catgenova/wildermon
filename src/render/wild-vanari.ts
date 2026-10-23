import {
  ACT_SECS, add, beat, bipedBones, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, merge, mirrored, mix, moved, onEgg, orb,
  orbAlong, paint, scale, step, smooth, sub, TAU, taper, tube, unit, type Anim, type BipedPose, type BipedSpec, type Bones, type Disc, type Kind,
  type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The fruit-picker line: the Vanari, a small round lemur kit sitting up, cream
 * with a chocolate-brown mask round its big dark eyes, a crest of leaves on
 * its head, an orange held in both paws and a little wicker basket of them
 * on its back, its long brown tail curled up behind it into a leafy frond;
 * which grows into the Orchibelle, lithe and upright on long legs, cream with
 * brown limbs, a mantle of leaves on its shoulders, its basket strapped on
 * and a very long tail ringed brown and cream in an S, leafed at the tip; and
 * then the Arboanari, big and crouched, a mantle of leaves down its back, a
 * great woven basket heaped with oranges, and an enormous plumed tail banded
 * cream and brown with fronds of leaves along it. The species is still
 * `plucka` underneath, as saves and the database know it: it picks what the
 * fruit trees bear and carries it home.
 *
 * A body upright on two legs (`bipedBones`) that goes in bounds, as a sifaka
 * does: both feet together, a crouch, a spring and a float with its arms up,
 * its tail curling behind. At its task it stretches up into the tree, one paw
 * on the branch, plucks a fruit with the other and tucks it over its shoulder
 * into the basket; it strikes by snatching an orange out of its basket and
 * throwing it.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Vanari {
  stage: 0 | 1 | 2;
  /** The legs: the hip on the right, thigh, shin and the drop to the sole, how they stand (thigh forward, knee), how thick at the thigh and the shin, and the foot's length. */
  leg: { at: V3; len: [number, number, number]; rest: [number, number]; w: [number, number]; foot: number };
  /** The seat: the hips' half-sizes across, along and up. */
  hips: V3;
  /** The chest's joint on the hips, and how far forward of upright it is carried. */
  chest: { at: V3; lean: number };
  /** The torso's rings in the chest's frame, bottom to top: how high, how far forward, how wide and how deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  neck: { at: V3; len: number };
  /** The arms: the shoulder on the right, upper arm and forearm, how they hang (forward, out, elbow), how thick, the paw's size and its fingers' length. */
  arm: { at: V3; len: [number, number]; rest: [number, number, number]; w: [number, number]; paw: number; finger: number };
  /** The head's egg in its own frame, how far nose-up it is carried, the eyes' size, the snout's length and girth, and how far down the brown of its crown comes. */
  head: { c: V3; r: V3; pitch: number; eye: number; snout: [number, number]; cap: number };
  /** Each ear: how long and wide, splayed out and laid back (degrees). */
  ear: { len: number; w: number; out: number; back: number };
  /** The leaves of the crest on its head: how many, how long. */
  crest: [number, number];
  /** The leaves round its shoulders, in rows top to bottom: how many, how long, how far down they hang (nought out, one straight down), how high on the torso, and how far round its front they come (one: all the way). */
  mantle: Array<[number, number, number, number, number]>;
  /**
   * The tail: how many links and how long each, how thick at each joint, how far its root is lifted from straight back
   * (degrees, down negative), how far each joint after it curls up (degrees, spread evenly along it), how it is banded
   * (nought: brown; one: ringed; two: banded in pairs), how many leaves in the frond at its tip and how long, and how many
   * fronds along it.
   */
  tail: { links: number; len: number; w: number[]; lift: number; curl: number[]; bands: 0 | 1 | 2; frond: [number, number]; fronds: number };
  /** The basket on its back: how wide across its rim, how deep, where its rim's middle is in the chest's frame, how far it is tipped back, and how many oranges are heaped in it. */
  basket: { r: number; h: number; at: V3; tilt: number; fruit: number };
  /** Its bounds: the legs' swing at a walk and a run, how high it floats, how much of each it is on its feet, and how high it holds its arms. */
  gait: { amp: [number, number]; hop: [number, number]; duty: [number, number]; arms: number };
  /** How far it is crouched standing about: the Vanari sits on its haunches. */
  sit: number;
  /** How far its arms are drawn out past their length as it stretches up into the tree. */
  stretch: number;
  /** How big the orange it picks is, across. */
  fruit: number;
  size: number;
}

/** A Vanari: a small round kit sat up on its haunches, a big head with big eyes, an orange in its paws, a little basket on its back. */
const VANARI_LOOK: Vanari = {
  stage: 0,
  leg: { at: [0.34, 0.06, -0.06], len: [0.36, 0.32, 0.1], rest: [12, -26], w: [0.34, 0.15], foot: 0.46 },
  hips: [0.66, 0.6, 0.46],
  chest: { at: [0, 0, 0.14], lean: -4 },
  torso: { z: [-0.22, 0.06, 0.32, 0.5, 0.6], y: [0.02, 0.06, 0.05, 0.02, 0], w: [0.66, 0.68, 0.58, 0.42, 0.22], h: [0.58, 0.6, 0.52, 0.36, 0.2] },
  neck: { at: [0, 0.03, 0.52], len: 0.06 },
  arm: { at: [0.42, 0.12, 0.38], len: [0.27, 0.25], rest: [8, 6, 30], w: [0.12, 0.1], paw: 0.1, finger: 0 },
  head: { c: [0, 0.06, 0.54], r: [0.78, 0.7, 0.68], pitch: 0, eye: 0.2, snout: [0.3, 0.17], cap: 0.62 },
  ear: { len: 0.52, w: 0.5, out: 58, back: 12 },
  crest: [3, 0.6],
  mantle: [],
  tail: { links: 9, len: 0.36, w: [0.12, 0.15, 0.16, 0.16, 0.16, 0.15, 0.15, 0.14, 0.13, 0.1], lift: -30, curl: [18, 28, 32, 30, 26, 20, 12, 4], bands: 0, frond: [7, 0.8], fronds: 0 },
  basket: { r: 0.52, h: 0.54, at: [0.3, -0.8, 0.52], tilt: -18, fruit: 6 },
  gait: { amp: [24, 32], hop: [0.42, 0.6], duty: [0.46, 0.4], arms: 0 },
  sit: 1.15,
  stretch: 2.1,
  fruit: 0.22,
  size: 2.3,
};

/** An Orchibelle: lithe and upright on long legs, cream with brown limbs, a mantle of leaves, its basket strapped on, a very long ringed tail in an S. */
const ORCHIBELLE_LOOK: Vanari = {
  stage: 1,
  leg: { at: [0.32, 0.02, -0.1], len: [0.54, 0.54, 0.12], rest: [26, -52], w: [0.36, 0.16], foot: 0.56 },
  hips: [0.6, 0.54, 0.52],
  chest: { at: [0, 0, 0.16], lean: 6 },
  torso: { z: [-0.24, 0.12, 0.5, 0.84, 1.0], y: [0.02, 0.06, 0.06, 0.03, 0], w: [0.6, 0.64, 0.6, 0.46, 0.22], h: [0.52, 0.56, 0.52, 0.38, 0.2] },
  neck: { at: [0, 0.03, 0.92], len: 0.16 },
  arm: { at: [0.46, 0.06, 0.8], len: [0.54, 0.5], rest: [10, 8, 28], w: [0.13, 0.11], paw: 0.12, finger: 0.12 },
  head: { c: [0, 0.1, 0.46], r: [0.6, 0.56, 0.54], pitch: 2, eye: 0.15, snout: [0.4, 0.15], cap: 0.6 },
  ear: { len: 0.44, w: 0.36, out: 48, back: 18 },
  crest: [5, 0.66],
  mantle: [[13, 0.48, 0.5, 0.88, 1], [12, 0.52, 0.82, 0.62, 0.55]],
  tail: { links: 15, len: 0.32, w: [0.1, 0.13, 0.15, 0.16, 0.16, 0.16, 0.16, 0.16, 0.16, 0.16, 0.15, 0.15, 0.14, 0.13, 0.11, 0.07], lift: -50, curl: [8, 10, 12, 14, 10, 6, 14, 22, 24, 18, 8, 10, 18, 20], bands: 1, frond: [7, 0.72], fronds: 0 },
  basket: { r: 0.54, h: 0.6, at: [0.28, -0.86, 0.84], tilt: -16, fruit: 8 },
  gait: { amp: [26, 34], hop: [0.64, 0.9], duty: [0.42, 0.36], arms: 1 },
  sit: 0.15,
  stretch: 0.6,
  fruit: 0.26,
  size: 2.4,
};

/** An Arboanari: big and crouched, a mantle of leaves down its back, a great basket heaped with oranges, an enormous plumed tail banded cream and brown. */
const ARBOANARI_LOOK: Vanari = {
  stage: 2,
  leg: { at: [0.5, 0.04, -0.12], len: [0.62, 0.6, 0.14], rest: [36, -70], w: [0.5, 0.22], foot: 0.7 },
  hips: [0.86, 0.74, 0.66],
  chest: { at: [0, 0, 0.2], lean: 14 },
  torso: { z: [-0.3, 0.16, 0.66, 1.08, 1.28], y: [0.04, 0.08, 0.08, 0.04, 0], w: [0.86, 0.92, 0.86, 0.62, 0.3], h: [0.72, 0.76, 0.72, 0.52, 0.28] },
  neck: { at: [0, 0.04, 1.18], len: 0.18 },
  arm: { at: [0.68, 0.08, 1.0], len: [0.68, 0.62], rest: [12, 10, 30], w: [0.2, 0.17], paw: 0.16, finger: 0.16 },
  head: { c: [0, 0.12, 0.5], r: [0.66, 0.62, 0.58], pitch: 4, eye: 0.14, snout: [0.5, 0.17], cap: 0.75 },
  ear: { len: 0.46, w: 0.38, out: 50, back: 20 },
  crest: [6, 0.74],
  mantle: [[14, 0.66, 0.5, 1.12, 0.8], [15, 0.76, 0.82, 0.82, 0.4], [14, 0.8, 0.92, 0.46, 0.25], [12, 0.78, 0.95, 0.1, 0.2]],
  tail: { links: 9, len: 0.46, w: [0.18, 0.28, 0.4, 0.5, 0.58, 0.62, 0.6, 0.52, 0.38, 0.12], lift: -20, curl: [22, 26, 22, 10, -8, -18, -16, -6], bands: 2, frond: [8, 0.9], fronds: 3 },
  basket: { r: 0.78, h: 0.86, at: [0.34, -1.26, 1.04], tilt: -16, fruit: 10 },
  gait: { amp: [22, 30], hop: [0.58, 0.86], duty: [0.46, 0.38], arms: 1 },
  sit: 0.5,
  stretch: 0.5,
  fruit: 0.3,
  size: 2.8,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
type Arm = [number, number, number];
const mixArm = (a: readonly number[], b: readonly number[], t: number): Arm => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * A value through a go, by keys of [where in the go, what], the first at nought: eased from each to the next, and held at the
 * last to the end.
 */
function keyed(t: number, keys: ReadonlyArray<readonly [number, readonly number[]]>): Arm {
  const u = clamp(t);
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (u >= t0 && u < t1) return mixArm(v0, v1, smooth((u - t0) / (t1 - t0)));
  }
  const last = keys[keys.length - 1][1];
  return [last[0], last[1], last[2]];
}

/** A frame standing along `up` with its front along `fwd`: across, forward and up. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = [0, 1, 0];
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}

/** An egg with its axes along a frame: anything round that leans or points. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
}

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

/** A patch painted onto the egg `(C, R)` round the way `dir`, `rx` by `ry`, turned `spin`, laid onto its curve: a mask, a cheek. */
function patchOn(C: V3, R: V3, dir: V3, rx: number, ry: number, mat: Mat, spin = 0, lift = 0.012, sides = 12): Disc {
  const e = onEgg(C, R, dir), d = disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, sides, mat, { spin, at: add(e.p, scale(e.n, -0.02)) });
  return { ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); }) };
}

/** A tuft of fur: a cone from `root` out along `dir`, `len` long and `r` thick at its root. */
const tuft = (root: V3, dir: V3, len: number, r: number, mat: Mat, n = 5): Mesh =>
  taper([root, add(root, scale(unit(dir), len * 0.55)), add(root, scale(unit(dir), len))], r, 0.012, n, mat);

/** The torso's ring at a height, in the chest's frame: its middle, half-width and half-depth. */
function ringAt(s: Vanari, z: number): { y: number; w: number; h: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { y: lerp(T.y[k], T.y[k + 1], f), w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f) };
}

/** A point on the torso, `z` up it and `th` round it from its right side (forward positive), `lift` off it. */
function onTorso(s: Vanari, z: number, th: number, lift: number): V3 {
  const R = ringAt(s, z);
  return [Math.cos(th) * (R.w + lift), R.y + Math.sin(th) * (R.h + lift), z];
}

/* ---- the task and the strike, in time ---------------------------------------------------- */

/**
 * A go at its task, as shares of the go: its paw up in the tree by `reach`, two tugs at the fruit, plucked at `pluck`,
 * brought over its shoulder to the basket by `over` and let go into it at `drop`. The voice lands on these
 * (`../audio/voice-vanari`).
 */
export const VANARI_PICK = { reach: 0.26, tugs: [0.34, 0.41] as const, pluck: 0.48, over: 0.7, drop: 0.75 };
/** A strike: its paw in the basket for an orange by `grab`, thrown at `release`, and the orange bursting on what it was thrown at at `hit`. */
export const VANARI_THROW = { grab: 0.2, release: 0.42, hit: 0.6 };

/** How far through a go it is stretched up to the tree: eased in and out of a go played once, and held while it keeps at it. */
const upOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.2) * (1 - ramp(t, 0.86, 1)));

/** How far it turns its face to its right standing about, toward the viewer from where it is most often seen (degrees). */
const FACE_TURN = 30;

/**
 * Each arm (forward, out, elbow) at the parts of a go: up in the tree, tugging, and back over its shoulder with its paw in the
 * basket, by stage: the Vanari's up and out across in front of it, clear of its big head. An arm raised past level is turned out by a negative
 * `out`, the roll coming after the lift (`bipedBones`).
 */
const TREES: readonly Arm[] = [[150, 60, -6], [146, -40, -10], [146, -40, -10]];
const TUGS: readonly Arm[] = [[142, 56, 20], [136, -36, 26], [136, -36, 26]];
const BASKET: Arm = [214, 26, 128];
/** The other paw up on the branch while it picks. */
const BRANCH: Arm = [140, -34, 6];

/** How it holds its arms standing about, before anything it does: the Vanari's paws together on its orange; the others' hanging easy. */
function holdOf(s: Vanari): readonly [Arm, Arm] {
  if (s.stage === 0) return [[10, -62, 58], [10, -62, 58]];
  return [[4, 0, 18], [4, 0, 18]];
}

/* ---- its bones -------------------------------------------------------------------------- */

/** A stage's body on two legs (`BipedSpec`). The tail is its own (`tailBones`). */
const specOf = (s: Vanari): BipedSpec => ({
  high: s.leg.len[0] + s.leg.len[1] + s.leg.len[2],
  leg: { at: s.leg.at, len: s.leg.len, rest: s.leg.rest },
  chest: s.chest,
  neck: { at: s.neck.at, len: s.neck.len, lean: 0 },
  head: { pitch: s.head.pitch },
  arm: { at: s.arm.at, len: s.arm.len, rest: s.arm.rest },
  swing: s.gait.amp,
  waddle: 1,
  armSwing: 8,
});

/**
 * Each leg bent at the knee by `fold` more (as `bipedBones` folds a leg: the thigh forward twenty degrees and the knee back
 * fifty-five to each one of it) with the thigh brought forward or back by as much more as keeps the sole where it was, under
 * the hip: a crouch, or a stretch for a fold under nought, that never slides its feet over the ground.
 */
function crouch(s: Vanari, p: BipedPose, fold: number): void {
  if (!fold) return;
  const [L1, L2] = s.leg.len, [lp, kp] = s.leg.rest;
  for (const l of p.legs) {
    const a0 = (lp + l[0] + 20 * l[1]) * DEG, b0 = (kp - 55 * l[1]) * DEG;
    const y0 = L1 * Math.sin(a0) + L2 * Math.sin(a0 + b0);
    const f = Math.max(-0.4, l[1] + fold), b = (kp - 55 * f) * DEG;
    l[0] = thighFor(L1, L2, b, y0, a0) / DEG - lp - 20 * f;
    l[1] = f;
  }
}

/** The thigh's angle (radians, forward of straight down) that puts the foot of a leg `L1` and `L2` long, its knee bent `b`, `y` ahead of the hip: of the two that do, the one nearer `near`. */
function thighFor(L1: number, L2: number, b: number, y: number, near: number): number {
  const A = L1 + L2 * Math.cos(b), B = L2 * Math.sin(b), R = Math.hypot(A, B), phi = Math.atan2(B, A);
  const k = Math.asin(clamp(y / R, -1, 1)), one = k - phi, two = Math.PI - k - phi;
  const off = (x: number): number => Math.abs(Math.atan2(Math.sin(x - near), Math.cos(x - near)));
  return off(one) <= off(two) ? one : two;
}

/**
 * Its bound, through a stride: both feet together on the ground for `duty` of it, sweeping back under it as it sinks into a
 * crouch and springs out of it, and then up and away, the legs tucked and swung forward to land, the body floated over them.
 * Returns each leg (swing, fold, how far through the swing), and how high it is off the ground.
 */
function boundOf(s: Vanari, u: number, gait: number): { leg: [number, number, number]; float: number; sink: number } {
  const G = s.gait, w = frac(u);
  const amp = lerp(G.amp[0], G.amp[1], gait), duty = lerp(G.duty[0], G.duty[1], gait);
  const [sw, fold, off] = step(w, duty, amp);
  const sink = w < duty ? Math.sin((Math.PI * w) / duty) : 0;
  const air = w < duty ? 0 : (w - duty) / (1 - duty);
  return { leg: [sw, fold * 0.8, off], float: lerp(G.hop[0], G.hop[1], gait) * Math.sin(Math.PI * air), sink };
}

/**
 * A stage's pose over the one a body on two legs has (`bipedBones`): what it
 * holds and how; its bounds; and its moves -- the throw, a go at its task, and
 * evolving.
 */
function vanariPose(s: Vanari, p: BipedPose, a: Anim): void {
  const g = smooth(a.go), st = 1 - g, w = frac(a.u);
  const hold = holdOf(s);
  for (const k of [0, 1] as const) p.arms[k] = mixArm(p.arms[k], hold[k], s.stage === 0 ? 1 : 0.6);
  // Standing about, sat down on its haunches (the Vanari) or crouched a little; up off them to go.
  crouch(s, p, s.sit * st);
  if (a.go > 0) {
    const B = boundOf(s, a.u, a.gait);
    // Both feet together, in place of a step with each by turns.
    for (const i of [0, 1]) p.legs[i] = mixArm(p.legs[i], [B.leg[0], B.leg[1], B.leg[2]], g) as [number, number, number];
    crouch(s, p, g * (0.8 + 0.25 * a.gait) * B.sink);
    p.lift = g * B.float;
    p.roll *= 0.3;
    p.yaw *= 0.3;
    // Upright through the bound, leaning into it a little more at a run; the head kept level over it.
    p.chest[0] = lerp(p.chest[0], (4 + 10 * a.gait) - 6 * B.sink + 4 * Math.sin(w * TAU), g);
    p.head[0] = lerp(p.head[0], -2 + 6 * B.sink - 2 * a.gait, g);
    // Its arms held up and out as it floats, as a sifaka's are, thrown higher as it springs; the Vanari keeps its orange.
    if (s.gait.arms) {
      const up = 0.6 + 0.4 * Math.sin(w * TAU - 1.2);
      for (const k of [0, 1] as const) p.arms[k] = mixArm(p.arms[k], [0, 100 + 30 * up, -12 - 6 * up], g);
    } else {
      p.arms[0][0] += g * 10 * B.sink;
      p.arms[1][0] += g * 10 * B.sink;
    }
  }
  if (st > 0 && !a.act) {
    // Standing about, its face turned over its right shoulder toward whoever is watching, as a lemur's is.
    p.head[1] -= st * FACE_TURN * (1 - a.graze);
    p.neck[1] -= st * FACE_TURN * 0.3 * (1 - a.graze);
  }
  if (a.go <= 0) {
    const t = a.t;
    if (s.stage === 0) {
      // A sniff at its orange now and then, the paws brought up to its nose.
      const sniff = beat(t, [3.6, 11.4, 18.8], 1.6) * (1 - a.graze);
      p.head[0] -= 12 * sniff;
      p.arms[0][0] += 14 * sniff;
      p.arms[1][0] += 14 * sniff;
    } else {
      // Looking up into the trees now and then.
      const look = beat(t, [5.2, 15.8], 2.6) * (1 - a.graze);
      p.head[0] += 22 * look;
      p.chest[0] -= 4 * look;
      if (s.stage === 2) p.arms[1] = mixArm(p.arms[1], [40, 14, 70], 0.6 * look);
    }
    const gz = a.graze;
    if (gz > 0) {
      // Foraging: stooped low over the windfalls, a paw down among them and up to its mouth by turns; the Vanari nibbling at
      // the orange in its paws.
      const nib = 0.5 + 0.5 * Math.sin((t * TAU) / 1.6);
      crouch(s, p, 0.5 * gz);
      p.chest[0] += gz * (s.stage === 0 ? 4 : 18);
      p.head[0] -= gz * (14 + 8 * nib);
      if (s.stage > 0) p.arms[1] = mixArm(p.arms[1], mixArm([62, 8, -20], [70, -40, 110], nib), gz);
      else p.arms[0][0] += gz * 10 * nib;
    }
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') workPose(s, p, act.t, a.graze);
  else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, arms up and the head up to it; a shake at the turn; and settled.
    const t = act.t, up = ramp(t, 0.1, 0.45) * (1 - ramp(t, 0.62, 0.86)), shake = hump(t, 0.55, 0.1);
    crouch(s, p, -0.3 * up);
    p.chest[0] -= 8 * up;
    p.head[0] += 18 * up;
    p.head[2] += 12 * shake * Math.sin(t * 70);
    for (const k of [0, 1] as const) p.arms[k] = mixArm(p.arms[k], [150, -34, 20], up);
  }
}

/**
 * A go at its task: stretched up to the tree on its toes, one paw up on the
 * branch, the other reaching up to the fruit, two tugs, plucked, brought down
 * and back over its shoulder and let go into the basket; and up again for the
 * next while it keeps at it. The Vanari keeps its own orange in its other paw.
 */
function workPose(s: Vanari, p: BipedPose, t: number, graze: number): void {
  const up = upOf(t, graze), P = VANARI_PICK, again = graze > 0.5, TREE = TREES[s.stage], TUG = TUGS[s.stage];
  const rest = p.arms[1], from = again ? TREE : rest;
  const tug = hump(t, P.tugs[0], 0.04) + hump(t, P.tugs[1], 0.04);
  const pick = keyed(t, [[0, from], [P.reach, TREE], [P.pluck - 0.04, TREE], [P.pluck, TUG], [P.pluck + 0.04, TUG], [P.over, BASKET], [P.drop + 0.04, BASKET], [0.98, again ? TREE : rest]]);
  p.arms[1] = mixArm(mixArm(rest, pick, up), TUG, 0.5 * tug * up);
  if (s.stage > 0) p.arms[0] = mixArm(p.arms[0], [BRANCH[0] - 8 * tug, BRANCH[1], BRANCH[2] + 14 * tug], up);
  const over = ramp(t, P.pluck, P.over) * (1 - ramp(t, P.drop + 0.06, 0.98));
  // Stretched up tall, the chest drawn back to look up into the tree, then turned to bring its shoulder round to the basket.
  crouch(s, p, -(0.25 + s.sit * 0.6) * up * (1 - 0.5 * over));
  p.chest[0] -= up * (8 * (1 - over) - 6 * over);
  p.chest[2] -= up * 16 * over;
  p.head[0] += up * (30 * (1 - over) + 4 * tug - 6 * over);
  p.head[1] -= up * 28 * over;
  if (s.stage === 0) {
    // The Vanari is too small to reach: it hops up and hangs from the fruit by its paw, its feet tucked, until it comes off.
    const hang = ramp(t, 0.1, P.reach) * (1 - ramp(t, P.pluck, P.pluck + 0.1));
    p.lift += VANARI_HANG * hang * up;
    for (const l of p.legs) l[1] += 0.5 * hang * up;
    p.head[0] -= 12 * hang * up;
  }
}

/** How high the Vanari hops to hang from the fruit it picks, in its own units. */
const VANARI_HANG = 0.7;

/**
 * The throw: its paw back over its shoulder into the basket for an orange, the other held out at what it throws at and its
 * weight back; then the arm brought over and through, the body leaning into it, the orange let go at the top; and settled.
 */
function strikePose(s: Vanari, p: BipedPose, t: number): void {
  const T = VANARI_THROW;
  const wind = ramp(t, 0.02, T.grab) * (1 - ramp(t, T.grab + 0.08, T.release));
  const through = ramp(t, T.grab + 0.08, T.release) * (1 - ramp(t, T.release + 0.16, 0.95));
  const rest = p.arms[1];
  p.arms[1] = keyed(t, [[0, rest], [T.grab, BASKET], [T.grab + 0.08, BASKET], [T.release, [118, 8, 8]], [T.release + 0.14, [44, 6, 28]], [0.95, rest]]);
  const aim: Arm = [78, 14, 8];
  if (s.stage > 0) p.arms[0] = mixArm(p.arms[0], aim, wind);
  p.chest[0] += -10 * wind + 18 * through;
  p.chest[2] += -18 * wind + 14 * through;
  p.head[1] += 12 * wind - 6 * through;
  p.head[0] += 6 * wind - 4 * through;
  crouch(s, p, 0.25 * wind - 0.1 * through);
}

/** How far the throw has gathered it and let it go: for the tail and the leaves. */
const throwOf = (t: number): { wind: number; through: number } => ({
  wind: ramp(t, 0.02, VANARI_THROW.grab) * (1 - ramp(t, VANARI_THROW.grab + 0.08, VANARI_THROW.release)),
  through: hump(t, VANARI_THROW.release, 0.12),
});

/** Where a stage's tail joint `q` curls (degrees up), from its numbers spread evenly along it. */
function curlAt(s: Vanari, q: number): number {
  const C = s.tail.curl, f = ((q - 1) / Math.max(1, s.tail.links - 2)) * (C.length - 1);
  const i = Math.min(C.length - 2, Math.floor(f));
  return lerp(C[i], C[i + 1], f - i);
}

/**
 * The tail's bones: links from the back of its hips, each on from the one before, lifted at the root and curled as the stage
 * says, a wave running down it a beat behind the body; bobbing behind as it bounds, flicked standing about, lifted as it
 * throws and as it evolves.
 */
function tailBones(s: Vanari, b: Bones, a: Anim): void {
  const T = s.tail, n = T.links, g = smooth(a.go), w = frac(a.u);
  let lift = 0, sway = 0, curl = 0;
  if (a.go > 0) {
    // Bounding: drawn down as it springs and thrown up as it lands, a beat behind.
    const B = boundOf(s, a.u + 0.1, a.gait);
    lift += g * (10 * B.sink - 8 * Math.sin(w * TAU - 0.6));
    curl += g * (0.12 * Math.sin(w * TAU - 1.5) - 0.08 * a.gait);
    sway += g * 6 * Math.sin(w * TAU);
  }
  const st = 1 - g;
  if (st > 0) {
    const flick = beat(a.t, [2.3, 9.1, 15.8, 21.4], 0.9);
    curl += st * (0.06 * cyc(a.t, 3) + 0.12 * flick);
    sway += st * (10 * cyc(a.t, 4) + 10 * flick * Math.sin(a.t * 9));
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = throwOf(act.t);
    lift += 14 * k.wind - 8 * k.through;
    sway += -16 * k.wind + 18 * k.through;
  } else if (act?.kind === 'work') {
    const up = upOf(act.t, a.graze);
    sway += up * 12 * Math.sin(act.t * TAU);
    curl += up * 0.06;
  } else if (act?.kind === 'evolve') {
    const up = ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.62, 0.86));
    lift += 16 * up;
    curl += 0.2 * up;
  }
  const wave = a.go > 0 ? w * TAU : (a.t * TAU) / 4;
  let prev = joint(b.body, [0, -s.hips[1] * 0.86, -s.hips[2] * 0.25], -(T.lift + lift), 0, TAIL_SIDE + sway * 0.5);
  b.tail0 = prev;
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.len, 0], -curlAt(s, q) * (1 + curl), 0, (sway * 0.5) / n + 3 * Math.sin(wave - q * 0.55));
    b[`tail${q}`] = prev;
  }
}

/** Arm `k`'s bones drawn out `f` times their length from the shoulder, the paw kept its size. */
function stretched(b: Bones, k: number, f: number): void {
  if (f === 1) return;
  const [u, l, h] = [b[`arm${k}`], b[`elbow${k}`], b[`hand${k}`]];
  const long = (x: typeof u): typeof u => ({ m: [x.m[0], x.m[1], x.m[2] * f, x.m[3], x.m[4], x.m[5] * f, x.m[6], x.m[7], x.m[8] * f], t: x.t });
  const l2 = { ...long(l), t: add(u.t, scale(sub(l.t, u.t), f)) };
  b[`arm${k}`] = long(u);
  b[`elbow${k}`] = l2;
  b[`hand${k}`] = { m: h.m, t: add(l2.t, scale(sub(h.t, l.t), f)) };
}

/** How far round to its left its tail is carried, in degrees, so the basket on its back is not behind it. */
const TAIL_SIDE = 34;

/** The bones of a stage: a body on two legs (`bipedBones`) with its own pose over it, its tail, and the basket on its back, bouncing. */
function vanariBones(s: Vanari): (a: Anim) => Bones {
  const spec = specOf(s);
  return (a) => {
    const act = a.act;
    // Striking or at its task it is posed from standing; whether it was grazing is what says the go is looping.
    const base = act && act.kind !== 'evolve' ? { ...a, graze: 0 } : a;
    const b = bipedBones(spec, base, (p) => vanariPose(s, p, a));
    tailBones(s, b, a);
    // The basket on its back: jolted as it lands each bound, and as the fruit goes into it.
    let jolt = 0;
    if (a.go > 0) jolt += smooth(a.go) * 5 * Math.sin(frac(a.u) * TAU + 0.6);
    if (act?.kind === 'work') jolt += 6 * hump(act.t, VANARI_PICK.drop + 0.02, 0.05);
    b.basket = joint(b.chest, s.basket.at, s.basket.tilt + jolt, 0, 0);
    // Reaching up into the tree, its arms drawn out to their full stretch: the picking one until the fruit comes off, the one
    // on the branch while it is up there.
    if (act?.kind === 'work') {
      const up = upOf(act.t, a.graze), P = VANARI_PICK, again = a.graze > 0.5;
      const pick = (again ? 1 - ramp(act.t, 0.9, 1) : 0) + ramp(act.t, 0.04, P.reach) * (1 - ramp(act.t, P.pluck, P.over));
      stretched(b, 1, 1 + s.stretch * up * clamp(pick));
      if (s.stage > 0) stretched(b, 0, 1 + s.stretch * up);
    }
    return b;
  };
}

/* ---- leaves --------------------------------------------------------------------------------- */

/**
 * A thin flat thing along a line of points -- a leaf -- `widths` across it (half-widths) at each, its face turned along
 * `face`, its edges lifted by `fold` of its width so it is a shallow V down its middle: the half to its left in `mats[0]`,
 * to its right in `mats[1]`, its underside in `mats[2]`. No thickness: a top and an underside, whichever is turned to the
 * viewer drawn.
 */
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
  return mesh(v, wound(v, f, want));
}

/** The two greens a leaf comes in, each a top in two halves and an underside: a deep green and a young yellow-green. */
const TONES: ReadonlyArray<readonly [Mat, Mat, Mat]> = [['leaf', 'stem', 'leafDark'], ['moss', 'leaf', 'stem']];
const toneOf = (i: number, young = 0.3): readonly [Mat, Mat, Mat] => TONES[jitter(i * 3 + 1) < young ? 1 : 0];

/** A leaf: a pointed oval along a gentle arch from `root` the way `dir` goes, `len` long and `w` across, its face along `face`. */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, K: number, mats: readonly [Mat, Mat, Mat], arch = 0.14): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const tip = add(root, scale(d, len)), mid = add(add(root, scale(d, len * 0.5)), scale(f, len * arch));
  const widths = Array.from({ length: K }, (_, k) => Math.max(0.012, w * Math.sin(Math.PI * (k / (K - 1)) ** 0.8) ** 0.9));
  return sheet(curve(root, mid, tip, K - 1), widths, f, 0.25, mats);
}

/** One leaf of a piece of them: its mesh and the way it lifts as it stirs. */
interface Frond { mesh: Mesh; out: V3 }
/** A mesh of leaves with, for each corner, how far out along its leaf it is and which way it lifts. */
interface Fronds { mesh: Mesh; w: number[]; out: V3[] }
function fronds(parts: readonly Frond[]): Fronds {
  const w: number[] = [], out: V3[] = [];
  for (const p of parts) {
    // A leaf's corners go six to a point along it, root to tip (`sheet`).
    const K = p.mesh.v.length / 6;
    p.mesh.v.forEach((_, i) => { w.push(Math.floor(i / 6) / Math.max(1, K - 1)); out.push(p.out); });
  }
  return { mesh: merge(...parts.map((p) => p.mesh)), w, out };
}

/**
 * How far the leaves are stirred this moment: lifted off what they grow on, as a share of their length, and bounced. A
 * breeze now and then standing, a bounce at each bound, a rustle as it tugs at the fruit, a toss as it throws, and lifted
 * as it evolves.
 */
function stir(a: Anim, phase: number): { lift: number; sway: number; bounce: number } {
  const st = 1 - smooth(a.go);
  let lift = st * 0.04 * beat(a.t, [3.6, 11.9, 18.2], 1.6);
  let sway = st * (0.04 * cyc(a.t, 6, phase) + 0.03 * cyc(a.t, 11, phase * 2));
  let bounce = a.go > 0 ? smooth(a.go) * (0.1 + 0.05 * a.gait) * Math.sin(frac(a.u) * TAU - 0.8 - phase) : 0;
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = throwOf(act.t);
    lift += 0.1 * k.wind + 0.14 * k.through;
    bounce += 0.06 * k.through * Math.sin(act.t * 40 - phase);
  } else if (act?.kind === 'work') {
    const P = VANARI_PICK, tug = hump(act.t, P.tugs[0], 0.05) + hump(act.t, P.tugs[1], 0.05) + 1.5 * hump(act.t, P.pluck, 0.05);
    lift += 0.06 * tug;
    bounce += 0.04 * tug * Math.sin(act.t * 50 - phase);
  } else if (act?.kind === 'evolve') {
    lift += 0.22 * hump(act.t, 0.5, 0.25);
    sway += 0.08 * hump(act.t, 0.55, 0.12) * Math.sin(act.t * 70 - phase);
  }
  return { lift, sway, bounce };
}

/** A piece of leaves that stirs (`stir`): every corner moved by as far out along its leaf as it is. */
function stirring(f: Fronds, len: number, phase: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { lift, sway, bounce } = stir(a, phase);
    if (!lift && !sway && !bounce) return v as V3[];
    return v.map((p, i) => {
      const k = f.w[i] * len, o = f.out[i];
      return [p[0] + o[0] * lift * k + sway * k, p[1] + o[1] * lift * k, p[2] + o[2] * lift * k + bounce * k];
    });
  };
}

/* ---- the head ------------------------------------------------------------------------------- */

/** Where the snout is on the head: its middle and its frame, pointing forward and a little down; and its half-sizes. */
function snoutOf(s: Vanari): { c: V3; f: [V3, V3, V3]; r: V3; tip: V3 } {
  const C = s.head.c, R = s.head.r, [L, G] = s.head.snout;
  const f = frameOf(unit([0, 1, -0.4]), [0, 0, 1]);
  const c = add(C, [0, R[1] * 0.8, -R[2] * 0.32]);
  const r: V3 = [G, G * 0.82, L * 0.6];
  return { c, f, r, tip: add(c, scale(f[2], r[2] * 0.95)) };
}

/**
 * The eyes: each a dark rim, a big brown iris, a darker ring, a dark middle and two glints, laid onto the skull's curve; all of
 * an eye out of sight together when the head is between it and the viewer.
 */
function eyesOf(s: Vanari, shut: boolean): Mesh {
  const C = s.head.c, R = s.head.r, out: Disc[] = [], dir: V3 = [0.42, 0.86, 0.12];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * dir[0], dir[1], dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = s.head.eye, tall = 1.08;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'muzzle', o), 0.022));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.14, r * 1.16 * tall, 12, 'eye', o), 0.016));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystal', o), 0.02));
    out.push(onto(disc(add(p, scale(up, -r * 0.06)), n, r * 0.72, r * 0.74 * tall, 10, 'crystalDark', o), 0.024));
    out.push(onto(disc(add(p, scale(up, -r * 0.04)), n, r * 0.5, r * 0.54 * tall, 8, 'eye', o), 0.028));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36 * tall)), scale(across, side * r * 0.3)), n, r * 0.34, r * 0.34, 6, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.42 * tall)), scale(across, -side * r * 0.32)), n, r * 0.15, r * 0.15, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

/**
 * The head: a round skull, cream, the brown of its crown coming down over the back of it (the Vanari's over the top as
 * well); fluffed cream cheeks; a short muzzle with a dark nose; a chocolate mask round each big eye, drawn back toward the
 * ear on the grown ones; a small smile.
 */
function headOf(s: Vanari, n: number, k: number, shut: boolean): Mesh {
  const C = s.head.c, R = s.head.r, cap = s.head.cap;
  const skull = ((m: Mesh): Mesh => mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const d: V3 = [(c[0] - C[0]) / R[0], (c[1] - C[1]) / R[1], (c[2] - C[2]) / R[2]];
    const brown = d[2] > cap + 0.35 * d[1] || (d[1] < -0.55 && d[2] > -0.1);
    return brown ? f : { ...f, m: 'mark' as Mat };
  })))(orb(C, R, n + 4, k + 3, 'coat'));
  // Cheeks fluffed out either side below the ears, cream, ending in tufts pointing out and down.
  const cheeks: Mesh[] = [];
  for (const sd of [1, -1]) {
    const at = add(C, [sd * R[0] * 0.64, -R[1] * 0.02, -R[2] * 0.34]);
    cheeks.push(egg(at, frameOf(unit([sd, -0.1, -0.35]), [0, 1, 0]), [R[0] * 0.28, R[1] * 0.38, R[0] * 0.44], n, k, 'mark'));
    for (const [dz, dy, len] of [[0.14, -0.1, 0.36], [-0.3, 0.05, 0.4]] as Array<[number, number, number]>) {
      cheeks.push(tuft(add(at, [sd * R[0] * 0.12, dy * R[1], dz * R[2]]), [sd, -0.3 + dy, -0.2 + dz * 1.4], R[0] * len, R[0] * 0.2, 'mark', 5));
    }
  }
  // The muzzle: short, cream, a dark nose on its end.
  const S = snoutOf(s);
  const snout = egg(S.c, S.f, S.r, n, k, 'muzzle');
  const nose = egg(add(S.tip, add(scale(S.f[1], S.r[1] * 0.35), scale(S.f[2], -0.02))), frameOf([0, 0, 1], [0, 1, 0]), [S.r[0] * 0.5, S.r[0] * 0.34, S.r[0] * 0.32], 6, 4, 'nose');
  // The masks: a dark round each eye, drawn down toward the muzzle; on the grown ones drawn back toward the ear as well.
  const mask: Disc[] = [];
  const E = s.head.eye;
  for (const sd of [1, -1]) {
    mask.push(patchOn(C, R, [sd * 0.42, 0.86, 0.12], E * 1.9, E * 1.75, 'lid', 0, 0.008, 14));
    mask.push(patchOn(C, R, [sd * 0.34, 0.92, -0.2], E * 1.2, E * 1.4, 'lid', sd * 0.5, 0.009, 10));
    if (s.stage > 0) mask.push(patchOn(C, R, [sd * 0.8, 0.45, 0.22], E * 1.6, E * 0.9, 'lid', sd * -0.35, 0.009, 10));
  }
  // A small smile under the nose.
  const smile: Disc[] = [1, -1].map((sd) => {
    const pts = [0, 0.33, 0.66, 1].map((u) => {
      const e = onEgg(S.c, [S.r[0], S.r[2], S.r[1]], [sd * u * 0.8, 0.7, -0.75 + 0.35 * u * u]);
      return add(e.p, scale(e.n, 0.01));
    });
    const w = S.r[0] * 0.08;
    const v = [...pts.map((p) => add(p, [0, 0, w])), ...[...pts].reverse().map((p) => add(p, [0, 0, -w]))];
    return { v: sd > 0 ? v : v.reverse(), m: 'nose' as Mat };
  });
  return merge(skull, ...cheeks, snout, nose, paint(mask), paint(smile), eyesOf(s, shut));
}

/** An ear: big and rounded, the brown outside, a cream hollow facing forward with a tuft of cream fur out of it; along +z from its root. */
function earOf(s: Vanari, n: number): Mesh {
  const E = s.ear;
  const pts = [0, 0.3, 0.62, 0.88, 1].map((u) => [0, 0.02 * Math.sin(u * Math.PI), E.len * u] as V3);
  const ws = [E.w * 0.7, E.w, E.w * 0.9, E.w * 0.6, E.w * 0.12];
  const outer = tube(pts, ws, ws.map((x) => Math.max(0.025, x * 0.16)), n, 'coat', { up: [0, 1, 0] });
  const inner = tube([pts[0], ...pts.slice(1, 4)].map((p, q) => add(p, [0, E.w * 0.16, q ? 0 : E.len * 0.08])), [E.w * 0.5, E.w * 0.8, E.w * 0.7, E.w * 0.32], [E.w * 0.08, E.w * 0.12, E.w * 0.1, E.w * 0.04], n, 'inner', { up: [0, 1, 0] });
  const fluff = merge(
    tuft([0, E.w * 0.18, E.len * 0.12], [0.5, 0.6, 0.4], E.len * 0.42, E.w * 0.22, 'mark', 4),
    tuft([0, E.w * 0.18, E.len * 0.2], [-0.4, 0.6, 0.6], E.len * 0.36, E.w * 0.2, 'mark', 4),
  );
  return merge(outer, inner, fluff);
}

/** The ears on the head, each placed and turned: up and out at the sides of the crown, a little back. */
function earsOf(s: Vanari, n: number): [Mesh, Mesh] {
  const C = s.head.c, R = s.head.r, E = s.ear, ear = earOf(s, n);
  const at = onEgg(C, R, [0.72, -0.12, 0.62]).p;
  const right = moved(ear, add(at, [-0.04, 0, -0.04]), -12, -E.back, E.out);
  return [mirrored(right), right];
}

/** The leaves of the crest on its head: fanned up and back from the crown, their faces turned out to either side. */
function crestOf(s: Vanari, K: number): Fronds {
  const C = s.head.c, R = s.head.r, [count, L] = s.crest;
  const top = onEgg(C, R, [0, 0.1, 1]).p;
  const out: Frond[] = [];
  for (let q = 0; q < count; q++) {
    const f = count > 1 ? q / (count - 1) - 0.5 : 0, id = 40 + q + s.stage * 10, side = f === 0 ? (q % 2 ? 1 : -1) : Math.sign(f);
    // The middle ones tallest and the outer ones lower and laid back further, so the crest is a fan seen from any side.
    const dir = unit([f * 1.3 + 0.08 * (jitter(id) - 0.5), -0.35 - 0.6 * Math.abs(f), 1 - 0.45 * Math.abs(f)]);
    const root = add(top, [f * R[0] * 0.3, 0.06 - 0.12 * Math.abs(f), -0.04]);
    const len = L * (1 - 0.3 * Math.abs(f) + 0.12 * jitter(id + 3));
    const face: V3 = [side * 0.9, 0.3, 0.4];
    out.push({ mesh: leaf(root, dir, face, len, len * 0.42, K, toneOf(id, 0.5), 0.16), out: [0, -0.4, 1] });
  }
  return fronds(out);
}

/* ---- the tail ------------------------------------------------------------------------------- */

/** Which colour link `q` of a stage's tail is: the Vanari's all brown; the Orchibelle's ringed; the Arboanari's banded in pairs. */
function bandOf(s: Vanari, q: number): Mat {
  const T = s.tail;
  if (T.bands === 0 || q === 0) return 'coat';
  if (T.bands === 1) return q >= T.links - 2 ? 'coat' : q % 2 ? 'feather' : 'coat';
  return Math.floor((q + 1) / 2) % 2 ? 'feather' : 'coat';
}

/** The tail's links, each soft and fluffed out in its middle; the Arboanari's a plume, with locks of fur round each. */
function tailLinks(s: Vanari, n: number): Mesh[] {
  const T = s.tail;
  return Array.from({ length: T.links }, (_, q) => {
    const w0 = T.w[q], w1 = T.w[q + 1], wm = Math.max(w0, w1) * 1.08, last = q === T.links - 1, L = T.len;
    const mat = bandOf(s, q);
    const ys = last ? [0.05, -L * 0.3, -L * 0.7, -L * 1.0] : [0.05, -L * 0.3, -L * 0.7, -L - 0.03];
    const ws = last ? [w0 * 0.98, wm, wm * 0.8, w1] : [w0 * 0.98, wm, wm, w1 * 0.98];
    const link = tube(ys.map((y) => [0, y, 0] as V3), ws, ws.map((x) => x * 0.94), n, mat, { start: q === 0, end: last });
    if (s.stage < 2 || q === 0 || last) return link;
    // Locks of fur round it swept out and toward the tip, two rings of four to a link, each turned from the last, so it is a plume.
    const locks = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => {
      const row = j % 2, a = ((Math.floor(j / 2) + 0.5 * row + 0.25 * (q % 2)) / 4) * TAU + 0.5 * jitter(q * 7 + j), r: V3 = [Math.cos(a), 0, Math.sin(a)];
      const root = add(scale(r, wm * 0.8), [0, -L * (0.25 + 0.45 * row), 0]);
      return tuft(root, add(scale(r, 0.55), [0, -0.85, 0]), wm * 0.85, wm * 0.24, mat, 4);
    });
    return merge(link, ...locks);
  });
}

/** The frond at the tail's tip: leaves fanned out of its end along it, in the last link's frame; and on the Arboanari, fronds along it. */
function tailFrond(s: Vanari, K: number): Fronds {
  const T = s.tail, [count, L] = T.frond, end: V3 = [0, -T.len * 0.85, 0], out: Frond[] = [];
  for (let q = 0; q < count; q++) {
    const f = count > 1 ? q / (count - 1) - 0.5 : 0, id = 90 + q + s.stage * 13;
    // Fanned flat across the tail's curl, as a palm's fronds are, and a little out of it either way.
    const dir = unit([f * 1.6, -1, (jitter(id) - 0.5) * 0.7]);
    const len = L * (1 - 0.35 * Math.abs(f) + 0.15 * jitter(id + 1));
    out.push({ mesh: leaf(add(end, [f * 0.06, 0, 0]), dir, [0.2 * f, 0, 1], len, len * 0.3, K, toneOf(id, 0.35), 0.12), out: [0, 0, 1] });
  }
  return fronds(out);
}

/** The Arboanari's fronds along its plume: a pair of leaves out of either side of each of a few of its links, in that link's frame. */
function plumeFronds(s: Vanari, K: number): Fronds[] {
  const T = s.tail, out: Fronds[] = [];
  for (let q = 0; q < T.fronds; q++) {
    const link = 3 + q * 2, w = T.w[link], parts: Frond[] = [];
    for (const sd of [1, -1]) {
      for (let j = 0; j < 2; j++) {
        const id = 200 + q * 7 + j * 3 + (sd > 0 ? 1 : 0);
        const root: V3 = [sd * w * 0.7, -T.len * (0.3 + 0.35 * j), w * 0.3];
        const len = T.frond[1] * (0.8 + 0.3 * jitter(id));
        parts.push({ mesh: leaf(root, [sd * 0.8, -0.9, 0.35 + 0.3 * jitter(id + 1)], [0, 0.2, 1], len, len * 0.3, K, toneOf(id, 0.35), 0.12), out: [sd * 0.5, 0, 1] });
      }
    }
    out.push(fronds(parts));
  }
  return out;
}

/* ---- the basket and the fruit ---------------------------------------------------------------- */

/** An orange: a round ball, deeper underneath, with a stalk, a leaf and a glint; `r` across, at `c`. */
function orange(c: V3, r: number, n: number, K: number, spin: number, leafy = true): Mesh {
  const top = add(c, [0, 0, r * 0.92]);
  const lf = leafy && leaf(add(top, [0, 0, 0.01]), [Math.cos(spin), Math.sin(spin), 0.5], [-Math.sin(spin) * 0.3, Math.cos(spin) * 0.3, 1], r * 1.3, r * 0.42, K, TONES[0], 0.1);
  return merge(
    // Its underside a deeper orange, so oranges heaped together read one from the next.
    ((m: Mesh): Mesh => mesh(m.v, m.f.map((f) => (f.i.reduce((t, i) => t + m.v[i][2], 0) / f.i.length < c[2] - r * 0.25 ? { ...f, m: 'flame' as Mat } : f))))(orbAlong(c, [0, 0, 1], [r, r, r * 0.92], n, 5, 'ember')),
    paint([disc(add(c, [-r * 0.42, -r * 0.3, r * 0.72]), [-0.45, -0.35, 0.82], r * 0.24, r * 0.32, 5, 'glint', { lit: true })]),
    taper([top, add(top, [0.01, 0, r * 0.3])], r * 0.08, r * 0.05, 4, 'bark'),
    lf,
  );
}

/**
 * A woven basket: a round-bottomed bowl of tan wicker, the weave in two shades over and under, a thick rim, and heaped above
 * it with oranges among leaves. Its rim's middle at the origin, its bottom down along -z, `R` across.
 */
function basketOf(s: Vanari, n: number, K: number): Mesh {
  const { r: R, h: H, fruit } = s.basket, N = n + 2;
  const zs = [-H, -H * 0.86, -H * 0.62, -H * 0.38, -H * 0.16, 0], rs = [R * 0.5, R * 0.76, R * 0.92, R * 0.99, R * 1.02, R * 1.04];
  const bowl = tube(zs.map((z) => [0, 0, z] as V3), rs, rs.map((r) => r * 0.84), N * 2, (ring, j) => ((ring + Math.floor(j / 2)) % 2 ? 'wood' : 'woodDark'), { up: [0, 1, 0], end: false });
  const rim = tube(Array.from({ length: N + 1 }, (_, q): V3 => [Math.cos((q / N) * TAU) * R * 1.06, Math.sin((q / N) * TAU) * R * 0.88, 0.02]), 0.09 + 0.03 * s.stage, 0.09 + 0.03 * s.stage, 4, 'woodDark', { start: false, end: false });
  // What is in it: a mound of leaves under the rim, and oranges heaped up out of it, the middle ones highest.
  const fill = orbAlong([0, 0, 0.02], [0, 0, 1], [R * 0.95, R * 0.8, R * 0.26], N, 3, 'leafDark');
  const fr = s.fruit * (0.8 + 0.12 * s.stage);
  const oranges = Array.from({ length: fruit }, (_, q) => {
    const ring = q === 0 ? 0 : q < 5 ? 1 : 2;
    const a = q * 2.4 + 0.3, d = [0, 0.48, 0.62][ring] * R;
    const c: V3 = [Math.cos(a) * d, Math.sin(a) * d * 0.8, fr * [0.95, 0.5, 0.3][ring] + 0.02];
    return orange(c, fr * (0.92 + 0.12 * jitter(q + 5)), n, K, a + 1, q % 2 === 0);
  });
  // Leaves standing up out of it between the oranges, and lying out over the rim.
  const leaves = Array.from({ length: 6 + s.stage * 3 }, (_, q) => {
    const a = q * 1.7 + 0.9, root: V3 = [Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.6, 0.06];
    return leaf(root, [Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.7], [Math.cos(a), Math.sin(a), 0.4], R * (0.7 + 0.3 * jitter(q + 2)), R * 0.24, K, toneOf(q + 60, 0.3), 0.1);
  });
  return merge(bowl, rim, fill, ...oranges, ...leaves);
}

/** The straps the basket hangs from: over each shoulder from its rim, down the front and back under the arm; in the chest's frame. */
function strapsOf(s: Vanari): Mesh {
  const T = s.torso, top = T.z[T.z.length - 2], low = T.z[1] + 0.05 * (1 + s.stage), w = 0.035 + 0.015 * s.stage, lift = 0.03;
  return merge(...[1, -1].map((sd) => {
    const th = (x: number): number => (sd > 0 ? x : Math.PI - x);
    const path: V3[] = [
      onTorso(s, top - 0.12, th(-1.15), lift),
      onTorso(s, top + 0.02, th(-0.45), lift + 0.02),
      onTorso(s, top - 0.02, th(0.35), lift + 0.02),
      onTorso(s, lerp(top, low, 0.45), th(0.95), lift),
      onTorso(s, low, th(0.6), lift),
      onTorso(s, low - 0.02, th(-0.2), lift),
      onTorso(s, low + 0.04, th(-0.95), lift),
    ];
    return tube(path, w, 0.03, 4, (_r, j) => (j % 2 ? 'woodDark' : 'wood'), { start: false, end: false });
  }));
}

/** The leaves round its shoulders, in rows, on the chest: standing out a little and hanging down. */
function mantleOf(s: Vanari, K: number): Frond[] {
  const out: Frond[] = [];
  s.mantle.forEach(([count, L, hang, z, front], r) => {
    const R = ringAt(s, z);
    for (let q = 0; q < count; q++) {
      const id = r * 41 + q + s.stage * 300;
      const th = ((q + (r % 2) * 0.5) / count) * TAU + 0.2 * (jitter(id) - 0.5) - Math.PI / 2;
      // How far round to the front it is: nought at the back, one at the middle of the front. Open at the front below the top row.
      const toFront = 0.5 + 0.5 * Math.sin(th);
      if (toFront > 1 - (1 - front) * 0.5 && front < 1) continue;
      const pad = 0.04 + 0.03 * r;
      const n: V3 = unit([Math.cos(th) / R.w, Math.sin(th) / R.h, 0]);
      const root: V3 = [Math.cos(th) * (R.w + pad), R.y + Math.sin(th) * (R.h + pad), z];
      const len = L * (0.85 + 0.3 * jitter(id + 7)) * (1 - 0.25 * toFront * (r === 0 ? 0 : 1));
      const round = scale(unit(cross(n, [0, 0, 1])), q % 2 ? 1 : -1);
      const dir = unit(add(add(scale(n, 1 - hang), [0, 0, -hang - 0.1]), scale(round, 0.25 * jitter(id + 2))));
      const face = add(add(scale(n, 1), [0, 0, 0.2]), scale(round, 0.3));
      out.push({ mesh: leaf(root, dir, face, len, len * 0.36, K, toneOf(id, 0.2), 0.12), out: unit(add(n, [0, 0, 0.3])) });
    }
  });
  return out;
}

/* ---- the body ------------------------------------------------------------------------------- */

/** A paw: a dark palm, and on the bigger ones long fingers curled forward; along -z from the wrist. */
function pawOf(s: Vanari, n: number, fine: boolean): Mesh {
  const r = s.arm.paw, F = s.arm.finger;
  const palm = orbAlong([0, r * 0.15, -r * 0.8], [0, 0.25, -1], [r * 0.95, r * 0.7, r * 1.05], n, 4, 'pad');
  if (!F || !fine) return palm;
  const fingers = [-1, -0.33, 0.33, 1].map((u) => {
    const root: V3 = [u * r * 0.62, r * 0.3, -r * 1.5];
    const tip: V3 = add(root, [u * F * 0.25, F * 0.45, -F * 0.85]);
    return tube(curve(root, add(scale(add(root, tip), 0.5), [0, -r * 0.1, 0]), tip, 2), [r * 0.24, r * 0.2, r * 0.12], [r * 0.22, r * 0.18, r * 0.1], 4, 'pad');
  });
  return merge(palm, ...fingers);
}

/** A foot: long and dark, as a leaper's is, its sole on the ground at `drop` under the ankle, with long toes on the bigger ones. */
function footOf(s: Vanari, n: number, fine: boolean): Mesh {
  const L = s.leg.foot, drop = s.leg.len[2], w = s.leg.w[1] * 1.05;
  const sole = orbAlong([0, L * 0.32, -drop * 0.55], [0, 1, 0.1], [w, drop * 0.58, L * 0.55], n, 4, 'pad');
  if (!fine) return sole;
  const toes = [-1, -0.33, 0.33, 1].map((u) => {
    const root: V3 = [u * w * 0.7, L * 0.72, -drop * 0.7];
    return taper([root, add(root, [u * w * 0.2, L * 0.24, -drop * 0.2])], w * 0.24, w * 0.12, 4, 'pad');
  });
  return merge(sole, ...toes);
}

/** Arms and legs on the upright bones: an upper and a lower tube down each, a paw and a foot. */
function limbs(s: Vanari, n: number, fine: boolean): Piece[] {
  const out: Piece[] = [];
  const A = s.arm, L = s.leg;
  // The Vanari's arms are cream to the paw; the grown ones' forearms brown.
  const fore: Mat = s.stage === 0 ? 'mark' : 'coat', thigh: Mat = s.stage === 0 ? 'coatLight' : 'mark';
  for (const [k, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    out.push(
      { key: `arm${k}`, mesh: tube([[0, 0, 0.1], [0, 0, -A.len[0]]], [A.w[0], A.w[0] * 0.9], [A.w[0], A.w[0] * 0.9], n, 'mark', { seam: 'both' }), bone: `arm${k}`, bias: 0.03, after: ['body', 'straps'], front, convex: true },
      { key: `fore${k}`, mesh: tube([[0, 0, 0.04], [0, 0, -A.len[1]]], [A.w[1], A.w[1] * 0.85], [A.w[1], A.w[1] * 0.85], n, fore, { seam: 'both' }), bone: `elbow${k}`, bias: 0.035, after: ['body', 'straps'], front, convex: true },
      { key: `hand${k}`, mesh: pawOf(s, n, fine), bone: `hand${k}`, bias: 0.04, after: ['body', `fore${k}`], front },
    );
  }
  const foot = footOf(s, n, fine);
  for (const [key, sd] of [['ll', -1], ['lr', 1]] as Array<[string, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    out.push(
      // The thigh, a round haunch at its top tapering to the knee: the Vanari's brown, the grown ones' cream.
      { key: `${key}0`, mesh: merge(
        tube([[0, 0, 0.12], [0, 0, -L.len[0] * 0.5], [0, 0, -L.len[0]]], [L.w[0], L.w[0] * 0.95, L.w[1] * 1.05], [L.w[0], L.w[0] * 0.95, L.w[1] * 1.05], n, thigh, { seam: 'start' }),
        orbAlong([0, 0.02, -L.len[0] * 0.3], [0, 0, 1], [L.w[0] * 1.08, L.w[0] * 1.12, L.len[0] * 0.55 + L.w[0] * 0.3], n, 4, thigh),
      ), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front },
      { key: `${key}1`, mesh: tube([[0, 0, 0.04], [0, 0, -L.len[1]]], [L.w[1], L.w[1] * 0.85], [L.w[1], L.w[1] * 0.85], n, 'coat', { seam: 'both' }), bone: `${key}1`, bias: 0.015, after: 'body', front, convex: true },
      { key: `${key}2`, mesh: sd < 0 ? mirrored(foot) : foot, bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/** The torso: cream, with a brown saddle over its back and down its sides behind; in the chest's frame. */
function torsoOf(s: Vanari, n: number): Mesh {
  const T = s.torso;
  const m = tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n, 'mark', { up: [0, 1, 0] });
  return mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const R = ringAt(s, c[2]), back = (c[1] - R.y) / R.h, side = Math.abs(c[0]) / R.w;
    // Over the back: brown; the Vanari's coming further round its sides.
    return back < (s.stage === 0 ? -0.2 : -0.55) - 0.25 * (1 - side) && c[2] > T.z[0] + 0.05 && c[2] < T.z[T.z.length - 2] ? { ...f, m: 'coat' as Mat } : f;
  }));
}

/** The seat: brown behind and on the haunches, cream in front. */
function hipsOf(s: Vanari, n: number, k: number): Mesh {
  const m = orb([0, 0, 0], s.hips, n, k, 'coat');
  return mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return c[1] / s.hips[1] > 0.25 ? { ...f, m: 'mark' as Mat } : f;
  }));
}

/** Where the fruit it plucks or throws is in its right paw: out past the palm, between the fingers. */
const inPaw = (s: Vanari): V3 => [0, s.arm.paw * 0.55, -s.arm.paw * 1.2 - s.fruit * 0.85];

/**
 * The Vanari's own orange, held in both paws before its chest: carried on the left paw, where the two paws close on it standing;
 * and the way its chest faces, in the paw's frame, for which side of the body it is on.
 */
function heldOrange(s: Vanari, n: number, K: number): { mesh: Mesh; front: V3 } {
  const b = vanariBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
  const paw = (k: number): V3 => place(b[`hand${k}`], [0, s.arm.paw * 0.2, -s.arm.paw * 0.9]);
  const mid = scale(add(paw(0), paw(1)), 0.5), fwd: V3 = [b.chest.m[1], b.chest.m[4], b.chest.m[7]];
  const r = s.fruit * 1.45, at = add(add(mid, scale(fwd, r * 0.55)), [0, 0, r * 0.25]);
  const m = b.hand0.m, d = sub(at, b.hand0.t);
  // Into the paw's frame: its turn undone, which is its transpose; and the orange turned upright in the world as it stands.
  const local: V3 = [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
  const o = orange([0, 0, 0], r, n, K, 0.8);
  const upright = o.v.map((p): V3 => [m[0] * p[0] + m[3] * p[1] + m[6] * p[2], m[1] * p[0] + m[4] * p[1] + m[7] * p[2], m[2] * p[0] + m[5] * p[1] + m[8] * p[2]]);
  const front: V3 = [m[0] * fwd[0] + m[3] * fwd[1] + m[6] * fwd[2], m[1] * fwd[0] + m[4] * fwd[1] + m[7] * fwd[2], m[2] * fwd[0] + m[5] * fwd[1] + m[8] * fwd[2]];
  return { mesh: mesh(upright.map((p) => add(p, local)), o.f), front };
}

/** Whether the fruit is in its right paw this moment: plucked and on its way to the basket, or taken out of it and not yet thrown. */
function inHand(a: Anim): boolean {
  const act = a.act;
  if (act?.kind === 'work') return act.t > VANARI_PICK.pluck - 0.01 && act.t < VANARI_PICK.drop;
  if (act?.kind === 'strike') return act.t > VANARI_THROW.grab && act.t < VANARI_THROW.release;
  return false;
}

/** A stage's pieces. */
function vanariBuild(s: Vanari, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), K = lod ? 6 : 4, fine = lod > 0;
  const T = s.torso, H = s.head;
  const zMid = (T.z[0] + T.z[T.z.length - 1]) / 2, zHalf = (T.z[T.z.length - 1] - T.z[0]) / 2;
  const torsoSolid = { c: [0, T.y[2], zMid] as V3, r: [Math.max(...T.w) * 0.92, Math.max(...T.h) * 0.92, zHalf * 0.98] as V3 };
  const headSolid = { c: H.c, r: scale(H.r, 0.8) };
  const crest = crestOf(s, K);
  const [ear0, ear1] = earsOf(s, n);
  const frond = tailFrond(s, K);
  const last = s.tail.links - 1;
  const pieces: Piece[] = [
    { key: 'hips', mesh: hipsOf(s, n + 4, k + 2), bone: 'body', bias: 0 },
    { key: 'body', mesh: torsoOf(s, n + 4), bone: 'chest', bias: 0.005, breathes: { c: [0, 0, zMid], k: 0.04 } },
    // The face, while it is toward the viewer, over the basket on its back and the fruit heaped in it.
    { key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide: [headSolid], lines: false, after: 'basket', front: [0, 1, 0] },
    { key: 'ear0', mesh: ear0, bone: 'head', bias: 0.19, hide: [headSolid], lines: false },
    { key: 'ear1', mesh: ear1, bone: 'head', bias: 0.19, hide: [headSolid], lines: false },
    { key: 'crest', mesh: crest.mesh, bone: 'head', bias: 0.23, after: ['head', 'ear0', 'ear1'], hide: [headSolid], thin: true, bent: stirring(crest, s.crest[1], 0.3) },
    ...tailLinks(s, n).map((m, q): Piece => ({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.05 + q * 0.004, chain: 'tail' })),
    { key: 'frond', mesh: frond.mesh, bone: `tail${last}`, bias: -0.02, after: [`tail${last}`, `tail${last - 1}`], thin: true, bent: stirring(frond, s.tail.frond[1], 0.9) },
    ...plumeFronds(s, K).map((f, q): Piece => ({ key: `plume${q}`, mesh: f.mesh, bone: `tail${3 + q * 2}`, bias: -0.04, after: [`tail${3 + q * 2}`, `tail${2 + q * 2}`, `tail${4 + q * 2}`], thin: true, bent: stirring(f, s.tail.frond[1], 0.5 + q) })),
    { key: 'basket', mesh: basketOf(s, n, K), bone: 'basket', bias: 0.03, after: ['body', 'hips', 'mantle'], front: [0, -1, 0] },
    { key: 'straps', mesh: strapsOf(s), bone: 'chest', bias: 0.04, after: ['body'], hide: [torsoSolid] },
    { key: 'fruit', mesh: orange(inPaw(s), s.fruit, n, K, 0.4), bone: 'hand1', bias: 0.05, after: ['hand1', 'fore1', 'body'], shown: inHand },
    ...limbs(s, n, fine),
  ];
  if (s.mantle.length) {
    const mantle = fronds(mantleOf(s, K));
    pieces.push({ key: 'mantle', mesh: mantle.mesh, bone: 'chest', bias: 0.08, after: ['body', 'hips', 'straps', 'arm0', 'arm1'], hide: [torsoSolid], thin: true, bent: stirring(mantle, s.mantle[0][1], 0) });
  }
  if (s.stage === 0) {
    const held = heldOrange(s, n, K);
    pieces.push({ key: 'held', mesh: held.mesh, bone: 'hand0', bias: 0.05, after: ['body', 'fore0', 'fore1', 'hand0', 'hand1', 'straps'], front: held.front });
  }
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const LEAF: RGB = [104, 150, 58];
const LEAF_YOUNG: RGB = [158, 184, 72];
const ORANGE: RGB = [240, 134, 44];
const JUICE: RGB = [255, 178, 70];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** A leaf in the air, `len` long, turned `ang`: two-tone down its middle with a soft edge in a darker shade of itself. */
function flyingLeaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB, al: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.36, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.36, -len / 2, 0);
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = len * 0.07;
  g.strokeStyle = css(mix(c, [40, 50, 30], 0.3), al);
  g.stroke();
  g.restore();
}

/** An orange in the air: a round ball with a dark rim, a glint and a leaf on it, turning. */
function flyingOrange(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number): void {
  g.fillStyle = css(mix(ORANGE, [90, 40, 20], 0.5), 1);
  g.beginPath();
  g.arc(x, y, r * 1.14, 0, TAU);
  g.fill();
  g.fillStyle = css(ORANGE, 1);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = css([255, 236, 200], 0.9);
  g.beginPath();
  g.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU);
  g.fill();
  flyingLeaf(g, x + Math.cos(ang) * r, y + Math.sin(ang) * r, r * 1.2, ang, LEAF, 1);
}

/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/** The throw: the orange in the air from its paw to what it is thrown at, and bursting there in a splash of juice and peel. */
function thrown(g: CanvasRenderingContext2D, view: View, s: Vanari, from: V3, mid: V3, t: number, front: boolean): void {
  const T = VANARI_THROW, to: V3 = [0, from[1] + 2.4 + 0.6 * s.stage, 0.6 + 0.3 * s.stage];
  if (t >= T.release && t < T.hit) {
    const u = (t - T.release) / (T.hit - T.release);
    const p: V3 = [lerp(from[0], to[0], u), lerp(from[1], to[1], u), lerp(from[2], to[2], u) + 0.9 * Math.sin(Math.PI * u)];
    if (nearSide(p, mid, view) !== front) return;
    const [x, y] = onScreen(view, p);
    flyingOrange(g, x, y, s.fruit * 1.5, u * 9);
    return;
  }
  if (t < T.hit || !front) return;
  // The burst: drops of juice and bits of peel flung out and falling, fading.
  const since = (t - T.hit) / (1 - T.hit), fade = 1 - smooth(since);
  const [cx, cy] = onScreen(view, to);
  for (let q = 0; q < 9; q++) {
    const a = (q / 9) * TAU + 0.4 * jitter(q), out = (0.7 + 0.8 * jitter(q + 3)) * (0.5 + 1.4 * since) * (1 + 0.2 * s.stage);
    const x = cx + Math.cos(a) * out, y = cy + Math.sin(a) * out * 0.7 + 1.4 * since * since;
    g.fillStyle = css(q % 3 ? JUICE : ORANGE, fade);
    g.beginPath();
    g.arc(x, y, (q % 3 ? 0.14 : 0.22) * (1 + 0.3 * s.stage) * (1 - 0.4 * since), 0, TAU);
    g.fill();
  }
  g.fillStyle = css(JUICE, 0.5 * fade * (1 - since));
  g.beginPath();
  g.ellipse(cx, cy, 0.7 + 0.8 * since, 0.45 + 0.5 * since, 0, 0, TAU);
  g.fill();
}

/** Where something let fall from `p` drifts to `s` seconds on, fluttering down. */
const drifting = (p: V3, s: number, id: number): V3 => [p[0] + 0.5 * Math.sin(s * 5 + id), p[1] + 0.3 * s * (jitter(id) - 0.3), Math.max(0.02, p[2] - 1.6 * s)];

/** The pluck: two leaves shaken loose from up where the paw is, fluttering down. */
function pickLeaves(g: CanvasRenderingContext2D, view: View, s: Vanari, at: V3, mid: V3, t: number, front: boolean): void {
  const since = (t - VANARI_PICK.pluck) * ACT_SECS.work;
  if (since <= 0 || since > 0.9) return;
  const fade = 1 - smooth(since / 0.9), big = 0.34 + 0.08 * s.stage;
  for (let q = 0; q < 3; q++) {
    const p = drifting(add(at, [q === 1 ? 0.15 : -0.1, 0.05 * q, 0.15]), since, q * 7 + 3);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    flyingLeaf(g, x, y, big, q * 2 + since * 6 * (q ? 1 : -1), q ? LEAF_YOUNG : LEAF, fade);
  }
}

/** Evolving: leaves going up round it in a spiral, wider at the foot and gathering in as they rise. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Vanari, b: Bones, t: number, front: boolean): void {
  const mid: V3 = [0, 0, b.body.t[2]];
  const fade = ramp(t, 0.05, 0.2) * (1 - ramp(t, 0.75, 1));
  const tall = (s.leg.len[0] + s.leg.len[1] + s.torso.z[s.torso.z.length - 1]) * 2.2, wide = s.hips[0] * 2.2;
  for (let q = 0; q < 14; q++) {
    const rise = frac(t * 1.2 + q / 14), ang = (q / 14) * TAU * 3 + t * TAU * 1.4, r = wide * (1 - 0.45 * rise);
    const p: V3 = [Math.cos(ang) * r, Math.sin(ang) * r, rise * tall];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    flyingLeaf(g, x, y, 0.4 + 0.1 * s.stage, ang * 1.5 + rise * 4, q % 3 ? LEAF : LEAF_YOUNG, fade * Math.sin(rise * Math.PI));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it throws, picks and evolves. */
function vanariKind(s: Vanari): Kind {
  const bones = vanariBones(s);
  // Where its paw is as it lets the orange go, and as the fruit comes off the tree, at a go played once and at one of a run of
  // them. Worked out once, standing.
  const still: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
  const paw = (a: Anim): V3 => place(bones(a).hand1, inPaw(s));
  const releaseAt = paw({ ...still, act: { kind: 'strike', t: VANARI_THROW.release } });
  const pluckAt = [0, 1].map((graze) => paw({ ...still, graze, act: { kind: 'work', t: VANARI_PICK.pluck } }));
  return {
    bones,
    build: (lod) => vanariBuild(s, lod),
    // The variant's coat is the chocolate of its mask, its back, its limbs and its tail, and its markings the cream of the rest
    // of it; its dark eyes and nose, its leaves, its wicker and its oranges its own.
    palette: (coat, mark) => {
      const brown = mix(coat, [255, 246, 236], 0.16), cream = mix(mark, [255, 252, 244], 0.15);
      return coatPalette(coat, mark, {
        coat: brown,
        coatDark: mix(coat, [30, 20, 18], 0.25),
        coatLight: mix(brown, cream, 0.35),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 255, 250], 0.4),
        inner: mix(cream, [226, 172, 142], 0.35),
        feather: cream,
        featherDark: brown,
        lid: mix(coat, [30, 20, 18], 0.4),
        nose: [52, 34, 30],
        eye: [36, 20, 16],
        glint: [255, 253, 246],
        crystal: [128, 78, 44],
        crystalDark: [84, 48, 28],
        pad: mix(coat, [30, 20, 18], 0.22),
        leaf: LEAF,
        stem: [84, 128, 46],
        leafDark: [70, 108, 42],
        moss: LEAF_YOUNG,
        bark: [112, 82, 56],
        wood: [190, 140, 84],
        woodDark: [140, 96, 56],
        ember: ORANGE,
        flame: [200, 88, 28],
      });
    },
    shadow: [s.hips[1] * 1.6, s.hips[0] * 1.4],
    stride: 1.3,
    size: s.size,
    leaps: [true, true],
    acts: ['strike', 'work'],
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') thrown(g, view, s, releaseAt, b.body.t, act.t, front);
      else if (act.kind === 'work') pickLeaves(g, view, s, pluckAt[a.graze > 0.5 ? 1 : 0], b.body.t, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const VANARI = vanariKind(VANARI_LOOK);
export const ORCHIBELLE = vanariKind(ORCHIBELLE_LOOK);
export const ARBOANARI = vanariKind(ARBOANARI_LOOK);
