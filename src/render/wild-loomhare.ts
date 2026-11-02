import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  scale, shadowOf, smile, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The cloth line: the Clothkit, a small round rabbit sitting up, cream with
 * soft lavender-grey patches on its back, its haunches, its ear tips and its
 * brow, tall ears pink inside, big amber eyes, a fluffy cream tail, a strip
 * of cream cloth held in its fore paws and its mouth and trailing to the
 * ground in loose folds; which grows into the Loomhare, a bigger hare sitting
 * up with its fore paws raised, working a cloth strip, a cream ruff at its
 * chest, lavender back and haunches with a cream spiral on each haunch, long
 * bandage strips draped over its back and flowing behind, marked with small
 * gold diamonds, a rolled bandage at its side; and then the Bandageweaver,
 * large and stately, sitting tall with its head raised, very long ears, a big
 * cream ruff with a gold diamond on it, its fore legs wrapped in bandage, and
 * wide bandage ribbons looping in big arcs over its head and out to either
 * side, a big roll of bandage at its side. The species is still `leecha`
 * underneath, as saves and the database know it: it makes bandages, healing
 * covers and salves in the settlement stores.
 *
 * Built the way the hamster line is (`./wild-hamster`): one set of functions
 * from a description of each stage (`Loom`), its hind legs bent to put each
 * long foot where it is to be and its fore legs to put each paw where it is
 * to be. It goes in hops: both hind feet push off together, it is in the air,
 * both fore paws come down, and the hind feet swing up past them. Every
 * ribbon and strip is a band with a lit front and a shaded back, its centre
 * line worked out each frame from the bones it hangs from (`Ribbon`), cut
 * into short lengths so each length goes down in front of or behind the body
 * by where it is. At its task it winds a strip between its fore paws into a
 * roll, the strip trailing from the roll to the ground.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Loom {
  stage: 0 | 1 | 2;
  /** How high the body's middle is carried, sitting. */
  high: number;
  /** The round rear of it, an egg in the body's frame. */
  hips: { c: V3; r: V3 };
  /** The right hip in the body's frame; thigh and shin; the haunch's half-sizes; the long foot's length and width; where the heel sits, from under the hip. */
  leg: { at: V3; len: [number, number]; haunch: V3; foot: [number, number]; heel: V3 };
  /** The chest's joint on the body and how far forward of upright it leans. */
  chest: { at: V3; lean: number };
  /** The torso's rings in the chest's frame, bottom to top: how high, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** The right shoulder in the chest's frame; upper arm and forearm; how thick each; the paw's size. */
  shoulder: V3;
  arm: [number, number];
  armW: [number, number];
  hand: number;
  /** Where the right paw is at rest, in the chest's frame; or on the ground, along it from under the body's middle. */
  paw: V3;
  pawDown?: V3;
  neck: { at: V3; len: number; w: number };
  /** The skull's half-sizes, how far its middle is over the top of the neck, how it is pitched (nose up). */
  head: { r: V3; up: number; pitch: number };
  eye: { dir: V3; size: number };
  /** The right ear's root (a way out of the skull), its length and half-width, laid back and splayed out, its hollow turned out about its length, the right one laid back further (degrees). */
  ear: { dir: V3; len: number; w: number; back: number; splay: number; turn: number; lop: number };
  /** The ruff at its chest: tufts round, their length, how many rows. */
  ruff: { count: number; len: number; rows: number };
  /** The tail's root on the body and how big its puff is. */
  tail: { at: V3; r: number };
  /** How much of the back is lavender: patches (nought) or the whole back and haunches (one); a spiral on each haunch. */
  saddle: number;
  spiral: boolean;
  /** Fore legs wrapped in bandage; a gold diamond on the ruff. */
  wrapped: boolean;
  diamond: boolean;
  /** The roll of bandage at its side: its radius and length; none for nought. */
  roll: [number, number];
  /** The roll it winds at its task: its radius and length. */
  wind: [number, number];
  /** How wide its bandages are. */
  band: number;
  gait: { reach: number; lift: number };
  size: number;
}

/** A Clothkit: small and round, sitting low, a big head with tall ears, a strip of cloth in its paws and its mouth. */
const CLOTHKIT_LOOK: Loom = {
  stage: 0,
  high: 0.34,
  hips: { c: [0, -0.1, 0.02], r: [0.42, 0.48, 0.36] },
  leg: { at: [0.24, -0.12, -0.12], len: [0.2, 0.2], haunch: [0.17, 0.27, 0.24], foot: [0.36, 0.1], heel: [0.25, -0.34, 0] },
  chest: { at: [0, 0.2, 0.02], lean: 36 },
  torso: { z: [-0.12, 0.08, 0.24, 0.34], y: [-0.02, 0.02, 0.02, 0], w: [0.36, 0.33, 0.27, 0.2], h: [0.33, 0.31, 0.25, 0.18] },
  shoulder: [0.19, 0.1, 0.22],
  arm: [0.15, 0.15], armW: [0.065, 0.055], hand: 0.06,
  paw: [0.07, 0.34, 0.3],
  neck: { at: [0, 0.02, 0.32], len: 0.04, w: 0.2 },
  head: { r: [0.31, 0.32, 0.28], up: 0.2, pitch: 0 },
  eye: { dir: [0.52, 0.72, 0.22], size: 0.085 },
  ear: { dir: [0.34, -0.3, 0.9], len: 0.66, w: 0.2, back: 8, splay: 20, turn: 30, lop: 22 },
  ruff: { count: 12, len: 0.1, rows: 1 },
  tail: { at: [0, -0.56, 0.02], r: 0.13 },
  saddle: 0, spiral: false, wrapped: false, diamond: false,
  roll: [0, 0], wind: [0.11, 0.22], band: 0.16,
  gait: { reach: 0.5, lift: 0.18 },
  size: 5.2,
};

/** A Loomhare: bigger, sitting up with its paws raised to a strip, a cream ruff, lavender back and haunches with a spiral, strips over its back. */
const LOOMHARE_LOOK: Loom = {
  stage: 1,
  high: 0.46,
  hips: { c: [0, -0.16, 0.02], r: [0.54, 0.64, 0.47] },
  leg: { at: [0.31, -0.18, -0.16], len: [0.27, 0.27], haunch: [0.22, 0.36, 0.32], foot: [0.5, 0.13], heel: [0.33, -0.48, 0] },
  chest: { at: [0, 0.24, 0.1], lean: 14 },
  torso: { z: [-0.16, 0.14, 0.4, 0.54], y: [-0.03, 0.03, 0.03, 0], w: [0.44, 0.41, 0.32, 0.24], h: [0.41, 0.39, 0.3, 0.22] },
  shoulder: [0.25, 0.12, 0.38],
  arm: [0.22, 0.21], armW: [0.085, 0.07], hand: 0.075,
  paw: [0.13, 0.4, 0.3],
  neck: { at: [0, 0.03, 0.52], len: 0.06, w: 0.25 },
  head: { r: [0.34, 0.38, 0.31], up: 0.22, pitch: 0 },
  eye: { dir: [0.54, 0.72, 0.22], size: 0.082 },
  ear: { dir: [0.32, -0.32, 0.9], len: 0.98, w: 0.26, back: 16, splay: 18, turn: 30, lop: 22 },
  ruff: { count: 20, len: 0.22, rows: 3 },
  tail: { at: [0, -0.76, 0.04], r: 0.16 },
  saddle: 0.75, spiral: true, wrapped: false, diamond: false,
  roll: [0.15, 0.3], wind: [0.13, 0.26], band: 0.17,
  gait: { reach: 0.66, lift: 0.22 },
  size: 5.6,
};

/** A Bandageweaver: large and stately, sitting tall, its head raised, very long ears, a great ruff, bandaged fore legs, ribbons looped round it. */
const BANDAGEWEAVER_LOOK: Loom = {
  stage: 2,
  high: 0.62,
  hips: { c: [0, -0.26, 0.04], r: [0.72, 0.92, 0.62] },
  leg: { at: [0.42, -0.3, -0.22], len: [0.36, 0.36], haunch: [0.32, 0.55, 0.48], foot: [0.72, 0.18], heel: [0.46, -0.72, 0] },
  chest: { at: [0, 0.4, 0.1], lean: 2 },
  torso: { z: [-0.25, 0.15, 0.5, 0.72], y: [-0.06, 0.06, 0.06, 0], w: [0.6, 0.56, 0.46, 0.34], h: [0.55, 0.52, 0.42, 0.3] },
  shoulder: [0.34, 0.16, 0.3],
  arm: [0.5, 0.56], armW: [0.19, 0.17], hand: 0.15,
  paw: [0.26, 0.44, 0.1],
  pawDown: [0.3, 0.86, 0],
  neck: { at: [0, 0.05, 0.7], len: 0.12, w: 0.36 },
  head: { r: [0.44, 0.5, 0.4], up: 0.28, pitch: 22 },
  eye: { dir: [0.56, 0.7, 0.2], size: 0.09 },
  ear: { dir: [0.3, -0.45, 0.84], len: 1.7, w: 0.27, back: 46, splay: 12, turn: 50, lop: 10 },
  ruff: { count: 24, len: 0.36, rows: 3 },
  tail: { at: [0, -1.12, 0.06], r: 0.22 },
  saddle: 1, spiral: true, wrapped: true, diamond: true,
  roll: [0.26, 0.52], wind: [0.17, 0.34], band: 0.26,
  gait: { reach: 0.9, lift: 0.26 },
  size: 5.8,
};

const LOOKS: readonly Loom[] = [CLOTHKIT_LOOK, LOOMHARE_LOOK, BANDAGEWEAVER_LOOK];

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
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

/** An egg with its axes along a frame. */
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
/** The way out of a face of the egg `(c, r)` at the point `p`, scaled to the egg: (-1..1) on each axis. */
const onEggDir = (c: V3, r: V3, p: V3): V3 => [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];

/** Soft lavender patches over cream, broken up as a rabbit's are. Above nought is lavender. */
const patchy = (p: V3, seed: number): number =>
  Math.sin(p[0] * 4.3 + seed) * Math.sin(p[1] * 3.6 + 1.7 * seed + p[2] * 1.4) + 0.6 * Math.sin(p[2] * 5.2 - p[0] * 2.1 + seed * 0.7);

/** Whether a point on the coat (its way out of what it is on, scaled) is lavender: up the back and over the haunches, cream under and in front. */
function lavenderAt(s: Loom, d: V3, seed: number): boolean {
  const top = d[2] + 0.35 * -d[1];
  if (s.saddle > 0) return top > 0.55 - s.saddle * 0.75 + 0.12 * patchy(d, seed) && d[1] < 0.55;
  return top > 0.35 && patchy(scale(d, 0.6), seed) > -0.1;
}

/** Two bones bent to put the end of the second at `to` from `from`, the joint between them bowed toward `hint`. */
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

/** The torso's ring at height `z` in the chest's frame. */
function torsoAt(s: Loom, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/** A point on the torso at height `z`, `a` radians round from its right side (a quarter turn is its front), lifted `out` off it. */
function onTorso(s: Loom, z: number, a: number, out = 0): { p: V3; n: V3 } {
  const r = torsoAt(s, z), n = unit([Math.cos(a) / r.w, Math.sin(a) / r.h, 0]);
  return { p: add([Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z], scale(n, out)), n };
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of it: a cuff with both fore paws. */
export const LOOM_HITS: readonly number[] = [0.46, 0.5, 0.54];
/** A go at its task, as shares of it: each turn of the roll between its paws, and when the strip is drawn taut. */
export const LOOM_WORK = { winds: [0.22, 0.47, 0.72] as const, tug: 0.88 } as const;

/* ---- poses ------------------------------------------------------------------------------ */

interface Plan {
  /** Each heel, left then right, along the ground; each long foot pitched toe-down past flat. */
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left past how it is carried. */
  chest: V3;
  neck: number[]; head: V3;
  /** Each paw in the chest's frame; and on the ground, along it, as much as `down` says. */
  hand: V3[]; ground: V3[]; down: number[];
  /** Each ear laid back and splayed out past how it is carried. */
  ears: number[][];
  tail: number[];
  /** The roll it winds, between its paws, and how far it has turned. */
  wind: number; spin: number;
  /** Its mouth on the strip (the Clothkit's), and how the strips stream behind it. */
  bite: number; stream: number;
}

function zip<T>(a: T, b: T, f: (x: number, y: number) => number): T {
  if (typeof a === 'number') return f(a, b as unknown as number) as unknown as T;
  if (Array.isArray(a)) return a.map((x, i) => zip(x, (b as unknown as unknown[])[i], f)) as unknown as T;
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(a as object)) o[k] = zip((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], f);
  return o as T;
}
const mixPlan = (a: Plan, b: Plan, k: number): Plan => zip(a, b, (x, y) => lerp(x, y, k));
const shifted = (p: Plan, to: Plan, from: Plan): Plan => zip(p, zip(to, from, (x, y) => x - y), (x, d) => x + d);

const heelRest = (s: Loom, sd: number): V3 => [sd * s.leg.heel[0], s.leg.heel[1], s.leg.heel[2]];
const pawRest = (s: Loom): V3[] => [[-s.paw[0], s.paw[1], s.paw[2]], [...s.paw]];
const groundRest = (s: Loom): V3[] => {
  const d = s.pawDown ?? [s.paw[0] * 1.6, s.chest.at[1] + s.shoulder[1] + 0.12, 0];
  return [[-d[0], d[1], d[2]], [...d]];
};

function restPlan(s: Loom): Plan {
  const down = s.pawDown ? 1 : 0;
  return {
    at: [heelRest(s, -1), heelRest(s, 1)], foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0],
    hand: pawRest(s), ground: groundRest(s), down: [down, down],
    ears: [[0, 0], [0, 0]], tail: [0, 0], wind: 0, spin: 0, bite: s.stage === 0 ? 1 : 0, stream: 0,
  };
}

/**
 * Going, in hops: both long hind feet down under it, swept back at the ground's own speed so they never skate, the body sinking
 * onto them and then thrown up off them; in the air, the hind feet stretched out behind and then swung forward under it, the
 * fore paws reaching down ahead for the landing, the body nose-up off the ground and nose-down onto it, the ears laid back and
 * the strips streaming. Only the hind feet are its feet (`gaitOf`), so the fore paws are named for arms (`al`, `ar`).
 */
const HIND_DOWN = 0.42;
function goingPlan(s: Loom, a: Anim): Plan {
  const p = restPlan(s), w = frac(a.u), G = s.gait, v = G.reach, half = (v * HIND_DOWN) / 2;
  p.bite = 0;
  p.stream = 1;
  const k = w / HIND_DOWN, u = (w - HIND_DOWN) / (1 - HIND_DOWN), up = w >= HIND_DOWN;
  const air = up ? Math.sin(Math.PI * u) : 0;
  for (let i = 0; i < 2; i++) {
    const A = heelRest(s, i ? 1 : -1);
    if (!up) {
      p.at[i] = [A[0], A[1] + half * (1 - 2 * k), 0];
      // Up onto its toes as it pushes off.
      p.foot[i] = 46 * ramp(k, 0.55, 1);
    } else {
      // Stretched out behind off the push, then swung forward under it to land.
      const y = hermite(A[1] - half, A[1] + half, -v * 0.6, v * 0.2, smooth(u));
      p.at[i] = [A[0], y - s.leg.len[1] * 0.9 * Math.sin(Math.PI * clamp(u * 1.4)) ** 2, s.leg.len[1] * 0.5 * air];
      p.foot[i] = 46 * (1 - ramp(u, 0, 0.4)) + 30 * hump(u, 0.3, 0.3) - 10 * hump(u, 0.85, 0.15);
    }
  }
  // The body: sinking onto its feet, thrown up and forward, and down.
  const sink = up ? 0 : Math.sin(Math.PI * k);
  p.H = s.high * (1 - 0.1 * sink) + G.lift * s.high * 2.4 * air;
  p.squash = 0.06 * hump(w, 0.04, 0.08);
  p.pitch = up ? 14 * Math.cos(Math.PI * u) : 8 * ramp(k, 0.5, 1) - 6 * (1 - ramp(k, 0, 0.3));
  p.chest = [18 + 10 * sink - 6 * air, 0, 0];
  p.neck = [-6, 0];
  p.head = [-p.pitch * 0.6, 0, 0];
  // The fore paws tucked at its chest on the ground, reached out ahead and down for the landing in the air.
  const reach: V3 = [s.paw[0], s.shoulder[1] + s.arm[0] + s.arm[1] * 0.6, s.shoulder[2] - s.arm[1] * 0.7];
  p.down = [0, 0];
  p.hand = pawRest(s).map((h, i) => mixV(h, [(i ? 1 : -1) * reach[0], reach[1], reach[2]], up ? ramp(u, 0.2, 0.75) : 1 - ramp(k, 0, 0.4))) as V3[];
  const lay = up ? 26 * air + 8 : 8 * (1 - k);
  p.ears = [[lay, 4], [lay + 4 * Math.sin(TAU * w), 4]];
  p.tail = [14 * air, 0];
  return p;
}
/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}

/** Sitting about: breathing, looking about with its nose working, an ear swivelled and flicked now and then, a thump of a hind foot. */
function stillPlan(s: Loom, a: Anim): Plan {
  const p = restPlan(s), t = a.t, look = drift(t);
  p.chest = [1.5 * (a.breath - 0.5), 6 * look * 0.4, 0];
  p.neck = [0, -10 + 6 * look];
  p.head = [2 * cyc(t, 4) + 2 * Math.sin(t * 13) * beat(t, [1.4, 9.8, 16.2], 0.7), -10 + 8 * look, 4 * drift(t, 3)];
  p.H += 0.01 * s.high * (a.breath - 0.5);
  const flickL = beat(t, [3.1, 15.7], 0.5), flickR = beat(t, [5.4, 11.6, 20.2], 0.5);
  p.ears = [[3 * cyc(t, 3) + 20 * flickL, -6 * flickL], [3 * cyc(t, 3, 1) + 20 * flickR, -6 * flickR]];
  p.tail = [4 * cyc(t, 3), 10 * cyc(t, 4)];
  // A thump of the right hind foot.
  const th = beat(t, [7.5], 0.35);
  p.at[1] = add(p.at[1], [0, 0.02, s.leg.len[1] * 0.4 * th]);
  p.foot[1] = -12 * th;
  // Its paws working at the strip.
  const fid = cyc(t, 6) * 0.5 + cyc(t, 11) * 0.5;
  p.hand = p.hand.map((h, i) => add(h, [0, 0.015 * fid * (i ? 1 : -1), 0.02 * fid])) as V3[];
  return p;
}

/** Nibbling at the ground: head down, nose working. */
function grazePlan(s: Loom, a: Anim): Plan {
  const p = restPlan(s), t = a.t, nib = Math.sin(t * TAU * 3);
  p.bite = 0;
  p.chest = [34, 0, 0];
  p.neck = [36, 0];
  p.head = [-18 + 4 * nib, 6 * drift(t, 2), 0];
  p.down = [1, 1];
  p.ears = [[10, 4], [10, 4]];
  return p;
}

/** A strike: up on its haunches, both fore paws drawn back and cuffed forward together, and down. */
function strikePlan(s: Loom, t: number): Plan {
  const p = restPlan(s), hit = LOOM_HITS[s.stage];
  const up = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.72, 0.96));
  const back = ramp(t, 0.12, hit - 0.1) * (1 - ramp(t, hit - 0.1, hit));
  const out = ramp(t, hit - 0.12, hit) * (1 - ramp(t, hit + 0.12, 0.9));
  p.bite = 0;
  p.H += s.high * 0.35 * up;
  p.chest = [-8 * up + 22 * out, 0, 0];
  p.neck = [-6 * up + 8 * out, 0];
  p.head = [-6 * out, 0, 0];
  p.down = [0, 0];
  const top = s.torso.z[s.torso.z.length - 1];
  p.hand = p.hand.map((h, i) => {
    const sd = i ? 1 : -1, guard: V3 = [sd * s.shoulder[0] * 0.9, s.shoulder[1] + s.arm[0] * 0.4, top * 0.8];
    const cuff: V3 = [sd * s.shoulder[0] * 0.5, s.shoulder[1] + (s.arm[0] + s.arm[1]) * 0.95, top * 0.75];
    return mixV(mixV(h, guard, up), cuff, out);
  }) as V3[];
  p.ears = [[24 * back - 10 * out, 6 * out], [24 * back - 10 * out, 6 * out]];
  p.tail = [14 * up, 0];
  return p;
}

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/** Where the roll it winds is held, in the chest's frame. */
function windAt(s: Loom): V3 {
  const z = s.shoulder[2] - s.arm[0] * 0.3, r = torsoAt(s, z);
  return [0, r.y + r.h + s.ruff.len * 0.45 + s.wind[0] * 1.5, z];
}

/**
 * A go at its task: the roll held out before its chest in both paws, turned over and over toward it (`LOOM_WORK.winds`, a turn
 * each), the strip drawn up off the ground into it; its head bowed to the roll, nodding with each turn, and the strip tugged
 * taut at the end.
 */
function workPlan(s: Loom, t: number, down: number): Plan {
  const p = restPlan(s), W = LOOM_WORK;
  p.bite = 0;
  p.wind = 1;
  // Three turns a go, one go after another seamless: a whole number of turns.
  const ang = TAU * W.winds.length * t;
  p.spin = ang;
  const C = windAt(s), r = s.wind[0] * 0.9, half = s.wind[1] * 0.5 + s.hand * 0.6;
  // Both paws go round the roll together, rolling it toward the chest: over the top toward it and under away.
  p.hand = [-1, 1].map((sd) => add(C, [sd * half, -r * Math.sin(ang), r * Math.cos(ang)])) as V3[];
  p.down = [0, 0];
  const tug = hump(t, W.tug, 0.08);
  p.chest = [10 + 4 * tug, 0, 0];
  p.neck = [14, 0];
  p.head = [-18 + 4 * Math.sin(ang), 0, 3 * Math.sin(ang * 0.5)];
  p.ears = [[8 + 6 * tug, 2], [8 + 6 * tug, 2]];
  p.tail = [0, 6 * Math.sin(ang)];
  return mixPlan(restPlan(s), p, down);
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its ears pricked, a shake, and settled. */
function evolvePlan(s: Loom, t: number): Plan {
  const p = restPlan(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * 60);
  p.H += s.high * (-0.12 * hunch + 0.22 * up);
  p.chest = [16 * hunch - 10 * up, 0, 0];
  p.neck = [10 * hunch - 4 * up, 0];
  p.head = [-14 * hunch + 16 * up, 0, 10 * shake];
  p.roll = 2 * shake;
  p.ears = [[24 * hunch - 12 * up + 14 * Math.abs(shake), 12 * hunch], [24 * hunch - 12 * up + 14 * Math.abs(shake), 12 * hunch]];
  p.tail = [-8 * hunch + 16 * up, 10 * shake];
  p.stream = up;
  return p;
}

function planOf(s: Loom, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, a), restPlan(s));
  if (act?.kind === 'strike') return over(strikePlan(s, act.t));
  if (act?.kind === 'work') return over(workPlan(s, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, act.t));
  if (a.graze > 0 && a.go <= 0) return mixPlan(stillPlan(s, a), grazePlan(s, a), smooth(a.graze));
  if (a.go <= 0) return stillPlan(s, a);
  const going = goingPlan(s, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, a), going, smooth(a.go));
}

/* ---- its bones ------------------------------------------------------------------------- */

const skullAt = (s: Loom): V3 => [0, 0.03, s.head.up];
/** Where its mouth is on the head: the strip's end in it. */
const mouthOf = (s: Loom): V3 => add(skullAt(s), [0, s.head.r[1] * 0.92, -s.head.r[2] * 0.5]);

/** A stage's bones, and the plan they were posed from. */
type LoomBones = ((a: Anim) => Bones) & { planAt(a: Anim): Plan };
function loomBones(s: Loom): LoomBones {
  const L = s.leg;
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body, root: ROOT };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.chest.lean + P.chest[0];
    b.chest = joint(body, s.chest.at, -lean, P.chest[2], P.chest[1]);
    b.neck = joint(b.chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, e = onEgg(skullAt(s), s.head.r, [sd * s.ear.dir[0], s.ear.dir[1], s.ear.dir[2]]);
      b[`ear${i}`] = joint(joint(b.head, add(e.p, scale(e.n, -0.02)), s.ear.back + (i ? s.ear.lop : 0) + P.ears[i][0], sd * (s.ear.splay + P.ears[i][1])), [0, 0, 0], 0, 0, sd * -s.ear.turn);
    }
    b.tail = joint(body, s.tail.at, -P.tail[0], 0, P.tail[1]);
    // Hind legs: the hip in the haunch, the knee forward and down, the heel behind on the ground, the long foot along it.
    const fwd = turn(body, [0, 1, 0]);
    const flat = unit([fwd[0], fwd[1], 0]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, key = i ? 'hr' : 'hl';
      const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
      const { mid: knee, end: heel } = bend2(hip, P.at[i], L.len[0], L.len[1], add(scale(fwd, 1), [0, 0, -0.3]));
      const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, heel), fwd);
      b[`${key}0`] = xfOf(X0, Y0, Z0, hip);
      b[`${key}1`] = xfOf(X1, Y1, Z1, knee);
      const [X2, Y2, Z2] = frameOf([0, 0, 1], flat);
      b[`${key}2`] = joint(xfOf(X2, Y2, Z2, heel), [0, 0, 0], -P.foot[i]);
    }
    // Fore legs: each paw where the pose puts it, in the chest's frame or on the ground.
    const cf = turn(b.chest, [0, 1, 0]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, key = i ? 'ar' : 'al';
      const want = mixV(place(b.chest, P.hand[i]), P.ground[i], P.down[i]);
      const sh = place(b.chest, [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      const { mid: el, end: wr } = bend2(sh, want, s.arm[0], s.arm[1], turn(b.chest, unit([sd * 0.5, -0.8, -0.3])));
      const [X0, Y0, Z0] = frameOf(sub(sh, el), cf), [X1, Y1, Z1] = frameOf(sub(el, wr), cf);
      b[`${key}0`] = xfOf(X0, Y0, Z0, sh);
      b[`${key}1`] = xfOf(X1, Y1, Z1, el);
      // The paw: level on the ground when it is down, carried along the forearm when it is up.
      const [X2, Y2, Z2] = frameOf(mixV(Z1, [0, 0, 1], P.down[i]), unit(add(cf, [0, 0, 0])));
      b[`${key}2`] = xfOf(X2, Y2, Z2, wr);
    }
    // The roll it winds, between its paws, its axle across, turned as it is wound.
    {
      const m = scale(add(b.al2.t, b.ar2.t), 0.5), X = turn(b.chest, [1, 0, 0]);
      const Y0 = turn(b.chest, [0, 1, 0]), Z0 = turn(b.chest, [0, 0, 1]);
      const c = Math.cos(P.spin), sn = Math.sin(P.spin);
      const k = Math.max(0.001, P.wind);
      const Y = add(scale(Y0, c), scale(Z0, sn)), Z = sub(scale(Z0, c), scale(Y0, sn));
      b.roll = { m: xfOf(scale(X, k), scale(Y, k), scale(Z, k), m).m, t: add(m, scale(turn(b.chest, [0, 0.02, -0.01]), 1)) };
    }
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high));
    return b;
  };
  const seen = new WeakMap<Anim, Bones>();
  const plans = new WeakMap<Anim, Plan>();
  const bones = (a: Anim): Bones => {
    const had = seen.get(a);
    if (had) return had;
    const P = planOf(s, { ...a, go: a.act ? 0 : a.go });
    const b = pose(P);
    seen.set(a, b);
    plans.set(a, P);
    return b;
  };
  return Object.assign(bones, { planAt: (a: Anim): Plan => { bones(a); return plans.get(a)!; } });
}

/* ---- ribbons --------------------------------------------------------------------------- */

/** A point a ribbon's centre line goes through: on a bone, the way its face is turned there, and how wide it is. */
interface Knot { bone: string; p: V3; n: V3; w: number }
/**
 * A band of cloth: through its knots, smoothly, a lit front and a shaded back; cut into `pieces` lengths, each going down by
 * where it is; with gold diamonds on its front at `marks` along it (nought to one); shaken along its free length (`free`, from
 * that share of it on, more toward the end) by the wind and by its going.
 */
interface Ribbon {
  key: string;
  knots: (b: Bones, a: Anim, P: Plan) => Knot[];
  /** Points between two knots. */
  steps: number;
  pieces: number;
  marks: number[];
  free: number;
  /** How far it shakes, against its width. */
  flap: number;
  shown?: (a: Anim) => boolean;
}

interface Line { p: V3[]; n: V3[]; a: V3[]; t: V3[]; w: number[] }

/** A ribbon's centre line on posed bones: through its knots by Catmull-Rom, each point's face square to the line. */
function lineOf(R: Ribbon, b: Bones, a: Anim, P: Plan, knots?: Knot[]): Line {
  const K = (knots ?? R.knots(b, a, P)).map((k) => { const x = b[k.bone] ?? ROOT; return { p: place(x, k.p), n: unit(turn(x, k.n)), w: k.w }; });
  const p: V3[] = [], n: V3[] = [], w: number[] = [];
  const N = K.length;
  for (let i = 0; i < N - 1; i++) {
    const p0 = K[Math.max(0, i - 1)].p, p1 = K[i].p, p2 = K[i + 1].p, p3 = K[Math.min(N - 1, i + 2)].p;
    for (let q = 0; q < R.steps; q++) {
      const t = q / R.steps, t2 = t * t, t3 = t2 * t;
      const c = (j: number): number => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      p.push([c(0), c(1), c(2)]);
      n.push(unit(mixV(K[i].n, K[i + 1].n, smooth(t))));
      w.push(lerp(K[i].w, K[i + 1].w, t));
    }
  }
  p.push(K[N - 1].p);
  n.push(K[N - 1].n);
  w.push(K[N - 1].w);
  // Shaken: across its face, more toward its free end, a wave running down it.
  const M = p.length, flap = R.flap * (0.35 + 0.65 * Math.max(P.stream, a.go));
  if (flap > 0) {
    for (let q = 0; q < M; q++) {
      const u = q / (M - 1);
      if (u <= R.free) continue;
      const f = ((u - R.free) / (1 - R.free)) ** 1.4;
      const wave = Math.sin(a.t * (4 + 3 * a.go) - u * 7 + R.key.length) * f * flap * w[q];
      p[q] = add(p[q], scale(n[q], wave));
    }
  }
  const t: V3[] = [], ac: V3[] = [];
  for (let q = 0; q < M; q++) {
    const d = unit(sub(p[Math.min(M - 1, q + 1)], p[Math.max(0, q - 1)]));
    let x = cross(d, n[q]);
    if (len3(x) < 1e-4) x = cross(d, [0, 0, 1]);
    x = unit(x);
    t.push(d);
    ac.push(x);
    n[q] = unit(cross(x, d));
  }
  return { p, n, a: ac, t, w };
}

/** Where each piece of a ribbon starts and ends along its points. */
function spans(M: number, pieces: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let k = 0; k < pieces; k++) out.push([Math.round((k * (M - 1)) / pieces), Math.round(((k + 1) * (M - 1)) / pieces)]);
  return out;
}

/** One piece of a ribbon's corners, from point `i0` to `i1`: the front's two edges, the back's, and a diamond at each mark in it. */
function cornersOf(L: Line, i0: number, i1: number, marks: number[], diamond: number): V3[] {
  const v: V3[] = [];
  for (let q = i0; q <= i1; q++) {
    const h = scale(L.a[q], L.w[q] * 0.5);
    v.push(add(L.p[q], h), sub(L.p[q], h));
  }
  for (let q = i0; q <= i1; q++) {
    const h = scale(L.a[q], L.w[q] * 0.5), back = scale(L.n[q], -0.004);
    v.push(add(add(L.p[q], h), back), add(sub(L.p[q], h), back));
  }
  const M = L.p.length;
  for (const u of marks) {
    const q = Math.round(u * (M - 1));
    if (q < i0 || q >= i1) continue;
    const c = add(L.p[q], scale(L.n[q], 0.006)), d = L.w[q] * diamond;
    v.push(add(c, scale(L.t[q], d * 1.25)), sub(c, scale(L.a[q], d * 0.75)), sub(c, scale(L.t[q], d * 1.25)), add(c, scale(L.a[q], d * 0.75)));
    // Its bright middle.
    v.push(add(c, scale(L.n[q], 0.003)), add(c, add(scale(L.t[q], d * 0.55), scale(L.n[q], 0.003))), add(c, add(scale(L.a[q], -d * 0.3), scale(L.n[q], 0.003))), add(c, add(scale(L.t[q], -d * 0.55), scale(L.n[q], 0.003))));
  }
  return v;
}

/** The faces of a piece made by `cornersOf`: front quads lit, back quads shaded, the diamonds as decals on the front. */
function facesOf(count: number, marks: number): Face[] {
  const f: Face[] = [], back = count * 2;
  for (let q = 0; q < count - 1; q++) {
    const r0 = q * 2, l0 = q * 2 + 1, r1 = q * 2 + 2, l1 = q * 2 + 3;
    f.push({ i: [r0, r1, l1, l0], m: 'cloth' });
    f.push({ i: [back + r0, back + l0, back + l1, back + r1], m: 'clothDark' });
  }
  for (let k = 0; k < marks; k++) {
    const o = back * 2 + k * 8;
    f.push({ i: [o, o + 1, o + 2, o + 3], m: 'fitting', decal: true });
    f.push({ i: [o + 4 + 1, o + 4 + 2, o + 4 + 3], m: 'bloom', decal: true, lit: true });
  }
  return f;
}

/** A ribbon's pieces: each on the root, its corners worked out from the posed bones every frame. */
function ribbonPieces(s: Loom, R: Ribbon, bones: LoomBones, bias: number): Piece[] {
  const rest: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
  const L0 = lineOf(R, bones(rest), rest, bones.planAt(rest));
  const M = L0.p.length, out: Piece[] = [];
  const lines = new WeakMap<Anim, Line>();
  const lineAt = (a: Anim): Line => {
    let l = lines.get(a);
    if (!l) { l = lineOf(R, bones(a), a, bones.planAt(a)); lines.set(a, l); }
    return l;
  };
  spans(M, R.pieces).forEach(([i0, i1], k) => {
    const marks = R.marks.filter((u) => { const q = Math.round(u * (M - 1)); return q >= i0 && q < i1; });
    const v = cornersOf(L0, i0, i1, marks, 0.32);
    const m = mesh(v, facesOf(i1 - i0 + 1, marks.length));
    out.push({
      key: `${R.key}${k}`, mesh: m, bone: 'root', bias, chain: R.key,
      bent: (_v, a) => cornersOf(lineAt(a), i0, i1, marks, 0.32),
      ...(R.shown ? { shown: R.shown } : {}),
    });
  });
  void s;
  return out;
}

/* ---- what it is made of ------------------------------------------------------------- */

/** A tuft of fur: a soft flattened lobe from `root` out to `tip`, its flat side facing `face`, sagging `bend` in the middle. */
const tuft = (root: V3, tip: V3, r: number, face: V3, mat: Mat, bend = 0): Mesh => {
  const mid = add(mixV(root, tip, 0.5), [0, 0, bend]);
  return tube([root, mid, tip], [r * 0.8, r, 0], [r * 0.4, r * 0.5, 0], 5, mat, { up: face });
};

/** A patch painted onto the egg `(C, R)` round the way `dir`. */
function patchOn(C: V3, R: V3, dir: V3, rx: number, ry: number, mat: Mat, spin = 0, lift = 0.012, sides = 12): Disc {
  const e = onEgg(C, R, dir), d = disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, sides, mat, { spin, at: add(e.p, scale(e.n, -0.02)) });
  return { ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); }) };
}

/** A spiral painted on the egg `(C, R)` round the way `dir`: a cream line winding out `turns` times to `rad`. */
function spiralOn(C: V3, R: V3, dir: V3, rad: number, turns: number, w: number, m: Mat): Disc {
  const e = onEgg(C, R, dir), n = e.n;
  let u = cross([0, 0, 1], n);
  if (len3(u) < 1e-4) u = [1, 0, 0];
  u = unit(u);
  const vv = cross(n, u);
  const N = Math.round(14 * turns), pts: V3[] = [], ns: V3[] = [];
  for (let q = 0; q <= N; q++) {
    const f = q / N, a = f * turns * TAU, r = rad * (0.1 + 0.9 * f);
    const flat = add(e.p, add(scale(u, Math.cos(a) * r), scale(vv, Math.sin(a) * r)));
    const on = onEgg(C, R, sub(flat, C));
    pts.push(add(on.p, scale(on.n, 0.014)));
    ns.push(on.n);
  }
  const edge = (q: number, k: number): V3 => {
    const t = unit(sub(pts[Math.min(N, q + 1)], pts[Math.max(0, q - 1)])), sd = unit(cross(ns[q], t));
    return add(pts[q], scale(sd, k * w * (0.55 + 0.45 * (q / N))));
  };
  const v = [...pts.map((_, q) => edge(q, 1)), ...pts.map((_, q) => edge(N - q, -1))];
  // Wound to face out of the egg.
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]); ny += (p[2] - r[2]) * (p[0] + r[0]); nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m };
}

/** The head: a round cream skull, a lavender patch on the brow, fluffy cheeks, a small muzzle with a pink nose, big amber eyes. */
function headOf(s: Loom, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), R = H.r, seed = 2.1 + s.stage;
  const skull = painted(orb(C, R, n + 8, k + 5, 'mark'), (c) => {
    const d = onEggDir(C, R, c);
    // A patch on the brow, narrowing down toward the nose; on the bigger two running back over the crown to the nape.
    if (d[2] > 0.32 && d[1] > -0.35 && Math.abs(d[0]) < 0.2 + 0.32 * d[2] - 0.12 * Math.max(0, d[1]) + 0.04 * Math.sin(d[1] * 9 + seed)) return 'coat';
    if (s.saddle > 0 && d[1] < -0.4 && d[2] > -0.35 + 0.3 * Math.abs(d[0])) return 'coat';
    return 'mark';
  });
  const cheeks = [1, -1].map((sd) => egg(add(C, [sd * R[0] * 0.5, R[1] * 0.32, -R[2] * 0.38]), UPRIGHT, [R[0] * 0.5, R[1] * 0.5, R[2] * 0.48], n, k, 'mark'));
  const mc: V3 = add(C, [0, R[1] * 0.74, -R[2] * 0.3]), mr: V3 = [R[0] * 0.36, R[1] * 0.3, R[2] * 0.3];
  const muzzle = egg(mc, UPRIGHT, mr, n, k, 'muzzle');
  const nose = egg(add(mc, [0, mr[1] * 0.9, mr[2] * 0.42]), UPRIGHT, [R[0] * 0.1, R[0] * 0.06, R[0] * 0.07], 6, 3, 'nose');
  const mouth = smile(add(mc, [0, mr[1] * 0.96, -mr[2] * 0.2]), [0, 1, 0.1], R[0] * 0.16, 'lid');
  // A blush under each eye.
  const blush = paint([1, -1].map((sd) => patchOn(C, R, [sd * (s.eye.dir[0] + 0.25), s.eye.dir[1] - 0.05, s.eye.dir[2] - 0.45], s.eye.size * 1.2, s.eye.size * 0.7, 'inner', sd * 0.25, 0.03, 10)));
  return merge(skull, ...cheeks, muzzle, nose, mouth, blush, eyesOf(s, shut));
}

/** The eyes: a dark rim, a big amber iris, a dark middle and two glints, laid onto the skull's curve. */
function eyesOf(s: Loom, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'lid', o), 0.016));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.14, r * 1.24, 12, 'lid', o), 0.014));
    out.push(onto(disc(p, n, r, r * 1.1, 12, 'crystal', o), 0.018));
    out.push(onto(disc(add(p, scale(up, -r * 0.05)), n, r * 0.55, r * 0.64, 10, 'eye', o), 0.022));
    out.push(onto(disc(add(add(p, scale(up, r * 0.38)), scale(across, side * r * 0.3)), n, r * 0.34, r * 0.34, 6, 'glint', { ...o, lit: true }), 0.03));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.45)), scale(across, -side * r * 0.32)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }), 0.03));
  }
  return paint(out);
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

/**
 * An ear, along its own up, its hollow to its front: long and broad, rounded at the tip, cupped, cream at its root and lavender
 * toward its tip behind, a pink lining in its hollow inside a cream rim.
 */
function earOf(s: Loom, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  const us = [0, 0.12, 0.34, 0.58, 0.8, 0.94, 1];
  const zs = us.map((x) => x * L);
  const ws = [0.5, 0.86, 1, 0.97, 0.8, 0.5, 0.04].map((x) => x * w);
  const line = zs.map((z, q) => [0, -0.05 * Math.sin((q / 6) * Math.PI) * L * 0.2, z] as V3);
  const cup = (p: V3): V3 => [p[0], p[1] + 0.32 * w * Math.min(1, (p[0] / w) ** 2), p[2]];
  const tip = s.stage === 0 ? 0.55 : 0.42;
  const shell = tube(line, ws, ws.map((x) => Math.max(0.02, x * 0.2)), Math.max(8, n), (ring) => (us[ring] >= tip ? 'coat' : 'mark'), { up: [0, 1, 0] });
  const cupped = mesh(shell.v.map(cup), shell.f);
  const rim = (sd: number): V3[] => [1, 2, 3, 4, 5].map((q) => cup([sd * ws[q] * 0.7, line[q][1] + ws[q] * 0.2 + 0.012, zs[q]]));
  const lining: V3[] = [cup([0, line[0][1] + ws[0] * 0.2 + 0.012, zs[0] + L * 0.05]), ...rim(-1), cup([0, line[6][1] + 0.02, L * 0.94]), ...rim(1).reverse()];
  return merge(cupped, paint([facing(lining, [0, 1, 0], 'inner')]));
}

/** The ruff at its chest, in the chest's frame: cream tufts out and down from round the top of the torso, thickest in front. */
function ruffOf(s: Loom): Mesh {
  const F = s.ruff, out: Mesh[] = [];
  const zt = s.torso.z[s.torso.z.length - 1];
  for (let row = 0; row < F.rows; row++) {
    const z = zt - 0.02 - row * F.len * 0.62;
    const count = F.count - row * 2;
    for (let q = 0; q < count; q++) {
      const a = (q / count) * TAU + row * 0.25 + Math.PI / 2;
      const front = Math.cos(a - Math.PI / 2);
      if (front < -0.2 && row > 0) continue;
      const on = onTorso(s, z, a, -0.02);
      const L = F.len * (0.8 + 0.4 * jitter(q + row * 31)) * (0.7 + 0.45 * Math.max(0, front));
      const tip = add(add(on.p, scale(on.n, L * 0.72)), [0, 0, -L * 0.62]);
      out.push(tuft(on.p, tip, L * 0.4, on.n, q % 3 === 0 ? 'muzzle' : 'mark', L * 0.1));
    }
  }
  return merge(...out);
}

/** The torso, in the chest's frame: cream down its front, lavender patches or the whole back. */
function torsoOf(s: Loom, n: number, seed: number): Mesh {
  const T = s.torso;
  const m = tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n, 'mark', { up: [0, 1, 0] });
  return painted(m, (c) => {
    const r = torsoAt(s, c[2]), d: V3 = [c[0] / r.w, (c[1] - r.y) / r.h, 0];
    if (d[1] > (s.saddle > 0 ? 0.3 : -0.2)) return 'mark';
    return lavenderAt(s, [d[0], d[1], 0.5 + c[2]], seed + 1) ? 'coat' : 'mark';
  });
}

/** The tail: a fluffy cream puff, short soft tufts round it. */
function tailOf(s: Loom): Mesh {
  const r = s.tail.r, c: V3 = [0, -r * 0.5, r * 0.2], out: Mesh[] = [orb(c, [r, r * 0.85, r * 0.95], 9, 6, 'mark')];
  for (let q = 0; q < 10; q++) {
    const a = (q / 10) * TAU, d = unit([Math.cos(a) * 0.8, -0.45, Math.sin(a) * 0.8 + 0.15]);
    out.push(tuft(add(c, scale(d, r * 0.7)), add(c, scale(d, r * 1.25)), r * 0.42, unit(cross(d, [1, 0, 0])), q % 3 ? 'mark' : 'muzzle', 0));
  }
  return merge(...out);
}

/** A roll of bandage along its own x: a cream drum with a wound spiral on each end and a few lines round it. */
function rollOf(r: number, len: number, n: number): Mesh {
  const out: Mesh[] = [];
  out.push(tube([[-len * 0.5, 0, 0], [-len * 0.46, 0, 0], [len * 0.46, 0, 0], [len * 0.5, 0, 0]], [r * 0.94, r, r, r * 0.94], [r * 0.94, r, r, r * 0.94], n + 6, 'cloth', { up: [0, 0, 1] }));
  const decals: Disc[] = [];
  for (const sd of [1, -1]) {
    const X: V3 = [sd, 0, 0], f = len * 0.5 + 0.003;
    // The wound layers: a spiral of shade out from a small hole.
    const N = 40, turns = 3.2, pts: V3[] = [];
    for (let q = 0; q <= N; q++) {
      const u = q / N, a = u * turns * TAU, rr = r * (0.16 + 0.76 * u);
      pts.push([sd * f, Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const w = r * 0.035;
    const v: V3[] = [...pts.map((p) => { const d = unit([0, p[1], p[2]]); return add(p, scale(d, w)); }), ...pts.slice().reverse().map((p) => { const d = unit([0, p[1], p[2]]); return sub(p, scale(d, w)); })];
    decals.push({ v: sd > 0 ? v : v.reverse(), m: 'clothDark' });
    decals.push(disc([sd * (f + 0.002), 0, 0], X, r * 0.13, r * 0.13, 8, 'lid', { up: [0, 0, 1] }));
  }
  out.push(paint(decals));
  // Lines round it, where the layers lie.
  out.push(tube([[-len * 0.2, 0, 0], [-len * 0.18, 0, 0]], r * 1.004, r * 1.004, n + 6, 'lining', { up: [0, 0, 1], start: false, end: false }));
  out.push(tube([[len * 0.22, 0, 0], [len * 0.24, 0, 0]], r * 1.004, r * 1.004, n + 6, 'lining', { up: [0, 0, 1], start: false, end: false }));
  return merge(...out);
}

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Loom): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];

/* ---- its ribbons, by stage ---------------------------------------------------------------- */

/** A knot on the hips' egg, lifted off it: the way out of it (scaled), lifted, the face out of it, the width. */
function onHips(s: Loom, d: V3, lift: number, w: number, twist: V3 = [0, 0, 0]): Knot {
  const e = onEgg(s.hips.c, s.hips.r, d);
  return { bone: 'trunk', p: add(e.p, scale(e.n, lift)), n: unit(add(e.n, twist)), w };
}
function onChest(s: Loom, z: number, a: number, lift: number, w: number, twist: V3 = [0, 0, 0]): Knot {
  const e = onTorso(s, z, a, lift);
  return { bone: 'chest', p: e.p, n: unit(add(e.n, twist)), w };
}

/**
 * The strip the Clothkit holds: from its mouth, down between its fore paws, and on down to the ground in front of it in loose
 * folds. While it goes it is held in its mouth alone and hangs to the ground.
 */
function heldStrip(s: Loom): Ribbon {
  const w = s.band;
  return {
    key: 'strip', steps: 4, pieces: 5, marks: [], free: 0.3, flap: 0.12,
    shown: (a) => a.act?.kind !== 'work' && a.act?.kind !== 'strike',
    knots: (b, _a, P) => {
      const mouth = place(b.head, mouthOf(s)), paws = scale(add(b.al2.t, b.ar2.t), 0.5);
      const fwd = unit([turn(b.body, [0, 1, 0])[0], turn(b.body, [0, 1, 0])[1], 0]);
      const held = mixV(add(mouth, [0, 0, -s.head.r[2] * 0.9]), add(paws, scale(fwd, 0.02)), clamp(P.bite * (1 - P.down[0])));
      const hang: V3 = [held[0] * 0.5, held[1] + 0.04, Math.max(0.12, held[2] * 0.4)];
      const g0: V3 = [hang[0], hang[1] + 0.08, 0.025];
      const out: Knot[] = [
        { bone: 'root', p: mouth, n: fwd, w: w * 0.7 },
        { bone: 'root', p: held, n: fwd, w },
        { bone: 'root', p: hang, n: unit(add(fwd, [0, 0, 0.3])), w },
        { bone: 'root', p: g0, n: unit([0.2, 0.4, 1]), w },
        { bone: 'root', p: [g0[0] + 0.12, g0[1] + 0.1, 0.08], n: unit([0.5, -0.4, 0.6]), w },
        { bone: 'root', p: [g0[0] + 0.04, g0[1] + 0.22, 0.02], n: [0, 0, 1], w },
        { bone: 'root', p: [g0[0] - 0.12, g0[1] + 0.28, 0.07], n: unit([-0.5, 0.4, 0.7]), w },
        { bone: 'root', p: [g0[0] - 0.06, g0[1] + 0.42, 0.015], n: [0, 0, 1], w },
      ];
      return out;
    },
  };
}

/** The Loomhare's strip between its raised paws: across from paw to paw, sagging, then down from the right paw to the ground in folds. */
function pawStrip(s: Loom): Ribbon {
  const w = s.band;
  return {
    key: 'strip', steps: 4, pieces: 5, marks: [0.62], free: 0.3, flap: 0.12,
    shown: (a) => a.act?.kind !== 'work' && a.act?.kind !== 'strike' && !(a.go > 0.5),
    knots: (b) => {
      const l = b.al2.t, r = b.ar2.t, fwd = unit([turn(b.body, [0, 1, 0])[0], turn(b.body, [0, 1, 0])[1], 0]);
      const mid = add(scale(add(l, r), 0.5), [0, 0, -0.08]);
      const g0: V3 = [r[0] * 0.6 + 0.04, r[1] + 0.12, 0.03];
      return [
        { bone: 'root', p: add(l, [-0.03, 0.02, 0.05]), n: fwd, w: w * 0.8 },
        { bone: 'root', p: add(mid, scale(fwd, 0.05)), n: unit(add(fwd, [0, 0, 0.2])), w },
        { bone: 'root', p: add(r, [0.02, 0.03, -0.02]), n: fwd, w },
        { bone: 'root', p: [r[0] * 0.8 + 0.02, r[1] + 0.08, r[2] * 0.45], n: unit(add(fwd, [0.2, 0, 0.2])), w },
        { bone: 'root', p: g0, n: unit([0.2, 0.3, 1]), w },
        { bone: 'root', p: [g0[0] - 0.16, g0[1] + 0.14, 0.09], n: unit([-0.4, -0.3, 0.7]), w },
        { bone: 'root', p: [g0[0] - 0.08, g0[1] + 0.3, 0.02], n: [0, 0, 1], w },
        { bone: 'root', p: [g0[0] + 0.1, g0[1] + 0.36, 0.08], n: unit([0.5, 0.3, 0.7]), w },
        { bone: 'root', p: [g0[0] + 0.02, g0[1] + 0.5, 0.015], n: [0, 0, 1], w },
      ];
    },
  };
}

/** The strip it winds at its task: from the underside of the roll down to the ground before it and away in folds. */
function windStrip(s: Loom): Ribbon {
  const w = s.wind[1] * 0.82;
  return {
    key: 'wound', steps: 4, pieces: 4, marks: s.stage ? [0.5] : [], free: 0.25, flap: 0.08,
    shown: (a) => a.act?.kind === 'work',
    knots: (b, a) => {
      const R = b.roll, k = Math.hypot(R.m[0], R.m[3], R.m[6]) || 1;
      const t = a.act?.kind === 'work' ? a.act.t : 0;
      const fwd = unit([turn(b.body, [0, 1, 0])[0], turn(b.body, [0, 1, 0])[1], 0]);
      // Off the front of the roll, under it, where it is drawn on.
      const off = add(R.t, add(scale(fwd, s.wind[0] * k * 0.95), [0, 0, -s.wind[0] * k * 0.2]));
      const g0: V3 = [R.t[0] * 0.5, R.t[1] + 0.16 + 0.04 * Math.sin(TAU * 3 * t), 0.03];
      return [
        { bone: 'root', p: off, n: fwd, w },
        { bone: 'root', p: [off[0], off[1] + 0.06, off[2] * 0.55], n: unit(add(fwd, [0, 0, 0.3])), w },
        { bone: 'root', p: g0, n: unit([0, 0.3, 1]), w },
        { bone: 'root', p: [g0[0] + 0.12, g0[1] + 0.14, 0.08], n: unit([0.5, -0.3, 0.7]), w },
        { bone: 'root', p: [g0[0] + 0.02, g0[1] + 0.3, 0.02], n: [0, 0, 1], w },
        { bone: 'root', p: [g0[0] - 0.12, g0[1] + 0.4, 0.07], n: unit([-0.5, 0.3, 0.7]), w },
        { bone: 'root', p: [g0[0] - 0.04, g0[1] + 0.56, 0.015], n: [0, 0, 1], w },
      ];
    },
  };
}

/**
 * The Loomhare's strips: two draped over its back from its shoulders and down over its haunches either side, their ends lying
 * on the ground behind it; and a streamer flowing up and back off its shoulders.
 */
function loomhareRibbons(s: Loom): Ribbon[] {
  const w = s.band, gz = -s.high + 0.02;
  const drape = (sd: number, key: string, marks: number[], lean: number): Ribbon => ({
    key, steps: 4, pieces: 7, marks, free: 0.55, flap: 0.1,
    knots: () => [
      onChest(s, s.torso.z[2], -Math.PI / 2 + sd * 0.25, 0.04, w * 0.9),
      onHips(s, [sd * 0.25, 0.5, 1], 0.05, w),
      onHips(s, [sd * 0.75, -0.05 + lean, 0.75], 0.05, w),
      onHips(s, [sd * 1, -0.45 + lean, 0.15], 0.06, w),
      onHips(s, [sd * 0.8, -0.85 + lean, -0.35], 0.07, w, [0, -0.3, 0]),
      { bone: 'trunk', p: [sd * (s.hips.r[0] * 0.8), s.hips.c[1] - s.hips.r[1] * 1.15 + lean * 0.3, gz + 0.12], n: unit([sd * 0.4, -0.6, 0.6]), w },
      { bone: 'trunk', p: [sd * (s.hips.r[0] * 0.9 + 0.08), s.hips.c[1] - s.hips.r[1] * 1.45 + lean * 0.3, gz + 0.01], n: [0, 0, 1], w },
      { bone: 'trunk', p: [sd * (s.hips.r[0] * 0.75), s.hips.c[1] - s.hips.r[1] * 1.7 + lean * 0.3, gz + 0.07], n: unit([sd * -0.3, 0.4, 0.8]), w: w * 0.95 },
    ],
  });
  const top = s.torso.z[s.torso.z.length - 1];
  // Off the back of its shoulders, up and out behind in a wave, and down past its haunches to the ground.
  const streamer = (sd: number, key: string, up: number): Ribbon => ({
    key, steps: 4, pieces: 8, marks: [0.5, 0.8], free: 0.25, flap: 0.16,
    knots: () => [
      onChest(s, top - 0.06, -Math.PI / 2 + sd * 0.35, 0.05, w * 0.8, [sd * 0.6, 0, 0.4]),
      { bone: 'chest', p: [sd * 0.2, -0.34, top + 0.16 + up], n: unit([sd, -0.3, 0.4]), w: w * 0.95 },
      { bone: 'chest', p: [sd * 0.34, -0.64, top + 0.22 + up], n: unit([sd, 0.1, 0.5]), w },
      { bone: 'trunk', p: [sd * 0.5, -0.86, 0.4 + up * 0.5], n: unit([sd, -0.3, 0.2]), w },
      { bone: 'trunk', p: [sd * 0.6, -1.04, 0.04], n: unit([sd, -0.5, 0.1]), w },
      { bone: 'trunk', p: [sd * 0.56, -1.2, gz + 0.12], n: unit([sd * 0.5, -0.4, 0.7]), w },
      { bone: 'trunk', p: [sd * 0.44, -1.38, gz + 0.01], n: [0, 0, 1], w: w * 0.9 },
    ],
  });
  return [drape(1, 'drapeR', [0.36, 0.78], 0), drape(-1, 'drapeL', [0.5], -0.08), streamer(-1, 'streamL', 0.1), streamer(1, 'streamR', -0.04)];
}

/**
 * The Bandageweaver's ribbons: a sash round its body, across its chest from its left hip to its right shoulder and back down
 * behind; a ribbon rising off its back behind its head in a great loop and falling over its haunches to trail on the ground
 * behind it; one sweeping out from its right shoulder in a wide arc down to the ground before it; and one out from its haunches
 * in a wide arc behind on its left.
 */
function weaverRibbons(s: Loom): Ribbon[] {
  const w = s.band, gz = -s.high + 0.02, T = s.torso.z, top = T[T.length - 1];
  const hz = s.neck.at[2] + s.neck.len + s.head.up;
  const sash: Ribbon = {
    key: 'sash', steps: 3, pieces: 10, marks: [0.2], free: 1, flap: 0,
    knots: () => [
      onChest(s, T[0] + 0.12, Math.PI / 2 + 1.25, 0.05, w * 0.9),
      onChest(s, T[0] + 0.3, Math.PI / 2 + 0.55, 0.07, w),
      onChest(s, T[1] + 0.12, Math.PI / 2 - 0.1, 0.08, w),
      onChest(s, T[2] - 0.02, Math.PI / 2 - 0.75, 0.08, w),
      onChest(s, top - 0.04, 0.05, 0.08, w, [0, 0, 0.8]),
      onChest(s, T[2] - 0.04, -Math.PI / 2 + 0.75, 0.07, w),
      onChest(s, T[1] + 0.05, -Math.PI / 2 - 0.2, 0.07, w),
      onChest(s, T[0] + 0.14, -Math.PI / 2 - 1.0, 0.06, w),
      onChest(s, T[0] + 0.1, Math.PI + 0.3, 0.05, w * 0.9),
    ],
  };
  // The loop: up off the back behind the head and round, in a plane facing out to its side, and down over the haunches.
  const cy = -0.62, cz = hz + 0.28, R = 0.46;
  const ring = (deg: number, x: number): Knot => {
    const a = (deg * Math.PI) / 180;
    return { bone: 'chest', p: [x, cy + R * Math.cos(a), cz + R * Math.sin(a)], n: unit([1, 0.15 * Math.sin(a), -0.1]), w };
  };
  const loop: Ribbon = {
    key: 'loop', steps: 4, pieces: 12, marks: [0.3, 0.72], free: 0.6, flap: 0.08,
    knots: () => [
      onChest(s, top - 0.1, -Math.PI / 2 + 0.2, 0.06, w * 0.9, [0.6, 0, 0.5]),
      { bone: 'chest', p: [0.18, -0.48, top + 0.2], n: unit([1, -0.2, 0]), w },
      ring(-150, 0.16), ring(-200, 0.12), ring(-250, 0.06), ring(-290, 0), ring(-330, -0.06), ring(-375, -0.12),
      { bone: 'trunk', p: [-0.22, -0.95, 0.68], n: unit([0.8, -0.2, 0.5]), w },
      { bone: 'trunk', p: [-0.3, -1.3, 0.25], n: unit([0.6, -0.6, 0.4]), w },
      { bone: 'trunk', p: [-0.34, -1.5, gz + 0.12], n: unit([0.3, -0.5, 0.8]), w },
      { bone: 'trunk', p: [-0.2, -1.74, gz + 0.01], n: [0, 0, 1], w },
      { bone: 'trunk', p: [0.08, -1.92, gz + 0.06], n: unit([0.3, 0.4, 0.8]), w: w * 0.95 },
    ],
  };
  const front: Ribbon = {
    key: 'sweep', steps: 4, pieces: 8, marks: [0.42], free: 0.4, flap: 0.1,
    knots: () => [
      onChest(s, top - 0.08, 0.15, 0.08, w * 0.9, [0, 0, 0.5]),
      { bone: 'chest', p: [0.66, 0.04, top + 0.08], n: unit([0.3, 0.3, 1]), w },
      { bone: 'trunk', p: [1.08, 0.46, 0.5], n: unit([0.3, 0.9, 0.2]), w },
      { bone: 'trunk', p: [1.2, 0.8, 0.0], n: unit([0.6, 0.7, -0.1]), w },
      { bone: 'trunk', p: [1.04, 1.04, gz + 0.14], n: unit([0.3, 0.5, 0.7]), w },
      { bone: 'trunk', p: [0.8, 1.2, gz + 0.01], n: [0, 0, 1], w },
      { bone: 'trunk', p: [0.56, 1.36, gz + 0.06], n: unit([-0.3, 0.4, 0.8]), w: w * 0.95 },
    ],
  };
  const back: Ribbon = {
    key: 'trail', steps: 4, pieces: 8, marks: [0.5], free: 0.35, flap: 0.12,
    knots: () => [
      onHips(s, [-0.15, -0.3, 0.95], 0.05, w * 0.9),
      onHips(s, [-0.6, -0.4, 0.7], 0.07, w),
      { bone: 'trunk', p: [-1.06, -0.6, 0.46], n: unit([-0.4, -0.6, 0.6]), w },
      { bone: 'trunk', p: [-1.36, -0.3, 0.05], n: unit([-0.9, 0.1, 0.3]), w },
      { bone: 'trunk', p: [-1.28, 0.02, gz + 0.12], n: unit([-0.6, 0.2, 0.7]), w },
      { bone: 'trunk', p: [-1.04, 0.26, gz + 0.01], n: [0, 0, 1], w },
      { bone: 'trunk', p: [-0.8, 0.42, gz + 0.06], n: unit([0.3, 0.3, 0.8]), w: w * 0.95 },
    ],
  };
  return [sash, loop, front, back];
}

/** A sling of ribbon round the roll at its side, up to its haunch: what holds it there. */
function slingOf(s: Loom): Ribbon {
  const R = s.roll[0], at = rollAt(s), w = s.band * 0.7;
  return {
    key: 'sling', steps: 3, pieces: 4, marks: [], free: 1, flap: 0,
    knots: () => [
      onHips(s, [0.8, 0.35, 0.55], 0.04, w),
      { bone: 'trunk', p: add(at, [R * 1.04, 0.0, R * 0.55]), n: [1, 0, 0.3], w },
      { bone: 'trunk', p: add(at, [R * 0.75, 0.0, -R * 0.85]), n: unit([0.7, 0, -0.7]), w },
      { bone: 'trunk', p: add(at, [-R * 0.4, 0.0, -R * 1.04]), n: [0, 0, -1], w },
      { bone: 'trunk', p: add(at, [-R * 1.04, 0.0, 0]), n: [-1, 0, 0], w },
      onHips(s, [0.9, 0.2, -0.2], 0.03, w),
    ],
  };
}
/** Where the roll at its side is, in the body's frame: against its right haunch, in front of the hind foot, just off the ground. */
const rollAt = (s: Loom): V3 => [s.leg.heel[0] + s.leg.foot[1] + s.roll[0] * 0.9, s.leg.heel[1] + s.leg.foot[0] * 1.15 + s.roll[1] * 0.1, -s.high + s.roll[0] + 0.03];

/* ---- a stage's pieces --------------------------------------------------------------------- */

function loomBuild(s: Loom, lod: number, bones: LoomBones): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), pieces: Piece[] = [], seed = 1.7 + s.stage;
  const hide = headSolids(s);
  const Hc = s.hips.c, Hr = s.hips.r;
  pieces.push({ key: 'hips', mesh: painted(orb(Hc, Hr, n + 12, k + 6, 'mark'), (c) => (lavenderAt(s, onEggDir(Hc, Hr, c), seed) ? 'coat' : 'mark')), bone: 'trunk', bias: 0 });
  pieces.push({ key: 'torso', mesh: torsoOf(s, n + 10, seed), bone: 'chest', bias: 0.01, after: 'hips', breathes: { c: [0, 0, s.torso.z[1]], k: 0.04 } });
  pieces.push({ key: 'ruff', mesh: s.diamond ? merge(ruffOf(s), diamondOn(s)) : ruffOf(s), bone: 'chest', bias: 0.03, after: ['torso'], lines: false });
  pieces.push({ key: 'neck', mesh: tube([[0, 0, -0.08], [0, 0, s.neck.len + 0.06]], s.neck.w, s.neck.w * 0.9, n, 'mark'), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  const ear = earOf(s, n);
  for (let i = 0; i < 2; i++) pieces.push({ key: `ear${i}`, mesh: ear, bone: `ear${i}`, bias: 0.19, after: 'head', front: [0, 1, 0] });
  pieces.push({ key: 'tail', mesh: tailOf(s), bone: 'tail', bias: -0.1, lines: false });
  // Hind legs: a big round haunch, a short shin into the heel, a long furred foot along the ground.
  const L = s.leg;
  for (const [i, key] of [[0, 'hl'], [1, 'hr']] as Array<[number, string]>) {
    const sd = i ? 1 : -1, front: V3 = [0, 1, 0];
    // The haunch on the body's side over the hip, down to the ground: where a rabbit sitting carries its thigh.
    const hr = L.haunch, hc: V3 = [sd * L.at[0], L.at[1] - hr[1] * 0.15, L.at[2] + hr[2] * 0.15];
    const haunch = painted(egg(hc, UPRIGHT, hr, n + 8, k + 4, 'mark'), (c) => { const d = onEggDir(hc, hr, c); return lavenderAt(s, [d[0] * 0.5, d[1] * 0.7 - 0.1, d[2] + 0.5], seed + 3) ? 'coat' : 'mark'; });
    const swirl = s.spiral ? paint([spiralOn(hc, hr, [sd, -0.15, 0.2], Math.min(hr[1], hr[2]) * 0.62, 2.2, Math.min(hr[1], hr[2]) * 0.07, 'mark')]) : null;
    const shin = tube([[0, 0, 0.02], [0, 0, -L.len[1]]], [L.foot[1] * 0.75, L.foot[1] * 0.6], [L.foot[1] * 0.75, L.foot[1] * 0.6], n, 'mark', { seam: 'start' });
    const fl = L.foot[0], fw = L.foot[1];
    const foot = merge(
      egg([0, fl * 0.42, fw * 0.36], UPRIGHT, [fw * 0.62, fl * 0.56, fw * 0.4], n, k, 'mark'),
      ...[-0.5, 0, 0.5].map((q) => egg([q * fw * 0.55, fl * 0.92, fw * 0.24], UPRIGHT, [fw * 0.26, fw * 0.3, fw * 0.22], 4, 3, 'muzzle')),
    );
    pieces.push(
      { key: `${key}0`, mesh: merge(haunch, swirl), bone: 'trunk', bias: 0.012 },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.01, after: 'hips', front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.008, after: ['hips'], front },
    );
  }
  // Fore legs: a cream upper arm into the ruff, the forearm (wrapped in bandage on the Bandageweaver), a small round paw.
  for (const key of ['al', 'ar']) {
    const front: V3 = [0, 1, 0], ahead: V3 = [0, 0.5, -0.85];
    const upper = merge(
      egg([0, 0, -s.arm[0] * 0.35], UPRIGHT, [s.armW[0] * 1.3, s.armW[0] * 1.3, s.arm[0] * 0.65], n, k, 'mark'),
      tube([[0, 0, 0], [0, 0, -s.arm[0]]], [s.armW[0] * 1.1, s.armW[1] * 1.05], [s.armW[0] * 1.1, s.armW[1] * 1.05], n, 'mark', { seam: 'start' }),
    );
    const fz = [0, -s.arm[1] * 0.25, -s.arm[1] * 0.5, -s.arm[1] * 0.75, -s.arm[1] + s.hand * 0.4];
    const fore = s.wrapped
      ? merge(
        tube(fz.map((z) => [0, 0, z] as V3), fz.map((_, q) => s.armW[1] * (1.12 - 0.1 * q / 4)), fz.map((_, q) => s.armW[1] * (1.12 - 0.1 * q / 4)), n, (ring) => (ring % 2 ? 'clothDark' : 'cloth'), { seam: 'both' }),
        ...[0.15, 0.4, 0.65, 0.88].map((u) => tube([[0, 0, -s.arm[1] * u - 0.012], [0, 0, -s.arm[1] * u + 0.012]], s.armW[1] * 1.16, s.armW[1] * 1.16, n, 'lining', { start: false, end: false })),
      )
      : merge(
        egg([0, 0, 0], UPRIGHT, [s.armW[1] * 1.05, s.armW[1] * 1.05, s.armW[1] * 1.05], n, k, 'mark'),
        tube([[0, 0, 0], [0, 0, -s.arm[1] + s.hand * 0.5]], [s.armW[1] * 1.05, s.armW[1] * 0.85], [s.armW[1] * 1.05, s.armW[1] * 0.85], n, 'mark', { seam: 'both' }),
      );
    const h = s.hand;
    const paw = merge(
      egg([0, h * 0.35, h * 0.5], UPRIGHT, [h * 1.05, h * 1.25, h * 0.75], n, k, 'mark'),
      ...[-0.55, 0, 0.55].map((q) => egg([q * h * 0.75, h * 1.35, h * 0.32], UPRIGHT, [h * 0.3, h * 0.32, h * 0.28], 4, 3, 'muzzle')),
    );
    pieces.push(
      { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.06, after: ['torso', 'ruff'], front },
      { key: `${key}1`, mesh: fore, bone: `${key}1`, bias: 0.065, after: ['torso', `${key}0`, 'ruff'], front: ahead },
      { key: `${key}2`, mesh: paw, bone: `${key}2`, bias: 0.07, after: ['torso', `${key}1`, 'ruff'], front: ahead },
    );
  }
  // The roll it winds at its task, between its paws.
  pieces.push({ key: 'roll', mesh: rollOf(s.wind[0], s.wind[1], n), bone: 'roll', bias: 0.068, after: ['ruff', 'al1', 'ar1'], shown: (a) => a.act?.kind === 'work' });
  // The roll at its side, slung from its haunch.
  if (s.roll[0] > 0) {
    const at = rollAt(s);
    const m = rollOf(s.roll[0], s.roll[1], n);
    // Its axle along the body, an end to the front.
    const turned = mesh(m.v.map((p) => add(at, [p[1], p[0], p[2]])), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
    pieces.push({ key: 'sideroll', mesh: turned, bone: 'trunk', bias: 0.02 });
    pieces.push(...ribbonPieces(s, slingOf(s), bones, 0.025));
  }
  // The ribbons and strips.
  const ribbons: Ribbon[] = [windStrip(s)];
  if (s.stage === 0) ribbons.push(heldStrip(s));
  if (s.stage === 1) ribbons.push(pawStrip(s), ...loomhareRibbons(s));
  if (s.stage === 2) ribbons.push(...weaverRibbons(s));
  for (const R of ribbons) pieces.push(...ribbonPieces(s, R, bones, 0.02));
  return pieces;
}

/** The Bandageweaver's gold diamond, on its ruff at the middle of its chest. */
function diamondOn(s: Loom): Mesh {
  const zt = s.torso.z[s.torso.z.length - 1], z = zt - s.ruff.len * 0.9;
  const on = onTorso(s, z, Math.PI / 2, s.ruff.len * 0.5), d = s.ruff.len * 0.3, n = unit(add(on.n, [0, 0, 0.25]));
  const up = unit(sub([0, 0, 1], scale(n, n[2]))), x = unit(cross(up, n));
  const c = on.p;
  return paint([
    { v: [add(c, scale(up, d * 1.3)), add(c, scale(x, -d * 0.8)), add(c, scale(up, -d * 1.3)), add(c, scale(x, d * 0.8))].reverse(), m: 'fitting' },
    { v: [add(add(c, scale(up, d * 0.6)), scale(n, 0.004)), add(add(c, scale(x, -d * 0.35)), scale(n, 0.004)), add(add(c, scale(up, -d * 0.6)), scale(n, 0.004)), add(add(c, scale(x, d * 0.35)), scale(n, 0.004))].reverse(), m: 'bloom', lit: true },
  ]);
}

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const CLOTH: RGB = [250, 242, 222];
const GOLD: RGB = [236, 196, 104];

/** Evolving: scraps of cloth and gold motes swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Loom, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const R0 = s.hips.r[0] * 1.8 + 0.2, high = s.torso.z[s.torso.z.length - 1] + s.high + s.head.up * 2;
  g.save();
  for (let q = 0; q < 16; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.38), ang = (q / 16) * TAU + u * TAU * 1.5, kk = (1 - u) ** 1.1;
    const p: V3 = [Math.cos(ang) * R0 * kk, Math.sin(ang) * R0 * kk, 0.2 + u * high * 0.8];
    if (nearSide(p, b.chest.t, view) !== front) continue;
    const [x, y] = onScreen(view, p), r = (0.07 + 0.03 * s.stage) * (1 - 0.4 * u), al = swirl * ramp(u, 0, 0.12);
    g.fillStyle = css(q % 3 ? CLOTH : GOLD, al);
    g.beginPath();
    if (q % 3) g.ellipse(x, y, r * 1.3, r * 0.45, ang * 2, 0, TAU);
    else g.ellipse(x, y, r * 0.5, r * 0.5, 0, 0, TAU);
    g.fill();
  }
  g.restore();
}

/** A strike: a puff of lint off its paws where they land. */
function strikePuff(g: CanvasRenderingContext2D, view: View, s: Loom, b: Bones, t: number, front: boolean): void {
  const since = (t - LOOM_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0 || since > 0.35) return;
  const p = scale(add(b.al2.t, b.ar2.t), 0.5);
  if (nearSide(p, b.chest.t, view) !== front) return;
  g.save();
  for (let q = 0; q < 6 + 2 * s.stage; q++) {
    const a = jitter(q * 5 + s.stage) * TAU, sp = 0.6 + jitter(q * 3 + 1);
    const c: V3 = [p[0] + Math.cos(a) * sp * since, p[1] + Math.sin(a) * sp * since, p[2] + sp * since * 0.6 - 2 * since * since];
    const [x, y] = onScreen(view, c);
    g.fillStyle = css(CLOTH, 1 - since / 0.35);
    g.beginPath();
    g.arc(x, y, 0.03 + 0.015 * s.stage, 0, TAU);
    g.fill();
  }
  g.restore();
}

/* ---- the kinds ------------------------------------------------------------------------------- */

function loomKind(s: Loom): Kind {
  const bones = loomBones(s);
  return {
    bones,
    build: (lod) => loomBuild(s, lod, bones),
    // The variant's two colours are its lavender patches and its cream fur; its pink ears and nose, amber eyes, cream bandages and
    // gold marks are the same on every variant.
    palette: (coat, mark) => {
      const lav = mix(coat, [178, 170, 204], 0.3), cream = mix([252, 246, 232], mark, 0.35);
      return coatPalette(coat, mark, {
        coat: lav,
        coatDark: mix(lav, [92, 84, 116], 0.3),
        coatLight: mix(lav, [255, 250, 240], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 254, 250], 0.6),
        inner: [240, 160, 160],
        lid: [84, 52, 40],
        nose: [232, 140, 148],
        eye: [40, 22, 16],
        glint: [255, 253, 246],
        crystal: [214, 142, 52],
        cloth: [248, 238, 214],
        clothDark: [236, 224, 202],
        lining: [222, 204, 172],
        fitting: [222, 170, 72],
        bloom: [255, 232, 150],
      } as Partial<ReturnType<Kind['palette']>>, 262);
    },
    shadow: [s.hips.r[1] * 1.5, s.hips.r[0] * 1.3 + (s.stage === 2 ? 0.4 : 0)],
    stride: 1.4,
    size: s.size,
    leaps: [true, true],
    acts: ['strike', 'work'],
    motes: [[250, 242, 222], [236, 196, 104]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikePuff(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const CLOTHKIT = loomKind(LOOKS[0]);
export const LOOMHARE = loomKind(LOOKS[1]);
export const BANDAGEWEAVER = loomKind(LOOKS[2]);
