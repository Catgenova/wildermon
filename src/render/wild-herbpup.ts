import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, dot, drift, eyes, frac, lerp, merge, mix, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type MatOf, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The herb line: the Herbpup, a small fox kit, cream and moss green -- green mottled over its back, head and tail, its face,
 * chest and belly cream -- with very large ears pink-brown inside, big amber eyes, an open happy mouth and dark brown paws, a
 * tuft of leaves sprouting on top of its head, a garland of leaves and little pink flowers round its neck, a tiny brown satchel
 * at its side and a bushy tail, leafy green at its root and cream to its end, with a pink flower in it; which grows into the
 * Herbfox, slender and long and standing tall, a sprig of leaves between its tall ears, a cream ruff on its chest, a mantle of
 * long green leaves fanning up and back off its shoulders and along its back with a big pink blossom and little yellow
 * flowers, a leather saddle-bag on its flank spilling flowers and a big cream tail with green fronds; and then the Herbwarden,
 * large and stately, its head held high under a crown of leaves, a sprig of wheat and a pink blossom, a full cream ruff edged
 * in green leaves, a great mantle of leaves along its back, saddle-bags on both flanks holding a bouquet of lavender and pink
 * and cream blossom, two round vials of amber tonic hanging from them, a cream banner with a green leaf on it hanging under
 * them, leaf-and-flower wraps tied with cord round its forelegs, and three plumed cream tails with green fronds sweeping back.
 * The species is still `salva` underneath, as the database knows it: the dresser of hurts.
 *
 * Built on the ember line's fox (`./wild-ember`): one set of functions from a description of each stage (`Herb`), every foot
 * given a point to be at and its leg bent to reach it. Its front is `y`, its right `x`, up `z`.
 *
 * At its task it holds a poultice of leaves bound with a strip of cloth in its mouth, reaches its head out to the one it is
 * dressing and presses it on twice, a fore paw patting it down with it, then winds the strip round, its head going from side
 * to side; bits of leaf fall from the poultice at every press.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Herb {
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
  /** The muzzle: how long, wide and deep at its root. */
  snout: { len: number; w: number; h: number };
  eye: { dir: V3; size: number };
  /** The right ear on the skull: root, length, half-width, splay out, laid back, hollow turned out. */
  ear: { at: V3; len: number; w: number; splay: number; back: number; turn: number };
  /** The ruff's egg on the chest, and its locks: how long, how many rows, how many across. */
  ruff: { c: V3; r: V3; len: number; rows: number; across: number };
  /** How far its mouth is open: the kit's happy one; nought shut. */
  mouth: number;
  /** What grows between its ears: a tuft of leaves, a sprig, or a crown with wheat and blossom. */
  top: 'tuft' | 'sprig' | 'crown';
  /** The kit's garland of leaves and little flowers round its neck. */
  garland: boolean;
  /** The leaves over its neck and shoulders, hanging down as a cape; how long, nought for none. */
  mane: number;
  /** The mantle of leaves along its back: from and to along it, rows, the longest leaf, how high the middle rises (degrees). */
  mantle: { from: number; to: number; rows: number; len: number; rise: number } | null;
  /** Its tails: their root, how many and how far apart (degrees), each one's links and girths, lifted and curled. */
  tails: { at: V3; n: number; spread: number; links: number[]; w: number[]; lift: number; curl: number };
  /** Its bags: along the body, their half-sizes (out, along, up), on both flanks, and what they hold. */
  bags: { y: number; r: V3; both: boolean; small: boolean; flowers: number; bouquet: boolean };
  /** Round vials of tonic hanging from the right bag; a banner under the bags; wraps round the forelegs. */
  vials: number; banner: boolean; wraps: boolean;
  /** Big pink blossoms on its back, and how many yellow flowers with them. */
  blossoms: number; yellows: number;
  /** Green mottles over its coat. */
  mottles: number;
  gait: { duty: [number, number]; swing: [number, number]; step: number; bob: number };
  size: number;
}

/** A Herbpup: a small fox kit, a big head, very large ears, a tuft of leaves, a garland, a satchel and a bushy tail. */
const HERBPUP_LOOK: Herb = {
  stage: 0,
  body: { y: [-0.78, -0.68, -0.4, 0, 0.36, 0.62, 0.76], z: [0.08, 0.07, 0.04, 0, 0.04, 0.08, 0.12], w: [0.24, 0.38, 0.42, 0.4, 0.42, 0.4, 0.26], h: [0.26, 0.4, 0.44, 0.42, 0.46, 0.44, 0.3] },
  len: 1.1, hip: 0.64, drop: 0.3,
  fore: [0.3, 0.28, 0.11], hind: [0.36, 0.29, 0.24], thick: 0.16, slope: [12, 22], paw: 0.13, stance: [-0.08, 0.1],
  high: 0.76,
  neck: { at: [0, 0.6, 0.28], len: 0.3, w: 0.27, lean: 18 },
  head: { r: [0.47, 0.49, 0.44], up: 0.12, pitch: 2 },
  snout: { len: 0.34, w: 0.19, h: 0.17 },
  eye: { dir: [0.5, 0.76, 0.3], size: 0.135 },
  ear: { at: [0.24, -0.12, 0.28], len: 1.0, w: 0.52, splay: 38, back: 4, turn: 28 },
  ruff: { c: [0, 0.64, 0.08], r: [0.38, 0.3, 0.32], len: 0.2, rows: 2, across: 6 },
  mouth: 1,
  top: 'tuft',
  garland: true,
  mane: 0,
  mantle: null,
  tails: { at: [0, -0.74, 0.3], n: 1, spread: 0, links: [0.32, 0.32, 0.32, 0.28, 0.22, 0.16], w: [0.18, 0.32, 0.4, 0.38, 0.26, 0.12], lift: 48, curl: 26 },
  bags: { y: -0.05, r: [0.11, 0.19, 0.15], both: false, small: false, flowers: 0, bouquet: false },
  vials: 0, banner: false, wraps: false,
  blossoms: 0, yellows: 0,
  mottles: 10,
  gait: { duty: [0.62, 0.42], swing: [0.3, 0.36], step: 0.2, bob: 0.04 },
  size: 3.6,
};

/** A Herbfox: slender and long, standing tall, a sprig between tall ears, a ruff, a mantle of long leaves, a saddle-bag, a great tail. */
const HERBFOX_LOOK: Herb = {
  stage: 1,
  body: { y: [-1.16, -1.04, -0.68, -0.1, 0.48, 0.86, 1.06, 1.16], z: [0.08, 0.08, 0.1, 0.1, 0.08, 0.02, 0.04, 0.08], w: [0.24, 0.36, 0.38, 0.34, 0.38, 0.42, 0.38, 0.24], h: [0.26, 0.4, 0.42, 0.36, 0.46, 0.52, 0.46, 0.28] },
  len: 1.7, hip: 0.62, drop: 0.3,
  fore: [0.58, 0.58, 0.16], hind: [0.64, 0.54, 0.44], thick: 0.23, slope: [10, 22], paw: 0.13, stance: [-0.04, 0.14],
  high: 1.46,
  neck: { at: [0, 0.98, 0.34], len: 0.76, w: 0.32, lean: 8 },
  head: { r: [0.5, 0.58, 0.47], up: 0.08, pitch: 6 },
  snout: { len: 0.68, w: 0.2, h: 0.2 },
  eye: { dir: [0.58, 0.66, 0.34], size: 0.12 },
  ear: { at: [0.18, -0.2, 0.26], len: 1.04, w: 0.44, splay: 18, back: 20, turn: 26 },
  ruff: { c: [0, 1.04, 0.16], r: [0.38, 0.3, 0.42], len: 0.22, rows: 4, across: 7 },
  mouth: 0,
  top: 'sprig',
  garland: false,
  mane: 0,
  mantle: { from: 0.74, to: -0.86, rows: 6, len: 1.0, rise: 62 },
  tails: { at: [0, -1.12, 0.32], n: 1, spread: 0, links: [0.46, 0.48, 0.48, 0.44, 0.38, 0.3], w: [0.22, 0.36, 0.44, 0.46, 0.4, 0.24], lift: -70, curl: 21 },
  bags: { y: -0.1, r: [0.15, 0.38, 0.25], both: false, small: false, flowers: 5, bouquet: false },
  vials: 0, banner: false, wraps: false,
  blossoms: 1, yellows: 3,
  mottles: 14,
  gait: { duty: [0.64, 0.42], swing: [0.28, 0.38], step: 0.2, bob: 0.05 },
  size: 3.3,
};

/** A Herbwarden: large and stately, a crown, a leaf-edged ruff, a great mantle, bags with a bouquet, vials, a banner, wraps, three tails. */
const HERBWARDEN_LOOK: Herb = {
  stage: 2,
  body: { y: [-1.56, -1.42, -0.92, -0.14, 0.68, 1.2, 1.5, 1.62], z: [0.1, 0.1, 0.12, 0.14, 0.1, 0.0, 0.02, 0.06], w: [0.4, 0.6, 0.64, 0.58, 0.64, 0.72, 0.64, 0.4], h: [0.38, 0.62, 0.66, 0.58, 0.72, 0.82, 0.72, 0.42] },
  len: 2.3, hip: 0.62, drop: 0.3,
  fore: [0.74, 0.74, 0.21], hind: [0.82, 0.7, 0.56], thick: 0.3, slope: [10, 22], paw: 0.19, stance: [0.02, 0.2],
  high: 1.92,
  neck: { at: [0, 1.38, 0.5], len: 1.0, w: 0.42, lean: 6 },
  head: { r: [0.66, 0.78, 0.6], up: 0.1, pitch: 6 },
  snout: { len: 0.92, w: 0.27, h: 0.27 },
  eye: { dir: [0.6, 0.64, 0.36], size: 0.14 },
  ear: { at: [0.26, -0.26, 0.36], len: 1.5, w: 0.58, splay: 14, back: 14, turn: 26 },
  ruff: { c: [0, 1.48, 0.28], r: [0.6, 0.48, 0.66], len: 0.44, rows: 4, across: 7 },
  mouth: 0,
  top: 'crown',
  garland: false,
  mane: 0.62,
  mantle: { from: 0.9, to: -1.42, rows: 7, len: 1.5, rise: 54 },
  tails: { at: [0, -1.52, 0.42], n: 3, spread: 40, links: [0.58, 0.62, 0.62, 0.56, 0.48, 0.38], w: [0.26, 0.4, 0.5, 0.52, 0.46, 0.26], lift: -60, curl: 17 },
  bags: { y: -0.2, r: [0.27, 0.52, 0.42], both: true, small: true, flowers: 4, bouquet: true },
  vials: 2, banner: true, wraps: true,
  blossoms: 1, yellows: 3,
  mottles: 18,
  gait: { duty: [0.66, 0.44], swing: [0.24, 0.34], step: 0.18, bob: 0.05 },
  size: 3.3,
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
/** A point in a frame of three axes and an origin. */
const inFrame = (o: V3, X: V3, Y: V3, Z: V3, p: V3): V3 => add(o, add(add(scale(X, p[0]), scale(Y, p[1])), scale(Z, p[2])));

/** Whether the parts are cut finely, for the build under way: drawn big, or at the size the island is played at. */
let fine = true;

/** A lock of fur: a small blade from `root` out along `dir`, drawn to a point, lying flat to `up` and curving out of it a little. */
function lock(root: V3, dir: V3, len: number, w: number, mat: Mat, up: V3, curl = 0.18): Mesh {
  const d = unit(dir), u = unit(up);
  const at = (k: number): V3 => add(root, add(scale(d, len * k), scale(u, len * curl * k * k)));
  return tube([root, at(0.55), at(1)], [w, w * 0.75, 0.006], [w * 0.55, w * 0.4, 0.004], 3, mat, { up: u, start: false, end: false });
}

/** A plume's half-width along it, against its widest: full from near its root, widest at its middle, rounded off to a soft point. */
const vane = (k: number): number => (k < 0.5 ? lerp(0.4, 1, Math.sin((k / 0.5) * Math.PI / 2)) : Math.max(0, 1 - ((k - 0.5) / 0.5) ** 2) ** 0.6);
/**
 * A soft plume of fur: a broad lock from `root` out along `dir`, its flat face along `normal`, bowed toward `bend`, `len` long
 * and `wide` across at its widest, its colour by ring along it, root to tip (`mats`), puffed up to `puff` of its width.
 */
function plume(root: V3, dir: V3, normal: V3, bend: V3, len: number, wide: number, curve: number, mats: readonly Mat[], puff = 0.3): Mesh {
  const d = unit(dir), nn = unit(normal), b = unit(sub(bend, scale(nn, dot(bend, nn))));
  const at = (k: number): V3 => add(root, add(scale(d, len * k), scale(b, len * curve * k * k)));
  const ks = fine ? [0, 0.12, 0.3, 0.5, 0.7, 0.86, 0.96, 1] : [0, 0.25, 0.55, 0.8, 1];
  const ws = ks.map((k) => Math.max(0.006, vane(k) * wide * 0.5));
  const mat: MatOf = (ring) => mats[Math.min(mats.length - 1, Math.floor((ks[ring] + ks[Math.min(ks.length - 1, ring + 1)]) * 0.5 * mats.length))];
  return tube(ks.map(at), ws, ws.map((w) => Math.max(0.004, w * puff)), fine ? 7 : 5, mat, { up: nn, start: false, end: false });
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

/** A soft leaf of colour on a surface at `c` facing out along `n`, `l` long and `w` across, lying along the body turned by `spin`. */
function leafOn(c: V3, n: V3, l: number, w: number, spin: number, m: Mat): Disc {
  const N = unit(n);
  let along0 = sub([0, 1, 0], scale(N, N[1]));
  if (len3(along0) < 1e-4) along0 = [0, 0, 1];
  along0 = unit(along0);
  const across0 = unit(cross(N, along0));
  const along = add(scale(along0, Math.cos(spin)), scale(across0, Math.sin(spin))), across = unit(cross(N, along));
  const pts: V3[] = [];
  for (let q = 0; q < 10; q++) {
    const t = (q / 10) * TAU, x = Math.cos(t), y = Math.sin(t) * Math.sin(Math.PI * (0.5 + 0.5 * x)) ** 0.6 * (1 + 0.2 * x);
    pts.push(add(c, add(scale(along, x * l * 0.5), scale(across, y * w * 0.5))));
  }
  return facing(pts, N, m);
}

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
 * A leaf: a long pointed blade from `root` out along `dir`, its face toward `face`, `L` long and `W` of its length across at
 * its widest, its tip drooping `droop` of its length; a shallow V along its rib, its root darker, its body `mat`, its tip `tip`.
 */
function leaf(root: V3, dir: V3, face: V3, L: number, W: number, droop: number, mat: Mat, tip: Mat): Mesh {
  const d = unit(dir), n0 = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n0));
  const at = [0, 0.16, 0.38, 0.62, 0.84, 1], falls = [0, 0.03, 0.15, 0.4, 0.72, 1];
  const pts = at.map((k, q) => add(add(root, scale(d, L * k)), scale(n0, -L * droop * falls[q])));
  const ws = [0.18, 0.8, 1, 0.84, 0.48, 0.03].map((w) => w * W * L * 0.5), th = Math.max(0.006, L * 0.018);
  const v: V3[] = [];
  for (let k = 0; k < pts.length; k++) {
    const lift = scale(n0, ws[k] * 0.28);
    v.push(add(add(pts[k], scale(side, -ws[k])), lift), pts[k], add(add(pts[k], scale(side, ws[k])), lift));
  }
  for (let k = 0; k < pts.length; k++) for (let j = 0; j < 3; j++) v.push(sub(v[k * 3 + j], scale(n0, th)));
  const f: Face[] = [], want: V3[] = [], B = pts.length * 3;
  for (let k = 0; k < pts.length - 1; k++) {
    const m: Mat = k === 0 ? 'leafDark' : k >= 4 ? tip : mat;
    for (const j of [0, 1]) {
      f.push({ i: [k * 3 + j, k * 3 + j + 1, (k + 1) * 3 + j + 1, (k + 1) * 3 + j], m });
      want.push(n0);
      f.push({ i: [B + k * 3 + j, B + k * 3 + j + 1, B + (k + 1) * 3 + j + 1, B + (k + 1) * 3 + j], m: 'leafDark' });
      want.push(scale(n0, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/**
 * A flower: `petals` broad petals round a middle at `c`, opening toward `n`, each cupped up a little, `R` across from its
 * middle to a petal's tip; its petals `mat` and its middle `heart`.
 */
function flower(c: V3, n: V3, R: number, petals: number, mat: Mat, heart: Mat, id: number): Mesh {
  const N = unit(n);
  let u = cross(Math.abs(N[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], N);
  u = unit(u);
  const w = cross(N, u), out: Mesh[] = [];
  for (let p = 0; p < petals; p++) {
    const a = (p / petals) * TAU + jitter(id) * TAU, rad = add(scale(u, Math.cos(a)), scale(w, Math.sin(a)));
    const dir = unit(add(rad, scale(N, 0.3)));
    out.push(blade([add(c, scale(rad, R * 0.12)), add(c, add(scale(dir, R * 0.55), scale(N, 0.0))), add(c, scale(dir, R))],
      [R * 0.12, R * 0.3, R * 0.06], N, { mat, rib: mat, fold: 0.15, thick: Math.max(0.006, R * 0.08) }));
  }
  out.push(orbAlong(add(c, scale(N, R * 0.08)), N, [R * 0.24, R * 0.24, R * 0.14], 6, 3, heart));
  return merge(...out);
}

/**
 * A rounded box, as leather is when it is stuffed: half-sizes `r` about `c` along `X`, `Y` and `Z`, its corners rounded as
 * much as `e` (one an egg, less a box).
 */
function roundBox(c: V3, r: V3, X: V3, Y: V3, Z: V3, n: number, k: number, mat: MatOf, e = 0.45): Mesh {
  const f0 = (x: number): number => Math.sign(x) * Math.abs(x) ** e;
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let i = 0; i <= k; i++) {
    const lat = -Math.PI / 2 + (Math.PI * i) / k;
    for (let j = 0; j < n; j++) {
      const lon = (TAU * j) / n;
      v.push(inFrame(c, X, Y, Z, [r[0] * f0(Math.cos(lat)) * f0(Math.cos(lon)), r[1] * f0(Math.cos(lat)) * f0(Math.sin(lon)), r[2] * f0(Math.sin(lat))]));
    }
  }
  for (let i = 0; i < k; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + ((j + 1) % n), cc = (i + 1) * n + ((j + 1) % n), d = (i + 1) * n + j;
    const mid = scale(add(add(v[a], v[b]), add(v[cc], v[d])), 0.25);
    f.push({ i: [a, b, cc, d], m: typeof mat === 'function' ? mat(i, j) : mat });
    want.push(sub(mid, c));
  }
  return mesh(v, wound(v, f, want));
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: a swipe of its right fore paw. */
export const HERB_HITS: readonly number[] = [0.45, 0.48, 0.5];
/**
 * A go at its task, as shares of it: the two presses of the poultice, when each is hardest on; and the strip wound round
 * after, from and to.
 */
export const HERB_WORK = { presses: [0.27, 0.47] as readonly number[], wrap: [0.62, 0.86] as const };

/* ---- where its feet go ---------------------------------------------------------------- */

interface Plan {
  at: V3[];
  slope: number[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  neck: [number, number]; head: [number, number, number];
  ears: [[number, number], [number, number]];
  earTurn: number;
  /** The tails lifted, swung to the left, curled. */
  tail: [number, number, number];
}

interface Rest { hip: V3[]; paw: V3[]; reach: number[] }

const rests = new Map<Herb, Rest>();
function restOf(s: Herb): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], paw: V3[] = [], reach: number[] = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y), L = fore ? s.fore : s.hind;
    hip.push([SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop]);
    paw.push([SIDE[i] * r.w * s.hip * (fore ? 1.05 : 0.95), y - s.stance[fore ? 0 : 1], s.paw]);
    reach.push(L[0] + L[1] + L[2]);
  }
  const R = { hip, paw, reach };
  rests.set(s, R);
  return R;
}

function restPlan(s: Herb, R: Rest): Plan {
  return {
    at: R.paw.map((a) => [...a] as V3), slope: [0, 0, 0, 0], foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], ears: [[0, 0], [0, 0]], earTurn: 0, tail: [0, 0, 0],
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
 * skates, then lifted and brought forward folded; the body sinking a little at each footfall, the head nodding, the ears and
 * the tails swaying a beat behind.
 */
function goingPlan(s: Herb, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, L = R.reach[i], half = amp * (R.reach[0] + R.reach[2]) / 2;
    const A = R.paw[i];
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
  p.tail = [-4 * Math.cos(2 * TAU * (w - 0.2)) - g * 8, 10 * Math.sin(TAU * (w - 0.2)), g * 4];
  return p;
}

/** Standing about: breathing, looking round, an ear flicked now and then, the tails stirring; the kit's head tipped to one side. */
function stillPlan(s: Herb, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [2 * Math.abs(a.breath - 0.5), 12 * look];
  p.head = [-2 * Math.abs(cyc(t, 5)), 9 * look, 5 * drift(t, 2) + (s.stage === 0 ? 8 * beat(t, [4.6, 14.1], 1.8) : 0)];
  p.H += 0.01 * s.len * (a.breath - 0.5);
  const flickL = beat(t, [3.1, 15.7], 0.5), flickR = beat(t, [3.4, 9.6, 20.2], 0.5);
  const back = 3 * (1 - Math.cos((TAU * 3 * t) / 24));
  p.ears = [[back + 24 * flickL, 4 * cyc(t, 4) - 8 * flickL], [back * 0.7 + 24 * flickR, -4 * cyc(t, 4, 1) - 8 * flickR]];
  p.tail = [-2 * (1 - Math.cos((TAU * 3 * t) / 24)), 7 * cyc(t, 4), 3 * cyc(t, 3, 0.7)];
  const up = beat(t, [6.2, 18.8], 2.2);
  p.head[1] += 10 * up;
  p.earTurn = -14 * up;
  return p;
}

/** The body pitched nose-up by `deg` about its hips or nose-down about its shoulders, `at` along it, so they stay where they stood. */
function pivot(s: Herb, p: Plan, deg: number, at: number): void {
  const r = ringAt(s.body, at), z0 = r.z - r.h * s.drop, a = deg * DEG;
  const y1 = at * Math.cos(a) - z0 * Math.sin(a), z1 = at * Math.sin(a) + z0 * Math.cos(a);
  p.pitch += deg;
  p.surge += at - y1;
  p.H += z0 - z1;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** Its strike: up a little on its haunches and a swipe of its right fore paw, the ears laid back. */
function strikePlan(s: Herb, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = HERB_HITS[s.stage];
  const set = ramp(t, 0.05, hit - 0.12) * (1 - ramp(t, hit + 0.12, 0.95));
  pivot(s, p, (s.stage ? 7 : 12) * set, -s.len * 0.5);
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
  p.neck = [-10 * set, 0];
  p.head = [-10 * set + 14 * hump(t, hit, 0.08), 0, 0];
  p.ears = [[34 * set, 0], [34 * set, 0]];
  p.tail = [10 * set, 0, 6 * set];
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it is at it over and over. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));
/** How hard a press is on at `t`: each of `HERB_WORK.presses`, a quick push and a slower let-off. */
function pressOf(t: number): number {
  let k = 0;
  for (const c of HERB_WORK.presses) k = Math.max(k, t < c ? ramp(t, c - 0.1, c) : 1 - ramp(t, c + 0.03, c + 0.12));
  return k;
}
/** How far into the winding it is: up as it begins, and let off as it ends. */
const wrapOf = (t: number): number => ramp(t, HERB_WORK.wrap[0] - 0.05, HERB_WORK.wrap[0] + 0.02) * (1 - ramp(t, HERB_WORK.wrap[1] - 0.02, HERB_WORK.wrap[1] + 0.05));

/**
 * A go at its task: dressing one of yours in front of it. It leans in, ears forward, the poultice in its mouth; twice it reaches
 * its head out and presses it on, its right fore paw lifted to pat it down with it; then it winds the strip round, its head
 * going from one side to the other and back, the paw holding the poultice on.
 */
function workPlan(s: Herb, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R);
  const lean = ramp(t, 0.02, 0.14) * (1 - ramp(t, 0.9, 1));
  const press = pressOf(t), wrap = wrapOf(t);
  p.neck = [24 * lean + 22 * press + 12 * wrap, 0];
  p.head = [-16 * lean - 14 * press - 6 * wrap, 0, 0];
  p.surge += s.len * (0.03 * lean + 0.08 * press + 0.04 * wrap);
  p.H -= s.len * 0.02 * lean;
  p.ears = [[-6 * lean, -4 * lean], [-6 * lean, -4 * lean]];
  p.tail = [6 * lean, 6 * Math.sin(t * TAU * 2) * lean, 4 * lean];
  // Winding: the head goes round to one side and the other, twice.
  const w = clamp((t - HERB_WORK.wrap[0]) / (HERB_WORK.wrap[1] - HERB_WORK.wrap[0]));
  const round = Math.sin(w * TAU * 2) * wrap;
  p.head[1] += 24 * round;
  p.neck[1] += 12 * round;
  p.head[2] += 10 * round;
  // The right fore paw lifted and put out to hold the poultice on, at each press and all through the winding.
  const i = 1, A = R.paw[i], L = R.reach[i], k = Math.max(press, 0.75 * wrap);
  p.at[i] = [A[0] * 0.75, A[1] + 0.5 * L * k, A[2] + 0.5 * L * k];
  p.slope[i] = -70 * k;
  p.foot[i] = -40 * k;
  p.roll -= 2.5 * k;
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn, its ears pricked, a shake, and settled. */
function evolvePlan(s: Herb, R: Rest, t: number): Plan {
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
function planOf(s: Herb, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(strikePlan(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0.15, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** A leg bent to put its paw at `paw`, the elbow behind on a fore leg and the stifle forward on a hind (`./wild-hare`'s `legOf`). */
function legOf(s: Herb, body: Xf, i: number, rootLocal: V3, paw: V3, slope: number, foot: number): Xf[] {
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

/** How far round each tail is swung, out of the middle, and how much higher or lower it is carried. */
const tailFan = (s: Herb, k: number): [number, number] => {
  const T = s.tails, g = T.n > 1 ? k - (T.n - 1) / 2 : 0;
  return [g * T.spread, Math.abs(g) * -8 + (g < 0 ? 4 : 0)];
};

/** A tail's bones from its root on the body, each link on from the one before it, lifted, curled and swung. */
function tailBones(s: Herb, body: Xf, P: Plan, k: number): Xf[] {
  const T = s.tails, n = T.links.length, out: Xf[] = [], [yaw, lift] = tailFan(s, k);
  const lag = 1 + 0.25 * k;
  let prev = joint(body, [T.at[0] + (T.n > 1 ? (k - (T.n - 1) / 2) * 0.08 * s.len : 0), T.at[1], T.at[2]], -(T.lift + lift + P.tail[0]), 0, yaw + P.tail[1] * 0.4 * lag);
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.curl + P.tail[2]), 0, (P.tail[1] * 0.6 * lag) / (n - 1) + yaw * 0.08);
    out.push(prev);
  }
  return out;
}

/** The middle of the skull, in the head's frame; the root of the muzzle. */
const skullAt = (s: Herb): V3 => [0, 0, s.head.up];
const snoutRoot = (s: Herb): V3 => [0, s.head.r[1] * 0.55, s.head.up - s.head.r[2] * 0.34];
/** Where the poultice is held in its mouth, in the head's frame. */
const mouthAt = (s: Herb): V3 => { const S = s.snout, r0 = snoutRoot(s); return add(r0, [0, S.len * 0.72, -S.h * 0.95]); };

/** The bones of a stage: its pose, every leg bent to put its paw where the pose says, the neck, head, ears and tails carried on the body. */
function herbBones(s: Herb): (a: Anim) => Bones {
  const R = restOf(s);
  return (a) => {
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go });
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.neck.lean + P.neck[0];
    b.neck = joint(body, s.neck.at, -lean, 0, P.neck[1]);
    b.head = joint(b.neck, neckEnd(s, 1), lean + s.head.pitch + P.head[0], P.head[2], P.head[1]);
    const E = s.ear;
    for (const k of [0, 1]) {
      const side = k ? 1 : -1, e = P.ears[k];
      const spread = joint(b.head, [side * E.at[0], E.at[1], s.head.up + E.at[2]], 0, side * (E.splay + e[1]));
      b[`ear${k}`] = joint(joint(spread, [0, 0, 0], E.back + e[0]), [0, 0, 0], 0, 0, -side * (E.turn + P.earTurn));
    }
    for (let k = 0; k < s.tails.n; k++) tailBones(s, body, P, k).forEach((x, q) => { b[`t${k}_${q}`] = x; });
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
const neckEnd = (s: Herb, k: number): V3 => { const L = s.neck.len, u = clamp((k - 0.45) / 0.55); return [0, L * 0.22 * u * u, L * k]; };

/* ---- colours ---------------------------------------------------------------------------------- */

/** How far up a ring a facet is, `j` of `n` round it: one on top, less one underneath. */
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

/** The barrel: moss green over its back, cream down its sides and belly, mottled darker and lighter green over the green. */
function barrelOf(s: Herb, n: number): Mesh {
  const B = s.body, F = smoothRings(B, 3);
  const body = tube(F.y.map((y, q) => [0, y, F.z[q]] as V3), F.w, F.h, n, (_r, j) => (upOf(j, n) > (s.stage ? 0.3 : 0.5) ? 'coat' : upOf(j, n) < -0.5 ? 'belly' : 'mark'));
  const spots: Disc[] = [];
  const y0 = B.y[1] + 0.05, y1 = lerp(B.y[4], B.y[5], 0.7);
  for (let q = 0; q < s.mottles; q++) {
    const u = (q + 0.5) / s.mottles, y = lerp(y0, y1, u) + (jitter(q + 1) - 0.5) * 0.15 * s.len;
    const side = q % 2 ? 1 : -1, down = 0.5 + 0.7 * jitter(q + 7);
    const e = onRings(B, y, side > 0 ? Math.PI / 2 - down : Math.PI / 2 + down), k = s.len * (s.stage ? 0.12 : 0.09) * (0.7 + 0.6 * jitter(q + 3));
    spots.push(onBarrel(B, leafOn(e.p, e.n, k * 2.2, k * 1.1, (jitter(q + 5) - 0.5) * 0.8, q % 3 === 0 ? 'coatLight' : 'coat'), 0.012));
  }
  for (let q = 0; q < Math.round(s.mottles * 0.6); q++) {
    const y = lerp(y0, y1, jitter(q + 40)), th = Math.PI / 2 + (jitter(q + 41) - 0.5) * 1.3;
    const e = onRings(B, y, th), k = s.len * 0.07 * (0.6 + 0.6 * jitter(q + 42));
    spots.push(onBarrel(B, leafOn(e.p, e.n, k * 2, k, jitter(q + 43) * 2, q % 2 ? 'coatDark' : 'coatLight'), 0.014));
  }
  return merge(body, paint(spots));
}

/** The ruff: on the kit a mass of cream locks down its chest; on the bigger two rows of long soft cream plumes hanging down it. */
function ruffOf(s: Herb, n: number): Mesh {
  const F = s.ruff, out: Mesh[] = [orb(F.c, F.r, n, Math.max(4, n - 3), 'mark')];
  for (let row = 0; row < F.rows; row++) {
    const v = row / Math.max(1, F.rows - 1), el = lerp(s.stage ? 0.85 : 0.6, s.stage ? -0.7 : -0.45, v);
    const count = F.across + (row % 2);
    for (let q = 0; q < count; q++) {
      const az = lerp(-1.3, 1.3, (q + 0.5 * (row % 2)) / Math.max(1, count - 1 + (row % 2)));
      const dir: V3 = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
      const e = onEgg2(F.c, F.r, dir), id = row * 31 + q;
      const L = F.len * (0.7 + 0.5 * v) * (0.85 + 0.3 * jitter(id));
      const way = unit(add(scale(e.n, 0.45), [0, 0.02, -1]));
      if (s.stage === 0) out.push(lock(sub(e.p, scale(e.n, 0.05)), way, L, L * 0.8, 'mark', e.n, 0.05));
      else out.push(plume(sub(e.p, scale(e.n, 0.04)), way, e.n, [0, 0, -1], L, L * 0.75, 0.06, row % 2 ? ['belly', 'mark', 'muzzle'] : ['mark', 'mark', 'muzzle'], 0.35));
    }
  }
  // The Herbwarden's ruff edged in green leaves, round its sides and over its shoulders.
  if (s.stage === 2) {
    for (let q = 0; q < 10; q++) {
      const sd = q % 2 ? 1 : -1, f = Math.floor(q / 2) / 4;
      const dir: V3 = [sd * (0.95 - 0.25 * f), 0.2 + 0.4 * f, 0.2 - 0.9 * f];
      const e = onEgg2(F.c, F.r, dir);
      const down = unit(add(scale(e.n, 0.55), [0, -0.15, -1]));
      out.push(leaf(sub(e.p, scale(e.n, 0.03)), down, e.n, F.len * (1.05 + 0.2 * jitter(q + 600)), 0.42, 0.12, 'leaf', 'moss'));
    }
  }
  return merge(...out);
}

/** The neck: green behind, cream down its throat. */
function neckOf(s: Herb, n: number): Mesh {
  const N = s.neck, L = N.len;
  return tube([[0, 0, -0.3], [0, -0.03 * L, L * 0.4], neckEnd(s, 0.75), neckEnd(s, 1.04)], [N.w * 1.12, N.w, N.w * 0.92, N.w * 0.86],
    [N.w * 1.2, N.w * 1.04, N.w * 0.94, N.w * 0.88], n, (_r, j) => (upOf(j, n) > 0.15 ? 'mark' : 'coat'), { seam: 'both' });
}
/** Locks down the front and sides of the neck, carrying the ruff up to the jaw. */
function neckFurOf(s: Herb): Mesh {
  const N = s.neck, out: Mesh[] = [];
  const rows = s.stage === 2 ? 3 : 2;
  for (let row = 0; row < rows; row++) {
    const z = lerp(N.len * (s.stage ? 0.78 : 0.8), N.len * 0.12, row / Math.max(1, rows - 1));
    for (let q = 0; q < 5; q++) {
      const a = lerp(-1.3, 1.3, (q + 0.5 * (row % 2)) / 4.5), id = 300 + row * 11 + q;
      const nrm: V3 = [Math.sin(a), Math.cos(a), 0];
      const root: V3 = add(neckEnd(s, z / N.len), [nrm[0] * N.w * 0.9, nrm[1] * N.w * 0.95, 0]);
      const L = s.ruff.len * (0.6 + 0.3 * row / 2) * (0.85 + 0.3 * jitter(id));
      if (s.stage === 0) out.push(lock(sub(root, scale(nrm, 0.03)), add(scale(nrm, 0.8), [0, 0, -0.8]), L * 1.2, L * 0.75, 'mark', nrm, 0.1));
      else out.push(plume(sub(root, scale(nrm, 0.03)), add(scale(nrm, 0.5), [0, 0, -1]), nrm, [0, 0, -1], L * 1.1, L * 0.62, 0.05, ['mark', 'mark', 'muzzle'], 0.22));
    }
  }
  return merge(...out);
}

/**
 * The Herbwarden's mane: long leaves laid over the back and sides of its neck and down over its shoulders, rows of them, each
 * hanging down and back over the one under it, as a cape of leaves.
 */
function maneOf(s: Herb): { neck: Mesh; shoulders: Mesh } {
  const N = s.neck, M = s.mane, neck: Mesh[] = [], shoulders: Mesh[] = [];
  for (let row = 0; row < 4; row++) {
    const z = lerp(N.len * 0.95, N.len * 0.2, row / 3);
    const count = 6 + (row % 2);
    for (let q = 0; q < count; q++) {
      const a = lerp(-2.1, 2.1, (q + 0.5 * (row % 2)) / (count - 1 + 0.5 * (row % 2))), id = 800 + row * 13 + q;
      // Round the back of the neck: `a` nought straight behind.
      const nrm: V3 = [Math.sin(a), -Math.cos(a), 0.15];
      const root: V3 = add(neckEnd(s, z / N.len), [nrm[0] * N.w * 0.85, nrm[1] * N.w * 0.9, 0]);
      const dir = unit(add(scale(nrm, 0.5), [0, -0.3, -1]));
      neck.push(leaf(root, dir, nrm, M * (0.85 + 0.25 * jitter(id)) * (1 - 0.1 * row), 0.4, 0.1, jitter(id + 1) < 0.3 ? 'moss' : 'leaf', 'moss'));
    }
  }
  // Over the shoulders, both sides: three rows hanging down over the tops of the fore legs.
  const B = s.body;
  for (const sd of [1, -1]) for (let row = 0; row < 3; row++) for (let q = 0; q < 4; q++) {
    const id = 900 + row * 7 + q + (sd > 0 ? 50 : 0);
    const y = s.len * (0.62 - 0.1 * row) + (q - 1.5) * 0.08 * s.len;
    const th = Math.PI / 2 - sd * (0.7 + 0.32 * row + 0.08 * (q % 2));
    const e = onRings(B, y, th);
    const dir = unit(add(scale(e.n, 0.35), [0, -0.25, -1]));
    shoulders.push(leaf(sub(e.p, scale(e.n, 0.02)), dir, e.n, M * (0.95 + 0.2 * jitter(id)) * (1 - 0.08 * row), 0.42, 0.1, jitter(id + 3) < 0.35 ? 'moss' : 'leaf', 'moss'));
  }
  return { neck: merge(...neck), shoulders: merge(...shoulders) };
}

/** A skull: an egg of rings along it, green over its crown and down the back of it, cream down its face, cheeks and jaw. */
function skullOf(s: Herb, n: number, k: number): Mesh {
  const H = s.head, C = skullAt(s), rings = k + 4;
  const pts: V3[] = [], ws: number[] = [], hs: number[] = [];
  for (let q = 0; q <= rings; q++) {
    const a = Math.PI * (q / rings), f = Math.max(0.02, Math.sin(a));
    pts.push([C[0], C[1] - H.r[1] * Math.cos(a), C[2]]);
    ws.push(H.r[0] * f);
    hs.push(H.r[2] * f);
  }
  const nn = n + 2;
  return tube(pts, ws, hs, nn, (ring, j) => {
    const up = upOf(j, nn), front = ring / rings;
    if (s.stage === 0) return up > 0.3 || (front < 0.35 && up > -0.2) ? 'coat' : 'mark';
    return up > 0.38 + 0.25 * front || (front < 0.3 && up > -0.1) ? 'coat' : 'mark';
  }, { start: false, end: false });
}

/**
 * The head: a skull green over a cream face, a slim cream muzzle to a dark nose, cream tufts off its cheeks, a few darker
 * mottles over its crown, big amber eyes; the kit's mouth open, a pink tongue in it.
 */
function headOf(s: Herb, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const out: Array<Mesh | false> = [skullOf(s, n, k)];
  out.push(eyes(C, H.r, s.eye.dir, s.eye.size, { tall: s.stage ? 1.0 : 1.18, iris: 'crystal', pupil: 0.5, glint: 0.36, shut }));
  const S = s.snout, r0 = snoutRoot(s);
  const pts: V3[] = [r0, add(r0, [0, S.len * 0.45, -S.h * 0.2]), add(r0, [0, S.len * 0.82, -S.h * 0.42]), add(r0, [0, S.len, -S.h * 0.52])];
  out.push(tube(pts, [S.w, S.w * 0.84, S.w * 0.6, S.w * 0.3], [S.h, S.h * 0.8, S.h * 0.56, S.h * 0.3], n, 'muzzle', { start: false }));
  out.push(orb(add(r0, [0, S.len * 0.98, -S.h * 0.42]), [S.w * 0.46, S.w * 0.38, S.w * 0.36], 6, 4, 'nose'));
  if (s.mouth) {
    // The kit's open mouth: its jaw dropped under the muzzle, dark inside, a pink tongue in it.
    const j0 = add(r0, [0, -S.len * 0.05, -S.h * 0.8]), m = s.mouth;
    out.push(tube([j0, add(j0, [0, S.len * 0.42, -S.h * 0.55 * m]), add(j0, [0, S.len * 0.7, -S.h * 0.85 * m])],
      [S.w * 0.85, S.w * 0.66, S.w * 0.34], [S.h * 0.4, S.h * 0.32, S.h * 0.2], n, 'muzzle', { start: false }));
    // The inside of its mouth, dark, between the muzzle and the jaw; its tongue lying in the jaw.
    out.push(orbAlong(add(r0, [0, S.len * 0.42, -S.h * 1.0]), [0, 1, -0.45], [S.w * 0.7, S.h * 0.42, S.len * 0.36], 7, 4, 'lid'));
    out.push(orbAlong(add(r0, [0, S.len * 0.5, -S.h * 1.12]), [0, 1, -0.55], [S.w * 0.52, S.h * 0.22, S.len * 0.26], 6, 3, 'tongue'));
  }
  // Cream tufts off its cheeks; on the bigger two longer, swept back.
  for (const sd of [1, -1]) for (let q = 0; q < 3; q++) {
    const e = onEgg2(C, H.r, [sd * 0.9, -0.05 - 0.2 * q, -0.32 - 0.12 * q]);
    const L = (s.stage ? 0.3 : 0.2) * H.r[0] * 2 * (0.9 - 0.15 * q);
    out.push(lock(sub(e.p, scale(e.n, 0.04)), add(scale(e.n, 0.9), [0, -0.6, -0.25]), L, L * 0.55, 'mark', [0, 0, 1], 0.1));
  }
  // Darker and lighter mottles over the crown and down the back of the head.
  const marks: Disc[] = [];
  for (let q = 0; q < 5; q++) {
    const e = onEgg2(C, H.r, [(jitter(q + 70) - 0.5) * 1.2, -0.4 + 0.5 * jitter(q + 71), 0.85]);
    marks.push(leafOn(add(e.p, scale(e.n, 0.01)), e.n, H.r[0] * 0.32, H.r[0] * 0.18, jitter(q + 72) * 3, q % 2 ? 'coatDark' : 'coatLight'));
  }
  out.push(paint(marks));
  return merge(...out);
}

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Herb): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.92) }];

/** An ear: tall, pointed, green behind with a darker tip, pink-brown inside with tufts of cream fur. Up its own `z`, its hollow toward `+y`. */
function earOf(s: Herb, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  const zs = [0, 0.12, 0.34, 0.58, 0.8, 0.94, 1].map((x) => x * L);
  const ws = [0.86, 1, 0.98, 0.86, 0.62, 0.34, 0.03].map((x) => x * w);
  const line = zs.map((z, q) => [0, -0.04 * Math.sin((q / 6) * Math.PI) * L * 0.2, z] as V3);
  const cup = (p: V3): V3 => [p[0], p[1] + 0.26 * w * Math.min(1, (p[0] / w) ** 2), p[2]];
  const shell = tube(line, ws, ws.map((x) => Math.max(0.025, x * 0.2)), Math.max(6, n), (ring) => (ring >= 5 ? 'coatDark' : 'coat'), { up: [0, 1, 0] });
  const cupped = mesh(shell.v.map(cup), shell.f);
  const rim = (sd: number): V3[] => [1, 2, 3, 4].map((q) => cup([sd * ws[q] * 0.7, line[q][1] + ws[q] * 0.2 + 0.014, zs[q]]));
  const lining: V3[] = [cup([0, line[0][1] + ws[0] * 0.2 + 0.014, zs[0] + L * 0.04]), ...rim(-1), cup([0, line[5][1] + 0.02, L * 0.88]), ...rim(1).reverse()];
  const tufts: Mesh[] = [];
  for (let q = 0; q < 4; q++) {
    const x = (q - 1.5) * w * 0.3, root = cup([x, ws[1] * 0.2 + 0.02, L * 0.06]);
    tufts.push(lock(root, [x * 0.6, 0.35, 1], L * (0.34 + 0.08 * (q % 2)), w * 0.3, 'mark', [0, 1, 0], -0.1));
  }
  return merge(cupped, paint([facing(lining, [0, 1, 0], 'inner')]), ...tufts);
}

/**
 * What grows on top of its head, in the head's frame: the kit's tuft of three leaves; the Herbfox's sprig of leaves; the
 * Herbwarden's crown of leaves with a sprig of wheat standing up in it and a pink blossom and a little cream one at its side.
 */
function topOf(s: Herb): Mesh {
  const H = s.head, top: V3 = [0, -H.r[1] * 0.15, s.head.up + H.r[2] * 0.9], out: Mesh[] = [];
  const sz = H.r[0] * 2;
  if (s.top === 'tuft' || s.top === 'sprig') {
    const n = s.top === 'tuft' ? 3 : 4;
    out.push(tube([sub(top, [0, 0, 0.05]), add(top, [0, -0.02, sz * 0.12])], sz * 0.035, sz * 0.035, 4, 'stem'));
    for (let q = 0; q < n; q++) {
      const g = q / (n - 1) - 0.5;
      const dir = unit([g * 1.2, 0.15 - 0.2 * Math.abs(g), 1 - 0.3 * Math.abs(g)]);
      const L = sz * (s.top === 'tuft' ? 0.62 : 0.58) * (1 - 0.35 * Math.abs(g) * 2);
      out.push(leaf(add(top, [0, -0.02, sz * 0.1]), dir, [0, 1, 0.1], L, 0.5, 0.06, q === 1 ? 'moss' : 'leaf', 'moss'));
    }
    return merge(...out);
  }
  // The crown: leaves round the top of its head, standing up and out, and the wheat and blossom in it.
  for (let q = 0; q < 9; q++) {
    const a = lerp(-2.4, 2.4, q / 8), id = 1100 + q;
    const e = onEgg2(skullAt(s), H.r, [Math.sin(a) * 0.9, -Math.cos(a) * 0.5 + 0.1, 0.75]);
    const dir = unit(add(scale(e.n, 0.6), [0, -0.25, 0.9]));
    out.push(leaf(sub(e.p, scale(e.n, 0.02)), dir, e.n, sz * 0.42 * (0.85 + 0.3 * jitter(id)), 0.44, 0.15, jitter(id + 1) < 0.4 ? 'moss' : 'leaf', 'moss'));
  }
  // The wheat: a stem up between its ears with its grains along the top of it, and a whisker off the tip.
  const w0 = add(top, [0.05 * sz, -0.05 * sz, -0.02]), wd = unit([0.12, 0.2, 1]), WL = sz * 0.95;
  out.push(tube([w0, add(w0, scale(wd, WL))], sz * 0.018, sz * 0.018, 4, 'stem'));
  for (let q = 0; q < 7; q++) {
    const k = 0.45 + 0.08 * q, p = add(w0, scale(wd, WL * k));
    for (const sd of [1, -1]) out.push(orbAlong(add(p, [sd * sz * 0.03, 0, 0]), unit(add(wd, [sd * 0.5, 0, 0])), [sz * 0.03, sz * 0.03, sz * 0.055], 5, 3, 'horn'));
  }
  out.push(flower(add(top, [-0.34 * sz, 0.12 * sz, -0.06 * sz]), [-0.5, 0.7, 0.5], sz * 0.22, 5, 'petal', 'bloom', 9));
  out.push(flower(add(top, [0.3 * sz, 0.1 * sz, -0.04 * sz]), [0.5, 0.7, 0.5], sz * 0.12, 5, 'cloth', 'cap', 13));
  return merge(...out);
}

/** The kit's garland, in the neck's frame: a ring of leaves round the root of its neck, laid down over its shoulders, two little pink flowers on it. */
function garlandOf(s: Herb): Mesh {
  const N = s.neck, out: Mesh[] = [], c = neckEnd(s, 0.05), count = 12;
  for (let q = 0; q < count; q++) {
    const a = (q / count) * TAU, nrm: V3 = [Math.sin(a), Math.cos(a), 0];
    const root = add(c, [nrm[0] * N.w * 1.12, nrm[1] * N.w * 1.12, 0]);
    const dir = unit(add(scale(nrm, 0.85), [0, 0, -0.3]));
    out.push(leaf(root, add(dir, [Math.cos(a) * 0.5, -Math.sin(a) * 0.5, 0]), [0, 0, 1], N.w * 1.2, 0.56, 0.08, q % 3 ? 'leaf' : 'leafDark', 'moss'));
  }
  for (const sd of [1, -1]) {
    const a = sd * 0.75, nrm: V3 = [Math.sin(a), Math.cos(a), 0.3];
    out.push(flower(add(c, [nrm[0] * N.w * 1.35, nrm[1] * N.w * 1.35, 0.05]), nrm, N.w * 0.55, 5, 'petal', 'bloom', sd > 0 ? 3 : 5));
  }
  return merge(...out);
}

/** One thing among many that stir on its back: its mesh, the root it sways on, a number of its own and how much it sways. */
interface Sway { mesh: Mesh; root: V3; id: number; k?: number }

/**
 * The mantle: long leaves along its back from its shoulders to its rump, rows of them fanned round the spine -- the middle ones
 * rising up and back, those either side angled out and down over the flanks -- in two layers, the upper standing off the lower,
 * so it has depth seen from in front; the leaves longest over the middle of its back.
 */
function mantleOf(s: Herb): Sway[] {
  const M = s.mantle!, B = s.body, out: Sway[] = [];
  /** A leaf of the mantle: rooted on the back `f` of the way from its front to its back, `phi` round from the spine, rising `rise` degrees. */
  const put = (f: number, phi: number, rise: number, L: number, W: number, droop: number, mat: Mat, tip: Mat, lift: number, id: number, flat: number): void => {
    const y = lerp(M.from, M.to, f) + (jitter(id + 1) - 0.5) * 0.04 * s.len;
    const at = onRings(B, y, Math.PI / 2 - phi * 0.6);
    const out3: V3 = [Math.sin(phi), 0, Math.cos(phi)];
    const r = rise * DEG;
    const dir = unit(add(scale([0, -1, 0], Math.cos(r)), scale(out3, Math.sin(r))));
    // Its face: a crest leaf's turned to the side, as a fin's is; a leaf lying on the body, out from it.
    const across: V3 = [Math.cos(phi) * (phi < 0 ? -1 : 1), 0, -Math.abs(Math.sin(phi))];
    const want = add(scale(across, 1 - flat), scale(at.n, flat));
    const face = unit(sub(want, scale(dir, dot(want, dir))));
    const root = add(at.p, scale(at.n, lift));
    out.push({ mesh: leaf(root, dir, face, L, W, droop, mat, tip), root, id, k: 0.5 + Math.abs(phi) * 0.5 });
  };
  // The cover: rows of broad leaves lying back over its back and down over its flanks, either side of the spine.
  for (let r = 0; r < M.rows; r++) {
    const f = r / Math.max(1, M.rows - 1);
    for (let q = 0; q < 6; q++) {
      const g = (q + (r % 2 ? 0.5 : 0)) / 5.5 - 0.5, id = 1300 + r * 17 + q;
      const phi = g * 2.9;
      put(f, phi, lerp(16, -28, Math.abs(g) * 2), M.len * 0.62 * (0.9 + 0.2 * jitter(id + 2)), 0.44, 0.12 + 0.3 * Math.abs(g),
        jitter(id + 3) < 0.45 ? 'leafDark' : 'leaf', 'leaf', 0.01, id, 0.85);
    }
  }
  // The crest: long leaves rising up and back off the spine and fanned out to either side, highest over the middle of its back.
  const rows = M.rows - 1;
  for (let r = 0; r < rows; r++) {
    const f = lerp(0.12, 1, r / Math.max(1, rows - 1)), hi = Math.sin(Math.PI * (0.1 + 0.85 * f));
    for (let q = 0; q < 5; q++) {
      const g = (q + (r % 2 ? 0.5 : 0)) / 4.5 - 0.5, id = 1500 + r * 13 + q;
      put(f, g * 2.1, M.rise * (0.55 + 0.45 * hi) * (1 - 0.35 * Math.abs(g) * 2), M.len * (0.72 + 0.38 * hi) * (0.9 + 0.2 * jitter(id + 2)), 0.4, 0.2,
        jitter(id + 3) < 0.2 ? 'moss' : 'leaf', 'moss', 0.04 * s.len, id, 0.25);
    }
  }
  // Big leaves standing up off its shoulders, behind its head, leaning back and out.
  for (const sd of [1, -1]) for (let q = 0; q < 2; q++) {
    const id = 1700 + q * 3 + (sd > 0 ? 0 : 1);
    const at = onRings(B, M.from + 0.04 * s.len, Math.PI / 2 - sd * (0.3 + 0.35 * q));
    const dir = unit([sd * (0.3 + 0.3 * q), -0.6, 0.75 - 0.2 * q]);
    const up = unit([sd * 0.8, 0.3, 0.5]);
    out.push({ mesh: leaf(at.p, dir, unit(sub(up, scale(dir, dot(up, dir)))), M.len * (0.8 - 0.1 * q), 0.36, 0.12, 'leaf', 'moss'), root: at.p, id, k: 1.2 });
  }
  return out;
}

/** Its blossoms on the mantle: big pink ones over the middle of its back, little yellow ones round them. */
function blossomsOf(s: Herb): Sway[] {
  const M = s.mantle!, B = s.body, out: Sway[] = [];
  const top = (y: number, th: number, lift: number): { p: V3; n: V3 } => { const e = onRings(B, y, th); return { p: add(e.p, scale(e.n, lift)), n: e.n }; };
  for (let q = 0; q < s.blossoms; q++) {
    const e = top(lerp(M.from, M.to, 0.42), Math.PI / 2 - 0.5, M.len * 0.42);
    out.push({ mesh: flower(e.p, unit(add(e.n, [0.7, 0.15, 0.3])), M.len * 0.3, 5, 'petal', 'bloom', 21 + q), root: e.p, id: 30 + q, k: 1 });
  }
  for (let q = 0; q < s.yellows; q++) {
    const sd = q % 2 ? -1 : 1, e = top(lerp(M.from, M.to, 0.3 + 0.17 * q), Math.PI / 2 - sd * (0.7 + 0.2 * jitter(q + 50)), M.len * 0.3);
    out.push({ mesh: flower(e.p, unit(add(e.n, [sd * 0.5, 0, 0.4])), M.len * 0.15, 5, 'cap', 'bloom', 40 + q), root: e.p, id: 40 + q, k: 1.2 });
  }
  return out;
}

/** What stirs, as one mesh: each corner's root (what it sways on) and a phase and an amount of its own. */
interface Stir { mesh: Mesh; root: V3[]; ph: number[]; k: number[] }
function stirOf(parts: readonly Sway[]): Stir {
  const root: V3[] = [], ph: number[] = [], k: number[] = [];
  for (const p of parts) for (let q = 0; q < p.mesh.v.length; q++) { root.push(p.root); ph.push(jitter(p.id + 31) * TAU); k.push(p.k ?? 1); }
  return { mesh: merge(...parts.map((p) => p.mesh)), root, ph, k };
}

/** How what is on its back stirs this moment: a breeze standing, every step going, each press at its task; grown out as it evolves. */
function stirring(s: Herb, a: Anim): { jig: number; at: number; grow: number } {
  let jig = 0.05 * (1 - a.go) * (0.6 + 0.4 * cyc(a.t, 3)), at = a.t * TAU * 0.5, grow = 1;
  if (a.go > 0) {
    jig += smooth(a.go) * (0.1 + 0.06 * a.gait);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    jig += 0.16 * hump(act.t, HERB_HITS[s.stage] + 0.05, 0.16);
    at = act.t * 60;
  } else if (act?.kind === 'work') {
    jig += 0.08 * pressOf(act.t) * downOf(act.t, a.graze);
    at = act.t * 40;
  } else if (act?.kind === 'evolve') {
    const t = act.t;
    grow = 0.45 + 0.55 * ramp(t, 0.04, 0.5) + 0.12 * hump(t, 0.54, 0.08);
    jig += 0.08 * hump(t, 0.62, 0.1);
    at = t * 70;
  }
  return { jig: Math.min(0.3, jig), at, grow };
}

/** A piece of things that stir and grow (`stirring`): each whole, scaled from its root and swayed on it, a beat of its own. */
function stirred(s: Herb, G: Stir): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { jig, at, grow } = stirring(s, a);
    if (!jig && grow === 1) return v as V3[];
    return v.map((p, i) => {
      const r = G.root[i], ph = G.ph[i], kk = G.k[i];
      let [x, y, z] = scale(sub(p, r), grow);
      const side = jig * kk * Math.sin(at + ph), fore = jig * kk * 0.6 * Math.cos(at * 1.3 + ph * 1.3);
      const cs = Math.cos(side), ss = Math.sin(side), cf = Math.cos(fore), sf = Math.sin(fore);
      [x, z] = [x * cs + z * ss, -x * ss + z * cs];
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      return [r[0] + x, r[1] + y, r[2] + z];
    });
  };
}

/* ---- bags, and what is in them and hung off them --------------------------------------------- */

/** The flank its one bag is on, and its vials and banner, as the sheet shows it: its right. */
const MAIN = 1;
/** A bag's frame on the body: its middle, and out from the flank, along and up; `side` less one on its left. */
function bagFrame(s: Herb, side: number, y: number, r: V3): { c: V3; X: V3; Y: V3; Z: V3 } {
  const B = s.body, e = onRings(B, y, side > 0 ? -0.05 : Math.PI + 0.05);
  const X = unit([e.n[0], 0, e.n[2] * 0.4]), Z = unit(sub([0, 0, 1], scale(X, X[2]))), Y = cross(Z, X);
  return { c: add(e.p, scale(X, r[0] * 0.8)), X, Y, Z };
}

/**
 * A leather bag: a stuffed rounded body, a flap over the top of its outside with a darker rim, a brass stud or a leaf button on
 * it, and a strap from its top up over the back to the other side.
 */
function bagOf(s: Herb, side: number, y: number, r: V3, n: number): Mesh {
  const { c, X, Y, Z } = bagFrame(s, side, y, r), k = Math.max(4, Math.round(n * 0.6));
  const at = (p: V3): V3 => inFrame(c, X, Y, Z, p);
  const out: Mesh[] = [roundBox(c, r, X, Y, Z, n, k, (i) => (i < 2 ? 'leatherDark' : 'leather'))];
  // The flap: a thinner box over the top of its outside, hanging down two thirds of it.
  out.push(roundBox(at([r[0] * 0.55, 0, r[2] * 0.45]), [r[0] * 0.55, r[1] * 1.04, r[2] * 0.62], X, Y, Z, n, k, (i) => (i < 1 ? 'leatherDark' : 'leatherLit'), 0.4));
  out.push(orbAlong(at([r[0] * 1.08, 0, -r[2] * 0.08]), X, [r[2] * 0.14, r[2] * 0.14, r[2] * 0.08], 6, 3, s.stage ? 'metal' : 'moss'));
  // The kit's strap: from the bag's top up and over the back to the far flank.
  if (s.stage) return merge(...out);
  const B = s.body, strap: V3[] = [];
  for (let q = 0; q <= 8; q++) {
    const th = side > 0 ? lerp(0.1, Math.PI - 0.3, q / 8) : lerp(Math.PI - 0.1, 0.3, q / 8);
    const e = onRings(B, lerp(y + r[1] * 0.3, s.len * 0.5, Math.sin((q / 8) * Math.PI / 2)), th);
    strap.push(add(e.p, scale(e.n, 0.014)));
  }
  out.push(tube(strap, 0.014, r[1] * 0.3, 4, 'leatherDark', { up: [0, 1, 0] }));
  return merge(...out);
}

/** Flowers spilling out of the top of a bag: yellow ones with orange hearts, and leaves among them. */
function spillOf(s: Herb, side: number, y: number, r: V3): Sway[] {
  const { c, X, Y, Z } = bagFrame(s, side, y, r), out: Sway[] = [];
  const at = (p: V3): V3 => inFrame(c, X, Y, Z, p);
  for (let q = 0; q < s.bags.flowers; q++) {
    const u = q / Math.max(1, s.bags.flowers - 1) - 0.5, id = 1900 + q + (side > 0 ? 40 : 0);
    const p = at([r[0] * (0.2 + 0.5 * jitter(id)), u * r[1] * 1.4, r[2] * (0.95 + 0.25 * jitter(id + 1))]);
    const nrm = unit(add(add(scale(X, 0.7), scale(Z, 0.8)), scale(Y, u)));
    out.push({ mesh: flower(p, nrm, r[2] * (0.38 + 0.12 * jitter(id + 2)), 5, q % 3 === 2 ? 'cloth' : 'cap', 'bloom', id), root: p, id, k: 1 });
    const ld = unit(add(add(scale(X, 0.3), scale(Z, 1)), scale(Y, u * 1.5 + 0.3)));
    out.push({ mesh: leaf(at([r[0] * 0.1, u * r[1], r[2] * 0.7]), ld, X, r[2] * 1.4, 0.4, 0.2, 'leaf', 'moss'), root: p, id: id + 100, k: 1 });
  }
  return out;
}

/** The Herbwarden's bouquet, out of the top of its right bag: lavender spikes, pink and cream blossoms, and leaves. */
function bouquetOf(s: Herb, y: number, r: V3): Sway[] {
  const { c, X, Y, Z } = bagFrame(s, MAIN, y, r), out: Sway[] = [];
  const at = (p: V3): V3 => inFrame(c, X, Y, Z, p);
  const base = at([0, 0, r[2] * 0.6]), stem = r[2] * 0.12;
  // Lavender: four spikes leaning out and up, each a stem with its florets stacked up the top of it.
  for (let q = 0; q < 4; q++) {
    const id = 2000 + q, d = unit(add(add(scale(Z, 1), scale(X, 0.15 + 0.2 * q)), scale(Y, (q - 1.5) * 0.35)));
    const L = r[2] * (2.4 + 0.5 * jitter(id)), p0 = add(base, scale(Y, (q - 1.5) * r[1] * 0.3));
    const parts: Mesh[] = [tube([p0, add(p0, scale(d, L))], stem * 0.5, stem * 0.5, 4, 'stem')];
    for (let e = 0; e < 7; e++) {
      const k = 0.5 + 0.075 * e, pp = add(p0, scale(d, L * k)), rr = r[2] * 0.11 * (1 - 0.05 * e);
      parts.push(orbAlong(pp, d, [rr, rr, rr * 1.5], 5, 3, e % 2 ? 'featherDark' : 'feather'));
    }
    out.push({ mesh: merge(...parts), root: p0, id, k: 1.1 });
  }
  // Blossoms: two big pink, two cream, on stems, among leaves.
  const blooms: Array<[V3, number, Mat]> = [[[0.5, -0.45, 1.9], 0.55, 'petal'], [[0.2, 0.55, 1.5], 0.42, 'petal'], [[0.8, 0.1, 1.4], 0.36, 'cloth'], [[0.1, -0.2, 2.2], 0.3, 'cloth']];
  blooms.forEach(([p, R, m], q) => {
    const id = 2100 + q, tip = at([p[0] * r[0], p[1] * r[1], p[2] * r[2]]);
    const nrm = unit(add(add(scale(X, 0.8), scale(Z, 0.6)), scale(Y, p[1] * 0.6)));
    out.push({ mesh: merge(tube([base, tip], stem * 0.5, stem * 0.5, 4, 'stem'), flower(tip, nrm, r[2] * R, 5, m, m === 'petal' ? 'bloom' : 'cap', id)), root: base, id, k: 1 });
  });
  for (let q = 0; q < 6; q++) {
    const id = 2200 + q, g = q / 5 - 0.5;
    const d = unit(add(add(scale(Z, 0.9), scale(X, 0.5)), scale(Y, g * 1.6)));
    out.push({ mesh: leaf(base, d, X, r[2] * (1.6 + 0.4 * jitter(id)), 0.38, 0.25, 'leaf', 'moss'), root: base, id, k: 1 });
  }
  return out;
}

/** A round glass vial of amber tonic hung from the bag on a cord: its body, a neck, a cork, a glint. Hung at `p`, `R` across. */
function vialOf(top: V3, R: number, X: V3, cord: number): Mesh {
  const c = add(top, [0, 0, -cord - R * 1.55]);
  const out: Mesh[] = [];
  out.push(tube([add(top, [0, 0, 0]), add(c, [0, 0, R * 1.5])], R * 0.06, R * 0.06, 4, 'string'));
  out.push(tube([add(c, [0, 0, R * 0.7]), add(c, [0, 0, R * 1.4])], R * 0.34, R * 0.34, 6, 'water', { start: false }));
  out.push(tube([add(c, [0, 0, R * 1.3]), add(c, [0, 0, R * 1.62])], R * 0.38, R * 0.38, 6, 'wood'));
  const pts: V3[] = [], ws: number[] = [];
  for (let q = 0; q <= 6; q++) {
    const a = Math.PI * (q / 6);
    pts.push(add(c, [0, 0, -R * Math.cos(a)]));
    ws.push(Math.max(0.004, R * Math.sin(a)));
  }
  out.push(tube(pts, ws, ws, 8, (ring) => (ring < 4 ? 'flame' : 'water'), { start: false, end: false }));
  const g = add(c, add(scale(X, R * 0.9), [0, 0, R * 0.35]));
  out.push(orbAlong(g, X, [R * 0.22, R * 0.14, R * 0.05], 5, 3, 'glint'));
  return merge(...out);
}

/** The Herbwarden's banner: a cream cloth hung under its bags, pointed at its foot, a green rim and a green leaf on it. */
function bannerOf(s: Herb, y: number, r: V3): Mesh {
  const { c, X, Y, Z } = bagFrame(s, MAIN, y, r);
  const at = (p: V3): V3 => inFrame(c, X, Y, Z, p);
  const W = r[1] * 0.62, L = r[2] * 2.9, top = at([r[0] * 0.65, -r[1] * 0.1, -r[2] * 0.7]);
  const pts: V3[] = [0, 0.3, 0.6, 0.85, 1].map((k) => add(top, add(scale(Z, -L * k), scale(X, -0.04 * L * k))));
  const cloth = blade(pts, [W, W, W, W * 0.6, 0.01], X, { mat: 'cloth', rib: 'cloth', fold: 0.04, thick: 0.02 });
  const rod = tube([add(top, scale(Y, -W * 1.2)), add(top, scale(Y, W * 1.2))], 0.025, 0.025, 4, 'wood', { up: [0, 0, 1] });
  // The emblem: a sprig of three leaves on its outside face.
  const face = add(top, add(scale(Z, -L * 0.45), scale(X, 0.03)));
  const em: Mesh[] = [];
  for (let q = 0; q < 3; q++) {
    const d = unit(add(scale(Z, 1), scale(Y, (q - 1) * 0.8)));
    em.push(blade([face, add(face, scale(d, W * 0.5)), add(face, scale(d, W * 0.95))], [W * 0.06, W * 0.2, W * 0.02], X, { mat: 'leaf', rib: 'leafDark', fold: 0.1, thick: 0.012 }));
  }
  em.push(tube([add(face, scale(Z, -W * 0.5)), face], 0.012, 0.012, 3, 'leafDark'));
  return merge(cloth, rod, ...em);
}

/* ---- tails, legs and paws ------------------------------------------------------------------------- */

/**
 * A link of a tail: a core of fur and soft plumes all round it lying back, green and leafy at its root and cream out to its
 * end, green leaf fronds over its root; on the kit a pink flower in it and a green leaf at its tip.
 */
function tailLinkOf(s: Herb, q: number, k: number): Mesh {
  const T = s.tails, L = T.links[q], w0 = T.w[q], w1 = T.w[Math.min(q + 1, T.w.length - 1)], n = fine ? 8 : 6, last = T.links.length - 1;
  const green = s.stage === 0 ? q < 4 : q < 2;
  const core = tube([[0, 0.05, 0], [0, -L * 0.5, 0], [0, -L - 0.03, 0]], [w0, (w0 + w1) * 0.5, w1], [w0, (w0 + w1) * 0.5, w1], n,
    (_ring, j) => (green && Math.sin(((j + 1) / n) * TAU) > -0.3 ? 'coat' : 'mark'), { start: q === 0 ? false : undefined, end: false });
  const out: Mesh[] = [core];
  const tufts = fine ? 6 : 4;
  for (let c = 0; c < tufts; c++) {
    const a = (c / tufts) * TAU + q * 0.7, nrm: V3 = [Math.cos(a), 0, Math.sin(a)];
    const id = 900 + q * 13 + c + k * 101;
    const Lk = L * (s.stage ? 1.45 : q >= 4 ? 1.5 : 1.6) * (q === 0 ? 0.6 : 1) * (0.9 + 0.2 * jitter(id));
    const root: V3 = [nrm[0] * w0 * 0.55, L * 0.15, nrm[2] * w0 * 0.55];
    const g = green && Math.sin(a) > -0.5;
    const cream: Mat[] = c % 2 ? ['mark', 'mark', 'muzzle'] : ['belly', 'mark', 'muzzle'];
    out.push(plume(root, add(scale(nrm, s.stage ? 0.3 : g ? 0.5 : 0.18), [0, -1, 0]), nrm, [0, -1, 0], Lk, w0 * (s.stage ? 1.2 : 1.5), 0.12, g ? ['coat', 'coat', 'coatLight'] : cream, s.stage ? 0.5 : 0.3));
  }
  // Leaf fronds over the root of the tail and along its top, lying back along it.
  if (q < (s.stage ? 3 : 2)) {
    const fronds = s.stage ? 5 : 3;
    for (let c = 0; c < fronds; c++) {
      const a = lerp(0.35, Math.PI - 0.35, fronds > 1 ? c / (fronds - 1) : 0.5), nrm: V3 = [Math.cos(a), 0, Math.sin(a)], id = 1500 + q * 7 + c + k * 53;
      const dir = unit(add(scale(nrm, 0.45), [0, -1, 0]));
      out.push(leaf(add([nrm[0] * w0 * 0.7, 0, nrm[2] * w0 * 0.7], [0, -L * 0.1, 0]), dir, nrm, L * (s.stage ? 1.5 : 1.3) * (0.85 + 0.3 * jitter(id)), 0.36, 0.12, jitter(id + 1) < 0.35 ? 'moss' : 'leaf', 'moss'));
    }
  }
  if (q === last) out.push(plume([0, -L * 0.3, 0], [0, -1, 0.15], [0, 0.15, 1], [0, 0, 1], w1 * (s.stage ? 2.4 : 1.6), w1 * (s.stage ? 2.2 : 1.4), 0.15, ['mark', 'muzzle'], 0.4));
  // The kit's pink flower on top of its tail, and a green leaf at its tip.
  if (s.stage === 0 && q === 2) for (const sd of [1, -1]) out.push(flower([sd * w0 * 1.1, -L * 0.4, w0 * 0.5], [sd, 0.1, 0.5], w0 * 0.8, 5, 'petal', 'bloom', sd > 0 ? 77 : 78));
  return merge(...out);
}

/** A paw: dark brown, its toes and a darker pad. */
function pawOf(s: Herb, fore: boolean, n: number): Mesh {
  const r = s.paw * (fore ? 1 : 1.08);
  const pad = orbAlong([0, r * 0.25, -r * 0.35], [0, 1, 0], [r * 0.9, r * 1.25, r * 0.62], n, 4, 'claw');
  const toes: Mesh[] = [];
  for (let q = 0; q < 4; q++) {
    const x = (q - 1.5) * r * 0.46, y = r * 1.05 - Math.abs(q - 1.5) * r * 0.14;
    toes.push(orbAlong([x, y, -r * 0.55], [0, 1, -0.3], [r * 0.26, r * 0.32, r * 0.24], 5, 3, 'pad'));
  }
  return merge(pad, ...toes);
}

/** A foreleg's wrap, round its forearm in its own frame: leaves bound on with two turns of cord, and a little pink flower. */
function legWrapOf(s: Herb, side: number, n: number): Mesh {
  const L = s.fore[1], w = s.thick, out: Mesh[] = [];
  for (const z of [-L * 0.22, -L * 0.62]) {
    const r = lerp(w * 0.86, w * 0.5, -z / L) * 1.12;
    out.push(tube([[0, 0, z + 0.03], [0, 0, z - 0.03]], r, r * 1.04, n, 'string', { up: [0, 1, 0] }));
  }
  for (let q = 0; q < 5; q++) {
    const a = lerp(-1.4, 1.4, q / 4) + (side > 0 ? 0 : Math.PI), nrm: V3 = [Math.cos(a) * side, Math.sin(a), 0];
    const r = w * 0.8;
    out.push(leaf([nrm[0] * r, nrm[1] * r, -L * 0.18], unit(add(scale(nrm, 0.2), [0, 0, -1])), nrm, L * 0.5, 0.42, 0.05, q % 2 ? 'leaf' : 'moss', 'moss'));
  }
  out.push(flower([side * w * 0.95, 0.04, -L * 0.24], [side, 0.3, 0.2], w * 0.75, 5, 'petal', 'bloom', side > 0 ? 61 : 62));
  return merge(...out);
}

/** The poultice it holds in its mouth at its task: two leaves folded over a pad, bound round with a strip of cloth. */
function poulticeOf(s: Herb): Mesh {
  const c = mouthAt(s), S = s.snout.len * 0.95;
  const out: Mesh[] = [];
  for (const sd of [1, -1]) out.push(leaf(add(c, [-sd * S * 0.5, S * 0.06, 0]), [sd, 0.15, -0.05], [0, 0.2, 1], S, 0.62, 0.08, 'leaf', 'moss'));
  out.push(orbAlong(c, [1, 0, 0], [S * 0.16, S * 0.14, S * 0.4], 6, 3, 'leafDark'));
  out.push(tube([add(c, [0, 0, S * 0.16]), add(c, [0, 0, -S * 0.16])], S * 0.14, S * 0.22, 6, 'cloth', { up: [0, 1, 0] }));
  return merge(...out);
}

/* ---- pieces ------------------------------------------------------------------------------------------- */

/** The same mesh left for right, its faces wound back the right way out. */
const mirrorX = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

function herbBuild(s: Herb, lod: number): Piece[] {
  fine = !!lod;
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6), B = s.body;
  const pieces: Piece[] = [];
  const mid = ringAt(B, 0);
  const barrel = { c: [0, (B.y[0] + B.y[B.y.length - 1]) / 2, mid.z] as V3, r: [mid.w * 0.95, (B.y[B.y.length - 1] - B.y[0]) * 0.47, mid.h * 0.95] as V3 };
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 9), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } });
  pieces.push({ key: 'ruff', mesh: ruffOf(s, n), bone: 'trunk', bias: 0.06, after: ['body', 'fl0', 'fr0'], front: [0, 1, 0], lines: false, hide: [barrel] });
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: ['head', 'body', 'ruff', 'neckFur'] });
  pieces.push({ key: 'neckFur', mesh: neckFurOf(s), bone: 'neck', bias: 0.02, after: ['neck', 'ruff'], lines: false });
  if (s.garland) pieces.push({ key: 'garland', mesh: garlandOf(s), bone: 'neck', bias: 0.07, after: ['neck', 'neckFur', 'ruff', 'body'], lines: false });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, after: 'neckFur', hide });
  const ear = earOf(s, n);
  for (const q of [0, 1]) pieces.push({ key: `ear${q}`, mesh: q ? ear : mirrorX(ear), bone: `ear${q}`, bias: 0.19, after: 'head', hide, hideIn: 'head' });
  pieces.push({ key: 'top', mesh: topOf(s), bone: 'head', bias: 0.21, after: ['head', 'ear0', 'ear1'], lines: false });
  if (s.mane) {
    const M = maneOf(s);
    pieces.push({ key: 'mane', mesh: M.neck, bone: 'neck', bias: 0.03, after: ['neck', 'neckFur'], lines: false });
    pieces.push({ key: 'cape', mesh: M.shoulders, bone: 'trunk', bias: 0.05, after: ['body', 'fl0', 'fr0'], lines: false });
  }
  for (let t = 0; t < s.tails.n; t++) {
    s.tails.links.forEach((_, q) => pieces.push({ key: `t${t}_${q}`, mesh: tailLinkOf(s, q, t), bone: `t${t}_${q}`, bias: -0.05 + q * 0.01 - Math.abs(t - (s.tails.n - 1) / 2) * 0.01, chain: `tail${t}`, lines: false }));
  }
  // What it carries on its back, and its mantle, all stirring together.
  const sways: Sway[] = [];
  if (s.mantle) sways.push(...mantleOf(s), ...blossomsOf(s));
  const G = sways.length ? stirOf(sways) : null;
  if (G) pieces.push({ key: 'mantle', mesh: G.mesh, bone: 'trunk', bias: 0.09, after: ['body', 'ruff', 'cape'], hide: [barrel], bent: stirred(s, G), even: true });
  const Bg = s.bags, bagMesh: Mesh[] = [bagOf(s, MAIN, Bg.y, Bg.r, n)];
  if (Bg.both) bagMesh.push(bagOf(s, -MAIN, Bg.y, Bg.r, n));
  if (Bg.small) bagMesh.push(bagOf(s, MAIN, Bg.y + Bg.r[1] * 1.7, scale(Bg.r, 0.62), n));
  pieces.push({ key: 'bags', mesh: merge(...bagMesh), bone: 'trunk', bias: 0.12, after: ['body', 'mantle', 'ruff'], hide: [barrel] });
  const spill: Sway[] = [];
  if (Bg.flowers) {
    spill.push(...spillOf(s, MAIN, Bg.y, Bg.r));
    if (Bg.both) spill.push(...spillOf(s, -MAIN, Bg.y, Bg.r));
  }
  if (Bg.bouquet) spill.push(...bouquetOf(s, Bg.y, Bg.r));
  if (spill.length) {
    const S = stirOf(spill);
    pieces.push({ key: 'spill', mesh: S.mesh, bone: 'trunk', bias: 0.14, after: ['bags', 'mantle'], lines: false, bent: stirred(s, S) });
  }
  if (s.vials) {
    const { c, X, Y, Z } = bagFrame(s, MAIN, Bg.y, Bg.r), R = Bg.r[2] * 0.5;
    const tops = [inFrame(c, X, Y, Z, [Bg.r[0] * 1.15, -Bg.r[1] * 0.45, -Bg.r[2] * 0.2]), inFrame(c, X, Y, Z, [Bg.r[0] * 1.15, Bg.r[1] * 0.1, -Bg.r[2] * 0.3])];
    const vials = tops.slice(0, s.vials).map((p, q) => vialOf(p, R * (q ? 1.1 : 0.95), X, Bg.r[2] * (0.25 + 0.2 * q)));
    const V = stirOf(vials.map((m, q) => ({ mesh: m, root: tops[q], id: 70 + q, k: 1.4 })));
    pieces.push({ key: 'vials', mesh: V.mesh, bone: 'trunk', bias: 0.16, after: ['bags', 'banner'], bent: stirred(s, V) });
  }
  if (s.banner) {
    const { c, X, Y, Z } = bagFrame(s, MAIN, Bg.y, Bg.r), top = inFrame(c, X, Y, Z, [Bg.r[0] * 0.65, -Bg.r[1] * 0.1, -Bg.r[2] * 0.7]);
    const Ban = stirOf([{ mesh: bannerOf(s, Bg.y, Bg.r), root: top, id: 90, k: 0.8 }]);
    pieces.push({ key: 'banner', mesh: Ban.mesh, bone: 'trunk', bias: 0.13, after: ['bags', 'body'], bent: stirred(s, Ban) });
  }
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = fore ? s.fore : s.hind, w = s.thick;
    const sideV: V3 = [side, 0, 0], out3: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const hw = fore ? w * 1.35 : w * (s.stage ? 1.7 : 1.55);
    const hc: V3 = [0, fore ? 0 : -w * 0.15, fore ? 0 : -w * 0.2], hr: V3 = [hw, hw * (fore ? 1.1 : 1.15), hw * (fore ? 1.2 : 1.1)];
    // The tops of its legs cream, a green mottle over the haunch; its lower legs cream into green socks over the dark paws.
    const upperM = merge(
      orb(hc, hr, n, k, 'mark'),
      tube([[0, 0, -w * 0.3], [0, 0, -L[0]]], [hw * 0.8, w * 0.85], [hw * 0.8, w * 0.85], n, 'mark', { seam: 'start' }),
      orb([0, 0, -L[0]], w * 0.86, n, k, 'mark'),
      paint([leafOn(onEgg2(hc, hr, [side, -0.3, 0.5]).p, onEgg2(hc, hr, [side, -0.3, 0.5]).n, hw * (fore ? 1.0 : 1.5), hw * (fore ? 0.7 : 1.1), 0.6, 'coat'),
        leafOn(onEgg2(hc, hr, [side, 0.4, -0.3]).p, onEgg2(hc, hr, [side, 0.4, -0.3]).n, hw * 0.8, hw * 0.5, -0.4, 'coatLight')]),
    );
    const lowerM = tube([[0, 0, w * 0.5], [0, 0, -L[1] * 0.45], [0, 0.01, -L[1]]], [w * 0.86, w * 0.64, w * 0.44], [w * 0.9, w * 0.68, w * 0.46], n,
      (ring) => (ring >= 1 ? 'coat' : 'mark'), { seam: 'start' });
    const lastM = tube([[0, 0, w * 0.35], [0, 0.01, -L[2] - s.paw * 0.2]], [w * 0.42, w * 0.36], [w * 0.44, w * 0.38], n, 'coat', { seam: 'start' });
    pieces.push(
      { key: `${key}0`, mesh: upperM, bone: `${key}0`, bias: 0.01, after: ['body'], front: sideV },
      { key: `${key}1`, mesh: merge(lowerM, fore && s.wraps ? legWrapOf(s, side, n) : false), bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front: out3 },
      { key: `${key}3`, mesh: lastM, bone: `${key}3`, bias: 0.025, after: ['body', `${key}1`], front: out3 },
      { key: `${key}2`, mesh: pawOf(s, fore, n), bone: `${key}2`, bias: 0.03, after: ['body', `${key}3`], front: out3 },
    );
    // Cream fur over the tops of the bigger two's hind legs, their breeches.
    if (s.stage > 0 && !fore) {
      const tuft: Mesh[] = [];
      for (let q = 0; q < 7; q++) {
        const a = lerp(-0.9, 0.9, q / 6), nrm: V3 = [side * Math.cos(a) * 0.8, -Math.sin(a) * 0.4 - 0.4, -0.2];
        const root: V3 = add([0, 0, -L[0] * (0.22 + 0.1 * (q % 2))], scale(unit(nrm), w * 1.1));
        const Lf = s.ruff.len * 0.7 * (0.85 + 0.3 * jitter(700 + q + i * 9));
        tuft.push(plume(root, add(scale(unit(nrm), 0.35), [0, -0.2, -1]), nrm, [0, -1, 0], Lf, Lf * 0.55, 0.06, ['mark', 'mark', 'muzzle'], 0.22));
      }
      pieces.push({ key: `${key}f`, mesh: merge(...tuft), bone: `${key}0`, bias: 0.022, after: [`${key}0`, `${key}1`], front: sideV, lines: false });
    }
  }
  pieces.push({ key: 'poultice', mesh: poulticeOf(s), bone: 'head', bias: 0.3, after: ['head', 'fr2', 'fl2'], shown: (a) => a.act?.kind === 'work' });
  return pieces;
}

/* ---- what it lets fall, and its light --------------------------------------------------------- */

const css = (c: RGB, al = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** The colours of the bits of leaf it lets fall: leaf green, young green, dark green; and its blossoms' pink. */
const BIT_RGB: readonly RGB[] = [[112, 158, 58], [172, 204, 84], [70, 108, 44], [246, 176, 184]];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's bits in the air are drawn: less than in proportion on the small one, so they still read. */
const bigness = (s: Herb): number => 0.3 + 0.7 * (s.len / 1.7);
/** Where something thrown from `p` at `v` is after `t` seconds, falling at `fall`, never under the ground. */
const thrown = (p: V3, v: V3, t: number, fall: number): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];

/** A bit of leaf turning as it falls: a narrow pointed shape, `len` long, turned `ang`, a darker edge. */
function sliver(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB): void {
  if (len <= 0.02) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.38 * Math.abs(Math.cos(ang * 1.7)) - len * 0.08, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.16, -len / 2, 0);
  g.fillStyle = css(c);
  g.fill();
  g.lineWidth = len * 0.07;
  g.strokeStyle = css(mix(c, [30, 50, 20], 0.55));
  g.stroke();
  g.restore();
}

/** Its work: bits of leaf off the poultice at each press, falling and turning; and the strip wound round, a cream line from its mouth. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Herb, bones: (a: Anim) => Bones, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, loop = a.graze >= 0.5;
  HERB_WORK.presses.forEach((c, k) => {
    const since = t >= c ? (t - c) * ACT_SECS.work : loop ? (t + 1 - c) * ACT_SECS.work : -1;
    if (since < 0 || since > 0.85) return;
    const at = bones({ ...a, act: { kind: 'work', t: c } });
    const from = place(at.head, mouthAt(s));
    for (let q = 0; q < 7; q++) {
      const id = k * 17 + q * 5;
      const v: V3 = [(jitter(id) - 0.5) * 1.6 * big, (jitter(id + 1) - 0.1) * 1.2 * big, (0.2 + 0.6 * jitter(id + 2)) * big];
      const p = thrown(from, v, since, 6 * big);
      p[0] += Math.sin(since * 9 + id) * 0.1 * big;
      // Gone before it lands: nothing it lets fall is drawn on the ground.
      if (p[2] < 0.12 * big || nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const gone = (1 - ramp(since, 0.6, 0.85)) * ramp(p[2], 0.12 * big, 0.3 * big);
      sliver(g, x, y, (0.3 + 0.14 * jitter(id + 3)) * big * gone, since * 7 + id, BIT_RGB[(q + k) % 3]);
    }
  });
  const w = wrapOf(t);
  if (front && w > 0.02) {
    // The strip: from its mouth out to the dressing and round, a few turns of cream cloth going round as it winds.
    const m = place(b.head, mouthAt(s));
    const press = place(bones({ ...a, act: { kind: 'work', t: HERB_WORK.presses[1] } }).head, mouthAt(s));
    const u = clamp((t - HERB_WORK.wrap[0]) / (HERB_WORK.wrap[1] - HERB_WORK.wrap[0])), r = s.snout.len * 0.35;
    g.save();
    g.strokeStyle = 'rgb(248,240,222)';
    g.lineWidth = Math.max(0.03, s.snout.h * 0.5) * w;
    g.lineCap = 'round';
    g.beginPath();
    const steps = 14;
    for (let q = 0; q <= steps; q++) {
      const f = q / steps, ang = f * TAU * 1.5 + u * TAU * 2;
      const p = mixV(m, add(press, [Math.cos(ang) * r, 0.05, Math.sin(ang) * r * 0.6]), f);
      const [x, y] = onScreen(view, p);
      if (q) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.restore();
  }
}

/** What a strike throws: bits of leaf off its paw as it lands. */
function strikeBits(g: CanvasRenderingContext2D, view: View, s: Herb, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t, since = (t - HERB_HITS[s.stage]) * ACT_SECS.strike;
  if (since < 0 || since > 0.6) return;
  const from = place(b.fr2, [0, s.paw * 2, 0]);
  for (let q = 0; q < 7; q++) {
    const id = 300 + q * 7;
    const v: V3 = [(jitter(id) - 0.5) * 2 * big, (0.3 + jitter(id + 1)) * 1.5 * big, (0.5 + jitter(id + 2)) * big];
    const p = thrown(from, v, since, 6 * big);
    if (p[2] < 0.12 * big || nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    sliver(g, x, y, 0.3 * big * (1 - since / 0.6) * ramp(p[2], 0.12 * big, 0.3 * big), since * 8 + id, BIT_RGB[q % BIT_RGB.length]);
  }
}

/**
 * Evolving: a burst of leaves and petals off its back as it begins, which covers the moment it changes into its new body;
 * then a swirl of them going round and up it as its new leaves grow.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Herb, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t;
  const burst = ramp(t, 0, 0.02) * (1 - ramp(t, 0.12, 0.3));
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 26; q++) {
      const th = (q / 26) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * s.body.w[3] * 0.4, s.body.y[3] + Math.sin(th) * s.len * 0.3, s.body.h[3] * 0.8]);
      const v: V3 = [Math.cos(th) * (2 + 2 * jitter(q + 3)), Math.sin(th) * (2 + 2 * jitter(q + 5)), 3 + 3 * jitter(q + 7)];
      const p = thrown(from, scale(v, big), since, 5 * big);
      if (p[2] < 0.12 * big || nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      sliver(g, x, y, 0.5 * big * burst, q * 1.3 + since * 8, BIT_RGB[q % BIT_RGB.length]);
    }
  }
  const swirl = ramp(t, 0.08, 0.18) * (1 - ramp(t, 0.66, 0.86));
  if (swirl > 0) {
    const rx = s.body.w[3] * 1.35 + 0.3 * big, ry = s.len * 0.75 + 0.3 * big, top = s.body.h[3] * 2 + big;
    for (let q = 0; q < 18; q++) {
      const rise = frac(t * 1.6 + jitter(q + 20));
      const ang = (q / 18) * TAU + t * 9;
      const p = place(b.trunk, [Math.cos(ang) * rx, Math.sin(ang) * ry, -s.body.h[3] * 0.6 + rise * top]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      sliver(g, x, y, 0.42 * big * swirl * Math.sin(rise * Math.PI), ang * 2 + q, BIT_RGB[q % BIT_RGB.length]);
    }
  }
}

/** Light over the whole of it as it evolves: a soft green-gold glow as it begins, and over its back at the turn. */
function herbGlow(s: Herb, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 0.6]), r: s.body.y[6] - s.body.y[0], c: [210, 240, 160], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 1.4]), r: s.len * 0.9 + 0.5, c: [236, 246, 180], a: k });
  return out;
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function herbKind(s: Herb): Kind {
  const bones = herbBones(s);
  return {
    bones,
    build: (lod) => herbBuild(s, lod),
    // The variant's coat for the green of its fur and its markings for the cream; the sheet's leaves, blossoms, leather,
    // glass and tonic, and its amber eyes and dark brown paws, the same on every variant.
    palette: (coat, mark) => {
      const green = mix(coat, [146, 164, 34], 0.6), cream = mix(mark, [238, 208, 160], 0.62);
      return coatPalette(coat, mark, {
        coat: green,
        coatDark: mix(green, [80, 110, 26], 0.55),
        coatLight: mix(green, [214, 218, 92], 0.45),
        mark: cream,
        belly: mix(cream, [222, 200, 164], 0.45),
        muzzle: mix(cream, [250, 236, 210], 0.35),
        inner: [222, 150, 136],
        nose: [70, 44, 36],
        lid: [104, 52, 46],
        eye: [52, 30, 20],
        glint: [255, 253, 246],
        crystal: [232, 146, 36],
        claw: [104, 68, 44],
        pad: [80, 50, 34],
        tongue: [238, 128, 128],
        leaf: [118, 152, 34],
        leafDark: [76, 108, 28],
        moss: [184, 204, 60],
        stem: [118, 104, 58],
        petal: [248, 176, 182],
        bloom: [246, 184, 60],
        cap: [252, 216, 92],
        feather: [178, 146, 214],
        featherDark: [138, 104, 178],
        horn: [232, 214, 140],
        leather: [146, 94, 58],
        leatherDark: [100, 62, 40],
        leatherLit: [176, 122, 78],
        metal: [216, 172, 82],
        water: [222, 236, 228],
        flame: [240, 168, 48],
        cloth: [248, 238, 214],
        string: [196, 150, 92],
        wood: [150, 104, 64],
      } as Partial<ReturnType<Kind['palette']>>);
    },
    shadow: [s.len * 0.75 + 0.4, s.body.w[3] * 1.5],
    stride: 1,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are leaf green and blossom pink.
    motes: [[150, 196, 90], [246, 180, 188]],
    glow: (b, a) => herbGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') strikeBits(g, view, s, b, act.t, front);
      else if (act.kind === 'work') workBits(g, view, s, bones, b, a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const HERBPUP = herbKind(HERBPUP_LOOK);
export const HERBFOX = herbKind(HERBFOX_LOOK);
export const HERBWARDEN = herbKind(HERBWARDEN_LOOK);
