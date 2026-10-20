import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type MatOf, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The frog line: the Puddlehop, a small squat frog crouched low with one clear
 * bubble of water riding on its back and a leaf sprouting from its head, which
 * grows into the Springcarrier, bigger, squat and wide, a big clear ball of
 * water in a net of twisted root-rope on either side of its back, tied over
 * it, leaves at its shoulders and on its head and a blue water rune on its
 * cream belly; and then the Aquavoyager, large and powerful in a wide
 * stance on great webbed feet, two big bladders held on its back in a frame of
 * root-rope under a wooden pipe that crosses over the top with a spout at each
 * end, dripping, big leaves shading the top, a rope collar round its neck and
 * blue stripes across its chest. All three are green with blue mottling and
 * spots, cream at the throat and belly, with big round amber eyes up on top of
 * the head, a wide mouth in a calm smile, and round pads on their toes, the
 * webbing between them blue. The species is still `holla` underneath, as saves
 * and the database know it: the water carrier, that brings water from the
 * shore or a well to your barrels.
 *
 * Built the way the haul line is (`./wild-haul`): one set of functions from a
 * description of the stage (`Frog`), every foot given a point on the ground to
 * be at and its leg bent to reach it, so a planted foot stays where it was put.
 * A frog's legs come out of its sides: the hind leg folded double beside it,
 * the knee forward and out and the heel back by the hip, the long webbed foot
 * flat on the ground ahead of the heel; the fore leg short, the elbow back and
 * out. Each leg bends the same way round always, so it never flips. It walks a
 * toad's crawl, the diagonals together, and runs in hops: crouched on all four,
 * the hind feet heave it off the ground, it flies with its hind legs trailing,
 * lands on its hands and draws its feet in under it.
 *
 * Its water is water: each bladder a round clear ball, its edge pale, and in it
 * a body of water deepening in blue toward its middle, whose top stays level in
 * the world as the frog rolls and pitches, sloshing as it goes, a pale curved
 * band where it meets the skin, and a big soft highlight over the top. At its task it dips its chin into a puddle and gulps, the water rising
 * in its bladders, then leans over and pours it from a spout into a bucket.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

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

interface Frog {
  stage: 0 | 1 | 2;
  body: Rings;
  marks?: Rings;
  /** How high the body's middle is carried, and how far its front is tipped up (degrees): a frog sits up. */
  high: number;
  tilt: number;
  /**
   * The head: where it joins the body (body frame), how far forward and up its middle is from there, its half-sizes (across,
   * along, up), how far the mouth line is below its middle (a share of its height), and its pitch.
   */
  head: { at: V3; fwd: number; up: number; r: V3; mouth: number; pitch: number };
  /** The eyes: each a dome on top of the head, across, along and up as shares of the head's half-sizes; the dome's radius; the eye's. */
  eye: { at: V3; dome: number; size: number };
  fore: Leg;
  hind: Leg;
  /**
   * Its bladders, in the trunk's frame: the right one first and its mirror after it (or one in the middle); each a middle and
   * half-sizes, and how far its long axis is tipped out from upright (degrees).
   */
  bladders: Array<{ c: V3; r: V3; lean?: number }>;
  /** What it carries them in: a single bubble, rope rings and a harness, or a frame of rope with a pipe over the top. */
  gear: 0 | 1 | 2;
  gait: {
    /** How much of a stride a foot is down at a walk; how far it swings, as a share of the leg's reach, at a walk and at a hop. */
    duty: number; swing: [number, number];
    /** How high a foot is lifted at a walk, against its reach; how far the body sinks at a footfall; how far it rolls (degrees); how high a hop goes, against its hip height. */
    step: number; bob: number; roll: number; hop: number;
  };
  size: number;
}

/** A Puddlehop: small and squat, crouched low, a big head with big eyes, one clear bubble of water on its back, a leaf sprouting from its head. */
const PUDDLEHOP_LOOK: Frog = {
  stage: 0,
  body: { y: [-0.52, -0.43, -0.21, 0, 0.21, 0.38, 0.46], z: [0, 0, 0, 0, 0.02, 0.04, 0.04], w: [0.42, 0.7, 0.78, 0.78, 0.7, 0.54, 0.3], h: [0.24, 0.37, 0.42, 0.43, 0.4, 0.33, 0.19] },
  high: 0.42, tilt: 14,
  head: { at: [0, 0.34, 0.12], fwd: 0.16, up: 0.1, r: [0.53, 0.42, 0.29], mouth: 0.08, pitch: -12 },
  eye: { at: [0.54, 0.12, 0.74], dome: 0.18, size: 0.155 },
  fore: { hip: [0.36, 0.28, -0.2], len: [0.24, 0.23], at: [0.46, 0.42], foot: 0.08, toe: 0.15, toes: 4, w: 0.11, turn: 22 },
  hind: { hip: [0.42, -0.28, -0.12], len: [0.3, 0.27], at: [0.74, 0.02], foot: 0.15, toe: 0.22, toes: 5, w: 0.16, turn: 32 },
  bladders: [{ c: [0, -0.3, 0.26], r: [0.44, 0.5, 0.27] }],
  gear: 0,
  gait: { duty: 0.62, swing: [0.26, 0.36], step: 0.26, bob: 0.03, roll: 4, hop: 1.04 },
  size: 3.42,
};

/** A Springcarrier: bigger, squat and wide, two clear bladders in root-rope nets either side of its back, tied over it, leaves at its shoulders and on its head, a blue rune on its belly. */
const SPRINGCARRIER_LOOK: Frog = {
  stage: 1,
  body: { y: [-0.8, -0.68, -0.34, 0, 0.32, 0.56, 0.68], z: [0.02, 0.02, 0, 0, -0.02, -0.02, 0], w: [0.7, 1.16, 1.28, 1.28, 1.18, 0.94, 0.52], h: [0.48, 0.74, 0.84, 0.86, 0.82, 0.68, 0.38] },
  high: 0.84, tilt: 22,
  head: { at: [0, 0.56, 0.34], fwd: 0.14, up: 0.14, r: [0.76, 0.6, 0.42], mouth: 0.1, pitch: -20 },
  eye: { at: [0.53, 0.14, 0.74], dome: 0.25, size: 0.21 },
  fore: { hip: [0.62, 0.46, -0.38], len: [0.47, 0.44], at: [0.85, 0.7], foot: 0.13, toe: 0.28, toes: 4, w: 0.19, turn: 24 },
  hind: { hip: [0.7, -0.46, -0.34], len: [0.52, 0.46], at: [1.26, 0.12], foot: 0.26, toe: 0.42, toes: 5, w: 0.3, turn: 34 },
  bladders: [{ c: [1.2, -0.4, 0.25], r: [0.6, 0.6, 0.56] }, { c: [-1.2, -0.4, 0.25], r: [0.6, 0.6, 0.56] }],
  gear: 1,
  gait: { duty: 0.64, swing: [0.24, 0.32], step: 0.22, bob: 0.035, roll: 5, hop: 0.71 },
  size: 4.06,
};

/** An Aquavoyager: large and powerful in a wide stance on big webbed feet, two big bladders in a root-rope frame under a wooden pipe with a spout at each end, big leaves over the top, a rope collar, blue stripes on its chest. */
const AQUAVOYAGER_LOOK: Frog = {
  stage: 2,
  body: { y: [-0.98, -0.84, -0.44, 0, 0.42, 0.72, 0.86], z: [0.02, 0.02, 0, 0, -0.02, -0.02, 0], w: [0.84, 1.4, 1.56, 1.56, 1.44, 1.16, 0.64], h: [0.6, 0.92, 1.04, 1.06, 1.02, 0.84, 0.48] },
  high: 1.02, tilt: 22,
  head: { at: [0, 0.72, 0.42], fwd: 0.18, up: 0.16, r: [0.92, 0.72, 0.52], mouth: 0.12, pitch: -20 },
  eye: { at: [0.53, 0.16, 0.74], dome: 0.29, size: 0.245 },
  fore: { hip: [0.82, 0.58, -0.48], len: [0.62, 0.6], at: [1.14, 0.9], foot: 0.22, toe: 0.58, toes: 4, w: 0.27, turn: 28 },
  hind: { hip: [0.92, -0.56, -0.44], len: [0.66, 0.6], at: [1.74, 0.2], foot: 0.43, toe: 0.74, toes: 5, w: 0.38, turn: 36 },
  bladders: [{ c: [1.15, -0.95, 1.0], r: [0.78, 0.78, 0.85], lean: 20 }, { c: [-1.15, -0.95, 1.0], r: [0.78, 0.78, 0.85], lean: 20 }],
  gear: 2,
  gait: { duty: 0.66, swing: [0.22, 0.3], step: 0.2, bob: 0.04, roll: 5, hop: 0.48 },
  size: 3.85,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A ring dying away: `since` seconds after a knock, `k` at most, `f` times a second. */
const ringOut = (since: number, k: number, f = 2.6, damp = 3): number => (since < 0 ? 0 : k * Math.exp(-since * damp) * Math.sin(since * TAU * f));
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

function onRings(R: Rings, y: number, th: number): { p: V3; n: V3 } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
function ringAt(R: Rings, y: number): { w: number; h: number; z: number } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}
const outer = (s: Frog, y: number, th: number, off: number): { p: V3; n: V3 } => { const q = onRings(s.body, y, th); return { p: add(q.p, scale(q.n, off)), n: q.n }; };

function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** A frame scaled along its own three axes. */
const scaled = (x: Xf, k: V3): Xf => { const m = x.m; return { m: [m[0] * k[0], m[1] * k[1], m[2] * k[2], m[3] * k[0], m[4] * k[1], m[5] * k[2], m[6] * k[0], m[7] * k[1], m[8] * k[2]], t: x.t }; };

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

function facingDisc(pts: V3[], n: V3, m: Mat, o: { lit?: boolean; at?: V3 } = {}): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, ...o };
}

/** A painted band along a run of points on a surface, `w` wide (half), each point's way out given. */
function lineOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number | readonly number[], m: Mat, lift = 0.012): Disc {
  const at = (k: number): number => (typeof w === 'number' ? w : w[Math.min(k, w.length - 1)]);
  const up = (q: { p: V3; n: V3 }, k: number, sd: number): V3 => {
    const K = pts.length, d = unit(sub(pts[Math.min(K - 1, k + 1)].p, pts[Math.max(0, k - 1)].p));
    const side = unit(cross(q.n, d));
    return add(add(q.p, scale(q.n, lift)), scale(side, sd * at(k)));
  };
  const v = [...pts.map((q, k) => up(q, k, 1)), ...[...pts].map((q, k) => up(q, k, -1)).reverse()];
  return facingDisc(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** A thin flat thing along a line of points -- a leaf -- `widths` across it, its face along `face`, folded a little down its middle. */
function sheet(pts: readonly V3[], widths: readonly number[], face: V3, fold: number, mats: readonly [Mat, Mat, Mat]): Mesh {
  const K = pts.length, v: V3[] = [], f: Face[] = [], want: V3[] = [], ns: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n)), w = widths[Math.min(k, widths.length - 1)];
    const row: V3[] = [add(add(pts[k], scale(side, -w)), scale(n, fold * w)), pts[k], add(add(pts[k], scale(side, w)), scale(n, fold * w))];
    v.push(...row, ...row);
    ns.push(n);
  }
  for (let k = 0; k < K - 1; k++) {
    const A = k * 6, B = A + 6, n = unit(add(ns[k], ns[k + 1]));
    for (const j of [0, 1]) {
      f.push({ i: [A + j, A + j + 1, B + j + 1, B + j], m: mats[j] });
      want.push(n);
      f.push({ i: [B + 3 + j, B + 4 + j, A + 4 + j, A + 3 + j], m: mats[2] });
      want.push(scale(n, -1));
    }
  }
  return mesh(v, woundTo(v, f, want));
}

type Tone = 'green' | 'spring' | 'deep';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = { green: ['leaf', 'stem', 'stem'], spring: ['moss', 'leaf', 'leaf'], deep: ['stem', 'leafDark', 'leafDark'] };
const toneOf = (i: number, spring = 0.38): Tone => { const k = jitter(i * 3 + 1); return k < spring ? 'spring' : k > 0.86 ? 'deep' : 'green'; };

/** A leaf: a broad pointed oval along a gentle arch from `root` the way `dir` goes, `len` long and `w` across, its face along `face`. */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, K: number, tone: Tone, arch = 0.16, sharp = 0.7, fold = 0.25): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const tip = add(root, scale(d, len)), mid = add(add(root, scale(d, len * 0.5)), scale(f, len * arch));
  const widths = Array.from({ length: K }, (_, k) => Math.max(0.012, w * Math.sin(Math.PI * Math.min(0.999, (k / (K - 1)) ** sharp)) ** 0.8));
  return sheet(curve(root, mid, tip, K - 1), widths, f, fold, TONES[tone]);
}

/** One leaf of a piece of them: its mesh, where it is rooted, the way it lifts when it rustles. */
interface Frond { mesh: Mesh; root: V3; out: V3; len?: number }
interface Fronds { mesh: Mesh; w: number[]; out: V3[]; root: V3[] }
function fronds(parts: readonly Frond[]): Fronds {
  const w: number[] = [], out: V3[] = [], root: V3[] = [];
  for (const p of parts) {
    const L = p.len ?? Math.max(1e-3, ...p.mesh.v.map((q) => len3(sub(q, p.root))));
    for (const q of p.mesh.v) {
      w.push(clamp(len3(sub(q, p.root)) / L));
      out.push(p.out);
      root.push(p.root);
    }
  }
  return { mesh: merge(...parts.map((p) => p.mesh)), w, out, root };
}

function about(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), sn = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), sn)), scale(k, dot(k, v) * (1 - c)));
}

/** A sprig: `count` leaves splayed from one root, the middle one out the way `dir` says, the others either side, each its own tip. */
function sprig(root: V3, out: V3, dir: V3, len: number, K: number, id: number, count = 3, splay = 0.6): Frond[] {
  const o = unit(out), d0 = unit(dir), res: Frond[] = [];
  for (let q = 0; q < count; q++) {
    const side = count === 1 ? 0 : (q / (count - 1)) * 2 - 1, k = 1 - 0.2 * Math.abs(side), lid = id * 7 + q;
    const d = unit(about(d0, o, side * splay + (jitter(lid) - 0.5) * 0.2));
    const face = unit(add(o, scale(cross(d, o), (jitter(lid + 2) - 0.5) * 0.8)));
    const l = len * k * (0.9 + 0.2 * jitter(lid + 1));
    res.push({ mesh: leaf(root, d, face, l, l * 0.46, K, toneOf(lid, 0.32), 0.18, 0.62), root, out: o, len: l });
  }
  return res;
}

/** A body's rings rounded off at its ends, as the end of an egg is. */
function rounded(R: Rings): Rings {
  const n = R.y.length, y0 = R.y[0], y1 = R.y[n - 1], mid = (y0 + y1) / 2, half = (y1 - y0) / 2;
  const core: Rings = { y: R.y.slice(1, n - 1), z: R.z.slice(1, n - 1), w: R.w.slice(1, n - 1), h: R.h.slice(1, n - 1) };
  const out: Rings = { y: [], z: [], w: [], h: [] }, N = 14, p = 2.4;
  for (let k = 0; k <= N; k++) {
    const u = -Math.cos((Math.PI * k) / N), y = mid + half * u, c = ringAt(core, clamp(y, core.y[0], core.y[core.y.length - 1]));
    const cap = Math.max(0.12, (1 - Math.abs(u) ** p) ** (1 / p));
    out.y.push(y);
    out.z.push(c.z);
    out.w.push(c.w * cap);
    out.h.push(c.h * cap);
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
/** A smooth run through keys (time, value), times nought to one in order, held at either end. */
function keysAt(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  if (u <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [t0, v0] = keys[q], [t1, v1] = keys[q + 1];
    if (u <= t1) return lerp(v0, v1, smooth((u - t0) / Math.max(1e-6, t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
/** A smooth loop through keys (time, value), times nought to one in order, wrapping round. */
function loopCurve(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  const w = frac(u), n = keys.length;
  let i = n - 1;
  for (let q = 0; q < n; q++) if (keys[q][0] <= w) i = q;
  const [t0, v0] = keys[i], [t1raw, v1] = keys[(i + 1) % n];
  const t1 = i + 1 < n ? t1raw : t1raw + 1, ww = w < t0 ? w + 1 : w;
  return lerp(v0, v1, smooth((ww - t0) / Math.max(1e-6, t1 - t0)));
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Puddlehop's tongue, the Springcarrier's belly-slam, the Aquavoyager's bladder swing. */
export const FROG_HITS: readonly number[] = [0.5, 0.52, 0.56];
/** The Puddlehop's mouth opening and its tongue back in, and the Aquavoyager's stamp after its swing, as shares of the strike. */
export const FROG_STRIKE = { open: 0.42, back: 0.6, stamp: 0.66 } as const;
/**
 * A go at its task, as shares of it: leant over to the bucket, the water pouring from its bladders and stopping, upright again,
 * its chin down in the puddle, and the three gulps that fill its bladders again. It comes and goes full, as it stands, and loops,
 * so a go and the next are one.
 */
export const FROG_WORK = { tip: 0.08, pour: [0.14, 0.4] as const, up: 0.48, dip: 0.56, gulps: [0.66, 0.75, 0.84] as const } as const;
/** When it croaks as it stands about, in seconds into its loop, and for how long its throat is blown up. */
export const FROG_CROAKS: readonly number[] = [8.6, 19.4];
export const FROG_CROAK_LEN = 0.9;

/* ---- where its feet go ---------------------------------------------------------------- */

/**
 * A pose: where the ball of each foot is (along the ground, from under the body's middle) and how far its heel is lifted off it
 * (degrees, toes staying down); how the body is carried; the head pitched up, turned left and tilted; the jaw opened (degrees),
 * the throat blown up (nought to one), and the tongue out (a share of its reach).
 */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  head: [number, number, number];
  jaw: number; throat: number; tongue: number;
}

interface Rest {
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
  /** The heel's height over the ground, for each leg: how thick its foot is. */
  heel: number[];
}

const rests = new Map<Frog, Rest>();
const legOfI = (s: Frog, i: number): Leg => (i < 2 ? s.fore : s.hind);
function restOf(s: Frog): Rest {
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

function restPlan(s: Frog, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    head: [0, 0, 0], jaw: 0, throat: 0, tongue: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    jaw: m(a.jaw, b.jaw), throat: m(a.throat, b.throat), tongue: m(a.tongue, b.tongue),
  };
}

function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  return {
    at: p.at.map((x, i) => [d(x[0], to.at[i][0], from.at[i][0]), d(x[1], to.at[i][1], from.at[i][1]), d(x[2], to.at[i][2], from.at[i][2])] as V3),
    foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    jaw: d(p.jaw, to.jaw, from.jaw), throat: d(p.throat, to.throat, from.throat), tongue: d(p.tongue, to.tongue, from.tongue),
  };
}

/** How long the body is, hip to shoulder: what its moves are measured in. */
const lenOf = (s: Frog): number => s.fore.hip[1] - s.hind.hip[1];

/** A toad's crawl: the diagonals together, the left fore with the right hind. */
const CRAWL = [0, 0.5, 0.5, 0];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;

/**
 * Walking, a toad's crawl: each foot down for its share of a stride and swept back under the body at the ground's own speed, then
 * lifted -- heel first, the toes trailing -- and brought forward through the air. The body sinks onto each pair as it comes down
 * and rolls over onto the side whose fore foot is down, its head swinging the other way to look ahead.
 */
function crawlPlan(s: Frog, R: Rest, a: Anim): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s);
  const p = restPlan(s, R);
  const duty = G.duty, amp = G.swing[0];
  for (let i = 0; i < 4; i++) {
    const reach = R.reach[i], half = reach * amp * (i < 2 ? 0.9 : 1), A = R.ankle[i], ph = frac(a.u + CRAWL[i]);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      // The heel peeled up off the ground as the foot comes to the back of its stance, ready to go.
      p.foot[i] = (i < 2 ? 14 : 22) * ramp(ph / duty, 0.72, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    // Lifted and swung round out from the body, as a sprawling foot is.
    const lift = G.step * reach * Math.sin(Math.PI * u) ** 0.8;
    p.at[i] = [A[0] + SIDE[i] * 0.06 * reach * Math.sin(Math.PI * u), y, lift];
    p.foot[i] = (i < 2 ? 14 : 22) * (1 - smooth(u / 0.7)) + (i < 2 ? -8 : -12) * hump(u, 0.75, 0.25);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.04));
  p.H += -L * G.bob * down;
  const over = Math.sin(TAU * (w + 0.25 - duty / 2));
  p.roll = G.roll * over;
  p.side = L * 0.03 * over;
  p.yaw = 4 * Math.sin(TAU * (w - 0.1));
  p.pitch = 2 * (down - 0.5);
  p.head = [3 * (2 * down - 1), -6 * Math.sin(TAU * (w - 0.1)), -2 * over];
  p.throat = 0.1 * (1 - down);
  return p;
}

/** A hop, as shares of a stride: the hind feet down from nought to `HOP_LIFT`, the fore from `HOP_LAND` round to `HOP_UP`. */
const HOP_LIFT = 0.5, HOP_LAND = 0.74, HOP_UP = 0.25;

/**
 * Running, it hops: crouched on all four, then the hind legs heave it up and forward off the ground, its hands leaving it first;
 * for a moment it is in the air, hind legs trailing out behind; its hands come down ahead and take its weight, its nose dipping,
 * and its hind feet are drawn in under it and land. Each foot still sweeps back along the ground while it is down; the air
 * carries the rest of the way (`Kind.leaps`).
 */
function hopPlan(s: Frog, R: Rest, a: Anim): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s), up = G.hop * s.high;
  const p = restPlan(s, R);
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, reach = R.reach[i], half = reach * G.swing[1] * (fore ? 0.7 : 1), A = R.ankle[i];
    const start = fore ? HOP_LAND : 0, duty = fore ? 1 - HOP_LAND + HOP_UP : HOP_LIFT;
    const ph = frac(w - start);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      // The hind heels coming up off the ground as they push it off, the toes down to the last.
      p.foot[i] = fore ? 0 : 62 * ramp(ph / duty, 0.45, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), R2 = reach;
    if (fore) {
      // The hands up off the ground as it rises, flung forward ahead of it through the air, and put straight down to land.
      const y = keysAt([[0, A[1] - half], [0.3, A[1] + 0.1 * R2], [0.62, A[1] + half + 0.06 * R2], [0.7, A[1] + half], [1, A[1] + half]], u);
      p.at[i] = [A[0] * (1 - 0.12 * Math.sin(Math.PI * u)), y, up * keysAt([[0, 0], [0.3, 1.0], [0.62, 1.15], [0.84, 0.7], [1, 0]], u)];
      p.foot[i] = -18 * Math.sin(Math.PI * u);
    } else {
      // The hind feet thrown out behind it as it leaves the ground, its legs straight out, then drawn up and in under it to land.
      const y = keysAt([[0, A[1] - half], [0.1, A[1] - half - 0.3 * R2], [0.32, A[1] - half - 1.3 * R2], [0.62, A[1] - 0.4 * R2], [1, A[1] + half]], u);
      p.at[i] = [A[0] * (1 - 0.1 * Math.sin(Math.PI * u)), y, up * keysAt([[0, 0], [0.1, 0.8], [0.32, 1.1], [0.6, 1.0], [0.86, 0.3], [1, 0]], u)];
      p.foot[i] = 62 * (1 - smooth(u / 0.5)) + 40 * hump(u, 0.3, 0.25) - 10 * hump(u, 0.8, 0.15);
    }
  }
  // Low in its crouch, heaved up through its push, highest in the air, and down onto its hands and then its feet.
  p.H = s.high + up * loopCurve([[0, -0.2], [0.24, -0.16], [0.46, 0.45], [0.58, 1], [0.7, 0.62], [0.8, 0.02], [0.92, -0.22]], w);
  // Stretched out along its leap -- its sitting tilt let go as it leaves the ground, its nose up the way it is going -- and pitched
  // down onto its hands as it lands.
  // Its pitch in the world, nose up through its push and nose down onto its hands, less the tilt it sits at.
  p.pitch = loopCurve([[0, s.tilt + 2], [0.25, s.tilt + 4], [0.46, 18], [0.56, 6], [0.66, -10], [0.74, -18], [0.86, s.tilt - 8], [0.95, s.tilt]], w) - s.tilt;
  p.squash = loopCurve([[0, 0.09], [0.12, 0.03], [0.3, 0.0], [0.44, -0.12], [0.54, -0.14], [0.66, -0.08], [0.74, 0.02], [0.8, 0.08], [0.92, 0.03]], w);
  p.surge = L * loopCurve([[0, -0.03], [0.4, 0.02], [0.6, 0.06], [0.8, 0.02]], w);
  p.head = [-0.6 * p.pitch + 4, 0, 0];
  p.throat = 0.15 * hump(w, 0.76, 0.12);
  return p;
}

function goingPlan(s: Frog, R: Rest, a: Anim): Plan {
  if (a.gait <= 0) return crawlPlan(s, R, a);
  if (a.gait >= 1) return hopPlan(s, R, a);
  return mixPlan(crawlPlan(s, R, a), hopPlan(s, R, a), smooth(a.gait));
}

/** How far its throat is blown up this moment as it croaks standing about, nought to one. */
function croakOf(t: number): number {
  let k = 0;
  for (const c of FROG_CROAKS) {
    const u = (t - c) / FROG_CROAK_LEN;
    if (u > -0.2 && u < 1.2) k = Math.max(k, ramp(u, 0, 0.25) * (1 - ramp(u, 0.75, 1)));
  }
  return k;
}

/**
 * Standing about: breathing with its throat fluttering, looking about; twice a loop it croaks, its throat blown up into a great
 * bubble and its body swelling with it; now and then it licks an eye, and shifts a hand.
 */
function stillPlan(s: Frog, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, L = lenOf(s);
  const look = drift(t);
  p.head = [2 * cyc(t, 5) + 3 * a.breath, 14 * look, 4 * drift(t, 2)];
  p.H += 0.012 * L * (a.breath - 0.5);
  // The throat going in and out quickly as a frog's does, a little.
  p.throat = 0.08 + 0.06 * Math.max(0, Math.sin(t * TAU * 1.5));
  const croak = croakOf(t);
  p.throat = Math.max(p.throat, croak);
  p.squash -= 0.04 * croak;
  p.head[0] += 6 * croak;
  p.jaw = 2 * croak;
  // A lick of its lips: the tongue out a little and back.
  const lick = beat(t, [5.0, 15.8], 0.6);
  p.tongue = 0.22 * lick;
  p.jaw = Math.max(p.jaw, 10 * lick);
  // A hand shifted: the right one lifted, put down a little further out, and back.
  const shift = beat(t, [14.2], 1.2);
  if (shift > 0) {
    const A = R.ankle[1];
    p.at[1] = [A[0] + 0.04 * L * shift, A[1] + 0.03 * L * shift, R.reach[1] * 0.16 * Math.sin(Math.PI * clamp(((t - 14.2) / 1.2) * 2))];
    p.roll -= 2 * shift;
  }
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Puddlehop's tongue: drawn back into a crouch with its eyes on it, a lunge forward with its mouth open, the tongue flicked out and back. */
function tongueFlick(s: Frog, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = FROG_HITS[0], L = lenOf(s);
  const back = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.36, 0.46));
  const lunge = ramp(t, 0.36, 0.48) * (1 - ramp(t, 0.62, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06);
  p.surge = L * (-0.14 * back + 0.22 * lunge);
  p.H += L * (-0.06 * back + 0.02 * lunge);
  p.pitch = 4 * back - 6 * lunge;
  p.head = [6 * back - 4 * lunge, 0, 0];
  p.squash = 0.08 * back - 0.04 * lunge + 0.04 * jolt;
  p.jaw = 34 * ramp(t, FROG_STRIKE.open, hit - 0.04) * (1 - ramp(t, FROG_STRIKE.back + 0.02, FROG_STRIKE.back + 0.1));
  p.tongue = ramp(t, FROG_STRIKE.open + 0.02, hit) * (1 - ramp(t, hit + 0.03, FROG_STRIKE.back + 0.02));
  // The hands hop forward under the lunge, and come back.
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0], A[1] + L * 0.2, 0];
    const go = ramp(t, 0.38, hit - 0.02), ret = ramp(t, 0.7 + 0.05 * i, 0.94);
    p.at[i] = t < 0.62 ? arc(A, fwd, go, R.reach[i] * 0.3) : arc(fwd, A, ret, R.reach[i] * 0.25);
    p.foot[i] = 0;
  }
  return p;
}

/** The Springcarrier's belly-slam: reared up on its hind legs with its hands off the ground, then down on its belly onto what is in front of it, its bladders swinging. */
function bellySlam(s: Frog, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = FROG_HITS[1], L = lenOf(s);
  const rear = ramp(t, 0.04, 0.32) * (1 - ramp(t, 0.36, hit - 0.02));
  const slam = ramp(t, 0.38, hit) * (1 - ramp(t, hit + 0.1, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06);
  p.surge = L * (-0.08 * rear + 0.16 * slam);
  p.H += L * (0.22 * rear - 0.06 * slam);
  p.pitch = 26 * rear - 10 * slam;
  p.head = [-16 * rear + 6 * slam, 0, 0];
  p.squash = -0.06 * rear + 0.16 * jolt + 0.04 * slam;
  p.jaw = 12 * rear;
  p.throat = 0.5 * rear;
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0] * 0.9, A[1] + L * 0.04, R.reach[i] * 0.55], down: V3 = [A[0] * 1.05, A[1] + L * 0.22, 0];
    if (t < hit) {
      const k = ramp(t, 0.06, 0.3);
      p.at[i] = t < 0.38 ? mixV(A, high, k) : mixV(high, down, ramp(t, 0.38, hit - 0.02) ** 1.6);
    } else p.at[i] = arc(down, A, ramp(t, 0.7 + 0.06 * i, 0.94 + 0.03 * i), R.reach[i] * 0.2);
    p.foot[i] = 0;
  }
  // The hind heels up as it rears on its toes.
  for (const i of [2, 3]) p.foot[i] = 30 * rear;
  return p;
}

/** The Aquavoyager's bladder swing: wound round to one side in a crouch, then swung hard round the other way so its bladders swing into what it strikes, and a stamp. */
function bladderSwing(s: Frog, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = FROG_HITS[2], L = lenOf(s);
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit - 0.04));
  const swing = ramp(t, 0.38, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06), stamp = hump(t, FROG_STRIKE.stamp, 0.06);
  p.yaw = 22 * wind - 24 * swing;
  p.roll = -12 * wind + 12 * swing;
  p.H += L * (-0.05 * wind + 0.05 * swing - 0.06 * stamp);
  p.surge = L * (-0.04 * wind + 0.08 * swing);
  p.pitch = -3 * wind + 4 * swing;
  p.head = [3 * wind, -10 * wind + 9 * swing, 4 * swing];
  p.squash = 0.05 * wind + 0.08 * jolt + 0.05 * stamp;
  p.jaw = 14 * swing;
  // The right hand up as it swings and stamped down beside where it was.
  const i = 1, A = R.ankle[i];
  const lift = ramp(t, 0.3, hit) * (1 - ramp(t, hit + 0.02, FROG_STRIKE.stamp));
  p.at[i] = [A[0] + L * 0.06 * lift, A[1] + L * 0.05 * lift, R.reach[i] * 0.35 * lift];
  p.foot[i] = -10 * lift;
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));
/** How far it is bowed to the puddle through a go, nought to one. */
const dipOf = (t: number): number => ramp(t, FROG_WORK.up + 0.02, FROG_WORK.dip) * (1 - ramp(t, FROG_WORK.gulps[2] + 0.06, 0.98));
/** How far it is leant over to pour, nought to one. */
const tipOf = (t: number): number => ramp(t, FROG_WORK.tip - 0.06, FROG_WORK.pour[0]) * (1 - ramp(t, FROG_WORK.pour[1], FROG_WORK.up));
/** How full its bladders are through a go: emptying as it pours, filling again as it gulps -- full, as it stands, at either end. */
const fillOf = (t: number): number => 0.8 - 0.6 * ramp(t, FROG_WORK.pour[0], FROG_WORK.pour[1]) + 0.6 * ramp(t, FROG_WORK.gulps[0] - 0.04, FROG_WORK.gulps[2] + 0.04);

/**
 * A go at its task: leant over so the water pours out into the bucket beside it -- the Puddlehop to its right, the bigger two
 * forward, from both sides at once, into a bucket each side -- its head turned to watch; upright again; then bowed down with its chin in the puddle in front of it, its throat gulping three times as
 * its bladders fill again.
 */
function workPlan(s: Frog, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), L = lenOf(s), dip = dipOf(t), tip = tipOf(t), W = FROG_WORK;
  const gulp = Math.max(...W.gulps.map((g) => hump(t, g, 0.045)));
  p.surge = L * 0.08 * dip;
  // The Puddlehop is so low already that a bow brings its chin to the water; the bigger ones crouch to it.
  const bow = [0.45, 0.85, 1][s.stage];
  p.H -= L * (0.12 * dip * bow + 0.03 * tip);
  p.pitch = -6 * dip * bow;
  p.head = [-30 * dip * bow + 5 * gulp - 4 * tip, -18 * tip, 4 * tip];
  p.jaw = 6 * dip + 6 * gulp;
  p.throat = 0.15 + 0.55 * gulp * dip;
  p.squash = 0.04 * gulp;
  if (s.gear) {
    // The bigger two pour from both sides at once: leant forward and down over their necks or spouts, the head lowered to watch.
    p.pitch -= 12 * tip;
    p.H -= L * 0.04 * tip;
    p.head[1] = 0;
    p.head[2] = 0;
    p.head[0] -= 6 * tip;
  } else {
    // The Puddlehop leans over to its right, its left hand off the ground.
    p.roll = 24 * tip;
    p.side = L * 0.08 * tip;
    p.yaw = -6 * tip;
    const A = R.ankle[0];
    p.at[0] = [A[0] + L * 0.04 * tip, A[1], R.reach[0] * 0.2 * tip];
  }
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched down small as the light gathers, then up tall at the turn with its throat blown up, a shake, and settled. */
function evolvePlan(s: Frog, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.06 * hunch + 0.08 * up);
  p.pitch = -4 * hunch + 10 * up;
  p.head = [-10 * hunch + 10 * up, 6 * shake, 10 * shake];
  p.roll = 4 * shake;
  p.squash = 0.1 * hunch - 0.06 * up + 0.06 * hump(t, 0.72, 0.05);
  p.throat = up;
  p.jaw = 6 * up;
  for (const i of [2, 3]) p.foot[i] = 24 * up;
  return p;
}

/**
 * How much of a leg's reach any foot may take: a body is let down as far as it must be for every foot on the ground to be in this
 * much of its leg's reach; a foot in the air is drawn in toward its hip instead.
 */
const MOST_REACH = 0.94;

/**
 * Where a foot's heel goes for the ball of its foot at `at` and its heel lifted `lift` degrees: behind the ball, along the way the
 * foot points -- which is the way it was put down, whichever way the body turns over it.
 */
function heelOf(s: Frog, R: Rest, i: number, at: V3, lift: number): V3 {
  const L = legOfI(s, i), h = footHeading(i, L), F = L.foot, c = Math.cos(lift * DEG), sn = Math.sin(lift * DEG);
  return [at[0] - h[0] * F * c, at[1] - h[1] * F * c, at[2] + R.heel[i] + F * sn];
}
/** The way a foot points, flat: the way the body stands turned out by its leg's turn. */
function footHeading(i: number, L: Leg): V3 {
  const a = SIDE[i] * -L.turn * DEG;
  return [-Math.sin(a), Math.cos(a), 0];
}

function seated(s: Frog, R: Rest, p: Plan): Plan {
  let drop = 0;
  const body = joint(ROOT, [p.side, p.surge, p.H], s.tilt + p.pitch, p.roll, p.yaw);
  const at = p.at.map((x) => [...x] as V3);
  for (let i = 0; i < 4; i++) {
    const hip = place(body, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), flat = d[0] * d[0] + d[1] * d[1], up = -d[2];
    if (flat + up * up <= L * L) continue;
    // A foot on the ground lets the body down as far as it needs; one lifted, less the higher it is, so a foot leaving the
    // ground does not let the body jump up.
    const need = up - Math.sqrt(Math.max(0, L * L - flat)), k = 1 - smooth(at[i][2] / (0.2 * R.reach[i]));
    drop = Math.max(drop, need * k);
  }
  const H = p.H - Math.max(0, drop);
  // Whatever foot is still out of reach, in the air, is drawn in toward its hip.
  const body2 = joint(ROOT, [p.side, p.surge, H], s.tilt + p.pitch, p.roll, p.yaw);
  for (let i = 0; i < 4; i++) {
    const hip = place(body2, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), D = len3(d);
    if (D > L) at[i] = add(at[i], scale(d, L / D - 1));
  }
  return { ...p, at, H };
}

function planOf(s: Frog, R: Rest, a: Anim): Plan {
  return seated(s, R, posedOf(s, R, a));
}
function posedOf(s: Frog, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([tongueFlick, bellySlam, bladderSwing][s.stage](s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0.3, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its water ---------------------------------------------------------------------------------- */

/**
 * The water in its bladders this moment: how full they are (nought to one), how far its top is tipped forward and to its left
 * against level (degrees) as it sloshes, and how far the bladders are squashed (a wobble, plus flatter). Standing, the water
 * rocks a little; going, it slops back and forth at each step, and at a hop is thrown back as it leaves the ground and forward as
 * it lands; struck, worked or evolving, it sloshes after each knock.
 */
function waterOf(s: Frog, a: Anim): { fill: number; tilt: [number, number]; wobble: number } {
  const act = a.act, big = [1, 0.85, 0.75][s.stage];
  let fill = 0.8, fwd = 3 * cyc(a.t, 4), left = 3 * cyc(a.t, 3, 1), wob = 0.012 * cyc(a.t, 9);
  const croak = croakOf(a.t);
  wob += 0.03 * croak * Math.sin(a.t * 20);
  if (a.go > 0 && !act) {
    const g = smooth(Math.min(1, a.go)), w = frac(a.u), hop = a.gait;
    const walkF = 7 * Math.sin(2 * TAU * (w - 0.12)), walkL = 9 * Math.sin(TAU * (w - 0.1)), walkW = 0.03 * Math.sin(2 * TAU * (w - 0.08));
    const hopF = -16 * hump(w, 0.52, 0.16) + 22 * hump(w, 0.82, 0.14) - 8 * hump(w, 0.02, 0.1);
    const hopW = ringOut(frac(w - 0.74) * 0.5, 0.14, 4.2, 5) - 0.05 * hump(w, 0.55, 0.15);
    fwd = lerp(fwd, lerp(walkF, hopF, hop), g);
    left = lerp(left, lerp(walkL, 0, hop), g);
    wob = lerp(wob, lerp(walkW, hopW, hop), g);
  } else if (act?.kind === 'strike') {
    const since = (act.t - FROG_HITS[s.stage]) * ACT_SECS.strike;
    if (s.stage === 0) { fwd = 10 * hump(act.t, 0.32, 0.15) - 14 * hump(act.t, 0.5, 0.12); wob = ringOut(since, 0.06, 4); }
    else if (s.stage === 1) { fwd = -18 * hump(act.t, 0.3, 0.16) + ringOut(since, 30, 2.4); wob = ringOut(since, 0.22, 4, 4); }
    else { left = 14 * hump(act.t, 0.3, 0.16) + ringOut(since, -32, 2.2); fwd = ringOut(since, 12, 2.6); wob = ringOut(since, 0.18, 3.6, 4); }
  } else if (act?.kind === 'work' || (a.graze > 0 && a.go <= 0)) {
    const t = act?.kind === 'work' ? act.t : 0.3, k = act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
    fill = lerp(fill, fillOf(t), k);
    const gulp = Math.max(...FROG_WORK.gulps.map((g) => hump(t, g, 0.05)));
    fwd = lerp(fwd, -6 * dipOf(t) + 8 * gulp, k);
    left = lerp(left, -8 * hump(t, FROG_WORK.tip + 0.04, 0.08) + 3 * Math.sin(t * 40) * tipOf(t), k);
    wob = lerp(wob, 0.05 * gulp + 0.02 * Math.sin(t * 30) * tipOf(t), k);
  } else if (act?.kind === 'evolve') {
    wob = 0.1 * hump(act.t, 0.7, 0.08) * Math.sin(act.t * 70) - 0.06 * hump(act.t, 0.3, 0.2);
    left = 18 * hump(act.t, 0.68, 0.1) * Math.sin(act.t * 60);
  }
  return { fill, tilt: [fwd * big, left * big], wobble: wob };
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/**
 * A leg bent to put its heel (or wrist) at `ankle`: the hind leg's knee forward, out and up beside the body, the fore leg's elbow
 * back and out, always the same way round. The bones' own `-z` runs down each part; the foot's frame lies along the way it points,
 * its heel lifted as the pose says.
 */
function legOf(s: Frog, R: Rest, body: Xf, i: number, ankle: V3, heading: V3, lift: number): [Xf, Xf, Xf] {
  const fore = i < 2, [l0, l1] = R.legs[i];
  const hip = place(body, R.hip[i]), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = len3(d);
  const Dc = clamp(D, Math.abs(l0 - l1) + 0.05 * (l0 + l1), (l0 + l1) * 0.985);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit(fore ? [SIDE[i] * 0.75, -0.7, 0.15] : [SIDE[i] * 0.55, 0.8, 0.55]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], heading);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], -lift)];
}

/** The head's middle, in the head's frame. */
const skullAt = (s: Frog): V3 => [0, s.head.fwd, s.head.up];
/** Where the jaw hinges, in the head's frame: at the back of the mouth, low. */
const hingeAt = (s: Frog): V3 => { const H = s.head; return [0, H.fwd - H.r[1] * 0.55, H.up - H.r[2] * H.mouth]; };
/** Where the throat's bubble is, in the jaw's frame: under the chin. */
const throatAt = (s: Frog): V3 => { const H = s.head, hg = hingeAt(s); return [0, H.fwd + H.r[1] * 0.2 - hg[1], -H.r[2] * 0.62]; };

/** Its bones as worked out for an `Anim` -- kept, so its water can be bent to them without working them out twice. */
const posed = new WeakMap<Anim, { s: Frog; w: ReturnType<typeof waterOf> }>();

/** The water as it is this moment, for a stage. */
function waterNow(s: Frog, a: Anim): ReturnType<typeof waterOf> {
  const had = posed.get(a);
  if (had && had.s === s) return had.w;
  const w = waterOf(s, a);
  posed.set(a, { s, w });
  return w;
}

/** Bladder `q`'s bone: at its middle on the trunk, carried level in the world and turned the way the body faces, squashed by its wobble. */
function bladderBone(s: Frog, trunk: Xf, body: Xf, q: number, wobble: number): Xf {
  const B = s.bladders[q], c = place(trunk, B.c), f = turn(body, [0, 1, 0]);
  const [X, Y, Z] = frameOf([0, 0, 1], [f[0], f[1], 0]);
  return scaled(joint(xfOf(X, Y, Z, c), [0, 0, 0], 0, leanOf(s, q)), [1 + wobble * 0.6, 1 + wobble * 0.6, 1 - wobble]);
}
/** How far bladder `q` is tipped out to its side, in degrees, its top away from the body. */
function leanOf(s: Frog, q: number): number {
  return (s.bladders[q].lean ?? 0) * (q ? -1 : 1);
}

/** Where water comes out on its right as it pours, in the trunk's frame, and which way: the spout of its bladder, or of its pipe. */
function spoutOf(s: Frog): { p: V3; d: V3 } {
  if (s.gear === 2) { const P = pipeOf(s); return { p: P.spout, d: unit([0.55, 0.6, -0.6]) }; }
  // A puckered neck low on the outer front of the bladder on its right, or low on the right side of the Puddlehop's bubble.
  const B = s.bladders[0], d = unit(s.gear === 1 ? [0.6, 0.6, -0.5] : [0.9, 0.25, 0.2]), e = onEgg(B.c, B.r, d);
  return { p: add(e.p, scale(d, 0.08 * (0.6 + 0.4 * bigOf(s)))), d };
}
/** The sides it pours from: the Puddlehop its one bubble, to its right; the bigger two from both sides at once, into a bucket each side. */
const pourSides = (s: Frog): number[] => (s.gear ? [1, -1] : [1]);
/** A point or a direction on its right mirrored to side `sd`. */
const sided = (v: V3, sd: number): V3 => [sd * v[0], v[1], v[2]];

/** Where the bucket stands at its right as it works, and where the puddle is in front of it, worked out once from its pour and its dip. */
interface Site { bucket: V3; puddle: V3; r: number; h: number }
const sites = new Map<Frog, Site>();

function frogBones(s: Frog): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, a: Anim): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], s.tilt + P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    // Squashed as it lands; and stretched out along its length as it leaps, rather than drawn up tall.
    b.trunk = P.squash >= 0 ? trunkOf(body, P.squash) : scaled(body, [1 + 0.35 * P.squash, 1 - 1.4 * P.squash, 1 + 0.35 * P.squash]);
    b.head = joint(body, s.head.at, s.head.pitch + P.head[0], P.head[2], P.head[1]);
    b.jaw = joint(b.head, hingeAt(s), -P.jaw);
    const th = 0.72 + 1.15 * P.throat;
    b.throat = scaled(joint(b.jaw, throatAt(s), 0), [th, th * 0.9, th]);
    if (s.stage === 0 && P.tongue > 0.001) {
      const H = s.head, reach = (H.r[1] * 2.6 + lenOf(s) * 0.5) * P.tongue;
      const root = joint(b.jaw, [0, H.r[1] * 0.4 + H.fwd - hingeAt(s)[1], H.r[2] * 0.08], 6);
      b.tongue = scaled(root, [1, reach, 1]);
      b.tongueTip = joint(root, [0, reach, 0]);
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
    const W = waterNow(s, a);
    s.bladders.forEach((_, q) => {
      const key = q ? 'bladL' : s.bladders.length > 1 ? 'bladR' : 'bladC';
      b[key] = bladderBone(s, b.trunk, body, q, W.wobble);
    });
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    return b;
  };
  let ready = false;
  const prepare = (): void => {
    ready = true;
    if (sites.has(s)) return;
    const base: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
    // The bucket where the stream from its spout comes down, leant over at the height of its pour.
    const tp = (FROG_WORK.pour[0] + FROG_WORK.pour[1]) / 2;
    const a1: Anim = { ...base, act: { kind: 'work', t: tp } };
    const b1 = pose(planOf(s, R, a1), a1);
    const S = spoutOf(s), from = place(b1.trunk, S.p), dir = turn(b1.trunk, S.d); // its right; the left is its mirror
    const h = bucketHeight(s), r = bucketRadius(s);
    const land = streamAt(from, dir, streamSpeed(s), h * 0.9);
    // The bucket's middle just under where the stream lands, nudged out so its rim clears the frog's own side.
    const clear = Math.max(s.hind.at[0] * 0.9, ...s.bladders.map((b) => b.c[0] + b.r[0] * 0.8)) + r * 1.1;
    // The Springcarrier's out past its bladder and forward of it, where the near one does not hide it.
    const bucket: V3 = s.gear === 1 ? [Math.max(land[0], clear) + s.bladders[0].r[0] * 0.5, land[1] + 0.5, 0] : [Math.max(land[0], clear), land[1], 0];
    // The puddle under its chin as it dips.
    const a2: Anim = { ...base, act: { kind: 'work', t: FROG_WORK.gulps[1] } };
    const b2 = pose(planOf(s, R, a2), a2);
    const chin = place(b2.jaw, throatAt(s));
    sites.set(s, { bucket, puddle: [chin[0], chin[1] + s.head.r[1] * 0.3, 0], r, h });
  };
  return (a) => {
    if (!ready) prepare();
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go });
    const b = pose(P, a);
    const working = a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
    if (working) {
      const t = a.act?.kind === 'work' ? a.act.t : 0.3, k = a.act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
      const g = smooth((k - 0.03) / 0.5), S = sites.get(s)!;
      if (g > 0.01) for (const sd of pourSides(s)) b[sd > 0 ? 'site' : 'siteL'] = { m: [g, 0, 0, 0, g, 0, 0, 0, g], t: sided(S.bucket, sd) };
    }
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------------------- */

const marksOf = (s: Frog): Rings => s.marks ?? s.body;
/** How much a stage's small things are scaled, against the Springcarrier's. */
const bigOf = (s: Frog): number => lenOf(s) / 1.06;

/** A painted blob lying on the body, every corner laid back onto the body's own curve: a blot of its mottling. */
function blotOn(s: Frog, y: number, th: number, rx: number, ry: number, m: Mat, spin: number, id: number, sides = 9): Disc {
  const q = onRings(s.body, y, th), d = disc(add(q.p, scale(q.n, 0.01)), q.n, rx, ry, sides, m, { spin, up: [0, 0, 1] });
  return {
    ...d, v: d.v.map((v, k) => {
      // Ragged at its edge, so a blot is a blot and not a coin.
      const c = add(q.p, scale(sub(v, q.p), 0.82 + 0.3 * jitter(id * 13 + k)));
      const r = ringAt(s.body, c[1]), a = Math.atan2((c[2] - r.z) / r.h, c[0] / r.w);
      const e = onRings(s.body, c[1], a);
      return add(e.p, scale(e.n, 0.012 * bigOf(s)));
    }),
  };
}

/** Whether a point on the body is in its cream belly: under it, and up the front of its chest. */
function inBelly(s: Frog, c: V3): boolean {
  const M = marksOf(s), r = ringAt(s.body, c[1]), up = (c[2] - r.z) / r.h, front = (c[1] - M.y[2]) / (M.y[6] - M.y[2]);
  const across = Math.abs(c[0]) / r.w;
  return up < -0.12 - 0.15 * across || (front > 0 && across < 0.86 && up < 0.25 + 1.2 * front - 0.6 * across * across);
}

/**
 * The body: green, cream underneath and up the front of its chest, mottled over its back and flanks in big blots of blue and a
 * few small darker spots; on the Springcarrier a blue water rune on its belly, on the Aquavoyager blue stripes across its chest.
 */
function barrelOf(s: Frog, n: number): Mesh {
  const B = s.body;
  const m0 = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, 'coat');
  const body = mesh(m0.v, m0.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m0.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return inBelly(s, c) ? { ...f, m: 'belly' as Mat } : f;
  }));
  const M = marksOf(s), spots: Disc[] = [];
  const count = [16, 18, 20][s.stage];
  for (let q = 0; q < count; q++) {
    const id = 300 + q * 7, sd = q % 2 ? 1 : -1;
    // On its flanks, low and high, rather than over its back, which is green.
    const y = lerp(M.y[1], M.y[5], jitter(id)), up = lerp(-0.35, 0.75, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.19 + 0.11 * jitter(id + 2)) * r.w;
    const at = onRings(s.body, y, th);
    if (inBelly(s, at.p)) continue;
    spots.push(blotOn(s, y, th, k * 1.25, k * 0.9, 'mark', jitter(id + 4) * 3, id));
  }
  // A wash of blue down the middle of the back from behind the head, in a run of big soft blots, long along the spine.
  for (let q = 0; q < 4; q++) {
    const y = lerp(M.y[5] + 0.05, M.y[2], q / 3), r = ringAt(M, y);
    spots.push(blotOn(s, y, Math.PI / 2 + (jitter(q + 40) - 0.5) * 0.3, r.w * (0.26 - 0.03 * q), r.w * 0.24, 'mark', 0, 900 + q, 10));
  }
  const dots = [6, 8, 10][s.stage];
  for (let q = 0; q < dots; q++) {
    const id = 700 + q * 5;
    const y = lerp(M.y[1], M.y[5], jitter(id)), th = lerp(0.1, Math.PI - 0.1, jitter(id + 1));
    const r = ringAt(M, y), k = (0.07 + 0.04 * jitter(id + 2)) * r.w;
    const at = onRings(s.body, y, th);
    if (inBelly(s, at.p)) continue;
    spots.push(blotOn(s, y, th, k, k, 'spot', 0, id, 7));
  }
  // The cream painted over again flat, so the belly under it, seen from above, is cream and not a lavender shade.
  const cream = paint(body.f.filter((f) => f.m === 'belly').map((f) => ({ v: f.i.map((i) => body.v[i]), m: 'belly' as Mat })));
  return merge(body, cream, paint(spots), paint(bellyMarks(s)));
}

/** The Springcarrier's rune -- a water sign, a drop between two waves curling out -- and the Aquavoyager's stripes, painted on its belly. */
function bellyMarks(s: Frog): Disc[] {
  const M = marksOf(s), out: Disc[] = [];
  // Points round the underside of the body from straight down, along it.
  const pt = (y: number, a: number): { p: V3; n: V3 } => { const q = onRings(s.body, y, -Math.PI / 2 + a); return { p: add(q.p, scale(q.n, 0.004)), n: q.n }; };
  if (s.stage === 1) {
    // The rune: a ram's horns, as the sign is drawn -- from a point low in the middle, two strokes rising and curling out, over and
    // down, one each way, the one the mirror of the other; tapered at their ends. Laid out flat (across, up the chest) and put on.
    const w = 0.045 * bigOf(s), k = 1.4, horn: Array<[number, number]> = [[0, -0.14], [0.02, 0.0], [0.07, 0.12], [0.15, 0.19], [0.24, 0.18], [0.3, 0.1], [0.29, 0.0], [0.23, -0.05], [0.17, -0.02], [0.17, 0.04]];
    const along = (u: number): [number, number] => {
      const f = u * (horn.length - 1), i = Math.min(horn.length - 2, Math.floor(f)), t = f - i;
      const p0 = horn[Math.max(0, i - 1)], p1 = horn[i], p2 = horn[i + 1], p3 = horn[Math.min(horn.length - 1, i + 2)];
      const c = (a: number, b: number, c2: number, d: number): number => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
      return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
    };
    // Centred where the chest faces most toward a viewer in front of it and above, and laid out across it and up it as the world
    // has up, each point then put back onto the body.
    const tl = s.tilt * DEG, view: V3 = unit([0, Math.cos(tl) * 1 + Math.sin(tl) * 0.9, -Math.sin(tl) * 1 + Math.cos(tl) * 0.9]);
    let best = { y: M.y[4], d: -9 };
    for (let q = 0; q <= 20; q++) { const y = lerp(M.y[3], M.y[6], q / 20), e = onRings(s.body, y, -Math.PI / 2), d = dot(e.n, view); if (d > best.d) best = { y, d }; }
    const C = onRings(s.body, best.y, -Math.PI / 2), upW: V3 = [0, Math.sin(tl), Math.cos(tl)];
    const U = unit(sub(upW, scale(C.n, dot(upW, C.n))));
    const onto = (x: number, y: number): { p: V3; n: V3 } => {
      const P = add(C.p, add(scale([1, 0, 0], x), scale(U, y))), r = ringAt(s.body, P[1]);
      const e = onRings(s.body, P[1], Math.atan2((P[2] - r.z) / r.h, P[0] / r.w));
      return { p: add(e.p, scale(e.n, 0.004)), n: e.n };
    };
    const N = 22;
    for (const sd of [1, -1]) {
      const pts = Array.from({ length: N }, (_, q) => { const [x, y] = along(q / (N - 1)); return onto(sd * x * k, (y + 0.02) * k - 0.32); });
      out.push(lineOn(pts, pts.map((_, q) => w * (0.5 + 0.5 * Math.sin(Math.PI * (0.08 + 0.84 * q / (N - 1))))), 'gem', 0.016));
    }
  }
  if (s.stage === 2) {
    // Three stripes across the chest and belly, sweeping down from its right shoulder to its left, tapered at their ends.
    for (let k = 0; k < 3; k++) {
      const y0 = M.y[5] + 0.06 - k * 0.3, w = (0.07 - 0.012 * k) * bigOf(s);
      const pts = Array.from({ length: 8 }, (_, q) => { const u = q / 7; return pt(y0 - 0.2 * u, lerp(0.75, -0.45, u)); });
      out.push(lineOn(pts, pts.map((_, q) => w * Math.sin(Math.PI * (0.1 + 0.8 * q / 7)) ** 0.6), 'gem', 0.016));
    }
  }
  return out;
}

/* ---- the head ------------------------------------------------------------------------------- */

/** The height of the mouth line round the head at `phi` round from straight ahead (radians), in the head's frame: a calm smile. */
function mouthZ(s: Frog, phi: number): number {
  const H = s.head, k = clamp(Math.abs(phi) / 1.7);
  return H.up - H.r[2] * H.mouth + H.r[2] * (0.1 * k * k - 0.04 * (1 - k));
}

/** A part of an egg between two heights at each angle round, as rows of rings: what the head and the jaw are cut from. */
function eggBand(c: V3, r: V3, n: number, rows: number, top: (phi: number) => number, bottom: number, mat: (row: number, phi: number) => Mat, open: boolean): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= rows; k++) {
    for (let j = 0; j < n; j++) {
      const phi = (j / n) * TAU - Math.PI;
      const z0 = clamp((top(phi) - c[2]) / r[2], -0.999, 0.999), th0 = Math.acos(z0), th = lerp(th0, Math.acos(bottom), k / rows);
      v.push([c[0] + r[0] * Math.sin(th) * Math.sin(phi), c[1] + r[1] * Math.sin(th) * Math.cos(phi), c[2] + r[2] * Math.cos(th)]);
    }
  }
  for (let k = 0; k < rows; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, a = k * n + j, b = k * n + j2, cc = (k + 1) * n + j2, d = (k + 1) * n + j;
      const mid = scale(add(add(v[a], v[b]), add(v[cc], v[d])), 0.25);
      f.push({ i: [a, b, cc, d], m: mat(k, ((j + 0.5) / n) * TAU - Math.PI) });
      want.push(sub(mid, c));
    }
  }
  if (!open) {
    f.push({ i: Array.from({ length: n }, (_, j) => j), m: mat(0, 0) });
    want.push([0, 0, 1]);
  }
  return mesh(v, woundTo(v, f, want));
}

/**
 * The head: a wide, flat-topped dome of green, mottled blue behind its eyes, two little nostrils at the front; under the line of
 * its mouth the inside of its mouth, which shows only when the jaw drops. Its eyes are domes up on top of it, each a big round
 * amber eye with a dark slot of a pupil and two glints, a lid of green over the top of it so it looks out calmly.
 */
function headOf(s: Frog, n: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const top = eggBand(C, H.r, n + 4, 6, () => C[2] + H.r[2] * 0.999, -0.999, () => 'coat', true);
  const skull = mesh(top.v, top.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, top.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const phi = Math.atan2(c[0] - C[0], c[1] - C[1]);
    return c[2] < mouthZ(s, phi) - H.r[2] * 0.12 ? { ...f, m: 'inner' as Mat } : f;
  }));
  const E = s.eye, out: Mesh[] = [skull];
  const blots: Disc[] = [];
  // Mottling: a blot behind each eye and one on the crown, and the nostrils.
  const wash: Array<[number, number, number, number]> = [[0, -0.35, 0.92, 0.42], [0, 0.15, 0.98, 0.22]];
  {
    // A band of blue-teal over the top of the head from the brow back between the eyes, a third of its width.
    const band = Array.from({ length: 9 }, (_, q) => onEgg(C, H.r, [0, lerp(0.75, -0.95, q / 8), 0.75 + 0.25 * Math.sin(Math.PI * q / 8)]));
    blots.push(lineOn(band, band.map((_, q) => H.r[0] * 0.18 * Math.sin(Math.PI * (0.12 + 0.76 * q / 8)) ** 0.5), 'mark', 0.01));
  }
  for (const [x, y, z, k] of [...wash, [0.8, -0.4, 0.4, 0.16], [-0.8, -0.4, 0.4, 0.16], [0.92, 0.12, 0.2, 0.1], [-0.92, 0.12, 0.2, 0.1], [0.12, -0.6, 0.85, 0.12]] as Array<[number, number, number, number]>) {
    const e = onEgg(C, H.r, [x, y, z]);
    blots.push(disc(add(e.p, scale(e.n, 0.008)), e.n, H.r[0] * k * 1.2, H.r[0] * k * 0.8, 8, 'mark', { spin: x * 2 }));
  }
  for (const sd of [1, -1]) {
    const e = onEgg(C, H.r, [sd * 0.18, 0.85, 0.5]);
    blots.push(disc(add(e.p, scale(e.n, 0.008)), e.n, H.r[0] * 0.05, H.r[0] * 0.035, 6, 'nose', { spin: sd * 0.5 }));
  }
  // The line of its mouth, painted along the edge of the upper lip: a wide calm smile right round to under its eyes.
  const lip = Array.from({ length: 15 }, (_, q) => {
    const phi = lerp(-1.75, 1.75, q / 14), z = mouthZ(s, phi) + H.r[2] * 0.02;
    const zz = clamp((z - C[2]) / H.r[2], -0.99, 0.99), sn = Math.sqrt(1 - zz * zz);
    return onEgg(C, H.r, [Math.sin(phi) * sn, Math.cos(phi) * sn, zz]);
  });
  blots.push(lineOn(lip, lip.map((_, q) => H.r[0] * 0.022 * (0.4 + 0.6 * Math.sin(Math.PI * (0.05 + 0.9 * q / 14)))), 'nose', 0.012));
  out.push(paint(blots));
  for (const sd of [1, -1]) {
    const dc = domeAt(s, sd), r = E.dome;
    out.push(orb(dc, [r, r * 0.95, r * 0.9], n, 5, 'coat'));
    out.push(eyeOf(s, sd, shut));
  }
  return merge(...out);
}

/** The middle of the dome its eye sits on, in the head's frame. */
const domeAt = (s: Frog, sd: number): V3 => { const H = s.head, E = s.eye, C = skullAt(s); return [sd * H.r[0] * E.at[0], C[1] + H.r[1] * E.at[1], C[2] + H.r[2] * E.at[2]]; };
/** The way an eye looks, out of its dome: out to its side, forward and up, so it is seen from in front, side on and from above. */
const eyeDir = (sd: number): V3 => unit([sd * 0.52, 0.72, 0.5]);

function eyeOf(s: Frog, sd: number, shut: boolean): Mesh {
  const E = s.eye, dc = domeAt(s, sd), R: V3 = [E.dome, E.dome * 0.95, E.dome * 0.9];
  const q = onEgg(dc, R, eyeDir(sd)), n = q.n, p = add(q.p, scale(n, 0.004)), at = add(q.p, scale(n, -E.dome * 0.08));
  const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
  const o = { at, up: [0, 0, 1] as V3 };
  const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(dc, R, sub(v, dc)); return add(e.p, scale(e.n, lift)); }) });
  const r = E.size, out: Disc[] = [];
  if (shut) {
    out.push(onto(disc(p, n, r * 1.12, r * 1.12, 10, 'coatDark', o), 0.006));
    out.push(onto(disc(add(p, scale(up, -r * 0.15)), n, r * 1.05, r * 0.16, 8, 'lid', o), 0.01));
    return paint(out);
  }
  out.push(onto(disc(p, n, r * 1.14, r * 1.14, 12, 'lid', o), 0.006));
  out.push(onto(disc(p, n, r, r, 12, 'crystal', o), 0.01));
  out.push(onto(disc(add(p, scale(up, -r * 0.3)), n, r * 0.8, r * 0.5, 10, 'crystalDark', o), 0.012));
  out.push(onto(disc(p, n, r * 0.56, r * 0.34, 10, 'eye', o), 0.016));
  out.push(onto(disc(add(add(p, scale(up, r * 0.38)), scale(across, sd * r * 0.32)), n, r * 0.28, r * 0.28, 6, 'glint', { ...o, lit: true }), 0.022));
  out.push(onto(disc(add(add(p, scale(up, -r * 0.42)), scale(across, -sd * r * 0.3)), n, r * 0.12, r * 0.12, 5, 'glint', { ...o, lit: true }), 0.022));
  // The lid of green over the top of it, so it looks out calmly rather than staring.
  out.push(onto(disc(add(p, scale(up, r * 1.0)), n, r * 1.3, r * 0.38, 9, 'coat', o), 0.02));
  return paint(out);
}

function headSolids(s: Frog): Array<{ c: V3; r: V3 }> {
  const H = s.head, E = s.eye;
  return [{ c: skullAt(s), r: scale(H.r, 0.92) }, ...[1, -1].map((sd) => ({ c: domeAt(s, sd), r: [E.dome * 0.8, E.dome * 0.8, E.dome * 0.8] as V3 }))];
}

/**
 * The lower jaw, in its own frame from its hinge: the egg of the head a little fuller under the line of the mouth, cream, its top
 * edge the mouth's line; closed, it hides the inside of the mouth.
 */
function jawOf(s: Frog, n: number): Mesh {
  const H = s.head, C = skullAt(s), hg = hingeAt(s), k = 1.04;
  const r: V3 = [H.r[0] * k, H.r[1] * k, H.r[2] * k];
  const m = eggBand(C, r, n + 4, 4, (phi) => mouthZ(s, phi), -0.98, (row) => (row === 0 ? 'muzzle' : 'belly'), true);
  return flat(mesh(m.v.map((p) => sub(p, hg)), m.f));
}

/**
 * A mesh with its own faces painted over it again, flat: cream that is seen from above on the underside of a chin would otherwise
 * be in shade, a lavender grey, where a frog's throat is the palest thing about it. Its outline and its line still go round it.
 */
function flat(m: Mesh): Mesh {
  return merge(m, paint(m.f.map((f) => ({ v: f.i.map((i) => m.v[i]), m: f.m }))));
}

/** The bubble of its throat, in its own frame, blown up by the bone's scale. */
function throatOf(s: Frog, n: number): Mesh {
  const H = s.head;
  return flat(orb([0, 0, 0], [H.r[0] * 0.62, H.r[1] * 0.55, H.r[2] * 0.6], n, 5, 'muzzle'));
}

/** The Puddlehop's tongue: pink, out along its bone (scaled to its length), and a round sticky tip. */
function tongueOf(s: Frog): { rope: Mesh; tip: Mesh } {
  const w = s.head.r[2] * 0.12;
  return { rope: tube([[0, 0, 0], [0, 1, 0]], [w, w * 0.8], [w * 0.6, w * 0.5], 6, 'tongue'), tip: orb([0, 0, 0], [w * 1.7, w * 1.5, w * 1.3], 7, 4, 'tongue') };
}

/* ---- legs and feet ------------------------------------------------------------------------------ */

/**
 * A foot in its own frame, from the heel (or wrist) at the origin along `+y`, the ground `heel` under it: the back of the foot,
 * flat, out to the ball; then its toes splayed out from the ball, each ending in a round pad, and on a hind foot the blue webbing
 * between them. Built for the right side.
 */
function footOf(s: Frog, L: Leg, heel: number, hind: boolean, n: number): Mesh {
  const F = L.foot, w = L.w, z0 = -heel, parts: Mesh[] = [];
  const ball: V3 = [0, F, z0 + w * 0.28];
  parts.push(tube([[0, -w * 0.2, 0], [0, F * 0.5, z0 * 0.5 + w * 0.15], ball], [w * 0.75, w * 0.62, w * 0.55], [w * 0.55, w * 0.42, w * 0.32], Math.max(5, n - 2), 'coat', { seam: 'start' }));
  const T = L.toes, spread = hind ? 1.5 : 1.25, tips: V3[] = [], mids: V3[] = [];
  for (let k = 0; k < T; k++) {
    // Splayed from inside (negative) to out; the outer toes a little shorter, the middle ones longest.
    const u = k / (T - 1), a = lerp(-spread * 0.48, spread * 0.52, u);
    const len = L.toe * (0.78 + 0.3 * Math.sin(Math.PI * u)) * (hind ? 1 : 0.9);
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    const tip: V3 = [ball[0] + d[0] * len, ball[1] + d[1] * len, z0 + w * 0.2];
    const mid: V3 = [ball[0] + d[0] * len * 0.5, ball[1] + d[1] * len * 0.5, z0 + w * 0.26];
    tips.push(tip);
    mids.push(mid);
    const tw = w * (hind ? 0.26 : 0.3);
    // Green along its top, the big one's going blue toward its tip, and a small tan pad at the end of it.
    parts.push(tube([ball, mid, tip], [tw * 1.2, tw, tw * 0.85], [tw * 0.8, tw * 0.7, tw * 0.6], 5, (r) => (s.stage === 2 && r === 1 ? 'mark' : 'coat'), { start: false }));
    parts.push(orb(add(tip, [d[0] * tw * 0.5, d[1] * tw * 0.5, -tw * 0.15]), [tw * 1.15, tw * 1.15, tw * 0.75], 6, 3, 'pad'));
  }
  if (hind) {
    // The webbing: a sheet between each toe and the next, out to near their tips, its edge scalloped in between.
    const web: Disc[] = [];
    for (let k = 0; k < T - 1; k++) {
      const a = tips[k], b = tips[k + 1], ma = mixV(ball, a, 0.92), mb = mixV(ball, b, 0.92);
      const notch = mixV(ball, mixV(a, b, 0.5), 0.7);
      web.push(facingDisc([add(ball, [0, 0, -w * 0.02]), ma, notch, mb], [0, 0, 1], 'membrane'));
    }
    parts.push(paint(web));
  }
  return merge(...parts);
}

/** The thigh (or upper arm), in its bone's frame: down `-z` from the hip, fat at the hip. */
function upperOf(s: Frog, L: Leg, l0: number, hind: boolean, n: number, k: number): Mesh {
  const w = L.w, top = hind ? 2.0 : 1.15, low = hind ? 1.1 : 0.9;
  // A hind thigh is a haunch: one fat egg from the hip to the knee, a frog's drumstick folded up beside its body.
  const m = hind
    ? merge(orb([0, 0, -l0 * 0.48], [w * 2.15, w * 2.0, l0 * 0.66], n + 1, k + 1, 'coat'), orb([0, 0, -l0], w * low, n, k, 'coat'))
    : merge(
      orb([0, 0, -l0 * 0.1], [w * top, w * top, w * top * 1.05], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -l0 * 0.55], [0, 0, -l0]], [w * top * 0.95, w * (top + low) * 0.5, w * low], [w * top * 0.95, w * (top + low) * 0.5, w * low], n, 'coat', { seam: 'start' }),
      orb([0, 0, -l0], w * low, n, k, 'coat'),
    );
  // A band or two of blue mottling round it, as the reference has on its legs.
  const blots: Disc[] = [];
  const count = hind ? 7 : 2;
  for (let q = 0; q < count; q++) {
    const z = -l0 * (0.2 + 0.6 * (q / Math.max(1, count - 1))), a = (q / count) * TAU + jitter(q * 3 + (hind ? 9 : 2)) * 1.2;
    const rr = hind ? w * 2.1 * Math.sqrt(Math.max(0.2, 1 - ((z + l0 * 0.48) / (l0 * 0.66)) ** 2)) : lerp(w * top * 0.95, w * low, -z / l0), nrm: V3 = [Math.cos(a), Math.sin(a), 0];
    blots.push(disc(add([nrm[0] * rr, nrm[1] * rr, z], scale(nrm, 0.01)), nrm, rr * (hind ? 0.62 : 0.6), rr * (hind ? 1.15 : 1.0), 8, 'mark', { up: [0, 0, 1] }));
  }
  // Each laid back onto the leg's own curve, so a spot is a spot on it and not a card standing off it.
  const c: V3 = [0, 0, -l0 * 0.48], R: V3 = [w * 2.15, w * 2.0, l0 * 0.66];
  const onto = (v: V3): V3 => {
    if (hind) { const e = onEgg(c, R, sub(v, c)); return add(e.p, scale(e.n, 0.008)); }
    const rz = clamp(-v[2] / l0), r = lerp(w * top * 0.95, w * low, rz) + 0.008, h = Math.hypot(v[0], v[1]) || 1;
    return [(v[0] / h) * r, (v[1] / h) * r, v[2]];
  };
  return merge(m, paint(blots.map((d) => ({ ...d, v: d.v.map(onto) }))));
}

/** The shin (or forearm), down `-z` from the knee to the heel. */
function lowerOf(L: Leg, l1: number, hind: boolean, n: number): Mesh {
  const w = L.w, a = hind ? 1.0 : 0.9, b = hind ? 0.62 : 0.7;
  const m = tube([[0, 0, w * 0.5], [0, 0, -l1 * 0.55], [0, 0, -l1]], [w * a, w * (a + b) * 0.5, w * b], [w * a, w * (a + b) * 0.5, w * b], n, 'coat', { seam: 'start' });
  const blots: Disc[] = [];
  for (const [z, ang] of (hind ? [[0.35, 1.2], [0.7, -0.6]] : [[0.55, 0.5]]) as Array<[number, number]>) {
    const nrm: V3 = [Math.cos(ang), Math.sin(ang), 0], rr = lerp(w * a, w * b, z);
    blots.push(disc(add([nrm[0] * rr, nrm[1] * rr, -l1 * z], scale(nrm, 0.01)), nrm, rr * 0.55, rr * 1.1, 8, 'mark', { up: [0, 0, 1] }));
  }
  const onto = (v: V3): V3 => { const r = lerp(w * a, w * b, clamp(-v[2] / l1)) + 0.008, h = Math.hypot(v[0], v[1]) || 1; return [(v[0] / h) * r, (v[1] / h) * r, v[2]]; };
  return merge(m, paint(blots.map((d) => ({ ...d, v: d.v.map(onto) }))));
}

/* ---- its water and what holds it ------------------------------------------------------------------ */

/**
 * The water inside a bladder: an egg `r` cut across where its top is, recut every frame to how full it is and how its top is
 * tipped (`bent`), in the bladder's own frame, which is level. Drawn over the clear skin without lines of its own, so it is the
 * skin's own blue gone deeper below the waterline; the band just under its top is a pale sheen, so the waterline is a curved
 * light band round the inside of the ball, seen through the front of it. `k` is how big it is against the skin: the water just
 * inside it, or the deep core of it, darker, that makes the middle of the ball deeper blue than its edges.
 */
const WATER_N = 12, WATER_ROWS = 4;
function waterMesh(r: V3, k: number, band: Mat, body: Mat): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  v.push(...waterPos(r, 0.6, [0, 0], k));
  const N = WATER_N;
  for (let q = 0; q < WATER_ROWS; q++) {
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N, a = q * N + j, b = q * N + j2, c = (q + 1) * N + j2, d = (q + 1) * N + j;
      f.push({ i: [a, b, c, d], m: q === 0 ? band : body });
      want.push(sub(scale(add(add(v[a], v[b]), add(v[c], v[d])), 0.25), [0, 0, 0]));
    }
  }
  f.push({ i: Array.from({ length: N }, (_, j) => j), m: body });
  want.push([0, 0, 1]);
  return mesh(v, woundTo(v, f, want));
}
/** The corners of the water for `fill` and its top tipped forward and to the left (degrees): the rim, rings down the bowl, and its foot. */
function waterPos(r: V3, fill: number, tilt: [number, number], k = 0.985): V3[] {
  const N = WATER_N, out: V3[] = [];
  // The top's way up, tipped; taken into the unit ball the egg is made from, where the cut is a plane at `h` along it.
  const tf = tilt[0] * DEG, tl = tilt[1] * DEG;
  const up = unit([-Math.sin(tl), -Math.sin(tf), 1]);
  const nU = unit([up[0] * r[0], up[1] * r[1], up[2] * r[2]]);
  const h = clamp(fill * 2 - 1, -0.9, 0.92);
  const e1 = unit(cross([0, 1, 0], nU)), e2 = cross(nU, e1);
  const th0 = Math.acos(h);
  for (let q = 0; q <= WATER_ROWS; q++) {
    // The rows bunched toward the top, so the band under the surface is a line and not a stripe.
    const u = q === 0 ? 0 : 0.05 + 0.95 * ((q - 1) / (WATER_ROWS - 1)) ** 1.2;
    const th = lerp(th0, Math.PI * 0.999, q === WATER_ROWS ? 1 : u);
    for (let j = 0; j < N; j++) {
      const ph = (j / N) * TAU;
      const d = add(scale(nU, Math.cos(th)), scale(add(scale(e1, Math.cos(ph)), scale(e2, Math.sin(ph))), Math.sin(th)));
      out.push([d[0] * r[0] * k, d[1] * r[1] * k, d[2] * r[2] * k]);
    }
  }
  return out;
}

/**
 * A bladder's clear skin: a pale glassy blue ball, its edge the palest of it. Over the water, its shine: a big soft highlight on
 * its upper front -- a pale wash with a bright crescent and a spot in it -- and a pale glint of light coming through low on its
 * far side, painted after the water so it lies on top of it.
 */
function skinOf(r: V3, n: number, k: number): Mesh {
  return orb([0, 0, 0], r, n, k, 'shell');
}
function shineOf(r: V3, sd: number): Mesh {
  const out: Disc[] = [];
  const at = (d: V3, lift = 0.01): { p: V3; n: V3 } => { const e = onEgg([0, 0, 0], r, d); return { p: add(e.p, scale(e.n, lift)), n: e.n }; };
  const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg([0, 0, 0], r, v); return add(e.p, scale(e.n, lift)); }) });
  const h = at([-0.25 * sd, 0.45, 0.78]);
  out.push(onto(disc(h.p, h.n, r[0] * 0.42, r[0] * 0.3, 10, 'eyeWhite', { up: [0, 0, 1], spin: -0.5 * sd }), 0.012));
  const arcPts = Array.from({ length: 7 }, (_, q) => { const u = q / 6, a = lerp(-1, 1, u); return at([-0.25 * sd + 0.32 * a, 0.5 + 0.08 * a * sd, 0.72 - 0.1 * a * a], 0.016); });
  const hw = r[0] * 0.075;
  out.push({ ...lineOn(arcPts, arcPts.map((_, q) => hw * Math.sin(Math.PI * (0.1 + 0.8 * q / 6)) ** 0.7), 'glint', 0.016), lit: true });
  const spot = at([0.1 * sd, 0.66, 0.6], 0.018);
  out.push(disc(spot.p, spot.n, r[0] * 0.08, r[0] * 0.08, 7, 'glint', { lit: true }));
  const low = at([0.5 * sd, 0.55, -0.45], 0.012);
  out.push(onto(disc(low.p, low.n, r[0] * 0.3, r[0] * 0.12, 8, 'eyeWhite', { up: [0, 0, 1], spin: 0.4 * sd }), 0.012));
  return paint(out);
}

/** A rope of twisted roots along `pts`, `w` thick (a radius): two browns by turns along it where it is drawn big enough to see them. */
function rope(pts: readonly V3[], w: number, lod: number, o: { start?: boolean; end?: boolean } = {}): Mesh {
  const mat: MatOf = lod ? (k) => (k % 2 ? 'bark' : 'woodDark') : 'bark';
  return tube(pts, w, w, 5, mat, o);
}
/** A ring of rope round `c`, square to `n`, `r` across. */
function ropeRing(c: V3, n: V3, r: number, w: number, lod: number, count = 16): Mesh {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (len3(x) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const pts = Array.from({ length: count + 1 }, (_, q) => add(c, add(scale(x, Math.cos((q / count) * TAU) * r), scale(y, Math.sin((q / count) * TAU) * r))));
  return rope(pts, w, lod, { start: false, end: false });
}
/** A hoop of rope round `c` in the plane of `u` and `v`, `ru` and `rv` its half-widths along them: round an egg that is not a ball. */
function ropeHoop(c: V3, u: V3, v: V3, ru: number, rv: number, w: number, lod: number, count = 18): Mesh {
  const pts = Array.from({ length: count + 1 }, (_, q) => add(c, add(scale(u, Math.cos((q / count) * TAU) * ru), scale(v, Math.sin((q / count) * TAU) * rv))));
  return rope(pts, w, lod, { start: false, end: false });
}
/** A knot of rope: a lump where ropes meet. */
const knot = (c: V3, r: number): Mesh => orb(c, [r, r, r * 0.85], 7, 4, 'bark');

/**
 * What holds its water, by stage, on the trunk: the Puddlehop's bubble, a little puckered neck tied with root to pour from; the
 * Springcarrier's bladders each in a net of rope -- a ring round its middle and a hoop over its top, tied at the crown -- with a
 * spout at its top, tied together over its back and to the front of its shoulders; the Aquavoyager's each in a cage of a ring and
 * two hoops, knotted where they cross, tied over its back.
 */
function gearOf(s: Frog, lod: number): { sides: Mesh[]; back: Mesh | null } {
  const w = 0.06 * Math.max(0.6, Math.min(1.3, bigOf(s)));
  const sides: Mesh[] = [], back: Mesh[] = [];
  const neck = (q: number): Mesh => {
    const B = s.bladders[q], sd = q ? -1 : 1, S = spoutOf(s), d: V3 = [sd * S.d[0], S.d[1], S.d[2]];
    const c: V3 = [sd * Math.abs(B.c[0]), B.c[1], B.c[2]], base = onEgg(c, B.r, d).p, k = 0.6 + 0.4 * bigOf(s);
    // Painted on the skin in the deep blue of the water, a lip low on its front where the water leaves it: a nub standing off the
    // ball, inked round, read as an eye on it.
    const at = add(base, scale(d, 0.01));
    return paint([disc(at, d, 0.07 * k, 0.045 * k, 8, 'shellDark', { up: [0, 0, 1] })]);
  };
  if (s.gear === 0) return { sides: [neck(0)], back: null };
  const R0 = s.bladders[0];
  const top: Array<{ p: V3 }> = [];
  for (const sd of [1, -1]) {
    const c: V3 = [sd * R0.c[0], R0.c[1], R0.c[2]], r = R0.r, g = 1.03, lean = (R0.lean ?? 0) * DEG * sd;
    // One thick ring of rope round it in the plane of its side, holding it as a hoop holds a ball, tied at its top.
    const up: V3 = [Math.sin(lean), 0, Math.cos(lean)];
    const parts: Mesh[] = [ropeHoop(c, [0, 1, 0], up, r[1] * g, r[2] * g, w, lod, 22)];
    const crown = add(c, scale(up, r[2] * g));
    parts.push(knot(crown, w * 1.5));
    top.push({ p: crown });
    if (s.gear === 1) parts.push(neck(sd > 0 ? 0 : 1));
    sides.push(merge(...parts));
  }
  // Tied to each other round the back of its body, low, from the back of one ring to the back of the other, the rope lying on its
  // rump: well under its head from every side.
  const ends = [1, -1].map((sd): V3 => [sd * R0.c[0], R0.c[1] - R0.r[1] * 0.92, R0.c[2] - R0.r[2] * 0.3]);
  const pts: V3[] = [];
  for (let q = 0; q <= 12; q++) {
    const u = q / 12, p = mixV(ends[0], ends[1], u), ring = ringAt(s.body, p[1]);
    const th = Math.atan2((p[2] - ring.z) / ring.h, p[0] / ring.w), on = outer(s, p[1], th, w * 1.2);
    const inside = (p[0] / ring.w) ** 2 + ((p[2] - ring.z) / ring.h) ** 2 < 1.1;
    pts.push(inside ? [on.p[0], on.p[1] - 0.04, on.p[2]] : p);
  }
  back.push(rope(pts, w, lod), knot(pts[6], w * 1.9));
  return { sides, back: merge(...back) };
}

/**
 * The Aquavoyager's pipe: a wooden pipe crossing over the top of its bladders from side to side, bowed up in the middle, bound to
 * the frame at either bladder, each end turned out and down into a flared spout.
 */
function pipeOf(s: Frog): { pts: V3[]; spout: V3; elbow: V3; r: number } {
  const B = s.bladders[0], lean = (B.lean ?? 0) * DEG, r = 0.1 * bigOf(s);
  // Over the crowns of the two bladders, which lean out, and on past them, so its spouts hang out beyond them.
  const crownX = B.c[0] + Math.sin(lean) * B.r[2], top = B.c[2] + Math.cos(lean) * B.r[2] + r * 1.3;
  const x = B.c[0] + B.r[0] * 1.1, y = B.c[1] + B.r[1] * 0.05;
  const pts: V3[] = Array.from({ length: 9 }, (_, q) => { const u = q / 8 * 2 - 1; return [u * Math.max(x, crownX + r), y, top + 0.1 * (1 - u * u)]; });
  // Each end turned out and down through an elbow to a flared spout.
  const ex = Math.max(x, crownX + r);
  return { pts, elbow: [ex + 0.22, y + 0.04, top - 0.05], spout: [ex + 0.45, y + 0.1, top - 0.3], r };
}
function pipeMesh(s: Frog, lod: number): Mesh {
  const P = pipeOf(s), parts: Mesh[] = [], n = cut(lod, 7, 9);
  parts.push(tube(P.pts, P.r, P.r, n, (k) => (k === 1 || k === 6 ? 'woodDark' : 'wood')));
  for (const sd of [1, -1]) {
    const end = P.pts[sd > 0 ? 8 : 0], el: V3 = [sd * P.elbow[0], P.elbow[1], P.elbow[2]], sp: V3 = [sd * P.spout[0], P.spout[1], P.spout[2]];
    const d = unit(sub(sp, el));
    parts.push(tube([end, el, sp], [P.r, P.r * 1.05, P.r * 1.4], [P.r, P.r * 1.05, P.r * 1.4], n, (k) => (k === 2 ? 'woodDark' : 'wood'), { end: false }));
    parts.push(paint([disc(add(sp, scale(d, 0.006)), d, P.r * 1.25, P.r * 1.25, 8, 'woodDark')]));
    // Bound down onto the crown of its bladder: at the point of the pipe nearest over it.
    const B = s.bladders[0], crown = sd * (B.c[0] + Math.sin((B.lean ?? 0) * DEG) * B.r[2]);
    const at = P.pts.reduce((m, p) => (Math.abs(p[0] - crown) < Math.abs(m[0] - crown) ? p : m));
    parts.push(ropeRing(at, [1, 0, 0], P.r * 1.3, P.r * 0.35, lod, 8));
  }
  return merge(...parts);
}

/** Leaves: on the Puddlehop's head a sprout of two, on the bigger ones a spray on the head and on each shoulder, and over the Aquavoyager's pipe three big ones shading it. */
function headLeaves(s: Frog, K: number): Frond[] {
  const H = s.head, C = skullAt(s), out: Frond[] = [];
  const L = [0.46, 0.46, 0][s.stage];
  if (!L) return out;
  const e = onEgg(C, H.r, [0.05, -0.15, 1]), root = add(e.p, scale(e.n, -0.01));
  if (s.stage === 0) {
    // A little stem and two leaves sprouting up and out from it, one each way.
    out.push({ mesh: tube([root, add(root, [0, -0.02, L * 0.25])], 0.012, 0.012, 4, 'stem'), root, out: [0, 0, 1], len: L * 0.25 });
    const top = add(root, [0, -0.02, L * 0.22]);
    out.push({ mesh: leaf(top, unit([0.85, -0.25, 0.45]), unit([0.3, 0.1, 1]), L, L * 0.5, Math.max(K, 4), 'spring', 0.2), root: top, out: [0, 0, 1], len: L });
    out.push({ mesh: leaf(top, unit([-0.75, -0.4, 0.6]), unit([-0.3, 0.1, 1]), L * 0.82, L * 0.44, Math.max(K, 4), 'green', 0.2), root: top, out: [0, 0, 1], len: L * 0.82 });
    return out;
  }
  out.push(...sprig(root, [0, -0.2, 1], [0, -0.75, 0.6], L, Math.max(K, 4), 11, 3, 1.0));
  return out;
}
function shoulderLeaves(s: Frog, K: number): Frond[] {
  const out: Frond[] = [], M = marksOf(s);
  if (s.stage === 0) return out;
  const L = [0, 0.75, 0.72][s.stage];
  // Over each shoulder, hanging forward and down over the top of the arm.
  for (const sd of [1, -1]) {
    const e = s.stage === 1 ? outer(s, lerp(M.y[5], M.y[6], 0.25), Math.PI / 2 - sd * 1.15, -0.02) : outer(s, lerp(M.y[4], M.y[5], 0.75), Math.PI / 2 - sd * 0.95, -0.02);
    const dir: V3 = s.stage === 1 ? [sd * 0.4, 0.85, -0.55] : [sd * 0.45, 0.55, -0.6];
    out.push(...sprig(e.p, e.n, dir, L, Math.max(K, 4), 30 + (sd > 0 ? 0 : 5), s.stage === 2 ? 4 : 3, 0.5));
  }
  if (s.gear === 2) {
    // And leaves hanging from its collar round the front of its chest.
    for (const [q, a] of [-1.2, -0.6, 0, 0.6, 1.2].entries()) {
      const p = collarPt(s, a);
      out.push(...sprig(p, unit([Math.sin(a), Math.cos(a) * 0.6, 0.2]), [Math.sin(a) * 0.3, 0.35, -1], L * 0.6, Math.max(K, 4), 80 + q, 1));
    }
  }
  return out;
}
function canopy(s: Frog, K: number): Frond[] {
  if (s.gear !== 2) return [];
  const P = pipeOf(s), B = s.bladders[0], out: Frond[] = [], mid = add(P.pts[4], [0, -P.r * 1.5, P.r * 4]);
  const crown = B.c[2] + Math.cos((B.lean ?? 0) * DEG) * B.r[2], L = 1.4 * bigOf(s);
  K = Math.max(K, 5);
  // A green roof: four wide leaves lying nearly flat, rooted just behind and over the middle of the pipe and fanned out sideways
  // over the frame to the bladders' crowns, their tips drooping to just under them -- none back over the bladders, which show under. Each leaf's
  // face turned up, so the camera, which is high, sees leaves and not their edges from every side; none crosses the pipe's front.
  const fan: Array<[number, number, number, Tone]> = [[0.97, -0.24, 0.9, 'green'], [-0.97, -0.24, 0.9, 'deep'], [0.8, -0.38, 0.6, 'spring'], [-0.8, -0.38, 0.6, 'spring']];
  fan.forEach(([dx, dy, k, tone]) => {
    const len = L * k, drop = mid[2] - (crown - 0.05);
    const d = unit([dx, dy, -drop / len]);
    out.push({ mesh: leaf(mid, d, unit([0.15 * dx, 0.15 * dy, 1]), len, len * 0.45, K, tone, 0.3, 0.62, 0.25), root: mid, out: [0, 0, 1], len });
  });
  return out;
}

/** A leaf hanging down the outer side of each of the Aquavoyager's bladders, from where its rope ties on at the top, face out. */
function sideLeaf(s: Frog, sd: number, K: number): Frond[] {
  if (s.gear !== 2) return [];
  const B = s.bladders[0], lean = (B.lean ?? 0) * DEG, len = 1.55 * bigOf(s) * 0.45;
  const root: V3 = [sd * (B.c[0] + Math.sin(lean) * B.r[2] * 0.8 + B.r[0] * 0.35), B.c[1] + B.r[1] * 0.1, B.c[2] + Math.cos(lean) * B.r[2] * 0.75];
  const d = unit([sd * 0.45, 0.15, -1]);
  return [{ mesh: leaf(root, d, unit([sd, 0, 0.35]), len, len * 0.35, Math.max(K, 5), sd > 0 ? 'green' : 'deep', 0.18, 0.62, 0.25), root, out: [sd, 0, 0], len }];
}

/** The Aquavoyager's collar: a rope round the root of its neck in front of its shoulders, with a tie at the front, in the trunk's frame. */
/** A point on the Aquavoyager's collar, `a` round from the front, in the trunk's frame: round its chest under its head, level in the world. */
function collarPt(s: Frog, a: number): V3 {
  const H = s.head, c = add(H.at, [0, H.fwd * 0.1, -0.45]), t = -s.tilt * DEG;
  const p: V3 = [Math.sin(a) * H.r[0] * 1.02, Math.cos(a) * H.r[1] * 0.95, -0.12 * H.r[2] * (0.5 + 0.5 * Math.cos(a))];
  return add(c, [p[0], p[1] * Math.cos(t) - p[2] * Math.sin(t), p[1] * Math.sin(t) + p[2] * Math.cos(t)]);
}
function collarOf(s: Frog, lod: number): Mesh {
  const w = 0.077 * bigOf(s);
  const pts = Array.from({ length: 19 }, (_, q) => collarPt(s, (q / 18) * TAU));
  return merge(rope(pts, w, lod, { start: false, end: false }), knot(pts[3], w * 1.6), knot(pts[15], w * 1.6));
}


/** How the leaves rustle: lifted as it goes, a beat behind each step; bristling at a strike; grown in as it evolves. */
function rustling(s: Frog, f: Fronds, len: number, phase: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    let lift = 0.04 * cyc(a.t, 6, phase) * (1 - Math.min(1, a.go)), grow = 1;
    let bounce = a.go > 0 ? smooth(Math.min(1, a.go)) * (0.06 + 0.1 * a.gait) * Math.sin(frac(a.u) * TAU * 2 - 1.6 - phase) : 0;
    const act = a.act;
    if (act?.kind === 'strike') {
      const hit = FROG_HITS[s.stage];
      bounce += 0.12 * hump(act.t, hit + 0.06, 0.1) * Math.sin((act.t - hit) * 50);
    } else if (act?.kind === 'evolve') {
      lift += 0.15 * hump(act.t, 0.5, 0.25);
      grow = 0.55 + 0.45 * ramp(act.t, 0.04, 0.5) + 0.12 * hump(act.t, 0.54, 0.08);
    }
    if (!lift && !bounce && grow === 1) return v as V3[];
    return v.map((p, i) => {
      const k = f.w[i] * len, R = f.root[i];
      const q: V3 = grow === 1 ? p : add(R, scale(sub(p, R), grow));
      return [q[0] + f.out[i][0] * lift * k, q[1] + f.out[i][1] * lift * k, q[2] + f.out[i][2] * lift * k + bounce * k];
    });
  };
}

/** The bucket it pours into: a little tub of staves, two bands of root round it, water inside; in its own frame, on the ground. */
const bucketHeight = (s: Frog): number => [0.3, 0.46, 0.58][s.stage];
const bucketRadius = (s: Frog): number => [0.2, 0.3, 0.38][s.stage];
function bucketOf(s: Frog, lod: number): Mesh {
  const h = bucketHeight(s), r = bucketRadius(s), n = cut(lod, 9, 12);
  const wall = tube([[0, 0, 0], [0, 0, h]], [r * 0.86, r], [r * 0.86, r], n, (_k, j) => (j % 2 ? 'wood' : 'woodDark'), { end: false });
  const inner0 = tube([[0, 0, h * 0.75], [0, 0, h * 0.98]], [r * 0.9, r * 0.95], [r * 0.9, r * 0.95], n, 'woodDark', { start: false, end: false });
  const inner = mesh(inner0.v, inner0.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
  const water = paint([disc([0, 0, h * 0.76], [0, 0, 1], r * 0.9, r * 0.9, n, 'water')]);
  const bands = [0.22, 0.78].map((k) => tube(Array.from({ length: n + 1 }, (_, q) => [Math.cos((q / n) * TAU) * r * (0.89 + 0.12 * k), Math.sin((q / n) * TAU) * r * (0.89 + 0.12 * k), h * k] as V3), r * 0.06, r * 0.06, 4, 'bark', { start: false, end: false }));
  return merge(wall, inner, water, ...bands);
}

/* ---- a stage's pieces --------------------------------------------------------------------------- */

/** Its bones standing, worked out once for a stage: what its legs' cream undersides are found from. */
const restBoneCache = new Map<Frog, Bones>();
function restBones(s: Frog): Bones {
  let b = restBoneCache.get(s);
  if (!b) restBoneCache.set(s, (b = frogBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 })));
  return b;
}

function frogBuild(s: Frog, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), K = lod ? 5 : 3, R = restOf(s);
  const rest = restBones(s);
  const pieces: Piece[] = [];
  const rustled = (key: string, f: Fronds, bone: string, len: number, phase: number, extra: Partial<Piece>): Piece =>
    ({ key, mesh: f.mesh, bone, bent: rustling(s, f, len, phase), ...extra });
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 3), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.03 } });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, false), shut: headOf(s, n, true), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.19, after: ['head'], lines: false });
  pieces.push({ key: 'throat', mesh: throatOf(s, n), bone: 'throat', bias: 0.18, after: ['body'], under: ['jaw'], lines: false, shown: (a) => !a.act || a.act.kind !== 'strike' || s.stage !== 0 });
  if (s.stage === 0) {
    const T = tongueOf(s);
    pieces.push({ key: 'tongue', mesh: T.rope, bone: 'tongue', bias: 0.25, after: ['jaw', 'head'] });
    pieces.push({ key: 'tongueTip', mesh: T.tip, bone: 'tongueTip', bias: 0.26, after: ['tongue', 'jaw', 'head'] });
  }
  const hl = headLeaves(s, K);
  if (hl.length) pieces.push(rustled('sprout', fronds(hl), 'head', 0.3, 1.2, { bias: 0.22, after: ['head'] }));
  // Legs: the near side's over the body, the far side's under it.
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = legOfI(s, i), [l0, l1] = R.legs[i];
    const front: V3 = [side, fore ? 0.25 : -0.1, 0];
    const foot = side > 0 ? footOf(s, L, R.heel[i], !fore, n) : mirroredMesh(footOf(s, L, R.heel[i], !fore, n));
    // Sorted by where they are against the body, which they are out to the side of: a near thigh over the flank, a far one under it.
    void front;
    pieces.push(
      { key: `${key}0`, mesh: creamUnder(upperOf(s, L, l0, !fore, n, k), rest[`${key}0`], 0.45), bone: `${key}0`, bias: fore ? 0.02 : 0.01 },
      { key: `${key}1`, mesh: creamUnder(lowerOf(L, l1, !fore, n), rest[`${key}1`], fore ? 0.6 : 0.35), bone: `${key}1`, bias: 0.02 },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.015 },
    );
  }
  // Its water: each bladder's skin, the water in it, and its shine over both.
  s.bladders.forEach((B, q) => {
    const bone = q ? 'bladL' : s.bladders.length > 1 ? 'bladR' : 'bladC', sd = q ? -1 : 1, key = bone;
    // Over the whole of the legs on its side, seen from that side: the haunch folded under it does not come up through it.
    const near = sd > 0 ? ['fr0', 'fr1', 'hr0', 'hr1'] : ['fl0', 'fl1', 'hl0', 'hl1'];
    pieces.push({ key, mesh: skinOf(B.r, n + 2, k + 1), bone, bias: 0.05, front: [sd * (s.bladders.length > 1 ? 1 : 0), -0.3, 0.4], after: ['body', ...(s.bladders.length > 1 ? near : [])] });
    pieces.push({
      key: `${key}W`, mesh: waterMesh(B.r, 0.985, 'eyeWhite', 'water'), bone, bias: 0.051, after: [key], lines: false,
      bent: (_v, a) => { const W = waterNow(s, a); return waterPos(B.r, W.fill, [W.tilt[0], W.tilt[1] + leanOf(s, q)], 0.985); },
    });
    pieces.push({
      key: `${key}C`, mesh: waterMesh(B.r, 0.7, 'shellDark', 'shellDark'), bone, bias: 0.0515, after: [key, `${key}W`], lines: false,
      bent: (_v, a) => { const W = waterNow(s, a); return waterPos(B.r, W.fill, [W.tilt[0], W.tilt[1] + leanOf(s, q)], 0.7); },
    });
    pieces.push({ key: `${key}S`, mesh: shineOf(B.r, s.bladders.length > 1 ? sd : 1), bone, bias: 0.052, after: [key, `${key}W`, `${key}C`], lines: false });
  });
  const bl = s.bladders.map((_, q) => (q ? 'bladL' : s.bladders.length > 1 ? 'bladR' : 'bladC'));
  const blAll = bl.flatMap((b) => [b, `${b}W`, `${b}C`, `${b}S`]);
  const ropeHide = s.bladders.map((B) => ({ c: B.c, r: scale(B.r, 0.97) }));
  // The body hides a rope round the far bladder where the body is between it and the viewer.
  const bodyHide = { c: [0, 0, 0] as V3, r: [marksOf(s).w[3] * 0.95, (marksOf(s).y[6] - marksOf(s).y[0]) * 0.47, marksOf(s).h[3] * 0.95] as V3 };
  const faceKeys = ['head', 'jaw', 'throat', 'sprout'];
  const G = gearOf(s, lod);
  // The ring round each bladder outlined at half the width, in a darker brown of its own, so it holds the ball without caging it.
  G.sides.forEach((m, q) => pieces.push({ key: `${bl[q]}G`, mesh: m, bone: 'trunk', bias: 0.053, after: [bl[q], `${bl[q]}W`, `${bl[q]}C`, `${bl[q]}S`], hide: [ropeHide[q], bodyHide], thin: true }));
  if (G.back) pieces.push({ key: 'gear', mesh: G.back, bone: 'trunk', bias: 0.02, under: faceKeys, hide: ropeHide, thin: true });
  if (s.gear === 2) {
    pieces.push({ key: 'collar', mesh: collarOf(s, lod), bone: 'trunk', bias: 0.07, after: ['body'], under: faceKeys });
    // The leaves behind and over the pipe: under it seen from in front, over it and the bladders seen from behind.
    pieces.push({ key: 'pipe', mesh: pipeMesh(s, lod), bone: 'trunk', bias: 0.08, after: ['body', 'gear', ...blAll, ...bl.map((b) => `${b}G`)] });
    pieces.push(rustled('canopy', fronds(canopy(s, K)), 'trunk', 0.8, 0.4, { bias: 0.075, after: ['pipe', 'gear', ...blAll, ...bl.map((b) => `${b}G`)], front: [0, -1, 0.3] }));
    // A leaf down the outside of each bladder, over it seen from its side and under it from the other.
    bl.forEach((b, q) => pieces.push(rustled(`${b}L`, fronds(sideLeaf(s, q ? -1 : 1, K)), 'trunk', 0.5, 0.9 + q, { bias: 0.076, after: [b, `${b}W`, `${b}C`, `${b}S`, `${b}G`, 'pipe'], front: [q ? -1 : 1, 0, 0] })));
  }
  const sl = shoulderLeaves(s, K);
  if (sl.length) pieces.push(rustled('shoulders', fronds(sl), 'trunk', 0.4, 0.7, { bias: 0.07, after: ['body', ...(s.gear === 2 ? ['collar'] : [])], under: faceKeys }));
  pieces.push({ key: 'bucket', mesh: bucketOf(s, lod), bone: 'site', bias: 0 });
  if (s.gear) pieces.push({ key: 'bucketL', mesh: bucketOf(s, lod), bone: 'siteL', bias: 0 });
  return pieces;
}

/**
 * A leg's underside cream, as a frog's is: every facet turned down more than `below` (the down of its normal, standing) and every
 * facet turned in toward the body painted the belly's colour, the mottling on it left as it was.
 */
function creamUnder(m: Mesh, xf: Xf, below: number): Mesh {
  const side = Math.sign(xf.t[0]) || 1;
  const faces = m.f.map((f) => {
    if (f.decal || f.m !== 'coat' || f.i.length < 3) return f;
    const a = m.v[f.i[0]], b = m.v[f.i[1]], c = m.v[f.i[2]], nl = unit(cross(sub(b, a), sub(c, a))), n = turn(xf, nl);
    return n[2] < -below || n[0] * side < -0.55 ? { ...f, m: 'belly' as Mat } : f;
  });
  // The cream painted over again flat, under the mottling, so the underside is cream from above and not a lavender shade.
  const solid = faces.filter((f) => !f.decal), cream: Face[] = solid.filter((f) => f.m === 'belly').map((f) => ({ ...f, decal: true }));
  return mesh(m.v, [...solid, ...cream, ...faces.filter((f) => f.decal)]);
}

/** A mesh mirrored left for right, its faces wound back the right way out. */
const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const WATER_RGB: RGB = [112, 184, 230], WATER_DEEP: RGB = [52, 104, 170], WATER_LIGHT: RGB = [214, 240, 252], WATER_INK: RGB = [36, 62, 104];
const DUST: RGB = [204, 186, 156];
const LEAF_RGB: readonly RGB[] = [[132, 172, 80], [178, 204, 112], [96, 138, 64]];

/** Where something thrown from `p` with velocity `v` is `t` seconds on; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How fast water leaves a stage's spout, in its units a second. */
const streamSpeed = (s: Frog): number => [1.3, 2.3, 1.9][s.stage];
const GRAVITY = 9;
/** Where a stream from `p` going `d` at `v` comes down to height `h`. */
function streamAt(p: V3, d: V3, v: number, h: number): V3 {
  const vz = d[2] * v, a = 0.5 * GRAVITY, c = p[2] - h;
  const t = (vz + Math.sqrt(Math.max(0, vz * vz + 4 * a * c))) / (2 * a);
  return [p[0] + d[0] * v * t, p[1] + d[1] * v * t, h];
}

/** The size of a pixel in the canvas's own units, for things drawn by hand. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };

/** A drop of water: a round blue bead with a light glint and an inked edge, never under a pixel and a half across. */
function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, stretch = 1): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.15 * px);
  g.fillStyle = css(WATER_INK, al);
  g.beginPath();
  g.ellipse(x, y, r + 0.5 * px, r * stretch + 0.5 * px, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(WATER_RGB, al);
  g.beginPath();
  g.ellipse(x, y, r, r * stretch, 0, 0, TAU);
  g.fill();
  if (r > 1.2 * px) {
    g.fillStyle = css(WATER_LIGHT, al);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.35 * stretch, r * 0.35, 0, TAU);
    g.fill();
  }
}

/** A puff of dust off the ground. */
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

/** A flat ring of water on the ground at `c`, `r` across, its rim darker, as a puddle or a splash spreading; `al` its strength. */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, r: number, fill: RGB | null, rim: RGB, al: number, width: number): void {
  if (al <= 0.01 || r <= 0) return;
  const pts = Array.from({ length: 20 }, (_, q) => onScreen(view, [c[0] + Math.cos((q / 20) * TAU) * r, c[1] + Math.sin((q / 20) * TAU) * r, c[2]]));
  g.beginPath();
  pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) { g.fillStyle = css(fill, al); g.fill(); }
  g.strokeStyle = css(rim, al);
  g.lineWidth = width;
  g.stroke();
}

/** Drops thrown from `from`, `since` seconds after, out and up, falling; each drawn in front of the body or behind it, and a ring where it lands. */
function splash(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.55, dir: V3 = [0, 0, 0]): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.7 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp + dir[0], Math.sin(a) * sp + dir[1], up * (0.6 + 0.7 * jitter(k + 2))];
    const p = thrown(from, v, since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    drop(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), 1 - smooth((since - life * 0.6) / (life * 0.4)), 1.15);
  }
}

/**
 * Drips: now and then a bead of water swells under a bladder and falls, and from the Aquavoyager's spouts more often; going, more
 * of them, shaken off. Each drawn on the side of the body it is on.
 */
function drips(g: CanvasRenderingContext2D, view: View, s: Frog, b: Bones, a: Anim, front: boolean): void {
  const mid = b.body.t, every = a.go > 0 ? 0.7 : 2.6;
  const sources: Array<{ p: V3; k: number }> = [];
  s.bladders.forEach((B, q) => {
    const bone = b[q ? 'bladL' : s.bladders.length > 1 ? 'bladR' : 'bladC'];
    if (bone) sources.push({ p: place(bone, [B.r[0] * 0.35 * (q ? -1 : 1), -B.r[1] * 0.2, -B.r[2] * 0.95]), k: q });
  });
  if (s.gear === 2) {
    const P = pipeOf(s);
    for (const sd of [1, -1]) sources.push({ p: place(b.trunk, [sd * P.spout[0], P.spout[1], P.spout[2] - P.r]), k: sd > 0 ? 5 : 6 });
  }
  const size = 0.035 * (0.6 + 0.4 * bigOf(s));
  for (const src of sources) {
    const per = src.k >= 5 ? 1.1 : every, off = jitter(src.k * 3 + 1) * per;
    const u = frac((a.t + off) / per) * per;
    // Swelling for the first half, then let go and falling.
    if (!nearSide(src.p, mid, view) !== !front) continue;
    if (u < 0.35) {
      const [x, y] = onScreen(view, src.p);
      drop(g, x, y + size * 0.6 * (u / 0.35), size * (0.4 + 0.6 * u / 0.35), 0.9, 1.2);
    } else {
      const ft = u - 0.35, p: V3 = [src.p[0], src.p[1], src.p[2] - 0.5 * GRAVITY * ft * ft];
      if (p[2] > 0.02) {
        const [x, y] = onScreen(view, p);
        drop(g, x, y, size, 0.9, 1.4);
      } else if (ft < 0.9) {
        const land = Math.sqrt(2 * src.p[2] / GRAVITY), age = (ft - land) / 0.35;
        if (age >= 0 && age < 1) groundRing(g, view, [src.p[0], src.p[1], 0.01], size * (1 + 3 * age), null, WATER_RGB, 0.8 * (1 - age), pxOf(g) * 1.2);
      }
    }
  }
}

/** The stream pouring from its spout into the bucket: a fall of water, blue with a light core and an inked edge, beads at its foot. */
function stream(g: CanvasRenderingContext2D, view: View, s: Frog, b: Bones, t: number, k: number, sd = 1): void {
  const W = FROG_WORK, on = ramp(t, W.pour[0] - 0.02, W.pour[0] + 0.04) * (1 - ramp(t, W.pour[1] - 0.06, W.pour[1] + 0.02)) * k;
  if (on <= 0.02) return;
  // From the spout to the middle of the bucket's mouth, as a thrown thing goes: out of the spout the way it points, and falling.
  const S = spoutOf(s), from = place(b.trunk, sided(S.p, sd)), site = sites.get(s), h = (site?.h ?? 0.3) * 0.85;
  const to: V3 = site ? sided(site.bucket, sd) : add(from, [sd * 0.5, 0, -from[2]]);
  const T = 0.32, vel: V3 = [(to[0] - from[0]) / T, (to[1] - from[1]) / T, (h - from[2] + 0.5 * GRAVITY * T * T) / T];
  const pts: Array<[number, number]> = [];
  for (let q = 0; q <= 12; q++) {
    const tt = (q / 12) * T;
    pts.push(onScreen(view, [from[0] + vel[0] * tt, from[1] + vel[1] * tt, from[2] + vel[2] * tt - 0.5 * GRAVITY * tt * tt]));
  }
  const px = pxOf(g), w = Math.max(3 * px, 0.24 * bigOf(s) * (0.4 + 0.6 * on));
  const path = (): void => { g.beginPath(); pts.forEach(([x, y], q) => (q ? g.lineTo(x, y) : g.moveTo(x, y))); };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  path(); g.strokeStyle = css(WATER_INK, 0.95); g.lineWidth = w + 1.4 * px; g.stroke();
  path(); g.strokeStyle = css(WATER_RGB, 1); g.lineWidth = w; g.stroke();
  path(); g.strokeStyle = css(WATER_LIGHT, 0.9); g.lineWidth = Math.max(0.6 * px, w * 0.3); g.stroke();
  // Beads jumping out of the bucket where it lands.
  const end = pts[pts.length - 1];
  for (let q = 0; q < 3; q++) {
    const ph = frac(t * 9 + q / 3), r = 0.03 * bigOf(s);
    drop(g, end[0] + (jitter(q) - 0.5) * 0.25 * bigOf(s) * 10 * px * ph, end[1] - 0.2 * bigOf(s) * 9 * px * Math.sin(Math.PI * ph), r, 0.9 * on * (1 - ph));
  }
}

/** The puddle in front of it as it works: a pool of water on the ground, its rim darker, rings spreading from its chin at each gulp. */
function puddle(g: CanvasRenderingContext2D, view: View, s: Frog, t: number, k: number): void {
  const site = sites.get(s);
  if (!site || k <= 0.01) return;
  const r = 0.55 * bigOf(s) * (0.4 + 0.6 * k), c = site.puddle, px = pxOf(g);
  groundRing(g, view, c, r, [150, 206, 236], WATER_DEEP, 0.9 * k, 1.2 * px);
  groundRing(g, view, [c[0] + r * 0.2, c[1] + r * 0.15, c[2]], r * 0.45, [196, 230, 248], [196, 230, 248], 0.6 * k, 0.5 * px);
  for (const gt of FROG_WORK.gulps) {
    const age = (t - gt + 0.02) / 0.3;
    if (age > 0 && age < 1) groundRing(g, view, [c[0], c[1] - r * 0.25, c[2]], r * (0.15 + 0.6 * age), null, WATER_LIGHT, 0.9 * (1 - age) * k, 1.1 * px);
  }
}

/** What a strike throws: water out of its bladders at the blow, dust where its hands or belly come down. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Frog, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid = b.body.t, since = (t - FROG_HITS[s.stage]) * ACT_SECS.strike;
  if (s.stage === 0) {
    if (since > 0) for (const leg of ['fl2', 'fr2']) {
      const f = place(b[leg], [0, 0, 0]);
      if (nearSide(f, mid, view) === front) puff(g, view, [f[0], f[1], 0.05], 0.18 * big, since / 0.4, leg === 'fl2' ? 3 : 4);
    }
    return;
  }
  if (since <= 0) return;
  s.bladders.forEach((B, q) => {
    const bone = b[q ? 'bladL' : 'bladR'];
    if (!bone) return;
    const top = place(bone, [0, 0, B.r[2] * 0.6]), out = q ? -1 : 1;
    const fling: V3 = s.stage === 2 ? [-1.6 * out * 0.4 + 1.2, 0.6, 0] : [out * 0.6, 0.8, 0];
    splash(g, view, mid, top, since, front, 5 + 2 * s.stage, 20 + q * 11, 0.8 * big, 2.6, 0.045 * big, 0.5, fling);
  });
  if (s.stage === 1) {
    const chest = place(b.trunk, [0, marksOf(s).y[5], -marksOf(s).h[5] * 0.8]);
    for (const sd of [-1, 1]) {
      const p: V3 = [chest[0] + sd * 0.4 * big * (1 + 1.5 * ramp(since, 0, 0.3)), chest[1] + 0.1, 0.08];
      if (nearSide(p, mid, view) === front) puff(g, view, p, 0.4 * big, since / 0.5, 7 + sd);
    }
  } else {
    const st = (t - FROG_STRIKE.stamp) * ACT_SECS.strike;
    const f = place(b.fr2, [0, 0, 0]);
    if (st > 0) for (const sd of [-1, 1]) {
      const p: V3 = [f[0] + sd * 0.3 * big * (1 + 2 * ramp(st, 0, 0.3)), f[1], 0.08];
      if (nearSide(p, mid, view) === front) puff(g, view, p, 0.4 * big, st / 0.5, 12 + sd);
    }
  }
}

/** Evolving: a burst of water off it at the start, then drops and leaves spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Frog, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], M = marksOf(s);
  if (t < 0.3) splash(g, view, mid, place(b.trunk, [0, 0, M.h[3] * 0.8]), t * ACT_SECS.evolve, front, 18, 5, 1.4 * big, 3.2, 0.045 * big, 0.55);
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = M.w[3] * 1.6 + 0.3 * big, ry = lenOf(s) * 0.9 + 0.3 * big, high = M.h[3] * 2.4 + 0.8 * big;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32), ang = (q / 18) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -M.h[3] * 0.3 + u * high * 0.7]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3 === 0) {
      const c = LEAF_RGB[q % 3], r = 0.1 * big;
      g.fillStyle = css(c, swirl);
      g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), swirl);
      g.lineWidth = Math.max(pxOf(g) * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.45, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    } else drop(g, x, y, 0.05 * big * (1 - 0.4 * u), swirl * ramp(u, 0, 0.15), 1.1);
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function frogKind(look: Frog): Kind {
  const s: Frog = { ...look, body: rounded(look.body), marks: look.body };
  const bones = frogBones(s);
  return {
    bones,
    build: (lod) => frogBuild(s, lod),
    // The variant's coat tints its green and its markings its blue mottling, a little; its cream, its water, its rope and leaves
    // and its amber eyes are the same on every variant, so every one is a green frog carrying clear water.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const green = mix([132, 158, 64], pastel(coat, 140), 0.12 * clamp(sat(coat) / 0.3));
      const blue = mix([80, 150, 175], pastel(mark, 210), 0.12 * clamp(sat(mark) / 0.3));
      return coatPalette(coat, mark, {
        coat: green,
        coatDark: mix(green, [44, 60, 52], 0.25),
        coatLight: mix(green, [240, 246, 214], 0.3),
        mark: blue,
        spot: mix(blue, [30, 70, 110], 0.35),
        belly: [244, 226, 186],
        muzzle: [246, 232, 198],
        inner: [186, 92, 96],
        tongue: [236, 128, 140],
        nose: [58, 72, 44],
        lid: [70, 52, 36],
        eye: [36, 24, 22],
        glint: [255, 254, 248],
        crystal: [238, 152, 50],
        crystalDark: [196, 104, 34],
        pad: [196, 158, 104],
        membrane: [92, 164, 196],
        shell: [160, 208, 232],
        water: [112, 190, 228],
        shellDark: [70, 146, 204],
        eyeWhite: [200, 236, 248],
        gem: [64, 152, 196],
        bark: [172, 124, 74],
        wood: [176, 122, 70],
        woodDark: [112, 74, 42],
        leaf: [128, 164, 72],
        stem: [108, 146, 62],
        leafDark: [80, 116, 50],
        moss: [164, 190, 96],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [lenOf(s) * 0.9 + 0.1, s.hind.at[0] * 1.05],
    stride: 1.2,
    size: s.size,
    acts: ['strike', 'work'],
    leaps: [false, true],
    motes: [[120, 190, 236], [170, 206, 110]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      const working = act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
      if (working) {
        const t = act?.kind === 'work' ? act.t : 0.3, k = act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
        if (under) puddle(g, view, s, t, k);
        // Each stream in front of the body unless the side it pours on is turned away from the viewer.
        for (const sd of pourSides(s)) if ((dot(turn(b.trunk, [sd, 0, 0]), view.T) > -0.2) === !under) stream(g, view, s, b, t, k, sd);
      }
      drips(g, view, s, b, a, front);
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const PUDDLEHOP = frogKind(PUDDLEHOP_LOOK);
export const SPRINGCARRIER = frogKind(SPRINGCARRIER_LOOK);
export const AQUAVOYAGER = frogKind(AQUAVOYAGER_LOOK);
