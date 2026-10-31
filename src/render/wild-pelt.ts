import {
  add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, smile, smooth, sub, TAU, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The tanner's line: the Peltling, a small low creature of many short legs, a caterpillar's length of body in rings, shingled all
 * over in rows of leaf-shaped feather plates -- sage green along its back, cream at the root and brown at the tip, standing up in
 * crests over its shoulders and in a fan over its tail; cream fleece down its flanks, patched with brown -- a small cream weasel's
 * head with a green blaze, brown eyes and a pink nose, crested with leaf feathers; five pairs of stubby legs, brown and cream, on
 * dark brown paws; and a small pale hide spread on the ground under its front paws. It grows into the Peltipede, longer by two
 * rings and two pairs of legs, its crests taller, its head lifted on a short neck, kneading a bigger hide with its two front
 * pairs; and then the Hideweaver, big and long, its front reared up off the ground so that its front pair of legs are arms,
 * holding up a large hide stretched between them, a tall crest on its head, huge layered plates down its back, and many thick
 * legs on big dark paws. The species is still `tanna` underneath, as saves and the database know it: it tans the hides in the
 * settlement's stores.
 *
 * Its variant's coat is the green of its feather plates, its markings the cream of its fleece; the brown of its plates' tips,
 * its patches and its legs, and its hide, are the same on every variant. All three are built by one set of functions from a
 * description of the stage (`Pede`): a spine of rings (`spineOf`), each ring a bone with its plates on it and a pair of legs
 * bent to put each paw where it is to be, a neck and the head on the front one, and the hide in a frame of its own laid between
 * the paws that hold it, so it stretches as they spread.
 *
 * It walks with its legs in a wave: each pair a little after the one behind it, the two of a pair opposite, so a ripple of
 * lifted paws runs from its tail to its head, its body swaying a little from side to side as it goes.
 *
 * At its task the Peltling grips its hide and kneads it, a front paw at a time, three times, and then stretches it out between
 * them; the Peltipede the same with its two front pairs, the ripple of paws running down them; the Hideweaver lifts its hide in
 * its arms, stretches it wide, works it up and down a side at a time, and shakes it out (`PELT_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Pede {
  stage: 0 | 1 | 2;
  size: number;
  /** Rings, each with a pair of legs; the Hideweaver's first pair are arms. */
  rings: number;
  /** Between one ring and the next. */
  gap: number;
  /** A middle ring's half-sizes, across, along and up; and each ring's size against it, front to back. */
  ring: V3;
  sizes: readonly number[];
  /** How high the spine is carried over the ground. */
  high: number;
  /** How far each link of the spine from the front is raised, in degrees: the Hideweaver's front reared up. */
  rise: readonly number[];
  /** Each leg: its two lengths, its thickness, its paw's size, how far out from the middle its paw stands and how far ahead. */
  leg: { len: [number, number]; w: number; paw: number; out: number; ahead: number };
  /** The arms, on the Hideweaver: two lengths, thickness, paw; how far apart its hands are, how high and how far ahead of its chest. */
  arm: { len: [number, number]; w: number; paw: number; out: number; up: number; ahead: number } | null;
  /** The head's half-sizes (across, along, up), how far out of the front ring it is and how high over it, its pitch; its eye. */
  head: { r: V3; out: number; lift: number; pitch: number; eye: number };
  /** The neck between the front ring and the head, as thick as this share of the front ring; none for none. */
  neck: number;
  /**
   * Its plates: a plate's length and half-width; each ring's crest, how much longer the plates along its spine are there; the
   * tail fan's plates against an ordinary one, and how many; the head crest's.
   */
  plate: { len: number; w: number; crest: readonly number[]; tail: number; tailCount: number; cap: number; capCount: number };
  /** The hide: how far it reaches out to each side of the paws that hold it, how far forward, and back under it. */
  hide: { w: number; fwd: number; back: number };
  /** Its brown patches on its right side, each a ring (fractions between) and a way round it (degrees from the spine), and how big (degrees). */
  patches: ReadonlyArray<readonly [number, number, number]>;
  gait: { duty: [number, number]; swing: [number, number]; step: number; lag: number; sway: number; bob: number };
}

/** A Peltling: small and low, five rings and five pairs of stubby legs, a small hide. */
const PELTLING_LOOK: Pede = {
  stage: 0,
  size: 4.2,
  rings: 5,
  gap: 0.26,
  ring: [0.3, 0.22, 0.26],
  sizes: [0.94, 1, 1, 0.96, 0.86],
  high: 0.33,
  rise: [4, 1],
  leg: { len: [0.2, 0.19], w: 0.1, paw: 0.09, out: 0.44, ahead: 0.02 },
  arm: null,
  head: { r: [0.17, 0.27, 0.16], out: 0.14, lift: 0.1, pitch: -10, eye: 0.026 },
  neck: 0,
  plate: { len: 0.22, w: 0.07, crest: [1.0, 1.95, 1.0, 1.75, 1.0], tail: 2.5, tailCount: 7, cap: 1.9, capCount: 3 },
  hide: { w: 0.2, fwd: 0.45, back: 0.22 },
  patches: [[1.2, 116, 26], [2.4, 98, 28], [3.6, 128, 24]],
  gait: { duty: [0.62, 0.52], swing: [0.32, 0.4], step: 0.36, lag: 0.17, sway: 0.025, bob: 0.012 },
};

/** A Peltipede: longer, seven rings, taller crests, its head lifted on a short neck, a bigger hide under its two front pairs. */
const PELTIPEDE_LOOK: Pede = {
  stage: 1,
  size: 4.6,
  rings: 7,
  gap: 0.28,
  ring: [0.33, 0.23, 0.29],
  sizes: [0.94, 1, 1.02, 1.02, 1, 0.95, 0.86],
  high: 0.38,
  rise: [14, 5, 1],
  leg: { len: [0.25, 0.24], w: 0.11, paw: 0.1, out: 0.52, ahead: 0.03 },
  arm: null,
  head: { r: [0.18, 0.29, 0.17], out: 0.2, lift: 0.18, pitch: -14, eye: 0.027 },
  neck: 0.55,
  plate: { len: 0.25, w: 0.075, crest: [1.0, 2.0, 1.0, 1.65, 1.0, 1.0, 1.55], tail: 2.7, tailCount: 7, cap: 2.1, capCount: 5 },
  hide: { w: 0.26, fwd: 0.62, back: 0.32 },
  patches: [[1.4, 112, 26], [2.6, 132, 24], [3.6, 100, 28], [4.8, 125, 26], [5.8, 105, 22]],
  gait: { duty: [0.64, 0.54], swing: [0.3, 0.38], step: 0.3, lag: 0.14, sway: 0.03, bob: 0.012 },
};

/** A Hideweaver: big and long, ten rings, its front reared up, arms holding up a big hide, a tall crest, huge plates, thick legs. */
const HIDEWEAVER_LOOK: Pede = {
  stage: 2,
  size: 4.0,
  rings: 10,
  gap: 0.3,
  ring: [0.44, 0.27, 0.4],
  sizes: [0.9, 0.98, 1.02, 1.04, 1.05, 1.05, 1.03, 1.0, 0.95, 0.86],
  high: 0.66,
  rise: [60, 34, 10, 2],
  leg: { len: [0.42, 0.4], w: 0.16, paw: 0.15, out: 0.7, ahead: 0.04 },
  arm: { len: [0.36, 0.36], w: 0.15, paw: 0.16, out: 0.42, up: 0.86, ahead: 0.5 },
  head: { r: [0.26, 0.42, 0.24], out: 0.22, lift: 0.42, pitch: -10, eye: 0.036 },
  neck: 0.78,
  plate: { len: 0.34, w: 0.1, crest: [1.6, 1.0, 1.9, 1.0, 1.0, 1.85, 1.0, 1.0, 1.8, 1.1], tail: 2.5, tailCount: 8, cap: 2.5, capCount: 7 },
  hide: { w: 0.5, fwd: 0.7, back: 0.0 },
  patches: [[0.6, 120, 26], [1.9, 98, 30], [3.0, 128, 26], [4.2, 104, 30], [5.4, 122, 26], [6.5, 100, 24], [7.6, 126, 26], [8.6, 104, 24]],
  gait: { duty: [0.66, 0.56], swing: [0.28, 0.34], step: 0.26, lag: 0.13, sway: 0.03, bob: 0.01 },
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
/** A frame made `k` times bigger about its own middle, near nought for a thing not there. */
const scaled = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k), m = x.m; return { m: m.map((v) => v * q) as Xf['m'], t: x.t }; };
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
/** Each face's material chosen from where its middle is. */
function painted(m: Mesh, f: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((face) => {
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    for (const i of face.i) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], m.v[i][j]); hi[j] = Math.max(hi[j], m.v[i][j]); }
    return { ...face, m: f(scale(add(lo, hi), 0.5)) };
  }));
}
/** Where a point is round an egg, as a way out of a ball. */
const dirIn = (C: V3, R: V3, p: V3): V3 => unit([(p[0] - C[0]) / R[0], (p[1] - C[1]) / R[1], (p[2] - C[2]) / R[2]]);

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

/** When each stage's lunge lands, as a share of its strike. */
export const PELT_HITS: readonly number[] = [0.48, 0.5, 0.54];
/**
 * A go at its task, as shares of it. The Peltling's and the Peltipede's three kneads of the hide (`knead`), a paw at a time,
 * and the stretch with both front paws (`stretch`), let go at `ease`. The Hideweaver's hide lifted and stretched wide (`lift`,
 * `wide`), worked up and down a side at a time (`work`), and shaken out (`shake`).
 */
export const PELT_WORK = {
  knead: [0.2, 0.36, 0.52] as readonly number[],
  stretch: 0.7, ease: 0.88,
  lift: 0.14, wide: 0.3, work: [0.46, 0.58] as readonly number[], shake: 0.76,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** Its legs' keys, left then right of each ring from the front; a stride is measured by the first four pairs on the ground (`gaitOf`). */
const PAIR_KEYS = ['f', 'b', 'l', 'h', 'p', 'q', 'r', 's', 't', 'u'];
const legKey = (s: Pede, q: number): string => {
  const ring = q >> 1, sd = q & 1 ? 'r' : 'l';
  if (s.arm && ring === 0) return `arm${sd}`;
  return `${PAIR_KEYS[ring - (s.arm ? 1 : 0)]}${sd}`;
};
const ringOf = (q: number): number => q >> 1;
const sideOf = (q: number): number => (q & 1 ? 1 : -1);
/** Whether a leg is on the ground: all of them but the Hideweaver's arms. */
const grounded = (s: Pede, q: number): boolean => !(s.arm && ringOf(q) === 0);
/** Which of the legs on the ground it is, counted from the front, for the wave. */
const groundIndex = (s: Pede, q: number): number => ringOf(q) - (s.arm ? 1 : 0);

/** How a pose is held, every number of it: the body carried, its spine, the head, each foot or hand, the plates and the hide. */
interface Plan {
  H: number; surge: number; side: number; roll: number; yaw: number;
  /** The front links raised over how they rest, degrees; and the whole spine pitched about its middle. */
  rear: number; pitch: number;
  /** Each ring moved across and up. */
  sway: number[]; bob: number[];
  /** The head nose-up, turned to its left, tilted. */
  head: V3;
  /** Each foot or hand, in the level frame. */
  at: V3[];
  /** Each ring's plates puffed out, and the tail fan's and the head crest's. */
  puff: number[]; fan: number; cap: number;
  /** How much of the hide is out (nought folded away), and how it is kneaded. */
  hide: number; knead: number;
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

/** How far along the spine runs over the ground, standing: where its last ring is put, so its middle is over its feet. */
function restSpan(s: Pede): number {
  let y = 0;
  for (let k = 0; k < s.rings - 1; k++) y += s.gap * Math.cos((s.rise[k] ?? 0) * DEG);
  return y;
}
const yRear = (s: Pede): number => -restSpan(s) * (s.arm ? 0.62 : 0.5);

/**
 * The spine: each ring's middle in the level frame, from the last forward, each link raised as its stage holds it and as the
 * pose rears it, each ring moved across and up as the pose says.
 */
function spineOf(s: Pede, P: Plan): V3[] {
  const N = s.rings, out: V3[] = new Array(N);
  let p: V3 = [0, yRear(s), P.H];
  out[N - 1] = p;
  // The pitch of the whole spine is about its middle: its back links tilt with it, and the rear of it rises or sinks.
  for (let k = N - 2; k >= 0; k--) {
    const th = ((s.rise[k] ?? 0) + P.rear * (k < 3 ? [1, 0.55, 0.2][k] : 0) + P.pitch) * DEG;
    p = [p[0], p[1] + s.gap * Math.cos(th), p[2] + s.gap * Math.sin(th)];
    out[k] = p;
  }
  // Pitched about its middle: lift everything back by what the pitch put on its middle ring.
  const mid = out[Math.floor(N / 2)][2] - P.H;
  return out.map((q, i) => [q[0] + P.sway[i], q[1], q[2] - mid * (s.arm ? 0 : 1) + P.bob[i]]);
}

/** How high a paw's sole is, standing. */
const SOLE = 0.004;

/** Each foot standing, on the ground out round it; the Hideweaver's hands up before its chest, apart. */
function restFeet(s: Pede): V3[] {
  const N = s.rings, out: V3[] = [];
  // Its rings as they rest, worked out without the feet (`spineOf` reads none of them).
  const rings = spineOf(s, { ...blankPlan(s) });
  for (let q = 0; q < N * 2; q++) {
    const i = ringOf(q), sd = sideOf(q), r = rings[i];
    if (!grounded(s, q)) {
      const A = s.arm!;
      out.push([sd * A.out, r[1] + A.ahead, A.up]);
      continue;
    }
    const k = s.sizes[i], g = (i - (s.arm ? 1 : 0)) / Math.max(1, N - 1 - (s.arm ? 1 : 0)) - 0.5;
    out.push([sd * s.leg.out * (0.9 + 0.1 * k) * (1 - 0.12 * Math.abs(g)), r[1] + s.leg.ahead - g * s.gap * 2.2, SOLE]);
  }
  return out;
}

/** A plan of nothing at all, for working out where things rest. */
function blankPlan(s: Pede): Plan {
  const N = s.rings;
  return {
    H: s.high, surge: 0, side: 0, roll: 0, yaw: 0, rear: 0, pitch: 0,
    sway: new Array(N).fill(0), bob: new Array(N).fill(0),
    head: [0, 0, 0], at: new Array(N * 2).fill(0).map(() => [0, 0, 0] as V3),
    puff: new Array(N).fill(0), fan: 0, cap: 0, hide: 0, knead: 0,
  };
}

const restCache = new Map<Pede, Plan>();
/** How it stands with nothing going on: on all its feet, its hide spread under its front paws or held up in its arms. */
function restPlan(s: Pede): Plan {
  const had = restCache.get(s);
  if (had) return zip(had, had, (x) => x);
  const p = blankPlan(s);
  p.at = restFeet(s);
  p.hide = 1;
  restCache.set(s, p);
  return zip(p, p, (x) => x);
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
const EDGE = 0.1;

/** A leg's reach, hip to sole. */
const reachOf = (s: Pede): number => s.leg.len[0] + s.leg.len[1];

/**
 * Going: its legs in a wave, each pair on the ground a little after the one behind it and the two of a pair opposite, so a ripple
 * of lifted paws runs from its tail to its head; the body swaying from side to side and bobbing a little with it, the head held
 * steady, the plates and the tail fan swinging after it; its hide folded away, or held up clear of the ground in its arms.
 */
function goingPlan(s: Pede, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s), R = p.at;
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = reachOf(s), half = L * amp * 1.6;
  for (let q = 0; q < s.rings * 2; q++) {
    if (!grounded(s, q)) continue;
    const A = R[q], ph = frac(a.u + 0.5 * (q & 1) + G.lag * groundIndex(s, q));
    if (ph < duty) {
      p.at[q] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.3 * g);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    p.at[q] = [A[0] * (1 + 0.06 * Math.sin(Math.PI * u)), y, A[2] + lift * Math.sin(Math.PI * u)];
  }
  // The body swaying through each ring in turn, the wave running forward as the legs' does.
  for (let i = 0; i < s.rings; i++) {
    const ph = TAU * (w - G.lag * i);
    p.sway[i] = G.sway * L * 4 * Math.sin(ph) * (s.arm && i === 0 ? 0.4 : 1);
    p.bob[i] = G.bob * L * 4 * Math.sin(2 * ph);
    p.puff[i] = 0.03 * Math.sin(ph + 1);
  }
  p.H += g * L * 0.04;
  p.roll = 1.5 * Math.sin(TAU * w);
  p.head = [3 + 2 * Math.sin(2 * TAU * w), -4 * Math.sin(TAU * w), 0];
  p.fan = 6 * Math.sin(TAU * (w - 0.3)) - 4 * g;
  p.cap = -6 * g;
  // The Peltling and the Peltipede fold their hide away as they go; the Hideweaver lifts its own clear of the ground.
  if (s.arm) {
    for (const q of [0, 1]) p.at[q] = add(p.at[q], [0, 0.06, 0.08 + 0.015 * Math.sin(TAU * w * 2 + q)]);
    p.hide = 1;
  } else p.hide = 0;
  return p;
}

/** Its legs shuffled as it stands: a ripple from back to front down its left side, then its right, each leg's moment in the loop. */
function shuffleAt(s: Pede, q: number): number[] {
  const back = s.rings - 1 - ringOf(q);
  return [(q & 1 ? 14.0 : 5.0) + back * 0.22];
}

/**
 * Standing about: breathing, looking about, the plates along its back lifting and settling in a ripple now and then, a leg lifted
 * and set down again in a wave along a side, its tail fan swaying.
 */
function stillPlan(s: Pede, a: Anim): Plan {
  const p = restPlan(s), t = a.t, L = reachOf(s);
  p.head = [3 * cyc(t, 4) + 5 * beat(t, [6.2, 15.4], 1.1), 16 * drift(t), 5 * drift(t, 3) + 8 * (beat(t, [10.4], 1.3) - beat(t, [19.6], 1.2))];
  for (let q = 0; q < s.rings * 2; q++) {
    if (!grounded(s, q)) {
      p.at[q] = add(p.at[q], [0, 0, 0.012 * cyc(t, 3, q)]);
      continue;
    }
    // The front pair on the hide stay put, kneading it a little.
    if (ringOf(q) === 0 && !s.arm) continue;
    const up = beat(t, shuffleAt(s, q), 0.3);
    if (up > 0) p.at[q] = add(p.at[q], [sideOf(q) * 0.04 * L * up, 0.12 * L * up, 0.35 * L * up]);
  }
  // A ripple through its plates, from its tail to its head.
  for (let i = 0; i < s.rings; i++) p.puff[i] = 0.12 * beat(t, [8.0 + (s.rings - 1 - i) * 0.14, 20.0 + (s.rings - 1 - i) * 0.14], 0.5);
  p.fan = 5 * cyc(t, 2) + 10 * beat(t, [7.6, 19.6], 0.8);
  p.cap = 8 * beat(t, [8.9, 20.9], 0.6);
  p.roll = 1.2 * cyc(t, 3);
  p.H += 0.012 * (a.breath - 0.5);
  p.knead = 0.3 * beat(t, [3.0, 12.0], 1.2);
  return p;
}

/* ---- its strike ---------------------------------------------------------------------- */

/** A strike: it rears its front up with its plates on end, then lunges, front paws slamming down, and its head snaps forward. */
function strikePlan(s: Pede, t: number): Plan {
  const p = restPlan(s), hit = PELT_HITS[s.stage], L = reachOf(s);
  const rear = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.16, 0.95));
  p.rear = 26 * rear - 10 * blow;
  p.surge = L * (-0.25 * rear + 0.6 * blow);
  const front = s.arm ? [0, 1, 2, 3] : [0, 1];
  for (const q of front) {
    const k = ringOf(q) === 0 ? 1 : 0.5;
    p.at[q] = add(p.at[q], [sideOf(q) * 0.1 * L * rear * k, L * k * (0.3 * rear + 0.9 * blow), L * 1.6 * rear * k]);
  }
  p.head = [14 * rear - 16 * blow, 0, 0];
  p.puff = p.puff.map(() => 0.25 * rear + 0.1 * blow);
  p.fan = 20 * rear;
  p.cap = 24 * rear;
  p.hide = s.arm ? 1 : 1 - ramp(t, 0, 0.15) * (1 - ramp(t, 0.85, 1));
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));

/**
 * The Peltling's and the Peltipede's go: bent over its hide, it kneads it, a front paw at a time -- lifted, pressed down and
 * forward, and drawn back, gathering the hide under it -- three times, the Peltipede's second pair following each of the first;
 * then it spreads both front paws out to stretch the hide wide, leaning back on its haunches, and lets it go (`PELT_WORK`).
 */
function kneadPlan(s: Pede, t: number, p: Plan): void {
  const W = PELT_WORK, L = reachOf(s);
  const lean = ramp(t, 0.04, 0.14) * (1 - ramp(t, 0.86, 0.96));
  W.knead.forEach((c, n) => {
    const q = n % 2 ? 1 : 0, sd = sideOf(q);
    const lift = hump(t, c - 0.05, 0.06), press = hump(t, c + 0.01, 0.04), draw = ramp(t, c + 0.02, c + 0.1) * (1 - ramp(t, c + 0.12, c + 0.2));
    p.at[q] = add(p.at[q], [sd * 0.05 * L * lift, L * (0.35 * lift + 0.25 * press - 0.3 * draw), L * (0.5 * lift - 0.03 * press)]);
    // The second pair after the first, on the Peltipede.
    if (s.stage === 1) {
      const q2 = q + 2, lift2 = hump(t, c + 0.03, 0.06), draw2 = ramp(t, c + 0.06, c + 0.14) * (1 - ramp(t, c + 0.16, c + 0.22));
      p.at[q2] = add(p.at[q2], [sd * 0.04 * L * lift2, L * (0.3 * lift2 - 0.25 * draw2), L * 0.45 * lift2]);
    }
  });
  // The stretch: both front paws out to the sides and back, the hide pulled wide between them.
  const wide = ramp(t, W.stretch - 0.12, W.stretch) * (1 - ramp(t, W.ease, W.ease + 0.08));
  for (const q of [0, 1]) p.at[q] = add(p.at[q], [sideOf(q) * L * 0.55 * wide, -L * 0.2 * wide, 0]);
  if (s.stage === 1) for (const q of [2, 3]) p.at[q] = add(p.at[q], [sideOf(q) * L * 0.3 * wide, -L * 0.1 * wide, 0]);
  const nod = W.knead.reduce((m, c) => m + hump(t, c, 0.06), 0);
  p.rear = -6 * lean + 8 * wide;
  p.H -= L * 0.08 * lean;
  p.head = [-18 * lean + 8 * nod + 14 * wide, 6 * Math.sin(t * TAU * 1.5) * lean, 0];
  p.puff = p.puff.map((_, i) => 0.06 * nod * (i < 3 ? 1 : 0.4) + 0.12 * wide);
  p.fan = 8 * wide;
  p.cap = 10 * nod;
  p.knead = nod + 0.6 * lean;
}

/**
 * The Hideweaver's go: it lifts its hide higher in its arms and stretches it wide, works it up and down a side at a time, then
 * shakes it out with a snap of both arms (`PELT_WORK`).
 */
function weavePlan(s: Pede, t: number, p: Plan): void {
  const W = PELT_WORK, A = s.arm!;
  const up = ramp(t, 0.04, W.lift) * (1 - ramp(t, 0.86, 0.96));
  const wide = ramp(t, W.lift, W.wide) * (1 - ramp(t, W.work[1] + 0.1, W.shake - 0.02));
  const shake = hump(t, W.shake, 0.08) * Math.sin((t - W.shake) * 70);
  for (const q of [0, 1]) {
    const sd = sideOf(q), work = hump(t, W.work[q], 0.08) - hump(t, W.work[1 - q], 0.08) * 0.5;
    p.at[q] = add(p.at[q], [sd * A.out * 0.6 * wide, 0.05 * up - 0.06 * wide, 0.14 * up + 0.12 * work + 0.05 * shake]);
  }
  p.rear = 6 * up - 3 * hump(t, W.shake, 0.06);
  p.head = [-12 * up + 6 * hump(t, W.shake, 0.06), 8 * (hump(t, W.work[1], 0.1) - hump(t, W.work[0], 0.1)), 0];
  p.puff = p.puff.map((_, i) => 0.1 * wide * (i < 3 ? 1 : 0.5) + 0.08 * Math.abs(shake));
  p.cap = 12 * wide;
  p.fan = 8 * wide;
  p.knead = wide + 0.8 * Math.abs(shake);
}

/** A go at its task, eased in from how it stands. */
function workPlan(s: Pede, t: number, down: number): Plan {
  const p = restPlan(s);
  if (s.arm) weavePlan(s, t, p);
  else kneadPlan(s, t, p);
  return mixPlan(restPlan(s), p, down);
}

/** Feeding where it stands: its front let down, its head bent to the ground and nibbling. */
function grazePlan(s: Pede, a: Anim): Plan {
  const p = restPlan(s), t = a.t;
  const nib = Math.max(0, Math.sin(t * TAU * 1.2)) ** 2;
  p.rear = -8;
  p.head = [-26 - 6 * nib, 8 * drift(t, 2), 0];
  p.H -= 0.05 * reachOf(s);
  p.hide = s.arm ? 1 : 0;
  return p;
}

/** Evolving: crouched as the light gathers, its plates laid flat; then reared up tall with every plate on end at the turn, a shake, and settled. */
function evolvePlan(s: Pede, t: number): Plan {
  const p = restPlan(s), L = reachOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.7, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.2 * hunch + 0.12 * up);
  p.rear = -8 * hunch + 22 * up;
  p.head = [-12 * hunch + 16 * up, 0, 14 * shake];
  p.puff = p.puff.map(() => -0.08 * hunch + 0.3 * up);
  p.fan = -10 * hunch + 24 * up;
  p.cap = -10 * hunch + 28 * up;
  p.roll = 4 * shake;
  for (let i = 0; i < s.rings; i++) p.sway[i] = 0.02 * shake * (i % 2 ? 1 : -1);
  const front = s.arm ? [0, 1, 2, 3] : [0, 1];
  for (const q of front) p.at[q] = add(p.at[q], [sideOf(q) * 0.15 * L * up, 0.2 * L * up, 1.0 * L * up * (ringOf(q) === 0 ? 1 : 0.5)]);
  p.hide = s.arm ? 1 : 1 - ramp(t, 0.02, 0.2) * (1 - ramp(t, 0.86, 1));
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Pede, a: Anim): Plan {
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

/** A ring's half-sizes. */
const ringR = (s: Pede, i: number): V3 => scale(s.ring, s.sizes[i]);
/** Where a leg's hip is on its ring (right side), in the ring's frame. */
const hipOn = (s: Pede, i: number): V3 => { const R = ringR(s, i); return [R[0] * 0.6, R[1] * 0.05, -R[2] * 0.55]; };
/** Where the neck leaves the front ring, and where the head is on it, in the front ring's frame. */
const neckRoot = (s: Pede): V3 => { const R = ringR(s, 0); return [0, R[1] * 0.55, R[2] * 0.15]; };
const headAt = (s: Pede): V3 => add(neckRoot(s), [0, s.head.out + s.head.r[1] * 0.3, s.head.lift]);
/** The neck's egg, in its own frame: its middle halfway from its root to the head, its length along y, as thick as `Pede.neck` of the front ring. */
const neckEgg = (s: Pede): { r: V3; len: number } => {
  const d = sub(headAt(s), neckRoot(s)), R = ringR(s, 0), len = len3(d);
  return { r: [R[0] * s.neck, len * 0.62, R[2] * s.neck], len };
};

/**
 * The bones of a stage: the body carried level (`level`), each ring along its spine (`ring0` on), the neck and the head on the
 * front one, each ring's plates (`plates0` on, puffed as the pose says), the tail fan and the head crest; each leg bent to put
 * its paw where it is to be; and the hide, in a frame laid between the two paws that hold it, so it stretches as they spread.
 */
function pedeBones(s: Pede): (a: Anim) => Bones {
  return (a0) => {
    const a = { ...a0, go: a0.act ? 0 : a0.go };
    const P = planOf(s, a);
    const level = joint(ROOT, [P.side, P.surge, 0], 0, P.roll, P.yaw);
    const b: Bones = { level };
    const pts = spineOf(s, P), N = s.rings;
    for (let i = 0; i < N; i++) {
      const fwd = unit(sub(pts[Math.max(0, i - 1)], pts[Math.min(N - 1, i + 1)]));
      // Its up is square to its own length, so a reared ring stands up with it.
      const [X, Y, Z] = frameOf(turn(level, unit(cross(cross(fwd, [0, 0, 1]), fwd))), turn(level, fwd));
      b[`ring${i}`] = xfOf(X, Y, Z, place(level, pts[i]));
      b[`plates${i}`] = scaled(b[`ring${i}`], 1 + P.puff[i]);
    }
    b.body = b[`ring${Math.floor(N / 2)}`];
    // The tail fan on the last ring, lifted as the pose says.
    const RL = ringR(s, N - 1);
    b.fan = joint(b[`ring${N - 1}`], [0, -RL[1] * 0.35, RL[2] * 0.5], P.fan, 0, 0);
    // The neck along from the front ring to the head; the head held level whatever the ring does.
    const f0 = b.ring0, root = neckRoot(s), at = headAt(s), mid = mixV(root, at, 0.5);
    const [NX, NY, NZ] = frameOf(turn(f0, cross(cross(sub(at, root), [0, 0, 1]), sub(at, root))), turn(f0, sub(at, root)));
    b.neck = scaled(xfOf(NX, NY, NZ, place(f0, mid)), 1 + P.puff[0] * 0.6);
    b.head = joint({ m: level.m, t: place(f0, at) }, [0, 0, 0], s.head.pitch + P.head[0], P.head[2] - P.roll * 0.5, P.head[1]);
    b.cap = joint(b.head, [0, -s.head.r[1] * 0.38, s.head.r[2] * 0.8], P.cap, 0, 0);
    // Legs: the knee out and forward, a short thick leg's.
    for (let q = 0; q < N * 2; q++) {
      const i = ringOf(q), sd = sideOf(q), key = legKey(s, q), arm = !grounded(s, q);
      const L = arm ? s.arm! : s.leg, h = hipOn(s, i);
      const hip = place(b[`ring${i}`], [sd * h[0], h[1], h[2]]);
      const target = place(level, P.at[q]);
      const hint = arm ? turn(level, [sd * 0.9, -0.2, -0.6]) : turn(level, [sd * 0.8, 0.55, 0.45]);
      const { mid: knee, end: tip } = bend2(hip, target, L.len[0], L.len[1], hint);
      const out = turn(level, [sd, 0.3, 0]);
      const [X0, Y0, Z0] = frameOf(sub(hip, knee), out), [X1, Y1, Z1] = frameOf(sub(knee, tip), out);
      b[`${key}0`] = xfOf(X0, Y0, Z0, hip);
      b[`${key}1`] = xfOf(X1, Y1, Z1, knee);
      // A hand turned to grip the hide's top edge from in front; a paw flat on the ground, toes out a little.
      const [X2, Y2, Z2] = arm ? frameOf(turn(level, [0, -0.25, 1]), turn(level, [sd * 0.2, 1, 0])) : frameOf([0, 0, 1], turn(level, [sd * 0.2, 1, 0]));
      b[`${key}2`] = xfOf(X2, Y2, Z2, tip);
    }
    // The hide, laid between the paws that hold it: its x from the left one to the right, the stretch in it.
    const pl = b[`${legKey(s, 0)}2`].t, pr = b[`${legKey(s, 1)}2`].t, c = mixV(pl, pr, 0.5), across = scale(sub(pr, pl), 0.5);
    const fwd = turn(level, [0, 1, 0]);
    if (s.arm) {
      const hz = Math.max(0.05, c[2]);
      b.hide = { m: [across[0], fwd[0], 0, across[1], fwd[1], 0, across[2], fwd[2], hz], t: c };
    } else {
      const flat: V3 = [across[0], across[1], 0], k = clamp(P.hide);
      b.hide = { m: [flat[0] * k, fwd[0] * k, 0, flat[1] * k, fwd[1] * k, 0, 0, 0, Math.max(0.001, k)], t: [c[0], c[1], 0] };
    }
    b.shadow = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [level.t[0], level.t[1] + (pts[0][1] + pts[N - 1][1]) * 0.5, 0] };
    return b;
  };
}

/* ---- its plates ------------------------------------------------------------------------- */

/** A plate's colours along it, root to middle to tip: a cream root, a green middle and a brown tip; cream fleece; brown fleece. */
type Dress = 'leaf' | 'leafPale' | 'crest' | 'cream' | 'brown';
const DRESS: Record<Dress, [Mat, Mat, Mat]> = {
  leaf: ['mark', 'leaf', 'bark'],
  leafPale: ['mark', 'moss', 'bark'],
  crest: ['mark', 'leaf', 'coat'],
  cream: ['mark', 'mark', 'coatLight'],
  brown: ['coat', 'coat', 'coat'],
};

/** How a plate is shaped: how much its edges cup up, its tip curls off what it lies on, how much of it is tip, how thick, how finely cut. */
interface Shape { cup?: number; curl?: number; tip?: number; thick?: number; n: number; k: number }

/**
 * A leaf-feather plate from `root` along `dir`, its outer face toward `face`, `len` long and `w` across at its widest: a long
 * flat oval with a rounded tip, narrower at its root, its edges cupped a little up toward `face` and its tip curled off what it
 * lies on; coloured by its dress from its root to its tip.
 */
function feather(root: V3, dir: V3, face: V3, len: number, w: number, dress: Dress, o: Shape): Mesh {
  const d = unit(dir), nr = unit(sub(face, scale(d, dot(face, d)))), side = cross(nr, d);
  const b = orb([0, 0, 0], [w, w * (o.thick ?? 0.16), len / 2], o.n, o.k, 'leaf');
  const [m0, m1, m2] = DRESS[dress], tip = o.tip ?? 0.26, cup = o.cup ?? 0.3, curl = o.curl ?? 0.06;
  const uOf = (p: V3): number => p[2] / len + 0.5;
  const f = b.f.map((face0) => {
    const u = face0.i.reduce((t, q) => t + uOf(b.v[q]), 0) / face0.i.length;
    return { ...face0, m: u < 0.2 ? m0 : u < 1 - tip ? m1 : m2 };
  });
  const v = b.v.map((p): V3 => {
    const u = uOf(p), x = p[0] * lerp(0.6, 1, Math.min(1, u * 1.8));
    const y = p[1] + cup * w * (x / w) ** 2 + curl * len * u * u;
    return add(add(add(root, scale(d, u * len)), scale(side, x)), scale(nr, y));
  });
  return mesh(v, f);
}

/** Whether a fleece scale on a ring is in one of its brown patches (`Pede.patches`), the left side's set a little apart from the right's. */
const patched = (s: Pede, i: number, sd: number) => (phi: number, back: number): boolean => s.patches.some(([ri, pi, r]) => {
  const ring = sd > 0 ? ri : ri + 0.6, at = sd > 0 ? pi : pi + 8;
  return Math.hypot((i + back - ring) * 44, phi - at) < r * 0.7;
});

/**
 * The feathering of an egg (`R`, about its middle, its front along y), in its frame: rows of plates round it from its spine
 * (`phi` nought) down each side, each rooted toward its front and lying back over what is behind, in two layers, the second
 * rooted further back between the first's. Over its back the green leaf-feathers, lying back and a little up, those along its
 * spine a little higher; down its flanks soft rounded scales of cream fleece lying back and down, brown where `brown` says.
 */
function featherCoat(R: V3, L: number, W: number, fine: boolean, seed: number, brown: (phi: number, back: number, sd: number) => boolean, lowest = 160): Mesh {
  const out: Mesh[] = [], C: V3 = [0, 0, 0], sh = { n: fine ? 7 : 5, k: fine ? 4 : 3 };
  const back = fine ? [0, 17, 34, 51, 68] : [0, 28, 56, 80];
  const flank = fine ? [86, 104, 122, 140, 158] : [104, 132, 158];
  const layers = fine ? [0.55, -0.05] : [0.3];
  for (let ly = layers.length - 1; ly >= 0; ly--) {
    const half = ly ? 8 : 0;
    // The flank's lowest row first and the spine's last, so what is higher lies over what is lower.
    for (const phi0 of [...flank].reverse()) {
      const phi = phi0 + half;
      if (phi > lowest) continue;
      for (const sd of [1, -1]) {
        const j = jitter(seed + phi0 * 3 + ly * 13 + sd * 7), ph = phi * DEG * sd;
        const e = onEgg(C, R, [Math.sin(ph), layers[ly], Math.cos(ph)]);
        const down: V3 = [sd * Math.cos(phi * DEG), 0, -Math.sin(phi * DEG)];
        const dir = unit(add(add([0, -0.6, 0], scale(down, 0.8)), scale(e.n, 0.14)));
        const dress: Dress = brown(phi, ly ? 0.5 : 0, sd) ? 'brown' : 'cream';
        out.push(feather(add(e.p, scale(e.n, -R[2] * 0.06)), dir, e.n, L * 0.6 * (0.9 + 0.2 * j), W * 1.3, dress, { ...sh, cup: 0.12, curl: 0.05, tip: 0.18, thick: 0.22 }));
      }
    }
    for (const phi0 of [...back].reverse()) {
      const phi = phi0 + (phi0 ? half : 0);
      for (const sd of phi0 === 0 ? [1] : [1, -1]) {
        const j = jitter(seed + phi0 * 5 + ly * 11 + sd * 3), j2 = jitter(seed * 7 + phi0 + ly * 5 + sd);
        const ph = phi * DEG * sd, e = onEgg(C, R, [Math.sin(ph), layers[ly], Math.cos(ph)]);
        const down: V3 = [sd * Math.cos(phi * DEG), 0, -Math.sin(phi * DEG)];
        const up = phi0 === 0 ? 0.55 : 0.36;
        const dir = unit(add(add([0, -1, 0], scale(e.n, up)), scale(down, 0.35 * phi / 90)));
        out.push(feather(add(e.p, scale(e.n, -R[2] * 0.08)), dir, e.n, L * 1.25 * (1 - 0.15 * phi / 90) * (0.9 + 0.2 * j), W * 0.8 * (0.9 + 0.2 * j2),
          j2 > 0.62 ? 'leafPale' : 'leaf', { ...sh, cup: 0.35, curl: 0.22, tip: 0.3 }));
      }
    }
  }
  return merge(...out);
}

/**
 * A fan of `N` plates rooted along `y0` to `y1` over the top of an egg (`R`), spread from standing up (and a little forward) at
 * `from` degrees to lying back at `to`, each a little to one side or the other, faces to the sides; the longest a third of the way
 * along. Brown over their outer third: a crest.
 */
function fan(R: V3, N: number, from: number, to: number, y0: number, y1: number, len: number, w: number, fine: boolean, seed: number, side = 0.22): Mesh {
  const out: Mesh[] = [], sh = { n: fine ? 7 : 5, k: fine ? 4 : 3, tip: 0.34, cup: 0.18, curl: 0 };
  for (let q = 0; q < N; q++) {
    const t = N === 1 ? 0.4 : q / (N - 1), sd = q % 2 ? 1 : -1, j = jitter(seed + q), ang = lerp(from, to, t) * DEG;
    const e = onEgg([0, 0, 0], R, [sd * 0.12, lerp(y0, y1, t), 1]);
    const dir = unit([sd * side * (0.6 + 0.6 * j), -Math.sin(ang), Math.cos(ang)]);
    out.push(feather(add(e.p, scale(e.n, -R[2] * 0.15)), dir, [1, 0, 0.15 * sd], len * (1 - 0.5 * (t - 0.35) ** 2) * (0.92 + 0.16 * j), w, 'crest', sh));
  }
  return merge(...out);
}

/**
 * The plates on one ring, in its frame: its feathering (`featherCoat`), and where its stage has a crest there (`Pede.plate.crest`),
 * a tall fan of three to five plates standing up and back off its spine, their faces to the sides, brown over their outer third.
 */
function platesOf(s: Pede, i: number, fine: boolean): Mesh {
  const R = ringR(s, i), L = s.plate.len * s.sizes[i], W = s.plate.w * s.sizes[i], crest = s.plate.crest[i] ?? 1;
  const out: Mesh[] = [featherCoat(R, L, W, fine, i * 31 + 1, (phi, back, sd) => patched(s, i, sd)(phi, back))];
  if (crest >= 1.5) out.push(fan(R, crest >= 1.85 ? 5 : crest >= 1.65 ? 4 : 3, -8, 58, 0.55, -0.35, L * crest * 1.3, W * 1.5, fine, i * 13));
  return merge(...out);
}

/**
 * The tail fan, in its own frame on the last ring: long plates fanning up and back from the end of its spine, the middle
 * longest, a shorter layer in front of them, and cream scales under them at the end of its body.
 */
function fanOf(s: Pede, fine: boolean): Mesh {
  const N = s.plate.tailCount, out: Mesh[] = [], R = ringR(s, s.rings - 1);
  const L = s.plate.len * s.plate.tail, W = s.plate.w * 1.2, sh = { n: fine ? 7 : 5, k: fine ? 4 : 3, tip: 0.34, cup: 0.2, curl: -0.04 };
  out.push(fan(R, N, 12, 82, 0.2, -0.6, L, W * 1.3, fine, 40, 0.45));
  for (let q = 0; q < (fine ? 4 : 2); q++) {
    const a = q % 2 ? 1 : -1, j = jitter(q + 50), spread = a * (40 + 25 * Math.floor(q / 2)) * DEG;
    const dir = unit([Math.sin(spread) * 0.95, -0.9, Math.cos(spread) * 0.7]);
    out.push(feather([a * R[0] * 0.3, 0, -0.02], dir, [Math.cos(spread), 0, -Math.sin(spread)], L * 0.75 * (0.9 + 0.2 * j), W * 1.1, 'crest', sh));
  }
  const M = fine ? 5 : 3;
  for (let q = 0; q < M; q++) {
    const a = lerp(-1, 1, q / (M - 1)), spread = a * 50 * DEG;
    out.push(feather([a * R[0] * 0.3, R[1] * 0.3, 0], unit([Math.sin(spread), -0.7, Math.cos(spread) * 0.8]), [Math.cos(spread), 0, -Math.sin(spread)], L * 0.55, W * 0.95, q % 2 ? 'leaf' : 'leafPale', sh));
  }
  for (const sd of [1, -1]) {
    for (let q = 0; q < (fine ? 3 : 2); q++) {
      out.push(feather([sd * R[0] * (0.2 + 0.25 * q), -0.02, -R[2] * (0.2 + 0.3 * q)], unit([sd * 0.35, -1, -0.2 * q]), unit([sd * 0.5, 0, 1]), L * 0.32, W * 1.2, q ? 'cream' : 'leaf', { ...sh, tip: 0.2, cup: 0.12 }));
    }
  }
  return merge(...out);
}

/* ---- its body ------------------------------------------------------------------------ */

/** A ring, in its frame: an egg, the green of its back over its top, cream down its sides, darker under it; its plates feather it. */
const ringMesh = (s: Pede, i: number, n: number, k: number): Mesh => {
  const R = ringR(s, i), C: V3 = [0, 0, 0];
  return painted(orb(C, R, n + 3, k + 2, 'mark'), (c) => { const z = dirIn(C, R, c)[2]; return z > 0.3 ? 'leaf' : z < -0.55 ? 'belly' : 'mark'; });
};

/** The neck, in its own frame: a cream egg along it, feathered green over its top and cream under it, a little finer than its body. */
function neckOf(s: Pede, n: number, k: number, fine: boolean): Mesh {
  const E = neckEgg(s), L = s.plate.len, W = s.plate.w, out: Mesh[] = [orb([0, 0, 0], E.r, n + 2, k + 1, 'mark'), featherCoat(E.r, L * 0.85, W * 0.9, fine, 91, () => false, 130)];
  // A mane down the top of it: long plates lying back from behind the head.
  const M = fine ? 4 : 3;
  for (let q = 0; q < M; q++) {
    for (const sd of [-1, 1]) {
      const e = onEgg([0, 0, 0], E.r, [sd * 0.35, 0.6 - (1.1 * q) / M, 0.9]);
      out.push(feather(add(e.p, scale(e.n, -E.r[2] * 0.1)), unit(add([sd * 0.3, -1, 0], scale(e.n, 0.6))), unit([sd, 0, 0.6]), L * (1.7 - 0.2 * q), W * 1.3, 'crest', { n: fine ? 7 : 5, k: fine ? 4 : 3, tip: 0.34, cup: 0.2, curl: 0.1 }));
    }
  }
  return merge(...out);
}

/* ---- its head ------------------------------------------------------------------------- */

/** The skull's middle and half-sizes in the head's frame (across, along, up): the back of the head. */
const skullOf = (s: Pede): { c: V3; r: V3 } => ({ c: [0, -s.head.r[1] * 0.3, 0], r: [s.head.r[0], s.head.r[1] * 0.62, s.head.r[2]] });

/**
 * The head, in its own frame: a weasel's, slim, its skull an egg longer than it is wide going forward into a narrow tapering
 * muzzle with a pink nose and a small mouth; cream, with a cap of green over its crown edged in brown and a green blaze down the
 * bridge of its nose; small dark eyes; a few brown freckles on its cheeks.
 */
function headOf(s: Pede, n: number, k: number, shut: boolean): Mesh {
  const R = s.head.r, S = skullOf(s);
  const cap = (d: V3): Mat => (d[2] > 0.48 && d[1] < 0.6 ? 'leaf' : d[2] > 0.3 && d[1] < 0.1 ? 'coat' : 'mark');
  const out: Mesh[] = [painted(orbAlong(S.c, [0, 1, 0], [S.r[0], S.r[2], S.r[1]], n + 4, k + 2, 'mark'), (c) => cap(dirIn(S.c, S.r, c)))];
  // The muzzle: forward and a little down, tapering; the blaze down its top.
  const mz: V3 = [0, R[1] * 0.42, -R[2] * 0.26], MR: V3 = [R[0] * 0.5, R[1] * 0.58, R[2] * 0.52];
  out.push(painted(orbAlong(mz, [0, 1, -0.14], [MR[0], MR[2], MR[1]], n + 2, k + 1, 'mark'), (c) => {
    const d = dirIn(mz, MR, c);
    return d[2] > 0.5 && Math.abs(d[0]) < 0.34 && d[1] < 0.45 ? 'leaf' : 'mark';
  }));
  const tip: V3 = add(mz, [0, MR[1] * 0.96, MR[2] * 0.1]);
  out.push(orbAlong(tip, [0, 1, 0.1], [R[0] * 0.17, R[0] * 0.13, R[0] * 0.13], 6, 3, 'nose'));
  out.push(smile(add(mz, [0, MR[1] * 0.7, -MR[2] * 0.62]), [0, 1, -0.7], R[0] * 0.26));
  const paints: Disc[] = [];
  for (const sd of [1, -1]) {
    for (const [x, y, z, r] of [[0.5, 0.75, -0.2, 0.06], [0.62, 0.6, -0.4, 0.05], [0.7, 0.35, -0.5, 0.055]] as Array<[number, number, number, number]>) {
      const e = onEgg(mz, MR, [sd * x, y, z]);
      paints.push(disc(add(e.p, scale(e.n, 0.006)), e.n, R[0] * r, R[0] * r, 6, 'coat', { at: add(e.p, scale(e.n, -0.02)) }));
    }
  }
  out.push(paint(paints));
  out.push(eyesOf(s, shut));
  return merge(...out);
}

/** The way out of the skull to the right eye: forward, out and a little up. */
const EYE_DIR: V3 = [0.6, 0.66, 0.3];

/** The eyes: each a dark rim, a dark brown eye and a glint, laid onto the skull's curve; a lid's line, shut. */
function eyesOf(s: Pede, shut: boolean): Mesh {
  const E = s.head.eye, { c: C, r: R } = skullOf(s), out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * EYE_DIR[0], EYE_DIR[1], EYE_DIR[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.006)), at = add(p, scale(n, -0.04));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -E * 0.1)), n, E * 1.2, E * 0.34, 8, 'lid', o), 0.008));
      continue;
    }
    out.push(onto(disc(p, n, E * 1.3, E * 1.15, 10, 'lid', o), 0.006));
    out.push(onto(disc(p, n, E, E * 0.92, 10, 'eye', o), 0.009));
    out.push(onto(disc(add(add(p, scale(up, E * 0.32)), scale(across, side * E * 0.22)), n, E * 0.36, E * 0.36, 6, 'glint', { ...o, lit: true }), 0.012));
  }
  return paint(out);
}

/**
 * The crest on its head, in its own frame on its crown: plates fanned up and back off the back of its head, the middle the
 * tallest, green with a cream root and brown over their outer third; two small ones lying back over its crown.
 */
function capOf(s: Pede, fine: boolean): Mesh {
  const N = s.plate.capCount, out: Mesh[] = [], R = s.head.r, sh = { n: fine ? 7 : 5, k: fine ? 4 : 3, tip: 0.34, cup: 0.2, curl: -0.05 };
  const L = s.plate.len * s.plate.cap, W = s.plate.w * 1.05;
  out.push(fan([R[0] * 0.5, R[1] * 0.35, R[2] * 0.2], N, 8, 70, 0.6, -0.8, L, W * 1.35, fine, 70, 0.35));
  for (const sd of [1, -1]) out.push(feather([sd * R[0] * 0.2, R[1] * 0.25, -R[2] * 0.12], unit([sd * 0.2, -1, 0.35]), unit([sd * 0.3, 0.2, 1]), L * 0.4, W * 0.8, 'leaf', sh));
  return merge(...out);
}

/* ---- legs ------------------------------------------------------------------------------- */

/**
 * A leg's upper part, along -z from its hip: a plump rounded thigh of fleece, cream with a brown patch down its outer side, or
 * brown with a cream one, by turns.
 */
function thighOf(len: number, w: number, n: number, k: number, brown: boolean): Mesh {
  const c: V3 = [0, 0, -len * 0.42], r: V3 = [w * 1.32, w * 1.24, len * 0.68];
  return painted(orbAlong(c, [0, 0, -1], r, n + 2, k + 1, 'mark'), (p) => {
    const d = dirIn(c, r, p), patch = d[0] > 0.25 && d[2] > -0.1;
    return brown ? (patch ? 'mark' : 'coat') : patch ? 'coat' : 'mark';
  });
}

/** A leg's lower part, along -z from its knee: rounded, brown, a cream patch down its front on some. */
function shinOf(len: number, w: number, n: number, k: number, patch: boolean): Mesh {
  const c: V3 = [0, 0, -len * 0.48], r: V3 = [w * 1.06, w * 1.0, len * 0.62];
  return painted(orbAlong(c, [0, 0, -1], r, n + 1, k + 1, 'coat'), (p) => {
    const d = dirIn(c, r, p);
    return patch && d[0] > 0.35 && Math.abs(d[2]) < 0.45 ? 'mark' : 'coat';
  });
}

/** A paw, in its bone's frame (its sole on the ground, forward along y): a dark round foot and its toes. */
function pawOf(r: number, n: number, k: number, fine: boolean): Mesh {
  const out: Mesh[] = [orbAlong([0, r * 0.1, r * 0.55], [0, 1, 0.2], [r * 1.02, r * 0.78, r * 1.08], n + 2, k + 1, 'coatDark')];
  const T = fine ? 4 : 3;
  for (let q = 0; q < T; q++) {
    const a = lerp(-0.85, 0.85, q / (T - 1));
    out.push(orbAlong([Math.sin(a) * r * 0.66, r * 0.82 + Math.cos(a) * r * 0.2, r * 0.3], [Math.sin(a) * 0.4, 1, -0.2], [r * 0.32, r * 0.29, r * 0.36], 6, 3, 'coatDark'));
  }
  return merge(...out);
}

/** A hand, gripping: a dark paw curled over the top of the hide, its fingers down the front of it. */
function handOf(r: number, n: number, k: number, fine: boolean): Mesh {
  const out: Mesh[] = [orbAlong([0, -r * 0.1, 0.02], [0, 0.3, 1], [r * 1.0, r * 0.8, r * 1.05], n + 2, k + 1, 'coatDark')];
  const T = fine ? 4 : 3;
  for (let q = 0; q < T; q++) {
    const a = lerp(-0.75, 0.75, q / (T - 1));
    out.push(orbAlong([Math.sin(a) * r * 0.64, r * 0.5, -r * 0.3], [Math.sin(a) * 0.2, 0.4, -1], [r * 0.3, r * 0.28, r * 0.46], 6, 3, 'coatDark'));
  }
  return merge(...out);
}

/* ---- the hide ------------------------------------------------------------------------- */

/** Where the stains on a hide are, as shares of its size across and along it from its middle, and how big. */
const STAINS: ReadonlyArray<[number, number, number]> = [[0.42, 0.38, 0.1], [-0.5, -0.1, 0.08], [0.08, 0.62, 0.06], [-0.3, 0.55, 0.06]];

/**
 * The Peltling's and the Peltipede's hide, spread on the ground, in its frame between the two front paws (x in half the span
 * between them, y forward, z up): a soft pale tan sheet, its edge wavy and lobed like a pelt's and lying flat on the ground, the
 * middle of it soft and uneven, rucked up between the paws and wrinkled in ridges running out from under each paw where it is
 * gripped; a few faint stains.
 */
function groundHideOf(s: Pede, fine: boolean): Mesh {
  const H = s.hide, span = s.leg.out, sx = span + H.w, cy = (H.fwd - H.back) * 0.5, ry = (H.fwd + H.back) * 0.5;
  const K = fine ? 9 : 5, M = fine ? 48 : 24, v: V3[] = [], f: Face[] = [];
  const edge = (th: number): number => 1 + 0.09 * Math.sin(3 * th + 0.6) + 0.06 * Math.sin(5 * th + 1.9) + 0.035 * Math.sin(9 * th + 0.3) + 0.018 * Math.sin(15 * th);
  const at = (x: number, y: number, rim: number): V3 => {
    const ruck = 0.045 * Math.exp(-((x / span) ** 2) * 1.4 - ((y - 0.02) / (ry * 0.42)) ** 2);
    let ridge = 0;
    for (const px of [-span, span]) {
      const dx = x - px, r = Math.hypot(dx, y), a = Math.atan2(y, dx * Math.sign(px));
      ridge += 0.03 * Math.max(0, Math.cos(4 * a)) ** 3 * Math.exp(-r / (ry * 0.7)) * smooth(r / 0.06);
    }
    const soft = 0.01 * Math.sin(x * 7 + y * 5) + 0.008 * Math.sin(x * 13 - y * 9);
    return [x / span, y, 0.006 + (ruck + ridge + soft + 0.012) * (1 - rim ** 3)];
  };
  v.push(at(0, cy, 0));
  for (let r = 1; r <= K; r++) {
    for (let j = 0; j < M; j++) {
      const th = (j / M) * TAU, e = edge(th) * (r / K);
      v.push(at(Math.cos(th) * sx * e, cy + Math.sin(th) * ry * e, r / K));
    }
  }
  const idx = (r: number, j: number): number => (r === 0 ? 0 : 1 + (r - 1) * M + (j % M));
  for (let j = 0; j < M; j++) f.push({ i: [idx(0, 0), idx(1, j), idx(1, j + 1)], m: 'shell' });
  for (let r = 1; r < K; r++) for (let j = 0; j < M; j++) f.push({ i: [idx(r, j), idx(r + 1, j), idx(r + 1, j + 1), idx(r, j + 1)], m: 'shell' });
  // Its stains: soft blots lying on it, each a little ragged.
  const blots: Disc[] = STAINS.slice(0, fine ? 4 : 2).map(([x, y, r], q) => {
    const c = at(x * sx, cy + y * ry, 0.4), d = disc([0, 0, 0], [0, 0, 1], r * sx, r * ry * 0.8, fine ? 9 : 6, 'shellDark', { spin: q });
    return { ...d, v: d.v.map((p, j) => { const k = 1 + 0.22 * Math.sin(j * 2.3 + q); return [c[0] + p[0] * k / span, c[1] + p[1] * k, c[2] + 0.008] as V3; }) };
  });
  return merge(mesh(v, woundTo(v, f, f.map(() => [0, 0, 1] as V3))), paint(blots));
}

/**
 * The Hideweaver's hide, in its frame between its hands (x in half the span between them, y forward, z in the hands' height, so
 * nought is where they hold it and minus one the ground): a big pale tan sheet, its top edge gathered in each hand, swagging
 * between them and drooping past them; hanging in soft folds that run down from each hand and deepen toward the ground; and
 * pooling on the ground in front, its edge wavy. Both sides of it.
 */
function hangingHideOf(s: Pede, fine: boolean): Mesh {
  const A = s.arm!, over = 1 + s.hide.w / A.out, pool = s.hide.fwd;
  const C = fine ? 26 : 14, D = fine ? 12 : 7, P = fine ? 5 : 3, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const cols = C + 1;
  const fold = (x: number, u: number): number => (0.03 + 0.09 * u) * Math.sin(x * Math.PI * 2.4 + 0.5) + 0.035 * u * Math.sin(x * Math.PI * 5.2 + 1.1);
  for (let r = 0; r <= D + P; r++) {
    for (let c = 0; c <= C; c++) {
      const x = lerp(-over, over, c / C), out = Math.max(0, Math.abs(x) - 1), inside = 1 - Math.min(1, x * x);
      if (r <= D) {
        const u = r / D;
        const top = -(0.16 * inside + 0.55 * out + 0.25 * out * out);
        const z = top + u * (-1 - top);
        // Gathered where each hand grips it: the folds pulled in toward the hand at the top.
        const grip = Math.exp(-(((Math.abs(x) - 1) / 0.25) ** 2)) * (1 - u);
        v.push([x * (1 + 0.1 * u) - Math.sign(x) * 0.08 * grip, 0.06 + fold(x, u) * (1 - 0.6 * grip) + 0.16 * u * u, z]);
      } else {
        const w = (r - D) / P, th = x / over;
        const lobes = 1 + 0.12 * Math.sin(7 * th + 1.1) + 0.06 * Math.sin(13 * th + 0.4);
        v.push([x * (1.1 + 0.32 * w), 0.22 + fold(x, 1) * (1 - 0.7 * w) + pool * w * lobes * (1 - 0.35 * th * th), -1 + 0.008 + 0.04 * (1 - w) ** 2 + 0.01 * Math.sin(x * 9) * (1 - w)]);
      }
    }
  }
  const at = (r: number, c: number): number => r * cols + c;
  for (let r = 0; r < D + P; r++) {
    for (let c = 0; c < C; c++) {
      f.push({ i: [at(r, c), at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)], m: 'shell' });
      want.push(r < D ? [0, 1, 0] : [0, 0, 1]);
    }
  }
  // Its back, where it hangs: the same corners again a hair behind, so its two sides are inked as one sheet.
  const back = v.length;
  for (let q = 0; q <= at(D, C); q++) v.push([v[q][0], v[q][1] - 0.004, v[q][2]]);
  for (let r = 0; r < D; r++) {
    for (let c = 0; c < C; c++) {
      f.push({ i: [back + at(r, c), back + at(r + 1, c), back + at(r + 1, c + 1), back + at(r, c + 1)], m: 'shell' });
      want.push([0, -1, 0]);
    }
  }
  // Its stains: soft blots on its front, laid onto the sheet where it hangs.
  const grid = (rf: number, cf: number): V3 => {
    const r0 = Math.min(D + P - 1, Math.floor(rf)), c0 = Math.min(C - 1, Math.floor(cf)), u = rf - r0, w = cf - c0;
    return mixV(mixV(v[at(r0, c0)], v[at(r0, c0 + 1)], w), mixV(v[at(r0 + 1, c0)], v[at(r0 + 1, c0 + 1)], w), u);
  };
  const blots: Disc[] = STAINS.slice(0, fine ? 4 : 2).map(([x, y, r], q) => {
    const rc = (0.3 + 0.5 * (y + 0.6)) * D, cc = (0.5 + x * 0.42) * C, M = fine ? 9 : 6, pts: V3[] = [];
    for (let j = 0; j < M; j++) {
      const a = (j / M) * TAU + q, k = r * (1 + 0.22 * Math.sin(j * 2.3 + q)) * 2.2;
      pts.push(add(grid(clamp(rc + Math.sin(a) * k * D * 0.6, 0, D - 0.01), clamp(cc + Math.cos(a) * k * C * 0.35, 0, C - 0.01)), [0, 0.006, 0]));
    }
    return { v: pts.reverse(), m: 'shellDark' };
  });
  return merge(mesh(v, woundTo(v, f, want)), paint(blots));
}

/** The hide rippling as it is worked: a wave across it with the kneading; the Hideweaver's lifted off the ground as it goes. */
function hideBent(s: Pede): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const act = a.act, t = act?.kind === 'work' ? act.t : -1;
    const w = t < 0 ? 0 : ramp(t, 0.05, 0.15) * (1 - ramp(t, 0.85, 0.95));
    const go = act ? 0 : smooth(a.go);
    if (s.arm) {
      const shake = t < 0 ? 0 : hump(t, PELT_WORK.shake, 0.1) * Math.sin((t - PELT_WORK.shake) * 60);
      return v.map((p) => {
        const low = p[2] < -0.9;
        const z = low ? lerp(p[2], -0.82, go) : p[2] * (1 - 0.18 * go);
        const y = low ? lerp(p[1], 0.2, go) : p[1];
        return [p[0], y + 0.06 * shake * Math.sin(p[0] * 4 + p[2] * 6) * -p[2] + 0.03 * w * Math.sin(p[0] * 5 + t * 30) * -p[2], z];
      });
    }
    const k = w * 0.02;
    return v.map((p) => [p[0], p[1], p[2] + (p[2] > 0.009 ? k * Math.sin(p[0] * 6 + t * 40) * Math.cos(p[1] * 9) : 0)]);
  };
}

/* ---- drawn by hand -------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const PLATE_RGB: readonly RGB[] = [[150, 168, 112], [246, 232, 210], [158, 108, 70]];

/** Evolving: leaf-feathers spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Pede, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.08, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const mid = b.body.t, rx = s.gap * s.rings * 0.75 + 0.3, high = s.high + s.ring[2] + s.plate.len * 2, px = pxOf(g);
  for (let q = 0; q < 16; q++) {
    const u = clamp((t - 0.08 - 0.1 * jitter(q + 13)) / 0.34), ang = (q / 16) * TAU + u * TAU * 1.3, kk = (1 - u) ** 1.2;
    const p: V3 = [mid[0] + Math.cos(ang) * rx * kk, mid[1] + Math.sin(ang) * rx * kk, 0.1 + u * high];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p), c = PLATE_RGB[q % 3], r = s.plate.w * 0.9;
    g.fillStyle = css(c, swirl);
    g.strokeStyle = css(mix(c, [50, 40, 30], 0.6), swirl);
    g.lineWidth = Math.max(px * 0.8, r * 0.16);
    g.beginPath();
    g.ellipse(x, y, r * 1.6, r * 0.55, ang * 2, 0, TAU);
    g.fill();
    g.stroke();
  }
}

/** Light over it as it evolves: a soft warm glow as it begins, and over its head at the turn. */
function pedeGlow(s: Pede, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], big = s.high + s.ring[2] * 2 + s.plate.len;
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: b.body.t, r: big * 1.6, c: [255, 244, 214], a: 0.5 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: b.head.t, r: big * 1.5, c: [240, 255, 214], a: k });
  return out;
}

/* ---- its pieces ------------------------------------------------------------------------------ */

function pedeBuild(s: Pede, lod: number): Piece[] {
  const fine = lod > 0, n = cut(lod, 7, 9), k = cut(lod, 4, 6), pieces: Piece[] = [], N = s.rings;
  const sk = skullOf(s), headHide = [{ c: sk.c, r: scale(sk.r, 0.9) }];
  if (s.arm) pieces.push({ key: 'hide', mesh: hangingHideOf(s, fine), bone: 'hide', bias: 0.05, after: ['ring0', 'plates0', 'ring1', 'plates1', 'neck', 'head'], front: [0, 1, 0], bent: hideBent(s) });
  else pieces.push({ key: 'hide', mesh: groundHideOf(s, fine), bone: 'hide', bias: -4, bent: hideBent(s), lines: false });
  for (let i = 0; i < N; i++) {
    const R = ringR(s, i);
    pieces.push({ key: `ring${i}`, mesh: ringMesh(s, i, n, k), bone: `ring${i}`, bias: 0, lines: false, breathes: { c: [0, 0, 0], k: 0.04 } });
    const legs = [legKey(s, i * 2), legKey(s, i * 2 + 1)].map((key) => `${key}0`);
    pieces.push({ key: `plates${i}`, mesh: platesOf(s, i, fine), bone: `plates${i}`, bias: 0.02, after: [`ring${i}`, ...legs], hide: [{ c: [0, 0, 0], r: scale(R, 0.8) }] });
  }
  pieces.push({ key: 'fan', mesh: fanOf(s, fine), bone: 'fan', bias: 0.03, after: [`ring${N - 1}`, `plates${N - 1}`], front: [0, -1, 0] });
  if (s.neck) pieces.push({ key: 'neck', mesh: neckOf(s, n, k, fine), bone: 'neck', bias: 0.04, after: ['ring0', 'plates0'], front: [0, 1, 0] });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.1, lines: false });
  pieces.push({ key: 'cap', mesh: capOf(s, fine), bone: 'cap', bias: 0.11, after: ['head'], hide: headHide, hideIn: 'head' });
  for (let q = 0; q < N * 2; q++) {
    const i = ringOf(q), sd = sideOf(q), key = legKey(s, q), arm = !grounded(s, q);
    const L = arm ? s.arm! : s.leg, front: V3 = [sd, 0.2, 0], m = (x: Mesh): Mesh => (sd > 0 ? x : mirror(x));
    const brown = (i + (sd > 0 ? 0 : 1)) % (s.arm ? 4 : 3) === 0;
    pieces.push(
      { key: `${key}0`, mesh: m(thighOf(L.len[0], L.w, n, k, brown)), bone: `${key}0`, bias: 0.01, after: `ring${i}`, front, lines: false },
      { key: `${key}1`, mesh: m(shinOf(L.len[1], L.w, n, k, !brown && (s.arm !== null || i % 2 === 1))), bone: `${key}1`, bias: 0.015, after: [`ring${i}`, `${key}0`], front, convex: true, lines: false },
      { key: `${key}2`, mesh: m(arm ? handOf(L.paw, n, k, fine) : pawOf(L.paw, n, k, fine)), bone: `${key}2`, bias: 0.02, after: [`${key}1`, 'hide'], front: arm ? [0, 1, 0] : front },
    );
  }
  return pieces;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

function pedeKind(s: Pede): Kind {
  return {
    bones: pedeBones(s),
    build: (lod) => pedeBuild(s, lod),
    // The variant's coat is the green of its plates; its markings the cream of its fleece. Its brown, its hide, its pink nose and
    // its brown eyes are the same on every variant.
    palette: (coat, mark) => {
      const green = mix(coat, [110, 120, 62], 0.3), cream = mix([238, 204, 166], mark, 0.4);
      return coatPalette(coat, mark, {
        leaf: green,
        leafDark: mix(green, [40, 50, 30], 0.32),
        moss: mix(green, cream, 0.5),
        stem: mix(green, cream, 0.4),
        mark: cream,
        belly: mix(cream, [214, 186, 150], 0.4),
        muzzle: mix(cream, [255, 252, 246], 0.4),
        coat: [166, 110, 68],
        coatLight: [196, 146, 100],
        coatDark: [100, 64, 46],
        bark: [146, 96, 60],
        nose: [214, 126, 128],
        inner: [236, 160, 164],
        lid: [86, 54, 42],
        eye: [92, 56, 34],
        claw: [40, 24, 20],
        glint: [255, 255, 252],
        shell: [236, 204, 166],
        shellDark: [220, 182, 142],
      } as Partial<Record<Mat, RGB>>, 30);
    },
    shadow: [s.rings * s.gap * 0.55 + 0.25, s.leg.out * 1.15],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    motes: [[248, 236, 214], [150, 172, 112]],
    glow: (b, a) => pedeGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      if (a.act?.kind === 'evolve') evolveSwirl(g, view, s, b, a.act.t, !under);
    },
  };
}

export const PELTLING = pedeKind(PELTLING_LOOK);
export const PELTIPEDE = pedeKind(PELTIPEDE_LOOK);
export const HIDEWEAVER = pedeKind(HIDEWEAVER_LOOK);
