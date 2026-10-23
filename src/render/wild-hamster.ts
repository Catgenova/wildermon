import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  pastel, scale, shadowOf, smile, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The hamster line: the Wheatley, a small round hamster sitting up with its
 * paws clasped at its chest, a millstone bulging out of each cheek and a
 * short bib of wheat kernels hanging from its chin over a fluffy cream ruff;
 * which grows into the Wheatwhirl, bigger and upright, bigger stones in its
 * cheeks, a long beard of wheat kernels down its chest and a ruff of
 * wheat-pale fur over its shoulders, its paws on its belly; and then the
 * Wheatcheeks, large and plump, huge millstones bound in brass with a golden
 * flower on each hub, a thick beard of kernels down to its belly, a mantle
 * of wheat husks over its shoulders and a big fluffy tail. The species is
 * still `grista` underneath, as saves and the database know it: it grinds
 * wheat and corn and presses olives in the settlement stores.
 *
 * Each is golden-tan fur in patches on cream, pink ears with grey-brown
 * backs, a pink nose and pink paws, rosy cheeks and round dark eyes. Each
 * millstone is a grey wheel with a hole in its middle and golden wheat
 * sprigs carved round it, held in the cheek pouch with its face out and a
 * little forward. All three are built by one set of functions from a
 * description of the stage (`Ham`), the way the mend line is (`./wild-mend`):
 * its legs bent to put each foot where it is to be, its arms bent to put its
 * paws where they are to be, the stones on bones of their own so they turn.
 * It walks with a waddle, rolled from foot to foot, its heavy cheeks bobbing
 * a beat behind. At its task it lifts an ear of wheat to its mouth, chews,
 * and the stones turn in its cheeks while flour trickles out under them; it
 * strikes by twisting away and swinging a cheek round into the blow.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Ham {
  stage: 0 | 1 | 2;
  /** The hip on the right in the body's frame; thigh, shin and the ankle's height over the sole; how thick each is; the foot's length and width; how far out each foot stands and how far ahead of the hip. */
  leg: { at: V3; len: [number, number, number]; w: [number, number]; foot: [number, number]; stance: number; ahead: number };
  /** How high the hips are carried standing. */
  high: number;
  /** The seat and belly, an egg in the body's frame. */
  hips: { c: V3; r: V3 };
  /** The chest's joint on the body and how far forward of upright it is carried. */
  chest: { at: V3; lean: number };
  /** The torso's rings in the chest's frame, bottom to top: how high, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** The shoulder on the right in the chest's frame; upper arm and forearm; how thick each; the paw's size. */
  shoulder: V3;
  arm: [number, number];
  armW: [number, number];
  hand: number;
  /** Where the paws rest, the right one, in the chest's frame. */
  paw: V3;
  neck: { at: V3; len: number; w: number };
  /** The skull's half-sizes, how far its middle is over the top of the neck, and how it is pitched. */
  head: { r: V3; up: number; pitch: number };
  eye: { dir: V3; size: number };
  ear: { len: number; w: number };
  /** The right millstone: its radius and thickness, its middle against the skull's, the way its face looks out of the cheek; its carved sprigs and whether it is bound in brass with a boss on its hub. */
  stone: { r: number; th: number; at: V3; axis: V3; sprigs: number; brass: boolean };
  /** The beard: how many strands of kernels across the chest, how many kernels down each, a kernel's length, and how far round the chest it spreads (radians either side of the front). */
  beard: { strands: number; rows: number; k: number; spread: number };
  /** The ruff round the neck: how many tufts, how long, and whether they are pale wheat rather than cream fur. */
  ruff: { count: number; len: number; wheat: boolean };
  /** Rows of wheat husks over the shoulders: none but on the Wheatcheeks. */
  mantle: number;
  /** The tail: its root on the body, how long its tufts are, how many. */
  tail: { at: V3; len: number; tufts: number };
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the hips sink at each footfall; how far it rolls and sways over each foot. */
    step: number; bob: number; roll: number; sway: number;
  };
  size: number;
}

/** A Wheatley: small and round, a big head on a ball of a body, two small stones in its cheeks, its paws clasped at its chest. */
const WHEATLEY_LOOK: Ham = {
  stage: 0,
  leg: { at: [0.26, 0.06, -0.2], len: [0.09, 0.08, 0.04], w: [0.15, 0.1], foot: [0.3, 0.13], stance: 0.28, ahead: 0.24 },
  high: 0.32,
  hips: { c: [0, 0, 0.07], r: [0.68, 0.58, 0.38] },
  chest: { at: [0, 0, 0.1], lean: 0 },
  torso: { z: [-0.1, 0.08, 0.2, 0.28], y: [0, 0.03, 0.03, 0], w: [0.6, 0.54, 0.44, 0.32], h: [0.52, 0.46, 0.37, 0.28] },
  shoulder: [0.36, 0.1, 0.16],
  arm: [0.13, 0.12], armW: [0.085, 0.075], hand: 0.075,
  paw: [0.08, 0.5, 0.1],
  neck: { at: [0, 0.02, 0.26], len: 0.03, w: 0.28 },
  head: { r: [0.52, 0.44, 0.33], up: 0.2, pitch: 6 },
  eye: { dir: [0.42, 0.8, 0.18], size: 0.08 },
  ear: { len: 0.18, w: 0.15 },
  stone: { r: 0.25, th: 0.16, at: [0.64, -0.14, -0.15], axis: [1, 0.5, 0.05], sprigs: 2, brass: false },
  beard: { strands: 4, rows: 3, k: 0.075, spread: 0.36 },
  ruff: { count: 14, len: 0.16, wheat: false },
  mantle: 0,
  tail: { at: [0, -0.56, -0.12], len: 0.22, tufts: 5 },
  gait: { duty: [0.62, 0.42], swing: [0.55, 0.5], step: 0.5, bob: 0.06, roll: 10, sway: 0.08 },
  size: 4.1,
};

/** A Wheatwhirl: bigger and upright, a pear of a body, bigger stones, a long beard, a ruff of wheat-pale fur, its paws on its belly. */
const WHEATWHIRL_LOOK: Ham = {
  stage: 1,
  leg: { at: [0.32, 0.06, -0.26], len: [0.1, 0.09, 0.05], w: [0.2, 0.13], foot: [0.38, 0.15], stance: 0.36, ahead: 0.3 },
  high: 0.42,
  hips: { c: [0, 0.02, 0.12], r: [0.8, 0.66, 0.5] },
  chest: { at: [0, 0, 0.2], lean: 2 },
  torso: { z: [-0.15, 0.15, 0.4, 0.58, 0.66], y: [0.02, 0.05, 0.05, 0.02, 0], w: [0.7, 0.62, 0.48, 0.36, 0.28], h: [0.6, 0.56, 0.44, 0.34, 0.26] },
  shoulder: [0.44, 0.08, 0.42],
  arm: [0.24, 0.22], armW: [0.13, 0.115], hand: 0.09,
  paw: [0.26, 0.68, 0.02],
  neck: { at: [0, 0.02, 0.62], len: 0.04, w: 0.3 },
  head: { r: [0.56, 0.48, 0.36], up: 0.22, pitch: 6 },
  eye: { dir: [0.42, 0.8, 0.18], size: 0.085 },
  ear: { len: 0.22, w: 0.17 },
  stone: { r: 0.33, th: 0.22, at: [0.74, -0.16, -0.25], axis: [1, 0.5, 0.05], sprigs: 2, brass: false },
  beard: { strands: 5, rows: 7, k: 0.085, spread: 0.36 },
  ruff: { count: 18, len: 0.24, wheat: true },
  mantle: 0,
  tail: { at: [0, -0.66, -0.16], len: 0.32, tufts: 6 },
  gait: { duty: [0.62, 0.42], swing: [0.5, 0.45], step: 0.45, bob: 0.06, roll: 9, sway: 0.08 },
  size: 4.7,
};

/** A Wheatcheeks: large and plump, huge stones bound in brass, a beard down to its belly, a mantle of wheat husks, a big fluffy tail. */
const WHEATCHEEKS_LOOK: Ham = {
  stage: 2,
  leg: { at: [0.44, 0.06, -0.36], len: [0.12, 0.11, 0.06], w: [0.28, 0.17], foot: [0.5, 0.2], stance: 0.5, ahead: 0.42 },
  high: 0.54,
  hips: { c: [0, 0.04, 0.16], r: [1.2, 0.94, 0.66] },
  chest: { at: [0, 0, 0.28], lean: 3 },
  torso: { z: [-0.2, 0.2, 0.5, 0.72, 0.8], y: [0.04, 0.07, 0.06, 0.03, 0], w: [0.98, 0.86, 0.68, 0.5, 0.38], h: [0.84, 0.76, 0.6, 0.44, 0.34] },
  shoulder: [0.62, 0.1, 0.56],
  arm: [0.32, 0.3], armW: [0.18, 0.16], hand: 0.12,
  paw: [0.36, 0.92, -0.04],
  neck: { at: [0, 0.04, 0.76], len: 0.05, w: 0.38 },
  head: { r: [0.64, 0.56, 0.42], up: 0.26, pitch: 8 },
  eye: { dir: [0.42, 0.8, 0.18], size: 0.095 },
  ear: { len: 0.26, w: 0.2 },
  stone: { r: 0.44, th: 0.3, at: [0.86, -0.2, -0.3], axis: [1, 0.5, 0.05], sprigs: 4, brass: true },
  beard: { strands: 7, rows: 9, k: 0.105, spread: 0.42 },
  ruff: { count: 20, len: 0.3, wheat: true },
  mantle: 2,
  tail: { at: [0, -0.9, -0.2], len: 0.5, tufts: 8 },
  gait: { duty: [0.64, 0.44], swing: [0.45, 0.4], step: 0.4, bob: 0.07, roll: 8, sway: 0.09 },
  size: 5.6,
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
/** `v` turned `a` radians about the unit axis `k`. */
function rotAbout(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

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

/** Where the egg `(c, r)` is cut by the level `z`: its half across and half deep there. */
function eggAt(c: V3, r: V3, z: number): [number, number] {
  const f = Math.sqrt(Math.max(0.04, 1 - ((z - c[2]) / r[2]) ** 2));
  return [r[0] * f, r[1] * f];
}

/** The torso's ring at height `z` in the chest's frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Ham, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/**
 * A point on the body's skin at height `z` in the chest's frame, `a` radians round from its right side (a quarter turn is its
 * front), lifted `out` off it: on the torso, or on the belly where the belly comes further out.
 */
function onBody(s: Ham, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z), hc = sub(s.hips.c, s.chest.at), [hx, hy] = eggAt(hc, s.hips.r, z);
  const tp: V3 = [Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z];
  const hp: V3 = [Math.cos(a) * hx, hc[1] + Math.sin(a) * hy, z];
  const p = z < s.torso.z[0] || len3([hp[0], hp[1], 0]) > len3([tp[0], tp[1], 0]) ? hp : tp;
  const d = unit([Math.cos(a), Math.sin(a), 0]);
  return add(p, scale(d, out));
}

/** The coat's patches: golden-tan over cream, broken up as a hamster's is. Above nought is tan. */
const patchy = (p: V3, seed: number): number =>
  Math.sin(p[0] * 4.1 + seed) * Math.sin(p[1] * 3.3 + 1.7 * seed + p[2] * 1.4) + 0.7 * Math.sin(p[2] * 5.2 - p[0] * 2.3 + seed * 0.7);

/** The way out of a face of the egg `(c, r)` at the point `p`, scaled to the egg: (-1..1) on each axis. */
const onEggDir = (c: V3, r: V3, p: V3): V3 => [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];

/** Whether a point on the body (its way out of the belly egg, scaled) is cream: the belly and the front, and the breaks in the tan. */
function creamAt(d: V3, seed: number): boolean {
  if (d[1] > 0.6 - 0.25 * Math.max(0, -d[2]) - 0.25 * (1 - Math.abs(d[0]))) return true;
  if (d[2] < -0.75) return true;
  return patchy(d, seed) < -0.55;
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the cheek swung round into the blow. */
export const HAM_HITS: readonly number[] = [0.5, 0.52, 0.55];
/**
 * A go at its task, as shares of it: when the ear of wheat is at its mouth (the grain going in), each chew of its jaw, and the
 * stones going round once a go the whole way through, the flour trickling out under them.
 */
export const HAM_WORK = { feeds: [0.14, 0.62] as const, chews: [0.3, 0.42, 0.8, 0.92] as const } as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** A pose: where each ankle is and how its foot is pitched, how the body and the chest are carried, where its paws are, and its stones. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left, past how it is carried. */
  chest: V3;
  /** The neck bent forward and turned left; the head nose-up, turned left and tilted, against level. */
  neck: number[]; head: V3;
  /** Where each paw is, left then right, in the chest's frame. */
  hand: V3[];
  /** How far each stone has turned (radians), left then right; how far they are pushed out of the cheeks, and dropped as the jaw works. */
  spin: number[]; puff: number; jaw: number;
  /** How much of the ear of wheat is in its paws. */
  held: number;
  /** The tail lifted and swung to the left. */
  tail: number[];
  ears: number;
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

const rests = new Map<Ham, Rest>();
function restOf(s: Ham): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3);
  const R: Rest = { ankle, reach: L.len[0] + L.len[1] };
  rests.set(s, R);
  return R;
}

/** The paws at rest: clasped at the Wheatley's chest, laid on the bigger two's belly. */
const pawRest = (s: Ham): V3[] => [[-s.paw[0], s.paw[1], s.paw[2]], [...s.paw]];

function restPlan(s: Ham, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0],
    hand: pawRest(s), spin: [0, 0], puff: 0, jaw: 0, held: 0, tail: [0, 0], ears: 0,
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
 * Going: a waddle, up on its short hind legs. Each foot down for its share of a stride and swept back under it at the ground's
 * own speed, then lifted and brought forward; the whole body rolled well over onto the foot that is down and swayed after it,
 * sinking onto each foot as it lands; the head held steadier than the body and the heavy cheeks bobbing a beat behind; the
 * paws kept at the chest, swinging a little; the tail wagging against the hips.
 */
function goingPlan(s: Ham, R: Rest, a: Anim): Plan {
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
    // Swung out round the belly a little as it comes forward, the way a short leg under a round body has to.
    p.at[i] = [A[0] * (1 + 0.25 * Math.sin(Math.PI * u)), y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    p.foot[i] = -18 * Math.sin(Math.PI * clamp(u * 1.6)) * (1 - u) + 8 * hump(u, 0.85, 0.15);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.08));
  p.H += -G.bob * L * 2.4 * (down - 0.5) * (1 - 0.5 * g) + g * L * (0.12 * Math.max(0, Math.sin(2 * TAU * (w - duty * 0.5 + 0.25))) - 0.05);
  // Over the foot that is down: the left (0) from nought to half a stride, the right after. A waddle is mostly this.
  const over = Math.sin(TAU * (w - 0.2));
  p.roll = G.roll * over;
  p.side = -G.sway * L * 2 * over * (1 - 0.5 * g);
  p.yaw = 7 * Math.cos(TAU * w) * (1 - 0.3 * g);
  p.chest = [4 + 14 * g + 2 * (down - 0.5), -p.yaw * 0.8, -p.roll * 0.35];
  p.pitch = -2 - 6 * g;
  // The head held steadier than the body, against the roll; the cheeks bobbing after each footfall.
  p.head = [4 * (down - 0.5) + 3 + 5 * g, -p.yaw * 0.3 - p.chest[1] * 0.5, -p.roll * 0.7];
  p.jaw = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.2));
  p.spin = [0.18 * Math.sin(TAU * (w - 0.25)), -0.18 * Math.sin(TAU * (w - 0.25))];
  p.tail = [6 * (down - 0.5) + 10 * g, -p.yaw * 2 - 18 * Math.sin(TAU * (w - 0.1))];
  // The paws swung a little with the stride, and drawn up at a run.
  const sw = Math.sin(TAU * (w - 0.05));
  p.hand = p.hand.map((h, i) => add(h, [0, 0.1 * L * sw * (i ? 1 : -1), 0.06 * L * g])) as V3[];
  return p;
}

/** How far its head is turned to its right standing about (degrees), toward the viewer at the island's usual facing. */
const FACE_TURN = 28;

/**
 * Standing about: breathing, the weight shifting from foot to foot, looking about with its nose working; now and then a chew,
 * the stones turning a little in its cheeks, and a rub of its face with both paws.
 */
function stillPlan(s: Ham, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  const w = Math.tanh(2.5 * cyc(t, 3));
  p.chest = [1.5 * (a.breath - 0.5), 8 * look * 0.3, 1.5 * w];
  p.roll = -2 * w;
  p.side = 0.03 * s.leg.len[0] * w;
  // Its head turned to its right, toward where it is mostly seen from, so its face is seen front-on between the stones.
  p.neck = [0, -FACE_TURN * 0.4 + 5 * look];
  p.head = [3 * cyc(t, 4) + 2 * Math.sin(t * 11) * beat(t, [1.2, 9.4, 15.6], 0.6), -FACE_TURN * 0.6 + 5 * look, 5 * drift(t, 3)];
  p.H += 0.012 * R.reach * (a.breath - 0.5);
  p.tail = [3 * cyc(t, 3, 1), 14 * cyc(t, 4)];
  // A few chews, the stones turning a little in its cheeks.
  const chew = beat(t, [4.2, 13.1, 19.8], 1.4);
  p.jaw = chew * (0.5 + 0.5 * Math.sin(t * TAU * 2.2));
  p.spin = [0.6 * chew * Math.sin(t * 1.3), -0.6 * chew * Math.sin(t * 1.3)];
  p.puff = 0.3 * chew;
  // A rub of its face: both paws up to its cheeks and round.
  const rub = beat(t, [8.0, 21.5], 1.6);
  if (rub > 0) {
    const z = s.torso.z[s.torso.z.length - 1] + s.head.up * 0.9, y = s.torso.y[0] + s.head.r[1] * 0.7;
    p.hand = p.hand.map((h, i) => mixV(h, [(i ? 1 : -1) * s.head.r[0] * 0.55 + 0.03 * Math.sin(t * 14), y, z + 0.04 * Math.cos(t * 14)], rub)) as V3[];
    p.head[0] -= 10 * rub;
    p.neck[1] *= 1 - rub;
    p.head[1] *= 1 - rub;
  }
  p.ears = beat(t, [3.1, 14.2, 20.4], 0.5);
  return p;
}

/* ---- its strike ---------------------------------------------------------------------- */

/**
 * A strike: it twists away, rocked back, the paws out for balance, then swings round and forward, leading with its cheek, and
 * the millstone in it slams into what is in front of it, the stones spun by the blow; a step into it, a bounce, and back.
 */
function strikePlan(s: Ham, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = HAM_HITS[s.stage], L = R.reach;
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.02, 0.07);
  const yaw = 38 * wind - 26 * blow;
  p.yaw = yaw * 0.35;
  p.chest = [-12 * wind + 26 * blow, yaw * 0.65, 6 * wind - 8 * blow];
  p.neck = [6 * blow, 0];
  p.head = [10 * wind - 18 * blow - 6 * jolt, yaw * 0.4, -14 * blow];
  p.H += L * (0.08 * wind - 0.1 * blow);
  p.surge = L * 0.28 * blow;
  p.squash = 0.05 * jolt;
  p.puff = 0.6 * wind + 0.3 * blow;
  p.jaw = jolt;
  // The stones spun by the blow, on and slowing after it.
  const sp = 5 * smooth(clamp((t - hit + 0.04) / 0.3));
  p.spin = [sp, -sp];
  // Paws flung out for balance as it winds, tucked in for the blow.
  p.hand = p.hand.map((h, i) => add(h, [(i ? 1 : -1) * 0.5 * L * wind, -0.2 * L * wind, 0.35 * L * wind])) as V3[];
  // The near foot stepped forward into the blow and back.
  const step = ramp(t, 0.34, hit - 0.02) * (1 - ramp(t, hit + 0.2, 0.92));
  const A = R.ankle[0];
  p.at[0] = mixV(A, [A[0], A[1] + L * 0.5, A[2]], step);
  p.at[0][2] += L * 0.3 * (hump(t, (0.34 + hit) / 2, (hit - 0.34) / 2) + hump(t, (hit + 0.2 + 0.92) / 2, (0.92 - hit - 0.2) / 2));
  p.tail = [14 * wind - 10 * blow, -20 * wind + 20 * blow];
  p.ears = wind;
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/** Through a run of keys, each a moment and a point, eased from one to the next; held at the first before it and the last after. */
function path(t: number, keys: Array<[number, V3]>): V3 {
  if (t <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) if (t <= keys[q + 1][0]) return mixV(keys[q][1], keys[q + 1][1], smooth((t - keys[q][0]) / Math.max(1e-6, keys[q + 1][0] - keys[q][0])));
  return keys[keys.length - 1][1];
}

/** Where its mouth is, in the chest's frame as it stands: what it lifts the ear of wheat to. */
const mouthAt = (s: Ham): V3 => [0, s.neck.at[1] + s.head.r[1] * 0.78, s.neck.at[2] + s.neck.len + s.head.up - s.head.r[2] * 0.42];

/**
 * A go at its task: an ear of wheat held up in both paws, lifted to its mouth twice and the grain stripped off it, its jaw
 * working and its cheeks pumping; the millstones in them turning the whole time, once round in a go, so a go played over and
 * over is one long grinding, with the flour trickling out under them (`HAM_WORK`).
 */
function workPlan(s: Ham, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), W = HAM_WORK, L = R.reach;
  const mouth = mouthAt(s), low: V3 = [0, s.paw[1] + 0.02, lerp(s.paw[2], mouth[2], 0.35)], up: V3 = add(mouth, [0, 0.06 + s.hand * 0.6, -s.hand * 2.2]);
  const [f0, f1] = W.feeds;
  const mid = path(t, [[0, low], [f0 - 0.08, up], [f0 + 0.04, up], [f0 + 0.2, low], [f1 - 0.08, up], [f1 + 0.04, up], [f1 + 0.2, low]]);
  p.hand = [add(mid, [-s.hand * 1.3, 0, 0]), add(mid, [s.hand * 1.3, 0, 0])];
  p.held = 1;
  const feed = Math.max(hump(t, f0, 0.1), hump(t, f1, 0.1));
  // Its jaw at each chew, its cheeks pumping, the head nodding with it.
  const chew = Math.max(...W.chews.map((c) => hump(t, c, 0.07)));
  p.jaw = chew;
  p.puff = 0.35 + 0.25 * chew;
  p.spin = [TAU * t, -TAU * t];
  p.neck = [6 * feed, 0];
  p.head = [-10 * feed - 5 * chew, 4 * Math.sin(t * TAU), 3 * Math.sin(t * TAU * 2)];
  p.chest = [4 + 4 * feed, 0, 0];
  p.H -= 0.03 * L * chew;
  p.ears = feed;
  p.tail = [0, 10 * Math.sin(t * TAU)];
  return mixPlan(restPlan(s, R), p, down);
}

/** Eating where it stands: both paws at its mouth, nibbling fast, its stones turning slowly. */
function grazePlan(s: Ham, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, mouth = mouthAt(s);
  const nib = Math.sin(t * TAU * 3);
  const at: V3 = add(mouth, [0, 0.04 + s.hand * 0.5, -s.hand * 2.4 + 0.02 * nib]);
  p.hand = [add(at, [-s.hand * 1.1, 0, 0]), add(at, [s.hand * 1.1, 0, 0])];
  p.chest = [8, 0, 0];
  p.neck = [8, 0];
  p.head = [-12 + 3 * nib, 6 * drift(t, 2), 0];
  p.jaw = 0.5 + 0.5 * nib;
  p.puff = 0.2;
  p.spin = [0.4 * t, -0.4 * t];
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its paws up and its stones spinning, a shake, and settled. */
function evolvePlan(s: Ham, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach;
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * (s.stage === 2 ? 44 : 62));
  p.H += L * (-0.12 * hunch + 0.12 * up);
  p.chest = [14 * hunch - 10 * up, 0, 0];
  p.neck = [8 * hunch - 6 * up, 0];
  p.head = [-12 * hunch + 18 * up, 0, 12 * shake];
  p.roll = 3 * shake;
  p.squash = 0.05 * hump(t, 0.72, 0.05);
  p.puff = -0.3 * hunch + 0.6 * up;
  const sp = TAU * 2 * smooth(clamp((t - 0.4) / 0.5));
  p.spin = [sp, -sp];
  const top = s.torso.z[s.torso.z.length - 1];
  p.hand = p.hand.map((h, i) => mixV(h, [(i ? 1 : -1) * s.shoulder[0] * 1.3, s.paw[1] * 0.6, top + s.arm[0] * 0.8], up)) as V3[];
  p.tail = [-8 * hunch + 18 * up, 12 * shake];
  p.ears = up;
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Ham, R: Rest, a: Anim): Plan {
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
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  return { mid: add(add(from, scale(d, along)), scale(v, h)), end };
}

/** A leg bent to put its ankle at `ankle`: the knee forward and a little out, always the same way round; the foot flat, turned a little out. */
function legOf(s: Ham, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.3, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.25 * fwd[1], fwd[1] - sd * 0.25 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The middle of the skull in the head's frame. */
const skullAt = (s: Ham): V3 => [0, 0.03, s.head.up];

/** The right stone's way out of its cheek, and its middle, in the head's frame (the left is their mirror). */
const stoneAxis = (s: Ham, sd: number): V3 => unit([sd * s.stone.axis[0], s.stone.axis[1], s.stone.axis[2]]);
const stoneAt = (s: Ham, sd: number): V3 => add(skullAt(s), [sd * s.stone.at[0], s.stone.at[1], s.stone.at[2]]);

/**
 * The bones of a stage: its pose, the hips raised and carried as it says, the chest on them, the neck and head, a stone in each
 * cheek turned as far as the pose says, each leg bent to put its foot where it is to be, each arm bent to put its paw where it
 * is to be, the ear of wheat between its paws, and the tail.
 */
function hamBones(s: Ham): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.chest.lean + P.chest[0];
    b.chest = joint(body, s.chest.at, -lean, P.chest[2], P.chest[1]);
    b.neck = joint(b.chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    // The head carried level whatever the hips and the chest do under it, then pitched as the pose says.
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    // The stones: each its face out of the cheek, pushed out as the cheeks puff, dropped as the jaw works, turned about its axle.
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, X = stoneAxis(s, sd);
      const Z0 = unit(sub([0, 0, 1], scale(X, X[2]))), Y0 = cross(Z0, X);
      const ang = P.spin[i] * sd;
      const at = add(stoneAt(s, sd), add(scale(X, s.stone.th * 0.25 * P.puff), [0, 0, -s.stone.r * 0.08 * P.jaw]));
      b[`stone${i}`] = compose(b.head, xfOf(X, rotAbout(Y0, X, ang), rotAbout(Z0, X, ang), at));
    }
    b.tail = joint(body, s.tail.at, -P.tail[0], 0, P.tail[1]);
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
      const want = place(b.chest, P.hand[i]);
      const sh = place(b.chest, [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      const { mid: el, end: wr } = bend2(sh, want, s.arm[0], s.arm[1], turn(b.chest, unit([sd * 0.8, -0.4, -0.5])));
      const [X0, Y0, Z0] = frameOf(sub(sh, el), fwd), [X1, Y1, Z1] = frameOf(sub(el, wr), fwd);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      b[`hand${i}`] = xfOf(X1, Y1, Z1, wr);
    }
    // The ear of wheat between its paws, its head toward its mouth; grown from nothing as it is taken up.
    {
      const m = scale(add(b.hand0.t, b.hand1.t), 0.5), mouth = place(b.head, add(skullAt(s), [0, s.head.r[1] * 0.85, -s.head.r[2] * 0.45]));
      const [X, Y, Z] = frameOf(sub(mouth, m), turn(b.chest, [0, 1, 0]));
      const k = Math.max(0.001, P.held);
      b.sheaf = { m: xfOf(scale(X, k), scale(Y, k), scale(Z, k), m).m, t: m };
    }
    b.shadow = shadowOf(body, 0);
    return b;
  };
  return (a) => pose(planOf(s, R, { ...a, go: a.act ? 0 : a.go }));
}

/* ---- what it is made of ------------------------------------------------------------- */

/** A patch painted onto the egg `(C, R)` round the way `dir`, `rx` by `ry`, turned `spin`: a cheek, a blaze. */
function patchOn(C: V3, R: V3, dir: V3, rx: number, ry: number, mat: Mat, spin = 0, lift = 0.012, sides = 12): Disc {
  const e = onEgg(C, R, dir), d = disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, sides, mat, { spin, at: add(e.p, scale(e.n, -0.02)) });
  return { ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); }) };
}

/** A tuft of fur: a soft flattened lobe from `root` out to `tip`, its flat side facing `face`, sagging `bend` in the middle. */
const tuft = (root: V3, tip: V3, r: number, face: V3, mat: Mat, bend = 0): Mesh => {
  const mid = add(mixV(root, tip, 0.5), [0, 0, bend]);
  return tube([root, mid, tip], [r * 0.8, r, 0], [r * 0.4, r * 0.5, 0], 5, mat, { up: face });
};

/** A grain of wheat: a fat golden seed pointing along `dir`, four-sided, pointed at both ends, fattest a little past its middle. */
const kernel = (c: V3, dir: V3, k: number, mat: Mat): Mesh =>
  tube([add(c, scale(dir, -k * 0.6)), add(c, scale(dir, k * 0.1)), add(c, scale(dir, k * 0.62))], [0, k * 0.36, 0], [0, k * 0.3, 0], 4, mat, { start: false, end: false });

/**
 * The head: a round skull, tan over the crown and down the back with a cream blaze up the middle of the brow, cream from the
 * eyes down; a small cream muzzle with a pink nose and a hamster's mouth; a rosy blush on each cheek; round dark eyes; and the
 * cheek pouches, fat with what is in them, round where the stones sit.
 */
function headOf(s: Ham, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), R = H.r, E = s.eye;
  const eyeZ = onEgg(C, R, E.dir).p[2] - C[2];
  const skull = painted(orb(C, R, n + 4, k + 3, 'coat'), (c) => {
    const d = onEggDir(C, R, c);
    if (c[2] - C[2] < eyeZ - E.size * 0.6 + R[2] * 0.25 * Math.min(0, d[1])) return 'mark';
    if (Math.abs(d[0]) < 0.15 && d[1] > 0.3 && d[2] < 0.85) return 'mark';
    return 'coat';
  });
  // The cheek pouches: fat cream cheeks out either side under the eyes, the stones set into them.
  const pouches = [1, -1].map((sd) => egg(add(C, [sd * R[0] * 0.62, R[1] * 0.28, -R[2] * 0.36]), UPRIGHT, [R[0] * 0.48, R[1] * 0.5, R[2] * 0.5], n, k, 'mark'));
  // The muzzle: a small cream bump low on the face, a pink nose on its top, the mouth under.
  const mc: V3 = add(C, [0, R[1] * 0.78, -R[2] * 0.3]), mr: V3 = [R[0] * 0.3, R[1] * 0.26, R[2] * 0.24];
  const muzzle = egg(mc, UPRIGHT, mr, n, k, 'muzzle');
  const nose = egg(add(mc, [0, mr[1] * 0.92, mr[2] * 0.45]), UPRIGHT, [R[0] * 0.075, R[0] * 0.05, R[0] * 0.05], 6, 3, 'nose');
  const mouth = smile(add(mc, [0, mr[1] * 0.95, -mr[2] * 0.15]), [0, 1, 0.15], R[0] * 0.17, 'lid');
  const cheeks = paint([1, -1].map((sd) => patchOn(C, R, [sd * (E.dir[0] + 0.32), E.dir[1] - 0.05, E.dir[2] - 0.42], E.size * 1.55, E.size * 0.95, 'inner', sd * 0.25, 0.03, 10)));
  return merge(skull, ...pouches, muzzle, nose, mouth, cheeks, eyesOf(s, shut));
}

/**
 * The eyes: each a dark rim, a big dark-brown iris, a darker middle and two glints, laid onto the skull's own curve; all of an
 * eye out of sight together when the head is between it and the viewer.
 */
function eyesOf(s: Ham, shut: boolean): Mesh {
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
    out.push(onto(disc(p, n, r * 1.16, r * 1.2, 12, 'lid', o), 0.014));
    out.push(onto(disc(p, n, r, r * 1.04, 12, 'crystal', o), 0.018));
    out.push(onto(disc(add(p, scale(up, -r * 0.08)), n, r * 0.62, r * 0.66, 10, 'eye', o), 0.022));
    out.push(onto(disc(add(add(p, scale(up, r * 0.34)), scale(across, side * r * 0.28)), n, r * 0.34, r * 0.34, 6, 'glint', { ...o, lit: true }), 0.03));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.42)), scale(across, -side * r * 0.3)), n, r * 0.15, r * 0.15, 5, 'glint', { ...o, lit: true }), 0.03));
  }
  return paint(out);
}

/** An ear: a round flap, grey-brown on the back, pink in its hollow, up and out on the top of the head. */
function earOf(s: Ham, sd: number, n: number): Mesh {
  const C = skullAt(s), R = s.head.r, E = s.ear;
  const e = onEgg(C, R, [sd * 0.62, -0.05, 0.78]);
  // Cupped and turned a little out, so it reads as a round ear from the side as well as from in front.
  const up = unit(add(e.n, [sd * 0.15, 0.1, 0.45])), face = unit(sub([sd * 0.6, 1, 0.1], scale(up, dot([sd * 0.6, 1, 0.1], up))));
  const base = add(e.p, scale(up, -E.len * 0.15));
  const pts = [0, 0.3, 0.6, 0.85, 1].map((u) => add(base, scale(up, E.len * u)));
  const ws = [E.w * 0.7, E.w * 0.98, E.w, E.w * 0.82, E.w * 0.3];
  const outer = tube(pts, ws, ws.map((x) => x * 0.45), n, (ring) => (ring === 0 ? 'coat' : 'membrane'), { up: face });
  const inner = tube(pts.slice(1, 4).map((p) => add(p, scale(face, E.w * 0.14))), [E.w * 0.7, E.w * 0.72, E.w * 0.5], [E.w * 0.1, E.w * 0.1, E.w * 0.06], n, 'inner', { up: face });
  return merge(outer, inner);
}

/** A sprig of wheat carved on a face: a curved stem and leaves down either side of it, from `a` to `b` bowed toward `c`, in a plane facing `n`. */
function sprig(a: V3, c: V3, b: V3, n: V3, size: number, mat: Mat): Disc[] {
  const out: Disc[] = [];
  const pts = [0, 0.25, 0.5, 0.75, 1].map((u) => { const q = 1 - u; return add(add(scale(a, q * q), scale(c, 2 * q * u)), scale(b, u * u)); });
  // The stem: a thin band along the points.
  for (let q = 0; q < pts.length - 1; q++) {
    const d = unit(sub(pts[q + 1], pts[q])), side = scale(unit(cross(n, d)), size * 0.07);
    out.push({ v: [sub(pts[q], side), add(pts[q], side), add(pts[q + 1], side), sub(pts[q + 1], side)], m: mat });
  }
  // The leaves: pairs up the stem, angled out toward its tip, and one at the tip.
  for (let q = 1; q < pts.length; q++) {
    const d = unit(sub(pts[q], pts[q - 1])), side = unit(cross(n, d)), r = size * (0.32 - 0.03 * q);
    for (const sd of [1, -1]) {
      const dir = unit(add(scale(d, 0.75), scale(side, sd * 0.7))), cc = add(pts[q], scale(dir, r * 1.05));
      out.push(disc(cc, n, r * 0.42, r, 6, mat, { up: dir }));
    }
  }
  const d = unit(sub(pts[4], pts[3]));
  out.push(disc(add(pts[4], scale(d, size * 0.3)), n, size * 0.13, size * 0.3, 6, mat, { up: d }));
  return out;
}

/**
 * A millstone, in its own frame, its face out along `x`: a thick grey wheel with its edges rounded, its eye in the middle, golden
 * wheat sprigs carved round the eye, a few darker flecks in the stone; on the Wheatcheeks bound round its rim and across its face
 * in brass, a brass boss on its hub with a golden flower on it.
 */
function stoneOf(s: Ham, n: number): Mesh {
  const S = s.stone, r = S.r, th = S.th, out: Mesh[] = [];
  const sides = n + 6;
  out.push(tube([[-th * 0.5, 0, 0], [-th * 0.4, 0, 0], [th * 0.4, 0, 0], [th * 0.5, 0, 0]], [r * 0.9, r, r, r * 0.9], [r * 0.9, r, r, r * 0.9], sides, (ring) => (ring === 1 ? 'stone' : 'stoneDark'), { up: [0, 0, 1] }));
  const X: V3 = [1, 0, 0], f = th * 0.5 + 0.004;
  const decals: Disc[] = [];
  // The eye: a dark hole with a rim round it, under the boss where there is one.
  if (!S.brass) {
    decals.push(disc([f, 0, 0], X, r * 0.24, r * 0.24, 10, 'stoneDark', { up: [0, 0, 1] }));
    decals.push(disc([f + 0.003, 0, 0], X, r * 0.15, r * 0.15, 10, 'lid', { up: [0, 0, 1] }));
  }
  // Flecks in the stone.
  for (let q = 0; q < 6; q++) {
    const a = jitter(q + 3) * TAU, d = r * (0.45 + 0.4 * jitter(q + 9));
    decals.push(disc([f, Math.cos(a) * d, Math.sin(a) * d], X, r * 0.035, r * 0.025, 4, 'stoneDark', { up: [0, Math.cos(a), Math.sin(a)] }));
  }
  // The sprigs: a wreath of two round the eye, its stems meeting at the foot; the Wheatcheeks' four, one in each quarter between the bands.
  const P = (a: number, d: number): V3 => [f + 0.002, Math.cos(a) * d, Math.sin(a) * d];
  if (S.sprigs === 2) {
    for (const sd of [1, -1]) decals.push(...sprig(P(-Math.PI / 2 + sd * 0.25, r * 0.5), P(sd * 0.05 + (sd > 0 ? 0 : Math.PI), r * 0.78), P(Math.PI / 2 + sd * 0.45, r * 0.62), X, r * 0.55, 'fitting'));
  } else {
    for (let q = 0; q < 4; q++) {
      const a0 = (q + 0.5) * (Math.PI / 2);
      decals.push(...sprig(P(a0 - 0.55, r * 0.42), P(a0, r * 0.82), P(a0 + 0.5, r * 0.62), X, r * 0.4, 'fitting'));
    }
  }
  if (S.brass) {
    // The bands: across the face, up and across, and round the rim.
    for (const a of [0, Math.PI / 2]) {
      const d: V3 = [0, Math.cos(a), Math.sin(a)], w: V3 = [0, -Math.sin(a), Math.cos(a)];
      // From the boss out to the rim on either side, the boss left clear.
      for (const sd of [1, -1]) {
        const a0 = scale(d, sd * r * 0.4), a1 = scale(d, sd * r * 0.9), ww = scale(w, r * 0.07);
        decals.push({ v: [add(P(0, 0), sub(a0, ww)), add(P(0, 0), sub(a1, ww)), add(P(0, 0), add(a1, ww)), add(P(0, 0), add(a0, ww))], m: 'hornDark' });
      }
    }
    out.push(tube([[-th * 0.12, 0, 0], [th * 0.12, 0, 0]], r * 1.02, r * 1.02, sides, 'hornDark', { up: [0, 0, 1], start: false, end: false }));
    // The boss on the hub: a brass drum, a golden flower on its face.
    const bh = th * 0.22, br = r * 0.36;
    out.push(tube([[th * 0.45, 0, 0], [th * 0.5 + bh, 0, 0]], br, br, n, 'hornDark', { up: [0, 0, 1] }));
    const bf = th * 0.5 + bh + 0.004;
    const flower: Disc[] = [disc([bf, 0, 0], X, br * 0.9, br * 0.9, 12, 'hornDark', { up: [0, 0, 1] })];
    for (let q = 0; q < 8; q++) {
      const a = (q / 8) * TAU, d: V3 = [0, Math.cos(a), Math.sin(a)];
      flower.push(disc(add([bf + 0.002, 0, 0], scale(d, br * 0.48)), X, br * 0.17, br * 0.36, 6, 'bloom', { up: d }));
    }
    flower.push(disc([bf + 0.004, 0, 0], X, br * 0.2, br * 0.2, 8, 'fitting', { up: [0, 0, 1] }));
    out.push(paint(flower));
  }
  out.push(paint(decals));
  return merge(...out);
}

/**
 * The beard: strands of wheat kernels hanging from under the chin down the chest -- each strand a wheat ear, its kernels in
 * pairs pointing down and out from it -- longer down the middle than at the sides; in the chest's frame.
 */
function beardOf(s: Ham): Mesh {
  const B = s.beard, out: Mesh[] = [];
  const top = s.torso.z[s.torso.z.length - 1] - s.head.r[2] * 0.15;
  for (let c = 0; c < B.strands; c++) {
    const u = B.strands === 1 ? 0 : (c / (B.strands - 1)) * 2 - 1;
    const a = Math.PI / 2 - u * B.spread;
    const rows = Math.max(2, Math.round(B.rows * (1 - 0.35 * u * u)));
    for (let q = 0; q < rows; q++) {
      const z = top - (q + 0.5) * B.k * 0.82;
      const p = onBody(s, z, a, B.k * 0.32);
      const out0 = unit([Math.cos(a), Math.sin(a), 0]), across = unit(cross([0, 0, 1], out0));
      for (const sd of [1, -1]) {
        const dir = unit(add(add([0, 0, -1], scale(across, sd * 0.75)), scale(out0, 0.35)));
        const c0 = add(add(p, scale(across, sd * B.k * 0.2)), scale(out0, 0.01 * (q % 2)));
        out.push(kernel(c0, dir, B.k, (q + c) % 3 === 0 ? 'billDark' : 'bill'));
      }
    }
    // The tip of the ear: one kernel straight down.
    const zEnd = top - (rows + 0.2) * B.k * 0.82;
    out.push(kernel(onBody(s, zEnd, a, B.k * 0.3), unit([0, 0.15, -1]), B.k * 0.9, 'bill'));
  }
  return merge(...out);
}

/** The kernels at the chin: a short fringe of them under the mouth, where the beard starts; in the head's frame. */
function chinOf(s: Ham): Mesh {
  const C = skullAt(s), R = s.head.r, k = s.beard.k * 0.9, out: Mesh[] = [];
  for (let q = 0; q < 5; q++) {
    const u = (q / 4) * 2 - 1;
    const e = onEgg(C, R, [u * 0.55, 0.7, -0.62]);
    const p = add(e.p, scale(e.n, k * 0.15));
    out.push(kernel(p, unit([u * 0.4, 0.3, -1]), k, q % 2 ? 'billDark' : 'bill'));
    out.push(kernel(add(p, [u * 0.02, 0.02, -k * 0.7]), unit([u * 0.6, 0.2, -1]), k * 0.9, 'bill'));
  }
  return merge(...out);
}

/**
 * The ruff round its neck and shoulders, in the chest's frame: the Wheatley's of fluffy cream tufts; the bigger two's of long
 * pale-wheat tufts, layered, over the shoulders and round the back.
 */
function ruffOf(s: Ham): Mesh {
  const F = s.ruff, out: Mesh[] = [];
  const zt = s.torso.z[s.torso.z.length - 1];
  const rows = F.wheat ? 2 : 1;
  for (let row = 0; row < rows; row++) {
    const z = zt - 0.05 - row * F.len * 0.55;
    for (let q = 0; q < F.count; q++) {
      const a = (q / F.count) * TAU + row * 0.2 + Math.PI / 2;
      // Not across the front, where the beard hangs.
      const front = Math.cos(a - Math.PI / 2);
      if (front > 0.93) continue;
      const root = onBody(s, z, a, -0.02);
      const o = unit([Math.cos(a), Math.sin(a), 0]);
      const L = F.len * (0.8 + 0.4 * jitter(q + row * 31)) * (1 - 0.25 * front);
      const tip = add(add(root, scale(o, L * 0.85)), [0, 0, -L * 0.5]);
      const mat: Mat = F.wheat ? (q % 3 === 0 ? 'feather' : q % 3 === 1 ? 'featherDark' : 'mark') : q % 2 ? 'mark' : 'muzzle';
      out.push(tuft(root, tip, L * 0.36, o, mat, L * 0.12));
    }
  }
  return merge(...out);
}

/** The Wheatcheeks' mantle: rows of wheat husks, long and pointed, laid over its shoulders and back like a cape; in the chest's frame. */
function mantleOf(s: Ham, n: number): Mesh {
  const out: Mesh[] = [], zt = s.torso.z[s.torso.z.length - 1], L = 0.28;
  for (let row = 0; row < s.mantle; row++) {
    const z = zt - 0.02 - row * L * 0.42, count = 16 + row * 2;
    for (let q = 0; q < count; q++) {
      const a = (q / count) * TAU + Math.PI / 2 + row * 0.12;
      const front = Math.cos(a - Math.PI / 2);
      if (front > 0.8) continue;
      const o = unit([Math.cos(a), Math.sin(a), 0]), root = onBody(s, z, a, 0.04 + row * 0.03);
      const len = L * (0.9 + 0.25 * jitter(q + row * 17));
      const dir = unit(add(scale(o, 0.6), [0, 0, -1]));
      out.push(tube([root, add(root, scale(dir, len * 0.4)), add(root, scale(dir, len))], [len * 0.1, len * 0.16, 0], [len * 0.04, len * 0.06, 0], 4, (q + row) % 3 === 0 ? 'billDark' : 'bloom', { up: o, end: false }));
    }
  }
  return merge(...out);
}

/** The fluff round its body: tufts out from the belly's sides and under it, each the colour of the coat where it grows; in the body's frame. */
function fluffOf(s: Ham, seed: number): Mesh {
  const Hc = s.hips.c, Hr = s.hips.r, out: Mesh[] = [];
  const count = [10, 12, 14][s.stage];
  for (const [zf, k] of [[0.1, 0.8], [-0.3, 1]] as Array<[number, number]>) {
    for (let q = 0; q < count; q++) {
      const a = (q / count) * TAU + zf;
      const d: V3 = [Math.cos(a), Math.sin(a), zf];
      const e = onEgg(Hc, Hr, d);
      if (e.n[1] > 0.3) continue;
      const L = Hr[0] * 0.2 * k * (0.8 + 0.4 * jitter(q * 3 + k * 7));
      const tip = add(add(e.p, scale(e.n, L * 0.6)), [0, 0, -L * 0.55]);
      out.push(tuft(add(e.p, scale(e.n, -L * 0.3)), tip, L * 0.55, e.n, creamAt(onEggDir(Hc, Hr, e.p), seed) ? 'mark' : 'coat', -L * 0.05));
    }
  }
  return merge(...out);
}

/** The torso: tan in patches over cream, cream down its front; in the chest's frame. */
function torsoOf(s: Ham, n: number, seed: number): Mesh {
  const T = s.torso, Hc = sub(s.hips.c, s.chest.at);
  const m = tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n, 'coat', { up: [0, 1, 0] });
  return painted(m, (c) => {
    const d = unit([c[0], c[1] - Hc[1], (c[2] - T.z[T.z.length - 1]) * 0.3]);
    return d[1] > 0.5 || creamAt([d[0], d[1], 0.2], seed + 1) ? 'mark' : 'coat';
  });
}

/** The ear of wheat it works: a straw stalk and a golden head of kernels in pairs, a few whiskers; along `z` from the paws. */
function sheafOf(s: Ham): Mesh {
  const k = s.beard.k * 1.1, L = s.hand * 4.4, out: Mesh[] = [];
  out.push(tube([[0, 0, -L * 0.45], [0, 0, L * 0.25]], k * 0.12, k * 0.12, 4, 'stem'));
  for (let q = 0; q < 5; q++) {
    const z = L * 0.25 + q * k * 0.55;
    for (const sd of [1, -1]) out.push(kernel([sd * k * 0.22, 0, z], unit([sd * 0.6, 0.2, 1]), k, q % 2 ? 'billDark' : 'bill'));
  }
  out.push(kernel([0, 0, L * 0.25 + 5 * k * 0.55], [0, 0, 1], k, 'bill'));
  for (const sd of [1, -1]) out.push(taper([[sd * k * 0.3, 0, L * 0.25 + 2 * k], [sd * k * 1.2, 0.02, L * 0.25 + 5.5 * k]], k * 0.05, 0.004, 3, 'stem'));
  return merge(...out);
}

/** The tail: a fluffy plume of tufts out from its root, pale at the tips. */
function tailOf(s: Ham): Mesh {
  const T = s.tail, out: Mesh[] = [];
  for (let q = 0; q < T.tufts; q++) {
    const a = (q / T.tufts) * TAU, L = T.len * (0.8 + 0.4 * jitter(q + 40));
    const dir = unit([Math.cos(a) * 0.45, -1, Math.sin(a) * 0.45 + 0.35]);
    out.push(tuft([0, 0, 0], scale(dir, L), L * 0.5, unit(cross(dir, [1, 0, 0])), q % 3 ? 'mark' : 'coat', -L * 0.1));
  }
  out.push(orb([0, -T.len * 0.25, 0.02], [T.len * 0.42, T.len * 0.5, T.len * 0.4], 6, 4, 'coat'));
  return merge(...out);
}

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Ham): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];

/** A stage's pieces. */
function hamBuild(s: Ham, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), pieces: Piece[] = [], seed = 1.3 + s.stage;
  const hide = headSolids(s);
  const Hc = s.hips.c, Hr = s.hips.r;
  pieces.push({ key: 'hips', mesh: painted(orb(Hc, Hr, n + 4, k + 2, 'coat'), (c) => (creamAt(onEggDir(Hc, Hr, c), seed) ? 'mark' : 'coat')), bone: 'trunk', bias: 0 });
  pieces.push({ key: 'fluff', mesh: fluffOf(s, seed), bone: 'trunk', bias: 0.005, after: 'hips', lines: false });
  pieces.push({ key: 'torso', mesh: torsoOf(s, n + 2, seed), bone: 'chest', bias: 0.01, after: 'hips', breathes: { c: [0, 0, s.torso.z[1]], k: 0.04 } });
  pieces.push({ key: 'ruff', mesh: ruffOf(s), bone: 'chest', bias: 0.03, after: ['torso'], lines: false });
  if (s.mantle) pieces.push({ key: 'mantle', mesh: mantleOf(s, n), bone: 'chest', bias: 0.035, after: ['torso', 'ruff'] });
  pieces.push({ key: 'beard', mesh: beardOf(s), bone: 'chest', bias: 0.05, after: ['torso', 'ruff'], under: 'head', lines: false });
  pieces.push({ key: 'neck', mesh: tube([[0, 0, -0.1], [0, 0, s.neck.len + 0.05]], s.neck.w, s.neck.w * 0.9, n, 'coat'), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'chin', mesh: chinOf(s), bone: 'head', bias: 0.205, after: 'head', hide });
  for (const sd of [-1, 1]) pieces.push({ key: `ear${sd > 0 ? 1 : 0}`, mesh: earOf(s, sd, n), bone: 'head', bias: 0.19, after: 'head', hide, lines: false });
  // The millstones, each drawn over the head while its face is toward the viewer and under it once turned away.
  const stone = stoneOf(s, n);
  for (let i = 0; i < 2; i++) pieces.push({ key: `stone${i}`, mesh: stone, bone: `stone${i}`, bias: 0.21, after: ['head', 'chin'], front: [1, 0, 0] });
  pieces.push({ key: 'tail', mesh: tailOf(s), bone: 'tail', bias: -0.1, lines: false });
  // Legs: a round furred haunch, a short shin, a pink foot with its toes.
  const L = s.leg;
  for (const key of ['ll', 'lr']) {
    const front: V3 = [0, 1, 0];
    const thigh = merge(egg([0, 0, -L.len[0] * 0.3], UPRIGHT, [L.w[0] * 0.85, L.w[0] * 0.85, L.len[0] * 0.7], n, k, 'coat'), tube([[0, 0, 0], [0, 0, -L.len[0]]], [L.w[0], L.w[1]], [L.w[0], L.w[1]], n, 'coat', { seam: 'start' }));
    const shin = tube([[0, 0, L.w[1] * 0.5], [0, 0.005, -L.len[1]]], [L.w[1], L.w[1] * 0.85], [L.w[1], L.w[1] * 0.85], n, 'mark', { seam: 'start' });
    const fw = L.foot[1], fl = L.foot[0], drop = L.len[2];
    const foot = merge(
      egg([0, fl * 0.2, -drop + fw * 0.35], UPRIGHT, [fw * 0.85, fl * 0.55, fw * 0.45], n, k, 'pad'),
      ...[-1, -0.33, 0.33, 1].map((q) => egg([q * fw * 0.55, fl * 0.7, -drop + fw * 0.2], UPRIGHT, [fw * 0.22, fw * 0.28, fw * 0.2], 4, 3, 'pad')),
    );
    pieces.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, after: ['hips', 'fluff'], front },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['hips', `${key}0`], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.02, after: ['hips', 'fluff', `${key}1`], front },
    );
  }
  // Arms: a round furred upper arm, a cream forearm, a small pink paw with its fingers.
  for (let i = 0; i < 2; i++) {
    // The forearm's frame runs up it from the paw, so forward out of the chest is down it and a little up.
    const front: V3 = [0, 1, 0], ahead: V3 = [0, 0.5, -0.85];
    const upper = merge(
      egg([0, 0, -s.arm[0] * 0.3], UPRIGHT, [s.armW[0] * 1.35, s.armW[0] * 1.35, s.arm[0] * 0.7], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -s.arm[0]]], [s.armW[0] * 1.1, s.armW[1] * 1.1], [s.armW[0] * 1.1, s.armW[1] * 1.1], n, 'coat', { seam: 'start' }),
    );
    const fore = merge(
      egg([0, 0, 0], UPRIGHT, [s.armW[1] * 1.05, s.armW[1] * 1.05, s.armW[1] * 1.05], n, k, 'mark'),
      tube([[0, 0, 0], [0, 0, -s.arm[1] + s.hand * 0.5]], [s.armW[1] * 1.05, s.armW[1] * 0.8], [s.armW[1] * 1.05, s.armW[1] * 0.8], n, 'mark', { seam: 'both' }),
    );
    const h = s.hand;
    const paw = merge(
      egg([0, 0, -h * 0.2], UPRIGHT, [h * 1.0, h * 0.8, h * 1.0], n, k, 'pad'),
      ...[-0.6, -0.2, 0.2, 0.6].map((q) => egg([q * h * 0.9, h * 0.3, -h * 0.95], UPRIGHT, [h * 0.24, h * 0.24, h * 0.36], 4, 3, 'pad')),
    );
    pieces.push(
      { key: `arm${i}`, mesh: upper, bone: `arm${i}`, bias: 0.06, after: ['torso', 'ruff', 'beard'], front },
      { key: `fore${i}`, mesh: fore, bone: `elbow${i}`, bias: 0.065, after: ['torso', `arm${i}`, 'beard'], front: ahead },
      { key: `hand${i}`, mesh: paw, bone: `hand${i}`, bias: 0.07, after: ['torso', `fore${i}`, 'beard'], front: ahead },
    );
  }
  // The ear of wheat it works, between its paws.
  pieces.push({ key: 'sheaf', mesh: sheafOf(s), bone: 'sheaf', bias: 0.068, after: ['beard', 'hand0', 'hand1'], shown: (a) => a.act?.kind === 'work' });
  return pieces;
}

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const FLOUR: RGB = [250, 246, 236];
const GRAIN: RGB = [232, 178, 82];
const GRIT: RGB = [168, 162, 152];

/** A puff of flour or stone dust, growing and thinning over its life. */
function puffOf(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, c: RGB, k = 0.5): void {
  if (age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at), al = k * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.9 * age);
  const grad = g.createRadialGradient(x, y - rr * 0.2 * age, 0, x, y - rr * 0.2 * age, rr);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - rr, y - rr * 1.2, rr * 2, rr * 2);
}

/** Where flour comes out from under a stone: low on its inner edge, between it and the cheek. */
const flourFrom = (s: Ham, b: Bones, i: number): V3 => {
  const x = b[`stone${i}`], X: V3 = [x.m[0], x.m[3], x.m[6]];
  return add(add(x.t, scale(X, -s.stone.th * 0.3)), [0, 0, -s.stone.r * 0.85]);
};

/**
 * What a go at its task throws: flour trickling out from under each stone the whole time they turn, falling to the ground in
 * a little heap in front of it; and the grain stripped off the ear into its mouth at each feed.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Ham, b: Bones, a: Anim, t: number, front: boolean): void {
  const W = HAM_WORK, mid = b.chest.t, down = downOf(t, a.graze), size = s.stone.r;
  if (down <= 0.05) return;
  g.save();
  // The trickle: a thin stream of flour falling from under each stone the whole time they turn, grains of it breaking off the
  // stream, and a heap of it on the ground under each stone, drawn under everything.
  for (let i = 0; i < 2; i++) {
    const from = flourFrom(s, b, i), land: V3 = [from[0], from[1] + size * 0.15, 0];
    if (!front) {
      const [x, y] = onScreen(view, land);
      g.fillStyle = css([226, 214, 192], 0.9 * down);
      g.beginPath();
      g.ellipse(x, y + size * 0.05, size * 0.75, size * 0.3, 0, 0, TAU);
      g.fill();
      g.fillStyle = css(FLOUR, down);
      g.beginPath();
      g.ellipse(x, y - size * 0.06, size * 0.55, size * 0.24, 0, 0, TAU);
      g.fill();
    }
    if (nearSide(from, mid, view) !== front) continue;
    const [x0, y0] = onScreen(view, from), [x1, y1] = onScreen(view, land);
    g.strokeStyle = css(FLOUR, 0.75 * down);
    g.lineWidth = size * 0.14;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + (x1 - x0) * 0.1, (y0 + y1) / 2, x1, y1);
    g.stroke();
    const fall = Math.max(0.05, from[2]), T = Math.sqrt((2 * fall) / 9.8);
    g.fillStyle = css(FLOUR, down);
    for (let q = 0; q < 7; q++) {
      const ph = frac(t * 3.3 + q / 7 + i * 0.37), tt = ph * T;
      const p: V3 = [from[0] + (jitter(q + i * 9) - 0.5) * size * 0.4 * ph, from[1] + size * 0.15 * ph, from[2] - 4.9 * tt * tt];
      if (p[2] < 0) continue;
      const [x, y] = onScreen(view, p);
      g.beginPath();
      g.arc(x, y, size * (0.07 + 0.05 * jitter(q + 5)), 0, TAU);
      g.fill();
    }
    puffOf(g, view, land, size * 0.6, frac(t * 2 + i * 0.5), FLOUR, 0.4 * down);
  }
  // Grain into its mouth at each feed: kernels hopping off the ear.
  const mouth = place(b.head, add(skullAt(s), [0, s.head.r[1] * 0.85, -s.head.r[2] * 0.45]));
  const tip = place(b.sheaf, [0, 0, s.hand * 4.4 * 0.25 + 4 * s.beard.k * 0.6]);
  for (const f of W.feeds) {
    for (let q = 0; q < 4; q++) {
      const u = (t - (f - 0.06 + q * 0.025)) / 0.08;
      if (u < 0 || u > 1) continue;
      const p = add(mixV(tip, mouth, u), [0, 0, 0.12 * size * Math.sin(Math.PI * u)]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      g.fillStyle = css(GRAIN, 1);
      g.beginPath();
      g.ellipse(x, y, s.beard.k * 0.55, s.beard.k * 0.38, q, 0, TAU);
      g.fill();
    }
  }
  g.restore();
}

/** What a strike throws: grit and flour off the stone where it lands. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Ham, b: Bones, at: Bones, t: number, front: boolean): void {
  const since = (t - HAM_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t;
  if (since <= 0 || since > 0.4) return;
  // The stone that led: the one furthest forward at the blow.
  const fwd = turn(at.body, [0, 1, 0]);
  const lead = dot(at.stone0.t, fwd) > dot(at.stone1.t, fwd) ? at.stone0 : at.stone1;
  const X: V3 = [lead.m[0], lead.m[3], lead.m[6]], p = add(lead.t, add(scale(X, s.stone.th * 0.5), scale(fwd, s.stone.r * 0.6)));
  if (nearSide(p, mid, view) === front) {
    puffOf(g, view, p, s.stone.r * 1.1, since / 0.4, FLOUR, 0.55);
    puffOf(g, view, add(p, [0, 0, -s.stone.r * 0.3]), s.stone.r * 0.8, since / 0.32, GRIT, 0.35);
  }
  g.save();
  for (let q = 0; q < 7 + 2 * s.stage; q++) {
    const kq = q * 7 + s.stage * 3, a = jitter(kq) * TAU, sp = s.stone.r * (3 + 3 * jitter(kq + 1));
    const v: V3 = add(scale(fwd, sp * 0.6), [Math.cos(a) * sp * 0.6, Math.sin(a) * sp * 0.6, sp * (0.3 + 0.6 * jitter(kq + 2))]);
    const c: V3 = [p[0] + v[0] * since, p[1] + v[1] * since, p[2] + v[2] * since - 4.9 * since * since];
    if (c[2] < 0 || nearSide(c, mid, view) !== front) continue;
    const [x, y] = onScreen(view, c);
    g.fillStyle = css(q % 3 ? GRIT : GRAIN, 1 - smooth(since / 0.4));
    g.beginPath();
    g.arc(x, y, s.stone.r * (0.05 + 0.04 * jitter(kq + 3)), 0, TAU);
    g.fill();
  }
  g.restore();
}

/** Evolving: wheat kernels and motes of flour swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Ham, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const R0 = s.hips.r[0] * 1.6 + 0.2, high = s.torso.z[s.torso.z.length - 1] + s.high + s.head.up * 2;
  g.save();
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.38), ang = (q / 18) * TAU + u * TAU * 1.5, kk = (1 - u) ** 1.1;
    const p: V3 = [Math.cos(ang) * R0 * kk, Math.sin(ang) * R0 * kk, 0.2 + u * high * 0.8];
    if (nearSide(p, b.chest.t, view) !== front) continue;
    const [x, y] = onScreen(view, p), r = (0.07 + 0.03 * s.stage) * (1 - 0.4 * u), al = swirl * ramp(u, 0, 0.12);
    g.fillStyle = css(q % 3 ? GRAIN : FLOUR, al);
    g.beginPath();
    g.ellipse(x, y, r * 0.65, r, ang * 2, 0, TAU);
    g.fill();
  }
  g.restore();
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function hamKind(s: Ham): Kind {
  const bones = hamBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: HAM_HITS[s.stage] } });
  return {
    bones,
    build: (lod) => hamBuild(s, lod),
    // The variant's two colours are its tan and its cream; its pink nose, ears and paws, its dark eyes, its grey millstones and
    // golden wheat and brass are the same on every variant.
    palette: (coat, mark) => {
      const tan = mix(coat, pastel(coat, 34), 0.35), cream = mix([252, 242, 222], pastel(mark, 40), 0.35);
      return coatPalette(coat, mark, {
        coat: tan,
        coatDark: mix(tan, [120, 80, 56], 0.3),
        coatLight: mix(tan, [255, 248, 236], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 253, 248], 0.6),
        inner: [242, 158, 160],
        membrane: [150, 128, 120],
        lid: [70, 44, 36],
        nose: [236, 150, 156],
        eye: [34, 20, 18],
        glint: [255, 253, 246],
        crystal: [96, 58, 38],
        pad: [240, 178, 170],
        feather: mix(cream, [236, 196, 120], 0.45),
        featherDark: mix(tan, [236, 190, 110], 0.4),
        bill: [236, 182, 86],
        billDark: [208, 146, 62],
        bloom: [255, 222, 120],
        stem: [214, 178, 104],
        stone: [200, 194, 182],
        stoneDark: [156, 150, 140],
        fitting: [222, 176, 76],
        hornDark: [178, 128, 62],
      } as Partial<ReturnType<Kind['palette']>>, 34);
    },
    shadow: [s.hips.r[1] * 1.2 + s.tail.len * 0.3, s.hips.r[0] * 1.15 + s.stone.th * 0.6],
    stride: 1.4,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are wheat gold and flour white.
    motes: [[236, 186, 92], [252, 248, 236]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const WHEATLEY = hamKind(WHEATLEY_LOOK);
export const WHEATWHIRL = hamKind(WHEATWHIRL_LOOK);
export const WHEATCHEEKS = hamKind(WHEATCHEEKS_LOOK);
