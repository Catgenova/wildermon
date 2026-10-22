import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, darker, disc, dot, frac, lerp, LOOP, merge, mirrored, mix, onEgg, orb, orbAlong, paint,
  pastel, quadBones, quadBonesOf, quadPose, scale, smile, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece, type QuadPose,
  type LegSpec, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { UNITS_PER_TILE } from './iso';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import { trot } from './wild-paws';

/**
 * The briar line: the Blushkit, a small kitten, cream fur with sage leaf
 * patches, big ears lined in pink, a collar of green leaves round its neck,
 * big green eyes, rosy cheeks and a thin tail ending in a leafy tuft; which
 * grows into the Briarpounce, a lean cat carried in a low stalking crouch,
 * its fore legs reaching out ahead, a mane and a spray of big pink and green
 * leaves at its shoulders, leaves on its legs and a long curved tail ending
 * in a big frond; and then the Thornlance, a large lithe cat lunging forward
 * with its mouth open, its mane and shoulders bristling with long pink and
 * green blades, its fore legs sheathed in leaves, an amber eye, dark claws
 * and a very long tail swept up over its back to a plume of green and pink
 * leaves. The species is still `lungra` underneath, as saves and the
 * database know it: the guard whose tamed ability is a pounce.
 *
 * Built the way the vine line is (`./wild-vine`): one set of functions from
 * a description of the stage (`Briar`), a body on four paws (`quadBonesOf`)
 * with its own head, tail and leaves. It pads at a walk, its shoulders
 * rolling over each paw and its tail swaying, and runs in a bound. Its tail
 * is a chain of links with a wave running down it, so a flick at the root
 * curls out to the frond. Every leaf is four facets, folded along its rib
 * and seen from either side, and the leaves of a piece are one mesh, stirred
 * together in a ripple (`stirred`) and flared out as it springs.
 *
 * It strikes with a claw: the kit rears and bats with a fore paw, the
 * Briarpounce rears its right paw high and slashes it down, the Thornlance
 * lunges with its jaws wide and both fore paws raking. At its post it
 * crouches alert, head sweeping, ears pricked, its leaves bristling. Its
 * pounce: down on its haunches, its rump treading and its tail lashing, a
 * spring through the air from behind where it lands, fore legs reaching and
 * leaves flared, and down on its fore paws in a burst of loose leaves, biting.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/**
 * How a tail is carried: lifted at the root (degrees up from straight back), swung to the right, curled up at each link and
 * further at its last three; a wave running down it, `wave` degrees from side to side and `heave` up and down, `phase` (in
 * turns) at its root.
 */
interface Key { lift: number; yaw: number; curl: number; tip: number; wave: number; heave: number; phase: number }

/** A tail: where it roots, each link's length and thickness root to tip, the wave's lag a link and growth to the tip, how it is carried, and its frond. */
interface Tail {
  at: V3;
  links: number[];
  w: number[];
  lag: number;
  grow: number;
  rest: Key;
  /** The leaves at its tip: how many, how long the biggest, how wide, and how many of them are pink. */
  frond: { count: number; len: number; w: number; pink: number };
}

/** A row of leaves on the shoulders: `th` round the barrel from the right side (a quarter turn is the ridge), `y0` to `y1` along it, `count` of them, `len` long and `w` wide, stood `stand` degrees up off the barrel, `pink` of them pink. */
interface Row { th: number; y0: number; y1: number; count: number; len: number; w: number; stand: number; pink: number }

interface Briar {
  stage: 0 | 1 | 2;
  body: Rings;
  /** Shoulder to hip; the legs' length, how thick they are, how big a paw is across. */
  len: number;
  legs: number;
  thick: number;
  paw: number;
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes; the muzzle's half-width, half-length and half-height and how far under the skull's middle it is; the nose's pitch. */
  head: { r: V3; muzzle: V3; drop: number; pitch: number };
  /** The eyes: the way out to the right one, how big, and how hard a brow comes down over them. */
  eye: { dir: V3; size: number; fierce: number };
  ear: { len: number; w: number; out: number; back: number };
  /** Out of each cheek: fluff on the kit, leaf blades on the others -- how many and how long. */
  cheek: [number, number];
  /** Leaves round the neck: how many, how long, how wide, how far up the neck (a share of it), how many pink; how far they stand out (nought lying down it, one straight out). */
  collar: { count: number; len: number; w: number; at: number; pink: number; stand: number };
  spray: Row[];
  /** Leaves down each lower fore leg and on each hind thigh. */
  sleeve: [number, number];
  /** How low it carries itself standing: nought upright, one a stalking crouch; how much lower its chest than its rump; how far its fore legs reach out ahead and its hind legs stand out behind (degrees). */
  crouch: number;
  bow: number;
  reach: number;
  spread: number;
  gait: { swing: [number, number]; nod: number; roll: number };
  /** How far forward it lunges as it strikes, against its own length; and how far its pounce is drawn carrying it, in tiles. */
  lunge: number;
  leap: number;
  size: number;
}

/** A Blushkit: a small kitten, big head and ears, a leaf collar under its chin, rosy cheeks, a thin tail with a leafy tuft. */
const BLUSHKIT_LOOK: Briar = {
  stage: 0,
  body: { y: [-0.8, -0.7, -0.38, 0.04, 0.44, 0.72, 0.82], z: [0.1, 0.08, 0.04, 0.02, 0.06, 0.1, 0.12], w: [0.28, 0.44, 0.47, 0.44, 0.49, 0.45, 0.22], h: [0.3, 0.43, 0.45, 0.42, 0.47, 0.45, 0.22] },
  len: 1.3, legs: 0.5, thick: 0.15, paw: 0.2,
  neck: { at: [0, 0.68, 0.14], len: 0.26, w: 0.34, lean: 26 },
  head: { r: [0.86, 0.7, 0.74], muzzle: [0.24, 0.2, 0.15], drop: 0.32, pitch: -4 },
  eye: { dir: [0.5, 0.78, 0.2], size: 0.27, fierce: 0 },
  ear: { len: 0.7, w: 0.5, out: 28, back: 2 },
  cheek: [3, 0.24],
  collar: { count: 12, len: 0.5, w: 0.19, at: -0.3, pink: 0, stand: 0.9 },
  spray: [],
  sleeve: [1, 0],
  crouch: 0, bow: 0, reach: 0, spread: 0,
  gait: { swing: [30, 44], nod: 5, roll: 3 },
  lunge: 0.2, leap: 0.3,
  size: 2.5,
};

/** A Briarpounce: lean, low in a stalking crouch, fore legs reaching, a spray of big pink and green leaves at its shoulders, a long tail with a frond. */
const BRIARPOUNCE_LOOK: Briar = {
  stage: 1,
  body: { y: [-1.36, -1.22, -0.76, 0, 0.7, 1.16, 1.32], z: [0.12, 0.1, 0.05, 0.0, 0.08, 0.14, 0.16], w: [0.28, 0.4, 0.42, 0.35, 0.45, 0.44, 0.23], h: [0.28, 0.42, 0.42, 0.34, 0.48, 0.46, 0.23] },
  len: 2.5, legs: 1.05, thick: 0.13, paw: 0.18,
  neck: { at: [0, 1.14, 0.14], len: 0.48, w: 0.34, lean: 66 },
  head: { r: [0.5, 0.5, 0.46], muzzle: [0.2, 0.32, 0.15], drop: 0.15, pitch: -4 },
  eye: { dir: [0.6, 0.66, 0.38], size: 0.16, fierce: 0.35 },
  ear: { len: 0.66, w: 0.3, out: 22, back: 14 },
  cheek: [3, 0.42],
  collar: { count: 9, len: 0.7, w: 0.21, at: 0.85, pink: 0.45, stand: 0.5 },
  spray: [
    { th: Math.PI / 2, y0: 0.5, y1: 1.15, count: 5, len: 1.45, w: 0.38, stand: 70, pink: 0.5 },
    { th: 1.08, y0: 0.35, y1: 1.1, count: 4, len: 1.15, w: 0.34, stand: 52, pink: 0.5 },
    { th: 0.62, y0: 0.6, y1: 1.05, count: 2, len: 0.7, w: 0.26, stand: 24, pink: 0 },
  ],
  sleeve: [3, 1],
  crouch: 0.5, bow: 0.5, reach: 34, spread: 14,
  gait: { swing: [30, 44], nod: 3, roll: 4 },
  lunge: 0.26, leap: 0.45,
  size: 2.2,
};

/** A Thornlance: big and lithe, lunging, its mane and shoulders bristling with long blades, fore legs sheathed in leaves, a very long tail swept up to a plume. */
const THORNLANCE_LOOK: Briar = {
  stage: 2,
  body: { y: [-1.9, -1.74, -1.08, 0, 0.98, 1.62, 1.82], z: [0.16, 0.14, 0.08, 0.02, 0.12, 0.2, 0.22], w: [0.4, 0.56, 0.58, 0.48, 0.66, 0.64, 0.32], h: [0.4, 0.58, 0.58, 0.46, 0.7, 0.68, 0.32] },
  len: 3.5, legs: 1.55, thick: 0.17, paw: 0.24,
  neck: { at: [0, 1.62, 0.2], len: 0.78, w: 0.46, lean: 78 },
  head: { r: [0.52, 0.6, 0.47], muzzle: [0.23, 0.42, 0.18], drop: 0.15, pitch: -8 },
  eye: { dir: [0.62, 0.62, 0.4], size: 0.15, fierce: 0.85 },
  ear: { len: 0.72, w: 0.31, out: 22, back: 34 },
  cheek: [7, 0.9],
  collar: { count: 18, len: 1.4, w: 0.3, at: 0.9, pink: 0.5, stand: 0.8 },
  spray: [
    { th: Math.PI / 2, y0: 0.3, y1: 1.65, count: 8, len: 2.0, w: 0.36, stand: 50, pink: 0.5 },
    { th: 1.32, y0: 0.4, y1: 1.6, count: 6, len: 1.85, w: 0.34, stand: 46, pink: 0.55 },
    { th: 1.1, y0: 0.1, y1: 1.55, count: 7, len: 1.6, w: 0.34, stand: 38, pink: 0.45 },
    { th: 0.82, y0: 0.5, y1: 1.6, count: 5, len: 1.3, w: 0.3, stand: 24, pink: 0.5 },
    { th: 0.5, y0: 0.9, y1: 1.65, count: 4, len: 1.1, w: 0.28, stand: 10, pink: 0.6 },
  ],
  sleeve: [5, 2],
  crouch: 0.35, bow: 0.65, reach: 34, spread: 16,
  gait: { swing: [26, 40], nod: 2, roll: 4 },
  lunge: 0.3, leap: 0.55,
  size: 2.8,
};

const TAILS: readonly Tail[] = [
  {
    at: [0, -0.76, 0.26], links: Array.from({ length: 8 }, () => 0.17), w: Array.from({ length: 8 }, (_, q) => 0.058 - 0.002 * q), lag: 0.07, grow: 0.8,
    rest: { lift: 40, yaw: 10, curl: -4, tip: 22, wave: 0, heave: 0, phase: 0 }, frond: { count: 4, len: 0.5, w: 0.18, pink: 0 },
  },
  {
    at: [0, -1.3, 0.28], links: Array.from({ length: 12 }, (_, q) => 0.3 - 0.003 * q), w: Array.from({ length: 12 }, (_, q) => 0.07 - 0.0028 * q), lag: 0.055, grow: 1.2,
    rest: { lift: -10, yaw: 6, curl: 5.5, tip: 30, wave: 0, heave: 0, phase: 0 }, frond: { count: 4, len: 1.25, w: 0.38, pink: 0.25 },
  },
  {
    at: [0, -1.84, 0.4], links: Array.from({ length: 14 }, (_, q) => 0.36 - 0.004 * q), w: Array.from({ length: 14 }, (_, q) => 0.1 - 0.0036 * q), lag: 0.05, grow: 1.2,
    rest: { lift: -8, yaw: 6, curl: 5.5, tip: 32, wave: 0, heave: 0, phase: 0 }, frond: { count: 7, len: 1.7, w: 0.4, pink: 0.45 },
  },
];

/* ---- helpers --------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a row of leaves is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

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
/** The same point and way out, on the left side. */
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** A mesh with every face of one colour made another. */
const recoloured = (m: Mesh, from: Mat, to: Mat): Mesh => mesh(m.v, m.f.map((f) => (f.m === from ? { ...f, m: to } : f)));

/** Every bone moved by `d`, for a body thrown forward in a lunge or carried through a pounce. */
function shifted(b: Bones, d: V3): Bones {
  if (!d[0] && !d[1] && !d[2]) return b;
  const out: Bones = {};
  for (const k of Object.keys(b)) out[k] = { m: b[k].m, t: k === 'shadow' ? [b[k].t[0] + d[0], b[k].t[1] + d[1], 0] : add(b[k].t, d) };
  return out;
}

/** Each face wound so it faces along `want`, whichever way round it was listed. */
function facing(v: readonly V3[], idx: number[], want: V3): number[] {
  let nx = 0, ny = 0, nz = 0;
  for (let a = 0; a < idx.length; a++) {
    const p = v[idx[a]], r = v[idx[(a + 1) % idx.length]];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return nx * want[0] + ny * want[1] + nz * want[2] < 0 ? [...idx].reverse() : idx;
}

/* ---- leaves --------------------------------------------------------------------------- */

/**
 * A leaf: from `root` out along `dir`, its face turned along `face`, `len` long and `w` across at its widest, a third of the
 * way out to a long point; drooping toward the back of its face by `droop` of its length by the tip, and folded up along its
 * rib by `fold` of its width. Pink, sage or a darker sage; which way its tip flares out as it springs (its face by default).
 */
interface Leaf { root: V3; dir: V3; face: V3; len: number; w: number; droop?: number; fold?: number; pink?: boolean; dark?: boolean; flare?: V3 }

/**
 * Leaves as one mesh: each two halves either side of its rib, a face up and a face down sharing their corners, so it is seen
 * from either side, four facets a leaf, and the rib drawn where the halves fold. With it, for every corner, how far its leaf's
 * stir and flare move it (`stirred`): nothing at the root, its length at the tip, along the way it flares.
 */
interface LeafSet { mesh: Mesh; move: Float32Array }

const SHAPE = [0.2, 0.9, 1, 0.66, 0];
function leaves(list: readonly Leaf[]): LeafSet {
  const v: V3[] = [], f: Face[] = [], move: number[] = [];
  for (const L of list) {
    const d = unit(L.dir), n = unit(sub(L.face, scale(d, dot(L.face, d)))), side = cross(d, n);
    const dr = L.droop ?? 0.25, fold = L.fold ?? 0.16, fl = unit(L.flare ?? n);
    const K = SHAPE.length, base = v.length;
    const ribAt = (u: number): V3 => add(add(L.root, scale(d, L.len * u)), scale(n, -dr * L.len * u * u));
    const push = (p: V3, u: number): void => { v.push(p); move.push(fl[0] * L.len * u, fl[1] * L.len * u, fl[2] * L.len * u); };
    for (let k = 0; k < K; k++) push(ribAt(k / (K - 1)), k / (K - 1));
    for (const sd of [-1, 1]) {
      for (let k = 0; k < K - 1; k++) {
        const u = k / (K - 1), hw = L.w * SHAPE[k];
        push(add(add(ribAt(u), scale(side, sd * hw)), scale(n, fold * hw)), u);
      }
    }
    const rib = Array.from({ length: K }, (_, k) => base + k);
    const half = (sd: number): number[] => [...rib, ...Array.from({ length: K - 1 }, (_, k) => base + K + (sd > 0 ? K - 1 : 0) + (K - 2 - k))];
    // Its underside a paler of its top, which in the shade the underside of a leaf is nearly always in reads as the same leaf.
    const top: Mat = L.pink ? 'petal' : L.dark ? 'leafDark' : 'leaf', under: Mat = L.pink ? 'cap' : L.dark ? 'leaf' : 'stem';
    for (const sd of [-1, 1]) {
      const idx = half(sd);
      f.push({ i: facing(v, idx, n), m: top });
      f.push({ i: facing(v, idx, scale(n, -1)), m: under });
    }
  }
  return { mesh: mesh(v, f), move: Float32Array.from(move) };
}

/**
 * A set of leaves stirred and flared: every corner moved along its leaf's flare by `flare` of how far out it is, and rippled
 * by `stir` of it in a wave running through the set, so the leaves rustle; and the whole bent first by `bend`, for leaves on
 * a back that arches.
 */
function stirred(S: LeafSet, how: (a: Anim) => { stir: number; flare: number; ph: number }, bend?: (p: V3, a: Anim) => V3): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { stir, flare, ph } = how(a);
    if (!stir && !flare && !bend) return v as V3[];
    const M = S.move;
    return v.map((p0, i) => {
      const p = bend ? bend(p0, a) : p0;
      const mx = M[i * 3], my = M[i * 3 + 1], mz = M[i * 3 + 2];
      if (!mx && !my && !mz) return p;
      const q = TAU * ph + p0[1] * 2.2 + p0[0] * 1.7;
      const k = flare + stir * Math.sin(q), j = stir * 0.6 * Math.cos(q * 1.3);
      return [p[0] + mx * k + j * my, p[1] + my * k - j * mx, p[2] + mz * k] as V3;
    });
  };
}

/* ---- its moves --------------------------------------------------------------------------- */

/** The strike, as shares of it: gathered, the paw raised (or sprung), the blow landing, and let go. */
export const BRIAR_STRIKE = { gather: 0.26, raise: 0.4, hit: 0.5, hold: 0.62 } as const;
/** At its post, as shares of a go of it: crouched by `in`, a hiss at `hiss`, risen again from `out`. */
export const BRIAR_WORK = { in: 0.14, hiss: 0.56, out: 0.86 } as const;
/** The pounce, as shares of the cast: gathered, sprung, landed on its fore paws, and the bite. */
export const BRIAR_CAST = { gather: 0.3, spring: 0.36, land: 0.64, bite: 0.74 } as const;
/** Standing about, when in its loop (seconds) the Thornlance bares its teeth and the others crouch to stare. */
export const BRIAR_SNARLS: readonly number[] = [9.2, 19.6];

/** How far through a strike it has gathered, raised its paw, landed the blow, and has its weight forward. */
function strikeOf(t: number): { gather: number; raise: number; hit: number; reach: number; land: number } {
  const S = BRIAR_STRIKE;
  const gather = ramp(t, 0, S.gather) * (1 - ramp(t, S.raise - 0.04, S.hit));
  const raise = ramp(t, S.gather - 0.08, S.raise) * (1 - ramp(t, S.raise, S.hit + 0.02));
  const hit = ramp(t, S.raise, S.hit) * (1 - ramp(t, S.hold, 1));
  const reach = ramp(t, S.gather, S.hit) * (1 - ramp(t, S.hold, 1));
  const land = t < S.hit ? 0 : Math.exp(-(t - S.hit) * 12) * (1 - ramp(t, 0.85, 1));
  return { gather, raise, hit, reach, land };
}

/** How far through a go at its post: down in its crouch, and the hiss. */
function workOf(t: number, moving: number): { crouch: number; hiss: number } {
  const W = BRIAR_WORK, still = 1 - moving;
  return { crouch: still * ramp(t, 0, W.in) * (1 - ramp(t, W.out, 1)), hiss: still * hump(t, W.hiss, 0.14) };
}

/** How far through its pounce: gathered, in the air (and how far along the arc), reaching, just landed, and biting. */
function castOf(t: number): { gather: number; air: number; u: number; reach: number; land: number; bite: number; flare: number } {
  const C = BRIAR_CAST;
  const gather = ramp(t, 0, C.gather * 0.6) * (1 - ramp(t, C.spring - 0.04, C.spring + 0.04));
  const u = clamp((t - C.spring) / (C.land - C.spring));
  const air = t > C.spring && t < C.land ? Math.sin(Math.PI * u) : 0;
  const reach = ramp(t, C.spring - 0.04, C.spring + 0.06) * (1 - ramp(t, C.land + 0.04, 0.92));
  const land = t < C.land ? 0 : Math.exp(-(t - C.land) * 11) * (1 - ramp(t, 0.9, 1));
  const bite = hump(t, C.bite, 0.08);
  // The leaves bristle as it gathers, stream back in the air and burst out as it lands.
  const flare = 0.25 * gather + 0.35 * air + 0.6 * land;
  return { gather, air, u, reach, land, bite, flare };
}

/** How far its pounce carries it, in its own units. */
const leapOf = (s: Briar): number => (s.leap * UNITS_PER_TILE) / s.size;
/**
 * Where along its pounce it is, against where it lands: behind by the whole leap until it springs, coming in through the air.
 * The island has it where it lands from the moment it pounces, so the leap is drawn in from behind it.
 */
const leapBack = (s: Briar, t: number): number => {
  const C = BRIAR_CAST;
  if (t >= C.land) return 0;
  const u = clamp((t - C.spring) / (C.land - C.spring));
  return -leapOf(s) * (1 - u);
};

/* ---- its bones -------------------------------------------------------------------------- */

/** A stage's body on four paws (`QuadSpec`): its legs, neck and ears from its numbers. The tail is its own (`tailBones`). */
function specOf(s: Briar): QuadSpec {
  return {
    high: s.legs + 0.5,
    fore: { at: [s.body.w[4] * 0.5, s.len * 0.44, -0.3], len: [s.legs * 0.5, s.legs * 0.46, s.paw * 0.55], rest: [-3, 6, 0], fold: [55, 85], toe: [s.paw * 1.1, s.paw * 0.4] },
    hind: { at: [s.body.w[2] * 0.52, -s.len * 0.42, -0.14], len: [s.legs * 0.46, s.legs * 0.42, hock(s)], rest: [22, -48, 0], fold: [35, 55], toe: [s.paw * 1.1, s.paw * 0.4] },
    neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
    head: { pitch: s.head.pitch },
    ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
    swing: s.gait.swing,
    duty: [0.62, 0.3],
    graze: 104 - s.neck.lean,
    nose: 22,
    bow: 10,
    rock: 5,
  };
}

/**
 * How high a hind paw's heel is carried, its sole to the hock: as much as the hind leg, hung from higher on the body and bent
 * at the hock, comes short of the fore leg's reach, so all four soles stand on the ground together.
 */
const hock = (s: Briar): number => 0.16 + 0.156 * s.legs + s.paw * 0.55;

/** Where each ear is rooted on the head (the right one): high on the crown, toward the side. */
function earRoot(s: Briar): V3 {
  const q = onSkull(s, [0.6, -0.12, 0.8]);
  return sub(q.p, scale(q.n, 0.08));
}

/** Its legs folded under it by `k`: the fore legs bent at the elbow and the hind at the hock, so it sinks low over its paws. */
function crouched(p: QuadPose, k: number, hind = k): void {
  for (const i of [0, 1]) {
    p.legs[i][0] -= 34 * k;
    p.legs[i][1] -= 1.3 * k;
  }
  for (const i of [2, 3]) {
    p.legs[i][0] += 30 * hind;
    p.legs[i][1] += 1.2 * hind;
  }
}

/**
 * Its chest let down below its rump by `k`, the fore legs folded and the body tipped nose down over them: a stalk, a lunge;
 * the hind legs let out by `out` of a fold for each of `k`, as far as keeps the hind paws on the ground (`bowOut`).
 */
function bowed(p: QuadPose, k: number, out: number): void {
  if (!k) return;
  crouched(p, k, 0);
  p.pitch -= 14 * k;
  for (const i of [0, 1]) p.legs[i][0] += 14 * k;
  for (const i of [2, 3]) p.legs[i][1] -= out * k;
  p.neck[0] -= 6 * k;
  p.head[0] += 14 * k;
}

/** How far a stage's hind legs are let out as it bows, for its hind paws to be down with its fore paws standing: found once, by halving. */
const bows = new Map<Briar, number>();
function bowOut(s: Briar): number {
  let out = bows.get(s);
  if (out !== undefined) return out;
  if (!s.bow) return 0;
  const spec = specOf(s);
  const lowest = (b: Bones, keys: string[], L: LegSpec): number => Math.min(...keys.flatMap((k) => [L.toe![0], -L.toe![1]].map((y) => place(b[k], [0, y, -L.len[2]])[2])));
  const gap = (h: number): number => {
    const p = quadPose(spec, { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
    crouched(p, s.crouch);
    bowed(p, s.bow, h);
    p.legs[0][0] += s.reach;
    p.legs[1][0] += s.reach;
    p.legs[2][0] -= s.spread;
    p.legs[3][0] -= s.spread;
    const b = quadBones(spec, p);
    return lowest(b, ['hl2', 'hr2'], spec.hind) - lowest(b, ['fl2', 'fr2'], spec.fore);
  };
  let lo = -4, hi = 4;
  for (let q = 0; q < 16; q++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) > 0) lo = mid;
    else hi = mid;
  }
  out = (lo + hi) / 2;
  bows.set(s, out);
  return out;
}

/**
 * Its run: a bound. The hind feet come down together and drive, the body
 * goes out long with the fore legs reaching, the fore feet come down one
 * after the other, and the hind legs swing up under its chest to come down
 * ahead of where they left. The head is held level through it all.
 */
function bound(p: QuadPose, a: Anim): void {
  const g = a.go * smooth(a.gait);
  if (g <= 0) return;
  const w = frac(a.u);
  const bump = (x: number, x0: number, x1: number): number => (x > x0 && x < x1 ? Math.sin((Math.PI * (x - x0)) / (x1 - x0)) : 0);
  const leg = (u: number, amp: number, trail: number, reach: number, fold: [number, number]): [number, number, number] => {
    const q = frac(u), duty = 0.3;
    if (q < duty) return [amp * (1 - (2 * q) / duty), 0, 0];
    const t = (q - duty) / (1 - duty);
    return [-amp + 2 * amp * smooth(t) - trail * bump(t, 0, 0.35) + reach * bump(t, 0.6, 1), 1.3 * bump(t, fold[0], fold[1]) ** 2, t];
  };
  const fore: [number, number] = [0.05, 0.72], hind: [number, number] = [0.2, 1.05];
  const legs = [leg(a.u - 0.44, 32, 4, 26, fore), leg(a.u - 0.47, 32, 4, 26, fore), leg(a.u, 28, 22, 16, hind), leg(a.u - 0.03, 28, 22, 16, hind)];
  p.legs = p.legs.map((l, i) => [lerp(l[0], legs[i][0], g), lerp(l[1], legs[i][1], g), lerp(l[2], legs[i][2], g)] as [number, number, number]);
  const turn = (w0: number, w1: number): number => smooth((w - w0) / (w1 - w0));
  const rock = 7 * (w < 0.5 ? 1 - 2 * turn(0.33, 0.44) : -1 + 2 * turn(0.77, 1));
  p.pitch = lerp(p.pitch, rock, g);
  p.head[0] = lerp(p.head[0], -rock - 2, g);
  p.lift = lerp(p.lift, 0.3 * bump(w, 0.33, 0.44) + 0.5 * bump(w, 0.77, 1), g);
  p.squash = lerp(p.squash, -0.04 * Math.max(0, Math.sin(TAU * (w - 0.25))), g);
  p.roll *= 1 - g;
}

/** Its spine: arched through a bound and as it gathers to spring, let out long in the air. Everything on the trunk goes with it. */
function flexOf(s: Briar, a: Anim): number {
  const g = a.go * smooth(a.gait), k = s.len / 2.4;
  let arch = g > 0 ? g * (0.06 + 0.18 * Math.cos(TAU * (frac(a.u) - 0.87))) * k : 0;
  const act = a.act;
  if (act?.kind === 'strike') arch += 0.08 * strikeOf(act.t).gather * k;
  if (act?.kind === 'cast') { const c = castOf(act.t); arch += (0.12 * c.gather - 0.1 * c.air) * k; }
  if (act?.kind === 'work') arch += (s.stage ? 0.04 : 0.6) * workOf(act.t, a.go).crouch * k;
  return arch;
}

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its
 * crouch, its padding walk and its bound; its idle ways; and its moves -- a
 * claw strike, an alert crouch at its post, its pounce, and evolving.
 */
function briarPose(s: Briar, p: QuadPose, a: Anim): void {
  trot(p, a);
  const g = smooth(a.go), walk = 1 - a.gait, G = s.gait, still = 1 - g;
  // Carried low, the cats in their stalking crouch, drawn up out of it at a run; the fore legs reaching out ahead standing.
  crouched(p, s.crouch * (1 - g * a.gait) * (1 - 0.35 * g * walk));
  bowed(p, s.bow * (1 - g * (0.5 + 0.5 * a.gait)), bowOut(s));
  p.legs[0][0] += s.reach * still;
  p.legs[1][0] += s.reach * still;
  p.legs[2][0] -= s.spread * still;
  p.legs[3][0] -= s.spread * still;
  p.neck[0] += 6 * s.crouch * still;
  p.head[0] += 4 * s.crouch * still;
  if (a.go > 0) {
    const w = frac(a.u);
    // A padding walk: the head let down and carried level and still, the shoulders rolling over each paw as it comes down.
    p.neck[0] += g * walk * (4 + 8 * s.crouch);
    p.head[0] += g * walk * (3 + 6 * s.crouch);
    p.head[0] += g * walk * G.nod * Math.sin(w * TAU * 2 - 0.6);
    p.roll += g * walk * G.roll * Math.sin(w * TAU + 0.3);
    p.pitch += g * walk * 1.5 * Math.sin(w * TAU * 2 + 0.4);
    p.ears[0][0] += g * (2 * G.nod * Math.sin(w * TAU * 2 - 1.4) + 25 * a.gait);
    p.ears[1][0] += g * (2 * G.nod * Math.sin(w * TAU * 2 - 1.1) + 25 * a.gait);
    p.neck[0] += 12 * a.gait * g;
  } else {
    const idle = 1 - a.graze;
    // An ear flicked and swivelled now and then, one at a time.
    p.ears[0][1] += 26 * beat(a.t, [2.2, 13.8], 0.5);
    p.ears[1][1] += 26 * beat(a.t, [6.4, 17.1, 22.3], 0.5);
    if (s.stage === 0) {
      // The kit: its head cocked to one side and then the other, and a fore paw lifted and set down, kneading.
      const cock = beat(a.t, [5.2], 2.2) - beat(a.t, [15.6], 2.2);
      p.head[2] += 16 * cock * idle;
      p.head[1] += 8 * cock * idle;
      const paw = beat(a.t, [10.4, 21.2], 0.9) * idle;
      p.legs[1][0] += 22 * paw;
      p.legs[1][1] += 0.9 * paw;
      p.legs[1][2] += paw;
    } else {
      // Now and then a stalking crouch, chest down and fore legs out, staring.
      const stare = beat(a.t, [7.4], 2.4) * idle;
      crouched(p, 0.3 * stare);
      p.legs[0][0] += 12 * stare;
      p.legs[1][0] += 12 * stare;
      p.neck[0] += 10 * stare;
      p.head[0] += 10 * stare;
      p.ears[0][0] -= 10 * stare;
      p.ears[1][0] -= 10 * stare;
    }
    if (s.stage === 2) {
      // And the Thornlance bares its teeth, head low, ears back.
      const snarl = beat(a.t, BRIAR_SNARLS, 1.6) * idle;
      p.neck[0] += 6 * snarl;
      p.head[0] += 8 * snarl;
      p.ears[0][0] += 20 * snarl;
      p.ears[1][0] += 20 * snarl;
    }
  }
  bound(p, a);
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t);
    // Gathered back on its haunches, head drawn in, ears pinned.
    crouched(p, 0.35 * k.gather);
    p.neck[0] -= 6 * k.gather;
    p.head[0] += 6 * k.gather;
    for (const e of p.ears) e[0] += 40 * k.gather + 20 * k.hit;
    // The swiping paw is the left, and the other is the right.
    const [sw, ot] = [0, 1];
    if (s.stage === 0) {
      // The kit hops up high onto its hind legs, both fore paws up, its head turned to what it bats at, and brings the left
      // down in a wide arc from over its head to out in front of it.
      const rear = hump(act.t, BRIAR_STRIKE.raise + 0.02, 0.22);
      p.pitch += 40 * rear;
      p.lift += 0.55 * s.legs * rear;
      p.head[0] -= 26 * rear - 12 * k.hit;
      p.head[1] += 16 * rear;
      p.head[2] += 12 * rear;
      for (const i of [0, 1]) {
        p.legs[i][0] += 40 * rear;
        p.legs[i][1] += 0.7 * rear;
      }
      p.legs[sw][0] += 85 * k.raise - 30 * k.hit;
      p.legs[sw][1] += 0.2 * k.raise - 0.3 * k.hit;
      p.legs[ot][0] += 8 * k.hit;
      p.squash += 0.14 * k.land;
    } else {
      // A fore paw reared up high and folded, then slashed down and out ahead; the Thornlance lunges, both paws raking.
      const both = s.stage === 2 ? 1 : 0;
      p.legs[sw][0] += 85 * k.raise + 34 * k.hit;
      p.legs[sw][1] += 1.1 * k.raise - 0.2 * k.hit;
      p.legs[sw][2] += k.raise;
      p.legs[ot][0] += both * (60 * k.raise + 14 * k.hit) + (1 - both) * 10 * k.hit;
      p.legs[ot][1] += both * 0.9 * k.raise;
      // Reared up off its fore paws as it raises them, and come down onto them.
      p.lift += both * 0.22 * s.legs * Math.max(k.raise, 0.7 * k.hit);
      p.pitch += (10 + 8 * both) * k.raise - 6 * k.land;
      p.roll += 5 * k.raise * (1 - both);
      for (const i of [2, 3]) {
        p.legs[i][0] -= (both ? 26 : 8) * k.reach;
        p.foot[i] -= 25 * k.reach * both;
      }
      // The head thrust out level at what it strikes, nose a little up so the open jaws show.
      p.neck[0] += 6 * k.reach;
      p.head[0] += (both ? 10 : 2) * k.reach - 6 * k.raise;
      p.squash += 0.08 * k.land;
    }
  } else if (act?.kind === 'work') {
    const w = workOf(act.t, a.go);
    // At its post: low and still on its paws, the head sweeping slowly from side to side, ears pricked and swivelling.
    // The kit puffs itself up instead of sinking: its back arched (`flexOf`), its legs straight under it, side on.
    crouched(p, (s.stage ? 0.4 : -0.1) * w.crouch);
    if (!s.stage) {
      p.lift += 0.12 * s.legs * w.crouch;
      p.roll += 6 * w.crouch * Math.sin(TAU * act.t);
      for (const e of p.ears) e[1] += 16 * w.crouch;
    }
    p.neck[0] += 10 * w.crouch;
    p.head[0] += 4 * w.crouch;
    p.neck[1] += 8 * w.crouch * Math.sin(TAU * act.t);
    p.head[1] += 18 * w.crouch * Math.sin(TAU * act.t - 0.5);
    p.ears[0][0] -= 12 * w.crouch;
    p.ears[1][0] -= 12 * w.crouch;
    const swivel = s.stage ? 14 : 30;
    p.ears[0][1] += swivel * w.crouch * Math.sin(TAU * act.t * 2);
    p.ears[1][1] -= swivel * w.crouch * Math.sin(TAU * act.t * 2 + 0.7);
    // The hiss: the head drawn back and the ears laid flat.
    p.head[0] += 8 * w.hiss;
    p.neck[0] -= 6 * w.hiss;
    p.ears[0][0] += 36 * w.hiss;
    p.ears[1][0] += 36 * w.hiss;
  } else if (act?.kind === 'cast') {
    const c = castOf(act.t);
    // Gathered: down on its haunches, head low and level on what it will spring at, ears flat, its rump treading.
    crouched(p, (0.9 - 0.4 * s.crouch) * c.gather);
    p.neck[0] += 14 * c.gather;
    p.head[0] += 6 * c.gather;
    const tread = c.gather * Math.sin(act.t * 70) * ramp(act.t, 0.1, 0.16);
    p.legs[2][0] += 5 * tread;
    p.legs[3][0] -= 5 * tread;
    p.roll += 2.5 * tread;
    for (const e of p.ears) e[0] += 45 * c.gather + 30 * c.air;
    // Sprung: straightened out of its crouch and its stalk, up off the ground, hind legs driven out behind and fore legs flung out ahead.
    crouched(p, -s.crouch * c.reach);
    bowed(p, -s.bow * c.reach, bowOut(s));
    p.legs[0][0] -= s.reach * c.reach;
    p.legs[1][0] -= s.reach * c.reach;
    p.lift += (0.2 * leapOf(s) + 0.2 * s.legs) * c.air;
    for (const i of [2, 3]) {
      p.legs[i][0] -= (48 - 6 * (i - 2)) * c.reach;
      p.legs[i][1] -= 0.6 * c.reach;
      p.foot[i] -= 40 * c.reach;
    }
    for (const i of [0, 1]) {
      p.legs[i][0] += (62 - 8 * i) * c.reach;
    }
    // Nose up as it leaves the ground and down as it comes in; the neck thrust out and the head driven into the bite.
    p.pitch += c.air * lerp(14, -14, c.u) - 8 * c.land;
    p.neck[0] += 10 * c.reach + 10 * c.bite;
    p.head[0] -= 6 * c.air - 4 * c.land;
    p.squash += 0.14 * c.land - 0.06 * c.air;
  } else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, a shake from nose to tail at the turn, and settled into its new body.
    const up = ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.6, 0.85)), shake = hump(act.t, 0.55, 0.12);
    p.neck[0] -= 16 * up;
    p.head[0] += 12 * up;
    p.pitch += 7 * up;
    p.legs[0][0] += 10 * up;
    p.legs[1][0] += 10 * up;
    p.head[2] += 18 * shake * Math.sin(act.t * 70);
    p.roll += 4 * shake * Math.sin(act.t * 70 + 1);
    p.ears[0][0] += 26 * shake * Math.sin(act.t * 70) - 12 * up;
    p.ears[1][0] -= 26 * shake * Math.sin(act.t * 70) + 12 * up;
    p.squash += 0.1 * hump(act.t, 0.66, 0.06);
  }
}

const mixKey = (a: Key, b: Key, t: number): Key => ({
  lift: lerp(a.lift, b.lift, t), yaw: lerp(a.yaw, b.yaw, t), curl: lerp(a.curl, b.curl, t), tip: lerp(a.tip, b.tip, t),
  wave: lerp(a.wave, b.wave, t), heave: lerp(a.heave, b.heave, t), phase: lerp(a.phase, b.phase, t),
});
const addKey = (a: Key, d: Partial<Key>): Key => ({
  lift: a.lift + (d.lift ?? 0), yaw: a.yaw + (d.yaw ?? 0), curl: a.curl + (d.curl ?? 0), tip: a.tip + (d.tip ?? 0),
  wave: a.wave + (d.wave ?? 0), heave: a.heave + (d.heave ?? 0), phase: a.phase + (d.phase ?? 0),
});

/** A tail's bones carried as `k` says: each link on from the one before, curled by as much, and swung and heaved by a wave running down it. */
function tailBones(T: Tail, body: Xf, k: Key): Xf[] {
  const n = T.links.length, out: Xf[] = [];
  const wave = (q: number, off = 0): number => Math.sin(TAU * (k.phase - q * T.lag) + off) * (1 + T.grow * q / n);
  let prev = joint(body, T.at, -(k.lift + k.heave * wave(0, 1.2) * 0.5), 0, k.yaw + k.wave * wave(0) * 0.5);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(k.curl + (q >= n - 3 ? k.tip : 0) + k.heave * wave(q, 1.2) / n * 2), 0, k.wave * wave(q) / n * 2);
    out.push(prev);
  }
  return out;
}

/** How the tail is carried before any act: swaying and now and then curling its tip as it stands, swaying behind it as it goes. */
function tailCarried(T: Tail, a: Anim): Key {
  const R = T.rest, g = smooth(a.go), w = frac(a.u), run = g * a.gait;
  // Standing: a slow sway, now and then a flick running out to the frond, and the tip curled up and let go. Twelve turns a loop.
  const flick = beat(a.t, [4.1, 10.3, 16.6, 21.1], 1.1) * (1 - g);
  const curl = beat(a.t, [1.6, 12.9], 2.6) * (1 - g);
  let k: Key = addKey(R, {
    yaw: 8 * cyc(a.t, 4) * (1 - g),
    lift: 3 * cyc(a.t, 3, 1) * (1 - g),
    tip: 26 * curl,
    curl: 4 * curl,
    wave: 22 * (1 - g) + 50 * flick,
    heave: 10 * (1 - g),
    phase: (a.t * 12) / LOOP,
  });
  if (g > 0) {
    // Going: a sway from side to side once a stride, a beat behind the body; trailing lower and further out at a run.
    const going: Key = addKey(R, {
      lift: -(R.lift - 6) * run * 0.8,
      curl: -R.curl * 0.8 * run,
      tip: -R.tip * 0.5 * run,
      yaw: 6 * Math.sin(w * TAU + 0.8) * (1 - run),
      wave: 34 + 16 * run,
      heave: 8 + 6 * run,
      phase: w + 0.25,
    });
    k = mixKey(k, going, g);
  }
  return k;
}

/** The tail at the strike: let down low behind as it gathers, its tip twitching, then lashed up as the blow lands. */
function tailStruck(T: Tail, k: Key, t: number): Key {
  const S = BRIAR_STRIKE, R = T.rest;
  const low: Key = { ...k, lift: R.lift - 24, curl: R.curl * 0.5, tip: R.tip + 22 * Math.sin(t * 60), wave: 14, heave: 4, phase: t * 3 };
  const lash: Key = { ...k, lift: R.lift + 22, curl: R.curl + 4, tip: R.tip, wave: 30, heave: 18, phase: t * 3.4 };
  if (t < S.gather) return mixKey(k, low, ramp(t, 0, S.gather * 0.6));
  if (t < S.hit + 0.06) return mixKey(low, lash, ramp(t, S.gather, S.hit + 0.06));
  return mixKey(lash, k, ramp(t, S.hold, 1));
}

/** The tail at its post: held low and still but for the tip twitching, and a lash at the hiss. */
function tailWatching(T: Tail, k: Key, w: ReturnType<typeof workOf>, t: number, kit: boolean): Key {
  const R = T.rest;
  // The kit's straight up and lashing, as a kitten puffed up holds it; the cats' low and still.
  const held: Key = kit ? { ...k, lift: R.lift + 30, curl: 2, wave: 34, heave: 8, phase: t * 3 } : { ...k, lift: R.lift - 16, wave: 8, heave: 3, phase: t * 2 };
  return addKey(mixKey(k, held, w.crouch), {
    tip: 26 * w.crouch * Math.sin(t * 40),
    wave: 40 * w.hiss,
    lift: 10 * w.hiss,
    phase: t * 3 * w.hiss,
  });
}

/**
 * The tail through the pounce: down low and lashing from side to side as it
 * gathers, streamed out behind as it springs, and whipped up as it lands, the
 * wave cracking out to the frond, then let back down.
 */
function tailPounced(T: Tail, k: Key, t: number): Key {
  const C = BRIAR_CAST, R = T.rest;
  const low: Key = { ...k, lift: R.lift - 22, curl: R.curl * 0.4, tip: R.tip + 18, wave: 70, heave: 6, phase: t * 7 };
  const out: Key = { ...k, lift: 14, curl: 1, tip: 0, wave: 16, heave: 6, phase: t * 4 };
  const up: Key = { ...k, lift: R.lift + 30, curl: R.curl + 3, tip: R.tip, wave: 26, heave: 18, phase: t * 3.4 };
  if (t < C.gather) return mixKey(k, low, ramp(t, 0, C.gather * 0.5));
  if (t < C.spring + 0.08) return mixKey(low, out, ramp(t, C.gather, C.spring + 0.08));
  if (t < C.land + 0.08) return mixKey(out, up, ramp(t, C.land - 0.1, C.land + 0.08));
  return mixKey(up, k, ramp(t, C.land + 0.12, 1));
}

/** How far its jaw hangs open, in degrees: at the strike, the hiss at its post, the pounce's bite, and the Thornlance's snarl. */
function jawOf(s: Briar, a: Anim): number {
  const act = a.act, wide = [16, 26, 38][s.stage];
  let open = 0;
  if (act?.kind === 'strike') open = wide * (s.stage === 2 ? Math.max(strikeOf(act.t).reach, 0) * (1 - ramp(act.t, BRIAR_STRIKE.hit + 0.02, BRIAR_STRIKE.hit + 0.08) * 0.6) : hump(act.t, BRIAR_STRIKE.hit, 0.14));
  else if (act?.kind === 'work') open = wide * 0.8 * workOf(act.t, a.go).hiss;
  else if (act?.kind === 'cast') { const c = castOf(act.t); open = wide * Math.max(0.7 * c.air * c.u, (1 - ramp(act.t, BRIAR_CAST.bite - 0.02, BRIAR_CAST.bite + 0.02)) * ramp(act.t, BRIAR_CAST.land - 0.06, BRIAR_CAST.land)); }
  if (s.stage === 2) open = Math.max(open, 10, wide * 0.8 * beat(a.t, BRIAR_SNARLS, 1.6) * (1 - a.go));
  return open;
}

/** The bones of a stage: a body on four paws (`quadBonesOf`), thrown forward in a lunge or carried through a pounce; its tail; a jaw that opens. */
function briarBones(s: Briar): (a: Anim) => Bones {
  const spec = specOf(s), T = TAILS[s.stage];
  const posed = quadBonesOf(spec, (p, a) => briarPose(s, p, a));
  return (a) => {
    const act = a.act;
    let b = posed(act ? { ...a, graze: 0 } : a);
    if (act?.kind === 'strike' && s.stage) b = shifted(b, [0, s.lunge * s.len * strikeOf(act.t).reach * (s.stage === 2 ? 1 : 0.5), 0]);
    if (act?.kind === 'cast') b = shifted(b, [0, leapBack(s, act.t) + s.lunge * s.len * 0.4 * castOf(act.t).bite, 0]);
    // The lower jaw on its hinge under the back of the muzzle.
    b.jaw = joint(b.head, hingeOf(s), -jawOf(s, a));
    let k = tailCarried(T, a);
    if (act?.kind === 'strike') k = tailStruck(T, k, act.t);
    else if (act?.kind === 'work') k = tailWatching(T, k, workOf(act.t, a.go), act.t, !s.stage);
    else if (act?.kind === 'cast') k = tailPounced(T, k, act.t);
    else if (act?.kind === 'evolve') k = addKey(k, { lift: 24 * hump(act.t, 0.4, 0.3), wave: 60 * hump(act.t, 0.55, 0.15), phase: act.t * 6 });
    tailBones(T, b.body, k).forEach((x, q) => { b[`tail${q}`] = x; });
    return b;
  };
}

/* ---- the head ------------------------------------------------------------------------------- */

/** The middle of the skull, in the head's frame: a little up from the neck's end. */
const skullAt = (s: Briar): V3 => [0, 0, s.head.r[2] * 0.3];
/** Where a way out of the middle of the skull meets it, and the way out of it there. */
const onSkull = (s: Briar, dir: V3): { p: V3; n: V3 } => onEgg(skullAt(s), s.head.r, dir);
/** The muzzle's egg: where its middle is, and how wide, long and high it is. */
function muzzleOf(s: Briar): { c: V3; r: V3 } {
  const H = s.head, C = skullAt(s), m = H.muzzle;
  // Out of the front of the skull at its height by as much as half its length at least, so a kit's short muzzle is not lost in its cheeks.
  const front = H.r[1] * Math.sqrt(Math.max(0, 1 - (H.drop / H.r[2]) ** 2));
  return { c: [0, C[1] + Math.max(H.r[1] * 0.56 + m[1] * 0.3, front - m[1] * 0.5), C[2] - H.drop], r: [m[0], m[1], m[2]] };
}

/**
 * The eyes, set on the front of the skull: each a dark rim, an iris, a dark
 * middle and two glints; the kit's big and round and green with a wide dark
 * pupil, the Briarpounce's green and almond, the Thornlance's amber with a
 * slit, under a lid of fur coming down at a slant. All of an eye goes out of
 * sight together when the head is between it and the viewer (`at`).
 */
function eyesOf(s: Briar, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onSkull(s, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, 0.03));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const C = skullAt(s), R = s.head.r;
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size, tall = 1 - 0.3 * E.fierce;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'lid', o), 0.014));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.14, r * 1.16 * tall, 12, 'lid', o), 0.012));
    out.push(onto(disc(p, n, r, r * 1.04 * tall, 12, 'crystal', o), 0.016));
    out.push(onto(disc(add(p, scale(up, -r * 0.15 * tall)), n, r * 0.74, r * 0.6 * tall, 10, 'crystalDark', o), 0.02));
    // A kit's pupil wide and round; a hunter's a tall slit.
    out.push(onto(disc(p, n, r * (0.5 - 0.34 * E.fierce), r * (0.62 - 0.04 * E.fierce) * tall, 8, 'eye', o), 0.024));
    if (E.fierce > 0) {
      const tilt = side * 0.55 * E.fierce, lidUp = unit(add(scale(up, Math.cos(tilt)), scale(across, Math.sin(tilt))));
      const edge = r * tall * (1 - 0.65 * E.fierce);
      out.push(onto(disc(add(p, scale(lidUp, edge + r * 0.62)), n, r * 1.4, r * 0.64, 10, 'coat', { ...o, up: lidUp }), 0.028));
      out.push(onto(disc(add(p, scale(lidUp, edge + r * 0.02)), n, r * 1.36, r * 0.12, 8, 'lid', { ...o, up: lidUp }), 0.032));
    }
    out.push(onto(disc(add(add(p, scale(up, r * 0.34 * tall)), scale(across, side * r * 0.3)), n, r * (0.32 - 0.08 * E.fierce), r * (0.32 - 0.08 * E.fierce), 6, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.38 * tall)), scale(across, -side * r * 0.3)), n, r * 0.13, r * 0.13, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

/**
 * The head: a cat's -- a round skull with full cheeks, a short muzzle pale at
 * its end, a small pink nose and a mouth; a rosy blush on each cheek; on the
 * kit a sage leaf patch on the crown, on the Thornlance a dark streak back
 * from each eye.
 */
function headOf(s: Briar, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), M = muzzleOf(s), m = M.r;
  const skull = orb(C, H.r, n + 2, k + 2, 'coat');
  const cheekC: V3 = [0, C[1] + H.r[1] * 0.2, C[2] - H.r[2] * 0.34], cheekR: V3 = [H.r[0] * 0.55, H.r[1] * 0.6, H.r[2] * 0.5];
  const cheeks = merge(...[1, -1].map((sd) => orb([sd * H.r[0] * 0.46, cheekC[1], cheekC[2]], cheekR, n, k, 'muzzle')));
  const snout = orbAlong(M.c, [0, 1, -0.1], [m[0], m[2], m[1]], n, k, 'muzzle');
  const bridge = orbAlong([0, M.c[1] - m[1] * 0.2, M.c[2] + m[2] * 0.45], [0, 1, -0.2], [m[0] * 0.72, m[2] * 0.6, m[1] * 0.85], n, k, 'coat');
  const nose = orbAlong([0, M.c[1] + m[1] * 0.9, M.c[2] + m[2] * 0.38], [0, 1, 0.4], [m[0] * 0.44, m[0] * 0.28, m[0] * 0.3], 6, 3, 'nose');
  const mouth = s.stage === 0
    ? smile([0, M.c[1] + m[1] * 0.96, M.c[2] - m[2] * 0.22], [0, 1, -0.3], m[0] * 0.85, 'lid')
    : paint([1, -1].map((sd) => {
      const pts = Array.from({ length: 4 }, (_, q) => onEgg(M.c, m, [sd * (0.12 + 1.1 * (q / 3)), 1 - 0.75 * (q / 3), -0.5 - 0.25 * (q / 3)]));
      const v = [...pts.map((e) => add(e.p, scale(e.n, 0.02))), ...[...pts].reverse().map((e) => add(add(e.p, scale(e.n, 0.02)), [0, 0, -m[2] * 0.12]))];
      return { v: sd > 0 ? v : [...v].reverse(), m: 'lid' as Mat };
    }));
  // The inside of the mouth, a dark pink, seen only while the jaw hangs open.
  const throat = orbAlong([0, M.c[1] + m[1] * 0.05, M.c[2] - m[2] * 0.55], [0, 1, 0], [m[0] * 0.8, m[2] * 0.5, m[1] * 0.85], Math.min(n, 6), 3, 'tongue');
  const marks: Disc[] = [];
  for (const sd of [1, -1]) {
    // A rosy blush on each cheek, under the eye.
    const b = onEgg([sd * H.r[0] * 0.46, cheekC[1], cheekC[2]], cheekR, [sd * 0.75, 0.55, 0.35]);
    marks.push(disc(add(b.p, scale(b.n, 0.02)), b.n, H.r[0] * (s.stage ? 0.2 : 0.26), H.r[0] * (s.stage ? 0.13 : 0.17), 8, 'spot'));
    if (s.stage === 2) {
      // A dark streak back from the eye.
      const e = onSkull(s, [sd * 0.86, 0.12, 0.42]);
      marks.push(disc(add(e.p, scale(e.n, 0.018)), e.n, H.r[1] * 0.36, H.r[2] * 0.1, 7, 'coatDark', { up: unit([0, -1, 0.35]), at: add(e.p, scale(e.n, 0.05)) }));
    }
  }
  // Sage on the crown: a leaf-shaped patch, and on the kit a smaller one beside it.
  const crown = onSkull(s, [0.05, -0.05, 1]), crown2 = onSkull(s, [-0.42, 0.2, 0.9]);
  marks.push(disc(add(crown.p, scale(crown.n, 0.02)), crown.n, H.r[0] * 0.3, H.r[1] * 0.22, 7, 'moss', { spin: 0.4 }));
  if (s.stage === 0) marks.push(disc(add(crown2.p, scale(crown2.n, 0.022)), crown2.n, H.r[0] * 0.16, H.r[1] * 0.11, 7, 'mark', { spin: -0.5 }));
  return merge(skull, cheeks, bridge, snout, nose, mouth, throat, paint(marks), eyesOf(s, shut));
}

/** Where the lower jaw hinges, in the head's frame: under the back of the muzzle. */
const hingeOf = (s: Briar): V3 => { const M = muzzleOf(s); return [0, M.c[1] - M.r[1] * 0.6, M.c[2] - M.r[2] * 0.2]; };

/** The lower jaw, on its own bone from its hinge: the underside of the muzzle with a pale chin, and fangs on the cats. */
function jawMesh(s: Briar, n: number, k: number): Mesh {
  const M = muzzleOf(s), m = M.r;
  const c: V3 = [0, M.c[1] + m[1] * 0.06, M.c[2] - m[2] * 0.52];
  const chin = orbAlong(c, [0, 1, -0.05], [m[0] * 0.8, m[2] * 0.42, m[1] * 0.88], Math.min(n, 7), Math.min(k, 4), 'muzzle');
  const fangs = s.stage > 0 && merge(...[1, -1].map((sd) => {
    const at: V3 = [sd * m[0] * 0.45, M.c[1] + m[1] * 0.62, M.c[2] - m[2] * 0.42];
    return tube([at, add(at, [0, 0.02, m[2] * 0.7])], [m[0] * 0.15, 0.006], [m[0] * 0.11, 0.006], 4, 'tooth');
  }));
  const h = hingeOf(s), m0 = merge(chin, fangs);
  return mesh(m0.v.map((v) => sub(v, h)), m0.f);
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the muzzle. */
function headSolids(s: Briar): Array<{ c: V3; r: V3 }> {
  const M = muzzleOf(s);
  return [{ c: skullAt(s), r: scale(s.head.r, 0.9) }, { c: M.c, r: scale(M.r, 0.85) }];
}

/** A big pointed ear, upright, facing forward and cupped: cream outside, its tip blush on the cats, pink inside with a pale tuft at its foot. */
function earOf(s: Briar, n: number): Mesh {
  const { len, w } = s.ear;
  const line0 = curve([0, 0, 0], [0, -0.05, len * 0.5], [0, 0.03, len], 5);
  const ws = [w * 0.7, w * 0.98, w, w * 0.72, w * 0.36, 0.015];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.4 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(line0, ws, ws.map((x) => Math.max(0.025, x * 0.22)), n, (ring) => (s.stage && ring >= 4 ? 'petal' : 'coat'), { up: [0, 1, 0], seam: 'start' });
  const cupped = { ...shell, v: shell.v.map(cup) };
  const side = (sd: number): V3[] => [1, 2, 3, 4].map((q) => cup([sd * ws[q] * 0.66, ws[q] * 0.24 + 0.012, line0[q][2]]));
  const lining = [cup([0, ws[0] * 0.2 + 0.012, line0[0][2] + len * 0.06]), ...side(-1), cup([0, 0.03, len * 0.82]), ...side(1).reverse()];
  const tuft = [cup([-w * 0.32, w * 0.2 + 0.02, len * 0.05]), cup([0, w * 0.22 + 0.02, len * 0.34]), cup([w * 0.32, w * 0.2 + 0.02, len * 0.05])];
  return merge(mesh(cupped.v, cupped.f), paint([{ v: lining, m: 'inner' }, { v: tuft, m: 'coatLight' }]));
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A paw: a soft mitten a little forward of the ankle with three toes on its front, and on the cats a dark claw out of each. */
function pawOf(s: Briar, r: number, drop: number, n: number, k: number, shank = 0): Mesh {
  const toes = merge(...[-1, 0, 1].map((q) => orb([q * r * 0.42, r * 0.95, -drop + r * 0.22], [r * 0.25, r * 0.3, r * 0.22], 5, 3, 'coatLight')));
  const claws = s.stage > 0 && merge(...[-1, 0, 1].map((q) => tube([[q * r * 0.42, r * 1.15, -drop + r * 0.25], [q * r * 0.44, r * 1.4, -drop + r * 0.03]], [r * 0.09, 0.006], [r * 0.08, 0.006], 4, 'claw')));
  const foot = shank > 0 && tube([[0, -shank * 0.3, 0.06], [0, r * 0.1, -drop * 0.5], [0, r * 0.3, -drop + r * 0.55]], [shank, shank * 0.85, shank * 0.8], [shank, shank * 0.85, shank * 0.8], Math.min(n, 7), 'coat', { seam: 'start' });
  return merge(orbAlong([0, r * 0.35, -drop + r * 0.5], [0, 1, 0], [r, r * 0.62, r * 1.25], n, k, 'coatLight'), toes, claws, foot);
}

/**
 * A mesh mottled in sage: of its faces of plain coat, those higher than `z0`
 * (or every one) turned moss or the darker green in drifts of their own,
 * `share` of them; a few of the drifts blush pink on the cats; and those
 * under `belly` the pale of its belly.
 */
function mottled(m: Mesh, share: number, seed: number, z0 = -Infinity, z1 = z0 + 1, belly = -Infinity, pink = 0): Mesh {
  return mesh(m.v, m.f.map((f, q) => {
    if (f.decal || f.m !== 'coat') return f;
    let z = 0, y = 0, x = 0;
    for (const i of f.i) { x += m.v[i][0]; y += m.v[i][1]; z += m.v[i][2]; }
    x /= f.i.length; y /= f.i.length; z /= f.i.length;
    if (z < belly) return { ...f, m: 'belly' as Mat };
    const up = z0 === -Infinity ? 1 : clamp((z - z0) / (z1 - z0));
    const drift = 0.52 + 0.36 * Math.sin(y * 3.4 + seed) * Math.cos(x * 2.9 + z * 2.1 + seed * 2) + 0.18 * jitter(q + seed * 31);
    const k = drift * up;
    if (k <= 1 - share) {
      // A blush of pink in the cream between the patches.
      return pink && drift < 0.3 + pink * 0.18 && up > 0.2 ? { ...f, m: 'shell' as Mat } : f;
    }
    return { ...f, m: (k > 1 - share * 0.3 ? 'mark' : 'moss') as Mat };
  }));
}

/**
 * Its sage patches: overlapping leaf shapes of two greens over its back,
 * shoulders and haunches and down onto the flanks, as its coat is marked.
 */
function patchesOf(s: Briar): Mesh {
  const out: Disc[] = [];
  const spots: Array<[number, number, number, number]> = [[0.62, 1.1, 0.3, 3], [-0.62, 1.05, 0.32, 4], [0.05, 1.3, 0.24, 3], [-0.3, 0.6, 0.22, 2], [0.8, 0.5, 0.2, 2]];
  for (const sd of [1, -1]) {
    spots.forEach(([fy, th, r, count], q) => {
      const y0 = (fy + (sd > 0 ? 0 : 0.12 * (jitter(q) - 0.4))) * s.len * 0.5;
      for (let e = 0; e < count; e++) {
        const id = q * 7 + e + (sd > 0 ? 0 : 50);
        const y = y0 + (jitter(id + 1) - 0.5) * r * s.len * 0.5;
        const ang = th + (jitter(id + 2) - 0.5) * 0.5;
        const at = onRings(s.body, y, ang), { p, n } = sd > 0 ? at : left(at);
        const L = r * s.len * 0.3 * (0.75 + 0.5 * jitter(id + 3));
        const along = unit(sub([0, 1, 0], scale(n, dot([0, 1, 0], n))));
        const tip = unit(add(along, scale(cross(n, along), (jitter(id + 4) - 0.5) * 1.2)));
        out.push(disc(add(p, scale(n, 0.02 + 0.004 * e)), n, L * 0.42, L, 7, e % 3 === 1 ? 'mark' : 'moss', { up: tip }));
      }
    });
  }
  return paint(out);
}

/** A leaf's colour by its number and how many of its row are pink: pink and green by turns, as near that share as goes. */
const pinkAt = (q: number, share: number, id: number): boolean => share > 0 && frac(q * share + 0.5 * jitter(id)) < share;

/** The spray of leaves at its shoulders: each row down both sides (`Briar.spray`), stood up off the barrel and swept back, biggest at the shoulder. */
function sprayOf(s: Briar): Leaf[] {
  const out: Leaf[] = [];
  s.spray.forEach((row, ri) => {
    const ridge = Math.abs(row.th - Math.PI / 2) < 0.01;
    for (const sd of ridge ? [1] : [1, -1]) {
      for (let q = 0; q < row.count; q++) {
        const id = ri * 31 + q * 3 + (sd > 0 ? 0 : 17);
        const f = row.count > 1 ? q / (row.count - 1) : 0.5;
        const y = lerp(row.y1, row.y0, f) + (ridge ? 0.04 * (jitter(id) - 0.5) : 0.12 * (jitter(id + 1) - 0.5));
        const th0 = row.th + (ridge ? 0.22 * (q % 2 ? 1 : -1) : 0.12 * (jitter(id + 2) - 0.5));
        const at0 = onRings(s.body, y, th0), at = sd > 0 ? at0 : left(at0);
        const big = (1.05 - 0.4 * f) * (0.85 + 0.3 * jitter(id + 4));
        const st = (row.stand + 10 * (jitter(id + 5) - 0.5)) * Math.PI / 180;
        const back = unit(sub([0, -1, 0], scale(at.n, dot([0, -1, 0], at.n))));
        const dir = unit(add(scale(at.n, Math.sin(st)), scale(back, Math.cos(st))));
        // On the ridge, turned to face out to one side or the other, so it shows broad side on rather than edge on.
        const face = ridge ? unit([q % 2 ? 1 : -1, 0, 0.45]) : unit(add(at.n, [0, 0, 0.3]));
        out.push({
          root: sub(at.p, scale(at.n, 0.05)), dir, face, len: row.len * big, w: row.w * big, droop: 0.2 + 0.15 * jitter(id + 6),
          pink: pinkAt(q + ri, row.pink, id), dark: jitter(id + 8) < 0.18, flare: unit(add(at.n, [0, 0.25, 0.6])),
        });
      }
    }
  });
  return out;
}

/** Leaves round its neck: a ruff on the kit, lying down over its chest and shoulders; a mane on the cats, swept back and up from behind the head. */
function collarOf(s: Briar): Leaf[] {
  const C = s.collar, out: Leaf[] = [];
  for (let q = 0; q < C.count; q++) {
    // Round the neck from under the chin, both sides, to the back of it; in the neck's frame up it is z and its front is y.
    const f = q / (C.count - 1), th = -Math.PI / 2 + (q % 2 ? 1 : -1) * (0.35 + f * 2.6) + 0.12 * (jitter(q) - 0.5);
    const c = Math.cos(th), sn = Math.sin(th);
    const radial: V3 = [c, -sn, 0];
    const z = s.neck.len * (C.at - 0.25 * jitter(q + 4));
    const root: V3 = [radial[0] * s.neck.w * 0.8, radial[1] * s.neck.w * 0.8, z];
    const behind = clamp((-radial[1] + 0.2) / 1.2);
    // Lying back down the neck (-z), out by `stand`, and swept back toward the nape the further round it is.
    const dir = unit(add(add(scale(radial, 0.3 + C.stand), [0, -0.5 * behind * (s.stage ? 1.6 : 0.4), 0]), [0, 0, s.stage ? -0.5 + 0.9 * behind : -1]));
    const L = C.len * (0.8 + 0.35 * Math.sin(Math.PI * f)) * (0.9 + 0.2 * jitter(q + 9));
    out.push({ root, dir, face: unit(add(radial, [0, 0, 0.4])), len: L, w: C.w * (0.85 + 0.3 * jitter(q + 2)), droop: 0.3, pink: pinkAt(q, C.pink, q + 40), dark: q % 4 === 3, flare: unit(add(radial, [0, 0, 0.5])) });
  }
  return out;
}

/** Out of each cheek: fluff on the kit (in the head), on the cats leaf blades swept back past the jaw, pink and green. */
function frillOf(s: Briar): Leaf[] {
  const [count, L0] = s.cheek, H = s.head, C = skullAt(s), out: Leaf[] = [];
  if (!s.stage) return out;
  const cheekC: V3 = [0, C[1] + H.r[1] * 0.2, C[2] - H.r[2] * 0.34], cheekR: V3 = [H.r[0] * 0.55, H.r[1] * 0.6, H.r[2] * 0.5];
  for (const sd of [1, -1]) {
    for (let q = 0; q < count; q++) {
      const f = count > 1 ? q / (count - 1) : 0;
      const p = onEgg([sd * H.r[0] * 0.46, cheekC[1], cheekC[2]], cheekR, [sd, -0.4 - 0.2 * f, 0.6 - 1.1 * f]);
      const dir = unit(add(p.n, [0, -1.3, 0.3 - 0.8 * f]));
      const L = L0 * (1 - 0.2 * Math.abs(f - 0.4)) * (0.9 + 0.2 * jitter(q + (sd > 0 ? 0 : 7)));
      out.push({ root: sub(p.p, scale(p.n, 0.04)), dir, face: unit(add(p.n, [0, 0, 0.5])), len: L, w: L * 0.3, droop: 0.25, pink: (q + (sd > 0 ? 0 : 1)) % 2 === 0, flare: p.n });
    }
  }
  // The Thornlance's crest: blades out of the crown behind the ears, swept back and up, bristling.
  if (s.stage === 2) {
    for (let q = 0; q < 3; q++) {
      const x = (q - 1) * 0.35, p = onSkull(s, [x, -0.45, 0.9]);
      out.push({ root: sub(p.p, scale(p.n, 0.05)), dir: unit([x * 0.8, -1, 0.75 - 0.15 * Math.abs(x)]), face: unit([q === 1 ? 1 : x, 0, 0.4]), len: L0 * (q === 1 ? 0.75 : 0.6), w: L0 * 0.24, droop: 0.3, pink: q !== 1, flare: unit([x, -0.3, 1]) });
    }
  }
  return out;
}

/** The kit's cheek fluff, in three soft points swept back from each cheek. */
function fluffOf(s: Briar, n: number): Mesh | null {
  if (s.stage) return null;
  const H = s.head, C = skullAt(s);
  const cheekC: V3 = [0, C[1] + H.r[1] * 0.2, C[2] - H.r[2] * 0.34], cheekR: V3 = [H.r[0] * 0.55, H.r[1] * 0.6, H.r[2] * 0.5];
  return merge(...[1, -1].flatMap((sd) => [0, 1, 2].map((q) => {
    const p = onEgg([sd * H.r[0] * 0.46, cheekC[1], cheekC[2]], cheekR, [sd, -0.3 - 0.25 * q, 0.2 - 0.4 * q]);
    const dir = unit(add(p.n, [0, -0.9, -0.1 - 0.2 * q]));
    const L = s.cheek[1] * (1 - 0.18 * q);
    return tube([sub(p.p, scale(p.n, 0.05)), add(p.p, scale(dir, L * 0.5)), add(p.p, scale(dir, L))], [L * 0.34, L * 0.2, 0.01], [L * 0.13, L * 0.08, 0.01], Math.min(n, 4), q === 1 ? 'coat' : 'muzzle', { up: p.n });
  })));
}

/**
 * Leaves on a leg, in its lower bone's frame (down it is -z, forward y): on a fore leg
 * a sheath of them round its front and sides pointing down over the paw, and a tuft at
 * the elbow swept back; on a hind leg a pair on the thigh, swept back.
 */
function sleeveOf(s: Briar, fore: boolean): Leaf[] {
  const out: Leaf[] = [];
  const count = s.sleeve[fore ? 0 : 1];
  const len = (fore ? 0.46 : 0.46) * s.legs, w = s.thick;
  for (let q = 0; q < count; q++) {
    if (fore) {
      // Round the front and outside of the leg, from the elbow down, each overlapping the next, pointing down.
      const th = [0.5, 1.4, -0.2, 0.95, 2.1][q % 5], z = -len * (0.12 + 0.55 * (q / Math.max(1, count - 1)) ** 0.9);
      const radial: V3 = [Math.cos(th), Math.sin(th), 0];
      const L = len * (0.42 + 0.06 * (q % 2)) * (s.stage === 2 ? 1 : 0.85);
      out.push({ root: [radial[0] * w * 0.7, radial[1] * w * 0.7, z], dir: unit(add(scale(radial, 0.32), [0, 0.05, -1])), face: radial, len: L, w: L * 0.3, droop: -0.12, pink: s.stage === 2 && q === count - 1, dark: q % 2 === 1, flare: radial });
    } else {
      const L = s.legs * 0.32;
      out.push({ root: [w * 0.9, 0.02, -0.05 - q * 0.12], dir: unit([0.35, -1, 0.25 - 0.5 * q]), face: [1, 0, 0.2], len: L, w: L * 0.3, droop: 0.25, dark: q % 2 === 1, flare: [1, 0, 0] });
    }
  }
  // The elbow tuft on the Thornlance's fore legs, swept back.
  if (fore && s.stage === 2) {
    for (let q = 0; q < 2; q++) out.push({ root: [w * 0.6, -w * 0.6, -0.02], dir: unit([0.4 - 0.5 * q, -1, 0.1 - 0.3 * q]), face: [1, 0, 0.3], len: s.legs * (0.3 - 0.05 * q), w: s.legs * 0.08, droop: 0.2, pink: q === 1, flare: [0.6, -0.4, 0.3] });
  }
  return out;
}

/** The tail's links: a thin cat's tail mottled in sage, and at its tip a frond of leaves fanned out from the last link, pink and green. */
function tailOf(s: Briar, n: number): { links: Mesh[]; frond: LeafSet } {
  const T = TAILS[s.stage], N = T.links.length;
  const links = T.links.map((L, q) => {
    const w0 = T.w[q], w1 = T.w[Math.min(q + 1, N - 1)];
    return tube([[0, 0.05, 0], [0, -L - 0.05, 0]], [w0, w1], [w0, w1], Math.min(n, 6), (ring, j) => {
      const k = jitter(q * 13 + ring * 7 + j * 3.1);
      return k < 0.32 ? 'moss' : k < 0.4 ? 'mark' : 'coat';
    }, { seam: 'both' });
  });
  const F = T.frond, L = T.links[N - 1], list: Leaf[] = [];
  for (let q = 0; q < F.count; q++) {
    // A plume in the plane the tail curls in, so it shows broad from the side: leaves off either side of the last links by
    // turns, angled out and on along it, bigger toward the end, and the biggest straight on from the tip.
    const u = F.count > 1 ? q / (F.count - 1) : 1, last = q === F.count - 1;
    const sd = q % 2 ? 1 : -1, big = 0.6 + 0.4 * u;
    const dir: V3 = last ? [0, -1, 0.08] : unit([sd * 0.12, -1, sd * 0.85 * (1 - 0.4 * u)]);
    list.push({ root: [0, -L * (0.15 + 0.85 * u), 0], dir, face: unit([1, 0, sd * 0.2]), len: F.len * big, w: F.w * big, droop: 0.18 * sd, pink: pinkAt(q, F.pink, q + 70), dark: q === 1 && F.count > 3, flare: last ? [0, -1, 0] : unit([0, -0.4, sd]) });
  }
  return { links, frond: leaves(list) };
}

/** How its leaves are stirring and flaring this moment: in a gust now and then standing, all the time going, and at each of its moves. */
function rustleOf(s: Briar, a: Anim): { stir: number; flare: number; ph: number } {
  const gust = beat(a.t, [2.3, 9.1, 14.8, 20.4], 1.6) * (1 - a.go);
  let stir = 0.035 + 0.05 * gust + a.go * (0.05 + 0.05 * a.gait), flare = 0;
  const act = a.act;
  if (act?.kind === 'strike') stir += 0.1 * hump(act.t, BRIAR_STRIKE.hit + 0.05, 0.25);
  else if (act?.kind === 'work') { const w = workOf(act.t, a.go); flare += (s.stage ? 0.18 : 0.4) * w.crouch + 0.15 * w.hiss; stir += 0.04 * w.crouch; }
  else if (act?.kind === 'cast') { const c = castOf(act.t); flare += c.flare; stir += 0.06 * c.gather + 0.12 * c.land + 0.06 * c.air; }
  else if (act?.kind === 'evolve') stir += 0.1 * hump(act.t, 0.55, 0.2);
  return { stir, flare, ph: a.go > 0 ? frac(a.u) * 2 : a.t * 1.5 };
}

/** Its back bent through a bound and a pounce (`flexOf`): every corner lifted by as much as its place along the body says. */
function arched(s: Briar): (p: V3, a: Anim) => V3 {
  const half = s.body.y[s.body.y.length - 1];
  return (p, a) => {
    const arch = flexOf(s, a);
    return arch ? [p[0], p[1], p[2] + arch * Math.max(0, 1 - (p[1] / half) ** 2)] : p;
  };
}

/** A stage's pieces: a cat's body (`quadPieces`) with its own head, jaw, ears, paws and tail, its sage patches and its leaves. */
function briarBuild(s: Briar, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6);
  const skull = headSolids(s)[0], spec = specOf(s), w = s.thick;
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh } => {
    const L = (fore ? 0.5 : 0.46) * s.legs;
    return { upper: [fore ? 0.26 : 0.1, -L, w * (fore ? 1.6 : 1.9), w * 1.05], lower: [0, -(fore ? 0.46 : 0.42) * s.legs, w, w * 0.8], foot: pawOf(s, s.paw, fore ? s.paw * 0.55 : hock(s), n, k, fore ? 0 : w * 0.75) };
  };
  // Shoulders and haunches, part of the barrel: a mass over each leg reaching down to where it comes out from under the body.
  const quarters = merge(...[1, -1].flatMap((sd) => {
    const hip = spec.hind.at, sh = spec.fore.at;
    return [
      orb([sd * (hip[0] + w * 0.15), hip[1] + 0.02, hip[2] + 0.16], [w * 1.25 + 0.08, w * 1.7 + 0.12, s.body.h[2] * 0.55], n, k, 'coat'),
      orb([sd * (sh[0] + w * 0.1), sh[1] - 0.02, sh[2] + 0.2], [w * 1.05 + 0.08, w * 1.35 + 0.1, s.body.h[4] * 0.5], n, k, 'coat'),
    ];
  }));
  const arch = arched(s), rustle = (a: Anim): { stir: number; flare: number; ph: number } => rustleOf(s, a);
  const still = (a: Anim): { stir: number; flare: number; ph: number } => ({ ...rustleOf(s, a), stir: 0 });
  const spray = s.spray.length ? leaves(sprayOf(s)) : null;
  const collar = leaves(collarOf(s));
  const frill = s.stage ? leaves(frillOf(s)) : null;
  const tail = tailOf(s, n);
  const pieces = quadPieces({
    n, k,
    body: { ...s.body, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.95, len: s.neck.len },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -40,
    tail: [],
    fore: legs(true),
    hind: legs(false),
    breath: 0.04,
    extras: [
      ...(spray ? [{ key: 'spray', mesh: spray.mesh, bone: 'trunk', bias: 0.1, after: ['body', 'neck'], bent: stirred(spray, rustle, arch) } as Piece] : []),
      // The kit's ruff lies over its chest and goes over the neck and body; the cats' mane goes under the head.
      { key: 'collar', mesh: collar.mesh, bone: 'neck', bias: 0.12, after: ['neck', 'body'], under: s.stage ? ['head'] : undefined, bent: stirred(collar, rustle) },
      ...(frill ? [{ key: 'frill', mesh: frill.mesh, bone: 'head', bias: 0.19, after: ['collar'], under: ['head'], bent: stirred(frill, rustle) } as Piece] : []),
      { key: 'jaw', mesh: jawMesh(s, n, k), bone: 'jaw', bias: 0.19, under: ['head'], hide: [skull], hideIn: 'head' },
    ],
  });
  const N = tail.links.length;
  tail.links.forEach((m, q) => pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.05 + q * 0.004, chain: 'tail' }));
  pieces.push({ key: 'frond', mesh: tail.frond.mesh, bone: `tail${N - 1}`, bias: -0.05 + N * 0.004 + 0.01, after: [`tail${N - 1}`], bent: stirred(tail.frond, still) });
  // Leaves on the legs, each set on its leg's bone, in front of the body or behind it as the leg is.
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const list = sleeveOf(s, fore);
    if (!list.length) continue;
    const set = leaves(list);
    const m = side < 0 ? mirrored(set.mesh) : set.mesh;
    const mv = side < 0 ? Float32Array.from(set.move, (x, i) => (i % 3 === 0 ? -x : x)) : set.move;
    const bone = `${key}${fore ? 1 : 0}`;
    pieces.push({ key: `${key}leaf`, mesh: m, bone, bias: 0.035, after: [bone], front: [side * 0.7, fore ? 0.7 : -0.7, 0], bent: stirred({ mesh: m, move: mv }, rustle) });
  }
  const fluff = fluffOf(s, n);
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: merge(headOf(s, n, k, false), fluff), shut: merge(headOf(s, n, k, true), fluff), hide: headSolids(s) };
    // Sage over its back and down its flanks in drifts, cream under it, a blush of pink between on the cats.
    if (pc.key === 'body') return { ...pc, mesh: merge(mottled(merge(pc.mesh, quarters), s.stage ? 0.42 : 0.38, 3, -0.15, s.body.h[3] * 0.9, -s.body.h[3] * 0.45, s.stage ? 0.5 : 0), patchesOf(s)), bent: (v, a) => v.map((p) => arch(p, a)) };
    if (pc.key === 'neck') return { ...pc, mesh: mottled(pc.mesh, 0.4, 5, -0.2 * s.neck.w, 0.6 * s.neck.w) };
    // Sage on the thighs and shoulders, and on the lower legs in patches; on the Thornlance's hind legs a darker green.
    if (/^[fh][lr]0$/.test(pc.key)) return { ...pc, mesh: mottled(pc.mesh, s.stage ? 0.5 : 0.4, pc.key.charCodeAt(0) + pc.key.charCodeAt(1), -s.legs * 0.3, 0.2) };
    // The Thornlance's hind legs a dark grey-green below the hock, as its fore legs are sheathed in leaves.
    if (s.stage === 2 && /^h[lr][12]$/.test(pc.key)) return { ...pc, mesh: recoloured(pc.mesh, 'coat', 'coatDark') };
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const DUST: RGB = [176, 166, 140];
/** A leaf shaken loose: sage, a darker sage, blush pink, the same on every variant. */
const LOOSE: readonly RGB[] = [[150, 176, 112], [104, 134, 86], [238, 156, 170]];

/** A soft puff of dust at a point, `r` across. */
function dust(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  if (al <= 0.01) return;
  const [x, y] = onScreen(view, at);
  g.fillStyle = css(DUST, al);
  g.beginPath();
  g.ellipse(x, y - r * 0.15, r, r * 0.5, 0, 0, TAU);
  g.fill();
}

/** A loose leaf in the air, `r` long, turned `ang`, tumbling: a pointed oval with a rib down it. */
function looseLeaf(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  const ca = Math.cos(ang), sa = Math.sin(ang), wide = r * 0.38 * Math.abs(Math.cos(ang * 2.3));
  g.fillStyle = css(c, al);
  g.beginPath();
  g.moveTo(x - ca * r, y - sa * r);
  g.quadraticCurveTo(x - sa * wide * 2, y + ca * wide * 2, x + ca * r, y + sa * r);
  g.quadraticCurveTo(x + sa * wide * 2, y - ca * wide * 2, x - ca * r, y - sa * r);
  g.fill();
  g.strokeStyle = css(darker(c, 0.35), al);
  g.lineWidth = Math.max(0.05, r * 0.14);
  g.stroke();
}

/** Where something thrown from `p` with velocity `v` is `s` seconds on, drifting down as a leaf does. */
const drifted = (p: V3, v: V3, s: number): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 8 * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/**
 * The streak a claw leaves in the air as the strike lands: three pale curved
 * strokes along the swipe, down and forward past the swiping paw, gone in a
 * moment. Drawn in front of everything.
 */
function streak(g: CanvasRenderingContext2D, view: View, s: Briar, b: Bones, t: number): void {
  const S = BRIAR_STRIKE, k = hump(t, S.hit + 0.02, 0.11);
  if (k <= 0.01) return;
  const big = s.size * (1 + s.stage * 0.4) / 1.9;
  const paw = place(b.fl2, [0, s.paw, 0]);
  const [px, py] = onScreen(view, paw);
  // Which way forward and up are on the screen, at the paw.
  const [fx, fy] = onScreen(view, place(b.body, [0, 1, 0])), [cx, cy] = onScreen(view, b.body.t);
  let ax = fx - cx, ay = fy - cy;
  const al = Math.hypot(ax, ay) || 1;
  ax /= al;
  ay /= al;
  const r = (0.9 + 0.5 * s.stage) * big;
  g.lineCap = 'round';
  for (let q = 0; q < 3; q++) {
    const o = (q - 1) * 0.22 * r, nx = -ay, ny = ax;
    // An arc from above and behind the paw, over, to in front of and below it.
    const x0 = px - ax * r * 0.7 + nx * o, y0 = py - r * 0.9 + ny * o;
    const x2 = px + ax * r * 0.55 + nx * o, y2 = py + r * 0.15 + ny * o;
    const x1 = px + ax * r * 0.35 + nx * o, y1 = py - r * 0.7 + ny * o;
    g.strokeStyle = css(q === 1 ? [255, 252, 246] : [255, 214, 214], 0.9 * k);
    g.lineWidth = r * (q === 1 ? 0.13 : 0.09);
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x1, y1, x2, y2);
    g.stroke();
  }
}

/**
 * Leaves shaken off it, and dust: as the pounce lands, a puff where its fore
 * paws come down and a burst of pink and green leaves off its shoulders; as a
 * strike lands, a few leaves off it; and as it springs, a few left behind it.
 */
function scatter(g: CanvasRenderingContext2D, view: View, s: Briar, b: Bones, a: Anim, front: boolean): void {
  const act = a.act;
  if (!act || (act.kind !== 'strike' && act.kind !== 'cast')) return;
  if (act.kind === 'strike' && front) streak(g, view, s, b, act.t);
  const pounce = act.kind === 'cast', t0 = pounce ? BRIAR_CAST.land : BRIAR_STRIKE.hit;
  const mid = b.body.t, big = s.size * (1 + s.stage * 0.4) / 1.9;
  if (pounce && act.t > BRIAR_CAST.spring && act.t < BRIAR_CAST.land + 0.1) {
    // Shed as it springs: a few leaves left hanging in the air where it left the ground, falling.
    // Where it left the ground: the leap behind where the body is, as far as it has come since.
    const since = (act.t - BRIAR_CAST.spring) * ACT_SECS.cast, from = place(b.body, [0, leapBack(s, BRIAR_CAST.spring) - leapBack(s, act.t) - s.len * 0.2, 0.2 - b.body.t[2] + s.body.h[3]]);
    for (let q = 0; q < 3; q++) {
      const p = drifted(add(from, [0, 0, 0]), [(jitter(q + 21) - 0.5) * 2 * big, (jitter(q + 22) - 0.7) * big, 1 + jitter(q + 23)], since);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      looseLeaf(g, x, y, (0.3 + 0.12 * jitter(q + 2)) * big, q * 2.1 + since * 7, LOOSE[q % 3], 1 - smooth((since - 0.2) / 0.2));
    }
  }
  if (act.t < t0) return;
  const since = (act.t - t0) * ACT_SECS[act.kind];
  const paws: V3 = scale(add(place(b.fl2, [0, 0, 0]), place(b.fr2, [0, 0, 0])), 0.5);
  const ground: V3 = [paws[0], paws[1] + s.paw, 0.05];
  if (pounce && front === nearSide(ground, mid, view)) dust(g, view, add(ground, [0, 0, 0.5 * since]), (0.6 + 2.6 * since) * big, 0.45 * (1 - smooth(since / 0.32)));
  const from = place(b.body, [0, s.len * 0.35, s.body.h[4] + 0.1]);
  const count = pounce ? 10 : 4;
  for (let q = 0; q < count; q++) {
    const ang = jitter(q + 3) * TAU, sp = (3.5 + 4 * jitter(q + 9)) * big;
    const p = drifted(from, [Math.cos(ang) * sp, Math.sin(ang) * sp, (3 + 4 * jitter(q + 5)) * big], since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    looseLeaf(g, x, y, (0.32 + 0.14 * jitter(q + 1)) * big, q * 1.9 + since * 9 * (q % 2 ? 1 : -1), LOOSE[q % 3], 1 - smooth((since - 0.3) / 0.25));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the leaves it throws about as it strikes and pounces. */
function briarKind(s: Briar): Kind {
  return {
    bones: briarBones(s),
    build: (lod) => briarBuild(s, lod),
    // The variant's coat is its fur and its markings its sage; the leaves are the sage made leafier, the petals a blush pink
    // warmed toward the fur, the eyes green on the kit and the Briarpounce and amber on the Thornlance.
    palette: (coat, mark) => {
      const fur = mix(pastel(coat, 40), coat, 0.75);
      const sage = mix(pastel(mark, 100), mark, 0.85), leafC = mix(mix(sage, [150, 182, 112], 0.2), [255, 255, 240], 0.18);
      // Warm, so that in the shade the underside of a petal is in, cooled, it is still a pink rather than a mauve.
      const pink = mix([255, 174, 160], fur, 0.1);
      return coatPalette(coat, mark, {
        coat: fur,
        coatLight: mix(fur, [255, 252, 244], 0.45),
        coatDark: mix(darker(sage, 0.25), [120, 118, 120], 0.3),
        belly: mix(fur, [255, 251, 242], 0.4),
        muzzle: mix(fur, [255, 252, 244], 0.4),
        mark: darker(sage, 0.16),
        moss: sage,
        leaf: leafC,
        leafDark: darker(leafC, 0.26),
        petal: pink,
        cap: mix(pink, [255, 246, 240], 0.32),
        stem: mix(leafC, [250, 252, 236], 0.3),
        shell: mix(fur, pink, 0.42),
        spot: [240, 150, 160],
        inner: [240, 162, 172],
        nose: [214, 120, 130],
        lid: [80, 56, 58],
        eye: [34, 28, 30],
        crystal: s.stage === 2 ? [226, 168, 70] : [126, 178, 92],
        crystalDark: s.stage === 2 ? [176, 116, 44] : [78, 128, 64],
        claw: s.stage ? [70, 58, 62] : [236, 220, 214],
        tooth: [250, 246, 236],
        tongue: [200, 92, 110],
      }, 40);
    },
    shadow: [s.len * 0.8, s.body.w[4] * 1.05],
    stride: 1.2,
    size: s.size,
    leaps: [false, true],
    acts: ['strike', 'work', 'cast'],
    extra: (g, view, b, a, under) => scatter(g, view, s, b, a, !under),
  };
}

export const BLUSHKIT = briarKind(BLUSHKIT_LOOK);
export const BRIARPOUNCE = briarKind(BRIARPOUNCE_LOOK);
export const THORNLANCE = briarKind(THORNLANCE_LOOK);
