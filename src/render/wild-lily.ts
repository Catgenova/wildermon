import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The lily line: the Padbloom, a small round tortoise, green mottled darker and yellow-green, its beak, throat and belly cream, a
 * round dark eye and an open happy mouth, a lily leaf for a cap, a frill of leaves round its neck; its shell all round lily pads
 * lying over one another with a wavy tan band round its edge, leaves hanging down over its legs, one shut pink lotus bud on top;
 * which grows into the Lilyback, bigger, its neck longer, pads overlapping over the whole of its back, an open pink lotus with a
 * yellow middle on top and two buds on stalks; and then the Lotushell, very large and stately, its eyes shut and smiling, the top
 * of its shell a little pond of dark teal water with white ripples ringed by great pads, open lotuses rising out of it, buds on
 * tall stalks and curling stems, a lotus on its head, a mane of leaves down its neck, white star flowers on its heavy legs.
 * The species is still `spitta` underneath, as saves and the database know it: the hand that plants water lilies and lotus.
 *
 * All three are built by one set of functions from a description of the stage (`Lily`), on a tortoise's body: the dome of the
 * shell, the neck coming out from under its front, four pillar legs each given a point on the ground and bent to reach it. Each
 * pad is laid on the dome, round with a notch cut to its middle, its veins drawn out from there; each course of pads is a piece
 * of its own drawn after the one below it, so they lie over one another like shingles. The flowers stand on a bone of their own
 * on the top of the shell, so they sway as it plods.
 *
 * At its task it plants: a lily root in its beak, it lowers its head to the water in front of it, pushes the root down and lets
 * it go, and lifts its head again; rings spread on the water where it went in and a little pad opens there.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Leg {
  hip: V3;
  len: [number, number];
  at: [number, number];
  /** Heel to the front of the foot; how many toenails. */
  foot: number; toes: number;
  w: number;
  turn: number;
}

/** A course of pads round the dome: the elevation of their middles (radians), how many, how big, and how far off the dome. */
interface Course { ph: number; n: number; r: number; lift: number }

/** A flower on its stalk: where its stalk stands (on the shell's frame), how tall, which way it leans, how big, and open or a bud. */
interface Flower { at: V3; tall: number; lean: V3; r: number; open: boolean }

interface Lily {
  stage: 0 | 1 | 2;
  /** The dome: half its width and length, its height, from its rim. */
  shell: { w: number; l: number; h: number };
  /** How far the cream below the band flares out over the legs. */
  flare: number;
  /** The wavy band round the shell's edge: its elevation, how tall and thick, how many waves, how deep they are. */
  band: { ph: number; h: number; t: number; waves: number; amp: number };
  courses: readonly Course[];
  /** A pad laid over the top, its radius, or none where a pond is. */
  cap: number;
  /** The pond on the Lotushell's back: its outer radius, its wall, its foot (along, up), its height, how far down the water is. */
  pond: { r: number; wall: number; y: number; z: number; h: number; down: number } | null;
  flowers: readonly Flower[];
  /** Curling stems: where each stands and how tall. */
  curls: ReadonlyArray<{ at: V3; tall: number; turn: number }>;
  /** Leaves hanging from under the band: how many, how long. */
  hang: number;
  hangLen: number;
  /** The head: where its neck comes out under the front of the shell, its half-sizes, the neck's length and how far it is raised (degrees). */
  head: { at: V3; r: V3; neck: number; lift: number; thick: number };
  /** Leaves round the foot of the neck; a mane of them down the back of it. */
  frill: number;
  mane: number;
  /** Leaves on the upper legs; white star flowers on them. */
  legLeaves: boolean;
  stars: boolean;
  /** Its eyes shut and smiling, its mouth closed: the Lotushell's. */
  shut: boolean;
  high: number;
  fore: Leg;
  hind: Leg;
  tail: number;
  gait: { duty: number; swing: [number, number]; step: number; bob: number; roll: number };
  size: number;
}

/** A Padbloom: small, a big head, round pads all over its shell, a shut bud on top, a leaf for a cap. */
const PADBLOOM_LOOK: Lily = {
  stage: 0,
  shell: { w: 0.86, l: 0.94, h: 0.5 },
  flare: 0.1,
  band: { ph: -0.02, h: 0.08, t: 0.055, waves: 7, amp: 0.07 },
  courses: [
    { ph: 0.36, n: 7, r: 0.42, lift: 0.025 },
    { ph: 0.9, n: 4, r: 0.34, lift: 0.055 },
  ],
  cap: 0.36,
  pond: null,
  flowers: [{ at: [0, -0.04, 0], tall: 0.1, lean: [0, -0.15, 1], r: 0.13, open: false }],
  curls: [],
  hang: 5,
  hangLen: 0.16,
  head: { at: [0, 0.72, 0.08], r: [0.4, 0.46, 0.38], neck: 0.36, lift: 52, thick: 0.27 },
  frill: 7,
  mane: 0,
  legLeaves: false,
  stars: false,
  shut: false,
  high: 0.38,
  fore: { hip: [0.5, 0.46, 0], len: [0.19, 0.19], at: [0.68, 0.62], foot: 0.05, toes: 3, w: 0.23, turn: 18 },
  hind: { hip: [0.48, -0.48, 0], len: [0.19, 0.19], at: [0.66, -0.58], foot: 0.05, toes: 3, w: 0.24, turn: 22 },
  tail: 0.14,
  gait: { duty: 0.68, swing: [0.17, 0.23], step: 0.26, bob: 0.025, roll: 4.5 },
  size: 3.5,
};

/** A Lilyback: bigger, its neck longer and held up, pads over one another all over it, an open lotus on top and two buds. */
const LILYBACK_LOOK: Lily = {
  stage: 1,
  shell: { w: 0.98, l: 1.12, h: 0.52 },
  flare: 0.12,
  band: { ph: -0.02, h: 0.09, t: 0.06, waves: 8, amp: 0.08 },
  courses: [
    { ph: 0.3, n: 9, r: 0.44, lift: 0.025 },
    { ph: 0.78, n: 6, r: 0.38, lift: 0.05 },
  ],
  cap: 0.3,
  pond: null,
  flowers: [
    { at: [0.02, -0.08, 0], tall: 0.08, lean: [0, -0.1, 1], r: 0.36, open: true },
    { at: [-0.42, 0.52, 0], tall: 0.24, lean: [-0.35, 0.5, 1], r: 0.1, open: false },
    { at: [0.5, -0.5, 0], tall: 0.3, lean: [0.4, -0.4, 1], r: 0.11, open: false },
  ],
  curls: [],
  hang: 8,
  hangLen: 0.2,
  head: { at: [0, 0.98, 0.08], r: [0.34, 0.45, 0.33], neck: 0.9, lift: 70, thick: 0.33 },
  frill: 9,
  mane: 0,
  legLeaves: true,
  stars: false,
  shut: false,
  high: 0.42,
  fore: { hip: [0.56, 0.55, 0], len: [0.21, 0.21], at: [0.8, 0.72], foot: 0.06, toes: 3, w: 0.28, turn: 18 },
  hind: { hip: [0.54, -0.56, 0], len: [0.21, 0.21], at: [0.78, -0.66], foot: 0.06, toes: 3, w: 0.29, turn: 22 },
  tail: 0.18,
  gait: { duty: 0.7, swing: [0.15, 0.21], step: 0.22, bob: 0.02, roll: 3.5 },
  size: 4.2,
};

/** A Lotushell: very large, a pond on its back ringed by great pads, lotuses and buds out of it, its eyes shut, a lotus on its head. */
const LOTUSHELL_LOOK: Lily = {
  stage: 2,
  shell: { w: 1.08, l: 1.3, h: 0.46 },
  flare: 0.14,
  band: { ph: -0.02, h: 0.1, t: 0.065, waves: 9, amp: 0.08 },
  courses: [
    { ph: 0.28, n: 11, r: 0.46, lift: 0.025 },
    { ph: 0.66, n: 8, r: 0.42, lift: 0.05 },
  ],
  cap: 0,
  pond: { r: 0.82, wall: 0.08, y: -0.08, z: 0.32, h: 0.15, down: 0.045 },
  flowers: [
    { at: [0.1, -0.3, 0], tall: 0.22, lean: [0.05, -0.1, 1], r: 0.48, open: true },
    { at: [-0.36, 0.24, 0], tall: 0.14, lean: [-0.2, 0.15, 1], r: 0.36, open: true },
    { at: [0.38, 0.28, 0], tall: 0.06, lean: [0.2, 0.2, 1], r: 0.2, open: true },
    { at: [-0.56, -0.52, 0], tall: 0.44, lean: [-0.35, -0.2, 1], r: 0.12, open: false },
    { at: [0.5, -0.66, 0], tall: 0.42, lean: [0.3, -0.25, 1], r: 0.11, open: false },
    { at: [0.42, 0.62, 0], tall: 0.34, lean: [0.25, 0.4, 1], r: 0.1, open: false },
  ],
  curls: [{ at: [-0.18, -0.64, 0], tall: 0.38, turn: -1 }, { at: [0.66, -0.2, 0], tall: 0.3, turn: 1 }],
  hang: 11,
  hangLen: 0.25,
  head: { at: [0, 1.04, 0.08], r: [0.34, 0.48, 0.32], neck: 1.08, lift: 66, thick: 0.42 },
  frill: 10,
  mane: 9,
  legLeaves: true,
  stars: true,
  shut: true,
  high: 0.58,
  fore: { hip: [0.6, 0.62, 0], len: [0.3, 0.3], at: [0.86, 0.82], foot: 0.08, toes: 4, w: 0.38, turn: 16 },
  hind: { hip: [0.58, -0.66, 0], len: [0.3, 0.3], at: [0.84, -0.78], foot: 0.08, toes: 4, w: 0.39, turn: 20 },
  tail: 0.22,
  gait: { duty: 0.74, swing: [0.14, 0.18], step: 0.18, bob: 0.018, roll: 3 },
  size: 5.6,
};

/* ---- helpers ------------------------------------------------------------------------- */

const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** A mesh moved by `d`, for a piece built where it stands on the shell and hung on a bone at `-d`. */
const shifted3 = (m: Mesh, d: V3): Mesh => mesh(m.v.map((p) => add(p, d)), m.f);

/** Each face wound so it faces the way wanted of it, whichever way round it was listed. */
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

/** A flat painted shape from its corners, wound to face along `n`. */
function facing(pts: V3[], n: V3, m: Mat, lit?: boolean): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, lit };
}

/** A band a line wide along a line of points on a surface facing `n`: a vein, a seam, a ripple. */
function band(pts: readonly V3[], n: V3, w: number, m: Mat, lift = 0.012): Disc[] {
  const out: Disc[] = [];
  for (let q = 0; q < pts.length - 1; q++) {
    const a = pts[q], b = pts[q + 1], d = unit(sub(b, a)), side = scale(unit(cross(n, d)), w), up = scale(n, lift);
    const a2 = sub(a, scale(d, w * 0.9)), b2 = add(b, scale(d, w * 0.9));
    out.push(facing([add(add(a2, side), up), add(add(b2, side), up), add(sub(b2, side), up), add(sub(a2, side), up)], n, m));
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

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: its head shot out and its beak snapped shut. */
export const LILY_HITS: readonly number[] = [0.5, 0.53, 0.56];
/**
 * A go at its task, as shares of it: its head goes down with the root in its beak, the root is pushed in and let go at `plant`,
 * and its head is up again by `up`. It loops, so a go and the next are one.
 */
export const LILY_WORK = { down: 0.08, plant: 0.48, up: 0.86 } as const;
/** When it draws its head in a little and puts it out again, standing about, in seconds into its loop, and for how long. */
export const LILY_TUCKS: readonly number[] = [8.2, 20.6];
export const LILY_TUCK_LEN = 2.0;
/** How far each stage holds its mouth open, standing about (degrees): the Padbloom's and the Lilyback's open and happy. */
const JAW_REST = [22, 18, 0];

/* ---- where its feet go ---------------------------------------------------------------- */

interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The head: pitched up, turned left, tilted (degrees); its neck pushed out or drawn in; its jaw open (degrees). */
  head: [number, number, number]; neck: number; jaw: number;
  /** How far its neck is bowed down from its lift (degrees), its head held as it was against it. */
  bow: number;
  /** The flowers' sway: pitched and rolled (degrees). */
  sway: [number, number];
}

interface Rest {
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
  heel: number[];
}

const rests = new Map<Lily, Rest>();
const legOfI = (s: Lily, i: number): Leg => (i < 2 ? s.fore : s.hind);
function restOf(s: Lily): Rest {
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

function restPlan(s: Lily, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    head: [0, 0, 0], neck: 0, jaw: 0, bow: 0, sway: [0, 0],
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])], neck: m(a.neck, b.neck), jaw: m(a.jaw, b.jaw),
    bow: m(a.bow, b.bow), sway: [m(a.sway[0], b.sway[0]), m(a.sway[1], b.sway[1])],
  };
}

/** A plan moved on by the difference between two others: an act played over its standing about, which goes on under it. */
function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  return {
    at: p.at.map((x, i) => [d(x[0], to.at[i][0], from.at[i][0]), d(x[1], to.at[i][1], from.at[i][1]), d(x[2], to.at[i][2], from.at[i][2])] as V3),
    foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    neck: d(p.neck, to.neck, from.neck), jaw: p.jaw, bow: d(p.bow, to.bow, from.bow), sway: [d(p.sway[0], to.sway[0], from.sway[0]), d(p.sway[1], to.sway[1], from.sway[1])],
  };
}

const lenOf = (s: Lily): number => s.fore.hip[1] - s.hind.hip[1];

/** The diagonals together, the left fore with the right hind. */
const TROT = [0, 0.5, 0.5, 0];
const EDGE = 0.12;

/**
 * Going: a slow plod, the diagonals together, each foot down for most of a stride and swept back under the shell, then lifted
 * and brought forward. The shell sways from side to side over the feet that are down and settles at each footfall; the head
 * nods with each step and the flowers on its back nod after the shell.
 */
function goPlan(s: Lily, R: Rest, a: Anim, fast: number): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s);
  const p = restPlan(s, R);
  const duty = lerp(G.duty, 0.55, fast), amp = lerp(G.swing[0], G.swing[1], fast), step = G.step * (1 + 0.3 * fast);
  for (let i = 0; i < 4; i++) {
    const reach = R.reach[i], half = reach * amp * 1.6, A = R.ankle[i], ph = frac(a.u + TROT[i]);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      p.foot[i] = 12 * ramp(ph / duty, 0.7, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    const lift = step * reach * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0], y, lift];
    p.foot[i] = 12 * (1 - smooth(u / 0.6)) - 8 * hump(u, 0.75, 0.25);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.06));
  p.H += -L * G.bob * (1 + 0.6 * fast) * down;
  const over = Math.sin(TAU * (w + 0.25 - duty / 2));
  p.roll = G.roll * (1 + 0.3 * fast) * over;
  p.side = L * 0.025 * over;
  p.yaw = 2.5 * Math.sin(TAU * (w - 0.1));
  p.pitch = 1.2 * (down - 0.5) - 1.5 * fast;
  p.squash = 0.02 * (1 + fast) * hump(frac(2 * w - 0.06), 0.1, 0.2);
  p.head = [6 * (2 * down - 1) - 4, -5 * Math.sin(TAU * (w - 0.1)), -3 * over];
  p.neck = 0.05 * L * (down - 0.5);
  p.sway = [5 * Math.cos(2 * TAU * (w - 0.18)), -4 * Math.sin(TAU * (w + 0.1 - duty / 2))];
  return p;
}

/** How far its head is drawn in, standing about, nought to one. */
function tuckOf(t: number): number {
  let k = 0;
  for (const c of LILY_TUCKS) {
    const u = (t - c) / LILY_TUCK_LEN;
    if (u > 0 && u < 1) k = Math.max(k, ramp(u, 0, 0.25) * (1 - ramp(u, 0.6, 1)));
  }
  return k;
}

/**
 * Standing about: breathing slowly, its head turning to look about and tilting, its mouth opening a little wider and closing
 * again as it breathes; twice a loop it draws its head in a little and puts it out again; now and then it shifts its weight from
 * foot to foot; the flowers on its back stir.
 */
function stillPlan(s: Lily, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, L = lenOf(s);
  p.yaw = 2 * drift(t);
  p.roll = 1 * cyc(t, 3);
  p.H += 0.008 * L * (a.breath - 0.5);
  p.head = [4 * cyc(t, 2) + 2 * a.breath, 22 * drift(t, 1.3), 6 * drift(t, 2)];
  p.neck = 0.03 * L * a.breath;
  p.jaw = s.shut ? 0 : 5 * (a.breath - 0.5);
  const tuck = tuckOf(t);
  p.neck -= s.head.neck * 0.4 * tuck;
  p.head[0] -= 12 * tuck;
  const shift = beat(t, [12.8], 1.2);
  if (shift > 0) {
    const A = R.ankle[1];
    p.at[1] = [A[0], A[1] + 0.03 * L * shift, R.reach[1] * 0.22 * Math.sin(Math.PI * clamp((t - 12.8) / 1.2))];
    p.roll -= 2 * shift;
  }
  p.sway = [2.5 * cyc(t, 3, 0.4), 2 * drift(t, 0.8)];
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** Its bite: its head drawn back toward its shell, then shot out with its beak open and snapped shut, its weight lurching after it. */
function bitePlan(s: Lily, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = LILY_HITS[s.stage], L = lenOf(s);
  const back = ramp(t, 0.04, 0.32) * (1 - ramp(t, 0.34, 0.44));
  const out = ramp(t, 0.36, hit) * (1 - ramp(t, 0.7, 0.98));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.05 * back + 0.08 * out);
  p.H += L * (-0.03 * back + 0.02 * out);
  p.pitch = 3 * back - 4 * out;
  p.neck = s.head.neck * (-0.4 * back + 0.35 * out);
  p.head = [14 * back - 24 * out + 8 * jolt, 0, 0];
  p.jaw = 30 * ramp(t, 0.34, hit - 0.06) * (1 - ramp(t, hit - 0.04, hit)) - JAW_REST[s.stage] * ramp(t, hit - 0.04, hit) * (1 - ramp(t, 0.8, 1));
  p.squash = 0.05 * jolt;
  p.sway = [-8 * jolt + 4 * back, 0];
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0] * 1.04, A[1] + L * 0.1, 0];
    p.at[i] = t < 0.66 ? arc(A, fwd, ramp(t, 0.4 + 0.06 * i, hit + 0.06 * i), R.reach[i] * 0.35) : arc(fwd, A, ramp(t, 0.72 + 0.08 * i, 0.96), R.reach[i] * 0.25);
  }
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.06) * (1 - ramp(t, 0.94, 1)));

/**
 * A go at its task: its feet planted and its weight forward, it lowers its head to the water in front of it with the root in its
 * beak, pushes it down and lets it go at `plant` (its beak opens), and lifts its head again, a little nod of satisfaction at the
 * top; the flowers on its back nod with it.
 */
function workPlan(s: Lily, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s), W = LILY_WORK;
  const dip = ramp(t, W.down, W.plant - 0.08) * (1 - ramp(t, W.plant + 0.06, W.up));
  const push = hump(t, W.plant - 0.03, 0.08);
  p.pitch = -4 * dip - 1.5 * push;
  p.surge = L * 0.03 * dip;
  p.H -= L * (0.02 * dip + 0.01 * push);
  // Its neck out and bowed down to the water in front of it, its beak turned down into it, further for the push.
  p.neck = s.head.neck * (0.25 * dip + 0.08 * push);
  p.bow = -(s.head.lift + 26) * dip - 6 * push;
  p.head = [-(HEAD_UP[s.stage] + 45) * dip - 12 * push + 6 * hump(t, 0.93, 0.07), 0, 3 * Math.sin(TAU * t)];
  // Its beak shut on the root while it carries it, open as it lets it go, then back to its happy open mouth.
  p.jaw = -JAW_REST[s.stage] * (1 - ramp(t, W.plant - 0.02, W.plant + 0.04)) + 14 * hump(t, W.plant + 0.06, 0.08);
  p.sway = [-6 * dip + 4 * push, 2 * Math.sin(TAU * t)];
  for (let i = 0; i < 4; i++) p.foot[i] = i < 2 ? 4 * dip : 0;
  const q = mixPlan(restPlan(s, R), p, down);
  q.jaw = p.jaw * down;
  return q;
}

/** Foraging in the wild: its head down at the ground, nibbling. */
function grazePlan(s: Lily, R: Rest, a: Anim, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  p.pitch = -3;
  p.head = [-s.head.lift - 12 + 4 * Math.sin(a.t * 5), 6 * drift(a.t, 0.7), 0];
  p.neck = s.head.neck * 0.1;
  p.jaw = -JAW_REST[s.stage] + 14 * Math.max(0, Math.sin(a.t * 6));
  p.H -= L * 0.01;
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: drawn down small into its shell as the light gathers, then up tall at the turn with its head high, a shake, and settled. */
function evolvePlan(s: Lily, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.08 * hunch + 0.06 * up);
  p.pitch = -3 * hunch + 8 * up;
  p.roll = 4 * shake;
  p.squash = 0.08 * hunch - 0.03 * up + 0.06 * hump(t, 0.72, 0.05);
  p.head = [-16 * hunch + 18 * up, 6 * shake, 10 * shake];
  p.neck = s.head.neck * (-0.5 * hunch + 0.15 * up);
  p.jaw = 12 * up - JAW_REST[s.stage] * hunch;
  p.sway = [10 * shake, 8 * shake];
  for (const i of [2, 3]) p.foot[i] = 14 * up;
  return p;
}

const MOST_REACH = 0.94;

function footHeading(i: number, L: Leg): V3 {
  const a = SIDE[i] * -L.turn * DEG;
  return [-Math.sin(a), Math.cos(a), 0];
}
function heelOf(s: Lily, R: Rest, i: number, at: V3, lift: number): V3 {
  const L = legOfI(s, i), h = footHeading(i, L), F = L.foot, c = Math.cos(lift * DEG), sn = Math.sin(lift * DEG);
  return [at[0] - h[0] * F * c, at[1] - h[1] * F * c, at[2] + R.heel[i] + F * sn];
}

function seated(s: Lily, R: Rest, p: Plan): Plan {
  let drop = 0;
  const body = joint(ROOT, [p.side, p.surge, p.H], p.pitch, p.roll, p.yaw);
  const at = p.at.map((x) => [...x] as V3);
  for (let i = 0; i < 4; i++) {
    const hip = place(body, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), flat = d[0] * d[0] + d[1] * d[1], up = -d[2];
    if (flat + up * up <= L * L) continue;
    const need = up - Math.sqrt(Math.max(0, L * L - flat)), k = 1 - smooth(at[i][2] / (0.2 * R.reach[i]));
    drop = Math.max(drop, need * k);
  }
  const H = p.H - Math.max(0, drop);
  const body2 = joint(ROOT, [p.side, p.surge, H], p.pitch, p.roll, p.yaw);
  for (let i = 0; i < 4; i++) {
    const hip = place(body2, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), D = len3(d);
    if (D > L) at[i] = add(at[i], scale(d, L / D - 1));
  }
  return { ...p, at, H };
}

function posedOf(s: Lily, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(bitePlan(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(grazePlan(s, R, a, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goPlan(s, R, a, smooth(clamp(a.gait)));
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

function legOf(R: Rest, body: Xf, i: number, ankle: V3, heading: V3, lift: number): [Xf, Xf, Xf] {
  const fore = i < 2, [l0, l1] = R.legs[i];
  const hip = place(body, R.hip[i]), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = len3(d);
  const Dc = clamp(D, Math.abs(l0 - l1) + 0.05 * (l0 + l1), (l0 + l1) * 0.985);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit(fore ? [SIDE[i] * 0.8, -0.55, 0.2] : [SIDE[i] * 0.7, 0.6, 0.35]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], heading);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], -lift)];
}

/** How far each stage holds its head tipped up, its chin raised (degrees). */
const HEAD_UP = [26, 26, 30];
/** Where the flowers' bone stands on the shell: the top of the dome, or the water of the pond. */
const bloomAt = (s: Lily): V3 => (s.pond ? [0, s.pond.y, s.pond.z + s.pond.h - s.pond.down] : [0, 0, s.shell.h]);

function lilyBones(s: Lily): (a: Anim) => Bones {
  const R = restOf(s);
  return (a) => {
    const P = seated(s, R, posedOf(s, R, { ...a, go: a.act ? 0 : a.go }));
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const H = s.head;
    // The neck comes out from under the front of the shell raised by its lift, and bows and turns with the head; the head the rest
    // of the way on the end of it, held level against the lift. Pushed out or drawn in, the neck is drawn out or shortened to it.
    const neck = joint(body, H.at, H.lift + P.bow + P.head[0] * 0.5, 0, P.head[1] * 0.5), k = Math.max(0.2, (H.neck + P.neck) / H.neck);
    b.head = joint(neck, [0, H.neck + P.neck, 0], -H.lift - P.bow + HEAD_UP[s.stage] + P.head[0] * 0.5, P.head[2], P.head[1] * 0.5);
    b.jaw = joint(b.head, jawHinge(s), -Math.max(-2, JAW_REST[s.stage] + P.jaw));
    const m = neck.m;
    b.neck = { m: [m[0], m[1] * k, m[2], m[3], m[4] * k, m[5], m[6], m[7] * k, m[8]], t: neck.t };
    b.frill = neck;
    for (let i = 0; i < 4; i++) {
      const L = legOfI(s, i), g = P.at[i];
      const heading = footHeading(i, L);
      const heel = heelOf(s, R, i, [g[0], g[1], Math.max(0, g[2])], P.foot[i]);
      const [u, l, f] = legOf(R, body, i, heel, heading, P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    b.tail = joint(body, [0, -s.shell.l * 0.84, 0.0], -20 + 5 * Math.sin(a.t * 1.7), 0, 10 * Math.sin(a.t * 1.1));
    // The flowers on its back sway together about where they stand, after the shell.
    b.bloom = joint(b.trunk, bloomAt(s), P.sway[0], P.sway[1], 0);
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    return b;
  };
}

/* ---- the shell ---------------------------------------------------------------------------------- */

/** How square the dome is across: two an egg, more a loaf. */
const DOME_E = 2.1;
/** A point on the dome, `th` round from its front (to the right) and `ph` up from its foot, and the way out of it; below its foot it flares out. */
function domeAt(s: Lily, th: number, ph: number, out = 0): { p: V3; n: V3 } {
  const S = s.shell, sx = Math.sin(th), cy = Math.cos(th);
  let p: V3, n: V3;
  if (ph >= 0) {
    const E = DOME_E, c = Math.max(0, Math.cos(ph)), sn = Math.max(0, Math.sin(ph));
    const rho = c ** (2 / E), z = sn ** (2 / E);
    p = [S.w * rho * sx, S.l * rho * cy, S.h * z];
    const g = rho ** (E - 2);
    n = unit([(g * rho * sx) / S.w, (g * rho * cy) / S.l, (z ** (E - 1)) / S.h]);
  } else {
    // Below the foot of the dome: the lower shell going on down, flaring out a little over the legs.
    const f = 1 + s.flare * (-ph);
    p = [S.w * f * sx, S.l * f * cy, S.h * ph * 0.9];
    n = unit([sx / S.w, cy / S.l, -0.15]);
  }
  return { p: add(p, scale(n, out)), n };
}
/** The height of the dome over a point of the ground under it, and the way out of it there: for laying a pad over its top. */
function domeOver(s: Lily, x: number, y: number, out = 0): { p: V3; n: V3 } {
  const S = s.shell, rho = Math.min(0.995, Math.hypot(x / S.w, y / S.l));
  const th = Math.atan2(x / S.w, y / S.l), ph = Math.acos(Math.min(1, rho ** (DOME_E / 2)));
  return domeAt(s, th, ph, out);
}
/** The lowest the shell goes, at its rim: where the lower shell meets the belly. */
const SHELL_FOOT = -0.3;

/** The dome under the pads: a dark green shade where they meet, its lower shell below the band cream. Closed under its rim. */
function domeOf(s: Lily, n: number, k: number): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const rings: number[] = [SHELL_FOOT, -0.2, -0.1, 0];
  for (let q = 1; q <= k; q++) rings.push(lerp(0, Math.PI / 2 - 0.02, q / k));
  for (const ph of rings) for (let j = 0; j < n; j++) v.push(domeAt(s, (j / n) * TAU, ph, -0.01).p);
  const top = v.length;
  v.push([0, 0, s.shell.h - 0.01]);
  for (let q = 0; q < rings.length - 1; q++) {
    const mid = (rings[q] + rings[q + 1]) / 2;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      f.push({ i: [q * n + j, q * n + j2, (q + 1) * n + j2, (q + 1) * n + j], m: mid < s.band.ph ? 'belly' : 'leafDark' });
      want.push(domeAt(s, ((j + 0.5) / n) * TAU, mid).n);
    }
  }
  const last = (rings.length - 1) * n;
  for (let j = 0; j < n; j++) {
    f.push({ i: [last + j, last + ((j + 1) % n), top], m: 'leafDark' });
    want.push([0, 0, 1]);
  }
  f.push({ i: Array.from({ length: n }, (_, j) => j), m: 'belly' });
  want.push([0, 0, -1]);
  const out = mesh(v, woundTo(v, f, want));
  // The plates of the lower shell, cream, each seam down it a darker line; scalloped along the bottom on the bigger two.
  const decals: Disc[] = [];
  const plates = 10 + 2 * s.stage;
  for (let j = 0; j < plates; j++) {
    const th = ((j + 0.5) / plates) * TAU;
    const a = domeAt(s, th, s.band.ph - s.band.amp - 0.06, 0.002), b = domeAt(s, th, SHELL_FOOT + 0.03, 0.002);
    decals.push(...band([a.p, mixV(a.p, b.p, 0.5), b.p], a.n, 0.012, 'shellDark', 0.004));
    if (s.stage > 0) {
      const pts: V3[] = [];
      for (let q = 0; q <= 6; q++) {
        const u = q / 6, t2 = th + (u * TAU) / plates;
        pts.push(domeAt(s, t2, SHELL_FOOT + 0.07 + 0.05 * Math.sin(Math.PI * u), 0.002).p);
      }
      decals.push(...band(pts, domeAt(s, th + TAU / plates / 2, SHELL_FOOT + 0.08).n, 0.01, 'shellDark', 0.004));
    }
  }
  return merge(out, paint(decals));
}

/** Where the band's top edge is, round the shell: the lowest a pad comes down to. */
const bandTop = (s: Lily, th: number): number => s.band.ph + 0.05 + s.band.amp * Math.sin(s.band.waves * th + 0.6);

/** The wavy band round the shell's edge: a rounded tan ribbon going up and down between the pads and the cream below. */
function bandOf(s: Lily, n: number): Mesh {
  const B = s.band, pts: V3[] = [], N = 72;
  for (let j = 0; j <= N; j++) {
    const th = (j / N) * TAU;
    pts.push(domeAt(s, th, B.ph + B.amp * Math.sin(B.waves * th + 0.6), B.t * 0.45).p);
  }
  return tube(pts, B.t, B.h, n, (_r, j) => (j < n / 2 ? 'shell' : 'shellDark'), { start: false, end: false, up: [0, 0, 1] });
}

/**
 * A lily pad laid on the dome, `r` across round its middle at (`th`, `ph`): round, with a notch cut in to its middle pointing up
 * the dome, where the pad above lies over it; its edge turned up a little; its veins drawn out from the middle. Each corner is
 * found on the dome itself, so the pad lies on it however it curves.
 */
function padOn(s: Lily, th: number, ph: number, r: number, lift: number, id: number, lod: number): Mesh {
  const e = 1e-3;
  const dTh = len3(sub(domeAt(s, th + e, ph).p, domeAt(s, th - e, ph).p)) / (2 * e);
  const dPh = len3(sub(domeAt(s, th, ph + e).p, domeAt(s, th, ph - e).p)) / (2 * e);
  const notch = Math.PI / 2 + (jitter(id + 3) - 0.5) * 0.9, gap = 0.2;
  const K = lod ? 14 : 10;
  const at = (a: number, u: number): V3 => {
    const wob = 1 + 0.06 * Math.sin(a * 3 + id) * u;
    const t2 = th + (Math.cos(a) * r * u * wob) / Math.max(0.05, dTh);
    const p2 = Math.max(bandTop(s, t2), ph + (Math.sin(a) * r * u * wob) / dPh);
    return domeAt(s, t2, p2, lift + 0.035 * u * u * r).p;
  };
  const v: V3[] = [at(0, 0)];
  const angles: number[] = [];
  for (let q = 0; q <= K; q++) angles.push(notch + gap + (q / K) * (TAU - 2 * gap));
  for (const a of angles) v.push(at(a, 0.55));
  for (const a of angles) v.push(at(a, 1));
  const f: Face[] = [], want: V3[] = [];
  const nrm = domeAt(s, th, ph).n;
  for (let q = 0; q < K; q++) {
    f.push({ i: [0, 1 + q, 2 + q], m: 'leaf' });
    want.push(nrm);
    f.push({ i: [1 + q, 2 + K + q, 3 + K + q, 2 + q], m: 'leaf' });
    want.push(nrm);
  }
  // Its veins: from the middle out toward its edge, between the notch's two sides.
  const decals: Disc[] = [];
  const veins = lod ? 6 : 4;
  for (let q = 0; q < veins; q++) {
    const a = notch + gap + ((q + 0.5) / veins) * (TAU - 2 * gap);
    decals.push(...band([at(a, 0.1), at(a, 0.45), at(a, 0.78)], nrm, r * 0.014, 'moss', 0.006));
  }
  return merge(mesh(v, woundTo(v, f, want)), paint(decals));
}

/** A pad laid flat over a point of the ground under the shell (the top of the dome, or the water): `z` its height there, or the dome's. */
function padFlat(c: V3, r: number, notch: number, id: number, lod: number, height: (x: number, y: number) => number, nrm: V3 = [0, 0, 1]): Mesh {
  const gap = 0.2, K = lod ? 14 : 10;
  const at = (a: number, u: number): V3 => {
    const wob = 1 + 0.06 * Math.sin(a * 3 + id) * u;
    const x = c[0] + Math.cos(a) * r * u * wob, y = c[1] + Math.sin(a) * r * u * wob;
    return [x, y, height(x, y) + 0.03 * u * u * r];
  };
  const v: V3[] = [at(0, 0)];
  const angles: number[] = [];
  for (let q = 0; q <= K; q++) angles.push(notch + gap + (q / K) * (TAU - 2 * gap));
  for (const a of angles) v.push(at(a, 0.55));
  for (const a of angles) v.push(at(a, 1));
  const f: Face[] = [], want: V3[] = [];
  for (let q = 0; q < K; q++) {
    f.push({ i: [0, 1 + q, 2 + q], m: 'leaf' });
    want.push(nrm);
    f.push({ i: [1 + q, 2 + K + q, 3 + K + q, 2 + q], m: 'leaf' });
    want.push(nrm);
  }
  const decals: Disc[] = [];
  const veins = lod ? 6 : 4;
  for (let q = 0; q < veins; q++) {
    const a = notch + gap + ((q + 0.5) / veins) * (TAU - 2 * gap);
    decals.push(...band([at(a, 0.1), at(a, 0.45), at(a, 0.78)], nrm, r * 0.014, 'moss', 0.006));
  }
  return merge(mesh(v, woundTo(v, f, want)), paint(decals));
}

/**
 * A leaf: from its stalk at `root` out along `dir`, curving by `bend`, pointed at its tip, folded a little along its middle,
 * facing `nrm` (`back`, its other side's stuff, for one seen from both sides), a vein down its middle if `rib`.
 */
function leafOf(root: V3, dir: V3, nrm: V3, len: number, w: number, bend: V3, n: number, back?: Mat, front: Mat = 'leaf', rib = false): Mesh {
  const d = unit(dir), side = unit(cross(nrm, d)), N = unit(cross(d, side));
  const rows = Math.max(4, n);
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const mid: V3[] = [];
  for (let q = 0; q <= rows; q++) {
    const u = q / rows, c = add(add(root, scale(d, len * u)), scale(bend, u * u));
    const wd = w * Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.04)) ** 0.75 * (1 - 0.25 * u);
    v.push(add(c, scale(side, wd)), add(c, scale(N, w * 0.12 * Math.sin(Math.PI * u))), sub(c, scale(side, wd)));
    mid.push(add(c, scale(N, w * 0.12 * Math.sin(Math.PI * u) + 0.004)));
  }
  for (let q = 0; q < rows; q++) {
    const a = q * 3, b = (q + 1) * 3;
    f.push({ i: [a, b, b + 1, a + 1], m: front }, { i: [a + 1, b + 1, b + 2, a + 2], m: front });
    want.push(N, N);
  }
  if (back) {
    for (let q = 0; q < rows; q++) {
      const a = q * 3, b = (q + 1) * 3;
      f.push({ i: [a, b, b + 1, a + 1], m: back }, { i: [a + 1, b + 1, b + 2, a + 2], m: back });
      want.push(scale(N, -1), scale(N, -1));
    }
  }
  return merge(mesh(v, woundTo(v, f, want)), rib ? paint(band(mid.slice(0, -1), N, w * 0.07, 'leafDark', 0.004)) : null);
}

/** The leaves hanging down from under the band all round, over the cream and the tops of the legs; fewer behind, none over the neck. */
function hangingOf(s: Lily, lod: number): Mesh {
  const parts: Mesh[] = [];
  const n = lod ? 5 : 4;
  for (let q = 0; q < s.hang; q++) {
    const th = (q / s.hang) * TAU + 0.18 + (jitter(q + 90) - 0.5) * 0.25;
    // None over where the neck comes out.
    if (Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) < 0.42) continue;
    const root = domeAt(s, th, s.band.ph - 0.05 + s.band.amp * Math.sin(s.band.waves * th + 0.6), 0.03);
    const out: V3 = unit([root.n[0], root.n[1], 0]);
    const L = s.hangLen * (0.75 + 0.45 * jitter(q + 91));
    const dir = unit(add(scale(out, 0.3), [0, 0, -1]));
    parts.push(leafOf(root.p, dir, unit(add(out, [0, 0, 0.3])), L, L * 0.34, scale(out, L * 0.12), n, undefined, 'moss', true));
  }
  // Over the top of each leg, longer leaves, two on the Lotushell.
  if (s.legLeaves) {
    for (let i = 0; i < 4; i++) {
      const Lg = legOfI(s, i), hx = SIDE[i] * Lg.hip[0], hy = Lg.hip[1];
      for (let q = 0; q < (s.stage > 1 ? 2 : 1); q++) {
        const th = Math.atan2(hx / s.shell.w, hy / s.shell.l) + (q ? 0.22 : -0.08) * SIDE[i] * (i < 2 ? 1 : -1);
        const root = domeAt(s, th, s.band.ph - 0.05 + s.band.amp * Math.sin(s.band.waves * th + 0.6), 0.04);
        const out: V3 = unit([root.n[0], root.n[1], 0]);
        const L = s.hangLen * (1.5 - 0.25 * q);
        parts.push(leafOf(root.p, unit(add(scale(out, 0.35), [0, 0, -1])), unit(add(out, [0, 0, 0.3])), L, L * 0.36, scale(out, L * 0.14), n, undefined, 'moss', true));
      }
    }
  }
  return merge(...parts);
}

/**
 * A course of pads round the dome, the even ones or the odd ones (`odd`): two pieces, the odd ones a little higher and drawn
 * after, so where two meet one lies over the other.
 */
function courseOf(s: Lily, C: Course, ci: number, lod: number, odd: boolean): Mesh {
  const parts: Mesh[] = [];
  const off = ci % 2 ? TAU / C.n / 2 : 0.12;
  for (let j = 0; j < C.n; j++) {
    if ((j % 2 === 1) !== odd) continue;
    const id = ci * 37 + j * 11 + s.stage * 101;
    const th = off + (j / C.n) * TAU + (jitter(id) - 0.5) * 0.18;
    const ph = C.ph + (jitter(id + 1) - 0.5) * 0.08;
    // Under the pond, nothing.
    if (s.pond) {
      const p = domeAt(s, th, ph).p;
      if (Math.hypot(p[0], p[1] - s.pond.y) < s.pond.r * 0.7) continue;
    }
    parts.push(padOn(s, th, ph, C.r * (0.9 + 0.2 * jitter(id + 2)), C.lift + (j % 2 ? 0.012 : 0), id, lod));
  }
  return merge(...parts);
}

/* ---- flowers ---------------------------------------------------------------------------------- */

/** The frame of a flower: across it, across the other way, and up it. */
function frameUp(up: V3): [V3, V3, V3] {
  const z = unit(up);
  let x = cross([0, 1, 0], z);
  if (len3(x) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  return [x, cross(z, x), z];
}

/**
 * A petal: from its foot at `base`, out along `dir` and up, cupped, pointed: pale near its foot, pink up to its tip, deeper pink
 * outside (`bloom`). Seen from either side.
 */
function petalOf(base: V3, dir: V3, up: V3, len: number, w: number, cup: number, n: number): Mesh {
  const d = unit(dir), side = unit(cross(up, d)), N = unit(cross(d, side));
  const rows = n, cols = 2;
  const v: V3[] = [];
  for (let q = 0; q <= rows; q++) {
    const u = q / rows;
    const c = add(add(base, scale(d, len * u)), scale(N, len * 0.12 * u * u));
    const wd = w * Math.sin(Math.PI * Math.min(0.97, 0.1 + u * 0.88)) ** 0.55;
    for (let k = 0; k <= cols; k++) {
      const x = (k / cols) * 2 - 1;
      v.push(add(add(c, scale(side, wd * x)), scale(N, cup * wd * x * x)));
    }
  }
  const f: Face[] = [], want: V3[] = [];
  for (let q = 0; q < rows; q++) {
    for (let k = 0; k < cols; k++) {
      const a = q * (cols + 1) + k, b = (q + 1) * (cols + 1) + k;
      const pale = q < rows * 0.35;
      f.push({ i: [a, a + 1, b + 1, b], m: pale ? 'eyeWhite' : 'petal' });
      want.push(N);
      f.push({ i: [a, a + 1, b + 1, b], m: 'bloom' });
      want.push(scale(N, -1));
    }
  }
  return mesh(v, woundTo(v, f, want));
}

/** An open lotus on its stalk: three rings of petals opening out wider each ring further out, a yellow middle and its stamens. */
function lotusOf(c: V3, up: V3, R: number, lod: number, id: number): Mesh {
  const [X, Y, Z] = frameUp(up);
  const parts: Mesh[] = [];
  const rings = [
    { n: 8, el: 12, len: 1.0, w: 0.52, cup: 0.3 },
    { n: 5, el: 46, len: 0.78, w: 0.5, cup: 0.36 },
  ];
  const rows = lod ? 4 : 3;
  rings.forEach((g, gi) => {
    for (let q = 0; q < g.n; q++) {
      const a = ((q + (gi % 2 ? 0.5 : 0)) / g.n) * TAU + id * 0.7 + (jitter(id + q * 7 + gi) - 0.5) * 0.2;
      const radial = add(scale(X, Math.cos(a)), scale(Y, Math.sin(a)));
      const el = (g.el + (jitter(id + q + gi * 13) - 0.5) * 10) * DEG;
      const dir = add(scale(radial, Math.cos(el)), scale(Z, Math.sin(el)));
      const base = add(add(c, scale(radial, R * 0.1)), scale(Z, R * 0.04 * gi));
      parts.push(petalOf(base, dir, Z, R * g.len, R * g.w, g.cup, rows));
    }
  });
  // The middle: a yellow cup of a seed head, its top flat, a ring of stamens round it.
  const mid = add(c, scale(Z, R * 0.22));
  parts.push(orbAlong(mid, Z, [R * 0.27, R * 0.27, R * 0.14], lod ? 10 : 8, 4, 'cap'));
  for (let q = 0; q < 10; q++) {
    const a = (q / 10) * TAU + id;
    const p = add(add(mid, add(scale(X, Math.cos(a) * R * 0.25), scale(Y, Math.sin(a) * R * 0.25))), scale(Z, R * 0.05));
    parts.push(orbAlong(p, add(Z, scale(add(scale(X, Math.cos(a)), scale(Y, Math.sin(a))), 0.6)), [R * 0.035, R * 0.035, R * 0.09], 4, 3, 'flame'));
  }
  return merge(...parts);
}

/** A lotus bud, shut: a pink tear pointed at its top, its petals' edges drawn up it, deeper pink at its tip, green sepals at its foot. */
function budOf(c: V3, up: V3, R: number, lod: number): Mesh {
  const [X, Y, Z] = frameUp(up);
  const n = lod ? 10 : 8;
  const prof = [[0, 0.3], [0.2, 0.8], [0.5, 1.0], [0.85, 0.92], [1.2, 0.66], [1.55, 0.32], [1.8, 0.0]] as const;
  const pts = prof.map(([h]) => add(c, scale(Z, R * h)));
  const ws = prof.map(([, w]) => R * w);
  const body = tube(pts, ws, ws, n, (ring) => (ring >= 5 ? 'bloom' : 'petal'), { up: Y });
  const decals: Disc[] = [];
  // Where its petals overlap: lines curving up from its foot to its tip.
  for (let q = 0; q < 4; q++) {
    const a = (q / 4) * TAU + 0.4;
    const line: V3[] = [];
    let nm: V3 = [0, 0, 1];
    for (let k = 1; k < prof.length - 1; k++) {
      const [h, w] = prof[k];
      const tw = a + 0.35 * (h / 1.8);
      const out = add(scale(X, Math.cos(tw)), scale(Y, Math.sin(tw)));
      line.push(add(add(c, scale(Z, R * h)), scale(out, R * w * 1.01)));
      if (k === 2) nm = out;
    }
    decals.push(...band(line, nm, R * 0.04, 'bloom', 0.006));
  }
  const sepals: Mesh[] = [];
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + 0.9;
    const out = add(scale(X, Math.cos(a)), scale(Y, Math.sin(a)));
    sepals.push(leafOf(add(c, scale(out, R * 0.2)), add(scale(Z, 1), scale(out, 0.55)), out, R * 0.75, R * 0.32, scale(out, R * 0.12), 4, 'leafDark', 'moss'));
  }
  return merge(body, paint(decals), ...sepals);
}

/** A stalk: from `a` up, bending over to `b`. */
const stalkOf = (a: V3, b: V3, r: number): Mesh => {
  const midp = add(mixV(a, b, 0.5), [0, 0, len3(sub(b, a)) * 0.1]);
  return tube(curve(a, midp, b, 4), [r * 1.1, r, r * 0.95, r * 0.9, r * 0.85], [r * 1.1, r, r * 0.95, r * 0.9, r * 0.85], 5, 'stem', { seam: 'start' });
};

/** A curling stem: up from `a`, then wound over into a curl at its top, like a fern's, turned `side` (one or minus one). */
function curlOf(a: V3, tall: number, side: number, r: number): Mesh {
  const pts: V3[] = [];
  const up = tall * 0.62, curlR = tall * 0.17;
  for (let q = 0; q <= 4; q++) pts.push(add(a, [side * 0.04 * q * tall, 0, (up * q) / 4]));
  const top = pts[pts.length - 1];
  const c: V3 = add(top, [side * curlR, 0, 0]);
  for (let q = 1; q <= 10; q++) {
    const u = q / 10, th = u * TAU * 0.95, ang = side > 0 ? Math.PI - th : th, rr = curlR * (1 - 0.62 * u);
    pts.push(add(c, [Math.cos(ang) * rr, 0, Math.sin(ang) * rr]));
  }
  const ws = pts.map((_, k) => r * (1 - 0.55 * (k / pts.length)));
  return tube(pts, ws, ws, 5, 'stem', { up: [0, 1, 0] });
}

/** The flowers on its back, built where they stand on the shell, each on its stalk from a pad or from the water: each a piece. */
function floraOf(s: Lily, lod: number): Mesh[] {
  const parts: Mesh[] = [];
  const foot = (p: V3): V3 => {
    if (s.pond) return [p[0], p[1] + s.pond.y, s.pond.z + s.pond.h - s.pond.down];
    const d = domeOver(s, p[0], p[1], s.cap ? 0.06 : 0.04);
    return d.p;
  };
  s.flowers.forEach((F, q) => {
    const a = foot(F.at), up = unit(F.lean);
    const head = add(a, scale(up, F.tall));
    parts.push(merge(stalkOf(a, head, 0.022 + 0.008 * s.stage), F.open ? lotusOf(head, up, F.r, lod, q * 3 + 1) : budOf(head, up, F.r, lod)));
  });
  for (const C of s.curls) parts.push(curlOf(foot(C.at), C.tall, C.turn, 0.025));
  return parts;
}

/* ---- the pond --------------------------------------------------------------------------------- */

/**
 * A shape turned round an upright through `c`: its profile from the outside at the bottom up and over and down the inside, each
 * stretch in its own stuff. Each facet is wound to face out of the profile.
 */
function lathe(c: V3, prof: ReadonlyArray<readonly [number, number, Mat]>, n: number): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (const [r, z] of prof) for (let j = 0; j < n; j++) { const a = (j / n) * TAU; v.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + z]); }
  for (let q = 0; q < prof.length - 1; q++) {
    const [r0, z0] = prof[q], [r1, z1, m] = prof[q + 1];
    const nr = z1 - z0, nz = -(r1 - r0), l = Math.hypot(nr, nz) || 1;
    if (l < 1e-6) continue;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, a = ((j + 0.5) / n) * TAU;
      f.push({ i: [q * n + j, q * n + j2, (q + 1) * n + j2, (q + 1) * n + j], m });
      want.push([(Math.cos(a) * nr) / l, (Math.sin(a) * nr) / l, nz / l]);
    }
  }
  return mesh(v, woundTo(v, f, want));
}

/** The pond's bank: a low green ring set into the top of the shell, mossy, its inside dark down to the water. */
function pondOf(s: Lily, n: number): Mesh {
  const P = s.pond!, ro = P.r, ri = P.r - P.wall, c: V3 = [0, P.y, P.z], H = P.h, zw = H - P.down;
  return lathe(c, [[ro * 0.94, -0.06, 'moss'], [ro, H * 0.4, 'moss'], [ro * 0.99, H, 'moss'], [ri * 1.02, H, 'leaf'], [ri, H * 0.92, 'leafDark'], [ri * 0.99, zw - 0.02, 'leafDark']], n);
}

/**
 * The water, in its own frame at the middle of the pond: dark teal, lighter toward its near edge, white ripples curving across it
 * and round the stalks that stand in it, a few little pads floating on it.
 */
function waterOf(s: Lily, n: number, lod: number): { water: Mesh; floats: Mesh } {
  const P = s.pond!, ri = (P.r - P.wall) * 0.99;
  const v: V3[] = [];
  for (let j = 0; j < n; j++) { const a = (j / n) * TAU; v.push([Math.cos(a) * ri, Math.sin(a) * ri, 0]); }
  const water = mesh(v, woundTo(v, [{ i: Array.from({ length: n }, (_, j) => j), m: 'water' }], [[0, 0, 1]]));
  const up: V3 = [0, 0, 1], out: Disc[] = [];
  // Darker deeps and lighter shallows, painted in.
  out.push(disc([-ri * 0.15, -ri * 0.1, 0.004], up, ri * 0.55, ri * 0.45, 12, 'crystalDark', { spin: 0.4 }));
  out.push(disc([ri * 0.3, ri * 0.35, 0.005], up, ri * 0.35, ri * 0.22, 10, 'crystal', { spin: 1.1 }));
  // Ripples: arcs across it.
  const ripple = (cx: number, cy: number, r: number, a0: number, a1: number): void => {
    const pts: V3[] = [];
    for (let q = 0; q <= 8; q++) { const a = lerp(a0, a1, q / 8); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 0]); }
    out.push(...band(pts, up, ri * 0.018, 'lining', 0.01));
  };
  ripple(-ri * 0.2, ri * 0.1, ri * 0.55, -0.4, 0.9);
  ripple(-ri * 0.2, ri * 0.1, ri * 0.7, -0.2, 0.6);
  ripple(ri * 0.25, -ri * 0.3, ri * 0.35, 1.8, 3.2);
  ripple(ri * 0.1, ri * 0.45, ri * 0.28, 3.6, 5.0);
  ripple(-ri * 0.45, -ri * 0.35, ri * 0.22, 4.4, 5.9);
  // Rings round where the flowers' stalks go into it.
  for (const F of s.flowers) {
    const d = Math.hypot(F.at[0], F.at[1]);
    if (d > ri * 0.85) continue;
    for (const k of [1, 1.8]) {
      const pts: V3[] = [];
      for (let q = 0; q <= 12; q++) { const a = (q / 12) * TAU; pts.push([F.at[0] + Math.cos(a) * 0.04 * k, F.at[1] + Math.sin(a) * 0.035 * k, 0]); }
      out.push(...band(pts, up, ri * 0.012, 'lining', 0.011));
    }
  }
  // Little pads floating.
  const pads: Mesh[] = [];
  const floats: Array<[number, number, number]> = [[-ri * 0.45, ri * 0.4, 0.12], [ri * 0.5, -ri * 0.1, 0.1], [-ri * 0.05, -ri * 0.6, 0.11], [ri * 0.02, ri * 0.68, 0.09]];
  floats.forEach(([x, y, r], q) => pads.push(padFlat([x, y, 0], r, 0.8 + q * 2.1, 300 + q, lod, () => 0.012)));
  return { water: merge(water, paint(out)), floats: merge(...pads) };
}

/* ---- the head and neck ------------------------------------------------------------------------- */

/**
 * The head, in its own frame along `+y`: a round green skull mottled darker and yellow-green over its crown, a short blunt beak,
 * the cream of its face coming up over its cheeks; a big round dark eye either side, two glints in each, or shut and smiling;
 * nostrils; the inside of its mouth pink where it opens.
 */
function headOf(s: Lily, n: number, shut: boolean): Mesh {
  const r = s.head.r, N = n + 8;
  const tone = (m: Mesh, f: (p: V3) => Mat | null): Mesh => mesh(m.v, m.f.map((face) => {
    const c = face.i.reduce<V3>((t, i) => add(t, scale(m.v[i], 1 / face.i.length)), [0, 0, 0]);
    const k = f(c);
    return k ? { ...face, m: k } : face;
  }));
  const faceLine = (p: V3): boolean => p[2] < -r[2] * 0.04 + Math.max(0, p[1] / r[1]) * r[2] * 0.14 && p[1] > -r[1] * 0.55;
  // Under the front of its beak, inside the mouth: pink, seen when its jaw is open.
  const mouth = (p: V3): boolean => p[2] < -r[2] * 0.5 && p[1] > r[1] * 0.2;
  const shade = (p: V3): Mat | null => (!s.shut && mouth(p) ? 'inner' : faceLine(p) ? 'belly' : null);
  const skull = tone(orb([0, 0, 0], [r[0], r[1], r[2]], N, 12, 'mark'), shade);
  const snout = tone(orb([0, r[1] * 0.52, -r[2] * 0.1], [r[0] * 0.76, r[1] * 0.5, r[2] * 0.72], N, 9, 'mark'), shade);
  const decals: Disc[] = [];
  // Mottling over the crown and the back of the head: darker green and yellow-green.
  for (let q = 0; q < 12; q++) {
    const a = (jitter(q * 7 + 2) - 0.5) * 2.8, upz = 0.4 + 0.55 * jitter(q * 7 + 3), dir: V3 = [Math.sin(a) * (1 - upz * 0.6), -0.5 + 0.7 * jitter(q * 7 + 4), upz];
    const p = onEgg([0, 0, 0], r, dir);
    decals.push(disc(add(p.p, scale(p.n, 0.012)), p.n, r[0] * (0.1 + 0.07 * jitter(q + 1)), r[0] * (0.08 + 0.05 * jitter(q + 5)), 7, q % 3 ? 'spot' : 'coatLight', { spin: a }));
  }
  // The nostrils, on the top of the end of the beak.
  for (const sd of [1, -1]) {
    const p = onEgg([0, r[1] * 0.56, -r[2] * 0.1], [r[0] * 0.74, r[1] * 0.5, r[2] * 0.7], [sd * 0.28, 0.82, 0.45]);
    decals.push(disc(add(p.p, scale(p.n, 0.01)), p.n, r[0] * 0.045, r[0] * 0.035, 6, 'lid'));
  }
  // The line of the mouth along each side, curving up at its corner into a smile, where its mouth is shut.
  for (const sd of s.shut ? [1, -1] : []) {
    const pts: V3[] = [];
    for (let q = 0; q <= 6; q++) {
      const u = q / 6, dir: V3 = [sd * lerp(0.15, 0.9, u), lerp(0.97, 0.2, u), lerp(-0.6, -0.36, u) + 0.22 * u * u * u];
      const e = onEgg([0, r[1] * 0.28, -r[2] * 0.26], [r[0] * 0.98, r[1] * 0.9, r[2] * 0.7], dir);
      pts.push(add(e.p, scale(e.n, 0.008)));
    }
    decals.push(...band(pts, unit([sd * 0.8, 0.4, -0.2]), r[0] * 0.026, 'lid', 0.004));
  }
  // A blush under each eye.
  for (const sd of [1, -1]) {
    const e = onEgg([0, 0, 0], r, [sd * 0.85, 0.42, -0.05]);
    decals.push(disc(add(e.p, scale(e.n, 0.01)), e.n, r[0] * 0.16, r[0] * 0.09, 8, 'tongue', { up: [0, 0, 1] }));
  }
  return merge(skull, snout, eyesOn(s, shut), paint(decals));
}

/** Its eyes: big and round, dark, a big glint and a small one, high on the side of the head; or shut, arched in a smile. */
function eyesOn(s: Lily, shut: boolean): Mesh {
  const r = s.head.r, out: Disc[] = [];
  for (const sd of [1, -1]) {
    const e = onEgg([0, 0, 0], r, [sd * 0.66, 0.6, 0.42]), n = e.n, p = add(e.p, scale(n, 0.012)), sz = r[0] * (s.stage ? 0.2 : 0.23);
    const side = unit(cross([0, 0, 1], n)), upv = unit(cross(n, side));
    const o = { up: [0, 0, 1] as V3 };
    if (shut) {
      // Shut: an arch of a line, its ends down, a smile of an eye.
      const pts: V3[] = [];
      for (let q = 0; q <= 6; q++) {
        const x = (q / 6) * 2 - 1;
        pts.push(add(add(p, scale(side, x * sz * 1.05)), scale(upv, sz * 0.45 * (1 - x * x) - sz * 0.15)));
      }
      out.push(...band(pts, n, sz * 0.14, 'eye', 0.004));
      continue;
    }
    out.push(disc(p, n, sz * 1.0, sz * 1.08, 12, 'eye', o));
    out.push(disc(add(add(add(p, scale(n, 0.006)), scale(upv, sz * 0.38)), scale(side, sz * 0.28)), n, sz * 0.36, sz * 0.36, 8, 'glint', { ...o, lit: true }));
    out.push(disc(add(add(add(p, scale(n, 0.006)), scale(upv, -sz * 0.4)), scale(side, -sz * 0.3)), n, sz * 0.15, sz * 0.15, 6, 'glint', { ...o, lit: true }));
  }
  return paint(out);
}

const jawHinge = (s: Lily): V3 => { const r = s.head.r; return [0, -r[1] * 0.22, -r[2] * 0.42]; };
/** The lower jaw, from its hinge: cream under, pink inside, a tongue, its chin under the end of the beak. */
function jawOf(s: Lily, n: number): Mesh {
  const r = s.head.r, hg = jawHinge(s);
  const lower = orbAlong(sub([0, r[1] * 0.36, -r[2] * 0.5], hg), [0, 1, -0.1], [r[0] * 0.76, r[2] * 0.3, r[1] * 0.78], n + 8, 7, 'belly');
  const inside = mesh(lower.v, lower.f.map((f) => {
    const c = f.i.reduce<V3>((t, i) => add(t, scale(lower.v[i], 1 / f.i.length)), [0, 0, 0]);
    return c[2] > -r[2] * 0.5 - hg[2] + r[2] * 0.12 ? { ...f, m: 'inner' as Mat } : f;
  }));
  const tongue = orbAlong(sub([0, r[1] * 0.42, -r[2] * 0.38], hg), [0, 1, 0.1], [r[0] * 0.42, r[2] * 0.12, r[1] * 0.38], n, 4, 'tongue');
  return merge(inside, s.shut ? null : tongue);
}

/** The neck, along `+y` from under the shell to the head: green and mottled over its top, cream down its throat, in folds. */
function neckOf(s: Lily, n: number): Mesh {
  const H = s.head, w = H.thick, L = H.neck;
  // Bowed up a little in its middle; one tube, its underside cream from a line along it, so no sliver of throat shows apart.
  const bow = L * 0.05;
  const ys = [-0.14, L * 0.4, L * 0.75, L + 0.04], zs = [0, bow, bow * 0.8, 0];
  const ws = [w * 1.15, w * 1.0, w * 0.95, w * 0.92], hs = [w * 1.0, w * 0.92, w * 0.86, w * 0.84];
  const pts: V3[] = ys.map((y, q) => [0, y, zs[q]]);
  const along = (y: number): { z: number; w: number; h: number } => {
    let q = 0;
    while (q < ys.length - 2 && y > ys[q + 1]) q++;
    const k = clamp((y - ys[q]) / (ys[q + 1] - ys[q]));
    return { z: lerp(zs[q], zs[q + 1], k), w: lerp(ws[q], ws[q + 1], k), h: lerp(hs[q], hs[q + 1], k) };
  };
  const body = tube(pts, ws, hs, n + 2, 'mark', { seam: 'start' });
  const neck = mesh(body.v, body.f.map((f) => {
    const c = f.i.reduce<V3>((t, i) => add(t, scale(body.v[i], 1 / f.i.length)), [0, 0, 0]);
    const at = along(c[1]);
    return c[2] - at.z < -at.h * 0.3 ? { ...f, m: 'belly' as Mat } : f;
  }));
  // A point on its surface at `y`, `a` round from the top (radians), and the way out of it there.
  const on = (y: number, a: number, out = 0.006): { p: V3; n: V3 } => {
    const at = along(y), nrm = unit([Math.sin(a) / at.w, 0, Math.cos(a) / at.h]);
    return { p: add([Math.sin(a) * at.w, y, at.z + Math.cos(a) * at.h], scale(nrm, out)), n: nrm };
  };
  const decals: Disc[] = [];
  // Mottling over its top and sides, dark green and yellow-green.
  for (let q = 0; q < 14; q++) {
    const e = on(L * (0.05 + 0.85 * jitter(q * 3 + 1)), (jitter(q * 3 + 2) - 0.5) * 2.4);
    decals.push(disc(e.p, e.n, w * (0.17 + 0.08 * jitter(q + 9)), w * (0.13 + 0.06 * jitter(q + 19)), 8, q % 2 ? 'spot' : 'coatLight', { up: [0, 1, 0], spin: jitter(q + 29) }));
  }
  // Folds across its throat.
  for (let q = 0; q < 3; q++) {
    const y = L * (0.22 + 0.25 * q);
    const pts2 = [-0.5, -0.17, 0.17, 0.5].map((x) => on(y + 0.02 * (1 - x * x), Math.PI + x).p);
    decals.push(...band(pts2, on(y, Math.PI).n, w * 0.035, 'shellDark', 0.004));
  }
  return merge(neck, paint(decals));
}

/** The frill: leaves round the foot of the neck where it comes out of the shell, lying back over its shoulders, on the neck's bone. */
function frillOf(s: Lily, lod: number): Mesh {
  const H = s.head, w = H.thick, parts: Mesh[] = [], n = lod ? 5 : 4;
  // The ground's down and the shell's back, as the neck's frame has them, raised by its lift: the leaves lie back and droop.
  const lf = H.lift * DEG, down: V3 = [0, -Math.sin(lf), -Math.cos(lf)], back: V3 = [0, -Math.cos(lf), Math.sin(lf)];
  for (let q = 0; q < s.frill; q++) {
    // Round the top and sides of the neck, none under the throat.
    const a = lerp(-1.6, 1.6, s.frill > 1 ? q / (s.frill - 1) : 0.5) + (jitter(q + 40) - 0.5) * 0.2;
    const out: V3 = [Math.sin(a), 0, Math.cos(a)];
    const root: V3 = [out[0] * w * 0.9, H.neck * 0.22, out[2] * w * 0.78];
    const L = w * (1.0 + 0.45 * jitter(q + 41)) * (1 + 0.12 * s.stage);
    const dir = unit(add(add(scale(out, 0.45), scale(back, 0.45)), scale(down, 0.4 + 0.6 * Math.abs(out[0]))));
    parts.push(leafOf(root, dir, unit(add(scale(down, -0.85), scale(out, 0.35))), L, L * 0.38, scale(down, L * 0.15), n, undefined, 'moss'));
  }
  return merge(...parts);
}

/** The Lotushell's mane: long leaves down the back of its neck either side, from its head to the shell. */
function maneOf(s: Lily, lod: number): Mesh {
  const H = s.head, w = H.thick, L = H.neck, parts: Mesh[] = [], n = lod ? 5 : 4;
  for (let q = 0; q < s.mane; q++) {
    const u = 0.15 + 0.85 * (q / Math.max(1, s.mane - 1)), sd = q % 2 ? 1 : -1;
    const a = sd * (0.5 + 0.25 * jitter(q + 60));
    const out: V3 = [Math.sin(a), 0, Math.cos(a)];
    const root: V3 = [out[0] * w * 0.85, L * u, out[2] * w * 0.75];
    const len = w * (0.9 + 0.5 * jitter(q + 61));
    parts.push(leafOf(root, unit([sd * 0.7, -0.5, 0.2]), unit([sd * 0.6, 0, 0.8]), len, len * 0.36, [sd * len * 0.1, 0, -len * 0.35], n, undefined, 'moss'));
  }
  return merge(...parts);
}

/**
 * What it wears on its head: a lily leaf for a cap, lying over its crown with its notch to the front, two leaves drooping either
 * side behind its eyes; the Lotushell a pink lotus there instead, on leaves.
 */
function capOf(s: Lily, lod: number): Mesh {
  const r = s.head.r, parts: Mesh[] = [], n = lod ? 5 : 4;
  const crown = onEgg([0, 0, 0], r, [0, -0.25, 1]);
  if (s.shut) {
    for (const sd of [1, -1]) {
      parts.push(leafOf(add(crown.p, [sd * r[0] * 0.2, -r[1] * 0.1, 0]), unit([sd * 0.8, -0.5, 0.2]), unit([sd * 0.3, 0, 1]), r[0] * 1.0, r[0] * 0.42, [sd * 0.02, 0, -r[2] * 0.25], n));
    }
    parts.push(lotusOf(add(crown.p, [r[0] * 0.15, -r[1] * 0.05, r[2] * 0.05]), unit([0.12, 0.45, 1]), r[0] * 0.62, lod, 9));
    return merge(...parts);
  }
  // The cap: a pad over the crown, cupped over it.
  const R = r[0] * 0.78, c: V3 = [0, -r[1] * 0.22, 0];
  const height = (x: number, y: number): number => {
    const k = (x / r[0]) ** 2 + (y / r[1]) ** 2;
    return (k < 1 ? r[2] * Math.sqrt(1 - k) : -(Math.sqrt(k) - 1) * r[2] * 2.2) + 0.03;
  };
  parts.push(padFlat(c, R, Math.PI / 2, 77 + s.stage, lod, height));
  for (const sd of [1, -1]) {
    const root: V3 = [sd * r[0] * 0.6, -r[1] * 0.45, r[2] * 0.62];
    parts.push(leafOf(root, unit([sd * 0.5, -0.6, -0.55]), unit([sd * 1, -0.2, 0.3]), r[0] * 0.7, r[0] * 0.32, [0, -r[1] * 0.08, 0], n, undefined, 'moss'));
  }
  return merge(...parts);
}

/* ---- legs and feet ------------------------------------------------------------------------------ */

/** Mottling round a leg: darker green and yellow-green. */
function speckle(r: number, len: number, count: number, seed: number): Disc[] {
  const out: Disc[] = [];
  for (let q = 0; q < count; q++) {
    const z = -len * (0.15 + 0.7 * jitter(seed + q)), a = jitter(seed + q * 3) * TAU, nrm: V3 = [Math.cos(a), Math.sin(a), 0];
    out.push(disc(add([nrm[0] * r, nrm[1] * r, z], scale(nrm, 0.012)), nrm, r * (0.24 + 0.12 * jitter(seed + q * 5)), r * (0.3 + 0.14 * jitter(seed + q * 7)), 8, q % 2 ? 'spot' : 'coatLight', { up: [0, 0, 1], spin: jitter(seed + q) * TAU }));
  }
  return out;
}

/** A white star flower: five round petals and a yellow middle, painted on facing `n`. */
function star(c: V3, n: V3, r: number): Disc[] {
  const out: Disc[] = [];
  const e1 = unit(cross(n, Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), e2 = cross(n, e1);
  for (let q = 0; q < 5; q++) {
    const a = (q / 5) * TAU;
    const d = add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a)));
    out.push(disc(add(c, scale(d, r * 0.55)), n, r * 0.5, r * 0.3, 7, 'lining', { up: d, spin: Math.PI / 2 }));
  }
  out.push(disc(add(c, scale(n, 0.003)), n, r * 0.24, r * 0.24, 6, 'cap'));
  return out;
}

function upperOf(L: Leg, l0: number, n: number, k: number, i: number): Mesh {
  const w = L.w;
  const decals: Disc[] = speckle(w * 1.15, l0, 8, 11 + i);
  const parts: Mesh[] = [
    orb([0, 0, -l0 * 0.1], [w * 1.3, w * 1.25, w * 1.3], n, k, 'mark'),
    tube([[0, 0, 0], [0, 0, -l0 * 0.55], [0, 0, -l0]], [w * 1.25, w * 1.12, w * 1.04], [w * 1.25, w * 1.12, w * 1.04], n, 'mark', { seam: 'start' }),
    orb([0, 0, -l0], w * 1.04, n, k, 'mark'),
    paint(decals),
  ];
  return merge(...parts);
}
/** The lower leg: a pillar, thick, mottled, its front paler. */
function lowerOf(s: Lily, L: Leg, l1: number, n: number, i: number): Mesh {
  const w = L.w;
  const m = tube([[0, 0, w * 0.5], [0, 0, -l1 * 0.55], [0, 0, -l1]], [w * 1.04, w * 1.06, w * 1.1], [w * 1.04, w * 1.06, w * 1.1], n, 'mark', { seam: 'start' });
  const decals = speckle(w * 1.07, l1, 7, 23 + i * 5);
  // The Lotushell's white star flowers, on the outside of a fore leg and a hind one.
  if (s.stars && (i === 0 || i === 3)) {
    const nrm = unit([SIDE[i] * 0.9, i < 2 ? 0.4 : -0.4, 0]);
    decals.push(...star(add(scale(nrm, w * 1.08), [0, 0, -l1 * 0.2]), nrm, w * 0.42));
  }
  return merge(m, paint(decals));
}
/** A foot, from its heel at the origin along `+y`: a round stump of an elephant's foot, cream toenails round its front. */
function footOf(L: Leg, heel: number, n: number): Mesh {
  const F = L.foot, w = L.w, z0 = -heel, parts: Mesh[] = [];
  parts.push(tube([[0, -w * 0.05, w * 0.15], [0, F * 0.3, z0 * 0.45], [0, F * 0.5, z0 + w * 0.12]], [w * 1.1, w * 1.2, w * 1.24], [w * 1.08, w * 1.14, w * 1.18], Math.max(6, n - 2), 'mark', { seam: 'start' }));
  const T = L.toes, spread = T > 3 ? 1.9 : 1.6;
  for (let k = 0; k < T; k++) {
    const u = T > 1 ? k / (T - 1) : 0.5, a = lerp(-spread * 0.5, spread * 0.5, u);
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    const c: V3 = [d[0] * w * 1.0, F * 0.5 + d[1] * w * 1.0, z0 + w * 0.3];
    parts.push(orbAlong(c, d, [w * (T > 3 ? 0.27 : 0.33), w * (T > 3 ? 0.25 : 0.3), w * 0.15], 12, 6, 'claw'));
  }
  return merge(...parts);
}

const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- what it carries ---------------------------------------------------------------------------- */

/** The lily root in its beak as it goes to plant it: a brown knob of root, a curl of new leaf and a pink tip of bud out of it. */
function rootOf(s: Lily): Mesh {
  const r = s.head.r, c: V3 = [0, r[1] * 1.0, -r[2] * 0.42];
  return merge(
    orbAlong(c, [1, 0.1, 0], [r[0] * 0.38, r[0] * 0.17, r[0] * 0.17], 7, 4, 'bark'),
    orbAlong(add(c, [r[0] * 0.3, 0, 0]), [1, 0, 0], [r[0] * 0.16, r[0] * 0.12, r[0] * 0.12], 6, 3, 'bark'),
    leafOf(add(c, [-r[0] * 0.2, 0, r[0] * 0.08]), unit([-0.5, 0.2, 1]), unit([0, 1, 0.2]), r[0] * 0.5, r[0] * 0.26, [-0.02, 0, 0], 4, 'leafDark'),
    orbAlong(add(c, [r[0] * 0.15, 0.01, r[0] * 0.18]), [0.3, 0, 1], [r[0] * 0.07, r[0] * 0.07, r[0] * 0.13], 6, 3, 'petal'),
  );
}

/* ---- a stage's pieces --------------------------------------------------------------------------- */

const restBoneCache = new Map<Lily, Bones>();
function restBones(s: Lily): Bones {
  let b = restBoneCache.get(s);
  if (!b) restBoneCache.set(s, (b = lilyBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 })));
  return b;
}

function lilyBuild(s: Lily, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), R = restOf(s);
  restBones(s);
  const pieces: Piece[] = [];
  const ring = cut(lod, 18, 26);
  pieces.push({ key: 'shell', mesh: merge(domeOf(s, cut(lod, 16, 22), cut(lod, 4, 6)), bandOf(s, 6)), bone: 'trunk', bias: 0.05 });
  pieces.push({ key: 'hang', mesh: hangingOf(s, lod), bone: 'trunk', bias: 0.052, after: ['shell'] });
  const below: string[] = ['shell', 'hang'];
  s.courses.forEach((C, ci) => {
    for (const odd of [false, true]) {
      const key = `pads${ci}${odd ? 'b' : 'a'}`;
      pieces.push({ key, mesh: courseOf(s, C, ci, lod, odd), bone: 'trunk', bias: 0.054 + 0.002 * ci, after: [...below] });
      below.push(key);
    }
  });
  if (s.cap) {
    const c: V3 = [0, -0.04 * s.shell.l, 0];
    pieces.push({ key: 'cap', mesh: padFlat(c, s.cap, Math.PI / 2 + 0.3, 900 + s.stage, lod, (x, y) => domeOver(s, x, y).p[2] + s.courses[s.courses.length - 1].lift + 0.025), bone: 'trunk', bias: 0.06, after: [...below] });
    below.push('cap');
  }
  if (s.pond) {
    const P = s.pond, wz = bloomAt(s);
    const Wt = waterOf(s, ring, lod);
    pieces.push({ key: 'water', mesh: shifted3(Wt.water, wz), bone: 'trunk', bias: 0.058, after: [...below] });
    pieces.push({ key: 'floats', mesh: shifted3(Wt.floats, wz), bone: 'trunk', bias: 0.059, after: [...below, 'water'] });
    pieces.push({ key: 'pond', mesh: pondOf(s, ring), bone: 'trunk', bias: 0.06, after: [...below, 'water', 'floats'] });
    // Great pads round the bank, lying out over its rim, partly over the water.
    const bank: Mesh[] = [];
    const nB = 9;
    for (let q = 0; q < nB; q++) {
      const a = (q / nB) * TAU + 0.3 + (jitter(q + 500) - 0.5) * 0.3;
      const rr = P.r * (1.0 + 0.08 * jitter(q + 501)), r = 0.17 + 0.07 * jitter(q + 502);
      const cx = Math.cos(a) * rr, cy = P.y + Math.sin(a) * rr;
      bank.push(padFlat([cx, cy, 0], r, a + Math.PI + (jitter(q + 503) - 0.5), 600 + q, lod, (x, y) => {
        const d = Math.hypot(x, y - P.y);
        return d < P.r ? P.z + P.h + 0.02 - 0.03 * (1 - d / P.r) : Math.max(domeOver(s, x, y).p[2] + 0.07, P.z + P.h + 0.02 - (d - P.r) * 0.5);
      }));
    }
    pieces.push({ key: 'bank', mesh: merge(...bank), bone: 'trunk', bias: 0.062, after: [...below, 'pond', 'water', 'floats'] });
    below.push('water', 'floats', 'pond', 'bank');
  }
  floraOf(s, lod).forEach((m, q) => pieces.push({ key: `flora${q}`, mesh: shifted3(m, scale(bloomAt(s), -1)), bone: 'bloom', bias: 0.07, after: [...below], lines: false }));
  // The belly under the shell: cream, between the legs.
  const Sh = s.shell;
  pieces.push({ key: 'belly', mesh: orb([0, 0, SHELL_FOOT * Sh.h * 0.6], [Sh.w * 0.84, Sh.l * 0.86, 0.14], n + 4, k, 'belly'), bone: 'trunk', bias: 0, under: ['shell'] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0.02, under: ['head', 'shell'], after: ['belly'], front: [0, 1, 0] });
  if (s.frill) pieces.push({ key: 'frill', mesh: frillOf(s, lod), bone: 'frill', bias: 0.03, after: ['neck', 'shell', 'hang', 'pads0a', 'pads0b'], under: ['head'], front: [0, 1, 0] });
  if (s.mane) pieces.push({ key: 'mane', mesh: maneOf(s, lod), bone: 'frill', bias: 0.035, after: ['neck', 'frill'], under: ['head'] });
  const over = ['neck', ...below, 'frill'];
  pieces.push({ key: 'head', mesh: headOf(s, n, s.shut), shut: headOf(s, n, true), bone: 'head', bias: 0.1, after: over, front: [0, 1, 0] });
  pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.09, after: over, under: ['head'], front: [0, 1, 0] });
  pieces.push({ key: 'headgear', mesh: capOf(s, lod), bone: 'head', bias: 0.11, after: ['head', 'jaw'], lines: !s.shut });
  pieces.push({ key: 'root', mesh: rootOf(s), bone: 'head', bias: 0.12, after: ['head', 'jaw'], front: [0, 1, 0], shown: (a) => a.act?.kind === 'work' && a.act.t < LILY_WORK.plant });
  pieces.push({ key: 'tail', mesh: tube(curve([0, 0.05, 0], [0, -s.tail * 0.5, -0.02], [0, -s.tail, -0.08], 3), [0.08, 0.06, 0.04, 0.01].map((x) => x * (1 + s.stage * 0.4)), [0.07, 0.05, 0.035, 0.01].map((x) => x * (1 + s.stage * 0.4)), 6, 'mark', { seam: 'start' }), bone: 'tail', bias: -0.02, under: ['shell'] });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], Lg = legOfI(s, i), [l0, l1] = R.legs[i];
    const foot = side > 0 ? footOf(Lg, R.heel[i], n) : mirroredMesh(footOf(Lg, R.heel[i], n));
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    pieces.push(
      { key: `${key}0`, mesh: upperOf(Lg, l0, n, k, i), bone: `${key}0`, bias: 0.01, under: ['shell'], after: ['belly'], front },
      { key: `${key}1`, mesh: lowerOf(s, Lg, l1, n, i), bone: `${key}1`, bias: 0.02, under: ['shell'], after: ['belly'], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.03, under: ['shell'], after: ['belly'], front },
    );
  }
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const DUST: RGB = [196, 180, 152];
const WATER: RGB = [120, 196, 196];
const FOAM: RGB = [246, 252, 250];
const PAD: RGB = [150, 190, 84];
const PAD_INK: RGB = [62, 92, 40];
const PETAL: RGB = [248, 186, 204];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };

function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
  const c = mix(DUST, [252, 246, 236], 0.2 + 0.35 * age);
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

/** A ring of a ripple on the water, flat on the ground round `at`, `r` across, fading. */
function rippleRing(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  if (al <= 0.02 || r <= 0) return;
  const px = pxOf(g);
  const pts: Array<[number, number]> = [];
  for (let q = 0; q <= 24; q++) { const a = (q / 24) * TAU; pts.push(onScreen(view, [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, at[2]])); }
  g.beginPath();
  pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = css(WATER, al * 0.8);
  g.lineWidth = Math.max(1.6 * px, r * 0.12);
  g.stroke();
  g.strokeStyle = css(FOAM, al);
  g.lineWidth = Math.max(0.8 * px, r * 0.05);
  g.stroke();
}

/** A little lily pad on the water, opening: a green round with its notch, inked, its veins. */
function littlePad(g: CanvasRenderingContext2D, view: View, at: V3, r: number, open: number, al: number): void {
  if (al <= 0.02 || r * open <= 0.005) return;
  const px = pxOf(g), rr = r * open, notch = 0.9, gap = 0.22;
  const pts: Array<[number, number]> = [onScreen(view, at)];
  for (let q = 0; q <= 16; q++) {
    const a = notch + gap + (q / 16) * (TAU - 2 * gap);
    pts.push(onScreen(view, [at[0] + Math.cos(a) * rr, at[1] + Math.sin(a) * rr, at[2]]));
  }
  g.beginPath();
  pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = css(PAD, al);
  g.fill();
  g.strokeStyle = css(PAD_INK, al);
  g.lineWidth = Math.max(0.8 * px, rr * 0.08);
  g.stroke();
  const [cx, cy] = pts[0];
  g.lineWidth = Math.max(0.5 * px, rr * 0.04);
  for (let q = 0; q < 5; q++) {
    const a = notch + gap + ((q + 0.5) / 5) * (TAU - 2 * gap);
    const [x, y] = onScreen(view, [at[0] + Math.cos(a) * rr * 0.8, at[1] + Math.sin(a) * rr * 0.8, at[2]]);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(x, y);
    g.stroke();
  }
}

/** Where its beak meets the water at the bottom of a planting: the tip of its beak, at the bottom of the dip, on the ground. */
function plantedAt(s: Lily, b: Bones): V3 {
  const r = s.head.r, tip = place(b.head, [0, r[1] * 1.0, -r[2] * 0.4]);
  return [tip[0], tip[1], 0.02];
}

/** A go at its task: as the root goes in, rings spread out on the water from where it went, a splash, and a little pad opens there. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Lily, b: Bones, t: number, front: boolean): void {
  const W = LILY_WORK, T = ACT_SECS.work, since = (t - W.plant) * T;
  if (!front) return;
  const at = plantedAt(s, b);
  const big = 0.7 + 0.3 * s.stage;
  if (since > -0.05) {
    for (let k = 0; k < 3; k++) {
      const u = (since - k * 0.12) / 0.55;
      if (u > 0 && u < 1) rippleRing(g, view, at, (0.08 + 0.38 * u) * big, (1 - u) * 0.9);
    }
    littlePad(g, view, [at[0], at[1], at[2] + 0.005], 0.14 * big, smooth(clamp((since - 0.08) / 0.3)), 1 - smooth(clamp((since - 0.5) / 0.1)));
    // A splash of drops.
    if (since < 0.35) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + 0.4, v = 0.8 + 0.4 * jitter(k + 3);
        const p: V3 = [at[0] + Math.cos(a) * v * since, at[1] + Math.sin(a) * v * since, Math.max(0.02, 0.02 + 1.6 * since - 6 * since * since)];
        const [x, y] = onScreen(view, p);
        g.beginPath();
        g.arc(x, y, Math.max(1.2 * pxOf(g), 0.035 * big), 0, TAU);
        g.fillStyle = css(FOAM, 1 - since / 0.35);
        g.fill();
      }
    }
  }
}

/** What a strike throws: a puff of dust where its fore feet come down. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Lily, b: Bones, t: number, front: boolean): void {
  const big = 0.6 + 0.4 * (s.stage + 1), mid = b.body.t, since = (t - LILY_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  for (const leg of ['fl2', 'fr2']) {
    const f = place(b[leg], [0, 0, 0]);
    if (nearSide(f, mid, view) === front) puff(g, view, [f[0], f[1], 0.05], 0.2 * big, since / 0.45, leg === 'fl2' ? 3 : 4);
  }
}

/** Evolving: pink petals, leaves and drops of water spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Lily, b: Bones, t: number, front: boolean): void {
  const big = 0.6 + 0.4 * (s.stage + 1), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], S = s.shell;
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = S.w * 1.6 + 0.3 * big, ry = S.l * 1.5 + 0.3 * big, high = S.h * 2.4 + 0.5 * big;
  const px = pxOf(g);
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 18) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const kind = q % 3, r = 0.08 * big * (1 - 0.3 * u);
    if (kind === 2) {
      g.beginPath();
      g.arc(x, y, Math.max(1.2 * px, r * 0.45), 0, TAU);
      g.fillStyle = css(WATER, swirl);
      g.fill();
      g.strokeStyle = css(FOAM, swirl);
      g.lineWidth = Math.max(0.6 * px, r * 0.1);
      g.stroke();
      continue;
    }
    const c = kind ? PETAL : PAD;
    g.fillStyle = css(c, swirl);
    g.strokeStyle = css(mix(c, [60, 40, 50], 0.6), swirl);
    g.lineWidth = Math.max(px * 0.8, r * 0.16);
    g.beginPath();
    g.ellipse(x, y, r, r * 0.5, ang * 2, 0, TAU);
    g.fill();
    g.stroke();
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function lilyKind(s: Lily): Kind {
  const bones = lilyBones(s);
  return {
    bones,
    build: (lod) => lilyBuild(s, lod),
    // The variant's coat tints its green skin and its markings the cream of its face, throat and belly; the pads, the flowers,
    // the water, the band and its toenails are the same on every variant.
    palette: (coat, mark) => {
      const skin = mix([104, 150, 80], coat, 0.35), cream = mix([238, 218, 156], mark, 0.3);
      return coatPalette(coat, mark, {
        coat: skin,
        coatDark: mix(skin, [56, 84, 44], 0.4),
        coatLight: mix(skin, [214, 222, 96], 0.72),
        mark: skin,
        spot: mix(skin, [36, 78, 50], 0.62),
        belly: cream,
        muzzle: mix(cream, [255, 250, 230], 0.3),
        nose: [70, 80, 50],
        lid: [52, 64, 40],
        eye: [34, 32, 30],
        glint: [255, 254, 248],
        inner: [214, 104, 118],
        tongue: [244, 152, 156],
        shell: [224, 196, 140],
        shellDark: [176, 148, 98],
        claw: [236, 218, 172],
        pad: [232, 214, 176],
        leaf: [158, 194, 80],
        leafDark: [84, 124, 50],
        moss: [118, 162, 64],
        stem: [112, 156, 70],
        petal: [252, 178, 202],
        bloom: [244, 164, 192],
        eyeWhite: [255, 236, 240],
        cap: [252, 214, 92],
        flame: [244, 168, 62],
        water: [52, 116, 120],
        crystal: [96, 168, 166],
        crystalDark: [30, 76, 88],
        lining: [252, 252, 244],
        bark: [150, 104, 70],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.shell.l * 1.15 + 0.1, s.shell.w * 1.1],
    stride: 1.2,
    size: s.size,
    blinks: s.shut ? 0 : 5,
    acts: ['strike', 'work'],
    leaps: [false, false],
    motes: [[248, 190, 206], [160, 198, 92]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBits(g, view, s, b, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const PADBLOOM = lilyKind(PADBLOOM_LOOK);
export const LILYBACK = lilyKind(LILYBACK_LOOK);
export const LOTUSHELL = lilyKind(LOTUSHELL_LOOK);
