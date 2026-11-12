import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { css, cut, hump, jitter, mixV, nearSide, ramp } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The mortar line: the Mortarshell, a small tortoise, olive with darker
 * spots, its face, throat and feet cream, a calm half-lidded amber eye,
 * carrying a shell of pale sandstone blocks with moss between them and, set
 * into the top of it, a shallow round stone basin full of swirled mortar;
 * which grows into the Groutback, bigger, its shell's rim jagged with slabs,
 * its basin a taller ring carved with a key-fret band and a wooden paddle
 * standing in the mortar, a brown plastron under it; and then the Mortoise,
 * very large, huge carved plates on its shell, thick moss, a great carved
 * basin and paddle on top, a long neck with its head held up, pillar legs.
 * The species is still `glossa` underneath, as saves and the database know
 * it: the hand that mixes mortar in the settlement stores.
 *
 * All three are built by one set of functions from a description of the
 * stage (`Tort`). The shell is a dome under courses of stone blocks, each a
 * slab with bevelled sides standing up off the dome; the basin is turned
 * round its middle (`lathe`), an outer wall, a rim and an inner wall down to
 * the mortar, which is its own piece on its own bone, so its swirl can turn.
 * Every foot is given a point on the ground and its leg bent to reach it,
 * as the chest line's are (`./wild-chest`). It plods, the diagonals
 * together, slowly, its head nodding.
 *
 * At its task it stirs: the paddle in its basin goes round, the mortar
 * swirling with it, a little slopping over the rim; the Mortarshell, with no
 * paddle, rocks its shell round in a circle to swirl it.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Leg {
  hip: V3;
  len: [number, number];
  at: [number, number];
  /** Heel to the ball of the foot; each claw's length; how many claws. */
  foot: number; claw: number; claws: number;
  w: number;
  turn: number;
}

/** A course of blocks round the shell: from and to (elevation, radians), how many, how thick, and whether they are jagged slabs. */
interface Course { from: number; to: number; n: number; thick: number; jag?: number; emblem?: boolean }

interface Tort {
  stage: 0 | 1 | 2;
  /** The dome: half its width and length, its height, from its rim. */
  shell: { w: number; l: number; h: number };
  courses: readonly Course[];
  /** How far the rim flares out below the dome's foot. */
  flare: number;
  /** The basin: its outer radius, its wall's thickness, where its foot is (along, up), its height, how far down the mortar is, how many blocks round, and a key-fret band. */
  basin: { r: number; wall: number; y: number; z: number; h: number; down: number; blocks: number; fret: boolean };
  /** The paddle standing in it: how long above the mortar, how thick, its square head's size and length, how far it leans (degrees), how far off the middle its foot is. */
  paddle: { len: number; w: number; head: number; headLen: number; lean: number; off: number } | null;
  /** The head: where its neck comes out under the front of the shell, its half-sizes, the neck's length and how far it is raised (degrees). */
  head: { at: V3; r: V3; neck: number; lift: number; thick: number };
  high: number;
  fore: Leg;
  hind: Leg;
  /** Tufts of moss: how many, how big. */
  moss: number;
  mossSize: number;
  tail: number;
  gait: { duty: number; swing: [number, number]; step: number; bob: number; roll: number };
  size: number;
}

/** A Mortarshell: small, a dome of sandstone blocks with moss between, a shallow basin of swirled mortar on top, its head up. */
const MORTARSHELL_LOOK: Tort = {
  stage: 0,
  shell: { w: 0.92, l: 1.0, h: 0.42 },
  courses: [
    { from: -0.1, to: 0.5, n: 12, thick: 0.12 },
    { from: 0.54, to: 0.98, n: 9, thick: 0.1 },
    { from: 1.02, to: 1.3, n: 6, thick: 0.06 },
  ],
  flare: 0.1,
  basin: { r: 0.62, wall: 0.12, y: -0.04, z: 0.31, h: 0.16, down: 0.05, blocks: 9, fret: false },
  paddle: null,
  head: { at: [0, 0.8, 0.06], r: [0.32, 0.45, 0.3], neck: 0.5, lift: 50, thick: 0.29 },
  high: 0.36,
  fore: { hip: [0.52, 0.48, 0], len: [0.18, 0.18], at: [0.72, 0.66], foot: 0.06, claw: 0.11, claws: 3, w: 0.24, turn: 22 },
  hind: { hip: [0.5, -0.5, 0], len: [0.18, 0.18], at: [0.7, -0.6], foot: 0.06, claw: 0.1, claws: 3, w: 0.25, turn: 26 },
  moss: 14,
  mossSize: 0.1,
  tail: 0.16,
  gait: { duty: 0.7, swing: [0.16, 0.22], step: 0.22, bob: 0.02, roll: 4 },
  size: 3.7,
};

/** A Groutback: bigger, a rim of jagged slabs, a tall basin ring carved with a key-fret band and a paddle standing in it. */
const GROUTBACK_LOOK: Tort = {
  stage: 1,
  shell: { w: 1.0, l: 1.1, h: 0.46 },
  courses: [
    { from: -0.12, to: 0.42, n: 10, thick: 0.14, jag: 0.18 },
    { from: 0.46, to: 0.9, n: 11, thick: 0.1 },
    { from: 0.94, to: 1.3, n: 6, thick: 0.07 },
  ],
  flare: 0.14,
  basin: { r: 0.7, wall: 0.13, y: -0.04, z: 0.34, h: 0.26, down: 0.05, blocks: 10, fret: true },
  paddle: { len: 0.5, w: 0.07, head: 0.13, headLen: 0.15, lean: 18, off: 0.14 },
  head: { at: [0, 0.9, 0.06], r: [0.34, 0.47, 0.31], neck: 0.54, lift: 52, thick: 0.32 },
  high: 0.4,
  fore: { hip: [0.56, 0.55, 0], len: [0.2, 0.2], at: [0.8, 0.72], foot: 0.07, claw: 0.13, claws: 4, w: 0.29, turn: 20 },
  hind: { hip: [0.54, -0.55, 0], len: [0.2, 0.2], at: [0.78, -0.66], foot: 0.07, claw: 0.12, claws: 3, w: 0.3, turn: 24 },
  moss: 18,
  mossSize: 0.13,
  tail: 0.2,
  gait: { duty: 0.72, swing: [0.15, 0.2], step: 0.2, bob: 0.02, roll: 3.5 },
  size: 4.2,
};

/** A Mortoise: very large, huge carved plates, thick moss, a great carved basin and paddle, a long neck with its head up, pillar legs. */
const MORTOISE_LOOK: Tort = {
  stage: 2,
  shell: { w: 1.06, l: 1.2, h: 0.5 },
  courses: [
    { from: -0.16, to: 0.14, n: 12, thick: 0.13, jag: 0.14 },
    { from: 0.18, to: 0.78, n: 6, thick: 0.18, emblem: true },
    { from: 0.82, to: 1.3, n: 6, thick: 0.08 },
  ],
  flare: 0.16,
  basin: { r: 0.76, wall: 0.14, y: -0.1, z: 0.38, h: 0.36, down: 0.05, blocks: 12, fret: true },
  paddle: { len: 0.62, w: 0.085, head: 0.16, headLen: 0.18, lean: 15, off: 0.16 },
  head: { at: [0, 1.0, 0.06], r: [0.35, 0.5, 0.32], neck: 0.92, lift: 60, thick: 0.46 },
  high: 0.44,
  fore: { hip: [0.6, 0.6, 0], len: [0.22, 0.22], at: [0.86, 0.8], foot: 0.08, claw: 0.15, claws: 4, w: 0.36, turn: 18 },
  hind: { hip: [0.58, -0.62, 0], len: [0.22, 0.22], at: [0.84, -0.74], foot: 0.08, claw: 0.14, claws: 4, w: 0.37, turn: 22 },
  moss: 22,
  mossSize: 0.15,
  tail: 0.24,
  gait: { duty: 0.74, swing: [0.14, 0.18], step: 0.18, bob: 0.018, roll: 3 },
  size: 5.6,
};

/* ---- helpers ------------------------------------------------------------------------- */

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

/** A band a line wide along a line of points on a surface facing `n`: a groove, a carved line. */
function band(pts: readonly V3[], n: V3, w: number, m: Mat, lift = 0.012): Disc[] {
  const out: Disc[] = [];
  for (let q = 0; q < pts.length - 1; q++) {
    const a = pts[q], b = pts[q + 1], d = unit(sub(b, a)), side = scale(unit(cross(n, d)), w), up = scale(n, lift);
    // Each piece a little longer than its stretch, so the corners of a line that turns are filled.
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
export const MORTOISE_HITS: readonly number[] = [0.52, 0.54, 0.56];
/**
 * A go at its task, as shares of it: the paddle (or the Mortarshell's shell) goes once round, starting from where it stands;
 * mortar slops over the rim at each of `slops`, and it gives a slow nod at `nod`. It loops, so a go and the next are one.
 */
export const MORTOISE_WORK = { slops: [0.32, 0.82] as const, nod: 0.55 } as const;
/** When it draws its head in a little and puts it out again, standing about, in seconds into its loop, and for how long. */
export const MORTOISE_TUCKS: readonly number[] = [7.4, 19.2];
export const MORTOISE_TUCK_LEN = 2.2;

/* ---- where its feet go ---------------------------------------------------------------- */

interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The head: pitched up, turned left, tilted (degrees); its neck pushed out or drawn in; its jaw open (degrees). */
  head: [number, number, number]; neck: number; jaw: number;
  /** How far round the paddle and the mortar's swirl have gone (radians). */
  stir: number;
}

interface Rest {
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
  heel: number[];
}

const rests = new Map<Tort, Rest>();
const legOfI = (s: Tort, i: number): Leg => (i < 2 ? s.fore : s.hind);
function restOf(s: Tort): Rest {
  const had = rests.get(s);
  if (had) return had;
  const hip: V3[] = [], ankle: V3[] = [], reach: number[] = [], legs: Array<[number, number]> = [], heel: number[] = [];
  for (let i = 0; i < 4; i++) {
    const L = legOfI(s, i);
    hip.push([SIDE[i] * L.hip[0], L.hip[1], L.hip[2]]);
    ankle.push([SIDE[i] * L.at[0], L.at[1], 0]);
    reach.push(L.len[0] + L.len[1]);
    legs.push(L.len);
    heel.push(L.w * 0.55);
  }
  const R = { hip, ankle, legs, reach, heel };
  rests.set(s, R);
  return R;
}

function restPlan(s: Tort, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    head: [0, 0, 0], neck: 0, jaw: 0, stir: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])], neck: m(a.neck, b.neck), jaw: m(a.jaw, b.jaw),
    stir: b.stir,
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
    neck: d(p.neck, to.neck, from.neck), jaw: p.jaw, stir: p.stir,
  };
}

const lenOf = (s: Tort): number => s.fore.hip[1] - s.hind.hip[1];

/** The diagonals together, the left fore with the right hind. */
const TROT = [0, 0.5, 0.5, 0];
const EDGE = 0.12;

/**
 * Going: a slow plod, the diagonals together, each foot down for most of a stride and swept back under the shell, then lifted
 * and brought forward. The shell sways from side to side over the feet that are down and settles at each footfall; the head
 * nods with each step.
 */
function goPlan(s: Tort, R: Rest, a: Anim, fast: number): Plan {
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
  return p;
}

/** How far its head is drawn in, standing about, nought to one. */
function tuckOf(t: number): number {
  let k = 0;
  for (const c of MORTOISE_TUCKS) {
    const u = (t - c) / MORTOISE_TUCK_LEN;
    if (u > 0 && u < 1) k = Math.max(k, ramp(u, 0, 0.25) * (1 - ramp(u, 0.6, 1)));
  }
  return k;
}

/**
 * Standing about: breathing slowly, its head turning to look about and tilting; twice a loop it draws its head in a little and
 * puts it out again; now and then it shifts its weight from foot to foot.
 */
function stillPlan(s: Tort, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, L = lenOf(s);
  p.yaw = 2 * drift(t);
  p.roll = 1 * cyc(t, 3);
  p.H += 0.008 * L * (a.breath - 0.5);
  p.head = [4 * cyc(t, 2) + 2 * a.breath, 24 * drift(t, 1.3), 5 * drift(t, 2)];
  p.neck = 0.03 * L * a.breath;
  const tuck = tuckOf(t);
  p.neck -= s.head.neck * 0.45 * tuck;
  p.head[0] -= 12 * tuck;
  const shift = beat(t, [12.4], 1.2);
  if (shift > 0) {
    const A = R.ankle[0];
    p.at[0] = [A[0], A[1] + 0.03 * L * shift, R.reach[0] * 0.22 * Math.sin(Math.PI * clamp((t - 12.4) / 1.2))];
    p.roll += 2 * shift;
  }
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** Its bite: its head drawn back toward its shell, then shot out with its beak open and snapped shut, its weight lurching after it. */
function bitePlan(s: Tort, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = MORTOISE_HITS[s.stage], L = lenOf(s);
  const back = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, 0.46));
  const out = ramp(t, 0.38, hit) * (1 - ramp(t, 0.7, 0.98));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.05 * back + 0.08 * out);
  p.H += L * (-0.03 * back + 0.02 * out);
  p.pitch = 3 * back - 4 * out;
  p.neck = s.head.neck * (-0.4 * back + 0.35 * out);
  p.head = [14 * back - 26 * out + 8 * jolt, 0, 0];
  p.jaw = 30 * ramp(t, 0.36, hit - 0.06) * (1 - ramp(t, hit - 0.04, hit));
  p.squash = 0.05 * jolt;
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0] * 1.04, A[1] + L * 0.1, 0];
    p.at[i] = t < 0.66 ? arc(A, fwd, ramp(t, 0.4 + 0.06 * i, hit + 0.06 * i), R.reach[i] * 0.35) : arc(fwd, A, ramp(t, 0.72 + 0.08 * i, 0.96), R.reach[i] * 0.25);
  }
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));
/** How far round the stir has gone at `t` of a go: once round a go, easing a little at each slop as it drags. */
const stirOf = (t: number): number => TAU * (t - 0.03 * Math.sin(TAU * 2 * t));

/**
 * A go at its task: its feet planted, it leans into the stir, its shell swaying round with the paddle as it goes once round the
 * basin, and nods slowly at the middle of it. The Mortarshell, with no paddle, rocks its whole shell round in a circle and the
 * mortar swirls round in it.
 */
function workPlan(s: Tort, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s), a = stirOf(t);
  const k = s.paddle ? 1 : 2.2;
  p.roll = 2.4 * k * Math.sin(a);
  p.pitch = -1.6 * k * Math.cos(a) - 1.5;
  p.side = L * 0.012 * k * Math.sin(a);
  p.surge = L * 0.01 * k * Math.cos(a);
  p.H -= L * 0.015;
  const nod = hump(t, MORTOISE_WORK.nod, 0.2);
  p.head = [-10 - 10 * nod, 10 * Math.sin(a + 0.6), 4 * Math.sin(a)];
  p.neck = -s.head.neck * 0.12;
  p.stir = a;
  for (let i = 0; i < 4; i++) p.foot[i] = i < 2 ? 4 : 6;
  const q = mixPlan(restPlan(s, R), p, down);
  q.stir = a * down;
  return q;
}

/** Foraging in the wild: its head down at the ground, nibbling. */
function grazePlan(s: Tort, R: Rest, a: Anim, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  p.pitch = -3;
  p.head = [-s.head.lift - 12 + 4 * Math.sin(a.t * 5), 6 * drift(a.t, 0.7), 0];
  p.neck = s.head.neck * 0.05;
  p.jaw = 12 * Math.max(0, Math.sin(a.t * 6));
  p.H -= L * 0.01;
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: drawn down small into its shell as the light gathers, then up tall at the turn with its head high, a shake, and settled. */
function evolvePlan(s: Tort, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.08 * hunch + 0.06 * up);
  p.pitch = -3 * hunch + 8 * up;
  p.roll = 4 * shake;
  p.squash = 0.08 * hunch - 0.03 * up + 0.06 * hump(t, 0.72, 0.05);
  p.head = [-16 * hunch + 18 * up, 6 * shake, 10 * shake];
  p.neck = s.head.neck * (-0.55 * hunch + 0.15 * up);
  p.jaw = 16 * up;
  p.stir = TAU * 0.5 * ramp(t, 0.4, 0.9);
  for (const i of [2, 3]) p.foot[i] = 14 * up;
  return p;
}

const MOST_REACH = 0.94;

function footHeading(i: number, L: Leg): V3 {
  const a = SIDE[i] * -L.turn * DEG;
  return [-Math.sin(a), Math.cos(a), 0];
}
function heelOf(s: Tort, R: Rest, i: number, at: V3, lift: number): V3 {
  const L = legOfI(s, i), h = footHeading(i, L), F = L.foot, c = Math.cos(lift * DEG), sn = Math.sin(lift * DEG);
  return [at[0] - h[0] * F * c, at[1] - h[1] * F * c, at[2] + R.heel[i] + F * sn];
}

function seated(s: Tort, R: Rest, p: Plan): Plan {
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

function posedOf(s: Tort, R: Rest, a: Anim): Plan {
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

/** Where the mortar's surface is, at the middle of the basin, in the body's frame. */
const mortarAt = (s: Tort): V3 => [0, s.basin.y, s.basin.z + s.basin.h - s.basin.down];
/** How the paddle stands at rest: turned so it leans back and to its left, as on the sheet. */
const PADDLE_REST = 200;
/** How far each stage holds its head tipped up, its chin raised (degrees). */
const HEAD_UP = [20, 24, 28];

function tortBones(s: Tort): (a: Anim) => Bones {
  const R = restOf(s);
  return (a) => {
    const P = seated(s, R, posedOf(s, R, { ...a, go: a.act ? 0 : a.go }));
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const H = s.head;
    // The neck comes out from under the front of the shell raised by its lift, and bows and turns with the head; the head the rest
    // of the way on the end of it, held level against the lift. Pushed out or drawn in, the neck is drawn out or shortened to it.
    const neck = joint(body, H.at, H.lift + P.head[0] * 0.5, 0, P.head[1] * 0.5), k = Math.max(0.2, (H.neck + P.neck) / H.neck);
    b.head = joint(neck, [0, H.neck + P.neck, 0], -H.lift + HEAD_UP[s.stage] + P.head[0] * 0.5, P.head[2], P.head[1] * 0.5);
    b.jaw = joint(b.head, jawHinge(s), -P.jaw);
    const m = neck.m;
    b.neck = { m: [m[0], m[1] * k, m[2], m[3], m[4] * k, m[5], m[6], m[7] * k, m[8]], t: neck.t };
    for (let i = 0; i < 4; i++) {
      const L = legOfI(s, i), g = P.at[i];
      const heading = footHeading(i, L);
      const heel = heelOf(s, R, i, [g[0], g[1], Math.max(0, g[2])], P.foot[i]);
      const [u, l, f] = legOf(R, body, i, heel, heading, P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    b.tail = joint(body, [0, -s.shell.l * 0.86, 0.02], -20 + 5 * Math.sin(a.t * 1.7), 0, 10 * Math.sin(a.t * 1.1));
    // The mortar turns about the middle of the basin with the stir, and the paddle with it.
    b.mortar = joint(b.trunk, mortarAt(s), 0, 0, P.stir / DEG);
    if (s.paddle) b.paddle = joint(b.trunk, mortarAt(s), 0, 0, PADDLE_REST + P.stir / DEG);
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    return b;
  };
}

/* ---- the shell ---------------------------------------------------------------------------------- */

/** How square the dome is across: two an egg, more a loaf. */
const DOME_E = 2.15;
/** A point on the dome, `th` round from its front (to the right) and `ph` up from its foot, and the way out of it; below its foot the rim flares out. */
function domeAt(s: Tort, th: number, ph: number, out = 0): { p: V3; n: V3 } {
  const S = s.shell, sx = Math.sin(th), cy = Math.cos(th);
  let p: V3, n: V3;
  if (ph >= 0) {
    // A dome squarer than an egg, its sides steep and its top broad: x^E + z^E = 1 across it.
    const E = DOME_E, c = Math.max(0, Math.cos(ph)), sn = Math.max(0, Math.sin(ph));
    const rho = c ** (2 / E), z = sn ** (2 / E);
    p = [S.w * rho * sx, S.l * rho * cy, S.h * z];
    const g = rho ** (E - 2);
    n = unit([(g * rho * sx) / S.w, (g * rho * cy) / S.l, (z ** (E - 1)) / S.h]);
  } else {
    // Below the foot of the dome: the carapace going on down, flaring out a little over the legs.
    const f = 1 + s.flare * (-ph);
    p = [S.w * f * sx, S.l * f * cy, S.h * ph * 0.9];
    n = unit([sx / S.w, cy / S.l, -0.15]);
  }
  return { p: add(p, scale(n, out)), n };
}

/** The dome itself, under its blocks: the grout between them, dark. Closed under its rim, where the plastron is. */
function domeOf(s: Tort, n: number, k: number): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const rings: number[] = [-0.32, -0.16, 0];
  for (let q = 1; q <= k; q++) rings.push(lerp(0, Math.PI / 2 - 0.02, q / k));
  for (const ph of rings) for (let j = 0; j < n; j++) v.push(domeAt(s, (j / n) * TAU, ph, -0.01).p);
  const top = v.length;
  v.push([0, 0, s.shell.h - 0.01]);
  // Leathery brown carapace below the blocks; dark grout between them above.
  const blocksFrom = s.courses[0].from + (s.courses[0].jag ? 0.12 : 0.04);
  for (let q = 0; q < rings.length - 1; q++) {
    const mid = (rings[q] + rings[q + 1]) / 2;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      f.push({ i: [q * n + j, q * n + j2, (q + 1) * n + j2, (q + 1) * n + j], m: mid < blocksFrom ? 'leather' : 'stoneDark' });
      want.push(domeAt(s, ((j + 0.5) / n) * TAU, mid).n);
    }
  }
  const last = (rings.length - 1) * n;
  for (let j = 0; j < n; j++) {
    f.push({ i: [last + j, last + ((j + 1) % n), top], m: 'stoneDark' });
    want.push([0, 0, 1]);
  }
  // The underside: the plastron, brown leather.
  f.push({ i: Array.from({ length: n }, (_, j) => j), m: 'leather' });
  want.push([0, 0, -1]);
  return mesh(v, woundTo(v, f, want));
}

/**
 * A stone block on the dome: its corners (round, up) on the dome's surface, its top lifted off it by `thick` and drawn in a
 * little at its edges, so its sides slope. Returns the block and where its top's middle is and the way out of it.
 */
function slab(s: Tort, corners: Array<[number, number]>, thick: number, mat: Mat, sideMat: Mat, push: (pts: V3[]) => V3[] = (x) => x, id = 0): { m: Mesh; c: V3; n: V3; top: V3[] } {
  const base = corners.map(([th, ph]) => domeAt(s, th, ph, -0.005));
  const mid = corners.reduce<[number, number]>((t, [th, ph]) => [t[0] + th / corners.length, t[1] + ph / corners.length], [0, 0]);
  const M = domeAt(s, mid[0], mid[1]);
  // Each block set a little askew: its top tilted one way or another, so the light catches them unevenly.
  const bc = base.reduce<V3>((t, b) => add(t, scale(b.p, 1 / base.length)), [0, 0, 0]);
  const tilt = scale(unit(cross(M.n, [jitter(id + 40) - 0.5, jitter(id + 41) - 0.5, jitter(id + 42) - 0.5])), 1.6 * (jitter(id + 43) - 0.3));
  const lifted = push(base.map((b) => add(b.p, scale(M.n, thick * Math.max(0.5, 1 + dot(sub(b.p, bc), tilt))))));
  const cTop = lifted.reduce<V3>((t, p) => add(t, scale(p, 1 / lifted.length)), [0, 0, 0]);
  // Its edges worn round: the sides go up to a shoulder, a bevel goes in from there to the flat of its top.
  const shoulder = base.map((b, j) => mixV(mixV(b.p, lifted[j], 0.68), cTop, 0.06));
  const top = lifted.map((p) => mixV(p, cTop, 0.3));
  const v: V3[] = [...base.map((b) => b.p), ...shoulder, ...top];
  const N = corners.length, f: Face[] = [], want: V3[] = [];
  f.push({ i: Array.from({ length: N }, (_, j) => 2 * N + j), m: mat });
  want.push(M.n);
  for (let j = 0; j < N; j++) {
    const j2 = (j + 1) % N;
    const edgeMid = scale(add(add(v[j], v[j2]), add(v[N + j], v[N + j2])), 0.25);
    f.push({ i: [j, j2, N + j2, N + j], m: sideMat });
    want.push(unit(add(sub(edgeMid, cTop), scale(M.n, 0.2))));
    const bevelMid = scale(add(add(v[N + j], v[N + j2]), add(v[2 * N + j], v[2 * N + j2])), 0.25);
    f.push({ i: [N + j, N + j2, 2 * N + j2, 2 * N + j], m: 'stone' });
    want.push(unit(add(sub(bevelMid, cTop), scale(M.n, 0.8))));
  }
  return { m: mesh(v, woundTo(v, f, want)), c: cTop, n: M.n, top };
}

/** The basin's outer radius and foot, for keeping blocks out from under it. */
const basinHole = (s: Tort): number => s.basin.r * 0.92;

/**
 * The shell: the dark dome, its courses of sandstone blocks, the rim's slabs jagged on the bigger two, the middle course of the
 * Mortoise's carved with a spiral; tufts of moss between the blocks and round the foot of the basin.
 */
function shellOf(s: Tort, lod: number): { shell: Mesh; moss: Mesh } {
  const parts: Mesh[] = [domeOf(s, cut(lod, 14, 20), cut(lod, 4, 6))];
  const decals: Disc[] = [];
  const corners: V3[] = [];
  s.courses.forEach((C, ci) => {
    const step = TAU / C.n, off = ci % 2 ? step / 2 : 0, gap = 0.035, gp = 0.025;
    for (let j = 0; j < C.n; j++) {
      const id = ci * 31 + j * 7 + s.stage * 101;
      const a0 = off + j * step + gap * (1 + 0.5 * jitter(id)), a1 = off + (j + 1) * step - gap * (1 + 0.5 * jitter(id + 1));
      const p0 = C.from + gp, p1 = C.to - gp;
      // Under the basin no block is seen; the top course stops short of it.
      const top = domeAt(s, (a0 + a1) / 2, p1).p;
      if (Math.hypot(top[0], top[1] - s.basin.y) < basinHole(s) && ci === s.courses.length - 1) {
        // Only the blocks whose foot shows out from under the basin.
        const low = domeAt(s, (a0 + a1) / 2, p0).p;
        if (Math.hypot(low[0], low[1] - s.basin.y) < basinHole(s)) continue;
      }
      const am = (a0 + a1) / 2, wob = (q: number): number => (jitter(id + q) - 0.5) * 0.06;
      let cs: Array<[number, number]>;
      if (C.jag) {
        // A slab of the rim: wide at the top, coming down to a point, jutting out.
        cs = [[a0, p1 + wob(2)], [a1, p1 + wob(3)], [a1 - step * 0.06, p0 + C.jag * 0.3], [am + (jitter(id + 4) - 0.5) * step * 0.3, p0 - C.jag], [a0 + step * 0.06, p0 + C.jag * 0.3]];
      } else if (C.emblem) {
        // A great plate, its corners cut: six sided.
        const pm = (p0 + p1) / 2;
        cs = [[a0 + step * 0.12, p1], [a1 - step * 0.12, p1], [a1, pm], [a1 - step * 0.12, p0], [a0 + step * 0.12, p0], [a0, pm]];
      } else {
        cs = [[a0, p0 + wob(5)], [a1, p0 + wob(6)], [a1 + wob(7) * 0.5, p1 + wob(8)], [am, p1 + 0.02 + wob(9)], [a0 + wob(10) * 0.5, p1 + wob(11)]];
      }
      const jag = C.jag ?? 0;
      const lift = (pts: V3[]): V3[] => (jag ? pts.map((p, q) => (q >= 2 ? add(p, scale(domeAt(s, am, p0).n, jag * (q === 3 ? 0.6 : 0.3))) : p)) : pts);
      const tone: Mat = jitter(id + 12) < 0.3 ? 'shell' : 'stone';
      const B = slab(s, cs, C.thick * (0.85 + 0.3 * jitter(id + 13)), tone, 'stoneDark', lift, id);
      parts.push(B.m);
      for (const c of B.top) corners.push(c);
      if (C.emblem && j % 3 !== 2) decals.push(...spiralOn(B.c, B.n, Math.min(step * s.shell.w * 0.28, (C.to - C.from) * s.shell.h * 0.6), 'stoneDark'));
      else if (C.jag && s.stage === 1 && j % 3 === 1) decals.push(...spiralOn(add(B.c, scale(domeAt(s, am, p0).n, 0.01)), B.n, step * s.shell.w * 0.22, 'stoneDark'));
      else if (!C.jag && !C.emblem && jitter(id + 20) < 0.45) {
        // A crack or chisel mark across it.
        const d = unit(cross(B.n, [Math.cos(am + 1), Math.sin(am + 1), 0.3]));
        const L = step * s.shell.w * 0.18;
        decals.push(...band([add(B.c, scale(d, -L)), add(add(B.c, scale(d, L * 0.2)), scale(cross(B.n, d), L * 0.25)), add(B.c, scale(d, L))], B.n, 0.008, 'stoneDark'));
      }
    }
  });
  parts.push(paint(decals));
  // Moss: tufts at the joins between the courses, more toward the top, and a ring of it round the foot of the basin.
  const tufts: Mesh[] = [];
  // A clump of moss: a mound of soft lumps, lit on top, a darker one or two under.
  const tuft = (p: V3, n: V3, r: number, id: number, spread = 1): void => {
    const e1 = unit(cross(n, [0, 0.3, 1])), e2 = cross(n, e1);
    const lumps = lod ? 5 : 4;
    for (let q = 0; q < lumps; q++) {
      const a = (q / lumps) * TAU + jitter(id + q) * 0.9, d = r * (q ? 0.75 : 0) * spread;
      const c = add(add(p, add(scale(e1, Math.cos(a) * d), scale(e2, Math.sin(a) * d * 0.8))), scale(n, r * (q ? 0.15 : 0.35)));
      const k = q ? 0.6 + 0.3 * jitter(id + q + 5) : 0.85;
      tufts.push(orbAlong(c, n, [r * k, r * k * 0.9, r * k * 0.6], lod ? 6 : 5, 3, q === 0 ? 'leaf' : q % 3 === 0 ? 'leafDark' : 'moss'));
    }
  };
  const M = s.moss, R = s.mossSize;
  for (let q = 0; q < M; q++) {
    const ci = s.courses[1].emblem ? 2 : 1 + (q % (s.courses.length - 1));
    const C = s.courses[ci];
    const th = (q / M) * TAU * 2.0 + jitter(q * 13 + s.stage) * 0.6 + (ci % 2 ? TAU / C.n / 2 : 0);
    const ph = C.from - 0.01 + (jitter(q * 13 + 3) - 0.5) * 0.06;
    const e = domeAt(s, th, ph, s.courses[ci - 1].thick * 0.5);
    tuft(e.p, e.n, R * (0.7 + 0.5 * jitter(q * 13 + 7)), q * 17 + s.stage * 3, 1.3);
  }
  // A ring of it round the foot of the basin, thick.
  const B = s.basin, ringN = 8 + s.stage * 3;
  for (let q = 0; q < ringN; q++) {
    const a = (q / ringN) * TAU + jitter(q + 70) * 0.3;
    const p: V3 = [Math.cos(a) * B.r * 1.02, B.y + Math.sin(a) * B.r * 1.02, B.z + 0.01];
    const n = unit([Math.cos(a), Math.sin(a), 1.2]);
    tuft(p, n, R * (0.75 + 0.4 * jitter(q + 71)), q * 23 + 500, 1.2);
  }
  return { shell: merge(...parts), moss: merge(...tufts) };
}

/** A spiral carved into a plate: a line wound out from its middle, three turns. */
function spiralOn(c: V3, n: V3, r: number, m: Mat): Disc[] {
  const e1 = unit(cross(n, Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), e2 = cross(n, e1);
  const pts: V3[] = [];
  const turns = 2.2, steps = 22;
  for (let q = 0; q <= steps; q++) {
    const u = q / steps, a = u * turns * TAU, rr = r * (0.12 + 0.88 * u);
    pts.push(add(add(c, scale(e1, Math.cos(a) * rr)), scale(e2, Math.sin(a) * rr * 0.85)));
  }
  return band(pts, n, r * 0.1, m, 0.014);
}

/* ---- the basin and the mortar ------------------------------------------------------------------- */

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

/**
 * The basin: a round stone wall, turned, its outside in blocks (the Mortarshell's) or with a sunk band carved with a key-fret
 * between two raised lips (the bigger two's), a broad rim along its top lit pale, and its inside wall in shade down to the mortar.
 */
function basinOf(s: Tort, n: number): Mesh {
  const B = s.basin, ro = B.r, ri = B.r - B.wall, c: V3 = [0, B.y, B.z], H = B.h, zm = H - B.down;
  const prof: Array<[number, number, Mat]> = B.fret
    ? [[ro * 0.94, -0.06, 'stone'], [ro * 1.0, H * 0.1, 'stone'], [ro * 1.0, H * 0.22, 'stone'], [ro * 0.965, H * 0.24, 'stoneDark'], [ro * 0.965, H * 0.72, 'shell'],
      [ro * 1.02, H * 0.74, 'stoneDark'], [ro * 1.02, H * 0.94, 'stone'], [ro * 0.99, H, 'stone'], [ri * 1.02, H, 'shell'], [ri, H * 0.97, 'shell'], [ri * 0.99, zm - 0.03, 'shellDark']]
    : [[ro * 0.94, -0.06, 'stone'], [ro * 1.0, H * 0.15, 'stone'], [ro * 1.0, H * 0.9, 'stone'], [ro * 0.97, H, 'stone'], [ri * 1.03, H, 'shell'], [ri, H * 0.95, 'shell'], [ri * 0.99, zm - 0.03, 'shellDark']];
  const wall = lathe(c, prof, n);
  const decals: Disc[] = [];
  const onWall = (a: number, z: number, r: number): { p: V3; n: V3 } => ({ p: [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + z], n: [Math.cos(a), Math.sin(a), 0] });
  const blocks = B.blocks;
  if (!B.fret) {
    // Blocks: the joints between them up the wall, staggered at a course halfway up, and across the rim.
    for (let q = 0; q < blocks; q++) {
      const a = (q / blocks) * TAU + 0.2, a2 = a + TAU / blocks / 2;
      decals.push(...band([onWall(a, H * 0.5, ro * 1.002).p, onWall(a, H * 0.97, ro * 1.002).p], onWall(a, 0, 1).n, 0.01, 'stoneDark', 0.006));
      decals.push(...band([onWall(a2, H * 0.05, ro * 1.002).p, onWall(a2, H * 0.5, ro * 1.002).p], onWall(a2, 0, 1).n, 0.01, 'stoneDark', 0.006));
      decals.push(...band([[c[0] + Math.cos(a) * ri * 1.04, c[1] + Math.sin(a) * ri * 1.04, c[2] + H + 0.003], [c[0] + Math.cos(a) * ro * 0.96, c[1] + Math.sin(a) * ro * 0.96, c[2] + H + 0.003]], [0, 0, 1], 0.01, 'stoneDark', 0.004));
    }
    const ring: V3[] = [];
    for (let q = 0; q <= 40; q++) ring.push(onWall((q / 40) * TAU, H * 0.5, ro * 1.002).p);
    for (let q = 0; q < 40; q++) decals.push(...band([ring[q], ring[q + 1]], onWall(((q + 0.5) / 40) * TAU, 0, 1).n, 0.009, 'stoneDark', 0.006));
  } else {
    // The key-fret round the sunk band: a running line of hooks, each turned in on itself, between a line along its top and foot.
    const z0 = H * 0.3, z1 = H * 0.66, rr = ro * 0.968, units = blocks + 4;
    const key: Array<[number, number]> = [[0, 0], [0, 1], [0.78, 1], [0.78, 0.26], [0.3, 0.26], [0.3, 0.62], [0.52, 0.62]];
    for (let q = 0; q < units; q++) {
      const a0 = (q / units) * TAU, da = TAU / units;
      const pts = key.map(([u, w]) => onWall(a0 + u * da * 0.92, lerp(z0, z1, w), rr).p);
      // Each stretch on the wall facing out where it is.
      for (let e = 0; e < pts.length - 1; e++) {
        const am = a0 + ((key[e][0] + key[e + 1][0]) / 2) * da * 0.92;
        decals.push(...band([pts[e], pts[e + 1]], onWall(am, 0, 1).n, (z1 - z0) * 0.07, 'stoneDark', 0.006));
      }
      decals.push(...band([onWall(a0, z0 - (z1 - z0) * 0.12, rr).p, onWall(a0 + da, z0 - (z1 - z0) * 0.12, rr).p], onWall(a0 + da / 2, 0, 1).n, (z1 - z0) * 0.05, 'stoneDark', 0.006));
      decals.push(...band([onWall(a0, z1 + (z1 - z0) * 0.12, rr).p, onWall(a0 + da, z1 + (z1 - z0) * 0.12, rr).p], onWall(a0 + da / 2, 0, 1).n, (z1 - z0) * 0.05, 'stoneDark', 0.006));
      // The joints between the blocks of the lips.
      decals.push(...band([onWall(a0 + da * 0.96, H * 0.76, ro * 1.022).p, onWall(a0 + da * 0.96, H * 0.92, ro * 1.022).p], onWall(a0, 0, 1).n, 0.01, 'stoneDark', 0.006));
      decals.push(...band([onWall(a0 + da * 0.46, H * 0.02, ro * 1.002).p, onWall(a0 + da * 0.46, H * 0.2, ro * 1.002).p], onWall(a0, 0, 1).n, 0.01, 'stoneDark', 0.006));
    }
    for (let q = 0; q < blocks; q++) {
      const a = (q / blocks) * TAU + 0.15;
      decals.push(...band([[c[0] + Math.cos(a) * ri * 1.05, c[1] + Math.sin(a) * ri * 1.05, c[2] + H + 0.003], [c[0] + Math.cos(a) * ro * 0.97, c[1] + Math.sin(a) * ro * 0.97, c[2] + H + 0.003]], [0, 0, 1], 0.011, 'stoneDark', 0.004));
    }
  }
  return merge(wall, paint(decals));
}

/**
 * The mortar: a pale disc filling the basin, in its own frame at its middle, a swirl wound out over it in a tan line and a white
 * one -- two arms, so it reads as a swirl and not a target -- and a little heaped up where the paddle stands.
 */
function mortarOf(s: Tort, n: number): Mesh {
  const ri = (s.basin.r - s.basin.wall) * 0.985;
  const v: V3[] = [];
  for (let j = 0; j < n; j++) { const a = (j / n) * TAU; v.push([Math.cos(a) * ri, Math.sin(a) * ri, 0]); }
  const f: Face[] = [{ i: Array.from({ length: n }, (_, j) => j), m: 'cloth' }];
  const disc0 = mesh(v, woundTo(v, f, [[0, 0, 1]]));
  const out: Disc[] = [];
  const up: V3 = [0, 0, 1];
  for (const arm of [0, Math.PI]) {
    const tan: V3[] = [], white: V3[] = [];
    for (let q = 0; q <= 26; q++) {
      const u = q / 26, a = arm + u * TAU * 1.35, r = ri * (0.08 + 0.82 * u);
      tan.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
      const r2 = r * 0.86 + ri * 0.05, a2 = a - 0.25;
      white.push([Math.cos(a2) * r2, Math.sin(a2) * r2, 0]);
    }
    out.push(...band(tan, up, ri * 0.075, 'clothDark', 0.006));
    out.push(...band(white.slice(2), up, ri * 0.04, 'lining', 0.01));
  }
  out.push(disc([0, 0, 0.012], up, ri * 0.12, ri * 0.12, 8, 'lining'));
  return merge(disc0, paint(out));
}

/** The paddle: a square stick of wood, its foot in the mortar off the middle, leaning back, with a square block for its head. */
function paddleOf(s: Tort): Mesh {
  const P = s.paddle!, lean = P.lean * DEG;
  const foot: V3 = [0, -P.off, -0.02];
  const dir: V3 = [0, -Math.sin(lean), Math.cos(lean)];
  const top = add(foot, scale(dir, P.len));
  const stick = tube([foot, add(foot, scale(dir, P.len * 0.5)), top], [P.w, P.w * 1.05, P.w * 1.1], [P.w, P.w * 1.05, P.w * 1.1], 4, (_r, j) => (j % 2 ? 'wood' : 'woodDark'), { up: [1, 0, 0] });
  const head = tube([add(top, scale(dir, -P.headLen * 0.15)), add(top, scale(dir, P.headLen))], P.head, P.head, 4, (_r, j) => (j % 2 ? 'wood' : 'woodDark'), { up: [1, 0, 0] });
  // A ring of mortar round its foot, where it stands in it, and a smear up it.
  const smear = tube([foot, add(foot, scale(dir, P.len * 0.12))], [P.w * 1.5, P.w * 1.15], [P.w * 1.5, P.w * 1.15], 6, 'cloth');
  // Grain down two of its faces.
  const grain: Disc[] = [];
  for (const sd of [1, -1]) {
    const nrm: V3 = [sd, 0, 0];
    grain.push(...band([add(add(foot, scale(dir, P.len * 0.2)), [sd * P.w * 1.02, P.w * 0.3, 0]), add(add(foot, scale(dir, P.len * 0.95)), [sd * P.w * 1.08, P.w * 0.25, 0])], nrm, P.w * 0.12, 'woodDark', 0.004));
  }
  return merge(stick, head, smear, paint(grain));
}

/* ---- the head and neck ------------------------------------------------------------------------- */

/**
 * The head, in its own frame along `+y`: a rounded olive skull, darker spots over its crown, a blunt snout with two nostrils, the
 * cream of its face coming up over its cheeks; a calm amber eye either side under a heavy lid that covers the top of it, a glint
 * in each; a long mouth line.
 */
function headOf(s: Tort, n: number, shut: boolean): Mesh {
  const r = s.head.r, N = n + 4;
  // Olive over the top, the cream of the face below a line that runs from under the eye down to the corner of the mouth.
  const cream = (m: Mesh, below: (p: V3) => boolean): Mesh => mesh(m.v, m.f.map((f) => {
    const c = f.i.reduce<V3>((t, i) => add(t, scale(m.v[i], 1 / f.i.length)), [0, 0, 0]);
    return below(c) ? { ...f, m: 'belly' as Mat } : f;
  }));
  const faceLine = (p: V3): boolean => p[2] < -r[2] * 0.02 + (p[1] / r[1]) * r[2] * 0.16 && p[1] > -r[1] * 0.5;
  const skull = cream(orbAlong([0, 0, 0], [0, 1, 0.05], [r[0], r[2], r[1]], N, 7, 'mark'), faceLine);
  const snout = cream(orbAlong([0, r[1] * 0.6, -r[2] * 0.06], [0, 1, -0.1], [r[0] * 0.74, r[2] * 0.74, r[1] * 0.52], N, 5, 'mark'), faceLine);
  const decals: Disc[] = [];
  // Spots over the crown and the back of the head.
  for (let q = 0; q < 9; q++) {
    const a = (jitter(q * 7 + 2) - 0.5) * 2.6, up = 0.45 + 0.5 * jitter(q * 7 + 3), dir: V3 = [Math.sin(a) * (1 - up * 0.6), -0.4 + 0.6 * jitter(q * 7 + 4), up];
    const p = onEgg([0, 0, 0], r, dir);
    decals.push(disc(add(p.p, scale(p.n, 0.012)), p.n, r[0] * (0.09 + 0.06 * jitter(q + 1)), r[0] * (0.07 + 0.04 * jitter(q + 5)), 6, 'spot', { spin: a }));
  }
  // The nostrils, on the top of the end of the snout.
  for (const sd of [1, -1]) {
    const p = onEgg([0, r[1] * 0.62, -r[2] * 0.08], [r[0] * 0.72, r[1] * 0.5, r[2] * 0.72], [sd * 0.3, 0.8, 0.5]);
    decals.push(disc(add(p.p, scale(p.n, 0.01)), p.n, r[0] * 0.06, r[0] * 0.045, 6, 'lid'));
  }
  // The mouth: a long line from under the snout back along each side, curving up at its corner.
  for (const sd of [1, -1]) {
    const pts: V3[] = [];
    for (let q = 0; q <= 6; q++) {
      const u = q / 6, dir: V3 = [sd * lerp(0.2, 0.92, u), lerp(0.95, 0.15, u), lerp(-0.62, -0.42, u) + 0.12 * u * u];
      const e = onEgg([0, r[1] * 0.3, -r[2] * 0.28], [r[0] * 0.98, r[1] * 0.92, r[2] * 0.68], dir);
      pts.push(add(e.p, scale(e.n, 0.008)));
    }
    const nrm = unit([sd * 0.8, 0.4, -0.2]);
    decals.push(...band(pts, nrm, r[0] * 0.025, 'lid', 0.004));
  }
  return merge(skull, snout, eyesOn(s, shut), paint(decals));
}

/** Its eyes: amber, a dark pupil and a glint, under an olive lid that covers the top third, its edge drawn dark: calm, half shut. */
function eyesOn(s: Tort, shut: boolean): Mesh {
  const r = s.head.r;
  const out: Disc[] = [];
  for (const sd of [1, -1]) {
    const e = onEgg([0, 0, 0], r, [sd * 0.7, 0.5, 0.48]), n = e.n, p = add(e.p, scale(n, 0.012)), sz = r[0] * 0.25;
    const side = unit(cross([0, 0, 1], n)), upv = unit(cross(n, side));
    const o = { up: [0, 0, 1] as V3 };
    if (shut) {
      out.push(disc(p, n, sz * 1.15, sz * 1.0, 10, 'mark', o));
      out.push(disc(add(p, scale(n, 0.004)), n, sz * 1.0, sz * 0.18, 8, 'lid', o));
      continue;
    }
    out.push(disc(p, n, sz * 1.18, sz * 1.08, 12, 'lid', o));
    out.push(disc(add(p, scale(n, 0.003)), n, sz, sz * 0.92, 12, 'bloom', o));
    out.push(disc(add(add(p, scale(n, 0.006)), scale(upv, -sz * 0.08)), n, sz * 0.46, sz * 0.62, 8, 'eye', o));
    out.push(disc(add(add(add(p, scale(n, 0.009)), scale(upv, sz * 0.05)), scale(side, sz * 0.3)), n, sz * 0.24, sz * 0.24, 6, 'glint', { ...o, lit: true }));
    // The lid: olive over the top third, its lower edge a dark line.
    out.push(disc(add(add(p, scale(n, 0.012)), scale(upv, sz * 0.66)), n, sz * 1.3, sz * 0.66, 10, 'mark', o));
    out.push(...band([-1, -0.5, 0, 0.5, 1].map((x) => add(add(add(p, scale(n, 0.014)), scale(upv, sz * (0.06 + 0.04 * x * x))), scale(side, x * sz * 1.08))), n, sz * 0.1, 'lid', 0.002));
  }
  return paint(out);
}

const jawHinge = (s: Tort): V3 => { const r = s.head.r; return [0, -r[1] * 0.25, -r[2] * 0.4]; };
/** The lower jaw, from its hinge: cream, its chin under the end of the snout. */
function jawOf(s: Tort, n: number): Mesh {
  const r = s.head.r, hg = jawHinge(s);
  return merge(
    orbAlong(sub([0, r[1] * 0.38, -r[2] * 0.52], hg), [0, 1, -0.1], [r[0] * 0.78, r[2] * 0.34, r[1] * 0.8], n + 4, 5, 'belly'),
    orbAlong(sub([0, r[1] * 0.92, -r[2] * 0.48], hg), [0, 1, -0.25], [r[0] * 0.42, r[2] * 0.26, r[1] * 0.24], n, 3, 'muzzle'),
  );
}

/** The neck, along `+y` from under the shell to the head: thick, olive and spotted over its top, cream down its throat, in folds. */
function neckOf(s: Tort, n: number): Mesh {
  const H = s.head, w = H.thick, L = H.neck;
  const pts: V3[] = [[0, -0.14, 0], [0, L * 0.4, 0], [0, L * 0.75, 0], [0, L + 0.04, 0]];
  const top = tube(pts, [w * 1.15, w * 1.0, w * 0.95, w * 0.92], [w * 0.95, w * 0.85, w * 0.8, w * 0.78], n, 'mark', { seam: 'start' });
  const throat = tube(pts.map((p) => add(p, [0, 0.02, -w * 0.3])), [w * 0.95, w * 0.85, w * 0.8, w * 0.74], [w * 0.8, w * 0.72, w * 0.68, w * 0.64], n, 'belly', { seam: 'start' });
  const decals: Disc[] = [];
  for (let q = 0; q < 7; q++) {
    const y = L * (0.05 + 0.85 * jitter(q * 3 + 1)), a = (jitter(q * 3 + 2) - 0.5) * 2.2, nrm: V3 = [Math.sin(a), 0, Math.cos(a)];
    decals.push(disc([nrm[0] * w * 0.98, y, nrm[2] * w * 0.83], nrm, w * 0.16, w * 0.12, 6, 'spot', { up: [0, 1, 0] }));
  }
  // Folds across the throat.
  for (let q = 0; q < 3; q++) {
    const y = L * (0.2 + 0.25 * q), nrm: V3 = [0, 0.2, -1];
    decals.push(...band([-0.6, -0.2, 0.2, 0.6].map((x) => [x * w * 0.8, y + 0.02, -w * 0.3 - w * 0.72 * (1 - x * x * 0.6)] as V3), unit(nrm), w * 0.035, 'clothDark', 0.004));
  }
  return merge(top, throat, paint(decals));
}

/* ---- legs and feet ------------------------------------------------------------------------------ */

/** A foot, from its heel at the origin along `+y`: a round stump of a foot, spotted, and big pale claws splayed round its front. */
function footOf(L: Leg, heel: number, n: number): Mesh {
  const F = L.foot, w = L.w, z0 = -heel, parts: Mesh[] = [];
  parts.push(tube([[0, -w * 0.15, w * 0.1], [0, F * 0.3, z0 * 0.4], [0, F * 0.55, z0 + w * 0.3]], [w * 1.05, w * 1.15, w * 1.2], [w * 1.0, w * 0.9, w * 0.55], Math.max(6, n - 2), 'mark', { seam: 'start' }));
  const T = L.claws, spread = T > 3 ? 1.5 : 1.2;
  for (let k = 0; k < T; k++) {
    const u = T > 1 ? k / (T - 1) : 0.5, a = lerp(-spread * 0.5, spread * 0.5, u);
    const len = L.claw * (0.85 + 0.25 * Math.sin(Math.PI * u));
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    const root: V3 = [d[0] * w * 0.85, F * 0.55 + d[1] * w * 0.75, z0 + w * 0.32];
    const tip: V3 = [root[0] + d[0] * len, root[1] + d[1] * len, z0 + 0.01];
    const cw = w * (T > 3 ? 0.34 : 0.42);
    parts.push(tube([root, mixV(root, tip, 0.5), tip], [cw, cw * 0.75, 0.006], [cw * 0.8, cw * 0.55, 0.006], 5, 'claw', { start: false }));
  }
  return merge(...parts);
}

function speckle(r: number, len: number, count: number, seed: number): Disc[] {
  const out: Disc[] = [];
  for (let q = 0; q < count; q++) {
    const z = -len * (0.2 + 0.6 * jitter(seed + q)), a = jitter(seed + q * 3) * TAU, nrm: V3 = [Math.cos(a), Math.sin(a), 0];
    out.push(disc(add([nrm[0] * r, nrm[1] * r, z], scale(nrm, 0.012)), nrm, r * 0.3, r * 0.36, 6, 'spot', { up: [0, 0, 1] }));
  }
  return out;
}
function upperOf(L: Leg, l0: number, n: number, k: number): Mesh {
  const w = L.w;
  return merge(
    orb([0, 0, -l0 * 0.1], [w * 1.3, w * 1.25, w * 1.3], n, k, 'mark'),
    tube([[0, 0, 0], [0, 0, -l0 * 0.55], [0, 0, -l0]], [w * 1.25, w * 1.1, w * 1.0], [w * 1.25, w * 1.1, w * 1.0], n, 'mark', { seam: 'start' }),
    orb([0, 0, -l0], w * 1.0, n, k, 'mark'),
    paint(speckle(w * 1.15, l0, 4, 11)),
  );
}
/** The lower leg: a pillar, thick, its front in big cream scales. */
function lowerOf(L: Leg, l1: number, n: number, fore: boolean): Mesh {
  const w = L.w;
  const m = tube([[0, 0, w * 0.5], [0, 0, -l1 * 0.55], [0, 0, -l1]], [w * 1.0, w * 1.02, w * 1.05], [w * 1.0, w * 1.02, w * 1.05], n, 'mark', { seam: 'start' });
  // Its front in big cream scales, a tube of them laid along the front of it.
  const k = fore ? 1 : 0.85;
  const front = tube([[0, w * 0.3, w * 0.2], [0, w * 0.34, -l1 * 0.55], [0, w * 0.36, -l1]], [w * 0.82 * k, w * 0.86 * k, w * 0.9 * k], [w * 0.75, w * 0.78, w * 0.82], n, 'belly', { seam: 'start' });
  const scales: Disc[] = speckle(w * 1.03, l1, 2, 23);
  for (let q = 0; q < 3; q++) {
    const z = -l1 * (0.12 + 0.3 * q), nrm: V3 = [0, 1, 0];
    scales.push(...band([-0.6, -0.2, 0.2, 0.6].map((x) => [x * w * 0.8 * k, w * 0.36 + w * 0.78 * Math.sqrt(1 - x * x * 0.7), z - w * 0.12 * (1 - x * x)] as V3), nrm, w * 0.05, 'clothDark', 0.004));
  }
  return merge(m, front, paint(scales));
}

const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- a stage's pieces --------------------------------------------------------------------------- */

const restBoneCache = new Map<Tort, Bones>();
function restBones(s: Tort): Bones {
  let b = restBoneCache.get(s);
  if (!b) restBoneCache.set(s, (b = tortBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 })));
  return b;
}

function tortBuild(s: Tort, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), R = restOf(s);
  restBones(s);
  const pieces: Piece[] = [];
  const S = shellOf(s, lod);
  pieces.push({ key: 'shell', mesh: S.shell, bone: 'trunk', bias: 0.05 });
  pieces.push({ key: 'moss', mesh: S.moss, bone: 'trunk', bias: 0.055, after: ['shell'], lines: false });
  const ring = cut(lod, 16, 22);
  pieces.push({ key: 'mortar', mesh: mortarOf(s, ring), bone: 'mortar', bias: 0.06, after: ['shell', 'moss'] });
  pieces.push({ key: 'basin', mesh: basinOf(s, ring), bone: 'trunk', bias: 0.065, after: ['mortar', 'moss'] });
  if (s.paddle) pieces.push({ key: 'paddle', mesh: paddleOf(s), bone: 'paddle', bias: 0.07, after: ['basin'] });
  // The belly under the shell: the plastron, brown leather, between the legs.
  const Sh = s.shell;
  pieces.push({ key: 'belly', mesh: orb([0, 0, -0.04], [Sh.w * 0.82, Sh.l * 0.84, 0.16], n + 4, k, 'leather'), bone: 'trunk', bias: 0, under: ['shell'] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0.02, under: ['head', 'shell'], after: ['belly'], front: [0, 1, 0] });
  pieces.push({ key: 'head', mesh: headOf(s, n, false), shut: headOf(s, n, true), bone: 'head', bias: 0.1, after: ['neck', 'shell', 'moss', 'basin', 'paddle'], front: [0, 1, 0] });
  pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.09, after: ['neck', 'shell', 'moss', 'basin', 'paddle'], under: ['head'], front: [0, 1, 0] });
  pieces.push({ key: 'tail', mesh: tube(curve([0, 0.05, 0], [0, -s.tail * 0.5, -0.02], [0, -s.tail, -0.08], 3), [0.07, 0.055, 0.035, 0.01].map((x) => x * (1 + s.stage * 0.4)), [0.06, 0.045, 0.03, 0.01].map((x) => x * (1 + s.stage * 0.4)), 6, 'mark', { seam: 'start' }), bone: 'tail', bias: -0.02, under: ['shell'] });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], Lg = legOfI(s, i), [l0, l1] = R.legs[i];
    const foot = side > 0 ? footOf(Lg, R.heel[i], n) : mirroredMesh(footOf(Lg, R.heel[i], n));
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    pieces.push(
      { key: `${key}0`, mesh: upperOf(Lg, l0, n, k), bone: `${key}0`, bias: 0.01, under: ['shell'], after: ['belly'], front },
      { key: `${key}1`, mesh: lowerOf(Lg, l1, n, fore), bone: `${key}1`, bias: 0.02, under: ['shell'], after: ['belly'], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.03, under: ['shell'], after: ['belly'], front },
    );
  }
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const DUST: RGB = [196, 180, 152];
const MORTAR: RGB = [244, 228, 192];
const MORTAR_INK: RGB = [150, 124, 96];
const STONE: readonly RGB[] = [[226, 206, 178], [210, 186, 156], [240, 226, 204]];
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];

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

/** A blob of mortar: pale, inked, a little lumpy. */
function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, squash = 1): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.3 * px);
  g.beginPath();
  g.ellipse(x, y, r, r * 0.8 * squash, 0, 0, TAU);
  g.fillStyle = css(MORTAR, al);
  g.fill();
  g.strokeStyle = css(MORTAR_INK, al * 0.9);
  g.lineWidth = Math.max(0.6 * px, r * 0.22);
  g.stroke();
  g.beginPath();
  g.ellipse(x - r * 0.3, y - r * 0.25 * squash, r * 0.3, r * 0.2, 0, 0, TAU);
  g.fillStyle = css([255, 252, 244], al);
  g.fill();
}

/** A chip of stone, a little turning wedge. */
function chip(g: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.5 * px);
  g.beginPath();
  for (let q = 0; q < 4; q++) {
    const a = spin + (q / 4) * TAU, k = q % 2 ? 0.6 : 1;
    const X = x + Math.cos(a) * r * k, Y = y + Math.sin(a) * r * k * 0.8;
    if (q) g.lineTo(X, Y); else g.moveTo(X, Y);
  }
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.strokeStyle = css(mix(c, [60, 44, 36], 0.6), al);
  g.lineWidth = Math.max(0.6 * px, r * 0.2);
  g.stroke();
}

/**
 * A go at its task: at each slop a little mortar slops up over the rim where the paddle is passing and runs down the outside
 * of the basin, a dribble left there drying; flecks fly off the paddle as it goes round.
 */
function workBits(g: CanvasRenderingContext2D, view: View, s: Tort, b: Bones, t: number, front: boolean): void {
  const B = s.basin, T = ACT_SECS.work, ro = B.r, H = B.h;
  // The side of the basin toward the viewer, in the shell's own frame: where a slop shows, on the near rim either side of it.
  const m = b.trunk.m, Tv = view.T, toward = Math.atan2(m[1] * Tv[0] + m[4] * Tv[1] + m[7] * Tv[2], m[0] * Tv[0] + m[3] * Tv[1] + m[6] * Tv[2]);
  MORTOISE_WORK.slops.forEach((at, q) => {
    const since = (t - at) * T;
    if (since < -0.05 || since > 0.7 || !front) return;
    const a = toward + (q ? 0.75 : -0.65);
    const rim = place(b.trunk, [Math.cos(a) * (ro - B.wall * 0.5), B.y + Math.sin(a) * (ro - B.wall * 0.5), B.z + H + 0.015]);
    const u = clamp(since / 0.7);
    // A lip of mortar heaving up over the rim, then dribbling down the outside of the wall.
    const over = place(b.trunk, [Math.cos(a) * ro * 1.03, B.y + Math.sin(a) * ro * 1.03, B.z + H - H * 0.65 * smooth((u - 0.15) / 0.85)]);
    const [x0, y0] = onScreen(view, rim), [x1, y1] = onScreen(view, over);
    const r = 0.13 * (1 + 0.2 * s.stage), al = 1 - smooth((u - 0.8) / 0.2);
    const heave = hump(u, 0.12, 0.12);
    blob(g, x0, y0 - r * heave, r * (0.9 + 0.5 * heave), al);
    if (u > 0.12) {
      g.strokeStyle = css(MORTAR_INK, al * 0.9);
      g.lineWidth = r * 1.0;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.strokeStyle = css(MORTAR, al);
      g.lineWidth = r * 0.7;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      blob(g, x1, y1, r * 0.55, al);
    }
    // Two flecks thrown off.
    for (let k = 0; k < 2; k++) {
      const out = turn(b.trunk, [Math.cos(a + (k - 0.5)), Math.sin(a + (k - 0.5)), 0]);
      const v: V3 = [out[0] * 0.9, out[1] * 0.9, 1.6 + 0.6 * k];
      const p = thrown(place(b.trunk, [Math.cos(a) * ro * 0.8, B.y + Math.sin(a) * ro * 0.8, B.z + H]), v, since * 0.8);
      const [x, y] = onScreen(view, p);
      blob(g, x, y, r * 0.35, (1 - smooth((since - 0.3) / 0.25)) * smooth(since / 0.05));
    }
  });
}

/** What a strike throws: a puff of dust where its fore feet come down. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Tort, b: Bones, t: number, front: boolean): void {
  const big = 0.6 + 0.4 * (s.stage + 1), mid = b.body.t, since = (t - MORTOISE_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  for (const leg of ['fl2', 'fr2']) {
    const f = place(b[leg], [0, 0, 0]);
    if (nearSide(f, mid, view) === front) puff(g, view, [f[0], f[1], 0.05], 0.2 * big, since / 0.45, leg === 'fl2' ? 3 : 4);
  }
}

/** Evolving: chips of sandstone, tufts of moss and drops of mortar spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Tort, b: Bones, t: number, front: boolean): void {
  const big = 0.6 + 0.4 * (s.stage + 1), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], S = s.shell;
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = S.w * 1.6 + 0.3 * big, ry = S.l * 1.5 + 0.3 * big, high = (S.h + s.basin.h) * 1.6 + 0.5 * big;
  for (let q = 0; q < 16; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 16) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3 === 0) blob(g, x, y, 0.06 * big * (1 - 0.4 * u), swirl);
    else if (q % 3 === 1) chip(g, x, y, 0.08 * big * (1 - 0.3 * u), ang * 3, STONE[q % 3], swirl);
    else {
      const c: RGB = [132, 158, 66], r = 0.08 * big;
      g.fillStyle = css(c, swirl);
      g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), swirl);
      g.lineWidth = Math.max(pxOf(g) * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.6, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    }
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function tortKind(s: Tort): Kind {
  const bones = tortBones(s);
  return {
    bones,
    build: (lod) => tortBuild(s, lod),
    // The variant's coat tints its olive skin and its markings the sandstone of its shell; the mortar, the wood, the moss, its
    // cream face and claws and its amber eyes are the same on every variant.
    palette: (coat, mark) => {
      const skin = mix([148, 166, 92], coat, 0.35), stone = mix([212, 174, 140], mark, 0.22);
      return coatPalette(coat, mark, {
        coat: skin,
        coatDark: mix(skin, [60, 70, 40], 0.4),
        coatLight: mix(skin, [240, 240, 200], 0.4),
        mark: skin,
        spot: mix(skin, [56, 80, 40], 0.42),
        belly: [236, 214, 146],
        muzzle: [244, 228, 172],
        nose: [96, 80, 56],
        lid: [70, 62, 44],
        eye: [40, 30, 26],
        glint: [255, 254, 248],
        bloom: [226, 156, 56],
        inner: [64, 50, 40],
        stone,
        shell: mix(stone, [240, 222, 198], 0.22),
        stoneDark: mix(stone, [120, 84, 62], 0.5),
        shellDark: mix(stone, [140, 110, 92], 0.4),
        leather: [146, 112, 72],
        leatherDark: [116, 78, 52],
        wood: [218, 152, 84],
        woodDark: [184, 118, 62],
        cloth: [244, 228, 190],
        clothDark: [222, 164, 98],
        lining: [255, 248, 226],
        claw: [234, 216, 172],
        pad: [228, 214, 184],
        moss: [108, 136, 52],
        leaf: [140, 164, 66],
        leafDark: [78, 102, 42],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.shell.l * 1.15 + 0.1, s.shell.w * 1.1],
    stride: 1.2,
    size: s.size,
    blinks: 6,
    acts: ['strike', 'work'],
    leaps: [false, false],
    motes: [[246, 236, 212], [150, 176, 84]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBits(g, view, s, b, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const MORTARSHELL = tortKind(MORTARSHELL_LOOK);
export const GROUTBACK = tortKind(GROUTBACK_LOOK);
export const MORTOISE = tortKind(MORTOISE_LOOK);
