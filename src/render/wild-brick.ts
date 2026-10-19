import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut, under } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The brick line: the Brickling, a little round salamander of a thing splayed
 * low on short legs, plated in terracotta brick, a crest of raised bricks along
 * its head and spine, a cream jaw and belly and a long tail of red and cream bricks,
 * which grows into the Mortarback, a longer lizard carrying a hod on its
 * shoulders -- a brick tub heaped with grey mortar, a trowel stuck in it -- and
 * a stack of bricks behind, and then the Bastiondrake, a massive drake with a
 * short thick neck and a small fort on its back: a cream stone tower with an
 * arch through it, a great tub heaped with rubble, two red chimneys, and a
 * thick tail curling up behind in red and cream. The species is still `cobbe`
 * underneath, as saves and the database know it: the hod carrier, that fetches
 * brick, stone and mortar from the stores and fits it to a planned wall a
 * piece at a time.
 *
 * Every brick is a block of its own, laid in running bond on the body's own
 * curve, so the dark of each one's edge is the mortar line between it and the
 * next. All three are built by one set of functions from a description of the
 * stage (`Brick`), and walk the way the gnaw line does (`./wild-gnaw`): every
 * foot is given a point to be at and its leg bent to reach it, so a planted
 * foot stays where it was put. A lizard's legs come out of its sides, its feet
 * well out to either side of it, so each leg is bent in its own plane with its
 * elbow or knee out and up from the body, the same way round always: it never
 * flips. As it goes its spine waves from side to side and its tail swings.
 * At its task the Brickling taps a brick into its bed with its snout and
 * presses it home with its chin; the Mortarback takes the trowel out of its
 * hod, taps the brick home with it and puts it back; the Bastiondrake heaves a
 * block of stone up on its snout, drops it into its seat and stamps beside it
 * to shake it home.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Brick {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest. */
  body: Rings;
  /** Hip to shoulder. */
  len: number;
  /** How far out the hips and shoulders are, as a share of the barrel's width there, and how far down it, as a share of its depth. */
  hip: number;
  drop: number;
  /** Each leg: upper, lower, and the ankle's height over the sole; how thick. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  /** How far apart its feet stand, against the barrel's width at its shoulders and hips: a lizard's are well out to either side. */
  spread: number;
  /** How far up from straight out its knees and elbows point. */
  knee: number;
  /** How far ahead of its shoulder a fore foot stands, and behind its hip a hind foot, as shares of the barrel's length. */
  reachOut: [number, number];
  /** How high the middle of the barrel is carried. */
  high: number;
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes; the snout's (across, up, along); how far up the skull sits from the neck; the head's pitch. */
  head: { r: V3; snout: V3; up: number; pitch: number };
  eye: { dir: V3; size: number; tall: number };
  /** The crest: a row of raised brick blocks standing up along the top of its head from the brow back and down onto the neck; how many, and each one's half-sizes (across, along, up). */
  crest: { count: number; r: V3 };
  tail: {
    at: V3;
    links: number[];
    w: number[];
    /** How it carries its tail: lifted at the root (degrees up from straight back), curled up at each link, curled further at the last three. */
    lift: number; curl: number; tip: number;
    /** How far it is carried round to its left, in degrees, so seen from in front it curls up beside its back and not behind its head. */
    side?: number;
  };
  /** The bricks on its back and flanks: each one's half-sizes (along, across, thick), how far down its flanks they come (radians from level), and how many are cream; and whether the row along the spine stands up raised. */
  tiles: { r: V3; low: number; cream: number; ridge?: boolean };
  /** What it carries on its back: nothing but its plates, a hod, or a fort. */
  load: 0 | 1 | 2;
  gait: {
    /** How much of a stride a foot is down at a walk and at a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the body goes down at a footfall; how far it rolls (degrees). */
    step: number; bob: number; roll: number;
    /** How far its spine bends from side to side at a walk and at a run, in degrees at either end of it. */
    wave: [number, number];
  };
  size: number;
}

/** A Brickling: little and low, splayed on short legs, a big round head with a crest of raised bricks, a row of them down its spine, a cream jaw and belly, a long tail of red and cream bricks curling up behind. */
const BRICKLING_LOOK: Brick = {
  stage: 0,
  body: { y: [-0.8, -0.68, -0.38, 0, 0.36, 0.62, 0.74], z: [0.0, -0.01, -0.01, 0.0, 0.03, 0.06, 0.08], w: [0.26, 0.46, 0.58, 0.6, 0.56, 0.44, 0.22], h: [0.16, 0.28, 0.33, 0.35, 0.33, 0.28, 0.16] },
  len: 1.0, hip: 0.72, drop: 0.55,
  fore: [0.5, 0.28, 0.07], hind: [0.52, 0.28, 0.07], thick: 0.19, spread: 1.45, knee: 1.5, reachOut: [0.1, 0.08],
  high: 0.45,
  neck: { at: [0, 0.64, 0.02], len: 0.16, w: 0.34, lean: 76 },
  head: { r: [0.52, 0.46, 0.32], snout: [0.38, 0.19, 0.26], up: 0.1, pitch: 2 },
  eye: { dir: [0.74, 0.5, 0.44], size: 0.2, tall: 1.12 },
  crest: { count: 4, r: [0.095, 0.09, 0.07] },
  tail: { at: [0, -0.74, 0.04], links: [0.24, 0.23, 0.22, 0.21, 0.2, 0.19, 0.18, 0.17], w: [0.19, 0.18, 0.165, 0.15, 0.135, 0.12, 0.105, 0.09], lift: -6, curl: 8, tip: 22 },
  tiles: { r: [0.17, 0.14, 0.07], low: -0.6, cream: 0.25, ridge: true },
  load: 0,
  gait: { duty: [0.62, 0.42], swing: [0.34, 0.35], step: 0.2, bob: 0.025, roll: 2.5, wave: [12, 16] },
  size: 2.8,
};

/** A Mortarback: longer and splayed low on sturdy legs, its hod on its shoulders heaped with mortar and a trowel in it, a stack of bricks behind, its tail curled up. */
const MORTARBACK_LOOK: Brick = {
  stage: 1,
  body: { y: [-1.6, -1.42, -0.8, 0, 0.8, 1.32, 1.52], z: [0.04, 0.02, 0.0, 0.02, 0.05, 0.1, 0.14], w: [0.4, 0.72, 0.86, 0.88, 0.84, 0.66, 0.36], h: [0.3, 0.48, 0.56, 0.58, 0.56, 0.48, 0.28] },
  len: 2.1, hip: 0.7, drop: 0.58,
  fore: [0.8, 0.48, 0.1], hind: [0.84, 0.48, 0.1], thick: 0.26, spread: 1.42, knee: 1.5, reachOut: [0.1, 0.08],
  high: 0.74,
  neck: { at: [0, 1.28, 0.24], len: 0.36, w: 0.56, lean: 56 },
  head: { r: [0.64, 0.66, 0.46], snout: [0.46, 0.27, 0.46], up: 0.24, pitch: 0 },
  eye: { dir: [0.74, 0.5, 0.42], size: 0.19, tall: 1.06 },
  crest: { count: 4, r: [0.13, 0.13, 0.11] },
  tail: { at: [0, -1.52, 0.08], links: [0.38, 0.37, 0.36, 0.35, 0.34, 0.32, 0.3, 0.28], w: [0.3, 0.28, 0.26, 0.24, 0.22, 0.2, 0.17, 0.14], lift: -6, curl: 10, tip: 26 },
  tiles: { r: [0.34, 0.25, 0.085], low: -0.75, cream: 0.38 },
  load: 1,
  gait: { duty: [0.64, 0.42], swing: [0.3, 0.32], step: 0.2, bob: 0.035, roll: 2, wave: [11, 15] },
  size: 2.7,
};

/** A Bastiondrake: massive and heavy on splayed legs banded in blocks, a short thick neck, a fort on its back -- a cream tower with an arch, a big tub heaped with rubble, two red chimneys -- and a thick tail curling up behind in red and cream. */
const BASTIONDRAKE_LOOK: Brick = {
  stage: 2,
  body: { y: [-2.75, -2.45, -1.4, 0, 1.4, 2.2, 2.55], z: [0.06, 0.03, 0.0, 0.03, 0.1, 0.2, 0.28], w: [0.7, 1.3, 1.58, 1.64, 1.6, 1.3, 0.7], h: [0.52, 0.86, 1.02, 1.06, 1.04, 0.9, 0.5] },
  len: 3.9, hip: 0.66, drop: 0.58,
  fore: [1.4, 0.92, 0.22], hind: [1.44, 0.94, 0.22], thick: 0.6, spread: 1.36, knee: 1.2, reachOut: [0.17, 0.11],
  high: 1.24,
  neck: { at: [0, 2.3, 0.45], len: 0.72, w: 1.15, lean: 58 },
  head: { r: [1.37, 1.34, 1.0], snout: [0.86, 0.5, 1.02], up: 0.48, pitch: -2 },
  eye: { dir: [0.74, 0.5, 0.42], size: 0.33, tall: 1.0 },
  crest: { count: 5, r: [0.26, 0.25, 0.21] },
  tail: { at: [0, -2.6, 0.3], links: [0.72, 0.7, 0.68, 0.66, 0.64, 0.62, 0.6, 0.58], w: [0.66, 0.62, 0.58, 0.54, 0.5, 0.46, 0.42, 0.38], lift: 8, curl: 16, tip: 4, side: 26 },
  tiles: { r: [0.54, 0.4, 0.13], low: -0.75, cream: 0.38 },
  load: 2,
  gait: { duty: [0.68, 0.48], swing: [0.27, 0.31], step: 0.18, bob: 0.06, roll: 3, wave: [10, 13] },
  size: 2.85,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a wall of bricks is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];

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
/** The barrel's width, depth and height of its middle line at `y`. */
function ringAt(R: Rings, y: number): { w: number; h: number; z: number } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}

/** A frame standing along `up` with its front along `fwd`: across, forward and up. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (Math.hypot(Y[0], Y[1], Y[2]) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
/** A bone's frame from its three axes and where it is. */
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
/** A frame's turn applied to a direction. */
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** `b` in the frame of `a`: what `a` must be followed by to come to `b`. */
function relative(a: Xf, b: Xf): Xf {
  const m = a.m, back = (v: V3): V3 => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  const cols = [0, 1, 2].map((j) => back([b.m[j], b.m[3 + j], b.m[6 + j]]));
  return xfOf(cols[0], cols[1], cols[2], back(sub(b.t, a.t)));
}
/** `b` (in the frame of `a`) followed on from `a`. */
function compose(a: Xf, b: Xf): Xf {
  const cols = [0, 1, 2].map((j) => turn(a, [b.m[j], b.m[3 + j], b.m[6 + j]]));
  return xfOf(cols[0], cols[1], cols[2], place(a, b.t));
}

/**
 * A brick: a block `r` long, across and thick (half-sizes) in the frame of `X`, `Y` and `Z`, its corners knocked a little off
 * true by `rough` so a course of them is laid by hand rather than cut by a machine. Six flat faces meeting at hard edges, and
 * the dark of its outline is the mortar between it and the next.
 */
function block(c: V3, r: V3, f: [V3, V3, V3], mat: Mat, seed = 0, rough = 0.06, taperTop = 0): Mesh {
  const [X, Y, Z] = f;
  const v: V3[] = [];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const id = seed * 7.1 + (sx + 1) + (sy + 1) * 2 + (sz + 1) * 4;
    const k = 1 + rough * (jitter(id) - 0.5) * 2, top = sz > 0 ? 1 - taperTop : 1;
    v.push(add(c, add(add(scale(X, sx * r[0] * k * top), scale(Y, sy * r[1] * (1 + rough * (jitter(id + 3) - 0.5)) * top)), scale(Z, sz * r[2] * (1 + rough * (jitter(id + 5) - 0.5))))));
  }
  // Corners: x fastest, then y, then z. Each face anticlockwise seen from outside.
  const f6: Face[] = [
    { i: [0, 2, 3, 1], m: mat }, { i: [4, 5, 7, 6], m: mat },
    { i: [0, 1, 5, 4], m: mat }, { i: [2, 6, 7, 3], m: mat },
    { i: [0, 4, 6, 2], m: mat }, { i: [1, 3, 7, 5], m: mat },
  ];
  return mesh(v, wound(v, f6, c));
}

/** Each face wound so it faces away from `mid`, whichever way round it was listed. */
function wound(v: readonly V3[], f: Face[], mid: V3): Face[] {
  for (const face of f) {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    const o: V3 = [cx / idx.length - mid[0], cy / idx.length - mid[1], cz / idx.length - mid[2]];
    if (nx * o[0] + ny * o[1] + nz * o[2] < 0) idx.reverse();
  }
  return f;
}

/** A flat painted shape through `pts`, wound so it faces along `n`. */
function facingDisc(pts: V3[], n: V3, m: Mat): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m };
}

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth's line. */
function lineOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  return facingDisc(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** The colour of a brick by its number: mostly red, some darker, and a cream block among them `cream` of the time. */
function brickMat(i: number, cream = 0): Mat {
  const k = jitter(i * 3.7 + 2);
  return k < cream ? 'horn' : k < cream + (1 - cream) * 0.68 ? 'shell' : 'shellDark';
}

/** A lump of rubble: a block of grey stone tipped its own way. */
function rubble(c: V3, r: number, seed: number, mat: Mat = 'stone'): Mesh {
  const up = unit([jitter(seed) - 0.5, jitter(seed + 1) - 0.5, 1]);
  return block(c, [r * (0.8 + 0.4 * jitter(seed + 2)), r * (0.7 + 0.4 * jitter(seed + 3)), r * (0.55 + 0.3 * jitter(seed + 4))], frameOf(up, [Math.cos(seed * 2.3), Math.sin(seed * 2.3), 0]), mat, seed, 0.22);
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Brickling's headbutt, the Mortarback's tail swipe, the Bastiondrake's stamp. */
export const BRICK_HITS: readonly number[] = [0.5, 0.52, 0.56];
/** When the Bastiondrake's tail comes down after its stamp, as a share of the strike. */
export const BASTION_SLAM = 0.7;
/**
 * A go at its task, by stage, as shares of it: the Brickling's two taps of its snout on the brick and the press of its chin; the
 * Mortarback's grip on the trowel, its two strokes buttering the brick and its tap, and the trowel put back; the Bastiondrake's
 * heave of the block, the block dropped into its seat, and the stamp.
 */
export const BRICK_WORK = {
  taps: [0.3, 0.48] as const, pat: 0.76,
  grip: 0.16, strokes: [0.46, 0.58] as const, tap: 0.68, stow: 0.86,
  heave: 0.36, seat: 0.5, stamp: 0.78,
} as const;

/* ---- where its feet go ---------------------------------------------------------------- */

/** A pose: where each ankle is (along the ground, from under the body's middle) and how its foot is pitched; and how the rest is carried. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The neck bent forward and turned left; the head pitched nose-up, turned left and tilted. */
  neck: [number, number]; head: [number, number, number];
  /** The tail lifted, swung to the left, and curled up past how it is carried. */
  tail: [number, number, number];
  jaw: number;
}

interface Rest {
  /** Each hip and shoulder, in the body's frame; each ankle standing, along the ground. */
  hip: V3[]; ankle: V3[];
  reach: number[];
  /** Where the site of its task is in front of it (the brick, the block), and its half-sizes. */
  site: V3; siteR: V3;
}

const rests = new Map<Brick, Rest>();
function restOf(s: Brick): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], ankle: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    const h: V3 = [SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop];
    hip.push(h);
    // Each foot well out to the side of its hip, a lizard's sprawl, ahead of a shoulder and behind a hip.
    const dy = (fore ? 1 : -1) * s.reachOut[fore ? 0 : 1] * (B.y[B.y.length - 1] - B.y[0]);
    ankle.push([SIDE[i] * r.w * s.spread, y + dy, L[2]]);
    reach.push(L[0] + L[1]);
  }
  const siteR: V3 = [[0.24, 0.12, 0.09], [0.28, 0.14, 0.1], [0.62, 0.46, 0.38]][s.stage] as V3;
  // In front of its fore feet, as far as its snout comes down to.
  const site: V3 = [0, ankle[0][1] + [0.42, 0.62, 0.92][s.stage] * s.len, 0];
  const R = { hip, ankle, reach, site, siteR };
  rests.set(s, R);
  return R;
}

function restPlan(s: Brick, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], tail: [0, 0, 0], jaw: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1]), m(a.tail[2], b.tail[2])], jaw: m(a.jaw, b.jaw),
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
/** A path through the air from `a` to `b`, `u` of the way, rising `up` over the straight line at its middle. */
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}

/** The diagonals together, as a lizard walks: the left fore with the right hind, and the right fore with the left hind. */
const BEATS = [0, 0.5, 0.5, 0];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/**
 * Going: a lizard's sprawling walk, the diagonals together. Each foot down for its share of a stride and swept back under the
 * body at the ground's own speed, so it never skates, then brought round and forward through the air; the body twisting from
 * side to side over its feet, the shoulder of the foot reaching forward carried forward with it, and the tail swinging against
 * it, the head held steady against the twist; sinking a little onto each pair of feet as they come down.
 */
function goingPlan(s: Brick, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  for (let i = 0; i < 4; i++) {
    const L = R.reach[i], half = L * amp, A = R.ankle[i], ph = frac(a.u + BEATS[i]);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.25 * g);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    // Swung round in an arc out from the body as it comes forward, as a lizard's foot is, and lifted.
    const outward = 0.07 * L * Math.sin(Math.PI * u);
    p.at[i] = [A[0] + SIDE[i] * outward, y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    p.foot[i] = (i < 2 ? -14 : -20) * Math.sin(Math.PI * u) ** 2;
  }
  // Lowest as each pair comes down, twice a stride; at a run carried higher off the ground, a lizard's high run, and bouncing.
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - duty * 0.15));
  p.H += s.len * (-G.bob * (1 - 0.4 * g) * down + g * (0.03 + 0.02 * Math.max(0, Math.sin(2 * TAU * (w - 0.1)))));
  // The spine waving from side to side (`waveOf`), the shoulder of the foot reaching carried forward with it; the head held
  // steady against it, and the tail swinging the other way behind.
  const wave = waveOf(s, a);
  p.neck[1] = -wave * 0.7;
  p.head[1] = -wave * 0.3;
  // Rolled over onto each pair of feet as they come down; the Bastiondrake's fort rocking with it, a little at every step.
  p.roll = G.roll * Math.sin(TAU * w) + (s.stage === 2 ? 2 * Math.sin(2 * TAU * (w - 0.05)) : 0);
  p.tail = [g * 26, -wave * 1.2, g * -4];
  p.neck[0] = 10 * g;
  // The head bobbed against the shoulders: tipped up as they sink onto the feet and down as they rise, seven degrees either way on
  // the little one, so it reads at the size the island is played at, and less on the bigger, so they stay steady over the ground.
  p.head[0] = [7, 4, 3][s.stage] * (2 * down - 1) - 4 * g;
  p.pitch = g * (2 + 2 * Math.sin(2 * TAU * w));
  return p;
}

/**
 * How far its spine is bent from side to side this moment, in degrees at either end of it: as it goes, a wave once a stride,
 * concave on the side whose fore foot is back, so the shoulder of the one reaching is carried forward with it -- more at a run;
 * nought standing and at its acts.
 */
function waveOf(s: Brick, a: Anim): number {
  if (a.act || a.go <= 0) return 0;
  return -smooth(Math.min(1, a.go)) * lerp(s.gait.wave[0], s.gait.wave[1], a.gait) * Math.cos(TAU * frac(a.u));
}
/** How far the spine is turned at `y` along it, bent `deg` at either end: by as much of it as how far from the middle it is. */
const bendAt = (s: Brick, y: number, deg: number): number => deg * clamp(y / s.body.y[s.body.y.length - 1], -1, 1);
/** A point in the trunk's frame where the spine's bend puts it: turned about the middle by the bend where it is. */
function bendPt(s: Brick, p: V3, deg: number): V3 {
  if (!deg) return p;
  const a = bendAt(s, p[1], deg) * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]];
}
/** A frame in the trunk's frame carried with the spine's bend. */
function bendXf(s: Brick, x: Xf, deg: number): Xf {
  if (!deg) return x;
  const a = bendAt(s, x.t[1], deg) * DEG, c = Math.cos(a), sn = Math.sin(a), m = x.m;
  return { m: [c * m[0] - sn * m[3], c * m[1] - sn * m[4], c * m[2] - sn * m[5], sn * m[0] + c * m[3], sn * m[1] + c * m[4], sn * m[2] + c * m[5], m[6], m[7], m[8]], t: bendPt(s, x.t, deg) };
}

/**
 * Standing about: breathing, looking about, its tail swaying; now and then a lizard's push-up, its fore legs straightened to lift
 * its chest and its head bobbed twice; and a long look over its shoulder at what it carries.
 */
function stillPlan(s: Brick, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [-1 + 2 * a.breath, 10 * look];
  p.head = [2 * cyc(t, 5), 8 * look, 4 * drift(t, 2)];
  p.tail = [2 * cyc(t, 3, 1), 9 * cyc(t, 4), 3 * cyc(t, 6)];
  p.H += 0.012 * s.len * (a.breath - 0.5);
  // The push-up: twice in the loop.
  const up = beat(t, [7.2, 18.4], 1.4);
  if (up > 0) {
    const bob = Math.max(0, Math.sin((t % 1.4) * TAU * 1.5)) * up;
    p.pitch += 7 * up;
    p.H += 0.08 * s.len * up;
    p.head[0] -= 6 * up + 8 * bob;
    p.neck[0] += 4 * bob;
  }
  const over = beat(t, [12.5], 2.4);
  p.neck[1] += 34 * over;
  p.head[1] += 30 * over;
  p.head[2] -= 8 * over;
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Brickling's headbutt: rocked back on its haunches with its head tucked, then thrown forward onto its fore feet, crest first, and back. */
function headbutt(s: Brick, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = BRICK_HITS[0];
  // Rocked back by a quarter of the way through, held there a tenth of a second, and thrown forward onto the blow.
  const back = ramp(t, 0.04, 0.24) * (1 - ramp(t, 0.42, hit - 0.02));
  const out = ramp(t, 0.42, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06);
  p.surge = s.len * (-0.1 * back + 0.18 * out);
  p.H += s.len * (0.02 * back - 0.04 * out);
  p.pitch = 10 * back - 9 * out;
  p.neck = [-10 * back + 12 * out, 0];
  p.head = [14 * back - 8 * out + 6 * jolt, 0, 0];
  p.squash = 0.06 * back + 0.08 * jolt;
  // The fore feet hop forward under the lunge and come back.
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0], A[1] + s.len * 0.16, A[2]];
    const k = ramp(t, 0.42, hit - 0.02) * (1 - ramp(t, 0.7 + 0.06 * i, 0.94 + 0.04 * i));
    p.at[i] = t < 0.6 ? arc(A, fwd, ramp(t, 0.42, hit - 0.02), R.reach[i] * 0.25) : arc(fwd, A, 1 - k, R.reach[i] * 0.2);
  }
  p.tail = [14 * back + 6 * jolt, 0, 6 * back];
  return p;
}

/** How far round the Mortarback's tail is through its swipe: drawn round one way, then whipped round the other, fastest as it lands, and back. */
function swipeOf(t: number): number {
  const hit = BRICK_HITS[1];
  // Drawn round, held a tenth of a second, and whipped across.
  if (t < 0.22) return -0.45 * smooth(t / 0.22);
  if (t < 0.4) return -0.45;
  if (t < hit) return lerp(-0.45, 1, ((t - 0.4) / (hit - 0.4)) ** 1.4);
  return 1 - ramp(t, hit + 0.1, 1) * 1.0;
}
/** The Mortarback's tail swipe: braced on its fore feet, its hindquarters swung round and its tail whipped across in front of it. */
function swipe(s: Brick, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), k = swipeOf(t), hit = BRICK_HITS[1];
  const jolt = hump(t, hit + 0.02, 0.06);
  // Turned about its fore feet: the body yawed, its hindquarters carried round the other way, the head turned to watch.
  p.yaw = 26 * k;
  p.surge = s.len * 0.05 * Math.abs(k);
  p.side = s.len * 0.5 * Math.sin(26 * k * DEG);
  p.neck = [6 * Math.abs(k), -22 * k];
  p.head = [4 * jolt, -20 * k, -6 * k];
  const engage = ramp(t, 0, 0.2) * (1 - ramp(t, 0.8, 1));
  p.tail = [engage * (10 + 8 * Math.sin(Math.PI * clamp(t / hit))), 62 * k, engage * (4 * jolt - 4)];
  p.roll = -5 * k;
  p.squash = 0.06 * jolt;
  // Its hind feet stepped round with its hindquarters; the fore feet stay put.
  for (const i of [2, 3]) {
    const A = R.ankle[i], yaw = 26 * k * DEG, piv: V3 = [0, R.ankle[0][1], 0];
    const d = sub(A, piv), turned: V3 = [piv[0] + d[0] * Math.cos(yaw) - d[1] * Math.sin(yaw), piv[1] + d[0] * Math.sin(yaw) + d[1] * Math.cos(yaw), A[2]];
    const lift = R.reach[i] * 0.2 * Math.max(hump(t, 0.16, 0.12), hump(t, hit - 0.06, 0.08), hump(t, 0.82, 0.12));
    p.at[i] = [turned[0], turned[1], A[2] + lift];
  }
  return p;
}

/** The Bastiondrake's stamp: it rears its forequarters up off the ground and brings both fore feet down together, its tail lifted and slammed down after. */
function stamp(s: Brick, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), hit = BRICK_HITS[2];
  // Reared up, held at the top a tenth of a second, and brought down.
  const top = hit - 0.12, peak = top - 0.18;
  const rear = t < peak ? smooth(t / peak) : t < top ? 1 : 1 - clamp((t - top) / (hit - top)) ** 2;
  const land = hump(t, hit + 0.04, 0.1), shake = t > hit ? Math.sin((t - hit) * 34) * (1 - ramp(t, hit, 0.9)) : 0;
  p.pitch = 24 * rear - 2 * land;
  p.H += s.len * (0.07 * rear - 0.03 * land) + 0.02 * shake;
  p.surge = -s.len * 0.05 * rear;
  p.neck = [-14 * rear + 10 * land, 0];
  p.head = [10 * rear - 8 * land, 0, 3 * shake];
  p.squash = 0.07 * land;
  p.roll = 1.5 * shake;
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0] * 1.05, A[1] + R.reach[i] * 0.15, A[2] + R.reach[i] * 0.7];
    if (t < top) p.at[i] = mixV(A, high, smooth(Math.min(1, t / peak)));
    else if (t < hit) p.at[i] = mixV(high, A, ((t - top) / (hit - top)) ** 2);
    p.foot[i] = 16 * rear;
  }
  // The tail swung up as it rears, and slammed down after the stamp.
  const slam = BASTION_SLAM;
  const up = ramp(t, 0.05, peak) * (1 - ramp(t, slam - 0.08, slam));
  p.tail = [24 * up - 10 * hump(t, slam + 0.03, 0.06), 0, 6 * up];
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/** How far the brick it works is pressed down into its bed through a go: a little at each tap and at the pat, and slowly back. */
function dipOf(s: Brick, t: number): number {
  const W = BRICK_WORK;
  if (s.stage === 0) return 0.18 * (hump(t, W.taps[0] + 0.02, 0.05) + hump(t, W.taps[1] + 0.02, 0.05)) + 0.3 * hump(t, W.pat + 0.02, 0.06);
  if (s.stage === 1) return 0.18 * hump(t, W.tap + 0.02, 0.05);
  return 0;
}

/** The Bastiondrake's block through a go: how far it is tipped up off its seat (degrees) and lifted, as it heaves and drops it. */
function heaveOf(t: number): { tip: number; lift: number } {
  const W = BRICK_WORK;
  const k = t < W.heave + 0.04 ? ramp(t, 0.2, W.heave) : t < W.seat ? 1 - ((t - W.heave - 0.04) / (W.seat - W.heave - 0.04)) ** 2 : 0;
  const bounce = 0.12 * hump(t, W.seat + 0.04, 0.04);
  const shudder = hump(t, W.stamp + 0.03, 0.05) * Math.sin((t - W.stamp) * 90);
  return { tip: 34 * k + 3 * bounce + 1.5 * shudder, lift: 0.16 * k + 0.02 * bounce };
}

/**
 * A go at its task. The Brickling, head down at a brick in front of it, taps it twice into its bed with its snout and presses
 * it home with its chin, patting the ground with a fore paw. The Mortarback turns round to its hod, takes the trowel in its jaws and draws it out with a load of
 * mortar, butters the brick in front of it in two strokes, taps it home and puts the trowel back. The Bastiondrake lowers its
 * head under the near edge of a block of stone, heaves it up, drops it into its seat and stamps the ground beside it.
 */
function workPlan(s: Brick, R: Rest, a: Anim, t: number, down: number): Plan {
  const p = restPlan(s, R), W = BRICK_WORK, K = workKeys(s);
  if (s.stage === 0) {
    // Two taps of its snout on the brick, and then a press with its chin to bed it, while a fore paw pats the ground beside it.
    const tap = Math.max(hump(t, W.taps[0], 0.06), hump(t, W.taps[1], 0.06)), press = hump(t, W.pat, 0.08);
    const at = ramp(t, 0.04, 0.22) * (1 - ramp(t, 0.86, 1)), lookUp = hump(t, 0.62, 0.08);
    p.neck = [K.bow * at + 3 * tap + 2 * press - 8 * lookUp, 0];
    p.head = [-K.nod * at - 18 * tap - 4 * press + 12 * lookUp, 0, 6 * lookUp];
    p.pitch = -K.pitch * at - 1 * press;
    p.H -= s.len * (0.03 * at + 0.02 * press);
    p.surge = s.len * 0.05 * at;
    // The near fore paw lifted and patted down where it stood, eagerly.
    const i = 1, A = R.ankle[i], pat = hump(t, W.pat - 0.07, 0.07);
    p.at[i] = [A[0], A[1] + s.len * 0.04 * pat, A[2] + R.reach[i] * 0.3 * pat];
    p.foot[i] = -14 * pat;
    p.roll = -3 * pat;
    p.tail = [4 * tap, 8 * Math.sin(t * TAU), 0];
  } else if (s.stage === 1) {
    // Round to the hod, the trowel gripped; out with its mortar and round to the brick; two strokes and a tap; and back.
    const toHod = ramp(t, 0.0, W.grip) * (1 - ramp(t, W.grip + 0.06, 0.36)), back = ramp(t, W.tap + 0.06, W.stow) * (1 - ramp(t, W.stow + 0.04, 1));
    const hod = Math.max(toHod, back), atBrick = ramp(t, 0.26, 0.4) * (1 - ramp(t, W.tap + 0.06, W.stow - 0.06));
    const stroke = Math.sin(clamp((t - W.strokes[0] + 0.06) / 0.24) * TAU) * (t > W.strokes[0] - 0.06 && t < W.strokes[1] + 0.06 ? 1 : 0);
    const tap = hump(t, W.tap, 0.05);
    p.neck = [K.hod[0] * hod + K.bow * atBrick + 4 * tap, K.hod[1] * hod + 8 * stroke * atBrick];
    p.head = [K.hod[2] * hod - K.nod * atBrick - 8 * tap, K.hod[3] * hod + 10 * stroke * atBrick, K.hod[4] * hod];
    p.yaw = K.hod[5] * hod;
    p.pitch = -K.pitch * atBrick;
    p.surge = s.len * 0.08 * atBrick;
    p.tail = [0, -K.hod[5] * 2 * hod, 0];
  } else {
    const set = ramp(t, 0.04, 0.2) * (1 - ramp(t, W.seat + 0.06, 0.62)), lift = ramp(t, 0.2, W.heave) * (1 - ramp(t, W.heave + 0.04, W.seat));
    p.neck = [K.bow * set - 10 * lift, 0];
    p.head = [-K.nod * set + 18 * lift, 0, 0];
    p.pitch = -K.pitch * set + 3 * lift;
    p.H -= s.len * 0.03 * set;
    // The near fore foot lifted high and stamped down where it stood, shaking the block home.
    const i = 1, A = R.ankle[i], up = ramp(t, 0.58, W.stamp - 0.02) * (1 - clamp((t - W.stamp + 0.06) / 0.06) ** 2 * (t > W.stamp - 0.06 ? 1 : 0));
    p.at[i] = [A[0], A[1] + s.len * 0.05 * up, A[2] + R.reach[i] * 0.5 * up];
    p.foot[i] = 14 * up;
    const st = hump(t, W.stamp + 0.02, 0.05);
    p.squash = 0.05 * st;
    p.roll = -2.5 * ramp(t, 0.56, 0.7) * (1 - ramp(t, 0.86, 1)) + 1.5 * st;
    p.pitch += 2 * ramp(t, 0.56, 0.7) * (1 - ramp(t, 0.86, 1));
    p.tail = [6 * st, 0, 0];
  }
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its head high, a shake, and settled. */
function evolvePlan(s: Brick, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.64, 0.1) * Math.sin(t * (s.stage === 2 ? 44 : 62));
  p.H += s.len * (-0.03 * hunch + 0.015 * up);
  p.pitch = -3 * hunch + 3 * up;
  p.neck = [12 * hunch - 12 * up, 0];
  p.head = [-10 * hunch + 16 * up, 0, 9 * shake];
  p.roll = 3 * shake;
  p.tail = [-6 * hunch + 16 * up, 10 * shake, 8 * up];
  p.squash = 0.06 * hump(t, 0.7, 0.05);
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Brick, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([headbutt, swipe, stamp][s.stage](s, R, a, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, a, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, a, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, a, 0.4, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/** `p` moved by as much as `to` is from `from`, every number of it. */
function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  return {
    at: p.at.map((x, i) => [d(x[0], to.at[i][0], from.at[i][0]), d(x[1], to.at[i][1], from.at[i][1]), d(x[2], to.at[i][2], from.at[i][2])] as V3),
    foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    neck: [d(p.neck[0], to.neck[0], from.neck[0]), d(p.neck[1], to.neck[1], from.neck[1])],
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    tail: [d(p.tail[0], to.tail[0], from.tail[0]), d(p.tail[1], to.tail[1], from.tail[1]), d(p.tail[2], to.tail[2], from.tail[2])],
    jaw: d(p.jaw, to.jaw, from.jaw),
  };
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** The tip of its snout, in the head's frame. */
/** The middle of the snout, in the head's frame: out of the lower front of the skull, blunt and forward. */
const snoutAt = (s: Brick): V3 => { const H = s.head; return [0, H.r[1] * (s.stage === 2 ? 0.48 : 0.55) + H.snout[2] * 0.35, H.up - H.r[2] * (s.stage === 2 ? 0.26 : 0.3)]; };
const snoutTip = (s: Brick): V3 => { const c = snoutAt(s); return [0, c[1] + s.head.snout[2] * 0.95, c[2] - s.head.snout[1] * 0.1]; };
/** The middle of the skull, in the head's frame. */
const skullAt = (s: Brick): V3 => [0, 0, s.head.up];

/**
 * A leg bent to put its ankle at `ankle`: the upper from the hip out to the knee and the lower down from it, the knee out and up
 * from the body and a little back on a fore leg (an elbow) and forward on a hind one, always the same way round. A point out of
 * reach is reached for as far as the leg goes. The bones' own `-z` runs down each part, as `legPieces` builds them.
 */
function legOf(s: Brick, body: Xf, i: number, hipLocal: V3, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const fore = i < 2, L = fore ? s.fore : s.hind, l0 = L[0], l1 = L[1];
  const hip = place(body, hipLocal), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip), D = Math.hypot(d[0], d[1], d[2]);
  const most = (l0 + l1) * 0.985, least = Math.abs(l0 - l1) + 0.08 * (l0 + l1);
  const Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit([SIDE[i], fore ? -0.9 : 0.25, s.knee]));
  let v = sub(hint, scale(d, dot(hint, d)));
  v = unit(v);
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const frame = (from: V3, to: V3): [V3, V3, V3] => frameOf(sub(from, to), fwd);
  const [X0, Y0, Z0] = frame(hip, knee), [X1, Y1, Z1] = frame(knee, at);
  // The foot flat on the ground facing the way the body does, turned a little out, pitched as the pose says.
  const head = unit([fwd[0] + SIDE[i] * 0.45 * fwd[1], fwd[1] - SIDE[i] * 0.45 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The tail's bones from its root on the body, each link on from the one before it, curled up and swung. */
function tailBones(s: Brick, body: Xf, lift: number, yaw: number, curl: number, wave = 0, lag = 0): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  let prev = joint(body, bendPt(s, T.at, wave), -(T.lift + lift), 0, yaw * 0.4 + bendAt(s, T.at[1], wave) + (T.side ?? 0));
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.curl + curl + (q >= n - 3 ? T.tip : 0)), 0, (yaw * 0.6) / (n - 1) + (q >= n - 3 ? lag / 3 : 0));
    out.push(prev);
  }
  return out;
}

/** Numbers each stage's task needs, worked out the first time they are: how far it bows to its brick, and how it turns round to its hod. */
interface WorkKeys { bow: number; nod: number; pitch: number; hod: number[] }
const WORK_KEYS: WorkKeys[] = [
  { bow: 30, nod: -14, pitch: 12, hod: [] },
  { bow: 40, nod: 14, pitch: 6, hod: [-20, -80, 40, -70, 10, -8] },
  { bow: 42, nod: 18, pitch: 6, hod: [] },
];
const workKeys = (s: Brick): WorkKeys => WORK_KEYS[s.stage];

/** The point near `x0` where `cost` is least, by a downhill simplex of `iters` steps. */
function simplex(cost: (x: number[]) => number, x0: number[], iters: number): number[] {
  const d = x0.length;
  let pts = [x0.slice()];
  for (let q = 0; q < d; q++) pts.push(x0.map((x, j) => x + (j === q ? 15 : 0)));
  let vals = pts.map(cost);
  for (let it = 0; it < iters; it++) {
    const order = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
    pts = order.map((i) => pts[i]);
    vals = order.map((i) => vals[i]);
    const c = x0.map((_, j) => pts.slice(0, d).reduce((t, p) => t + p[j], 0) / d);
    const at = (k: number): number[] => c.map((x, j) => x + k * (pts[d][j] - x));
    const r = at(-1), fr = cost(r);
    if (fr < vals[0]) {
      const e = at(-2), fe = cost(e);
      if (fe < fr) { pts[d] = e; vals[d] = fe; } else { pts[d] = r; vals[d] = fr; }
    } else if (fr < vals[d - 1]) { pts[d] = r; vals[d] = fr; } else {
      const k = at(0.5), fk = cost(k);
      if (fk < vals[d]) { pts[d] = k; vals[d] = fk; } else {
        for (let q = 1; q <= d; q++) { pts[q] = pts[q].map((x, j) => (x + pts[0][j]) / 2); vals[q] = cost(pts[q]); }
      }
    }
  }
  const best = vals.indexOf(Math.min(...vals));
  cost(pts[best]);
  return pts[best];
}

/**
 * The bones of a stage: its pose, the body raised and carried as the pose says, every leg bent to put its foot where the pose
 * says (`legOf`), the neck and head carried on the body, the tail in links, and what it works with: the brick or block in front
 * of it, and the Mortarback's trowel, in its hod or in its jaws.
 */
function brickBones(s: Brick): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, wave = 0, lag = 0): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    // The neck, the tail and the legs come out of the spine where its bend has carried them, turned with it.
    const lean = s.neck.lean + P.neck[0];
    b.neck = joint(body, bendPt(s, s.neck.at, wave), -lean, 0, P.neck[1] + bendAt(s, s.neck.at[1], wave));
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + s.head.pitch + P.head[0], P.head[2], P.head[1]);
    b.jaw = joint(b.head, [0, s.head.r[1] * 0.1, s.head.up - s.head.r[2] * 0.35], -P.jaw);
    tailBones(s, body, P.tail[0], P.tail[1], P.tail[2], wave, lag).forEach((x, q) => { b[`tail${q}`] = x; });
    for (let i = 0; i < 4; i++) {
      const g = P.at[i];
      const [u, l, f] = legOf(s, body, i, bendPt(s, R.hip[i], wave), [g[0], g[1], Math.max(g[2], (i < 2 ? s.fore : s.hind)[2])], P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    b.shadow = shadowOf(body, 0);
    return b;
  };
  // The trowel, as it stands in the hod: stuck in the heap of mortar, its handle's end up over the front of the rim and its blade
  // showing above the heap, leaning back thirty degrees from upright.
  const rest = joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: TROWEL_AT(s) }, [0, 0, 0], -30, 6, 0);
  // What its task needs worked out from its own body, the first time it is posed rather than when the island loads.
  let held = HELD(s), ready = false;
  const prepare = (): void => {
    ready = true;
    // How it turns round to the hod to take the trowel: whatever neck and head carriage puts the tip of its snout at the end of the
    // handle, found once by a downhill simplex from a turn round to its right.
    if (s.load === 1) {
      const K = workKeys(s), a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t: BRICK_WORK.grip } };
      const cost = (x: number[]): number => {
        K.hod = [x[0], x[1], x[2], x[3], K.hod[4], K.hod[5]];
        const b = pose(workPlan(s, R, a, BRICK_WORK.grip, 1)), d = sub(place(b.head, snoutTip(s)), place(b.trunk, TROWEL_AT(s)));
        return dot(d, d) + 2e-5 * (x[0] * x[0] + x[1] * x[1] + x[2] * x[2] + x[3] * x[3]);
      };
      const best = simplex(cost, K.hod.slice(0, 4), 260);
      K.hod = [...best, K.hod[4], K.hod[5]];
    }
    // Held in its jaws as it was standing in the hod when they closed on it, so it goes from one to the other without a turn.
    if (s.load === 1) {
      const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t: BRICK_WORK.grip } };
      const b = pose(workPlan(s, R, a, BRICK_WORK.grip, 1));
      held = relative(b.head, compose(b.trunk, rest));
    }
    // How far it bows to its brick: as far as brings what it taps with -- its snout, the trowel's blade, its snout under the block
    // -- down to the brick's top (the block's middle), found by halving; and the brick put under it there.
    {
      const K = workKeys(s), W = BRICK_WORK, at = [W.taps[0], W.tap, 0.24][s.stage];
      const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t: at } };
      const tip = (): V3 => {
        const b = pose(workPlan(s, R, a, at, 1));
        return s.stage === 1 ? place(compose(b.head, held), BLADE_TIP()) : place(b.head, snoutTip(s));
      };
      const want = s.stage === 2 ? R.siteR[2] * 1.1 : 2 * R.siteR[2] + 0.01;
      let lo = 0, hi = 90;
      for (let q = 0; q < 18; q++) {
        K.bow = (lo + hi) / 2;
        if (tip()[2] > want) lo = K.bow; else hi = K.bow;
      }
      K.bow = (lo + hi) / 2;
      const p = tip();
      R.site = [p[0], s.stage === 2 ? p[1] + R.siteR[1] * 0.95 : p[1] - R.siteR[1] * 0.1, 0];
    }
  };
  return (a) => {
    if (!ready) prepare();
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go }), wave = waveOf(s, a);
    // The tip of the tail a beat behind the spine's wave, swinging seven degrees either way on its own as it goes.
    const lag = a.act || a.go <= 0 ? 0 : -7 * smooth(Math.min(1, a.go)) * Math.cos(TAU * (frac(a.u) - 0.18));
    const b = pose(P, wave, lag);
    if (s.load === 1) {
      // Taken from the hod into its jaws as they close on its handle, and let go back into it: carried between the two over
      // the moment its jaws are at the handle, so it is never in two places.
      const t = a.act?.kind === 'work' ? a.act.t : -1, W = BRICK_WORK;
      const k = t < 0 ? 0 : ramp(t, W.grip - 0.05, W.grip + 0.01) * (1 - ramp(t, W.stow - 0.01, W.stow + 0.05));
      const inHod = compose(b.trunk, bendXf(s, rest, wave));
      b.trowel = k <= 0 ? inHod : k >= 1 ? compose(b.head, held) : blendXf(inHod, compose(b.head, held), k);
    }
    // The brick or the block in front of it, while it works.
    if (a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0)) {
      const t = a.act?.kind === 'work' ? a.act.t : 0.4;
      const k = a.act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
      const g = Math.max(0.001, k);
      const S = R.site, dip = dipOf(s, t) * R.siteR[2] * 0.4;
      if (s.stage === 2) {
        // Tipped up about its far bottom edge as it is heaved, and dropped back.
        const h = heaveOf(t), edge: V3 = [S[0], S[1] + R.siteR[1], 0];
        const base = joint({ m: [g, 0, 0, 0, g, 0, 0, 0, g], t: edge }, [0, 0, h.lift], h.tip);
        b.site = { m: base.m, t: base.t };
      } else {
        b.site = { m: [g, 0, 0, 0, g, 0, 0, 0, g], t: [S[0], S[1], -dip] };
      }
    }
    return b;
  };
}

/** The tip of the trowel's blade, in its own frame (`trowelOf`). */
const BLADE_TIP = (): V3 => [0, 0.04 * TROWEL_K, -0.84 * TROWEL_K];
/** How big the trowel is, against the one it is drawn from. */
const TROWEL_K = 1.3;
/** Where the trowel's handle ends, standing in the hod, in the trunk's frame: up over the front of its rim. */
const TROWEL_AT = (s: Brick): V3 => { const r = ringAt(s.body, HOD_Y); return [0.12, HOD_Y + 0.14, r.z + r.h - 0.06 + HOD_H + 0.95]; };
/** Where the hod sits along the back, and how tall it is. */
const HOD_Y = 0.5, HOD_H = 0.5, HOD_R = 0.56;

/** Two frames mixed, `k` of the way from `a` to `b`, kept square. */
function blendXf(a: Xf, b: Xf, k: number): Xf {
  const col = (x: Xf, j: number): V3 => [x.m[j], x.m[3 + j], x.m[6 + j]];
  const [X, Y, Z] = frameOf(mixV(col(a, 2), col(b, 2), k), mixV(col(a, 1), col(b, 1), k));
  return xfOf(X, Y, Z, mixV(a.t, b.t, k));
}

/** The trowel held in the jaws: its handle's end at the tip of the snout, the blade hanging down and forward from it. */
const HELD = (s: Brick): Xf => {
  const tip = snoutTip(s);
  return joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, tip[1] - s.head.snout[2] * 0.25, tip[2] - s.head.snout[1] * 0.4] }, [0, 0, 0], -30, 0, 0);
};

/* ---- what it is made of ------------------------------------------------------------------------- */

/**
 * The bricks on its back and flanks, in running bond: courses along the barrel from the ridge down each flank as far as the
 * stage's plating comes, every brick laid on the barrel's own curve, each course half a brick along from the one above it, a
 * few cream among the red at random.
 */
function coursesOf(s: Brick): Mesh {
  const T = s.tiles, B = s.body, out: Mesh[] = [];
  if (T.ridge) {
    // A row of raised bricks standing along the spine from the shoulders to the root of the tail, each tipped back a little over the
    // next, and the flanks plated in courses under it.
    const n = Math.round((B.y[5] - B.y[0]) / (T.r[0] * 2.1));
    for (let q = 0; q <= n; q++) {
      const y = lerp(B.y[5] - T.r[0], B.y[0] + T.r[0] * 0.5, q / n), id = 200 + q, at = onRings(B, y, Math.PI / 2);
      const up = unit(add(at.n, [0, -0.3, 0])), k = 1 - 0.25 * Math.abs(q / n - 0.4);
      out.push(block(add(at.p, scale(up, T.r[2] * 0.9)), [T.r[1] * k * 0.8, T.r[0] * k * 0.8, T.r[2] * k * 1.4], frameOf(up, [0, 1, 0]), brickMat(id, T.cream), id, 0.06, 0.14));
    }
  }
  const mid = ringAt(B, 0), across = Math.sqrt((mid.w * mid.w + mid.h * mid.h) / 2);
  const dth = (2 * T.r[1] * 1.02) / across, rows = Math.max(1, Math.floor((Math.PI / 2 - T.low) / dth) + 1);
  const y0 = B.y[1] + T.r[0] * 0.4, y1 = B.y[5] - T.r[0] * 0.2, along = T.r[0] * 2.04;
  for (let k = T.ridge ? 1 : 0; k < rows; k++) {
    const th = Math.PI / 2 - k * dth;
    for (const sd of k === 0 ? [1] : [1, -1]) {
      // Each course run from the middle out both ways, so it is laid evenly about the waist, and a half brick on in every other.
      const off = k % 2 ? along * 0.5 : 0, n0 = Math.floor((y0 - off) / along), n1 = Math.ceil((y1 - off) / along);
      for (let q = n0; q <= n1; q++) {
        const y = q * along + off;
        if (y < y0 - along * 0.3 || y > y1 + along * 0.3) continue;
        const id = k * 53 + q * 7 + (sd > 0 ? 0 : 29) + 200;
        if (inCream(s, y, th, dth * 0.45)) continue;
        const at = onRings(B, clamp(y, B.y[0] + 0.05, B.y[B.y.length - 1] - 0.05), sd > 0 ? th : Math.PI - th);
        // Narrower where the barrel narrows, so a course closes up at the rump and the shoulders rather than standing off them.
        const fit = clamp(ringAt(B, y).w / mid.w, 0.55, 1);
        const turnA = (jitter(id + 6) - 0.5) * 0.12, r: V3 = [T.r[1] * fit * (0.96 + 0.06 * jitter(id + 4)), T.r[0] * (0.95 + 0.06 * jitter(id + 3)), T.r[2]];
        out.push(block(add(at.p, scale(at.n, r[2] * 0.45)), r, frameOf(at.n, [Math.sin(turnA), Math.cos(turnA), 0]), brickMat(id, T.cream), id, 0.08, 0.2));
      }
    }
  }
  return merge(...out);
}

/**
 * How far round from straight down the cream of its chest and belly comes at `y` along the barrel, in radians: a third of the way
 * up each flank along the belly, and up to the shoulders at the chest, so the cream runs from the throat down between the fore
 * legs and along under it to the hind legs.
 */
function creamSpread(s: Brick, y: number): number {
  const B = s.body;
  return lerp(1.98, 2.4, clamp((y - B.y[3]) / (B.y[5] - B.y[3])));
}
/** Whether a point `th` round the barrel from its right side (a quarter turn up is the ridge) at `y` is in the cream, with `margin` to spare. */
const inCream = (s: Brick, y: number, th: number, margin: number): boolean => th < creamSpread(s, y) - Math.PI / 2 + margin;

/** The barrel: its skin on top, the cream of its belly under it, and on the bigger ones a few cracks of plates painted on the belly. */
function barrelOf(s: Brick, n: number): Mesh {
  const B = s.body;
  const body = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, (ring, j) => (ring > 0 && under(n, j, creamSpread(s, (B.y[ring] + B.y[Math.min(ring + 1, B.y.length - 1)]) / 2)) ? 'belly' : 'shellDark'));
  // The chest plate: a cream swell at the front of the barrel under the throat, down between the fore legs, so the cream runs from
  // the jaw to the belly seen from in front as well as from the side; a few cream bricks laid on it.
  const cy = lerp(B.y[5], B.y[6], 0.75), cr = ringAt(B, B.y[5]);
  const chestC: V3 = [0, cy, cr.z - cr.h * 0.42], chestR: V3 = [cr.w * 1.0, (B.y[6] - B.y[5]) * 1.4, cr.h * 0.78];
  const chest = orb(chestC, chestR, n, 5, 'belly');
  const bricks = [-0.5, 0, 0.5].map((x, q) => {
    const e = onEgg(chestC, chestR, [x, 1, 0.1 - 0.25 * Math.abs(x)]);
    return block(add(e.p, scale(e.n, 0.02)), [cr.w * 0.22, cr.h * 0.18, cr.h * 0.06], frameOf(e.n, [0, 0, 1]), q === 1 ? 'hornDark' : 'horn', 1700 + q, 0.05, 0.2);
  });
  const withChest = merge(body, chest, ...bricks);
  if (!s.stage) return withChest;
  const plates: Disc[] = [];
  for (let q = 0; q < 8 + 4 * s.stage; q++) {
    const y = lerp(B.y[1], B.y[5], (q + 0.5) / (8 + 4 * s.stage)), th = -Math.PI / 2 + (jitter(q + 3) - 0.5) * 1.2;
    const e = onRings(B, y, th);
    plates.push(disc(add(e.p, scale(e.n, 0.02)), e.n, B.w[3] * 0.16, B.w[3] * 0.12, 5, 'hornDark', { spin: jitter(q) * 3, up: [0, 1, 0] }));
  }
  return merge(withChest, paint(plates));
}

/**
 * The head: a round skull a size too big on the little one, longer on the bigger; a snout out of the front of it, skin over and
 * cream under, the cream running back under the jaw and down the throat; the crest of raised blocks standing up along the top
 * of it; the eyes; a rosy cheek on the little one; and a small smile.
 */
function headOf(s: Brick, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const sn = H.snout, snoutC = snoutAt(s), snoutR: V3 = [sn[0], sn[2], sn[1]];
  // The cream of the face: the jaw, the chin and the throat under a level line low on the skull, and the lower half of the
  // muzzle; skin over it, on the skull and on the snout alike, with no seam of another solid between.
  // Everything under a line from just under the eye to the corner of the mouth is cream: the lower face, the jaw and the throat.
  // The line runs from under the back of the jaw up through the bottom of the eye to the corner of the mouth: under it cream,
  // the cheeks and the lower face; over it the skin of the brow and the crown.
  const eyeLow = onEgg(C, H.r, s.eye.dir).p[2] - C[2] - s.eye.size * [0.95, 0.7, 0.9][s.stage];
  // (The little one's cream carried at the eye's lower edge right round the back of its jaw, so bare skin is only its brow.)
  const faceLine = (y: number): number => lerp(s.stage ? -H.r[2] * 0.45 : eyeLow - H.r[2] * 0.05, eyeLow, clamp(((y - C[1]) / H.r[1] + 0.55) / 0.8));
  // And the crown and the back of the head behind the eyes a cap of brick red under the crest, so the bare salmon skin is the brow
  // and the face round the eyes.
  const capped = (c: V3): boolean => s.stage ? c[2] - C[2] > H.r[2] * 0.22 && c[1] - C[1] < H.r[1] * 0.3 : c[2] - C[2] > H.r[2] * 0.45 && c[1] - C[1] < H.r[1] * 0.4 && Math.abs(c[0]) < H.r[0] * 0.62;
  const base = ((m: Mesh): Mesh => mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return capped(c) ? { ...f, m: 'shell' as Mat } : f;
  })))(orb(C, H.r, n + 4, k + 3, 'coat'));
  // The little one's cheeks are its sides, not its underside: there every facet whose middle is under the middle of the eye, from
  // the front of the face back to behind the eye, is cream, judged by its middle so the edge is one clean line along the facets
  // and comes up to the eye's lower rim, which covers it.
  const eyeMid = onEgg(C, H.r, s.eye.dir).p[2] - C[2] + s.eye.size * 0.3;
  const skull = s.stage
    ? creamUnder(base, (p) => p[2] - C[2] < faceLine(p[1]))
    : creamWhere(base, (c) => !capped(c) && c[2] - C[2] < (c[1] - C[1] > -H.r[1] * 0.45 ? eyeMid : faceLine(c[1])));
  // The muzzle cream; the little one's all of it, one clean area with no flecks of skin at its top.
  const snout = s.stage ? creamUnder(orb(snoutC, snoutR, n + 2, k + 2, 'coat'), (p) => p[2] < snoutC[2] + sn[1] * 0.78) : orb(snoutC, snoutR, n + 2, k + 2, 'belly');
  // The crest: raised blocks of brick standing up in a row along the top of the head, from over the brow back over the crown and
  // down the back of it, each a little tipped back and overlapping the next, the last going on down onto the neck (`neckOf`).
  // The rest of the head is its plain skin.
  const plates: Mesh[] = [];
  const Cr = s.crest;
  for (let q = 0; q < Cr.count; q++) {
    const a = lerp(0.42, -1.25, q / Math.max(1, Cr.count - 1)), id = 500 + q;
    const e = onEgg(C, H.r, [0, Math.sin(a), Math.cos(a)]);
    const up = unit(add(e.n, [0, -0.25, 0.35])), big = 1 - 0.12 * Math.abs(q - (Cr.count - 1) * 0.35) / Cr.count;
    plates.push(block(add(e.p, scale(up, Cr.r[2] * 0.7)), scale(Cr.r, big), frameOf(up, [0, 1, 0]), s.stage === 0 && q % 2 ? 'muzzle' : brickMat(id, s.tiles.cream * 0.8), id, 0.06, 0.14));
    // The Bastiondrake's crest a helmet: each course of it four bricks across, stepping back over the crown -- the row down the
    // middle and one either side of it, lower -- so it covers most of the head's width and reads from in front.
    if (s.stage === 2 && q < Cr.count - 1) for (const sd of [-1, 1]) {
      const es = onEgg(C, H.r, [sd * 0.55, Math.sin(a) * 0.85, Math.cos(a)]), ups = unit(add(es.n, [0, -0.2, 0.25]));
      plates.push(block(add(es.p, scale(ups, Cr.r[2] * 0.45)), [Cr.r[0] * 1.15, Cr.r[1] * big, Cr.r[2] * 0.7], frameOf(ups, [0, 1, 0]), brickMat(id + 20 + sd, 0.3), id + 20 + sd, 0.06, 0.14));
    }
  }
  // A gentle smile: a thin line across the front of the snout, turned up at its corners, and on the bigger ones run back along the jaw.
  const reachBack = [0.55, 0.85, 0.95][s.stage];
  const mouth = paint([lineOn(Array.from({ length: 9 }, (_, q) => {
    const x = (q / 8 - 0.5) * 2;
    return onEgg(snoutC, snoutR, [x * reachBack, 1 - 0.55 * Math.abs(x) * reachBack, -0.18 + 0.22 * x * x - (s.stage ? 0.08 : 0)]);
  }), sn[0] * 0.035, 'lid')]);
  const nostrils = paint([1, -1].map((sd) => disc(add(onEgg(snoutC, snoutR, [sd * 0.32, 0.9, 0.45]).p, [0, 0.01, 0]), [sd * 0.2, 1, 0.5], sn[0] * 0.07, sn[0] * 0.05, 5, 'lid')));
  const cheeks = s.stage === 0 && paint([1, -1].map((sd) => {
    const e = onEgg(C, H.r, [sd * 0.8, 0.5, -0.12]);
    return disc(add(e.p, scale(e.n, 0.025)), e.n, H.r[0] * 0.17, H.r[0] * 0.11, 8, 'inner');
  }));
  // The little one's muzzle and cheeks one clean flat cream, painted over the facets so the light's steps across them do not fleck
  // it: a patch laid onto the snout and onto each side of the face under the eye, each bent round its egg.
  const patch = (c0: V3, r0: V3, dir: V3, rx: number, ry: number): Disc => {
    const e = onEgg(c0, r0, dir), d = disc(add(e.p, scale(e.n, 0.01)), e.n, rx, ry, 14, 'belly', { at: add(e.p, scale(e.n, 0.2)) });
    return { ...d, v: d.v.map((v) => { const q = onEgg(c0, r0, sub(v, c0)); return add(q.p, scale(q.n, 0.012)); }) };
  };
  const flat = s.stage === 0 && paint([
    patch(snoutC, snoutR, [0, 1, -0.1], sn[0] * 0.9, sn[1] * 0.9),
    ...[1, -1].map((sd) => patch(snoutC, snoutR, [sd * 0.85, 0.5, -0.1], sn[2] * 0.6, sn[1] * 0.8)),
    ...[1, -1].map((sd) => patch(C, H.r, [sd * 0.6, 0.75, -0.3], H.r[0] * 0.42, H.r[2] * 0.36)),
    ...[1, -1].map((sd) => patch(C, H.r, [sd * 0.9, 0.3, -0.2], H.r[1] * 0.38, H.r[2] * 0.3)),
    patch(C, H.r, [0, 1, -0.25], H.r[0] * 0.38, H.r[2] * 0.4),
  ]);
  return merge(skull, snout, ...plates, flat, mouth, nostrils, cheeks, eyesOf(s, shut));
}

/** A mesh with every face whose middle `where` picks painted cream. */
function creamWhere(m: Mesh, where: (c: V3) => boolean): Mesh {
  return mesh(m.v, m.f.map((f) => (!f.decal && where(scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length)) ? { ...f, m: 'belly' as Mat } : f)));
}

/** A mesh with every face that `under` says is in the cream painted cream. */
function creamUnder(m: Mesh, under: (p: V3) => boolean): Mesh {
  return mesh(m.v, m.f.map((f) => {
    // Judged by its highest corner, so every facet of a band between two rings of the ball goes the same way, and the line between
    // the cream and the skin is the ring, not a saw-tooth across it.
    const top = f.i.reduce((t, i) => (m.v[i][2] > t[2] ? m.v[i] : t), m.v[f.i[0]]);
    return under(top) ? { ...f, m: 'belly' as Mat } : f;
  }));
}

/**
 * The eyes, set on the front of the skull and looking forward as much as out: each a dark rim, a big amber iris, a darker ring,
 * a dark middle and two glints, laid onto the skull's own curve so it bends round the head and never stands off its outline.
 * All of an eye goes out of sight together when the head is between it and the viewer (`at`).
 */
function eyesOf(s: Brick, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size, tall = E.tall;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'lid', o), 0.014));
      continue;
    }
    out.push(onto(disc(p, n, r * (s.stage ? 1.14 : 1.3), r * (s.stage ? 1.16 : 1.3) * tall, 12, 'lid', o), 0.012));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystal', o), 0.016));
    out.push(onto(disc(add(p, scale(up, -r * 0.08)), n, r * 0.66, r * 0.68 * tall, 10, 'crystalDark', o), 0.02));
    // The little one's pupil bigger, so its eye is a dark dot with amber round it at the size the island is played at.
    const pu = s.stage ? 1 : 1.3;
    out.push(onto(disc(add(p, scale(up, -r * 0.06)), n, r * 0.42 * pu, r * 0.5 * tall * pu, 8, 'eye', o), 0.024));
    // The stage's lid: a line of its skin over the top of the bigger ones' eyes, so they look out rather than up.
    if (s.stage) out.push(onto(disc(add(p, scale(up, r * tall * 0.95)), n, r * 1.2, r * 0.32, 8, 'coat', o), 0.028));
    out.push(onto(disc(add(add(p, scale(up, r * 0.34 * tall)), scale(across, side * r * 0.3)), n, r * 0.3, r * 0.3, 6, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.38 * tall)), scale(across, -side * r * 0.3)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the snout. */
function headSolids(s: Brick): Array<{ c: V3; r: V3 }> {
  const H = s.head, sn = H.snout;
  return [{ c: skullAt(s), r: scale(H.r, 0.9) }, { c: snoutAt(s), r: [sn[0] * 0.85, sn[2] * 0.85, sn[1] * 0.85] }];
}

/** The neck: skin, cream under it, and the crest carried on down the back of it. */
function neckOf(s: Brick, n: number): Mesh {
  const N = s.neck;
  const m = tube([[0, 0, -0.3], [0, 0, N.len * 0.5], [0, 0.04, N.len + 0.05]], N.w, N.w * 0.92, n, (ring, j) => (Math.abs(((j + 1) / n) * TAU - Math.PI * 1.5) < 1.65 ? 'belly' : 'shell'), { seam: 'both' });
  const out: Mesh[] = [m];
  // The crest carried on down the back of the neck: raised blocks, overlapping, smaller toward the shoulders.
  const count = s.stage === 2 ? 3 : 2, Cr = s.crest;
  for (let q = 0; q < count; q++) {
    const z = lerp(N.len * 0.9, 0.0, (q + 0.5) / count), k = 0.92 - 0.1 * q;
    out.push(block([0, -N.w * 0.92, z], [Cr.r[0] * k, Cr.r[2] * k, Cr.r[1] * k], frameOf([0, -1, 0.25], [0, 0, 1]), brickMat(600 + q, s.tiles.cream), 600 + q, 0.06, 0.14));
  }
  return merge(...out);
}

/** A foot: a broad flat paw of its skin, its toes splayed forward and out, a dark hooked claw on each -- four on the little ones, three great ones on the Bastiondrake. */
function footOf(s: Brick, fore: boolean, n: number, k: number): Mesh {
  const L = fore ? s.fore : s.hind, w = s.thick * (s.stage === 2 ? 0.95 : 0.85), drop = L[2];
  const pad = orbAlong([0, w * 0.3, -drop + w * 0.32], [0, 1, 0], [w * 0.95, w * 0.44, w * 1.05], n, k, 'belly');
  const toes: Mesh[] = [];
  const count = s.stage === 2 ? 3 : 4, len = w * [0.95, 1.0, 1.15][s.stage], thick = w * [0.2, 0.22, 0.27][s.stage];
  for (let q = 0; q < count; q++) {
    const a = ((q - (count - 1) / 2) / Math.max(1, count - 1)) * 1.25;
    const dir = unit([Math.sin(a), Math.cos(a), 0]), root: V3 = [Math.sin(a) * w * 0.62, w * 0.55 + Math.cos(a) * w * 0.45, -drop + w * 0.26];
    // Hooked: out along the ground, then curving down to its point.
    toes.push(taper([root, add(root, add(scale(dir, len * 0.45), [0, 0, len * 0.06])), add(root, add(scale(dir, len * 0.8), [0, 0, -len * 0.02])), add(root, add(scale(dir, len), [0, 0, -len * 0.2]))], thick, w * 0.025, 5, 'claw'));
  }
  return merge(pad, ...toes);
}

/**
 * The plates on a leg: big curved bricks, a few to a leg. On its upper part one over the top of it and, on the bigger ones, two on
 * the dome of the haunch or the shoulder; on its lower part a cream one down its front and, on the Bastiondrake, a red one round
 * its outside. In each part's own frame, where `[side, 0, 0]` is the top of a sprawled upper leg and the outside of a lower one.
 */
function legPlates(s: Brick, side: number, w: number, L: readonly number[], lowerPart: boolean, fore: boolean): Mesh {
  const out: Mesh[] = [];
  const plate = (c: V3, dir: V3, r: V3, mat: Mat, id: number): void => { out.push(block(c, r, frameOf(dir, [0, 0, 1]), mat, id, 0.05, 0.22)); };
  if (!lowerPart) {
    const top: V3 = [side, 0, 0];
    plate(add([0, 0, -L[0] * 0.5], scale(top, w * 1.12)), top, [w * 0.9, L[0] * 0.36, w * 0.24], fore ? 'horn' : 'shellDark', 1600);
    if (s.stage) for (const sd of [-1, 1]) {
      const e = onEgg([0, 0, w * 0.1], [w * 1.5, w * 1.5, w * 1.3], [side * 0.85, sd * 0.5, 0.35]);
      plate(add(e.p, scale(e.n, w * 0.12)), e.n, [w * 0.62, w * 0.55, w * 0.2], sd > 0 ? 'horn' : 'shellDark', 1610 + sd);
    }
    return merge(...out);
  }
  const front = unit([side * 0.55, 0.85, 0]);
  plate(add([0, 0, -L[1] * 0.42], scale(front, w * 0.9)), front, [w * 0.62, L[1] * 0.34, w * 0.2], 'shell', 1620);
  if (s.stage === 2) {
    const outside: V3 = [side, -0.15, 0];
    plate(add([0, 0, -L[1] * 0.3], scale(unit(outside), w * 0.92)), unit(outside), [w * 0.6, L[1] * 0.26, w * 0.2], 'shellDark', 1630);
  }
  return merge(...out);
}

/** The tail's links: each a block, red and cream by turns, tapering; on the Bastiondrake a course of two bricks side by side, a stepped wall. */
function tailOf(s: Brick): Mesh[] {
  const T = s.tail;
  return T.links.map((L, q) => {
    const w0 = T.w[q], w1 = T.w[Math.min(q + 1, T.w.length - 1)], mat: Mat = (s.stage === 2 ? q % 3 === 1 : q % 2 === 1) ? 'horn' : 'shell';
    // A thick band of brick round a core of its skin, so a curled tail is one tail and not a string of blocks.
    // The little one's cream bands a fifth longer than its red, so the banding reads at its size.
    const long = s.stage === 0 ? (mat === 'horn' ? 0.62 : 0.5) : 0.55;
    const box = block([0, -L * 0.5, 0], [(w0 + w1) * 0.5, L * long, (w0 + w1) * 0.47], frameOf([0, 0, 1], [0, 1, 0]), mat, 700 + q, 0.05, 0.16);
    const core = tube([[0, 0.04, -w0 * 0.08], [0, -L - 0.02, -w1 * 0.08]], [w0 * 0.86, w1 * 0.86], [w0 * 0.8, w1 * 0.8], 6, 'shellDark');
    // The underside of the root of the tail cream, carrying the belly's cream on under it.
    return q < 3 ? creamWhere(merge(core, box), (c) => c[2] < -w0 * 0.3) : merge(core, box);
  });
}

/* ---- what it carries ------------------------------------------------------------------------------ */

/** A ring of bricks, a course of a round thing: `count` round a circle `r` across at height `z`, each `h` high and `t` thick. */
function ringCourse(c: V3, r: number, z: number, h: number, t: number, count: number, offset: number, seed: number, cream: number): Mesh[] {
  const out: Mesh[] = [];
  for (let q = 0; q < count; q++) {
    const th = ((q + offset) / count) * TAU, dir: V3 = [Math.cos(th), Math.sin(th), 0];
    const len = (Math.PI * r) / count * 0.94;
    out.push(block(add(c, [dir[0] * r, dir[1] * r, z]), [len, h, t], frameOf(dir, [0, 0, 1]), brickMat(seed + q, cream), seed + q, 0.05));
  }
  return out;
}

/**
 * A round tub of brick: two red courses under a thick cream rim, heaped above its rim. A hod is heaped with soft pale mortar
 * in a mound, a few dark lumps in it; the fort's tub with `lumps` big grey lumps of rubble.
 */
function hodOf(c: V3, r: number, h: number, seed: number, heap: number, lumps = 0): Mesh {
  const out: Mesh[] = [];
  const ch = h / 3;
  ([[0, 0.08, 0.15], [1, 0.08, 0.15], [2, 0.97, 0.24]] as const).forEach(([q, cream, t]) =>
    out.push(...ringCourse(c, r, ch * (q + 0.5), ch * 0.48, r * t, 9, q % 2 ? 0.5 : 0, seed + q * 13, cream)));
  out.push(tube([add(c, [0, 0, 0.02]), add(c, [0, 0, h * 0.85])], r * 0.9, r * 0.9, 9, 'stoneDark'));
  if (!lumps) {
    // The mortar, a mound heaped over the rim, and two or three dark lumps in it.
    out.push(orb(add(c, [0, 0, h * 0.9]), [r * 0.86, r * 0.86, r * 0.42 * heap], 9, 4, 'spot'));
    for (let q = 0; q < 2; q++) {
      const a = q * 2.9 + 0.5, d = r * 0.42;
      out.push(rubble(add(c, [Math.cos(a) * d, Math.sin(a) * d, h * 0.9 + r * 0.28 * heap]), r * 0.1, seed + 40 + q, 'stone'));
    }
    return merge(...out);
  }
  // Rubble: a grey mound over the rim and lumps of every size heaped on it in three tiers -- a ring of big ones, a ring of smaller
  // ones on them, one on top -- as high again over the rim as half the tub is tall.
  out.push(orb(add(c, [0, 0, h * 0.95]), [r * 0.86, r * 0.86, h * 0.4], 9, 4, 'stone'));
  const tiers: Array<[number, number, number, number]> = [[Math.max(4, lumps - 3), 0.56, 1.22, 0.32], [2, 0.3, 1.62, 0.45], [1, 0, 1.98, 0.42]];
  let id = 0;
  for (const [count, d, z, size] of tiers) {
    for (let q = 0; q < count; q++, id++) {
      const a = (q / count) * TAU + 0.4 + z, k = 0.8 + 0.4 * jitter(seed + id);
      out.push(rubble(add(c, [Math.cos(a) * d * r, Math.sin(a) * d * r, h * z]), r * size * k, seed + 40 + id, id % 3 === 1 ? 'spot' : id % 2 ? 'stone' : 'stoneDark'));
    }
  }
  // And two spilled over the rim onto the back beside it.
  for (const [a, z] of [[0.6, 0.55], [2.4, 0.35]] as const) out.push(rubble(add(c, [Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12, h * z]), r * 0.26, seed + 70 + a * 10, 'stone'));
  return merge(...out);
}

/** A stack of bricks, `courses` high and `across` wide, red and cream by turns, each course half a brick along from the last. */
function stackOf(c: V3, r: V3, courses: number, across: number, seed: number, up: V3 = [0, 0, 1], cream = 0.4): Mesh {
  const out: Mesh[] = [];
  const f = frameOf(up, [0, 1, 0]);
  for (let q = 0; q < courses; q++) {
    for (let j = 0; j < across; j++) {
      const off = (j - (across - 1) / 2) * r[0] * 2.04 + (q % 2 ? r[0] * 0.25 : -r[0] * 0.25);
      const at = add(c, add(scale(f[0], off), scale(f[2], r[2] * (2 * q + 1) * 1.04)));
      out.push(block(at, r, f, brickMat(seed + q * 7 + j, cream), seed + q * 7 + j));
    }
  }
  return merge(...out);
}

/** A square pillar of bricks, `courses` high: two bricks to each face of each course, turned a half brick at every course. */
function pillarOf(c: V3, half: number, courses: number, ch: number, seed: number, cream: number, cap?: Mat): Mesh {
  const out: Mesh[] = [];
  for (let q = 0; q < courses; q++) {
    const z = c[2] + ch * (q + 0.5);
    for (let face = 0; face < 4; face++) {
      const th = (face / 4) * TAU + (q % 2 ? Math.PI / 4 : 0) * 0, dir: V3 = [Math.cos(th), Math.sin(th), 0], along: V3 = [-Math.sin(th), Math.cos(th), 0];
      for (let j = 0; j < 2; j++) {
        const off = (j - 0.5) * half + (q % 2 ? half * 0.25 : -half * 0.25) * (face % 2 ? 1 : -1);
        const id = seed + q * 9 + face * 2 + j;
        out.push(block(add([c[0], c[1], z], add(scale(dir, half * 0.84), scale(along, off))), [half * 0.5, ch * 0.47, half * 0.17], frameOf(dir, [0, 0, 1]), cap && q === courses - 1 ? cap : brickMat(id, cream), id, 0.04));
      }
    }
  }
  // Its core, so there is no seeing through between its bricks.
  out.push(tube([[c[0], c[1], c[2]], [c[0], c[1], c[2] + ch * courses - 0.02]], half * 0.8, half * 0.8, 4, 'shellDark', { turn: 0 }));
  return merge(...out);
}

/** The tower: a square cream stone tower with an arch through its front, the dark of its opening in it, a red cap. */
function towerOf(c: V3, half: number, high: number, seed: number): Mesh {
  const out: Mesh[] = [];
  const courses = 8, ch = high / courses;
  for (let q = 0; q < courses; q++) {
    const z = c[2] + ch * (q + 0.5);
    for (let face = 0; face < 4; face++) {
      const th = (face / 4) * TAU, dir: V3 = [Math.cos(th), Math.sin(th), 0], along: V3 = [-Math.sin(th), Math.cos(th), 0];
      // The face to its right has the arch through it: no blocks in its middle in the lower courses.
      const front = face === 0;
      for (let j = 0; j < 2; j++) {
        if (front && q < 4) continue;
        const off = (j - 0.5) * half + (q % 2 ? half * 0.22 : -half * 0.22);
        const id = seed + q * 9 + face * 2 + j;
        out.push(block(add([c[0], c[1], z], add(scale(dir, half * 0.86), scale(along, off))), [half * 0.5, ch * 0.47, half * 0.15], frameOf(dir, [0, 0, 1]), q === courses - 1 ? brickMat(id, 0) : jitter(id) < 0.75 ? 'horn' : 'hornDark', id, 0.04));
      }
      if (front && q < 4) {
        // The jambs either side of the arch.
        for (const sd of [-1, 1]) {
          const id = seed + 200 + q * 2 + (sd > 0 ? 1 : 0);
          out.push(block(add([c[0], c[1], z], add(scale(dir, half * 0.86), scale(along, sd * half * 0.86))), [half * 0.13, ch * 0.47, half * 0.15], frameOf(dir, [0, 0, 1]), jitter(id) < 0.7 ? 'horn' : 'hornDark', id, 0.04));
        }
      }
    }
  }
  // The arch over the opening: voussoirs round a half circle, and the dark of the way through under it.
  // A true round arch: red voussoirs round a half circle and a keystone, over a doorway as wide as half the face.
  const R0 = half * 0.66, springAt = c[2] + ch * 4 - R0 - half * 0.12, X = c[0] + half * 0.9;
  for (let q = 0; q < 7; q++) {
    const a = Math.PI * (q + 0.5) / 7, p: V3 = [X, c[1] + Math.cos(a) * (R0 + half * 0.08), springAt + Math.sin(a) * (R0 + half * 0.08)];
    out.push(block(p, [half * 0.16, half * 0.11, half * (q === 3 ? 0.15 : 0.11)], frameOf(unit([0, Math.cos(a), Math.sin(a)]), [1, 0, 0]), q === 3 ? 'shellDark' : 'shell', seed + 300 + q, 0.04));
  }
  const way: V3[] = [[X + half * 0.07, c[1] + R0, c[2] + 0.04], ...Array.from({ length: 9 }, (_, q) => { const a = Math.PI * (q / 8); return [X + half * 0.07, c[1] + Math.cos(a) * R0, springAt + Math.sin(a) * R0] as V3; }),
    [X + half * 0.07, c[1] - R0, c[2] + 0.04]];
  out.push(paint([facingDisc(way, [1, 0, 0], 'lid')]));
  // Its core.
  out.push(tube([[c[0], c[1] - half * 0.1, c[2]], [c[0], c[1] - half * 0.1, c[2] + high - 0.02]], half * 0.74, half * 0.66, 4, 'hornDark', { turn: 0 }));
  // The cap: a course of red bricks overhanging it a little.
  out.push(...ringCourse([c[0], c[1], c[2] + high], half * 0.98, ch * 0.4, ch * 0.32, half * 0.16, 8, 0.5, seed + 400, 0));
  return merge(...out);
}

/** The trowel: a wooden handle, a short iron neck, and a flat diamond blade, in its own frame with the handle's end at the origin and the blade down `-z`. */
function trowelOf(): Mesh {
  const k = TROWEL_K;
  const handle = tube([[0, 0, 0.02], [0, 0, -0.3 * k]], [0.055 * k, 0.05 * k], [0.055 * k, 0.05 * k], 6, 'bark');
  // The steel collar where the handle meets the shank.
  const collar = tube([[0, 0, -0.27 * k], [0, 0, -0.33 * k]], 0.065 * k, 0.065 * k, 6, 'metal');
  const shank = tube([[0, 0, -0.3 * k], [0, 0.04 * k, -0.36 * k], [0, 0.03 * k, -0.42 * k]], 0.016 * k, 0.016 * k, 4, 'metal');
  // A flat steel blade, a diamond, broad enough to be seen flat on.
  const v: V3[] = [[0, 0.02 * k, -0.4 * k], [0.17 * k, 0.03 * k, -0.55 * k], [0, 0.04 * k, -0.84 * k], [-0.17 * k, 0.03 * k, -0.55 * k]];
  const w: V3[] = v.map((p) => [p[0], p[1] - 0.014 * k, p[2]]);
  const all = [...v, ...w];
  const blade = mesh(all, wound(all, [{ i: [0, 1, 2, 3], m: 'metal' }, { i: [4, 7, 6, 5], m: 'metal' }, { i: [0, 4, 5, 1], m: 'metal' }, { i: [1, 5, 6, 2], m: 'metal' }, { i: [2, 6, 7, 3], m: 'metal' }, { i: [3, 7, 4, 0], m: 'metal' }], [0, 0.025 * k, -0.58 * k]));
  // A smear of mortar on its tip.
  const load = orb([0, 0.045 * k, -0.74 * k], [0.07 * k, 0.025 * k, 0.07 * k], 6, 3, 'stone');
  return merge(handle, collar, shank, blade, load);
}

/** Where on its back its load sits, by stage: the hod and its stack; the fort's tower, tub of rubble, chimneys and cream band. */
function loadOf(s: Brick): Piece[] {
  const B = s.body;
  const top = (y: number): number => { const r = ringAt(B, y); return r.z + r.h; };
  const out: Piece[] = [];
  if (s.load === 1) {
    const hy = HOD_Y, hod = hodOf([0, hy, top(hy) - 0.06], HOD_R, HOD_H, 800, 1);
    const sy = -0.55, stack = stackOf([0, sy, top(sy) - 0.08], [0.21, 0.11, 0.09], 4, 2, 820, [0, -0.15, 1], 0.5);
    out.push({ key: 'hod', mesh: merge(hod, stack), bone: 'trunk', bias: 0.12, after: ['body', 'back'] });
  } else if (s.load === 2) {
    // The tower at the shoulders on its left, its arch to the right; the great tub of rubble on the right behind it, so the arch is
    // clear of it and each is seen past the other; two chimneys of red brick behind and beside the tub.
    const ty = 0.45, tower = towerOf([-0.4, ty, top(ty) - 0.3], 0.62, 2.6, 900);
    const by = -1.2, basket = hodOf([0.55, by, top(by) - 0.25], 0.82, 0.85, 960, 1, 7);
    const chimneys = merge(
      pillarOf([-0.6, -1.2, top(-1.2) - 0.35], 0.37, 11, 0.3, 1000, 0.36),
      pillarOf([-0.15, -2.3, top(-2.3) - 0.35], 0.33, 11, 0.3, 1050, 0.36),
    );
    // The cream band: a course of cream blocks round the back, like a parapet's string course.
    const band: Mesh[] = [];
    for (let q = 0; q < 10; q++) {
      const y = lerp(-1.75, 1.45, q / 9);
      for (const sd of [1, -1]) {
        const e0 = onRings(B, y, 0.98), e = sd > 0 ? e0 : { p: [-e0.p[0], e0.p[1], e0.p[2]] as V3, n: [-e0.n[0], e0.n[1], e0.n[2]] as V3 };
        band.push(block(add(e.p, scale(e.n, 0.1)), [0.17, 0.17, 0.13], frameOf(e.n, [0, 1, 0]), jitter(q + sd * 3) < 0.7 ? 'horn' : 'hornDark', 1300 + q * 2 + (sd > 0 ? 0 : 1)));
      }
    }
    out.push({ key: 'band', mesh: merge(...band), bone: 'trunk', bias: 0.1, after: ['body', 'back'] });
    // One piece, so its tower, tub and chimneys go down far to near among themselves from whichever side it is seen.
    out.push({ key: 'fort', mesh: merge(basket, chimneys, tower), bone: 'trunk', bias: 0.12, after: ['body', 'back', 'band'] });
  }
  return out;
}

/** What it works: a brick lying crosswise for the two little ones, a block of cream stone for the Bastiondrake; on the ground, in the site's frame. */
function siteOf(s: Brick, R: Rest): Mesh {
  const r = R.siteR;
  if (s.stage < 2) return merge(block([0, 0, r[2]], r, frameOf([0, 0, 1], [0, 1, 0]), 'shell', 1400, 0.03), paint([disc([0, 0, r[2] * 2 + 0.01], [0, 0, 1], r[0] * 0.5, r[1] * 0.4, 6, 'stone')]));
  // The block, its far bottom edge at the frame's origin so it tips about it.
  return block([0, -r[1], r[2]], r, frameOf([0, 0, 1], [0, 1, 0]), 'horn', 1410, 0.04);
}

/** A stage's pieces. */
function brickBuild(s: Brick, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6), R = restOf(s);
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 2), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  pieces.push({ key: 'back', mesh: coursesOf(s), bone: 'trunk', bias: 0.08, after: ['body'] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: 'head', convex: s.stage < 1 });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  tailOf(s).forEach((m, q) => pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.05 + q * 0.01 }));
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const foot = footOf(s, fore, n, k);
    // A lizard's leg comes out of the side of its body: the shoulder or the haunch a round mass at the root of the upper leg, and
    // the upper leg out sideways from it to the elbow or the knee, drawn over the flank on the near side and under it on the far,
    // so the sprawl shows from every side; then the lower leg down to the foot.
    const side3: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    // Its skin red brick under a few big plates (`legPlates`): the haunch or the shoulder a dome, the upper leg out of it to a
    // round knee or elbow, so a bent joint is a joint and not the end of a pipe, then the lower leg down to the foot.
    // The underside of the upper leg, the inner thigh, cream, as the belly it comes out of.
    const inner = (c: V3): boolean => c[0] * side < -w * 0.35 && c[2] < w * 0.2;
    // The Bastiondrake's hind haunch a third again as big, as heavy as its shoulder.
    const hw = s.stage === 2 && !fore ? w * 1.3 : w;
    const upper = merge(creamWhere(merge(orb([0, 0, hw * 0.1], [hw * 1.5, hw * 1.5, hw * 1.3], n + 1, k + 1, 'shell'), tube([[0, 0, 0], [0, 0, -L[0]]], [hw * 1.3, w * 1.0], [hw * 1.3, w * 1.0], n, 'shell', { seam: 'start' }),
      orb([0, 0, -L[0]], w * 1.02, n, k, 'shell')), inner), legPlates(s, side, hw, L, false, fore));
    const lower = merge(tube([[0, 0, w * 0.7], [0, 0.02, -L[1]]], [w * 1.0, w * 0.86], [w * 1.0, w * 0.86], n, 'belly', { seam: 'start' }), legPlates(s, side, w, L, true, fore));
    pieces.push(
      { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.01, after: ['body', 'back'], front: side3 },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: out3 },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.03, after: ['body', `${key}1`], front: out3 },
    );
  }
  pieces.push(...loadOf(s));
  if (s.load === 1) pieces.push({ key: 'trowel', mesh: trowelOf(), bone: 'trowel', bias: 0.13, after: ['body', 'back', 'hod', 'head'] });
  pieces.push({ key: 'site', mesh: siteOf(s, R), bone: 'site', bias: 0, shown: (a) => a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0) });
  // Everything on the trunk bends with its spine as it goes (`waveOf`), as the legs, the neck and the tail come out of it.
  const bend = (v: readonly V3[], a: Anim): V3[] => { const w = waveOf(s, a); return w ? v.map((p) => bendPt(s, p, w)) : [...v]; };
  return pieces.map((pc) => (pc.bone === 'trunk' ? { ...pc, bent: bend } : pc));
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Mortar dust, and the brick dust a blow knocks off. */
const DUST: RGB = [196, 180, 164];
const BRICK_DUST: RGB = [214, 150, 120];
/** The colours of what flies off it, the same on every variant: chips of red brick, of cream stone, of grey mortar. */
const CHIP_RGB: readonly RGB[] = [[198, 98, 70], [238, 222, 192], [150, 146, 142]];

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Mortarback's: less than in proportion on the small one, so they still read. */
const bigness = (s: Brick): number => 0.5 + 0.5 * (s.len / 2.1);

/** A chip of brick in the air: a small hard-edged block, lit on its top face, dark-edged, never under a pixel and a half. */
function chip(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01 || r <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, Math.min(1.5 / px, r * 3));
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = css(mix(c, [60, 40, 36], 0.22), al);
  g.strokeStyle = css(mix(c, [50, 30, 26], 0.6), al);
  g.lineWidth = Math.max(r * 0.2, 0.1);
  g.beginPath();
  g.rect(-r, -r * 0.6, r * 2, r * 1.2);
  g.fill();
  g.stroke();
  g.fillStyle = css(mix(c, [255, 248, 236], 0.28), al);
  g.fillRect(-r, -r * 0.6, r * 2, r * 0.5);
  g.restore();
}

/** A puff of dust: a soft cloud of three lobes, each a radial falloff, growing as it goes and thinning to nothing over its life (`age`). */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0, base: RGB = DUST): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
  const c = mix(base, [252, 246, 236], 0.2 + 0.35 * age);
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

/** Chips of brick and mortar thrown from `from`, `since` seconds after, up and out; each drawn in front of the body or behind it. */
function spray(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.5): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.6 + 0.6 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp, Math.sin(a) * sp, up * (0.7 + 0.6 * jitter(k + 2))];
    const p = thrown(from, v, since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    chip(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), k + since * (10 + 6 * jitter(k + 4)), CHIP_RGB[q % 3], 1 - smooth((since - life * 0.6) / (life * 0.4)));
  }
}

/**
 * What a strike throws: the Brickling's headbutt a puff of brick dust and a few chips off its crest; the Mortarback's swipe dust
 * off the ground where its tail sweeps and chips off its end; the Bastiondrake's stamp the ground cracked under its feet, a ring
 * of dust going out and chips thrown up, and its tail's slam a second puff behind it.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Brick, b: Bones, at: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - BRICK_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  if (s.stage === 0) {
    const crown = place(at.head, [0, s.head.r[1] * 0.6, s.head.up + s.head.r[2] * 0.6]);
    if (nearSide(crown, mid, view) === front || front) puff(g, view, crown, 0.4 * big, since / 0.32, 3, BRICK_DUST);
    spray(g, view, mid, crown, since, front, 7, 40, 2.4 * big, 4.5, 0.08 * big);
    return;
  }
  if (s.stage === 1) {
    const n = s.tail.links.length - 1, end = place(at[`tail${n}`], [0, -s.tail.links[n] * 0.6, 0]), ground: V3 = [end[0], end[1], 0.1];
    if (nearSide(ground, mid, view) === front) puff(g, view, ground, 0.55 * big, since / 0.36, 5);
    spray(g, view, mid, end, since, front, 9, 60, 3 * big, 4, 0.09 * big);
    return;
  }
  const feet = [place(at.fl2, [0, 0, -s.fore[2]]), place(at.fr2, [0, 0, -s.fore[2]])], ground = scale(add(feet[0], feet[1]), 0.5);
  ground[2] = 0.02;
  if (!front && since < 0.5) {
    const [gx, gy] = onScreen(view, ground), k = 1 - ramp(since, 0.25, 0.5);
    g.save();
    g.strokeStyle = css([78, 58, 46], k);
    g.lineCap = 'round';
    for (let c = 0; c < 9; c++) {
      const th = (c / 9) * TAU + jitter(c + 50) * 0.6, L = (1.2 + 1.0 * jitter(c + 51)) * big * ramp(since, 0, 0.05);
      g.lineWidth = 0.12 * big;
      g.beginPath();
      g.moveTo(gx, gy);
      g.lineTo(gx + Math.cos(th) * L * 0.5, gy + Math.sin(th) * L * 0.27);
      g.lineTo(gx + Math.cos(th) * L, gy + Math.sin(th) * L * 0.52);
      g.stroke();
    }
    g.restore();
  }
  if (since < 0.5) {
    const out = ramp(since, 0, 0.4), rx = big * (1.4 + 3.4 * out);
    for (let c = 0; c < 9; c++) {
      const th = (c / 9) * TAU + 0.3, p: V3 = [ground[0] + Math.cos(th) * rx, ground[1] + Math.sin(th) * rx * 0.75, 0.15 * big];
      if (nearSide(p, mid, view) === front) puff(g, view, p, big * 0.6, since / 0.5, 30 + c);
    }
  }
  for (const [q, f] of feet.entries()) spray(g, view, mid, [f[0], f[1], 0.15], since, front, 7, 700 + q * 50, 2.6 * big, 6, 0.12 * big, 0.6);
  // The tail's slam behind it.
  const ts = (t - BASTION_SLAM) * ACT_SECS.strike;
  if (ts > 0 && ts < 0.4) {
    const n = s.tail.links.length - 1, end = place(at[`tail${n}`], [0, 0, 0]), p: V3 = [end[0], end[1], 0.3 * big];
    const tb = place(b.tail0, [0, 0, 0]);
    if (nearSide(p, mid, view) === front) puff(g, view, [tb[0], tb[1], 0.3 * big], big * 0.9, ts / 0.4, 8);
  }
}

/**
 * What a go at its task throws: at each tap or pat on the brick a puff of mortar dust and a few grains; the Mortarback's trowel
 * flicking mortar as it stirs and strokes; the Bastiondrake's block a heavy puff and chips as it drops into its seat and as it
 * is stamped.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Brick, b: Bones, R: Rest, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, loop = a.graze >= 0.5, W = BRICK_WORK;
  const since = (t0: number): number => (t < t0 && !loop ? -1 : frac(t - t0) * ACT_SECS.work);
  const S = R.site, top: V3 = [S[0], S[1], R.siteR[2] * 2 + 0.02];
  const hits: number[] = s.stage === 0 ? [...W.taps, W.pat] : s.stage === 1 ? [W.strokes[0], W.strokes[1], W.tap] : [W.seat, W.stamp];
  hits.forEach((h, q) => {
    const dt = since(h);
    if (dt < 0 || dt > 0.5) return;
    const heavy = s.stage === 2 ? 1.6 : q === hits.length - 1 ? 1.15 : 0.85;
    for (const sd of [-1, 1]) {
      const p: V3 = [top[0] + sd * R.siteR[0] * (0.9 + 0.8 * ramp(dt, 0, 0.3)), top[1], top[2] * 0.6 + 0.1 * big * ramp(dt, 0, 0.3)];
      if (nearSide(p, mid, view) === front) puff(g, view, p, 0.28 * big * heavy, dt / 0.45, q * 3 + sd);
    }
    spray(g, view, mid, top, dt, front, s.stage === 2 ? 8 : 4, 200 + q * 31, 1.6 * big, 3.2, 0.06 * big * heavy, 0.45);
  });
  // The Bastiondrake's stamp: dust out from under its foot.
  if (s.stage === 2) {
    const dt = since(W.stamp);
    if (dt >= 0 && dt < 0.45) {
      const f = place(b.fr2, [0, 0, -s.fore[2]]);
      for (const sd of [-1, 1]) {
        const p: V3 = [f[0] + sd * s.thick * (1 + 2 * ramp(dt, 0, 0.3)), f[1], 0.15 * big];
        if (nearSide(p, mid, view) === front) puff(g, view, p, 0.5 * big, dt / 0.45, 40 + sd);
      }
    }
  }
  // The trowel flicking mortar as it stirs in the hod.
  if (s.stage === 1 && b.trowel) {
    const dt = since(W.grip + 0.06);
    if (dt >= 0 && dt < 0.4) {
      const blade = place(b.trowel, BLADE_TIP());
      spray(g, view, mid, blade, dt, front, 4, 260, 1.2 * big, 3, 0.05 * big, 0.4);
    }
  }
}

/**
 * Evolving: at the start a burst of brick chips and dust off it, which covers the moment it changes into its new body; then
 * chips of brick and stone swirling up round it and in, gone into it at the flash.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Brick, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], B = s.body;
  const burst = 1 - ramp(t, 0.1, 0.26);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    if (front) {
      const cloud = (1 - ramp(t, 0.05, 0.24)) * 0.9;
      for (const [y, z, r] of [[0, 1, 0.7], [s.len * 0.45, 1.2, 0.5], [-s.len * 0.45, 0.9, 0.5]]) {
        const p: V3 = [0, y, b.body.t[2] * z + since * 0.6];
        puff(g, view, p, (s.len * r + 1.2 * since) * (0.8 + 0.2 * big), 0.25 + 0.75 * (1 - cloud), 11 + y);
      }
    }
    for (let q = 0; q < 30; q++) {
      const th = (q / 30) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * B.w[3] * 0.6, Math.sin(th) * s.len * 0.45, B.h[3] * 0.7]);
      const v: V3 = [Math.cos(th) * (2 + 2 * jitter(q + 3)), Math.sin(th) * (2 + 2 * jitter(q + 5)), 3 + 3 * jitter(q + 7)];
      const p = thrown(from, scale(v, Math.sqrt(big)), since, 6);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      chip(g, x, y, 0.12 * big, q * 1.3 + since * 8, CHIP_RGB[q % 3], burst * ramp(t, 0, 0.03));
    }
  }
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl > 0) {
    const rx = B.w[3] * 1.5 + 0.3 * big, ry = s.len * 0.85 + 0.3 * big, high = B.h[3] * 2.4 + 1.0 * big;
    for (let q = 0; q < 20; q++) {
      const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32);
      const ang = (q / 20) * TAU + u * TAU * 1.4;
      const k = (1 - u) ** 1.2;
      const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -B.h[3] * 0.4 + u * high * 0.7]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      chip(g, x, y, 0.13 * big * (1 - 0.4 * u), ang * 2 + q, CHIP_RGB[q % 3], swirl * ramp(u, 0, 0.15));
    }
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function brickKind(s: Brick): Kind {
  const bones = brickBones(s), R = restOf(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: BRICK_HITS[s.stage] } });
  return {
    bones,
    build: (lod) => brickBuild(s, lod),
    // The variant's coat tints its skin and its markings the cream of its jaw, belly and tail; the brick, the cream stone, the
    // grey mortar, its dark claws and its amber eyes are the same on every variant, so every one of them is brick red.
    palette: (coat, mark) => {
      // By as much as the variant's colour has colour in it: a red or a cream variant tints them, a grey one hardly at all, so
      // the cream stays cream and the skin salmon whatever the variant.
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const skin = mix([228, 124, 76], pastel(coat, 24), 0.3 * clamp(sat(coat) / 0.35)), cream = mix([252, 218, 168], pastel(mark, 30), 0.3 * clamp(sat(mark) / 0.35));
      return coatPalette(coat, mark, {
        coat: skin,
        coatDark: darkerOf(skin, 0.2),
        coatLight: mix(skin, [255, 244, 230], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 252, 242], 0.65),
        inner: [240, 150, 140],
        lid: [92, 50, 40],
        nose: [92, 50, 40],
        eye: [40, 24, 22],
        glint: [255, 253, 246],
        crystal: [236, 150, 44],
        crystalDark: [176, 94, 34],
        claw: [56, 36, 32],
        shell: [204, 96, 68],
        shellDark: [172, 74, 56],
        horn: mix([246, 226, 190], cream, 0.35),
        hornDark: [226, 198, 156],
        stone: [182, 177, 172],
        stoneDark: [140, 134, 130],
        bark: [226, 178, 118],
        spot: [204, 200, 194],
        metal: [176, 180, 186],
      } as Partial<ReturnType<Kind['palette']>>, 24);
    },
    shadow: [s.len * 0.8 + s.tail.links.reduce((x, y) => x + y, 0) * 0.15, s.body.w[3] * 1.35],
    stride: 1.2,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are brick red and cream stone.
    motes: [[214, 112, 80], [246, 230, 200]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, R, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

const darkerOf = (c: RGB, t: number): RGB => mix(c, [44, 34, 40], t);

export const BRICKLING = brickKind(BRICKLING_LOOK);
export const MORTARBACK = brickKind(MORTARBACK_LOOK);
export const BASTIONDRAKE = brickKind(BASTIONDRAKE_LOOK);
