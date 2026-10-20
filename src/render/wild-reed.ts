import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The reed line: the Reedpup, a little otter long and low on all fours with a
 * mantle of green reed leaves along its back from its neck to its tail, which
 * grows into the Reedweaver, a plump otter up on its hind legs under a leaf
 * mantle over its shoulders, hugging a bundle of green reeds with two cream
 * pampas plumes in it, and then the Marshreaper, a big upright otter under a
 * great woven mantle, braided reed bands crossing its chest, pampas plumes
 * rising behind its shoulders and a reed-bound staff with a curved pale blade
 * -- a scythe -- held across its body. The species is still `sedra`
 * underneath, as saves and the database know it: the reed cutter, that cuts
 * reeds and carries them to the crate.
 *
 * Each is sleek warm-brown fur, a cream throat, chest and belly, darker brown
 * legs and paws, small round ears, a cream muzzle with a dark nose,
 * dark eyes, and a thick tapering otter's tail darker at its tip
 * with leaves along it. Every leaf of a mantle is a small blade of its own,
 * laid in overlapping rows on the body's own curve and pointing down it, in
 * three greens. All three are built by one set of functions from a
 * description of the stage (`Reed`), and walk the way the brick line does
 * (`./wild-brick`): every foot is given a point to be at and its leg bent to
 * reach it, the knee always the same way round, so a planted foot stays where
 * it was put. The Reedpup lopes, its back arching as its hind feet come up
 * under it; the two upright ones waddle, rolling over each foot, their tails
 * swaying behind. What the bigger two hold is a body of its own posed in front
 * of the chest, and their paws are carried to where it is gripped.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Reed {
  stage: 0 | 1 | 2;
  /** Up on its hind legs, or on all fours. */
  up: boolean;
  /** The body's rings, rump to chest, in its own frame: along its spine, which is level on all fours and nearly upright stood up. */
  body: Rings;
  /** How far round from straight under its cream comes at each ring (radians): its belly, chest and throat. */
  cream: number[];
  /** How far up from level its spine is carried, standing (degrees). */
  pitch: number;
  /** The hind legs: upper, lower and the ankle's height over the sole; how thick; the foot heel to toe. The hip on the right, in the body's frame. */
  hind: [number, number, number]; hindW: number; foot: number; hip: V3;
  /** The fore legs on all fours, the arms stood up: the same; the shoulder on the right. */
  fore: [number, number, number]; foreW: number; paw: number; shoulder: V3;
  /** How far out from its middle its fore feet and hind feet stand, and how far ahead of its shoulder and its hip. */
  stance: [number, number]; ahead: [number, number];
  /** How much of a hind leg's reach it stands at. */
  crouch: number;
  /** The neck's root on the body, its length, its width and how far forward of upright it is carried (degrees). */
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes (across, along, up); the muzzle's (across, up, along); the head's pitch, nose up. */
  head: { r: V3; muzzle: V3; pitch: number };
  eye: { dir: V3; size: number };
  ear: { dir: V3; r: number };
  tail: {
    at: V3; links: number[]; w: number[];
    /** Lifted at the root (degrees up from straight back), curled up at each link, and curled further at the last three. */
    lift: number; curl: number; tip: number;
  };
  /** The mantle: along the spine from `from` to `to`, down each flank to `low` (radians under level) at its foot and `top` at its head; each leaf's length and half-width; the gap between rows. */
  mantle: { from: number; to: number; low: number; top: number; leaf: [number, number]; gap: number; lift: number };
  /** What it carries: nothing, the bundle, the scythe. */
  load: 0 | 1 | 2;
  gait: {
    /** How much of a stride a foot is down, at a walk and at a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the body goes down at a footfall, walk and run, against its height. */
    step: number; bob: [number, number];
    /** How far it rolls over each foot (degrees); how far forward it leans into a run. */
    roll: number; lean: number;
  };
  size: number;
}

/** A Reedpup: a small otter long and low on short legs, a mantle of reed leaves from its neck to its tail, its tail curled up behind. */
const REEDPUP_LOOK: Reed = {
  stage: 0,
  up: false,
  body: { y: [-0.88, -0.62, -0.3, 0.02, 0.32, 0.54, 0.66], z: [0.05, 0.035, 0.03, 0.045, 0.03, 0.07, 0.12], w: [0.085, 0.18, 0.225, 0.2, 0.25, 0.22, 0.15], h: [0.08, 0.17, 0.215, 0.185, 0.265, 0.22, 0.155] },
  cream: [1.73, 1.75, 1.77, 1.79, 1.8, 1.81, 1.98],
  pitch: 3,
  hind: [0.15, 0.13, 0.04], hindW: 0.085, foot: 0.14, hip: [0.14, -0.44, -0.08],
  fore: [0.18, 0.16, 0.035], foreW: 0.075, paw: 0.1, shoulder: [0.14, 0.42, -0.07],
  stance: [0.15, 0.16], ahead: [0.03, 0.0],
  crouch: 0.8,
  neck: { at: [0, 0.6, 0.12], len: 0.05, w: 0.22, lean: 40 },
  head: { r: [0.265, 0.25, 0.215], muzzle: [0.155, 0.11, 0.145], pitch: 10 },
  eye: { dir: [0.52, 0.7, 0.42], size: 0.056 },
  ear: { dir: [0.74, -0.38, 0.56], r: 0.036 },
  tail: { at: [0, -0.8, 0.05], links: [0.12, 0.105, 0.1, 0.095, 0.09, 0.085, 0.08, 0.075], w: [0.1, 0.098, 0.093, 0.085, 0.074, 0.062, 0.05, 0.038], lift: -8, curl: 0.5, tip: 24 },
  mantle: { from: 0.52, to: -0.62, low: -1.22, top: -1.2, leaf: [0.22, 0.04], gap: 0.09, lift: 0.012 },
  load: 0,
  gait: { duty: [0.56, 0.3], swing: [0.32, 0.38], step: 0.26, bob: [0.035, 0.12], roll: 3, lean: 0 },
  size: 5.11,
};

/** A Reedweaver: up on its hind legs, plump, a leaf mantle over its shoulders and down its back, a bundle of reeds and two pampas plumes hugged in both arms. */
const REEDWEAVER_LOOK: Reed = {
  stage: 1,
  up: true,
  body: { y: [-0.6, -0.48, -0.2, 0.1, 0.36, 0.54, 0.66], z: [0.02, -0.03, -0.07, -0.06, -0.02, 0.0, 0.02], w: [0.34, 0.6, 0.66, 0.58, 0.44, 0.32, 0.22], h: [0.32, 0.54, 0.6, 0.52, 0.4, 0.3, 0.2] },
  cream: [0.26, 0.46, 0.5, 0.48, 0.44, 0.54, 0.82],
  pitch: 80,
  hind: [0.24, 0.22, 0.05], hindW: 0.11, foot: 0.36, hip: [0.3, -0.4, -0.04],
  fore: [0.3, 0.28, 0.05], foreW: 0.105, paw: 0.095, shoulder: [0.34, 0.42, -0.12],
  stance: [0.34, 0.2], ahead: [0, 0.06],
  crouch: 0.86,
  neck: { at: [0, 0.6, -0.02], len: 0.16, w: 0.22, lean: 12 },
  head: { r: [0.33, 0.3, 0.27], muzzle: [0.19, 0.125, 0.16], pitch: 8 },
  eye: { dir: [0.5, 0.72, 0.4], size: 0.058 },
  ear: { dir: [0.74, -0.38, 0.56], r: 0.045 },
  tail: { at: [0, -0.5, 0.18], links: [0.14, 0.13, 0.125, 0.12, 0.115, 0.11, 0.1, 0.09], w: [0.15, 0.14, 0.13, 0.115, 0.1, 0.085, 0.068, 0.05], lift: -30, curl: 7, tip: 20 },
  mantle: { from: 0.64, to: 0.3, low: -1.05, top: 0.45, leaf: [0.26, 0.036], gap: 0.1, lift: 0.015 },
  load: 1,
  gait: { duty: [0.62, 0.4], swing: [0.24, 0.38], step: 0.2, bob: [0.035, 0.065], roll: 11, lean: 16 },
  size: 4.4,
};

/** A Marshreaper: big and upright under a great woven mantle, braided bands across its chest, plumes behind its shoulders, a scythe across its body. */
const MARSHREAPER_LOOK: Reed = {
  stage: 2,
  up: true,
  body: { y: [-0.86, -0.7, -0.3, 0.14, 0.52, 0.8, 0.96], z: [0.02, -0.04, -0.1, -0.09, -0.03, 0.0, 0.02], w: [0.52, 0.94, 1.04, 0.98, 0.98, 0.82, 0.44], h: [0.46, 0.8, 0.88, 0.8, 0.68, 0.52, 0.34] },
  cream: [0.26, 0.46, 0.5, 0.48, 0.44, 0.54, 0.82],
  pitch: 82,
  hind: [0.36, 0.33, 0.075], hindW: 0.26, foot: 0.58, hip: [0.46, -0.58, -0.06],
  fore: [0.54, 0.5, 0.07], foreW: 0.25, paw: 0.17, shoulder: [0.74, 0.66, -0.18],
  stance: [0.52, 0.32], ahead: [0, 0.08],
  crouch: 0.88,
  neck: { at: [0, 0.9, -0.03], len: 0.2, w: 0.3, lean: 10 },
  head: { r: [0.41, 0.38, 0.34], muzzle: [0.23, 0.15, 0.2], pitch: 10 },
  eye: { dir: [0.5, 0.72, 0.4], size: 0.066 },
  ear: { dir: [0.74, -0.38, 0.56], r: 0.055 },
  tail: { at: [0, -0.72, 0.26], links: [0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.14, 0.13, 0.12], w: [0.22, 0.205, 0.19, 0.17, 0.15, 0.13, 0.11, 0.09, 0.07], lift: -28, curl: 9, tip: 18 },
  mantle: { from: 0.96, to: -0.05, low: -0.2, top: 0.5, leaf: [0.42, 0.06], gap: 0.12, lift: 0.02 },
  load: 2,
  gait: { duty: [0.64, 0.42], swing: [0.22, 0.36], step: 0.18, bob: [0.032, 0.06], roll: 10, lean: 14 },
  size: 4.92,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a mantle of leaves is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const ARMS = ['al', 'ar'];

/** Rings drawn through a body's own by a smooth curve, `k` to each of its: what its fur is laid on, so it is round and not a stack of drums. */
const smoothed = new Map<Rings, Rings>();
function smoothOf(R0: Rings, k = 3): Rings {
  const had = smoothed.get(R0);
  if (had) return had;
  const n = R0.y.length, out: Rings = { y: [], z: [], w: [], h: [] };
  const cr = (a: number, b: number, c: number, d: number, t: number): number => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < k; j++) {
    for (const key of ['y', 'z', 'w', 'h'] as const) {
      const v = R0[key];
      out[key].push(cr(v[Math.max(0, i - 1)], v[i], v[i + 1], v[Math.min(n - 1, i + 2)], j / k));
    }
  }
  for (const key of ['y', 'z', 'w', 'h'] as const) out[key].push(R0[key][n - 1]);
  smoothed.set(R0, out);
  return out;
}

/** Where a point on a body of rings is, `y` along it and `th` round it from its right side (a quarter turn up is its back), and the way out of it there. */
function onRings(R0: Rings, y: number, th: number): { p: V3; n: V3 } {
  const R = smoothOf(R0);
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
/** The body's width, depth and the height of its middle line at `y`. */
function ringAt(R0: Rings, y: number): { w: number; h: number; z: number } {
  const R = smoothOf(R0);
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}
/** A frame standing along `up` with its front along `fwd`: across, forward and up. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** A frame scaled by `k` about its own origin: a thing grown back. */
const grown = (x: Xf, k: number): Xf => ({ m: x.m.map((v) => v * k), t: x.t });

/** A flat painted shape through `pts`, wound so it faces along `n`. */
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

/** Whether the facet of a tube between corners `j` and `j + 1` of `n` round is within `spread` of straight under it (`tube` puts nought on the left and a quarter turn on top). */
const creamFace = (n: number, j: number, spread: number): boolean => Math.abs(((j + 1) / n) * TAU - Math.PI * 1.5) < spread;

/**
 * A leaf: a narrow blade from `root` along `dir`, `len` long and `w` across at its widest, a little past a third of the way
 * out, pointed at its tip, folded down its middle so its two halves take the light differently; its face turned along `n`.
 * Two-sided -- a top and an underside a hair under it -- so a leaf standing off the body is not lost seen from under it.
 */
function leaf(root: V3, dir: V3, n: V3, len: number, w: number, m: Mat, droop = 0.15, tipMat: Mat = m): Mesh {
  const d = unit(sub(dir, scale(n, dot(dir, n)))), side = unit(cross(n, d));
  const mid = add(add(root, scale(d, len * 0.4)), scale(n, len * 0.04));
  const tip = add(add(root, scale(d, len)), scale(n, -len * droop));
  const L = add(add(root, scale(d, len * 0.34)), scale(side, -w)), R = add(add(root, scale(d, len * 0.34)), scale(side, w));
  const th = Math.max(0.004, len * 0.03), lo = (p: V3): V3 => add(p, scale(n, -th));
  const v: V3[] = [root, L, mid, R, tip, lo(root), lo(L), lo(mid), lo(R), lo(tip)];
  // Its outer part toward the tip in `tipMat`, a lighter green on a mantle's leaves, so each leaf of a row reads over the next.
  const f: Face[] = [
    { i: [0, 2, 1], m }, { i: [1, 2, 4], m: tipMat }, { i: [0, 3, 2], m }, { i: [3, 4, 2], m: tipMat },
    { i: [5, 6, 7], m }, { i: [6, 9, 7], m }, { i: [5, 7, 8], m }, { i: [8, 7, 9], m },
  ];
  // The top two halves wound to face along `n`, the underside against it.
  const want = (q: number): V3 => (q < 4 ? n : scale(n, -1));
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    const W = want(q);
    if (nx * W[0] + ny * W[1] + nz * W[2] < 0) idx.reverse();
  });
  return mesh(v, f);
}

/** The green of a leaf by its number: mostly the middle green, some darker, some the yellower light of a young reed. */
function leafMat(i: number): Mat {
  const k = jitter(i * 3.7 + 2);
  return k < 0.46 ? 'leaf' : k < 0.78 ? 'leafDark' : 'feather';
}
/**
 * A long reed leaf arching out of a bundle or a clump: from `root` up and out along `out` and its tip drooping, `len` long and
 * `w` across at its widest, flat, two-sided, its outer half in `tip`.
 */
function archBlade(root: V3, out: V3, len: number, w: number, m: Mat, tip: Mat = m): Mesh {
  const o = unit([out[0], out[1], 0]), up: V3 = [0, 0, 1], across = unit(cross(up, o));
  const pts: V3[] = [root, add(root, add(scale(up, len * 0.5), scale(o, len * 0.12))), add(root, add(scale(up, len * 0.74), scale(o, len * 0.4))), add(root, add(scale(up, len * 0.62), scale(o, len * 0.74)))];
  const ws = [w * 0.45, w, w * 0.7, 0.002];
  const v: V3[] = [];
  for (let q = 0; q < 4; q++) for (const sd of [-1, 1]) v.push(add(pts[q], scale(across, sd * ws[q])));
  const f: Face[] = [];
  for (let q = 0; q < 3; q++) {
    const a = 2 * q, b = 2 * q + 2, mm = q < 1 ? m : tip;
    f.push({ i: [a, a + 1, b + 1, b], m: mm }, { i: [a, b, b + 1, a + 1], m: mm });
  }
  return mesh(v, f);
}

/** The lighter olive a leaf's tip goes to. */
const tipOf = (m: Mat): Mat => (m === 'leafDark' ? 'leaf' : m === 'leaf' ? 'bloom' : 'petal');

/**
 * A pampas plume: a thin green stalk from `root` up `dir`, `len` long, and a soft head on its upper two thirds, full low down
 * and tapering to a narrow tip that droops over toward `bend`, with a few slim fronds standing off it, in warm cream.
 */
function plume(root: V3, dir: V3, bend: V3, len: number, w: number, seed: number): Mesh {
  const d = unit(dir), b = unit(sub(bend, scale(d, dot(bend, d))));
  const stalkTop = add(root, scale(d, len * 0.3));
  const tip = add(add(root, scale(d, len)), scale(b, len * 0.2));
  const pts = curve(stalkTop, add(add(root, scale(d, len * 0.66)), scale(b, len * 0.06)), tip, 9);
  const prof = [0.5, 0.82, 0.96, 1.0, 0.94, 0.82, 0.64, 0.44, 0.24, 0.05].map((k, q) => k * w * (0.96 + 0.08 * jitter(seed + q)));
  const head = tube(pts, prof, prof.map((k) => k * 0.85), 7, (ring) => (ring === 0 ? 'hornDark' : 'horn'));
  const stalk = tube([root, stalkTop], w * 0.14, w * 0.14, 4, 'stem');
  const side = unit(cross(d, b)), fronds: Mesh[] = [];
  for (let q = 0; q < 5; q++) {
    const u = 0.2 + 0.14 * q, at = pts[Math.round(u * 9)], sd = q % 2 ? 1 : -1;
    const out = unit(add(add(scale(side, sd), scale(b, 0.3 * (jitter(seed + q) - 0.5))), scale(d, 1.1)));
    fronds.push(leaf(at, out, unit(cross(out, side)), len * (0.24 - 0.03 * q), w * 0.5, 'horn', 0.14));
  }
  return merge(stalk, head, ...fronds);
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of it: the Reedpup's bite, the Reedweaver's swat of its bundle, the Marshreaper's sweep of its scythe. */
export const REED_HITS: readonly number[] = [0.48, 0.5, 0.54];
/**
 * A go at its task, as shares of it. The Reedpup's teeth close on a reed at `bite`, it tugs at it twice at `tugs`, bites
 * through it at `release` and the bitten-off top lands at `drops`; the Reedweaver takes a reed in its paw at `grab`, snaps its top off at `snap`, tosses the cut top down
 * beside it at `toss` and it lands at `lands`; the Marshreaper's blade goes through the reeds at `sweep` and it gathers them in at `gather`.
 */
export const REED_WORK = {
  bite: 0.3, tugs: [0.42, 0.52] as const, release: 0.6, drops: 0.72,
  grab: 0.3, snap: 0.5, toss: 0.62, lands: 0.8,
  sweep: 0.42, gather: 0.74,
} as const;

/* ---- where its feet go ---------------------------------------------------------------- */

/** A pose: where each ankle is along the ground, how its foot is pitched, and how the rest of it is carried. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** How far the upper body is twisted round on the hips (left positive), and how far the back is arched up. */
  twist: number; arch: number;
  /** How far its long back is bent to its left (its middle out to the left, its head and tail round to the right), as it lopes. */
  bend: number;
  /** The neck leaned further forward and turned left; the head pitched nose-up, turned left and tilted. */
  neck: [number, number]; head: [number, number, number];
  /** The tail lifted, swung to the left, and curled up past how it is carried. */
  tail: [number, number, number];
  jaw: number;
  /** How it holds what it holds (`Hold`), and that moved a little (in the chest's level frame) and turned: pitch, roll, yaw. */
  hold: Hold; item: V3; spin: V3;
  /** How far each paw has gone from its grip to `reach` (in the ground's frame). */
  away: [number, number]; reach: [V3, V3];
}

interface Rest {
  /** Each ankle standing, along the ground (fl, fr, hl, hr on all fours; hl, hr stood up). */
  ankle: V3[];
  /** How far each leg reaches, hip to ankle. */
  reach: number[];
  /** The body's middle over the ground, standing. */
  H: number;
  /** Where the reeds it works stand (the middle of their roots), how tall, and the height up them its mouth, paw or blade comes to. */
  site: V3; tall: number; at: number;
}

const rests = new Map<Reed, Rest>();
/** The legs: on all fours, fore then hind; stood up, the hind only. */
const legIdx = (s: Reed): number[] => (s.up ? [2, 3] : [0, 1, 2, 3]);
const legOfIdx = (s: Reed, i: number): [number, number, number] => (i < 2 ? s.fore : s.hind);

function restOf(s: Reed): Rest {
  const had = rests.get(s);
  if (had) return had;
  // Stood at `crouch` of its hind legs' reach, the body's middle as high as that puts its hips.
  const hipZ = rotX(s.hip, s.pitch)[2], L = s.hind;
  const H = (L[0] + L[1]) * s.crouch + L[2] - hipZ;
  const ankle: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, at = rotX(fore ? s.shoulder : s.hip, s.pitch), Lg = legOfIdx(s, i);
    ankle.push([SIDE[i] * s.stance[fore ? 0 : 1], at[1] + s.ahead[fore ? 0 : 1], Lg[2]]);
    reach.push(Lg[0] + Lg[1]);
  }
  const R: Rest = { ankle: s.up ? ankle.slice(2) : ankle, reach: s.up ? reach.slice(2) : reach, H, site: [0, 0, 0], tall: 1, at: 0.5 };
  rests.set(s, R);
  return R;
}

/** `v` pitched about x by `deg` degrees, as a joint's pitch turns it. */
function rotX(v: V3, deg: number): V3 {
  const a = deg * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [v[0], c * v[1] - sn * v[2], sn * v[1] + c * v[2]];
}

function restPlan(s: Reed, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: R.ankle.map(() => 0),
    H: R.H, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0, twist: 0, arch: 0, bend: 0,
    neck: [0, 0], head: [0, 0, 0], tail: [0, 0, 0], jaw: 0,
    hold: restHold(s), item: [0, 0, 0], spin: [0, 0, 0], away: [0, 0], reach: [[0, 0, 0], [0, 0, 0]],
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw),
    squash: m(a.squash, b.squash), twist: m(a.twist, b.twist), arch: m(a.arch, b.arch), bend: m(a.bend, b.bend),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1]), m(a.tail[2], b.tail[2])], jaw: m(a.jaw, b.jaw),
    hold: mixHold(a.hold, b.hold, k), item: mixV(a.item, b.item, k), spin: mixV(a.spin, b.spin, k), away: [m(a.away[0], b.away[0]), m(a.away[1], b.away[1])],
    reach: [mixV(a.reach[0], b.reach[0], k), mixV(a.reach[1], b.reach[1], k)],
  };
}

/** `p` moved by as much as `to` is from `from`, every number of it: an act laid over how it stands this moment. */
function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  const dv = (x: V3, a: V3, b: V3): V3 => [d(x[0], a[0], b[0]), d(x[1], a[1], b[1]), d(x[2], a[2], b[2])];
  return {
    at: p.at.map((x, i) => dv(x, to.at[i], from.at[i])), foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    twist: d(p.twist, to.twist, from.twist), arch: d(p.arch, to.arch, from.arch), bend: d(p.bend, to.bend, from.bend),
    neck: [d(p.neck[0], to.neck[0], from.neck[0]), d(p.neck[1], to.neck[1], from.neck[1])],
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    tail: [d(p.tail[0], to.tail[0], from.tail[0]), d(p.tail[1], to.tail[1], from.tail[1]), d(p.tail[2], to.tail[2], from.tail[2])],
    jaw: d(p.jaw, to.jaw, from.jaw),
    hold: p.hold, item: dv(p.item, to.item, from.item), spin: dv(p.spin, to.spin, from.spin),
    away: p.away, reach: p.reach,
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
/** A path through the air from `a` to `b`, `u` of the way, rising `up` over the straight line at its middle. */
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}

/** Where each foot is in its stride: on all fours a half bound, the fore feet together and the hind feet together, a little apart in each pair; stood up, one and then the other. */
const BEATS4: [number[], number[]] = [[0, 0.1, 0.5, 0.6], [0, 0.06, 0.52, 0.58]];
const BEATS2 = [0, 0.5];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/** Each foot in its stride: down and swept back under it at the ground's own speed, or brought forward through the air. */
function feetGoing(s: Reed, R: Rest, a: Anim, p: Plan): void {
  const G = s.gait, g = a.gait;
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const beats = s.up ? BEATS2 : [0, 1, 2, 3].map((i) => lerp(BEATS4[0][i], BEATS4[1][i], g));
  for (let k = 0; k < R.ankle.length; k++) {
    const L = R.reach[k], half = L * amp, A = R.ankle[k], ph = frac(a.u + beats[k]);
    if (ph < duty) {
      p.at[k] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      // A big flat foot rolled up onto its toes as it leaves the ground.
      p.foot[k] = s.up ? 22 * ramp(ph, duty * 0.7, duty) : 0;
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.5 * g);
    // At a run a foot is off the ground and coming forward at once, so the bound has its moment in the air.
    const E = lerp(EDGE, 0.03, g);
    const y0 = A[1] - half - v * E, y1 = A[1] + half + v * E;
    const y = u < E ? A[1] - half - v * u : u > 1 - E ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * E) * (1 - 0.9 * g), -v * (1 - 2 * E) * (1 - 0.9 * g), (u - E) / (1 - 2 * E));
    p.at[k] = [A[0], y, A[2] + lift * Math.sin(Math.PI * u) ** 0.8];
    const fore = !s.up && k < 2;
    p.foot[k] = s.up ? 22 * (1 - smooth(u / 0.35)) - 10 * hump(u, 0.75, 0.25) : (fore ? -30 : 40) * Math.sin(Math.PI * u) ** 2;
  }
}

/**
 * Going. On all fours a lope: the fore feet down together and then the hind, the back arching as the hind feet come up under it
 * and stretching out flat as they push off, the body rocking nose-down onto its fore feet and up off them; at a run a bound,
 * all four off the ground between the push of the hind feet and the landing of the fore. Stood up, a waddle: the body rolled
 * over each foot as it takes the weight and turned a little with it, sinking at each footfall, the tail swaying behind a beat
 * late; at a run leaning into it, a longer reach, a deeper bob, and the tail lifted off the ground.
 */
function goingPlan(s: Reed, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  feetGoing(s, R, a, p);
  const tall = s.up ? R.H + s.body.y[6] : R.H;
  if (!s.up) {
    // The back arched as the hind feet gather under it, flat as they push off; the body rocking over the fore feet and the hind.
    p.arch = archOf(s, a);
    // Bent to one side and then the other with each stride, its head and tail swung round together the other way.
    p.bend = smooth(Math.min(1, a.go)) * lerp(0.13, 0.1, g) * Math.sin(TAU * (w - 0.1));
    p.neck[1] = -120 * p.bend;
    const rock = Math.sin(TAU * (w + 0.2));
    p.pitch = -(2 + 3 * g) * rock;
    // Lowest as each pair comes down; at a run thrown up off the hind feet and caught on the fore.
    const dips = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.04));
    const bound = Math.max(0, Math.sin(TAU * (w - 0.7)));
    p.H += tall * (-G.bob[0] * (1 - g) * dips + g * (G.bob[1] * bound - 0.09));
    p.squash = 0.05 * hump(w, 0.04, 0.08) * (0.5 + g);
    p.neck[0] = 6 * g - 4 * rock;
    p.head = [8 * rock * (0.6 + 0.4 * g) - 6 * g, 0, 0];
    p.tail = [-6 * g + 10 * rock, 9 * Math.sin(TAU * (w - 0.2)), 4 * Math.sin(TAU * (w - 0.3))];
    p.roll = G.roll * Math.sin(TAU * w);
    return p;
  }
  // The waddle: rolled over the foot that has the weight, the hips carried a little over it and turned with it.
  const sway = Math.sin(TAU * (w - 0.05));
  p.roll = (G.roll * (1 - 0.35 * g)) * sway;
  p.side = 0.05 * tall * (1 - 0.5 * g) * sway;
  p.yaw = (7 - 2 * g) * Math.sin(TAU * (w + 0.2));
  p.twist = -p.yaw * 0.6;
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.06));
  p.H += tall * (-lerp(G.bob[0], G.bob[1], g) * down - 0.014 - g * 0.011);
  p.squash = 0.04 * down * (0.4 + g);
  // Kept down by as much as the roll lifts the hip on the side going up, so the leg under it still reaches the ground.
  p.H -= Math.abs(Math.sin(p.roll * DEG)) * s.hip[0] * 0.6;
  p.pitch = -G.lean * g - 2 * g * Math.cos(2 * TAU * w);
  p.neck[0] = -2 + 4 * g;
  p.head = [5 * (2 * down - 1) * (0.5 + 0.5 * g) + G.lean * g * 0.7, -p.yaw * 0.5, -p.roll * 0.4];
  p.tail = [6 + 18 * g, -(26 + 4 * g) * Math.sin(TAU * (w - 0.18)), 4 * g];
  // What it holds bobbing a little with the steps, lagging the body.
  p.item = [0, 0, -0.03 * tall * (2 * (0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.16))) - 1) * (0.5 + g)];
  p.spin = [3 * g * Math.sin(2 * TAU * (w - 0.2)), 0, 0];
  return p;
}

/** How far its back is arched up as it lopes, this moment: most as its hind feet come up under it, none standing or stood up. */
function archOf(s: Reed, a: Anim): number {
  if (s.up || a.act || a.go <= 0) return 0;
  const w = frac(a.u), g = a.gait;
  // Gathered, arched; at a run stretched out past flat as it flies.
  return smooth(Math.min(1, a.go)) * lerp(0.12, 0.22, g) * (lerp(0.5, 0.3, g) + lerp(0.5, 0.7, g) * Math.cos(TAU * (w - 0.42)));
}

/**
 * Standing about: breathing, looking about, its tail sweeping; the Reedpup now and then sitting up tall on its haunches to look
 * over the reeds, an otter's periscope, its fore paws tucked at its chest; the two stood up rocking from foot to foot, hugging
 * their bundle closer or settling the scythe across them, and sniffing the air.
 */
function stillPlan(s: Reed, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [-1 + 2 * a.breath, 10 * look];
  p.head = [2 * cyc(t, 5), 12 * look, 4 * drift(t, 2)];
  p.tail = [2 * cyc(t, 3, 1), 10 * cyc(t, 4), 3 * cyc(t, 6)];
  p.H += 0.01 * R.H * (a.breath - 0.5);
  if (!s.up) {
    const up = beat(t, [7.2, 18.4], 2.4);
    if (up > 0) {
      // Sat up on its haunches: the body pitched up about its hips, its fore paws lifted off the ground and tucked under its chin.
      p.pitch += 46 * up;
      p.H += 0.05 * up;
      p.surge -= 0.12 * up;
      p.neck[0] -= 30 * up;
      p.head[0] -= 8 * up;
      p.tail[0] -= 8 * up;
      for (const i of [0, 1]) {
        const A = R.ankle[i];
        p.at[i] = mixV(A, [A[0] * 0.75, -0.02, 0.36], up);
        p.foot[i] = -60 * up;
      }
    }
    return p;
  }
  // The weight from one foot to the other, and a sniff of the air now and then.
  const sh = Math.tanh(2.5 * cyc(t, 3));
  p.roll = 2.2 * sh;
  p.side = 0.012 * sh;
  p.twist = 4 * look;
  const sniff = beat(t, [6.5, 17.2], 1.3);
  p.head[0] += 10 * sniff + 3 * sniff * Math.sin(t * 22);
  p.neck[0] -= 4 * sniff;
  // Hugged closer and let go again, or the scythe's blade tipped back and forth.
  const hug = beat(t, [11.5, 21.5], 1.8);
  p.item = [0, 0.02 * hug, 0.02 * a.breath];
  p.spin = [s.load === 2 ? 6 * hug : -8 * hug, 0, 0];
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Reedpup's bite: drawn back low with its head up, then thrown forward onto its fore feet with its jaws open, and snapped shut. */
function bite(s: Reed, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = REED_HITS[0];
  // Crouched low and drawn well back on its haunches, held a moment, then the whole of it thrown forward a head and a half's
  // length, feet and all, its neck stretched out and its jaws snapping shut at the end of it; and walked back to where it stood.
  const back = ramp(t, 0.04, 0.26) * (1 - ramp(t, 0.33, hit - 0.06));
  const out = ramp(t, 0.31, hit) * (1 - ramp(t, hit + 0.14, 0.92));
  const jolt = hump(t, hit + 0.02, 0.06), lunge = 2.8 * s.head.r[1];
  p.surge = -0.13 * back + lunge * out;
  p.H += -0.12 * back - 0.03 * out;
  p.pitch = 6 * back - 9 * out;
  p.arch = 0.12 * back - 0.04 * out;
  p.neck = [-22 * back + 30 * out, 0];
  p.head = [12 * back - 12 * out + 6 * jolt, 0, 0];
  p.jaw = 30 * ramp(t, 0.3, hit - 0.08) * (1 - ramp(t, hit - 0.04, hit)) + 4 * ramp(t, hit + 0.1, 0.8) * (1 - ramp(t, 0.8, 0.95));
  p.squash = 0.07 * jolt + 0.05 * back;
  // Every foot carried with the body, a step behind it -- the fore feet ahead of the hind going out, the hind ahead coming back
  // -- lifted while it moves and put down where the body has got to, so none is left behind.
  const outAt = (u: number): number => ramp(u, 0.31, hit) * (1 - ramp(u, hit + 0.14, 0.92));
  for (let i = 0; i < 4; i++) {
    const A = R.ankle[i], fore = i < 2, lag = t < hit + 0.1 ? (fore ? -0.02 : 0.012) : (fore ? 0.03 : -0.01);
    const k = outAt(t - lag - 0.005 * (i % 2)), d = lunge * (fore ? 1.02 : 0.98);
    p.at[i] = [A[0], A[1] + d * k, A[2] + R.reach[i] * 0.9 * k * (1 - k)];
    p.foot[i] = (fore ? -24 : 30) * k * (1 - k) * 4;
  }
  p.tail = [5 * back - 3 * out, 0, 6 * back];
  return p;
}

/** The Reedweaver's swat: its bundle drawn up over its left shoulder, twisting away, held, and swung down across in front of it, plumes first, and back. */
function swat(s: Reed, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = REED_HITS[1];
  const wind = ramp(t, 0.04, 0.27) * (1 - ramp(t, 0.31, hit));
  const through = ramp(t, 0.31, hit + 0.06) * (1 - ramp(t, hit + 0.18, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06);
  p.twist = 24 * wind - 12 * through;
  p.yaw = 8 * wind - 8 * through;
  p.pitch = 4 * wind - 12 * through;
  p.H -= 0.04 * through + 0.03 * wind;
  p.hold = holdSeq(s, t, [[0.26, BUNDLE_WOUND], [0.31, BUNDLE_WOUND], [hit, BUNDLE_HIT], [hit + 0.16, BUNDLE_FOLLOW]], 0.94);
  // The head kept on what it swats at while the body twists away from it and back.
  p.neck = [6 * through, -10 * wind + 5 * through];
  p.head = [-4 * wind - 4 * jolt, -9 * wind + 4 * through, 0];
  p.squash = 0.05 * jolt;
  p.tail = [6 * wind, -26 * wind + 30 * through, 0];
  // The right foot stepped forward into the swing and back.
  const A = R.ankle[1], fwd: V3 = [A[0] - 0.03, A[1] + 0.1, A[2]];
  const go = ramp(t, 0.3, hit - 0.04), come = ramp(t, 0.72, 0.94);
  p.at[1] = come > 0 ? arc(fwd, A, come, 0.06) : arc(A, fwd, go, 0.07);
  return p;
}

/** The Marshreaper's sweep: the scythe drawn back round to its right with the blade high, held, and swept round low in front of it to its left, and back. */
function sweep(s: Reed, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = REED_HITS[2];
  const k = sweepOf(t, hit);
  const wind = Math.max(0, -k), through = Math.max(0, k);
  const jolt = hump(t, hit + 0.02, 0.06);
  // Twisted into the swing, less far through than back, so the blade stays out in front of it as it follows through.
  p.twist = 22 * Math.min(0, k) + 16 * Math.max(0, k);
  p.yaw = 14 * k;
  p.pitch = -6 * through + 3 * wind;
  p.H -= 0.06 * (wind + through);
  p.hold = holdSeq(s, t, [[0.28, SCYTHE_WOUND], [0.36, SCYTHE_WOUND], [hit, SCYTHE_HIT], [hit + 0.12, SCYTHE_FOLLOW]], 0.96);
  p.neck = [4 * through, -10 * k];
  p.head = [-3 * wind, -14 * k, 0];
  p.squash = 0.04 * jolt;
  p.tail = [6 * wind, 30 * wind - 30 * through, 0];
  const A = R.ankle[0], fwd: V3 = [A[0] - 0.04, A[1] + 0.13, A[2]];
  const go = ramp(t, 0.3, hit - 0.06), come = ramp(t, 0.72, 0.94);
  p.at[0] = come > 0 ? arc(fwd, A, come, 0.08) : arc(A, fwd, go, 0.1);
  return p;
}

/** How far round the scythe is through its sweep, from drawn back (minus one) to followed through (one): back, held, swept fastest as it lands, and home. */
function sweepOf(t: number, hit: number): number {
  if (t < 0.28) return -smooth(t / 0.28);
  if (t < 0.36) return -1;
  if (t < hit + 0.08) return lerp(-1, 1, smooth((t - 0.36) / (hit + 0.08 - 0.36)) ** 1.15);
  return 1 - ramp(t, hit + 0.16, 0.97);
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/**
 * A go at its task. The Reedpup, at a reed in front of it, dips and takes it in its teeth, hauls back on it twice, braced on its
 * haunches, its head shaking, bites it through and watches the top fall. The Reedweaver, the bundle hugged in its right arm, reaches out with its left
 * paw to a reed, takes it, pulls it down until its top snaps off, and tosses the cut top down beside it. The Marshreaper draws the
 * scythe back, sweeps it through the reeds, and reaches out with its left paw and gathers them in.
 */
function workPlan(s: Reed, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), W = REED_WORK;
  if (s.stage === 0) {
    const at = ramp(t, 0.04, W.bite) * (1 - ramp(t, W.release, 1));
    const tug = Math.max(hump(t, W.tugs[0], 0.08), hump(t, W.tugs[1], 0.08)), hold = ramp(t, W.bite + 0.04, W.tugs[0]) * (1 - ramp(t, W.tugs[1] + 0.02, W.release + 0.1));
    // Dipped to the reed, then hauling back on it, and looking after the top as it falls.
    const watch = hump(t, W.drops, 0.12);
    p.surge = 0.09 * at - 0.12 * hold - 0.05 * tug;
    p.pitch = -9 * at + 8 * hold;
    p.H -= 0.05 * at;
    p.arch = 0.06 * hold;
    p.neck = [30 * at - 14 * hold - 8 * tug + 10 * watch, 0];
    p.head = [-22 * at + 10 * hold + 6 * tug - 8 * watch, -14 * watch, 9 * tug * Math.sin(t * 60)];
    p.jaw = 22 * ramp(t, 0.12, W.bite - 0.06) * (1 - ramp(t, W.bite - 0.03, W.bite)) + 18 * hump(t, W.release, 0.06);
    p.tail = [6 * hold, 10 * Math.sin(t * TAU * 2) * hold, 0];
    // The hind feet braced a little further back.
    for (const i of [2, 3]) { const A = R.ankle[i]; p.at[i] = [A[0], A[1] - 0.02 * hold, A[2]]; }
  } else if (s.stage === 1) {
    const reach = ramp(t, 0.06, W.grab - 0.06) * (1 - 0.5 * ramp(t, W.snap + 0.04, W.toss) - 0.5 * ramp(t, W.toss + 0.04, 0.9));
    const pull = ramp(t, W.grab + 0.02, W.snap) * (1 - ramp(t, W.snap + 0.04, W.snap + 0.2));
    const tuck = hump(t, W.toss, 0.08);
    p.away = [ramp(t, 0.14, W.grab) * (1 - ramp(t, W.toss + 0.02, 0.88)), 0];
    p.pitch = -16 * reach + 6 * pull;
    p.surge = 0.2 * reach;
    p.twist = 4 * reach;
    // The bundle, now in its right arm alone, held down and out to its left, clear of its face while it works.
    p.item = [-0.02 * reach, 0, -0.06 * reach - 0.03 * tuck];
    p.spin = [0, 0, 0];
    p.neck = [10 * reach, 4 * reach];
    p.head = [-10 * reach + 4 * pull + 8 * hump(t, W.lands, 0.1), 6 * reach + 10 * hump(t, W.lands, 0.12), 0];
    p.tail = [0, 8 * Math.sin(t * TAU), 0];
  } else {
    const k = workSweepOf(t), wind = Math.max(0, -k), through = Math.max(0, k);
    const gather = ramp(t, W.sweep + 0.12, W.gather) * (1 - ramp(t, W.gather + 0.04, 0.94));
    p.twist = 34 * k - 10 * gather;
    p.yaw = 10 * k;
    p.pitch = -8 * through - 14 * gather;
    p.H -= 0.05 * (wind + through) * 0.5 + 0.06 * gather;
    p.hold = holdSeq(s, t, [[0.26, SCYTHE_DRAWN], [W.sweep, SCYTHE_CUT], [W.sweep + 0.1, SCYTHE_THROUGH], [W.gather, SCYTHE_THROUGH]], 0.96);
    p.away = [gather, 0];
    p.neck = [6 * through + 10 * gather, -10 * k];
    p.head = [-2 * wind - 8 * gather, -14 * k + 10 * gather, 0];
    p.tail = [0, 20 * wind - 20 * through, 0];
  }
  return mixPlan(restPlan(s, R), p, down);
}

/** How far round the scythe is through a go at the reeds: drawn back, swept through them, held followed through while it gathers, and home. */
function workSweepOf(t: number): number {
  const W = REED_WORK;
  if (t < 0.26) return -smooth((t - 0.04) / 0.22);
  if (t < W.sweep + 0.06) return lerp(-1, 1, smooth((t - 0.26) / (W.sweep + 0.06 - 0.26)));
  return 1 - ramp(t, W.gather, 0.96);
}

/** Evolving: hunched as the light gathers, drawn up tall at the turn with its head high, a shake, and settled. */
function evolvePlan(s: Reed, R: Rest, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * (s.stage === 2 ? 44 : 62));
  p.H += R.H * (-0.06 * hunch + (s.up ? 0.008 : 0.012) * up);
  p.pitch = -5 * hunch + (s.up ? 4 : 2) * up;
  p.arch = s.up ? 0 : 0.05 * hunch;
  p.neck = [14 * hunch - 12 * up, 0];
  p.head = [-10 * hunch + 16 * up, 0, 10 * shake];
  p.roll = (s.up ? 3 : 1.5) * shake;
  p.twist = 6 * shake;
  p.tail = [-6 * hunch + 18 * up, 12 * shake, 6 * up];
  p.squash = 0.06 * hump(t, 0.7, 0.05);
  p.item = [0, 0, 0.04 * up];
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Reed, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([bite, swat, sweep][s.stage](s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0.4, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/** The twist of its upper body and the arch of its back this moment, which bend what is on its trunk (`flexPt`). */
function flexOf(s: Reed, R: Rest, a: Anim): Flex {
  // Worked out once a frame: every piece on the trunk asks for it with the same moment.
  const key = [a.t, a.u, a.go, a.gait, a.graze, a.breath, a.act?.kind ?? '', a.act?.t ?? -1].join(), had = flexes.get(s);
  if (had && had.key === key) return had.f;
  const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go }), f = { twist: P.twist, arch: P.arch, bend: P.bend };
  flexes.set(s, { key, f });
  return f;
}
const flexes = new Map<Reed, { key: string; f: Flex }>();
/** The twist of its upper body, the arch of its back and the bend of it to the side. */
interface Flex { twist: number; arch: number; bend: number }

/* ---- its bones ---------------------------------------------------------------------------------- */

/** How much of the twist a point at `y` along the spine has: none at the hips, all of it at the shoulders. */
const twistShare = (s: Reed, y: number): number => smooth((y - s.hip[1]) / (s.shoulder[1] - s.hip[1]));
/**
 * A point in the trunk's frame where the twist of its upper body and the arch of its back put it: turned about the spine by
 * as much of the twist as it is up it, and lifted by the arch, most at its middle.
 */
function flexPt(s: Reed, p: V3, twist: number, arch: number, bend = 0): V3 {
  let q = p;
  if (twist) {
    const a = twist * twistShare(s, p[1]) * DEG, c = Math.cos(a), sn = Math.sin(a);
    q = [c * q[0] + sn * q[2], q[1], -sn * q[0] + c * q[2]];
  }
  if (arch) {
    const end = s.body.y[s.body.y.length - 1], f = clamp(q[1] / end, -1, 1);
    q = [q[0], q[1] * (1 - arch * 0.3), q[2] + arch * (1 - f * f) - arch * 0.45];
  }
  if (bend) {
    const end = s.body.y[s.body.y.length - 1], f = clamp(q[1] / end, -1, 1);
    q = [q[0] + bend * (1 - f * f) - bend * 0.45, q[1], q[2]];
  }
  return q;
}

/**
 * A leg bent to put its ankle at `ankle`: the upper from the hip to the knee and the lower down from it, the knee out toward
 * `hint` (forward for a hind leg, back for a fore leg), so it never flips; a point out of reach is reached for as far as the
 * leg goes. The bones' own `-z` runs down each part.
 */
function limb(hip: V3, ankle: V3, l0: number, l1: number, hint: V3, fwd: V3): [Xf, Xf, V3] {
  let d = sub(ankle, hip);
  const D = len3(d), most = (l0 + l1) * 0.985, least = Math.abs(l0 - l1) + 0.08 * (l0 + l1);
  const Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  let v = sub(hint, scale(d, dot(hint, d)));
  v = unit(v);
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), at];
}

/** The middle of the skull, the muzzle, the tip of the nose and the mouth, in the head's frame. */
const muzzleAt = (s: Reed): V3 => { const H = s.head; return [0, H.r[1] * 0.74, -H.r[2] * 0.24]; };
const noseTip = (s: Reed): V3 => { const c = muzzleAt(s); return [0, c[1] + s.head.muzzle[2] * 0.95, c[2] + s.head.muzzle[1] * 0.45]; };
const mouthAt = (s: Reed): V3 => { const c = muzzleAt(s); return [0, c[1] + s.head.muzzle[2] * 0.7, c[2] - s.head.muzzle[1] * 0.75]; };

/** Where the chest's level frame is on the trunk, which what it holds is carried in: the middle of the spine at its shoulders. */
const chestAt = (s: Reed): V3 => [0, s.shoulder[1] - 0.04 * (1 + s.stage), 0];

/**
 * How it holds what it holds, in the chest's level frame (across, forward, up): where the middle of its grip is, the way the
 * thing's length runs -- the bundle's reeds, the scythe's staff toward its blade -- and the way its face looks: the front of
 * the bundle, the side the scythe's blade curves to.
 */
interface Hold { at: V3; q: Quat }
type Quat = [number, number, number, number];
/** A turn as a quaternion, from a frame's three axes. */
function quatOf(X: V3, Y: V3, Z: V3): Quat {
  const m00 = X[0], m11 = Y[1], m22 = Z[2], tr = m00 + m11 + m22;
  if (tr > 0) { const k = Math.sqrt(tr + 1) * 2; return [(Y[2] - Z[1]) / k, (Z[0] - X[2]) / k, (X[1] - Y[0]) / k, 0.25 * k]; }
  if (m00 > m11 && m00 > m22) { const k = Math.sqrt(1 + m00 - m11 - m22) * 2; return [0.25 * k, (Y[0] + X[1]) / k, (Z[0] + X[2]) / k, (Y[2] - Z[1]) / k]; }
  if (m11 > m22) { const k = Math.sqrt(1 + m11 - m00 - m22) * 2; return [(Y[0] + X[1]) / k, 0.25 * k, (Z[1] + Y[2]) / k, (Z[0] - X[2]) / k]; }
  const k = Math.sqrt(1 + m22 - m00 - m11) * 2; return [(Z[0] + X[2]) / k, (Z[1] + Y[2]) / k, 0.25 * k, (X[1] - Y[0]) / k];
}
/** A quaternion's turn as a frame's matrix, rows in the order `Xf` keeps them. */
function matOf(q: Quat): number[] {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}
/** The way round from one turn to another, `k` of it, along the shortest arc. */
function slerp(a: Quat, b: Quat, k: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb: Quat = d < 0 ? [-b[0], -b[1], -b[2], -b[3]] : b;
  d = Math.abs(d);
  if (d > 0.9995) { const r = a.map((v, i) => lerp(v, bb[i], k)), l = Math.hypot(...r); return r.map((v) => v / l) as Quat; }
  const th = Math.acos(d), sn = Math.sin(th), wa = Math.sin((1 - k) * th) / sn, wb = Math.sin(k * th) / sn;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
}
/** The bundle held: its reeds up its `z`, its front along `y`. */
function bundleHold(at: V3, along: V3, face: V3): Hold { const [X, Y, Z] = frameOf(along, face); return { at, q: quatOf(X, Y, Z) }; }
/** The scythe held: its staff along `y` toward the blade, its blade's side up `z`. */
function scytheHold(at: V3, along: V3, face: V3): Hold { const [X, Y, Z] = frameOf(sub(face, scale(along, dot(face, along))), along); return { at, q: quatOf(X, Y, Z) }; }
/** Which way the bundle's reeds run, hugged: up, leaning a little forward and some 25 degrees out to its left, away from its head. */
const BUNDLE_ALONG = unit([-0.5, 0.22, 1]);
/** The bundle hugged up against the left of the chest, its reeds leaning forward and a little out, its plumes high. */
const BUNDLE_REST = bundleHold([-0.13, 0.32, -0.12], BUNDLE_ALONG, [0, 1, 0]);
/** Drawn up over its left shoulder for a swat, its head back. */
const BUNDLE_WOUND = bundleHold([-0.16, 0.26, 0.06], unit([-0.7, -0.35, 0.65]), unit([-0.3, 0.8, 0.3]));
/** Swung down across in front of it, its head forward and to the right. */
const BUNDLE_HIT = bundleHold([0.0, 0.32, 0.02], unit([0.45, 0.85, 0.15]), unit([0, 0.2, 1]));
const BUNDLE_FOLLOW = bundleHold([0.04, 0.3, -0.04], unit([0.8, 0.45, -0.15]), unit([-0.2, 0.3, 1]));
/** The scythe across the body, its staff rising forward and out to the left, the blade up clear of its left shoulder. */
const SCYTHE_REST = scytheHold([-0.2, 0.58, -0.28], unit([-0.9, 0.55, 0.72]), unit([0.15, -0.3, 1]));
/** Drawn back round to its right for a sweep, the staff pointing back past its right side and the blade high. */
const SCYTHE_WOUND = scytheHold([0.12, 0.42, 0.02], unit([0.85, -0.35, 0.4]), unit([0.1, 0.3, 1]));
/** Swept round in front of it low, the staff out ahead and the blade laid over flat, leading to the left. */
const SCYTHE_HIT = scytheHold([0.02, 0.5, -0.3], unit([0.1, 1, -0.3]), unit([-1, 0.1, 0.3]));
const SCYTHE_FOLLOW = scytheHold([0.02, 0.5, -0.2], unit([-0.6, 0.78, 0.12]), unit([-0.3, -0.25, 0.9]));
/** At the reeds: drawn back a little, swept through them low, and held through while it gathers. */
const SCYTHE_DRAWN = scytheHold([0.1, 0.46, -0.05], unit([0.8, 0.2, 0.15]), unit([0, 0.4, 1]));
const SCYTHE_CUT = scytheHold([0.02, 0.52, -0.32], unit([0.15, 1, -0.32]), unit([-1, 0.15, 0.25]));
const SCYTHE_THROUGH = scytheHold([0.04, 0.44, -0.24], unit([-0.75, 0.6, -0.25]), unit([-0.35, -0.9, 0.3]));

const restHold = (s: Reed): Hold => (s.load === 1 ? BUNDLE_REST : SCYTHE_REST);
const mixHold = (a: Hold, b: Hold, k: number): Hold => (k <= 0 ? a : k >= 1 ? b : { at: mixV(a.at, b.at, k), q: slerp(a.q, b.q, k) });
/** A hold as a frame in the chest's: the bundle's reeds up its `z` and its front along `y`, the scythe's staff along `y` and its blade's side up `z`. */
function holdXf(s: Reed, H: Hold): Xf {
  void s;
  return { m: matOf(H.q), t: H.at };
}
/**
 * A hold through an act: from how it carries it to each of `keys` by its time, eased, and back home by `home`. Each move toward
 * a blow is eased in only, so it is fastest as it lands.
 */
function holdSeq(s: Reed, t: number, keys: Array<[number, Hold]>, home: number): Hold {
  const rest = restHold(s);
  let prevT = 0, prev = rest;
  for (const [at, key] of keys) {
    if (t < at) {
      const u = clamp((t - prevT) / Math.max(1e-6, at - prevT));
      return mixHold(prev, key, smooth(u));
    }
    prevT = at; prev = key;
  }
  return mixHold(prev, rest, smooth((t - prevT) / Math.max(1e-6, home - prevT)));
}

/** Where each paw grips what it holds, in the thing's own frame: the left low, the right high. */
function grips(s: Reed): [V3, V3] {
  if (s.load === 1) return [scale([-0.055, 0.07, 0.08], BUNDLE_K), scale([0.065, 0.07, -0.04], BUNDLE_K)];
  return [[0, 0.04, 0], [0, -0.26, 0]];
}

/** The tail's bones from its root on the rump, each link on from the one before, curled up, swung, and kept up off the ground. */
function tailBones(s: Reed, root: Xf, lift: number, yaw: number, curl: number, lag: number): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  let prev = joint(root, [0, 0, 0], -(T.lift + lift), 0, yaw * 0.4);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    let pitch = -(T.curl + curl + (q >= n - 3 ? T.tip : 0));
    const sw = (yaw * 0.6) / (n - 1) + (q >= n - 3 ? lag / 3 : 0);
    let next = joint(prev, [0, -T.links[q - 1], 0], pitch, 0, sw);
    // Curled up off the ground where it would go into it.
    for (let tries = 0; tries < 10; tries++) {
      const end = place(next, [0, -T.links[q], 0]);
      if (end[2] > T.w[q] * 0.75 && next.t[2] > T.w[q] * 0.8) break;
      pitch -= 7;
      next = joint(prev, [0, -T.links[q - 1], 0], pitch, 0, sw);
    }
    prev = next;
    out.push(prev);
  }
  return out;
}

/**
 * The bones of a stage: the body raised and carried as its pose says, every leg bent to put its foot where the pose says, the
 * neck out of the top of the chest and the head carried on it level whatever the body does, the tail in links, and what it
 * holds posed in front of its chest with its paws carried to where they grip it; and the reeds it works, while it works.
 */
function reedBones(s: Reed): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, a: Anim): Bones => {
    // Stood up, it leans about its hips rather than its middle, so leaning does not carry its hips off its feet.
    const h0 = rotX([0, s.hip[1], s.hip[2]], s.pitch), h1 = rotX([0, s.hip[1], s.hip[2]], s.pitch + P.pitch), pivot: V3 = s.up ? sub(h0, h1) : [0, 0, 0];
    const body = joint(ROOT, [P.side, P.surge + pivot[1], P.H + pivot[2]], s.pitch + P.pitch, P.roll, P.yaw);
    const hdg = joint(ROOT, [P.side, P.surge, 0], 0, 0, P.yaw), fwd = turn(hdg, [0, 1, 0]);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const fx = (p: V3): V3 => place(b.trunk, flexPt(s, p, P.twist, P.arch, P.bend));
    // The neck up out of the chest, leaned forward, and the head on it carried level, turned with the upper body.
    const base = fx(s.neck.at), lean = (s.neck.lean + P.neck[0]) * DEG, nt = (P.neck[1] + P.twist * 0.8) * DEG;
    const ndir = unit(turn(hdg, [-Math.sin(nt) * Math.sin(lean), Math.cos(nt) * Math.sin(lean), Math.cos(lean)]));
    const [NX, NY, NZ] = frameOf(ndir, fwd);
    b.neck = xfOf(NX, NY, NZ, base);
    const tip = add(base, scale(ndir, s.neck.len));
    b.head = joint({ m: hdg.m, t: tip }, [0, 0, 0], s.head.pitch + P.head[0] - (s.up ? 0 : P.pitch * 0.4), P.head[2], P.head[1] + P.neck[1] + P.twist * 0.9);
    b.jaw = joint(b.head, [0, s.head.r[1] * 0.5, -s.head.r[2] * 0.45], -P.jaw);
    // The tail out of the rump: on all fours carried on along the spine, stood up straight back along the ground from it.
    const rootAt = fx(s.tail.at);
    const root = s.up ? joint({ m: body.m, t: rootAt }, [0, 0, 0], -(s.pitch + P.pitch * 0.5), 0, 0) : { m: body.m, t: rootAt };
    const lag = a.act || a.go <= 0 ? 0 : -8 * smooth(Math.min(1, a.go)) * Math.cos(TAU * (frac(a.u) - 0.2));
    tailBones(s, root, P.tail[0], P.tail[1], P.tail[2], lag).forEach((x, q) => { b[`tail${q}`] = x; });
    // The legs.
    legIdx(s).forEach((i, k) => {
      const fore = i < 2, L = legOfIdx(s, i), g = P.at[k];
      const hip = fx([SIDE[i] * (fore ? s.shoulder : s.hip)[0], (fore ? s.shoulder : s.hip)[1], (fore ? s.shoulder : s.hip)[2]]);
      const hint = turn(hdg, unit(fore ? [SIDE[i] * 0.15, -1, 0.2] : [SIDE[i] * 0.3, 1, 0.25]));
      const [u, l, at] = limb(hip, [g[0], g[1], Math.max(g[2], L[2])], L[0], L[1], hint, fwd);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = joint({ m: hdg.m, t: at }, [0, 0, 0], P.foot[k], 0, SIDE[i] * (fore ? 8 : 12));
    });
    if (s.up) {
      // What it holds, in the chest's level frame: turned with the upper body, leaned with it into a run.
      const chest = joint(b.trunk, flexPt(s, chestAt(s), P.twist, 0), -s.pitch, P.twist, 0);
      const C = holdXf(s, P.hold), turnBy = joint(ROOT, [0, 0, 0], P.spin[0], P.spin[1], P.spin[2]).m;
      b.item = { m: mulM(chest.m, mulM(turnBy, C.m)), t: place(chest, add(C.t, P.item)) };
      const G = grips(s);
      for (let k = 0; k < 2; k++) {
        const side = k ? 1 : -1, sh = fx([side * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
        const want = mixV(place(b.item, G[k]), P.reach[k], P.away[k]);
        const hint = turn(hdg, unit([side * 0.9, -0.35, -0.75]));
        const [u, l, at] = limb(sh, want, s.fore[0], s.fore[1], hint, turn(chest, [0, 1, 0]));
        b[`${ARMS[k]}0`] = u;
        b[`${ARMS[k]}1`] = l;
        b[`${ARMS[k]}2`] = { m: l.m, t: at };
      }
    }
    b.shadow = shadowOf(body, 0);
    return b;
  };
  let ready = false;
  const prepare = (): void => {
    ready = true;
    // Where the reeds it works stand: under what it works them with, at the moment it does -- the Reedpup's mouth as it bites,
    // the Reedweaver's paw at full reach, the Marshreaper's blade as it goes through them.
    const W = REED_WORK, base: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 1, blink: false, breath: 0.5, fleece: 1, seed: 0 };
    if (s.stage === 0) {
      const b = pose(workPlan(s, R, W.bite, 1), base), m = place(b.head, mouthAt(s));
      R.site = [m[0], m[1] + 0.04, 0]; R.at = m[2]; R.tall = m[2] + 0.42;
    } else if (s.stage === 1) {
      const P = workPlan(s, R, W.grab, 1), b = pose(P, base);
      const sh = place(b.trunk, flexPt(s, [-s.shoulder[0], s.shoulder[1], s.shoulder[2]], P.twist, 0));
      const hdg = turn(joint(ROOT, [0, 0, 0], 0, 0, P.yaw), unit([-0.35, 1, -0.3]));
      const m = add(sh, scale(hdg, (s.fore[0] + s.fore[1]) * 0.86));
      R.site = [m[0] - 0.08, m[1] + 0.14, 0]; R.at = m[2]; R.tall = m[2] + 0.45;
    } else {
      const b = pose(workPlan(s, R, W.sweep, 1), base), m = place(b.item, BLADE_MID);
      R.site = [0.1, Math.max(m[1], 1.1), 0]; R.at = m[2]; R.tall = Math.max(m[2] + 0.7, 1.5);
    }
  };
  return (a) => {
    if (!ready) prepare();
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go });
    const working = a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
    const t = a.act?.kind === 'work' ? a.act.t : 0.4;
    if (working && s.up) {
      // The paw reaching for the reed, or gathering in the cut ones: to the reed's grip, bent toward it.
      const S = R.site, W = REED_WORK;
      if (s.stage === 1) {
        const grab: V3 = [S[0], S[1] - siteR(s) * 0.55, R.at], pulled: V3 = [S[0] - 0.1, S[1] - 0.4, R.at - 0.12];
        // Pulled down and in until the top snaps, then a flick out to the side that lets the cut top go.
        const pull = ramp(t, W.grab + 0.02, W.snap), flick = ramp(t, W.snap + 0.04, W.toss);
        P.reach[0] = mixV(mixV(grab, pulled, pull), tossFrom(R), flick);
      } else {
        const g = ramp(t, W.sweep + 0.12, W.gather);
        P.reach[0] = mixV([S[0] - 0.12, S[1] - 0.2, R.at + 0.22], [S[0] * 0.4 - 0.18, S[1] * 0.45, R.at + 0.22], g);
      }
    }
    const b = pose(P, a);
    if (working) {
      const k = a.act?.kind === 'work' ? downOf(t, a.graze) : a.graze, g = Math.max(0.001, k);
      b.site = { m: [g, 0, 0, 0, g, 0, 0, 0, g], t: R.site };
      stalkBones(s, R, b, t, g);
    }
    return b;
  };
}

/** Two turns one after the other: `a`, then `b` in its frame. */
function mulM(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

/** How many links the reed it works is in. */
const STALK_LINKS = 3;
/**
 * The reed it works, in links from its root at the front of the clump: bent over toward its mouth or its paw as far as
 * keeps the point it holds where it holds it, and sprung back upright once it lets go; the Reedpup's bitten through and the
 * Reedweaver's snapped at its top, the top falling clear and lying where it lands, and a fresh top pushes up out of the stub by
 * the end of the go.
 */
function stalkBones(s: Reed, R: Rest, b: Bones, t: number, g: number): void {
  const W = REED_WORK, n = STALK_LINKS, seg = R.tall / n, root: V3 = [R.site[0], R.site[1] - siteR(s) * 0.55, 0];
  // What holds it this moment, and how firmly: the Reedpup's mouth from its bite to its letting go, the Reedweaver's paw from
  // its grip to the snap; nothing else bends it.
  let hold: V3 | null = null, k = 0;
  if (s.stage === 0) { hold = place(b.head, mouthAt(s)); k = ramp(t, W.bite - 0.02, W.bite + 0.02) * (1 - ramp(t, W.release, W.release + 0.04)); }
  if (s.stage === 1 && b.al2) { hold = b.al2.t; k = ramp(t, W.grab - 0.02, W.grab + 0.02) * (1 - ramp(t, W.snap, W.snap + 0.02)); }
  let bend = 0, side = 0;
  if (hold && k > 0) {
    // Bent toward it by as much as brings the point it holds over it, found by halving.
    const d = sub(hold, root), toward = Math.atan2(d[0], -d[1]);
    side = toward;
    let lo = 0, hi = 80;
    for (let q = 0; q < 14; q++) {
      const mid = (lo + hi) / 2, p = stalkPoint(root, seg, n, mid, toward, R.at);
      if (Math.hypot(p[0] - root[0], p[1] - root[1]) < Math.hypot(d[0], d[1])) lo = mid; else hi = mid;
    }
    bend = ((lo + hi) / 2) * k;
  }
  // Sprung back past upright once let go and settling.
  const let0 = s.stage === 0 ? W.release : W.snap, since = t - let0;
  if (since > 0 && since < 0.3) bend -= 14 * Math.sin(since * 30) * (1 - since / 0.3);
  let x: Xf = joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: root }, [0, 0, 0], 0, 0, side / DEG);
  for (let q = 0; q < n; q++) {
    x = joint(x, q ? [0, 0, seg] : [0, 0, 0], -bend / n, 0, 0);
    b[`stalk${q}`] = grown(x, g);
  }
  const C = cutOf(s);
  if (C) {
    // The top, once bitten or snapped off: the Reedweaver's in its paw, its foot in the paw and its head up, until it is
    // flicked away; the Reedpup's let drop from its jaws. Then falling clear down beside the reeds, turning over as it goes,
    // and lying where it lands until the end of the go.
    const top = b[`stalk${n - 1}`], paw = s.stage === 1 ? b.al2 : undefined;
    if (t > C.off && (paw || s.stage === 0)) {
      const fall = clamp((t - C.toss) / (C.lands - C.toss)), from = s.stage === 1 ? tossFrom(R) : bitAt(s, R);
      const lie = smooth(fall), to = landOf(s, R), arc = s.stage === 1 ? 0.3 : 0.08;
      const at: V3 = paw && t < C.toss ? paw.t : [lerp(from[0], to[0], fall), lerp(from[1], to[1], fall), Math.max(to[2], lerp(from[2], to[2], fall * fall) + arc * Math.sin(Math.PI * fall))];
      const held = t < C.toss ? 0 : lie;
      b.cut = grown(joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: at }, [0, 0, 0], -20 - 68 * held, 10 * held, 30 * held), g * (1 - smooth((t - 0.88) / 0.1)));
      b[`stalk${n - 1}`] = grown(top, 0.001);
    }
    if (t >= 0.8) {
      // A fresh top pushing up out of the stub while its paw goes back to the bundle, whole again by the end of the go, so the
      // next go starts from the reed as this one did and nothing jumps where they meet.
      b[`stalk${n - 1}`] = grown(top, g * Math.max(0.001, smooth((t - 0.84) / 0.16)));
    }
  }
}
/** A point `at` up a reed in links of `seg`, each bent `bend / n` degrees toward `toward`, from its root, roughly (for finding the bend). */
function stalkPoint(root: V3, seg: number, n: number, bend: number, toward: number, at: number): V3 {
  let x: Xf = joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: root }, [0, 0, 0], 0, 0, toward / DEG), left = at;
  for (let q = 0; q < n; q++) {
    x = joint(x, q ? [0, 0, seg] : [0, 0, 0], -bend / n, 0, 0);
    if (left <= seg) return place(x, [0, 0, left]);
    left -= seg;
  }
  return place(x, [0, 0, left + seg]);
}
/** When the top of the reed it works comes off (`off`), leaves its jaws or paw (`toss`) and lands (`lands`); none for the Marshreaper, whose cut reeds topple where they stand. */
function cutOf(s: Reed): { off: number; toss: number; lands: number } | null {
  const W = REED_WORK;
  return s.stage === 0 ? { off: W.release, toss: W.release, lands: W.drops } : s.stage === 1 ? { off: W.snap, toss: W.toss, lands: W.lands } : null;
}
/** Where the Reedpup bites the reed through: over its root, at its mouth's height. */
const bitAt = (s: Reed, R: Rest): V3 => [R.site[0], R.site[1] - siteR(s) * 0.55, R.at];
/** Where the Reedweaver's paw flicks the cut top away from: out beside the reeds, clear of its bundle, at their grip's height. */
const tossFrom = (R: Rest): V3 => [R.site[0] - 0.1, R.site[1] - 0.5, R.at + 0.12];
/** Where the cut top lands: the Reedpup's dropped beside the reeds, the Reedweaver's thrown on out past them, clear of them and of its bundle. */
const landOf = (s: Reed, R: Rest): V3 => (s.stage === 0 ? [R.site[0] + siteR(s) + 0.12, R.site[1] - 0.1, 0.02] : [R.site[0] - siteR(s) - 0.35, R.site[1] + 0.05, 0.02]);
/** How thick the reeds it works are, against the Reedweaver's: the Reedpup's drawn heavier, so its bite reads at its small size. */
const reedK = (s: Reed): number => (s.stage === 0 ? 1.5 : 1);
/** How wide the clump of reeds it works is. */
const siteR = (s: Reed): number => [0.24, 0.2, 0.42][s.stage];

/* ---- what it is made of ------------------------------------------------------------------------- */

/** The body: warm brown fur, cream down its throat, chest and belly. */
function bodyOf(s: Reed, n: number): Mesh {
  const B = s.body;
  // On the smooth rings, finely round, so the cream of its underside is one soft run from the throat to the belly.
  const S = smoothOf(B), k = (S.y.length - 1) / (B.y.length - 1);
  const creamAt = (ring: number): number => { const f = ring / k, i = Math.min(B.y.length - 2, Math.floor(f)); return lerp(s.cream[i], s.cream[i + 1], smooth(f - i)); };
  // The Reedpup's rump is left open where its tail goes into it, so no rim is inked across the root of the tail.
  return tube(S.y.map((y, q) => [0, y, S.z[q]] as V3), S.w, S.h, n, (ring, j) => (creamFace(n, j, creamAt(ring + 0.5)) ? 'belly' : 'coat'), s.up ? {} : { seam: 'start' });
}

/**
 * The mantle: rows of small leaves laid down the body's back from the head of it to its foot, each row half a leaf on from the
 * one above so they overlap like shingles, every leaf lying along the body pointing down it and a little out, lifted off the fur
 * by a hair at its root and more at its tip, in three greens; down each flank as far as the mantle comes, which on the two stood
 * up is over the shoulders and well round the back, leaving the cream of the chest open.
 */
function mantleOf(s: Reed, half: number, side: boolean): Mesh {
  const M = s.mantle, B = s.body, out: Mesh[] = [];
  const mid = ringAt(B, 0), across = Math.sqrt((mid.w * mid.w + mid.h * mid.h) / 2);
  let row = 0;
  for (let y = M.from; y >= M.to; y -= M.gap, row++) {
    const r = ringAt(B, clamp(y, B.y[0] + 0.02, B.y[B.y.length - 1] - 0.02));
    const f = (M.from - y) / (M.from - M.to);
    // How far down the flanks this row comes: `top` at the head of the mantle, `low` at its foot.
    const low = lerp(M.top, M.low, smooth(f));
    const big = 0.85 + 0.25 * Math.sin(Math.PI * clamp(f * 1.2));
    const dth = (M.leaf[1] * 2.3 * big) / Math.max(0.05, (r.w + r.h) / 2 / (across / mid.w) * 1);
    const count = Math.max(1, Math.round((Math.PI / 2 + low) / dth));
    for (let q = 0; q <= count; q++) {
      const th = Math.PI / 2 - (q + (row % 2) * 0.5) * ((Math.PI / 2 + low) / count);
      if (th < -low - 0.01 || (th < 0.55) !== side) continue;
      for (const sd of q === 0 && row % 2 === 0 ? (half > 0 ? [1] : []) : [half]) {
        const id = row * 131 + q * 17 + (sd > 0 ? 0 : 7);
        const at = onRings(B, clamp(y + (jitter(id) - 0.5) * M.gap * 0.3, B.y[0] + 0.02, B.y[B.y.length - 1] - 0.02), sd > 0 ? th : Math.PI - th);
        // Pointing down the body and a little round toward the belly, lifted off it at its tip.
        const around = unit(cross(at.n, [0, 1, 0]));
        const dir = unit(add(add([0, -1, 0], scale(around, sd * -0.25 * Math.cos(th))), scale(at.n, 0.3 + 0.25 * (1 - f))));
        const L = M.leaf[0] * big * (0.88 + 0.24 * jitter(id + 3)), w = M.leaf[1] * big * (0.9 + 0.2 * jitter(id + 4));
        out.push(leaf(add(at.p, scale(at.n, M.lift)), dir, at.n, L, w, leafMat(id), 0.02, tipOf(leafMat(id))));
      }
    }
  }
  // Stood up, a collar of longer leaves round the top of the shoulders standing out over them and drooping, as a woven mantle's
  // edge does: round the back and the sides and over the front of each shoulder, open over the throat and chest.
  if (s.up) {
    const y = B.y[5] - M.gap * 0.6, n = [0, 7, 16][s.stage];
    for (let q = 0; q < n; q++) {
      const th = lerp(-1.05, Math.PI + 1.05, (q + 0.5) / n), sd = Math.cos(th) >= 0 ? 1 : -1;
      if (sd !== half || (th < 0.55 || th > Math.PI - 0.55) !== side) continue;
      const id = 4000 + q, at = onRings(B, y, th);
      const dir = unit(add(scale(at.n, 0.75), [0, -0.75, 0]));
      out.push(leaf(add(at.p, scale(at.n, M.lift)), dir, unit(add(at.n, [0, 0.6, 0])), M.leaf[0] * (1.15 + 0.2 * s.stage + 0.2 * jitter(id)), M.leaf[1] * 1.15, leafMat(id), 0.12, tipOf(leafMat(id))));
    }
  }
  return merge(...out);
}

/**
 * The head: a broad, flattish skull of brown fur; a short blunt muzzle, cream, a dark nose at its tip and a small mouth under
 * it; the cream carried back from the muzzle over the cheeks and the chin under a line low under the eyes; small round ears low
 * on its sides; and its dark eyes, set high and forward so they read from above.
 */
function headOf(s: Reed, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C: V3 = [0, 0, 0], mz = muzzleAt(s), mr: V3 = [H.muzzle[0], H.muzzle[2], H.muzzle[1]];
  // Up over the cheeks to just under the eyes, so the face is cream with the brown cap over it.
  const eyeLow = onEgg(C, H.r, s.eye.dir).p[2] - s.eye.size * 0.35;
  const skull = orb(C, H.r, n + 3, k + 2, 'coat');
  // Cream under a line from under the eyes forward and down to the back of the jaw: the cheeks, the chin and the throat.
  const creamed = mesh(skull.v, skull.f.map((f) => {
    const top = f.i.reduce((t, i) => (skull.v[i][2] > t[2] ? skull.v[i] : t), skull.v[f.i[0]]);
    const c = scale(f.i.reduce((t, i) => add(t, skull.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const line = lerp(-H.r[2] * 0.05, eyeLow, clamp((c[1] / H.r[1] + 0.55) / 0.45));
    return top[2] < line ? { ...f, m: 'belly' as Mat } : f;
  }));
  const muzzle = orbAlong(mz, [0, 1, 0.2], [H.muzzle[0], H.muzzle[1], H.muzzle[2]], n + 1, k + 1, 'muzzle');
  // The nose: a dark rounded triangle on the top of the tip of the muzzle, facing forward and up, so it reads from above.
  const nt = noseTip(s), nn = unit([0, 0.8, 0.6]);
  const nose = paint([disc(add(nt, scale(nn, 0.004)), nn, H.muzzle[0] * 0.4, H.muzzle[0] * 0.28, 6, 'nose', { spin: Math.PI / 6 })]);
  const noseLump = orb(add(nt, [0, -H.muzzle[2] * 0.16, -H.muzzle[1] * 0.08]), [H.muzzle[0] * 0.34, H.muzzle[2] * 0.16, H.muzzle[1] * 0.24], 6, 3, 'nose');
  // The mouth: a small line down from the nose and out to either side, under the whisker pads.
  const mouth = paint([1, -1].map((sd) => {
    const e0 = onEgg(mz, mr, [0, 1, -0.2]), e1 = onEgg(mz, mr, [sd * 0.55, 0.85, -0.45]);
    const nrm = unit(add(e0.n, e1.n)), dd = unit(sub(e1.p, e0.p)), w = unit(cross(nrm, dd)), th = H.muzzle[0] * 0.07;
    return facingDisc([add(add(e0.p, scale(w, th)), scale(nrm, 0.006)), add(add(e1.p, scale(w, th)), scale(nrm, 0.006)), add(add(e1.p, scale(w, -th)), scale(nrm, 0.006)), add(add(e0.p, scale(w, -th)), scale(nrm, 0.006))], nrm, 'lid');
  }));
  // A brown bridge down the top of the muzzle from the brow, so the cream of the muzzle is its front and its sides.
  const bridge = paint([(() => { const e = onEgg(mz, mr, [0, 0.2, 1]); return disc(add(e.p, scale(e.n, 0.006)), e.n, mr[0] * 0.42, mr[1] * 0.48, 8, 'coat', { up: [0, 1, 0] }); })()]);
  // Ears: small, round, low on the sides of the head, dark inside.
  // Ears: a small rounded flap each side, set back near the top of the head and half sunk in its fur, so they barely show.
  const ears = [1, -1].map((sd) => {
    const e = onEgg(C, H.r, [sd * s.ear.dir[0], s.ear.dir[1], s.ear.dir[2]]), out = unit(add(e.n, [0, -0.5, 0.2]));
    return orbAlong(add(e.p, scale(out, s.ear.r * 0.05)), out, [s.ear.r, s.ear.r * 0.8, s.ear.r * 0.45], 7, 3, 'coat');
  });
  return merge(creamed, muzzle, noseLump, nose, mouth, bridge, ...ears, eyesOf(s, shut));
}

/**
 * The eyes: each a dark brown eye a little taller than wide, a darker middle and two glints, laid onto the skull's own curve
 * high on the front of the face, with a fine dark rim; shut, a lid's line.
 */
function eyesOf(s: Reed, shut: boolean): Mesh {
  const E = s.eye, C: V3 = [0, 0, 0], R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const nrm = q.n, p = add(q.p, scale(nrm, 0.006)), at = add(p, scale(nrm, -0.01 * R[0]));
    const up = unit(cross(cross(nrm, [0, 0, 1]), nrm)), across = unit(cross(up, nrm));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), nrm, r * 1.1, r * 0.3, 8, 'lid', o), 0.008));
      continue;
    }
    out.push(onto(disc(p, nrm, r * 1.18, r * 1.3, 10, 'lid', o), 0.006));
    out.push(onto(disc(p, nrm, r, r * 1.12, 10, 'crystal', o), 0.009));
    out.push(onto(disc(add(p, scale(up, -r * 0.05)), nrm, r * 0.62, r * 0.72, 8, 'eye', o), 0.012));
    out.push(onto(disc(add(add(p, scale(up, r * 0.4)), scale(across, side * r * 0.32)), nrm, r * 0.36, r * 0.36, 6, 'glint', { ...o, lit: true }), 0.016));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.42)), scale(across, -side * r * 0.3)), nrm, r * 0.16, r * 0.16, 5, 'glint', { ...o, lit: true }), 0.016));
  }
  return paint(out);
}

/** Solids inside the head that hide what is round the far side of them: the skull and the muzzle. */
function headSolids(s: Reed): Array<{ c: V3; r: V3 }> {
  const H = s.head;
  return [{ c: [0, 0, 0], r: scale(H.r, 0.9) }, { c: muzzleAt(s), r: [H.muzzle[0] * 0.85, H.muzzle[2] * 0.85, H.muzzle[1] * 0.85] }];
}

/** The neck: brown over, cream under. */
function neckOf(s: Reed, n: number): Mesh {
  const N = s.neck;
  return tube([[0, 0, -N.len * 0.6], [0, 0, N.len * 0.4], [0, 0.02, N.len + 0.04]], [N.w, N.w * 0.95, N.w * 0.85], [N.w * 0.95, N.w * 0.9, N.w * 0.8], n,
    (ring, j) => (Math.abs(((j + 1) / n) * TAU - Math.PI * 1.5) < 1.5 ? 'belly' : 'coat'), { seam: 'both', up: [0, -1, 0] });
}

/** A foot: a broad flat dark paw, its toes rounded in front and a little spread, the big flat feet of the two stood up longer. */
function footOf(s: Reed, fore: boolean, n: number, k: number): Mesh {
  const L = fore ? s.fore : s.hind, w = (fore ? s.foreW : s.hindW), drop = L[2];
  const long = fore ? s.paw : s.foot;
  // Stood up, big flat feet, broad and long.
  const wide = !fore && s.up ? 1.35 : 1.05;
  const pad = orbAlong([0, long * 0.32, -drop + w * 0.42], [0, 1, 0], [w * wide, long * 0.55, w * 0.48], n, k, 'coatDark');
  const toes: Mesh[] = [];
  for (let q = 0; q < 4; q++) {
    const a = ((q - 1.5) / 1.5) * 0.55;
    toes.push(orb([Math.sin(a) * w * 0.85 * wide, long * 0.32 + Math.cos(a) * long * 0.5, -drop + w * 0.32], [w * 0.3 * wide, w * 0.36, w * 0.28], 6, 3, 'coatDark'));
  }
  return merge(pad, ...toes);
}

/** The tail's links: thick at the root and tapering, a little flattened, brown with its last three darker; leaves laid along the top of all but the last. */
function tailOf(s: Reed): Mesh[] {
  const T = s.tail, n = T.links.length;
  return T.links.map((L, q) => {
    const w0 = T.w[q], w1 = T.w[Math.min(q + 1, n - 1)] * (q === n - 1 ? 0.4 : 1);
    const mat: Mat = q >= n - 3 ? 'coatDark' : 'coat';
    // The first link reaches back into the body, so the tail grows out of the rump with no end of it showing.
    const root = q ? 0.03 : 0.2;
    const link = tube([[0, root, 0], [0, -L * 0.5, 0], [0, -L - 0.01, 0]], [w0, (w0 + w1) / 2, w1], [w0 * 0.82, (w0 + w1) * 0.4, w1 * 0.82], 7,
      mat, { seam: q === n - 1 ? 'start' : 'both' });
    const leaves: Mesh[] = [];
    if (q < (s.stage === 0 ? 3 : s.stage === 1 ? 4 : n - 2)) {
      const per = s.stage === 2 ? 3 : 2;
      for (let j = 0; j < per; j++) {
        const id = 900 + q * 11 + j, a = ((j - (per - 1) / 2) / Math.max(1, per - 1)) * 1.7, nn = unit([Math.sin(a), 0, Math.cos(a)]);
        const at: V3 = [Math.sin(a) * w0 * 0.82, -L * (0.15 + 0.2 * (j % 2)), Math.cos(a) * w0 * 0.68];
        const dir = unit(add([0, -1, 0], scale(nn, 0.25)));
        leaves.push(leaf(at, dir, nn, s.mantle.leaf[0] * (1.05 - 0.06 * q), s.mantle.leaf[1] * (1 - 0.05 * q), leafMat(id), 0.03, tipOf(leafMat(id))));
      }
    }
    return merge(link, ...leaves);
  });
}

/* ---- what it carries ------------------------------------------------------------------------------ */

/** How big the bundle is, against how it is built. */
const BUNDLE_K = 1.25;
/** A mesh scaled by `k` about its own origin. */
const scaled = (m: Mesh, k: number): Mesh => mesh(m.v.map((p) => scale(p, k)), m.f);

/** A reed: a thin green stalk from `a` along a gentle curve to `b`, `w` thick. */
const stalk = (a: V3, c: V3, b: V3, w: number, m: Mat = 'stem'): Mesh => taper(curve(a, c, b, 3), w, w * 0.6, 4, m);

/**
 * The bundle: a sheaf of green reeds standing in its own frame up `z`, bound round its middle with a band of twisted reed, long
 * blade leaves arching out of the top of it and two cream pampas plumes rising out of it.
 */
function bundleOf(): { reeds: Mesh; blades: Mesh } {
  const out: Mesh[] = [], blades: Mesh[] = [];
  for (let q = 0; q < 11; q++) {
    const a = q * 2.4, r = 0.105 * Math.sqrt((q + 0.5) / 11), x = Math.cos(a) * r, y = Math.sin(a) * r;
    out.push(stalk([x * 0.8, y * 0.8, -0.6 + 0.08 * jitter(q)], [x * 0.6, y * 0.6, 0], [x * 1.8, y * 1.8, 0.3 + 0.1 * jitter(q + 2)], 0.03, q % 3 ? 'stem' : 'moss'));
  }
  // The binding: a band round the sheaf a little under its middle, and another under it.
  for (const z of [-0.05, -0.34]) out.push(tube([[0, 0, z - 0.03], [0, 0, z + 0.03]], 0.15, 0.15, 7, 'moss'));
  // Blade leaves arching out of the top, in three greens.
  // Fanned out to the front and the outer side, so none lies back over its face.
  for (let q = 0; q < 4; q++) {
    const a = lerp(-0.4, 2.0, q / 3), out3 = unit([Math.cos(a), Math.sin(a), 0]);
    const root: V3 = [out3[0] * 0.05, out3[1] * 0.05, 0.1 + 0.06 * (q % 3)];
    const L = 0.58 + 0.14 * jitter(q + 9);
    blades.push(archBlade(root, out3, L, 0.062, leafMat(q + 40), tipOf(leafMat(q + 40))));
  }
  return { reeds: merge(...out), blades: merge(...blades) };
}
/** The bundle's two pampas plumes, rising out of the top of it, in its frame. */
function bundlePlumes(): Mesh {
  // Out of the top of the sheaf, splayed apart and leaning out to its left away from its head, their heads rising no more than
  // half a head over its own; set by where they point as it hugs the bundle, so in the frame of the bundle as it is held.
  const [X, Y, Z] = frameOf(BUNDLE_ALONG, [0, 1, 0]), held = (d: V3): V3 => { const u = unit(d); return [dot(X, u), dot(Y, u), dot(Z, u)]; };
  return merge(plume([0.04, 0.0, 0.3], held([-1.2, -0.15, 0.85]), [-1, 0, -0.6], 0.72, 0.085, 3), plume([-0.03, 0.03, 0.26], held([-0.5, -0.3, 1]), [-1, 0, 0], 0.66, 0.08, 9));
}

/** Where the scythe's staff ends and its blade begins, along the staff; the blade's middle; the point of its back out at the front of its curve. */
const STAFF_TOP = 0.72;
const BLADE_MID: V3 = [0, 0.95, 0.45];
/** The point of the blade's back, out at the front of its curve: what a swish is drawn behind. */
const BLADE_TIP: V3 = [0, 1.05, 0.62];
/**
 * The scythe: a thick staff along its own `y`, wrapped its whole length in bands of twisted reed in two greens over its wood, a
 * tuft of reed leaves bound in at its head, and out of the head a big pale blade, a crescent like a sickle moon rising and
 * curving back over the staff, broad in its middle and drawn to a point, its cutting edge on the inside of the curve.
 */
function scytheOf(): Mesh {
  const out: Mesh[] = [];
  out.push(tube([[0, -1.05, 0], [0, -0.3, 0.004], [0, 0.3, 0.002], [0, STAFF_TOP + 0.04, 0]], 0.09, 0.09, 6, 'bark'));
  // The wrapping: bands of reed round it from end to end, a little apart, by turns pale and green.
  for (let q = 0; q < 14; q++) {
    const y = lerp(-0.99, STAFF_TOP - 0.04, q / 13);
    out.push(tube([[0, y - 0.035, 0], [0, y + 0.035, 0]], 0.105, 0.105, 6, q % 2 ? 'stem' : 'moss'));
  }
  for (let q = 0; q < 4; q++) {
    const a = q * 1.7, d = unit([Math.cos(a), -0.6, Math.sin(a)]);
    out.push(leaf([0, STAFF_TOP - 0.06, 0], d, unit(cross(d, [1, 0, 0])), 0.26, 0.055, leafMat(q + 70), 0.08, tipOf(leafMat(q + 70))));
  }
  // The blade: its back an arc out from the head of the staff, forward and round up and back; its edge inside the arc.
  const N = 10, v: V3[] = [], Rb = 0.5, a0 = -1.3, C: [number, number] = [STAFF_TOP - Rb * Math.cos(a0), -Rb * Math.sin(a0)];
  for (let q = 0; q <= N; q++) {
    const u = q / N, a = lerp(a0, 0.95, u);
    const c = Math.cos(a), sn = Math.sin(a);
    const back: V3 = [0, C[0] + c * Rb, C[1] + sn * Rb];
    const wd = 0.3 * Math.sin(Math.PI * (0.1 + 0.9 * u)) ** 0.6 * (1 - 0.3 * u) + 0.012;
    v.push(back, [0, C[0] + c * (Rb - wd), C[1] + sn * (Rb - wd)]);
  }
  const th = 0.022, all: V3[] = [...v.map((p) => [p[0] + th, p[1], p[2]] as V3), ...v.map((p) => [p[0] - th, p[1], p[2]] as V3)];
  const f: Face[] = [], M = v.length;
  for (let q = 0; q < N; q++) {
    const a = 2 * q, b2 = 2 * q + 2;
    f.push({ i: [a, b2, b2 + 1, a + 1], m: 'blade' }, { i: [M + a, M + a + 1, M + b2 + 1, M + b2], m: 'blade' });
    f.push({ i: [a, M + a, M + b2, b2], m: 'metalDark' }, { i: [a + 1, b2 + 1, M + b2 + 1, M + a + 1], m: 'blade' });
  }
  f.push({ i: [0, 1, M + 1, M], m: 'blade' }, { i: [2 * N, M + 2 * N, M + 2 * N + 1, 2 * N + 1], m: 'blade' });
  const mid: V3 = [0, C[0], C[1]];
  // Each face out from the blade: across it for its two faces, away from the arc's middle for its back, toward it for its edge.
  const blade = mesh(all, f.map((face) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = all[idx[c]], r = all[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    const c: V3 = [cx / idx.length, cy / idx.length, cz / idx.length];
    const isFace = Math.abs(nx) > Math.hypot(ny, nz);
    const o: V3 = isFace ? [c[0], 0, 0] : [0, c[1] - mid[1], c[2] - mid[2]];
    const inner = !isFace && idx.every((i) => i % 2 === 1);
    const want = inner ? scale(o, -1) : o;
    return nx * want[0] + ny * want[1] + nz * want[2] < 0 ? { ...face, i: [...idx].reverse() } : face;
  }));
  // A band of darker steel along the back of the blade, painted on either face, so it reads as a blade and not a horn.
  const streak = paint([1, -1].map((sd) => facingDisc(Array.from({ length: 12 }, (_, q) => {
    const u = q < 6 ? q / 5 : (11 - q) / 5, a = lerp(a0 + 0.2, 0.75, u), r = q < 6 ? Rb - 0.012 : Rb - 0.07;
    return [sd * (th + 0.003), C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r] as V3;
  }), [sd, 0, 0], 'metalDark')));
  return merge(...out, blade, streak);
}

/** The Marshreaper's plumes: three pampas plumes rising behind its shoulders, fanned, in the trunk's frame. */
function plumesOf(s: Reed): Mesh {
  const B = s.body, out: Mesh[] = [];
  // Three rising out of the top of the mantle behind its right shoulder blade, wide of its head, fanned 48 to 58 degrees out from
  // upright and a little back, each its own length, so they sweep up and away from its head on the side opposite its blade.
  ([[0.95, 1.1, 0.06, 1.12, 0.125], [1.15, 1.3, 0.14, 0.98, 0.12], [1.35, 1.6, 0.02, 1.06, 0.115]] as const).forEach(([th, out3, back, L, w], q) => {
    const yy = B.y[5] - 0.04 - 0.06 * q, at = onRings(B, yy, Math.PI / 2 - th);
    const root = add(at.p, scale(at.n, 0.24));
    out.push(plume(root, [out3, 1, back], [1, 0, 0.5], L, w, 20 + q * 5));
  });
  return merge(...out);
}

/**
 * The Marshreaper's braided bands: two plaits of reed from the top of each shoulder down across its chest to meet over its
 * breastbone, each a run of short twisted lengths in two greens laid on the body's own curve.
 */
function braidOf(s: Reed): Mesh {
  const B = s.body, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    const N = 15;
    const pts = Array.from({ length: N + 1 }, (_, q) => {
      const u = q / N, y = lerp(B.y[6] - 0.02, B.y[4] + 0.12, u), th = lerp(sd > 0 ? 0.45 : Math.PI - 0.45, -Math.PI / 2 + sd * 0.07, u);
      const e = onRings(B, y, th);
      return add(e.p, scale(e.n, 0.1));
    });
    // A plait: lengths laid at a slant by turns, a pale straw over a dark brown, so it reads at a glance against the cream.
    for (let q = 0; q < N; q++) {
      const a = pts[q], b2 = pts[q + 1], m = mixV(a, b2, 0.5), along = sub(b2, a), across = unit(cross(along, [0, 0, -1]));
      const slant = unit(add(unit(along), scale(across, q % 2 ? 0.45 : -0.45)));
      out.push(orbAlong(m, slant, [0.105, 0.075, len3(along) * 0.95], 6, 3, q % 2 ? 'petal' : 'bark'));
    }
  }
  return merge(...out);
}

/** The reeds it works: a clump of tall green stalks with leaves, a cattail on two, in the site's frame -- all but the one it holds. */
function clumpOf(s: Reed, R: Rest): Mesh {
  const out: Mesh[] = [], r = siteR(s), tall = R.tall;
  const N = [6, 8, 11][s.stage];
  for (let q = 0; q < N; q++) {
    const a = q * 2.39996 + 0.4, d = r * Math.sqrt((q + 0.6) / N), x = Math.cos(a) * d, y = Math.sin(a) * d + r * 0.15;
    const h = tall * (0.75 + 0.35 * jitter(q + 30)), lean = (jitter(q + 31) - 0.5) * 0.25 * h;
    out.push(stalk([x, y, 0], [x + lean * 0.3, y, h * 0.5], [x + lean, y + lean * 0.3, h], (0.008 + 0.004 * s.stage) * reedK(s), q % 3 ? 'stem' : 'moss'));
    if (q % 4 === 1) out.push(orbAlong([x + lean * 0.9, y + lean * 0.27, h * 0.88], [lean / h, 0, 1], [(0.02 + 0.01 * s.stage) * reedK(s), (0.02 + 0.01 * s.stage) * reedK(s), (0.06 + 0.03 * s.stage) * reedK(s)], 5, 3, 'bark'));
    // A leaf or two off each stalk, arching out.
    const la = a + 1.3, out3 = unit([Math.cos(la), Math.sin(la), 0]), root: V3 = [x, y, h * (0.25 + 0.2 * jitter(q + 32))];
    const L = h * 0.42;
    out.push(tube(curve(root, add(root, add(scale(out3, L * 0.35), [0, 0, L * 0.55])), add(root, add(scale(out3, L * 0.8), [0, 0, L * 0.3])), 3), [0.014, 0.016, 0.011, 0.002].map((v) => v * (1 + s.stage * 0.6) * reedK(s)), 0.004, 4, leafMat(q + 50), { up: unit(cross(out3, [0, 0, 1])) }));
  }
  return merge(...out);
}

/** The reed it holds, a link of it: a straight length of stalk up its own `z`, with a cattail on the top one. */
function stalkLink(s: Reed, R: Rest, q: number): Mesh {
  const seg = R.tall / STALK_LINKS, w = (0.009 + 0.004 * s.stage) * reedK(s);
  const m = tube([[0, 0, -0.01], [0, 0, seg + 0.01]], w, w, 4, 'stem');
  if (q < STALK_LINKS - 1) return m;
  return merge(m, orbAlong([0, 0, seg * 0.7], [0, 0, 1], [w * 1.8, w * 1.8, seg * 0.22], 5, 3, 'bark'));
}

/** A stage's pieces. */
function reedBuild(s: Reed, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 4, 6), R = restOf(s);
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: bodyOf(s, n + (s.up ? 36 : 14)), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  // The mantle in four, its back and its sides on either side, each drawn over the body from wherever it is seen.
  pieces.push({ key: 'mantle', mesh: mantleOf(s, 1, false), bone: 'trunk', bias: 0.06, airy: true, after: ['body', 'ar0'], front: [0.6, 0, 0.8] });
  pieces.push({ key: 'mantleL', mesh: mantleOf(s, -1, false), bone: 'trunk', bias: 0.06, airy: true, after: ['body', 'al0'], front: [-0.6, 0, 0.8] });
  pieces.push({ key: 'cape', mesh: mantleOf(s, 1, true), bone: 'trunk', bias: 0.065, airy: true, after: ['body', 'ar0', 'mantle'], front: [1, 0, -0.1] });
  pieces.push({ key: 'capeL', mesh: mantleOf(s, -1, true), bone: 'trunk', bias: 0.065, airy: true, after: ['body', 'al0', 'mantleL'], front: [-1, 0, -0.1] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: 'head' });
  const hide = headSolids(s);
  // Outlined round the whole head and not inside it, so its small ears show at its edge and are never a ring on its side.
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide, lines: false });
  // The Reedpup's tail runs straight back out of its rump: its root drawn over the body's end wherever the tail is not turned away,
  // so the rump's outline does not cut across it.
  tailOf(s).forEach((m, q) => pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.05 + q * 0.005, chain: 'tail', ...(!s.up && q === 0 ? { after: ['body'], front: [0, -1, 0] as V3 } : {}) }));
  for (const i of legIdx(s)) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = fore ? s.foreW : s.hindW;
    // A haunch or shoulder round at the top of the leg, brown, the leg darker brown below it, and the paw darker still.
    // Smooth and round: a haunch or a shoulder of its fur at the top, the leg darker brown below it tapering to a round knee, the
    // lower leg on down to a round ankle. Stood up, the haunch is a big thigh bulging out of the side of the belly.
    const big = fore ? 1.25 : s.up ? 2.1 : 1.45, nn = n + 2;
    const upper = merge(
      orb(s.up && !fore ? [0, w * 0.35, -w * 0.5] : [0, 0, -w * 0.2], [w * big, w * big * 1.05, w * big * 1.15], nn, k + 1, 'coat'),
      tube([[0, 0, 0], [0, 0.01, -L[0] * 0.5], [0, 0, -L[0]]], [w * 1.2, w * 1.08, w * 0.98], [w * 1.2, w * 1.08, w * 0.98], nn, 'coatDark', { seam: 'start' }),
      orb([0, 0, -L[0]], w * 0.98, nn, k, 'coatDark'));
    const lower = merge(tube([[0, 0, w * 0.4], [0, 0.01, -L[1] * 0.5], [0, 0.01, -L[1]]], [w * 0.95, w * 0.88, w * 0.8], [w * 0.95, w * 0.88, w * 0.8], nn, 'coatDark', { seam: 'start' }),
      orb([0, 0.01, -L[1]], w * 0.8, nn, k, 'coatDark'));
    pieces.push(
      // Outlined round the whole of each part and not along the joins of its rounds, so a leg is one smooth limb.
      { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.01, after: ['body'], front: [side, 0, 0], lines: false },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: [side, 0.5, 0], lines: false },
      { key: `${key}2`, mesh: footOf(s, fore, n, k), bone: `${key}2`, bias: 0.03, after: ['body', `${key}1`], front: [side, 0.5, 0], lines: false },
    );
  }
  if (s.up) {
    const bundle = bundleOf(), item = s.load === 1 ? scaled(bundle.reeds, BUNDLE_K) : scytheOf();
    if (s.load === 1) {
      pieces.push({ key: 'fluff', mesh: scaled(bundlePlumes(), BUNDLE_K), bone: 'item', bias: 0.03, after: ['body', 'head', 'mantle', 'mantleL', 'cape', 'capeL'], front: [0, 1, 0.3] });
      // Its long blades inked lightly, as the mantle's leaves are, so they are leaves and not dark sticks.
      pieces.push({ key: 'blades', mesh: scaled(bundle.blades, BUNDLE_K), bone: 'item', bias: 0.02, after: ['body', 'mantle', 'mantleL', 'cape', 'capeL'], front: [0, 1, 0.3], airy: true });
    }
    pieces.push({ key: 'item', mesh: item, bone: 'item', bias: 0.1, after: ['body', 'mantle', 'mantleL', 'cape', 'capeL'], front: [0, 1, 0] });
    for (let q = 0; q < 2; q++) {
      const key = ARMS[q], side = q ? 1 : -1, w = s.foreW, L = s.fore;
      const upper = merge(orb([0, 0, -w * 0.3], [w * 1.35, w * 1.35, w * 1.5], n - 2, k, 'coat'), tube([[0, 0, 0], [0, 0, -L[0]]], [w * 1.15, w], [w * 1.15, w], n - 2, 'coat', { seam: 'start' }));
      // The forearm thick at the elbow and tapering to a slim wrist, darkening toward the paw, so the paw reads as a paw on it.
      const lower = merge(orb([0, 0, 0], w, n - 2, k, 'coat'), tube([[0, 0, 0], [0, 0.005, -L[1] * 0.45], [0, 0.01, -L[1]]], [w * 1.02, w * 0.9, w * 0.56], [w * 0.98, w * 0.82, w * 0.52], n - 2, (ring) => (ring >= 1 ? 'coatDark' : 'coat'), { seam: 'start' }));
      const paw = orb([0, 0, -s.paw * 0.45], [s.paw * 1.05, s.paw * 0.9, s.paw * 1.1], n - 2, k, 'coatDark');
      // The mantle's drape over the top of the upper arm: long leaves laid down its outside from the shoulder.
      const drape: Mesh[] = [];
      for (let j = 0; j < 3; j++) {
        const id = 5000 + q * 20 + j, a = (j - 1) * 0.8, nn = unit([side * Math.cos(a), Math.sin(a), 0.15]);
        const root: V3 = [side * w * 1.3 * Math.cos(a), w * 1.3 * Math.sin(a), w * 0.4 - (j % 2) * L[0] * 0.18];
        drape.push(leaf(root, unit(add([0, 0, -1], scale(nn, 0.25))), nn, s.mantle.leaf[0] * (1.1 + 0.15 * jitter(id)), s.mantle.leaf[1] * 1.1, leafMat(id), 0.05, tipOf(leafMat(id))));
      }
      pieces.push(
        { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.04, after: ['body'], front: [side, 0, 0], lines: false },
        { key: `${key}d`, mesh: merge(...drape), bone: `${key}0`, bias: 0.045, after: ['body', `${key}0`, side > 0 ? 'cape' : 'capeL'], front: [side, 0, 0], airy: true },
        { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.05, after: ['body', `${key}0`, 'item'], front: [0, 1, 0], lines: false },
        { key: `${key}2`, mesh: paw, bone: `${key}2`, bias: 0.06, after: ['body', `${key}1`, 'item'], front: [0, 1, 0] },
      );
    }
    if (s.load === 2) {
      pieces.push({ key: 'plumes', mesh: plumesOf(s), bone: 'trunk', bias: -0.02 });
      pieces.push({ key: 'braid', mesh: braidOf(s), bone: 'trunk', bias: 0.07, after: ['body', 'mantle', 'mantleL'], front: [0, 0, -1] });
    }
  }
  const working = (a: Anim): boolean => a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
  pieces.push({ key: 'site', mesh: clumpOf(s, R), bone: 'site', bias: 0, shown: working, thin: true, airy: true, bent: (v, a) => clumpBent(s, v, a) });
  for (let q = 0; q < STALK_LINKS; q++) pieces.push({ key: `stalk${q}`, mesh: stalkLink(s, R, q), bone: `stalk${q}`, bias: 0.01, shown: working, thin: true, airy: true });
  const C = cutOf(s);
  if (C) pieces.push({ key: 'cut', mesh: stalkLink(s, R, STALK_LINKS - 1), bone: 'cut', bias: 0.07, thin: true, shown: (a) => a.act?.kind === 'work' && a.act.t > C.off && a.act.t < 0.98 });
  // Everything on the trunk turns with the twist of its upper body and bends with the arch of its back (`flexPt`); the plumes sway.
  const flex = (v: readonly V3[], a: Anim): V3[] => {
    const F = flexOf(s, R, a);
    return F.twist || F.arch || F.bend ? v.map((p) => flexPt(s, p, F.twist, F.arch, F.bend)) : [...v];
  };
  return pieces.map((pc) => {
    if (pc.key === 'plumes') return { ...pc, bent: (v: readonly V3[], a: Anim) => plumeSway(s, flex(v, a), a) };
    return pc.bone === 'trunk' ? { ...pc, bent: flex } : pc;
  });
}

/** The Marshreaper's plumes swaying, the further up them the more: as it breathes and goes, and thrown about as it strikes. */
function plumeSway(s: Reed, v: V3[], a: Anim): V3[] {
  const y0 = s.body.y[5];
  const k = 0.03 * Math.sin(a.t * 1.3) + (a.go > 0 ? 0.04 * Math.sin(TAU * frac(a.u) * 2 - 1) : 0) + (a.act?.kind === 'strike' ? -0.12 * hump(a.act.t, REED_HITS[2] + 0.06, 0.2) : 0);
  return v.map((p) => {
    const up = Math.max(0, p[1] - y0);
    return up > 0 ? [p[0] + k * up * up * 0.6, p[1], p[2] - k * up * up] : p;
  });
}

/**
 * The clump as it stands this moment: swaying a little in the air; the Marshreaper's cut through at the height its blade goes
 * through them, the tops toppling over away from it and lying where they fall, then gathered in and gone, and a fresh
 * growth pushing up out of the stubs by the end of the go, so the next go starts from the clump as this one did.
 */
function clumpBent(s: Reed, v: readonly V3[], a: Anim): V3[] {
  const t = a.act?.kind === 'work' ? a.act.t : 0.4, sway = 0.04 * Math.sin(a.t * 1.7);
  const R = restOf(s), W = REED_WORK;
  const swayed = (p: V3): V3 => { const h = clamp(p[2] / R.tall), push = sway * h * h; return [p[0] - push * 0.9, p[1] + push * 0.2, p[2]]; };
  if (s.stage !== 2 || t < W.sweep) return v.map(swayed);
  const cz = R.at, fall = smooth((t - W.sweep) / 0.14), gone = smooth((t - W.gather + 0.04) / 0.12), grow = smooth((t - 0.84) / 0.16);
  const tip = 82 * DEG * fall, c = Math.cos(tip), sn = Math.sin(tip);
  return v.map((p) => {
    if (p[2] <= cz) return swayed(p);
    const up = p[2] - cz;
    if (t >= 0.84) return swayed([p[0], p[1], cz + up * Math.max(0.001, grow)]);
    // Toppled about where it was cut, away from it and to its left, the cut end dropping to the ground as it goes; then drawn
    // in toward it and gone.
    const k = Math.max(0.001, 1 - gone), pz = cz * (1 - 0.9 * fall);
    return [p[0] - up * sn * 0.5 * k, p[1] + up * sn * 0.86 * k - 0.35 * gone, pz * k + up * c * k];
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** The greens of what flies off it -- bits of leaf and cut reed -- and the cream of plume fluff; the same on every variant. */
const BITS: readonly RGB[] = [[120, 146, 70], [92, 116, 58], [168, 168, 92], [244, 230, 200]];

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling, lying where it lands; drifting as a leaf does. */
const thrown = (p: V3, v: V3, s: number, fall = 6): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's bits in the air are drawn: less than in proportion on the small one, so they still read. */
const bigness = (s: Reed): number => [0.6, 0.85, 1.15][s.stage];

/** A bit of leaf in the air: a small pointed sliver, turning, lit on one side, dark-edged, never under a pixel and a half. */
function fleck(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01 || r <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, Math.min(1.5 / px, r * 3));
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = css(c, al);
  g.strokeStyle = css(mix(c, [40, 36, 24], 0.6), al * 0.9);
  g.lineWidth = Math.max(r * 0.18, 0.08);
  g.beginPath();
  g.moveTo(-r, 0);
  g.quadraticCurveTo(0, -r * 0.45, r, 0);
  g.quadraticCurveTo(0, r * 0.45, -r, 0);
  g.fill();
  g.stroke();
  g.restore();
}

/** Bits of leaf and reed thrown from `from`, `since` seconds after, up and out, drifting down; each drawn in front of the body or behind it. */
function spray(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.6, cols: readonly RGB[] = BITS): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.7 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp, Math.sin(a) * sp, up * (0.6 + 0.7 * jitter(k + 2))];
    const p = thrown(from, v, since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    fleck(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), k + since * (8 + 8 * jitter(k + 4)), cols[q % cols.length], 1 - smooth((since - life * 0.6) / (life * 0.4)));
  }
}

/** A swish through the air behind a blade or the head of a bundle: a pale thinning arc through where it has been these last moments. */
function swishOf(g: CanvasRenderingContext2D, view: View, pts: V3[], al: number, w: number): void {
  if (al <= 0.02 || pts.length < 2) return;
  g.save();
  g.lineCap = 'round';
  for (let q = 1; q < pts.length; q++) {
    const [x0, y0] = onScreen(view, pts[q - 1]), [x1, y1] = onScreen(view, pts[q]);
    g.strokeStyle = `rgba(255,252,240,${(al * (1 - q / pts.length) * 0.75).toFixed(3)})`;
    g.lineWidth = w * (1 - 0.6 * (q / pts.length));
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  g.restore();
}

/**
 * What a strike throws: the Reedpup's bite a few bits of leaf off its mantle; the Reedweaver's swat bits of leaf and fluff off
 * its plumes, and a swish behind the head of its bundle; the Marshreaper's sweep a long swish behind its blade and cut bits of
 * reed thrown off it.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Reed, kind: Kind, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, hit = REED_HITS[s.stage], since = (t - hit) * ACT_SECS.strike;
  if (s.up && front && t > hit - 0.2 && t < hit + 0.2) {
    // Where the blade's tip or the bundle's head has been over the last tenth of a second.
    const tip: V3 = s.load === 2 ? BLADE_TIP : scale([0.05, 0, 0.78], BUNDLE_K);
    const trail: V3[] = [];
    for (let q = 0; q < 6; q++) {
      const at = t - q * 0.025;
      if (at < 0) break;
      const bb = kind.bones({ ...a, act: { kind: 'strike', t: at } });
      trail.push(place(bb.item, tip));
    }
    swishOf(g, view, trail, 1 - Math.abs(t - hit) / 0.2, (s.load === 2 ? 0.16 : 0.1) * big);
  }
  if (since <= 0) return;
  if (s.stage === 0) {
    const m = place(b.head, mouthAt(s));
    spray(g, view, mid, m, since, front, 5, 40, 1.4 * big, 2.6, 0.05 * big, 0.45);
    return;
  }
  const at = place(b.item, s.load === 2 ? BLADE_MID : scale([0.05, 0, 0.6], BUNDLE_K));
  spray(g, view, mid, at, since, front, s.stage === 1 ? 7 : 9, 60 + 30 * s.stage, 1.8 * big, 2.4, 0.06 * big, 0.7);
}

/**
 * What a go at its task throws: the Reedpup's bite a drop or two and a bit of leaf as the reed is bitten through; the Reedweaver's
 * snap a few bits off the top of the reed; the Marshreaper's sweep cut tops of reed tumbling down, and a swish behind its blade.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Reed, kind: Kind, b: Bones, R: Rest, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, loop = a.graze >= 0.5, W = REED_WORK;
  const since = (t0: number): number => (t < t0 && !loop ? -1 : frac(t - t0) * ACT_SECS.work);
  const top: V3 = [R.site[0], R.site[1], R.tall * 0.85];
  if (s.stage === 0) {
    const dt = since(W.release);
    spray(g, view, mid, [R.site[0], R.site[1], R.tall * 0.7], dt, front, 4, 300, 0.9 * big, 1.6, 0.05 * big, 0.6);
    return;
  }
  if (s.stage === 1) {
    const dt = since(W.snap);
    spray(g, view, mid, [R.site[0] - 0.08, R.site[1] - 0.12, R.at], dt, front, 5, 330, 1.0 * big, 1.6, 0.05 * big, 0.6);
    return;
  }
  const dt = since(W.sweep);
  spray(g, view, mid, top, dt, front, 10, 360, 1.6 * big, 1.4, 0.08 * big, 0.9, BITS.slice(0, 3));
  if (front && t > W.sweep - 0.14 && t < W.sweep + 0.14) {
    const trail: V3[] = [];
    for (let q = 0; q < 6; q++) {
      const at = t - q * 0.025;
      if (at < 0) break;
      const bb = kind.bones({ ...a, act: { kind: 'work', t: at } });
      trail.push(place(bb.item, BLADE_TIP));
    }
    swishOf(g, view, trail, 1 - Math.abs(t - W.sweep) / 0.14, 0.16 * big);
  }
}

/** Evolving: at the start a burst of leaves off it, which covers the moment it changes into its new body; then leaves swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Reed, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], tall = s.up ? 1.6 + 0.8 * (s.stage - 1) : 0.6;
  const burst = 1 - ramp(t, 0.1, 0.28);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 26; q++) {
      const th = (q / 26) * TAU * 2.3 + jitter(q) * 0.7;
      const from: V3 = [mid[0] + Math.cos(th) * 0.2 * big, mid[1] + Math.sin(th) * 0.2 * big, tall * (0.3 + 0.5 * jitter(q + 5))];
      const v: V3 = [Math.cos(th) * (1.4 + 1.6 * jitter(q + 3)), Math.sin(th) * (1.4 + 1.6 * jitter(q + 5)), 2 + 2 * jitter(q + 7)];
      const p = thrown(from, scale(v, Math.sqrt(big)), since, 4);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      fleck(g, x, y, 0.07 * big + 0.03, q * 1.3 + since * 6, BITS[q % 4], burst * ramp(t, 0, 0.03));
    }
  }
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl > 0) {
    const rx = 0.5 * big + 0.3, high = tall * 1.2;
    for (let q = 0; q < 20; q++) {
      const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32);
      const ang = (q / 20) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
      const p: V3 = [mid[0] + Math.cos(ang) * rx * k, mid[1] + Math.sin(ang) * rx * k, u * high * 0.8 + 0.1];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      fleck(g, x, y, (0.08 * big + 0.03) * (1 - 0.4 * u), ang * 2 + q, BITS[q % 4], swirl * ramp(u, 0, 0.15));
    }
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function reedKind(s: Reed): Kind {
  const bones = reedBones(s), R = restOf(s);
  const kind: Kind = {
    bones,
    // Posed once first, which finds where the reeds it works stand and how tall they are, so they are built to fit.
    build: (lod) => { bones({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 }); return reedBuild(s, lod); },
    // The variant's coat tints its fur and its markings the cream of its throat and belly, by as much as each has colour in
    // it; the greens of its leaves, the cream of its plumes, its dark paws, nose and eyes are the same on every variant.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const fur = mix([142, 92, 58], pastel(coat, 24), 0.25 * clamp(sat(coat) / 0.35)), cream = mix([248, 232, 204], pastel(mark, 30), 0.25 * clamp(sat(mark) / 0.35));
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [50, 32, 26], 0.45),
        coatLight: mix(fur, [255, 240, 220], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 252, 244], 0.4),
        inner: [120, 82, 64],
        lid: [62, 40, 32],
        nose: [52, 36, 32],
        eye: [30, 20, 18],
        crystal: [96, 62, 42],
        glint: [255, 253, 246],
        claw: [56, 40, 34],
        leaf: [128, 156, 72],
        leafDark: [96, 126, 60],
        feather: [172, 172, 88],
        // The lighter olive of a leaf's tip, a step over the green it grows from.
        bloom: [150, 172, 82],
        petal: [190, 188, 104],
        stem: [168, 186, 98],
        moss: [176, 160, 92],
        horn: [242, 224, 182],
        hornDark: [222, 196, 148],
        bark: [128, 90, 60],
        blade: [232, 226, 210],
        metalDark: [104, 92, 80],
      } as Partial<ReturnType<Kind['palette']>>, 24);
    },
    shadow: s.up ? [0.4 + 0.25 * s.stage, 0.35 + 0.15 * s.stage] : [0.62, 0.22],
    stride: 1.2,
    size: s.size,
    acts: ['strike', 'work'],
    // The Reedpup bounds at a run, carried through the air between its hind feet's push and its fore feet's landing.
    leaps: s.up ? undefined : [false, true],
    // Evolving, the motes rising round it are reed green and plume cream.
    motes: [[130, 160, 76], [246, 236, 214]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikeBurst(g, view, s, kind, b, a, act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, kind, b, R, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
  return kind;
}

export const REEDPUP = reedKind(REEDPUP_LOOK);
export const REEDWEAVER = reedKind(REEDWEAVER_LOOK);
export const MARSHREAPER = reedKind(MARSHREAPER_LOOK);
