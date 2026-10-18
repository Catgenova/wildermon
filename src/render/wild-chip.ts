import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, darker, disc, dot, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint, pastel, quadBonesOf, scale,
  smile, smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import { trot } from './wild-paws';

/**
 * The chip line: the Chiptail, a big-eared kit with a clump of rock on the
 * end of its tail, which grows into the Quarrybash, a lanky prowler plated
 * in rock with its stone club carried up over its back, and then the
 * Monolithump, a massive low beast under a mountain of rock plates and
 * spikes, swinging a boulder of a club. The species is still `quarra`
 * underneath, as saves and the database know it.
 *
 * Each is a cream to tan cat of a thing under grey and rust-orange stone with
 * a little moss on it: a feline head with big ears and amber eyes, dark stone
 * paws, a tail ending in a club of rock, and rock on its back that grows from
 * a few chips to plates and spikes to a mountain. All three are built by one
 * set of functions from a description of the stage (`Chip`), so a stage is
 * its numbers. It quarries: its club hammers bare rock and a hind paw rakes
 * the shards out.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body or a head: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/**
 * How the tail is carried: lifted at the root (degrees up from straight back), swung to the right, curled up at each link, and
 * curled up further at its last two links and the club; an S-bend down it, `bend` degrees up at a link in its first half and
 * down in its second; and a wave running down it, `wave` degrees at each link, each a little behind the one before (`phase`,
 * in strides).
 */
interface Key { lift: number; yaw: number; curl: number; tip: number; bend?: number; wave?: number; phase?: number }

/**
 * Rock on the back: rows of it down each side, each row at `th` round the barrel from the right side (a quarter turn is the
 * ridge), from `y0` to `y1` along it, `count` of them, each `r` across, along and high; how far each plate is stood up off the
 * barrel, in degrees, its back edge raised (nought for tiles lying on it); and spikes standing up rather than plates lying on it,
 * every other one a point and the rest a chunky block.
 */
interface Row { th: number; y0: number; y1: number; count: number; r: V3; stand?: number; spike?: boolean }

interface Chip {
  body: Rings;
  /** Shoulder to hip; the legs' length, how thick they are, and how big the paw is across. */
  len: number;
  legs: number;
  thick: number;
  paw: number;
  /** What is at the end of each leg: a dark stone paw, a paw capped in stone, or a boulder of a foot with rocky toes. */
  foot: 'paw' | 'capped' | 'boulder';
  neck: { at: V3; len: number; w: number; lean: number };
  /**
   * The head: the skull's half-sizes across, along and up; the muzzle's half-width, half-length and half-height, and how far
   * under the middle of the skull it comes out; and how far its nose is carried up, in degrees.
   */
  head: { r: V3; muzzle: V3; drop: number; pitch: number };
  /** The eyes: the way out of the middle of the skull to the right one, how big, and how hard a lid comes down over them, nought for a kit's wide eyes. */
  eye: { dir: V3; size: number; fierce: number };
  ear: { len: number; w: number; out: number; back: number };
  /** The fluff standing out of each cheek, how long; and how big a ruff of fur round the face, nought for none. */
  cheek: number;
  mane: number;
  /** Stone spikes over the eyes, how long; nought for none. */
  brow: number;
  tail: {
    at: V3;
    /** Each link's length, root to tip, and how thick it is at its root. */
    links: number[];
    w: number[];
    /** Whether its links are blocks of stone rather than a furred tail with stone rings. */
    stone: boolean;
    /** How big the club is, across; and whether it is blocks rather than a round clump. */
    club: number;
    blocky: boolean;
    /** How it carries it standing, and where it draws it back to as it gathers itself to strike. */
    rest: Key;
    wind: Key;
    /**
     * Where the club comes down to strike, in degrees round from straight behind it toward its right side -- in the forward
     * half, beside its head, where whatever it faces is; where the rock it quarries is, the same way, beside its haunch; and how
     * far up over its back the club is carried on the way, in degrees of lift.
     */
    aim: number;
    work: number;
    arc: number;
  };
  back: Row[];
  /** Plates of rock on its shoulders, hips and shins: nought for none, one for plates, two for rock wrapped all round. */
  armour: number;
  /** Patches of grey and rust in its fur: how many down each side, and whether there are any on its legs. */
  patches: number;
  legPatches: boolean;
  gait: { trot: boolean; bounce: number; nod: number; swing: [number, number]; roll: number; low: number };
  /** How hard its strike lands: nought a bonk with a hop, one a thud, two a slam that shakes the ground. */
  slam: number;
  size: number;
}

/** A Chiptail: a small kit with a head too big for it, huge ears, wide amber eyes, a long tail ending in a round clump of rock, and a few chips of stone on its back. */
const CHIPTAIL_LOOK: Chip = {
  body: { y: [-1.12, -0.98, -0.5, 0.05, 0.62, 0.98, 1.1], z: [0.1, 0.08, 0.05, 0.04, 0.08, 0.12, 0.14], w: [0.32, 0.52, 0.56, 0.52, 0.58, 0.54, 0.26], h: [0.34, 0.5, 0.52, 0.48, 0.54, 0.52, 0.26] },
  len: 1.8, legs: 0.52, thick: 0.22, paw: 0.24, foot: 'paw',
  neck: { at: [0, 0.92, 0.04], len: 0.3, w: 0.42, lean: 50 },
  head: { r: [0.96, 0.82, 0.8], muzzle: [0.36, 0.36, 0.24], drop: 0.3, pitch: -8 },
  eye: { dir: [0.62, 0.7, 0.2], size: 0.26, fierce: 0 },
  ear: { len: 1.1, w: 0.68, out: 44, back: 8 },
  cheek: 0.37,
  mane: 0,
  brow: 0,
  tail: {
    at: [0, -1.04, 0.3], links: [0.42, 0.4, 0.39, 0.38, 0.36, 0.34, 0.32], w: [0.14, 0.135, 0.13, 0.125, 0.12, 0.115, 0.11], stone: false, club: 0.55, blocky: false,
    rest: { lift: -12, yaw: 12, curl: 2, tip: 8, bend: 9 }, wind: { lift: 40, yaw: -24, curl: 14, tip: 10, bend: 4 }, aim: 170, work: 120, arc: 30,
  },
  back: [
    { th: 1.42, y0: -0.9, y1: 0.75, count: 6, r: [0.16, 0.18, 0.08] },
    { th: 1.0, y0: -0.5, y1: 0.4, count: 3, r: [0.11, 0.12, 0.06] },
  ],
  armour: 0,
  patches: 4,
  legPatches: true,
  gait: { trot: true, bounce: 0.06, nod: 5, swing: [30, 44], roll: 2, low: 0 },
  slam: 0,
  size: 1.82,
};

/** A Quarrybash: long in the leg and the body, its back, shoulders and shins plated in rock, stone spikes down its spine and over its eyes, and a long chain of stone carrying a big club up over its back. */
const QUARRYBASH_LOOK: Chip = {
  body: { y: [-1.5, -1.34, -0.8, 0, 0.72, 1.2, 1.36], z: [0.18, 0.14, 0.08, 0.04, 0.12, 0.18, 0.2], w: [0.44, 0.66, 0.7, 0.6, 0.74, 0.7, 0.34], h: [0.44, 0.64, 0.64, 0.56, 0.72, 0.68, 0.34] },
  len: 2.55, legs: 1.12, thick: 0.34, paw: 0.33, foot: 'capped',
  neck: { at: [0, 1.2, 0.12], len: 0.62, w: 0.5, lean: 78 },
  head: { r: [0.68, 0.64, 0.6], muzzle: [0.36, 0.6, 0.25], drop: 0.2, pitch: -8 },
  eye: { dir: [0.56, 0.74, 0.26], size: 0.17, fierce: 0.6 },
  ear: { len: 1.3, w: 0.56, out: 40, back: 35 },
  cheek: 0.34,
  mane: 0,
  brow: 0.42,
  tail: {
    at: [0, -1.38, 0.42], links: [0.52, 0.51, 0.5, 0.49, 0.48, 0.46, 0.44], w: [0.44, 0.43, 0.41, 0.4, 0.39, 0.37, 0.36], stone: true, club: 1.05, blocky: false,
    rest: { lift: 36, yaw: 6, curl: -6, tip: 4 }, wind: { lift: 50, yaw: -24, curl: 12, tip: 0 }, aim: 170, work: 120, arc: 30,
  },
  back: [
    { th: Math.PI / 2, y0: -1.0, y1: 0.95, count: 5, r: [0.24, 0.34, 0.3], spike: true },
    { th: 1.14, y0: -1.05, y1: 0.85, count: 5, r: [0.36, 0.38, 0.2], stand: 25 },
    { th: 0.66, y0: -0.9, y1: 0.6, count: 4, r: [0.32, 0.32, 0.17], stand: 10 },
  ],
  armour: 1,
  patches: 0,
  legPatches: false,
  gait: { trot: false, bounce: 0.03, nod: 3, swing: [30, 42], roll: 3, low: 0.15 },
  slam: 1,
  size: 1.45,
};

/** A Monolithump: massive and low, a mountain of rock plates and spikes on its back, legs armoured in stone on boulder feet, a maned scowl of a face, and a thick stone tail ending in a boulder of a club. */
const MONOLITHUMP_LOOK: Chip = {
  body: { y: [-2.62, -2.38, -1.38, -0.12, 1.12, 2.0, 2.28], z: [0.1, 0.12, 0.18, 0.22, 0.26, 0.24, 0.22], w: [0.8, 1.36, 1.56, 1.62, 1.64, 1.46, 0.68], h: [0.5, 0.79, 0.9, 0.94, 0.94, 0.85, 0.43] },
  len: 4.0, legs: 1.0, thick: 0.72, paw: 0.62, foot: 'boulder',
  neck: { at: [0, 1.9, 0.1], len: 0.72, w: 0.9, lean: 85 },
  head: { r: [0.96, 0.78, 0.74], muzzle: [0.46, 0.7, 0.34], drop: 0.28, pitch: 4 },
  eye: { dir: [0.5, 0.8, 0.26], size: 0.21, fierce: 1 },
  ear: { len: 0.9, w: 0.42, out: 46, back: 26 },
  cheek: 0.42,
  mane: 0.75,
  brow: 0.85,
  tail: {
    at: [0, -2.48, 0.38], links: [0.7, 0.68, 0.66, 0.64], w: [0.74, 0.7, 0.66, 0.62], stone: true, club: 2.0, blocky: true,
    rest: { lift: 0, yaw: 8, curl: 2, tip: 0 }, wind: { lift: 30, yaw: -62, curl: 6, tip: 0 }, aim: 100, work: 120, arc: 8,
  },
  back: [
    { th: Math.PI / 2, y0: -1.75, y1: 1.44, count: 7, r: [0.32, 0.46, 0.46], spike: true },
    { th: 1.2, y0: -1.94, y1: 1.5, count: 7, r: [0.62, 0.56, 0.44], stand: 62 },
    { th: 0.86, y0: -1.81, y1: 1.31, count: 6, r: [0.6, 0.55, 0.4], stand: 52 },
    { th: 0.5, y0: -1.5, y1: 1.0, count: 5, r: [0.52, 0.5, 0.28], stand: 20 },
  ],
  armour: 2,
  patches: 2,
  legPatches: false,
  gait: { trot: false, bounce: 0.02, nod: 2, swing: [17, 26], roll: 6, low: 0.05 },
  slam: 2,
  size: 2.05,
};

/* ---- helpers --------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a heap of rocks is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

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

/** A frame standing along `up` with its front along `fwd`: across, forward and up. */
function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const U = unit(up);
  let X = cross(fwd, U);
  if (Math.hypot(X[0], X[1], X[2]) < 1e-4) X = cross([0, 1, 0.3], U);
  X = unit(X);
  return [X, cross(U, X), U];
}

/**
 * A lump of rock: a block of `n` sides standing along `up` with its edges
 * cut back by `bevel`, `r` across, along and high, every corner knocked off
 * true by `rough` of its size so no two are alike -- flat faces meeting at
 * hard edges, which is what makes it stone rather than a pebble of fur. With
 * `point`, it narrows from its foot at `c` to a point twice its `r` high: a spike.
 */
function rock(c: V3, r: V3, o: { up?: V3; fwd?: V3; n?: number; bevel?: number; rough?: number; seed: number; mat: Mat; point?: boolean; spin?: number }): Mesh {
  const n = o.n ?? 5, bv = o.bevel ?? 0.32, rough = o.rough ?? 0.16, sd = o.seed;
  const [X, Y, Z] = frameOf(o.up ?? [0, 0, 1], o.fwd ?? [0, 1, 0]);
  // Up it: the foot, the shoulders of the sides, and the top; a spike goes from its foot through a waist to a point.
  const rings: Array<[number, number]> = o.point ? [[0, 1], [0.8, 0.6], [2, 0]] : [[-1, 1 - bv], [-1 + bv * 0.9, 1], [1 - bv * 0.9, 1], [1, 1 - bv]];
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const spin = o.spin ?? jitter(sd + 0.5) * TAU;
  const at = (x: number, y: number, z: number): V3 => add(c, add(add(scale(X, x * r[0]), scale(Y, y * r[1])), scale(Z, z * r[2])));
  rings.forEach(([z, k], q) => {
    if (k === 0) {
      v.push(at(0.25 * (jitter(sd + 9) - 0.5), 0.25 * (jitter(sd + 11) - 0.5), z));
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
  // Seen from outside, wound against its middle: the bottom's "out" is down and the top's up, whatever the jitter did.
  want[0] = scale(Z, -1);
  if (!o.point) want[want.length - 1] = Z;
  return mesh(v, wound(v, f, want));
}

/** The four colours a stone comes in: grey, rust, and a darker of each; by its number, mostly grey and rust. */
function stoneMat(i: number): Mat {
  const k = jitter(i * 3.7 + 2);
  return k < 0.4 ? 'stone' : k < 0.78 ? 'shell' : k < 0.9 ? 'stoneDark' : 'shellDark';
}

/** The colours of a stone of armour, mostly grey: a leg of them reads as one pillar of stone. */
function greyMat(i: number): Mat {
  const k = jitter(i * 3.7 + 5);
  return k < 0.55 ? 'stone' : k < 0.82 ? 'stoneDark' : 'shell';
}

/** A little moss on the top of a stone, now and then: a soft green patch, painted. */
function mossOn(c: V3, up: V3, r: number, i: number): Disc | null {
  if (jitter(i * 5.1 + 7) > 0.24) return null;
  return disc(add(c, scale(unit(up), 0.012)), up, r * 0.4, r * 0.28, 6, 'moss', { spin: jitter(i) * 3 });
}

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth's line. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  const n = pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3);
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m };
}

/* ---- its tail ---------------------------------------------------------------------------- */

const mixKey = (a: Key, b: Key, t: number): Key => ({
  lift: lerp(a.lift, b.lift, t), yaw: lerp(a.yaw, b.yaw, t), curl: lerp(a.curl, b.curl, t), tip: lerp(a.tip, b.tip, t),
  bend: lerp(a.bend ?? 0, b.bend ?? 0, t), wave: lerp(a.wave ?? 0, b.wave ?? 0, t), phase: t < 0.5 ? a.phase : b.phase,
});
const addKey = (a: Key, d: Partial<Key>): Key => ({
  lift: a.lift + (d.lift ?? 0), yaw: a.yaw + (d.yaw ?? 0), curl: a.curl + (d.curl ?? 0), tip: a.tip + (d.tip ?? 0),
  bend: (a.bend ?? 0) + (d.bend ?? 0), wave: (a.wave ?? 0) + (d.wave ?? 0), phase: d.phase ?? a.phase,
});

/** Where the middle of the club is on its bone: a little way on from the end of the last link. */
const clubMid = (s: Chip): V3 => [0, -s.tail.club * 0.72, 0];

/**
 * The tail's bones carried as `k` says, from its root on the body: each link
 * on from the one before it, curled up and bent to the right by as much, and
 * the club on the end of the last.
 */
function tailBones(s: Chip, body: Xf, k: Key): Xf[] {
  const T = s.tail, out: Xf[] = [];
  let prev = joint(body, T.at, -k.lift, 0, k.yaw);
  out.push(prev);
  const n = T.links.length;
  for (let q = 1; q < n; q++) {
    const s2 = (k.bend ?? 0) * Math.sin((TAU * q) / Math.max(1, n - 1)), w = (k.wave ?? 0) * Math.sin(TAU * ((k.phase ?? 0) - q * 0.08));
    prev = joint(prev, [0, -T.links[q - 1], 0], -(k.curl + (q >= n - 2 ? k.tip : 0) + s2 + w));
    out.push(prev);
  }
  out.push(joint(prev, [0, -T.links[T.links.length - 1], 0], -(k.curl + k.tip) * 0.6));
  return out;
}

/** A bone turned `deg` about an axis through `pivot`, by the right hand. */
function turned(x: Xf, pivot: V3, axis: V3, deg: number): Xf {
  const [ax, ay, az] = unit(axis), a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), C = 1 - c;
  const R = [c + ax * ax * C, ax * ay * C - az * sn, ax * az * C + ay * sn, ay * ax * C + az * sn, c + ay * ay * C, ay * az * C - ax * sn, az * ax * C - ay * sn, az * ay * C + ax * sn, c + az * az * C];
  const mv = (v: V3): V3 => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  const m = x.m, cols = [0, 1, 2].map((j) => mv([m[j], m[3 + j], m[6 + j]]));
  return { m: [cols[0][0], cols[1][0], cols[2][0], cols[0][1], cols[1][1], cols[2][1], cols[0][2], cols[1][2], cols[2][2]], t: add(pivot, mv(sub(x.t, pivot))) };
}

/**
 * Where a body twists about as it strikes, on the ground: a light one between its hind feet, turning its front round toward the
 * blow; a monolith between its fore feet, swinging its hindquarters and its tail round to its side as an ankylosaur does.
 */
function pivotOf(s: Chip, b: Bones): V3 {
  const [l, r] = s.slam === 2 ? [b.fl2.t, b.fr2.t] : [b.hl2.t, b.hr2.t];
  return [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, 0];
}
/** Every bone turned `deg` about the upright through `pivot`. */
function twisted(b: Bones, pivot: V3, deg: number): Bones {
  if (!deg) return b;
  const out: Bones = {};
  for (const k of Object.keys(b)) out[k] = turned(b[k], pivot, [0, 0, 1], deg);
  return out;
}
/** How far it twists through a strike, in degrees: round into it as it gathers, held through the blow, and back. */
const twistOf = (s: Chip, t: number): number => (s.slam === 2 ? 24 : -12) * ramp(t, 0.05, STRIKE.gather) * (1 - ramp(t, 0.7, 1));

/** A point in a bone's own frame. */
function local(x: Xf, p: V3): V3 {
  const m = x.m, d = sub(p, x.t);
  return [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
}
/** How far a point (in the body's frame) is inside its barrel grown by `m` all round: nought outside, one at its middle line. */
function inside(R: Rings, p: V3, m: number): number {
  const y = clamp(p[1], R.y[0], R.y[R.y.length - 1]);
  if (Math.abs(p[1] - y) > m) return 0;
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  const w = lerp(R.w[k], R.w[k + 1], f) + m, h = lerp(R.h[k], R.h[k + 1], f) + m, z = lerp(R.z[k], R.z[k + 1], f);
  return Math.max(0, 1 - Math.hypot(p[0] / w, (p[2] - z) / h));
}
/** The same for an egg, grown by `m`. */
const insideEgg = (p: V3, e: { c: V3; r: V3 }, m: number): number => Math.max(0, 1 - Math.hypot((p[0] - e.c[0]) / (e.r[0] + m), (p[1] - e.c[1]) / (e.r[1] + m), (p[2] - e.c[2]) / (e.r[2] + m)));

/**
 * The carriage of the tail that brings the middle of its club to `goal`,
 * found from `guess` by a downhill simplex over its lift, swing and curl: the
 * nearest such carriage to the guess, so it comes round the way the guess
 * does. Worked out once for each stage, at the moment it is wanted, so the
 * club lands where the stage's numbers put the rock whatever its tail's
 * length.
 */
function reach(s: Chip, b: Bones, goal: V3, guess: Key): Key {
  const T = s.tail, n = T.links.length;
  // How far the tail and the club are into the body, its rock and the head, which they must go round rather than through.
  const into = (chain: Xf[]): number => {
    let over = 0;
    const pts: Array<[V3, number]> = [];
    for (let q = 1; q <= n; q++) {
      const a = place(chain[q - 1], [0, 0, 0]), c = place(chain[q], [0, 0, 0]);
      pts.push([scale(add(a, c), 0.5), T.w[Math.min(q - 1, T.w.length - 1)]], [c, T.w[Math.min(q, T.w.length - 1)]]);
    }
    pts.push([place(chain[n], clubMid(s)), T.club * 0.5]);
    // Clear of the rock on its back, and never less than a little over it, so the tail arches over the back and does not lie on it.
    const plates = Math.max(0.3, ...s.back.map((r) => (r.spike ? r.r[2] * 1.2 : r.r[2] * 1.8)));
    for (const [p, r] of pts) {
      over += 4 * inside(s.body, local(b.body, p), r * 0.8 + plates * 0.4) ** 2;
      if (b.head) over += 2 * insideEgg(local(b.head, p), headSolids(s)[0], r * 0.8 + s.ear.len * 0.25) ** 2;
    }
    return over;
  };
  const cost = (x: number[]): number => {
    const k = { ...guess, lift: x[0], yaw: x[1], curl: x[2] };
    const chain = tailBones(s, b.body, k);
    const p = place(chain[n], clubMid(s)), d = sub(p, goal);
    return 12 * dot(d, d) + into(chain) + 1e-5 * ((x[0] - guess.lift) ** 2 + (x[1] - guess.yaw) ** 2 + (x[2] - guess.curl) ** 2);
  };
  let pts = [[guess.lift, guess.yaw, guess.curl]];
  for (let q = 0; q < 3; q++) pts.push(pts[0].map((x, j) => x + (j === q ? 12 : 0)));
  let vals = pts.map(cost);
  for (let it = 0; it < 260; it++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    pts = order.map((i) => pts[i]);
    vals = order.map((i) => vals[i]);
    const c = [0, 1, 2].map((j) => (pts[0][j] + pts[1][j] + pts[2][j]) / 3);
    const at = (k: number): number[] => c.map((x, j) => x + k * (pts[3][j] - x));
    const r = at(-1), fr = cost(r);
    if (fr < vals[0]) {
      const e = at(-2), fe = cost(e);
      if (fe < fr) { pts[3] = e; vals[3] = fe; } else { pts[3] = r; vals[3] = fr; }
    } else if (fr < vals[2]) { pts[3] = r; vals[3] = fr; } else {
      const k = at(0.5), fk = cost(k);
      if (fk < vals[3]) { pts[3] = k; vals[3] = fk; } else {
        for (let q = 1; q < 4; q++) { pts[q] = pts[q].map((x, j) => (x + pts[0][j]) / 2); vals[q] = cost(pts[q]); }
      }
    }
  }
  const best = pts[vals.indexOf(Math.min(...vals))];
  return { ...guess, lift: best[0], yaw: best[1], curl: best[2] };
}

/* ---- its moves --------------------------------------------------------------------------- */

/** The strike: how far through it the wind-up is gathered, the club comes down, and it has let go of the blow. */
const STRIKE = { gather: 0.34, hit: 0.5, hold: 0.6 };
/** A go at its task: when the club starts up, is at the top of its raise, drops, comes down on the rock and is back up over it; and the hind paw's two rakes at it. */
const WORK = { lift: 0.03, top: 0.16, drop: 0.22, hit: 0.3, back: 0.46, rakes: [0.5, 0.72] as const, rake: 0.2 };
/** The shard it breaks out: how far through the second rake it comes away, and how long it falls, in seconds (it lands at 0.95 of a go). */
const SHARD = { at: 0.3, fall: 0.19 };

/** Where its club comes down, on the ground behind its near haunch, in the body's ground frame; and how big the rock it quarries there is. */
function hitOf(s: Chip, aim: number, clear: number): V3 {
  // Out from under the root of its tail the way it aims, `aim` degrees round from straight behind it toward its right, as far
  // as clears its body, its legs and the rock on it by `clear`.
  const a = aim * Math.PI / 180, d: V3 = [Math.sin(a), -Math.cos(a), 0];
  const z = s.body.z[2], room = clear + s.thick * 1.3 + s.armour * s.thick * 0.3 + 0.1;
  let r = 0;
  const at = (k: number): V3 => [d[0] * k, s.tail.at[1] + d[1] * k, z];
  while (r < 12 && inside(s.body, at(r), room) > 0) r += 0.05;
  return [d[0] * r, s.tail.at[1] + d[1] * r, 0];
}
/** Where the club comes down to strike: in the forward half, beside its head. */
const blowOf = (s: Chip): V3 => hitOf(s, s.tail.aim, s.tail.club * 0.45);
/** Where the rock it quarries is: off its side, beside its haunch. */
const rockOf = (s: Chip): V3 => hitOf(s, s.tail.work, rockR(s) + (s.slam === 2 ? 0.5 * s.tail.club : 0));
const rockR = (s: Chip): number => Math.max(0.44, s.tail.club * 0.9);
const rockH = (s: Chip): number => rockR(s) * 0.88;

/** How far through a strike it has gathered itself (nought to one and gone again by the blow), and how hard the blow has just landed through it. */
function strikeOf(t: number): { gather: number; land: number } {
  const gather = ramp(t, 0, STRIKE.gather) * (1 - ramp(t, STRIKE.gather, STRIKE.hit));
  const land = t < STRIKE.hit ? 0 : Math.exp(-(t - STRIKE.hit) * 9) * (1 - ramp(t, 0.85, 1));
  return { gather, land };
}

/**
 * A go at its task: how far it is at the rock (eased in and out of a go
 * played once, and held while it works on), how far through a rake of the
 * paw it is (or -1), and the jolt of the blow. The club's own arc is in
 * `chipBones`.
 */
function workOf(t: number, graze: number): { down: number; rake: number; jolt: number } {
  const down = Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.88, 1)));
  let rake = -1;
  for (const r0 of WORK.rakes) if (t >= r0 && t < r0 + WORK.rake) rake = (t - r0) / WORK.rake;
  const jolt = t >= WORK.hit ? Math.exp(-(t - WORK.hit) * 30) : 0;
  return { down, rake, jolt };
}

/**
 * A rake of the near hind paw at the rock, `u` through it, as a cat kicks
 * back at what it is burying: drawn up and kicked back and out against the
 * foot of the rock, then dragged in along it with the claws in, and set down.
 */
function rakeOf(u: number): { out: number; swing: number; fold: number; dig: number } {
  if (u < 0) return { out: 0, swing: 0, fold: 0, dig: 0 };
  if (u < 0.35) {
    const k = smooth(u / 0.35);
    return { out: k, swing: -k, fold: Math.sin(Math.PI * Math.min(1, u / 0.35 * 0.8)) * 0.8, dig: 0 };
  }
  const k = smooth((u - 0.35) / 0.65);
  return { out: 1 - k, swing: -(1 - k), fold: 0.15 * (1 - k), dig: Math.sin(Math.PI * k) };
}

/* ---- its bones -------------------------------------------------------------------------- */

/** A stage's body on four paws (`QuadSpec`): its legs, neck and ears from its numbers, and a cat's stride. The tail is its own (`tailBones`). */
function specOf(s: Chip): QuadSpec {
  return {
    high: s.legs + 0.6,
    // A prowler's fore legs a little bent at the elbow.
    fore: { at: [s.body.w[4] * 0.5, s.len * 0.44, -0.36], len: [s.legs * 0.5, s.legs * 0.46, s.paw * 0.55], rest: s.slam === 1 ? [-7, 15, 0] : [-3, 6, 0], fold: [55, 85], toe: [s.paw * 1.1, s.paw * 0.4] },
    hind: { at: [s.body.w[2] * 0.52, -s.len * 0.42, -0.18], len: [s.legs * 0.56, s.legs * 0.52, s.paw * 0.55], rest: [18, -36, 0], fold: [35, 55], toe: [s.paw * 1.1, s.paw * 0.4] },
    neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
    head: { pitch: s.head.pitch },
    ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
    swing: s.gait.swing,
    duty: s.gait.trot ? [0.56, 0.36] : [0.66, 0.4],
    graze: 112 - s.neck.lean,
    nose: 26,
    bow: 6,
    rock: 5,
  };
}

/** Where each ear is rooted on the head (the right one): high on the crown, toward the side. */
function earRoot(s: Chip): V3 {
  const q = onSkull(s, [0.62, -0.12, 0.8]);
  return sub(q.p, scale(q.n, 0.1));
}

const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its own
 * gait -- a kit's bouncing trot, a prowl, a heavy lumber rolling its weight
 * from side to side; and its moves -- a strike, gathered, swung and landed,
 * a hop to a kit's and a stomp to a monolith's; quarrying, the head down at
 * the rock and a hind paw kicking at it; and evolving, drawn up and stamping.
 */
function chipPose(s: Chip, spec: QuadSpec, p: QuadPose, a: Anim, graze: number): void {
  trot(p, a);
  const g = smooth(a.go), G = s.gait;
  if (G.trot && a.go > 0 && a.gait < 0.5) {
    const duty = lerp(spec.duty?.[0] ?? 0.64, spec.duty?.[1] ?? 0.4, a.gait), amp = lerp(spec.swing[0], spec.swing[1], a.gait);
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + FOUR_BEAT[i], duty, amp), now = step(a.u + DIAGONALS[i], duty, amp);
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
  }
  if (a.go > 0) {
    const w = frac(a.u), walk = 1 - a.gait;
    // A kit bounces off each pair of paws; a prowler carries itself low with its head down and forward, its shoulders rolling; a
    // monolith sinks onto each foot as it comes down and rolls its weight over onto it.
    p.lift += g * (G.bounce + (s.slam === 2 ? 0 : 0.06) * a.gait) * Math.max(0, Math.sin(w * TAU * 2));
    p.lift -= g * G.low * walk;
    p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.6);
    // A prowler's head let down and stretched forward as it goes, low over its fore paws.
    if (s.slam === 1) {
      p.neck[0] += g * 15 * walk;
      p.head[0] += g * 8 * walk;
    }
    p.roll += g * G.roll * Math.sin(w * TAU + 0.3) * (0.5 + 0.5 * walk);
    p.ears[0][0] += g * 3 * G.nod * Math.sin(w * TAU * 2 - 1.4);
    p.ears[1][0] += g * 3 * G.nod * Math.sin(w * TAU * 2 - 1.1);
    if (s.slam === 2) {
      // The weight shift: the body sways over toward whichever side has both its feet down, and dips at each footfall.
      p.lift -= g * 0.05 * walk * Math.abs(Math.sin(w * TAU * 2));
      // Too heavy to leave the ground at a run: the lift a run has between its beats taken back out, and a heavy rock left.
      p.lift -= g * a.gait * 0.5 * Math.max(0, Math.sin(w * TAU * 2));
      p.pitch += g * a.gait * 2 * Math.sin(w * TAU + 0.5);
      p.neck[1] += g * 6 * walk * Math.sin(w * TAU + 0.3);
      p.pitch += g * 1.5 * Math.sin(w * TAU * 2 + 0.8);
    }
  } else {
    // Standing, now and then it looks round over its shoulder at its club.
    const look = beat(a.t, [5.4, 16.8], 2.2) * (1 - a.graze);
    p.neck[1] -= 14 * look;
    p.head[1] -= 18 * look;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t), sl = s.slam;
    // Gathered: down on its haunches, the head turned to where the blow will land and the ears pinned; thrown into it as the club
    // comes over, the forequarters dropped onto the blow.
    const engage = ramp(act.t, 0, 0.25) * (1 - ramp(act.t, 0.7, 1));
    p.neck[1] -= 10 * engage;
    p.head[1] -= 16 * engage;
    p.head[0] -= 8 * k.gather;
    p.neck[0] += 6 * k.gather;
    p.pitch += 5 * k.gather - (4 + 3 * sl) * k.land;
    p.roll += (sl === 2 ? -6 : -3) * k.gather + (3 + 3 * sl) * k.land;
    p.lift -= 0.06 * (1 + sl) * k.gather;
    p.legs[2][1] += 0.35 * k.gather;
    p.legs[3][1] += 0.35 * k.gather;
    for (const e of p.ears) e[0] += 40 * k.gather + 20 * k.land;
    p.squash += 0.08 * k.gather + 0.1 * (1 + sl) * k.land;
    if (sl === 0) {
      // A kit hops into its bonk, all four paws off the ground as the club comes over, and lands with it.
      const hop = hump(act.t, 0.42, 0.09);
      p.lift += 0.32 * hop;
      for (const l of p.legs) l[1] += 0.4 * hop;
    } else {
      // A big one rears its near fore off the ground as it winds up and stamps it down with the club.
      const rear = ramp(act.t, 0.08, STRIKE.gather) * (1 - ramp(act.t, STRIKE.gather + 0.04, STRIKE.hit));
      p.legs[0][0] += 28 * rear;
      p.legs[0][1] += 0.7 * rear;
      p.legs[0][2] = Math.max(p.legs[0][2], rear);
      p.pitch += 3 * sl * rear;
    }
  } else if (act?.kind === 'work') {
    const w = workOf(act.t, graze), d = w.down;
    // At the rock beside its haunch: turned to look round and down at it over its shoulder; a jolt through the body at each blow;
    // the weight off the near hind leg, which kicks out at the rock and rakes along it (`rakeOf`, and turned out in `chipBones`).
    // Most of the turn in the neck, a little in the head, and the head rolled back the other way so its ears stay upright.
    p.neck[0] += d * 10;
    p.neck[1] -= d * 60;
    p.head[0] -= d * 22;
    p.head[1] -= d * 20;
    p.head[2] += d * 20;
    p.pitch -= d * 3 * w.jolt;
    p.roll -= d * 3;
    p.squash += d * 0.08 * w.jolt;
    for (const e of p.ears) e[0] += d * (10 + 30 * w.jolt);
    const r = rakeOf(w.rake);
    const aim = s.tail.work * Math.PI / 180;
    p.legs[3][0] += d * (16 + 30 * Math.cos(aim)) * r.swing;
    p.legs[3][1] += d * r.fold;
    p.legs[3][2] = Math.max(p.legs[3][2], d * r.fold);
    p.foot[3] -= d * 30 * r.dig;
  } else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, a shake at the turn, and a stamp of both fore paws as it lands in its new body.
    const up = ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.6, 0.85)), shake = hump(act.t, 0.55, 0.12);
    p.neck[0] -= 14 * up;
    p.head[0] += 12 * up;
    p.pitch += 6 * up;
    p.legs[0][0] += 10 * up;
    p.legs[1][0] += 10 * up;
    p.head[2] += 16 * shake * Math.sin(act.t * 70);
    p.ears[0][0] += 26 * shake * Math.sin(act.t * 70) - 12 * up;
    p.ears[1][0] -= 26 * shake * Math.sin(act.t * 70) + 12 * up;
    p.squash += 0.1 * hump(act.t, 0.66, 0.06);
  }
}

/** How it carries its tail this moment, before any act: bobbing as a kit trots, swaying up over a prowler's back, swinging low behind a monolith. */
function tailCarried(s: Chip, a: Anim): Key {
  const R = s.tail.rest, g = smooth(a.go), w = frac(a.u);
  let k = addKey(R, { yaw: 10 * cyc(a.t, 4) * (1 - g), lift: 3 * cyc(a.t, 3, 1) * (1 - g) });
  if (s.slam === 0) {
    // A kit's club bobbing a beat after each bounce, and flicked now and then as it stands.
    const flick = beat(a.t, [3.6, 11.2, 19.4], 0.5) * (1 - g);
    k = addKey(k, { lift: g * 3 * Math.sin(w * TAU * 2 - 1.6) + 6 * flick, curl: 0, tip: g * 5 * Math.sin(w * TAU * 2 - 2.4) + 14 * flick, yaw: g * 8 * Math.sin(w * TAU + 0.8) });
    // And a wave running down it, each link a little behind the one before: twice a stride as it trots, slowly as it stands.
    k = { ...k, wave: 2.6 * g + 2 * (1 - g), phase: g > 0.5 ? frac(a.u) * 2 : a.t / 2.4 };
  } else if (s.slam === 1) {
    // Held up over its back and swaying as it prowls.
    k = addKey(k, { yaw: g * 11 * Math.sin(w * TAU - 0.9), lift: g * 3 * Math.sin(w * TAU * 2 - 1.2), curl: g * 2 * Math.sin(w * TAU * 2 - 1.8) });
  } else {
    // Let down nearly to the ground as it lumbers, swinging from side to side a beat behind its weight.
    k = addKey(k, { lift: -6 * g, curl: -3 * g, yaw: g * 13 * Math.sin(w * TAU - 1.1) + g * 3 * Math.sin(w * TAU * 2 - 1.8) });
  }
  return k;
}

/** The bones of a stage: a body on four paws (`quadBonesOf`), its own tail and club, and the rock it quarries while it works. */
function chipBones(s: Chip): (a: Anim) => Bones {
  const spec = specOf(s);
  // At its task its head is at the rock, not the grass: the body on four legs is posed as though it were not grazing, and its own
  // pose (`chipPose`) is told how far into its task it has settled, which is the real `graze`.
  let settled = 0;
  const posed = quadBonesOf(spec, (p, a) => chipPose(s, spec, p, a, settled));
  const blow = blowOf(s), hit = rockOf(s), still: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
  // Where the club must be at the blow, at the rock and over it, worked out the first time each is wanted.
  let keys: { strike: Key; smash: Key; hover: Key; raise: Key } | null = null;
  const keysOf = (): { strike: Key; smash: Key; hover: Key; raise: Key } => {
    if (keys) return keys;
    const T = s.tail;
    // Brought up over its back and down beside its head; or, short in the tail, swung round its side.
    const guess: Key = T.aim > 135 ? { lift: 95, yaw: 28, curl: 12, tip: 0 } : { lift: 20, yaw: T.aim * 0.9, curl: -4, tip: 0 };
    settled = 0;
    const plain = posed({ ...still, act: { kind: 'strike', t: STRIKE.hit } }), pivot = pivotOf(s, plain), turn = twistOf(s, STRIKE.hit);
    const atHit = twisted(plain, pivot, turn);
    // Where it lands, aimed off the body as it stands and carried round with it as it twists.
    const goal = turned({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: blow }, pivot, [0, 0, 1], turn).t;
    // The club's middle as far over what it lands on as the club reaches under its middle, so it lands on it and not over it.
    const low = T.club * (T.blocky ? 0.8 : 0.62), top = rockH(s) * 1.15;
    const strike = reach(s, atHit, [goal[0], goal[1], low * 0.8], guess);
    settled = 1;
    const atRock = posed({ ...still, act: { kind: 'work', t: WORK.hit } });
    const smash = reach(s, atRock, [hit[0], hit[1], top + low], { lift: 30, yaw: T.work * 0.85, curl: -4, tip: 0 });
    const hover = reach(s, atRock, [hit[0] - 0.15 * T.club, hit[1], top + low + T.club * 1.1 + 0.2], smash);
    const raise = reach(s, atRock, [hit[0] * 0.6, lerp(hit[1], T.at[1], 0.35), top + low + T.club * (s.slam === 2 ? 2.8 : 2.2) + 0.8], hover);
    keys = { strike, smash, hover, raise };
    return keys;
  };
  return (a) => {
    const act = a.act, work = act?.kind === 'work';
    settled = a.graze;
    let b = posed(work ? { ...a, graze: 0 } : a);
    // A prowler's fore legs splayed a little out from the shoulder.
    if (s.slam === 1) {
      const B = b.body.m, fwd: V3 = [B[1], B[4], B[7]];
      for (const [leg, sd] of [['fl', 1], ['fr', -1]] as const) {
        const at = b[`${leg}0`].t;
        for (const k of [0, 1, 2]) b[`${leg}${k}`] = turned(b[`${leg}${k}`], at, fwd, sd * 10);
      }
    }
    if (act?.kind === 'strike') b = twisted(b, pivotOf(s, b), twistOf(s, act.t));
    let k = tailCarried(s, a);
    if (act?.kind === 'strike') {
      const K = keysOf(), t = act.t, W = s.tail.wind;
      if (t < STRIKE.gather) k = mixKey(k, W, smooth(t / STRIKE.gather));
      else if (t < STRIKE.hit) {
        // Whipped over: up through the top of its arc above the back on the way, faster and faster till it lands; a monolith's
        // swung round its side, lower.
        const u = (t - STRIKE.gather) / (STRIKE.hit - STRIKE.gather);
        const e = u ** 1.6;
        k = addKey(mixKey(W, K.strike, e), { lift: s.tail.arc * Math.sin(Math.PI * e) });
      } else {
        // A little bounce of the club off the ground, then let back up to how it carries it.
        const bounce = Math.sin(clamp((t - STRIKE.hit) / 0.14) * Math.PI) * (t < STRIKE.hit + 0.14 ? 1 : 0) * (s.slam === 2 ? 0.5 : 2.4);
        // Carried back up over its back the way it came rather than swept round low behind it.
        const back = ramp(t, STRIKE.hold, 1);
        k = addKey(mixKey(addKey(K.strike, { lift: 5 * bounce, curl: -3 * bounce }), k, back), { lift: 12 * Math.sin(Math.PI * back) });
      }
    } else if (work) {
      const K = keysOf(), w = workOf(act.t, a.graze), t = act.t;
      // Raised over the rock, brought down on it, let back up over it, and held there bobbing while the paw rakes.
      let wk = addKey(K.hover, { lift: 2 * Math.sin(t * TAU * 2) });
      if (t >= WORK.lift && t < WORK.top) wk = mixKey(K.hover, K.raise, smooth((t - WORK.lift) / (WORK.top - WORK.lift)));
      else if (t >= WORK.top && t < WORK.drop) wk = K.raise;
      else if (t >= WORK.drop && t < WORK.hit) wk = mixKey(K.raise, K.smash, ((t - WORK.drop) / (WORK.hit - WORK.drop)) ** 2);
      else if (t >= WORK.hit && t < WORK.back) wk = mixKey(K.smash, K.hover, smooth((t - WORK.hit - 0.02) / (WORK.back - WORK.hit - 0.02)));
      k = mixKey(k, wk, w.down);
      const grow = w.down;
      b.rock = { m: [grow, 0, 0, 0, grow, 0, 0, 0, grow], t: [hit[0], hit[1], 0] };
      // The near hind leg turned out from the hip toward the rock while it works, and further as it kicks.
      const out = w.down * (14 + 24 * rakeOf(w.rake).out) * Math.sin(s.tail.work * Math.PI / 180);
      const B = b.body.m, hip = b.hr0.t;
      for (const key of ['hr0', 'hr1', 'hr2']) b[key] = turned(b[key], hip, [B[1], B[4], B[7]], -out);
    } else if (act?.kind === 'evolve') {
      const up = ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.6, 0.85)), shake = hump(act.t, 0.55, 0.12);
      k = addKey(k, { lift: 30 * up, curl: 6 * up, yaw: 22 * shake * Math.sin(act.t * 50) });
    }
    const chain = tailBones(s, b.body, k);
    chain.forEach((x, q) => { b[q < s.tail.links.length ? `tail${q}` : 'club'] = x; });
    return b;
  };
}

/* ---- the head ------------------------------------------------------------------------------- */

/** The middle of the skull, in the head's frame: a little up from the neck's end. */
const skullAt = (s: Chip): V3 => [0, 0, s.head.r[2] * 0.3];
/** Where a way out of the middle of the skull meets it, and the way out of it there. */
const onSkull = (s: Chip, dir: V3): { p: V3; n: V3 } => onEgg(skullAt(s), s.head.r, dir);
/** The muzzle's egg: where its middle is, and how wide, long and high it is. */
function muzzleOf(s: Chip): { c: V3; r: V3 } {
  const H = s.head, C = skullAt(s), m = H.muzzle;
  // Set well back into the face, so the muzzle grows out of the skull with no neck to it.
  return { c: [0, C[1] + H.r[1] * 0.45 + m[1] * 0.42, C[2] - H.drop], r: [m[0], m[1], m[2]] };
}

/**
 * The eyes, set on the front of the skull and looking forward as much as
 * out, as a cat's are: each a dark rim, a big amber iris, a darker ring, a
 * dark middle and two glints; on the older ones a lid of its fur coming
 * down over the top of each at a slant, which is all a scowl is. All of an
 * eye goes out of sight together when the head is between it and the
 * viewer (`at`).
 */
function eyesOf(s: Chip, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q = onSkull(s, [side * E.dir[0], E.dir[1], E.dir[2]]);
    const n = q.n, p = add(q.p, scale(n, 0.012)), at = add(p, scale(n, 0.03));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    // Each layer laid onto the skull's own curve a hair over the last, so an eye bends round the head with it and never stands
    // off it past its outline.
    const C = skullAt(s), R = s.head.r;
    const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(C, R, sub(v, C)); return add(e.p, scale(e.n, lift)); }) });
    const r = E.size, tall = 1 - 0.35 * E.fierce;
    if (shut) {
      out.push(onto(disc(add(p, scale(up, -r * 0.1)), n, r * 1.05, r * 0.26, 8, 'lid', o), 0.014));
      continue;
    }
    out.push(onto(disc(p, n, r * 1.12, r * 1.16 * tall, 12, 'lid', o), 0.012));
    out.push(onto(disc(p, n, r, r * 1.04 * tall, 12, 'crystal', o), 0.016));
    out.push(onto(disc(p, n, r * 0.66, r * 0.7 * tall, 10, 'crystalDark', o), 0.02));
    out.push(onto(disc(p, n, r * (0.34 + 0.08 * (1 - E.fierce)), r * (0.52 + 0.1 * (1 - E.fierce)) * tall, 8, 'eye', o), 0.024));
    if (E.fierce > 0) {
      // The lid: the fur of the brow come down over the top two fifths of the eye at a slant, lower toward the nose, with a dark
      // line along its edge: a scowl.
      const tilt = side * 0.7 * E.fierce, lidUp = unit(add(scale(up, Math.cos(tilt)), scale(across, Math.sin(tilt))));
      const edge = r * tall * (1 - 0.8 * E.fierce);
      out.push(onto(disc(add(p, scale(lidUp, edge + r * 0.62)), n, r * 1.4, r * 0.64, 10, 'coat', { ...o, up: lidUp }), 0.028));
      out.push(onto(disc(add(p, scale(lidUp, edge + r * 0.02)), n, r * 1.36, r * 0.13, 8, 'lid', { ...o, up: lidUp }), 0.032));
    }
    out.push(onto(disc(add(add(p, scale(up, r * 0.32 * tall)), scale(across, side * r * 0.3)), n, r * 0.28, r * 0.28, 6, 'glint', { ...o, lit: true }), 0.036));
    out.push(onto(disc(add(add(p, scale(up, -r * 0.4 * tall)), scale(across, -side * r * 0.32)), n, r * 0.13, r * 0.13, 5, 'glint', { ...o, lit: true }), 0.036));
  }
  return paint(out);
}

/**
 * The head: a cat's -- a round skull (`Chip.head`) with full cheeks low on
 * each side of it, a muzzle out of the lower front of it, short and soft on
 * a kit and long as a fox's on a prowler, two pale whisker pads and a chin at
 * its end, a small dark nose and a mouth under it; fluff out of each cheek;
 * a grey patch on the brow; and as it grows stone spikes over its eyes, and
 * at the last spikes on its cheeks and fangs.
 */
function headOf(s: Chip, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s), M = muzzleOf(s), m = M.r;
  const skull = orb(C, H.r, n + 2, k + 2, 'coat');
  const cheeks = merge(...[1, -1].map((sd) => orb([sd * H.r[0] * 0.5, C[1] + H.r[1] * 0.22, C[2] - H.r[2] * 0.4], [H.r[0] * 0.56, H.r[1] * 0.62, H.r[2] * 0.5], n, k, 'coat')));
  const snout = orbAlong(M.c, [0, 1, -0.12], [m[0], m[2], m[1]], n, k, 'coat');
  // The whisker pads either side of the end of the muzzle, pale; and a little chin under them.
  const tipY = M.c[1] + m[1] * 0.62;
  const pads = merge(...[1, -1].map((sd) => orbAlong([sd * m[0] * 0.38, tipY, M.c[2] - m[2] * 0.25], [sd * 0.25, 1, 0], [m[0] * 0.42, m[2] * 0.5, m[1] * 0.3], n, k, 'muzzle')));
  const chin = orb([0, tipY - m[1] * 0.1, M.c[2] - m[2] * 0.72], [m[0] * 0.5, m[1] * 0.36, m[2] * 0.36], n, k, 'muzzle');
  // The nose: a small dark rounded wedge on top of the end of the muzzle.
  const nose = orbAlong([0, M.c[1] + m[1] * 0.9, M.c[2] + m[2] * 0.42], [0, 1, 0.5], [m[0] * 0.44, m[0] * 0.26, m[0] * 0.3], 6, 3, 'nose');
  // The mouth: a soft ω under the nose on a kit; a hard line back along each side of the muzzle, turned down at its corner, on the older ones.
  const mouth = s.eye.fierce < 0.3
    ? smile([0, M.c[1] + m[1] * 0.98, M.c[2] - m[2] * 0.18], [0, 1, -0.25], m[0] * 0.9, 'lid')
    : paint([1, -1].map((sd) => line(Array.from({ length: 5 }, (_, q) => {
      const f = q / 4;
      return onEgg(M.c, m, [sd * (0.15 + 1.2 * f), 1 - 0.7 * f, -0.45 - 0.5 * f * f * s.eye.fierce]);
    }), m[0] * 0.07, 'lid')));
  const fangs = s.mane > 0 && merge(...[1, -1].map((sd) => {
    const at: V3 = [sd * m[0] * 0.42, tipY + m[1] * 0.12, M.c[2] - m[2] * 0.5];
    return tube([at, add(at, [0, 0.03, -m[2] * 0.6])], [m[0] * 0.16, 0.01], [m[0] * 0.12, 0.01], 4, 'tooth');
  }));
  // Fluff out of each cheek, in three points swept back.
  const fluff = merge(...[1, -1].flatMap((sd) => [0, 1, 2].map((q) => {
    const p = onEgg([sd * H.r[0] * 0.5, C[1] + H.r[1] * 0.22, C[2] - H.r[2] * 0.4], [H.r[0] * 0.56, H.r[1] * 0.62, H.r[2] * 0.5], [sd, -0.3 - 0.25 * q, 0.3 - 0.45 * q]);
    const dir = unit(add(p.n, [0, -0.8, -0.15 - 0.2 * q]));
    const L = s.cheek * (1 - 0.2 * q);
    return tube([sub(p.p, scale(p.n, 0.05)), add(p.p, scale(dir, L * 0.5)), add(p.p, scale(dir, L))], [L * 0.34, L * 0.2, 0.01], [L * 0.14, L * 0.09, 0.01], 4, 'coat', { up: p.n });
  })));
  // The patches: a grey one over the brow between the ears, and a rust one over the left eye on a kit.
  const brow = onSkull(s, [0, 0.35, 1]), over = onSkull(s, [-0.6, 0.55, 0.65]);
  const marks = paint([
    disc(add(brow.p, scale(brow.n, 0.02)), brow.n, H.r[0] * 0.42, H.r[1] * 0.36, 8, 'spot', { spin: 0.2 }),
    ...(s.patches > 2 ? [disc(add(over.p, scale(over.n, 0.02)), over.n, H.r[0] * 0.26, H.r[0] * 0.22, 7, 'mark', { spin: 0.6 })] : []),
  ]);
  // Stone spikes over the eyes, swept up and back; a monolith's in two, with a third on each cheek.
  const spikes = s.brow > 0 && merge(...[1, -1].flatMap((sd) => {
    const E = s.eye, out: Mesh[] = [];
    for (let q = 0; q < (s.mane ? 2 : 1); q++) {
      const at = onSkull(s, [sd * E.dir[0] * (1 - 0.15 * q), E.dir[1] * (0.7 - 0.35 * q), E.dir[2] + 0.55 + 0.25 * q]);
      // Swept well back, as horns, in grey stone.
      const dir = unit(add(at.n, [0, -1.6, 0.35]));
      out.push(rock(sub(at.p, scale(at.n, 0.03)), [s.brow * 0.24, s.brow * 0.24, s.brow * (0.5 - 0.1 * q)], { up: dir, fwd: [0, 0, 1], n: 4, point: true, seed: 40 + q + (sd > 0 ? 0 : 5), mat: q ? 'stoneDark' : 'stone' }));
    }
    if (s.mane) {
      const ch = onEgg([sd * H.r[0] * 0.5, C[1] + H.r[1] * 0.22, C[2] - H.r[2] * 0.4], [H.r[0] * 0.56, H.r[1] * 0.62, H.r[2] * 0.5], [sd, -0.1, -0.2]);
      out.push(rock(sub(ch.p, scale(ch.n, 0.03)), [s.brow * 0.2, s.brow * 0.2, s.brow * 0.42], { up: unit(add(ch.n, [0, -1.4, 0.15])), fwd: [0, 0, 1], n: 4, point: true, seed: 50 + (sd > 0 ? 0 : 3), mat: 'stoneDark' }));
    }
    return out;
  }));
  return merge(skull, cheeks, snout, pads, chin, nose, fangs, fluff, spikes, mouth, marks, eyesOf(s, shut));
}

/**
 * A monolith's ruff: the fur round its face in points, from behind the ears
 * down past the jaw and under the chin, standing out and swept back, two
 * rows of them, pale and a little darker by turns.
 */
function maneOf(s: Chip, n: number): Mesh {
  if (!s.mane) return merge();
  const out: Mesh[] = [];
  for (const [row, count, back, L] of [[0, 16, -0.2, 0.8], [1, 14, -0.55, 0.7]] as const) {
    for (let q = 0; q < count; q++) {
      const th = -Math.PI / 2 + ((q + 0.5 * row) / count) * TAU;
      if (Math.sin(th) > 0.55) continue;
      const at = onSkull(s, [Math.cos(th), back, Math.sin(th)]);
      const len = L * s.mane * (0.8 + 0.4 * jitter(q + row * 20)) * (Math.sin(th) < -0.6 ? 1.15 : 1);
      const dir = unit(add(at.n, [0, -0.75, -0.15]));
      const root = sub(at.p, scale(at.n, 0.06));
      out.push(tube([root, add(root, scale(dir, len * 0.55)), add(root, scale(dir, len))], [len * 0.42, len * 0.26, 0.01], [len * 0.14, len * 0.09, 0.01], Math.min(n, 5), (q + row) % 3 === 0 ? 'coatDark' : 'coat',
        { up: at.n }));
    }
  }
  return merge(...out);
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the muzzle. */
function headSolids(s: Chip): Array<{ c: V3; r: V3 }> {
  const M = muzzleOf(s);
  return [{ c: skullAt(s), r: scale(s.head.r, 0.9) }, { c: M.c, r: scale(M.r, 0.85) }];
}

/** A big pointed ear, upright, facing forward and cupped: its fur outside with a grey tip, its lining soft inside with a tuft at the foot. */
function earOf(len: number, w: number, n: number): Mesh {
  const line0 = curve([0, 0, 0], [0, -0.05, len * 0.5], [0, 0.05, len], 5);
  const ws = [w * 0.66, w * 0.96, w, w * 0.74, w * 0.38, 0.02];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.38 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(line0, ws, ws.map((x) => Math.max(0.03, x * 0.22)), n, (ring) => (ring >= 3 ? 'spot' : 'coat'), { up: [0, 1, 0], seam: 'start' });
  const cupped = { ...shell, v: shell.v.map(cup) };
  const side = (sd: number): V3[] => [1, 2, 3, 4].map((q) => cup([sd * ws[q] * 0.66, ws[q] * 0.24 + 0.012, line0[q][2]]));
  const lining = [cup([0, ws[0] * 0.2 + 0.012, line0[0][2] + len * 0.08]), ...side(-1), cup([0, 0.03, len * 0.9]), ...side(1).reverse()];
  const tuft = [cup([-w * 0.3, w * 0.2 + 0.02, len * 0.06]), cup([0, w * 0.22 + 0.02, len * 0.42]), cup([w * 0.3, w * 0.2 + 0.02, len * 0.06])];
  return merge(mesh(cupped.v, cupped.f), paint([{ v: lining, m: 'inner' }, { v: tuft, m: 'coatLight' }]));
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/**
 * A foot, as its stage has it: a dark stone paw of a mitten with three toes
 * on its front; the same capped in a plate of rock with claws under it; or
 * a boulder of a foot with three rocky toes before it. `r` across, its sole
 * `drop` under the ankle (`LegSpec.len`).
 */
function footOf(s: Chip, r: number, drop: number, n: number, k: number, seed: number): Mesh {
  const toes = (m: Mat, big: number): Mesh => merge(...[-1, 0, 1].map((q) => orb([q * r * 0.42, r * 0.95, -drop + r * 0.2 * big], [r * 0.24 * big, r * 0.28 * big, r * 0.22 * big], 5, 3, m)));
  if (s.foot === 'paw') return merge(orbAlong([0, r * 0.35, -drop + r * 0.5], [0, 1, 0], [r, r * 0.62, r * 1.25], n, k, 'claw'), toes('claw', 1));
  if (s.foot === 'capped') {
    return merge(
      orbAlong([0, r * 0.32, -drop + r * 0.5], [0, 1, 0], [r, r * 0.6, r * 1.22], n, k, 'claw'),
      rock([0, r * 0.45, -drop + r * 0.95], [r * 0.95, r * 0.9, r * 0.38], { up: [0, 0.45, 1], n: 5, seed, mat: stoneMat(seed), rough: 0.12 }),
      ...[-1, 0, 1].map((q) => rock([q * r * 0.42, r * 1.2, -drop + r * 0.12], [r * 0.12, r * 0.12, r * 0.24], { up: [0, 1, -0.4], fwd: [0, 0, 1], n: 4, point: true, seed: seed + q + 3, mat: 'stoneDark' })),
    );
  }
  return merge(
    rock([0, r * 0.12, -drop + r * 0.62], [r * 1.02, r * 1.08, r * 0.62], { n: 6, seed, mat: stoneMat(seed), rough: 0.14 }),
    ...[-1, 0, 1].map((q) => rock([q * r * 0.55, r * 0.98, -drop + r * 0.22], [r * 0.26, r * 0.3, r * 0.22], { n: 4, seed: seed + q + 7, mat: q ? 'stoneDark' : 'shellDark', bevel: 0.4 })),
  );
}

/** The rock on its back: each row down both sides (`Chip.back`), a plate lying on the barrel or a spike standing out of it, with moss on a few. */
function backOf(s: Chip, n: number): Mesh {
  const out: Mesh[] = [], moss: Disc[] = [];
  s.back.forEach((row, ri) => {
    const ridge = Math.abs(row.th - Math.PI / 2) < 0.01;
    for (const sd of ridge ? [1] : [1, -1]) {
      for (let q = 0; q < row.count; q++) {
        const id = ri * 31 + q * 3 + (sd > 0 ? 0 : 17);
        const f = row.count > 1 ? q / (row.count - 1) : 0.5;
        const y = lerp(row.y0, row.y1, f) + (ridge ? 0 : 0.12 * (jitter(id + 1) - 0.5)) + (sd > 0 ? 0 : 0.06);
        const th0 = row.th + (ridge ? 0 : 0.1 * (jitter(id + 2) - 0.5)), at0 = onRings(s.body, y, th0), at = sd > 0 ? at0 : left(at0);
        // Bigger toward the middle of the back, smaller at its ends.
        const big = (0.78 + 0.32 * Math.sin(Math.PI * f)) * (0.88 + 0.24 * jitter(id + 4));
        if (row.spike && q % 2 === 0) {
          // A broad wedge of a spike, swept a little back.
          const dir = unit(add(at.n, [0, -0.4, 0]));
          out.push(rock(sub(at.p, scale(at.n, row.r[0] * 0.3)), scale(row.r, big), { up: dir, fwd: [0, 1, 0], n: 4, point: true, seed: id, mat: stoneMat(id + 1), rough: 0.1 }));
        } else if (row.spike) {
          // Between the points, a chunky block standing up on the ridge.
          const r: V3 = [row.r[0] * big, row.r[1] * big * 0.9, row.r[2] * big * 0.75];
          out.push(rock(add(at.p, scale(at.n, r[2] * 0.45)), r, { up: at.n, fwd: [0, 1, 0], n: 5, seed: id, mat: stoneMat(id + 2), bevel: 0.25 }));
        } else {
          // A slab: laid like a tile, its back edge off the barrel over the next; or stood up off it by `stand`, its broad face to
          // the back and its top edge up, so a row of them is a ridge of stone.
          const st = (row.stand ?? 0) * Math.PI / 180, back = unit(sub([0, -1, 0], scale(at.n, dot([0, -1, 0], at.n))));
          const up = unit(add(add(scale(at.n, Math.cos(st)), scale(back, Math.sin(st))), [0, st ? 0 : 0.3, 0]));
          const r = scale(row.r, big), [, Y] = frameOf(up, [0, 1, 0]);
          const c = add(add(at.p, scale(at.n, r[2] * 0.35 * Math.cos(st))), scale(Y, r[1] * 0.5 * Math.sin(st)));
          out.push(rock(c, r, { up, fwd: [0, 1, 0], n: s.foot === 'paw' ? 5 : 5 + (id % 2), seed: id, mat: stoneMat(id) }));
          const m = !st && mossOn(add(c, scale(up, r[2])), up, Math.min(r[0], r[1]), id);
          if (m) moss.push(m);
        }
      }
    }
  });
  return merge(...out, paint(moss));
}

/**
 * Armour of rock on the legs, as a stage has it: a plate on the front of
 * each shin and, wrapped all round, two more at its sides; on the lower
 * leg's bone, so it goes with it.
 */
function shinOf(s: Chip, fore: boolean, side: number, seed: number): Mesh {
  if (!s.armour) return merge();
  const L = (fore ? 0.46 : 0.52) * s.legs, w = s.thick, out: Mesh[] = [];
  // Each plate: how far round from the front of the shin toward its outside (radians), how far down it, and how big.
  const plates: Array<[number, number, number]> = s.armour > 1 ? [[0, 0.32, 1], [1.4, 0.55, 0.85], [-1.4, 0.5, 0.8], [2.8, 0.4, 0.7]] : [[0.1, 0.3, 1.05], [1.3, 0.62, 0.8]];
  plates.forEach(([th, at, k], q) => {
    const dir: V3 = [side * Math.sin(th), Math.cos(th), 0];
    const c: V3 = add([0, 0, -L * at], scale(dir, w * 0.85));
    out.push(rock(c, [w * 1.15 * k, w * 0.6 * k, L * (s.armour > 1 ? 0.42 : 0.34) * k], { up: [0, 0, 1], fwd: dir, n: 5, seed: seed + q, mat: s.armour > 1 ? greyMat(seed + q) : stoneMat(seed + q), rough: 0.14 }));
  });
  return merge(...out);
}

/** Which of a kit's legs have a patch on them, and of which colour: a grey one on a fore leg and a rust one on a hind thigh, as the concept's. */
const LEG_PATCHES: Record<string, Mat> = { fl1: 'spot', hr0: 'mark', fr0: 'spot' };
/** A patch on the outside of a leg, on its bone: half way down it. */
function legPatch(s: Chip, key: string): Mesh {
  const fore = key[0] === 'f', side = key[1] === 'r' ? 1 : -1, upper = key[2] === '0';
  const L = (upper ? (fore ? 0.5 : 0.56) : fore ? 0.46 : 0.52) * s.legs, w = s.thick * (upper ? (fore ? 1.5 : 1.6) : 0.9);
  const n: V3 = unit([side, 0.35, 0]);
  return paint([disc(add([0, 0, -L * 0.45], scale(n, w * 1.02)), n, w * 0.75, L * 0.3, 7, LEG_PATCHES[key], { spin: 0.4 })]);
}

/** Its patches: blotches of grey and rust in its fur, along both flanks and over the rump and the shoulders. */
function patches(s: Chip): Mesh {
  const out: Disc[] = [];
  const spots: Array<[number, number, number, Mat]> = [[-0.62, 0.35, 0.3, 'spot'], [0.3, 0.2, 0.26, 'mark'], [-0.15, -0.3, 0.22, 'spot'], [0.75, 0.6, 0.2, 'mark'], [-0.95, 0.9, 0.22, 'mark'], [0.05, 0.9, 0.2, 'spot']];
  for (const sd of [1, -1]) {
    for (let q = 0; q < (s.patches ? Math.min(spots.length, s.patches + 2) : 0); q++) {
      const [fy, th, r, m] = spots[q];
      const y = (fy + (sd > 0 ? 0 : 0.15 * (jitter(q) - 0.4))) * s.len * 0.5;
      const ang = sd > 0 ? th : Math.PI - th;
      for (let e = 0; e < 2; e++) {
        const { p, n } = onRings(s.body, y + (e - 0.5) * r * 0.6, ang + (e - 0.5) * 0.18 * (jitter(q + e) - 0.3));
        out.push(disc(add(p, scale(n, 0.025)), n, r * s.len * 0.36 * (0.7 + 0.3 * jitter(q * 3 + e)), r * s.len * 0.3, 7, m, { spin: jitter(q + e * 7) * 3 }));
      }
    }
  }
  return paint(out);
}

/**
 * The tail's links and the club on the end of them: a kit's a furred tail
 * ringed in grey with a few chips of stone toward its end; the older ones' a
 * chain of blocks of stone, grey and rust by turns. The club a clump of
 * stones round a core on a kit, a bigger clump on a prowler, and on a
 * monolith a boulder of a few great blocks.
 */
function tailOf(s: Chip, n: number): { links: Mesh[]; club: Mesh } {
  const T = s.tail;
  const links = T.links.map((L, q) => {
    const w0 = T.w[q], w1 = T.w[Math.min(q + 1, T.w.length - 1)];
    if (!T.stone) {
      const fur = tube([[0, 0.05, 0], [0, -L * 0.5, 0], [0, -L - 0.03, 0]], [w0, (w0 + w1) / 2, w1], [w0, (w0 + w1) / 2, w1], Math.min(n, 7), (ring, j) => {
        // Mottled, a scatter of grey and rust facets rather than rings.
        const k = jitter(q * 13 + ring * 7 + j * 3.1);
        return k < 0.16 ? 'spot' : k < 0.24 ? 'mark' : 'coat';
      }, { seam: 'both' });
      const chip = q >= T.links.length - 2 && rock([0, -L * 0.5, w0 * 0.85], [w0 * 0.7, w0 * 0.8, w0 * 0.45], { up: [0, 0, 1], n: 4, seed: 60 + q, mat: stoneMat(60 + q) });
      return merge(fur, chip);
    }
    // A squat block of stone, as deep as it is wide, with a knob of rock on top of it.
    return merge(
      rock([0, -L * 0.5, 0], [w0 * 1.05, L * 0.6, w0 * 1.02], { up: [0, 0, 1], fwd: [0, 1, 0], n: 6, seed: 70 + q, mat: q % 2 ? 'stone' : 'shell', bevel: 0.4 }),
      rock([0.15 * w0 * (q % 2 ? 1 : -1), -L * 0.45, w0 * 0.9], [w0 * 0.42, L * 0.32, w0 * 0.34], { up: [0, -0.2, 1], n: 5, seed: 80 + q, mat: q % 2 ? 'shellDark' : 'stoneDark', bevel: 0.35 }),
    );
  });
  const R = T.club, c = clubMid(s), out: Mesh[] = [], moss: Disc[] = [];
  if (T.blocky) {
    // A boulder of great blocks: a grey core and nine more of every size heaped round it, each tipped its own way so no two
    // share a face, grey and rust.
    out.push(rock(c, [R * 0.6, R * 0.62, R * 0.58], { n: 4, seed: 90, mat: 'stone', bevel: 0.2, rough: 0.12, spin: 0.4 }));
    for (let q = 0; q < 9; q++) {
      const a = (q / 9) * TAU + jitter(q + 3) * 0.5, el = (jitter(q + 30) - 0.45) * 1.9;
      const d = unit([Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el) - 0.15, Math.sin(el)]);
      const r = R * (0.26 + 0.18 * jitter(q + 41)), at = add(c, scale(d, R * (0.5 + 0.08 * jitter(q + 7))));
      const up = unit(add(d, [0.5 * (jitter(q + 9) - 0.5), 0.5 * (jitter(q + 11) - 0.5), 0.6]));
      out.push(rock(at, [r * (0.9 + 0.3 * jitter(q + 13)), r * (0.85 + 0.35 * jitter(q + 15)), r * (0.7 + 0.3 * jitter(q + 17))], { n: 4 + (q % 3 === 0 ? 1 : 0), seed: 91 + q, mat: stoneMat(93 + q * 2), bevel: 0.24, rough: 0.14, up, spin: jitter(q + 19) * TAU }));
      const m = d[2] > 0.3 && mossOn(add(at, scale(up, r * 0.7)), up, r, q + 3);
      if (m) moss.push(m);
    }
  } else {
    out.push(rock(c, [R * 0.62, R * 0.62, R * 0.58], { n: 6, seed: 100, mat: 'stone', bevel: 0.3 }));
    const count = s.slam ? 8 : 6;
    for (let q = 0; q < count; q++) {
      const a = (q / count) * TAU + jitter(q) * 0.6, el = (jitter(q + 30) - 0.4) * 1.6;
      const d = unit([Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el) - 0.2, Math.sin(el)]);
      const r = R * (0.3 + 0.12 * jitter(q + 40));
      out.push(rock(add(c, scale(d, R * 0.52)), [r, r * 1.05, r * 0.85], { up: d, n: 5, seed: 110 + q, mat: stoneMat(111 + q) }));
      const m = mossOn(add(c, scale(d, R * 0.52 + r * 0.85)), d, r, q + 9);
      if (m && d[2] > 0.3) moss.push(m);
    }
  }
  return { links, club: merge(...out, paint(moss)) };
}

/** The rock it quarries: a squat outcrop of two or three blocks, grey with a rust one, on its own bone on the ground. */
function quarryOf(s: Chip): Mesh {
  const R = rockR(s), H = rockH(s);
  return merge(
    rock([0, 0, H * 0.55], [R * 0.8, R * 0.72, H * 0.6], { n: 5, seed: 130, mat: 'stone', bevel: 0.25, rough: 0.12 }),
    rock([R * 0.5, -R * 0.35, H * 0.35], [R * 0.48, R * 0.5, H * 0.42], { n: 5, seed: 131, mat: 'shell', bevel: 0.3 }),
    rock([-R * 0.45, R * 0.2, H * 0.3], [R * 0.42, R * 0.4, H * 0.34], { n: 4, seed: 132, mat: 'stoneDark', bevel: 0.3 }),
  );
}

/** A stage's pieces: a cat's body (`quadPieces`) with its own head, ears, paws, tail and club, and its rock: chips, plates and spikes on its back, plates on its legs. */
function chipBuild(s: Chip, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6);
  const skull = headSolids(s)[0], spec = specOf(s), w = s.thick;
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh; mat?: Mat } => {
    const L = (fore ? 0.5 : 0.56) * s.legs;
    return { upper: [fore ? 0.28 : 0.1, -L, w * (fore ? 1.75 : 1.9), w * 1.05], lower: [0, -(fore ? 0.46 : 0.52) * s.legs, w, w * 0.78], foot: footOf(s, s.paw, s.paw * 0.55, n, k, fore ? 140 : 150) };
  };
  // Shoulders and haunches, part of the barrel: a mass over each leg reaching down to where it comes out from under the body; a
  // plate of rock on each on the older ones.
  const quarters = merge(...[1, -1].flatMap((sd) => {
    const hip = spec.hind.at, sh = spec.fore.at;
    const ham: V3 = [sd * (hip[0] + w * 0.15), hip[1] + 0.02, hip[2] + 0.18], hr: V3 = [w * 1.2 + 0.08, w * 1.6 + 0.12, s.body.h[2] * 0.55];
    const shoulder: V3 = [sd * (sh[0] + w * 0.1), sh[1] - 0.02, sh[2] + 0.22], shr: V3 = [w * 1.05 + 0.08, w * 1.35 + 0.1, s.body.h[4] * 0.5];
    const out: Mesh[] = [orb(ham, hr, n, k, 'coat'), orb(shoulder, shr, n, k, 'coat')];
    if (s.armour) {
      for (const [c, r, id] of [[ham, hr, 160], [shoulder, shr, 170]] as Array<[V3, V3, number]>) {
        const up = unit([sd * 0.9, 0, 0.55]);
        out.push(rock(add(c, [sd * r[0] * 0.7, 0, r[2] * 0.45]), [r[1] * 0.62, r[0] * 0.75, r[2] * 0.3 * s.armour], { up, fwd: [0, 1, 0], n: 5, seed: id + (sd > 0 ? 0 : 5), mat: s.armour > 1 ? greyMat(id + (sd > 0 ? 1 : 4)) : stoneMat(id + (sd > 0 ? 1 : 4)) }));
      }
    }
    return out;
  }));
  const tail = tailOf(s, n);
  const pieces = quadPieces({
    n, k,
    body: { ...s.body, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.95, len: s.neck.len },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s.ear.len, s.ear.w, n),
    earTurn: -48,
    tail: [],
    fore: legs(true),
    hind: legs(false),
    breath: 0.04,
    extras: [
      { key: 'back', mesh: backOf(s, n), bone: 'trunk', bias: 0.1, after: ['body', 'neck'] },
      ...(s.mane ? [{ key: 'mane', mesh: maneOf(s, n), bone: 'head', bias: 0.12, after: ['neck'], under: ['head'], hide: [skull] } as Piece] : []),
    ],
  });
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    if (!s.armour) continue;
    pieces.push({ key: `${key}shin`, mesh: shinOf(s, fore, side, key.charCodeAt(0) * 3 + key.charCodeAt(1)), bone: `${key}1`, bias: 0.03, after: [`${key}1`, `${key}2`, 'body'], front: [side * 0.7, fore ? 0.7 : -0.7, 0] });
    // A plate on the outside of the upper leg, over the forearm or the thigh, where it comes out from under the body.
    const L = (fore ? 0.5 : 0.56) * s.legs, out = unit([side, fore ? 0.15 : -0.2, 0]), id = key.charCodeAt(0) * 5 + key.charCodeAt(1);
    const plate = rock(add([0, fore ? -0.12 * L : 0, -L * 0.62], scale(out, w * (fore ? 1.2 : 1.35))), [w * 0.95, L * 0.3, w * 0.32 * Math.min(s.armour, 1.4)], { up: out, fwd: [0, 0, 1], n: 5, seed: id, mat: s.armour > 1 ? greyMat(id) : stoneMat(id), rough: 0.14 });
    pieces.push({ key: `${key}plate`, mesh: plate, bone: `${key}0`, bias: 0.035, after: [`${key}0`, `${key}1`, 'body'], front: [side * 0.7, fore ? 0.7 : -0.7, 0] });
  }
  tail.links.forEach((m, q) => pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.04 + q * 0.01, chain: s.tail.stone ? undefined : 'tail' }));
  pieces.push({ key: 'club', mesh: tail.club, bone: 'club', bias: 0.04, after: [`tail${s.tail.links.length - 1}`] });
  pieces.push({ key: 'quarry', mesh: quarryOf(s), bone: 'rock', bias: 0, shown: (a) => a.act?.kind === 'work' });
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(pc.mesh, quarters, patches(s)) };
    if (LEG_PATCHES[pc.key] && s.legPatches) return { ...pc, mesh: merge(pc.mesh, legPatch(s, pc.key)) };
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const DUST: RGB = [186, 170, 148];
/** The colours of what flies off it, the same on every variant: chips of grey stone, of rust, and of dark stone. */
const CHIPS = { stone: [160, 154, 148] as RGB, shell: [204, 128, 82] as RGB, stoneDark: [116, 110, 108] as RGB };

/** A chip of stone in the air: a small hard-edged shard, `r` across, turned `ang`, lit on one face and dark on the other. */
function shard(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  const pts: Array<[number, number]> = [];
  for (let q = 0; q < 5; q++) {
    const t = ang + (q / 5) * TAU, k = r * (0.65 + 0.4 * jitter(q + ang * 3));
    pts.push([x + Math.cos(t) * k, y + Math.sin(t) * k * 0.8]);
  }
  g.beginPath();
  pts.forEach(([px, py], q) => (q ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
  g.fillStyle = css(mix(c, [60, 50, 50], 0.25), al);
  g.fill();
  g.lineWidth = Math.max(r * 0.22, 0.12);
  g.strokeStyle = css(mix(c, [40, 30, 30], 0.55), al);
  g.stroke();
  // Its lit face: the half toward the light.
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  g.lineTo(pts[1][0], pts[1][1]);
  g.lineTo(pts[2][0], pts[2][1]);
  g.lineTo(x, y);
  g.closePath();
  g.fillStyle = css(mix(c, [255, 250, 236], 0.25), al);
  g.fill();
}

/** A soft puff of dust at a point, `r` across. */
function dust(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  if (al <= 0.01) return;
  const [x, y] = onScreen(view, at);
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(DUST, al));
  grad.addColorStop(0.6, css(DUST, al * 0.5));
  grad.addColorStop(1, css(DUST, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y - r * 0.2, r, r * 0.62, 0, 0, TAU);
  g.fill();
}

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Quarrybash's. */
const bigness = (s: Chip): number => Math.sqrt(s.tail.club / 0.62);
/** The colour of a chip by its number: the stone's grey or its rust. */
const chipColour = (i: number, pal: { stone: RGB; shell: RGB; stoneDark: RGB }): RGB => (jitter(i * 2.3) < 0.45 ? pal.stone : jitter(i * 2.3) < 0.85 ? pal.shell : pal.stoneDark);

/** A ring of a shock going out over the ground from `c`, `r` across, and cracks `cracks` long out from under it. */
function shock(g: CanvasRenderingContext2D, view: View, c: V3, r: number, al: number, cracks: number, seed: number): void {
  const [x, y] = onScreen(view, c);
  const ex = view.ex, ey = view.ey;
  // The ground's own axes on the screen, so a ring on it is an ellipse lying on it.
  g.save();
  g.transform(ex[0], ex[1], ey[0], ey[1], x, y);
  if (cracks > 0 && al > 0.01) {
    g.strokeStyle = css([70, 56, 50], Math.min(1, al * 1.6));
    g.lineCap = 'round';
    for (let q = 0; q < 7; q++) {
      const a = (q / 7) * TAU + jitter(q + seed) * 0.8;
      let px = Math.cos(a) * cracks * 0.12, py = Math.sin(a) * cracks * 0.12;
      g.beginPath();
      g.moveTo(px, py);
      g.lineWidth = cracks * 0.045;
      for (let e = 1; e <= 3; e++) {
        const b = a + (jitter(q * 4 + e + seed) - 0.5) * 0.7, len = cracks * (0.22 + 0.12 * jitter(q + e * 3 + seed)) * (1 - 0.2 * e);
        px += Math.cos(b) * len;
        py += Math.sin(b) * len;
        g.lineTo(px, py);
      }
      g.stroke();
    }
  }
  if (r > 0) {
    g.lineWidth = Math.min(r * 0.07, 0.16);
    g.strokeStyle = css([236, 224, 200], al);
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.stroke();
  }
  g.restore();
}

/**
 * The strike landing: chips of stone off the club and the ground thrown up
 * and out, tumbling and coming down, and a puff of dust where it hit; the
 * Quarrybash's with a ring of dust going out; the Monolithump's cracking the
 * ground and sending a shock ring out over it.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Chip, at: Bones, t: number, front: boolean, pal: { stone: RGB; shell: RGB; stoneDark: RGB }): void {
  const since = (t - STRIKE.hit) * ACT_SECS.strike;
  if (since <= 0) return;
  const club = place(at.club, clubMid(s)), ground: V3 = [club[0], club[1], 0.04];
  const big = bigness(s), fade = 1 - ramp(t, 0.72, 1), mid = at.body.t;
  // The top of its back over the ground.
  const top = mid[2] + s.body.h[4] + 0.1;
  // The plume of dust going up from the blow: behind the body from the near side, and once it is up over it, in front.
  const rise = s.tail.club * 0.6 + 9 * since, plume = add(ground, [0, 0, rise]);
  if (front === (nearSide(ground, mid, view) || rise > top)) {
    dust(g, view, plume, (s.tail.club + 0.3) * (1 + 4 * since) * (1 + 0.3 * s.slam), 0.5 * (1 - smooth(since / 0.26)));
  }
  if (!front) {
    // The ring of the blow going out over the ground; a monolith's cracking it, the cracks running out in the first moment.
    shock(g, view, ground, s.tail.club * (1.1 + 5 * since) * [1.1, 0.9, 1.3][s.slam], [0.3, 0.4, 0.7][s.slam] * (1 - smooth(since / 0.28)), 0, 3);
    if (s.slam === 2) shock(g, view, ground, 0, 0.55 * fade, s.tail.club * 2.2 * smooth(since / 0.05), 7);
    dust(g, view, ground, s.tail.club * (1.3 + 3.5 * since) * (1 + 0.4 * s.slam), 0.42 * (1 - smooth(since / 0.3)));
  }
  const count = 10 + 3 * s.slam;
  for (let q = 0; q < count; q++) {
    const a = (q / count) * TAU + jitter(q) * 0.7, speed = (1.6 + 2 * jitter(q + 9)) * (0.8 + 0.25 * s.slam) * big;
    // Thrown up well over its back, so a blow on its far side still shows over it.
    // (The strike is over in half a second, so they must go fast to go anywhere in it.)
    // On a kit, four of them knocked straight up off the top of the club, to show over its back at once.
    const up = s.slam === 0 && q % 3 === 0 && q < 10;
    const v: V3 = up ? [Math.cos(a) * 0.8, Math.sin(a) * 0.8, 15] : [Math.cos(a) * speed * 1.6, Math.sin(a) * speed * 1.6, (9 + 7 * jitter(q + 2)) * (0.9 + 0.15 * s.slam)];
    const p = thrown(add(ground, [0, 0, s.tail.club * (up ? 1.6 : 0.4)]), v, since, 9);
    // Once up over its back a chip is in the air in front of whatever is behind it, whichever side it came from.
    if ((nearSide(p, mid, view) || p[2] > top) !== front) continue;
    const [x, y] = onScreen(view, p);
    shard(g, x, y, (0.17 + 0.1 * jitter(q + 5)) * big * (s.slam ? 1 + 0.25 * s.slam : up ? 2 : 1.4), q * 1.7 + since * 14 * (q % 2 ? 1 : -1), chipColour(q, pal), fade);
  }
  if (front) {
    for (let q = 0; q < 2 + s.slam; q++) {
      const a = q * 2.4 + 0.6, r = s.tail.club * (0.8 + 2.4 * since) * (1 + 0.3 * s.slam);
      dust(g, view, add(ground, [Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 0.15]), r * 0.8, 0.32 * (1 - smooth(since / 0.25)));
    }
  }
}

/**
 * Quarrying: at each blow of the club, chips of stone flying off the top of
 * the rock with a puff of dust; at each rake of the paw, grit and a few
 * small chips kicked off its foot; and a shard broken out of it at the end of
 * the second rake, tumbling down beside the paw. A go played once, from
 * standing, throws nothing until its first blow.
 */
function quarrySpray(g: CanvasRenderingContext2D, view: View, s: Chip, b: Bones, a: Anim, t: number, front: boolean, pal: { stone: RGB; shell: RGB; stoneDark: RGB }): void {
  const hit = rockOf(s), big = bigness(s), R = rockR(s), H = rockH(s), mid = b.body.t;
  const top: V3 = [hit[0], hit[1], H * 1.15];
  // Each burst: when it starts in the go, where from, how many, how fast and how high, and how big.
  const bursts: Array<[number, V3, number, number, number, number]> = [
    [WORK.hit, top, 12, 2.0, 5.6, 0.22],
    [WORK.rakes[0] + WORK.rake * 0.55, [hit[0] - R * 0.7, hit[1] + R * 0.2, 0.15], 8, 1.4, 2.8, 0.24],
    [WORK.rakes[1] + WORK.rake * 0.55, [hit[0] - R * 0.7, hit[1] + R * 0.2, 0.15], 8, 1.4, 2.8, 0.24],
  ];
  for (const [t0, from, count, speed, rise, size] of bursts) {
    if (t < t0 && a.graze < 0.5) continue;
    const since = frac(t - t0) * ACT_SECS.work;
    if (since > 0.6) continue;
    const fade = 1 - smooth((since - 0.3) / 0.3);
    for (let q = 0; q < count; q++) {
      const id = q + t0 * 50;
      const ang = jitter(id) * TAU, sp = speed * (0.6 + 0.6 * jitter(id + 3)) * big;
      // Off the blow, thrown out and away from the body rather than into it.
      const v: V3 = [Math.cos(ang) * sp + 0.6 * big, Math.sin(ang) * sp + 0.5 * big, rise * (0.7 + 0.6 * jitter(id + 6))];
      const p = thrown(from, v, since);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      shard(g, x, y, size * big * (0.7 + 0.6 * jitter(id + 1)), id + since * 12, chipColour(id, pal), fade);
    }
    // A puff of dust where it came from, on whichever side of the body that is: a big one off the blow, a low one off the paw.
    if (nearSide(from, mid, view) === front) {
      dust(g, view, add(from, [0, 0, (t0 === WORK.hit ? 0.6 : 0.2) * since]), (0.7 + 2.6 * since) * big * (t0 === WORK.hit ? 1.3 : 0.9), (t0 === WORK.hit ? 0.5 : 0.42) * (1 - smooth(since / 0.5)));
    }
  }
  // The shard broken out as the second rake drags along the rock: a wedge of stone dropping off its side, landing beside it
  // (`SHARD.fall` seconds on, when it is heard) and lying there, fading as the next go's rakes begin.
  const out = WORK.rakes[1] + WORK.rake * SHARD.at, T = SHARD.fall;
  if (t >= out || a.graze >= 0.5) {
    const since = Math.min(frac(t - out) * ACT_SECS.work, T);
    const z0 = H * 0.7, from: V3 = [hit[0] - R * 0.55, hit[1] - R * 0.4, z0];
    const p = thrown(from, [-0.5 * big, -0.6 * big, (4.5 * T * T - z0) / T], since);
    if (nearSide(p, mid, view) === front) {
      const [x, y] = onScreen(view, p);
      const al = t >= out ? 1 : 1 - ramp(t, WORK.rakes[0], WORK.rakes[1]);
      shard(g, x, y, 0.3 * big, 0.8 + since * 9, pal.shell, al);
    }
  }
}

/**
 * Evolving: at the start, a burst of stone chips and dust out of it, which
 * covers the moment it changes into its new body; then pebbles and plates
 * of rock swirling in round it from wide at its feet and drawn in onto its
 * back, gone into it at the flash, the new stone on it.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Chip, b: Bones, t: number, front: boolean, pal: { stone: RGB; shell: RGB; stoneDark: RGB }): void {
  const big = bigness(s), mid: V3 = [0, 0, b.body.t[2]];
  // Bursting off the whole of it from the first moment: shards flying out from all over its body, through a cloud of stone dust
  // thick enough to hide the change of body under it, which thins and is gone by a quarter of the way through.
  const burst = 1 - ramp(t, 0.1, 0.26);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    if (front) {
      const cloud = (1 - ramp(t, 0.05, 0.24)) * 0.95;
      for (const [y, z, r] of [[0, 0.75, 0.7], [s.len * 0.42, 1.05, 0.5], [-s.len * 0.42, 0.85, 0.5], [0, 1.35, 0.45]]) {
        dust(g, view, [0, y, b.body.t[2] * z + since * 0.8], (s.len * r + 1.6 * since) * (0.85 + 0.15 * big), cloud);
      }
    }
    for (let q = 0; q < 40; q++) {
      const th = (q / 40) * TAU * 2.6 + jitter(q) * 0.7, el = (jitter(q + 40) - 0.35) * 2.2;
      const dir = unit([Math.cos(th), Math.sin(th) * 1.3, el]);
      // From a little off its surface, so none is a scab on it, and in at once over the first moment.
      const from: V3 = [dir[0] * (s.body.w[3] * 0.9 + 0.1), dir[1] * (s.len * 0.55 + 0.1), b.body.t[2] + dir[2] * (s.body.h[3] * 1.1 + 0.1)];
      const v = scale(add(dir, [0, 0, 0.6]), (3 + 3 * jitter(q + 3)) * big);
      const p = thrown(from, v, since, 6);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      shard(g, x, y, (0.26 + 0.16 * jitter(q + 1)) * big, q + since * 9, chipColour(q, pal), burst * ramp(t, 0, 0.03));
    }
  }
  // Swirling in: each pebble round and round and in toward the back, rising as it goes, and in by the flash.
  const fade = ramp(t, 0.08, 0.2) * (1 - ramp(t, 0.47, 0.52));
  if (fade <= 0) return;
  const tall = s.legs + s.body.h[4] * 2, wide = s.len * 0.95;
  for (let q = 0; q < 22; q++) {
    // Each to its own place along the ridge of the back, coming in from its own way round, some sooner than others.
    const back: V3 = [0, s.len * 0.45 * (jitter(q * 1.7) * 2 - 1), tall];
    const u = clamp((t - 0.1 - 0.12 * jitter(q + 13)) / (0.3 + 0.08 * jitter(q + 2)));
    const ang = (q / 22) * TAU + u * TAU * (1.1 + 0.6 * jitter(q + 5));
    const r = wide * (1 - u) ** 1.3;
    const p: V3 = add(scale(back, u ** 0.7), [Math.cos(ang) * r * 0.8, Math.sin(ang) * r, (1 - u) * (0.2 + 0.6 * jitter(q + 21))]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    shard(g, x, y, (0.28 + 0.12 * (q % 3)) * big * (1 - 0.4 * u), ang * 1.3, chipColour(q + 7, pal), fade * ramp(u, 0, 0.15));
  }
  // As they knit into its back, a glint at each place along the ridge with a small ring going out from it.
  if (front && t > 0.38 && t < 0.56) {
    for (let q = 0; q < 6; q++) {
      // Each its own size and its own moment, as each pebble arrives.
      const t0 = 0.45 + 0.03 * (jitter(q + 21) * 2 - 1) + 0.012 * (q % 3), knit = hump(t, t0, 0.05);
      if (knit <= 0) continue;
      const at = onRings(s.body, s.len * 0.45 * (q / 2.5 - 1), Math.PI / 2), [x, y] = onScreen(view, place(b.body, add(at.p, scale(at.n, 0.3))));
      const size = 0.6 + 0.8 * jitter(q + 7);
      const k = knit * (0.6 + 0.4 * jitter(q + 3)), r = (0.12 + 0.3 * ramp(t, t0 - 0.05, t0 + 0.05)) * big * size;
      g.strokeStyle = css([255, 246, 220], 0.8 * k);
      g.lineWidth = Math.max(0.06, r * 0.18);
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.stroke();
      g.fillStyle = css([255, 252, 240], k);
      g.beginPath();
      for (let e = 0; e < 8; e++) {
        const a = (e / 8) * TAU, l = e % 2 ? r * 0.25 : r * 0.7;
        if (e) g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); else g.moveTo(x + l, y);
      }
      g.closePath();
      g.fill();
    }
  }
}


/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, quarries and evolves. */
function chipKind(s: Chip): Kind {
  const bones = chipBones(s);
  // Where everything is at the moment the club lands, for what is knocked off then to fly from.
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: STRIKE.hit } });
  return {
    bones,
    build: (lod) => chipBuild(s, lod),
    // The variant's coat is its fur and its markings the rust of its stone; the fur's patches lean to the stone's two colours, and
    // its grey stone is its own grey, the same warm grey whatever the coat. Its eyes are amber on every variant.
    palette: (coat, mark) => {
      const grey: RGB = mix([150, 145, 140], coat, 0.12), rust: RGB = mix(mark, [150, 145, 140], 0.08);
      // Its fur painted half way from the variant's own colour to the island's chalk (`pastel`): a beige that is beige, not cream.
      const fur = mix(pastel(coat, 30), coat, 0.45);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: darker(fur, 0.2),
        mark: mix(rust, fur, 0.15),
        spot: mix([100, 96, 96], fur, 0.1),
        coatLight: mix(fur, [255, 250, 240], 0.45),
        muzzle: mix(fur, [255, 250, 240], 0.25),
        inner: mix([236, 178, 160], coat, 0.25),
        nose: [96, 66, 64],
        lid: [86, 62, 58],
        eye: [44, 30, 32],
        crystal: [232, 158, 52],
        crystalDark: [196, 112, 36],
        claw: mix([96, 90, 92], coat, 0.1),
        stone: grey,
        stoneDark: mix(grey, [70, 64, 66], 0.35),
        shell: rust,
        shellDark: mix(rust, [70, 50, 44], 0.3),
        moss: mix([132, 158, 96], grey, 0.35),
        tooth: [246, 238, 220],
      }, 30);
    },
    shadow: [s.len * 0.75, s.body.w[4] * 0.95],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') strikeBurst(g, view, s, atHit(a), act.t, front, CHIPS);
      else if (act.kind === 'work') quarrySpray(g, view, s, b, a, act.t, front, CHIPS);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front, CHIPS);
    },
  };
}

export const CHIPTAIL = chipKind(CHIPTAIL_LOOK);
export const QUARRYBASH = chipKind(QUARRYBASH_LOOK);
export const MONOLITHUMP = chipKind(MONOLITHUMP_LOOK);
