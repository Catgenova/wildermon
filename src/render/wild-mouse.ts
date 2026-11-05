import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  scale, shadowOf, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The cheese-mouse line: the Wheybit, a small round mouse stood up on its hind feet, brown over a cream front, huge round pink
 * ears, a long pink tail curling up behind it, its eyes shut tight in a laugh and its mouth open, its white paws clasped at its
 * chest over a collar of green leaves, a little cream apron tied round its belly with a bow at the side; which grows into the
 * Pressqueak, bigger and rounder, a frilled cream mob cap with a yellow band on its head, a fuller collar of leaves and a bigger
 * apron with a gold border of leaves along its hem; and then the Fromageon, large and portly, its cap patterned cream and gold,
 * a puffed cream scarf round its neck, a green cape with gold leaves embroidered along its hem and a yellow cheese wedge on it,
 * a gold rope belt knotted at the side with two tassels hanging, and a long apron to its feet. The species is still `frosta`
 * underneath, as saves and the database know it: it presses cheese in the settlement stores.
 *
 * All three are built by one set of functions from a description of the stage (`Mus`), the way the hamster line is
 * (`./wild-hamster`): its legs bent to put each foot where it is to be, its arms bent to put its paws where they are to be. It
 * walks with a waddle, its tail swinging after it. At its task it holds a round of curd between its paws and squeezes it, twice,
 * the whey running out of it and dripping to the ground; it strikes by twisting away and shoving both paws into the blow.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Mus {
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
  /** The skull's half-sizes, how far its middle is over the top of the neck, and how far it is pitched nose-up. */
  head: { r: V3; up: number; pitch: number };
  /** The muzzle: its middle and half-sizes, each a share of the skull's. */
  snout: { at: V3; r: V3 };
  eye: { dir: V3; size: number };
  /** An ear: how tall and how wide its round flap is, and the way out of the skull to where it grows, the right one. */
  ear: { len: number; w: number; dir: V3 };
  /** The tail: its root on the body, its length and how thick it is at the root. */
  tail: { at: V3; len: number; w: number };
  /** The collar of leaves round its neck: how many in a row, how long, how many rows; none on the Fromageon. */
  collar: { count: number; len: number; rows: number };
  /**
   * The apron, in the body's frame: the height of its waistband and of its hem, how far round from the front it reaches either
   * side (radians), whether its hem has a gold border of leaves, the bow's size (none on the Fromageon, whose belt is knotted),
   * and how far the hem stands out past the belly.
   */
  apron: { top: number; bottom: number; spread: number; border: boolean; bow: number; flare: number };
  /** The mob cap: how high its crown puffs, and whether it is patterned cream and gold; none on the Wheybit. */
  cap: null | { puff: number; pattern: boolean };
  /** The Fromageon's cape, scarf and rope belt. */
  robe: boolean;
  /** The round of curd it presses: its radius and thickness, and where its middle is held in the chest's frame (against the belly, under the paws). */
  round: [number, number];
  press: V3;
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the hips sink at each footfall; how far it rolls and sways over each foot. */
    step: number; bob: number; roll: number; sway: number;
  };
  size: number;
}

/** A Wheybit: small and round, a big head and huge ears, its paws clasped over a collar of leaves, a little apron round its belly. */
const WHEYBIT_LOOK: Mus = {
  stage: 0,
  leg: { at: [0.2, 0.02, -0.16], len: [0.1, 0.09, 0.035], w: [0.12, 0.08], foot: [0.28, 0.11], stance: 0.23, ahead: 0.14 },
  high: 0.32,
  hips: { c: [0, 0, 0.06], r: [0.49, 0.38, 0.33] },
  chest: { at: [0, 0, 0.1], lean: 0 },
  torso: { z: [-0.08, 0.1, 0.22, 0.3], y: [0.02, 0.04, 0.03, 0], w: [0.38, 0.33, 0.26, 0.19], h: [0.33, 0.3, 0.24, 0.17] },
  shoulder: [0.14, 0.15, 0.16],
  arm: [0.15, 0.14], armW: [0.065, 0.058], hand: 0.08,
  paw: [0.07, 0.34, 0.17],
  neck: { at: [0, 0.02, 0.28], len: 0.03, w: 0.17 },
  head: { r: [0.38, 0.34, 0.31], up: 0.22, pitch: 20 },
  snout: { at: [0, 0.72, -0.08], r: [0.54, 0.5, 0.44] },
  eye: { dir: [0.42, 0.72, 0.5], size: 0.075 },
  ear: { len: 0.48, w: 0.27, dir: [0.62, -0.4, 0.74] },
  tail: { at: [0, -0.36, -0.16], len: 0.95, w: 0.06 },
  collar: { count: 12, len: 0.17, rows: 1 },
  apron: { top: 0.09, bottom: -0.2, spread: 1.05, border: false, bow: 0.065, flare: 0.03 },
  cap: null,
  robe: false,
  round: [0.14, 0.075],
  press: [0, 0.46, 0.1],
  gait: { duty: [0.62, 0.42], swing: [0.55, 0.5], step: 0.5, bob: 0.06, roll: 10, sway: 0.08 },
  size: 4.1,
};

/** A Pressqueak: bigger and rounder, a frilled mob cap, a fuller collar of leaves, a bigger apron with a gold border. */
const PRESSQUEAK_LOOK: Mus = {
  stage: 1,
  leg: { at: [0.27, 0.03, -0.2], len: [0.12, 0.11, 0.045], w: [0.16, 0.1], foot: [0.36, 0.14], stance: 0.31, ahead: 0.18 },
  high: 0.4,
  hips: { c: [0, 0.02, 0.08], r: [0.67, 0.5, 0.42] },
  chest: { at: [0, 0, 0.14], lean: 2 },
  torso: { z: [-0.12, 0.12, 0.28, 0.38], y: [0.02, 0.05, 0.03, 0], w: [0.5, 0.42, 0.33, 0.24], h: [0.44, 0.38, 0.3, 0.22] },
  shoulder: [0.19, 0.22, 0.22],
  arm: [0.2, 0.19], armW: [0.085, 0.075], hand: 0.1,
  paw: [0.09, 0.45, 0.2],
  neck: { at: [0, 0.02, 0.36], len: 0.04, w: 0.21 },
  head: { r: [0.45, 0.41, 0.36], up: 0.27, pitch: 20 },
  snout: { at: [0, 0.72, -0.08], r: [0.54, 0.5, 0.44] },
  eye: { dir: [0.42, 0.72, 0.5], size: 0.088 },
  ear: { len: 0.58, w: 0.32, dir: [0.66, -0.42, 0.7] },
  tail: { at: [0, -0.48, -0.2], len: 1.2, w: 0.075 },
  collar: { count: 15, len: 0.21, rows: 2 },
  apron: { top: 0.3, bottom: -0.3, spread: 1.2, border: true, bow: 0.085, flare: 0.05 },
  cap: { puff: 1, pattern: false },
  robe: false,
  round: [0.18, 0.095],
  press: [0, 0.6, 0.15],
  gait: { duty: [0.62, 0.42], swing: [0.5, 0.45], step: 0.45, bob: 0.06, roll: 9, sway: 0.08 },
  size: 4.8,
};

/** A Fromageon: large and portly, a patterned cap, a scarf, a green cape with a cheese on it, a gold rope belt, a long apron. */
const FROMAGEON_LOOK: Mus = {
  stage: 2,
  leg: { at: [0.36, 0.04, -0.26], len: [0.15, 0.14, 0.055], w: [0.21, 0.13], foot: [0.46, 0.18], stance: 0.41, ahead: 0.24 },
  high: 0.5,
  hips: { c: [0, 0.04, 0.1], r: [0.9, 0.66, 0.52] },
  chest: { at: [0, 0, 0.18], lean: 3 },
  torso: { z: [-0.16, 0.16, 0.36, 0.48], y: [0.03, 0.07, 0.04, 0], w: [0.68, 0.58, 0.44, 0.3], h: [0.6, 0.52, 0.4, 0.28] },
  shoulder: [0.27, 0.3, 0.3],
  arm: [0.27, 0.26], armW: [0.11, 0.1], hand: 0.125,
  paw: [0.13, 0.6, 0.26],
  neck: { at: [0, 0.03, 0.46], len: 0.05, w: 0.27 },
  head: { r: [0.55, 0.5, 0.44], up: 0.33, pitch: 20 },
  snout: { at: [0, 0.72, -0.08], r: [0.54, 0.5, 0.44] },
  eye: { dir: [0.42, 0.72, 0.5], size: 0.105 },
  ear: { len: 0.7, w: 0.39, dir: [0.68, -0.44, 0.68] },
  tail: { at: [0, -0.64, -0.26], len: 1.5, w: 0.095 },
  collar: { count: 0, len: 0, rows: 0 },
  apron: { top: 0.42, bottom: -0.44, spread: 1.15, border: true, bow: 0, flare: 0.08 },
  cap: { puff: 1.1, pattern: true },
  robe: true,
  round: [0.23, 0.125],
  press: [0, 0.83, 0.2],
  gait: { duty: [0.64, 0.44], swing: [0.45, 0.4], step: 0.4, bob: 0.07, roll: 8, sway: 0.09 },
  size: 5.9,
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

/** An egg with its axes along a frame: anything round that leans or points. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
}
const UPRIGHT: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Each face's material chosen from where its middle is. */
function painted(m: Mesh, f: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((face) => {
    const c = scale(face.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    return { ...face, m: f(c) };
  }));
}

/** Where the egg `(c, r)` is cut by the level `z`: its half across and half deep there. */
function eggAt(c: V3, r: V3, z: number, least = 0.04): [number, number] {
  const f = Math.sqrt(Math.max(least, 1 - ((z - c[2]) / r[2]) ** 2));
  return [r[0] * f, r[1] * f];
}

/** The torso's ring at height `z` in the chest's frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Mus, z: number): { w: number; h: number; y: number } {
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
function onBody(s: Mus, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z), hc = sub(s.hips.c, s.chest.at), [hx, hy] = eggAt(hc, s.hips.r, z);
  const tp: V3 = [Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z];
  const hp: V3 = [Math.cos(a) * hx, hc[1] + Math.sin(a) * hy, z];
  const p = z < s.torso.z[0] || len3([hp[0], hp[1], 0]) > len3([tp[0], tp[1], 0]) ? hp : tp;
  const d = unit([Math.cos(a), Math.sin(a), 0]);
  return add(p, scale(d, out));
}

/** The way out of a face of the egg `(c, r)` at the point `p`, scaled to the egg: (-1..1) on each axis. */
const onEggDir = (c: V3, r: V3, p: V3): V3 => [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];

/** Whether a point on the body (its way out of the belly egg, scaled) is the cream of its front, with a soft wavy edge. */
const creamAt = (d: V3): boolean => d[1] > 0.42 - 0.12 * Math.sin(d[2] * 7) - 0.3 * Math.max(0, -d[2]);

/**
 * A sheet of cloth, both sides: rows of points from its top edge to its bottom, each row across it. Its outer side in `out`, its
 * inner in `inner`, each face its own material if `out` is a function of the row and the column.
 */
function sheet(rows: V3[][], out: Mat | ((r: number, c: number) => Mat), inner: Mat): Mesh {
  const v: V3[] = [], f: Face[] = [];
  const W = rows[0].length;
  for (const row of rows) v.push(...row);
  const m = (r: number, c: number): Mat => (typeof out === 'function' ? out(r, c) : out);
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < W - 1; c++) {
      const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
      // Seen from outside -- with the row running round to the left and the rows going down -- anticlockwise is a, d, e, b.
      f.push({ i: [a, d, e, b], m: m(r, c) });
      f.push({ i: [a, b, e, d], m: inner });
    }
  }
  return mesh(v, f);
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: both paws shoved into the blow. */
export const MUS_HITS: readonly number[] = [0.5, 0.52, 0.55];
/** A go at its task, as shares of it: each squeeze of the round of curd between its paws, the whey running out of it. */
export const MUS_WORK = { squeezes: [0.3, 0.64] as const } as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** A pose: where each ankle is and how its foot is pitched, how the body and the chest are carried, and where its paws are. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left, past how it is carried. */
  chest: V3;
  /** The neck bent forward and turned left; the head nose-up, turned left and tilted, against level. */
  neck: number[]; head: V3;
  /** Where each paw is, left then right, in the chest's frame. */
  hand: V3[];
  /** How much of the round of curd is in its paws, and how far it is squeezed. */
  held: number; press: number;
  /** The tail lifted and swung to the left. */
  tail: number[];
  /** Its ears pricked back and up. */
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

const rests = new Map<Mus, Rest>();
function restOf(s: Mus): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3);
  const R: Rest = { ankle, reach: L.len[0] + L.len[1] };
  rests.set(s, R);
  return R;
}

/** The paws at rest: clasped at its chest. */
const pawRest = (s: Mus): V3[] => [[-s.paw[0], s.paw[1], s.paw[2]], [...s.paw]];

function restPlan(s: Mus, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0],
    hand: pawRest(s), held: 0, press: 0, tail: [0, 0], ears: 0,
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
 * Going: a waddle, up on its hind feet. Each foot down for its share of a stride and swept back under it at the ground's own
 * speed, then lifted and brought forward; the whole body rolled over onto the foot that is down and swayed after it, sinking
 * onto each foot as it lands; the head held steadier than the body; the paws kept at the chest, swinging a little; the tail
 * swinging after it.
 */
function goingPlan(s: Mus, R: Rest, a: Anim): Plan {
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
    p.foot[i] = -18 * Math.sin(Math.PI * clamp(u * 1.6)) * (1 - u) + 8 * hump(u, 0.85, 0.15);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.08));
  p.H += -G.bob * L * 2.4 * (down - 0.5) * (1 - 0.5 * g) + g * L * (0.12 * Math.max(0, Math.sin(2 * TAU * (w - duty * 0.5 + 0.25))) - 0.05);
  const over = Math.sin(TAU * (w - 0.2));
  p.roll = G.roll * over;
  p.side = -G.sway * L * 2 * over * (1 - 0.5 * g);
  p.yaw = 7 * Math.cos(TAU * w) * (1 - 0.3 * g);
  p.chest = [3 + 10 * g + 2 * (down - 0.5), -p.yaw * 0.8, -p.roll * 0.35];
  p.pitch = -2 - 6 * g;
  p.head = [4 * (down - 0.5) + 2 + 4 * g, -p.yaw * 0.3 - p.chest[1] * 0.5, -p.roll * 0.7];
  p.tail = [6 * (down - 0.5) + 10 * g, -p.yaw * 2 - 22 * Math.sin(TAU * (w - 0.1))];
  const sw = Math.sin(TAU * (w - 0.05));
  p.hand = p.hand.map((h, i) => add(h, [0, 0.08 * L * sw * (i ? 1 : -1), 0.05 * L * g])) as V3[];
  p.ears = 0.3 * g;
  return p;
}

/** How far its head is turned to its right standing about (degrees), toward the viewer at the island's usual facing. */
const FACE_TURN = 26;

/** Standing about: breathing, the weight shifting from foot to foot, looking about with its nose working; now and then a laugh, its paws clapped together. */
function stillPlan(s: Mus, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  const w = Math.tanh(2.5 * cyc(t, 3));
  p.chest = [1.5 * (a.breath - 0.5), 8 * look * 0.3, 1.5 * w];
  p.roll = -2 * w;
  p.side = 0.03 * s.leg.len[0] * w;
  p.neck = [0, -FACE_TURN * 0.4 + 5 * look];
  p.head = [3 * cyc(t, 4) + 2 * Math.sin(t * 11) * beat(t, [1.2, 9.4, 15.6], 0.6), -FACE_TURN * 0.6 + 5 * look, 5 * drift(t, 3)];
  p.H += 0.012 * R.reach * (a.breath - 0.5);
  p.tail = [3 * cyc(t, 3, 1), 14 * cyc(t, 4)];
  // A laugh: the head tipped back and bobbing, the paws clapped together at its chest.
  const laugh = beat(t, [6.0, 18.5], 1.4);
  if (laugh > 0) {
    p.head[0] += 8 * laugh + 3 * laugh * Math.sin(t * TAU * 3);
    p.chest[0] -= 3 * laugh;
    const clap = Math.abs(Math.sin(t * TAU * 2.2));
    p.hand = p.hand.map((h, i) => add(h, [(i ? 1 : -1) * s.hand * 0.9 * clap * laugh, 0.02 * laugh, 0.02 * laugh])) as V3[];
  }
  p.ears = beat(t, [3.1, 14.2, 20.4], 0.5);
  return p;
}

/* ---- its strike ---------------------------------------------------------------------- */

/** A strike: it twists away, rocked back, the paws drawn in, then swings round and shoves both paws into what is in front of it; a step into it, a bounce, and back. */
function strikePlan(s: Mus, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = MUS_HITS[s.stage], L = R.reach;
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.02, 0.07);
  const yaw = 30 * wind - 10 * blow;
  p.yaw = yaw * 0.35;
  p.chest = [-10 * wind + 20 * blow, yaw * 0.65, 5 * wind - 4 * blow];
  p.neck = [4 * blow, 0];
  p.head = [8 * wind - 12 * blow - 6 * jolt, yaw * 0.4, -8 * blow];
  p.H += L * (0.06 * wind - 0.08 * blow);
  p.surge = L * 0.3 * blow;
  p.squash = 0.05 * jolt;
  // Paws drawn back to the chest as it winds, shoved out forward at the blow.
  const top = s.torso.z[s.torso.z.length - 1];
  p.hand = p.hand.map((h, i) => {
    const back = add(h, [(i ? 1 : -1) * s.hand * 0.6, -s.paw[1] * 0.35, -0.05 * L]);
    const out: V3 = [(i ? 1 : -1) * s.shoulder[0] * 0.7, s.paw[1] + (s.arm[0] + s.arm[1]) * 0.85, top * 0.75];
    return mixV(mixV(h, back, wind), out, blow);
  }) as V3[];
  const step = ramp(t, 0.34, hit - 0.02) * (1 - ramp(t, hit + 0.2, 0.92));
  const A = R.ankle[0];
  p.at[0] = mixV(A, [A[0], A[1] + L * 0.5, A[2]], step);
  p.at[0][2] += L * 0.3 * (hump(t, (0.34 + hit) / 2, (hit - 0.34) / 2) + hump(t, (hit + 0.2 + 0.92) / 2, (0.92 - hit - 0.2) / 2));
  p.tail = [14 * wind - 10 * blow, -20 * wind + 24 * blow];
  p.ears = wind;
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/**
 * A go at its task: a round of curd held up between its paws at its chest and squeezed, twice, the paws pressing in on its flat
 * faces and the round squashed between them, its head bobbing with each squeeze and the whey running out of it (`MUS_WORK`).
 */
function workPlan(s: Mus, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), W = MUS_WORK, L = R.reach;
  const press = Math.max(...W.squeezes.map((c) => hump(t, c, 0.13)));
  const [rr, th] = s.round, mid = roundAt(s);
  // Both paws on top of the round, pressing down on it.
  const top = th * 0.5 * (1 - 0.3 * press) + s.hand * 0.75;
  p.hand = [add(mid, [-rr * 0.72, -rr * 0.3, top]), add(mid, [rr * 0.72, -rr * 0.3, top])];
  p.held = 1;
  p.press = press;
  p.chest = [5 + 6 * press, 0, 0];
  p.neck = [4 * press, 0];
  p.head = [-6 * press, 4 * Math.sin(t * TAU), 3 * Math.sin(t * TAU * 2)];
  p.H -= 0.04 * L * press;
  p.ears = press;
  p.tail = [6 * press, 12 * Math.sin(t * TAU)];
  return mixPlan(restPlan(s, R), p, down);
}

/** Where the round of curd is held, in the chest's frame: out in front of its belly, flat side up, under its paws. */
const roundAt = (s: Mus): V3 => s.press;

/** Eating where it stands: both paws at its mouth, nibbling fast. */
function grazePlan(s: Mus, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const nib = Math.sin(t * TAU * 3);
  const z = s.neck.at[2] + s.neck.len + s.head.up - s.head.r[2] * 0.55;
  const at: V3 = [0, s.neck.at[1] + s.head.r[1] * 0.9, z + 0.02 * nib];
  p.hand = [add(at, [-s.hand * 1.1, 0, 0]), add(at, [s.hand * 1.1, 0, 0])];
  p.chest = [8, 0, 0];
  p.neck = [8, 0];
  p.head = [-14 + 3 * nib, 6 * drift(t, 2), 0];
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its paws up, a shake, and settled. */
function evolvePlan(s: Mus, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach;
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * (s.stage === 2 ? 44 : 62));
  p.H += L * (-0.12 * hunch + 0.12 * up);
  p.chest = [14 * hunch - 8 * up, 0, 0];
  p.neck = [8 * hunch - 6 * up, 0];
  p.head = [-12 * hunch + 16 * up, 0, 12 * shake];
  p.roll = 3 * shake;
  p.squash = 0.05 * hump(t, 0.72, 0.05);
  const top = s.torso.z[s.torso.z.length - 1];
  p.hand = p.hand.map((h, i) => mixV(h, [(i ? 1 : -1) * s.shoulder[0] * 1.3, s.paw[1] * 0.6, top + s.arm[0] * 0.8], up)) as V3[];
  p.tail = [-8 * hunch + 18 * up, 12 * shake];
  p.ears = up;
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Mus, R: Rest, a: Anim): Plan {
  const act = a.act;
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

/** A leg bent to put its ankle at `ankle`: the knee forward and a little out; the foot flat, turned a little out. */
function legOf(s: Mus, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.3, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.25 * fwd[1], fwd[1] - sd * 0.25 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The middle of the skull in the head's frame. */
const skullAt = (s: Mus): V3 => [0, 0.02, s.head.up];

/**
 * The bones of a stage: its pose, the hips raised and carried as it says, the chest on them, the neck and head, each leg bent to
 * put its foot where it is to be, each arm bent to put its paw where it is to be, the round of curd between its paws, its ears
 * and its tail.
 */
function musBones(s: Mus): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.chest.lean + P.chest[0];
    b.chest = joint(body, s.chest.at, -lean, P.chest[2], P.chest[1]);
    b.neck = joint(b.chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    // The head carried level whatever the hips and the chest do under it, then pitched nose-up as the stage carries it.
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + P.neck[0] - P.pitch - s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    // Each ear on a bone of its own at its root, laid back and up as the pose pricks it.
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, e = onEgg(skullAt(s), s.head.r, [sd * s.ear.dir[0], s.ear.dir[1], s.ear.dir[2]]);
      b[`ear${i}`] = joint(b.head, e.p, -8 * P.ears, sd * 6 * P.ears, 0);
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
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, wr === el ? sh : el);
      b[`hand${i}`] = xfOf(X1, Y1, Z1, wr);
    }
    // The round of curd under its paws, flat side up; grown from nothing as it is taken up, squashed as it is pressed.
    {
      const m = place(b.chest, roundAt(s)), X = turn(b.chest, [1, 0, 0]), Y = turn(b.chest, [0, 1, 0]), Z = turn(b.chest, [0, 0, 1]);
      const k = Math.max(0.001, P.held), sq = 1 - 0.3 * P.press, bulge = 1 + 0.12 * P.press;
      b.round = { m: xfOf(scale(X, k * bulge), scale(Y, k * bulge), scale(Z, k * sq), m).m, t: m };
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
/** A shape of points round `(0, 0)` laid onto the egg `(C, R)` about the way `dir`: `u` across it, `v` up it, each scaled by `k`. */
function shapeOn(C: V3, R: V3, dir: V3, pts: Array<[number, number]>, k: number, mat: Mat, lift = 0.012, up: V3 = [0, 0, 1]): Disc {
  const e = onEgg(C, R, dir), n = e.n;
  const across = unit(cross(up, n)), upOn = unit(cross(n, across));
  const v = pts.map(([u, w]) => {
    const p = add(e.p, add(scale(across, u * k), scale(upOn, w * k)));
    const q = onEgg(C, R, sub(p, C));
    return add(q.p, scale(q.n, lift));
  });
  return facing({ v, m: mat, at: add(e.p, scale(n, -0.02)) }, n);
}
/** A painted shape wound to face out along `n`, whichever way round its corners were given. */
function facing(d: Disc, n: V3): Disc {
  let x = 0, y = 0, z = 0;
  for (let q = 0; q < d.v.length; q++) {
    const a = d.v[q], b = d.v[(q + 1) % d.v.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return x * n[0] + y * n[1] + z * n[2] < 0 ? { ...d, v: [...d.v].reverse() } : d;
}

/** A tuft or a leaf: a soft flattened lobe from `root` out to `tip`, its flat side facing `face`, sagging `bend` in the middle. */
const lobe = (root: V3, tip: V3, r: number, face: V3, mat: Mat, bend = 0): Mesh => {
  const mid = add(mixV(root, tip, 0.5), [0, 0, bend]);
  return tube([root, mid, tip], [r * 0.7, r, 0], [r * 0.35, r * 0.45, 0], 5, mat, { up: face });
};

/** The muzzle's middle and half-sizes in the head's frame. */
function snoutOf(s: Mus): { c: V3; r: V3 } {
  const C = skullAt(s), R = s.head.r, S = s.snout;
  return { c: add(C, [S.at[0] * R[0], S.at[1] * R[1], S.at[2] * R[2]]), r: [S.r[0] * R[0], S.r[1] * R[1], S.r[2] * R[2]] };
}

/**
 * The head: a round skull, brown over the crown and down the back, cream round the cheeks and under; a cream muzzle pushed
 * forward, a pink nose on its tip, its mouth wide open in a laugh under it, the pink of its tongue and two small front teeth;
 * a rosy blush on each cheek; its eyes shut tight in two arcs; whiskers apart (`whiskersOf`).
 */
function headOf(s: Mus, n: number, k: number): Mesh {
  const H = s.head, C = skullAt(s), R = H.r, E = s.eye;
  const eyeZ = onEgg(C, R, E.dir).p[2] - C[2];
  const skull = painted(orb(C, R, n + 12, k + 8, 'coat'), (c) => {
    const d = onEggDir(C, R, c);
    // Cream from a little under the eyes down, round the front and the cheeks, and under the chin; brown over the crown and the back.
    return d[1] > -0.05 && c[2] - C[2] < eyeZ - E.size * 1.4 - R[2] * 0.35 * Math.max(0, 0.5 - d[1]) ? 'mark' : 'coat';
  });
  const S = snoutOf(s);
  const muzzle = painted(orb(S.c, S.r, n, k + 1, 'muzzle'), (c) => {
    const d = onEggDir(S.c, S.r, c);
    return d[2] > 0.55 && d[1] < 0.6 ? 'coatLight' : 'muzzle';
  });
  // The nose: a small pink ball on the tip of the muzzle, a little up.
  const nose = orb(add(S.c, [0, S.r[1] * 0.95, S.r[2] * 0.3]), [R[0] * 0.085, R[0] * 0.065, R[0] * 0.065], 6, 3, 'nose');
  // The mouth, open: a dark D under the nose, its round side down, the tongue in the bottom of it and two teeth under the top lip.
  const out: Disc[] = [];
  const mDir: V3 = [0, 0.9, -0.36], mw = S.r[0] * 0.78;
  const D: Array<[number, number]> = [];
  for (let q = 0; q <= 12; q++) { const a = Math.PI + (q / 12) * Math.PI; D.push([Math.cos(a) * 1, Math.sin(a) * 1.05 + 0.32]); }
  D.push([0.9, 0.42], [0.5, 0.5], [0, 0.42], [-0.5, 0.5], [-0.9, 0.42]);
  out.push(shapeOn(S.c, S.r, mDir, D, mw, 'lip', 0.012));
  const T: Array<[number, number]> = [];
  for (let q = 0; q <= 10; q++) { const a = Math.PI + (q / 10) * Math.PI; T.push([Math.cos(a) * 0.62, Math.sin(a) * 0.55 - 0.2]); }
  T.push([0.5, -0.05], [0, 0.05], [-0.5, -0.05]);
  out.push(shapeOn(S.c, S.r, mDir, T, mw, 'tongue', 0.02));
  for (const sd of [1, -1]) out.push(shapeOn(S.c, S.r, mDir, [[sd * 0.05, 0.4], [sd * 0.38, 0.42], [sd * 0.34, 0.12], [sd * 0.08, 0.14]].map(([u, w]) => [u, w] as [number, number]), mw, 'tooth', 0.024));
  // Blush on each cheek, out under the eye.
  for (const sd of [1, -1]) out.push(patchOn(C, R, [sd * (E.dir[0] + 0.3), E.dir[1] - 0.1, E.dir[2] - 0.38], E.size * 1.15, E.size * 0.7, 'inner', sd * 0.25, 0.03, 10));
  // The eyes, shut tight in a laugh: each a thick arc bowed up.
  for (const sd of [1, -1]) {
    const arc: Array<[number, number]> = [];
    for (let q = 0; q <= 8; q++) { const u = -1 + q / 4; arc.push([u, Math.cos((u * Math.PI) / 2) * 0.55 + 0.16]); }
    for (let q = 8; q >= 0; q--) { const u = -1 + q / 4; arc.push([u * 0.86, Math.cos((u * Math.PI) / 2) * 0.55 - 0.16]); }
    out.push(shapeOn(C, R, [sd * E.dir[0], E.dir[1], E.dir[2]], arc, E.size, 'lid', 0.03));
  }
  return merge(skull, muzzle, nose, paint(out));
}

/** The whiskers: three a side out of the muzzle, thin, fanned back and a little down; in the head's frame. */
function whiskersOf(s: Mus): Mesh {
  const S = snoutOf(s), out: Mesh[] = [], L = s.head.r[0] * 0.95;
  for (const sd of [1, -1]) {
    for (let q = 0; q < 2; q++) {
      const root = add(S.c, [sd * S.r[0] * 0.78, S.r[1] * 0.4, S.r[2] * (0.2 - q * 0.26)]);
      const dir = unit([sd * 1, -0.1 + q * 0.12, 0.2 - q * 0.3]);
      const tip = add(root, scale(dir, L * (0.8 - q * 0.1)));
      out.push(taper([root, add(mixV(root, tip, 0.5), [0, 0, 0.01]), tip], 0.006, 0.0015, 3, 'membrane'));
    }
  }
  return merge(...out);
}

/** An ear: a big round flap, pink, a paler rim, the deeper pink of its hollow, cupped forward; in its own bone's frame. */
function earOf(s: Mus, sd: number, n: number): Mesh {
  const E = s.ear;
  // Up and out, its hollow turned toward the front and well out.
  const up = unit([sd * 0.75, -0.15, 1]), want: V3 = [sd * 0.9, 1, 0.1], face = unit(sub(want, scale(up, dot(want, up))));
  const f: [V3, V3, V3] = [cross(face, up), face, up];
  const h = E.len / 2, mid = scale(up, h * 0.8);
  // A round flap, thin: its back pale pink, its hollow the deeper pink.
  const deep = E.w * 0.14 + 0.006;
  const flap = egg(mid, f, [E.w, deep, h], n + 4, 6, 'membrane');
  // The hollow, painted on the front of the flap over its curve.
  const X = f[0], rim: V3[] = [];
  for (let q = 0; q < 16; q++) {
    const t = (q / 16) * TAU, u = Math.cos(t) * 0.74, w = Math.sin(t) * 0.76 + 0.04;
    rim.push(add(mid, add(add(scale(X, u * E.w), scale(up, w * h)), scale(face, deep * Math.sqrt(Math.max(0, 1 - u * u - w * w)) + 0.003))));
  }
  const hollow = paint([facing({ v: rim, m: 'inner', at: mid }, face)]);
  return merge(flap, hollow);
}

/** The collar of green leaves round its neck and over its shoulders, each pointing out and down; in the chest's frame. */
function collarOf(s: Mus): Mesh {
  const C = s.collar, out: Mesh[] = [];
  const zt = s.torso.z[s.torso.z.length - 1];
  for (let row = 0; row < C.rows; row++) {
    const z = zt - 0.03 - row * C.len * 0.42, count = C.count + row * 3;
    for (let q = 0; q < count; q++) {
      const a = (q / count) * TAU + row * 0.27 + Math.PI / 2 + 0.11;
      const root = onBody(s, z, a, -0.015);
      const o = unit([Math.cos(a), Math.sin(a), 0]);
      const L = C.len * (0.85 + 0.3 * jitter(q + row * 31)) * (1 + 0.15 * row);
      const tip = add(add(root, scale(o, L * 0.9)), [0, 0, -L * (0.28 + 0.15 * row)]);
      out.push(lobe(root, tip, L * 0.42, unit(add(o, [0, 0, 0.7])), (q + row) % 3 === 1 ? 'leafDark' : 'leaf', L * 0.08));
    }
  }
  return merge(...out);
}

/** A gold sprig of leaves along a line on a surface: a stem and leaves either side, from `a` to `b`, in a plane facing `n`. */
function sprig(a: V3, b: V3, n: V3, size: number, mat: Mat): Disc[] {
  const out: Disc[] = [], pts = [0, 0.33, 0.66, 1].map((u) => mixV(a, b, u));
  for (let q = 0; q < pts.length - 1; q++) {
    const d = unit(sub(pts[q + 1], pts[q])), side = scale(unit(cross(n, d)), size * 0.06);
    out.push({ v: [sub(pts[q], side), add(pts[q], side), add(pts[q + 1], side), sub(pts[q + 1], side)], m: mat });
  }
  for (let q = 1; q < pts.length; q++) {
    const d = unit(sub(pts[q], pts[q - 1])), side = unit(cross(n, d)), r = size * 0.28;
    for (const sd of [1, -1]) {
      const dir = unit(add(scale(d, 0.7), scale(side, sd * 0.75)));
      out.push(disc(add(pts[q], scale(dir, r * 0.95)), n, r * 0.38, r, 6, mat, { up: dir }));
    }
  }
  return out;
}

/**
 * The apron, in the body's frame: a sheet of cream cloth over the front of the belly from its waistband to its hem, hanging
 * straight down past where the belly curves in and standing out a little at the hem; the waistband right round, and on the two
 * bigger ones a gold border of leaves along the hem; the Wheybit's and the Pressqueak's tied in a bow at the left side.
 */
function apronOf(s: Mus, n: number): Mesh {
  const A = s.apron, Hc = s.hips.c, Hr = s.hips.r, out: Mesh[] = [];
  const rows = 7, cols = n + 4;
  // How far out the cloth is at each height: on the belly where it is fullest above the equator, hanging from the fullest below it.
  const at = (z: number, a: number, lift: number): V3 => {
    const zz = Math.max(z, Hc[2]);
    const [hx, hy] = eggAt(Hc, Hr, zz, 0.2);
    const below = clamp((Hc[2] - z) / Math.max(0.01, Hc[2] - A.bottom));
    const f = 1 + (A.flare / Math.max(Hr[0], Hr[1])) * below * below + lift;
    return [Math.cos(a) * hx * f, Hc[1] + Math.sin(a) * hy * f, z];
  };
  const grid: V3[][] = [];
  for (let r = 0; r < rows; r++) {
    const u = r / (rows - 1), z = lerp(A.top, A.bottom, u), row: V3[] = [];
    // The cloth narrows a little to the waistband at the top.
    const spread = A.spread * (0.82 + 0.18 * u);
    for (let c = 0; c < cols; c++) row.push(at(z, Math.PI / 2 - spread + (2 * spread * c) / (cols - 1), 0.03));
    // Round to the left: column order runs from the right side round the front to the left.
    grid.push(row);
  }
  out.push(sheet(grid, 'cloth', 'clothDark'));
  // The waistband: across the top of the apron and round to the bow, tied off at the sides (from above, a band right round
  // a belly this round would show its back half over the chest).
  const band: V3[] = [], b0 = Math.PI / 2 - A.spread * 0.82 - 0.3, b1 = Math.PI / 2 + A.spread * 0.82 + 0.3;
  for (let q = 0; q <= 16; q++) band.push(at(A.top, lerp(b0, b1, q / 16), 0.035));
  out.push(tube(band, 0.012 + s.stage * 0.003, 0.024 + s.stage * 0.008, 4, 'cloth', { start: false, end: false }));
  // The gold border: a band along the hem and sprigs of leaves above it.
  if (A.border) {
    const decals: Disc[] = [];
    const zB = A.bottom + 0.03 + s.stage * 0.01;
    const C = 9 + 3 * s.stage;
    for (let q = 0; q < C; q++) {
      const u0 = q / C, u1 = (q + 1) / C;
      const a0 = Math.PI / 2 - A.spread + 2 * A.spread * u0, a1 = Math.PI / 2 - A.spread + 2 * A.spread * u1;
      const p0 = at(zB, a0, 0.05), p1 = at(zB, a1, 0.05), q0 = at(zB - 0.02, a0, 0.05), q1 = at(zB - 0.02, a1, 0.05);
      decals.push(facing({ v: [q0, q1, p1, p0], m: 'trim' }, unit([Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0])));
      const nrm = unit([Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]);
      const mid = at(zB + 0.06 + 0.02 * s.stage, (a0 + a1) / 2, 0.05);
      const dir = unit(cross(nrm, [0, 0, 1]));
      decals.push(...sprig(add(mid, scale(dir, -0.04 - 0.01 * s.stage)), add(mid, scale(dir, 0.04 + 0.01 * s.stage)), nrm, 0.06 + 0.02 * s.stage, 'trim'));
    }
    out.push(paint(decals));
  }
  // The bow at the left side, a little forward: two loops, a knot and two tails.
  if (A.bow > 0) {
    const a = Math.PI / 2 - A.spread * 1.05, p = at(A.top, a, 0.08), o = unit([Math.cos(a), Math.sin(a), 0]);
    const along = unit(cross([0, 0, 1], o)), B = A.bow;
    for (const sd of [1, -1]) {
      const tip = add(add(p, scale(along, sd * B * 1.1)), [0, 0, B * 0.35]);
      out.push(lobe(p, tip, B * 0.5, o, 'cloth', B * 0.1));
      const tail = add(add(p, scale(along, sd * B * 0.55)), [0, 0, -B * 1.25]);
      out.push(lobe(p, add(tail, scale(o, B * 0.15)), B * 0.3, o, 'clothDark'));
    }
    out.push(orb(add(p, scale(o, B * 0.12)), B * 0.3, 6, 4, 'cloth'));
  }
  return merge(...out);
}

/**
 * The mob cap, in the head's frame: a puffed cream crown over the top and back of the skull, a yellow band round it, and a
 * frilled brim under the band, each frill a soft round lobe edged in yellow; on the Fromageon patterned cream and gold.
 */
function capOf(s: Mus, n: number, k: number): Mesh {
  const C = skullAt(s), R = s.head.r, P = s.cap!, out: Mesh[] = [];
  // Over the top and a little back: the crown's middle above the skull's, puffed.
  const cc: V3 = add(C, [0, -R[1] * 0.16, R[2] * 0.62]), cr: V3 = [R[0] * 0.9 * P.puff, R[1] * 0.86 * P.puff, R[2] * 0.6 * P.puff];
  const crown = orb(cc, cr, n + (P.pattern ? 10 : 4), k + (P.pattern ? 6 : 2), 'cap');
  out.push(P.pattern ? painted(crown, (c) => {
    const d = onEggDir(cc, cr, c);
    return Math.sin(d[0] * 9 + Math.sin(d[1] * 7) * 1.4) * Math.sin(d[1] * 9 + d[2] * 6) > 0.55 ? 'fitting' : 'cap';
  }) : crown);
  // The band and the frill round its rim, tilted to follow the skull: lower at the back than at the front.
  const ring = (a: number, up: number, out0: number): V3 => {
    const d: V3 = [Math.cos(a), Math.sin(a), 0.86 + 0.3 * Math.sin(a) + up];
    const e = onEgg(C, R, d);
    return add(e.p, scale(e.n, out0));
  };
  const band: V3[] = [];
  for (let q = 0; q <= 28; q++) band.push(ring((q / 28) * TAU, 0.06, R[0] * 0.05));
  out.push(tube(band, R[0] * 0.07, R[0] * 0.035, 4, 'trim', { start: false, end: false }));
  const N = 20 + 4 * s.stage;
  for (let q = 0; q < N; q++) {
    const a = (q / N) * TAU;
    const root = ring(a, -0.04, R[0] * 0.04), e = unit(sub(root, add(C, [0, 0, R[2] * 0.2])));
    const tip = add(root, add(scale(e, R[0] * 0.17), [0, 0, -R[0] * 0.07]));
    out.push(lobe(root, tip, R[0] * 0.14, unit(add(e, [0, 0, 0.8])), q % 2 ? 'lining' : 'cap'));
  }
  return merge(...out);
}

/**
 * The Fromageon's cape, in the chest's frame: a green mantle from its shoulders round its back to the backs of its knees, open
 * at the front, flaring out over the belly; a lighter lining; a gold hem with leaves embroidered along it, and on its left
 * front a yellow cheese wedge with its holes.
 */
function capeOf(s: Mus, n: number): Mesh {
  const out: Mesh[] = [];
  const zt = s.torso.z[s.torso.z.length - 1], hc = sub(s.hips.c, s.chest.at);
  const zb = hc[2] - s.hips.r[2] * 0.4;
  const rows = 8, cols = n + 8;
  // Round from the front of the right shoulder, the long way round the back, to the front of the left.
  const angles = Array.from({ length: cols }, (_, c) => lerp(Math.PI / 2 + 0.45, Math.PI / 2 + 0.45 + (TAU - 0.9), c / (cols - 1)));
  const grid: V3[][] = [];
  // The widest the body is at or above each height, round each way: the cape hangs from the shoulders and never comes in under that.
  const most = new Array<number>(cols).fill(0);
  // Over the shoulders: wide enough across to cover the tops of the arms, which come out from under its front edges.
  const shX = s.shoulder[0] + s.armW[0] * 1.6, shY = torsoAt(s, s.shoulder[2]).h + 0.04, zs = s.shoulder[2];
  const ellipse = (a: number, rx: number, ry: number): number => 1 / Math.hypot(Math.cos(a) / rx, Math.sin(a) / ry);
  // Its collar close round the neck, then down over the shoulders and out over the belly.
  const zs0 = zt + 0.04;
  for (let r = 0; r < rows; r++) {
    const u = r / (rows - 1), z = r === 0 ? zs0 : lerp(zs + s.armW[0], zb, (r - 1) / (rows - 2)), row: V3[] = [];
    for (let c = 0; c < cols; c++) {
      const a = angles[c];
      let R0: number;
      if (r === 0) R0 = ellipse(a, s.neck.w * 1.25, s.neck.w * 1.2);
      else {
        const p = onBody(s, z, a, 0);
        const rad = Math.max(Math.hypot(p[0], p[1]), z > zs - s.armW[0] * 2 ? ellipse(a, shX, shY) : 0);
        most[c] = Math.max(most[c], rad);
        R0 = most[c] + 0.05 + 0.06 * u;
      }
      row.push([Math.cos(a) * R0, Math.sin(a) * R0, z]);
    }
    grid.push(row);
  }
  // Angles run anticlockwise seen from above (right, front, left, back): the outside of the sheet faces out.
  out.push(sheet(grid, 'tunic', 'lining'));
  // The gold hem, and leaves above it; the cheese on the left front.
  const decals: Disc[] = [];
  const last = grid[rows - 1], prev = grid[rows - 2];
  for (let c = 0; c < cols - 1; c++) {
    const nrm = unit([last[c][0] + last[c + 1][0], last[c][1] + last[c + 1][1], 0]);
    const lift = scale(nrm, 0.012);
    const up0 = mixV(last[c], prev[c], 0.22), up1 = mixV(last[c + 1], prev[c + 1], 0.22);
    decals.push(facing({ v: [add(last[c], lift), add(last[c + 1], lift), add(up1, lift), add(up0, lift)], m: 'fitting' }, nrm));
    if (c % 2 === 0) {
      const m0 = mixV(last[c], prev[c], 0.6), m1 = mixV(last[c + 1], prev[c + 1], 0.6);
      decals.push(...sprig(add(m0, lift), add(m1, lift), nrm, 0.11, 'fitting'));
    }
  }
  // The cheese: a wedge, its rind along the top, three holes; on the left front of the cape at the height of the chest.
  {
    const c = cols - 4, r = 2, p = mixV(grid[r][c], grid[r + 1][c + 1], 0.5), nrm = unit([p[0], p[1], 0]);
    const across = unit(cross([0, 0, 1], nrm)), up: V3 = [0, 0, 1], k = 0.13;
    const at = (u: number, v: number): V3 => add(add(add(p, scale(nrm, 0.016)), scale(across, u * k)), scale(up, v * k));
    decals.push(facing({ v: [at(-0.9, 0.5), at(0.9, 0.5), at(-0.6, -0.65)], m: 'bloom' }, nrm));
    decals.push(facing({ v: [at(-0.9, 0.5), at(0.9, 0.5), at(0.85, 0.66), at(-0.9, 0.62)], m: 'billDark' }, nrm));
    for (const [u, v, rr] of [[-0.45, 0.2, 0.13], [0.2, 0.28, 0.1], [-0.5, -0.25, 0.08]] as Array<[number, number, number]>) {
      decals.push(disc(add(at(u, v), scale(nrm, 0.004)), nrm, rr * k, rr * k, 7, 'billDark'));
    }
  }
  out.push(paint(decals));
  return merge(...out);
}

/** The Fromageon's scarf: a puffed roll of patterned cream cloth round the base of its neck, over the top of the cape; in the chest's frame. */
function scarfOf(s: Mus, n: number): Mesh {
  const out: Mesh[] = [], zt = s.torso.z[s.torso.z.length - 1];
  const N = 14;
  for (let q = 0; q < N; q++) {
    const a = (q / N) * TAU + Math.PI / 2;
    const p = onBody(s, zt - 0.04, a, 0.09 + 0.04 * Math.sin(a));
    const r = s.neck.w * (0.62 + 0.08 * jitter(q + 5));
    out.push(orb(add(p, [0, 0, 0.02]), [r, r, r * 0.8], n, 4, q % 3 === 1 ? 'fitting' : 'cap'));
  }
  return merge(...out);
}

/** The Fromageon's rope belt, in the body's frame: a braided gold cord round its waist, knotted at the left front, two cords hanging from the knot, a tassel on each. */
function beltOf(s: Mus): Mesh {
  const out: Mesh[] = [], Hc = s.hips.c, Hr = s.hips.r, A = s.apron;
  const z = A.top - 0.02, [hx, hy] = eggAt(Hc, Hr, Math.max(z, Hc[2]), 0.2);
  const ring: V3[] = [];
  for (let q = 0; q <= 32; q++) { const a = (q / 32) * TAU; ring.push([Math.cos(a) * hx * 1.08, Hc[1] + Math.sin(a) * hy * 1.08, z]); }
  out.push(tube(ring, 0.05, 0.05, 5, (r) => (r % 2 ? 'fitting' : 'hornDark'), { start: false, end: false }));
  const a = Math.PI / 2 - 0.35, o = unit([Math.cos(a), Math.sin(a), 0]);
  const knot: V3 = [Math.cos(a) * hx * 1.12, Hc[1] + Math.sin(a) * hy * 1.12, z];
  out.push(orb(knot, [0.09, 0.075, 0.085], 7, 4, 'fitting'));
  for (const sd of [1, -1]) out.push(orb(add(knot, add(scale(unit(cross([0, 0, 1], o)), sd * 0.08), [0, 0, 0.01])), [0.05, 0.04, 0.045], 6, 4, 'hornDark'));
  for (const [dx, drop] of [[-0.05, 0.42], [0.05, 0.34]] as Array<[number, number]>) {
    const side = unit(cross([0, 0, 1], o));
    const top = add(add(knot, scale(side, dx)), scale(o, 0.03));
    const bot = add(add(top, [0, 0, -drop]), scale(o, 0.05));
    out.push(tube([top, mixV(top, bot, 0.5), bot], 0.018, 0.018, 4, (r) => (r % 2 ? 'fitting' : 'hornDark')));
    // The tassel: a cap and a fringe flaring down from it.
    out.push(orb(bot, [0.05, 0.05, 0.045], 6, 3, 'fitting'));
    out.push(tube([add(bot, [0, 0, -0.02]), add(bot, [0, 0, -0.12]), add(bot, [0, 0, -0.17])], [0.045, 0.062, 0.07], [0.045, 0.062, 0.07], 7, 'hornDark'));
  }
  return merge(...out);
}

/** The tail: long and pink and thin, back from its root, down near the ground and up behind it in a curl at the tip. */
function tailOf(s: Mus): Mesh {
  const T = s.tail, L = T.len;
  const pts: V3[] = [
    [0, 0, 0], [0.02 * L, -0.16 * L, -0.08 * L], [0.04 * L, -0.34 * L, -0.08 * L], [0.05 * L, -0.48 * L, 0.04 * L],
    [0.05 * L, -0.54 * L, 0.22 * L], [0.04 * L, -0.52 * L, 0.4 * L], [0.03 * L, -0.42 * L, 0.52 * L],
    [0.02 * L, -0.32 * L, 0.5 * L], [0.015 * L, -0.3 * L, 0.42 * L], [0.015 * L, -0.36 * L, 0.38 * L],
  ];
  const ws = pts.map((_, k) => lerp(T.w, T.w * 0.35, k / (pts.length - 1)));
  return tube(pts, ws, ws, 6, 'spot');
}

/** The round of curd it presses: a short drum, flat side up, a golden rind round it and a pale yellow top; in its own frame. */
function roundOf(s: Mus, n: number): Mesh {
  const [r, th] = s.round;
  return tube([[0, 0, -th * 0.5], [0, 0, -th * 0.42], [0, 0, th * 0.42], [0, 0, th * 0.5]], [r * 0.9, r, r, r * 0.9], [r * 0.9, r, r, r * 0.9], n + 4,
    (ring) => (ring === 1 ? 'bill' : 'bloom'), { up: [0, 1, 0] });
}

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Mus): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];

/** A stage's pieces. */
function musBuild(s: Mus, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), pieces: Piece[] = [];
  const hide = headSolids(s);
  const Hc = s.hips.c, Hr = s.hips.r;
  // What hides the far side of something wrapped round it: the belly, in the body's frame; the belly, the torso and the neck, in the chest's.
  const T = s.torso, zt = T.z[T.z.length - 1];
  const belly = [
    { c: Hc, r: scale(Hr, 0.95) },
    { c: add(s.chest.at, [0, T.y[1], (T.z[0] + zt) / 2]), r: [T.w[1] * 0.95, T.h[1] * 0.95, (zt - T.z[0]) / 2] as V3 },
  ];
  const trunk = [
    { c: sub(Hc, s.chest.at), r: scale(Hr, 0.95) },
    { c: [0, T.y[1], (T.z[0] + zt) / 2] as V3, r: [T.w[1] * 0.95, T.h[1] * 0.95, (zt - T.z[0]) / 2] as V3 },
    { c: [0, s.neck.at[1], zt] as V3, r: [s.neck.w * 1.05, s.neck.w * 1.05, s.head.r[2] * 0.6] as V3 },
  ];
  // The same, a little inside the skin, for the arms: a paw clasped against the chest is not behind it.
  const inside = trunk.map((t) => ({ c: t.c, r: scale(t.r, 0.86) }));
  pieces.push({ key: 'hips', mesh: painted(orb(Hc, Hr, n + 4, k + 2, 'coat'), (c) => (creamAt(onEggDir(Hc, Hr, c)) ? 'mark' : 'coat')), bone: 'trunk', bias: 0 });
  const legKeys = ['ll0', 'll1', 'll2', 'lr0', 'lr1', 'lr2'];
  pieces.push({ key: 'apron', mesh: apronOf(s, n), bone: 'trunk', bias: 0.012, after: ['hips', ...legKeys], front: [0, 1, 0], lines: false, hide: belly });
  pieces.push({
    key: 'torso', mesh: painted(tube(s.torso.z.map((z, q) => [0, s.torso.y[q], z] as V3), s.torso.w, s.torso.h, n + 2, 'coat', { up: [0, 1, 0] }), (c) => {
      const d = unit([c[0], c[1] - s.torso.y[0], 0]);
      return d[1] > 0.45 ? 'mark' : 'coat';
    }), bone: 'chest', bias: 0.01, after: 'hips', breathes: { c: [0, 0, s.torso.z[1]], k: 0.04 },
    // Drawn over the belly, so what of it is inside the belly is left out.
    hide: [{ c: sub(Hc, s.chest.at), r: scale(Hr, 0.97) }],
  });
  if (s.robe) {
    pieces.push({ key: 'belt', mesh: beltOf(s), bone: 'trunk', bias: 0.03, after: ['hips', 'apron', 'torso'], hide: belly });
    pieces.push({ key: 'cape', mesh: capeOf(s, n), bone: 'chest', bias: 0.02, after: ['torso', 'hips', 'apron', 'belt', ...legKeys], lines: false, hide: trunk });
    pieces.push({ key: 'scarf', mesh: scarfOf(s, n), bone: 'chest', bias: 0.04, after: ['torso', 'cape'], under: 'head', lines: false, hide: trunk });
  }
  if (s.collar.count) pieces.push({ key: 'collar', mesh: collarOf(s), bone: 'chest', bias: 0.03, after: ['torso'], under: 'head', lines: false, hide: trunk });
  const over = s.robe ? ['scarf', 'cape'] : s.collar.count ? ['collar'] : [];
  pieces.push({ key: 'neck', mesh: tube([[0, 0, -0.1], [0, 0, s.neck.len + 0.05]], s.neck.w, s.neck.w * 0.9, n, 'coat'), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'whiskers', mesh: whiskersOf(s), bone: 'head', bias: 0.205, after: 'head', rim: true, hide });
  if (s.cap) pieces.push({ key: 'cap', mesh: capOf(s, n, k), bone: 'head', bias: 0.21, after: 'head', lines: false, hide });
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1;
    pieces.push({ key: `ear${i}`, mesh: earOf(s, sd, n), bone: `ear${i}`, bias: 0.19, after: s.cap ? ['head', 'cap'] : 'head', lines: false, hide, hideIn: 'head' });
  }
  pieces.push({ key: 'tail', mesh: tailOf(s), bone: 'tail', bias: -0.1 });
  // Legs: a round furred haunch, a short shin, a long cream foot with its toes.
  const L = s.leg;
  for (const key of ['ll', 'lr']) {
    const front: V3 = [0, 1, 0];
    const thigh = merge(egg([0, 0, -L.len[0] * 0.3], UPRIGHT, [L.w[0] * 0.75, L.w[0] * 0.75, L.len[0] * 0.65], n, k, 'coat'), tube([[0, 0, 0], [0, 0, -L.len[0]]], [L.w[0], L.w[1]], [L.w[0], L.w[1]], n, 'coat', { seam: 'start' }));
    const shin = tube([[0, 0, L.w[1] * 0.5], [0, 0.005, -L.len[1]]], [L.w[1], L.w[1] * 0.85], [L.w[1], L.w[1] * 0.85], n, 'coat', { seam: 'start' });
    const fw = L.foot[1], fl = L.foot[0], drop = L.len[2];
    const foot = merge(
      egg([0, fl * 0.22, -drop + fw * 0.35], UPRIGHT, [fw * 0.8, fl * 0.58, fw * 0.42], n, k, 'pad'),
      ...[-1, -0.33, 0.33, 1].map((q) => egg([q * fw * 0.5, fl * 0.72, -drop + fw * 0.2], UPRIGHT, [fw * 0.2, fw * 0.26, fw * 0.18], 4, 3, 'pad')),
    );
    pieces.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, after: ['hips'], front },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['hips', `${key}0`], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.02, after: ['hips', `${key}1`], front },
    );
  }
  // Arms: a round furred upper arm, a forearm going cream toward the paw, a small white paw with its fingers.
  for (let i = 0; i < 2; i++) {
    const front: V3 = [0, 1, 0], ahead: V3 = [0, 0.5, -0.85];
    const upper = merge(
      egg([0, 0, -s.arm[0] * 0.35], UPRIGHT, [s.armW[0] * 1.12, s.armW[0] * 1.12, s.arm[0] * 0.6], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -s.arm[0]]], [s.armW[0] * 1.1, s.armW[1] * 1.1], [s.armW[0] * 1.1, s.armW[1] * 1.1], n, 'coat', { seam: 'start' }),
    );
    const fore = merge(
      egg([0, 0, 0], UPRIGHT, [s.armW[1] * 1.05, s.armW[1] * 1.05, s.armW[1] * 1.05], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -s.arm[1] + s.hand * 0.5]], [s.armW[1] * 1.05, s.armW[1] * 0.8], [s.armW[1] * 1.05, s.armW[1] * 0.8], n, (r) => (r === 0 ? 'coat' : 'mark'), { seam: 'both' }),
    );
    const h = s.hand;
    const paw = merge(
      egg([0, 0, -h * 0.2], UPRIGHT, [h * 1.0, h * 0.8, h * 1.0], n, k, 'pad'),
      ...[-0.6, -0.2, 0.2, 0.6].map((q) => egg([q * h * 0.9, h * 0.3, -h * 0.95], UPRIGHT, [h * 0.24, h * 0.24, h * 0.34], 4, 3, 'pad')),
    );
    pieces.push(
      { key: `arm${i}`, mesh: upper, bone: `arm${i}`, bias: 0.06, after: ['hips', 'torso', 'apron', ...over.filter((k) => k !== 'cape')], front, ...(s.robe ? { under: 'cape' } : {}), hide: inside, hideIn: 'chest' },
      { key: `fore${i}`, mesh: fore, bone: `elbow${i}`, bias: 0.065, after: ['hips', 'torso', 'apron', `arm${i}`, ...over], front: ahead, hide: inside, hideIn: 'chest' },
      { key: `hand${i}`, mesh: paw, bone: `hand${i}`, bias: 0.07, after: ['hips', 'torso', 'apron', `fore${i}`, ...over], front: ahead, hide: inside, hideIn: 'chest' },
    );
  }
  pieces.push({ key: 'round', mesh: roundOf(s, n), bone: 'round', bias: 0.068, after: ['torso', ...over, 'apron'], under: ['hand0', 'hand1'], shown: (a) => a.act?.kind === 'work' });
  return pieces;
}

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const WHEY: RGB = [232, 240, 226];
const CURD: RGB = [255, 238, 168];
const CREAM: RGB = [255, 250, 232];

/** A puff, growing and thinning over its life. */
function puffOf(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, c: RGB, k = 0.5): void {
  if (age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at), al = k * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.9 * age);
  const grad = g.createRadialGradient(x, y - rr * 0.2 * age, 0, x, y - rr * 0.2 * age, rr);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - rr, y - rr * 1.2, rr * 2, rr * 2);
}

/**
 * What a go at its task throws: whey squeezed out of the rim of the round at each squeeze, running down in drops to a pool on
 * the ground in front of it, drawn under everything.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Mus, b: Bones, a: Anim, t: number, front: boolean): void {
  const down = downOf(t, a.graze), mid = b.chest.t, r = s.round[0];
  if (down <= 0.05) return;
  const R = b.round, Y: V3 = unit([R.m[1], R.m[4], R.m[7]]);
  const bottom = add(R.t, [0, 0, -s.round[1] * 0.5]);
  const pool: V3 = [bottom[0] + Y[0] * r * 0.3, bottom[1] + Y[1] * r * 0.3, 0];
  g.save();
  if (!front) {
    const [x, y] = onScreen(view, pool), wet = down * clamp((t - MUS_WORK.squeezes[0] + 0.05) / 0.2 + 0.4);
    g.fillStyle = css(WHEY, 0.75 * wet);
    g.beginPath();
    g.ellipse(x, y, r * 1.1, r * 0.42, 0, 0, TAU);
    g.fill();
  }
  for (const c of MUS_WORK.squeezes) {
    // Whey spurting out round the rim as it is squeezed.
    for (let q = 0; q < 7; q++) {
      const u = (t - c + 0.06 - q * 0.012) / 0.32;
      if (u < 0 || u > 1) continue;
      const ang = jitter(q + c * 31) * TAU;
      const X: V3 = unit([R.m[0], R.m[3], R.m[6]]);
      const from = add(R.t, add(scale(Y, Math.sin(ang) * r), scale(X, Math.cos(ang) * r)));
      const fall = Math.max(0.05, from[2]);
      const outw = unit(sub(from, R.t));
      const p: V3 = add(from, [outw[0] * r * 0.5 * u, outw[1] * r * 0.5 * u, -fall * u * u]);
      if (p[2] < 0 || nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      g.fillStyle = css(WHEY, 0.95 * (1 - u * 0.3));
      g.beginPath();
      g.ellipse(x, y, r * 0.09, r * 0.13, 0, 0, TAU);
      g.fill();
    }
    if (front) puffOf(g, view, add(R.t, [0, 0, r * 0.2]), r * 0.9, (t - c + 0.02) / 0.3, CREAM, 0.35 * down);
  }
  // A steady drip from the bottom of the round between the squeezes.
  for (let q = 0; q < 3; q++) {
    const ph = frac(t * 2.4 + q / 3), fall = Math.max(0.05, bottom[2]);
    const p: V3 = [bottom[0], bottom[1], bottom[2] - fall * ph * ph];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    g.fillStyle = css(WHEY, 0.9 * down);
    g.beginPath();
    g.ellipse(x, y, r * 0.07, r * 0.11, 0, 0, TAU);
    g.fill();
  }
  g.restore();
}

/** What a strike throws: a puff where its paws land. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Mus, b: Bones, at: Bones, t: number, front: boolean): void {
  const since = (t - MUS_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t;
  if (since <= 0 || since > 0.4) return;
  const p = scale(add(at.hand0.t, at.hand1.t), 0.5), fwd = turn(at.body, [0, 1, 0]);
  const hit = add(p, scale(fwd, s.hand * 1.5));
  if (nearSide(hit, mid, view) === front) puffOf(g, view, hit, s.hand * 3.2, since / 0.4, CREAM, 0.5);
}

/** Evolving: curds and motes of cream swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Mus, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const R0 = s.hips.r[0] * 1.6 + 0.2, high = s.torso.z[s.torso.z.length - 1] + s.high + s.head.up * 2;
  g.save();
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.38), ang = (q / 18) * TAU + u * TAU * 1.5, kk = (1 - u) ** 1.1;
    const p: V3 = [Math.cos(ang) * R0 * kk, Math.sin(ang) * R0 * kk, 0.2 + u * high * 0.8];
    if (nearSide(p, b.chest.t, view) !== front) continue;
    const [x, y] = onScreen(view, p), r = (0.06 + 0.025 * s.stage) * (1 - 0.4 * u), al = swirl * ramp(u, 0, 0.12);
    g.fillStyle = css(q % 3 ? CURD : CREAM, al);
    g.beginPath();
    g.ellipse(x, y, r * 0.8, r, ang * 2, 0, TAU);
    g.fill();
  }
  g.restore();
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function musKind(s: Mus): Kind {
  const bones = musBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: MUS_HITS[s.stage] } });
  return {
    bones,
    build: (lod) => musBuild(s, lod),
    // The variant's two colours are its fur and its cream front; its pink ears, nose and tail, its white paws and feet, and
    // everything it wears are the same on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, [150, 116, 96], 0.15), cream = mix([252, 244, 228], mark, 0.3);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [96, 70, 60], 0.3),
        coatLight: mix(fur, [255, 246, 236], 0.35),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 253, 248], 0.5),
        inner: [252, 172, 182],
        membrane: [250, 204, 198],
        spot: [238, 166, 168],
        lid: [80, 50, 46],
        nose: [238, 140, 150],
        lip: [150, 62, 70],
        tongue: [240, 128, 138],
        tooth: [255, 252, 246],
        pad: [252, 246, 238],
        cloth: [252, 246, 226],
        clothDark: [232, 220, 192],
        cap: [252, 246, 228],
        lining: [255, 238, 196],
        trim: [244, 200, 80],
        leaf: [122, 168, 86],
        leafDark: [92, 136, 70],
        tunic: [104, 138, 82],
        fitting: [236, 186, 80],
        hornDark: [196, 142, 56],
        bloom: [255, 220, 110],
        bill: [250, 226, 140],
        billDark: [214, 166, 70],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.hips.r[1] * 1.25 + s.tail.len * 0.15, s.hips.r[0] * 1.2],
    stride: 1.4,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are curd yellow and cream.
    motes: [[255, 230, 150], [255, 250, 236]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const WHEYBIT = musKind(WHEYBIT_LOOK);
export const PRESSQUEAK = musKind(PRESSQUEAK_LOOK);
export const FROMAGEON = musKind(FROMAGEON_LOOK);
