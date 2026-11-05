import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The brewing toads: the Brewtoad, a small round olive toad sat in a little
 * barrel with only its head and its two hands over the rim, a wreath of hop
 * leaves, a white flower and a hop cone on its head, its cheeks pink and its
 * mouth wide open in a grin; which grows into the Brothgut, bigger, sat up,
 * its round belly a banded barrel with copper bands and rivets and a leather
 * strap with a brass buckle across its chest, a thicker mane of hop vine down
 * its back with hop cones and flowers in it; and then the Barrelburp, large
 * and fat, sat back on its haunches with its hands on the top of its great
 * barrel of a belly, gold-banded and riveted with a golden hop crest on its
 * front, a gold chain round its neck with a hop cone hung on it, and a heavy
 * mane of hop vine down its back and sides, golden cones and white flowers all
 * through it. All three are olive green, spotted a greyer olive, cream at the
 * throat, with round black eyes and a pink tongue. The species is still
 * `hoppa` underneath, as saves and the database know it: the brewer.
 *
 * The tap on each barrel is on its left side, half way up, and runs out and
 * then down: asked for, "offset the spigot to one side", so that from in front
 * it is at the barrel's edge and never low in the middle of it.
 *
 * Built on the toad line's body (`./wild-toad`): the same rings, head, eyes,
 * legs and feet, and the same walk -- a waddle, the smaller two hopping at a
 * run. It sits up, its front tipped up off the ground; its hind feet are
 * planted out in front of its barrel, and its fore legs are arms whose hands
 * rest on the barrel, where they are put, wherever its feet are.
 *
 * At its task it pats its barrel, one hand and the other, to the beat, its
 * head bobbing, a bubble of froth coming up at each pat and a drop of brew off
 * the tap; then it sits back and croaks with its throat blown up -- and the
 * Barrelburp, drumming with both hands, burps a puff of froth.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** A leg: its hip or shoulder (right side, body frame), its two lengths, where its foot stands, its foot, how thick, how far its foot is turned out. */
interface Leg {
  hip: V3;
  len: [number, number];
  /** Where the ball of its foot stands, across and along, from under the body's middle. */
  at: [number, number];
  /** Heel (or wrist) to the ball of the foot; each toe's length; how many toes. */
  foot: number; toe: number; toes: number;
  /** How thick (a radius). */
  w: number;
  /** How far the foot is turned out from the way the body faces (degrees). */
  turn: number;
}

/** A thing on its back, by where it stands: along the body (-1 its rump to 1 its shoulders), round it from its right side (radians; a quarter turn is the ridge), and how big. */
type Spot = readonly [number, number, number];
/** A thing on its head: across, along and up the head's egg, as shares of its half-sizes, and how big. */
type HeadSpot = readonly [number, number, number, number];

/**
 * Its barrel, standing on the ground: its foot this far forward of under the body's middle, its radius at the ends and its
 * height; its bands, as shares of the height, gold or copper, with this many rivets each; whether it is a tub it sits in, with
 * an open top; and whether a hop crest is on its front.
 */
interface Cask {
  y: number; r: number; h: number;
  bands: readonly number[];
  gold: boolean;
  rivets: number;
  tub: boolean;
  crest: boolean;
}

interface Toad {
  stage: 0 | 1 | 2;
  body: Rings;
  marks?: Rings;
  /** How high the body's middle is carried, and how far its front is tipped up (degrees). */
  high: number;
  tilt: number;
  /**
   * The head: where it joins the body (body frame), how far forward and up its middle is from there, its half-sizes (across,
   * along, up), how far the mouth line is below its middle (a share of its height), how far its corners turn up, and its pitch.
   */
  head: { at: V3; fwd: number; up: number; r: V3; mouth: number; smile: number; pitch: number };
  /** The eyes: each on a low dome on the head, across, along and up as shares of the head's half-sizes; the dome's radius; the eye's; how far the lid is down (nought to one); the pupil's height against its width. */
  eye: { at: V3; dome: number; size: number; lid: number; round: number };
  /** How far its mouth stands open, a grin (degrees). */
  gape: number;
  fore: Leg;
  hind: Leg;
  /** Where its right hand rests on its barrel: round from the barrel's front toward its right (degrees), up it (a share of its height), and out from its staves. */
  hand: V3;
  cask: Cask;
  /** What it wears: hop leaves round its head and down its back, flowers and cones among them, and a strap or a chain. */
  dress: {
    wreath: readonly HeadSpot[]; flowers: readonly HeadSpot[]; cones: readonly HeadSpot[];
    mane: readonly Spot[]; maneCones: readonly Spot[]; maneFlowers: readonly Spot[];
    strap: boolean; chain: boolean;
  };
  gait: {
    duty: number; swing: [number, number];
    step: number; bob: number; roll: number; hop: number;
    /** How much its belly squashes at a footfall. */
    jiggle: number;
  };
  /** Whether it hops at a run; the Barrelburp waddles instead. */
  hops: boolean;
  size: number;
}

/** A Brewtoad: small and round, sat in a little barrel with only its head and hands over the rim, a hop wreath, a big grin. */
const BREWTOAD_LOOK: Toad = {
  stage: 0,
  // Its body within its tub's walls at the rim (`cask.r`), so that none of it stands out through them from any side.
  body: { y: [-0.42, -0.36, -0.18, 0, 0.18, 0.32, 0.4], z: [0.02, 0.02, 0.01, 0, 0, 0.02, 0.04], w: [0.33, 0.55, 0.64, 0.66, 0.62, 0.51, 0.29], h: [0.26, 0.4, 0.47, 0.49, 0.46, 0.39, 0.24] },
  high: 0.5, tilt: 22,
  head: { at: [0, 0.3, 0.2], fwd: 0.13, up: 0.12, r: [0.62, 0.46, 0.4], mouth: 0.2, smile: 0.22, pitch: -14 },
  eye: { at: [0.5, 0.3, 0.62], dome: 0.17, size: 0.15, lid: 0.04, round: 1 },
  gape: 14,
  fore: { hip: [0.4, 0.24, -0.1], len: [0.24, 0.22], at: [0.5, 0.4], foot: 0.08, toe: 0.11, toes: 4, w: 0.15, turn: 16 },
  hind: { hip: [0.36, -0.26, -0.14], len: [0.26, 0.24], at: [0.4, 0.0], foot: 0.1, toe: 0.1, toes: 4, w: 0.15, turn: 28 },
  hand: [42, 1.02, 0.02],
  cask: { y: 0.04, r: 0.78, h: 0.66, bands: [0.2, 0.78], gold: false, rivets: 0, tub: true, crest: false },
  dress: {
    wreath: [[0.55, -0.35, 0.75, 0.22], [0.2, -0.3, 0.95, 0.24], [-0.2, -0.3, 0.95, 0.24], [-0.55, -0.35, 0.75, 0.22], [0.75, -0.6, 0.35, 0.18], [-0.75, -0.6, 0.35, 0.18]],
    flowers: [[0.35, -0.05, 0.95, 0.14]],
    cones: [[-0.4, -0.35, 0.9, 0.098]],
    mane: [], maneCones: [], maneFlowers: [],
    strap: false, chain: false,
  },
  gait: { duty: 0.62, swing: [0.2, 0.3], step: 0.2, bob: 0.05, roll: 6, hop: 0.5, jiggle: 0.05 },
  hops: true,
  size: 3.4,
};

/** A Brothgut: bigger, sat up, its round belly a copper-banded barrel, a leather strap across its chest, hop vine down its back. */
const BROTHGUT_LOOK: Toad = {
  stage: 1,
  body: { y: [-0.8, -0.68, -0.34, 0, 0.32, 0.56, 0.68], z: [0.02, 0.02, 0, 0, -0.02, 0, 0.02], w: [0.6, 1.0, 1.14, 1.16, 1.08, 0.88, 0.5], h: [0.46, 0.7, 0.82, 0.84, 0.8, 0.66, 0.38] },
  high: 1.2, tilt: 42,
  head: { at: [0, 0.56, 0.3], fwd: 0.16, up: 0.12, r: [0.86, 0.62, 0.52], mouth: 0.2, smile: 0.26, pitch: -30 },
  eye: { at: [0.5, 0.32, 0.6], dome: 0.21, size: 0.17, lid: 0.06, round: 1 },
  gape: 16,
  fore: { hip: [0.86, 0.36, -0.12], len: [0.46, 0.42], at: [0.92, 0.72], foot: 0.13, toe: 0.15, toes: 4, w: 0.18, turn: 18 },
  // Its hips out past its barrel's sides, so its thighs sit against the staves rather than in them.
  hind: { hip: [0.92, -0.46, -0.36], len: [0.56, 0.5], at: [1.14, 0.85], foot: 0.2, toe: 0.18, toes: 4, w: 0.3, turn: 34 },
  hand: [42, 0.98, 0.02],
  cask: { y: 0.4, r: 0.86, h: 1.18, bands: [0.14, 0.5, 0.86], gold: false, rivets: 12, tub: false, crest: false },
  dress: {
    wreath: [[0.55, -0.35, 0.75, 0.3], [0.2, -0.3, 0.95, 0.32], [-0.2, -0.3, 0.95, 0.32], [-0.55, -0.35, 0.75, 0.3], [0.8, -0.6, 0.3, 0.26], [-0.8, -0.6, 0.3, 0.26], [0, -0.75, 0.6, 0.3]],
    flowers: [[0.4, 0.0, 0.92, 0.182], [-0.85, -0.45, 0.25, 0.14]],
    cones: [[-0.4, -0.25, 0.92, 0.117], [0.8, -0.5, 0.15, 0.104]],
    mane: [[0.75, 1.57, 0.42], [0.35, 1.57, 0.46], [-0.1, 1.57, 0.46], [-0.55, 1.57, 0.4], [0.6, 1.15, 0.4], [0.15, 1.1, 0.42], [-0.35, 1.1, 0.4], [-0.75, 1.15, 0.32], [0.45, 0.7, 0.36], [-0.1, 0.65, 0.36]],
    maneCones: [[0.55, 1.35, 0.11], [-0.2, 1.25, 0.12], [0.2, 0.85, 0.1]],
    maneFlowers: [[0.15, 1.45, 0.14], [-0.5, 0.95, 0.12]],
    strap: true, chain: false,
  },
  gait: { duty: 0.64, swing: [0.2, 0.28], step: 0.18, bob: 0.04, roll: 6, hop: 0.36, jiggle: 0.06 },
  hops: true,
  size: 4.3,
};

/** A Barrelburp: large and fat, sat back, its great barrel belly gold-banded with a hop crest, a gold chain, a heavy hop mane. */
const BARRELBURP_LOOK: Toad = {
  stage: 2,
  body: { y: [-1.08, -0.94, -0.48, 0, 0.46, 0.8, 0.96], z: [0.04, 0.04, 0.02, 0, 0, 0.02, 0.04], w: [0.84, 1.4, 1.6, 1.62, 1.52, 1.24, 0.7], h: [0.56, 0.86, 0.98, 1.0, 0.96, 0.8, 0.46] },
  high: 1.62, tilt: 46,
  head: { at: [0, 0.82, 0.3], fwd: 0.2, up: 0.1, r: [1.06, 0.74, 0.6], mouth: 0.2, smile: 0.28, pitch: -34 },
  eye: { at: [0.5, 0.36, 0.6], dome: 0.24, size: 0.18, lid: 0.12, round: 1 },
  gape: 18,
  fore: { hip: [1.18, 0.5, -0.1], len: [0.62, 0.56], at: [1.2, 0.86], foot: 0.2, toe: 0.22, toes: 4, w: 0.27, turn: 16 },
  hind: { hip: [1.24, -0.62, -0.42], len: [0.7, 0.62], at: [1.5, 1.05], foot: 0.26, toe: 0.24, toes: 4, w: 0.44, turn: 34 },
  hand: [44, 0.98, 0.02],
  cask: { y: 0.46, r: 1.2, h: 1.66, bands: [0.12, 0.42, 0.66, 0.9], gold: true, rivets: 16, tub: false, crest: true },
  dress: {
    wreath: [[0.55, -0.35, 0.75, 0.38], [0.2, -0.3, 0.95, 0.4], [-0.2, -0.3, 0.95, 0.4], [-0.55, -0.35, 0.75, 0.38], [0.85, -0.6, 0.3, 0.32], [-0.85, -0.6, 0.3, 0.32], [0, -0.8, 0.55, 0.4]],
    flowers: [[0.3, 0.05, 0.94, 0.224], [-0.85, -0.45, 0.3, 0.168]],
    cones: [[-0.35, -0.2, 0.94, 0.143], [0.75, -0.55, 0.2, 0.13]],
    mane: [
      [0.85, 1.57, 0.56], [0.45, 1.57, 0.6], [0.0, 1.57, 0.62], [-0.45, 1.57, 0.58], [-0.82, 1.57, 0.48],
      [0.7, 1.2, 0.54], [0.25, 1.15, 0.58], [-0.2, 1.15, 0.56], [-0.62, 1.18, 0.5],
      [0.6, 0.78, 0.5], [0.15, 0.72, 0.54], [-0.3, 0.72, 0.52], [-0.72, 0.8, 0.44],
      [0.4, 0.35, 0.44], [-0.1, 0.32, 0.46], [-0.55, 0.38, 0.4],
    ],
    maneCones: [[0.7, 1.4, 0.14], [0.1, 1.35, 0.15], [-0.45, 1.3, 0.14], [0.45, 0.95, 0.14], [-0.15, 0.9, 0.15], [0.25, 0.5, 0.13], [-0.6, 0.55, 0.13]],
    maneFlowers: [[0.35, 1.45, 0.17], [-0.2, 1.48, 0.16], [0.6, 1.0, 0.15], [-0.45, 0.95, 0.15], [0.05, 0.55, 0.14]],
    strap: false, chain: true,
  },
  gait: { duty: 0.68, swing: [0.18, 0.26], step: 0.15, bob: 0.035, roll: 6, hop: 0, jiggle: 0.06 },
  hops: false,
  size: 5.2,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

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

function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** A frame scaled along its own three axes. */
const scaled = (x: Xf, k: V3): Xf => { const m = x.m; return { m: [m[0] * k[0], m[1] * k[1], m[2] * k[2], m[3] * k[0], m[4] * k[1], m[5] * k[2], m[6] * k[0], m[7] * k[1], m[8] * k[2]], t: x.t }; };

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
    const w = want[q];
    if (nx * w[0] + ny * w[1] + nz * w[2] < 0) idx.reverse();
  });
  return f;
}

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

/** A painted band along a run of points on a surface, `w` wide (half), each point's way out given. */
function lineOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number | readonly number[], m: Mat, lift = 0.012): Disc {
  const at = (k: number): number => (typeof w === 'number' ? w : w[Math.min(k, w.length - 1)]);
  const up = (q: { p: V3; n: V3 }, k: number, sd: number): V3 => {
    const K = pts.length, d = unit(sub(pts[Math.min(K - 1, k + 1)].p, pts[Math.max(0, k - 1)].p));
    const side = unit(cross(q.n, d));
    return add(add(q.p, scale(q.n, lift)), scale(side, sd * at(k)));
  };
  const v = [...pts.map((q, k) => up(q, k, 1)), ...[...pts].map((q, k) => up(q, k, -1)).reverse()];
  return facingDisc(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** A thin flat thing along a line of points -- a leaf of moss -- `widths` across it, its face along `face`, folded a little down its middle. */
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
  return mesh(v, woundTo(v, f, want));
}

function about(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), sn = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), sn)), scale(k, dot(k, v) * (1 - c)));
}

/** A body's rings rounded off at its ends, as the end of an egg is. */
function rounded(R: Rings): Rings {
  const n = R.y.length, y0 = R.y[0], y1 = R.y[n - 1], mid = (y0 + y1) / 2, half = (y1 - y0) / 2;
  const core: Rings = { y: R.y.slice(1, n - 1), z: R.z.slice(1, n - 1), w: R.w.slice(1, n - 1), h: R.h.slice(1, n - 1) };
  const out: Rings = { y: [], z: [], w: [], h: [] }, N = 14, p = 2.4;
  for (let k = 0; k <= N; k++) {
    const u = -Math.cos((Math.PI * k) / N), y = mid + half * u, c = ringAt(core, clamp(y, core.y[0], core.y[core.y.length - 1]));
    const cap = Math.max(0.12, (1 - Math.abs(u) ** p) ** (1 / p));
    out.y.push(y);
    out.z.push(c.z);
    out.w.push(c.w * cap);
    out.h.push(c.h * cap);
  }
  return out;
}

function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}
/** A smooth run through keys (time, value), times nought to one in order, held at either end. */
function keysAt(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  if (u <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [t0, v0] = keys[q], [t1, v1] = keys[q + 1];
    if (u <= t1) return lerp(v0, v1, smooth((u - t0) / Math.max(1e-6, t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
/** A smooth loop through keys (time, value), times nought to one in order, wrapping round. */
function loopCurve(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  const w = frac(u), n = keys.length;
  let i = n - 1;
  for (let q = 0; q < n; q++) if (keys[q][0] <= w) i = q;
  const [t0, v0] = keys[i], [t1raw, v1] = keys[(i + 1) % n];
  const t1 = i + 1 < n ? t1raw : t1raw + 1, ww = w < t0 ? w + 1 : w;
  return lerp(v0, v1, smooth((ww - t0) / Math.max(1e-6, t1 - t0)));
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Brewtoad's bite, the Brothgut's belly-slam, the Barrelburp's slam of both hands. */
export const BREW_HITS: readonly number[] = [0.5, 0.54, 0.56];
/** The Brewtoad's mouth opening, and when the Brothgut and the Barrelburp leave the ground or rear, as shares of the strike. */
export const BREW_STRIKE = { open: 0.38, rise: 0.26 } as const;
/**
 * A go at its task, as shares of it: each pat of a hand on its barrel, and the croak (the Barrelburp's burp) it sits back for.
 * It loops, so a go and the next are one.
 */
export const BREW_WORK = { pats: [0.12, 0.24, 0.36, 0.48, 0.6] as const, croak: 0.8 } as const;
/** When it croaks as it stands about, in seconds into its loop, and for how long its throat is blown up. */
export const BREW_CROAKS: readonly number[] = [6.2, 17.8];
export const BREW_CROAK_LEN = 0.8;
const TOAD_CROAKS = BREW_CROAKS, TOAD_CROAK_LEN = BREW_CROAK_LEN, TOAD_HITS = BREW_HITS, TOAD_STRIKE = BREW_STRIKE;

/* ---- where its feet go ---------------------------------------------------------------- */

/**
 * A pose: where the ball of each foot is (along the ground, from under the body's middle) and how far its heel is lifted off it
 * (degrees, toes staying down); how the body is carried; the head pitched up, turned left and tilted; the jaw opened (degrees),
 * and the throat blown up (nought to one); and each hand moved from where it rests on its barrel (the body's frame).
 */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  head: [number, number, number];
  jaw: number; throat: number;
  hand: [V3, V3];
}

interface Rest {
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
  heel: number[];
}

const rests = new Map<Toad, Rest>();
const legOfI = (s: Toad, i: number): Leg => (i < 2 ? s.fore : s.hind);
function restOf(s: Toad): Rest {
  const had = rests.get(s);
  if (had) return had;
  const hip: V3[] = [], ankle: V3[] = [], reach: number[] = [], legs: Array<[number, number]> = [], heel: number[] = [];
  for (let i = 0; i < 4; i++) {
    const L = legOfI(s, i);
    hip.push([SIDE[i] * L.hip[0], L.hip[1], L.hip[2]]);
    ankle.push([SIDE[i] * L.at[0], L.at[1], 0]);
    reach.push(L.len[0] + L.len[1]);
    legs.push(L.len);
    heel.push(L.w * 0.5);
  }
  const R = { hip, ankle, legs, reach, heel };
  rests.set(s, R);
  return R;
}

function restPlan(s: Toad, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    head: [0, 0, 0], jaw: 0, throat: 0, hand: [[0, 0, 0], [0, 0, 0]],
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    jaw: m(a.jaw, b.jaw), throat: m(a.throat, b.throat),
    hand: [mixV(a.hand[0], b.hand[0], k), mixV(a.hand[1], b.hand[1], k)],
  };
}

function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  const dv = (x: V3, a: V3, b: V3): V3 => [d(x[0], a[0], b[0]), d(x[1], a[1], b[1]), d(x[2], a[2], b[2])];
  return {
    at: p.at.map((x, i) => dv(x, to.at[i], from.at[i])),
    foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    jaw: d(p.jaw, to.jaw, from.jaw), throat: d(p.throat, to.throat, from.throat),
    hand: [dv(p.hand[0], to.hand[0], from.hand[0]), dv(p.hand[1], to.hand[1], from.hand[1])],
  };
}

/** How long the body is, hip to shoulder: what its moves are measured in. */
const lenOf = (s: Toad): number => s.fore.hip[1] - s.hind.hip[1];

/** A toad's crawl: the diagonals together, the left fore with the right hind. */
const CRAWL = [0, 0.5, 0.5, 0];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/**
 * Walking, a heavy waddle, the diagonals together: each foot down for its share of a stride and swept back under the body, then
 * lifted and brought forward round out from the body. The body sinks onto each pair as it comes down, its belly squashing, and
 * rolls well over onto the side whose fore foot is down; its head swings the other way. Faster, the Bastiontoad's steps are
 * longer and its roll heavier: a lumber.
 */
function crawlPlan(s: Toad, R: Rest, a: Anim, fast = 0): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s);
  const p = restPlan(s, R);
  const duty = lerp(G.duty, 0.56, fast), amp = lerp(G.swing[0], G.swing[1], fast), step = G.step * (1 + 0.4 * fast);
  for (let i = 0; i < 4; i++) {
    const reach = R.reach[i], half = reach * amp * (i < 2 ? 0.9 : 1), A = R.ankle[i], ph = frac(a.u + CRAWL[i]);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      p.foot[i] = (i < 2 ? 10 : 18) * ramp(ph / duty, 0.72, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    const lift = step * reach * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0] + SIDE[i] * 0.08 * reach * Math.sin(Math.PI * u), y, lift];
    p.foot[i] = (i < 2 ? 10 : 18) * (1 - smooth(u / 0.7)) + (i < 2 ? -8 : -10) * hump(u, 0.75, 0.25);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.04));
  p.H += -L * G.bob * (1 + 0.5 * fast) * down;
  p.squash = G.jiggle * (1 + 0.6 * fast) * hump(frac(2 * w - 0.06), 0.12, 0.2);
  const over = Math.sin(TAU * (w + 0.25 - duty / 2));
  p.roll = G.roll * (1 + 0.5 * fast) * over;
  p.side = L * 0.035 * over;
  p.yaw = 4 * Math.sin(TAU * (w - 0.1));
  p.pitch = 2 * (down - 0.5);
  p.head = [3 * (2 * down - 1), -7 * Math.sin(TAU * (w - 0.1)), -3 * over];
  p.throat = 0.1 * (1 - down);
  return p;
}

/** A hop, as shares of a stride: the hind feet down from nought to `HOP_LIFT`, the fore from `HOP_LAND` round to `HOP_UP`. */
const HOP_LIFT = 0.5, HOP_LAND = 0.72, HOP_UP = 0.25;

/**
 * Running, the smaller two hop: short and heavy, crouched on all four, then the hind legs heave it up and forward, it is in the
 * air a moment, hind legs trailing, and it lands on its hands with a squash that runs through its belly and draws its feet in
 * under it. The air carries it the rest of the way (`Kind.leaps`).
 */
function hopPlan(s: Toad, R: Rest, a: Anim): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s), up = G.hop * s.high;
  const p = restPlan(s, R);
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, reach = R.reach[i], half = reach * G.swing[1] * (fore ? 0.7 : 1), A = R.ankle[i];
    const start = fore ? HOP_LAND : 0, duty = fore ? 1 - HOP_LAND + HOP_UP : HOP_LIFT;
    const ph = frac(w - start);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      p.foot[i] = fore ? 0 : 50 * ramp(ph / duty, 0.45, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), R2 = reach;
    if (fore) {
      const y = keysAt([[0, A[1] - half], [0.3, A[1] + 0.1 * R2], [0.62, A[1] + half + 0.05 * R2], [0.7, A[1] + half], [1, A[1] + half]], u);
      p.at[i] = [A[0] * (1 - 0.08 * Math.sin(Math.PI * u)), y, up * keysAt([[0, 0], [0.3, 0.9], [0.62, 1.0], [0.84, 0.6], [1, 0]], u)];
      p.foot[i] = -14 * Math.sin(Math.PI * u);
    } else {
      const y = keysAt([[0, A[1] - half], [0.1, A[1] - half - 0.25 * R2], [0.32, A[1] - half - 0.9 * R2], [0.62, A[1] - 0.3 * R2], [1, A[1] + half]], u);
      p.at[i] = [A[0] * (1 - 0.06 * Math.sin(Math.PI * u)), y, up * keysAt([[0, 0], [0.1, 0.7], [0.32, 1.0], [0.6, 0.9], [0.86, 0.3], [1, 0]], u)];
      p.foot[i] = 50 * (1 - smooth(u / 0.5)) + 30 * hump(u, 0.3, 0.25) - 8 * hump(u, 0.8, 0.15);
    }
  }
  p.H = s.high + up * loopCurve([[0, -0.25], [0.24, -0.2], [0.46, 0.4], [0.58, 1], [0.7, 0.55], [0.78, -0.05], [0.88, -0.32]], w);
  // Tipped back as it leaves the ground and forward as it lands, about how it sits: gently, its barrel with it.
  p.pitch = 0.5 * loopCurve([[0, 2], [0.25, 3], [0.46, 8], [0.56, -2], [0.66, -10], [0.74, -14], [0.86, -6], [0.95, 0]], w);
  // Its belly squashed hard as it lands and bouncing back, stretched a little in the air.
  p.squash = loopCurve([[0, 0.1], [0.12, 0.04], [0.3, 0.0], [0.46, -0.08], [0.56, -0.1], [0.68, -0.04], [0.76, 0.06], [0.82, 0.16], [0.9, 0.06]], w);
  p.surge = L * loopCurve([[0, -0.03], [0.4, 0.02], [0.6, 0.06], [0.8, 0.02]], w);
  p.head = [-0.6 * p.pitch + 3, 0, 0];
  p.throat = 0.15 * hump(w, 0.8, 0.12);
  return p;
}

function goingPlan(s: Toad, R: Rest, a: Anim): Plan {
  if (!s.hops) return crawlPlan(s, R, a, smooth(clamp(a.gait)));
  if (a.gait <= 0) return crawlPlan(s, R, a);
  if (a.gait >= 1) return hopPlan(s, R, a);
  return mixPlan(crawlPlan(s, R, a), hopPlan(s, R, a), smooth(a.gait));
}

/** How far its throat is blown up this moment as it croaks standing about, nought to one. */
function croakOf(t: number): number {
  let k = 0;
  for (const c of TOAD_CROAKS) {
    const u = (t - c) / TOAD_CROAK_LEN;
    if (u > -0.2 && u < 1.2) k = Math.max(k, ramp(u, 0, 0.25) * (1 - ramp(u, 0.75, 1)));
  }
  return k;
}

/**
 * Standing about: breathing, its throat pouch pulsing, looking about; twice a loop it croaks, its throat blown up into a great
 * cream bubble and its body swelling with it; now and then it settles its weight, and shifts a hand.
 */
function stillPlan(s: Toad, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, L = lenOf(s);
  const look = drift(t);
  p.head = [2 * cyc(t, 5) + 2 * a.breath, 12 * look, 3 * drift(t, 2)];
  p.H += 0.015 * L * (a.breath - 0.5);
  p.squash = 0.02 * (0.5 - a.breath);
  // The throat pouch going in and out, a beat a second and a little.
  p.throat = 0.1 + 0.12 * Math.max(0, Math.sin(t * TAU));
  const croak = croakOf(t);
  p.throat = Math.max(p.throat, croak);
  p.squash -= 0.05 * croak;
  p.head[0] += 5 * croak;
  p.jaw = 2 * croak;
  // Its weight settled: a little sink and a wobble through its belly.
  const settle = beat(t, [3.4, 12.0, 21.0], 0.7);
  p.H -= 0.03 * L * settle;
  p.squash += 0.05 * settle;
  // A pat on its barrel now and then, with its right hand, and once with its left.
  for (const [at, i] of [[9.4, 1], [14.2, 1], [19.6, 0]] as Array<[number, number]>) {
    const u = clamp((t - at) / 0.7);
    if (u > 0 && u < 1) p.hand[i] = [0, -0.03 * L * Math.sin(Math.PI * u), 0.12 * L * Math.max(0, Math.sin(TAU * u))];
  }
  return p;
}


/* ---- its strike ------------------------------------------------------------------------------- */

/** The Brewtoad's bite: drawn back into its barrel, a hop forward in it with its mouth wide, snapped shut on what is in front of it, and back. */
function lungeBite(s: Toad, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = TOAD_HITS[0], L = lenOf(s);
  const back = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.34, 0.44));
  const lunge = ramp(t, 0.34, 0.48) * (1 - ramp(t, 0.62, 0.96));
  const air = hump(t, 0.42, 0.08), jolt = hump(t, hit + 0.03, 0.06);
  p.surge = L * (-0.18 * back + 0.5 * lunge);
  p.H += L * (-0.1 * back + 0.3 * air);
  p.pitch = 6 * back - 10 * lunge + 8 * air;
  p.head = [8 * back - 4 * lunge + 6 * ramp(t, TOAD_STRIKE.open, hit - 0.04) * (1 - ramp(t, hit - 0.02, hit)), 0, 0];
  p.squash = 0.1 * back - 0.06 * air + 0.1 * jolt;
  p.jaw = 30 * ramp(t, TOAD_STRIKE.open, hit - 0.05) * (1 - ramp(t, hit - 0.03, hit)) - 20 * hump(t, hit + 0.02, 0.05);
  // Its hands gripping the rim the harder as it goes.
  for (const i of [0, 1]) p.hand[i] = [0, 0.04 * L * lunge, -0.03 * L * back];
  for (const i of [2, 3]) p.foot[i] = 30 * hump(t, 0.4, 0.1);
  return p;
}

/** The Brothgut's belly-slam: crouched, then a heavy hop up and forward, and down barrel-first onto what is in front of it. */
function bellySlam(s: Toad, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = TOAD_HITS[1], L = lenOf(s);
  const crouch = ramp(t, 0.04, 0.24) * (1 - ramp(t, TOAD_STRIKE.rise, 0.34));
  const air = ramp(t, TOAD_STRIKE.rise, 0.42) * (1 - ramp(t, 0.44, hit));
  const slam = ramp(t, 0.44, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.1 * crouch + 0.2 * air + 0.32 * slam);
  p.H += L * (-0.12 * crouch + 0.5 * air - 0.12 * slam);
  p.pitch = -4 * crouch + 10 * air - 16 * slam;
  p.head = [6 * crouch - 10 * air + 6 * slam, 0, 0];
  p.squash = 0.1 * crouch - 0.1 * air + 0.24 * jolt + 0.04 * slam;
  p.jaw = 14 * air;
  p.throat = 0.6 * air;
  // Its hands up off its barrel in the air, and slapped back down on it as it lands.
  for (const i of [0, 1]) p.hand[i] = [SIDE[i] * 0.06 * L * air, 0, 0.3 * L * air - 0.03 * L * jolt];
  for (const i of [2, 3]) {
    const A = R.ankle[i], out: V3 = [A[0] * 1.08, A[1] + L * 0.2, 0];
    if (t < hit) p.at[i] = mixV(A, out, ramp(t, 0.3, hit - 0.02));
    else p.at[i] = arc(out, A, ramp(t, 0.7 + 0.05 * i, 0.94 + 0.01 * i), R.reach[i] * 0.2);
    p.at[i][2] += R.reach[i] * 0.2 * air;
    p.foot[i] = 40 * hump(t, TOAD_STRIKE.rise + 0.04, 0.08);
  }
  return p;
}

/** The Barrelburp's slam: reared back with both hands high, then brought down on the top of its barrel, shaking the ground. */
function quakeStomp(s: Toad, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = TOAD_HITS[2], L = lenOf(s);
  const rear = ramp(t, 0.04, 0.4) * (1 - ramp(t, 0.44, hit));
  const down = ramp(t, 0.46, hit) * (1 - ramp(t, hit + 0.14, 0.96));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.1 * rear + 0.1 * down);
  p.H += L * (0.08 * rear - 0.08 * down);
  p.pitch = 10 * rear - 6 * down;
  p.head = [-10 * rear + 8 * down, 0, 0];
  p.squash = -0.04 * rear + 0.2 * jolt + 0.04 * down;
  p.jaw = 22 * rear * (1 - ramp(t, 0.42, hit));
  p.throat = 0.5 * rear;
  for (const i of [0, 1]) p.hand[i] = [SIDE[i] * 0.1 * L * rear, -0.1 * L * rear, 0.75 * L * rear - 0.04 * L * jolt];
  for (const i of [2, 3]) p.foot[i] = 20 * rear;
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));
/** How far through its croak (its burp) at the end of a go it is, nought to one and back. */
const croakAt = (t: number): number => ramp(t, BREW_WORK.croak - 0.08, BREW_WORK.croak) * (1 - ramp(t, BREW_WORK.croak + 0.07, BREW_WORK.croak + 0.15));
/** Which hands come down at each pat: one and the other, or both together on the Barrelburp, which drums. */
const patHands = (s: Toad, q: number): number[] => (s.stage === 2 ? [0, 1] : [q % 2]);
/** A hand's pat, `u` nought to one through it: lifted, brought down on the barrel at seven tenths, and settled. */
const patLift = (u: number): number => keysAt([[0, 0], [0.5, 1], [0.7, -0.12], [0.85, 0.05], [1, 0]], u);

/**
 * A go at its task: sat over its barrel, it pats it, its left hand and its right by turns (the Barrelburp drums both together),
 * its head bobbing to each and its belly giving at each; then it sits back and croaks with its throat blown up -- the
 * Barrelburp's a burp. It starts and ends sat still, so a go and the next are one.
 */
function workPlan(s: Toad, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s), W = BREW_WORK;
  let bob = 0;
  W.pats.forEach((at, q) => {
    const u = clamp((t - (at - 0.07)) / 0.1);
    if (u <= 0 || u >= 1) return;
    const lift = patLift(u);
    for (const i of patHands(s, q)) p.hand[i] = add(p.hand[i], [0, -0.05 * L * lift, 0.2 * L * lift]);
    bob += hump(u, 0.72, 0.2);
  });
  const croak = croakAt(t), big = s.stage === 2 ? 1 : 0.7;
  p.head = [-7 * bob + 14 * croak, 3 * Math.sin(t * TAU * 2.5), 0];
  p.squash = 0.05 * bob - 0.06 * croak;
  p.H -= L * 0.02 * bob;
  p.pitch = 5 * croak;
  p.throat = 0.15 + croak * big;
  p.jaw = croak * (s.stage === 2 ? 20 : 10);
  p.roll = 2 * Math.sin(t * TAU * 2.5);
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched down small as the light gathers, then up tall at the turn with its throat blown up, a shake, and settled. */
function evolvePlan(s: Toad, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.06 * hunch + 0.08 * up);
  p.pitch = -4 * hunch + 10 * up;
  p.head = [-10 * hunch + 10 * up, 6 * shake, 10 * shake];
  p.roll = 4 * shake;
  p.squash = 0.1 * hunch - 0.06 * up + 0.08 * hump(t, 0.72, 0.05);
  p.throat = up;
  p.jaw = 6 * up;
  for (const i of [2, 3]) p.foot[i] = 20 * up;
  return p;
}

/** How much of a leg's reach any foot may take before the body is let down to it. */
const MOST_REACH = 0.94;

function heelOf(s: Toad, R: Rest, i: number, at: V3, lift: number): V3 {
  const L = legOfI(s, i), h = footHeading(i, L), F = L.foot, c = Math.cos(lift * DEG), sn = Math.sin(lift * DEG);
  return [at[0] - h[0] * F * c, at[1] - h[1] * F * c, at[2] + R.heel[i] + F * sn];
}
function footHeading(i: number, L: Leg): V3 {
  const a = SIDE[i] * -L.turn * DEG;
  return [-Math.sin(a), Math.cos(a), 0];
}


/** Let the body down onto its hind legs where a foot could not reach the ground; a hand is where its barrel puts it, and a Brewtoad's feet are in its tub. */
function seated(s: Toad, R: Rest, p: Plan): Plan {
  if (s.cask.tub) return p;
  let drop = 0;
  const body = joint(ROOT, [p.side, p.surge, p.H], s.tilt + p.pitch, p.roll, p.yaw);
  const at = p.at.map((x) => [...x] as V3);
  for (let i = 2; i < 4; i++) {
    const hip = place(body, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), flat = d[0] * d[0] + d[1] * d[1], up = -d[2];
    if (flat + up * up <= L * L) continue;
    const need = up - Math.sqrt(Math.max(0, L * L - flat)), k = 1 - smooth(at[i][2] / (0.2 * R.reach[i]));
    drop = Math.max(drop, need * k);
  }
  const H = p.H - Math.max(0, drop);
  const body2 = joint(ROOT, [p.side, p.surge, H], s.tilt + p.pitch, p.roll, p.yaw);
  for (let i = 2; i < 4; i++) {
    const hip = place(body2, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), D = len3(d);
    if (D > L) at[i] = add(at[i], scale(d, L / D - 1));
  }
  return { ...p, at, H };
}

function posedOf(s: Toad, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([lungeBite, bellySlam, quakeStomp][s.stage](s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/**
 * A leg bent to put its heel (or wrist) at `ankle`: the hind leg's knee forward, out and up beside the body, the fore leg's elbow
 * back and out, always the same way round.
 */
function legOf(s: Toad, R: Rest, body: Xf, i: number, ankle: V3, heading: V3, lift: number): [Xf, Xf, Xf] {
  const fore = i < 2, [l0, l1] = R.legs[i];
  const hip = place(body, R.hip[i]), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = len3(d);
  const Dc = clamp(D, Math.abs(l0 - l1) + 0.05 * (l0 + l1), (l0 + l1) * 0.985);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit(fore ? [SIDE[i] * 0.75, -0.7, 0.15] : [SIDE[i] * 0.6, 0.8, 0.45]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], heading);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], -lift)];
}

const skullAt = (s: Toad): V3 => [0, s.head.fwd, s.head.up];
const hingeAt = (s: Toad): V3 => { const H = s.head; return [0, H.fwd - H.r[1] * 0.55, H.up - H.r[2] * H.mouth]; };
const throatAt = (s: Toad): V3 => { const H = s.head, hg = hingeAt(s); return [0, H.fwd + H.r[1] * 0.15 - hg[1], -H.r[2] * 0.6]; };

/* ---- its barrel, where it is ------------------------------------------------------------------- */

/** How much wider than its ends a barrel is round its middle. */
const CASK_BULGE = 0.16;
/** A barrel's radius this far up it. */
const caskR = (C: Cask, z: number): number => C.r * (1 + CASK_BULGE * Math.sin(Math.PI * clamp(z / C.h)));
/** Turned about the across axis, `a` degrees. */
const rotX = (v: V3, a: number): V3 => { const c = Math.cos(a * DEG), sn = Math.sin(a * DEG); return [v[0], v[1] * c - v[2] * sn, v[1] * sn + v[2] * c]; };
/**
 * A point of its barrel, given in the barrel's own frame -- its foot on the ground under the body, `+y` the way the toad faces,
 * `+z` up -- in the body's frame: the barrel stands upright on the ground while the toad sits at rest, its front tipped up.
 */
const caskPoint = (s: Toad, p: V3): V3 => rotX(add(p, [0, s.cask.y, -s.high]), -s.tilt);
/** A way in the barrel's frame, in the body's. */
const caskWay = (s: Toad, d: V3): V3 => rotX(d, -s.tilt);
/** The barrel's own frame, as a bone in the body's: for what is made in it. */
const caskXf = (s: Toad): Xf => {
  const X = caskWay(s, [1, 0, 0]), Y = caskWay(s, [0, 1, 0]), Z = caskWay(s, [0, 0, 1]);
  return xfOf(X, Y, Z, caskPoint(s, [0, 0, 0]));
};
/** Where a hand rests on the barrel, in the barrel's frame: round from its front to the side `sd`, up it, and out from its staves. */
function handOn(s: Toad, sd: number): { at: V3; out: V3 } {
  const C = s.cask, a = s.hand[0] * DEG, z = s.hand[1] * C.h, r = caskR(C, Math.min(z, C.h)) + s.hand[2];
  const out: V3 = [sd * Math.sin(a), Math.cos(a), 0];
  return { at: [out[0] * r, out[1] * r, z], out };
}
/** Solids in the barrel's frame that stand for it, stacked up it: what hides whatever is behind the barrel. */
function caskSolids(s: Toad): Array<{ c: V3; r: V3 }> {
  const C = s.cask;
  return [0.2, 0.5, 0.8].map((f) => ({ c: [0, 0, C.h * f] as V3, r: [caskR(C, C.h * f) * 0.98, caskR(C, C.h * f) * 0.98, C.h * 0.24] as V3 }));
}
/** How far down over the barrel a hand's fingers are tipped (degrees). */
const HAND_DROOP = 34;

function toadBones(s: Toad): (a: Anim) => Bones {
  const R = restOf(s), CX = caskXf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], s.tilt + P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = P.squash >= 0 ? trunkOf(body, P.squash) : scaled(body, [1 + 0.35 * P.squash, 1 - 1.4 * P.squash, 1 + 0.35 * P.squash]);
    // The barrel goes with the body, as it is its belly (or its tub), but does not squash with it.
    b.cask = { m: mul(body.m, CX.m), t: place(body, CX.t) };
    b.head = joint(body, s.head.at, s.head.pitch + P.head[0], P.head[2], P.head[1]);
    b.jaw = joint(b.head, hingeAt(s), -(s.gape + P.jaw));
    // Its throat blown up for a croak, less than a bare toad's: it is over its barrel.
    const th = 0.72 + 0.5 * P.throat;
    b.throat = scaled(joint(b.jaw, throatAt(s), 0), [th, th * 0.9, th]);
    for (let i = 0; i < 4; i++) {
      const L = legOfI(s, i);
      if (i < 2) {
        // A hand where it rests on the barrel, moved as the pose says.
        const h = handOn(s, SIDE[i]), wrist = add(place(b.cask, h.at), turn(body, P.hand[i]));
        const o = turn(b.cask, h.out), heading = unit([o[0], o[1], 0]);
        const [u, l, f] = legOf(s, R, body, i, wrist, heading, HAND_DROOP);
        b[`${LEGS4[i]}0`] = u;
        b[`${LEGS4[i]}1`] = l;
        b[`${LEGS4[i]}2`] = f;
        continue;
      }
      const g = P.at[i];
      const heading = footHeading(i, L);
      const heel = heelOf(s, R, i, [g[0], g[1], Math.max(0, g[2])], P.foot[i]);
      const [u, l, f] = legOf(s, R, body, i, heel, heading, P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    return b;
  };
  return (a) => pose(seated(s, R, posedOf(s, R, { ...a, go: a.act ? 0 : a.go })));
}

/** One frame's turning after another's: `a` then `b`, as row-major matrices. */
function mul(a: number[], b: number[]): number[] {
  const o: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]);
  return o;
}

/* ---- what it is made of ------------------------------------------------------------------------- */

const marksOf = (s: Toad): Rings => s.marks ?? s.body;
/** How much a stage's small things are scaled, against the Craghopper's. */
const bigOf = (s: Toad): number => lenOf(s) / 0.94;

/** A painted blob lying on the body, every corner laid back onto the body's own curve. */
function blotOn(s: Toad, y: number, th: number, rx: number, ry: number, m: Mat, spin: number, id: number, sides = 9): Disc {
  const q = onRings(s.body, y, th), d = disc(add(q.p, scale(q.n, 0.01)), q.n, rx, ry, sides, m, { spin, up: [0, 0, 1] });
  return {
    ...d, v: d.v.map((v, k) => {
      const c = add(q.p, scale(sub(v, q.p), 0.82 + 0.3 * jitter(id * 13 + k)));
      const r = ringAt(s.body, c[1]), a = Math.atan2((c[2] - r.z) / r.h, c[0] / r.w);
      const e = onRings(s.body, c[1], a);
      return add(e.p, scale(e.n, 0.012 * bigOf(s)));
    }),
  };
}

/** Whether a point on the body is in its cream belly: under it, and up the front of its chest. */
function inBelly(s: Toad, c: V3): boolean {
  const M = marksOf(s), r = ringAt(s.body, c[1]), up = (c[2] - r.z) / r.h, front = (c[1] - M.y[2]) / (M.y[6] - M.y[2]);
  const across = Math.abs(c[0]) / r.w;
  return up < -0.05 - 0.15 * across || (front > 0 && across < 0.9 && up < Math.min(0.3 + 1.1 * front, 0.5) - 0.6 * across * across);
}

/** The body: olive green, cream underneath and up the front of its chest, spotted a greyer olive over its flanks, a few pale warts. */
function skinOf(s: Toad, n: number): Mesh {
  const B = s.body;
  const m0 = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, 'coat');
  const body = mesh(m0.v, m0.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m0.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return inBelly(s, c) ? { ...f, m: 'belly' as Mat } : f;
  }));
  const M = marksOf(s), spots: Disc[] = [];
  for (let q = 0; q < 12; q++) {
    const id = 300 + q * 7, sd = q % 2 ? 1 : -1;
    const y = lerp(M.y[1], M.y[5], jitter(id)), up = lerp(-0.25, 0.7, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.17 + 0.1 * jitter(id + 2)) * r.w;
    if (inBelly(s, onRings(s.body, y, th).p)) continue;
    spots.push(blotOn(s, y, th, k * 1.3, k * 0.85, 'mark', jitter(id + 4) * 3, id));
  }
  // Pale warts, a few, on its flanks.
  for (let q = 0; q < 8; q++) {
    const id = 700 + q * 5, sd = q % 2 ? 1 : -1;
    const y = lerp(M.y[1], M.y[5], jitter(id)), up = lerp(-0.1, 0.6, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.05 + 0.03 * jitter(id + 2)) * r.w;
    if (inBelly(s, onRings(s.body, y, th).p)) continue;
    spots.push(blotOn(s, y, th, k, k, 'coatLight', 0, id, 6));
  }
  const cream = paint(body.f.filter((f) => f.m === 'belly').map((f) => ({ v: f.i.map((i) => body.v[i]), m: 'belly' as Mat })));
  return merge(body, cream, paint(spots));
}

/** A tuft of leafy moss: a few pointed leaves splayed from one root, out the way `out` goes, a little toward `lean`. */
function tuft(root: V3, out: V3, lean: V3, len: number, id: number, K: number, count = 3): Mesh {
  const o = unit(out), d0 = unit(add(o, scale(lean, 0.9))), parts: Mesh[] = [];
  const tones: Array<readonly [Mat, Mat, Mat]> = [['moss', 'leaf', 'leaf'], ['leaf', 'moss', 'leafDark'], ['moss', 'moss', 'leaf']];
  for (let q = 0; q < count; q++) {
    const side = count === 1 ? 0 : (q / (count - 1)) * 2 - 1, lid = id * 7 + q;
    const d = unit(about(d0, o, side * 0.85 + (jitter(lid) - 0.5) * 0.3));
    const face = unit(add(o, scale(cross(d, o), (jitter(lid + 2) - 0.5) * 0.6)));
    const l = len * (1 - 0.18 * Math.abs(side)) * (0.85 + 0.3 * jitter(lid + 1));
    const tip = add(root, scale(d, l)), mid = add(add(root, scale(d, l * 0.5)), scale(face, l * 0.16));
    const widths = Array.from({ length: K }, (_, k) => Math.max(0.01, l * 0.5 * Math.sin(Math.PI * Math.min(0.999, (k / (K - 1)) ** 0.7)) ** 0.8));
    parts.push(sheet(curve(root, mid, tip, K - 1), widths, face, 0.25, tones[Math.floor(jitter(lid + 5) * 3)]));
  }
  return merge(...parts);
}

/** Where a spot on its back is, on the body (right side; `sd` -1 for its mirror on the left). */
function spotOn(s: Toad, f: number, th: number, sd: number): { p: V3; n: V3 } {
  const M = marksOf(s), y = lerp(M.y[0], M.y[6], 0.5 + 0.46 * f), q = onRings(s.body, y, sd > 0 ? th : Math.PI - th);
  return q;
}
/** Each spot of a list on both sides, the left a little different from the right; one on the ridge only once. */
function bothSides<T extends readonly number[]>(list: readonly T[], each: (x: T, sd: number, id: number) => void): void {
  list.forEach((x, q) => {
    each(x, 1, q * 2);
    if (Math.abs(x[1] - Math.PI / 2) > 0.05) each([x[0] + 0.08 * (jitter(q * 5 + 1) - 0.5), ...x.slice(1)] as unknown as T, -1, q * 2 + 1);
  });
}


/* ---- what it wears ------------------------------------------------------------------------------ */

/**
 * A hop cone: overlapping golden bracts in rings about its stalk, the rings smaller toward its tip, hung from `at` the way `dir`
 * goes, `r` across at its widest.
 */
function coneOf(at: V3, dir: V3, r: number, seed: number): Mesh {
  const d = unit(dir), [X, Y] = frameOf(d, Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]), parts: Mesh[] = [];
  const rows = 4, spin = jitter(seed) * TAU;
  for (let q = 0; q < rows; q++) {
    const f = q / (rows - 1), rr = r * (1 - 0.55 * f) * (q === 0 ? 0.85 : 1), z = r * (0.25 + 1.55 * f), n = q === rows - 1 ? 3 : 4;
    for (let j = 0; j < n; j++) {
      const a = spin + ((j + 0.5 * (q % 2)) / n) * TAU;
      const c = add(add(at, scale(d, z)), add(scale(X, Math.cos(a) * rr * 0.55), scale(Y, Math.sin(a) * rr * 0.55)));
      parts.push(orbAlong(c, unit(add(d, add(scale(X, Math.cos(a) * 0.5), scale(Y, Math.sin(a) * 0.5)))), [rr * 0.62, rr * 0.5, rr * 0.42], 5, 3, (q + j) % 2 ? 'horn' : 'hornDark'));
    }
  }
  parts.push(orbAlong(add(at, scale(d, r * 2.05)), d, [r * 0.26, r * 0.26, r * 0.32], 5, 3, 'horn'));
  parts.push(tube([add(at, scale(d, -r * 0.35)), add(at, scale(d, r * 0.3))], [r * 0.12, r * 0.1], [r * 0.12, r * 0.1], 4, 'stem'));
  return merge(...parts);
}

/** A white flower of five round petals and a yellow eye, facing out along `n`, `r` across. */
function flowerOf(at: V3, n: V3, r: number, seed: number): Mesh {
  const N = unit(n), [X, Y] = frameOf(N, Math.abs(N[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]), parts: Mesh[] = [], spin = jitter(seed) * TAU;
  for (let j = 0; j < 5; j++) {
    const a = spin + (j / 5) * TAU, out = add(scale(X, Math.cos(a)), scale(Y, Math.sin(a)));
    parts.push(orbAlong(add(at, scale(out, r * 0.52)), unit(add(out, scale(N, 0.35))), [r * 0.46, r * 0.36, r * 0.13], 6, 3, 'petal'));
  }
  parts.push(orbAlong(add(at, scale(N, r * 0.12)), N, [r * 0.26, r * 0.26, r * 0.14], 6, 3, 'ember'));
  return merge(...parts);
}

/** Its wreath: tufts of hop leaves round the top of its head, a flower or two and a hop cone among them, in the head's frame. */
function wreathOf(s: Toad, K: number): Mesh {
  const H = s.head, C = skullAt(s), out: Mesh[] = [], D = s.dress;
  D.wreath.forEach(([x, y, z, len], q) => {
    const e = onEgg(C, H.r, [x, y, z]);
    out.push(tuft(add(e.p, scale(e.n, -0.01)), e.n, [x * 0.4, -0.5, 0.25], len, 200 + q, K, 3));
  });
  D.flowers.forEach(([x, y, z, r], q) => {
    const e = onEgg(C, H.r, [x, y, z]);
    out.push(flowerOf(add(e.p, scale(e.n, r * 0.35)), unit(add(e.n, [0, 0.3, 0.2])), r, 240 + q));
  });
  D.cones.forEach(([x, y, z, r], q) => {
    const e = onEgg(C, H.r, [x, y, z]);
    out.push(coneOf(add(e.p, scale(e.n, r * 0.6)), unit(add(scale(e.n, 0.4), [x * 0.3, 0.2, -0.9])), r, 260 + q));
  });
  return merge(...out);
}

/** Its mane: hop vine leaves down its back and over its flanks, cones and flowers through them, in the trunk's frame. */
function maneOf(s: Toad, K: number): { leaves: Mesh; bits: Mesh } {
  const D = s.dress, leaves: Mesh[] = [], bits: Mesh[] = [];
  bothSides(D.mane, ([f, th, len], sd, id) => {
    const q = spotOn(s, f, th, sd);
    // Up on the back they lie back along it; down the flanks they hang over and down.
    const lean: V3 = th > 1.2 ? [0, -0.7, 0.1] : [sd * 0.25, -0.35, -0.85];
    leaves.push(tuft(add(q.p, scale(q.n, -0.01)), q.n, lean, len, 30 + id, K, th > 1.2 ? 4 : 3));
  });
  bothSides(D.maneCones, ([f, th, r], sd, id) => {
    const q = spotOn(s, f, th, sd);
    bits.push(coneOf(add(q.p, scale(q.n, r * 0.9)), unit(add(scale(q.n, 0.3), [sd * 0.2, -0.3, -0.9])), r, 300 + id));
  });
  bothSides(D.maneFlowers, ([f, th, r], sd, id) => {
    const q = spotOn(s, f, th, sd);
    bits.push(flowerOf(add(q.p, scale(q.n, r * 0.9)), q.n, r, 340 + id));
  });
  return { leaves: merge(...leaves), bits: merge(...bits) };
}

/**
 * Its barrel, in its own frame (foot on the ground, `+y` forward, `+z` up): staves round it each a shade of its own, a dark foot,
 * bands standing proud round it with rivets along them; a tub's open top a rim of dark end grain round a dark inside, a belly's top
 * closed and hidden up under its chest.
 */
function caskMesh(s: Toad, lod: number): Mesh {
  const C = s.cask, N = cut(lod, 16, 22), K = 8;
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const z = (C.h * k) / K, r = caskR(C, z);
    for (let j = 0; j < N; j++) {
      const a = ((j + 0.5) / N) * TAU;
      v.push([r * Math.sin(a), r * Math.cos(a), z]);
    }
  }
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N, a = ((j + 1) / N) * TAU;
      f.push({ i: [k * N + j, k * N + j2, (k + 1) * N + j2, (k + 1) * N + j], m: j % 3 === 1 ? 'woodDark' : j % 3 === 2 ? 'bark' : 'wood' });
      want.push([Math.sin(a), Math.cos(a), 0]);
    }
  }
  f.push({ i: Array.from({ length: N }, (_, j) => j), m: 'woodDark' });
  want.push([0, 0, -1]);
  if (C.tub) {
    // The rim, and the dark inside a little down it.
    const rt = caskR(C, C.h), rIn = rt * 0.86, at = v.length;
    for (let j = 0; j < N; j++) {
      const a = ((j + 0.5) / N) * TAU;
      v.push([rt * Math.sin(a), rt * Math.cos(a), C.h], [rIn * Math.sin(a), rIn * Math.cos(a), C.h]);
    }
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N;
      f.push({ i: [at + 2 * j, at + 2 * j2, at + 2 * j2 + 1, at + 2 * j + 1], m: 'woodDark' });
      want.push([0, 0, 1]);
    }
  } else {
    // A belly's top is under its chest: cream, the chest coming down over it to the strap.
    f.push({ i: Array.from({ length: N }, (_, j) => K * N + j), m: 'belly' });
    want.push([0, 0, 1]);
  }
  const parts: Mesh[] = [mesh(v, woundTo(v, f, want))];
  // The bands: a strip standing proud of the staves, with rivets along it.
  for (const bz of C.bands) {
    const z0 = bz * C.h - 0.045 * C.h, z1 = bz * C.h + 0.045 * C.h, M = N * 2;
    const bv: V3[] = [], bf: Face[] = [], bw: V3[] = [];
    for (const z of [z0, z1]) for (let j = 0; j < M; j++) {
      const a = (j / M) * TAU, r = caskR(C, z) + 0.035 * C.r;
      bv.push([r * Math.sin(a), r * Math.cos(a), z]);
    }
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M, a = ((j + 0.5) / M) * TAU;
      bf.push({ i: [j, j2, M + j2, M + j], m: 'metal' });
      bw.push([Math.sin(a), Math.cos(a), 0]);
    }
    parts.push(mesh(bv, woundTo(bv, bf, bw)));
    for (let q = 0; q < C.rivets; q++) {
      const a = ((q + 0.5) / C.rivets) * TAU, r = caskR(C, bz * C.h) + 0.05 * C.r;
      parts.push(orb([r * Math.sin(a), r * Math.cos(a), bz * C.h], 0.035 * C.r, 4, 3, 'rivet'));
    }
  }
  return merge(...parts);
}

/**
 * Where its tap is: on its left side, turned this far toward its front (degrees), and up the barrel as a share of its height.
 * Asked for: "offset the spigot to one side" -- on the side, a little toward the back, so from in front it stands out from the
 * barrel's edge; high, under the strap, where a Brothgut's or a Barrelburp's thigh against the staves below it does not reach.
 */
const TAP_TURN = -12, TAP_UP = 0.85;
/** The tap's way out of the barrel, and where it stands on it, in the barrel's frame. */
function tapOf(s: Toad): { at: V3; out: V3 } {
  const C = s.cask, a = TAP_TURN * DEG, out: V3 = [-Math.cos(a), Math.sin(a), 0], z = TAP_UP * C.h, r = caskR(C, z);
  return { at: [out[0] * r, out[1] * r, z], out };
}

/**
 * Its tap, in the barrel's frame: a brass boss on the staves at its left side, a short pipe out from it, bent down into a spout,
 * and a key on the pipe's top. From in front it stands at the barrel's edge, high up.
 */
function tapMesh(s: Toad): Mesh {
  const C = s.cask, T = tapOf(s), k = C.r * (C.tub ? 0.24 : 0.2), o = T.out, up: V3 = [0, 0, 1];
  const elbow = add(T.at, scale(o, k * 1.6)), mouth = add(elbow, [0, 0, -k * 0.95]);
  return merge(
    orbAlong(add(T.at, scale(o, k * 0.08)), o, [k * 0.5, k * 0.5, k * 0.28], 8, 3, 'fitting'),
    tube([add(T.at, scale(o, k * 0.1)), elbow], [k * 0.26, k * 0.24], [k * 0.26, k * 0.24], 7, 'fitting'),
    orb(elbow, k * 0.3, 6, 4, 'fitting'),
    tube([elbow, mouth], [k * 0.25, k * 0.3], [k * 0.25, k * 0.3], 7, 'fitting', { end: false }),
    orbAlong(mouth, [0, 0, -1], [k * 0.3, k * 0.3, k * 0.06], 7, 2, 'flame'),
    // Its key: a stem up off the pipe and a bar across it.
    tube([add(add(T.at, scale(o, k * 0.95)), scale(up, k * 0.2)), add(add(T.at, scale(o, k * 0.95)), scale(up, k * 0.62))], [k * 0.1, k * 0.1], [k * 0.1, k * 0.1], 5, 'flame'),
    orbAlong(add(add(T.at, scale(o, k * 0.95)), scale(up, k * 0.7)), unit(cross(o, up)), [k * 0.42, k * 0.14, k * 0.14], 6, 3, 'fitting'),
  );
}

/** A flat pointed leaf of gold, both sides drawn, from `base` along `dir`, its face toward `up`. */
function goldLeaf(base: V3, dir: V3, up: V3, len: number, wid: number): Mesh {
  const d = unit(dir), n = unit(sub(up, scale(d, dot(up, d)))), side = unit(cross(d, n));
  const T = [0.15, 0.38, 0.62, 0.84];
  const hw = (t: number): number => wid * Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.7;
  const tip = add(base, scale(d, len));
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (const sd of [1, -1]) {
    const at = v.length;
    v.push(base);
    T.forEach((t) => v.push(add(add(add(base, scale(d, len * t)), scale(side, sd * hw(t))), scale(n, 0.25 * hw(t)))));
    v.push(tip);
    const half = v.slice(at);
    v.push(...half);
    const idx = Array.from({ length: half.length }, (_, q) => at + q), under = idx.map((q) => q + half.length);
    const face = unit(add(n, scale(side, -sd * 0.3)));
    f.push({ i: idx, m: sd > 0 ? 'fitting' : 'flame' }, { i: under.reverse(), m: 'flame' });
    want.push(face, scale(face, -1));
  }
  return mesh(v, woundTo(v, f, want));
}

/** The Barrelburp's crest on the front of its barrel, between its bands: a golden hop cone, leaves fanned up and out from it, and a curl of vine to each side. */
function crestMesh(s: Toad): Mesh {
  const C = s.cask, z = C.h * 0.54, r = caskR(C, z), at: V3 = [0, r + 0.02, z], n: V3 = [0, 1, 0], k = C.r, parts: Mesh[] = [];
  parts.push(orbAlong(at, n, [k * 0.13, k * 0.13, k * 0.06], 8, 3, 'fitting'));
  // A hop cone in gold, hung point down from the boss.
  for (let q = 0; q < 4; q++) {
    const zz = z - k * (0.06 + 0.07 * q), w = k * (0.1 - 0.018 * q);
    parts.push(orbAlong([0, caskR(C, zz) + 0.035, zz], n, [w, w * 0.9, w * 0.45], 7, 3, q % 2 ? 'flame' : 'fitting'));
  }
  for (const [ang, l] of [[-70, 0.34], [-35, 0.4], [35, 0.4], [70, 0.34]] as Array<[number, number]>) {
    const a = ang * DEG, dir: V3 = [Math.sin(a), 0.05, Math.cos(a)];
    parts.push(goldLeaf(add(at, [0, 0.015, 0]), dir, n, k * l, k * l * 0.4));
  }
  // The curls of vine, each a strip of gold bending out and down to the side.
  for (const sd of [1, -1]) {
    const pts = Array.from({ length: 8 }, (_, q) => {
      const u = q / 7, a = sd * (0.25 + 0.9 * u), zz = z + k * (0.05 - 0.22 * u * u);
      const rr = caskR(C, zz) + 0.03;
      return [rr * Math.sin(a * 0.55), rr * Math.cos(a * 0.55), zz] as V3;
    });
    parts.push(tube(pts, pts.map((_, q) => k * 0.035 * (1 - 0.4 * q / 7)), pts.map((_, q) => k * 0.035 * (1 - 0.4 * q / 7)), 4, 'flame'));
  }
  return merge(...parts);
}

/** How far up its barrel the Brothgut's strap goes round it, as a share of its height. */
const STRAP_UP = 0.95;
/**
 * Which way a belly barrel and what is on it face, in the barrel's frame, for drawing them over the body or under it: forward
 * and well down, so that from in front and from the side they go over it, and from behind or from high above, where the
 * chest and back are over the barrel, under it.
 */
const BELLY_FRONT: V3 = [0, 0.74, -0.67];
/** The Brothgut's strap: a leather belt round the top of its barrel belly, under its chest, a brass buckle on its front, in the barrel's frame. */
function strapMesh(s: Toad, n: number): Mesh {
  const C = s.cask, z = STRAP_UP * C.h, w = C.h * 0.05, N = n * 3, parts: Mesh[] = [];
  const ring = (dz: number): V3[] => Array.from({ length: N }, (_, j) => {
    const a = (j / N) * TAU, r = caskR(C, z + dz) + 0.05 * C.r;
    return [r * Math.sin(a), r * Math.cos(a), z + dz];
  });
  const v = [...ring(-w), ...ring(w)], f: Face[] = [], want: V3[] = [];
  for (let j = 0; j < N; j++) {
    const j2 = (j + 1) % N, a = ((j + 0.5) / N) * TAU;
    f.push({ i: [j, j2, N + j2, N + j], m: 'leather' });
    want.push([Math.sin(a), Math.cos(a), 0]);
  }
  parts.push(mesh(v, woundTo(v, f, want)));
  // The buckle: a brass frame on its front, the belt through it.
  const r = caskR(C, z) + 0.09 * C.r, bw = w * 1.6, bh = w * 1.4, t = w * 0.28;
  const at = (x: number, dz: number): V3 => [x, r, z + dz];
  parts.push(tube([at(-bw, -bh), at(bw, -bh)], [t, t], [t, t], 4, 'fitting'), tube([at(-bw, bh), at(bw, bh)], [t, t], [t, t], 4, 'fitting'));
  for (const sd of [-1, 1]) parts.push(tube([at(sd * bw, -bh), at(sd * bw, bh)], [t, t], [t, t], 4, 'fitting'));
  parts.push(tube([at(0, -bh * 0.9), at(0, bh * 0.9)], [t * 0.7, t * 0.7], [t * 0.7, t * 0.7], 4, 'flame'));
  return merge(...parts);
}

/** The Barrelburp's chain: gold links round the root of its neck, and a hop cone of gold hung from it on a shield, in the trunk's frame. */
function chainMesh(s: Toad, n: number): Mesh {
  const M = marksOf(s), y = lerp(M.y[4], M.y[6], 0.5), r = ringAt(s.body, y), parts: Mesh[] = [], N = 34;
  for (let j = 0; j < N; j++) {
    const a = (j / N) * TAU, k = 1.04;
    const c: V3 = [Math.cos(a) * r.w * k, y - 0.02, r.z + Math.sin(a) * r.h * k];
    parts.push(orbAlong(c, [-Math.sin(a), 0, Math.cos(a)], [r.w * 0.1, r.w * 0.05, r.w * 0.05], 5, 3, j % 2 ? 'flame' : 'fitting'));
  }
  // Its pendant, on its chest under the chain's front.
  // The chest is the underside of its body, sat up as it is; the pendant hangs from the chain's lowest link down it.
  const top: V3 = [0, y - 0.02, r.z - r.h * 1.08], pw = r.w * 0.22;
  parts.push(orbAlong(add(top, [0, -pw * 0.9, -0.03]), [0, 0.2, -1], [pw, pw * 1.2, pw * 0.3], n, 3, 'fitting'));
  parts.push(coneOf(add(top, [0, -pw * 0.45, -0.06]), [0, -1, -0.25], pw * 0.55, 77));
  return merge(...parts);
}

/* ---- the head ------------------------------------------------------------------------------- */

/** The height of the mouth line round the head at `phi` round from straight ahead (radians), in the head's frame: a wide smile. */
function mouthZ(s: Toad, phi: number): number {
  const H = s.head, k = clamp(Math.abs(phi) / 1.75);
  return H.up - H.r[2] * H.mouth + H.r[2] * (H.smile * k * k - 0.05 * (1 - k));
}

function eggBand(c: V3, r: V3, n: number, rows: number, top: (phi: number) => number, bottom: number, mat: (row: number, phi: number) => Mat, open: boolean): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= rows; k++) {
    for (let j = 0; j < n; j++) {
      const phi = (j / n) * TAU - Math.PI;
      const z0 = clamp((top(phi) - c[2]) / r[2], -0.999, 0.999), th0 = Math.acos(z0), th = lerp(th0, Math.acos(bottom), k / rows);
      v.push([c[0] + r[0] * Math.sin(th) * Math.sin(phi), c[1] + r[1] * Math.sin(th) * Math.cos(phi), c[2] + r[2] * Math.cos(th)]);
    }
  }
  for (let k = 0; k < rows; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, a = k * n + j, b = k * n + j2, cc = (k + 1) * n + j2, d = (k + 1) * n + j;
      const mid = scale(add(add(v[a], v[b]), add(v[cc], v[d])), 0.25);
      f.push({ i: [a, b, cc, d], m: mat(k, ((j + 0.5) / n) * TAU - Math.PI) });
      want.push(sub(mid, c));
    }
  }
  if (!open) {
    f.push({ i: Array.from({ length: n }, (_, j) => j), m: mat(0, 0) });
    want.push([0, 0, 1]);
  }
  return mesh(v, woundTo(v, f, want));
}

/**
 * The head: a broad flat dome of green, mottled darker behind its eyes, two little nostrils, rosy cheeks under its eyes, and the
 * line of its wide smile; under the mouth line the inside of its mouth, which shows only when the jaw drops. Its eyes sit on low
 * domes at the front corners of the top of its head.
 */
function headOf(s: Toad, n: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const top = eggBand(C, H.r, n + 4, 6, () => C[2] + H.r[2] * 0.999, -0.999, () => 'coat', true);
  const skull = mesh(top.v, top.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, top.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const phi = Math.atan2(c[0] - C[0], c[1] - C[1]);
    return c[2] < mouthZ(s, phi) - H.r[2] * 0.12 ? { ...f, m: 'inner' as Mat } : f;
  }));
  const out: Mesh[] = [skull], blots: Disc[] = [];
  for (const [x, y, z, k] of [[0, -0.45, 0.9, 0.3], [0.75, -0.45, 0.45, 0.16], [-0.75, -0.45, 0.45, 0.16], [0.3, 0.2, 0.92, 0.1], [-0.25, -0.05, 0.97, 0.09]] as Array<[number, number, number, number]>) {
    const e = onEgg(C, H.r, [x, y, z]);
    blots.push(disc(add(e.p, scale(e.n, 0.008)), e.n, H.r[0] * k * 1.2, H.r[0] * k * 0.8, 8, 'mark', { spin: x * 2 }));
  }
  for (const sd of [1, -1]) {
    const e = onEgg(C, H.r, [sd * 0.16, 0.9, 0.42]);
    blots.push(disc(add(e.p, scale(e.n, 0.008)), e.n, H.r[0] * 0.045, H.r[0] * 0.032, 6, 'nose', { spin: sd * 0.5 }));
    // Rosy cheeks, under and a little behind each eye, over the corner of its mouth.
    const ch = onEgg(C, H.r, [sd * 0.78, 0.55, 0.05]);
    blots.push(disc(add(ch.p, scale(ch.n, 0.01)), ch.n, H.r[0] * 0.17, H.r[0] * 0.11, 9, 'shell', { up: [0, 0, 1] }));
  }
  const lip = Array.from({ length: 15 }, (_, q) => {
    const phi = lerp(-1.8, 1.8, q / 14), z = mouthZ(s, phi) + H.r[2] * 0.02;
    const zz = clamp((z - C[2]) / H.r[2], -0.99, 0.99), sn = Math.sqrt(1 - zz * zz);
    return onEgg(C, H.r, [Math.sin(phi) * sn, Math.cos(phi) * sn, zz]);
  });
  blots.push(lineOn(lip, lip.map((_, q) => H.r[0] * 0.024 * (0.4 + 0.6 * Math.sin(Math.PI * (0.05 + 0.9 * q / 14)))), 'nose', 0.012));
  out.push(paint(blots));
  for (const sd of [1, -1]) {
    const dc = domeAt(s, sd), r = s.eye.dome;
    out.push(orb(dc, [r, r * 0.95, r * 0.85], n, 5, 'coat'));
    out.push(eyeOf(s, sd, shut));
  }
  return merge(...out);
}

const domeAt = (s: Toad, sd: number): V3 => { const H = s.head, E = s.eye, C = skullAt(s); return [sd * H.r[0] * E.at[0], C[1] + H.r[1] * E.at[1], C[2] + H.r[2] * E.at[2]]; };
/** The way an eye looks, out of its dome: out to its side, forward, and up a little. */
const eyeDir = (sd: number): V3 => unit([sd * 0.55, 0.75, 0.38]);

/**
 * An eye: a big round iris, golden, deeper toward its foot, a dark pupil and two glints; its lid of green down over the top of it
 * as far as the stage says -- a little on the young ones, half way on the Bastiontoad, which looks out smugly -- with a dark line
 * along the lid's edge.
 */
function eyeOf(s: Toad, sd: number, shut: boolean): Mesh {
  const E = s.eye, dc = domeAt(s, sd), R: V3 = [E.dome, E.dome * 0.95, E.dome * 0.85];
  const q = onEgg(dc, R, eyeDir(sd)), n = q.n, p = add(q.p, scale(n, 0.004));
  const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
  const o = { at: add(q.p, scale(n, -E.dome * 0.08)), up: [0, 0, 1] as V3 };
  const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(dc, R, sub(v, dc)); return add(e.p, scale(e.n, lift)); }) });
  const r = E.size, out: Disc[] = [];
  if (shut) {
    out.push(onto(disc(p, n, r * 1.15, r * 1.15, 10, 'coat', o), 0.006));
    out.push(onto(disc(add(p, scale(up, -r * 0.2)), n, r * 1.05, r * 0.14, 8, 'lid', o), 0.012));
    return paint(out);
  }
  out.push(onto(disc(p, n, r * 1.14, r * 1.14, 12, 'lid', o), 0.006));
  out.push(onto(disc(p, n, r, r, 12, 'bloom', o), 0.01));
  out.push(onto(disc(add(p, scale(up, -r * 0.32)), n, r * 0.8, r * 0.5, 10, 'billDark', o), 0.012));
  out.push(onto(disc(p, n, r * 0.5, r * 0.5 * E.round, 10, 'eye', o), 0.016));
  out.push(onto(disc(add(add(p, scale(up, r * 0.36)), scale(across, sd * r * 0.3)), n, r * 0.26, r * 0.26, 6, 'glint', { ...o, lit: true }), 0.022));
  out.push(onto(disc(add(add(p, scale(up, -r * 0.4)), scale(across, -sd * r * 0.28)), n, r * 0.11, r * 0.11, 5, 'glint', { ...o, lit: true }), 0.022));
  // The lid: green over the top of it, down as far as the stage says, its lower edge a dark line, tipped down a little at the outer corner.
  const hh = r * 0.8, edge = r * (1 - 2 * E.lid), c = add(p, scale(up, edge + hh));
  const spin = -sd * 0.12 * E.lid;
  out.push(onto(disc(c, n, r * 1.32, hh, 10, 'coat', { ...o, spin }), 0.024));
  out.push(onto(disc(add(p, scale(up, edge + r * 0.02)), n, r * 1.08 * Math.sqrt(Math.max(0.15, 1 - (edge / r) ** 2)), r * 0.09, 8, 'lid', { ...o, spin }), 0.026));
  return paint(out);
}

function headSolids(s: Toad): Array<{ c: V3; r: V3 }> {
  const H = s.head, E = s.eye;
  return [{ c: skullAt(s), r: scale(H.r, 0.92) }, ...[1, -1].map((sd) => ({ c: domeAt(s, sd), r: [E.dome * 0.8, E.dome * 0.8, E.dome * 0.8] as V3 }))];
}


/** The lower jaw, in its own frame from its hinge: the head's egg a little fuller under the mouth line, cream; in it the dark of its mouth and its pink tongue, which show as it grins. */
function jawOf(s: Toad, n: number): Mesh {
  const H = s.head, C = skullAt(s), hg = hingeAt(s), k = 1.04;
  const r: V3 = [H.r[0] * k, H.r[1] * k, H.r[2] * k];
  // Its back, where the head meets the body, green: seen from behind with its head down, that is the nape and not the chin.
  const m = eggBand(C, r, n + 4, 4, (phi) => mouthZ(s, phi), -0.98, (row, phi) => (Math.abs(phi) > 1.2 ? 'coat' : row === 0 ? 'muzzle' : 'belly'), true);
  const z0 = mouthZ(s, 0);
  const floor = orb(sub([C[0], C[1] + H.r[1] * 0.12, z0 - H.r[2] * 0.2], hg), [H.r[0] * 0.8, H.r[1] * 0.78, H.r[2] * 0.16], n, 3, 'inner');
  const tongue = orb(sub([C[0], C[1] + H.r[1] * 0.38, z0 - H.r[2] * 0.1], hg), [H.r[0] * 0.42, H.r[1] * 0.42, H.r[2] * 0.14], n, 3, 'tongue');
  // Its back corners drawn in to within the skull's width, so that seen from behind or three-quarters they do not stand out
  // past the head as a thin blade: the jaw is as wide as the head at the mouth's corners and narrower toward the nape.
  const tuck = (p: V3): V3 => {
    const back = clamp((C[1] + 0.6 * r[1] - p[1]) / (1.6 * r[1])), k = 1 - 0.2 * back;
    return [C[0] + (p[0] - C[0]) * k, p[1], p[2]];
  };
  // Its inside, a pink lining a little within it facing in, for a look down into its open mouth from above or from the side.
  const lining = mesh(m.v.map((p) => sub(add(C, scale(sub(tuck(p), C), 0.95)), hg)), m.f.map((f) => ({ ...f, i: [...f.i].reverse(), m: 'inner' as Mat })));
  return merge(flat(mesh(m.v.map((p) => sub(tuck(p), hg)), m.f)), lining, floor, tongue);
}

/** A mesh with its own faces painted over it again, flat, so cream under a chin is cream from above. */
function flat(m: Mesh): Mesh {
  return merge(m, paint(m.f.map((f) => ({ v: f.i.map((i) => m.v[i]), m: f.m }))));
}

/** The pouch of its throat, in its own frame, blown up by the bone's scale. */
function throatOf(s: Toad, n: number): Mesh {
  const H = s.head;
  return flat(orb([0, 0, 0], [H.r[0] * 0.64, H.r[1] * 0.55, H.r[2] * 0.6], n, 5, 'muzzle'));
}


/* ---- legs and feet ------------------------------------------------------------------------------ */

/**
 * A foot in its own frame, from the heel (or wrist) at the origin along `+y`, the ground `heel` under it: the back of the foot,
 * then short thick toes splayed from the ball, each a round peach nub -- or, on the Bastiontoad, pale with a dark claw.
 */
function footOf(s: Toad, L: Leg, heel: number, hind: boolean, n: number): Mesh {
  const F = L.foot, w = L.w, z0 = -heel, parts: Mesh[] = [];
  const ball: V3 = [0, F, z0 + w * 0.3];
  parts.push(tube([[0, -w * 0.25, 0], [0, F * 0.5, z0 * 0.5 + w * 0.18], ball], [w * 0.85, w * 0.78, w * 0.7], [w * 0.6, w * 0.5, w * 0.4], Math.max(5, n - 2), 'coat', { seam: 'start' }));
  const T = L.toes, spread = hind ? 1.25 : 1.1;
  for (let k = 0; k < T; k++) {
    const u = k / (T - 1), a = lerp(-spread * 0.5, spread * 0.5, u);
    const len = L.toe * (0.82 + 0.25 * Math.sin(Math.PI * u));
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    const tw = w * (hind ? 0.3 : 0.34);
    const tip: V3 = [ball[0] + d[0] * len, ball[1] + d[1] * len, z0 + tw * 0.75];
    parts.push(tube([add(ball, [0, 0, -w * 0.05]), tip], [tw * 1.15, tw], [tw * 0.85, tw * 0.75], 5, 'pad', { start: false }));
    parts.push(orb(add(tip, [d[0] * tw * 0.3, d[1] * tw * 0.3, -tw * 0.1]), [tw * 1.05, tw * 1.1, tw * 0.75], 6, 3, 'pad'));
  }
  return merge(...parts);
}

/** The thigh (or upper arm), in its bone's frame: down `-z` from the hip, fat at the hip, mottled, and armoured as the stage is. */

function upperOf(s: Toad, L: Leg, l0: number, hind: boolean, _side: number, n: number, k: number): Mesh {
  // The smaller two's haunch is a toad's fat drumstick folded beside it; the Bastiontoad's a thick column, for its weight.
  const w = L.w, top = hind ? 2.0 : 1.05, low = hind ? 1.1 : 0.9, fat = hind ? [1.4, 1.25, 1.22][s.stage] : 1;
  const m = hind
    ? merge(orb([0, 0, -l0 * 0.48], [w * fat, w * fat * 0.95, l0 * 0.68], n + 1, k + 1, 'coat'), orb([0, 0, -l0], w * low, n, k, 'coat'))
    : merge(
      orb([0, 0, -l0 * 0.1], [w * top, w * top, w * top * 1.05], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -l0 * 0.55], [0, 0, -l0]], [w * top * 0.95, w * (top + low) * 0.5, w * low], [w * top * 0.95, w * (top + low) * 0.5, w * low], n, 'coat', { seam: 'start' }),
      orb([0, 0, -l0], w * low, n, k, 'coat'),
    );
  const blots: Disc[] = [];
  const count = hind ? 5 : 2;
  for (let q = 0; q < count; q++) {
    const z = -l0 * (0.2 + 0.6 * (q / Math.max(1, count - 1))), a = (q / count) * TAU + jitter(q * 3 + (hind ? 9 : 2)) * 1.2;
    const rr = hind ? w * fat * 0.98 * Math.sqrt(Math.max(0.2, 1 - ((z + l0 * 0.48) / (l0 * 0.68)) ** 2)) : lerp(w * top * 0.95, w * low, -z / l0), nrm: V3 = [Math.cos(a), Math.sin(a), 0];
    blots.push(disc(add([nrm[0] * rr, nrm[1] * rr, z], scale(nrm, 0.01)), nrm, rr * 0.55, rr * 0.95, 8, q % 2 ? 'spot' : 'mark', { up: [0, 0, 1] }));
  }
  const c: V3 = [0, 0, -l0 * 0.48], R: V3 = [w * fat, w * fat * 0.95, l0 * 0.68];
  const onto = (v: V3): V3 => {
    if (hind) { const e = onEgg(c, R, sub(v, c)); return add(e.p, scale(e.n, 0.008)); }
    const rz = clamp(-v[2] / l0), r = lerp(w * top * 0.95, w * low, rz) + 0.008, h = Math.hypot(v[0], v[1]) || 1;
    return [(v[0] / h) * r, (v[1] / h) * r, v[2]];
  };
  return merge(m, paint(blots.map((d) => ({ ...d, v: d.v.map(onto) }))));
}


/** The shin (or forearm), down `-z` from the knee to the heel: thick. */
function lowerOf(L: Leg, l1: number, hind: boolean, n: number): Mesh {
  const w = L.w, a = hind ? 1.0 : 0.95, b = hind ? 0.72 : 0.78;
  const m = tube([[0, 0, w * 0.5], [0, 0, -l1 * 0.55], [0, 0, -l1]], [w * a, w * (a + b) * 0.5, w * b], [w * a, w * (a + b) * 0.5, w * b], n, 'coat', { seam: 'start' });
  const blots: Disc[] = [];
  for (const [z, ang] of (hind ? [[0.35, 1.2], [0.7, -0.6]] : [[0.5, 0.5]]) as Array<[number, number]>) {
    const nrm: V3 = [Math.cos(ang), Math.sin(ang), 0], rr = lerp(w * a, w * b, z);
    blots.push(disc(add([nrm[0] * rr, nrm[1] * rr, -l1 * z], scale(nrm, 0.01)), nrm, rr * 0.55, rr * 1.0, 8, 'mark', { up: [0, 0, 1] }));
  }
  const onto = (v: V3): V3 => { const r = lerp(w * a, w * b, clamp(-v[2] / l1)) + 0.008, h = Math.hypot(v[0], v[1]) || 1; return [(v[0] / h) * r, (v[1] / h) * r, v[2]]; };
  return merge(m, paint(blots.map((d) => ({ ...d, v: d.v.map(onto) }))));
}

/** A leg's underside cream: every facet turned down more than `below` or in toward the body painted the belly's colour. */
function creamUnder(m: Mesh, xf: Xf, below: number): Mesh {
  const side = Math.sign(xf.t[0]) || 1;
  const faces = m.f.map((f) => {
    if (f.decal || f.m !== 'coat' || f.i.length < 3) return f;
    const a = m.v[f.i[0]], b = m.v[f.i[1]], c = m.v[f.i[2]], nl = unit(cross(sub(b, a), sub(c, a))), n = turn(xf, nl);
    return n[2] < -below || n[0] * side < -0.55 ? { ...f, m: 'belly' as Mat } : f;
  });
  const solid = faces.filter((f) => !f.decal), cream: Face[] = solid.filter((f) => f.m === 'belly').map((f) => ({ ...f, decal: true }));
  return mesh(m.v, [...solid, ...cream, ...faces.filter((f) => f.decal)]);
}

/** The way it faces (`+y`) in a bone's own frame, at rest. */
const forwardIn = (xf: Xf): V3 => [xf.m[3], xf.m[4], xf.m[5]];

const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- a stage's pieces --------------------------------------------------------------------------- */

const restBoneCache = new Map<Toad, Bones>();
function restBones(s: Toad): Bones {
  let b = restBoneCache.get(s);
  if (!b) restBoneCache.set(s, (b = toadBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 })));
  return b;
}

/** Each stage's mane, built once. */
const manes = new Map<string, ReturnType<typeof maneOf>>();
function maneFor(s: Toad, K: number): ReturnType<typeof maneOf> {
  const key = `${s.stage}|${K}`;
  let m = manes.get(key);
  if (!m) manes.set(key, (m = maneOf(s, K)));
  return m;
}

function toadBuild(s: Toad, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), K = lod ? 4 : 3, R = restOf(s), C = s.cask, tub = C.tub;
  const nl = n + (lod ? 2 * s.stage : s.stage), kl = k + (lod && s.stage ? 1 : 0);
  const rest = restBones(s);
  const pieces: Piece[] = [];
  const M = marksOf(s), bodyHide = { c: [0, 0, 0] as V3, r: [M.w[3] * 0.9, (M.y[6] - M.y[0]) * 0.45, M.h[3] * 0.9] as V3 };
  const caskHide = caskSolids(s);
  // A tub is drawn first and the toad in it after, all of it that is behind the tub's walls hidden; a belly barrel goes over the
  // body from in front and under it from behind -- and from above, where the chest and the back are over it (`BELLY_FRONT`).
  pieces.push({ key: 'cask', mesh: caskMesh(s, lod), bone: 'cask', bias: tub ? -0.02 : 0.025, ...(tub ? {} : { after: 'body', front: BELLY_FRONT }) });
  pieces.push({ key: 'tap', mesh: tapMesh(s), bone: 'cask', bias: 0.03, after: 'cask', front: tapOf(s).out, thin: true });
  if (C.crest) pieces.push({ key: 'crest', mesh: crestMesh(s), bone: 'cask', bias: 0.03, after: ['cask', 'body'], front: BELLY_FRONT, thin: true });
  pieces.push({
    key: 'body', mesh: skinOf(s, n + 3), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.035 },
    ...(tub ? { after: 'cask', hide: caskHide, hideIn: 'cask' } : {}),
  });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, false), shut: headOf(s, n, true), bone: 'head', bias: 0.2, hide, after: tub ? ['body', 'cask'] : 'body' });
  // The jaw and the throat hidden by the skull and the body round the far side of them, seen from behind with its head down.
  pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.19, after: ['head'], lines: false, hide: [{ c: skullAt(s), r: scale(s.head.r, 0.9) }], hideIn: 'head' });
  pieces.push({ key: 'throat', mesh: throatOf(s, n), bone: 'throat', bias: 0.18, after: ['body', 'cask'], under: ['jaw', 'head'], lines: false, hide: [bodyHide], hideIn: 'trunk' });
  pieces.push({ key: 'wreath', mesh: wreathOf(s, K), bone: 'head', bias: 0.22, after: ['head'], lines: false });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = legOfI(s, i), [l0, l1] = R.legs[i];
    // A Brewtoad's legs are down in its tub, all but its hands.
    if (tub && !fore) continue;
    const foot = side > 0 ? footOf(s, L, R.heel[i], !fore, n) : mirroredMesh(footOf(s, L, R.heel[i], !fore, n));
    // Its arms round the front of its barrel: over the body and the barrel from in front, under them both from behind.
    const over = (bone: string): Partial<Piece> => fore
      ? { after: ['cask', 'body'], front: forwardIn(rest[bone]), hide: caskHide, hideIn: 'cask' }
      : { after: 'cask', hide: caskHide, hideIn: 'cask' };
    pieces.push(
      // The bigger two's limbs rounder, with more sides, for their size; an arm green all round, its underside to the barrel.
      { key: `${key}0`, mesh: fore ? upperOf(s, L, l0, false, side, nl, kl) : creamUnder(upperOf(s, L, l0, true, side, nl, kl), rest[`${key}0`], 0.75), bone: `${key}0`, bias: fore ? 0.02 : 0.01, ...over(`${key}0`) },
      { key: `${key}1`, mesh: fore ? lowerOf(L, l1, false, nl) : creamUnder(lowerOf(L, l1, true, nl), rest[`${key}1`], 0.85), bone: `${key}1`, bias: 0.02, ...over(`${key}1`) },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.015, after: 'cask' },
    );
  }
  // Its mane over its back and down its flanks, as one soft mass of leaves, and the cones and flowers in it.
  const mane = maneFor(s, K);
  if (s.dress.mane.length) {
    pieces.push({ key: 'mane', mesh: mane.leaves, bone: 'trunk', bias: 0.031, after: ['body'], hide: [bodyHide], lines: false });
    pieces.push({ key: 'bits', mesh: mane.bits, bone: 'trunk', bias: 0.032, after: ['body', 'mane'], hide: [bodyHide] });
  }
  // The strap is above the solids' reach near the barrel's top: one more there for its far side.
  const strapHide = [...caskHide, { c: [0, 0, STRAP_UP * C.h] as V3, r: [caskR(C, STRAP_UP * C.h) * 1.02, caskR(C, STRAP_UP * C.h) * 1.02, C.h * 0.14] as V3 }];
  if (s.dress.strap) pieces.push({ key: 'strap', mesh: strapMesh(s, n), bone: 'cask', bias: 0.03, after: ['cask', 'body'], front: BELLY_FRONT, hide: strapHide });
  if (s.dress.chain) pieces.push({ key: 'chain', mesh: chainMesh(s, n), bone: 'trunk', bias: 0.03, after: ['body', 'cask'], hide: [bodyHide] });
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const INK: RGB = [40, 28, 26];
const DUST: RGB = [190, 176, 150];

const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };

/** A puff of dust off the ground. */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0, base: RGB = DUST): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
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

/** A ring on the ground at `c`, `r` across, `al` its strength: a shock spreading from a blow. */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, r: number, fill: RGB | null, rim: RGB, al: number, width: number, wobble = 0, seed = 0): void {
  if (al <= 0.01 || r <= 0) return;
  const pts = Array.from({ length: 22 }, (_, q) => {
    const a = (q / 22) * TAU, k = 1 + wobble * (jitter(seed + q) - 0.5);
    return onScreen(view, [c[0] + Math.cos(a) * r * k, c[1] + Math.sin(a) * r * k, c[2]]);
  });
  g.beginPath();
  pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) { g.fillStyle = css(fill, al); g.fill(); }
  g.strokeStyle = css(rim, al);
  g.lineWidth = width;
  g.stroke();
}


const FROTH: RGB = [252, 244, 222], BREW: RGB = [214, 150, 62], LEAF: RGB = [138, 172, 76], HOP_RGB: RGB = [226, 196, 96];

/** A bubble of froth, `r` across: cream with a white glint, inked. */
function bubble(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.6 * px);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = css(FROTH, al);
  g.fill();
  g.strokeStyle = css(INK, al * 0.8);
  g.lineWidth = Math.max(0.6 * px, r * 0.18);
  g.stroke();
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, TAU);
  g.fillStyle = css([255, 255, 255], al);
  g.fill();
}

/** A drop of brew, amber, falling: a round bottom drawn up to a point. */
function dropOf(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.3 * px);
  g.beginPath();
  g.moveTo(x, y - r * 2);
  g.quadraticCurveTo(x + r, y - r * 0.2, x, y + r);
  g.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 2);
  g.fillStyle = css(BREW, al);
  g.fill();
  g.strokeStyle = css(INK, al * 0.8);
  g.lineWidth = Math.max(0.6 * px, r * 0.25);
  g.stroke();
}

/** A leaf in the air, a pointed oval, inked. */
function leafBit(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.6 * px);
  g.fillStyle = css(c, al);
  g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), al);
  g.lineWidth = Math.max(px * 0.8, r * 0.18);
  g.beginPath();
  g.ellipse(x, y, r, r * 0.45, ang, 0, TAU);
  g.fill();
  g.stroke();
}

/** Where its barrel's top is in the world, for the froth that comes up out of it; and where the mouth of its tap is. */
const caskTop = (s: Toad, b: Bones): V3 => place(b.cask, [0, s.cask.tub ? caskR(s.cask, s.cask.h) * 0.4 : caskR(s.cask, s.cask.h) * 0.7, s.cask.h]);
const tapMouth = (s: Toad, b: Bones): V3 => {
  const T = tapOf(s), k = s.cask.r * (s.cask.tub ? 0.24 : 0.2);
  return place(b.cask, add(add(T.at, scale(T.out, k * 1.6)), [0, 0, -k * 1.0]));
};
const mouthOf = (s: Toad, b: Bones): V3 => place(b.head, [0, s.head.fwd + s.head.r[1] * 0.9, s.head.up - s.head.r[2] * s.head.mouth]);

/**
 * At its task: a bubble or two of froth up off the top of its barrel at each pat, a drop of brew off its tap now and then, and at
 * the end the Barrelburp's burp -- a puff of froth out of its mouth with bubbles in it.
 */
function brewing(g: CanvasRenderingContext2D, view: View, s: Toad, b: Bones, t: number, k: number, front: boolean): void {
  if (k <= 0.05) return;
  const big = 0.5 + 0.5 * bigOf(s), T = ACT_SECS.work, mid = b.body.t;
  const top = caskTop(s, b);
  BREW_WORK.pats.forEach((at, q) => {
    const since = (t - at) * T;
    if (since < 0 || since > 0.9) return;
    for (let j = 0; j < 2; j++) {
      const id = q * 7 + j, sp = 0.25 + 0.2 * jitter(id);
      const p: V3 = [top[0] + (jitter(id + 1) - 0.5) * 0.5 * big, top[1] + (jitter(id + 2) - 0.5) * 0.4 * big, top[2] + since * sp * 2 * big];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      bubble(g, x, y, (0.06 + 0.04 * jitter(id + 3)) * big, k * (1 - smooth((since - 0.6) / 0.3)));
    }
  });
  // Off the tap: a drop forming, falling, and gone, twice a go.
  const tap = tapMouth(s, b);
  if (nearSide(tap, mid, view) === front) {
    for (const at of [0.3, 0.66]) {
      const since = (t - at) * T;
      if (since < 0 || since > 0.6) continue;
      const fall = Math.max(0, since - 0.25), p: V3 = [tap[0], tap[1], Math.max(0.02, tap[2] - 4.9 * fall * fall)];
      const [x, y] = onScreen(view, p);
      dropOf(g, x, y, 0.035 * big * (0.6 + 0.4 * smooth(since / 0.25)), k * (1 - smooth((since - 0.5) / 0.1)));
    }
  }
  if (s.stage === 2) {
    const since = (t - BREW_WORK.croak) * T;
    if (since > -0.05 && since < 0.9 && front) {
      const m = mouthOf(s, b), age = clamp((since + 0.05) / 0.9);
      puff(g, view, add(m, [0, 0.3 * big * age, 0.25 * big * age]), 0.35 * big, age, 21, FROTH);
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * TAU, d = 0.25 * big * age;
        const [x, y] = onScreen(view, add(m, [Math.cos(a) * d, 0.2 * big * age, Math.sin(a) * d + 0.3 * big * age]));
        bubble(g, x, y, 0.05 * big, 1 - age);
      }
    }
  }
}

/** What a strike throws: dust where it comes down, and from the bigger two a shock across the ground and leaves shaken off. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Toad, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid = b.body.t, since = (t - TOAD_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  const at = place(b.cask, [0, caskR(s.cask, 0) * 0.6, 0]);
  const c: V3 = [at[0], at[1], 0.01];
  if (s.stage === 0) {
    if (nearSide(c, mid, view) === front) puff(g, view, [c[0], c[1], 0.05], 0.25 * big, since / 0.4, 3);
    return;
  }
  if (!front) {
    const age = since / 0.35;
    if (age < 1) groundRing(g, view, c, lenOf(s) * (0.4 + 1.1 * age) * (s.stage === 2 ? 1.3 : 1), null, [120, 100, 80], 0.7 * (1 - age), pxOf(g) * (2.2 - 1.2 * age), 0.12, 7);
  }
  for (const sd of [-1, 1]) {
    const p: V3 = [c[0] + sd * 0.45 * big * (1 + 1.5 * ramp(since, 0, 0.3)), c[1] + 0.1, 0.08];
    if (nearSide(p, mid, view) === front) puff(g, view, p, 0.45 * big * (s.stage === 2 ? 1.3 : 1), since / 0.5, 7 + sd);
  }
  if (s.stage === 2) {
    // Leaves and a cone or two shaken out of its mane by the blow, flying up and out.
    const back = place(b.trunk, [0, 0, marksOf(s).h[3] * 1.1]);
    for (let q = 0; q < 8; q++) {
      const a = (q / 8) * TAU + jitter(q) * 0.5, sp = (0.9 + 0.6 * jitter(q + 2)) * big;
      const p = thrown(back, [Math.cos(a) * sp, Math.sin(a) * sp, (2.4 + jitter(q + 3)) * big], since);
      if (nearSide(p, mid, view) !== front || since > 0.6) continue;
      const [x, y] = onScreen(view, p);
      leafBit(g, x, y, 0.08 * big, q + since * 10, q % 3 ? LEAF : HOP_RGB, 1 - smooth((since - 0.45) / 0.15));
    }
  }
}

/** Evolving: hop leaves and golden cones spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Toad, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], M = marksOf(s);
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = M.w[3] * 1.6 + 0.3 * big, ry = lenOf(s) * 0.9 + 0.3 * big, high = M.h[3] * 2.4 + 0.8 * big;
  for (let q = 0; q < 16; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 16) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * kk, Math.sin(ang) * ry * kk, -M.h[3] * 0.3 + u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3) leafBit(g, x, y, 0.1 * big, ang * 2, q % 2 ? LEAF : [112, 150, 64], swirl);
    else bubble(g, x, y, 0.06 * big * (1 - 0.4 * u), swirl * ramp(u, 0, 0.15));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function toadKind(look: Toad): Kind {
  const s: Toad = { ...look, body: rounded(look.body), marks: look.body };
  const bones = toadBones(s);
  return {
    bones,
    build: (lod) => toadBuild(s, lod),
    // The variant's coat tints its olive skin and its markings its spots; its cream, its pink tongue and cheeks, its black eyes,
    // its barrel and its hops are the same on every variant.
    palette: (coat, mark) => {
      const olive = mix([170, 182, 86], coat, 0.35);
      const spots = mix([128, 132, 96], mark, 0.35);
      const gold = s.cask.gold;
      return coatPalette(coat, mark, {
        coat: olive,
        coatDark: mix(olive, [60, 70, 40], 0.3),
        coatLight: mix(olive, [244, 240, 200], 0.4),
        mark: spots,
        spot: mix(spots, [220, 220, 180], 0.3),
        belly: [248, 236, 206],
        muzzle: [250, 240, 214],
        inner: [196, 86, 94],
        tongue: [238, 128, 136],
        nose: [70, 74, 44],
        lid: [62, 54, 40],
        eye: [18, 14, 14],
        glint: [255, 254, 248],
        bloom: [34, 28, 26],
        billDark: [22, 18, 16],
        shell: [244, 166, 150],
        pad: mix(olive, [240, 230, 180], 0.35),
        claw: [60, 50, 56],
        wood: [176, 112, 66],
        bark: [156, 96, 58],
        woodDark: [116, 72, 46],
        metal: gold ? [222, 176, 72] : [190, 120, 70],
        metalDark: gold ? [170, 126, 44] : [140, 84, 48],
        rivet: gold ? [246, 214, 120] : [222, 168, 110],
        fitting: [236, 190, 76],
        flame: [196, 146, 52],
        leather: [124, 78, 46],
        leatherDark: [92, 56, 34],
        leaf: [132, 170, 72],
        leafDark: [96, 134, 54],
        moss: [168, 198, 96],
        stem: [110, 130, 60],
        petal: [252, 248, 236],
        ember: [244, 196, 72],
        horn: [232, 206, 110],
        hornDark: [204, 168, 70],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [Math.max(lenOf(s) * 0.7, s.cask.r * 1.3) + 0.1, Math.max(s.hind.at[0] * 1.1, s.cask.r * 1.25)],
    stride: 1.2,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    leaps: [false, s.hops],
    // Evolving, the motes rising round it are froth and hop gold.
    motes: [[252, 244, 222], [226, 196, 96]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      const working = act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
      if (working && act?.kind === 'work') brewing(g, view, s, b, act.t, downOf(act.t, a.graze), front);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const BREWTOAD = toadKind(BREWTOAD_LOOK);
export const BROTHGUT = toadKind(BROTHGUT_LOOK);
export const BARRELBURP = toadKind(BARRELBURP_LOOK);
