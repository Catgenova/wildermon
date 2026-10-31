import {
  ACT_SECS, add, beat, clamp, moved, coatPalette, cross, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, shadowOf, smile, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The shearling line: the Shearling, a small round kit on four short legs in
 * a thick cream fleece of clumped curls, a collar and patches of sage-green
 * leaf-feathers, long upright hare's ears feathered green, cream and brown at
 * the tip, a small cream face with brown eyes and a pink-brown nose, dark
 * hooves and a puff of a tail; which grows into the Clipperoo, up on long
 * hind legs as a kangaroo stands, big dark hind feet, short dark forepaws
 * held at its chest, a long neck with a mane of green feathers, long ears
 * swept back, its fleece heaviest on its hips and belly and a long fleeced
 * tail ending in a plume of green and brown feathers; and then the
 * Shearlord, tall and heavy, upright on powerful hind legs, a huge fleece
 * over its chest, belly and haunches, a long green mane down its neck and
 * back, very long swept-back ears, dark forepaws at its chest and a great
 * tail plumed in green feathers. The species is still `sheela` underneath,
 * as saves and the database know it: it milks and shears.
 *
 * Each is its variant's coat for its leaf-feathers and its markings for its
 * fleece and face; its hooves, feet, paws, eyes and the brown of its feather
 * tips are the same on every variant. All three are built by one set of
 * functions from a description of the stage (`Roo`), the way the calico line
 * is (`./wild-calico`): its legs bent to put each foot where it is to be, its
 * forelegs bent to put each paw where it is to be, in the chest's frame or on
 * the ground. The Shearling stands on all four, its chest bent down level
 * with its hips and its fore hooves on the ground, and trots; the bigger two
 * stand up on their hind legs and hop, both feet together, their tails
 * thrown up behind them.
 *
 * At its task it shears what stands in front of it: the Shearling rears up
 * onto its hind legs, the bigger two lean in, and the forepaws snip four
 * times, tufts of fleece flying; it gathers the clip in both paws, hugs it to
 * its chest, and it is gone into the stores (`SHEAR_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Roo {
  stage: 0 | 1 | 2;
  /** On all four standing: its fore hooves on the ground, where they stand out and ahead of the hips. */
  quad: { stance: number; ahead: number } | null;
  /**
   * The hip on the right in the hips' frame; thigh and shin; how thick each; how high the ankle stands over the ground; the
   * foot's length (heel to toe, along the ground) and width; how far out each foot stands, and how far ahead of the hip.
   */
  leg: { at: V3; len: [number, number]; w: [number, number]; heel: number; foot: [number, number]; stance: number; ahead: number };
  /** How high the hips are carried standing. */
  high: number;
  /** The haunches and seat, an egg in the hips' frame: its fleece. */
  hips: { c: V3; r: V3 };
  /** The chest's joint on the hips, and how far it is bent forward standing (degrees). */
  chest: V3;
  lean: number;
  /** How far the whole body is pitched forward over its legs standing (degrees). */
  tilt: number;
  /** The torso's rings in the chest's frame, bottom to top: how high, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** The shoulder on the right in the chest's frame; upper arm and forearm; how thick each; the paw's size; which way the elbow goes. */
  shoulder: V3;
  arm: [number, number];
  armW: [number, number];
  hand: number;
  elbow: V3;
  /** The neck's root on the chest, its length and girth at root and top, and how far back it is bent from the chest's line standing. */
  neck: { at: V3; len: number; w: [number, number]; bend: number };
  /** The skull's half-sizes, how far its middle is over the top of the neck, how far forward, and how nose-up it is carried. */
  head: { r: V3; up: number; fwd: number; pitch: number };
  /** The muzzle: its half-sizes, and how far forward and down of the skull's middle. */
  snout: { r: V3; at: V3 };
  eye: { dir: V3; size: number };
  /** The ears: length and width, the way out of the skull to the right one's root, and how far they are swept back (degrees). */
  ear: { len: number; w: number; dir: V3; back: number; out: number; fan: number; face: number };
  /** The tail: its root on the hips, each link's length, its girth at each joint, how far each link bends up, and the plume's length. */
  tail: { at: V3; links: number[]; w: number[]; bend: number[]; plume: number };
  /** How big a clump of its fleece's curls is (its radius). */
  curl: { size: number };
  /** The leaf-feathers: how long and wide one is, the mane's rows on the neck, and how far down the back the cape comes (a share of the torso). */
  feather: { len: number; w: number; mane: number; cape: number };
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted at a trot; how high a hop lifts it at a walk and a run, and how far its feet tuck. */
    step: number; hop: [number, number]; tuck: number;
  };
  size: number;
}

/** A Shearling: small and round on four short legs, a big fleece, a neat green collar, tall ears in a V. */
const SHEARLING_LOOK: Roo = {
  stage: 0,
  quad: { stance: 0.18, ahead: 0.5 },
  leg: { at: [0.2, -0.04, -0.06], len: [0.15, 0.15], w: [0.13, 0.075], heel: 0.07, foot: [0.1, 0.075], stance: 0.19, ahead: -0.08 },
  high: 0.34,
  hips: { c: [0, -0.08, 0.14], r: [0.37, 0.42, 0.27] },
  chest: [0, 0.04, 0.12],
  lean: 84,
  tilt: 0,
  torso: { z: [-0.06, 0.16, 0.36, 0.5, 0.58], y: [0.0, 0.02, 0.03, 0.0, -0.03], w: [0.37, 0.38, 0.35, 0.28, 0.19], h: [0.28, 0.29, 0.28, 0.23, 0.16] },
  shoulder: [0.17, 0.16, 0.42],
  arm: [0.14, 0.14], armW: [0.075, 0.062], hand: 0.065,
  elbow: [0.15, -0.1, -1],
  neck: { at: [0, -0.1, 0.46], len: 0.2, w: [0.19, 0.16], bend: 74 },
  head: { r: [0.22, 0.225, 0.215], up: 0.15, fwd: 0.03, pitch: 6 },
  snout: { r: [0.08, 0.11, 0.072], at: [0, 0.185, -0.07] },
  eye: { dir: [0.52, 0.72, 0.17], size: 0.05 },
  ear: { len: 0.6, w: 0.19, dir: [0.42, -0.22, 0.88], back: 14, out: 24, fan: 0, face: 0.25 },
  tail: { at: [0, -0.46, 0.22], links: [0.08, 0.07], w: [0.1, 0.13, 0.07], bend: [30, 20], plume: 0 },
  curl: { size: 0.072 },
  feather: { len: 0.12, w: 0.05, mane: 2, cape: 0 },
  gait: { duty: [0.6, 0.42], swing: [0.55, 0.6], step: 0.5, hop: [0, 0], tuck: 0 },
  size: 3.7,
};

/**
 * A Clipperoo: up as a kangaroo stands -- a pear of a torso over a huge rounded thigh each side, a long shin angled forward down
 * to a long dark foot flat on the ground, a thick tail going down and back to the ground behind it, a slim neck and a hare's head.
 */
const CLIPPEROO_LOOK: Roo = {
  stage: 1,
  quad: null,
  leg: { at: [0.22, 0.02, -0.02], len: [0.36, 0.42], w: [0.27, 0.068], heel: 0.08, foot: [0.5, 0.12], stance: 0.2, ahead: 0.08 },
  high: 0.8,
  hips: { c: [0, -0.08, 0.1], r: [0.22, 0.27, 0.26] },
  chest: [0, 0.06, 0.22],
  lean: 36,
  tilt: 0,
  torso: { z: [-0.16, 0.05, 0.25, 0.42, 0.52], y: [0.1, 0.11, 0.07, 0.03, 0], w: [0.22, 0.26, 0.23, 0.16, 0.12], h: [0.27, 0.3, 0.25, 0.17, 0.12] },
  shoulder: [0.14, 0.08, 0.38],
  arm: [0.18, 0.22], armW: [0.065, 0.055], hand: 0.065,
  elbow: [0.7, -0.4, -0.6],
  neck: { at: [0, 0.02, 0.48], len: 0.3, w: [0.13, 0.095], bend: 24 },
  head: { r: [0.135, 0.2, 0.14], up: 0.08, fwd: 0.03, pitch: 4 },
  snout: { r: [0.072, 0.14, 0.066], at: [0, 0.18, -0.055] },
  eye: { dir: [0.62, 0.6, 0.32], size: 0.04 },
  ear: { len: 0.85, w: 0.12, dir: [0.4, -0.35, 0.85], back: 72, out: 30, fan: 0, face: 0.85 },
  tail: { at: [0, -0.26, -0.2], links: [0.2, 0.2, 0.2, 0.18, 0.16], w: [0.12, 0.135, 0.125, 0.105, 0.085, 0.065], bend: [-64, 5, 30, 26, 16], plume: 0.42 },
  curl: { size: 0.05 },
  feather: { len: 0.14, w: 0.045, mane: 7, cape: 0.72 },
  gait: { duty: [0.42, 0.34], swing: [0.45, 0.55], step: 0.4, hop: [0.55, 0.8], tuck: 0.5 },
  size: 3.3,
};

/** A Shearlord: the same, tall and heavy: a huge fleece over chest, belly and thighs, a long mane, very long ears, a great plumed tail. */
const SHEARLORD_LOOK: Roo = {
  stage: 2,
  quad: null,
  leg: { at: [0.29, 0.02, -0.02], len: [0.45, 0.52], w: [0.36, 0.088], heel: 0.1, foot: [0.62, 0.15], stance: 0.26, ahead: 0.1 },
  high: 0.98,
  hips: { c: [0, -0.1, 0.12], r: [0.3, 0.36, 0.34] },
  chest: [0, 0.08, 0.28],
  lean: 34,
  tilt: 0,
  torso: { z: [-0.2, 0.06, 0.32, 0.54, 0.66], y: [0.12, 0.15, 0.1, 0.04, 0], w: [0.3, 0.36, 0.33, 0.22, 0.16], h: [0.37, 0.42, 0.35, 0.24, 0.16] },
  shoulder: [0.2, 0.1, 0.5],
  arm: [0.24, 0.28], armW: [0.088, 0.074], hand: 0.088,
  elbow: [0.7, -0.4, -0.6],
  neck: { at: [0, 0.02, 0.62], len: 0.4, w: [0.18, 0.13], bend: 22 },
  head: { r: [0.16, 0.235, 0.165], up: 0.1, fwd: 0.04, pitch: 5 },
  snout: { r: [0.085, 0.17, 0.078], at: [0, 0.21, -0.065] },
  eye: { dir: [0.62, 0.6, 0.32], size: 0.047 },
  ear: { len: 1.2, w: 0.16, dir: [0.4, -0.38, 0.84], back: 76, out: 28, fan: 0, face: 0.85 },
  tail: { at: [0, -0.34, -0.24], links: [0.25, 0.25, 0.24, 0.22, 0.2], w: [0.17, 0.19, 0.18, 0.15, 0.12, 0.09], bend: [-64, 5, 30, 25, 15], plume: 0.85 },
  curl: { size: 0.062 },
  feather: { len: 0.2, w: 0.06, mane: 9, cape: 0.78 },
  gait: { duty: [0.44, 0.36], swing: [0.42, 0.5], step: 0.35, hop: [0.42, 0.64], tuck: 0.42 },
  size: 3.6,
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
/** `b` (in the frame of `a`) followed on from `a`. */
function compose(a: Xf, b: Xf): Xf {
  const cols = [0, 1, 2].map((j) => turn(a, [b.m[j], b.m[3 + j], b.m[6 + j]]));
  return xfOf(cols[0], cols[1], cols[2], place(a, b.t));
}
/** A frame made `k` times bigger, nought for a thing not there. */
const scaled = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k), m = x.m; return { m: [m[0] * q, m[1] * q, m[2] * q, m[3] * q, m[4] * q, m[5] * q, m[6] * q, m[7] * q, m[8] * q], t: x.t }; };
/** An egg with its axes along a frame: anything round that leans or points. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
}
const UPRIGHT: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** A mesh with each face given its stuff by where its middle is. */
function painted(m: Mesh, by: (c: V3, was: Mat) => Mat): Mesh {
  return mesh(m.v, m.f.map((f) => {
    const c: V3 = [0, 0, 0];
    for (const i of f.i) { c[0] += m.v[i][0] / f.i.length; c[1] += m.v[i][1] / f.i.length; c[2] += m.v[i][2] / f.i.length; }
    return { ...f, m: by(c, f.m) };
  }));
}

/** Where the torso is at height `z` in the chest's frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Roo, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/** A point on the torso's skin at height `z`, `a` radians round from its right side (a quarter turn is its front), lifted `out` off it. */
function onTorso(s: Roo, z: number, a: number, out = 0): { p: V3; n: V3 } {
  const r = torsoAt(s, z), n = unit([Math.cos(a) * r.h, Math.sin(a) * r.w, 0]);
  return { p: add([Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z], scale(n, out)), n };
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Shearling's butt, the bigger two's double kick. */
export const SHEAR_HITS: readonly number[] = [0.5, 0.52, 0.55];
/**
 * A go at its task, as shares of it: reared or leaned in to what is in front of it (`reach`), the four snips of its forepaws
 * (`snips`), the clip gathered up in both (`gather`), hugged to its chest (`hug`) and gone into the stores (`gone`).
 */
export const SHEAR_WORK = { reach: 0.14, snips: [0.26, 0.36, 0.46, 0.56] as const, gather: 0.66, hug: 0.78, gone: 0.9 } as const;

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
  /** Each fore hoof's pitch, for the Shearling. */
  hoof: number[];
  /** The tail lifted, swung to the left and curled past how it is carried. */
  tail: V3;
  /** Each ear laid back, left then right. */
  ears: number[];
  /** How much of the clip is in its paws, and how far it is hugged in. */
  held: number; hug: number;
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
  /** Where its paws rest, left then right, in the chest's frame; and the Shearling's fore hooves on the ground. */
  paws: V3[];
  hooves: V3[];
}

const rests = new Map<Roo, Rest>();
function restOf(s: Roo): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.heel] as V3);
  const A = s.arm[0] + s.arm[1];
  // Held at its chest, curled: in front of the torso a little under the shoulders, close together.
  const paws: V3[] = [-1, 1].map((sd) => [sd * s.shoulder[0] * 0.55, s.shoulder[1] + A * 0.5, s.shoulder[2] - A * 0.72] as V3);
  const hooves: V3[] = s.quad ? [-1, 1].map((sd) => [sd * s.quad!.stance, s.quad!.ahead, L.heel] as V3) : [];
  const R: Rest = { ankle, reach: L.len[0] + L.len[1], paws, hooves };
  rests.set(s, R);
  return R;
}

function restPlan(s: Roo, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: -s.tilt, roll: 0, yaw: 0, squash: 0,
    chest: [s.lean, 0, 0], neck: [-s.neck.bend, 0], head: [0, 0, 0],
    hand: R.paws.map((h) => [...h] as V3), ground: s.quad ? R.hooves.map((h) => [...h] as V3) : R.paws.map(() => [0, 0, 0] as V3), on: s.quad ? [1, 1] : [0, 0],
    hoof: [0, 0],
    tail: [0, 0, 0], ears: [0, 0],
    held: 0, hug: 0,
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.1;

/** A foot through a stride from where it stands at `A`: down and swept back for `duty` of it, then lifted and brought forward. */
function stepped(A: V3, ph: number, duty: number, half: number, lift: number): { at: V3; air: number } {
  if (ph < duty) return { at: [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]], air: 0 };
  const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
  const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
  const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
  return { at: [A[0], y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)], air: u };
}

/**
 * Going, for the Shearling: a trot, each hind foot with the fore hoof across from it, the body bobbing at each footfall, the head
 * held steadier than the body, the ears bouncing and the tail flicking.
 */
function trotPlan(s: Roo, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = R.reach, half = L * amp, lift = G.step * L * (1 + 0.4 * g);
  for (let i = 0; i < 2; i++) {
    const hind = stepped(R.ankle[i], frac(w + i * 0.5), duty, half, lift);
    p.at[i] = hind.at;
    p.foot[i] = -20 * Math.sin(Math.PI * clamp(hind.air * 1.6)) * (1 - hind.air);
    const fore = stepped(R.hooves[i], frac(w + i * 0.5 + 0.5), duty, half, lift * 1.1);
    p.ground[i] = fore.at;
    p.hoof[i] = -30 * Math.sin(Math.PI * clamp(fore.air * 1.4)) * (1 - fore.air);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.1));
  p.H += -0.05 * L * (down - 0.5) * 2 + g * 0.08 * L * Math.max(0, Math.sin(2 * TAU * (w + 0.15)));
  p.roll = 3 * Math.sin(TAU * w);
  p.pitch += 2 * Math.sin(2 * TAU * (w - 0.05));
  p.head = [-2 * Math.sin(2 * TAU * (w - 0.05)) - 2 * (down - 0.5), 0, -p.roll * 0.5];
  p.tail = [10 * Math.sin(2 * TAU * (w - 0.2)), 10 * Math.sin(TAU * w), 0];
  p.ears = [0.3 * g + 0.15 * down, 0.3 * g + 0.15 * down];
  return p;
}

/**
 * Going, for the bigger two: in hops, both feet together, the right a beat behind the left. Down, the feet sweep back under it as
 * it crouches and pushes off; in the air they are tucked up and brought forward, the body pitched forward going up and back
 * coming down; the tail thrown up behind it as it rises and down as it lands, a beat behind; the ears laid back; the paws held in.
 */
function hopPlan(s: Roo, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = R.reach, half = L * amp;
  let air = 0;
  for (let i = 0; i < 2; i++) {
    const A = R.ankle[i], ph = frac(w - i * 0.03);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      p.foot[i] = -34 * ramp(ph, duty * 0.5, duty);
      continue;
    }
    const u = (ph - duty) / (1 - duty);
    p.at[i] = [A[0], lerp(A[1] - half, A[1] + half, smooth(u)), A[2] + G.tuck * L * Math.sin(Math.PI * u) ** 0.8];
    p.foot[i] = -34 * (1 - ramp(u, 0, 0.4)) + 10 * hump(u, 0.8, 0.2);
    if (i === 0) air = u;
  }
  const down = w < duty ? Math.sin((Math.PI * w) / duty) : 0;
  const up = w >= duty ? Math.sin(Math.PI * air) : 0;
  const hop = lerp(G.hop[0], G.hop[1], g);
  p.H += L * (hop * up - 0.3 * down);
  p.squash = 0.06 * down - 0.04 * up;
  const rise = w >= duty ? Math.cos(Math.PI * air) : -1;
  p.pitch += -6 - 6 * g + 6 * down;
  p.chest = [s.lean + 12 + 8 * g + 6 * rise * up + 6 * down, 0, 0];
  p.head = [-2 - 4 * rise * up, 0, 0];
  p.neck = [-s.neck.bend - 6 - 4 * g, 0];
  const lag = Math.sin(TAU * (w - duty - 0.15));
  p.tail = [10 + 14 * lag + 6 * g, 3 * Math.sin(TAU * w), -6 * lag];
  p.ears = [0.5 + 0.3 * up + 0.2 * g, 0.5 + 0.3 * up + 0.2 * g];
  // The paws drawn in under its chin as it goes.
  p.hand = p.hand.map((h) => add(h, [0, -0.04, 0.04 * up])) as V3[];
  return p;
}

/**
 * Standing about: breathing, looking about, the weight shifting, now one ear turned back and now the other, the tail swaying;
 * now and then the bigger two rub their paws together, and the Shearling stamps a fore hoof.
 */
function stillPlan(s: Roo, R: Rest, a: Anim, quiet = false): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  const sway = cyc(t, 3);
  p.chest = [s.lean + 1.5 * (a.breath - 0.5), 5 * look * 0.3, 1.5 * sway];
  p.roll = -1.5 * sway;
  p.side = 0.02 * s.leg.len[0] * sway;
  p.neck = [-s.neck.bend + 3 * cyc(t, 2), 9 * look];
  p.head = [3 * cyc(t, 3), 10 * look, 6 * drift(t, 2)];
  p.H += 0.01 * R.reach * (a.breath - 0.5);
  p.tail = [4 * cyc(t, 3, 1), 10 * cyc(t, 4, 0.6) + 4 * drift(t, 4), 0];
  p.ears = [0.7 * beat(t, [2.6, 9.8, 18.4], 0.5), 0.7 * beat(t, [5.4, 14.1, 21.3], 0.5)];
  if (quiet) return p;
  if (s.quad) {
    // A fore hoof stamped now and then.
    const st = beat(t, [7.4, 19.2], 0.6);
    p.ground[1] = add(p.ground[1], [0, 0.03 * st, 0.08 * st * Math.sin(Math.min(1, st) * Math.PI)]);
  } else {
    // The paws rubbed together.
    const rub = beat(t, [7.2, 19.0], 1.8);
    p.hand = p.hand.map((h, i) => add(h, [(i ? -1 : 1) * 0.03 * rub, 0.02 * rub, 0.02 * rub * Math.sin(t * TAU * 2.6 + i * Math.PI)])) as V3[];
    p.head[0] -= 6 * rub;
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
 * A strike. The Shearling crouches, hops in and butts with its head down. The bigger two rock back onto their tails, draw up
 * both hind feet and kick out with them together, as a kangaroo does, their paws thrust forward with it.
 */
function strikePlan(s: Roo, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = SHEAR_HITS[s.stage], L = R.reach;
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.14, 0.96));
  const jolt = hump(t, hit + 0.02, 0.07);
  const since = (t - hit) * ACT_SECS.strike;
  if (s.quad) {
    const hop = hump(t, (0.36 + hit) / 2, (hit - 0.36) / 2 + 0.02);
    p.H += L * (-0.3 * wind + 0.8 * hop - 0.2 * jolt);
    p.surge = L * 0.8 * blow;
    p.pitch += 6 * wind - 8 * blow;
    p.head = [-18 * blow + 6 * wind, 0, 0];
    p.neck = [-s.neck.bend + 26 * blow - 8 * wind, 0];
    for (const i of [0, 1]) {
      p.at[i] = add(p.at[i], [0, L * 0.8 * blow * ramp(t, hit - 0.04, hit + 0.06), 0]);
      p.ground[i] = add(p.ground[i], [0, L * 0.8 * blow * ramp(t, hit - 0.08, hit + 0.02), 0.12 * L * hop]);
    }
    p.squash = 0.08 * jolt - 0.04 * hop;
    p.ears = [wind + blow * 0.8, wind + blow * 0.8];
    p.tail = [12 * wind + 10 * ringOut(since, 1.6, 3), 0, 0];
    return p;
  }
  // Back onto the tail, hips up, feet drawn up under it and kicked out forward together.
  const kick = ramp(t, 0.38, hit) * (1 - ramp(t, hit + 0.12, 0.9));
  const draw = ramp(t, 0.1, 0.36) * (1 - ramp(t, 0.38, hit));
  p.pitch += -14 * wind - 18 * kick;
  p.H += L * (0.12 * wind + 0.18 * kick);
  p.surge = -L * 0.1 * wind + L * 0.15 * kick;
  p.chest = [s.lean - 10 * wind - 4 * kick, 0, 0];
  for (let i = 0; i < 2; i++) {
    const A = R.ankle[i];
    p.at[i] = add(A, [0, L * (0.25 * draw + 0.95 * kick), L * (0.45 * draw + 0.45 * kick)]);
    p.foot[i] = 30 * draw - 10 * kick;
  }
  const S = s.shoulder, A = s.arm[0] + s.arm[1];
  p.hand = p.hand.map((h, i) => mixV(h, [(i ? 1 : -1) * S[0] * 0.8, S[1] + A * 0.95, S[2] - A * 0.1], kick)) as V3[];
  p.tail = [-24 * wind - 30 * kick, 0, 10 * ringOut(since, 1.4, 3)];
  p.ears = [wind + kick, wind + kick];
  p.head = [6 * wind - 6 * kick, 0, 0];
  p.squash = 0.05 * jolt;
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.9, 1)));

/**
 * A go at its task: the Shearling reared up onto its hind legs, the bigger two leaning in; both forepaws out in front of it at
 * the fleece, snipping four times, together and apart; the clip gathered up in both, drawn in and hugged to its chest, and gone
 * (`SHEAR_WORK`). Its head down at what it shears, and up, pleased, as it hugs the clip.
 */
function shearPlan(s: Roo, R: Rest, t: number, p: Plan): void {
  const W = SHEAR_WORK, S = s.shoulder, A = s.arm[0] + s.arm[1];
  const reared = s.quad ? ramp(t, 0.02, W.reach) * (1 - ramp(t, 0.88, 0.98)) : 0;
  if (s.quad) {
    // Up onto its hind legs, its fore hooves off the ground.
    p.chest[0] = lerp(s.lean, 22, reared);
    p.neck[0] = lerp(-s.neck.bend, -10, reared);
    p.pitch += -10 * reared;
    p.H += 0.05 * R.reach * reared;
    p.on = [1 - reared, 1 - reared];
  } else {
    const lean = ramp(t, 0.02, W.reach) * (1 - ramp(t, W.gather + 0.04, W.hug));
    p.chest[0] += 18 * lean;
    p.head[0] -= 10 * lean;
    p.H -= 0.04 * R.reach * lean;
  }
  // Where it snips: out in front of it a little under its shoulders, the paws together at each snip and apart between.
  const at = (x: number, y: number, z: number): V3 => [x, S[1] + A * y, S[2] - A * z];
  let open = 0;
  for (const c of W.snips) open = Math.max(open, hump(t, c - 0.05, 0.05));
  const snipping = held(t, W.reach + 0.04, W.snips[3] + 0.02, 0.06);
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1;
    const snip = at(sd * (0.03 + 0.12 * A * open), 0.95 + 0.04 * open, 0.18 + 0.05 * Math.sin(t * TAU * 5 + i));
    const gather = at(sd * 0.05, 0.85, 0.22), hug = at(sd * 0.1, 0.5, 0.36);
    const k = ramp(t, W.reach - 0.06, W.reach + 0.06);
    let h = mixV(p.hand[i], snip, k * snipping);
    if (t > W.snips[3]) h = path(t, [[W.snips[3] + 0.02, snip], [W.gather, gather], [W.hug, hug], [W.gone, hug], [0.98, p.hand[i]]]);
    p.hand[i] = h;
  }
  p.held = ramp(t, W.gather - 0.06, W.gather) * (1 - ramp(t, W.gone - 0.04, W.gone + 0.02));
  p.hug = ramp(t, W.gather, W.hug);
  const pleased = hump(t, W.hug + 0.06, 0.1);
  p.head = add(p.head, [-14 * snipping + 12 * pleased, 4 * Math.sin(t * TAU * 2.5) * snipping, 8 * pleased]);
  p.ears = [0.2 * snipping - 0.2 * pleased, 0.2 * snipping - 0.2 * pleased];
  p.tail = [6 * snipping + 10 * pleased, 8 * Math.sin(t * TAU * 2), 0];
}

/** A go at its task, eased in from how it stands. */
function workPlan(s: Roo, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R);
  shearPlan(s, R, t, p);
  const q = mixPlan(restPlan(s, R), p, down);
  q.held = p.held; q.hug = p.hug;
  return q;
}

/** Feeding where it stands: head down at the grass, nibbling; the bigger two bent down onto their forepaws. */
function grazePlan(s: Roo, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, nib = Math.max(0, Math.sin(t * TAU * 1.4)) ** 3;
  if (s.quad) {
    p.neck = [-s.neck.bend + 58, 0];
    p.head = [-34 - 6 * nib, 6 * drift(t, 2), 0];
  } else {
    p.chest = [s.lean + 52, 0, 0];
    p.pitch += 10;
    p.H -= 0.12 * R.reach;
    p.neck = [-s.neck.bend + 30, 0];
    p.head = [-40 - 6 * nib, 6 * drift(t, 2), 0];
    p.tail = [-6, 6 * cyc(t, 4), 0];
  }
  p.ears = [0.3, 0.3];
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn, ears up and paws up, a shake, and settled. */
function evolvePlan(s: Roo, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach, A = s.arm[0] + s.arm[1], S = s.shoulder;
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * 56);
  p.H += L * (-0.18 * hunch + 0.18 * up);
  p.chest = [lerp(s.lean, s.quad ? 30 : 6, up) + 14 * hunch, 0, 4 * shake];
  p.neck = [-s.neck.bend + 10 * hunch - 8 * up, 0];
  p.head = [-10 * hunch + 16 * up, 0, 12 * shake];
  p.roll = 3 * shake;
  p.squash = 0.05 * hump(t, 0.72, 0.05);
  if (s.quad) p.on = [1 - up, 1 - up];
  const hi = (sd: number): V3 => [sd * (S[0] + A * 0.5), S[1] + 0.05, S[2] + A * 0.6];
  p.hand = p.hand.map((h, i) => mixV(h, hi(i ? 1 : -1), up)) as V3[];
  p.tail = [-6 * hunch + 16 * up, 12 * shake, 0];
  p.ears = [hunch - 0.4 * up, hunch - 0.4 * up];
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Roo, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => {
    const q = shifted(p, stillPlan(s, R, a, true), restPlan(s, R));
    q.held = p.held; q.hug = p.hug;
    return q;
  };
  if (act?.kind === 'strike') return over(strikePlan(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return mixPlan(stillPlan(s, R, a), grazePlan(s, R, a), smooth(a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = s.quad ? trotPlan(s, R, a) : hopPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ------------------------------------------------------------------------- */

/** Two bones bent to put the end of the second at `to` from `from`, the joint between them bowed toward `hint`. */
function bend2(from: V3, to: V3, l0: number, l1: number, hint: V3): { mid: V3; end: V3 } {
  let d = sub(to, from);
  const D = len3(d), most = (l0 + l1) * 0.995, least = Math.abs(l0 - l1) + 0.06 * (l0 + l1), Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const end = add(from, scale(d, Dc));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  return { mid: add(add(from, scale(d, along)), scale(v, h)), end };
}

/** A hind leg bent to put its ankle at `ankle`: the knee forward and a little out; the foot along the ground, turned a little out. */
function legOf(s: Roo, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit(s.quad ? [sd * 0.2, 1, 0.05] : [sd * 0.15, -1, -0.2])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.12 * fwd[1], fwd[1] - sd * 0.12 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The tail's bones from its root on the hips, each link on from the one before it, lifted, swung and curled. */
function tailBones(s: Roo, body: Xf, lift: number, yaw: number, curl: number): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  let prev = joint(body, T.at, -(T.bend[0] + lift), 0, yaw * 0.5);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.bend[q] + (curl * q) / n + lift * 0.15), 0, (yaw * 0.6) / Math.max(1, n - 1));
    out.push(prev);
  }
  // The plume's bone at the end of the last link.
  out.push(joint(prev, [0, -T.links[n - 1], 0], -(lift * 0.2), 0, 0));
  return out;
}

/** The skull's middle in the head's frame. */
const skullAt = (s: Roo): V3 => [0, s.head.fwd, s.head.up];

/** Where each ear's root is on the skull and how it stands, in the head's frame: up, out and swept back, its face forward. */
function earBase(s: Roo, sd: number): Xf {
  const C = skullAt(s), E = s.ear, e = onEgg(C, s.head.r, [sd * E.dir[0], E.dir[1], E.dir[2]]);
  const b = E.back * DEG, o = E.out * DEG;
  const up = unit([sd * Math.sin(o), -Math.sin(b), Math.cos(b) * Math.cos(o)]);
  const [X, Y, Z] = frameOf(up, [sd * E.face, 0.8, 0]);
  return xfOf(X, Y, Z, add(e.p, scale(e.n, -E.w * 0.15)));
}

/**
 * The bones of a stage: its pose, the hips carried as it says, the chest on them, the neck, the head and its ears, the tail in
 * links, each leg bent to put its foot where it is to be, each foreleg bent to put its paw where it is to be, and the clip.
 */
function rooBones(s: Roo): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    b.chest = joint(body, s.chest, -P.chest[0], P.chest[2], P.chest[1]);
    b.neck = joint(b.chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    // The head carried level whatever the hips, the chest and the neck do under it, then pitched as the pose says.
    b.head = joint(b.neck, [0, 0, s.neck.len], P.chest[0] + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, f = P.ears[i];
      b[`ear${i}`] = compose(b.head, compose(earBase(s, sd), joint(ROOT, [0, 0, 0], -28 * f, sd * 8 * f, sd * 10 * f)));
    }
    tailBones(s, body, P.tail[0], P.tail[1], P.tail[2]).forEach((x, q) => { b[`tail${q}`] = x; });
    for (let i = 0; i < 2; i++) {
      const [u, l, f] = legOf(s, body, i, P.at[i], P.foot[i]);
      const key = i ? 'lr' : 'll';
      b[`${key}0`] = u;
      b[`${key}1`] = l;
      b[`${key}2`] = f;
    }
    const fwd = turn(b.chest, [0, 1, 0]), flat = turn(body, [0, 1, 0]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1;
      const want = mixV(place(b.chest, P.hand[i]), P.ground[i], P.on[i]);
      const sh = place(b.chest, [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      const { mid: el, end: wr } = bend2(sh, want, s.arm[0], s.arm[1], turn(b.chest, unit([sd * s.elbow[0], s.elbow[1], s.elbow[2]])));
      const [X0, Y0, Z0] = frameOf(sub(sh, el), fwd), [X1, Y1, Z1] = frameOf(sub(el, wr), fwd);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      // A paw follows its forearm; a hoof on the ground stands flat on it, pitched as it steps.
      const [X2, Y2, Z2] = frameOf(mixV(Z1, [0, 0, 1], P.on[i]), mixV(Y1, unit([flat[0], flat[1], 0]), P.on[i]));
      b[`hand${i}`] = joint(xfOf(X2, Y2, Z2, wr), [0, 0, 0], P.hoof[i] * P.on[i]);
    }
    // On all four, its fore hooves are feet the stride is measured off too.
    if (s.quad) { b.fl2 = b.hand0; b.fr2 = b.hand1; }
    // The clip: between its paws, then hugged in against its chest.
    const mid = mixV(place(b.hand0, [0, 0, -s.hand * 0.5]), place(b.hand1, [0, 0, -s.hand * 0.5]), 0.5);
    b.clip = scaled(xfOf([1, 0, 0], [0, 1, 0], [0, 0, 1], add(mid, turn(b.chest, [0, 0.02 * P.hug, s.hand * 0.6]))), P.held);
    b.shadow = shadowOf(body, 0);
    return b;
  };
  return (a) => pose(planOf(s, R, { ...a, go: a.act ? 0 : a.go }));
}

/* ---- what it is made of ------------------------------------------------------------- */

/**
 * A leaf-feather from `root` along `dir`, its face along `face`: `L` long and `w` across at its widest, pointed, a rib down it,
 * curled toward its face; and, `tip` of the way along, its end in another colour: the brown of the sheet's feather tips.
 */
function featherOf(root: V3, dir: V3, face: V3, L: number, w: number, mat: Mat, fine: boolean, curl = 0.15, tip?: { at: number; mat: Mat }): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const us = fine ? [0, 0.3, 0.62, 1] : [0, 0.5, 1];
  const pt = (u: number): V3 => add(add(root, scale(d, L * u)), scale(f, curl * L * u * u));
  const ws = fine ? [w * 0.45, w, w * 0.78, w * 0.05] : [w * 0.5, w * 0.95, w * 0.06];
  const body = blade(us.map(pt), ws, f, { mat, rib: mat === 'coatDark' ? 'coat' : 'coatDark', fold: 0.28, thick: w * 0.12 });
  if (!tip) return body;
  // The tip: the last of the blade again, a hair over it, in its own colour.
  const t0 = tip.at, tus = [t0, (t0 + 1) / 2, 1];
  const width = (u: number): number => (u < 0.62 ? lerp(w, w * 0.78, (u - 0.3) / 0.32) : lerp(w * 0.78, w * 0.05, (u - 0.62) / 0.38));
  const end = blade(tus.map((u) => add(pt(u), scale(f, w * 0.14))), tus.map((u) => width(u) * 1.04), f, { mat: tip.mat, rib: tip.mat, fold: 0.28, thick: w * 0.06 });
  return merge(body, end);
}
const GREENS: readonly Mat[] = ['coat', 'coatLight', 'coatDark'];

/**
 * The haunches: the hips' egg in a heap of curls, cream, a patch of green feathers low on each flank over the thigh; the
 * Shearling's fleece all round, the bigger two's heavy on the seat and the belly.
 */
function hipsOf(s: Roo, n: number, k: number, fine: boolean): Mesh {
  return fleeceEgg(s.hips.c, s.hips.r, s.curl.size, n, k, fine, 7, (d) => d[2] < -0.8, (d) => !!s.quad && inPatch(d));
}

/**
 * An egg in a fleece of curls: a body a little smaller, under clumps of curls spread evenly over it (a golden spiral), as many as
 * cover it with their edges overlapping, of a few sizes and three creams; none where `skip` says, green where `green` does.
 */
function fleeceEgg(C: V3, R: V3, size: number, n: number, k: number, fine: boolean, seed: number, skip: (d: V3) => boolean = () => false, green: (d: V3) => boolean = () => false): Mesh {
  const inner = scale(R, 0.9), out: Mesh[] = [orb(C, inner, n + 6, k + 4, 'belly')];
  const sz = size * (fine ? 1 : 1.35);
  // Its skin's area, near enough (Knud Thomsen's), over what a clump covers with its neighbours overlapping it.
  const P = 1.6, a = inner[0], b = inner[1], c = inner[2];
  const area = 4 * Math.PI * (((a * b) ** P + (a * c) ** P + (b * c) ** P) / 3) ** (1 / P);
  const N = Math.max(8, Math.round(area / (Math.PI * (sz * 1.05) ** 2)));
  for (let q = 0; q < N; q++) {
    const zz = 1 - 2 * (q + 0.5) / N, rr = Math.sqrt(1 - zz * zz), an = q * 2.39996 + seed;
    const d: V3 = [Math.cos(an) * rr, Math.sin(an) * rr, zz];
    if (skip(d)) continue;
    const e = onEgg(C, inner, d);
    const m = clump(e.p, e.n, sz * (0.75 + 0.5 * jitter(q * 7 + seed)), fine ? 7 : 6, q + seed * 50);
    out.push(green(d) ? painted(m, () => GREENS[q % 3]) : m);
  }
  return merge(...out);
}

/**
 * The green on its haunches: a patch of leaf-feathers low on each flank, over the thigh, lying down and back, and one either side
 * of the root of its tail; each patch a few rows, the top row short, so its edge is ragged.
 */
function patchesOf(s: Roo, fine: boolean): Mesh {
  const C = s.hips.c, R = s.hips.r, out: Mesh[] = [], F = s.feather;
  for (const [d0, k] of PATCHES) {
    for (const sd of [1, -1]) {
      // A fringe of feathers along the patch's lower edge, hanging down out of it.
      const per = fine ? 5 : 3;
      for (let q = 0; q < per; q++) {
        const id = q * 7 + (sd > 0 ? 0 : 50) + Math.round(k * 100);
        const a = ((q / Math.max(1, per - 1)) - 0.5) * 1.6;
        const d: V3 = [sd * d0[0], d0[1] + Math.sin(a) * 0.35 * k, d0[2] - 0.32 * k * Math.cos(a)];
        const e = onEgg(C, scale(R, 0.98), d);
        const down = unit(add(sub([0, -0.3, -1], scale(e.n, dot([0, -0.3, -1], e.n))), scale(e.n, 0.2)));
        out.push(featherOf(e.p, down, e.n, F.len * k * (0.8 + 0.4 * jitter(id)), F.w * k, GREENS[id % 3], fine, 0.2));
      }
    }
  }
  return merge(...out);
}
/** Where the green patches are on its haunches (the right side's; the left's mirrors them), and how big each is. */
const PATCHES: ReadonlyArray<readonly [V3, number]> = [[[0.82, 0.3, -0.35], 1], [[0.55, -0.72, -0.25], 0.8]];
/** Whether the way `d` out of the haunches' egg is in a green patch. */
function inPatch(d: V3): boolean {
  const u = unit(d);
  return PATCHES.some(([p, k]) => dot(u, unit([Math.sign(u[0]) * p[0], p[1], p[2]])) > Math.cos(0.58 * k));
}

/** A clump of curls: a round puff, a little flattened along `nrm`, pushed out of the skin it sits on. */
function clump(p: V3, nrm: V3, r: number, n: number, id: number, tone: 'light' | 'warm' = 'warm'): Mesh {
  const f = frameOf(nrm, Math.abs(nrm[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]), j = jitter(id * 3 + 1);
  const mat: Mat = tone === 'light' ? (j > 0.3 ? 'muzzle' : 'mark') : j > 0.86 ? 'muzzle' : j < 0.16 ? 'belly' : 'mark';
  return egg(add(p, scale(nrm, r * 0.2)), f, [r, r * 0.9, r * 0.62], n, Math.max(4, Math.round(n * 0.6)), mat);
}

/** The torso, in the chest's frame: its rings in curls, cream; under the cape on the bigger two, and under the Shearling's collar. */
function torsoOf(s: Roo, n: number, fine: boolean): Mesh {
  const T = s.torso, K = 3, z: number[] = [], y: number[] = [], w: number[] = [], h: number[] = [];
  for (let q = 0; q < T.z.length - 1; q++) for (let k = 0; k < K; k++) {
    const f = k / K;
    z.push(lerp(T.z[q], T.z[q + 1], f)); y.push(lerp(T.y[q], T.y[q + 1], f)); w.push(lerp(T.w[q], T.w[q + 1], f)); h.push(lerp(T.h[q], T.h[q + 1], f));
  }
  z.push(T.z[T.z.length - 1]); y.push(T.y[T.y.length - 1]); w.push(T.w[T.w.length - 1]); h.push(T.h[T.h.length - 1]);
  // The body under the curls a little smaller, green where the cape or the collar lies on it.
  const base = painted(tube(z.map((zz, q) => [0, y[q], zz] as V3), w.map((x) => x * 0.9), h.map((x) => x * 0.9), n, 'belly', { up: [0, 1, 0] }), (p) => (underCape(s, p) ? 'coatDark' : 'belly'));
  const out: Mesh[] = [base];
  // The curls over it, in rings up it, each ring turned half a step from the last; none under the cape or the collar.
  const top = T.z[T.z.length - 1], size = s.curl.size * (fine ? 1 : 1.35);
  const rings = Math.max(3, Math.round((top - T.z[0]) / (size * 1.15)));
  for (let r = 0; r < rings; r++) {
    const zz = lerp(T.z[0] + size * (s.quad ? 0.6 : 0.3), top - size * 0.5, r / Math.max(1, rings - 1)), tr = torsoAt(s, zz);
    const round = Math.max(5, Math.round((Math.PI * (tr.w + tr.h)) / (size * 1.3)));
    for (let q = 0; q < round; q++) {
      const a = ((q + 0.5 * (r % 2)) / round) * TAU + (jitter(q + r * 17) - 0.5) * 0.3;
      const e = onTorso(s, zz, a, -0.1 * size);
      const p: V3 = [e.p[0] * 0.9, tr.y + (e.p[1] - tr.y) * 0.9, zz];
      if (underCape(s, add(p, scale(e.n, size * 0.6)))) continue;
      // Heaviest over the chest and the belly.
      const front = Math.max(0, Math.sin(a));
      out.push(clump(p, e.n, size * (0.8 + 0.4 * jitter(q * 3 + r)) * (1 + 0.25 * front), fine ? 7 : 6, q + r * 31, s.quad ? 'warm' : 'light'));
    }
  }
  return merge(...out);
}

/** Whether a point on the torso (in the chest's frame) is under the cape or the collar, so its skin there is green between the feathers. */
function underCape(s: Roo, p: V3): boolean {
  const T = s.torso, top = T.z[T.z.length - 1], r = torsoAt(s, p[2]);
  const a = Math.atan2((p[1] - r.y) / r.h, p[0] / r.w);
  if (s.quad) return p[2] > top - s.feather.len * 1.0;
  const bottom = lerp(top, T.z[0], s.feather.cape), u = clamp((top - p[2]) / Math.max(0.01, top - bottom));
  const span = lerp(0.72, 0.5, u) * Math.PI * 0.5;
  return p[2] > bottom - s.feather.len * 0.4 && Math.abs(a + Math.PI / 2) < span;
}

/**
 * The cape of leaf-feathers, in the chest's frame: rows of them shingled down from the root of the neck. The Shearling's is a
 * collar all the way round, over its chest and shoulders; the bigger two's lies over the back of their shoulders and down the
 * back, its front edge reaching round onto the chest a little at the top.
 */
function capeOf(s: Roo, fine: boolean): Mesh {
  const T = s.torso, out: Mesh[] = [], F = s.feather, top = T.z[T.z.length - 1] - 0.01;
  if (s.quad) {
    // The collar: two rows round the top of the torso, under the ruff on its neck, lying back along the body.
    const rows = 1;
    for (let row = rows - 1; row >= 0; row--) {
      const z0 = top - row * F.len * 0.38, count = Math.round((fine ? 26 : 14) + row * 2);
      for (let q = 0; q < count; q++) {
        const a = ((q + 0.5 * (row % 2)) / count) * TAU + (jitter(q + row * 13) - 0.5) * 0.15;
        const front = Math.max(0, Math.sin(a));
        const e = onTorso(s, z0, a, 0.02 + row * 0.015);
        const L = F.len * (0.85 + 0.35 * front + 0.2 * jitter(q * 3 + row)), dir = unit(add(scale(e.n, 0.12 + 0.15 * front), [0, 0, -1]));
        out.push(featherOf(e.p, dir, e.n, L, F.w * (0.9 + 0.3 * jitter(q + row)), GREENS[(q + row) % 3], fine, 0.2));
      }
    }
    return merge(...out);
  }
  // Rows down the back, each round the back half and onto the sides, fewer and narrower the lower; the top rows reach round
  // the shoulders onto the chest.
  const bottom = lerp(top, T.z[0], F.cape), rows = Math.max(2, Math.round((top - bottom) / (F.len * 0.5)));
  for (let row = rows - 1; row >= 0; row--) {
    const u = row / Math.max(1, rows - 1), z0 = lerp(top, bottom, u), span = lerp(0.72, 0.5, u) * Math.PI;
    const count = Math.round((fine ? 16 : 10) * lerp(1, 0.7, u));
    for (let q = 0; q < count; q++) {
      const a = -Math.PI / 2 + ((q + 0.5) / count - 0.5) * span + (row % 2) * 0.08;
      const e = onTorso(s, z0, a, s.curl.size * 0.6 + 0.01);
      const L = F.len * (0.9 + 0.3 * jitter(q * 5 + row)) * lerp(1.1, 0.9, u), dir = unit(add(scale(e.n, 0.12), [0, 0, -1]));
      out.push(featherOf(e.p, dir, e.n, L, F.w * (0.9 + 0.3 * jitter(q + row * 3)), GREENS[(q + row) % 3], fine, 0.18));
    }
  }
  return merge(...out);
}

/** The head, in the head's frame: the skull, cream, its crown and the back of it green; the muzzle; eyes, nose and mouth. */
function headOf(s: Roo, n: number, k: number): Mesh {
  const C = skullAt(s), R = s.head.r, S = s.snout;
  // Green over the crown and the back of the head, down behind the cheeks; cream over the face.
  const skull = painted(orb(C, R, n + 6, k + 4, 'muzzle'), (c) => {
    const d = unit([(c[0] - C[0]) / R[0], (c[1] - C[1]) / R[1], (c[2] - C[2]) / R[2]]);
    const front = d[1] + 0.35 * Math.abs(d[0]) * 0;
    return front < -0.35 || (d[2] > 0.5 && d[1] < -0.1) ? 'coat' : 'muzzle';
  });
  const mc = add(C, S.at);
  const snout = orbAlong(mc, [0, 1, -0.25], [S.r[0], S.r[2], S.r[1]], n + 2, k + 1, 'muzzle');
  // The nose: a small rounded pink-brown triangle on the end of the muzzle; the mouth a small smile under it.
  const tip = onEgg(mc, [S.r[0], S.r[1], S.r[2]], [0, 1, 0.25]);
  const nr = S.r[0] * 0.55;
  const nose = paint([disc(add(tip.p, scale(tip.n, 0.006)), tip.n, nr, nr * 0.62, 7, 'nose', { spin: Math.PI / 2 })]);
  const me = onEgg(mc, [S.r[0], S.r[1], S.r[2]], [0, 0.85, -0.45]);
  const mouth = smile(add(me.p, scale(me.n, -0.012)), me.n, S.r[0] * 0.8, 'lid');
  return merge(skull, snout, nose, mouth, eyesOf(s));
}

/** Its eyes: big and round, brown with a dark middle, a dark rim and lashes at the outer corner, two glints. */
function eyesOf(s: Roo): Mesh {
  const C = skullAt(s), R = s.head.r, E = s.eye, out: Disc[] = [];
  for (const sd of [1, -1]) {
    const e = onEgg(C, R, [sd * E.dir[0], E.dir[1], E.dir[2]]), n = e.n, r = E.size;
    const up = unit(cross(cross(n, [0, 0, 1]), n)), side = unit(cross(up, n));
    const at = add(e.p, scale(n, -0.005));
    const o = { up: [0, 0, 1] as V3, at };
    out.push(disc(add(e.p, scale(n, 0.004)), n, r * 1.2, r * 1.25, 12, 'lid', o));
    out.push(disc(add(e.p, scale(n, 0.008)), n, r, r * 1.06, 12, 'eye', o));
    out.push(disc(add(add(e.p, scale(n, 0.011)), scale(up, -r * 0.05)), n, r * 0.55, r * 0.6, 10, 'claw', o));
    out.push(disc(add(add(add(e.p, scale(n, 0.014)), scale(up, r * 0.38)), scale(side, -sd * r * 0.3)), n, r * 0.32, r * 0.32, 7, 'glint', { ...o, lit: true }));
    out.push(disc(add(add(add(e.p, scale(n, 0.014)), scale(up, -r * 0.42)), scale(side, sd * r * 0.3)), n, r * 0.13, r * 0.13, 5, 'glint', { ...o, lit: true }));
    // A lash at the outer corner, a little flick back.
    const corner = add(add(e.p, scale(side, -sd * r * 1.05)), scale(up, r * 0.45));
    out.push({ v: [add(corner, scale(n, 0.012)), add(add(corner, scale(side, -sd * r * 0.55)), add(scale(up, r * 0.35), scale(n, 0.012))), add(add(corner, scale(side, -sd * r * 0.1)), add(scale(up, -r * 0.2), scale(n, 0.012)))], m: 'lid', at });
  }
  return paint(out.map((d) => ({ ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, 0.006)); }) })));
}

/**
 * The crown's leaf-feathers, in the head's frame: rows of them over the top and back of the head lying back, a tuft standing up
 * between the ears, and the cheeks' feathers swept back below the ears.
 */
function crownOf(s: Roo, fine: boolean): Mesh {
  const C = skullAt(s), R = s.head.r, out: Mesh[] = [], L = s.feather.len * (s.quad ? 0.7 : 0.6), w = s.feather.w * 0.8;
  // The Shearling's crown: a tuft of curls between its ears, over its brow.
  if (s.quad) {
    const N = fine ? 9 : 5;
    for (let q = 0; q < N; q++) {
      const a = q * 2.39996, rr = 0.3 + 0.35 * Math.sqrt((q + 0.5) / N);
      const e = onEgg(C, R, [Math.cos(a) * rr * 0.8, 0.2 + Math.sin(a) * rr * 0.6, 0.9]);
      out.push(clump(e.p, e.n, R[0] * 0.22 * (0.9 + 0.3 * jitter(q + 3)), fine ? 8 : 6, q + 300));
    }
  }
  const rows: Array<{ el: number; count: number; span: number; k: number }> = [
    { el: 0.85, count: fine ? 5 : 3, span: 0.9, k: 0.9 },
    { el: 0.45, count: fine ? 9 : 6, span: 1.6, k: 1 },
    { el: 0.0, count: fine ? 9 : 6, span: 1.4, k: 1.05 },
  ];
  rows.forEach((row, ri) => {
    for (let q = 0; q < row.count; q++) {
      const a = -Math.PI / 2 + ((q + 0.5) / row.count - 0.5) * row.span * Math.PI * 0.75;
      const c = Math.sqrt(1 - row.el * row.el), d: V3 = [Math.cos(a) * c, Math.sin(a) * c + 0.25, row.el];
      const e = onEgg(C, R, d);
      const back = unit(add(sub([0, -1, -0.15], scale(e.n, dot([0, -1, -0.15], e.n))), scale(e.n, 0.25)));
      out.push(featherOf(add(e.p, scale(e.n, -0.005)), back, e.n, L * row.k * (0.85 + 0.3 * jitter(q + ri * 7)), w, GREENS[(q + ri) % 3], fine, 0.15));
    }
  });
  // The tuft standing up on its brow, between the ears.
  for (let q = 0; q < 3; q++) {
    const e = onEgg(C, R, [(q - 1) * 0.2, 0.35, 0.92]);
    out.push(featherOf(e.p, unit([(q - 1) * 0.3, -0.35, 1]), [0, 1, 0.2], L * (q === 1 ? 0.9 : 0.7), w, GREENS[q], fine, -0.2));
  }
  // The cheek ruff: feathers from behind each cheek swept back and down.
  const cheeks = s.quad ? (fine ? 7 : 4) : fine ? 4 : 2;
  for (const sd of [1, -1]) for (let q = 0; q < cheeks; q++) {
    const u = q / Math.max(1, cheeks - 1), e = onEgg(C, R, [sd * 0.92, lerp(-0.2, -0.6, u), lerp(0.2, -0.5, u)]);
    out.push(featherOf(e.p, unit([sd * (s.quad ? 0.7 : 0.35), -1, -0.35 - 0.3 * u]), e.n, L * (s.quad ? 1.3 : 1) * (1 + 0.15 * u), w * (s.quad ? 1.3 : 1), GREENS[q % 3], fine, 0.15));
  }
  return merge(...out);
}

/**
 * An ear, in its own frame from its root up `z`, its face along `y`: one long soft leaf of a hare's ear, cupped across and bowed
 * back a little along its length; cream, a pink blush inside, its tip going tan to brown to dark brown; green feathering over its
 * root and along its outer edge. `sd` is which ear, so its outer edge is the one away from the other.
 */
function earOf(s: Roo, sd: number, fine: boolean, n: number): Mesh {
  const E = s.ear, out: Mesh[] = [];
  const us = [0, 0.1, 0.22, 0.36, 0.5, 0.56, 0.64, 0.72, 0.78, 0.84, 0.91, 0.96, 1];
  const ws = [0.5, 0.8, 0.96, 1, 0.94, 0.88, 0.78, 0.66, 0.56, 0.44, 0.28, 0.14, 0.01].map((x) => x * E.w);
  const bow = (u: number): number => -0.1 * E.len * u * u;
  const cup = (p: V3): V3 => { const u = clamp(p[2] / E.len), w = Math.max(0.01, lerp(E.w, E.w * 0.4, u)); return [p[0], p[1] + bow(u) + 0.35 * w * (p[0] / w) ** 2, p[2]]; };
  const band = (u: number): Mat => (u < 0.56 ? 'mark' : u < 0.64 ? 'horn' : u < 0.72 ? 'hornDark' : u < 0.84 ? 'feather' : 'featherDark');
  const shell = tube(us.map((u) => [0, 0, E.len * u] as V3), ws, ws.map((x) => Math.max(0.008, x * 0.16)), Math.max(8, n + 2), (ring) => band(us[Math.min(ring, us.length - 1)]), { up: [0, 1, 0] });
  // Its back green over the root, going to cream.
  out.push(painted(mesh(shell.v.map(cup), shell.f), (c, was) => (c[2] < E.len * 0.3 && c[1] < bow(clamp(c[2] / E.len)) + 0.005 ? 'coat' : was)));
  // The blush inside: pink down the middle of its front, from near its root to where the tan begins.
  const lin: V3[] = [], uu = [0.08, 0.2, 0.34, 0.46, 0.56];
  for (const u of uu) lin.push([-lerp(E.w * 0.55, E.w * 0.3, u / 0.56), 0, E.len * u]);
  for (const u of [...uu].reverse()) lin.push([lerp(E.w * 0.55, E.w * 0.3, u / 0.56), 0, E.len * u]);
  out.push(paint([{ v: lin.map((q) => add(cup(q), [0, E.w * 0.18, 0])), m: 'inner' }]));
  // The feathering: small leaf-feathers lying along the outer edge from the root, and round the root, green, overlapping.
  const per = fine ? 7 : 4;
  for (let q = 0; q < per; q++) {
    const u = 0.02 + (q / per) * 0.52, w = lerp(0.5, 0.95, u * 2) * E.w;
    const root = cup([sd * w * 0.82, 0, E.len * u]);
    out.push(featherOf(add(root, [0, -0.006, 0]), [sd * 0.22, -0.05, 1], [0, 1, 0.05], E.len * lerp(0.2, 0.15, u * 2), E.w * 0.3, GREENS[q % 3], fine, 0.05));
  }
  for (let j = 0; j < (fine ? 5 : 3); j++) {
    const x = (j / Math.max(1, (fine ? 4 : 2)) - 0.5) * 2;
    out.push(featherOf(cup([x * E.w * 0.45, 0, -E.len * 0.03]), [x * 0.3, -0.12, 1], [0, 1, 0.1], E.len * 0.2, E.w * 0.32, GREENS[j % 3], fine, 0.1));
  }
  return merge(...out);
}

/**
 * The bigger two's shin, from the knee down its bone: slender, cream going dark brown over the ankle, the fleece of the thigh
 * thinning down it in a few small curls under the knee.
 */
function shinOf(s: Roo, len: number, w: number, n: number, fine: boolean, seed: number): Mesh {
  const us = [0, 0.15, 0.35, 0.55, 0.72, 0.84, 1];
  const prof = [1.25, 1.2, 1.0, 0.85, 0.75, 0.78, 0.9];
  const out: Mesh[] = [tube(us.map((u) => [0, -0.04 * len * Math.sin(Math.PI * u), -len * u] as V3), prof.map((k) => k * w), prof.map((k) => k * w * 1.1), n, (ring) => (us[Math.min(ring, us.length - 1)] >= 0.84 ? 'hoof' : 'mark'), { seam: 'start' })];
  const rows = [{ u: 0.06, k: 1, count: fine ? 7 : 5 }, { u: 0.2, k: 0.75, count: fine ? 6 : 4 }, { u: 0.34, k: 0.55, count: fine ? 5 : 0 }];
  rows.forEach((row, ri) => {
    for (let q = 0; q < row.count; q++) {
      const a = ((q + 0.5 * ri) / row.count) * TAU, d: V3 = [Math.cos(a), Math.sin(a), 0], r = w * 1.2;
      out.push(clump(add([0, 0, -len * row.u], scale(d, r * 0.8)), d, s.curl.size * 0.8 * row.k * (0.85 + 0.3 * jitter(seed * 9 + q + ri * 5)), fine ? 7 : 6, seed * 40 + q + ri * 9));
    }
  });
  return merge(...out);
}

/** A soft limb's piece: a tube with a ball at its root so a bend never shows a gap; its rings coloured as `ring` says. */
function limb(len: number, w0: number, w1: number, n: number, k: number, mat: Mat | ((u: number) => Mat), ball = true): Mesh {
  const at = (u: number): Mat => (typeof mat === 'function' ? mat(u) : mat);
  const us = [0, 0.25, 0.5, 0.75, 1];
  return merge(
    ball ? egg([0, 0, 0], UPRIGHT, [w0 * 1.05, w0 * 1.05, w0 * 1.05], n, k, at(0)) : null,
    tube(us.map((u) => [0, 0, -len * u] as V3), us.map((u) => lerp(w0, w1, u)), us.map((u) => lerp(w0, w1, u)), n, (ring) => at(us[Math.min(ring, us.length - 1)]), { seam: 'both' }),
  );
}

/** A tuft of leaf-feathers round a limb at height `z` in its frame, pointing down it: at a knee, a hock, an elbow. */
function cuffOf(z: number, r: number, L: number, w: number, count: number, fine: boolean, seed: number, face = 0): Mesh {
  const out: Mesh[] = [];
  for (let q = 0; q < count; q++) {
    const a = (q / count) * TAU + jitter(seed + q) * 0.3 + face;
    const d: V3 = [Math.cos(a), Math.sin(a), 0];
    out.push(featherOf(add([0, 0, z], scale(d, r * 0.85)), unit(add(scale(d, 0.45), [0, 0, -1])), d, L * (0.8 + 0.4 * jitter(seed + q * 2)), w, GREENS[(q + seed) % 3], fine, 0.2));
  }
  return merge(...out);
}

/** A hind foot, from the ankle: the Shearling's a small dark hoof; the bigger two's a long dark foot along the ground, three toes. */
function footOf(s: Roo, n: number, k: number): Mesh {
  const L = s.leg, h = L.heel, fl = L.foot[0], fw = L.foot[1];
  if (s.quad) {
    return merge(
      tube([[0, 0, 0.02], [0, 0.01, -h * 0.5], [0, 0.02, -h]], [fw * 0.8, fw * 0.95, fw], [fw * 0.8, fw * 1.0, fw * 1.1], n, 'hoof', { seam: 'start' }),
    );
  }
  const out: Mesh[] = [
    // The heel: a round knob at the ankle.
    egg([0, -fw * 0.15, -h * 0.05], UPRIGHT, [fw * 0.7, fw * 0.8, fw * 0.75], n, k, 'hoof'),
    // The long sole, down from the ankle to the ground and along it, widening to the ball of the foot.
    tube([[0, -fw * 0.2, 0], [0, fl * 0.18, -h * 0.55], [0, fl * 0.45, -h * 0.82], [0, fl * 0.62, -h * 0.86]], [fw * 0.6, fw * 0.62, fw * 0.8, fw * 0.95], [fw * 0.6, fw * 0.52, fw * 0.48, fw * 0.5], n, 'hoof', { seam: 'start' }),
  ];
  // Three thick toes from the ball of the foot, splayed, each ending in a dark claw hooked down to the ground.
  for (const q of [-1, 0, 1]) {
    const a = q * 0.32, len = fl * (q ? 0.3 : 0.38), d: V3 = [Math.sin(a), Math.cos(a), 0];
    const root: V3 = [q * fw * 0.45, fl * 0.58, -h * 0.84], mid = add(root, scale(d, len * 0.62)), tip = add(root, scale(d, len));
    out.push(tube([root, add(mid, [0, 0, 0.004]), tip], [fw * 0.36, fw * 0.3, fw * 0.26], [fw * 0.32, fw * 0.28, fw * 0.22], Math.max(5, n - 2), 'hoof', { seam: 'start' }));
    out.push(tube([add(tip, scale(d, -len * 0.08)), add(add(tip, scale(d, len * 0.18)), [0, 0, -h * 0.02]), add(add(tip, scale(d, len * 0.32)), [0, 0, -h * 0.13])], [fw * 0.24, fw * 0.16, fw * 0.03], [fw * 0.2, fw * 0.14, fw * 0.03], 5, 'claw'));
  }
  return merge(...out);
}

/** A paw, from the wrist: a dark mitten with curled fingers and dark claws; the Shearling's a dark hoof. */
function pawOf(s: Roo, n: number, k: number): Mesh {
  const r = s.hand;
  if (s.quad) return tube([[0, 0, 0.01], [0, 0.005, -s.leg.heel * 0.55], [0, 0.01, -s.leg.heel]], [r * 0.9, r * 1.05, r * 1.1], [r * 0.9, r * 1.1, r * 1.2], n, 'hoof', { seam: 'start' });
  const out: Mesh[] = [egg([0, r * 0.15, -r * 0.6], UPRIGHT, [r * 0.95, r * 0.85, r * 1.0], n, k, 'pad')];
  for (const q of [-1, 0, 1]) out.push(tube([[q * r * 0.45, r * 0.55, -r * 1.05], [q * r * 0.5, r * 0.8, -r * 1.35], [q * r * 0.5, r * 0.6, -r * 1.6]], [r * 0.24, r * 0.18, r * 0.04], [r * 0.24, r * 0.18, r * 0.04], 5, 'claw'));
  return merge(...out);
}

/**
 * A link of the tail, in its bone's frame back along `-y`: fleece in curls, a band of green feathers along its top on the
 * bigger two; the Shearling's a puff of a tail.
 */
function tailLink(s: Roo, q: number, n: number, fine: boolean): Mesh {
  const T = s.tail, L = T.links[q], w0 = T.w[q], w1 = T.w[q + 1], last = q === T.links.length - 1;
  if (s.quad) {
    if (q) return mesh([], []);
    const c: V3 = [0, -0.06, 0.02], r: V3 = [0.11, 0.12, 0.1];
    // A puff of curls, a few green leaf-feathers lying back over its top.
    const puffs = fleeceEgg(c, r, s.curl.size * 0.8, n, k8(n), fine, 71);
    const leaves = [-0.5, 0, 0.5].map((x, j) => featherOf([x * 0.06, -0.02, 0.1], [x * 0.4, -1, 0.35], [0, 0, 1], s.feather.len * 0.8, s.feather.w * 0.9, GREENS[j], fine, 0.2));
    return merge(puffs, ...leaves);
  }
  const us = [0, 0.35, 0.7, 1];
  const ws = us.map((u) => lerp(w0, w1, u) * (1 + 0.08 * Math.sin(Math.PI * u)));
  const out: Mesh[] = [tube(us.map((u) => [0, 0.04 - (L + (last ? 0 : 0.04)) * u, 0] as V3), ws.map((x) => x * 0.85), ws.map((x) => x * 0.8), n + 2, 'belly', { start: q === 0, end: last })];
  // Its curls: two rings of clumps round it, the second turned half a step.
  for (let j = 0; j < 3; j++) {
    const u = 0.2 + 0.32 * j, r = lerp(w0, w1, u) * 0.85, cs = Math.min(s.curl.size * (fine ? 0.9 : 1.2), r * 0.7);
    const round = Math.max(4, Math.round((TAU * r) / (cs * 1.3)));
    for (let c = 0; c < round; c++) {
      const a = ((c + 0.5 * j) / round) * TAU + q, d: V3 = [Math.cos(a), 0, Math.sin(a) * 0.95];
      out.push(clump(add([0, -L * u, 0], scale(d, r * 0.85)), d, cs * (0.85 + 0.3 * jitter(q * 9 + j * 5 + c)), fine ? 7 : 6, q * 13 + j * 7 + c));
    }
  }
  // A crest of green feathers along its top, lying back along it, more toward the tip.
  const per = fine ? 3 : 2, big = 1 + 0.25 * s.stage;
  for (let j = 0; j < per; j++) {
    const u = (j + 0.2) / per, r = lerp(w0, w1, u);
    // The Shearlord's tail is more feather than fleece: its feathers lie down its sides as well, long, so it is a great green plume.
    for (const off of s.stage === 2 ? (fine ? [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5] : [-1.2, -0.4, 0.4, 1.2]) : fine ? [-0.6, 0, 0.6] : [-0.4, 0.4]) {
      const a = Math.PI / 2 + off + 0.15 * (jitter(q * 5 + j) - 0.5);
      const d: V3 = [Math.cos(a), 0, Math.sin(a)];
      out.push(featherOf(add([0, -L * u, 0], scale(d, r * 1.15)), unit([d[0] * 0.25, -1, d[2] * 0.3]), d, s.feather.len * big * (0.8 + 0.12 * q), s.feather.w * 1.15 * big, (q + j + Math.round(off * 3)) % 2 ? 'coat' : 'coatDark', fine, 0.18));
    }
  }
  return merge(...out);
}
const k8 = (n: number): number => Math.max(4, Math.round(n * 0.6));

/** The plume at the tail's tip, in its bone's frame back along `-y`: a fan of long green feathers tipped in brown. */
function plumeOf(s: Roo, fine: boolean): Mesh {
  const P = s.tail.plume, out: Mesh[] = [], w = P * 0.2, r0 = s.tail.w[s.tail.w.length - 2];
  if (!P) return mesh([], []);
  // A fan of long feathers out of the tail's end, spread up and down in its own plane, sweeping up at their ends, the middle ones
  // longest, green tipped dark brown; and a layer either side of it, shorter, so it is a plume and not a fan from in front.
  const layers = fine ? [0, -1, 1] : [0];
  for (const side of layers) {
    const count = (fine ? 7 : 5) - Math.abs(side) * 2, k = side ? 0.8 : 1;
    for (let q = 0; q < count; q++) {
      const t = count > 1 ? q / (count - 1) - 0.5 : 0, a = t * 0.9 + 0.1;
      const d = unit([side * 0.3, -Math.cos(a), Math.sin(a) + 0.2]);
      const L = P * k * (1 - 0.5 * Math.abs(t)) * (0.9 + 0.2 * jitter(q * 3 + side + 4));
      out.push(featherOf([side * r0 * 0.5, 0.06 + 0.04 * Math.abs(side), Math.sin(a) * r0 * 0.5], d, [1, 0, side * 0.6], L, w * k * (0.9 + 0.2 * jitter(q + 9)), GREENS[(q + side + 3) % 3], fine, 0.18, { at: 0.6, mat: q % 2 ? 'featherDark' : 'feather' }));
    }
  }
  return merge(...out);
}

/** The clip, in its own frame: a bundle of cream curls. */
function clipOf(s: Roo, n: number): Mesh {
  const r = [0.1, 0.15, 0.2][s.stage], out: Mesh[] = [];
  for (let q = 0; q < 6; q++) {
    const a = q * 2.4, c: V3 = [Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.35, (jitter(q) - 0.5) * r * 0.6];
    out.push(orb(c, r * (0.55 + 0.2 * jitter(q + 3)), Math.max(6, n - 2), 4, q % 3 ? 'mark' : 'belly'));
  }
  return merge(...out);
}

/** How its fleece is drawn: no lines inside it, only round the whole, and a light rim along its top edge. */
const FLUFF = { lines: false, sheen: 'eyeWhite' as Mat };

/** A stage's pieces. */
function rooBuild(s: Roo, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), fine = lod > 0, pieces: Piece[] = [];
  const T = s.torso;
  const hide = [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];
  const hipsSolid = { c: s.hips.c, r: scale(s.hips.r, 0.9) };
  const chestSolids: Array<{ c: V3; r: V3 }> = [0.2, 0.5, 0.8].map((f) => {
    const z = lerp(T.z[0], T.z[T.z.length - 1], f), r = torsoAt(s, z);
    return { c: [0, r.y, z] as V3, r: [r.w * 0.9, r.h * 0.88, (T.z[T.z.length - 1] - T.z[0]) * 0.26] as V3 };
  });
  pieces.push({ key: 'hips', mesh: hipsOf(s, n, k, fine), bone: 'trunk', bias: 0, sheen: 'eyeWhite' });
  if (s.quad) pieces.push({ key: 'patches', mesh: patchesOf(s, fine), bone: 'trunk', bias: 0.005, after: ['hips'], hide: [hipsSolid] });
  pieces.push({ key: 'torso', mesh: torsoOf(s, n + 8, fine), bone: 'chest', bias: 0.01, ...(s.quad ? {} : { after: 'hips' }), breathes: { c: [0, 0, T.z[2]], k: 0.04 }, sheen: 'eyeWhite' });
  pieces.push({ key: 'cape', mesh: capeOf(s, fine), bone: 'chest', bias: 0.03, after: ['torso', 'arm0', 'arm1'], hide: chestSolids, airy: true });
  // The neck: cream in front, green feathers behind, rows of them lying down it.
  const N = s.neck;
  const neckTube = painted(tube([[0, 0, -0.08], [0, 0, N.len * 0.5], [0, 0, N.len + 0.04]], [N.w[0], lerp(N.w[0], N.w[1], 0.6), N.w[1]], [N.w[0], lerp(N.w[0], N.w[1], 0.6), N.w[1]], n + 2, 'muzzle'), (c) => (c[1] < -0.2 * N.w[1] ? 'coat' : 'muzzle'));
  pieces.push({ key: 'neck', mesh: neckTube, bone: 'neck', bias: 0.005, after: ['torso'], under: 'head' });
  const maneOut: Mesh[] = [];
  const mrows = s.quad ? 2 : Math.max(2, Math.round(s.feather.mane * (fine ? 1 : 0.6)));
  for (let r = 0; r < mrows; r++) {
    const z = lerp(N.len + 0.02, -0.02, r / Math.max(1, mrows - 1)), w = lerp(N.w[1], N.w[0], clamp(z / N.len)), per = s.quad ? (fine ? 16 : 10) : fine ? 8 : 5;
    for (let q = 0; q < per; q++) {
      const a = s.quad ? ((q + 0.5 * (r % 2)) / per) * TAU : -Math.PI / 2 + ((q + 0.5) / per - 0.5) * Math.PI * 1.45 + (r % 2) * 0.12;
      const d: V3 = [Math.cos(a), Math.sin(a), 0];
      // The Shearling's collar: a short neat ruff round the root of its neck.
      const L = s.feather.len * (s.quad ? 0.8 + 0.15 * r : 1) * (0.85 + 0.3 * jitter(q + r * 9));
      const flare = s.quad ? 0.55 : 0.22;
      maneOut.push(featherOf(add([0, 0, z], scale(d, w * 0.92)), unit(add(scale(d, flare), [0, 0, -1])), d, L, s.feather.w * (s.quad ? 1.15 : 1), GREENS[(q + r) % 3], fine, 0.16));
    }
  }
  pieces.push({ key: 'mane', mesh: merge(...maneOut), bone: 'neck', bias: 0.012, after: ['neck', 'torso', 'cape'], under: ['head', 'crown'], hide: [{ c: [0, 0, N.len * 0.5], r: [N.w[0] * 0.85, N.w[0] * 0.85, N.len * 0.6] }] });
  pieces.push({ key: 'head', mesh: headOf(s, n, k), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'crown', mesh: crownOf(s, fine), bone: 'head', bias: 0.205, after: ['head'], hide });
  for (let i = 0; i < 2; i++) pieces.push({ key: `ear${i}`, mesh: earOf(s, i ? 1 : -1, fine, n), bone: `ear${i}`, bias: 0.21, after: ['head', 'crown'], hide, hideIn: 'head' });
  // The tail, in links, and its plume.
  s.tail.links.forEach((_, q) => pieces.push({ key: `tail${q}`, mesh: tailLink(s, q, n, fine), bone: `tail${q}`, bias: -0.1 + q * 0.005, chain: 'tail', ...FLUFF }));
  if (s.tail.plume) pieces.push({ key: 'plume', mesh: plumeOf(s, fine), bone: `tail${s.tail.links.length}`, bias: -0.06, after: [`tail${s.tail.links.length - 1}`] });
  // Hind legs: a thigh in curls, a slender cream shin going dark at the ankle with a cuff of feathers, a dark foot.
  const L = s.leg;
  for (const [i, key] of [[0, 'll'], [1, 'lr']] as Array<[number, string]>) {
    const sd = i ? 1 : -1, front: V3 = [sd * 0.8, 0.5, 0];
    // The thigh: on the bigger two a huge rounded drumstick of fleece from the hip down to the knee behind it, its outer side
    // green low down; on the Shearling a small one, mostly inside its fleece.
    const tc: V3 = s.quad ? [0, 0.02, -L.len[0] * 0.45] : [sd * L.w[0] * 0.45, -0.1, -L.len[0] * 0.38];
    const tr: V3 = s.quad ? [L.w[0] * 1.1, L.w[0] * 1.25, Math.max(L.len[0] * 0.7, L.w[0])] : [L.w[0] * 1.1, L.w[0] * 1.45, L.len[0] * 0.8];
    const thigh = fleeceEgg(tc, tr, s.curl.size * (s.quad ? 0.9 : 1.5), n, k, fine, 30 + i, () => false, (d) => (s.quad ? d[0] * sd > 0.35 && d[2] < -0.15 && d[1] < 0.5 : false));
    // A patch of green feathers low on the thigh, over the knee.
    const patch = mesh([], []);
    const shinMat = (u: number): Mat => (u > (s.quad ? 0.7 : 0.78) ? 'hoof' : 'muzzle');
    const shin = s.quad ? limb(L.len[1], L.w[1] * 1.15, L.w[1] * 0.85, n, k, shinMat) : shinOf(s, L.len[1], L.w[1], n + 4, fine, i);
    const cuff = cuffOf(-L.len[1] * (s.quad ? 0.45 : 0.8), L.w[1], s.feather.len * (s.quad ? 0.6 : 0.55), s.feather.w * 0.9, fine ? 8 : 5, fine, 101 + i);
    const knee = s.quad ? cuffOf(-L.len[0] * 0.75, L.w[0] * 0.9, s.feather.len * 0.75, s.feather.w, fine ? 7 : 4, fine, 111 + i) : moved(cuffOf(-L.len[0] * 0.78, L.w[0] * 1.05, s.feather.len * 1.1, s.feather.w * 1.2, fine ? 10 : 6, fine, 111 + i), [sd * L.w[0] * 0.4, -0.03, 0]);
    pieces.push(
      { key: `${key}0`, mesh: merge(thigh, patch), bone: `${key}0`, bias: 0.012, after: ['hips', ...(s.quad ? [] : ['torso'])], front, ...(s.quad ? FLUFF : { sheen: 'eyeWhite' as Mat }) },
      { key: `${key}k`, mesh: knee, bone: `${key}0`, bias: 0.012, after: ['hips', `${key}0`], front },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['hips', `${key}k`], front },
      { key: `${key}c`, mesh: cuff, bone: `${key}1`, bias: 0.017, after: [`${key}1`], front },
      { key: `${key}2`, mesh: footOf(s, n, k), bone: `${key}2`, bias: 0.02, after: ['hips', `${key}1`, `${key}c`], front },
    );
  }
  // Forelegs: the Shearling's cream with a cuff of feathers and a dark hoof; the bigger two's a green-feathered upper arm and dark forearms and paws.
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, front: V3 = [sd, 0.4, 0];
    const upperMat: Mat = s.quad ? 'mark' : 'coat';
    const foreMat = (u: number): Mat => (s.quad ? (u > 0.7 ? 'hoof' : 'muzzle') : u < 0.25 ? 'coatDark' : 'pad');
    const upper = merge(egg([0, 0, -0.02], UPRIGHT, [s.armW[0] * 1.4, s.armW[0] * 1.4, s.armW[0] * 1.5], n, k, upperMat), limb(s.arm[0], s.armW[0] * 1.15, s.armW[1] * 1.1, n, k, upperMat, false));
    const fore = limb(s.arm[1] - s.hand * (s.quad ? 0 : 0.4), s.armW[1] * 1.08, s.armW[1] * 0.9, n, k, foreMat);
    const cuff = s.quad
      ? cuffOf(-s.arm[1] * 0.42, s.armW[1], s.feather.len * 0.55, s.feather.w * 0.8, fine ? 7 : 4, fine, 121 + i)
      : cuffOf(-s.arm[0] * 0.55, s.armW[0] * 1.1, s.feather.len * 0.8, s.feather.w, fine ? 7 : 4, fine, 131 + i);
    pieces.push(
      { key: `arm${i}`, mesh: upper, bone: `arm${i}`, bias: 0.06, after: ['torso'], front, ...(s.quad ? FLUFF : {}) },
      { key: `armc${i}`, mesh: cuff, bone: s.quad ? `elbow${i}` : `arm${i}`, bias: 0.062, after: ['torso', `arm${i}`, 'cape'], front },
      { key: `fore${i}`, mesh: fore, bone: `elbow${i}`, bias: 0.065, after: ['torso', `arm${i}`, 'cape', 'mane'], front, thin: true },
      { key: `hand${i}`, mesh: pawOf(s, n, k), bone: `hand${i}`, bias: 0.07, after: ['torso', `fore${i}`, 'cape', 'mane', `armc${i}`], front },
    );
  }
  // The clip, only while it works.
  pieces.push({ key: 'clip', mesh: clipOf(s, n), bone: 'clip', bias: 0.08, after: ['hand0', 'hand1', 'torso', 'cape'], shown: (a) => a.act?.kind === 'work', ...FLUFF });
  return pieces;
}

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a pixel is, in the units `g` is drawing in. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const WOOL: RGB = [248, 240, 222];
const WOOL_INK: RGB = [178, 160, 132];
const GRAVITY = 6;

/** A tuft of fleece or a feather drifting from `from`, `since` seconds after, out and up, falling slowly. */
function tufts(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, size: number, green: RGB, life = 0.6): void {
  if (since < 0 || since > life) return;
  const px = pxOf(g);
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.7 * jitter(k + 1));
    const p: V3 = [from[0] + Math.cos(a) * sp * since, from[1] + Math.sin(a) * sp * since, Math.max(0.02, from[2] + 0.8 * (0.5 + jitter(k + 2)) * since - 0.5 * GRAVITY * 0.3 * since * since)];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p), al = 1 - smooth((since - life * 0.6) / (life * 0.4)), r = Math.max(size * (0.7 + 0.6 * jitter(k + 3)), px * 1.2);
    const feather = q % 4 === 3;
    const c = feather ? green : WOOL, spin = a * 3 + since * 7;
    g.fillStyle = css(c, al);
    g.strokeStyle = css(feather ? mix(green, [40, 50, 30], 0.5) : WOOL_INK, al);
    g.lineWidth = Math.max(px * 0.8, r * 0.18);
    g.beginPath();
    if (feather) g.ellipse(x, y, r * 1.5, r * 0.5, spin, 0, TAU);
    else for (let j = 0; j < 3; j++) g.arc(x + Math.cos(j * 2.1 + spin) * r * 0.5, y + Math.sin(j * 2.1 + spin) * r * 0.4, r * 0.62, 0, TAU);
    g.fill();
    g.stroke();
  }
}

/** A soft puff, growing and thinning over its life. */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, c: RGB): void {
  if (age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at), al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.8 * age);
  const grad = g.createRadialGradient(x, y, 0, x, y, rr);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
}

/** How big a stage's bits are drawn. */
const bigOf = (s: Roo): number => [0.7, 1, 1.35][s.stage];

/** What a go at its task throws: tufts of fleece and now and then a feather at each snip, and a puff as the clip goes. */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Roo, b: Bones, t: number, front: boolean, green: RGB): void {
  const W = SHEAR_WORK, mid = b.chest.t, T = ACT_SECS.work, big = bigOf(s);
  const at = mixV(place(b.hand0, [0, 0, -s.hand]), place(b.hand1, [0, 0, -s.hand]), 0.5);
  W.snips.forEach((c, q) => tufts(g, view, mid, at, (t - c) * T, front, 4, 13 + q * 11, 0.5 * big, 0.035 * big, green, 0.5));
  if (front && b.clip) puff(g, view, b.clip.t, 0.22 * big, (t - W.gone + 0.03) / 0.12, [255, 250, 236]);
}

/** What a strike throws: tufts of fleece off it as the blow lands, and the bigger two's thump of dust as they land again. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Roo, b: Bones, t: number, front: boolean, green: RGB): void {
  const since = (t - SHEAR_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t, big = bigOf(s);
  if (since <= 0) return;
  const at = s.quad ? place(b.head, skullAt(s)) : place(b.ll2, [0, s.leg.foot[0], -s.leg.heel]);
  tufts(g, view, mid, at, since, front, 6, 7 + s.stage * 5, 1.0 * big, 0.04 * big, green, 0.5);
  if (!s.quad && front) puff(g, view, [mid[0], mid[1], 0.1], 0.6 * big, (since - 0.15) / 0.4, [214, 204, 186]);
}

/** Evolving: tufts of fleece and leaf-feathers spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Roo, b: Bones, t: number, front: boolean, green: RGB): void {
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const R0 = s.hips.r[0] * 1.8 + 0.2, high = s.high + s.torso.z[4] + s.neck.len + 0.4, px = pxOf(g);
  for (let q = 0; q < 20; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.38), ang = (q / 20) * TAU + u * TAU * 1.5, k = (1 - u) ** 1.1;
    const p: V3 = [Math.cos(ang) * R0 * k, Math.sin(ang) * R0 * k, 0.2 + u * high * 0.8];
    if (nearSide(p, b.chest.t, view) !== front) continue;
    const [x, y] = onScreen(view, p), r = (0.06 + 0.025 * s.stage) * (1 - 0.4 * u), al = swirl * ramp(u, 0, 0.12);
    const feather = q % 2 === 0, c = feather ? green : WOOL;
    g.fillStyle = css(c, al);
    g.strokeStyle = css(feather ? mix(green, [40, 50, 30], 0.5) : WOOL_INK, al);
    g.lineWidth = Math.max(px * 0.8, r * 0.2);
    g.beginPath();
    if (feather) g.ellipse(x, y, r * 1.6, r * 0.55, ang * 2, 0, TAU);
    else g.arc(x, y, r * 0.8, 0, TAU);
    g.fill();
    g.stroke();
  }
}

/** Light over it as it evolves: a pale glow as it begins, and over its head at the turn. */
function rooGlow(s: Roo, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], tall = s.high + s.torso.z[4] + s.neck.len;
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.chest, [0, 0, s.torso.z[2]]), r: tall, c: [226, 238, 200], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.head, skullAt(s)), r: tall * 1.1, c: [250, 244, 214], a: k });
  return out;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** The brown of its feather tips, and their dark ends; its hooves and paws. */
const TIP: RGB = [150, 104, 70];
const TIP_DARK: RGB = [98, 66, 46];
const HOOF: RGB = [86, 58, 44];

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it works, strikes and evolves. */
function rooKind(s: Roo): Kind {
  const bones = rooBones(s);
  let green: RGB = [140, 160, 96];
  return {
    bones,
    build: (lod) => rooBuild(s, lod),
    // The variant's coat is its leaf-feathers, its markings its fleece and face; the rest the same on every variant.
    palette: (coat, mark) => {
      const sage = mix(coat, [126, 140, 64], 0.55), cream = mix(mark, [232, 190, 156], 0.62);
      green = sage;
      return coatPalette(coat, mark, {
        coat: sage,
        coatDark: mix(sage, [50, 60, 24], 0.32),
        coatLight: mix(sage, [196, 206, 130], 0.18),
        horn: mix(cream, TIP, 0.35),
        hornDark: mix(cream, TIP, 0.68),
        mark: cream,
        belly: mix(cream, [200, 152, 120], 0.35),
        muzzle: mix(cream, [255, 246, 232], 0.3),
        inner: mix(cream, [232, 168, 156], 0.45),
        nose: [176, 112, 100],
        lid: [70, 46, 36],
        eye: [134, 86, 46],
        claw: [46, 30, 24],
        pad: HOOF,
        hoof: HOOF,
        feather: TIP,
        featherDark: TIP_DARK,
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.hips.r[1] * 1.4 + (s.quad ? 0.3 : 0.4), s.hips.r[0] * 1.2],
    stride: 1.3,
    size: s.size,
    leaps: s.quad ? undefined : [true, true],
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are a leaf-feather's green and the fleece's cream.
    motes: [[160, 186, 112], [250, 240, 220]],
    glow: (b, a) => rooGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBurst(g, view, s, b, act.t, front, green);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front, green);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front, green);
    },
  };
}

export const SHEARLING = rooKind(SHEARLING_LOOK);
export const CLIPPEROO = rooKind(CLIPPEROO_LOOK);
export const SHEARLORD = rooKind(SHEARLORD_LOOK);
