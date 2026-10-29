import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  pastel, scale, shadowOf, smile, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The maple line: the Saplet, a small round squirrel sat up on its haunches,
 * brown with a cream belly and muzzle, a crest of red and orange maple leaves
 * on its head, leaves down its back and a huge bushy tail shingled with them,
 * cream at its tip, holding a little wooden cup of sap; which grows into the
 * Mapletap, bigger and upright, tall ears tufted with leaves and a bigger
 * crest, a harness of vines holding a round glass jar of sap bound in wood on
 * its back, a wooden spout in one paw and its cup in the other; and then the
 * Tapsylvan, large and stout, a mantle of leaves over its shoulders and
 * chest, two great jars at its side and back and a long staff that ends in a
 * crook of a spout, a bundle of leaves tied to it. The species is still
 * `ambra` underneath, as saves and the database know it: it taps trees.
 *
 * Each is its variant's coat on its back, head and limbs and its markings on
 * its belly, muzzle and the tip of its tail; the leaves, the wood, the glass,
 * the vines and the sap are the same on every variant. Built the way the
 * hamster line is (`./wild-hamster`): one set of functions from a description
 * of the stage (`Sap`), each leg bent to put its foot where it is to be, each
 * arm bent to put its paw on what it holds, and what it holds posed in the
 * chest's frame or, at its task, where it is wanted in the world. The tail is
 * one piece on one bone, up behind it and curled over backward, curled
 * further at its tip by bending it within itself (`curled`); its leaves are
 * laid on its skin, each corner of one on the tail's curve, so from behind
 * it is a dome of them.
 *
 * It goes in hops, both feet together, its tail bouncing a beat behind. At its
 * task, at a trunk ahead of it, placed from where the sap is to go
 * (`treeOf`): the Saplet holds its cup up under the spout in the bark to catch
 * the drips; the Mapletap pushes its spout into the bark, fills its cup at it
 * and pours the cup into its jar; the Tapsylvan lets its jar down on its vine
 * to the foot of the trunk, plants the crook of its staff in the bark and the
 * sap runs into the jar (`MAPLE_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** The colours of autumn its leaves come in. */
type Tone = 'red' | 'orange' | 'amber' | 'gold';
/**
 * A leaf of a crest or a tuft: its length and half-width, two angles in degrees and its colour. On a crest (`crown`), how far out
 * from upright it leans and how far round from straight ahead; in a tuft (`plumes`), how far back and how far out to the side.
 */
type Plume = readonly [number, number, number, number, Tone];

interface Sap {
  stage: 0 | 1 | 2;
  /** The hip on the right in the body's frame; thigh, shin and the ankle's height over the sole; how thick each is; the foot's length and width; how far out each foot stands and how far ahead of the hip. */
  leg: { at: V3; len: [number, number, number]; w: [number, number]; foot: [number, number]; stance: number; ahead: number };
  /** How high the hips are carried standing. */
  high: number;
  /** The seat and belly, an egg in the body's frame. */
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
  neck: { at: V3; len: number; w: number };
  /** The skull's half-sizes, how far its middle is over the top of the neck, and how it is pitched. */
  head: { r: V3; up: number; pitch: number };
  /** The muzzle's half-sizes, and how far forward of the skull's front it is pushed. */
  snout: { r: V3; out: number };
  eye: { dir: V3; size: number };
  /** An ear: how long and wide, the way out of the skull it grows from, and how long the leaves tufted behind its tip (nought for none). */
  ear: { len: number; w: number; dir: V3; tuft: number };
  /** The crest of leaves on its crown. */
  crest: readonly Plume[];
  /** The leaves out of each cheek, how long (nought for none). */
  cheek: number;
  /** The leaves round its shoulders and down its back: rows, leaves in the top row, a leaf's length and half-width, how much of its front is left open (radians either side), and how high the top row is in the chest's frame. */
  cape: { rows: number; count: number; len: number; w: number; open: number; top: number; back: number };
  /** Leaves on the outside of each haunch. */
  thigh: number;
  /**
   * The tail, in its own frame from its root on the rump: the points its middle runs through, its half-width and half-depth at
   * each, how far along it the cream of its tip starts, how many rows of leaves are on it and how many round the widest, and a
   * leaf's length and half-width.
   */
  tail: { at: V3; pts: V3[]; w: number[]; d: number[]; tip: number; rows: number; per: number; leaf: [number, number] };
  /** What it holds: its cup in both paws, a spout and its cup, or the staff. */
  hold: 'cup' | 'spile' | 'staff';
  /** The cup: its radius at the rim and how tall. */
  cup: { r: number; h: number };
  /** The spout or the staff: its length below the grip and above it, and the crook's radius at its top. */
  tool: [number, number];
  crook: number;
  /** The jars, each its middle in the chest's frame, its radius, and how far it is tipped out (degrees). */
  jars: ReadonlyArray<{ at: V3; r: number; tilt: number }>;
  /** The vines on it: none, a harness over its shoulder, or that and a belt. */
  harness: 0 | 1 | 2;
  /**
   * The trunk it taps (`treeOf`): its radius and how tall its stub is drawn at least; and, in the world, where the Saplet holds its
   * cup up under the drips and where the Mapletap's spout pours, or how far from its right shoulder the Tapsylvan plants its staff.
   */
  trunk: { r: number; h: number; at: V3 };
  gait: {
    /** How much of a hop its feet are down at a walk and a run; how far they sweep, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a hop lifts it and its feet, against the leg's reach. */
    hop: [number, number]; tuck: number;
  };
  size: number;
}

/** The line of every stage's tail, in the Saplet's size: up from its rump, back, up behind its head and curled over backward. */
const TAIL_LINE = {
  pts: [[0, 0, 0], [0, -0.26, 0.07], [0, -0.5, 0.24], [0, -0.6, 0.48], [0, -0.57, 0.72], [0, -0.57, 0.93], [0, -0.68, 1.1], [0, -0.86, 1.2], [0, -1.02, 1.16]] as V3[],
  w: [0.19, 0.45, 0.66, 0.75, 0.75, 0.68, 0.56, 0.44, 0.28],
  d: [0.17, 0.34, 0.48, 0.53, 0.52, 0.46, 0.41, 0.34, 0.24],
};
/** That tail grown `k` times and `wide` times as wide again, rooted at `at`, with its leaves. */
const tailOf = (k: number, at: V3, o: { tip: number; rows: number; per: number; leaf: [number, number] }, wide = 1): Sap['tail'] =>
  ({ at, pts: TAIL_LINE.pts.map((p) => scale(p, k)), w: TAIL_LINE.w.map((x) => x * k * wide), d: TAIL_LINE.d.map((x) => x * k * Math.sqrt(wide)), ...o });

/** A Saplet: small and round, sat up, a big head and a crest of leaves, its cup held in both paws, and its tail as big as the rest of it. */
const SAPLET_LOOK: Sap = {
  stage: 0,
  leg: { at: [0.22, 0.05, -0.15], len: [0.1, 0.09, 0.035], w: [0.19, 0.11], foot: [0.32, 0.12], stance: 0.24, ahead: 0.16 },
  high: 0.27,
  hips: { c: [0, 0, 0.04], r: [0.44, 0.42, 0.35] },
  chest: { at: [0, 0, 0.1], lean: 2 },
  torso: { z: [-0.1, 0.08, 0.2, 0.28], y: [0.02, 0.04, 0.03, 0], w: [0.4, 0.35, 0.28, 0.21], h: [0.38, 0.33, 0.27, 0.2] },
  shoulder: [0.26, 0.12, 0.16],
  arm: [0.19, 0.18], armW: [0.085, 0.075], hand: 0.07,
  neck: { at: [0, 0.02, 0.26], len: 0.03, w: 0.22 },
  head: { r: [0.55, 0.48, 0.46], up: 0.26, pitch: 4 },
  snout: { r: [0.15, 0.12, 0.1], out: 0.8 },
  eye: { dir: [0.4, 0.84, 0.0], size: 0.11 },
  ear: { len: 0.21, w: 0.16, dir: [0.56, -0.12, 0.82], tuft: 0 },
  crest: [
    [0.74, 0.46, 10, 0, 'red'], [0.6, 0.38, 42, 60, 'orange'], [0.6, 0.38, 42, -60, 'red'],
    [0.54, 0.34, 46, 148, 'red'], [0.54, 0.34, 46, -148, 'orange'], [0.36, 0.24, 38, 20, 'gold'], [0.42, 0.27, 38, 180, 'amber'],
  ],
  cheek: 0,
  cape: { rows: 2, count: 9, len: 0.24, w: 0.15, open: 0.7, top: 0.3, back: 2 },
  thigh: 0,
  tail: tailOf(1, [0, -0.34, -0.06], { tip: 0.74, rows: 7, per: 11, leaf: [0.36, 0.2] }),
  hold: 'cup',
  cup: { r: 0.19, h: 0.22 },
  tool: [0, 0],
  crook: 0,
  jars: [],
  harness: 0,
  trunk: { r: 0.26, h: 1.3, at: [0.18, 0.6, 0.9] },
  gait: { duty: [0.42, 0.34], swing: [0.5, 0.6], hop: [1.6, 2.2], tuck: 0.9 },
  size: 2.9,
};

/** A Mapletap: upright and plump, tall ears tufted with leaves, a crest, a big jar of sap on its back on a harness of vines, a spout and a cup. */
const MAPLETAP_LOOK: Sap = {
  stage: 1,
  leg: { at: [0.32, 0.04, -0.3], len: [0.2, 0.18, 0.05], w: [0.26, 0.13], foot: [0.44, 0.15], stance: 0.36, ahead: 0.16 },
  high: 0.5,
  hips: { c: [0, 0, 0.1], r: [0.74, 0.62, 0.58] },
  chest: { at: [0, 0, 0.2], lean: 3 },
  torso: { z: [-0.1, 0.25, 0.6, 0.9, 1.02], y: [0.04, 0.06, 0.05, 0.02, 0], w: [0.7, 0.62, 0.5, 0.36, 0.27], h: [0.56, 0.52, 0.44, 0.33, 0.24] },
  shoulder: [0.42, 0.06, 0.8],
  arm: [0.36, 0.32], armW: [0.145, 0.125], hand: 0.12,
  neck: { at: [0, 0.02, 0.96], len: 0.05, w: 0.28 },
  head: { r: [0.6, 0.57, 0.53], up: 0.32, pitch: 6 },
  snout: { r: [0.21, 0.22, 0.16], out: 0.76 },
  eye: { dir: [0.44, 0.82, 0.14], size: 0.1 },
  ear: { len: 0.5, w: 0.2, dir: [0.46, -0.2, 0.84], tuft: 0.58 },
  crest: [
    [0.56, 0.3, 10, 0, 'red'], [0.48, 0.26, 40, 70, 'orange'], [0.48, 0.26, 40, -70, 'red'],
    [0.4, 0.22, 44, 160, 'amber'], [0.4, 0.22, 44, -160, 'orange'], [0.3, 0.17, 30, 20, 'gold'],
  ],
  cheek: 0.26,
  cape: { rows: 2, count: 11, len: 0.38, w: 0.2, open: 0.55, top: 0.98, back: 3 },
  thigh: 0,
  tail: tailOf(1.4, [0, -0.52, -0.12], { tip: 0.74, rows: 8, per: 12, leaf: [0.48, 0.27] }, 0.72),
  hold: 'spile',
  cup: { r: 0.2, h: 0.24 },
  tool: [0.22, 0.46],
  crook: 0.17,
  jars: [{ at: [-0.42, -0.5, 1.02], r: 0.48, tilt: 10 }],
  harness: 1,
  trunk: { r: 0.42, h: 2.6, at: [0, 0.74, 1.3] },
  gait: { duty: [0.42, 0.34], swing: [0.5, 0.6], hop: [1.1, 1.6], tuck: 0.7 },
  size: 2.9,
};

/** A Tapsylvan: large and stout, a leaf mantle over its shoulders and chest, two great jars of sap on its back, and its staff. */
const TAPSYLVAN_LOOK: Sap = {
  stage: 2,
  leg: { at: [0.64, 0.04, -0.4], len: [0.28, 0.26, 0.08], w: [0.54, 0.27], foot: [0.78, 0.28], stance: 0.7, ahead: 0.24 },
  high: 0.72,
  hips: { c: [0, 0, 0.12], r: [1.22, 1.0, 0.86] },
  chest: { at: [0, 0, 0.3], lean: 2 },
  torso: { z: [-0.2, 0.35, 0.85, 1.3, 1.55], y: [0.05, 0.08, 0.07, 0.03, 0], w: [1.14, 1.05, 0.88, 0.64, 0.42], h: [0.92, 0.86, 0.74, 0.54, 0.36] },
  shoulder: [0.8, 0.06, 1.2],
  arm: [0.42, 0.4], armW: [0.26, 0.22], hand: 0.2,
  neck: { at: [0, 0.03, 1.5], len: 0.06, w: 0.4 },
  head: { r: [0.7, 0.67, 0.61], up: 0.4, pitch: 6 },
  snout: { r: [0.26, 0.29, 0.2], out: 0.76 },
  eye: { dir: [0.48, 0.8, 0.2], size: 0.09 },
  ear: { len: 0.62, w: 0.26, dir: [0.48, -0.22, 0.82], tuft: 0.72 },
  crest: [
    [0.8, 0.42, 8, 0, 'red'], [0.66, 0.36, 36, 64, 'red'], [0.66, 0.36, 36, -64, 'orange'],
    [0.56, 0.3, 44, 150, 'orange'], [0.56, 0.3, 44, -150, 'red'], [0.4, 0.22, 32, 16, 'gold'], [0.46, 0.25, 40, 180, 'amber'],
  ],
  cheek: 0.4,
  cape: { rows: 2, count: 11, len: 0.76, w: 0.42, open: 0, top: 1.52, back: 3 },
  thigh: 4,
  tail: tailOf(2.1, [0, -0.9, -0.16], { tip: 0.74, rows: 9, per: 14, leaf: [0.72, 0.4] }, 0.68),
  hold: 'staff',
  cup: { r: 0, h: 0 },
  tool: [1.75, 2.1],
  crook: 0.5,
  jars: [{ at: [-1.16, -0.34, 0.62], r: 0.7, tilt: 10 }, { at: [-0.56, -1.16, 1.02], r: 0.72, tilt: 6 }],
  harness: 2,
  trunk: { r: 0.75, h: 3.6, at: [0.2, 0.75, -0.5] },
  gait: { duty: [0.46, 0.38], swing: [0.45, 0.55], hop: [0.6, 0.9], tuck: 0.5 },
  size: 2.9,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A knock ringing out: nothing before, then a swing of `f` a second dying away. */
const ringOut = (since: number, f = 1.6, damp = 2.6): number => (since < 0 ? 0 : Math.exp(-since * damp) * Math.sin(since * TAU * f));
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
const DEG = Math.PI / 180;

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
const colOf = (x: Xf, j: number): V3 => [x.m[j], x.m[3 + j], x.m[6 + j]];

/** An egg with its axes along a frame: anything round that leans or points. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
}
const UPRIGHT: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Each face's material chosen from where its middle is: a coat in patches. */
function painted(m: Mesh, f: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((face) => {
    const c = scale(face.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    return { ...face, m: f(c) };
  }));
}
/** Every face turned to face the other way: the inside of something open. */
const inside = (m: Mesh): Mesh => mesh(m.v, m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

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
/** The torso's ring at height `z` in the chest's frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Sap, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/**
 * A point on the body's skin at height `z` in the chest's frame, `a` radians round from its right side (a quarter turn is its
 * front), lifted `out` off it: on the torso, or on the belly where the belly comes further out.
 */
function onBody(s: Sap, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z), hc = sub(s.hips.c, s.chest.at), [hx, hy] = eggAt(hc, s.hips.r, z);
  const tp: V3 = [Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z];
  const hp: V3 = [Math.cos(a) * hx, hc[1] + Math.sin(a) * hy, z];
  const p = z < s.torso.z[0] || len3([hp[0], hp[1], 0]) > len3([tp[0], tp[1], 0]) ? hp : tp;
  return add(p, scale(unit([Math.cos(a), Math.sin(a), 0]), out));
}
/** The way out of the egg `(c, r)` at `p`, scaled to the egg: (-1..1) on each axis. */
const onEggDir = (c: V3, r: V3, p: V3): V3 => [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];

/* ---- a maple leaf --------------------------------------------------------------------- */

type Lobes = ReadonlyArray<readonly [number, number]>;
/**
 * Half a maple leaf's outline from its stalk to its tip, each corner across (a share of its widest) and along: a small lobe at the
 * stalk, the broad lobe out to the side, the upper lobe, and the middle lobe up to the tip.
 */
const MAPLE: Lobes = [[0.14, 0], [0.5, 0.05], [0.36, 0.2], [1, 0.36], [0.56, 0.46], [0.74, 0.64], [0.3, 0.6], [0.36, 0.8]];
/** Fewer corners, for a leaf drawn small. */
const MAPLE_FAR: Lobes = [[0.48, 0.06], [1, 0.36], [0.52, 0.5], [0.7, 0.66], [0.28, 0.66]];
/** A plain pointed leaf, for the vines. */
const SPRIG: Lobes = [[0.5, 0.2], [0.62, 0.5], [0.36, 0.8]];

/** The face and the back of a leaf of each tone. */
const TONES: Record<Tone, readonly [Mat, Mat]> = { red: ['leafDark', 'featherDark'], orange: ['leaf', 'feather'], amber: ['petal', 'bloom'], gold: ['cap', 'petal'] };
/** A tone picked for the `q`th leaf of a spray, `warm` nought for the reds most and one for the oranges and ambers most. */
const toneOf = (q: number, warm = 0.4): Tone => {
  const j = jitter(q * 3.7 + 1.3) * 0.75 + warm * 0.4;
  return j < 0.36 ? 'red' : j < 0.78 ? 'orange' : j < 0.96 ? 'amber' : 'gold';
};

/**
 * A maple leaf from `root` along `dir`, `len` long and `w` across each side of its rib, its face turned along `face`: two halves
 * either side of the rib, each one face, lifted toward its edge by `fold` so it is a shallow V, and arched along its length.
 * Laid on something (`flat`), only its face; standing free, its back too, in the darker colour of its tone.
 */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, tone: Tone | readonly [Mat, Mat], o: { lobes?: Lobes; fold?: number; arch?: number; flat?: boolean } = {}): Mesh {
  const d = unit(dir), n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n));
  const lobes = o.lobes ?? MAPLE, fold = o.fold ?? 0.25, arch = o.arch ?? 0.08;
  const at = (x: number, y: number): V3 => add(add(add(root, scale(d, y * len)), scale(side, x * w)), scale(n, fold * Math.abs(x) * w + arch * len * Math.sin(Math.PI * y)));
  const right = [at(0, 0), ...lobes.map(([x, y]) => at(x, y)), at(0, 1)];
  const left = [at(0, 1), ...[...lobes].reverse().map(([x, y]) => at(-x, y)), at(0, 0)];
  const [top, back] = typeof tone === 'string' ? TONES[tone] : tone;
  const R = right.length, L = left.length;
  const v: V3[] = o.flat ? [...right, ...left] : [...right, ...left, ...right, ...left];
  const f: Face[] = [{ i: Array.from({ length: R }, (_, k) => k), m: top }, { i: Array.from({ length: L }, (_, k) => R + k), m: top }];
  const want: V3[] = [n, n];
  if (!o.flat) {
    f.push({ i: Array.from({ length: R }, (_, k) => R + L + k), m: back }, { i: Array.from({ length: L }, (_, k) => 2 * R + L + k), m: back });
    want.push(scale(n, -1), scale(n, -1));
  }
  return mesh(v, woundTo(v, f, want));
}

/** A spray of leaves from a root, each `up` degrees back from `axisUp` toward `axisBack` and `out` to the side, faced outward. */
function plumes(root: V3, list: readonly Plume[], axisUp: V3, axisBack: V3, k = 1, lobes: Lobes = MAPLE): Mesh {
  return merge(...list.map(([len, w, up, out, tone], q) => {
    const a = up * DEG, o = out * DEG;
    const inPlane = add(scale(axisUp, Math.cos(a)), scale(axisBack, Math.sin(a)));
    const across = unit(cross(axisBack, axisUp));
    const dir = unit(add(scale(inPlane, Math.cos(o)), scale(across, Math.sin(o))));
    const sd = out < 0 ? -1 : out > 0 ? 1 : q % 2 ? -1 : 1;
    const face = unit(add(add(scale(across, sd * 0.5), scale(axisBack, -0.85)), scale(axisUp, 0.1)));
    return leaf(add(root, scale(across, sd * Math.min(0.04, Math.abs(out) * 0.002))), dir, face, len * k, w * k, tone, { lobes, arch: 0.06 + 0.06 * jitter(q + len) });
  }));
}

/**
 * A crown of leaves from a root: each `up` degrees out from `axis` and turned `round` degrees about it from straight ahead
 * (`ahead`), its face turned out from the axis, so a crown of them shows leaves, not edges, from whichever way it is seen.
 */
function crown(root: V3, list: readonly Plume[], axis: V3, ahead: V3, k = 1, lobes: Lobes = MAPLE): Mesh {
  const Z = unit(axis), Y = unit(sub(ahead, scale(Z, dot(ahead, Z)))), X = cross(Y, Z);
  return merge(...list.map(([len, w, up, round, tone], q) => {
    const a = up * DEG, r = round * DEG;
    const out = add(scale(Y, Math.cos(r)), scale(X, Math.sin(r)));
    const dir = unit(add(scale(Z, Math.cos(a)), scale(out, Math.sin(a))));
    // Faced out from the axis and a little up, so it is seen by its face from its side of the crown.
    const face = unit(add(out, scale(Z, -0.25)));
    return leaf(add(root, scale(out, 0.02)), dir, face, len * k, w * k, tone, { lobes, fold: 0.14, arch: -0.03 - 0.04 * jitter(q + len) });
  }));
}

/* ---- the tail -------------------------------------------------------------------------- */

/** The tail's middle line, sampled: each point, the way along it there, its out-side square to that, its half-width and half-depth, and how far along it is. */
interface Spine { p: V3[]; t: V3[]; n: V3[]; w: number[]; d: number[]; u: number[] }
const spines = new Map<Sap, Spine>();
function spineOf(s: Sap): Spine {
  const had = spines.get(s);
  if (had) return had;
  const T = s.tail, P = T.pts, N = P.length, per = 4;
  const out: Spine = { p: [], t: [], n: [], w: [], d: [], u: [] };
  const X: V3 = [1, 0, 0];
  for (let k = 0; k < N - 1; k++) {
    for (let q = 0; q < (k === N - 2 ? per + 1 : per); q++) {
      const f = q / per, p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(N - 1, k + 2)];
      // Through every point, smoothly: a Catmull-Rom curve.
      const f2 = f * f, f3 = f2 * f;
      const c = (a: number, b: number, cc: number, d: number): number => 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f2 + (-a + 3 * b - 3 * cc + d) * f3);
      out.p.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])]);
      out.w.push(lerp(T.w[k], T.w[k + 1], smooth(f)));
      out.d.push(lerp(T.d[k], T.d[k + 1], smooth(f)));
      out.u.push((k + f) / (N - 1));
    }
  }
  for (let k = 0; k < out.p.length; k++) {
    const t = unit(sub(out.p[Math.min(out.p.length - 1, k + 1)], out.p[Math.max(0, k - 1)]));
    out.t.push(t);
    out.n.push(unit(cross(X, t)));
  }
  spines.set(s, out);
  return out;
}
/** Where on the spine `u` of the way along it is: the sample before it and how far on from it. */
function spineAt(S: Spine, u: number): { p: V3; t: V3; n: V3; w: number; d: number } {
  let k = 0;
  while (k < S.u.length - 2 && S.u[k + 1] < u) k++;
  const f = clamp((u - S.u[k]) / (S.u[k + 1] - S.u[k]));
  return { p: mixV(S.p[k], S.p[k + 1], f), t: unit(mixV(S.t[k], S.t[k + 1], f)), n: unit(mixV(S.n[k], S.n[k + 1], f)), w: lerp(S.w[k], S.w[k + 1], f), d: lerp(S.d[k], S.d[k + 1], f) };
}
/** A point on the tail's skin `u` along it and `th` round it from its right side (a quarter turn is its out-side), and the way out there. */
function onTail(S: Spine, u: number, th: number, lift = 0): { p: V3; n: V3; t: V3 } {
  const q = spineAt(S, u), X: V3 = [1, 0, 0];
  const c = Math.cos(th), sn = Math.sin(th);
  const nrm = unit(add(scale(X, c / q.w), scale(q.n, sn / q.d)));
  return { p: add(add(add(q.p, scale(X, c * q.w)), scale(q.n, sn * q.d)), scale(nrm, lift)), n: nrm, t: q.t };
}
/** How far along the spine a step of `u` goes, at `u`. */
const spineRate = (S: Spine, u: number): number => len3(sub(spineAt(S, Math.min(1, u + 0.02)).p, spineAt(S, Math.max(0, u - 0.02)).p)) / (Math.min(1, u + 0.02) - Math.max(0, u - 0.02));

/**
 * The tail curled: each corner turned about the root by as much more as it is further along, so a flick runs out to its tip and
 * the tip goes furthest. `along` is how far along the tail each corner is; the pose gives how far it flicks back (degrees) and
 * how far it is thrown to its left.
 */
function curled(along: readonly number[], P: (a: Anim) => Plan): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const [, , flick, fling] = P(a).tail;
    if (Math.abs(flick) < 0.05 && Math.abs(fling) < 0.05) return v as V3[];
    return v.map((p, i) => {
      const u = along[i] * along[i];
      const af = -flick * u * DEG, as = fling * u * DEG;
      const cf = Math.cos(af), sf = Math.sin(af), cs = Math.cos(as), ss = Math.sin(as);
      let [x, y, z] = p;
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      [x, y] = [x * cs - y * ss, x * ss + y * cs];
      return [x, y, z] as V3;
    });
  };
}
/** How far along the tail each corner of a mesh is: the nearest point on its spine. */
function alongOf(S: Spine, m: Mesh): number[] {
  return m.v.map((p) => {
    let best = 0, d = Infinity;
    for (let k = 0; k < S.p.length; k++) { const e = len3(sub(p, S.p[k])); if (e < d) { d = e; best = S.u[k]; } }
    return best;
  });
}

/**
 * The tail's own fur: rings along its spine, the coat, the cream of its tip from `tip` on, the cream coming further down its
 * in-side, toward its back, than its out-side, which the leaves cover; its end rounded off.
 */
function tailFur(s: Sap, n: number): Mesh {
  const S = spineOf(s), T = s.tail, sides = n + 4, v: V3[] = [], f: Face[] = [];
  const X: V3 = [1, 0, 0];
  for (let k = 0; k < S.p.length; k++) {
    // Through the cream, every other ring pushed out round its out-side and sides: the points of its fur along its edge.
    const fluff = S.u[k] > T.tip - 0.12 && k % 2 ? 0.3 : 0;
    for (let j = 0; j < sides; j++) {
      const th = ((j + 0.5) / sides) * TAU, out = 1 + fluff * (0.35 + 0.65 * Math.max(0, Math.sin(th))) * (j % 2 ? 1 : 0.7);
      v.push(add(add(S.p[k], scale(X, Math.cos(th) * S.w[k] * out)), scale(S.n[k], Math.sin(th) * S.d[k] * out)));
    }
  }
  for (let k = 0; k < S.p.length - 1; k++) {
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides, th = ((j + 1) / sides) * TAU;
      const cream = S.u[k] >= T.tip - 0.16 * Math.max(0, -Math.sin(th)) - 0.02;
      f.push({ i: [k * sides + j, (k + 1) * sides + j, (k + 1) * sides + j2, k * sides + j2], m: cream ? 'mark' : 'coat' });
    }
  }
  f.push({ i: Array.from({ length: sides }, (_, j) => j), m: 'coat' });
  const want = f.map((face) => {
    const c = scale(face.i.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    let best = 0, d = Infinity;
    for (let k = 0; k < S.p.length; k++) { const e = len3(sub(c, S.p[k])); if (e < d) { d = e; best = k; } }
    return unit(sub(c, S.p[best]));
  });
  want[want.length - 1] = scale(S.t[0], -1);
  // Its end: a dome of cream over the last ring.
  const E = S.p.length - 1, te = S.t[E], ne = S.n[E], we = S.w[E], de = S.d[E], base = (S.p.length - 1) * sides;
  const cap: V3[] = [];
  const rings = 3;
  for (let r = 1; r <= rings; r++) {
    const a = (r / (rings + 0.6)) * (Math.PI / 2), k = Math.cos(a), up = Math.sin(a) * Math.max(we, de) * 0.9;
    for (let j = 0; j < sides; j++) {
      const th = ((j + 0.5) / sides) * TAU;
      cap.push(add(add(add(S.p[E], scale(X, Math.cos(th) * we * k)), scale(ne, Math.sin(th) * de * k)), scale(te, up)));
    }
  }
  const at0 = v.length;
  v.push(...cap, add(S.p[E], scale(te, Math.max(we, de) * 0.95)));
  for (let r = 0; r < rings; r++) {
    const a0 = r === 0 ? base : at0 + (r - 1) * sides, a1 = at0 + r * sides;
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides;
      f.push({ i: [a0 + j, a1 + j, a1 + j2, a0 + j2], m: 'mark' });
      want.push(unit(add(scale(te, 0.5 + r * 0.25), unit(sub(v[a1 + j], S.p[E])))));
    }
  }
  const apex = v.length - 1, last = at0 + (rings - 1) * sides;
  for (let j = 0; j < sides; j++) {
    f.push({ i: [last + j, apex, last + ((j + 1) % sides)], m: 'mark' });
    want.push(te);
  }
  return mesh(v, woundTo(v, f, want));
}

/**
 * One leaf laid on the tail, rooted `u` along it and `th` round it, `len` long and `w` across each side of its rib, pointing up
 * the tail toward its tip and turned `tilt` radians round: every corner put on the tail's skin, so it lies on the tail's curve.
 */
function tailLeaf(S: Spine, u: number, th: number, len: number, w: number, tilt: number, lift: number, tone: Tone, lobes: Lobes): Mesh {
  const rate = spineRate(S, u), q = spineAt(S, u);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const at = (x: number, y: number): V3 => {
    const along = y * len * ct - x * w * st, across = y * len * st + x * w * ct;
    const uu = clamp(u + along / rate, 0, 1), qq = uu === u ? q : spineAt(S, uu);
    const per = Math.hypot(qq.w * Math.sin(th), qq.d * Math.cos(th)) || 1;
    // A rib lifted a little over its edges, so it is a shallow ridge and catches the light either side.
    return onTail(S, uu, th + across / per, lift + 0.18 * w * (1 - Math.abs(x)) * Math.sin(Math.PI * Math.min(1, y * 1.2))).p;
  };
  const right = [at(0, 0), ...lobes.map(([x, y]) => at(x, y)), at(0, 1)];
  const left = [at(0, 1), ...[...lobes].reverse().map(([x, y]) => at(-x, y)), at(0, 0)];
  const v = [...right, ...left], R = right.length, mid = onTail(S, u, th).n;
  const [top] = TONES[tone];
  return mesh(v, woundTo(v, [{ i: right.map((_, k) => k), m: top }, { i: left.map((_, k) => R + k), m: top }], [mid, mid]));
}

/**
 * The leaves on the tail: rows of them shingled from near its root up to the cream of its tip, each laid on its skin and
 * pointing up it, the lower rows over the upper; round its back and sides, and round its front too once it is clear of the
 * body; red low on it and orange and amber higher.
 */
function tailLeaves(s: Sap, fine: boolean): { mesh: Mesh; along: number[] } {
  const S = spineOf(s), T = s.tail, out: Mesh[] = [], along: number[] = [];
  // Drawn small, fewer and bigger, so they are leaves and not a speckle.
  const rows = fine ? T.rows : Math.max(3, Math.round(T.rows * 0.6)), grow = fine ? 1 : 1.3;
  const big = Math.max(...T.w);
  for (let r = rows - 1; r >= 0; r--) {
    const u = lerp(0.05, T.tip + 0.06, r / (rows - 1)), q0 = spineAt(S, u);
    const open = u < 0.42 ? 0.9 : 0.2;
    const round = Math.PI * 2 - 2 * open;
    const count = Math.max(4, Math.round(T.per * (fine ? 1 : 0.62) * (0.45 + 0.55 * ((q0.w + q0.d) / 2 / big))));
    for (let q = 0; q < count; q++) {
      const id = q * 7 + r * 31 + s.stage * 101;
      const th = Math.PI / 2 - round / 2 + ((q + 0.5 + 0.5 * (r % 2)) / count) * round + (jitter(id + 5) - 0.5) * 0.2;
      // Into the cream only up its out-side, so from behind it is leaves nearly to its top.
      if (u > T.tip - 0.04 && Math.sin(th) < 0.35) continue;
      const k = 0.85 + 0.3 * jitter(id);
      const L = T.leaf[0] * k * grow * (r === rows - 1 ? 0.9 : 1), W = T.leaf[1] * k * grow;
      const tilt = (jitter(id + 2) - 0.5) * 0.6;
      const m = tailLeaf(S, u, th, L, W, tilt, 0.012 + 0.006 * (rows - r), toneOf(id, r / (rows - 1)), fine ? MAPLE : MAPLE_FAR);
      out.push(m);
      for (let c = 0; c < m.v.length; c++) along.push(u + 0.5 * L / spineRate(S, u));
    }
  }
  return { mesh: merge(...out), along };
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Saplet's tail slapped down over its head, the Mapletap's spout and the Tapsylvan's staff brought down. */
export const MAPLE_HITS: readonly number[] = [0.52, 0.5, 0.56];
/**
 * A go at its task, as shares of it, by stage. The Saplet's: its cup up under the spout (`up`), each drip into it (`drips`), and
 * down again (`down`). The Mapletap's: its spout pushed into the bark at `pushes`, the sap running into its cup from `run` to
 * `full`, poured into its jar from `pour` to `poured`, and the spout pulled out at `pull`. The Tapsylvan's: its jar let down to
 * the ground by `lower`, its staff's crook planted at `plant`, the sap running into the jar from `flow` to `stop`, and the jar
 * drawn up from `lift`.
 */
export const MAPLE_WORK = {
  up: 0.16, drips: [0.32, 0.5, 0.68] as const, down: 0.84,
  pushes: [0.16, 0.25] as const, run: 0.36, full: 0.58, pour: 0.68, poured: 0.8, pull: 0.88,
  lower: 0.2, plant: 0.3, flow: 0.4, stop: 0.72, lift: 0.78,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** A pose: where each ankle is and how its foot is pitched, how the body, the chest and the head are carried, its paws, what it holds, its tail and ears. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left, past how it is carried. */
  chest: V3;
  /** The neck bent forward and turned left; the head nose-up, turned left and tilted, against level. */
  neck: number[]; head: V3;
  /** Where each paw is when it holds nothing, left then right, in the chest's frame; and how much each is on what it holds. */
  hand: V3[]; on: number[];
  /** The cup: its foot in the chest's frame; where in the world it is wanted, and how much; tipped forward and to its left (degrees); how much it is over the jar. */
  cup: V3; cupW: V3; cupK: number; tip: number[]; pour: number;
  /** The spout or the staff, in the chest's frame: its grip, the way along it and its up; where in the world they are wanted, and how much. */
  grip: V3; dir: V3; up: V3; gripW: V3; dirW: V3; upW: V3; toolK: number;
  /** How far up what it holds its right paw is, from its grip; and how much that paw is on the cup with the other instead. */
  slide: number; both: number;
  /** The first jar taken off: where in the world it is, and how much; and how much the left paw has it on its vine. */
  jarW: V3; jarK: number; rope: number;
  /** The tail: thrown up over its back and swung to its left as a whole (degrees), its tip flicked back and thrown left. */
  tail: number[];
  /** Each ear turned back (degrees). */
  ears: number[];
  /** How full the cup is, and each jar. */
  fill: number[];
}

/** Every number of two like things put together by `f`: how plans are mixed, and how one is moved by as much as another moves. */
function zip<T>(a: T, b: T, f: (x: number, y: number) => number): T {
  if (typeof a === 'number') return f(a, b as unknown as number) as unknown as T;
  if (Array.isArray(a)) return a.map((x, i) => zip(x, (b as unknown as unknown[])[i], f)) as unknown as T;
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(a as object)) o[k] = zip((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], f);
  return o as T;
}
const mixPlan = (a: Plan, b: Plan, k: number): Plan => zip(a, b, (x, y) => lerp(x, y, k));
/** `p` moved by as much as `to` is from `from`, every number of it. */
const shifted = (p: Plan, to: Plan, from: Plan): Plan => zip(p, zip(to, from, (x, y) => x - y), (x, d) => x + d);

interface Rest {
  /** Each ankle standing, along the ground under the hips. */
  ankle: V3[];
  reach: number;
}
const rests = new Map<Sap, Rest>();
function restOf(s: Sap): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3);
  const R: Rest = { ankle, reach: L.len[0] + L.len[1] };
  rests.set(s, R);
  return R;
}

/** The front of the belly at height `z` in the chest's frame, how far forward. */
const frontAt = (s: Sap, z: number): number => onBody(s, z, Math.PI / 2)[1];

/** Where the cup is held standing, its foot in the chest's frame: before the chest in both paws, or before the belly in the left. */
function cupRest(s: Sap): V3 {
  const C = s.cup;
  if (s.stage === 0) { const z = s.torso.z[1]; return [0, frontAt(s, z + C.h * 0.5) + C.r * 1.05, z]; }
  const z = s.torso.z[1] - C.h * 0.2;
  return [-s.shoulder[0] * 0.55, frontAt(s, z) + C.r * 1.3, z];
}
/** The spout held up in the right paw at its side, or the staff planted beside its right foot. */
function toolRest(s: Sap): { grip: V3; dir: V3; up: V3 } {
  const S = s.shoulder, L = s.arm[0] + s.arm[1];
  if (s.hold === 'spile') return { grip: [S[0] + 0.06, S[1] + L * 0.6, S[2] - L * 0.62], dir: unit([0.08, 0.22, 1]), up: [0, 1, 0] };
  if (s.hold === 'staff') return { grip: [S[0] + 0.55, S[1] + L * 0.5, S[2] - L * 0.55], dir: unit([0.1, 0.06, 1]), up: unit([0.6, 0.8, 0]) };
  return { grip: [0, 0, 0], dir: [0, 0, 1], up: [0, 1, 0] };
}
/** Each paw hanging, holding nothing: at its side, a little forward. */
const handRest = (s: Sap): V3[] => [-1, 1].map((sd) => [sd * (s.shoulder[0] + s.armW[0] * 0.6), s.shoulder[1] + s.arm[1] * 0.5, s.shoulder[2] - (s.arm[0] + s.arm[1]) * 0.86] as V3);

function restPlan(s: Sap, R: Rest): Plan {
  const T = toolRest(s);
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0],
    hand: handRest(s), on: [s.hold === 'staff' ? 0 : 1, 1],
    cup: cupRest(s), cupW: [0, 0, 0], cupK: 0, tip: [0, 0], pour: 0,
    grip: [...T.grip], dir: [...T.dir], up: [...T.up], gripW: [0, 0, 0], dirW: [0, 0, 1], upW: [0, 1, 0], toolK: 0,
    slide: 0, both: 0,
    jarW: [0, 0, 0], jarK: 0, rope: 0,
    tail: [0, 0, 0, 0], ears: [0, 0], fill: [0.7, 0.88, 0.84],
  };
}

/**
 * Going: in hops, both feet together, the right a beat behind the left. Down, the feet sweep back under it at the ground's own
 * speed as it crouches and pushes off; in the air they are tucked up and brought forward, the body carried up and over in an
 * arc, pitched forward as it goes up and back as it comes down to land; the tail thrown down as it rises and up as it lands, a
 * beat behind, its tip flicking; the ears flopping back; what it holds kept steady at its chest.
 */
function goingPlan(s: Sap, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = R.reach, half = L * amp;
  let air = 0;
  for (let i = 0; i < 2; i++) {
    const A = R.ankle[i], ph = frac(w - i * 0.03);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      p.foot[i] = -30 * ramp(ph, duty * 0.55, duty);
      continue;
    }
    const u = (ph - duty) / (1 - duty);
    p.at[i] = [A[0], lerp(A[1] - half, A[1] + half, smooth(u)), A[2] + G.tuck * L * Math.sin(Math.PI * u) ** 0.8];
    p.foot[i] = -30 * (1 - ramp(u, 0, 0.35)) + 14 * hump(u, 0.8, 0.2);
    if (i === 0) air = u;
  }
  const down = w < duty ? Math.sin((Math.PI * w) / duty) : 0;
  const up = w >= duty ? Math.sin(Math.PI * air) : 0;
  const hop = lerp(G.hop[0], G.hop[1], g);
  p.H += L * (hop * up - 0.32 * down);
  p.squash = 0.07 * down - 0.04 * up;
  // Pitched forward going up and back coming down.
  const rise = w >= duty ? Math.cos(Math.PI * air) : -1;
  p.pitch = -4 - 4 * g + 6 * down;
  p.chest = [6 + 6 * g + 8 * rise * up + 6 * down, 0, 0];
  p.head = [-4 - 8 * rise * up - 4 * down, 0, 0];
  // The tail a beat behind the body: down as it goes up, thrown up over its back as it lands.
  const lag = Math.sin(TAU * (w - duty - 0.18));
  p.tail = [-6 + 14 * lag, 3 * Math.sin(TAU * w), -12 * lag + 6, 0];
  p.ears = [-12 * up - 6 * g, -12 * up - 6 * g];
  return p;
}

/**
 * Standing about: breathing, the weight shifting, looking about; now and then a flick of its tail, a twitch of an ear, a peek
 * into its cup; its tail swaying.
 */
function stillPlan(s: Sap, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  const w = Math.tanh(2.5 * cyc(t, 3));
  p.chest = [1.5 * (a.breath - 0.5), 6 * look * 0.3, 1.5 * w];
  p.roll = -2 * w;
  p.side = 0.03 * s.leg.len[0] * w;
  p.neck = [0, 5 * look];
  p.head = [3 * cyc(t, 4), 8 * look, 4 * drift(t, 3)];
  p.H += 0.012 * R.reach * (a.breath - 0.5);
  // A flick of its tail: the tip snapped back and over twice, quick.
  const flick = beat(t, [2.6, 11.4, 17.8], 0.9);
  const fl = flick * Math.sin(Math.min(1, flick * 1.4) * TAU * 2);
  p.tail = [3 * cyc(t, 3) + 4 * flick, 4 * cyc(t, 2, 1), 5 * cyc(t, 4, 0.5) + 26 * fl, 8 * fl];
  // An ear twitched, one and then the other.
  const tw0 = beat(t, [4.4, 14.9], 0.35), tw1 = beat(t, [8.1, 20.2], 0.35);
  p.ears = [28 * tw0 * Math.sin(tw0 * Math.PI * 3), 28 * tw1 * Math.sin(tw1 * Math.PI * 3)];
  // A peek into the cup, the head bowed over it.
  if (s.hold !== 'staff') {
    const peek = beat(t, [6.6, 19.1], 1.6);
    p.neck[0] += 10 * peek;
    p.head[0] -= 16 * peek;
    p.cup = add(p.cup, [0, -0.02 * peek, 0.04 * peek]);
  }
  return p;
}

/* ---- its strike ---------------------------------------------------------------------- */

/** Through a run of keys, each a moment and a point, eased from one to the next; held at the first before it and the last after. */
function path(t: number, keys: Array<[number, V3]>): V3 {
  if (t <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) if (t <= keys[q + 1][0]) return mixV(keys[q][1], keys[q + 1][1], smooth((t - keys[q][0]) / Math.max(1e-6, keys[q + 1][0] - keys[q][0])));
  return keys[keys.length - 1][1];
}
/** What it holds through a move: its grip, the way along it and its up, at each key, eased between. */
interface ToolKey { t: number; grip: V3; dir: V3; up?: V3 }
function toolPath(p: Plan, keys: ToolKey[], t: number): void {
  p.grip = path(t, keys.map((k) => [k.t, k.grip] as [number, V3]));
  p.dir = unit(path(t, keys.map((k) => [k.t, k.dir] as [number, V3])));
  p.up = path(t, keys.map((k) => [k.t, k.up ?? p.up] as [number, V3]));
}
/** A point the right paw reaches: from its shoulder along `d`, `k` of the arm's length, in the chest's frame. */
function byRight(s: Sap, d: V3, k = 0.88): V3 {
  return add(s.shoulder, scale(unit(d), (s.arm[0] + s.arm[1]) * k));
}

/**
 * A strike. The Saplet crouches turned away, hops in and whips its great tail up over its head and down on what is before it.
 * The Mapletap swings its spout up over its shoulder and chops it down. The Tapsylvan takes its staff in both paws, heaves it up
 * and slams the crook down ahead of it, its whole weight behind it, its tail flung up.
 */
function strikePlan(s: Sap, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = MAPLE_HITS[s.stage], L = R.reach, T = toolRest(s);
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.16, 0.96));
  const jolt = hump(t, hit + 0.02, 0.07);
  const since = (t - hit) * ACT_SECS.strike;
  if (s.stage === 0) {
    const hop = hump(t, (0.36 + hit) / 2, (hit - 0.36) / 2 + 0.03);
    p.H += L * (-0.4 * wind + 1.1 * hop - 0.3 * jolt);
    p.surge = L * 0.9 * blow;
    p.yaw = 26 * wind - 8 * blow;
    p.chest = [-10 * wind + 24 * blow, 0, 0];
    p.head = [8 * wind - 14 * blow, -10 * wind, 0];
    p.squash = 0.08 * jolt - 0.05 * hop;
    p.tail = [-22 * wind + 92 * blow, -20 * wind, 30 * wind - 20 * blow + 30 * ringOut(since, 2, 4), 0];
    p.cup = add(p.cup, [0, -0.04 * (wind + blow), 0.02]);
    for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 0.9 * blow * ramp(t, hit - 0.04, hit + 0.06), 0]);
  } else if (s.stage === 1) {
    toolPath(p, [
      { t: 0.02, grip: T.grip, dir: T.dir },
      { t: 0.32, grip: byRight(s, [0.3, -0.1, 1], 0.86), dir: unit([0.1, -0.7, 0.7]) },
      { t: 0.38, grip: byRight(s, [0.25, -0.05, 1], 0.88), dir: unit([0.1, -0.8, 0.55]) },
      { t: hit, grip: byRight(s, [0.05, 1, -0.05]), dir: unit([-0.05, 0.75, -0.6]) },
      { t: hit + 0.16, grip: byRight(s, [0.05, 1, -0.1]), dir: unit([-0.05, 0.7, -0.68]) },
      { t: 0.94, grip: T.grip, dir: T.dir },
    ], t);
    p.chest = [-10 * wind + 22 * blow, 12 * wind - 10 * blow, 0];
    p.head = [10 * wind - 14 * blow, -8 * wind, 0];
    p.H += L * (0.1 * wind - 0.16 * blow + 0.5 * hump(t, 0.42, 0.08));
    p.surge = L * 0.5 * blow;
    p.squash = 0.06 * jolt;
    p.tail = [-10 * wind + 30 * blow, 10 * wind, 20 * wind + 24 * ringOut(since, 2, 4), 0];
    p.at[1] = add(p.at[1], [0, L * 0.5 * blow, 0]);
  } else {
    toolPath(p, [
      { t: 0.02, grip: T.grip, dir: T.dir },
      { t: 0.32, grip: byRight(s, [-0.1, 0.25, 1], 0.86), dir: unit([-0.1, -0.35, 1]) },
      { t: 0.38, grip: byRight(s, [-0.1, 0.2, 1], 0.88), dir: unit([-0.1, -0.5, 0.86]) },
      { t: hit, grip: byRight(s, [-0.35, 1, 0.05]), dir: unit([-0.1, 0.85, -0.5]) },
      { t: hit + 0.18, grip: byRight(s, [-0.35, 1, 0]), dir: unit([-0.1, 0.82, -0.55]) },
      { t: 0.94, grip: T.grip, dir: T.dir },
    ], t);
    p.on = [Math.min(1, 2 * (wind + blow)), 1];
    p.chest = [-12 * wind + 28 * blow, 0, 0];
    p.head = [12 * wind - 16 * blow, 0, 0];
    p.H += L * (0.12 * wind - 0.32 * blow - 0.2 * jolt);
    p.surge = L * 0.3 * blow;
    p.squash = 0.1 * jolt;
    p.tail = [-8 * wind + 26 * blow, 0, 16 * wind + 20 * ringOut(since, 1.6, 3), 0];
    p.at[1] = add(p.at[1], [0, L * 0.4 * blow, 0]);
  }
  p.ears = [-30 * wind + 10 * blow, -30 * wind + 10 * blow];
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/** The trunk it taps, in the world: the middle of its foot, how thick and how tall the stub of it is, and the tap on its face. */
interface Tree { at: V3; r: number; h: number; tap: V3 }
/** The Saplet's spout, standing out of the bark: how long. */
const spileOf = (s: Sap): number => s.trunk.r * 0.95;
/** The spout or the staff as it is planted at its task, in the world: its grip, the way along it and its up. */
function plantedOf(s: Sap): { grip: V3; dir: V3; up: V3 } {
  const at = s.trunk.at;
  if (s.stage === 1) {
    // Level, its point into the bark and its crook toward it, bent down: its mouth over `at`.
    const dir = unit([0, -1, 0.04]), up: V3 = [0, 0, -1], Y = unit(sub(up, scale(dir, dot(up, dir)))), d = toolDrip(s);
    return { grip: sub(at, add(scale(dir, d[2]), scale(Y, d[1]))), dir, up };
  }
  // The staff from the right paw, forward of its shoulder, leant toward the trunk with its crook over and into the bark.
  const S = s.shoulder;
  return { grip: add([S[0], S[1], s.high + s.chest.at[2] + S[2]], at), dir: unit([-0.22, 0.6, 0.77]), up: [0, 1, 0] };
}
/** Where a point in the frame of what is planted is, in the world. */
function onPlanted(s: Sap, v: V3): V3 {
  const P = plantedOf(s), Z = P.dir, Y = unit(sub(P.up, scale(Z, dot(P.up, Z))));
  return add(P.grip, add(add(scale(cross(Y, Z), v[0]), scale(Y, v[1])), scale(Z, v[2])));
}
const trees = new Map<Sap, Tree>();
/**
 * The trunk, from where the sap is to come down: the Saplet's spout in its bark with its end over where it holds its cup up;
 * the bark just past the point of the Mapletap's spout; the bark at the mouth of the Tapsylvan's crook.
 */
function treeOf(s: Sap): Tree {
  const had = trees.get(s);
  if (had) return had;
  const T = s.trunk, r = T.r;
  let tap: V3;
  if (s.stage === 0) tap = add(T.at, [0, spileOf(s), spileOf(s) * 0.32]);
  else if (s.stage === 1) tap = onPlanted(s, [0, 0, -s.tool[0] * 0.5]);
  else tap = onPlanted(s, toolDrip(s));
  const tree: Tree = { at: [tap[0], tap[1] + r, 0], r, h: Math.max(T.h, tap[2] + r * 1.6), tap };
  trees.set(s, tree);
  return tree;
}

/**
 * The Saplet's go: its cup held up and out to its right under the end of the spout in the bark, up on its toes and looking up
 * at it; three drips into it, the cup bobbing at each and filling; then down again and a look into it (`MAPLE_WORK`).
 */
function catchPlan(s: Sap, R: Rest, t: number, p: Plan): void {
  const W = MAPLE_WORK, L = R.reach;
  const up = ramp(t, 0.02, W.up) * (1 - ramp(t, W.down - 0.04, W.down + 0.1));
  const drip = Math.max(...W.drips.map((d) => hump(t, d + 0.03, 0.05)));
  p.cupW = add(s.trunk.at, [0, 0, -s.cup.h - 0.14 - 0.03 * drip]);
  p.cupK = up;
  p.H += L * 0.12 * up;
  p.chest = [-6 * up, -8 * up, 0];
  p.neck = [-8 * up, -6 * up];
  p.head = [22 * up - 26 * hump(t, 0.93, 0.08), 10 * up, 0];
  for (const i of [0, 1]) p.foot[i] = -16 * up;
  p.fill[0] = lerp(0.3, 0.9, ramp(t, W.drips[0], W.drips[2] + 0.06));
  p.tail = [6 * up, 0, 10 * hump(t, 0.95, 0.06) + 8 * drip, 0];
  p.ears = [-8 * drip, -8 * drip];
}

/**
 * The Mapletap's go: leant in, its spout pushed into the bark with its right paw, twice, and left there; its cup held up under the
 * spout's mouth in both paws as the sap runs into it; the cup lifted over its left shoulder and poured into the jar on its back;
 * the spout pulled out again (`MAPLE_WORK`).
 */
function tapPlan(s: Sap, R: Rest, t: number, p: Plan): void {
  const W = MAPLE_WORK, L = R.reach, P = plantedOf(s);
  const set = ramp(t, 0.04, W.pushes[0]) * (1 - ramp(t, W.pull, W.pull + 0.1));
  const push = Math.max(hump(t, W.pushes[0], 0.04), hump(t, W.pushes[1], 0.04));
  // Pushed further in at each push: back from where it is planted by as much as it has still to go.
  const into = 0.12 * (1 - ramp(t, W.pushes[0] - 0.03, W.pushes[0] + 0.01) * 0.5 - ramp(t, W.pushes[1] - 0.03, W.pushes[1] + 0.01) * 0.5) + 0.03 * (1 - push);
  p.gripW = add(P.grip, scale(P.dir, into));
  p.dirW = P.dir;
  p.upW = P.up;
  p.toolK = set;
  const lean = ramp(t, 0.04, W.pushes[0] - 0.04) * (1 - ramp(t, W.pushes[1] + 0.04, W.run));
  p.chest = [14 * lean + 6 * push, 0, 0];
  p.surge = L * 0.25 * lean;
  // The right paw on the spout's end while it pushes, then on the cup with the left, then free, then back to pull it out.
  p.slide = s.tool[1];
  const under = ramp(t, W.run - 0.06, W.run) * (1 - ramp(t, W.full, W.full + 0.06));
  p.both = under;
  p.on[1] = Math.max(1 - ramp(t, W.full, W.full + 0.06), ramp(t, W.pull - 0.08, W.pull - 0.02));
  const pour = ramp(t, W.full + 0.02, W.pour) * (1 - ramp(t, W.poured + 0.02, W.poured + 0.1));
  p.cupW = add(s.trunk.at, [0, -0.02, -s.cup.h - 0.2]);
  p.cupK = under;
  p.pour = pour;
  p.tip = [0, 75 * ramp(t, W.pour - 0.03, W.pour + 0.04) * (1 - ramp(t, W.poured, W.poured + 0.08))];
  p.neck = [6 * under, 6 * pour];
  p.head = [-10 * under, 10 * pour, 4 * pour];
  p.fill[0] = lerp(0.12, 0.85, ramp(t, W.run, W.full)) * (1 - ramp(t, W.pour, W.poured)) + 0.12 * (1 - ramp(t, 0, W.run));
  p.fill[1] = lerp(0.55, 0.88, ramp(t, W.pour, W.poured));
  p.tail = [4 * set, 0, 8 * push + 10 * hump(t, W.poured, 0.06), 0];
  p.ears = [-10 * push, -10 * push];
}

/**
 * The Tapsylvan's go: the near jar unhooked from its side and let down on its vine with its left paw to the foot of the trunk;
 * its staff swung up in its right paw and the crook planted in the bark with a push; the sap running out of the bark into the
 * jar; the jar drawn up on its vine and hung back, and the staff drawn back (`MAPLE_WORK`).
 */
function plantPlan(s: Sap, R: Rest, t: number, p: Plan): void {
  const W = MAPLE_WORK, L = R.reach, P = plantedOf(s), tree = treeOf(s), J = s.jars[0];
  const set = ramp(t, W.lower, W.plant) * (1 - ramp(t, W.lift + 0.02, 0.94));
  const push = hump(t, W.plant, 0.05);
  p.gripW = add(P.grip, scale(P.dir, -0.05 * (1 - push)));
  p.dirW = P.dir;
  p.upW = P.up;
  p.toolK = set;
  p.chest = [10 * set + 6 * push, 0, 0];
  p.surge = L * 0.15 * set;
  // The jar on its vine: off its side, swung out and down to the ground before the trunk, and back up at the end.
  const ground: V3 = [tree.tap[0], tree.at[1] - tree.r - J.r - 0.14, J.r * 0.96];
  const away = ramp(t, 0.04, W.lower) * (1 - ramp(t, W.lift, W.lift + 0.12));
  const k = away < 1 ? away : 1;
  p.jarW = add(ground, [0, 0, 1.2 * J.r * Math.sin(Math.PI * k)]);
  p.jarK = k;
  p.rope = ramp(t, 0.02, 0.08) * (1 - ramp(t, W.lift + 0.12, W.lift + 0.18));
  p.hand[0] = add(p.hand[0], [0.1, 0.5 * s.arm[1], 0.5 * s.arm[1] * p.rope]);
  p.on[0] = 0;
  p.neck = [10 * set, 0];
  p.head = [-6 * set - 8 * hump(t, (W.flow + W.stop) / 2, 0.3), -6 * set, 0];
  p.fill[1] = lerp(0.4, 0.9, ramp(t, W.flow, W.stop));
  p.tail = [4 * set, 0, 8 * push + 10 * hump(t, W.stop + 0.08, 0.06), 0];
  p.ears = [-12 * push, -12 * push];
}

/** A go at its task, by stage, eased in from how it stands. */
function workPlan(s: Sap, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R);
  if (s.stage === 0) catchPlan(s, R, t, p);
  else if (s.stage === 1) tapPlan(s, R, t, p);
  else plantPlan(s, R, t, p);
  return mixPlan(restPlan(s, R), p, down);
}

/** Feeding where it stands: a sip from its cup, or, with none, bowed to the ground nibbling. */
function grazePlan(s: Sap, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, nib = Math.sin(t * TAU * 2.4);
  if (s.hold === 'staff') {
    p.chest = [26, 0, 0];
    p.neck = [14, 4 * drift(t, 2)];
    p.head = [-28 + 6 * nib, 6 * drift(t, 2), 0];
    p.H -= 0.12 * R.reach;
    return p;
  }
  const mouth: V3 = [0, s.neck.at[1] + s.head.r[1] * 0.9, s.neck.at[2] + s.neck.len + s.head.up - s.head.r[2] * 0.75];
  p.cup = add(mouth, [0, s.cup.r * 0.6, -s.cup.h * 0.95 + 0.01 * nib]);
  p.tip = [26, 0];
  p.head = [-6 + 2 * nib, 0, 0];
  p.tail = [0, 0, 4 * nib, 0];
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its paws and its tail up, a shake, and settled. */
function evolvePlan(s: Sap, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach;
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * (s.stage === 2 ? 46 : 64));
  p.H += L * (-0.25 * hunch + 0.3 * up);
  p.chest = [14 * hunch - 8 * up, 6 * shake, 0];
  p.neck = [8 * hunch - 6 * up, 0];
  p.head = [-14 * hunch + 22 * up, 0, 14 * shake];
  p.roll = 4 * shake;
  p.squash = 0.06 * hump(t, 0.72, 0.05);
  p.tail = [-10 * hunch + 16 * up, 10 * shake, 20 * up + 16 * shake, 0];
  p.ears = [-20 * hunch + 10 * up, -20 * hunch + 10 * up];
  if (s.hold === 'staff') {
    const top = s.torso.z[s.torso.z.length - 1];
    p.hand[0] = mixV(p.hand[0], [-s.shoulder[0] * 1.3, s.shoulder[1] + 0.1, top + s.arm[0] * 0.9], up);
    p.grip = add(p.grip, [0, 0, 0.3 * up * L]);
  } else p.cup = add(p.cup, [0, 0, 0.5 * up * s.arm[0]]);
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Sap, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
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

/** Two bones bent to put the end of the second at `to` from `from`, the joint between them bowed toward `hint`: the knee or the elbow. */
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

/** A leg bent to put its ankle at `ankle`: the knee forward and a little out, always the same way round; the foot flat, turned a little out. */
function legOf(s: Sap, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.3, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.2 * fwd[1], fwd[1] - sd * 0.2 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The middle of the skull in the head's frame. */
const skullAt = (s: Sap): V3 => [0, 0.02, s.head.up];
/** Where an ear grows from the skull, the right one, in the head's frame. */
const earRoot = (s: Sap): V3 => sub(onEgg(skullAt(s), s.head.r, s.ear.dir).p, scale(unit(s.ear.dir), s.ear.w * 0.3));
/** Where a grip is on the cup: on its side at `sd`, half way up, in its own frame. */
const cupGrip = (s: Sap, sd: number): V3 => [sd * s.cup.r * 0.9, -s.cup.r * 0.4, s.cup.h * 0.45];

/**
 * The bones of a stage: its pose, the hips raised and carried as it says, the chest on them, the neck, the head and each ear, the
 * tail, each leg bent to put its foot where it is to be, the cup and the spout or the staff and the jars where they are held, and
 * each arm bent to put its paw on what it holds, or where it is to be.
 */
function mapleBones(s: Sap): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.chest.lean + P.chest[0];
    const chest = joint(body, s.chest.at, -lean, P.chest[2], P.chest[1]);
    b.chest = chest;
    b.neck = joint(chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    // The head carried level whatever the hips and the chest do under it, then pitched as the pose says.
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    const er = earRoot(s);
    b.ear0 = joint(b.head, [-er[0], er[1], er[2]], -P.ears[0], 0, 0);
    b.ear1 = joint(b.head, er, -P.ears[1], 0, 0);
    b.tail = joint(body, s.tail.at, -P.tail[0], 0, P.tail[1]);
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    for (let i = 0; i < 2; i++) {
      const [u, l, f] = legOf(s, body, i, P.at[i], P.foot[i]);
      const key = i ? 'lr' : 'll';
      b[`${key}0`] = u;
      b[`${key}1`] = l;
      b[`${key}2`] = f;
    }
    const fwd = turn(chest, [0, 1, 0]), level = unit([fwd[0], fwd[1], 0]);
    // The jars on their own bones, the first taken up into the world while it is held.
    s.jars.forEach((J, q) => {
      const rest = compose(chest, joint(ROOT, J.at, 0, -J.tilt, 0));
      if (q === 0 && P.jarK > 0) {
        const k = smooth(P.jarK);
        const [X, Y, Z] = frameOf(mixV(colOf(rest, 2), [0, 0, 1], k), mixV(colOf(rest, 1), level, k));
        b[`jar${q}`] = xfOf(X, Y, Z, mixV(rest.t, P.jarW, k));
      } else b[`jar${q}`] = rest;
    });
    // The cup: upright, its front with the chest, where the pose has it; over the jar's mouth as it pours.
    if (s.cup.r) {
      let at = mixV(place(chest, P.cup), P.cupW, smooth(P.cupK));
      if (P.pour > 0 && b.jar0) at = mixV(at, place(b.jar0, [s.cup.r * 1.3, 0, s.jars[0].r * 1.45]), smooth(P.pour));
      const [X, Y, Z] = frameOf([0, 0, 1], level);
      b.cup = joint(xfOf(X, Y, Z, at), [0, 0, 0], P.tip[0], -P.tip[1], 0);
    }
    // The spout or the staff: along it to its crook, its crook toward its up.
    if (s.hold !== 'cup') {
      const k = smooth(P.toolK);
      const g = mixV(place(chest, P.grip), P.gripW, k);
      const Z = unit(mixV(turn(chest, unit(P.dir)), unit(P.dirW), k)), up = mixV(turn(chest, P.up), P.upW, k);
      const Y = unit(sub(up, scale(Z, dot(up, Z)))), X = cross(Y, Z);
      b.tool = xfOf(X, Y, Z, g);
    }
    // The arms: each bent to put its paw where it is to be, or on what it holds.
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1;
      const free = place(chest, P.hand[i]);
      let on: V3 = free;
      if (s.hold === 'cup' && b.cup) on = place(b.cup, cupGrip(s, sd));
      else if (i === 0 && s.hold === 'spile' && b.cup) on = place(b.cup, cupGrip(s, -1));
      else if (i === 1 && b.tool) on = b.cup ? mixV(place(b.tool, [0, 0, P.slide]), place(b.cup, cupGrip(s, 1)), smooth(P.both)) : place(b.tool, [0, 0, P.slide]);
      else if (i === 0 && b.tool) on = place(b.tool, [0, 0, -(s.arm[0] + s.arm[1]) * 0.4]);
      const want = mixV(free, on, clamp(P.on[i]));
      const sh = place(chest, [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      const { mid: el, end: wr } = bend2(sh, want, s.arm[0], s.arm[1], turn(chest, unit([sd * 0.8, -0.5, -0.4])));
      const [X0, Y0, Z0] = frameOf(sub(sh, el), fwd), [X1, Y1, Z1] = frameOf(sub(el, wr), fwd);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      b[`hand${i}`] = xfOf(X1, Y1, Z1, wr);
    }
    // The trunk it taps, ahead of it on the ground where it stands.
    b.stump = { m: ROOT.m, t: treeOf(s).at };
    return b;
  };
  return (a) => pose(planOf(s, R, { ...a, go: a.act ? 0 : a.go }));
}
/** `b` (in the frame of `a`) followed on from `a`. */
function compose(a: Xf, b: Xf): Xf {
  const cols = [0, 1, 2].map((j) => turn(a, colOf(b, j)));
  return xfOf(cols[0], cols[1], cols[2], place(a, b.t));
}

/* ---- what it is made of ------------------------------------------------------------- */

/**
 * The head: a round skull, the coat over its crown and down its back, cream from under its eyes down and round its throat; a
 * cream muzzle pushed forward with a small pink nose and a smile, cream cheeks either side of it; big round dark eyes.
 */
function headOf(s: Sap, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), R = H.r, E = s.eye;
  const eyeZ = onEgg(C, R, E.dir).p[2] - C[2];
  const skull = painted(orb(C, R, n + 6, k + 4, 'coat'), (c) => {
    const d = onEggDir(C, R, c);
    if (d[2] < -0.55 && d[1] > -0.4) return 'mark';
    if (d[1] > 0.25 && c[2] - C[2] < eyeZ - E.size * (1.1 - 0.5 * Math.abs(d[0]))) return 'mark';
    return 'coat';
  });
  const S = s.snout, mc: V3 = add(C, [0, R[1] * S.out, -R[2] * 0.36]);
  const muzzle = egg(mc, UPRIGHT, S.r, n, k, 'muzzle');
  const nose = egg(add(mc, [0, S.r[1] * 0.9, S.r[2] * 0.5]), UPRIGHT, [S.r[0] * 0.34, S.r[1] * 0.22, S.r[2] * 0.26], 6, 3, 'nose');
  const mouth = smile(add(mc, [0, S.r[1] * 0.86, -S.r[2] * 0.25]), [0, 1, 0.3], S.r[0] * 0.75, 'lid');
  // Its cream cheeks puffed out low either side of the muzzle, a squirrel's.
  const cheeks = merge(...[1, -1].map((sd) => {
    const e = onEgg(C, R, [sd * 0.78, 0.5, -0.42]);
    return egg(sub(e.p, scale(e.n, R[0] * 0.12)), UPRIGHT, [R[0] * 0.3, R[1] * 0.28, R[2] * 0.26], n, k, 'mark');
  }));
  return merge(skull, cheeks, muzzle, nose, mouth, eyesOf(s, shut));
}

/**
 * The eyes: each a dark rim, a big dark-brown iris, a darker middle and two glints, laid onto the skull's own curve; all of an
 * eye out of sight together when the head is between it and the viewer.
 */
function eyesOf(s: Sap, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  const tall = s.stage === 0 ? 1.12 : 1.02;
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'lid', o), 0.018));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.14, r * 1.14 * tall, 12, 'lid', o), 0.016));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystalDark', o), 0.02));
    out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 0.62, r * 0.66 * tall, 10, 'eye', o), 0.024));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36)), scale(across, side * r * 0.28)), n, r * 0.36, r * 0.36, 6, 'glint', { ...o, lit: true }), 0.03));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.44)), scale(across, -side * r * 0.3)), n, r * 0.15, r * 0.15, 5, 'glint', { ...o, lit: true }), 0.03));
  }
  return paint(out);
}

/**
 * An ear, in its own frame from its root, the right one: brown on the back, a pale hollow; the Saplet's small and round, the
 * others' tall and pointed, a tuft of leaves standing up behind the tip.
 */
function earOf(s: Sap, sd: number, n: number, fine: boolean): Mesh {
  const E = s.ear, out = unit([sd * E.dir[0], E.dir[1], E.dir[2]]);
  const up = unit(add(out, [sd * 0.05, 0.05, 0.5])), face = unit(sub([sd * 0.55, 1, 0.1], scale(up, dot([sd * 0.55, 1, 0.1], up))));
  const pointed = E.tuft > 0;
  const us = [0, 0.3, 0.6, 0.85, 1];
  const pts = us.map((u) => scale(up, E.len * u));
  const ws = pointed ? [E.w * 0.75, E.w, E.w * 0.86, E.w * 0.5, E.w * 0.06] : [E.w * 0.7, E.w * 0.98, E.w, E.w * 0.8, E.w * 0.3];
  const shell = tube(pts, ws, ws.map((x) => x * 0.42), n, (ring) => (ring === 0 ? 'coat' : 'coatDark'), { up: face });
  const hollow = tube(pts.slice(1, 4).map((p) => add(p, scale(face, E.w * 0.16))), [E.w * 0.66, E.w * 0.66, E.w * 0.36].map((x, q) => (pointed ? x * [1, 0.86, 0.6][q] : x)), [E.w * 0.1, E.w * 0.1, E.w * 0.06], n, pointed ? 'mark' : 'inner', { up: face });
  if (!pointed) return merge(shell, hollow);
  // The tuft: leaves rooted up the back of it and standing up past its tip, fanned a little, the tallest in the middle; faced
  // the way the ear is, so they are its edge seen from in front and a flame of leaves behind it.
  const back = unit(sub(scale(face, -1), scale(up, dot(scale(face, -1), up))));
  const root = add(scale(up, E.len * 0.3), scale(back, E.w * 0.3));
  const list: Plume[] = fine
    ? [[E.tuft, E.tuft * 0.48, 10, 0, 'red'], [E.tuft * 0.86, E.tuft * 0.42, 6, sd * 30, 'orange'], [E.tuft * 0.8, E.tuft * 0.4, 22, -sd * 24, 'red'], [E.tuft * 0.62, E.tuft * 0.32, 40, sd * 8, 'amber']]
    : [[E.tuft, E.tuft * 0.48, 10, 0, 'red'], [E.tuft * 0.84, E.tuft * 0.42, 14, sd * 28, 'orange']];
  const tuft = plumes(root, list, up, back, 1, fine ? MAPLE : MAPLE_FAR);
  return merge(shell, hollow, tuft);
}

/** The crest on its crown and the leaves out of its cheeks, in the head's frame. */
function crestOf(s: Sap, fine: boolean): Mesh {
  const C = skullAt(s), R = s.head.r;
  const root = onEgg(C, R, [0, s.stage ? 0.32 : 0.16, 1]).p;
  const list = fine ? s.crest : s.crest.filter((_, q) => q < 5);
  const crest = crown(add(root, [0, 0, -R[2] * 0.12]), list, unit([0, -0.12, 1]), [0, 1, 0], 1, fine ? MAPLE : MAPLE_FAR);
  if (!s.cheek) return crest;
  const cheeks = [1, -1].flatMap((sd) => {
    const e = onEgg(C, R, [sd * 0.8, -0.2, -0.3]);
    return [0, 1, ...(fine ? [2] : [])].map((q) => {
      const dir = unit([sd * (0.55 + 0.2 * q), -0.75 + 0.1 * q, 0.1 - 0.35 * q]);
      return leaf(sub(e.p, scale(e.n, 0.03)), dir, unit([sd * 1, 0.2, 0.3]), s.cheek * (1 - 0.18 * q), s.cheek * 0.42 * (1 - 0.15 * q), (['red', 'orange', 'amber'] as const)[q], { lobes: fine ? MAPLE : MAPLE_FAR });
    });
  });
  return merge(crest, ...cheeks);
}

/**
 * The leaves round its shoulders and down its back, in the chest's frame: rows of them each rooted on the skin and lying down
 * over it, the tips lifted, the front left open; on the Tapsylvan a mantle all the way round, over its chest too, gold and
 * amber down its front.
 */
function capeOf(s: Sap, fine: boolean): Mesh {
  const C = s.cape, out: Mesh[] = [];
  for (let row = C.rows - 1; row >= 0; row--) {
    const z0 = C.top - row * C.len * 0.42, count = Math.round((C.count + row * 2) * (fine ? 1 : 0.7));
    const open = C.open + row * 0.12;
    for (let q = 0; q < count; q++) {
      const a = Math.PI / 2 + open + ((q + 0.5 * (row % 2) + 0.5) / count) * (TAU - 2 * open) + (jitter(q + row * 13) - 0.5) * 0.12;
      const front = Math.cos(a - Math.PI / 2);
      const id = q * 5 + row * 23 + s.stage * 7;
      const L = C.len * (0.85 + 0.3 * jitter(id)) * (1 - 0.2 * Math.max(0, front)), W = C.w * (0.85 + 0.3 * jitter(id + 1));
      const root = onBody(s, z0, a, 0.015 + row * 0.012);
      const o = unit([Math.cos(a), Math.sin(a), 0]);
      // Hanging down over the shoulder, out a little where the body widens under it.
      const below = onBody(s, z0 - L, a, 0.03 + row * 0.012);
      const dir = unit(add(sub(below, root), scale(o, L * 0.25)));
      const tone: Tone = front > 0.6 ? toneOf(id, 0.45) : toneOf(id, 0.15);
      out.push(leaf(root, dir, o, L, W, tone, { lobes: fine ? MAPLE : MAPLE_FAR, flat: true, arch: 0.1 }));
    }
  }
  // Rows down its back from under the cape to its rump, bigger, shingled.
  const z1 = C.top - (C.rows - 0.5) * C.len * 0.42, z2 = Math.min(s.torso.z[0], s.hips.c[2] - s.chest.at[2]);
  for (let row = C.back - 1; row >= 0; row--) {
    const z0 = lerp(z1, z2, (row + 0.5) / C.back), count = fine ? 5 : 3;
    for (let q = 0; q < count; q++) {
      const a = -Math.PI / 2 + ((q + 0.5) / count - 0.5) * 2.2 + (row % 2 ? 0.2 : -0.1), id = q * 3 + row * 17 + s.stage * 5 + 300;
      const L = C.len * 1.25 * (0.9 + 0.2 * jitter(id)), W = C.w * 1.25 * (0.9 + 0.2 * jitter(id + 1));
      const root = onBody(s, z0 + L * 0.4, a, 0.03 + (C.back - row) * 0.012), below = onBody(s, z0 - L * 0.6, a, 0.05 + (C.back - row) * 0.012);
      out.push(leaf(root, unit(sub(below, root)), unit([Math.cos(a), Math.sin(a), 0]), L, W, toneOf(id, 0.25), { lobes: fine ? MAPLE : MAPLE_FAR, flat: true, arch: 0.1 }));
    }
  }
  // The Saplet's posy at its collar, a few small leaves at its throat on the right.
  if (s.stage === 0) {
    const z = s.torso.z[s.torso.z.length - 1] - 0.02;
    for (let q = 0; q < 3; q++) {
      const a = Math.PI / 2 - 0.55 + q * 0.32, o = unit([Math.cos(a), Math.sin(a), 0.2]);
      out.push(leaf(onBody(s, z, a, 0.02), unit(add(o, [0, 0, -1.1])), o, C.len * (0.62 - 0.08 * q), C.w * 0.62, (['amber', 'red', 'orange'] as const)[q], { flat: true, lobes: fine ? MAPLE : MAPLE_FAR }));
    }
  }
  return merge(...out);
}

/** The leaves on the outside of a haunch, in the thigh's frame, lying down it. */
function thighLeaves(s: Sap, sd: number, fine: boolean): Mesh {
  const L = s.leg, out: Mesh[] = [], c: V3 = [0, 0, -L.len[0] * 0.3], r: V3 = [L.w[0] * 0.95, L.w[0] * 0.95, L.len[0] * 0.75 + 0.06];
  const count = fine ? s.thigh : Math.ceil(s.thigh / 2);
  for (let q = 0; q < count; q++) {
    const a = (sd > 0 ? 0 : Math.PI) + (q / Math.max(1, count - 1) - 0.5) * 1.6 * sd, e = onEgg(c, r, [Math.cos(a), Math.sin(a), 0.75]);
    out.push(leaf(add(e.p, scale(e.n, 0.01)), unit(add([0, 0, -1], scale(e.n, 0.3))), e.n, s.cape.len * 0.8, s.cape.w * 0.85, toneOf(q * 3 + (sd > 0 ? 50 : 70)), { flat: true, lobes: fine ? MAPLE : MAPLE_FAR }));
  }
  return merge(...out);
}

/** A vine along a line of points: green in twisted bands, a small leaf off it now and then. */
function vine(pts: readonly V3[], r: number, n: number, leaves = 0, face?: (p: V3) => V3): Mesh {
  const out: Mesh[] = [tube(pts, r, r, Math.max(5, n - 3), (ring, j) => ((ring + j) % 3 === 0 ? 'water' : 'moss'))];
  for (let q = 0; q < leaves; q++) {
    const k = Math.min(pts.length - 2, 1 + Math.floor((q + 0.5) * ((pts.length - 2) / leaves)));
    const p = pts[k], d = unit(sub(pts[k + 1], pts[k - 1]));
    const o = face ? face(p) : [0, 0, 1] as V3;
    const side = unit(cross(d, o));
    out.push(leaf(add(p, scale(o, r)), unit(add(scale(side, q % 2 ? 1 : -1), scale(d, 0.4))), o, r * 5, r * 2.2, ['spot', 'moss'], { lobes: SPRIG, flat: true, fold: 0.3 }));
  }
  return merge(...out);
}
/** A vine round the body through points on it, each (height, round from its right, off it) in the chest's frame, a few between each. */
function vineOn(s: Sap, keys: ReadonlyArray<readonly [number, number, number]>, r: number, n: number, closed = false, leaves = 0): Mesh {
  const pts: V3[] = [];
  const list = closed ? [...keys, keys[0]] : keys;
  for (let q = 0; q < list.length - 1; q++) {
    const [z0, a0, o0] = list[q], [z1, a1, o1] = list[q + 1];
    const a1n = closed && q === list.length - 2 ? a1 + TAU * Math.round((a0 - a1) / TAU) : a1;
    for (let u = 0; u < 3; u++) pts.push(onBody(s, lerp(z0, z1, u / 3), lerp(a0, a1n, u / 3), lerp(o0, o1, u / 3)));
  }
  pts.push(onBody(s, ...list[list.length - 1]));
  return vine(pts, r, n, leaves, (p) => unit([p[0], p[1], 0]));
}

/**
 * The harness, in the chest's frame: the Mapletap's vine over its left shoulder and across its chest to its right hip, round its
 * back to the jar, a wooden toggle where it is knotted; the Tapsylvan's over its right shoulder and across to its left hip, where
 * the jars are, and a belt.
 */
function harnessOf(s: Sap, n: number): Mesh {
  const T = s.torso, S = s.shoulder, P = Math.PI / 2, r = [0.02, 0.026, 0.04][s.stage], out: Mesh[] = [];
  const mid = T.z[1];
  if (s.harness >= 1) {
    const sd = s.harness === 1 ? -1 : 1;
    out.push(vineOn(s, [
      [S[2] - 0.12, P + sd * 2.5, 0.06], [S[2] + 0.06, P + sd * 1.9, 0.07], [S[2] + 0.02, P + sd * 1.3, 0.05], [S[2] - 0.12, P + sd * 0.6, 0.04],
      [mid + 0.04, P - sd * 0.2, 0.04], [mid - 0.06, P - sd * 0.9, 0.04], [mid - 0.02, P - sd * 1.6, 0.05], [mid + 0.1, P - sd * 2.4, 0.06], [S[2] - 0.12, P + sd * 2.5 - sd * TAU, 0.06],
    ], r, n, false, 3));
    const knot = onBody(s, mid - 0.02, P - sd * 0.55, 0.06);
    out.push(tube([add(knot, [-0.06 * s.cape.len * 3, 0, 0.02]), add(knot, [0.06 * s.cape.len * 3, 0, -0.02])], r * 1.5, r * 1.5, 6, 'woodDark'));
  }
  return merge(...out);
}

/**
 * A jar, in its own frame from its middle: a round glass jar, a short neck and a wooden stopper with a twig of a handle; four
 * hoops of bent wood over it and one round its middle, vines wound over them with a leaf or two; a glint on the glass.
 */
function jarGlass(r: number, n: number): Mesh {
  return merge(
    painted(orb([0, 0, 0], [r, r, r * 0.96], n + 6, n, 'shell'), (c) => (c[2] < -r * 0.6 ? 'shellDark' : 'shell')),
    tube([[0, 0, r * 0.8], [0, 0, r * 1.1]], r * 0.44, r * 0.44, n + 2, 'shell', { start: false }),
  );
}
/** The sap in a jar, its top cut flat at how full it is (`brimmed`). */
const jarSap = (r: number, n: number): Mesh => painted(orb([0, 0, 0], [r * 0.9, r * 0.9, r * 0.86], n + 6, n, 'crystal'), (c) => (c[2] < -r * 0.4 ? 'ember' : 'crystal'));
function jarFrame(r: number, n: number, fine: boolean): Mesh {
  const out: Mesh[] = [];
  const hoop = (pts: V3[], m0: Mat, m1: Mat, w: number): Mesh => tube(pts, w, w * 0.8, 5, (ring) => (ring % 4 === 0 ? m1 : m0));
  const R = r * 1.02, N = 20;
  // Over the top, from the stopper down to the foot, four ways.
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * Math.PI + Math.PI / 6;
    const pts: V3[] = Array.from({ length: N + 1 }, (_, k) => { const th = -Math.PI / 2 + 0.45 + (k / N) * (TAU - 0.9); return [Math.cos(a) * Math.cos(th) * R, Math.sin(a) * Math.cos(th) * R, Math.sin(th) * R * 0.97]; });
    out.push(hoop(pts.slice(0, N / 2 + 1), 'wood', 'woodDark', r * 0.06));
    out.push(hoop(pts.slice(N / 2), 'wood', 'woodDark', r * 0.06));
  }
  // Round its middle.
  out.push(hoop(Array.from({ length: N + 1 }, (_, k) => [Math.cos((k / N) * TAU) * R * 1.01, Math.sin((k / N) * TAU) * R * 1.01, 0] as V3), 'woodDark', 'bark', r * 0.08));
  // The neck's collar and the stopper, a twig handle in a loop over it.
  out.push(tube([[0, 0, r * 1.02], [0, 0, r * 1.08]], r * 0.5, r * 0.5, n + 2, 'woodDark'));
  out.push(tube([[0, 0, r * 1.06], [0, 0, r * 1.26]], [r * 0.4, r * 0.36], [r * 0.4, r * 0.36], n + 2, 'wood'));
  out.push(tube(Array.from({ length: 9 }, (_, k) => { const th = (k / 8) * Math.PI; return [Math.cos(th) * r * 0.26, 0, r * 1.24 + Math.sin(th) * r * 0.2] as V3; }), r * 0.05, r * 0.05, 5, 'bark'));
  out.push(taper([[0, 0, r * 1.24], [r * 0.06, 0.01, r * 1.48], [r * 0.12, 0.02, r * 1.56]], r * 0.07, r * 0.03, 5, 'bark'));
  // Vines wound over the hoops, round the middle and up a side.
  const wind: V3[] = Array.from({ length: 25 }, (_, k) => { const u = k / 24, th = u * TAU * 1.25 + 0.3, z = Math.sin(u * TAU) * 0.18; return [Math.cos(th) * R * 1.04 * Math.cos(z), Math.sin(th) * R * 1.04 * Math.cos(z), Math.sin(z) * R]; });
  out.push(vine(wind, r * 0.04, n, fine ? 4 : 2, (p) => unit(p)));
  return merge(...out);
}
/** A glint on the glass, high on it toward where it is seen from, and a second, smaller, on its far side. */
function jarGlint(r: number): Mesh {
  return paint([[0.62, 0.62, 0.45], [-0.62, -0.62, 0.45]].map((d) => {
    const n = unit(d as V3);
    return disc(scale(n, r * 0.99), n, r * 0.16, r * 0.26, 7, 'glint', { lit: true, up: [0, 0, 1], spin: 0.4 });
  }));
}

/**
 * The cup, in its own frame from the middle of its foot: a small wooden cup of staves, wider at its rim, a dark band round it and
 * a lip; dark inside; and sap in it, and a run of sap down over its lip on its right.
 */
function cupOf(s: Sap, n: number): Mesh {
  const C = s.cup, sides = n + 4;
  const zs = [0, C.h * 0.15, C.h * 0.6, C.h];
  const rs = [C.r * 0.66, C.r * 0.74, C.r * 0.9, C.r];
  const wall = tube(zs.map((z) => [0, 0, z] as V3), rs, rs, sides, (ring, j) => (ring === 1 ? 'woodDark' : j % 2 ? 'wood' : 'grip'), { end: false });
  const inner = inside(tube(zs.slice(1).map((z) => [0, 0, z] as V3), rs.slice(1).map((r) => r * 0.86), rs.slice(1).map((r) => r * 0.86), sides, 'bark', { start: false, end: false }));
  const lip = tube(Array.from({ length: sides + 1 }, (_, q) => [Math.cos((q / sides) * TAU) * C.r * 0.94, Math.sin((q / sides) * TAU) * C.r * 0.94, C.h] as V3), C.r * 0.08, C.r * 0.08, 4, 'woodDark');
  const run = merge(
    tube([[C.r * 0.98, C.r * 0.1, C.h + 0.005], [C.r * 1.04, C.r * 0.12, C.h * 0.75], [C.r * 0.98, C.r * 0.14, C.h * 0.45]], [C.r * 0.12, C.r * 0.1, C.r * 0.07], [C.r * 0.06, C.r * 0.05, C.r * 0.04], 5, 'ember', { up: [1, 0, 0] }),
    orb([C.r * 0.96, C.r * 0.14, C.h * 0.4], [C.r * 0.09, C.r * 0.09, C.r * 0.12], 6, 4, 'ember'),
  );
  return merge(wall, inner, lip, run);
}
/** The sap in the cup: a flat amber disc, raised to how full it is (`brimmed`). */
function cupSap(s: Sap, n: number): Mesh {
  const C = s.cup, sides = n + 4, r = C.r * 0.88;
  const v: V3[] = Array.from({ length: sides }, (_, q) => [Math.cos((q / sides) * TAU) * r, Math.sin((q / sides) * TAU) * r, C.h]);
  return mesh(v, woundTo(v, [{ i: v.map((_, q) => q), m: 'crystal' }], [[0, 0, 1]]));
}

/**
 * The Mapletap's spout, along its frame's `z` from its grip: a peg of a handle, thinner and pointed at its foot where it goes
 * into the bark, bound with vine at the grip; then a crook bent over toward its `y` and down, a channel to its mouth, sap in it.
 * The Tapsylvan's staff the same, long: from the ground to its crook, gnarled, vine wound up it, a spray of leaves tied under
 * the crook and a bundle of them hanging off a red cord low down.
 */
function toolOf(s: Sap, n: number, fine: boolean): Mesh {
  const [B, A] = s.tool, K = s.crook, out: Mesh[] = [], staff = s.hold === 'staff';
  const r0 = staff ? 0.12 : 0.085, sides = Math.max(5, n - 2);
  // The shaft: from its foot to the top, swelling and thinning a little, knots along it.
  const shaft: V3[] = [[0, 0, -B], [0, 0, -B * 0.6], [staff ? 0.02 : 0, 0, -B * 0.2], [0, 0, A * 0.3], [staff ? -0.02 : 0, 0, A * 0.7], [0, 0, A]];
  out.push(tube(shaft, [r0 * (staff ? 0.85 : 0.4), r0 * 0.95, r0, r0 * 1.05, r0, r0 * 1.05], [r0 * (staff ? 0.85 : 0.4), r0 * 0.95, r0, r0 * 1.05, r0, r0 * 1.05], sides, (ring, j) => ((ring + j) % 4 === 0 ? 'bark' : 'wood'), { seam: 'end' }));
  // The crook: over and down, a quarter turn and a bit, its end cut square: the mouth.
  const crook: V3[] = Array.from({ length: 7 }, (_, k) => { const th = (k / 6) * Math.PI * 0.62; return [0, K - Math.cos(th) * K, A + Math.sin(th) * K]; });
  const last = crook[crook.length - 1], dir = unit(sub(last, crook[crook.length - 2]));
  crook.push(add(last, scale(unit(add(dir, [0, 0.3, -1])), K * 0.9)));
  crook.push(add(crook[crook.length - 1], scale([0, 0.15, -1], K * 0.5)));
  out.push(tube(crook, crook.map((_, k) => r0 * (1.05 + 0.15 * (k / crook.length))), crook.map((_, k) => r0 * (1.05 + 0.15 * (k / crook.length))), sides, (ring, j) => ((ring + j) % 4 === 0 ? 'bark' : 'wood'), { seam: 'start' }));
  // Sap in the mouth, and a run of it down the end.
  const mouth = crook[crook.length - 1];
  out.push(orb(add(mouth, [0, 0, -r0 * 0.4]), [r0 * 0.7, r0 * 0.7, r0 * 0.9], 6, 4, 'ember'));
  out.push(tube([add(crook[crook.length - 3], [r0 * 0.9, 0, 0]), add(crook[crook.length - 2], [r0 * 0.9, 0, 0]), add(mouth, [r0 * 0.7, 0, -r0 * 0.6])], r0 * 0.3, r0 * 0.2, 4, 'ember'));
  // Bindings: vine at the grip, and up the staff.
  out.push(vine([[0, 0, -r0 * 3], [r0 * 1.1, 0, -r0 * 1.5], [0, r0 * 1.1, 0], [-r0 * 1.1, 0, r0 * 1.5], [0, -r0 * 1.1, r0 * 3], [r0 * 1.1, 0, r0 * 4.5]], r0 * 0.32, n));
  if (staff) {
    const wind: V3[] = Array.from({ length: 16 }, (_, k) => { const u = k / 15, z = lerp(-B * 0.75, A * 0.85, u), th = u * TAU * 3; return [Math.cos(th) * r0 * 1.12, Math.sin(th) * r0 * 1.12, z]; });
    out.push(vine(wind, r0 * 0.28, n, fine ? 5 : 2, (p) => unit([p[0], p[1], 0])));
    // A spray of leaves tied under the crook, and a bundle off a red cord low down.
    const tie = A * 0.92;
    out.push(tube([[r0 * 1.15, 0, tie - 0.04], [0, r0 * 1.15, tie], [-r0 * 1.15, 0, tie + 0.04], [0, -r0 * 1.15, tie]], r0 * 0.25, r0 * 0.25, 4, 'tongue'));
    out.push(plumes([0, r0, tie], [[0.36, 0.16, 120, 40, 'red'], [0.3, 0.14, 135, -30, 'orange'], [0.26, 0.12, 100, 0, 'amber']], [0, 0, 1], [0, -1, 0], 1, fine ? MAPLE : MAPLE_FAR));
    const low = -B * 0.42;
    out.push(tube([[r0 * 1.15, 0, low], [0, r0 * 1.15, low + 0.02], [-r0 * 1.15, 0, low], [0, -r0 * 1.15, low - 0.02], [r0 * 1.15, 0, low]], r0 * 0.28, r0 * 0.28, 4, 'tongue'));
    out.push(taper([[0, r0 * 1.2, low], [0, r0 * 1.6, low - 0.1], [0, r0 * 1.5, low - 0.22]], r0 * 0.24, r0 * 0.16, 4, 'tongue'));
    const hang: V3 = [0, r0 * 1.5, low - 0.22];
    out.push(plumes(hang, [[0.34, 0.15, 180, 0, 'orange'], [0.3, 0.13, 160, 28, 'red'], [0.3, 0.13, 160, -28, 'red'], ...(fine ? [[0.24, 0.11, 170, 60, 'amber'] as Plume] : [])], [0, 0, 1], [0, 1, 0], 1, fine ? MAPLE : MAPLE_FAR));
  } else {
    // The spout's foot cut to a point to go into the bark.
    out.push(taper([[0, 0, -B], [0, 0, -B - 0.07]], r0 * 0.4, 0.004, sides, 'woodDark'));
  }
  return merge(...out);
}
/** Where the sap drips off what it holds, in its frame: the lip of the cup, or the mouth of the spout. */
const cupDrip = (s: Sap): V3 => [s.cup.r * 0.98, s.cup.r * 0.14, s.cup.h * 0.3];
function toolDrip(s: Sap): V3 {
  const [, A] = s.tool, K = s.crook, th = Math.PI * 0.62;
  const last: V3 = [0, K - Math.cos(th) * K, A + Math.sin(th) * K];
  return add(add(last, scale(unit([0, Math.sin(th) + 0.3, Math.cos(th) - 1]), K * 0.9)), [0, K * 0.07, -K * 0.62]);
}

/**
 * The trunk it taps, drawn only at its task: a stub of a maple trunk out of the ground, its bark in ridges, roots spreading at its
 * foot, its top broken off; the Saplet's with a spout already in it, which it catches the drips off.
 */
function stumpOf(s: Sap, n: number): Mesh {
  const T = treeOf(s), sides = n + 6, out: Mesh[] = [];
  const zs = [0, T.h * 0.08, T.h * 0.4, T.h * 0.8, T.h];
  const rs = [T.r * 1.3, T.r * 1.08, T.r, T.r * 0.98, T.r * 0.96];
  out.push(tube(zs.map((z) => [0, 0, z] as V3), rs, rs, sides, (_r, j) => (j % 3 === 0 ? 'woodDark' : j % 3 === 1 ? 'bark' : 'grip'), { end: false }));
  // The broken top: pale wood, ragged.
  const top: V3[] = Array.from({ length: sides }, (_, q) => { const a = ((q + 0.5) / sides) * TAU; return [Math.cos(a) * T.r * 0.96, Math.sin(a) * T.r * 0.96, T.h + (jitter(q) - 0.3) * T.r * 0.5]; });
  out.push(mesh(top, woundTo(top, [{ i: top.map((_, q) => q), m: 'stone' }], [[0, 0, 1]])));
  for (let q = 0; q < 4; q++) {
    const a = (q / 4) * TAU + 0.6, d: V3 = [Math.cos(a), Math.sin(a), 0];
    out.push(taper([add(scale(d, T.r * 0.8), [0, 0, T.h * 0.12]), add(scale(d, T.r * 1.35), [0, 0, 0.03]), add(scale(d, T.r * 1.8), [0, 0, 0.0])], T.r * 0.28, T.r * 0.06, 5, 'bark'));
  }
  // The tap: a pale ring of cut bark round it, and the Saplet's spout standing out of it, sap at its end.
  const tap = sub(T.tap, T.at), o = unit([tap[0], tap[1], 0]);
  out.push(paint([disc(add(tap, scale(o, 0.012)), o, T.r * 0.26, T.r * 0.3, 8, 'stone'), disc(add(tap, scale(o, 0.02)), o, T.r * 0.12, T.r * 0.14, 6, 'bark')]));
  if (s.stage === 0) {
    const end = sub(s.trunk.at, T.at), L = spileOf(s);
    out.push(tube([add(tap, scale(o, -0.04)), add(tap, add(scale(o, L * 0.6), [0, 0, -L * 0.12])), add(end, [0, 0, 0.03])], [0.035, 0.03, 0.026], [0.03, 0.026, 0.022], 6, (ring) => (ring ? 'wood' : 'woodDark')));
    out.push(orb(end, [0.026, 0.026, 0.034], 5, 3, 'ember'));
  }
  return merge(...out);
}

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Sap): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];

/** A stage's pieces. */
function mapleBuild(s: Sap, lod: number, P: (a: Anim) => Plan): Piece[] {
  const fine = lod > 0, n = cut(lod, 8, 10), k = cut(lod, 5, 6), pieces: Piece[] = [];
  const hide = headSolids(s);
  const Hc = s.hips.c, Hr = s.hips.r;
  const cream = (c: V3): boolean => { const d = onEggDir(Hc, Hr, c); return d[1] > 0.45 - 0.3 * Math.max(0, -d[2]) || d[2] < -0.8; };
  pieces.push({ key: 'hips', mesh: painted(orb(Hc, Hr, n + 4, k + 2, 'coat'), (c) => (cream(c) ? 'mark' : 'coat')), bone: 'trunk', bias: 0 });
  const T = s.torso;
  const torso = painted(tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n + 2, 'coat', { up: [0, 1, 0] }), (c) => (unit([c[0], c[1] - 0.02, 0])[1] > 0.5 ? 'mark' : 'coat'));
  pieces.push({ key: 'torso', mesh: torso, bone: 'chest', bias: 0.01, after: 'hips', breathes: { c: [0, 0, T.z[1]], k: 0.04 } });
  pieces.push({ key: 'cape', mesh: capeOf(s, fine), bone: 'chest', bias: 0.03, after: ['torso'], lines: false });
  if (s.harness) pieces.push({ key: 'harness', mesh: harnessOf(s, n), bone: 'chest', bias: 0.04, after: ['torso', 'cape'] });
  pieces.push({ key: 'neck', mesh: painted(tube([[0, 0, -0.08], [0, 0, s.neck.len + 0.05]], s.neck.w, s.neck.w * 0.9, n, 'coat'), (c) => (c[1] > 0.04 ? 'mark' : 'coat')), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'crest', mesh: crestOf(s, fine), bone: 'head', bias: 0.19, front: [0, 1, 0], after: 'head' });
  for (const i of [0, 1]) pieces.push({ key: `ear${i}`, mesh: earOf(s, i ? 1 : -1, n, fine), bone: `ear${i}`, bias: 0.19, after: 'head', front: [i ? 1 : -1, 0.6, 0], hide: [{ c: sub(skullAt(s), i ? earRoot(s) : [-earRoot(s)[0], earRoot(s)[1], earRoot(s)[2]]), r: scale(s.head.r, 0.86) }] });
  // The tail, behind it: its fur and the leaves on it, curled together.
  const S = spineOf(s), fur = tailFur(s, n), leaves = tailLeaves(s, fine);
  pieces.push({ key: 'tail', mesh: fur, bone: 'tail', bias: -0.15, lines: false, bent: curled(alongOf(S, fur), P) });
  pieces.push({ key: 'tailLeaves', mesh: leaves.mesh, bone: 'tail', bias: 0.002, after: 'tail', lines: false, bent: curled(leaves.along, P) });
  // Legs: a round furred haunch, a short shin, a long dark hind foot with its toes and claws.
  const L = s.leg;
  for (const key of ['ll', 'lr']) {
    const front: V3 = [0, 1, 0], sd = key === 'lr' ? 1 : -1;
    const thigh = merge(egg([0, 0, -L.len[0] * 0.3], UPRIGHT, [L.w[0] * 0.9, L.w[0] * 1.0, L.len[0] * 0.75 + 0.05], n, k, 'coat'), tube([[0, 0, 0], [0, 0, -L.len[0]]], [L.w[0], L.w[1]], [L.w[0], L.w[1]], n, 'coat', { seam: 'start' }));
    const shin = tube([[0, 0, L.w[1] * 0.5], [0, 0.005, -L.len[1]]], [L.w[1], L.w[1] * 0.85], [L.w[1], L.w[1] * 0.85], n, 'coatDark', { seam: 'start' });
    const fw = L.foot[1], fl = L.foot[0], drop = L.len[2];
    const foot = merge(
      egg([0, fl * 0.22, -drop + fw * 0.4], UPRIGHT, [fw * 0.95, fl * 0.55, fw * 0.5], n, k, 'coatDark'),
      ...[-1, -0.33, 0.33, 1].flatMap((q) => [
        egg([q * fw * 0.6, fl * 0.72, -drop + fw * 0.22], UPRIGHT, [fw * 0.24, fw * 0.32, fw * 0.22], 5, 3, 'coatDark'),
        taper([[q * fw * 0.62, fl * 0.8, -drop + fw * 0.2], [q * fw * 0.66, fl * 0.92, -drop + fw * 0.04]], fw * 0.1, 0.004, 4, 'claw'),
      ]),
    );
    pieces.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, after: ['hips'], front },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['hips', `${key}0`], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.02, after: ['hips', `${key}1`], front },
    );
    if (s.thigh) pieces.push({ key: `${key}leaf`, mesh: thighLeaves(s, sd, fine), bone: `${key}0`, bias: 0.012, after: ['hips', `${key}0`], front: [sd, 0.3, 0] });
  }
  // The jars, each glass, then its sap seen through it, then the wood and vines over it, the glint last.
  s.jars.forEach((J, q) => {
    const key = `jar${q}`, solid = [{ c: [0, 0, 0] as V3, r: [J.r * 0.97, J.r * 0.97, J.r * 0.93] as V3 }];
    const after = ['torso', 'cape', ...(s.harness ? ['harness'] : [])];
    // Over the body on its side of it, under it from the other.
    pieces.push(
      { key: `${key}g`, mesh: jarGlass(J.r, n), bone: key, bias: 0.05 + q * 0.01, after, front: unit([J.at[0], J.at[1], 0]) },
      { key: `${key}s`, mesh: jarSap(J.r, n), bone: key, bias: 0.0005, after: [`${key}g`], bent: brimmed(J.r * 0.86, (a) => P(a).fill[q + 1], 0.86) },
      { key: `${key}f`, mesh: jarFrame(J.r, n, fine), bone: key, bias: 0.001, after: [`${key}s`], hide: solid },
      { key: `${key}l`, mesh: jarGlint(J.r), bone: key, bias: 0.0015, after: [`${key}f`], hide: solid },
    );
  });
  // Arms: a furred upper arm, a forearm, a dark paw with its fingers.
  for (let i = 0; i < 2; i++) {
    const front: V3 = [0, 1, 0], ahead: V3 = [0, 0.5, -0.85];
    const upper = merge(
      egg([0, 0, -s.arm[0] * 0.3], UPRIGHT, [s.armW[0] * 1.3, s.armW[0] * 1.3, s.arm[0] * 0.7], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -s.arm[0]]], [s.armW[0] * 1.1, s.armW[1] * 1.1], [s.armW[0] * 1.1, s.armW[1] * 1.1], n, 'coat', { seam: 'start' }),
    );
    const fore = merge(
      egg([0, 0, 0], UPRIGHT, [s.armW[1] * 1.05, s.armW[1] * 1.05, s.armW[1] * 1.05], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -s.arm[1] + s.hand * 0.5]], [s.armW[1] * 1.05, s.armW[1] * 0.85], [s.armW[1] * 1.05, s.armW[1] * 0.85], n, 'coatDark', { seam: 'both' }),
    );
    const h = s.hand;
    const paw = merge(
      egg([0, 0, -h * 0.2], UPRIGHT, [h * 1.0, h * 0.85, h * 1.05], n, k, 'coatDark'),
      ...[-0.6, -0.2, 0.2, 0.6].map((q) => egg([q * h * 0.9, h * 0.35, -h * 0.95], UPRIGHT, [h * 0.25, h * 0.26, h * 0.36], 4, 3, 'coatDark')),
    );
    const props = ['cupw', 'cuph', 'tool', 'jar0f'];
    pieces.push(
      { key: `arm${i}`, mesh: upper, bone: `arm${i}`, bias: 0.06, after: ['torso', 'cape'], front },
      { key: `fore${i}`, mesh: fore, bone: `elbow${i}`, bias: 0.065, after: ['torso', 'cape', `arm${i}`], front: ahead },
      { key: `hand${i}`, mesh: paw, bone: `hand${i}`, bias: 0.07, after: ['torso', `fore${i}`, ...props], front: ahead },
    );
  }
  if (s.cup.r) {
    pieces.push({ key: 'cupw', mesh: cupOf(s, n), bone: 'cup', bias: 0.066, after: ['torso', 'cape'] });
    pieces.push({ key: 'cuph', mesh: cupSap(s, n), bone: 'cup', bias: 0.067, after: 'cupw', bent: brimmed(s.cup.h, (a) => P(a).fill[0], 0.12, s.cup.h) });
  }
  if (s.hold !== 'cup') pieces.push({ key: 'tool', mesh: toolOf(s, n, fine), bone: 'tool', bias: 0.055, thin: true });
  pieces.push({ key: 'stump', mesh: stumpOf(s, n), bone: 'stump', bias: 0, shown: (a) => a.act?.kind === 'work' });
  return pieces;
}

/**
 * Sap filled to how full the pose says: every corner above its level brought down to it, so its top is flat. `top` is its height
 * full and `low` how far below that it is empty, in its own frame; `from` the level a corner is counted from (nought, its middle).
 */
function brimmed(top: number, full: (a: Anim) => number, low: number, from = 0): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const f = clamp(full(a));
    if (from) {
      // The cup's sap: a disc, raised and lowered whole.
      const z = from - (1 - f) * from * 0.8;
      return v.map((p) => [p[0] * (0.82 + 0.18 * f), p[1] * (0.82 + 0.18 * f), z] as V3);
    }
    const level = lerp(-top * 0.9, top * low, f);
    return v.map((p) => (p[2] > level ? [p[0], p[1], level] as V3 : p as V3));
  };
}

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a pixel is, in the units `g` is drawing in. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const SAP_RGB: RGB = [240, 164, 46];
const SAP_INK: RGB = [150, 78, 24];
const SAP_LIGHT: RGB = [255, 236, 170];
const LEAF_RGB: readonly RGB[] = [[196, 52, 40], [228, 104, 46], [240, 154, 58], [248, 196, 96]];
const GRAVITY = 9;

/** A bead of sap: amber, an inked edge and a light glint, never under a pixel and a bit across; drawn out long as it falls. */
function bead(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, stretch = 1): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.1 * px);
  g.fillStyle = css(SAP_INK, al * 0.9);
  g.beginPath();
  g.ellipse(x, y, r + 0.45 * px, r * stretch + 0.45 * px, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(SAP_RGB, al);
  g.beginPath();
  g.ellipse(x, y, r, r * stretch, 0, 0, TAU);
  g.fill();
  if (r > 1.3 * px) {
    g.fillStyle = css(SAP_LIGHT, al);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.35 * stretch, r * 0.34, 0, TAU);
    g.fill();
  }
}

/** A drip: a bead swelling at `from` and falling from it every `every` seconds, a splash of it where it lands on `floor`. */
function drip(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, t: number, every: number, size: number, front: boolean, floor = 0.01): void {
  const ph = frac(t / every), swell = ramp(ph, 0, 0.7);
  const fall = Math.sqrt((2 * Math.max(0.01, from[2] - floor)) / GRAVITY) / every;
  if (nearSide(from, mid, view) !== front) return;
  if (ph < 0.7) {
    const [x, y] = onScreen(view, add(from, [0, 0, -size * swell * 0.8]));
    bead(g, x, y, size * (0.4 + 0.6 * swell), 1, 1 + 0.35 * swell);
    return;
  }
  const u = (ph - 0.7) / fall;
  const [x0, y0] = onScreen(view, from);
  if (u <= 1) {
    const z = from[2] - 0.5 * GRAVITY * ((ph - 0.7) * every) ** 2;
    const [x, y] = onScreen(view, [from[0], from[1], Math.max(floor, z)]);
    bead(g, x, y, size, 1, 1.5);
    bead(g, x0, y0, size * 0.35, 1);
    return;
  }
  // Landed: a splash spreading and gone.
  const age = (ph - 0.7 - fall) / 0.12;
  if (age < 1) {
    const [x, y] = onScreen(view, [from[0], from[1], floor]);
    g.fillStyle = css(SAP_RGB, 0.8 * (1 - age));
    g.strokeStyle = css(SAP_INK, 0.6 * (1 - age));
    g.lineWidth = pxOf(g);
    g.beginPath();
    g.ellipse(x, y, size * (1 + 1.6 * age), size * (0.5 + 0.8 * age), 0, 0, TAU);
    g.fill();
    g.stroke();
  }
}

/**
 * A stream of sap from `a` to `b`, wavering, as thick as `w`: a band of amber inked at its edges, a light along it. Poured
 * (`arc`), it leaves `a` level and falls away faster and faster to `b`, the way a stream out of a spout does.
 */
function stream(g: CanvasRenderingContext2D, view: View, a: V3, b: V3, w: number, t: number, al: number, arc = false): void {
  if (al <= 0.02) return;
  const N = 10, pts: Array<[number, number]> = [];
  for (let q = 0; q <= N; q++) {
    const u = q / N, p = mixV(a, b, u);
    if (arc) p[2] = a[2] + (b[2] - a[2]) * u * u;
    const [x, y] = onScreen(view, [p[0] + Math.sin(t * 40 + u * 6) * w * 0.15 * u, p[1], p[2]]);
    pts.push([x, y]);
  }
  const px = pxOf(g);
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [c, k] of [[SAP_INK, 1], [SAP_RGB, 0], [SAP_LIGHT, -1]] as Array<[RGB, number]>) {
    g.strokeStyle = css(c, al);
    g.lineWidth = Math.max(px, k > 0 ? w + 1.2 * px : k === 0 ? w : w * 0.3);
    g.beginPath();
    pts.forEach(([x, y], q) => (q ? g.lineTo(x + (k < 0 ? -w * 0.2 : 0), y) : g.moveTo(x + (k < 0 ? -w * 0.2 : 0), y)));
    g.stroke();
  }
  g.restore();
}

/** A vine from `a` to `b`, sagging a little: the Tapsylvan's jar let down on it. */
function vineLine(g: CanvasRenderingContext2D, view: View, a: V3, b: V3, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g), pts: Array<[number, number]> = [];
  for (let q = 0; q <= 8; q++) {
    const u = q / 8, p = mixV(a, b, u);
    pts.push(onScreen(view, [p[0], p[1], p[2] - 0.12 * Math.sin(Math.PI * u)]));
  }
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [c, wd] of [[[52, 66, 34], 3.2], [[112, 146, 66], 1.6]] as Array<[RGB, number]>) {
    g.strokeStyle = css(c, al);
    g.lineWidth = Math.max(px, wd * px);
    g.beginPath();
    pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
  g.restore();
}

/** A little maple leaf flying, five-pointed, its colour and an inked edge. */
function leafBit(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.6 * px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  for (let q = 0; q < 10; q++) {
    const a = (q / 10) * TAU - Math.PI / 2, rr = q % 2 ? r * 0.45 : r * (q === 0 ? 1.1 : 0.9);
    if (q) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.9);
    else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.9);
  }
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.strokeStyle = css(mix(c, [60, 20, 14], 0.6), al);
  g.lineWidth = Math.max(px * 0.8, r * 0.12);
  g.stroke();
  g.restore();
}

/** Leaves thrown from `from`, `since` seconds on, out and up, falling slow and turning; each drawn on its side of the body. */
function flurry(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, size: number, life = 0.9): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.7 * jitter(k + 1));
    // Leaves are slowed by the air: they go out fast, stop, and drift down.
    const tt = (1 - Math.exp(-since * 4)) / 4;
    const p: V3 = [from[0] + Math.cos(a) * sp * tt, from[1] + Math.sin(a) * sp * tt, Math.max(0.02, from[2] + speed * 0.8 * jitter(k + 2) * tt - 0.6 * since * since)];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    leafBit(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), a + since * 9 * (jitter(k + 4) - 0.5), LEAF_RGB[q % 4], 1 - smooth((since - life * 0.6) / (life * 0.4)));
  }
}

/** The idle drip off what it holds: the lip of the cup, the mouth of the spout or the staff. */
function idleDrips(g: CanvasRenderingContext2D, view: View, s: Sap, b: Bones, a: Anim, front: boolean): void {
  const mid = b.chest.t, size = 0.02 + 0.012 * s.stage;
  if (b.tool) drip(g, view, mid, place(b.tool, toolDrip(s)), a.t + 0.7, 2.2, size, front);
  else if (b.cup) drip(g, view, mid, place(b.cup, cupDrip(s)), a.t, 2.6, size, front);
}

/**
 * What a go at its task throws. The Saplet's: drips off the spout in the bark falling into its cup. The Mapletap's: chips of bark
 * as its spout goes in, then a stream of sap from the spout's mouth into its cup, and from its cup into its jar. The
 * Tapsylvan's: chips as its staff bites, then sap running from the spout into the jar it holds.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Sap, b: Bones, a: Anim, P: Plan, t: number, front: boolean): void {
  const W = MAPLE_WORK, mid = b.chest.t, T = ACT_SECS.work, down = downOf(t, a.graze), tree = treeOf(s);
  if (s.stage === 0) {
    const from = s.trunk.at, into = b.cup ? place(b.cup, [0, 0, s.cup.h]) : from;
    if (nearSide(from, mid, view) !== front) return;
    for (const d of W.drips) {
      const u = (t - d) / 0.06;
      const [x0, y0] = onScreen(view, from);
      // Swelling at the spout's end, falling, and a splash in the cup.
      if (u < 0) { if (u > -2.5) bead(g, x0, y0, 0.026 * (0.4 + 0.24 * (2.5 + u)), 1, 1 + 0.2 * (2.5 + u)); continue; }
      if (u > 1.5) continue;
      const p = mixV(from, into, Math.min(1, u * u));
      const [x, y] = onScreen(view, p);
      if (u <= 1) bead(g, x, y, 0.036, 1, 1.6);
      else bead(g, x, y, 0.044 * (1.5 - u) * 2, 1, 0.5);
    }
    return;
  }
  const bite = s.stage === 1 ? W.pushes : [W.plant] as const;
  for (const h of bite) flurry(g, view, mid, add(tree.tap, [0, -0.06, 0.04]), (t - h) * T, front, 4, 11 + Math.round(h * 100), 0.6 + 0.3 * s.stage, 0.03 + 0.01 * s.stage, 0.4);
  if (s.stage === 1 && b.tool && b.cup) {
    const mouth = place(b.tool, toolDrip(s)), cup = place(b.cup, [0, 0, s.cup.h * 0.7]);
    const run = ramp(t, W.run, W.run + 0.04) * (1 - ramp(t, W.full - 0.02, W.full + 0.02)) * down;
    if (nearSide(mouth, mid, view) === front) stream(g, view, mouth, cup, 0.03, t, run);
    // Poured from the cup into the jar.
    const pour = ramp(t, W.pour, W.pour + 0.03) * (1 - ramp(t, W.poured - 0.02, W.poured + 0.02)) * down;
    if (pour > 0 && b.jar0) {
      const lip = place(b.cup, [0, -s.cup.r * 0.9, s.cup.h]), neck = place(b.jar0, [0, 0, s.jars[0].r * 1.1]);
      if (nearSide(lip, mid, view) === front) stream(g, view, lip, neck, 0.03, t, pour, true);
    }
    return;
  }
  if (s.stage === 2 && b.jar0) {
    // Out of the bark where the crook is planted, in an arc down into the jar at the trunk's foot.
    const into = place(b.jar0, [0, 0, s.jars[0].r * 1.1]);
    const run = ramp(t, W.flow, W.flow + 0.04) * (1 - ramp(t, W.stop - 0.03, W.stop + 0.02)) * down;
    if (nearSide(tree.tap, mid, view) === front) stream(g, view, add(tree.tap, [0, -0.04, -0.04]), into, 0.09, t, run, true);
    const hand = b.hand0, loop = place(b.jar0, [0, 0, s.jars[0].r * 1.5]);
    if (nearSide(loop, mid, view) === front) vineLine(g, view, hand.t, loop, clamp(P.rope * 3) * down);
  }
}

/** What a strike throws: leaves shaken off its tail as it slams down, or off its staff and shoulders, and sap flung off. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Sap, b: Bones, t: number, front: boolean): void {
  const since = (t - MAPLE_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t;
  if (since <= 0) return;
  const at = s.stage === 0 ? place(b.tail, spineOf(s).p[spineOf(s).p.length - 1]) : b.tool ? place(b.tool, toolDrip(s)) : mid;
  flurry(g, view, mid, at, since, front, 6 + 2 * s.stage, 5 + s.stage * 13, 1.4 + 0.5 * s.stage, 0.035 + 0.012 * s.stage, 0.6);
  for (let q = 0; q < 5; q++) {
    const k = q * 5 + s.stage, a = jitter(k) * TAU, sp = 1.4 * (0.5 + jitter(k + 1));
    const p: V3 = [at[0] + Math.cos(a) * sp * since, at[1] + Math.sin(a) * sp * since, at[2] + 1.5 * since - 4.5 * since * since];
    if (p[2] < 0 || since > 0.4 || nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    bead(g, x, y, 0.02 + 0.01 * s.stage, 1 - since / 0.4, 1.2);
  }
}

/** Evolving: a burst of leaves off it, then leaves spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Sap, b: Bones, t: number, front: boolean): void {
  const mid = b.chest.t, big = 0.7 + 0.3 * s.stage;
  if (t < 0.3) flurry(g, view, mid, place(b.chest, [0, 0, s.torso.z[1]]), t * ACT_SECS.evolve, front, 10, 3, 1.4 * big, 0.04 * big, 0.6);
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = s.hips.r[0] * 1.8 + 0.2, high = s.torso.z[s.torso.z.length - 1] + s.high + s.head.up * 2;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32), ang = (q / 18) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const p: V3 = [mid[0] + Math.cos(ang) * rx * kk, mid[1] + Math.sin(ang) * rx * kk, 0.1 + u * high * 0.85];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3) leafBit(g, x, y, 0.06 * big * (1 - 0.3 * u), ang * 2, LEAF_RGB[q % 4], swirl);
    else bead(g, x, y, 0.035 * big * (1 - 0.4 * u), swirl * ramp(u, 0, 0.15), 1.1);
  }
}

/** Light over it as it evolves: a warm amber glow as it begins, and over its head at the turn. */
function mapleGlow(s: Sap, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], tall = s.torso.z[s.torso.z.length - 1] - s.torso.z[0] + s.hips.r[2];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.chest, [0, 0, s.torso.z[1]]), r: tall, c: [250, 200, 120], a: 0.55 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.head, skullAt(s)), r: tall * 1.2, c: [252, 222, 160], a: k });
  return out;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the sap and leaves it throws about as it works, strikes and evolves. */
function mapleKind(s: Sap): Kind {
  const bones = mapleBones(s);
  const R = restOf(s);
  const plan = (a: Anim): Plan => planOf(s, R, { ...a, go: a.act ? 0 : a.go });
  return {
    bones,
    build: (lod) => mapleBuild(s, lod, plan),
    // The variant's coat is its brown, kept warm; its markings the cream of its belly, muzzle and tail tip. Its leaves, the wood,
    // the glass, the vines and the sap are the same on every variant.
    palette: (coat, mark) => {
      const brown = mix(coat, pastel(coat, 60), 0.25), cream = mix(mark, [238, 218, 190], 0.25);
      return coatPalette(coat, mark, {
        coat: brown,
        coatDark: mix(brown, [52, 30, 22], 0.32),
        coatLight: mix(brown, [255, 240, 220], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 252, 244], 0.45),
        inner: [236, 178, 160],
        nose: [232, 132, 136],
        lid: [62, 36, 26],
        eye: [24, 14, 12],
        crystalDark: [74, 44, 30],
        glint: [255, 253, 246],
        claw: [54, 36, 30],
        leafDark: [184, 38, 36],
        featherDark: [136, 30, 30],
        leaf: [218, 82, 32],
        feather: [170, 58, 28],
        petal: [232, 132, 38],
        bloom: [196, 100, 32],
        cap: [240, 176, 66],
        moss: [108, 140, 62],
        water: [72, 102, 50],
        spot: [132, 168, 76],
        wood: [150, 104, 62],
        woodDark: [110, 74, 46],
        grip: [128, 88, 54],
        bark: [88, 58, 40],
        stone: [222, 186, 132],
        shell: [240, 232, 208],
        shellDark: [204, 188, 152],
        crystal: [246, 176, 58],
        ember: [222, 132, 36],
        tongue: [200, 50, 42],
      }, 60);
    },
    shadow: [s.hips.r[1] * 1.3 + s.tail.w[3] * 0.6, s.hips.r[0] * 1.2 + (s.jars.length ? s.jars[0].r * 0.6 : 0)],
    stride: 1.4,
    size: s.size,
    blinks: 4,
    leaps: [true, true],
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are a red leaf's and amber sap's.
    motes: [[214, 72, 44], [244, 178, 70]],
    glow: (b, a) => mapleGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBurst(g, view, s, b, a, plan(a), act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
      if (act?.kind !== 'work' && act?.kind !== 'evolve') idleDrips(g, view, s, b, a, front);
    },
  };
}

export const SAPLET = mapleKind(SAPLET_LOOK);
export const MAPLETAP = mapleKind(MAPLETAP_LOOK);
export const TAPSYLVAN = mapleKind(TAPSYLVAN_LOOK);
