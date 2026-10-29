import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, LOOP, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, smile, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut, earMesh } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The bee line: the Buzzlet, a small fuzzy bee on four dark jointed legs, a
 * round yellow head with big dark eyes, small brown ears and two long curled
 * feelers, a cream collar of fur, a striped abdomen with a little sting, two
 * pairs of glassy veined wings, and a glossy drop of honey held in its
 * forepaws; which grows into the Combworker, bigger, a ruff of cream and
 * yellow petals round its neck and petal points on its head, fat fuzzy
 * pollen thighs, a bigger abdomen and bigger wings, carrying a piece of comb
 * dripping honey; and then the Hivemaster, large and stout and carried
 * upright, a big crown and ruff of petals, green leaf sashes down its sides
 * and a skirt of leaves at its waist, huge pollen thighs, armoured
 * forelegs, very large wings, and a big slab of comb held against its side.
 * The species is still `vesp` underneath, as saves and the database know it:
 * it works the hives of its settlement, out to the wildflowers and back, and
 * stings.
 *
 * Each is its variant's coat in its fur and its markings in its stripes,
 * its ears, its mask and its legs. All three are built by one set of
 * functions from a description of the stage (`Bee`), the way the penguin
 * line is (`./wild-penguin`): each leg bent to put its foot where it is to
 * be, each foreleg bent to put its paw on what it carries, and what it
 * carries posed level, whatever the body does. It scuttles on its four legs
 * in diagonal pairs.
 *
 * Its wings are glass, which a facet cannot be: they are drawn by hand
 * (`Kind.extra`), each a pale veined pane you see the body through, the far
 * ones under the body and the near ones over it, and a blur of panes as they
 * buzz -- going, at its work, striking, and now and then standing about.
 * A piece with corners and no facets stands for each (`wingReach`), so the
 * kind is framed and named over its wingtips.
 *
 * At its task the Buzzlet dabs at its honey drop, patting and smoothing it;
 * the Combworker presses its comb between its paws, turns it and smooths its
 * face, honey running; the Hivemaster swings its comb panel down in front of
 * it, sets it in place and presses it home in a burst of pollen, and takes it
 * up again (`BEE_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** A pair of legs, on the right: its hip in the body's frame, its two lengths and thickness, and where its foot stands (out, ahead) on the ground. */
interface Leg { at: V3; len: [number, number]; w: number; stance: number; ahead: number }
/** A wing: its span and its chord, how far it is raised and swept back standing (degrees), and the way its upper face looks (right wing). */
interface Wing { span: number; chord: number; lift: number; sweep: number; face: V3 }

interface Bee {
  stage: 0 | 1 | 2;
  size: number;
  /** How high the middle of the thorax is carried, and how far nose-up the body is, in degrees. */
  high: number;
  pitch: number;
  /** The thorax's half-sizes. */
  thorax: V3;
  /**
   * The abdomen: its root on the thorax, how long, how wide and deep at its widest, how far its tip droops (degrees), and where
   * along it each stripe starts, a share of its length: yellow to the first, then brown, then yellow.
   */
  abd: { at: V3; len: number; w: number; h: number; droop: number; bands: number[] };
  /** The head: its middle in the body's frame, its half-sizes, its eyes' size, and whether a dark mask runs back from each eye. */
  head: { at: V3; r: V3; eye: number; mask: boolean };
  /** An ear's length and width; a feeler's length. */
  ear: [number, number];
  feeler: number;
  /** A ruff of petals round its neck: rows, petals in the outer row, a petal's length and width; none for a collar of fur. */
  ruff: { rows: number; count: number; len: number; w: number } | null;
  /** Petal points round its crown: how many, how long, and how many leaves among them. */
  crown: { count: number; len: number; leaves: number } | null;
  mid: Leg;
  hind: Leg;
  /** The fuzzy pollen basket on each hind thigh: how big; nought for none. */
  thigh: number;
  /** The forelegs: shoulder in the body's frame, two lengths, thickness, and whether plated. */
  arm: { at: V3; len: [number, number]; w: number; armour: boolean };
  /** Where the wings' roots are on the thorax (right side), and the two pairs. */
  root: V3;
  fore: Wing;
  hindWing: Wing;
  /**
   * What it carries: a drop of honey, a piece of comb, a great slab of comb. Where it is held, in the frame of the body carried
   * level (`Plan.prop`), and turned (pitch, roll, yaw); its size: the drop's radius, or the comb's half-width, half-height and
   * half-thickness.
   */
  carry: 'drop' | 'comb' | 'panel';
  prop: { at: V3; turn: V3; r: V3 };
  /** Leaf sashes down each side, leaves round its waist, and puffs of pollen on each side. */
  sash: number;
  skirt: number;
  puffs: number;
  gait: { duty: [number, number]; swing: [number, number]; step: number; bob: number };
}

/** A Buzzlet: small, its head big on it, a cream collar, a drop of honey in its forepaws. */
const BUZZLET_LOOK: Bee = {
  stage: 0,
  size: 5.6,
  high: 0.36,
  pitch: 8,
  thorax: [0.24, 0.23, 0.23],
  abd: { at: [0, -0.15, -0.02], len: 0.62, w: 0.31, h: 0.29, droop: 18, bands: [0.3, 0.5, 0.7] },
  head: { at: [0, 0.3, 0.25], r: [0.33, 0.3, 0.31], eye: 0.12, mask: false },
  ear: [0.2, 0.09],
  feeler: 0.44,
  ruff: null,
  crown: null,
  mid: { at: [0.1, 0.04, -0.15], len: [0.13, 0.17], w: 0.058, stance: 0.25, ahead: 0.12 },
  hind: { at: [0.11, -0.12, -0.14], len: [0.14, 0.18], w: 0.064, stance: 0.28, ahead: -0.26 },
  thigh: 0,
  arm: { at: [0.11, 0.16, -0.1], len: [0.14, 0.15], w: 0.055, armour: false },
  root: [0.09, -0.03, 0.2],
  fore: { span: 0.82, chord: 0.46, lift: 34, sweep: 36, face: [0.72, 0.66, -0.2] },
  hindWing: { span: 0.56, chord: 0.4, lift: 14, sweep: 54, face: [0.66, 0.5, 0.1] },
  carry: 'drop',
  prop: { at: [0, 0.62, -0.1], turn: [0, 0, 0], r: [0.19, 0.19, 0.19] },
  sash: 0,
  skirt: 0,
  puffs: 0,
  gait: { duty: [0.56, 0.46], swing: [0.42, 0.48], step: 0.32, bob: 0.03 },
};

/** A Combworker: bigger, a ruff and crown of petals, fat pollen thighs, a bigger abdomen and wings, a piece of comb. */
const COMBWORKER_LOOK: Bee = {
  stage: 1,
  size: 6.6,
  high: 0.5,
  pitch: 10,
  thorax: [0.3, 0.28, 0.29],
  abd: { at: [0, -0.2, -0.02], len: 0.88, w: 0.41, h: 0.38, droop: 14, bands: [0.2, 0.38, 0.54, 0.7, 0.85] },
  head: { at: [0, 0.34, 0.29], r: [0.3, 0.27, 0.29], eye: 0.1, mask: true },
  ear: [0.2, 0.08],
  feeler: 0.5,
  ruff: { rows: 2, count: 12, len: 0.32, w: 0.11 },
  crown: { count: 5, len: 0.17, leaves: 0 },
  mid: { at: [0.13, 0.05, -0.2], len: [0.17, 0.22], w: 0.066, stance: 0.32, ahead: 0.16 },
  hind: { at: [0.2, -0.08, -0.2], len: [0.2, 0.24], w: 0.07, stance: 0.4, ahead: -0.26 },
  thigh: 0.17,
  arm: { at: [0.13, 0.2, -0.12], len: [0.18, 0.19], w: 0.062, armour: false },
  root: [0.11, -0.04, 0.24],
  fore: { span: 1.08, chord: 0.6, lift: 34, sweep: 36, face: [0.72, 0.66, -0.2] },
  hindWing: { span: 0.72, chord: 0.52, lift: 14, sweep: 54, face: [0.66, 0.5, 0.1] },
  carry: 'comb',
  prop: { at: [0.1, 0.66, -0.2], turn: [0, 0, -34], r: [0.24, 0.22, 0.07] },
  sash: 0,
  skirt: 0,
  puffs: 1,
  gait: { duty: [0.56, 0.46], swing: [0.42, 0.48], step: 0.3, bob: 0.03 },
};

/** A Hivemaster: large and stout, carried upright, a big crown and ruff, leaf sashes and a leaf skirt, huge pollen thighs, a slab of comb. */
const HIVEMASTER_LOOK: Bee = {
  stage: 2,
  size: 6.9,
  high: 0.74,
  pitch: 24,
  thorax: [0.45, 0.42, 0.45],
  abd: { at: [0, -0.26, -0.06], len: 1.22, w: 0.64, h: 0.6, droop: 6, bands: [0.18, 0.34, 0.5, 0.66, 0.82] },
  head: { at: [0, 0.44, 0.4], r: [0.37, 0.34, 0.36], eye: 0.11, mask: true },
  ear: [0.22, 0.09],
  feeler: 0.6,
  ruff: { rows: 3, count: 14, len: 0.38, w: 0.13 },
  crown: { count: 9, len: 0.36, leaves: 2 },
  mid: { at: [0.26, 0.16, -0.28], len: [0.28, 0.34], w: 0.095, stance: 0.48, ahead: 0.3 },
  hind: { at: [0.3, -0.08, -0.32], len: [0.3, 0.36], w: 0.105, stance: 0.62, ahead: -0.16 },
  thigh: 0.25,
  arm: { at: [0.22, 0.26, -0.06], len: [0.26, 0.28], w: 0.09, armour: true },
  root: [0.16, -0.12, 0.32],
  fore: { span: 1.75, chord: 0.92, lift: 32, sweep: 30, face: [0.72, 0.66, -0.2] },
  hindWing: { span: 1.15, chord: 0.76, lift: 14, sweep: 50, face: [0.66, 0.5, 0.1] },
  carry: 'panel',
  prop: { at: [0.66, 0.46, -0.02], turn: [0, 0, -40], r: [0.38, 0.46, 0.13] },
  sash: 3,
  skirt: 9,
  puffs: 2,
  gait: { duty: [0.58, 0.48], swing: [0.36, 0.42], step: 0.26, bob: 0.03 },
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
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
/** A frame squeezed across its `x` by `q` and let out up its `z` by half as much: a thing pressed from its sides. */
const squeezed = (x: Xf, q: number): Xf => {
  const m = x.m, a = 1 - q, c = 1 + q * 0.5;
  return { m: [m[0] * a, m[1], m[2] * c, m[3] * a, m[4], m[5] * c, m[6] * a, m[7], m[8] * c], t: x.t };
};
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
/**
 * A tuft of fur: a soft lobe out from `p` along `d`, `len` long and `w` across, round rather than a cone, so fur is fuzzy at its
 * outline and not a scatter of lit shards.
 */
const tuft = (p: V3, d: V3, len: number, w: number, m: Mat): Mesh => orbAlong(add(p, scale(unit(d), len * 0.42)), d, [w * 0.62, w * 0.5, len * 0.58], 5, 3, m);

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

/** When each stage's sting goes home, as a share of its strike. */
export const BEE_HITS: readonly number[] = [0.5, 0.5, 0.54];
/**
 * A go at its task, as shares of it. The Buzzlet's two dabs at its drop (`dab`, `dab2`) and its smoothing of it (`smooth`). The
 * Combworker's two presses of its comb (`press`, `press2`) and its smoothing of its face (`shape`). The Hivemaster's comb panel
 * swung down and set in place (`set`), pressed home in a burst of pollen (`home`), and taken up again (`lift`).
 */
export const BEE_WORK = {
  dab: 0.3, dab2: 0.5, smooth: 0.7,
  press: 0.24, press2: 0.48, shape: 0.7,
  set: 0.36, home: 0.46, lift: 0.66,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** The legs it stands on, in the order the plan keeps their feet: middle left, middle right, hind left, hind right. */
const LEGS = ['fl', 'fr', 'hl', 'hr'] as const;
const legOfI = (s: Bee, i: number): Leg => (i < 2 ? s.mid : s.hind);
const sideOf = (i: number): number => (i % 2 ? 1 : -1);

/**
 * A pose: where each foot is, how the body is carried, the abdomen, the head and the feelers, the forelegs, what it carries
 * (in the frame of the body carried level), and its wings.
 */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number;
  /** The abdomen curled under (degrees, its tip down), turned to its left, rolled; swollen as it breathes. */
  abd: V3; pump: number;
  /** The head nose-up, turned to its left, tilted; the feelers raised, left and right, and spread. */
  head: V3; ant: number[]; spread: number;
  /** Where each forepaw is when it is off what it carries (the level frame), and how much it is on it. */
  hand: V3[]; on: number[];
  /** What it carries: where (the level frame), turned (pitch, roll, yaw), and squeezed from its sides. */
  prop: V3; turnP: V3; squish: number;
  /** The wings raised past how they are held, fore and hind, and swept further back. */
  wing: V3;
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

/** How high its ankle is over the ground, a foot standing flat. */
const ankleH = (L: Leg): number => L.w * 0.7;
/** How far a leg reaches, hip to ankle. */
const reachOf = (s: Bee): number => s.mid.len[0] + s.mid.len[1];

/** Each foot standing, on the ground under its hip. */
const restFeet = (s: Bee): V3[] => LEGS.map((_, i) => { const L = legOfI(s, i); return [sideOf(i) * L.stance, L.ahead, ankleH(L)] as V3; });

/** Where a forepaw hangs when it holds nothing, in the level frame: tucked in under its chest. */
function pawRest(s: Bee, i: number): V3 {
  const A = s.arm, sd = sideOf(i), c = Math.cos((s.pitch * Math.PI) / 180), sn = Math.sin((s.pitch * Math.PI) / 180);
  const sh: V3 = [sd * A.at[0], A.at[1] * c - A.at[2] * sn, A.at[1] * sn + A.at[2] * c];
  return add(sh, [sd * 0.05, (A.len[0] + A.len[1]) * 0.45, -(A.len[0] + A.len[1]) * 0.55]);
}

/** How it stands with nothing going on: on its four feet, what it carries held in its forepaws, its wings up. */
function restPlan(s: Bee): Plan {
  return {
    at: restFeet(s), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0,
    abd: [0, 0, 0], pump: 0,
    head: [0, 0, 0], ant: [0, 0], spread: 0,
    hand: [pawRest(s, 0), pawRest(s, 1)], on: [1, 1],
    prop: [...s.prop.at], turnP: [...s.prop.turn], squish: 0,
    wing: [0, 0, 0],
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
 * Going: a scuttle on its four legs in diagonal pairs, the middle left with the hind right and then the other two, each foot
 * swept back under it at the ground's own speed and then lifted and brought forward; the body carried low and level with a
 * quick bob at each footfall, the abdomen swaying after it, the feelers swept back, what it carries held still.
 */
function goingPlan(s: Bee, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s), R = restFeet(s);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = reachOf(s), half = L * amp;
  for (let i = 0; i < 4; i++) {
    const A = R[i], ph = frac(a.u + (i === 0 || i === 3 ? 0 : 0.5));
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.3 * g);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    p.at[i] = [A[0] * (1 + 0.15 * Math.sin(Math.PI * u)), y, A[2] + lift * Math.sin(Math.PI * u)];
    p.foot[i] = -18 * Math.sin(Math.PI * u);
  }
  const step2 = Math.sin(2 * TAU * w);
  p.H += -G.bob * L * step2 + g * L * 0.06;
  p.roll = 3 * Math.sin(TAU * w);
  p.yaw = 3 * Math.cos(TAU * w);
  p.pitch = -3 - 3 * g;
  p.abd = [-4 * g + 3 * step2, -12 * Math.sin(TAU * (w - 0.15)), 0];
  p.head = [3 + 2 * step2, -p.yaw * 0.6, -p.roll * 0.6];
  p.ant = [-14 - 8 * g + 5 * step2, -14 - 8 * g - 5 * step2];
  p.spread = 6;
  p.wing = [6, 4, -4];
  return p;
}

/**
 * Standing about: breathing, looking about, the feelers bobbing and now and then twitching; a fuzzy wiggle of its abdomen and a
 * shake of its fur; the weight shifting.
 */
function stillPlan(s: Bee, a: Anim): Plan {
  const p = restPlan(s), t = a.t, look = drift(t);
  p.pump = a.breath - 0.5;
  p.head = [3 * cyc(t, 4) + 4 * beat(t, [5.6, 17.1], 1.2), 14 * look, 5 * drift(t, 3) + 10 * (beat(t, [11.2], 1.4) - beat(t, [20.4], 1.2))];
  // The feelers bobbing, out of step, and twitched now and then.
  const twitch = beat(t, [2.4, 8.8, 14.6, 21.8], 0.6) * Math.sin(t * TAU * 4);
  p.ant = [8 * cyc(t, 6) + 10 * twitch, 8 * cyc(t, 6, 1.4) - 8 * twitch];
  p.spread = 3 * cyc(t, 3);
  // The fuzzy wiggle: its abdomen shaken from side to side, quick, and the body shivering with it.
  const wig = beat(t, [7.2, 18.4], 1.0), sh = wig * Math.sin(t * TAU * 5);
  p.abd = [2 * cyc(t, 2) - 4 * wig, 16 * sh, 8 * sh];
  p.roll = 2.5 * sh + 1.2 * cyc(t, 3);
  p.side = 0.006 * sh;
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
 * A strike: a sting. It rears back with its abdomen curled forward under it and its wings up, then lunges, jabbing the sting
 * forward under its chest, and shakes back to how it stood.
 */
function strikePlan(s: Bee, t: number): Plan {
  const p = restPlan(s), hit = BEE_HITS[s.stage], L = reachOf(s);
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.34, hit) * (1 - ramp(t, hit + 0.16, 0.95));
  const since = (t - hit) * ACT_SECS.strike;
  // Reared up on its hind legs as it lunges, so the abdomen swung forward under it puts the sting out ahead of its forelegs.
  p.surge = L * (-0.3 * wind + 0.6 * blow);
  p.pitch = 10 * wind + 24 * blow;
  p.H += L * (0.04 * wind + 0.1 * blow);
  p.abd = [36 * wind + 104 * blow + 10 * ringOut(since, 3, 5), 0, 0];
  p.head = [8 * wind - 8 * blow, 0, 0];
  p.ant = [16 * wind - 22 * blow, 16 * wind - 22 * blow];
  p.spread = 10 * wind;
  p.wing = [18 * wind + 8 * blow, 14 * wind, -10 * wind];
  for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 0.4 * blow, 0]);
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));

/**
 * The Buzzlet's go: its head bent to its drop, its right forepaw lifted off it and patted onto its top twice, the drop squashed
 * a little each time, then drawn across its top to smooth it, and back to holding it (`BEE_WORK`).
 */
function dabPlan(s: Bee, t: number, p: Plan): void {
  const W = BEE_WORK, r = s.prop.r[0], at = s.prop.at;
  const off = ramp(t, 0.12, 0.22) * (1 - ramp(t, 0.82, 0.9));
  const over: V3 = add(at, [0.02, -r * 0.1, r * 1.55]), on: V3 = add(at, [0.01, -r * 0.05, r * 0.95]);
  p.hand[1] = path(t, [
    [0.12, add(at, [r * 0.95, -r * 0.2, 0])], [0.22, over], [W.dab, on], [W.dab + 0.08, over], [W.dab2, on], [W.dab2 + 0.08, over],
    [W.smooth - 0.06, add(at, [-r * 0.6, 0, r * 1.05])], [W.smooth + 0.08, add(at, [r * 0.7, 0, r * 1.0])], [0.88, add(at, [r * 0.95, -r * 0.2, 0])],
  ]);
  p.on[1] = 1 - off;
  p.squish = 0.28 * (hump(t, W.dab, 0.06) + hump(t, W.dab2, 0.06)) + 0.08 * hump(t, W.smooth + 0.01, 0.07);
  p.prop = add(p.prop, [0, 0, -0.03 * (hump(t, W.dab, 0.05) + hump(t, W.dab2, 0.05))]);
  const busy = ramp(t, 0.06, 0.2) * (1 - ramp(t, 0.84, 0.96));
  p.head = [-18 * busy + 6 * hump(t, W.dab, 0.05) + 6 * hump(t, W.dab2, 0.05), 0, 4 * busy];
  p.ant = [16 * busy, 12 * busy];
  p.pitch = -4 * busy;
  p.abd = [0, 10 * Math.sin(t * TAU * 2) * busy, 0];
}

/**
 * The Combworker's go: its comb brought in and pressed between its forepaws, squeezed and let go, turned and pressed again; then
 * its right paw drawn across its face to smooth it, honey running off it (`BEE_WORK`).
 */
function pressPlan(s: Bee, t: number, p: Plan): void {
  const W = BEE_WORK, [w, h] = s.prop.r, at = s.prop.at;
  const busy = ramp(t, 0.04, 0.16) * (1 - ramp(t, 0.86, 0.98));
  p.prop = add(p.prop, [-0.04 * busy, -0.08 * busy, 0.04 * busy]);
  p.turnP = add(p.turnP, [6 * busy, 0, lerp(0, 34, ramp(t, W.press + 0.06, W.press2 - 0.06)) * (1 - ramp(t, W.shape + 0.1, 0.94))]);
  p.squish = 0.2 * (hump(t, W.press, 0.07) + hump(t, W.press2, 0.07));
  const off = ramp(t, W.press2 + 0.08, W.shape - 0.08) * (1 - ramp(t, W.shape + 0.1, 0.9));
  p.on[1] = 1 - off;
  p.hand[1] = path(t, [[W.press2 + 0.08, add(at, [w, -0.02, 0])], [W.shape - 0.08, add(at, [-w * 0.6, h * 0.1, h * 0.5])], [W.shape + 0.1, add(at, [w * 0.7, h * 0.1, -h * 0.3])], [0.9, add(at, [w, -0.02, 0])]]);
  p.head = [-12 * busy, 0, 4 * busy];
  p.ant = [14 * busy, 10 * busy];
  p.pitch = -5 * busy - 3 * (hump(t, W.press, 0.07) + hump(t, W.press2, 0.07));
  p.H -= 0.02 * (hump(t, W.press, 0.07) + hump(t, W.press2, 0.07));
}

/**
 * The Hivemaster's go: its comb panel swung down off its side to the ground in front of it, set upright there, pressed home with
 * its weight behind it in a burst of pollen, then lifted and swung back against its side (`BEE_WORK`).
 */
function setPlan(s: Bee, t: number, p: Plan): void {
  const W = BEE_WORK, h = s.prop.r[1], R = s.prop.at, T = s.prop.turn;
  // Set down with its foot on the ground, the body let down by as much as it is here (`p.H` below).
  const set: V3 = [0.08, 0.95, -s.high + 0.1 + h + 0.03], setTurn: V3 = [0, 0, 6];
  p.prop = path(t, [[0.08, R], [W.set - 0.1, [0.32, 0.9, -s.high * 0.4]], [W.set, set], [W.lift, set], [W.lift + 0.12, [0.32, 0.8, -s.high * 0.35]], [0.9, R]]);
  p.turnP = path(t, [[0.08, T], [W.set - 0.1, [8, 0, 20]], [W.set, setTurn], [W.lift, setTurn], [W.lift + 0.12, [8, 0, 24]], [0.9, T]]);
  const busy = ramp(t, 0.08, W.set) * (1 - ramp(t, W.lift, 0.9));
  const push = hump(t, W.home, 0.07);
  p.pitch = -16 * busy - 6 * push;
  p.surge = 0.12 * busy;
  p.H -= 0.1 * busy + 0.04 * push;
  p.head = [-10 * busy, 0, 0];
  p.ant = [10 * busy, 10 * busy];
  p.wing = [10 * push, 8 * push, 0];
  p.prop = add(p.prop, [0, 0, -0.03 * push]);
  p.at[0] = add(p.at[0], [0, 0.12 * busy, 0]);
  p.at[1] = add(p.at[1], [0, 0.18 * busy, 0]);
}

/** A go at its task, by stage: the Buzzlet's dab, the Combworker's press, the Hivemaster's setting, eased in from how it stands. */
function workPlan(s: Bee, t: number, down: number): Plan {
  const p = restPlan(s);
  if (s.stage === 0) dabPlan(s, t, p);
  else if (s.stage === 1) pressPlan(s, t, p);
  else setPlan(s, t, p);
  return mixPlan(restPlan(s), p, down);
}

/** Feeding where it stands: bent down, its head at the flowers, its feelers down and working. */
function grazePlan(s: Bee, a: Anim): Plan {
  const p = restPlan(s), t = a.t;
  const sip = Math.max(0, Math.sin(t * TAU * 1.2)) ** 2;
  p.pitch = -12;
  p.head = [-30 - 6 * sip, 8 * drift(t, 2), 0];
  p.ant = [-10 + 10 * sip, -10 + 8 * Math.sin(t * TAU * 1.2 + 1)];
  p.H -= 0.06 * reachOf(s);
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall with its wings high at the turn, a shake, and settled. */
function evolvePlan(s: Bee, t: number): Plan {
  const p = restPlan(s), L = reachOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.7, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.2 * hunch + 0.25 * up);
  p.pitch = -8 * hunch + 14 * up;
  p.head = [-12 * hunch + 14 * up, 0, 14 * shake];
  p.abd = [16 * hunch - 8 * up, 14 * shake, 0];
  p.roll = 4 * shake;
  p.ant = [-14 * hunch + 20 * up, -14 * hunch + 20 * up];
  p.spread = 12 * up;
  p.wing = [-14 * hunch + 24 * up, -10 * hunch + 20 * up, -10 * hunch - 14 * up];
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Bee, a: Anim): Plan {
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

/* ---- its wings, in time ------------------------------------------------------------------ */

/**
 * How its wings are this moment: how far through their beat (degrees of lift past where they are held) and how much of a blur
 * they are, nought still to one buzzing. Buzzing going, at its work and as it strikes and evolves; standing, a slow fan now and
 * then broken by a buzz.
 */
function buzzOf(s: Bee, a: Anim): { flap: number; blur: number } {
  const t = a.t, act = a.act, go = smooth(a.go);
  let buzz = Math.max(go, beat(t, [3.4, 9.9, 15.6, 22.2], 1.3));
  if (act?.kind === 'work') buzz = Math.max(buzz, s.stage === 2 ? 0.5 + 0.5 * hump(act.t, BEE_WORK.home, 0.12) : 0.45);
  if (act?.kind === 'strike') buzz = Math.max(buzz, ramp(act.t, 0.05, 0.3) * (1 - ramp(act.t, 0.75, 0.98)));
  if (act?.kind === 'evolve') buzz = Math.max(buzz, ramp(act.t, 0.38, 0.5) * (1 - ramp(act.t, 0.8, 0.98)));
  const ph = a.go > 0.5 ? frac(a.u) * TAU * 5.5 : act ? act.t * TAU * 19.5 : (t * TAU * 47) / 6.1;
  const amp = [34, 30, 26][s.stage];
  return { flap: buzz * amp * Math.sin(ph) + (1 - buzz) * (5 * cyc(t, 8) + 2 * cyc(t, 19)), blur: buzz };
}
/** How far either way of where it is held a buzzing wing goes, in degrees: the blur's spread. */
const blurAmp = (s: Bee): number => [34, 30, 26][s.stage];

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

/** Where a wing's root is (right side) for the forewing (0) and the hindwing (1), in the body's frame. */
const wingRoot = (s: Bee, k: number): V3 => (k ? add(s.root, [-0.01, -s.thorax[1] * 0.28, -0.02]) : s.root);
/**
 * A wing's bone from its root's frame: its span raised by `lift` and swept back by `sweep` (degrees), out to the right (sd one)
 * or the left, its face turned as near the way the wing says as that allows.
 */
function wingXf(base: Xf, w: Wing, sd: number, lift: number, sweep: number): Xf {
  const l = (lift * Math.PI) / 180, sw = (sweep * Math.PI) / 180;
  const X: V3 = [sd * Math.cos(l) * Math.cos(sw), -Math.cos(l) * Math.sin(sw), Math.sin(l)];
  // Its face as near the way it is to look as its span allows; for the left, mirrored, and the span's x with it.
  let Z = sub([sd * w.face[0], w.face[1], w.face[2]], scale(X, dot([sd * w.face[0], w.face[1], w.face[2]], X)));
  Z = unit(Z);
  // Built out along +x for the right wing and -x for the left: the left's x and chord turned round, so it is the right one's mirror.
  return compose(base, xfOf(scale(X, sd), scale(cross(X, Z), sd), scale(Z, -1), [0, 0, 0]));
}

/** Where a feeler's root is on the head (right side), in the head's frame. */
const feelerRoot = (s: Bee): V3 => onEgg([0, 0, 0], s.head.r, [0.2, 0.5, 0.84]).p;

/** Where its forepaws take hold of what it carries, left and right, in its own frame. */
function grips(s: Bee): V3[] {
  const r = s.prop.r;
  if (s.carry === 'drop') return [[-r[0] * 0.92, -r[0] * 0.3, -r[0] * 0.05], [r[0] * 0.92, -r[0] * 0.3, -r[0] * 0.05]];
  if (s.carry === 'comb') return [[-r[0] * 0.98, 0, -r[1] * 0.05], [r[0] * 0.98, 0, r[1] * 0.1]];
  // The panel against its side: the near edge held in its left paw low, its top in its right.
  return [[-r[0] * 0.95, 0, -r[1] * 0.1], [-r[0] * 0.15, 0, r[1] * 0.98]];
}

/**
 * The bones of a stage: the body carried level (`level`) and pitched up as the stage is (`body`), the abdomen on it, the head
 * held level whatever the body does, the feelers, each leg bent to put its foot where it is to be, each foreleg bent to put its
 * paw on what it carries or where it is to be, what it carries, and each wing on its root.
 */
function beeBones(s: Bee): (a: Anim) => Bones {
  const G = grips(s);
  return (a0) => {
    const a = { ...a0, go: a0.act ? 0 : a0.go };
    const P = planOf(s, a);
    const level = joint(ROOT, [P.side, P.surge, P.H], 0, P.roll, P.yaw);
    const tilt = s.pitch + P.pitch;
    const body = joint(level, [0, 0, 0], tilt, 0, 0);
    const b: Bones = { level, body };
    b.abd = joint(body, s.abd.at, s.abd.droop + P.abd[0], P.abd[2], P.abd[1]);
    b.head = joint(body, s.head.at, -tilt + P.head[0], P.head[2] - P.roll * 0.5, P.head[1]);
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1, r = feelerRoot(s);
      b[`ant${k}`] = joint(b.head, [sd * r[0], r[1], r[2]], P.ant[k], 0, -sd * P.spread);
    }
    // Legs: the knee up and out, as an insect's is; the foot level, turned out.
    const fwd = turn(level, [0, 1, 0]);
    for (let i = 0; i < 4; i++) {
      const L = legOfI(s, i), sd = sideOf(i), key = LEGS[i];
      const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
      const hint = turn(level, i < 2 ? [sd * 0.75, 0.25, 0.9] : [sd * 0.95, -0.3, 0.08]);
      const { mid: knee, end: at } = bend2(hip, P.at[i], L.len[0], L.len[1], hint);
      const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
      const out = unit([fwd[0] + sd * 0.35 * fwd[1], fwd[1] - sd * 0.35 * fwd[0], 0]);
      const [X2, Y2, Z2] = frameOf([0, 0, 1], i < 2 ? out : unit(add(out, scale(fwd, -0.6))));
      b[`${key}0`] = xfOf(X0, Y0, Z0, hip);
      b[`${key}1`] = xfOf(X1, Y1, Z1, knee);
      b[`${key}2`] = joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], P.foot[i]);
    }
    // What it carries, posed in the level frame and squeezed as the pose says; the paws on it.
    const propL = squeezed(joint(ROOT, P.prop, P.turnP[0], P.turnP[1], P.turnP[2]), P.squish);
    b.prop = compose(level, propL);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, A = s.arm;
      const sh = place(body, [sd * A.at[0], A.at[1], A.at[2]]);
      const want = place(level, mixV(P.hand[i], place(propL, G[i]), P.on[i]));
      const { mid: el, end: tip } = bend2(sh, want, A.len[0], A.len[1], turn(level, [sd * 0.9, -0.3, -0.5]));
      const ref = turn(level, [0, 1, 0]);
      const [X0, Y0, Z0] = frameOf(sub(sh, el), ref), [X1, Y1, Z1] = frameOf(sub(el, tip), ref);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      b[`hand${i}`] = xfOf(X1, Y1, Z1, tip);
    }
    // The wings: each from its root on the thorax, held up off a frame tilted only a little with the body, so the Hivemaster
    // upright holds them up off its back as the Buzzlet does.
    const W = buzzOf(s, a), base = joint(level, [0, 0, 0], tilt * 0.35, 0, 0);
    for (let k = 0; k < 4; k++) {
      const sd = k % 2 ? 1 : -1, hindW = k >= 2, w = hindW ? s.hindWing : s.fore;
      const r = wingRoot(s, hindW ? 1 : 0), root = place(body, [sd * r[0], r[1], r[2]]);
      const rx = { m: base.m, t: root };
      b[`wr${k}`] = rx;
      const lift = w.lift + P.wing[hindW ? 1 : 0] + W.flap * (hindW ? 0.85 : 1);
      b[`wing${k}`] = wingXf(rx, w, sd, lift, w.sweep + P.wing[2]);
    }
    const sk = 1;
    b.shadow = { m: [sk, 0, 0, 0, sk, 0, 0, 0, 1], t: [level.t[0], level.t[1] - s.abd.len * 0.25 * Math.cos((tilt * Math.PI) / 180), 0] };
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------- */

/** The thorax: a round furry ball, tufts of fur standing out over its back and sides. In the body's frame. */
function thoraxOf(s: Bee, n: number, k: number, fine: boolean): Mesh {
  const R = s.thorax, c: V3 = [0, 0, 0], out: Mesh[] = [orb(c, R, n + 2, k + 1, 'coat')];
  const N = fine ? 9 : 5;
  for (let q = 0; q < N; q++) {
    // Spread over its back and sides, not its front (where the head is) nor under it.
    const u = (q + 0.5) / N, az = q * 2.39996 + 0.3, el = lerp(-0.35, 1.1, u);
    const d = unit([Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el) * 0.9 - 0.2, Math.sin(el)]);
    if (d[1] > 0.55) continue;
    const e = onEgg(c, R, d), L = R[0] * (0.16 + 0.08 * jitter(q + 3));
    out.push(tuft(add(e.p, scale(e.n, -L * 0.3)), add(e.n, [0, -0.35, 0.1]), L, R[0] * 0.22, 'coat'));
  }
  return merge(...out);
}

/** Where its neck is, between the thorax and the head, in the body's frame; and how far round it a collar or a ruff is rooted. */
const neckOf = (s: Bee): V3 => add(s.head.at, [0, -s.head.r[1] * 0.6, -s.head.r[2] * 0.72]);
const neckR = (s: Bee): number => s.thorax[0] * 0.72;

/**
 * A fur collar round its neck, cream: soft lobes all the way round between its head and its thorax, lying out and back over its
 * shoulders, the ones under its chin longer and down over its chest, so it is a bib from in front and a ring from behind. In the
 * body's frame.
 */
function collarOf(s: Bee, fine: boolean): Mesh {
  const N0 = neckOf(s), rr = neckR(s), out: Mesh[] = [], N = fine ? 12 : 8, w = s.thorax[0];
  for (let row = 0; row < 2; row++) {
    for (let q = 0; q < N; q++) {
      const a = ((q + 0.5 * row) / N) * TAU, radial: V3 = [Math.cos(a), 0, Math.sin(a)], low = Math.max(0, -Math.sin(a));
      const root = add(N0, add(scale(radial, rr * (0.8 - 0.12 * row)), [0, -0.06 * w * row, 0]));
      const dir = unit(add(radial, [0, -0.5 + 0.55 * low, -0.25 * low]));
      const L = w * (0.95 + 0.2 * low + 0.15 * jitter(q + 9 + row * 5)) * (1 - 0.25 * row);
      out.push(tuft(root, dir, L, w * (0.62 - 0.12 * row), row ? 'feather' : 'muzzle'));
    }
  }
  return merge(...out);
}

/**
 * A petal or a leaf, from its root along `dir` (the way it lies), its upper side toward `face`, bowed that way by `curl` of its
 * length: a plump flattened point, broadest past its middle, its underside in `under`. Plump, so it is a petal from every side
 * and never a shard seen edge on.
 */
function petal(root: V3, dir: V3, face: V3, len: number, w: number, mat: Mat, under: Mat, curl = 0.15, fine = true): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const at = (u: number): V3 => add(add(root, scale(d, len * u)), scale(f, len * curl * Math.sin(Math.PI * u)));
  const us = fine ? [0, 0.3, 0.62, 0.86, 1] : [0, 0.5, 1], ws = fine ? [0.5, 0.95, 1, 0.7, 0.04] : [0.6, 1, 0.04], n = fine ? 6 : 4;
  return tube(us.map(at), ws.map((k) => w * k), ws.map((k) => w * k * 0.34), n, (_ring, j) => (Math.sin(((j + 1) / n) * TAU) < -0.1 ? under : mat), { up: f });
}

/**
 * The ruff of petals round its neck, in the body's frame: rings of them all the way round between its head and its thorax, the
 * outer the longest, cream and pale yellow, fanning out and back over its shoulders and down over its chest under its chin, so
 * it is a bib from in front, a fan at its sides and a ring from behind; the Hivemaster's with green leaves among them.
 */
function ruffOf(s: Bee, fine: boolean): Mesh {
  const F = s.ruff!, N0 = neckOf(s), rr = neckR(s), out: Mesh[] = [];
  for (let row = 0; row < F.rows; row++) {
    const count = Math.round((F.count - row * 2) * (fine ? 1 : 0.75)), len = F.len * (1 - row * 0.2), w = F.w * (1 - row * 0.1) * (fine ? 1 : 1.2);
    for (let q = 0; q < count; q++) {
      const a = ((q + 0.5 * row) / count) * TAU + (jitter(q + row * 7) - 0.5) * 0.2;
      const radial: V3 = [Math.cos(a), 0, Math.sin(a)], low = Math.max(0, -Math.sin(a));
      const root = add(N0, add(scale(radial, rr * (0.75 - 0.1 * row)), [0, 0.03 * row, 0]));
      const dir = unit(add(radial, [0, -0.55 + 0.5 * low + 0.12 * row, -0.2 * low]));
      const leaf = s.stage === 2 && row === 0 && q % 4 === 1;
      const mat: Mat = leaf ? 'leaf' : row === F.rows - 1 ? 'bloom' : (q + row) % 3 === 0 ? 'feather' : 'petal';
      out.push(petal(root, dir, add(scale(radial, 0.3), [0, 1, 0]), len * (0.9 + 0.2 * jitter(q + 31 + row)) * (leaf ? 1.15 : 1) * (1 + 0.15 * low), w, mat, leaf ? 'leafDark' : 'featherDark', -0.12, fine));
    }
  }
  return merge(...out);
}

/**
 * The petal points round its crown, in the head's frame: a fan of them over the back of its head behind the feelers, from ear to
 * ear, standing up and out like a flower's, pale yellow and cream, the middle ones the longest; the Hivemaster's with two leaves
 * out at its sides.
 */
function crownOf(s: Bee, fine: boolean): Mesh {
  const C = s.crown!, R = s.head.r, c: V3 = [0, 0, 0], out: Mesh[] = [];
  for (let q = 0; q < C.count; q++) {
    const u = C.count === 1 ? 0.5 : q / (C.count - 1), a = lerp(-1, 1, u) * Math.PI * 0.42;
    const e = onEgg(c, R, [Math.sin(a) * 0.9, -0.42, Math.cos(a)]);
    const dir = unit([Math.sin(a) * 1.1, -0.3, Math.cos(a) + 0.15]);
    const len = C.len * (0.7 + 0.4 * Math.cos(a)) * (0.92 + 0.16 * jitter(q + 2));
    out.push(petal(add(e.p, scale(e.n, -0.03)), dir, [0, 1, 0.2], len, C.len * 0.36, q % 3 === 1 ? 'petal' : 'bloom', 'featherDark', -0.12, fine));
  }
  for (let q = 0; q < C.leaves; q++) {
    const sd = q % 2 ? 1 : -1, e = onEgg(c, R, [sd * 0.75, -0.5, 0.45]);
    out.push(petal(e.p, [sd * 0.95, -0.45, 0.35], [sd * 0.3, 0.2, 1], C.len * 1.4, C.len * 0.32, 'leaf', 'leafDark', 0.3, fine));
  }
  return merge(...out);
}

/**
 * The head: a round furry skull, a short muzzle with a small pink nose and a smile, big glossy dark eyes, a dark mask back from
 * each on the Combworker and the Hivemaster, fur tufts at its cheeks and, on the Buzzlet, on its crown.
 */
function headOf(s: Bee, n: number, k: number, shut: boolean, fine: boolean): Mesh {
  const H = s.head, R = H.r, C: V3 = [0, 0, 0];
  const out: Mesh[] = [orb(C, R, n + 6, k + 4, 'coat')];
  const mz = onEgg(C, R, [0, 1, -0.42]);
  out.push(orbAlong(add(mz.p, scale(mz.n, -R[1] * 0.18)), [0, 1, -0.2], [R[0] * 0.36, R[0] * 0.3, R[1] * 0.3], n, 4, 'coat'));
  const tip = add(mz.p, add(scale(mz.n, R[1] * 0.1), [0, 0, R[2] * 0.03]));
  out.push(orb(tip, [R[0] * 0.07, R[0] * 0.05, R[0] * 0.05], 6, 3, 'nose'));
  out.push(smile(add(tip, [0, -R[1] * 0.02, -R[2] * 0.12]), [0, 1, -0.3], R[0] * 0.16));
  const E = H.eye, dirs: V3 = [0.6, 0.72, 0.12];
  const paints: Disc[] = [];
  // The mask: a brown cap over the back of its crown between its ears, and a stripe back from each eye to it.
  if (H.mask) paints.push(patchOn(C, R, [0, -0.55, 0.85], R[0] * 0.78, R[1] * 0.62, 'mark', 0, 0.01, 14));
  for (const sd of [1, -1]) {
    if (H.mask) paints.push(patchOn(C, R, [sd * (dirs[0] + 0.3), dirs[1] - 0.5, dirs[2] + 0.38], E * 1.9, E * 0.8, 'mark', -sd * 0.6, 0.011, 12));
  }
  out.push(paint(paints));
  out.push(eyesOf(s, dirs, shut));
  // Fur: tufts at its cheeks, out and down, and a few on its crown.
  const N = fine ? 3 : 2;
  for (const sd of [1, -1]) {
    for (let q = 0; q < N; q++) {
      const e = onEgg(C, R, [sd, 0.05 - 0.2 * q, -0.25 - 0.25 * q]);
      out.push(tuft(add(e.p, scale(e.n, -0.02)), add(e.n, [0, -0.2, -0.45]), R[0] * (0.3 - 0.05 * q), R[0] * 0.16, 'coat'));
    }
  }
  if (!s.crown) {
    for (let q = 0; q < 3; q++) {
      const e = onEgg(C, R, [(q - 1) * 0.3, -0.05, 1]);
      out.push(tuft(add(e.p, scale(e.n, -0.02)), [(q - 1) * 0.5, 0.25, 1], R[0] * (q === 1 ? 0.32 : 0.24), R[0] * 0.15, q === 1 ? 'coat' : 'coatDark'));
    }
  }
  return merge(...out);
}

/** The eyes: each a dark rim, a big glossy dark eye and two glints, laid onto the skull's curve; a lid's line, shut. */
function eyesOf(s: Bee, dir: V3, shut: boolean): Mesh {
  const E = s.head.eye, C: V3 = [0, 0, 0], R = s.head.r, out: Disc[] = [];
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
    out.push(onto(disc(p, n, E * 1.14, E * 1.2, 12, 'lid', o), 0.016));
    out.push(onto(disc(p, n, E, E * 1.06, 12, 'eye', o), 0.02));
    out.push(onto(disc(add(add(p, scale(up, E * 0.4)), scale(across, side * E * 0.28)), n, E * 0.38, E * 0.4, 6, 'glint', { ...o, lit: true }), 0.03));
    out.push(onto(disc(add(add(p, scale(up, -E * 0.46)), scale(across, -side * E * 0.3)), n, E * 0.15, E * 0.15, 5, 'glint', { ...o, lit: true }), 0.03));
  }
  return paint(out);
}

/** An ear, right, in the head's frame: small, pointed, brown, a paler inside, up at the side of its crown and turned out. */
function earOf(s: Bee, n: number): Mesh {
  const [len, w] = s.ear, R = s.head.r;
  const e = onEgg([0, 0, 0], R, [0.66, -0.1, 0.68]);
  const ear = earMesh(len, w, Math.max(5, n - 3), { mat: 'mark', point: true, tilt: -0.02 });
  return mesh(ear.v.map((v) => {
    // Rolled out from upright and turned to face forward and out.
    const r = (40 * Math.PI) / 180, y = (-28 * Math.PI) / 180;
    const p1: V3 = [v[0] * Math.cos(r) + v[2] * Math.sin(r), v[1], -v[0] * Math.sin(r) + v[2] * Math.cos(r)];
    const p2: V3 = [p1[0] * Math.cos(y) - p1[1] * Math.sin(y), p1[0] * Math.sin(y) + p1[1] * Math.cos(y), p1[2]];
    return add(add(e.p, scale(e.n, -len * 0.12)), p2);
  }), ear.f);
}

/** A feeler, right, from its root up off its head: up, bent at an elbow, then forward and curling down to a club at its end. */
function feelerOf(s: Bee, n: number): Mesh {
  const L = s.feeler, w = 0.017 + 0.007 * s.stage;
  const pts: V3[] = [[0, 0, 0], [0.05 * L, 0.07 * L, 0.2 * L], [0.12 * L, 0.16 * L, 0.35 * L], [0.22 * L, 0.34 * L, 0.42 * L], [0.31 * L, 0.52 * L, 0.4 * L], [0.38 * L, 0.66 * L, 0.3 * L], [0.42 * L, 0.72 * L, 0.17 * L], [0.42 * L, 0.7 * L, 0.07 * L]];
  return merge(
    tube(pts, pts.map((_, q) => w * (1.15 - 0.35 * (q / (pts.length - 1)))), pts.map((_, q) => w * (1.15 - 0.35 * (q / (pts.length - 1)))), Math.max(4, n - 4), 'mark'),
    orbAlong(pts[pts.length - 1], [0, 0.2, -1], [w * 1.25, w * 1.25, w * 1.6], 5, 3, 'mark'),
  );
}

/**
 * The abdomen, in its own frame from its root back along -y: a round fuzzy egg in stripes, yellow at the root, its tip bending
 * down, tufts of fur standing out at each stripe's edge, and its sting.
 */
function abdOf(s: Bee, n: number, fine: boolean): Mesh {
  const A = s.abd, L = A.len, B = A.bands;
  const us = [...new Set([0, 0.05, 0.12, ...B, 0.92, 0.97, 1].map((u) => +u.toFixed(3)))].sort((x, y) => x - y);
  const r = (u: number): number => Math.max(0.2, Math.sin(Math.PI * (0.1 + 0.86 * u)) ** 0.65) * (u < 0.1 ? 0.75 + 2.5 * u : 1);
  const zAt = (u: number): number => -0.12 * L * u * u;
  const bandOf = (u: number): number => B.filter((b) => b <= u + 1e-4).length;
  const mats = us.slice(0, -1).map((u, q) => (bandOf((u + us[q + 1]) / 2) % 2 ? 'mark' : 'coat') as Mat);
  const body = tube(us.map((u) => [0, -u * L, zAt(u)] as V3), us.map((u) => A.w * r(u)), us.map((u) => A.h * r(u)), n + 4, (ring) => mats[Math.min(ring, mats.length - 1)], { up: [0, 0, 1] });
  const out: Mesh[] = [body];
  // The sting, small and dark, out of the tip.
  const tip: V3 = [0, -L * 0.985, zAt(0.985)];
  out.push(taper([tip, add(tip, [0, -A.w * 0.32, -A.w * 0.08])], A.w * 0.09, 0.004, 5, 'claw'));
  return merge(...out);
}

/** The solids of its body in a bone's frame, for what lies on it to be hidden behind: the thorax; the abdomen, as eggs along it. */
const thoraxSolid = (s: Bee): Array<{ c: V3; r: V3 }> => [{ c: [0, 0, 0], r: scale(s.thorax, 0.92) }];
const abdSolid = (s: Bee): Array<{ c: V3; r: V3 }> => [0.3, 0.6].map((u) => ({ c: [0, -u * s.abd.len, -0.12 * s.abd.len * u * u] as V3, r: [s.abd.w * 0.88, s.abd.len * 0.26, s.abd.h * 0.86] as V3 }));

/** A leg's upper part, along -z from its hip: dark and jointed, a knob at its knee. */
function thighOf(L: Leg, n: number): Mesh {
  const l = L.len[0], w = L.w;
  return merge(tube([[0, 0, 0.02], [0, 0, -l * 0.5], [0, 0, -l]], [w * 1.15, w * 1.05, w * 0.95], [w * 1.15, w * 1.05, w * 0.95], n, 'mark', { seam: 'start' }), orb([0, 0, -l], w * 1.12, n, 3, 'hornDark'));
}
/** A leg's lower part, along -z from its knee: thinner, a darker band at its foot end. */
function shinOf(L: Leg, n: number): Mesh {
  const l = L.len[1], w = L.w;
  return tube([[0, 0, w * 0.5], [0, 0, -l * 0.5], [0, 0, -l * 0.86], [0, 0.005, -l]], [w * 0.95, w * 0.85, w * 0.72, w * 0.68], [w * 0.95, w * 0.85, w * 0.72, w * 0.68], n, (ring) => (ring >= 2 ? 'hornDark' : 'mark'), { seam: 'start' });
}
/**
 * A hind leg's basket of pollen, in its thigh's frame: a fat fuzzy yellow ball over its knee, which is up and out at its side, so
 * the two stand out either side of it low from every way round; soft tufts all over it, a little paler than the coat.
 */
function pollenOf(L: Leg, r: number, n: number, fine: boolean): Mesh {
  const c: V3 = [0, 0, -L.len[0] * 0.8], R: V3 = [r, r * 1.02, r * 1.12];
  const out: Mesh[] = [orb(c, R, n + 3, 6, 'coat')];
  const N = fine ? 16 : 8;
  for (let q = 0; q < N; q++) {
    const d = unit([Math.cos(q * 2.4), Math.sin(q * 2.4), lerp(-0.85, 0.85, (q + 0.5) / N)]);
    const e = onEgg(c, R, d);
    out.push(tuft(add(e.p, scale(e.n, -r * 0.1)), e.n, r * 0.24, r * 0.3, q % 2 ? 'coatLight' : 'coat'));
  }
  return merge(...out);
}
/** A foot, from its ankle: a short dark tarsus forward and down to the ground, two small claws on it. */
function footOf(L: Leg, n: number): Mesh {
  const w = L.w, h = ankleH(L), len = w * 3.2;
  const pts: V3[] = [[0, -w * 0.3, 0], [0, len * 0.5, -h * 0.6], [0, len, -h + w * 0.25]];
  const out: Mesh[] = [tube(pts, [w * 0.7, w * 0.6, w * 0.45], [w * 0.62, w * 0.52, w * 0.4], Math.max(4, n - 2), 'hornDark')];
  for (const sd of [1, -1]) out.push(taper([pts[2], add(pts[2], [sd * w * 0.45, w * 0.8, -w * 0.3])], w * 0.26, 0.004, 4, 'claw'));
  return merge(...out);
}

/** A foreleg's upper part along -z from its shoulder, and its lower, plated in bands on the Hivemaster; and a paw of small claws. */
function armUpperOf(s: Bee, n: number): Mesh {
  const A = s.arm, l = A.len[0], w = A.w;
  return merge(tube([[0, 0, 0.02], [0, 0, -l]], [w * 1.1, w * 0.95], [w * 1.1, w * 0.95], n, 'mark', { seam: 'start' }), orb([0, 0, -l], w * 1.02, n, 3, 'hornDark'));
}
function armLowerOf(s: Bee, n: number): Mesh {
  const A = s.arm, l = A.len[1], w = A.w;
  if (!A.armour) return tube([[0, 0, w * 0.4], [0, 0, -l * 0.6], [0, 0, -l]], [w, w * 0.9, w * 0.75], [w, w * 0.9, w * 0.75], n, 'mark', { seam: 'start' });
  // Plates: rings swelling and narrowing down it, each lapping the next, darker at their rims.
  const zs = [w * 0.4, -l * 0.05, -l * 0.3, -l * 0.34, -l * 0.6, -l * 0.64, -l * 0.9, -l];
  const ws = [w * 1.05, w * 1.3, w * 1.18, w * 1.0, w * 1.22, w * 1.0, w * 1.05, w * 0.8];
  return tube(zs.map((z) => [0, 0, z] as V3), ws, ws.map((x) => x * 0.92), n, (ring) => (ring === 2 || ring === 4 || ring === 6 ? 'hornDark' : 'mark'), { seam: 'start' });
}
function pawOf(s: Bee, n: number): Mesh {
  const w = s.arm.w, out: Mesh[] = [orb([0, 0, -w * 0.3], [w * 1.0, w * 0.85, w * 0.9], Math.max(5, n - 2), 3, 'hornDark')];
  for (const q of [-1, 0, 1]) out.push(taper([[q * w * 0.5, w * 0.2, -w * 0.7], [q * w * 0.7, w * 0.55, -w * 1.6]], w * 0.24, 0.004, 4, 'claw'));
  return merge(...out);
}

/* ---- what it carries ---------------------------------------------------------------------- */

/** How far a drip of honey has run, nought to one, from the loop and its work: a drop gathers and falls every four seconds. */
function dripOf(a: Anim, q: number): number {
  const fast = a.act?.kind === 'work' ? 2.5 : 1, t = a.act?.kind === 'work' ? a.act.t * ACT_SECS.work * 2 + a.t : a.t;
  return frac((t * 6 * fast) / LOOP + 0.37 * q);
}
/** How long a drip hangs, by its run (`dripOf`): it stretches, a bead swells at its end, and it lets go. */
const dripLen = (u: number): number => 0.35 + 0.65 * smooth(u / 0.85) * (1 - ramp(u, 0.86, 0.95));

/** A drip of honey hanging from `p`, along -z: a thread thinning down to a bead. `L` long, `r` thick. */
function dripMesh(p: V3, L: number, r: number, n: number): Mesh {
  return merge(
    tube([add(p, [0, 0, r * 0.6]), add(p, [0, 0, -L * 0.25]), add(p, [0, 0, -L * 0.62]), add(p, [0, 0, -L * 0.8])], [r * 1.2, r * 0.6, r * 0.42, r * 0.6], [r * 1.2, r * 0.6, r * 0.42, r * 0.6], Math.max(4, n - 3), 'ember'),
    orbAlong(add(p, [0, 0, -L * 0.88]), [0, 0, 1], [r * 1.05, r * 1.05, r * 1.35], 6, 3, 'ember'),
  );
}

/** The drop of honey, in its own frame about its middle: a glossy amber ball, lighter at its top, two glints. */
function dropOf(s: Bee, n: number, k: number): Mesh {
  const r = s.prop.r[0], R: V3 = [r, r * 0.95, r * 0.92], C: V3 = [0, 0, 0];
  return merge(
    orb(C, R, n + 4, k + 2, 'ember'),
    paint([
      patchOn(C, R, [0.1, 0.3, -0.85], r * 0.8, r * 0.55, 'crystalDark', 0, 0.006, 12),
      patchOn(C, R, [-0.15, 0.4, 0.8], r * 0.6, r * 0.42, 'flame', 0, 0.006, 10),
      patchOn(C, R, [-0.38, 0.6, 0.55], r * 0.3, r * 0.17, 'glint', 0.7, 0.012, 8),
      patchOn(C, R, [0.5, 0.7, -0.25], r * 0.1, r * 0.1, 'glint', 0, 0.012, 5),
    ]),
  );
}

/** A comb's outline in its face (x across, z up), `w` by `h`: rounded, its edge stepped along the cells as a broken comb's is. */
function combOutline(w: number, h: number, n: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, q) => {
    const a = (q / n) * TAU, bump = 1 + 0.07 * Math.cos(6 * a + 0.5) + 0.04 * (jitter(q + 5) - 0.5);
    return [Math.cos(a) * w * bump, Math.sin(a) * h * bump] as [number, number];
  });
}

/**
 * A piece of comb, in its own frame about its middle, its faces toward ±y: a slab of pale wax cut to a rough round, its cells
 * painted on both faces -- each a deep honey hexagon in the wax, glossy at its top -- and its edge darker.
 */
function combOf(s: Bee, fine: boolean): Mesh {
  const [w, h, d] = s.prop.r, ol = combOutline(w, h, fine ? 20 : 14), N = ol.length;
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (const [x, z] of ol) v.push([x, d, z]);
  for (const [x, z] of ol) v.push([x, -d, z]);
  v.push([0, d * 1.15, 0], [0, -d * 1.15, 0]);
  for (let q = 0; q < N; q++) {
    const q2 = (q + 1) % N;
    f.push({ i: [2 * N, q, q2], m: 'shell' }); want.push([0, 1, 0]);
    f.push({ i: [2 * N + 1, N + q, N + q2], m: 'shell' }); want.push([0, -1, 0]);
    const [x0, z0] = ol[q], [x1, z1] = ol[q2];
    // Its edge, looking out from the middle.
    f.push({ i: [q, q2, N + q2, N + q], m: 'shellDark' }); want.push([(x0 + x1) / 2, 0, (z0 + z1) / 2]);
  }
  const slab = mesh(v, woundTo(v, f, want));
  // The cells: a hex grid, pointy at top and bottom, each well inside the outline.
  const c = Math.max(w, h) / (s.stage === 2 ? 3.6 : 2.6), cells: Disc[] = [];
  for (let j = -6; j <= 6; j++) {
    for (let i = -6; i <= 6; i++) {
      const x = c * Math.sqrt(3) * (i + 0.5 * (Math.abs(j) % 2)), z = c * 1.5 * j;
      if ((x / (w * 0.86)) ** 2 + (z / (h * 0.86)) ** 2 > 1) continue;
      for (const side of [1, -1]) {
        const hexAt = (cx: number, cz: number, r: number, m: Mat, y: number, lit = false): Disc => {
          const pts = Array.from({ length: 6 }, (_, q) => { const a = (q / 6) * TAU + Math.PI / 6; return [cx + Math.cos(a) * r, side * y, cz + Math.sin(a) * r] as V3; });
          return { v: side > 0 ? pts.reverse() : pts, m, lit };
        };
        cells.push(hexAt(x, z, c * 0.8, 'crystal', d + 0.004));
        if (fine || c * 0.8 > 0.05) cells.push(hexAt(x - c * 0.12, z + c * 0.28, c * 0.3, 'flame', d + 0.008, false));
      }
    }
  }
  // Wound to face out of each face.
  const painted = paint(cells.map((dd) => {
    const p = dd.v, n0 = cross(sub(p[1], p[0]), sub(p[2], p[0]));
    return n0[1] * (p[0][1] > 0 ? 1 : -1) < 0 ? { ...dd, v: [...p].reverse() } : dd;
  }));
  return merge(slab, painted);
}

/** Where the drips hang from what it carries, in its own frame, and how long each is at its longest. */
function dripsAt(s: Bee): Array<{ p: V3; L: number; r: number }> {
  const r = s.prop.r;
  if (s.carry === 'drop') return [{ p: [r[0] * 0.25, r[0] * 0.15, -r[0] * 0.86], L: r[0] * 0.85, r: r[0] * 0.2 }, { p: [-r[0] * 0.35, r[0] * 0.1, -r[0] * 0.8], L: r[0] * 0.55, r: r[0] * 0.16 }];
  const out: Array<{ p: V3; L: number; r: number }> = [];
  const n = s.carry === 'comb' ? 3 : 5, long = s.carry === 'comb' ? 1 : 0.5, thick = Math.min(r[2], 0.06);
  for (let q = 0; q < n; q++) {
    const u = lerp(-0.6, 0.6, q / (n - 1)) + (jitter(q + 9) - 0.5) * 0.12, x = u * r[0];
    const z = -r[1] * Math.sqrt(Math.max(0, 1 - (u / 1.02) ** 2)) * 0.98;
    out.push({ p: [x, r[2] * 0.4 * (q % 2 ? 1 : -1), z], L: r[1] * (0.4 + 0.45 * jitter(q + 3)) * long, r: thick * (0.42 + 0.14 * jitter(q)) });
  }
  return out;
}

/* ---- its leaves and pollen ------------------------------------------------------------------ */

/** The Hivemaster's leaf sashes: long leaves from each shoulder lying down its sides, in the body's frame. */
function sashOf(s: Bee, fine: boolean): Mesh {
  const R = s.thorax, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < s.sash; q++) {
      const e = onEgg([0, 0, 0], R, [sd * 0.75, 0.25 - 0.35 * q, 0.62]);
      const len = R[1] * (2.7 - 0.45 * q), dir = unit([sd * 0.45, -0.7, -0.6 + 0.22 * q]);
      out.push(petal(add(e.p, scale(e.n, 0.01)), dir, [sd, 0.1, 0.3], len, R[0] * 0.32, q % 2 ? 'moss' : 'leaf', 'leafDark', 0.22, fine));
    }
  }
  return merge(...out);
}

/** The Hivemaster's skirt: leaf points round its waist, lying back and down over the root of its abdomen, in the abdomen's frame. */
function skirtOf(s: Bee, fine: boolean): Mesh {
  const A = s.abd, out: Mesh[] = [], N = fine ? s.skirt : Math.ceil(s.skirt * 0.7);
  for (let q = 0; q < N; q++) {
    const a = lerp(-0.5, Math.PI + 0.5, (q + 0.5) / N), d: V3 = [Math.cos(a), 0, Math.sin(a)];
    const root: V3 = [d[0] * A.w * 0.82, -A.len * 0.1, d[2] * A.h * 0.82];
    const len = A.len * (0.5 + 0.12 * jitter(q + 4));
    out.push(petal(root, [d[0] * 0.95, -1, d[2] * 0.85 - 0.2], d, len, A.w * 0.24, q % 3 === 1 ? 'moss' : 'leaf', 'leafDark', 0.12, fine));
  }
  return merge(...out);
}

/** Puffs of pollen on each side, by its wings' roots and its hips: little clusters of bright yellow balls. In the body's frame. */
function puffsOf(s: Bee): Mesh {
  const R = s.thorax, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < s.puffs; q++) {
      const e = onEgg([0, 0, 0], R, q ? [sd * 0.9, -0.7, -0.35] : [sd * 0.85, -0.45, 0.4]), r = R[0] * (0.16 + 0.03 * q);
      for (let m = 0; m < 4; m++) {
        const o: V3 = [Math.cos(m * 1.7) * r * 0.8, Math.sin(m * 1.7) * r * 0.8, (m - 1.5) * r * 0.35];
        out.push(orb(add(add(e.p, scale(e.n, r * 0.6)), o), r * (0.75 + 0.2 * jitter(m + q)), 6, 3, m % 2 ? 'spot' : 'bloom'));
      }
    }
  }
  return merge(...out);
}

/* ---- its wings ---------------------------------------------------------------------------- */

type P2 = [number, number];
/** A forewing's outline, reaching out along x from its root with its leading edge toward +y: shares of its span and chord. */
const FORE: readonly P2[] = [[0, 0.1], [0.18, 0.26], [0.42, 0.4], [0.66, 0.46], [0.85, 0.4], [0.97, 0.22], [1.0, 0.02], [0.94, -0.18], [0.78, -0.32], [0.55, -0.36], [0.32, -0.28], [0.12, -0.12], [0, -0.02]];
/** A hindwing's: shorter and rounder. */
const HIND: readonly P2[] = [[0, 0.06], [0.28, 0.2], [0.58, 0.27], [0.84, 0.22], [0.99, 0.04], [0.93, -0.16], [0.68, -0.28], [0.38, -0.26], [0.12, -0.1], [0, 0]];
/** Its veins: the long ones out from the root, then the cross ones that close them into cells. The first is the leading edge's, the darkest. */
const FORE_VEINS: readonly P2[][] = [
  [[0.02, 0.1], [0.3, 0.33], [0.6, 0.45], [0.8, 0.43]],
  [[0.03, 0.04], [0.35, 0.14], [0.68, 0.2], [0.96, 0.1]],
  [[0.03, 0.0], [0.36, -0.04], [0.66, -0.08], [0.9, -0.22]],
  [[0.05, -0.04], [0.3, -0.16], [0.52, -0.27], [0.7, -0.34]],
  [[0.33, 0.31], [0.35, 0.14], [0.36, -0.04], [0.3, -0.16], [0.3, -0.27]],
  [[0.55, 0.43], [0.52, 0.18], [0.55, -0.06], [0.5, -0.26], [0.52, -0.35]],
  [[0.74, 0.45], [0.72, 0.2], [0.76, -0.1], [0.72, -0.3]],
  [[0.89, 0.37], [0.88, 0.14], [0.86, -0.08], [0.88, -0.24]],
];
const HIND_VEINS: readonly P2[][] = [
  [[0.02, 0.06], [0.3, 0.19], [0.6, 0.26]],
  [[0.03, 0.02], [0.4, 0.08], [0.8, 0.1], [0.97, 0.04]],
  [[0.05, -0.02], [0.4, -0.12], [0.7, -0.24]],
  [[0.45, 0.24], [0.45, 0.08], [0.42, -0.12], [0.4, -0.25]],
  [[0.72, 0.24], [0.72, 0.1], [0.7, -0.08], [0.68, -0.26]],
];

/** A wing's corners for framing: a piece with no facets on its bone (`wingReach`). */
const reachMesh = (w: Wing, sd: number, hindW: boolean): Mesh => mesh((hindW ? HIND : FORE).filter((_, q) => q % 2 === 0).map(([x, y]) => [sd * x * w.span, y * w.chord, 0] as V3), []);

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** How big a pixel is, in the units `g` is drawing in. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/**
 * A wing's frame turned about its span, as little as will do, until the pane is drawn at least `WING_SHOWN` as wide as it could
 * be from where it is seen: a drawn wing's cheat, so a pane is never only its edge from any side. Its tip stays where it is.
 */
const WING_SHOWN = 0.6;
function shown(xf: Xf, view: View): Xf {
  const m = xf.m, X: V3 = [m[0], m[3], m[6]], Y: V3 = [m[1], m[4], m[7]], Z: V3 = [m[2], m[5], m[8]];
  const o = onScreen(view, [0, 0, 0]), on = (v: V3): [number, number] => { const p = onScreen(view, v); return [p[0] - o[0], p[1] - o[1]]; };
  const sx = on(X), sl = Math.hypot(sx[0], sx[1]) || 1;
  // How wide the chord is drawn, turned by `a` about the span.
  const wide = (a: number): number => { const c = on(add(scale(Y, Math.cos(a)), scale(Z, Math.sin(a)))); return Math.abs(sx[0] * c[1] - sx[1] * c[0]) / sl; };
  let most = 0;
  for (let q = -9; q <= 9; q++) most = Math.max(most, wide((q / 18) * Math.PI));
  let a = 0;
  for (let q = 0; q <= 9 && wide(a) < WING_SHOWN * most; q++) a = wide((q / 18) * Math.PI) >= wide((-q / 18) * Math.PI) ? (q / 18) * Math.PI : (-q / 18) * Math.PI;
  const Yn = add(scale(Y, Math.cos(a)), scale(Z, Math.sin(a))), Zn = cross(X, Yn);
  return xfOf(X, Yn, Zn, xf.t);
}

const GLASS: RGB = [238, 240, 255];
const GLASS_ROOT: RGB = [255, 248, 232];
const GLASS_EDGE: RGB = [252, 226, 188];
const VEIN: RGB = [196, 140, 82];
const VEIN_DARK: RGB = [136, 92, 52];

/**
 * One wing, drawn on `xf`: a glassy pane, palest lavender-white with cream toward its root and peach toward its edge, a cream rim
 * inked in tan round it, and its veins in tan, the leading one darker -- the fine ones only where the wing is drawn big enough to
 * carry them. `al` is how solid it is: a buzzing wing is several faint ones.
 */
function paneOf(g: CanvasRenderingContext2D, view: View, xf0: Xf, w: Wing, sd: number, hindW: boolean, al: number, lines: boolean): void {
  const px = pxOf(g), shape = hindW ? HIND : FORE, xf = shown(xf0, view);
  const at = ([x, y]: P2): [number, number] => onScreen(view, place(xf, [sd * x * w.span, y * w.chord, 0]));
  const big = w.span / px;
  const pts = shape.map(at);
  g.beginPath();
  // A smooth line through the outline's corners: a quadratic through each midpoint.
  const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const m0 = mid(pts[pts.length - 1], pts[0]);
  g.moveTo(m0[0], m0[1]);
  for (let q = 0; q < pts.length; q++) {
    const m = mid(pts[q], pts[(q + 1) % pts.length]);
    g.quadraticCurveTo(pts[q][0], pts[q][1], m[0], m[1]);
  }
  g.closePath();
  const r0 = at([0, 0]), r1 = at([1, 0]);
  const grad = g.createLinearGradient(r0[0], r0[1], r1[0], r1[1]);
  grad.addColorStop(0, css(GLASS_ROOT, 0.7 * al));
  grad.addColorStop(0.45, css(GLASS, 0.58 * al));
  grad.addColorStop(1, css(GLASS_EDGE, 0.74 * al));
  g.fillStyle = grad;
  g.fill();
  if (!lines) return;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (big > 14) {
    g.strokeStyle = css(GLASS_EDGE, 0.75 * al);
    g.lineWidth = Math.max(px * 1.6, w.span * 0.035);
    g.stroke();
  }
  g.strokeStyle = css(VEIN, 0.95 * al);
  g.lineWidth = Math.max(px * 0.9, w.span * 0.012);
  g.stroke();
  // Veins: the leading one wherever it shows, the rest only big.
  const veins = hindW ? HIND_VEINS : FORE_VEINS;
  for (let v = 0; v < veins.length; v++) {
    if (v > 0 && big < 26) break;
    const vp = veins[v].map(at);
    g.beginPath();
    g.moveTo(vp[0][0], vp[0][1]);
    for (let q = 1; q < vp.length; q++) g.lineTo(vp[q][0], vp[q][1]);
    g.strokeStyle = v === 0 ? css(VEIN_DARK, 0.9 * al) : css(VEIN, 0.55 * al);
    g.lineWidth = v === 0 ? Math.max(px * 1.1, w.span * 0.02) : Math.max(px * 0.6, w.span * 0.008);
    g.stroke();
  }
}

/**
 * The wings, each on its side of the body: those whose middle is away from the viewer under the body, the rest over it. Still, a
 * pane each; buzzing, a fan of faint panes through its stroke, and the pane where it is now over them.
 */
function wingsOf(g: CanvasRenderingContext2D, view: View, s: Bee, b: Bones, a: Anim, front: boolean): void {
  const W = buzzOf(s, a), mid = b.body.t, P = planOf(s, { ...a, go: a.act ? 0 : a.go });
  // Hindwings first, under the forewings.
  for (const k of [2, 3, 0, 1]) {
    const sd = k % 2 ? 1 : -1, hindW = k >= 2, w = hindW ? s.hindWing : s.fore, xf = b[`wing${k}`];
    if (!xf) continue;
    const c = place(xf, [sd * w.span * 0.5, 0, 0]);
    if (nearSide(c, mid, view) !== front) continue;
    if (W.blur > 0.05) {
      const base = w.lift + P.wing[hindW ? 1 : 0], sweep = w.sweep + P.wing[2], amp = blurAmp(s) * (hindW ? 0.85 : 1);
      for (let q = 0; q < 5; q++) {
        const lift = base + amp * lerp(-1, 1, q / 4) * W.blur;
        paneOf(g, view, wingXf(b[`wr${k}`], w, sd, lift, sweep), w, sd, hindW, 0.32 * W.blur, false);
      }
    }
    paneOf(g, view, xf, w, sd, hindW, 1 - 0.55 * W.blur, true);
  }
}

/* ---- what it throws about ------------------------------------------------------------------- */

const HONEY: RGB = [240, 168, 40];
const HONEY_INK: RGB = [150, 86, 24];
const HONEY_LIGHT: RGB = [255, 230, 150];
const POLLEN: readonly RGB[] = [[255, 214, 70], [252, 236, 140], [246, 186, 50]];
const PETAL_RGB: readonly RGB[] = [[250, 240, 214], [252, 222, 120], [146, 176, 96]];
const GRAVITY = 9;

/** A bead of honey: round, amber, inked, a light glint; never under a pixel and a bit across. */
function bead(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, stretch = 1): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.1 * px);
  g.fillStyle = css(HONEY_INK, al * 0.9);
  g.beginPath();
  g.ellipse(x, y, r + 0.45 * px, r * stretch + 0.45 * px, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(HONEY, al);
  g.beginPath();
  g.ellipse(x, y, r, r * stretch, 0, 0, TAU);
  g.fill();
  if (r > 1.3 * px) {
    g.fillStyle = css(HONEY_LIGHT, al);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.35 * stretch, r * 0.36, 0, TAU);
    g.fill();
  }
}

/** A mote of pollen: a small bright dot, inked lightly. */
function mote(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.0 * px);
  g.fillStyle = css(mix(c, [120, 80, 20], 0.55), al * 0.7);
  g.beginPath();
  g.arc(x, y, r + 0.4 * px, 0, TAU);
  g.fill();
  g.fillStyle = css(c, al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** The beads that let go of the drips and fall, each drawn on its side of the body; a small splat where it lands. */
function fallingDrips(g: CanvasRenderingContext2D, view: View, s: Bee, b: Bones, a: Anim, front: boolean): void {
  const mid = b.body.t;
  dripsAt(s).forEach((d, q) => {
    const u = dripOf(a, q);
    if (u < 0.86) return;
    const since = ((u - 0.86) / 0.14) * (LOOP / 6) * 0.14 * (a.act?.kind === 'work' ? 0.4 : 1);
    const from = place(b.prop, add(d.p, [0, 0, -d.L * 0.9]));
    const z = from[2] - 0.5 * GRAVITY * since * since;
    const p: V3 = [from[0], from[1], Math.max(0.01, z)];
    if (nearSide(p, mid, view) !== front) return;
    const [x, y] = onScreen(view, p);
    if (z > 0.01) bead(g, x, y, d.r * 0.85, 1, 1.25);
    else bead(g, x, y, d.r * 1.3, 0.8, 0.4);
  });
}

/** Pollen thrown up as the Hivemaster presses its comb home: a burst of motes out and up off its foot, drifting down. */
function pollenBurst(g: CanvasRenderingContext2D, view: View, s: Bee, b: Bones, t: number, front: boolean): void {
  const since = (t - BEE_WORK.home + 0.01) * ACT_SECS.work;
  if (since < 0 || since > 0.8) return;
  const mid = b.body.t, foot = place(b.prop, [0, 0, -s.prop.r[1] * 0.9]), top = place(b.prop, [0, 0, s.prop.r[1] * 0.6]);
  for (let q = 0; q < 26; q++) {
    const from = q % 3 === 0 ? top : foot, a0 = jitter(q + 1) * TAU, sp = 1.4 + 1.8 * jitter(q + 2);
    const v: V3 = [Math.cos(a0) * sp, Math.sin(a0) * sp, 1.6 + 2 * jitter(q + 3)];
    const drag = 1 - Math.exp(-since * 7);
    const p: V3 = [from[0] + (v[0] / 3) * drag, from[1] + (v[1] / 3) * drag, Math.max(0.02, from[2] + (v[2] / 3) * drag - 0.5 * since * since)];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    mote(g, x, y, 0.035 + 0.025 * jitter(q + 4), POLLEN[q % 3], 1 - smooth((since - 0.35) / 0.4));
  }
}

/** Honey off the Combworker's comb as it presses it: beads flicked out from its sides at each press. */
function pressSpatter(g: CanvasRenderingContext2D, view: View, s: Bee, b: Bones, t: number, front: boolean): void {
  const mid = b.body.t;
  for (const [hit, id] of [[BEE_WORK.press, 3], [BEE_WORK.press2, 17]] as const) {
    const since = (t - hit) * ACT_SECS.work;
    if (since < 0 || since > 0.4) continue;
    for (let q = 0; q < 6; q++) {
      const sd = q % 2 ? 1 : -1, from = place(b.prop, [sd * s.prop.r[0] * 0.9, 0, -s.prop.r[1] * 0.2]), k = id + q;
      const v: V3 = add(scale(turn(b.prop, [sd, 0, 0]), 0.6 + 0.6 * jitter(k)), [0, 0, 0.6 + 0.8 * jitter(k + 1)]);
      const p: V3 = [from[0] + v[0] * since, from[1] + v[1] * since, Math.max(0.01, from[2] + v[2] * since - 0.5 * GRAVITY * since * since)];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      bead(g, x, y, 0.022 + 0.01 * jitter(k + 2), 1 - smooth((since - 0.25) / 0.15), 1.1);
    }
  }
}

/** The sting going home: a quick bright streak along its line and a short flash at its point. */
function stingZip(g: CanvasRenderingContext2D, view: View, s: Bee, b: Bones, t: number): void {
  const hit = BEE_HITS[s.stage], since = (t - hit) * ACT_SECS.strike;
  if (since < -0.08 || since > 0.14) return;
  const tip = place(b.abd, [0, -s.abd.len * 1.12, -0.12 * s.abd.len - s.abd.w * 0.1]), back = place(b.abd, [0, -s.abd.len * 0.6, -0.05 * s.abd.len]);
  const [x1, y1] = onScreen(view, tip), [x0, y0] = onScreen(view, back);
  const k = since < 0 ? 1 + since / 0.08 : 1 - since / 0.14, px = pxOf(g);
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = css([255, 250, 220], 0.85 * k);
  g.lineWidth = Math.max(px * 1.4, s.abd.w * 0.12);
  g.beginPath();
  g.moveTo(x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.2);
  g.lineTo(x1 + (x1 - x0) * 0.6, y1 + (y1 - y0) * 0.6);
  g.stroke();
  const r = s.abd.w * 0.5 * (since > 0 ? 1 + since * 4 : 0.5);
  g.strokeStyle = css([255, 236, 150], 0.9 * k);
  g.lineWidth = Math.max(px, s.abd.w * 0.05);
  g.beginPath();
  for (let q = 0; q < 5; q++) {
    const an = (q / 5) * TAU + 0.4;
    g.moveTo(x1 + Math.cos(an) * r * 0.35, y1 + Math.sin(an) * r * 0.35);
    g.lineTo(x1 + Math.cos(an) * r, y1 + Math.sin(an) * r);
  }
  g.stroke();
  g.restore();
}

/** Evolving: pollen and petals spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Bee, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.08, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const mid = b.body.t, rx = s.abd.len * 1.1 + 0.2, high = s.high + s.head.at[2] + s.head.r[2] * 2;
  for (let q = 0; q < 20; q++) {
    const u = clamp((t - 0.08 - 0.1 * jitter(q + 13)) / 0.34), ang = (q / 20) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const p: V3 = [mid[0] + Math.cos(ang) * rx * kk, mid[1] + Math.sin(ang) * rx * kk, 0.1 + u * high];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3 === 0) {
      const c = PETAL_RGB[q % 2 ? 1 : (q % 9 === 0 ? 2 : 0)], r = 0.07;
      g.fillStyle = css(c, swirl);
      g.strokeStyle = css(mix(c, [70, 50, 30], 0.6), swirl);
      g.lineWidth = Math.max(pxOf(g) * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.45, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    } else mote(g, x, y, 0.03 * (1 - 0.4 * u), POLLEN[q % 3], swirl * ramp(u, 0, 0.15));
  }
}

/** Light over it as it evolves: a warm honey glow as it begins, and over its head at the turn. */
function beeGlow(s: Bee, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], big = s.high + s.head.at[2] + s.head.r[2];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: b.body.t, r: big, c: [255, 220, 140], a: 0.55 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: b.head.t, r: big * 1.2, c: [255, 236, 176], a: k });
  return out;
}

/* ---- its pieces ------------------------------------------------------------------------------ */

/** A stage's pieces. */
function beeBuild(s: Bee, lod: number): Piece[] {
  const fine = lod > 0, n = cut(lod, 7, 9), k = cut(lod, 5, 6), pieces: Piece[] = [];
  const thHide = thoraxSolid(s), headHide = [{ c: [0, 0, 0] as V3, r: scale(s.head.r, 0.88) }];
  pieces.push({ key: 'thorax', mesh: thoraxOf(s, n, k, fine), bone: 'body', bias: 0, lines: false, breathes: { c: [0, 0, 0], k: 0.04 } });
  pieces.push({ key: 'abd', mesh: abdOf(s, n, fine), bone: 'abd', bias: -0.01, lines: false, breathes: { c: [0, -s.abd.len * 0.5, 0], k: 0.06 } });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false, fine), shut: headOf(s, n, k, true, fine), bone: 'head', bias: 0.12, lines: false });
  pieces.push({ key: 'ear0', mesh: mirror(earOf(s, n)), bone: 'head', bias: 0.121, after: 'head', hide: headHide });
  pieces.push({ key: 'ear1', mesh: earOf(s, n), bone: 'head', bias: 0.121, after: 'head', hide: headHide });
  for (let i = 0; i < 2; i++) {
    const f = feelerOf(s, n);
    pieces.push({ key: `ant${i}`, mesh: i ? f : mirror(f), bone: `ant${i}`, bias: 0.13, after: 'head', hide: headHide, hideIn: 'head', thin: true });
  }
  if (s.crown) pieces.push({ key: 'crown', mesh: crownOf(s, fine), bone: 'head', bias: 0.125, after: 'head', hide: headHide });
  // Round its neck, over the thorax and under the head.
  if (s.ruff) pieces.push({ key: 'ruff', mesh: ruffOf(s, fine), bone: 'body', bias: 0.03, after: 'thorax', hide: thHide });
  else pieces.push({ key: 'collar', mesh: collarOf(s, fine), bone: 'body', bias: 0.03, after: 'thorax', hide: thHide, lines: false });
  if (s.sash) pieces.push({ key: 'sash', mesh: sashOf(s, fine), bone: 'body', bias: 0.02, after: ['thorax', 'abd'], hide: thHide });
  if (s.skirt) pieces.push({ key: 'skirt', mesh: skirtOf(s, fine), bone: 'abd', bias: -0.005, after: 'abd', hide: abdSolid(s) });
  if (s.puffs) pieces.push({ key: 'puffs', mesh: puffsOf(s), bone: 'body', bias: 0.025, after: 'thorax', hide: thHide, lines: false });
  // Legs: a dark jointed thigh up into the body, the hind ones fat with pollen; a thinner shin; a small clawed foot.
  for (let i = 0; i < 4; i++) {
    const L = legOfI(s, i), key = LEGS[i], sd = sideOf(i), front: V3 = [sd * 0.7, i < 2 ? 0.5 : -0.5, 0];
    pieces.push(
      { key: `${key}0`, mesh: thighOf(L, n - 1), bone: `${key}0`, bias: 0.01, under: 'thorax' },
      { key: `${key}1`, mesh: shinOf(L, n - 2), bone: `${key}1`, bias: 0.02, after: ['thorax', 'abd', `${key}0`], front, convex: true },
      { key: `${key}2`, mesh: footOf(L, n - 2), bone: `${key}2`, bias: 0.03, after: ['thorax', `${key}1`], front },
    );
    if (i >= 2 && s.thigh) pieces.push({ key: `pollen${i}`, mesh: pollenOf(L, s.thigh, n, fine), bone: `${key}0`, bias: 0.025, after: ['thorax', 'abd', `${key}0`, `${key}1`], front, lines: false });
  }
  // What it carries, its drips, and the forelegs that hold it.
  const prop = s.carry === 'drop' ? dropOf(s, n, k) : combOf(s, fine);
  pieces.push({ key: 'prop', mesh: prop, bone: 'prop', bias: 0.05, lines: s.carry === 'drop' ? false : undefined });
  const drips = dripsAt(s), dripSizes = drips.map((d) => dripMesh(d.p, d.L, d.r, n).v.length);
  pieces.push({
    key: 'drips', mesh: merge(...drips.map((d) => dripMesh(d.p, d.L, d.r, n))), bone: 'prop', bias: 0.049, after: 'prop', lines: false,
    // Each drip run down as far as it has got: its thread stretched, the bead at its end carried down whole.
    bent: (v, a) => {
      const out: V3[] = [];
      let q = 0, at = 0;
      for (let j = 0; j < v.length; j++) {
        while (j >= at + dripSizes[q]) { at += dripSizes[q]; q++; }
        const d = drips[q], run = d.L * 0.8, shift = (dripLen(dripOf(a, q)) - 1) * run, dz = v[j][2] - d.p[2];
        out.push([v[j][0], v[j][1], v[j][2] + (dz < 0 ? shift * Math.min(1, -dz / run) : 0)]);
      }
      return out;
    },
  });
  for (let i = 0; i < 2; i++) {
    const out: V3 = [i ? 1 : -1, 0.4, 0], m = (x: Mesh): Mesh => (i ? x : mirror(x));
    pieces.push(
      { key: `arm${i}`, mesh: m(armUpperOf(s, n - 2)), bone: `arm${i}`, bias: 0.04, after: 'thorax', front: out },
      { key: `fore${i}`, mesh: m(armLowerOf(s, n - 2)), bone: `elbow${i}`, bias: 0.045, after: ['thorax', `arm${i}`], front: out },
      { key: `paw${i}`, mesh: pawOf(s, n), bone: `hand${i}`, bias: 0.06, after: ['prop', `fore${i}`], front: [0, 1, 0] },
    );
  }
  // The wings, drawn by hand (`wingsOf`): only their corners here, so they are framed and named over.
  for (let q = 0; q < 4; q++) pieces.push({ key: `wingReach${q}`, mesh: reachMesh(q >= 2 ? s.hindWing : s.fore, q % 2 ? 1 : -1, q >= 2), bone: `wing${q}`, bias: 0, rim: false });
  return pieces;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, its glass wings, and the honey and pollen it throws about. */
function beeKind(s: Bee): Kind {
  return {
    bones: beeBones(s),
    build: (lod) => beeBuild(s, lod),
    // The variant's coat is its fur, kept strong; its markings its stripes, its ears, its mask and its legs, kept deep. Its honey,
    // wax, petals, leaves and pollen, its pink nose and its dark eyes are the same on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, [230, 146, 14], 0.14), brown = mix(mark, pastel(mark, 300), 0.18);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [150, 96, 30], 0.28),
        coatLight: mix(fur, [255, 246, 200], 0.4),
        mark: brown,
        hornDark: mix(brown, [30, 20, 18], 0.3),
        claw: mix(brown, [24, 16, 16], 0.55),
        muzzle: [252, 242, 220],
        belly: [240, 224, 190],
        nose: [236, 132, 128],
        inner: mix(brown, [236, 170, 150], 0.45),
        lid: mix(brown, [30, 20, 18], 0.45),
        eye: [34, 22, 24],
        glint: [255, 255, 255],
        petal: [252, 244, 222],
        feather: [240, 226, 190],
        featherDark: [226, 204, 160],
        bloom: [252, 222, 110],
        leaf: [104, 146, 66],
        moss: [138, 164, 80],
        leafDark: [70, 100, 50],
        ember: [238, 150, 22],
        flame: [255, 196, 70],
        crystal: [222, 128, 26],
        crystalDark: [190, 92, 12],
        shell: [248, 214, 110],
        shellDark: [214, 162, 66],
        spot: [255, 214, 64],
      }, 60);
    },
    shadow: [s.abd.len * 0.7 + s.thorax[1], s.hind.stance + 0.1],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are pollen yellow and honey.
    motes: [[255, 214, 70], [240, 168, 40]],
    glow: (b, a) => beeGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      wingsOf(g, view, s, b, a, front);
      fallingDrips(g, view, s, b, a, front);
      if (act?.kind === 'work' && s.stage === 2) pollenBurst(g, view, s, b, act.t, front);
      if (act?.kind === 'work' && s.stage === 1) pressSpatter(g, view, s, b, act.t, front);
      if (act?.kind === 'strike' && front) stingZip(g, view, s, b, act.t);
      if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const BUZZLET = beeKind(BUZZLET_LOOK);
export const COMBWORKER = beeKind(COMBWORKER_LOOK);
export const HIVEMASTER = beeKind(HIVEMASTER_LOOK);
