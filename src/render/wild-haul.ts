import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type MatOf, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The haul line: the Cartling, a little cream calf in a woolly coat dappled
 * tan, a mane and a tail of green leaves and tufts of them round its legs,
 * in a plain brown leather harness with a white flower at its chest, which
 * grows into the Wagonox, a sturdy young ox with curling ram's horns, hitched
 * to a wooden pole along each side of it by brass rings and buckles, a brass
 * bell and tassels at its chest; and then the Haulhorn, a huge stocky beast
 * with great curling horns hung with leaves and a white flower on its brow,
 * under a heavy harness with a yoke bar across its withers, a big brass bell,
 * tassels, and green banners embroidered with a flower hanging at its
 * shoulders, its mane and legs shaggy with leaves. The species is still
 * `roxxen` underneath, as saves and the database know it: the draught beast
 * put to large carts and wagons, that learns driving in the traces.
 *
 * All three are built by one set of functions from a description of the stage
 * (`Haul`), and walk the way the brick line does (`./wild-brick`): every foot
 * is given a point to be at and its leg bent to reach it, so a planted foot
 * stays where it was put. Its legs stand straight down under it: each bends
 * at a joint up against its belly, the elbow back on a fore leg and the
 * stifle forward on a hind one, always the same way round, so it never flips.
 * It walks a four-beat walk -- a hind foot, then the fore foot on that side --
 * and trots at a run, its head nodding at each fore footfall, its bell
 * swinging, its leaves bouncing. At its task it leans into its harness and
 * hauls: its chest dropped and pushed forward, its head down, digging in a
 * fore foot and then a hind at each heave, its bell swinging on.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Haul {
  stage: 0 | 1 | 2;
  /**
   * The barrel's rings, rump to chest: its rump, haunch, loin, middle, ribs, shoulders and chest, as it is described; drawn
   * rounded off at both ends (`rounded`), and kept as described in `marks`, where things are put along it by name.
   */
  body: Rings;
  marks?: Rings;
  /** Hip to shoulder. */
  len: number;
  /** How far out the hips and shoulders are, as a share of the barrel's width there, and how far down into it, as a share of its depth. */
  hip: number;
  drop: number;
  /** How much of a leg's length is its upper part, mostly up inside the body; how far a standing leg is from straight (its reach used); the fetlock's height over the ground. */
  upper: number;
  stand: number;
  ankle: number;
  /** How thick a leg is (a radius). */
  thick: number;
  /** How high the middle of the barrel is carried. */
  high: number;
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull's half-sizes (across, along, up); the muzzle's; how far up the skull sits from the neck; the head's pitch. */
  head: { r: V3; muzzle: V3; up: number; pitch: number };
  eye: { dir: V3; size: number };
  /** Each ear: its length and width, and how far it droops below level (degrees). */
  ear: { len: number; w: number; droop: number };
  /**
   * Its horns, a ram's curl from the back of its head (`hornGeom`): how big the curl is, how thick at the root and the tip; how
   * far back it reaches, how far out to the side, and how tall it is, as shares of its size; and how far back on the skull its
   * root is, as a share of the skull's length. Nubs when `r` is nought, `w[0]` across.
   */
  horn: { r: number; w: [number, number]; back: number; sweep: number; flat: number; root: number };
  /** Its mane: rows of leaves round the neck, how long each leaf is; how far back along its spine leaves come (a share of the barrel's length from the shoulders), and how far down its flanks. */
  mane: { rows: number; leaf: number; back: number; low: number; rump: number };
  tail: { at: V3; links: number[]; w: number; leaf: number };
  /** What it wears: a plain harness, a harness with poles and a bell, or a heavy one with a yoke bar, a big bell and banners. */
  gear: 0 | 1 | 2;
  gait: {
    /** How much of a stride a foot is down at a walk and at a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the body goes down at a footfall; how far it rolls (degrees); how far the head nods (degrees). */
    step: number; bob: number; roll: number; nod: number;
  };
  size: number;
}

/** A Cartling: a little cream calf, a big round head with no horns but two nubs, a leafy mane and tail and leaf tufts round its legs, a plain leather harness with a flower at its chest. */
const CARTLING_LOOK: Haul = {
  stage: 0,
  body: { y: [-0.92, -0.82, -0.5, 0, 0.46, 0.76, 0.9], z: [0.04, 0.03, 0, 0, 0.03, 0.06, 0.08], w: [0.3, 0.55, 0.65, 0.68, 0.68, 0.59, 0.3], h: [0.29, 0.5, 0.56, 0.57, 0.59, 0.54, 0.29] },
  len: 1.1, hip: 0.56, drop: 0.3,
  upper: 0.24, stand: 0.92, ankle: 0.13, thick: 0.26,
  high: 0.82,
  neck: { at: [0, 0.68, 0.28], len: 0.24, w: 0.4, lean: 34 },
  head: { r: [0.66, 0.66, 0.62], muzzle: [0.4, 0.39, 0.33], up: 0.28, pitch: -2 },
  eye: { dir: [0.66, 0.62, 0.32], size: 0.18 },
  ear: { len: 0.5, w: 0.21, droop: 38 },
  horn: { r: 0, w: [0.085, 0.05], back: 0, sweep: 0, flat: 1, root: 0 },
  mane: { rows: 3, leaf: 0.31, back: 0.1, low: 0.6, rump: 0 },
  tail: { at: [0, -0.88, 0.22], links: [0.14, 0.13, 0.12], w: 0.08, leaf: 0.36 },
  gear: 0,
  gait: { duty: [0.64, 0.34], swing: [0.25, 0.31], step: 0.2, bob: 0.03, roll: 3, nod: 7 },
  size: 3.0,
};

/** A Wagonox: a sturdy young ox, curling ram's horns, a leafy mane over its shoulders, a wooden pole along each side hitched to its harness with brass rings, a brass bell and tassels at its chest, a flower at its shoulder. */
const WAGONOX_LOOK: Haul = {
  stage: 1,
  body: { y: [-1.72, -1.56, -1.0, 0, 0.95, 1.45, 1.68], z: [0.05, 0.04, 0, 0, 0.05, 0.1, 0.13], w: [0.42, 0.78, 0.94, 0.97, 1.0, 0.9, 0.44], h: [0.44, 0.74, 0.85, 0.87, 0.92, 0.86, 0.44] },
  len: 2.2, hip: 0.55, drop: 0.28,
  upper: 0.22, stand: 0.92, ankle: 0.2, thick: 0.3,
  high: 1.72,
  neck: { at: [0, 1.4, 0.48], len: 0.72, w: 0.64, lean: 22 },
  head: { r: [0.78, 0.85, 0.72], muzzle: [0.5, 0.57, 0.42], up: 0.27, pitch: -4 },
  eye: { dir: [0.68, 0.6, 0.3], size: 0.185 },
  ear: { len: 0.62, w: 0.26, droop: 24 },
  horn: { r: 0.72, w: [0.26, 0.08], back: 0.95, sweep: 0.62, flat: 1.0, root: 0.32 },
  mane: { rows: 4, leaf: 0.56, back: 0.1, low: 0.75, rump: 0.5 },
  tail: { at: [0, -1.66, 0.42], links: [0.22, 0.2, 0.18], w: 0.12, leaf: 0.62 },
  gear: 1,
  gait: { duty: [0.66, 0.34], swing: [0.24, 0.3], step: 0.18, bob: 0.042, roll: 8, nod: 5 },
  size: 2.65,
};

/** A Haulhorn: huge and stocky, great curling horns hung with leaves and a white flower on its brow, a thick leafy mane and shaggy leafy legs, a heavy harness with a yoke bar and poles, a big brass bell, tassels and green banners. */
const HAULHORN_LOOK: Haul = {
  stage: 2,
  body: { y: [-2.4, -2.2, -1.4, 0, 1.3, 2.0, 2.32], z: [0.08, 0.07, 0.02, 0.02, 0.08, 0.16, 0.2], w: [0.62, 1.12, 1.34, 1.38, 1.44, 1.3, 0.64], h: [0.66, 1.08, 1.22, 1.24, 1.32, 1.24, 0.66] },
  len: 3.0, hip: 0.55, drop: 0.26,
  upper: 0.22, stand: 0.92, ankle: 0.28, thick: 0.46,
  high: 2.5,
  neck: { at: [0, 1.95, 0.6], len: 1.12, w: 0.92, lean: 18 },
  head: { r: [0.98, 1.06, 0.9], muzzle: [0.61, 0.7, 0.51], up: 0.32, pitch: -4 },
  eye: { dir: [0.7, 0.58, 0.32], size: 0.205 },
  ear: { len: 0.8, w: 0.33, droop: 22 },
  horn: { r: 1.1, w: [0.36, 0.1], back: 1.05, sweep: 0.7, flat: 0.85, root: 0.5 },
  mane: { rows: 5, leaf: 0.74, back: 0.08, low: 0.5, rump: 0.75 },
  tail: { at: [0, -2.34, 0.62], links: [0.3, 0.28, 0.26], w: 0.17, leaf: 0.9 },
  gear: 2,
  gait: { duty: [0.68, 0.36], swing: [0.22, 0.29], step: 0.16, bob: 0.048, roll: 8.5, nod: 4 },
  size: 2.65,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a mane of leaves is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

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
/** A point `off` out from the barrel, `y` along it and `th` round it, and the way out there. */
const outer = (s: Haul, y: number, th: number, off: number): { p: V3; n: V3 } => { const q = onRings(s.body, y, th); return { p: add(q.p, scale(q.n, off)), n: q.n }; };

/** A frame standing along `up` with its front along `fwd`: across, forward and up. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
/** A bone's frame from its three axes and where it is. */
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
/** A frame's turn applied to a direction. */
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };

/** Each face wound so it faces the way its own wanted direction says, whichever way round it was listed. */
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
/** Each face wound so it faces away from `mid`. */
function woundOut(v: readonly V3[], f: Face[], mid: V3): Face[] {
  return woundTo(v, f, f.map((face) => sub(scale(face.i.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / face.i.length), mid)));
}

/** A flat painted shape through `pts`, wound so it faces along `n`. */
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

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth's line. */
function lineOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.015)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  return facingDisc(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** A block, `r` half-sizes along the frame's axes, six flat faces. */
function block(c: V3, r: V3, f: [V3, V3, V3], mat: MatOf): Mesh {
  const [X, Y, Z] = f;
  const v: V3[] = [];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1]) v.push(add(c, add(add(scale(X, sx * r[0]), scale(Y, sy * r[1])), scale(Z, sz * r[2]))));
  const m = (q: number): Mat => (typeof mat === 'function' ? mat(q, 0) : mat);
  const f6: Face[] = [
    { i: [0, 2, 3, 1], m: m(0) }, { i: [4, 5, 7, 6], m: m(1) },
    { i: [0, 1, 5, 4], m: m(2) }, { i: [2, 6, 7, 3], m: m(3) },
    { i: [0, 4, 6, 2], m: m(4) }, { i: [1, 3, 7, 5], m: m(5) },
  ];
  return mesh(v, woundOut(v, f6, c));
}

/* ---- leaves, flowers, fur --------------------------------------------------------------- */

/**
 * A thin flat thing along a line of points -- a leaf, a petal, a lock of fur -- `widths` across it (half-widths) at each, its
 * face turned along `face`, its edges lifted by `fold` of its width so it is a shallow V down its middle: the half to its
 * left in `mats[0]` and to its right in `mats[1]`, so the fold reads as a rib, and its underside in `mats[2]`.
 */
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

/** The colours a leaf or a lock comes in: the deep green, the young spring green, or cream fur; each a top in two halves and an underside. */
type Tone = 'green' | 'spring' | 'deep' | 'fur';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = {
  green: ['leaf', 'stem', 'stem'], spring: ['moss', 'leaf', 'leaf'], deep: ['stem', 'leafDark', 'leafDark'], fur: ['belly', 'muzzle', 'coat'],
};
/** Which of the two greens a leaf is: mostly the deep one, now and then the paler green of a young leaf. */
const toneOf = (i: number, spring = 0.38): Tone => { const k = jitter(i * 3 + 1); return k < spring ? 'spring' : k > 0.86 ? 'deep' : 'green'; };

/** A leaf: a broad pointed oval along a gentle arch from `root` the way `dir` goes, `len` long and `w` across, its face turned along `face`. */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, K: number, tone: Tone, arch = 0.14, sharp = 0.7): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const tip = add(root, scale(d, len)), mid = add(add(root, scale(d, len * 0.5)), scale(f, len * arch));
  const widths = Array.from({ length: K }, (_, k) => Math.max(0.012, w * Math.sin(Math.PI * Math.min(0.999, (k / (K - 1)) ** sharp)) ** 0.8));
  return sheet(curve(root, mid, tip, K - 1), widths, f, 0.25, TONES[tone]);
}

/** A lock of cream fur: narrow and pointed, from `root` down the way `dir` goes, hanging in a curve. */
const lock = (root: V3, dir: V3, face: V3, len: number, K: number): Mesh => leaf(root, dir, face, len, len * 0.34, K, 'fur', 0.18, 0.9);

/**
 * A small five-petalled white flower at `c`, facing along `n`, `r` across, round a yellow middle; each petal's colour painted on
 * both faces always lit, so a flower turned from the light is still white.
 */
function flower(c: V3, n: V3, r: number, spin = 0): Mesh {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (len3(x) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const paints: Disc[] = [];
  const petals = Array.from({ length: 5 }, (_, q) => {
    const t = spin + (q / 5) * TAU, d = add(scale(x, Math.cos(t)), scale(y, Math.sin(t)));
    const at = (k: number, lift: number): V3 => add(add(c, scale(d, r * k)), scale(z, r * lift));
    for (const sd of [1, -1]) paints.push(disc(add(at(0.56, 0.11), scale(z, sd * 0.012)), scale(z, sd), r * 0.38, r * 0.32, 7, 'petal', { up: cross(z, d), lit: true }));
    return sheet([at(0.12, 0.05), at(0.56, 0.12), at(0.98, 0.08)], [r * 0.22, r * 0.44, r * 0.2], z, 0.12, ['petal', 'petal', 'petal']);
  });
  for (const sd of [1, -1]) paints.push(disc(add(c, scale(z, sd * r * 0.16)), scale(z, sd), r * 0.26, r * 0.26, 7, 'bloom', { lit: true }));
  return merge(...petals, orbAlong(add(c, scale(z, r * 0.14)), z, [r * 0.27, r * 0.27, r * 0.14], 6, 3, 'bloom'), paint(paints));
}

/** One leaf or flower of a piece of them: its mesh, where it is rooted, the way it lifts when it rustles. */
interface Frond { mesh: Mesh; root: V3; out: V3; len?: number }
/** A mesh of them with, for each corner, how far out along its leaf it is, which way it lifts and where it is rooted. */
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

/** `v` turned `a` radians about `k` (a unit direction). */
function about(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), sn = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), sn)), scale(k, dot(k, v) * (1 - c)));
}

/**
 * A cluster of leaves from one root: three pointed leaves splayed out from it like a sprig -- the middle one out and down the way
 * `down` says, the other two either side of it, shorter, each tipped its own way to the light -- so a mane of them is shaggy and
 * stands out from the body in tufts, rather than lying on it in rows like shingles. `out` is the way out of the surface.
 */
function cluster(root: V3, out: V3, down: V3, len: number, K: number, id: number, stand = 0.75, count = 3): Frond[] {
  const o = unit(out), d0 = unit(add(scale(o, stand), down)), res: Frond[] = [];
  for (let q = 0; q < count; q++) {
    const side = count === 1 ? 0 : (q / (count - 1)) * 2 - 1, k = 1 - 0.22 * Math.abs(side), lid = id * 7 + q;
    const dir = unit(add(about(d0, o, side * 0.62 + (jitter(lid) - 0.5) * 0.25), scale(o, 0.15 * Math.abs(side))));
    const face = unit(add(o, scale(about(cross(dir, o), dir, 0), (jitter(lid + 2) - 0.5) * 0.9)));
    const l = len * k * (0.88 + 0.24 * jitter(lid + 1)), r = add(root, scale(dir, -l * 0.08));
    res.push({ mesh: leaf(r, dir, face, l, l * 0.52, K, toneOf(lid, 0.3), 0.16, 0.62), root: r, out: o, len: l });
  }
  return res;
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Cartling's headbutt, the Wagonox's hooking butt, the Haulhorn's horn toss. */
export const HAUL_HITS: readonly number[] = [0.5, 0.52, 0.56];
/** When the Haulhorn's fore feet come down after its toss, as a share of the strike. */
export const HAUL_STAMP = 0.72;
/**
 * A go at its task, as shares of it: each fore foot dug in (the moment it is set down), the heave after each, and each hind
 * foot shifted to push (set down). It loops, so a go and the next are one haul.
 */
export const HAUL_WORK = { digs: [0.2, 0.7] as const, heaves: [0.3, 0.8] as const, pushes: [0.46, 0.96] as const } as const;

/** A bump at `c` that goes round the end of a loop and on from its start: for a go at its task that is played over and over. */
const loopHump = (t: number, c: number, r: number): number => { const d = Math.abs(frac(t - c + 0.5) - 0.5); return smooth(1 - d / r); };

/* ---- where its feet go ---------------------------------------------------------------- */

/** A pose: where each ankle is (along the ground, from under the body's middle) and how its hoof is pitched; and how the rest is carried. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The neck bent forward and turned left; the head pitched nose-up, turned left and tilted. */
  neck: [number, number]; head: [number, number, number];
  /** The tail lifted and swung to the left; the ears lifted. */
  tail: [number, number]; ears: number;
}

interface Rest {
  /** Each hip and shoulder, in the body's frame; each ankle standing, along the ground; each leg's two lengths. */
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
}

const rests = new Map<Haul, Rest>();
function restOf(s: Haul): Rest {
  const had = rests.get(s);
  if (had) return had;
  const B = s.body, hip: V3[] = [], ankle: V3[] = [], reach: number[] = [], legs: Array<[number, number]> = [];
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, y = (fore ? 0.5 : -0.5) * s.len, r = ringAt(B, y);
    const h: V3 = [SIDE[i] * r.w * s.hip, y, r.z - r.h * s.drop];
    hip.push(h);
    // Straight down under its hip, a hoof's height up.
    ankle.push([h[0], y, s.ankle]);
    const D = s.high + h[2] - s.ankle, total = D / s.stand;
    legs.push([total * s.upper, total * (1 - s.upper)]);
    reach.push(total);
  }
  const R = { hip, ankle, legs, reach };
  rests.set(s, R);
  return R;
}

function restPlan(s: Haul, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    neck: [0, 0], head: [0, 0, 0], tail: [0, 0], ears: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    neck: [m(a.neck[0], b.neck[0]), m(a.neck[1], b.neck[1])], head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    tail: [m(a.tail[0], b.tail[0]), m(a.tail[1], b.tail[1])], ears: m(a.ears, b.ears),
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
    tail: [d(p.tail[0], to.tail[0], from.tail[0]), d(p.tail[1], to.tail[1], from.tail[1])], ears: d(p.ears, to.ears, from.ears),
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

/**
 * When each foot comes down in a stride: at a walk the four-beat walk of an ox, a hind foot and then the fore foot on its
 * side, a quarter of a stride apart; at a run a trot, the diagonals together.
 */
const WALK_BEATS = [0.25, 0.75, 0, 0.5];
const RUN_BEATS = [0, 0.5, 0.5, 0];
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.12;
/** How far through a stride the fore foot on its right comes down (the head nods as each fore foot does). */
const beatOf = (i: number, g: number): number => lerp(WALK_BEATS[i], RUN_BEATS[i], g);

/**
 * Going: each foot down for its share of a stride and swept back under the body at the ground's own speed, so it never skates,
 * then picked up, its hoof tucked back, and brought forward through the air. The body sinks a little as each foot takes its
 * weight and rolls over onto the side whose feet are down; the head nods down as each fore foot lands and lifts as it pushes
 * off, the ears flopping with it, and the tail swings from side to side once a stride.
 */
function goingPlan(s: Haul, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  for (let i = 0; i < 4; i++) {
    const L = R.reach[i], half = L * amp, A = R.ankle[i], ph = frac(a.u + beatOf(i, g));
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.35 * g);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    // Lifted high early in the swing, as a hoof is picked up and tucked back, and reached forward low before it lands.
    // At a run snatched up off the ground at once, so for a moment after each pair pushes off no foot is on it.
    const up = lerp(Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 1.2, Math.sin(Math.PI * u) ** 0.45, g);
    p.at[i] = [A[0], y, A[2] + lift * up];
    p.foot[i] = (i < 2 ? -42 : -26) * Math.sin(Math.PI * Math.min(1, u * 1.2)) ** 1.5;
  }
  // Lowest just after each footfall: twice a stride at a walk (a fore and a hind together near enough), twice at a trot.
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - beatOf(1, g) - 0.04));
  // At a run it bounds: lowest in the middle of each diagonal's stance and thrown up off it, so for a moment after each pair
  // pushes off all four feet are off the ground.
  const spring = 0.5 - 0.5 * Math.cos(2 * TAU * (w - duty * 0.5 - 0.25));
  p.H += s.len * (-G.bob * (1 - 0.3 * g) * down * (1 - g) + g * (0.045 * spring - 0.01));
  // Its weight carried over onto the side whose fore foot is down: the body shifted over it and rolled onto it, the shoulders
  // and hips rocking with each step -- most on the big ones, which have most weight to carry over.
  const over = Math.sin(TAU * (w - beatOf(1, g) + 0.25 - duty / 2));
  p.roll = G.roll * over * (1 - 0.4 * g);
  p.side = s.len * 0.022 * over * (1 - 0.5 * g);
  // Pitched a little forward at a run and rocking fore and aft with each bound.
  p.pitch = 1.2 * Math.cos(2 * TAU * (w - beatOf(1, g))) * (1 - g) - 3 * g + 3.5 * g * Math.sin(2 * TAU * (w - duty * 0.5));
  // The head nods down as each fore foot lands and comes up as it pushes off; much deeper at a run.
  const nod = Math.cos(2 * TAU * (w - beatOf(1, g) - 0.06));
  p.head[0] = -G.nod * (1 + 1.2 * g) * nod - 4 * g;
  p.neck = [3 * (1 + g) * nod + 12 * g, 3 * Math.sin(TAU * (w - beatOf(1, g)))];
  p.ears = 0.5 * nod;
  p.tail = [g * 18 + 4 * down, 16 * Math.sin(TAU * (w - 0.1)) * (1 - 0.3 * g)];
  return p;
}

/**
 * Standing about: breathing, looking about, its ears flicking and its tail swishing; now and then a toss of its head that sets
 * its bell swinging, and once a loop its weight shifted off a hind foot, rested on its toe, and back.
 */
function stillPlan(s: Haul, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const look = drift(t);
  p.neck = [-1 + 2 * a.breath, 10 * look];
  p.head = [3 * cyc(t, 5), 9 * look, 4 * drift(t, 2)];
  p.tail = [2 * cyc(t, 3, 1), 12 * cyc(t, 4) + 18 * beat(t, [3.1, 16.4], 0.8) * Math.sin((t % 0.8) * TAU * 2.5)];
  p.ears = 0.15 * cyc(t, 6) + 0.9 * beat(t, [5.2, 11.0, 19.6], 0.5);
  p.H += 0.01 * s.len * (a.breath - 0.5);
  // The toss: head down, then flung up and shaken.
  const toss = beat(t, [8.4, 20.8], 1.3);
  if (toss > 0) {
    const k = (t % 1.3) / 1.3;
    const shake = Math.sin(k * TAU * 3) * hump(k, 0.6, 0.35);
    p.neck[0] += 10 * toss * Math.sin(k * Math.PI);
    p.head[0] += toss * (10 * hump(k, 0.6, 0.3) - 8 * hump(k, 0.25, 0.2));
    p.head[2] += 10 * shake * toss;
    p.head[1] += 6 * shake * toss;
    p.ears += 0.8 * toss * hump(k, 0.6, 0.3);
  }
  // The weight off a hind foot: hip dropped, the foot resting on its toe a little forward, and back.
  const rest = beat(t, [13.2], 3.2);
  if (rest > 0) {
    const A = R.ankle[3];
    p.at[3] = [A[0], A[1] + 0.06 * s.len * rest, A[2] + 0.05 * R.reach[3] * rest];
    p.foot[3] = 18 * rest;
    p.roll -= 2 * rest;
    p.pitch += 0.6 * rest;
  }
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Cartling's headbutt: rocked back on its haunches with its head tucked, then a hop forward onto its fore feet, brow first, and back. */
function headbutt(s: Haul, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = HAUL_HITS[0];
  const back = ramp(t, 0.04, 0.26) * (1 - ramp(t, 0.4, hit - 0.02));
  const out = ramp(t, 0.4, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06);
  p.surge = s.len * (-0.1 * back + 0.2 * out);
  p.H += s.len * (0.03 * back - 0.03 * out);
  p.pitch = 8 * back - 8 * out;
  p.neck = [-12 * back + 22 * out, 0];
  p.head = [8 * back - 30 * out + 6 * jolt, 0, 0];
  p.squash = 0.06 * back + 0.08 * jolt;
  p.ears = 0.6 * back - 0.6 * out + 1 * jolt;
  // The fore feet hop forward under the lunge and come back.
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0], A[1] + s.len * 0.18, A[2]];
    const k = ramp(t, 0.4, hit - 0.02) * (1 - ramp(t, 0.7 + 0.06 * i, 0.94 + 0.04 * i));
    p.at[i] = t < 0.6 ? arc(A, fwd, ramp(t, 0.4, hit - 0.02), R.reach[i] * 0.22) : arc(fwd, A, 1 - k, R.reach[i] * 0.18);
    p.foot[i] = -20 * Math.sin(Math.PI * clamp(t < 0.6 ? ramp(t, 0.4, hit - 0.02) : 1 - k));
  }
  p.tail = [20 * back + 10 * jolt, 0];
  return p;
}

/** The Wagonox's butt: head lowered with its horns forward and a fore foot pawing, a step into it, and a hook of its horns up and round. */
function hook(s: Haul, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = HAUL_HITS[1];
  const lower = ramp(t, 0.04, 0.3) * (1 - ramp(t, hit - 0.06, 0.8));
  const lunge = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.1, 0.96));
  // The hook eased in over the last tenth before the blow and out over the third after it, upward in line with the body.
  const up = ramp(t, hit - 0.12, hit + 0.04) * (1 - ramp(t, hit + 0.1, 0.86)), jolt = hump(t, hit + 0.02, 0.05);
  p.surge = s.len * (-0.04 * lower + 0.14 * lunge);
  p.pitch = -5 * lower + 2 * up;
  p.H -= s.len * 0.03 * lower;
  p.neck = [32 * lower - 18 * up, -3 * up];
  p.head = [-48 * lower + 52 * up, -6 * up, 8 * up];
  p.roll = 1.5 * up;
  p.squash = 0.05 * jolt;
  p.ears = -0.6 * lower + 0.8 * up;
  // The near fore foot paws the ground twice as it lowers its head, and steps forward into the butt; the far one follows.
  const i = 1, A = R.ankle[i];
  const paw = Math.max(hump(t, 0.12, 0.07), hump(t, 0.26, 0.07));
  const step = ramp(t, 0.36, hit - 0.04), back = ramp(t, 0.66, 0.9);
  const fwd: V3 = [A[0], A[1] + s.len * 0.12, A[2]];
  p.at[i] = t < 0.36 ? [A[0], A[1] - s.len * 0.04 * paw, A[2] + R.reach[i] * 0.18 * paw] : t < 0.66 ? arc(A, fwd, step, R.reach[i] * 0.16) : arc(fwd, A, back, R.reach[i] * 0.14);
  p.foot[i] = t < 0.36 ? -30 * paw : -24 * Math.sin(Math.PI * (t < 0.66 ? step : back));
  p.tail = [14 * lower + 10 * jolt, 10 * up];
  return p;
}

/** The Haulhorn's horn toss: it lowers its great horns and gathers on its haunches, drives forward, and flings its head up and round, rearing a little; its fore feet come down heavily after. */
function toss(s: Haul, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = HAUL_HITS[2], stamp = HAUL_STAMP;
  // Reared: its weight rocked back onto its haunches, its fore feet off the ground and its head thrown up and back.
  const rear = ramp(t, 0.05, 0.34) * (1 - ramp(t, 0.36, hit - 0.02));
  // Then driven down onto its fore feet and forward, its head brought down hard so its horns meet what it butts on the blow.
  const drive = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 0.95));
  const jolt = hump(t, hit + 0.02, 0.05), paw = hump(t, stamp, 0.07);
  p.surge = s.len * (-0.1 * rear + 0.13 * drive);
  p.pitch = 12 * rear - 5 * drive - 1.5 * jolt;
  p.H += s.len * (-0.03 * rear - 0.03 * drive);
  p.neck = [-18 * rear + 40 * drive, 0];
  p.head = [24 * rear - 52 * drive + 5 * jolt, 0, 0];
  p.squash = 0.07 * jolt;
  p.ears = 0.6 * rear - 0.5 * drive;
  // The fore feet lifted as it rears and brought down together on the blow; then the near one stamps once more.
  for (const i of [0, 1]) {
    const A = R.ankle[i], high: V3 = [A[0], A[1] + R.reach[i] * 0.08, A[2] + R.reach[i] * 0.3];
    const k = t < hit ? ramp(t, 0.06, 0.32) * (1 - ((clamp((t - 0.38) / (hit - 0.02 - 0.38))) ** 2)) : 0;
    p.at[i] = mixV(A, high, k);
    p.foot[i] = -30 * k;
  }
  {
    p.at[1] = add(p.at[1], [0, 0, R.reach[1] * 0.16 * paw]);
    p.foot[1] += -20 * paw;
  }
  p.tail = [20 * rear + 10 * jolt, 0];
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/** How hard it is heaving this moment through a go, nought to one: a surge after each fore foot digs in, easing off before the next. */
const heaveOf = (t: number): number => Math.max(...HAUL_WORK.heaves.map((h) => loopHump(t, h, 0.2)));

/**
 * A go at its task: leaning into its harness and hauling. Its chest dropped and pushed forward against the collar, its neck
 * stretched out and its head down, its hind legs braced behind it; at each heave a fore foot is picked up and dug in again
 * where it stood, the body surges forward over it and the head drives down, and then a hind foot is shifted to push.
 */
function workPlan(s: Haul, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), W = HAUL_WORK, heave = heaveOf(t);
  p.surge = s.len * (0.09 + 0.04 * heave);
  p.pitch = -7 - 3 * heave;
  p.H -= s.len * (0.05 + 0.02 * heave);
  // Its neck stretched out ahead into the collar and its muzzle carried forward, clear of its chest and its bell.
  p.neck = [30 + 8 * heave, 0];
  p.head = [-6 - 4 * heave, 0, 0];
  p.ears = -0.4 - 0.3 * heave;
  p.squash = 0.03 * heave;
  // A fore foot picked up, its hoof tucked, and dug in again where it was; one on each heave, right then left.
  W.digs.forEach((d, q) => {
    const i = q ? 0 : 1, A = R.ankle[i], k = loopHump(t, d - 0.08, 0.1);
    p.at[i] = [A[0], A[1] + s.len * 0.03 * k, A[2] + R.reach[i] * 0.2 * k];
    p.foot[i] = -34 * k;
  });
  // A hind foot shifted to push: lifted a little and set down where it was, left then right.
  W.pushes.forEach((d, q) => {
    const i = q ? 3 : 2, A = R.ankle[i], k = loopHump(t, d - 0.07, 0.08);
    p.at[i] = [A[0], A[1] - s.len * 0.02 * k, A[2] + R.reach[i] * 0.12 * k];
    p.foot[i] = -22 * k;
  });
  p.roll = 2 * Math.sin(TAU * (t - W.digs[0]));
  p.tail = [6 + 6 * heave, 8 * Math.sin(TAU * t)];
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its head high, a shake, and settled. */
function evolvePlan(s: Haul, R: Rest, t: number): Plan {
  const p = restPlan(s, R);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * (s.stage === 2 ? 46 : 64));
  p.H += s.len * (-0.03 * hunch + 0.012 * up);
  p.pitch = -3 * hunch + 4 * up;
  p.neck = [14 * hunch - 12 * up, 0];
  p.head = [-12 * hunch + 18 * up, 6 * shake, 10 * shake];
  p.roll = 2.5 * shake;
  p.ears = -0.5 * hunch + 1 * up;
  p.tail = [-6 * hunch + 20 * up, 14 * shake];
  p.squash = 0.06 * hump(t, 0.7, 0.05);
  return p;
}

/**
 * How much of a leg's reach any foot may take: past it a leg goes straight, and a straight leg reaching out is a stilt. So the
 * body is let down as far as it must be for every foot to be in this much of its leg's reach -- which at a walk is the dip of a
 * body over a foot planted far forward or far back, as an animal's is.
 */
const MOST_REACH = 0.955;
function seated(s: Haul, R: Rest, p: Plan): Plan {
  let drop = 0;
  const body = joint(ROOT, [p.side, p.surge, p.H], p.pitch, p.roll, p.yaw);
  for (let i = 0; i < 4; i++) {
    const hip = place(body, R.hip[i]), at = p.at[i], L = R.reach[i] * MOST_REACH;
    const flat = (at[0] - hip[0]) ** 2 + (at[1] - hip[1]) ** 2, up = hip[2] - Math.max(at[2], s.ankle);
    if (flat + up * up <= L * L) continue;
    drop = Math.max(drop, up - Math.sqrt(Math.max(0, L * L - flat)));
  }
  return drop > 0 ? { ...p, H: p.H - drop } : p;
}

/** Its pose for what it is doing, its body let down as far as its feet need (`seated`). */
function planOf(s: Haul, R: Rest, a: Anim): Plan {
  return seated(s, R, posedOf(s, R, a));
}
function posedOf(s: Haul, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over([headbutt, hook, toss][s.stage](s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0.4, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/**
 * How far its bell is swung this moment, forward and to its left (degrees): as it goes, swinging back and forward twice a stride
 * a beat behind its nod, and side to side once; hauling, flung forward at each heave and swinging back; at a strike, thrown at
 * the blow and swinging down; standing, set going by a toss of its head and dying away.
 */
function bellSwing(s: Haul, a: Anim): [number, number] {
  const big = [1, 0.85, 0.7][s.stage], act = a.act;
  const ring = (since: number, k: number, f = 2.4): number => (since < 0 ? 0 : k * Math.exp(-since * 2.4) * Math.sin(since * TAU * f));
  if (act?.kind === 'work') {
    const T = ACT_SECS.work;
    let x = 0;
    for (const h of HAUL_WORK.heaves) x += ring(frac(act.t - h + 0.1) * T, -26 * big);
    return [x * downOf(act.t, a.graze), 6 * Math.sin(TAU * act.t)];
  }
  if (act?.kind === 'strike') return [ring((act.t - HAUL_HITS[s.stage]) * ACT_SECS.strike, 40 * big, 2.2), ring((act.t - HAUL_HITS[s.stage]) * ACT_SECS.strike, 14 * big, 1.6)];
  if (act?.kind === 'evolve') return [ring((act.t - 0.66) * ACT_SECS.evolve, 30 * big), ring((act.t - 0.66) * ACT_SECS.evolve, 20 * big, 1.7)];
  const g = smooth(Math.min(1, Math.max(0, a.go))), w = frac(a.u);
  const going: [number, number] = [-(14 + 8 * a.gait) * big * Math.cos(2 * TAU * (w - beatOf(1, a.gait) - 0.16)), 9 * big * Math.sin(TAU * (w - 0.2))];
  const k = beat(a.t, [8.4, 20.8], 1.3), tossed = k > 0 ? ring(((a.t % 1.3) / 1.3 - 0.45) * 1.3, 24 * big, 2.6) : 0;
  return [lerp(tossed + 2 * cyc(a.t, 7), going[0], g), lerp(3 * cyc(a.t, 4) + tossed * 0.5, going[1], g)];
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/**
 * A leg bent to put its ankle at `ankle`: the upper part from the hip down to a joint up against the belly, and the lower from
 * it to the fetlock, the joint back on a fore leg (an elbow) and forward on a hind (a stifle), always the same way round. A
 * point out of reach is reached for as far as the leg goes. The bones' own `-z` runs down each part.
 */
function legOf(s: Haul, R: Rest, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const fore = i < 2, [l0, l1] = R.legs[i];
  const hip = place(body, R.hip[i]), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = len3(d);
  const Dc = clamp(D, Math.abs(l0 - l1) + 0.05 * (l0 + l1), (l0 + l1) * 0.985);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  const hint = turn(body, unit([SIDE[i] * 0.12, fore ? -1 : 1, 0]));
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  // The hoof flat on the ground facing the way the body does, pitched as the pose says.
  const head = unit([fwd[0], fwd[1], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** Where the bell hangs from its collar, in the trunk's frame: under the front of its chest. */
function bellAt(s: Haul): V3 {
  // Centred on the front of its chest just under its throat, out over its bib, where it is seen from in front and from the side.
  const M = marksOf(s), q = outer(s, M.y[6] - 0.04, -0.6, 0.38 * bigOf(s));
  return [0, q.p[1], q.p[2]];
}

/** Where each banner hangs from, in the trunk's frame: two from each pole, one behind its shoulder and one before its haunch. */
function bannerAt(s: Haul, sd: number, k: number): { p: V3; n: V3 } {
  const P = poleLine(s);
  return { p: [sd * (P.x + P.r + 0.03), girthY(s) - (k ? 1.85 : 0.18) * bigOf(s), P.z - P.r * 0.3], n: [sd, 0, 0] };
}
/** The banners' bones and pieces, by side and place along the pole. */
const BANNERS: ReadonlyArray<readonly [number, number, string]> = [[1, 0, 'banR0'], [1, 1, 'banR1'], [-1, 0, 'banL0'], [-1, 1, 'banL1']];

/**
 * The bones of a stage: its pose, the body raised and carried as the pose says, every leg bent to put its hoof where the pose
 * says (`legOf`), the neck and head carried on the body, its ears, its tail in links, and its bell and banners swinging.
 */
function haulBones(s: Haul): (a: Anim) => Bones {
  const R = restOf(s);
  return (a) => {
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go });
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.neck.lean + P.neck[0];
    b.neck = joint(body, s.neck.at, -lean, 0, P.neck[1]);
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + s.head.pitch + P.head[0], P.head[2], P.head[1]);
    for (const sd of [1, -1]) b[sd > 0 ? 'earR' : 'earL'] = joint(b.head, earRoot(s, sd), 0, -sd * 22 * P.ears, 0);
    // The tail hanging from the root of its back, swinging; each link curled a little further down, the swing carried on down it.
    let prev = joint(body, s.tail.at, 62 - P.tail[0], 0, P.tail[1] * 0.5);
    b.tail0 = prev;
    for (let q = 1; q < s.tail.links.length; q++) {
      prev = joint(prev, [0, -s.tail.links[q - 1], 0], 12 - P.tail[0] * 0.25, 0, P.tail[1] * 0.35);
      b[`tail${q}`] = prev;
    }
    for (let i = 0; i < 4; i++) {
      const g = P.at[i];
      const [u, l, f] = legOf(s, R, body, i, [g[0], g[1], Math.max(g[2], s.ankle)], P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = f;
    }
    if (s.gear) {
      const [fw, sw] = bellSwing(s, a);
      b.bell = joint(b.trunk, bellAt(s), fw, sw);
    }
    if (s.gear === 2) {
      // The banners hang from the collar and swing as the bell does, less, and out from the flank as it rolls.
      const [fw, sw] = bellSwing(s, a);
      for (const [sd, k, key] of BANNERS) {
        const at = bannerAt(s, sd, k);
        // Going, each swings forward and back a beat behind each fore footfall, six degrees either way at a walk and more at a run;
        // standing or at an act, it swings as the bell does, less.
        const g = smooth(clamp(a.act ? 0 : a.go)), lag = (6 + 6 * a.gait) * Math.cos(2 * TAU * (frac(a.u) - beatOf(1, a.gait) - 0.14 - 0.05 * k));
        b[key] = joint(b.trunk, at.p, lerp(fw * (0.35 - 0.1 * k), lag, g), Math.max(0, -sd * sw * 0.4) * -sd, 0);
      }
    }
    b.shadow = shadowOf(body, 0);
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------------------- */

/** Its barrel's rings as described, by name: 0 rump, 1 haunch, 2 loin, 3 middle, 4 ribs, 5 shoulders, 6 chest. */
const marksOf = (s: Haul): Rings => s.marks ?? s.body;

/** How much a stage's things are scaled from the Wagonox's, for the sizes of leaves and straps that are not tied to its body. */
const bigOf = (s: Haul): number => s.len / 2.2;

/**
 * How far the leaves rustle this moment: lifted off the body as a share of their length, and thrown up or down; bouncing as it
 * goes, a beat behind each footfall, lifting at each heave of its hauling and bristling at a strike; stirring as it stands;
 * and as it evolves grown in from little more than half their size, overshooting at the turn and settling.
 */
function rustle(s: Haul, a: Anim, phase: number): { lift: number; bounce: number; grow: number } {
  let lift = 0.04 * cyc(a.t, 6, phase) * (1 - a.go), grow = 1;
  let bounce = a.go > 0 ? smooth(Math.min(1, a.go)) * (0.07 + 0.05 * a.gait) * Math.sin(frac(a.u) * TAU * 2 - TAU * 2 * beatOf(1, a.gait) - 1.6 - phase) : 0;
  const act = a.act;
  if (act?.kind === 'strike') {
    const hit = HAUL_HITS[s.stage];
    lift += 0.14 * ramp(act.t, 0.1, hit) * (1 - ramp(act.t, hit + 0.1, 1));
    bounce += 0.1 * hump(act.t, hit + 0.06, 0.1) * Math.sin((act.t - hit) * 50);
  } else if (act?.kind === 'work') {
    const k = downOf(act.t, a.graze);
    lift += k * 0.08 * heaveOf(act.t);
    bounce += k * 0.05 * Math.sin(act.t * TAU * 2 - 1 - phase);
  } else if (act?.kind === 'evolve') {
    lift += 0.2 * hump(act.t, 0.5, 0.25);
    bounce += 0.05 * hump(act.t, 0.6, 0.12) * Math.sin(act.t * 70 - phase);
    grow = 0.55 + 0.45 * ramp(act.t, 0.04, 0.5) + 0.12 * hump(act.t, 0.54, 0.08);
  }
  return { lift, bounce, grow };
}

/** A piece of leaves that rustles (`rustle`): every corner moved by as far out along its leaf as it is. */
function rustling(s: Haul, f: Fronds, len: number, phase: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const r = rustle(s, a, phase);
    if (!r.lift && !r.bounce && r.grow === 1) return v as V3[];
    return v.map((p, i) => {
      const k = f.w[i] * len, R = f.root[i];
      const q: V3 = r.grow === 1 ? p : add(R, scale(sub(p, R), r.grow));
      return [q[0] + f.out[i][0] * r.lift * k, q[1] + f.out[i][1] * r.lift * k, q[2] + f.out[i][2] * r.lift * k + r.bounce * k];
    });
  };
}

/** A painted spot lying on the barrel, every corner of it laid back onto the barrel's own curve. */
function spotOn(s: Haul, y: number, th: number, rx: number, ry: number, m: Mat, spin: number): Disc {
  const q = onRings(s.body, y, th), d = disc(add(q.p, scale(q.n, 0.01)), q.n, rx, ry, 9, m, { spin, up: [0, 0, 1] });
  return {
    ...d, v: d.v.map((v) => {
      const r = ringAt(s.body, v[1]), a = Math.atan2((v[2] - r.z) / r.h, v[0] / r.w);
      const e = onRings(s.body, v[1], a);
      return add(e.p, scale(e.n, 0.012 * bigOf(s)));
    }),
  };
}

/**
 * The barrel: woolly cream, paler underneath, dappled in soft tan spots and a few mossy green ones over its back, flanks and
 * haunches; the cream of its chest a fluffy bib (`chestFur`).
 */
function barrelOf(s: Haul, n: number): Mesh {
  const B = s.body;
  const body = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, (ring, j) => (Math.abs(((j + 1) / n) * TAU - Math.PI * 1.5) < 0.95 && ring > 0 ? 'belly' : 'coat'));
  const spots: Disc[] = [];
  const count = [30, 42, 54][s.stage];
  for (let q = 0; q < count; q++) {
    const id = 300 + q * 7;
    // Spread along the barrel from the rump to the shoulders and round from just over the belly on one side to the other.
    const y = lerp(marksOf(s).y[1] + 0.1 * bigOf(s), marksOf(s).y[5] - 0.05, jitter(id)), th = lerp(-0.45, Math.PI + 0.45, (q + jitter(id + 1)) / count);
    const r = ringAt(marksOf(s), y), k = (0.19 + 0.13 * jitter(id + 2)) * r.w;
    spots.push(spotOn(s, y, th, k * 1.25, k, jitter(id + 3) < 0.42 ? 'spot' : 'mark', jitter(id + 4) * 3));
  }
  return merge(body, paint(spots));
}

/**
 * Its fluffy cream bib: locks of fur hanging off the front of its chest and down its throat between its fore legs, lying on it,
 * longest in the middle; and on the bigger ones a few on its throat.
 */
function chestFur(s: Haul, K: number): Mesh {
  const M = marksOf(s), out: Mesh[] = [];
  // The bib itself: a round swell of pale fur on the front of its chest under its throat, standing out from the barrel.
  const at = outer(s, lerp(M.y[5], M.y[6], 0.5), -0.55, -0.1 * M.h[5]);
  const big = [1, 1.12, 1.25][s.stage], c = add(at.p, [0, 0.12 * M.h[5], 0.02 * M.h[5] * s.stage]), r: V3 = [M.w[5] * 0.66 * big, M.h[5] * 0.5 * big, M.h[5] * 0.66 * big];
  out.push(orb(c, r, 9, 5, 'belly'));
  // And on the bigger ones its locks, hanging off the lower half of it, longest in the middle; the Cartling's bib is smooth.
  const count = [0, 7, 9][s.stage];
  for (let row = 0; row < 2; row++) {
    for (let q = 0; q < count - row; q++) {
      const f = (q + row * 0.5) / (count - 1) - 0.5, id = 600 + q + row * 20;
      const e = onEgg(c, r, [f * 1.6, 0.8, row ? -0.15 : -0.55]);
      const len = M.h[5] * (0.48 + 0.12 * jitter(id)) * (1 - 0.35 * Math.abs(f)) * (row ? 0.8 : 1);
      out.push(lock(add(e.p, scale(e.n, -0.02)), unit(add(scale(e.n, 0.45), [f * 0.3, 0, -1])), e.n, len, K));
    }
  }
  return merge(...out);
}

/** The leaves along its back and over its shoulders, and on the bigger ones draped over its rump and haunches. */
function backLeaves(s: Haul, K: number): Frond[] {
  const M = s.mane, L = M.leaf, out: Frond[] = [];
  // Over its withers, where the mane comes down off its neck: a few tufts either side of the spine, thinning back along it, so
  // its back is its dappled coat and not a blanket of leaves.
  const y1 = marksOf(s).y[5] + 0.02, y0 = y1 - M.back * (marksOf(s).y[5] - marksOf(s).y[0]);
  const rows = Math.max(1, Math.round((y1 - y0) / (L * 0.55)));
  for (let r = 0; r <= rows; r++) {
    const y = lerp(y1, y0, r / rows), fade = r / Math.max(1, rows);
    const across = r ? 1 : 2;
    for (const sd of [1, -1]) for (let c = 0; c < across; c++) {
      const th0 = Math.PI / 2 - 0.3 - c * (Math.PI / 2 - M.low) * 0.6, th = sd > 0 ? th0 : Math.PI - th0, id = 1000 + r * 37 + c * 5 + (sd > 0 ? 0 : 3);
      const q = outer(s, y + (jitter(id) - 0.5) * L * 0.2, th, -0.02);
      const down: V3 = [sd * Math.cos(th0) * 0.4, -0.5, -0.7];
      out.push(...cluster(q.p, q.n, down, L * (1.1 - 0.3 * fade), K, id, 0.4));
    }
  }
  if (M.rump) {
    // Draped over the rump and hanging down over the backs of its thighs, a fringe of them round its tail.
    const n = [0, 8, 10][s.stage];
    for (let q = 0; q < n; q++) {
      const f = q / (n - 1), id = 1500 + q, th = lerp(-0.2, Math.PI + 0.2, f);
      for (const [yk, k] of [[0.06, 1]] as ReadonlyArray<readonly [number, number]>) {
        const y = lerp(marksOf(s).y[0], marksOf(s).y[2], yk), at = outer(s, y + 0.04, th, -0.01);
        out.push(...cluster(at.p, at.n, [0, -0.35, -1], L * M.rump * k, K, id + yk * 50, 0.35, q % 2 ? 2 : 3));
      }
    }
  }
  return out;
}

/**
 * Where a point on a ring round the neck is, in the neck's frame: `t` up the neck from where it leaves the body, `ph` round it
 * from the back of the neck (where the mane runs) toward its right, and the way out.
 */
function onNeck(s: Haul, t: number, ph: number, k = 1): { p: V3; n: V3 } {
  const N = s.neck, r = N.w * k * (1 - 0.12 * clamp(t / N.len));
  const n: V3 = [Math.sin(ph), -Math.cos(ph), 0];
  return { p: [n[0] * r, n[1] * r * 0.94, t], n };
}

/** Its mane: rows of leaves round its neck from behind its ears down to its shoulders, over its crest and down its sides, its throat bare for its bib. */
function maneLeaves(s: Haul, K: number): Frond[] {
  const N = s.neck, M = s.mane, out: Frond[] = [];
  // A collar of tufts round the crest of its neck and down over its shoulders, but not round its throat and chest, which are its
  // cream bib; and up the back of its neck to its crown, narrower toward its head.
  for (let r = 0; r < M.rows; r++) {
    const u = r / (M.rows - 1), t = lerp(N.len * 1.0, -N.w * 0.35, u), wide = lerp(1.05, 1.62, u ** 0.8);
    const n = Math.max(2, Math.round((wide * 2) / 0.4)) + (r % 2);
    for (let c = 0; c <= n; c++) {
      const ph = lerp(-wide, wide, (c + (r % 2) * 0.5) / (n + (r % 2) * 0.5)), id = 2000 + r * 41 + c;
      const at = onNeck(s, t + (jitter(id) - 0.5) * M.leaf * 0.15, ph, 0.9);
      const len = M.leaf * (1.1 + 0.3 * u);
      out.push(...cluster(at.p, at.n, [0, 0, -0.85], len, K, id, 0.4 + 0.25 * u, 4));
    }
  }
  return out;
}

/** Its throat's cream fur: locks down the front of its neck to the bib on its chest. */
function throatFur(s: Haul, K: number): Mesh {
  const N = s.neck, out: Mesh[] = [];
  // A cream ruff down the front of its neck from under its chin to its bib, full and soft.
  out.push(orbAlong([0, N.w * 0.62, N.len * 0.4], [0, 0.15, 1], [N.w * 0.7, N.w * 0.42, N.len * 0.7 + N.w * 0.3], 8, 4, 'belly'));
  const rows = [0, 2, 3][s.stage];
  for (let r = 0; r < rows; r++) for (let q = 0; q < 5; q++) {
    const ph = Math.PI + (q / 4 - 0.5) * 1.9, at = onNeck(s, lerp(N.len * 0.8, N.len * 0.05, r / Math.max(1, rows - 1)), ph, 1.15);
    out.push(lock(at.p, unit(add(scale(at.n, 0.5), [0, 0, -1])), at.n, N.w * (0.8 + 0.2 * jitter(q + r * 5)), K));
  }
  return merge(...out);
}

/** The neck: cream, paler under; its mane and its throat's fur go on it as pieces of their own. */
function neckOf(s: Haul, n: number): Mesh {
  const N = s.neck;
  return tube([[0, 0, -N.w * 0.5], [0, 0, N.len * 0.5], [0, 0.03, N.len + 0.05]], [N.w, N.w * 0.94, N.w * 0.88], [N.w * 0.96, N.w * 0.9, N.w * 0.84], n,
    (ring, j) => (Math.abs(((j + 1) / n) * TAU - Math.PI * 0.5) < 1.2 ? 'belly' : 'coat'), { seam: 'start' });
}

/* ---- the head ------------------------------------------------------------------------------- */

/** The middle of the skull, in the head's frame. */
const skullAt = (s: Haul): V3 => [0, 0, s.head.up];
/** The middle of the muzzle, in the head's frame: out of the lower front of the skull, soft and round. */
const muzzleAt = (s: Haul): V3 => { const H = s.head; return [0, H.r[1] * 0.62, H.up - H.r[2] * 0.36]; };
/** Where each ear comes out of the head, in the head's frame: from its sides behind the eyes, at the height of their tops. */
const earRoot = (s: Haul, sd: number): V3 => { const H = s.head, e = onEgg(skullAt(s), H.r, [sd * 0.8, -0.6, 0.45]); return [e.p[0] * 0.92, e.p[1], e.p[2]]; };

/**
 * The head: a round skull a size too big on the little one; a soft round cream muzzle out of the lower front of it, two dark
 * nostrils and a small smile; the crown of the head and the top of the brow green, where its mane comes up onto it; and the
 * eyes, big and soft and brown.
 */
function headOf(s: Haul, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const mz = H.muzzle, mC = muzzleAt(s), mR: V3 = [mz[0], mz[1], mz[2]];
  // The green of the crown: every facet looking up more than out, back from over the eyes.
  const skull0 = orb(C, H.r, n + 4, k + 3, 'coat');
  const skull = mesh(skull0.v, skull0.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, skull0.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const up = (c[2] - C[2]) / H.r[2], fwd = (c[1] - C[1]) / H.r[1];
    return up > 0.62 - 0.25 * Math.max(0, -fwd) && fwd < 0.5 ? { ...f, m: 'moss' as Mat } : f;
  }));
  const muzzle = orb(mC, mR, n + 2, k + 2, 'muzzle');
  // The bridge of the nose a cream a little warmer than the muzzle, from between the eyes down onto it.
  const bC = add(C, [0, H.r[1] * 0.58, H.r[2] * 0.08]);
  const bridge0 = orbAlong(bC, [0, 1, -0.35], [H.r[0] * 0.48, H.r[2] * 0.4, H.r[1] * 0.42], n + 2, k + 1, 'coat');
  // Its green carried down the bridge of its nose from the brow, narrowing.
  const bridge = mesh(bridge0.v, bridge0.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, bridge0.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return (c[2] - bC[2]) / (H.r[2] * 0.4) > 0.55 + 0.5 * Math.abs(c[0]) / H.r[0] && c[1] - bC[1] < H.r[1] * 0.3 ? { ...f, m: 'moss' as Mat } : f;
  }));
  const nostrils = paint([1, -1].map((sd) => disc(add(onEgg(mC, mR, [sd * 0.36, 0.85, 0.3]).p, [0, 0.01, 0]), [sd * 0.3, 1, 0.45], mz[0] * 0.13, mz[0] * 0.08, 6, 'nose', { spin: sd * 0.4 })));
  const mouth = paint([lineOn(Array.from({ length: 9 }, (_, q) => {
    const x = (q / 8 - 0.5) * 2;
    return onEgg(mC, mR, [x * 0.7, 1 - 0.5 * Math.abs(x) * 0.7, -0.32 + 0.24 * x * x]);
  }), mz[0] * 0.035, 'lid')]);
  return merge(skull, bridge, muzzle, nostrils, mouth, eyesOf(s, shut));
}

/**
 * The eyes, set on the sides of the skull and looking forward as much as out: each a dark rim, a big warm brown iris, a dark
 * middle and two glints, laid onto the skull's own curve. All of an eye goes out of sight together when the head is between it
 * and the viewer (`at`).
 */
function eyesOf(s: Haul, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.01)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.24, 8, 'lid', o), 0.012));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.16, r * 1.2, 12, 'lid', o), 0.01));
    out.push(onto(disc(p, n, r, r * 1.04, 12, 'crystal', o), 0.014));
    out.push(onto(disc(add(p, scale(up, -r * 0.04)), n, r * 0.62, r * 0.66, 10, 'eye', o), 0.018));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36)), scale(across, side * r * 0.3)), n, r * 0.3, r * 0.3, 6, 'glint', { ...o, lit: true }), 0.026));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.4)), scale(across, -side * r * 0.28)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }), 0.026));
    // A soft lid of its coat over the top of the eye, so it looks out kindly rather than up.
    out.push(onto(disc(add(p, scale(up, r * 1.08)), n, r * 1.25, r * 0.3, 8, 'coat', o), 0.022));
  }
  return paint(out);
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the muzzle. */
function headSolids(s: Haul): Array<{ c: V3; r: V3 }> {
  const H = s.head, m = H.muzzle;
  return [{ c: skullAt(s), r: scale(H.r, 0.9) }, { c: muzzleAt(s), r: scale(m, 0.85) }];
}

/** An ear: a soft drooping lobe of its coat out from the side of its head, pink inside, in its own frame (root at the origin). */
function earOf(s: Haul, sd: number): Mesh {
  const E = s.ear, dr = E.droop * DEG;
  // Out and back from behind the eye and drooping, its pink inside turned forward, so side on the ear is seen edge on.
  const dir: V3 = unit([sd * Math.cos(dr) * 0.75, -0.7, -Math.sin(dr)]), face = unit([sd * 0.02, 0.95, -0.25]);
  const pts = curve([0, 0, 0], add(scale(dir, E.len * 0.5), [0, 0.02, 0.02]), scale(dir, E.len), 4);
  const widths = [E.w * 0.45, E.w * 0.9, E.w, E.w * 0.78, E.w * 0.25];
  const outerE = sheet(pts, widths, face, 0.35, ['coat', 'coat', 'coat']);
  const inner = sheet(pts.slice(1).map((p, q) => add(p, scale(face, 0.018 + 0.004 * q))), widths.slice(1).map((w) => w * 0.66), face, 0.3, ['inner', 'inner', 'coat']);
  return merge(outerE, inner);
}

/** The line of its right horn (left for `sd` negative), in the head's frame, root to tip: a ram's curl from the top of its head, back, down and round. */
function hornLine(s: Haul, sd: number, N = 16): V3[] {
  return hornGeom(s, sd, N).pts;
}

/**
 * Its right horn's line (left for `sd` negative) in the head's frame, root to tip, and the middle it curls about: a ram's curl
 * from the back of its skull, swept back over its neck and out wider than its head, down behind its ear and forward and under
 * at the tip, the curl open in the middle.
 */
function hornGeom(s: Haul, sd: number, N = 16): { pts: V3[]; mid: V3 } {
  const H = s.head, h = s.horn, C = skullAt(s), R = h.r;
  const root: V3 = [sd * H.r[0] * 0.44, -H.r[1] * h.root, C[2] + H.r[2] * (0.8 - 0.25 * h.root)];
  // Its line as a few points it passes through, out to its side, back and up from the root, as shares of its size: up a little and
  // back over the back of its head, out wider than the skull, round down behind its ear over its neck, forward under, and the tip
  // hooked up -- a C open at the front, with a gap through the middle of it.
  const out = h.sweep, tall = h.flat;
  const key: V3[] = [[0, 0, 0], [0.35 * out, 0.45, 0.32 * tall], [0.75 * out, 1.0, 0.22 * tall], [0.95 * out, 1.15, -0.35 * tall], [1.0 * out, 0.8, -0.85 * tall],
    [0.95 * out, 0.32, -0.88 * tall], [0.85 * out, 0.12, -0.55 * tall]];
  const at = (k: V3): V3 => add(root, [sd * k[0] * R, -k[1] * R * h.back, k[2] * R]);
  const P = key.map(at);
  // A Catmull-Rom spline through them, `N` steps.
  const pts: V3[] = [];
  for (let q = 0; q <= N; q++) {
    const u = (q / N) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(u)), f = u - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const c = (a: number, b: number, c2: number, d: number): number => 0.5 * (2 * b + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f);
    pts.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])]);
  }
  return { pts, mid: at([0.9 * out, 0.68, -0.3 * tall]) };
}

/**
 * Its horns: on the Cartling two little round nubs; on the others ram's horns, thick at the root and tapering, ridged in bands,
 * their inner edge -- the side toward the middle of the curl -- darker, so the coil reads as a coil even when it is small.
 */
function hornsOf(s: Haul, n: number): Mesh {
  const H = s.head, h = s.horn;
  if (!h.r) {
    return merge(...[1, -1].map((sd) => {
      const e = onEgg(skullAt(s), H.r, [sd * 0.6, 0.3, 0.8]);
      return orbAlong(add(e.p, scale(e.n, 0.01)), add(e.n, [0, -0.3, 0]), [h.w[0], h.w[0], h.w[0] * 0.9], 10, 4, 'horn');
    }));
  }
  return merge(...[1, -1].map((sd) => {
    const { pts, mid } = hornGeom(s, sd, 26), K = pts.length;
    const w = pts.map((_, k) => lerp(h.w[0], h.w[1], (k / (K - 1)) ** 0.7) * (k % 3 === 1 ? 1.07 : 0.98));
    const m = tube(pts, w, w.map((x) => x * 0.88), n, (ring) => (ring % 3 === 1 ? 'hornDark' : 'horn'));
    return mesh(m.v, m.f.map((f) => {
      const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
      const a = m.v[f.i[0]], b2 = m.v[f.i[1]], c2 = m.v[f.i[2]], nrm = cross(sub(b2, a), sub(c2, a));
      return dot(nrm, sub(mid, c)) > 0.35 * len3(nrm) * len3(sub(mid, c)) ? { ...f, m: 'hornDark' as Mat } : f;
    }));
  }));
}

/** Leaves at the roots of its horns and a tuft of them on its crown, and on the Haulhorn a white flower among them on its brow. */
function crownOf(s: Haul, K: number): Frond[] {
  const H = s.head, C = skullAt(s), out: Frond[] = [], L = s.mane.leaf * [0.75, 0.5, 0.48][s.stage];
  const count = [7, 5, 7][s.stage];
  for (let q = 0; q < count; q++) {
    const f = q / (count - 1) - 0.5, id = 3000 + q;
    // Two rows across its crown from brow to brow, lying back over its head as a forelock does, the outer ones swept out.
    const e = onEgg(C, H.r, [f * 1.4, 0.25 - 0.45 * Math.abs(f) - (q % 2) * 0.35, 1]);
    const dir = unit(add(scale(e.n, 0.5), [f * 1.1, -0.9 - 0.3 * jitter(id + 1), 0]));
    const len = L * (0.8 + 0.4 * jitter(id + 2));
    out.push({ mesh: leaf(add(e.p, scale(e.n, -0.02)), dir, e.n, len, len * 0.5, K, toneOf(id, 0.5)), root: e.p, out: e.n, len });
  }
  if (s.horn.r) {
    // A few leaves wound round each horn's root and along it.
    for (const sd of [1, -1]) {
      const pts = hornLine(s, sd);
      for (let q = 0; q < [0, 2, 4][s.stage]; q++) {
        const k = 1 + q * 2, p = pts[Math.min(k, pts.length - 2)], d = unit(sub(pts[k + 1], p)), id = 3100 + q * 3 + (sd > 0 ? 0 : 1);
        const outw = unit(add(cross(d, [sd, 0, 0]), [sd * 0.6, 0, 0.3]));
        const len = L * (0.85 + 0.3 * jitter(id));
        out.push({ mesh: leaf(add(p, scale(outw, s.horn.w[0] * 0.6)), unit(add(outw, scale(d, 0.6))), outw, len, len * 0.44, K, toneOf(id, 0.45)), root: p, out: outw, len });
      }
    }
  }
  if (s.stage === 2) {
    const e = onEgg(C, H.r, [0.25, 0.35, 1]);
    out.push({ mesh: flower(add(e.p, scale(e.n, 0.08)), unit(add(e.n, [0.3, 0.5, 0.1])), 0.3, 0.4), root: e.p, out: e.n, len: 0.3 });
  }
  return out;
}

/* ---- its harness ------------------------------------------------------------------------------ */

/** A ribbon lying on a surface: through `pts`, each with the way out of the surface there, `w` across (half), its one face turned out. */
function band(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, mat: MatOf): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], K = pts.length;
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)].p, pts[Math.max(0, k - 1)].p));
    const side = unit(cross(d, pts[k].n));
    v.push(add(pts[k].p, scale(side, -w)), add(pts[k].p, scale(side, w)));
  }
  for (let k = 0; k < K - 1; k++) {
    f.push({ i: [2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2], m: typeof mat === 'function' ? mat(k, 0) : mat });
    want.push(unit(add(pts[k].n, pts[k + 1].n)));
  }
  return mesh(v, woundTo(v, f, want));
}

/** A ring of brass: a hoop `r` across, square to `n`, at `c`. */
function brassRing(c: V3, n: V3, r: number, th: number): Mesh {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (len3(x) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const pts = Array.from({ length: 9 }, (_, q) => add(c, add(scale(x, Math.cos((q / 8) * TAU) * r), scale(y, Math.sin((q / 8) * TAU) * r))));
  return tube(pts, th, th, 4, (_r, j) => (j % 2 ? 'metal' : 'metalLit'), { start: false, end: false });
}

/** A buckle: a little square frame of brass lying on a strap at `c`, facing `n`. */
function buckle(c: V3, n: V3, along: V3, r: number): Mesh {
  const z = unit(n), y = unit(sub(along, scale(z, dot(along, z)))), x = cross(y, z);
  const corner = (a: number, b: number): V3 => add(add(c, add(scale(x, a * r), scale(y, b * r * 0.8))), scale(z, r * 0.25));
  const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)];
  return merge(tube(pts, r * 0.2, r * 0.2, 4, (_r, j) => (j % 2 ? 'metal' : 'metalLit'), { start: false, end: false }),
    tube([corner(0, -1), corner(0, 1.2)], r * 0.12, r * 0.12, 4, 'metalDark'));
}

/** Its collar: a strap right round the front of it, over its withers and under its chest, further forward at the bottom. */
function collarOf(s: Haul): { y: number; tilt: number; w: number } {
  const B = marksOf(s);
  return { y: lerp(B.y[4], B.y[5], 0.75), tilt: (B.y[6] - B.y[5]) * 0.7, w: [0.12, 0.11, 0.15][s.stage] };
}
/** The point on its collar `th` round from its right side (up positive). */
function collarPt(s: Haul, th: number, off: number): { p: V3; n: V3 } {
  const c = collarOf(s);
  return outer(s, c.y - c.tilt * Math.sin(th), th, off);
}
/** Where its girth goes round it: just behind its elbows. */
const girthY = (s: Haul): number => s.len * 0.5 - s.thick * 1.9;

/** A strap of leather, its colour in two shades by turns along it, so it reads as stitched leather and not a painted line. */
const leather: MatOf = (k) => (k % 3 === 2 ? 'leatherDark' : 'leather');

/**
 * Its harness, lying on its coat: a collar round the front of it and a girth round it behind its elbows, joined along each
 * flank by a strap, with brass rings where they meet and buckles on the girth; on the bigger ones a broad pad over its back
 * where the girth crosses it. On the Cartling a white flower on its collar, on the Wagonox one on its shoulder.
 */
function harnessOf(s: Haul, n: number): Mesh {
  const big = bigOf(s), C = collarOf(s), off = 0.03 * big, gy = girthY(s);
  const parts: Mesh[] = [];
  const ringPts = (f: (th: number) => { p: V3; n: V3 }): Array<{ p: V3; n: V3 }> => Array.from({ length: 33 }, (_, q) => f((q / 32) * TAU));
  // The collar round the front and sides of its chest, ending under its mane on either side, not over its withers: on the
  // Cartling a plain strap; the bigger ones wear a padded collar round the root of the neck instead (`collarMesh`).
  if (!s.stage) parts.push(band(Array.from({ length: 25 }, (_, q) => collarPt(s, -Math.PI / 2 + lerp(-2.0, 2.0, q / 24), off)), C.w * big, leather));
  parts.push(band(ringPts((th) => outer(s, gy, th, off)), C.w * big * 0.85, leather));
  const sideTh = 0.12;
  for (const sd of s.stage ? [1, -1] : []) {
    const th = sd > 0 ? sideTh : Math.PI - sideTh;
    const a = collarPt(s, th, off * 1.4), g = outer(s, gy, th, off * 1.4);
    // The strap along the flank from the collar to the girth, and on the bigger ones on back toward the rump: the traces.
    const back = s.gear ? lerp(marksOf(s).y[1], marksOf(s).y[2], 0.4) : gy;
    const pts = Array.from({ length: 9 }, (_, q) => outer(s, lerp(a.p[1], back, q / 8), th + sd * 0.04 * Math.sin((q / 8) * Math.PI), off * 1.6));
    parts.push(band(pts, C.w * big * 0.75, leather));
    // Brass rings where the strap meets the collar and the girth.
    parts.push(brassRing(add(a.p, scale(a.n, 0.03 * big)), a.n, C.w * big * 1.25, C.w * big * 0.3));
    parts.push(brassRing(add(g.p, scale(g.n, 0.03 * big)), g.n, C.w * big * 1.1, C.w * big * 0.28));
    // A buckle low on the girth, and one on the collar's side.
    const bq = outer(s, gy, sd > 0 ? -0.55 : Math.PI + 0.55, off * 1.5);
    parts.push(buckle(bq.p, bq.n, [0, 0, 1], C.w * big * 0.9));
    if (s.gear) {
      const cb = collarPt(s, sd > 0 ? -0.5 : Math.PI + 0.5, off * 1.5);
      parts.push(buckle(cb.p, cb.n, [0, 0.4, 1], C.w * big * 0.9));
    }
  }
  if (s.gear) {
    // A rolled blanket of leather lying along its back behind its withers, where the girth crosses it, strapped down.
    const y0 = gy - s.len * 0.5;
    const rr = C.w * big * 1.3;
    const roll = Array.from({ length: 9 }, (_, q) => outer(s, lerp(y0 + rr * 1.1, gy - s.len * 0.14 - rr, q / 8), Math.PI / 2, off * 2.2 + rr * 0.85).p);
    parts.push(tube(roll, rr, rr, 12, (ring2) => (ring2 === 2 || ring2 === 5 ? 'leatherDark' : 'leather'), { start: false, end: false }));
    for (const q of [0, 8]) parts.push(orbAlong(roll[q], [0, q ? 1 : -1, 0], [rr, rr, rr * 0.6], 12, 4, 'leatherLit'));
  }
  // Its flower: low on the front of the Cartling's collar, on the Wagonox's collar at its shoulder.
  if (s.stage === 0) {
    // (Its flower is a piece of its own, `cartFlower`, so it is drawn over its bib and its mane.)
  } else if (s.stage === 1) {
    const q = collarPt(s, 0.55, off * 2);
    parts.push(flower(add(q.p, scale(q.n, 0.05)), unit(add(q.n, [0, 0.4, 0.3])), 0.24, 0.2));
    parts.push(...[-1, 0, 1].map((k) => leaf(q.p, unit(add(q.n, [0, -0.6 + 0.2 * k, k * 0.7 - 0.2])), q.n, 0.28, 0.11, 4, toneOf(k + 19))));
  }
  return merge(...parts);
}

/** Where its poles lie along its flanks, in the trunk's frame: how far out, how high, from where behind its rump to where at its front, and how thick (half). */
function poleLine(s: Haul): { x: number; z: number; y0: number; y1: number; r: number } {
  const big = bigOf(s), r = [0, 0.066, 0.088][s.stage] * big;
  return {
    x: Math.max(...marksOf(s).w) + 0.05 * big + r, z: -marksOf(s).h[3] * 0.3,
    y0: marksOf(s).y[0] - 0.25 * big, y1: s.stage === 2 ? s.neck.at[1] - 0.3 * big : marksOf(s).y[6] + 0.14 * big, r,
  };
}

/**
 * A pole (a shaft) along each flank: a beam of wood from well behind its rump to in front of its chest, hitched to its collar by
 * a strap and a brass ring and capped in brass at its ends; on the Haulhorn a heavier one, higher, its front end in a square
 * block of wood on its shoulder, studded in brass with a great brass ring on it.
 */
function poleOf(s: Haul, sd: number): Mesh {
  const P = poleLine(s), big = bigOf(s), r = P.r, x = sd * P.x, z = P.z, y0 = P.y0, y1 = P.y1;
  const F: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const beam = block([x, (y0 + y1) / 2, z], [r, (y1 - y0) / 2, r * 1.2], F, (q) => (q === 1 || q === 3 ? 'wood' : 'woodDark'));
  const parts: Mesh[] = [beam];
  for (const y of [y0 + r * 0.6, lerp(y0, y1, 0.36), lerp(y0, y1, 0.5)]) parts.push(block([x, y, z], [r * 1.18, r * 0.35, r * 1.38], F, (q) => (q === 1 ? 'metalLit' : 'metal')));
  if (s.stage === 2) {
    // The block on its shoulder at the pole's end.
    const c: V3 = [x, y1, z + r * 0.4], br: V3 = [r * 1.6, r * 1.9, r * 1.9];
    parts.push(block(c, br, F, (q) => (q === 1 || q === 5 ? 'wood' : 'woodDark')));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(orb([c[0] + sd * br[0] * 1.02, c[1] + a * br[1] * 0.7, c[2] + b * br[2] * 0.7], r * 0.26, 5, 3, 'metal'));
    parts.push(brassRing([c[0] + sd * br[0] * 1.15, c[1] - br[1] * 0.2, c[2] - br[2] * 0.1], [1, 0, 0], r * 1.1, r * 0.26));
  } else {
    parts.push(block([x, y1 - r * 0.6, z], [r * 1.18, r * 0.35, r * 1.38], F, (q) => (q === 1 ? 'metalLit' : 'metal')));
    // The ring hitching it to the collar.
    const c = collarPt(s, sd > 0 ? 0.0 : Math.PI, 0.05 * big);
    const hitch: V3 = [x - sd * r * 0.1, c.p[1], z + r * 1.5];
    parts.push(tube([c.p, hitch], 0.04 * big, 0.04 * big, 4, 'leatherDark'), brassRing(hitch, [0, 1, 0], r * 1.2, r * 0.32));
  }
  return merge(...parts);
}

/**
 * The Haulhorn's yoke bar: a heavy beam of wood lying across its withers just behind its mane, bowed to its back and down over
 * its shoulders either side, capped and banded in brass, a brass ring hanging from each end.
 */
function yokeOf(s: Haul): Mesh {
  const P = poleLine(s), big = bigOf(s), r = P.r * 1.2, M = marksOf(s);
  const y = M.y[5] - 0.32 * big, ring = ringAt(M, y), top = ring.z + ring.h + r * 0.75, x = ring.w * 0.62;
  const pts = Array.from({ length: 9 }, (_, q) => {
    const u = q / 8 * 2 - 1, e = outer(s, y, Math.PI / 2 - u * 0.42, r * 0.85);
    return [u * x, y, Math.max(e.p[2], top - (1 - Math.cos(u * 0.9)) * ring.h * 0.6)] as V3;
  });
  const parts: Mesh[] = [tube(pts, r, r * 1.15, 6, (ring2) => (ring2 === 1 || ring2 === 6 ? 'metal' : 'wood'))];
  for (const sd of [1, -1]) {
    const end = pts[sd > 0 ? 8 : 0];
    parts.push(orbAlong(end, [sd, 0, -0.3], [r * 1.1, r * 1.1, r * 0.5], 7, 3, 'metal'));
    // A brass ring hanging from each end, where the traces are made fast.
    parts.push(brassRing(add(end, [sd * r * 0.9, 0, -r * 0.9]), [0, 1, 0], r * 0.7, r * 0.2));
  }
  return merge(...parts);
}

/**
 * A bell on a short strap with a ring, `h` tall, hanging down from the origin: a rounded crown, a waist and a flared lip, a band
 * at its shoulder and lip, the clapper under it; and tassels either side of it, peach, hanging on cords from the collar.
 */
function bellOf(s: Haul, n: number): Mesh {
  const big = bigOf(s), h = [0, 0.62, 0.74][s.stage] * big;
  const strap = tube([[0, 0, 0.02], [0, 0, -h * 0.16]], 0.04 * big, 0.03 * big, 4, 'leatherDark');
  const loop = brassRing([0, 0, -h * 0.2], [1, 0, 0], h * 0.2, h * 0.055);
  const prof: Array<[number, number]> = [[-0.3, 0.06], [-0.34, 0.27], [-0.44, 0.4], [-0.66, 0.44], [-0.9, 0.55], [-1.06, 0.68], [-1.1, 0.7]];
  const pts = prof.map(([z]) => [0, 0, z * h] as V3), rr = prof.map(([, r]) => r * h);
  const body = tube(pts, rr, rr, Math.max(n, 9), (ring) => (ring === 5 ? 'metalDark' : ring <= 1 ? 'metalLit' : 'metal'), { end: false });
  const clapper = orb([0, 0, -h * 1.08], h * 0.13, 6, 3, 'metalDark');
  const mouth = paint([disc([0, 0, -h * 1.095], [0, 0, -1], h * 0.68, h * 0.68, n, 'metalDark')]);
  // Tassels on cords from the collar beside the bell, hanging a little shorter than it.
  const tassels: Mesh[] = [];
  const xs = [-0.66, 0.66];
  for (const x0 of xs) {
    const x = x0 * h * 1.3, top: V3 = [x, -0.04 * big, 0.04 * big - Math.abs(x0) * 0.08 * big], knot: V3 = [x, -0.02 * big, top[2] - h * 0.22];
    tassels.push(tube([top, knot], 0.03 * big, 0.03 * big, 4, 'metal'));
    tassels.push(orb(knot, h * 0.12, 6, 3, 'metal'));
    const tl = h * 0.82;
    tassels.push(tube([add(knot, [0, 0, -h * 0.06]), add(knot, [0, 0, -tl * 0.5]), add(knot, [0, 0, -tl])], [h * 0.09, h * 0.15, h * 0.2], [h * 0.09, h * 0.15, h * 0.2], 6,
      (ring) => (ring === 0 ? 'flame' : 'ember')));
  }
  return merge(strap, loop, body, mouth, clapper, ...tassels);
}

/**
 * The Haulhorn's banner on each shoulder: a long green cloth hanging from a brass rod on its collar, edged in cream, cut to a
 * point at its foot, a white flower with a peach heart embroidered on it, and a darker green band across its foot above the
 * point. In its own frame, the rod's middle at the origin, facing out along `x` to its side.
 */
function bannerOf(s: Haul, sd: number, k = 0): Mesh {
  const big = bigOf(s), W = 0.3 * big, H = (k ? 0.62 : 0.74) * big, n: V3 = [sd, 0, 0];
  const shape: Array<[number, number]> = [[-1, 0], [1, 0], [1, -0.82], [0, -1], [-1, -0.82]];
  const pt = (x: number, z: number, k = 1, lift = 0): V3 => [sd * lift, x * W * k, z * H * k + (1 - k) * -H * 0.45];
  const front = shape.map(([x, z]) => pt(x, z)), back = front.map((p) => sub(p, scale(n, 0.04 * big)));
  const verts = [...front, ...back], m = shape.length;
  const f: Face[] = [{ i: shape.map((_, q) => q), m: 'trim' }, { i: shape.map((_, q) => m + q), m: 'clothDark' }];
  const want: V3[] = [n, scale(n, -1)];
  const mid: V3 = [0, 0, -H * 0.5];
  for (let q = 0; q < m; q++) { f.push({ i: [q, (q + 1) % m, m + (q + 1) % m, m + q], m: 'trim' }); want.push(unit(sub(scale(add(front[q], front[(q + 1) % m]), 0.5), mid))); }
  const slab = mesh(verts, woundTo(verts, f, want));
  const lift = 0.012 * big;
  const inner = shape.map(([x, z]) => pt(x * 0.8, z * 0.93 - 0.03, 1, lift));
  const footBand = [pt(-0.8, -0.66, 1, lift * 1.5), pt(0.8, -0.66, 1, lift * 1.5), pt(0.8, -0.79, 1, lift * 1.5), pt(0, -0.93, 1, lift * 1.5), pt(-0.8, -0.79, 1, lift * 1.5)];
  const fc = pt(0, -0.36, 1, lift * 2);
  const petals: Disc[] = Array.from({ length: 5 }, (_, q) => {
    const a = (q / 5) * TAU + 0.3, c: V3 = [fc[0], fc[1] + Math.cos(a) * W * 0.36, fc[2] + Math.sin(a) * W * 0.36];
    return disc(c, n, W * 0.26, W * 0.2, 7, 'petal', { up: [0, Math.cos(a), Math.sin(a)] });
  });
  const leaves: Disc[] = [-1, 1].map((k) => disc([fc[0], fc[1] + k * W * 0.42, fc[2] - W * 0.62], n, W * 0.3, W * 0.13, 6, 'leaf', { up: [0, k * 0.8, 1] }));
  const rod = tube([[sd * 0.02, -W * 1.2, 0.02 * big], [sd * 0.02, W * 1.2, 0.02 * big]], 0.04 * big, 0.04 * big, 5, 'metal');
  const knobs = [-1, 1].map((k) => orb([sd * 0.02, k * W * 1.25, 0.02 * big], 0.065 * big, 5, 3, 'metalLit'));
  // A peach tassel hanging from its point.
  const tip: V3 = [0, 0, -H], tl = H * 0.17;
  const tassel = merge(orb(add(tip, [0, 0, -0.04 * big]), 0.07 * big, 6, 3, 'metal'),
    tube([add(tip, [0, 0, -0.08 * big]), add(tip, [0, 0, -0.08 * big - tl * 0.5]), add(tip, [0, 0, -0.08 * big - tl])], [0.05 * big, 0.08 * big, 0.11 * big], [0.05 * big, 0.08 * big, 0.11 * big], 6, (ring) => (ring ? 'ember' : 'flame')));
  return merge(slab, paint([facingDisc(inner, n, 'cloth'), facingDisc(footBand, n, 'clothDark'), ...leaves, ...petals, disc(add(fc, [sd * 0.004, 0, 0]), n, W * 0.16, W * 0.16, 7, 'ember')]), rod, ...knobs, tassel);
}

/** The Cartling's flower: a big white one on the front of its collar under its throat, on a spray of three leaves, standing off it. */
function cartFlower(s: Haul): Mesh {
  const q = collarPt(s, -Math.PI / 2 + 0.55, 0.06), n = unit(add(q.n, [0, 0.6, 0.35]));
  const leaves = [-1, 0, 1].map((k) => leaf(q.p, unit(add(q.n, [k * 0.7, 0.1, -0.7])), q.n, 0.2, 0.09, 4, k ? 'green' : 'deep'));
  return merge(...leaves, flower(add(q.p, scale(n, 0.05)), n, 0.21, 0.3));
}

/**
 * The padded collar of the Wagonox and the Haulhorn: a wide, rounded roll of leather right round the root of its neck in front
 * of its withers, thicker at the shoulders where it takes the pull, a seam of darker leather round it and brass studs along it.
 * In the neck's frame, so it sits on the neck as the neck moves.
 */
function collarMesh(s: Haul): Mesh {
  const N = s.neck, big = bigOf(s), t = N.w * 0.05, cr = collarOf(s).w * big;
  const ring = Array.from({ length: 21 }, (_, q) => onNeck(s, t + Math.cos((q / 20) * TAU) * N.w * 0.12, (q / 20) * TAU, 1.1));
  const pts = ring.map((q) => q.p), w = ring.map((_, q) => cr * (1.3 + 0.35 * Math.abs(Math.sin((q / 20) * TAU))));
  const roll = tube(pts, w, w.map((x) => x * 0.75), 8, (_r, j) => (j % 4 === 1 ? 'leatherLit' : 'leather'), { start: false, end: false, up: [0, 0, 1] });
  const studs = ring.filter((_, q) => q % 3 === 1).map((q) => orb(add(q.p, scale(q.n, cr * 1.15)), cr * 0.3, 5, 3, 'metal'));
  return merge(roll, ...studs);
}

/* ---- legs and tail ----------------------------------------------------------------------------- */

/** A cloven hoof: two dark toes side by side with a cleft between them, each a squat wedge longer forward than it is wide, its sole flat on the ground. */
function cloven(r: number, h: number, n: number): Mesh {
  const m = merge(...[-1, 1].map((sd) => tube([[sd * r * 0.42, r * 0.06, 0.02], [sd * r * 0.47, r * 0.18, -h * 0.5], [sd * r * 0.5, r * 0.26, -h]],
    [r * 0.46, r * 0.52, r * 0.55], [r * 0.66, r * 0.78, r * 0.84], n, 'hoof', { seam: 'start' })));
  return mesh(m.v.map((p) => [p[0], p[1], Math.max(p[2], -h)] as V3), m.f);
}

/**
 * The leaves round a lower leg: a ring of them round its fetlock hanging down over the top of the hoof, and up the leg as far as
 * its stage's are shaggy -- to the knee on the Wagonox at the back, all the way up on the Haulhorn. In the lower leg's frame.
 */
function legLeaves(s: Haul, l1: number, w: number, K: number, seed: number): Frond[] {
  const out: Frond[] = [], L = s.mane.leaf * [0.62, 0.55, 0.58][s.stage];
  // The lowest ring rooted so its tips come down to just over the hoof, and each ring over it a little shorter.
  const first = 1 - (L * 0.95) / l1, gap = (L * 0.62) / l1;
  const rings: Array<[number, number, number]> = Array.from({ length: [1, 1, 2][s.stage] }, (_, r) => [first - r * gap, 4, r ? [0.8, 0.85, 0.9][s.stage] : 1]);
  rings.forEach(([at, count, k], r) => {
    for (let q = 0; q < count; q++) {
      const a = ((q + 0.5 * r) / count) * TAU + jitter(seed + q) * 0.3, id = seed + r * 17 + q;
      const o: V3 = [Math.cos(a), Math.sin(a), 0];
      const root: V3 = [o[0] * w * 0.85, o[1] * w * 0.85, -l1 * at + L * 0.1];
      out.push(...cluster(root, o, [0, 0, -1], L * k, K, id, 0.3, 2));
    }
  });
  return out;
}

/** The tail: a short cream rope of links, and at its end a tuft of leaves fanning down from it. */
function tailOf(s: Haul, K: number): Array<{ mesh: Mesh; fr?: Fronds }> {
  const T = s.tail, n = T.links.length;
  return T.links.map((L, q) => {
    const w0 = T.w * (1 - 0.15 * q), w1 = T.w * (1 - 0.15 * (q + 1));
    const rope = tube([[0, 0.02, 0], [0, -L - 0.02, 0]], [w0, w1], [w0, w1], 6, 'coat');
    if (q < n - 1) return { mesh: rope };
    const parts: Frond[] = [];
    const count = [7, 9, 11][s.stage];
    for (let k = 0; k < count; k++) {
      const a = (k / count) * TAU, id = 4000 + k, o: V3 = [Math.cos(a), 0, Math.sin(a)];
      const root: V3 = [o[0] * w1 * 0.6, -L * (0.4 + 0.5 * (k % 2)), o[2] * w1 * 0.6];
      const len = T.leaf * (0.9 + 0.3 * jitter(id));
      // The darker green, so the tail stands off the grass behind it.
      parts.push({ mesh: leaf(root, unit(add(scale(o, 0.5), [0, -1, 0])), o, len, len * 0.45, K, k % 3 ? 'deep' : 'green'), root, out: o, len });
    }
    const fr = fronds(parts);
    return { mesh: merge(rope, fr.mesh), fr: { ...fr, mesh: merge(rope, fr.mesh), w: [...rope.v.map(() => 0), ...fr.w], out: [...rope.v.map(() => [0, 0, 0] as V3), ...fr.out], root: [...rope.v.map((p) => p), ...fr.root] } };
  });
}

/* ---- a stage's pieces --------------------------------------------------------------------------- */

function haulBuild(s: Haul, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6), K = lod ? 5 : 3, R = restOf(s);
  const pieces: Piece[] = [];
  const rustled = (key: string, f: Fronds, bone: string, len: number, phase: number, extra: Partial<Piece>): Piece =>
    ({ key, mesh: f.mesh, bone, bent: rustling(s, f, len, phase), ...extra });
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 3), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.035 } });
  pieces.push({ key: 'bib', mesh: chestFur(s, K), bone: 'trunk', bias: 0.04, after: ['body'], lines: false });
  pieces.push({ key: 'harness', mesh: harnessOf(s, n), bone: 'trunk', bias: 0.06, after: ['body', 'bib'] });
  pieces.push(rustled('back', fronds(backLeaves(s, K)), 'trunk', s.mane.leaf, 0.6, { bias: 0.08, after: ['body', 'harness'] }));
  pieces.push({ key: 'neck', mesh: neckOf(s, n), bone: 'neck', bias: 0, under: 'head', convex: true });
  pieces.push({ key: 'throat', mesh: throatFur(s, K), bone: 'neck', bias: 0.02, after: ['neck'], lines: false });
  if (s.stage) pieces.push({ key: 'collar', mesh: collarMesh(s), bone: 'neck', bias: 0.03, after: ['neck', 'throat', 'body', 'bib'] });
  pieces.push(rustled('mane', fronds(maneLeaves(s, K)), 'neck', s.mane.leaf, 0, { bias: 0.04, after: ['neck', 'throat', ...(s.stage ? ['collar'] : [])] }));
  if (s.stage === 0) pieces.push({ key: 'flower', mesh: cartFlower(s), bone: 'trunk', bias: 0.1, after: ['body', 'bib', 'harness', 'neck', 'throat', 'mane'] });
  const hide = headSolids(s);
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  pieces.push(rustled('crown', fronds(crownOf(s, K)), 'head', s.mane.leaf * 0.6, 1.2, { bias: 0.22, after: ['head'] }));
  pieces.push({ key: 'horns', mesh: hornsOf(s, n), bone: 'head', bias: 0.24, after: ['head', 'crown'] });
  for (const sd of [1, -1]) pieces.push({ key: sd > 0 ? 'earR' : 'earL', mesh: earOf(s, sd), bone: sd > 0 ? 'earR' : 'earL', bias: 0.21, after: ['head'], front: [sd, 0.2, 0] });
  tailOf(s, K).forEach((t, q) => pieces.push(t.fr
    ? rustled(`tail${q}`, t.fr, `tail${q}`, s.tail.leaf, 2, { bias: -0.05 + q * 0.01 })
    : { key: `tail${q}`, mesh: t.mesh, bone: `tail${q}`, bias: -0.05 + q * 0.01 }));
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], [l0, l1] = R.legs[i], w = s.thick;
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    // The upper part up inside the body, a round shoulder or haunch at its top; the lower a sturdy column of its coat down to
    // the fetlock, its leaves round it, and the hoof.
    const upper = merge(orb([0, 0, w * 0.2], [w * 1.45, w * 1.6, w * 1.4], n, k, 'coat'), tube([[0, 0, 0], [0, 0, -l0]], [w * 1.3, w * 1.1], [w * 1.3, w * 1.1], n, 'coat', { seam: 'start' }), orb([0, 0, -l0], w * 1.08, n, k, 'coat'));
    const lower = tube([[0, 0, w * 0.6], [0, 0.01, -l1 * 0.6], [0, 0.02, -l1]], [w * 1.04, w * 0.92, w * 0.86], [w * 1.04, w * 0.92, w * 0.86], n, (ring) => (ring ? 'coat' : 'coat'), { seam: 'start' });
    const lv = fronds(legLeaves(s, l1, w, K, 5000 + i * 100));
    pieces.push(
      { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.01, under: 'body', convex: true },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: ['body', `${key}0`], front },
      { key: `${key}L`, mesh: lv.mesh, bone: `${key}1`, bias: 0.025, after: ['body', `${key}0`, `${key}1`], front },
      { key: `${key}2`, mesh: cloven(w * 0.98, s.ankle, n), bone: `${key}2`, bias: 0.015, after: ['body'], front },
    );
  }
  if (s.gear) {
    for (const sd of [1, -1]) {
      const near = sd > 0 ? ['fr1', 'hr1', 'fr0', 'hr0', 'fr2', 'hr2'] : ['fl1', 'hl1', 'fl0', 'hl0', 'fl2', 'hl2'];
      pieces.push({ key: sd > 0 ? 'poleR' : 'poleL', mesh: poleOf(s, sd), bone: 'trunk', bias: 0.1, after: ['body', 'harness', 'back', 'bib', ...near], front: [sd, 0, 0] });
    }
    pieces.push({ key: 'bell', mesh: bellOf(s, n), bone: 'bell', bias: 0.12, after: ['body', 'bib', 'harness', 'neck', 'throat', 'mane'] });
  }
  if (s.gear === 2) {
    pieces.push({ key: 'yoke', mesh: yokeOf(s), bone: 'trunk', bias: 0.09, after: ['body', 'harness', 'bib'] });
    for (const [sd, k, key] of BANNERS) {
      const near = sd > 0 ? ['fr1', 'fr0', 'fr2', 'frL', 'hr1', 'hr0', 'hr2', 'hrL'] : ['fl1', 'fl0', 'fl2', 'flL', 'hl1', 'hl0', 'hl2', 'hlL'];
      pieces.push({ key, mesh: bannerOf(s, sd, k), bone: key, bias: 0.11, after: ['body', 'harness', 'back', 'bib', sd > 0 ? 'poleR' : 'poleL', ...near], front: [sd, 0, 0] });
    }
  }
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Dust off the ground, and the green of the leaves that fly off it. */
const DUST: RGB = [204, 186, 156];
const LEAF_RGB: readonly RGB[] = [[124, 168, 76], [176, 204, 112], [96, 138, 64]];
const PETAL_RGB: RGB = [253, 250, 242];

/** Where something thrown from `p` with velocity `v` is `t` seconds on, falling slowly as a leaf does; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number, fall = 5): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.03, p[2] + v[2] * t - 0.5 * fall * t * t)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/** A leaf in the air: a small pointed oval turning over as it goes, lit on one side; never under a pixel and a half. */
function flyingLeaf(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01 || r <= 0.01) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, Math.min(1.5 / px, r * 3));
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(1, 0.45 + 0.4 * Math.abs(Math.sin(ang * 1.7)));
  g.fillStyle = css(c, al);
  g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), al);
  g.lineWidth = Math.max(r * 0.18, 0.1);
  g.beginPath();
  g.moveTo(-r, 0);
  g.quadraticCurveTo(0, -r * 0.9, r, 0);
  g.quadraticCurveTo(0, r * 0.9, -r, 0);
  g.fill();
  g.stroke();
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

/** Leaves shaken off it from `from`, `since` seconds after, up and out, turning as they fall; each drawn in front of the body or behind it. */
function shed(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.6): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.6 + 0.6 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp, Math.sin(a) * sp, up * (0.7 + 0.6 * jitter(k + 2))];
    const p = thrown(from, v, since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    flyingLeaf(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), k + since * (6 + 5 * jitter(k + 4)), LEAF_RGB[q % 3], 1 - smooth((since - life * 0.6) / (life * 0.4)));
  }
}

/** How big a stage's things in the air are drawn: less than in proportion on the little one, so they still read. */
const airy = (s: Haul): number => 0.5 + 0.5 * bigOf(s);

/** What a strike throws: dust where its fore feet come down, and leaves shaken off its mane at the blow. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Haul, b: Bones, t: number, front: boolean): void {
  const big = airy(s), mid = b.body.t, since = (t - HAUL_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  const brow = place(b.head, [0, s.head.r[1] * 0.7, s.head.up + s.head.r[2] * 0.5]);
  if (nearSide(brow, mid, view) === front) puff(g, view, brow, 0.35 * big, since / 0.35, 3, [236, 226, 204]);
  shed(g, view, mid, brow, since, front, 4 + 2 * s.stage, 40, 1.6 * big, 2.6, 0.09 * big);
  const ft = s.stage === 2 ? (t - HAUL_STAMP) * ACT_SECS.strike : since;
  if (ft > 0) for (const leg of ['fl2', 'fr2']) {
    const f = place(b[leg], [0, 0, 0]);
    for (const sd of [-1, 1]) {
      const p: V3 = [f[0] + sd * s.thick * (1 + 2.5 * ramp(ft, 0, 0.3)), f[1], 0.1 * big];
      if (nearSide(p, mid, view) === front) puff(g, view, p, (s.stage === 2 ? 0.6 : 0.35) * big, ft / 0.5, 20 + sd + (leg === 'fl2' ? 4 : 0));
    }
  }
}

/** What a go at its task throws: dust kicked back from each hoof as it digs in and pushes, and a leaf now and then off its mane. */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Haul, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = airy(s), mid = b.body.t, loop = a.graze >= 0.5, W = HAUL_WORK;
  const since = (t0: number): number => (t < t0 && !loop ? -1 : frac(t - t0) * ACT_SECS.work);
  const kick = (leg: string, t0: number, q: number, k: number): void => {
    const dt = since(t0);
    if (dt < 0 || dt > 0.5) return;
    const f = place(b[leg], [0, 0, 0]);
    const p: V3 = [f[0], f[1] - s.thick * (1 + 3 * ramp(dt, 0, 0.35)), 0.12 * big + 0.15 * big * ramp(dt, 0, 0.35)];
    if (nearSide(p, mid, view) === front) puff(g, view, p, 0.32 * big * k, dt / 0.5, q);
  };
  W.digs.forEach((d, q) => kick(q ? 'fl2' : 'fr2', d, q, 0.8));
  W.pushes.forEach((d, q) => kick(q ? 'hr2' : 'hl2', d, 10 + q, 1.1));
  const dt = since(W.heaves[0]);
  if (dt >= 0) shed(g, view, mid, place(b.neck, [0, -s.neck.w, s.neck.len * 0.5]), dt, front, 1 + s.stage, 90, 0.6 * big, 1.4, 0.08 * big, 0.9);
}

/**
 * Evolving: at the start a burst of leaves off it, which covers the moment it changes into its new body; then leaves and white
 * petals swirling up round it and in, gone into it at the flash.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Haul, b: Bones, t: number, front: boolean): void {
  const big = airy(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]];
  const burst = 1 - ramp(t, 0.1, 0.26);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 26; q++) {
      const th = (q / 26) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * marksOf(s).w[3] * 0.6, Math.sin(th) * s.len * 0.45, marksOf(s).h[3] * 0.7]);
      const v: V3 = [Math.cos(th) * (1.5 + 1.5 * jitter(q + 3)), Math.sin(th) * (1.5 + 1.5 * jitter(q + 5)), 2.4 + 2 * jitter(q + 7)];
      const p = thrown(from, scale(v, Math.sqrt(big)), since, 4);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      flyingLeaf(g, x, y, 0.12 * big, q * 1.3 + since * 6, q % 5 === 0 ? PETAL_RGB : LEAF_RGB[q % 3], burst * ramp(t, 0, 0.03));
    }
  }
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl > 0) {
    const rx = marksOf(s).w[3] * 1.5 + 0.3 * big, ry = s.len * 0.85 + 0.3 * big, high = marksOf(s).h[3] * 2.4 + 1.0 * big;
    for (let q = 0; q < 20; q++) {
      const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32);
      const ang = (q / 20) * TAU + u * TAU * 1.4;
      const k = (1 - u) ** 1.2;
      const p = place(b.trunk, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, -marksOf(s).h[3] * 0.4 + u * high * 0.7]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      flyingLeaf(g, x, y, 0.13 * big * (1 - 0.4 * u), ang * 2 + q, q % 4 === 0 ? PETAL_RGB : LEAF_RGB[q % 3], swirl * ramp(u, 0, 0.15));
    }
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/**
 * A barrel's rings rounded off at its ends: the rings between its first and last taken as how full it is along its length,
 * and closed over at the rump and the chest as the end of an egg is, in more rings drawn closer together toward each end, so
 * neither end is a flat face.
 */
function rounded(R: Rings): Rings {
  const n = R.y.length, y0 = R.y[0], y1 = R.y[n - 1], mid = (y0 + y1) / 2, half = (y1 - y0) / 2;
  const core: Rings = { y: R.y.slice(1, n - 1), z: R.z.slice(1, n - 1), w: R.w.slice(1, n - 1), h: R.h.slice(1, n - 1) };
  const out: Rings = { y: [], z: [], w: [], h: [] }, N = 16, p = 2.6;
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

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function haulKind(look: Haul): Kind {
  const s: Haul = { ...look, body: rounded(look.body), marks: look.body };
  const bones = haulBones(s);
  return {
    bones,
    build: (lod) => haulBuild(s, lod),
    // The variant's coat tints the tan of its dapples and its markings the cream of its wool, a little; the leaves, the leather,
    // the brass and the wood, its dark hooves and its brown eyes are the same on every variant, so every one is a cream ox in green.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const wool = mix([240, 208, 158], pastel(mark, 30), 0.16 * clamp(sat(mark) / 0.3 + 0.3));
      const dapple = mix([212, 168, 106], pastel(coat, 30), 0.4);
      return coatPalette(coat, mark, {
        coat: wool,
        coatDark: darkerOf(wool, 0.2),
        coatLight: mix(wool, [255, 252, 244], 0.4),
        mark: dapple,
        spot: mix([196, 188, 126], dapple, 0.15),
        belly: mix(wool, [255, 246, 226], 0.4),
        muzzle: mix(wool, [255, 248, 232], 0.55),
        inner: [238, 168, 156],
        nose: [112, 74, 60],
        lid: [86, 52, 36],
        eye: [44, 26, 20],
        glint: [255, 253, 246],
        crystal: [146, 90, 48],
        crystalDark: [110, 66, 36],
        hoof: [84, 62, 56],
        horn: [196, 148, 86],
        hornDark: [146, 100, 58],
        leaf: [138, 166, 92],
        stem: [122, 152, 82],
        leafDark: [88, 126, 58],
        moss: [170, 190, 122],
        petal: [253, 250, 242],
        bloom: [246, 200, 76],
        leather: [130, 70, 40],
        leatherDark: [92, 48, 28],
        leatherLit: [160, 96, 58],
        metal: [222, 172, 70],
        metalLit: [250, 216, 120],
        metalDark: [156, 108, 40],
        wood: [168, 114, 66],
        woodDark: [128, 84, 48],
        cloth: [112, 150, 86],
        clothDark: [80, 116, 64],
        trim: [240, 222, 172],
        ember: [218, 152, 110],
        flame: [178, 110, 78],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.len * 0.75 + marksOf(s).y[6] * 0.15, marksOf(s).w[3] * 1.35],
    stride: 1.2,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are leaf green and petal white.
    motes: [[150, 190, 92], [250, 246, 230]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

const darkerOf = (c: RGB, t: number): RGB => mix(c, [44, 34, 40], t);

export const CARTLING = haulKind(CARTLING_LOOK);
export const WAGONOX = haulKind(WAGONOX_LOOK);
export const HAULHORN = haulKind(HAULHORN_LOOK);
