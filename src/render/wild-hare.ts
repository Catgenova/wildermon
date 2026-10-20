import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, eyes, frac, lerp, merge, mix, orb, orbAlong, paint,
  pastel, scale, shadowOf, smile, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { HEIGHT_SCALE } from './iso';
import { joint, mesh, onScreen, place, ROOT, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The hare line: the Thistlekit, a small fluffy kit of a hare on short legs
 * with a round ruff of fur on its chest, its ears already big and its tail a
 * curled plume, which grows into the Bunnycourser, a tall slender courser on
 * long straight legs with its neck carried upright, a big ruff and lilac
 * dapples down its back, and then the Moonhare, large and stately, with very
 * long ears, a mane flowing down its neck, a great ruff, feathered legs and
 * two curled plumes for a tail. All three are cream fur dappled lilac-pink,
 * lilac down the lower legs, with dark lilac-grey toes, tall ears lilac-grey
 * behind and pink inside with peach leaves in them, violet eyes, a pink nose
 * and a blush on each cheek. The species is still `orse` underneath, as saves
 * and the database know it: the island's mount and draught beast, ridden once
 * it is saddled and bridled and put in the traces of a cart or a wagon.
 *
 * Built the way the brick line is (`./wild-brick`): one set of functions from
 * a description of each stage (`Hare`), every foot given a point to be at and
 * its leg bent to reach it, so a planted foot stays where it was put and a
 * knee never flips. A hare's legs are a dog's: the fore leg's elbow behind
 * and its pastern sloping, the hind's stifle forward and its hock high behind,
 * on a long foot. It walks one side then the other and runs in bounds, both
 * hind feet down and then both fore, its back drawn up between and stretched
 * out after, and in the air at each end of it. Its fur is tufts: the ruff, the
 * mane, the feathering on its legs and its plume are each a mass of small
 * pointed locks inked only round the outside, so they read as fluff.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Hare {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest, about its middle. */
  body: Rings;
  /** Hip to shoulder. */
  len: number;
  /** How far out the shoulders and hips are against the barrel's width there, and how far down it against its depth. */
  hip: number;
  drop: number;
  /** Each leg: upper and lower, and the last part -- the fore's pastern, the hind's long foot up to the hock; how thick at the top. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  /** How far each last part leans back from upright standing, fore and hind (degrees). */
  rake: [number, number];
  /** A paw's size. */
  paw: number;
  /** How far behind its shoulder a fore paw stands, and behind its hip a hind one. */
  stance: [number, number];
  /** How high the middle of the barrel is carried. */
  high: number;
  /**
   * Where along its back its saddle is, behind its middle: the body is carried that far ahead of where the island has it, so a
   * rider, who sits where it stands, sits there.
   */
  seat: number;
  /** The neck's root on the body, its length, its girth and how far forward of upright it leans. */
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes; the muzzle's (across, up, along); how far up the skull sits; its pitch. */
  head: { r: V3; snout: V3; up: number; pitch: number };
  eye: { dir: V3; size: number };
  /** The right ear's root on the skull (from its middle), its length and half-width, how far it is splayed out, laid back and turned out. */
  ear: { at: V3; len: number; w: number; splay: number; back: number; turn: number };
  /** The ruff's egg on the chest (its middle and half-sizes, about the front of the barrel), and how long its locks are. */
  ruff: { c: V3; r: V3; len: number; rows: number; across: number };
  /** How long the mane down the neck is (nought for none); the feathering on the legs. */
  mane: number;
  feather: number;
  /** The plume's root, each link's length and girth, how far it is lifted from straight back and curled up at each link; one plume or two. */
  tail: { at: V3; links: number[]; w: number[]; lift: number; curl: number; plumes: 1 | 2 };
  /** How many lilac dapples on its back and flanks, and how big. */
  dapples: number;
  dapple: number;
  gait: {
    /** How much of a stride a foot is down at a walk and at a run; how far it sweeps, against the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against its reach; how far the body sinks at each footfall; how far the back is drawn up in a bound (degrees at each end). */
    step: number; bob: number; flex: number;
  };
  size: number;
}

/** A Thistlekit: small and round on short legs, a big head and big ears, a round ruff, a curled plume. */
const THISTLEKIT_LOOK: Hare = {
  stage: 0,
  body: { y: [-0.86, -0.77, -0.45, 0, 0.45, 0.74, 0.86], z: [0.05, 0.04, 0.02, 0, 0.02, 0.05, 0.09], w: [0.33, 0.53, 0.58, 0.58, 0.58, 0.51, 0.32], h: [0.33, 0.51, 0.56, 0.56, 0.56, 0.49, 0.32] },
  len: 1.26, hip: 0.62, drop: 0.32,
  fore: [0.44, 0.42, 0.13], hind: [0.46, 0.42, 0.34], thick: 0.19, rake: [14, 22], paw: 0.12, stance: [0.06, 0.1],
  high: 1.17,
  seat: -0.12,
  neck: { at: [0, 0.66, 0.28], len: 0.38, w: 0.36, lean: 26 },
  head: { r: [0.68, 0.68, 0.62], snout: [0.34, 0.24, 0.3], up: 0.16, pitch: -4 },
  eye: { dir: [0.6, 0.66, 0.3], size: 0.19 },
  ear: { at: [0.27, -0.17, 0.46], len: 1.05, w: 0.42, splay: 36, back: 6, turn: 55 },
  ruff: { c: [0, 0.72, 0.0], r: [0.5, 0.42, 0.52], len: 0.26, rows: 3, across: 6 },
  mane: 0, feather: 0.12,
  tail: { at: [0, -0.82, 0.3], links: [0.3, 0.3, 0.28, 0.25, 0.22, 0.18], w: [0.28, 0.42, 0.48, 0.45, 0.36, 0.2], lift: 76, curl: 34, plumes: 1 },
  dapples: 16, dapple: 0.13,
  gait: { duty: [0.62, 0.3], swing: [0.3, 0.36], step: 0.2, bob: 0.05, flex: 9 },
  size: 4.2,
};

/** A Bunnycourser: tall and slender, a deep chest over a tucked-up waist, long straight legs, its neck upright, a big ruff, dapples down its back. */
const BUNNYCOURSER_LOOK: Hare = {
  stage: 1,
  body: { y: [-1.6, -1.45, -0.95, -0.15, 0.6, 1.15, 1.48, 1.62], z: [0.12, 0.1, 0.14, 0.2, 0.08, -0.08, -0.06, 0], w: [0.36, 0.56, 0.54, 0.44, 0.54, 0.62, 0.56, 0.34], h: [0.32, 0.54, 0.52, 0.38, 0.64, 0.84, 0.72, 0.38] },
  len: 2.2, hip: 0.62, drop: 0.3,
  fore: [0.86, 0.92, 0.22], hind: [0.92, 0.9, 0.7], thick: 0.23, rake: [14, 22], paw: 0.12, stance: [0.08, 0.22],
  high: 2.3,
  seat: -0.42,
  neck: { at: [0, 1.36, 0.42], len: 0.95, w: 0.34, lean: 26 },
  head: { r: [0.45, 0.54, 0.42], snout: [0.26, 0.2, 0.42], up: 0.12, pitch: -6 },
  eye: { dir: [0.62, 0.6, 0.32], size: 0.15 },
  ear: { at: [0.19, -0.16, 0.3], len: 1.62, w: 0.4, splay: 36, back: 6, turn: 55 },
  ruff: { c: [0, 1.4, 0.1], r: [0.56, 0.48, 0.78], len: 0.44, rows: 4, across: 6 },
  mane: 0, feather: 0.16,
  tail: { at: [0, -1.6, 0.42], links: [0.56, 0.56, 0.52, 0.47, 0.41, 0.34], w: [0.24, 0.36, 0.41, 0.38, 0.32, 0.18], lift: 80, curl: 34, plumes: 1 },
  dapples: 24, dapple: 0.2,
  gait: { duty: [0.64, 0.27], swing: [0.28, 0.4], step: 0.22, bob: 0.06, flex: 11 },
  size: 3.0,
};

/** A Moonhare: large and stately on long legs, very long ears, a mane flowing down its neck, a huge ruff, feathered legs, two plumes. */
const MOONHARE_LOOK: Hare = {
  stage: 2,
  body: { y: [-2.05, -1.86, -1.22, -0.2, 0.78, 1.48, 1.9, 2.08], z: [0.14, 0.12, 0.17, 0.25, 0.1, -0.1, -0.07, 0], w: [0.45, 0.7, 0.67, 0.54, 0.67, 0.78, 0.7, 0.42], h: [0.4, 0.68, 0.65, 0.46, 0.8, 1.06, 0.92, 0.48] },
  len: 2.8, hip: 0.62, drop: 0.3,
  fore: [1.13, 1.22, 0.28], hind: [1.15, 1.12, 0.9], thick: 0.3, rake: [14, 22], paw: 0.15, stance: [0.1, 0.28],
  high: 2.95,
  seat: -0.6,
  neck: { at: [0, 1.76, 0.52], len: 1.2, w: 0.44, lean: 26 },
  head: { r: [0.59, 0.72, 0.57], snout: [0.34, 0.27, 0.62], up: 0.15, pitch: -6 },
  eye: { dir: [0.62, 0.6, 0.32], size: 0.2 },
  ear: { at: [0.22, -0.2, 0.36], len: 2.05, w: 0.55, splay: 36, back: 6, turn: 55 },
  ruff: { c: [0, 1.8, 0.12], r: [0.76, 0.62, 1.0], len: 0.64, rows: 5, across: 7 },
  mane: 1.3, feather: 0.3,
  tail: { at: [0, -2.04, 0.48], links: [0.7, 0.7, 0.64, 0.57, 0.5, 0.41], w: [0.3, 0.45, 0.52, 0.48, 0.4, 0.22], lift: 80, curl: 33, plumes: 2 },
  dapples: 36, dapple: 0.25,
  gait: { duty: [0.66, 0.28], swing: [0.24, 0.38], step: 0.2, bob: 0.06, flex: 10 },
  size: 3.1,
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
  // At the size the island is played at a lock is a few pixels: three sides and two lengths, a third of the facets.
  if (!fineLocks || CLEAN_LOCKS) return tube([root, at(0.55), at(1)], [w, w * 0.75, 0.006], [w * 0.55, w * 0.4, 0.004], 3, mat, { up: u, start: false, end: false });
  return tube([root, at(0.4), at(0.75), at(1)], [w, w * 0.9, w * 0.5, 0.006], [w * 0.55, w * 0.5, w * 0.28, 0.004], 4, mat, { up: u, start: false, end: false });
}
/** Whether locks are cut finely, for the build under way (`hareBuild`): drawn big, or at the size the island is played at. */
let fineLocks = true;
/** Locks cut in three clean planes at every fineness, so a ruff is a few big locks and not crumpled paper close up. */
const CLEAN_LOCKS = true;

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

/* ---- its moves, in time ---------------------------------------------------------------------- */

/**
 * When each stage's strike lands, as a share of the strike: the Thistlekit's first jab as it boxes (the second at
 * `KIT_JAB`), the Bunnycourser's kick with both hind feet, the Moonhare's fore feet stamped down off its rear.
 */
export const HARE_HITS: readonly number[] = [0.4, 0.5, 0.58];
export const KIT_JAB = 0.56;
/**
 * A go at its task, by stage, as shares of it. It has no task, so it fusses at itself: the Thistlekit sniffs the ground three
 * times and thumps a hind foot twice; the Bunnycourser turns round to nibble its flank three times and shakes its ears; the
 * Moonhare draws its ear down through a lifted fore paw twice, washing it, and flicks it.
 */
export const HARE_WORK = {
  sniffs: [0.2, 0.3, 0.4] as const, thumps: [0.64, 0.78] as const,
  nibbles: [0.34, 0.46, 0.58] as const, shake: 0.82,
  strokes: [0.4, 0.6] as const, flick: 0.84,
} as const;

/* ---- where its feet go ---------------------------------------------------------------- */

/** A pose: where each paw is (along the ground, from under the body's middle), how far its last part is folded, and how the rest is carried. */
interface Plan {
  at: V3[];
  /** How far each pastern or long foot leans back past standing (degrees), and the paw pitched toe-up past level with it. */
  rake: number[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The neck bent forward and turned left; the head pitched nose-up, turned left and tilted. */
  neck: [number, number]; head: [number, number, number];
  /** Each ear, the left and the right, laid back past how it is carried and splayed out past it (degrees). */
  ears: [[number, number], [number, number]];
  /** Both ears turned about their own length past how they are carried, edge on to the wind (degrees). */
  earTurn: number;
  /** The plume lifted, swung to the left, and curled past how it is carried. */
  tail: [number, number, number];
}

interface Rest {
  /** Each shoulder and hip, in the body's frame; each paw standing, along the ground. */
  hip: V3[]; paw: V3[];
  reach: number[];
  /** Where the Moonhare's paw goes to wash its ear, found the first time it is posed. */
  wash: V3;
}

const rests = new Map<Hare, Rest>();
function restOf(s: Hare): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], paw: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    const h: V3 = [SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop];
    hip.push(h);
    // Under the body, a little in from the shoulder and the hip, and a little behind each: long straight legs under it.
    paw.push([SIDE[i] * r.w * s.hip * 0.9, y - s.stance[fore ? 0 : 1] - s.seat, s.paw]);
    reach.push(L[0] + L[1] + L[2]);
  }
  const R = { hip, paw, reach, wash: [0, 0, 0] as V3 };
  rests.set(s, R);
  return R;
}

function restPlan(s: Hare, R: Rest): Plan {
  return {
    at: R.paw.map((a) => [...a] as V3), rake: [0, 0, 0, 0], foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], ears: [[0, 0], [0, 0]], earTurn: 0, tail: [0, 0, 0],
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), rake: a.rake.map((x, i) => m(x, b.rake[i])), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    ears: [[m(a.ears[0][0], b.ears[0][0]), m(a.ears[0][1], b.ears[0][1])], [m(a.ears[1][0], b.ears[1][0]), m(a.ears[1][1], b.ears[1][1])]], earTurn: m(a.earTurn, b.earTurn),
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1]), m(a.tail[2], b.tail[2])],
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
    tail: [d(p.tail[0], to.tail[0], from.tail[0]), d(p.tail[1], to.tail[1], from.tail[1]), d(p.tail[2], to.tail[2], from.tail[2])],
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}

/**
 * When each foot comes down in a stride, the left fore, right fore, left hind and right hind: at a walk one side and then the
 * other, each hind foot followed by the fore on its side; at a run in bounds, both hind feet a moment apart and then both fore.
 */
const WALK_DOWN = [0.25, 0.75, 0, 0.5];
const RUN_DOWN = [0.42, 0.5, 0, 0.08];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.1;

/**
 * How far its back is drawn up this moment in degrees at either end of it, the ends down (`flexPt`): at a run, drawn up as its
 * hind feet come forward under it in the air and stretched out hollow after they push off; nought at a walk, standing and at
 * its acts.
 */
function flexOf(s: Hare, a: Anim): number {
  if (a.act || a.go <= 0) return 0;
  return smooth(Math.min(1, a.go)) * a.gait * s.gait.flex * Math.cos(TAU * (frac(a.u) - 0.87));
}
/** How far the back is turned at `y` along it, drawn up `deg` at either end: nose-down ahead of the middle, tail-down behind it. */
const flexAt = (s: Hare, y: number, deg: number): number => -deg * clamp(y / s.body.y[s.body.y.length - 1], -1, 1);
/** A point in the trunk's frame where the back's flex puts it: turned about the middle across, by the flex where it is. */
function flexPt(s: Hare, p: V3, deg: number): V3 {
  if (!deg) return p;
  const a = flexAt(s, p[1], deg) * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [p[0], p[1] * c - p[2] * sn, p[1] * sn + p[2] * c];
}

/**
 * Going. At a walk, each foot down for its share of a stride and swept back under the body at the ground's own speed, so it
 * never skates, then lifted and brought forward folded, the fore paw flicked back under the wrist and the hind foot trailing
 * off its toe; the body sinking a little at each footfall, the head nodding, the ears and the plume swaying a beat behind.
 * At a run, a bound: both hind feet down and pushing off, the body stretched out in the air, both fore feet down, and then
 * drawn up in the air with its hind feet swung forward under it; the nose up off the hind feet and down onto the fore, the
 * neck reaching, the ears laid back and streaming.
 */
function goingPlan(s: Hare, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  for (let i = 0; i < 4; i++) {
    // Every foot swept back the same way at the same speed, or one pair would skate: by the reach of a leg between the fore and the hind.
    const fore = i < 2, L = R.reach[i], half = amp * (R.reach[0] + R.reach[2]) / 2, A = R.paw[i];
    const ph = frac(a.u - lerp(WALK_DOWN[i], RUN_DOWN[i], g));
    if (ph < duty) {
      const k = ph / duty;
      p.at[i] = [A[0], A[1] + half * (1 - 2 * k), A[2]];
      // Rolling off the toe as it goes back under the body: the heel or the wrist lifted over the planted paw.
      const off = ramp(k, 0.55, 1);
      p.rake[i] = -(fore ? lerp(22, 45, g) : lerp(30, 55, g)) * off;
      p.foot[i] = p.rake[i];
      continue;
    }
    // Off the ground and onto it going back at the ground's speed, for longer at a run, where it is lifted higher.
    const E = lerp(EDGE, 0.2, g), u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * E, y1 = A[1] + half + v * E;
    const y = u < E ? A[1] - half - v * u : u > 1 - E ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * E), -v * (1 - 2 * E), (u - E) / (1 - 2 * E));
    const lift = G.step * L * (1 + 0.3 * g) * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0], y, A[2] + lift];
    if (fore) {
      // The paw flicked back under the wrist as it comes off the ground and reached out flat to land.
      p.rake[i] = -lerp(75, 105, g) * Math.sin(Math.PI * clamp(u / 0.78)) + 8 * hump(u, 0.92, 0.1);
      p.foot[i] = p.rake[i] * 0.85;
    } else {
      // The long foot trailing off its toe, then the hock drawn up and the foot carried forward under it.
      p.rake[i] = -lerp(35, 46, g) * Math.sin(Math.PI * clamp(u / 0.45)) + lerp(18, 28, g) * Math.sin(Math.PI * clamp((u - 0.35) / 0.65));
      p.foot[i] = p.rake[i] * 0.7;
    }
  }
  // A walk sinks at each of its four footfalls; a bound is lowest on its feet and highest in the air, twice a stride.
  const walkBob = -G.bob * s.len * (0.5 + 0.5 * Math.cos(4 * TAU * (w - 0.05)));
  const bound = 0.06 * s.len * Math.cos(2 * TAU * (w - 0.37)) - 0.07 * s.len;
  p.H += lerp(walkBob, bound, g);
  p.pitch = g * 6 * Math.sin(TAU * (w - 0.12)) + (1 - g) * 1.2 * Math.sin(2 * TAU * w);
  p.roll = (1 - g) * 1.5 * Math.sin(TAU * (w - 0.1));
  // The head nodding twice a stride at a walk; at a run the neck reaching out and the head held steady against the pitch.
  p.neck[0] = g * (28 + 6 * Math.sin(TAU * (w - 0.6)));
  p.head[0] = (1 - g) * 4 * Math.cos(2 * TAU * (w - 0.15)) - g * (10 + 5 * Math.sin(TAU * (w - 0.12)));
  p.head[1] = (1 - g) * 3 * Math.sin(TAU * w);
  // The ears swaying a beat behind the nod at a walk; laid back at a run and fluttering with the bound.
  const sway = (1 - g) * 6 * Math.sin(2 * TAU * (w - 0.3)), flut = g * 8 * Math.sin(TAU * (w - 0.25));
  p.ears = [[g * 46 + sway + flut, (1 - g) * 3 * Math.sin(TAU * w) - 14 * g], [g * 46 + sway * 0.8 + flut, -(1 - g) * 3 * Math.sin(TAU * w) - 14 * g]];
  // Laid back along the neck at a run, and turned edge on to the wind, so they stream as two narrow blades and not two paddles.
  p.earTurn = -35 * g;
  // The plume bobbing with the stride and swung from side to side at a walk.
  p.tail = [-(1 - g) * 4 * Math.cos(2 * TAU * (w - 0.2)) - g * (6 + 12 * Math.sin(TAU * (w - 0.5))), (1 - g) * 9 * Math.sin(TAU * (w - 0.2)), g * 6];
  return p;
}

/**
 * Standing about: breathing, looking round, an ear swivelled back now and then and flicked, the other after it; the plume
 * stirring; and now and then drawn up tall with both ears pricked to listen.
 */
function stillPlan(s: Hare, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [2 * Math.abs(a.breath - 0.5), 12 * look];
  p.head = [-2 * Math.abs(cyc(t, 5)), 8 * look, 5 * drift(t, 2)];
  p.H += 0.01 * s.len * (a.breath - 0.5);
  const flickL = beat(t, [3.1, 15.7], 0.5), flickR = beat(t, [3.4, 9.6, 20.2], 0.5);
  // The ears only ever laid back from how they stand at the start of the loop, never more upright, so they never come up into
  // the name and the health bar over it (`wildermonTop`, measured standing there).
  const back = 3 * (1 - Math.cos((TAU * 3 * t) / 24));
  p.ears = [[back + 30 * flickL, 4 * cyc(t, 4) - 10 * flickL], [back * 0.7 + 30 * flickR, -4 * cyc(t, 4, 1) - 10 * flickR]];
  p.tail = [-2 * (1 - Math.cos((TAU * 3 * t) / 24)), 7 * cyc(t, 4), -1.5 * (1 - Math.cos((TAU * 6 * t) / 24))];
  // Listening: the head turned a little and both ears swivelled forward to the sound.
  const up = beat(t, [6.2, 18.8], 2.2);
  p.head[1] += 10 * up;
  p.earTurn = -18 * up;
  return p;
}

/* ---- rearing ------------------------------------------------------------------------------------- */

/** The body pitched nose-up by `deg` about its hips or nose-down about its shoulders, `at` along it, so they stay where they stood. */
function pivot(s: Hare, p: Plan, deg: number, at: number): void {
  const r = ringAt(s.body, at), z0 = r.z - r.h * s.drop, a = deg * DEG;
  // A point (at, z0) on the body turned by `a` about the body's middle goes to this; moved back to where it was.
  const y1 = at * Math.cos(a) - z0 * Math.sin(a), z1 = at * Math.sin(a) + z0 * Math.cos(a);
  p.pitch += deg;
  p.surge += at - y1;
  p.H += z0 - z1;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Thistlekit boxes: up on its hind feet, fore paws up, a jab with the left and one with the right, and down. */
function box(s: Hare, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R);
  const up = ramp(t, 0.04, 0.26) * (1 - ramp(t, 0.72, 0.96));
  pivot(s, p, 34 * up, -s.len * 0.5);
  p.neck = [-14 * up, 0];
  p.head = [-20 * up, 0, 0];
  p.ears = [[-8 * up, 6 * up], [-8 * up, 6 * up]];
  const jabs = [hump(t, HARE_HITS[0] - 0.02, 0.09), hump(t, KIT_JAB - 0.02, 0.09)];
  for (const i of [0, 1]) {
    const A = R.paw[i], sh = R.hip[i];
    // Up in front of its chest, and thrown out ahead at its jab.
    const guard: V3 = [A[0] * 0.8, sh[1] - s.seat + 0.05, s.high + sh[2] + 0.35];
    const jab: V3 = [A[0] * 0.6, sh[1] - s.seat + R.reach[i] * 0.7, s.high + sh[2] + 0.55];
    const k = ramp(t, 0.08, 0.28) * (1 - ramp(t, 0.68, 0.92));
    p.at[i] = mixV(A, mixV(guard, jab, jabs[i]), k);
    p.rake[i] = -40 * k;
    p.foot[i] = -60 * k;
  }
  p.roll = 4 * (jabs[1] - jabs[0]);
  p.yaw = 6 * (jabs[1] - jabs[0]);
  p.tail = [10 * up, 0, 0];
  return p;
}

/** The Bunnycourser kicks: its weight thrown onto its fore feet, its hindquarters up, both hind feet driven out behind, and back. */
function kick(s: Hare, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = HARE_HITS[1];
  const set = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.6, 0.92));
  const out = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.08, 0.8));
  pivot(s, p, -6 * set - 14 * out, s.len * 0.5);
  p.H -= 0.03 * s.len * set;
  p.neck = [14 * set, 0];
  p.head = [6 * set - 10 * out, 0, 0];
  p.ears = [[20 * set + 15 * out, 0], [20 * set + 15 * out, 0]];
  for (const i of [2, 3]) {
    const A = R.paw[i], L = R.reach[i];
    const bunch: V3 = [A[0], A[1] + L * 0.18, A[2]];
    const kicked: V3 = [A[0] * 1.1, A[1] - L * 0.95, A[2] + L * 0.6];
    const k1 = ramp(t, 0.12, 0.32) * (1 - ramp(t, 0.36, 0.42));
    let at = mixV(A, bunch, k1);
    if (t > 0.36) at = mixV(t < hit + 0.08 ? bunch : A, kicked, out);
    const land = ramp(t, 0.66, 0.9);
    if (t > hit + 0.08) at = mixV(mixV(kicked, A, land), A, 0);
    p.at[i] = at;
    p.rake[i] = -50 * out;
    p.foot[i] = -50 * out;
  }
  p.tail = [-20 * out, 0, -10 * out];
  return p;
}

/** The Moonhare rears: up on its hind feet, fore paws high and paddling, held, and brought down together in a stamp. */
function rear(s: Hare, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = HARE_HITS[2];
  const top = hit - 0.12, peak = top - 0.14, set = 0.16;
  const k = t < set ? 0 : t < peak ? smooth((t - set) / (peak - set)) : t < top ? 1 : t < hit ? 1 - ((t - top) / (hit - top)) ** 2 : 0;
  const land = hump(t, hit + 0.04, 0.1), settle = t > hit ? 1 - ramp(t, hit + 0.05, 0.95) : 0;
  pivot(s, p, 40 * k, -s.len * 0.5);
  // Down onto its haunches before it goes up.
  const dip = hump(t, 0.12, 0.11);
  p.H -= 0.03 * s.len * land + 0.15 * dip;
  p.pitch -= 5 * dip;
  p.squash = 0.05 * land;
  p.neck = [-16 * k + 8 * land + 8 * hump(t, 0.12, 0.11), 0];
  p.head = [-14 * k - 4 * land, 0, 0];
  p.ears = [[-6 * k + 14 * land, 8 * k], [-6 * k + 14 * land, 8 * k]];
  for (const i of [0, 1]) {
    const A = R.paw[i], L = R.reach[i];
    const paddle = Math.sin(t * 34 + i * 2.2) * (t < top ? 1 : 0) * k;
    const high: V3 = [A[0] * 0.9, A[1] + L * 0.3, A[2] + L * (0.5 + 0.08 * paddle)];
    p.at[i] = t < hit ? mixV(A, high, k) : A;
    p.rake[i] = -70 * k;
    p.foot[i] = -60 * k;
  }
  p.tail = [14 * k - 6 * settle, 0, 6 * k];
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it is at it over and over. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/**
 * A go at its task, which is fussing at itself. The Thistlekit puts its nose down and sniffs three times, ears forward, looks
 * up, and thumps a hind foot twice. The Bunnycourser turns its head round to its flank and nibbles at its fur three times,
 * and comes back round and shakes its ears. The Moonhare bows and tips its head, its right ear laid forward, lifts a fore paw
 * to it and draws the ear down through it twice, then puts the paw down and flicks the ear up.
 */
function workPlan(s: Hare, R: Rest, a: Anim, t: number, down: number): Plan {
  const p = restPlan(s, R), W = HARE_WORK;
  if (s.stage === 0) {
    const nose = ramp(t, 0.04, 0.16) * (1 - ramp(t, 0.44, 0.54));
    const sniff = W.sniffs.reduce((x, c) => Math.max(x, hump(t, c, 0.05)), 0);
    const alert = ramp(t, 0.46, 0.56) * (1 - ramp(t, 0.9, 1));
    p.neck = [62 * nose - 6 * alert, 0];
    p.head = [-34 * nose + 8 * sniff + 6 * alert, 0, 0];
    p.pitch = -9 * nose;
    p.H -= 0.05 * s.len * nose;
    p.ears = [[-12 * nose - 8 * alert, -4 * nose], [-12 * nose - 8 * alert, -4 * nose]];
    // The right hind foot lifted and brought down hard, twice.
    const i = 3, A = R.paw[i];
    const thump = W.thumps.reduce((x, c) => Math.max(x, ramp(t, c - 0.08, c - 0.02) * (1 - ramp(t, c - 0.015, c))), 0);
    p.at[i] = [A[0], A[1] - 0.04 * thump, A[2] + R.reach[i] * 0.3 * thump];
    p.rake[i] = -20 * thump;
    p.foot[i] = -10 * thump;
    p.tail = [6 * alert, 4 * sniff, 0];
  } else if (s.stage === 1) {
    const round = ramp(t, 0.06, 0.24) * (1 - ramp(t, 0.66, 0.78));
    const nib = W.nibbles.reduce((x, c) => Math.max(x, hump(t, c, 0.05)), 0);
    const shake = hump(t, W.shake, 0.08) * Math.sin(t * 90);
    p.neck = [34 * round + 4 * nib, 62 * round];
    p.head = [-30 * round - 8 * nib, 40 * round, -24 * round + 14 * shake];
    p.roll = -3 * round;
    p.ears = [[24 * round + 30 * Math.abs(shake), 10 * shake], [24 * round + 30 * Math.abs(shake), -10 * shake]];
    p.tail = [0, -14 * round, 0];
    p.yaw = 6 * round;
    // Its weight over to the side it turns from, and as it comes back round a hind foot lifted and set down again.
    p.side = -0.05 * s.len * round;
    p.roll -= 2 * round;
    const step = hump(t, 0.76, 0.07), i = 2, A = R.paw[i];
    p.at[i] = [A[0], A[1] + 0.05 * s.len * step, A[2] + R.reach[i] * 0.16 * step];
    p.rake[i] = -18 * step;
    p.foot[i] = -12 * step;
  } else {
    const bow = ramp(t, 0.04, 0.22) * (1 - ramp(t, 0.72, 0.86));
    const paw = ramp(t, 0.14, 0.3) * (1 - ramp(t, 0.66, 0.8));
    const stroke = W.strokes.reduce((x, c) => Math.max(x, hump(t, c, 0.1)), 0);
    const flick = hump(t, W.flick, 0.07);
    p.neck = [58 * bow, -12 * bow];
    p.head = [-20 * bow - 6 * stroke, -20 * bow, -34 * bow];
    p.roll = 2 * bow;
    // The right ear laid forward and down over the face into the paw, drawn down through it at each stroke.
    p.ears = [[10 * bow - 20 * flick, 8 * bow], [20 * bow - 10 * stroke - 30 * flick, 108 * bow]];
    p.earTurn = -40 * bow;
    const i = 1, A = R.paw[i];
    const at = mixV(R.wash, add(R.wash, [0, 0.05, -0.28]), stroke);
    // Up and down by way of a point drawn in toward the chest, so the leg stays bent and its elbow behind all the way.
    p.at[i] = add(mixV(A, at, paw), [0, -0.3 * s.len * 0.25 * Math.sin(Math.PI * paw), 0]);
    p.rake[i] = -60 * paw;
    p.foot[i] = -70 * paw;
    p.at[0] = [R.paw[0][0] - 0.04 * paw, R.paw[0][1], R.paw[0][2]];
    p.tail = [4 * flick, 6 * bow, 0];
  }
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its ears pricked, a shake, and settled. */
function evolvePlan(s: Hare, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * 58);
  p.H += s.len * (-0.03 * hunch + 0.02 * up);
  p.pitch = -3 * hunch + 4 * up;
  p.neck = [16 * hunch - 12 * up, 0];
  p.head = [-12 * hunch + 12 * up, 0, 10 * shake];
  p.ears = [[40 * hunch - 14 * up + 20 * Math.abs(shake), 10 * shake], [40 * hunch - 14 * up + 20 * Math.abs(shake), -10 * shake]];
  p.roll = 3 * shake;
  p.tail = [-10 * hunch + 12 * up, 10 * shake, 6 * up];
  p.squash = 0.05 * hump(t, 0.7, 0.05);
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Hare, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([box, kick, rear][s.stage](s, R, a, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, a, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, a, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, a, 0.35, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/**
 * A leg bent to put its paw at `paw`: its last part -- the pastern, or the long hind foot -- up from the paw to the wrist or
 * the hock, leaning back as the pose says; then the upper and lower bent to reach that, the elbow behind on a fore leg and the
 * stifle forward on a hind, always the same way round. A point out of reach is reached for as far as the leg goes, and the paw
 * comes with it. Each bone's own `-z` runs down its part.
 */
function legOf(s: Hare, body: Xf, i: number, rootLocal: V3, paw: V3, rake: number, foot: number): Xf[] {
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
  // Behind for an elbow and ahead for a stifle, and down: which says where the joint goes when the leg is lifted level, a paw
  // up to the face or a foot kicked out behind, and is nothing when the leg is upright.
  // The more the leg points up -- a paw raised to the face -- the more the elbow goes down under it, so its pole never turns over.
  const hint = add(add(scale(fwd, fore ? -1 : 1), scale(out, 0.08)), [0, 0, -0.35 - 2.5 * Math.max(0, d[2])]);
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(root, scale(d, along)), scale(v, h));
  const pawAt = add(paw, sub(at, ankle));
  // Each part's frame kept square to the body's own across, so a leg lifted high -- a paw up to the face -- does not turn its
  // frame over as it passes the level.
  const across = turn(body, [1, 0, 0]);
  const [X0, Y0, Z0] = sideFrame(sub(root, knee), across), [X1, Y1, Z1] = sideFrame(sub(knee, at), across), [X3, Y3, Z3] = sideFrame(sub(at, pawAt), across);
  const cannon = xfOf(X3, Y3, Z3, at);
  // The paw level on the ground standing, turned with its last part as that folds (`Plan.foot`).
  const pw = joint(xfOf(X3, Y3, Z3, pawAt), [0, 0, 0], -(r0 + rake) + foot);
  return [xfOf(X0, Y0, Z0, root), xfOf(X1, Y1, Z1, knee), pw, cannon];
}

/** A plume's bones from its root on the body, each link on from the one before it, lifted, curled up and swung. */
function plumeBones(s: Hare, body: Xf, P: Plan, flex: number, second: boolean): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  const lift = second ? -38 : T.lift, curl = second ? -16 : T.curl, side = 0;
  const at: V3 = second ? add(T.at, [0, 0.04, -T.w[0] * 0.9]) : T.at;
  let prev = joint(body, flexPt(s, at, flex), -(lift + P.tail[0]) - flexAt(s, at[1], flex), 0, P.tail[1] * 0.4 + side);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    const c = second ? curl - P.tail[2] * 0.5 : curl + P.tail[2];
    prev = joint(prev, [0, -T.links[q - 1], 0], -c, 0, (P.tail[1] * 0.6) / (n - 1));
    out.push(prev);
  }
  return out;
}

/** The middle of the skull, in the head's frame; the middle of the muzzle; the root of the right ear. */
const skullAt = (s: Hare): V3 => [0, 0, s.head.up];
const snoutAt = (s: Hare): V3 => { const H = s.head; return [0, H.r[1] * 0.62 + H.snout[2] * 0.42, H.up - H.r[2] * 0.4]; };
const earRoot = (s: Hare, side: number): V3 => [side * s.ear.at[0], s.ear.at[1], s.head.up + s.ear.at[2]];

/**
 * The bones of a stage: its pose, the body raised and carried as the pose says, its back flexed, every leg bent to put its paw
 * where the pose says (`legOf`), the neck, head and ears carried on the body, and the plume or plumes in links.
 */
function hareBones(s: Hare): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, flex: number): Bones => {
    const body = joint(ROOT, [P.side, P.surge - s.seat, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.neck.lean + P.neck[0];
    const nf = flexAt(s, s.neck.at[1], flex);
    b.neck = joint(body, flexPt(s, s.neck.at, flex), -lean + nf, 0, P.neck[1]);
    // The head held level against the neck's lean and half the back's flex.
    b.head = joint(b.neck, neckEnd(s, 1), lean + s.head.pitch + P.head[0] - nf * 0.5, P.head[2], P.head[1]);
    const E = s.ear;
    for (const k of [0, 1]) {
      const side = k ? 1 : -1, e = P.ears[k];
      // Splayed out in a V, laid back, and each turned about its own length so its hollow looks forward and out; the left laid a
      // little further back than the right, so side on they are two ears and not one.
      const spread = joint(b.head, earRoot(s, side), 0, side * (E.splay + e[1]));
      // Not mirror images: both look round to its right, the right ear's hollow turned out and the left's turned in across the
      // head, so from its right and from in front both hollows show, pink and leafed; from its left, their lilac backs.
      const look = k ? E.turn : -EAR_IN;
      b[`ear${k}`] = joint(joint(spread, [0, 0, 0], E.back + (k ? -6 : 10) + e[0]), [0, 0, 0], 0, 0, -side * (look + P.earTurn));
    }
    plumeBones(s, body, P, flex, false).forEach((x, q) => { b[`tail${q}`] = x; });
    if (s.tail.plumes === 2) plumeBones(s, body, P, flex, true).forEach((x, q) => { b[`plume${q}`] = x; });
    for (let i = 0; i < 4; i++) {
      const fore = i < 2, h = R.hip[i];
      // The shoulder blade swings with the fore leg, carrying its root a little forward and back.
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
  let ready = false;
  const prepare = (): void => {
    ready = true;
    if (s.stage !== 2) return;
    // Where the Moonhare's right ear is, laid forward, at its first stroke: its paw goes there.
    const t = HARE_WORK.strokes[0] - 0.1;
    const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t } };
    const b = pose(workPlan(s, R, a, t, 1), 0);
    const p = place(b.ear1, [0, s.ear.w * 0.5, s.ear.len * 0.7]);
    const top = s.high + R.hip[1][2] + s.fore[0] * 0.9;
    // No further from its shoulder than keeps the leg well bent, so the elbow stays down and behind as the paw strokes.
    const sh = place(b.fr0, [0, 0, 0]), want: V3 = [p[0], p[1], Math.min(top, p[2] - s.paw * 0.6)], d = sub(want, sh);
    const most = 0.72 * (s.fore[0] + s.fore[1]), far = len3(d);
    R.wash = far > most ? add(sh, scale(d, most / far)) : want;
  };
  return (a) => {
    if (!ready) prepare();
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go });
    return pose(P, flexOf(s, a));
  };
}

/** How far the left ear's hollow is turned in across the head, toward the right, in degrees. */
const EAR_IN = 35;
/** How thick its saddle is. */
const SADDLE_H = 0.07;
/** How high the top of the saddle is over its feet standing, in its own units. */
const seatOf = (s: Hare): number => { const r = ringAt(s.body, s.seat); return s.high + r.z + r.h + SADDLE_H; };

/* ---- what it is made of ------------------------------------------------------------------------- */

/** A flat shape laid on the barrel's curve: every corner of it put back onto the barrel, a hair out from it. */
function onBarrel(B: Rings, d: Disc, lift: number): Disc {
  return {
    ...d, v: d.v.map((v) => {
      const r = ringAt(B, v[1]), th = Math.atan2((v[2] - r.z) / r.h, v[0] / r.w);
      const q = onRings(B, clamp(v[1], B.y[0] + 0.02, B.y[B.y.length - 1] - 0.02), th);
      return add(q.p, scale(q.n, lift));
    }),
  };
}

/**
 * A soft leaf of colour on a surface at `c` facing out along `n`: `l` long and `w` across, pointed at both ends and fullest
 * a little behind its middle, lying along the body (`+y`) turned by `spin`.
 */
function leafOn(c: V3, n: V3, l: number, w: number, spin: number, m: Mat): Disc {
  const N = unit(n), along0 = unit(sub([0, 1, 0], scale(N, N[1]))), across0 = unit(cross(N, along0));
  const along = add(scale(along0, Math.cos(spin)), scale(across0, Math.sin(spin))), across = unit(cross(N, along));
  const pts: V3[] = [];
  for (let q = 0; q < 10; q++) {
    const t = (q / 10) * TAU, x = Math.cos(t), y = Math.sin(t) * Math.sin(Math.PI * (0.5 + 0.5 * x)) ** 0.6 * (1 + 0.2 * x);
    pts.push(add(c, add(scale(along, x * l * 0.5), scale(across, y * w * 0.5))));
  }
  return facing(pts, N, m);
}

/** The barrel: cream fur, its lilac dapples painted along its back and down its flanks, longer than they are wide and lying along it. */
function barrelOf(s: Hare, n: number): Mesh {
  const B = s.body, F = smoothRings(B, 3);
  const body = tube(F.y.map((y, q) => [0, y, F.z[q]] as V3), F.w, F.h, n, 'coat');
  const spots: Disc[] = [];
  const y0 = B.y[1] + 0.1, y1 = lerp(B.y[4], B.y[5], 0.5);
  for (let q = 0; q < s.dapples; q++) {
    // Along the back from the rump to the withers, thickest over the loins and the haunches, down to halfway down the flanks.
    const u = (q + 0.5) / s.dapples, y = lerp(y0, y1, u ** 1.15) + (jitter(q + 1) - 0.5) * 0.2;
    const side = q % 2 ? 1 : -1, down = 0.12 + 0.85 * jitter(q + 7);
    const th = side > 0 ? Math.PI / 2 - down : Math.PI / 2 + down;
    const e = onRings(B, y, th), k = s.dapple * (0.65 + 0.6 * jitter(q + 3)) * (1 - 0.25 * u);
    spots.push(onBarrel(B, leafOn(e.p, e.n, k * 3.2, k * 1.6, (jitter(q + 5) - 0.5) * 0.7 + side * 0.25, 'mark'), 0.012));
  }
  return merge(body, paint(spots));
}

/**
 * The ruff: a mass of locks over the front of its chest and up round the root of its neck, hanging down and out in rows, the
 * lowest the longest, so its chest is a shaggy bib. On an egg of cream fur under them.
 */
function ruffOf(s: Hare, n: number): Mesh {
  const F = s.ruff, out: Mesh[] = [orb(F.c, F.r, n, Math.max(4, n - 3), 'coat')];
  for (let row = 0; row < F.rows; row++) {
    const v = row / Math.max(1, F.rows - 1), el = lerp(s.stage ? 0.85 : 0.45, -0.85, v);
    const count = F.across + (row % 2);
    for (let q = 0; q < count; q++) {
      const az = lerp(-1.25, 1.25, (q + 0.5 * (row % 2)) / Math.max(1, count - 1 + (row % 2)));
      const dir: V3 = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
      const e = onEgg2(F.c, F.r, dir), id = row * 31 + q;
      const L = F.len * (0.7 + 0.5 * v) * (0.85 + 0.3 * jitter(id));
      // Lying close down the chest, all of one cream, so the toon light lies on them in a few broad planes and not a scatter.
      const way = unit(add(scale(e.n, 0.45), [0, 0.02, -1]));
      out.push(lock(sub(e.p, scale(e.n, 0.06)), way, L, L * 0.8, 'coat', e.n, 0.05));
    }
  }
  return merge(...out);
}
const onEgg2 = (c: V3, r: V3, dir: V3): { p: V3; n: V3 } => {
  const d = unit(dir), k = 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);
  const p = add(c, scale(d, k));
  return { p, n: unit([(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]) };
};

/**
 * The kit's fluff: a fringe of soft locks round its lower flanks and its haunches and over its rump, hanging down and back, so it
 * is a round ball of fur on its little legs. The bigger two are sleek here.
 */
function fluffOf(s: Hare): Mesh {
  const B = s.body, out: Mesh[] = [];
  for (let q = 0; q < 26; q++) {
    const u = (q + 0.5) / 26, y = lerp(B.y[1] + 0.05, B.y[5], u), side = q % 2 ? 1 : -1, id = 800 + q;
    const th = -0.55 + 0.35 * jitter(id);
    const e = onRings(B, y, side > 0 ? th : Math.PI - th);
    const L = s.ruff.len * (0.75 + 0.4 * jitter(id + 1));
    out.push(lock(sub(e.p, scale(e.n, 0.04)), add(scale(e.n, 0.7), [0, -0.35, -0.75]), L, L * 0.55, jitter(id + 2) < 0.3 ? 'coatLight' : 'coat', e.n, 0.1));
  }
  for (let q = 0; q < 8; q++) {
    const a = lerp(-1.1, 1.1, q / 7), e = onRings(B, B.y[1] + 0.06, Math.PI / 2 + a), id = 840 + q;
    const L = s.ruff.len * (0.8 + 0.3 * jitter(id));
    out.push(lock(sub(e.p, scale(e.n, 0.04)), add(scale(e.n, 0.8), [0, -0.5, -0.3]), L, L * 0.55, 'coat', e.n, 0.1));
  }
  return merge(...out);
}

/** The neck: cream fur, a little deeper than it is wide. */
function neckOf(s: Hare, n: number): Mesh {
  const N = s.neck, L = N.len;
  return tube([[0, 0, -0.3], [0, -0.03 * L, L * 0.4], neckEnd(s, 0.75), neckEnd(s, 1.04)], [N.w * 1.12, N.w, N.w * 0.92, N.w * 0.86], [N.w * 1.2, N.w * 1.04, N.w * 0.94, N.w * 0.88], n, 'coat', { seam: 'both' });
}
/** A point on the line of the neck `k` up it, in its frame: straight up from the withers, then arched forward over the chest toward the head. */
const neckEnd = (s: Hare, k: number): V3 => { const L = s.neck.len, u = clamp((k - 0.45) / 0.55); return [0, L * NECK_ARCH * u * u, L * k]; };
/** How far forward the top of the neck arches, against its length. */
const NECK_ARCH = 0.26;

/**
 * The fur of the neck: locks down the front of the throat and the sides of it, carrying the ruff up to the jaw; and on the
 * Moonhare its mane, long locks from the poll to the withers falling down the back and sides of its neck and over its
 * shoulders, lilac at their tips.
 */
function neckFurOf(s: Hare): Mesh {
  const N = s.neck, out: Mesh[] = [];
  const rows = 2;
  for (let row = 0; row < rows; row++) {
    const z = lerp(N.len * (s.stage ? 0.6 : 0.8), N.len * 0.1, row / Math.max(1, rows - 1));
    for (let q = 0; q < 5; q++) {
      const a = lerp(-1.3, 1.3, (q + 0.5 * (row % 2)) / 4.5), id = 300 + row * 11 + q;
      const nrm: V3 = [Math.sin(a), Math.cos(a), 0];
      const root: V3 = add(neckEnd(s, z / N.len), [nrm[0] * N.w * 0.9, nrm[1] * N.w * 0.95, 0]);
      const L = s.ruff.len * (0.6 + 0.3 * row / rows) * (0.85 + 0.3 * jitter(id));
      out.push(lock(sub(root, scale(nrm, 0.03)), add(scale(nrm, 0.8), [0, 0, -0.8]), L * 1.2, L * 0.75, jitter(id) < 0.3 ? 'coatLight' : 'coat', nrm, 0.1));
    }
  }
  return merge(...out);
}

/**
 * The Moonhare's mane: long locks from the poll to the withers, in rows down the back and the sides of its neck, falling back and
 * down over its shoulders, each with a lilac tip -- a lock of cream and a shorter one of lilac off its end -- so it flows away
 * from the ruff in a lilac-edged fall of its own.
 */
function maneOf(s: Hare): Mesh {
  const N = s.neck, out: Mesh[] = [];
  // From just behind the ears, where the neck meets the skull, so it runs on from the crown with no step at the poll.
  for (let row = 0; row < 8; row++) {
    const z = lerp(N.len * 0.9, -0.2, row / 7);
    for (const a of [-1.25, -0.65, 0, 0.65, 1.25]) {
      // At the poll only the locks down the crest, so none stands out beside the jaw behind the eye.
      if (row < 2 && Math.abs(a) > 1) continue;
      const id = 400 + row * 7 + Math.round(a * 10);
      const nrm: V3 = [Math.sin(a), -Math.cos(a), 0];
      const root: V3 = add(neckEnd(s, z / N.len), [nrm[0] * N.w * 0.82, nrm[1] * N.w * 0.86, 0]);
      const L = s.mane * (0.7 + 0.4 * (row / 7)) * (0.88 + 0.24 * jitter(id)) * (Math.abs(a) > 1 ? 0.85 : 1);
      const way = unit(add(scale(nrm, 0.22), [0, -0.55, -0.85])), curl = 0.12;
      out.push(lock(root, way, L, L * 0.32, jitter(id + 2) < 0.3 ? 'coatLight' : 'coat', nrm, curl));
      // The tip: on along where the lock's own end goes, lilac.
    }
  }
  return merge(...out);
}

/**
 * The head: a round skull, a size too big on the kit, longer on the bigger two; a soft muzzle out of the front of it with a
 * pink nose and a small smile; violet eyes; a blush on each cheek and three lilac flecks on the brow; and, saddled, a
 * bridle. Its fluff is the ruff under it, not locks on the face, which in the shade under the jaw read as a grey scrap.
 */
function headOf(s: Hare, n: number, k: number, shut: boolean, tack: boolean): Mesh {
  const H = s.head, C = skullAt(s), sn = H.snout, mc = snoutAt(s), mr: V3 = [sn[0], sn[2], sn[1]];
  const skull = orb(C, H.r, n + 2, k + 2, 'coat');
  const muzzle = orb(mc, mr, n, k + 1, 'muzzle');
  const nt = onEgg2(mc, mr, [0, 0.8, 0.55]);
  const nose = paint([disc(add(nt.p, scale(nt.n, 0.012)), nt.n, sn[0] * 0.56, sn[0] * 0.4, 3, 'nose', { up: [0, 0, 1], spin: Math.PI / 2 })]);
  const mouth = smile(onEgg2(mc, mr, [0, 0.9, -0.3]).p, [0, 1, -0.35], sn[0] * 0.75, 'lid');
  const eye = eyes(C, H.r, s.eye.dir, s.eye.size, { tall: 1.2, iris: 'crystal', pupil: 0.52, glint: 0.36, shut });
  const cheeks = paint([1, -1].map((sd) => {
    const e = onEgg2(C, H.r, [sd * 0.72, 0.52, -0.38]);
    return disc(add(e.p, scale(e.n, 0.02)), e.n, s.eye.size * 1.25, s.eye.size * 0.75, 8, 'inner');
  }));
  const flecks = paint([[0, 0.55, 0.85], [0.28, 0.4, 0.9], [-0.28, 0.4, 0.9]].map((d, q) => {
    const e = onEgg2(C, H.r, d as V3);
    return disc(add(e.p, scale(e.n, 0.015)), e.n, s.eye.size * (q ? 0.42 : 0.5), s.eye.size * (q ? 0.3 : 0.36), 6, 'mark', { up: [0, 1, 0] });
  }));
  return merge(skull, muzzle, nose, mouth, eye, cheeks, flecks, tack && bridleOf(s));
}


/** Solids inside the head that hide what is round the far side of them: the skull and the muzzle. */
function headSolids(s: Hare): Array<{ c: V3; r: V3 }> {
  const H = s.head, sn = H.snout;
  return [{ c: skullAt(s), r: scale(H.r, 0.92) }, { c: snoutAt(s), r: [sn[0] * 0.85, sn[2] * 0.85, sn[1] * 0.85] }];
}

/**
 * An ear: tall and broad as a leaf, pointed, cupped forward; lilac-grey behind, darker toward its tip and cream fur at its root;
 * pink inside, with peach leaves up the middle of it. Up its own `z` from its root, its hollow toward `+y`.
 */
function earOf(s: Hare, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  const zs = [0, 0.12, 0.34, 0.58, 0.8, 0.94, 1].map((x) => x * L);
  const ws = [0.42, 0.82, 1, 0.98, 0.8, 0.46, 0.02].map((x) => x * w);
  const line = zs.map((z, q) => [0, -0.04 * Math.sin((q / 6) * Math.PI) * L * 0.2, z] as V3);
  const cup = (p: V3): V3 => [p[0], p[1] + 0.26 * w * Math.min(1, (p[0] / w) ** 2), p[2]];
  const shell = tube(line, ws, ws.map((x) => Math.max(0.025, x * 0.2)), Math.max(6, n), (ring) => (ring === 0 ? 'coat' : ring >= 5 ? 'shellDark' : 'shell'), { up: [0, 1, 0] });
  const cupped = mesh(shell.v.map(cup), shell.f);
  // The lining, inside the rim, on the hollow.
  const rim = (sd: number): V3[] => [1, 2, 3, 4, 5].map((q) => cup([sd * ws[q] * 0.66, line[q][1] + ws[q] * 0.2 + 0.014, zs[q]]));
  const lining: V3[] = [cup([0, line[0][1] + ws[0] * 0.2 + 0.014, zs[0] + L * 0.04]), ...rim(-1), cup([0, line[6][1] + 0.02, L * 0.95]), ...rim(1).reverse()];
  // The peach leaves: a fan of pointed leaves up the middle, from low in the ear.
  const leaves: Disc[] = [];
  const leaf = (x: number, z: number, ang: number, r: number): void => {
    const c = cup([x, ws[2] * 0.2 + 0.024, z]);
    const v = Array.from({ length: 6 }, (_, q) => {
      const t = (q / 6) * TAU, lx = Math.sin(t) * r * 0.38, lz = Math.cos(t) * r * (1 + 0.3 * Math.cos(t));
      return cup([c[0] + lx * Math.cos(ang) + lz * Math.sin(ang), c[1] + 0.004, c[2] + lz * Math.cos(ang) - lx * Math.sin(ang)]);
    });
    leaves.push(facing(v, [0, 1, 0], 'petal'));
  };
  leaf(0, L * 0.52, 0, w * 0.6);
  leaf(-w * 0.4, L * 0.38, -0.55, w * 0.48);
  leaf(w * 0.4, L * 0.38, 0.55, w * 0.48);
  leaf(-w * 0.3, L * 0.66, -0.4, w * 0.42);
  leaf(w * 0.3, L * 0.66, 0.4, w * 0.42);
  leaf(0, L * 0.22, 0, w * 0.48);
  leaf(0, L * 0.8, 0, w * 0.34);
  return merge(cupped, paint([facing(lining, [0, 1, 0], 'inner'), ...leaves]));
}

/** A paw: a soft lilac pad, longer than wide, four dark lilac-grey toes on its front and a claw on each. */
function pawOf(s: Hare, fore: boolean, n: number): Mesh {
  const r = s.paw * (fore ? 1 : 1.1);
  const pad = orbAlong([0, r * 0.25, -r * 0.35], [0, 1, 0], [r * 0.92, r * 1.25, r * 0.62], n, 4, 'spot');
  const toes: Mesh[] = [];
  for (let q = 0; q < 4; q++) {
    const x = (q - 1.5) * r * 0.48, y = r * 1.15 - Math.abs(q - 1.5) * r * 0.16;
    toes.push(orbAlong([x, y, -r * 0.6], [0, 1, -0.3], [r * 0.2, r * 0.26, r * 0.18], 5, 3, 'claw'));
  }
  return merge(pad, ...toes);
}

/**
 * The feathering down the back of a leg: locks hanging down and back off the forearm, or off the hind leg's shin and hock,
 * and on the Moonhare round the top of its paws. In the part's own frame, the bone down `-z`.
 */
function featherOf(s: Hare, length: number, w: number, count: number, from: number, seed: number): Mesh {
  const out: Mesh[] = [];
  for (let q = 0; q < count; q++) {
    const z = -length * lerp(from, 0.95, q / Math.max(1, count - 1)), id = seed + q;
    for (const a of [-0.45, 0.45]) {
      const nrm: V3 = [Math.sin(a), -Math.cos(a), 0];
      const L = s.feather * (0.6 + 0.5 * q / count) * (0.85 + 0.3 * jitter(id + a * 7));
      out.push(lock(add([0, 0, z], scale(nrm, w * 0.85)), add(scale(nrm, 0.7), [0, 0, -0.75]), L, L * 0.32, jitter(id + 3 + a) < 0.25 ? 'coatLight' : 'coat', nrm));
    }
  }
  return merge(...out);
}

/**
 * A link of a plume: a core of fur, lilac on the inside of its curl and cream outside, and locks all round it standing out and
 * back, longest down its outside, so a curled plume is a big soft curl with lilac in its heart.
 */
function plumeLinkOf(s: Hare, q: number, lilac: Mat, seed: number, second: boolean): Mesh {
  const T = s.tail, L = T.links[q], w0 = T.w[q], w1 = T.w[Math.min(q + 1, T.w.length - 1)], n = 8;
  const k = second ? 0.6 : 1;
  const core = tube([[0, 0.05, 0], [0, -L * 0.5, 0], [0, -L - 0.03, 0]], [w0 * k, (w0 + w1) * 0.5 * k, w1 * k], [w0 * k, (w0 + w1) * 0.5 * k, w1 * k], n,
    (_ring, j) => (Math.sin(((j + 1) / n) * TAU) > -0.15 ? lilac : 'coat'), { start: q === 0 ? false : undefined, end: false });
  const out: Mesh[] = [core];
  const last = q === T.links.length - 1;
  for (let c = 0; c < 6; c++) {
    const a = (c / 6) * TAU + q * 0.5, nrm: V3 = [Math.cos(a), 0, Math.sin(a)];
    // Lying back along the plume and standing a little out of it: short and lilac up the inside of the curl, its `+z`; long
    // and cream round its outside, so its edge is a soft jag.
    const inside = Math.sin(a) > 0.1;
    const id = seed + q * 13 + c;
    const Lk = L * (inside ? 0.6 : 0.85) * (0.85 + 0.3 * jitter(id));
    const root: V3 = [nrm[0] * w0 * 0.75 * k, L * 0.1, nrm[2] * w0 * 0.75 * k];
    out.push(lock(root, add(scale(nrm, inside ? 0.2 : 0.42), [0, -1, 0]), Lk, w0 * k * (inside ? 0.7 : 0.85), inside ? lilac : jitter(id) < 0.3 ? 'coatLight' : 'coat', nrm, 0.12));
  }
  if (last) out.push(lock([0, -L * 0.5, 0], [0, -1, 0.3], w1 * 2.6 * k, w1 * 1.1 * k, 'coat', [0, 0, 1], 0.5));
  return merge(...out);
}

/* ---- tack ------------------------------------------------------------------------------------------- */

/**
 * The saddle: a small seat of lilac leather over the top of its back where a rider sits, a pommel at the front and a cantle
 * behind, a flap down each side and a girth round under its chest; in the trunk's frame.
 */
function saddleOf(s: Hare, n: number): Mesh {
  const B = s.body, y = s.seat, r = ringAt(B, y), top = r.z + r.h;
  const L = s.len * 0.2;
  const seat = tube([[0, y - L, top - 0.02], [0, y, top - 0.05], [0, y + L, top - 0.02]], [r.w * 0.66, r.w * 0.7, r.w * 0.62], [SADDLE_H * 1.6, SADDLE_H * 1.4, SADDLE_H * 1.6], n, 'leather');
  const pommel = orb([0, y + L * 0.95, top + SADDLE_H * 0.8], [r.w * 0.26, L * 0.16, SADDLE_H * 1.3], 6, 3, 'leatherDark');
  const cantle = orb([0, y - L * 0.95, top + SADDLE_H * 0.9], [r.w * 0.42, L * 0.16, SADDLE_H * 1.5], 6, 3, 'leatherDark');
  const flaps = paint([1, -1].map((sd) => {
    const e = onRings(B, y, sd > 0 ? 0.45 : Math.PI - 0.45);
    return onBarrel(B, disc(e.p, e.n, L * 0.5, r.h * 0.3, 8, 'leather', { up: [0, 0, 1] }), 0.02);
  }));
  // The girth: a band of the barrel's own shape round it, a little out from it, from flap to flap under the chest.
  const gy = y + L * 0.5, g = ringAt(B, gy);
  const girth = tube([[0, gy - 0.035, g.z], [0, gy + 0.035, g.z]], g.w * 1.04, g.h * 1.04, n + 2, 'leatherDark', { start: false, end: false });
  const rings = merge(...[1, -1].map((sd) => orb([sd * g.w * 1.02, gy, g.z + g.h * 0.2], 0.035, 5, 3, 'metal')));
  return merge(seat, pommel, cantle, flaps, girth, rings);
}

/** A thin painted line along a run of points on a surface, `w` wide. */
function strapOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number, d: V3): V3 => add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  const dirs = pts.map((q, i) => unit(cross(q.n, sub(pts[Math.min(i + 1, pts.length - 1)].p, pts[Math.max(i - 1, 0)].p))));
  return facing([...pts.map((q, i) => up(q, 1, dirs[i])), ...[...pts].reverse().map((q, i) => up(q, -1, dirs[pts.length - 1 - i]))], pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** The bridle: a noseband round the muzzle, a cheek strap up each side of the face to a band behind the ears, and a bit ring at each corner of the mouth. */
function bridleOf(s: Hare): Mesh {
  const H = s.head, C = skullAt(s), mc = snoutAt(s), sn = H.snout, mr: V3 = [sn[0], sn[2], sn[1]];
  const w = H.r[0] * 0.07;
  const band = Array.from({ length: 11 }, (_, q) => { const a = -0.35 * Math.PI + (q / 10) * 1.7 * Math.PI; return onEgg2(mc, mr, [Math.cos(a), -0.15, Math.sin(a)]); });
  const cheek = (sd: number): Disc => strapOn(Array.from({ length: 6 }, (_, q) => onEgg2(C, H.r, [sd * 0.95, lerp(0.35, -0.42, q / 5), lerp(-0.5, 0.75, q / 5)])), w, 'leather');
  const crown = strapOn(Array.from({ length: 7 }, (_, q) => onEgg2(C, H.r, [lerp(-0.9, 0.9, q / 6), -0.5, 0.75])), w, 'leather');
  const bits = merge(...[1, -1].map((sd) => orb(add(onEgg2(mc, mr, [sd, 0.1, -0.35]).p, [sd * 0.02, 0, 0]), sn[0] * 0.2, 5, 3, 'metal')));
  return merge(paint([strapOn(band, w, 'leatherDark'), cheek(1), cheek(-1), crown]), bits);
}

/** Where the bit is, in the head's frame, on the side `sd`; and where the reins come to on the saddle, in the trunk's. */
const bitAt = (s: Hare, sd: number): V3 => { const mc = snoutAt(s), sn = s.head.snout; return add(onEgg2(mc, [sn[0], sn[2], sn[1]], [sd, 0.1, -0.35]).p, [sd * 0.03, 0, 0]); };
const pommelAt = (s: Hare, sd: number): V3 => { const r = ringAt(s.body, s.seat); return [sd * r.w * 0.3, s.seat + s.len * 0.19, r.z + r.h + SADDLE_H]; };

/* ---- pieces ------------------------------------------------------------------------------------------- */

/** A stage's pieces; saddled and bridled with `tack`. */
function hareBuild(s: Hare, lod: number, tack: boolean): Piece[] {
  fineLocks = !!lod;
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6), B = s.body;
  const pieces: Piece[] = [];
  const mid = ringAt(B, 0);
  const barrel = { c: [0, (B.y[0] + B.y[B.y.length - 1]) / 2, mid.z] as V3, r: [mid.w * 0.95, (B.y[B.y.length - 1] - B.y[0]) * 0.47, mid.h * 0.95] as V3 };
  // Cut finely round, so the toon light's three steps go round it in curves and not at a box's edges.
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 9), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  if (s.stage === 0) pieces.push({ key: 'fluff', mesh: fluffOf(s), bone: 'trunk', bias: 0.04, after: ['body', 'hl0', 'hr0', 'fl0', 'fr0'], lines: false, hide: [barrel] });
  pieces.push({ key: 'ruff', mesh: ruffOf(s, n), bone: 'trunk', bias: 0.06, after: ['body', 'fl0', 'fr0'], front: [0, 1, 0], lines: false, hide: [barrel] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: ['head', 'body', 'ruff', 'neckFur'] });
  pieces.push({ key: 'neckFur', mesh: neckFurOf(s), bone: 'neck', bias: 0.02, after: ['neck', 'ruff'], lines: false });
  if (s.mane) pieces.push({ key: 'mane', mesh: maneOf(s), bone: 'neck', bias: 0.03, after: ['neck', 'body'], front: [0, -1, 0], lines: false, hide: headSolids(s), hideIn: 'head' });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false, tack), shut: headOf(s, n, k, true, tack), bone: 'head', bias: 0.2, after: 'neckFur', hide });
  const ear = earOf(s, n);
  // Both ears over the head from every side, what of each is round the far side of the skull hidden by it, the two going down far to near.
  for (const q of [0, 1]) pieces.push({ key: `ear${q}`, mesh: q ? ear : mirrorX(ear), bone: `ear${q}`, bias: 0.19, after: 'head', hide, hideIn: 'head' });
  s.tail.links.forEach((_, q) => pieces.push({ key: `tail${q}`, mesh: plumeLinkOf(s, q, 'shell', 900, false), bone: `tail${q}`, bias: -0.05 + q * 0.01, chain: 'tail', lines: false }));
  if (s.tail.plumes === 2) s.tail.links.forEach((_, q) => pieces.push({ key: `plume${q}`, mesh: plumeLinkOf(s, q, 'spot', 950, true), bone: `plume${q}`, bias: -0.06 + q * 0.01, chain: 'plume', lines: false }));
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const sideV: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    // The upper leg: a round shoulder, or a hare's big haunch, on the flank, and the leg out of it to the elbow or the stifle.
    const hw = fore ? w * 1.4 : w * 2.3;
    const upperM = merge(
      orb([0, fore ? 0 : -w * 0.15, fore ? 0 : -w * 0.2], [hw, hw * (fore ? 1.1 : 1.15), hw * (fore ? 1.2 : 1.1)], n, k, 'coat'),
      tube([[0, 0, -w * 0.3], [0, 0, -L[0]]], [hw * 0.8, w * 0.85], [hw * 0.8, w * 0.85], n, 'coat', { seam: 'start' }),
      orb([0, 0, -L[0]], w * 0.86, n, k, 'coat'),
    );
    // The haunch carries a few dapples of its own.
    const haunchSpots = !fore && paint([0, 1, 2].slice(0, s.stage + 1).map((q) => {
      const e = onEgg2([0, -w * 0.15, -w * 0.2], [hw, hw * 1.15, hw * 1.1], [side, -0.3 + 0.5 * q, 0.35 - 0.3 * q]);
      return disc(add(e.p, scale(e.n, 0.012)), e.n, s.dapple * 1.1, s.dapple * 0.7, 7, 'mark', { up: [0, 1, 0] });
    }));
    // The lower leg cream at the top and lilac down to the paw, as the shading in its fur goes.
    const lowerM = tube([[0, 0, w * 0.5], [0, 0, -L[1] * 0.45], [0, 0.01, -L[1]]], [w * 0.86, w * 0.64, w * 0.44], [w * 0.9, w * 0.68, w * 0.46], n, (ring) => (ring >= 1 ? 'spot' : 'coat'), { seam: 'start' });
    const lastM = tube([[0, 0, w * 0.35], [0, 0.01, -L[2] - s.paw * 0.2]], [w * 0.42, w * 0.34], [w * 0.44, w * 0.36], n, 'spot', { seam: 'start' });
    // The Moonhare's right fore paw comes up to its face to wash its ear: on its near side it goes over the ruff, the face and the ear.
    const up = s.stage === 2 && i === 1 ? ['ruff', 'neckFur', 'mane', 'head', 'ear1'] : [], low = up.length ? sideV : out3;
    pieces.push(
      { key: `${key}0`, mesh: merge(upperM, haunchSpots), bone: `${key}0`, bias: 0.01, after: ['body'], front: sideV },
      { key: `${key}1`, mesh: lowerM, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`, ...up], front: low },
      { key: `${key}3`, mesh: lastM, bone: `${key}3`, bias: 0.025, after: ['body', `${key}1`, ...up], front: low },
      { key: `${key}2`, mesh: pawOf(s, fore, n), bone: `${key}2`, bias: 0.03, after: ['body', `${key}3`, ...up], front: low },
      { key: `${key}f`, mesh: fore ? featherOf(s, L[1], w * 0.7, s.stage + 2, 0.12, 500 + i * 20) : featherOf(s, L[1], w * 0.7, s.stage + 1, 0.55, 600 + i * 20), bone: `${key}1`, bias: 0.022, after: [`${key}1`], front: [0, -1, 0], lines: false },
    );
    if (s.stage === 2) pieces.push({ key: `${key}g`, mesh: featherOf(s, L[2], w * 0.5, 2, 0.3, 700 + i * 20), bone: `${key}3`, bias: 0.027, after: [`${key}3`], front: [0, -1, 0], lines: false });
  }
  if (tack) pieces.push({ key: 'saddle', mesh: saddleOf(s, n), bone: 'trunk', bias: 0.1, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0'] });
  // Everything on the trunk bends with its back as it bounds (`flexOf`), as the legs, the neck and the plume come out of it.
  const bend = (v: readonly V3[], a: Anim): V3[] => { const f = flexOf(s, a); return f ? v.map((p) => flexPt(s, p, f)) : [...v]; };
  return pieces.map((pc) => (pc.bone === 'trunk' ? { ...pc, bent: bend } : pc));
}

/** The same mesh left for right, its faces wound back the right way out. */
const mirrorX = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const DUST: RGB = [214, 200, 182];
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const bigness = (s: Hare): number => 0.6 + 0.4 * (s.len / 2.6);

/** A puff of dust: a soft cloud of three lobes, growing as it goes and thinning to nothing over its life (`age`). */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0, base: RGB = DUST): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.45 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
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

/** A wisp of fur drifting: a short soft curl of cream, inked lightly, turning as it falls. */
function wisp(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, 1.6 / px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.lineCap = 'round';
  g.strokeStyle = css(mix(c, [90, 70, 100], 0.5), al * 0.8);
  g.lineWidth = Math.max(r * 0.55, 0.9 / px);
  g.beginPath();
  g.moveTo(-r, 0);
  g.quadraticCurveTo(0, -r * 0.8, r, 0);
  g.stroke();
  g.strokeStyle = css(c, al);
  g.lineWidth = Math.max(r * 0.32, 0.5 / px);
  g.stroke();
  g.restore();
}

/** Wisps of fur shaken off from `from`, `since` seconds after, out and drifting down. */
function shed(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, size: number, life = 0.6): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.6 * jitter(k + 1));
    const p: V3 = [from[0] + Math.cos(a) * sp * since, from[1] + Math.sin(a) * sp * since, from[2] + (1.2 * jitter(k + 2) - 0.4) * since - 0.6 * since * since];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    wisp(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), k + since * (3 + 4 * jitter(k + 4)), q % 3 ? [252, 246, 240] : [222, 182, 220], 1 - smooth((since - life * 0.5) / (life * 0.5)));
  }
}

/** What a strike throws: dust where its feet land, the Moonhare's a ring of it, and a few wisps of fur off it. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Hare, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t;
  const hits = s.stage === 0 ? [HARE_HITS[0], KIT_JAB] : [HARE_HITS[s.stage]];
  for (const [q, h] of hits.entries()) {
    const since = (t - h) * ACT_SECS.strike;
    if (since <= 0 || since > 0.5) continue;
    if (s.stage === 0) {
      const p = place(b[q ? 'fr2' : 'fl2'], [0, s.paw, 0]);
      shed(g, view, mid, p, since, front, 4, 40 + q * 9, 1.4 * big, 0.12 * big);
      continue;
    }
    const feet = s.stage === 1 ? ['hl2', 'hr2'] : ['fl2', 'fr2'];
    for (const [j, f] of feet.entries()) {
      const p = place(b[f], [0, 0, 0]);
      const ground: V3 = [p[0], p[1], 0.1];
      if (s.stage === 2) {
        const rx = big * (0.6 + 2.2 * ramp(since, 0, 0.4));
        for (let c = 0; c < 6; c++) {
          const th = (c / 6) * TAU + j, at: V3 = [ground[0] + Math.cos(th) * rx, ground[1] + Math.sin(th) * rx * 0.7, 0.12 * big];
          if (nearSide(at, mid, view) === front) puff(g, view, at, big * 0.45, since / 0.5, 30 + c + j * 7);
        }
      } else {
        shed(g, view, mid, p, since, front, 4, 60 + j * 11, 1.6 * big, 0.12 * big);
        if (nearSide(p, mid, view) === front) puff(g, view, p, 0.35 * big, since / 0.4, 5 + j);
      }
    }
  }
}

/** What a go at its task throws: a puff of dust at each thump of the kit's foot, a few wisps off the courser's nibbles and shake and the Moonhare's ear. */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Hare, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, loop = a.graze >= 0.5, W = HARE_WORK;
  const since = (t0: number): number => (t < t0 && !loop ? -1 : frac(t - t0) * ACT_SECS.work);
  if (s.stage === 0) {
    for (const [q, h] of W.thumps.entries()) {
      const dt = since(h);
      if (dt < 0 || dt > 0.45) continue;
      const p = place(b.hr2, [0, 0, 0]);
      for (const sd of [-1, 1]) {
        const at: V3 = [p[0] + sd * 0.2 * (1 + ramp(dt, 0, 0.3)), p[1], 0.08];
        if (nearSide(at, mid, view) === front) puff(g, view, at, 0.25 * big, dt / 0.45, q * 3 + sd);
      }
    }
    return;
  }
  const at = s.stage === 1 ? [...W.nibbles, W.shake] : [...W.strokes, W.flick];
  for (const [q, h] of at.entries()) {
    const dt = since(h);
    const from = s.stage === 1 && q < 3 ? place(b.head, snoutAt(s)) : place(b.ear1, [0, 0, s.ear.len * 0.55]);
    shed(g, view, mid, from, dt, front, q === at.length - 1 ? 5 : 2, 80 + q * 13, 0.9 * big, 0.1 * big, 0.7);
  }
}

/** Evolving: moonlit motes and wisps of fur swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Hare, b: Bones, t: number, front: boolean): void {
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
    wisp(g, x, y, 0.13 * big * (1 - 0.4 * u), ang * 2 + q, q % 2 ? [252, 248, 242] : [214, 176, 226], swirl * ramp(u, 0, 0.15));
  }
}

/** The reins, saddled: from the bit at each side of its mouth back along its neck to the front of the saddle, slack; each drawn on the side it is on. */
function reins(g: CanvasRenderingContext2D, view: View, s: Hare, b: Bones, front: boolean): void {
  const T = view.T, mid = place(b.neck, [0, 0, s.neck.len * 0.5]);
  g.save();
  g.lineCap = 'round';
  const tr = g.getTransform(), px = 1 / (Math.hypot(tr.a, tr.b) || 1);
  for (const sd of [-1, 1]) {
    const a = place(b.head, bitAt(s, sd)), e = place(b.trunk, pommelAt(s, sd));
    const m: V3 = [(a[0] + e[0]) / 2 + sd * 0.1 * turn(b.neck, [1, 0, 0])[0], (a[1] + e[1]) / 2, (a[2] + e[2]) / 2 - 0.12 * s.len];
    const near = dot(sub(m, mid), T) > 0;
    if (near !== front) continue;
    const A = onScreen(view, a), M = onScreen(view, m), E = onScreen(view, e);
    for (const [ink, w] of [['rgba(70,44,64,0.9)', Math.max(1.1 * px, 0.09)], ['rgb(170,122,156)', Math.max(0.55 * px, 0.045)]] as Array<[string, number]>) {
      g.strokeStyle = ink;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(A[0], A[1]);
      g.quadraticCurveTo(2 * M[0] - (A[0] + E[0]) / 2, 2 * M[1] - (A[1] + E[1]) / 2, E[0], E[1]);
      g.stroke();
    }
  }
  g.restore();
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, fusses and evolves; saddled and bridled with `tack`. */
function hareKind(s: Hare, tack: boolean): Kind {
  const bones = hareBones(s);
  return {
    bones,
    build: (lod) => hareBuild(s, lod, tack),
    // The variant's coat tints its cream and its markings the lilac of its dapples and its legs, by as much as each has colour
    // in it; its ears, eyes, nose and toes are the same on every variant, so every one of them is a moon-pale hare.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const cream = mix([253, 247, 238], pastel(coat, 280), 0.18 * clamp(sat(coat) / 0.35));
      const lilac = mix([212, 148, 204], pastel(mark, 290), 0.3 * clamp(sat(mark) / 0.35));
      const leg = mix([216, 198, 238], pastel(mark, 280), 0.25 * clamp(sat(mark) / 0.35));
      return coatPalette(coat, mark, {
        coat: cream,
        coatLight: mix(cream, [255, 255, 252], 0.5),
        coatDark: mix(cream, [214, 196, 222], 0.5),
        belly: cream,
        muzzle: mix(cream, [255, 252, 250], 0.4),
        mark: lilac,
        spot: leg,
        shell: [172, 154, 190],
        shellDark: [138, 120, 160],
        inner: [248, 194, 198],
        petal: [250, 188, 146],
        nose: [238, 136, 160],
        lid: [108, 78, 118],
        eye: [52, 32, 68],
        glint: [255, 253, 246],
        crystal: [146, 104, 200],
        claw: [112, 96, 128],
        leather: [176, 128, 164],
        leatherDark: [134, 92, 126],
        metal: [214, 210, 226],
      } as Partial<ReturnType<Kind['palette']>>, 280);
    },
    shadow: [s.len * 0.75 + 0.4, s.body.w[3] * 1.4],
    stride: 1,
    size: s.size,
    acts: ['strike', 'work'],
    // Bounding at a run it is carried through the air between its footfalls (`leapOf`) -- but not saddled, when it carries a
    // rider who sits where it is, not where its leap has it.
    leaps: tack ? undefined : [false, true],
    motes: [[220, 184, 230], [252, 248, 240]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (tack) reins(g, view, s, b, front);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

const LOOKS = [THISTLEKIT_LOOK, BUNNYCOURSER_LOOK, MOONHARE_LOOK] as const;

export const THISTLEKIT = hareKind(THISTLEKIT_LOOK, false);
export const BUNNYCOURSER = hareKind(BUNNYCOURSER_LOOK, false);
export const MOONHARE = hareKind(MOONHARE_LOOK, false);
/** Each stage saddled and bridled, as it is drawn once it has been tacked to be ridden. */
export const HARE_TACKED: readonly [Kind, Kind, Kind] = [hareKind(THISTLEKIT_LOOK, true), hareKind(BUNNYCOURSER_LOOK, true), hareKind(MOONHARE_LOOK, true)];

/** How high a rider sits on each stage, in screen pixels at zoom one over its feet, grown: the top of its saddle. */
export const hareSeat = (stage: number): number => {
  const s = LOOKS[Math.max(0, Math.min(2, stage))];
  return seatOf(s) * HEIGHT_SCALE * s.size;
};

/**
 * How far its rider's legs are drawn up on each stage (`Seat.tuck`): on the kit, knees high and boots up at its sides, a child's
 * pony; on the courser a little, short in the stirrups so the boots ride above its knees; on the Moonhare not at all.
 */
export const HARE_TUCK: readonly number[] = [0.9, 0.35, 0];

/**
 * Where its rider's reins go to on each stage: its bit, standing, in the rider's own units from the top of the saddle -- across,
 * forward and up (`Seat.grip`), grown.
 */
export const hareGrip = (stage: number): V3 => {
  const st = Math.max(0, Math.min(2, stage)), s = LOOKS[st], b = HARE_TACKED[st].bones({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
  const bit = scale(add(place(b.head, bitAt(s, 1)), place(b.head, bitAt(s, -1))), 0.5);
  return [0, bit[1] * s.size, (bit[2] - seatOf(s)) * s.size];
};
