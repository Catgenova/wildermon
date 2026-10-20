import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The mend line: the Stitchkit, a small round raccoon kit up on its hind
 * legs in a mint scarf and a short patterned apron, a tool belt of pouches
 * and spanners round its middle and a white flower at its hip, holding a
 * spanner as big as its arm in both hands; which grows into the Patchcoon,
 * taller, brass goggles pushed up on its brow with a spray of leaves and a
 * flower by its ear, a harness crossed over its chest and a pack on its back
 * with a bedroll rolled on top, spanners and a brass gear at its belt and a
 * stone-headed mallet in its paw; and then the Mendermask, big and stocky,
 * a leather pack on its back taller than its head -- a bedroll, cloths and
 * banners hung off it, tools sticking out of it, flowers on it and a brass
 * lantern swinging from its side on a chain -- a long patterned apron, a
 * heavy belt of pouches and brass keys, a big brass wrench in one paw and a
 * cloth in the other. The species is still `tinka` underneath, as saves and
 * the database know it: its trade is mending your gear.
 *
 * Each is grey-brown fur with cream: a dark mask across the eyes, a cream
 * muzzle and cheek ruffs, round ears cream inside, big amber eyes and a small
 * smile; dark brown forearms, paws and feet; and a big bushy tail ringed
 * cream and dark brown, carried out behind as the counterweight to a body
 * stood up on two short legs. All three are built by one set of functions
 * from a description of the stage (`Mend`). Its legs are bent to put each
 * foot where it is to be (`legOf`), so a planted foot stays where it was put
 * and a knee is always the same way round; its arms are bent to put its paws
 * on what they hold, and what they hold is posed in the chest's frame (the
 * plan's `grip`, `dir` and `up`), so a tool is turned, swung and tapped and
 * the paws go with it. At its task the Stitchkit takes a gear out of its
 * pouch and turns the nut on it with its spanner; the Patchcoon taps a
 * dented helmet true with its mallet; the Mendermask bends over a helmet on
 * the ground, turns its bolt with the wrench and wipes it down with its
 * cloth, the lantern swinging as it bends.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Mend {
  stage: 0 | 1 | 2;
  /** The hip on the right in the hips' frame; thigh, shin and the ankle's height over the sole; how thick each is; the foot's length and width; how far out each foot stands and how far ahead of the hip. */
  leg: { at: V3; len: [number, number, number]; w: [number, number]; foot: [number, number]; stance: number; ahead: number };
  /** How high the hips are carried standing. */
  high: number;
  /** The seat and belly, an egg in the hips' frame. */
  hips: { c: V3; r: V3 };
  /** The chest's joint on the hips and how far forward of upright it is carried. */
  chest: { at: V3; lean: number };
  /** The torso's rings in the chest's frame, bottom to top: how high, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** The shoulder on the right in the chest's frame; upper arm and forearm; how thick each; the paw's size. */
  shoulder: V3;
  arm: [number, number];
  armW: [number, number];
  hand: number;
  neck: { at: V3; len: number; w: number };
  /** The skull's half-sizes, how far its middle is over the top of the neck, and how it is pitched. */
  head: { r: V3; up: number; pitch: number };
  eye: { dir: V3; size: number; tall: number };
  ear: { len: number; w: number };
  /** The tail: its root on the hips, each link's length and its girth at each joint; lifted at the root (degrees up from straight back), curled up at each link and at the last three; swung to the right at the root and swept further round at each link, so it trails in a curve and is never seen end on. */
  tail: { at: V3; links: number[]; w: number[]; lift: number; curl: number; tip: number; side?: number; sweep?: number };
  /** Where its belt is on the hips, and how far down from it the apron hangs. */
  belt: number;
  apron: number;
  /** Its tool's length from the paw that grips it to its head. */
  tool: number;
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the hips sink at each footfall; how far it rolls and sways over each foot. */
    step: number; bob: number; roll: number; sway: number;
  };
  size: number;
}

/** A Stitchkit: small and round, a big head on a pear of a body, short legs, its tail curling up behind as high as its ears. */
const STITCHKIT_LOOK: Mend = {
  stage: 0,
  leg: { at: [0.24, 0.02, -0.1], len: [0.28, 0.26, 0.09], w: [0.2, 0.15], foot: [0.4, 0.17], stance: 0.27, ahead: 0.04 },
  high: 0.6,
  hips: { c: [0, 0.02, 0.1], r: [0.52, 0.46, 0.44] },
  chest: { at: [0, 0, 0.1], lean: 2 },
  torso: { z: [-0.05, 0.16, 0.36, 0.52, 0.6], y: [0.02, 0.04, 0.02, 0, -0.01], w: [0.5, 0.48, 0.4, 0.28, 0.17], h: [0.42, 0.4, 0.33, 0.24, 0.15] },
  shoulder: [0.3, 0.03, 0.42],
  arm: [0.27, 0.27], armW: [0.12, 0.11], hand: 0.11,
  neck: { at: [0, 0.01, 0.54], len: 0.08, w: 0.17 },
  head: { r: [0.6, 0.5, 0.42], up: 0.34, pitch: 12 },
  eye: { dir: [0.44, 0.84, 0.16], size: 0.19, tall: 1.1 },
  ear: { len: 0.3, w: 0.2 },
  tail: { at: [0, -0.3, -0.08], links: [0.22, 0.22, 0.22, 0.21, 0.2, 0.18], w: [0.17, 0.25, 0.3, 0.31, 0.29, 0.24, 0.13], lift: -14, curl: 24, tip: 10, side: 52 },
  belt: 0.08, apron: 0.36,
  tool: 0.92,
  gait: { duty: [0.6, 0.38], swing: [0.56, 0.48], step: 0.5, bob: 0.07, roll: 7, sway: 0.05 },
  size: 2.6,
};

/** A Patchcoon: taller, goggles on its brow, a pack on its back with a bedroll on it, a mallet in its paw. */
const PATCHCOON_LOOK: Mend = {
  stage: 1,
  leg: { at: [0.28, 0.02, -0.14], len: [0.5, 0.46, 0.11], w: [0.19, 0.14], foot: [0.48, 0.19], stance: 0.32, ahead: 0.05 },
  high: 1.04,
  hips: { c: [0, 0, 0.08], r: [0.52, 0.42, 0.46] },
  chest: { at: [0, 0, 0.14], lean: 4 },
  torso: { z: [-0.06, 0.32, 0.66, 0.88, 0.98], y: [0, 0.02, 0.02, 0, -0.01], w: [0.48, 0.46, 0.4, 0.3, 0.18], h: [0.38, 0.37, 0.33, 0.25, 0.16] },
  shoulder: [0.35, 0.03, 0.78],
  arm: [0.36, 0.35], armW: [0.145, 0.13], hand: 0.13,
  neck: { at: [0, 0.02, 0.92], len: 0.1, w: 0.2 },
  head: { r: [0.64, 0.54, 0.47], up: 0.38, pitch: 10 },
  eye: { dir: [0.44, 0.84, 0.15], size: 0.185, tall: 1.08 },
  ear: { len: 0.34, w: 0.22 },
  tail: { at: [0, -0.38, -0.1], links: [0.26, 0.26, 0.26, 0.25, 0.24, 0.22, 0.2], w: [0.2, 0.29, 0.34, 0.36, 0.35, 0.32, 0.26, 0.14], lift: -22, curl: 14, tip: 14, side: 46 },
  belt: 0.1, apron: 0.52,
  tool: 0.95,
  gait: { duty: [0.6, 0.38], swing: [0.4, 0.42], step: 0.38, bob: 0.07, roll: 6, sway: 0.05 },
  size: 3.0,
};

/** A Mendermask: big and stocky, a huge pack on its back, a long apron, its tail massive behind it. */
const MENDERMASK_LOOK: Mend = {
  stage: 2,
  leg: { at: [0.52, 0.02, -0.16], len: [0.48, 0.42, 0.15], w: [0.44, 0.33], foot: [0.74, 0.36], stance: 0.6, ahead: 0.06 },
  high: 1.0,
  hips: { c: [0, 0.04, 0.16], r: [1.08, 0.84, 0.74] },
  chest: { at: [0, 0, 0.2], lean: 5 },
  torso: { z: [-0.1, 0.38, 0.8, 1.06, 1.2], y: [0.04, 0.08, 0.06, 0.02, -0.01], w: [1.08, 1.06, 0.96, 0.7, 0.36], h: [0.82, 0.8, 0.68, 0.5, 0.3] },
  shoulder: [0.84, 0.04, 0.92],
  arm: [0.66, 0.62], armW: [0.3, 0.34], hand: 0.28,
  neck: { at: [0, 0.3, 1.14], len: 0.18, w: 0.44 },
  head: { r: [0.96, 0.8, 0.7], up: 0.5, pitch: 8 },
  eye: { dir: [0.44, 0.84, 0.14], size: 0.26, tall: 1.05 },
  ear: { len: 0.44, w: 0.32 },
  tail: { at: [0, -0.66, -0.12], links: [0.28, 0.27, 0.35, 0.27, 0.35, 0.26, 0.33, 0.24, 0.3], w: [0.3, 0.46, 0.6, 0.7, 0.74, 0.7, 0.62, 0.5, 0.32, 0.04], lift: -40, curl: 4, tip: 11, side: 18, sweep: 0 },
  belt: 0.14, apron: 0.5,
  tool: 1.15,
  gait: { duty: [0.62, 0.4], swing: [0.36, 0.4], step: 0.32, bob: 0.08, roll: 5, sway: 0.06 },
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
/** A direction or point in the world taken into the frame `x`. */
const backDir = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]; };
const backPt = (x: Xf, p: V3): V3 => backDir(x, sub(p, x.t));
/** `b` (in the frame of `a`) followed on from `a`. */
function compose(a: Xf, b: Xf): Xf {
  const cols = [0, 1, 2].map((j) => turn(a, [b.m[j], b.m[3 + j], b.m[6 + j]]));
  return xfOf(cols[0], cols[1], cols[2], place(a, b.t));
}
/** Two frames mixed, `k` of the way from `a` to `b`, kept square. */
function blendXf(a: Xf, b: Xf, k: number): Xf {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const col = (x: Xf, j: number): V3 => [x.m[j], x.m[3 + j], x.m[6 + j]];
  const [X, Y, Z] = frameOf(mixV(col(a, 2), col(b, 2), k), mixV(col(a, 1), col(b, 1), k));
  return xfOf(X, Y, Z, mixV(a.t, b.t, k));
}
/** `v` turned `a` radians about the unit axis `k`. */
function rotAbout(v: V3, k: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/** An egg with its axes along a frame: anything round that leans or points. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
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

/** A block `r` (half-sizes) along the frame's three axes: a box, a buckle, a strap's end. */
function block(c: V3, r: V3, f: [V3, V3, V3], mat: Mat, taperTop = 0): Mesh {
  const [X, Y, Z] = f, v: V3[] = [];
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const top = sz > 0 ? 1 - taperTop : 1;
    v.push(add(c, add(add(scale(X, sx * r[0] * top), scale(Y, sy * r[1] * top)), scale(Z, sz * r[2]))));
  }
  const f6: Face[] = [
    { i: [0, 2, 3, 1], m: mat }, { i: [4, 5, 7, 6], m: mat }, { i: [0, 1, 5, 4], m: mat },
    { i: [2, 6, 7, 3], m: mat }, { i: [0, 4, 6, 2], m: mat }, { i: [1, 3, 7, 5], m: mat },
  ];
  return mesh(v, wound(v, f6, c));
}
const UPRIGHT: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** A flat painted shape through `pts`, wound so it faces along `n`. */
function facingDisc(pts: V3[], n: V3, m: Mat, at?: V3): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, at };
}

/** A sheet through a grid of points (rows of columns), both sides of it, so it shows from in front and behind: an apron, a cloth, a banner. */
function sheet(rows: V3[][], mat: Mat | ((r: number, c: number) => Mat), back: Mat = typeof mat === 'string' ? mat : 'lining'): Mesh {
  const v: V3[] = [], f: Face[] = [], C = rows[0].length;
  for (const row of rows) v.push(...row);
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < C - 1; c++) {
    const q = [r * C + c, r * C + c + 1, (r + 1) * C + c + 1, (r + 1) * C + c];
    f.push({ i: q, m: typeof mat === 'string' ? mat : mat(r, c) });
    f.push({ i: [...q].reverse(), m: back });
  }
  return mesh(v, f);
}

/** A loop of something round a body at a height: a belt, a scarf, a strap of goggles. `pts` round it, `w` out from it and `h` up it. */
const loop = (pts: V3[], w: number, h: number, n: number, mat: Mat): Mesh => tube([...pts, pts[0], pts[1]].slice(0, pts.length + 1), w, h, n, mat, { start: false, end: false });

/** An ellipse of `count` points at height `z`, `rx` across and `ry` deep about `c`. */
const ring = (c: V3, rx: number, ry: number, z: number, count: number): V3[] =>
  Array.from({ length: count }, (_, q) => { const a = (q / count) * TAU; return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry, z] as V3; });

/** Where the egg `(c, r)` is cut by the level `z`: its half across and half deep there. */
function eggAt(c: V3, r: V3, z: number): [number, number] {
  const f = Math.sqrt(Math.max(0.04, 1 - ((z - c[2]) / r[2]) ** 2));
  return [r[0] * f, r[1] * f];
}

/** The torso's ring at height `z` in the chest's frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Mend, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/** A point on the torso's skin at height `z`, `a` radians round from its right side (a quarter turn is its front), lifted `out` off it. */
function onTorso(s: Mend, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z);
  return [Math.cos(a) * (r.w + out), r.y + Math.sin(a) * (r.h + out), z];
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Stitchkit's spanner brought down, the Patchcoon's mallet, the Mendermask's wrench swung across. */
export const MEND_HITS: readonly number[] = [0.5, 0.5, 0.54];
/**
 * A go at its task, by stage, as shares of it: when what it mends is taken off its belt and hung back on it; the Stitchkit's three
 * pulls on the spanner; the Patchcoon's three taps of its mallet on the helmet and the turn of it to look; the Mendermask's helmet
 * set down on the ground, its two turns of the wrench, its two wipes of the cloth, the helmet lifted again and the moment it
 * straightens up.
 */
export const MEND_WORK = {
  hang: 0.1, back: 0.9,
  pulls: [0.38, 0.52, 0.66] as const,
  taps: [0.32, 0.44, 0.56] as const, look: 0.68,
  set: 0.25, turns: [0.34, 0.43] as const, wipes: [0.5, 0.58] as const, lift: 0.66, rise: 0.68,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** A pose: where each ankle is and how its foot is pitched, how the body and the chest are carried, and where its paws and its tool are. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left, past how it is carried. */
  chest: V3;
  /** The neck bent forward and turned left; the head nose-up, turned left and tilted, against level. */
  neck: number[]; head: V3;
  /** The tool, in the chest's frame: where the paw that holds it grips it, the way its head is from there, and the way its face looks. */
  grip: V3; dir: V3; up: V3;
  /** Where each paw is when it is not on the tool (the chest's frame), and how much it is on it, left then right. */
  hand: V3[]; on: number[];
  /** What is held for its task: how much it is in the paw rather than hung on the belt, how much it is down on the ground rather than in the paw, and how far it is turned. */
  held: number; ground: number; spin: number;
  /** The tail lifted, swung to the left and curled past how it is carried. */
  tail: V3;
  /** The pack bounced up and tipped back; the lantern swung forward and to the left, in degrees. */
  pack: number[]; swing: number[];
  ears: number;
}

/** Every number of two like things put together by `f`: how plans are mixed, and how one is moved by as much as another moves. */
function zip<T>(a: T, b: T, f: (x: number, y: number) => number): T {
  if (typeof a === 'number') return f(a, b as unknown as number) as unknown as T;
  if (Array.isArray(a)) return a.map((x, i) => zip(x, (b as unknown as unknown[])[i], f)) as unknown as T;
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(a as object)) o[k] = zip((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], f);
  return o as T;
}
const mixPlan = (a: Plan, b: Plan, k: number): Plan => zip(a, b, (x, y) => lerp(x, y, k));
/** `p` moved by as much as `to` is from `from`, every number of it. */
const shifted = (p: Plan, to: Plan, from: Plan): Plan => zip(p, zip(to, from, (x, y) => x - y), (x, d) => x + d);

interface Rest {
  /** Each ankle standing, along the ground under the hips. */
  ankle: V3[];
  reach: number;
  /** Where the Mendermask's helmet sits in front of it, on the ground; the helmet's top in the chest's frame at its full bow; the way up there. */
  site: V3; siteC: V3; upC: V3;
  /** The way the wrench goes from the paw to the helmet's bolt, in the chest's frame at the full bow. */
  wrench: V3;
}

/** How far along the tool from the gripping paw each paw holds it: the Stitchkit's left paw further up the shaft than its right. */
const GRIP_OFF = (s: Mend): number[] => [s.stage === 0 ? s.tool * 0.36 : 0, 0];
/** Where along the tool its business end is: the spanner's and the wrench's jaw, the mallet's head. */
const HEAD_AT = (s: Mend): number => s.tool * [0.86, 1.0, 0.9][s.stage];

/** The tool as it is held standing: the spanner across its front in both paws, the mallet up at its side, the wrench up by its chest. */
function toolRest(s: Mend): { grip: V3; dir: V3; up: V3; hand: V3[]; on: number[] } {
  const k = s.torso.h[1];
  if (s.stage === 0) return { grip: [0.16, k + 0.1, 0.16], dir: unit([-0.4, 0.62, 0.66]), up: [0.3, 0.5, 0.8], hand: [[-0.3, k, 0.1], [0.3, k, 0.1]], on: [1, 1] };
  if (s.stage === 1) return { grip: [0.52, k + 0.1, 0.5], dir: unit([0.22, 0.2, 1]), up: [0, 1, 0], hand: [[-0.36, k * 0.55, 0.05], [0.3, k, 0.1]], on: [0, 1] };
  return { grip: [0.9, k - 0.02, 0.52], dir: unit([0.32, 0.22, 1]), up: [0, 1, 0], hand: [[-0.8, k - 0.04, 0.6], [0.3, k, 0.1]], on: [0, 1] };
}

const rests = new Map<Mend, Rest>();
function restOf(s: Mend): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3);
  const R: Rest = { ankle, reach: L.len[0] + L.len[1], site: [0, 1.4, 0], siteC: [0, 1, 0], upC: [0, 0, 1], wrench: [0, 0.7, -0.7] };
  rests.set(s, R);
  return R;
}

function restPlan(s: Mend, R: Rest): Plan {
  const T = toolRest(s);
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0],
    grip: [...T.grip], dir: [...T.dir], up: [...T.up], hand: T.hand.map((h) => [...h] as V3), on: [...T.on],
    held: 0, ground: 0, spin: 0, tail: [0, 0, 0], pack: [0, 0], swing: [0, 0], ears: 0,
  };
}

/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}
/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const EDGE = 0.1;

/**
 * Going: up on its hind legs, one foot and then the other. Each foot down for its share of a stride and swept back under the
 * hips at the ground's own speed, so it never skates, then lifted and brought forward through the air; the hips sinking onto
 * each foot as it comes down and rising over it, rolled and swayed over the foot that is down, turned with the leg that reaches,
 * the chest turned the other way; the head held steady and bobbing a little; the tail swinging against the hips; the pack
 * bouncing a beat behind the hips and the lantern swinging.
 */
function goingPlan(s: Mend, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = R.reach, half = L * amp;
  for (let i = 0; i < 2; i++) {
    const A = R.ankle[i], ph = frac(a.u + i * 0.5);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]];
      p.foot[i] = 0;
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
    const lift = G.step * L * (1 + 0.3 * g);
    const y0 = A[1] - half - v * EDGE, y1 = A[1] + half + v * EDGE;
    const y = u < EDGE ? A[1] - half - v * u : u > 1 - EDGE ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
    p.at[i] = [A[0] - (i ? 1 : -1) * 0.02 * L * Math.sin(Math.PI * u), y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    // The toe tipped down as it leaves the ground and up as it reaches for the next step.
    p.foot[i] = -22 * Math.sin(Math.PI * clamp(u * 1.6)) * (1 - u) + 8 * hump(u, 0.85, 0.15);
  }
  // Each foot's own phase: nought as it comes down. The hips lowest just after each foot comes down, highest over it, twice a
  // stride; at a run, highest in the air between steps.
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.08));
  p.H += -G.bob * L * 2.2 * (down - 0.5) * (1 - 0.5 * g) + g * L * (0.1 * Math.max(0, Math.sin(2 * TAU * (w - duty * 0.5 + 0.25))) - 0.06);
  // Over the foot that is down: the left (0) from nought to half a stride, the right after.
  const over = Math.sin(TAU * (w - 0.2));
  p.roll = G.roll * over;
  p.side = -G.sway * L * 2 * over * (1 - 0.6 * g);
  p.yaw = 6 * Math.cos(TAU * w) * (1 - 0.3 * g);
  p.chest = [6 + 16 * g + 3 * (down - 0.5), -p.yaw * 1.4, -p.roll * 0.6];
  p.pitch = -3 - 7 * g;
  // The head held level against the bob, nodding a little with each step.
  p.head = [5 * (down - 0.5) * 2 + 4 + 6 * g, -p.yaw * 0.4 - p.chest[1] * 0.5, -p.roll * 0.8];
  p.neck = [4 * g, 0];
  // The tail swinging against the hips a beat behind them, and lifted at a run.
  p.tail = [g * 28 + 6 * (down - 0.5), -p.yaw * 2.4 - 12 * Math.sin(TAU * (w - 0.08)), g * -10];
  // The pack thumping down a beat after the hips, and swaying; the lantern swinging fore and aft at each step and from side to side.
  p.pack = [s.stage ? -0.06 * L * (0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.2))) : 0, (s.stage ? 3 : 0) * Math.sin(2 * TAU * (w - 0.25))];
  p.swing = [-8 * Math.sin(2 * TAU * (w - 0.3)) - 6 * g, 12 * Math.sin(TAU * (w - 0.35))];
  // The tool carried with the stride: swung a little at the arm.
  const sw = Math.sin(TAU * (w - 0.05));
  p.grip = add(p.grip, [0, 0.05 * L * sw, 0.02 * L * Math.abs(sw)]);
  p.hand = p.hand.map((h, i) => add(h, [0, 0.12 * L * sw * (i ? 1 : -1), 0])) as V3[];
  p.ears = 0;
  return p;
}

/**
 * Standing about: breathing, the weight shifting from foot to foot, looking about, its tail swaying; now and then the tool
 * held up to look at close, and a look back over its shoulder at what it carries.
 */
function stillPlan(s: Mend, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  const w = Math.tanh(2.5 * cyc(t, 3));
  p.chest = [1.5 * (a.breath - 0.5), 8 * look * 0.3, 1.5 * w];
  p.roll = -1.5 * w;
  p.side = 0.02 * s.leg.len[0] * w;
  p.neck = [0, 12 * look];
  p.head = [3 * cyc(t, 4), 10 * look, 5 * drift(t, 3)];
  p.H += 0.01 * R.reach * (a.breath - 0.5);
  p.tail = [3 * cyc(t, 3, 1), 12 * cyc(t, 4), 4 * cyc(t, 5)];
  p.swing = [2 * cyc(t, 4), 3 * cyc(t, 3)];
  // The tool held up to its eye and turned over, twice in the loop.
  const peer = beat(t, [6.2, 17.5], 2.4);
  if (peer > 0) {
    const T = toolRest(s);
    p.grip = add(T.grip, [-0.08 * R.reach * peer, 0.04 * R.reach * peer, 0.22 * R.reach * peer]);
    p.dir = unit(add(T.dir, [0.5 * peer, 0.3 * peer * Math.sin(t * 4), -0.2 * peer]));
    p.head[0] -= 4 * peer;
    p.head[1] -= 14 * peer;
    p.head[2] += 10 * peer;
  }
  const back = beat(t, [11.5], 2.2);
  p.neck[1] += 30 * back;
  p.head[1] += 26 * back;
  p.chest[1] += 12 * back;
  p.ears = beat(t, [3.1, 14.2, 20.4], 0.5);
  return p;
}

/* ---- its strike ---------------------------------------------------------------------- */

interface ToolKey { t: number; grip: V3; dir: V3; arc?: V3 }
/** The tool through a swing: between each key and the next, eased, faster into a key marked as the blow. */
function toolPath(keys: ToolKey[], t: number, hit: number): { grip: V3; dir: V3 } {
  if (t <= keys[0].t) return { grip: keys[0].grip, dir: keys[0].dir };
  for (let q = 0; q < keys.length - 1; q++) {
    const a = keys[q], b = keys[q + 1];
    if (t <= b.t) {
      const u = (t - a.t) / (b.t - a.t), e = Math.abs(b.t - hit) < 1e-6 ? u ** 1.7 : smooth(u);
      // Swung out round an arc on the way, so the paw is carried round the shoulder rather than through it.
      const g = mixV(a.grip, b.grip, e);
      return { grip: b.arc ? add(g, scale(b.arc, Math.sin(Math.PI * e))) : g, dir: unit(mixV(a.dir, b.dir, e)) };
    }
  }
  const z = keys[keys.length - 1];
  return { grip: z.grip, dir: z.dir };
}

/**
 * A strike. The Stitchkit raises its spanner over its head in both paws, rocked back, and brings it down in front of it; the
 * Patchcoon draws its mallet back over its shoulder, steps in and hammers it down; the Mendermask turns away with its wrench
 * drawn back at its side and swings it across in front of it, its whole body and its pack turned with the blow, the lantern
 * flung out on its chain.
 */
function strikePlan(s: Mend, R: Rest, t: number): Plan {
  const p = restPlan(s, R), T = toolRest(s), hit = MEND_HITS[s.stage], L = R.reach, k = s.torso.h[1];
  const wind = ramp(t, 0.04, 0.32) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.1, 0.96));
  const jolt = hump(t, hit + 0.02, 0.06);
  const z = s.torso.z[3];
  let keys: ToolKey[];
  if (s.stage === 0) {
    keys = [
      { t: 0.02, grip: T.grip, dir: T.dir },
      { t: 0.3, grip: [0.14, 0.06, z + 0.26], dir: unit([-0.12, -0.25, 0.96]) },
      { t: 0.36, grip: [0.14, 0.04, z + 0.28], dir: unit([-0.12, -0.32, 0.94]) },
      { t: hit, grip: [0.08, k + 0.2, 0.22], dir: unit([-0.1, 0.92, -0.25]), arc: [0, 0.12, 0.18] },
      { t: hit + 0.12, grip: [0.08, k + 0.2, 0.2], dir: unit([-0.1, 0.9, -0.3]) },
      { t: 0.94, grip: T.grip, dir: T.dir },
    ];
    p.chest = [-10 * wind + 16 * blow, 0, 0];
    p.head = [10 * wind - 6 * blow + 4 * jolt, 0, 0];
  } else if (s.stage === 1) {
    keys = [
      { t: 0.02, grip: T.grip, dir: T.dir },
      { t: 0.3, grip: [0.72, -0.02, z + 0.16], dir: unit([0.55, -0.45, 0.7]) },
      { t: 0.36, grip: [0.74, -0.04, z + 0.18], dir: unit([0.55, -0.5, 0.66]) },
      { t: hit, grip: [0.3, k + 0.26, 0.25], dir: unit([-0.05, 0.85, -0.5]), arc: [0.18, 0.2, 0.15] },
      { t: hit + 0.12, grip: [0.24, k + 0.25, 0.22], dir: unit([-0.05, 0.8, -0.58]) },
      { t: 0.94, grip: T.grip, dir: T.dir },
    ];
    p.chest = [-8 * wind + 18 * blow, -14 * wind + 10 * blow, 0];
    p.head = [8 * wind - 6 * blow + 4 * jolt, 10 * wind - 6 * blow, 0];
    p.hand[0] = add(p.hand[0], [-0.12 * L * (wind + blow), 0.1 * L * blow, 0.2 * L * wind]);
  } else {
    keys = [
      { t: 0.02, grip: T.grip, dir: T.dir },
      { t: 0.3, grip: [1.12, 0.12, z - 0.5], dir: unit([0.6, -0.55, 0.58]) },
      { t: 0.34, grip: [1.14, 0.1, z - 0.48], dir: unit([0.6, -0.6, 0.53]) },
      { t: hit, grip: [0.1, k + 0.5, z - 0.1], dir: unit([-0.75, 0.6, 0.18]) },
      { t: hit + 0.16, grip: [-0.55, k + 0.25, z - 0.2], dir: unit([-0.85, -0.2, 0.15]) },
      { t: 0.94, grip: T.grip, dir: T.dir },
    ];
    // Turned away to the right with it drawn back, then round to the left through the blow.
    // Turned away and round through the blow more slowly than the arm swings, so the great pack it carries is not flung about.
    const yaw = STRIKE_TURN(t, hit);
    p.chest = [-4 * wind + 12 * blow, yaw, 0];
    p.yaw = yaw * 0.4;
    p.H -= L * 0.09 * (wind + blow);
    p.head = [4 * jolt, -yaw * 0.4, 0];
    p.hand[0] = add(p.hand[0], [-0.15 * L * blow, -0.1 * L * wind, 0.05 * L * wind]);
    p.swing = [lanternLag(t, (u) => STRIKE_LEAN(u, hit)), lanternLag(t, (u) => -STRIKE_TURN(u, hit) * 0.9)];
    p.pack = [0, 4 * jolt];
  }
  const tool = toolPath(keys, t, hit);
  p.grip = tool.grip;
  p.dir = tool.dir;
  // Its feet planted, the near one stepped forward into the blow and back.
  const step = ramp(t, 0.3, hit - 0.04) * (1 - ramp(t, hit + 0.18, 0.92));
  const i = s.stage === 2 ? 0 : 0, A = R.ankle[i], fwd: V3 = [A[0], A[1] + L * 0.28, A[2]];
  p.at[i] = mixV(A, fwd, step);
  p.at[i][2] += L * 0.18 * (hump(t, (0.3 + hit - 0.04) / 2, (hit - 0.34) / 2) + hump(t, (hit + 0.18 + 0.92) / 2, (0.92 - hit - 0.18) / 2));
  p.surge = L * 0.12 * step;
  p.H -= L * 0.05 * blow;
  p.squash = 0.04 * jolt;
  p.tail = [10 * wind - 6 * blow, 14 * wind - 10 * blow, 0];
  p.ears = wind;
  return p;
}
/** How far the Mendermask's body is turned and leant through its strike, `t` of the way: what the lantern hangs from. */
const STRIKE_TURN = (t: number, hit: number): number => -34 * ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.28, hit + 0.06)) + 42 * ramp(t, 0.28, hit + 0.06) * (1 - ramp(t, hit + 0.14, 0.97));
const STRIKE_LEAN = (t: number, hit: number): number => -10 * ramp(t, 0.04, 0.32) * (1 - ramp(t, 0.36, hit)) + 12 * ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.1, 0.96));
/**
 * The lantern on its chain through the strike: a damped pendulum hung from the body, its angle drawn after how the body has been
 * turned (`drive`, degrees, through the act), so it lags the turn, swings past and settles rather than snapping with it. Worked
 * from the start of the act in small steps of the act's own time.
 */
function lanternLag(t: number, drive: (u: number) => number): number {
  const secs = ACT_SECS.strike, w = 2 * Math.PI * 1.6, z = 0.35, steps = Math.max(1, Math.ceil(t * 120));
  let a = 0, v = 0;
  const dt = (t * secs) / steps;
  for (let q = 0; q < steps; q++) {
    const target = drive(((q + 1) / steps) * t);
    v += (-w * w * (a - target) - 2 * z * w * v) * dt;
    a += v * dt;
  }
  // Eased back to hanging straight by the end, so the act ends where it began.
  return a * (1 - ramp(t, 0.86, 1));
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.9, 1)));

/** The tool posed with the point `J` along it (from the paw) held at `at`, pointing along `dir`. */
const aimed = (at: V3, dir: V3, J: number): V3 => sub(at, scale(dir, J));

/**
 * A go at its task. The Stitchkit lets go of its spanner with one paw, takes a gear out of the pouch at its hip, holds it up in
 * front of it and puts the spanner's jaw on its nut, and pulls it round three times, the gear turning a notch each pull, then
 * holds it up to look and puts it away. The Patchcoon takes a dented helmet in its free paw, taps it three times with its mallet
 * and turns it up to look at it. The Mendermask bends over a helmet on the ground in front of it, turns its bolt twice with the
 * wrench and wipes it round twice with its cloth, and straightens up; the lantern swings out as it bends and back as it rises.
 */
function workPlan(s: Mend, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), T = toolRest(s), W = MEND_WORK, L = R.reach, k = s.torso.h[1];
  // Where the thing it mends hangs from its belt, in the chest's frame as it stands: the paw goes there for it and back.
  const hang = sub(HANG_AT(s), s.chest.at);
  if (s.stage === 0) {
    // The right paw off the spanner and down to the gear hung at its right hip, up with it, held out in front on its near side;
    // the left paw down the shaft, the spanner's jaw on the gear's nut, three pulls of it round.
    const held: V3 = [0.12, k + 0.18, 0.38], nut = add(held, [0, 0.07, 0.04]), onGrip = T.grip;
    p.hand[1] = path(t, [[0.02, onGrip], [W.hang - 0.01, hang], [W.hang + 0.03, hang], [0.24, held], [0.8, held], [W.back - 0.02, hang], [W.back + 0.02, hang], [0.98, onGrip]]);
    p.on = [1, 1 - ramp(t, 0.02, 0.07) + ramp(t, 0.94, 0.99)];
    p.held = ramp(t, W.hang - 0.01, W.hang + 0.02) * (1 - ramp(t, W.back - 0.02, W.back + 0.01));
    // Each pull: the handle drawn down and round, the gear going with it, and back for the next.
    let ang = 0, turned = 0;
    for (const c of W.pulls) {
      const into = clamp((t - (c - 0.1)) / 0.1), back = clamp((t - c) / 0.05);
      ang += (t > c - 0.1 && t < c + 0.05 ? smooth(into) * (1 - smooth(back)) : 0);
      turned += smooth(into);
    }
    const engaged = ramp(t, 0.2, 0.27) * (1 - ramp(t, 0.72, 0.78));
    // The shaft's way from the left paw to the jaw, swung down and round the nut at each pull.
    const paw: V3 = [-0.2, k + 0.1, 0.16], dir = rotAbout(unit(sub(nut, paw)), [0, 1, 0], 0.45 * ang), J = HEAD_AT(s);
    p.grip = mixV(T.grip, sub(nut, scale(dir, J)), engaged);
    p.dir = unit(mixV(T.dir, dir, engaged));
    p.up = unit(mixV(T.up, [0, 1, 0], engaged));
    p.spin = turned * 0.7;
    // Head down at it; up to look at the end.
    const look = hump(t, 0.8, 0.06);
    p.neck = [10 * engaged, 6 * engaged];
    p.head = [-16 * engaged + 8 * look, 8 * engaged, -10 * look];
    p.chest = [6 * engaged, -4 * engaged, 0];
    p.tail = [0, 10 * Math.sin(t * TAU), 0];
    p.ears = look;
  } else if (s.stage === 1) {
    // The dented helmet off its hip in the free paw, up in front of it, three taps of the mallet, turned up to look, and back.
    const helm: V3 = [-0.12, k + 0.36, 0.42];
    p.hand[0] = path(t, [[0.02, T.hand[0]], [W.hang - 0.01, hang], [W.hang + 0.03, hang], [0.22, helm], [0.74, helm], [W.back - 0.03, hang], [W.back + 0.02, hang], [0.99, T.hand[0]]]);
    p.held = ramp(t, W.hang - 0.01, W.hang + 0.02) * (1 - ramp(t, W.back - 0.02, W.back + 0.01));
    const top = add(helm, [0, 0.02, HELMET_R(s) * 0.95]);
    // Brought down over a tenth of the go onto each tap and lifted again over a twelfth.
    const lift = Math.min(1, ...W.taps.map((c) => (t < c - 0.1 || t > c + 0.08 ? 1 : t < c ? smooth((c - t) / 0.1) : smooth((t - c) / 0.08))));
    const at = ramp(t, 0.16, 0.24) * (1 - ramp(t, 0.62, 0.72));
    const hd: V3 = unit([-0.75, 0.35, -0.05 + 1.1 * lift]), J = HEAD_AT(s);
    p.grip = mixV(T.grip, aimed(add(top, [0.0, 0, 0.1]), hd, J), at);
    p.dir = unit(mixV(T.dir, hd, at));
    p.up = unit(mixV(T.up, [0, 0, -1], at));
    p.spin = 0.9 * hump(t, W.look, 0.08);
    p.neck = [8 * at, -6 * at];
    p.head = [-14 * at + 10 * hump(t, W.look, 0.08), -8 * at, 12 * hump(t, W.look, 0.08)];
    p.chest = [5 * at, 6 * at, 0];
    p.ears = hump(t, W.look, 0.08);
  } else {
    // The helmet off its hip, bent down and set on the ground in front; two turns of the wrench on its bolt and the cloth round
    // its crown twice; picked up again, straightened, and hung back on the belt.
    const bow = ramp(t, 0.1, 0.26) * (1 - ramp(t, W.rise, W.rise + 0.16));
    const K = WORK_BOW;
    p.chest = [K.bow * bow, 0, 0];
    p.pitch = -K.hips * bow;
    p.surge = -0.1 * L * bow;
    p.H -= K.crouch * L * bow;
    p.neck = [6 * bow, 0];
    p.head = [-24 * bow, 0, 0];
    const wr = ramp(t, W.set + 0.0, W.set + 0.06) * (1 - ramp(t, W.wipes[0] - 0.12, W.wipes[0] - 0.05));
    let ang = 0;
    for (const c of W.turns) ang += t > c - 0.08 && t < c + 0.05 ? smooth((t - (c - 0.08)) / 0.08) * (1 - smooth((t - c) / 0.05)) : 0;
    const dir = rotAbout(R.wrench, R.upC, 0.8 * ang), J = HEAD_AT(s);
    const bolt = add(R.siteC, scale(R.upC, 0.02)), away: V3 = add(T.grip, [0.15, -0.15, -0.1]);
    p.grip = mixV(mixV(T.grip, away, ramp(t, W.wipes[0] - 0.12, W.wipes[0])), aimed(bolt, dir, J), wr);
    p.dir = unit(mixV(T.dir, dir, wr));
    p.up = unit(mixV(T.up, R.upC, wr));
    // The left paw, the cloth in it: to the hip for the helmet, down with it to the ground, steadying it beside, round its crown
    // twice, on it to lift it, and back.
    const X = unit(cross(R.upC, [1, 0, 0])), Y = unit(cross(R.upC, X));
    const a = TAU * clamp((t - (W.wipes[0] - 0.07)) / (W.wipes[1] - W.wipes[0]));
    const onHelm = add(R.siteC, scale(R.upC, HELMET_R(s) * 0.5)), beside: V3 = [-0.25, s.torso.h[1] + 0.25, 0.55];
    const round = add(add(R.siteC, scale(R.upC, 0.2)), add(scale(X, 0.18 * Math.cos(a)), scale(Y, 0.2 * Math.sin(a))));
    const wiping = ramp(t, W.wipes[0] - 0.1, W.wipes[0] - 0.06) * (1 - ramp(t, W.wipes[1] + 0.04, W.lift - 0.01));
    p.hand[0] = path(t, [[0, T.hand[0]], [W.hang + 0.03, hang], [W.hang + 0.05, hang], [W.set - 0.01, onHelm], [W.set + 0.04, onHelm], [W.set + 0.1, beside], [W.wipes[0] - 0.1, beside],
      [W.lift - 0.03, onHelm], [W.lift + 0.02, onHelm], [W.rise + 0.18, hang], [W.rise + 0.2, hang], [1, T.hand[0]]]);
    if (wiping > 0) p.hand[0] = mixV(p.hand[0], round, wiping);
    p.head[1] = 8 * wiping * Math.sin(a);
    p.held = ramp(t, W.hang + 0.02, W.hang + 0.05) * (1 - ramp(t, W.rise + 0.17, W.rise + 0.2));
    p.ground = ramp(t, W.set - 0.02, W.set + 0.01) * (1 - ramp(t, W.lift - 0.01, W.lift + 0.02));
    // The lantern flung forward on its chain as it bows, and back as it straightens; swinging with the wipes.
    p.swing = [
      28 * hump(t, 0.2, 0.1) - 12 * hump(t, 0.31, 0.08) + 6 * hump(t, 0.39, 0.06) + (-26 * hump(t, W.rise + 0.12, 0.08) + 10 * hump(t, W.rise + 0.24, 0.06)) + 22 * bow,
      7 * wiping * Math.sin(a - 0.6),
    ];
    p.pack = [0, -4 * hump(t, 0.2, 0.1)];
    p.tail = [8 * bow, 6 * Math.sin(t * TAU), 0];
  }
  return mixPlan(restPlan(s, R), p, down);
}

/** Through a run of keys, each a moment and a point, eased from one to the next; held at the first before it and the last after. */
function path(t: number, keys: Array<[number, V3]>): V3 {
  if (t <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) if (t <= keys[q + 1][0]) return mixV(keys[q][1], keys[q + 1][1], smooth((t - keys[q][0]) / Math.max(1e-6, keys[q + 1][0] - keys[q][0])));
  return keys[keys.length - 1][1];
}

/** Where what it mends hangs from its belt, in the hips' frame: the Stitchkit's gear at its right hip, the helmet at the bigger two's left. */
const HANG_AT = (s: Mend): V3 => { const [rx, ry] = eggAt(s.hips.c, s.hips.r, s.belt), a = [0.3, 0.32, 0.32][s.stage] * Math.PI; return [(s.stage === 0 ? 1 : -1) * rx * Math.cos(a) * 1.02, s.hips.c[1] + ry * Math.sin(a) * 1.02, s.belt + [0.0, 0.04, 0.04][s.stage]]; };

/** How the Mendermask bows to the ground: the chest bent, the hips tipped (degrees), how far it crouches (a share of its leg's reach) -- grown once as far as brings its paws to the helmet. */
const WORK_BOW = { bow: 22, hips: 6, crouch: 0.42 };

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its tool held high, a shake, and settled. */
function evolvePlan(s: Mend, R: Rest, t: number): Plan {
  const p = restPlan(s, R), T = toolRest(s), L = R.reach;
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.66, 0.1) * Math.sin(t * (s.stage === 2 ? 44 : 62));
  p.H += L * (-0.08 * hunch + 0.04 * up);
  p.chest = [14 * hunch - 8 * up, 0, 0];
  p.neck = [8 * hunch - 6 * up, 0];
  p.head = [-12 * hunch + 16 * up, 0, 10 * shake];
  p.roll = 3 * shake;
  p.tail = [-8 * hunch + 18 * up, 12 * shake, 8 * up];
  p.squash = 0.05 * hump(t, 0.72, 0.05);
  const z = s.torso.z[4];
  p.grip = mixV(T.grip, [0.32, 0.12, z + 0.12], up);
  p.dir = unit(mixV(T.dir, [0.05, 0.15, 1], up));
  p.ears = up;
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Mend, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(strikePlan(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0.4, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ------------------------------------------------------------------------- */

/** Two bones bent to put the end of the second at `to` from `from`, the joint between them bowed toward `hint`: the knee or the elbow. */
function bend2(from: V3, to: V3, l0: number, l1: number, hint: V3, alt?: V3): { mid: V3; end: V3 } {
  let d = sub(to, from);
  const D = len3(d), most = (l0 + l1) * 0.995, least = Math.abs(l0 - l1) + 0.06 * (l0 + l1), Dc = clamp(D, least, most);
  d = scale(d, 1 / (D || 1));
  const end = add(from, scale(d, Dc));
  // Bowed toward the hint, square to the limb; where the limb comes near to lying along the hint, toward the other hint
  // instead, eased between the two so the joint never swaps sides in a frame.
  const sq = (h: V3): V3 => sub(h, scale(d, dot(h, d)));
  const a = sq(hint), k = alt ? smooth((0.85 - len3(a)) / 0.6) : 0;
  const v = unit(k > 0 && alt ? add(scale(unit(a), 1 - k), scale(unit(sq(alt)), k)) : a);
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  return { mid: add(add(from, scale(d, along)), scale(v, h)), end };
}

/**
 * A leg bent to put its ankle at `ankle`: the thigh from the hip to the knee and the shin down from it, the knee forward and a
 * little out, always the same way round. A point out of reach is reached for as far as the leg goes. The foot flat on the
 * ground facing the way the hips do, turned a little out, pitched as the pose says.
 */
function legOf(s: Mend, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.18, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.15 * fwd[1], fwd[1] - sd * 0.15 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The tail's bones from its root on the hips, each link on from the one before it, lifted, swung and curled. */
function tailBones(s: Mend, body: Xf, lift: number, yaw: number, curl: number): Xf[] {
  const T = s.tail, n = T.links.length, out: Xf[] = [];
  let prev = joint(body, T.at, -(T.lift + lift), 0, yaw * 0.5 + (T.side ?? 0));
  out.push(prev);
  for (let q = 1; q < n; q++) {
    prev = joint(prev, [0, -T.links[q - 1], 0], -(T.curl + curl + (q >= n - 3 ? T.tip : 0)), 0, (yaw * 0.6) / (n - 1) + (T.sweep ?? 0));
    out.push(prev);
  }
  return out;
}

/** Where the pack sits on the back, in the chest's frame: carried a little to the right, so it shows beside the body as well as over it. */
const PACK_AT = (s: Mend): V3 => { const r = torsoAt(s, s.torso.z[2]); return [[0, 0.16, 0.34][s.stage], r.y - r.h * 0.92, s.torso.z[2] * (s.stage === 2 ? 0.7 : 0.85)]; };
/** Where the lantern hangs from, in the pack's frame. */
const LANTERN_HOOK: V3 = [1.32, -0.7, 0.98];

/**
 * The bones of a stage: its pose, the hips raised and carried as it says, the chest on them, the neck and head, each leg bent to
 * put its foot where it is to be, the tail in links, each arm bent to put its paw on the tool or where it is to be, the tool,
 * the pack, the lantern, and what it works on.
 */
function mendBones(s: Mend): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = trunkOf(body, P.squash);
    const lean = s.chest.lean + P.chest[0];
    b.chest = joint(body, s.chest.at, -lean, P.chest[2], P.chest[1]);
    b.neck = joint(b.chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    // The head carried level whatever the hips and the chest do under it, then pitched as the pose says.
    b.head = joint(b.neck, [0, 0, s.neck.len], lean + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    tailBones(s, body, P.tail[0], P.tail[1], P.tail[2]).forEach((x, q) => { b[`tail${q}`] = x; });
    for (let i = 0; i < 2; i++) {
      const [u, l, f] = legOf(s, body, i, P.at[i], P.foot[i]);
      const key = i ? 'lr' : 'll';
      b[`${key}0`] = u;
      b[`${key}1`] = l;
      b[`${key}2`] = f;
    }
    // The tool in the chest's frame: along its handle to its head, its face square to that.
    const Z = unit(P.dir), Y = unit(sub(P.up, scale(Z, dot(P.up, Z)))), X = cross(Y, Z);
    const toolLocal = xfOf(X, Y, Z, P.grip);
    b.tool = compose(b.chest, toolLocal);
    const fwd = turn(b.chest, [0, 1, 0]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, off = GRIP_OFF(s)[i];
      const onTool = add(P.grip, scale(Z, off)), want = place(b.chest, mixV(P.hand[i], onTool, P.on[i]));
      const sh = place(b.chest, [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      const { mid: el, end: wr } = bend2(sh, want, s.arm[0], s.arm[1], turn(b.chest, unit([sd * 0.75, -0.3, -0.6])), turn(b.chest, unit([sd * 0.3, 0.2, -1])));
      const [X0, Y0, Z0] = frameOf(sub(sh, el), fwd), [X1, Y1, Z1] = frameOf(sub(el, wr), fwd);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      const free = xfOf(X1, Y1, Z1, wr), gripped = { m: b.tool.m, t: wr };
      b[`hand${i}`] = blendXf(free, gripped, P.on[i]);
    }
    // The apron swung forward from the belt as far as keeps the knee that comes furthest forward behind it.
    {
      const hinge = APRON_HINGE(s), front = s.hips.c[1] + s.hips.r[1] + 0.05;
      let swing = 0;
      for (const key of ['ll1', 'lr1']) {
        const kn = backPt(body, b[key].t), e = kn[1] + s.leg.w[1] * 1.3 - front;
        if (e > 0) swing = Math.max(swing, Math.atan2(e, Math.max(0.05, hinge[2] - kn[2])) / DEG);
      }
      b.apron = joint(body, hinge, swing);
    }
    const pa = PACK_AT(s);
    b.pack = joint(b.chest, [pa[0], pa[1], pa[2] + P.pack[0]], P.pack[1]);
    const yaw = P.yaw + P.chest[1];
    if (s.stage === 2) {
      b.lantern = joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: place(b.pack, LANTERN_HOOK) }, [0, 0, 0], P.swing[0], -P.swing[1], yaw);
      // The cloth hangs from the paw; brought down near the ground it is laid forward over what it wipes rather than hung through it.
      const at = place(b.hand0, [0, 0, -s.hand * 0.4]), lay = 85 * clamp((s.hand * 2.8 * 1.5 + 0.1 - at[2]) / 0.5);
      b.cloth = joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: at }, [0, 0, 0], P.swing[0] * 0.12 + lay, 0, yaw);
    }
    // What it mends: hung at its left hip on the belt -- the gear's face out to the side, the helmet's crown -- or in its paw where
    // the plan puts the paw, the gear turning on its nut and the helmet turned up to be looked at, or on the Mendermask's, down on
    // the ground in front of it; carried from one to the next as the paw takes it, so it is never anywhere it was not brought.
    const I: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const off: V3 = s.stage === 0 ? [0, 0.07, 0.05] : [0, 0.03, s.stage === 2 ? -HELMET_R(s) * 0.4 : 0];
    const hungAt = add(HANG_AT(s), off);
    const hungLocal = s.stage === 0 ? xfOf([0, -1, 0], [1, 0, 0], [0, 0, 1], hungAt) : joint(xfOf(...I, hungAt), [0, 0, 0], 0, -70, 0);
    const hung = compose(b.body, hungLocal);
    const pawAt = add(P.hand[s.stage === 0 ? 1 : 0], off);
    const paw0 = compose(b.chest, xfOf(...I, pawAt));
    const inPaw = s.stage === 0 ? joint(paw0, [0, 0, 0], 0, P.spin * 57.3, 0) : joint(paw0, [0, 0, 0], -20 * (s.stage === 1 ? 1 : 0) + 70 * P.spin, 30 * P.spin, 0);
    let held = blendXf(hung, inPaw, P.held);
    if (s.stage === 2) held = blendXf(held, xfOf(...I, R.site), P.ground);
    b.held = held;
    b.shadow = shadowOf(body, 0);
    return b;
  };
  let ready = false;
  const prepare = (): void => {
    ready = true;
    if (s.stage !== 2) return;
    // How far the Mendermask bows to set its helmet down: grown from its task's bow until its paws reach the helmet's crown on the
    // ground comfortably, the crown in front of its shoulders; the wrench's way to it from in front of its right shoulder.
    const top = HELMET_R(s) * 0.9, reach = (s.arm[0] + s.arm[1]) * 0.93, sh = s.shoulder, base = { ...WORK_BOW };
    const bowed = (g: number): { b: Bones; mid: V3 } => {
      Object.assign(WORK_BOW, { bow: base.bow * g, hips: base.hips * g, crouch: base.crouch * g });
      const b = pose({ ...restPlan(s, R), chest: [WORK_BOW.bow, 0, 0], pitch: -WORK_BOW.hips, surge: -0.1 * R.reach, H: s.high - WORK_BOW.crouch * R.reach });
      return { b, mid: mixV(place(b.chest, [-sh[0], sh[1], sh[2]]), place(b.chest, sh), 0.5) };
    };
    let g = 1;
    while (g < 1.8 && bowed(g).mid[2] - top > reach * 0.9) g += 0.05;
    const { b, mid } = bowed(g);
    const dz = mid[2] - top, d = Math.sqrt(Math.max(0.04, reach * reach - dz * dz));
    const crown: V3 = [mid[0], mid[1] + d, top];
    R.site = [crown[0], crown[1], 0.0];
    R.siteC = backPt(b.chest, crown);
    R.upC = unit(backDir(b.chest, [0, 0, 1]));
    R.wrench = unit(sub(R.siteC, add(sh, [0.05, 0.45, -0.2])));
  };
  return (a) => {
    if (!ready) prepare();
    const P = planOf(s, R, { ...a, go: a.act ? 0 : a.go });
    const b = pose(P);
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------- */

/** The middle of the skull in the head's frame. */
const skullAt = (s: Mend): V3 => [0, 0.04, s.head.up];

/** A patch painted onto the egg `(C, R)` round the way `dir`, `rx` by `ry`, turned `spin`: a mask, a brow, a cheek. */
function patchOn(C: V3, R: V3, dir: V3, rx: number, ry: number, mat: Mat, spin = 0, lift = 0.012, sides = 12): Disc {
  const e = onEgg(C, R, dir), d = disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, sides, mat, { spin, at: add(e.p, scale(e.n, -0.02)) });
  return { ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); }) };
}

/**
 * The head: a round skull, wide at the cheeks with a cream ruff out either side; a short cream muzzle with a dark nose; the dark
 * mask across the eyes, drooping to the cheeks and up the brow between them, cream brows over it; big amber eyes in the mask;
 * a small smile; and on the bigger two, goggles pushed up on the brow on a leather strap.
 */
function headOf(s: Mend, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), R = H.r, E = s.eye;
  // The lower face cream: the cheeks, the jaw and the throat, under a line from just below the eyes back under the ears.
  const eyeZ = onEgg(C, R, E.dir).p[2] - C[2];
  const skull = ((m: Mesh): Mesh => mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const z = c[2] - C[2], y = (c[1] - C[1]) / R[1];
    return z < eyeZ - E.size * 1.7 - R[2] * 0.4 * Math.max(0, -y) ? { ...f, m: 'mark' as Mat } : f;
  })))(orb(C, R, n + 4, k + 3, 'coat'));
  // The cheek ruffs: cream tufts out either side below the ears, pointed out and down.
  const ruff = [1, -1].flatMap((sd) => [
    egg(add(C, [sd * R[0] * 0.72, -R[1] * 0.12, -R[2] * 0.3]), frameOf(unit([sd * 1, -0.2, -0.45]), [0, 1, 0]), [R[0] * (s.stage === 2 ? 0.36 : 0.28), R[1] * 0.34, R[0] * (s.stage === 2 ? 0.52 : 0.42)], n, k, 'muzzle'),
  ]);
  // The snout: a short cone forward out of the lower face, cream, a dark nose on its tip.
  const sc: V3 = add(C, [0, R[1] * 0.8, -R[2] * 0.32]), sr: V3 = [R[0] * 0.3, R[2] * 0.27, R[1] * 0.5];
  const snoutF = frameOf(unit([0, 1, -0.12]), [0, 0, 1]);
  const snoutM = egg(sc, [snoutF[0], snoutF[1], snoutF[2]], sr, n, k, 'muzzle');
  const tip = add(sc, scale(snoutF[2], sr[2] * 0.92));
  const nose = egg(add(tip, [0, -sr[2] * 0.05, sr[1] * 0.3]), UPRIGHT, [R[0] * 0.085, R[0] * 0.065, R[0] * 0.06], 6, 4, 'nose');
  // The mask: a dark band round each eye, out and back toward the ear and drooping to the cheek; a dark stripe up the middle of
  // the brow; and a cream brow over each eye between the mask and the crown.
  const mask: Disc[] = [];
  for (const sd of [1, -1]) {
    mask.push(patchOn(C, R, [sd * (E.dir[0] + 0.14), E.dir[1], E.dir[2] - 0.04], E.size * 2.8, E.size * 1.75, 'lid', sd * 0.3, 0.008, 14));
    mask.push(patchOn(C, R, [sd * (E.dir[0] + 0.62), E.dir[1] - 0.42, E.dir[2] - 0.2], E.size * 2.2, E.size * 1.3, 'lid', sd * 0.5, 0.008, 12));
    mask.push(patchOn(C, R, [sd * (E.dir[0] + 0.06), E.dir[1] - 0.08, E.dir[2] + 0.5], E.size * (s.stage === 2 ? 2.6 : 2.3), E.size * (s.stage === 2 ? 0.95 : 0.72), 'muzzle', sd * -0.2, 0.011, 12));
  }
  mask.push(patchOn(C, R, [0, 0.8, 0.42], E.size * 0.42, E.size * 1.4, 'lid', 0, 0.009, 8));
  // A small smile under the nose.
  const smile = paint([1, -1].map((sd) => {
    const pts = [0, 0.33, 0.66, 1].map((u) => { const q = onEgg(sc, [sr[0], sr[2], sr[1]], [sd * u * 0.7, 0.75, -0.7 + 0.3 * u * u]); return add(q.p, scale(q.n, 0.008)); });
    const w = sr[0] * 0.07, n0 = unit([sd * 0.3, 0.7, -0.6]);
    return facingDisc([...pts.map((p) => add(p, [0, 0, w])), ...[...pts].reverse().map((p) => add(p, [0, 0, -w]))], n0, 'lid');
  }));
  const parts: Mesh[] = [skull, ...ruff, snoutM, nose, paint(mask), smile, eyesOf(s, shut)];
  if (s.stage > 0) parts.push(gogglesOf(s, n));
  return merge(...parts);
}

/** The goggles pushed up on the brow: a leather strap round the head over the ears, two brass cups on the brow with mint lenses. */
function gogglesOf(s: Mend, n: number): Mesh {
  const C = skullAt(s), R = s.head.r, out: Mesh[] = [];
  const strap: V3[] = Array.from({ length: 14 }, (_, q) => {
    const a = (q / 14) * TAU, e = onEgg(C, R, [Math.cos(a), Math.sin(a), 0.6 + 0.2 * Math.sin(a)]);
    return add(e.p, scale(e.n, 0.02));
  });
  out.push(loop(strap, 0.03, R[2] * 0.12, 4, 'leather'));
  for (const sd of [1, -1]) {
    // Pushed up on the brow above the eyes, tipped back: a thin brass rim round a pane of pale mint glass.
    const e = onEgg(C, R, [sd * 0.36, 0.78, 0.68]), up = unit(add(e.n, [0, 0.3, 0.2]));
    const r = R[0] * 0.2, h = R[0] * 0.15;
    out.push(tube([add(e.p, scale(up, -0.02)), add(e.p, scale(up, h))], [r * 0.95, r], [r * 0.95, r], n, 'fitting', { up: [0, 1, 0] }));
    out.push(paint([disc(add(e.p, scale(up, h + 0.01)), up, r * 0.86, r * 0.86, 12, 'fitting'), disc(add(e.p, scale(up, h + 0.014)), up, r * 0.56, r * 0.56, 10, 'gem'), disc(add(add(e.p, scale(up, h + 0.02)), scale(unit(cross(up, [1, 0, 0])), -r * 0.2)), up, r * 0.18, r * 0.12, 6, 'glint', { lit: true })]));
  }
  // The bridge between the cups.
  const a = onEgg(C, R, [0.14, 0.82, 0.7]), b = onEgg(C, R, [-0.14, 0.82, 0.7]);
  out.push(tube([add(a.p, scale(a.n, 0.03)), add(b.p, scale(b.n, 0.03))], 0.025, 0.025, 4, 'fitting'));
  return merge(...out);
}

/**
 * The eyes in the mask: each a dark rim, a big amber iris, a darker ring, a dark middle and two glints, laid onto the skull's own
 * curve; all of an eye out of sight together when the head is between it and the viewer.
 */
function eyesOf(s: Mend, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size, tall = E.tall;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.24, 8, 'muzzle', o), 0.016));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.18, r * 1.2 * tall, 12, 'lid', o), 0.014));
    out.push(onto(disc(p, n, r, r * tall, 12, 'crystal', o), 0.018));
    out.push(onto(disc(add(p, scale(up, -r * 0.06)), n, r * 0.68, r * 0.7 * tall, 10, 'crystalDark', o), 0.022));
    out.push(onto(disc(add(p, scale(up, -r * 0.04)), n, r * 0.46, r * 0.52 * tall, 8, 'eye', o), 0.026));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36 * tall)), scale(across, side * r * 0.3)), n, r * 0.32, r * 0.32, 6, 'glint', { ...o, lit: true }), 0.034));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.4 * tall)), scale(across, -side * r * 0.3)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }), 0.034));
  }
  return paint(out);
}

/** An ear: a round-tipped flap, grey-brown with a cream inside, up and out on the top of the head. */
function earOf(s: Mend, sd: number, n: number, k: number): Mesh {
  const C = skullAt(s), R = s.head.r, E = s.ear;
  const e = onEgg(C, R, [sd * 0.62, -0.1, 0.78]);
  const up = unit(add(e.n, [sd * -0.1, 0.05, 0.55])), face = unit(sub([0, 1, 0.1], scale(up, dot([0, 1, 0.1], up))));
  // A rounded triangle: broad at its root, narrowing to a soft point; the coat's grey-brown, a dark rim round its root where it
  // goes into the head, and a cream hollow facing forward.
  const base = add(e.p, scale(up, -E.len * 0.1));
  const pts = [0, 0.3, 0.62, 0.88, 1].map((u) => add(base, scale(up, E.len * u)));
  const ws = [E.w * 0.95, E.w * 0.98, E.w * 0.72, E.w * 0.36, E.w * 0.08];
  const outer = tube(pts, ws, ws.map((x) => x * 0.34), n, (ring) => (ring === 0 ? 'coatDark' : 'coat'), { up: face });
  const inner = tube(pts.slice(1, 4).map((p) => add(p, scale(face, E.w * 0.17))), [E.w * 0.6, E.w * 0.44, E.w * 0.14], [E.w * 0.14, E.w * 0.12, E.w * 0.05], n, 'mark', { up: face });
  return merge(outer, inner);
}

/** Solids inside the head that hide what is round the far side of them: the skull and the muzzle. */
function headSolids(s: Mend): Array<{ c: V3; r: V3 }> {
  return [{ c: skullAt(s), r: scale(s.head.r, 0.82) }];
}

/** A white flower: five round petals and a yellow middle, facing `n`; leaves under it. */
function flowerOf(c: V3, n: V3, r: number, leaves: number, seed: number): Mesh {
  const f = frameOf(n, Math.abs(n[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]), out: Mesh[] = [];
  for (let q = 0; q < leaves; q++) {
    const a = (q / Math.max(1, leaves)) * TAU + seed, d = add(scale(f[0], Math.cos(a)), scale(f[1], Math.sin(a)));
    out.push(egg(add(c, add(scale(d, r * 1.25), scale(f[2], -r * 0.25))), frameOf(add(scale(f[2], 0.5), d), f[2]), [r * 0.42, r * 0.12, r * 0.95], 5, 3, q % 2 ? 'leafDark' : 'leaf'));
  }
  for (let q = 0; q < 5; q++) {
    const a = (q / 5) * TAU + seed * 2, d = add(scale(f[0], Math.cos(a)), scale(f[1], Math.sin(a)));
    out.push(egg(add(c, scale(d, r * 0.5)), [unit(cross(f[2], d)), d, f[2]], [r * 0.42, r * 0.5, r * 0.16], 6, 3, 'petal'));
  }
  out.push(egg(add(c, scale(f[2], r * 0.1)), f, [r * 0.24, r * 0.24, r * 0.14], 5, 3, 'bloom'));
  return merge(...out);
}

/** A spanner: a flat steel bar with an open jaw at its head end, in its own frame from `-tail` to `len` along `z`, flat across `x`. */
function spannerOf(len: number, w: number, tail: number, mat: Mat, ring = true, handle: Mat = mat): Mesh {
  const out: Mesh[] = [];
  const t = w * 0.16;
  // A handle of its own, a brass grip, up to where the steel shank comes out of it; or the bar the whole way.
  const from = handle !== mat ? len * 0.42 : -tail;
  out.push(block([0, 0, (len - w * 0.5 + from) / 2 - w * 0.3 * 0], [w * 0.3, t, (len - w * 0.5 - from) / 2], UPRIGHT, mat));
  if (handle !== mat) out.push(tube([[0, 0, -tail + w * 0.1], [0, 0, len * 0.47]], [w * 0.3, w * 0.34], [w * 0.26, w * 0.28], 6, handle), tube([[0, 0, len * 0.44], [0, 0, len * 0.5]], w * 0.38, w * 0.32, 6, 'hornDark'));
  // The jaw: a C round the head end, open at the top, two prongs either side of the gap.
  const jc: V3 = [0, 0, len - w * 0.55], r = w * 0.6;
  const arc = Array.from({ length: 9 }, (_, q) => { const a = lerp(0.3, 2.7, q / 8) * Math.PI - Math.PI * 0.5 + Math.PI; return add(jc, [Math.cos(a) * r, 0, -Math.sin(a) * r]) as V3; });
  out.push(tube(arc, w * 0.24, t, 6, mat, { up: [0, 1, 0] }));
  // A ring at the other end.
  if (ring) for (let q = 0; q < 6; q++) {
    const a = (q / 6) * TAU, p: V3 = [Math.cos(a) * w * 0.4, 0, -tail + w * 0.2 + Math.sin(a) * w * 0.4];
    out.push(block(p, [w * 0.15, t * 1.05, w * 0.16], frameOf([0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]), mat));
  }
  return merge(...out);
}

/** The mallet: a wooden handle and a block of grey stone for a head, bound in brass; its striking faces along `y`. */
function malletOf(len: number, n: number): Mesh {
  const hr = len * 0.24;
  return merge(
    tube([[0, 0, -len * 0.22], [0, 0, len * 0.95]], len * 0.035, len * 0.035, 6, 'wood'),
    egg([0, 0, -len * 0.24], UPRIGHT, [len * 0.05, len * 0.05, len * 0.04], 6, 3, 'fitting'),
    block([0, 0, len], [hr * 0.78, hr * 1.25, hr * 0.78], UPRIGHT, 'stone'),
    block([0, 0, len], [hr * 0.84, hr * 0.3, hr * 0.84], UPRIGHT, 'fitting'),
    paint([disc([0, hr * 1.26, len], [0, 1, 0], hr * 0.5, hr * 0.5, 6, 'stoneDark'), disc([0, -hr * 1.26, len], [0, -1, 0], hr * 0.5, hr * 0.5, 6, 'stoneDark')]),
  );
}

/** The wrench: a big brass one, a thick shaft with a grip wound on it and an open jaw at its head, a knurled nut under the jaw. */
function wrenchOf(len: number, n: number): Mesh {
  const w = len * 0.3;
  // A monkey wrench: the brass bar thick, a grip of dark leather wound on it, the jaw big, and the knurled nut that sets it.
  return merge(
    spannerOf(len, w, len * 0.25, 'fitting', false),
    tube([[0, 0, -len * 0.24], [0, 0, len * 0.55]], w * 0.32, w * 0.26, 6, 'leatherDark'),
    tube([[0, 0, len * 0.58], [0, 0, len * 0.68]], w * 0.34, w * 0.3, 6, 'hornDark'),
  );
}

/** A brass gear: a toothed wheel with a nut in its middle, flat across `x` and `z`, its axle along `y`. */
function gearOf(r: number, n: number, mat: Mat = 'fitting'): Mesh {
  const out: Mesh[] = [tube([[0, -r * 0.14, 0], [0, r * 0.14, 0]], r * 0.8, r * 0.8, 10, mat, { up: [0, 0, 1] })];
  for (let q = 0; q < 8; q++) {
    const a = (q / 8) * TAU, d: V3 = [Math.cos(a), 0, Math.sin(a)];
    out.push(block(scale(d, r * 0.88), [r * 0.16, r * 0.13, r * 0.14], frameOf(d, [0, 1, 0]), mat));
  }
  out.push(tube([[0, r * 0.12, 0], [0, r * 0.28, 0]], r * 0.28, r * 0.28, 6, 'metal', { up: [0, 0, 1] }));
  out.push(paint([disc([0, r * 0.15, 0], [0, 1, 0], r * 0.55, r * 0.55, 10, 'hornDark')]));
  return merge(...out);
}

/** A helmet to mend: a steel dome with a brass rim and a dent in it, its crown up `z`. */
function helmetOf(r: number, n: number): Mesh {
  const dome = orb([0, 0, 0], [r, r * 1.05, r * 0.9], n + 2, 6, 'metal');
  const top = mesh(dome.v.map((p) => [p[0], p[1], Math.max(p[2], 0)] as V3), dome.f);
  return merge(
    top,
    loop(ring([0, 0, 0], r * 1.02, r * 1.07, r * 0.04, 12), r * 0.08, r * 0.14, 4, 'fitting'),
    tube([[0, 0, r * 0.84], [0, 0, r * 1.02]], r * 0.12, r * 0.12, 6, 'fitting'),
    paint([disc([r * 0.45, r * 0.3, r * 0.72], unit([0.5, 0.35, 0.8]), r * 0.22, r * 0.14, 7, 'metalDark')]),
  );
}

/** A cloth: a cream rag hanging from the paw, crumpled, a pink stripe across it. */
function clothOf(r: number): Mesh {
  const rows: V3[][] = [];
  for (let q = 0; q <= 3; q++) {
    const z = -r * 0.1 - q * r * 0.45, row: V3[] = [];
    for (let c = 0; c <= 3; c++) row.push([(c - 1.5) * r * (0.32 + 0.06 * q), ((c % 2) - 0.5) * r * 0.16 + q * r * 0.06, z + (c % 2 ? r * 0.06 : 0)]);
    rows.push(row);
  }
  return sheet(rows, (rr) => (rr === 1 ? 'lace' : 'lining'));
}

/** A pouch: a leather box with a flap and a brass stud, facing along `n`. */
function pouchOf(c: V3, n: V3, r: V3): Mesh {
  const f = frameOf([0, 0, 1], n);
  return merge(
    block(c, r, f, 'leather'),
    block(add(c, add(scale(f[1], r[1] * 0.55), scale(f[2], r[2] * 0.62))), [r[0] * 1.04, r[1] * 0.55, r[2] * 0.42], f, 'leatherDark'),
    block(add(c, add(scale(f[1], r[1] * 1.12), scale(f[2], r[2] * 0.3))), [r[0] * 0.18, r[1] * 0.12, r[2] * 0.14], f, 'fitting'),
  );
}

/** A bedroll: a roll of cream cloth with a pink stripe wound in it, lying across `x`, strapped. */
function bedrollOf(c: V3, r: number, half: number, n: number): Mesh {
  return merge(
    tube([add(c, [-half, 0, 0]), add(c, [half, 0, 0])], r, r, n + 2, 'lining', { up: [0, 0, 1] }),
    paint([1, -1].flatMap((sd) => [
      disc(add(c, [sd * (half + 0.006), 0, 0]), [sd, 0, 0], r * 0.68, r * 0.68, 10, 'lace'),
      disc(add(c, [sd * (half + 0.012), 0, 0]), [sd, 0, 0], r * 0.4, r * 0.4, 8, 'lining'),
    ])),
    ...[-0.5, 0.5].map((x) => loop(ring([0, 0, 0], 1, 1, 0, 8).map((p) => add(c, [x * half, p[0] * r * 1.06, p[1] * r * 1.06])), 0.02, r * 0.22, 4, 'leatherDark')),
  );
}

/** A banner of cloth hanging from its top edge: cream with mint diamonds and a pink edge, a point at its foot. */
function bannerOf(top: V3, across: V3, out: V3, w: number, h: number, seed: number): Mesh {
  const rows: V3[][] = [];
  for (let q = 0; q <= 3; q++) {
    const row: V3[] = [];
    for (let c = 0; c <= 2; c++) {
      const x = (c - 1) * w, drop = q * h / 3 + (q === 3 && c === 1 ? h * 0.18 : 0);
      row.push(add(add(top, scale(across, x * (q === 3 && c !== 1 ? 0.95 : 1))), add([0, 0, -drop], scale(out, Math.sin(q + seed) * w * 0.12))));
    }
    rows.push(row);
  }
  const m = sheet(rows, 'lining');
  const decals: Disc[] = [];
  for (let q = 0; q < 2; q++) {
    const c = add(add(top, [0, 0, -h * (0.32 + q * 0.34)]), add(scale(out, 0.012 + Math.sin(q + 1 + seed) * w * 0.12), [0, 0, 0]));
    decals.push(disc(c, out, w * 0.42, w * 0.42 * 1.25, 4, q ? 'lace' : 'gem', { spin: Math.PI / 4, up: [0, 0, 1] }));
  }
  return merge(m, paint(decals));
}

/** The diamonds of the cloth's pattern laid on a surface: mint diamonds with pink between, as the scarf and apron are woven. */
function diamonds(pts: ReadonlyArray<{ p: V3; n: V3 }>, r: number): Disc[] {
  return pts.flatMap((q, i) => [
    disc(add(q.p, scale(q.n, 0.012)), q.n, r, r * 1.3, 4, i % 2 ? 'lace' : 'gem', { spin: Math.PI / 4, up: [0, 0, 1] }),
    disc(add(q.p, scale(q.n, 0.02)), q.n, r * 0.4, r * 0.52, 4, i % 2 ? 'gem' : 'lace', { spin: Math.PI / 4, up: [0, 0, 1] }),
  ]);
}

/** The apron: a cream panel hung from the belt over the belly and down, patterned in diamonds, a pink hem; in the hips' frame. */
function apronOf(s: Mend): Mesh {
  const Hc = s.hips.c, Hr = s.hips.r, top = s.belt, bottom = s.belt - s.apron, cols = 5, rowsN = 5;
  const hw = Hr[0] * (s.stage === 2 ? 0.46 : 0.46);
  const front = (x: number, z: number): number => Hc[1] + Hr[1] * Math.sqrt(Math.max(0, 1 - (x / Hr[0]) ** 2 - ((z - Hc[2]) / Hr[2]) ** 2));
  const grid: V3[][] = [];
  for (let r = 0; r <= rowsN; r++) {
    const z = lerp(top, bottom, r / rowsN), row: V3[] = [];
    for (let c = 0; c <= cols; c++) {
      const u = c / cols - 0.5, x = u * 2 * hw * (1 + 0.08 * r / rowsN);
      let y = front(x, top) + 0.03;
      for (let q = 0; q <= r; q++) y = Math.max(y, front(x, lerp(top, bottom, q / rowsN)) + 0.03);
      row.push([x, y + 0.02 * (r / rowsN) - 0.06 * u * u, z]);
    }
    grid.push(row);
  }
  const m = sheet(grid, 'lining');
  // Diamonds down its middle and either side, mint and pink.
  const at: Array<{ p: V3; n: V3 }> = [];
  // Rows of diamonds the whole way down it, mint and pink by turns, each row half a diamond along from the last.
  const rowsD = [2, 3, 4][s.stage];
  for (let q = 0; q < rowsD; q++) {
    const r = Math.min(rowsN - 1, Math.round(((q + 0.6) / rowsD) * rowsN));
    for (const c of q % 2 ? [1.5, 3.5] : [0.75, 2.5, 4.25]) {
      const a = grid[r][Math.floor(c)], b = grid[r][Math.min(cols, Math.floor(c) + 1)], p = mixV(a, b, c % 1);
      at.push({ p: [p[0], p[1] + 0.01, p[2] - (top - bottom) / rowsN * 0.5], n: [0, 1, 0] });
    }
  }
  return merge(m, paint(diamonds(at, Math.min((top - bottom) / rowsD * 0.38, hw * 0.3))));
}

/** The scarf: a thick mint roll round the neck and a flap of it hanging down the chest, diamonds on it; in the chest's frame. */
function scarfOf(s: Mend, n: number): Mesh {
  const z = s.torso.z[3] - 0.02, r = torsoAt(s, z), th = [0.13, 0.16, 0.24][s.stage];
  const out: Mesh[] = [loop(ring([0, r.y, z], r.w * 0.96 + th * 0.4, r.h * 0.96 + th * 0.4, z, 12), th * 0.75, th * 1.05, 6, 'cloth')];
  // The knot at the front, a little to the left, and the flap down from it.
  const knot: V3 = [-r.w * 0.3, r.y + r.h + th * 0.5, z - th * 0.3];
  out.push(egg(knot, UPRIGHT, [th * 0.9, th * 0.7, th * 0.8], n, 4, 'cloth'));
  const fl = th * 2.4, rows: V3[][] = [];
  for (let q = 0; q <= 2; q++) {
    const zz = z - th * 0.4 - q * fl * 0.5, b = torsoAt(s, zz);
    const yy = b.y + b.h + th * 0.35;
    rows.push([[knot[0] - th * (0.9 - q * 0.45), yy, zz], [knot[0] + th * 0.2, yy + 0.01, zz - (q === 2 ? th * 0.6 : 0)], [knot[0] + th * (1.2 - q * 0.55), yy, zz]]);
  }
  out.push(sheet(rows, 'cloth', 'clothDark'));
  // Diamonds round the front of the roll.
  const pts: Array<{ p: V3; n: V3 }> = [];
  for (const a of [0.2, 0.5, 0.8].map((x) => x * Math.PI)) {
    const n0: V3 = unit([Math.cos(a), Math.sin(a), 0.4]);
    pts.push({ p: [Math.cos(a) * (r.w * 0.96 + th * 1.1), r.y + Math.sin(a) * (r.h * 0.96 + th * 1.1), z + th * 0.4], n: n0 });
  }
  return merge(...out, paint(diamonds(pts, th * 0.42)));
}

/** The torso: grey-brown, cream down its front; in the chest's frame. */
function torsoOf(s: Mend, n: number): Mesh {
  const T = s.torso;
  return tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n, (ring, j) => (ring > 0 && Math.abs(((j + 1) / n) * TAU - Math.PI * 0.5) < 0.45 ? 'mark' : 'coat'), { up: [0, 1, 0] });
}

/** The belt: a leather band round its middle, a brass buckle, pouches, and what hangs from it; in the hips' frame. */
function beltOf(s: Mend, n: number): Mesh {
  const Hc = s.hips.c, z = s.belt, [rx, ry] = eggAt(Hc, s.hips.r, z), bw = [0.05, 0.07, 0.1][s.stage];
  const out: Mesh[] = [loop(ring([Hc[0], Hc[1], 0], rx + bw * 0.35, ry + bw * 0.35, z, 14), bw * 0.4, bw, 4, 'leather')];
  out.push(block([0, Hc[1] + ry + bw * 0.5, z], [bw * 0.75, bw * 0.15, bw * 0.75], UPRIGHT, s.stage === 2 ? 'metalDark' : 'fitting'));
  out.push(block([0, Hc[1] + ry + bw * 0.62, z], [bw * 0.4, bw * 0.1, bw * 0.38], UPRIGHT, 'leatherDark'));
  const around = (a: number, out0 = 0): { p: V3; n: V3 } => {
    const p: V3 = [Math.cos(a) * (rx + out0), Hc[1] + Math.sin(a) * (ry + out0), z];
    return { p, n: unit([Math.cos(a) / rx, Math.sin(a) / ry, 0]) };
  };
  const P = [0.09, 0.11, 0.15][s.stage];
  // Pouches: two at the right hip and one at the left on the little one; more on the bigger, all round.
  const spots = s.stage === 0 ? [0.08, 0.22, 0.82, 1.0] : s.stage === 1 ? [0.82, 1.0, -0.3] : [0.02, 0.18, 0.84, 1.0, 1.16, -0.25, -0.75];
  spots.forEach((f, q) => {
    const e = around(f * Math.PI, P * 0.5);
    out.push(pouchOf(add(e.p, [0, 0, -P * 0.6]), e.n, [P * (0.7 + 0.2 * jitter(q)), P * 0.45, P * (0.8 + 0.2 * jitter(q + 3))]));
  });
  // Spanners hanging from it on the right, their jaws up; on the Patchcoon a brass gear beside them; on the Mendermask a ring of
  // brass keys at its left.
  const hang = (a: number, L: number, tilt: number, q: number): void => {
    const e = around(a, P * 1.0), f = frameOf(unit([Math.sin(tilt), 0, 1]), e.n);
    const m = spannerOf(L, L * 0.26, L * 0.1, 'metal', false);
    out.push(mesh(m.v.map((v) => add(add(e.p, [0, 0, -L * 0.85 + P * 0.2 * q]), add(add(scale(f[0], v[0]), scale(f[1], v[1])), scale(f[2], v[2])))), m.f));
  };
  const L0 = [0.26, 0.4, 0.56][s.stage];
  hang(0.24 * Math.PI, L0, 0.15, 0);
  if (s.stage === 1) {
    const e = around(0.08 * Math.PI, P * 1.2), g = gearOf(0.17, n);
    const f = frameOf([0, 0, 1], e.n);
    out.push(mesh(g.v.map((v) => add(add(e.p, [0, 0, -0.1]), add(add(scale(f[0], v[0]), scale(f[1], v[1])), scale(f[2], v[2])))), g.f));
  }
  return merge(...out);
}

/** The harness: two straps crossed over the chest from each shoulder to the other side, a brass ring where they cross; in the chest's frame. */
function harnessOf(s: Mend): Mesh {
  const z0 = s.torso.z[3] - 0.03, z1 = s.torso.z[0] + 0.12, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    const pts: V3[] = [];
    for (let q = 0; q <= 6; q++) {
      const u = q / 6, a = lerp(sd > 0 ? 0.18 : 0.82, sd > 0 ? 0.72 : 0.28, u) * Math.PI;
      pts.push(onTorso(s, lerp(z0, z1, u), a, 0.03));
    }
    // Over the shoulder and down the back, to the pack.
    const back = [onTorso(s, z0 + 0.02, (sd > 0 ? 0.0 : 1.0) * Math.PI - sd * 0.15, 0.03), onTorso(s, z0 - 0.05, sd > 0 ? -0.2 * Math.PI : 1.2 * Math.PI, 0.03)];
    out.push(tube([back[1], back[0], ...pts], 0.025, [0.05, 0.07, 0.09][s.stage], 4, 'leather', { up: [0, 0, 1] }));
  }
  const mid = onTorso(s, (z0 + z1) / 2, Math.PI / 2, 0.05);
  out.push(loop(ring([0, 0, 0], 1, 1, 0, 8).map((p) => add(mid, [p[0] * 0.05, 0, p[1] * 0.05])), 0.018, 0.018, 4, s.stage === 2 ? 'leatherDark' : 'fitting'));
  return merge(...out);
}

/** A tool stuck out of a pack: a spanner, or a wooden handle with an iron head, along `dir` from `at`. */
function stuckOut(at: V3, dir: V3, L: number, kind: 'spanner' | 'handle', seed: number): Mesh {
  const f = frameOf(dir, Math.abs(dir[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]);
  const m = kind === 'spanner' ? spannerOf(L, L * 0.26, L * 0.12, 'metal')
    : merge(tube([[0, 0, -L * 0.2], [0, 0, L]], L * 0.06, L * 0.06, 5, 'wood'), block([0, 0, L], [L * 0.2, L * 0.08, L * 0.08], frameOf([0, 0, 1], [Math.cos(seed), Math.sin(seed), 0]), 'metalDark'));
  return mesh(m.v.map((v) => add(at, add(add(scale(f[0], v[0]), scale(f[1], v[1])), scale(f[2], v[2])))), m.f);
}

/** A bunch of leaves tucked into a pack at `at`, splayed out along `out`. */
function leavesAt(at: V3, out: V3, size: number, count: number, seed: number): Mesh {
  const ms: Mesh[] = [];
  for (let q = 0; q < count; q++) {
    const a = seed + q * 2.1, d = unit(add(out, [Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.4 * Math.sin(a * 1.7)]));
    ms.push(egg(add(at, scale(d, size * 0.9)), frameOf(d, [0, 0, 1]), [size * 0.42, size * 0.14, size * 1.0], 5, 3, q % 2 ? 'leafDark' : 'leaf'));
  }
  return merge(...ms);
}

/** A soft box: a ball pushed out toward its corners, `r` half-sizes about `c`, so a stuffed leather pack is one rounded block. */
function softBox(c: V3, r: V3, n: number, k: number, mat: Mat, e = 0.38): Mesh {
  const b = orb([0, 0, 0], 1, n, k, mat), sq = (x: number): number => Math.sign(x) * Math.abs(x) ** e;
  return mesh(b.v.map((p) => [c[0] + r[0] * sq(p[0]), c[1] + r[1] * sq(p[1]), c[2] + r[2] * sq(p[2])] as V3), b.f);
}

/**
 * The pack, in the pack's frame (its middle on the back, `-y` out from it): a stuffed leather rucksack, one rounded block wider
 * than the shoulders, its flap over the top and straps down its back; a rolled bedroll lying across the top of it; pouches on
 * its face and sides; tools stuck out of it; flowers and leaves tucked in. On the Mendermask's, spanners fanned along its lower
 * edge, cloths and banners hung down its sides and the lantern's arm out of its right. What is cloth comes back on its own, to
 * be drawn without lines inside it.
 */
function packOf(s: Mend, n: number): [Mesh, Mesh] {
  const out: Mesh[] = [], cloths: Mesh[] = [];
  const big = s.stage === 2;
  const c: V3 = big ? [0, -0.78, 0.5] : [0, -0.36, 0.3], r: V3 = big ? [1.1, 0.5, 0.96] : [0.58, 0.28, 0.5];
  const back = c[1] - r[1], top = c[2] + r[2];
  out.push(softBox(c, r, n + 6, 9, 'leather'));
  // The flap over the top, a darker leather, its brass buckles down the back.
  out.push(softBox(add(c, [0, -0.02, r[2] * 0.78]), [r[0] * 1.02, r[1] * 1.06, r[2] * 0.26], n + 6, 6, 'leatherDark'));
  for (const sx of [-0.45, 0.45]) {
    out.push(block([c[0] + sx * r[0], back - 0.012, c[2] + r[2] * 0.05], [r[0] * 0.07, 0.012, r[2] * 0.82], UPRIGHT, 'leatherDark'));
    out.push(block([c[0] + sx * r[0], back - 0.03, c[2] + r[2] * 0.48], [r[0] * 0.09, 0.016, r[2] * 0.07], UPRIGHT, big ? 'leatherDark' : 'fitting'));
  }
  // Pouches on its face, low, and one on each side.
  const pw = r[0] * 0.3, ph = r[2] * 0.26;
  for (const sx of big ? [-0.5, 0.5] : [0]) out.push(pouchOf([c[0] + sx * r[0], back - pw * 0.25, c[2] - r[2] * 0.42], [0, -1, 0], [pw, pw * 0.4, ph]));
  for (const sd of [-1, 1]) out.push(pouchOf([c[0] + sd * (r[0] + pw * 0.25), c[1], c[2] - r[2] * 0.25], [sd, 0, 0], [r[1] * 0.55, pw * 0.4, ph]));
  // The bedroll across the top, longer than the pack is wide, strapped down.
  out.push(bedrollOf([c[0], c[1] + (big ? 0.02 : -0.04), top + (big ? 0.22 : 0.2)], big ? 0.27 : 0.22, r[0] * (big ? 1.08 : 1.22), n));
  // Leaves and a flower tucked under the bedroll at one end, and at a lower corner.
  const tuck = (p: V3, o: V3, k0: number, seed: number): void => { out.push(leavesAt(p, unit(o), k0, 5, seed), flowerOf(add(p, scale(unit(o), k0 * 0.6)), unit(o), k0 * 0.8, 0, seed)); };
  tuck([c[0] - r[0] * 0.85, c[1] - r[1] * 0.3, top + 0.04], [-1, -0.5, 0.7], big ? 0.2 : 0.12, 0.4);
  tuck([c[0] + r[0] * 0.9, back + 0.06, c[2] - r[2] * 0.6], [1, -0.7, -0.1], big ? 0.17 : 0.1, 2.2);
  if (!big) {
    out.push(stuckOut([c[0] + r[0] * 0.75, c[1] + 0.02, top - 0.05], unit([0.5, -0.15, 1]), 0.42, 'spanner', 1));
    return [merge(...out), merge(...cloths)];
  }
  tuck([c[0] + r[0] * 0.5, back + 0.02, top - 0.12], [0.3, -1, 0.6], 0.16, 3.6);
  // Tools: a long handle and a spanner stood up out of the top behind the bedroll, and a fan of spanners along the bottom edge.
  out.push(stuckOut([c[0] - r[0] * 0.55, c[1] + 0.15, top - 0.05], unit([-0.35, 0.1, 1]), 0.75, 'handle', 3));
  out.push(stuckOut([c[0] + r[0] * 0.35, c[1] + 0.2, top - 0.05], unit([0.3, 0.15, 1]), 0.58, 'spanner', 4));
  [-0.75, -0.25, 0.25, 0.75].forEach((x, q) => {
    out.push(stuckOut([c[0] + x * r[0], back + 0.04, c[2] - r[2] * 0.82], unit([x * 0.7, -0.25, -1]), 0.5, 'spanner', 6 + q));
  });
  // Cloths and banners hung down its sides and its back.
  cloths.push(bannerOf([c[0] + r[0] * 0.15, back - 0.04, top - 0.2], [1, 0, 0], [0, -1, 0], 0.13, 0.8, 0));
  cloths.push(bannerOf([c[0] - r[0] - 0.04, c[1] - 0.15, top - 0.15], [0, 1, 0], [-1, 0, 0], 0.12, 0.7, 2));
  // The lantern's arm: a brass bracket out of the right of the pack, on the side it is mostly seen from, to the hook.
  out.push(tube([[c[0] + r[0] - 0.05, c[1] + 0.05, c[2] + r[2] * 0.4], add(LANTERN_HOOK, [-0.08, 0, 0.06]), LANTERN_HOOK], 0.04, 0.04, 5, 'fitting'));
  return [merge(...out), merge(...cloths)];
}

/** The lantern: a brass lantern on a short chain, glowing amber in its panes; hanging down from the hook in its own frame. */
function lanternOf(n: number): Mesh {
  const out: Mesh[] = [];
  for (let q = 0; q < 3; q++) out.push(loop(ring([0, 0, 0], 1, 1, 0, 6).map((p) => [p[0] * 0.035 * (q % 2 ? 0.5 : 1), p[0] * 0.035 * (q % 2 ? 1 : 0.4), -0.05 - q * 0.08 + p[1] * 0.04] as V3), 0.012, 0.012, 3, 'fitting'));
  const top = -0.3, h = 0.42, r = 0.18;
  out.push(tube([[0, 0, top + 0.06], [0, 0, top - 0.04]], [0.03, r * 1.0], [0.03, r * 1.0], 6, 'fitting'));
  out.push(tube([[0, 0, top - 0.04], [0, 0, top - h]], r * 0.86, r * 0.86, 6, 'flame', { turn: 0 }));
  for (let q = 0; q < 6; q++) {
    const a = (q / 6) * TAU;
    out.push(tube([[Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, top - 0.04], [Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, top - h]], 0.016, 0.016, 3, 'fitting'));
  }
  out.push(tube([[0, 0, top - h], [0, 0, top - h - 0.06]], [r * 1.02, r * 0.5], [r * 1.02, r * 0.5], 6, 'fitting'));
  return merge(...out);
}

/** A mesh grown `k` times about its origin. */
const grownMesh = (m: Mesh, k: number): Mesh => mesh(m.v.map((v) => scale(v, k)), m.f);

/** A stage's pieces. */
function mendBuild(s: Mend, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), pieces: Piece[] = [];
  const hide = headSolids(s);
  pieces.push({ key: 'hips', mesh: merge(((m: Mesh): Mesh => mesh(m.v, m.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return c[1] > s.hips.c[1] + s.hips.r[1] * 0.6 && c[2] < s.hips.c[2] + s.hips.r[2] * 0.3 ? { ...f, m: 'mark' as Mat } : f;
  })))(orb(s.hips.c, s.hips.r, n + 2, k + 1, 'coat'))), bone: 'trunk', bias: 0 });
  pieces.push({ key: 'torso', mesh: torsoOf(s, n + 2), bone: 'chest', bias: 0.01, after: 'hips', breathes: { c: [0, 0, s.torso.z[2]], k: 0.04 } });
  pieces.push({ key: 'apron', mesh: ((m: Mesh): Mesh => mesh(m.v.map((v) => sub(v, APRON_HINGE(s))), m.f))(apronOf(s)), bone: 'apron', bias: 0.03, after: ['hips', 'torso', 'll0', 'lr0'], front: [0, 1, 0], lines: false });
  // What goes round the body hidden where the body is between it and the viewer: the back of the belt, the scarf, the straps.
  const hipsSolid = { c: s.hips.c, r: scale(s.hips.r, 0.97) };
  const zt = s.torso.z[3], tr = torsoAt(s, zt), zm = s.torso.z[1], tm = torsoAt(s, zm);
  const chestSolids = [{ c: [0, tr.y, zt] as V3, r: [tr.w * 0.97, tr.h * 0.97, (s.torso.z[4] - zt) * 1.4] as V3 }, { c: [0, tm.y, zm] as V3, r: [tm.w * 0.97, tm.h * 0.97, (zt - zm) * 1.1] as V3 }];
  pieces.push({ key: 'belt', mesh: beltOf(s, n), bone: 'body', bias: 0.04, after: ['hips', 'torso', 'apron'], hide: [hipsSolid] });
  if (s.stage > 0) pieces.push({ key: 'harness', mesh: harnessOf(s), bone: 'chest', bias: 0.02, after: ['torso'], hide: chestSolids });
  pieces.push({ key: 'scarf', mesh: scarfOf(s, n), bone: 'chest', bias: 0.05, after: ['torso', ...(s.stage > 0 ? ['harness'] : [])], under: 'head', hide: chestSolids });
  pieces.push({ key: 'neck', mesh: tube([[0, 0, -0.1], [0, 0, s.neck.len + 0.05]], s.neck.w, s.neck.w * 0.9, n, 'coat'), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  for (const sd of [-1, 1]) pieces.push({ key: `ear${sd > 0 ? 1 : 0}`, mesh: earOf(s, sd, n, k), bone: 'head', bias: 0.19, after: 'head', hide, lines: false });
  // The flower: at the Stitchkit's hip, by the Patchcoon's ear in a spray of leaves.
  if (s.stage === 0) {
    const [rx, ry] = eggAt(s.hips.c, s.hips.r, s.belt);
    pieces.push({ key: 'flower', mesh: flowerOf([-rx * 0.82, ry * 0.55, s.belt + 0.04], unit([-0.6, 0.6, 0.6]), 0.08, 3, 0.4), bone: 'body', bias: 0.06, after: ['belt'] });
  } else if (s.stage === 1) {
    const C = skullAt(s), e = onEgg(C, s.head.r, [-0.86, 0.15, 0.42]);
    pieces.push({ key: 'flower', mesh: flowerOf(add(e.p, scale(e.n, 0.06)), unit(add(e.n, [0, 0.4, 0.3])), 0.09, 5, 0.9), bone: 'head', bias: 0.21, after: ['head', 'ear0'] });
  }
  // The tail, in links, ringed cream and dark brown.
  const T = s.tail;
  T.links.forEach((L, q) => {
    // Each ring soft and fluffed out in its middle, so the tail is a bushy run of puffs that narrows to its tip rather than a pipe;
    // the root the coat's own grey-brown, then cream and dark brown rings by turns, the tip dark.
    const w0 = T.w[q], w1 = T.w[q + 1], wm = Math.max(w0, w1) * 1.1, last = q === T.links.length - 1;
    // The Mendermask's four cream rings and four broader dark ones, the dark at its tip; the smaller two's dark and cream by turns.
    const mat: Mat = q === 0 ? 'coat' : s.stage === 2 ? (q % 2 ? 'feather' : 'featherDark') : q % 2 || last ? 'featherDark' : 'feather';
    // On the Mendermask a soft swell along each ring that follows the tail's own taper, not a drum of even bands.
    const ws = s.stage === 2 ? [w0, lerp(w0, w1, 0.3) * 1.05, lerp(w0, w1, 0.7) * 1.05, w1] : [w0 * 0.98, wm, wm, w1 * 0.98];
    const m = tube([[0, 0.05, 0], [0, -L * 0.3, 0], [0, -L * 0.7, 0], [0, -L - 0.03, 0]], ws, ws.map((x) => x * 0.94), n, mat, { start: q === 0, end: last });
    pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.1 + q * 0.005, chain: 'tail' });
  });
  // Legs: a round furred haunch and thigh, a dark shin, a dark foot with its toes.
  const L = s.leg;
  for (const [i, key] of [[0, 'll'], [1, 'lr']] as Array<[number, string]>) {
    const sd = i ? 1 : -1, front: V3 = [sd * 0.8, 0.5, 0];
    const thigh = merge(egg([0, 0.02, -L.len[0] * 0.15], UPRIGHT, [L.w[0] * 1.25, L.w[0] * 1.2, L.len[0] * 0.55], n, k, 'coat'), tube([[0, 0, 0], [0, 0, -L.len[0]]], [L.w[0] * 1.05, L.w[1] * 1.0], [L.w[0] * 1.05, L.w[1] * 1.0], n, 'coat', { seam: 'start' }));
    // The shin furred like the thigh, darkening to the dark brown of the foot at the ankle.
    const shin = tube([[0, 0, L.w[1] * 0.5], [0, 0.005, -L.len[1] * 0.55], [0, 0.01, -L.len[1]]], [L.w[1], L.w[1] * 0.95, L.w[1] * 0.9], [L.w[1], L.w[1] * 0.95, L.w[1] * 0.9], n, 'coatDark', { seam: 'start' });
    const fw = L.foot[1], fl = L.foot[0], drop = L.len[2];
    const foot = merge(
      egg([0, fl * 0.22, -drop + fw * 0.42], UPRIGHT, [fw * 0.95, fl * 0.55, fw * 0.6], n, k, 'pad'),
      ...[-1, 0, 1].map((q) => egg([q * fw * 0.48, fl * 0.68, -drop + fw * 0.26], UPRIGHT, [fw * 0.3, fw * 0.36, fw * 0.3], 6, 3, 'pad')),
    );
    pieces.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, after: ['hips'], front },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['hips', `${key}0`], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.02, after: ['hips', `${key}1`], front },
    );
  }
  // Arms: the upper arm furred (sleeved on the bigger two), the forearm dark, the paw a dark fist.
  const sleeve: Mat = s.stage === 2 ? 'lining' : 'coat';
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, front: V3 = [sd, 0.4, 0];
    const upper = merge(
      egg([0, 0, -0.02], UPRIGHT, [s.armW[0] * 1.3, s.armW[0] * 1.3, s.armW[0] * 1.35], n, k, s.stage === 2 ? 'coatDark' : 'coat'),
      // The upper arm furred; the Mendermask's patterned sleeve only its lower half, rolled up above the elbow.
      tube([[0, 0, 0], [0, 0, -s.arm[0] * 0.48], [0, 0, -s.arm[0]]], [s.armW[0] * 1.1, s.armW[0] * 1.12, s.armW[1] * 1.15], [s.armW[0] * 1.1, s.armW[0] * 1.12, s.armW[1] * 1.15], n, (ring) => (ring ? sleeve : s.stage === 2 ? 'coatDark' : 'coat'), { seam: 'start' }),
      ...(s.stage ? [tube([[0, 0, -s.arm[0] * 0.78], [0, 0, -s.arm[0] - 0.02]], s.armW[1] * 1.45, s.armW[1] * 1.45, n, 'mark')] : []),
      // The Mendermask's sleeves woven in the apron's diamonds, a ring of them round the upper arm.
      ...(s.stage === 2 ? [paint(diamonds(Array.from({ length: 10 }, (_, q) => {
        const a = (q % 5) / 5 * TAU, z = -s.arm[0] * (q < 5 ? 0.6 : 0.78), r = lerp(s.armW[0] * 1.1, s.armW[1] * 1.15, -z / s.arm[0]) + 0.005;
        return { p: [Math.cos(a) * r, Math.sin(a) * r, z] as V3, n: [Math.cos(a), Math.sin(a), 0] as V3 };
      }), s.armW[0] * 0.3))] : []),
    );
    // The forearm round and soft, fattest below the elbow and narrowing to the wrist, a ball at the elbow, open into the paw.
    const fore = merge(
      egg([0, 0, 0], UPRIGHT, [s.armW[1] * 1.05, s.armW[1] * 1.05, s.armW[1] * 1.05], n, k, 'coatDark'),
      tube([[0, 0, 0], [0, 0, -s.arm[1] * 0.35], [0, 0, -s.arm[1] + s.hand * 0.6]], [s.armW[1] * 1.04, s.armW[1] * 1.08, s.armW[1] * 0.78], [s.armW[1] * 1.04, s.armW[1] * 1.08, s.armW[1] * 0.78], n, 'coatDark', { seam: 'both' }),
    );
    const fist = merge(egg([0, 0, 0], UPRIGHT, [s.hand * 1.05, s.hand * 1.1, s.hand * 1.1], n, k, 'pad'), egg([sd * -s.hand * 0.5, s.hand * 0.55, 0], UPRIGHT, [s.hand * 0.5, s.hand * 0.5, s.hand * 0.75], 6, 3, 'pad'));
    pieces.push(
      { key: `arm${i}`, mesh: upper, bone: `arm${i}`, bias: 0.06, after: ['torso', 'scarf'], front },
      { key: `fore${i}`, mesh: fore, bone: `elbow${i}`, bias: 0.065, after: ['torso', `arm${i}`, 'belt', 'apron'], front },
      { key: `hand${i}`, mesh: fist, bone: `hand${i}`, bias: 0.07, after: ['torso', `fore${i}`, 'belt', 'apron'], front },
    );
  }
  // The tool.
  const tool = s.stage === 0 ? spannerOf(s.tool / 0.86, s.tool * 0.3, s.tool * 0.32, 'metal', false, 'wood') : s.stage === 1 ? malletOf(s.tool, n) : wrenchOf(s.tool / 0.9, n);
  pieces.push({ key: 'tool', mesh: tool, bone: 'tool', bias: 0.068 });
  // The pack and what is on it.
  if (s.stage > 0) {
    const [pack, cloths] = packOf(s, n);
    pieces.push({ key: 'pack', mesh: pack, bone: 'pack', bias: -0.02 }, { key: 'banners', mesh: cloths, bone: 'pack', bias: -0.015, after: 'pack', lines: false });
  }
  if (s.stage === 2) {
    pieces.push({ key: 'lantern', mesh: grownMesh(lanternOf(n), 1.45), bone: 'lantern', bias: 0.0 });
    pieces.push({ key: 'cloth', mesh: clothOf(s.hand * 2.8), bone: 'cloth', bias: 0.075, after: ['hand0'], lines: false });
  }
  // What it mends: the Stitchkit's gear, the helmet the bigger two mend.
  pieces.push({ key: 'held', mesh: s.stage === 0 ? gearOf(0.17, n) : helmetOf(HELMET_R(s), n), bone: 'held', bias: 0.066 });
  return pieces;
}

/** Where the apron hangs from, at the front of the belt, in the hips' frame. */
const APRON_HINGE = (s: Mend): V3 => [0, s.hips.c[1] + eggAt(s.hips.c, s.hips.r, s.belt)[1], s.belt];

/** How big the helmet it mends is. */
const HELMET_R = (s: Mend): number => [0.12, 0.24, 0.3][s.stage];

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const SPARK: RGB = [255, 214, 120];
const DUST: RGB = [214, 204, 186];

/** Sparks off steel: short bright streaks flying out from `from`, `since` seconds after, falling. */
function sparks(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, life = 0.32): void {
  if (since < 0 || since > life) return;
  g.save();
  g.lineCap = 'round';
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.6 + 0.7 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp, Math.sin(a) * sp, speed * (0.4 + 0.8 * jitter(k + 2))];
    const at = (tt: number): V3 => [from[0] + v[0] * tt, from[1] + v[1] * tt, from[2] + v[2] * tt - 4.5 * tt * tt];
    const p = at(since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x0, y0] = onScreen(view, at(Math.max(0, since - 0.03))), [x1, y1] = onScreen(view, p);
    const al = 1 - smooth(since / life);
    g.strokeStyle = css(SPARK, al);
    g.lineWidth = 0.05 + 0.03 * jitter(k + 3);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  g.restore();
}

/** A puff of dust, growing and thinning over its life. */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number): void {
  if (age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at), al = 0.45 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.8 * age);
  const grad = g.createRadialGradient(x, y - rr * 0.2 * age, 0, x, y - rr * 0.2 * age, rr);
  grad.addColorStop(0, css(DUST, al));
  grad.addColorStop(1, css(DUST, 0));
  g.fillStyle = grad;
  g.fillRect(x - rr, y - rr * 1.2, rr * 2, rr * 2);
}

/** Where the business end of its tool is now. */
const toolHead = (s: Mend, b: Bones): V3 => place(b.tool, [0, 0, HEAD_AT(s)]);

/** What a strike throws: sparks off the spanner and the wrench where they land, dust and grit off the mallet's stone. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Mend, b: Bones, at: Bones, t: number, front: boolean): void {
  const since = (t - MEND_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t, p = toolHead(s, at), big = 1 + 0.5 * s.stage;
  if (since <= 0) return;
  sparks(g, view, mid, p, since, front, 8 + 2 * s.stage, 30 + s.stage * 11, 3 * big, 0.3);
  if (s.stage === 1 && nearSide(p, mid, view) === front) puff(g, view, p, 0.35, since / 0.35);
}

/** What a go at its task throws: a spark or two at each pull of the spanner and each turn of the wrench; a little dust at each tap of the mallet. */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Mend, b: Bones, a: Anim, t: number, front: boolean): void {
  const W = MEND_WORK, loop0 = a.graze >= 0.5, mid = b.chest.t;
  const since = (t0: number): number => (t < t0 && !loop0 ? -1 : frac(t - t0) * ACT_SECS.work);
  const hits = s.stage === 0 ? W.pulls : s.stage === 1 ? W.taps : W.turns;
  hits.forEach((h, q) => {
    const dt = since(h);
    if (dt < 0 || dt > 0.35) return;
    const p = toolHead(s, b);
    sparks(g, view, mid, p, dt, front, s.stage === 1 ? 3 : 4, 100 + q * 13 + s.stage * 7, 1.6 + 0.5 * s.stage, 0.25);
    if (s.stage === 1 && nearSide(p, mid, view) === front) puff(g, view, p, 0.2, dt / 0.3);
  });
}

/** Evolving: little gears, bolts and white petals swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Mend, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const R0 = s.hips.r[0] * 1.6 + 0.2, high = s.torso.z[4] + s.high + s.head.up * 2;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.38), ang = (q / 18) * TAU + u * TAU * 1.5, k = (1 - u) ** 1.1;
    const p: V3 = [Math.cos(ang) * R0 * k, Math.sin(ang) * R0 * k, 0.2 + u * high * 0.8];
    if (nearSide(p, b.chest.t, view) !== front) continue;
    const [x, y] = onScreen(view, p), r = (0.13 + 0.06 * s.stage) * (1 - 0.4 * u), al = swirl * ramp(u, 0, 0.12);
    g.save();
    g.translate(x, y);
    g.rotate(ang * 3);
    if (q % 3 === 2) {
      g.fillStyle = css([252, 250, 244], al);
      for (let c = 0; c < 5; c++) { g.beginPath(); g.arc(Math.cos(c * 1.26) * r * 0.6, Math.sin(c * 1.26) * r * 0.6, r * 0.45, 0, TAU); g.fill(); }
      g.fillStyle = css([246, 200, 80], al);
      g.beginPath(); g.arc(0, 0, r * 0.35, 0, TAU); g.fill();
    } else {
      g.fillStyle = css(q % 3 ? [214, 166, 72] : [176, 180, 188], al);
      g.strokeStyle = css([70, 50, 36], al);
      g.lineWidth = r * 0.25;
      g.beginPath();
      for (let c = 0; c < 16; c++) { const rr = c % 2 ? r : r * 0.75, aa = (c / 16) * TAU; c ? g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr) : g.moveTo(rr, 0); }
      g.closePath(); g.fill(); g.stroke();
    }
    g.restore();
  }
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** How much colour a variant's colour has in it. */
const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function mendKind(s: Mend): Kind {
  const bones = mendBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: MEND_HITS[s.stage] } });
  return {
    bones,
    build: (lod) => mendBuild(s, lod),
    // The variant's coat tints its fur and its markings the cream; the mask, the dark of its limbs and tail rings, its amber eyes,
    // its mint scarf, its patterned cream cloth, its leather and its brass are the same on every variant.
    palette: (coat, mark) => {
      const fur = mix([150, 118, 100], pastel(coat, 30), 0.25 * clamp(sat(coat) / 0.3));
      const cream = mix([250, 232, 210], pastel(mark, 40), 0.2 * clamp(sat(mark) / 0.3));
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: [66, 42, 34],
        coatLight: mix(fur, [255, 248, 236], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 253, 248], 0.75),
        inner: [244, 214, 204],
        lid: [40, 27, 24],
        nose: [48, 34, 32],
        eye: [34, 22, 20],
        glint: [255, 253, 246],
        crystal: [168, 104, 58],
        crystalDark: [110, 62, 38],
        pad: [54, 36, 30],
        cloth: [168, 220, 210],
        clothDark: [128, 186, 180],
        lining: [246, 238, 220],
        lace: [238, 168, 182],
        gem: [150, 212, 206],
        feather: [238, 216, 196],
        featherDark: [68, 44, 36],
        leather: [150, 96, 58],
        leatherDark: [112, 70, 44],
        leatherLit: [176, 118, 72],
        fitting: [222, 172, 72],
        hornDark: [176, 126, 48],
        metal: [184, 188, 196],
        metalDark: [120, 124, 134],
        stone: [204, 198, 186],
        stoneDark: [160, 154, 144],
        wood: [176, 126, 80],
        petal: [252, 250, 244],
        bloom: [246, 200, 80],
        leaf: [124, 168, 84],
        leafDark: [88, 132, 72],
        flame: [255, 220, 130],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [s.hips.r[1] * 1.6 + s.tail.links.reduce((x, y) => x + y, 0) * 0.2, s.hips.r[0] * 1.3],
    stride: 1.4,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are brass and mint.
    motes: [[230, 184, 92], [176, 226, 216]],
    glow: s.stage === 2 ? (b) => [{ p: place(b.lantern, [0, 0, -0.68]), r: 1.0, c: [255, 196, 96], a: 0.55 }] : undefined,
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act?.kind === 'work') workBurst(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const STITCHKIT = mendKind(STITCHKIT_LOOK);
export const PATCHCOON = mendKind(PATCHCOON_LOOK);
export const MENDERMASK = mendKind(MENDERMASK_LOOK);
