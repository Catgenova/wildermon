import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  quadBones, quadPose, scale, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
  type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The lemur line: the Lemlet, a small fluffy grey-brown lemur kit with a
 * cream chest and face, dark masks round big amber eyes and a two-leaf sprout
 * on its head, which grows into the Lemleaf, lankier, on long limbs with long
 * fingers and big ears, a leafy vine with a white flower draped over its
 * shoulders and a sprig of leaves on its head; and then the Lemorian, large
 * and stately, carried high at the chest, a thick garland of leaves and white
 * flowers over its shoulders and down its back, a cream ruff, a spray of
 * leaves on its head. All three carry a huge tail ringed dark and cream, up
 * behind them and curled over at the top. The species is still `sprigga`
 * underneath, as saves and the database know it: it picks sprouts off living
 * trees and carries them home.
 *
 * A body on four legs (`quadPose`, `quadBones`), the hind legs longer than
 * the fore, bounding: hind feet together and then fore. Its tail is its own
 * chain of links, curled more toward the tip, and swings a beat behind the
 * body. At its task it sits up on its haunches, reaches up into the tree,
 * tugs a sprout off and brings it down to its mouth; it strikes with a swipe
 * of a fore paw, rearing and raking down.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** A leg: its shoulder or hip (right side), its upper, lower and the drop to the sole, how it stands, and how thick at top, joint and foot. */
interface Leg { at: V3; len: [number, number, number]; rest: [number, number, number]; w: [number, number, number] }

interface Lemur {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest. */
  body: Rings;
  fore: Leg;
  hind: Leg;
  /** The hand: how big its palm, how long its fingers. */
  hand: { r: number; finger: number };
  /** The neck's root on the body, its length, width and how far forward of upright it is carried (degrees). */
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull: its middle on the head's bone and its half-sizes; how its nose is carried; the muzzle's length and girth. */
  head: { c: V3; r: V3; pitch: number; snout: [number, number] };
  eye: { dir: V3; size: number };
  /** Each ear: where it is rooted on the head (the right one), how long and wide, splayed out and laid back (degrees). */
  ear: { at: V3; len: number; w: number; out: number; back: number };
  /** The tail: its root, how many links and how long each, its girth at each joint, lifted at the root, curled at the root link and the last. */
  tail: { at: V3; links: number; len: number; w: number[]; lift: number; curl: [number, number] };
  /** Leaves on the head: how many, how long. */
  sprig: [number, number];
  /** Leaves on the vine over its shoulders (none on the Lemlet), flowers in it, and how long its leaves are. */
  vine: [number, number, number];
  /** Rows of the garland over its shoulders and back, and how long its leaves are (none but on the Lemorian). */
  garland: [number, number];
  /** How big the cream ruff at the chest is. */
  ruff: number;
  gait: { swing: [number, number]; duty: [number, number]; bob: number; rock: number };
  /** How far it sits up to reach into a tree, in degrees, and how far it draws its arms out to; how far it sits up standing about. */
  rear: number;
  stretch: number;
  sits: number;
  size: number;
}

/** A Lemlet: a small round kit, a big head with big eyes and ears, short legs, its tail curled up behind higher than its head. */
const LEMLET_LOOK: Lemur = {
  stage: 0,
  body: { y: [-0.62, -0.52, -0.3, 0, 0.26, 0.44, 0.54], z: [0.06, 0.06, 0.02, 0.0, 0.04, 0.08, 0.1], w: [0.3, 0.5, 0.58, 0.58, 0.54, 0.46, 0.26], h: [0.3, 0.5, 0.58, 0.58, 0.54, 0.46, 0.24] },
  fore: { at: [0.3, 0.32, -0.26], len: [0.28, 0.26, 0.07], rest: [-26, 50, 0], w: [0.19, 0.14, 0.12] },
  hind: { at: [0.32, -0.32, -0.18], len: [0.36, 0.34, 0.07], rest: [52, -104, 0], w: [0.27, 0.15, 0.12] },
  hand: { r: 0.11, finger: 0 },
  neck: { at: [0, 0.44, 0.22], len: 0.16, w: 0.32, lean: 30 },
  head: { c: [0, 0.12, 0.4], r: [0.72, 0.58, 0.6], pitch: 2, snout: [0.46, 0.15] },
  eye: { dir: [0.4, 0.86, 0.15], size: 0.19 },
  ear: { at: [0.5, -0.06, 0.76], len: 0.64, w: 0.48, out: 34, back: 4 },
  tail: { at: [0, -0.56, 0.14], links: 9, len: 0.36, w: [0.18, 0.35, 0.44, 0.47, 0.48, 0.48, 0.46, 0.42, 0.36, 0.14], lift: 34, curl: [-6, 50] },
  sprig: [2, 0.58],
  vine: [0, 0, 0],
  garland: [0, 0],
  ruff: 0.3,
  gait: { swing: [26, 40], duty: [0.62, 0.34], bob: 0.06, rock: 6 },
  rear: 72,
  stretch: 0.45,
  sits: 0,
  size: 1.7,
};

/** A Lemleaf: lanky, the rump carried high on long hind legs, long fingers, big ears; a leafy vine over its shoulders, a sprig on its head. */
const LEMLEAF_LOOK: Lemur = {
  stage: 1,
  body: { y: [-1.08, -0.94, -0.56, 0, 0.46, 0.74, 0.86], z: [0.14, 0.16, 0.18, 0.16, 0.1, 0.06, 0.06], w: [0.28, 0.46, 0.5, 0.46, 0.48, 0.44, 0.26], h: [0.28, 0.44, 0.46, 0.42, 0.46, 0.44, 0.24] },
  fore: { at: [0.3, 0.6, -0.24], len: [0.52, 0.52, 0.08], rest: [-32, 62, 0], w: [0.17, 0.11, 0.1] },
  hind: { at: [0.32, -0.7, -0.1], len: [0.7, 0.68, 0.08], rest: [56, -116, 0], w: [0.27, 0.13, 0.1] },
  hand: { r: 0.1, finger: 0.18 },
  neck: { at: [0, 0.72, 0.2], len: 0.4, w: 0.3, lean: 60 },
  head: { c: [0, 0.12, 0.38], r: [0.7, 0.58, 0.6], pitch: -2, snout: [0.6, 0.16] },
  eye: { dir: [0.46, 0.82, 0.18], size: 0.165 },
  ear: { at: [0.54, -0.06, 0.66], len: 0.7, w: 0.48, out: 52, back: 6 },
  tail: { at: [0, -1.0, 0.2], links: 11, len: 0.38, w: [0.17, 0.32, 0.42, 0.46, 0.48, 0.48, 0.47, 0.45, 0.42, 0.38, 0.32, 0.12], lift: 42, curl: [6, 40] },
  sprig: [3, 0.62],
  vine: [32, 1, 0.8],
  garland: [0, 0],
  ruff: 0.4,
  gait: { swing: [28, 44], duty: [0.6, 0.3], bob: 0.08, rock: 7 },
  rear: 66,
  stretch: 0.2,
  sits: 0,
  size: 2.05,
};

/** A Lemorian: large and stately, deep in the chest and carried high on long fore legs, a garland of leaves and flowers, a cream ruff. */
const LEMORIAN_LOOK: Lemur = {
  stage: 2,
  body: { y: [-1.0, -0.88, -0.5, 0, 0.46, 0.8, 0.94], z: [0.0, 0.0, 0.02, 0.08, 0.16, 0.24, 0.28], w: [0.36, 0.64, 0.74, 0.74, 0.76, 0.68, 0.36], h: [0.36, 0.62, 0.72, 0.76, 0.8, 0.72, 0.38] },
  fore: { at: [0.42, 0.62, -0.3], len: [0.58, 0.54, 0.1], rest: [-14, 28, 0], w: [0.3, 0.19, 0.15] },
  hind: { at: [0.44, -0.6, -0.12], len: [0.76, 0.72, 0.1], rest: [52, -104, 0], w: [0.42, 0.2, 0.15] },
  hand: { r: 0.15, finger: 0.22 },
  neck: { at: [0, 0.82, 0.34], len: 0.36, w: 0.44, lean: 20 },
  head: { c: [0, 0.12, 0.4], r: [0.74, 0.62, 0.64], pitch: 4, snout: [0.66, 0.18] },
  eye: { dir: [0.46, 0.82, 0.2], size: 0.16 },
  ear: { at: [0.58, -0.06, 0.7], len: 0.68, w: 0.48, out: 50, back: 8 },
  tail: { at: [0, -0.94, 0.2], links: 10, len: 0.5, w: [0.24, 0.46, 0.6, 0.67, 0.7, 0.7, 0.68, 0.64, 0.58, 0.5, 0.18], lift: 36, curl: [8, 42] },
  sprig: [5, 0.62],
  vine: [0, 0, 0],
  garland: [64, 0.82],
  ruff: 0.62,
  gait: { swing: [24, 38], duty: [0.62, 0.32], bob: 0.06, rock: 5 },
  rear: 56,
  stretch: 0.15,
  sits: 44,
  size: 2.5,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
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

/** An egg with its axes along a frame: anything round that leans or points. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
}

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

/* ---- its bones ------------------------------------------------------------------------- */

/**
 * How a hind leg stands: its thigh carried forward as the stage says, and the
 * hock bent just so far that the sole comes down level with the fore feet's,
 * under a body carried as high as its fore legs hold it. Where the leg is too
 * short for that with its thigh so far forward, the thigh is brought back
 * until it reaches.
 */
function hindRest(s: Lemur): [number, number, number] {
  const F = s.fore, H = s.hind, cos = (d: number): number => Math.cos(d * DEG);
  const high = F.len[0] * cos(F.rest[0]) + F.len[1] * cos(F.rest[0] + F.rest[1]) + F.len[2] - F.at[2];
  const drop = high + H.at[2] - H.len[2];
  for (let a = H.rest[0]; a > -10; a -= 2) {
    const c = (drop - H.len[0] * cos(a)) / H.len[1];
    if (c <= 1) return [a, -Math.acos(Math.max(-1, c)) / DEG - a, H.rest[2]];
  }
  return H.rest;
}

/** A stage's body on four legs (`QuadSpec`): its legs, neck, ears and tail from its numbers, and a bounding stride. */
const specOf = (s: Lemur): QuadSpec => ({
  high: s.hind.len[0] + s.hind.len[1],
  fore: { at: s.fore.at, len: s.fore.len, rest: s.fore.rest, fold: [55, 85], toe: [s.hand.r * 1.3 + s.hand.finger * 0.8, s.hand.r * 0.5] },
  hind: { at: s.hind.at, len: s.hind.len, rest: hindRest(s), fold: [40, 62], toe: [s.hand.r * 1.6 + s.hand.finger, s.hand.r * 0.6] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: s.tail.at, links: s.tail.links, len: s.tail.len, lift: s.tail.lift, curl: 0, sway: 12 },
  ears: { at: s.ear.at, out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: s.gait.duty,
  bound: true,
  graze: 30,
  nose: 14,
  bow: 10,
  rock: s.gait.rock,
});

/** How far a stage's tail is curled at each joint past the root, more toward the tip, so it rises behind and hooks over at the top. */
const curlOf = (s: Lemur, q: number): number => lerp(s.tail.curl[0], s.tail.curl[1], (q / (s.tail.links - 1)) ** 1.2);

/** The task: sat up and reached into the tree, the sprout tugged twice and snapped off, brought down to the mouth and taken. */
export const LEMUR_PICK = { reach: 0.3, tugs: [0.38, 0.5] as const, snap: 0.56, mouth: 0.8, taken: 0.86 };
/** The strike: drawn up with the paw raised, raked down, and settled. */
export const LEMUR_SWIPE = { wind: 0.32, hit: 0.46 };

/** Where a sitting body's paws are held, as an angle up from straight down: a little in front of it, on the ground. */
const SAT_PAWS = 22;

/** How far up on its haunches it is through a go at its task: sat up throughout while it keeps at it, else up and down again. */
const upOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.16) * (1 - ramp(t, 0.86, 1)));

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): bounding
 * as it goes, the tail swinging; standing, a tilt of the head, a flick of the
 * tail; and its moves -- a swipe, sitting up to pick a sprout, and evolving.
 * Returns how far forward of its hind feet the body is carried by its moves,
 * in its own units, which its legs are swung back to keep.
 */
function lemurPose(s: Lemur, spec: QuadSpec, p: QuadPose, a: Anim): void {
  const g = smooth(a.go), st = 1 - g;
  const w = frac(a.u);
  if (a.go > 0) {
    // Bounding: the back flexing, nose up as the hind feet drive and down as the fore feet land, the body rising off each pair,
    // the head steadied against it, the tail swinging a beat behind.
    const walk = 1 - a.gait;
    p.lift += g * walk * s.gait.bob * Math.max(0, Math.sin((w - 0.12) * TAU * 2));
    // Running, it leaps: off its hind feet, a long float, down on its fore feet, and a short one before the hind come down again
    // (in place of the even rise `quadPose` gives a bound).
    const legs = s.hind.len[0] + s.hind.len[1];
    p.lift += g * a.gait * (legs * (0.42 * hump(w, 0.4, 0.14) + 0.14 * hump(w, 0.9, 0.1)) - 1.4 * Math.max(0, Math.sin(w * TAU)));
    // Drawn out long in the air and gathered up as it lands; the tail streamed further back.
    p.squash += g * a.gait * (0.1 * hump(w, 0.62, 0.12) - 0.14 * hump(w, 0.4, 0.14));
    p.tail[0] -= g * a.gait * 22;
    p.pitch += g * walk * s.gait.rock * Math.sin((w - 0.15) * TAU);
    p.head[0] -= g * walk * s.gait.rock * 0.8 * Math.sin((w - 0.15) * TAU);
    p.tail[1] += g * 16 * Math.sin(w * TAU + 0.8);
    p.tail[0] += g * (6 + 8 * a.gait) * Math.sin(w * TAU * 2 - 1.2);
    p.ears[0][0] += g * 6 * Math.sin(w * TAU * 2 - 1.4);
    p.ears[1][0] += g * 6 * Math.sin(w * TAU * 2 - 1.1);
  }
  if (st > 0) {
    // Standing: the tail flicked now and then, its curl drawn tight and let go, and swung; a curious tilt of the head.
    const flick = beat(a.t, [2.3, 9.1, 15.8, 21.4], 0.8);
    p.tail[2] += st * (5 * cyc(a.t, 4) - 14 * flick);
    p.tail[1] += st * (12 * cyc(a.t, 3) + 16 * flick * Math.sin(a.t * 11));
    const tilt = beat(a.t, [5.2, 13.6, 19.9], 2.0);
    p.head[2] += st * 18 * tilt * (a.t > 13 && a.t < 17 ? -1 : 1);
    p.head[0] += st * 6 * tilt;
  }
  // The Lemorian sits up on its haunches standing about, its paws held in front of it, as it would sit on a branch.
  const act = a.act;
  if (s.sits && st > 0 && !act) {
    sitUp(s, p, s.sits, st);
    for (const i of [0, 1]) {
      p.legs[i][0] += st * (SAT_PAWS - s.sits);
      p.legs[i][1] += st * 0.45;
      p.legs[i][2] += st;
    }
  }
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') workPose(s, p, act.t, a.graze);
  else if (act?.kind === 'evolve') evolvePose(s, p, act.t);
}

/** Its body sat up `deg` on its haunches: the hind legs kept under it, the neck and head brought forward over the chest again. */
function sitUp(s: Lemur, p: QuadPose, deg: number, k: number): void {
  const P = deg * k;
  p.pitch += P;
  // The hind legs swung forward by as much as the body tips back, so they stay under it, and crouched.
  for (const i of [2, 3]) {
    p.legs[i][0] -= P * 0.82;
    p.legs[i][1] += 0.25 * k;
  }
  // The neck bowed forward over the chest; the head, which is carried at its own pitch whatever the neck does, brought level.
  p.neck[0] += P * 0.55;
  p.head[0] -= P;
  // The tail laid along the ground behind as a prop, rather than tipped back with the rump.
  p.tail[0] += P * 0.55;
  p.tail[2] -= 6 * k;
}

/** The swipe: rearing with the right fore paw raised, ears back and mouth open, raking it down and forward, and settling. */
function strikePose(s: Lemur, p: QuadPose, t: number): void {
  const wind = ramp(t, 0, LEMUR_SWIPE.wind) * (1 - ramp(t, LEMUR_SWIPE.wind, LEMUR_SWIPE.hit));
  const rake = ramp(t, LEMUR_SWIPE.wind - 0.02, LEMUR_SWIPE.hit) * (1 - ramp(t, LEMUR_SWIPE.hit + 0.08, 1));
  const up = ramp(t, 0, LEMUR_SWIPE.wind) * (1 - ramp(t, LEMUR_SWIPE.hit, 0.95));
  // Reared from however far up it was sitting (the Lemorian sits), never lower.
  const sit = lerp(s.sits, Math.max(38, s.sits), up);
  sitUp(s, p, sit, 1);
  p.pitch -= 16 * rake;
  // The paw: up and forward over its head, then raked down and forward in front of its chest.
  const P = sit - 16 * rake;
  const aim = lerp(lerp(s.sits ? SAT_PAWS : 0, 114, wind), 40, rake);
  p.legs[1][0] = aim - P;
  // Straight at the elbow: the lower leg's own bend at rest taken out of it, so the whole arm points where it is aimed.
  p.legs[1][1] = (s.fore.rest[1] / 85) * Math.max(wind, rake);
  p.legs[1][2] = Math.max(wind, rake);
  p.foot[1] += -30 * wind + 40 * rake;
  // The other paw braced forward on the ground.
  p.legs[0][0] = 26 * up - P;
  p.legs[0][1] = 0.3 * up;
  p.legs[0][2] = 0.4 * up * (1 - rake);
  p.roll += -8 * wind + 10 * rake;
  // The head drawn back and turned a little from the raised paw, then thrown in after it.
  p.neck[0] += -26 * wind + 18 * rake;
  p.head[0] += 6 * wind - 10 * rake;
  p.head[2] += -8 * wind + 6 * rake;
  p.jaw = Math.max(wind, rake);
  for (const e of p.ears) e[0] += 50 * Math.max(wind, rake);
  p.tail[0] += 12 * wind;
  p.tail[2] -= 10 * wind;
  p.tail[1] += -20 * rake;
}

/** Picking: sat up, the right paw reaching up into the tree, two tugs and the sprout snapped off, brought down to its mouth. */
function workPose(s: Lemur, p: QuadPose, t: number, graze: number): void {
  const up = upOf(t, graze), sat = s.sits / s.rear;
  sitUp(s, p, s.rear, sat + (1 - sat) * up);
  const P = s.rear * (sat + (1 - sat) * up);
  const reach = ramp(t, 0.04, LEMUR_PICK.reach), tug = hump(t, LEMUR_PICK.tugs[0], 0.06) + hump(t, LEMUR_PICK.tugs[1], 0.06), snap = hump(t, LEMUR_PICK.snap + 0.02, 0.05);
  const down = ramp(t, LEMUR_PICK.snap, LEMUR_PICK.mouth), back = ramp(t, LEMUR_PICK.taken, 1);
  // Kept at it, each go starts with the paws still up in the tree from the last; played once, from the ground and back to it.
  const again = graze > 0.5;
  const rest = s.sits ? SAT_PAWS : P, from = again ? 134 : rest, to = again ? 134 : rest;
  // Where the picking paw (the right) is aimed through a go, as an angle up from straight down in the world, and how far its
  // elbow is bent: up into the tree, two tugs, a jerk down as the sprout snaps off, down to its mouth, and up again.
  // Brought to its mouth: the upper arm down and forward, the elbow bent the other way so the paw comes up under its chin.
  const aim = lerp(lerp(lerp(from, 140, reach) - 10 * tug - 24 * snap, 46, down), to, back);
  const bend = lerp(lerp(0.05 + 0.3 * tug, -1.15, down), again ? 0.15 : 0, back);
  p.legs[1][0] = aim - P;
  p.legs[1][1] = bend;
  p.legs[1][2] = up;
  p.foot[1] += up * (-40 * (1 - down) + 30 * down);
  // The other holds the branch steady while it picks, and comes down with it, both paws at its mouth.
  const hold = lerp(lerp(lerp(from, 128, reach) - 6 * tug, 54, down), to, back);
  p.legs[0][0] = hold - P;
  p.legs[0][1] = lerp(lerp(0.2 + 0.2 * tug, -1, down), again ? 0.15 : 0, back);
  p.legs[0][2] = up;
  p.foot[0] -= 30 * up;
  // Stretched up on its toes to reach, the heels lifted.
  p.squash -= 0.1 * up * (1 - down * 0.6);
  p.foot[2] -= 22 * up * (1 - down);
  p.foot[3] -= 22 * up * (1 - down);
  // Looking up at what it picks, then down at what it brings.
  p.head[0] += up * (26 * (1 - down) - 6 * down + 5 * tug) + 8 * snap;
  p.head[2] += up * 6 * (1 - down);
  p.jaw = hump(t, LEMUR_PICK.mouth + 0.03, 0.06);
  p.ears[0][0] += 18 * snap;
  p.ears[1][0] += 18 * snap;
  // The tail swinging to keep it balanced.
  p.tail[1] += up * 14 * Math.sin(t * TAU);
}

/** Evolving: sat up tall with both paws raised, a shake, and down again. */
function evolvePose(s: Lemur, p: QuadPose, t: number): void {
  const up = ramp(t, 0.05, 0.35) * (1 - ramp(t, 0.72, 0.95)), shake = hump(t, 0.55, 0.12);
  const sit = lerp(s.sits, s.rear * 0.9, up);
  sitUp(s, p, sit, 1);
  const P = sit;
  for (const i of [0, 1]) {
    p.legs[i][0] = lerp(0, 150, up) - P;
    p.legs[i][1] = 0.3 * up;
    p.legs[i][2] = up;
  }
  p.head[0] += 18 * up;
  p.head[2] += 16 * shake * Math.sin(t * 70);
  for (const e of p.ears) e[0] += 26 * shake * Math.sin(t * 70);
  p.tail[1] += 24 * Math.sin(t * 24) * up;
}

/** How far the body is carried forward of where its hind feet stand by its moves: the lunge of the swipe. */
function surge(s: Lemur, a: Anim): number {
  const act = a.act;
  if (act?.kind !== 'strike') return 0;
  const t = act.t, rake = ramp(t, LEMUR_SWIPE.wind - 0.02, LEMUR_SWIPE.hit) * (1 - ramp(t, LEMUR_SWIPE.hit + 0.1, 1));
  return (s.body.y[6] - s.body.y[0]) * (0.18 * rake - 0.06 * ramp(t, 0, LEMUR_SWIPE.wind) * (1 - rake));
}

/**
 * How far its arms are drawn out at its task, as it stretches up into the
 * tree: the picking arm and the one holding the branch, against their
 * length.
 */
function stretchOf(s: Lemur, a: Anim): [number, number] {
  const act = a.act;
  // Striking, the paw flung out at full reach.
  if (act?.kind === 'strike') return [1, 1 + s.stretch * 0.8 * Math.max(ramp(act.t, 0.1, LEMUR_SWIPE.wind), 0) * (1 - ramp(act.t, LEMUR_SWIPE.hit + 0.06, 0.9))];
  if (act?.kind !== 'work') return [1, 1];
  const t = act.t, up = upOf(t, a.graze), again = a.graze > 0.5;
  const reach = again ? 1 : ramp(t, 0.04, LEMUR_PICK.reach), down = ramp(t, LEMUR_PICK.snap, LEMUR_PICK.mouth), back = again ? ramp(t, LEMUR_PICK.taken, 1) : 0;
  const k = s.stretch * up;
  return [1 + k * (again ? 1 : reach * (1 - down)), 1 + k * Math.max(reach * (1 - down), back)];
}

/** An arm's bones drawn out `k` times their length from the shoulder, the paw kept its size. */
function stretched(b: Bones, key: string, k: number): void {
  if (k === 1) return;
  const [u, l, f] = [b[`${key}0`], b[`${key}1`], b[`${key}2`]];
  const long = (x: typeof u): typeof u => ({ m: [x.m[0], x.m[1], x.m[2] * k, x.m[3], x.m[4], x.m[5] * k, x.m[6], x.m[7], x.m[8] * k], t: x.t });
  const l2 = { ...long(l), t: add(u.t, scale(sub(l.t, u.t), k)) };
  const f2 = { m: f.m, t: add(l2.t, scale(sub(f.t, l.t), k)) };
  b[`${key}0`] = long(u);
  b[`${key}1`] = l2;
  b[`${key}2`] = f2;
}

/** The tail's bones, each link on from the one before: lifted, curled more toward its tip, swung with a wave running down it. */
function tailBones(s: Lemur, b: Bones, p: QuadPose, a: Anim): void {
  const T = s.tail, n = T.links;
  // A wave down the tail: the tip a beat behind the root, so it swings as a whole rather than as a stick.
  const wave = a.go > 0 ? frac(a.u) * TAU : (a.t * TAU) / 4;
  const amp = a.go > 0 ? 6 * smooth(a.go) : 3;
  let prev = joint(b.body, T.at, -(T.lift + p.tail[0]), 0, p.tail[1] * 0.45);
  b.tail0 = prev;
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.len, 0], -(curlOf(s, q) + p.tail[2] * (q / n)), 0, (p.tail[1] * 0.55) / n + amp * Math.sin(wave - q * 0.5));
    b[`tail${q}`] = prev;
  }
}

/** The bones of a stage: a body on four legs, its tail, carried where its moves take it with its hind feet kept where they stand. */
function lemurBones(s: Lemur): (a: Anim) => Bones {
  const spec = specOf(s);
  const hindY = (b: Bones): number => (place(b.hl2, [0, 0, 0])[1] + place(b.hr2, [0, 0, 0])[1]) / 2;
  const pose = (a: Anim): { b: Bones; p: QuadPose } => {
    // Its task is sitting up to the tree, not its head down at the grass.
    const a2 = a.act ? { ...a, graze: 0 } : a;
    const p = quadPose(spec, a2);
    lemurPose(s, spec, p, a);
    const d = surge(s, a);
    if (d) {
      for (const i of [2, 3]) {
        const L = spec.hind.len;
        p.legs[i][0] -= Math.asin(clamp(d / (L[0] + L[1]), -0.9, 0.9)) / DEG;
      }
    }
    return { b: quadBones(spec, p), p };
  };
  const rest = pose({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 }).b;
  const y0 = hindY(rest);
  return (a) => {
    const { b, p } = pose(a);
    tailBones(s, b, p, a);
    const [fl, fr] = stretchOf(s, a);
    stretched(b, 'fl', fl);
    stretched(b, 'fr', fr);
    // At its moves, the hind feet kept where they stood, whatever the body does over them.
    if (a.act && a.go < 1) {
      const dy = (y0 - hindY(b)) * (1 - smooth(a.go));
      for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + dy, b[k].t[2]] };
    }
    return b;
  };
}

/* ---- leaves and flowers ---------------------------------------------------------------- */

/**
 * A thin flat thing along a line of points -- a leaf, a petal -- `widths`
 * across it (half-widths) at each, its face turned along `face`, its edges
 * lifted by `fold` of its width so it is a shallow V down its middle: the
 * half to its left in `mats[0]` and to its right in `mats[1]`, so the fold
 * reads as a rib, and its underside in `mats[2]`. No thickness: a top and an
 * underside, whichever is turned to the viewer drawn.
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
  const widths = Array.from({ length: K }, (_, k) => Math.max(0.012, w * Math.sin(Math.PI * (k / (K - 1)) ** 0.85) ** 0.9));
  return sheet(curve(root, mid, tip, K - 1), widths, f, 0.25, mats);
}

/** A small white five-petalled flower at `c`, facing along `n`, `r` across, its middle yellow; lit on both faces, so always white. */
function flower(c: V3, n: V3, r: number, spin = 0): Mesh {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (len3(x) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const paints: Disc[] = [];
  const petals = Array.from({ length: 5 }, (_, q) => {
    const t = spin + (q / 5) * TAU, d = add(scale(x, Math.cos(t)), scale(y, Math.sin(t)));
    const at = (k: number, lift: number): V3 => add(add(c, scale(d, r * k)), scale(z, r * lift));
    for (const sd of [1, -1]) paints.push(disc(add(at(0.55, 0.11), scale(z, sd * 0.012)), scale(z, sd), r * 0.38, r * 0.32, 7, 'petal', { up: cross(z, d), lit: true }));
    return sheet([at(0.12, 0.05), at(0.55, 0.12), at(0.95, 0.08)], [r * 0.22, r * 0.44, r * 0.22], z, 0.12, ['petal', 'petal', 'petal']);
  });
  for (const sd of [1, -1]) paints.push(disc(add(c, scale(z, sd * r * 0.16)), scale(z, sd), r * 0.24, r * 0.24, 7, 'bloom', { lit: true }));
  return merge(...petals, paint(paints));
}

/** One leaf or flower of a piece of them: its mesh, the way it lifts as it stirs, and whether it is a flower. */
interface Frond { mesh: Mesh; out: V3; bloom?: boolean }
/** A mesh of leaves and flowers with, for each corner, how far out along its leaf it is and which way it lifts. */
interface Fronds { mesh: Mesh; w: number[]; out: V3[] }
function fronds(parts: readonly Frond[]): Fronds {
  const w: number[] = [], out: V3[] = [];
  for (const p of parts) {
    // A leaf's corners go six to a point along it, root to tip (`sheet`); a flower moves as the middle of a leaf does.
    const K = p.mesh.v.length / 6;
    p.mesh.v.forEach((_, i) => { w.push(p.bloom ? 0.6 : Math.floor(i / 6) / Math.max(1, K - 1)); out.push(p.out); });
  }
  return { mesh: merge(...parts.map((p) => p.mesh)), w, out };
}

/**
 * How far the leaves are stirred this moment: lifted off what they grow on,
 * as a share of their length, and swayed across. A breeze now and then
 * standing, a bounce at each bound as it goes, a rustle as it tugs at a
 * sprout, bristling as it strikes and as it evolves.
 */
function stir(a: Anim, phase: number): { lift: number; sway: number; bounce: number } {
  const st = 1 - smooth(a.go);
  let lift = st * 0.04 * beat(a.t, [3.6, 11.9, 18.2], 1.6);
  let sway = st * (0.05 * cyc(a.t, 6, phase) + 0.03 * cyc(a.t, 11, phase * 2));
  let bounce = a.go > 0 ? smooth(a.go) * (0.08 + 0.06 * a.gait) * Math.sin(frac(a.u) * TAU * 2 - 1.4 - phase) : 0;
  const act = a.act;
  if (act?.kind === 'strike') {
    lift += 0.18 * hump(act.t, LEMUR_SWIPE.hit, 0.2);
    sway += 0.1 * Math.sin(act.t * 30 - phase) * hump(act.t, LEMUR_SWIPE.hit + 0.1, 0.25);
  } else if (act?.kind === 'work') {
    const tug = hump(act.t, LEMUR_PICK.tugs[0], 0.06) + hump(act.t, LEMUR_PICK.tugs[1], 0.06) + 1.5 * hump(act.t, LEMUR_PICK.snap + 0.02, 0.06);
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
function snoutOf(s: Lemur): { c: V3; f: [V3, V3, V3]; r: V3; tip: V3 } {
  const C = s.head.c, R = s.head.r, [L, G] = s.head.snout;
  const f = frameOf(unit([0, 1, -0.3]), [0, 0, 1]);
  const c = add(C, [0, R[1] * 0.78, -R[2] * 0.3]);
  const r: V3 = [G, G * 0.85, L * 0.6];
  return { c, f, r, tip: add(c, scale(f[2], r[2] * 0.95)) };
}

/**
 * The eyes in their masks: each a dark rim, a big amber iris, a darker ring,
 * a dark middle and two glints, laid onto the skull's curve; all of an eye
 * out of sight together when the head is between it and the viewer.
 */
function eyesOf(s: Lemur, shut: boolean): Mesh {
  const E = s.eye, C = s.head.c, R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size, tall = 1.08;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'muzzle', o), 0.022));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.16, r * 1.18 * tall, 12, 'eye', o), 0.016));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystal', o), 0.02));
    out.push(onto(disc(add(p, scale(up, -r * 0.06)), n, r * 0.7, r * 0.72 * tall, 10, 'crystalDark', o), 0.024));
    out.push(onto(disc(add(p, scale(up, -r * 0.04)), n, r * 0.46, r * 0.52 * tall, 8, 'eye', o), 0.028));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36 * tall)), scale(across, side * r * 0.3)), n, r * 0.32, r * 0.32, 6, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.42 * tall)), scale(across, -side * r * 0.32)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

/**
 * The head: a round skull, its crown and the back of it the coat's
 * grey-brown and its face cream; fluffed cream cheeks out either side; a
 * short fox's muzzle, dark grey, with a black nose and a cream chin; a dark
 * mask round each big amber eye, drawn down toward the muzzle; a small smile.
 */
function headOf(s: Lemur, n: number, k: number, shut: boolean): Mesh {
  const C = s.head.c, R = s.head.r, E = s.eye;
  const skull = ((m: Mesh): Mesh => mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const d: V3 = [(c[0] - C[0]) / R[0], (c[1] - C[1]) / R[1], (c[2] - C[2]) / R[2]];
    // The crown's cap comes down to the brow over the eyes and back behind the ears; under it, the face and throat are cream.
    const cap = d[2] > 0.5 - 0.12 * d[1] || (d[1] < -0.35 && d[2] > 0);
    return cap ? f : { ...f, m: 'mark' as Mat };
  })))(orb(C, R, n + 4, k + 3, 'coat'));
  // Cheeks fluffed out either side below the ears, cream, ending in tufts pointing out and down.
  const cheeks: Mesh[] = [];
  for (const sd of [1, -1]) {
    const at = add(C, [sd * R[0] * 0.62, -R[1] * 0.08, -R[2] * 0.32]);
    cheeks.push(egg(at, frameOf(unit([sd, -0.1, -0.35]), [0, 1, 0]), [R[0] * 0.3, R[1] * 0.4, R[0] * 0.48], n, k, 'mark'));
    for (const [dz, dy, len] of [[0.12, -0.1, 0.4], [-0.3, 0.05, 0.44]] as Array<[number, number, number]>) {
      cheeks.push(tuft(add(at, [sd * R[0] * 0.12, dy * R[1], dz * R[2]]), [sd, -0.3 + dy, -0.2 + dz * 1.4], R[0] * len, R[0] * 0.22, 'mark', 5));
    }
  }
  // The muzzle: a short cone forward and a little down out of the lower face, dark grey over a cream chin, a black nose on it.
  const S = snoutOf(s);
  const snout = ((m: Mesh): Mesh => mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return dot(sub(c, S.c), S.f[1]) < -S.r[1] * 0.35 ? { ...f, m: 'muzzle' as Mat } : f;
  })))(egg(S.c, [S.f[0], S.f[1], S.f[2]], S.r, n, k, 'coatDark'));
  const nose = egg(add(S.tip, add(scale(S.f[1], S.r[1] * 0.3), scale(S.f[2], -0.02))), frameOf([0, 0, 1], [0, 1, 0]), [S.r[0] * 0.5, S.r[0] * 0.36, S.r[0] * 0.32], 6, 4, 'nose');
  // The masks: a dark ring round each eye, drawn down and in toward the muzzle; the dark of the muzzle run up between the eyes.
  const mask: Disc[] = [];
  for (const sd of [1, -1]) {
    mask.push(patchOn(C, R, [sd * E.dir[0], E.dir[1], E.dir[2]], E.size * 1.95, E.size * 1.8, 'lid', 0, 0.008, 14));
    mask.push(patchOn(C, R, [sd * (E.dir[0] - 0.12), E.dir[1] + 0.1, E.dir[2] - 0.32], E.size * 1.3, E.size * 1.45, 'lid', sd * 0.5, 0.009, 10));
  }
  mask.push(patchOn(C, R, [0, 1, 0.08], E.size * 0.55, E.size * 1.6, 'coatDark', 0, 0.01, 8));
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

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Lemur): Array<{ c: V3; r: V3 }> => [{ c: s.head.c, r: scale(s.head.r, 0.82) }];

/** An ear: big and rounded to a soft point, the coat outside, a cream hollow facing forward with a tuft of cream fur out of it. */
function earOf(s: Lemur, n: number): Mesh {
  const E = s.ear;
  const pts = [0, 0.3, 0.62, 0.88, 1].map((u) => [0, 0.02 * Math.sin(u * Math.PI), E.len * u] as V3);
  const ws = [E.w * 0.7, E.w, E.w * 0.86, E.w * 0.5, E.w * 0.1];
  const outer = tube(pts, ws, ws.map((x) => Math.max(0.025, x * 0.16)), n, 'coat', { up: [0, 1, 0] });
  const inner = tube([pts[0], ...pts.slice(1, 4)].map((p, q) => add(p, [0, E.w * 0.16, q ? 0 : E.len * 0.08])), [E.w * 0.5, E.w * 0.8, E.w * 0.68, E.w * 0.28], [E.w * 0.08, E.w * 0.12, E.w * 0.1, E.w * 0.04], n, 'inner', { up: [0, 1, 0] });
  const fluff = merge(
    tuft([0, E.w * 0.18, E.len * 0.12], [0.5, 0.6, 0.4], E.len * 0.42, E.w * 0.22, 'mark', 4),
    tuft([0, E.w * 0.18, E.len * 0.2], [-0.4, 0.6, 0.6], E.len * 0.36, E.w * 0.2, 'mark', 4),
  );
  return merge(outer, inner, fluff);
}

/* ---- the tail ------------------------------------------------------------------------------- */

/**
 * The tail's links, each soft and fluffed out in its middle so the tail is a
 * bushy run of puffs: the root the coat's grey-brown, then cream and dark
 * rings by turns, the tip dark and rounded off.
 */
function tailLinks(s: Lemur, n: number): Mesh[] {
  const T = s.tail;
  return Array.from({ length: T.links }, (_, q) => {
    const w0 = T.w[q], w1 = T.w[q + 1], wm = Math.max(w0, w1) * 1.1, last = q === T.links - 1, L = T.len;
    const mat: Mat = q === 0 ? 'coat' : q % 2 || last ? 'featherDark' : 'feather';
    const ys = last ? [0.05, -L * 0.3, -L * 0.7, -L * 1.0, -L * 1.18, -L * 1.3] : [0.05, -L * 0.3, -L * 0.7, -L - 0.03];
    const ws = last ? [w0 * 0.98, wm, wm * 0.9, wm * 0.66, wm * 0.36, 0.02] : [w0 * 0.98, wm, wm, w1 * 0.98];
    const link = tube(ys.map((y) => [0, y, 0] as V3), ws, ws.map((x) => x * 0.94), n, mat, { start: q === 0, end: last });
    if (q === 0 || q >= T.links - 2) return link;
    // Locks of fur round it swept toward the tip, three to a ring and each ring turned from the last, so its edge is soft.
    const locks = [0, 1, 2].map((j) => {
      const a = ((j + 0.5 * (q % 2)) / 3) * TAU + 0.5 * jitter(q * 7 + j), r: V3 = [Math.cos(a), 0, Math.sin(a)];
      const root = add(scale(r, wm * 0.78), [0, -L * (last ? 0.4 : 0.55), 0]);
      return tuft(root, add(scale(r, 0.32), [0, -0.95, 0]), wm * 0.5, wm * 0.2, mat, 5);
    });
    return merge(link, ...locks);
  });
}

/* ---- the hand ------------------------------------------------------------------------------- */

/** A hand or foot: a dark palm, and on the bigger two long fingers splayed forward; its sole at `drop` under the wrist. */
function handOf(s: Lemur, drop: number, n: number, k: number, fine: boolean, hind: boolean): Mesh {
  const r = s.hand.r * (hind ? 1.15 : 1), F = s.hand.finger * (hind ? 1.15 : 1);
  const palm = orbAlong([0, r * 0.4, -drop + r * 0.5], [0, 1, 0], [r, r * 0.6, r * 1.25], n, k, 'pad');
  if (!F || !fine) return F ? orbAlong([0, r * 0.6, -drop + r * 0.42], [0, 1, 0], [r * 1.05, r * 0.5, r * 1.25 + F * 0.4], n, k, 'pad') : palm;
  const fingers = [-1, -0.33, 0.33, 1].map((u) => {
    const root: V3 = [u * r * 0.7, r * 1.2, -drop + r * 0.35];
    const tip: V3 = add(root, [u * F * 0.35, F, -r * 0.3]);
    return tube(curve(root, add(scale(add(root, tip), 0.5), [0, 0, r * 0.15]), tip, 2), [r * 0.26, r * 0.22, r * 0.12], [r * 0.24, r * 0.2, r * 0.1], 4, 'pad');
  });
  return merge(palm, ...fingers);
}

/** The sprout it picks: a short stem with a pair of leaves and a bud, held in its paw, upright. */
function sproutOf(s: Lemur, K: number): Mesh {
  const L = [0.42, 0.5, 0.56][s.stage], r = s.hand.r;
  const base: V3 = [0, r * 1.1, -s.fore.len[2] + r * 0.9];
  const top = add(base, [0, L * 0.25, L * 0.75]);
  return merge(
    tube(curve(base, add(base, [0, L * 0.2, L * 0.4]), top, 3), 0.025, 0.025, 4, 'bark'),
    leaf(top, [0.7, 0.2, 0.7], [0, 1, 0.3], L * 0.6, L * 0.22, K, TONES[1]),
    leaf(top, [-0.7, -0.1, 0.7], [0, 1, 0.3], L * 0.55, L * 0.2, K, TONES[0]),
    orbAlong(add(top, [0, 0.02, 0.04]), [0, 0.2, 1], [0.04, 0.04, 0.07], 5, 3, 'moss'),
  );
}

/* ---- leaves on it --------------------------------------------------------------------------- */

/** The leaves on its head: a two-leaf sprout on the Lemlet, a sprig on the Lemleaf, a spray on the Lemorian; with a flower on the last. */
function sprigOf(s: Lemur, K: number): Fronds {
  const C = s.head.c, R = s.head.r, [count, L] = s.sprig;
  const top = onEgg(C, R, [0, -0.15, 1]).p;
  const out: Frond[] = [];
  // The stem out of the crown, a little back.
  const stemTop = add(top, [0, -0.02, L * 0.36]);
  out.push({ mesh: tube(curve(add(top, [0, 0, -0.06]), add(top, [0, 0.03, L * 0.2]), stemTop, 2), 0.035, 0.035, 4, 'stem'), out: [0, 0, 1] });
  for (let q = 0; q < count; q++) {
    const f = count > 1 ? q / (count - 1) - 0.5 : 0, id = 40 + q + s.stage * 10;
    const side = q % 2 ? -1 : 1;
    // Two leaves out of the stem's top in a V; more fanned round it on the bigger, the outer ones lower and longer.
    const dir = unit([count <= 2 ? side * 0.74 : f * 2.2, count <= 2 ? -0.55 * side : -0.35 + 0.25 * jitter(id), count <= 2 ? 0.62 : 1 - 0.5 * Math.abs(f)]);
    const root = count <= 2 ? stemTop : add(top, [f * R[0] * 0.5, -0.1 - 0.05 * Math.abs(f), L * 0.1 * (1 - Math.abs(f))]);
    const len = L * (count <= 2 ? 1 : 0.8 + 0.4 * (0.5 - Math.abs(f)) + 0.15 * jitter(id + 3));
    // Their faces turned up and forward on the sprout, and out to either side, by turns, on a sprig, so some show from any side.
    const face: V3 = count <= 2 ? [0, 0.35, 1] : [(q % 2 ? 0.8 : -0.8) + f, 0.6, 0.4];
    out.push({ mesh: leaf(root, dir, face, len, len * (count <= 2 ? 0.56 : 0.42), K, count <= 2 ? TONES[q % 2] : toneOf(id, 0.45), 0.12), out: [0, -0.3, 1] });
  }
  if (s.stage === 2) {
    const at = onEgg(C, R, [-0.5, 0.0, 0.85]);
    out.push({ mesh: flower(add(at.p, scale(at.n, 0.08)), add(at.n, [0, 0.5, 0.2]), 0.2, 0.5), out: at.n, bloom: true });
  }
  return fronds(out);
}

/** A run of vine: where it is `u` of the way along it, on the body, and the way out of the body there; and how many of its leaves it has. */
interface Strand { at: (u: number) => { p: V3; n: V3 }; share: number }

/** A run of vine over the barrel through points on it as (along the body, round it from the right side, up positive), `off` off it. */
function overBody(s: Lemur, path: Array<[number, number]>, off: number, share: number): Strand {
  return {
    share,
    at: (u) => {
      const f = clamp(u) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), k = f - i;
      const q = onRings(s.body, lerp(path[i][0], path[i + 1][0], k), lerp(path[i][1], path[i + 1][1], k));
      return { p: add(q.p, scale(q.n, off)), n: q.n };
    },
  };
}

/**
 * A run of vine round the root of the neck, in the body's frame: from `from` to `to` radians round it from the right side (up
 * positive), `t` up the neck, sagging toward the chest at the sides.
 */
function roundNeck(s: Lemur, t: number, from: number, to: number, share: number): Strand {
  const N = s.neck, lean = N.lean * DEG, A: V3 = [0, Math.sin(lean), Math.cos(lean)], v = cross(A, [1, 0, 0]);
  return {
    share,
    at: (u) => {
      const th = lerp(from, to, clamp(u)), side = Math.abs(Math.cos(th));
      const n = unit(add(scale([1, 0, 0], Math.cos(th)), scale(v, -Math.sin(th))));
      const r = N.w * (1.15 + 0.25 * side);
      return { p: add(add(add(N.at, scale(A, t - 0.12 * side)), scale(n, r)), [0, 0.06 * side, 0]), n: unit(add(n, [0, 0, 0.25])) };
    },
  };
}

/** Where the vines go: round the Lemleaf's neck and shoulders; round the Lemorian's neck, and over its shoulders down its back to the far hip. */
function strandsOf(s: Lemur): Strand[] {
  const B = s.body, y = B.y[5];
  if (s.stage === 1) {
    return [
      roundNeck(s, 0.0, 0.35, Math.PI - 0.35, 0.35),
      overBody(s, [[y - 0.2, -0.3], [y - 0.36, 0.55], [y - 0.46, Math.PI / 2], [y - 0.36, Math.PI - 0.55], [y - 0.2, Math.PI + 0.3]], 0.05, 0.65),
    ];
  }
  return [
    // A thick collar round the root of the neck, over the withers and down in front of each shoulder.
    roundNeck(s, 0.1, -0.5, Math.PI + 0.5, 0.42),
    overBody(s, [[y + 0.04, -0.2], [y - 0.2, 0.55], [y - 0.32, Math.PI / 2], [y - 0.2, Math.PI - 0.55], [y + 0.04, Math.PI + 0.2]], 0.06, 0.36),
    // From the near shoulder (the right, which is the side it shows walking to the viewer's right) back over the top of the back
    // and down the far flank to the hip.
    overBody(s, [[y - 0.3, 0.3], [y - 0.6, 0.9], [B.y[3] - 0.1, Math.PI / 2 - 0.05], [B.y[2], Math.PI - 0.75], [B.y[1] + 0.15, Math.PI - 0.25]], 0.06, 0.34),
  ];
}

/**
 * The leafy vines over its shoulders: the Lemleaf's one draped over its
 * withers and hanging down either side, the Lemorian's a garland round its
 * neck and over its shoulders and back; each a stem with leaves off it
 * every way, standing out from the body and hanging, and white flowers in
 * it; in the body's frame.
 */
function vinesOf(s: Lemur, K: number): Fronds {
  const out: Frond[] = [];
  const [count, flowers] = s.stage === 1 ? s.vine : [s.garland[0], 6];
  const L = s.stage === 1 ? s.vine[2] : s.garland[1];
  const strands = strandsOf(s);
  strands.forEach((st, sq) => {
    const N = 12;
    const pts = Array.from({ length: N + 1 }, (_, q) => st.at(q / N));
    out.push({ mesh: tube(pts.map((x) => x.p), 0.04, 0.04, 4, 'bark'), out: [0, 0, 1] });
    const many = Math.round(count * st.share);
    for (let q = 0; q < many; q++) {
      const id = 70 + sq * 50 + q, u = (q + 0.3 + 0.4 * jitter(id)) / many;
      const { p, n } = st.at(u);
      const along = unit(sub(st.at(Math.min(1, u + 0.04)).p, st.at(Math.max(0, u - 0.04)).p));
      // By turns forward along the vine and back along it, each standing out from the body, the ones low on the sides drooping;
      // lying back over it like shingles, their faces turned out from it, so they show from outside and not edge on.
      const way = q % 3 === 0 ? 0 : q % 3 === 1 ? 1 : -1, top = clamp(n[2]), across = unit(cross(n, along));
      // Fanned out from the vine every way round it, as a wreath's leaves are, rather than laid flat along it.
      const fan = (jitter(id + 9) - 0.5) * 1.6;
      const dir = unit(add(add(add(add(scale(n, 1.0 + 0.3 * jitter(id + 1)), scale(along, way * 0.6)), scale(across, fan)), [0, -0.3, 0]), [0, 0, (0.3 - 0.45 * (1 - top)) * (0.6 + 0.6 * jitter(id + 4))]));
      const len = L * (0.78 + 0.4 * jitter(id + 2));
      const face = unit(add(add(n, [0, 0, 0.3]), scale(across, -0.8 * fan + 0.4 * (jitter(id + 6) - 0.5))));
      out.push({ mesh: leaf(add(p, scale(n, 0.02)), dir, face, len, len * 0.48, K, toneOf(id, 0.35), 0.16), out: n });
    }
  });
  // White flowers: on the Lemleaf one at the near shoulder; on the Lemorian along its garland.
  const spots: Array<[number, number]> = s.stage === 1 ? [[1, 0.22]] : [[0, 0.16], [0, 0.6], [1, 0.12], [1, 0.84], [2, 0.3], [2, 0.66]];
  spots.slice(0, flowers).forEach(([sq, u], q) => {
    const { p, n } = strands[sq].at(u);
    out.push({ mesh: flower(add(p, scale(n, L * 0.32)), add(n, [0, 0.3, 0.35]), s.stage === 1 ? 0.24 : 0.22, q * 0.9), out: n, bloom: true });
  });
  return fronds(out);
}

/** The cream ruff at the front of its chest: an egg of fur and tufts from it out and down; in the neck's frame at its root. */
function ruffOf(s: Lemur, n: number, k: number): Mesh {
  const R = s.ruff, B = s.body, out: Mesh[] = [];
  const c: V3 = [0, B.y[6] - R * 0.3, B.z[6] - B.h[5] * 0.2];
  out.push(egg(c, frameOf([0, 0.35, 1], [0, 1, 0]), [B.w[5] * 0.8, R * 0.62, B.h[5] * 0.85], n, k, 'mark'));
  // Tufts of it down the front and out at the sides, a few broad points.
  for (const [f, len] of [[-0.32, 0.6], [0, 0.75], [0.32, 0.6]] as Array<[number, number]>) {
    const root: V3 = add(c, [f * B.w[5] * 1.2, R * 0.35, -B.h[5] * 0.45]);
    out.push(tuft(root, [f * 0.8, 0.45, -1], R * len, R * 0.28, 'mark', 5));
  }
  return merge(...out);
}

/** Its haunches, round and furred, part of the barrel over each hind leg; and a tuft at the back of each. */
function haunchesOf(s: Lemur, n: number, k: number): Mesh {
  const out: Mesh[] = [];
  const H = s.hind, B = s.body;
  for (const sd of [1, -1]) {
    const c: V3 = [sd * (H.at[0] + H.w[0] * 0.15), H.at[1] - H.w[0] * 0.1, H.at[2] + H.w[0] * 0.55];
    out.push(egg(c, frameOf([0, -0.35, 1], [0, 1, 0]), [H.w[0] * 1.05, H.w[0] * 1.5, B.h[2] * 0.62], n, k, 'coat'));
    out.push(tuft(add(c, [sd * H.w[0] * 0.5, -H.w[0] * 1.1, -B.h[2] * 0.3]), [sd * 0.3, -1, -0.8], H.w[0] * 0.75, H.w[0] * 0.42, 'coat', 5));
    // A cream fringe along the belly each side, longer toward the chest, swept back.
    for (let q = 0; q < 4; q++) {
      const y = lerp(B.y[2], B.y[5], q / 3), at = onRings(B, y, sd > 0 ? -1.05 : Math.PI + 1.05);
      out.push(tuft(add(at.p, scale(at.n, -0.03)), add(scale(at.n, 0.25), [0, -0.85, -0.45]), B.h[3] * (0.26 + 0.07 * q), B.h[3] * 0.15, 'mark', 4));
    }
  }
  return merge(...out);
}

/* ---- the pieces ---------------------------------------------------------------------------- */

/** A stage's pieces: a body on four legs (`quadPieces`) with its own head, ears, hands, tail, ruff and leaves. */
function lemurBuild(s: Lemur, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), K = lod ? 5 : 3, fine = lod > 0;
  const F = s.fore, H = s.hind;
  const sprig = sprigOf(s, K);
  const pieces = quadPieces({
    n, k,
    body: { ...s.body, belly: true },
    neck: { w: s.neck.w, h: s.neck.w * 0.95, len: s.neck.len },
    // The head is its own (`headOf`): this egg is only where it stands for the ears to go behind.
    head: { c: s.head.c, r: s.head.r, eye: { dir: s.eye.dir, size: 0.01 } },
    ear: earOf(s, n),
    earTurn: 36,
    tail: tailLinks(s, n),
    fore: { upper: [0.2, -F.len[0], F.w[0], F.w[1] * 1.15], lower: [0, -F.len[1], F.w[1], F.w[2]], foot: handOf(s, F.len[2], n, k, fine, false) },
    hind: { upper: [0.24, -H.len[0], H.w[0], H.w[1] * 1.2], lower: [0, -H.len[1], H.w[1], H.w[2]], foot: handOf(s, H.len[2], n, k, fine, true) },
    breath: 0.04,
    extras: [
      { key: 'sprig', mesh: sprig.mesh, bone: 'head', bias: 0.23, after: ['head', 'ear0', 'ear1'], hide: headSolids(s), thin: true, bent: stirring(sprig, s.sprig[1], 0.3) },
      { key: 'ruff', mesh: ruffOf(s, n, k), bone: 'trunk', bias: 0.1, after: ['body', 'neck'], front: [0, 1, 0], lines: false },
      { key: 'sprout', mesh: sproutOf(s, K), bone: 'fr2', bias: 0.05, after: ['fr2', 'fr1', 'head'], thin: true, shown: (a) => a.act?.kind === 'work' && a.act.t > LEMUR_PICK.snap - 0.01 && a.act.t < LEMUR_PICK.taken },
    ],
  });
  if (s.stage > 0) {
    const v = vinesOf(s, K);
    pieces.push({ key: 'vine', mesh: v.mesh, bone: 'trunk', bias: 0.12, after: ['body', 'neck', 'ruff'], thin: true, bent: stirring(v, s.stage === 1 ? s.vine[2] : s.garland[1], 0.6) });
  }
  // Its own head, the lower legs and hands dark, and fur on its haunches.
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s), lines: false };
    if (pc.key === 'ear0' || pc.key === 'ear1') return { ...pc, lines: false };
    if (pc.key === 'body') return { ...pc, mesh: merge(pc.mesh, haunchesOf(s, n, k)) };
    if (/^(fl|fr|hl|hr)1$/.test(pc.key)) return { ...pc, mesh: { ...pc.mesh, f: pc.mesh.f.map((f) => ({ ...f, m: 'coatDark' as Mat })) } };
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const LEAF: RGB = [104, 146, 44];
const LEAF_YOUNG: RGB = [158, 176, 52];
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

/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** Where something let fall from `p` drifts to `s` seconds on, fluttering down. */
const drifting = (p: V3, s: number, id: number): V3 => [p[0] + 0.5 * Math.sin(s * 5 + id), p[1] + 0.3 * s * (jitter(id) - 0.3), Math.max(0.02, p[2] - 1.6 * s)];

/** The swipe's rake: three pale streaks along the path the paw took as it came down, fading. */
function rakeStreaks(g: CanvasRenderingContext2D, view: View, path: V3[], mid: V3, t: number, front: boolean): void {
  // Over the body where the paw is on the viewer's side of it, under it from behind.
  if (nearSide(path[2], mid, view) !== front) return;
  const al = hump(t, LEMUR_SWIPE.hit + 0.04, 0.16);
  if (al <= 0) return;
  const pts = path.map((p) => onScreen(view, p));
  const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
  // Drawn out past both ends of the path, and as wide and as far apart as the path is long, so they read at any size.
  const long = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / long, ny = (x1 - x0) / long, gap = long * 0.16;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, out = 1.25;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [w, c, k] of [[long * 0.13, [70, 52, 48] as RGB, 0.4], [long * 0.07, [255, 250, 236] as RGB, 0.95]] as const) {
    for (let q = -1; q <= 1; q++) {
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const ox = mx + (x - mx) * out + nx * gap * q, oy = my + (y - my) * out + ny * gap * q;
        if (i) g.lineTo(ox, oy);
        else g.moveTo(ox, oy);
      });
      g.lineWidth = w * (1 - 0.25 * Math.abs(q));
      g.strokeStyle = css(c, k * al);
      g.stroke();
    }
  }
  g.restore();
}

/** The snap of a sprout coming off: two leaves shaken loose from up where the paw is, fluttering down. */
function pickLeaves(g: CanvasRenderingContext2D, view: View, s: Lemur, at: V3, mid: V3, t: number, front: boolean): void {
  const since = (t - LEMUR_PICK.snap) * ACT_SECS.work;
  if (since <= 0 || since > 0.9) return;
  const fade = 1 - smooth(since / 0.9), big = 0.32 + 0.08 * s.stage;
  for (let q = 0; q < 2; q++) {
    const p = drifting(add(at, [q ? 0.15 : -0.1, 0, 0.1]), since, q * 7 + 3);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    flyingLeaf(g, x, y, big, q * 2 + since * 6 * (q ? 1 : -1), q ? LEAF_YOUNG : LEAF, fade);
  }
}

/** Evolving: leaves and petals going up round it in a spiral, wider at the foot and gathering in as they rise. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Lemur, b: Bones, t: number, front: boolean): void {
  const mid: V3 = [0, 0, b.body.t[2]];
  const fade = ramp(t, 0.05, 0.2) * (1 - ramp(t, 0.75, 1));
  const tall = (s.hind.len[0] + s.hind.len[1]) * 2.4, wide = (s.body.y[6] - s.body.y[0]) * 0.7;
  for (let q = 0; q < 14; q++) {
    const rise = frac(t * 1.2 + q / 14), ang = (q / 14) * TAU * 3 + t * TAU * 1.4, r = wide * (1 - 0.45 * rise);
    const p: V3 = [Math.cos(ang) * r * 0.75, Math.sin(ang) * r, rise * tall];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    flyingLeaf(g, x, y, 0.4 + 0.1 * s.stage, ang * 1.5 + rise * 4, q % 3 ? LEAF : LEAF_YOUNG, fade * Math.sin(rise * Math.PI));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, picks and evolves. */
function lemurKind(s: Lemur): Kind {
  const bones = lemurBones(s);
  // Where its paw goes down through the rake, for the streaks it leaves; and where it is as the sprout snaps off, at a go played
  // once and at one of a run of them, for the leaves shaken loose there. Worked out once, standing.
  const still: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
  const paw = (a: Anim): V3 => place(bones(a).fr2, [0, s.hand.r, 0.1]);
  const rakePath = [0.3, 0.34, 0.38, 0.42, 0.46].map((t) => paw({ ...still, act: { kind: 'strike', t } }));
  const snapAt = [0, 1].map((graze) => paw({ ...still, graze, act: { kind: 'work', t: LEMUR_PICK.snap } }));
  return {
    bones,
    build: (lod) => lemurBuild(s, lod),
    // The variant's coat is its fur's grey-brown and its markings the cream of its face, chest and tail rings; the dark of its
    // masks, its limbs and its rings follows from the coat; its amber eyes, black nose, leaves and flowers its own.
    palette: (coat, mark) => {
      const fur = mix(coat, [255, 248, 240], 0.04), cream = mix(mark, [255, 252, 244], 0.2);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(coat, [40, 30, 34], 0.2),
        coatLight: mix(fur, [255, 248, 236], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 255, 250], 0.4),
        inner: mix(cream, [226, 172, 142], 0.42),
        feather: mix(cream, coat, 0.14),
        featherDark: mix(coat, [56, 42, 44], 0.3),
        lid: mix(coat, [34, 24, 28], 0.62),
        nose: [42, 32, 36],
        eye: [44, 26, 22],
        glint: [255, 253, 246],
        crystal: [236, 166, 52],
        crystalDark: [190, 112, 36],
        pad: mix(coat, [40, 30, 34], 0.38),
        leaf: LEAF,
        stem: [86, 124, 38],
        leafDark: [74, 104, 38],
        moss: LEAF_YOUNG,
        bark: [124, 92, 66],
        petal: [253, 250, 242],
        bloom: [244, 200, 80],
      });
    },
    shadow: [(s.body.y[6] - s.body.y[0]) * 0.62, s.body.w[3] * 1.1],
    stride: 1.3,
    size: s.size,
    leaps: [false, true],
    acts: ['strike', 'work'],
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike' && act.t > LEMUR_SWIPE.wind) {
        rakeStreaks(g, view, rakePath, b.body.t, act.t, front);
      } else if (act.kind === 'work') {
        pickLeaves(g, view, s, snapAt[a.graze > 0.5 ? 1 : 0], b.body.t, act.t, front);
      } else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const LEMLET = lemurKind(LEMLET_LOOK);
export const LEMLEAF = lemurKind(LEMLEAF_LOOK);
export const LEMORIAN = lemurKind(LEMORIAN_LOOK);
