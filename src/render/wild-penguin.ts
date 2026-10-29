import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, paint,
  pastel, scale, shadowOf, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The penguin line: the Finlet, a small round penguin chick, navy over cream
 * with a rosy cheek, a fish held in its orange beak, a little woven basket of
 * fish on its back on a rope round its neck and a capelet of green leaves on
 * its shoulders; which grows into the Reeffin, bigger, under a conical woven
 * hat with a blue feather in it, a rope harness crossed over its chest, a
 * leafy cape and a bigger basket, a wooden fishing pole in its flipper with a
 * fish hanging off the line; and then the Tideharvest, large and stout, the
 * same hat and feather, a rope strap across its chest through a round blue
 * medallion, a fish hanging from its belt, a long leafy cape, a basket on its
 * back, and a huge long-handled round net full of fish over its shoulder. The
 * species is still `wadd` underneath, as saves and the database know it: it
 * fishes, and swims a rider over deep water.
 *
 * Each is its variant's coat on its back, head and flippers and its markings
 * on its face and belly: a round head with big glossy eyes, a wide orange
 * beak, short orange legs and webbed feet. All three are built by one set of
 * functions from a description of the stage (`Peng`), the way the hamster
 * line is (`./wild-hamster`): its legs bent to put each foot where it is to
 * be, its flippers bent to put their tips where they are to be, and what it
 * fishes with posed in the chest's frame (`Plan.grip`, `dir`, `up`), so the
 * flipper that holds it goes with it. It waddles, rolled well over onto each
 * foot, its flippers held out from its sides. What hangs -- a fish on a line,
 * a fish at its belt -- hangs plumb and swings; a fish held wriggles.
 *
 * At its task the Finlet tosses the fish in its beak back over its head into
 * its basket, lunges down and snatches another out of the water; the Reeffin
 * swings its pole back, casts, waits for the bite and hauls the fish in; the
 * Tideharvest swings its net down off its shoulder, sweeps it through the
 * water, lifts it streaming and swings it back up (`PENG_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Peng {
  stage: 0 | 1 | 2;
  /** How high the hips are carried standing. */
  high: number;
  /** The hip on the right in the body's frame; thigh, shin and the ankle's height over the sole; how thick the shin; the foot's length and width; how far out each foot stands and how far ahead of the hip. */
  leg: { at: V3; len: [number, number, number]; w: number; foot: [number, number]; stance: number; ahead: number };
  /** The body's rings in the chest's frame, bottom to top: how high, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** How far round from straight ahead the cream of its belly comes, at its foot and at its top (radians either side). */
  bib: [number, number];
  /** The right flipper's shoulder in the chest's frame, its two lengths, and how wide it is. */
  shoulder: V3;
  arm: [number, number];
  flip: number;
  /** How many rows of layered feathers lie down the outside of each flipper, dark with pale edges. */
  feathers: number;
  neck: { at: V3; len: number; w: number };
  /** The skull's half-sizes, how far its middle is over the top of the neck, and how far nose-up it is carried. */
  head: { r: V3; up: number; pitch: number };
  eye: { dir: V3; size: number };
  /**
   * The cream of its face, on the skull scaled to a ball: how far up the front it comes, how far back round the sides, how far
   * the coat comes down in a point between the eyes, and how far down it comes at the sides of the head. Whether a pale patch
   * rings each eye, where the eyes are in the coat.
   */
  face: { top: number; front: number; peak: number; side: number; patch: boolean };
  /** The beak: how long, how wide and how deep at its root, and how far down the face it is set (a share of the skull's depth). */
  beak: { len: number; w: number; h: number; z: number };
  /** The two round bumps on its crown, how big; nought for none. */
  bumps: number;
  /** The woven hat: its brim's radius and how tall; and the feather in it, how long. */
  hat: { r: number; h: number } | null;
  feather: number;
  /** The cape of leaves: how far down its body it hangs, how many leaves round, how many rows, how wide a leaf, and how much of the front it leaves open (radians either side). */
  cape: { len: number; count: number; rows: number; w: number; open: number };
  /** The basket: its foot's middle in the chest's frame, its radius at the foot and at the rim, how tall, tipped back how far (degrees), and how many fish in it. */
  basket: { at: V3; r: [number, number]; h: number; tip: number; fish: number };
  /** What it carries its catch in: in its beak, on a line from a pole, in a net. */
  carry: 'beak' | 'pole' | 'net';
  /** A fish's length; the pole's length behind the grip and ahead of it, or the net's handle; the line's length; the net's hoop. */
  fish: number;
  tool: [number, number];
  line: number;
  hoop: number;
  /** The ropes on it: a rope round its neck; a harness crossed over its chest; a strap through a medallion and a belt. */
  ropes: 0 | 1 | 2;
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the hips sink at each footfall; how far it rolls and sways over each foot. */
    step: number; bob: number; roll: number; sway: number;
  };
  size: number;
}

/** A Finlet: small and round, a big head, a fish in its beak, a little basket of fish on its back and a capelet of leaves. */
const FINLET_LOOK: Peng = {
  stage: 0,
  high: 0.12,
  leg: { at: [0.17, 0.04, -0.04], len: [0.045, 0.045, 0.025], w: 0.045, foot: [0.18, 0.15], stance: 0.18, ahead: 0.1 },
  torso: { z: [-0.095, -0.07, -0.01, 0.08, 0.18, 0.27, 0.34, 0.38], y: [0.02, 0.03, 0.04, 0.04, 0.03, 0.01, -0.01, -0.02], w: [0.12, 0.34, 0.48, 0.51, 0.48, 0.41, 0.31, 0.2], h: [0.1, 0.3, 0.42, 0.45, 0.42, 0.35, 0.27, 0.18] },
  bib: [1.25, 0.9],
  shoulder: [0.36, -0.02, 0.2],
  arm: [0.12, 0.12],
  flip: 0.1,
  feathers: 0,
  neck: { at: [0, 0, 0.3], len: 0.03, w: 0.27 },
  head: { r: [0.47, 0.42, 0.31], up: 0.11, pitch: 4 },
  eye: { dir: [0.34, 0.88, 0.02], size: 0.085 },
  face: { top: 0.5, front: 0.05, peak: 0.14, side: 1.4, patch: false },
  beak: { len: 0.18, w: 0.12, h: 0.058, z: -0.24 },
  bumps: 0.12,
  hat: null,
  feather: 0,
  cape: { len: 0.17, count: 12, rows: 1, w: 0.12, open: 0.65 },
  basket: { at: [0, -0.31, 0.05], r: [0.19, 0.28], h: 0.34, tip: 10, fish: 5 },
  carry: 'beak',
  fish: 0.5,
  tool: [0, 0],
  line: 0,
  hoop: 0,
  ropes: 0,
  gait: { duty: [0.6, 0.42], swing: [0.55, 0.55], step: 0.6, bob: 0.07, roll: 11, sway: 0.09 },
  size: 5.4,
};

/** A Reeffin: bigger, a woven hat with a blue feather, a harness of rope, a leafy cape, a basket, and a fishing pole with a fish on its line. */
const REEFFIN_LOOK: Peng = {
  stage: 1,
  high: 0.16,
  leg: { at: [0.27, 0.05, -0.05], len: [0.06, 0.06, 0.035], w: 0.07, foot: [0.32, 0.26], stance: 0.27, ahead: 0.18 },
  torso: { z: [-0.13, -0.09, 0.0, 0.2, 0.4, 0.56, 0.68, 0.75], y: [0.03, 0.05, 0.06, 0.06, 0.04, 0.02, -0.01, -0.03], w: [0.18, 0.52, 0.71, 0.75, 0.69, 0.57, 0.43, 0.28], h: [0.15, 0.46, 0.63, 0.67, 0.61, 0.5, 0.38, 0.25] },
  bib: [1.2, 0.85],
  shoulder: [0.55, -0.03, 0.5],
  arm: [0.3, 0.3],
  flip: 0.2,
  feathers: 1,
  neck: { at: [0, 0, 0.66], len: 0.05, w: 0.36 },
  head: { r: [0.46, 0.43, 0.33], up: 0.12, pitch: 4 },
  eye: { dir: [0.36, 0.86, 0.12], size: 0.075 },
  face: { top: 0.32, front: 0.05, peak: 0.2, side: 1.4, patch: false },
  beak: { len: 0.24, w: 0.13, h: 0.068, z: -0.2 },
  bumps: 0,
  hat: { r: 0.64, h: 0.32 },
  feather: 0.55,
  cape: { len: 0.4, count: 15, rows: 2, w: 0.19, open: 0.85 },
  basket: { at: [0, -0.56, 0.22], r: [0.3, 0.44], h: 0.6, tip: 8, fish: 6 },
  carry: 'pole',
  fish: 0.55,
  tool: [0.4, 2.3],
  line: 0.7,
  hoop: 0,
  ropes: 1,
  gait: { duty: [0.6, 0.42], swing: [0.5, 0.5], step: 0.55, bob: 0.07, roll: 9, sway: 0.08 },
  size: 4.6,
};

/** A Tideharvest: large and stout, the hat and feather, a strap through a medallion, a long cape, a basket, a fish at its belt and a huge net of fish. */
const TIDEHARVEST_LOOK: Peng = {
  stage: 2,
  high: 0.22,
  leg: { at: [0.46, 0.07, -0.07], len: [0.08, 0.08, 0.045], w: 0.11, foot: [0.48, 0.38], stance: 0.48, ahead: 0.26 },
  torso: { z: [-0.18, -0.12, 0.0, 0.22, 0.5, 0.8, 1.02, 1.12], y: [0.04, 0.07, 0.09, 0.09, 0.07, 0.02, -0.01, -0.04], w: [0.32, 0.94, 1.28, 1.32, 1.16, 0.88, 0.62, 0.4], h: [0.26, 0.8, 1.06, 1.1, 0.98, 0.77, 0.54, 0.35] },
  bib: [0.98, 0.62],
  shoulder: [0.84, -0.06, 0.76],
  arm: [0.44, 0.44],
  flip: 0.37,
  feathers: 3,
  neck: { at: [0, 0, 1.0], len: 0.06, w: 0.48 },
  head: { r: [0.56, 0.52, 0.4], up: 0.14, pitch: 2 },
  eye: { dir: [0.38, 0.85, 0.14], size: 0.07 },
  face: { top: -0.12, front: -0.1, peak: 0, side: 0.9, patch: true },
  beak: { len: 0.3, w: 0.15, h: 0.085, z: -0.12 },
  bumps: 0,
  hat: { r: 0.92, h: 0.4 },
  feather: 0.42,
  cape: { len: 0.4, count: 22, rows: 3, w: 0.27, open: 0.95 },
  basket: { at: [0, -1.0, 0.36], r: [0.42, 0.58], h: 0.74, tip: 8, fish: 7 },
  carry: 'net',
  fish: 0.6,
  tool: [0.7, 1.6],
  line: 0,
  hoop: 1.1,
  ropes: 2,
  gait: { duty: [0.62, 0.44], swing: [0.45, 0.45], step: 0.5, bob: 0.08, roll: 8, sway: 0.08 },
  size: 5.0,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A knock ringing out: nothing before, then a swing of `f` a second dying away. */
const ringOut = (since: number, f = 1.6, damp = 2.6): number => (since < 0 ? 0 : Math.exp(-since * damp) * Math.sin(since * TAU * f));
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
/** `b` (in the frame of `a`) followed on from `a`. */
function compose(a: Xf, b: Xf): Xf {
  const cols = [0, 1, 2].map((j) => turn(a, [b.m[j], b.m[3 + j], b.m[6 + j]]));
  return xfOf(cols[0], cols[1], cols[2], place(a, b.t));
}
/** A frame whose `y` runs along `axis` and whose `z` is as near `toward` as that allows: a fish along the way it hangs, its back to `toward`. */
function along(axis: V3, toward: V3, t: V3): Xf {
  const Y = unit(axis);
  let Z = sub(toward, scale(Y, dot(toward, Y)));
  if (len3(Z) < 1e-4) Z = sub([1, 0, 0], scale(Y, Y[0]));
  Z = unit(Z);
  return xfOf(cross(Y, Z), Y, Z, t);
}
/** A frame made `k` times bigger, nought for a thing not there. */
const scaled = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k), m = x.m; return { m: [m[0] * q, m[1] * q, m[2] * q, m[3] * q, m[4] * q, m[5] * q, m[6] * q, m[7] * q, m[8] * q], t: x.t }; };
/** An egg with its axes along a frame: anything round that leans or points. */
function egg(c: V3, f: [V3, V3, V3], r: V3, n: number, k: number, mat: Mat): Mesh {
  const b = orb([0, 0, 0], r, n, k, mat);
  return mesh(b.v.map((p) => add(c, add(add(scale(f[0], p[0]), scale(f[1], p[1])), scale(f[2], p[2])))), b.f);
}
const UPRIGHT: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Each face's material chosen from where its middle is: a coat in patches. */
function painted(m: Mesh, f: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((face) => {
    const c = scale(face.i.reduce((t, i) => add(t, m.v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    return { ...face, m: f(c) };
  }));
}
/** A flat shape's corners, wound to face along `n`. */
function faced(pts: V3[], n: V3, m: Mat): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m };
}
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/** The torso's ring at height `z` in the chest's frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Peng, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/** A point on the body's skin at height `z` in the chest's frame, `a` radians round from its right side (a quarter turn is its front), lifted `out` off it. */
function onBody(s: Peng, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z), d = unit([Math.cos(a) * r.h, Math.sin(a) * r.w, 0]);
  return add([Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z], scale(d, out));
}
/**
 * The same, for something hung from `top` that drapes down over the body: never in under the widest it has passed on the way
 * down, so a cape falls straight from the belly rather than tucking in under it.
 */
function onDrape(s: Peng, z: number, top: number, a: number, out = 0): V3 {
  let w = 0, h = 0, y = 0;
  for (let q = 0; q <= 8; q++) {
    const r = torsoAt(s, lerp(top, z, q / 8));
    if (r.w >= w) { w = r.w; h = r.h; y = r.y; }
  }
  const d = unit([Math.cos(a) * h, Math.sin(a) * w, 0]);
  return add([Math.cos(a) * w, y + Math.sin(a) * h, z], scale(d, out));
}
/**
 * The solid of the body in the chest's frame, a little inside it, for what lies on it to be hidden behind: a stack of eggs
 * following its rings, so a pear of a body is a pear here too.
 */
function bodySolid(s: Peng): Array<{ c: V3; r: V3 }> {
  const T = s.torso, z0 = T.z[0], z1 = T.z[T.z.length - 1], H = z1 - z0;
  return [0.16, 0.38, 0.6, 0.8].map((f) => {
    const z = z0 + H * f, r = torsoAt(s, z);
    return { c: [0, r.y, z] as V3, r: [r.w * 0.9, r.h * 0.88, H * 0.24] as V3 };
  });
}

/** Whether a point on the body (the chest's frame) is the cream of its belly: round its front, wider low down, and under it. */
function creamBody(s: Peng, c: V3): boolean {
  const T = s.torso, r = torsoAt(s, c[2]), z0 = T.z[0], z1 = T.z[T.z.length - 1];
  const zf = clamp((c[2] - z0) / (z1 - z0));
  if (zf < 0.05) return true;
  const a = Math.atan2((c[1] - r.y) / Math.max(1e-3, r.h), c[0] / Math.max(1e-3, r.w));
  return Math.abs(a - Math.PI / 2) < lerp(s.bib[0], s.bib[1], smooth(zf));
}

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Finlet's fish slapped round, the Reeffin's pole brought down, the Tideharvest's net slammed. */
export const PENG_HITS: readonly number[] = [0.5, 0.52, 0.56];
/**
 * A go at its task, as shares of it, by stage. The Finlet's: the fish it has tossed from its beak (`toss`, flying back into its
 * basket until `stow`), the snatch at the water (`dip`), and its head shaken with the new one (`shake`). The Reeffin's: the
 * cast (`cast`, the line landing at `land`), the bite (`bite`), and the haul (`haul`, the fish out of the water). The
 * Tideharvest's: the net into the water (`into`), swept through it until `sweep`, lifted out streaming (`lift`).
 */
export const PENG_WORK = {
  toss: 0.12, stow: 0.3, dip: 0.47, shake: 0.62,
  cast: 0.33, land: 0.45, bite: 0.6, haul: 0.7,
  into: 0.26, sweep: 0.56, lift: 0.66,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** A pose: where each ankle is and how its foot is pitched, how the body, the chest and the head are carried, its flippers, and what it fishes with. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  /** The chest bent forward, turned left and leant left, past how it is carried. */
  chest: V3;
  /** The neck bent forward and turned left; the head nose-up, turned left and tilted, against level; the beak open. */
  neck: number[]; head: V3; jaw: number;
  /** Where each flipper's tip is, left then right, in the chest's frame, and how much it is on what it fishes with: the left at its grip, the right wherever on it is nearest. */
  flip: V3[]; on: number[];
  /** What it fishes with, in the chest's frame: where along it is at its grip, the way along it toward its business end, and the way its up is. */
  grip: V3; dir: V3; up: V3;
  /** How far up what it fishes with the left flipper has slid its grip, toward the business end. */
  slide: number;
  /** The fish in its beak, how much of it is there; the one tossed back into its basket, how far along its way (nought or one: none). */
  bite: number; toss: number;
  /** The line: how far out toward the water its end is; how much of the fish on it is there; how far what hangs swings, forward and to its left (degrees). */
  out: number; caught: number; swing: number[];
  /** How hard a fish held wriggles, nought to one, and where in its wriggle. */
  wriggle: number[];
  /** The basket bounced on its back: pitched and rolled (degrees); the feather swept back (degrees). */
  basket: number[]; plume: number;
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
}
const rests = new Map<Peng, Rest>();
function restOf(s: Peng): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3);
  const R: Rest = { ankle, reach: L.len[0] + L.len[1] };
  rests.set(s, R);
  return R;
}

/** Each flipper's tip hanging at rest, left then right, in the chest's frame: down its side, a little out from the belly and back. */
function flipRest(s: Peng): V3[] {
  const S = s.shoulder, L = s.arm[0] + s.arm[1], w = Math.max(...s.torso.w);
  return [-1, 1].map((sd) => [sd * (w + s.flip * 0.05), S[1] - L * 0.2, S[2] - L * 0.92] as V3);
}

/** A point the left flipper reaches: from its shoulder along `d`, `k` of the flipper's length, in the chest's frame. */
function byLeft(s: Peng, d: V3, k = 0.88): V3 {
  const S = s.shoulder;
  return add([-S[0], S[1], S[2]], scale(unit(d), (s.arm[0] + s.arm[1]) * k));
}

/** What it fishes with as it is carried standing: the pole up and ahead from beside its left shoulder, the net back over that shoulder. */
function toolRest(s: Peng): { grip: V3; dir: V3; up: V3 } {
  if (s.carry === 'pole') return { grip: byLeft(s, [-0.25, 0.9, -0.3]), dir: unit([-0.12, 0.42, 0.9]), up: [0, 0, 1] };
  if (s.carry === 'net') return { grip: byLeft(s, [-0.35, 0.7, 0.45], 0.85), dir: unit([-0.2, -0.88, 0.42]), up: [-0.7, 0, 1] };
  return { grip: [0, 0, 0], dir: [0, 1, 0], up: [0, 0, 1] };
}

/** How it stands with nothing going on: on both feet, its flippers down its sides, what it fishes with carried, the fish held. */
function restPlan(s: Peng, R: Rest): Plan {
  const T = toolRest(s);
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    chest: [0, 0, 0], neck: [0, 0], head: [0, 0, 0], jaw: 0,
    flip: flipRest(s), on: [s.carry === 'beak' ? 0 : 1, 0],
    grip: [...T.grip], dir: [...T.dir], up: [...T.up], slide: 0,
    bite: s.carry === 'beak' ? 1 : 0, toss: 0,
    out: 0, caught: s.carry === 'pole' ? 1 : 0, swing: [0, 0],
    wriggle: [0, 0], basket: [0, 0], plume: 0,
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
 * Going: a waddle on its short legs. Each foot down for its share of a stride and swept back under it at the ground's own
 * speed, then lifted and brought forward round the belly; the whole body rolled well over onto the foot that is down and
 * swayed after it, turned a little with each step, sinking onto each foot as it lands; the flippers held out from its sides
 * for balance and rocking against the roll; the head held steadier than the body; what hangs swinging with the steps.
 */
function goingPlan(s: Peng, R: Rest, a: Anim): Plan {
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
    p.at[i] = [A[0] * (1 + 0.3 * Math.sin(Math.PI * u)), y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)];
    p.foot[i] = -14 * Math.sin(Math.PI * clamp(u * 1.6)) * (1 - u) + 10 * hump(u, 0.85, 0.15);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.08));
  p.H += -G.bob * L * 2.4 * (down - 0.5) * (1 - 0.4 * g) + g * L * (0.14 * Math.max(0, Math.sin(2 * TAU * (w - duty * 0.5 + 0.25))) - 0.05);
  // Over the foot that is down: the left (0) from nought to half a stride, the right after. A waddle is mostly this.
  const over = Math.sin(TAU * (w - 0.2));
  p.roll = G.roll * over * (1 + 0.2 * g);
  p.side = -G.sway * L * 2 * over * (1 - 0.5 * g);
  p.yaw = 8 * Math.cos(TAU * w) * (1 - 0.3 * g);
  p.chest = [3 + 12 * g + 2 * (down - 0.5), -p.yaw * 0.7, -p.roll * 0.3];
  p.pitch = -2 - 6 * g;
  p.head = [3 * (down - 0.5) + 2 + 4 * g, -p.yaw * 0.3 - p.chest[1] * 0.5, -p.roll * 0.65];
  // The flippers held out from its sides, further at a run, rocking against the roll; a flipper on what it carries stays on it.
  const out = (0.32 + 0.3 * g) * s.arm[1];
  p.flip = p.flip.map((f, i) => {
    const sd = i ? 1 : -1, rock = sd * over * 0.12 * s.arm[1];
    return add(f, [sd * out + rock, -0.1 * s.arm[1] * g, out * 0.9 + 0.15 * s.arm[1] * Math.max(0, sd * over)]);
  });
  // What it carries swung a little with the stride.
  p.grip = add(p.grip, [0, 0.05 * L * Math.sin(TAU * w), 0.04 * L * (down - 0.5)]);
  p.swing = [-14 * Math.sin(TAU * (w - 0.1)) - 6 * g, 10 * over];
  p.wriggle = [0.25, frac(a.u * 2)];
  p.basket = [4 * (down - 0.5), -p.roll * 0.3];
  p.plume = 6 + 10 * g + 4 * (down - 0.5);
  return p;
}

/**
 * Standing about: breathing, the weight shifting from foot to foot, looking about; now and then its head tilted to one side
 * with a look, a flap of its flippers, and a wriggle of the fish it holds; what hangs swaying.
 */
function stillPlan(s: Peng, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  const w = Math.tanh(2.5 * cyc(t, 3));
  p.chest = [1.5 * (a.breath - 0.5), 5 * look * 0.3, 1.5 * w];
  p.roll = -2 * w;
  p.side = 0.03 * s.leg.len[0] * w;
  p.neck = [0, 6 * look];
  // A tilt of its head, to one side and the other, with a look.
  const tilt = beat(t, [3.4, 15.2], 1.4) - beat(t, [9.6, 20.8], 1.2);
  p.head = [3 * cyc(t, 4) + 4 * Math.abs(tilt), 10 * look + 8 * tilt, 4 * drift(t, 3) + 14 * tilt];
  p.H += 0.012 * R.reach * (a.breath - 0.5);
  // A flap of its flippers, out from its sides and back, three times quick.
  const flap = beat(t, [6.2, 18.0], 0.9);
  if (flap > 0) {
    const f = flap * (0.5 + 0.5 * Math.sin(t * TAU * 3.5));
    p.flip = p.flip.map((q, i) => add(q, [(i ? 1 : -1) * f * 0.5 * s.arm[1], 0, f * 0.7 * s.arm[1]]));
    p.H += 0.03 * R.reach * f;
  }
  // The fish it holds wriggles now and then, hard, and a little the rest of the time.
  const fits = beat(t, [1.6, 7.9, 12.4, 19.6], 0.8);
  p.wriggle = [0.15 + 0.85 * fits, frac(t * 3)];
  p.swing = [5 * cyc(t, 3) + 9 * fits * Math.sin(t * TAU * 1.5), 4 * cyc(t, 2, 1)];
  p.basket = [0, 0];
  p.plume = 4 * cyc(t, 4) + 3 * cyc(t, 9, 1);
  return p;
}

/* ---- its strike ---------------------------------------------------------------------- */

/** Through a run of keys, each a moment and a point, eased from one to the next; held at the first before it and the last after. */
function path(t: number, keys: Array<[number, V3]>): V3 {
  if (t <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) if (t <= keys[q + 1][0]) return mixV(keys[q][1], keys[q + 1][1], smooth((t - keys[q][0]) / Math.max(1e-6, keys[q + 1][0] - keys[q][0])));
  return keys[keys.length - 1][1];
}

/** What it fishes with through a move: where its grip is, the way along it and its up, at each key, eased between. */
interface ToolKey { t: number; grip: V3; dir: V3; up?: V3 }
function toolPath(p: Plan, keys: ToolKey[], t: number): void {
  p.grip = path(t, keys.map((k) => [k.t, k.grip] as [number, V3]));
  p.dir = unit(path(t, keys.map((k) => [k.t, k.dir] as [number, V3])));
  p.up = path(t, keys.map((k) => [k.t, k.up ?? p.up] as [number, V3]));
}

/**
 * A strike. The Finlet crouches with its head turned away, hops in and whips its head round, slapping with the fish in its beak.
 * The Reeffin swings its pole back over its head and brings it down hard ahead of it. The Tideharvest heaves its net up over its
 * head in both flippers and slams the hoop down in front of it, its whole weight behind it.
 */
function strikePlan(s: Peng, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = PENG_HITS[s.stage], L = R.reach, T = toolRest(s);
  const wind = ramp(t, 0.04, 0.34) * (1 - ramp(t, 0.36, hit));
  const blow = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.14, 0.96));
  const jolt = hump(t, hit + 0.02, 0.07);
  const since = (t - hit) * ACT_SECS.strike;
  if (s.stage === 0) {
    const hop = hump(t, (0.36 + hit) / 2, (hit - 0.36) / 2 + 0.02);
    p.H += L * (-0.4 * wind + 1.3 * hop - 0.25 * jolt);
    p.surge = L * 1.2 * blow;
    p.chest = [-8 * wind + 22 * blow, 30 * wind - 24 * blow, 0];
    p.head = [8 * wind - 10 * blow, 44 * wind - 60 * blow + 16 * jolt, -10 * wind + 14 * blow];
    p.jaw = 0;
    p.squash = 0.08 * jolt - 0.05 * hop;
    p.flip = p.flip.map((f, i) => add(f, [(i ? 1 : -1) * 0.6 * s.arm[1] * (wind + hop), -0.4 * s.arm[1] * hop, 0.9 * s.arm[1] * (wind + hop)]));
    p.wriggle = [0.3 + 0.7 * ramp(t, hit - 0.05, hit + 0.05), frac(t * 4)];
    // The fish flung out to its left as its head whips round, and swinging back after.
    p.swing = [10 * blow, 70 * blow * (1 - ramp(t, hit + 0.04, hit + 0.2)) - 30 * wind + 25 * ringOut(since - 0.1, 2, 3)];
    for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 1.2 * blow * ramp(t, hit, hit + 0.1), 0]);
  } else if (s.stage === 1) {
    toolPath(p, [
      { t: 0.02, grip: T.grip, dir: T.dir },
      { t: 0.32, grip: byLeft(s, [-0.1, 0.15, 1], 0.84), dir: unit([-0.1, -0.5, 0.86]) },
      { t: 0.38, grip: byLeft(s, [-0.1, 0.1, 1], 0.86), dir: unit([-0.1, -0.58, 0.8]) },
      { t: hit, grip: byLeft(s, [0.05, 1, -0.1]), dir: unit([-0.04, 0.9, -0.42]) },
      { t: hit + 0.14, grip: byLeft(s, [0.05, 1, -0.15]), dir: unit([-0.04, 0.88, -0.46]) },
      { t: 0.94, grip: T.grip, dir: T.dir },
    ], t);
    p.chest = [-10 * wind + 20 * blow, -12 * wind + 8 * blow, 0];
    p.head = [10 * wind - 12 * blow, -8 * wind, 0];
    p.H += L * (0.08 * wind - 0.18 * blow);
    p.surge = L * 0.4 * blow;
    p.squash = 0.06 * jolt;
    p.swing = [30 * wind - 50 * blow + 40 * ringOut(since), 20 * ringOut(since + 0.1)];
    p.flip[1] = add(p.flip[1], [0.5 * s.arm[1] * (wind + blow), -0.3 * s.arm[1] * blow, 0.8 * s.arm[1] * (wind + blow)]);
    p.at[0] = add(p.at[0], [0, L * 0.45 * blow, 0]);
  } else {
    toolPath(p, [
      { t: 0.02, grip: T.grip, dir: T.dir, up: T.up },
      { t: 0.32, grip: byLeft(s, [0.25, 0.2, 1], 0.85), dir: unit([0.05, -0.3, 1]), up: [0, 1, 0.2] },
      { t: 0.38, grip: byLeft(s, [0.25, 0.15, 1], 0.86), dir: unit([0.05, -0.42, 0.92]), up: [0, 1, 0.3] },
      { t: hit, grip: byLeft(s, [0.35, 1, 0.05]), dir: unit([0.06, 0.8, -0.6]), up: [0, 0.6, 0.8] },
      { t: hit + 0.16, grip: byLeft(s, [0.35, 1, 0]), dir: unit([0.06, 0.78, -0.63]), up: [0, 0.6, 0.8] },
      { t: 0.94, grip: T.grip, dir: T.dir, up: T.up },
    ], t);
    p.on = [1, Math.min(1, 2 * (wind + blow))];
    p.chest = [-12 * wind + 26 * blow, 0, 0];
    p.head = [12 * wind - 16 * blow, 0, 0];
    p.H += L * (0.12 * wind - 0.3 * blow - 0.2 * jolt);
    p.surge = L * 0.25 * blow;
    p.squash = 0.1 * jolt;
    p.swing = [16 * ringOut(since), 10 * ringOut(since + 0.15)];
    p.at[0] = add(p.at[0], [0, L * 0.35 * blow, 0]);
  }
  p.basket = [10 * ringOut(since, 2.2, 4), 6 * ringOut(since + 0.05, 2, 4)];
  p.plume = -12 * wind + 18 * blow + 20 * ringOut(since, 2, 3);
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));

/** Where the water it fishes is, ahead of it on the ground, by stage: what the beak snatches at, the line lands in, the net sweeps. */
const waterAt = (s: Peng): V3 => [[0.02, 0.86, 0.04], [0.5, 3.1, 0.04], [0, 2.3, 0.04]][s.stage] as V3;

/**
 * The Finlet's go: its head flicked up and back to toss the fish in its beak over its shoulder into its basket, then a lunge,
 * bent right over with its beak open and its flippers back, a snap at the water, and up again with a new fish wriggling in its
 * beak, its head shaken (`PENG_WORK`).
 */
function snatchPlan(s: Peng, R: Rest, t: number, p: Plan): void {
  const W = PENG_WORK, L = R.reach;
  const flick = hump(t, W.toss - 0.01, 0.1);
  const dive = ramp(t, W.stow - 0.08, W.dip - 0.03) * (1 - ramp(t, W.dip + 0.04, W.shake + 0.08));
  const snap = hump(t, W.dip, 0.04);
  const shake = hump(t, W.shake, 0.08) * Math.sin(t * TAU * 9);
  p.chest = [-12 * flick + 52 * dive, 6 * shake, 0];
  p.neck = [-10 * flick + 18 * dive, 0];
  p.head = [36 * flick - 30 * dive - 6 * snap, 10 * shake * 2, 16 * shake];
  p.pitch = 10 * dive;
  p.H += L * (-0.25 * dive + 0.1 * flick);
  p.surge = L * 0.25 * dive;
  p.jaw = Math.max(hump(t, W.toss, 0.05), ramp(t, W.dip - 0.16, W.dip - 0.04) * (1 - ramp(t, W.dip - 0.01, W.dip + 0.01)));
  // The flippers flung back and up as it lunges, for balance.
  p.flip = p.flip.map((f, i) => add(f, [(i ? 1 : -1) * 0.3 * s.arm[1] * dive, -0.9 * s.arm[1] * dive, 1.1 * s.arm[1] * dive]));
  p.bite = t < W.toss ? 1 : ramp(t, W.dip - 0.005, W.dip + 0.005);
  p.toss = t >= W.toss && t < W.stow ? (t - W.toss) / (W.stow - W.toss) : 0;
  p.wriggle = [t > W.dip ? 1 - 0.6 * ramp(t, W.shake + 0.1, 0.95) : 0.2, frac(t * ACT_SECS.work * 3.4)];
  p.basket = [8 * ringOut((t - W.stow) * ACT_SECS.work, 2.4, 4), 0];
  for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 0.25 * dive * (i ? 1 : 0.6), 0]);
}

/**
 * The Reeffin's go: the pole swung back over its shoulder, then cast forward with its flipper behind it, the line flying out to
 * land in the water ahead; held, the tip bobbing, until a bite pulls it down twice; then hauled up and back, the fish coming
 * out of the water on the line and swinging in under the tip (`PENG_WORK`).
 */
function castPlan(s: Peng, R: Rest, t: number, p: Plan): void {
  const W = PENG_WORK, L = R.reach, T = toolRest(s);
  const tug = hump(t, W.bite, 0.025) + hump(t, W.bite + 0.05, 0.025);
  toolPath(p, [
    { t: 0.06, grip: T.grip, dir: T.dir },
    { t: 0.26, grip: byLeft(s, [-0.1, 0.3, 0.95], 0.84), dir: unit([-0.1, -0.55, 0.83]) },
    { t: W.cast + 0.02, grip: byLeft(s, [-0.1, 1, 0.15]), dir: unit([-0.05, 0.86, 0.5]) },
    { t: W.land, grip: byLeft(s, [-0.1, 1, 0]), dir: unit([-0.05, 0.9, 0.42]) },
    { t: W.haul - 0.02, grip: byLeft(s, [-0.1, 1, -0.05]), dir: unit([-0.05, 0.9, 0.42]) },
    { t: W.haul + 0.08, grip: byLeft(s, [-0.1, 0.55, 0.8], 0.86), dir: unit([-0.1, 0.05, 1]) },
    { t: 0.92, grip: T.grip, dir: T.dir },
  ], t);
  // The tip bobbed as it waits, and pulled down by the bite.
  const wait = ramp(t, W.land, W.land + 0.03) * (1 - ramp(t, W.haul - 0.03, W.haul));
  p.dir = unit(add(p.dir, [0, 0, -0.04 * wait * Math.sin(t * TAU * 7) - 0.22 * tug]));
  const back = ramp(t, 0.06, 0.26) * (1 - ramp(t, 0.26, W.cast + 0.02));
  const cast = ramp(t, 0.26, W.cast + 0.02) * (1 - ramp(t, W.haul - 0.02, W.haul + 0.1));
  const haul = ramp(t, W.haul - 0.02, W.haul + 0.08) * (1 - ramp(t, W.haul + 0.12, 0.95));
  p.on = [1, 0.85 * Math.max(back, cast, haul)];
  p.chest = [-10 * back + 16 * cast - 8 * haul + 4 * tug, 18 * back - 10 * cast, 0];
  p.neck = [6 * cast, 0];
  p.head = [8 * back - 14 * cast + 10 * haul - 4 * tug, -6 * cast, 0];
  p.H += L * (0.05 * back - 0.08 * cast + 0.06 * haul);
  p.at[0] = add(p.at[0], [0, L * 0.4 * cast, 0]);
  p.out = ramp(t, W.cast, W.land) * (1 - ramp(t, W.haul, W.haul + 0.1));
  p.caught = 1 - ramp(t, W.land - 0.01, W.land + 0.005) + ramp(t, W.haul - 0.005, W.haul + 0.01);
  const since = (t - W.haul - 0.1) * ACT_SECS.work;
  p.swing = [-30 * back + 40 * ringOut(since, 1.3, 2.4), 18 * ringOut(since + 0.2, 1.1, 2.4)];
  p.wriggle = [t > W.haul ? 1 - 0.7 * ramp(t, 0.85, 1) : 0.2, frac(t * ACT_SECS.work * 3.4)];
}

/**
 * The Tideharvest's go: its net swung down off its shoulder in both flippers and its hoop into the water ahead and to its right,
 * swept through it across to its left, turning with it, then lifted out streaming, and swung back up over its shoulder
 * (`PENG_WORK`).
 */
function sweepPlan(s: Peng, R: Rest, t: number, p: Plan): void {
  const W = PENG_WORK, L = R.reach, T = toolRest(s);
  // Swept across with its hoop's mouth leading and the bag dragging behind, its foot down in the water.
  toolPath(p, [
    { t: 0.06, grip: T.grip, dir: T.dir, up: T.up },
    { t: W.into - 0.1, grip: byLeft(s, [0.5, 1, 0.3]), dir: unit([0.5, 0.8, 0.1]), up: [0, 0, 1] },
    { t: W.into, grip: byLeft(s, [0.55, 1, -0.1]), dir: unit([0.52, 0.8, -0.08]), up: [-1, 0, 0.5] },
    { t: W.sweep, grip: byLeft(s, [0.25, 1, -0.1]), dir: unit([-0.55, 0.78, -0.08]), up: [-1, 0, 0.5] },
    { t: W.lift + 0.04, grip: byLeft(s, [0.2, 0.9, 0.6]), dir: unit([-0.2, 0.62, 0.72]), up: [0, 0, 1] },
    { t: 0.9, grip: T.grip, dir: T.dir, up: T.up },
  ], t);
  const busy = ramp(t, 0.06, W.into - 0.08) * (1 - ramp(t, W.lift + 0.06, 0.88));
  const across = ramp(t, W.into, W.sweep);
  p.slide = 0.9 * busy;
  p.chest = [16 * busy - 6 * hump(t, W.lift, 0.08), lerp(-18, 18, across) * busy, 0];
  p.yaw = lerp(-12, 12, across) * busy;
  p.head = [-10 * busy + 8 * hump(t, W.lift, 0.08), lerp(-10, 10, across) * busy * 0.6, 0];
  p.H += L * (-0.2 * busy);
  // The other flipper out for balance.
  p.flip[1] = add(p.flip[1], [0.7 * s.arm[1] * busy, -0.2 * s.arm[1] * busy, 0.8 * s.arm[1] * busy]);
  p.at[0] = add(p.at[0], [0, L * 0.3 * busy, 0]);
  p.at[1] = add(p.at[1], [0, -L * 0.15 * busy, 0]);
  const since = (t - W.lift) * ACT_SECS.work;
  p.swing = [10 * ringOut(since, 1.4, 2.6), 8 * ringOut(since + 0.1, 1.2, 2.6)];
}

/** A go at its task, by stage: the Finlet's snatch, the Reeffin's cast, the Tideharvest's sweep, eased in from how it stands. */
function workPlan(s: Peng, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R);
  if (s.stage === 0) snatchPlan(s, R, t, p);
  else if (s.stage === 1) castPlan(s, R, t, p);
  else sweepPlan(s, R, t, p);
  p.plume = 10 * Math.sin(t * TAU * 2);
  return mixPlan(restPlan(s, R), p, down);
}

/** Feeding where it stands: bent over, pecking at the ground ahead of its feet. */
function grazePlan(s: Peng, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const peck = Math.max(0, Math.sin(t * TAU * 1.5)) ** 3;
  p.chest = [24 + 6 * peck, 0, 0];
  p.neck = [12 + 10 * peck, 4 * drift(t, 2)];
  p.head = [-26 - 10 * peck, 8 * drift(t, 2), 0];
  p.jaw = 0.4 * peck;
  p.H -= 0.1 * R.reach;
  return p;
}

/** Evolving: hunched as the light gathers, then drawn up tall at the turn with its flippers spread and up, a shake, and settled. */
function evolvePlan(s: Peng, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach;
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * (s.stage === 2 ? 48 : 66));
  p.H += L * (-0.3 * hunch + 0.3 * up);
  p.chest = [14 * hunch - 8 * up, 6 * shake, 0];
  p.neck = [8 * hunch - 6 * up, 0];
  p.head = [-14 * hunch + 22 * up, 0, 16 * shake];
  p.roll = 4 * shake;
  p.squash = 0.06 * hump(t, 0.72, 0.05);
  p.flip = p.flip.map((f, i) => add(f, [(i ? 1 : -1) * up * 0.9 * s.arm[1] + (i ? 1 : -1) * 0.2 * s.arm[1] * shake, 0, up * 1.3 * s.arm[1]]));
  p.wriggle = [0.3 + 0.7 * up, frac(t * ACT_SECS.evolve * 3)];
  p.swing = [12 * shake, 8 * shake];
  p.basket = [6 * shake, 4 * shake];
  p.plume = 14 * up + 10 * shake;
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Peng, R: Rest, a: Anim): Plan {
  const act = a.act;
  // An act is laid over how it stands this moment, so it starts from it and ends in it with no jump either way.
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over(strikePlan(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return mixPlan(stillPlan(s, R, a), grazePlan(s, R, a), smooth(a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = goingPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/* ---- its bones ------------------------------------------------------------------------- */

/** Two bones bent to put the end of the second at `to` from `from`, the joint between them bowed toward `hint`: the knee or the flipper's bend. */
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

/** A leg bent to put its ankle at `ankle`: the knee forward and a little out, always the same way round; the foot flat, turned out. */
function legOf(s: Peng, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.3, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.3 * fwd[1], fwd[1] - sd * 0.3 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The middle of the skull in the head's frame. */
const skullAt = (s: Peng): V3 => [0, 0.02, s.head.up];
/** Where the beak comes out of the face, and the way it points, in the head's frame. */
function beakRoot(s: Peng): { p: V3; d: V3 } {
  const e = onEgg(skullAt(s), s.head.r, [0, 1, s.beak.z]);
  return { p: add(e.p, [0, -s.beak.len * 0.18, 0]), d: unit([0, 1, -0.16]) };
}
/** The hinge of the lower beak in the head's frame. */
const hingeAt = (s: Peng): V3 => { const B = beakRoot(s); return add(B.p, [0, 0, -s.beak.h * 0.35]); };
/** Where the line and the hoop are on what it fishes with, along it from the grip. */
const tipAt = (s: Peng): number => s.tool[1];

/** Where what hangs from a point is, `len` under it, swung forward and to its left (degrees) in the body's frame. */
function hangFrom(top: V3, len: number, swing: number[], body: Xf): V3 {
  const f = swing[0] * (Math.PI / 180), l = swing[1] * (Math.PI / 180);
  const fwd = turn(body, [0, 1, 0]), left = turn(body, [-1, 0, 0]);
  const d = unit(add(add([0, 0, -Math.cos(f) * Math.cos(l)], scale(fwd, Math.sin(f))), scale(left, Math.sin(l))));
  return add(top, scale(d, len));
}
/** A path through the air from `a` to `b`, `u` of the way, rising `up` over the straight line at its middle. */
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}

/**
 * The bones of a stage: its pose, the hips raised and carried as it says, the chest on them, the neck and the head and the lower
 * beak, each leg bent to put its foot where it is to be, each flipper bent to put its tip where it is to be or on what it holds,
 * what it fishes with, the basket on its back, and the fish: in its beak, tossed, on the line, at its belt.
 */
function pengBones(s: Peng): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    const chest = joint(body, [0, 0, 0], -P.chest[0], P.chest[2], P.chest[1]);
    b.chest = chest;
    // The belly squashed by a landing, what hangs on the chest kept its size.
    const q = P.squash;
    b.belly = q ? { m: [chest.m[0] * (1 + q * 0.45), chest.m[1] * (1 + q * 0.45), chest.m[2] * (1 - q), chest.m[3] * (1 + q * 0.45), chest.m[4] * (1 + q * 0.45), chest.m[5] * (1 - q), chest.m[6] * (1 + q * 0.45), chest.m[7] * (1 + q * 0.45), chest.m[8] * (1 - q)], t: chest.t } : chest;
    b.neck = joint(chest, s.neck.at, -P.neck[0], 0, P.neck[1]);
    // The head carried level whatever the body and the chest do under it, then pitched as the pose says.
    b.head = joint(b.neck, [0, 0, s.neck.len], P.chest[0] + P.neck[0] - P.pitch + s.head.pitch + P.head[0], P.head[2] - P.chest[2] - P.roll, P.head[1]);
    b.jaw = joint(b.head, hingeAt(s), -26 * P.jaw);
    if (s.hat) b.hat = joint(b.head, add(skullAt(s), [0, -s.head.r[1] * 0.12, s.head.r[2] * 0.7]), 14);
    if (s.hat && s.feather) b.plume = joint(b.hat, [0, -s.hat.r * 0.05, s.hat.h * 0.95], -20 - P.plume, 0, 0);
    b.basket = joint(chest, s.basket.at, s.basket.tip + P.basket[0], P.basket[1], 0);
    b.shadow = shadowOf(body, 0);
    for (let i = 0; i < 2; i++) {
      const [u, l, f] = legOf(s, body, i, P.at[i], P.foot[i]);
      const key = i ? 'lr' : 'll';
      b[`${key}0`] = u;
      b[`${key}1`] = l;
      b[`${key}2`] = f;
    }
    // What it fishes with, in the chest's frame: along it to its business end, its up square to that.
    const Z = unit(P.dir), Y = unit(sub(P.up, scale(Z, dot(P.up, Z)))), X = cross(Y, Z);
    b.tool = compose(chest, xfOf(X, Y, Z, sub(P.grip, scale(Z, P.slide))));
    // The flippers: each bent to put its tip where it is to be, or on the tool, its flat side out from the body.
    const ref = turn(chest, unit([0, 0.6, -0.8])), onAt = [0, 0];
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1;
      const shL: V3 = [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]];
      // The left flipper at the grip; the right wherever along the handle is nearest its shoulder, while that is in reach.
      const near = clamp(dot(sub(shL, P.grip), Z), -s.tool[0] - P.slide, s.tool[1] * 0.6 - P.slide), onTool = i ? add(P.grip, scale(Z, near)) : P.grip;
      const reach = s.arm[0] + s.arm[1], on = s.carry === 'beak' ? 0 : i ? P.on[1] * clamp((reach * 1.02 - len3(sub(onTool, shL))) / (reach * 0.12)) : P.on[0];
      onAt[i] = on;
      const want = place(chest, mixV(P.flip[i], onTool, on));
      const sh = place(chest, shL);
      const { mid: el, end: tip } = bend2(sh, want, s.arm[0], s.arm[1], turn(chest, unit([sd * 1, -0.3, -0.4])));
      const [X0, Y0, Z0] = frameOf(sub(sh, el), ref), [X1, Y1, Z1] = frameOf(sub(el, tip), ref);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      b[`hand${i}`] = scaled(xfOf(X1, Y1, Z1, tip), onAt[i] > 0.5 ? 1 : 0);
    }
    const down: V3 = [0, 0, -1], fwd = turn(body, [0, 1, 0]);
    if (s.carry === 'beak') {
      // The fish in its beak, held by the head, hanging down and out to its left; and the one tossed back, tumbling to the basket.
      const at = place(b.jaw, [-s.beak.w * 0.25, s.beak.len * 0.62, -s.beak.h * 0.2]);
      const fl = P.swing[1] * (Math.PI / 180), ff = P.swing[0] * (Math.PI / 180);
      b.bite = scaled(along(turn(b.jaw, unit([-0.32 - Math.sin(fl) * 1.4, 0.22 + Math.sin(ff), -Math.cos(fl) * Math.cos(ff)])), turn(b.jaw, [0, 1, 0.2]), at), P.bite);
      const from = place(b.jaw, [0, s.beak.len * 0.7, 0]), to = place(b.basket, [0, 0, s.basket.h * 0.9]);
      const u = P.toss, spin = u * TAU * 1.3;
      b.toss = scaled(along([Math.sin(spin) * 0.4, -Math.cos(spin) * 0.3, -Math.cos(spin)], fwd, arc(from, to, u, s.head.r[2] * 1.3)), u > 0 && u < 1 ? 1 : 0);
    }
    if (s.carry === 'pole') {
      // The line from the pole's tip, hanging plumb and swinging, or out to the water; the fish on its end.
      const tip = place(b.tool, [0, 0, tipAt(s)]);
      const hang = hangFrom(tip, s.line, P.swing, body);
      const end = P.out > 0 ? arc(hang, waterAt(s), P.out < 1 ? P.out : 1, s.line * 0.8) : hang;
      b.lineTip = { m: ROOT.m, t: tip };
      b.lineEnd = { m: ROOT.m, t: end };
      const ax = len3(sub(end, tip)) > 1e-3 && P.out < 0.98 ? unit(sub(end, tip)) : down;
      b.catch = scaled(along(ax, fwd, end), P.caught);
    }
    if (s.ropes === 2) {
      // The fish at its belt, hung by its tail from the knot and swinging.
      const top = place(chest, beltKnot(s));
      b.belt = along(sub(hangFrom(top, 1, [P.swing[0] * 0.5, P.swing[1] * 0.5 - 6], body), top), fwd, top);
    }
    return b;
  };
  return (a) => pose(planOf(s, R, { ...a, go: a.act ? 0 : a.go }));
}

/* ---- what it is made of ------------------------------------------------------------- */

/** A patch painted onto the egg `(C, R)` round the way `dir`, `rx` by `ry`, turned `spin`: a cheek, a ring round an eye. */
function patchOn(C: V3, R: V3, dir: V3, rx: number, ry: number, mat: Mat, spin = 0, lift = 0.012, sides = 12): Disc {
  const e = onEgg(C, R, dir), d = disc(add(e.p, scale(e.n, lift)), e.n, rx, ry, sides, mat, { spin, at: add(e.p, scale(e.n, -0.02)) });
  return { ...d, v: d.v.map((v) => { const q = onEgg(C, R, sub(v, C)); return add(q.p, scale(q.n, lift)); }) };
}

/** Whether a point on the skull (its way out of it, scaled to a ball) is the cream of its face: the front up to its edge, and the throat. */
function creamFace(s: Peng, d: V3): boolean {
  const F = s.face, x = Math.abs(d[0]);
  if (d[2] < -0.5 && d[1] > -0.5) return true;
  if (d[1] < F.front) return false;
  const edge = F.top - F.peak * Math.max(0, 1 - x / 0.2) - F.side * Math.max(0, x - 0.58);
  return d[2] < edge;
}

/**
 * The head: a round skull, the coat over the crown and down the back, the cream of its face below; big glossy eyes, a pale ring
 * round each where they sit in the coat; a rosy cheek; the upper beak, wide and a little hooked; and the Finlet's two round
 * bumps on its crown.
 */
function headOf(s: Peng, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), R = H.r;
  const skull = painted(orb(C, R, n + 12, k + 7, 'coat'), (c) => {
    const d: V3 = [(c[0] - C[0]) / R[0], (c[1] - C[1]) / R[1], (c[2] - C[2]) / R[2]];
    return creamFace(s, d) ? 'mark' : 'coat';
  });
  const bumps = s.bumps ? [1, -1].map((sd) => { const e = onEgg(C, R, [sd * 0.62, -0.08, 0.72]); return egg(add(e.p, scale(e.n, -s.bumps * 0.35)), UPRIGHT, [s.bumps, s.bumps * 0.85, s.bumps * 0.9], n, k, 'coat'); }) : [];
  const B = beakRoot(s), Bk = s.beak;
  const at = (u: number): V3 => add(add(B.p, scale(B.d, Bk.len * u)), [0, 0, -Bk.h * 0.5 * u * u]);
  const upper = tube([at(-0.15), at(0.1), at(0.45), at(0.78), at(1)], [Bk.w * 0.95, Bk.w, Bk.w * 0.82, Bk.w * 0.5, 0.008], [Bk.h * 0.9, Bk.h * 0.8, Bk.h * 0.62, Bk.h * 0.4, 0.008], n, 'bill');
  const cheeks = paint([1, -1].map((sd) => patchOn(C, R, [sd * 0.66, 0.6, -0.26], s.eye.size * 1.25, s.eye.size * 0.8, 'inner', 0, 0.02, 10)));
  const rings = s.face.patch ? paint([1, -1].map((sd) => patchOn(C, R, [sd * s.eye.dir[0], s.eye.dir[1], s.eye.dir[2] - 0.04], s.eye.size * 1.8, s.eye.size * 1.5, 'membrane', 0, 0.014, 12))) : null;
  return merge(skull, ...bumps, upper, cheeks, rings, eyesOf(s, shut));
}

/**
 * The eyes: each a dark rim, a big glossy dark eye and two glints, laid onto the skull's own curve; all of an eye out of sight
 * together when the head is between it and the viewer.
 */
function eyesOf(s: Peng, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, -0.05));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.28, 8, 'lid', o), 0.018));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.12, r * 1.0, 12, 'lid', o), 0.016));
    out.push(onto(disc(p, n, r, r * 0.88, 12, 'eye', o), 0.02));
    out.push(onto(disc(add(add(p, scale(up, r * 0.36)), scale(across, side * r * 0.3)), n, r * 0.4, r * 0.4, 6, 'glint', { ...o, lit: true }), 0.03));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.44)), scale(across, -side * r * 0.32)), n, r * 0.16, r * 0.16, 5, 'glint', { ...o, lit: true }), 0.03));
  }
  return paint(out);
}

/** The lower beak, in its own frame from its hinge: a shallower wedge under the upper. */
function jawOf(s: Peng, n: number): Mesh {
  const B = beakRoot(s), Bk = s.beak, h = hingeAt(s);
  const at = (u: number): V3 => sub(add(add(B.p, scale(B.d, Bk.len * u)), [0, 0, -Bk.h * 0.55 - Bk.h * 0.25 * u]), h);
  return tube([at(0), at(0.4), at(0.75), at(0.92)], [Bk.w * 0.85, Bk.w * 0.72, Bk.w * 0.42, 0.006], [Bk.h * 0.45, Bk.h * 0.38, Bk.h * 0.24, 0.006], n, 'billDark');
}

/**
 * A fish, nose at the origin and along `y` to its tail, `L` long: a deep narrow body, blue-grey along its back, silver flanks and
 * a white belly, a forked tail and a fin on its back, a dark eye each side. One of a heap, `packed`, is its body, its tail and
 * its eyes, and no more.
 */
function fishMesh(L: number, n: number, packed = false): Mesh {
  const ys = [0, 0.05, 0.16, 0.34, 0.55, 0.72, 0.82].map((v) => v * L);
  const w = [0.006, 0.05, 0.075, 0.08, 0.06, 0.03, 0.016].map((v) => v * L);
  const h = [0.006, 0.08, 0.13, 0.145, 0.11, 0.05, 0.03].map((v) => v * L);
  const sides = Math.max(6, n);
  const body = tube(ys.map((y) => [0, y, 0] as V3), w, h, sides, (_ring, j) => {
    const a = ((j + 1) / sides) * TAU, up = Math.sin(a);
    return up > 0.55 ? 'water' : up < -0.6 ? 'spot' : 'shell';
  }, { up: [0, 0, 1] });
  const tail = merge(
    blade([[0, 0.8 * L, 0.01 * L], [0, 0.92 * L, 0.07 * L], [0, 1.0 * L, 0.15 * L]], [0.03 * L, 0.06 * L, 0.035 * L], [1, 0, 0], { mat: 'shellDark', rib: 'water', thick: 0.01 * L, fold: 0.1 }),
    blade([[0, 0.8 * L, -0.01 * L], [0, 0.92 * L, -0.07 * L], [0, 1.0 * L, -0.15 * L]], [0.03 * L, 0.06 * L, 0.035 * L], [1, 0, 0], { mat: 'shellDark', rib: 'water', thick: 0.01 * L, fold: 0.1 }),
  );
  if (packed) return merge(body, tail, paint([1, -1].map((sd) => disc([sd * 0.052 * L, 0.1 * L, 0.025 * L], [sd, 0.25, 0.1], 0.026 * L, 0.026 * L, 6, 'lid'))));
  const fin = blade([[0, 0.3 * L, 0.12 * L], [0, 0.4 * L, 0.19 * L], [0, 0.5 * L, 0.2 * L]], [0.05 * L, 0.04 * L, 0.01 * L], [1, 0, 0], { mat: 'water', thick: 0.008 * L, fold: 0.05 });
  const belly = blade([[0, 0.5 * L, -0.1 * L], [0, 0.58 * L, -0.15 * L]], [0.03 * L, 0.01 * L], [1, 0, 0], { mat: 'shellDark', thick: 0.008 * L, fold: 0.05 });
  const eyes = paint([1, -1].flatMap((sd) => [
    disc([sd * 0.052 * L, 0.1 * L, 0.025 * L], [sd, 0.25, 0.1], 0.026 * L, 0.026 * L, 8, 'lid'),
    disc([sd * 0.056 * L, 0.1 * L, 0.03 * L], [sd, 0.25, 0.1], 0.009 * L, 0.009 * L, 5, 'glint', { lit: true }),
  ]));
  const gill = paint([1, -1].map((sd) => disc([sd * 0.07 * L, 0.19 * L, -0.01 * L], [sd, 0.05, 0], 0.012 * L, 0.07 * L, 6, 'shellDark')));
  return merge(body, tail, fin, belly, eyes, gill);
}

/** A held fish wriggling: its body bent from side to side behind its head, more toward the tail, as hard as the pose says. */
function wriggled(s: Peng, L: number, P: (a: Anim) => Plan): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const [k, ph] = P(a).wriggle;
    if (k <= 0.001) return v as V3[];
    return v.map((p) => {
      const f = clamp(p[1] / L);
      return [p[0] + k * L * 0.16 * f ** 1.4 * Math.sin(TAU * ph - f * 3.2), p[1], p[2]] as V3;
    });
  };
}

/** A rope along a line of points: two strands' worth of light and dark in bands, so it reads as twisted. */
function rope(pts: readonly V3[], r: number, n: number): Mesh {
  return tube(pts, r, r, Math.max(5, n - 3), (ring, j) => ((ring + j) % 3 === 0 ? 'grip' : 'string'));
}
/** A rope round the body through points on it, each (height, round from its right, off it) in the chest's frame, a few between each. */
function ropeOn(s: Peng, keys: ReadonlyArray<readonly [number, number, number]>, r: number, n: number, closed = false): Mesh {
  const pts: V3[] = [];
  const list = closed ? [...keys, keys[0]] : keys;
  for (let q = 0; q < list.length - 1; q++) {
    const [z0, a0, o0] = list[q], [z1, a1, o1] = list[q + 1];
    const a1n = closed && q === list.length - 2 ? a1 + TAU * Math.round((a0 - a1) / TAU) : a1;
    const per = n > 8 ? 4 : 3;
    for (let u = 0; u < per; u++) pts.push(onBody(s, lerp(z0, z1, u / per), lerp(a0, a1n, u / per), lerp(o0, o1, u / per)));
  }
  pts.push(onBody(s, ...list[list.length - 1]));
  return rope(pts, r, n);
}

/** Where the belt is knotted at its front, in the chest's frame: what the fish at it hangs from. */
const beltKnot = (s: Peng): V3 => onBody(s, s.torso.z[3] + 0.04, Math.PI / 2 - 0.55, 0.06);

/**
 * The ropes on it, in the chest's frame: the Finlet's round its neck, sagging over its chest, that holds its basket on; the
 * Reeffin's harness, each strap over a shoulder and across its chest to under the other flipper, knotted where they cross, and a
 * belt; the Tideharvest's strap from its left shoulder across its chest and down to its right hip, a rope round its neck, and a
 * belt.
 */
function ropesOf(s: Peng, n: number): Mesh {
  const T = s.torso, top = T.z[T.z.length - 1], S = s.shoulder, r = [0.018, 0.028, 0.038][s.stage], out: Mesh[] = [];
  const P = Math.PI / 2;
  const neck = (z: number, sag: number, off: number): Array<[number, number, number]> =>
    Array.from({ length: 12 }, (_, q) => { const a = (q / 12) * TAU; return [z - sag * Math.max(0, Math.sin(a)) ** 2, a, off]; });
  if (s.ropes === 0) out.push(ropeOn(s, neck(S[2] + 0.03, 0.09, 0.03), r, n, true));
  if (s.ropes === 1) {
    for (const sd of [1, -1]) {
      out.push(ropeOn(s, [
        [S[2] - 0.05, P + sd * 2.2, 0.06], [S[2] + 0.08, P + sd * 1.7, 0.08], [S[2] + 0.02, P + sd * 1.1, 0.06], [S[2] - 0.15, P + sd * 0.5, 0.03],
        [T.z[3] + 0.06, P - sd * 0.45, 0.03], [T.z[3], P - sd * 1.2, 0.04], [T.z[3] + 0.04, P - sd * 1.75, 0.05],
      ], r, n));
    }
    out.push(ropeOn(s, Array.from({ length: 12 }, (_, q) => [T.z[3] - 0.04 + 0.02 * Math.sin((q / 12) * TAU), (q / 12) * TAU, 0.03] as [number, number, number]), r * 0.9, n, true));
    out.push(egg(onBody(s, (S[2] - 0.15 + T.z[3] + 0.06) / 2 + 0.02, P, 0.05), UPRIGHT, [r * 2.6, r * 2, r * 2.6], 6, 4, 'grip'));
  }
  if (s.ropes === 2) {
    const med = medallionAt(s);
    out.push(ropeOn(s, [[S[2] - 0.05, P + 2.2, 0.08], [S[2] + 0.1, P + 1.65, 0.1], [S[2] + 0.02, P + 1.05, 0.07], [med.z, P + med.a * 0.4, 0.05]], r, n));
    out.push(ropeOn(s, [[med.z, med.a + P, 0.05], [T.z[3] + 0.3, P - 0.55, 0.04], [T.z[3] + 0.08, P - 1.25, 0.05], [T.z[3] + 0.04, P - 1.9, 0.06]], r, n));
    out.push(ropeOn(s, neck(top - 0.12, 0.08, 0.04), r * 0.85, n, true));
    out.push(ropeOn(s, Array.from({ length: 14 }, (_, q) => { const a = (q / 14) * TAU; return [T.z[3] + 0.04 + 0.1 * Math.cos(a - 0.6), a, 0.04] as [number, number, number]; }), r, n, true));
    out.push(egg(beltKnot(s), UPRIGHT, [r * 2.4, r * 2, r * 2.4], 6, 4, 'grip'));
  }
  return merge(...out);
}

/** Where the Tideharvest's medallion is on its chest: how high in the chest's frame, and how far round from straight ahead. */
const medallionAt = (s: Peng): { z: number; a: number } => ({ z: s.shoulder[2] + 0.06, a: -0.2 });

/** The medallion: a round blue stone in a ring of rope, a shell's whorl on its face, on the strap over its chest. */
function medallionOf(s: Peng, n: number): Mesh {
  const M = medallionAt(s), a = Math.PI / 2 + M.a, p = onBody(s, M.z, a, 0.08), r = torsoAt(s, M.z);
  const nrm = unit([Math.cos(a) * r.h, Math.sin(a) * r.w, 0.25]), R0 = 0.15;
  const [X, Y] = frameOf(nrm, [0, 0, 1]);
  const ring: V3[] = Array.from({ length: 13 }, (_, q) => add(p, add(scale(X, Math.cos((q / 12) * TAU) * R0), scale(Y, Math.sin((q / 12) * TAU) * R0))));
  const face = tube([add(p, scale(nrm, -0.03)), add(p, scale(nrm, 0.02))], R0 * 0.82, R0 * 0.82, n + 2, 'crystal');
  const whorl: Disc[] = [];
  for (let q = 0; q < 7; q++) {
    const u = q / 7, ang = u * TAU * 1.1, d = R0 * 0.62 * (1 - u * 0.85);
    whorl.push(disc(add(add(p, scale(nrm, 0.025)), add(scale(X, Math.cos(ang) * d), scale(Y, Math.sin(ang) * d))), nrm, R0 * 0.16 * (1 - u * 0.5), R0 * 0.1 * (1 - u * 0.5), 6, 'cap', { up: add(scale(X, -Math.sin(ang)), scale(Y, Math.cos(ang))) }));
  }
  whorl.push(disc(add(add(p, scale(nrm, 0.03)), add(scale(X, -R0 * 0.3), scale(Y, R0 * 0.35))), nrm, R0 * 0.14, R0 * 0.14, 6, 'glint', { lit: true }));
  return merge(rope(ring, 0.04, n), face, paint(whorl));
}

/** The fluff of its chest under its chin: soft cream tufts round the top of its bib, lying down and out over it; in the chest's frame. */
function fluffOf(s: Peng): Mesh {
  const out: Mesh[] = [], z0 = s.neck.at[2] - 0.02 - 0.04 * s.stage, L = [0.08, 0.13, 0.17][s.stage];
  for (let row = 0; row < 1; row++) {
    for (let q = 0; q < 7; q++) {
      const a = Math.PI / 2 + ((q - 3) / 3) * 0.75 + row * 0.1, z = z0 - row * L * 0.55;
      const root = onBody(s, z, a, -0.01), o = unit([Math.cos(a), Math.sin(a), 0]);
      const len = L * (0.8 + 0.4 * jitter(q + row * 9));
      const tip = add(add(root, scale(o, len * 0.55)), [0, 0, -len * 0.75]);
      const mid = add(mixV(root, tip, 0.5), scale(o, len * 0.12));
      out.push(tube([root, mid, tip], [len * 0.3, len * 0.36, 0], [len * 0.12, len * 0.16, 0], 5, row ? 'mark' : 'muzzle', { up: o }));
    }
  }
  return merge(...out);
}

/**
 * The cape: leaves in rows round its shoulders and down its back and sides, each rooted at its shoulders and lying down over
 * its body, the front left open; three greens among them, in the chest's frame.
 */
function capeOf(s: Peng, fine: boolean): Mesh {
  const C = s.cape, out: Mesh[] = [];
  const top = s.shoulder[2] + C.len * 0.15;
  const mats: Mat[] = ['leaf', 'moss', 'leafDark'];
  // A mantle: rows of broad leaves overlapping like shingles over its shoulders and upper back, the lowest row ending at the
  // middle of its back, each row a little further out than the one under it.
  for (let row = C.rows - 1; row >= 0; row--) {
    // Fewer, broader leaves where it is drawn small.
    const z0 = top - row * C.len * 0.3, count = Math.round((C.count + row * 2) * (fine ? 1 : 0.8)), open = C.open + row * 0.15;
    for (let q = 0; q < count; q++) {
      const a = Math.PI / 2 + open + ((q + 0.5 * (row % 2)) / count) * (TAU - 2 * open) + (jitter(q + row * 13) - 0.5) * 0.1;
      const L = C.len * (C.rows === 1 ? 1 : 0.62) * (0.88 + 0.24 * jitter(q * 3 + row));
      const zEnd = z0 - L;
      const off = 0.03 + (C.rows - 1 - row) * 0.03;
      const w = C.w * (fine ? 1 : 1.2) * (0.85 + 0.3 * jitter(q + 7 + row)), curl = w * 0.5;
      const pts = (fine ? [0, 0.33, 0.66, 1] : [0, 0.5, 1]).map((u) => onDrape(s, lerp(z0, zEnd, u), top, a, off + u * u * curl));
      const o = unit([Math.cos(a), Math.sin(a), 0.4]);
      out.push(blade(pts, fine ? [w * 0.5, w, w * 0.9, w * 0.35] : [w * 0.5, w, w * 0.4], o, { mat: mats[(q + row) % 3], rib: 'leafDark', fold: 0.3, thick: w * 0.1 }));
    }
  }
  return merge(...out);
}

/**
 * The basket, in its own frame from the middle of its foot up its axis: woven, wider at its rim, a thick rim of rope-bound
 * withy, dark inside, and fish heaped in it, heads and tails out over the rim every way.
 */
function basketOf(s: Peng, n: number): Mesh {
  const B = s.basket, [r0, r1] = B.r, h = B.h, out: Mesh[] = [];
  const rings = 10, sides = n + 8;
  const zs = Array.from({ length: rings }, (_, q) => (q / (rings - 1)) * h);
  const rs = zs.map((z) => lerp(r0, r1, z / h) * (1 + 0.06 * Math.sin((z / h) * Math.PI)));
  out.push(tube(zs.map((z) => [0, 0, z] as V3), rs, rs, sides, (ring, j) => ((ring + j) % 2 ? 'wood' : 'woodDark'), { end: false }));
  const lip: V3[] = Array.from({ length: sides + 1 }, (_, q) => [Math.cos((q / sides) * TAU) * r1 * 1.04, Math.sin((q / sides) * TAU) * r1 * 1.04, h]);
  out.push(tube(lip, r1 * 0.09, r1 * 0.09, 5, (ring) => (ring % 3 === 0 ? 'grip' : 'woodDark')));
  // Dark inside, under the fish.
  out.push(tube([[0, 0, h * 0.82], [0, 0, h * 0.84]], r1 * 0.96, r1 * 0.96, sides, 'bark'));
  const L = s.fish * [0.7, 0.66, 0.62][s.stage];
  for (let q = 0; q < B.fish; q++) {
    const az = (q / B.fish) * TAU + 0.4 + jitter(q + 3) * 0.5, lean = 0.18 + 0.3 * jitter(q + 11);
    const head = q % 2 === 0;
    const dir = unit([Math.cos(az) * lean, Math.sin(az) * lean, 1]);
    const base: V3 = [Math.cos(az) * r1 * 0.42, Math.sin(az) * r1 * 0.42, h * (0.78 + 0.1 * jitter(q))];
    // Its nose up out of the basket, or its tail.
    const f = fishMesh(L, 6, true);
    const nose = head ? add(base, scale(dir, L * 0.72)) : add(base, scale(dir, -L * 0.15));
    const ax = head ? scale(dir, -1) : dir;
    const fr = along(ax, [Math.cos(az + 1.6), Math.sin(az + 1.6), 0], nose);
    out.push(mesh(f.v.map((v) => place(fr, v)), f.f));
  }
  return merge(...out);
}

/**
 * The woven hat, in its own frame from the middle of its brim up: a wide shallow cone of straw in bands, greener toward its
 * crown, a knot of rope at its top.
 */
function hatOf(s: Peng, n: number): Mesh {
  const H = s.hat!, sides = n + 8;
  const zs = [H.h, H.h * 0.82, H.h * 0.6, H.h * 0.38, H.h * 0.18, H.h * 0.05, 0];
  const rs = [0.02, H.r * 0.16, H.r * 0.36, H.r * 0.56, H.r * 0.76, H.r * 0.93, H.r];
  const cone = tube(zs.map((z) => [0, 0, z] as V3), rs, rs, sides, (ring, j) => (ring === zs.length - 1 ? 'hornDark' : ring < 2 ? (j % 2 ? 'moss' : 'leafDark') : ring < 3 ? 'moss' : ring % 2 ? 'horn' : (j % 4 === 0 ? 'hornDark' : 'horn')));
  // The brim's edge bound round, and a knot on its crown.
  const edge: V3[] = Array.from({ length: sides + 1 }, (_, q) => [Math.cos((q / sides) * TAU) * H.r, Math.sin((q / sides) * TAU) * H.r, 0.005]);
  const knot = merge(egg([0, 0, H.h * 0.98], UPRIGHT, [H.r * 0.09, H.r * 0.09, H.r * 0.07], 6, 4, 'grip'), rope([[-H.r * 0.06, 0, H.h * 0.9], [0, 0, H.h * 1.0], [H.r * 0.06, 0, H.h * 0.9]], H.r * 0.035, 5));
  // The ribs of its weave: dark lines from the crown down to the brim, laid on the cone.
  const at = (z: number, r: number, a: number, lift: number): V3 => {
    const slope = unit([Math.cos(a) * H.h, Math.sin(a) * H.h, H.r]);
    return add([Math.cos(a) * r, Math.sin(a) * r, z], scale(slope, lift));
  };
  const ribs: Disc[] = [];
  for (let q = 0; q < 12; q++) {
    const a = (q / 12) * TAU + 0.13, d = 0.022;
    for (let k = 1; k < zs.length - 1; k++) {
      const pts = [at(zs[k], rs[k], a - d, 0.006), at(zs[k + 1], rs[k + 1], a - d * 0.6, 0.006), at(zs[k + 1], rs[k + 1], a + d * 0.6, 0.006), at(zs[k], rs[k], a + d, 0.006)];
      ribs.push(faced(pts, unit([Math.cos(a) * H.h, Math.sin(a) * H.h, H.r]), 'hornDark'));
    }
  }
  return merge(cone, tube(edge, H.r * 0.035, H.r * 0.035, 5, 'hornDark'), knot, paint(ribs));
}

/** The feather in its hat, in its own frame from its quill up: a long blue plume curving back, its vane darker down its rib, and a short one beside it. */
function featherOf(s: Peng): Mesh {
  const F = s.feather;
  const big = blade(curve([0, 0, 0], [0, -F * 0.1, F * 0.55], [0, -F * 0.55, F * 0.9], 6), [0.01, F * 0.1, F * 0.15, F * 0.16, F * 0.14, F * 0.1, F * 0.02], [1, 0, 0.2], { mat: 'feather', rib: 'featherDark', fold: 0.2, thick: F * 0.02, twist: 0.3 });
  const small = blade(curve([0.02, 0, 0], [F * 0.12, -F * 0.12, F * 0.3], [F * 0.2, -F * 0.42, F * 0.5], 4), [0.01, F * 0.07, F * 0.08, F * 0.06, F * 0.01], [1, 0.3, 0.2], { mat: 'featherDark', rib: 'feather', fold: 0.2, thick: F * 0.02 });
  return merge(big, small);
}

/**
 * A row of feathers laid on the outside of a flipper, in its bone's frame: `count` across its width at `z` down it, each `len`
 * long pointing down and a little back, `layer` out from its face so a higher row lies over a lower; each a dark vane on a
 * paler one a little bigger, so it has a pale edge. Drawn plain, where it is small, as one dark vane with a pale rib.
 */
function featherRow(w: number, z: number, len: number, layer: number, count: number, fine: boolean): Mesh {
  const out: Mesh[] = [], fw = ((w * 2) / count) * 1.25;
  for (let q = 0; q < count; q++) {
    const f = (q + 0.5) / count, y = w * (0.85 - 1.9 * f), x = w * (0.3 + layer) + w * 0.03 * q, back = len * (0.12 + 0.22 * f);
    const pts: V3[] = [[x, y, z], [x + w * 0.03, y - back * 0.35, z - len * 0.45], [x + w * 0.05, y - back * 0.75, z - len * 0.82], [x + w * 0.06, y - back, z - len]];
    const ws = [fw * 0.34, fw * 0.5, fw * 0.36, fw * 0.03];
    if (fine) {
      out.push(blade(pts, ws, [1, 0, 0], { mat: 'coatLight', fold: 0.1, thick: w * 0.04 }));
      out.push(blade(pts.slice(0, 3).map((p) => [p[0] + w * 0.035, p[1] + len * 0.02, p[2] + len * 0.04] as V3), [fw * 0.3, fw * 0.42, fw * 0.22], [1, 0, 0], { mat: 'coatDark', fold: 0.1, thick: w * 0.04 }));
    } else out.push(blade(pts, ws, [1, 0, 0], { mat: 'coatDark', rib: 'coatLight', fold: 0.1, thick: w * 0.04 }));
  }
  return merge(...out);
}

/**
 * A flipper's half, in its bone's frame down from its joint: a flat blade, the coat on it, the upper half or the lower to its tip;
 * and the stage's rows of layered feathers down its outside, the lowest reaching past its tip.
 */
function flipperOf(s: Peng, lower: boolean, fine: boolean): Mesh {
  const w = s.flip, L = lower ? s.arm[1] : s.arm[0], F = s.feathers;
  const pts: V3[] = lower ? [[0, 0, w * 0.25], [0, -w * 0.03, -L * 0.3], [0, -w * 0.1, -L * 0.65], [0, -w * 0.22, -L * 0.92], [0, -w * 0.3, -L * 1.06]] : [[0, -w * 0.05, w * 0.2], [0, 0, -L * 0.45], [0, 0, -L - w * 0.25]];
  const ws = lower ? [w * 0.98, w, w * 0.84, w * 0.5, w * 0.12] : [w * 0.55, w * 0.9, w];
  const flat = blade(pts, ws, [1, 0, 0], { mat: 'coat', rib: 'coatLight', fold: 0.28, thick: w * 0.16 });
  const rows: Mesh[] = [];
  if (!lower && F >= 3) rows.push(featherRow(w * 0.95, -L * 0.5, L * 0.6, 0.12, 4, fine));
  if (lower && F >= 2) rows.push(featherRow(w * 0.95, -L * 0.08, L * 0.55, 0.08, 4, fine));
  if (lower && F >= 1) rows.push(featherRow(w * 0.9, -L * 0.42, L * 0.78, 0.02, 4, fine));
  if (lower && !F) rows.push(paint([0.3, 0.55, 0.78].map((u, q) => disc([w * 0.2, -w * (0.42 - 0.06 * q) - w * 0.25 * u, -L * u], [1, -0.15, 0], w * 0.2, w * 0.1, 6, 'coatLight', { up: [0, 0.4, -1] }))));
  return merge(flat, ...rows);
}

/** A webbed foot, in its bone's frame from the ankle: orange, three toes spread forward with the web between, a dark claw on each. */
function footOf(s: Peng, n: number): Mesh {
  const [fl, fw] = s.leg.foot, drop = s.leg.len[2], out: Mesh[] = [];
  out.push(egg([0, fl * 0.12, -drop + fw * 0.12], UPRIGHT, [fw * 0.36, fl * 0.32, fw * 0.16], n - 2, 3, 'bill'));
  for (const q of [-1, 0, 1]) {
    const d = unit([q * 0.5, 1, 0]), root: V3 = [q * fw * 0.08, fl * 0.15, -drop + fw * 0.08];
    const tip = add(root, scale(d, fl * (q ? 0.58 : 0.66)));
    out.push(tube([root, add(mixV(root, tip, 0.5), [0, 0, fw * 0.03]), tip], [fw * 0.13, fw * 0.11, fw * 0.07], [fw * 0.09, fw * 0.08, fw * 0.05], 5, 'bill'));
    out.push(taper([tip, add(tip, add(scale(d, fw * 0.12), [0, 0, -fw * 0.04]))], fw * 0.05, 0.004, 4, 'claw'));
  }
  // The web: flat between the toes.
  out.push(blade([[0, fl * 0.15, -drop + fw * 0.06], [0, fl * 0.42, -drop + fw * 0.04], [0, fl * 0.62, -drop + fw * 0.03]], [fw * 0.18, fw * 0.32, fw * 0.4], [0, 0, 1], { mat: 'billDark', fold: 0.1, thick: fw * 0.04 }));
  return merge(...out);
}

/** The fishing pole, along its frame's `z` from its butt to its tip: a long wooden pole thinning to the tip, rope bound round it, a loop at the tip. */
function poleOf(s: Peng, n: number): Mesh {
  const [B, A] = s.tool, out: Mesh[] = [];
  out.push(taper([[0, 0, -B], [0, 0, A * 0.4], [0, 0, A]], 0.06, 0.028, Math.max(5, n - 3), (ring) => (ring === 1 ? 'woodDark' : 'bark')));
  for (const z of [-B * 0.7, 0.12, A * 0.35, A * 0.62, A * 0.88]) {
    const r = lerp(0.06, 0.028, (z + B) / (A + B)) + 0.016;
    out.push(rope([[0, 0, z - 0.04], [0, 0, z + 0.04]], r, n));
  }
  const loop: V3[] = Array.from({ length: 9 }, (_, q) => [0, Math.sin((q / 8) * TAU) * 0.06, A + 0.06 - Math.cos((q / 8) * TAU) * 0.06]);
  out.push(rope(loop, 0.012, 5));
  return merge(...out);
}

/** The net's handle and hoop, along its frame's `z`: a long wooden handle bound with rope, the hoop of bent wood on its end, lashed round. */
function netFrameOf(s: Peng, n: number): Mesh {
  const [B, A] = s.tool, R = s.hoop, out: Mesh[] = [];
  out.push(tube([[0, 0, -B], [0, 0, -B + 0.06], [0, 0, A + 0.05]], [0.085, 0.085, 0.072], [0.085, 0.085, 0.072], Math.max(5, n - 2), (ring) => (ring === 0 ? 'woodDark' : 'wood')));
  for (const z of [-B * 0.5, -0.1, 0.1, A * 0.55, A - 0.12, A - 0.02]) out.push(rope([[0, 0, z - 0.05], [0, 0, z + 0.05]], 0.098, n));
  const N = 24, hoop: V3[] = Array.from({ length: N + 1 }, (_, q) => { const th = -Math.PI / 2 + (q / N) * TAU; return [R * Math.cos(th), 0, A + R + R * Math.sin(th)]; });
  out.push(tube(hoop, 0.06, 0.06, 5, (ring) => (ring % 4 === 0 ? 'string' : ring % 2 ? 'wood' : 'woodDark')));
  return merge(...out);
}

/** How deep the net's bag hangs under its hoop, and its radius at `f` of the way down. */
const bagDepth = (s: Peng): number => s.hoop * 1.15;
const bagR = (s: Peng, f: number): number => s.hoop * (1 - 0.88 * f ** 1.8) * (1 + 0.05 * Math.sin(f * Math.PI));
/** A point on the net's bag, `f` of the way down it and `th` round it, in the tool's frame. */
function bagPoint(s: Peng, f: number, th: number): V3 {
  const A = s.tool[1], R = s.hoop, r = bagR(s, f);
  return [r * Math.cos(th), -bagDepth(s) * f, A + R + r * Math.sin(th)];
}

/** The lowest point of the net's hoop, as it is posed. */
function hoopFoot(s: Peng, b: Bones): V3 {
  let low: V3 = [0, 0, Infinity];
  for (let q = 0; q < 16; q++) {
    const p = place(b.tool, bagPoint(s, 0, (q / 16) * TAU));
    if (p[2] < low[2]) low = p;
  }
  return low;
}

/** The net's bag, in the tool's frame: cords in a diamond mesh from the hoop down to its foot, knotted where they cross. */
function bagOf(s: Peng): Mesh {
  const N = 12, K = 6, cord = 0.022, out: Mesh[] = [];
  for (const dir of [1, -1]) {
    for (let j = 0; j < N; j++) {
      const pts: V3[] = [];
      for (let k = 0; k <= K; k++) {
        const f = (k / K) * 0.96;
        pts.push(bagPoint(s, f, (j / N) * TAU + dir * f * Math.PI * 0.55));
      }
      out.push(tube(pts, cord, cord, 3, 'string'));
    }
  }
  return merge(...out);
}

/** The fish in the net, heaped in its foot, in the tool's frame; and the solid they make, for the cords behind them to be hidden by. */
function netFishOf(s: Peng, fine: boolean): Mesh {
  const out: Mesh[] = [], L = s.fish * 0.85;
  const N = fine ? 11 : 8;
  for (let q = 0; q < N; q++) {
    const th = (q / N) * TAU + jitter(q + 21), f = 0.3 + 0.5 * jitter(q + 5);
    const c = bagPoint(s, f, th), mid: V3 = [0, c[1], s.tool[1] + s.hoop], inn = mixV(mid, c, 0.62);
    const ax = unit([Math.cos(th + 1.2 + jitter(q) * 0.8), (jitter(q + 2) - 0.5) * 0.8, Math.sin(th + 1.2)]);
    const fr = along(ax, [0, 1, 0.3], sub(inn, scale(ax, L * 0.45)));
    const f0 = fishMesh(L, 6, true);
    out.push(mesh(f0.v.map((v) => place(fr, v)), f0.f));
  }
  return merge(...out);
}
const netFishSolid = (s: Peng): { c: V3; r: V3 } => ({ c: [0, -bagDepth(s) * 0.55, s.tool[1] + s.hoop], r: [s.hoop * 0.45, bagDepth(s) * 0.32, s.hoop * 0.45] });

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Peng): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.86) }];

/** A stage's pieces. */
function pengBuild(s: Peng, lod: number, P: (a: Anim) => Plan): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), pieces: Piece[] = [];
  const hide = headSolids(s), body = bodySolid(s);
  const T = s.torso;
  const torso = painted(tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n + 6, 'coat', { up: [0, 1, 0] }), (c) => (creamBody(s, c) ? 'mark' : 'coat'));
  pieces.push({ key: 'torso', mesh: torso, bone: 'belly', bias: 0, breathes: { c: [0, 0, T.z[2]], k: 0.035 } });
  pieces.push({ key: 'neck', mesh: painted(tube([[0, 0, -0.08], [0, 0, s.neck.len + 0.06]], s.neck.w, s.neck.w * 0.9, n, 'coat'), (c) => (c[1] > 0.02 ? 'mark' : 'coat')), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.201, after: 'head', hide });
  // The cape over its shoulders, the ropes over that, the basket on its back: each laid on the body, hidden where it goes round behind it.
  pieces.push({ key: 'fluff', mesh: fluffOf(s), bone: 'chest', bias: 0.01, after: 'torso', hide: body, lines: false });
  pieces.push({ key: 'cape', mesh: capeOf(s, lod > 0), bone: 'chest', bias: 0.02, after: 'torso', hide: body });
  pieces.push({ key: 'ropes', mesh: ropesOf(s, n), bone: 'chest', bias: 0.03, after: ['torso', 'cape'], hide: body });
  if (s.ropes === 2) pieces.push({ key: 'medallion', mesh: medallionOf(s, n), bone: 'chest', bias: 0.035, after: ['torso', 'cape', 'ropes'], hide: body });
  pieces.push({ key: 'basket', mesh: basketOf(s, n), bone: 'basket', bias: 0.25, after: ['torso', 'cape', 'ropes'], front: [0, -1, 0.3] });
  if (s.hat) {
    pieces.push({ key: 'hat', mesh: hatOf(s, n), bone: 'hat', bias: 0.21, after: ['head', 'jaw'] });
    if (s.feather) pieces.push({ key: 'plume', mesh: featherOf(s), bone: 'plume', bias: 0.215, after: 'hat', front: [0, 1, 0], lines: true });
  }
  // Legs: a short thigh lost in the body, a short orange shin, a webbed foot.
  const L = s.leg;
  for (const key of ['ll', 'lr']) {
    const front: V3 = [0, 1, 0];
    const thigh = tube([[0, 0, 0.02], [0, 0, -L.len[0]]], [L.w * 1.4, L.w], [L.w * 1.4, L.w], n, 'coat', { seam: 'start' });
    const shin = tube([[0, 0, L.w * 0.4], [0, 0.005, -L.len[1]]], [L.w, L.w * 0.85], [L.w, L.w * 0.85], n, 'bill', { seam: 'start' });
    const foot = footOf(s, n);
    pieces.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, under: 'torso' },
      { key: `${key}1`, mesh: shin, bone: `${key}1`, bias: 0.015, after: ['torso', `${key}0`], front },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.02, after: ['torso', `${key}1`], front },
    );
  }
  // Flippers: two flat halves, out over the cape on the side toward the viewer; a dark tip curled round what it holds.
  for (let i = 0; i < 2; i++) {
    const out: V3 = [i ? 1 : -1, 0, 0], m = (x: Mesh): Mesh => (i ? x : mirror(x));
    pieces.push(
      { key: `arm${i}`, mesh: m(flipperOf(s, false, lod > 0)), bone: `arm${i}`, bias: 0.06, after: ['torso', 'cape', 'ropes'], front: out },
      { key: `fore${i}`, mesh: m(flipperOf(s, true, lod > 0)), bone: `elbow${i}`, bias: 0.065, after: ['torso', 'cape', 'ropes', `arm${i}`], front: out },
    );
    if (s.carry !== 'beak') pieces.push({ key: `hand${i}`, mesh: egg([0, 0, -s.flip * 0.15], UPRIGHT, [s.flip * 0.42, s.flip * 0.62, s.flip * 0.55], n - 2, k - 1, 'coatDark'), bone: `hand${i}`, bias: 0.07, after: ['tool', `fore${i}`] });
  }
  // What it fishes with, and the fish.
  const fish = fishMesh(s.fish, n);
  if (s.carry === 'beak') {
    pieces.push({ key: 'bite', mesh: fish, bone: 'bite', bias: 0.205, after: ['head', 'jaw'], hide, hideIn: 'head', bent: wriggled(s, s.fish, P), front: [0, 0, 1] });
    pieces.push({ key: 'toss', mesh: fish, bone: 'toss', bias: 0.3, shown: (a) => a.act?.kind === 'work' });
  }
  if (s.carry === 'pole') {
    pieces.push({ key: 'tool', mesh: poleOf(s, n), bone: 'tool', bias: 0.05, thin: true });
    pieces.push({ key: 'catch', mesh: fish, bone: 'catch', bias: 0.04, bent: wriggled(s, s.fish, P) });
  }
  if (s.carry === 'net') {
    pieces.push({ key: 'tool', mesh: netFrameOf(s, n), bone: 'tool', bias: 0.05 });
    pieces.push({ key: 'netfish', mesh: netFishOf(s, lod > 0), bone: 'tool', bias: 0.04 });
    pieces.push({ key: 'net', mesh: bagOf(s), bone: 'tool', bias: 0.045, after: 'netfish', hide: [netFishSolid(s)], thin: true });
  }
  if (s.ropes === 2) pieces.push({ key: 'beltfish', mesh: fish, bone: 'belt', bias: 0.04, after: ['torso', 'cape', 'ropes'], front: [0, 0, 1], bent: wriggled(s, s.fish, P) });
  return pieces;
}

/* ---- what it throws about ------------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a pixel is, in the units `g` is drawing in. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const WATER_RGB: RGB = [176, 220, 240];
const WATER_INK: RGB = [74, 122, 152];
const WATER_LIGHT: RGB = [244, 252, 255];
const LINE_RGB: RGB = [78, 60, 44];
const LEAF_RGB: readonly RGB[] = [[132, 160, 92], [154, 172, 104], [94, 120, 72]];
const GRAVITY = 9;

/** A drop of water: a round pale-blue bead, an inked edge and a light glint, never under a pixel and a bit across. */
function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, stretch = 1): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.1 * px);
  g.fillStyle = css(WATER_INK, al * 0.9);
  g.beginPath();
  g.ellipse(x, y, r + 0.45 * px, r * stretch + 0.45 * px, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(WATER_RGB, al);
  g.beginPath();
  g.ellipse(x, y, r, r * stretch, 0, 0, TAU);
  g.fill();
  if (r > 1.3 * px) {
    g.fillStyle = css(WATER_LIGHT, al);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.35 * stretch, r * 0.36, 0, TAU);
    g.fill();
  }
}

/** A flat ring of water on the ground at `c`, `rx` by `ry`: a ripple, its rim in `rim`, filled if `fill`. */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, rx: number, ry: number, fill: RGB | null, rim: RGB, al: number, width: number): void {
  if (al <= 0.01 || rx <= 0) return;
  const N = 24;
  g.beginPath();
  for (let q = 0; q <= N; q++) {
    const a = (q / N) * TAU, [x, y] = onScreen(view, [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry, c[2]]);
    if (q) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  if (fill) { g.fillStyle = css(fill, al); g.fill(); }
  if (width > 0) { g.strokeStyle = css(rim, al); g.lineWidth = width; g.stroke(); }
}

/** Where something thrown from `p` going `v` is `t` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, t: number): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * GRAVITY * t * t)];

/** Drops thrown from `from`, `since` seconds after, out and up, falling; each drawn on its side of the body, gone by `life`. */
function splash(g: CanvasRenderingContext2D, view: View, mid: V3, from: V3, since: number, front: boolean, count: number, id: number, speed: number, up: number, size: number, life = 0.55, dir: V3 = [0, 0, 0]): void {
  if (since < 0 || since > life) return;
  for (let q = 0; q < count; q++) {
    const k = id + q * 7, a = jitter(k) * TAU, sp = speed * (0.5 + 0.7 * jitter(k + 1));
    const v: V3 = [Math.cos(a) * sp + dir[0], Math.sin(a) * sp + dir[1], up * (0.6 + 0.7 * jitter(k + 2)) + dir[2]];
    const p = thrown(from, v, since);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    drop(g, x, y, size * (0.7 + 0.6 * jitter(k + 3)), 1 - smooth((since - life * 0.6) / (life * 0.4)), 1.15);
  }
}

/** Ripples spreading on the water at `c` from `since` seconds on: rings going out one after another, fading. */
function ripples(g: CanvasRenderingContext2D, view: View, c: V3, since: number, size: number, rings = 3, k = 1): void {
  if (since < 0) return;
  for (let q = 0; q < rings; q++) {
    const age = (since - q * 0.18) / 0.9;
    if (age < 0 || age >= 1) continue;
    groundRing(g, view, [c[0], c[1], 0.02], size * (0.4 + 1.6 * age), size * (0.32 + 1.3 * age), null, WATER_LIGHT, 0.85 * k * (1 - age), pxOf(g) * 1.3);
  }
}

/**
 * The fishing line, from the pole's tip to its end: straight down while it hangs, out to the water in a sag while it is cast, a
 * thin dark line a pixel wide; each length of it drawn on its side of the body.
 */
function lineOf(g: CanvasRenderingContext2D, view: View, b: Bones, out: number, front: boolean): void {
  const tip = b.lineTip?.t, end = b.lineEnd?.t;
  if (!tip || !end) return;
  const mid = b.chest.t, sag = Math.min(1, out * 1.4) * len3(sub(end, tip)) * 0.22;
  const c: V3 = [(tip[0] + end[0]) / 2, (tip[1] + end[1]) / 2, Math.max(0.03, (tip[2] + end[2]) / 2 - sag)];
  const N = 12, pts: V3[] = [];
  for (let q = 0; q <= N; q++) {
    const u = q / N, w = 1 - u;
    pts.push([w * w * tip[0] + 2 * w * u * c[0] + u * u * end[0], w * w * tip[1] + 2 * w * u * c[1] + u * u * end[1], w * w * tip[2] + 2 * w * u * c[2] + u * u * end[2]]);
  }
  g.save();
  g.strokeStyle = css(LINE_RGB, 0.9);
  g.lineWidth = pxOf(g) * 1.1;
  g.lineCap = 'round';
  for (let q = 0; q < N; q++) {
    if (nearSide(mixV(pts[q], pts[q + 1], 0.5), mid, view) !== front) continue;
    const [x0, y0] = onScreen(view, pts[q]), [x1, y1] = onScreen(view, pts[q + 1]);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  g.restore();
}

/** How big a stage's water is drawn, against the Reeffin's. */
const bigOf = (s: Peng): number => [0.55, 1, 1.4][s.stage];

/**
 * What a go at its task throws. The Finlet's: a splash where its beak goes in, ripples, and drops off the new fish as it shakes
 * it. The Reeffin's: a splash where the line lands, ripples as it waits and as the bite tugs, and a burst as the fish is hauled
 * out, drops falling off it. The Tideharvest's: a splash as the hoop goes in, spray thrown up behind it as it sweeps, and water
 * pouring out of the net as it is lifted.
 */
function workBurst(g: CanvasRenderingContext2D, view: View, s: Peng, b: Bones, t: number, front: boolean): void {
  const W = PENG_WORK, big = bigOf(s), mid = b.chest.t, T = ACT_SECS.work;
  if (s.stage === 0) {
    const tip = place(b.jaw, [0, s.beak.len, 0]), at: V3 = [tip[0], tip[1], 0.04];
    if (!front) ripples(g, view, at, (t - W.dip) * T, 0.18 * big * 2);
    splash(g, view, mid, at, (t - W.dip) * T, front, 9, 3, 0.9 * big, 2.2, 0.03, 0.45);
    if (b.bite) splash(g, view, mid, place(b.bite, [0, s.fish * 0.6, 0]), (t - W.shake + 0.04) * T, front, 7, 41, 1.6 * big, 1.2, 0.025, 0.4);
    return;
  }
  if (s.stage === 1) {
    const end = b.lineEnd?.t;
    if (!end) return;
    const water = waterAt(s);
    if (!front) {
      ripples(g, view, water, (t - W.land) * T, 0.3, 3);
      ripples(g, view, water, (t - W.bite) * T, 0.25, 2);
    }
    splash(g, view, mid, water, (t - W.land) * T, front, 8, 7, 0.8, 2, 0.035, 0.45);
    splash(g, view, mid, water, (t - W.haul) * T, front, 12, 13, 1.2, 3.2, 0.04, 0.6);
    // Drops off the fish as it comes in.
    if (t > W.haul && t < W.haul + 0.25) {
      for (let q = 0; q < 5; q++) {
        const u = frac(t * 6 + q / 5), p: V3 = add(end, [0, 0, -s.fish * (0.6 + 1.4 * u)]);
        if (p[2] < 0 || nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        drop(g, x, y, 0.03, 1 - u, 1.4);
      }
    }
    return;
  }
  // The hoop's foot: where it meets the water.
  const foot = hoopFoot(s, b), low: V3 = [foot[0], foot[1], 0.04];
  const inWater = foot[2] < 0.5 && t > W.into - 0.02 && t < W.sweep + 0.04;
  if (!front) {
    ripples(g, view, low, (t - W.into) * T, 0.5 * big, 3);
    if (inWater) groundRing(g, view, low, 0.35 * big, 0.28 * big, WATER_RGB, WATER_INK, 0.5, pxOf(g));
  }
  splash(g, view, mid, low, (t - W.into) * T, front, 12, 17, 1.2, 2.6, 0.05, 0.5);
  if (inWater) {
    const back = unit(sub(place(b.tool, bagPoint(s, 0.6, 0)), place(b.tool, bagPoint(s, 0, 0))));
    for (let q = 0; q < 4; q++) splash(g, view, mid, low, frac(t * 8 + q * 0.25) * 0.35, front, 3, 29 + q * 11, 0.6, 2.2, 0.035, 0.35, scale(back, 0.6));
  }
  // Water pouring out of the bag as it comes up.
  if (t > W.sweep && t < W.lift + 0.22) {
    const bot = place(b.tool, bagPoint(s, 0.98, 0)), k = 1 - ramp(t, W.lift + 0.1, W.lift + 0.22);
    for (let q = 0; q < 10; q++) {
      const u = frac(t * 5 + q / 10), p: V3 = [bot[0] + (jitter(q) - 0.5) * 0.3, bot[1] + (jitter(q + 4) - 0.5) * 0.3, bot[2] - 0.5 * GRAVITY * (u * 0.45) ** 2];
      if (p[2] < 0.02 || nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      drop(g, x, y, 0.04, k * (1 - u * 0.5), 1.5);
    }
    if (!front) ripples(g, view, [bot[0], bot[1], 0.02], (t - W.sweep - 0.05) * T, 0.4, 2, k);
  }
}

/** What a strike throws: drops off the fish slapped round, a puff where the pole comes down, a splash where the hoop slams. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Peng, b: Bones, t: number, front: boolean): void {
  const since = (t - PENG_HITS[s.stage]) * ACT_SECS.strike, mid = b.chest.t, big = bigOf(s);
  if (since <= 0) return;
  if (s.stage === 0 && b.bite) splash(g, view, mid, place(b.bite, [0, s.fish * 0.7, 0]), since, front, 9, 5, 1.8, 1.6, 0.03, 0.4);
  if (s.stage === 1) splash(g, view, mid, place(b.tool, [0, 0, tipAt(s)]), since, front, 8, 9, 1.2, 1.8, 0.035, 0.4);
  if (s.stage === 2) {
    const foot = hoopFoot(s, b), low: V3 = [foot[0], foot[1], 0.04];
    if (!front) ripples(g, view, low, since, 0.5 * big, 2);
    splash(g, view, mid, low, since, front, 16, 23, 1.6, 3, 0.05, 0.5);
  }
}

/** Evolving: a burst of drops off it, then drops and leaves spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Peng, b: Bones, t: number, front: boolean): void {
  const big = 0.6 + 0.4 * bigOf(s), mid = b.chest.t, T = s.torso;
  if (t < 0.3) splash(g, view, mid, place(b.chest, [0, 0, T.z[4]]), t * ACT_SECS.evolve, front, 14, 5, 1.2 * big, 2.6, 0.035 * big, 0.55);
  const swirl = ramp(t, 0.1, 0.2) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = Math.max(...T.w) * 1.7 + 0.2, high = T.z[T.z.length - 1] + s.high + s.head.up * 2;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32), ang = (q / 18) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const p: V3 = [mid[0] + Math.cos(ang) * rx * kk, mid[1] + Math.sin(ang) * rx * kk, 0.1 + u * high * 0.85];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3 === 0) {
      const c = LEAF_RGB[q % 3], r = 0.08 * big;
      g.fillStyle = css(c, swirl);
      g.strokeStyle = css(mix(c, [40, 50, 30], 0.6), swirl);
      g.lineWidth = Math.max(pxOf(g) * 0.8, r * 0.18);
      g.beginPath();
      g.ellipse(x, y, r, r * 0.45, ang * 2, 0, TAU);
      g.fill();
      g.stroke();
    } else drop(g, x, y, 0.04 * big * (1 - 0.4 * u), swirl * ramp(u, 0, 0.15), 1.1);
  }
}

/** Light over it as it evolves: a pale sea glow as it begins, and over its head at the turn. */
function pengGlow(s: Peng, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], T = s.torso;
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.chest, [0, 0, T.z[4]]), r: T.z[T.z.length - 1] - T.z[0], c: [190, 228, 244], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.head, skullAt(s)), r: (T.z[T.z.length - 1] - T.z[0]) * 1.2, c: [214, 238, 246], a: k });
  return out;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the water it splashes about as it fishes, strikes and evolves. */
function pengKind(s: Peng): Kind {
  const bones = pengBones(s);
  const R = restOf(s);
  const plan = (a: Anim): Plan => planOf(s, R, { ...a, go: a.act ? 0 : a.go });
  return {
    bones,
    build: (lod) => pengBuild(s, lod, plan),
    // The variant's coat is its back, head and flippers, kept deep; its markings the cream of its face and belly. Its orange
    // beak and feet, rosy cheeks, green cape, wicker, rope, straw, blue feather and silver fish are the same on every variant.
    palette: (coat, mark) => {
      const deep = mix(coat, pastel(coat, 225), 0.2), cream = mix([250, 242, 222], pastel(mark, 40), 0.45);
      return coatPalette(coat, mark, {
        coat: deep,
        coatDark: mix(deep, [22, 26, 46], 0.35),
        coatLight: mix(deep, [214, 226, 240], 0.45),
        membrane: mix(deep, [196, 214, 236], 0.3),
        mark: cream,
        belly: cream,
        muzzle: mix(cream, [255, 254, 250], 0.4),
        inner: [246, 168, 158],
        lid: [26, 26, 44],
        eye: [22, 22, 36],
        glint: [255, 255, 255],
        bill: [244, 164, 62],
        billDark: [214, 126, 46],
        claw: [62, 54, 64],
        leaf: [128, 158, 90],
        moss: [156, 174, 100],
        leafDark: [88, 116, 70],
        wood: [204, 160, 100],
        woodDark: [172, 126, 76],
        bark: [116, 82, 54],
        string: [218, 184, 124],
        grip: [168, 128, 82],
        horn: [216, 190, 128],
        hornDark: [176, 148, 92],
        feather: [96, 150, 206],
        featherDark: [62, 102, 160],
        shell: [204, 216, 228],
        shellDark: [138, 160, 184],
        water: [104, 140, 180],
        spot: [246, 249, 252],
        crystal: [126, 192, 226],
        cap: [236, 246, 252],
      }, 225);
    },
    shadow: [Math.max(...s.torso.h) * 1.15 + s.basket.r[1] * 0.4, Math.max(...s.torso.w) * 1.12],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are the sea's pale blue and a leaf's green.
    motes: [[170, 214, 240], [150, 180, 110]],
    glow: (b, a) => pengGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (s.carry === 'pole') lineOf(g, view, b, plan(a).out, front);
      if (act?.kind === 'work') workBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const FINLET = pengKind(FINLET_LOOK);
export const REEFFIN = pengKind(REEFFIN_LOOK);
export const TIDEHARVEST = pengKind(TIDEHARVEST_LOOK);
