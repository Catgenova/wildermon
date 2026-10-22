import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The chest line: the Chestkit, a little wooden treasure chest with a curved
 * lid on four stubby mossy legs, whose front is its face -- two big dark
 * eyes and a small smile on a honey-coloured panel framed in brass -- with a
 * brass lock plate on either side and a sprig of oak growing off its lid;
 * which grows into the Lootvent, bigger, a green scaly body like an
 * armadillo's carrying a banded chest for a shell, buckled leather straps
 * and two brass ring handles over its lid, a teal gem in a brass setting on
 * either side, moss and oak sprigs on the lid and sturdy clawed legs; and
 * then the Hoardback, large, low and heavy, a green scaly beast with a
 * tortoise's head, a beak of a snout, a small amber eye and a pink frill
 * round its neck, looking out from under the front of a huge arched chest
 * for a shell, banded and buckled in bronze with a carry handle on top and
 * moss and oak leaves grown all over it. The species is still `magga`
 * underneath, as saves and the database know it: the fetcher, that carries
 * whatever lies on the settlement home.
 *
 * All three are built by one set of functions from a description of the
 * stage (`Chest`). The chest is its box and its lid, each a shape drawn
 * across it and run along its length, a little fuller at its middle, the
 * bands standing proud of it in steps; the lid is hinged along the back of
 * the box, and opens from the front. Every foot is given a point on the
 * ground to be at and its leg bent to reach it (`./wild-toad`), so a planted
 * foot stays where it was put. The two smaller ones scurry, the diagonals
 * together, the chest rocking over them, and running the lid rattles; the
 * Hoardback lumbers, its head nodding.
 *
 * At its task it fetches: it tips forward over the thing lying in front of
 * it and noses it, twice, then flips it up into the air as its lid swings
 * open, catches it in the chest, and slams the lid shut on it; going home it
 * carries it with the lid shut. The Hoardback noses it with its beak and
 * tosses it back over its head. Standing about it lifts its lid a crack now
 * and then to peek out, the gold inside it catching the light.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** A leg: its hip or shoulder (right side, body frame), its two lengths, where its foot stands, its foot, how thick, how far its foot is turned out. */
interface Leg {
  hip: V3;
  len: [number, number];
  /** Where the ball of its foot stands, across and along, from under the body's middle. */
  at: [number, number];
  /** Heel (or wrist) to the ball of the foot; each toe's length; how many toes. */
  foot: number; toe: number; toes: number;
  /** How thick (a radius). */
  w: number;
  /** How far the foot is turned out from the way the body faces (degrees). */
  turn: number;
}

interface Chest {
  stage: 0 | 1 | 2;
  /** The box: half its width, half its length, its height; the lid's arch over it; how round the box's lower corners are; how much fuller it is at its middle. */
  box: { w: number; l: number; h: number; lid: number; round: number; bulge: number };
  /** Its brass bands besides the two at its ends: where each goes round it along its length (-1 its back, 1 its front); half their width; how far they stand proud. */
  bands: readonly number[];
  band: number;
  proud: number;
  /** Planks: how many down each side of the box, and how many over the lid. */
  planks: [number, number];
  /** How high the bottom of the box is carried, and how far its front is tipped up (degrees). */
  high: number;
  tilt: number;
  /** Its face, on the front of the box: each eye across from the middle and up the panel (shares of the box), and its size. */
  face: { apart: number; up: number; eye: number } | null;
  /** The scaly body it carries the chest on, under the box: its middle and its half-sizes, in the box's frame. */
  belly: { c: V3; r: V3 } | null;
  /** The Hoardback's head: where its neck comes out under the front of the shell, the head's half-sizes, how long its neck. */
  head: { at: V3; r: V3; neck: number } | null;
  tail: number;
  fore: Leg;
  hind: Leg;
  /** On the lid: oak sprigs, each along (-1 back to 1 front), round from the right side (radians, a quarter turn the ridge), how long. */
  sprigs: ReadonlyArray<readonly [number, number, number]>;
  /** How many patches of moss over the lid and the box. */
  moss: number;
  /** Leather straps over the lid with a brass buckle each, along (-1 to 1). */
  straps: readonly number[];
  /** A teal gem set in either side of the box; ring handles on the lid; a carry handle over its ridge. */
  gem: boolean;
  rings: boolean;
  handle: boolean;
  gait: { duty: number; swing: [number, number]; step: number; bob: number; roll: number };
  /** How big a thing it fetches is drawn (a radius). */
  item: number;
  size: number;
}

/** A Chestkit: a little treasure chest on four stubby legs, its face on its front, brass corner bands and lock plates, an oak sprig on its lid. */
const CHESTKIT_LOOK: Chest = {
  stage: 0,
  box: { w: 0.5, l: 0.46, h: 0.32, lid: 0.19, round: 0.07, bulge: 0.05 },
  bands: [0],
  band: 0.045,
  proud: 0.07,
  planks: [3, 4],
  high: 0.15,
  tilt: 0,
  face: { apart: 0.4, up: 0.6, eye: 0.13 },
  belly: null,
  head: null,
  tail: 0,
  fore: { hip: [0.44, 0.28, 0.03], len: [0.14, 0.13], at: [0.62, 0.36], foot: 0.06, toe: 0.07, toes: 3, w: 0.125, turn: 22 },
  hind: { hip: [0.44, -0.28, 0.03], len: [0.14, 0.13], at: [0.62, -0.32], foot: 0.06, toe: 0.07, toes: 3, w: 0.13, turn: 26 },
  sprigs: [[-0.7, 0.45, 0.3]],
  moss: 0,
  straps: [],
  gem: false,
  rings: false,
  handle: false,
  gait: { duty: 0.58, swing: [0.26, 0.36], step: 0.3, bob: 0.06, roll: 6 },
  item: 0.13,
  size: 4.8,
};

/** A Lootvent: a scaly body carrying a big banded chest for a shell, buckled straps, ring handles, a teal gem, moss and oak on its lid. */
const LOOTVENT_LOOK: Chest = {
  stage: 1,
  box: { w: 0.62, l: 0.7, h: 0.36, lid: 0.26, round: 0.08, bulge: 0.06 },
  bands: [-0.42, 0.36],
  band: 0.05,
  proud: 0.06,
  planks: [3, 6],
  high: 0.2,
  tilt: 0,
  face: { apart: 0.38, up: 0.6, eye: 0.14 },
  belly: { c: [0, 0.04, 0.02], r: [0.8, 0.88, 0.2] },
  head: null,
  tail: 0.2,
  fore: { hip: [0.56, 0.44, 0.02], len: [0.18, 0.16], at: [0.8, 0.54], foot: 0.08, toe: 0.1, toes: 4, w: 0.18, turn: 18 },
  hind: { hip: [0.56, -0.44, 0.02], len: [0.18, 0.16], at: [0.8, -0.48], foot: 0.08, toe: 0.1, toes: 4, w: 0.19, turn: 24 },
  sprigs: [[-0.8, 0.35, 0.36], [-0.75, 2.75, 0.32], [0.55, 2.5, 0.26]],
  moss: 5,
  straps: [-0.12],
  gem: true,
  rings: true,
  handle: false,
  gait: { duty: 0.6, swing: [0.24, 0.32], step: 0.24, bob: 0.05, roll: 5 },
  item: 0.15,
  size: 4.8,
};

/** A Hoardback: low and heavy, a tortoise's head looking out from under a huge arched chest of a shell, bronze bands and buckles, moss and oak all over it. */
const HOARDBACK_LOOK: Chest = {
  stage: 2,
  box: { w: 0.8, l: 1.12, h: 0.16, lid: 0.52, round: 0.05, bulge: 0.07 },
  bands: [-0.5, 0.05, 0.5],
  band: 0.06,
  proud: 0.05,
  planks: [1, 8],
  high: 0.22,
  tilt: 2,
  face: null,
  belly: { c: [0, 0, 0.06], r: [0.74, 1.08, 0.18] },
  head: { at: [0, 0.95, 0.2], r: [0.33, 0.42, 0.19], neck: 0.32 },
  tail: 0.3,
  fore: { hip: [0.58, 0.7, 0.04], len: [0.2, 0.19], at: [0.86, 0.9], foot: 0.11, toe: 0.13, toes: 4, w: 0.24, turn: 18 },
  hind: { hip: [0.58, -0.7, 0.04], len: [0.2, 0.19], at: [0.86, -0.74], foot: 0.11, toe: 0.13, toes: 4, w: 0.25, turn: 24 },
  sprigs: [[-0.85, 1.3, 0.42], [-0.25, 1.9, 0.38], [0.35, 1.2, 0.4], [-0.65, 0.5, 0.34]],
  moss: 30,
  straps: [-0.25, 0.28],
  gem: false,
  rings: false,
  handle: true,
  gait: { duty: 0.68, swing: [0.2, 0.26], step: 0.18, bob: 0.03, roll: 4 },
  item: 0.17,
  size: 5.8,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
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

function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}
/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Chestkit's lid snapped shut, the Lootvent's slam, the Hoardback's bite. */
export const CHEST_HITS: readonly number[] = [0.5, 0.54, 0.56];
/** When the lid flies open (the smaller two) or the head is drawn back (the Hoardback), as a share of the strike. */
export const CHEST_STRIKE = { open: 0.26 } as const;
/**
 * A go at its task, as shares of it: its two nudges at the thing in front of it, the flip that throws it up, the lid opening, the
 * thing dropping into the chest, and the lid slammed shut on it. It loops, so a go and the next are one.
 */
export const CHEST_WORK = { nudges: [0.15, 0.27] as const, flip: 0.38, open: 0.35, drop: 0.6, shut: 0.68, next: 0.86 } as const;
/** When it lifts its lid to peek out, standing about, in seconds into its loop, and for how long. */
export const CHEST_PEEKS: readonly number[] = [5.2, 16.4];
export const CHEST_PEEK_LEN = 1.8;

/* ---- where its feet go ---------------------------------------------------------------- */

/**
 * A pose: where the ball of each foot is (along the ground, from under the body's middle) and how far its heel is lifted off it
 * (degrees, toes staying down); how the body is carried; how far the lid is open (degrees); the Hoardback's head pitched up,
 * turned left and tilted, its neck pushed out (or drawn in) and its jaw open (degrees).
 */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  lid: number;
  head: [number, number, number]; neck: number; jaw: number;
}

interface Rest {
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
  heel: number[];
}

const rests = new Map<Chest, Rest>();
const legOfI = (s: Chest, i: number): Leg => (i < 2 ? s.fore : s.hind);
function restOf(s: Chest): Rest {
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

function restPlan(s: Chest, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0, lid: 0,
    head: [0, 0, 0], neck: 0, jaw: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    lid: m(a.lid, b.lid), head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])], neck: m(a.neck, b.neck), jaw: m(a.jaw, b.jaw),
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
    // The lid is its act's alone: a peek does not lift it while it is slammed.
    lid: p.lid,
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    neck: d(p.neck, to.neck, from.neck), jaw: p.jaw,
  };
}

/** How long the body is, hip to shoulder: what its moves are measured in. */
const lenOf = (s: Chest): number => s.fore.hip[1] - s.hind.hip[1];

/** The diagonals together, the left fore with the right hind. */
const TROT = [0, 0.5, 0.5, 0];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/**
 * Going: the diagonals together, each foot down for its share of a stride and swept back under the body, then lifted and
 * brought forward. The chest rocks from side to side over the feet that are down and bobs at each footfall; faster, the two
 * smaller ones' lids rattle on it. The Hoardback's steps are slow and heavy and its head nods at each.
 */
function goPlan(s: Chest, R: Rest, a: Anim, fast: number): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s);
  const p = restPlan(s, R);
  const duty = lerp(G.duty, 0.5, fast), amp = lerp(G.swing[0], G.swing[1], fast), step = G.step * (1 + 0.3 * fast);
  for (let i = 0; i < 4; i++) {
    const reach = R.reach[i], half = reach * amp * 1.6, A = R.ankle[i], ph = frac(a.u + TROT[i]);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      p.foot[i] = 14 * ramp(ph / duty, 0.7, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    const lift = step * reach * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0], y, lift];
    p.foot[i] = 14 * (1 - smooth(u / 0.6)) - 10 * hump(u, 0.75, 0.25);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.06));
  p.H += -L * G.bob * (1 + 0.6 * fast) * down;
  const over = Math.sin(TAU * (w + 0.25 - duty / 2));
  p.roll = G.roll * (1 + 0.3 * fast) * over;
  p.side = L * 0.03 * over;
  p.yaw = 3 * Math.sin(TAU * (w - 0.1));
  p.pitch = 1.5 * (down - 0.5) - 2 * fast;
  p.squash = 0.03 * (1 + fast) * hump(frac(2 * w - 0.06), 0.1, 0.2);
  // The lid knocked up off the box at each footfall, running, and dropped back on it.
  p.lid = [7, 5, 2][s.stage] * fast * Math.max(0, Math.sin(2 * TAU * (w - 0.02))) ** 2;
  p.head = [5 * (2 * down - 1), -6 * Math.sin(TAU * (w - 0.1)), -3 * over];
  p.neck = 0.04 * L * (down - 0.5);
  return p;
}

/** How much its lid is up as it peeks out, standing about, nought to one. */
function peekOf(t: number): number {
  let k = 0;
  for (const c of CHEST_PEEKS) {
    const u = (t - c) / CHEST_PEEK_LEN;
    if (u > 0 && u < 1) k = Math.max(k, ramp(u, 0, 0.2) * (1 - ramp(u, 0.8, 1)));
  }
  return k;
}

/**
 * Standing about: its lid lifted and let down a hair as it breathes, rocking a little on its feet and turning to look about;
 * twice a loop it lifts its lid a crack to peek out, and now and then it shuffles its feet and settles with a wiggle. The
 * Hoardback's head looks about.
 */
function stillPlan(s: Chest, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, L = lenOf(s);
  const look = drift(t);
  p.yaw = (s.head ? 3 : 7) * look;
  p.roll = 1.5 * cyc(t, 3);
  p.lid = 1.5 * a.breath;
  p.H += 0.01 * L * (a.breath - 0.5);
  p.head = [3 * cyc(t, 5) + 2 * a.breath, 22 * drift(t, 1.3), 4 * drift(t, 2)];
  p.neck = 0.03 * L * a.breath;
  const peek = peekOf(t);
  p.lid += [18, 15, 8][s.stage] * peek;
  p.pitch -= 2 * peek;
  // A shuffle: a wiggle from side to side as it settles its weight, a foot lifted and put down.
  const shuffle = beat(t, [10.6, 20.8], 0.9);
  p.roll += 5 * shuffle * Math.sin((t - 10.6) * 18);
  p.squash += 0.04 * shuffle;
  const shift = beat(t, [12.4], 1);
  if (shift > 0) {
    const A = R.ankle[0];
    p.at[0] = [A[0] - 0.05 * L * shift, A[1] + 0.04 * L * shift, R.reach[0] * 0.25 * Math.sin(Math.PI * clamp(((t - 12.4) / 1) * 2))];
    p.roll += 2 * shift;
  }
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Chestkit's snap: drawn back on its haunches with its lid flung open, a hop forward, and the lid snapped shut on what is in front of it. */
function snapPlan(s: Chest, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = CHEST_HITS[0], L = lenOf(s);
  const back = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.32, 0.42));
  const lunge = ramp(t, 0.32, hit) * (1 - ramp(t, 0.66, 0.96));
  const air = hump(t, 0.41, 0.09), jolt = hump(t, hit + 0.03, 0.06);
  p.surge = L * (-0.25 * back + 0.75 * lunge);
  p.H += L * (-0.08 * back + 0.35 * air);
  p.pitch = 14 * back + 6 * air - 8 * jolt;
  p.squash = 0.06 * back - 0.04 * air + 0.12 * jolt;
  p.lid = 64 * ramp(t, CHEST_STRIKE.open, 0.36) * (1 - ramp(t, hit - 0.06, hit));
  for (let i = 0; i < 4; i++) {
    const A = R.ankle[i], fore = i < 2, fwd: V3 = [A[0], A[1] + L * 0.75, 0];
    const go = ramp(t, 0.34 + (fore ? 0 : 0.04), hit + (fore ? 0 : 0.04)), ret = ramp(t, 0.66 + 0.05 * i, 0.94);
    p.at[i] = t < 0.62 ? arc(A, fwd, go, R.reach[i] * 0.4) : arc(fwd, A, ret, R.reach[i] * 0.25);
    if (!fore) p.foot[i] = 30 * back;
  }
  return p;
}

/** The Lootvent's slam: reared up on its hind legs with its lid gaping, then down on its forefeet with the lid crashed shut. */
function slamPlan(s: Chest, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = CHEST_HITS[1], L = lenOf(s);
  const rear = ramp(t, 0.06, 0.4) * (1 - ramp(t, 0.42, hit));
  const down = ramp(t, 0.44, hit) * (1 - ramp(t, hit + 0.14, 0.96));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.12 * rear + 0.3 * down);
  p.H += L * (0.16 * rear - 0.06 * down);
  p.pitch = 24 * rear - 6 * down;
  p.squash = -0.03 * rear + 0.16 * jolt;
  p.lid = 55 * ramp(t, CHEST_STRIKE.open, 0.4) * (1 - ramp(t, hit - 0.06, hit)) + 8 * hump(t, hit + 0.08, 0.06);
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0] * 0.95, A[1] + L * 0.1, R.reach[i] * 0.9], land: V3 = [A[0] * 1.05, A[1] + L * 0.32, 0];
    if (t < hit) p.at[i] = t < 0.42 ? mixV(A, high, ramp(t, 0.08, 0.38)) : mixV(high, land, ramp(t, 0.42, hit - 0.01) ** 1.5);
    else p.at[i] = arc(land, A, ramp(t, 0.72 + 0.06 * i, 0.94), R.reach[i] * 0.2);
    p.foot[i] = -10 * rear;
  }
  for (const i of [2, 3]) p.foot[i] = 24 * rear;
  return p;
}

/** The Hoardback's bite: its head drawn back under its shell, then shot out with its beak open and snapped shut, its whole weight lurching after it. */
function bitePlan(s: Chest, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = CHEST_HITS[2], L = lenOf(s);
  const back = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, 0.46));
  const out = ramp(t, 0.38, hit) * (1 - ramp(t, 0.7, 0.98));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.05 * back + 0.08 * out);
  p.H += L * (-0.04 * back + 0.02 * out);
  p.pitch = 4 * back - 4 * out;
  p.neck = L * (-0.2 * back + 0.24 * out);
  p.head = [10 * back - 6 * out + 8 * jolt, 0, 0];
  p.jaw = 34 * ramp(t, 0.36, hit - 0.06) * (1 - ramp(t, hit - 0.04, hit));
  p.squash = 0.05 * jolt;
  p.lid = 5 * hump(t, hit + 0.05, 0.08);
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0] * 1.04, A[1] + L * 0.12, 0];
    p.at[i] = t < 0.66 ? arc(A, fwd, ramp(t, 0.4 + 0.06 * i, hit + 0.06 * i), R.reach[i] * 0.35) : arc(fwd, A, ramp(t, 0.72 + 0.08 * i, 0.96), R.reach[i] * 0.25);
  }
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));
/** How far the lid is open through a go at its task, nought to one. */
const lidOf = (t: number): number => ramp(t, CHEST_WORK.open, CHEST_WORK.open + 0.1) * (1 - ramp(t, CHEST_WORK.shut - 0.06, CHEST_WORK.shut));

/**
 * A go at its task: tipped forward over the thing in front of it, it noses it twice; then it rocks back, flipping it up into the
 * air, its lid swinging open; the thing drops into the chest and the lid is slammed shut on it with a jolt and a little hop, and
 * it wiggles, pleased, and tips forward again over the next. The Hoardback bows its head down to it and noses it with its beak,
 * then tosses it back over its head into its shell.
 */
function workPlan(s: Chest, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s), W = CHEST_WORK;
  const nudge = hump(t, W.nudges[0], 0.05) + hump(t, W.nudges[1], 0.05);
  const bow = ramp(t, 0.0, 0.1) * (1 - ramp(t, W.flip - 0.04, W.flip + 0.02)) + ramp(t, W.next - 0.02, 1);
  const flip = hump(t, W.flip + 0.02, 0.08), slam = hump(t, W.shut + 0.02, 0.05), wiggle = hump(t, 0.8, 0.1);
  if (s.head) {
    p.pitch = -5 * bow + 2 * flip;
    p.head = [-44 * bow + 56 * flip + 6 * slam, 0, 6 * wiggle * Math.sin(t * 50)];
    p.neck = L * (0.06 * bow + 0.06 * nudge - 0.04 * flip);
    p.jaw = 10 * flip;
    p.surge = L * 0.03 * nudge;
  } else {
    p.pitch = -16 * bow - 4 * nudge + 14 * flip;
    p.surge = L * (0.06 * bow + 0.08 * nudge - 0.04 * flip);
    p.H -= L * 0.06 * bow - L * 0.1 * flip;
  }
  p.lid = [64, 58, 34][s.stage] * lidOf(t) + 8 * hump(t, W.shut + 0.05, 0.04);
  p.squash = 0.12 * slam + 0.04 * nudge;
  p.H += L * 0.05 * hump(t, W.shut + 0.07, 0.06);
  p.roll = 5 * wiggle * Math.sin(t * 40);
  for (let i = 0; i < 4; i++) {
    // The fore feet hop off the ground as it flips the thing up; then it stamps.
    if (i < 2) {
      const A = R.ankle[i];
      p.at[i] = [A[0], A[1] + L * 0.04 * bow, R.reach[i] * 0.3 * hump(t, W.flip + 0.02, 0.06)];
      p.foot[i] = -8 * flip;
    } else p.foot[i] = 10 * bow;
  }
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched down small as the light gathers, then up tall at the turn with its lid flung open, a shake, and settled. */
function evolvePlan(s: Chest, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.06 * hunch + 0.1 * up);
  p.pitch = -4 * hunch + 10 * up;
  p.roll = 5 * shake;
  p.squash = 0.1 * hunch - 0.04 * up + 0.08 * hump(t, 0.72, 0.05);
  p.lid = [55, 45, 24][s.stage] * up;
  p.head = [-10 * hunch + 16 * up, 6 * shake, 10 * shake];
  p.neck = L * (-0.15 * hunch + 0.1 * up);
  p.jaw = 14 * up;
  for (const i of [2, 3]) p.foot[i] = 20 * up;
  return p;
}

/** How much of a leg's reach any foot may take before the body is let down to it. */
const MOST_REACH = 0.94;

function footHeading(i: number, L: Leg): V3 {
  const a = SIDE[i] * -L.turn * DEG;
  return [-Math.sin(a), Math.cos(a), 0];
}
function heelOf(s: Chest, R: Rest, i: number, at: V3, lift: number): V3 {
  const L = legOfI(s, i), h = footHeading(i, L), F = L.foot, c = Math.cos(lift * DEG), sn = Math.sin(lift * DEG);
  return [at[0] - h[0] * F * c, at[1] - h[1] * F * c, at[2] + R.heel[i] + F * sn];
}

/** The body let down until every foot that is down can reach the ground, and any foot still out of reach drawn in to it. */
function seated(s: Chest, R: Rest, p: Plan): Plan {
  let drop = 0;
  const body = joint(ROOT, [p.side, p.surge, p.H], s.tilt + p.pitch, p.roll, p.yaw);
  const at = p.at.map((x) => [...x] as V3);
  for (let i = 0; i < 4; i++) {
    const hip = place(body, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), flat = d[0] * d[0] + d[1] * d[1], up = -d[2];
    if (flat + up * up <= L * L) continue;
    const need = up - Math.sqrt(Math.max(0, L * L - flat)), k = 1 - smooth(at[i][2] / (0.2 * R.reach[i]));
    drop = Math.max(drop, need * k);
  }
  const H = p.H - Math.max(0, drop);
  const body2 = joint(ROOT, [p.side, p.surge, H], s.tilt + p.pitch, p.roll, p.yaw);
  for (let i = 0; i < 4; i++) {
    const hip = place(body2, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), D = len3(d);
    if (D > L) at[i] = add(at[i], scale(d, L / D - 1));
  }
  return { ...p, at, H };
}

function posedOf(s: Chest, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([snapPlan, slamPlan, bitePlan][s.stage](s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0.1, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goPlan(s, R, a, smooth(clamp(a.gait)));
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** A leg bent to put its heel (or wrist) at `ankle`: the elbow back and out, the knee forward and out, always the same way round. */
function legOf(s: Chest, R: Rest, body: Xf, i: number, ankle: V3, heading: V3, lift: number): [Xf, Xf, Xf] {
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

/** The lid's hinge: along the top of the back of the box. */
const hingeOf = (s: Chest): V3 => [0, -s.box.l * endScale(s), s.box.h];
/** Where the thing it fetches lies, in front of it, on the ground. */
function itemSpot(s: Chest): V3 {
  if (s.head) return [0, s.head.at[1] + s.head.neck + s.head.r[1] * 1.1 + s.item, 0];
  return [0, s.box.l * endScale(s) + s.item * 1.25 + 0.04, 0];
}

function chestBones(s: Chest): (a: Anim) => Bones {
  const R = restOf(s);
  return (a) => {
    const P = seated(s, R, posedOf(s, R, { ...a, go: a.act ? 0 : a.go }));
    const body = joint(ROOT, [P.side, P.surge, P.H], s.tilt + P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    b.lid = joint(b.trunk, hingeOf(s), P.lid);
    if (s.head) {
      const H = s.head;
      // The neck bows and turns half as far as the head does, and the head the rest on the end of it; pushed out or drawn in,
      // the neck is drawn out or shortened to reach it.
      const neck = joint(body, [0, H.at[1], H.at[2]], P.head[0] * 0.55, 0, P.head[1] * 0.5), k = (H.neck + P.neck) / H.neck;
      b.head = joint(neck, [0, H.neck + P.neck, 0], P.head[0] * 0.45, P.head[2], P.head[1] * 0.5);
      b.jaw = joint(b.head, jawHinge(s), -P.jaw);
      const m = neck.m;
      b.neck = { m: [m[0], m[1] * k, m[2], m[3], m[4] * k, m[5], m[6], m[7] * k, m[8]], t: neck.t };
    }
    for (let i = 0; i < 4; i++) {
      const L = legOfI(s, i), g = P.at[i];
      const heading = footHeading(i, L);
      const heel = heelOf(s, R, i, [g[0], g[1], Math.max(0, g[2])], P.foot[i]);
      const [u, l, f] = legOf(s, R, body, i, heel, heading, P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    if (s.tail) b.tail = joint(body, [0, -(s.belly ? s.belly.r[1] * 0.92 : s.box.l), (s.belly ? s.belly.c[2] : 0.05)], -10 + 6 * Math.sin(a.t * 2), 0, 8 * Math.sin(a.t * 1.3));
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    // The thing it fetches: lying in front of it, nosed along, flipped up over its front into its open chest, and gone into it;
    // then the next, lying where the last was. Foraging in the wild it noses the ground with nothing there.
    if (a.act?.kind === 'work') {
      const t = a.act.t, W = CHEST_WORK;
      const there = smooth((downOf(t, a.graze) - 0.05) / 0.4);
      const back = ramp(t, W.next, W.next + 0.08);
      const gone = t > W.drop + 0.02 && t < W.next;
      if (there > 0.01 && !gone) {
        const r = s.item, spot = itemSpot(s);
        const nudged = add(spot, [0, lenOf(s) * 0.05 * (ramp(t, W.nudges[0] - 0.02, W.nudges[0] + 0.03) + ramp(t, W.nudges[1] - 0.02, W.nudges[1] + 0.03)), r * 0.82]);
        const u = clamp((t - W.flip) / (W.drop - W.flip));
        let p = nudged, spin = 0;
        if (u > 0) {
          // Up over the front of the box in an arc and down into it, turning over as it goes.
          const top = place(b.trunk, [0, -s.box.l * 0.1, s.box.h + (s.head ? s.box.lid * 0.2 : 0.02)]);
          const peak: V3 = [(nudged[0] + top[0]) / 2, (nudged[1] + top[1]) / 2, Math.max(nudged[2], top[2]) + s.box.lid * 1.6 + r * 2];
          const e = u, f = 1 - e;
          p = [f * f * nudged[0] + 2 * f * e * peak[0] + e * e * top[0], f * f * nudged[1] + 2 * f * e * peak[1] + e * e * top[1], f * f * nudged[2] + 2 * f * e * peak[2] + e * e * top[2]];
          spin = -300 * u;
        }
        const g = there * (t >= W.next ? back : 1);
        b.item = joint({ m: [g, 0, 0, 0, g, 0, 0, 0, g], t: p }, [0, 0, 0], spin, 0, 20);
      }
    }
    return b;
  };
}

/* ---- the chest ---------------------------------------------------------------------------------- */

/** A station along the chest where its outline is drawn: how far along, how much bigger than the plain wood, and whether brass. */
interface Station { y: number; s: number; brass: boolean }

const proudOf = (s: Chest): number => 1 + s.proud;
const fullOf = (s: Chest, y: number): number => 1 + s.box.bulge * (1 - (y / s.box.l) ** 2);
/** How much bigger the outline is at either end, where it is banded. */
const endScale = (s: Chest): number => fullOf(s, s.box.l) * proudOf(s);

/** The stations along the chest: brass at either end and at each band, wood between, each wood gap drawn through its middle too. */
function stationsOf(s: Chest): Station[] {
  const L = s.box.l, bw = s.band, P = proudOf(s);
  const brass: Array<[number, number]> = [[-L, -L + 2 * bw], ...s.bands.map((f): [number, number] => [f * L - bw, f * L + bw]), [L - 2 * bw, L]];
  const out: Station[] = [];
  brass.forEach(([a, b], q) => {
    out.push({ y: a, s: fullOf(s, a) * P, brass: true }, { y: b, s: fullOf(s, b) * P, brass: true });
    const next = brass[q + 1];
    if (!next) return;
    const m = (b + next[0]) / 2;
    out.push({ y: b, s: fullOf(s, b), brass: false }, { y: m, s: fullOf(s, m), brass: false }, { y: next[0], s: fullOf(s, next[0]), brass: false });
  });
  return out;
}

/** The box's outline across it, from the top of its right side down, round its lower corners and up its left side: the top is open. */
function boxOutline(s: Chest): Array<[number, number]> {
  const { w, h, round: r } = s.box, out: Array<[number, number]> = [];
  out.push([w, h]);
  for (const z of [0.66, 0.33]) if (h * z > r) out.push([w, h * z]);
  for (let q = 0; q <= 3; q++) { const a = -(q / 3) * (Math.PI / 2); out.push([w - r + r * Math.cos(a), r + r * Math.sin(a)]); }
  for (let q = 0; q <= 3; q++) { const a = -Math.PI / 2 - (q / 3) * (Math.PI / 2); out.push([-w + r + r * Math.cos(a), r + r * Math.sin(a)]); }
  for (const z of [0.33, 0.66]) if (h * z > r) out.push([-w, h * z]);
  out.push([-w, h]);
  return out;
}
/** The lid's arch across it, from its right foot over to its left. */
function lidOutline(s: Chest, n: number): Array<[number, number]> {
  const { w, h, lid } = s.box;
  return Array.from({ length: n + 1 }, (_, q) => { const a = (q / n) * Math.PI; return [w * Math.cos(a), h + lid * Math.sin(a)] as [number, number]; });
}

/** A point of the box's outline at a station, grown by its size outward from the top of the box (the lid's from its foot). */
const onBox = (s: Chest, x: number, z: number, k: number, y: number): V3 => [x * k, y, s.box.h - (s.box.h - z) * k];
const onLid = (s: Chest, x: number, z: number, k: number, y: number): V3 => [x * k, y, s.box.h + (z - s.box.h) * k];

/**
 * A shape across the chest run along it through its stations: the wood between the bands, each band standing proud of it with a
 * step at either edge, and capped at either end; `close` joins its last corner back to its first (the lid's flat underside, or
 * the box's open top). Returns it with the way to a point on it.
 */
function runAlong(s: Chest, outline: Array<[number, number]>, put: typeof onBox, close: boolean, matOf: (j: number, brass: boolean) => Mat, ends: [Mat, Mat]): Mesh {
  const S = stationsOf(s), n = outline.length, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const mid: [number, number] = [0, s.box.h + (put === onLid ? s.box.lid * 0.4 : -s.box.h * 0.5)];
  for (const st of S) for (const [x, z] of outline) v.push(put(s, x, z, st.s, st.y));
  const edges = close ? n : n - 1;
  for (let k = 0; k < S.length - 1; k++) {
    const A = S[k], B = S[k + 1], step = Math.abs(A.y - B.y) < 1e-6;
    for (let j = 0; j < edges; j++) {
      const j2 = (j + 1) % n, i = [k * n + j, k * n + j2, (k + 1) * n + j2, (k + 1) * n + j];
      const c = scale(i.reduce((t, q) => add(t, v[q]), [0, 0, 0] as V3), 0.25);
      if (step) {
        f.push({ i, m: 'metalDark' });
        want.push([0, A.s < B.s ? -1 : 1, 0]);
      } else {
        f.push({ i, m: matOf(j, A.brass && B.brass) });
        // The open top of the box faces up, and the lid's underside down; the rest out from the middle of the shape.
        want.push(close && j === n - 1 ? [0, 0, put === onLid ? -1 : 1] : [c[0], 0, c[2] - mid[1]]);
      }
    }
  }
  const last = (S.length - 1) * n;
  f.push({ i: Array.from({ length: n }, (_, j) => j), m: ends[0] });
  want.push([0, -1, 0]);
  f.push({ i: Array.from({ length: n }, (_, j) => last + j), m: ends[1] });
  want.push([0, 1, 0]);
  return mesh(v, woundTo(v, f, want));
}

/** A thin painted line along the surface between two stations: a plank's edge, a groove. */
function seam(a: V3, b: V3, n: V3, w: number, m: Mat): Disc {
  const d = unit(sub(b, a)), side = scale(unit(cross(n, d)), w), lift = scale(n, 0.012);
  return facing([add(add(a, side), lift), add(add(b, side), lift), add(sub(b, side), lift), add(sub(a, side), lift)], n, m);
}

/**
 * How much shorter up and down a thing painted on an upright face is drawn than across, so that it is round on the screen: the
 * island draws heights at twice the scale it draws lengths along the ground.
 */
const UPRIGHT = 0.5;
/** A round painted thing on the surface, facing out along `n`: a rivet, a coin, a spot. */
const dot2 = (c: V3, n: V3, r: number, m: Mat, sides = 6, lit?: boolean): Disc =>
  disc(add(c, scale(n, 0.014)), n, r, Math.abs(n[2]) > 0.9 ? r : r * lerp(UPRIGHT, 1, Math.abs(n[2])), sides, m, { up: Math.abs(n[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1], lit });

/** Where a point on the lid's arch is (box frame), `y` along it and `a` round from the right side, and the way out of it there. */
function lidAt(s: Chest, y: number, a: number, k = fullOf(s, y)): { p: V3; n: V3 } {
  const { w, h, lid } = s.box;
  return { p: [w * k * Math.cos(a), y, h + lid * k * Math.sin(a)], n: unit([Math.cos(a) / w, 0, Math.sin(a) / lid]) };
}
/** Where a point on the right side of the box is, `y` along it and `z` up it (left with `sd` -1). */
function sideAt(s: Chest, y: number, z: number, sd: number, k = fullOf(s, y)): { p: V3; n: V3 } {
  return { p: [sd * s.box.w * k, y, s.box.h - (s.box.h - z) * k], n: [sd, 0, 0] };
}

/** The wood gaps between bands, along the chest. */
function gapsOf(s: Chest): Array<[number, number]> {
  const S = stationsOf(s), out: Array<[number, number]> = [];
  for (let k = 0; k < S.length - 1; k++) if (!S[k].brass && !S[k + 1].brass && S[k].y < S[k + 1].y) out.push([S[k].y, S[k + 1].y]);
  // Joined up, each gap from band to band.
  const joined: Array<[number, number]> = [];
  for (const g of out) {
    const last = joined[joined.length - 1];
    if (last && Math.abs(last[1] - g[0]) < 1e-6) last[1] = g[1];
    else joined.push([g[0], g[1]]);
  }
  return joined;
}

/**
 * The box: oak planks run along its sides, the brass bands standing proud round it, each riveted; its open top dark inside, with
 * gold in it, which shows when the lid is up. Its front is its face (the smaller two): a honey-coloured panel framed in brass,
 * two big dark eyes with a glint in each and a small smile; or, on the Hoardback, the dark of the shell's mouth that its head
 * comes out of. A brass lock plate on either side, at the top.
 */
function boxOf(s: Chest, shut: boolean): Mesh {
  const out = boxOutline(s), B = s.box;
  const front: Mat = s.face ? 'coat' : 'inner';
  const solid = runAlong(s, out, onBox, true, (j, brass) => (j === out.length - 1 ? 'coatDark' : brass ? 'metal' : 'coat'), ['coat', front]);
  const decals: Disc[] = [];
  const E = endScale(s), L = B.l;
  // The planks' edges, along each side, and the brass rivets on each band down the sides.
  for (const [a, b] of gapsOf(s)) {
    for (let q = 1; q < s.planks[0]; q++) {
      const z = (B.h * q) / s.planks[0];
      for (const sd of [1, -1]) {
        const p0 = sideAt(s, a + 0.01, z, sd), p1 = sideAt(s, (a + b) / 2, z, sd), p2 = sideAt(s, b - 0.01, z, sd);
        decals.push(seam(p0.p, p1.p, p0.n, 0.011, 'coatDark'), seam(p1.p, p2.p, p0.n, 0.011, 'coatDark'));
      }
    }
  }
  const bandYs = [-L + s.band, ...s.bands.map((f) => f * L), L - s.band];
  for (const y of bandYs) for (const sd of [1, -1]) for (const z of [0.25, 0.75]) {
    const q = sideAt(s, y, B.h * z, sd, fullOf(s, y) * proudOf(s));
    decals.push(dot2(q.p, q.n, s.band * 0.38, 'metalLit'));
  }
  // The open top, seen when the lid is up: a dark well inside a rim of wood, and coins and a gem in it.
  const inside: V3[] = [[B.w * 0.86, -L * 0.9, B.h], [B.w * 0.86, L * 0.9, B.h], [-B.w * 0.86, L * 0.9, B.h], [-B.w * 0.86, -L * 0.9, B.h]];
  decals.push(facing(inside.map((p) => add(p, [0, 0, 0.005])), [0, 0, 1], 'inner'));
  for (let q = 0; q < 9; q++) {
    const x = (jitter(q * 3 + s.stage) - 0.5) * 1.5 * B.w, y = (jitter(q * 5 + 1 + s.stage) - 0.5) * 1.6 * L;
    decals.push(dot2([x, y, B.h + 0.01], [0, 0, 1], 0.05 + 0.03 * jitter(q + 7), q === 4 ? 'gem' : 'bloom', 7, q % 3 === 0));
  }
  // The front.
  const fy = L + 0.004, n: V3 = [0, 1, 0];
  // The panel inside the brass round the front, as far in from its edge at the top and bottom as at the sides.
  const fw = B.w * E * 0.13, frame = out.map(([x, z]) => [x * E - Math.sign(x) * fw, fy, lerp(fw * UPRIGHT * 1.4, B.h - fw * UPRIGHT * 1.4, z / B.h)] as V3);
  if (s.face) {
    // The panel inside a brass frame, the frame riveted at its corners.
    decals.push(facing(frame.map((p) => [p[0], p[1] + 0.004, p[2]] as V3), n, 'muzzle'));
    for (const [x, z] of [[0.9, 0.9], [-0.9, 0.9], [0.9, 0.12], [-0.9, 0.12]]) decals.push(dot2([x * B.w * E, fy + 0.006, B.h * z], n, 0.022 * (1 + s.stage * 0.3), 'metalLit'));
    decals.push(...faceOf(s, shut, fy + 0.008));
  } else {
    // The shell's mouth: dark inside its rim.
    decals.push(facing(frame.map((p) => [p[0], p[1] + 0.004, p[2]] as V3), n, 'inner'));
  }
  // The lock plates, on either side at the top: a brass plate with a dark keyhole, its hasp coming down from the lid.
  for (const sd of [1, -1]) {
    const y = s.bands.length > 1 ? (s.bands[0] + s.bands[1]) * 0.5 * L : L * 0.5, q = sideAt(s, y, B.h * 0.72, sd);
    const pw = B.h * 0.2, ph = B.h * 0.24, c = q.p;
    decals.push(facing([add(c, [0, -pw, ph]), add(c, [0, pw, ph]), add(c, [0, pw * 0.8, -ph]), add(c, [0, -pw * 0.8, -ph])].map((p) => add(p, [sd * 0.014, 0, 0])), q.n, 'metal'));
    decals.push(facing([add(c, [0, -0.012, 0.01]), add(c, [0, 0.012, 0.01]), add(c, [0, 0.008, -ph * 0.55]), add(c, [0, -0.008, -ph * 0.55])].map((p) => add(p, [sd * 0.022, 0, 0])), q.n, 'inner'));
    decals.push(dot2(add(c, [sd * 0.008, 0, ph * 0.12]), q.n, pw * 0.22, 'inner', 6));
    if (s.gem) {
      // A teal gem in a brass setting, low on the side, toward the back.
      const gq = sideAt(s, -L * 0.1, B.h * 0.36, sd);
      decals.push(dot2(gq.p, gq.n, B.h * 0.26, 'metalDark', 8), dot2(add(gq.p, [sd * 0.004, 0, 0]), gq.n, B.h * 0.19, 'gem', 8), dot2(add(gq.p, [sd * 0.008, -0.03, 0.02]), gq.n, B.h * 0.06, 'glint', 5, true));
    }
  }
  // Moss over the box's lower sides.
  if (s.moss) for (let q = 0; q < Math.round(s.moss / 3); q++) {
    const sd = q % 2 ? 1 : -1, y = (jitter(q * 7 + 40) - 0.5) * 1.6 * L, z = B.h * (0.1 + 0.35 * jitter(q * 7 + 41)), k = B.h * (0.18 + 0.12 * jitter(q + 42));
    const c = sideAt(s, y, z, sd);
    decals.push(disc(add(c.p, [sd * 0.016, 0, 0]), c.n, k * 1.4, k * 0.8, 8, 'moss', { spin: jitter(q + 43) }));
  }
  return merge(solid, paint(decals));
}

/** The face on the front of the box: two big dark round eyes with olive in them and glints, a little nose, and a small smile. */
function faceOf(s: Chest, shut: boolean, fy: number): Disc[] {
  const F = s.face!, B = s.box, n: V3 = [0, 1, 0], out: Disc[] = [], r = F.eye, v = UPRIGHT * 0.95;
  const ez = B.h * F.up;
  for (const sd of [1, -1]) {
    const c: V3 = [sd * B.w * F.apart, fy, ez];
    if (shut) {
      out.push(disc(add(c, [0, 0.004, -r * 0.2 * v]), n, r * 1.05, r * 0.22 * v, 8, 'lid'));
      continue;
    }
    out.push(disc(c, n, r * 1.06, r * 1.1 * v, 14, 'lid'));
    out.push(disc(add(c, [0, 0.002, -r * 0.04 * v]), n, r * 0.96, r * 1.0 * v, 14, 'featherDark'));
    out.push(disc(add(c, [0, 0.004, r * 0.06 * v]), n, r * 0.8, r * 0.84 * v, 12, 'eye'));
    out.push(disc(add(c, [r * 0.3, 0.006, r * 0.36 * v]), n, r * 0.32, r * 0.32 * v, 6, 'glint', { lit: true }));
    out.push(disc(add(c, [-r * 0.3, 0.006, -r * 0.42 * v]), n, r * 0.13, r * 0.13 * v, 5, 'glint', { lit: true }));
  }
  // The nose, a small round knot of darker wood, and the smile under it.
  out.push(disc([0, fy, ez - r * 0.85 * v], n, r * 0.24, r * 0.18 * v, 7, 'nose'));
  const pts: V3[] = [];
  for (let q = 0; q <= 8; q++) {
    const x = (q / 8) * 2 - 1, z = -0.55 * (1 - x * x);
    pts.push([x * r * 0.7, fy + 0.002, ez - r * 1.25 * v + z * r * 0.6 * v]);
  }
  const band = [...pts.map((p) => add(p, [0, 0, r * 0.08 * v])), ...[...pts].reverse().map((p) => add(p, [0, 0, -r * 0.08 * v]))];
  out.push(facing(band, n, 'nose'));
  return out;
}

/**
 * The lid: oak planks over its arch, the bands going on over it from the box, riveted, with the brass hasp coming down each side;
 * its underside dark wood, seen when it is up. Moss over it as the stage has, straps buckled over it, ring handles or a carry
 * handle on top.
 */
function lidOf3(s: Chest, n: number): { lid: Mesh; growth: Mesh } {
  const out = lidOutline(s, n), B = s.box, L = B.l, hg = hingeOf(s);
  const solid = runAlong(s, out, onLid, true, (j, brass) => (j === out.length - 1 ? 'coat' : brass ? 'metal' : 'coat'), ['coat', s.face ? 'coat' : 'metal']);
  const decals: Disc[] = [], parts: Mesh[] = [];
  const P = s.planks[1];
  for (const [a, b] of gapsOf(s)) {
    for (let q = 1; q < P; q++) {
      const ang = (q / P) * Math.PI, p0 = lidAt(s, a + 0.01, ang), p1 = lidAt(s, (a + b) / 2, ang), p2 = lidAt(s, b - 0.01, ang);
      decals.push(seam(p0.p, p1.p, p0.n, 0.011, 'coatDark'), seam(p1.p, p2.p, p0.n, 0.011, 'coatDark'));
    }
  }
  // Rivets along each band over the arch.
  const bandYs = [-L + s.band, ...s.bands.map((f) => f * L), L - s.band];
  for (const y of bandYs) for (let q = 1; q < 6; q++) {
    const e = lidAt(s, y, (q / 6) * Math.PI, fullOf(s, y) * proudOf(s));
    decals.push(dot2(e.p, e.n, s.band * 0.36, 'metalLit'));
  }
  // The front of the lid, the smaller two's: a panel of wood inside the brass, and a rivet in the middle of it.
  const E = endScale(s), fy = L + 0.004;
  if (s.face) {
    decals.push(facing(out.map(([x, z]) => onLid(s, x, z, E * 0.84, fy + 0.004)).map((p, q, all) => (q === 0 || q === all.length - 1 ? [p[0], p[1], p[2] + B.lid * 0.08] as V3 : p)), [0, 1, 0], 'coatLight'));
  } else {
    decals.push(facing(out.map(([x, z]) => onLid(s, x, z, E * 0.86, fy + 0.004)), [0, 1, 0], 'inner'));
  }
  // The hasp on either side, hanging down over the top of the lock plate.
  for (const sd of [1, -1]) {
    const y = s.bands.length > 1 ? (s.bands[0] + s.bands[1]) * 0.5 * L : L * 0.5, e = lidAt(s, y, sd > 0 ? 0.35 : Math.PI - 0.35);
    const w = B.h * 0.09;
    parts.push(tube([add(e.p, [-sd * 0.02, 0, 0.02]), add(e.p, [sd * 0.02, 0, -B.lid * 0.2]), [sd * B.w * fullOf(s, y) * 1.03, y, B.h - B.h * 0.1]], [w, w, w * 0.9], 0.018, 4, 'metal', { up: [sd, 0, 0] }));
  }
  // Moss over the lid, and oak sprigs.
  for (let q = 0; q < s.moss; q++) {
    const y = (jitter(q * 11 + 3) - 0.5) * 1.8 * L, a = 0.3 + (Math.PI - 0.6) * jitter(q * 11 + 4), k = (0.08 + 0.07 * jitter(q * 11 + 5)) * (1 + s.stage * 0.6);
    mossOn(s, y, a, k, 300 + q * 17, decals);
  }
  const growth: Mesh[] = [];
  s.sprigs.forEach(([f, a, len], q) => {
    const e = lidAt(s, f * L, a);
    growth.push(sprig(add(e.p, scale(e.n, -0.02)), e.n, len, 70 + q * 13 + s.stage * 5));
  });
  if (s.stage === 2) {
    // Tufts of moss along its ridge, between the sprigs.
    for (let q = 0; q < 5; q++) {
      const y = lerp(-0.8, 0.75, q / 4) * L, a = Math.PI / 2 + (jitter(q + 50) - 0.5) * 0.9, e = lidAt(s, y, a);
      growth.push(orb(add(e.p, scale(e.n, 0.02)), [0.11 + 0.05 * jitter(q + 51), 0.13, 0.06], 6, 3, q % 2 ? 'moss' : 'leaf'));
    }
  }
  // Leather straps over the arch, each with its brass buckle on the right side.
  for (const f of s.straps) {
    const y = f * L, pts = Array.from({ length: 9 }, (_, q) => lidAt(s, y, (q / 8) * Math.PI, fullOf(s, y) * 1.035).p);
    parts.push(tube(pts, s.band * 0.85, 0.016, 4, 'leather', { up: [0, 1, 0] }));
    const bq = lidAt(s, y, 0.75, fullOf(s, y) * 1.06);
    parts.push(orbAlong(bq.p, bq.n, [s.band * 1.25, s.band * 1.05, 0.03], 6, 3, 'metal'));
    parts.push(paint([dot2(add(bq.p, scale(bq.n, 0.02)), bq.n, s.band * 0.55, 'leatherDark', 6)]));
  }
  // Two brass ring handles on top, standing up off their plates, one either side of the ridge.
  if (s.rings) for (const sd of [1, -1]) {
    const e = lidAt(s, -L * 0.15, Math.PI / 2 - sd * 0.55), r = B.lid * 0.42;
    const ring = Array.from({ length: 9 }, (_, q) => {
      const a = (q / 8) * TAU;
      return add(e.p, add(scale([0, 1, 0], Math.sin(a) * r), scale(e.n, r * (1 - Math.cos(a)) * 0.9 + 0.02)));
    });
    parts.push(tube(ring, 0.04, 0.04, 5, 'metal'));
    parts.push(paint([dot2(e.p, e.n, r * 0.4, 'metalDark', 7)]));
  }
  // The Hoardback's carry handle over its ridge: a brass bar on two posts.
  if (s.handle) {
    const y0 = -L * 0.28, y1 = L * 0.28, top = B.h + B.lid * fullOf(s, 0) * proudOf(s);
    parts.push(tube([[0, y0, top - 0.04], [0, y0, top + 0.16], [0, y0 * 0.6, top + 0.24], [0, y1 * 0.6, top + 0.24], [0, y1, top + 0.16], [0, y1, top - 0.04]], 0.045, 0.045, 5, 'metal'));
    for (const y of [y0, y1]) parts.push(orb([0, y, top + 0.01], [0.09, 0.07, 0.04], 6, 3, 'metalDark'));
  }
  const lid = merge(solid, paint(decals), ...parts);
  // Built in the box's frame, put in the hinge's.
  const toHinge = (m: Mesh): Mesh => mesh(m.v.map((p) => sub(p, hg)), m.f);
  return { lid: toHinge(lid), growth: toHinge(merge(...growth)) };
}

/** An oak sprig: a little stem standing out of the wood and a bunch of lobed oak leaves spread from it, a few turned peach with autumn. */
function sprig(root: V3, out: V3, len: number, id: number): Mesh {
  const up = unit(add(unit(out), [0, -0.1, 0.7])), e1 = unit(cross(up, [0, 1, 0.01])), e2 = cross(up, e1);
  const top = add(root, scale(up, len * 0.4));
  const parts: Mesh[] = [tube([root, add(root, scale(up, len * 0.2)), top], [0.022, 0.017, 0.011], [0.022, 0.017, 0.011], 4, 'stem')];
  const leaves = 4;
  for (let q = 0; q < leaves; q++) {
    const a = (q / leaves) * TAU + jitter(id + q) * 0.8, rise = q === 0 ? 1.6 : 0.45 + 0.4 * jitter(id + q * 5);
    const d = unit(add(scale(up, rise), add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a)))));
    const at = mixV(root, top, q === 0 ? 1 : 0.45 + 0.55 * jitter(id + q * 7));
    const l = len * (0.5 + 0.25 * jitter(id + q * 3));
    // A lobed leaf: wide and narrow by turns along it, round at its tip, its tip drooping a little.
    const pts = curve(at, add(add(at, scale(d, l * 0.5)), scale(up, l * 0.12)), add(add(at, scale(d, l)), scale(up, -l * 0.08)), 4);
    const widths = [0.02, 0.36, 0.24, 0.38, 0.08].map((x) => x * l * 0.75);
    const face = unit(sub(up, scale(d, dot(up, d))));
    const tone = jitter(id + q * 11);
    parts.push(blade(pts, widths, face, { mat: tone < 0.3 ? 'petal' : tone < 0.6 ? 'moss' : 'leaf', rib: 'leafDark', fold: 0.18, thick: 0.012 }));
  }
  return merge(...parts);
}

/** A patch of moss lying on the lid: a ragged blob of green over the wood, with a darker heart and a few lighter flecks. */
function mossOn(s: Chest, y: number, a: number, k: number, id: number, out: Disc[]): void {
  const R = (s.box.w + s.box.lid) * 0.5;
  const blob = (kk: number, m: Mat, lift: number, sides: number, seed: number, dy = 0, da = 0): void => {
    const pts: V3[] = [];
    for (let j = 0; j < sides; j++) {
      const t = (j / sides) * TAU, rr = kk * (0.7 + 0.55 * jitter(seed + j));
      const e = lidAt(s, y + dy + Math.cos(t) * rr, a + da + (Math.sin(t) * rr) / R, fullOf(s, y) * proudOf(s));
      pts.push(add(e.p, scale(e.n, lift)));
    }
    out.push(facing(pts, lidAt(s, y, a).n, m));
  };
  blob(k, 'moss', 0.012, 10, id);
  blob(k * 0.45, 'leaf', 0.016, 7, id + 20, k * 0.15, 0);
  for (let q = 0; q < 3; q++) blob(k * 0.13, q ? 'leafDark' : 'petal', 0.02, 5, id + 40 + q, (jitter(id + q) - 0.5) * k * 1.3, ((jitter(id + q + 9) - 0.5) * k * 1.3) / R);
}

/* ---- the body under it ------------------------------------------------------------------------- */

/** The scaly body it carries its chest on, the two bigger ones': moss green, a darker green speckle, scales along its edge. */
function bellyOf(s: Chest, n: number, k: number): Mesh {
  const Bl = s.belly!;
  const m = orb(Bl.c, Bl.r, n + 4, k + 1, 'mark');
  const spots: Disc[] = [];
  for (let q = 0; q < 18; q++) {
    const a = jitter(q * 3 + 1) * TAU, z = -0.6 + 0.9 * jitter(q * 3 + 2);
    const dir: V3 = [Math.cos(a) * Math.sqrt(1 - z * z), Math.sin(a) * Math.sqrt(1 - z * z), z];
    const e = onEgg(Bl.c, Bl.r, dir);
    spots.push(disc(add(e.p, scale(e.n, 0.01)), e.n, 0.035 + 0.03 * jitter(q + 5), 0.03 + 0.02 * jitter(q + 6), 6, q % 3 ? 'spot' : 'belly', { spin: a }));
  }
  // A frill of leafy scales round its edge where it comes out from under the box.
  const frill: Mesh[] = [];
  const count = s.stage === 2 ? 0 : 10;
  for (let q = 0; q < count; q++) {
    const a = (q / count) * TAU + 0.3, dir: V3 = [Math.cos(a), Math.sin(a), -0.1], e = onEgg(Bl.c, Bl.r, dir);
    if (Math.abs(Math.sin(a)) > 0.85) continue;
    const d = unit([e.n[0], e.n[1], -0.7]);
    frill.push(blade([e.p, add(e.p, scale(d, 0.1)), add(e.p, scale(d, 0.2)), add(e.p, scale(d, 0.26))], [0.07, 0.11, 0.09, 0.02], [0, 0, 1], { mat: q % 2 ? 'bark' : 'mark', rib: 'spot', fold: 0.2, thick: 0.015 }));
  }
  return merge(m, paint(spots), ...frill);
}

/** The Hoardback's head: a tortoise's, green and speckled, its snout drawn out to a beak, a small amber eye either side, nostrils, and a pink frill behind. */
function headOf(s: Chest, n: number, shut: boolean): Mesh {
  const H = s.head!, r = H.r;
  const skull = orbAlong([0, 0, 0], [0, 1, 0.1], [r[0], r[2], r[1]], n + 2, 5, 'mark');
  const brow = orbAlong([0, -r[1] * 0.05, r[2] * 0.35], [0, 1, 0.3], [r[0] * 0.8, r[2] * 0.55, r[1] * 0.7], n, 4, 'mark');
  const snout = orbAlong([0, r[1] * 0.85, -r[2] * 0.1], [0, 1, -0.25], [r[0] * 0.55, r[2] * 0.55, r[1] * 0.42], n, 4, 'mark');
  const beak = orbAlong([0, r[1] * 1.18, -r[2] * 0.22], [0, 1, -0.6], [r[0] * 0.32, r[2] * 0.36, r[1] * 0.22], n, 3, 'billDark');
  const e = eyesOn(s, shut);
  const blots: Disc[] = [];
  for (let q = 0; q < 10; q++) {
    const a = jitter(q * 7 + 2) * TAU, up = 0.2 + 0.7 * jitter(q * 7 + 3), dir: V3 = [Math.cos(a) * (1 - up), 0.3 * Math.sin(a) - 0.2, up];
    const p = onEgg([0, 0, 0], [r[0], r[1], r[2]], dir);
    blots.push(disc(add(p.p, scale(p.n, 0.01)), p.n, 0.03 + 0.02 * jitter(q + 1), 0.025, 6, 'spot', { spin: a }));
  }
  for (const sd of [1, -1]) {
    const p = onEgg([0, r[1] * 1.18, -r[2] * 0.22], [r[0] * 0.32, r[1] * 0.22, r[2] * 0.36], [sd * 0.4, 0.7, 0.5]);
    blots.push(disc(add(p.p, scale(p.n, 0.008)), p.n, 0.018, 0.014, 5, 'eye'));
  }
  // The frill: a ruff of pink petals round the back of its head, spread out from its neck.
  const frill: Mesh[] = [];
  for (let q = 0; q < 7; q++) {
    const a = -0.35 + (q / 6) * (Math.PI + 0.7), dir: V3 = [Math.cos(a), -0.15, Math.sin(a)];
    const root: V3 = [dir[0] * r[0] * 0.5, -r[1] * 0.55, dir[2] * r[2] * 0.5 + r[2] * 0.05];
    const d = unit([dir[0], -0.35, dir[2]]);
    const l = r[0] * (0.9 + 0.3 * jitter(q + 30));
    frill.push(blade([root, add(root, scale(d, l * 0.35)), add(root, scale(d, l * 0.7)), add(root, scale(d, l))], [0.04, l * 0.42, l * 0.36, l * 0.12], [0, 1, 0], { mat: q % 2 ? 'tongue' : 'petal', rib: 'tongue', fold: 0.25, thick: 0.015 }));
  }
  return merge(skull, brow, snout, beak, e, paint(blots), ...frill);
}

/** The Hoardback's small eyes, amber with a dark pupil, set well back on the sides of its head under its brow. */
function eyesOn(s: Chest, shut: boolean): Mesh {
  const r = s.head!.r;
  const out: Disc[] = [];
  for (const sd of [1, -1]) {
    const e = onEgg([0, 0, 0], r, [sd * 0.75, 0.55, 0.38]), n = e.n, p = add(e.p, scale(n, 0.01)), sz = r[0] * 0.3;
    if (shut) {
      out.push(disc(p, n, sz * 1.05, sz * 0.22, 8, 'lid', { up: [0, 0, 1] }));
      continue;
    }
    out.push(disc(p, n, sz * 1.15, sz * 1.1, 10, 'lid', { up: [0, 0, 1] }));
    out.push(disc(add(p, scale(n, 0.003)), n, sz, sz * 0.95, 10, 'flame', { up: [0, 0, 1] }));
    out.push(disc(add(p, scale(n, 0.006)), n, sz * 0.5, sz * 0.62, 8, 'eye', { up: [0, 0, 1] }));
    const side = unit(cross([0, 0, 1], n));
    out.push(disc(add(add(add(p, scale(n, 0.009)), [0, 0, sz * 0.4]), scale(side, sz * 0.3)), n, sz * 0.28, sz * 0.28, 6, 'glint', { lit: true, up: [0, 0, 1] }));
    // The heavy brow over it.
    out.push(disc(add(add(p, scale(n, 0.012)), [0, 0, sz * 0.95]), n, sz * 1.25, sz * 0.32, 8, 'spot', { up: [0, 0, 1] }));
  }
  return paint(out);
}

/** The jaw's hinge, under the back of the head. */
const jawHinge = (s: Chest): V3 => { const r = s.head!.r; return [0, -r[1] * 0.2, -r[2] * 0.35]; };
/** The lower jaw, in its own frame from its hinge: cream under its chin. */
function jawOf(s: Chest, n: number): Mesh {
  const r = s.head!.r, hg = jawHinge(s);
  const m = merge(
    orbAlong(sub([0, r[1] * 0.45, -r[2] * 0.42], hg), [0, 1, -0.15], [r[0] * 0.62, r[2] * 0.32, r[1] * 0.75], n, 4, 'belly'),
    orbAlong(sub([0, r[1] * 1.08, -r[2] * 0.42], hg), [0, 1, -0.3], [r[0] * 0.26, r[2] * 0.2, r[1] * 0.2], n, 3, 'billDark'),
  );
  return m;
}

/* ---- legs and feet ------------------------------------------------------------------------------ */

/**
 * A foot in its own frame, from the heel (or wrist) at the origin along `+y`, the ground `heel` under it: the back of the foot,
 * then short thick toes splayed from the ball, each a round peach pad with a peach claw.
 */
function footOf(L: Leg, heel: number, n: number): Mesh {
  const F = L.foot, w = L.w, z0 = -heel, parts: Mesh[] = [];
  const ball: V3 = [0, F, z0 + w * 0.3];
  parts.push(tube([[0, -w * 0.25, 0], [0, F * 0.5, z0 * 0.5 + w * 0.18], ball], [w * 0.95, w * 0.9, w * 0.82], [w * 0.62, w * 0.52, w * 0.42], Math.max(5, n - 2), 'mark', { seam: 'start' }));
  const T = L.toes, spread = T > 3 ? 1.3 : 1.0;
  for (let k = 0; k < T; k++) {
    const u = k / (T - 1), a = lerp(-spread * 0.5, spread * 0.5, u);
    const len = L.toe * (0.85 + 0.2 * Math.sin(Math.PI * u));
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    const tw = w * (T > 3 ? 0.34 : 0.42);
    const tip: V3 = [ball[0] + d[0] * len, ball[1] + d[1] * len, z0 + tw * 0.75];
    parts.push(tube([add(ball, [0, 0, -w * 0.05]), tip], [tw * 1.15, tw], [tw * 0.85, tw * 0.75], 5, 'mark', { start: false }));
    parts.push(orb(add(tip, [d[0] * tw * 0.2, d[1] * tw * 0.2, -tw * 0.05]), [tw * 1.2, tw * 1.25, tw * 0.9], 7, 3, 'pad'));
    parts.push(tube([add(tip, [d[0] * tw * 0.9, d[1] * tw * 0.9, tw * 0.1]), add(tip, [d[0] * tw * 1.75, d[1] * tw * 1.75, -tw * 0.5])], [tw * 0.36, 0.004], [tw * 0.3, 0.004], 4, 'claw', { start: false }));
  }
  return merge(...parts);
}

/** The upper leg, in its bone's frame: down `-z` from the hip, fat at the top, speckled. */
function upperOf(L: Leg, l0: number, n: number, k: number): Mesh {
  const w = L.w;
  const m = merge(
    orb([0, 0, -l0 * 0.15], [w * 1.25, w * 1.2, w * 1.3], n, k, 'mark'),
    tube([[0, 0, 0], [0, 0, -l0 * 0.55], [0, 0, -l0]], [w * 1.2, w * 1.05, w * 0.95], [w * 1.2, w * 1.05, w * 0.95], n, 'mark', { seam: 'start' }),
    orb([0, 0, -l0], w * 0.95, n, k, 'mark'),
  );
  return merge(m, paint(speckle(w * 1.1, l0, 3, 11)));
}
/** The lower leg, down `-z` from the knee to the heel: thick and speckled. */
function lowerOf(L: Leg, l1: number, n: number): Mesh {
  const w = L.w;
  const m = tube([[0, 0, w * 0.5], [0, 0, -l1 * 0.55], [0, 0, -l1]], [w * 0.95, w * 0.92, w * 0.85], [w * 0.95, w * 0.92, w * 0.85], n, 'mark', { seam: 'start' });
  return merge(m, paint(speckle(w * 0.92, l1, 3, 23)));
}
/** Darker green speckles round a leg of radius `r`, down `len` of it. */
function speckle(r: number, len: number, count: number, seed: number): Disc[] {
  const out: Disc[] = [];
  for (let q = 0; q < count; q++) {
    const z = -len * (0.25 + 0.55 * jitter(seed + q)), a = jitter(seed + q * 3) * TAU, nrm: V3 = [Math.cos(a), Math.sin(a), 0];
    out.push(disc(add([nrm[0] * r, nrm[1] * r, z], scale(nrm, 0.012)), nrm, r * 0.32, r * 0.42, 6, 'spot', { up: [0, 0, 1] }));
  }
  return out;
}

const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- what it fetches ---------------------------------------------------------------------------- */

/** A thing lying about: a little cloth bundle, tied at its neck with string. */
function bundleOf(r: number, n: number): Mesh {
  return merge(
    orb([0, 0, 0], [r, r * 0.92, r * 0.82], n, 5, 'cloth'),
    tube([[0, 0, r * 0.62], [0, 0, r * 1.0], [0, 0, r * 1.25]], [r * 0.32, r * 0.2, r * 0.36], [r * 0.32, r * 0.2, r * 0.36], 6, 'clothDark'),
    tube([[0, 0, r * 0.84], [0, 0, r * 0.94]], r * 0.27, r * 0.27, 6, 'string'),
    paint([disc([r * 0.5, r * 0.4, r * 0.35], unit([0.6, 0.5, 0.4]), r * 0.3, r * 0.22, 6, 'clothDark')]),
  );
}

/* ---- a stage's pieces --------------------------------------------------------------------------- */

const restBoneCache = new Map<Chest, Bones>();
function restBones(s: Chest): Bones {
  let b = restBoneCache.get(s);
  if (!b) restBoneCache.set(s, (b = chestBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 })));
  return b;
}

function chestBuild(s: Chest, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), R = restOf(s);
  restBones(s);
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: boxOf(s, false), shut: s.face ? boxOf(s, true) : undefined, bone: 'trunk', bias: 0.05 });
  const L = lidOf3(s, lod ? 10 : 8);
  // The lid goes on the box from every side, and what grows on it on the lid.
  pieces.push({ key: 'lid', mesh: L.lid, bone: 'lid', bias: 0.06, after: ['body'] });
  if (L.growth.f.length) pieces.push({ key: 'growth', mesh: L.growth, bone: 'lid', bias: 0.07, after: ['lid'], lines: false });
  if (s.belly) pieces.push({ key: 'belly', mesh: bellyOf(s, n, k), bone: 'trunk', bias: 0, under: ['body'] });
  if (s.head) {
    const H = s.head;
    pieces.push({ key: 'neck', mesh: tube([[0, -0.12, 0], [0, H.neck * 0.6, 0.02], [0, H.neck + 0.05, 0.02]], [H.r[0] * 0.75, H.r[0] * 0.7, H.r[0] * 0.65], [H.r[2] * 0.75, H.r[2] * 0.7, H.r[2] * 0.7], n, 'mark', { seam: 'start' }), bone: 'neck', bias: 0.02, under: ['head'], after: ['belly'], front: [0, 1, 0] });
    pieces.push({ key: 'head', mesh: headOf(s, n, false), shut: headOf(s, n, true), bone: 'head', bias: 0.1, after: ['body', 'neck'], front: [0, 1, 0] });
    pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.09, after: ['neck'], under: ['head'], front: [0, 1, 0] });
  }
  if (s.tail) pieces.push({ key: 'tail', mesh: tube(curve([0, 0.05, 0], [0, -s.tail * 0.5, -0.02], [0, -s.tail, -0.1], 3), [0.09, 0.07, 0.045, 0.01].map((x) => x * (1 + s.stage * 0.5)), [0.07, 0.055, 0.035, 0.01].map((x) => x * (1 + s.stage * 0.5)), 6, 'mark', { seam: 'start' }), bone: 'tail', bias: -0.02, under: ['body'] });
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], Lg = legOfI(s, i), [l0, l1] = R.legs[i];
    const foot = side > 0 ? footOf(Lg, R.heel[i], n) : mirroredMesh(footOf(Lg, R.heel[i], n));
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    pieces.push(
      // Its legs and feet are all under the box, which hides as much of them as is up under it, and its toes stand out from under
      // it; the bigger two's legs come out of the body under the box.
      { key: `${key}0`, mesh: upperOf(Lg, l0, n, k), bone: `${key}0`, bias: 0.01, under: ['body'], after: s.belly ? ['belly'] : [], front },
      { key: `${key}1`, mesh: lowerOf(Lg, l1, n), bone: `${key}1`, bias: 0.02, under: ['body'], after: s.belly ? ['belly'] : [], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.03, under: ['body'], after: s.belly ? ['belly'] : [], front },
    );
  }
  pieces.push({ key: 'item', mesh: bundleOf(s.item, n), bone: 'item', bias: 0.08 });
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const DUST: RGB = [190, 176, 150];
const GOLD: readonly RGB[] = [[250, 214, 110], [255, 236, 160], [226, 172, 70]];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];

/** A puff of dust off the ground. */
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

/** A four-pointed glint, `r` across, white with a gold rim. */
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, spin: number): void {
  const px = pxOf(g);
  r = Math.max(r, 4.5 * px * (0.4 + 0.6 * al));
  const path = (R: number, w: number): void => {
    g.beginPath();
    for (let q = 0; q < 8; q++) {
      const a = spin + (q / 8) * TAU, k = q % 2 ? w : R;
      const X = x + Math.cos(a) * k, Y = y + Math.sin(a) * k;
      if (q) g.lineTo(X, Y); else g.moveTo(X, Y);
    }
    g.closePath();
  };
  path(r, r * 0.22);
  g.fillStyle = css(GOLD[0], al * 0.9);
  g.fill();
  path(r * 0.66, r * 0.14);
  g.fillStyle = css([255, 252, 240], al);
  g.fill();
}

/** A coin in the air: a small gold disc turning over, inked. */
function coin(g: CanvasRenderingContext2D, x: number, y: number, r: number, turnOf: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.4 * px);
  g.beginPath();
  g.ellipse(x, y, r, Math.max(0.3 * px, r * Math.abs(Math.cos(turnOf))), 0, 0, TAU);
  g.fillStyle = css(c, al);
  g.fill();
  g.strokeStyle = css([110, 70, 30], al * 0.9);
  g.lineWidth = Math.max(0.6 * px, r * 0.25);
  g.stroke();
}

/** Gold catching the light inside its open chest: a glint over the open top while the lid is well up. */
function goldGlint(g: CanvasRenderingContext2D, view: View, s: Chest, b: Bones, open: number, t: number): void {
  if (open < 0.3) return;
  const p = place(b.trunk, [s.box.w * 0.3 * Math.sin(t * 3), s.box.l * 0.2, s.box.h + 0.03]);
  const [x, y] = onScreen(view, p);
  star(g, x, y, 0.12 * (1 + s.stage * 0.4), clamp((open - 0.3) / 0.4) * (0.6 + 0.4 * Math.sin(t * 9)), t * 2);
}

/** A go at its task: a little dust off the ground at each nudge, and a puff and a glint of gold as the lid slams. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Chest, b: Bones, t: number, front: boolean): void {
  const W = CHEST_WORK, big = 0.6 + 0.4 * (s.stage + 1), mid = b.body.t, T = ACT_SECS.work;
  const spot = b.item ? b.item.t : add(mid, itemSpot(s));
  W.nudges.forEach((at, q) => {
    const since = (t - at) * T;
    const p: V3 = [spot[0], spot[1] - s.item, 0.03];
    if (since > 0 && since < 0.4 && nearSide(p, mid, view) === front) puff(g, view, p, 0.12 * big, since / 0.4, q + 3);
  });
  const since = (t - W.shut) * T;
  if (since > 0 && since < 0.45) {
    for (const sd of [-1, 1]) {
      const p = place(b.trunk, [sd * s.box.w * 1.1, s.box.l * 0.2, 0]);
      const q: V3 = [p[0], p[1], 0.04];
      if (nearSide(q, mid, view) === front) puff(g, view, q, 0.18 * big, since / 0.45, 5 + sd);
    }
  }
  if (front) {
    const open = lidOf(t);
    goldGlint(g, view, s, b, open, t * T);
  }
}

/** What a strike throws: dust where it comes down, and coins jolted out of the chest by the bigger two's blows. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Chest, b: Bones, t: number, front: boolean): void {
  const big = 0.6 + 0.4 * (s.stage + 1), mid = b.body.t, since = (t - CHEST_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  for (const leg of ['fl2', 'fr2']) {
    const f = place(b[leg], [0, 0, 0]);
    if (nearSide(f, mid, view) === front) puff(g, view, [f[0], f[1], 0.05], 0.2 * big, since / 0.45, leg === 'fl2' ? 3 : 4);
  }
  if (s.stage === 0 || since > 0.5) return;
  const top = place(b.trunk, [0, 0, s.box.h + 0.05]);
  for (let q = 0; q < 3 + s.stage * 2; q++) {
    const a = (q / (3 + s.stage * 2)) * TAU + jitter(q) * 0.6, sp = (0.5 + 0.5 * jitter(q + 2)) * big;
    const p = thrown(top, [Math.cos(a) * sp, Math.sin(a) * sp, (2.2 + jitter(q + 3)) * big], since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    coin(g, x, y, 0.05 * big, since * 20 + q, GOLD[q % 3], 1 - smooth((since - 0.35) / 0.15));
  }
}

/** Evolving: oak leaves and coins spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Chest, b: Bones, t: number, front: boolean): void {
  const big = 0.6 + 0.4 * (s.stage + 1), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], B = s.box;
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = B.w * 1.7 + 0.3 * big, ry = B.l * 1.6 + 0.3 * big, high = (B.h + B.lid) * 1.6 + 0.6 * big;
  for (let q = 0; q < 16; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 16) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 2 === 0) {
      const c: RGB = q % 4 ? [168, 186, 96] : [236, 160, 110], r = 0.1 * big;
      g.fillStyle = css(c, swirl);
      g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), swirl);
      g.lineWidth = Math.max(pxOf(g) * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.45, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    } else coin(g, x, y, 0.06 * big * (1 - 0.4 * u), ang * 3, GOLD[q % 3], swirl * ramp(u, 0, 0.15));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function chestKind(s: Chest): Kind {
  const bones = chestBones(s);
  return {
    bones,
    build: (lod) => chestBuild(s, lod),
    // The variant's coat tints its oak and its markings its green hide; its brass, its peach toes, its eyes and the gold in it are
    // the same on every variant, so every one is an oak chest on a mossy green beast.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const wood = mix([168, 112, 70], mix(coat, [250, 230, 200], 0.18), 0.9 * clamp(sat(coat) / 0.25));
      const green = mix([110, 140, 78], mix(mark, [240, 240, 220], 0.1), 0.85 * clamp(sat(mark) / 0.2));
      return coatPalette(coat, mark, {
        coat: wood,
        coatDark: mix(wood, [70, 44, 34], 0.45),
        coatLight: mix(wood, [246, 214, 150], 0.4),
        muzzle: mix(wood, [250, 220, 160], 0.5),
        mark: green,
        spot: mix(green, [40, 70, 44], 0.42),
        belly: mix(green, [236, 226, 176], 0.45),
        nose: [104, 62, 44],
        lid: [70, 44, 36],
        eye: [34, 26, 26],
        featherDark: [78, 84, 52],
        glint: [255, 254, 248],
        inner: [64, 40, 34],
        metal: [214, 166, 84],
        metalDark: [150, 104, 52],
        metalLit: [246, 214, 136],
        leather: [150, 92, 58],
        leatherDark: [96, 58, 40],
        bloom: [246, 204, 92],
        gem: [96, 200, 196],
        pad: [248, 188, 136],
        claw: [232, 150, 98],
        moss: mix([124, 156, 72], green, 0.35),
        leaf: [128, 156, 76],
        leafDark: [78, 108, 58],
        petal: [236, 160, 110],
        stem: [120, 92, 60],
        bark: [150, 110, 70],
        tongue: [222, 120, 120],
        billDark: [96, 64, 52],
        flame: [232, 160, 52],
        cloth: [232, 214, 176],
        clothDark: [190, 160, 120],
        string: [150, 96, 60],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.box.l * 1.05 + 0.1, s.fore.at[0] * 1.15],
    stride: 1.2,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    leaps: [false, false],
    motes: [[246, 204, 92], [150, 176, 84]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBits(g, view, s, b, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
      else if (front && a.go <= 0) goldGlint(g, view, s, b, peekOf(a.t), a.t);
    },
  };
}

export const CHESTKIT = chestKind(CHESTKIT_LOOK);
export const LOOTVENT = chestKind(LOOTVENT_LOOK);
export const HOARDBACK = chestKind(HOARDBACK_LOOK);
