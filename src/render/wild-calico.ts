import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  pastel, scale, shadowOf, smile, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The calico line: the Sprigkit, a small round calico kitten up on its hind
 * legs -- cream, with orange and dark brown patches, pink inside its ears,
 * dark paws, its eyes shut in a happy smile -- in a woven circlet of leaves
 * with a white flower in it, a capelet of leaves on its shoulders, a braided
 * rope belt with leaves hung from it and a flower tucked into it at the root
 * of its big fluffy striped tail, dark at the tip; which grows into the
 * Bloomwhisk, bigger, under a hood of leaves and a circlet with a flower, a
 * capelet of leaves and a skirt of them to its knees from a braided gold
 * sash and its tassels, a flower at its chest, one paw up in a wave; and
 * then the Floramane, large and very stout, a circlet of flowers, a great
 * mantle of leaves over its shoulders with flowers in it, a cream robe
 * embroidered in leaves with gold-edged lapels, a braided rope across its
 * chest and at its belt with big tassels, a skirt of leaves to the ground
 * with an embroidered panel down its front, and an enormous striped tail. The
 * species is still `bedda` underneath, as saves and the database know it: it
 * keeps your planters.
 *
 * Each is its variant's markings for its cream and its coat for the orange
 * patches, the dark brown patches a deep shade of the coat; the patches are
 * the same on every stage, so a Floramane is the Sprigkit it was. All three
 * are built by one set of functions from a description of the stage (`Cat`),
 * the way the mend line is (`./wild-mend`): its legs bent to put each foot
 * where it is to be, its arms bent to put its paws where they are to be, in
 * the chest's frame or on the ground in front of it. It waddles, rolled over
 * onto each foot, its tail swinging against its hips.
 *
 * At its task each stage has a planter box in front of it: the Sprigkit pats
 * the soil, takes a seed from its belt, pops it in and pats it down, and a
 * sprout comes up; the Bloomwhisk takes a little watering jug from its sash,
 * waters a sprout as it grows, cups it in its paw and it blooms; the
 * Floramane bends to a big white bloom, plucks it, tucks it into its mantle,
 * and a new one grows (`CAT_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Cat {
  stage: 0 | 1 | 2;
  /** The hip on the right in the hips' frame; thigh, shin and the ankle's height over the sole; how thick each is; the foot's length and width; how far out each foot stands and how far ahead of the hip. */
  leg: { at: V3; len: [number, number, number]; w: [number, number]; foot: [number, number]; stance: number; ahead: number };
  /** How high the hips are carried standing. */
  high: number;
  /** The seat and belly, an egg in the hips' frame. */
  hips: { c: V3; r: V3 };
  /** The chest's joint on the hips. */
  chest: V3;
  /** The torso's rings in the chest's frame, bottom to top: how high, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** The shoulder on the right in the chest's frame; upper arm and forearm; how thick each; the paw's size. */
  shoulder: V3;
  arm: [number, number];
  armW: [number, number];
  hand: number;
  neck: { at: V3; len: number; w: number };
  /** The skull's half-sizes, how far its middle is over the top of the neck, and how far nose-up it is carried. */
  head: { r: V3; up: number; pitch: number };
  /** The way out of the head to the right eye, and how wide a shut eye's curve is. */
  eye: { dir: V3; size: number };
  ear: { len: number; w: number };
  /**
   * The tail: its root on the hips, each link's length and its girth at each joint, how far each link bends up from the one before
   * it (degrees, the first from straight back), how far it is swung out to the right at its root, and how far each of its last
   * three links hooks out sideways, so its tip curls out to the side rather than back over the viewer behind it.
   */
  tail: { at: V3; links: number[]; w: number[]; bend: number[]; side: number; hook: number };
  /** Where its belt is on the hips. */
  belt: number;
  /** The leaves over its shoulders, in the chest's frame: how far down they come, how many rows, how many leaves round, how wide a leaf, how much of its front is left open at the top row and at the bottom (radians either side), and how far out the lowest leaves flare. */
  cape: { to: number; rows: number; count: number; w: number; open: [number, number]; flare: number };
  /** The leaves hung from its belt: how far down, how many rows, how many round, how wide, and how much of its front is left open. */
  skirt: { len: number; rows: number; count: number; w: number; open: number };
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the hips sink at each footfall; how far it rolls and sways over each foot. */
    step: number; bob: number; roll: number; sway: number;
  };
  size: number;
}

/** A Sprigkit: small and round, a big head, short legs, a capelet of leaves and a tail as tall as it is. */
const SPRIGKIT_LOOK: Cat = {
  stage: 0,
  leg: { at: [0.26, 0.04, -0.14], len: [0.18, 0.16, 0.07], w: [0.22, 0.17], foot: [0.32, 0.18], stance: 0.27, ahead: 0.1 },
  high: 0.42,
  hips: { c: [0, 0.03, 0.12], r: [0.64, 0.56, 0.5] },
  chest: [0, 0, 0.18],
  torso: { z: [-0.1, 0.14, 0.34, 0.5, 0.6], y: [0.03, 0.04, 0.03, 0.01, -0.01], w: [0.62, 0.57, 0.47, 0.34, 0.2], h: [0.54, 0.5, 0.41, 0.3, 0.18] },
  shoulder: [0.4, 0.04, 0.38],
  arm: [0.25, 0.23], armW: [0.13, 0.12], hand: 0.12,
  neck: { at: [0, 0.02, 0.54], len: 0.06, w: 0.24 },
  head: { r: [0.64, 0.55, 0.5], up: 0.36, pitch: 8 },
  eye: { dir: [0.34, 0.88, 0.14], size: 0.12 },
  ear: { len: 0.36, w: 0.27 },
  tail: { at: [0, -0.46, -0.06], links: [0.22, 0.22, 0.22, 0.21, 0.2, 0.19, 0.17], w: [0.18, 0.3, 0.38, 0.42, 0.42, 0.38, 0.28, 0.1], bend: [-8, 28, 26, 16, 4, -6, -14], side: 34, hook: 18 },
  belt: -0.04,
  cape: { to: 0.12, rows: 2, count: 15, w: 0.15, open: [0.42, 0.62], flare: 0.08 },
  skirt: { len: 0.18, rows: 1, count: 11, w: 0.12, open: 0.55 },
  gait: { duty: [0.6, 0.4], swing: [0.55, 0.5], step: 0.5, bob: 0.07, roll: 9, sway: 0.06 },
  size: 2.45,
};

/** A Bloomwhisk: bigger, standing, a hood of leaves, a robe of leaves to its knees, a gold sash with tassels. */
const BLOOMWHISK_LOOK: Cat = {
  stage: 1,
  leg: { at: [0.3, 0.03, -0.16], len: [0.33, 0.3, 0.1], w: [0.24, 0.18], foot: [0.4, 0.2], stance: 0.34, ahead: 0.08 },
  high: 0.74,
  hips: { c: [0, 0.04, 0.12], r: [0.72, 0.62, 0.56] },
  chest: [0, 0, 0.16],
  torso: { z: [-0.1, 0.2, 0.46, 0.66, 0.76], y: [0.04, 0.06, 0.04, 0.01, -0.01], w: [0.7, 0.64, 0.52, 0.36, 0.21], h: [0.6, 0.56, 0.45, 0.31, 0.19] },
  shoulder: [0.44, 0.04, 0.54],
  arm: [0.34, 0.31], armW: [0.14, 0.13], hand: 0.13,
  neck: { at: [0, 0.02, 0.7], len: 0.07, w: 0.24 },
  head: { r: [0.66, 0.57, 0.53], up: 0.38, pitch: 10 },
  eye: { dir: [0.34, 0.88, 0.14], size: 0.13 },
  ear: { len: 0.42, w: 0.3 },
  tail: { at: [0, -0.44, -0.08], links: [0.26, 0.26, 0.26, 0.25, 0.24, 0.22, 0.2], w: [0.17, 0.28, 0.34, 0.36, 0.36, 0.33, 0.26, 0.09], bend: [-2, 26, 26, 18, 4, -6, -14], side: 36, hook: 18 },
  belt: 0.0,
  cape: { to: 0.16, rows: 3, count: 13, w: 0.2, open: [0.32, 0.6], flare: 0.1 },
  skirt: { len: 0.5, rows: 2, count: 13, w: 0.2, open: 0.62 },
  gait: { duty: [0.6, 0.4], swing: [0.45, 0.45], step: 0.42, bob: 0.07, roll: 8, sway: 0.06 },
  size: 3.2,
};

/** A Floramane: large and very stout, a great leaf mantle, a cream robe, a skirt of leaves to the ground, an enormous tail. */
const FLORAMANE_LOOK: Cat = {
  stage: 2,
  leg: { at: [0.56, 0.04, -0.3], len: [0.32, 0.28, 0.13], w: [0.42, 0.34], foot: [0.66, 0.36], stance: 0.6, ahead: 0.12 },
  high: 0.66,
  hips: { c: [0, 0.08, 0.42], r: [1.36, 1.12, 0.9] },
  chest: [0, 0, 0.5],
  torso: { z: [-0.2, 0.3, 0.78, 1.16, 1.36], y: [0.08, 0.11, 0.07, 0.02, -0.02], w: [1.38, 1.36, 1.16, 0.82, 0.4], h: [1.1, 1.08, 0.92, 0.64, 0.32] },
  shoulder: [1.14, 0.04, 0.98],
  arm: [0.56, 0.52], armW: [0.31, 0.28], hand: 0.26,
  neck: { at: [0, 0.06, 1.3], len: 0.1, w: 0.46 },
  head: { r: [0.8, 0.69, 0.63], up: 0.44, pitch: 14 },
  eye: { dir: [0.34, 0.88, 0.16], size: 0.14 },
  ear: { len: 0.46, w: 0.34 },
  tail: { at: [0, -1.02, 0.1], links: [0.42, 0.42, 0.42, 0.41, 0.4, 0.38, 0.36, 0.32], w: [0.36, 0.58, 0.72, 0.8, 0.82, 0.8, 0.72, 0.56, 0.16], bend: [6, 24, 22, 18, 10, 2, -8, -14], side: 40, hook: 18 },
  belt: 0.62,
  cape: { to: 0.74, rows: 3, count: 16, w: 0.42, open: [0.3, 0.5], flare: 0.56 },
  skirt: { len: 1.22, rows: 3, count: 15, w: 0.3, open: 0.45 },
  gait: { duty: [0.62, 0.42], swing: [0.34, 0.36], step: 0.28, bob: 0.08, roll: 6, sway: 0.07 },
  size: 3.05,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** Held at one from `a` to `b`, eased in and out over `e` either side. */
const held = (t: number, a: number, b: number, e: number): number => ramp(t, a - e, a) * (1 - ramp(t, b, b + e));
/** A knock ringing out: nothing before, then a swing of `f` a second dying away. */
const ringOut = (since: number, f = 1.6, damp = 2.6): number => (since < 0 ? 0 : Math.exp(-since * damp) * Math.sin(since * TAU * f));
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
/** A direction or point in the world taken into the frame `x`. */
const backDir = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]; };
const backPt = (x: Xf, p: V3): V3 => backDir(x, sub(p, x.t));
/** `b` (in the frame of `a`) followed on from `a`. */
function compose(a: Xf, b: Xf): Xf {
  const cols = [0, 1, 2].map((j) => turn(a, [b.m[j], b.m[3 + j], b.m[6 + j]]));
  return xfOf(cols[0], cols[1], cols[2], place(a, b.t));
}
/** Two frames mixed, `k` of the way from `a` to `b`, kept square. */
function blendXf(a: Xf, b: Xf, k: number): Xf {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const col = (x: Xf, j: number): V3 => [x.m[j], x.m[3 + j], x.m[6 + j]];
  const [X, Y, Z] = frameOf(mixV(col(a, 2), col(b, 2), k), mixV(col(a, 1), col(b, 1), k));
  return xfOf(X, Y, Z, mixV(a.t, b.t, k));
}
/** A frame made `k` times bigger, nought for a thing not there. */
const scaled = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k), m = x.m; return { m: [m[0] * q, m[1] * q, m[2] * q, m[3] * q, m[4] * q, m[5] * q, m[6] * q, m[7] * q, m[8] * q], t: x.t }; };
/** An egg with its axes along a frame: anything round that leans or points. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
}
const UPRIGHT: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Each face wound so it faces away from `mid`, whichever way round it was listed. */
function wound(v: readonly V3[], f: Face[], mid: V3): Face[] {
  for (const face of f) {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    const o: V3 = [cx / idx.length - mid[0], cy / idx.length - mid[1], cz / idx.length - mid[2]];
    if (nx * o[0] + ny * o[1] + nz * o[2] < 0) idx.reverse();
  }
  return f;
}

/** A block `r` (half-sizes) along the frame's three axes: a plank, a box. */
function block(c: V3, r: V3, f: [V3, V3, V3], mat: Mat | ((side: number) => Mat)): Mesh {
  const [X, Y, Z] = f, v: V3[] = [];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1]) v.push(add(c, add(add(scale(X, sx * r[0]), scale(Y, sy * r[1])), scale(Z, sz * r[2]))));
  const m = (q: number): Mat => (typeof mat === 'function' ? mat(q) : mat);
  const f6: Face[] = [
    { i: [0, 2, 3, 1], m: m(0) }, { i: [4, 5, 7, 6], m: m(1) }, { i: [0, 1, 5, 4], m: m(2) },
    { i: [2, 6, 7, 3], m: m(3) }, { i: [0, 4, 6, 2], m: m(4) }, { i: [1, 3, 7, 5], m: m(5) },
  ];
  return mesh(v, wound(v, f6, c));
}

/** A flat painted shape through `pts`, wound so it faces along `n`. */
function facingDisc(pts: V3[], n: V3, m: Mat, at?: V3): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, at };
}

/** A sheet through a grid of points (rows of columns), both sides of it, so it shows from in front and behind: a panel of cloth. */
function sheet(rows: V3[][], mat: Mat, back: Mat): Mesh {
  const v: V3[] = [], f: Face[] = [], C = rows[0].length;
  for (const row of rows) v.push(...row);
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < C - 1; c++) {
    const q = [r * C + c, r * C + c + 1, (r + 1) * C + c + 1, (r + 1) * C + c];
    f.push({ i: q, m: mat });
    f.push({ i: [...q].reverse(), m: back });
  }
  return mesh(v, f);
}

/** Where the egg `(c, r)` is cut by the level `z`: its half across and half deep there, nought above or below it. */
function eggCut(c: V3, r: V3, z: number): [number, number] {
  const u = 1 - ((z - c[2]) / r[2]) ** 2;
  if (u <= 0) return [0, 0];
  const f = Math.sqrt(u);
  return [r[0] * f, r[1] * f];
}

/** The torso's ring at height `z` in the chest's frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Cat, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/** The body at height `z` in the chest's frame, the torso or the belly under it, whichever is the wider there. */
function bodyAt(s: Cat, z: number): { w: number; h: number; y: number } {
  const T = s.torso, t = z >= T.z[0] && z <= T.z[T.z.length - 1] ? torsoAt(s, z) : { w: 0, h: 0, y: 0 };
  const hc = sub(s.hips.c, s.chest), [hw, hh] = eggCut(hc, s.hips.r, z);
  return hw > t.w ? { w: hw, h: hh, y: hc[1] } : t;
}
/** A point on the torso's skin at height `z`, `a` radians round from its right side (a quarter turn is its front), lifted `out` off it. */
function onTorso(s: Cat, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z);
  return [Math.cos(a) * (r.w + out), r.y + Math.sin(a) * (r.h + out), z];
}
/**
 * A point on something hung from `top` that drapes down over the body, in the chest's frame: never in under the widest the body
 * has been on the way down, so leaves fall straight from the shoulders and the belly rather than tucking in under them.
 */
function onDrape(s: Cat, z: number, top: number, a: number, out = 0): V3 {
  let w = 0, h = 0, y = 0;
  for (let q = 0; q <= 10; q++) {
    const r = bodyAt(s, lerp(top, z, q / 10));
    if (r.w >= w) { w = r.w; h = r.h; y = r.y; }
  }
  const d = unit([Math.cos(a) * h, Math.sin(a) * w, 0]);
  return add([Math.cos(a) * w, y + Math.sin(a) * h, z], scale(d, out));
}
/** The same, round the hips in the hips' frame, from the belt down. */
function onSkirt(s: Cat, z: number, a: number, out = 0): V3 {
  const c = s.hips.c;
  let w = 0, h = 0;
  for (let q = 0; q <= 10; q++) {
    const [ww, hh] = eggCut(c, s.hips.r, lerp(s.belt, z, q / 10));
    if (ww >= w) { w = ww; h = hh; }
  }
  const d = unit([Math.cos(a) * h, Math.sin(a) * w, 0]);
  return add([Math.cos(a) * w, c[1] + Math.sin(a) * h, z], scale(d, out));
}

/* ---- its patches ------------------------------------------------------------------------ */

/** A patch of colour on something round: the way to its middle, how far round it spreads (radians), and its colour. */
interface Patch { d: V3; r: number; m: Mat }

/** The colour at the way `d` out of something patched: the first patch it is in, its edge ragged as a calico's is, or else `base`. */
function patchMat(d: V3, list: readonly Patch[], base: Mat): Mat {
  const u0 = unit(d);
  for (const p of list) {
    const u = unit(p.d), a = Math.acos(clamp(dot(u0, u), -1, 1));
    if (a > p.r * 1.3) continue;
    const side = unit(cross(u, Math.abs(u[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), up = cross(u, side);
    const w = Math.atan2(dot(u0, up), dot(u0, side));
    if (a < p.r * (1 + 0.14 * Math.sin(3 * w + p.r * 7) + 0.07 * Math.sin(7 * w + 1))) return p.m;
  }
  return base;
}
/** Each face of a mesh coloured from where its middle is, out of `c` scaled by `r` to a ball. */
function patched(m: Mesh, c: V3, r: V3, list: readonly Patch[], base: Mat, keep: (face: Face) => boolean = () => false): Mesh {
  return mesh(m.v, m.f.map((f) => {
    if (keep(f)) return f;
    const mid = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return { ...f, m: patchMat([(mid[0] - c[0]) / r[0], (mid[1] - c[1]) / r[1], (mid[2] - c[2]) / r[2]], list, base) };
  }));
}

/** The head's patches: dark over its right ear and crown, orange round its right eye, over its left ear and down its brow. */
const HEAD_PATCHES: readonly Patch[] = [
  { d: [0.6, -0.12, 0.8], r: 0.62, m: 'coatDark' },
  { d: [0.8, 0.5, 0.3], r: 0.4, m: 'coat' },
  { d: [-0.6, 0.4, 0.68], r: 0.58, m: 'coat' },
  { d: [0.14, 0.6, 0.8], r: 0.34, m: 'coat' },
  { d: [-0.4, -0.85, 0.25], r: 0.52, m: 'coatDark' },
  { d: [0.45, -0.88, -0.15], r: 0.44, m: 'coat' },
];
/** The torso's: dark over its right shoulder, orange over its left and down its back. */
const TORSO_PATCHES: readonly Patch[] = [
  { d: [0.72, -0.45, 0.55], r: 0.6, m: 'coatDark' },
  { d: [-0.78, -0.35, 0.35], r: 0.62, m: 'coat' },
  { d: [0.15, -0.95, -0.25], r: 0.5, m: 'coat' },
];
/** The hips': orange on its right flank and its seat, dark on its left. */
const HIPS_PATCHES: readonly Patch[] = [
  { d: [0.7, -0.55, 0.2], r: 0.62, m: 'coat' },
  { d: [-0.7, -0.5, -0.05], r: 0.55, m: 'coatDark' },
  { d: [0.0, -0.9, 0.55], r: 0.4, m: 'coatDark' },
  { d: [-0.95, 0.25, -0.2], r: 0.36, m: 'coat' },
];

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Sprigkit's bop, the Bloomwhisk's two-pawed swipe, the Floramane's slam. */
export const CAT_HITS: readonly number[] = [0.5, 0.52, 0.56];
/**
 * A go at its task, as shares of it, by stage. The Sprigkit's: its two pats of the soil (`pats`), the seed taken from its belt
 * (`seed`) and popped in (`sow`), the soil patted down over it (`tamp`) and the sprout coming up (`sprout`). The Bloomwhisk's:
 * the jug taken from its sash (`jug`), poured from `pour` to `poured`, the sprout cupped (`cup`) and blooming (`bloom`). The
 * Floramane's: the bloom taken hold of (`grasp`), plucked (`pluck`), tucked into its mantle (`tuck`), the mantle patted
 * (`pat`), and the new bud coming (`regrow`).
 */
export const CAT_WORK = {
  pats: [0.22, 0.34] as const, seed: 0.46, sow: 0.64, tamp: 0.76, sprout: 0.84,
  jug: 0.12, pour: 0.3, poured: 0.54, cup: 0.62, bloom: 0.7,
  grasp: 0.28, pluck: 0.38, tuck: 0.68, pat: 0.78, regrow: 0.82,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** A pose: where each ankle is and how its foot is pitched, how the body and the chest are carried, and where its paws are. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left. */
  chest: V3;
  /** The neck bent forward and turned left; the head nose-up, turned left and tilted, against level. */
  neck: number[]; head: V3;
  /** Where each paw is in the chest's frame, left then right; where it is on the ground's frame instead, and how much it is there. */
  hand: V3[]; ground: V3[]; on: number[];
  /** The tail lifted, swung to the left and curled past how it is carried. */
  tail: V3;
  /** Each ear flicked back, left then right. */
  ears: number[];
  /** How far the tassels swing, forward and to its left (degrees). */
  swing: number[];
  /**
   * What it works with: how much of what is in its paw is there (the seed, the jug, the bloom); the seed popped into the soil;
   * the jug tipped to pour; the sprout grown and its flower open; the Floramane's bloom on its stem in the planter, plucked into
   * its paw, and tucked into its mantle.
   */
  held: number; sown: number; pour: number; grow: number; bloom: number; bud: number; tucked: number;
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
  /** Where its paws rest, left then right, in the chest's frame. */
  paws: V3[];
  /** The planter's middle on the ground in front of it, and the middle of its soil. */
  site: V3; soil: V3;
  /** How far it bows to its planter: the chest bent, the hips tipped (degrees), how far it crouches (a share of its leg's reach). */
  bow: { bow: number; hips: number; crouch: number };
}

/** The planter box at each stage: half across, half deep, and how tall. */
const PLANTER: readonly V3[] = [[0.4, 0.27, 0.28], [0.46, 0.3, 0.26], [0.72, 0.42, 0.34]];
/** How tall the sprout is grown at each stage, and the Floramane's bloom's stem. */
const SPROUT: readonly number[] = [0.24, 0.36, 0.62];
/** How big the flower is that opens on the Bloomwhisk's sprout and that the Floramane plucks. */
const BLOOM_R: readonly number[] = [0.06, 0.13, 0.26];
/** Where its paw takes a thing from its belt, in the chest's frame. */
const beltPocket = (s: Cat): V3 => { const [w, h] = eggCut(s.hips.c, s.hips.r, s.belt); return sub([w * 0.72, s.hips.c[1] + h * 0.66, s.belt + 0.02], s.chest); };
/** Where the Floramane tucks its bloom, in the chest's frame: into its mantle on its left breast. */
const tuckAt = (s: Cat): V3 => onTorso(s, s.torso.z[2] + 0.06, Math.PI / 2 + 0.55, 0.32);

const rests = new Map<Cat, Rest>();
function restOf(s: Cat): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3);
  const k = s.torso.h[1];
  const paws: V3[] = s.stage === 0
    ? [[-0.38, k * 0.62, 0.0], [0.38, k * 0.62, 0.0]]
    : s.stage === 1
      ? [[-0.46, k * 0.4, -0.06], [0.4, k * 0.66, 0.08]]
      : [-1, 1].map((sd) => [sd * (s.shoulder[0] + 0.24), 0.32, s.shoulder[2] - (s.arm[0] + s.arm[1]) * 0.84] as V3);
  const R: Rest = { ankle, reach: L.len[0] + L.len[1], paws, site: [0, 1.4, 0], soil: [0, 1.4, 0.2], bow: [{ bow: 18, hips: 8, crouch: 0.6 }, { bow: 26, hips: 8, crouch: 0.3 }, { bow: 16, hips: 5, crouch: 0.3 }][s.stage] };
  rests.set(s, R);
  return R;
}

function restPlan(s: Cat, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0],
    hand: R.paws.map((h) => [...h] as V3), ground: [[...R.soil], [...R.soil]], on: [0, 0],
    tail: [0, 0, 0], ears: [0, 0], swing: [0, 0],
    held: 0, sown: 0, pour: 0, grow: 0, bloom: 0, bud: 1, tucked: 0,
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.1;

/**
 * Going: an upright waddle. Each foot down for its share of a stride and swept back under the hips at the ground's own speed,
 * then lifted and brought forward; the whole body rolled well over onto the foot that is down and swayed after it, sinking onto
 * each foot as it lands; the paws swinging a little against the feet; the head held steadier than the body; the tail swinging
 * against the hips a beat behind them, the tassels after it.
 */
function goingPlan(s: Cat, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = R.reach, half = L * amp;
  for (let i = 0; i < 2; i++) {
    const A = R.ankle[i], ph = frac(a.u + i * 0.5);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      p.foot[i] = 0;
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.3 * g);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    p.at[i] = [A[0] * (1 + 0.2 * Math.sin(Math.PI * u)), y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    p.foot[i] = -18 * Math.sin(Math.PI * clamp(u * 1.6)) * (1 - u) + 8 * hump(u, 0.85, 0.15);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.08));
  p.H += -G.bob * L * 2.2 * (down - 0.5) * (1 - 0.4 * g) + g * L * (0.12 * Math.max(0, Math.sin(2 * TAU * (w - duty * 0.5 + 0.25))) - 0.05);
  // Over the foot that is down: the left (0) from nought to half a stride, the right after. A waddle is mostly this.
  const over = Math.sin(TAU * (w - 0.2));
  p.roll = G.roll * over * (1 + 0.2 * g);
  p.side = -G.sway * L * 2 * over * (1 - 0.5 * g);
  p.yaw = 6 * Math.cos(TAU * w) * (1 - 0.3 * g);
  p.chest = [3 + 10 * g + 2 * (down - 0.5), -p.yaw * 0.9, -p.roll * 0.4];
  p.pitch = -2 - 6 * g;
  p.head = [3 * (down - 0.5) + 2 + 4 * g, -p.yaw * 0.3 - p.chest[1] * 0.5, -p.roll * 0.6];
  // The paws swung against the feet, out from the sides at a run.
  const sw = Math.sin(TAU * (w - 0.05)), arm = s.arm[0] + s.arm[1];
  p.hand = p.hand.map((h, i) => add(h, [(i ? 1 : -1) * 0.12 * arm * g, 0.3 * arm * sw * (i ? 1 : -1), 0.12 * arm * g + 0.06 * arm * Math.abs(sw)])) as V3[];
  p.tail = [g * 14 + 4 * (down - 0.5), -p.yaw * 2.2 - 14 * Math.sin(TAU * (w - 0.1)), -6 * g];
  p.swing = [-10 * Math.sin(2 * TAU * (w - 0.3)) - 8 * g, 12 * Math.sin(TAU * (w - 0.35))];
  return p;
}

/** How far the Bloomwhisk's paw is up in its wave, `t` into the loop: up at the start of it and again halfway round. */
function waveOf(t: number): number {
  const u = ((t % 24) + 24) % 24;
  return Math.max(held(u, -3, 3.4, 0.7), held(u, 21, 27, 0.7), held(u, 12.2, 15.8, 0.7));
}

/**
 * Standing about: breathing, swaying happily from foot to foot, its head tilting, its tail swaying and curling, now one ear
 * flicked and now the other; and now and then what its paws do of their own: the Sprigkit kneads them, the Bloomwhisk waves,
 * the Floramane folds them over its belly. `quiet`, its paws are left as they are, for an act laid over how it stands.
 */
function stillPlan(s: Cat, R: Rest, a: Anim, quiet = false): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  const sway = cyc(t, 4);
  p.chest = [1.5 * (a.breath - 0.5), 6 * look * 0.3, 2.5 * sway];
  p.roll = -3 * sway;
  p.side = 0.03 * s.leg.len[0] * sway;
  p.neck = [0, 8 * look];
  p.head = [2 * cyc(t, 3), 8 * look, 7 * sway + 4 * drift(t, 2)];
  p.H += 0.012 * R.reach * (a.breath - 0.5);
  p.tail = [3 * cyc(t, 3, 1), 14 * cyc(t, 4, 0.6) + 6 * drift(t, 4), 6 * cyc(t, 6)];
  p.ears = [beat(t, [2.6, 9.8, 18.4], 0.45), beat(t, [5.4, 14.1, 21.3], 0.45)];
  p.swing = [2 * cyc(t, 4), -4 * sway];
  if (quiet) return p;
  // The Sprigkit kneads its paws together now and then.
  if (s.stage === 0) {
    const knead = beat(t, [7.2, 19.0], 1.6);
    p.hand = p.hand.map((h, i) => add(h, [(i ? -1 : 1) * 0.1 * knead, 0.06 * knead, 0.05 * knead * (0.5 + 0.5 * Math.sin(t * TAU * 2.4 + i * Math.PI))])) as V3[];
  }
  if (s.stage === 1) {
    // The left paw up beside its head, waved from side to side; the body leaning from it and the head tilted to it.
    const up = waveOf(t), wv = Math.sin(t * TAU * 1.1);
    const top: V3 = [-(s.shoulder[0] + 0.48 + 0.08 * wv), s.shoulder[1] + 0.08, s.shoulder[2] + (s.arm[0] + s.arm[1]) * 0.64];
    p.hand[0] = mixV(p.hand[0], top, up);
    p.chest[2] -= 4 * up;
    p.head[2] += 4 * up;
  }
  // The Floramane's paws now and then folded over its belly, content.
  if (s.stage === 2) {
    const fold = beat(t, [8.0, 18.5], 3.2);
    const k = s.torso.h[0];
    p.hand = p.hand.map((h, i) => mixV(h, [(i ? 1 : -1) * 0.34, k + 0.08, 0.02 + 0.04 * i], fold)) as V3[];
    p.head[0] += 4 * fold;
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

/**
 * A strike. The Sprigkit crouches with a paw drawn back over its head, hops in and bops down with it. The Bloomwhisk rears up
 * with both paws over its head and swipes them down in front of it. The Floramane heaves both arms up, rises, and comes down
 * with its whole weight, its paws slammed down in front of it.
 */
function strikePlan(s: Cat, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = CAT_HITS[s.stage], L = R.reach;
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.14, 0.96));
  const jolt = hump(t, hit + 0.02, 0.07);
  const since = (t - hit) * ACT_SECS.strike;
  const S = s.shoulder, A = s.arm[0] + s.arm[1], k = s.torso.h[1];
  const over: V3 = [S[0] * 0.8, S[1] - 0.1 * A, S[2] + A * 0.9];
  const down: V3 = [S[0] * 0.4, k + A * 0.55, S[2] - A * 0.55];
  if (s.stage === 0) {
    const hop = hump(t, (0.36 + hit) / 2, (hit - 0.36) / 2 + 0.02);
    p.H += L * (-0.35 * wind + 1.0 * hop - 0.25 * jolt);
    p.surge = L * 0.9 * blow;
    p.chest = [-8 * wind + 20 * blow, 14 * wind - 10 * blow, 0];
    p.head = [6 * wind - 8 * blow, -8 * wind + 4 * blow, 0];
    p.hand[1] = path(t, [[0.04, R.paws[1]], [0.32, over], [0.38, add(over, [0, -0.04, 0.03])], [hit, down], [hit + 0.14, down], [0.94, R.paws[1]]]);
    p.hand[0] = add(p.hand[0], [-0.08 * (wind + blow), -0.06 * blow, 0.08 * wind]);
    p.squash = 0.08 * jolt - 0.04 * hop;
    for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 0.9 * blow * ramp(t, hit - 0.04, hit + 0.06), 0]);
  } else if (s.stage === 1) {
    const o0: V3 = [-over[0], over[1], over[2]], d0: V3 = [-down[0], down[1], down[2]];
    p.hand[0] = path(t, [[0.04, R.paws[0]], [0.32, o0], [0.38, add(o0, [0, -0.05, 0.04])], [hit, d0], [hit + 0.14, d0], [0.94, R.paws[0]]]);
    p.hand[1] = path(t, [[0.04, R.paws[1]], [0.32, over], [0.38, add(over, [0, -0.05, 0.04])], [hit, down], [hit + 0.14, down], [0.94, R.paws[1]]]);
    p.chest = [-12 * wind + 24 * blow, 0, 0];
    p.head = [10 * wind - 12 * blow, 0, 0];
    p.H += L * (0.12 * wind - 0.16 * blow);
    p.surge = L * 0.4 * blow;
    p.squash = 0.06 * jolt;
    p.at[0] = add(p.at[0], [0, L * 0.5 * blow, 0]);
  } else {
    const o0: V3 = [-over[0] * 0.9, over[1], over[2]], o1: V3 = [over[0] * 0.9, over[1], over[2]];
    const d0: V3 = [-S[0] * 0.55, k + A * 0.5, S[2] - A * 0.85], d1: V3 = [S[0] * 0.55, k + A * 0.5, S[2] - A * 0.85];
    p.hand[0] = path(t, [[0.04, R.paws[0]], [0.34, o0], [0.4, add(o0, [0, -0.05, 0.05])], [hit, d0], [hit + 0.16, d0], [0.94, R.paws[0]]]);
    p.hand[1] = path(t, [[0.04, R.paws[1]], [0.34, o1], [0.4, add(o1, [0, -0.05, 0.05])], [hit, d1], [hit + 0.16, d1], [0.94, R.paws[1]]]);
    p.chest = [-10 * wind + 22 * blow, 0, 0];
    p.head = [12 * wind - 14 * blow, 0, 0];
    p.H += L * (0.22 * wind - 0.32 * blow - 0.12 * jolt);
    p.surge = L * 0.25 * blow;
    p.squash = 0.1 * jolt;
    p.at[1] = add(p.at[1], [0, L * 0.45 * blow, L * 0.25 * hump(t, 0.42, 0.1)]);
  }
  p.tail = [14 * wind - 8 * blow + 10 * ringOut(since, 1.4, 3), 20 * wind - 14 * blow, 10 * wind];
  p.ears = [wind * 0.8, wind * 0.8];
  p.swing = [-16 * wind + 30 * blow * (1 - ramp(t, hit, hit + 0.2)) + 18 * ringOut(since, 1.6, 3), 8 * ringOut(since + 0.1, 1.4, 3)];
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.9, 1)));

/** Bowed to its planter as far as `k` of the way. */
function bowTo(p: Plan, R: Rest, k: number): void {
  const B = R.bow;
  p.chest = add(p.chest, [B.bow * k, 0, 0]);
  p.pitch -= B.hips * k;
  p.H -= B.crouch * R.reach * k;
  p.surge -= 0.06 * R.reach * k;
  p.head = add(p.head, [-B.bow * 0.7 * k, 0, 0]);
}

/**
 * The Sprigkit's go: bowed to its planter, it pats the soil with one paw and the other, takes a seed from its belt, pops it into
 * the soil and pats it down with both paws, and a sprout springs up; it straightens, pleased (`CAT_WORK`).
 */
function sowPlan(s: Cat, R: Rest, t: number, p: Plan): void {
  const W = CAT_WORK, so = R.soil;
  const bow = ramp(t, 0.02, 0.14) * (1 - ramp(t, 0.86, 0.98));
  bowTo(p, R, bow);
  const up = (h: number, x: number): V3 => [so[0] + x, so[1] - 0.04, so[2] + h];
  const pat = (c: number, x: number): V3 => path(t, [[c - 0.1, up(0.16, x)], [c, up(0.01, x)], [c + 0.06, up(0.12, x)]]);
  // The left paw: a pat, waits, pats the seed in with the right.
  p.ground[0] = t < W.pats[0] + 0.08 ? pat(W.pats[0], -0.1) : t < W.tamp - 0.1 ? path(t, [[W.pats[0] + 0.06, up(0.12, -0.1)], [W.tamp - 0.12, up(0.16, -0.12)]]) : pat(W.tamp, -0.08);
  p.on[0] = ramp(t, 0.04, 0.14) * (1 - ramp(t, 0.84, 0.94));
  // The right paw: a pat, to its belt for the seed, over the soil with it, pressed in, and both paws on it.
  const pocket = beltPocket(s);
  if (t < W.seed - 0.1) p.ground[1] = pat(W.pats[1], 0.1);
  else if (t < W.sow + 0.08) p.ground[1] = path(t, [[W.sow - 0.1, up(0.18, 0.02)], [W.sow, up(-0.02, 0.02)], [W.sow + 0.08, up(0.12, 0.06)]]);
  else p.ground[1] = pat(W.tamp, 0.08);
  p.hand[1] = pocket;
  p.on[1] = ramp(t, 0.04, 0.14) * (1 - held(t, W.seed - 0.04, W.seed + 0.02, 0.06)) * (1 - ramp(t, 0.84, 0.94));
  p.held = ramp(t, W.seed - 0.03, W.seed) * (1 - ramp(t, W.sow - 0.005, W.sow + 0.01));
  p.sown = ramp(t, W.sow - 0.005, W.sow + 0.01) * (1 - ramp(t, W.tamp - 0.04, W.tamp));
  p.grow = t > W.sprout ? Math.min(1.15, ramp(t, W.sprout, W.sprout + 0.04) * 1.15) - 0.15 * ramp(t, W.sprout + 0.04, W.sprout + 0.08) : 0;
  p.grow *= 1 - ramp(t, 0.96, 1);
  // Its head down at the soil, and up, pleased, as the sprout comes.
  const pleased = hump(t, 0.9, 0.08);
  p.head = add(p.head, [-6 * bow + 14 * pleased, 6 * Math.sin(t * TAU * 2) * bow, 10 * pleased]);
  p.H += 0.08 * R.reach * pleased;
  p.tail = [6 * bow + 10 * pleased, 10 * Math.sin(t * TAU * 2), 8 * pleased];
  p.ears = [0.5 * pleased, 0.5 * pleased];
}

/**
 * The Bloomwhisk's go: it takes a little watering jug from its sash and tips it over the sprout in its planter, which grows as it
 * waters it; puts the jug back, cups the sprout in its other paw, and it opens into a white flower (`CAT_WORK`).
 */
function waterPlan(s: Cat, R: Rest, t: number, p: Plan): void {
  const W = CAT_WORK, so = R.soil, top = add(so, [0, 0, SPROUT[1]]);
  const bow = ramp(t, 0.1, 0.26) * (1 - ramp(t, 0.84, 0.96));
  bowTo(p, R, bow * 0.7);
  const pocket = beltPocket(s);
  // The right paw: to the sash for the jug, up over the sprout, tipped, and back.
  const over: V3 = add(so, [0.22, -0.18, SPROUT[1] + 0.42]);
  p.hand[1] = path(t, [[0.02, R.paws[1]], [W.jug, pocket], [W.jug + 0.04, pocket], [0.2, add(pocket, [0.05, 0.12, 0.16])], [0.74, add(pocket, [0.05, 0.12, 0.16])], [0.8, pocket], [0.84, pocket], [0.96, R.paws[1]]]);
  p.ground[1] = over;
  p.on[1] = held(t, 0.24, 0.66, 0.08);
  p.held = ramp(t, W.jug - 0.02, W.jug + 0.02) * (1 - ramp(t, 0.8, 0.84));
  p.pour = held(t, W.pour, W.poured, 0.05);
  p.grow = lerp(0.35, 1, ramp(t, W.pour + 0.02, W.poured + 0.06)) * (1 - ramp(t, 0.97, 1)) + 0.35 * ramp(t, 0.97, 1);
  // The left paw: cupped round the sprout, the flower opening in it.
  const cup = add(top, [-0.12, -0.06, -0.06]);
  p.ground[0] = path(t, [[W.cup - 0.1, add(cup, [-0.1, -0.06, 0.1])], [W.cup, cup], [W.bloom + 0.06, add(cup, [-0.03, 0, 0.02])], [W.bloom + 0.14, add(cup, [-0.14, -0.08, 0.14])]]);
  p.on[0] = held(t, W.cup - 0.04, W.bloom + 0.08, 0.1);
  p.bloom = ramp(t, W.bloom - 0.06, W.bloom + 0.06) * (1 - ramp(t, 0.96, 1));
  const pleased = hump(t, W.bloom + 0.1, 0.1);
  p.head = add(p.head, [-6 * bow + 10 * pleased, -6 * bow * (1 - pleased), 12 * pleased]);
  p.tail = [6 * bow + 12 * pleased, 8 * Math.sin(t * TAU * 1.5), 6 * pleased];
  p.ears = [0.6 * pleased, 0.6 * pleased];
}

/**
 * The Floramane's go: it bends to the big white bloom in its planter, takes hold of it in both paws and plucks it, straightens
 * and tucks it into its mantle, pats it there, and a new bud swells and opens on the stem (`CAT_WORK`).
 */
function harvestPlan(s: Cat, R: Rest, t: number, p: Plan): void {
  const W = CAT_WORK, so = R.soil, head = add(so, [0, 0, SPROUT[2] + BLOOM_R[2] * 0.4]);
  const bow = ramp(t, 0.04, W.grasp - 0.04) * (1 - ramp(t, W.pluck + 0.06, W.tuck - 0.12));
  bowTo(p, R, bow);
  const tuck = tuckAt(s), x = BLOOM_R[2] * 0.9;
  p.ground = [add(head, [-x, -0.1, 0.02]), add(head, [x, -0.1, 0.02])];
  const lift = ramp(t, W.pluck - 0.04, W.pluck + 0.04);
  p.ground = p.ground.map((g) => add(g, [0, -0.06 * lift, 0.24 * lift])) as V3[];
  p.on = [held(t, W.grasp - 0.02, W.pluck + 0.06, 0.12), held(t, W.grasp - 0.02, W.pluck + 0.06, 0.12)];
  // Up to its breast with the bloom in its right paw, the left steadying it, and tucked into the mantle; then the mantle patted.
  const breast: V3 = add(tuck, [0.06, 0.24, 0.02]);
  p.hand[1] = path(t, [[W.pluck + 0.04, R.paws[1]], [W.pluck + 0.12, add(breast, [0.24, 0.12, -0.2])], [W.tuck - 0.08, breast], [W.tuck + 0.04, add(tuck, [0.04, 0.1, 0])], [W.pat - 0.04, add(tuck, [0.06, 0.16, 0.04])], [W.pat, add(tuck, [0.04, 0.08, 0])], [W.pat + 0.06, add(tuck, [0.1, 0.2, 0.04])], [0.96, R.paws[1]]]);
  p.hand[0] = path(t, [[W.pluck + 0.06, R.paws[0]], [W.tuck - 0.1, add(breast, [-0.3, 0.06, -0.28])], [W.tuck + 0.02, add(breast, [-0.26, 0.04, -0.3])], [0.9, R.paws[0]]]);
  p.held = ramp(t, W.pluck - 0.01, W.pluck + 0.01);
  p.tucked = ramp(t, W.tuck - 0.06, W.tuck + 0.06);
  p.bud = 1 - ramp(t, W.pluck - 0.01, W.pluck + 0.01) + ramp(t, W.regrow, 0.98);
  const pleased = held(t, W.tuck, W.pat + 0.08, 0.06);
  p.head = add(p.head, [-8 * bow + 12 * pleased, 0, -8 * pleased]);
  p.chest = add(p.chest, [-4 * pleased, 0, 0]);
  p.tail = [6 * bow + 6 * pleased, 6 * Math.sin(t * TAU), 4 * pleased];
  p.swing = [14 * bow, 0];
}

/** A go at its task, by stage, eased in from how it stands. */
function workPlan(s: Cat, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R);
  if (s.stage === 0) sowPlan(s, R, t, p);
  else if (s.stage === 1) waterPlan(s, R, t, p);
  else harvestPlan(s, R, t, p);
  // What it works with is where its go has put it whatever the easing, so nothing shrinks or grows as it eases in and out.
  const q = mixPlan(restPlan(s, R), p, down);
  q.held = p.held; q.sown = p.sown; q.grow = p.grow; q.bloom = p.bloom; q.bud = p.bud; q.tucked = p.tucked; q.pour = p.pour;
  return q;
}

/** Feeding where it stands: bowed, its paws on the ground in front of it, nibbling. */
function grazePlan(s: Cat, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  bowTo(p, R, 0.9);
  const nib = Math.max(0, Math.sin(t * TAU * 1.4)) ** 3;
  p.head = add(p.head, [-10 - 6 * nib, 6 * drift(t, 2), 0]);
  p.tail = [4, 10 * cyc(t, 4), 0];
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its paws spread and up, a shake, and settled. */
function evolvePlan(s: Cat, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach, A = s.arm[0] + s.arm[1], S = s.shoulder;
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * (s.stage === 2 ? 48 : 64));
  p.H += L * (-0.2 * hunch + 0.25 * up);
  p.chest = [14 * hunch - 8 * up, 0, 4 * shake];
  p.neck = [8 * hunch - 6 * up, 0];
  p.head = [-14 * hunch + 20 * up, 0, 14 * shake];
  p.roll = 3 * shake;
  p.squash = 0.06 * hump(t, 0.72, 0.05);
  const hi = (sd: number): V3 => [sd * (S[0] + A * 0.6), S[1] + 0.05, S[2] + A * 0.7];
  p.hand = p.hand.map((h, i) => mixV(mixV(h, [(i ? 1 : -1) * 0.2, s.torso.h[1] + 0.05, 0.1], hunch), hi(i ? 1 : -1), up)) as V3[];
  p.tail = [-8 * hunch + 16 * up, 14 * shake, 10 * up];
  p.ears = [up * 0.6 + hunch, up * 0.6 + hunch];
  p.swing = [12 * shake, 8 * shake];
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Cat, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => {
    const q = shifted(p, stillPlan(s, R, a, true), restPlan(s, R));
    q.held = p.held; q.sown = p.sown; q.grow = p.grow; q.bloom = p.bloom; q.bud = p.bud; q.tucked = p.tucked; q.pour = p.pour;
    return q;
  };
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
function bend2(from: V3, to: V3, l0: number, l1: number, hint: V3, alt?: V3): { mid: V3; end: V3 } {
  let d = sub(to, from);
  const D = len3(d), most = (l0 + l1) * 0.995, least = Math.abs(l0 - l1) + 0.06 * (l0 + l1), Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const end = add(from, scale(d, Dc));
  // Bowed toward the hint, square to the limb; where the limb comes near to lying along the hint, toward the other hint instead,
  // eased between the two so the joint never swaps sides in a frame.
  const sq = (h: V3): V3 => sub(h, scale(d, dot(h, d)));
  const a = sq(hint), k = alt ? smooth((0.85 - len3(a)) / 0.6) : 0;
  const v = unit(k > 0 && alt ? add(scale(unit(a), 1 - k), scale(unit(sq(alt)), k)) : a);
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  return { mid: add(add(from, scale(d, along)), scale(v, h)), end };
}

/** A leg bent to put its ankle at `ankle`: the knee forward and a little out, always the same way round; the foot flat, turned a little out. */
function legOf(s: Cat, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.25, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.2 * fwd[1], fwd[1] - sd * 0.2 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The tail's bones from its root on the hips, each link on from the one before it, lifted, swung and curled. */
function tailBones(s: Cat, body: Xf, lift: number, yaw: number, curl: number): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  let prev = joint(body, T.at, -(T.bend[0] + lift), 0, yaw * 0.5 + T.side);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.bend[q] + (curl * q) / n), 0, (yaw * 0.6) / (n - 1) + (q >= n - 3 ? T.hook : 0));
    out.push(prev);
  }
  return out;
}

/** The skull's middle in the head's frame. */
const skullAt = (s: Cat): V3 => [0, 0.02, s.head.up];

/** Where each ear's root is on the skull and how it stands, in the head's frame: up and a little out, its face forward. */
function earBase(s: Cat, sd: number): Xf {
  const C = skullAt(s), R = s.head.r, e = onEgg(C, R, [sd * 0.6, 0.02, 0.8]);
  const up = unit(add(e.n, [sd * -0.12, 0.06, 0.5]));
  const [X, Y, Z] = frameOf(up, [sd * 0.25, 1, 0]);
  return xfOf(X, Y, Z, add(e.p, scale(up, -s.ear.len * 0.14)));
}

/** Where the belt's knot is, in the hips' frame: what the tassels hang from. */
const knotAt = (s: Cat): V3 => { const [, h] = eggCut(s.hips.c, s.hips.r, s.belt); return [s.stage === 2 ? -0.12 : 0.1, s.hips.c[1] + h + [0.04, 0.05, 0.08][s.stage], s.belt - 0.02]; };
/** Where the Floramane's two chest clasps are, in the chest's frame. */
const claspAt = (s: Cat, sd: number): V3 => onTorso(s, s.torso.z[2] + 0.02, Math.PI / 2 + sd * 0.42, 0.14);

/** Where what hangs from a point is, `len` under it, swung forward and to its left (degrees) in the body's frame. */
function hangFrom(top: V3, len: number, swing: number[], body: Xf): Xf {
  const f = swing[0] * DEG, l = swing[1] * DEG;
  const fwd = turn(body, [0, 1, 0]), left = turn(body, [-1, 0, 0]);
  const d = unit(add(add([0, 0, -Math.cos(f) * Math.cos(l)], scale(fwd, Math.sin(f))), scale(left, Math.sin(l))));
  const [X, Y, Z] = frameOf(scale(d, -1), fwd);
  return xfOf(X, Y, Z, top);
}

/**
 * The bones of a stage: its pose, the hips raised and carried as it says, the chest on them, the neck, the head and its ears, the
 * tail in links, each leg bent to put its foot where it is to be, each arm bent to put its paw where it is to be, the tassels
 * hanging and swinging, and what it works with: the planter, the sprout and its flower, and what is in its paw.
 */
function catBones(s: Cat): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    b.chest = joint(body, s.chest, -P.chest[0], P.chest[2], P.chest[1]);
    b.neck = joint(b.chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    // The head carried level whatever the hips and the chest do under it, then pitched as the pose says.
    b.head = joint(b.neck, [0, 0, s.neck.len], P.chest[0] + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, base = earBase(s, sd), f = P.ears[i];
      b[`ear${i}`] = compose(b.head, compose(base, joint(ROOT, [0, 0, 0], -38 * f, sd * 10 * f, sd * 26 * f)));
    }
    tailBones(s, body, P.tail[0], P.tail[1], P.tail[2]).forEach((x, q) => { b[`tail${q}`] = x; });
    for (let i = 0; i < 2; i++) {
      const [u, l, f] = legOf(s, body, i, P.at[i], P.foot[i]);
      const key = i ? 'lr' : 'll';
      b[`${key}0`] = u;
      b[`${key}1`] = l;
      b[`${key}2`] = f;
    }
    const fwd = turn(b.chest, [0, 1, 0]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1;
      const want = mixV(place(b.chest, P.hand[i]), P.ground[i], P.on[i]);
      const sh = place(b.chest, [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      const { mid: el, end: wr } = bend2(sh, want, s.arm[0], s.arm[1], turn(b.chest, unit([sd * 0.8, -0.35, -0.5])), turn(b.chest, unit([sd * 0.4, -0.6, -0.3])));
      const [X0, Y0, Z0] = frameOf(sub(sh, el), fwd), [X1, Y1, Z1] = frameOf(sub(el, wr), fwd);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      b[`hand${i}`] = xfOf(X1, Y1, Z1, wr);
    }
    // The tassels hung plumb from the belt's knot and the Floramane's clasps, swinging.
    const knot = place(body, knotAt(s));
    for (let q = 0; q < 2; q++) b[`tassel${q}`] = hangFrom(add(knot, turn(body, [(q ? 1 : -1) * 0.05 * (1 + s.stage), 0, 0])), 1, [P.swing[0], P.swing[1] + (q ? -6 : 6)], body);
    if (s.stage === 2) for (let q = 0; q < 2; q++) b[`tassel${q + 2}`] = hangFrom(place(b.chest, claspAt(s, q ? 1 : -1)), 1, [P.swing[0] * 0.6 - 8, P.swing[1] * 0.6], body);
    // The panel down the Floramane's front swung forward from the belt as far as keeps the knee that comes furthest forward behind it.
    if (s.stage === 2) {
      const hinge = PANEL_HINGE(s);
      let swing = 0;
      for (const key of ['ll1', 'lr1']) {
        const kn = backPt(body, b[key].t), e = kn[1] + s.leg.w[1] * 1.4 - hinge[1];
        if (e > 0) swing = Math.max(swing, Math.atan2(e, Math.max(0.05, hinge[2] - kn[2])) / DEG);
      }
      b.panel = joint(body, hinge, swing);
    }
    // What it works with: the planter on the ground in front of it, the sprout in it and its flower, and what is in its paw.
    b.planter = xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], R.site);
    b.sprout = scaled(xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], R.soil), s.stage === 2 ? 1 : P.grow);
    const top = add(R.soil, [0.01 * Math.sin(P.grow * 9), 0, SPROUT[s.stage] * Math.max(0.001, s.stage === 2 ? 1 : P.grow)]);
    if (s.stage === 1) b.bloom = scaled(xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], top), P.grow > 0.5 ? 1 : 0);
    if (s.stage === 2) b.bud = scaled(xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], top), P.bud);
    const hand = b.hand1, flat = turn(body, [0, 1, 0]);
    const fw = unit([flat[0], flat[1], 0]);
    if (s.stage === 0) {
      // The seed in the paw, then in the soil.
      const inPaw = place(hand, [0, s.hand * 0.6, -s.hand * 0.3]);
      b.seed = scaled(xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], inPaw), P.held);
      b.sown = scaled(xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], add(R.soil, [0.02, -0.04, 0.0])), P.sown);
    }
    if (s.stage === 1) {
      // The jug held upright in the paw, its spout forward, tipped forward to pour.
      const [X, Y, Z] = frameOf(unit(add([0, 0, Math.cos(P.pour * 1.0)], scale(fw, Math.sin(P.pour * 1.0)))), fw);
      b.jug = scaled(xfOf(X, Y, Z, place(hand, [0, s.hand * 0.3, -s.hand * 0.9])), P.held);
    }
    if (s.stage === 2) {
      // The bloom: on its stem in the planter, plucked into the paw, then tucked into the mantle, sinking into it.
      const onStem = xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], top);
      const [X, Y, Z] = frameOf(unit(add(scale(fw, 0.6), [0, 0, 1])), fw);
      const inPaw = xfOf(X, Y, Z, place(hand, [0, s.hand * 0.9, s.hand * 0.2]));
      const T = tuckAt(s), tucked = compose(b.chest, joint(xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], T), [0, 0, 0], -30, 0, 0));
      let x = blendXf(onStem, inPaw, ramp(P.held, 0, 1) * clamp((P.held - 0.01) * 50));
      x = blendXf(x, tucked, P.tucked);
      b.bloomHeld = scaled(x, P.held * (1 - 0.65 * P.tucked));
    }
    b.shadow = shadowOf(body, 0);
    return b;
  };
  let ready = false;
  const prepare = (): void => {
    ready = true;
    // Where the planter goes: as far out in front as its feet and belly need, and as near as its paws reach down to what they
    // work on there -- the soil, the top of the sprout, the bloom -- bowing further where they do not.
    const D = PLANTER[s.stage], aim = [0.02, SPROUT[1] - 0.04, SPROUT[2] + BLOOM_R[2] * 0.4][s.stage], reach = (s.arm[0] + s.arm[1]) * 0.94;
    const front = Math.max(s.hips.c[1] + s.hips.r[1], R.ankle[1][1] + s.leg.foot[0]) + D[1] + 0.06;
    const base = { ...R.bow };
    const bowed = (g: number): V3 => {
      R.bow = { bow: base.bow * g, hips: base.hips * g, crouch: base.crouch * g };
      const p = restPlan(s, R);
      bowTo(p, R, 1);
      const b = pose(p), sh = s.shoulder;
      return mixV(place(b.chest, [-sh[0], sh[1], sh[2]]), place(b.chest, sh), 0.5);
    };
    let g = 1, mid = bowed(g);
    const far = (m: V3): number => Math.hypot(Math.max(0, front - m[1]), m[2] - (D[2] + aim));
    while (g < 1.3 && far(mid) > reach) mid = bowed((g += 0.05));
    const dz = mid[2] - (D[2] + aim), y = Math.max(front, mid[1] + Math.sqrt(Math.max(0.01, reach * reach - dz * dz)) * 0.75);
    R.site = [0, y, 0];
    R.soil = [0, y, D[2] * 0.92];
  };
  return (a) => {
    if (!ready) prepare();
    return pose(planOf(s, R, { ...a, go: a.act ? 0 : a.go }));
  };
}

/* ---- what it is made of ------------------------------------------------------------- */

/** A patch painted onto the egg `(C, R)` round the way `dir`, `rx` by `ry`, turned `spin`: a blush, a stripe. */
function patchOn(C: V3, R: V3, dir: V3, rx: number, ry: number, mat: Mat, spin = 0, lift = 0.012, sides = 10): Disc {
  const e = onEgg(C, R, dir), d = disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, sides, mat, { spin, at: add(e.p, scale(e.n, -0.02)) });
  return { ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); }) };
}

/** A curved band painted on the egg `(C, R)` round the way `dir`: an arch `w` either side and `h` high, `th` thick; a shut, smiling eye. */
function archOn(C: V3, R: V3, dir: V3, w: number, h: number, th: number, mat: Mat, lift: number): Disc {
  const e = onEgg(C, R, dir), n = e.n;
  const up = unit(sub([0, 0, 1], scale(n, n[2]))), across = unit(cross(up, n));
  const top: V3[] = [], bot: V3[] = [], N = 8;
  for (let q = 0; q <= N; q++) {
    const x = -1 + (2 * q) / N, y = h * (1 - x * x) - h * 0.45, k = th * (0.4 + 0.6 * (1 - x * x));
    const c = add(e.p, add(scale(across, x * w), scale(up, y)));
    top.push(add(c, scale(up, k)));
    bot.push(add(c, scale(up, -k)));
  }
  const pts = [...top, ...bot.reverse()].map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); });
  return facingDisc(pts, n, mat, add(e.p, scale(n, -0.03)));
}

/**
 * The head: a big round skull, wide at the cheeks, cream with its calico patches; tufts of fluff at its cheeks; a short muzzle of
 * two round pads with a pink nose and a small smile under it; its eyes shut, two arches in a happy smile; pink in its cheeks; and
 * on the bigger two a few dark tabby stripes on its brow.
 */
function headOf(s: Cat, n: number, k: number): Mesh {
  const H = s.head, C = skullAt(s), R = H.r, E = s.eye;
  const skull = patched(orb(C, R, n + 8, k + 5, 'mark'), C, R, HEAD_PATCHES, 'mark');
  // Fluff at the cheeks: soft tufts out and down either side under the eyes, the colour of the patch they are in.
  const fluff: Mesh[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < 3; q++) {
      const d: V3 = [sd * 0.92, 0.3 - q * 0.22, -0.32 - q * 0.1], e = onEgg(C, R, d);
      const out = unit(add(e.n, [0, -0.1, -0.35])), L = R[0] * (0.19 - 0.025 * q);
      const mat = patchMat(d, HEAD_PATCHES, 'mark');
      fluff.push(tube([add(e.p, scale(out, -L * 0.4)), add(e.p, scale(out, L * 0.35)), add(e.p, scale(out, L * 0.8))], [L * 0.75, L * 0.5, 0.004], [L * 0.45, L * 0.3, 0.004], 6, mat));
    }
  }
  // The muzzle: two round pads either side under the nose, a chin under them.
  const pads = [1, -1].map((sd) => { const e = onEgg(C, R, [sd * 0.17, 0.95, -0.34]); return egg(add(e.p, scale(e.n, -R[1] * 0.06)), UPRIGHT, [R[0] * 0.16, R[1] * 0.13, R[2] * 0.13], n, k, 'muzzle'); });
  const ce = onEgg(C, R, [0, 0.9, -0.52]);
  const chin = egg(add(ce.p, scale(ce.n, -R[1] * 0.06)), UPRIGHT, [R[0] * 0.13, R[1] * 0.1, R[2] * 0.09], n - 2, k - 1, 'muzzle');
  const ne = onEgg(C, R, [0, 0.98, -0.2]);
  const nose = egg(add(ne.p, scale(ne.n, R[1] * 0.06)), UPRIGHT, [R[0] * 0.075, R[1] * 0.05, R[2] * 0.05], 6, 3, 'nose');
  // The mouth: a small ω under the nose, between the pads.
  const me = onEgg(C, R, [0, 0.96, -0.33]);
  const mouth = smile(add(me.p, scale(me.n, R[1] * 0.1)), me.n, R[0] * 0.2, 'lid');
  // The eyes, shut in a smile; a pink blush under each.
  const shut = paint([1, -1].map((sd) => archOn(C, R, [sd * E.dir[0], E.dir[1], E.dir[2]], E.size, E.size * 0.55, E.size * 0.16, 'lid', 0.016)));
  const blush = paint([1, -1].map((sd) => patchOn(C, R, [sd * (E.dir[0] + 0.16), E.dir[1], E.dir[2] - 0.3], E.size * 0.8, E.size * 0.45, 'membrane', 0, 0.012, 8)));
  // Tabby stripes on its brow: short dark dashes over the orange blaze.
  const stripes = s.stage ? paint([-1, 0, 1].map((q) => patchOn(C, R, [q * 0.12, 0.66, 0.7 - Math.abs(q) * 0.04], R[0] * 0.03, R[2] * 0.12, 'coatDark', q * 0.25, 0.01, 6))) : null;
  return merge(skull, ...fluff, ...pads, chin, nose, mouth, shut, blush, stripes);
}

/** An ear, in its own frame from its root up `z`, its face along `y`: a pointed triangle, its patch's colour, pink inside with a tuft of cream. */
function earOf(s: Cat, sd: number, n: number): Mesh {
  const E = s.ear, mat: Mat = sd > 0 ? 'coatDark' : 'coat';
  const pts = [0, 0.3, 0.6, 0.85, 1].map((u) => [0, -0.02 * u, E.len * u] as V3);
  const ws = [E.w * 0.98, E.w * 0.86, E.w * 0.56, E.w * 0.24, E.w * 0.03];
  const outer = tube(pts, ws, ws.map((x) => Math.max(0.01, x * 0.3)), n, mat, { up: [0, 1, 0] });
  const ip = [0.1, 0.4, 0.7, 0.88].map((u) => [0, E.w * 0.16, E.len * u] as V3);
  const inner = tube(ip, [E.w * 0.66, E.w * 0.56, E.w * 0.3, E.w * 0.06], [E.w * 0.1, E.w * 0.09, E.w * 0.06, 0.006], n, 'inner', { up: [0, 1, 0] });
  const tuft = tube([[0, E.w * 0.22, E.len * 0.04], [sd * -E.w * 0.08, E.w * 0.3, E.len * 0.3], [sd * -E.w * 0.04, E.w * 0.32, E.len * 0.5]], [E.w * 0.18, E.w * 0.12, 0.004], [E.w * 0.08, E.w * 0.06, 0.004], 5, 'muzzle', { up: [0, 1, 0] });
  return merge(outer, inner, tuft);
}

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Cat): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];

/** A leaf from `root` along `dir`, its face along `face`: `L` long and `w` across at its widest, pointed, with a rib; plainer where it is drawn small. */
function leaf(root: V3, dir: V3, face: V3, L: number, w: number, mat: Mat, fine: boolean, curl = 0): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const us = fine ? [0, 0.3, 0.62, 1] : [0, 0.45, 1];
  const pts = us.map((u) => add(add(root, scale(d, L * u)), scale(f, curl * L * u * u)));
  const ws = fine ? [w * 0.32, w, w * 0.78, w * 0.06] : [w * 0.38, w * 0.95, w * 0.08];
  return blade(pts, ws, f, { mat, rib: mat === 'leafDark' ? 'moss' : 'leafDark', fold: 0.3, thick: w * 0.12 });
}
const LEAVES: readonly Mat[] = ['leaf', 'moss', 'leafDark'];

/**
 * A white flower: five round petals and a yellow middle facing `n`, leaves under it. Drawn small (`fine` false), the petals are
 * one white round with the middle on it, which is all five come to at a few pixels across.
 */
function flowerOf(c: V3, n: V3, r: number, leaves: number, seed: number, fine: boolean): Mesh {
  const f = frameOf(n, Math.abs(n[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]), out: Mesh[] = [];
  for (let q = 0; q < leaves; q++) {
    const a = (q / Math.max(1, leaves)) * TAU + seed, d = add(scale(f[0], Math.cos(a)), scale(f[1], Math.sin(a)));
    out.push(egg(add(c, add(scale(d, r * 1.25), scale(f[2], -r * 0.25))), frameOf(add(scale(f[2], 0.5), d), f[2]), [r * 0.42, r * 0.12, r * 0.95], fine ? 5 : 4, fine ? 3 : 2, q % 2 ? 'leafDark' : 'leaf'));
  }
  if (fine) {
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * TAU + seed * 2, d = add(scale(f[0], Math.cos(a)), scale(f[1], Math.sin(a)));
      out.push(egg(add(c, scale(d, r * 0.52)), [unit(cross(f[2], d)), d, f[2]], [r * 0.4, r * 0.52, r * 0.14], 6, 3, 'petal'));
    }
  } else out.push(egg(c, f, [r * 0.95, r * 0.95, r * 0.14], 10, 2, 'petal'));
  out.push(egg(add(c, scale(f[2], r * 0.12)), f, [r * 0.22, r * 0.22, r * 0.14], 5, fine ? 3 : 2, 'bloom'));
  return merge(...out);
}

/** A rope along a line of points: two strands' worth of gold light and dark in bands, so it reads as braided. */
function rope(pts: readonly V3[], r: number, n: number): Mesh {
  return tube(pts, r, r * 0.85, Math.max(5, n - 3), (ring, j) => ((ring + j) % 3 === 0 ? 'grip' : 'string'));
}

/**
 * The circlet, in the head's frame: a braided green band round its brow behind its ears, leaves along it lying back and out by
 * turns, and white flowers in it: one over its right eye; the Floramane's three.
 */
function circletOf(s: Cat, fine: boolean, n: number): Mesh {
  const C = skullAt(s), R = s.head.r, out: Mesh[] = [];
  const N = 16, band: V3[] = [], at: Array<{ p: V3; n: V3; t: V3 }> = [];
  for (let q = 0; q <= N; q++) {
    const a = (q / N) * TAU + Math.PI / 2, d: V3 = [Math.cos(a) * 0.9, Math.sin(a), 0.5 + 0.18 * Math.sin(a) + 0.1 * Math.cos(a) ** 2];
    const e = onEgg(C, R, d);
    band.push(add(e.p, scale(e.n, 0.02)));
    at.push({ p: e.p, n: e.n, t: unit([-Math.sin(a), Math.cos(a), 0]) });
  }
  const th = R[0] * 0.045;
  out.push(tube(band, th, th * 1.3, 5, (ring, j) => ((ring + j) % 2 ? 'moss' : 'leafDark'), { start: false, end: false }));
  // The leaves, along the band, each pointing round it and lifted out from the head, two rows by turns.
  const count = fine ? 22 : 13, L = R[0] * (s.stage === 2 ? 0.3 : 0.27), w = L * 0.36;
  for (let q = 0; q < count; q++) {
    const u = (q / count) * N, i = Math.floor(u), f = u - i, A = at[i], B = at[Math.min(N, i + 1)];
    const p = mixV(A.p, B.p, f), nn = unit(mixV(A.n, B.n, f)), tt = unit(mixV(A.t, B.t, f));
    const up = q % 2 ? 0.55 : -0.25, dir = unit(add(add(tt, scale(nn, 0.35)), [0, 0, up * 0.4]));
    out.push(leaf(add(p, scale(nn, 0.02)), dir, nn, L * (0.85 + 0.3 * jitter(q + 3)), w, LEAVES[q % 3], fine, 0.15));
  }
  const flowers: Array<[V3, number]> = s.stage === 2 ? [[[0.62, 0.55, 0.56], 1], [[-0.45, 0.66, 0.6], 0.8], [[0.88, 0.05, 0.5], 0.75]] : [[[0.62, 0.55, 0.56], 1]];
  flowers.forEach(([d, k0], q) => {
    const e = onEgg(C, R, d), r = R[0] * 0.17 * k0 * (s.stage === 0 ? 1.15 : 1);
    out.push(flowerOf(add(e.p, scale(e.n, r * 0.5)), unit(add(e.n, [0, 0.35, 0.2])), r, fine ? 4 : 2, q * 1.3, fine));
  });
  return merge(...out);
}

/** The Bloomwhisk's hood, in the head's frame: rows of leaves over its crown and down the back of its head, lying down on it. */
function hoodOf(s: Cat, fine: boolean, n: number, k: number): Mesh {
  const C = skullAt(s), R = s.head.r, out: Mesh[] = [];
  // The hood itself: a shell of green over the crown, the back of the head and its sides, open round the face and under the chin.
  const shellR = scale(R, 1.06), ball = orb(C, shellR, n + 6, k + 3, 'leafDark'), mouth = unit([0, 0.95, -0.25]);
  out.push(mesh(ball.v, ball.f.filter((f) => {
    const m = scale(f.i.reduce((t, i) => add(t, ball.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const d = unit([(m[0] - C[0]) / shellR[0], (m[1] - C[1]) / shellR[1], (m[2] - C[2]) / shellR[2]]);
    return dot(d, mouth) < 0.42 && d[2] > -0.62;
  })));
  const rows = [{ el: 0.75, count: fine ? 9 : 6, L: 0.42 }, { el: 0.35, count: fine ? 11 : 8, L: 0.45 }, { el: -0.1, count: fine ? 12 : 9, L: 0.42 }];
  rows.forEach((row, ri) => {
    for (let q = 0; q < row.count; q++) {
      // Round the back half of the head, from beside one ear to beside the other.
      const a = -Math.PI / 2 + (((q + 0.5) / row.count) - 0.5) * Math.PI * 1.25 + (ri % 2) * 0.1;
      const d: V3 = [Math.cos(a) * Math.sqrt(1 - row.el * row.el), Math.sin(a) * Math.sqrt(1 - row.el * row.el), row.el];
      const e = onEgg(C, R, d);
      const down = unit(sub([0, 0, -1], scale(e.n, -e.n[2])));
      const dir = unit(add(scale(down, 1), scale(e.n, 0.18)));
      const L = R[2] * row.L * (0.9 + 0.2 * jitter(q + ri * 7));
      out.push(leaf(add(e.p, scale(e.n, 0.03 + ri * 0.01)), dir, e.n, L, L * 0.42, LEAVES[(q + ri) % 3], fine, 0.12));
    }
  });
  return merge(...out);
}

/**
 * The leaves over its shoulders, in the chest's frame: rows of them round its shoulders and back, overlapping like shingles,
 * each rooted at its row's height and hanging down over the body, flaring out toward the bottom, the front left open more the
 * lower the row. The Sprigkit's capelet; the Bloomwhisk's robe to its knees; the Floramane's great mantle.
 */
function capeOf(s: Cat, fine: boolean): Mesh {
  const C = s.cape, out: Mesh[] = [];
  const top = s.shoulder[2] + [0.1, 0.12, 0.22][s.stage], step = (top - C.to) / (C.rows + 0.5);
  for (let row = C.rows - 1; row >= 0; row--) {
    const z0 = top - row * step, L = step * 1.55, u0 = row / Math.max(1, C.rows - 1);
    const count = Math.round((C.count + row * 2) * (fine ? 1 : 0.72)), open = lerp(C.open[0], C.open[1], u0);
    for (let q = 0; q < count; q++) {
      const a = Math.PI / 2 + open + ((q + 0.5 * (row % 2)) / count) * (TAU - 2 * open) + (jitter(q + row * 13) - 0.5) * 0.08;
      const Lq = L * (0.88 + 0.24 * jitter(q * 3 + row));
      const w = C.w * (fine ? 1 : 1.25) * (0.85 + 0.3 * jitter(q + 7 + row));
      const off = [0.08, 0.06, 0.02][s.stage] + (C.rows - 1 - row) * 0.035 * (1 + s.stage);
      const us = fine ? [0, 0.33, 0.66, 1] : [0, 0.5, 1];
      const pts = us.map((u) => onDrape(s, z0 - Lq * u, top, a, off + u * C.flare + u * u * w * 0.4));
      const o = unit([Math.cos(a), Math.sin(a), 0.35]);
      out.push(blade(pts, fine ? [w * 0.4, w, w * 0.8, w * 0.08] : [w * 0.42, w, w * 0.1], o, { mat: LEAVES[(q + row) % 3], rib: 'leafDark', fold: 0.3, thick: w * 0.1 }));
    }
  }
  return merge(...out);
}

/** The leaves hung from its belt, in the hips' frame: rows of them round the hips from the belt down, the front left open. */
function skirtOf(s: Cat, fine: boolean): Mesh {
  const K = s.skirt, out: Mesh[] = [];
  if (!K.rows) return mesh([], []);
  const top = s.belt, step = K.len / (K.rows + 0.5);
  for (let row = K.rows - 1; row >= 0; row--) {
    const z0 = top - row * step, L = step * 1.55;
    const count = Math.round((K.count + row * 2) * (fine ? 1 : 0.72));
    for (let q = 0; q < count; q++) {
      const a = Math.PI / 2 + K.open + ((q + 0.5 * (row % 2)) / count) * (TAU - 2 * K.open) + (jitter(q + row * 17) - 0.5) * 0.08;
      const Lq = L * (0.9 + 0.2 * jitter(q * 5 + row));
      const w = K.w * (fine ? 1 : 1.25) * (0.85 + 0.3 * jitter(q + 3 + row));
      const off = 0.03 + (K.rows - 1 - row) * 0.04 * (1 + s.stage);
      const us = fine ? [0, 0.33, 0.66, 1] : [0, 0.5, 1];
      const pts = us.map((u) => onSkirt(s, z0 - Lq * u, a, off + u * 0.08 * (1 + s.stage) + u * u * w * 0.3));
      const o = unit([Math.cos(a), Math.sin(a), 0.2]);
      out.push(blade(pts, fine ? [w * 0.4, w, w * 0.8, w * 0.08] : [w * 0.42, w, w * 0.1], o, { mat: LEAVES[(q + row + 1) % 3], rib: 'leafDark', fold: 0.3, thick: w * 0.1 }));
    }
  }
  return merge(...out);
}

/** The belt, in the hips' frame: a braided rope round its middle, a knot at the front. */
function beltOf(s: Cat, n: number): Mesh {
  const c = s.hips.c, z = s.belt, [w, h] = eggCut(c, s.hips.r, z), r = [0.045, 0.07, 0.1][s.stage], out: Mesh[] = [];
  const N = 20, pts: V3[] = [];
  for (let q = 0; q <= N; q++) {
    const a = (q / N) * TAU, d = unit([Math.cos(a) * h, Math.sin(a) * w, 0]);
    pts.push(add([Math.cos(a) * w, c[1] + Math.sin(a) * h, z + 0.015 * Math.sin(a * 2)], scale(d, r * 0.6 + [0.02, 0.03, 0.04][s.stage])));
  }
  out.push(rope(pts, r, n));
  // A second strand twisted round the first, on the bigger two: a braid.
  if (s.stage) out.push(rope(pts.map((p, q) => add(p, [0, 0, r * 1.2 * Math.sin(q * 2.4)])), r * 0.7, n));
  const k = knotAt(s);
  out.push(egg(k, UPRIGHT, [r * 2.2, r * 1.8, r * 2.0], 7, 4, 'grip'));
  out.push(rope(Array.from({ length: 7 }, (_, q) => { const a = (q / 6) * TAU; return add(k, [Math.cos(a) * r * 2.8 - r * 2.4, r * 0.8, Math.sin(a) * r * 1.8]); }), r * 0.7, n));
  out.push(rope(Array.from({ length: 7 }, (_, q) => { const a = (q / 6) * TAU; return add(k, [-Math.cos(a) * r * 2.8 + r * 2.4, r * 0.8, Math.sin(a) * r * 1.8]); }), r * 0.7, n));
  return merge(...out);
}

/** A tassel, in its own frame hanging down from its top: a knot of gold, a band, and a skirt of strands flaring to its foot. */
function tasselOf(L: number, n: number): Mesh {
  const r = L * 0.22;
  return merge(
    tube([[0, 0, 0.01], [0, 0, -L * 0.18]], [r * 0.3, r * 0.3], [r * 0.3, r * 0.3], 5, 'grip'),
    egg([0, 0, -L * 0.24], UPRIGHT, [r * 0.62, r * 0.62, r * 0.55], 6, 3, 'string'),
    tube([[0, 0, -L * 0.34], [0, 0, -L * 0.4]], r * 0.66, r * 0.66, n, 'grip'),
    tube([[0, 0, -L * 0.4], [0, 0, -L * 0.7], [0, 0, -L]], [r * 0.62, r * 0.85, r], [r * 0.62, r * 0.85, r], n, (ring, j) => (j % 3 === 0 ? 'hornDark' : 'string')),
  );
}

/** The Floramane's rope across its chest, in the chest's frame: from clasp to clasp under the mantle's edge, two gold clasps on it. */
function chestRopeOf(s: Cat, n: number): Mesh {
  const out: Mesh[] = [], z = s.torso.z[2] + 0.02;
  const pts: V3[] = [];
  for (let q = 0; q <= 10; q++) pts.push(onTorso(s, z + 0.05 * Math.sin((q / 10) * Math.PI), Math.PI / 2 - 0.9 + (q / 10) * 1.8, 0.1));
  out.push(rope(pts, 0.05, n), rope(pts.map((p, q) => add(p, [0, 0, 0.05 * Math.sin(q * 2.6)])), 0.035, n));
  for (const sd of [-1, 1]) {
    const c = claspAt(s, sd), r = torsoAt(s, z), nn = unit([Math.cos(Math.PI / 2 + sd * 0.42) * r.h, Math.sin(Math.PI / 2 + sd * 0.42) * r.w, 0]);
    out.push(egg(c, frameOf(nn, [0, 0, 1]), [0.1, 0.1, 0.05], 8, 3, 'fitting'));
    out.push(paint([disc(add(c, scale(nn, 0.055)), nn, 0.05, 0.05, 6, 'hornDark')]));
  }
  return merge(...out);
}

/** Where the panel hangs from, at the front of the belt, in the hips' frame. */
const PANEL_HINGE = (s: Cat): V3 => { const [, h] = eggCut(s.hips.c, s.hips.r, s.belt); return [0, s.hips.c[1] + h + 0.04, s.belt - 0.04]; };

/** The Floramane's panel, in its own frame from the hinge: cream cloth down to the ground, a gold edge, a great leaf embroidered on it. */
function panelOf(s: Cat): Mesh {
  const c = s.hips.c, Hr = s.hips.r, top = 0, bottom = -(s.high + s.belt - 0.12), hw = Hr[0] * 0.36, cols = 4, rowsN = 5;
  const front = (x: number, z: number): number => {
    const zz = z + PANEL_HINGE(s)[2];
    const u = 1 - (x / Hr[0]) ** 2 - ((zz - c[2]) / Hr[2]) ** 2;
    return (u > 0 ? c[1] + Hr[1] * Math.sqrt(u) : 0) - PANEL_HINGE(s)[1];
  };
  const grid: V3[][] = [];
  for (let r = 0; r <= rowsN; r++) {
    const z = lerp(top, bottom, r / rowsN), row: V3[] = [];
    for (let q = 0; q <= cols; q++) {
      const u = q / cols - 0.5, x = u * 2 * hw * (1 + 0.25 * r / rowsN);
      let y = 0.02;
      for (let k = 0; k <= r; k++) y = Math.max(y, front(x, lerp(top, bottom, k / rowsN)) + 0.04);
      row.push([x, y + 0.03 * (r / rowsN) - 0.08 * u * u, z]);
    }
    grid.push(row);
  }
  const m = sheet(grid, 'lining', 'clothDark');
  // The embroidery: a great leaf down its middle, its rib and veins, and a gold edge either side.
  const deco: Disc[] = [];
  const at = (u: number, v: number): V3 => { const r = u * rowsN, i = Math.min(rowsN - 1, Math.floor(r)), f = r - i, q = v * cols, j = Math.min(cols - 1, Math.floor(q)), g = q - j; return add(mixV(mixV(grid[i][j], grid[i][j + 1], g), mixV(grid[i + 1][j], grid[i + 1][j + 1], g), f), [0, 0.012, 0]); };
  const N: V3 = [0, 1, 0.1];
  const outline: V3[] = [];
  for (let q = 0; q <= 12; q++) { const u = 0.2 + 0.62 * (q / 12); outline.push(at(u, 0.5 + 0.3 * Math.sin(Math.PI * ((q / 12) ** 0.8)))); }
  for (let q = 12; q >= 0; q--) { const u = 0.2 + 0.62 * (q / 12); outline.push(at(u, 0.5 - 0.3 * Math.sin(Math.PI * ((q / 12) ** 0.8)))); }
  deco.push(facingDisc(outline, N, 'lace'));
  const rib: V3[] = [at(0.16, 0.49), at(0.84, 0.495), at(0.84, 0.505), at(0.16, 0.51)].map((p) => add(p, [0, 0.006, 0]));
  deco.push(facingDisc(rib, N, 'leafDark'));
  for (let q = 0; q < 4; q++) for (const sd of [-1, 1]) {
    const u = 0.3 + q * 0.13, a = at(u, 0.5), b = at(u + 0.08, 0.5 + sd * 0.2);
    deco.push(facingDisc([add(a, [0, 0.006, 0.012]), add(b, [0, 0.006, 0.008]), add(b, [0, 0.006, -0.008]), add(a, [0, 0.006, -0.012])], N, 'leafDark'));
  }
  for (const v of [0.04, 0.96]) deco.push(facingDisc([at(0, v - 0.035), at(1, v - 0.035), at(1, v + 0.035), at(0, v + 0.035)], N, 'string'));
  deco.push(facingDisc([at(0.95, 0.02), at(0.95, 0.98), at(1, 0.98), at(1, 0.02)], N, 'string'));
  return merge(m, paint(deco));
}

/** Leaf shapes embroidered on the Floramane's robe, in the chest's frame: pairs of green leaves round its front and sides. */
function embroideryOf(s: Cat): Mesh {
  const out: Disc[] = [], T = s.torso;
  const normal = (z: number, a: number): V3 => { const r = torsoAt(s, z); return unit([Math.cos(a) * r.h, Math.sin(a) * r.w, 0]); };
  for (const [z0, a0] of [[0.22, 0.62], [0.22, -0.62], [0.48, 1.05], [0.48, -1.05], [0.04, 1.2], [0.04, -1.2]] as Array<[number, number]>) {
    const z = lerp(T.z[0], T.z[2], z0 * 1.6), a = Math.PI / 2 + a0;
    const n = normal(z, a), p = onTorso(s, z, a, 0.012);
    for (const sd of [-1, 1]) {
      const d = unit(add([0, 0, 1], scale(cross([0, 0, 1], n), sd * 0.9)));
      out.push(disc(add(p, scale(d, 0.13)), n, 0.07, 0.15, 6, 'lace', { up: d }));
    }
    out.push(disc(add(p, [0, 0, -0.05]), n, 0.018, 0.12, 4, 'leafDark'));
  }
  // The robe's lapels: a gold-edged band down from either side of its neck, crossing over at its belly.
  for (const sd of [-1, 1]) {
    const N = 7, pts: Array<{ p: V3; n: V3 }> = [];
    for (let q = 0; q <= N; q++) {
      const u = q / N, z = lerp(T.z[3] - 0.04, T.z[0] + 0.3, u), a = Math.PI / 2 + sd * lerp(0.62, -0.1, u);
      pts.push({ p: onTorso(s, z, a, 0.014), n: normal(z, a) });
    }
    for (let q = 0; q < N; q++) {
      const A = pts[q], B = pts[q + 1], along = unit(sub(B.p, A.p));
      for (const [w0, w1, m, lift] of [[-0.075, 0.075, 'clothDark', 0], [-0.05, -0.022, 'string', 0.004], [0.022, 0.05, 'string', 0.004]] as Array<[number, number, Mat, number]>) {
        const sa = unit(cross(A.n, along)), sb = unit(cross(B.n, along));
        const pa = add(A.p, scale(A.n, lift)), pb = add(B.p, scale(B.n, lift));
        out.push(facingDisc([add(pa, scale(sa, w0)), add(pa, scale(sa, w1)), add(pb, scale(sb, w1)), add(pb, scale(sb, w0))], unit(add(A.n, B.n)), m));
      }
    }
  }
  return paint(out);
}

/** The torso, in the chest's frame, cut finer than its rings so its patches have edges: cream with its patches, or the Floramane's robe. */
function torsoOf(s: Cat, n: number): Mesh {
  const T = s.torso, K = 2, z: number[] = [], y: number[] = [], w: number[] = [], h: number[] = [];
  for (let q = 0; q < T.z.length - 1; q++) for (let k = 0; k < K; k++) {
    const f = k / K;
    z.push(lerp(T.z[q], T.z[q + 1], f)); y.push(lerp(T.y[q], T.y[q + 1], f)); w.push(lerp(T.w[q], T.w[q + 1], f)); h.push(lerp(T.h[q], T.h[q + 1], f));
  }
  z.push(T.z[T.z.length - 1]); y.push(T.y[T.y.length - 1]); w.push(T.w[T.w.length - 1]); h.push(T.h[T.h.length - 1]);
  const m = tube(z.map((zz, q) => [0, y[q], zz] as V3), w, h, n, 'mark', { up: [0, 1, 0] });
  if (s.stage === 2) return mesh(m.v, m.f.map((f) => ({ ...f, m: 'lining' as Mat })));
  const mid: V3 = [0, T.y[2], T.z[2]], r: V3 = [Math.max(...T.w), Math.max(...T.h), (T.z[T.z.length - 1] - T.z[0]) / 2];
  return patched(m, mid, r, TORSO_PATCHES, 'mark');
}

/** A soft furred limb's piece: a tube with a ball at its root so a bend never shows a gap. */
function limb(len: number, w0: number, w1: number, n: number, k: number, mat: Mat, ball = true): Mesh {
  return merge(
    ball ? egg([0, 0, 0], UPRIGHT, [w0 * 1.05, w0 * 1.05, w0 * 1.05], n, k, mat) : null,
    tube([[0, 0, 0], [0, 0, -len * 0.5], [0, 0, -len]], [w0, (w0 + w1) * 0.52, w1], [w0, (w0 + w1) * 0.52, w1], n, mat, { seam: 'both' }),
  );
}

/** A paw: a soft dark mitten, three toes on its front; and pink pads on its palm, on the paw that waves. */
function pawOf(s: Cat, n: number, k: number, palm: boolean): Mesh {
  const r = s.hand, out: Mesh[] = [egg([0, r * 0.15, -r * 0.4], UPRIGHT, [r * 1.0, r * 0.95, r * 1.1], n, k, 'pad')];
  // Its toes only where it is drawn big enough for them to show.
  if (n > 8) for (const q of [-1, 0, 1]) out.push(egg([q * r * 0.42, r * 0.62, -r * 1.0], UPRIGHT, [r * 0.3, r * 0.3, r * 0.3], 6, 3, 'pad'));
  if (palm) {
    out.push(paint([
      disc([0, r * 1.12, -r * 0.5], [0, 1, 0], r * 0.42, r * 0.34, 8, 'inner'),
      ...[-1, 0, 1].map((q) => disc([q * r * 0.42, r * 0.93, -r * 1.05 - 0.01 * Math.abs(q)], [0, 1, 0], r * 0.15, r * 0.15, 6, 'inner')),
    ]));
  }
  return merge(...out);
}

/** A foot: a dark oval pad, three toes round its front; the Bloomwhisk's right foot white. */
function footOf(s: Cat, n: number, k: number, mat: Mat): Mesh {
  const fw = s.leg.foot[1], fl = s.leg.foot[0], drop = s.leg.len[2];
  return merge(
    egg([0, fl * 0.2, -drop + fw * 0.45], UPRIGHT, [fw * 1.0, fl * 0.58, fw * 0.62], n, k, mat),
    ...(n > 8 ? [-1, 0, 1] : []).map((q) => egg([q * fw * 0.5, fl * 0.66, -drop + fw * 0.28], UPRIGHT, [fw * 0.32, fw * 0.36, fw * 0.3], 6, 3, mat)),
  );
}

/**
 * A link of the tail, in its bone's frame back along `-y`: one band of its stripes, and drawn big, a tuft of fur either side of
 * it flicked toward the tip, so the tail is a brush rather than a pipe.
 */
function tailLink(s: Cat, q: number, n: number): Mesh {
  const T = s.tail, L = T.links[q], w0 = T.w[q], w1 = T.w[q + 1], last = q === T.links.length - 1, mat = TAIL_BANDS[s.stage][q];
  const ws = [w0, lerp(w0, w1, 0.35) * 1.03, lerp(w0, w1, 0.7) * 1.03, w1];
  const tufts: Mesh[] = [];
  if (n > 8 && q > 0) {
    for (const sd of [-1, 1]) {
      const a = sd * (1.2 + 0.25 * jitter(q * 3 + sd)), r = lerp(w0, w1, 0.5), out: V3 = [Math.sin(a), 0, Math.cos(a)];
      const dir = unit(add(scale(out, 0.5), [0, -0.86, 0])), base: V3 = add([out[0] * r * 0.9, -L * 0.3, out[2] * r * 0.85], scale(dir, -r * 0.1));
      tufts.push(tube([base, add(base, scale(dir, r * 0.32)), add(base, scale(dir, r * 0.62))], [r * 0.34, r * 0.2, 0.006], [r * 0.2, r * 0.12, 0.006], 5, mat));
    }
  }
  return merge(tube([[0, 0.05, 0], [0, -L * 0.35, 0], [0, -L * 0.7, 0], [0, -L - (last ? 0 : 0.04), 0]], ws, ws.map((x) => x * 0.92), n, mat, { start: q === 0, end: last }), ...tufts);
}
/** Its tail's stripes, root to tip: orange, cream and dark brown, the tip dark. */
const TAIL_BANDS: readonly (readonly Mat[])[] = [
  ['coat', 'mark', 'coatDark', 'mark', 'coat', 'mark', 'coatDark'],
  ['coat', 'mark', 'coatDark', 'mark', 'coat', 'mark', 'coatDark'],
  ['coatDark', 'coat', 'mark', 'coatDark', 'mark', 'coat', 'mark', 'coatDark'],
];

/** The planter box, in its own frame from the middle of its foot: planks of wood round soil, mounded. */
function planterOf(s: Cat, n: number): Mesh {
  const [w, d, h] = PLANTER[s.stage], t = Math.min(w, d) * 0.12, out: Mesh[] = [];
  const plank = (side: number): Mat => (side === 1 ? 'woodDark' : 'wood');
  out.push(block([0, d - t, h / 2], [w, t, h / 2], UPRIGHT, plank), block([0, -d + t, h / 2], [w, t, h / 2], UPRIGHT, plank));
  out.push(block([w - t, 0, h / 2], [t, d - 2 * t, h / 2], UPRIGHT, plank), block([-w + t, 0, h / 2], [t, d - 2 * t, h / 2], UPRIGHT, plank));
  // A darker band round the planks, the boards' join.
  for (const sd of [-1, 1]) out.push(paint([disc([0, sd * (d + 0.003), h * 0.45], [0, sd, 0], w * 0.98, h * 0.03, 4, 'woodDark', { spin: Math.PI / 4 })]));
  out.push(block([0, 0, h * 0.82], [w - t * 1.5, d - t * 1.5, h * 0.06], UPRIGHT, 'hoof'));
  for (let q = 0; q < 5; q++) out.push(egg([(jitter(q) - 0.5) * w * 1.3, (jitter(q + 9) - 0.5) * d * 1.1, h * 0.88], UPRIGHT, [w * 0.2, d * 0.24, h * 0.07], n - 2, 3, q % 2 ? 'hoof' : 'bark'));
  return merge(...out);
}

/** A sprout, in its own frame from the soil up: a stem and two leaves; the Bloomwhisk's taller, with two more and a bud. */
function sproutOf(s: Cat, fine: boolean): Mesh {
  const H = SPROUT[s.stage], out: Mesh[] = [tube([[0, 0, -0.02], [0.01, 0, H * 0.5], [0, 0.01, H]], H * 0.06, H * 0.06, 5, 'stem')];
  const pair = (z: number, L: number, turn0: number): void => {
    for (const sd of [-1, 1]) {
      const d = unit([sd * Math.cos(turn0), sd * Math.sin(turn0), 0.55]);
      out.push(leaf([0, 0, z], d, [0, 0, 1], L, L * 0.45, sd > 0 ? 'leaf' : 'moss', fine, 0.2));
    }
  };
  pair(H * (s.stage === 0 ? 0.9 : 0.55), H * (s.stage === 0 ? 0.55 : 0.4), 0.3);
  if (s.stage) pair(H * 0.8, H * 0.32, 1.7);
  if (s.stage === 2) pair(H * 0.3, H * 0.4, 1.0);
  return merge(...out);
}

/** A seed: a small brown one, pointed at one end. */
const seedOf = (r: number): Mesh => egg([0, 0, 0], UPRIGHT, [r * 0.7, r * 0.7, r], 6, 3, 'bark');

/** The Bloomwhisk's watering jug, in its own frame from its foot up: a round clay jug, a handle at its back, a long spout forward. */
function jugOf(n: number): Mesh {
  const r = 0.11;
  return merge(
    tube([[0, 0, 0], [0, 0, r * 0.6], [0, 0, r * 1.3], [0, 0, r * 1.7]], [r * 0.8, r, r * 0.86, r * 0.5], [r * 0.8, r, r * 0.86, r * 0.5], n, (ring) => (ring === 1 ? 'shellDark' : 'shell')),
    tube([[0, r * 0.6, r * 0.5], [0, r * 1.4, r * 1.2], [0, r * 1.9, r * 1.7]], [r * 0.18, r * 0.13, r * 0.1], [r * 0.18, r * 0.13, r * 0.1], 5, 'shell'),
    tube([[0, -r * 0.6, r * 1.4], [0, -r * 1.25, r * 1.2], [0, -r * 1.2, r * 0.5], [0, -r * 0.8, r * 0.3]], r * 0.08, r * 0.08, 4, 'shellDark', { start: false, end: false }),
    paint([disc([0, 0, r * 1.71], [0, 0, 1], r * 0.4, r * 0.4, 8, 'hoof')]),
  );
}

/** The Floramane's big bloom, in its own frame: a white flower facing up and forward on a short stem. */
const bloomOf = (r: number, fine: boolean): Mesh => merge(
  flowerOf([0, 0, r * 0.25], unit([0, 0.5, 1]), r, fine ? 4 : 2, 0.5, fine),
  tube([[0, 0, r * 0.2], [0, 0, -r * 0.6]], r * 0.07, r * 0.07, 5, 'stem'),
);

/** A stage's pieces. */
function catBuild(s: Cat, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), fine = lod > 0, pieces: Piece[] = [];
  const hide = headSolids(s);
  const hipsSolid = { c: s.hips.c, r: scale(s.hips.r, 0.96) };
  pieces.push({ key: 'hips', mesh: patched(orb(s.hips.c, s.hips.r, n + 6, k + 3, 'mark'), s.hips.c, s.hips.r, s.stage === 2 ? [] : HIPS_PATCHES, s.stage === 2 ? 'lining' : 'mark'), bone: 'trunk', bias: 0 });
  pieces.push({ key: 'torso', mesh: torsoOf(s, n + 6), bone: 'chest', bias: 0.01, after: 'hips', breathes: { c: [0, 0, s.torso.z[2]], k: 0.04 } });
  if (s.stage === 2) pieces.push({ key: 'embroidery', mesh: embroideryOf(s), bone: 'chest', bias: 0.012, after: 'torso' });
  // The body as solids in the chest's frame, for what lies on it to be hidden behind: the torso's rings and the belly under them.
  const T = s.torso, chestSolids: Array<{ c: V3; r: V3 }> = [0.2, 0.45, 0.7].map((f) => {
    const z = lerp(T.z[0], T.z[T.z.length - 1], f), r = torsoAt(s, z);
    return { c: [0, r.y, z] as V3, r: [r.w * 0.9, r.h * 0.88, (T.z[T.z.length - 1] - T.z[0]) * 0.26] as V3 };
  });
  chestSolids.push({ c: sub(s.hips.c, s.chest), r: scale(s.hips.r, 0.92) });
  // Under the robe and the skirt, a solid where the legs are, so the leaves behind them do not come over them.
  const legsCore = { c: [0, s.hips.c[1] * 0.5, -s.high * 0.5] as V3, r: [s.leg.stance + s.leg.w[0], s.hips.r[1] * 0.8, s.high * 0.55] as V3 };
  pieces.push({ key: 'neck', mesh: tube([[0, 0, -0.1], [0, 0, s.neck.len + 0.05]], s.neck.w, s.neck.w * 0.9, n, 'mark'), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k), bone: 'head', bias: 0.2, hide });
  for (let i = 0; i < 2; i++) pieces.push({ key: `ear${i}`, mesh: earOf(s, i ? 1 : -1, n), bone: `ear${i}`, bias: 0.21, after: s.stage === 1 ? ['head', 'hood'] : 'head', hide, hideIn: 'head' });
  pieces.push({ key: 'circlet', mesh: circletOf(s, fine, n), bone: 'head', bias: 0.215, after: ['head', 'ear0', 'ear1', ...(s.stage === 1 ? ['hood'] : [])], hide });
  if (s.stage === 1) pieces.push({ key: 'hood', mesh: hoodOf(s, fine, n, k), bone: 'head', bias: 0.205, after: 'head', hide });
  // The leaves over its shoulders, and the belt and what hangs from it.
  // The leaves lie over the tops of its arms, which come out from under them.
  const capeAfter = s.stage === 2 ? ['torso', 'embroidery', 'arm0', 'arm1', 'chestrope'] : ['torso', 'arm0', 'arm1'];
  pieces.push({ key: 'cape', mesh: capeOf(s, fine), bone: 'chest', bias: 0.03, after: capeAfter, hide: s.stage === 1 ? [...chestSolids, { ...legsCore, c: sub(legsCore.c, s.chest) }] : chestSolids });
  if (s.skirt.rows) pieces.push({ key: 'skirt', mesh: skirtOf(s, fine), bone: 'body', bias: 0.025, after: ['hips', 'll0', 'lr0', 'll1', 'lr1'], hide: [hipsSolid, legsCore] });
  // The Sprigkit's flower, tucked into its belt at the root of its tail.
  const tuckedFlower = s.stage === 0 ? flowerOf(onSkirt(s, s.belt + 0.04, -Math.PI / 2 + 0.75, 0.12), unit([0.6, -0.5, 0.65]), 0.17, fine ? 4 : 2, 0.4, fine) : null;
  pieces.push({ key: 'belt', mesh: merge(beltOf(s, n), tuckedFlower), bone: 'body', bias: 0.04, after: ['hips', 'torso', ...(s.skirt.rows ? ['skirt'] : []), ...(s.stage === 1 ? ['cape'] : [])], hide: [hipsSolid] });
  if (s.stage) for (let q = 0; q < 2; q++) pieces.push({ key: `tassel${q}`, mesh: tasselOf([0, 0.4, 0.78][s.stage], n), bone: `tassel${q}`, bias: 0.045, after: ['belt', 'cape', ...(s.skirt.rows ? ['skirt', 'panel'] : [])], front: [0, 1, 0] });
  if (s.stage === 2) {
    pieces.push({ key: 'chestrope', mesh: chestRopeOf(s, n), bone: 'chest', bias: 0.02, after: ['torso', 'embroidery'], hide: chestSolids });
    for (let q = 2; q < 4; q++) pieces.push({ key: `tassel${q}`, mesh: tasselOf(0.48, n), bone: `tassel${q}`, bias: 0.045, after: ['chestrope', 'cape', 'torso'], front: [0, 1, 0] });
    pieces.push({ key: 'panel', mesh: panelOf(s), bone: 'panel', bias: 0.03, after: ['hips', 'skirt', 'll0', 'lr0', 'll1', 'lr1'], front: [0, 1, 0], lines: false });
  }
  // Flowers: at the Bloomwhisk's breast; on the Floramane's mantle, either side of its chest.
  if (s.stage === 1) {
    const p = onTorso(s, s.torso.z[2] + 0.04, Math.PI / 2 - 0.45, 0.2);
    pieces.push({ key: 'flower', mesh: flowerOf(p, unit([-0.35, 1, 0.35]), 0.12, fine ? 4 : 2, 0.7, fine), bone: 'chest', bias: 0.05, after: ['cape', 'torso'] });
  }
  if (s.stage === 2) {
    const fl = [[-0.62, 0.78, 0.17], [0.7, 0.92, 0.15]].map(([a, z, r], q) => flowerOf(onDrape(s, s.torso.z[2] + z * 0.5, s.shoulder[2] + 0.22, Math.PI / 2 + a, 0.32), unit([Math.cos(Math.PI / 2 + a) * 0.6, 1, 0.5]), r, fine ? 4 : 2, q + 0.4, fine));
    pieces.push({ key: 'flower', mesh: merge(...fl), bone: 'chest', bias: 0.05, after: ['cape', 'torso'] });
  }
  // The tail, in links, in its stripes.
  s.tail.links.forEach((_, q) => pieces.push({ key: `tail${q}`, mesh: tailLink(s, q, n), bone: `tail${q}`, bias: -0.1 + q * 0.005, chain: 'tail' }));
  // Legs: a round furred thigh, a short shin, a foot; dark feet, the Bloomwhisk's right one white.
  const L = s.leg;
  for (const [i, key] of [[0, 'll'], [1, 'lr']] as Array<[number, string]>) {
    const sd = i ? 1 : -1, front: V3 = [sd * 0.8, 0.5, 0];
    const fur: Mat = i ? 'mark' : 'coat';
    const thigh = merge(egg([0, 0.02, -L.len[0] * 0.3], UPRIGHT, [L.w[0] * 1.2, L.w[0] * 1.2, Math.max(L.len[0] * 0.9, L.w[0])], n, k, fur), tube([[0, 0, 0], [0, 0, -L.len[0]]], [L.w[0] * 1.05, L.w[1]], [L.w[0] * 1.05, L.w[1]], n, fur, { seam: 'start' }));
    const shin = tube([[0, 0, L.w[1] * 0.5], [0, 0.005, -L.len[1] * 0.55], [0, 0.01, -L.len[1]]], [L.w[1], L.w[1] * 0.96, L.w[1] * 0.9], [L.w[1], L.w[1] * 0.96, L.w[1] * 0.9], n, fur, { seam: 'start' });
    const foot = footOf(s, n, k, s.stage === 1 && i === 1 ? 'muzzle' : 'pad');
    pieces.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, after: ['hips'], front },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['hips', `${key}0`], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.02, after: ['hips', `${key}1`, ...(s.skirt.rows ? ['skirt'] : []), ...(s.stage === 1 ? ['cape'] : [])], front },
    );
  }
  // Arms: the upper arm in its patch's colour, the forearm cream, a dark paw.
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, front: V3 = [sd, 0.4, 0];
    const upperMat: Mat = s.stage === 2 ? 'coat' : i ? 'coat' : 'coatDark';
    const foreMat: Mat = s.stage === 2 ? (i ? 'coat' : 'coatDark') : 'mark';
    const upper = merge(egg([0, 0, -0.02], UPRIGHT, [s.armW[0] * 1.35, s.armW[0] * 1.35, s.armW[0] * 1.4], n, k, upperMat), limb(s.arm[0], s.armW[0] * 1.1, s.armW[1] * 1.1, n, k, upperMat, false));
    const fore = limb(s.arm[1] - s.hand * 0.4, s.armW[1] * 1.08, s.armW[1] * 0.9, n, k, foreMat);
    // The Bloomwhisk's waving paw goes up beside its head, so it is over the head and the hood whenever it is toward the viewer.
    const waver = s.stage === 1 && i === 0 ? ['head', 'hood', 'circlet', 'ear0'] : [];
    const armAfter = s.stage === 2 ? ['torso', 'embroidery'] : ['torso', 'cape', ...(s.stage === 1 ? ['flower'] : [])];
    pieces.push(
      { key: `arm${i}`, mesh: upper, bone: `arm${i}`, bias: 0.06, after: s.stage === 2 ? armAfter : ['torso'], front },
      { key: `fore${i}`, mesh: fore, bone: `elbow${i}`, bias: 0.065, after: [...armAfter, `arm${i}`, 'cape', 'belt', ...waver], front: waver.length ? [sd * 0.5, 1, 0] : front },
      { key: `hand${i}`, mesh: pawOf(s, n, k, s.stage === 1 && i === 0), bone: `hand${i}`, bias: 0.07, after: [...armAfter, `fore${i}`, 'cape', 'belt', ...waver], front: waver.length ? [sd * 0.5, 1, 0] : front },
    );
  }
  // What it works with, only while it works.
  const working = (a: Anim): boolean => a.act?.kind === 'work';
  pieces.push({ key: 'planter', mesh: planterOf(s, n), bone: 'planter', bias: -0.2, shown: working });
  pieces.push({ key: 'sprout', mesh: sproutOf(s, fine), bone: 'sprout', bias: 0.0, after: 'planter', shown: working, thin: true });
  if (s.stage === 0) {
    pieces.push({ key: 'seed', mesh: seedOf(0.07), bone: 'seed', bias: 0.08, after: 'hand1', shown: working });
    pieces.push({ key: 'sown', mesh: seedOf(0.07), bone: 'sown', bias: 0.0, after: 'planter', shown: working });
  }
  if (s.stage === 1) {
    pieces.push({ key: 'blossom', mesh: flowerOf([0, 0, 0.02], unit([0, 0.4, 1]), BLOOM_R[1], 0, 0.3, true), bone: 'bloom', bias: 0.01, after: ['planter', 'sprout'], shown: working, bent: openBloom });
    pieces.push({ key: 'jug', mesh: jugOf(n), bone: 'jug', bias: 0.075, after: 'hand1', shown: working });
  }
  if (s.stage === 2) {
    pieces.push({ key: 'bud', mesh: bloomOf(BLOOM_R[2], fine), bone: 'bud', bias: 0.01, after: ['planter', 'sprout'], shown: working });
    pieces.push({ key: 'bloomHeld', mesh: bloomOf(BLOOM_R[2], fine), bone: 'bloomHeld', bias: 0.08, after: ['cape', 'flower', 'hand0'], shown: working });
  }
  return pieces;
}

/** The Bloomwhisk's flower opening: its petals folded up into a bud, and spread as the go goes on. */
const openBloom = (v: readonly V3[], a: Anim): V3[] => {
  const t = a.act?.kind === 'work' ? a.act.t : 0, k = ramp(t, CAT_WORK.bloom - 0.06, CAT_WORK.bloom + 0.06) * (1 - ramp(t, 0.96, 1));
  return v.map((p) => { const r = Math.hypot(p[0], p[1]), s = 0.25 + 0.75 * k; return [p[0] * s, p[1] * s, p[2] + r * (1 - k) * 1.6] as V3; });
};

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a pixel is, in the units `g` is drawing in. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const SOIL: RGB = [128, 96, 70];
const WATER_RGB: RGB = [176, 220, 240];
const WATER_INK: RGB = [74, 122, 152];
const PETAL_RGB: RGB = [252, 250, 244];
const LEAF_RGB: readonly RGB[] = [[132, 164, 92], [154, 178, 104], [94, 124, 72]];
const GRAVITY = 9;

/** A puff of soil or dust, growing and thinning over its life. */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, c: RGB): void {
  if (age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at), al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.8 * age);
  const grad = g.createRadialGradient(x, y - rr * 0.2 * age, 0, x, y - rr * 0.2 * age, rr);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - rr, y - rr * 1.2, rr * 2, rr * 2);
}

/** A bit of something thrown from `from`, `since` seconds after, out and up, falling: soil crumbs, drops, petals or leaves. */
function bits(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, kind: 'soil' | 'drop' | 'petal' | 'leaf', life = 0.5): void {
  if (since < 0 || since > life) return;
  const px = pxOf(g);
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.7 * jitter(k + 1));
    const fall = kind === 'petal' || kind === 'leaf' ? 0.25 : 1;
    const p: V3 = [from[0] + Math.cos(a) * sp * since, from[1] + Math.sin(a) * sp * since, Math.max(0.02, from[2] + up * (0.6 + 0.7 * jitter(k + 2)) * since - 0.5 * GRAVITY * fall * since * since)];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p), al = 1 - smooth((since - life * 0.6) / (life * 0.4)), r = Math.max(size * (0.7 + 0.6 * jitter(k + 3)), px * 1.1);
    if (kind === 'soil') {
      g.fillStyle = css(SOIL, al);
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    } else if (kind === 'drop') {
      g.fillStyle = css(WATER_INK, al * 0.9);
      g.beginPath();
      g.ellipse(x, y, r + 0.45 * px, r * 1.3 + 0.45 * px, 0, 0, TAU);
      g.fill();
      g.fillStyle = css(WATER_RGB, al);
      g.beginPath();
      g.ellipse(x, y, r, r * 1.3, 0, 0, TAU);
      g.fill();
    } else {
      const c = kind === 'petal' ? PETAL_RGB : LEAF_RGB[q % 3], spin = a * 3 + since * 9;
      g.fillStyle = css(c, al);
      g.strokeStyle = css(mix(c, [60, 70, 50], 0.6), al);
      g.lineWidth = Math.max(px * 0.8, r * 0.2);
      g.beginPath();
      g.ellipse(x, y, r * 1.4, r * 0.6, spin, 0, TAU);
      g.fill();
      g.stroke();
    }
  }
}

/** How big a stage's bits are drawn, against the Bloomwhisk's. */
const bigOf = (s: Cat): number => [0.7, 1, 1.5][s.stage];

/**
 * What a go at its task throws. The Sprigkit's: soil kicked up at each pat and as the seed goes in. The Bloomwhisk's: water
 * pouring from the jug's spout onto the sprout, and petals and sparkles as the flower opens. The Floramane's: soil and a leaf or
 * two as the bloom is plucked, and petals as it is tucked away.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Cat, b: Bones, t: number, front: boolean): void {
  const W = CAT_WORK, mid = b.chest.t, T = ACT_SECS.work, big = bigOf(s);
  const soil = b.planter ? place(b.planter, [0, 0, PLANTER[s.stage][2] * 0.95]) : mid;
  if (s.stage === 0) {
    for (const [c, id] of [[W.pats[0], 3], [W.pats[1], 11], [W.sow, 19], [W.tamp, 27]] as Array<[number, number]>) {
      bits(g, view, mid, soil, (t - c) * T, front, 6, id, 0.6, 1.2, 0.022, 'soil', 0.35);
      if (front) puff(g, view, soil, 0.18, (t - c) / 0.3, [176, 150, 120]);
    }
    if (front) puff(g, view, add(soil, [0, 0, 0.1]), 0.14, (t - W.sprout) / 0.15, [226, 240, 200]);
    return;
  }
  if (s.stage === 1) {
    const jug = b.jug;
    if (jug && t > W.pour && t < W.poured + 0.04) {
      const spout = place(jug, [0, 0.21, 0.19]), target = add(soil, [0, 0, 0.08]);
      for (let q = 0; q < 9; q++) {
        const u = frac(t * 7 + q / 9), p = mixV(spout, target, u);
        p[2] = lerp(spout[2], target[2], u * u);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p), r = Math.max(0.018, pxOf(g) * 1.1);
        g.fillStyle = css(WATER_INK, 0.85);
        g.beginPath();
        g.ellipse(x, y, r + pxOf(g) * 0.4, r * 1.5 + pxOf(g) * 0.4, 0, 0, TAU);
        g.fill();
        g.fillStyle = css(WATER_RGB, 0.95);
        g.beginPath();
        g.ellipse(x, y, r, r * 1.5, 0, 0, TAU);
        g.fill();
      }
      bits(g, view, mid, soil, frac(t * 5) * 0.2, front, 3, 31, 0.5, 0.6, 0.018, 'drop', 0.2);
    }
    const top = add(soil, [0, 0, SPROUT[1]]);
    bits(g, view, mid, top, (t - W.bloom) * T, front, 7, 41, 0.5, 1.1, 0.03, 'petal', 0.6);
    if (front) puff(g, view, top, 0.22, (t - W.bloom + 0.02) / 0.2, [255, 246, 200]);
    return;
  }
  bits(g, view, mid, add(soil, [0, 0, 0.05]), (t - W.pluck) * T, front, 9, 53, 0.9 * big, 1.6, 0.035, 'soil', 0.45);
  bits(g, view, mid, add(soil, [0, 0, SPROUT[2]]), (t - W.pluck) * T, front, 4, 61, 0.7, 1.4, 0.05, 'leaf', 0.6);
  if (b.bloomHeld) bits(g, view, mid, b.bloomHeld.t, (t - W.tuck) * T, front, 6, 71, 0.6, 1.0, 0.04, 'petal', 0.5);
  if (front) puff(g, view, add(soil, [0, 0, SPROUT[2] + 0.2]), 0.4, (t - 0.9) / 0.1, [255, 246, 200]);
}

/** What a strike throws: leaves flying off it as the blow lands, and the Floramane's thump of dust. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Cat, b: Bones, t: number, front: boolean): void {
  const since = (t - CAT_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t, big = bigOf(s);
  if (since <= 0) return;
  const paw = place(b.hand1, [0, 0, 0]);
  bits(g, view, mid, paw, since, front, 5 + 2 * s.stage, 7 + s.stage * 5, 1.2 * big, 1.4, 0.05 * big, 'leaf', 0.5);
  if (s.stage === 2 && front) puff(g, view, [mid[0], mid[1] + 0.8, 0.1], 0.9, since / 0.45, [214, 204, 186]);
}

/** Evolving: leaves and white petals spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Cat, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const R0 = s.hips.r[0] * 1.7 + 0.2, high = s.torso.z[4] + s.high + s.head.up * 2, px = pxOf(g);
  for (let q = 0; q < 20; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.38), ang = (q / 20) * TAU + u * TAU * 1.5, k = (1 - u) ** 1.1;
    const p: V3 = [Math.cos(ang) * R0 * k, Math.sin(ang) * R0 * k, 0.2 + u * high * 0.8];
    if (nearSide(p, b.chest.t, view) !== front) continue;
    const [x, y] = onScreen(view, p), r = (0.07 + 0.03 * s.stage) * (1 - 0.4 * u), al = swirl * ramp(u, 0, 0.12);
    const c = q % 3 === 2 ? PETAL_RGB : LEAF_RGB[q % 3];
    g.fillStyle = css(c, al);
    g.strokeStyle = css(mix(c, [60, 70, 50], 0.6), al);
    g.lineWidth = Math.max(px * 0.8, r * 0.2);
    g.beginPath();
    g.ellipse(x, y, r * 1.5, r * 0.6, ang * 2, 0, TAU);
    g.fill();
    g.stroke();
  }
}

/** Light over it as it evolves: a pale green glow as it begins, and over its head at the turn. */
function catGlow(s: Cat, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], T = s.torso, tall = T.z[T.z.length - 1] - T.z[0] + s.high;
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.chest, [0, 0, T.z[2]]), r: tall, c: [214, 236, 190], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.head, skullAt(s)), r: tall * 1.2, c: [246, 242, 206], a: k });
  return out;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it works, strikes and evolves. */
function catKind(s: Cat): Kind {
  const bones = catBones(s);
  return {
    bones,
    build: (lod) => catBuild(s, lod),
    // The variant's coat is its orange patches, the dark brown ones a deep shade of it, and its markings the cream of its fur.
    // Its pink ears and nose, dark paws, leaves, flowers, gold rope and cream robe are the same on every variant.
    palette: (coat, mark) => {
      const orange = mix(coat, pastel(coat, 30), 0.25), cream = mix([250, 234, 206], pastel(mark, 40), 0.35);
      const dark = mix(orange, [66, 46, 42], 0.66);
      return coatPalette(coat, mark, {
        coat: orange,
        coatDark: dark,
        coatLight: mix(orange, [255, 248, 236], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 254, 250], 0.6),
        inner: [240, 160, 160],
        nose: [228, 132, 138],
        membrane: [246, 196, 188],
        lid: [70, 46, 42],
        eye: [58, 38, 36],
        pad: mix(dark, [44, 32, 32], 0.25),
        leaf: [104, 140, 74],
        moss: [138, 166, 86],
        leafDark: [72, 104, 58],
        stem: [110, 146, 80],
        petal: [252, 250, 244],
        bloom: [246, 204, 86],
        string: [226, 184, 104],
        hornDark: [176, 132, 64],
        grip: [184, 138, 70],
        fitting: [222, 176, 84],
        lining: [246, 236, 214],
        clothDark: [214, 200, 172],
        lace: [146, 176, 104],
        wood: [196, 150, 98],
        woodDark: [156, 112, 72],
        bark: [116, 84, 60],
        hoof: [96, 70, 54],
        shell: [214, 140, 100],
        shellDark: [178, 108, 76],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.hips.r[1] * 1.5 + s.tail.links.reduce((x, y) => x + y, 0) * 0.15, s.hips.r[0] * 1.3],
    stride: 1.4,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are a leaf's green and a petal's cream.
    motes: [[156, 196, 110], [250, 240, 214]],
    glow: (b, a) => catGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SPRIGKIT = catKind(SPRIGKIT_LOOK);
export const BLOOMWHISK = catKind(BLOOMWHISK_LOOK);
export const FLORAMANE = catKind(FLORAMANE_LOOK);
