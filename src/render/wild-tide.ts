import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, darker, DEG, disc, dot, drift, eyes, frac, lerp, merge, mix, orb, orbAlong, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { HEIGHT_SCALE } from './iso';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The tide line: the Springlet, a small sleek cream creature on four short
 * legs, otter and axolotl both, with a crown of petal-fins standing up and
 * back off its head and a feathery fin of a tail; which grows into the
 * Springsail, longer in the leg and sleeker, its crown fanned bigger and
 * running on down its neck as a mane, fins along its back and down its fore
 * legs, and a long fin of a tail curled round; and then the Tidecourser,
 * large and tall in the neck, a great swept-back crown and mane, fins down
 * its back and on all four legs, and a long sweeping tail of several lobes.
 * All three are cream, with faint gold flecks along them; every fin is
 * pale yellow at its root going to its variant's markings at its tip, a gold
 * vein down it; a short snout with a pink nose, amber eyes, a closed smile,
 * and webbed feet with pink toes. The species is `springlet`: a mount, slow
 * on land and fast in deep water, ridden saddled and bridled.
 *
 * Built the way the hare line is (`./wild-hare`): one set of functions from
 * a description of each stage (`Tide`), every foot given a point to be at
 * and its leg bent to reach it. On land it walks slowly and carefully, its
 * feet lifted high and set down flat, rolling a little from side to side, its
 * fins trailing; going fast -- swimming -- it glides in long bounds, its back
 * drawn up and let out, its crown and fins streamed back and its tail
 * rippling up and down behind it. Its fins are bent as it goes (`Piece.bent`),
 * each petal fluttering on its own beat standing, streamed back going, and
 * flared at a strike.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** A row of petal-fins: how many, how far up from straight back (degrees), how far round to either side, how long and how wide. */
interface Row { n: number; el: number; spread: number; len: number; w: number }

interface Tide {
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
  /** A foot's size. */
  paw: number;
  /** How far behind its shoulder a fore foot stands, and behind its hip a hind one. */
  stance: [number, number];
  /** How high the middle of the barrel is carried. */
  high: number;
  /** Where along its back its saddle is: the body is carried that far ahead of where the island has it, so its rider sits there. */
  seat: number;
  /** The neck's root on the body, its length, its girth and how far forward of upright it leans. */
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes; the snout's (across, up, along); how far up the skull sits; its pitch. */
  head: { r: V3; snout: V3; up: number; pitch: number };
  eye: { dir: V3; size: number };
  /** The crown's rows of petals off the back of its skull, innermost first. */
  crown: Row[];
  /** The mane: petals in rows down the back of its neck, how many rows and how long; nought for none. */
  mane: { rows: number; len: number; w: number };
  /** Petals along its back, how many and how long: over the withers and over the croup, clear of where the saddle goes. */
  back: { n: number; len: number; w: number };
  /** Petals down the back of each fore leg and at each hock: how many, and how long. */
  legFin: { n: number; len: number };
  /** The tail's root, each link's length and girth, how far it is lifted and curled at each link, and its petals' length. */
  tail: { at: V3; links: number[]; w: number[]; lift: number; curl: number; fin: number; fan: number };
  /** A second, lower lobe of the tail trailing behind: its links' lengths, lifted, curled; none for a single tail. */
  lobe: { links: number[]; lift: number; curl: number; fin: number } | null;
  /** How much fine gold lining along its flanks: a line of dashes either side for every eight. */
  flecks: number;
  gait: {
    /** How much of a stride a foot is down at a walk and at a run; how far it sweeps, against the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against its reach; how far the body sinks at each footfall; how far the back is drawn up in a bound (degrees at each end). */
    step: number; bob: number; flex: number;
  };
  size: number;
}

/** A Springlet: small and round on short legs, a big round head, a tall crown of petals and a petal plume of a tail held up. */
const SPRINGLET_LOOK: Tide = {
  stage: 0,
  body: { y: [-0.84, -0.74, -0.42, 0, 0.4, 0.7, 0.84], z: [0.08, 0.06, 0.04, 0.04, 0.05, 0.08, 0.12], w: [0.2, 0.34, 0.42, 0.47, 0.5, 0.46, 0.3], h: [0.18, 0.3, 0.39, 0.44, 0.47, 0.44, 0.3] },
  len: 1.22, hip: 0.66, drop: 0.3,
  fore: [0.28, 0.27, 0.11], hind: [0.3, 0.26, 0.24], thick: 0.2, rake: [8, 24], paw: 0.17, stance: [0.04, 0.08],
  high: 0.74,
  seat: -0.12,
  neck: { at: [0, 0.66, 0.22], len: 0.34, w: 0.29, lean: 18 },
  head: { r: [0.5, 0.5, 0.46], snout: [0.25, 0.2, 0.3], up: 0.14, pitch: 8 },
  eye: { dir: [0.6, 0.62, 0.3], size: 0.09 },
  crown: [
    { n: 5, el: 60, spread: 28, len: 1.0, w: 0.132 },
    { n: 6, el: 38, spread: 44, len: 1.15, w: 0.139 },
    { n: 6, el: 16, spread: 56, len: 1.05, w: 0.132 },
  ],
  mane: { rows: 0, len: 0, w: 0 },
  back: { n: 0, len: 0, w: 0 },
  legFin: { n: 1, len: 0.32 },
  tail: { at: [0, -0.82, 0.2], links: [0.3, 0.28, 0.26], w: [0.13, 0.11, 0.08], lift: 8, curl: 28, fin: 0.82, fan: 1.0 },
  lobe: null,
  flecks: 10,
  gait: { duty: [0.7, 0.32], swing: [0.24, 0.36], step: 0.26, bob: 0.05, flex: 10 },
  size: 4.6,
};

/** A Springsail: longer in the leg and sleeker, a bigger crown running on down its neck, fins along its back and fore legs, a long curled tail. */
const SPRINGSAIL_LOOK: Tide = {
  stage: 1,
  body: { y: [-1.24, -1.1, -0.74, -0.06, 0.54, 0.94, 1.18, 1.28], z: [0.12, 0.1, 0.12, 0.13, 0.06, -0.02, 0, 0.05], w: [0.26, 0.4, 0.42, 0.38, 0.46, 0.52, 0.48, 0.3], h: [0.25, 0.4, 0.43, 0.39, 0.54, 0.62, 0.56, 0.32] },
  len: 1.66, hip: 0.64, drop: 0.3,
  fore: [0.66, 0.64, 0.18], hind: [0.68, 0.56, 0.5], thick: 0.25, rake: [8, 26], paw: 0.15, stance: [0.06, 0.16],
  high: 1.6,
  seat: -0.26,
  neck: { at: [0, 1.06, 0.34], len: 1.08, w: 0.3, lean: 24 },
  head: { r: [0.42, 0.52, 0.4], snout: [0.22, 0.18, 0.36], up: 0.1, pitch: 6 },
  eye: { dir: [0.6, 0.62, 0.3], size: 0.085 },
  crown: [
    { n: 5, el: 60, spread: 26, len: 1.35, w: 0.155 },
    { n: 6, el: 38, spread: 42, len: 1.55, w: 0.171 },
    { n: 7, el: 16, spread: 54, len: 1.45, w: 0.155 },
  ],
  mane: { rows: 4, len: 1.1, w: 0.15 },
  back: { n: 6, len: 0.95, w: 0.14 },
  legFin: { n: 3, len: 0.8 },
  tail: { at: [0, -1.24, 0.3], links: [0.36, 0.36, 0.35, 0.34, 0.32, 0.3, 0.27], w: [0.15, 0.14, 0.12, 0.1, 0.08, 0.07], lift: 10, curl: -20, fin: 0.82, fan: 1.05 },
  lobe: null,
  flecks: 18,
  gait: { duty: [0.72, 0.3], swing: [0.24, 0.38], step: 0.24, bob: 0.05, flex: 12 },
  size: 4.0,
};

/** A Tidecourser: large, tall in the neck, a great crown and mane, fins on its back and all four legs, a long tail of several lobes. */
const TIDECOURSER_LOOK: Tide = {
  stage: 2,
  body: { y: [-1.62, -1.46, -0.98, -0.1, 0.64, 1.2, 1.54, 1.68], z: [0.16, 0.14, 0.16, 0.16, 0.06, -0.08, -0.04, 0.06], w: [0.42, 0.64, 0.68, 0.62, 0.74, 0.84, 0.76, 0.46], h: [0.42, 0.64, 0.68, 0.62, 0.86, 1.02, 0.92, 0.52] },
  len: 2.25, hip: 0.64, drop: 0.3,
  fore: [1.02, 1.0, 0.26], hind: [1.04, 0.86, 0.8], thick: 0.34, rake: [8, 26], paw: 0.21, stance: [0.08, 0.22],
  high: 2.45,
  seat: -0.38,
  neck: { at: [0, 1.44, 0.6], len: 1.8, w: 0.44, lean: 20 },
  head: { r: [0.52, 0.66, 0.48], snout: [0.27, 0.21, 0.46], up: 0.12, pitch: 12 },
  eye: { dir: [0.6, 0.62, 0.3], size: 0.1 },
  crown: [
    { n: 6, el: 60, spread: 26, len: 1.95, w: 0.202 },
    { n: 7, el: 38, spread: 42, len: 2.25, w: 0.217 },
    { n: 7, el: 16, spread: 54, len: 2.1, w: 0.202 },
  ],
  mane: { rows: 6, len: 1.6, w: 0.19 },
  back: { n: 8, len: 1.4, w: 0.19 },
  legFin: { n: 4, len: 1.15 },
  tail: { at: [0, -1.62, 0.44], links: [0.55, 0.55, 0.52, 0.5, 0.46, 0.42, 0.38], w: [0.22, 0.2, 0.18, 0.15, 0.12, 0.1, 0.08], lift: 64, curl: -15, fin: 1.3, fan: 1.7 },
  lobe: { links: [0.55, 0.52, 0.48, 0.44, 0.4], lift: -30, curl: -4, fin: 1.15 },
  flecks: 26,
  gait: { duty: [0.72, 0.28], swing: [0.22, 0.36], step: 0.22, bob: 0.05, flex: 11 },
  size: 3.7,
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
/** Where a direction out of the middle of an egg meets its shell, and the way out of it there. */
const onEgg2 = (c: V3, r: V3, dir: V3): { p: V3; n: V3 } => {
  const d = unit(dir), k = 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);
  const p = add(c, scale(d, k));
  return { p, n: unit([(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]) };
};
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
 * When each stage's strike lands, as a share of the strike: the Springlet's pounce onto its fore feet, the Springsail's tail
 * whipped round, the Tidecourser's fore feet brought down off its rear.
 */
export const TIDE_HITS: readonly number[] = [0.46, 0.5, 0.58];
/**
 * A go at its task, as shares of it. It has no task, so it preens: turns its head round to its flank and runs a fin through its
 * mouth (`nibbles`), comes back round, and shakes itself from its head to its tail (`shake`).
 */
export const TIDE_WORK = { nibbles: [0.3, 0.42, 0.54] as const, shake: 0.8 } as const;

/* ---- where its feet go ---------------------------------------------------------------- */

/** A pose: where each foot is (along the ground, from under the body's middle), how far its last part is folded, and how the rest is carried. */
interface Plan {
  at: V3[];
  /** How far each pastern or long foot leans back past standing (degrees), and the foot pitched toe-up past level with it. */
  rake: number[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The neck bent forward and turned left; the head pitched nose-up, turned left and tilted. */
  neck: [number, number]; head: [number, number, number];
  /** The tail lifted, swung to the left, and curled past how it is carried. */
  tail: [number, number, number];
  /** A wave down the tail: how far each link swings to the side and lifts (degrees), and where the wave is (radians). */
  wave: [number, number, number];
}

interface Rest {
  /** Each shoulder and hip, in the body's frame; each foot standing, along the ground. */
  hip: V3[]; paw: V3[];
  reach: number[];
}

const rests = new Map<Tide, Rest>();
function restOf(s: Tide): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], paw: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    hip.push([SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop]);
    // Under the body and a little wider than the hips, splayed as a swimmer's are on land.
    paw.push([SIDE[i] * r.w * s.hip * 1.05, y - s.stance[fore ? 0 : 1] - s.seat, s.paw * 0.5]);
    reach.push(L[0] + L[1] + L[2]);
  }
  const R = { hip, paw, reach };
  rests.set(s, R);
  return R;
}

function restPlan(s: Tide, R: Rest): Plan {
  return {
    at: R.paw.map((a) => [...a] as V3), rake: [0, 0, 0, 0], foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], tail: [0, 0, 0], wave: [0, 0, 0],
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), rake: a.rake.map((x, i) => m(x, b.rake[i])), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1]), m(a.tail[2], b.tail[2])],
    // The wave's place goes with whichever has more of it, so it is never drawn halfway between two places.
    wave: [m(a.wave[0], b.wave[0]), m(a.wave[1], b.wave[1]), k < 0.5 ? a.wave[2] : b.wave[2]],
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
    tail: [d(p.tail[0], to.tail[0], from.tail[0]), d(p.tail[1], to.tail[1], from.tail[1]), d(p.tail[2], to.tail[2], from.tail[2])],
    wave: [d(p.wave[0], to.wave[0], from.wave[0]), d(p.wave[1], to.wave[1], from.wave[1]), to.wave[2]],
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}

/**
 * When each foot comes down in a stride, the left fore, right fore, left hind and right hind: at a walk one at a time, each hind
 * foot followed by the fore on its side; at a run in bounds, both hind feet a moment apart and then both fore.
 */
const WALK_DOWN = [0.25, 0.75, 0, 0.5];
const RUN_DOWN = [0.42, 0.5, 0, 0.08];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/** How far its back is drawn up this moment in degrees at either end of it, the ends down (`flexPt`): at a run only. */
function flexOf(s: Tide, a: Anim): number {
  if (a.act || a.go <= 0) return 0;
  return smooth(Math.min(1, a.go)) * a.gait * s.gait.flex * Math.cos(TAU * (frac(a.u) - 0.87));
}
/** How far the back is turned at `y` along it, drawn up `deg` at either end: nose-down ahead of the middle, tail-down behind it. */
const flexAt = (s: Tide, y: number, deg: number): number => -deg * clamp(y / s.body.y[s.body.y.length - 1], -1, 1);
/** A point in the trunk's frame where the back's flex puts it: turned about the middle across, by the flex where it is. */
function flexPt(s: Tide, p: V3, deg: number): V3 {
  if (!deg) return p;
  const a = flexAt(s, p[1], deg) * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [p[0], p[1] * c - p[2] * sn, p[1] * sn + p[2] * c];
}

/**
 * Going. At a walk, slow and careful: each foot down for most of a stride and swept back under the body at the ground's own
 * speed, then lifted high and set down flat ahead, the body rolled over onto the feet that are down and sinking at each step,
 * the head nodding and the tail swinging from side to side behind. At a run -- swimming -- a long gliding bound: both hind feet
 * down and pushing off, the body stretched out, both fore feet reaching and down, then drawn up with its hind feet swung
 * forward under it; the neck reaching, the head held level, and a wave going down its tail, up and down.
 */
function goingPlan(s: Tide, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, L = R.reach[i], half = amp * (R.reach[0] + R.reach[2]) / 2, A = R.paw[i];
    const ph = frac(a.u - lerp(WALK_DOWN[i], RUN_DOWN[i], g));
    if (ph < duty) {
      const k = ph / duty;
      p.at[i] = [A[0], A[1] + half * (1 - 2 * k), A[2]];
      const off = ramp(k, 0.6, 1);
      p.rake[i] = -(fore ? lerp(18, 45, g) : lerp(26, 55, g)) * off;
      p.foot[i] = p.rake[i];
      continue;
    }
    const E = lerp(EDGE, 0.2, g), u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * E, y1 = A[1] + half + v * E;
    const y = u < E ? A[1] - half - v * u : u > 1 - E ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * E), -v * (1 - 2 * E), (u - E) / (1 - 2 * E));
    // Lifted high and carefully at a walk, as a swimmer goes on land; tucked up under it in a bound.
    const lift = G.step * L * (1 + 0.2 * g) * Math.sin(Math.PI * u) ** 0.7;
    p.at[i] = [A[0], y, A[2] + lift];
    if (fore) {
      p.rake[i] = -lerp(60, 100, g) * Math.sin(Math.PI * clamp(u / 0.8)) + 6 * hump(u, 0.92, 0.1);
      p.foot[i] = p.rake[i] * 0.8 + lerp(14, 0, g) * hump(u, 0.85, 0.15);
    } else {
      p.rake[i] = -lerp(30, 46, g) * Math.sin(Math.PI * clamp(u / 0.45)) + lerp(16, 30, g) * Math.sin(Math.PI * clamp((u - 0.35) / 0.65));
      p.foot[i] = p.rake[i] * 0.7;
    }
  }
  // A walk sinks at each footfall and rolls over onto the side that is down; a bound is lowest on its feet and highest in the air.
  const walkBob = -G.bob * s.len * (0.5 + 0.5 * Math.cos(4 * TAU * (w - 0.05)));
  const bound = 0.07 * s.len * Math.cos(2 * TAU * (w - 0.37)) - 0.06 * s.len;
  p.H += lerp(walkBob, bound, g);
  p.pitch = g * 7 * Math.sin(TAU * (w - 0.12)) + (1 - g) * 1.5 * Math.sin(2 * TAU * w);
  p.roll = (1 - g) * 4 * Math.sin(TAU * (w - 0.1));
  p.yaw = (1 - g) * 2.5 * Math.sin(TAU * (w - 0.2));
  p.side = -(1 - g) * 0.025 * s.len * Math.sin(TAU * (w - 0.1));
  p.neck[0] = g * (22 + 6 * Math.sin(TAU * (w - 0.6))) + (1 - g) * 4;
  p.head[0] = (1 - g) * 5 * Math.cos(2 * TAU * (w - 0.15)) - g * (12 + 6 * Math.sin(TAU * (w - 0.12)));
  p.head[1] = (1 - g) * 4 * Math.sin(TAU * w);
  p.head[2] = (1 - g) * -3 * Math.sin(TAU * (w - 0.1));
  // The tail let down and swung from side to side at a walk; at a run streamed out behind with a wave going down it, up and down.
  p.tail = [-(1 - g) * 10 - g * (s.tail.lift * 0.8 + 6 * Math.sin(TAU * (w - 0.5))), (1 - g) * 12 * Math.sin(TAU * (w - 0.3)), -g * s.tail.curl * 0.8];
  p.wave = [(1 - g) * 5, g * 7, TAU * w];
  return p;
}

/**
 * Standing about: breathing, looking round with its head tipped one way and the other, its weight shifted, its tail stirring
 * with a ripple running down it; and now and then its head cocked right over to one side, listening.
 */
function stillPlan(s: Tide, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [2 * Math.abs(a.breath - 0.5), 12 * look];
  p.head = [-2 * Math.abs(cyc(t, 5)), 8 * look, 6 * drift(t, 2)];
  p.H += 0.012 * s.len * (a.breath - 0.5);
  p.roll = 1.2 * cyc(t, 3);
  const tilt = beat(t, [5.6, 17.4], 2.4);
  p.head[2] += 18 * tilt * (frac(t / 12) < 0.5 ? 1 : -1);
  p.head[1] += 8 * tilt;
  p.tail = [-2 * (1 - Math.cos((TAU * 3 * t) / 24)), 8 * cyc(t, 4), 0];
  p.wave = [4, 3, (TAU * 8 * t) / 24];
  return p;
}

/** The body pitched nose-up by `deg` about its hips or nose-down about its shoulders, `at` along it, so they stay where they stood. */
function pivot(s: Tide, p: Plan, deg: number, at: number): void {
  const r = ringAt(s.body, at), z0 = r.z - r.h * s.drop, a = deg * DEG;
  const y1 = at * Math.cos(a) - z0 * Math.sin(a), z1 = at * Math.sin(a) + z0 * Math.cos(a);
  p.pitch += deg;
  p.surge += at - y1;
  p.H += z0 - z1;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Springlet pounces: crouched, sprung forward with its fore feet up, and down onto them in a slap. */
function pounce(s: Tide, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = TIDE_HITS[0];
  const crouch = ramp(t, 0.04, 0.26) * (1 - ramp(t, 0.28, 0.36));
  const air = ramp(t, 0.28, 0.38) * (1 - ramp(t, 0.4, hit));
  const out = ramp(t, 0.28, hit) * (1 - ramp(t, 0.7, 0.96));
  p.H += s.len * (-0.12 * crouch + 0.3 * air);
  p.surge += s.len * 0.45 * out;
  p.pitch = -10 * crouch + 22 * air - 8 * hump(t, hit + 0.04, 0.08);
  p.neck = [14 * crouch - 10 * air, 0];
  p.head = [-6 * crouch + 8 * air, 0, 0];
  p.tail = [14 * air - 8 * crouch, 0, 6 * air];
  for (const i of [0, 1]) {
    const A = R.paw[i];
    const up: V3 = [A[0] * 0.8, A[1] + 0.3 * s.len, A[2] + 0.55 * R.reach[i]];
    p.at[i] = mixV(A, up, air);
    p.rake[i] = -50 * air;
    p.foot[i] = -30 * air;
  }
  for (const i of [2, 3]) {
    p.at[i] = add(R.paw[i], [0, s.len * 0.3 * ramp(t, 0.5, 0.8), R.reach[i] * 0.2 * hump(t, 0.62, 0.12)]);
    p.rake[i] = -30 * air;
  }
  return p;
}

/** The Springsail whips its tail: turned away from what it strikes, the tail swung round hard across it, and back. */
function whip(s: Tide, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = TIDE_HITS[1];
  const wind = ramp(t, 0.04, 0.32) * (1 - ramp(t, 0.36, hit));
  const lash = ramp(t, 0.36, hit) * (1 - ramp(t, 0.64, 0.96));
  p.yaw = 30 * wind - 40 * lash;
  p.roll = -4 * wind + 7 * lash;
  p.neck = [6 * wind, -30 * wind + 36 * lash];
  p.head = [0, -12 * wind + 18 * lash, 0];
  p.tail = [16 * wind + 20 * lash, -80 * wind + 110 * lash, -12 * lash - 0.6 * s.tail.curl * (wind + lash)];
  p.wave = [6, 4, TAU * 2 * t];
  // Its weight onto its fore feet, a hind foot lifted as it swings round.
  const i = 3, A = R.paw[i];
  p.at[i] = add(A, [0.1 * s.len * lash, 0, R.reach[i] * 0.12 * hump(t, hit, 0.12)]);
  return p;
}

/** The Tidecourser rears: up on its hind feet, fore feet high and paddling, held, and brought down together in a stamp. */
function rear(s: Tide, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = TIDE_HITS[2];
  const up = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.44, hit));
  pivot(s, p, 38 * up - 4 * hump(t, hit + 0.05, 0.08), -s.len * 0.5);
  p.neck = [-14 * up + 10 * hump(t, hit + 0.04, 0.1), 0];
  p.head = [-10 * up, 0, 0];
  p.tail = [-10 * up, 0, 8 * up];
  p.wave = [3, 6, TAU * 2 * t];
  for (const i of [0, 1]) {
    const A = R.paw[i], sh = R.hip[i];
    const paddle = Math.sin(TAU * 3 * t + i * Math.PI) * up;
    const high: V3 = [A[0] * 0.9, sh[1] - s.seat + 0.15 * s.len + 0.06 * paddle, s.high + sh[2] - 0.05 + 0.1 * paddle];
    p.at[i] = mixV(A, high, up);
    p.rake[i] = -70 * up;
    p.foot[i] = -40 * up;
  }
  return p;
}

/** How far it is set to its task: eased in and out of a go played once, and held while it is at it over and over. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/**
 * A go at its task, which is preening: its head turned round to its flank, a fin run through its mouth three times, back round,
 * and a shake from its head to its tail, every fin of it flung out.
 */
function workPlan(s: Tide, R: Rest, a: Anim, t: number, down: number): Plan {
  const p = restPlan(s, R), W = TIDE_WORK;
  const round = ramp(t, 0.06, 0.24) * (1 - ramp(t, 0.6, 0.7));
  const nib = W.nibbles.reduce((x, c) => Math.max(x, hump(t, c, 0.05)), 0);
  const shake = hump(t, W.shake, 0.12), sh = shake * Math.sin(t * 110);
  p.neck = [24 * round + 4 * nib, 64 * round];
  p.head = [-24 * round - 8 * nib, 36 * round, -18 * round + 10 * sh];
  p.yaw = 8 * round;
  p.side = -0.04 * s.len * round;
  p.roll = -3 * round + 8 * sh;
  p.tail = [0, -20 * round + 16 * sh, 0];
  p.wave = [5 + 10 * shake, 4, TAU * 6 * t];
  p.H -= 0.02 * s.len * shake;
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with every fin flared, a shake, and settled. */
function evolvePlan(s: Tide, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * 58);
  p.H += s.len * (-0.03 * hunch + 0.02 * up);
  p.pitch = -3 * hunch + 4 * up;
  p.neck = [16 * hunch - 12 * up, 0];
  p.head = [-12 * hunch + 14 * up, 0, 10 * shake];
  p.roll = 3 * shake;
  p.tail = [-10 * hunch + 12 * up, 10 * shake, 6 * up];
  p.wave = [4, 4, TAU * 3 * t];
  p.squash = 0.05 * hump(t, 0.7, 0.05);
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Tide, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([pounce, whip, rear][s.stage](s, R, a, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, a, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, a, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, a, 0.35, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its fins, as they move ------------------------------------------------------------------- */

/**
 * How its fins are carried this moment: how far they flutter, how far they are streamed back, how far flared out from it, and
 * where their flutter is. Standing, a slow flutter, each petal on its own beat; going, streamed back and fluttering faster; at
 * a strike, flared out; shaken out at the end of its preening; spread wide at the turn of evolving.
 */
function finsOf(s: Tide, a: Anim): { flutter: number; stream: number; flare: number; at: number } {
  const act = a.act;
  if (act?.kind === 'strike') {
    const hit = TIDE_HITS[s.stage], f = ramp(act.t, 0.1, hit - 0.06) * (1 - ramp(act.t, hit + 0.1, 0.95));
    return { flutter: 0.6 + 0.6 * f, stream: 0.3 * hump(act.t, hit, 0.12), flare: f, at: act.t * TAU * 5 };
  }
  if (act?.kind === 'work' || (a.graze > 0 && a.go <= 0)) {
    const t = act?.kind === 'work' ? act.t : 0.35, sh = hump(t, TIDE_WORK.shake, 0.12);
    return { flutter: 0.6 + 2.2 * sh, stream: 0, flare: 0.5 * sh, at: t * TAU * (6 + 6 * sh) };
  }
  if (act?.kind === 'evolve') {
    const t = act.t;
    return { flutter: 0.6 + hump(t, 0.66, 0.12), stream: 0.2 * ramp(t, 0.06, 0.3) * (1 - ramp(t, 0.36, 0.5)), flare: ramp(t, 0.42, 0.56) * (1 - ramp(t, 0.72, 0.94)), at: t * TAU * 4 };
  }
  const go = a.go > 0 ? smooth(Math.min(1, a.go)) : 0;
  return { flutter: lerp(1, 1.3, go), stream: go * lerp(0.25, 1, a.gait), flare: 0, at: lerp((TAU * 8 * a.t) / 24, TAU * 2 * frac(a.u), go) };
}

/**
 * A mesh of petals, each bent by how the fins are carried (`finsOf`): every corner of a petal moved along the way its face
 * looks by as much as it is out along the petal, squared, so a petal bends from its root -- its tip fluttering on its own beat,
 * all of them streamed back the way `back` says and flared out the way each faces.
 */
interface Fan { mesh: Mesh; bend: (v: readonly V3[], a: Anim) => V3[] }
interface PetalOf { mesh: Mesh; root: V3; n: V3; len: number }
function fanOf(s: Tide, petals: readonly PetalOf[], back: V3, k = 1): Fan {
  const ns: V3[] = [], ks: number[] = [], ph: number[] = [], ls: number[] = [];
  petals.forEach((pt, q) => {
    for (const v of pt.mesh.v) {
      ns.push(pt.n);
      ks.push(clamp(len3(sub(v, pt.root)) / pt.len) ** 2);
      ph.push(jitter(q * 3 + 17) * TAU);
      ls.push(pt.len * k);
    }
  });
  const m = merge(...petals.map((p) => p.mesh));
  const bend = (v: readonly V3[], a: Anim): V3[] => {
    const F = finsOf(s, a);
    return v.map((p, i) => {
      const L = ls[i] * ks[i], wob = 0.07 * F.flutter * Math.sin(F.at + ph[i]) + 0.22 * F.flare;
      const n = ns[i];
      return [p[0] + n[0] * wob * L + back[0] * F.stream * 0.5 * L, p[1] + n[1] * wob * L + back[1] * F.stream * 0.5 * L, p[2] + n[2] * wob * L + back[2] * F.stream * 0.5 * L];
    });
  };
  return { mesh: m, bend };
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/**
 * A leg bent to put its foot at `paw`: its last part up from the foot to the wrist or the hock, leaning back as the pose says;
 * then the upper and lower bent to reach that, the elbow behind on a fore leg and the stifle forward on a hind. Each bone's own
 * `-z` runs down its part.
 */
function legOf(s: Tide, body: Xf, i: number, rootLocal: V3, paw: V3, rake: number, foot: number): Xf[] {
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

/** A tail's bones from its root on the body, each link on from the one before, lifted, curled and swung, a wave running down it. */
function tailBones(s: Tide, body: Xf, P: Plan, flex: number, links: readonly number[], at: V3, lift: number, curl: number, lag: number): Xf[] {
  const n = links.length, out: Xf[] = [];
  const W = P.wave;
  let prev = joint(body, flexPt(s, at, flex), -(lift + P.tail[0]) - flexAt(s, at[1], flex), 0, P.tail[1] * 0.4);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    // The wave goes down the tail a link at a time, each a little behind the one before, so it travels to the tip.
    const ph = W[2] - q * 0.75 - lag;
    prev = joint(prev, [0, -links[q - 1], 0], -(curl + P.tail[2]) + W[1] * Math.sin(ph), 0, (P.tail[1] * 0.6) / (n - 1) + W[0] * Math.sin(ph + 0.6));
    out.push(prev);
  }
  return out;
}

/** The middle of the skull, in the head's frame; the middle of the snout. */
const skullAt = (s: Tide): V3 => [0, 0, s.head.up];
/**
 * The snout: a tube out of the front of the skull, sloping a little down, tapering to a round end -- how far along it each ring is
 * (a share of its length) and how wide and deep there (against the snout's own sizes) -- so the face runs smoothly into it.
 */
const SNOUT: ReadonlyArray<readonly [number, number]> = [[0, 1.6], [0.45, 1.25], [0.75, 0.96], [0.92, 0.66], [1, 0.18]];
const SNOUT_DIR: V3 = unit([0, 1, -0.3]);
const snoutRoot = (s: Tide): V3 => { const H = s.head; return [0, H.r[1] * 0.1, H.up - H.r[2] * 0.12]; };
const snoutLen = (s: Tide): number => s.head.r[1] * 0.55 + s.head.snout[2];
/** A point on the snout `k` of the way along it and `th` round it from its right side (up positive), and the way out of it there. */
function onSnout(s: Tide, k: number, th: number): { p: V3; n: V3 } {
  const sn = s.head.snout, kk = clamp(k);
  let q = 0;
  while (q < SNOUT.length - 2 && SNOUT[q + 1][0] < kk) q++;
  const f = clamp((kk - SNOUT[q][0]) / (SNOUT[q + 1][0] - SNOUT[q][0])), m = lerp(SNOUT[q][1], SNOUT[q + 1][1], f);
  const up = unit(cross([1, 0, 0], SNOUT_DIR)), side: V3 = [1, 0, 0];
  const c = add(snoutRoot(s), scale(SNOUT_DIR, snoutLen(s) * kk));
  const w = sn[0] * m, h = sn[1] * m, ct = Math.cos(th), st = Math.sin(th);
  return { p: add(c, add(scale(side, ct * w), scale(up, st * h))), n: unit(add(scale(side, ct / w), scale(up, st / h))) };
}
/** The point on the neck `k` of the way up it, in its frame: straight up from the withers, then arched forward under the head. */
const neckEnd = (s: Tide, k: number): V3 => { const L = s.neck.len, u = clamp((k - 0.4) / 0.6); return [0, L * 0.26 * u * u, L * k]; };

/**
 * The bones of a stage: its pose, the body raised and carried as the pose says, its back flexed, every leg bent to put its foot
 * where the pose says (`legOf`), the neck and head carried on the body, and the tail, and the Tidecourser's lower lobe, in links.
 */
function tideBones(s: Tide): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, flex: number): Bones => {
    const body = joint(ROOT, [P.side, P.surge - s.seat, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.neck.lean + P.neck[0];
    const nf = flexAt(s, s.neck.at[1], flex);
    b.neck = joint(body, flexPt(s, s.neck.at, flex), -lean + nf, 0, P.neck[1]);
    b.head = joint(b.neck, neckEnd(s, 1), lean + s.head.pitch + P.head[0] - nf * 0.5, P.head[2], P.head[1]);
    const T = s.tail;
    tailBones(s, body, P, flex, T.links, T.at, T.lift, T.curl, 0).forEach((x, q) => { b[`tail${q}`] = x; });
    if (s.lobe) tailBones(s, body, P, flex, s.lobe.links, add(T.at, [0, 0.04, -T.w[0] * 0.7]), s.lobe.lift, s.lobe.curl, 0.9).forEach((x, q) => { b[`lobe${q}`] = x; });
    for (let i = 0; i < 4; i++) {
      const fore = i < 2, h = R.hip[i];
      const slide = fore ? clamp((P.at[i][1] - R.paw[i][1]) * 0.15, -0.12 * s.len, 0.12 * s.len) : 0;
      const g = P.at[i];
      const [u, l, f, c] = legOf(s, body, i, flexPt(s, [h[0], h[1] + slide, h[2]], flex), [g[0], g[1], Math.max(g[2], s.paw * 0.45)], P.rake[i], P.foot[i]);
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

/** How thick its saddle is. */
const SADDLE_H = 0.06;
/** How high the top of the saddle is over its feet standing, in its own units. */
const seatOf = (s: Tide): number => { const r = ringAt(s.body, s.seat); return s.high + r.z + r.h + SADDLE_H; };

/* ---- what it is made of ------------------------------------------------------------------------- */

/** A petal's colours from its root to its tip: pale gold at the root, through peach, to its markings and a deeper tip. */
const PETAL: readonly Mat[] = ['cap', 'stem', 'bloom', 'leaf', 'mark', 'petal'];

/**
 * A fin: a thin solid along a line of points, `widths` across it (half-widths) at each, its face turned along `face`, twisted
 * by `twist` radians by its tip and folded a little along its middle. Each length of it the colour `mats` says along it, so it
 * goes from its root's to its tip's; and, cut finely, a gold vein down its middle.
 */
function vane(pts: readonly V3[], widths: readonly number[], face: V3, mats: readonly Mat[], o: { twist?: number; fold?: number; thick?: number; vein?: boolean } = {}): Mesh {
  const K = pts.length, th = o.thick ?? 0.02, vein = o.vein ?? false;
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const push = (i: number[], m: Mat, w: V3): void => { f.push({ i, m }); want.push(w); };
  const C = vein ? 4 : 3;
  const ns: V3[] = [], sides: V3[] = [], ds: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const n0 = unit(sub(face, scale(d, dot(face, d)))), tw = ((o.twist ?? 0) * k) / Math.max(1, K - 1);
    const n = unit(add(scale(n0, Math.cos(tw)), scale(cross(d, n0), Math.sin(tw))));
    const side = unit(cross(d, n));
    const w = widths[Math.min(k, widths.length - 1)], lift = (o.fold ?? 0.2) * w, r = Math.min(w * 0.25, 0.02);
    const top: V3[] = vein
      ? [add(add(pts[k], scale(side, -w)), scale(n, lift)), add(pts[k], scale(side, -r)), add(pts[k], scale(side, r)), add(add(pts[k], scale(side, w)), scale(n, lift))]
      : [add(add(pts[k], scale(side, -w)), scale(n, lift)), pts[k], add(add(pts[k], scale(side, w)), scale(n, lift))];
    for (const q of top) v.push(q);
    for (const q of top) v.push(add(q, scale(n, -th)));
    ns.push(n); sides.push(side); ds.push(d);
  }
  const S = 2 * C;
  for (let k = 0; k < K - 1; k++) {
    const A = k * S, B = (k + 1) * S, m = mats[Math.min(mats.length - 1, Math.floor(((k + 0.5) / (K - 1)) * mats.length))];
    const n = unit(add(ns[k], ns[k + 1])), side = unit(add(sides[k], sides[k + 1]));
    for (let j = 0; j < C - 1; j++) push([A + j, A + j + 1, B + j + 1, B + j], vein && j === 1 ? 'crystal' : m, n);
    for (let j = 0; j < C - 1; j++) push([A + C + j, A + C + j + 1, B + C + j + 1, B + C + j], m, scale(n, -1));
    push([A, B, B + C, A + C], m, scale(side, -1));
    push([A + C - 1, B + C - 1, B + 2 * C - 1, A + 2 * C - 1], m, side);
  }
  const E = (K - 1) * S, ring = (b: number): number[] => [...Array.from({ length: C }, (_, j) => b + j), ...Array.from({ length: C }, (_, j) => b + 2 * C - 1 - j)];
  push(ring(0), mats[0], scale(ds[0], -1));
  push(ring(E), mats[mats.length - 1], ds[K - 1]);
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
  return mesh(v, f);
}

/** Whether petals are cut finely, for the build under way: drawn big, or at the size the island is played at. */
let finePetals = true;
/** A petal's outline, as how far along it and how wide there against its widest: a long narrow feather, widest a third along, to a point. */
const PETAL_FINE: ReadonlyArray<readonly [number, number]> = [[0, 0.3], [0.15, 0.8], [0.35, 1], [0.6, 0.85], [0.82, 0.5], [1, 0.03]];
const PETAL_COARSE: ReadonlyArray<readonly [number, number]> = [[0, 0.35], [0.3, 1], [0.66, 0.7], [1, 0.04]];

/**
 * A petal-fin from `root` out along `dir`, `len` long and `w` across at its widest, a little past its root; pointed; its tip
 * curling the way `curl` says; its face toward `face`. Gold at the root, its markings at the tip.
 */
function petalFin(root: V3, dir: V3, face: V3, len: number, w: number, curl: V3, o: { twist?: number; mats?: readonly Mat[] } = {}): PetalOf {
  const d = unit(dir), shape = finePetals ? PETAL_FINE : PETAL_COARSE;
  const pts: V3[] = [], ws: number[] = [];
  for (const [u, k] of shape) {
    pts.push(add(root, add(scale(d, len * u), scale(curl, len * u * u))));
    ws.push(w * k);
  }
  const n = unit(sub(face, scale(d, dot(face, d))));
  return { mesh: vane(pts, ws, n, o.mats ?? PETAL, { twist: o.twist ?? 0.25, vein: finePetals, thick: Math.min(0.022, w * 0.2) }), root, n, len };
}

/** The barrel: cream, smooth, fine gold lines in dashes along its flanks. */
function barrelOf(s: Tide, n: number): Mesh {
  const B = s.body, F = smoothRings(B, finePetals ? 5 : 3);
  // Rounded off at the rump and the chest, not cut square.
  const zEnd = F.z[F.z.length - 1];
  for (const [at, k] of [[0.05, 0.75], [0.1, 0.35]] as const) {
    F.y.unshift(B.y[0] - at * s.len * 0.5); F.z.unshift(B.z[0]); F.w.unshift(B.w[0] * k); F.h.unshift(B.h[0] * k);
    F.y.push(B.y[B.y.length - 1] + at * s.len * 0.5); F.z.push(zEnd); F.w.push(B.w[B.w.length - 1] * k); F.h.push(B.h[B.h.length - 1] * k);
  }
  const body = tube(F.y.map((y, q) => [0, y, F.z[q]] as V3), F.w, F.h, n, 'coat');
  const spots: Disc[] = [];
  // Only drawn big, where a line a hair wide shows.
  if (!finePetals) return body;
  // Fine gold lines in dashes along its flanks from the shoulder back, each running a little down as it goes, as many as it has flecks.
  const y0 = B.y[B.y.length - 2] - 0.06, y1 = B.y[1] + 0.1, lines = Math.max(1, Math.round(s.flecks / 8)), dashes = 4 + s.stage;
  for (const side of [1, -1]) for (let l = 0; l < lines; l++) for (let d = 0; d < dashes; d++) {
    const id = l * 13 + d + (side > 0 ? 0 : 70);
    const u0 = (d + 0.15 * jitter(id)) / dashes, u1 = u0 + 0.55 / dashes;
    const pts = [0, 0.5, 1].map((k) => {
      const u = lerp(u0, u1, k), th = 0.95 - 0.32 * l - 0.25 * u;
      return onRings(B, lerp(y0, y1, u), side > 0 ? th : Math.PI - th);
    });
    spots.push(strapOn(pts, 0.012 + 0.006 * s.stage, 'spot'));
  }
  return merge(body, paint(spots));
}

/** The neck: cream, a little deeper than it is wide, thickening into the chest. */
function neckOf(s: Tide, n: number): Mesh {
  const N = s.neck, L = N.len;
  return tube([[0, 0, -0.3], [0, -0.02 * L, L * 0.4], neckEnd(s, 0.75), neckEnd(s, 1.04)], [N.w * 1.3, N.w * 1.04, N.w * 0.9, N.w * 0.84], [N.w * 1.4, N.w * 1.08, N.w * 0.94, N.w * 0.88], n, 'coat', { seam: 'both' });
}

/**
 * The head: a smooth round skull and a short snout out of the front of it, cream, a small pink nose on its end and a closed
 * smile under it; amber eyes ringed dark; two gold flecks over each eye; and, saddled, a bridle.
 */
function headOf(s: Tide, n: number, k: number, shut: boolean, tack: boolean): Mesh {
  const H = s.head, C = skullAt(s), sn = H.snout;
  const skull = orb(C, H.r, n + 2, k + 2, 'coat');
  const L = snoutLen(s), root = snoutRoot(s);
  const muzzle = tube(SNOUT.map(([k]) => add(root, scale(SNOUT_DIR, L * k))), SNOUT.map(([, m]) => sn[0] * m), SNOUT.map(([, m]) => sn[1] * m), n, 'muzzle', { start: false });
  const nt = onSnout(s, 0.95, 1.1);
  const nose = orbAlong(add(nt.p, scale(nt.n, -0.01)), [0, 1, 0.4], [sn[0] * 0.3, sn[0] * 0.2, sn[0] * 0.22], 8, 4, 'nose');
  // The smile: a soft line round the end of the snout under the nose and back along each side of it, turned up at its ends.
  const mouth = paint(strapsOn(Array.from({ length: 11 }, (_, q) => { const a = lerp(-1, 1, q / 10); return onSnout(s, 0.99 - 0.3 * Math.abs(a), -Math.PI / 2 + a * (Math.PI / 2 - 0.5) + Math.sign(a) * 0.3 * a * a); }), sn[0] * 0.1, 'lid'));
  const eye = eyes(C, H.r, s.eye.dir, s.eye.size, { tall: 1.15, iris: 'bill', pupil: 0.55, glint: 0.4, rim: 0.24, shut });
  const flecks = paint([1, -1].flatMap((sd) => [0, 1].map((q) => {
    const e = onEgg2(C, H.r, [sd * (0.42 + 0.14 * q), 0.42 - 0.2 * q, 0.78 - 0.06 * q]);
    return disc(add(e.p, scale(e.n, 0.012)), e.n, s.eye.size * 0.34, s.eye.size * 0.24, 6, 'spot', { up: [0, 1, 0] });
  })));
  return merge(skull, muzzle, nose, mouth, eye, flecks, tack && bridleOf(s));
}

/** Solids inside the head that hide what is round the far side of them: the skull and the snout. */
function headSolids(s: Tide): Array<{ c: V3; r: V3 }> {
  const H = s.head, sn = H.snout;
  return [{ c: skullAt(s), r: scale(H.r, 0.86) }, { c: add(snoutRoot(s), scale(SNOUT_DIR, snoutLen(s) * 0.45)), r: [sn[0] * 0.75, snoutLen(s) * 0.3, sn[1] * 0.75] }];
}

/**
 * The crown: rows of petal-fins off the back of its skull, the innermost short and standing up, each row further out longer and
 * swept further back and round, the last fanned out to either side behind its cheeks; each lying on a cone standing back and up
 * off the head, its face out from it, so from any side it frames the face and never crosses it. In the head's frame.
 */
function crownOf(s: Tide, lod: number): Fan {
  const H = s.head, C = skullAt(s), petals: PetalOf[] = [];
  s.crown.forEach((row, q) => {
    const count = lod ? row.n : Math.max(3, row.n - 2);
    for (let j = 0; j < count; j++) {
      const u = count > 1 ? (j / (count - 1)) * 2 - 1 : 0, az = u * row.spread * DEG, el = (row.el - 8 * u * u) * DEG;
      const id = q * 17 + j;
      // Out of the top and the back of the skull, behind the eyes, each tier further back down it.
      const root = onEgg2(C, scale(H.r, 0.88), [Math.sin(az) * 0.75, -0.25 - 0.32 * q, 0.95 - 0.28 * q]).p;
      const dir: V3 = [Math.sin(az) * Math.cos(el) * 0.85, -Math.cos(el) - 0.3, Math.sin(el)];
      // Its face to the side, so side on it is a long feather, from in front a blade rising behind the face; curving back.
      const sx = Math.abs(u) > 0.01 ? Math.sign(u) : j % 2 ? 1 : -1;
      const L = row.len * (0.88 + 0.24 * jitter(id)), W = row.w * (0.9 + 0.2 * jitter(id + 5));
      petals.push(petalFin(root, dir, [sx, 0.15, 0.3], L, W, [0, -0.36, -0.2], { twist: 0.35 * sx }));
    }
  });
  return fanOf(s, petals, [0, -0.5, -0.2]);
}

/**
 * The mane: rows of petal-fins down the back of its neck from the crown to the withers, falling back and down over the sides of
 * it, longest at the top, so the crown flows on down the neck. In the neck's frame.
 */
function maneOf(s: Tide, lod: number): Fan {
  const N = s.neck, M = s.mane, petals: PetalOf[] = [];
  const rows = lod ? M.rows : Math.max(1, M.rows - 1);
  for (let row = 0; row < rows; row++) {
    const v = rows > 1 ? row / (rows - 1) : 0, z = lerp(N.len * 0.85, N.len * 0.12, v);
    for (const a of lod ? [-0.9, -0.4, 0, 0.4, 0.9] : [-0.8, 0, 0.8]) {
      // Under the crown only the feathers down its crest, so none stands out beside the jaw.
      if ((!lod && a === 0 && row % 2) || (Math.abs(a) > 0.5 && v < 0.3)) continue;
      const id = 60 + row * 5 + Math.round(a * 10);
      const nrm: V3 = [Math.sin(a), -Math.cos(a), 0];
      const root: V3 = add(neckEnd(s, z / N.len), [nrm[0] * N.w * 0.8, nrm[1] * N.w * 0.85, 0]);
      const L = M.len * (1 - 0.35 * v) * (0.9 + 0.2 * jitter(id));
      const dir = unit(add(scale(nrm, 0.45), [0, -0.85, -0.4]));
      petals.push(petalFin(root, dir, a ? [Math.sign(a), 0, 0.3] : [1, 0, 0.3], L, M.w * (1 - 0.2 * v), [0, -0.1, -0.12], { twist: 0.25 * (a ? Math.sign(a) : 1) }));
    }
  }
  return fanOf(s, petals, [0, -0.6, -0.4]);
}

/**
 * The fins along its back: a row of petals over the withers and another over the croup, each lying back along the spine with
 * one either side of it flowing back down over the flank; none where the saddle goes, so a saddle sits on cream. In the
 * trunk's frame.
 */
function backFinsOf(s: Tide, lod: number): Fan {
  const B = s.body, F = s.back, petals: PetalOf[] = [];
  const front = B.y[B.y.length - 2] - 0.1, saddle0 = s.seat - s.len * 0.32, saddle1 = s.seat + s.len * 0.3;
  const spots = [...Array.from({ length: Math.ceil(F.n / 2) }, (_, q) => lerp(front, saddle1, q / Math.max(1, Math.ceil(F.n / 2)))),
    ...Array.from({ length: Math.floor(F.n / 2) }, (_, q) => lerp(saddle0, B.y[1] + 0.1, (q + 0.3) / Math.max(1, Math.floor(F.n / 2))))];
  spots.forEach((y, q) => {
    for (const sd of lod ? [-1, 0, 1] : [-1, 1]) {
      const id = 120 + q * 7 + sd, th = Math.PI / 2 - sd * 0.75, e = onRings(B, y, th);
      const L = F.len * (0.85 + 0.3 * jitter(id)) * (sd ? 1 : 0.8);
      const dir = unit(add(scale(e.n, sd ? 0.3 : 0.45), [0, -1, sd ? -0.2 : 0.15]));
      petals.push(petalFin(sub(e.p, scale(e.n, 0.03)), dir, unit(add(e.n, [sd * 0.8, 0, 0])), L, F.w, [0, -0.05, -0.1], { twist: 0.15 * sd }));
    }
  });
  return fanOf(s, petals, [0, -0.7, -0.2]);
}

/** Petal-fins down the back of a leg's part, in its frame (the bone down `-z`), hanging back and down, `count` of them. */
function legFinOf(s: Tide, length: number, w: number, count: number, from: number, to: number, seed: number): Fan {
  const petals: PetalOf[] = [];
  for (let q = 0; q < count; q++) {
    const z = -length * lerp(from, to, count > 1 ? q / (count - 1) : 0.5), id = seed + q;
    const L = s.legFin.len * (0.7 + 0.4 * (q + 1) / count) * (0.9 + 0.2 * jitter(id));
    for (const a of finePetals ? [-0.5, 0.5] : [0]) {
      const nrm: V3 = [Math.sin(a), -Math.cos(a), 0];
      petals.push(petalFin(add([0, 0, z], scale(nrm, w * 0.7)), unit(add(scale(nrm, 0.9), [0, 0, -0.5])), [1, 0, 0], L, L * 0.17, [0, -0.08, -0.06], { twist: 0.1 }));
    }
  }
  return fanOf(s, petals, [0, -0.5, 0.3]);
}

/**
 * A webbed foot: a soft cream pad, four long toes fanned out in front with pink tips, and the web between them pale gold going
 * to pink. In the foot's frame, its sole on the ground under the ankle.
 */
function footOf(s: Tide, fore: boolean, n: number): Mesh {
  const r = s.paw * (fore ? 1 : 1.1), long = 1.15 + 0.3 * s.stage;
  const pad = orbAlong([0, r * 0.2, -r * 0.1], [0, 1, 0], [r * 0.8, r * 1.1, r * 0.5], n, 4, 'pad');
  const toes: Mesh[] = [], web: Mesh[] = [];
  const tips: V3[] = [];
  for (let q = 0; q < 4; q++) {
    const a = (q - 1.5) * 0.36, l = r * (1.25 + 0.15 * (1.5 - Math.abs(q - 1.5))) * long;
    const root: V3 = [Math.sin(a) * r * 0.5, r * 0.6, -r * 0.25], tip: V3 = add(root, [Math.sin(a) * l, Math.cos(a) * l, -r * 0.18]);
    tips.push(tip);
    toes.push(tube([root, mixV(root, tip, 0.6), tip], [r * 0.2, r * 0.17, r * 0.13], [r * 0.16, r * 0.14, r * 0.11], 5, (ring) => (ring >= 1 ? 'mark' : 'pad'), {}));
  }
  // The web: a thin fan from the pad out to each pair of toe tips, drawn short of the tips so the toes stand out of it.
  for (let q = 0; q < 3; q++) {
    const a = mixV([0, r * 0.55, -r * 0.3], tips[q], 0.82), b = mixV([0, r * 0.55, -r * 0.3], tips[q + 1], 0.82), c: V3 = [0, r * 0.55, -r * 0.3];
    const mid = scale(add(a, b), 0.5);
    web.push(vane([c, mixV(c, mid, 0.55), mid], [len3(sub(a, b)) * 0.25, len3(sub(a, b)) * 0.42, len3(sub(a, b)) * 0.5], [0, 0, 1], ['bloom', 'mark'], { fold: -0.1, thick: 0.01 }));
  }
  return merge(pad, ...toes, ...web);
}

/**
 * A link of the tail: a cream core tapering along it, and petal-fins off it all round lying back along it and standing out of
 * it, longest to either side, so the tail is a plume of petals; the last link a fan of long ones off its end. Along its own
 * `-y`, from its root.
 */
function tailLinkOf(s: Tide, q: number, links: readonly number[], ws: readonly number[], fin: number, fan: number, seed: number): Fan {
  const L = links[q], w0 = ws[Math.min(q, ws.length - 1)], w1 = ws[Math.min(q + 1, ws.length - 1)];
  const core = tube([[0, 0.04, 0], [0, -L * 0.5, 0], [0, -L - 0.03, 0]], [w0, (w0 + w1) * 0.5, w1], [w0 * 0.95, (w0 + w1) * 0.48, w1 * 0.95], finePetals ? 7 : 5, 'coat', { start: q === 0 ? false : undefined, end: false });
  const petals: PetalOf[] = [];
  const last = q === links.length - 1, k = (q + 1) / links.length;
  // Feathers fanned out along both sides of it and lying back along it, the row on each link over the one before: from the side
  // a long plume, from behind and above a fan. One more over its top, and on a tail that is not curled under, one under it.
  const curled = s.stage === 1;
  const around = finePetals ? [-1.45, -0.95, 0.95, 1.45, q % 2 ? 0.35 : -0.35, ...(curled ? [] : [Math.PI])] : [-1.3, 1.3, q % 2 ? 0.3 : -0.3];
  around.forEach((a, c) => {
    const id = seed + q * 13 + c, upright = Math.abs(Math.cos(a)) > 0.8;
    const nrm: V3 = [Math.sin(a), 0, Math.cos(a)];
    const Lk = fin * (0.9 + 0.55 * k) * (upright ? 0.8 : 1.1) * (Math.abs(a) < 1.2 && !upright ? 0.9 : 1) * (0.88 + 0.24 * jitter(id));
    const root: V3 = [nrm[0] * w0 * 0.6, -L * 0.05, nrm[2] * w0 * 0.6];
    const face: V3 = upright ? [1, 0, 0] : [nrm[0] * 0.25, 0, 1];
    petals.push(petalFin(root, unit(add(scale(nrm, upright ? 0.45 : Math.abs(a) > 1.2 ? 1.35 : 0.85), [0, -1, 0])), face, Lk, Lk * 0.17, add(scale(nrm, 0.06), [0, 0, 0.04]), { twist: 0.2 * (c % 2 ? 1 : -1) }));
  });
  if (last) {
    // The end: a fan of long feathers spread flat out either side of the tip and two lifted over it.
    const m = finePetals ? 7 : 4;
    for (let c = 0; c < m; c++) {
      const a = lerp(-1.05, 1.05, c / (m - 1)), up = c % 2 ? 0.25 : 0;
      const Lk = fan * (1 - 0.18 * Math.abs(a)) * (0.9 + 0.2 * jitter(seed + 90 + c));
      petals.push(petalFin([0, -L * 0.6, 0], [Math.sin(a), -Math.cos(a), up], [Math.sin(a) * 0.2, 0, 1], Lk, Lk * 0.18, [0, -0.04, 0.06], { twist: 0.2 * a }));
    }
  }
  const f = fanOf(s, petals, [0, -0.3, 0.3], 0.8);
  return { mesh: merge(core, f.mesh), bend: (v, a) => [...v.slice(0, core.v.length), ...f.bend(v.slice(core.v.length), a)] };
}

/* ---- tack ------------------------------------------------------------------------------------------- */

/**
 * The saddle: a small seat of sea-blue leather over the top of its back where a rider sits, a pommel at the front and a cantle
 * behind, a flap down each side and a girth round under its chest; in the trunk's frame.
 */
function saddleOf(s: Tide, n: number): Mesh {
  const B = s.body, y = s.seat, r = ringAt(B, y), top = r.z + r.h;
  const L = s.len * 0.2;
  const seat = tube([[0, y - L, top - 0.02], [0, y, top - 0.05], [0, y + L, top - 0.02]], [r.w * 0.66, r.w * 0.7, r.w * 0.62], [SADDLE_H * 1.6, SADDLE_H * 1.4, SADDLE_H * 1.6], n, 'leather');
  const pommel = orb([0, y + L * 0.95, top + SADDLE_H * 0.8], [r.w * 0.26, L * 0.16, SADDLE_H * 1.3], 6, 3, 'leatherDark');
  const cantle = orb([0, y - L * 0.95, top + SADDLE_H * 0.9], [r.w * 0.42, L * 0.16, SADDLE_H * 1.5], 6, 3, 'leatherDark');
  const flaps = paint([1, -1].map((sd) => {
    const e = onRings(B, y, sd > 0 ? 0.45 : Math.PI - 0.45);
    return onBarrel(B, disc(e.p, e.n, L * 0.5, r.h * 0.3, 8, 'leather', { up: [0, 0, 1] }), 0.02);
  }));
  const gy = y + L * 0.5, g = ringAt(B, gy);
  const girth = tube([[0, gy - 0.035, g.z], [0, gy + 0.035, g.z]], g.w * 1.04, g.h * 1.04, n + 2, 'leatherDark', { start: false, end: false });
  const rings = merge(...[1, -1].map((sd) => orb([sd * g.w * 1.02, gy, g.z + g.h * 0.2], 0.035, 5, 3, 'metal')));
  return merge(seat, pommel, cantle, flaps, girth, rings);
}

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

/** The same line in short lengths, each laid flat on the surface where it is: a line round a curve as one shape faces no way at all. */
function strapsOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc[] {
  const out: Disc[] = [];
  for (let q = 0; q + 1 < pts.length; q += 2) out.push(strapOn(pts.slice(q, Math.min(pts.length, q + 3)), w, m));
  return out;
}

/** A thin painted line along a run of points on a surface, `w` wide. */
function strapOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number, d: V3): V3 => add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  const dirs = pts.map((q, i) => unit(cross(q.n, sub(pts[Math.min(i + 1, pts.length - 1)].p, pts[Math.max(i - 1, 0)].p))));
  return facing([...pts.map((q, i) => up(q, 1, dirs[i])), ...[...pts].reverse().map((q, i) => up(q, -1, dirs[pts.length - 1 - i]))], pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** The bridle: a noseband round the snout, a cheek strap up each side of the face to a band behind the crown, and a bit ring at each corner of the mouth. */
function bridleOf(s: Tide): Mesh {
  const H = s.head, C = skullAt(s), sn = H.snout;
  const w = H.r[0] * 0.07;
  const band = Array.from({ length: 11 }, (_, q) => onSnout(s, 0.62, -0.35 * Math.PI + (q / 10) * 1.7 * Math.PI));
  const cheek = (sd: number): Disc => strapOn(Array.from({ length: 6 }, (_, q) => onEgg2(C, H.r, [sd * 0.95, lerp(0.3, -0.45, q / 5), lerp(-0.55, 0.7, q / 5)])), w, 'leather');
  const crown = Array.from({ length: 7 }, (_, q) => onEgg2(C, H.r, [lerp(-0.9, 0.9, q / 6), -0.45, 0.75]));
  const bits = merge(...[1, -1].map((sd) => orb(bitAt(s, sd), sn[0] * 0.2, 5, 3, 'metal')));
  return merge(paint([...strapsOn(band, w, 'leatherDark'), cheek(1), cheek(-1), ...strapsOn(crown, w, 'leather')]), bits);
}

/** Where the bit is, in the head's frame, on the side `sd`; and where the reins come to on the saddle, in the trunk's. */
const bitAt = (s: Tide, sd: number): V3 => add(onSnout(s, 0.78, sd > 0 ? -0.35 : Math.PI + 0.35).p, [sd * 0.02, 0, 0]);
const pommelAt = (s: Tide, sd: number): V3 => { const r = ringAt(s.body, s.seat); return [sd * r.w * 0.3, s.seat + s.len * 0.19, r.z + r.h + SADDLE_H]; };

/* ---- pieces ------------------------------------------------------------------------------------------- */

/** A stage's pieces; saddled and bridled with `tack`. */
function tideBuild(s: Tide, lod: number, tack: boolean): Piece[] {
  finePetals = !!lod;
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6);
  const pieces: Piece[] = [];
  const hide = headSolids(s);
  pieces.push({ key: 'body', mesh: barrelOf(s, cut(lod, 14, 22)), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: ['head', 'body'] });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false, tack), shut: headOf(s, n, k, true, tack), bone: 'head', bias: 0.2, after: 'neck', hide });
  const crown = crownOf(s, lod);
  pieces.push({ key: 'crown', mesh: crown.mesh, bent: crown.bend, bone: 'head', bias: 0.19, after: ['head', 'neck'], hide, hideIn: 'head' });
  if (s.mane.rows) {
    const mane = maneOf(s, lod);
    pieces.push({ key: 'mane', mesh: mane.mesh, bent: mane.bend, bone: 'neck', bias: 0.03, after: ['neck', 'body'], front: [0, -1, 0], hide, hideIn: 'head' });
  }
  if (s.back.n) {
    const fins = backFinsOf(s, lod);
    pieces.push({ key: 'backFins', mesh: fins.mesh, bent: fins.bend, bone: 'trunk', bias: 0.05, after: ['body'] });
  }
  s.tail.links.forEach((_, q) => {
    const f = tailLinkOf(s, q, s.tail.links, s.tail.w, s.tail.fin, s.tail.fan, 900);
    pieces.push({ key: `tail${q}`, mesh: f.mesh, bent: f.bend, bone: `tail${q}`, bias: -0.05 + q * 0.01, chain: 'tail' });
  });
  if (s.lobe) s.lobe.links.forEach((_, q) => {
    const f = tailLinkOf(s, q, s.lobe!.links, s.tail.w.map((x) => x * 0.8), s.lobe!.fin, s.tail.fan * 0.8, 950);
    pieces.push({ key: `lobe${q}`, mesh: f.mesh, bent: f.bend, bone: `lobe${q}`, bias: -0.06 + q * 0.01, chain: 'lobe' });
  });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const sideV: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    // The upper leg: a round shoulder, or a big haunch, on the flank, and the leg out of it to the elbow or the stifle.
    const hw = fore ? w * (1.5 - 0.12 * s.stage) : w * 1.95;
    const upperM = merge(
      orb([0, fore ? 0 : -w * 0.15, fore ? 0 : -w * 0.2], [hw, hw * (fore ? 1.1 : 1.15), hw * (fore ? 1.2 : 1.1)], n, k, 'coat'),
      tube([[0, 0, -w * 0.3], [0, 0, -L[0]]], [hw * 0.8, w * 0.88], [hw * 0.8, w * 0.88], n, 'coat', { seam: 'start' }),
      orb([0, 0, -L[0]], w * 0.88, n, k, 'coat'),
    );
    // A slender forearm, and a hind shin narrowing to the hock.
    const lowerM = tube([[0, 0, w * 0.5], [0, 0, -L[1] * 0.45], [0, 0.01, -L[1]]], fore ? [w * 0.82, w * 0.62, w * 0.48] : [w * 1.0, w * 0.72, w * 0.52], fore ? [w * 0.88, w * 0.66, w * 0.5] : [w * 1.1, w * 0.78, w * 0.54], n, 'coat', { seam: 'start' });
    const lastM = tube([[0, 0, w * 0.35], [0, 0, -L[2] * 0.5], [0, 0.01, -L[2] - s.paw * 0.1]], [w * 0.5, w * 0.46, w * 0.42], [w * 0.52, w * 0.48, w * 0.44], n, (ring) => (ring ? 'pad' : 'coat'), { seam: 'start' });
    pieces.push(
      { key: `${key}0`, mesh: upperM, bone: `${key}0`, bias: 0.01, after: ['body'], front: sideV },
      { key: `${key}1`, mesh: lowerM, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: out3 },
      { key: `${key}3`, mesh: lastM, bone: `${key}3`, bias: 0.025, after: ['body', `${key}1`], front: out3 },
      { key: `${key}2`, mesh: footOf(s, fore, n), bone: `${key}2`, bias: 0.03, after: ['body', `${key}3`], front: out3 },
    );
    // Petal-fins down the back of the fore legs, and at the hocks of the hind.
    const fin = fore ? legFinOf(s, L[1], w, s.legFin.n, 0, 0.4, 500 + i * 20) : legFinOf(s, L[2], w * 0.6, Math.max(1, s.legFin.n - 1), 0, 0.4, 600 + i * 20);
    pieces.push({ key: `${key}f`, mesh: fin.mesh, bent: fin.bend, bone: fore ? `${key}1` : `${key}3`, bias: 0.022, after: [fore ? `${key}1` : `${key}3`], front: [0, -1, 0] });
  }
  if (tack) pieces.push({ key: 'saddle', mesh: saddleOf(s, n), bone: 'trunk', bias: 0.1, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0', 'backFins'] });
  // Everything on the trunk bends with its back as it bounds (`flexOf`), as the legs, the neck and the tail come out of it.
  const bend = (v: readonly V3[], a: Anim): V3[] => { const f = flexOf(s, a); return f ? v.map((p) => flexPt(s, p, f)) : [...v]; };
  return pieces.map((pc) => {
    if (pc.bone !== 'trunk') return pc;
    const own = pc.bent;
    return { ...pc, bent: own ? (v: readonly V3[], a: Anim) => bend(own(v, a), a) : bend };
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const WATER_RGB: RGB = [176, 220, 240];
const WATER_INK: RGB = [74, 122, 152];
const WATER_LIGHT: RGB = [244, 252, 255];
const GRAVITY = 9;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const t = g.getTransform(); return 1 / (Math.hypot(t.a, t.b) || 1); };
const bigness = (s: Tide): number => 0.6 + 0.4 * (s.len / 1.8);

/** A drop of water: a round pale-blue bead, an inked edge and a light glint, never under a pixel and a bit across. */
function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.1 * px);
  g.fillStyle = css(WATER_INK, al * 0.9);
  g.beginPath();
  g.ellipse(x, y, r + 0.45 * px, r * 1.15 + 0.45 * px, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(WATER_RGB, al);
  g.beginPath();
  g.ellipse(x, y, r, r * 1.15, 0, 0, TAU);
  g.fill();
  if (r > 1.3 * px) {
    g.fillStyle = css(WATER_LIGHT, al);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.4, r * 0.36, 0, TAU);
    g.fill();
  }
}

/** A loose petal: a small pointed leaf of pink with a pale root, turning as it drifts. */
function fleck(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, tip: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.6 * px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = css(mix(tip, [90, 50, 70], 0.5), al * 0.8);
  g.beginPath();
  g.ellipse(0, 0, r + 0.5 * px, r * 0.42 + 0.5 * px, 0, 0, TAU);
  g.fill();
  const grad = g.createLinearGradient(-r, 0, r, 0);
  grad.addColorStop(0, css([252, 238, 186], al));
  grad.addColorStop(1, css(tip, al));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.42, 0, 0, TAU);
  g.fill();
  g.restore();
}

/** Where something thrown from `p` going `v` is `t` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * GRAVITY * t * t)];

/** Drops thrown from `from`, `since` seconds after, out and up, falling; each drawn on its side of the body, gone by `life`. */
function splash(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.55): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.7 * jitter(k + 1));
    const p = thrown(from, [Math.cos(a) * sp, Math.sin(a) * sp, up * (0.6 + 0.7 * jitter(k + 2))], since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    drop(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), 1 - smooth((since - life * 0.6) / (life * 0.4)));
  }
}

/** A ring of water going out over the ground at `c` from `since` seconds on, fading. */
function ripple(g: CanvasRenderingContext2D, view: View, c: V3, since: number, size: number): void {
  for (let q = 0; q < 2; q++) {
    const age = (since - q * 0.15) / 0.6;
    if (age < 0 || age >= 1) continue;
    const rx = size * (0.4 + 1.6 * age), N = 24;
    g.beginPath();
    for (let j = 0; j <= N; j++) {
      const a = (j / N) * TAU, [x, y] = onScreen(view, [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * rx * 0.8, 0.02]);
      if (j) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.strokeStyle = css(WATER_LIGHT, 0.85 * (1 - age));
    g.lineWidth = pxOf(g) * 1.3;
    g.stroke();
  }
}

/** What a strike throws: a splash where its fore feet slap down, or off the tip of its tail as it lashes, and a ring of water. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Tide, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - TIDE_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0 || since > 0.6) return;
  const at: V3[] = s.stage === 1 ? [place(b[`tail${s.tail.links.length - 1}`], [0, -s.tail.links[s.tail.links.length - 1], 0])] : [place(b.fl2, [0, 0, 0]), place(b.fr2, [0, 0, 0])];
  at.forEach((p, j) => {
    const ground: V3 = [p[0], p[1], 0.05];
    splash(g, view, mid, s.stage === 1 ? p : ground, since, front, 9, 10 + j * 31, 1.8 * big, 3 * big, 0.09 * big);
    if (!front) ripple(g, view, ground, since, 0.8 * big);
  });
}

/** What a go at its task throws: drops flung off it all round as it shakes, and a petal or two loosened. */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Tide, b: Bones, a: Anim, t: number, front: boolean, tip: RGB): void {
  const big = bigness(s), mid = b.body.t, loop = a.graze >= 0.5;
  const since = t < TIDE_WORK.shake - 0.08 && !loop ? -1 : (frac(t - (TIDE_WORK.shake - 0.08))) * ACT_SECS.work;
  if (since < 0 || since > 0.6) return;
  for (const [j, bone] of (['head', 'trunk', 'tail1'] as const).entries()) {
    if (!b[bone]) continue;
    splash(g, view, mid, place(b[bone], [0, 0, 0.1]), since, front, 4, 50 + j * 13, 1.8 * big, 1.6 * big, 0.05 * big);
  }
  const f = place(b.head, [0, -0.2, 0.4]), al = 1 - smooth(since / 0.6);
  for (let q = 0; q < 2; q++) {
    const p: V3 = add(f, [Math.cos(q * 2.4) * since * 1.2, -since * 0.8, 0.6 * since - 1.2 * since * since]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    fleck(g, x, y, 0.09 * big, q + since * 5, tip, al);
  }
}

/** Evolving: drops and loose petals swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Tide, b: Bones, t: number, front: boolean, tip: RGB): void {
  const big = bigness(s), mid = b.body.t, B = s.body;
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = B.w[3] * 1.8 + 0.3 * big, ry = s.len * 0.8 + 0.3 * big, high = s.high * 1.8 + 1.0 * big;
  for (let q = 0; q < 20; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36);
    const ang = (q / 20) * TAU + u * TAU * 1.3;
    const k = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -s.high * 0.7 + u * high * 0.8]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 2) fleck(g, x, y, 0.1 * big * (1 - 0.4 * u), ang * 2 + q, tip, swirl * ramp(u, 0, 0.15));
    else drop(g, x, y, 0.05 * big * (1 - 0.4 * u), swirl * ramp(u, 0, 0.15));
  }
}

/** The reins, saddled: from the bit at each side of its mouth back along its neck to the front of the saddle, slack; each drawn on the side it is on. */
function reins(g: CanvasRenderingContext2D, view: View, s: Tide, b: Bones, front: boolean): void {
  const T = view.T, mid = place(b.neck, [0, 0, s.neck.len * 0.5]);
  g.save();
  g.lineCap = 'round';
  const px = pxOf(g);
  for (const sd of [-1, 1]) {
    const a = place(b.head, bitAt(s, sd)), e = place(b.trunk, pommelAt(s, sd));
    const m: V3 = [(a[0] + e[0]) / 2 + sd * 0.1 * turn(b.neck, [1, 0, 0])[0], (a[1] + e[1]) / 2, (a[2] + e[2]) / 2 - 0.12 * s.len];
    if ((dot(sub(m, mid), T) > 0) !== front) continue;
    const A = onScreen(view, a), M = onScreen(view, m), E = onScreen(view, e);
    for (const [ink, w] of [['rgba(34,62,74,0.9)', Math.max(1.1 * px, 0.09)], ['rgb(96,150,166)', Math.max(0.55 * px, 0.045)]] as Array<[string, number]>) {
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

/** The tip of its fins for a variant's markings: its own colour, a little softened. */
const tipOf = (mark: RGB): RGB => mix(mark, pastel(mark, 330), 0.15);

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, preens and evolves; saddled and bridled with `tack`. */
function tideKind(s: Tide, tack: boolean): Kind {
  const bones = tideBones(s);
  let tip: RGB = [240, 150, 176];
  return {
    bones,
    build: (lod) => tideBuild(s, lod, tack),
    // The variant's coat tints its cream by as much as it has colour in it, and its markings are the tips of its fins; their
    // roots, their veins, its flecks, its eyes and its nose are the same on every variant.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const cream = mix([251, 242, 226], pastel(coat, 30), 0.3 + 0.4 * clamp(sat(coat) / 0.2));
      tip = tipOf(mark);
      const root: RGB = [253, 240, 184];
      return coatPalette(coat, mark, {
        coat: cream,
        coatLight: mix(cream, [255, 255, 252], 0.5),
        coatDark: mix(cream, [226, 196, 186], 0.5),
        belly: cream,
        muzzle: mix(cream, [255, 252, 248], 0.12),
        mark: tip,
        petal: darker(tip, 0.14),
        stem: mix(root, tip, 0.35),
        bloom: mix(root, tip, 0.62),
        leaf: mix(root, tip, 0.84),
        cap: root,
        pad: mix(cream, tip, 0.2),
        crystal: [226, 176, 92],
        spot: mix(cream, [222, 170, 92], 0.5),
        nose: [236, 132, 150],
        lid: [120, 74, 70],
        eyeWhite: [92, 58, 48],
        bill: [206, 132, 58],
        eye: [56, 32, 28],
        glint: [255, 253, 246],
        leather: [92, 148, 166],
        leatherDark: [60, 106, 124],
        metal: [232, 204, 140],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.len * 0.75 + 0.4, s.body.w[3] * 1.4],
    stride: 1,
    size: s.size,
    acts: ['strike', 'work'],
    // Gliding at a run it is carried through the air between its footfalls (`leapOf`) -- but not saddled, when it carries a
    // rider who sits where it is.
    leaps: tack ? undefined : [false, true],
    motes: [[246, 168, 190], [253, 240, 184]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (tack) reins(g, view, s, b, front);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front, tip);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front, tip);
    },
  };
}

const LOOKS = [SPRINGLET_LOOK, SPRINGSAIL_LOOK, TIDECOURSER_LOOK] as const;

export const SPRINGLET = tideKind(SPRINGLET_LOOK, false);
export const SPRINGSAIL = tideKind(SPRINGSAIL_LOOK, false);
export const TIDECOURSER = tideKind(TIDECOURSER_LOOK, false);
/** Each stage saddled and bridled, as it is drawn once it has been tacked to be ridden. */
export const TIDE_TACKED: readonly [Kind, Kind, Kind] = [tideKind(SPRINGLET_LOOK, true), tideKind(SPRINGSAIL_LOOK, true), tideKind(TIDECOURSER_LOOK, true)];

/** How high a rider sits on each stage, in screen pixels at zoom one over its feet, grown: the top of its saddle. */
export const tideSeat = (stage: number): number => {
  const s = LOOKS[Math.max(0, Math.min(2, stage))];
  return seatOf(s) * HEIGHT_SCALE * s.size;
};

/** How far its rider's legs are drawn up on each stage (`Seat.tuck`): knees high on the Springlet, a little on the Springsail, not at all on the Tidecourser. */
export const TIDE_TUCK: readonly number[] = [0.9, 0.4, 0];

/** Where its rider's reins go to on each stage: its bit, standing, in the rider's own units from the top of the saddle (`Seat.grip`), grown. */
export const tideGrip = (stage: number): V3 => {
  const st = Math.max(0, Math.min(2, stage)), s = LOOKS[st], b = TIDE_TACKED[st].bones({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
  const bit = scale(add(place(b.head, bitAt(s, 1)), place(b.head, bitAt(s, -1))), 0.5);
  return [0, bit[1] * s.size, (bit[2] - seatOf(s)) * s.size];
};
