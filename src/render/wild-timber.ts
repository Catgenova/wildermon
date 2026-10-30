import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  pastel, scale, shadowOf, smile, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The timber line: the Logkit, a small chubby rodent on all fours, its
 * russet coat shingled all over with little plates of bark and wood, layered
 * like scales and flecked with moss, cream on its muzzle, throat and belly,
 * dark eyes and whiskers, and a fan of wooden planks for a tail; which grows
 * into the Sawquill, bigger, crouched forward on its hind legs, a crest of
 * wooden quills and bigger plates over its back, shoulders and arms, its
 * forearms ending in round log cross-sections edged with saw teeth held out
 * before it; and then the Timberback, large and upright, a barrel of a body
 * with broad shoulders and a bundle of logs and cut rounds on its back
 * sprouting oak, long arms, a great toothed log-round blade across its chest
 * and another on its other arm. The species is still `rippa`
 * underneath, as saves and the database know it: it saws logs into planks.
 *
 * Each is its variant's coat in its fur and the bark of its quills, and its
 * markings in the cream of its face, chest and belly; the planks, the log
 * rings, the steel of the teeth, the moss and the oak are the same on every
 * variant. Built the way the maple line is (`./wild-maple`): one set of
 * functions from a description of the stage (`Timb`), each leg bent to put
 * its foot where it is to be and each arm to put its paw or its blade where
 * it is wanted. The Logkit is that same body with its chest pitched forward
 * over its arms, so they are its fore legs and its head is carried level out
 * in front; it trots, the fore foot on one side with the hind on the other.
 * The others waddle upright on their hind legs, rolling over the foot that
 * is down, their arms swinging.
 *
 * The tail is a fan of planks out from one root on the rump, a row upright
 * and a row splayed out to either side over its upper part, so it is a fan
 * of boards from the side and spreads out behind it from in front or behind.
 * The blades are on bones of their own at the ends of the forearms, faced out
 * to the side and turned in a little at the front, turning about their hubs.
 *
 * At its task, at a log laid lengthwise on a sawbuck before it (`logOf`):
 * the Logkit puts its fore paws up on the log and rasps along its edge with
 * its teeth; the Sawquill and the Timberback bring the blade of the right
 * arm down into the log and drive it along it, spinning; and a slab falls
 * away off its side onto the planks on the ground, in a puff of sawdust
 * (`TIMBER_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Timb {
  stage: 0 | 1 | 2;
  /** On all fours: its arms are its fore legs. */
  four: boolean;
  /** The hip on the right in the body's frame; thigh, shin and the ankle's height over the sole; how thick each is; the foot's length and width; how far out each foot stands and how far ahead of the hip. */
  leg: { at: V3; len: [number, number, number]; w: [number, number]; foot: [number, number]; stance: number; ahead: number };
  /** How high the hips are carried standing. */
  high: number;
  hips: { c: V3; r: V3 };
  /** The chest's joint on the body and how far forward of upright it is carried. */
  chest: { at: V3; lean: number };
  /** The torso's rings in the chest's frame, bottom to top: how high, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** The shoulder on the right in the chest's frame; upper arm and forearm; how thick each; the paw's size. */
  shoulder: V3;
  arm: [number, number];
  armW: [number, number];
  hand: number;
  /** On all fours, where each fore foot stands: how far out and how far ahead of the hips. */
  fore: [number, number];
  neck: { at: V3; len: number; w: number };
  head: { r: V3; up: number; pitch: number };
  snout: { r: V3; out: number };
  eye: { dir: V3; size: number };
  ear: { len: number; w: number; dir: V3 };
  /** The quills on its crown: how many, how long and how wide, and how far up from lying flat. */
  crest: { count: number; len: number; w: number; up: number };
  /** Its coat of quill plates: a plate's length and half-width, the top and bottom rows' heights in the chest's frame, how far round from its spine either side they go, and how far they stand out from lying flat along its spine (radians). */
  quills: { len: number; w: number; top: number; low: number; spread: number; raise: number };
  /** Rows of plates down each arm and each haunch. */
  armQuills: number;
  thighQuills: number;
  /** How much of it the moss is on. */
  moss: number;
  /**
   * The fan of planks: its root on the rump in the body's frame, how long its planks are, how far its axis leans back from upright
   * and how far its planks open out from it (degrees), how many round it, each one's half-width at its root and at its end, how far
   * it curls forward, how thick.
   */
  tail: { at: V3; len: number; lean: number; cone: number; planks: number; w: [number, number]; curl: number; thick: number };
  /**
   * The blades: the radius of the right one's log round, the left's against it, how thick, how many teeth (nought for none); each
   * one's hub held at rest, left then right, in the body's frame from the chest's joint; and how far each is turned in at its
   * front (degrees).
   */
  blade: { r: number; left: number; thick: number; teeth: number; hold: [V3, V3]; toe: [number, number] };
  /** The logs on its back, each its middle and its way along in the chest's frame, its radius and length. */
  logs: ReadonlyArray<{ at: V3; dir: V3; r: number; len: number }>;
  /** Sprigs of oak out of the bundle, each its root and its way in the chest's frame and its length. */
  sprigs: ReadonlyArray<{ at: V3; dir: V3; len: number }>;
  /** The log it works, in the world: its middle, its radius and its length, along the way it faces. */
  work: { at: V3; r: number; len: number };
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it sweeps, as a share of the leg's reach; how high it is lifted. */
    duty: [number, number]; swing: [number, number]; lift: number;
    /** How far it rolls over the foot that is down (degrees), and how far its arms swing. */
    waddle: number; arms: number;
  };
  size: number;
}

/** A fan of planks `len` long, rooted at `at`, its axis leant `lean` degrees back and its planks opening `cone` degrees out of it. */
const fanOf = (len: number, at: V3, lean: number, cone: number, planks: number): Timb['tail'] => ({
  at, len, lean, cone, planks, w: [len * 0.03, len * 0.06], curl: 0.2, thick: len * 0.035,
});

/** A Logkit: small and chubby on four short legs, a big round head, little plates along its head and back, and its fan of planks. */
const LOGKIT_LOOK: Timb = {
  stage: 0,
  four: true,
  leg: { at: [0.19, -0.24, -0.08], len: [0.13, 0.12, 0.04], w: [0.16, 0.085], foot: [0.24, 0.09], stance: 0.21, ahead: -0.2 },
  high: 0.32,
  hips: { c: [0, -0.16, 0.02], r: [0.34, 0.38, 0.32] },
  chest: { at: [0, -0.02, 0.05], lean: 78 },
  torso: { z: [-0.12, 0.12, 0.34, 0.5], y: [0.02, 0.03, 0.02, 0], w: [0.33, 0.33, 0.29, 0.21], h: [0.3, 0.31, 0.27, 0.19] },
  shoulder: [0.18, 0.2, 0.36],
  arm: [0.13, 0.12], armW: [0.095, 0.08], hand: 0.065,
  fore: [0.19, 0.38],
  neck: { at: [0, -0.04, 0.48], len: 0.04, w: 0.19 },
  head: { r: [0.4, 0.37, 0.36], up: 0.24, pitch: 2 },
  snout: { r: [0.15, 0.13, 0.11], out: 0.78 },
  eye: { dir: [0.5, 0.8, 0.12], size: 0.074 },
  ear: { len: 0.16, w: 0.13, dir: [0.6, -0.15, 0.78] },
  crest: { count: 7, len: 0.27, w: 0.07, up: 0.55 },
  quills: { len: 0.16, w: 0.06, top: 0.5, low: -0.5, spread: 2.0, raise: 0.6 },
  armQuills: 0,
  thighQuills: 0,
  moss: 0.6,
  tail: fanOf(0.8, [0, -0.44, 0.06], 30, 36, 11),
  blade: { r: 0, left: 0, thick: 0, teeth: 0, hold: [[0, 0, 0], [0, 0, 0]], toe: [0, 0] },
  logs: [],
  sprigs: [],
  work: { at: [0.06, 0.9, 0.27], r: 0.13, len: 0.76 },
  gait: { duty: [0.56, 0.42], swing: [0.42, 0.55], lift: 0.4, waddle: 0, arms: 0 },
  size: 4.2,
};

/** A Sawquill: up on its hind legs in a crouch, a crest of quills and plates down its back, a toothed log round at the end of each forearm. */
const SAWQUILL_LOOK: Timb = {
  stage: 1,
  four: false,
  leg: { at: [0.33, -0.04, -0.16], len: [0.34, 0.32, 0.06], w: [0.3, 0.15], foot: [0.42, 0.16], stance: 0.54, ahead: 0.2 },
  high: 0.46,
  hips: { c: [0, -0.04, 0.06], r: [0.56, 0.54, 0.46] },
  chest: { at: [0, 0.04, 0.12], lean: 48 },
  torso: { z: [-0.1, 0.24, 0.52, 0.78, 0.9], y: [0.04, 0.08, 0.07, 0.03, 0], w: [0.54, 0.52, 0.45, 0.33, 0.23], h: [0.46, 0.46, 0.4, 0.3, 0.21] },
  shoulder: [0.38, 0.05, 0.68],
  arm: [0.32, 0.3], armW: [0.16, 0.14], hand: 0.1,
  fore: [0, 0],
  neck: { at: [0, 0.05, 0.86], len: 0.05, w: 0.23 },
  head: { r: [0.4, 0.46, 0.38], up: 0.22, pitch: 22 },
  snout: { r: [0.17, 0.2, 0.13], out: 0.82 },
  eye: { dir: [0.52, 0.8, 0.22], size: 0.062 },
  ear: { len: 0.17, w: 0.14, dir: [0.6, -0.2, 0.78] },
  crest: { count: 9, len: 0.42, w: 0.1, up: 0.8 },
  quills: { len: 0.28, w: 0.1, top: 0.9, low: -0.5, spread: 2.1, raise: 0.9 },
  armQuills: 3,
  thighQuills: 3,
  moss: 0.8,
  tail: fanOf(1.04, [0, -0.5, -0.06], 42, 36, 11),
  blade: { r: 0.34, left: 1, thick: 0.07, teeth: 16, hold: [[-0.46, 0.62, 0.3], [0.46, 0.62, 0.3]], toe: [40, 40] },
  logs: [],
  sprigs: [],
  work: { at: [0.56, 1.16, 0.6], r: 0.2, len: 1.1 },
  gait: { duty: [0.6, 0.48], swing: [0.32, 0.42], lift: 0.22, waddle: 7, arms: 0.18 },
  size: 5.1,
};

/** A Timberback: large and upright, a barrel of a body, a bundle of logs and rounds on its back sprouting oak, long arms and two great blades. */
const TIMBERBACK_LOOK: Timb = {
  stage: 2,
  four: false,
  leg: { at: [0.5, 0.0, -0.3], len: [0.42, 0.4, 0.08], w: [0.58, 0.33], foot: [0.66, 0.29], stance: 0.7, ahead: 0.12 },
  high: 0.84,
  hips: { c: [0, -0.04, 0.06], r: [0.94, 0.84, 0.72] },
  chest: { at: [0, 0, 0.24], lean: 14 },
  torso: { z: [-0.14, 0.34, 0.78, 1.12, 1.28], y: [0.05, 0.11, 0.1, 0.04, 0], w: [0.96, 1.0, 0.98, 0.84, 0.46], h: [0.8, 0.84, 0.76, 0.58, 0.36] },
  shoulder: [0.9, 0.02, 1.02],
  arm: [0.58, 0.54], armW: [0.3, 0.27], hand: 0.17,
  fore: [0, 0],
  neck: { at: [0, 0.07, 1.24], len: 0.07, w: 0.38 },
  head: { r: [0.55, 0.63, 0.52], up: 0.32, pitch: 18 },
  snout: { r: [0.24, 0.29, 0.18], out: 0.82 },
  eye: { dir: [0.54, 0.78, 0.24], size: 0.064 },
  ear: { len: 0.22, w: 0.18, dir: [0.6, -0.22, 0.78] },
  crest: { count: 10, len: 0.56, w: 0.13, up: 0.75 },
  quills: { len: 0.36, w: 0.13, top: 1.24, low: -0.5, spread: 2.15, raise: 0.6 },
  armQuills: 4,
  thighQuills: 3,
  moss: 1,
  tail: fanOf(1.24, [0, -0.78, -0.1], 46, 36, 12),
  blade: { r: 0.74, left: 0.72, thick: 0.13, teeth: 22, hold: [[-1.02, 0.28, 0.42], [0.52, 0.8, 0.56]], toe: [20, 62] },
  logs: [
    { at: [0, -0.98, 0.98], dir: [1, 0, 0.06], r: 0.27, len: 1.75 },
    { at: [0.08, -1.08, 0.5], dir: [1, 0.05, -0.1], r: 0.25, len: 1.5 },
    { at: [-0.32, -0.98, 1.36], dir: [1, 0.08, 0.32], r: 0.2, len: 1.0 },
    { at: [0.5, -0.92, 1.3], dir: [0.15, -0.25, 1], r: 0.24, len: 0.26 },
    { at: [-0.74, -0.92, 0.62], dir: [-1, -0.2, 0.1], r: 0.3, len: 0.24 },
  ],
  sprigs: [
    { at: [-0.4, -1.1, 1.5], dir: [-0.3, -0.35, 1], len: 0.6 },
    { at: [0.42, -1.16, 1.12], dir: [0.5, -0.5, 0.85], len: 0.52 },
    { at: [-0.72, -1.14, 0.84], dir: [-0.85, -0.45, 0.45], len: 0.46 },
  ],
  work: { at: [0.9, 1.62, 0.84], r: 0.3, len: 1.6 },
  gait: { duty: [0.62, 0.5], swing: [0.3, 0.4], lift: 0.2, waddle: 6, arms: 0.22 },
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
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

/** A frame standing along `up` with its front along `fwd`: across, forward and up. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  if (len3(Y) < 1e-4) Y = [0, 1, 0];
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };

/** An egg with its axes along a frame. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
}
const UPRIGHT: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Each face's material chosen from where its middle is. */
function painted(m: Mesh, f: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((face) => {
    const c = scale(face.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    return { ...face, m: f(c) };
  }));
}

/** Each face wound so it faces along its `want`, whichever way round it was listed. */
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
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}

/** Where the egg `(c, r)` is cut by the level `z`: its half across and half deep there. */
function eggAt(c: V3, r: V3, z: number): [number, number] {
  const f = Math.sqrt(Math.max(0.04, 1 - ((z - c[2]) / r[2]) ** 2));
  return [r[0] * f, r[1] * f];
}
function torsoAt(s: Timb, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/** The hips' egg in the chest's frame (the chest being turned from the body only about its joint, at rest). */
function hipsInChest(s: Timb): { c: V3; r: V3 } {
  const a = -s.chest.lean * (Math.PI / 180), c = Math.cos(a), sn = Math.sin(a);
  const d = sub(s.hips.c, s.chest.at);
  // Into the chest's frame: the inverse of its pitch.
  return { c: [d[0], c * d[1] + sn * d[2], -sn * d[1] + c * d[2]], r: s.four ? [s.hips.r[0], s.hips.r[2], s.hips.r[1]] : s.hips.r };
}
/**
 * A point on the body's skin at height `z` in the chest's frame, `a` radians round from its right side (a quarter turn is its
 * front, its belly), lifted `out` off it: on the torso, or on the hips where they come further out.
 */
function onBody(s: Timb, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z), H = hipsInChest(s), [hx, hy] = eggAt(H.c, H.r, z);
  const tp: V3 = [Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z];
  const hp: V3 = [Math.cos(a) * hx, H.c[1] + Math.sin(a) * hy, z];
  const p = z < s.torso.z[0] || len3([hp[0], hp[1], 0]) > len3([tp[0], tp[1], 0]) ? hp : tp;
  return add(p, scale(unit([Math.cos(a), Math.sin(a), 0]), out));
}
const onEggDir = (c: V3, r: V3, p: V3): V3 => [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];


/** A flat round face along `n`: the end of a log, a blade's face. */
function capOf(c: V3, n: V3, r: number, sides: number, m: Mat, up?: V3): Mesh {
  const d = disc(c, n, r, r, sides, m, { up });
  return mesh(d.v, woundTo(d.v, [{ i: d.v.map((_, k) => k), m }], [unit(n)]));
}
/** The rings of a cut end, painted on it: pale and darker in turn, a dark heart. */
function ringsOn(c: V3, n: V3, r: number, fine: boolean, id: number): Mesh {
  const ks: Array<[number, Mat]> = fine
    ? [[0.82, 'shellDark'], [0.75, 'shell'], [0.58, 'shellDark'], [0.52, 'shell'], [0.33, 'shellDark'], [0.27, 'shell'], [0.08, 'shellDark']]
    : [[0.7, 'shellDark'], [0.6, 'shell'], [0.28, 'shellDark'], [0.2, 'shell']];
  const d = unit(n), side = unit(cross(Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], d));
  return paint(ks.map(([k, m], q) => {
    // Each ring a little off the middle of the last, as a tree's are.
    const off = scale(side, r * 0.04 * (1 - k) * (jitter(id + q) - 0.3));
    return disc(add(add(c, off), scale(d, 0.003 * (q + 1))), d, r * k, r * k * (0.94 + 0.08 * jitter(id + q + 7)), fine ? 14 : 9, m);
  }));
}

/* ---- a quill plate --------------------------------------------------------------------- */

type Lobes = ReadonlyArray<readonly [number, number]>;
/** Half a quill plate's outline from its root to its tip: a split shingle, broad, then cut to a point. */
const QUILL: Lobes = [[0.8, 0.02], [1, 0.4], [0.94, 0.66], [0.4, 0.9]];
const QUILL_FAR: Lobes = [[1, 0.2], [0.6, 0.78]];
/** An oak leaf's half outline: rounded lobes. */
const OAK: Lobes = [[0.3, 0.04], [0.62, 0.14], [0.44, 0.24], [0.86, 0.38], [0.56, 0.48], [0.92, 0.62], [0.52, 0.72], [0.64, 0.84], [0.26, 0.92]];
const OAK_FAR: Lobes = [[0.6, 0.2], [0.9, 0.5], [0.5, 0.8]];

/** The faces of a plate: bark, wood, mossed. */
const PLATES: ReadonlyArray<readonly [Mat, Mat]> = [['coat', 'coatDark'], ['coatLight', 'coat'], ['coat', 'coatDark'], ['coatDark', 'bark'], ['grip', 'woodDark'], ['moss', 'water']];
const plateOf = (id: number, moss: number): readonly [Mat, Mat] => {
  const j = jitter(id * 3.3 + 0.7);
  return j < 0.06 * moss ? PLATES[5] : PLATES[Math.floor(jitter(id + 9.1) * 5)];
};

/**
 * A plate from `root` along `dir`, `len` long and `w` across each side of its rib, its face turned along `face`: two halves either
 * side of the rib in two shades, folded into a shallow ridge and arched. Laid on the skin (`flat`), only its face; standing free,
 * its back too, in bark.
 */
function plate(root: V3, dir: V3, face: V3, len: number, w: number, mats: readonly [Mat, Mat], o: { lobes?: Lobes; fold?: number; arch?: number; flat?: boolean; back?: Mat } = {}): Mesh {
  const d = unit(dir), n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n));
  const lobes = o.lobes ?? QUILL, fold = o.fold ?? 0.35, arch = o.arch ?? 0.08;
  const at = (x: number, y: number): V3 => add(add(add(root, scale(d, y * len)), scale(side, x * w)), scale(n, fold * (1 - Math.abs(x)) * w + arch * len * Math.sin(Math.PI * y)));
  const right = [at(0, 0), ...lobes.map(([x, y]) => at(x, y)), at(0, 1)];
  const left = [at(0, 1), ...[...lobes].reverse().map(([x, y]) => at(-x, y)), at(0, 0)];
  const R = right.length, L = left.length;
  const v: V3[] = o.flat ? [...right, ...left] : [...right, ...left, ...right, ...left];
  const f: Face[] = [{ i: Array.from({ length: R }, (_, k) => k), m: mats[0] }, { i: Array.from({ length: L }, (_, k) => R + k), m: mats[1] }];
  const want: V3[] = [n, n];
  if (!o.flat) {
    const b = o.back ?? 'bark';
    f.push({ i: Array.from({ length: R }, (_, k) => R + L + k), m: b }, { i: Array.from({ length: L }, (_, k) => 2 * R + L + k), m: b });
    want.push(scale(n, -1), scale(n, -1));
  }
  return mesh(v, woundTo(v, f, want));
}

/** A patch of moss on a plate laid by `plate`, part way up its rib, for some plates: how many as `moss` says. */
function mossOn(root: V3, dir: V3, face: V3, len: number, w: number, id: number, moss: number, fold: number, arch: number): Mesh | null {
  if (jitter(id * 5.7 + 2.3) > 0.16 * moss) return null;
  const d = unit(dir), n = unit(sub(face, scale(d, dot(face, d)))), u = 0.45 + 0.2 * jitter(id + 4);
  const at = add(add(root, scale(d, len * u)), scale(n, fold * w * 0.8 + arch * len * Math.sin(Math.PI * u) + 0.006));
  return paint([disc(at, n, w * (0.55 + 0.25 * jitter(id + 5)), len * (0.2 + 0.1 * jitter(id + 6)), 6, jitter(id + 7) < 0.5 ? 'moss' : 'water', { up: d, spin: 0.3 })]);
}

/* ---- the tail -------------------------------------------------------------------------- */

/** The tail curled: each corner turned about the root by as much more as it is further along (`along`, nought to one). */
function curled(along: readonly number[], P: (a: Anim) => Plan): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const [, , flick, fling] = P(a).tail;
    if (Math.abs(flick) < 0.05 && Math.abs(fling) < 0.05) return v as V3[];
    const D = Math.PI / 180;
    return v.map((p, i) => {
      const u = along[i] * along[i];
      const af = -flick * u * D, as = fling * u * D;
      const cf = Math.cos(af), sf = Math.sin(af), cs = Math.cos(as), ss = Math.sin(as);
      let [x, y, z] = p;
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      [x, y] = [x * cs - y * ss, x * ss + y * cs];
      return [x, y, z] as V3;
    });
  };
}

/**
 * The fan, in the tail's frame: planks out from one root like the petals of a cone, opening up and back from its rump, laid round
 * all but the side toward its back, each a board narrow at its root and broad at its end, faced outward, its end rounded; those
 * at the back of the cone longest so its outline is round; the whole of it curling forward toward the tips, over its back, as a
 * squirrel's tail does. An inner ring of shorter planks fills its middle. From the side it is a fan of boards, from behind a
 * round fan of them too. Their faces in two woods with a line of grain, their edges and ends dark to bark; a tuft of the coat
 * over the root where they gather. `along` is how far out along its plank each corner is.
 */
function fanMesh(s: Timb, n: number, k: number, fine: boolean): { mesh: Mesh; along: number[] } {
  const T = s.tail, D = Math.PI / 180;
  // Along a plank, and how wide it is there against its full width: its round end last.
  const us = fine ? [0, 0.32, 0.64, 0.91, 1, 1.05, 1.085] : [0, 0.62, 1, 1.07], ws = fine ? [1, 1, 1, 1, 1, 0.72, 0.3] : [1, 1, 1, 0.45], segs = us.length - 1;
  const out: Mesh[] = [], along: number[] = [];
  // Its axis, up and back; across it to the right; and back from it, away from the body.
  const A: V3 = [0, -Math.sin(T.lean * D), Math.cos(T.lean * D)], X: V3 = [1, 0, 0], Bk = unit(cross(X, A));
  const open = 2.25;
  const rings: Array<[number, number, number]> = [[T.cone * D, fine ? T.planks : Math.max(6, Math.round(T.planks * 0.7)), 1], [T.cone * D * 0.4, fine ? Math.round(T.planks * 0.55) : 3, 0.82]];
  rings.forEach(([cone, P, short], ring) => {
    for (let j = 0; j < P; j++) {
      const id = j * 7 + s.stage * 31 + ring * 101, f = P > 1 ? j / (P - 1) : 0.5;
      const th = lerp(-open, open, f) + (ring ? 0.2 : 0);
      const r: V3 = add(scale(Bk, Math.cos(th)), scale(X, Math.sin(th)));
      const d = unit(add(scale(A, Math.cos(cone)), scale(r, Math.sin(cone))));
      const a = unit(cross(r, d)), nrm = unit(cross(a, d));
      const L = T.len * short * (0.76 + 0.24 * Math.cos(th * 0.6)) * (0.96 + 0.08 * jitter(id + 1)), r0 = T.w[0] * 0.5;
      const W1 = (2 * open * T.len * Math.sin(cone) * short) / P * 0.62 + T.w[1] * 0.3;
      const tone: Mat = (j + ring) % 3 === 1 ? 'grip' : 'wood', tk = T.thick;
      const wid = (u: number): number => lerp(T.w[0], W1 * (0.92 + 0.16 * jitter(id + 2)), Math.min(1, u) ** 0.75);
      // Curled forward, over its back, the more the further out.
      const mid = (u: number): V3 => add(add(scale(d, r0 + u * L), scale(Bk, -T.curl * L * u * u)), scale(nrm, (j % 2) * tk * 0.6));
      const v: V3[] = [], fc: Face[] = [], want: V3[] = [];
      for (let q = 0; q <= segs; q++) {
        const u = us[q], hw = wid(u) * ws[q], c = mid(u);
        for (const [sa, sn] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) v.push(add(add(c, scale(a, sa * hw)), scale(nrm, sn * tk * 0.5)));
      }
      for (let q = 0; q < segs; q++) {
        const b = q * 4, c = b + 4, m: Mat = us[q] >= 0.9 ? 'woodDark' : tone, edge: Mat = us[q] >= 0.9 ? 'bark' : 'woodDark';
        // Its two faces, its two edges.
        fc.push({ i: [b + 3, b + 2, c + 2, c + 3], m }, { i: [b, b + 1, c + 1, c], m });
        fc.push({ i: [b + 1, b + 2, c + 2, c + 1], m: edge }, { i: [b, b + 3, c + 3, c], m: edge });
        const t = unit(sub(mid(us[q + 1]), mid(us[q]))), side = unit(sub(a, scale(t, dot(a, t)))), out0 = unit(sub(nrm, scale(t, dot(nrm, t))));
        want.push(out0, scale(out0, -1), side, scale(side, -1));
      }
      const E = segs * 4;
      fc.push({ i: [E, E + 1, E + 2, E + 3], m: 'bark' }, { i: [0, 1, 2, 3], m: 'woodDark' });
      want.push(unit(sub(mid(us[segs]), mid(us[segs - 1]))), scale(d, -1));
      const board = mesh(v, woundTo(v, fc, want));
      out.push(board);
      for (let q = 0; q < board.v.length; q++) along.push(Math.min(1, us[Math.floor(q / 4)]));
      if (fine && !ring) {
        // A line of grain down its outer face, a little off its middle.
        const g = (jitter(id + 8) - 0.5) * 0.5, pts: V3[] = [], back: V3[] = [];
        for (let q = 0; q <= 3; q++) {
          const u = lerp(0.2, 0.8, q / 3), hw = wid(u), wob = Math.sin(q * 2.1 + id) * 0.08;
          const c = add(mid(u), scale(nrm, tk * 0.5 + 0.002));
          pts.push(add(c, scale(a, hw * (g + wob - 0.04))));
          back.push(add(c, scale(a, hw * (g + wob + 0.04))));
        }
        const gv = [...pts, ...back.reverse()];
        out.push(mesh(gv, woundTo(gv, [{ i: gv.map((_, q) => q), m: tone === 'wood' ? 'grip' : 'woodDark', decal: true }], [nrm])));
        for (let q = 0; q < gv.length; q++) along.push(0.5);
      }
    }
  });
  // The tuft of fur over the root.
  const tuft = orb([0, -T.w[0] * 0.5, T.w[0] * 1.2], [T.w[0] * 3.2, T.w[0] * 3.2, T.w[0] * 3.4], n, k, 'coat');
  out.push(tuft);
  for (let q = 0; q < tuft.v.length; q++) along.push(0);
  return { mesh: merge(...out), along };
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Logkit's bite, the Sawquill's and the Timberback's blade brought down. */
export const TIMBER_HITS: readonly number[] = [0.5, 0.52, 0.56];
/**
 * A go at its task, as shares of it. The Logkit's bites along the log (`bites`); the blade into the log (`into`) and driven along it
 * to `through`; the slab off the log's side tipping at `split` and landing on the planks at `land`.
 */
export const TIMBER_WORK = {
  bites: [0.2, 0.29, 0.38, 0.47] as const,
  into: 0.26, through: 0.56, split: 0.6, land: 0.74,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

interface Plan {
  /** Each hind ankle in the world and how its foot is pitched; each fore foot, on all fours. */
  at: V3[]; foot: number[]; fore: V3[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left, past how it is carried. */
  chest: V3;
  neck: number[]; head: V3;
  /** Each paw (or blade) in the chest's frame; where in the world it is wanted, and how much. */
  hand: V3[]; handW: V3[]; handK: number[];
  /** The tail: thrown up over its back and swung to its left (degrees), its tip flicked back and thrown left. */
  tail: number[];
  ears: number[];
  /** The nose and whiskers twitched (degrees), and the mouth open. */
  nose: number; jaw: number;
  /** Each blade turned about its hub (degrees). */
  spin: number[];
  /** The slab off the log: how far it has tipped and fallen, nought to one. */
  slab: number;
}

function zip<T>(a: T, b: T, f: (x: number, y: number) => number): T {
  if (typeof a === 'number') return f(a, b as unknown as number) as unknown as T;
  if (Array.isArray(a)) return a.map((x, i) => zip(x, (b as unknown as unknown[])[i], f)) as unknown as T;
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(a as object)) o[k] = zip((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], f);
  return o as T;
}
const mixPlan = (a: Plan, b: Plan, k: number): Plan => zip(a, b, (x, y) => lerp(x, y, k));
const shifted = (p: Plan, to: Plan, from: Plan): Plan => zip(p, zip(to, from, (x, y) => x - y), (x, d) => x + d);

interface Rest { ankle: V3[]; fore: V3[]; reach: number }
const rests = new Map<Timb, Rest>();
function restOf(s: Timb): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg;
  const R: Rest = {
    ankle: [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3),
    fore: [-1, 1].map((sd) => [sd * s.fore[0], s.fore[1], s.hand * 0.5] as V3),
    reach: L.len[0] + L.len[1],
  };
  rests.set(s, R);
  return R;
}

/** Each paw at rest, in the chest's frame: on all fours unused; upright, before it and low, a blade's breadth out from its side. */
const handRest = (s: Timb): V3[] => s.blade.hold.map((h) => {
  // Into the chest's frame, as it is carried leant forward.
  const a = (s.chest.lean * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  return [h[0], c * h[1] - sn * h[2], sn * h[1] + c * h[2]] as V3;
});

/** The idle turn of the blades: slowly round, twice in the loop, and a whole turn quick now and then. */
const idleSpin = (t: number, i: number): number => (i ? 1 : -1) * (30 * t + 360 * (ramp(t, 5.2, 6.4) + ramp(t, 15.8, 17)) * (i ? 1 : 0) + 360 * ramp(t, 10.4, 11.6) * (i ? 0 : 1));

function restPlan(s: Timb, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0], fore: R.fore.map((a) => [...a] as V3),
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0],
    hand: handRest(s), handW: [[0, 0, 0], [0, 0, 0]], handK: [0, 0],
    tail: [0, 0, 0, 0], ears: [0, 0], nose: 0, jaw: 0, spin: [0, 0], slab: 0,
  };
}

/** A foot `ph` of the way through its stride: on the ground sweeping back from `half` ahead to `half` behind, then lifted and brought forward. */
function stepAt(A: V3, ph: number, duty: number, half: number, lift: number): { at: V3; pitch: number } {
  if (ph < duty) return { at: [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]], pitch: -14 * ramp(ph, duty * 0.6, duty) };
  const u = (ph - duty) / (1 - duty);
  return { at: [A[0], lerp(A[1] - half, A[1] + half, smooth(u)), A[2] + lift * Math.sin(Math.PI * u)], pitch: -24 * (1 - ramp(u, 0, 0.4)) + 12 * hump(u, 0.82, 0.18) };
}

/**
 * Going. On all fours, a quick trot: the hind foot on one side with the fore foot on the other, the body bobbing at each step,
 * its tail fan bouncing a beat behind. Upright, a waddle: a foot at a time, rolled over the foot that is down and shifted onto
 * it, bobbing, its arms swinging against its legs, its tail swung the other way.
 */
function goingPlan(s: Timb, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), L = R.reach, half = L * lerp(G.swing[0], G.swing[1], g), lift = L * G.lift * (1 + 0.4 * g);
  for (let i = 0; i < 2; i++) {
    const h = stepAt(R.ankle[i], frac(w + i * 0.5), duty, half, lift);
    p.at[i] = h.at;
    p.foot[i] = h.pitch;
  }
  if (s.four) {
    const fl = s.arm[0] + s.arm[1], fh = fl * lerp(G.swing[0], G.swing[1], g) * 0.95;
    for (let i = 0; i < 2; i++) p.fore[i] = stepAt(R.fore[i], frac(w + (1 - i) * 0.5), duty, fh, fl * G.lift * (1 + 0.4 * g)).at;
    const bob = Math.cos(2 * TAU * w);
    p.H += L * (0.05 + 0.05 * g) * bob;
    p.pitch = 2 * Math.sin(TAU * w) - 3 * g;
    p.head = [-3 * bob, 0, 0];
    const lag = Math.sin(2 * TAU * (w - 0.12));
    p.tail = [-5 + 8 * lag, 5 * Math.sin(TAU * w), 10 * lag, 4 * Math.sin(TAU * w)];
    p.ears = [-8 - 8 * g, -8 - 8 * g];
    return p;
  }
  const sw = Math.sin(TAU * w), bob = Math.cos(2 * TAU * w);
  p.H += L * (0.03 + 0.03 * g) * bob;
  p.roll = -G.waddle * sw;
  p.side = -0.05 * L * sw;
  p.yaw = 4 * Math.cos(TAU * w);
  p.chest = [4 + 6 * g, -5 * Math.cos(TAU * w), G.waddle * 0.5 * sw];
  p.head = [-2 * bob, 4 * Math.cos(TAU * w), -G.waddle * 0.4 * sw];
  // Each arm forward as the leg on its side goes back.
  const A = (s.arm[0] + s.arm[1]) * G.arms * (1 + 0.5 * g), c = Math.cos(TAU * w);
  p.hand[0] = add(p.hand[0], [0, -A * c, A * 0.3 * Math.max(0, -c)]);
  p.hand[1] = add(p.hand[1], [0, A * c, A * 0.3 * Math.max(0, c)]);
  p.tail = [2 + 3 * bob, 7 * sw, 6 * bob, 6 * sw];
  p.ears = [-6 * g, -6 * g];
  return p;
}

/**
 * Standing about: breathing, looking about, its nose and whiskers twitching, an ear flicked, its tail fan swaying and now and then
 * shaken, its blades turning slowly and once in a while spun round.
 */
function stillPlan(s: Timb, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  const w = Math.tanh(2.5 * cyc(t, 3));
  p.chest = [1.5 * (a.breath - 0.5), 6 * look * 0.3, 1.2 * w];
  p.roll = s.four ? 0 : -1.6 * w;
  p.side = s.four ? 0 : 0.03 * s.leg.len[0] * w;
  p.neck = [0, 5 * look];
  p.head = [3 * cyc(t, 4), 9 * look, 4 * drift(t, 3)];
  p.H += 0.012 * R.reach * (a.breath - 0.5);
  // A shake of the fan: its tip flicked over twice, quick.
  const flick = beat(t, [2.6, 11.4, 17.8], 0.9);
  const fl = flick * Math.sin(Math.min(1, flick * 1.4) * TAU * 2);
  p.tail = [3 * cyc(t, 3) + 3 * flick, 5 * cyc(t, 2, 1), 4 * cyc(t, 4, 0.5) + 18 * fl, 10 * fl];
  // An ear flicked, one and then the other.
  const tw0 = beat(t, [4.4, 14.9], 0.35), tw1 = beat(t, [8.1, 20.2], 0.35);
  p.ears = [30 * tw0 * Math.sin(tw0 * Math.PI * 3), 30 * tw1 * Math.sin(tw1 * Math.PI * 3)];
  // Sniffing: the nose twitched up and down, quick, in bursts.
  const sniff = beat(t, [1.2, 7.3, 13.6, 19.0], 0.8);
  p.nose = 9 * sniff * Math.sin(t * TAU * 7);
  p.head[0] += 3 * sniff;
  p.spin = [idleSpin(t, 0), idleSpin(t, 1)];
  return p;
}

/* ---- its strike ---------------------------------------------------------------------- */

/** A point the right paw reaches: from its shoulder along `d`, `k` of the arm's length, in the chest's frame. */
const byRight = (s: Timb, d: V3, k = 0.9): V3 => add(s.shoulder, scale(unit(d), (s.arm[0] + s.arm[1]) * k));

/**
 * A strike. The Logkit crouches, springs in and bites, its fan thrown up. The Sawquill swings its right blade up over its
 * shoulder and down through what is before it, spinning; the Timberback the same, heavier, the other blade swung back.
 */
function strikePlan(s: Timb, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = TIMBER_HITS[s.stage], L = R.reach;
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.16, 0.96));
  const jolt = hump(t, hit + 0.02, 0.07);
  const since = (t - hit) * ACT_SECS.strike, ring = since < 0 ? 0 : Math.exp(-since * 4) * Math.sin(since * TAU * 2);
  if (s.four) {
    const hop = hump(t, (0.36 + hit) / 2, (hit - 0.36) / 2 + 0.03);
    p.H += L * (-0.35 * wind + 0.7 * hop - 0.2 * jolt);
    p.surge = L * 1.0 * blow;
    p.pitch = -6 * wind + 10 * hop - 4 * blow;
    p.head = [-10 * wind + 6 * blow, 0, 0];
    p.jaw = blow * (1 - jolt * 0.8);
    p.squash = 0.08 * jolt;
    p.tail = [-10 * wind + 26 * blow, 0, 30 * wind - 10 * blow + 30 * ring, 0];
    for (const i of [0, 1]) p.fore[i] = add(p.fore[i], [0, L * 1.0 * blow * ramp(t, hit - 0.06, hit + 0.04), L * 0.6 * hop]);
    for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 0.9 * blow * ramp(t, hit - 0.02, hit + 0.1), 0]);
  } else {
    // Up and out to its side and back, clear of its face, then down in front of it.
    const up = byRight(s, [1, -0.9, 0.25], 0.95), down = byRight(s, [0.3, 1, -0.55], 0.95);
    const k = ramp(t, 0.04, 0.34), k2 = ramp(t, 0.38, hit);
    p.hand[1] = mixV(mixV(p.hand[1], up, k), down, k2);
    p.hand[1] = mixV(p.hand[1], handRest(s)[1], ramp(t, hit + 0.18, 0.96));
    p.hand[0] = add(p.hand[0], [0, -0.3 * (s.arm[0] + s.arm[1]) * blow, 0.1 * wind]);
    p.chest = [-10 * wind + 24 * blow, 14 * wind - 12 * blow, 0];
    p.head = [8 * wind - 12 * blow, -8 * wind, 0];
    p.H += L * (0.05 * wind - 0.16 * blow - 0.12 * jolt);
    p.surge = L * 0.5 * blow;
    p.squash = 0.07 * jolt;
    p.tail = [-8 * wind + 20 * blow, 10 * wind, 16 * wind + 24 * ring, 0];
    p.at[1] = add(p.at[1], [0, L * 0.5 * blow, 0]);
    p.spin = [0, -900 * t - 600 * blow];
    p.jaw = 0.4 * blow;
  }
  p.ears = [-30 * wind + 10 * blow, -30 * wind + 10 * blow];
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/** The log it works, in the world: its middle, radius and length; where the slab comes off its right side, and how thick it is. */
interface Log { at: V3; r: number; len: number; slabX: number; slab: number }
const logs = new Map<Timb, Log>();
function logOf(s: Timb): Log {
  const had = logs.get(s);
  if (had) return had;
  const W = s.work, slab = W.r * 0.36;
  const L: Log = { at: W.at, r: W.r, len: W.len, slabX: W.at[0] + W.r - slab * 0.5, slab };
  logs.set(s, L);
  return L;
}

/**
 * The Logkit's go: up with its fore paws on the near end of the log, its head down to the edge of it on the right, rasping at it
 * with its teeth four times, working along it; the slab off the side tips away and falls (`TIMBER_WORK`).
 */
function gnawPlan(s: Timb, R: Rest, t: number, p: Plan): void {
  const W = TIMBER_WORK, Lg = logOf(s), L = R.reach;
  const up = ramp(t, 0.02, 0.14) * (1 - ramp(t, 0.82, 0.96));
  const bite = Math.max(...W.bites.map((b) => hump(t, b, 0.045)));
  const along = ramp(t, W.bites[0], W.bites[3]);
  for (const i of [0, 1]) p.fore[i] = mixV(p.fore[i], [Lg.at[0] + (i ? 0.5 : -1) * Lg.r * 0.7, Lg.at[1] - Lg.len * 0.5 + 0.06, Lg.at[2] + Lg.r * 0.9], up);
  p.pitch = 8 * up;
  p.H += L * 0.1 * up;
  p.surge = L * (0.15 + 0.2 * along) * up;
  p.chest = [-4 * up, -6 * up, 0];
  p.neck = [34 * up + 8 * bite, -10 * up];
  p.head = [-34 * up - 12 * bite, -12 * up, -6 * up];
  p.jaw = up * (0.35 + 0.65 * bite);
  p.at[0] = add(p.at[0], [0, L * 0.25 * up, 0]);
  p.at[1] = add(p.at[1], [0, L * 0.25 * up, 0]);
  p.slab = ramp(t, W.split, W.land);
  p.tail = [6 * up, 0, 8 * bite + 12 * hump(t, W.land, 0.06), 0];
  p.ears = [-14 * bite, -14 * bite];
  p.nose = 6 * bite;
}

/**
 * A go with the blade: the right arm raised, the blade spinning up; brought down into the near end of the log by its right edge
 * and driven along it, leant in behind it; the slab off the side falls away, the blade lifted out of the cut, and back
 * (`TIMBER_WORK`). The left blade held off to the side, out of the way.
 */
function sawPlan(s: Timb, R: Rest, t: number, p: Plan): void {
  const W = TIMBER_WORK, Lg = logOf(s), L = R.reach, B = s.blade;
  const set = ramp(t, 0.02, W.into) * (1 - ramp(t, W.split + 0.04, 0.92));
  const drive = ramp(t, W.into, W.through);
  // The blade's hub, in the world: over the near end, then down into the log by its right edge, and along it.
  const x = Lg.slabX - Lg.slab * 0.5;
  const over: V3 = [x, Lg.at[1] - Lg.len * 0.5 - B.r * 0.5, Lg.at[2] + Lg.r + B.r * 0.35];
  const into: V3 = [x, Lg.at[1] - Lg.len * 0.5 + B.r * 0.85, Lg.at[2] + Lg.r + B.r * 0.3];
  const done: V3 = [x, into[1] + Lg.len * 0.22, into[2]];
  const out: V3 = add(done, [0, -B.r * 0.8, B.r * 0.35]);
  const hub = t < W.into ? mixV(over, into, ramp(t, 0.12, W.into)) : t < W.through ? mixV(into, done, drive) : mixV(done, out, ramp(t, W.through + 0.02, W.split + 0.1));
  // The wrist inside the blade's hub.
  p.handW[1] = sub(hub, [B.thick * 0.5 + s.armW[1], 0, 0]);
  p.handK[1] = set;
  p.hand[0] = add(p.hand[0], [-0.6 * L * set, -0.45 * L * set, -0.4 * L * set]);
  p.chest = [(6 + 8 * drive) * set, -10 * set, -4 * set];
  p.surge = L * (0.12 + 0.22 * drive) * set;
  p.H -= L * 0.08 * set;
  p.at[1] = add(p.at[1], [0, L * 0.3 * set, 0]);
  p.neck = [2 * set, 2 * set];
  p.head = [-10 * set, 4 * set, 0];
  p.jaw = 0.25 * set;
  // Spun up as it is raised, fast through the cut, slowing after.
  const T = ACT_SECS.work;
  p.spin = [0, -(t * T * 300 + 1800 * T * Math.max(0, Math.min(t, W.split + 0.1) - 0.12))];
  p.slab = ramp(t, W.split, W.land);
  p.tail = [4 * set, 0, 10 * hump(t, W.land, 0.06) + 4 * drive, 0];
  p.ears = [-10 * set, -10 * set];
}

function workPlan(s: Timb, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R);
  if (s.four) gnawPlan(s, R, t, p);
  else sawPlan(s, R, t, p);
  const out = mixPlan(restPlan(s, R), p, down);
  // The slab falls whether or not it is eased in: it is the log's, not its.
  out.slab = p.slab;
  return out;
}

/** Feeding where it stands: bowed to the ground nibbling. */
function grazePlan(s: Timb, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, nib = Math.sin(t * TAU * 2.4);
  if (s.four) {
    p.neck = [26, 4 * drift(t, 2)];
    p.head = [-30 + 6 * nib, 6 * drift(t, 2), 0];
    p.jaw = 0.4 + 0.3 * nib;
    p.nose = 4 * nib;
    return p;
  }
  p.chest = [34, 0, 0];
  p.neck = [16, 4 * drift(t, 2)];
  p.head = [-30 + 6 * nib, 6 * drift(t, 2), 0];
  p.H -= 0.16 * R.reach;
  p.jaw = 0.3 + 0.2 * nib;
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its arms and its fan up, a shake, and settled. */
function evolvePlan(s: Timb, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach;
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * (s.stage === 2 ? 46 : 64));
  p.H += L * (-0.22 * hunch + 0.28 * up);
  p.pitch = s.four ? 16 * up : 0;
  p.chest = [14 * hunch - 8 * up, 6 * shake, 0];
  p.neck = [8 * hunch - 6 * up, 0];
  p.head = [-14 * hunch + 20 * up, 0, 14 * shake];
  p.roll = 4 * shake;
  p.squash = 0.06 * hump(t, 0.72, 0.05);
  p.tail = [-10 * hunch + 16 * up, 10 * shake, 20 * up + 16 * shake, 0];
  p.ears = [-20 * hunch + 10 * up, -20 * hunch + 10 * up];
  if (!s.four) {
    const top = s.shoulder[2] + (s.arm[0] + s.arm[1]) * 0.75;
    for (const i of [0, 1]) p.hand[i] = mixV(p.hand[i], [(i ? 1 : -1) * (s.shoulder[0] + (s.arm[0] + s.arm[1]) * 0.7), s.shoulder[1] - 0.05, top - (s.arm[0] + s.arm[1]) * 0.45], up);
    p.spin = [-720 * t, 720 * t];
  }
  return p;
}

function planOf(s: Timb, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(strikePlan(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return mixPlan(stillPlan(s, R, a), grazePlan(s, R, a), smooth(a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ------------------------------------------------------------------------- */

/** Two bones bent to put the end of the second at `to` from `from`, the joint between them bowed toward `hint`. */
function bend2(from: V3, to: V3, l0: number, l1: number, hint: V3): { mid: V3; end: V3 } {
  let d = sub(to, from);
  const D = len3(d), most = (l0 + l1) * 0.995, least = Math.abs(l0 - l1) + 0.06 * (l0 + l1), Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const end = add(from, scale(d, Dc));
  const a = sub(hint, scale(d, dot(hint, d)));
  const v = len3(a) > 1e-4 ? unit(a) : unit(cross(d, [1, 0, 0]));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  return { mid: add(add(from, scale(d, along)), scale(v, h)), end };
}

/** A leg bent to put its ankle at `ankle`: the knee forward and a little out; the foot flat, turned a little out. */
function legOf(s: Timb, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.35, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.2 * fwd[1], fwd[1] - sd * 0.2 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

const skullAt = (s: Timb): V3 => [0, 0.02, s.head.up];
const earRoot = (s: Timb): V3 => sub(onEgg(skullAt(s), s.head.r, s.ear.dir).p, scale(unit(s.ear.dir), s.ear.w * 0.3));
/** The middle of the muzzle in the head's frame. */
const muzzleAt = (s: Timb): V3 => add(skullAt(s), [0, s.head.r[1] * s.snout.out, -s.head.r[2] * 0.36]);

/** The bones of a stage, posed from its plan. */
function timberBones(s: Timb): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, working: boolean): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.chest.lean + P.chest[0];
    const chest = joint(body, s.chest.at, -lean, P.chest[2], P.chest[1]);
    b.chest = chest;
    b.neck = joint(chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    const er = earRoot(s);
    b.ear0 = joint(b.head, [-er[0], er[1], er[2]], -P.ears[0], 0, 0);
    b.ear1 = joint(b.head, er, -P.ears[1], 0, 0);
    b.nose = joint(b.head, muzzleAt(s), P.nose, 0, 0);
    b.jaw = joint(b.head, muzzleAt(s), -24 * P.jaw, 0, 0);
    b.tail = joint(body, s.tail.at, -P.tail[0], 0, P.tail[1]);
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    for (let i = 0; i < 2; i++) {
      const [u, l, f] = legOf(s, body, i, P.at[i], P.foot[i]);
      const key = i ? 'lr' : 'll';
      b[`${key}0`] = u;
      b[`${key}1`] = l;
      b[`${key}2`] = f;
    }
    const fwd = turn(chest, [0, 1, 0]), bf = turn(body, [0, 1, 0]), level = unit([bf[0], bf[1], 0]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1;
      const sh = place(chest, [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      if (s.four) {
        // A fore leg: its elbow back, its paw flat on the ground ahead.
        const want = mixV(P.fore[i], P.handW[i], P.handK[i]);
        const { mid: el, end: wr } = bend2(sh, want, s.arm[0], s.arm[1], add(scale(level, -1), [sd * 0.2, 0, 0]));
        const [X0, Y0, Z0] = frameOf(sub(sh, el), level), [X1, Y1, Z1] = frameOf(sub(el, wr), level), [X2, Y2, Z2] = frameOf([0, 0, 1], level);
        b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
        b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
        b[`hand${i}`] = xfOf(X2, Y2, Z2, wr);
        b[i ? 'fr2' : 'fl2'] = b[`hand${i}`];
        continue;
      }
      const want = mixV(place(chest, P.hand[i]), P.handW[i], smooth(P.handK[i]));
      const { mid: el, end: wr } = bend2(sh, want, s.arm[0], s.arm[1], turn(chest, unit([sd * 0.8, -0.6, -0.3])));
      const [X0, Y0, Z0] = frameOf(sub(sh, el), fwd), [X1, Y1, Z1] = frameOf(sub(el, wr), fwd);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      // The blade faced square out to the body's side whichever way the forearm points, its hub on the outside of the wrist,
      // turning about it.
      // Turned in at the front a little, so seen from in front it is a round and not an edge -- but square in the cut.
      const toe = (s.blade.toe[i] * (1 - smooth(P.handK[i])) * Math.PI) / 180;
      const Xs = unit(add(scale(turn(chest, [1, 0, 0]), Math.cos(toe)), scale(turn(chest, [0, 1, 0]), sd * Math.sin(toe))));
      let up = sub(el, wr);
      up = sub(up, scale(Xs, dot(up, Xs)));
      const Zs = len3(up) > 1e-4 ? unit(up) : turn(chest, [0, 0, 1]), Ys = cross(Zs, Xs);
      const out = sd * (s.blade.thick * 0.5 + s.armW[1]);
      b[`hand${i}`] = xfOf(X1, Y1, Z1, wr);
      b[`saw${i}`] = joint(xfOf(Xs, Ys, Zs, add(wr, scale(Xs, out))), [0, 0, 0], P.spin[i], 0, 0);
    }
    // The log it works on, and the slab off it, in the world.
    const Lg = logOf(s);
    // Out of the way of the blades' solids when it is not there.
    b.horse = { m: ROOT.m, t: [0, 0, working ? 0 : -1000] };
    const k = smooth(P.slab), rest: V3 = [Lg.slabX, Lg.at[1], Lg.at[2]];
    const landed: V3 = [Lg.at[0] + Lg.r + Lg.r * 1.4 + 0.04, Lg.at[1] + 0.04, Lg.slab * 0.5 + Lg.slab * 2.1];
    const fall = mixV(rest, landed, k);
    fall[2] += Lg.r * 0.8 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k);
    b.slab = joint({ m: ROOT.m, t: fall }, [0, 0, 0], 0, 90 * k, 6 * k);
    return b;
  };
  return (a) => pose(planOf(s, R, { ...a, go: a.act ? 0 : a.go }), a.act?.kind === 'work');
}

/* ---- what it is made of ------------------------------------------------------------- */

/**
 * The head: a round skull, the coat over its crown, cream from under its eyes down and round its throat; a cream muzzle pushed
 * forward, cream cheeks either side of it; big round dark eyes.
 */
function headOf(s: Timb, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), R = H.r, E = s.eye;
  const eyeZ = onEgg(C, R, E.dir).p[2] - C[2];
  const skull = painted(orb(C, R, n + 6, k + 4, 'coat'), (c) => {
    const d = onEggDir(C, R, c);
    if (d[2] < -0.5 && d[1] > -0.5) return 'mark';
    if (d[1] > 0.3 && c[2] - C[2] < eyeZ - E.size * (1.2 - 0.5 * Math.abs(d[0]))) return 'mark';
    // A cream stripe from the brow up the middle of its face, a marmot's.
    if (d[1] > 0.55 && Math.abs(d[0]) < 0.16 && d[2] < 0.55) return 'mark';
    return 'coat';
  });
  const S = s.snout, mc = muzzleAt(s);
  const muzzle = egg(mc, UPRIGHT, S.r, n, k, 'muzzle');
  const mouth = smile(add(mc, [0, S.r[1] * 0.86, -S.r[2] * 0.3]), [0, 1, 0.3], S.r[0] * 0.7, 'lid');
  const cheeks = merge(...[1, -1].map((sd) => {
    const e = onEgg(C, R, [sd * 0.78, 0.52, -0.42]);
    return egg(sub(e.p, scale(e.n, R[0] * 0.12)), UPRIGHT, [R[0] * 0.3, R[1] * 0.28, R[2] * 0.26], n, k, 'mark');
  }));
  return merge(skull, cheeks, muzzle, mouth, eyesOf(s, shut));
}

/** The eyes: each a dark rim, a big dark-brown iris, a darker middle and two glints, laid onto the skull's curve. */
function eyesOf(s: Timb, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  const tall = s.stage === 0 ? 1.14 : 1.04;
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.28, 8, 'lid', o), 0.018));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.15, r * 1.15 * tall, 12, 'lid', o), 0.016));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystalDark', o), 0.02));
    out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 0.64, r * 0.68 * tall, 10, 'eye', o), 0.024));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36)), scale(across, side * r * 0.28)), n, r * 0.36, r * 0.36, 6, 'glint', { ...o, lit: true }), 0.03));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.44)), scale(across, -side * r * 0.3)), n, r * 0.15, r * 0.15, 5, 'glint', { ...o, lit: true }), 0.03));
  }
  return paint(out);
}

/** Its nose and whiskers, on their own bone at the muzzle's middle so they twitch: a dark nose, three fine whiskers a side. */
function noseOf(s: Timb, fine: boolean): Mesh {
  const S = s.snout;
  const nose = egg([0, S.r[1] * 0.92, S.r[2] * 0.45], UPRIGHT, [S.r[0] * 0.36, S.r[1] * 0.24, S.r[2] * 0.3], 6, 3, 'nose');
  const out: Mesh[] = [nose];
  const W = s.head.r[0] * 0.78, r = 0.0038 * (s.head.r[0] / 0.41);
  for (const sd of [1, -1]) for (let q = 0; q < (fine ? 3 : 2); q++) {
    const at: V3 = [sd * S.r[0] * 0.75, S.r[1] * 0.45, S.r[2] * (0.05 - q * 0.22)];
    const tip = add(at, [sd * W * (0.9 - q * 0.08), -W * 0.22, (0.12 - q * 0.16) * W]);
    const mid = add(at, [sd * W * 0.5, -W * 0.04, (0.06 - q * 0.06) * W]);
    out.push(tube([at, mid, tip], [r, r * 0.8, r * 0.4], [r, r * 0.8, r * 0.4], 3, 'featherDark'));
  }
  return merge(...out);
}
/** Two front teeth under the nose, on the jaw's bone: seen while it gnaws or bites. */
function teethOf(s: Timb): Mesh {
  const S = s.snout, w = S.r[0] * 0.2;
  return merge(...[1, -1].map((sd) => tube([[sd * w * 0.55, S.r[1] * 0.8, -S.r[2] * 0.4], [sd * w * 0.55, S.r[1] * 0.86, -S.r[2] * 1.05]], w * 0.5, w * 0.24, 4, 'tooth', { up: [0, 1, 0] })));
}

/** An ear, the right one: small and round, the coat on its back, a pale hollow. */
function earOf(s: Timb, sd: number, n: number): Mesh {
  const E = s.ear, out = unit([sd * E.dir[0], E.dir[1], E.dir[2]]);
  const up = unit(add(out, [sd * 0.05, 0.05, 0.5])), face = unit(sub([sd * 0.55, 1, 0.1], scale(up, dot([sd * 0.55, 1, 0.1], up))));
  const us = [0, 0.3, 0.6, 0.85, 1];
  const pts = us.map((u) => scale(up, E.len * u));
  const ws = [E.w * 0.7, E.w * 0.98, E.w, E.w * 0.8, E.w * 0.3];
  const shell = tube(pts, ws, ws.map((x) => x * 0.42), n, (ring) => (ring === 0 ? 'coat' : 'coatDark'), { up: face });
  const hollow = tube(pts.slice(1, 4).map((p) => add(p, scale(face, E.w * 0.16))), [E.w * 0.66, E.w * 0.66, E.w * 0.36], [E.w * 0.1, E.w * 0.1, E.w * 0.06], n, 'inner', { up: face });
  return merge(shell, hollow);
}

/** The quills on its crown, in the head's frame: rows of plates from its brow back over its crown, standing up and back. */
function crestOf(s: Timb, fine: boolean): Mesh {
  const C = skullAt(s), R = s.head.r, Q = s.crest, out: Mesh[] = [];
  const count = fine ? Q.count : Math.ceil(Q.count * 0.6);
  for (let q = 0; q < count; q++) {
    const u = q / Math.max(1, count - 1), id = q * 5 + s.stage * 41;
    // From the brow back over the crown, a little either side in turn.
    const side = (q % 2 ? 1 : -1) * (0.14 + 0.18 * u) * (q === 0 ? 0 : 1);
    const e = onEgg(C, R, [side, lerp(0.35, -0.75, u), lerp(0.94, 0.62, u)]);
    const back = unit([side * 0.6, -1, 0]);
    const dir = unit(add(scale(back, Math.cos(Q.up)), [side * 0.3, 0, Math.sin(Q.up)]));
    const L = Q.len * (0.7 + 0.5 * Math.sin(Math.PI * (0.25 + 0.75 * u))) * (0.9 + 0.2 * jitter(id));
    out.push(plate(sub(e.p, scale(e.n, 0.02)), dir, add(e.n, [side, 0, 0]), L, Q.w * (0.9 + 0.2 * jitter(id + 1)), plateOf(id, s.moss), { lobes: fine ? QUILL : QUILL_FAR, arch: -0.06 }));
  }
  return merge(...out);
}

/**
 * Its coat of quill plates, in the chest's frame: rows of them from its neck to its rump, each rooted on the skin and lying back
 * down over it, the row above over the one below like shingles, all the way round its back and sides and leaving its cream
 * front bare; standing out from the skin most along its spine, as far as the stage says, and lying flat on its flanks; moss on
 * some. Drawn small, fewer and bigger.
 */
function quillsOf(s: Timb, fine: boolean): Mesh {
  const Q = s.quills, out: Mesh[] = [], k = fine ? 1 : 1.4, L0 = Q.len * k, W0 = Q.w * k, S = Q.spread;
  const rows = Math.max(2, Math.round((Q.top - Q.low) / (L0 * 0.5)) + 1);
  for (let row = 0; row < rows; row++) {
    const z0 = lerp(Q.top, Q.low, row / (rows - 1));
    const p0 = onBody(s, z0, 0), p1 = onBody(s, z0, -Math.PI / 2), R = (Math.abs(p0[0]) + Math.abs(p1[1] - p0[1])) / 2;
    const per = Math.max(3, Math.ceil((2 * S * R) / (W0 * 1.45)));
    for (let q = 0; q < per; q++) {
      const id = q * 5 + row * 23 + s.stage * 7;
      const a = -Math.PI / 2 + ((q + 0.5 + (row % 2 ? 0.5 : 0)) / per - 0.5) * 2 * S + (jitter(id + 3) - 0.5) * 0.08;
      const t = Math.min(1, Math.abs(a + Math.PI / 2) / S);
      const L = L0 * (1.08 - 0.3 * t) * (0.9 + 0.2 * jitter(id)), W = W0 * (1 - 0.15 * t) * (0.9 + 0.2 * jitter(id + 1));
      const lift = 0.006 + (rows - row) * 0.004 * k;
      const root = onBody(s, z0, a, lift), o = unit([Math.cos(a), Math.sin(a), 0]);
      const below = onBody(s, z0 - L, a, lift + 0.01);
      const raise = Q.raise * (1 - t) ** 2 + 0.1;
      const dir = unit(add(scale(unit(sub(below, root)), Math.cos(raise)), scale(o, Math.sin(raise))));
      out.push(plate(root, dir, o, L, W, plateOf(id, s.moss), { lobes: fine ? QUILL : QUILL_FAR, arch: 0.03, fold: 0.35, flat: true }));
      if (fine || q % 2) out.push(mossOn(root, dir, o, L, W, id, s.moss, 0.35, 0.03) ?? merge());
    }
  }
  return merge(...out);
}

/**
 * Plates over a limb, in its frame (its `z` along it from its root): rows of them down it, each lying down it, round its outside
 * and its back, the row above over the one below.
 */
function limbQuills(sd: number, len: number, r: number, rows: number, size: number, id: number, moss: number, fine: boolean, from = 0.05): Mesh {
  const out: Mesh[] = [];
  const nr = fine ? rows : Math.max(1, Math.ceil(rows / 2)), per = fine ? 4 : 2;
  for (let row = 0; row < nr; row++) {
    const u = lerp(from, 0.85, nr > 1 ? row / (nr - 1) : 0.5);
    for (let q = 0; q < per; q++) {
      // Round its outside, from its front a little to its back.
      const a = (sd > 0 ? 0 : Math.PI) + sd * (((q + 0.5 + (row % 2) * 0.5) / per) * 2.6 - 1.6);
      const o: V3 = [Math.cos(a), Math.sin(a), 0];
      const root: V3 = add([0, 0, -len * u], scale(o, r * 0.95 + (nr - row) * 0.004));
      const d = unit(add([0, 0, -1], scale(o, 0.25))), L = size * (0.85 + 0.3 * jitter(id + q + row * 5)), W = size * 0.34;
      const m = plateOf(id + q * 3 + row * 11, moss);
      out.push(plate(root, d, o, L, W, m, { lobes: fine ? QUILL : QUILL_FAR, fold: 0.35, flat: true }));
      if (fine) out.push(mossOn(root, d, o, L, W, id + q * 3 + row * 11, moss, 0.35, 0.08) ?? merge());
    }
  }
  return merge(...out);
}

/**
 * The plates on its head, in the head's frame: over the back and sides of its skull behind its eyes and ears, lying back and
 * down, small; its face, cheeks and throat left bare.
 */
function headQuills(s: Timb, fine: boolean): Mesh {
  const C = skullAt(s), R = s.head.r, out: Mesh[] = [], sz = Math.max(s.quills.len * 0.8, R[0] * 0.38) * (fine ? 1 : 1.3);
  const els = fine ? [0.62, 0.4, 0.18, -0.04] : [0.55, 0.2];
  els.forEach((el, row) => {
    const per = fine ? 8 - row : 4, span = 1.7 - 0.12 * row;
    for (let q = 0; q < per; q++) {
      const az = ((q + 0.5 + (row % 2) * 0.5) / per - 0.5) * 2 * span, id = q * 7 + row * 19 + s.stage * 3;
      const e = onEgg(C, R, [Math.sin(az) * Math.cos(el * 1.2), -Math.cos(az) * Math.cos(el * 1.2), Math.sin(el * 1.2)]);
      const want = sub([0, -1, -0.7], scale(e.n, dot([0, -1, -0.7], e.n)));
      const L = sz * (0.9 + 0.2 * jitter(id));
      out.push(plate(add(e.p, scale(e.n, 0.004 + (els.length - row) * 0.004)), unit(want), e.n, L, L * 0.4, PLATES[Math.floor(jitter(id + 9.1) * 3)], { lobes: fine ? QUILL : QUILL_FAR, fold: 0.35, flat: true }));
    }
  });
  return merge(...out);
}

/** Moss in patches on its back and shoulders, painted on the skin in the chest's frame. */
function mossOf(s: Timb, fine: boolean): Mesh {
  const out: Disc[] = [], count = Math.round((fine ? 12 : 7) * s.moss);
  const z0 = s.torso.z[s.torso.z.length - 1], z1 = s.torso.z[0];
  for (let q = 0; q < count; q++) {
    const id = q * 11 + s.stage * 3, z = lerp(z0 * 0.95, z1, jitter(id)), a = -Math.PI / 2 + (jitter(id + 1) - 0.5) * 2.6;
    const p = onBody(s, z, a, 0.006), n = unit([Math.cos(a), Math.sin(a), 0]);
    const r = s.quills.len * (0.24 + 0.16 * jitter(id + 2));
    out.push(disc(p, n, r, r * 0.7, 7, q % 3 ? 'moss' : 'water', { spin: jitter(id + 3) * 3 }));
  }
  return paint(out);
}

/* ---- wood ------------------------------------------------------------------------------- */

/** A log along its `z`, `len` long, from its middle: bark in ridges round it, its ends cut and ringed, moss on its top. */
function logMesh(r: number, len: number, n: number, fine: boolean, id: number, moss = 0): Mesh {
  const sides = n + 2, h = len / 2;
  const bark = tube([[0, 0, -h], [0, 0, -h * 0.3], [0, 0, h * 0.3], [0, 0, h]], [r, r * 1.03, r * 0.98, r], [r, r * 1.03, r * 0.98, r], sides, (_k, j) => (j % 3 === 0 ? 'woodDark' : 'bark'), { start: false, end: false, up: [0, 1, 0] });
  const ends = [-1, 1].map((sd) => merge(capOf([0, 0, sd * h], [0, 0, sd], r * 1.0, sides, 'shell', [0, 1, 0]), ringsOn([0, 0, sd * h], [0, 0, sd], r, fine, id + sd)));
  const out: Mesh[] = [bark, ...ends];
  if (moss) {
    const ds: Disc[] = [];
    for (let q = 0; q < (fine ? 3 : 2); q++) {
      const a = Math.PI / 2 + (jitter(id + q) - 0.5) * 1.6, z = (jitter(id + q + 4) - 0.5) * len * 0.7, nrm: V3 = [Math.cos(a), Math.sin(a), 0];
      ds.push(disc(add(scale(nrm, r * 1.02), [0, 0, z]), nrm, r * 0.5 * moss, r * 0.9 * moss, 7, q % 2 ? 'water' : 'moss', { up: [0, 0, 1] }));
    }
    out.push(paint(ds));
  }
  return merge(...out);
}

/** A box, from its middle: `x` across, `y` along, `z` up; each face its own wood. */
function box(x: number, y: number, z: number, m: { top: Mat; bottom: Mat; side: Mat; end: Mat; out?: Mat }): Mesh {
  const v: V3[] = [];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1]) v.push([sx * x, sy * y, sz * z]);
  const f: Face[] = [
    { i: [4, 5, 7, 6], m: m.top }, { i: [0, 2, 3, 1], m: m.bottom },
    { i: [1, 3, 7, 5], m: m.out ?? m.side }, { i: [0, 4, 6, 2], m: m.side },
    { i: [2, 6, 7, 3], m: m.end }, { i: [0, 1, 5, 4], m: m.end },
  ];
  return mesh(v, woundTo(v, f, [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]));
}

/**
 * The blade, in its own frame from its hub, faced along `x`: a log round, its two faces cut and ringed, a band of bark round its
 * rim and steel teeth out of it, each hooked the way it turns; a boss of bark over its hub.
 */
function bladeOf(s: Timb, sd: number, n: number, fine: boolean): Mesh {
  const B = s.blade, r = B.r * (sd > 0 ? 1 : B.left), th = B.thick, sides = fine ? 18 : 13;
  const rim = tube([[-th / 2, 0, 0], [th / 2, 0, 0]], r, r, sides, (_k, j) => (j % 2 ? 'bark' : 'woodDark'), { start: false, end: false, up: [0, 0, 1] });
  const faces = [-1, 1].map((x) => merge(capOf([x * th / 2, 0, 0], [x, 0, 0], r * 0.995, sides, 'shell'), ringsOn([x * th / 2, 0, 0], [x, 0, 0], r * 0.9, fine, s.stage * 5 + x + sd)));
  const teeth: Mesh[] = [];
  const T = fine ? B.teeth : Math.round(B.teeth * 0.7), w = th * 0.32;
  for (let q = 0; q < T; q++) {
    const a = (q / T) * TAU, da = (TAU / T) * 0.42;
    const at = (ang: number, rr: number, x: number): V3 => [x, Math.cos(ang) * rr, Math.sin(ang) * rr];
    // A hooked tooth: its foot on the rim, its point out past it and forward round the way it turns.
    const v: V3[] = [at(a - da, r * 0.97, -w), at(a + da, r * 0.97, -w), at(a + da * 1.6, r * 1.2, -w * 0.6), at(a - da, r * 0.97, w), at(a + da, r * 0.97, w), at(a + da * 1.6, r * 1.2, w * 0.6)];
    const f: Face[] = [
      { i: [0, 1, 2], m: 'metal' }, { i: [3, 5, 4], m: 'metal' },
      { i: [1, 4, 5, 2], m: 'metalLit' }, { i: [0, 2, 5, 3], m: 'metalDark' },
    ];
    const out0 = unit([0, Math.cos(a), Math.sin(a)]);
    teeth.push(mesh(v, woundTo(v, f, [[-1, 0, 0], [1, 0, 0], unit(add(out0, [0, -Math.sin(a), Math.cos(a)])), unit(sub(out0, [0, -Math.sin(a), Math.cos(a)]))])));
  }
  const boss = orb([sd * th * 0.5, 0, 0], [th * 0.6, r * 0.16, r * 0.16], 7, 4, 'bark');
  return merge(rim, ...faces, ...teeth, boss);
}

/** The bundle on its back, in the chest's frame: its logs and rounds, moss on them, and the oak sprouting out of them. */
function bundleOf(s: Timb, n: number, fine: boolean): Mesh {
  const out: Mesh[] = [];
  s.logs.forEach((Lg, q) => {
    const m = logMesh(Lg.r, Lg.len, n, fine, q * 13 + 3, Lg.len > Lg.r * 3 ? 0.9 : 0);
    const [X, Y, Z] = frameOf(Lg.dir, [0, 0, 1]);
    out.push(mesh(m.v.map((p) => add(Lg.at, add(add(scale(X, p[0]), scale(Y, p[1])), scale(Z, p[2])))), m.f));
  });
  for (const [q, sp] of s.sprigs.entries()) out.push(sprigOf(sp.at, unit(sp.dir), sp.len, fine, q));
  return merge(...out);
}

/** A sprig of oak: a twig, and leaves off it in pairs and one at its tip. */
function sprigOf(at: V3, dir: V3, len: number, fine: boolean, id: number): Mesh {
  const out: Mesh[] = [];
  const side = unit(cross(dir, [0, 0, 1])), tip = add(at, scale(dir, len));
  out.push(taper([at, add(at, add(scale(dir, len * 0.5), scale(side, len * 0.06))), tip], len * 0.05, len * 0.02, 4, 'stem'));
  const leaves = fine ? [0.45, 0.72, 1] : [0.6, 1];
  leaves.forEach((u, q) => {
    const root = add(at, scale(dir, len * u * 0.94));
    const pair = u < 1 ? [1, -1] : [0];
    for (const sd of pair) {
      const d = unit(add(scale(dir, 0.6), scale(side, sd * 0.9)));
      const face = unit(add(cross(d, side), [0, 0, 0.2]));
      const L = len * (u < 1 ? 0.42 : 0.5) * (0.9 + 0.2 * jitter(id * 7 + q + sd));
      out.push(plate(root, sd ? d : dir, face, L, L * 0.34, (q + id) % 2 ? ['leaf', 'leafDark'] : ['leafDark', 'leaf'], { lobes: fine ? OAK : OAK_FAR, fold: 0.15, arch: 0.08, back: 'leafDark' }));
    }
  });
  return merge(...out);
}

/**
 * What it works on, drawn only at its task, in the world: the log laid lengthwise on a sawbuck -- two crossed pairs of legs, a
 * rail between -- and two planks it has cut already lying on the ground at its right.
 */
function sawbuckOf(s: Timb, n: number, fine: boolean): Mesh {
  const Lg = logOf(s), r = Lg.r, out: Mesh[] = [];
  const log = logMesh(r, Lg.len, n, fine, s.stage * 7 + 1, 0.8);
  // Laid along its front.
  out.push(mesh(log.v.map((p) => add(Lg.at, [p[0], p[2], -p[1]])), log.f));
  const hc = Lg.at[2] - r * 1.41, top = hc + r * 2.2, sw = r * 0.16;
  for (const y of [Lg.at[1] - Lg.len * 0.32, Lg.at[1] + Lg.len * 0.32]) {
    for (const sd of [1, -1]) {
      // A leg from the ground on one side up through the crossing to past the log on the other.
      const foot: V3 = [Lg.at[0] + sd * hc * 0.9, y, 0], cross0: V3 = [Lg.at[0], y, hc];
      const end = add(cross0, scale(unit(sub(cross0, foot)), top - hc + r * 0.3));
      out.push(tube([foot, cross0, end], sw, sw, 5, (k) => (k ? 'woodDark' : 'bark')));
    }
  }
  out.push(tube([[Lg.at[0], Lg.at[1] - Lg.len * 0.34, hc], [Lg.at[0], Lg.at[1] + Lg.len * 0.34, hc]], sw * 0.8, sw * 0.8, 5, 'woodDark'));
  // Two planks it has cut, on the ground beside it.
  const px = Lg.at[0] + r + r * 1.4 + 0.04;
  for (let q = 0; q < 2; q++) {
    const b = box(r * 0.7, Lg.len * 0.46, Lg.slab * 0.5, { top: 'shell', bottom: 'bark', side: 'wood', end: 'shellDark' });
    out.push(mesh(b.v.map((p) => { const a = (q ? 0.08 : -0.05); return add([px + q * 0.03, Lg.at[1] + q * 0.02, Lg.slab * (0.5 + q)], [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]]); }), b.f));
  }
  return merge(...out);
}

/** The slab off the log's side, in its frame from its middle: bark outside, the fresh cut inside, its ends ringed. */
function slabOf(s: Timb): Mesh {
  const Lg = logOf(s);
  return box(Lg.slab * 0.5, Lg.len * 0.47, Lg.r * 0.72, { top: 'woodDark', bottom: 'woodDark', side: 'shell', out: 'bark', end: 'shellDark' });
}

/** Solids inside the torso and the hips, in the chest's frame, that hide what is round the far side of them: plates, moss, logs. */
function bodySolids(s: Timb): Array<{ c: V3; r: V3 }> {
  const T = s.torso, out: Array<{ c: V3; r: V3 }> = [];
  for (let q = 0; q < T.z.length - 1; q++) {
    out.push({ c: [0, (T.y[q] + T.y[q + 1]) / 2, (T.z[q] + T.z[q + 1]) / 2], r: [Math.min(T.w[q], T.w[q + 1]) * 0.94, Math.min(T.h[q], T.h[q + 1]) * 0.94, (T.z[q + 1] - T.z[q]) * 0.8] });
  }
  const H = hipsInChest(s);
  out.push({ c: H.c, r: scale(H.r, 0.92) });
  return out;
}
/** Solids inside the head that hide what is round the far side of them. */
const headSolids = (s: Timb): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];

/** A stage's pieces. */
function timberBuild(s: Timb, lod: number, P: (a: Anim) => Plan): Piece[] {
  const fine = lod > 0, n = cut(lod, 8, 10), k = cut(lod, 5, 6), pieces: Piece[] = [];
  const hide = headSolids(s);
  const Hc = s.hips.c, Hr = s.hips.r;
  // Cream underneath: its belly, and up its chest and throat.
  const cream = (c: V3): boolean => {
    const d = onEggDir(Hc, Hr, c);
    return (s.four ? d[2] < -0.45 : d[1] > 0.45 - 0.3 * Math.max(0, -d[2]) || d[2] < -0.8);
  };
  pieces.push({ key: 'hips', mesh: painted(orb(Hc, Hr, n + 4, k + 2, 'coat'), (c) => (cream(c) ? 'mark' : 'coat')), bone: 'trunk', bias: 0 });
  const T = s.torso;
  const torso = painted(tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n + 2, 'coat', { up: [0, 1, 0] }), (c) => (unit([c[0], c[1] - 0.02, 0])[1] > (s.four ? 0.4 : 0.5) ? 'mark' : 'coat'));
  pieces.push({ key: 'torso', mesh: torso, bone: 'chest', bias: 0.01, after: 'hips', breathes: { c: [0, 0, T.z[1]], k: 0.04 } });
  const inside = bodySolids(s);
  pieces.push({ key: 'moss', mesh: mossOf(s, fine), bone: 'chest', bias: 0.012, after: ['torso', 'hips'], hide: inside });
  pieces.push({ key: 'quills', mesh: quillsOf(s, fine), bone: 'chest', bias: 0.03, after: ['torso', 'moss', 'hips'], hide: inside });
  pieces.push({ key: 'neck', mesh: painted(tube([[0, 0, -0.08], [0, 0, s.neck.len + 0.05]], s.neck.w, s.neck.w * 0.9, n, 'coat'), (c) => (c[1] > 0.04 ? 'mark' : 'coat')), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'nose', mesh: noseOf(s, fine), bone: 'nose', bias: 0.205, after: 'head', hide, hideIn: 'head', thin: true, airy: true });
  pieces.push({ key: 'teeth', mesh: teethOf(s), bone: 'jaw', bias: 0.204, after: 'head', hide, hideIn: 'head', shown: (a) => P(a).jaw > 0.2 });
  pieces.push({ key: 'headq', mesh: headQuills(s, fine), bone: 'head', bias: 0.185, after: 'head', hide });
  pieces.push({ key: 'crest', mesh: crestOf(s, fine), bone: 'head', bias: 0.19, front: [0, 1, 0], after: ['head', 'headq'], hide });
  for (const i of [0, 1]) pieces.push({ key: `ear${i}`, mesh: earOf(s, i ? 1 : -1, n), bone: `ear${i}`, bias: 0.19, after: 'head', front: [i ? 1 : -1, 0.6, 0], hide: [{ c: sub(skullAt(s), i ? earRoot(s) : [-earRoot(s)[0], earRoot(s)[1], earRoot(s)[2]]), r: scale(s.head.r, 0.86) }] });
  // The fan of planks behind it, curled as a whole.
  const fan = fanMesh(s, n, k, fine);
  pieces.push({ key: 'tail', mesh: fan.mesh, bone: 'tail', bias: -0.15, bent: curled(fan.along, P) });
  // Hind legs: a round furred haunch, a short shin, a long dark hind foot with its toes and claws.
  const L = s.leg;
  for (const key of ['ll', 'lr']) {
    const front: V3 = [0, 1, 0], sd = key === 'lr' ? 1 : -1;
    const thigh = merge(egg([0, 0, -L.len[0] * 0.3], UPRIGHT, [L.w[0] * 0.9, L.w[0] * 1.0, L.len[0] * 0.75 + 0.05], n, k, 'coat'), tube([[0, 0, 0], [0, 0, -L.len[0]]], [L.w[0], L.w[1]], [L.w[0], L.w[1]], n, 'coat', { seam: 'start' }));
    const shin = tube([[0, 0, L.w[1] * 0.5], [0, 0.005, -L.len[1]]], [L.w[1], L.w[1] * 0.85], [L.w[1], L.w[1] * 0.85], n, 'coatDark', { seam: 'start' });
    pieces.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, after: ['hips'], front },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['hips', `${key}0`], front },
      { key: `${key}2`, mesh: footOf(L.foot[0], L.foot[1], L.len[2], n, k), bone: `${key}2`, bias: 0.02, after: ['hips', `${key}1`], front },
    );
    if (s.thighQuills) pieces.push({ key: `${key}q`, mesh: limbQuills(sd, L.len[0] * 1.1, L.w[0] * 0.92, s.thighQuills, s.quills.len * 0.9, sd > 0 ? 60 : 80, s.moss, fine, -0.15), bone: `${key}0`, bias: 0.012, after: ['hips', `${key}0`], front: [sd, 0.3, 0] });
  }
  // Arms: a furred upper arm and forearm; on all fours a small fore foot, upright a blade.
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, front: V3 = [0, 1, 0], ahead: V3 = s.four ? [0, 1, 0] : [0, 0.5, -0.85];
    const upper = merge(
      egg([0, 0, -s.arm[0] * 0.3], UPRIGHT, [s.armW[0] * 1.3, s.armW[0] * 1.3, s.arm[0] * 0.7], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -s.arm[0]]], [s.armW[0] * 1.1, s.armW[1] * 1.1], [s.armW[0] * 1.1, s.armW[1] * 1.1], n, 'coat', { seam: 'start' }),
    );
    const fore = merge(
      egg([0, 0, 0], UPRIGHT, [s.armW[1] * 1.05, s.armW[1] * 1.05, s.armW[1] * 1.05], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -s.arm[1] + s.hand * 0.3]], [s.armW[1] * 1.05, s.armW[1] * 0.9], [s.armW[1] * 1.05, s.armW[1] * 0.9], n, 'coatDark', { seam: 'both' }),
    );
    pieces.push(
      { key: `arm${i}`, mesh: upper, bone: `arm${i}`, bias: 0.06, after: ['torso', 'quills'], front },
      { key: `fore${i}`, mesh: fore, bone: `elbow${i}`, bias: 0.065, after: ['torso', 'quills', `arm${i}`], front: ahead },
    );
    if (s.armQuills) {
      pieces.push({ key: `armq${i}`, mesh: limbQuills(sd, s.arm[0], s.armW[0] * 1.15, s.armQuills, s.quills.len * 0.8, 70 + i * 20, s.moss, fine), bone: `arm${i}`, bias: 0.062, after: [`arm${i}`], front: [sd, 0.3, 0] });
      pieces.push({ key: `foreq${i}`, mesh: limbQuills(sd, s.arm[1] * 0.9, s.armW[1] * 1.05, s.armQuills, s.quills.len * 0.8, 90 + i * 20, s.moss, fine), bone: `elbow${i}`, bias: 0.067, after: [`fore${i}`], front: [sd, 0.3, 0] });
    }
    if (s.four) pieces.push({ key: `hand${i}`, mesh: footOf(s.hand * 2.2, s.hand * 0.95, s.hand * 0.5, n, k), bone: `hand${i}`, bias: 0.07, after: ['torso', `fore${i}`], front: ahead });
    else {
      const blade = bladeOf(s, sd, n, fine);
      // Into the log at its task: drawn over it, but for what of it is in the log or behind it.
      const Lg = logOf(s);
      pieces.push({ key: `saw${i}`, mesh: blade, bone: `saw${i}`, bias: 0.08, after: ['torso', 'quills', `fore${i}`, `arm${i}`, 'hips', 'sawbuck'], front: [sd, 0, 0], hide: [-1, 0, 1].map((q) => ({ c: add(Lg.at, [0, q * Lg.len * 0.33, 0]), r: [Lg.r * 0.98, Lg.len * 0.22, Lg.r * 0.98] as V3 })), hideIn: 'horse' });
    }
  }
  if (s.logs.length) pieces.push({ key: 'bundle', mesh: bundleOf(s, n, fine), bone: 'chest', bias: 0.04, after: ['torso', 'quills', 'moss'], hide: inside });
  pieces.push({ key: 'sawbuck', mesh: sawbuckOf(s, n, fine), bone: 'horse', bias: 0, shown: (a) => a.act?.kind === 'work' });
  pieces.push({ key: 'slab', mesh: slabOf(s), bone: 'slab', bias: 0.01, after: 'sawbuck', shown: (a) => a.act?.kind === 'work' });
  return pieces;
}

/** A foot, from its ankle: a dark pad and its toes, a dark claw at each. */
function footOf(fl: number, fw: number, drop: number, n: number, k: number): Mesh {
  return merge(
    egg([0, fl * 0.22, -drop + fw * 0.4], UPRIGHT, [fw * 0.95, fl * 0.55, fw * 0.5], n, k, 'coatDark'),
    ...[-1, -0.33, 0.33, 1].flatMap((q) => [
      egg([q * fw * 0.6, fl * 0.72, -drop + fw * 0.22], UPRIGHT, [fw * 0.24, fw * 0.32, fw * 0.22], 5, 3, 'coatDark'),
      taper([[q * fw * 0.62, fl * 0.8, -drop + fw * 0.2], [q * fw * 0.66, fl * 0.96, -drop + fw * 0.02]], fw * 0.11, 0.004, 4, 'claw'),
    ]),
  );
}

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const DUST: readonly RGB[] = [[236, 206, 156], [216, 178, 120], [248, 230, 196]];
const DUST_INK: RGB = [150, 104, 62];
const CHIP: readonly RGB[] = [[200, 150, 96], [168, 116, 70], [232, 196, 140]];

/** A mote of sawdust: a pale dot, inked faintly, never under a pixel. */
function mote(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 0.9 * px);
  g.fillStyle = css(DUST_INK, al * 0.5);
  g.beginPath();
  g.arc(x, y, r + 0.4 * px, 0, TAU);
  g.fill();
  g.fillStyle = css(c, al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}
/** A chip of wood, spinning: a small inked sliver. */
function chip(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.4 * px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = css(c, al);
  g.strokeStyle = css(DUST_INK, al);
  g.lineWidth = Math.max(px * 0.8, r * 0.18);
  g.beginPath();
  g.rect(-r, -r * 0.35, r * 2, r * 0.7);
  g.fill();
  g.stroke();
  g.restore();
}

/** Sawdust thrown from `from`, `since` seconds on, along `dir` and up, falling; each mote on its side of the body. */
function spray(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, dir: V3, since: number, front: boolean, count: number, id: number, speed: number, size: number, life = 0.5): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = (jitter(k) - 0.5) * 1.6, sp = speed * (0.4 + 0.8 * jitter(k + 1));
    const d = unit(add(dir, [Math.cos(a + 1) * 0.6, Math.sin(a) * 0.6, 0.3 + 0.6 * jitter(k + 2)]));
    const tt = (1 - Math.exp(-since * 5)) / 5;
    const p: V3 = [from[0] + d[0] * sp * tt, from[1] + d[1] * sp * tt, Math.max(0.02, from[2] + d[2] * sp * tt - 1.2 * since * since)];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const al = 1 - smooth((since - life * 0.5) / (life * 0.5));
    if (q % 4 === 0) chip(g, x, y, size * 1.6, a + since * 14, CHIP[q % 3], al);
    else mote(g, x, y, size * (0.6 + 0.6 * jitter(k + 3)), DUST[q % 3], al);
  }
}
/** A puff of sawdust where something lands: motes thrown low and wide, slowing, gone. */
function puff(g: CanvasRenderingContext2D, view: View, mid: V3, at: V3, since: number, front: boolean, big: number): void {
  if (since < 0 || since > 0.45) return;
  for (let q = 0; q < 14; q++) {
    const a = (q / 14) * TAU + jitter(q) * 0.4, sp = big * (0.6 + 0.5 * jitter(q + 3));
    const tt = (1 - Math.exp(-since * 7)) / 7;
    const p: V3 = [at[0] + Math.cos(a) * sp * tt, at[1] + Math.sin(a) * sp * tt, at[2] + big * 0.4 * tt * (0.5 + jitter(q + 5))];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    mote(g, x, y, big * 0.07 * (1 + since * 3), DUST[q % 3], 0.9 * (1 - since / 0.45));
  }
}

/**
 * What a go at its task throws: chips off the log at each of the Logkit's bites; sawdust sprayed out of the cut behind the blade
 * all the way along it; and a puff where the slab lands.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Timb, b: Bones, a: Anim, t: number, front: boolean): void {
  const W = TIMBER_WORK, mid = b.chest.t, T = ACT_SECS.work, Lg = logOf(s), down = downOf(t, a.graze);
  const big = 0.6 + 0.4 * s.stage;
  if (s.four) {
    const mouth = place(b.jaw, [0, s.snout.r[1] * 0.9, -s.snout.r[2] * 0.6]);
    for (const h of W.bites) spray(g, view, mid, mouth, [0.6, 0.4, 0.4], (t - h) * T, front, 8, Math.round(h * 100), 1.4, 0.022, 0.4);
  } else if (b.saw1) {
    // Out of the cut at the bottom of the blade, back toward it and up.
    const hub = b.saw1.t, at: V3 = [Lg.slabX - Lg.slab * 0.5, hub[1] - s.blade.r * 0.4, Lg.at[2] + Lg.r * 0.9];
    const on = ramp(t, W.into - 0.02, W.into + 0.02) * (1 - ramp(t, W.through, W.through + 0.06)) * down;
    if (on > 0.1) for (let q = 0; q < 4; q++) spray(g, view, mid, at, [0.4, -0.8, 0.5], frac(t * T * 6 + q * 0.25) * 0.5, front, 7, q * 37 + Math.floor(t * T * 6) * 3, 2 * big, 0.026 * big, 0.5);
  }
  if (b.slab) puff(g, view, mid, b.slab.t, (t - W.land) * T, front, big);
}

/** What a strike throws: chips and sawdust off the blade where it lands, or bark bitten off. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Timb, b: Bones, t: number, front: boolean): void {
  const since = (t - TIMBER_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t;
  if (since <= 0) return;
  const at = s.four ? place(b.jaw, [0, s.snout.r[1], 0]) : b.saw1 ? place(b.saw1, [0, 0, -s.blade.r]) : mid;
  spray(g, view, mid, at, [0, 1, 0.3], since, front, 10 + 3 * s.stage, 5 + s.stage * 13, 2 + 0.6 * s.stage, 0.016 + 0.008 * s.stage, 0.45);
}

/** Evolving: chips and motes of sawdust spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Timb, b: Bones, t: number, front: boolean): void {
  const mid = b.chest.t, big = 0.7 + 0.3 * s.stage;
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = s.hips.r[0] * 1.8 + 0.2, high = s.high + s.torso.z[s.torso.z.length - 1] + s.head.up * 2 + 0.3;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.08 - 0.1 * jitter(q + 13)) / 0.34), ang = (q / 18) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const p: V3 = [mid[0] + Math.cos(ang) * rx * kk, mid[1] + Math.sin(ang) * rx * kk, 0.1 + u * high * 0.85];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3) chip(g, x, y, 0.035 * big * (1 - 0.3 * u), ang * 2, CHIP[q % 3], swirl);
    else mote(g, x, y, 0.03 * big, DUST[q % 3], swirl);
  }
}

/** Light over it as it evolves: a warm glow of fresh-cut wood as it begins, and over its head at the turn. */
function timberGlow(s: Timb, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], tall = s.torso.z[s.torso.z.length - 1] - s.torso.z[0] + s.hips.r[2] + s.head.r[2];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.chest, [0, 0, s.torso.z[1]]), r: tall, c: [246, 210, 150], a: 0.55 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.head, skullAt(s)), r: tall * 1.2, c: [250, 226, 176], a: k });
  return out;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

function timberKind(s: Timb): Kind {
  const bones = timberBones(s);
  const R = restOf(s);
  const plan = (a: Anim): Plan => planOf(s, R, { ...a, go: a.act ? 0 : a.go });
  return {
    bones,
    build: (lod) => timberBuild(s, lod, plan),
    // The variant's coat is its russet fur and the bark of its plates, its markings the cream of its face, chest and belly. The
    // planks, the log rings, the steel, the moss and the oak are the same on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, pastel(coat, 60), 0.2), cream = mix(mark, [242, 224, 196], 0.25);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [58, 34, 24], 0.36),
        coatLight: mix(fur, [255, 236, 214], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 250, 240], 0.45),
        inner: [232, 176, 156],
        nose: [66, 40, 36],
        lid: [58, 34, 26],
        eye: [22, 14, 12],
        crystalDark: [86, 50, 30],
        glint: [255, 253, 246],
        claw: [50, 34, 28],
        tooth: [250, 242, 222],
        featherDark: [72, 50, 40],
        wood: [216, 174, 116],
        grip: [188, 138, 84],
        woodDark: [124, 82, 50],
        bark: [84, 56, 38],
        shell: [234, 202, 148],
        shellDark: [196, 150, 96],
        moss: [118, 146, 60],
        water: [84, 112, 46],
        leaf: [120, 160, 64],
        leafDark: [82, 124, 50],
        stem: [104, 80, 52],
        metal: [204, 208, 214],
        metalLit: [238, 240, 244],
        metalDark: [132, 138, 150],
      }, 60);
    },
    shadow: s.four ? [s.hips.r[1] * 1.5 + s.tail.len * 0.3, s.hips.r[0] * 1.2] : [s.hips.r[1] * 1.3 + s.tail.len * 0.35, s.hips.r[0] * 1.25 + s.blade.r * 0.6],
    stride: 1.4,
    size: s.size,
    blinks: 4,
    leaps: [false, false],
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are fresh-cut wood's and moss's.
    motes: [[232, 196, 140], [130, 160, 70]],
    glow: (b, a) => timberGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const LOGKIT = timberKind(LOGKIT_LOOK);
export const SAWQUILL = timberKind(SAWQUILL_LOOK);
export const TIMBERBACK = timberKind(TIMBERBACK_LOOK);
