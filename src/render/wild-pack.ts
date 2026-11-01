import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, eyes, frac, lerp, merge, mix, orb, orbAlong, paint,
  scale, shadowOf, smile, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut, under } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The pack line: the Packlet, a small hare of a pack beast, brown with cream underparts, a cream ruff and cheeks, cream
 * paws, amber eyes and long upright ears cream inside and brown at the tips, a leafy crest of green and cream between them,
 * a mantle of moss and leaves over its back and one big pale pearly pod strapped to its flank in a rope harness; which
 * grows into the Haulbud, taller and longer, bigger ears and crest, a thicker mantle, long cream fur down its legs and two
 * pods in rope nets on each flank; and then the Cargocrest, big and tall on an upright neck, a great crest, long drooping
 * ears and a great cream ruff, leaf armour on its shoulders and legs, heavy cream-furred legs with claws, and on its back
 * an arched cage of root ribs under a mossy roof holding big pearly pods. The species is still `bura` underneath, as
 * saves and the database know it: the pack beast whose panniers are a store.
 *
 * Built the way the hare line is (`./wild-hare`): one set of functions from a description of each stage (`Pack`), every
 * foot given a point to be at and its leg bent to reach it, so a planted foot stays where it was put and a knee never
 * flips. It walks one side then the other and runs in bounds. It has no task; struck at, it kicks out behind with both hind
 * feet, its pods swinging.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** A pod on its flank: how far along the body (`y`), round from the top toward its right (`th`, radians; `-th` the left), its half-sizes, how far out of the coat. */
interface Pod { y: number; th: number; r: V3; out: number }

interface Pack {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest, about its middle. */
  body: Rings;
  /** Hip to shoulder. */
  len: number;
  hip: number;
  drop: number;
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  rake: [number, number];
  paw: number;
  stance: [number, number];
  high: number;
  neck: { at: V3; len: number; w: number; lean: number };
  head: { r: V3; snout: V3; up: number; pitch: number };
  eye: { dir: V3; size: number };
  /**
   * The right drooping ear: its root on the skull, its length and half-width, the way it hangs from there (out, forward, up,
   * in the head's frame) and the way its hollow faces.
   */
  ear: { at: V3; len: number; w: number; hang: V3; hollow: V3 };
  /** The crest of leaves between the ears: how many, how long and wide, how far it is laid back (degrees). */
  crest: { n: number; len: number; w: number; back: number };
  ruff: { c: V3; r: V3; len: number; rows: number; across: number };
  /** Long cream fur down its legs. */
  feather: number;
  /** The mantle: along the back from `from` to `to` (along the barrel), how far down the flanks (radians from the top), cushion size, rows, leaves round its edge. */
  mantle: { from: number; to: number; wide: number; deep: number; rows: number; leaves: number; leaf: number };
  pods: Pod[];
  /** Rope nets over the pods (the Haulbud's), rather than a harness round each. */
  nets: boolean;
  /** The Cargocrest's cage over its back: how many arches, how high its roof stands over the back. */
  cage: { arches: number; high: number; w: number } | null;
  /** Leaf armour on its shoulders and its legs. */
  armour: boolean;
  gait: { duty: [number, number]; swing: [number, number]; step: number; bob: number; flex: number };
  size: number;
}

/** A Packlet: small and long in the body on short legs, a big head, tall ears, drooping flaps, a mossy back and one pod on its left flank. */
const PACKLET_LOOK: Pack = {
  stage: 0,
  body: { y: [-1.12, -1.0, -0.6, 0, 0.55, 0.88, 1.04], z: [0.1, 0.1, 0.08, 0.04, 0.0, 0.02, 0.08], w: [0.36, 0.58, 0.66, 0.66, 0.64, 0.56, 0.32], h: [0.38, 0.6, 0.7, 0.7, 0.68, 0.6, 0.36] },
  len: 1.55, hip: 0.62, drop: 0.3,
  fore: [0.33, 0.3, 0.1], hind: [0.36, 0.3, 0.24], thick: 0.2, rake: [10, 18], paw: 0.13, stance: [0.02, 0.06],
  high: 0.97,
  neck: { at: [0, 0.86, 0.3], len: 0.26, w: 0.36, lean: 24 },
  head: { r: [0.46, 0.5, 0.42], snout: [0.28, 0.2, 0.28], up: 0.14, pitch: -4 },
  eye: { dir: [0.62, 0.66, 0.26], size: 0.13 },
  ear: { at: [0.3, -0.1, 0.3], len: 1.0, w: 0.27, hang: [0.62, -0.28, -0.74], hollow: [0.75, 0.55, 0.1] },
  crest: { n: 5, len: 0.85, w: 0.18, back: 30 },
  ruff: { c: [0, 0.86, -0.02], r: [0.42, 0.32, 0.44], len: 0.2, rows: 3, across: 6 },
  feather: 0.12,
  mantle: { from: -1.0, to: 0.6, wide: 0.75, deep: 0.24, rows: 4, leaves: 6, leaf: 0.4 },
  pods: [{ y: -0.3, th: -1.68, r: [0.4, 0.66, 0.56], out: 0.04 }],
  nets: false,
  cage: null,
  armour: false,
  gait: { duty: [0.62, 0.3], swing: [0.32, 0.38], step: 0.22, bob: 0.05, flex: 9 },
  size: 4.0,
};

/** A Haulbud: taller and longer, bigger ears and crest, a thicker mantle, long cream fur on its legs, two pods in nets each side. */
const HAULBUD_LOOK: Pack = {
  stage: 1,
  body: { y: [-1.5, -1.38, -0.9, -0.1, 0.65, 1.22, 1.45], z: [0.12, 0.12, 0.1, 0.06, 0.02, 0.02, 0.08], w: [0.42, 0.7, 0.78, 0.76, 0.76, 0.7, 0.42], h: [0.42, 0.7, 0.82, 0.8, 0.8, 0.74, 0.44] },
  len: 2.1, hip: 0.62, drop: 0.3,
  fore: [0.6, 0.54, 0.16], hind: [0.64, 0.54, 0.42], thick: 0.27, rake: [10, 18], paw: 0.17, stance: [0.04, 0.1],
  high: 1.52,
  neck: { at: [0, 1.24, 0.42], len: 0.5, w: 0.44, lean: 26 },
  head: { r: [0.54, 0.6, 0.48], snout: [0.3, 0.22, 0.34], up: 0.12, pitch: -6 },
  eye: { dir: [0.62, 0.64, 0.26], size: 0.13 },
  ear: { at: [0.32, -0.12, 0.28], len: 1.25, w: 0.31, hang: [0.58, -0.3, -0.76], hollow: [0.75, 0.55, 0.1] },
  crest: { n: 7, len: 1.15, w: 0.22, back: 32 },
  ruff: { c: [0, 1.3, 0.04], r: [0.52, 0.4, 0.6], len: 0.3, rows: 3, across: 6 },
  feather: 0.24,
  mantle: { from: -1.45, to: 0.95, wide: 0.8, deep: 0.3, rows: 5, leaves: 8, leaf: 0.5 },
  pods: [
    { y: -0.78, th: -1.45, r: [0.36, 0.48, 0.45], out: 0.08 }, { y: 0.18, th: -2.0, r: [0.36, 0.48, 0.45], out: 0.04 },
    { y: -0.78, th: 1.45, r: [0.36, 0.48, 0.45], out: 0.08 }, { y: 0.18, th: 2.0, r: [0.36, 0.48, 0.45], out: 0.04 },
  ],
  nets: true,
  cage: null,
  armour: false,
  gait: { duty: [0.64, 0.3], swing: [0.3, 0.38], step: 0.2, bob: 0.05, flex: 9 },
  size: 3.4,
};

/** A Cargocrest: big and tall, an upright neck, a great crest and ruff, drooping ears, leaf armour, a cage of roots full of pods. */
const CARGOCREST_LOOK: Pack = {
  stage: 2,
  body: { y: [-1.95, -1.8, -1.2, -0.2, 0.75, 1.45, 1.85, 2.0], z: [0.1, 0.09, 0.1, 0.08, 0.06, 0.06, 0.12, 0.16], w: [0.52, 0.9, 1.0, 0.98, 0.96, 0.92, 0.76, 0.46], h: [0.48, 0.82, 0.94, 0.92, 0.92, 0.92, 0.8, 0.46] },
  len: 2.7, hip: 0.62, drop: 0.3,
  fore: [0.74, 0.66, 0.2], hind: [0.78, 0.66, 0.5], thick: 0.46, rake: [8, 16], paw: 0.28, stance: [0.04, 0.12],
  high: 1.86,
  neck: { at: [0, 1.7, 0.6], len: 1.05, w: 0.56, lean: 12 },
  head: { r: [0.64, 0.72, 0.54], snout: [0.32, 0.25, 0.44], up: 0.12, pitch: -8 },
  eye: { dir: [0.62, 0.62, 0.3], size: 0.12 },
  ear: { at: [0.34, -0.16, 0.26], len: 1.65, w: 0.36, hang: [0.42, -0.3, -0.86], hollow: [0.8, 0.5, 0.1] },
  crest: { n: 9, len: 1.7, w: 0.28, back: 34 },
  ruff: { c: [0, 1.82, 0.3], r: [0.74, 0.56, 0.95], len: 0.5, rows: 4, across: 7 },
  feather: 0.34,
  mantle: { from: -1.9, to: 1.3, wide: 1.0, deep: 0.3, rows: 5, leaves: 9, leaf: 0.62 },
  pods: [
    { y: -0.92, th: -1.3, r: [0.5, 0.62, 0.6], out: 0.02 }, { y: 0.42, th: -1.32, r: [0.5, 0.6, 0.58], out: 0.02 },
    { y: -0.92, th: 1.3, r: [0.5, 0.62, 0.6], out: 0.02 }, { y: 0.42, th: 1.32, r: [0.5, 0.6, 0.58], out: 0.02 },
  ],
  nets: false,
  cage: { arches: 3, high: 0.55, w: 1.55 },
  armour: true,
  gait: { duty: [0.66, 0.32], swing: [0.26, 0.36], step: 0.18, bob: 0.05, flex: 7 },
  size: 3.2,
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
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];

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
/** A point on the back, `y` along it and `a` round from the top toward its right (radians). */
const onBack = (R: Rings, y: number, a: number): { p: V3; n: V3 } => onRings(R, y, Math.PI / 2 - a);

/** The rings drawn through smoothly, `k` to every span between two, so the barrel's sides curve along it and not in facets. */
function smoothRings(R: Rings, k: number): Rings {
  const out: Rings = { y: [], z: [], w: [], h: [] }, n = R.y.length;
  const cr = (a: number[], i: number, t: number): number => {
    const p0 = a[Math.max(0, i - 1)], p1 = a[i], p2 = a[i + 1], p3 = a[Math.min(n - 1, i + 2)];
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  };
  for (let i = 0; i < n - 1; i++) for (let q = 0; q < k; q++) {
    const t = q / k;
    out.y.push(cr(R.y, i, t)); out.z.push(cr(R.z, i, t)); out.w.push(Math.max(0.05, cr(R.w, i, t))); out.h.push(Math.max(0.05, cr(R.h, i, t)));
  }
  out.y.push(R.y[n - 1]); out.z.push(R.z[n - 1]); out.w.push(R.w[n - 1]); out.h.push(R.h[n - 1]);
  return out;
}

/** The barrel's width, depth and height of its middle line at `y`. */
function ringAt(R: Rings, y: number): { w: number; h: number; z: number } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}

/** A frame standing along `up` with its across along `side`, as near as it can be: across, forward and up. */
function sideFrame(up: V3, side: V3): [V3, V3, V3] {
  const Z = unit(up);
  let X = sub(side, scale(Z, dot(side, Z)));
  if (Math.hypot(X[0], X[1], X[2]) < 1e-4) X = [1, 0, 0];
  X = unit(X);
  return [X, cross(Z, X), Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };

/**
 * A lock of fur: a small blade from `root` out along `dir`, `len` long and `w` wide at its root, drawn to a point, lying flat to
 * `up` and curving out of it a little. Open at both ends, its root buried in what it grows from.
 */
function lock(root: V3, dir: V3, len: number, w: number, mat: Mat, up: V3, curl = 0.18): Mesh {
  const d = unit(dir), u = unit(up);
  const at = (k: number): V3 => add(root, add(scale(d, len * k), scale(u, len * curl * k * k)));
  return tube([root, at(0.55), at(1)], [w, w * 0.75, 0.006], [w * 0.55, w * 0.4, 0.004], 3, mat, { up: u, start: false, end: false });
}

/** A flat painted shape through `pts`, wound so it faces along `n`. */
function facing(pts: V3[], n: V3, m: Mat): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m };
}

const onEgg2 = (c: V3, r: V3, dir: V3): { p: V3; n: V3 } => {
  const d = unit(dir), k = 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);
  const p = add(c, scale(d, k));
  return { p, n: unit([(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]) };
};

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When its kick lands, as a share of the strike, at each stage. */
export const PACK_HITS: readonly number[] = [0.48, 0.5, 0.54];

/* ---- where its feet go ---------------------------------------------------------------- */

/** A pose: where each paw is, how far its last part is folded, and how the rest is carried. */
interface Plan {
  at: V3[];
  rake: number[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The neck bent forward and turned left; the head pitched nose-up, turned left and tilted. */
  neck: [number, number]; head: [number, number, number];
  /** Each ear, the left and the right, laid back past how it is carried and splayed out past it (degrees). */
  ears: [[number, number], [number, number]];
  earTurn: number;
  /** The crest laid back past how it stands, and swayed to the left. */
  crest: [number, number];
  /** The pods swung forward and out, as a share of a swing. */
  pods: [number, number];
}

interface Rest { hip: V3[]; paw: V3[]; reach: number[] }

const rests = new Map<Pack, Rest>();
function restOf(s: Pack): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], paw: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    hip.push([SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop]);
    paw.push([SIDE[i] * r.w * s.hip * 0.95, y - s.stance[fore ? 0 : 1], s.paw]);
    reach.push(L[0] + L[1] + L[2]);
  }
  const R = { hip, paw, reach };
  rests.set(s, R);
  return R;
}

function restPlan(s: Pack, R: Rest): Plan {
  return {
    at: R.paw.map((a) => [...a] as V3), rake: [0, 0, 0, 0], foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], ears: [[0, 0], [0, 0]], earTurn: 0, crest: [0, 0], pods: [0, 0],
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), rake: a.rake.map((x, i) => m(x, b.rake[i])), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    ears: [[m(a.ears[0][0], b.ears[0][0]), m(a.ears[0][1], b.ears[0][1])], [m(a.ears[1][0], b.ears[1][0]), m(a.ears[1][1], b.ears[1][1])]], earTurn: m(a.earTurn, b.earTurn),
    crest: [m(a.crest[0], b.crest[0]), m(a.crest[1], b.crest[1])], pods: [m(a.pods[0], b.pods[0]), m(a.pods[1], b.pods[1])],
  };
}

/** `p` moved by as much as `to` is from `from`, every number of it. */
function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  return {
    at: p.at.map((x, i) => [d(x[0], to.at[i][0], from.at[i][0]), d(x[1], to.at[i][1], from.at[i][1]), d(x[2], to.at[i][2], from.at[i][2])] as V3),
    rake: p.rake.map((x, i) => d(x, to.rake[i], from.rake[i])), foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    neck: [d(p.neck[0], to.neck[0], from.neck[0]), d(p.neck[1], to.neck[1], from.neck[1])],
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    ears: [[d(p.ears[0][0], to.ears[0][0], from.ears[0][0]), d(p.ears[0][1], to.ears[0][1], from.ears[0][1])],
      [d(p.ears[1][0], to.ears[1][0], from.ears[1][0]), d(p.ears[1][1], to.ears[1][1], from.ears[1][1])]],
    earTurn: d(p.earTurn, to.earTurn, from.earTurn),
    crest: [d(p.crest[0], to.crest[0], from.crest[0]), d(p.crest[1], to.crest[1], from.crest[1])],
    pods: [d(p.pods[0], to.pods[0], from.pods[0]), d(p.pods[1], to.pods[1], from.pods[1])],
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}

/** When each foot comes down in a stride: at a walk one side and then the other; at a run in bounds, hind and then fore. */
const WALK_DOWN = [0.25, 0.75, 0, 0.5];
const RUN_DOWN = [0.42, 0.5, 0, 0.08];
const EDGE = 0.1;

/** How far its back is drawn up this moment at either end of it, at a run. */
function flexOf(s: Pack, a: Anim): number {
  if (a.act || a.go <= 0) return 0;
  return smooth(Math.min(1, a.go)) * a.gait * s.gait.flex * Math.cos(TAU * (frac(a.u) - 0.87));
}
const flexAt = (s: Pack, y: number, deg: number): number => -deg * clamp(y / s.body.y[s.body.y.length - 1], -1, 1);
function flexPt(s: Pack, p: V3, deg: number): V3 {
  if (!deg) return p;
  const a = flexAt(s, p[1], deg) * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [p[0], p[1] * c - p[2] * sn, p[1] * sn + p[2] * c];
}

/**
 * Going. At a walk, each foot down for its share of a stride and swept back under the body at the ground's own speed, then
 * lifted and brought forward folded; the body sinking a little at each footfall, the head nodding, the ears and the crest
 * swaying a beat behind and the pods swinging with the stride. At a run, a bound.
 */
function goingPlan(s: Pack, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, L = R.reach[i], half = amp * (R.reach[0] + R.reach[2]) / 2, A = R.paw[i];
    const ph = frac(a.u - lerp(WALK_DOWN[i], RUN_DOWN[i], g));
    if (ph < duty) {
      const k = ph / duty;
      p.at[i] = [A[0], A[1] + half * (1 - 2 * k), A[2]];
      const off = ramp(k, 0.55, 1);
      p.rake[i] = -(fore ? lerp(22, 45, g) : lerp(30, 55, g)) * off;
      p.foot[i] = p.rake[i];
      continue;
    }
    const E = lerp(EDGE, 0.2, g), u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * E, y1 = A[1] + half + v * E;
    const y = u < E ? A[1] - half - v * u : u > 1 - E ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * E), -v * (1 - 2 * E), (u - E) / (1 - 2 * E));
    const lift = G.step * L * (1 + 0.3 * g) * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0], y, A[2] + lift];
    if (fore) {
      p.rake[i] = -lerp(70, 100, g) * Math.sin(Math.PI * clamp(u / 0.78)) + 8 * hump(u, 0.92, 0.1);
      p.foot[i] = p.rake[i] * 0.85;
    } else {
      p.rake[i] = -lerp(35, 46, g) * Math.sin(Math.PI * clamp(u / 0.45)) + lerp(18, 28, g) * Math.sin(Math.PI * clamp((u - 0.35) / 0.65));
      p.foot[i] = p.rake[i] * 0.7;
    }
  }
  const walkBob = -G.bob * s.len * (0.5 + 0.5 * Math.cos(4 * TAU * (w - 0.05)));
  const bound = 0.05 * s.len * Math.cos(2 * TAU * (w - 0.37)) - 0.06 * s.len;
  p.H += lerp(walkBob, bound, g);
  p.pitch = g * 5 * Math.sin(TAU * (w - 0.12)) + (1 - g) * 1.2 * Math.sin(2 * TAU * w);
  p.roll = (1 - g) * 1.8 * Math.sin(TAU * (w - 0.1));
  p.neck[0] = g * (22 + 6 * Math.sin(TAU * (w - 0.6)));
  p.head[0] = (1 - g) * 4 * Math.cos(2 * TAU * (w - 0.15)) - g * (8 + 5 * Math.sin(TAU * (w - 0.12)));
  p.head[1] = (1 - g) * 3 * Math.sin(TAU * w);
  const sway = (1 - g) * 6 * Math.sin(2 * TAU * (w - 0.3)), flut = g * 8 * Math.sin(TAU * (w - 0.25));
  p.ears = [[g * 30 + sway + flut, (1 - g) * 3 * Math.sin(TAU * w) - 8 * g], [g * 30 + sway * 0.8 + flut, -(1 - g) * 3 * Math.sin(TAU * w) - 8 * g]];
  p.earTurn = -20 * g;
  p.crest = [g * 18 + 5 * Math.sin(2 * TAU * (w - 0.35)), 4 * (1 - g) * Math.sin(TAU * (w - 0.3))];
  // The pods swinging out and forward with each step, a beat behind it.
  p.pods = [Math.sin(2 * TAU * (w - 0.2)) * (0.6 + 0.6 * g), Math.sin(TAU * (w - 0.25))];
  return p;
}

/** Standing about: breathing, looking round, an ear flicked now and then, the crest stirring, now and then a long look about. */
function stillPlan(s: Pack, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [2 * Math.abs(a.breath - 0.5), 12 * look];
  p.head = [-2 * Math.abs(cyc(t, 5)), 8 * look, 4 * drift(t, 2)];
  p.H += 0.01 * s.len * (a.breath - 0.5);
  const flickL = beat(t, [3.1, 15.7], 0.5), flickR = beat(t, [3.4, 9.6, 20.2], 0.5);
  // The ears only ever laid back from how they stand at the start of the loop, never more upright, so they never come up into
  // the name and the health bar over it (`wildermonTop`, measured standing there).
  const back = 3 * (1 - Math.cos((TAU * 3 * t) / 24));
  p.ears = [[back + 26 * flickL, 4 * cyc(t, 4) - 8 * flickL], [back * 0.7 + 26 * flickR, -4 * cyc(t, 4, 1) - 8 * flickR]];
  p.crest = [2 * (1 - Math.cos((TAU * 2 * t) / 24)) + 6 * (flickL + flickR), 3 * cyc(t, 3)];
  const up = beat(t, [6.2, 18.8], 2.2);
  p.head[1] += 10 * up;
  p.earTurn = -14 * up;
  p.pods = [0.15 * cyc(t, 2), 0.1 * cyc(t, 3)];
  return p;
}

/** The body pitched nose-up by `deg` about its hips or nose-down about its shoulders, `at` along it, so they stay where they stood. */
function pivot(s: Pack, p: Plan, deg: number, at: number): void {
  const r = ringAt(s.body, at), z0 = r.z - r.h * s.drop, a = deg * DEG;
  const y1 = at * Math.cos(a) - z0 * Math.sin(a), z1 = at * Math.sin(a) + z0 * Math.cos(a);
  p.pitch += deg;
  p.surge += at - y1;
  p.H += z0 - z1;
}

/** Struck at, it kicks: its weight thrown onto its fore feet, its haunches up, both hind feet driven out behind, and back. */
function kick(s: Pack, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = PACK_HITS[s.stage];
  const set = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.6, 0.92));
  const out = ramp(t, 0.34, hit) * (1 - ramp(t, hit + 0.08, 0.8));
  pivot(s, p, -5 * set - 11 * out, s.len * 0.5);
  p.H -= 0.03 * s.len * set;
  p.neck = [12 * set, 0];
  p.head = [6 * set - 10 * out, 0, 0];
  p.ears = [[16 * set + 14 * out, 0], [16 * set + 14 * out, 0]];
  p.crest = [20 * out, 0];
  for (const i of [2, 3]) {
    const A = R.paw[i], L = R.reach[i];
    const bunch: V3 = [A[0], A[1] + L * 0.18, A[2]];
    const kicked: V3 = [A[0] * 1.1, A[1] - L * 0.9, A[2] + L * 0.55];
    const k1 = ramp(t, 0.12, 0.32) * (1 - ramp(t, 0.34, 0.4));
    let at = mixV(A, bunch, k1);
    if (t > 0.34) at = mixV(t < hit + 0.08 ? bunch : A, kicked, out);
    if (t > hit + 0.08) at = mixV(kicked, A, ramp(t, 0.66, 0.9));
    p.at[i] = at;
    p.rake[i] = -50 * out;
    p.foot[i] = -50 * out;
  }
  // The pods thrown forward by the kick and swinging back.
  p.pods = [-0.9 * out + 0.6 * hump(t, hit + 0.18, 0.12), 0];
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its ears pricked, a shake, and settled. */
function evolvePlan(s: Pack, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * 58);
  p.H += s.len * (-0.03 * hunch + 0.02 * up);
  p.pitch = -3 * hunch + 4 * up;
  p.neck = [16 * hunch - 12 * up, 0];
  p.head = [-12 * hunch + 12 * up, 0, 10 * shake];
  p.ears = [[36 * hunch - 12 * up + 18 * Math.abs(shake), 10 * shake], [36 * hunch - 12 * up + 18 * Math.abs(shake), -10 * shake]];
  p.crest = [28 * hunch - 18 * up, 10 * shake];
  p.roll = 3 * shake;
  p.squash = 0.05 * hump(t, 0.7, 0.05);
  p.pods = [0.8 * shake, 0.5 * shake];
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Pack, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(kick(s, R, a, act.t));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, a, act.t));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** A leg bent to put its paw at `paw`, the elbow behind on a fore leg and the stifle forward on a hind. */
function legOf(s: Pack, body: Xf, i: number, rootLocal: V3, paw: V3, rake: number, foot: number): Xf[] {
  const fore = i < 2, L = fore ? s.fore : s.hind, l0 = L[0], l1 = L[1];
  const root = place(body, rootLocal), f0 = turn(body, [0, 1, 0]), fwd = unit([f0[0], f0[1], 0]);
  const r0 = fore ? s.rake[0] : s.rake[1], r = (r0 + rake) * DEG;
  const ankle = add(paw, add(scale(fwd, -Math.sin(r) * L[2]), [0, 0, Math.cos(r) * L[2]]));
  let d = sub(ankle, root);
  const D = len3(d), most = (l0 + l1) * 0.995, least = Math.abs(l0 - l1) + 0.1 * (l0 + l1);
  const Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const at = add(root, scale(d, Dc));
  const out = turn(body, [SIDE[i], 0, 0]);
  const hint = add(add(scale(fwd, fore ? -1 : 1), scale(out, 0.08)), [0, 0, -0.35 - 2.5 * Math.max(0, d[2])]);
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(root, scale(d, along)), scale(v, h));
  const pawAt = add(paw, sub(at, ankle));
  const across = turn(body, [1, 0, 0]);
  const [X0, Y0, Z0] = sideFrame(sub(root, knee), across), [X1, Y1, Z1] = sideFrame(sub(knee, at), across), [X3, Y3, Z3] = sideFrame(sub(at, pawAt), across);
  const cannon = xfOf(X3, Y3, Z3, at);
  const pw = joint(xfOf(X3, Y3, Z3, pawAt), [0, 0, 0], -(r0 + rake) + foot);
  return [xfOf(X0, Y0, Z0, root), xfOf(X1, Y1, Z1, knee), pw, cannon];
}

const skullAt = (s: Pack): V3 => [0, 0, s.head.up];
const snoutAt = (s: Pack): V3 => { const H = s.head; return [0, H.r[1] * 0.62 + H.snout[2] * 0.42, H.up - H.r[2] * 0.42]; };
const earRoot = (s: Pack, side: number): V3 => [side * s.ear.at[0], s.ear.at[1], s.head.up + s.ear.at[2]];
/** Where the crest springs from on the skull: the crown, between the ears. */
const crestRoot = (s: Pack): V3 => [0, s.ear.at[1] * 0.5 + s.head.r[1] * 0.05, s.head.up + s.head.r[2] * 0.88];
/** Where a pod sits on the barrel, and the way out of it there. */
const podOn = (s: Pack, P: Pod): { p: V3; n: V3 } => {
  const e = onBack(s.body, P.y, P.th);
  return { p: add(e.p, scale(e.n, P.out + P.r[0] * 0.55)), n: e.n };
};

/** The bones of a stage: its pose, every leg bent to put its paw where the pose says, the neck, head, ears and crest, and each pod. */
function packBones(s: Pack): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, flex: number): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.neck.lean + P.neck[0];
    const nf = flexAt(s, s.neck.at[1], flex);
    b.neck = joint(body, flexPt(s, s.neck.at, flex), -lean + nf, 0, P.neck[1]);
    b.head = joint(b.neck, neckEnd(s, 1), lean + s.head.pitch + P.head[0] - nf * 0.5, P.head[2], P.head[1]);
    const E = s.ear;
    for (const k of [0, 1]) {
      const side = k ? 1 : -1, e = P.ears[k];
      // Swung back (`e[0]`) and out (`e[1]`) from how it hangs, a little each, and swung with the head's turn.
      const swing = (v: V3): V3 => {
        const a = (e[0] * 0.5) * DEG, o = (e[1] * 0.5 + P.earTurn * 0.2) * DEG;
        const v1: V3 = [v[0], v[1] * Math.cos(a) + v[2] * Math.sin(a), -v[1] * Math.sin(a) + v[2] * Math.cos(a)];
        return [v1[0] * Math.cos(o) + side * v1[2] * Math.sin(o), v1[1], -side * v1[0] * Math.sin(o) + v1[2] * Math.cos(o)];
      };
      const Z = unit(turn(b.head, swing([side * E.hang[0], E.hang[1], E.hang[2]])));
      const h = turn(b.head, [side * E.hollow[0], E.hollow[1], E.hollow[2]]);
      const Y = unit(sub(h, scale(Z, dot(h, Z))));
      b[`ear${k}`] = xfOf(cross(Y, Z), Y, Z, place(b.head, earRoot(s, side)));
    }
    b.crest = joint(b.head, crestRoot(s), -(s.crest.back + P.crest[0]), 0, P.crest[1]);
    // Each pod hung where it rides, swung forward and out with the stride about the top of it.
    s.pods.forEach((pod, q) => {
      const at = podOn(s, pod), sd = pod.th < 0 ? -1 : 1;
      const swing = P.pods[0] * (0.8 + 0.4 * jitter(q + 3)) * (pod.th < 0 ? 1 : 0.85), out = Math.abs(P.pods[1]) * 0.6;
      b[`pod${q}`] = joint(b.trunk, flexPt(s, at.p, flex), swing * 7, sd * out * 6, 0);
    });
    for (let i = 0; i < 4; i++) {
      const fore = i < 2, h = R.hip[i];
      const slide = fore ? clamp((P.at[i][1] - R.paw[i][1]) * 0.15, -0.12 * s.len, 0.12 * s.len) : 0;
      const g = P.at[i];
      const [u, l, f, c] = legOf(s, body, i, flexPt(s, [h[0], h[1] + slide, h[2]], flex), [g[0], g[1], Math.max(g[2], s.paw * 0.9)], P.rake[i], P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
      b[`${LEGS4[i]}3`] = c;
    }
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high));
    return b;
  };
  return (a) => pose(planOf(s, R, { ...a, go: a.act ? 0 : a.go }), flexOf(s, a));
}

/* ---- what it is made of ------------------------------------------------------------------------- */

/** The barrel: brown over its back and flanks, cream under its belly. */
function barrelOf(s: Pack, n: number): Mesh {
  // Rounded off at the rump and the chest: a ring a third the size a little past each end, so neither end is a flat cap.
  const B = s.body, last = B.y.length - 1, d = 0.1 * s.len;
  const F = smoothRings({
    y: [B.y[0] - d, ...B.y, B.y[last] + d], z: [B.z[0], ...B.z, B.z[last]],
    w: [B.w[0] * 0.35, ...B.w, B.w[last] * 0.35], h: [B.h[0] * 0.35, ...B.h, B.h[last] * 0.35],
  }, 3);
  return tube(F.y.map((y, q) => [0, y, F.z[q]] as V3), F.w, F.h, n, (_ring, j) => (under(n, j, 0.9) ? 'belly' : 'coat'));
}

/** The ruff: a mass of cream locks over the front of its chest and up round the root of its neck, the lowest the longest. */
function ruffOf(s: Pack, n: number): Mesh {
  const F = s.ruff, out: Mesh[] = [orb(F.c, F.r, n, Math.max(4, n - 3), 'belly')];
  for (let row = 0; row < F.rows; row++) {
    const v = row / Math.max(1, F.rows - 1), el = lerp(s.stage ? 0.85 : 0.5, -0.85, v);
    const count = F.across + (row % 2);
    for (let q = 0; q < count; q++) {
      const az = lerp(-1.3, 1.3, (q + 0.5 * (row % 2)) / Math.max(1, count - 1 + (row % 2)));
      const dir: V3 = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
      const e = onEgg2(F.c, F.r, dir), id = row * 31 + q;
      const L = F.len * (0.7 + 0.5 * v) * (0.85 + 0.3 * jitter(id));
      const way = unit(add(scale(e.n, 0.45), [0, 0.02, -1]));
      out.push(lock(sub(e.p, scale(e.n, 0.06)), way, L, L * 0.8, 'belly', e.n, 0.05));
    }
  }
  return merge(...out);
}

/** The neck: brown behind, cream down its throat. */
function neckOf(s: Pack, n: number): Mesh {
  const N = s.neck, L = N.len;
  // Its tube runs up, so a facet's middle angle is round from its right: forward is the quarter round toward `+y`.
  const front = (_ring: number, j: number): Mat => (Math.sin(((j + 1) / n) * TAU) > 0.1 ? 'belly' : 'coat');
  return tube([[0, 0, -0.3], [0, -0.03 * L, L * 0.4], neckEnd(s, 0.75), neckEnd(s, 1.04)], [N.w * 1.12, N.w, N.w * 0.92, N.w * 0.86], [N.w * 1.2, N.w * 1.04, N.w * 0.94, N.w * 0.88], n, front, { seam: 'both' });
}
const neckEnd = (s: Pack, k: number): V3 => { const L = s.neck.len, u = clamp((k - 0.45) / 0.55); return [0, L * 0.22 * u * u, L * k]; };

/** Cream locks down the front and sides of its neck, carrying the ruff up to the jaw; on the Cargocrest a great fall of them. */
function neckFurOf(s: Pack): Mesh {
  const N = s.neck, out: Mesh[] = [];
  const rows = s.stage === 2 ? 4 : 2;
  for (let row = 0; row < rows; row++) {
    const z = lerp(N.len * (s.stage ? 0.85 : 0.8), N.len * 0.05, row / Math.max(1, rows - 1));
    for (let q = 0; q < 6; q++) {
      const a = lerp(-1.4, 1.4, (q + 0.5 * (row % 2)) / 5.5), id = 300 + row * 11 + q;
      const nrm: V3 = [Math.sin(a), Math.cos(a), 0];
      const root: V3 = add(neckEnd(s, z / N.len), [nrm[0] * N.w * 0.9, nrm[1] * N.w * 0.95, 0]);
      const L = s.ruff.len * (0.6 + 0.4 * row / rows) * (0.85 + 0.3 * jitter(id));
      out.push(lock(sub(root, scale(nrm, 0.03)), add(scale(nrm, 0.8), [0, 0, -0.8]), L * 1.2, L * 0.8, 'belly', nrm, 0.1));
    }
  }
  return merge(...out);
}

/**
 * The head: a hare's, its crown and the bridge of its nose brown, its muzzle, cheeks and chin cream, a small dark nose and a
 * quiet smile; amber eyes; and fluffy cream cheeks standing out back past the jaw.
 */
function headOf(s: Pack, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), sn = H.snout, mc = snoutAt(s), mr: V3 = [sn[0], sn[2], sn[1]];
  // The skull brown over its crown and cream under its eyes, as the reference's face is: the line runs from the nose up past the eye.
  const sk = orb(C, H.r, n + 2, k + 2, 'coat');
  const skull = mesh(sk.v, sk.f.map((f) => {
    const m = f.i.reduce((acc, i) => add(acc, sk.v[i]), [0, 0, 0] as V3);
    const c = scale(m, 1 / f.i.length), d = sub(c, C);
    // Cream below a line that dips from the back of the head down under the eye and rises again over the muzzle.
    const cream = d[2] / H.r[2] < -0.05 + 0.35 * (d[1] / H.r[1]) - 0.25 * Math.abs(d[0] / H.r[0]);
    return { ...f, m: cream ? 'muzzle' : 'coat' as Mat };
  }));
  const muzzle = orb(mc, mr, n, k + 1, 'muzzle');
  const nt = onEgg2(mc, mr, [0, 0.8, 0.55]);
  const nose = paint([disc(add(nt.p, scale(nt.n, 0.012)), nt.n, sn[0] * 0.5, sn[0] * 0.34, 3, 'nose', { up: [0, 0, 1], spin: Math.PI / 2 })]);
  const mouth = smile(onEgg2(mc, mr, [0, 0.9, -0.32]).p, [0, 1, -0.35], sn[0] * 0.7, 'lid');
  const eye = eyes(C, H.r, s.eye.dir, s.eye.size, { tall: 1.15, iris: 'crystal', pupil: 0.5, glint: 0.34, shut });
  // The cheek fluff: a few cream locks off each cheek, swept back and down past the jaw.
  const cheeks: Mesh[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < 4; q++) {
      const e = onEgg2(C, H.r, [sd * 0.9, 0.05 - q * 0.18, -0.35 - q * 0.08]);
      const L = H.r[0] * (0.42 + 0.12 * (q % 2)) * (1 + 0.25 * s.stage);
      cheeks.push(lock(sub(e.p, scale(e.n, 0.04)), add(scale(e.n, 0.75), [0, -0.55, -0.35]), L, L * 0.6, 'belly', e.n, 0.1));
    }
  }
  return merge(skull, muzzle, nose, mouth, eye, ...cheeks);
}

/** Solids inside the head that hide what is round the far side of them: the skull and the muzzle. */
function headSolids(s: Pack): Array<{ c: V3; r: V3 }> {
  const H = s.head, sn = H.snout;
  return [{ c: skullAt(s), r: scale(H.r, 0.92) }, { c: snoutAt(s), r: [sn[0] * 0.85, sn[2] * 0.85, sn[1] * 0.85] }];
}

/**
 * A drooping ear: long and broad, pointed, hanging out and down beside its head; cream, brown at its root and its tip, a
 * cream-pink lining. Up its own `z` from its root, its hollow toward `+y`.
 */
function earOf(s: Pack, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  const zs = [0, 0.12, 0.34, 0.58, 0.8, 0.94, 1].map((x) => x * L);
  const ws = [0.5, 0.88, 1, 0.96, 0.78, 0.46, 0.02].map((x) => x * w);
  const line = zs.map((z, q) => [0, -0.05 * Math.sin((q / 6) * Math.PI) * L * 0.2, z] as V3);
  const cup = (p: V3): V3 => [p[0], p[1] + 0.2 * w * Math.min(1, (p[0] / w) ** 2), p[2]];
  const shell = tube(line, ws, ws.map((x) => Math.max(0.025, x * 0.13)), Math.max(6, n), (ring) => (ring <= 1 ? 'coat' : ring >= 5 ? 'coatDark' : 'belly'), { up: [0, 1, 0] });
  const cupped = mesh(shell.v.map(cup), shell.f);
  const rim = (sd: number, k: number): V3[] => [1, 2, 3, 4].map((q) => cup([sd * ws[q] * k, line[q][1] + ws[q] * 0.22 + 0.014, zs[q]]));
  const lining: V3[] = [cup([0, line[0][1] + ws[0] * 0.22 + 0.014, zs[0] + L * 0.06]), ...rim(-1, 0.7), cup([0, line[5][1] + 0.02, L * 0.84]), ...rim(1, 0.7).reverse()];
  // A brown patch on its back near the root, as the sheet's ears have.
  const patch = paint([1, 2].map((q) => disc([0, line[q][1] - ws[q] * 0.22 - 0.012, zs[q]], [0, -1, 0], ws[q] * 0.6, L * 0.12, 7, 'coat', { up: [0, 0, 1] })));
  return merge(cupped, patch, paint([facing(lining, [0, 1, 0], 'inner')]));
}
/**
 * A leaf: a blade from `root` along `dir`, its tip swept along `back`, `L` long and `W` wide at its widest; green with a cream
 * rib, or cream at its root and green above it, its face turned toward `face`.
 */
function leafOf(root: V3, dir: V3, back: V3, face: V3, L: number, W: number, mat: Mat, rib: Mat, base?: Mat, sweep = 0.5, tip?: Mat): Mesh {
  const d = unit(dir), bk = unit(back);
  const N = 6;
  const pts: V3[] = [], ws: number[] = [];
  for (let q = 0; q <= N; q++) {
    const k = q / N;
    pts.push(add(add(root, scale(d, L * k)), scale(bk, L * sweep * k ** 2.2)));
    ws.push(q === N ? 0.004 : W * Math.sin(Math.PI * Math.min(1, 0.1 + k * 0.9)) ** 0.7 * (1 - 0.15 * k));
  }
  const o = { rib, fold: 0.22, thick: 0.012 };
  const from = base ? 2 : 0, to = tip ? 5 : N;
  return merge(base && blade(pts.slice(0, 3), ws.slice(0, 3), face, { ...o, mat: base }),
    blade(pts.slice(from, to + 1), ws.slice(from, to + 1), face, { ...o, mat }),
    tip && blade(pts.slice(to), ws.slice(to), face, { ...o, mat: tip }));
}

/**
 * The crest: a fan of long leaves off its crown, the middle ones cream with a pale rib and the outer green with cream at
 * their roots, swept up and back; and either side of it a tall pointed ear, brown with a cream inside and a dark tip.
 */
function crestOf(s: Pack): Mesh {
  const C = s.crest, out: Mesh[] = [];
  for (let q = 0; q < C.n; q++) {
    const k = C.n > 1 ? q / (C.n - 1) - 0.5 : 0, mid = Math.abs(k) < 0.2;
    const fan = k * 1.25;
    const dir = unit([Math.sin(fan) * 0.75, -0.1 - 0.3 * Math.abs(k), Math.cos(fan)]);
    const L = C.len * (1 - 0.5 * Math.abs(k)) * (0.9 + 0.2 * jitter(q + 40));
    const face = unit([Math.sin(fan) * 0.4, 1, 0.15]);
    const centre = q === (C.n - 1) / 2;
    out.push(leafOf([k * 0.06, 0, 0], dir, [0, -1, 0.15], face, L, C.w * (mid ? 1.2 : 1.05), centre ? 'petal' : 'leaf', centre ? 'horn' : 'leafDark', 'petal', 0.42, centre ? undefined : 'bloom'));
  }
  // The two upright ears, standing out of the crest's sides.
  for (const sd of [1, -1]) {
    const root: V3 = [sd * C.w * 1.3, C.w * 0.4, -C.w * 0.4];
    const dir = unit([sd * 0.32, -0.2, 1]);
    const L = C.len * 0.92;
    out.push(leafOf(root, dir, [0, -1, 0.1], unit([sd * 0.25, 1, 0.1]), L, C.w * 1.35, 'coat', 'belly', 'coat', 0.3));
    // Its cream inside: a narrower blade a hair in front, and the dark tip over it.
    out.push(leafOf(add(root, [0, 0.03, 0.02]), dir, [0, -1, 0.1], unit([sd * 0.25, 1, 0.1]), L * 0.78, C.w * 0.7, 'belly', 'muzzle', 'belly', 0.3));
  }
  return merge(...out);
}
/**
 * A clump of moss: a low lumpy cushion, bright on top and darker round its foot, ringed with soft fronds lying out over the
 * back around it, a bright tip on each. Soft clustered shapes rather than straw.
 */
function clumpOf(c: V3, n: V3, R: number, id: number, fronds: number): Mesh {
  const z = unit(n);
  let x = cross([0, 1, 0], z);
  if (len3(x) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const b = orbAlong([0, 0, 0], z, [R * 0.9, R * 0.82, R * 0.5], 7, 4, 'moss');
  const out: Mesh[] = [mesh(b.v.map((p, i) => add(c, scale(p, 0.86 + 0.26 * jitter(id * 31 + i))) as V3), b.f)];
  // A bright cap on its top, a smaller cushion of the young growth.
  out.push(orbAlong(add(c, scale(z, R * 0.28)), z, [R * 0.5, R * 0.46, R * 0.3], 6, 3, 'leaf'));
  for (let q = 0; q < fronds; q++) {
    const a = (q / fronds) * TAU + jitter(id + q) * 0.9;
    const o = add(scale(x, Math.cos(a)), scale(y, Math.sin(a)));
    const lean = lerp(1.1, 1.45, jitter(id * 5 + q));
    const d = unit(add(scale(z, Math.cos(lean)), scale(o, Math.sin(lean))));
    const face = unit(sub(z, scale(d, dot(z, d))));
    const root = add(c, scale(o, R * 0.45));
    out.push(blade([root, add(root, scale(d, R * 0.35)), add(root, scale(d, R * 0.6))], [R * 0.32, R * 0.3, R * 0.12], len3(face) > 1e-3 ? face : z,
      { mat: jitter(id * 11 + q) < 0.5 ? 'leaf' : 'bloom', rib: 'leafDark', fold: 0.2, thick: 0.01 }));
  }
  return merge(...out);
}

/**
 * The mantle: broad leaves laid over its back in overlapping rows like a bird's feathers, rump to withers, each pointing back
 * and down, dark green with a pale rib and a bright tip; soft moss cushions along its top; and a fall of longer leaves over
 * its rump.
 */
function mantleOf(s: Pack): Mesh {
  const B = s.body, M = s.mantle, out: Mesh[] = [];
  const rows = M.rows + 2;
  for (let row = 0; row < rows; row++) {
    // Front rows first and the back rows over them, as feathers lie: each row's roots ahead of the tips of the row behind.
    const k = rows > 1 ? row / (rows - 1) : 0.5;
    const y = lerp(M.to, M.from + 0.25, k);
    const across = 5;
    for (let q = 0; q < across; q++) {
      const id = 90 + row * 17 + q;
      const a = lerp(-1, 1, q / (across - 1)) * M.wide * (0.9 + 0.08 * jitter(id));
      const e = onBack(B, y, a);
      // Back along the body and down the slope of its back there, lying flat on it.
      const down: V3 = unit(add([0, -1, 0], scale(sub(e.n, [0, 0, 1]), 0.6)));
      const dir = unit(sub(down, scale(e.n, dot(down, e.n) - 0.08)));
      const L = M.leaf * (0.9 + 0.25 * jitter(id + 1)) * (1 - 0.3 * Math.abs(a) / M.wide);
      const mat: Mat = jitter(id + 2) < 0.22 ? 'coat' : jitter(id + 2) < 0.55 ? 'leafDark' : 'leaf';
      // Raised over the middle of its back and lower toward the edges and the ends, a hump of leaves.
      const hump = M.deep * 0.7 * Math.sin(Math.PI * clamp(k * 0.9 + 0.05)) * (1 - Math.abs(a) / (M.wide * 1.1));
      out.push(leafOf(add(e.p, scale(e.n, 0.02 + 0.012 * row + hump)), dir, scale(e.n, -0.25), e.n, L * 1.15, L * 0.62, mat, 'leafDark', undefined, 0.18,
        (row + q) % 2 === 0 ? 'bloom' : undefined));
    }
  }
  // The moss along its spine: a row of soft cushions.
  const cushions = Math.round(4 + 2 * s.stage);
  for (let q = 0; q < cushions; q++) {
    const k = q / Math.max(1, cushions - 1), id = 60 + q;
    const y = lerp(M.from + 0.3, M.to - 0.1, k), swell = Math.sin(Math.PI * lerp(0.15, 0.85, k));
    for (const a of s.stage ? [-0.45, 0, 0.45] : [-0.3, 0.3]) {
      const e = onBack(B, y, a + (jitter(id) - 0.5) * 0.15);
      const R = M.deep * (0.8 + 0.5 * swell) * (a ? 0.85 : 1);
      out.push(clumpOf(add(e.p, scale(e.n, 0.03 + 0.015 * rows + M.deep * 0.45 * swell)), e.n, R * 1.15, id * 3 + Math.round(a * 4), 5));
    }
  }
  // The rump's fall: leaves fanned out back and down over its tail.
  const tail = Math.round(5 + 2 * s.stage);
  for (let q = 0; q < tail; q++) {
    const a = lerp(-1.0, 1.0, tail > 1 ? q / (tail - 1) : 0.5), id = 260 + q;
    const e = onBack(B, M.from + 0.12, a * 0.85);
    const dir = unit([Math.sin(a) * 0.55, -1, 0.1 - 0.75 * Math.abs(a)]);
    const L = M.leaf * 1.3 * (0.85 + 0.3 * jitter(id)) * (1 - 0.2 * Math.abs(a));
    out.push(leafOf(add(e.p, scale(e.n, 0.04)), dir, [0, -0.2, -1], unit([Math.sin(a) * 0.7, 0, 1]), L, L * 0.36, q % 2 ? 'leaf' : 'leafDark', 'leafDark', undefined, 0.35));
  }
  return merge(...out);
}
/**
 * A pod: a big pale pearly egg, its surface crazed with fine gold lines and a soft shine on its upper side, in the pod's own
 * frame (`+x` out from the flank, `+y` forward, `+z` up).
 */
function podOf(P: Pod, sd: number, n: number, k: number): Mesh {
  const r = P.r, egg = orb([0, 0, 0], [r[0], r[1], r[2]], n + 2, k + 2, 'shell');
  // The crazing: a net of short gold lines over the side of it that faces out.
  const lines: Disc[] = [];
  for (let q = 0; q < 26; q++) {
    const u = jitter(q + 11) * 2.0 - 1.0, v = jitter(q + 23) * 1.8 - 0.9;
    const d: V3 = [sd * (0.35 + 0.6 * jitter(q + 5)), u, v];
    const e = onEgg2([0, 0, 0], r, d);
    const along = unit(cross(e.n, [jitter(q + 1) - 0.5, jitter(q + 2) - 0.5, 0.6]));
    const a = add(e.p, scale(e.n, 0.008)), L = r[1] * (0.18 + 0.16 * jitter(q + 7));
    const b = add(a, scale(along, L)), w = r[1] * 0.016;
    const side = unit(cross(e.n, along));
    lines.push(facing([add(a, scale(side, w)), add(b, scale(side, w)), add(b, scale(side, -w)), add(a, scale(side, -w))], e.n, 'shellDark'));
  }
  // The pearly sheen: a soft pale patch up and to the front, and a glint in it.
  const top = onEgg2([0, 0, 0], r, [sd * 0.55, 0.35, 0.75]);
  const sheen = disc(add(top.p, scale(top.n, 0.012)), top.n, r[1] * 0.42, r[2] * 0.26, 9, 'petal', { up: [0, 1, 0] });
  const glint = disc(add(top.p, scale(top.n, 0.02)), top.n, r[1] * 0.12, r[2] * 0.08, 6, 'glint', { up: [0, 1, 0], lit: true });
  return merge(egg, paint([...lines, sheen, glint]));
}

/** A rope along a run of points: a tan cord, twisted, open at both ends. */
const rope = (pts: V3[], r: number, mat: Mat = 'stem'): Mesh => tube(pts, r, r, 5, mat, { start: false, end: false });

/**
 * What holds a pod on: a harness -- a rope round its middle and one over it, tied to a strap over the back -- or a net, rope
 * lines over it in a lattice and a knot at each crossing. In the pod's frame.
 */
function podRopeOf(P: Pod, sd: number, net: boolean, w: number): Mesh {
  const r = P.r, out: Mesh[] = [];
  const ring = (f: (a: number) => V3, steps = 14): V3[] => Array.from({ length: steps + 1 }, (_, q) => f((q / steps) * TAU));
  const on = (d: V3, lift: number): V3 => { const e = onEgg2([0, 0, 0], r, d); return add(e.p, scale(e.n, lift)); };
  if (!net) {
    // Round its waist, and once over it from the back up to the strap.
    out.push(rope(ring((a) => on([Math.cos(a), 0.05, Math.sin(a)], w * 0.6)), w));
    out.push(rope(ring((a) => on([Math.cos(a), Math.sin(a), 0.02], w * 0.6)), w));
    return merge(...out);
  }
  // A net: three bands round it and four over it, lying on its outer side.
  for (const z of [-0.45, 0, 0.45]) {
    out.push(rope(ring((a) => on([Math.cos(a) * Math.sqrt(1 - z * z), Math.sin(a) * Math.sqrt(1 - z * z), z], w * 0.5), 16), w * 0.7));
  }
  for (const a0 of [0.35, 1.2, 1.95, 2.8]) {
    out.push(rope(Array.from({ length: 13 }, (_, q) => { const t = lerp(-Math.PI / 2, Math.PI / 2, q / 12); return on([sd * Math.cos(t) * Math.sin(a0), Math.cos(t) * Math.cos(a0), Math.sin(t)], w * 0.5); }), w * 0.7));
  }
  return merge(...out);
}

/**
 * The straps that hold the pods on: over its back from one side to the other in front of and behind the mantle's middle, and
 * round its chest in front of the fore legs. In the trunk's frame.
 */
function strapsOf(s: Pack, w: number): Mesh {
  const B = s.body, out: Mesh[] = [];
  const band = (y: number, a0: number, a1: number, lift: number): V3[] => Array.from({ length: 13 }, (_, q) => {
    const e = onBack(B, y, lerp(a0, a1, q / 12));
    return add(e.p, scale(e.n, lift));
  });
  const ys = s.pods.length ? [...new Set(s.pods.map((p) => Math.round(p.y * 100) / 100))] : [0];
  // Over the back only under the mantle's edge, where it shows: from each side's top up under the leaves.
  for (const y of ys) for (const sd of [1, -1]) out.push(rope(band(y, sd * 1.75, sd * 0.9, w), w));
  // Round its chest: from high on one shoulder down in front of the fore legs and up the other, crossing at the breast.
  const front = s.len * 0.62;
  for (const sd of [1, -1]) {
    out.push(rope(Array.from({ length: 9 }, (_, q) => {
      const k = q / 8, e = onBack(B, lerp(ys[ys.length - 1], front, k), sd * lerp(1.3, 2.4, k));
      return add(e.p, scale(e.n, w * 1.2));
    }), w));
  }
  return merge(...out);
}

/**
 * The Cargocrest's cage: arches of root over its back, each a hoop from low on one flank over the top and down the other,
 * knotted and knobbed, joined along the top by ribs; a dome of moss over the top of them, cushioned, with leaves hanging off
 * its edge; and dark in the hollows under it, so the openings between the arches read as openings. In the trunk's frame.
 */
function cageOf(s: Pack, n: number, hollow = false): Mesh {
  const B = s.body, C = s.cage!, out: Mesh[] = [];
  const y0 = s.mantle.from + 0.3, y1 = s.mantle.to - 0.2;
  const ys = Array.from({ length: C.arches }, (_, q) => lerp(y0, y1, q / (C.arches - 1)));
  // A point on the hoop at `y`, `f` round it from the top toward its right (radians, about ±1.6 at its feet on the flanks).
  const hoop = (y: number, f: number, lift = 0): V3 => {
    // Highest over its middle and lower toward either end, a dome along it as well as across.
    const along = clamp((y - (y0 + y1) / 2) / ((y1 - y0) / 2 + 0.3), -1, 1);
    const r = ringAt(B, y), zc = r.z, rw = r.w * C.w + lift, rh = r.h + C.high * (1 - 0.7 * along * along) + lift;
    return [Math.sin(f) * rw, y, zc + Math.cos(f) * rh];
  };
  // The dark inside of it, a piece of its own drawn behind the pods (`hollowOf`).
  const mid = (y0 + y1) / 2, rr = ringAt(B, mid);
  if (hollow) return orb([0, mid, rr.z + rr.h * 0.5], [rr.w * C.w * 0.82, (y1 - y0) * 0.56, rr.h * 0.7 + C.high * 0.55], n + 2, 6, 'lid');
  // Its end arches, over the top from flank to flank at the front and the back.
  for (const [q, y] of [ys[0], ys[ys.length - 1]].entries()) {
    const pts: V3[] = [], ws: number[] = [];
    for (let e = 0; e <= 14; e++) {
      const f = lerp(-1.62, 1.62, e / 14), edge = Math.abs(f) / 1.62;
      pts.push(hoop(y, f));
      ws.push(0.12 * (1 + 0.6 * edge ** 3) * (1 + 0.22 * Math.sin(e * 2.3 + q * 1.7)));
    }
    out.push(tube(pts, ws, ws, n, 'bark', { start: false, end: false }));
  }
  // Down each flank, a ring of root round each opening, an oval, the rings meeting each other at the arches between: so from
  // the side it is a row of big oval windows, a pod in each.
  const ry = (y1 - y0) / (ys.length - 1) / 2;
  for (const sd of [1, -1]) {
    for (let q = 0; q < ys.length - 1; q++) {
      const yc = (ys[q] + ys[q + 1]) / 2, fc = sd * 1.22, rf = 0.52;
      const pts: V3[] = [], ws: number[] = [];
      for (let e = 0; e <= 20; e++) {
        const t = (e / 20) * TAU;
        pts.push(hoop(yc + Math.cos(t) * ry * 1.02, fc + Math.sin(t) * rf, 0.02));
        ws.push(0.1 * (1 + 0.3 * Math.sin(e * 1.9 + q * 2.1 + sd)));
      }
      out.push(tube(pts, ws, ws, n, 'bark', { start: false, end: false }));
      // A knot where it meets the next, and where it grips the flank under the window.
      out.push(orb(hoop(ys[q + 1], fc, 0.04), 0.17, 6, 3, 'bark'));
      out.push(orb(hoop(yc, fc + sd * rf, 0.03), 0.13, 6, 3, 'bark'));
    }
    out.push(orb(hoop(ys[0], sd * 1.22, 0.04), 0.17, 6, 3, 'bark'));
  }
  // The ridge along its top.
  out.push(tube(Array.from({ length: 9 }, (_, q) => hoop(lerp(y0 - 0.12, y1 + 0.12, q / 8), 0)), 0.09, 0.09, n, 'bark', { start: false, end: false }));
  // The moss dome over it: cushions packed over the top, thickest along the middle.
  for (let q = 0; q < 7; q++) {
    for (const f of [-0.62, -0.2, 0.2, 0.62]) {
      const y = lerp(y0 - 0.1, y1 + 0.1, (q + (Math.abs(f) < 0.3 ? 0.5 : 0)) / 6.5), id = 600 + q * 7 + Math.round(f * 5);
      const p = hoop(y, f, 0.06), nn = unit([Math.sin(f), 0, Math.cos(f)]);
      out.push(clumpOf(p, nn, 0.36 * (0.85 + 0.3 * jitter(id)) * (1 - 0.25 * Math.abs(f)), id, 4));
    }
  }
  // Leaves hanging off the edge of the dome down over the hollows.
  for (let q = 0; q < 9; q += 2) {
    for (const sd of [1, -1]) {
      const y = lerp(y0 - 0.1, y1 + 0.1, q / 8), p = hoop(y, sd * 0.85, 0.08), id = 700 + q * 2 + (sd > 0 ? 1 : 0);
      const L = 0.5 * (0.8 + 0.4 * jitter(id));
      out.push(leafOf(p, unit([sd * 0.5, -0.15, -1]), [sd * 0.2, -0.2, 0], unit([sd, 0, 0.35]), L, L * 0.38, q % 3 ? 'leaf' : 'leafDark', 'leafDark'));
    }
  }
  return merge(...out);
}
/**
 * Leaf armour: a curved plate of leaf, green with a cream rim and a cream rib, over a shoulder or down the front of a leg,
 * in the bone's own frame.
 */
function plateOf(L: number, W: number, sd: number, down = false): Mesh {
  const out: Mesh[] = [];
  for (const [q, off] of [[0, 0], [1, 0.3]] as const) {
    const root: V3 = [sd * W * 0.25 * q, 0, down ? -L * 0.05 - off * L * 0.4 : L * 0.3 - off * L * 0.25];
    const dir: V3 = down ? [sd * 0.25, 0.4, -1] : [sd * 0.6, 0.15, -1];
    out.push(leafOf(root, dir, [sd * 0.25, 0.5, 0], unit([sd, 0.6, 0.1]), L * (1 - 0.25 * q), W * (1 - 0.15 * q), q ? 'leafDark' : 'leaf', 'horn', 'horn', 0.3));
  }
  return merge(...out);
}

/** A paw: a cream pad, longer than wide, four cream toes and a dark claw on each. */
function pawOf(s: Pack, fore: boolean, n: number): Mesh {
  const r = s.paw * (fore ? 1 : 1.1);
  const pad = orbAlong([0, r * 0.25, -r * 0.35], [0, 1, 0], [r * 0.95, r * 1.25, r * 0.62], n, 4, 'belly');
  const toes: Mesh[] = [];
  for (let q = 0; q < 4; q++) {
    const x = (q - 1.5) * r * 0.5, y = r * 1.12 - Math.abs(q - 1.5) * r * 0.16;
    toes.push(orbAlong([x, y, -r * 0.55], [0, 1, -0.3], [r * 0.24, r * 0.3, r * 0.22], 5, 3, 'belly'));
    toes.push(orbAlong([x, y + r * 0.3, -r * 0.62], [0, 1, -0.5], [r * 0.1, r * 0.16, r * 0.08], 4, 3, 'claw'));
  }
  return merge(pad, ...toes);
}

/** The long cream fur down the back of a leg, in the part's own frame, the bone down `-z`. */
function featherOf(s: Pack, length: number, w: number, count: number, from: number, seed: number): Mesh {
  const out: Mesh[] = [];
  for (let q = 0; q < count; q++) {
    const z = -length * lerp(from, 0.95, q / Math.max(1, count - 1)), id = seed + q;
    for (const a of [-0.8, 0, 0.8]) {
      const nrm: V3 = [Math.sin(a), -Math.cos(a), 0];
      const L = s.feather * (0.6 + 0.5 * q / count) * (0.85 + 0.3 * jitter(id + a * 7));
      out.push(lock(add([0, 0, z], scale(nrm, w * 0.8)), add(scale(nrm, 0.55), [0, 0, -0.85]), L, L * 0.75, 'belly', nrm, 0.08));
    }
  }
  return merge(...out);
}

/* ---- pieces ------------------------------------------------------------------------------------------- */

function packBuild(s: Pack, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6), B = s.body;
  const pieces: Piece[] = [];
  const mid = ringAt(B, 0);
  const barrel = { c: [0, (B.y[0] + B.y[B.y.length - 1]) / 2, mid.z] as V3, r: [mid.w * 0.95, (B.y[B.y.length - 1] - B.y[0]) * 0.47, mid.h * 0.95] as V3 };
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 9), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.035 } });
  pieces.push({ key: 'ruff', mesh: ruffOf(s, n), bone: 'trunk', bias: 0.06, after: ['body', 'fl0', 'fr0'], front: [0, 1, 0], lines: false, hide: [barrel] });
  pieces.push({ key: 'mantle', mesh: mantleOf(s), bone: 'trunk', bias: 0.05, after: ['body', 'hl0', 'hr0'], lines: false, hide: [barrel] });
  pieces.push({ key: 'straps', mesh: strapsOf(s, 0.03 + 0.012 * s.stage), bone: 'trunk', bias: 0.055, after: ['body', 'mantle', 'ruff'], hide: [barrel] });
  if (s.cage) {
    pieces.push({ key: 'hollow', mesh: cageOf(s, n, true), bone: 'trunk', bias: 0.06, after: ['body', 'mantle', 'straps'], lines: false });
    pieces.push({ key: 'cage', mesh: cageOf(s, n), bone: 'trunk', bias: 0.09, after: ['body', 'mantle', 'straps', 'hollow', 'hl0', 'hr0', 'fl0', 'fr0', ...s.pods.map((_, q) => `pod${q}`)], lines: false });
  }
  s.pods.forEach((P, q) => {
    const sd = P.th < 0 ? -1 : 1;
    // In the Cargocrest's cage its pods need no rope.
    const ropes = s.cage ? null : podRopeOf(P, sd, s.nets, 0.026 + 0.01 * s.stage);
    pieces.push({ key: `pod${q}`, mesh: merge(podOf(P, sd, n, k), ropes), bone: `pod${q}`, bias: 0.07, after: ['body', 'mantle', 'straps', ...(s.cage ? ['hollow'] : []), sd < 0 ? 'hl0' : 'hr0', sd < 0 ? 'fl0' : 'fr0'], front: [sd, 0, 0] });
  });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: ['head', 'body', 'ruff', 'neckFur'] });
  pieces.push({ key: 'neckFur', mesh: neckFurOf(s), bone: 'neck', bias: 0.02, after: ['neck', 'ruff'], lines: false });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, after: 'neckFur', hide });
  pieces.push({ key: 'crest', mesh: crestOf(s), bone: 'crest', bias: 0.18, after: ['head', 'neck', 'neckFur'], lines: false, hide, hideIn: 'head' });
  const ear = earOf(s, n);
  for (const q of [0, 1]) pieces.push({ key: `ear${q}`, mesh: q ? ear : mirrorX(ear), bone: `ear${q}`, bias: 0.19, after: ['head', 'crest'], hide, hideIn: 'head' });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const sideV: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    // The upper leg: a round shoulder, or a big haunch, on the flank, and the leg out of it; cream fur at the top of the fore leg.
    const hw = fore ? w * 1.4 : w * 2.1;
    const upperM = merge(
      orb([0, fore ? 0 : -w * 0.15, fore ? 0 : -w * 0.2], [hw, hw * (fore ? 1.1 : 1.15), hw * (fore ? 1.2 : 1.1)], n, k, 'coat'),
      tube([[0, 0, -w * 0.3], [0, 0, -L[0]]], [hw * 0.8, w * 0.9], [hw * 0.8, w * 0.9], n, 'coat', { seam: 'start' }),
      orb([0, 0, -L[0]], w * 0.9, n, k, 'coat'),
    );
    const lowerM = tube([[0, 0, w * 0.5], [0, 0, -L[1] * 0.45], [0, 0.01, -L[1]]], [w * 0.9, w * 0.74, w * 0.56], [w * 0.94, w * 0.78, w * 0.58], n, 'coat', { seam: 'start' });
    const lastM = tube([[0, 0, w * 0.35], [0, 0.01, -L[2] - s.paw * 0.2]], [w * 0.6, w * 0.56], [w * 0.62, w * 0.58], n, 'coat', { seam: 'start' });
    pieces.push(
      { key: `${key}0`, mesh: upperM, bone: `${key}0`, bias: 0.01, after: ['body'], front: sideV },
      { key: `${key}1`, mesh: lowerM, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: out3 },
      { key: `${key}3`, mesh: lastM, bone: `${key}3`, bias: 0.025, after: ['body', `${key}1`], front: out3 },
      { key: `${key}2`, mesh: pawOf(s, fore, n), bone: `${key}2`, bias: 0.03, after: ['body', `${key}3`], front: out3 },
      { key: `${key}f`, mesh: featherOf(s, L[0], w * 0.9, s.stage + 2, fore ? 0.35 : 0.5, 500 + i * 20), bone: `${key}0`, bias: 0.022, after: [`${key}0`, `${key}1`], front: [0, -1, 0], lines: false },
    );
    if (s.stage > 0) pieces.push({ key: `${key}g`, mesh: featherOf(s, L[1], w * 0.75, s.stage, 0.25, 700 + i * 20), bone: `${key}1`, bias: 0.027, after: [`${key}1`, `${key}3`], front: [0, -1, 0], lines: false });
    if (s.armour) {
      pieces.push({ key: `${key}a`, mesh: plateOf(L[1] * 0.75, w * 1.1, side, true), bone: `${key}1`, bias: 0.035, after: [`${key}1`, `${key}0`, `${key}f`], front: [side, 0.6, 0], lines: false });
      if (fore) pieces.push({ key: `${key}s`, mesh: plateOf(L[0] * 0.9, w * 1.6, side), bone: `${key}0`, bias: 0.06, after: [`${key}0`, 'body', 'ruff', 'mantle', 'straps', `${key}f`], front: sideV, lines: false });
    }
  }
  const bend = (v: readonly V3[], a: Anim): V3[] => { const f = flexOf(s, a); return f ? v.map((p) => flexPt(s, p, f)) : [...v]; };
  return pieces.map((pc) => (pc.bone === 'trunk' ? { ...pc, bent: bend } : pc));
}

/** The same mesh left for right, its faces wound back the right way out. */
const mirrorX = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const DUST: RGB = [214, 200, 182];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const bigness = (s: Pack): number => 0.6 + 0.4 * (s.len / 2.4);

/** A puff of dust: a soft cloud of three lobes, growing as it goes and thinning to nothing over its life (`age`). */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.45 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
  const c = mix(DUST, [252, 246, 236], 0.2 + 0.35 * age);
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

/** A leaf shaken loose: a small green almond, turning as it drifts down. */
function leaflet(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, 1.6 / px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-r, 0);
  g.quadraticCurveTo(0, -r * 0.7, r, 0);
  g.quadraticCurveTo(0, r * 0.7, -r, 0);
  g.fillStyle = css(c, al);
  g.fill();
  g.strokeStyle = css(mix(c, [40, 50, 20], 0.6), al * 0.8);
  g.lineWidth = Math.max(0.5 / px, r * 0.15);
  g.stroke();
  g.restore();
}

const LEAVES: readonly RGB[] = [[150, 176, 70], [112, 148, 58], [214, 222, 120]];

/** Leaves shaken off from `from`, `since` seconds after, out and drifting down. */
function shed(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, size: number, life = 0.7): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.6 * jitter(k + 1));
    const p: V3 = [from[0] + Math.cos(a) * sp * since, from[1] + Math.sin(a) * sp * since, from[2] + (1.0 * jitter(k + 2) - 0.2) * since - 0.9 * since * since];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    leaflet(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), k + since * (3 + 4 * jitter(k + 4)), LEAVES[q % 3], 1 - smooth((since - life * 0.5) / (life * 0.5)));
  }
}

/** What a kick throws: dust off its hind feet and a few leaves off its mantle. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Pack, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - PACK_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0 || since > 0.6) return;
  for (const [j, f] of ['hl2', 'hr2'].entries()) {
    const p = place(b[f], [0, 0, 0]);
    if (nearSide(p, mid, view) === front) puff(g, view, [p[0], p[1], 0.1], 0.35 * big, since / 0.5, 5 + j);
  }
  shed(g, view, mid, place(b.trunk, [0, s.mantle.from + 0.3, s.body.h[2] + s.body.z[2]]), since, front, 5, 30, 1.4 * big, 0.12 * big);
}

/** Evolving: leaves and pale motes swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Pack, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, B = s.body;
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = B.w[3] * 1.7 + 0.3 * big, ry = s.len * 0.8 + 0.3 * big, high = s.high * 1.8 + 1.0 * big;
  for (let q = 0; q < 22; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36);
    const ang = (q / 22) * TAU + u * TAU * 1.3;
    const k = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -s.high * 0.7 + u * high * 0.8]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    leaflet(g, x, y, 0.13 * big * (1 - 0.4 * u), ang * 2 + q, q % 3 ? LEAVES[q % 3] : [246, 236, 214], swirl * ramp(u, 0, 0.15));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it kicks and evolves. */
function packKind(s: Pack): Kind {
  return {
    bones: packBones(s),
    build: (lod) => packBuild(s, lod),
    // The variant's coat is its brown and its mark its cream; the moss, the leaves, the rope, the roots and the pods are the
    // same on every variant, and so are its amber eyes.
    palette: (coat, mark) => coatPalette(coat, mark, {
      coat,
      coatDark: mix(coat, [40, 24, 16], 0.32),
      coatLight: mix(coat, mark, 0.35),
      belly: mix(mark, [222, 188, 140], 0.22),
      muzzle: mix(mark, [230, 200, 156], 0.12),
      mark,
      inner: mix(mark, [246, 196, 178], 0.35),
      nose: [92, 58, 48],
      lid: [70, 44, 34],
      eye: [52, 30, 18],
      glint: [255, 253, 246],
      crystal: [222, 156, 44],
      claw: [86, 62, 48],
      moss: [92, 112, 44],
      leaf: [118, 142, 52],
      leafDark: [80, 102, 42],
      bloom: [176, 192, 82],
      petal: [244, 234, 196],
      horn: [238, 222, 176],
      stem: [196, 156, 98],
      bark: [172, 126, 84],
      shell: [236, 210, 158],
      shellDark: [200, 136, 60],
    }),
    shadow: [s.len * 0.8 + 0.45, s.body.w[3] * 1.6 + (s.cage ? 0.3 : 0.15)],
    stride: 1,
    size: s.size,
    acts: ['strike'],
    leaps: [false, true],
    motes: [[176, 204, 96], [246, 238, 214]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const PACKLET = packKind(PACKLET_LOOK);
export const HAULBUD = packKind(HAULBUD_LOOK);
export const CARGOCREST = packKind(CARGOCREST_LOOK);
