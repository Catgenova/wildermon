import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, shadowOf, smile, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The nail line: the Nailsprout, a small round mole sitting up, grey-brown
 * over cream with pink ears and nose, a rosy cheek and big pale digging
 * claws, under a cap of grey stone plates like a helmet of pebbles, a small
 * stone-headed hammer in its paw and a woven basket of nails and metal bits
 * on its back; which grows into the Hammertin, bigger and upright, the same
 * cap, stone plates over its shoulders, a leather harness through a round
 * brass buckle, a bigger hammer held up and a basket bound in leather and
 * brass full of big nails; and then the Nailwright, large and stout, its eyes
 * shut in a content smile, a big cap and big pauldrons, a leather harness
 * through a brass ring, a heavy sledge, a scaled stone plate down its back
 * and on it a huge iron-banded crate heaped with ore and a sheaf of giant
 * nails standing up out of it. The species is still `dowse` underneath, as
 * saves and the database know it: it smiths iron lumps into nails at your
 * anvils.
 *
 * Each is its variant's coat on its back, head and limbs and its markings on
 * its belly, muzzle and cheeks; the stone, leather, brass, iron and wood are
 * the same on every variant. All three are built by one set of functions from
 * a description of the stage (`Smith`), the way the penguin line is
 * (`./wild-penguin`): its legs bent to put each foot where it is to be, its
 * arms bent to put its paws where they are to be, and its hammer posed in the
 * chest's frame while it is carried (`Plan.grip`, `dir`, `face`) and in the
 * ground's while it is swung at something (`Plan.aim`), held in the paw
 * wherever the arm can reach. It waddles, rolled from foot to foot, what is in
 * its pack rattling.
 *
 * At its task it smiths a nail on an anvil in front of it, the anvil there
 * only while it works: the Nailsprout taps a small nail it pins with its
 * claws, four quick light taps; the Hammertin brings its hammer down from
 * over its head, twice, sparks flying; the Nailwright swings its sledge in
 * both paws, two heavy blows one after the other and a burst of sparks, then
 * flips the finished nail over its shoulder into its crate (`NAIL_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Smith {
  stage: 0 | 1 | 2;
  /** How high the hips are carried standing. */
  high: number;
  /** The hip on the right in the body's frame; thigh, shin and the ankle's height over the sole; how thick the leg; the foot's length and width; how far out each foot stands and how far ahead of the hip. */
  leg: { at: V3; len: [number, number, number]; w: number; foot: [number, number]; stance: number; ahead: number };
  /** The body's rings in the chest's frame, bottom to top: how high, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** The cream oval of its belly: how far round from straight ahead it comes at its widest (radians either side), and how far up the body that is (a share of it). */
  bib: [number, number];
  /** The right shoulder in the chest's frame; the upper arm and the forearm, and how thick each; the paw's size; the free paw's claws, how long and how thick. */
  shoulder: V3;
  arm: [number, number];
  armW: [number, number];
  paw: number;
  claw: [number, number];
  neck: { at: V3; len: number; w: number };
  /** The skull's half-sizes, how far its middle is over the top of the neck, and how far nose-up it is carried. */
  head: { r: V3; up: number; pitch: number };
  /** The snout: how long, how wide and how deep at its root; and the pink nose on its end, how big. */
  snout: { len: number; w: number; h: number };
  nose: number;
  /** The eyes: the way out of the skull to the right one, how big, and whether they are shut in a smile. */
  eye: { dir: V3; size: number; shut: boolean };
  ear: number;
  /** The cap of stone slabs: how much bigger than the skull it sits, the crown's one and how many in the ring round it (the third unused), and how many down the nape. */
  cap: { k: number; rows: number[]; nape: number };
  /** The stone plates over each shoulder: how big, and how many down the arm; nought for none. */
  pauldron: number;
  plates: number;
  /** What it wears: straps for its basket; a harness through a brass buckle; a harness through a brass ring. */
  harness: 0 | 1 | 2;
  /** The hammer: its handle behind the grip and ahead of it to the head's middle; its head, how long, how wide and how deep; and whether a sledge, swung in both paws. */
  hammer: { butt: number; len: number; head: [number, number, number]; sledge: boolean };
  /**
   * What it carries on its back: its foot's middle in the chest's frame, tipped back how far (degrees); a basket's radius at its
   * foot and at its rim, or a crate's half across and half deep; how tall; and the nails standing in it, how many and how long,
   * and the metal bits or the ore heaped in it, how many.
   */
  pack: { at: V3; r: [number, number]; h: number; tip: number; nails: number; nail: number; bits: number };
  crate: boolean;
  /** The plate of stone scales down its back, in rows; nought for none. */
  back: number;
  tail: number;
  /** Its swing at the anvil: how far forward of upright its chest is bent, how high the anvil's top is, and how far its hammer's head is turned in toward its middle (degrees). */
  smith: { lean: number; top: number; yaw: number };
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the hips sink at each footfall; how far it rolls and sways over each foot. */
    step: number; bob: number; roll: number; sway: number;
  };
  size: number;
}

/** A Nailsprout: small and round, a big head under its cap of pebbles, a little hammer, and a basket of nails and bits on its back. */
const NAILSPROUT_LOOK: Smith = {
  stage: 0,
  high: 0.11,
  leg: { at: [0.15, 0.02, -0.03], len: [0.05, 0.05, 0.035], w: 0.07, foot: [0.19, 0.13], stance: 0.16, ahead: 0.07 },
  torso: { z: [-0.09, -0.06, 0.0, 0.09, 0.18, 0.26, 0.32, 0.36], y: [0.0, 0.01, 0.02, 0.03, 0.02, 0.01, 0.0, -0.01], w: [0.1, 0.3, 0.39, 0.41, 0.39, 0.34, 0.27, 0.18], h: [0.09, 0.27, 0.35, 0.37, 0.35, 0.3, 0.24, 0.16] },
  bib: [0.64, 0.46],
  shoulder: [0.31, 0.02, 0.24],
  arm: [0.1, 0.1],
  armW: [0.068, 0.058],
  paw: 0.072,
  claw: [0.15, 0.036],
  neck: { at: [0, 0.02, 0.3], len: 0.03, w: 0.2 },
  head: { r: [0.37, 0.34, 0.3], up: 0.16, pitch: 2 },
  snout: { len: 0.16, w: 0.13, h: 0.11 },
  nose: 0.04,
  eye: { dir: [0.44, 0.82, 0.16], size: 0.088, shut: false },
  ear: 0.09,
  cap: { k: 1.04, rows: [1, 4, 0], nape: 2 },
  pauldron: 0,
  plates: 0,
  harness: 0,
  hammer: { butt: 0.05, len: 0.25, head: [0.15, 0.085, 0.085], sledge: false },
  pack: { at: [0, -0.38, 0.17], r: [0.17, 0.23], h: 0.3, tip: 20, nails: 5, nail: 0.27, bits: 4 },
  crate: false,
  back: 0,
  tail: 0.17,
  smith: { lean: 16, top: 0.16, yaw: 16 },
  gait: { duty: [0.6, 0.42], swing: [0.55, 0.55], step: 0.6, bob: 0.07, roll: 10, sway: 0.08 },
  size: 6.4,
};

/** A Hammertin: bigger and upright, stone pauldrons, a harness through a brass buckle, a hammer held up, and a bound basket of big nails. */
const HAMMERTIN_LOOK: Smith = {
  stage: 1,
  high: 0.18,
  leg: { at: [0.24, 0.02, -0.05], len: [0.09, 0.09, 0.05], w: 0.1, foot: [0.29, 0.2], stance: 0.25, ahead: 0.09 },
  torso: { z: [-0.15, -0.1, 0.02, 0.2, 0.38, 0.54, 0.66, 0.74], y: [0.0, 0.02, 0.04, 0.05, 0.04, 0.02, 0.0, -0.02], w: [0.18, 0.46, 0.58, 0.6, 0.56, 0.49, 0.4, 0.28], h: [0.16, 0.4, 0.5, 0.52, 0.48, 0.42, 0.34, 0.25] },
  bib: [0.6, 0.44],
  shoulder: [0.47, 0.0, 0.55],
  arm: [0.2, 0.19],
  armW: [0.1, 0.085],
  paw: 0.095,
  claw: [0.28, 0.05],
  neck: { at: [0, 0.02, 0.68], len: 0.05, w: 0.28 },
  head: { r: [0.39, 0.37, 0.32], up: 0.17, pitch: 2 },
  snout: { len: 0.2, w: 0.15, h: 0.125 },
  nose: 0.045,
  eye: { dir: [0.45, 0.82, 0.16], size: 0.062, shut: false },
  ear: 0.1,
  cap: { k: 1.04, rows: [1, 6, 0], nape: 3 },
  pauldron: 0.22,
  plates: 3,
  harness: 1,
  hammer: { butt: 0.1, len: 0.42, head: [0.26, 0.14, 0.14], sledge: false },
  pack: { at: [0, -0.66, 0.16], r: [0.27, 0.34], h: 0.62, tip: 12, nails: 8, nail: 0.5, bits: 0 },
  crate: false,
  back: 0,
  tail: 0.27,
  smith: { lean: 14, top: 0.3, yaw: 14 },
  gait: { duty: [0.6, 0.42], swing: [0.5, 0.5], step: 0.55, bob: 0.07, roll: 8, sway: 0.08 },
  size: 6.0,
};

/** A Nailwright: large and stout, eyes shut in a smile, big cap and pauldrons, a sledge, a scaled stone back and a great crate of ore and nails. */
const NAILWRIGHT_LOOK: Smith = {
  stage: 2,
  high: 0.24,
  leg: { at: [0.4, 0.03, -0.07], len: [0.12, 0.12, 0.07], w: 0.15, foot: [0.4, 0.29], stance: 0.42, ahead: 0.12 },
  torso: { z: [-0.22, -0.14, 0.04, 0.34, 0.64, 0.9, 1.08, 1.18], y: [0.0, 0.06, 0.12, 0.13, 0.1, 0.04, 0.0, -0.03], w: [0.34, 0.88, 1.05, 1.07, 0.98, 0.82, 0.62, 0.42], h: [0.3, 0.78, 0.95, 0.97, 0.87, 0.7, 0.52, 0.38] },
  bib: [0.66, 0.44],
  shoulder: [0.74, -0.02, 0.88],
  arm: [0.32, 0.3],
  armW: [0.16, 0.13],
  paw: 0.15,
  claw: [0.38, 0.07],
  neck: { at: [0, 0.02, 1.1], len: 0.06, w: 0.44 },
  head: { r: [0.58, 0.55, 0.48], up: 0.24, pitch: 6 },
  snout: { len: 0.26, w: 0.22, h: 0.18 },
  nose: 0.06,
  eye: { dir: [0.46, 0.82, 0.18], size: 0.09, shut: true },
  ear: 0.14,
  cap: { k: 1.04, rows: [1, 7, 0], nape: 3 },
  pauldron: 0.34,
  plates: 4,
  harness: 2,
  hammer: { butt: 0.16, len: 1.0, head: [0.7, 0.4, 0.4], sledge: true },
  pack: { at: [0, -1.2, 0.1], r: [0.78, 0.48], h: 1.22, tip: -6, nails: 7, nail: 0.95, bits: 12 },
  crate: true,
  back: 3,
  tail: 0.36,
  smith: { lean: 10, top: 0.42, yaw: 4 },
  gait: { duty: [0.62, 0.44], swing: [0.45, 0.45], step: 0.5, bob: 0.08, roll: 8, sway: 0.08 },
  size: 5.6,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A knock ringing out: nothing before, then a swing of `f` a second dying away. */
const ringOut = (since: number, f = 1.6, damp = 2.6): number => (since < 0 || since > 30 ? 0 : Math.exp(-since * damp) * Math.sin(since * TAU * f));
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
/** A frame whose `y` runs along `axis` and whose `z` is as near `toward` as that allows: a nail along the way it flies. */
function along(axis: V3, toward: V3, t: V3): Xf {
  const Y = unit(axis);
  let Z = sub(toward, scale(Y, dot(toward, Y)));
  if (len3(Z) < 1e-4) Z = sub([1, 0, 0], scale(Y, Y[0]));
  Z = unit(Z);
  return xfOf(cross(Y, Z), Y, Z, t);
}
/** A frame made `k` times bigger, nought for a thing not there. */
const scaled = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k), m = x.m; return { m: [m[0] * q, m[1] * q, m[2] * q, m[3] * q, m[4] * q, m[5] * q, m[6] * q, m[7] * q, m[8] * q], t: x.t }; };
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
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
/** Each face wound to face the way it is wanted to, whichever way round its corners were listed. */
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

/** A box `h` half-sizes about `c`, square to the frame: a plank, a band of iron, an anvil's face. */
const box = (c: V3, h: V3, mat: Mat): Mesh => tube([[c[0], c[1] - h[1], c[2]], [c[0], c[1] + h[1], c[2]]], h[0] * Math.SQRT2, h[2] * Math.SQRT2, 4, mat);

/**
 * A lump of stone: a block of `n` sides standing along `up` with its edges cut back by `bevel`, `r` across, along and high (half
 * sizes), every corner knocked off true by `rough` of its size so no two are alike: flat faces meeting at hard edges. Flat, it is
 * a plate of the cap or a scale of the back.
 */
function rock(c: V3, r: V3, o: { up?: V3; fwd?: V3; n?: number; bevel?: number; rough?: number; seed: number; mat: Mat; spin?: number }): Mesh {
  const n = o.n ?? 5, bv = o.bevel ?? 0.32, rough = o.rough ?? 0.16, sd = o.seed;
  const U = unit(o.up ?? [0, 0, 1]);
  let X = cross(o.fwd ?? [0, 1, 0], U);
  if (len3(X) < 1e-4) X = cross([0, 1, 0.3], U);
  X = unit(X);
  const Y = cross(U, X), Z = U;
  const rings: Array<[number, number]> = [[-1, 1 - bv], [-1 + bv * 0.9, 1], [1 - bv * 0.9, 1], [1, 1 - bv]];
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const spin = o.spin ?? jitter(sd + 0.5) * TAU;
  const at = (x: number, y: number, z: number): V3 => add(c, add(add(scale(X, x * r[0]), scale(Y, y * r[1])), scale(Z, z * r[2])));
  rings.forEach(([z, k], q) => {
    for (let j = 0; j < n; j++) {
      const id = sd * 7.3 + q * 13 + j;
      const a = spin + ((j + 0.3 * (jitter(id) - 0.5)) / n) * TAU, kk = k * (1 + rough * (jitter(id + 3) - 0.5) * 2);
      v.push(at(Math.cos(a) * kk, Math.sin(a) * kk, z + rough * (jitter(id + 5) - 0.5) * (q === 0 || q === rings.length - 1 ? 0.8 : 1.2)));
    }
  });
  const centroid = (idx: number[]): V3 => scale(idx.reduce((s, i) => add(s, v[i]), [0, 0, 0] as V3), 1 / idx.length);
  const push = (idx: number[]): void => { f.push({ i: idx, m: o.mat }); want.push(sub(centroid(idx), c)); };
  push(Array.from({ length: n }, (_, j) => j));
  for (let q = 0; q < rings.length - 1; q++) {
    const A = q * n;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      push([A + j, A + j2, A + n + j2, A + n + j]);
    }
  }
  push(Array.from({ length: n }, (_, j) => (rings.length - 1) * n + j));
  want[0] = scale(Z, -1);
  want[want.length - 1] = Z;
  return mesh(v, wound(v, f, want));
}
/** The two greys a plate of stone comes in, by its number: mostly the paler. */
const stoneMat = (i: number): Mat => (jitter(i * 3.7 + 2) < 0.68 ? 'stone' : 'stoneDark');

/**
 * A flat strap through points, each with the way out of what it lies on there: `w` across and `t` thick, its two ends closed. A
 * strap of leather, a band round a basket.
 */
function band(pts: readonly V3[], outs: readonly V3[], w: number, t: number, mat: Mat): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], mids: V3[] = [];
  const ds: V3[] = [];
  for (let q = 0; q < pts.length; q++) {
    const d = unit(sub(pts[Math.min(pts.length - 1, q + 1)], pts[Math.max(0, q - 1)]));
    const o = unit(sub(outs[q], scale(d, dot(outs[q], d)))), x = unit(cross(o, d));
    for (const [a, b] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) v.push(add(pts[q], add(scale(x, (a * w) / 2), scale(o, (b * t) / 2))));
    mids.push(pts[q]);
    ds.push(d);
  }
  const cen = (idx: number[]): V3 => scale(idx.reduce((s, i) => add(s, v[i]), [0, 0, 0] as V3), 1 / idx.length);
  for (let q = 0; q < pts.length - 1; q++) {
    const m = mixV(mids[q], mids[q + 1], 0.5);
    for (let j = 0; j < 4; j++) {
      const j2 = (j + 1) % 4, idx = [q * 4 + j, q * 4 + j2, (q + 1) * 4 + j2, (q + 1) * 4 + j];
      f.push({ i: idx, m: mat });
      want.push(sub(cen(idx), m));
    }
  }
  const E = (pts.length - 1) * 4;
  f.push({ i: [0, 1, 2, 3], m: mat });
  want.push(scale(ds[0], -1));
  f.push({ i: [E, E + 1, E + 2, E + 3], m: mat });
  want.push(ds[ds.length - 1]);
  return mesh(v, wound(v, f, want));
}

/** A ring of `R` round `c`, square to `nrm`, `r` thick: a buckle's frame, a band round a nail sheaf. */
function hoop(c: V3, nrm: V3, R: number, r: number, mat: Mat, sides = 12): Mesh {
  const [X, Y] = frameOf(nrm, Math.abs(nrm[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]);
  const pts: V3[] = Array.from({ length: sides + 1 }, (_, q) => add(c, add(scale(X, Math.cos((q / sides) * TAU) * R), scale(Y, Math.sin((q / sides) * TAU) * R))));
  return tube(pts, r, r, 5, mat, { start: false, end: false });
}

/** The torso's ring at height `z` in the chest's frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Smith, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/** A point on the body's skin at height `z` in the chest's frame, `a` radians round from its right side (a quarter turn is its front), lifted `out` off it. */
function onBody(s: Smith, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z), d = unit([Math.cos(a) * r.h, Math.sin(a) * r.w, 0]);
  return add([Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z], scale(d, out));
}
/** The way out of the body's skin there. */
function bodyOut(s: Smith, z: number, a: number): V3 {
  const e = 0.01, ta = sub(onBody(s, z, a + e), onBody(s, z, a - e)), tz = sub(onBody(s, z + e, a), onBody(s, z - e, a));
  const n = unit(cross(ta, tz));
  return dot(n, [Math.cos(a), Math.sin(a), 0]) < 0 ? scale(n, -1) : n;
}
/** The solid of the body in the chest's frame, a little inside it, for what lies on it to be hidden behind: a stack of eggs following its rings. */
function bodySolid(s: Smith): Array<{ c: V3; r: V3 }> {
  const T = s.torso, z0 = T.z[0], z1 = T.z[T.z.length - 1], H = z1 - z0;
  return [0.16, 0.38, 0.6, 0.8].map((f) => {
    const z = z0 + H * f, r = torsoAt(s, z);
    return { c: [0, r.y, z] as V3, r: [r.w * 0.9, r.h * 0.88, H * 0.24] as V3 };
  });
}

/**
 * Whether a point on the body (the chest's frame) is the cream of its belly: an oval down its front, widest a little under its
 * middle and closing to its chin and its seat; the back, the sides and the flanks are all coat.
 */
function creamBody(s: Smith, c: V3): boolean {
  const T = s.torso, r = torsoAt(s, c[2]), z0 = T.z[0], z1 = T.z[T.z.length - 1];
  const zf = clamp((c[2] - z0) / (z1 - z0));
  const a = Math.atan2((c[1] - r.y) / Math.max(1e-3, r.h), c[0] / Math.max(1e-3, r.w));
  const across = ((zf - s.bib[1]) / (1 - s.bib[1])) ** 2;
  return Math.abs(a - Math.PI / 2) < s.bib[0] * Math.sqrt(Math.max(0, 1 - across)) && zf > 0.06;
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Nailsprout's little hammer, the Hammertin's, the Nailwright's sledge. */
export const NAIL_HITS: readonly number[] = [0.5, 0.52, 0.56];
/**
 * A go at its task, as shares of it, by stage: when each of the Nailsprout's taps lands (`taps`), each of the Hammertin's blows
 * (`blows`), and each of the Nailwright's two (`sledge`); and when the Nailwright's finished nail leaves the anvil and lands in
 * its crate (`flip`), and the next is laid on the anvil (`next`).
 */
export const NAIL_WORK = {
  taps: [0.125, 0.375, 0.625, 0.875],
  blows: [0.25, 0.75],
  sledge: [0.3, 0.52],
  flip: [0.66, 0.84],
  next: 0.9,
} as const;
/** Each stage's strikes on the anvil in a go, as shares of it. */
const hitsOf = (s: Smith): readonly number[] => [NAIL_WORK.taps, NAIL_WORK.blows, NAIL_WORK.sledge][s.stage];

/* ---- poses ------------------------------------------------------------------------------ */

/** A pose: where each ankle is and how its foot is pitched, how the body, the chest and the head are carried, its paws, and its hammer. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left, past how it is carried. */
  chest: V3;
  /** The neck bent forward and turned left; the head nose-up, turned left and tilted, against level; the nose twitched up and to its left (degrees). */
  neck: number[]; head: V3; nose: number[];
  /** Where the free paw is, in the chest's frame; how far it is on the hammer's handle, below the other; how far on the nail on the anvil. */
  hand: V3; on: number; hold: number;
  /** The hammer as it is carried, in the chest's frame: its grip, the way up its handle to its head, and the way its face strikes. */
  grip: V3; dir: V3; face: V3;
  /** The hammer as it is swung at the ground or the anvil, in the ground's frame under it; and how far it is that rather than carried. */
  aim: number; aimGrip: V3; aimDir: V3; aimFace: V3;
  /** The pack jolted on its back, pitched and rolled (degrees), and how hard what is in it rattles, and where in its rattle. */
  pack: number[]; rattle: number[];
  /** The tail swung up and to its left (degrees). */
  tail: number[];
  /** The finished nail flipped from the anvil into the crate: how far along its way (nought or one: none). */
  flip: number;
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
const rests = new Map<Smith, Rest>();
function restOf(s: Smith): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3);
  const R: Rest = { ankle, reach: L.len[0] + L.len[1] };
  rests.set(s, R);
  return R;
}

/** The shoulder on side `sd` (one its right) in the chest's frame. */
const shoulderOf = (s: Smith, sd: number): V3 => [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]];
/** A point a paw reaches: from its shoulder along `d`, `k` of the arm's length, in the chest's frame. */
const byPaw = (s: Smith, sd: number, d: V3, k = 0.85): V3 => add(shoulderOf(s, sd), scale(unit(d), (s.arm[0] + s.arm[1]) * k));

/** The free paw held in front of its belly, claws down. */
const pawRest = (s: Smith): V3 => byPaw(s, -1, [0.05, 0.8, -0.5], 0.8);

/** The hammer as it is carried standing: the Nailsprout's held up before it, the Hammertin's raised by its head, the Nailwright's sledge at its side. */
function toolRest(s: Smith): { grip: V3; dir: V3; face: V3 } {
  if (s.stage === 0) return { grip: byPaw(s, 1, [0.25, 0.6, -0.75], 0.8), dir: unit([0.08, 0.32, 1]), face: [0.15, 1, -0.3] };
  if (s.stage === 1) return { grip: byPaw(s, 1, [0.85, 0.3, 0.0], 0.8), dir: unit([0.25, 0.05, 1]), face: [0.2, 1, -0.1] };
  return { grip: byPaw(s, 1, [0.5, 0.42, -0.75], 0.86), dir: unit([0.12, 0.25, 1]), face: [0.3, 1, -0.2] };
}

/** How it stands with nothing going on: on both feet, its free paw before it, its hammer carried. */
function restPlan(s: Smith, R: Rest): Plan {
  const T = toolRest(s);
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0], nose: [0, 0],
    hand: pawRest(s), on: 0, hold: 0,
    grip: [...T.grip], dir: [...T.dir], face: [...T.face],
    aim: 0, aimGrip: [0, 0, 0], aimDir: [0, 1, 0], aimFace: [0, 0, -1],
    pack: [0, 0], rattle: [0, 0], tail: [0, 0], flip: 0,
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
 * Going: a mole's waddle on its short legs. Each foot down for its share of a stride and swept back under it at the ground's own
 * speed, then lifted and brought forward, turned out; the whole body rolled well over onto the foot that is down and swayed
 * after it, turned a little with each step, sinking onto each foot as it lands; the free paw swinging against the feet and the
 * hammer with them; the pack bouncing, what is in it rattling.
 */
function goingPlan(s: Smith, R: Rest, a: Anim): Plan {
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
    p.at[i] = [A[0] * (1 + 0.25 * Math.sin(Math.PI * u)), y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    p.foot[i] = -14 * Math.sin(Math.PI * clamp(u * 1.6)) * (1 - u) + 10 * hump(u, 0.85, 0.15);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.08));
  p.H += -G.bob * L * 2.4 * (down - 0.5) * (1 - 0.4 * g) + g * L * (0.14 * Math.max(0, Math.sin(2 * TAU * (w - duty * 0.5 + 0.25))) - 0.05);
  // Over the foot that is down: the left (0) from nought to half a stride, the right after. A waddle is mostly this.
  const over = Math.sin(TAU * (w - 0.2));
  p.roll = G.roll * over * (1 + 0.2 * g);
  p.side = -G.sway * L * 2 * over * (1 - 0.5 * g);
  p.yaw = 7 * Math.cos(TAU * w) * (1 - 0.3 * g);
  p.chest = [4 + 12 * g + 2 * (down - 0.5), -p.yaw * 0.7, -p.roll * 0.3];
  p.pitch = -2 - 5 * g;
  p.head = [3 * (down - 0.5) + 2 + 4 * g, -p.yaw * 0.3 - p.chest[1] * 0.5, -p.roll * 0.6];
  // The free paw swung against the left foot, the hammer with it.
  const arm = s.arm[0] + s.arm[1], sw = Math.cos(TAU * w);
  p.hand = add(p.hand, [-0.06 * arm * g, -0.32 * arm * sw, 0.1 * arm * Math.abs(sw) + 0.1 * arm * g]);
  p.grip = add(p.grip, [0, 0.18 * arm * sw, 0.05 * arm * (down - 0.5)]);
  p.dir = unit(add(p.dir, [0, 0.12 * sw, 0]));
  p.pack = [5 * (down - 0.5) + 2 * g, -p.roll * 0.35];
  p.rattle = [0.45 + 0.4 * g, frac(a.u * 2)];
  p.tail = [6 * (down - 0.5), 16 * over];
  return p;
}

/**
 * Standing about: breathing, the weight shifting from foot to foot, looking about; its nose twitching at the air now and then;
 * now and then its hammer hefted back onto its shoulder and down again, its claws held up and looked at, and a shrug that
 * rattles the nails in its pack.
 */
function stillPlan(s: Smith, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t), arm = s.arm[0] + s.arm[1];
  const w = Math.tanh(2.5 * cyc(t, 3));
  p.chest = [1.5 * (a.breath - 0.5), 5 * look * 0.3, 1.5 * w];
  p.roll = -2 * w;
  p.side = 0.03 * s.leg.len[0] * w;
  p.neck = [0, 6 * look];
  const tilt = beat(t, [3.4, 15.2], 1.4) - beat(t, [10.6, 20.8], 1.2);
  p.head = [3 * cyc(t, 4) + 3 * Math.abs(tilt), 10 * look + 8 * tilt, 4 * drift(t, 3) + 12 * tilt];
  p.H += 0.012 * R.reach * (a.breath - 0.5);
  // A twitch of its nose at the air, quick, three or four times over.
  const sniff = beat(t, [1.2, 4.6, 8.3, 12.8, 17.0, 21.4], 0.8);
  p.nose = [9 * sniff * Math.sin(t * TAU * 7), 6 * sniff * Math.sin(t * TAU * 5 + 1)];
  // The hammer hefted: lifted, laid back over its shoulder, and brought down again.
  const heft = beat(t, [5.6, 16.2], 2.0);
  p.grip = add(p.grip, [-0.12 * arm * heft, -0.1 * arm * heft, 0.22 * arm * heft]);
  p.dir = unit(mixV(p.dir, unit([0.15, -0.75, 0.65]), 0.75 * heft));
  p.face = mixV(p.face, [0, 0.6, 0.8], 0.6 * heft);
  // Its claws held up before its face and looked at.
  const claws = beat(t, [9.0, 22.0], 1.6);
  p.hand = add(p.hand, [0.05 * arm * claws, 0.08 * arm * claws, 0.42 * arm * claws]);
  p.head[0] -= 12 * claws;
  p.head[1] -= 10 * claws;
  // A shrug that sets what is in its pack rattling.
  const shrug = beat(t, [2.6, 12.0, 19.2], 0.9);
  p.H += 0.05 * R.reach * shrug;
  p.pack = [4 * shrug * Math.sin(t * TAU * 6), 3 * shrug * Math.sin(t * TAU * 5)];
  p.rattle = [0.1 + 0.9 * shrug, frac(t * 3)];
  p.tail = [3 * cyc(t, 3), 10 * drift(t, 2)];
  return p;
}

/* ---- its swings ---------------------------------------------------------------------- */

/** The hammer's handle at `a` degrees up from level and turned `yaw` to its left: the way along it, and the way its face strikes. */
function swung(a: number, yaw = 0): { dir: V3; face: V3 } {
  const c = Math.cos(a * DEG), sn = Math.sin(a * DEG), cy = Math.cos(yaw * DEG), sy = -Math.sin(yaw * DEG);
  return { dir: [sy * c, cy * c, sn], face: [sy * sn, cy * sn, -c] };
}

/** The chest's frame of a pose, in the ground's under it. */
function chestOf(P: Plan): Xf {
  const body = joint(ROOT, [0, 0, P.H], P.pitch, P.roll, P.yaw);
  return joint(body, [0, 0, 0], -P.chest[0], P.chest[2], P.chest[1]);
}

/** Where the right paw grips the hammer as it lands, in the ground's frame: reached forward and down from the shoulder of a pose. */
function gripAt(s: Smith, P: Plan, d: V3, k: number): V3 {
  return place(chestOf(P), byPaw(s, 1, d, k));
}

/**
 * The hammer swung on an arc from its grip as it lands (`k` nought, its handle at `land` degrees) to drawn back (`k` one, at
 * `top`), the paw lifted by `lift` on the way and the handle leant out by `out`: set on the plan, in the ground's frame.
 */
function swing(p: Plan, grip: V3, k: number, land: number, top: number, lift: V3, yaw = 0, out = 0): void {
  const e = smooth(k), S = swung(lerp(land, top, k), yaw);
  p.aim = 1;
  p.aimGrip = add(grip, scale(lift, e));
  // Leant out to its right as it is drawn back, `out` of the way at the top, so its head is clear of its own.
  p.aimDir = unit(add(S.dir, [out * e, 0, 0]));
  p.aimFace = S.face;
}

/** Through a run of keys, each a moment and a value, eased from one to the next; held at the first before it and the last after. */
function path(t: number, keys: ReadonlyArray<readonly [number, number]>): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) if (t <= keys[q + 1][0]) return lerp(keys[q][1], keys[q + 1][1], smooth((t - keys[q][0]) / Math.max(1e-6, keys[q + 1][0] - keys[q][0])));
  return keys[keys.length - 1][1];
}

/**
 * A strike. The Nailsprout crouches with its little hammer up over its head, hops in and bonks the ground ahead of it. The
 * Hammertin raises its hammer high, steps in and brings it down hard. The Nailwright heaves its sledge up over its shoulder in
 * both paws and slams it into the ground before it, its whole weight behind it.
 */
function strikePlan(s: Smith, R: Rest, t: number): Plan {
  const hit = NAIL_HITS[s.stage], L = R.reach;
  const body = (p: Plan, u: number): void => {
    const wind = ramp(u, 0.04, 0.34) * (1 - ramp(u, 0.36, hit));
    const blow = ramp(u, 0.36, hit) * (1 - ramp(u, hit + 0.16, 0.96));
    const jolt = hump(u, hit + 0.02, 0.07);
    if (s.stage === 0) {
      const hop = hump(u, (0.36 + hit) / 2, (hit - 0.36) / 2 + 0.03);
      p.H += L * (-0.45 * wind + 1.4 * hop - 0.3 * jolt);
      p.surge = L * 1.3 * blow;
      p.chest = [-8 * wind + 26 * blow, 6 * wind, 0];
      p.head = [10 * wind - 16 * blow, 0, 0];
      p.squash = 0.1 * jolt - 0.05 * hop;
      for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 1.3 * blow * ramp(u, hit - 0.04, hit + 0.06), 0]);
    } else if (s.stage === 1) {
      p.chest = [-12 * wind + 30 * blow, 10 * wind - 6 * blow, 0];
      p.head = [14 * wind - 18 * blow, -4 * wind, 0];
      p.H += L * (0.12 * wind - 0.35 * blow);
      p.surge = L * 0.5 * blow;
      p.squash = 0.07 * jolt;
      p.at[0] = add(p.at[0], [0, L * 0.9 * blow, 0]);
    } else {
      p.chest = [-14 * wind + 34 * blow, 14 * wind - 4 * blow, 0];
      p.head = [16 * wind - 20 * blow, -6 * wind, 0];
      p.H += L * (0.14 * wind - 0.45 * blow - 0.15 * jolt);
      p.surge = L * 0.3 * blow;
      p.squash = 0.12 * jolt;
      p.at[0] = add(p.at[0], [0, L * 0.7 * blow, 0]);
      p.at[1] = add(p.at[1], [0, -L * 0.2 * blow, 0]);
    }
  };
  const p = restPlan(s, R);
  body(p, t);
  // The hammer: its grip as it lands reached from where the shoulder is at that moment, and drawn back from there.
  const at = restPlan(s, R);
  body(at, hit);
  const grip = gripAt(s, at, [s.stage === 2 ? -0.35 : 0.05, 0.85, -0.55], 0.95);
  grip[1] -= at.surge;
  const raise = path(t, [[0.02, 0.15], [0.32, 1], [0.38, 1], [hit, 0], [hit + 0.12, 0.05], [0.9, 0.3]]);
  const top = [100, 120, 150][s.stage], land = [-40, -35, -38][s.stage], arm = s.arm[0] + s.arm[1];
  // Drawn back up beside its head on the hammer's side, where the head is not in front of it, rather than over it.
  swing(p, add(grip, [0, p.surge - at.surge, 0]), raise, land, top, [(s.stage === 2 ? 0.15 : 0.5) * arm, -0.35 * arm, (s.stage ? 1.45 : 1.2) * arm], s.stage === 2 ? 6 : -10, s.stage === 2 ? 0 : 0.7);
  p.aim = ramp(t, 0.0, 0.14) * (1 - ramp(t, hit + 0.18, 0.96));
  if (s.hammer.sledge) p.on = ramp(t, 0.04, 0.2) * (1 - ramp(t, hit + 0.2, 0.9));
  const since = (t - hit) * ACT_SECS.strike;
  p.pack = [12 * ringOut(since, 2.2, 4), 6 * ringOut(since + 0.05, 2, 4)];
  p.rattle = [since > 0 ? Math.max(0.2, 1 - since / 0.4) : 0.2, frac(t * 4)];
  p.tail = [10 * ringOut(since, 2, 3), 0];
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));

/** How far its hammer is drawn back from the anvil at `t` in a go, by stage: a loop, so a go played over and over runs on unbroken. */
function raiseOf(s: Smith, t: number): number {
  if (s.stage === 0) {
    // A tap every quarter of a go: up off the nail quick, a moment held, and down.
    const u = frac((t - NAIL_WORK.taps[0]) / 0.25);
    return ramp(u, 0.04, 0.42) * (1 - ramp(u, 0.7, 1));
  }
  if (s.stage === 1) {
    // Up slow over its head, down fast.
    const u = frac((t - NAIL_WORK.blows[0]) / 0.5);
    return ramp(u, 0.06, 0.72) * (1 - ramp(u, 0.8, 1));
  }
  const [h1, h2] = NAIL_WORK.sledge;
  return path(t, [[0, 0.5], [0.16, 1], [0.22, 1], [h1, 0], [h1 + 0.04, 0.05], [h1 + 0.11, 0.75], [h2, 0], [h2 + 0.05, 0.06], [0.88, 0.06], [1, 0.5]]);
}

/** Its body at its anvil: bent over it, sinking into each blow, the head watching the nail; set on the plan. */
function smithBody(s: Smith, R: Rest, t: number, p: Plan): void {
  const L = R.reach, k = raiseOf(s, t), hits = hitsOf(s);
  let jolt = 0;
  for (const h of hits) jolt = Math.max(jolt, hump(t, h + 0.015, 0.05));
  const big = s.stage === 0 ? 0.4 : s.stage === 1 ? 1 : 1.3;
  p.chest = [s.smith.lean - 10 * k * big + 6 * jolt, (s.stage === 2 ? 10 : 6) * k, 0];
  p.neck = [6, 0];
  p.head = [-14 + 8 * k, 0, 0];
  p.H += L * (-0.18 - 0.1 * jolt * big + 0.06 * k);
  p.squash = 0.05 * jolt * big;
  p.at[0] = add(p.at[0], [0, L * 0.35, 0]);
  p.at[1] = add(p.at[1], [0, -L * 0.1, 0]);
}

/**
 * Its swing at the anvil as the hammer lands, in the ground's frame: the grip, reached forward and in from the shoulder of its
 * pose then, and how far down from level the handle is to put the hammer's face on the nail on top of the anvil.
 */
const swings = new Map<Smith, { grip: V3; land: number }>();
function anvilSwing(s: Smith, R: Rest): { grip: V3; land: number } {
  const had = swings.get(s);
  if (had) return had;
  const p = restPlan(s, R);
  smithBody(s, R, hitsOf(s)[0], p);
  const grip = gripAt(s, p, [s.stage === 2 ? -0.8 : -0.45, 0.8, -0.5], 0.92);
  const want = s.smith.top + nailThick(s), A = s.hammer.len, hl = s.hammer.head[0] / 2;
  let land = 0, best = Infinity;
  for (let a = -80; a <= 40; a++) {
    const miss = Math.abs(grip[2] + A * Math.sin(a * DEG) - hl * Math.cos(a * DEG) - want);
    if (miss < best) { best = miss; land = a; }
  }
  const out = { grip, land };
  swings.set(s, out);
  return out;
}

/**
 * A go at its task, by stage. The Nailsprout's: its claws pinning the nail on its stone, four quick taps of its little hammer.
 * The Hammertin's: its hammer drawn up over its head and brought down on the nail, twice. The Nailwright's: its sledge swung
 * up in both paws and down, twice, one blow after the other; then the finished nail picked off the anvil and flipped over its
 * shoulder into its crate, and the next laid there (`NAIL_WORK`).
 */
function workPlan(s: Smith, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), arm = s.arm[0] + s.arm[1];
  smithBody(s, R, t, p);
  const { grip, land } = anvilSwing(s, R), k = raiseOf(s, t);
  const top = [land + 40, 88, 135][s.stage];
  // Drawn up beside its head on the hammer's side, where it shows, rather than behind it.
  const lift: V3 = [[0, -0.05 * arm, 0.12 * arm], [0.6 * arm, -0.25 * arm, 1.3 * arm], [0.25 * arm, -0.4 * arm, 1.3 * arm]][s.stage] as V3;
  swing(p, grip, k, land, top, lift, s.smith.yaw, s.stage === 1 ? 0.75 : 0);
  if (s.stage === 0) p.hold = 1;
  else if (s.stage === 1) p.hold = 0.85;
  else {
    const F = NAIL_WORK.flip;
    // In both paws on the sledge, but for the flip: the free paw down to the anvil for the nail, and flicked up and over.
    const off = ramp(t, NAIL_WORK.sledge[1] + 0.04, F[0] - 0.06) * (1 - ramp(t, F[0] + 0.06, NAIL_WORK.next + 0.04));
    p.on = 1 - off;
    p.hold = off * (1 - ramp(t, F[0] - 0.02, F[0] + 0.04));
    p.hand = add(p.hand, [0, -0.2 * arm, 0.9 * arm * hump(t, F[0] + 0.05, 0.08)]);
    p.flip = t > F[0] && t < F[1] ? (t - F[0]) / (F[1] - F[0]) : 0;
    p.head = add(p.head, [22 * hump(t, F[0] + 0.07, 0.12), 26 * hump(t, F[0] + 0.1, 0.12), 0]);
  }
  let since = 9;
  for (const h of hitsOf(s)) if (t >= h) since = Math.min(since, (t - h) * ACT_SECS.work);
  p.pack = [6 * ringOut(since, 2.4, 5) * (s.stage ? 1 : 0.5), 3 * ringOut(since + 0.05, 2, 5)];
  p.rattle = [since < 0.4 ? 0.8 * (1 - since / 0.4) : 0.1, frac(t * 4)];
  p.nose = [4 * Math.sin(t * TAU * 2), 0];
  return mixPlan(restPlan(s, R), p, down);
}

/** Feeding where it stands: bent over, its snout down at the ground ahead of its feet, nose going. */
function grazePlan(s: Smith, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const dig = Math.max(0, Math.sin(t * TAU * 1.5)) ** 3;
  p.chest = [26 + 6 * dig, 0, 0];
  p.neck = [14 + 8 * dig, 4 * drift(t, 2)];
  p.head = [-30 - 8 * dig, 8 * drift(t, 2), 0];
  p.nose = [10 * Math.sin(t * TAU * 6), 5 * Math.sin(t * TAU * 4)];
  p.hand = add(p.hand, [0, 0.1 * s.arm[1], -0.35 * s.arm[1] * (1 + dig)]);
  p.H -= 0.12 * R.reach;
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its hammer held high and its claws spread, a shake, and settled. */
function evolvePlan(s: Smith, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach, arm = s.arm[0] + s.arm[1];
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * (s.stage === 2 ? 48 : 66));
  p.H += L * (-0.35 * hunch + 0.35 * up);
  p.chest = [14 * hunch - 8 * up, 6 * shake, 0];
  p.neck = [8 * hunch - 6 * up, 0];
  p.head = [-14 * hunch + 22 * up, 0, 16 * shake];
  p.roll = 4 * shake;
  p.squash = 0.06 * hump(t, 0.72, 0.05);
  p.hand = mixV(p.hand, byPaw(s, -1, [-1, 0.45, -0.25], 0.92), up);
  p.grip = mixV(p.grip, byPaw(s, 1, [0.5, 0.25, 0.85], 0.86), up);
  p.dir = unit(mixV(p.dir, [0.3, 0.1, 1], up));
  p.hand = add(p.hand, [-0.05 * arm * shake, 0, 0]);
  p.pack = [6 * shake, 4 * shake];
  p.rattle = [0.3 + 0.7 * Math.abs(shake), frac(t * ACT_SECS.evolve * 3)];
  p.nose = [10 * up * Math.sin(t * 40), 0];
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Smith, R: Rest, a: Anim): Plan {
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
  const along0 = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along0 * along0));
  return { mid: add(add(from, scale(d, along0)), scale(v, h)), end };
}

/** A leg bent to put its ankle at `ankle`: the knee forward and a little out, always the same way round; the foot flat, turned out. */
function legOf(s: Smith, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.35, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.35 * fwd[1], fwd[1] - sd * 0.35 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The middle of the skull in the head's frame. */
const skullAt = (s: Smith): V3 => [0, 0, s.head.up];
/** Where the snout comes out of the face, and the way it points, in the head's frame. */
function snoutRoot(s: Smith): { p: V3; d: V3 } {
  const e = onEgg(skullAt(s), s.head.r, [0, 1, -0.34]);
  return { p: add(e.p, [0, -s.snout.len * 0.4, 0]), d: unit([0, 1, -0.16]) };
}
/** A point `u` of the way along the snout, in the head's frame. */
const snoutAt = (s: Smith, u: number): V3 => { const B = snoutRoot(s); return add(B.p, scale(B.d, s.snout.len * u)); };
/** Where the end of the snout turns about as it twitches, in the head's frame. */
const NOSE_AT = 0.56;
/** Where the tail comes out of the body, in the body's frame. */
const tailRoot = (s: Smith): V3 => [0, s.torso.y[1] - s.torso.h[1] * 0.92, s.torso.z[1] + 0.02];
/** The striking face of the hammer's head, in its frame: its middle up the handle, and out along its face. */
const faceAt = (s: Smith): V3 => [0, s.hammer.head[0] / 2, s.hammer.len];

/** Where the anvil stands, in the ground's frame, and how high its top is: under the hammer's face as its first blow lands. */
const anvils = new Map<Smith, { at: V3; top: number }>();
function anvilOf(s: Smith): { at: V3; top: number } {
  const had = anvils.get(s);
  if (had) return had;
  // Posed with its free paw anywhere but on the nail, which is where the anvil is still to be found.
  const R = restOf(s), P = workPlan(s, R, hitsOf(s)[0], 1);
  P.hold = 0;
  const b = poseOf(s, P);
  const p = place(b.tool, faceAt(s)), A = { at: [p[0], p[1], 0] as V3, top: Math.max(0.06, p[2] - nailThick(s)) };
  anvils.set(s, A);
  return A;
}
/**
 * The anvil's frame, `g` its size as it is set down and taken up: on the ground under where the hammer lands, its horn to the
 * left and turned a little toward the front, so neither a side nor the front sees it end on.
 */
const anvilXf = (A: { at: V3 }, g: number): Xf => scaled(joint({ m: ROOT.m, t: A.at }, [0, 0, 0], 0, 0, -32), g);
/** How thick the nail on the anvil is, that the hammer lands on. */
const nailThick = (s: Smith): number => [0.022, 0.034, 0.05][s.stage];
/** How long the nail on the anvil is. */
const billetLen = (s: Smith): number => [0.16, 0.26, 0.4][s.stage];

/**
 * The bones of a stage posed: the hips raised and carried as it says, the chest on them, the neck, the head and the end of its
 * snout, the tail, each leg bent to put its foot where it is to be; the hammer where it is carried or swung, in the right paw
 * wherever the arm can reach, and the free paw where it is to be or on the handle; and the pack on its back.
 */
function poseOf(s: Smith, P: Plan): Bones {
  const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
  const b: Bones = { body };
  const chest = joint(body, [0, 0, 0], -P.chest[0], P.chest[2], P.chest[1]);
  b.chest = chest;
  // The belly squashed by a landing or a blow, what lies on the chest kept its size.
  const q = P.squash;
  b.belly = q ? { m: [chest.m[0] * (1 + q * 0.45), chest.m[1] * (1 + q * 0.45), chest.m[2] * (1 - q), chest.m[3] * (1 + q * 0.45), chest.m[4] * (1 + q * 0.45), chest.m[5] * (1 - q), chest.m[6] * (1 + q * 0.45), chest.m[7] * (1 + q * 0.45), chest.m[8] * (1 - q)], t: chest.t } : chest;
  b.neck = joint(chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
  // The head carried level whatever the body and the chest do under it, then pitched as the pose says.
  b.head = joint(b.neck, [0, 0, s.neck.len], P.chest[0] + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
  b.nose = joint(b.head, snoutAt(s, NOSE_AT), -P.nose[0], 0, P.nose[1]);
  // Kept nearer upright than the chest it hangs on as that bends, as a load on a back is.
  b.pack = joint(chest, s.pack.at, s.pack.tip + P.pack[0] + 0.45 * P.chest[0], P.pack[1], 0);
  b.tail = joint(body, tailRoot(s), P.tail[0], 0, P.tail[1]);
  b.shadow = shadowOf(body, 0);
  for (let i = 0; i < 2; i++) {
    const [u, l, f] = legOf(s, body, i, P.at[i], P.foot[i]);
    const key = i ? 'lr' : 'll';
    b[`${key}0`] = u;
    b[`${key}1`] = l;
    b[`${key}2`] = f;
  }
  // The hammer where it is carried, in the chest's frame, and where it is swung, in the ground's.
  const gnd: V3 = [P.side, P.surge, 0];
  const gripW = mixV(place(chest, P.grip), add(gnd, P.aimGrip), P.aim);
  const dirW = unit(mixV(turn(chest, unit(P.dir)), P.aimDir, P.aim));
  let faceW = mixV(turn(chest, P.face), P.aimFace, P.aim);
  faceW = sub(faceW, scale(dirW, dot(faceW, dirW)));
  faceW = len3(faceW) > 1e-4 ? unit(faceW) : unit(cross(dirW, [1, 0, 0]));
  const ref = turn(chest, unit([0, 0.6, -0.8]));
  const arm = (i: number, want: V3): V3 => {
    const sd = i ? 1 : -1, sh = place(chest, shoulderOf(s, sd));
    const { mid: el, end: tip } = bend2(sh, want, s.arm[0], s.arm[1], turn(chest, unit([sd * 1, -0.5, -0.3])));
    const [X0, Y0, Z0] = frameOf(sub(sh, el), ref), [X1, Y1, Z1] = frameOf(sub(el, tip), ref);
    b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
    // The plates over the shoulder, carried partly by the chest and partly by the arm, so they stay on the shoulder however the arm swings.
    const [X2, Y2, Z2] = frameOf(mixV(turn(chest, [0, 0, 1]), Z0, 0.35), turn(chest, [0, 1, 0]));
    b[`shoulder${i}`] = xfOf(X2, Y2, Z2, sh);
    b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
    b[`hand${i}`] = xfOf(X1, Y1, Z1, tip);
    return tip;
  };
  // The right paw on the grip, and the hammer in it wherever the arm has reached.
  const held = arm(1, gripW);
  b.tool = xfOf(cross(faceW, dirW), faceW, dirW, held);
  // The free paw where it is to be: on the handle below the other, or at the nail on the anvil.
  let want = place(chest, P.hand);
  if (P.on > 0) want = mixV(want, add(held, scale(dirW, -s.hammer.butt * 0.75 - s.paw * 0.4)), P.on);
  if (P.hold > 0) {
    const A = anvilOf(s), top = add(gnd, place(anvilXf(A, 1), [-billetLen(s) * 0.55 - s.paw * 0.3, -s.paw * 0.2, A.top + s.paw * 0.55]));
    want = mixV(want, top, P.hold);
  }
  arm(0, want);
  return b;
}

/** The bones of a stage for what it is doing: its pose, and the anvil before it, the nail on that and the nail flipped. */
function smithBones(s: Smith): (a: Anim) => Bones {
  const R = restOf(s);
  return (a) => {
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go });
    const b = poseOf(s, P);
    if (a.act?.kind === 'work') {
      const t = a.act.t, g = downOf(t, a.graze), A = anvilOf(s);
      const X = anvilXf(A, g);
      b.anvil = X;
      // The nail on it, red hot, from where the hammer lands to past where the paw pins it; the Nailwright's gone as it is
      // flipped and the next laid there.
      const W = NAIL_WORK, k = s.stage === 2 ? (t < W.flip[0] ? 1 : ramp(t, W.next, W.next + 0.06)) : 1;
      const on = place(X, [-billetLen(s) * 0.3, 0, A.top]);
      b.billet = scaled({ m: X.m, t: on }, k);
      if (P.flip > 0 && P.flip < 1) {
        const to = place(b.pack, [0, 0, s.pack.h * 1.05]), u = P.flip, e = smooth(u);
        const at: V3 = [lerp(on[0], to[0], e), lerp(on[1], to[1], e), lerp(on[2], to[2], e) + (s.pack.h * 0.9 + 0.6) * Math.sin(Math.PI * u)];
        const spin = u * TAU * 1.5;
        b.flung = along([Math.sin(spin) * 0.3, Math.cos(spin), Math.sin(spin)], [0, 0, 1], at);
      }
    }
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------- */

/** A patch painted onto the egg `(C, R)` round the way `dir`, `rx` by `ry`: a cheek. */
function patchOn(C: V3, R: V3, dir: V3, rx: number, ry: number, mat: Mat, lift = 0.012, sides = 10): Disc {
  const e = onEgg(C, R, dir), d = disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, sides, mat, { at: add(e.p, scale(e.n, -0.02)) });
  return { ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); }) };
}

/** Whether a point on the skull (its way out of it, scaled to a ball) is the cream of its face: round the root of the snout, the chin and the throat. */
function creamFace(d: V3): boolean {
  const x = Math.abs(d[0]);
  if (d[2] < -0.6 && d[1] > -0.2) return true;
  return d[1] > 0.42 && d[2] < -0.08 - 0.5 * x;
}

/**
 * The head: a round skull, the coat over the crown, the back and round the eyes, the cream of its face below; the snout coming
 * forward and down out of the cream as far as where its end turns (the rest is on the nose's bone); the eyes, big and glossy or
 * shut in a smile; a rosy cheek, and a small smile under the snout.
 */
function headOf(s: Smith, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), R = H.r;
  const skull = painted(orb(C, R, n + 10, k + 6, 'coat'), (c) => (creamFace([(c[0] - C[0]) / R[0], (c[1] - C[1]) / R[1], (c[2] - C[2]) / R[2]]) ? 'mark' : 'coat'));
  const S = s.snout, B = snoutRoot(s);
  // A round muzzle swelling out of the face, its end on the nose's bone.
  const snout = orbAlong(snoutAt(s, 0.32), B.d, [S.w * 1.15, S.h * 1.1, S.len * 0.5], n, k, 'mark');
  const cheeks = paint([1, -1].map((sd) => patchOn(C, R, [sd * 0.74, 0.5, -0.12], s.eye.size * 0.95, s.eye.size * 0.6, 'inner', 0.02)));
  // Tufts of darker fur back along the cheeks.
  const tufts = paint([1, -1].flatMap((sd) => [0, 1, 2].map((q) => patchOn(C, R, [sd * (0.9 - 0.05 * q), 0.1 - 0.22 * q, -0.32 - 0.06 * q], s.eye.size * 0.22, s.eye.size * 0.75, 'coatDark', 0.015, 5))));
  return merge(skull, snout, cheeks, tufts, eyesOf(s, shut || s.eye.shut));
}

/**
 * The eyes: each a dark rim, a big glossy dark eye and two glints, laid onto the skull's own curve; or shut, a thick arch of a
 * line, the eye smiling.
 */
function eyesOf(s: Smith, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.02));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size;
    if (shut) {
      // An arch, thick enough to read at forty pixels: along its top and back along under it.
      const N = 8, pts: V3[] = [];
      for (let j = 0; j <= N; j++) { const x = -1 + (2 * j) / N; pts.push(add(add(p, scale(across, x * r * 1.15)), scale(up, r * (0.42 * (1 - x * x) + 0.16 - 0.3)))); }
      for (let j = N; j >= 0; j--) { const x = -1 + (2 * j) / N; pts.push(add(add(p, scale(across, x * r * 0.98)), scale(up, r * (0.36 * (1 - x * x) - 0.16 - 0.3)))); }
      out.push(onto({ v: pts, m: 'lid', at }, 0.018));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.12, r * 1.06, 12, 'lid', o), 0.016));
    out.push(onto(disc(p, n, r, r * 0.95, 12, 'eye', o), 0.02));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36)), scale(across, side * r * 0.3)), n, r * 0.4, r * 0.4, 6, 'glint', { ...o, lit: true }), 0.03));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.44)), scale(across, -side * r * 0.32)), n, r * 0.16, r * 0.16, 5, 'glint', { ...o, lit: true }), 0.03));
  }
  // Wound to face out of the head, whichever way the arch's corners went round.
  return paint(out.map((d, q) => {
    const sd = q < out.length / 2 ? 1 : -1, e = onEgg(C, R, [sd * E.dir[0], E.dir[1], E.dir[2]]);
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < d.v.length; c++) {
      const a = d.v[c], b = d.v[(c + 1) % d.v.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return nx * e.n[0] + ny * e.n[1] + nz * e.n[2] < 0 ? { ...d, v: [...d.v].reverse() } : d;
  }));
}

/** The end of the snout, in the nose's frame from where it turns: the end of the muzzle, the small pink nose on it, and a smile under it. */
function noseOf(s: Smith, n: number, k: number): Mesh {
  const S = s.snout, B = snoutRoot(s), o = snoutAt(s, NOSE_AT), at = (u: number): V3 => sub(snoutAt(s, u), o);
  // The end of the muzzle, rounded off, and the small pink nose on it.
  const tip = orbAlong(at(0.72), B.d, [S.w * 0.82, S.h * 0.8, S.len * 0.3], n, k, 'mark');
  const nose = orbAlong(add(at(0.98), [0, 0, S.h * 0.25]), B.d, [s.nose * 0.95, s.nose * 0.72, s.nose * 0.62], n, k, 'nose');
  const shine = paint([disc(add(at(0.98), [-s.nose * 0.25, s.nose * 0.32, S.h * 0.25 + s.nose * 0.62]), [0, 0.4, 1], s.nose * 0.26, s.nose * 0.17, 6, 'glint', { lit: true })]);
  // A small smile under the nose.
  const m = add(at(0.86), [0, S.len * 0.06, -S.h * 0.32]), mn = unit([0, 0.85, -0.5]);
  return merge(tip, nose, shine, smile(m, mn, S.w * 0.95, 'lid'));
}

/** An ear, on the side `sd`, in the head's frame: a small round flap out from under the cap, pink inside. */
function earOf(s: Smith, sd: number, n: number): Mesh {
  const C = skullAt(s), R = s.head.r, e = onEgg(C, R, [sd * 0.86, -0.16, 0.22]), E = s.ear;
  const out = unit([sd * 0.7, 0.45, 0.55]);
  const [X, Y, Z] = frameOf(out, [0, 0, 1]);
  const c = add(e.p, scale(e.n, E * 0.3));
  const flap = egg(c, [X, Y, Z], [E * 0.95, E * 1.05, E * 0.36], n, 4, 'coat');
  const inner = paint([disc(add(c, scale(Z, E * 0.37)), Z, E * 0.66, E * 0.74, 9, 'inner')]);
  return merge(flap, inner);
}

/**
 * A slab of stone curved to lie on the egg `(C, R)`: the patch of it between latitudes `lat` and longitudes `phi` (degrees, the
 * longitude round from `x` toward `y`), `lift` of the egg's size off it and `thick` thick, its corners cut in and knocked off true
 * by its number so no two are alike, its lower edge (`tip`) standing a little prouder than its upper as a shingle's does.
 */
function slabOn(C: V3, R: V3, lat: [number, number], phi: [number, number], lift: number, thick: number, id: number, mat: Mat, tip = 0.3): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], G = 3;
  const dirOf = (la: number, ph: number): V3 => [Math.cos(la * DEG) * Math.cos(ph * DEG), Math.cos(la * DEG) * Math.sin(ph * DEG), Math.sin(la * DEG)];
  for (const layer of [0, 1]) {
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
      // The corners drawn in toward the middle, so the slab is rounded off rather than a square.
      const corner = (i !== 1 && j !== 1) ? 0.22 : 0;
      const u = lerp(i / (G - 1), 0.5, corner) + (jitter(id * 5 + i * 3 + j) - 0.5) * 0.08, w = lerp(j / (G - 1), 0.5, corner) + (jitter(id * 7 + i + j * 3) - 0.5) * 0.08;
      const la = lerp(lat[0], lat[1], u), ph = lerp(phi[0], phi[1], w);
      const k = 1 + lift + thick * layer + thick * tip * (1 - u);
      v.push(onEgg(C, scale(R, k), dirOf(la, ph)).p);
    }
  }
  const at = (layer: number, i: number, j: number): number => layer * G * G + i * G + j;
  const mid = onEgg(C, scale(R, 1 + lift + thick * 0.5), dirOf((lat[0] + lat[1]) / 2, (phi[0] + phi[1]) / 2)).p;
  const cen = (idx: number[]): V3 => scale(idx.reduce((t, q) => add(t, v[q]), [0, 0, 0] as V3), 1 / idx.length);
  const push = (idx: number[], out: V3): void => { f.push({ i: idx, m: mat }); want.push(out); };
  for (let i = 0; i < G - 1; i++) for (let j = 0; j < G - 1; j++) {
    const top = [at(1, i, j), at(1, i + 1, j), at(1, i + 1, j + 1), at(1, i, j + 1)], under = [at(0, i, j), at(0, i + 1, j), at(0, i + 1, j + 1), at(0, i, j + 1)];
    push(top, sub(cen(top), C));
    push(under, sub(C, cen(under)));
  }
  // Its edges, round the border.
  const ring: Array<[number, number]> = [];
  for (let j = 0; j < G - 1; j++) ring.push([0, j]);
  for (let i = 0; i < G - 1; i++) ring.push([i, G - 1]);
  for (let j = G - 1; j > 0; j--) ring.push([G - 1, j]);
  for (let i = G - 1; i > 0; i--) ring.push([i, 0]);
  ring.forEach(([i, j], q) => {
    const [i2, j2] = ring[(q + 1) % ring.length], idx = [at(0, i, j), at(0, i2, j2), at(1, i2, j2), at(1, i, j)];
    push(idx, sub(cen(idx), mid));
  });
  return mesh(v, wound(v, f, want));
}

/** How far up the head the cap's rim comes, round from its right (a quarter turn is its front): over the brow, the ears and the nape. */
const capRim = (phi: number): number => 22 + 22 * Math.sin(phi) - 14 * Math.max(0, -Math.sin(phi)) ** 2;

/**
 * The cap, in the head's frame: a hood of a few big flat slabs of stone over the crown and down the back of the neck, each curved
 * to the head, its front edge clear over the brow and the ears out from under it at its sides; under the slabs a darker lining,
 * which is the gaps between them.
 */
function capOf(s: Smith): Mesh {
  const C = skullAt(s), R = scale(s.head.r, s.cap.k), out: Mesh[] = [], ring = s.cap.rows[1], nape = s.cap.nape;
  const on = (lat: number, phi: number): V3 => [Math.cos(lat * DEG) * Math.cos(phi), Math.cos(lat * DEG) * Math.sin(phi), Math.sin(lat * DEG)];
  // The lining: the dome itself, from the crown down to the rim all round.
  const N = 16, K = 4, v: V3[] = [onEgg(C, R, [0, 0, 1]).p], f: Face[] = [], want: V3[] = [];
  for (let k = 1; k <= K; k++) for (let j = 0; j < N; j++) { const phi = (j / N) * TAU; v.push(onEgg(C, R, on(lerp(90, capRim(phi) + 1, k / K), phi)).p); }
  const at = (k: number, j: number): number => (k === 0 ? 0 : 1 + (k - 1) * N + (j % N));
  const cen = (idx: number[]): V3 => sub(scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / idx.length), C);
  for (let j = 0; j < N; j++) { const idx = [0, at(1, j), at(1, j + 1)]; f.push({ i: idx, m: 'hoof' }); want.push(cen(idx)); }
  for (let k = 1; k < K; k++) for (let j = 0; j < N; j++) { const idx = [at(k, j), at(k + 1, j), at(k + 1, j + 1), at(k, j + 1)]; f.push({ i: idx, m: 'hoof' }); want.push(cen(idx)); }
  out.push(mesh(v, wound(v, f, want)));
  const T = 0.07, top = 64;
  // The crown slab, a little peaked.
  out.push(rock(add(onEgg(C, R, [0, 0.05, 1]).p, [0, 0, s.head.r[2] * 0.1]), [s.head.r[0] * 0.36, s.head.r[1] * 0.34, s.head.r[2] * 0.08], { n: 7, bevel: 0.35, rough: 0.1, seed: 11 + s.stage, mat: 'stone' }));
  // A ring of big slabs from under the crown down to the rim, each its share of the way round, a gap between each.
  for (let q = 0; q < ring; q++) {
    const c = (q / ring) * 360 + 18, half = (360 / ring) * 0.485, rim = capRim(c * DEG);
    out.push(slabOn(C, R, [rim - 2, top + 16], [c - half, c + half], 0.03, T, 20 + q, stoneMat(20 + q)));
  }
  // Down the back of the neck, under the ring.
  for (let q = 0; q < nape; q++) {
    const c = -90 + (q - (nape - 1) / 2) * (100 / nape), half = (100 / nape) * 0.49, rim = capRim(c * DEG);
    out.push(slabOn(C, R, [rim - 12, rim + 6], [c - half, c + half], 0.01, T, 70 + q, stoneMat(71 + q)));
  }
  return merge(...out);
}

/**
 * The stone slabs over a shoulder, in its frame (out along `x`, up along `z`): a big slab over the top of the shoulder and rows of
 * them under it round its outside, front and back, laid like shingles over a dark lining; the cap's stone.
 */
function pauldronOf(s: Smith): Mesh {
  const P = s.pauldron, out: Mesh[] = [], C: V3 = [s.armW[0] * 0.35, 0, -P * 0.15], R: V3 = [P * 0.95, P * 1.05, P * 0.95];
  out.push(egg(C, UPRIGHT, scale(R, 0.97), 8, 4, 'hoof'));
  out.push(slabOn(C, R, [44, 86], [-95, 95], 0.04 + 0.03 * s.plates, 0.12, 90 + s.stage, 'stone'));
  for (let r = 1; r < s.plates; r++) {
    const hi = 50 - (r - 1) * (95 / (s.plates - 1)), lo = hi - 95 / (s.plates - 1) - 10;
    for (const [a, b] of [[-100, -4], [4, 100]] as const) out.push(slabOn(C, R, [lo, hi], [a, b], 0.04 + 0.03 * (s.plates - r), 0.12, 91 + r * 7 + a, stoneMat(91 + r * 5 + a)));
  }
  return merge(...out);
}

/**
 * The plate of stone scales down the back, in the chest's frame: rows of rounded scales across the back and round onto the
 * sides, from the shoulders down past the middle, each row lying over the one under it.
 */
function backOf(s: Smith): Mesh {
  const out: Mesh[] = [], T = s.torso, rows = s.back + 2, top = s.shoulder[2] - 0.02, foot = T.z[2] + 0.04;
  for (let r = 0; r < rows; r++) {
    const z = lerp(foot, top, r / (rows - 1)), across = 5 - (r % 2);
    const rr = torsoAt(s, z), size = (rr.w + rr.h) * 0.3;
    for (let q = 0; q < across; q++) {
      const a = -Math.PI / 2 + (q - (across - 1) / 2) * (2.4 / 4);
      const nrm = bodyOut(s, z, a), up = unit(add(nrm, [0, 0, -0.2]));
      out.push(rock(onBody(s, z, a, 0.04 + r * 0.012), [size * 0.6, size * 0.52, size * 0.16], { up, fwd: [0, 0, 1], n: 7, bevel: 0.5, rough: 0.08, seed: 140 + r * 9 + q, mat: jitter(r * 9 + q) < 0.55 ? 'crystalDark' : 'stoneDark' }));
    }
  }
  return merge(...out);
}

/** A strap round the body through points on it, each (height, round from its right, off it) in the chest's frame, a few between each. */
function strapOn(s: Smith, keys: ReadonlyArray<readonly [number, number, number]>, w: number, t: number, closed = false, mat: Mat = 'leather'): Mesh {
  const pts: V3[] = [], outs: V3[] = [];
  const list = closed ? [...keys, keys[0]] : keys;
  for (let q = 0; q < list.length - 1; q++) {
    const [z0, a0, o0] = list[q], [z1, a1, o1] = list[q + 1];
    const a1n = closed && q === list.length - 2 ? a1 + TAU * Math.round((a0 - a1) / TAU) : a1;
    for (let u = 0; u < 3; u++) {
      const z = lerp(z0, z1, u / 3), a = lerp(a0, a1n, u / 3);
      pts.push(onBody(s, z, a, lerp(o0, o1, u / 3)));
      outs.push(bodyOut(s, z, a));
    }
  }
  const [zl, al, ol] = list[list.length - 1];
  pts.push(onBody(s, zl, al, ol));
  outs.push(bodyOut(s, zl, al));
  return band(pts, outs, w, t, mat);
}

/** Where the harness's buckle or ring is on its chest: how high in the chest's frame. */
const buckleZ = (s: Smith): number => s.shoulder[2] - [0.1, 0.18, 0.26][s.stage];

/**
 * What it wears, in the chest's frame. The Nailsprout's: the two straps of its basket, each over a shoulder, down its front and
 * round under its arm to the back. The Hammertin's: a strap over each shoulder down to a round brass buckle on its chest, and a
 * band round its chest through that. The Nailwright's: straps crossed over its chest through a brass ring, and a band round it
 * under its arms.
 */
function harnessOf(s: Smith, n: number): Mesh {
  const T = s.torso, S = s.shoulder, out: Mesh[] = [], P = Math.PI / 2, w = [0.06, 0.08, 0.12][s.stage], th = [0.014, 0.02, 0.028][s.stage];
  const z = buckleZ(s), ring = (): Mesh => brassOf(s, n);
  const shoulderTop = S[2] + [0.04, 0.06, 0.08][s.stage];
  for (const sd of [1, -1]) {
    // Over the shoulder from the back, angles round from its right: the left side's are the right's mirrored round the front.
    const A = (a: number): number => (sd > 0 ? a : Math.PI - a);
    if (s.harness === 0) {
      out.push(strapOn(s, [[S[2] - 0.12, A(-1.1), 0.02], [shoulderTop, A(-0.42), 0.025], [shoulderTop, A(0.42), 0.025], [S[2] - 0.08, A(1.0), 0.02], [T.z[3], A(0.92), 0.018], [T.z[3] - 0.02, A(0.2), 0.02], [T.z[3], A(-0.8), 0.02]], w, th));
    } else if (s.harness === 1) {
      out.push(strapOn(s, [[S[2] - 0.2, A(-1.15), 0.02], [shoulderTop, A(-0.5), 0.03], [shoulderTop, A(0.42), 0.03], [S[2] - 0.06, A(1.05), 0.025], [z + 0.02, A(P - 0.16), 0.03]], w, th));
    } else {
      out.push(strapOn(s, [[S[2] - 0.3, A(-1.2), 0.03], [shoulderTop, A(-0.5), 0.035], [shoulderTop, A(0.45), 0.035], [S[2] - 0.08, A(1.0), 0.03], [z + 0.02, A(P - 0.12), 0.035]], w, th));
      out.push(strapOn(s, [[z - 0.02, A(P + 0.12), 0.035], [z - 0.24, A(P + 0.7), 0.03], [T.z[3] + 0.12, A(P + 1.25), 0.03], [T.z[3] + 0.1, A(P + 2.0), 0.03]], w * 0.9, th));
    }
  }
  if (s.harness === 1) out.push(strapOn(s, Array.from({ length: 12 }, (_, q) => [z, P + 0.2 + (q / 12) * (TAU - 0.4), 0.02] as [number, number, number]), w * 0.9, th));
  if (s.harness === 2) out.push(strapOn(s, Array.from({ length: 14 }, (_, q) => [z - 0.06 - 0.03 * Math.sin((q / 14) * TAU), P + 0.25 + (q / 14) * (TAU - 0.5), 0.025] as [number, number, number]), w * 0.85, th));
  if (s.harness) out.push(ring());
  return merge(...out);
}

/** The Hammertin's round brass buckle with its bar and tongue, or the Nailwright's brass ring, on its chest. */
function brassOf(s: Smith, n: number): Mesh {
  const z = buckleZ(s), a = Math.PI / 2, p = onBody(s, z, a, 0.05), nrm = bodyOut(s, z, a);
  const R0 = s.stage === 1 ? 0.07 : 0.11, r = R0 * (s.stage === 1 ? 0.22 : 0.26);
  const [X] = frameOf(nrm, [0, 0, 1]);
  const out: Mesh[] = [hoop(p, nrm, R0, r, 'fitting', n + 2)];
  if (s.stage === 1) {
    out.push(tube([add(p, scale(X, -R0)), add(p, scale(X, R0))], r * 0.9, r * 0.9, 5, 'fitting'));
    out.push(paint([disc(add(p, scale(nrm, -0.005)), nrm, R0 * 0.8, R0 * 0.8, 10, 'leatherDark')]));
  } else {
    out.push(paint([disc(add(p, scale(nrm, -0.01)), nrm, R0 * 0.74, R0 * 0.74, 10, 'leatherDark')]));
  }
  out.push(paint([disc(add(p, add(scale(nrm, r * 1.05), [0, 0, R0 * 0.55])), nrm, r * 0.7, r * 0.4, 6, 'glint', { lit: true })]));
  return merge(...out);
}

/** The fluff of its chest under its chin: soft cream tufts round the top of its bib, lying down and out over it; in the chest's frame. */
function fluffOf(s: Smith): Mesh {
  const out: Mesh[] = [], z0 = s.neck.at[2] - 0.02 - 0.03 * s.stage, L = [0.07, 0.11, 0.16][s.stage];
  for (let q = 0; q < 7; q++) {
    const a = Math.PI / 2 + ((q - 3) / 3) * 0.42;
    const root = onBody(s, z0, a, -0.01), o = unit([Math.cos(a), Math.sin(a), 0]);
    const len = L * (0.8 + 0.4 * jitter(q + 3));
    const tip = add(add(root, scale(o, len * 0.55)), [0, 0, -len * 0.75]);
    const mid = add(mixV(root, tip, 0.5), scale(o, len * 0.12));
    out.push(tube([root, mid, tip], [len * 0.3, len * 0.36, 0], [len * 0.12, len * 0.16, 0], 5, 'mark', { up: o }));
  }
  return merge(...out);
}

/**
 * Its fur, in the chest's frame: short dark strokes down its flanks, sides and back, each lying down the body the way the fur
 * does, a few to a row.
 */
function furOf(s: Smith): Mesh {
  const out: Disc[] = [], T = s.torso, L = [0.05, 0.08, 0.12][s.stage];
  for (let q = 0; q < 22; q++) {
    const z = lerp(T.z[1] + 0.04, s.shoulder[2], jitter(q * 3 + 1));
    // Round the back and both sides, kept off the cream of the belly.
    const a = -Math.PI / 2 + (jitter(q * 3 + 2) - 0.5) * 2 * (Math.PI - 0.95);
    const p = onBody(s, z, a, 0.006), nrm = bodyOut(s, z, a);
    out.push(disc(p, nrm, L * 0.14, L * (0.8 + 0.5 * jitter(q + 7)), 5, 'coatDark', { up: [0, 0, 1], spin: (jitter(q + 9) - 0.5) * 0.5 }));
  }
  return paint(out);
}

/**
 * A nail, its head at the origin and its shank down `-z` to its point, `L` long: square in section, as one forged is, and its
 * head a round flat cap a little wider than the shank.
 */
function nailMesh(L: number, w: number, mat: Mat = 'metal', headMat: Mat = 'metalDark'): Mesh {
  return merge(
    tube([[0, 0, 0], [0, 0, -L * 0.75], [0, 0, -L]], [w, w * 0.8, 0.002], [w, w * 0.8, 0.002], 4, mat, { start: false }),
    tube([[0, 0, -w * 0.25], [0, 0, w * 0.55]], w * 2.1, w * 2.1, 6, headMat),
  );
}
/** A nail with its head at `c` and its point the way `dir` from there, in the frame of whatever it is in. */
function nailAt(c: V3, dir: V3, L: number, w: number, mat?: Mat, headMat?: Mat): Mesh {
  const m = nailMesh(L, w, mat, headMat), [X, Y, Z] = frameOf(scale(unit(dir), -1), Math.abs(dir[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]);
  return mesh(m.v.map((p) => add(c, add(add(scale(X, p[0]), scale(Y, p[1])), scale(Z, p[2])))), m.f);
}

/**
 * The basket, in its own frame from the middle of its foot up its axis: woven in two shades, wider at its rim, a thick rim; the
 * Hammertin's bound round with leather and studded with brass. Dark inside, under what is in it.
 */
function basketOf(s: Smith, n: number): Mesh {
  const B = s.pack, [r0, r1] = B.r, h = B.h, out: Mesh[] = [];
  const rings = 8, sides = n + 6;
  const zs = Array.from({ length: rings }, (_, q) => (q / (rings - 1)) * h);
  const rs = zs.map((z) => lerp(r0, r1, z / h) * (1 + 0.06 * Math.sin((z / h) * Math.PI)));
  out.push(tube(zs.map((z) => [0, 0, z] as V3), rs, rs, sides, (ring, j) => ((ring + j) % 2 ? 'wood' : 'woodDark'), { end: false }));
  const lip: V3[] = Array.from({ length: sides + 1 }, (_, q) => [Math.cos((q / sides) * TAU) * r1 * 1.04, Math.sin((q / sides) * TAU) * r1 * 1.04, h]);
  out.push(tube(lip, r1 * 0.08, r1 * 0.08, 5, s.stage ? 'leather' : 'woodDark', { start: false, end: false }));
  out.push(tube([[0, 0, h * 0.86], [0, 0, h * 0.88]], r1 * 0.97, r1 * 0.97, sides, 'bark'));
  if (s.stage === 1) {
    // Two bands of leather round it, brass studs on them.
    for (const f of [0.22, 0.66]) {
      const z = h * f, r = lerp(r0, r1, f) * (1 + 0.06 * Math.sin(f * Math.PI)) + 0.012;
      const pts: V3[] = Array.from({ length: sides + 1 }, (_, q) => [Math.cos((q / sides) * TAU) * r, Math.sin((q / sides) * TAU) * r, z]);
      out.push(band(pts, pts.map((p) => [p[0], p[1], 0] as V3), h * 0.1, 0.02, 'leather'));
      out.push(paint(Array.from({ length: 6 }, (_, q) => { const a = (q / 6) * TAU + 0.3; return disc([Math.cos(a) * (r + 0.012), Math.sin(a) * (r + 0.012), z], [Math.cos(a), Math.sin(a), 0], 0.018, 0.018, 6, 'fitting'); })));
    }
  }
  return merge(...out);
}

/**
 * What stands in the pack, in its frame, and how its nails are laid out so they can rattle (`rattled`): the Nailsprout's few
 * nails and bits of metal, a lump of iron, a bar, a brass offcut; the Hammertin's big nails standing up heads out every way; the
 * Nailwright's ore heaped in its crate and a sheaf of giant nails bound together standing up out of it.
 */
interface Load { nails: Mesh; spans: Array<[number, number, V3]>; heap: Mesh }
function loadOf(s: Smith, fine: boolean): Load {
  const B = s.pack, h = s.crate ? B.h : B.h * 0.84, nails: Mesh[] = [], spans: Array<[number, number, V3]> = [], heap: Mesh[] = [];
  let count = 0;
  const N = s.crate ? B.nails : fine ? B.nails + 1 : B.nails;
  for (let q = 0; q < N; q++) {
    const L = B.nail * (0.8 + 0.3 * jitter(q + 5)), w = L * (s.crate ? 0.045 : 0.055);
    let foot: V3, dir: V3;
    if (s.crate) {
      // A sheaf: close together toward the back of the crate, fanned a little, half their length down in it.
      const a = (q / N) * TAU + 0.4, r = B.r[1] * 0.28 * (q ? 1 : 0);
      foot = [-B.r[0] * 0.25 + Math.cos(a) * r, -B.r[1] * 0.2 + Math.sin(a) * r * 0.8, h - L * 0.35];
      dir = unit([Math.cos(a) * 0.12 + (jitter(q) - 0.5) * 0.06, Math.sin(a) * 0.1, 1]);
    } else {
      const a = (q / N) * TAU + 0.5 + jitter(q + 3) * 0.5, r = B.r[1] * 0.45;
      foot = [Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, h * 0.25];
      dir = unit([Math.cos(a) * (0.25 + 0.25 * jitter(q + 11)), Math.sin(a) * (0.25 + 0.25 * jitter(q + 11)), 1]);
    }
    const m = nailAt(add(foot, scale(dir, L)), scale(dir, -1), L, w);
    spans.push([count, count + m.v.length, foot]);
    count += m.v.length;
    nails.push(m);
  }
  if (s.crate) {
    // A strap of leather round the sheaf.
    const c: V3 = [-B.r[0] * 0.25, -B.r[1] * 0.2, h + B.nail * 0.22];
    heap.push(hoop(c, [0, 0, 1], B.r[1] * 0.34, 0.03, 'leather', 10));
    // Ore heaped in the crate, round the sheaf.
    for (let q = 0; q < B.bits; q++) {
      const x = (jitter(q + 31) - 0.5) * 1.6 * B.r[0], y = (jitter(q + 37) - 0.5) * 1.5 * B.r[1], r = 0.1 + 0.06 * jitter(q + 41);
      heap.push(rock([x, y, h + r * 0.3], [r, r * 0.85, r * 0.7], { n: 5, seed: 200 + q, mat: jitter(q + 43) < 0.55 ? 'shell' : jitter(q + 47) < 0.6 ? 'shellDark' : 'stoneDark', bevel: 0.35 }));
    }
  } else if (B.bits) {
    // A lump of iron, a bar, a brass offcut and a scrap, among the nails.
    const r = B.r[1];
    heap.push(rock([r * 0.32, -r * 0.3, h * 1.02], [0.065, 0.055, 0.05], { n: 5, seed: 230, mat: 'metalDark', bevel: 0.35 }));
    heap.push(rock([-r * 0.35, -r * 0.15, h * 1.04], [0.055, 0.05, 0.045], { n: 5, seed: 233, mat: 'metal', bevel: 0.35 }));
    heap.push(rock([-r * 0.05, r * 0.35, h * 1.06], [0.05, 0.045, 0.07], { n: 4, seed: 231, mat: 'fitting', bevel: 0.2, rough: 0.05 }));
    heap.push(rock([r * 0.2, r * 0.1, h * 1.0], [0.05, 0.045, 0.04], { n: 5, seed: 232, mat: 'shell', bevel: 0.35 }));
  }
  return { nails: merge(...nails), spans, heap: merge(...heap) };
}

/** The pack's nails rattling: each nail turned a little about its foot, every one its own way, as hard as the pose says. */
function rattled(spans: Array<[number, number, V3]>, P: (a: Anim) => Plan): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const [k, ph] = P(a).rattle;
    if (k <= 0.02) return v as V3[];
    const out = v.slice() as V3[];
    spans.forEach(([i0, i1, foot], q) => {
      const ax = 0.07 * k * Math.sin(TAU * (ph * 3 + jitter(q + 1))), ay = 0.07 * k * Math.sin(TAU * (ph * 3 + jitter(q + 9)) + 1);
      const lift = 0.01 * k * Math.max(0, Math.sin(TAU * (ph * 2 + jitter(q + 4))));
      for (let i = i0; i < i1; i++) {
        const p = v[i], dz = p[2] - foot[2];
        out[i] = [p[0] + ax * dz, p[1] + ay * dz, p[2] + lift];
      }
    });
    return out;
  };
}

/**
 * The crate, in its own frame from the middle of its foot: a box of planks, iron bands round it at its foot, its middle and its
 * rim, iron down each corner, rivets on the bands where it is drawn big; dark inside under the ore.
 */
function crateOf(s: Smith, fine: boolean): Mesh {
  const [W, D] = s.pack.r, H = s.pack.h, out: Mesh[] = [];
  out.push(tube([[0, -D, H / 2], [0, D, H / 2]], W * Math.SQRT2, (H / 2) * Math.SQRT2, 4, 'wood'));
  out.push(paint([{ v: [[-W * 0.94, -D * 0.92, H + 0.002], [W * 0.94, -D * 0.92, H + 0.002], [W * 0.94, D * 0.92, H + 0.002], [-W * 0.94, D * 0.92, H + 0.002]], m: 'bark' }]));
  // The gaps between its slats across its back and sides, the ore packed in it showing through them.
  const lines: Disc[] = [];
  for (const k of [1, 2, 3.4, 4.4]) {
    const z = (H * k) / 5.2, th = H * 0.028;
    lines.push({ v: [[-W, -D - 0.003, z - th], [W, -D - 0.003, z - th], [W, -D - 0.003, z + th], [-W, -D - 0.003, z + th]], m: 'shell' });
    for (const sd of [1, -1]) lines.push({ v: [[sd * (W + 0.003), -D, z - th], [sd * (W + 0.003), D, z - th], [sd * (W + 0.003), D, z + th], [sd * (W + 0.003), -D, z + th]], m: 'shell' });
    if (fine) {
      for (let q = 0; q < 5; q++) {
        const x = (q / 4 - 0.5) * 1.6 * W + (jitter(q + k * 7) - 0.5) * 0.1;
        lines.push(disc([x, -D - 0.005, z], [0, -1, 0], th * 0.9, th * 0.6, 5, 'shellDark'));
      }
    }
  }
  out.push(paint(lines.map((l) => ({ ...l, v: windOut(l.v) }))));
  // Iron: bands round it, and down each corner.
  const t = 0.03, bh = H * 0.05;
  for (const z of [bh, H * 0.52, H - bh]) {
    const corner: V3[] = [[-W - t, -D - t, z], [W + t, -D - t, z], [W + t, D + t, z], [-W - t, D + t, z]];
    for (let q = 0; q < 4; q++) {
      const a = corner[q], b = corner[(q + 1) % 4], m = mixV(a, b, 0.5), half: V3 = [Math.abs(b[0] - a[0]) / 2 + t, Math.abs(b[1] - a[1]) / 2 + t, bh];
      out.push(box(m, [Math.max(half[0], t), Math.max(half[1], t), half[2]], 'metalDark'));
    }
    if (fine) {
      const studs: Disc[] = [];
      for (const x of [-0.6, 0, 0.6]) studs.push(disc([x * W, -D - t * 2 - 0.004, z], [0, -1, 0], 0.025, 0.025, 5, 'rivet'));
      for (const sd of [1, -1]) for (const y of [-0.5, 0.5]) studs.push(disc([sd * (W + t * 2 + 0.004), y * D, z], [sd, 0, 0], 0.025, 0.025, 5, 'rivet'));
      out.push(paint(studs));
    }
  }
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(box([x * (W + t * 0.4), y * (D + t * 0.4), H / 2], [t * 1.6, t * 1.6, H / 2], 'metalDark'));
  return merge(...out);
}
/** The corners of a flat shape wound to face out from the crate's middle. */
function windOut(v: V3[]): V3[] {
  let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
    cx += p[0]; cy += p[1];
  }
  return nx * cx + ny * cy < 0 ? [...v].reverse() : v;
}

/**
 * The hammer, along its frame's `z` from its grip up to its head, the head's face along `y`: a wooden handle with a leather
 * wrap at the grip, and a head of dressed stone; the Hammertin's and the Nailwright's set in an iron collar, the Nailwright's
 * sledge bound in iron at both faces.
 */
function hammerOf(s: Smith, n: number): Mesh {
  const H = s.hammer, [hl, hw, hh] = H.head, A = H.len, B = H.butt, r = hw * 0.2, out: Mesh[] = [];
  out.push(tube([[0, 0, -B], [0, 0, A * 0.5], [0, 0, A]], [r * 1.12, r, r * 0.95], [r * 1.12, r, r * 0.95], Math.max(5, n - 3), (ring) => (ring === 0 ? 'woodDark' : 'wood')));
  out.push(tube([[0, 0, -B * 0.85], [0, 0, s.paw * 0.9]], r * 1.3, r * 1.3, Math.max(5, n - 3), 'leather'));
  out.push(rock([0, 0, A], [hw * 0.5 * Math.SQRT2, hh * 0.5 * Math.SQRT2, hl * 0.5], { up: [0, 1, 0], fwd: [0, 0, 1], n: 4, spin: Math.PI / 4, bevel: 0.22, rough: 0.05, seed: 300 + s.stage, mat: 'hornDark' }));
  if (s.stage) out.push(box([0, 0, A - hh * 0.5], [r * 1.6, r * 1.6, hh * 0.12], 'metalDark'));
  if (H.sledge) for (const sd of [1, -1]) out.push(box([0, sd * hl * 0.34, A], [hw * 0.53, hl * 0.06, hh * 0.53], 'metalDark'));
  return merge(...out);
}

/** The right paw closed round the hammer's handle, in the hammer's frame: a furred fist, its four claws curled over the front. */
function fistOf(s: Smith, n: number, k: number): Mesh {
  const p = s.paw * 1.15, out: Mesh[] = [egg([p * 0.12, -p * 0.05, 0], UPRIGHT, [p * 1.05, p * 1.0, p * 1.15], n, k, 'coat')];
  for (const q of [-1.5, -0.5, 0.5, 1.5]) {
    const z = q * p * 0.36;
    out.push(taper(curve([-p * 0.6, p * 0.5, z], [-p * 0.15, p * 1.15, z], [p * 0.42, p * 1.0, z - p * 0.12], 2), p * 0.2, p * 0.05, 4, 'claw'));
  }
  return merge(...out);
}

/** The free paw, in the forearm's frame from the wrist down: a furred paw, and its four long pale claws curving down and forward. */
function pawOf(s: Smith, n: number, k: number): Mesh {
  const p = s.paw * 1.2, [L, w] = s.claw, out: Mesh[] = [egg([0, p * 0.15, -p * 0.5], UPRIGHT, [p * 1.15, p * 0.8, p * 1.05], n, k, 'coat')];
  out.push(egg([0, p * 0.6, -p * 0.55], UPRIGHT, [p * 0.8, p * 0.3, p * 0.72], n - 2, 3, 'pad'));
  // Four of them, splayed a little, the middle two the longest.
  for (const q of [-1.5, -0.5, 0.5, 1.5]) {
    const root: V3 = [q * p * 0.42, p * 0.42, -p * 1.1], l = L * (Math.abs(q) > 1 ? 0.88 : 1.05);
    out.push(taper(curve(root, add(root, [q * w * 0.5, l * 0.25, -l * 0.62]), add(root, [q * w * 1.0, l * 0.78, -l * 0.92]), 4), w, w * 0.12, 5, 'claw'));
  }
  return merge(...out);
}

/** A foot, in its bone's frame from the ankle: a furred mole's foot, a pink sole, and four pale claws spread forward. */
function footOf(s: Smith, n: number, k: number): Mesh {
  const [fl, fw] = s.leg.foot, drop = s.leg.len[2], out: Mesh[] = [];
  out.push(egg([0, fl * 0.12, -drop + fw * 0.28], UPRIGHT, [fw * 0.5, fl * 0.42, fw * 0.32], n, k, 'coat'));
  out.push(egg([0, fl * 0.14, -drop + fw * 0.06], UPRIGHT, [fw * 0.42, fl * 0.36, fw * 0.08], n - 2, 3, 'pad'));
  for (const q of [-1.5, -0.5, 0.5, 1.5]) {
    const root: V3 = [q * fw * 0.17, fl * 0.42, -drop + fw * 0.12], tip = add(root, [q * fw * 0.06, fl * 0.28, -fw * 0.11]);
    out.push(taper([root, add(mixV(root, tip, 0.5), [0, 0, fw * 0.02]), tip], fw * 0.085, fw * 0.012, 4, 'claw'));
  }
  return merge(...out);
}

/** The tail, in its bone's frame: short, its coat going paler to the tip, from the rump back and down to rest its tip on the ground. */
function tailOf(s: Smith): Mesh {
  const L = s.tail;
  return taper(curve([0, 0, 0], [0, -L * 0.6, -L * 0.1], [0, -L, -L * 0.42], 4), L * 0.24, L * 0.03, 6, (ring) => (ring < 2 ? 'coat' : 'coatLight'));
}

/**
 * The anvil it smiths on, in its own frame from the ground up to its top under the nail: the Nailsprout's a flat-topped block of
 * stone; the Hammertin's and the Nailwright's a small iron anvil on a block of stone, its horn to the left.
 */
function anvilMeshOf(s: Smith, n: number): Mesh {
  const A = anvilOf(s), top = A.top, k = [0.6, 1, 1.35][s.stage], out: Mesh[] = [];
  if (s.stage === 0) {
    out.push(rock([0, 0, top * 0.5], [0.15, 0.13, top * 0.5], { n: 6, seed: 400, mat: 'stone', bevel: 0.3, rough: 0.08 }));
    out.push(paint([disc([0, 0, top + 0.003], [0, 0, 1], 0.1, 0.085, 7, 'stoneDark')]));
    return merge(...out);
  }
  const iron = Math.min(top * 0.55, 0.32 * k), base = top - iron, w = 0.2 * k;
  out.push(rock([0, 0, base * 0.5], [w * 1.05, w * 0.9, base * 0.5], { n: 6, seed: 401 + s.stage, mat: 'stoneDark', bevel: 0.25, rough: 0.08 }));
  out.push(box([0, 0, base + iron * 0.12], [w * 0.75, w * 0.5, iron * 0.12], 'metalDark'));
  out.push(box([0, 0, base + iron * 0.45], [w * 0.38, w * 0.28, iron * 0.22], 'metalDark'));
  out.push(box([0.02 * k, 0, top - iron * 0.2], [w * 0.95, w * 0.42, iron * 0.2], 'metalDark'));
  out.push(taper([[-w * 0.95, 0, top - iron * 0.18], [-w * 1.35, 0, top - iron * 0.22], [-w * 1.75, 0, top - iron * 0.34]], iron * 0.19, 0.01, Math.max(5, n - 3), 'metalDark'));
  out.push(paint([{ v: [[-w * 0.9, -w * 0.36, top + 0.003], [w * 0.94, -w * 0.36, top + 0.003], [w * 0.94, w * 0.36, top + 0.003], [-w * 0.9, w * 0.36, top + 0.003]], m: 'metal' }]));
  return merge(...out);
}

/** The nail on the anvil, red hot, laid along it, in its own frame from its middle on the anvil's top. */
const billetOf = (s: Smith): Mesh => nailAt([billetLen(s) * 0.5, 0, nailThick(s) * 0.5], [-1, 0, 0], billetLen(s), nailThick(s) * 0.5, 'ember', 'flame');

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Smith): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];

/** A stage's pieces. */
function smithBuild(s: Smith, lod: number, P: (a: Anim) => Plan): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), pieces: Piece[] = [], fine = lod > 0;
  const hide = headSolids(s), body = bodySolid(s);
  const T = s.torso;
  const torso = painted(tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n + 6, 'coat', { up: [0, 1, 0] }), (c) => (creamBody(s, c) ? 'mark' : 'coat'));
  pieces.push({ key: 'torso', mesh: torso, bone: 'belly', bias: 0, breathes: { c: [0, 0, T.z[2]], k: 0.035 } });
  pieces.push({ key: 'neck', mesh: painted(tube([[0, 0, -0.08], [0, 0, s.neck.len + 0.06]], s.neck.w, s.neck.w * 0.9, n, 'coat'), (c) => (c[1] > 0.02 ? 'mark' : 'coat')), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: s.eye.shut ? undefined : headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'nose', mesh: noseOf(s, n, k), bone: 'nose', bias: 0.202, after: 'head', hide, hideIn: 'head' });
  for (const [i, sd] of [[0, -1], [1, 1]] as const) pieces.push({ key: `ear${i}`, mesh: earOf(s, sd, n), bone: 'head', bias: 0.19, after: 'head', hide, front: [sd, 0.3, 0.3] });
  pieces.push({ key: 'cap', mesh: capOf(s), bone: 'head', bias: 0.21, after: ['head', 'ear0', 'ear1'], hide: [{ c: skullAt(s), r: scale(s.head.r, 0.95) }] });
  // On the body: the fluff of its chest, the scales of its back, its harness; each hidden where it goes round behind it.
  pieces.push({ key: 'fluff', mesh: fluffOf(s), bone: 'chest', bias: 0.01, after: 'torso', hide: body, lines: false });
  pieces.push({ key: 'fur', mesh: furOf(s), bone: 'chest', bias: 0.008, after: 'torso', hide: body });
  if (s.back) pieces.push({ key: 'back', mesh: backOf(s), bone: 'chest', bias: 0.015, after: 'torso', hide: body });
  pieces.push({ key: 'harness', mesh: harnessOf(s, n), bone: 'chest', bias: 0.03, after: ['torso', 'fluff', 'back'], hide: body });
  // The pack on its back, and what is in it.
  const load = loadOf(s, fine), packFront: V3 = [0, -1, 0.2];
  pieces.push({ key: 'pack', mesh: s.crate ? crateOf(s, fine) : basketOf(s, n), bone: 'pack', bias: 0.25, after: ['torso', 'harness', 'back', 'cap'], front: packFront });
  if (load.heap.v.length) pieces.push({ key: 'heap', mesh: load.heap, bone: 'pack', bias: 0.255, after: 'pack', front: packFront });
  pieces.push({ key: 'nails', mesh: load.nails, bone: 'pack', bias: 0.26, after: load.heap.v.length ? ['pack', 'heap'] : 'pack', front: packFront, bent: rattled(load.spans, P) });
  // The tail, from under the pack whatever side it is seen from.
  pieces.push({ key: 'tail', mesh: tailOf(s), bone: 'tail', bias: -0.05, under: 'pack' });
  // Legs: a short thigh lost in the body, a short shin, a clawed foot.
  const L = s.leg;
  for (const key of ['ll', 'lr']) {
    const front: V3 = [0, 1, 0];
    const thigh = tube([[0, 0, 0.02], [0, 0, -L.len[0]]], [L.w * 1.4, L.w], [L.w * 1.4, L.w], n, 'coat', { seam: 'start' });
    const shin = tube([[0, 0, L.w * 0.4], [0, 0.005, -L.len[1]]], [L.w, L.w * 0.9], [L.w, L.w * 0.9], n, 'coat', { seam: 'start' });
    pieces.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, under: 'torso' },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['torso', `${key}0`], front },
      { key: `${key}2`, mesh: footOf(s, n, k), bone: `${key}2`, bias: 0.02, after: ['torso', `${key}1`], front },
    );
  }
  // Arms: a furred upper arm under its stone plates, a forearm; the right paw a fist on the hammer, the left open, its claws out.
  for (let i = 0; i < 2; i++) {
    const out: V3 = [i ? 1 : -1, 0, 0], m = (x: Mesh): Mesh => (i ? x : mirror(x)), after = ['torso', 'harness', 'fluff'];
    const upper = merge(
      egg([0, 0, -s.arm[0] * 0.25], UPRIGHT, [s.armW[0] * 1.25, s.armW[0] * 1.25, s.arm[0] * 0.62], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -s.arm[0]]], [s.armW[0] * 1.1, s.armW[1] * 1.05], [s.armW[0] * 1.1, s.armW[1] * 1.05], n, 'coat', { seam: 'start' }),
    );
    const fore = tube([[0, 0, s.armW[1] * 0.4], [0, 0, -s.arm[1] + s.paw * 0.3]], [s.armW[1] * 1.05, s.armW[1] * 0.9], [s.armW[1] * 1.05, s.armW[1] * 0.9], n, 'coat', { seam: 'start' });
    pieces.push(
      { key: `arm${i}`, mesh: upper, bone: `arm${i}`, bias: 0.06, after, front: out },
      { key: `fore${i}`, mesh: fore, bone: `elbow${i}`, bias: 0.065, after: [...after, `arm${i}`], front: out },
    );
    if (s.pauldron) pieces.push({ key: `pauldron${i}`, mesh: m(pauldronOf(s)), bone: `shoulder${i}`, bias: 0.068, after: [...after, `arm${i}`, `fore${i}`], front: out });
  }
  pieces.push({ key: 'hand0', mesh: pawOf(s, n, k), bone: 'hand0', bias: 0.07, after: ['torso', 'harness', 'fore0', 'tool'], front: [-1, 0.3, 0] });
  // The hammer, and the paw round it.
  pieces.push({ key: 'tool', mesh: hammerOf(s, n), bone: 'tool', bias: 0.05 });
  pieces.push({ key: 'hand1', mesh: fistOf(s, n, k), bone: 'tool', bias: 0.07, after: ['tool', 'fore1'] });
  // At its task: the anvil, the nail on it, and the nail flipped into the crate.
  const working = (a: Anim): boolean => a.act?.kind === 'work';
  pieces.push({ key: 'anvil', mesh: anvilMeshOf(s, n), bone: 'anvil', bias: 0, shown: working });
  pieces.push({ key: 'billet', mesh: billetOf(s), bone: 'billet', bias: 0.005, after: 'anvil', shown: working });
  if (s.crate) pieces.push({ key: 'flung', mesh: nailAt([0, billetLen(s) * 0.5, 0], [0, -1, 0], billetLen(s), nailThick(s) * 0.5), bone: 'flung', bias: 0.3, shown: working });
  return pieces;
}

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a pixel is, in the units `g` is drawing in. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const SPARK: RGB = [255, 214, 110];
const SPARK_HOT: RGB = [255, 250, 226];
const SPARK_RED: RGB = [236, 110, 50];
const DUST: RGB = [196, 180, 156];
const CHIP: RGB = [150, 146, 140];
const GRAVITY = 9;
/** How big a stage's sparks and dust are, against the Hammertin's. */
const bigOf = (s: Smith): number => [0.55, 1, 1.5][s.stage];

/** Where something thrown from `p` going `v` is `t` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.01, p[2] + v[2] * t - 0.5 * GRAVITY * t * t)];

/**
 * Sparks struck from `from`, `since` seconds after: out every way and up, falling, each a short streak along its way, white-hot
 * going to orange and gone; each drawn on its side of the body.
 */
function sparks(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, life: number): void {
  if (since < 0 || since > life) return;
  const px = pxOf(g);
  g.save();
  g.lineCap = 'round';
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.4 + 0.9 * jitter(k + 1)), mine = life * (0.45 + 0.55 * jitter(k + 3));
    if (since > mine) continue;
    const v: V3 = [Math.cos(a) * sp, Math.sin(a) * sp, up * (0.4 + 0.9 * jitter(k + 2))];
    const p = thrown(from, v, since), p0 = thrown(from, v, Math.max(0, since - 0.035));
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p), [x0, y0] = onScreen(view, p0), fade = 1 - since / mine;
    g.strokeStyle = css(mix(SPARK_RED, SPARK, fade), Math.min(1, fade * 1.4));
    g.lineWidth = px * (1.1 + 0.9 * fade);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x, y);
    g.stroke();
    g.fillStyle = css(SPARK_HOT, fade);
    g.beginPath();
    g.arc(x, y, px * (0.6 + 0.8 * fade), 0, TAU);
    g.fill();
  }
  g.restore();
}

/** The flash where a blow lands: a star of short white-gold rays, quickly gone. */
function flash(g: CanvasRenderingContext2D, view: View, at: V3, since: number, size: number): void {
  const life = 0.09;
  if (since < 0 || since > life) return;
  const [x, y] = onScreen(view, at), k = 1 - since / life, px = pxOf(g), r = size * (0.6 + 0.6 * (1 - k));
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = css(SPARK_HOT, k);
  g.lineWidth = Math.max(px * 1.4, size * 0.08);
  for (let q = 0; q < 8; q++) {
    const a = (q / 8) * TAU + 0.2, l = q % 2 ? r * 0.55 : r;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2 * 0.7);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.7);
    g.stroke();
  }
  g.restore();
}

/** A flat ring on the ground at `c`, `rx` by `ry`: dust or a shock spreading. */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, rx: number, ry: number, rim: RGB, al: number, width: number): void {
  if (al <= 0.01 || rx <= 0) return;
  const N = 24;
  g.beginPath();
  for (let q = 0; q <= N; q++) {
    const a = (q / N) * TAU, [x, y] = onScreen(view, [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry, c[2]]);
    if (q) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.strokeStyle = css(rim, al);
  g.lineWidth = width;
  g.stroke();
}

/** Dust and chips of stone thrown from where a blow lands on the ground: puffs spreading low, chips flung out and falling. */
function dust(g: CanvasRenderingContext2D, view: View, mid: V3, at: V3, since: number, front: boolean, big: number, id: number): void {
  if (since < 0 || since > 0.6) return;
  const px = pxOf(g);
  for (let q = 0; q < 7; q++) {
    const a = jitter(id + q) * TAU, d = big * 0.35 * (0.4 + since * 2.4) * (0.6 + 0.6 * jitter(id + q + 3));
    const p: V3 = [at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d, 0.04 + since * 0.4 * big];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p), r = big * 0.09 * (0.6 + 1.6 * since), al = 0.55 * (1 - since / 0.6);
    g.fillStyle = css(DUST, al);
    g.beginPath();
    g.ellipse(x, y, r, r * 0.7, 0, 0, TAU);
    g.fill();
  }
  for (let q = 0; q < 6; q++) {
    const k = id + 50 + q * 5, a = jitter(k) * TAU, sp = big * 1.4 * (0.5 + jitter(k + 1));
    const p = thrown(at, [Math.cos(a) * sp, Math.sin(a) * sp, big * 2.4 * (0.5 + jitter(k + 2))], since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p), r = Math.max(px * 1.2, big * 0.025);
    g.fillStyle = css(CHIP, 1 - since / 0.6);
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** The hammer's striking face where it is posed. */
const faceOf = (s: Smith, b: Bones): V3 => place(b.tool, faceAt(s));

/**
 * What a go at its task throws: at each blow on the nail a flash and sparks off the anvil, a few for the Nailsprout's taps, a
 * spray for the Hammertin's, a burst for the Nailwright's, the second the bigger; and a trail of sparks off the Nailwright's
 * nail as it is flipped.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Smith, b: Bones, t: number, front: boolean): void {
  if (!b.billet) return;
  const big = bigOf(s), mid = b.chest.t, T = ACT_SECS.work, at = add(b.billet.t, [0, 0, nailThick(s)]);
  hitsOf(s).forEach((h, q) => {
    let since = (t - h) * T;
    if (since < 0) since += T;
    const k = s.stage === 2 ? (q ? 1.4 : 1) : 1;
    if (front) flash(g, view, at, since, 0.22 * big * k);
    sparks(g, view, mid, at, since, front, [5, 12, 18][s.stage] * k | 0, 11 + q * 37, 1.3 * big * k, 2.2 * Math.sqrt(big) * k, [0.28, 0.42, 0.55][s.stage]);
  });
  if (b.flung) sparks(g, view, mid, b.flung.t, 0.02 + frac(t * 9) * 0.05, front, 3, 91, 0.2, 0.2, 0.1);
}

/** What a strike throws: sparks off the little hammer, sparks and dust off the Hammertin's, and the Nailwright's sledge a shock, dust, chips and sparks. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Smith, b: Bones, t: number, front: boolean): void {
  const since = (t - NAIL_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t, big = bigOf(s);
  if (since <= 0) return;
  const p = faceOf(s, b), low: V3 = [p[0], p[1], Math.max(0.02, p[2])];
  if (front) flash(g, view, low, since, 0.2 * big);
  sparks(g, view, mid, low, since, front, [5, 9, 14][s.stage], 23, 1.2 * big, 2 * Math.sqrt(big), 0.4);
  if (s.stage) dust(g, view, mid, low, since, front, big, 5);
  if (s.stage === 2 && !front) {
    const age = since / 0.5;
    if (age < 1) groundRing(g, view, [low[0], low[1], 0.02], big * (0.3 + 1.2 * age), big * (0.24 + 1.0 * age), DUST, 0.7 * (1 - age), pxOf(g) * 2);
  }
}

/** Evolving: a burst of sparks off it, then sparks and flakes of iron spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Smith, b: Bones, t: number, front: boolean): void {
  const big = 0.6 + 0.4 * bigOf(s), mid = b.chest.t, T = s.torso;
  if (t < 0.3) sparks(g, view, mid, place(b.chest, [0, 0, T.z[4]]), t * ACT_SECS.evolve, front, 14, 5, 1.1 * big, 2.4, 0.5);
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = Math.max(...T.w) * 1.7 + 0.2, high = T.z[T.z.length - 1] + s.high + s.head.up * 2, px = pxOf(g);
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32), ang = (q / 18) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const p: V3 = [mid[0] + Math.cos(ang) * rx * kk, mid[1] + Math.sin(ang) * rx * kk, 0.1 + u * high * 0.85];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3 === 0) {
      // A flake of iron, a little grey diamond turning.
      const r = 0.06 * big, sp = ang * 2;
      g.fillStyle = css([170, 172, 180], swirl);
      g.strokeStyle = css([70, 72, 84], swirl);
      g.lineWidth = Math.max(px * 0.8, r * 0.16);
      g.beginPath();
      g.moveTo(x + Math.cos(sp) * r, y + Math.sin(sp) * r * 0.6);
      g.lineTo(x - Math.sin(sp) * r * 0.5, y + Math.cos(sp) * r * 0.3);
      g.lineTo(x - Math.cos(sp) * r, y - Math.sin(sp) * r * 0.6);
      g.lineTo(x + Math.sin(sp) * r * 0.5, y - Math.cos(sp) * r * 0.3);
      g.closePath();
      g.fill();
      g.stroke();
    } else {
      g.fillStyle = css(mix(SPARK_RED, SPARK_HOT, 1 - u), swirl * ramp(u, 0, 0.15));
      g.beginPath();
      g.arc(x, y, Math.max(px * 1.1, 0.03 * big * (1 - 0.4 * u)), 0, TAU);
      g.fill();
    }
  }
}

/** Light over it: the glow of the hot nail on the anvil and a flare at each blow; a forge's glow as it evolves. */
function smithGlow(s: Smith, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act, out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], big = bigOf(s);
  if (act?.kind === 'work' && b.billet) {
    let flare = 0;
    for (const h of hitsOf(s)) { let since = (act.t - h) * ACT_SECS.work; if (since < 0) since += ACT_SECS.work; flare = Math.max(flare, Math.exp(-since * 14)); }
    const k = downOf(act.t, a.graze);
    out.push({ p: add(b.billet.t, [0, 0, 0.04]), r: 0.35 * big, c: [255, 150, 70], a: k * (0.3 + 0.45 * flare) });
    if (b.flung) out.push({ p: b.flung.t, r: 0.2 * big, c: [255, 160, 80], a: 0.4 });
    return out;
  }
  if (act?.kind === 'strike') {
    const since = (act.t - NAIL_HITS[s.stage]) * ACT_SECS.strike;
    if (since > 0) out.push({ p: faceOf(s, b), r: 0.4 * big, c: [255, 200, 120], a: 0.5 * Math.exp(-since * 12) });
    return out;
  }
  if (act?.kind !== 'evolve') return out;
  const T = s.torso, open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.chest, [0, 0, T.z[4]]), r: T.z[T.z.length - 1] - T.z[0], c: [255, 196, 140], a: 0.55 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.head, skullAt(s)), r: (T.z[T.z.length - 1] - T.z[0]) * 1.2, c: [255, 226, 180], a: k });
  return out;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the sparks it strikes as it smiths, strikes and evolves. */
function smithKind(s: Smith): Kind {
  const bones = smithBones(s);
  const R = restOf(s);
  const plan = (a: Anim): Plan => planOf(s, R, { ...a, go: a.act ? 0 : a.go });
  return {
    bones,
    build: (lod) => smithBuild(s, lod, plan),
    // The variant's coat is its back, head and limbs, kept deep; its markings the cream of its belly and face. Its pink ears and
    // nose, rosy cheeks, pale claws, stone, leather, brass, iron and wood are the same on every variant.
    palette: (coat, mark) => {
      const deep = mix(coat, pastel(coat, 28), 0.22), cream = mix([246, 228, 198], pastel(mark, 36), 0.4);
      return coatPalette(coat, mark, {
        coat: deep,
        coatDark: mix(deep, [40, 32, 30], 0.3),
        coatLight: mix(deep, [230, 220, 206], 0.35),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 252, 244], 0.35),
        inner: [240, 164, 166],
        nose: [232, 132, 146],
        pad: [214, 162, 160],
        lid: [46, 34, 34],
        eye: [62, 40, 34],
        tongue: [236, 128, 136],
        glint: [255, 255, 255],
        claw: [240, 232, 214],
        stone: [208, 194, 172],
        hornDark: [140, 128, 120],
        stoneDark: [178, 164, 146],
        crystalDark: [150, 158, 168],
        shell: [178, 112, 74],
        shellDark: [132, 84, 62],
        leather: [150, 96, 62],
        leatherDark: [104, 66, 46],
        fitting: [226, 184, 92],
        metal: [160, 162, 170],
        metalDark: [98, 100, 112],
        metalLit: [216, 220, 226],
        rivet: [198, 200, 206],
        wood: [196, 150, 98],
        woodDark: [146, 104, 66],
        bark: [64, 48, 40],
        hoof: [118, 102, 90],
        ember: [255, 128, 56],
        flame: [255, 196, 96],
      }, 28);
    },
    shadow: [Math.max(...s.torso.h) * 1.15 + s.pack.r[1] * 0.5, Math.max(...s.torso.w) * 1.15],
    stride: 1.4,
    size: s.size,
    blinks: s.eye.shut ? 0 : 5,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are sparks and iron.
    motes: [[255, 196, 110], [172, 174, 184]],
    glow: (b, a) => smithGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const NAILSPROUT = smithKind(NAILSPROUT_LOOK);
export const HAMMERTIN = smithKind(HAMMERTIN_LOOK);
export const NAILWRIGHT = smithKind(NAILWRIGHT_LOOK);
