import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, taper, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut, under } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The crag line: the Pebbletooth, a little lizard pup of a thing, sandy grey
 * and cobbled all over in round pebbles, a big head with big orange eyes, a
 * fat tail curled up in a spiral behind it and stubby splayed legs; which
 * grows into the Shaleclaw, a longer lizard crouched low on clawed feet, its
 * back bristling with jagged blue-grey shards of shale standing up and swept
 * back; and then the Cragjaws, a great heavy reptile under boulders of rock
 * and a ridge of rock spikes, a big head on a short thick neck whose jaw
 * opens wide on its fangs. The species is still `thumpa` underneath, as saves
 * and the database know it: the fighter whose every few blows stun.
 *
 * Built the way the brick line is (`./wild-brick`): one set of functions from
 * a description of the stage (`Crag`), every foot given a point on the ground
 * and its leg bent to reach it, the elbows and knees out and up from the body,
 * so a planted foot stays where it was put. It walks a lizard's walk, the
 * diagonals together, its spine waving from side to side and its tail swung
 * against it. It bites: drawn back with its jaw open, a lunge onto its fore
 * feet, and the jaw snapped shut. Its stun is a slam: it rears, its tail up,
 * and brings its fore feet and its tail down together, and the ground rings
 * out from it in a shock and cracks. At its post it crouches alert, its head
 * sweeping from side to side, its tail lashing.
 *
 * Every plate of it is a stone of its own, a block of facets with its corners
 * knocked off true (`rock`), so its back catches the light in steps.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/**
 * Stone on the back: a row of it down each side, `th` round the barrel from the right side (a quarter turn is the ridge), from
 * `y0` to `y1` along it, `count` of them, each `r` across, along and high; what each is -- a round pebble lying on it, a shard of
 * shale standing up out of it swept back, a boulder lying on it, or a spike of rock.
 */
interface Row { th: number; y0: number; y1: number; count: number; r: V3; kind: 'pebble' | 'shale' | 'boulder' | 'spike' }

interface Crag {
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
  /** How far apart its feet stand, against the barrel's width at its shoulders and hips. */
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
  /** The eyes: the way out of the skull to the right one, how big, how tall against wide; how heavy a brow of stone over them. */
  eye: { dir: V3; size: number; tall: number; brow: number };
  /** How far its jaw opens at the most (degrees), and how far it hangs open standing. */
  jaw: { most: number; rest: number };
  /** Its teeth: how long the front fangs are, and how many teeth down each side of each jaw. */
  teeth: { fang: number; count: number };
  tail: {
    at: V3;
    links: number[];
    w: number[];
    /** How it carries its tail: lifted at the root (degrees up from straight back), curled up at each link, curled further at the last three. */
    lift: number; curl: number; tip: number;
  };
  rows: Row[];
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

const QUARTER = Math.PI / 2;

/** A Pebbletooth: a little round lizard pup cobbled in pebbles, a big head with big eyes, stubby legs, its tail curled up in a spiral. */
const PEBBLETOOTH_LOOK: Crag = {
  stage: 0,
  body: { y: [-0.7, -0.59, -0.3, 0, 0.3, 0.54, 0.65], z: [0.02, 0, -0.01, 0, 0.02, 0.04, 0.06], w: [0.21, 0.37, 0.45, 0.47, 0.45, 0.37, 0.2], h: [0.14, 0.24, 0.28, 0.29, 0.28, 0.24, 0.14] },
  len: 0.94, hip: 0.72, drop: 0.5,
  fore: [0.3, 0.22, 0.06], hind: [0.32, 0.22, 0.06], thick: 0.15, spread: 1.5, knee: 1.4, reachOut: [0.07, 0.05],
  high: 0.31,
  neck: { at: [0, 0.57, 0.05], len: 0.1, w: 0.3, lean: 68 },
  head: { r: [0.42, 0.42, 0.32], snout: [0.3, 0.19, 0.26], up: 0.15, pitch: 2 },
  eye: { dir: [0.64, 0.6, 0.44], size: 0.175, tall: 1.08, brow: 0 },
  jaw: { most: 34, rest: 0 },
  teeth: { fang: 0.05, count: 0 },
  tail: { at: [0, -0.65, 0.05], links: [0.19, 0.18, 0.17, 0.16, 0.15, 0.14, 0.13, 0.12], w: [0.16, 0.15, 0.14, 0.13, 0.12, 0.105, 0.09, 0.075], lift: -6, curl: 22, tip: 30 },
  rows: [
    { th: QUARTER, y0: -0.6, y1: 0.5, count: 7, r: [0.11, 0.11, 0.05], kind: 'pebble' },
    { th: 1.05, y0: -0.56, y1: 0.46, count: 6, r: [0.1, 0.1, 0.045], kind: 'pebble' },
    { th: 0.55, y0: -0.46, y1: 0.38, count: 5, r: [0.085, 0.085, 0.04], kind: 'pebble' },
    { th: 0.1, y0: -0.3, y1: 0.26, count: 3, r: [0.07, 0.07, 0.035], kind: 'pebble' },
  ],
  gait: { duty: [0.62, 0.42], swing: [0.34, 0.36], step: 0.22, bob: 0.025, roll: 3, wave: [13, 17] },
  size: 5.0,
};

/** A Shaleclaw: a longer lizard crouched low on clawed feet, its back bristling with jagged shards of blue-grey shale. */
const SHALECLAW_LOOK: Crag = {
  stage: 1,
  body: { y: [-1.15, -1.0, -0.56, 0, 0.56, 0.92, 1.08], z: [0.04, 0.02, 0, 0.02, 0.04, 0.08, 0.12], w: [0.32, 0.58, 0.7, 0.72, 0.7, 0.56, 0.3], h: [0.24, 0.4, 0.47, 0.48, 0.47, 0.4, 0.24] },
  len: 1.6, hip: 0.72, drop: 0.5,
  fore: [0.62, 0.44, 0.09], hind: [0.66, 0.46, 0.09], thick: 0.22, spread: 1.6, knee: 1.9, reachOut: [0.1, 0.06],
  high: 0.5,
  neck: { at: [0, 0.95, 0.16], len: 0.3, w: 0.46, lean: 62 },
  head: { r: [0.5, 0.56, 0.37], snout: [0.34, 0.22, 0.5], up: 0.14, pitch: -4 },
  eye: { dir: [0.74, 0.5, 0.45], size: 0.14, tall: 1.0, brow: 1 },
  jaw: { most: 40, rest: 0 },
  teeth: { fang: 0.08, count: 3 },
  tail: { at: [0, -1.1, 0.06], links: [0.32, 0.31, 0.3, 0.29, 0.28, 0.27, 0.26, 0.25, 0.24], w: [0.24, 0.22, 0.2, 0.18, 0.16, 0.14, 0.12, 0.1, 0.08], lift: -4, curl: 2, tip: 5 },
  rows: [
    { th: 0.95, y0: -0.9, y1: 0.8, count: 6, r: [0.15, 0.15, 0.055], kind: 'pebble' },
    { th: 0.42, y0: -0.8, y1: 0.7, count: 6, r: [0.13, 0.13, 0.05], kind: 'pebble' },
    { th: QUARTER, y0: -0.78, y1: 0.72, count: 5, r: [0.09, 0.5, 1.3], kind: 'shale' },
    { th: 1.1, y0: -0.7, y1: 0.6, count: 4, r: [0.08, 0.46, 1.0], kind: 'shale' },
    { th: 0.7, y0: -0.54, y1: 0.46, count: 3, r: [0.06, 0.36, 0.6], kind: 'shale' },
  ],
  gait: { duty: [0.64, 0.42], swing: [0.3, 0.32], step: 0.2, bob: 0.03, roll: 2.5, wave: [12, 16] },
  size: 4.2,
};

/** A Cragjaws: a great heavy reptile under boulders and a ridge of rock spikes, a big head on a thick neck, its jaw open on its fangs. */
const CRAGJAWS_LOOK: Crag = {
  stage: 2,
  body: { y: [-1.95, -1.7, -1.0, 0, 1.0, 1.6, 1.85], z: [0.06, 0.03, 0, 0.04, 0.1, 0.18, 0.26], w: [0.66, 1.15, 1.4, 1.45, 1.42, 1.18, 0.66], h: [0.5, 0.85, 1.0, 1.06, 1.04, 0.9, 0.5] },
  len: 2.8, hip: 0.7, drop: 0.55,
  fore: [1.05, 0.78, 0.18], hind: [1.1, 0.8, 0.18], thick: 0.46, spread: 1.32, knee: 1.3, reachOut: [0.13, 0.08],
  high: 0.9,
  neck: { at: [0, 1.7, 0.38], len: 0.5, w: 0.95, lean: 60 },
  head: { r: [0.9, 0.98, 0.7], snout: [0.7, 0.42, 0.88], up: 0.32, pitch: 2 },
  eye: { dir: [0.76, 0.46, 0.46], size: 0.24, tall: 1.0, brow: 1.3 },
  jaw: { most: 46, rest: 16 },
  teeth: { fang: 0.26, count: 4 },
  tail: { at: [0, -1.9, 0.22], links: [0.56, 0.5, 0.45, 0.4, 0.35, 0.3], w: [0.68, 0.6, 0.5, 0.4, 0.3, 0.2], lift: -10, curl: 6, tip: 8 },
  rows: [
    { th: 0.3, y0: -1.45, y1: 1.25, count: 6, r: [0.36, 0.42, 0.17], kind: 'boulder' },
    { th: 0.78, y0: -1.6, y1: 1.4, count: 6, r: [0.44, 0.5, 0.22], kind: 'boulder' },
    { th: 1.2, y0: -1.55, y1: 1.35, count: 5, r: [0.48, 0.54, 0.24], kind: 'boulder' },
    { th: QUARTER, y0: -1.2, y1: 1.35, count: 5, r: [0.3, 0.36, 0.5], kind: 'spike' },
  ],
  gait: { duty: [0.68, 0.48], swing: [0.27, 0.31], step: 0.18, bob: 0.05, roll: 3, wave: [10, 13] },
  size: 3.6,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a back of stones is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A shake dying away after a blow, `since` seconds after it, `k` at most. */
const ringOut = (since: number, k: number, f = 7, damp = 7): number => (since < 0 ? 0 : k * Math.exp(-since * damp) * Math.sin(since * TAU * f));
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
/** The same point and way out, on the left side. */
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });
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
/** A frame stretched along its own axes by `k`. */
const scaled = (x: Xf, k: V3): Xf => { const m = x.m; return { m: [m[0] * k[0], m[1] * k[1], m[2] * k[2], m[3] * k[0], m[4] * k[1], m[5] * k[2], m[6] * k[0], m[7] * k[1], m[8] * k[2]], t: x.t }; };

/** Each face wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
function wound(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}

/**
 * A stone: a block of `n` sides standing along `up` with its edges cut back by `bevel`, `r` across, along and high, every corner
 * knocked off true by `rough` of its size so no two are alike -- flat faces meeting at hard edges, which is what makes it stone.
 * With `point`, it narrows from its foot at `c` to a point twice its `r` high: a spike, or with a thin `r` a shard.
 */
function rock(c: V3, r: V3, o: { up?: V3; fwd?: V3; n?: number; bevel?: number; rough?: number; seed: number; mat: Mat; point?: boolean; dome?: boolean }): Mesh {
  const n = o.n ?? 5, bv = o.bevel ?? 0.32, rough = o.rough ?? 0.16, sd = o.seed;
  const [X, Y, Z] = frameOf(o.up ?? [0, 0, 1], o.fwd ?? [0, 1, 0]);
  // A dome lies on what it is on, its foot sunk into it, so it has no underside to cut: a pebble on a back.
  const rings: Array<[number, number]> = o.point ? [[0, 1], [0.8, 0.62], [2, 0]] : o.dome ? [[-1, 1], [0.1, 0.94], [1, 1 - bv]] : [[-1, 1 - bv], [-1 + bv * 0.9, 1], [1 - bv * 0.9, 1], [1, 1 - bv]];
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const spin = jitter(sd + 0.5) * TAU;
  const at = (x: number, y: number, z: number): V3 => add(c, add(add(scale(X, x * r[0]), scale(Y, y * r[1])), scale(Z, z * r[2])));
  rings.forEach(([z, k], q) => {
    if (k === 0) {
      // The tip of a spike, a little off its middle and swept back.
      v.push(at(0.2 * (jitter(sd + 9) - 0.5), -0.25 - 0.2 * jitter(sd + 11), z));
      return;
    }
    for (let j = 0; j < n; j++) {
      const id = sd * 7.3 + q * 13 + j;
      const a = spin + ((j + 0.3 * (jitter(id) - 0.5)) / n) * TAU, kk = k * (1 + rough * (jitter(id + 3) - 0.5) * 2);
      v.push(at(Math.cos(a) * kk, Math.sin(a) * kk, z + rough * (jitter(id + 5) - 0.5) * (q === 0 || q === rings.length - 1 ? 0.8 : 1.2)));
    }
  });
  const mid = o.point ? add(c, scale(Z, r[2] * 0.6)) : c;
  const centroid = (idx: number[]): V3 => scale(idx.reduce((s, i) => add(s, v[i]), [0, 0, 0] as V3), 1 / idx.length);
  const push = (idx: number[]): void => { f.push({ i: idx, m: o.mat }); want.push(sub(centroid(idx), mid)); };
  push(Array.from({ length: n }, (_, j) => j));
  for (let q = 0; q < rings.length - 1; q++) {
    const A = q * n, top = rings[q + 1][1] === 0;
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      if (top) push([A + j, A + j2, A + n]);
      else push([A + j, A + j2, A + n + j2, A + n + j]);
    }
  }
  if (!o.point) push(Array.from({ length: n }, (_, j) => (rings.length - 1) * n + j));
  want[0] = scale(Z, -1);
  if (!o.point) want[want.length - 1] = Z;
  return mesh(v, wound(v, f, want));
}

/**
 * A shard of shale: a flat slab `r[0]` thick (half), `r[1]` along and `r[2]` high, its top edge broken into two or three jagged
 * points, standing along `up` with its broad faces across `fwd`'s side, so seen side on it shows its face and catches the light.
 */
function shard(c: V3, r: V3, o: { up: V3; fwd: V3; seed: number; mat: Mat }): Mesh {
  const [X, Y, Z] = frameOf(o.up, o.fwd), sd = o.seed;
  // The outline, along and up: its foot, then up its back edge, over its points and down its front, each corner jittered.
  const peaks = 2 + Math.floor(jitter(sd + 1) * 2);
  const prof: Array<[number, number]> = [[-1, -0.15], [1, -0.15], [0.95, 0.35]];
  for (let q = 0; q < peaks; q++) {
    const u = 1 - (q + 0.5) / peaks * 2, hi = q === 0 ? 1 : 0.62 + 0.3 * jitter(sd + q + 3);
    prof.push([u * 0.9 + 0.12, hi], [u * 0.9 - 0.12 * peaks / 2, hi * (0.55 + 0.2 * jitter(sd + q + 7))]);
  }
  prof.push([-0.92, 0.3]);
  const at = (a: number, b: number, side: number): V3 => add(c, add(add(scale(X, side * r[0] * (1 - 0.6 * clamp(b))), scale(Y, a * r[1])), scale(Z, b * r[2])));
  const v: V3[] = [...prof.map(([a, b], q) => at(a + 0.08 * (jitter(sd + q * 5) - 0.5), b, 1)), ...prof.map(([a, b], q) => at(a + 0.08 * (jitter(sd + q * 5) - 0.5), b, -1))];
  const N = prof.length, f: Face[] = [], want: V3[] = [];
  f.push({ i: Array.from({ length: N }, (_, j) => j), m: o.mat });
  want.push(X);
  f.push({ i: Array.from({ length: N }, (_, j) => N + j), m: o.mat });
  want.push(scale(X, -1));
  for (let j = 0; j < N; j++) {
    const j2 = (j + 1) % N, a = prof[j], b = prof[j2];
    f.push({ i: [j, j2, N + j2, N + j], m: o.mat });
    want.push(add(scale(Y, b[1] - a[1]), scale(Z, -(b[0] - a[0]))));
  }
  return mesh(v, wound(v, f, want));
}

/** A pebble's colour by its number: mostly the light grey, some darker, a few the skin's own sand. */
function pebbleMat(i: number): Mat {
  const k = jitter(i * 3.7 + 2);
  return k < 0.5 ? 'stone' : k < 0.86 ? 'stoneDark' : 'coatDark';
}
/** A shard of shale's colour: blue-grey, a darker of it, now and then a grey. */
function shaleMat(i: number): Mat {
  const k = jitter(i * 4.1 + 3);
  return k < 0.6 ? 'shell' : 'shellDark';
}
/** A boulder's: stone, darker stone, and now and then a weathered sand. */
function boulderMat(i: number): Mat {
  const k = jitter(i * 2.9 + 5);
  return k < 0.42 ? 'horn' : k < 0.82 ? 'stone' : 'stoneDark';
}
const plateMat = (kind: Row['kind'], i: number): Mat => (kind === 'pebble' ? pebbleMat(i) : kind === 'shale' ? shaleMat(i) : kind === 'boulder' ? boulderMat(i) : jitter(i) < 0.6 ? 'hornDark' : 'stoneDark');

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** The bite, as shares of the strike: the jaw open as it draws back, the lunge, the jaw snapped shut on the blow. */
export const CRAG_STRIKE = { open: 0.1, lunge: 0.34, snap: 0.5 } as const;
/** The stun slam, as shares of the cast: rearing, at the top, and down on the ground. */
export const CRAG_CAST = { rear: 0.06, top: 0.34, slam: 0.5 } as const;
/** At its post, as shares of a go of it: the tongue flicked, and a hiss with the jaw parted. */
export const CRAG_WORK = { flick: 0.22, hiss: 0.68 } as const;
/** Standing about, when in its loop (seconds) its tongue flicks and, on the Cragjaws, when it roars. */
export const CRAG_FLICKS: readonly number[] = [3.3, 15.1];
export const CRAG_ROAR = 9.0;

/* ---- where its feet go ---------------------------------------------------------------- */

/** A pose: where each ankle is (along the ground, from under the body's middle) and how its foot is pitched; and how the rest is carried. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The neck bent forward and turned left; the head pitched nose-up, turned left and tilted. */
  neck: [number, number]; head: [number, number, number];
  /** The tail lifted, swung to the left, and curled up past how it is carried. */
  tail: [number, number, number];
  /** The jaw open, in degrees; the tongue out, nought to one. */
  jaw: number; tongue: number;
}

interface Rest {
  /** Each hip and shoulder, in the body's frame; each ankle standing, along the ground. */
  hip: V3[]; ankle: V3[];
  reach: number[];
}

const rests = new Map<Crag, Rest>();
function restOf(s: Crag): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], ankle: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    hip.push([SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop]);
    // Each foot well out to the side of its hip, a lizard's sprawl, ahead of a shoulder and behind a hip.
    const dy = (fore ? 1 : -1) * s.reachOut[fore ? 0 : 1] * (B.y[B.y.length - 1] - B.y[0]);
    ankle.push([SIDE[i] * r.w * s.spread, y + dy, L[2]]);
    reach.push(L[0] + L[1]);
  }
  const R = { hip, ankle, reach };
  rests.set(s, R);
  return R;
}

function restPlan(s: Crag, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], tail: [0, 0, 0], jaw: s.jaw.rest, tongue: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1]), m(a.tail[2], b.tail[2])], jaw: m(a.jaw, b.jaw), tongue: m(a.tongue, b.tongue),
  };
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
    jaw: d(p.jaw, to.jaw, from.jaw), tongue: Math.max(p.tongue, to.tongue),
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
 * body at the ground's own speed, so it never skates, then brought round and forward through the air; the body swaying from side
 * to side over its feet as its spine waves, the shoulder of the foot reaching forward carried forward with it, the tail swung
 * against it and the head held steady; sinking a little onto each pair of feet as they come down.
 */
function goingPlan(s: Crag, R: Rest, a: Anim): Plan {
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
    const outward = 0.08 * L * Math.sin(Math.PI * u);
    p.at[i] = [A[0] + SIDE[i] * outward, y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    p.foot[i] = (i < 2 ? -14 : -22) * Math.sin(Math.PI * u) ** 2;
  }
  // Lowest as each pair comes down, twice a stride; at a run carried higher off the ground, and bouncing.
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - duty * 0.15));
  p.H += s.len * (-G.bob * (1 - 0.4 * g) * down + g * (0.03 + 0.02 * Math.max(0, Math.sin(2 * TAU * (w - 0.1)))));
  const wave = waveOf(s, a);
  p.neck[1] = -wave * 0.7;
  p.head[1] = -wave * 0.3;
  p.roll = G.roll * Math.sin(TAU * w);
  p.tail = [g * 18, -wave * 1.3, g * -4];
  p.neck[0] = 8 * g;
  // The head bobbed against the shoulders as they sink onto the feet and rise; the little one's most, so it reads at its size.
  p.head[0] = [6, 4, 3][s.stage] * (2 * down - 1) - 4 * g;
  p.pitch = g * (2 + 2 * Math.sin(2 * TAU * w));
  return p;
}

/**
 * How far its spine is bent from side to side this moment, in degrees at either end of it: as it goes, a wave once a stride,
 * concave on the side whose fore foot is back; nought standing and at its acts.
 */
function waveOf(s: Crag, a: Anim): number {
  if (a.act || a.go <= 0) return 0;
  return -smooth(Math.min(1, a.go)) * lerp(s.gait.wave[0], s.gait.wave[1], a.gait) * Math.cos(TAU * frac(a.u));
}
/** How far the spine is turned at `y` along it, bent `deg` at either end: by as much of it as how far from the middle it is. */
const bendAt = (s: Crag, y: number, deg: number): number => deg * clamp(y / s.body.y[s.body.y.length - 1], -1, 1);
/** A point in the trunk's frame where the spine's bend puts it: turned about the middle by the bend where it is. */
function bendPt(s: Crag, p: V3, deg: number): V3 {
  if (!deg) return p;
  const a = bendAt(s, p[1], deg) * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]];
}

/** How far its tongue is out, standing about: flicked out twice in quick succession at each of `CRAG_FLICKS`, on the two smaller ones. */
function flickOf(s: Crag, t: number): number {
  if (s.stage === 2) return 0;
  let k = 0;
  for (const at of CRAG_FLICKS) k = Math.max(k, hump(t, at + 0.12, 0.12), hump(t, at + 0.42, 0.12));
  return k;
}

/**
 * Standing about: breathing, looking about with a tilt of its head now and then, its tail swaying; its tongue flicked out to taste
 * the air on the smaller ones, its jaw clacked; and the Cragjaws throwing its head up in a roar once in its loop.
 */
function stillPlan(s: Crag, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [-1 + 2 * a.breath, 10 * look];
  p.head = [2 * cyc(t, 5), 9 * look, 4 * drift(t, 2)];
  p.tail = [2 * cyc(t, 3, 1), 9 * cyc(t, 4), 3 * cyc(t, 6)];
  p.H += 0.012 * s.len * (a.breath - 0.5);
  // A tilt of the head, curious, held a moment: one way and later the other.
  const tilt = beat(t, [1.4], 1.8) - beat(t, [12.2], 1.6);
  p.head[2] += [20, 14, 9][s.stage] * tilt;
  p.head[0] += 4 * Math.abs(tilt);
  // Tasting the air: the tongue flicked out, the head lifted a little to it.
  const fl = flickOf(s, t);
  p.tongue = fl;
  p.head[0] += 4 * Math.max(beat(t, [CRAG_FLICKS[0]], 0.7), beat(t, [CRAG_FLICKS[1]], 0.7));
  // A clack of the jaw: opened a little and snapped shut.
  const clack = beat(t, [6.4, 20.1], 0.36);
  p.jaw += s.jaw.most * 0.32 * clack;
  // The Cragjaws' roar: its head thrown up and its jaw wide, held, a shake of the head, and down.
  if (s.stage === 2) {
    const roar = beat(t, [CRAG_ROAR], 2.2), held = clamp(roar * 1.6);
    p.neck[0] -= 12 * held;
    p.head[0] += 16 * held;
    p.head[2] += 4 * Math.sin((t - CRAG_ROAR) * 26) * held;
    p.jaw += (s.jaw.most - s.jaw.rest) * held;
    p.pitch += 4 * held;
    p.H += 0.02 * s.len * held;
  }
  // The pup's tail now and then curled tighter and let go.
  if (s.stage === 0) p.tail[2] += 10 * beat(t, [8.2, 18.8], 1.6);
  return p;
}

/** Grazing: its head down at the ground, its jaw working at what it finds there. */
function grazePlan(s: Crag, R: Rest, a: Anim, k: number): Plan {
  const p = restPlan(s, R), t = a.t;
  const chew = 0.5 + 0.5 * cyc(t, 72);
  p.neck = [34, 6 * drift(t)];
  p.head = [-26 + 4 * chew, 5 * drift(t, 1), 3 * drift(t, 2)];
  p.pitch = -5;
  p.H -= 0.03 * s.len;
  p.jaw = s.jaw.rest + s.jaw.most * 0.25 * chew;
  p.tail = [0, 8 * cyc(t, 4), 0];
  return mixPlan(stillPlan(s, R, a), p, k);
}

/* ---- its strike ------------------------------------------------------------------------------- */

/**
 * The bite: drawn back onto its haunches with its jaw opening wide and its tail up, then a lunge forward onto its fore feet, its
 * neck stretched out, and its jaw snapped shut on the blow; a shake of the head with its grip, and back.
 */
function bitePlan(s: Crag, R: Rest, t: number): Plan {
  const p = restPlan(s, R), S = CRAG_STRIKE, hit = S.snap;
  const back = ramp(t, 0.02, S.lunge - 0.04) * (1 - ramp(t, S.lunge, hit - 0.04));
  const out = ramp(t, S.lunge - 0.04, hit - 0.02) * (1 - ramp(t, hit + 0.14, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06), shake = hump(t, hit + 0.1, 0.1) * Math.sin((t - hit) * 70);
  p.surge = s.len * (-0.1 * back + 0.2 * out);
  p.H += s.len * (0.03 * back - 0.03 * out);
  p.pitch = 9 * back - 7 * out;
  p.neck = [-14 * back + 16 * out, 0];
  p.head = [14 * back - 10 * out + 5 * jolt, 9 * shake, 7 * shake];
  p.squash = 0.05 * back + 0.07 * jolt;
  // Wide as it draws back and lunges, shut hard on the blow.
  const open = ramp(t, S.open - 0.08, S.open + 0.16) * (1 - ramp(t, hit - 0.05, hit));
  p.jaw = s.jaw.rest * (1 - open) * (1 - hump(t, hit + 0.05, 0.1)) + s.jaw.most * open;
  // The fore feet hop forward under the lunge and come back.
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0], A[1] + s.len * 0.17, A[2]];
    const k = ramp(t, S.lunge, hit - 0.02) * (1 - ramp(t, 0.7 + 0.06 * i, 0.94 + 0.04 * i));
    p.at[i] = t < 0.6 ? arc(A, fwd, ramp(t, S.lunge, hit - 0.02), R.reach[i] * 0.28) : arc(fwd, A, 1 - k, R.reach[i] * 0.22);
  }
  p.tail = [16 * back + 6 * jolt, 10 * shake, 8 * back - 4 * out];
  return p;
}

/* ---- its stun ------------------------------------------------------------------------------- */

/**
 * The stun slam: reared up on its hind legs with its fore feet off the ground, its tail swung up high and its jaw open; brought
 * down, fore feet and tail together, hard on the ground; and shaking on through it as the ground rings, then settled.
 */
function slamPlan(s: Crag, R: Rest, t: number): Plan {
  const p = restPlan(s, R), C = CRAG_CAST, hit = C.slam;
  const rear = t < C.top ? smooth((t - C.rear) / (C.top - C.rear)) : t < hit ? 1 - ((t - C.top) / (hit - C.top)) ** 2 : 0;
  const land = hump(t, hit + 0.03, 0.08), since = (t - hit) * ACT_SECS.cast, quake = ringOut(since, 1, 9, 6);
  const settle = 1 - ramp(t, 0.72, 1);
  p.pitch = [28, 28, 26][s.stage] * rear - 4 * land * settle;
  p.H += s.len * ([0.1, 0.12, 0.13][s.stage] * rear - 0.05 * land) + 0.025 * s.len * quake;
  p.surge = -s.len * 0.1 * rear + s.len * 0.04 * land;
  p.neck = [-16 * rear + 12 * land, 0];
  p.head = [12 * rear - 12 * land, 0, 6 * quake];
  p.squash = 0.1 * land;
  p.roll = 3 * quake;
  p.jaw = lerp(s.jaw.rest, s.jaw.most * 0.85, ramp(t, 0.1, C.top) * (1 - ramp(t, hit - 0.06, hit))) + s.jaw.most * 0.2 * hump(t, hit + 0.12, 0.12);
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0] * 1.05, A[1] + R.reach[i] * 0.1, A[2] + R.reach[i] * 0.95];
    if (t < C.top) p.at[i] = mixV(A, high, smooth(clamp((t - C.rear) / (C.top - C.rear))));
    else if (t < hit) p.at[i] = mixV(high, A, ((t - C.top) / (hit - C.top)) ** 2);
    p.foot[i] = 18 * rear;
  }
  // The tail swung up high as it rears and slammed down with the feet, lying hard on the ground a moment.
  const up = ramp(t, C.rear, C.top) * (1 - ramp(t, C.top + 0.04, hit));
  const flat = hump(t, hit + 0.06, 0.14) * settle;
  p.tail = [[60, 40, 34][s.stage] * up - [12, 14, 14][s.stage] * flat, 0, [10, 8, 6][s.stage] * up - (s.stage ? 6 : 26) * flat];
  return p;
}

/* ---- at its post ---------------------------------------------------------------------------- */

/**
 * At its post, over and over: crouched a little lower and alert, its head up and sweeping slowly from one side to the other as it
 * watches, its tail lashing; on the two smaller ones a flick of its tongue, and on each a low hiss with its jaw parted. A go ends
 * where it began, so the loop has no seam.
 */
function guardPlan(s: Crag, R: Rest, a: Anim, t: number): Plan {
  const p = restPlan(s, R), W = CRAG_WORK;
  const sweep = Math.sin(TAU * t), lash = Math.sin(TAU * 2 * t + 0.6);
  p.H -= s.len * 0.04;
  p.pitch = 4 + 1.5 * Math.sin(TAU * t + 1);
  p.neck = [-14, 20 * sweep];
  p.head = [12, 12 * sweep, -5 * sweep];
  p.roll = -2 * sweep;
  p.tail = [10 + 4 * Math.sin(TAU * t), 22 * lash, 4];
  for (const i of [0, 1]) p.at[i] = [R.ankle[i][0] * 1.08, R.ankle[i][1] + s.len * 0.03, R.ankle[i][2]];
  if (s.stage < 2) p.tongue = Math.max(hump(t, W.flick, 0.06), hump(t, W.flick + 0.14, 0.06));
  const hiss = hump(t, W.hiss, 0.1);
  p.jaw += s.jaw.most * 0.3 * hiss;
  p.head[0] += 6 * hiss;
  void a;
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its head high, a shake, and settled. */
function evolvePlan(s: Crag, R: Rest, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.64, 0.1) * Math.sin(t * (s.stage === 2 ? 44 : 62));
  p.H += s.len * (-0.03 * hunch + 0.015 * up);
  p.pitch = -3 * hunch + 4 * up;
  p.neck = [12 * hunch - 14 * up, 0];
  p.head = [-10 * hunch + 18 * up, 0, 9 * shake];
  p.roll = 3 * shake;
  p.tail = [-6 * hunch + 16 * up, 10 * shake, 8 * up];
  p.jaw = s.jaw.rest + s.jaw.most * 0.6 * up;
  p.squash = 0.06 * hump(t, 0.7, 0.05);
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Crag, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(bitePlan(s, R, act.t));
  if (act?.kind === 'cast') return over(slamPlan(s, R, act.t));
  if (act?.kind === 'work') return guardPlan(s, R, a, act.t);
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return grazePlan(s, R, a, a.graze);
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** The middle of the skull, in the head's frame. */
const skullAt = (s: Crag): V3 => [0, 0, s.head.up];
/** The middle of the snout, out of the lower front of the skull, and its half-sizes. */
const snoutAt = (s: Crag): V3 => { const H = s.head, sn = H.snout; return [0, H.r[1] * 0.5 + sn[2] * 0.45, H.up - H.r[2] * 0.22]; };
const snoutR = (s: Crag): V3 => [s.head.snout[0], s.head.snout[2], s.head.snout[1]];
/** Where the jaw hinges, under the back of the skull, and where its chin is with the jaw shut; in the head's frame. */
const hingeAt = (s: Crag): V3 => { const H = s.head; return [0, -H.r[1] * 0.25, H.up - H.r[2] * 0.48]; };
const chinAt = (s: Crag): V3 => { const c = snoutAt(s), r = snoutR(s); return [0, c[1] + r[1] * 0.78, c[2] - r[2] * 0.72]; };

/**
 * A leg bent to put its ankle at `ankle`: the upper from the hip out to the knee and the lower down from it, the knee out and up
 * from the body and a little back on a fore leg (an elbow) and forward on a hind one, always the same way round. A point out of
 * reach is reached for as far as the leg goes.
 */
function legOf(s: Crag, body: Xf, i: number, hipLocal: V3, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const fore = i < 2, L = fore ? s.fore : s.hind, l0 = L[0], l1 = L[1];
  const hip = place(body, hipLocal), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = Math.hypot(d[0], d[1], d[2]);
  const most = (l0 + l1) * 0.985, least = Math.abs(l0 - l1) + 0.08 * (l0 + l1);
  const Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit([SIDE[i], fore ? -0.9 : 0.25, s.knee]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const frame = (from: V3, to: V3): [V3, V3, V3] => frameOf(sub(from, to), fwd);
  const [X0, Y0, Z0] = frame(hip, knee), [X1, Y1, Z1] = frame(knee, at);
  // The foot flat on the ground facing the way the body does, turned a little out, pitched as the pose says.
  const head = unit([fwd[0] + SIDE[i] * 0.4 * fwd[1], fwd[1] - SIDE[i] * 0.4 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The tail's bones from its root on the body, each link on from the one before it, curled up and swung. */
function tailBones(s: Crag, body: Xf, lift: number, yaw: number, curl: number, wave = 0, lag = 0): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  let prev = joint(body, bendPt(s, T.at, wave), -(T.lift + lift), 0, yaw * 0.4 + bendAt(s, T.at[1], wave));
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.curl + curl + (q >= n - 3 ? T.tip : 0)), 0, (yaw * 0.6) / (n - 1) + (q >= n - 3 ? lag / 3 : 0));
    out.push(prev);
  }
  return out;
}

/** Where the tongue comes out from, in the jaw's frame, and how long it is out. */
const tongueRoot = (s: Crag): V3 => { const c = sub(chinAt(s), hingeAt(s)); return [0, c[1] * 0.8, c[2] * 0.8 + s.head.snout[1] * 0.3]; };
const tongueLen = (s: Crag): number => [0.5, 0.8, 0.9][s.stage];

/**
 * The bones of a stage: its pose, the body raised and carried as the pose says, every leg bent to put its foot where the pose
 * says (`legOf`), the neck and head carried on the body with the jaw hinged under the head and the tongue on the jaw, and the
 * tail in links.
 */
function cragBones(s: Crag): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, wave = 0, lag = 0): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.neck.lean + P.neck[0];
    b.neck = joint(body, bendPt(s, s.neck.at, wave), -lean, 0, P.neck[1] + bendAt(s, s.neck.at[1], wave));
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + s.head.pitch + P.head[0], P.head[2], P.head[1]);
    b.jaw = joint(b.head, hingeAt(s), -P.jaw);
    // The tongue drawn out of the mouth by as much as it is out, never quite nothing so its bone stays a frame.
    b.tongue = scaled(joint(b.jaw, tongueRoot(s), 8 - 0.3 * P.jaw), [1, Math.max(0.02, P.tongue), 1]);
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
  return (a) => {
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go }), wave = waveOf(s, a);
    // The tip of the tail a beat behind the spine's wave, swinging on its own as it goes.
    const lag = a.act || a.go <= 0 ? 0 : -9 * smooth(Math.min(1, a.go)) * Math.cos(TAU * (frac(a.u) - 0.18));
    return pose(P, wave, lag);
  };
}

/* ---- its body ---------------------------------------------------------------------------------- */

/**
 * The barrel: sand on top, the cream of its belly under it, a cream swell at the chest under the throat, and the sand flecked with
 * a few small darker pebbles low on its flanks, where the stones on its back give out.
 */
function barrelOf(s: Crag, n: number): Mesh {
  const B = s.body;
  const body = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, (ring, j) => (ring > 0 && ring < B.y.length - 1 && under(n, j, 1.05) ? 'belly' : 'coat'));
  const cy = lerp(B.y[5], B.y[6], 0.7), cr = ringAt(B, B.y[5]);
  const chest = orb([0, cy, cr.z - cr.h * 0.4], [cr.w * 0.92, (B.y[6] - B.y[5]) * 1.3, cr.h * 0.72], n, 5, 'belly');
  const flecks: Disc[] = [];
  const count = [10, 14, 16][s.stage];
  for (let q = 0; q < count; q++) {
    const y = lerp(B.y[1], B.y[5], jitter(q * 2 + 1)), th = -0.15 + 0.4 * jitter(q * 2 + 2);
    const e0 = onRings(B, y, th), e = q % 2 ? left(e0) : e0, r = B.w[3] * (0.07 + 0.05 * jitter(q + 7));
    flecks.push(disc(add(e.p, scale(e.n, 0.012)), e.n, r, r * 0.8, 6, jitter(q + 3) < 0.6 ? 'stoneDark' : 'stone', { spin: jitter(q) * 3, up: [0, 1, 0] }));
  }
  return merge(body, chest, paint(flecks));
}

/** The stone on its back: each row down both sides (`Crag.rows`), a stone lying on the barrel or one standing out of it. */
function backOf(s: Crag): Mesh {
  const out: Mesh[] = [];
  s.rows.forEach((row, ri) => {
    const ridge = Math.abs(row.th - QUARTER) < 0.01;
    for (const sd of ridge ? [1] : [1, -1]) {
      for (let q = 0; q < row.count; q++) {
        const id = ri * 31 + q * 3 + (sd > 0 ? 0 : 17) + s.stage * 401;
        const f = row.count > 1 ? q / (row.count - 1) : 0.5;
        const y = lerp(row.y0, row.y1, f) + (ridge ? 0 : 0.1 * (row.r[1] / 0.2) * (jitter(id + 1) - 0.5)) + (sd > 0 ? 0 : row.r[1] * 0.3);
        const th0 = row.th + (ridge ? 0 : 0.08 * (jitter(id + 2) - 0.5)), at0 = onRings(s.body, y, th0), at = sd > 0 ? at0 : left(at0);
        // Bigger toward the middle of the back, smaller at its ends.
        const big = (row.kind === 'shale' ? 0.8 + 0.26 * Math.sin(Math.PI * (0.25 + 0.75 * f)) : 0.78 + 0.34 * Math.sin(Math.PI * f)) * (0.88 + 0.24 * jitter(id + 4));
        const r = scale(row.r, big), mat = plateMat(row.kind, id);
        if (row.kind === 'shale') {
          // A shard: thin across, broad along, standing out of the back swept back and splayed out, a smaller one beside it.
          const up = unit(add(at.n, [sd * (ridge ? 0 : 0.3), -0.4, 0.15]));
          out.push(shard(sub(at.p, scale(at.n, r[2] * 0.2)), r, { up, fwd: [0, 1, 0], seed: id, mat }));
          const up2 = unit(add(up, [sd * 0.3, 0.2, 0]));
          if (ridge) out.push(shard(add(sub(at.p, scale(at.n, r[2] * 0.15)), [sd * r[0] * 1.5, r[1] * 0.55, 0]), scale(r, 0.62), { up: up2, fwd: [0, 1, 0], seed: id + 5, mat: shaleMat(id + 9) }));
        } else if (row.kind === 'spike') {
          // A spike of rock, swept back.
          const up = unit(add(at.n, [0, -0.5, 0.1]));
          out.push(rock(sub(at.p, scale(at.n, r[2] * 0.2)), r, { up, fwd: [0, 1, 0], n: 5, point: true, seed: id, mat, rough: 0.14 }));
        } else {
          // A stone lying on the barrel like a tile, its back edge a little up.
          const up = unit(add(at.n, [0, 0.2, 0]));
          out.push(rock(add(at.p, scale(at.n, r[2] * 0.35)), r, { up, fwd: [0, 1, 0], n: row.kind === 'pebble' ? 5 : 6, seed: id, mat, bevel: row.kind === 'pebble' ? 0.5 : 0.42, rough: row.kind === 'pebble' ? 0.1 : 0.18, dome: true }));
        }
      }
    }
  });
  return merge(...out);
}

/**
 * The head: a skull, round and a size too big on the pup and longer and heavier after; a snout out of the front of it, sand over
 * and cream under; stones on its crown, and on the older ones a brow of stone over each eye and shards or spikes standing back
 * off the back of the skull; the upper teeth; the nostrils; and the eyes.
 */
function headOf(s: Crag, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), sc = snoutAt(s), sr = snoutR(s);
  // Cream under a line low on the skull, from the back of the jaw forward under the eye.
  const creamed = (m: Mesh, below: (p: V3) => boolean): Mesh => mesh(m.v, m.f.map((f) => {
    const top = f.i.reduce((t, i) => (m.v[i][2] > t[2] ? m.v[i] : t), m.v[f.i[0]]);
    return below(top) ? { ...f, m: 'belly' as Mat } : f;
  }));
  const skull = creamed(orb(C, H.r, n + 3, k + 2, 'coat'), (p) => p[2] < C[2] - H.r[2] * 0.42);
  const snout = creamed(orb(sc, sr, n + 1, k + 1, 'coat'), (p) => p[2] < sc[2] - sr[2] * 0.38);
  const out: Mesh[] = [skull, snout];
  // Stones on the crown and down the back of the head.
  const crown = [[0.1, 0.62, 0.18], [-0.32, 0.86, 0.14], [0.35, 0.82, 0.13]];
  if (s.stage < 2) crown.forEach(([y, z, rr], q) => {
    for (const sd of q ? [1, -1] : [1]) {
      const e = onEgg(C, H.r, [sd * (q ? 0.32 : 0), y, z]), id = 900 + q * 2 + (sd > 0 ? 0 : 1) + s.stage * 50;
      out.push(rock(add(e.p, scale(e.n, H.r[0] * rr * 0.25)), [H.r[0] * rr, H.r[0] * rr, H.r[0] * rr * 0.4], { up: e.n, fwd: [0, 1, 0], n: 5, seed: id, mat: s.stage ? shaleMat(id) : pebbleMat(id), bevel: 0.5, rough: 0.1, dome: true }));
    }
  });
  // A pebble or two on the snout of the pup.
  if (s.stage === 0) {
    const e = onEgg(sc, sr, [0.25, 0.3, 1]);
    out.push(rock(add(e.p, scale(e.n, 0.02)), [0.05, 0.05, 0.02], { up: e.n, fwd: [0, 1, 0], n: 6, seed: 980, mat: 'stoneDark', bevel: 0.5, rough: 0.1 }));
  }
  // A brow of stone over each eye, heavier on the Cragjaws.
  if (s.eye.brow) for (const sd of [1, -1]) {
    const e = onEgg(C, H.r, [sd * s.eye.dir[0] * 0.92, s.eye.dir[1] * 0.92, s.eye.dir[2] + 0.42]), id = 950 + (sd > 0 ? 0 : 1) + s.stage * 7;
    const up = unit(add(e.n, [0, 0.3, 0.3]));
    out.push(rock(add(e.p, scale(e.n, s.eye.size * 0.15)), [s.eye.size * 1.25 * s.eye.brow, s.eye.size * 0.75 * s.eye.brow, s.eye.size * 0.38 * s.eye.brow], { up, fwd: unit([sd * 0.4, 1, 0]), n: 5, seed: id, mat: s.stage === 1 ? 'shellDark' : 'stoneDark', bevel: 0.35, rough: 0.16 }));
  }
  // Off the back of the skull: shards of shale fanned back on the Shaleclaw; a crown of rock spikes swept back on the Cragjaws.
  if (s.stage === 1) {
    [[0, 0.95, 0.24, 0.3], [0.45, 0.8, 0.18, 0.22], [-0.45, 0.8, 0.18, 0.22], [0.8, 0.45, 0.14, 0.16], [-0.8, 0.45, 0.14, 0.16]].forEach(([x, z, h, l], q) => {
      const e = onEgg(C, H.r, [x, -0.7, z]), up = unit(add(e.n, [x * 0.3, -0.9, 0.2])), id = 960 + q;
      out.push(rock(sub(e.p, scale(e.n, 0.02)), [0.035, l * 0.55, h], { up, fwd: [0, 1, 0], n: 4, point: true, seed: id, mat: shaleMat(id), rough: 0.16 }));
    });
  }
  if (s.stage === 2) {
    [[0, 0.95, 0.32], [0.42, 0.85, 0.3], [-0.42, 0.85, 0.3], [0.78, 0.5, 0.26], [-0.78, 0.5, 0.26], [0.95, 0.05, 0.2], [-0.95, 0.05, 0.2]].forEach(([x, z, h], q) => {
      const e = onEgg(C, H.r, [x, -0.75, z]), up = unit(add(e.n, [x * 0.5, -1.1, 0.25])), id = 970 + q;
      out.push(rock(sub(e.p, scale(e.n, 0.04)), [h * 0.42, h * 0.45, h], { up, fwd: [0, 1, 0], n: 5, point: true, seed: id, mat: q ? 'hornDark' : 'stoneDark', rough: 0.14 }));
    });
    // Boulders on the crown and the top of the snout.
    [[0, 0.4, 1, 0.3], [0.5, 0.1, 0.9, 0.24], [-0.5, 0.1, 0.9, 0.24]].forEach(([x, y, z, rr], q) => {
      const e = onEgg(C, H.r, [x, y, z]), id = 990 + q;
      out.push(rock(add(e.p, scale(e.n, 0.04)), [rr, rr * 1.1, rr * 0.4], { up: e.n, fwd: [0, 1, 0], n: 6, seed: id, mat: boulderMat(id), bevel: 0.35, rough: 0.2, dome: true }));
    });
    const e = onEgg(sc, sr, [0, 0.1, 1]);
    out.push(rock(add(e.p, scale(e.n, 0.04)), [sr[0] * 0.5, sr[1] * 0.45, 0.12], { up: e.n, fwd: [0, 1, 0], n: 6, seed: 995, mat: 'stoneDark', bevel: 0.35, rough: 0.2 }));
  }
  // The upper teeth along the lower edge of the snout, the front pair the longest: two small white nubs on the pup.
  const T = s.teeth;
  const teeth = (sd: number, f: number, len: number): Mesh => {
    const e = onEgg(sc, sr, [sd * Math.sqrt(1 - f * f) * 0.96, f, -0.42]);
    const root = add(e.p, [0, 0, sr[2] * 0.12]);
    return taper([root, add(root, [-sd * len * 0.05, len * 0.08, -len * 0.6]), add(root, [-sd * len * 0.08, len * 0.18, -len])], len * 0.32, len * 0.03, 4, 'tooth');
  };
  for (const sd of [1, -1]) {
    out.push(teeth(sd, 0.86, T.fang));
    for (let q = 0; q < T.count; q++) out.push(teeth(sd, lerp(0.62, -0.1, q / Math.max(1, T.count - 1)), T.fang * (q === T.count - 1 ? 0.4 : 0.55)));
  }
  const nostrils = paint([1, -1].map((sd) => disc(add(onEgg(sc, sr, [sd * 0.34, 0.86, 0.42]).p, [0, 0.01, 0]), [sd * 0.25, 1, 0.5], sr[0] * 0.08, sr[0] * 0.05, 5, 'lid')));
  // The line of its mouth along each side of the snout, from the tip back under the eye, turned up at its end in a smile on the pup.
  const mouth = paint([1, -1].map((sd) => {
    const top: V3[] = [], low: V3[] = [];
    let n: V3 = [0, 0, 0];
    for (let q = 0; q <= 6; q++) {
      const a = lerp(0.12, 1.5, q / 6), lift = s.stage === 0 ? 0.3 * (q / 6) ** 3 : 0.05 * (q / 6);
      const e = onEgg(sc, sr, [sd * Math.sin(a), Math.cos(a), -0.42 + lift]), w = sr[2] * [0.07, 0.05, 0.05][s.stage];
      top.push(add(add(e.p, scale(e.n, 0.012)), [0, 0, w]));
      low.push(add(add(e.p, scale(e.n, 0.012)), [0, 0, -w]));
      n = add(n, e.n);
    }
    const v = [...top, ...low.reverse()];
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < v.length; c++) {
      const P = v[c], Q = v[(c + 1) % v.length];
      nx += (P[1] - Q[1]) * (P[2] + Q[2]);
      ny += (P[2] - Q[2]) * (P[0] + Q[0]);
      nz += (P[0] - Q[0]) * (P[1] + Q[1]);
    }
    return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m: 'lid' as Mat };
  }));
  // The pup's rosy cheeks.
  const cheeks = s.stage === 0 && paint([1, -1].map((sd) => {
    const e = onEgg(C, H.r, [sd * 0.82, 0.48, -0.2]);
    return disc(add(e.p, scale(e.n, 0.02)), e.n, H.r[0] * 0.14, H.r[0] * 0.09, 8, 'inner');
  }));
  return merge(...out, mouth, nostrils, cheeks, eyesOf(s, shut));
}

/**
 * The eyes: each a dark rim, a big orange iris, a darker ring and a dark round middle, two glints; laid onto the skull's own curve
 * so it bends round the head. The older ones have a lid of skin over the top of each, so they look out from under their brows.
 */
function eyesOf(s: Crag, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size, tall = E.tall;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.28, 8, 'lid', o), 0.014));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.22, r * 1.22 * tall, 12, 'lid', o), 0.012));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystal', o), 0.016));
    out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 0.7, r * 0.7 * tall, 10, 'crystalDark', o), 0.02));
    // A round dark middle, big on the pup so its eye is a bright ring round a dark at the size the island is played at.
    const pu = [0.5, 0.42, 0.4][s.stage];
    out.push(onto(disc(add(p, scale(up, -r * 0.06)), n, r * pu, r * pu * 1.1 * tall, 8, 'eye', o), 0.024));
    if (s.stage) out.push(onto(disc(add(p, scale(up, r * tall * 0.92)), n, r * 1.25, r * 0.36, 8, 'coat', o), 0.028));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36 * tall)), scale(across, side * r * 0.3)), n, r * 0.28, r * 0.28, 6, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.38 * tall)), scale(across, -side * r * 0.3)), n, r * 0.13, r * 0.13, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

/** Solids inside the head that hide what is round the far side of them: the skull and the snout. */
function headSolids(s: Crag): Array<{ c: V3; r: V3 }> {
  return [{ c: skullAt(s), r: scale(s.head.r, 0.9) }, { c: snoutAt(s), r: scale(snoutR(s), 0.85) }];
}

/**
 * The lower jaw, in its own frame from the hinge: a scoop from under the back of the skull to the chin, cream under and the pink
 * of its mouth on top, and the lower teeth standing up along its rim.
 */
function jawOf(s: Crag, n: number): Mesh {
  const H = s.head, hg = hingeAt(s), ch = sub(chinAt(s), hg), sn = H.snout;
  const pts: V3[] = [0, 0.35, 0.72, 1].map((u) => [0, ch[1] * u, ch[2] * u - sn[1] * 0.12 * Math.sin(Math.PI * u)]);
  const w = [H.r[0] * 0.66, lerp(H.r[0] * 0.66, sn[0] * 0.86, 0.5), sn[0] * 0.8, sn[0] * 0.42];
  const h = [H.r[2] * 0.3, sn[1] * 0.5, sn[1] * 0.42, sn[1] * 0.26];
  const top = (j: number): boolean => Math.abs(((j + 1) / n) * TAU - QUARTER) < 1.0;
  const jaw = tube(pts, w, h, n, (ring, j) => (ring < pts.length - 1 && top(j) ? 'inner' : 'belly'));
  const out: Mesh[] = [jaw];
  const T = s.teeth;
  for (const sd of [1, -1]) {
    for (let q = 0; q < T.count; q++) {
      const u = lerp(0.92, 0.45, q / Math.max(1, T.count - 1)), k = Math.min(2, Math.floor(u * 3));
      const ww = lerp(w[k], w[Math.min(3, k + 1)], u * 3 - k) * 0.82, hh = lerp(h[k], h[Math.min(3, k + 1)], u * 3 - k);
      const root: V3 = [sd * ww, ch[1] * u, ch[2] * u + hh * 0.55], len = T.fang * (q === 0 ? 0.75 : 0.45);
      out.push(taper([root, add(root, [-sd * len * 0.06, -len * 0.06, len * 0.6]), add(root, [-sd * len * 0.1, -len * 0.12, len])], len * 0.32, len * 0.03, 4, 'tooth'));
    }
  }
  // Spikes of rock off the back of the jaw on the Cragjaws, a frill under its cheeks.
  if (s.stage === 2) for (const sd of [1, -1]) {
    [[0.08, 0.9], [0.3, 0.75]].forEach(([u, k], q) => {
      const p: V3 = [sd * w[0] * 0.95, ch[1] * u, ch[2] * u], id = 1010 + q * 2 + (sd > 0 ? 0 : 1);
      out.push(rock(p, [0.1 * k, 0.12 * k, 0.24 * k], { up: unit([sd * 1, -0.8, -0.3]), fwd: [0, 1, 0], n: 4, point: true, seed: id, mat: 'stoneDark', rough: 0.12 }));
    });
  }
  return merge(...out);
}

/** The tongue, in its own frame: a forked pink tongue out along its `y`, its length at its full stretch. */
function tongueOf(s: Crag): Mesh {
  const L = tongueLen(s), w = [0.035, 0.05, 0.08][s.stage];
  return merge(
    tube([[0, -0.04, 0], [0, L * 0.5, -0.01], [0, L * 0.78, 0]], [w, w * 0.9, w * 0.7], [w * 0.4, w * 0.36, w * 0.3], 5, 'tongue'),
    ...[1, -1].map((sd) => taper([[0, L * 0.76, 0], [sd * w * 0.9, L, 0.005]], w * 0.45, w * 0.12, 4, 'tongue', 0.5)),
  );
}

/** The neck: sand, cream under it; stones down the back of it, or the shards and spikes of the back carried on up it. */
function neckOf(s: Crag, n: number): Mesh {
  const N = s.neck;
  const m = tube([[0, 0, -0.3], [0, 0, N.len * 0.5], [0, 0.04, N.len + 0.05]], N.w, N.w * 0.92, n, (_ring, j) => (Math.abs(((j + 1) / n) * TAU - Math.PI * 1.5) < 1.5 ? 'belly' : 'coat'), { seam: 'both' });
  const out: Mesh[] = [m];
  const count = s.stage === 2 ? 3 : 2;
  for (let q = 0; q < count; q++) {
    const z = lerp(N.len * 0.85, -0.05, (q + 0.5) / count), id = 1100 + q + s.stage * 10, c: V3 = [0, -N.w * 0.92, z];
    if (s.stage === 0) out.push(rock(c, [0.075, 0.07, 0.035], { up: [0, -1, 0.2], fwd: [0, 0, 1], n: 6, seed: id, mat: pebbleMat(id), bevel: 0.5, rough: 0.1 }));
    else if (s.stage === 1) out.push(rock(c, [0.04, 0.12, 0.2 - 0.03 * q], { up: unit([0, -1, -0.55]), fwd: [0, 0, 1], n: 4, point: true, seed: id, mat: shaleMat(id), rough: 0.18 }));
    else out.push(rock(c, [0.14, 0.15, 0.32 - 0.04 * q], { up: unit([0, -1, -0.4]), fwd: [0, 0, 1], n: 5, point: true, seed: id, mat: 'hornDark', rough: 0.14 }));
  }
  return merge(...out);
}

/** A foot: a broad flat pad of its skin, its toes splayed forward and out, a pale hooked claw on each. */
function footOf(s: Crag, fore: boolean, n: number, k: number): Mesh {
  const L = fore ? s.fore : s.hind, w = s.thick * [0.9, 0.85, 0.95][s.stage], drop = L[2];
  const pad = orbAlong([0, w * 0.3, -drop + w * 0.32], [0, 1, 0], [w * 0.95, w * 0.5, w * 1.05], n - 1, k - 1, 'coat');
  const toes: Mesh[] = [];
  const count = s.stage === 0 ? 3 : 4, len = w * [0.8, 1.15, 1.2][s.stage], thick = w * [0.24, 0.2, 0.24][s.stage];
  for (let q = 0; q < count; q++) {
    const a = ((q - (count - 1) / 2) / Math.max(1, count - 1)) * 1.3;
    const dir = unit([Math.sin(a), Math.cos(a), 0]), root: V3 = [Math.sin(a) * w * 0.6, w * 0.55 + Math.cos(a) * w * 0.4, -drop + w * 0.24];
    // Hooked: out along the ground, then curving down to its point.
    toes.push(taper([root, add(root, add(scale(dir, len * 0.55), [0, 0, len * 0.06])), add(root, add(scale(dir, len), [0, 0, -len * 0.22]))], thick, w * 0.025, 4, 'claw'));
  }
  return merge(pad, ...toes);
}

/**
 * The stones on a leg, in each part's own frame, where `[side, 0, 0]` is the top of a sprawled upper leg and the outside of a
 * lower one: a pebble on the pup's haunch and shoulder; a plate of shale on the Shaleclaw's, and a pebble on its shin; a boulder
 * on each of the Cragjaws', and a plate down the front of its shin.
 */
function legStones(s: Crag, side: number, w: number, L: readonly number[], lowerPart: boolean, fore: boolean): Mesh {
  const out: Mesh[] = [], id = (fore ? 1200 : 1220) + (side > 0 ? 0 : 7) + (lowerPart ? 3 : 0) + s.stage * 40;
  const top: V3 = [side, 0, 0];
  if (!lowerPart) {
    const c = add([0, 0, -L[0] * 0.25], scale(top, w * 1.2));
    const r: V3 = [[0.7, 0.9, 1.05][s.stage] * w, [0.75, 1.1, 1.15][s.stage] * w, [0.32, 0.38, 0.45][s.stage] * w];
    out.push(rock(c, r, { up: top, fwd: [0, 0, 1], n: 6, seed: id, mat: s.stage === 0 ? pebbleMat(id) : s.stage === 1 ? shaleMat(id) : boulderMat(id), bevel: s.stage === 1 ? 0.3 : 0.45, rough: s.stage === 0 ? 0.1 : 0.18, dome: true }));
    return merge(...out);
  }
  if (s.stage === 0) return merge();
  const front = unit([side * 0.6, 0.8, 0]);
  out.push(rock(add([0, 0, -L[1] * 0.35], scale(front, w * 0.85)), [w * 0.62, L[1] * [0, 0.2, 0.3][s.stage], w * 0.24], { up: front, fwd: [0, 0, 1], n: 5, seed: id, mat: s.stage === 1 ? pebbleMat(id) : boulderMat(id), bevel: 0.35, rough: 0.16 }));
  return merge(...out);
}

/** The tail's links: each a tube of its skin, cream under, ringed with stones along its top and sides; shards or spikes on the older ones. */
function tailOf(s: Crag, n: number): Mesh[] {
  const T = s.tail, count = T.links.length;
  return T.links.map((L, q) => {
    const w0 = T.w[q], w1 = T.w[Math.min(q + 1, count - 1)], wm = (w0 + w1) / 2, id = 1300 + q * 5 + s.stage * 60;
    const core = tube([[0, 0.06, 0], [0, -L * 0.5, 0], [0, -L - 0.02, 0]], [w0, wm, w1], [w0 * 0.92, wm * 0.92, w1 * 0.92], n, (_ring, j) => (under(n, j, 1.0) ? (s.stage ? 'belly' : 'coatLight') : 'coat'), { start: false, end: q === count - 1 });
    const out: Mesh[] = [core];
    const pebble = (c: V3, up: V3, r: number, seed: number, mat: Mat): void => { out.push(rock(c, [r, r * 1.1, r * 0.42], { up, fwd: [0, 1, 0], n: 5, seed, mat, bevel: 0.5, rough: 0.12, dome: true })); };
    if (s.stage === 0) {
      pebble([0, -L * 0.5, wm * 0.92], [0, 0, 1], wm * 0.62, id, pebbleMat(id));
      const sd = q % 2 ? 1 : -1;
      pebble([sd * wm * 0.84, -L * 0.5, wm * 0.32], unit([sd, 0, 0.45]), wm * 0.55, id + 1, pebbleMat(id + 1));
    } else if (s.stage === 1) {
      for (const sd of [1, -1]) pebble([sd * wm * 0.78, -L * 0.5, wm * 0.4], unit([sd, 0, 0.6]), wm * 0.5, id + (sd > 0 ? 1 : 2), pebbleMat(id + (sd > 0 ? 1 : 2)));
      if (q < count - 2) out.push(shard([0, -L * 0.45, wm * 0.6], [0.05, L * 0.42, wm * (2.6 - q * 0.26)], { up: unit([0, -0.6, 1]), fwd: [0, 1, 0], seed: id + 3, mat: shaleMat(id + 3) }));
    } else {
      for (const sd of [1, -1]) out.push(rock([sd * wm * 0.62, -L * 0.5, wm * 0.55], [wm * 0.55, L * 0.42, wm * 0.25], { up: unit([sd * 0.7, 0, 1]), fwd: [0, 1, 0], n: 5, seed: id + (sd > 0 ? 1 : 2), mat: boulderMat(id + (sd > 0 ? 1 : 2)), bevel: 0.3, rough: 0.2 }));
      if (q < 3) out.push(rock([0, -L * 0.45, wm * 0.75], [wm * 0.3, wm * 0.34, wm * (0.6 - q * 0.08)], { up: unit([0, -0.6, 1]), fwd: [0, 1, 0], n: 5, point: true, seed: id + 3, mat: 'hornDark', rough: 0.14 }));
    }
    return merge(...out);
  });
}

/** A stage's pieces. */
function cragBuild(s: Crag, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6);
  const pieces: Piece[] = [];
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 2), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  pieces.push({ key: 'back', mesh: backOf(s), bone: 'trunk', bias: 0.08, after: ['body'], sheen: 'spot' });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: ['head', 'jaw'], convex: false });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide, sheen: 'spot' });
  pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.003, after: ['body', 'neck'], under: 'head', front: [0, 1, 0], hide: [hide[0]], hideIn: 'head' });
  pieces.push({ key: 'tongue', mesh: tongueOf(s), bone: 'tongue', bias: 0.19, after: ['jaw'], under: 'head', thin: true, shown: (a) => tongueShown(s, a) });
  tailOf(s, n).forEach((m, q) => pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.05 + q * 0.01, chain: 'tail', sheen: 'spot' }));
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const foot = footOf(s, fore, n, k);
    // A lizard's leg comes out of the side of its body: the shoulder or the haunch a round mass at the root of the upper leg, the
    // upper leg out sideways from it to a round elbow or knee, drawn over the flank on the near side and under it on the far, then
    // the lower leg down to the foot. The inside of the upper leg cream, as the belly it comes out of.
    const side3: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const hw = s.stage === 2 && !fore ? w * 1.25 : w;
    const upperSkin = merge(orb([0, 0, hw * 0.1], [hw * 1.45, hw * 1.45, hw * 1.25], n, k, 'coat'), tube([[0, 0, 0], [0, 0, -L[0]]], [hw * 1.25, w * 1.0], [hw * 1.25, w * 1.0], n, 'coat', { seam: 'start' }),
      orb([0, 0, -L[0]], w * 1.02, n - 1, k - 1, 'coat'));
    const upper = merge(mesh(upperSkin.v, upperSkin.f.map((f) => {
      const c = scale(f.i.reduce((t, ix) => add(t, upperSkin.v[ix]), [0, 0, 0] as V3), 1 / f.i.length);
      return c[0] * side < -w * 0.35 && c[2] < w * 0.2 ? { ...f, m: 'belly' as Mat } : f;
    })), legStones(s, side, hw, L, false, fore));
    const lower = merge(tube([[0, 0, w * 0.7], [0, 0.02, -L[1]]], [w * 1.0, w * 0.84], [w * 1.0, w * 0.84], n, 'coat', { seam: 'start' }), legStones(s, side, w, L, true, fore));
    pieces.push(
      { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.01, after: ['body', 'back'], front: side3 },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: out3 },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.03, after: ['body', `${key}1`], front: out3 },
    );
  }
  // Everything on the trunk bends with its spine as it goes (`waveOf`), as the legs, the neck and the tail come out of it.
  const bend = (v: readonly V3[], a: Anim): V3[] => { const w = waveOf(s, a); return w ? v.map((p) => bendPt(s, p, w)) : [...v]; };
  return pieces.map((pc) => (pc.bone === 'trunk' ? { ...pc, bent: bend } : pc));
}

/** Whether its tongue is out at all, this moment: the same sums as its pose, cheaply. */
function tongueShown(s: Crag, a: Anim): boolean {
  if (s.stage === 2) return false;
  if (a.act) return a.act.kind === 'work' && Math.abs(a.act.t - CRAG_WORK.flick - 0.07) < 0.16;
  return a.go < 1 && a.graze <= 0 && flickOf(s, a.t) > 0.01;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** The dust it raises, and the colours of the chips of stone that fly off it and off the ground, the same on every variant. */
const DUST: RGB = [196, 184, 166];
const CHIP_RGB: readonly RGB[] = [[168, 162, 152], [124, 120, 116], [136, 150, 164]];
/** The shock of its slam, a pale ring going out over the ground. */
const SHOCK: RGB = [250, 240, 206];

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn: less than in proportion on the small one, so they still read. */
const bigness = (s: Crag): number => 0.45 + 0.55 * (s.len / 1.6);

/** A chip of stone in the air: a small hard-edged lump, lit on its top, dark-edged, never under a pixel and a half. */
function chip(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01 || r <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, Math.min(1.5 / px, r * 3));
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = css(mix(c, [60, 50, 46], 0.15), al);
  g.strokeStyle = css(mix(c, [40, 32, 30], 0.6), al);
  g.lineWidth = Math.max(r * 0.22, 0.1);
  g.beginPath();
  g.moveTo(-r, -r * 0.2);
  g.lineTo(-r * 0.3, -r * 0.8);
  g.lineTo(r * 0.9, -r * 0.5);
  g.lineTo(r, r * 0.4);
  g.lineTo(-r * 0.2, r * 0.7);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = css(mix(c, [255, 250, 240], 0.35), al);
  g.beginPath();
  g.moveTo(-r * 0.8, -r * 0.2);
  g.lineTo(-r * 0.3, -r * 0.7);
  g.lineTo(r * 0.7, -r * 0.45);
  g.closePath();
  g.fill();
  g.restore();
}

/** A puff of dust: a soft cloud of three lobes, each a radial falloff, growing as it goes and thinning to nothing over its life (`age`). */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0, base: RGB = DUST): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.55 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
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

/** Chips of stone thrown from `from`, `since` seconds after, up and out; each drawn in front of the body or behind it. */
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

/** A ring on the ground about `c`, `r` out, as the ground's own ellipse seen from where the viewer is. */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, r: number, rgb: RGB, al: number, width: number): void {
  if (al <= 0.01 || r <= 0.01) return;
  g.save();
  g.transform(view.ex[0], view.ex[1], view.ey[0], view.ey[1], ...onScreen(view, [c[0], c[1], 0]));
  g.strokeStyle = css(rgb, al);
  g.lineWidth = width;
  g.beginPath();
  g.ellipse(0, 0, r, r, 0, 0, TAU);
  g.stroke();
  g.restore();
}

/** Cracks running out over the ground from `c`, `len` long at most, `k` of the way grown; behind everything, on the ground. */
function cracks(g: CanvasRenderingContext2D, view: View, c: V3, len: number, k: number, al: number, count: number, seed: number, w: number): void {
  if (al <= 0.01 || k <= 0) return;
  g.save();
  g.strokeStyle = css([82, 66, 56], al);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = w;
  for (let q = 0; q < count; q++) {
    const th = (q / count) * TAU + jitter(q + seed) * 0.7, L = len * (0.6 + 0.4 * jitter(q + seed + 1)) * k;
    const bend = (jitter(q + seed + 2) - 0.5) * 0.7;
    g.beginPath();
    const p0 = onScreen(view, [c[0], c[1], 0]);
    const p1 = onScreen(view, [c[0] + Math.cos(th) * L * 0.5, c[1] + Math.sin(th) * L * 0.5, 0]);
    const p2 = onScreen(view, [c[0] + Math.cos(th + bend) * L, c[1] + Math.sin(th + bend) * L, 0]);
    g.moveTo(p0[0], p0[1]);
    g.lineTo(p1[0], p1[1]);
    g.lineTo(p2[0], p2[1]);
    g.stroke();
  }
  g.restore();
}

/** Where the tip of its snout is, in the world: the front of its bite. */
const snoutTip = (s: Crag, b: Bones): V3 => { const c = snoutAt(s), r = snoutR(s); return place(b.head, [0, c[1] + r[1] * 0.95, c[2] - r[2] * 0.3]); };

/**
 * What a bite throws: as the jaw shuts, a white snap of short lines out from in front of its snout and a few chips of stone off its
 * teeth; a puff of dust under each fore foot as it lands.
 */
function biteBurst(g: CanvasRenderingContext2D, view: View, s: Crag, b: Bones, at: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - CRAG_STRIKE.snap) * ACT_SECS.strike;
  if (since <= 0) return;
  const tip = snoutTip(s, at);
  if (front && since < 0.16) {
    const [x, y] = onScreen(view, tip), k = since / 0.16, al = 1 - k;
    g.save();
    g.strokeStyle = css([255, 252, 240], al);
    g.lineCap = 'round';
    g.lineWidth = 0.16 * big;
    for (let q = 0; q < 6; q++) {
      const th = (q / 6) * TAU + 0.3, r0 = (0.3 + 0.6 * k) * big, r1 = r0 + 0.5 * big * (1 - 0.5 * k);
      g.beginPath();
      g.moveTo(x + Math.cos(th) * r0, y + Math.sin(th) * r0 * 0.8);
      g.lineTo(x + Math.cos(th) * r1, y + Math.sin(th) * r1 * 0.8);
      g.stroke();
    }
    g.restore();
  }
  for (const i of [0, 1]) {
    const f = place(at[`${LEGS4[i]}2`], [0, 0, 0]), p: V3 = [f[0], f[1], 0.1 * big];
    if (nearSide(p, mid, view) === front) puff(g, view, p, 0.3 * big, since / 0.4, 3 + i);
  }
}

/**
 * What its stun slam throws: the ground under its fore feet cracked; a pale shock ring and a second after it going out over the
 * ground from where it struck; a ring of dust thrown up round it; chips of stone and the pebbles of the ground jumping; and a puff
 * where its tail came down behind it.
 */
function slamBurst(g: CanvasRenderingContext2D, view: View, s: Crag, b: Bones, at: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - CRAG_CAST.slam) * ACT_SECS.cast;
  if (since <= 0) return;
  const feet = [place(at.fl2, [0, 0, 0]), place(at.fr2, [0, 0, 0])], c = scale(add(feet[0], feet[1]), 0.5);
  c[1] += s.len * 0.15;
  c[2] = 0;
  if (!front) {
    cracks(g, view, c, (1.3 + 0.9 * big) * big, ramp(since, 0, 0.06), 1 - ramp(since, 0.28, 0.45), 9, 50, 0.1 * big);
    for (const [q, delay] of [[0, 0], [1, 0.09]] as const) {
      const u = (since - delay) / 0.36;
      if (u <= 0 || u >= 1) continue;
      const r = big * (0.6 + (3.4 + 1.6 * big) * (1 - (1 - u) ** 2));
      groundRing(g, view, c, r, SHOCK, (1 - u) * (q ? 0.55 : 0.85), (0.22 - 0.06 * q) * big * (1 - 0.5 * u));
      groundRing(g, view, c, r * 0.94, [120, 100, 80], (1 - u) * 0.3, 0.1 * big);
    }
  }
  if (since < 0.5) {
    const out = ramp(since, 0, 0.4), rx = big * (1.2 + 3.2 * out);
    for (let q = 0; q < 10; q++) {
      const th = (q / 10) * TAU + 0.2, p: V3 = [c[0] + Math.cos(th) * rx, c[1] + Math.sin(th) * rx, 0.18 * big];
      if (nearSide(p, mid, view) === front) puff(g, view, p, big * 0.5, since / 0.5, 30 + q);
    }
  }
  for (const [q, f] of feet.entries()) spray(g, view, mid, [f[0], f[1], 0.12], since, front, 5, 700 + q * 50, 2.2 * big, 3.2 * big, 0.09 * big, 0.5);
  // Pebbles of the ground hopping out in the shock as it passes them.
  for (let q = 0; q < 12; q++) {
    const th = (q / 12) * TAU + jitter(q + 90), d = big * (1.2 + 3.4 * jitter(q + 91)), hop = since - d / ((5 + 3 * big) * big);
    if (hop < 0 || hop > 0.3) continue;
    const p: V3 = [c[0] + Math.cos(th) * d, c[1] + Math.sin(th) * d, 0.03 + big * 0.9 * hop * (0.3 - hop) * 10];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    chip(g, x, y, 0.06 * big, q + hop * 20, CHIP_RGB[q % 3], 1 - ramp(hop, 0.2, 0.3));
  }
  // The tail's own blow behind it.
  const n = s.tail.links.length - 1, end = place(at[`tail${Math.min(n, 3)}`], [0, 0, 0]), tp: V3 = [end[0], end[1], 0.15 * big];
  if (nearSide(tp, mid, view) === front) puff(g, view, tp, big * 0.55, since / 0.45, 8);
}

/** At its post: a little dust off a fore foot as it shifts its weight, now and then. */
function guardDust(g: CanvasRenderingContext2D, view: View, s: Crag, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), since = (frac(t - 0.5)) * ACT_SECS.work;
  if (since > 0.4) return;
  const f = place(b.fr2, [0, 0, 0]), p: V3 = [f[0], f[1] + s.thick, 0.06 * big];
  if (nearSide(p, b.body.t, view) === front) puff(g, view, p, 0.16 * big, since / 0.4, 12);
}

/**
 * Evolving: at the start a burst of chips and dust off it, which covers the moment it changes into its new body; then pebbles and
 * chips swirling up round it and in, gone into it at the flash.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Crag, b: Bones, t: number, front: boolean): void {
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
    for (let q = 0; q < 28; q++) {
      const th = (q / 28) * TAU * 2.4 + jitter(q) * 0.7;
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
    for (let q = 0; q < 18; q++) {
      const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32);
      const ang = (q / 18) * TAU + u * TAU * 1.4;
      const k = (1 - u) ** 1.2;
      const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -B.h[3] * 0.4 + u * high * 0.7]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      chip(g, x, y, 0.13 * big * (1 - 0.4 * u), ang * 2 + q, CHIP_RGB[q % 3], swirl * ramp(u, 0, 0.15));
    }
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it bites, slams, keeps its post and evolves. */
function cragKind(s: Crag): Kind {
  const bones = cragBones(s);
  const atStrike = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: CRAG_STRIKE.snap } });
  const atSlam = (a: Anim): Bones => bones({ ...a, act: { kind: 'cast', t: CRAG_CAST.slam } });
  return {
    bones,
    build: (lod) => cragBuild(s, lod),
    // The variant's coat is its skin and its markings the cream of its belly and throat; its pebbles and boulders are a grey of
    // the skin's own, its shale a blue-grey leaning to it, its spikes a darker; its eyes orange and its claws pale on every variant.
    palette: (coat, mark) => {
      const skin = mix(mix(pastel(coat, 36), coat, 0.6), [112, 104, 96], 0.1 * s.stage), cream = mix(mix(pastel(mark, 40), mark, 0.6), skin, 0.25);
      const pebble = mix(skin, [128, 118, 108], 0.5), shale = mix([156, 176, 196], skin, 0.12);
      return coatPalette(coat, mark, {
        coat: skin,
        coatDark: mix(skin, [96, 86, 78], 0.3),
        coatLight: mix(skin, [255, 250, 240], 0.35),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 252, 242], 0.5),
        inner: [196, 96, 100],
        tongue: [222, 112, 128],
        tooth: [248, 242, 228],
        lid: [70, 52, 46],
        nose: [70, 52, 46],
        eye: [34, 22, 20],
        glint: [255, 253, 246],
        crystal: [242, 140, 40],
        crystalDark: [196, 92, 28],
        claw: [234, 224, 204],
        stone: pebble,
        stoneDark: mix(pebble, [62, 58, 58], 0.3),
        shell: shale,
        shellDark: mix(shale, [44, 52, 64], 0.24),
        horn: mix(skin, [146, 136, 122], 0.32),
        hornDark: mix(skin, [88, 80, 74], 0.55),
        spot: mix(skin, [255, 252, 244], 0.55),
      } as Partial<ReturnType<Kind['palette']>>, 36);
    },
    shadow: [s.len * 0.8 + s.tail.links.reduce((x, y) => x + y, 0) * (s.stage ? 0.18 : 0.05), s.body.w[3] * 1.4],
    stride: 1.2,
    size: s.size,
    acts: ['strike', 'work', 'cast'],
    // Evolving, the motes rising round it are sand and stone grey.
    motes: [[224, 206, 172], [168, 170, 176]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') biteBurst(g, view, s, b, atStrike(a), act.t, front);
      else if (act?.kind === 'cast') slamBurst(g, view, s, b, atSlam(a), act.t, front);
      else if (act?.kind === 'work') guardDust(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const PEBBLETOOTH = cragKind(PEBBLETOOTH_LOOK);
export const SHALECLAW = cragKind(SHALECLAW_LOOK);
export const CRAGJAWS = cragKind(CRAGJAWS_LOOK);
