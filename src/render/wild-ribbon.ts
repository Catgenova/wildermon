import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, cyc, disc, dot, drift, frac, lerp, LOOP, merge, mix, onEgg, orb, paint,
  scale, shadowOf, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { cut } from './beastkit';
import { HEIGHT_SCALE } from './iso';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The ribbon line: the Ribbonip, a small crouching rat of a thing with big
 * round ears pink inside, a pointed muzzle and dark eyes, its back, head and
 * shoulders shingled in leaf-shaped scales of cream and blue-grey edged in
 * gold, brown forearms and feet with dark claws, a long tail in bands of
 * cream and steel, and a loop of shining ribbon, gold one side and steel the
 * other, held in its forepaws and trailing round it; which grows into the
 * Stripforge, bigger and reared up, a deeper mantle of scales, a ribbon
 * pulled taut between its paws and two more arcing round it; and then the
 * Metallocurl, large and upright, a long pointed snout and tall ears, a
 * great cloak of scales down its back, a brown belly, and huge loops of
 * gold and steel ribbon going round it. The species is still `siffa`
 * underneath, as saves and the database know it: it smiths metal lumps from
 * the settlement's stores into ribbons at the anvils.
 *
 * Each is its variant's coat on its limbs, face and belly fur and its
 * markings on the cream of its scales; the blue-grey scales, the gold, the
 * steel and the ribbons are the same on every variant. All three are built
 * by one set of functions from a description of the stage (`Rib`), the way
 * the penguin line is (`./wild-penguin`): its legs bent to put each foot
 * where it is to be, its forelegs bent to put each paw where it is to be.
 * The Ribbonip scurries on all fours; the Stripforge and the Metallocurl go
 * on their hind legs, reared, the ribbon still in their paws.
 *
 * The ribbons are drawn by hand rather than built (`drawBands`): each a band
 * along a smooth line, flat and two-sided, gold one side or both, twisted
 * about its length, lit as polished metal is -- dark where it mirrors the
 * ground, bright where it mirrors the sky, a glint where it turns to the
 * light -- each length of it drawn under the body where the body hides it
 * and over it where it does not. The loops are coils a little more than a
 * round long, so their ends pass beside each other; they drift round it,
 * rippling, all the while; held, a ribbon runs through its paws, and off
 * them, as it scurries, it is slung over its back.
 *
 * At its task it smiths ribbon from a lump on a small anvil: the Ribbonip
 * pinches the lump and draws a strip up out of it between its paws, and
 * pinches it flat; the Stripforge stretches its ribbon wide and folds it
 * down onto the anvil, flashing; the Metallocurl whips a long ribbon out in
 * a sweeping loop that cracks on the anvil and settles round it into its
 * orbit (`RIB_WORK`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/**
 * A loop of ribbon going round it: a coil of an ellipse, its middle `c` in the body's frame standing, its half-sizes `r`, its
 * plane turned from level by `tilt` (pitch, roll and yaw, degrees); `turns` of a round long, rising `rise` square to its plane
 * from one end to the other, so where it comes round again it passes beside itself rather than through itself; going round
 * `spin` times in a loop of standing (`LOOP`) from `at` (radians); twisting `twist` radians either way about its length as
 * it goes; gold (0) or steel (1).
 */
interface Loop { c: V3; r: [number, number]; tilt: V3; turns: number; rise: number; spin: number; at: number; twist: number; metal: number }

interface Rib {
  stage: 0 | 1 | 2;
  /** How far forward of upright its back is carried, standing and going (degrees); whether it goes on all fours. */
  lean: [number, number];
  fours: boolean;
  /** How high the hips are carried, standing and going. */
  high: [number, number];
  /** The hip on the right in the body's frame; thigh, shin and the ankle's height over the sole; how thick; the foot's length and width; how far out each foot stands and how far ahead of the hip. */
  leg: { at: V3; len: [number, number, number]; w: number; foot: [number, number]; stance: number; ahead: number };
  /** The haunch round each thigh, its half-sizes. */
  haunch: V3;
  /** The body's rings in its own frame, from the rump up the spine: how far up, how far forward, half across and half deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  /** The right shoulder in the body's frame; the upper arm's and the forearm's lengths; how thick; how big a paw. */
  shoulder: V3; arm: [number, number]; armW: number; paw: number;
  /** Where its right paw holds the ribbon standing, in the body's frame; the left is its mirror. */
  grip: V3;
  neck: { at: V3; len: number; w: number };
  /** The skull's half-sizes and how far nose-up it is carried; the snout's length, its radius at the root and how far down it points. */
  head: { r: V3; pitch: number };
  snout: { len: number; r: number; drop: number };
  eye: { dir: V3; size: number };
  /** The ears: how long and how wide, where the right one is on the head, how far splayed out and laid back (degrees). */
  ear: { len: number; w: number; at: V3; out: number; back: number };
  /**
   * The scales: how long one is; how far round from its spine they come (radians) over its shoulders and round its middle; how
   * far out from its body the mantle stands, and how much further its foot flares; how many rows hang below its rump as a
   * cloak; how far each tip lifts off what is under it; how many lie down each upper arm;
   * how many on its crown.
   */
  scale: { len: number; collar: number; cover: number; puff: number; flare: number; tip: number; cloak: number; arm: number; crest: number };
  /**
   * The tail: how many links, how long each, its radius at the root and the tip; in how many links it comes down to the
   * ground from its rump, how far its tip curls up (degrees, more each link of its last few), and how far it turns to its
   * left each link along the ground.
   */
  tail: { links: number; len: number; r: [number, number]; down: number; curl: number; sweep: number };
  /** The ribbon: how wide; the held one's line out from its paws (body frame), each way; and the loops round it. */
  ribbon: number;
  held: { left: V3[]; right: V3[] };
  loops: Loop[];
  /** Where its anvil stands ahead of it, and how big. */
  anvil: { y: number; r: number; h: number };
  gait: {
    /** How much of a stride a foot is down at a walk and a run; how far it swings, as a share of the leg's reach. */
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's reach; how far the hips sink at each footfall; how far it rolls over each foot. */
    step: number; bob: number; roll: number;
  };
  size: number;
}

/** A Ribbonip: small and crouched, a dome of scales, big round ears, a loop of ribbon held in its forepaws and trailing round it. */
const RIBBONIP_LOOK: Rib = {
  stage: 0,
  lean: [68, 76],
  fours: true,
  high: [0.36, 0.3],
  leg: { at: [0.28, 0.0, 0.02], len: [0.2, 0.22, 0.045], w: 0.06, foot: [0.26, 0.11], stance: 0.26, ahead: 0.1 },
  haunch: [0.16, 0.27, 0.24],
  torso: { z: [-0.28, -0.22, -0.06, 0.14, 0.34, 0.52, 0.64, 0.71], y: [0.02, 0, -0.03, -0.05, -0.04, -0.01, 0.02, 0.03], w: [0.2, 0.42, 0.51, 0.53, 0.5, 0.42, 0.3, 0.16], h: [0.18, 0.4, 0.49, 0.51, 0.47, 0.39, 0.28, 0.15] },
  shoulder: [0.22, 0.2, 0.46],
  arm: [0.19, 0.19],
  armW: 0.085,
  paw: 0.075,
  grip: [0.1, 0.74, 0.0],
  neck: { at: [0, 0.07, 0.64], len: 0.07, w: 0.19 },
  head: { r: [0.27, 0.28, 0.25], pitch: 2 },
  snout: { len: 0.25, r: 0.14, drop: 0.08 },
  eye: { dir: [0.6, 0.7, 0.24], size: 0.075 },
  ear: { len: 0.32, w: 0.19, at: [0.17, -0.12, 0.08], out: 30, back: 12 },
  scale: { len: 0.3, collar: 2.3, cover: 2.2, puff: 0.01, flare: 0, tip: 0.08, cloak: 0, arm: 1, crest: 4 },
  tail: { links: 11, len: 0.12, r: [0.065, 0.025], down: 3, curl: 14, sweep: -15 },
  ribbon: 0.11,
  held: {
    left: [[-0.2, 0.8, -0.12], [-0.34, 0.66, -0.3], [-0.46, 0.3, -0.34], [-0.48, -0.1, -0.33], [-0.34, -0.42, -0.34]],
    right: [[0.2, 0.86, -0.1], [0.3, 0.98, -0.28], [0.56, 0.98, -0.34], [0.72, 0.7, -0.3], [0.62, 0.42, -0.22], [0.4, 0.52, -0.3], [0.38, 0.8, -0.34]],
  },
  loops: [],
  anvil: { y: 0.82, r: 0.17, h: 0.22 },
  gait: { duty: [0.55, 0.42], swing: [0.55, 0.6], step: 0.45, bob: 0.05, roll: 4 },
  size: 4.8,
};

/** A Stripforge: bigger and reared up, a deeper mantle, a ribbon taut between its paws and two more arcing round it. */
const STRIPFORGE_LOOK: Rib = {
  stage: 1,
  lean: [46, 50],
  fours: false,
  high: [0.6, 0.58],
  leg: { at: [0.42, 0.06, 0.04], len: [0.34, 0.36, 0.06], w: 0.12, foot: [0.38, 0.18], stance: 0.4, ahead: 0.16 },
  haunch: [0.27, 0.38, 0.35],
  torso: { z: [-0.3, -0.22, -0.04, 0.22, 0.5, 0.76, 0.94, 1.02], y: [0, 0.02, 0.04, 0.05, 0.04, 0.03, 0.04, 0.04], w: [0.18, 0.46, 0.6, 0.63, 0.6, 0.52, 0.4, 0.22], h: [0.18, 0.46, 0.6, 0.63, 0.58, 0.5, 0.38, 0.21] },
  shoulder: [0.38, 0.18, 0.74],
  arm: [0.3, 0.29],
  armW: 0.115,
  paw: 0.11,
  grip: [0.27, 0.98, 0.26],
  neck: { at: [0, 0.12, 0.92], len: 0.12, w: 0.28 },
  head: { r: [0.35, 0.4, 0.31], pitch: -2 },
  snout: { len: 0.42, r: 0.16, drop: 0.1 },
  eye: { dir: [0.6, 0.7, 0.24], size: 0.076 },
  ear: { len: 0.44, w: 0.21, at: [0.2, -0.12, 0.13], out: 26, back: 14 },
  scale: { len: 0.58, collar: 2.6, cover: 2.35, puff: 0.05, flare: 0.1, tip: 0.15, cloak: 1, arm: 2, crest: 5 },
  tail: { links: 12, len: 0.16, r: [0.085, 0.03], down: 3, curl: 14, sweep: -13 },
  ribbon: 0.15,
  held: {
    left: [[-0.5, 1.05, 0.36], [-0.95, 0.8, 0.46], [-1.25, 0.25, 0.6], [-1.22, -0.35, 0.78]],
    right: [[0.5, 1.05, 0.36], [0.95, 0.82, 0.44], [1.28, 0.3, 0.55], [1.26, -0.32, 0.72]],
  },



  loops: [
    { c: [0.18, -1.17, 1.0], r: [0.62, 0.97], tilt: [-25, 15, 0], turns: 1.08, rise: 0.12, spin: 1, at: 0.4, twist: 0.5, metal: 0 },
    { c: [-0.18, -1.12, -0.32], r: [0.75, 0.92], tilt: [8, -12, 20], turns: 1.06, rise: 0.1, spin: -1, at: 2.3, twist: 0.5, metal: 1 },
    { c: [0.97, -0.85, 0.55], r: [0.53, 0.88], tilt: [0, -65, 15], turns: 1.08, rise: 0.12, spin: 1, at: 4.0, twist: 0.5, metal: 0 },
  ],


  anvil: { y: 1.15, r: 0.24, h: 0.34 },
  gait: { duty: [0.6, 0.42], swing: [0.45, 0.5], step: 0.5, bob: 0.06, roll: 5 },
  size: 4.8,
};

/** A Metallocurl: large and upright, a long snout and tall ears, a cloak of scales, and great loops of ribbon going round it. */
const METALLOCURL_LOOK: Rib = {
  stage: 2,
  lean: [24, 30],
  fours: false,
  high: [0.84, 0.82],
  leg: { at: [0.64, 0.1, 0.06], len: [0.46, 0.5, 0.09], w: 0.2, foot: [0.54, 0.26], stance: 0.62, ahead: 0.24 },
  haunch: [0.5, 0.66, 0.6],
  torso: { z: [-0.34, -0.26, -0.04, 0.28, 0.62, 0.94, 1.2, 1.34], y: [0, 0.04, 0.1, 0.13, 0.1, 0.05, 0.02, 0.02], w: [0.26, 0.58, 0.8, 0.95, 0.94, 0.8, 0.56, 0.32], h: [0.26, 0.62, 0.85, 0.95, 0.88, 0.72, 0.52, 0.3] },
  shoulder: [0.6, 0.22, 1.0],
  arm: [0.5, 0.48],
  armW: 0.18,
  paw: 0.17,
  grip: [0.42, 1.0, 0.86],
  neck: { at: [0, 0.2, 1.24], len: 0.22, w: 0.36 },
  head: { r: [0.5, 0.58, 0.43], pitch: -8 },
  snout: { len: 0.76, r: 0.24, drop: 0.12 },
  eye: { dir: [0.58, 0.76, 0.26], size: 0.088 },
  ear: { len: 0.64, w: 0.26, at: [0.26, -0.22, 0.16], out: 22, back: 22 },
  scale: { len: 0.95, collar: 2.5, cover: 2.3, puff: 0.06, flare: 0.14, tip: 0.18, cloak: 2, arm: 3, crest: 6 },
  tail: { links: 13, len: 0.21, r: [0.115, 0.04], down: 3, curl: 14, sweep: -12 },
  ribbon: 0.2,
  held: {
    left: [[-0.8, 1.1, 0.95], [-1.4, 0.85, 1.05], [-1.85, 0.2, 1.2], [-1.85, -0.55, 1.42]],
    right: [[0.8, 1.1, 0.95], [1.4, 0.9, 1.02], [1.88, 0.25, 1.15], [1.9, -0.5, 1.36]],
  },



  loops: [
    { c: [0.28, -1.71, 1.5], r: [0.88, 1.41], tilt: [-25, 15, 0], turns: 1.08, rise: 0.16, spin: 1, at: 0.5, twist: 0.5, metal: 0 },
    { c: [-0.28, -1.62, -0.45], r: [1.06, 1.32], tilt: [10, -15, 20], turns: 1.06, rise: 0.14, spin: -1, at: 2.0, twist: 0.5, metal: 1 },
    { c: [-1.38, -1.26, 0.8], r: [0.79, 1.32], tilt: [0, 70, -15], turns: 1.08, rise: 0.16, spin: 1, at: 3.6, twist: 0.5, metal: 0 },
    { c: [1.38, -1.3, 1.0], r: [0.75, 1.28], tilt: [0, -65, 15], turns: 1.08, rise: 0.16, spin: -1, at: 5.1, twist: 0.5, metal: 1 },
  ],


  anvil: { y: 1.6, r: 0.32, h: 0.48 },
  gait: { duty: [0.62, 0.44], swing: [0.4, 0.45], step: 0.45, bob: 0.06, roll: 5 },
  size: 4.4,
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
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
/** Faces wound so each faces along `want`, whichever way round it was listed. */
function outward(v: readonly V3[], f: Face[], want: V3): Face[] {
  for (const face of f) {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let a = 0; a < idx.length; a++) {
      const p = v[idx[a]], r = v[idx[(a + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) idx.reverse();
  }
  return f;
}

/** The torso's ring at height `z` in its own frame: half across, half deep, and how far forward its middle is. */
function torsoAt(s: Rib, z: number): { w: number; h: number; y: number } {
  const T = s.torso;
  let k = 0;
  while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
  const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
  return { w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f), y: lerp(T.y[k], T.y[k + 1], f) };
}
/** A point on the body's skin at height `z` in its own frame, `a` radians round from its right side (a quarter turn is its belly), lifted `out` off it. */
function onBody(s: Rib, z: number, a: number, out = 0): V3 {
  const r = torsoAt(s, z), d = unit([Math.cos(a) * r.h, Math.sin(a) * r.w, 0]);
  return add([Math.cos(a) * r.w, r.y + Math.sin(a) * r.h, z], scale(d, out));
}
/** The same for a cloak hung from `top` down over the body: never in under the widest it has passed on the way down. */
function onDrape(s: Rib, z: number, top: number, a: number, out = 0): V3 {
  let w = 0, h = 0, y = 0;
  for (let q = 0; q <= 8; q++) {
    const r = torsoAt(s, lerp(top, z, q / 8));
    if (r.w >= w) { w = r.w; h = r.h; y = r.y; }
  }
  const d = unit([Math.cos(a) * h, Math.sin(a) * w, 0]);
  return add([Math.cos(a) * w, y + Math.sin(a) * h, z], scale(d, out));
}
/** The solid of the body in its own frame, a little inside it, for what lies on it to be hidden behind: a stack of eggs following its rings. */
function bodySolid(s: Rib): Array<{ c: V3; r: V3 }> {
  const T = s.torso, z0 = T.z[0], z1 = T.z[T.z.length - 1], H = z1 - z0;
  return [0.2, 0.42, 0.62, 0.8].map((f) => {
    const z = z0 + H * f, r = torsoAt(s, z);
    return { c: [0, r.y, z] as V3, r: [r.w * 0.88, r.h * 0.86, H * 0.24] as V3 };
  });
}
const topOfTorso = (s: Rib): number => s.torso.z[s.torso.z.length - 1];

/* ---- its moves, in time ------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Ribbonip's lash, the Stripforge's two, the Metallocurl's sweep. */
export const RIB_HITS: readonly number[] = [0.48, 0.5, 0.54];
/**
 * A go at its task, as shares of it, by stage. The Ribbonip's: its paws on the lump (`grab`), the strip drawn up out of it
 * until `drawn`, and pinched flat (`pinch`). The Stripforge's: its ribbon stretched wide until `wide`, folded down onto the
 * anvil (`fold`), and stretched again (`again`). The Metallocurl's: drawn back (`back`), whipped out (`whip`), cracking on
 * the anvil (`crack`), and settled into its orbit (`settle`).
 */
export const RIB_WORK = {
  grab: 0.16, drawn: 0.46, pinch: 0.56,
  wide: 0.3, fold: 0.48, again: 0.72,
  back: 0.22, whip: 0.36, crack: 0.46, settle: 0.78,
} as const;

/* ---- poses ------------------------------------------------------------------------------ */

/** A pose: where each ankle is, how the body is carried, its head, ears and tail, its paws, and what its ribbons are doing. */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; roll: number; yaw: number; squash: number;
  /** The back: how far forward of upright (degrees); turned to its left; leant to its right. */
  lean: number; twist: number; tip: number;
  /** The neck bent forward and turned left; the head nose-up, turned left and tilted, against level. */
  neck: number[]; head: V3;
  /** Each ear laid back, left then right. */
  ears: number[];
  /** The tail lifted, swung to its left, and curled, past how it is carried. */
  tail: V3;
  /** Each paw, left then right: where it is in the body's frame, where on the ground, and how much it is on the ground. */
  paw: V3[]; ground: V3[]; down: number[];
  /**
   * The ribbons: how much the held one is in its paws (the rest of the time it is over its shoulders); how far the loops are
   * flung out; how far they are spun on (turns); how far through drawing a strip, folding one, whipping one out, or a lash; and
   * a flash where the metal is worked, and where (body frame).
   */
  hold: number; flare: number; spin: number;
  draw: number; fold: number; whip: number; lash: number;
  flash: number; spark: V3;
  /** The anvil, how much of it is there. */
  anvil: number;
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
  /** Each paw standing, holding the ribbon, in the body's frame. */
  paw: V3[];
}
const rests = new Map<Rib, Rest>();
function restOf(s: Rib): Rest {
  const had = rests.get(s);
  if (had) return had;
  const L = s.leg, ankle: V3[] = [-1, 1].map((sd) => [sd * L.stance, L.ahead, L.len[2]] as V3);
  // The paws held up in front of its chest, a little apart, the ribbon through them.
  const paw: V3[] = [-1, 1].map((sd) => [sd * s.grip[0], s.grip[1], s.grip[2]] as V3);
  const R: Rest = { ankle, reach: L.len[0] + L.len[1], paw };
  rests.set(s, R);
  return R;
}

/** How it stands with nothing going on: crouched on its hind feet, the ribbon in its forepaws. */
function restPlan(s: Rib, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0],
    H: s.high[0], surge: 0, side: 0, roll: 0, yaw: 0, squash: 0,
    lean: s.lean[0], twist: 0, tip: 0,
    neck: [0, 0], head: [0, 0, 0], ears: [0, 0], tail: [0, 0, 0],
    paw: R.paw.map((p) => [...p] as V3), ground: R.paw.map((p) => [p[0], p[1], 0] as V3), down: [0, 0],
    hold: 1, flare: 1, spin: 0, draw: 0, fold: 0, whip: 0, lash: 0, flash: 0, spark: [0, 0, 0], anvil: 0,
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
 * A foot through its stride, `ph` of the way: down and swept back under it at the ground's own speed for `duty`, then lifted
 * and brought forward. Where it is against where it stands, and how far through its swing (nought while down).
 */
function stepOf(ph: number, duty: number, half: number, lift: number): { y: number; z: number; u: number } {
  if (ph < duty) return { y: half * (1 - (2 * ph) / duty), z: 0, u: 0 };
  const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty);
  const y0 = -half - v * EDGE, y1 = half + v * EDGE;
  const y = u < EDGE ? -half - v * u : u > 1 - EDGE ? half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * EDGE), -v * (1 - 2 * EDGE), (u - EDGE) / (1 - 2 * EDGE));
  return { y, z: lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6), u };
}

/**
 * Going. The Ribbonip scurries low on all fours, its back level, a quick trot, its ribbon over its shoulders streaming; the
 * others go reared on their hind legs, rolled a little onto each foot, the ribbon held to their chests in both paws.
 */
function goingPlan(s: Rib, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), p = restPlan(s, R);
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const L = R.reach, half = L * amp, lift = G.step * L * (1 + 0.3 * g);
  p.H = s.high[1];
  p.lean = s.lean[1] + 4 * g;
  for (let i = 0; i < 2; i++) {
    const A = R.ankle[i], st = stepOf(frac(a.u + i * 0.5), duty, half, lift);
    p.at[i] = [A[0], A[1] + st.y, A[2] + st.z];
    p.foot[i] = -18 * Math.sin(Math.PI * clamp(st.u * 1.6)) * (1 - st.u);
  }
  const down = 0.5 + 0.5 * Math.cos(2 * TAU * (w - 0.08));
  p.H += -G.bob * L * 2 * (down - 0.5) + g * L * 0.1 * Math.max(0, Math.sin(2 * TAU * w));
  const over = Math.sin(TAU * (w - 0.2));
  p.roll = G.roll * over;
  p.yaw = 5 * Math.cos(TAU * w);
  p.twist = -p.yaw * 0.6;
  p.head = [3 * (down - 0.5), -p.yaw * 0.5, -p.roll * 0.5];
  p.ears = [8 + 14 * g, 8 + 14 * g];
  p.tail = [6 + 10 * g, 14 * Math.sin(TAU * w), -2];
  if (s.fours) {
    // On all fours: each forepaw on the ground under its shoulder, a half stride from the hind foot on its own side.
    const torso = joint(joint(ROOT, [0, 0, p.H], 0, 0, 0), [0, 0, 0], -p.lean);
    const sh = place(torso, [0, s.shoulder[1], s.shoulder[2]]);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, st = stepOf(frac(a.u + i * 0.5 + 0.5), duty, half, lift * 0.8);
      p.ground[i] = [sd * s.shoulder[0] * 0.8, sh[1] + 0.05 + st.y, s.paw * 0.4 + st.z];
    }
    p.down = [1, 1];
    p.hold = 0;
    p.head = [-8 + 4 * (down - 0.5), p.head[1], p.head[2]];
    p.neck = [-14, 0];
  } else {
    // The paws held to its chest, bobbing with its steps.
    p.paw = p.paw.map((q, i) => add(q, [0, 0.02 * L * Math.sin(TAU * w), 0.03 * L * (down - 0.5) * (i ? 1 : -1)]));
  }
  p.spin = 0.06 * w;
  return p;
}

/** Standing about: breathing, looking about, an ear flicked now and then, its tail swaying, a look down at its ribbon. */
function stillPlan(s: Rib, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, look = drift(t);
  p.lean += 1.5 * (a.breath - 0.5);
  p.neck = [0, 8 * look];
  // Now and then it looks down at the ribbon in its paws, and up again.
  const admire = beat(t, [4.2, 14.6], 2.4);
  p.head = [2 * cyc(t, 4) - 18 * admire, 12 * look * (1 - admire), 4 * drift(t, 3) + 8 * admire];
  p.ears = [26 * beat(t, [2.6, 11.1, 19.4], 0.35), 26 * beat(t, [7.3, 16.2, 21.8], 0.35)];
  p.tail = [2 * cyc(t, 3), 12 * cyc(t, 2) + 6 * cyc(t, 5, 1), 2 * cyc(t, 4)];
  p.H += 0.01 * R.reach * (a.breath - 0.5);
  // The paws turning the ribbon over a little as it looks at it.
  const fidget = beat(t, [9.0, 20.5], 1.6);
  p.paw = p.paw.map((q, i) => add(q, [0, 0.03 * R.reach * fidget, 0.06 * R.reach * fidget * Math.sin(t * TAU * 1.3 + i * Math.PI)]));
  return p;
}

/* ---- its strike ---------------------------------------------------------------------- */

/**
 * A strike: crouched, then lunging in with a lash of ribbon flung out ahead from its right paw, snapping at the hit. The
 * Ribbonip hops in low; the Stripforge rears and comes down on it; the Metallocurl turns into it with a sweep, its loops
 * flung wide.
 */
function strikePlan(s: Rib, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = RIB_HITS[s.stage], L = R.reach;
  const wind = ramp(t, 0.04, 0.32) * (1 - ramp(t, 0.34, hit));
  const blow = ramp(t, 0.34, hit) * (1 - ramp(t, hit + 0.16, 0.96));
  const jolt = hump(t, hit + 0.02, 0.07);
  const A = s.arm[0] + s.arm[1];
  p.H += L * (-0.18 * wind + (s.stage === 0 ? 0.35 : 0.1) * hump(t, (0.34 + hit) / 2, 0.12) - 0.08 * jolt);
  p.surge = L * (s.stage === 0 ? 0.9 : 0.5) * blow;
  p.lean += 8 * wind * (s.stage ? -1 : 1) + 14 * blow;
  p.twist = 22 * wind - 26 * blow;
  p.head = [8 * wind - 6 * blow, -12 * wind + 10 * blow, 0];
  p.ears = [30 * wind + 20 * blow, 30 * wind + 20 * blow];
  p.tail = [14 * wind, 30 * wind - 20 * blow, 0];
  p.squash = 0.06 * jolt;
  // The right paw drawn back and up, then flung forward; the left held to the chest.
  p.paw[1] = add(p.paw[1], [0.3 * A * wind - 0.1 * A * blow, -0.5 * A * wind + 0.6 * A * blow, 0.4 * A * wind + 0.15 * A * blow]);
  p.paw[0] = add(p.paw[0], [-0.1 * A * blow, 0.1 * A * blow, 0]);
  p.lash = ramp(t, 0.3, hit) * (1 - ramp(t, hit + 0.12, 0.95));
  p.hold = 1 - 0.6 * blow;
  p.flare = 1 + 0.25 * wind + (s.stage === 2 ? 0.25 : 0.1) * blow;
  p.spin = (s.stage === 2 ? 0.18 : 0.08) * ramp(t, 0.2, hit + 0.1);
  p.flash = hump(t, hit, 0.06);
  for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 0.6 * blow * ramp(t, hit - 0.05, hit + 0.08), 0]);
  return p;
}

/* ---- its task ------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.92, 1)));

/** The top of its anvil, in the body's frame standing: where the lump is and what is worked on. */
function anvilTop(s: Rib): V3 { return [0, s.anvil.y, s.anvil.h - s.high[0]]; }

/**
 * The Ribbonip's go: it bends to the lump on its anvil and takes it in both paws, draws a strip of ribbon up out of it,
 * stretching, and pinches it flat between its paws with a flash; then lets it go to its loop (`RIB_WORK`).
 */
function drawPlan(s: Rib, R: Rest, t: number, p: Plan): void {
  const W = RIB_WORK, L = R.reach, top = anvilTop(s);
  const bend = ramp(t, 0.02, W.grab) * (1 - ramp(t, W.grab + 0.04, W.drawn));
  const up = ramp(t, W.grab, W.drawn);
  const pinch = hump(t, W.pinch, 0.07);
  const off = ramp(t, W.pinch + 0.08, 0.9);
  p.lean += 18 * bend - 10 * up * (1 - off);
  p.H += L * (-0.12 * bend + 0.08 * up * (1 - off));
  p.head = [-26 * bend + 8 * up * (1 - off) - 10 * pinch, 0, 6 * pinch];
  p.ears = [10 * pinch, 10 * pinch];
  // The paws together on the lump, then drawn up and apart, then pinched together.
  const lump: V3 = add(top, [0, 0, s.paw * 0.8]);
  const held: V3[] = [-1, 1].map((sd) => add(lump, [sd * s.paw * 0.9, -s.paw * 0.4, s.paw * 0.5])) as V3[];
  const lifted: V3[] = R.paw.map((q, i) => add(q, [(i ? 1 : -1) * s.grip[0] * 2.4, -0.02, 0.16 * L])) as V3[];
  const pinched: V3[] = R.paw.map((q, i) => add(q, [(i ? 1 : -1) * -s.grip[0] * 0.4, 0.04, 0.06 * L])) as V3[];
  for (let i = 0; i < 2; i++) {
    const a = mixV(R.paw[i], held[i], ramp(t, 0.02, W.grab) * (1 - up));
    const b = mixV(a, lifted[i], up * (1 - ramp(t, W.drawn, W.pinch)));
    p.paw[i] = mixV(b, pinched[i], ramp(t, W.drawn + 0.02, W.pinch) * (1 - off));
  }
  p.draw = ramp(t, W.grab - 0.04, W.drawn) * (1 - off);
  p.flash = pinch;
  p.spark = mixV(pinched[0], pinched[1], 0.5);
  p.tail = [0, 10 * Math.sin(t * TAU), 0];
}

/**
 * The Stripforge's go: its ribbon stretched wide between its paws, then brought down and folded over onto the anvil with a
 * flash, stretched again and taken back up (`RIB_WORK`).
 */
function foldPlan(s: Rib, R: Rest, t: number, p: Plan): void {
  const W = RIB_WORK, L = R.reach, top = anvilTop(s), A = s.arm[0] + s.arm[1];
  const wide = ramp(t, 0.04, W.wide) * (1 - ramp(t, W.wide + 0.04, W.fold - 0.04)) + ramp(t, W.fold + 0.06, W.again) * (1 - ramp(t, W.again + 0.06, 0.94));
  const down = ramp(t, W.wide + 0.02, W.fold) * (1 - ramp(t, W.fold + 0.06, W.again));
  const press = hump(t, W.fold, 0.05);
  p.lean += 4 * wide + 22 * down;
  p.H += L * (0.04 * wide - 0.16 * down - 0.05 * press);
  p.head = [6 * wide - 24 * down, 0, 0];
  p.ears = [16 * press, 16 * press];
  p.squash = 0.04 * press;
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1;
    const wideAt = add(R.paw[i], [sd * A * 0.8, -0.1 * A, 0.2 * A]);
    const onAnvil = add(top, [sd * s.anvil.r * 0.7, -s.paw * 0.3, s.paw * 0.9 + 0.02]);
    p.paw[i] = mixV(mixV(R.paw[i], wideAt, wide), onAnvil, down);
  }
  p.fold = down;
  p.flare = 1 + 0.1 * wide;
  p.flash = Math.max(press, 0.6 * hump(t, W.again, 0.05));
  p.spark = add(top, [0, 0, 0.04]);
  p.tail = [6 * press, 8 * Math.sin(t * TAU), 0];
}

/**
 * The Metallocurl's go: drawn back with its ribbon gathered, then whipped out ahead in a sweeping loop that cracks on the
 * anvil with a flash and sweeps round it and up, settling into its orbit (`RIB_WORK`).
 */
function whipPlan(s: Rib, R: Rest, t: number, p: Plan): void {
  const W = RIB_WORK, L = R.reach, A = s.arm[0] + s.arm[1];
  const back = ramp(t, 0.04, W.back) * (1 - ramp(t, W.back + 0.02, W.whip));
  const out = ramp(t, W.back + 0.02, W.crack) * (1 - ramp(t, W.crack + 0.1, W.settle));
  const crack = hump(t, W.crack, 0.05);
  p.twist = 26 * back - 20 * out;
  p.lean += -6 * back + 14 * out;
  p.H += L * (0.04 * back - 0.08 * out);
  p.head = [8 * back - 14 * out, 10 * back - 8 * out, 0];
  p.ears = [20 * crack + 10 * out, 20 * crack + 10 * out];
  p.paw[1] = add(p.paw[1], [0.35 * A * back + 0.05 * A * out, -0.35 * A * back + 0.55 * A * out, 0.45 * A * back - 0.15 * A * out]);
  p.paw[0] = add(p.paw[0], [-0.15 * A * back, 0.15 * A * out, 0.1 * A * back]);
  p.whip = ramp(t, W.back, W.settle);
  p.flare = 1 + 0.12 * out;
  p.spin = 0.12 * ramp(t, W.crack, 0.95);
  p.flash = crack;
  p.spark = add(anvilTop(s), [0, 0, 0.04]);
  p.tail = [8 * out, -18 * back + 22 * out, 0];
  for (const i of [0, 1]) p.at[i] = add(p.at[i], [0, L * 0.2 * out * (i ? 1 : 0.4), 0]);
}

/** A go at its task, by stage, eased in from how it stands; the anvil in front of it. */
function workPlan(s: Rib, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R);
  if (s.stage === 0) drawPlan(s, R, t, p);
  else if (s.stage === 1) foldPlan(s, R, t, p);
  else whipPlan(s, R, t, p);
  const out = mixPlan(restPlan(s, R), p, down);
  // The loops drawn in close round it while it works, so the ribbon it works stands clear of them.
  out.flare *= lerp(1, 0.8, down);
  out.anvil = 1;
  return out;
}

/** Feeding where it stands: bent over, nibbling at what is in its paws. */
function grazePlan(s: Rib, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t;
  const nib = Math.max(0, Math.sin(t * TAU * 1.6)) ** 2;
  p.lean += 10;
  p.head = [-24 - 6 * nib, 4 * drift(t, 2), 0];
  p.paw = p.paw.map((q) => add(q, [0, -0.05 * R.reach, 0.12 * R.reach]));
  p.hold = 0.3;
  return p;
}

/** Evolving: hunched as the light gathers, the loops drawn in tight and spun; then drawn up tall at the turn, flung wide, and settled. */
function evolvePlan(s: Rib, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = R.reach, A = s.arm[0] + s.arm[1];
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.74, 0.94));
  const shake = hump(t, 0.7, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.2 * hunch + 0.2 * up);
  p.lean += 16 * hunch - 14 * up;
  p.head = [-16 * hunch + 24 * up, 0, 14 * shake];
  p.ears = [-10 * up + 20 * hunch, -10 * up + 20 * hunch];
  p.roll = 3 * shake;
  p.paw = p.paw.map((q, i) => add(q, [(i ? 1 : -1) * up * 0.5 * A, -0.1 * A * up, up * 0.55 * A - 0.1 * A * hunch]));
  p.flare = 1 - 0.3 * hunch + 0.35 * up;
  p.spin = 0.6 * ramp(t, 0.1, 0.9);
  p.hold = 1 - 0.7 * up;
  p.tail = [20 * up, 10 * shake, 0];
  return p;
}

/** Its pose for what it is doing. */
function planOf(s: Rib, R: Rest, a: Anim): Plan {
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

/** A hind leg bent to put its ankle at `ankle`: the knee forward and out; the foot flat, turned out a little. */
function legOf(s: Rib, body: Xf, i: number, ankle: V3, footPitch: number): [Xf, Xf, Xf] {
  const sd = i ? 1 : -1, L = s.leg, fwd = turn(body, [0, 1, 0]);
  const hip = place(body, [sd * L.at[0], L.at[1], L.at[2]]);
  const { mid: knee, end: at } = bend2(hip, ankle, L.len[0], L.len[1], turn(body, unit([sd * 0.35, 1, 0.1])));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const head = unit([fwd[0] + sd * 0.15 * fwd[1], fwd[1] - sd * 0.15 * fwd[0], 0]);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], head);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], footPitch)];
}

/** The middle of the skull in the head's frame. */
const skullAt = (s: Rib): V3 => [0, 0, s.head.r[2] * 0.55];
/** The tip of the nose in the head's frame. */
function noseAt(s: Rib): V3 {
  const C = skullAt(s);
  return add(C, [0, s.head.r[1] * 0.55 + s.snout.len, -s.snout.drop]);
}

/**
 * The bones of a stage: its pose, the hips raised and carried as it says, the body leant on them, the neck, the head and the
 * ears, the tail in links, each leg bent to put its foot where it is to be, each foreleg bent to put its paw where it is to be,
 * and the anvil before it.
 */
function ribBones(s: Rib): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], 0, P.roll, P.yaw);
    const b: Bones = { body };
    const torso = joint(body, [0, 0, 0], -P.lean, P.tip, P.twist);
    b.torso = torso;
    // The body squashed by a landing, what hangs on it kept its size.
    const q = P.squash, m = torso.m;
    b.trunk = q ? { m: [m[0] * (1 + q * 0.45), m[1] * (1 + q * 0.45), m[2] * (1 - q), m[3] * (1 + q * 0.45), m[4] * (1 + q * 0.45), m[5] * (1 - q), m[6] * (1 + q * 0.45), m[7] * (1 + q * 0.45), m[8] * (1 - q)], t: torso.t } : torso;
    b.neck = joint(torso, s.neck.at, -P.neck[0], 0, P.neck[1]);
    // The head carried level whatever the body does under it, then pitched as the pose says.
    b.head = joint(b.neck, [0, 0, s.neck.len], P.lean + P.neck[0] + s.head.pitch + P.head[0], P.head[2] - P.tip - P.roll, P.head[1]);
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1, E = s.ear;
      b[`ear${k}`] = joint(b.head, [sd * E.at[0], E.at[1], E.at[2] + skullAt(s)[2]], E.back + P.ears[k], sd * E.out, 0);
    }
    // The tail from under its rump: down to the ground behind it in its first few links, then along the ground, curving
    // round to its left and up off it at its tip; swayed, lifted and curled as the pose says.
    const T = s.tail, back = turn(body, [0, -1, 0]);
    let p = place(torso, [0, s.torso.y[0] - s.torso.h[0] * 0.3, s.torso.z[0] + 0.04]), heading = Math.atan2(back[1], back[0]) * (180 / Math.PI) + P.tail[1] * 0.4;
    const z0 = p[2];
    for (let k = 0; k < T.links; k++) {
      const r = lerp(T.r[0], T.r[1], (k + 1) / T.links);
      const tip = Math.max(0, k - (T.links - 4)), lift = T.len * Math.sin((Math.PI / 180) * Math.min(80, P.tail[0] + (T.curl + P.tail[2]) * tip * tip * 0.5));
      const z = (k + 1 < T.down ? lerp(z0, r, smooth((k + 1) / T.down)) : r) + lift * (k + 1 >= T.down ? 1 : 0) + (P.tail[0] > 0 ? T.len * 0.4 * (k / T.links) * Math.sin((P.tail[0] * Math.PI) / 180) : 0);
      if (k) heading += T.sweep + (P.tail[1] * 0.6) / T.links;
      const dz = clamp(z - p[2], -T.len * 0.95, T.len * 0.95), dxy = Math.sqrt(T.len * T.len - dz * dz), hr = (heading * Math.PI) / 180;
      const next: V3 = [p[0] + Math.cos(hr) * dxy, p[1] + Math.sin(hr) * dxy, p[2] + dz];
      const Y = unit(sub(p, next)), X = unit(cross(Y, [0, 0, 1]));
      b[`tail${k}`] = xfOf(X, Y, cross(X, Y), p);
      p = next;
    }
    b.shadow = shadowOf(body, 0);
    for (let i = 0; i < 2; i++) {
      const [u, l, f] = legOf(s, body, i, P.at[i], P.foot[i]);
      const key = i ? 'lr' : 'll';
      b[`${key}0`] = u;
      b[`${key}1`] = l;
      b[`${key}2`] = f;
    }
    // The forelegs: each bent to put its paw where it is to be, the elbow out and back.
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1;
      const sh = place(torso, [sd * s.shoulder[0], s.shoulder[1], s.shoulder[2]]);
      const want = mixV(place(body, P.paw[i]), add(P.ground[i], [P.side, P.surge, 0]), P.down[i]);
      const hint = mixV(turn(torso, unit([sd * 0.7, -0.5, -0.4])), turn(body, unit([sd * 0.3, -1, 0.2])), P.down[i]);
      const { mid: el, end: tip } = bend2(sh, want, s.arm[0], s.arm[1], hint);
      const fwd = turn(body, [0, 1, 0]);
      const [X0, Y0, Z0] = frameOf(sub(sh, el), fwd), [X1, Y1, Z1] = frameOf(sub(el, tip), fwd);
      b[`arm${i}`] = xfOf(X0, Y0, Z0, sh);
      b[`elbow${i}`] = xfOf(X1, Y1, Z1, el);
      // The paw on the ground flat and forward; held up, along the forearm, its palm to the other paw.
      const [X2, Y2, Z2] = frameOf(mixV(sub(el, tip), [0, 0, 1], P.down[i] * 0.8), fwd);
      b[`hand${i}`] = xfOf(X2, Y2, Z2, tip);
    }
    b.anvil = scaled(joint(ROOT, [0, s.anvil.y, 0]), P.anvil);
    return b;
  };
  return (a) => pose(planOf(s, R, { ...a, go: a.act ? 0 : a.go }));
}

/* ---- what it is made of ------------------------------------------------------------- */

/**
 * A scale, a leaf of one lying on a surface: its root at `p`, its face out along `n`, pointing along `d` to its tip `len` from
 * its root, `w` across at its widest; bent to lie along a surface `round` across along it and across it, its tip lifted `tip`
 * of its length off it so the row over it lies on its root, as shingles do. A face in `mat`, a little domed, a narrow rim of
 * gold round it.
 */
function scaleMesh(p: V3, n: V3, d: V3, len: number, w: number, mat: Mat, fine: boolean, round: [number, number] = [Infinity, Infinity], tip = 0.06): Mesh {
  const N = unit(n), D = unit(sub(d, scale(N, dot(d, N)))), X = unit(cross(N, D));
  const half: Array<[number, number]> = fine ? [[0.32, 0.05], [0.5, 0.3], [0.4, 0.6], [0.18, 0.85]] : [[0.48, 0.24], [0.32, 0.64]];
  const outline: Array<[number, number]> = [[0, -0.02], ...half, [0, 1], ...[...half].reverse().map(([x, y]) => [-x, y] as [number, number])];
  const at = (x: number, y: number, up: number): V3 => {
    const a = y * len, c = x * w, sag = (a * a) / (2 * round[0]) + (c * c) / (2 * round[1]);
    return add(add(add(p, scale(D, a)), scale(X, c)), scale(N, up - sag + tip * y * y * len - 0.01 * len));
  };
  const v: V3[] = [];
  for (const [x, y] of outline) v.push(at(x, y, 0));
  for (const [x, y] of outline) v.push(at(x * 0.84, 0.36 + (y - 0.36) * 0.88, 0.03 * len));
  const K = outline.length, f: Face[] = [{ i: Array.from({ length: K }, (_, k) => K + k), m: mat }];
  for (let k = 0; k < K; k++) f.push({ i: [k, (k + 1) % K, K + (k + 1) % K, K + k], m: 'bloom' });
  return mesh(v, outward(v, f, N));
}

/** A leaf of a scale's outline, root to tip: half its width at each share of its length. */
const LEAF_FINE: ReadonlyArray<[number, number]> = [[0.3, 0.02], [0.5, 0.28], [0.44, 0.58], [0.22, 0.84]];
const LEAF: ReadonlyArray<[number, number]> = [[0.48, 0.22], [0.3, 0.66]];

/**
 * A scale laid on the body itself rather than flat over it: its root `z0` up the spine and `a0` round from its right side, its
 * tip `len` down toward its rump, `w` across; every corner of it put on the skin where it falls, lifted `lift` off it and its
 * tip `tip` of its length further, so it follows the round of the body both ways and never stands out of its outline. Below
 * `drape` it hangs from there as a cloak does (`onDrape`). Its face in `mat`, a little raised, a narrow rim of gold round it.
 */
function bodyScale(s: Rib, z0: number, a0: number, len: number, w: number, lift: number, tip: number, mat: Mat, fine: boolean, drape: number): Mesh {
  const half = fine ? LEAF_FINE : LEAF;
  const outline: Array<[number, number]> = [[0, -0.02], ...half, [0, 1], ...[...half].reverse().map(([x, y]) => [-x, y] as [number, number])];
  const at = (x: number, y: number, up: number): V3 => {
    const z = z0 - y * len, r = torsoAt(s, Math.max(z, drape)), a = a0 + (x * w) / Math.max(0.02, (r.w + r.h) * 0.5);
    const o = lift + up + tip * y * y * len;
    return z < drape ? onDrape(s, z, drape, a, o) : onBody(s, z, a, o);
  };
  const v: V3[] = [];
  for (const [x, y] of outline) v.push(at(x, y, 0));
  for (const [x, y] of outline) v.push(at(x * 0.84, 0.32 + (y - 0.32) * 0.88, 0.012 * len));
  const K = outline.length, f: Face[] = [{ i: Array.from({ length: K }, (_, k) => K + k), m: mat }];
  for (let k = 0; k < K; k++) f.push({ i: [k, (k + 1) % K, K + (k + 1) % K, K + k], m: 'bloom' });
  const mid = at(0, 0.4, 0), r = torsoAt(s, Math.max(z0, drape));
  return mesh(v, outward(v, f, unit(sub(mid, [0, r.y, Math.max(z0 - 0.4 * len, drape)]))));
}

/**
 * Whether a scale is blue-grey rather than cream, by its row and how far it is from its spine (`k` scales either way): the
 * same either side, cream down its spine, mostly blue-grey on its upper flanks, and cream and blue-grey together lower down.
 */
function bluish(row: number, k: number, side: number, stage: number): boolean {
  if (k === 0) return false;
  const h = jitter(row * 13 + k * 5 + 1) - 0.1 * stage;
  return side < 0.6 ? h < 0.55 : h < 0.25;
}

/**
 * The scales over its back, in the torso's frame: rows from its neck down to its rump, shingled, each pointing down toward
 * its tail and each row lying over the roots of the one under it; round its sides as far as its cover, leaving its belly bare,
 * smaller where the body narrows; and, on the bigger stages, rows hanging below its rump as a cloak down the back of its legs,
 * flaring.
 */
function scalesOf(s: Rib, fine: boolean): Mesh[] {
  const S = s.scale, T = s.torso, out: Mesh[] = [];
  const top = topOfTorso(s) - S.len * 0.1, end = T.z[0] + S.len * 0.05, step = S.len * 0.4;
  const widest = Math.max(...T.w.map((w, q) => (w + T.h[q]) * 0.5));
  const body = Math.max(2, Math.round((top - end) / step)), rows = body + S.cloak;
  const drape = S.cloak ? T.z[1] + S.len * 0.1 : -Infinity;
  for (let row = 0; row < rows; row++) {
    const z = top - row * step, f = row / Math.max(1, rows - 1), line: Mesh[] = [];
    const r = torsoAt(s, Math.max(z, drape)), round = (r.w + r.h) * 0.5;
    // Smaller where the body narrows, at its shoulders and its rump, and smaller toward its neck.
    const len = S.len * clamp(0.45 + 0.75 * (round / widest), 0.55, 1) * lerp(0.62, 1, smooth(f / 0.45)) * (z < drape ? 1.15 : 1);
    const w = len * 0.62;
    // Round its shoulders nearly to the front of them, a collar under its chin; round its sides to its cover.
    // Less far round its sides low down on the bigger stages, so its haunches show under the mantle; below its rump, a cloak
    // hanging down behind its legs rather than round them.
    const cover = lerp(S.collar, S.cover, smooth(f / 0.35)) * lerp(1, [1, 0.86, 0.74][s.stage], smooth((f - 0.45) / 0.4)) * (z < drape ? 0.8 : 1);
    const count = Math.max(1, Math.round((round * cover * 2) / (w * 0.95)));
    const lift = 0.006 + S.puff * Math.sin(Math.PI * clamp(f * 1.2)) + S.flare * smooth((z < drape ? drape - z : 0) / S.len) + 0.01 * (1 - f);
    for (let k = 0; k < count; k++) {
      // Every other row set over by half a scale, so each lies over the join of the two under it.
      const c = k - (count - 1) / 2 + (row % 2 ? 0.25 : -0.25) * (count > 1 ? 1 : 0);
      const a = -Math.PI / 2 + (c / Math.max(1, count / 2)) * cover;
      const side = Math.abs(a + Math.PI / 2) / cover;
      const kk = Math.round(Math.abs(c));
      line.push(bodyScale(s, z, a, len * (0.94 + 0.12 * jitter(row * 7 + kk)), w, lift, S.tip, bluish(row, kk, side, s.stage) ? 'shell' : 'mark', fine, drape));
    }
    out.push(merge(...line));
  }
  return out;
}

/** Scales down the outside of an upper arm, in its bone's frame (down `-z`, forward `y`): the mantle over its shoulder, in rows. */
function armScalesOf(s: Rib, fine: boolean, side: number): Mesh {
  const out: Mesh[] = [], rows = s.scale.arm, L = s.arm[0], len = s.scale.len * 0.72;
  const around = fine ? [-0.95, -0.25, 0.45, 1.15] : [-0.7, 0.2, 1.0];
  for (let r = 0; r < rows; r++) {
    const z = -L * (r / Math.max(1, rows)) * 0.85 + s.armW * 0.6;
    around.forEach((a0, k) => {
      const a = a0 + (r % 2 ? 0.32 : 0);
      const nrm = unit([side * Math.cos(a), Math.sin(a), 0.15]);
      const root = add([0, 0, z], scale(nrm, s.armW * (1.25 - 0.2 * r / rows)));
      out.push(scaleMesh(root, nrm, [0, 0, -1], len * (1 - 0.1 * r / rows), len * 0.46, (k + r) % 3 === 1 ? 'shell' : 'mark', fine, [Infinity, s.armW * 1.4], s.scale.tip));
    });
  }
  return merge(...out);
}

/** The haunch over a thigh, in its bone's frame: a big round of fur. */
const haunchAt = (s: Rib): V3 => [0, -s.leg.len[0] * 0.05, -s.leg.len[0] * 0.38];

/** On the bigger stages, a few scales over the top of a haunch, in the thigh's frame. */
function haunchScalesOf(s: Rib, fine: boolean, side: number): Mesh {
  const H = s.haunch, c = haunchAt(s), out: Mesh[] = [];
  const count = [3, 4, 5][s.stage];
  for (let q = 0; q < count; q++) {
    const a = -0.9 + (q / Math.max(1, count - 1)) * 1.6;
    const dir: V3 = [side * Math.cos(a) * 0.9, -Math.sin(a) * 0.6 - 0.2, 0.55 - 0.15 * Math.abs(a)];
    const e = onEgg(c, H, dir);
    out.push(scaleMesh(add(e.p, scale(e.n, 0.01)), e.n, [side * 0.1, -0.3, -1], s.scale.len * 0.7, s.scale.len * 0.34, q % 2 ? 'shell' : 'mark', fine, [H[2], H[0]], s.scale.tip));
  }
  return merge(...out);
}

/** The torso, in its own frame from the rump up the spine: fur, the coat on its back and the paler fur of its belly in front. */
function torsoOf(s: Rib, n: number): Mesh {
  const T = s.torso;
  const body = tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n + 6, 'coat', { up: [0, 1, 0] });
  return painted(body, (c) => {
    const r = torsoAt(s, c[2]);
    const a = Math.atan2((c[1] - r.y) / Math.max(1e-3, r.h), c[0] / Math.max(1e-3, r.w));
    return Math.abs(a - Math.PI / 2) < 1.05 ? 'belly' : 'coat';
  });
}

/**
 * The eyes: each a dark rim, a big glossy dark eye and two glints, laid onto the skull's own curve; all of an eye out of sight
 * together when the head is between it and the viewer.
 */
function eyesOf(s: Rib, shut: boolean): Mesh {
  const E = s.eye, C = skullAt(s), R = s.head.r, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onEgg(C, R, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.008)), at = add(p, scale(n, -0.06 * Math.min(...R)));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.1, r * 0.3, 8, 'lid', o), 0.014));
      continue;
    }
    // A lid's line over it, tilted toward its nose, which is what gives a narrow face its keen look.
    out.push(onto(disc(add(p, scale(up, r * 0.08)), n, r * 1.3, r * 1.08, 12, 'lid', { ...o, spin: side * 0.25 }), 0.012));
    out.push(onto(disc(p, n, r, r * 0.94, 12, 'eye', o), 0.016));
    out.push(onto(disc(add(add(p, scale(up, r * 0.34)), scale(across, side * r * 0.28)), n, r * 0.38, r * 0.38, 6, 'glint', { ...o, lit: true }), 0.024));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.42)), scale(across, -side * r * 0.3)), n, r * 0.15, r * 0.15, 5, 'glint', { ...o, lit: true }), 0.024));
  }
  return paint(out);
}

/** The head: a round skull in the tan of its face, a pointed muzzle paler under, a pink nose at its tip, big dark eyes. */
function headOf(s: Rib, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), R = H.r, S = s.snout;
  const skull = painted(orb(C, R, n + 4, k + 2, 'coatLight'), (c) => (c[2] < C[2] - R[2] * 0.1 && c[1] > C[1] - R[1] * 0.1 ? 'muzzle' : 'coatLight'));
  const tip = noseAt(s), root = add(C, [0, R[1] * 0.25, -R[2] * 0.12]);
  const along = (u: number): V3 => add(mixV(root, tip, u), [0, 0, S.drop * 0.3 * Math.sin(Math.PI * u) * 0.5]);
  const muzzle = painted(tube([along(0), along(0.35), along(0.7), along(0.94)], [S.r, S.r * 0.78, S.r * 0.5, S.r * 0.22], [S.r * 0.92, S.r * 0.72, S.r * 0.46, S.r * 0.2], n, 'coatLight', { up: [0, 0, 1] }),
    (c) => (c[2] < lerp(root[2], tip[2], clamp((c[1] - root[1]) / (tip[1] - root[1]))) + S.r * 0.1 ? 'muzzle' : 'coatLight'));
  const nose = egg(add(tip, [0, -S.r * 0.12, 0]), UPRIGHT, [S.r * 0.32, S.r * 0.26, S.r * 0.24], 6, 3, 'nose');
  return merge(skull, muzzle, nose, eyesOf(s, shut));
}

/**
 * The cap, in the head's frame: cream scales over its crown, laid over the skull as a piece of their own so the skull's big
 * facets never come over them.
 */
function capOf(s: Rib, fine: boolean): Mesh {
  const C = skullAt(s), R = s.head.r, S = s.snout;
  const tip = noseAt(s), root = add(C, [0, R[1] * 0.25, -R[2] * 0.12]);
  const along = (u: number): V3 => add(mixV(root, tip, u), [0, 0, S.drop * 0.3 * Math.sin(Math.PI * u) * 0.5]);
  // The cap: scales over its crown in rows from just over its eyes back to its neck, one, then two, then three across, each
  // row lying over the root of the one behind it, the ears coming up out of them; on the bigger stages a few more up the
  // bridge of its snout.
  const crest: Mesh[] = [], rows = s.scale.crest, Lh = R[1] * 0.6;
  for (let q = 0; q < rows; q++) {
    const f = q / Math.max(1, rows - 1), th = lerp(0.42, 2.2, f), lift = 0.004 + 0.01 * (1 - f);
    const across = q === 0 ? [0] : q % 2 ? [-0.45, 0.45] : [-0.85, 0, 0.85];
    for (const x of across) {
      const spread = lerp(0.42, 0.78, f);
      const dir: V3 = [x * spread, Math.cos(th), Math.sin(th) * (1 - 0.2 * Math.abs(x))];
      const e = onEgg(C, R, dir), back = onEgg(C, R, [x * spread * 1.15, Math.cos(th + 0.6), Math.sin(th + 0.6)]);
      const len = Lh * lerp(0.9, 1.15, f) * (1 - 0.12 * Math.abs(x));
      crest.push(scaleMesh(add(e.p, scale(e.n, lift)), e.n, sub(back.p, e.p), len, len * 0.78, x && jitter(q * 3 + x * 7) < 0.4 ? 'shell' : 'mark', fine, [R[1], R[0]], 0.05));
    }
  }
  for (let q = 0; q < s.stage; q++) {
    const u = 0.5 - 0.28 * q, at = along(u), r = S.r * (0.85 - 0.3 * u);
    crest.push(scaleMesh(add(at, [0, 0, r * 0.82]), [0, -0.1, 1], [0, -1, 0.18], Lh * (0.55 + 0.1 * q), Lh * 0.32, 'mark', fine, [Infinity, r]));
  }
  return merge(...crest);
}

/** An upper arm or a forearm, in its bone's frame down from its joint: a soft tube of brown fur, fuller at the top. */
function limbOf(L: number, w: number, n: number, mat: Mat, upper: boolean): Mesh {
  return tube([[0, 0, w * 0.4], [0, 0, -L * 0.5], [0, 0, -L - w * 0.2]], upper ? [w * 1.25, w * 1.1, w * 0.9] : [w * 0.95, w * 0.85, w * 0.8], upper ? [w * 1.2, w * 1.05, w * 0.88] : [w * 0.92, w * 0.82, w * 0.76], n, mat, { seam: 'start' });
}

/** A forepaw, in its bone's frame from the wrist: a small dark round of a hand and four dark claws curled forward. */
function pawOf(s: Rib, n: number, k: number): Mesh {
  const r = s.paw, out: Mesh[] = [egg([0, r * 0.15, -r * 0.55], UPRIGHT, [r * 0.85, r * 0.7, r * 0.75], n - 2, k, 'coatDark')];
  for (let q = 0; q < 4; q++) {
    const x = (q - 1.5) * r * 0.4, root: V3 = [x, r * 0.45, -r * 0.95];
    out.push(taper([root, add(root, [x * 0.1, r * 0.35, -r * 0.3]), add(root, [x * 0.15, r * 0.4, -r * 0.62])], r * 0.15, 0.006, 4, 'claw'));
  }
  return merge(...out);
}

/** A hind foot, in its bone's frame from the ankle: a long brown foot flat on the ground, four toes forward with dark claws. */
function footOf(s: Rib, n: number): Mesh {
  const [fl, fw] = s.leg.foot, drop = s.leg.len[2], out: Mesh[] = [];
  out.push(tube([[0, -fl * 0.12, -drop + fw * 0.3], [0, fl * 0.25, -drop + fw * 0.28], [0, fl * 0.62, -drop + fw * 0.22]], [fw * 0.36, fw * 0.48, fw * 0.5], [fw * 0.3, fw * 0.3, fw * 0.24], n, 'coatDark'));
  for (let q = 0; q < 4; q++) {
    const sp = (q - 1.5) * 0.32, d = unit([sp, 1, 0]), root: V3 = [sp * fw * 0.5, fl * 0.6, -drop + fw * 0.16];
    const tip = add(root, scale(d, fl * 0.22));
    out.push(tube([root, tip], [fw * 0.12, fw * 0.1], [fw * 0.1, fw * 0.08], 5, 'coatDark'));
    out.push(taper([tip, add(tip, add(scale(d, fw * 0.28), [0, 0, -fw * 0.1]))], fw * 0.08, 0.004, 4, 'claw'));
  }
  return merge(...out);
}

/** A link of the tail, built pointing back along `-y` from its joint: a ring of armour, flared at its root where a gold band rims it, cream or steel by turns. */
function tailLink(r0: number, r1: number, len: number, n: number, q: number): Mesh {
  const main: Mat = q % 2 ? 'metal' : 'mark';
  return tube([[0, 0.04 * len, 0], [0, -0.1 * len, 0], [0, -0.22 * len, 0], [0, -len * 1.02, 0]], [r0 * 1.08, r0 * 1.12, r0 * 1.02, r1], [r0 * 1.04, r0 * 1.08, r0 * 0.98, r1 * 0.96], n, (ring) => (ring === 0 ? 'bloom' : main));
}

/**
 * The anvil, in its own frame from the ground under its middle, its length across: a dark iron foot, a waist, a squared top
 * with its face bright, a horn out to the right, and a lump of gold on it for the Ribbonip to draw a strip out of.
 */
function anvilOf(s: Rib, n: number): Mesh {
  const A = s.anvil, r = A.r, h = A.h;
  const foot = tube([[0, 0, 0], [0, 0, h * 0.22]], [r * 1.05, r * 0.8], [r * 0.7, r * 0.5], 4, 'metalDark', { turn: 0.5 });
  const waist = tube([[0, 0, h * 0.2], [0, 0, h * 0.72]], [r * 0.62, r * 0.75], [r * 0.42, r * 0.5], 4, 'metalDark', { turn: 0.5 });
  const top = tube([[0, 0, h * 0.7], [0, 0, h]], r * 1.25, r * 0.62, 4, (ring) => (ring ? 'metal' : 'metalDark'), { turn: 0.5 });
  const horn = taper([[r * 0.85, 0, h * 0.86], [r * 1.5, 0, h * 0.9], [r * 2.0, 0, h * 0.96]], r * 0.3, 0.015, 5, 'metal', 0.9);
  const lump = egg([0, 0, h + r * 0.14], UPRIGHT, [r * 0.36, r * 0.3, r * 0.18], n - 2, 3, 'bloom');
  return merge(foot, waist, top, horn, s.stage === 0 ? lump : null);
}

/** Solids inside the head that hide what is round the far side of them: the skull. */
const headSolids = (s: Rib): Array<{ c: V3; r: V3 }> => [{ c: skullAt(s), r: scale(s.head.r, 0.8) }];

/** A stage's pieces. */
function ribBuild(s: Rib, lod: number, bones: (a: Anim) => Bones, plan: (a: Anim) => Plan): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), fine = lod > 0, pieces: Piece[] = [];
  const hide = headSolids(s), body = bodySolid(s);
  pieces.push({ key: 'torso', mesh: torsoOf(s, n), bone: 'trunk', bias: 0, breathes: { c: [0, 0, s.torso.z[3]], k: 0.035 } });
  // The scales a row to a piece, each row over the one under it toward its rump, so a row lies on the roots of the next.
  const rows = scalesOf(s, fine);
  rows.forEach((m, q) => pieces.push({ key: `scales${q}`, mesh: m, bone: 'torso', bias: 0.02, after: q < rows.length - 1 ? ['torso', `scales${q + 1}`] : 'torso', hide: body }));
  pieces.push({ key: 'neck', mesh: tube([[0, 0, -0.1], [0, 0.01, s.neck.len + 0.05]], s.neck.w, s.neck.w * 0.92, n, 'coatLight'), bone: 'neck', bias: 0, under: 'head' });
  pieces.push({ key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide });
  pieces.push({ key: 'cap', mesh: capOf(s, fine), bone: 'head', bias: 0.205, after: 'head', hide });
  const ear = moved0(earOf(s.ear.len, s.ear.w, n), -12);
  pieces.push(
    { key: 'ear0', mesh: mirror(ear), bone: 'ear0', bias: 0.21, after: 'head', hide, hideIn: 'head' },
    { key: 'ear1', mesh: ear, bone: 'ear1', bias: 0.21, after: 'head', hide, hideIn: 'head' },
  );
  // The tail in links, cream and steel by turns, tapering.
  const T = s.tail;
  for (let q = 0; q < T.links; q++) {
    const r0 = lerp(T.r[0], T.r[1], q / T.links), r1 = lerp(T.r[0], T.r[1], (q + 1) / T.links);
    pieces.push({ key: `tail${q}`, mesh: tailLink(r0, r1, T.len, n, q), bone: `tail${q}`, bias: -0.05 + q * 0.002, chain: 'tail' });
  }
  // Hind legs: a big haunch round the thigh, a short shin, a long foot.
  const L = s.leg;
  for (const [key, side] of [['ll', -1], ['lr', 1]] as Array<[string, number]>) {
    pieces.push(
      { key: `${key}0`, mesh: egg(haunchAt(s), UPRIGHT, s.haunch, n + 2, k + 1, 'coat'), bone: `${key}0`, bias: 0.01, after: 'torso', front: [side, 0.3, 0] },
      { key: `${key}1`, mesh: tube([[0, 0, L.w * 0.5], [0, 0.005, -L.len[1]]], [L.w, L.w * 0.8], [L.w * 1.1, L.w * 0.85], n, 'coat', { seam: 'start' }), bone: `${key}1`, bias: 0.015, after: ['torso', `${key}0`], front: [0, 1, 0] },
      { key: `${key}2`, mesh: side < 0 ? mirror(footOf(s, n)) : footOf(s, n), bone: `${key}2`, bias: 0.02, after: ['torso', `${key}1`], front: [0, 1, 0] },
    );
    pieces.push({ key: `hscale${key}`, mesh: haunchScalesOf(s, fine, side), bone: `${key}0`, bias: 0.012, after: ['torso', `${key}0`], front: [side, 0.3, 0], hide: [{ c: haunchAt(s), r: scale(s.haunch, 0.85) }] });
  }
  // Forelegs: brown fur, scales over the shoulder, a dark paw.
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1, out: V3 = [side, 0.3, 0];
    pieces.push(
      { key: `arm${i}`, mesh: limbOf(s.arm[0], s.armW, n, 'coat', true), bone: `arm${i}`, bias: 0.05, after: ['torso', 'scales0'], front: out },
      { key: `ascale${i}`, mesh: armScalesOf(s, fine, side), bone: `arm${i}`, bias: 0.052, after: ['torso', 'scales0', `arm${i}`], front: out, hide: [{ c: [0, 0, -s.arm[0] * 0.45], r: [s.armW, s.armW, s.arm[0] * 0.6] }] },
      { key: `fore${i}`, mesh: limbOf(s.arm[1], s.armW, n, 'coat', false), bone: `elbow${i}`, bias: 0.055, after: ['torso', 'scales0', `arm${i}`], front: out },
      { key: `paw${i}`, mesh: pawOf(s, n, k), bone: `hand${i}`, bias: 0.06, after: ['torso', `fore${i}`], front: out },
    );
  }
  pieces.push({ key: 'anvil', mesh: anvilOf(s, n), bone: 'anvil', bias: 0.1, shown: (a) => a.act?.kind === 'work' });
  // Where the ribbons reach, standing, as corners with no faces: so whatever frames it takes them in too.
  pieces.push({ key: 'reach', mesh: mesh(reachOf(s, bones, plan), []), bone: 'body', bias: 0 });
  return pieces;
}

/** An ear, built upright from its root facing forward: a big rounded leaf, a little pointed, cupped back, pink inside. */
function earOf(len: number, w: number, n: number): Mesh {
  const pts: V3[] = [0, 0.2, 0.42, 0.64, 0.84, 1].map((u) => [0, -0.12 * w * Math.sin(Math.PI * u), u * len] as V3);
  return merge(
    tube(pts, [w * 0.5, w * 0.9, w, w * 0.92, w * 0.62, w * 0.08], w * 0.22, n, 'coatLight', { up: [0, 1, 0], seam: 'start' }),
    paint([disc([0, w * 0.2, len * 0.5], [0, 1, 0], w * 0.66, len * 0.36, 9, 'inner')]),
  );
}

/** A mesh turned about its upright, in degrees. */
const moved0 = (m: Mesh, yaw: number): Mesh => {
  const c = Math.cos((yaw * Math.PI) / 180), si = Math.sin((yaw * Math.PI) / 180);
  return mesh(m.v.map((p) => [p[0] * c - p[1] * si, p[0] * si + p[1] * c, p[2]] as V3), m.f);
};

/* ---- the ribbons ---------------------------------------------------------------------------- */

/** A ribbon as it is this moment: its middle line, the way its face is turned at each point, how wide there, and its metal each side. */
interface Band { pts: V3[]; face: V3[]; w: number[]; metal: [number, number] }

/**
 * Gold and steel, each in the three steps a wildermon is lit in (`toonTone` in `./figure`) -- in shade, in the middle, in
 * the light -- the glint where it mirrors the light, and the ink round it.
 */
const METALS: ReadonlyArray<{ shade: RGB; mid: RGB; lit: RGB; glint: RGB; ink: RGB }> = [
  { shade: [170, 118, 56], mid: [222, 168, 84], lit: [248, 212, 136], glint: [255, 248, 218], ink: [92, 56, 22] },
  { shade: [112, 120, 140], mid: [162, 171, 188], lit: [204, 211, 224], glint: [246, 248, 252], ink: [48, 54, 72] },
];

/** A smooth line through points (Catmull-Rom), `per` to each span: the held ribbon's line through its paws. */
function smoothLine(keys: readonly V3[], per: number): V3[] {
  const out: V3[] = [];
  for (let q = 0; q < keys.length - 1; q++) {
    const p0 = keys[Math.max(0, q - 1)], p1 = keys[q], p2 = keys[q + 1], p3 = keys[Math.min(keys.length - 1, q + 2)];
    for (let k = 0; k < per; k++) {
      const u = k / per, u2 = u * u, u3 = u2 * u;
      out.push([0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3)) as V3);
    }
  }
  out.push(keys[keys.length - 1]);
  return out;
}

/** `v` turned about the unit axis `d` by `a` radians. */
const turned = (v: V3, d: V3, a: number): V3 => add(add(scale(v, Math.cos(a)), scale(cross(d, v), Math.sin(a))), scale(d, dot(d, v) * (1 - Math.cos(a))));

/**
 * The way a band's face is turned along a line, starting from `first` and carried along it with as little turn as it can
 * (each point's the last one's, squared to the line there), then twisted about the line by `twist` of the way along it: so
 * a band lying on edge round a loop stays on edge, and only turns over where it is twisted.
 */
function facesAlong(pts: readonly V3[], first: V3, twist: (u: number) => number): V3[] {
  const n = pts.length, out: V3[] = [];
  let f = first;
  for (let q = 0; q < n; q++) {
    const d = unit(sub(pts[Math.min(n - 1, q + 1)], pts[Math.max(0, q - 1)]));
    const sq = sub(f, scale(d, dot(f, d)));
    f = len3(sq) > 1e-5 ? unit(sq) : f;
    out.push(turned(f, d, twist(q / Math.max(1, n - 1))));
  }
  return out;
}

/** How wide a band is along it: its full width, narrowing to a curl at either free end. */
const widthsOf = (n: number, w: number, ends: [boolean, boolean]): number[] =>
  Array.from({ length: n }, (_, q) => {
    const u = q / Math.max(1, n - 1);
    return w * (ends[0] ? 0.35 + 0.65 * smooth(u / 0.1) : 1) * (ends[1] ? 0.35 + 0.65 * smooth((1 - u) / 0.1) : 1);
  });

/**
 * A loop going round it, in the body's frame: a coil of an ellipse on its plane, sliding round it on the clock and on `spin`,
 * its ellipse breathing and rippling a little; its face turned out from its middle, twisting as it goes.
 */
function loopBand(L: Loop, t: number, flare: number, spin: number, N: number, w: number, lift: number): Band {
  const pts: V3[] = [];
  const th = L.at + (L.spin * TAU * t) / LOOP + spin * TAU * Math.sign(L.spin || 1);
  const [p, r, y] = L.tilt.map((d) => (d * Math.PI) / 180);
  const orient = (v: V3): V3 => {
    const a: V3 = [v[0], v[1] * Math.cos(p) - v[2] * Math.sin(p), v[1] * Math.sin(p) + v[2] * Math.cos(p)];
    const b: V3 = [a[0] * Math.cos(r) + a[2] * Math.sin(r), a[1], -a[0] * Math.sin(r) + a[2] * Math.cos(r)];
    return [b[0] * Math.cos(y) - b[1] * Math.sin(y), b[0] * Math.sin(y) + b[1] * Math.cos(y), b[2]];
  };
  const r0 = L.r[0] * flare * (1 + 0.035 * cyc(t, 3, L.at)), r1 = L.r[1] * flare * (1 + 0.035 * cyc(t, 2, L.at + 1));
  const c = add(L.c, [0, 0, lift]);
  for (let k = 0; k <= N; k++) {
    const u = k / N, ph = th + u * L.turns * TAU;
    const wob = (u - 0.5) * L.rise + 0.05 * Math.min(r0, r1) * Math.sin(2 * ph + cyc(t, 2, L.at) * 1.2);
    pts.push(add(c, orient([Math.cos(ph) * r0, Math.sin(ph) * r1, wob])));
  }
  const first = orient(unit([Math.cos(th) / r0, Math.sin(th) / r1, 0]));
  const face = facesAlong(pts, first, (u) => L.twist * Math.sin(u * L.turns * TAU * 1.5 + cyc(t, 4, L.at) * 1.4 + L.at));
  return { pts, face, w: widthsOf(pts.length, w, [true, true]), metal: [L.metal, L.metal] };
}

/** The bands in the body's frame put where the body is. */
function placed(bd: Band, x: Xf): Band {
  return { ...bd, pts: bd.pts.map((p) => place(x, p)), face: bd.face.map((f) => turn(x, f)) };
}

/**
 * Every ribbon round it this moment, in the ground's frame: the held one, through its paws and trailing out either side of
 * them (or over its shoulders while it scurries), and the loops round it; and, as it works or strikes, the strip it draws,
 * the fold it makes, the whip or the lash it flings. `few` is how many of the loops to draw, the most telling first.
 */
function bandsOf(s: Rib, b: Bones, P: Plan, t: number, N: number, few: number): Band[] {
  const out: Band[] = [], body = b.body, w = s.ribbon;
  const inv = (p: V3): V3 => {
    // A point in the ground's frame into the body's: its turn is a rotation, so its transpose undoes it.
    const d = sub(p, body.t), m = body.m;
    return [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
  };
  const pawAt = (i: number): V3 => inv(place(b[`hand${i}`], [0, s.paw * 0.3, -s.paw * 0.75]));
  // Off its paws, the ribbon lies over the back of its neck.
  const shoulder = (i: number): V3 => inv(place(b.torso, onBody(s, topOfTorso(s) - s.scale.len * 0.5, -Math.PI / 2 + (i ? 0.7 : -0.7), s.scale.len * 0.2)));
  const grip = [0, 1].map((i) => mixV(shoulder(i), pawAt(i), P.hold));
  const drift3 = (q: number, k: number): V3 => scale([cyc(t, 2, q * 1.7), cyc(t, 3, q * 2.3), cyc(t, 1, q * 0.9) * 0.6] as V3, k);
  const H = s.held, R = s.high[0] - P.H;
  // The held one's ends trail out round it, drifting. Off its paws, as it scurries, it is slung over its shoulders and down
  // its flanks, its ends streaming out behind it, fluttering.
  const sway = (q: number): number => s.ribbon * (0.25 + 0.12 * q);
  const T = s.torso, z1 = T.z[1], seg = (topOfTorso(s) - z1) / 4;
  const slung = (side: number, q: number): V3 => {
    const z = s.shoulder[2] - (q + 1) * seg, a = -Math.PI / 2 + side * 1.05;
    // Past its rump, streaming out behind and drooping, more the further it is.
    const past = Math.max(0, z1 - z);
    const on = add(onBody(s, Math.max(z, z1), a, s.scale.len * 0.22), [0, past * 0.6, -past * 0.8]);
    return inv(place(b.torso, add(on, scale([cyc(t, 7, q + side), 0, cyc(t, 9, q * 1.3)] as V3, (s.ribbon * 0.5 * past) / seg))));
  };
  const trail = (pts: V3[], side: number): V3[] => pts.map((p, q) => {
    const r = add(add(p, [0, 0, R]), drift3(q + side * 5, sway(q)));
    return P.hold < 1 ? mixV(slung(side, q), r, P.hold) : r;
  });
  const left = trail(H.left, -1);
  let right = trail(H.right, 1);
  // The Metallocurl's whip: the right end flung out ahead in a wide sweep down onto the anvil and round, then up into its orbit.
  if (P.whip > 0 && P.whip < 1) {
    const u = P.whip, top = add(anvilTop(s), [0, 0, R + 0.05]);
    const reach = lerp(0.6, 2.2, smooth(Math.min(1, u / 0.45))) * (1 - 0.5 * smooth((u - 0.6) / 0.4));
    const swing = lerp(-1.2, 1.9, smooth(u));
    const whip = right.map((_, q) => {
      const f = (q + 1) / right.length, a = swing - f * 1.9 * (1 - 0.4 * u);
      const rr = reach * (0.5 + 0.6 * f);
      const z = lerp(0.4, top[2], Math.min(1, smooth(u / 0.45) * (1 - smooth((u - 0.5) / 0.3))) * f) + 0.9 * smooth((u - 0.5) / 0.4) * f;
      return [Math.sin(a) * rr, Math.cos(a) * rr * 0.9 + 0.2, z] as V3;
    });
    const k = Math.sin(Math.PI * u) ** 0.6;
    right = right.map((p, q) => mixV(p, whip[q], k));
  }
  // The length between its paws: sagging a little; drawn out of the lump on the anvil as the Ribbonip's paws rise apart from
  // it; doubled down over the anvil in the Stripforge's fold.
  const mid = mixV(grip[0], grip[1], 0.5), apart = len3(sub(grip[1], grip[0]));
  const between: V3[] = [add(mid, [0, s.paw * (0.3 + 1.2 * P.fold), -apart * 0.12 * (1 - P.draw) - s.paw * 1.5 * P.fold])];
  if (P.draw > 0) between[0] = mixV(between[0], add(anvilTop(s), [0, 0, s.paw * 0.6 + R]), 0.35 * (1 - smooth(P.draw)) * Math.min(1, P.draw * 4));
  // A lash: the right end flung straight out ahead and snapping.
  if (P.lash > 0) {
    const reach = (s.arm[0] + s.arm[1]) * (2.4 + 0.6 * s.stage) * P.lash;
    right = right.map((p, q) => {
      const f = (q + 1) / right.length;
      const ahead: V3 = add(grip[1], [0.15 * f + 0.1 * Math.sin(f * 5 + t * 20) * (1 - P.lash), reach * f, 0.25 * Math.sin(Math.PI * f) - 0.25 * f]);
      return mixV(p, ahead, smooth(P.lash));
    });
  }
  const per = Math.max(2, Math.round(N / 5));
  const line = smoothLine([...[...left].reverse(), grip[0], ...between, grip[1], ...right], per);
  // Its face: its gold turned forward where it runs taut between its paws, and stood on edge everywhere else, twisting a turn
  // and a half along it.
  const i0 = left.length * per, i1 = (left.length + 1 + between.length) * per;
  const taut = (q: number): number => smooth((q - i0 + per * 0.6) / per) * smooth((i1 - q + per * 0.6) / per);
  const d0 = unit(sub(line[1], line[0]));
  const first = unit(cross(d0, [0, 0, 1]));
  const fwd: V3 = [0, 1, 0.25];
  const face = facesAlong(line, len3(first) > 0.1 ? first : [1, 0, 0], () => 0).map((f, q) => {
    const k = taut(q), d = unit(sub(line[Math.min(line.length - 1, q + 1)], line[Math.max(0, q - 1)]));
    const want = unit(sub(fwd, scale(d, dot(fwd, d))));
    const base = unit(mixV(dot(f, want) < 0 ? scale(f, -1) : f, want, k));
    return turned(base, d, (1 - k) * 1.1 * Math.sin((q / line.length) * TAU * 1.5 + cyc(t, 3) * 0.8));
  });
  out.push(placed({ pts: line, face, w: widthsOf(line.length, w, [true, true]), metal: [0, 1] }, body));
  // The loops, drifting round it.
  s.loops.slice(0, few).forEach((L) => out.push(placed(loopBand(L, t, P.flare, P.spin, N, w * 0.95, R), body)));
  return out;
}

/** Where its ribbons reach standing, in the body's frame, at four moments through its loop: for the box it is framed in. */
function reachOf(s: Rib, bones: (a: Anim) => Bones, plan: (a: Anim) => Plan): V3[] {
  const out: V3[] = [];
  for (const t of [0, 6, 12, 18]) {
    const a: Anim = { t, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
    const b = bones(a), body = b.body;
    for (const bd of bandsOf(s, b, plan(a), t, 24, 9)) for (const p of bd.pts) out.push(sub(p, body.t));
  }
  return out;
}

const css = (c: RGB, al = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/** A solid of the body as it stands this moment, for what passes behind it: an egg on a bone, its middle and half-sizes in the bone's frame. */
interface Solid { x: Xf; c: V3; r: V3 }
/** The solids of a stage's body on its bones: its trunk, its head and its haunches, each a little inside its skin. */
function solidsOf(s: Rib, b: Bones): Solid[] {
  return [
    ...bodySolid(s).map((e) => ({ x: b.trunk, c: e.c, r: e.r })),
    { x: b.head, c: skullAt(s), r: scale(s.head.r, 0.92) },
    { x: b.ll0, c: haunchAt(s), r: scale(s.haunch, 0.85) },
    { x: b.lr0, c: haunchAt(s), r: scale(s.haunch, 0.85) },
  ];
}
/** Whether a point is out of the viewer's sight behind one of the body's solids, or inside one: what it would see looking back along `T`. */
function behind(p: V3, T: V3, solids: readonly Solid[]): boolean {
  for (const e of solids) {
    // Into the bone's frame (its turn is a rotation, so its transpose undoes it), then into the egg's, where it is a ball.
    const m = e.x.m, d = sub(p, e.x.t);
    const lp: V3 = [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
    const ld: V3 = [m[0] * T[0] + m[3] * T[1] + m[6] * T[2], m[1] * T[0] + m[4] * T[1] + m[7] * T[2], m[2] * T[0] + m[5] * T[1] + m[8] * T[2]];
    const o: V3 = [(lp[0] - e.c[0]) / e.r[0], (lp[1] - e.c[1]) / e.r[1], (lp[2] - e.c[2]) / e.r[2]];
    const v: V3 = [ld[0] / e.r[0], ld[1] / e.r[1], ld[2] / e.r[2]];
    const A = dot(v, v), B = 2 * dot(o, v), C = dot(o, o) - 1;
    if (C < 0) return true;
    const D = B * B - 4 * A * C;
    if (D > 0 && -B + Math.sqrt(D) > 0) return true;
  }
  return false;
}
/** How big a pixel is, in the units `g` is drawing in. */
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };

/**
 * A metal on a face turned along `n` toward the viewer: half lit as everything on the island is (`toonD` in `./figure`) and
 * half what it mirrors -- the sky where it is turned so the viewer sees the sky in it, the ground where it is turned down --
 * in six steps between its shade, its middle and its light, a step down on its inner side; and its glint where it mirrors
 * the light itself into the viewer's eye. So a band turning over as it twists runs from dark to bright along it, as polished
 * metal does.
 */
function metalLit(M: (typeof METALS)[number], n: V3, view: View, inner: boolean): RGB {
  const T = view.T, d = dot(n, view.L) * 0.5 + n[2] * 0.65, sky = 2 * dot(n, T) * n[2] - T[2];
  const k = Math.round(clamp(0.5 + 0.3 * d + 0.38 * sky - (inner ? 0.22 : 0)) * 6) / 6;
  const c = k < 0.5 ? mix(M.shade, M.mid, k * 2) : mix(M.mid, M.lit, k * 2 - 1);
  const spec = dot(n, unit(add(view.L, T)));
  return !inner && spec > 0.92 ? mix(c, M.glint, Math.min(1, (spec - 0.92) / 0.05)) : c;
}

/**
 * The ribbons, each length of each drawn under the body where the body hides it and over it where it does not (`front`):
 * every quad of every band far to near, in its
 * metal on the side of it turned to the viewer, lit, with its two long edges and its ends inked; and, drawn big, two fine
 * lines along it where the metal was drawn out.
 */
function drawBands(g: CanvasRenderingContext2D, view: View, bands: readonly Band[], solids: readonly Solid[], front: boolean): void {
  const px = pxOf(g), T = view.T;
  const quads: Array<{ d: number; c: [V3, V3, V3, V3]; col: RGB; ink: RGB; edge: RGB; streak: RGB | null; cap: [boolean, boolean]; thin: boolean }> = [];
  for (const bd of bands) {
    const P = bd.pts, n = P.length;
    if (n < 2) continue;
    const across: V3[] = P.map((p, q) => {
      const tg = unit(sub(P[Math.min(n - 1, q + 1)], P[Math.max(0, q - 1)]));
      return unit(cross(tg, bd.face[q]));
    });
    const big = bd.w[n >> 1] / px > 7, thin = bd.w[n >> 1] / px < 4;
    for (let q = 0; q < n - 1; q++) {
      const c = mixV(P[q], P[q + 1], 0.5);
      if (behind(c, T, solids) === front) continue;
      const a0 = scale(across[q], bd.w[q] * 0.5), a1 = scale(across[q + 1], bd.w[q + 1] * 0.5);
      const corners: [V3, V3, V3, V3] = [sub(P[q], a0), add(P[q], a0), add(P[q + 1], a1), sub(P[q + 1], a1)];
      const nrm = unit(cross(add(a0, a1), sub(P[q + 1], P[q])));
      const toward = dot(nrm, T) >= 0;
      const M = METALS[toward ? bd.metal[0] : bd.metal[1]];
      const col = metalLit(M, toward ? nrm : scale(nrm, -1), view, !toward && bd.metal[0] === bd.metal[1]);
      quads.push({ d: dot(c, T), c: corners, col, ink: M.ink, edge: mix(M.shade, M.ink, 0.45), streak: big ? mix(col, M.glint, 0.45) : null, cap: [q === 0, q === n - 2], thin });
    }
  }
  quads.sort((a, b) => a.d - b.d);
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (const qd of quads) {
    const s = qd.c.map((p) => onScreen(view, p));
    g.fillStyle = css(qd.col);
    g.strokeStyle = css(qd.col);
    g.lineWidth = px * 0.7;
    g.beginPath();
    g.moveTo(s[0][0], s[0][1]);
    for (let k = 1; k < 4; k++) g.lineTo(s[k][0], s[k][1]);
    g.closePath();
    g.fill();
    g.stroke();
    if (qd.streak && qd.col !== qd.streak) {
      g.strokeStyle = css(qd.streak, 0.6);
      g.lineWidth = px * 0.8;
      g.beginPath();
      for (const f of [0.28, 0.62]) {
        g.moveTo(lerp(s[0][0], s[1][0], f), lerp(s[0][1], s[1][1], f));
        g.lineTo(lerp(s[3][0], s[2][0], f), lerp(s[3][1], s[2][1], f));
      }
      g.stroke();
    }
    // Drawn a few pixels wide, its edges are a darker shade of its own metal rather than the dark round the body, as a thin
    // part of a body is (`toonThinInk` in `./figure`): a dark line each side of a band four pixels wide is most of it.
    g.strokeStyle = css(qd.thin ? qd.edge : qd.ink, 0.95);
    g.lineWidth = px * (qd.thin ? 0.8 : 1.1);
    g.beginPath();
    g.moveTo(s[0][0], s[0][1]);
    g.lineTo(s[3][0], s[3][1]);
    g.moveTo(s[1][0], s[1][1]);
    g.lineTo(s[2][0], s[2][1]);
    if (qd.cap[0]) { g.moveTo(s[0][0], s[0][1]); g.lineTo(s[1][0], s[1][1]); }
    if (qd.cap[1]) { g.moveTo(s[3][0], s[3][1]); g.lineTo(s[2][0], s[2][1]); }
    g.stroke();
  }
  g.restore();
}

/** A flash where the metal is worked: a soft burst of light, a four-pointed star, and sparks flying out and falling. */
function flashAt(g: CanvasRenderingContext2D, view: View, p: V3, k: number, size: number, since: number, id: number): void {
  if (k <= 0.01 && (since < 0 || since > 0.5)) return;
  const [x, y] = onScreen(view, p), px = pxOf(g);
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (k > 0.01) {
    const r = size * (0.6 + 0.6 * k);
    const glow = g.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, css([255, 244, 200], 0.8 * k));
    glow.addColorStop(0.4, css([255, 210, 120], 0.35 * k));
    glow.addColorStop(1, css([255, 200, 100], 0));
    g.fillStyle = glow;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.strokeStyle = css([255, 250, 230], k);
    g.lineWidth = Math.max(px, size * 0.06);
    g.beginPath();
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      g.moveTo(x - dx * r * 1.2, y - dy * r * 1.2);
      g.lineTo(x + dx * r * 1.2, y + dy * r * 1.2);
    }
    g.stroke();
  }
  // Sparks: out and up from it, falling, gone in half a second.
  if (since >= 0 && since < 0.5) {
    for (let q = 0; q < 9; q++) {
      const a = jitter(id + q * 3) * TAU, sp = size * (2 + 3 * jitter(id + q * 3 + 1));
      const pt: V3 = [p[0] + Math.cos(a) * sp * since, p[1] + Math.sin(a) * sp * since, p[2] + size * 4 * since - 6 * since * since];
      const [sx, sy] = onScreen(view, pt), al = 1 - since / 0.5;
      g.fillStyle = css([255, 214, 120], al);
      g.beginPath();
      g.arc(sx, sy, Math.max(px * 0.9, size * 0.05), 0, TAU);
      g.fill();
    }
  }
  g.restore();
}

/** Evolving: motes of gold and steel spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Rib, b: Bones, t: number, front: boolean): void {
  const swirl = ramp(t, 0.08, 0.18) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const mid = b.torso.t, rx = Math.max(...s.torso.w) * 1.9 + 0.2, high = topOfTorso(s) + s.high[0] + s.head.r[2] * 2;
  const px = pxOf(g);
  for (let q = 0; q < 16; q++) {
    const u = clamp((t - 0.1 - 0.1 * jitter(q + 13)) / 0.32), ang = (q / 16) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const p: V3 = [mid[0] + Math.cos(ang) * rx * kk, mid[1] + Math.sin(ang) * rx * kk, 0.1 + u * high * 0.85];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p), M = METALS[q % 2];
    g.fillStyle = css(M.lit, swirl);
    g.strokeStyle = css(M.ink, swirl);
    g.lineWidth = px;
    g.beginPath();
    g.ellipse(x, y, Math.max(px * 1.5, s.ribbon * 0.5), Math.max(px, s.ribbon * 0.25), ang * 2, 0, TAU);
    g.fill();
    g.stroke();
  }
}

/** Light over it as it evolves: a warm gold glow as it begins, and over its head at the turn. */
function ribGlow(s: Rib, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [], H = topOfTorso(s) - s.torso.z[0];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.torso, [0, 0, s.torso.z[4]]), r: H, c: [250, 222, 160], a: 0.55 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.head, skullAt(s)), r: H * 1.2, c: [252, 236, 200], a: k });
  return out;
}

/* ---- the kinds ------------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the ribbons it works, drawn round it. */
function ribKind(s: Rib): Kind {
  const bones = ribBones(s);
  const R = restOf(s);
  const plan = (a: Anim): Plan => planOf(s, R, { ...a, go: a.act ? 0 : a.go });
  return {
    bones,
    build: (lod) => ribBuild(s, lod, bones, plan),
    // The variant's coat is its fur, limbs and face, kept deep; its markings the cream of its scales. The blue-grey scales,
    // the gold rims and bands, the steel, the pink of its ears and nose and its dark claws are the same on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, coatPalette(coat, mark).coat, 0.2), cream = mix([226, 194, 140], coatPalette(coat, mark).mark, 0.62);
      const face = mix(mix(fur, cream, [0.34, 0.3, 0.26][s.stage]), [198, 134, 74], 0.12);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [40, 26, 22], 0.5),
        coatLight: face,
        belly: s.stage === 2 ? mix(fur, cream, 0.18) : mix(fur, cream, 0.62),
        muzzle: mix(cream, face, 0.3),
        mark: cream,
        shell: [124, 142, 156],
        shellDark: [98, 114, 130],
        bloom: [196, 146, 62],
        metal: [176, 184, 196],
        metalDark: [86, 90, 104],
        inner: [200, 128, 122],
        nose: [228, 140, 142],
        lid: [52, 36, 34],
        eye: [24, 20, 26],
        glint: [255, 255, 255],
        claw: [48, 36, 34],
        stone: [150, 146, 140],
        stoneDark: [116, 112, 110],
      }, 30);
    },
    shadow: [Math.max(...s.torso.h) * 1.1 + s.leg.foot[0] * 0.3, Math.max(...s.torso.w) * 1.15],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are gold and steel.
    motes: [[240, 200, 120], [214, 222, 232]],
    glow: (b, a) => ribGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under, P = plan(a), px = pxOf(g);
      // Fewer loops, cut coarser, where it is drawn small.
      const tall = ((topOfTorso(s) + s.high[0]) * HEIGHT_SCALE) / px;
      const small = tall < 60;
      const bands = bandsOf(s, b, P, a.t, small ? 18 : 36, small ? 2 * s.stage : 9);
      drawBands(g, view, bands, solidsOf(s, b), front);
      if (!front) return;
      const big = s.ribbon * 1.6;
      if (act?.kind === 'work') {
        const W = RIB_WORK, hit = [W.pinch, W.fold, W.crack][s.stage];
        flashAt(g, view, place(b.body, P.spark), P.flash, big, (act.t - hit) * ACT_SECS.work, 17 + s.stage);
      } else if (act?.kind === 'strike') {
        const tip = bands[0].pts[bands[0].pts.length - 1];
        flashAt(g, view, tip, P.flash, big, (act.t - RIB_HITS[s.stage]) * ACT_SECS.strike, 5 + s.stage);
      } else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const RIBBONIP = ribKind(RIBBONIP_LOOK);
export const STRIPFORGE = ribKind(STRIPFORGE_LOOK);
export const METALLOCURL = ribKind(METALLOCURL_LOOK);
