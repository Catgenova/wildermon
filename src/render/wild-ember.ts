import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, eyes, frac, lerp, merge, mix, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type MatOf, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The ember line: the Emberkit, a small fox of a kit on four legs, deep red and ember orange with dark brown shading on its
 * back, a cream ruff on its chest and cheeks, tall pointed ears red outside and cream inside, a slim muzzle with a dark nose,
 * amber eyes, a big curled tail of cream and red fluff, a glowing gold spiral on each haunch, and cream legs on dark claws,
 * its fore claws long, a little rake on each paw; which grows into the Emberbrush, bigger and longer in the leg, a beak for
 * a muzzle, swept-back crests of red feathers for ears, a cream feathered ruff and mantle, dark-feathered legs, a huge fan
 * of feathered plumes rising off its rump -- red with glowing ember streaks, cream inside -- and its right fore paw grown
 * into a long rake of five red-and-cream tines; and then the Ashsweeper, large, a raptor's beak in a cream face under a red
 * crest with a glowing rune on its brow, an enormous fan of plumes, red armour plates with glowing spirals on its shoulders
 * and haunches, bronze bands round its forelegs, and a great wide rake held in its fore paws: a cream-gold bar with glowing
 * red marks and a row of long curved red tines. Walking, it carries the rake across its beak. The species is still `cindra`
 * underneath, as saves and the database know it: the ash raker.
 *
 * Built the way the hare line is (`./wild-hare`): one set of functions from a description of each stage (`Ember`), every foot
 * given a point to be at and its leg bent to reach it, so a planted foot stays where it was put and a knee never flips. Its
 * front is `y`, its right `x`, up `z`.
 *
 * At its task it rakes the ashes out of a fire or a furnace and drags them back: the Emberkit with its fore claws, right,
 * left and right; the Emberbrush with its rake of a paw, reached far out and dragged back twice; the Ashsweeper with its
 * rake, pushed out and dragged back twice. Each drag throws up grey ash and glowing embers.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Ember {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest, about its middle. */
  body: Rings;
  /** Hip to shoulder; how far out the shoulders and hips are against the barrel's width there, and down it against its depth. */
  len: number; hip: number; drop: number;
  /** Each leg: upper, lower and the pastern or long hind foot; how thick at the top. */
  fore: [number, number, number]; hind: [number, number, number]; thick: number;
  /** How far each last part leans back from upright standing, fore and hind (degrees). */
  slope: [number, number];
  paw: number;
  /** How far behind its shoulder a fore paw stands, and behind its hip a hind one. */
  stance: [number, number];
  /** How high the middle of the barrel is carried. */
  high: number;
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes, how far up it sits on the neck, its pitch. */
  head: { r: V3; up: number; pitch: number };
  /** The kit's slim muzzle: how long, wide and deep at its root. */
  snout: { len: number; w: number; h: number } | null;
  /** The bigger two's beak: how long, wide and deep at its root, and how far its tip hooks down. */
  beak: { len: number; w: number; h: number; hook: number } | null;
  eye: { dir: V3; size: number };
  /** The kit's right ear on the skull: root, length, half-width, splay out, laid back, hollow turned out. */
  ear: { at: V3; len: number; w: number; splay: number; back: number; turn: number } | null;
  /** The bigger two's crest of feathers on each side for ears: root, the longest's length and width, how many, laid back, splay. */
  crest: { at: V3; len: number; w: number; n: number; back: number; splay: number } | null;
  /** The Ashsweeper's red brow plate with its rune: its size; nought for none. */
  rune: number;
  /** The ruff's egg on the chest, and its locks or feathers. */
  ruff: { c: V3; r: V3; len: number; rows: number; across: number };
  /** The cream feathered mantle over its shoulders, how long its feathers are; nought for fur. */
  cape: number;
  /** The kit's curled plume: root, links, girths, lifted and curled. */
  tail: { at: V3; links: number[]; w: number[]; lift: number; curl: number } | null;
  /** The bigger two's fan of plumes: its root, how many red plumes, how long and how wide at most, from and to (degrees up from straight back), how far out to the sides. */
  fan: { at: V3; n: number; len: number; wide: number; from: number; to: number; side: number } | null;
  /** How big the spiral on each haunch is, against the haunch. */
  spiral: number;
  /** How long the fore claws are, against a paw. */
  claws: number;
  /** The Emberbrush's rake of a right fore paw: its tines and how long. */
  hand: { tines: number; len: number } | null;
  /** The Ashsweeper's rake: how wide, its tines, how long, the bar's height standing, and how far ahead of the fore paws. */
  tool: { w: number; tines: number; len: number; high: number; ahead: number } | null;
  armour: boolean;
  /** Bronze bands on each foreleg. */
  bands: number;
  /** Dark brown shading on its back: how many strokes. */
  dapples: number;
  gait: { duty: [number, number]; swing: [number, number]; step: number; bob: number };
  size: number;
}

/** An Emberkit: small and slim on short legs, a big head, tall ears, a slim muzzle, a big curled tail of fluff. */
const EMBERKIT_LOOK: Ember = {
  stage: 0,
  body: { y: [-0.9, -0.8, -0.46, 0, 0.42, 0.72, 0.86], z: [0.07, 0.06, 0.03, 0, 0.03, 0.08, 0.12], w: [0.26, 0.4, 0.44, 0.43, 0.45, 0.42, 0.28], h: [0.27, 0.41, 0.45, 0.44, 0.47, 0.44, 0.3] },
  len: 1.3, hip: 0.66, drop: 0.32,
  fore: [0.34, 0.32, 0.12], hind: [0.4, 0.33, 0.27], thick: 0.17, slope: [12, 22], paw: 0.12, stance: [-0.1, 0.12],
  high: 0.86,
  neck: { at: [0, 0.7, 0.3], len: 0.36, w: 0.27, lean: 30 },
  head: { r: [0.4, 0.48, 0.38], up: 0.1, pitch: 4 },
  snout: { len: 0.58, w: 0.15, h: 0.15 },
  beak: null,
  eye: { dir: [0.52, 0.74, 0.28], size: 0.105 },
  ear: { at: [0.2, -0.16, 0.3], len: 1.0, w: 0.36, splay: 18, back: 12, turn: 40 },
  crest: null,
  rune: 0,
  ruff: { c: [0, 0.72, 0.1], r: [0.4, 0.32, 0.34], len: 0.2, rows: 2, across: 6 },
  cape: 0,
  tail: { at: [0, -0.86, 0.3], links: [0.42, 0.42, 0.4, 0.38, 0.32, 0.26], w: [0.22, 0.38, 0.5, 0.54, 0.46, 0.28], lift: 62, curl: 30 },
  fan: null,
  spiral: 0.66,
  claws: 3.0,
  hand: null,
  tool: null,
  armour: false,
  bands: 0,
  dapples: 10,
  gait: { duty: [0.62, 0.42], swing: [0.3, 0.36], step: 0.2, bob: 0.04 },
  size: 4.0,
};

/** An Emberbrush: taller and longer, a beak, crests of feathers swept back, a feathered ruff and mantle, a fan of plumes, a rake of a paw. */
const EMBERBRUSH_LOOK: Ember = {
  stage: 1,
  body: { y: [-1.28, -1.16, -0.74, -0.1, 0.54, 0.98, 1.22, 1.32], z: [0.1, 0.1, 0.12, 0.14, 0.08, -0.02, 0, 0.04], w: [0.3, 0.48, 0.5, 0.44, 0.5, 0.54, 0.48, 0.3], h: [0.3, 0.48, 0.5, 0.42, 0.56, 0.64, 0.56, 0.32] },
  len: 1.86, hip: 0.64, drop: 0.3,
  fore: [0.52, 0.54, 0.16], hind: [0.58, 0.52, 0.42], thick: 0.28, slope: [12, 22], paw: 0.15, stance: [-0.04, 0.16],
  high: 1.4,
  neck: { at: [0, 1.08, 0.4], len: 0.46, w: 0.36, lean: 30 },
  head: { r: [0.46, 0.52, 0.44], up: 0.1, pitch: 0 },
  snout: null,
  beak: { len: 0.64, w: 0.17, h: 0.22, hook: 0.13 },
  eye: { dir: [0.62, 0.6, 0.32], size: 0.1 },
  ear: null,
  crest: { at: [0.2, -0.2, 0.26], len: 1.15, w: 0.36, n: 3, back: 40, splay: 22 },
  rune: 0,
  ruff: { c: [0, 1.12, 0.04], r: [0.48, 0.4, 0.6], len: 0.38, rows: 4, across: 6 },
  cape: 0.72,
  tail: null,
  fan: { at: [0, -1.2, 0.42], n: 16, len: 2.3, wide: 1.2, from: 6, to: 98, side: 42 },
  spiral: 0.68,
  claws: 1.1,
  hand: { tines: 5, len: 1.15 },
  tool: null,
  armour: false,
  bands: 0,
  dapples: 14,
  gait: { duty: [0.64, 0.42], swing: [0.28, 0.38], step: 0.2, bob: 0.05 },
  size: 3.0,
};

/** An Ashsweeper: large and long, a raptor's beak, a red crest with a rune on its brow, an enormous fan, armour, and a great rake. */
const ASHSWEEPER_LOOK: Ember = {
  stage: 2,
  body: { y: [-1.72, -1.58, -1.0, -0.15, 0.74, 1.32, 1.64, 1.76], z: [0.12, 0.12, 0.15, 0.18, 0.1, -0.04, 0, 0.04], w: [0.54, 0.84, 0.9, 0.82, 0.9, 0.98, 0.86, 0.52], h: [0.46, 0.78, 0.84, 0.74, 0.9, 1.0, 0.88, 0.5] },
  len: 2.45, hip: 0.62, drop: 0.3,
  fore: [0.7, 0.72, 0.22], hind: [0.78, 0.7, 0.54], thick: 0.42, slope: [12, 22], paw: 0.2, stance: [0.06, 0.22],
  high: 1.9,
  neck: { at: [0, 1.46, 0.6], len: 0.56, w: 0.5, lean: 32 },
  head: { r: [0.66, 0.74, 0.62], up: 0.12, pitch: -2 },
  snout: null,
  beak: { len: 1.0, w: 0.25, h: 0.34, hook: 0.26 },
  eye: { dir: [0.64, 0.58, 0.36], size: 0.13 },
  ear: null,
  crest: { at: [0.26, -0.3, 0.42], len: 1.7, w: 0.46, n: 4, back: 42, splay: 18 },
  rune: 0.2,
  ruff: { c: [0, 1.56, 0.2], r: [0.6, 0.5, 0.66], len: 0.4, rows: 3, across: 7 },
  cape: 0.72,
  tail: null,
  fan: { at: [0, -1.64, 0.66], n: 21, len: 3.4, wide: 1.5, from: 2, to: 104, side: 44 },
  spiral: 0.66,
  claws: 1.1,
  hand: null,
  tool: { w: 3.6, tines: 9, len: 1.05, high: 0.9, ahead: 0.6 },
  armour: true,
  bands: 3,
  dapples: 18,
  gait: { duty: [0.66, 0.44], swing: [0.24, 0.34], step: 0.18, bob: 0.05 },
  size: 3.1,
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
/** The rings drawn through smoothly, `k` to every span between two. */
function smoothRings(R: Rings, k: number): Rings {
  const out: Rings = { y: [], z: [], w: [], h: [] }, n = R.y.length;
  const cr = (a: number[], i: number, t: number): number => {
    const p0 = a[Math.max(0, i - 1)], p1 = a[i], p2 = a[i + 1], p3 = a[Math.min(n - 1, i + 2)];
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  };
  for (let i = 0; i < n - 1; i++) for (let q = 0; q < k; q++) {
    const t = q / k;
    out.y.push(cr(R.y, i, t)); out.z.push(cr(R.z, i, t)); out.w.push(Math.max(0.05, cr(R.w, i, t))); out.h.push(Math.max(0.05, cr(R.h, i, t)));
  }
  out.y.push(R.y[n - 1]); out.z.push(R.z[n - 1]); out.w.push(R.w[n - 1]); out.h.push(R.h[n - 1]);
  return out;
}
/** The barrel's width, depth and height of its middle line at `y`. */
function ringAt(R: Rings, y: number): { w: number; h: number; z: number } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}
/** A frame standing along `up` with its across along `side`, as near as it can be: across, forward and up. */
function sideFrame(up: V3, side: V3): [V3, V3, V3] {
  const Z = unit(up);
  let X = sub(side, scale(Z, dot(side, Z)));
  if (Math.hypot(X[0], X[1], X[2]) < 1e-4) X = [1, 0, 0];
  X = unit(X);
  return [X, cross(Z, X), Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
const onEgg2 = (c: V3, r: V3, dir: V3): { p: V3; n: V3 } => {
  const d = unit(dir), k = 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);
  const p = add(c, scale(d, k));
  return { p, n: unit([(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]) };
};
/** Two frames mixed, `k` of the way from `a` to `b`, kept square. */
function blendXf(a: Xf, b: Xf, k: number): Xf {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const col = (x: Xf, c: number): V3 => [x.m[c], x.m[3 + c], x.m[6 + c]];
  const Y = unit(mixV(col(a, 1), col(b, 1), k));
  let Z = mixV(col(a, 2), col(b, 2), k);
  Z = unit(sub(Z, scale(Y, dot(Z, Y))));
  return xfOf(cross(Y, Z), Y, Z, mixV(a.t, b.t, k));
}

/** Whether the parts are cut finely, for the build under way: drawn big, or at the size the island is played at. */
let fine = true;

/** A lock of fur: a small blade from `root` out along `dir`, drawn to a point, lying flat to `up` and curving out of it a little. */
function lock(root: V3, dir: V3, len: number, w: number, mat: Mat, up: V3, curl = 0.18): Mesh {
  const d = unit(dir), u = unit(up);
  const at = (k: number): V3 => add(root, add(scale(d, len * k), scale(u, len * curl * k * k)));
  return tube([root, at(0.55), at(1)], [w, w * 0.75, 0.006], [w * 0.55, w * 0.4, 0.004], 3, mat, { up: u, start: false, end: false });
}

/** A feather's half-width along it, against its widest: full from near its root, widest at its middle, rounded off to a soft point. */
const vane = (k: number): number => (k < 0.5 ? lerp(0.4, 1, Math.sin((k / 0.5) * Math.PI / 2)) : Math.max(0, 1 - ((k - 0.5) / 0.5) ** 2) ** 0.6);
/** How thick a feather is where it is `w` across: a flat vane `thick` at most, or puffed up to `puff` of its width, a soft plume. */
const vaneH = (w: number, thick: number, puff: number): number => Math.max(0.004, puff ? w * puff : Math.min(thick, w * 0.3));

/**
 * A feather: a broad vane from `root` out along `dir`, its flat face along `normal`, bowed toward `bend` as it goes out (a
 * flame's curve), `len` long and `wide` across at its widest. Its colour by ring along it, root to tip (`mats`, any number
 * spread along it). Flat, or puffed into a soft plume (`puff`).
 */
function feather(root: V3, dir: V3, normal: V3, bend: V3, len: number, wide: number, curve: number, mats: readonly Mat[], thick = 0.03, puff = 0): Mesh {
  const d = unit(dir), nn = unit(normal), b = unit(sub(bend, scale(nn, dot(bend, nn))));
  const at = (k: number): V3 => add(root, add(scale(d, len * k), scale(b, len * curve * k * k)));
  const ks = fine ? [0, 0.1, 0.26, 0.44, 0.62, 0.78, 0.9, 0.97, 1] : [0, 0.2, 0.45, 0.7, 0.9, 1];
  const ws = ks.map((k) => Math.max(0.006, vane(k) * wide * 0.5));
  const mat: MatOf = (ring) => mats[Math.min(mats.length - 1, Math.floor((ks[ring] + ks[Math.min(ks.length - 1, ring + 1)]) * 0.5 * mats.length))];
  return tube(ks.map(at), ws, ws.map((w) => vaneH(w, thick, puff)), fine ? 8 : 5, mat, { up: nn, start: false, end: false });
}
/** A streak painted down a feather, on both its faces, lit: an ember's glow in it. */
function streak(root: V3, dir: V3, normal: V3, bend: V3, len: number, wide: number, curve: number, from: number, to: number, mat: Mat, thick = 0.03, puff = 0): Disc[] {
  const d = unit(dir), nn = unit(normal), b = unit(sub(bend, scale(nn, dot(bend, nn))));
  const at = (k: number): V3 => add(root, add(scale(d, len * k), scale(b, len * curve * k * k)));
  const out: Disc[] = [];
  const steps = 6, off = 0.08 * wide;
  for (const sd of [1, -1]) {
    const L: V3[] = [], Rr: V3[] = [];
    for (let q = 0; q <= steps; q++) {
      const k = lerp(from, to, q / steps), p = at(k), tan = unit(sub(at(Math.min(1, k + 0.02)), at(Math.max(0, k - 0.02))));
      const across = unit(cross(nn, tan)), half = Math.max(0.006, vane(k) * wide * 0.5), h = vaneH(half, thick, puff);
      const w = half * 0.16 * Math.sin(Math.PI * (q / steps)) ** 0.7 + 0.004;
      const lift = h * Math.sqrt(Math.max(0, 1 - (off / half) ** 2)) + 0.01;
      const c = add(add(p, scale(nn, sd * lift)), scale(across, off));
      L.push(add(c, scale(across, w)));
      Rr.push(add(c, scale(across, -w)));
    }
    out.push(facing([...L, ...Rr.reverse()], scale(nn, sd), mat, true));
  }
  return out;
}

/** A flat painted shape through `pts`, wound so it faces along `n`. */
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

/**
 * A spiral painted on an egg, lit, as a band: from its heart out, `turns` round, and a tail swept out off its end, `r` across
 * at its widest, about `dir` out of the egg's middle, its band `w` wide; a darker ember band under a gold one.
 */
function spiralOn(c: V3, r: V3, dir: V3, size: number, w: number, up: V3 = [0, 0, 1]): Disc[] {
  const mid = onEgg2(c, r, dir), n = mid.n;
  let u = sub(up, scale(n, dot(up, n)));
  if (len3(u) < 1e-4) u = [0, 1, 0];
  u = unit(u);
  const v = cross(n, u);
  const out: Disc[] = [];
  const turns = 1.7, steps = fine ? 30 : 18;
  const path: Array<[number, number]> = [];
  for (let q = 0; q <= steps; q++) {
    const k = q / steps, a = k * turns * TAU, rr = size * (0.1 + 0.9 * k);
    path.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  // The tail: on from the end, out and away.
  const [ex, ey] = path[path.length - 1];
  const ea = turns * TAU;
  for (let q = 1; q <= 4; q++) {
    const k = q / 4;
    path.push([ex + (-Math.sin(ea) * 0.55 + Math.cos(ea) * 0.25) * size * k, ey + (Math.cos(ea) * 0.55 + Math.sin(ea) * 0.25) * size * k]);
  }
  const put = (x: number, y: number, lift: number): V3 => {
    const flat = add(mid.p, add(scale(u, y), scale(v, x)));
    const on = onEgg2(c, r, sub(flat, c));
    return add(on.p, scale(on.n, lift));
  };
  for (const [band, mat, lift] of [[w * 1.9, 'ember', 0.012], [w, 'flame', 0.018]] as Array<[number, Mat, number]>) {
    for (let q = 0; q < path.length - 1; q++) {
      const [x0, y0] = path[q], [x1, y1] = path[q + 1];
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      const taper = q > path.length - 6 ? (path.length - 1 - q) / 5 : 1;
      const bw = band * 0.5 * (0.55 + 0.45 * Math.min(1, q / 4)) * Math.max(0.3, taper), ox = (-dy / l) * bw, oy = (dx / l) * bw;
      out.push(facing([put(x0 + ox, y0 + oy, lift), put(x1 + ox, y1 + oy, lift), put(x1 - ox, y1 - oy, lift), put(x0 - ox, y0 - oy, lift)], n, mat, true));
    }
  }
  return out;
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the kit's swipe, the Emberbrush's rake swiped down, the Ashsweeper's rake slammed. */
export const EMBER_HITS: readonly number[] = [0.45, 0.5, 0.56];
/**
 * A go at its task, by stage, as shares of it: when each drag starts. The Emberkit's three, right, left and right; the
 * Emberbrush's two with its rake of a paw; the Ashsweeper's two with its rake. Each drag lasts `EMBER_DRAG` of the go.
 */
export const EMBER_WORK = { strokes: [[0.27, 0.51, 0.75], [0.33, 0.71], [0.34, 0.74]] as readonly (readonly number[])[] };
export const EMBER_DRAG = 0.14;

/** How far through a stroke its paw or rake is: forward (one) to behind (below nought), lifted, dragging, dug in. */
function strokeOf(t: number, c: number, k = 1): { y: number; z: number; drag: number; dig: number } {
  const a = c - 0.16 * k, b = c - 0.035 * k, d = c + EMBER_DRAG, e = c + EMBER_DRAG + 0.1 * k;
  if (t <= a || t >= e) return { y: 0, z: 0, drag: 0, dig: 0 };
  if (t < b) { const u = smooth((t - a) / (b - a)); return { y: u, z: Math.sin(Math.PI * Math.min(1, u * 1.15)), drag: 0, dig: 0 }; }
  if (t < c) return { y: 1, z: 0, drag: 0, dig: (t - b) / (c - b) };
  if (t < d) { const u = smooth((t - c) / (d - c)); return { y: lerp(1, -0.3, u), z: 0, drag: 1, dig: 1 }; }
  const u = smooth((t - d) / (e - d));
  return { y: lerp(-0.3, 0, u), z: 0.6 * Math.sin(Math.PI * u), drag: 0, dig: 1 - u };
}
/** The stroke under way at `t` of a list, the latest begun. */
function strokeIn(t: number, list: readonly number[], k = 1): { c: number; q: number } {
  let at = { c: list[0], q: 0 };
  list.forEach((c, q) => { if (t >= c - 0.16 * k) at = { c, q }; });
  return at;
}

/* ---- where its feet go ---------------------------------------------------------------- */

interface Plan {
  at: V3[];
  slope: number[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  neck: [number, number]; head: [number, number, number];
  ears: [[number, number], [number, number]];
  earTurn: number;
  /** The tail or fan lifted, swung to the left, curled or spread. */
  tail: [number, number, number];
  /** The Ashsweeper's rake moved forward, up and tipped (degrees), from where it stands; and how far it is carried in its beak. */
  tool: V3;
  carry: number;
}

interface Rest { hip: V3[]; paw: V3[]; reach: number[] }

const rests = new Map<Ember, Rest>();
function restOf(s: Ember): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], paw: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    hip.push([SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop]);
    paw.push([SIDE[i] * r.w * s.hip * (fore ? 1.05 : 0.95), y - s.stance[fore ? 0 : 1], s.paw]);
    reach.push(L[0] + L[1] + L[2]);
  }
  // The Emberbrush stands with its rake of a paw a little out ahead, its tines on the ground.
  if (s.hand) paw[1] = [paw[1][0] * 1.1, paw[1][1] + 0.1 * s.len, paw[1][2]];
  const R = { hip, paw, reach };
  rests.set(s, R);
  return R;
}

function restPlan(s: Ember, R: Rest): Plan {
  return {
    at: R.paw.map((a) => [...a] as V3), slope: [0, 0, 0, 0], foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: s.tool ? -3 : 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], ears: [[0, 0], [0, 0]], earTurn: 0, tail: [0, 0, 0], tool: [0, 0, 0], carry: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), slope: a.slope.map((x, i) => m(x, b.slope[i])), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    ears: [[m(a.ears[0][0], b.ears[0][0]), m(a.ears[0][1], b.ears[0][1])], [m(a.ears[1][0], b.ears[1][0]), m(a.ears[1][1], b.ears[1][1])]], earTurn: m(a.earTurn, b.earTurn),
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1]), m(a.tail[2], b.tail[2])],
    tool: mixV(a.tool, b.tool, k), carry: m(a.carry, b.carry),
  };
}

/** `p` moved by as much as `to` is from `from`, every number of it. */
function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  return {
    at: p.at.map((x, i) => [d(x[0], to.at[i][0], from.at[i][0]), d(x[1], to.at[i][1], from.at[i][1]), d(x[2], to.at[i][2], from.at[i][2])] as V3),
    slope: p.slope.map((x, i) => d(x, to.slope[i], from.slope[i])), foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    neck: [d(p.neck[0], to.neck[0], from.neck[0]), d(p.neck[1], to.neck[1], from.neck[1])],
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    ears: [[d(p.ears[0][0], to.ears[0][0], from.ears[0][0]), d(p.ears[0][1], to.ears[0][1], from.ears[0][1])],
      [d(p.ears[1][0], to.ears[1][0], from.ears[1][0]), d(p.ears[1][1], to.ears[1][1], from.ears[1][1])]],
    earTurn: d(p.earTurn, to.earTurn, from.earTurn),
    tail: [d(p.tail[0], to.tail[0], from.tail[0]), d(p.tail[1], to.tail[1], from.tail[1]), d(p.tail[2], to.tail[2], from.tail[2])],
    tool: [d(p.tool[0], to.tool[0], from.tool[0]), d(p.tool[1], to.tool[1], from.tool[1]), d(p.tool[2], to.tool[2], from.tool[2])],
    carry: d(p.carry, to.carry, from.carry),
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}

/** When each foot comes down in a stride, the left fore, right fore, left hind and right hind: a walk one side then the other, a trot on the diagonals. */
const WALK_DOWN = [0.25, 0.75, 0, 0.5];
const TROT_DOWN = [0.5, 0, 0, 0.5];
const EDGE = 0.1;

/**
 * Going: each foot down for its share of a stride and swept back under the body at the ground's own speed, so it never
 * skates, then lifted and brought forward folded; the body sinking a little at each footfall, the head nodding, the ears or
 * crest and the tail or fan swaying a beat behind. The Ashsweeper carries its rake across its beak.
 */
function goingPlan(s: Ember, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  p.pitch = 0;
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, L = R.reach[i], half = amp * (R.reach[0] + R.reach[2]) / 2;
    // Walking, the rake of a paw stands where the others do.
    const A: V3 = s.hand && i === 1 ? [R.paw[0][0] * -1, R.paw[0][1], R.paw[0][2]] : R.paw[i];
    const ph = frac(a.u - lerp(WALK_DOWN[i], TROT_DOWN[i], g));
    if (ph < duty) {
      const k = ph / duty;
      p.at[i] = [A[0], A[1] + half * (1 - 2 * k), A[2]];
      const off = ramp(k, 0.55, 1);
      p.slope[i] = -(fore ? lerp(22, 40, g) : lerp(30, 50, g)) * off;
      p.foot[i] = p.slope[i];
      continue;
    }
    const E = lerp(EDGE, 0.16, g), u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * E, y1 = A[1] + half + v * E;
    const y = u < E ? A[1] - half - v * u : u > 1 - E ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * E), -v * (1 - 2 * E), (u - E) / (1 - 2 * E));
    const lift = G.step * L * (1 + 0.3 * g) * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0], y, A[2] + lift];
    if (fore) {
      p.slope[i] = -lerp(70, 95, g) * Math.sin(Math.PI * clamp(u / 0.78)) + 8 * hump(u, 0.92, 0.1);
      p.foot[i] = p.slope[i] * 0.85;
    } else {
      p.slope[i] = -lerp(35, 44, g) * Math.sin(Math.PI * clamp(u / 0.45)) + lerp(18, 26, g) * Math.sin(Math.PI * clamp((u - 0.35) / 0.65));
      p.foot[i] = p.slope[i] * 0.7;
    }
  }
  const walkBob = -G.bob * s.len * (0.5 + 0.5 * Math.cos(4 * TAU * (w - 0.05)));
  const trotBob = -G.bob * s.len * 1.4 * (0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.1)));
  p.H += lerp(walkBob, trotBob, g);
  p.pitch = (1 - g) * 1.2 * Math.sin(2 * TAU * w) + g * 1.5 * Math.sin(2 * TAU * (w - 0.2));
  p.roll = 1.5 * Math.sin(TAU * (w - 0.1));
  p.neck[0] = g * 12;
  p.head[0] = (1 - g) * 4 * Math.cos(2 * TAU * (w - 0.15)) - g * 6;
  p.head[1] = (1 - g) * 3 * Math.sin(TAU * w);
  const sway = 5 * Math.sin(2 * TAU * (w - 0.3));
  p.ears = [[g * 24 + sway, -6 * g], [g * 24 + sway * 0.8, -6 * g]];
  p.tail = [-4 * Math.cos(2 * TAU * (w - 0.2)) - g * 8, 8 * Math.sin(TAU * (w - 0.2)), g * 4];
  p.carry = 1;
  return p;
}

/** Standing about: breathing, looking round, an ear or a crest flicked now and then, the tail or the fan stirring. */
function stillPlan(s: Ember, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [2 * Math.abs(a.breath - 0.5), 12 * look];
  p.head = [-2 * Math.abs(cyc(t, 5)), 9 * look, 5 * drift(t, 2)];
  p.H += 0.01 * s.len * (a.breath - 0.5);
  const flickL = beat(t, [3.1, 15.7], 0.5), flickR = beat(t, [3.4, 9.6, 20.2], 0.5);
  const back = 3 * (1 - Math.cos((TAU * 3 * t) / 24));
  p.ears = [[back + 24 * flickL, 4 * cyc(t, 4) - 8 * flickL], [back * 0.7 + 24 * flickR, -4 * cyc(t, 4, 1) - 8 * flickR]];
  p.tail = [-2 * (1 - Math.cos((TAU * 3 * t) / 24)), 6 * cyc(t, 4), 3 * cyc(t, 3, 0.7)];
  const up = beat(t, [6.2, 18.8], 2.2);
  p.head[1] += 10 * up;
  p.earTurn = -14 * up;
  return p;
}

/** The body pitched nose-up by `deg` about its hips or nose-down about its shoulders, `at` along it, so they stay where they stood. */
function pivot(s: Ember, p: Plan, deg: number, at: number): void {
  const r = ringAt(s.body, at), z0 = r.z - r.h * s.drop, a = deg * DEG;
  const y1 = at * Math.cos(a) - z0 * Math.sin(a), z1 = at * Math.sin(a) + z0 * Math.cos(a);
  p.pitch += deg;
  p.surge += at - y1;
  p.H += z0 - z1;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/**
 * Its strike: the Emberkit up a little on its haunches and a swipe of its right fore claws; the Emberbrush its rake of a paw
 * lifted high and raked down; the Ashsweeper its rake lifted off the ground and slammed down ahead of it.
 */
function strikePlan(s: Ember, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = EMBER_HITS[s.stage];
  const set = ramp(t, 0.05, hit - 0.12) * (1 - ramp(t, hit + 0.12, 0.95));
  if (!s.tool) {
    pivot(s, p, (s.stage ? 6 : 12) * set, -s.len * 0.5);
    const i = 1, A = R.paw[i], L = R.reach[i];
    const up: V3 = [A[0] * 0.8, A[1] + 0.12 * L, A[2] + 0.5 * L];
    const out: V3 = [A[0] * 0.7, A[1] + 0.5 * L, A[2] + 0.04 * L];
    let at = A;
    if (t < hit - 0.1) at = mixV(A, up, ramp(t, 0.06, hit - 0.12));
    else if (t < hit) at = mixV(up, out, smooth((t - hit + 0.1) / 0.1));
    else at = mixV(out, A, ramp(t, hit + 0.1, 0.92));
    p.at[i] = at;
    const lifted = len3(sub(at, A)) / L;
    p.slope[i] = -50 * lifted;
    p.foot[i] = -30 * lifted;
  } else {
    pivot(s, p, 5 * set, -s.len * 0.5);
    const up: V3 = [0.05 * s.len, 0.6, -24], out: V3 = [0.3 * s.len, -0.05, 6];
    if (t < hit - 0.1) p.tool = mixV([0, 0, 0], up, ramp(t, 0.06, hit - 0.12));
    else if (t < hit) p.tool = mixV(up, out, smooth((t - hit + 0.1) / 0.1));
    else p.tool = mixV(out, [0, 0, 0], ramp(t, hit + 0.1, 0.92));
    p.surge += 0.12 * p.tool[0];
  }
  p.neck = [-10 * set, 0];
  p.head = [-10 * set + 14 * hump(t, hit, 0.08), 0, 0];
  p.ears = [[24 * set, 0], [24 * set, 0]];
  p.tail = [10 * set, 0, 6 * set];
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it is at it over and over. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));
/** How fast each stage's strokes go, against the Ashsweeper's. */
const STROKE_K = [0.75, 1, 1];

/**
 * A go at its task: raking ashes out of a fire. It bows its head to the hearth, ears forward; the Emberkit reaches out a fore
 * paw, digs its claws in and drags back, right, left and right; the Emberbrush reaches its rake of a paw far out and drags it
 * back, twice, leaning into it; the Ashsweeper pushes its rake out and drags it back, twice, its weight going with it.
 */
function workPlan(s: Ember, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), W = EMBER_WORK.strokes[s.stage], k = STROKE_K[s.stage];
  const bow = ramp(t, 0.02, 0.14) * (1 - ramp(t, 0.88, 1));
  p.neck = [40 * bow, 0];
  p.head = [-30 * bow, 0, 0];
  p.pitch += -5 * bow;
  p.H -= 0.07 * s.len * bow;
  p.ears = [[-8 * bow, -4 * bow], [-8 * bow, -4 * bow]];
  p.tail = [8 * bow, 0, 4 * bow];
  const { c, q } = strokeIn(t, W, k);
  const st = strokeOf(t, c, k);
  if (!s.tool) {
    const i = s.stage === 0 && q % 2 ? 0 : 1, A = R.paw[i], L = R.reach[i];
    const fwd = (s.stage === 0 ? 0.55 : 0.62) * L;
    p.at[i] = [A[0] * 0.85, A[1] + fwd * st.y, A[2] + 0.2 * L * st.z];
    p.slope[i] = -30 * st.z;
    p.foot[i] = -18 * st.dig;
    p.surge += 0.06 * s.len * st.y;
    p.H -= 0.03 * s.len * st.y;
    p.yaw += (i ? -1 : 1) * 4 * st.y;
    p.head[1] += (i ? -1 : 1) * 6 * st.y;
    p.roll += (i ? 1 : -1) * 2 * st.y;
  } else {
    const fwd = 0.5 * R.reach[0];
    p.tool = [fwd * st.y, 0.22 * st.z, -14 * st.z + 6 * st.drag];
    p.surge += 0.3 * fwd * st.y;
    p.H -= 0.03 * s.len * st.y;
    p.pitch -= 3 * st.y;
  }
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn, its crest or ears pricked, a shake, and settled. */
function evolvePlan(s: Ember, R: Rest, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * 58);
  p.H += s.len * (-0.03 * hunch + 0.02 * up);
  p.pitch += -3 * hunch + 4 * up;
  p.neck = [16 * hunch - 12 * up, 0];
  p.head = [-12 * hunch + 12 * up, 0, 10 * shake];
  p.ears = [[30 * hunch - 12 * up + 16 * Math.abs(shake), 8 * shake], [30 * hunch - 12 * up + 16 * Math.abs(shake), -8 * shake]];
  p.roll = 3 * shake;
  p.tail = [-10 * hunch + 14 * up, 8 * shake, 10 * up];
  p.squash = 0.05 * hump(t, 0.7, 0.05);
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Ember, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(strikePlan(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0.2, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** A leg bent to put its paw at `paw`, the elbow behind on a fore leg and the stifle forward on a hind (`./wild-hare`'s `legOf`). */
function legOf(s: Ember, body: Xf, i: number, rootLocal: V3, paw: V3, slope: number, foot: number): Xf[] {
  const fore = i < 2, L = fore ? s.fore : s.hind, l0 = L[0], l1 = L[1];
  const root = place(body, rootLocal), f0 = turn(body, [0, 1, 0]), fwd = unit([f0[0], f0[1], 0]);
  const r0 = fore ? s.slope[0] : s.slope[1], r = (r0 + slope) * DEG;
  const ankle = add(paw, add(scale(fwd, -Math.sin(r) * L[2]), [0, 0, Math.cos(r) * L[2]]));
  let d = sub(ankle, root);
  const D = len3(d), most = (l0 + l1) * 0.995, least = Math.abs(l0 - l1) + 0.1 * (l0 + l1);
  const Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const at = add(root, scale(d, Dc));
  const out = turn(body, [SIDE[i], 0, 0]);
  const hint = add(add(scale(fwd, fore ? -1 : 1), scale(out, 0.08)), [0, 0, -0.35 - 2.5 * Math.max(0, d[2])]);
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(root, scale(d, along)), scale(v, h));
  const pawAt = add(paw, sub(at, ankle));
  const across = turn(body, [1, 0, 0]);
  const [X0, Y0, Z0] = sideFrame(sub(root, knee), across), [X1, Y1, Z1] = sideFrame(sub(knee, at), across), [X3, Y3, Z3] = sideFrame(sub(at, pawAt), across);
  const cannon = xfOf(X3, Y3, Z3, at);
  const pw = joint(xfOf(X3, Y3, Z3, pawAt), [0, 0, 0], -(r0 + slope) + foot);
  return [xfOf(X0, Y0, Z0, root), xfOf(X1, Y1, Z1, knee), pw, cannon];
}

/** The kit's plume's bones from its root on the body, each link on from the one before it, lifted, curled up and swung. */
function plumeBones(s: Ember, body: Xf, P: Plan): Xf[] {
  const T = s.tail!, n = T.links.length, out: Xf[] = [];
  let prev = joint(body, T.at, -(T.lift + P.tail[0]), 0, P.tail[1] * 0.4);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.curl + P.tail[2]), 0, (P.tail[1] * 0.6) / (n - 1));
    out.push(prev);
  }
  return out;
}

/** The middle of the skull, in the head's frame; the root of the muzzle or beak. */
const skullAt = (s: Ember): V3 => [0, 0, s.head.up];
const snoutRoot = (s: Ember): V3 => [0, s.head.r[1] * 0.55, s.head.up - s.head.r[2] * (s.beak ? 0.12 : 0.34)];
/** A point down the beak `k` of its length, in the head's frame: out along it, curving down to its hook. */
function beakAt(s: Ember, k: number): V3 {
  const B = s.beak!, r0 = snoutRoot(s);
  return [0, r0[1] + B.len * k, r0[2] - B.h * 0.25 * k - B.hook * Math.max(0, (k - 0.6) / 0.4) ** 2];
}
/** Where the rake is gripped in its beak, in the head's frame. */
const gripAt = (s: Ember): V3 => { const p = beakAt(s, 0.35); return [0, p[1], p[2] - s.beak!.h * 0.1]; };
/** Where each fore paw rests on the bar of its rake, in the rake's frame. */
const barGrip = (s: Ember, sd: number): V3 => [sd * s.tool!.w * 0.17, -0.02, BAR_H * 0.5 * s.tool!.w / 3];
/** The bar's depth and height, against a rake three wide. */
const BAR_D = 0.3;
const BAR_H = 0.22;

/** The bones of a stage: its pose, every leg bent to put its paw where the pose says, the neck, head, ears and tail or fan carried on the body, and its rake. */
function emberBones(s: Ember): (a: Anim) => Bones {
  const R = restOf(s);
  return (a) => {
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go });
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.neck.lean + P.neck[0];
    b.neck = joint(body, s.neck.at, -lean, 0, P.neck[1]);
    b.head = joint(b.neck, neckEnd(s, 1), lean + s.head.pitch + P.head[0], P.head[2], P.head[1]);
    if (s.ear) {
      const E = s.ear;
      for (const k of [0, 1]) {
        const side = k ? 1 : -1, e = P.ears[k];
        const spread = joint(b.head, [side * E.at[0], E.at[1], s.head.up + E.at[2]], 0, side * (E.splay + e[1]));
        b[`ear${k}`] = joint(joint(spread, [0, 0, 0], E.back + e[0]), [0, 0, 0], 0, 0, -side * (E.turn + P.earTurn));
      }
    } else if (s.crest) {
      const C = s.crest;
      for (const k of [0, 1]) {
        const side = k ? 1 : -1, e = P.ears[k];
        b[`ear${k}`] = joint(b.head, [side * C.at[0], C.at[1], s.head.up + C.at[2]], C.back + e[0] * 0.6, side * (C.splay + e[1] * 0.6));
      }
    }
    if (s.tail) plumeBones(s, body, P).forEach((x, q) => { b[`tail${q}`] = x; });
    if (s.fan) b.fan = joint(body, s.fan.at, -P.tail[0] * 0.6, 0, P.tail[1] * 0.35);
    // The Ashsweeper's rake: on the ground ahead of it standing, its fore paws on the bar; across its beak going.
    let rake: Xf | null = null;
    if (s.tool) {
      const T = s.tool, k = T.w / 3;
      const ground = joint(ROOT, [0, R.paw[0][1] + T.ahead + P.tool[0], T.high + P.tool[1]], P.tool[2]);
      rake = ground;
      if (P.carry > 0.001) {
        const carried = joint(b.head, add(gripAt(s), [0, -BAR_D * k * 0.1, 0]), -(lean + s.head.pitch) * 0.3);
        rake = blendXf(ground, carried, P.carry);
      }
      b.rake = rake;
      for (const i of [0, 1]) {
        const g = place(ground, barGrip(s, SIDE[i]));
        P.at[i] = mixV([g[0], g[1], g[2] + s.paw * 0.8], P.at[i], P.carry);
        P.foot[i] = lerp(-P.tool[2], P.foot[i], P.carry);
      }
    }
    for (let i = 0; i < 4; i++) {
      const fore = i < 2, h = R.hip[i];
      const slide = fore ? clamp((P.at[i][1] - R.paw[i][1]) * 0.15, -0.12 * s.len, 0.12 * s.len) : 0;
      const g = P.at[i];
      const [u, l, f, c] = legOf(s, body, i, [h[0], h[1] + slide, h[2]], [g[0], g[1], Math.max(g[2], s.paw * 0.9)], P.slope[i], P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
      b[`${LEGS4[i]}3`] = c;
    }
    b.shadow = shadowOf(body, 0);
    return b;
  };
}

/** A point on the line of the neck `k` up it, in its frame: up from the withers and arched forward toward the head. */
const neckEnd = (s: Ember, k: number): V3 => { const L = s.neck.len, u = clamp((k - 0.45) / 0.55); return [0, L * 0.26 * u * u, L * k]; };

/* ---- colours ---------------------------------------------------------------------------------- */

/**
 * Its coat by where on a ring a facet is, the way up it (`sin`): its belly cream, its sides red, the top of its back the dark
 * brown shading. `j` of `n` round a ring that faces up `vv` as the tube's own rings do.
 */
const upOf = (j: number, n: number): number => Math.sin(((j + 1) / n) * TAU);

/* ---- what it is made of ------------------------------------------------------------------------- */

/** A flat shape laid on the barrel's curve, a hair out from it. */
function onBarrel(B: Rings, d: Disc, lift: number): Disc {
  return {
    ...d, v: d.v.map((v) => {
      const r = ringAt(B, v[1]), th = Math.atan2((v[2] - r.z) / r.h, v[0] / r.w);
      const q = onRings(B, clamp(v[1], B.y[0] + 0.02, B.y[B.y.length - 1] - 0.02), th);
      return add(q.p, scale(q.n, lift));
    }),
  };
}

/** A soft leaf of colour on a surface at `c` facing out along `n`, `l` long and `w` across, lying along the body turned by `spin`. */
function leafOn(c: V3, n: V3, l: number, w: number, spin: number, m: Mat): Disc {
  const N = unit(n), along0 = unit(sub([0, 1, 0], scale(N, N[1]))), across0 = unit(cross(N, along0));
  const along = add(scale(along0, Math.cos(spin)), scale(across0, Math.sin(spin))), across = unit(cross(N, along));
  const pts: V3[] = [];
  for (let q = 0; q < 10; q++) {
    const t = (q / 10) * TAU, x = Math.cos(t), y = Math.sin(t) * Math.sin(Math.PI * (0.5 + 0.5 * x)) ** 0.6 * (1 + 0.2 * x);
    pts.push(add(c, add(scale(along, x * l * 0.5), scale(across, y * w * 0.5))));
  }
  return facing(pts, N, m);
}

/** The barrel: red, a cream belly, dark brown strokes along its back; on the bigger two, dark feathers laid down its spine. */
function barrelOf(s: Ember, n: number): Mesh {
  const B = s.body, F = smoothRings(B, 3);
  const body = tube(F.y.map((y, q) => [0, y, F.z[q]] as V3), F.w, F.h, n, (_r, j) => (upOf(j, n) < -0.45 ? 'belly' : 'coat'));
  const spots: Disc[] = [];
  const y0 = B.y[1] + 0.05, y1 = lerp(B.y[4], B.y[5], 0.6);
  for (let q = 0; q < s.dapples; q++) {
    const u = (q + 0.5) / s.dapples, y = lerp(y0, y1, u) + (jitter(q + 1) - 0.5) * 0.15 * s.len;
    const side = q % 2 ? 1 : -1, down = 0.08 + 0.5 * jitter(q + 7);
    const e = onRings(B, y, side > 0 ? Math.PI / 2 - down : Math.PI / 2 + down), k = s.len * 0.11 * (0.7 + 0.6 * jitter(q + 3));
    spots.push(onBarrel(B, leafOn(e.p, e.n, k * 2.6, k * 0.9, (jitter(q + 5) - 0.5) * 0.5 + side * 0.4, 'coatDark'), 0.012));
  }
  const out: Mesh[] = [body, paint(spots)];
  if (s.stage > 0) {
    // Dark feathers laid back along its spine, shoulders to rump, each tipped red.
    const rows = s.stage === 1 ? 7 : 9;
    for (let q = 0; q < rows; q++) {
      const u = q / (rows - 1), y = lerp(B.y[5] - 0.1 * s.len, B.y[1] + 0.05, u);
      for (const sd of [-1, 1]) {
        const e = onRings(B, y, Math.PI / 2 - sd * 0.42), L = s.len * (0.2 + 0.04 * jitter(q * 3 + sd));
        const dir = unit(add([0, -1, 0], scale(e.n, 0.2)));
        out.push(feather(sub(e.p, scale(e.n, 0.02)), dir, e.n, [sd, 0, 0], L, L * 0.55, 0.05, ['featherDark', 'featherDark', 'feather'], 0.02));
      }
    }
  }
  return merge(...out);
}

/**
 * The ruff: on the kit a mass of cream locks down its chest; on the bigger two rows of cream feathers hanging down over it,
 * the lowest the longest.
 */
function ruffOf(s: Ember, n: number): Mesh {
  const F = s.ruff, out: Mesh[] = [orb(F.c, F.r, n, Math.max(4, n - 3), 'mark')];
  for (let row = 0; row < F.rows; row++) {
    const v = row / Math.max(1, F.rows - 1), el = lerp(s.stage ? 0.85 : 0.6, s.stage ? -0.7 : -0.45, v);
    const count = F.across + (row % 2);
    for (let q = 0; q < count; q++) {
      const az = lerp(-1.25, 1.25, (q + 0.5 * (row % 2)) / Math.max(1, count - 1 + (row % 2)));
      const dir: V3 = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
      const e = onEgg2(F.c, F.r, dir), id = row * 31 + q;
      const L = F.len * (0.7 + 0.5 * v) * (0.85 + 0.3 * jitter(id));
      const way = unit(add(scale(e.n, 0.45), [0, 0.02, -1]));
      if (s.stage === 0) out.push(lock(sub(e.p, scale(e.n, 0.05)), way, L, L * 0.8, 'mark', e.n, 0.05));
      else out.push(feather(sub(e.p, scale(e.n, 0.04)), way, e.n, [0, 0, -1], L, L * 0.62, 0.04, ['mark', 'mark', 'muzzle'], 0.02));
    }
  }
  return merge(...out);
}

/** The bigger two's mantle: cream feathers over the tops of its shoulders and the root of its neck, laid back in three rows. */
function capeOf(s: Ember): Mesh {
  const B = s.body, out: Mesh[] = [];
  const y0 = s.len * 0.5 + 0.06 * s.len;
  for (let row = 0; row < 3; row++) {
    const y = y0 - row * 0.1 * s.len;
    for (let q = 0; q < 7; q++) {
      const th = lerp(0.1, Math.PI - 0.1, q / 6), id = 600 + row * 11 + q;
      const e = onRings(B, y, th + (row % 2 ? 0.12 : 0));
      const L = s.cape * (1 - 0.18 * row) * (0.85 + 0.3 * jitter(id));
      const dir = unit(add(add([0, -0.8, 0], scale(e.n, 0.35)), [0, 0, -0.35 * Math.abs(Math.cos(th))]));
      out.push(feather(sub(e.p, scale(e.n, 0.03)), dir, e.n, [0, 0, -1], L, L * 0.55, 0.06, ['mark', 'mark', 'muzzle'], 0.02));
    }
  }
  return merge(...out);
}

/** The neck: red behind, cream down its throat. */
function neckOf(s: Ember, n: number): Mesh {
  const N = s.neck, L = N.len;
  return tube([[0, 0, -0.3], [0, -0.03 * L, L * 0.4], neckEnd(s, 0.75), neckEnd(s, 1.04)], [N.w * 1.12, N.w, N.w * 0.92, N.w * 0.86],
    [N.w * 1.2, N.w * 1.04, N.w * 0.94, N.w * 0.88], n, (_r, j) => (upOf(j, n) > -0.1 ? 'mark' : 'coat'), { seam: 'both' });
}
/** Locks or feathers down the front and sides of the neck, carrying the ruff up to the jaw. */
function neckFurOf(s: Ember): Mesh {
  const N = s.neck, out: Mesh[] = [];
  for (let row = 0; row < 2; row++) {
    const z = lerp(N.len * (s.stage ? 0.66 : 0.8), N.len * 0.15, row);
    for (let q = 0; q < 5; q++) {
      const a = lerp(-1.3, 1.3, (q + 0.5 * (row % 2)) / 4.5), id = 300 + row * 11 + q;
      const nrm: V3 = [Math.sin(a), Math.cos(a), 0];
      const root: V3 = add(neckEnd(s, z / N.len), [nrm[0] * N.w * 0.9, nrm[1] * N.w * 0.95, 0]);
      const L = s.ruff.len * (0.6 + 0.3 * row / 2) * (0.85 + 0.3 * jitter(id));
      if (s.stage === 0) out.push(lock(sub(root, scale(nrm, 0.03)), add(scale(nrm, 0.8), [0, 0, -0.8]), L * 1.2, L * 0.75, 'mark', nrm, 0.1));
      else out.push(feather(sub(root, scale(nrm, 0.03)), add(scale(nrm, 0.5), [0, 0, -1]), nrm, [0, 0, -1], L * 1.1, L * 0.6, 0.04, ['mark', 'mark', 'muzzle'], 0.02));
    }
  }
  return merge(...out);
}

/** A skull: an egg of rings along it, red over its crown and back, cream down its face, cheeks and jaw. */
function skullOf(s: Ember, n: number, k: number): Mesh {
  const H = s.head, C = skullAt(s), rings = k + 4;
  const pts: V3[] = [], ws: number[] = [], hs: number[] = [];
  for (let q = 0; q <= rings; q++) {
    const a = Math.PI * (q / rings), f = Math.max(0.02, Math.sin(a));
    pts.push([C[0], C[1] - H.r[1] * Math.cos(a), C[2]]);
    ws.push(H.r[0] * f);
    hs.push(H.r[2] * f);
  }
  const nn = n + 2;
  // The kit's red runs down between its eyes; on the bigger two the crown is red and the face cream to the brow.
  return tube(pts, ws, hs, nn, (ring, j) => {
    const up = upOf(j, nn), front = ring / rings;
    if (s.stage === 0) return up > 0.42 || (up > 0 && front < 0.3) ? 'coat' : 'mark';
    return up > 0.55 - 0.5 * (1 - front) ? 'coat' : 'mark';
  }, { start: false, end: false });
}

/**
 * The head. The kit's: a round skull, red over a cream face, a slim muzzle red along its bridge to a dark nose, cream tufts
 * off its cheeks, a red stroke under each eye, amber eyes. The bigger two's: a cream face under a red crown, a beak curving
 * down to a hook, a dark stroke back from each eye; the Ashsweeper's a red plate up its brow with a glowing rune.
 */
function headOf(s: Ember, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const out: Array<Mesh | false> = [skullOf(s, n, k)];
  const eye = eyes(C, H.r, s.eye.dir, s.eye.size, { tall: s.stage ? 0.9 : 1.15, iris: 'crystal', pupil: 0.48, glint: 0.32, shut });
  out.push(eye);
  if (s.snout) {
    const S = s.snout, r0 = snoutRoot(s);
    const pts: V3[] = [r0, add(r0, [0, S.len * 0.45, -S.h * 0.25]), add(r0, [0, S.len * 0.82, -S.h * 0.5]), add(r0, [0, S.len, -S.h * 0.62])];
    const nn = n;
    out.push(tube(pts, [S.w, S.w * 0.78, S.w * 0.48, S.w * 0.2], [S.h, S.h * 0.75, S.h * 0.5, S.h * 0.22], nn, (_r, j) => (upOf(j, nn) > 0.55 ? 'coat' : 'muzzle'), { start: false }));
    out.push(orb(add(r0, [0, S.len * 0.98, -S.h * 0.5]), [S.w * 0.42, S.w * 0.36, S.w * 0.34], 6, 4, 'nose'));
    // A mouth's line under it, and a red stroke under each eye; cream tufts off the cheeks.
    const marks: Disc[] = [];
    for (const sd of [1, -1]) {
      const e = onEgg2(C, H.r, [sd * 0.62, 0.58, -0.18]);
      marks.push(leafOn(add(e.p, scale(e.n, 0.012)), e.n, s.eye.size * 2.4, s.eye.size * 0.8, sd * 0.5, 'coat'));
    }
    out.push(paint(marks));
    for (const sd of [1, -1]) for (let q = 0; q < 3; q++) {
      const e = onEgg2(C, H.r, [sd * 0.9, -0.05 - 0.2 * q, -0.32 - 0.12 * q]);
      const L = s.ruff.len * (0.9 - 0.15 * q);
      out.push(lock(sub(e.p, scale(e.n, 0.04)), add(scale(e.n, 0.9), [0, -0.6, -0.25]), L, L * 0.55, 'mark', [0, 0, 1], 0.1));
    }
  }
  if (s.beak) {
    const B = s.beak, steps = fine ? 6 : 4, pts: V3[] = [], ws: number[] = [], hs: number[] = [];
    for (let q = 0; q <= steps; q++) {
      const kk = q / steps;
      pts.push(beakAt(s, kk));
      ws.push(Math.max(0.006, B.w * (1 - kk) ** 0.8));
      hs.push(Math.max(0.006, B.h * (1 - kk ** 1.4) * (1 - 0.3 * kk)));
    }
    const nn = n;
    out.push(tube(pts, ws, hs, nn, (_r, j) => (upOf(j, nn) > -0.35 ? 'bill' : 'billDark'), { start: false }));
    // The line of its mouth along each side, and a dark stroke back from each eye, and its brows.
    const marks: Disc[] = [];
    for (const sd of [1, -1]) {
      const line: V3[] = [], line2: V3[] = [];
      for (let q = 0; q <= 5; q++) {
        const kk = 0.05 + 0.7 * (q / 5), p = beakAt(s, kk), w = B.w * (1 - kk) ** 0.8 * 1.02;
        line.push(add(p, [sd * w, 0, -B.h * 0.3 * (1 - kk) - 0.008]));
        line2.push(add(p, [sd * w, 0, -B.h * 0.3 * (1 - kk) - 0.008 - 0.018 * (1 - kk)]));
      }
      marks.push(facing([...line, ...line2.reverse()], [sd, 0, 0], 'billDark'));
      const e = onEgg2(C, H.r, [sd * s.eye.dir[0], s.eye.dir[1] - 0.25, s.eye.dir[2] + 0.02]);
      marks.push(leafOn(add(e.p, scale(e.n, 0.012)), e.n, s.eye.size * 3.2, s.eye.size * 0.7, sd * -0.15, 'featherDark'));
      const br = onEgg2(C, H.r, [sd * s.eye.dir[0] * 0.95, s.eye.dir[1], s.eye.dir[2] + 0.3]);
      marks.push(leafOn(add(br.p, scale(br.n, 0.014)), br.n, s.eye.size * 2.4, s.eye.size * 0.55, sd * 0.35, 'featherDark'));
    }
    out.push(paint(marks));
  }
  if (s.rune) {
    // A red plate up the brow, between the eyes and over the crown, and the rune on it.
    const pc = onEgg2(C, H.r, [0, 0.62, 0.62]);
    const plate = orbAlong(add(pc.p, scale(pc.n, -0.02)), pc.n, [s.rune * 1.25, s.rune * 2.4, s.rune * 0.45], n, 4, 'shell');
    const top = add(pc.p, scale(pc.n, s.rune * 0.42));
    const up = unit(sub([0, -0.3, 1], scale(pc.n, dot([0, -0.3, 1], pc.n))));
    const across = unit(cross(up, pc.n));
    const rune = (kk: number, m: Mat, lift: number): Disc => {
      const r = s.rune * kk;
      return facing([add(top, scale(up, r * 1.6)), add(top, scale(across, r * 0.7)), add(top, scale(up, -r * 1.1)), add(top, scale(across, -r * 0.7))].map((p) => add(p, scale(pc.n, lift))), pc.n, m, true);
    };
    const eye = (kk: number, m: Mat): Disc => disc(add(add(top, scale(pc.n, 0.012)), scale(up, s.rune * 0.1)), pc.n, s.rune * kk * 0.42, s.rune * kk * 0.42, 6, m, { lit: true });
    out.push(plate, paint([rune(1, 'ember', 0.004), rune(0.7, 'flame', 0.008), eye(0.9, 'shellDark'), eye(0.5, 'ember')]));
  }
  return merge(...out);
}

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Ember): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.92) }];

/** The kit's ear: tall, pointed, red behind with a dark tip, cream inside with tufts of cream fur. Up its own `z`, its hollow toward `+y`. */
function earOf(s: Ember, n: number): Mesh {
  const E = s.ear!, L = E.len, w = E.w;
  const zs = [0, 0.12, 0.34, 0.58, 0.8, 0.94, 1].map((x) => x * L);
  const ws = [0.8, 1, 0.94, 0.72, 0.46, 0.22, 0.02].map((x) => x * w);
  const line = zs.map((z, q) => [0, -0.04 * Math.sin((q / 6) * Math.PI) * L * 0.2, z] as V3);
  const cup = (p: V3): V3 => [p[0], p[1] + 0.26 * w * Math.min(1, (p[0] / w) ** 2), p[2]];
  const shell = tube(line, ws, ws.map((x) => Math.max(0.025, x * 0.2)), Math.max(6, n), (ring) => (ring >= 4 ? 'coatDark' : 'coat'), { up: [0, 1, 0] });
  const cupped = mesh(shell.v.map(cup), shell.f);
  const rim = (sd: number): V3[] => [1, 2, 3, 4].map((q) => cup([sd * ws[q] * 0.66, line[q][1] + ws[q] * 0.2 + 0.014, zs[q]]));
  const lining: V3[] = [cup([0, line[0][1] + ws[0] * 0.2 + 0.014, zs[0] + L * 0.04]), ...rim(-1), cup([0, line[5][1] + 0.02, L * 0.86]), ...rim(1).reverse()];
  const tufts: Mesh[] = [];
  for (let q = 0; q < 4; q++) {
    const x = (q - 1.5) * w * 0.3, root = cup([x, ws[1] * 0.2 + 0.02, L * 0.08]);
    tufts.push(lock(root, [x * 0.6, 0.35, 1], L * (0.38 + 0.08 * (q % 2)), w * 0.32, 'mark', [0, 1, 0], -0.1));
  }
  return merge(cupped, paint([facing(lining, [0, 1, 0], 'inner')]), ...tufts);
}

/** The bigger two's crest: feathers swept back off the side of the head, the first the longest, red with dark tips. Up its own `z`. */
function crestOf(s: Ember): Mesh {
  const C = s.crest!, out: Mesh[] = [], lit: Disc[] = [];
  for (let q = 0; q < C.n; q++) {
    const f = q / Math.max(1, C.n - 1), L = C.len * (1 - 0.32 * f), W = C.w * (1 - 0.2 * f);
    const root: V3 = [0.02 * q, -0.06 * q, -0.05 * q];
    const dir = unit([0.18 + 0.2 * f, -0.35 - 0.5 * f, 1 - 0.3 * f]);
    const nrm = unit(cross(dir, [0, 1, 0.2]));
    const bend: V3 = [0, -1, 0];
    out.push(feather(root, dir, nrm, bend, L, W, 0.18, q === 0 ? ['feather', 'feather', 'coatLight', 'featherDark'] : ['featherDark', 'feather', 'feather', 'featherDark'], 0.03));
    if (q === 0) lit.push(...streak(root, dir, nrm, bend, L, W, 0.18, 0.25, 0.7, 'ember', 0.03));
  }
  return merge(...out, paint(lit));
}

/** A paw: a soft cream pad and dark claws; the kit's fore claws long and curved, a little rake. */
function pawOf(s: Ember, fore: boolean, n: number): Mesh {
  const r = s.paw * (fore ? 1 : 1.1);
  const pad = orbAlong([0, r * 0.25, -r * 0.35], [0, 1, 0], [r * 0.92, r * 1.25, r * 0.62], n, 4, 'mark');
  const toes: Mesh[] = [];
  const count = fore && s.stage === 0 ? 5 : 4;
  for (let q = 0; q < count; q++) {
    const x = (q - (count - 1) / 2) * r * (count === 5 ? 0.4 : 0.48), y = r * 1.1 - Math.abs(q - (count - 1) / 2) * r * 0.14;
    if (fore) {
      // Long and hooked down to their points on the ground ahead of the paw.
      const L = r * s.claws;
      toes.push(tube([[x, y - r * 0.2, -r * 0.3], [x * 1.1, y + L * 0.35, r * 0.05], [x * 1.18, y + L * 0.72, -r * 0.2], [x * 1.2, y + L * 0.92, -r * 0.7], [x * 1.2, y + L, -r * 0.95]],
        [r * 0.26, r * 0.22, r * 0.15, r * 0.08, 0.006], [r * 0.24, r * 0.2, r * 0.14, r * 0.07, 0.006], 5, (ring) => (ring === 0 ? 'mark' : s.stage === 0 ? (ring === 1 ? 'horn' : 'hornDark') : 'claw'), { start: false }));
    } else toes.push(orbAlong([x, y, -r * 0.6], [0, 1, -0.3], [r * 0.2, r * 0.26, r * 0.18], 5, 3, 'claw'));
  }
  return merge(pad, ...toes);
}

/** The Emberbrush's rake of a paw: five long tines off its toes, red at the root and cream out to their points, curving down to the ground ahead. */
function handOf(s: Ember, n: number): Mesh {
  const H = s.hand!, r = s.paw, out: Mesh[] = [orbAlong([0, r * 0.25, -r * 0.35], [0, 1, 0], [r * 1.25, r * 1.35, r * 0.66], n, 4, 'mark')];
  for (let q = 0; q < H.tines; q++) {
    const f = q / (H.tines - 1) - 0.5, x = f * r * 3.0;
    const L = H.len * (1 - 0.12 * Math.abs(f) * 2);
    // Each an arch: up off the toe, out, and hooked down to its point on the ground.
    const pts: V3[] = [[x, r * 0.6, -r * 0.2], [x * 1.3, r + L * 0.3, r + L * 0.12], [x * 1.5, r + L * 0.66, r + L * 0.08], [x * 1.6, r + L * 0.9, -r * 0.2], [x * 1.6, r + L * 0.94, -r * 1.0]];
    out.push(tube(pts, [r * 0.42, r * 0.38, r * 0.28, r * 0.14, 0.006], [r * 0.36, r * 0.32, r * 0.24, r * 0.12, 0.006], 6,
      (ring) => (ring < 2 ? 'hornDark' : 'horn'), { start: false }));
  }
  return merge(...out);
}

/**
 * The Ashsweeper's rake, in its own frame, the bar along `x`: a cream-gold bar rounded at its ends, glowing red marks along
 * its face, and a row of long curved red tines under it, each hooked down to its point on the ground.
 */
function rakeOf(s: Ember, n: number): Mesh {
  const T = s.tool!, k = T.w / 3, half = T.w / 2, d = BAR_D * k, h = BAR_H * k;
  const steps = 8, pts: V3[] = [];
  for (let q = 0; q <= steps; q++) pts.push([lerp(-half, half, q / steps), 0, 0]);
  const bar = tube(pts, d * 0.5, h * 0.5, n, (_r, j) => (upOf(j, n) > -0.2 ? 'stone' : 'stoneDark'), { up: [0, 0, 1], start: false, end: false });
  const ends = merge(...[-1, 1].map((sd) => orbAlong([sd * half, 0, 0], [1, 0, 0], [d * 0.62, h * 0.62, h * 0.7], n, 4, 'stone')));
  // The marks: little lit diamonds and bars along its face and top.
  const marks: Disc[] = [];
  const front: V3 = [0, 1, 0], top: V3 = [0, 0, 1];
  for (let q = 0; q < 7; q++) {
    const x = lerp(-half * 0.82, half * 0.82, q / 6);
    if (q % 2 === 0) {
      const c: V3 = [x, d * 0.5 + 0.006, 0];
      const r = h * 0.32;
      marks.push(facing([add(c, [0, 0, r]), add(c, [r * 0.8, 0, 0]), add(c, [0, 0, -r]), add(c, [-r * 0.8, 0, 0])], front, 'ember', true));
    } else {
      const c: V3 = [x, d * 0.5 + 0.006, 0];
      marks.push(facing([add(c, [-h * 0.6, 0, h * 0.1]), add(c, [h * 0.6, 0, h * 0.1]), add(c, [h * 0.6, 0, -h * 0.1]), add(c, [-h * 0.6, 0, -h * 0.1])], front, 'ember', true));
    }
    const ct: V3 = [x + (half / 7), 0, h * 0.5 + 0.006];
    marks.push(facing([add(ct, [-h * 0.5, -d * 0.12, 0]), add(ct, [h * 0.5, -d * 0.12, 0]), add(ct, [h * 0.5, d * 0.12, 0]), add(ct, [-h * 0.5, d * 0.12, 0])], top, 'ember', true));
  }
  const tines: Mesh[] = [];
  for (let q = 0; q < T.tines; q++) {
    const x = lerp(-half * 0.86, half * 0.86, q / (T.tines - 1)), L = T.len, w = 0.15 * k;
    const tp: V3[] = [[x, d * 0.1, -h * 0.3], [x, d * 0.2 + L * 0.34, -L * 0.22], [x, d * 0.2 + L * 0.56, -L * 0.52], [x, d * 0.2 + L * 0.54, -L * 0.8], [x, d * 0.2 + L * 0.4, -T.high + 0.01]];
    tines.push(tube(tp, [w, w * 0.88, w * 0.7, w * 0.42, 0.006], [w * 1.2, w * 1.05, w * 0.85, w * 0.5, 0.006], 6,
      (ring) => (ring === 0 ? 'shellDark' : ring < 3 ? 'shell' : 'hornDark'), { start: false }));
  }
  return merge(bar, ends, paint(marks), ...tines);
}

/**
 * A link of the kit's plume: a core of fur, red on the inside of its curl and cream outside, and locks all round it, long
 * and cream round its outside, short and red up its inside, so the plume is a big soft curl with red in its heart.
 */
function plumeLinkOf(s: Ember, q: number): Mesh {
  const T = s.tail!, L = T.links[q], w0 = T.w[q], w1 = T.w[Math.min(q + 1, T.w.length - 1)], n = fine ? 8 : 6;
  const red = q < 3;
  const core = tube([[0, 0.05, 0], [0, -L * 0.5, 0], [0, -L - 0.03, 0]], [w0, (w0 + w1) * 0.5, w1], [w0, (w0 + w1) * 0.5, w1], n,
    (_ring, j) => (red && Math.sin(((j + 1) / n) * TAU) > -0.15 ? 'coat' : 'mark'), { start: q === 0 ? false : undefined, end: false });
  const out: Mesh[] = [core];
  // Soft tufts lying back along it all round, standing a little out: red up the inside of the curl near its root, cream
  // round the outside and all the way out to the tip.
  const tufts = fine ? 5 : 4;
  for (let c = 0; c < tufts; c++) {
    const a = (c / tufts) * TAU + q * 0.7, nrm: V3 = [Math.cos(a), 0, Math.sin(a)];
    const inside = Math.sin(a) > 0.2, id = 900 + q * 13 + c;
    const Lk = L * (inside ? 1.0 : 1.35) * (q === 0 ? 0.55 : 1) * (0.9 + 0.2 * jitter(id));
    const root: V3 = [nrm[0] * w0 * 0.55, L * 0.15, nrm[2] * w0 * 0.55];
    // Red at its root and in a stripe up the outside of the curl; cream the rest.
    const reddish = q < 2 || (q < 4 && Math.cos(a) > 0.55) || (inside && red);
    const mat: Mat = reddish ? 'coat' : 'mark';
    out.push(feather(root, add(scale(nrm, inside ? 0.25 : 0.45), [0, -1, 0]), nrm, [0, -1, 0], Lk, w0 * 1.3, 0.1, [mat, mat, reddish ? 'coatLight' : 'muzzle'], 0.03, 0.55));
  }
  if (q === T.links.length - 1) out.push(feather([0, -L * 0.3, 0], [0, -1, 0.15], [0, 0.15, 1], [0, 0, 1], w1 * 2.2, w1 * 2.2, 0.15, ['mark', 'muzzle'], 0.03, 0.6));
  return merge(...out);
}

/**
 * The fan of plumes off its rump, in its own frame: plumes fanned in an arc from straight back up over its back and out to
 * either side, each a broad soft plume bowed like a flame; red ones dark at the root with an ember streak glowing down them
 * and a bright tip, every third one cream; and short dark feathers over the root of them all (`root`).
 */
interface Plume { root: V3; dir: V3; normal: V3; bend: V3; len: number; wide: number; curve: number; cream: boolean }
function plumesOf(s: Ember, root: boolean): Plume[] {
  const F = s.fan!, out: Plume[] = [];
  const count = root ? Math.round(F.n * 0.7) : F.n;
  for (let q = 0; q < count; q++) {
    const u = count > 1 ? q / (count - 1) : 0.5, id = (root ? 97 : 0) + q, cream = !root && q % 3 === 1;
    const th = (root ? lerp(F.from - 5, F.to + 10, u) : lerp(F.from, F.to, u)) * DEG;
    // Out to the sides by turns; the cream nearer the middle, lying over the red either side of it.
    const sd = q % 2 ? 1 : -1;
    const psi = (root ? F.side * 0.7 : cream ? F.side * 0.3 * jitter(id + 3) : F.side * (0.4 + 0.6 * jitter(id))) * DEG * sd;
    const dir: V3 = [Math.sin(psi), -Math.cos(th) * Math.cos(psi), Math.sin(th) * Math.cos(psi)];
    const tan: V3 = [0, Math.sin(th), Math.cos(th)];
    // Each turned about its own length, by turns, so the fan shows broad plumes from in front as well as from the side.
    const flat = unit(cross(dir, tan)), twist = (root ? 0 : 18 + 16 * jitter(id + 9)) * DEG * (q % 4 < 2 ? 1 : -1);
    const normal = unit(add(scale(flat, Math.cos(twist)), scale(unit(cross(dir, flat)), Math.sin(twist))));
    const len = F.len * (root ? 0.3 : (cream ? 0.86 : 0.8) + 0.26 * Math.sin(Math.PI * u)) * (0.92 + 0.16 * jitter(id + 5));
    const at: V3 = add([sd * F.wide * 0.12, cream ? F.wide * 0.12 : 0, 0], scale(tan, (u - 0.5) * F.wide * 0.4));
    out.push({ root: at, dir, normal, bend: scale(tan, -1), len, wide: F.wide * (root ? 0.5 : 1) * (0.9 + 0.2 * jitter(id + 7)), curve: root ? 0.05 : 0.34, cream });
  }
  return out;
}
/** How thick a plume is against its width. */
const FAN_PUFF = 0.26;
function fanOf(s: Ember, root: boolean): Mesh {
  const out: Mesh[] = [], lit: Disc[] = [];
  const red: readonly Mat[] = ['featherDark', 'feather', 'feather', 'feather', 'feather', 'feather', 'feather', 'petal'];
  const cream: readonly Mat[] = ['feather', 'mark', 'mark', 'mark', 'mark', 'mark', 'mark', 'muzzle'];
  for (const P of plumesOf(s, root)) {
    out.push(feather(P.root, P.dir, P.normal, P.bend, P.len, P.wide, P.curve, root ? ['featherDark', 'featherDark', 'feather'] : P.cream ? cream : red, 0.035, FAN_PUFF));
    if (!root && !P.cream) lit.push(...streak(P.root, P.dir, P.normal, P.bend, P.len, P.wide, P.curve, 0.3, 0.8, 'ember', 0.035, FAN_PUFF));
  }
  return merge(...out, paint(lit));
}

/** A shoulder or haunch plate: a domed red shell over the outside of the leg's top, a darker rim round it, and a glowing spiral on it. */
function plateOf(c: V3, r: V3, side: number, n: number, k: number): Mesh {
  const dir: V3 = [side, 0.1, 0.25];
  const rim = orb(add(c, [-side * r[0] * 0.15, 0, 0]), [r[0] * 0.9, r[1] * 1.08, r[2] * 1.08], n, k, 'shellDark');
  const shell = orb(c, r, n, k, 'shell');
  return merge(rim, shell, paint(spiralOn(c, r, dir, Math.min(r[1], r[2]) * 0.62, Math.min(r[1], r[2]) * 0.13)));
}

/* ---- pieces ------------------------------------------------------------------------------------------- */

function emberBuild(s: Ember, lod: number): Piece[] {
  fine = !!lod;
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6), B = s.body;
  const pieces: Piece[] = [];
  const mid = ringAt(B, 0);
  const barrel = { c: [0, (B.y[0] + B.y[B.y.length - 1]) / 2, mid.z] as V3, r: [mid.w * 0.95, (B.y[B.y.length - 1] - B.y[0]) * 0.47, mid.h * 0.95] as V3 };
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 9), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  pieces.push({ key: 'ruff', mesh: ruffOf(s, n), bone: 'trunk', bias: 0.06, after: ['body', 'fl0', 'fr0', ...(s.armour ? ['flp', 'frp'] : [])], front: [0, 1, 0], lines: false, hide: [barrel] });
  if (s.cape) pieces.push({ key: 'cape', mesh: capeOf(s), bone: 'trunk', bias: 0.05, after: ['body', 'fl0', 'fr0', 'ruff'], lines: false, hide: [barrel] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: ['head', 'body', 'ruff', 'neckFur'] });
  pieces.push({ key: 'neckFur', mesh: neckFurOf(s), bone: 'neck', bias: 0.02, after: ['neck', 'ruff'], lines: false });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, after: 'neckFur', hide });
  if (s.ear) {
    const ear = earOf(s, n);
    for (const q of [0, 1]) pieces.push({ key: `ear${q}`, mesh: q ? ear : mirrorX(ear), bone: `ear${q}`, bias: 0.19, after: 'head', hide, hideIn: 'head' });
  }
  if (s.crest) {
    const crest = crestOf(s);
    for (const q of [0, 1]) pieces.push({ key: `ear${q}`, mesh: q ? crest : mirrorX(crest), bone: `ear${q}`, bias: 0.18, after: 'head', hide, hideIn: 'head', lines: false });
  }
  if (s.tail) s.tail.links.forEach((_, q) => pieces.push({ key: `tail${q}`, mesh: plumeLinkOf(s, q), bone: `tail${q}`, bias: -0.05 + q * 0.01, chain: 'tail', lines: false }));
  if (s.fan) {
    pieces.push({ key: 'fan', mesh: fanOf(s, false), bone: 'fan', bias: -0.12, lines: false });
    pieces.push({ key: 'fanRoot', mesh: fanOf(s, true), bone: 'fan', bias: -0.02, after: 'fan', lines: false });
  }
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const sideV: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const hw = fore ? w * 1.4 : w * (s.stage ? 1.75 : 1.55);
    const hc: V3 = [0, fore ? 0 : -w * 0.15, fore ? 0 : -w * 0.2], hr: V3 = [hw, hw * (fore ? 1.1 : 1.15), hw * (fore ? 1.2 : 1.1)];
    const upperMat: Mat = fore ? (s.stage === 0 ? 'mark' : 'coat') : 'coat';
    const upperM = merge(
      orb(hc, hr, n, k, upperMat),
      tube([[0, 0, -w * 0.3], [0, 0, -L[0]]], [hw * 0.8, w * 0.85], [hw * 0.8, w * 0.85], n, upperMat, { seam: 'start' }),
      orb([0, 0, -L[0]], w * 0.86, n, k, s.stage === 0 && fore ? 'mark' : s.stage === 0 ? 'coat' : 'spot'),
    );
    // A glowing spiral on each haunch; on the Ashsweeper on a plate over it, and over each shoulder too.
    let marks: Mesh | false = false;
    if (s.armour) marks = plateOf(add(hc, [side * hw * 0.5, fore ? 0.04 : 0, hw * (fore ? 0.4 : 0.25)]), [hw * 0.6, hr[1] * (fore ? 0.9 : 1.0), hr[2] * (fore ? 0.9 : 1.0)], side, n, k);
    else if (!fore) marks = paint(spiralOn(hc, hr, [side, -0.15, 0.2], hw * s.spiral, hw * 0.11));
    const lowerMat: MatOf = s.stage === 0 ? (fore ? (ring) => (ring >= 1 ? 'coatDark' : 'mark') : (ring) => (ring >= 1 ? 'mark' : 'coatDark')) : 'spot';
    const lowerM = tube([[0, 0, w * 0.5], [0, 0, -L[1] * 0.45], [0, 0.01, -L[1]]], [w * 0.86, w * 0.64, w * 0.44], [w * 0.9, w * 0.68, w * 0.46], n, lowerMat, { seam: 'start' });
    const lastMat: Mat = s.stage === 0 ? 'mark' : 'spot';
    const lastM = tube([[0, 0, w * 0.35], [0, 0.01, -L[2] - s.paw * 0.2]], [w * 0.42, w * 0.34], [w * 0.44, w * 0.36], n, lastMat, { seam: 'start' });
    // Bronze bands round the Ashsweeper's forearms.
    const bands = fore && s.bands ? merge(...Array.from({ length: s.bands }, (_, q) => {
      const z = -L[1] * (0.3 + 0.18 * q), r = lerp(w * 0.64, w * 0.5, (0.3 + 0.18 * q) / 0.8) * 1.18;
      return tube([[0, 0, z + 0.05], [0, 0, z - 0.05]], r, r * 1.04, n, (ring, j) => (upOf(j, n) > 0.3 ? 'metal' : 'metalDark'), { up: [0, 1, 0] });
    })) : false;
    const onRake = s.tool && fore ? ['rake'] : [];
    pieces.push(
      { key: `${key}0`, mesh: s.armour && fore ? upperM : merge(upperM, marks), bone: `${key}0`, bias: 0.01, after: ['body'], front: sideV },
      { key: `${key}1`, mesh: merge(lowerM, bands), bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: out3 },
      { key: `${key}3`, mesh: lastM, bone: `${key}3`, bias: 0.025, after: ['body', `${key}1`], front: out3 },
      { key: `${key}2`, mesh: s.hand && i === 1 ? handOf(s, n) : pawOf(s, fore, n), bone: `${key}2`, bias: 0.03, after: ['body', `${key}3`, ...onRake], front: out3 },
    );
    // The Ashsweeper's shoulder plates lie over its ruff and mantle.
    if (s.armour && fore) pieces.push({ key: `${key}p`, mesh: marks as Mesh, bone: `${key}0`, bias: 0.04, after: [`${key}0`], front: sideV });
    // Cream feathers over the tops of the bigger two's hind legs, their breeches.
    if (s.stage > 0 && !fore) {
      const tuft: Mesh[] = [];
      for (let q = 0; q < 7; q++) {
        const a = lerp(-0.9, 0.9, q / 6), nrm: V3 = [side * Math.cos(a) * 0.8, -Math.sin(a) * 0.4 - 0.4, -0.2];
        const root: V3 = add([0, 0, -L[0] * (0.5 + 0.12 * (q % 2))], scale(unit(nrm), w * 0.9));
        const Lf = s.ruff.len * 0.9 * (0.85 + 0.3 * jitter(700 + q + i * 9));
        tuft.push(feather(root, add(scale(unit(nrm), 0.35), [0, -0.2, -1]), nrm, [0, -1, 0], Lf, Lf * 0.55, 0.06, ['mark', 'mark', 'muzzle'], 0.02));
      }
      pieces.push({ key: `${key}f`, mesh: merge(...tuft), bone: `${key}0`, bias: 0.022, after: [`${key}0`, `${key}1`], front: sideV, lines: false });
    }
  }
  if (s.tool) pieces.push({ key: 'rake', mesh: rakeOf(s, n), bone: 'rake', bias: 0.04 });
  return pieces;
}

/** The same mesh left for right, its faces wound back the right way out. */
const mirrorX = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- its light, and what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const EMBER: RGB = [255, 128, 40];
const GOLD: RGB = [255, 206, 96];
const ASH: RGB = [168, 162, 156];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const bigness = (s: Ember): number => 0.5 + 0.5 * (s.len / 2);

/** A soft light added over what is under it, `r` across at `al`. */
function light(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.004 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(c, al));
  grad.addColorStop(0.45, css(c, al * 0.35));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** How brightly its marks glow this moment: breathing slowly, flaring at a strike and as it evolves. */
function glowOf(s: Ember, a: Anim): number {
  let k = 1 + 0.25 * cyc(a.t, 6) + 0.08 * cyc(a.t, 17, 1.3);
  if (a.act?.kind === 'strike') k += 0.8 * hump(a.act.t, EMBER_HITS[s.stage], 0.18);
  if (a.act?.kind === 'evolve') k += 1.4 * ramp(a.act.t, 0.1, 0.5) * (1 - ramp(a.act.t, 0.55, 0.9));
  return k;
}

/** The glow over its spirals and its rune, on the side toward the viewer. */
function markLights(g: CanvasRenderingContext2D, view: View, s: Ember, b: Bones, a: Anim): void {
  const k = glowOf(s, a), T = view.T;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const show = (p: V3, n: V3, r: number, al: number): void => {
    const face = clamp((dot(n, T) - 0.05) / 0.4);
    if (face <= 0) return;
    const [x, y] = onScreen(view, p);
    light(g, x, y, r * (0.85 + 0.15 * k), EMBER, clamp(al * face * k, 0, 0.6));
  };
  for (let i = 0; i < 4; i++) {
    const fore = i < 2;
    if (fore && !s.armour) continue;
    const xf = b[`${LEGS4[i]}0`], w = s.thick, hw = fore ? w * 1.4 : w * (s.stage ? 1.75 : 1.55), side = SIDE[i];
    const c: V3 = s.armour ? [side * hw * 1.05, 0, hw * 0.15] : [side * hw * 0.95, -w * 0.2, -w * 0.1];
    show(place(xf, c), turn(xf, [side, 0, 0.2]), hw * 1.3, 0.3);
  }
  if (s.rune) show(place(b.head, add(skullAt(s), [0, s.head.r[1] * 0.62, s.head.r[2] * 0.62])), turn(b.head, [0, 0.7, 0.7]), s.rune * 3, 0.32);
  g.restore();
}

/** A puff of ash: a soft grey cloud of three lobes, growing as it goes and thinning to nothing over its life (`age`). */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.75 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.8 * age);
  const c = mix(ASH, [236, 232, 226], 0.15 + 0.35 * age);
  for (let q = 0; q < 3; q++) {
    const ang = (q / 3) * TAU + jitter(id) * TAU, d = q ? rr * 0.42 : 0, lr = rr * (q ? 0.72 : 1);
    const cx = x + Math.cos(ang) * d, cy = y + Math.sin(ang) * d * 0.6 - rr * 0.3 * age;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, lr);
    grad.addColorStop(0, css(c, al * (q ? 0.7 : 1)));
    grad.addColorStop(0.55, css(c, al * 0.45 * (q ? 0.7 : 1)));
    grad.addColorStop(1, css(c, 0));
    g.fillStyle = grad;
    g.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
  }
}

/** An ember: a bright point with a little light about it, red as it cools, never under a pixel and a half. */
function spark(g: CanvasRenderingContext2D, x: number, y: number, r: number, heat: number): void {
  if (heat <= 0.02) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, 1.5 / px);
  const c = mix([220, 60, 20], GOLD, heat);
  g.save();
  g.globalCompositeOperation = 'lighter';
  light(g, x, y, r * 3.2, c, 0.5 * heat);
  g.restore();
  g.fillStyle = css(mix(c, [255, 250, 230], 0.4 * heat), 0.95 * Math.min(1, heat * 1.5));
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** Embers thrown up from `from`, `since` seconds after, out and up and falling, cooling as they go. */
function embers(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, size: number, life = 0.7): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const kk = id + q * 7, ang = jitter(kk) * TAU, sp = speed * (0.4 + 0.7 * jitter(kk + 1));
    const p: V3 = [from[0] + Math.cos(ang) * sp * since, from[1] + Math.sin(ang) * sp * since, from[2] + (1.6 + 1.4 * jitter(kk + 2)) * speed * since - 3 * since * since];
    if (p[2] < 0) continue;
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    spark(g, x, y, size * (0.6 + 0.6 * jitter(kk + 3)), (1 - since / life) * (0.7 + 0.3 * jitter(kk + 4)));
  }
}

/** Where on the ground what it rakes with is, at a moment of its go: the claws ahead of the kit's paw, the tines of the bigger two's. */
function rakeTip(s: Ember, R: Rest, t: number): { p: V3; st: ReturnType<typeof strokeOf> } {
  const W = EMBER_WORK.strokes[s.stage], k = STROKE_K[s.stage], { c, q } = strokeIn(t, W, k), st = strokeOf(t, c, k);
  if (s.tool) {
    const T = s.tool;
    return { p: [0, R.paw[0][1] + T.ahead + 0.5 * R.reach[0] * st.y + T.len * 0.3, 0.05], st };
  }
  const i = s.stage === 0 && q % 2 ? 0 : 1, A = R.paw[i], L = R.reach[i];
  const fwd = (s.stage === 0 ? 0.55 : 0.62) * L, reach = s.hand ? s.hand.len : s.paw * s.claws;
  return { p: [A[0] * 0.85, A[1] + fwd * st.y + reach, 0.05], st };
}

/** What a go at its task throws: grey ash billowing off what it drags, and embers kicked up as it digs in and as it drags. */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Ember, R: Rest, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, loop = a.graze >= 0.5, W = EMBER_WORK.strokes[s.stage];
  for (const [q, c] of W.entries()) {
    // Ash off the drag, a puff every little way along it, each living a while after.
    for (let j = 0; j < 5; j++) {
      const te = c + (j / 4) * EMBER_DRAG, since = t >= te ? (t - te) * ACT_SECS.work : loop ? (t + 1 - te) * ACT_SECS.work : -1;
      if (since < 0 || since > 0.7) continue;
      const tip = rakeTip(s, R, te).p, w = s.tool ? s.tool.w * 0.4 : 0;
      for (const sd of s.tool ? [-1, 0, 1] : [0]) {
        const p: V3 = [tip[0] + sd * w, tip[1] - 0.1 * big * since, 0.08 + 0.3 * big * since];
        if (nearSide(p, mid, view) === front) puff(g, view, p, (0.3 + 0.2 * j / 4) * big * (s.tool ? 1.5 : 1), since / 0.7, q * 11 + j * 3 + sd);
      }
    }
    // Embers where it digs in, and off the end of the drag.
    const dig = c - 0.02, sinceDig = t >= dig ? (t - dig) * ACT_SECS.work : loop ? (t + 1 - dig) * ACT_SECS.work : -1;
    const tip = rakeTip(s, R, c).p;
    embers(g, view, mid, tip, sinceDig, front, s.tool ? 12 : 7, 40 + q * 17, 0.9 * big, 0.06 * big);
    const end = c + EMBER_DRAG, sinceEnd = t >= end ? (t - end) * ACT_SECS.work : loop ? (t + 1 - end) * ACT_SECS.work : -1;
    embers(g, view, mid, rakeTip(s, R, end).p, sinceEnd, front, s.tool ? 6 : 3, 80 + q * 13, 0.7 * big, 0.05 * big);
  }
}

/** What a strike throws: embers off its claws or rake as it lands, and the Ashsweeper's a burst of ash. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Ember, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - EMBER_HITS[s.stage]) * ACT_SECS.strike;
  if (since < 0 || since > 0.6) return;
  const p = s.tool && b.rake ? place(b.rake, [0, s.tool.len * 0.3, -s.tool.high * 0.9]) : place(b.fr2, [0, s.paw * 2, 0]);
  embers(g, view, mid, p, since, front, 8, 30, 1.2 * big, 0.04 * big);
  if (s.tool) for (const sd of [-1, 0, 1]) {
    const at: V3 = [p[0] + sd * s.tool.w * 0.35, p[1], 0.1];
    if (nearSide(at, mid, view) === front) puff(g, view, at, 0.4 * big, since / 0.6, 7 + sd);
  }
}

/** Evolving: embers swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Ember, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, B = s.body;
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = B.w[3] * 1.7 + 0.3 * big, ry = s.len * 0.8 + 0.3 * big, high = s.high * 1.8 + 1.0 * big;
  for (let q = 0; q < 24; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36);
    const ang = (q / 24) * TAU + u * TAU * 1.3, kk = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * kk, Math.sin(ang) * ry * kk, -s.high * 0.7 + u * high * 0.8]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    spark(g, x, y, 0.05 * big * (1 - 0.4 * u), swirl * ramp(u, 0, 0.15) * (q % 3 ? 1 : 0.7));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function emberKind(s: Ember): Kind {
  const R = restOf(s);
  return {
    bones: emberBones(s),
    build: (lod) => emberBuild(s, lod),
    // The variant's coat tints its red and its markings the cream of its ruff and plumes; the dark brown, the gold of its
    // marks, its amber eyes, its beak and its armour are the same on every variant.
    palette: (coat, mark) => {
      const red = mix([160, 40, 30], coat, 0.25), cream = mix([250, 236, 210], mark, 0.35);
      return coatPalette(coat, mark, {
        coat: red,
        coatLight: mix(red, [255, 150, 80], 0.4),
        coatDark: [96, 42, 34],
        belly: cream,
        mark: cream,
        muzzle: mix(cream, [255, 250, 240], 0.4),
        inner: mix(cream, [246, 214, 196], 0.4),
        nose: [64, 38, 34],
        lid: [86, 44, 36],
        eye: [52, 26, 20],
        glint: [255, 253, 246],
        crystal: [238, 152, 44],
        claw: [72, 46, 40],
        horn: [246, 228, 196],
        hornDark: [196, 70, 46],
        bill: [244, 222, 168],
        billDark: [188, 146, 96],
        feather: mix([178, 36, 28], coat, 0.15),
        featherDark: [110, 46, 38],
        petal: [255, 184, 92],
        ember: EMBER,
        flame: GOLD,
        shell: [196, 54, 40],
        shellDark: [124, 34, 30],
        metal: [204, 146, 82],
        metalDark: [140, 92, 56],
        stone: [238, 206, 144],
        stoneDark: [196, 156, 98],
        spot: [96, 54, 46],
      } as Partial<ReturnType<Kind['palette']>>);
    },
    shadow: [s.len * 0.75 + 0.4, s.body.w[3] * 1.4],
    stride: 1,
    size: s.size,
    acts: ['strike', 'work'],
    motes: [EMBER, GOLD],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (front) markLights(g, view, s, b, a);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, R, b, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const EMBERKIT = emberKind(EMBERKIT_LOOK);
export const EMBERBRUSH = emberKind(EMBERBRUSH_LOOK);
export const ASHSWEEPER = emberKind(ASHSWEEPER_LOOK);
