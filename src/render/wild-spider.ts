import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, smile, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The spider line: the Sprindle, a small round fluffy spider dressed in
 * leaves -- a big cream face with big glossy black eyes, two small dots over
 * them and brown fluffy cheeks, fox ears tipped with leaf, a crest of green
 * leaves over its head and back, eight short legs banded brown, cream and
 * green, and a ball of cream yarn held in its forepaws with loose thread
 * trailing on the ground; which grows into the Webloom, bigger, its crest of
 * leaves larger and starred with small white flowers, long jointed legs in
 * leafy bands, threads draped between them, and a big spindle wound with
 * cream silk; and then the Silkward, large, a huge round abdomen behind it
 * woven brown and cream under big green leaves and a flower, long braided
 * legs, a leaf cap on its head, cream silk swags and tassels hung all over
 * it, and a frame of four posts standing up over its back strung with
 * drooping silk like a canopy of web. The species is still `ulva`
 * underneath, as saves and the database know it: it spins the settlement's
 * fibre into yarn at its spindles.
 *
 * Each is its variant's coat in its brown fur and the bands of its legs, and
 * its markings in the cream of its face, its belly and the other bands; its
 * leaves, flowers, silk, yarn and wood are the same on every variant. All
 * three are built by one set of functions from a description of the stage
 * (`Spider`), the way the bee line is (`./wild-bee`): each of its eight legs
 * bent to put its foot where it is to be, its forepaws bent to put their
 * paws on what it carries, and what it carries posed level, whatever the
 * body does. It walks on its eight legs in two sets of four, the first leg
 * on one side with the second on the other and so on, each set down while
 * the other swings.
 *
 * Silk is too fine to be a facet: the threads -- trailing from the yarn, from
 * the spindle, draped between the legs and strung over the Silkward's posts
 * -- are drawn by hand (`Kind.extra`), each a thin cream line inked in a
 * soft brown, those away from the viewer under the body and the rest over
 * it, and fewer of them drawn small. The tassels and the swags round the
 * Silkward's abdomen are solid, and hang plumb.
 *
 * At its task the Sprindle winds thread off a little spindle stand onto its
 * yarn ball, turning the ball in its paws; the Webloom lets its spindle down
 * on a thread from a raised front leg, sets it twirling with a flick of its
 * paw and catches it again;
 * the Silkward reaches up into its canopy and draws silk up into it twice,
 * and a skein let down on a thread from a post drops to the ground
 * (`SPIDER_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** A pair of legs, on the right: its hip in the body's frame, its two lengths and thickness, and where its foot stands (out, ahead) on the ground. */
interface Leg { at: V3; len: [number, number]; w: number; foot: [number, number] }

interface Spider {
  stage: 0 | 1 | 2;
  size: number;
  /** How high the middle of its body is carried. */
  high: number;
  /** The body's half-sizes: the fluffy middle the legs come out of. */
  body: V3;
  /** The abdomen: its middle in the body's frame, its half-sizes, and how far its back end is lifted (degrees). */
  abd: { at: V3; r: V3; lift: number };
  /** The head: its middle in the body's frame, its half-sizes, its eyes' size. */
  head: { at: V3; r: V3; eye: number };
  /** An ear's length and width. */
  ear: [number, number];
  /** Leaves standing up off its crown: how many, how long, how wide; one is a cap lying forward over its brow. */
  crown: { count: number; len: number; w: number; cap: boolean };
  /** Leaves lying back over its back and abdomen: rows, leaves in the first row, how long, how wide, how far their tips lift. */
  cloak: { rows: number; count: number; len: number; w: number; lift: number };
  /** Small white flowers among its leaves. */
  flowers: number;
  legs: readonly [Leg, Leg, Leg, Leg];
  /** Its legs' dress: fluffy bands; long and banded in leaves; braided. */
  dress: 'stripe' | 'leafy' | 'braid';
  /** The forepaws: shoulder in the body's frame, two lengths, thickness. */
  palp: { at: V3; len: [number, number]; w: number };
  /**
   * What it carries: a ball of yarn, a spindle, nothing. Where it is held, in the frame of the body carried level, and turned
   * (pitch, roll, yaw); its size: the ball's radius, or the spindle's radius, half-length and the cop's radius.
   */
  carry: 'ball' | 'spindle' | 'none';
  prop: { at: V3; turn: V3; r: V3 };
  /** How big the cream ruff under its chin is, against its head. */
  ruff: number;
  /** The posts over its back: how high over the top of its abdomen, how thick; none for none. */
  frame: { h: number; w: number } | null;
  /** Tassels of silk at its knees and round its abdomen. */
  tassels: boolean;
  gait: { duty: [number, number]; swing: [number, number]; step: number; bob: number };
}

/** A Sprindle: small and round, its head most of it, short banded legs, a ball of yarn. */
const SPRINDLE_LOOK: Spider = {
  stage: 0,
  size: 5.4,
  high: 0.34,
  body: [0.3, 0.3, 0.25],
  abd: { at: [0, -0.27, 0.07], r: [0.27, 0.26, 0.23], lift: 10 },
  head: { at: [0, 0.2, 0.13], r: [0.31, 0.27, 0.28], eye: 0.088 },
  ear: [0.23, 0.13],
  crown: { count: 3, len: 0.3, w: 0.13, cap: false },
  cloak: { rows: 3, count: 4, len: 0.3, w: 0.13, lift: 0.3 },
  flowers: 0,
  legs: [
    { at: [0.19, 0.11, -0.1], len: [0.16, 0.19], w: 0.058, foot: [0.34, 0.3] },
    { at: [0.24, 0.0, -0.11], len: [0.17, 0.2], w: 0.06, foot: [0.45, 0.07] },
    { at: [0.24, -0.12, -0.11], len: [0.17, 0.2], w: 0.06, foot: [0.45, -0.2] },
    { at: [0.19, -0.23, -0.09], len: [0.16, 0.19], w: 0.058, foot: [0.35, -0.44] },
  ],
  dress: 'stripe',
  palp: { at: [0.12, 0.27, -0.12], len: [0.1, 0.1], w: 0.042 },
  carry: 'ball',
  prop: { at: [0.08, 0.5, -0.18], turn: [0, 0, 0], r: [0.15, 0.15, 0.15] },
  ruff: 0.6,
  frame: null,
  tassels: false,
  gait: { duty: [0.6, 0.5], swing: [0.3, 0.36], step: 0.34, bob: 0.025 },
};

/** A Webloom: bigger, a larger crest with flowers in it, long jointed legs in leafy bands, a spindle wound with silk. */
const WEBLOOM_LOOK: Spider = {
  stage: 1,
  size: 7.0,
  high: 0.56,
  body: [0.34, 0.35, 0.28],
  abd: { at: [0, -0.4, 0.1], r: [0.36, 0.4, 0.32], lift: 10 },
  head: { at: [0, 0.29, 0.12], r: [0.3, 0.27, 0.28], eye: 0.08 },
  ear: [0.24, 0.12],
  crown: { count: 5, len: 0.36, w: 0.14, cap: false },
  cloak: { rows: 3, count: 5, len: 0.4, w: 0.15, lift: 0.3 },
  flowers: 5,
  legs: [
    { at: [0.21, 0.15, -0.08], len: [0.42, 0.52], w: 0.058, foot: [0.6, 0.6] },
    { at: [0.27, 0.02, -0.08], len: [0.44, 0.54], w: 0.06, foot: [0.82, 0.18] },
    { at: [0.27, -0.13, -0.08], len: [0.44, 0.54], w: 0.06, foot: [0.82, -0.3] },
    { at: [0.21, -0.27, -0.06], len: [0.42, 0.52], w: 0.058, foot: [0.6, -0.78] },
  ],
  dress: 'leafy',
  palp: { at: [0.12, 0.33, -0.14], len: [0.19, 0.19], w: 0.045 },
  carry: 'spindle',
  prop: { at: [0.02, 0.64, -0.2], turn: [6, 0, 64], r: [0.032, 0.3, 0.14] },
  ruff: 0.8,
  frame: null,
  tassels: false,
  gait: { duty: [0.6, 0.5], swing: [0.26, 0.3], step: 0.22, bob: 0.02 },
};

/** A Silkward: large, a huge woven abdomen, long braided legs, a leaf cap, silk swags and tassels, a canopy of posts. */
const SILKWARD_LOOK: Spider = {
  stage: 2,
  size: 7.0,
  high: 0.62,
  body: [0.42, 0.42, 0.34],
  abd: { at: [0, -0.74, 0.42], r: [0.66, 0.68, 0.6], lift: 6 },
  head: { at: [0, 0.48, 0.12], r: [0.5, 0.43, 0.45], eye: 0.125 },
  ear: [0.36, 0.18],
  crown: { count: 0, len: 0.42, w: 0.2, cap: true },
  cloak: { rows: 2, count: 5, len: 0.6, w: 0.25, lift: 0.08 },
  flowers: 2,
  legs: [
    { at: [0.28, 0.2, -0.06], len: [0.58, 0.7], w: 0.1, foot: [0.88, 0.86] },
    { at: [0.36, 0.04, -0.06], len: [0.62, 0.74], w: 0.105, foot: [1.12, 0.28] },
    { at: [0.36, -0.14, -0.06], len: [0.62, 0.74], w: 0.105, foot: [1.12, -0.42] },
    { at: [0.28, -0.3, -0.04], len: [0.58, 0.7], w: 0.1, foot: [0.86, -1.02] },
  ],
  dress: 'braid',
  palp: { at: [0.15, 0.42, -0.18], len: [0.17, 0.17], w: 0.065 },
  carry: 'none',
  prop: { at: [0, 0.6, -0.3], turn: [0, 0, 0], r: [0.1, 0.1, 0.1] },
  ruff: 1.25,
  frame: { h: 0.24, w: 0.07 },
  tassels: true,
  gait: { duty: [0.62, 0.52], swing: [0.22, 0.26], step: 0.2, bob: 0.015 },
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
/** A frame made `k` times bigger, near nought for a thing not there. */
const scaled = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k), m = x.m; return { m: m.map((v) => v * q) as Xf['m'], t: x.t }; };
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
/**
 * Each face's material chosen from where its middle is: a coat in patches. The middle of its box rather than of its corners, so
 * the triangles of one band of a ball, two corners down and one up by turns, all have the band's own middle and a patch's edge
 * runs along the band rather than zigzagging across it.
 */
function painted(m: Mesh, f: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((face) => {
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    for (const i of face.i) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], m.v[i][j]); hi[j] = Math.max(hi[j], m.v[i][j]); }
    return { ...face, m: f(scale(add(lo, hi), 0.5)) };
  }));
}
/** Where a point is round an egg, as a way out of a ball: the egg's own `(C, R)` undone. */
const dirIn = (C: V3, R: V3, p: V3): V3 => unit([(p[0] - C[0]) / R[0], (p[1] - C[1]) / R[1], (p[2] - C[2]) / R[2]]);
/**
 * A tuft of fur: a soft lobe out from `p` along `d`, `len` long and `w` across, round rather than a cone, so fur is fuzzy at its
 * outline and not a scatter of lit shards.
 */
const tuft = (p: V3, d: V3, len: number, w: number, m: Mat, n = 5): Mesh => orbAlong(add(p, scale(unit(d), len * 0.42)), d, [w * 0.62, w * 0.5, len * 0.58], n, 3, m);

/** A patch painted onto the egg `(C, R)` round the way `dir`, `rx` by `ry`, turned `spin`, following its curve. */
function patchOn(C: V3, R: V3, dir: V3, rx: number, ry: number, mat: Mat, spin = 0, lift = 0.012, sides = 12): Disc {
  const e = onEgg(C, R, dir), d = disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, sides, mat, { spin, at: add(e.p, scale(e.n, -0.02)) });
  return { ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); }) };
}

/** Faces wound so each looks the way it should, whichever way round its corners were listed. */
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

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's pounce lands, as a share of its strike. */
export const SPIDER_HITS: readonly number[] = [0.5, 0.52, 0.56];
/**
 * A go at its task, as shares of it. The Sprindle's three turns of its yarn ball, each drawing thread off the stand's spindle
 * (`wind`, `wind2`, `wind3`). The Webloom's spindle let down on its thread (`drop`), flicked twirling (`flick`) and caught
 * (`catch`). The Silkward's two draws of silk up into its canopy (`draw`, `draw2`), the skein let fall (`fall`) and landing
 * (`land`).
 */
export const SPIDER_WORK = {
  wind: 0.26, wind2: 0.46, wind3: 0.66,
  drop: 0.18, flick: 0.28, catch: 0.74,
  draw: 0.24, draw2: 0.44, fall: 0.6, land: 0.72,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** Each leg's key, left then right of each pair from the front: the names a stride is measured by (`gaitOf`). */
const KEYS = ['fl', 'fr', 'bl', 'br', 'll', 'lr', 'hl', 'hr'] as const;
const pairOf = (q: number): number => q >> 1;
const sideOf = (q: number): number => (q & 1 ? 1 : -1);
/** Which of its two sets of four a leg steps with: the first left with the second right and the third left, and so on. */
const setOf = (q: number): number => (pairOf(q) + (q & 1)) % 2;

/**
 * A pose: where each foot is, how the body is carried, the head and ears, the abdomen, the forepaws, and what it carries (in the
 * frame of the body carried level) and how far it has been spun.
 */
interface Plan {
  at: V3[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number;
  /** The head nose-up, turned to its left, tilted; each ear flicked back. */
  head: V3; ears: number[];
  /** The abdomen lifted (degrees, its end up), turned to its left, rolled; swollen as it breathes. */
  abd: V3; pump: number;
  /** Where each forepaw is when it is off what it carries (the level frame), and how much it is on it. */
  hand: V3[]; on: number[];
  /** What it carries: where (the level frame), turned (pitch, roll, yaw), and spun about its own axis. */
  prop: V3; turnP: V3; spin: number;
}

/** Every number of two like things put together by `f`: how plans are mixed. */
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

/** How high a foot's tip is over the ground, standing. */
const tipH = (L: Leg): number => L.w * 0.3;
/** How far a middle leg reaches, hip to tip. */
const reachOf = (s: Spider): number => s.legs[1].len[0] + s.legs[1].len[1];

/** Each foot standing, on the ground out round it. */
const restFeet = (s: Spider): V3[] => KEYS.map((_, q) => { const L = s.legs[pairOf(q)]; return [sideOf(q) * L.foot[0], L.foot[1], tipH(L)] as V3; });

/** Where a forepaw hangs when it holds nothing, in the level frame: tucked in under its chin. */
function pawRest(s: Spider, i: number): V3 {
  const A = s.palp, sd = i ? 1 : -1;
  return add([sd * A.at[0], A.at[1], A.at[2]], [sd * 0.03, (A.len[0] + A.len[1]) * 0.5, -(A.len[0] + A.len[1]) * 0.45]);
}

/** How it stands with nothing going on: on its eight feet, what it carries held in its forepaws. */
function restPlan(s: Spider): Plan {
  const holds = s.carry !== 'none' ? 1 : 0;
  return {
    at: restFeet(s),
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0,
    head: [0, 0, 0], ears: [0, 0],
    abd: [0, 0, 0], pump: 0,
    hand: [pawRest(s, 0), pawRest(s, 1)], on: [holds, holds],
    prop: [...s.prop.at], turnP: [...s.prop.turn], spin: 0,
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
 * Going: on its eight legs in two sets of four, each foot swept back under it at the ground's own speed and then lifted high
 * and brought forward, a spider's knee up; the body carried level with a little bob at each footfall, the abdomen swaying
 * after it, the ears laid back a little, what it carries held still.
 */
function goingPlan(s: Spider, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s), R = restFeet(s);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = reachOf(s), half = L * amp;
  for (let q = 0; q < 8; q++) {
    const A = R[q], ph = frac(a.u + 0.5 * setOf(q));
    if (ph < duty) {
      p.at[q] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.3 * g);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    p.at[q] = [A[0] * (1 - 0.08 * Math.sin(Math.PI * u)), y, A[2] + lift * Math.sin(Math.PI * u)];
  }
  const step2 = Math.sin(2 * TAU * w);
  p.H += -G.bob * L * step2 + g * L * 0.04;
  p.roll = 2 * Math.sin(TAU * w);
  p.yaw = 2 * Math.cos(TAU * w);
  p.pitch = -2 - 2 * g;
  p.abd = [-3 * g + 2 * step2, -7 * Math.sin(TAU * (w - 0.15)), 0];
  p.head = [2 + 2 * step2, -p.yaw * 0.6, -p.roll * 0.6];
  p.ears = [10 + 10 * g, 10 + 10 * g];
  return p;
}

/**
 * The legs shuffling as it stands, each leg's moments in the loop: a ripple from back to front down its left side, then its
 * right, and each front foot tapped twice.
 */
const SHUFFLE: readonly number[][] = [[4.54, 9.2, 9.62], [13.54, 21.1, 21.52], [4.36], [13.36], [4.18], [13.18], [4.0], [13.0]];

/**
 * Standing about: breathing, looking about, an ear twitched now and then, a leg lifted and set down again in a ripple along a
 * side, the abdomen swaying, the weight shifting.
 */
function stillPlan(s: Spider, a: Anim): Plan {
  const p = restPlan(s), t = a.t, L = reachOf(s);
  p.pump = a.breath - 0.5;
  p.head = [3 * cyc(t, 4) + 4 * beat(t, [6.2, 15.4], 1.1), 14 * drift(t), 5 * drift(t, 3) + 9 * (beat(t, [10.4], 1.3) - beat(t, [19.6], 1.2))];
  // Its ears twitched, one and then the other, now and then both.
  p.ears = [26 * beat(t, [3.1, 12.7, 20.2, 22.9], 0.32), 26 * beat(t, [7.9, 16.3, 20.2], 0.32)];
  for (let q = 0; q < 8; q++) {
    const up = beat(t, SHUFFLE[q], 0.34);
    if (up > 0) p.at[q] = add(p.at[q], [sideOf(q) * 0.05 * L * up, 0.06 * L * up, 0.2 * L * up]);
  }
  p.abd = [2 * cyc(t, 2), 6 * drift(t, 5), 0];
  p.roll = 1.4 * cyc(t, 3);
  p.side = 0.006 * cyc(t, 3);
  p.H += 0.008 * (a.breath - 0.5);
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
 * A strike: a pounce. It rears back on its hind legs with its front legs raised and its ears laid back, then throws itself
 * forward, its front feet slamming down ahead of it, and settles back to how it stood.
 */
function strikePlan(s: Spider, t: number): Plan {
  const p = restPlan(s), hit = SPIDER_HITS[s.stage], L = reachOf(s);
  const rear = ramp(t, 0.04, 0.36) * (1 - ramp(t, 0.38, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.18, 0.95));
  p.pitch = 22 * rear - 8 * blow;
  p.H += L * (0.14 * rear - 0.05 * blow);
  p.surge = L * (-0.12 * rear + 0.3 * blow);
  for (let q = 0; q < 4; q++) {
    const sd = sideOf(q), k = q < 2 ? 1 : 0.35;
    p.at[q] = add(p.at[q], [sd * 0.12 * L * rear * k, L * k * (0.15 * rear + 0.5 * blow), L * 0.95 * rear * k]);
  }
  p.head = [-8 * rear + 10 * blow, 0, 0];
  p.ears = [34 * rear, 34 * rear];
  p.abd = [-10 * rear + 10 * blow, 0, 0];
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));

/** Where the Sprindle's spindle stand is put down, in the level frame: on the ground ahead of it to its left, its ball being on its right. */
const standAt = (s: Spider): V3 => [-s.prop.r[0] * 3.0, s.prop.at[1] + s.prop.r[0] * 1.9, 0];
/** How high the stand's spindle is, from the ground to the top of its cop: under its chin. */
const standH = (s: Spider): number => s.prop.r[0] * 2.7;

/** How far the Sprindle's ball has turned by `t` of its go: a third of a turn and more at each wind. */
const windOf = (t: number): number => {
  const W = SPIDER_WORK;
  return 150 * (ramp(t, W.wind - 0.1, W.wind) + ramp(t, W.wind2 - 0.1, W.wind2) + ramp(t, W.wind3 - 0.1, W.wind3));
};

/**
 * The Sprindle's go: bent over its ball, it turns it three times in its paws, both paws rolling it over toward itself, each
 * turn drawing thread off the stand's spindle and onto the ball (`SPIDER_WORK`).
 */
function windPlan(s: Spider, t: number, p: Plan): void {
  const W = SPIDER_WORK, r = s.prop.r[0], at = s.prop.at;
  const busy = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.82, 0.94));
  const turns = [W.wind, W.wind2, W.wind3];
  p.spin = -windOf(t);
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1;
    // Each paw over the top of the ball and rolling it down its front, then back up for the next.
    const keys: Array<[number, V3]> = [[0.12, add(at, [sd * r * 0.9, -r * 0.2, 0])]];
    for (const c of turns) keys.push([c - 0.1, add(at, [sd * r * 0.72, -r * 0.35, r * 0.82])], [c, add(at, [sd * r * 0.78, r * 0.62, r * 0.35])]);
    keys.push([0.88, add(at, [sd * r * 0.9, -r * 0.2, 0])]);
    p.hand[i] = path(t + (i ? 0.012 : 0), keys);
  }
  p.on = [1 - busy, 1 - busy];
  const nod = turns.reduce((m, c) => m + hump(t, c - 0.02, 0.07), 0);
  p.head = [-16 * busy + 5 * nod, -8 * busy, 5 * busy];
  p.ears = [10 * nod, 10 * nod];
  p.pitch = -5 * busy - 2 * nod;
  p.abd = [4 * busy, 6 * Math.sin(t * TAU * 3) * busy, 0];
  p.prop = add(p.prop, [0, -0.02 * busy, 0.02 * busy]);
}

/**
 * Where the Webloom's spindle hangs from its thread as it twirls, in the level frame: at its right side between its front legs,
 * clear of its face, its whorl just off the ground.
 */
const hangAt = (s: Spider): V3 => [s.legs[0].foot[0] * 1.15, s.legs[0].foot[1] * 0.55, -s.high + s.prop.r[1] * 0.9 + 0.06];

/** How far the Webloom's spindle has spun by `t` of its go: flicked fast, slowing as it winds, and stopped on its catch. */
const twirlOf = (t: number): number => {
  const W = SPIDER_WORK, u = clamp((t - W.flick) / (W.catch - W.flick));
  return 1500 * (1 - (1 - u) ** 2) + 120 * ramp(t, W.catch, 0.9);
};

/**
 * The Webloom's go: its right front leg raised high with a thread of silk, its spindle let down on the thread to hang upright at
 * its side, flicked twirling with its right paw, spinning as the thread twists and sinking as it lengthens, then caught up and
 * laid back across its paws (`SPIDER_WORK`).
 */
function twirlPlan(s: Spider, t: number, p: Plan): void {
  const W = SPIDER_WORK, len = s.prop.r[1], R = s.prop.at, T = s.prop.turn, H = hangAt(s);
  const down = ramp(t, 0.06, W.drop) * (1 - ramp(t, W.catch, 0.9));
  const hang: V3 = add(H, [0, 0, -0.04 * ramp(t, W.flick, W.catch)]);
  p.prop = mixV(R, hang, down);
  p.turnP = mixV(T, [90, 0, 0], down);
  p.spin = twirlOf(t);
  // Its right front leg up over it, holding the thread the spindle hangs from.
  const lift = ramp(t, 0.04, W.drop - 0.04) * (1 - ramp(t, W.catch + 0.04, 0.9));
  p.at[1] = mixV(p.at[1], [H[0], H[1], s.high + H[2] + len * 1.08 + 0.42 + 0.01 * Math.sin(t * TAU * 4)], lift);
  // The right paw flicking its cop, then catching it; the left let go of it and tucked in.
  p.hand[1] = path(t, [[W.drop, add(hang, [-0.16, 0.02, 0.05])], [W.flick - 0.04, add(hang, [-0.17, -0.07, 0.04])], [W.flick, add(hang, [-0.06, 0.1, 0.02])],
    [W.flick + 0.12, add(hang, [-0.2, 0.04, 0.08])], [W.catch - 0.06, add(hang, [-0.16, 0.02, 0])], [W.catch, add(hang, [-0.07, 0, 0])]]);
  const off = ramp(t, 0.08, W.drop) * (1 - ramp(t, W.catch + 0.04, 0.9));
  p.on = [1 - off, 1 - off];
  p.head = [-10 * down, -18 * down, 4 * down];
  p.ears = [8 * hump(t, W.flick, 0.06) + 8 * hump(t, W.catch, 0.06), 8 * hump(t, W.flick, 0.06)];
  p.pitch = 3 * lift;
}

/** How far up the Silkward reaches into its canopy at `t` of its go: up and down again for each draw. */
const reachUp = (t: number): number => {
  const W = SPIDER_WORK;
  return hump(t, W.draw - 0.06, 0.1) + hump(t, W.draw2 - 0.06, 0.1);
};

/**
 * The Silkward's go: it rears a little and reaches its front legs up toward its canopy, drawing silk up into it from its
 * spinnerets, twice, its abdomen pumping with each; a skein comes down on a thread from a post, is let fall, and lands
 * (`SPIDER_WORK`).
 */
function drawPlan(s: Spider, t: number, p: Plan): void {
  const W = SPIDER_WORK, L = reachOf(s);
  const busy = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.82, 0.94)), up = reachUp(t);
  const pull = hump(t, W.draw, 0.07) + hump(t, W.draw2, 0.07);
  // Its front feet up into the front of its canopy, where the silk is, and drawn down again.
  for (const q of [0, 1]) p.at[q] = mixV(add(p.at[q], [0, 0.06 * L * busy, 0.1 * L * busy]), [sideOf(q) * s.body[0] * 1.3, 0, s.high + L * 0.95], up);
  p.pitch = 4 * busy + 8 * up;
  p.H += L * 0.04 * up;
  p.abd = [8 * pull - 2 * busy, 0, 0];
  p.pump = 0.6 * pull;
  p.head = [10 * up - 4 * busy + 6 * hump(t, W.land, 0.06), -14 * hump(t, W.fall + 0.06, 0.16), 0];
  p.ears = [16 * pull, 16 * pull];
}

/** A go at its task, by stage: the Sprindle's winding, the Webloom's twirling, the Silkward's drawing, eased in from how it stands. */
function workPlan(s: Spider, t: number, down: number): Plan {
  const p = restPlan(s);
  if (s.stage === 0) windPlan(s, t, p);
  else if (s.stage === 1) twirlPlan(s, t, p);
  else drawPlan(s, t, p);
  return mixPlan(restPlan(s), p, down);
}

/** Feeding where it stands: its body let down, its head bent to the ground and nibbling. */
function grazePlan(s: Spider, a: Anim): Plan {
  const p = restPlan(s), t = a.t;
  const nib = Math.max(0, Math.sin(t * TAU * 1.2)) ** 2;
  p.pitch = -8;
  p.head = [-24 - 6 * nib, 8 * drift(t, 2), 0];
  p.H -= 0.05 * reachOf(s);
  return p;
}

/** Evolving: crouched as the light gathers, then drawn up tall with its front legs raised at the turn, a shake, and settled. */
function evolvePlan(s: Spider, t: number): Plan {
  const p = restPlan(s), L = reachOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.7, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.12 * hunch + 0.14 * up);
  p.pitch = -6 * hunch + 12 * up;
  p.head = [-10 * hunch + 12 * up, 0, 12 * shake];
  p.ears = [20 * hunch, 20 * hunch];
  p.abd = [-10 * hunch + 8 * up, 12 * shake, 0];
  p.roll = 4 * shake;
  for (const q of [0, 1]) p.at[q] = add(p.at[q], [sideOf(q) * 0.1 * L * up, 0.1 * L * up, 0.55 * L * up]);
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Spider, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
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

/** Two bones bent to put the end of the second at `to` from `from`, the joint between them bowed toward `hint`. */
function bend2(from: V3, to: V3, l0: number, l1: number, hint: V3): { mid: V3; end: V3 } {
  let d = sub(to, from);
  const D = len3(d), most = (l0 + l1) * 0.995, least = Math.abs(l0 - l1) + 0.06 * (l0 + l1), Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const end = add(from, scale(d, Dc));
  const a = sub(hint, scale(d, dot(hint, d)));
  const v = len3(a) > 1e-4 ? unit(a) : unit(cross(d, [1, 0, 0]));
  const along0 = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along0 * along0));
  return { mid: add(add(from, scale(d, along0)), scale(v, h)), end };
}

/** Where an ear's root is on the head (right side), in the head's frame. */
const earRoot = (s: Spider): V3 => onEgg([0, 0, 0], s.head.r, [0.72, -0.05, 0.66]).p;

/** Where its forepaws take hold of what it carries, left and right, in its own frame. */
function grips(s: Spider): V3[] {
  const r = s.prop.r;
  if (s.carry === 'ball') return [[-r[0] * 0.98, -r[0] * 0.1, r[0] * 0.2], [r[0] * 0.98, -r[0] * 0.1, r[0] * 0.2]];
  // The spindle across its paws, the left holding the cop's near end and the right its far end.
  return [[0, r[1] * 0.3, -r[2] * 0.75], [0, -r[1] * 0.3, -r[2] * 0.75]];
}

/** The posts over the Silkward's back: each one's root on its abdomen (the abdomen's frame), and the way it stands. */
function postsOf(s: Spider): Array<{ root: V3; up: V3 }> {
  const A = s.abd.r;
  return ([[0.62, 0.5, 0.6], [-0.62, 0.5, 0.6], [0.56, -0.52, 0.64], [-0.56, -0.52, 0.64]] as V3[]).map((d) => {
    const e = onEgg([0, 0, 0], A, d);
    return { root: add(e.p, scale(e.n, -0.08)), up: unit([d[0] * 0.32, d[1] * 0.22, 1]) };
  });
}
/** How long a post is, root to tip. */
const postLen = (s: Spider): number => s.abd.r[2] * 0.6 + (s.frame?.h ?? 0);

/** Where the Silkward's tassels hang from: each knee, and round the bottom of its abdomen (the abdomen's frame). */
const TASSEL_ABD: readonly V3[] = [[0.9, 0.05, -0.42], [-0.9, 0.05, -0.42], [0.62, -0.62, -0.5], [-0.62, -0.62, -0.5], [0.02, -0.92, -0.38]];

/** Which post the skein comes down from at the Silkward's work: the front right one. */
const SKEIN_POST = 0;

/**
 * The bones of a stage: the body carried level (`level`) and pitched as the pose says (`body`), the abdomen and the head on it,
 * the ears on the head, each leg bent to put its foot where it is to be, each forepaw bent to put its paw on what it carries
 * or where it is to be, what it carries, the Sprindle's stand, the Silkward's tassels hanging plumb from where they are tied,
 * and its skein.
 */
function spiderBones(s: Spider): (a: Anim) => Bones {
  const G = grips(s), posts = s.frame ? postsOf(s) : [];
  return (a0) => {
    const a = { ...a0, go: a0.act ? 0 : a0.go };
    const P = planOf(s, a);
    const level = joint(ROOT, [P.side, P.surge, P.H], 0, P.roll, P.yaw);
    const body = joint(level, [0, 0, 0], P.pitch, 0, 0);
    const b: Bones = { level, body };
    b.abd = joint(body, s.abd.at, s.abd.lift + P.abd[0], P.abd[2], P.abd[1]);
    b.head = joint(body, s.head.at, -P.pitch + P.head[0], P.head[2] - P.roll * 0.5, P.head[1]);
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1, r = earRoot(s);
      b[`ear${k}`] = joint(b.head, [sd * r[0], r[1], r[2]], -P.ears[k], sd * P.ears[k] * 0.3, 0);
    }
    // Legs: the knee up and out, as a spider's is.
    for (let q = 0; q < 8; q++) {
      const L = s.legs[pairOf(q)], sd = sideOf(q), key = KEYS[q];
      const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
      // A leg raised over its hip bows its knee out to its side instead, rather than up over its back.
      const raised = clamp((P.at[q][2] - hip[2]) / (L.len[0] + L.len[1]));
      const hint = turn(level, [sd * (0.5 + 0.8 * raised), [0.3, 0.08, -0.08, -0.3][pairOf(q)], 1 - 1.6 * raised]);
      const { mid: knee, end: at } = bend2(hip, P.at[q], L.len[0], L.len[1], hint);
      const out = unit([at[0] - hip[0], at[1] - hip[1], 0]);
      const [X0, Y0, Z0] = frameOf(sub(hip, knee), out), [X1, Y1, Z1] = frameOf(sub(knee, at), out);
      b[`${key}0`] = xfOf(X0, Y0, Z0, hip);
      b[`${key}1`] = xfOf(X1, Y1, Z1, knee);
      b[`${key}2`] = xfOf(X1, Y1, Z1, at);
    }
    // What it carries, posed in the level frame; spun about its own axis; the paws on it.
    if (s.carry !== 'none') {
      const propL = joint(ROOT, P.prop, P.turnP[0], P.turnP[1], P.turnP[2]);
      b.prop = compose(level, joint(propL, [0, 0, 0], s.carry === 'ball' ? P.spin : 0, s.carry === 'spindle' ? P.spin : 0, 0));
      b.grip = compose(level, propL);
      for (let i = 0; i < 2; i++) {
        const sd = i ? 1 : -1, A = s.palp;
        const sh = place(body, [sd * A.at[0], A.at[1], A.at[2]]);
        const want = place(level, mixV(P.hand[i], place(propL, G[i]), P.on[i]));
        const { mid: el, end: tip } = bend2(sh, want, A.len[0], A.len[1], turn(level, [sd * 0.9, -0.2, 0.4]));
        const ref = turn(level, [0, 1, 0]);
        const [X0, Y0, Z0] = frameOf(sub(sh, el), ref), [X1, Y1, Z1] = frameOf(sub(el, tip), ref);
        b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
        b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
        b[`hand${i}`] = xfOf(X1, Y1, Z1, tip);
      }
    } else {
      for (let i = 0; i < 2; i++) {
        const sd = i ? 1 : -1, A = s.palp;
        const sh = place(body, [sd * A.at[0], A.at[1], A.at[2]]);
        const want = place(level, P.hand[i]);
        const { mid: el, end: tip } = bend2(sh, want, A.len[0], A.len[1], turn(level, [sd * 0.9, 0.2, 0.4]));
        const ref = turn(level, [0, 1, 0]);
        const [X0, Y0, Z0] = frameOf(sub(sh, el), ref), [X1, Y1, Z1] = frameOf(sub(el, tip), ref);
        b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
        b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
        b[`hand${i}`] = xfOf(X1, Y1, Z1, tip);
      }
    }
    const act = a.act, working = act?.kind === 'work' ? act.t : -1;
    // The Sprindle's stand, on the ground, and its spindle turning as the thread comes off it; there only while it works.
    if (s.stage === 0) {
      const k = working < 0 ? 0 : ramp(working, 0, 0.08) * (1 - ramp(working, 0.92, 1));
      const st = joint(ROOT, standAt(s), 0, 0, -20);
      b.stand = scaled(st, k);
      b.standSpin = scaled(joint(st, [0, 0, 0], 0, 0, working < 0 ? 0 : windOf(working) * 2.4), k);
    }
    // Tassels: plumb from where each is tied, swinging a little.
    if (s.tassels) {
      const sway = (q: number): [number, number] => {
        const go = smooth(a.go), w = TAU * frac(a.u);
        return [5 * cyc(a.t, 3 + (q % 3), q) * (1 - go) + 7 * Math.sin(w * 2 + q) * go - 12 * P.pitch / 20, 4 * cyc(a.t, 2 + (q % 2), q * 1.7) + 6 * Math.cos(w * 2 + q) * go];
      };
      for (let q = 0; q < 8; q++) {
        const [pt, rl] = sway(q);
        b[`tas${q}`] = joint({ m: ROOT.m, t: b[`${KEYS[q]}1`].t }, [0, 0, -s.legs[pairOf(q)].w * 0.9], pt, rl, 0);
      }
      TASSEL_ABD.forEach((d, q) => {
        const [pt, rl] = sway(q + 8), e = onEgg([0, 0, 0], s.abd.r, d);
        b[`tasA${q}`] = joint({ m: ROOT.m, t: place(b.abd, add(e.p, scale(e.n, -0.02))) }, [0, 0, 0], pt, rl, 0);
      });
    }
    // The Silkward's posts' tops, for the silk strung between them; and its skein, let down on a thread and dropped at its work.
    posts.forEach((pt, q) => { b[`post${q}`] = { m: ROOT.m, t: place(b.abd, add(pt.root, scale(pt.up, postLen(s)))) }; });
    if (s.frame) {
      const W = SPIDER_WORK, top = b[`post${SKEIN_POST}`].t, out: V3 = [top[0] + 0.24, top[1] + 0.12, 0];
      const k = working < 0 ? 0 : ramp(working, 0.14, 0.3) * (1 - ramp(working, 0.9, 0.98));
      const hangZ = lerp(top[2] - 0.25, 0.9, ramp(working, 0.2, W.fall));
      const fall = clamp((working - W.fall) / (W.land - W.fall));
      const z = working < W.fall ? hangZ : Math.max(0.0, lerp(hangZ, 0.0, fall * fall));
      const bounce = working > W.land ? 0.06 * Math.abs(Math.sin((working - W.land) * 40)) * Math.exp(-(working - W.land) * 30) : 0;
      const lie = ramp(working, W.land - 0.03, W.land + 0.04);
      const at: V3 = [lerp(top[0], out[0], ramp(working, 0.2, W.fall)), lerp(top[1], out[1], ramp(working, 0.2, W.fall)), z + bounce];
      b.skein = scaled(joint(ROOT, at, 90 * lie, 6 * Math.sin(working * 30) * (1 - lie), 30), k * lerp(0.6, 1, ramp(working, 0.2, 0.5)));
    }
    b.shadow = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [level.t[0], level.t[1] + s.abd.at[1] * 0.4, 0] };
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------- */

/** How wide a leaf is along it, for `K` rings: a plump oval coming to a point. */
const leafWidths = (K: number): number[] => (K >= 5 ? [0.36, 0.86, 1, 0.68, 0.02] : K === 4 ? [0.42, 1, 0.72, 0.02] : [0.55, 1, 0.02]);

/**
 * A leaf lying on the egg `(C, R)`: rooted round the way `d0`, laid along the shell toward `t` for about `len`, its tip lifting
 * off it by `lift` of its length, `w` across at its widest; a pale rib down it.
 */
function leafOn(C: V3, R: V3, d0: V3, t: V3, len: number, w: number, lift: number, mat: Mat, K: number): Mesh {
  const e0 = onEgg(C, R, d0), tt = unit(sub(t, scale(e0.n, dot(t, e0.n)))), pts: V3[] = [];
  for (let k = 0; k < K; k++) {
    const u = k / (K - 1), e = onEgg(C, R, add(sub(e0.p, C), scale(tt, len * u)));
    pts.push(add(e.p, scale(e.n, 0.012 + lift * len * u * u)));
  }
  return blade(pts, leafWidths(K).map((k) => k * w), e0.n, { fold: 0.3, thick: Math.min(0.03, w * 0.2), mat, rib: 'stem' });
}

/** A leaf standing free from `root` along `dir`, its upper side toward `face` and bowed that way by `curl` of its length. */
function leafFree(root: V3, dir: V3, face: V3, len: number, w: number, curl: number, mat: Mat, K: number): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const pts = Array.from({ length: K }, (_, k) => { const u = k / (K - 1); return add(add(root, scale(d, len * u)), scale(f, len * curl * Math.sin(Math.PI * u))); });
  return blade(pts, leafWidths(K).map((k) => k * w), f, { fold: 0.3, thick: Math.min(0.03, w * 0.2), mat, rib: 'stem' });
}

/** A small white flower of five round petals, flat, facing along `n`, `r` across, with a yellow eye. */
function flowerOf(c: V3, n: V3, r: number, fine: boolean): Mesh {
  const N = fine ? 20 : 10, d = unit(n);
  let u = cross([0, 0, 1], d);
  if (len3(u) < 1e-3) u = [1, 0, 0];
  u = unit(u);
  const w = cross(d, u), v: V3[] = [];
  for (const side of [1, -1]) {
    for (let q = 0; q < N; q++) {
      const a = (q / N) * TAU, k = r * (0.42 + 0.58 * Math.abs(Math.cos(2.5 * a)) ** 0.7);
      v.push(add(add(c, scale(d, side * 0.006)), add(scale(u, Math.cos(a) * k), scale(w, Math.sin(a) * k))));
    }
  }
  const f: Face[] = [{ i: Array.from({ length: N }, (_, q) => q), m: 'bloom' }, { i: Array.from({ length: N }, (_, q) => N + q), m: 'bloom' }];
  return merge(mesh(v, woundTo(v, f, [d, scale(d, -1)])), orb(add(c, scale(d, 0.012)), [r * 0.3, r * 0.3, r * 0.3], 5, 3, 'spot'));
}

/** The fluffy middle the legs come out of: brown fur, cream under it, tufts standing out round its sides. In the body's frame. */
function bodyOf(s: Spider, n: number, k: number, fine: boolean): Mesh {
  const R = s.body, C: V3 = [0, 0, 0];
  const out: Mesh[] = [painted(orb(C, R, n + 3, k + 2, 'coat'), (c) => (dirIn(C, R, c)[2] < -0.5 ? 'mark' : 'coat'))];
  const N = fine ? 12 : 7;
  for (let q = 0; q < N; q++) {
    const az = (q / N) * TAU + 0.3, el = q % 2 ? -0.25 : 0.1;
    const d = unit([Math.cos(az), Math.sin(az), el]);
    if (d[1] > 0.5) continue;
    const e = onEgg(C, R, d), L = R[0] * (0.34 + 0.12 * jitter(q + 3));
    out.push(tuft(add(e.p, scale(e.n, -L * 0.3)), add(e.n, [0, 0, -0.25]), L, R[0] * 0.3, q % 3 === 2 ? 'mark' : 'coat'));
  }
  return merge(...out);
}

/** The solid of its body, its abdomen and its head, each in its own bone's frame, for what lies on them to be hidden behind. */
const bodySolid = (s: Spider): Array<{ c: V3; r: V3 }> => [{ c: [0, 0, 0], r: scale(s.body, 0.9) }];
const abdSolid = (s: Spider): Array<{ c: V3; r: V3 }> => [{ c: [0, 0, 0], r: scale(s.abd.r, 0.9) }];
const headSolid = (s: Spider): Array<{ c: V3; r: V3 }> => [{ c: [0, 0, 0], r: scale(s.head.r, 0.9) }];

/**
 * The abdomen, in its own frame about its middle. The Sprindle's and the Webloom's: a round brown egg, cream under it, mostly
 * under their leaves. The Silkward's: huge, woven in brown in a lattice of cream, its spinnerets at its end.
 */
function abdOf(s: Spider, n: number, k: number, fine: boolean): Mesh {
  const R = s.abd.r, C: V3 = [0, 0, 0];
  const woven = s.stage === 2, cols = woven ? (fine ? 24 : 16) : n + 3, rows = woven ? (fine ? 14 : 10) : k + 2;
  const egg = painted(orb(C, R, cols, rows, 'coat'), (c) => {
    const d = dirIn(C, R, c);
    if (!woven) return d[2] < -0.45 ? 'mark' : 'coat';
    // Strands round it and over it, crossing: cream where a strand is, the brown between in a check of two, a basket's weave.
    const lon = Math.atan2(d[0], -d[1]) / TAU + 0.5, lat = Math.asin(clamp(d[2], -1, 1)) / Math.PI + 0.5;
    const u = Math.floor(lon * cols), v = Math.floor(lat * rows);
    if (u % 4 === 0 || v % 4 === 1) return 'horn';
    return (u + v) % 2 ? 'coat' : 'coatDark';
  });
  const out: Mesh[] = [egg];
  // Its spinnerets: three small nubs at its end.
  const e = onEgg(C, R, [0, -1, -0.25]);
  for (const x of [-1, 0, 1]) out.push(orb(add(e.p, [x * R[0] * 0.08, 0, x === 0 ? -R[2] * 0.06 : 0]), R[0] * 0.07, fine ? 6 : 5, 3, 'coatDark'));
  return merge(...out);
}

/**
 * The egg its leaves lie on, in the body's frame: over its body and its abdomen together, so they run on from one to the other;
 * the Silkward's over its body alone, its abdomen having leaves of its own.
 */
function backEgg(s: Spider): { c: V3; r: V3 } {
  const B = s.body, A = s.abd;
  if (s.stage === 2) return { c: [0, -B[1] * 0.2, B[2] * 0.1], r: [B[0] * 1.02, B[1] * 1.0, B[2] * 1.05] };
  const back = -A.at[1] + A.r[1], top = Math.max(B[2], A.at[2] + A.r[2]);
  return { c: [0, (B[1] - back) / 2, top * 0.2], r: [Math.max(B[0], A.r[0]) * 1.02, (B[1] + back) / 2, top * 0.96] };
}

/**
 * A way out of an egg `theta` radians round from `top` toward `phi` (nought straight back, a quarter turn to its right side), and
 * the way on round it from there, away from `top`: where a leaf is rooted, and the way it lies.
 */
function fromCrown(top: V3, theta: number, phi: number): { d: V3; t: V3 } {
  const P = unit(top), h: V3 = [Math.sin(phi), -Math.cos(phi), 0], D = unit(sub(h, scale(P, dot(h, P))));
  return { d: add(scale(P, Math.cos(theta)), scale(D, Math.sin(theta))), t: add(scale(P, -Math.sin(theta)), scale(D, Math.cos(theta))) };
}

/**
 * The leaves lying back over it like feathers, on its back's egg (`backEgg`), in the body's frame: rows of them from a crown just
 * behind its head, flowing back and out and down over its top and its sides, the outer rows wider round it, each row lying a
 * little over the next; green and a paler green by turns, each with a pale rib. Among them, on the Webloom, its flowers.
 */
function cloakOf(s: Spider, fine: boolean): Mesh {
  const C = s.cloak, E = backEgg(s), out: Mesh[] = [], K = fine ? 5 : 3, top: V3 = [0, 0.4, 1];
  for (let row = C.rows - 1; row >= 0; row--) {
    const count = Math.max(2, Math.round((C.count + row * 2) * (fine ? 1 : 0.7))), spread = lerp(0.9, 2.0, row / Math.max(1, C.rows - 1));
    const theta = lerp(0.3, 1.25, row / Math.max(1, C.rows - 1));
    for (let q = 0; q < count; q++) {
      const u = count === 1 ? 0.5 : q / (count - 1), phi = lerp(-spread, spread, u) + (jitter(q + row * 7) - 0.5) * 0.12;
      const { d, t } = fromCrown(top, theta + (jitter(q + row * 3) - 0.5) * 0.1, phi);
      const len = C.len * (1 + 0.12 * row) * (0.9 + 0.2 * jitter(q + 31 + row));
      out.push(leafOn(E.c, E.r, d, t, len, C.w * (0.9 + 0.2 * jitter(q + 5)), C.lift * (1 - 0.25 * row), (q + row) % 3 === 1 ? 'moss' : 'leaf', K));
    }
  }
  if (s.stage === 1) {
    // Flowers on its crest near its head, most of them on its left.
    const at: Array<[number, number]> = [[0.42, -1.25], [0.2, -0.55], [0.36, 1.0], [0.72, -1.7], [0.62, 0.4]];
    for (let q = 0; q < s.flowers; q++) {
      const { d } = fromCrown(top, at[q][0], at[q][1]), e = onEgg(E.c, E.r, d);
      out.push(flowerOf(add(e.p, scale(e.n, 0.05 + 0.01 * (q % 2))), unit(add(e.n, [0, 0.25, 0.35])), E.r[0] * (0.2 - 0.03 * (q % 2)), fine));
    }
  }
  return merge(...out);
}

/**
 * The Silkward's abdomen's dress, in its frame: big leaves lying over its top and down its sides from a crown on its top, its
 * flower among them on its right, ringed in small leaves.
 */
function abdLeavesOf(s: Spider, fine: boolean): Mesh {
  const C = s.cloak, R = s.abd.r, out: Mesh[] = [], K = fine ? 5 : 3, top: V3 = [0, 0.15, 1];
  for (let row = C.rows - 1; row >= 0; row--) {
    const count = Math.max(2, Math.round((C.count + row * 2) * (fine ? 1 : 0.7))), spread = row ? 2.6 : 1.9;
    for (let q = 0; q < count; q++) {
      const u = q / (count - 1), phi = lerp(-spread, spread, u) + (jitter(q + row * 7) - 0.5) * 0.2;
      const { d, t } = fromCrown(top, (row ? 0.95 : 0.3) + (jitter(q + 3) - 0.5) * 0.15, phi);
      out.push(leafOn([0, 0, 0], R, d, t, C.len * (0.85 + 0.3 * jitter(q + 31 + row)), C.w * (0.9 + 0.2 * jitter(q + 5)), C.lift, (q + row) % 3 === 1 ? 'moss' : 'leaf', K));
    }
  }
  const f = onEgg([0, 0, 0], R, [0.78, 0.05, 0.5]);
  for (let q = 0; q < (fine ? 5 : 3); q++) {
    const a = (q / (fine ? 5 : 3)) * TAU + 0.5, d = add(f.n, scale(add(scale(cross(f.n, [0, 0, 1]), Math.cos(a)), scale([0, 0, 1], Math.sin(a))), 0.25));
    out.push(leafOn([0, 0, 0], R, f.n, sub(onEgg([0, 0, 0], R, d).p, f.p), R[0] * 0.24, R[0] * 0.09, 0.15, 'leaf', 3));
  }
  out.push(flowerOf(add(f.p, scale(f.n, 0.05)), f.n, R[0] * 0.17, fine));
  return merge(...out);
}

/**
 * The leaves on its crown, in the head's frame: the Sprindle's and the Webloom's standing up off the back of its head between its
 * ears and lying back, broad, the middle the biggest; the Silkward's a cap, one broad leaf lying forward over its brow.
 */
function crownOf(s: Spider, fine: boolean): Mesh {
  const C = s.crown, R = s.head.r, out: Mesh[] = [], K = fine ? 5 : 3;
  for (let q = 0; q < C.count; q++) {
    const u = C.count === 1 ? 0.5 : q / (C.count - 1), a = lerp(-1, 1, u) * 0.8;
    const e = onEgg([0, 0, 0], R, [Math.sin(a) * 0.5, -0.45, 0.8]);
    const dir = unit([Math.sin(a) * 1.1, -0.95, 1.0 - 0.35 * Math.abs(Math.sin(a))]);
    const len = C.len * (0.75 + 0.35 * Math.cos(a * 1.4)) * (0.95 + 0.1 * jitter(q + 2));
    out.push(leafFree(add(e.p, scale(e.n, -0.03)), dir, [Math.sin(a) * 0.3, 0.6, 0.5], len, C.w * (0.85 + 0.25 * Math.cos(a)), -0.14, q % 2 ? 'moss' : 'leaf', K));
  }
  if (C.cap) {
    // The cap: a broad leaf from the back of its crown over its top to a point on its brow, and two smaller at its sides.
    out.push(leafOn([0, 0, 0], R, [0, -0.55, 0.84], [0, 1, 0.1], C.len * 1.1, C.w, 0.08, 'leaf', fine ? 5 : 4));
    for (const sd of [1, -1]) out.push(leafOn([0, 0, 0], R, [sd * 0.3, -0.7, 0.62], [sd * 0.5, 0.6, 0.2], C.len * 0.75, C.w * 0.62, 0.3, 'moss', K));
  }
  return merge(...out);
}

/** Whether a point on the head (its way out of it, scaled to a ball) is the cream of its face: its front, and under its chin. */
const creamFace = (d: V3): boolean => d[1] > 0.3 || (d[2] < -0.62 && d[1] > -0.2);

/**
 * The head: a round skull, brown over its crown and down its sides, the cream of its face in front and a cream peak up its brow;
 * a brown band out from each eye to its cheek; big glossy dark eyes; two small dark dots on its brow over them; a small muzzle
 * with a dark nose and a smile; and fluffy brown cheeks.
 */
function headOf(s: Spider, n: number, k: number, shut: boolean, fine: boolean): Mesh {
  const H = s.head, R = H.r, C: V3 = [0, 0, 0];
  // Its rings round the way it faces, so the edge of its face is one of them, a clean round.
  const skull = orbAlong(C, [0, 1, 0], [R[0], R[2], R[1]], n + 7, k + 4, 'coat');
  const out: Mesh[] = [painted(skull, (c) => (creamFace(dirIn(C, R, c)) ? 'mark' : 'coat'))];
  const mz = onEgg(C, R, [0, 1, -0.4]);
  out.push(orbAlong(add(mz.p, scale(mz.n, -R[1] * 0.14)), [0, 1, -0.2], [R[0] * 0.28, R[0] * 0.22, R[1] * 0.24], n, 4, 'muzzle'));
  const tip = add(mz.p, add(scale(mz.n, R[1] * 0.08), [0, 0, R[2] * 0.04]));
  out.push(orb(tip, [R[0] * 0.07, R[0] * 0.05, R[0] * 0.045], 6, 3, 'nose'));
  out.push(smile(add(tip, [0, -R[1] * 0.02, -R[2] * 0.11]), [0, 1, -0.3], R[0] * 0.15));
  const E = H.eye, dir = eyeDir(s), paints: Disc[] = [];
  // The cream peak up its brow, the brown band out from each eye to its cheek, and the two dots over its eyes.
  paints.push(patchOn(C, R, [0, 0.62, 0.78], R[0] * 0.34, R[2] * 0.42, 'mark', 0, 0.008, 12));
  for (const sd of [1, -1]) {
    paints.push(patchOn(C, R, [sd * (dir[0] + 0.3), dir[1] - 0.26, dir[2] + 0.04], E * 1.3, E * 0.95, 'coat', sd * 0.5, 0.01, 12));
    paints.push(patchOn(C, R, [sd * 0.14, 0.7, 0.52], E * 0.16, E * 0.16, 'nose', 0, 0.012, 6));
  }
  out.push(paint(paints));
  out.push(eyesOf(s, shut));
  // Fluffy brown cheeks out at its sides, and a few tufts behind them.
  const N = fine ? 3 : 2;
  for (const sd of [1, -1]) {
    for (let q = 0; q < N; q++) {
      const e = onEgg(C, R, [sd, 0.2 - 0.25 * q, -0.15 - 0.2 * q]);
      out.push(tuft(add(e.p, scale(e.n, -0.02)), add(e.n, [0, -0.15, -0.35]), R[0] * (0.34 - 0.05 * q), R[0] * 0.22, 'coat'));
    }
  }
  return merge(...out);
}

/** The way out of the head to the right eye. */
const eyeDir = (s: Spider): V3 => (s.stage === 2 ? [0.52, 0.8, -0.02] : [0.55, 0.78, 0.03]);

/** The eyes: each a dark rim, a big glossy dark eye and two glints, laid onto the skull's curve; a lid's line, shut. */
function eyesOf(s: Spider, shut: boolean): Mesh {
  const E = s.head.eye, C: V3 = [0, 0, 0], R = s.head.r, dir = eyeDir(s), out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * dir[0], dir[1], dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -E * 0.1)), n, E * 1.05, E * 0.3, 8, 'lid', o), 0.018));
      continue;
    }
    out.push(onto(disc(p, n, E * 1.12, E * 1.18, 12, 'lid', o), 0.016));
    out.push(onto(disc(p, n, E, E * 1.06, 12, 'eye', o), 0.02));
    out.push(onto(disc(add(add(p, scale(up, E * 0.38)), scale(across, side * E * 0.28)), n, E * 0.4, E * 0.42, 6, 'glint', { ...o, lit: true }), 0.03));
    out.push(onto(disc(add(add(p, scale(up, -E * 0.44)), scale(across, -side * E * 0.3)), n, E * 0.16, E * 0.16, 5, 'glint', { ...o, lit: true }), 0.03));
  }
  return paint(out);
}

/** An ear, right, from its root in the head's frame: a fox's, pointed and upright, brown outside, cream in, its tip a leaf. */
function earOf(s: Spider, n: number): Mesh {
  const [len, w] = s.ear;
  const body = tube([[0, 0, -len * 0.08], [0, 0.03, len * 0.3], [0, 0.03, len * 0.58], [0, 0, len * 0.8], [0, -0.03, len]],
    [w * 0.78, w, w * 0.84, w * 0.48, 0.012], [w * 0.28, w * 0.3, w * 0.26, w * 0.2, 0.01], Math.max(5, n - 2),
    (ring) => (ring >= 2 ? 'leaf' : 'coat'), { up: [0, 1, 0] });
  const inner = paint([disc([0, w * 0.3, len * 0.36], [0, 1, 0.1], w * 0.52, len * 0.24, 7, 'mark')]);
  const ear = merge(body, inner);
  // Rolled out from upright and turned to face forward and out.
  const r = (34 * Math.PI) / 180, y = (-22 * Math.PI) / 180;
  return mesh(ear.v.map((v) => {
    const p1: V3 = [v[0] * Math.cos(r) + v[2] * Math.sin(r), v[1], -v[0] * Math.sin(r) + v[2] * Math.cos(r)];
    return [p1[0] * Math.cos(y) - p1[1] * Math.sin(y), p1[0] * Math.sin(y) + p1[1] * Math.cos(y), p1[2]];
  }), ear.f);
}

/**
 * The ruff of cream fur under its chin, in the body's frame: soft lobes round its front between its head and its legs, lying out
 * and down over its chest, so it is a bib under its face. The Silkward's big.
 */
function ruffOf(s: Spider, fine: boolean): Mesh {
  const H = s.head, out: Mesh[] = [], N = fine ? 9 : 6, w = H.r[0] * 0.5 * s.ruff;
  const c = add(H.at, [0, -H.r[1] * 0.15, -H.r[2] * 0.72]);
  for (let row = 0; row < 2; row++) {
    for (let q = 0; q < N; q++) {
      const a = lerp(-1.25, 1.25, (q + 0.5 * row) / (N - 1 + 0.5 * row)), radial: V3 = [Math.sin(a), Math.cos(a) * 0.6, 0];
      const root = add(c, add(scale(radial, H.r[0] * 0.55), [0, -0.04 * row, 0.04 * row]));
      const dir = unit(add(radial, [0, 0.3 - 0.2 * row, -0.6]));
      out.push(tuft(root, dir, w * (1 + 0.2 * jitter(q + 9 + row * 5)) * (1 - 0.2 * row), w * 0.85, row ? 'muzzle' : 'mark'));
    }
  }
  return merge(...out);
}

/* ---- legs ------------------------------------------------------------------------------- */

/** A leg's upper part, along -z from its hip, banded as its dress is; a round knee at its end. */
function thighOf(s: Spider, L: Leg, n: number): Mesh {
  const l = L.len[0], w = L.w;
  if (s.dress === 'braid') {
    const zs = Array.from({ length: 8 }, (_, q) => (q === 0 ? 0.02 : -l * (q / 7)));
    const ws = zs.map((_, q) => w * (q % 2 ? 1.14 : 1.0) * (1 - 0.08 * (q / 7)));
    return merge(tube(zs.map((z) => [0, 0, z] as V3), ws, ws, n, (ring, j) => (ring === 5 ? 'mark' : (ring + j) % 2 ? 'leaf' : 'coat'), { seam: 'start' }), orb([0, 0, -l], w * 1.12, n, 3, 'coat'));
  }
  const mats: Mat[] = s.dress === 'stripe' ? ['coat', 'coat', 'mark', 'mark'] : ['coat', 'mark', 'leaf', 'mark', 'coat'];
  const K = mats.length, zs = [0.02, ...Array.from({ length: K }, (_, q) => -l * ((q + 1) / K))];
  const ws = zs.map((_, q) => w * (s.dress === 'stripe' ? (q % 2 ? 1.18 : 1.0) : 1) * (q === 0 ? 1.05 : 1));
  return merge(tube(zs.map((z) => [0, 0, z] as V3), ws, ws, n, (ring) => mats[Math.min(ring, K - 1)], { seam: 'start' }), orb([0, 0, -l], w * 1.12, n, 3, 'coat'));
}

/** A leg's lower part, along -z from its knee to a dark point on the ground, banded as its dress is. */
function shinOf(s: Spider, L: Leg, n: number, fine: boolean): Mesh {
  const l = L.len[1], w = L.w;
  if (s.dress === 'braid') {
    const K = 9, zs = Array.from({ length: K + 1 }, (_, q) => (q === 0 ? w * 0.5 : -l * (q / K)));
    const ws = zs.map((_, q) => w * (q === K ? 0.12 : q >= K - 1 ? 0.62 : (q % 2 ? 1.12 : 0.98) * (1 - 0.18 * (q / K))));
    return tube(zs.map((z) => [0, 0, z] as V3), ws, ws, n, (ring, j) => (ring >= K - 2 ? 'coatDark' : ring === 4 ? 'mark' : (ring + j) % 2 ? 'leaf' : 'coat'), { seam: 'start' });
  }
  const mats: Mat[] = s.dress === 'stripe' ? ['mark', 'coat', 'leaf', 'mark', 'coatDark', 'coatDark'] : ['mark', 'coat', 'leaf', 'mark', 'coat', 'mark', 'coatDark', 'coatDark'];
  const K = mats.length, zs = [w * 0.5, ...Array.from({ length: K }, (_, q) => -l * ((q + 1) / K))];
  const ws = zs.map((_, q) => w * (q === K ? 0.14 : q === K - 1 ? 0.62 : (s.dress === 'stripe' ? (q % 2 ? 1.16 : 1.0) : (q % 2 ? 1.06 : 0.96) * (1 - 0.15 * (q / K)))));
  const out: Mesh[] = [tube(zs.map((z) => [0, 0, z] as V3), ws, ws, n, (ring) => mats[Math.min(ring, K - 1)], { seam: 'start' })];
  // The Webloom's leafy bands: small leaves wrapped round its shin, pointing down it.
  if (s.dress === 'leafy') {
    const at = [-l * 0.36, -l * 0.62].slice(0, fine ? 2 : 1);
    at.forEach((z, q) => {
      for (const sd of fine ? [1, -1] : [1]) {
        const a = sd * (0.9 + q * 0.6), r: V3 = [Math.cos(a), Math.sin(a), 0];
        out.push(leafFree(add([0, 0, z], scale(r, w * 0.7)), add(scale(r, 0.25), [0, 0, -1]), r, l * 0.22, w * 0.75, 0.15, q % 2 ? 'moss' : 'leaf', 3));
      }
    });
  }
  return merge(...out);
}

/** A forepaw's upper part along -z from its shoulder, fluffy brown; its lower; and a round dark paw. */
function palpOf(s: Spider, n: number, part: 0 | 1 | 2): Mesh {
  const A = s.palp, w = A.w;
  if (part === 0) return tube([[0, 0, 0.02], [0, 0, -A.len[0] * 0.5], [0, 0, -A.len[0]]], [w * 1.0, w * 1.12, w * 0.95], [w * 1.0, w * 1.12, w * 0.95], n, 'coat', { seam: 'start' });
  if (part === 1) return tube([[0, 0, w * 0.4], [0, 0, -A.len[1] * 0.5], [0, 0, -A.len[1]]], [w * 0.95, w * 1.1, w * 0.95], [w * 0.95, w * 1.1, w * 0.95], n, (ring) => (ring ? 'mark' : 'coat'), { seam: 'start' });
  return orb([0, 0, -w * 0.2], [w * 1.0, w * 0.92, w * 0.95], Math.max(5, n), 3, 'coat');
}

/* ---- what it carries ---------------------------------------------------------------------- */

/** A strand round a ball: a ring of thread `r` out from `c`, square to `axis`, `w` thick. */
function strandRound(c: V3, axis: V3, r: number, w: number, N: number, m: Mat): Mesh {
  const z = unit(axis);
  let x = cross([0.3, 0.2, 1], z);
  x = unit(x);
  const y = cross(z, x);
  const pts = Array.from({ length: N + 1 }, (_, q) => { const a = (q / N) * TAU; return add(c, add(scale(x, Math.cos(a) * r), scale(y, Math.sin(a) * r))); });
  return tube(pts, w, w, 4, m, { start: false, end: false });
}

/** The ball of yarn, in its own frame about its middle: a cream ball wound over with strands of thread every way round. */
function ballOf(s: Spider, n: number, k: number, fine: boolean): Mesh {
  const r = s.prop.r[0], out: Mesh[] = [orb([0, 0, 0], r, n + 3, k + 2, 'shell')];
  const axes: V3[] = [[1, 0.2, 0.1], [0.2, 1, 0.3], [0.1, 0.3, 1], [0.7, -0.6, 0.4], [-0.5, 0.3, 0.8], [0.6, 0.6, -0.5]];
  const N = fine ? 6 : 3;
  for (let q = 0; q < N; q++) out.push(strandRound([0, 0, 0], axes[q], r * 1.01, r * 0.06, fine ? 14 : 8, 'shellDark'));
  return merge(...out);
}

/**
 * The spindle, in its own frame about its middle, its shaft along y: a wooden shaft, a fat cop of cream silk wound on it in a
 * spiral, a turned point at one end and a wooden whorl at the other.
 */
function spindleOf(s: Spider, n: number, fine: boolean): Mesh {
  const [sr, L, cr] = s.prop.r;
  const shaft = tube([[0, -L, 0], [0, L * 0.85, 0]], sr, sr, Math.max(5, n - 2), 'wood');
  const point = taper([[0, L * 0.85, 0], [0, L * 1.08, 0]], sr * 1.4, 0.004, Math.max(5, n - 2), 'woodDark');
  const ys = fine ? [-0.62, -0.52, -0.4, -0.26, -0.12, 0.02, 0.16, 0.3, 0.44, 0.56, 0.66] : [-0.62, -0.4, -0.1, 0.2, 0.45, 0.66];
  const prof = (y: number): number => cr * (0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - ((y - 0.02) / 0.68) ** 2)));
  const nn = fine ? 10 : 7;
  const cop = tube(ys.map((y) => [0, y * L, 0] as V3), ys.map(prof), ys.map(prof), nn, (ring) => (ring % 2 ? 'shellDark' : 'shell'), { up: [0, 0, 1] });
  const whorl = tube([[0, -L * 0.9, 0], [0, -L * 0.74, 0]], cr * 0.95, cr * 0.95, nn, (_r, j) => (j === 0 ? 'woodDark' : 'wood'), { up: [0, 0, 1] });
  return merge(shaft, point, cop, whorl);
}

/** The Sprindle's spindle stand, on the ground: a round wooden foot and a post. */
function standOf(s: Spider, n: number): Mesh {
  const r = s.prop.r[0], h = standH(s);
  return merge(
    tube([[0, 0, 0], [0, 0, r * 0.22]], r * 0.9, r * 0.9, Math.max(6, n), 'wood'),
    tube([[r * 0.55, 0, r * 0.2], [r * 0.55, 0, h * 0.82]], r * 0.11, r * 0.11, 5, 'woodDark'),
    tube([[r * 0.55, 0, h * 0.8], [0, 0, h * 0.8]], r * 0.08, r * 0.08, 5, 'woodDark'),
  );
}

/** The stand's spindle, upright from its foot, turning: a thin shaft and a cop of cream yarn wound on it in a spiral. */
function standSpindleOf(s: Spider, n: number): Mesh {
  const r = s.prop.r[0], h = standH(s), cr = r * 0.42, nn = Math.max(6, n);
  const zs = [0.32, 0.4, 0.52, 0.64, 0.74];
  const prof = (z: number): number => cr * (0.35 + 0.65 * Math.sin(Math.PI * (z - 0.3) / 0.46));
  return merge(
    tube([[0, 0, r * 0.2], [0, 0, h]], r * 0.05, r * 0.05, 5, 'wood'),
    tube(zs.map((z) => [0, 0, z * h] as V3), zs.map(prof), zs.map(prof), nn, (ring, j) => ((ring * 2 + j) % nn < nn / 2 ? 'shell' : 'shellDark')),
  );
}

/** The Silkward's skein, in its own frame hanging from its top: a long loop of cream yarn, twisted, tied round near its top. */
function skeinOf(s: Spider, fine: boolean): Mesh {
  const h = s.head.r[0] * 1.15, w = h * 0.24, N = fine ? 14 : 9;
  const pts = Array.from({ length: N + 1 }, (_, q) => {
    const a = (q / N) * TAU;
    return [Math.sin(a) * w * (1 - 0.3 * Math.cos(a)), 0.25 * w * Math.sin(2 * a), -h * 0.5 * (1 - Math.cos(a))] as V3;
  });
  const loop = tube(pts, w * 0.42, w * 0.42, fine ? 6 : 4, (ring) => (ring % 2 ? 'shell' : 'shellDark'), { start: false, end: false, up: [0, 1, 0] });
  const tie = tube([[0, 0, -h * 0.1], [0, 0, -h * 0.2]], w * 0.62, w * 0.62, 6, 'string');
  return merge(loop, tie);
}

/* ---- the Silkward's dress ------------------------------------------------------------------- */

/** A tassel, along -z from where it is tied: a short cord, a knot, and a long brush of cream silk in bands. */
function tasselOf(len: number, r: number, fine: boolean): Mesh {
  const c = len * 0.16, n = fine ? 6 : 4;
  const zs = [0, 0.08, 0.22, 0.38, 0.54, 0.7, 0.86, 1].slice(0, fine ? 8 : 8).filter((_, q) => fine || q % 2 === 0 || q === 7);
  const ws = zs.map((z) => r * (z < 0.1 ? 0.7 : z > 0.9 ? 0.25 : 0.85 + 0.25 * Math.sin(Math.PI * z)));
  return merge(
    tube([[0, 0, 0.02], [0, 0, -c]], r * 0.22, r * 0.22, 4, 'string'),
    orb([0, 0, -c], r * 0.45, 5, 3, 'shellDark'),
    tube(zs.map((z) => [0, 0, -c - z * (len - c)] as V3), ws, ws, n, (ring) => (ring % 2 ? 'shellDark' : 'shell')),
  );
}

/** The swags of silk round the Silkward's abdomen, in its frame: ropes of cream silk sagging between points round its sides. */
function garlandsOf(s: Spider, fine: boolean): Mesh {
  const R = s.abd.r, out: Mesh[] = [], N = fine ? 7 : 4, r = R[0] * 0.03;
  const rows: Array<{ lat: number; sag: number; from: number; to: number; spans: number }> = [
    { lat: 0.3, sag: 0.3, from: 0.5, to: TAU - 0.5, spans: 5 },
  ];
  for (const row of rows) {
    for (let q = 0; q < row.spans; q++) {
      const pts: V3[] = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N, lon = lerp(row.from, row.to, (q + u) / row.spans), lat = row.lat - row.sag * Math.sin(Math.PI * u);
        const d: V3 = [Math.sin(lon) * Math.cos(lat), Math.cos(lon) * Math.cos(lat), Math.sin(lat)];
        const e = onEgg([0, 0, 0], R, d);
        pts.push(add(e.p, scale(e.n, r * 1.6)));
      }
      out.push(tube(pts, r, r, 4, (ring) => (ring % 2 ? 'shell' : 'string')));
    }
  }
  return merge(...out);
}

/** A post over the Silkward's back, in the abdomen's frame: braided green and brown, bound in cream, a turned brown point at its top. */
function postOf(s: Spider, root: V3, up: V3, n: number): Mesh {
  const F = s.frame!, L = postLen(s), K = 8, w = F.w;
  const pts = Array.from({ length: K + 1 }, (_, q) => add(root, scale(up, (L * q) / K)));
  const ws = pts.map((_, q) => w * (q % 2 ? 1.12 : 1));
  const top = add(root, scale(up, L)), out = unit([up[0], up[1], 0]);
  // Two leaves out from under its point, hanging out and down.
  const leaves = [0.9, -0.9].map((a) => {
    const d = unit(add(scale(out, Math.cos(a)), scale(cross([0, 0, 1], out), Math.sin(a))));
    return leafFree(add(top, scale(d, w)), add(d, [0, 0, -0.55]), [0, 0, 1], w * 4.2, w * 1.5, 0.12, 'leaf', 3);
  });
  return merge(
    tube(pts, ws, ws, n, (ring, j) => (ring === K - 1 || ring === 3 ? 'horn' : (ring + j) % 2 ? 'leaf' : 'grip')),
    taper([top, add(top, scale(up, w * 3.2))], w * 1.25, 0.005, n, 'bark'),
    ...leaves,
  );
}

/* ---- silk, drawn by hand ------------------------------------------------------------------- */

const SILK: RGB = [250, 244, 226];
const SILK_INK: RGB = [138, 108, 78];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** How big a pixel is, in the units `g` is drawing in. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/** Points along a thread hung from `a` to `b`, sagging `drop` at its middle, `N` pieces. */
function sagged(a: V3, b: V3, drop: number, N: number): V3[] {
  const c: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - 2 * drop];
  return Array.from({ length: N + 1 }, (_, q) => {
    const u = q / N, w = 1 - u;
    return [w * w * a[0] + 2 * w * u * c[0] + u * u * b[0], w * w * a[1] + 2 * w * u * c[1] + u * u * b[1], Math.max(0.005, w * w * a[2] + 2 * w * u * c[2] + u * u * b[2])] as V3;
  });
}

/**
 * Threads of silk, each a line through its points: a thin cream line over a soft brown one a pixel wider, so it shows on grass
 * and on cream alike; each piece of it drawn on its own side of the body (`front`), so what is behind the body is under it.
 */
function threads(g: CanvasRenderingContext2D, view: View, lines: readonly V3[][], mid: V3, front: boolean, w: number, al = 1): void {
  if (al <= 0.02) return;
  const px = pxOf(g), path = new Path2D();
  let any = false;
  for (const pts of lines) {
    let open = false;
    for (let q = 0; q < pts.length - 1; q++) {
      if (nearSide(mixV(pts[q], pts[q + 1], 0.5), mid, view) !== front) { open = false; continue; }
      const [x0, y0] = onScreen(view, pts[q]), [x1, y1] = onScreen(view, pts[q + 1]);
      if (!open) path.moveTo(x0, y0);
      path.lineTo(x1, y1);
      open = any = true;
    }
  }
  if (!any) return;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const lw = Math.max(px * 1.05, w);
  g.strokeStyle = css(SILK_INK, 0.5 * al);
  g.lineWidth = lw + px * 1.2;
  g.stroke(path);
  g.strokeStyle = css(SILK, 0.95 * al);
  g.lineWidth = lw;
  g.stroke(path);
  g.restore();
}

/** Loose loops of thread lying on the ground from `from`, round `at`: a coil of a few rings, each a little off the last. */
function groundLoops(from: V3, at: V3, r: number, rings: number, seed: number): V3[] {
  const pts: V3[] = [from];
  const N = 14;
  for (let k = 0; k < rings; k++) {
    const c: V3 = [at[0] + (jitter(seed + k) - 0.5) * r * 0.8, at[1] + (jitter(seed + k + 9) - 0.5) * r * 0.6, 0.006];
    const rx = r * (0.8 + 0.4 * jitter(seed + k + 3)), ry = rx * 0.62, a0 = jitter(seed + k + 5) * TAU;
    for (let q = 0; q <= N; q++) {
      const a = a0 + (q / N) * TAU;
      pts.push([c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry, 0.006]);
    }
  }
  return pts;
}

/**
 * The silk it trails and drapes, each piece on its side of the body. The Sprindle's: thread from its ball down to loose loops on
 * the ground, and while it works, thread from the stand's spindle to its ball. The Webloom's: a thread from its spindle's point
 * down to loops on the ground, threads draped between its knees down each side and under its body, and while it twirls, the
 * thread its spindle hangs from. The Silkward's: silk strung between its posts and sagging, swags between its knees, threads
 * under its body, and while it works, silk drawn up from its spinnerets into its canopy and the thread its skein comes down on.
 * Fewer of them drawn small.
 */
function silkOf(g: CanvasRenderingContext2D, view: View, s: Spider, b: Bones, a: Anim, front: boolean): void {
  const px = pxOf(g), big = (s.body[0] * 2) / px, few = big < 30;
  const mid = b.body.t, t = a.t, w = Math.max(px * 1.05, s.body[0] * (few ? 0.03 : 0.022));
  const act = a.act, working = act?.kind === 'work' ? act.t : -1, W = SPIDER_WORK;
  const sway = (q: number): V3 => [0.012 * cyc(t, 3 + (q % 3), q), 0.01 * cyc(t, 2 + (q % 2), q * 2.1), 0];
  const knee = (q: number): V3 => b[`${KEYS[q]}1`].t;
  const lines: V3[][] = [];
  if (s.carry === 'ball' && b.prop) {
    // From the bottom of the ball to the ground, and the loose loops there; fewer as it winds them in.
    const r = s.prop.r[0], from = place(b.prop, [r * 0.3, r * 0.6, -r * 0.75]);
    const ground = place(b.grip, [r * 0.9, r * 1.6, 0]);
    const wound = working < 0 ? 0 : ramp(working, 0.1, 0.8);
    lines.push(groundLoops(from, [ground[0], ground[1], 0], r * (1.05 - 0.4 * wound), few ? 1 : 2, 3));
    if (working >= 0 && b.standSpin) {
      const st = place(b.standSpin, [0, 0, standH(s) * 0.62]), to = place(b.prop, [0, 0, r]);
      threads(g, view, [[st, mixV(st, to, 0.5), to]], mid, front, w, ramp(working, 0.06, 0.14) * (1 - ramp(working, 0.86, 0.94)));
    }
  }
  if (s.carry === 'spindle' && b.prop) {
    const L = s.prop.r[1], tip = place(b.prop, [0, L * 1.08, 0]), down = working < 0 ? 0 : ramp(working, 0.06, W.drop) * (1 - ramp(working, W.catch, 0.9));
    const ground = place(b.level, [-0.5, 0.95, -s.high]);
    if (down < 0.5) lines.push(groundLoops(tip, [ground[0], ground[1], 0], 0.12, few ? 1 : 2, 11));
    if (down > 0.02) {
      const top = place(b.prop, [0, L * 1.0, 0]), foot = b[`${KEYS[1]}2`].t;
      threads(g, view, [[foot, mixV(foot, top, 0.5), top]], mid, front, w, down);
    }
  }
  // Swags down each side between its knees, the nearer side over it.
  const swag = s.stage === 0 ? [] : s.stage === 1 ? [[2, 4], [4, 6]] : [[0, 2], [2, 4], [4, 6]];
  for (const sd of [0, 1]) {
    for (const [p0, p1] of swag) {
      const ka = add(knee(p0 + sd), sway(p0)), kb = add(knee(p1 + sd), sway(p1)), d = len3(sub(ka, kb));
      lines.push(sagged(ka, kb, d * 0.38, few ? 5 : 9));
      if (!few) lines.push(sagged(mixV(ka, b[`${KEYS[p0 + sd]}2`].t, 0.3), mixV(kb, b[`${KEYS[p1 + sd]}2`].t, 0.25), d * 0.3, 9));
    }
  }
  // Threads under its body from side to side, between its middle knees.
  if (s.stage > 0 && !front && !few) {
    for (const [l, r] of [[2, 5], [4, 3]]) {
      const ka = mixV(knee(l), b[`${KEYS[l]}2`].t, 0.35), kb = mixV(knee(r), b[`${KEYS[r]}2`].t, 0.35);
      lines.push(sagged(ka, kb, Math.min(ka[2], kb[2]) * 0.45, 10));
    }
  }
  // The canopy: silk strung round the tops of its posts, sagging, and across them.
  if (s.frame) {
    const tops = [0, 2, 3, 1].map((q) => b[`post${q}`].t);
    for (let q = 0; q < 4; q++) {
      const ta = tops[q], tb = tops[(q + 1) % 4], d = len3(sub(ta, tb));
      lines.push(sagged(ta, tb, d * 0.16, few ? 6 : 10));
      if (!few) lines.push(sagged(ta, tb, d * 0.28 + 0.01 * cyc(t, 4, q), 10), sagged(ta, tb, d * 0.4 + 0.012 * cyc(t, 3, q), 10));
    }
    if (!few) for (const [p, q] of [[0, 2], [1, 3]]) lines.push(sagged(tops[p], tops[q], 0.1, 12));
    // Its work: silk drawn up from its spinnerets over the back post tops, three lines rising, and the skein's thread.
    if (working >= 0) {
      const spin = place(b.abd, onEgg([0, 0, 0], s.abd.r, [0, -1, -0.25]).p), k = ramp(working, 0.1, 0.2) * (1 - ramp(working, 0.66, 0.8));
      const climb = (working * 3) % 1, rising: V3[][] = [];
      for (const [q, off] of [[1, 0], [2, 0.33], [3, 0.66]] as Array<[number, number]>) {
        const top = tops[q], u = frac(climb + off), pts = sagged(spin, top, 0.06, 10);
        rising.push(pts.slice(0, Math.max(2, Math.round(2 + u * 9))));
      }
      threads(g, view, rising, mid, front, w * 1.1, k);
      // From each front foot as it reaches up, silk to the post on its side.
      const up = reachUp(working);
      if (up > 0.05) threads(g, view, [0, 1].map((q) => { const f = b[`${KEYS[q]}2`].t, top = tops[q ? 0 : 3]; return [f, mixV(f, top, 0.5), top]; }), mid, front, w, up);
      if (working > 0.14 && working < W.fall && b.skein) {
        const at = place(b.skein, [0, 0, 0]), top = b[`post${SKEIN_POST}`].t;
        threads(g, view, [[top, mixV(top, at, 0.5), at]], mid, front, w, ramp(working, 0.14, 0.22));
      }
    }
  }
  threads(g, view, lines, mid, front, w);
}

/** The Webloom's spindle twirling: a few curved strokes round its cop, the faster it spins the more of them. */
function twirlMarks(g: CanvasRenderingContext2D, view: View, s: Spider, b: Bones, t: number, front: boolean): void {
  const W = SPIDER_WORK, fast = ramp(t, W.flick, W.flick + 0.04) * (1 - ramp(t, W.catch - 0.15, W.catch));
  if (fast <= 0.02 || !b.grip) return;
  const cr = s.prop.r[2], L = s.prop.r[1], lines: V3[][] = [];
  for (let k = 0; k < 2; k++) {
    const y = L * (0.1 - 0.4 * k), r = cr * (1.5 - 0.2 * k), a0 = t * 40 + k * 2;
    lines.push(Array.from({ length: 7 }, (_, q) => {
      const a = a0 + (q / 6) * 2.2;
      return place(b.grip, [Math.cos(a) * r, y, Math.sin(a) * r]);
    }));
  }
  threads(g, view, lines, b.body.t, front, pxOf(g) * 1.1, 0.8 * fast);
}

/** The pounce landing: a quick bright spray of short lines out from where its front feet come down. */
function pounce(g: CanvasRenderingContext2D, view: View, s: Spider, b: Bones, t: number): void {
  const hit = SPIDER_HITS[s.stage], since = (t - hit) * ACT_SECS.strike;
  if (since < 0 || since > 0.18) return;
  const k = 1 - since / 0.18, px = pxOf(g), r = reachOf(s) * (0.25 + since * 2);
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = css([255, 250, 228], 0.9 * k);
  g.lineWidth = Math.max(px * 1.8, s.legs[0].w * 0.5);
  for (const q of [0, 1]) {
    const f = b[`${KEYS[q]}2`].t, [x, y] = onScreen(view, f);
    g.beginPath();
    for (let j = 0; j < 4; j++) {
      const an = Math.PI * (1.1 + 0.27 * j);
      g.moveTo(x + Math.cos(an) * r * 0.4, y + Math.sin(an) * r * 0.3);
      g.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r * 0.75);
    }
    g.stroke();
  }
  g.restore();
}

const LEAF_RGB: readonly RGB[] = [[120, 158, 80], [176, 196, 116]];

/** Evolving: strands of silk and leaves spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Spider, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.08, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const mid = b.body.t, rx = reachOf(s) * 1.1 + 0.2, high = s.high + s.head.at[2] + s.head.r[2] * 2, px = pxOf(g);
  const arcs: V3[][] = [];
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.08 - 0.1 * jitter(q + 13)) / 0.34), ang = (q / 18) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const at = (da: number): V3 => [mid[0] + Math.cos(ang + da) * rx * kk, mid[1] + Math.sin(ang + da) * rx * kk, 0.1 + u * high + da * 0.3];
    if (q % 3 === 0) {
      const p = at(0);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p), c = LEAF_RGB[q % 2], r = 0.07;
      g.fillStyle = css(c, swirl);
      g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), swirl);
      g.lineWidth = Math.max(px * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.42, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    } else arcs.push([at(-0.25), at(-0.12), at(0)]);
  }
  threads(g, view, arcs, mid, front, px * 1.2, swirl);
}

/** Light over it as it evolves: a soft cream glow as it begins, and over its head at the turn. */
function spiderGlow(s: Spider, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], big = s.high + s.head.at[2] + s.head.r[2];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: b.body.t, r: big * 1.4, c: [255, 246, 214], a: 0.5 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: b.head.t, r: big * 1.4, c: [244, 255, 220], a: k });
  return out;
}

/* ---- its pieces ------------------------------------------------------------------------------ */

/** A stage's pieces. */
function spiderBuild(s: Spider, lod: number): Piece[] {
  const fine = lod > 0, n = cut(lod, 6, 8), k = cut(lod, 4, 6), pieces: Piece[] = [];
  const headHide = headSolid(s);
  pieces.push({ key: 'body', mesh: bodyOf(s, n, k, fine), bone: 'body', bias: 0, lines: false, breathes: { c: [0, 0, 0], k: 0.04 } });
  pieces.push({ key: 'abd', mesh: abdOf(s, n, k, fine), bone: 'abd', bias: -0.01, lines: s.stage === 2 ? undefined : false, breathes: { c: [0, 0, 0], k: 0.06 } });
  const back = backEgg(s);
  pieces.push({ key: 'cloak', mesh: cloakOf(s, fine), bone: 'body', bias: 0.02, after: ['abd', 'body'], hide: [{ c: back.c, r: scale(back.r, 0.9) }] });
  if (s.stage === 2) pieces.push({ key: 'abdLeaves', mesh: abdLeavesOf(s, fine), bone: 'abd', bias: 0.015, after: ['abd'], hide: abdSolid(s) });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false, fine), shut: headOf(s, n, k, true, fine), bone: 'head', bias: 0.12, lines: false });
  pieces.push({ key: 'ruff', mesh: ruffOf(s, fine), bone: 'body', bias: 0.11, after: 'body', hide: bodySolid(s), lines: false });
  for (let i = 0; i < 2; i++) {
    const e = earOf(s, n);
    pieces.push({ key: `ear${i}`, mesh: i ? e : mirror(e), bone: `ear${i}`, bias: 0.121, after: 'head', hide: headHide, hideIn: 'head' });
  }
  if (s.crown.count || s.crown.cap) pieces.push({ key: 'crown', mesh: crownOf(s, fine), bone: 'head', bias: 0.125, after: ['head', 'ear0', 'ear1'], hide: headHide });
  // Legs: each from its hip out of its body's side, a knee up, a shin down to a dark point.
  for (let q = 0; q < 8; q++) {
    const L = s.legs[pairOf(q)], key = KEYS[q], sd = sideOf(q), front: V3 = [sd * 0.75, [0.45, 0.15, -0.15, -0.45][pairOf(q)], 0];
    pieces.push(
      { key: `${key}0`, mesh: thighOf(s, L, n - 1), bone: `${key}0`, bias: 0.01, after: 'body', front, convex: true },
      { key: `${key}1`, mesh: shinOf(s, L, n - 1, fine), bone: `${key}1`, bias: 0.02, after: ['body', 'abd', `${key}0`], front },
      // The foot's bone, with no facets on it: what its stride is measured by.
      { key: `${key}2`, mesh: mesh([[0, 0, 0]], []), bone: `${key}2`, bias: 0, rim: false },
    );
  }
  // The forepaws, and what they carry.
  for (let i = 0; i < 2; i++) {
    const out: V3 = [i ? 1 : -1, 0.4, 0], m = (x: Mesh): Mesh => (i ? x : mirror(x));
    pieces.push(
      { key: `arm${i}`, mesh: m(palpOf(s, n - 1, 0)), bone: `arm${i}`, bias: 0.04, after: ['body', 'ruff'], front: out },
      { key: `fore${i}`, mesh: m(palpOf(s, n - 1, 1)), bone: `elbow${i}`, bias: 0.045, after: ['body', 'ruff', `arm${i}`], front: out },
      { key: `paw${i}`, mesh: palpOf(s, n, 2), bone: `hand${i}`, bias: 0.06, after: [...(s.carry !== 'none' ? ['prop'] : []), `fore${i}`], front: [0, 1, 0] },
    );
  }
  if (s.carry === 'ball') pieces.push({ key: 'prop', mesh: ballOf(s, n, k, fine), bone: 'prop', bias: 0.05, lines: false });
  if (s.carry === 'spindle') pieces.push({ key: 'prop', mesh: spindleOf(s, n, fine), bone: 'prop', bias: 0.05 });
  // The Sprindle's spindle stand, only while it works.
  if (s.stage === 0) {
    const working = (a: Anim): boolean => a.act?.kind === 'work';
    pieces.push(
      { key: 'stand', mesh: standOf(s, n), bone: 'stand', bias: 0.03, shown: working },
      { key: 'standSpin', mesh: standSpindleOf(s, n), bone: 'standSpin', bias: 0.031, after: 'stand', shown: working, lines: false },
    );
  }
  if (s.frame) {
    postsOf(s).forEach((pt, q) => pieces.push({ key: `post${q}`, mesh: postOf(s, pt.root, pt.up, n - 1), bone: 'abd', bias: 0.03, after: ['abd', 'cloak'], hide: abdSolid(s) }));
    pieces.push({ key: 'garlands', mesh: garlandsOf(s, fine), bone: 'abd', bias: 0.022, after: ['abd'], hide: abdSolid(s), lines: false });
    pieces.push({ key: 'skein', mesh: skeinOf(s, fine), bone: 'skein', bias: 0.05, shown: (a) => a.act?.kind === 'work' && a.act.t > 0.14 && a.act.t < 0.98 });
  }
  if (s.tassels) {
    for (let q = 0; q < 8; q++) {
      const L = s.legs[pairOf(q)];
      if (!fine && q % 2 === 1 && pairOf(q) % 2 === 1) continue;
      pieces.push({ key: `tas${q}`, mesh: tasselOf(L.len[0] * 0.5, L.w * 0.7, fine), bone: `tas${q}`, bias: 0.03, after: [`${KEYS[q]}0`, `${KEYS[q]}1`], lines: fine ? undefined : false });
    }
    TASSEL_ABD.forEach((_, q) => {
      if (!fine && q === 4) return;
      pieces.push({ key: `tasA${q}`, mesh: tasselOf(s.abd.r[2] * 0.62, s.abd.r[0] * 0.07, fine), bone: `tasA${q}`, bias: 0.02, after: ['abd', 'garlands'], front: unit([TASSEL_ABD[q][0], TASSEL_ABD[q][1], 0]) });
    });
  }
  return pieces;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the silk it draws by hand. */
function spiderKind(s: Spider): Kind {
  return {
    bones: spiderBones(s),
    build: (lod) => spiderBuild(s, lod),
    // The variant's coat is its brown fur and the brown bands of its legs, kept rich; its markings the cream of its face, its
    // belly and its legs' other bands. Its leaves, flowers, silk, yarn and wood, and its dark eyes, are the same on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, pastel(coat, 30), 0.28), cream = mix([252, 244, 226], pastel(mark, 40), 0.55);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [44, 28, 22], 0.42),
        coatLight: mix(fur, [255, 240, 214], 0.4),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 254, 250], 0.45),
        nose: mix(fur, [40, 24, 20], 0.62),
        inner: cream,
        lid: mix(fur, [30, 18, 16], 0.6),
        eye: [26, 20, 22],
        glint: [255, 255, 255],
        leaf: [100, 140, 70],
        moss: [146, 172, 94],
        // The weave of the Silkward's abdomen and the bindings of its posts: its coat and its markings together.
        horn: mix(fur, cream, 0.62),
        leafDark: [72, 102, 54],
        stem: [172, 198, 118],
        bloom: [254, 252, 244],
        spot: [246, 202, 92],
        shell: [248, 240, 220],
        shellDark: [208, 186, 142],
        string: [236, 222, 190],
        wood: [196, 150, 98],
        woodDark: [140, 100, 62],
        grip: [150, 112, 70],
        bark: [112, 78, 52],
      }, 30);
    },
    shadow: [s.abd.r[1] + s.body[1] + 0.1, s.legs[1].foot[0] * 0.75],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are silk's cream and a leaf's green.
    motes: [[250, 244, 226], [150, 186, 100]],
    glow: (b, a) => spiderGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      silkOf(g, view, s, b, a, front);
      if (act?.kind === 'work' && s.stage === 1) twirlMarks(g, view, s, b, act.t, front);
      if (act?.kind === 'strike' && front) pounce(g, view, s, b, act.t);
      if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SPRINDLE = spiderKind(SPRINDLE_LOOK);
export const WEBLOOM = spiderKind(WEBLOOM_LOOK);
export const SILKWARD = spiderKind(SILKWARD_LOOK);
