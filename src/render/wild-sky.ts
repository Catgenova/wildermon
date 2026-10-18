import {
  ACT_SECS, add, clamp, coatPalette, cross, curve, DEG, disc, dot, frac, lerp, lighter, darker, merge, mirrored, mix, moved, orb, orbAlong,
  paint, pastel, quadBonesOf, scale, smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece, type QuadPose,
  type QuadSpec,
} from './beasts';
import { cut, under } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The sky line: the Skylooklet, a fawn-and-feather chick of a thing, which
 * grows into the Skywarden, a long-legged young gazelle-crane, and then the
 * Skyrange, the tallest of them, a master scout on stilts with a crest swept
 * back like antlers and leaves hung about its shoulders. The species is
 * still `warda` underneath, as saves and the database know it.
 *
 * Each is a slender deer with a bird's feathers: a fawn coat with a cream
 * throat and chest, big ears pink inside, a crest of long slate-blue feathers
 * rising back off the forehead, wings folded down each flank -- brown
 * coverts over blue flight feathers -- and four long thin legs, fawn at the
 * top and dark from the knee down, with a feathered tuft over each hoof.
 * All three are built by one set of functions from a description of the
 * stage (`Sky`), so a stage is its numbers.
 *
 * It keeps watch. Standing, every few seconds it lifts its head high and
 * looks slowly round one way and then the other, the crest lifting a little
 * as it does (`lookout`).
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along something round: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** One feather of the crest: its length, how far it leans out to the side (-1 left to 1 right), how far back from upright it is swept (degrees), and whether it is a blue one or a fawn one. */
type Plume = [number, number, number, 'blue' | 'fawn'];

interface Sky {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest. */
  body: Rings;
  /** Each leg: where it hangs from on the right (the elbow, the hip), and the upper, the lower and the drop from the fetlock to the sole. */
  fore: { at: V3; len: [number, number, number] };
  hind: { at: V3; len: [number, number, number] };
  /** How thick the legs are: the upper at its top and its foot, the lower at its top and its foot (radii). */
  thick: [number, number, number, number];
  /** The feet: how wide, and what they are -- a chick's two dark toes, a dark split hoof, or a pale cloven one with dark claws. */
  foot: { r: number; kind: 'toes' | 'split' | 'pale' };
  /** How long the feathered tuft over each hoof is; nought for none. */
  fetlock: number;
  neck: { at: V3; len: number; w: [number, number]; lean: number };
  /** The head's rings, back of the skull to the nose, and how far its nose is carried up. */
  head: Rings & { pitch: number };
  /** The eyes: how far along the head, how far up its side (radians), how big, and how much of a dark stripe runs back from each (nought for none). */
  eye: { y: number; up: number; size: number; stripe: number };
  /** Each ear: how long and wide, splayed out and laid back (degrees), and where on the head it is rooted (along it, and up its side). */
  ear: { len: number; w: number; out: number; back: number; y: number; up: number };
  /** The crest's feathers, and how far back along the crown they are rooted. */
  crest: Plume[];
  /** Fawn feathers swept back off each cheek: how many and how long. */
  cheek: [number, number];
  /** The cream ruff at the throat: how many feathers and how long. */
  ruff: [number, number];
  /** The folded wing: its shoulder, its length, how steeply it hangs (degrees under level), and how many coverts, secondaries and primaries. */
  wing: { at: V3; len: number; hang: number; coverts: number; seconds: number; primaries: number };
  tail: number;
  /** Leaf garlands over the shoulders and hanging from the head. */
  garland: boolean;
  /**
   * How it goes. A trot at a walk too, or a four-beat walk; how far its legs swing and how high it folds them at a walk and a run;
   * how much of a stride each foot is down; how high it bounds at a run; how much it nods and how much its neck sways.
   */
  gait: { trot: boolean; swing: [number, number]; fold: [number, number]; duty: [number, number]; bound: number; nod: number; sway: number; spring: number };
  /** Its strike: how far it rears (degrees, nought for a peck), how wide its wings go, how far its crest flares (degrees), and whether both fore hooves come down. */
  strike: { rear: number; wings: number; crest: number; both: boolean };
  size: number;
}

/** A Skylooklet: small and round, a big head on a short neck, big eyes, big ears, three long blue feathers, a fluffy cream ruff, short wings and slim legs. */
const SKYLOOKLET_LOOK: Sky = {
  stage: 0,
  body: { y: [-0.72, -0.6, -0.3, 0.08, 0.42, 0.62, 0.7], z: [0.1, 0.07, 0.04, 0.05, 0.1, 0.16, 0.18], w: [0.22, 0.42, 0.5, 0.5, 0.48, 0.38, 0.16], h: [0.24, 0.44, 0.52, 0.54, 0.52, 0.42, 0.18] },
  fore: { at: [0.25, 0.4, -0.3], len: [0.48, 0.44, 0.1] },
  hind: { at: [0.27, -0.4, -0.18], len: [0.52, 0.48, 0.1] },
  thick: [0.17, 0.1, 0.085, 0.07],
  foot: { r: 0.1, kind: 'toes' },
  fetlock: 0,
  neck: { at: [0, 0.56, 0.22], len: 0.4, w: [0.36, 0.3], lean: 16 },
  head: {
    y: [-0.56, -0.42, -0.12, 0.22, 0.46, 0.62, 0.72, 0.78], z: [0.12, 0.14, 0.12, 0.04, -0.06, -0.12, -0.14, -0.15],
    w: [0.2, 0.5, 0.6, 0.54, 0.36, 0.25, 0.19, 0.1], h: [0.24, 0.5, 0.58, 0.48, 0.32, 0.22, 0.16, 0.08], pitch: 0,
  },
  eye: { y: 0.24, up: 0.45, size: 0.2, stripe: 0 },
  ear: { len: 0.72, w: 0.3, out: 62, back: 22, y: -0.24, up: 0.62 },
  crest: [[1.05, 0, 28, 'blue'], [0.92, -0.55, 36, 'blue'], [0.92, 0.55, 36, 'blue'], [0.42, -0.35, 8, 'fawn'], [0.42, 0.35, 8, 'fawn'], [0.36, 0, 2, 'blue']],
  cheek: [0, 0],
  ruff: [14, 0.42],
  wing: { at: [0.42, 0.26, 0.4], len: 1.55, hang: 22, coverts: 3, seconds: 3, primaries: 4 },
  tail: 0.32,
  garland: false,
  gait: { trot: true, swing: [30, 40], fold: [60, 105], duty: [0.55, 0.36], bound: 0, nod: 6, sway: 0, spring: 0.15 },
  strike: { rear: 0, wings: 0.9, crest: 8, both: false },
  size: 1.62,
};

/** A Skywarden: tall and leggy, a long cream neck, a tall crest with fawn tufts round the face, and long wings whose blue primaries reach past its hips. */
const SKYWARDEN_LOOK: Sky = {
  stage: 1,
  body: { y: [-1.02, -0.88, -0.44, 0.14, 0.6, 0.86, 0.96], z: [0.08, 0.05, 0.02, 0.04, 0.1, 0.2, 0.24], w: [0.22, 0.38, 0.44, 0.44, 0.43, 0.35, 0.16], h: [0.24, 0.4, 0.46, 0.47, 0.46, 0.4, 0.18] },
  fore: { at: [0.24, 0.62, -0.26], len: [0.98, 1.0, 0.13] },
  hind: { at: [0.26, -0.6, -0.12], len: [1.06, 1.04, 0.13] },
  thick: [0.2, 0.09, 0.085, 0.065],
  foot: { r: 0.115, kind: 'split' },
  fetlock: 0.24,
  neck: { at: [0, 0.8, 0.2], len: 1.36, w: [0.4, 0.21], lean: 12 },
  head: {
    y: [-0.46, -0.34, -0.06, 0.28, 0.58, 0.84, 0.98, 1.06], z: [0.08, 0.1, 0.08, 0.0, -0.08, -0.13, -0.15, -0.16],
    w: [0.17, 0.38, 0.44, 0.37, 0.25, 0.18, 0.14, 0.08], h: [0.2, 0.38, 0.42, 0.33, 0.24, 0.17, 0.13, 0.07], pitch: 2,
  },
  eye: { y: 0.16, up: 0.3, size: 0.13, stripe: 0 },
  ear: { len: 0.68, w: 0.26, out: 68, back: 26, y: -0.2, up: 0.62 },
  crest: [[1.45, 0, 26, 'blue'], [1.3, -0.45, 32, 'blue'], [1.3, 0.45, 32, 'blue'], [1.05, -0.85, 40, 'blue'], [1.05, 0.85, 40, 'blue'], [0.55, -0.5, 14, 'fawn'], [0.55, 0.5, 14, 'fawn']],
  cheek: [6, 0.42],
  ruff: [10, 0.32],
  wing: { at: [0.38, 0.46, 0.38], len: 2.6, hang: 22, coverts: 3, seconds: 4, primaries: 5 },
  tail: 0.4,
  garland: false,
  gait: { trot: false, swing: [24, 32], fold: [85, 95], duty: [0.6, 0.32], bound: 0.32, nod: 3, sway: 0, spring: 0.17 },
  strike: { rear: 18, wings: 0.5, crest: 8, both: false },
  size: 1.72,
};

/**
 * A Skyrange: the tallest, on the longest legs, a long elegant neck, a narrow fox-deer head with a dark stripe through each keen eye,
 * a great crest swept back of blue and fawn feathers, leaves hung over its shoulders and from its head, and very long wings that
 * sweep down nearly to the ground behind.
 */
const SKYRANGE_LOOK: Sky = {
  stage: 2,
  body: { y: [-1.28, -1.1, -0.55, 0.2, 0.78, 1.1, 1.22], z: [0.08, 0.05, 0.02, 0.05, 0.12, 0.24, 0.28], w: [0.25, 0.42, 0.48, 0.48, 0.48, 0.4, 0.19], h: [0.28, 0.44, 0.5, 0.51, 0.51, 0.45, 0.21] },
  fore: { at: [0.27, 0.8, -0.28], len: [1.32, 1.36, 0.15] },
  hind: { at: [0.29, -0.76, -0.12], len: [1.42, 1.4, 0.15] },
  thick: [0.24, 0.1, 0.1, 0.075],
  foot: { r: 0.14, kind: 'pale' },
  fetlock: 0.32,
  neck: { at: [0, 1.0, 0.24], len: 1.92, w: [0.46, 0.23], lean: 14 },
  head: {
    y: [-0.48, -0.36, -0.1, 0.28, 0.66, 1.0, 1.22, 1.32], z: [0.06, 0.08, 0.06, -0.01, -0.08, -0.13, -0.15, -0.16],
    w: [0.16, 0.34, 0.38, 0.31, 0.22, 0.15, 0.11, 0.06], h: [0.19, 0.35, 0.38, 0.3, 0.21, 0.15, 0.12, 0.06], pitch: 2,
  },
  eye: { y: 0.18, up: 0.3, size: 0.105, stripe: 1 },
  ear: { len: 0.66, w: 0.24, out: 64, back: 34, y: -0.2, up: 0.6 },
  crest: [
    [2.8, 0, 62, 'blue'], [2.5, -0.2, 72, 'blue'], [2.5, 0.2, 72, 'blue'], [2.2, -0.4, 84, 'blue'], [2.2, 0.4, 84, 'blue'],
    [1.6, -0.28, 80, 'fawn'], [1.6, 0.28, 80, 'fawn'], [0.8, -0.3, 40, 'fawn'], [0.8, 0.3, 40, 'fawn'],
  ],
  cheek: [4, 0.44],
  ruff: [0, 0.3],
  wing: { at: [0.42, 0.62, 0.42], len: 3.6, hang: 40, coverts: 3, seconds: 5, primaries: 6 },
  tail: 0.48,
  garland: true,
  gait: { trot: false, swing: [22, 34], fold: [70, 95], duty: [0.64, 0.3], bound: 0.42, nod: 2, sway: 6, spring: 0.2 },
  strike: { rear: 24, wings: 0.36, crest: 10, both: true },
  size: 1.92,
};

/* ---- shapes ----------------------------------------------------------------------------- */

/** A number of its own for each feather and leaf, nought to one, so a crest is not a pattern. */
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

/**
 * A patch painted on a body of rings that lies on it all the way round its
 * rim -- an eye, a stripe -- rather than standing off it as a flat disc does:
 * `ry` along the rings either way and `rth` round them, about (`y`, `th`),
 * on the right side or (`side` -1) the left.
 */
function patchOn(R: Rings, y: number, th: number, ry: number, rth: number, m: Mat, o: { side?: number; lift?: number; sides?: number; at?: V3; lit?: boolean; spin?: number } = {}): Disc {
  const v: V3[] = [];
  const sides = o.sides ?? 12;
  for (let j = 0; j < sides; j++) {
    const a = ((j + 0.5) / sides) * TAU + (o.spin ?? 0);
    let q = onRings(R, y + ry * Math.cos(a), th + rth * Math.sin(a));
    if ((o.side ?? 1) < 0) q = left(q);
    v.push(add(q.p, scale(q.n, o.lift ?? 0.012)));
  }
  // Wound to face out of the surface, as a disc is: anticlockwise seen from outside.
  const c = onRings(R, y, th), n = (o.side ?? 1) < 0 ? left(c).n : c.n;
  return { v: windOut(v, n), m, at: o.at, lit: o.lit };
}

/** A ring of corners turned round, if need be, so it faces along `n`. */
function windOut(v: V3[], n: V3): V3[] {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v;
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
 * A feather, a leaf: a thin flat thing along a line of points, `widths`
 * across it (half-widths) at each, its face turned along `face`, its edges
 * lifted by `fold` of its width so it is a shallow V down its middle. Each
 * span along it is its own colour on top (`top(k)`), so a flight feather can
 * end in a dark tip, and one colour under. No thickness: a top and an
 * underside, whichever is turned to the viewer drawn.
 */
function vane(pts: readonly V3[], widths: readonly number[], face: V3, fold: number, top: (k: number) => Mat, underMat: Mat, twist = 0): Mesh {
  const K = pts.length, v: V3[] = [], f: Face[] = [], want: V3[] = [], ns: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    let n = unit(sub(face, scale(d, dot(face, d))));
    if (twist) {
      const a = (twist * k) / Math.max(1, K - 1), s0 = cross(d, n);
      n = unit(add(scale(n, Math.cos(a)), scale(s0, Math.sin(a))));
    }
    const side = unit(cross(d, n)), w = widths[Math.min(k, widths.length - 1)];
    const row: V3[] = [add(add(pts[k], scale(side, -w)), scale(n, fold * w)), pts[k], add(add(pts[k], scale(side, w)), scale(n, fold * w))];
    v.push(...row, ...row);
    ns.push(n);
  }
  for (let k = 0; k < K - 1; k++) {
    const A = k * 6, B = A + 6, n = unit(add(ns[k], ns[k + 1]));
    for (const j of [0, 1]) {
      f.push({ i: [A + j, A + j + 1, B + j + 1, B + j], m: top(k) });
      want.push(n);
      f.push({ i: [B + 3 + j, B + 4 + j, A + 4 + j, A + 3 + j], m: underMat });
      want.push(scale(n, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/** A feather's width along it: narrow at the quill, broadest past the middle, coming to a rounded point. */
const featherWidths = (K: number, w: number): number[] => Array.from({ length: K }, (_, k) => {
  const u = k / (K - 1);
  return Math.max(0.015, w * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.12)) ** 0.7) * (u > 0.85 ? 1 - (u - 0.85) * 4 : 1));
});

/**
 * A feather from `root` along `dir`, curving toward `bendTo` by its tip,
 * `len` long and `w` across: blue with a dark tip, slate grey-blue with a
 * dark tip, olive, a brown covert with a darker tip, or fawn.
 */
type Tone = 'blue' | 'slate' | 'olive' | 'covert' | 'fawn' | 'cream' | 'flag';
const TONE: Record<Tone, [Mat, Mat, Mat]> = {
  // Its colour, the colour of its tip, and its underside.
  blue: ['crystal', 'crystalDark', 'crystal'],
  slate: ['stone', 'crystalDark', 'stoneDark'],
  olive: ['moss', 'crystalDark', 'stoneDark'],
  covert: ['feather', 'featherDark', 'featherDark'],
  fawn: ['coat', 'featherDark', 'coatDark'],
  cream: ['mark', 'mark', 'belly'],
  // Fawn on top with a dark tip, cream only under: a deer's tail.
  flag: ['coat', 'featherDark', 'mark'],
};
function feather(root: V3, dir: V3, bendTo: V3, face: V3, len: number, w: number, K: number, tone: Tone, o: { tip?: number; fold?: number; twist?: number } = {}): Mesh {
  const d = unit(dir), b = unit(bendTo);
  const tip = add(root, scale(unit(add(scale(d, 0.6), scale(b, 0.4))), len));
  const mid = add(root, scale(d, len * 0.52));
  const pts = curve(root, mid, tip, K - 1);
  const [m, dark, und] = TONE[tone];
  const tipFrom = Math.round((K - 1) * (1 - (o.tip ?? 0.28)));
  return vane(pts, featherWidths(K, w), face, o.fold ?? 0.18, (k) => (k >= tipFrom ? dark : m), und, o.twist ?? 0);
}

/** A leaf: a pointed oval along a gentle arch, green on top with a paler rib side, darker under. */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, K: number, pale: boolean, underside: Mat = 'leafDark'): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const tip = add(root, scale(d, len)), mid = add(add(root, scale(d, len * 0.5)), scale(f, len * 0.14));
  const widths = Array.from({ length: K }, (_, k) => Math.max(0.02, w * Math.sin(Math.PI * (k / (K - 1)) ** 0.8) ** 0.9));
  return vane(curve(root, mid, tip, K - 1), widths, f, 0.25, () => (pale ? 'stem' : 'leaf'), underside);
}

/* ---- its bones ------------------------------------------------------------------------- */

/** Where the right ear is rooted on the head. */
const earRoot = (s: Sky): V3 => {
  const q = onRings(s.head, s.ear.y, s.ear.up);
  return sub(q.p, scale(q.n, 0.06));
};
/** Where the crest is rooted on the crown, in the head's frame. */
const crestRoot = (s: Sky): V3 => {
  const H = s.head, q = onRings(H, lerp(H.y[1], H.y[2], 0.7), Math.PI / 2);
  return sub(q.p, [0, 0, 0.05]);
};

/** A stage's body on four legs (`QuadSpec`): its legs, neck and ears from its numbers. */
/** The hind leg's hip, set at the height that puts its sole level with the fore's: the gaskin slopes back, so the hind leg reaches less far down. */
const hipOf = (s: Sky): V3 => {
  const fore = s.fore.len[0] + s.fore.len[1], hind = s.hind.len[0] * Math.cos(HOCK * DEG) + s.hind.len[1];
  return [s.hind.at[0], s.hind.at[1], s.fore.at[2] - fore + hind];
};
/** How far back the gaskin slopes from the hip to the hock, standing, in degrees; the cannon is stood straight under it. */
const HOCK = 16;

const specOf = (s: Sky): QuadSpec => ({
  high: s.fore.len[0] + s.fore.len[1] + 0.4,
  // The fore leg straight under the elbow, folding back at the knee as it swings; the hind with its gaskin sloping back to the hock
  // and the cannon straight down from it, the hock folding the other way (the foot comes forward under the body as it swings).
  fore: { at: s.fore.at, len: s.fore.len, rest: [0, 0, 0], fold: s.gait.fold, toe: [s.foot.r * 1.1, s.foot.r * 0.7] },
  hind: { at: hipOf(s), len: s.hind.len, rest: [-HOCK, HOCK, 0], fold: [-s.gait.fold[0] * 0.7, -s.gait.fold[1] * 0.7], toe: [s.foot.r * 1.1, s.foot.r * 0.7] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.1, s.body.z[0] + s.body.h[1] * 0.55], links: 1, len: 0.2, lift: 20, curl: 0, sway: 8 },
  ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: s.gait.duty,
  // Grazing, the long neck bowed down far enough for the muzzle to reach the ground.
  graze: 112 - s.neck.lean,
  nose: 24,
  bow: 8,
  rock: 4,
});

/** Where each leg's foot is in a stride: a four-beat walk, a trot, and a bound (the hind pair, then a long flight, then the fore). */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];
const BOUND = [0.4, 0.46, 0, 0.06];

/* ---- standing watch ------------------------------------------------------------------------ */

/**
 * The scans it makes, standing, over the 24-second loop the stills are kept
 * in: when each starts and how long it lasts, which way it looks first, and
 * how far round. None of them crosses the loop's end, so standing is one
 * seamless loop; and none covers the sniff at the air every body standing
 * takes (`quadPose`, at 6.5 and 17.2 seconds). Each body is somewhere of its
 * own in the loop (`animOf`), so a herd does not scan as one.
 */
const SCANS: ReadonlyArray<readonly [number, number, number, number]> = [[0.5, 5.6, 1, 1], [8.4, 5.0, -1, 0.9], [18.8, 4.4, 1, 0.8]];

/**
 * How far into a scan it is this moment: how high its head is lifted
 * (nought to one) and how far round it is looking (degrees, left positive).
 * It lifts its head, turns it slowly one way and holds a moment, turns it
 * slowly the other way and holds, and comes back and lets its head down.
 */
function lookout(t: number): { lift: number; turn: number } {
  let lift = 0, turn = 0;
  for (const [at, len, dir, far] of SCANS) {
    const u = (t - at) / len;
    if (u <= 0 || u >= 1) continue;
    lift = ramp(u, 0, 0.16) * (1 - ramp(u, 0.84, 1));
    // The turn, over the middle of it, slow: about sixty degrees a second at the most.
    const v = clamp((u - 0.1) / 0.8);
    // One way and then the other, starting and ending at rest: a full wave under a half one, scaled so its sides reach `far`.
    // As far round as a longer scan has time for at the same rate: thirty-four degrees over the longest.
    turn = (dir * far * 34 * (len / 5.6) * Math.sin(Math.PI * v) * Math.sin(TAU * v)) / 0.77;
  }
  return { lift, turn };
}

/* ---- its moves ----------------------------------------------------------------------------- */

/** The strike: when the blow lands, a stage at a time -- a peck lands sooner than a rearing body comes down. */
const HIT = [0.48, 0.52, 0.54] as const;
/** And when it is fully gathered -- reared up, or drawn back -- before the blow. */
const TOP = [0.34, 0.36, 0.38] as const;

/**
 * How far through a strike it is: gathered (reared up, or drawn back for the
 * peck) and gone again by the hit, the lunge or stamp into the hit, and the
 * little rebound after it that dies away.
 */
function strikeOf(s: Sky, t: number): { gather: number; thrust: number; settle: number; impact: number } {
  const hit = HIT[s.stage], top = TOP[s.stage];
  const gather = ramp(t, 0.02, top) * (1 - ramp(t, top, hit));
  const thrust = ramp(t, top - 0.04, hit) * (1 - ramp(t, hit + 0.05, 1));
  const after = clamp((t - hit) / (1 - hit));
  const settle = t > hit ? Math.sin(after * Math.PI * 2) * (1 - after) ** 1.5 : 0;
  return { gather, thrust, settle, impact: hump(t, hit, 0.08) };
}

/** How far each wing is opened (nought folded, one spread wide) and how far up it is lifted, this moment. */
function wingsOf(s: Sky, a: Anim): { open: number; up: number } {
  const act = a.act;
  let open = 0, up = 0;
  if (act?.kind === 'strike') {
    const hit = HIT[s.stage];
    if (s.strike.rear) {
      // Flared as it rears, widest as it comes down, and folded again as it settles: one long swell over the whole of it.
      const k = act.t < hit ? 0.5 - 0.5 * Math.cos(Math.PI * (act.t / hit)) : 0.5 + 0.5 * Math.cos(Math.PI * ((act.t - hit) / (1 - hit)));
      open = s.strike.wings * k;
      up = 0.8 * s.strike.wings * k;
    } else {
      // A Skylooklet flaps once as it pecks: up and open as it draws back, down hard with the peck, and folded again.
      const k = ramp(act.t, 0.02, hit - 0.08) * (1 - ramp(act.t, hit + 0.06, 0.95));
      open = s.strike.wings * k;
      up = 0.8 * ramp(act.t, 0.02, hit - 0.12) * (1 - ramp(act.t, hit - 0.12, hit + 0.02)) - 0.25 * hump(act.t, hit + 0.06, 0.12);
    }
  } else if (act?.kind === 'evolve') {
    // Evolving, opened at the flash and folded again.
    const k = ramp(act.t, 0.22, 0.5) * (1 - ramp(act.t, 0.6, 0.95));
    open = [0.6, 0.45, 0.32][s.stage] * k;
    up = open * 0.8;
  } else if (a.go > 0) {
    // Out a little for balance at a run, the more the higher it bounds.
    open = 0.12 * a.go * a.gait * (0.5 + s.gait.bound);
  }
  return { open, up };
}

/**
 * How much it is keeping watch this moment, nought to one: standing still, not grazing, and not striking or evolving -- the
 * scan gives way over the first fifth of an act and comes back over its last sixth, so a strike is aimed where it faces.
 */
function watching(a: Anim): number {
  const act = a.act ? 1 - ramp(a.act.t, 0, 0.2) * (1 - ramp(a.act.t, 0.85, 1)) : 1;
  return (1 - smooth(a.go)) * (1 - a.graze) * act;
}

/** How far the crest is lifted (degrees, up and back toward upright), this moment: a little as it scans, flared as it strikes and as it evolves. */
function crestOf(s: Sky, a: Anim): number {
  let lift = 16 * lookout(a.t).lift * watching(a);
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(s, act.t);
    lift += s.strike.crest * (k.gather + 0.6 * k.thrust) - 4 * k.settle;
  } else if (act?.kind === 'evolve') {
    lift += 14 * ramp(act.t, 0.2, 0.5) * (1 - ramp(act.t, 0.6, 0.9));
  }
  return lift;
}

/** How big the crest is as it grows in, evolving: small as it comes out of the burst, full by the flash, a little over at it. */
const growOf = (t: number): number => 0.45 + 0.55 * ramp(t, 0.06, 0.5) + 0.12 * hump(t, 0.55, 0.08);

/** How far it tips nose-down into a peck, at the blow, in degrees. */
const PECK_DIP = 4;

/**
 * How far forward the whole body is carried this moment, in its own units:
 * drawn back and thrown forward into a peck. Its legs are swung back by as
 * much, so its feet stay where they are.
 */
function surge(s: Sky, a: Anim): number {
  const act = a.act;
  if (act?.kind !== 'strike' || s.strike.rear) return 0;
  const k = strikeOf(s, act.t);
  return 0.42 * k.thrust - 0.1 * k.gather - 0.05 * k.settle;
}

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its own
 * gait; the watch it keeps, standing; and its moves -- a strike and
 * evolving.
 */
function skyPose(s: Sky, spec: QuadSpec, p: QuadPose, a: Anim): void {
  const g = smooth(a.go), w = frac(a.u);
  if (a.go > 0) {
    const run = a.gait >= 0.5;
    const duty = lerp(spec.duty?.[0] ?? 0.64, spec.duty?.[1] ?? 0.4, a.gait), amp = lerp(spec.swing[0], spec.swing[1], a.gait);
    // Its own beat: a trot at a walk for the Skylooklet, a bound at a run for the two that leap; the four-beat walk the pose is
    // given otherwise. The walk's own body roll and nod are kept, the run's lift replaced by its own.
    const beats = run ? (s.gait.bound ? BOUND : DIAGONALS) : s.gait.trot ? DIAGONALS : FOUR_BEAT;
    const was = run ? DIAGONALS : FOUR_BEAT;
    for (let i = 0; i < 4; i++) {
      const before = step(a.u + was[i], duty, amp), now = step(a.u + beats[i], duty, amp);
      // On the ground, the leg swept so its foot goes back along the ground at an even pace, rather than its angle going evenly
      // (which has the foot slow at either end of the sweep and fast under the body): so a planted foot keeps pace with the ground.
      if (now[2] === 0 && amp > 0) now[0] = Math.asin(Math.sin(amp * DEG) * (now[0] / amp)) / DEG;
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - before[k]);
    }
    p.lift -= g * a.gait * 0.5 * Math.max(0, Math.sin(w * TAU * 2));
    if (run && s.gait.bound) {
      // Bounding: up off the hind pair and through the air, stretched out, to come down on the fore; a short hop over them back to the hind.
      // Eased off the ground and back onto it, so nothing hangs on the lift starting or stopping between one moment and the next.
      const fly = (from: number, to: number): number => (w > from && w < to ? Math.sin(Math.PI * (w - from) / (to - from)) ** 2 : 0);
      // Off the hind feet and through the air until the first fore foot comes down. A foot is down while its own phase, the stride
      // plus its beat, is under `duty`: so the last hind foot (beat nought) leaves at `duty` and the first fore one lands at
      // `1 - BOUND[1]`.
      p.lift += g * s.gait.bound * fly(duty, 1 - BOUND[1]);
      // Every leg folded higher through its swing, so a hoof clears the ground on its way forward rather than scraping it while the
      // body is low between the bounds; and straight again as it comes down.
      for (let i = 0; i < 4; i++) {
        const sw = p.legs[i][2];
        if (sw > 0) p.legs[i][1] += g * (i < 2 ? 0.45 : 0.3) * Math.sin(Math.PI * sw);
      }
      p.pitch -= g * 2 * Math.sin(w * TAU);
      p.neck[0] += g * (3 - 3 * Math.sin(w * TAU));
      p.head[0] += g * (-2 + 3 * Math.sin(w * TAU));
    } else {
      // A spring in the step: up off each footfall, a nod a beat after it.
      p.lift += g * (s.gait.spring + 0.05 * a.gait) * Math.max(0, Math.cos(w * TAU * 2));
      p.head[0] += g * s.gait.nod * Math.sin(w * TAU * 2 - 0.6);
    }
    if (s.gait.sway && !run) {
      // The long neck swaying a little from side to side with the stride, the head turned back against it so the gaze stays ahead.
      p.neck[1] += g * s.gait.sway * Math.sin(w * TAU - 0.5);
      p.head[1] -= g * s.gait.sway * 0.7 * Math.sin(w * TAU - 0.5);
      p.neck[0] += g * 2 * Math.sin(w * TAU * 2);
    }
    for (const e of p.ears) e[0] -= g * 6;
    p.tail[1] += g * 10 * Math.sin(w * TAU + 0.4);
  }
  // Standing watch: its head lifted high and turned slowly one way and then the other, not while it is going or grazing.
  const still = watching(a);
  if (still > 0) {
    const { lift, turn } = lookout(a.t);
    const k = lift * still;
    p.neck[0] -= 18 * k;
    p.head[0] += 9 * k;
    // Its own looking about given over to the scan while it scans.
    p.neck[1] = p.neck[1] * (1 - k) + 0.4 * turn * still;
    p.head[1] = p.head[1] * (1 - k) + 0.6 * turn * still;
    p.head[2] *= 1 - k;
    // The ears pricked forward, and turned with the look.
    for (const e of p.ears) e[0] -= 14 * k;
  }
  // Head down at the grass: the fore legs kept straight and set a little forward rather than folded, as a deer stands to crop,
  // and the long neck does the reaching.
  const down = a.graze * (1 - g);
  if (down > 0) {
    for (const i of [0, 1]) {
      p.legs[i][1] -= 0.85 * down;
      p.legs[i][0] += 12 * down;
    }
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(s, act.t);
    if (s.strike.rear) {
      // Reared up on the hind legs, the fore tucked up; then down hard, the fore hooves striking the ground, and settled.
      const rear = s.strike.rear * k.gather;
      p.pitch += rear;
      // The hind legs kept upright under it, a little crouched as it rears; the hind feet are kept where they are (`skyBones`).
      for (const i of [2, 3]) {
        p.legs[i][0] -= rear;
        p.legs[i][1] += 0.2 * k.gather;
      }
      // The fore legs tucked as it rears; then struck down to the ground at the hit -- the Skywarden's right one lashing out
      // forward as it comes, the blow itself, and the Skyrange's both together.
      const lash = !s.strike.both ? hump(act.t, HIT[s.stage] - 0.1, 0.1) : 0;
      for (const i of [0, 1]) {
        const out = i === 1 ? lash : 0;
        p.legs[i][0] += 18 * k.gather + 26 * out;
        p.legs[i][1] += (s.stage === 2 ? 0.75 : 0.95) * k.gather * (1 - 0.8 * out);
        p.legs[i][2] = Math.max(p.legs[i][2], k.gather);
      }
      // The neck drawn back so the head rides up over it, carried level; at the hit it is thrown down and forward at whatever it struck.
      p.neck[0] += 0.5 * rear + 10 * k.thrust * (1 - k.gather) - 4 * k.settle;
      p.head[0] += -rear + 6 * k.gather - 10 * k.thrust * (1 - k.gather) + 4 * k.settle;
      p.squash += -0.04 * k.gather + 0.05 * k.impact;
    } else {
      // A peck: drawn back and up, then the head thrown forward and down into it, and back.
      p.neck[0] += -16 * k.gather + 30 * k.thrust - 6 * k.settle;
      p.head[0] += 14 * k.gather - 28 * k.thrust + 6 * k.settle;
      // Crouched on all four as it draws back, and up off them into the peck: each leg bent at the knee and its upper swung the
      // other way by half as much, so the foot stays where it is and no foot leaves the ground.
      p.legs.forEach((l, i) => {
        const fold = 0.16 * k.gather, F = i < 2 ? spec.fore.fold![0] : spec.hind.fold![0];
        l[1] += fold;
        l[0] += (fold * F) / 2;
      });
      p.neck[0] += 8 * k.thrust;
      p.squash += 0.05 * k.gather - 0.08 * k.thrust;
      // Tipped a little nose-down into the blow (the fore legs given the drop at the shoulder, below), so it shows from behind too.
      p.pitch -= PECK_DIP * k.thrust;
      // And down into it, the legs bent under it (`plant`), so the hind ones still reach the ground as it lunges.
      p.lift -= 0.08 * k.thrust;
    }
    for (const e of p.ears) e[0] += 26 * k.gather + 20 * k.thrust - 10 * k.settle;
    p.tail[0] += s.strike.rear ? 20 * k.gather : 35 * k.gather + 50 * k.thrust;
  } else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, head high, and at the turn a shake of the head and the crest.
    const up = ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.62, 0.88)), shake = hump(act.t, 0.56, 0.1);
    p.neck[0] -= 14 * up;
    p.head[0] += 12 * up;
    p.head[2] += 10 * shake * Math.sin(act.t * 60);
    for (const e of p.ears) e[0] -= 12 * up;
    p.ears[0][1] += 14 * shake * Math.sin(act.t * 60);
    p.ears[1][1] -= 14 * shake * Math.sin(act.t * 60);
  }
  // However far the body is carried forward, each leg swung about its hip so its foot stays where it is: the hip-to-foot line
  // turned until it reaches back by as much as the body has gone forward.
  const d = surge(s, a);
  if (d) {
    // How much of its reach down each pair loses once turned: the sloped hind legs lose more than the straight fore, and the
    // fore are bent at the knee by as much (the upper swung against it by half), so all four stay on the ground.
    const lost: number[] = [];
    for (let i = 0; i < 4; i++) {
      const L = (i < 2 ? spec.fore : spec.hind).len, r = (i < 2 ? spec.fore : spec.hind).rest ?? [0, 0, 0];
      const y = L[0] * Math.sin(r[0] * DEG) + L[1] * Math.sin((r[0] + r[1]) * DEG), z = L[0] * Math.cos(r[0] * DEG) + L[1] * Math.cos((r[0] + r[1]) * DEG);
      const D = Math.hypot(y, z), phi = Math.atan2(y, z), turned = Math.asin(clamp((y - d) / D, -0.95, 0.95));
      p.legs[i][0] += (turned - phi) / DEG;
      lost.push(D * (Math.cos(phi) - Math.cos(turned)));
    }
    // And tipped nose-down, the shoulders come down by as much as the hips are ahead of them times its sine: the fore legs given
    // that too.
    const dip = act?.kind === 'strike' && !s.strike.rear ? PECK_DIP * strikeOf(s, act.t).thrust : 0;
    const drop = (s.fore.at[1] - s.hind.at[1]) * Math.sin(dip * DEG);
    const Df = s.fore.len[0] + s.fore.len[1], short = Math.max(0, lost[2] - lost[0] + drop);
    const F = 2 * Math.acos(clamp(1 - short / Df, -1, 1)) / DEG, folds = spec.fore.fold![0];
    for (const i of [0, 1]) {
      p.legs[i][1] += F / folds;
      p.legs[i][0] += F / 2;
    }
  }
}

/** Where the hind feet are, between them, along the ground. */
const hindAt = (b: Bones): number => (b.hl2.t[1] + b.hr2.t[1]) / 2;

/**
 * A leg put back so its foot is at `goal` (the foot bone's joint, in the world) and set as `foot` was: the upper and the lower
 * turned in the body's plane by the two-bone rule -- the fore with its knee forward, the hind with its hock behind -- and the foot
 * kept as it was in the pose it is put back to. A goal out of reach is reached for as far as the leg goes.
 */
function plant(b: Bones, key: string, fore: boolean, at: V3, len: [number, number, number], goal: V3, foot: Bones[string]): void {
  const B = b.body, m = B.m;
  // Into the body's frame (its turn undone is its transpose), from the hip.
  const w = sub(goal, B.t), local: V3 = [m[0] * w[0] + m[3] * w[1] + m[6] * w[2], m[1] * w[0] + m[4] * w[1] + m[7] * w[2], m[2] * w[0] + m[5] * w[1] + m[8] * w[2]];
  const dy = local[1] - at[1], dz = local[2] - at[2];
  const [L0, L1] = len, D = clamp(Math.hypot(dy, dz), Math.abs(L0 - L1) + 1e-3, L0 + L1 - 1e-9);
  const phi = Math.atan2(dy, -dz);
  const hip = Math.acos(clamp((L0 * L0 + D * D - L1 * L1) / (2 * L0 * D), -1, 1));
  const knee = Math.PI - Math.acos(clamp((L0 * L0 + L1 * L1 - D * D) / (2 * L0 * L1), -1, 1));
  const upper = fore ? phi + hip : phi - hip, lower = fore ? -knee : knee;
  const up = joint(B, at, upper / DEG);
  const lo = joint(up, [0, 0, -L0], lower / DEG);
  b[`${key}0`] = up;
  b[`${key}1`] = lo;
  b[`${key}2`] = { m: foot.m, t: place(lo, [0, 0, -L1]) };
}

/**
 * The bones of a stage: a body on four legs (`quadBonesOf`), its hind feet
 * kept where they were as it rears, carried forward as it pecks; and its own
 * bones over those -- a ruff at the neck's root, the crest on the crown, and
 * a wing at each shoulder.
 */
function skyBones(s: Sky): (a: Anim) => Bones {
  const spec = specOf(s);
  const posed = quadBonesOf(spec, (p, a) => skyPose(s, spec, p, a));
  const C = crestRoot(s);
  return (a) => {
    const b = posed(a);
    const act = a.act;
    // Reared, the body pitches about its middle and the hind feet would slide: it is put back so they are where they would be
    // were it not striking. Pecking, it is carried forward over its feet (`surge`).
    let dy = surge(s, a);
    if (act?.kind === 'strike') dy = hindAt(posed({ ...a, act: undefined })) - hindAt(b);
    if (dy) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + dy, b[k].t[2]] };
    // Striking, every foot that is still on the ground -- all four as it pecks, the hind as it rears -- is put back where it stood
    // (`plant`), so none slides or lifts however the body above it lunges or tips.
    if (act?.kind === 'strike') {
      const ref = posed({ ...a, act: undefined });
      for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
        if (fore && s.strike.rear) continue;
        const L = (fore ? spec.fore : spec.hind);
        plant(b, key, fore, [side * L.at[0], L.at[1], L.at[2]], L.len, ref[`${key}2`].t, ref[`${key}2`]);
      }
    }
    // The ruff and the garland at the neck's root go with the neck, turned back to the body's carriage.
    b.ruff = joint(b.neck, [0, 0, 0], spec.neck.lean);
    b.crest = joint(b.head, C, -crestOf(s, a));
    // The feathered tufts over the hooves hang as feathers do, kept turned as the body is whichever way the leg is swung.
    if (s.fetlock) {
      for (const k of ['fl', 'fr', 'hl', 'hr']) {
        const L = k[0] === 'f' ? s.fore.len : s.hind.len;
        b[`${k}t`] = { m: b.body.m, t: place(b[`${k}1`], [0, 0, -L[1] + 0.12 + s.fetlock * 0.55]) };
      }
    }
    const { open, up } = wingsOf(s, a);
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1;
      // Opened, a wing swings out from the flank and lifts at the shoulder, its feathers fanning (`fanned`).
      b[`wing${k}`] = joint(b.trunk, [sd * s.wing.at[0], s.wing.at[1], s.wing.at[2]], -30 * up, sd * -50 * open, sd * 34 * open);
    }
    return b;
  };
}

/* ---- the head ------------------------------------------------------------------------------- */

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the muzzle. */
function headSolids(s: Sky): Array<{ c: V3; r: V3 }> {
  const H = s.head;
  return [
    { c: [0, H.y[2], H.z[2]], r: [H.w[2] * 0.88, (H.y[3] - H.y[0]) * 0.5, H.h[2] * 0.88] },
    { c: [0, (H.y[4] + H.y[6]) / 2, H.z[5]], r: [H.w[5] * 0.85, (H.y[6] - H.y[4]) / 2, H.h[5] * 0.85] },
  ];
}

/**
 * The eyes, open or shut: each laid on the side of the head where the skull
 * meets the muzzle, looking forward as much as out, and lying on the curve of
 * the head all the way round, so none stands off it past the outline. A dark
 * rim, a blue-grey iris, a dark pupil and a white glint; on the Skyrange a
 * narrower, keener eye with a dark stripe running back from it to the ear
 * and forward down the muzzle. All of an eye goes out of sight together when
 * the head is between it and the viewer (`at`).
 */
function eyesOf(s: Sky, shut: boolean): Mesh {
  const E = s.eye, H = s.head, out: Disc[] = [];
  const r = E.size;
  // How tall an eye is against how wide: round on the chick, an almond on the Skyrange.
  const tall = 1.05 - 0.25 * E.stripe;
  for (const side of [1, -1]) {
    const c0 = onRings(H, E.y, E.up), c = side > 0 ? c0 : left(c0);
    const at = sub(c.p, scale(c.n, 0.04));
    // Round the curve of the head: `ry` along it, `rth` round it (radians on a ring as tall as the head is there).
    const hh = lerp(H.h[2], H.h[3], 0.5);
    const o = (k: number, m: Mat, lift: number, extra: { lit?: boolean; y?: number; th?: number; ry?: number; rth?: number } = {}): Disc =>
      patchOn(H, E.y + (extra.y ?? 0), E.up + (extra.th ?? 0), extra.ry ?? r * k, extra.rth ?? (r * k * tall) / hh, m, { side, lift, at, lit: extra.lit });
    if (E.stripe) {
      // The stripe: a dark band from the front of the eye back toward the ear.
      out.push(o(1, 'lid', 0.008, { y: -r * 1.6, ry: r * 2.6, rth: (r * 0.42) / hh, th: 0.04 }));
      out.push(o(1, 'lid', 0.008, { y: r * 1.9, ry: r * 1.3, rth: (r * 0.3) / hh, th: -0.14 }));
    }
    if (shut) {
      out.push(o(1.05, 'lid', 0.012, { rth: (r * 0.28) / hh, th: -r * 0.1 / hh }));
      continue;
    }
    out.push(o(1.14, 'lid', 0.012));
    out.push(o(1, 'billDark', 0.016));
    out.push(o(0.55, 'eye', 0.02, { th: -0.02 }));
    out.push(o(0.3, 'glint', 0.024, { lit: true, y: r * 0.28, th: (r * 0.38) / hh }));
    // A second, smaller glint low on the far side of the iris: a big wet eye on the chick.
    if (s.stage === 0) out.push(o(0.14, 'glint', 0.024, { lit: true, y: -r * 0.32, th: (-r * 0.4) / hh }));
    // The Skyrange's brow: a short dark line over the eye, which is what makes its look keen.
    if (E.stripe) out.push(o(1, 'lid', 0.014, { ry: r * 1.1, rth: (r * 0.16) / hh, th: (r * 0.95) / hh, y: -r * 0.1 }));
  }
  return paint(out);
}

/** A thin painted line along a run of points on the head, `w` wide: the mouth. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.012)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  return { v: windOut(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3)), m };
}

/**
 * The head: a deer's, built as rings from the back of the skull to the nose
 * (`Sky.head`) -- round with a short muzzle on the chick, long and narrow on
 * the Skyrange -- fawn, cream under the jaw and along the muzzle's lower
 * side, with a small dark nose, a gentle smile, and the eyes.
 */
function headOf(s: Sky, n: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1;
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => (ring >= last - 1 ? 'coatDark' : ring >= 2 && under(n, j, 0.9) ? 'mark' : 'coat'));
  const tip: V3 = [0, H.y[last], H.z[last]];
  const nose = paint([disc(add(tip, [0, 0.012, 0]), [0, 1, 0.15], H.w[last] * 1.3, H.h[last] * 1.25, 10, 'nose')]);
  // A cream muzzle patch down the side of the face, and the smile along it: from under the nose back to below the eye, turned up.
  const mouth = paint([1, -1].map((sd) => line(Array.from({ length: 6 }, (_, q) => {
    const f = q / 5, y = lerp(H.y[last - 1] + 0.01, lerp(H.y[3], H.y[4], 0.55), f), th = -0.75 + 0.1 * f + 0.3 * f ** 3;
    const at = onRings(H, y, th);
    return sd > 0 ? at : left(at);
  }), H.w[3] * 0.035, 'lid')));
  const muzzle = paint([1, -1].map((sd) => patchOn(H, lerp(H.y[4], H.y[5], 0.5), -0.35, (H.y[5] - H.y[4]) * 0.9, 0.45, 'muzzle', { side: sd, lift: 0.006 })));
  return merge(skull, muzzle, nose, mouth, eyesOf(s, shut));
}

/** A big ear, built upright facing forward and cupped so its lining looks forward and out: fawn outside, pink inside, a darker rim at its tip. */
function earOf(len: number, w: number, n: number): Mesh {
  const line0 = curve([0, 0, 0], [0, -0.05, len * 0.5], [0, 0.04, len], 5);
  const ws = [w * 0.4, w * 0.88, w, w * 0.6, w * 0.38, 0.02];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.45 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(line0, ws, ws.map((x) => Math.max(0.025, x * 0.2)), n, (ring) => (ring >= 4 ? 'featherDark' : ring >= 3 ? 'coatDark' : 'coat'), { up: [0, 1, 0], seam: 'start' });
  const cupped = { ...shell, v: shell.v.map(cup) };
  const side = (sd: number): V3[] => [1, 2, 3, 4].map((q) => cup([sd * ws[q] * 0.66, ws[q] * 0.22 + 0.012, line0[q][2]]));
  const lining = [cup([0, ws[0] * 0.2 + 0.012, line0[0][2] + len * 0.08]), ...side(-1), cup([0, 0.03, len * 0.92]), ...side(1).reverse()];
  return merge(mesh(cupped.v, cupped.f), paint([{ v: lining, m: 'inner' }]));
}

/**
 * The crest, in the crest bone's frame at the crown: each feather rooted a
 * little behind the last across the crown and rising up and back, leaning out
 * to its side, curving further back toward its tip -- the blue ones with dark
 * tips -- each turned partly to the side and partly forward, so the crest
 * shows as a fan from the front and behind and as a sweep side on.
 */
function crestOf2(s: Sky, K: number): Mesh {
  const H = s.head;
  return merge(...s.crest.map(([len, out, sweep, tone], q) => {
    // The Skyrange's blue ones narrow and pointed, so its long crest is a spray of separate feathers rather than one board.
    const sw = sweep * DEG, w = (len * (tone === 'fawn' ? 0.15 : 0.13) + 0.05) * (s.stage === 2 ? (tone === 'fawn' ? 0.62 : 0.5) : 1);
    // Its fawn ones rooted behind the blue and a little under them.
    const behind = s.stage === 2 && tone === 'fawn' ? 0.05 : 0;
    const root: V3 = [out * H.w[1] * 0.42, -0.04 * Math.abs(out) - 0.03 * q - behind, -behind];
    const dir: V3 = [out * 0.42, -Math.sin(sw), Math.cos(sw)];
    // Curving back along their length, and the Skyrange's long ones lifting a little again at their tips, as an antelope's horns do.
    const bendTo: V3 = [out * 0.5, -1, s.stage === 2 ? 0.55 : Math.cos(sw) * 0.2];
    const face = unit([Math.cos(out * 0.9) * (out >= 0 ? 1 : -1) * 0.8 + (out === 0 ? 0.6 : 0), 0.55, 0.2]);
    return feather(root, dir, bendTo, face, len, w, K, tone === 'fawn' ? 'fawn' : 'blue', { tip: tone === 'fawn' ? 0.2 : s.stage === 2 ? 0.35 : 0.3, fold: 0.22, twist: out * 0.3 });
  }));
}

/** Fawn feathers swept back off each cheek and round the jaw, framing the face. */
function cheeksOf(s: Sky, K: number): Mesh {
  const [count, L] = s.cheek;
  if (!count) return merge();
  const H = s.head, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < count; q++) {
      const f = count > 1 ? q / (count - 1) : 0.5;
      let at = onRings(H, lerp(H.y[1], H.y[2], 0.3 + 0.4 * f), -0.8 + 1.4 * f);
      if (sd < 0) at = left(at);
      const id = q + (sd > 0 ? 0 : 9), splay = 0.6 * (jitter(id + 4) - 0.5);
      const dir = unit(add(scale(at.n, 0.55), [0, -0.9, -0.15 + 0.3 * f + splay]));
      // Fawn and brown, a few lengths, splayed: only the lowest two, under the jaw, are cream.
      const tone: Tone = q < 2 ? 'cream' : jitter(id + 2) < 0.5 ? 'fawn' : 'covert';
      out.push(feather(sub(at.p, scale(at.n, 0.03)), dir, [sd * 0.3, -1, -0.3], at.n, L * (0.6 + 0.6 * jitter(id)), L * 0.22, K, tone, { tip: 0.25 }));
    }
  }
  return merge(...out);
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/**
 * The cream ruff at the throat, in the ruff bone's frame at the neck's root:
 * soft feathers round the front and sides of the neck pointing down over the
 * chest, in two layers, the chick's big and fluffy.
 */
function ruffOf(s: Sky, K: number): Mesh {
  const [count, L] = s.ruff, lean = s.neck.lean * DEG, R = s.neck.w[0];
  const A: V3 = [0, Math.sin(lean), Math.cos(lean)], u: V3 = [1, 0, 0], v = cross(A, u);
  const out: Mesh[] = [];
  for (const layer of [0, 1]) {
    const n = layer ? Math.round(count * 0.7) : count;
    for (let q = 0; q < n; q++) {
      const phi = ((q + 0.5) / n - 0.5) * (layer ? 2.4 : 3.4), id = layer * 40 + q;
      const round = add(scale(v, Math.cos(phi)), scale(u, Math.sin(phi)));
      const root = add(scale(A, s.stage ? (layer ? 0.04 : 0.14) * s.neck.len : layer ? -0.12 : 0.02), scale(round, R * (layer ? 1.05 : 0.9)));
      const dir = unit(add(add(scale(round, 0.6), [0, 0.25, -0.9]), scale(u, Math.sin(phi) * 0.2)));
      const len = L * (0.8 + 0.35 * jitter(id)) * (layer ? 0.85 : 1) * (1 - 0.25 * Math.abs(Math.sin(phi)));
      out.push(feather(root, dir, [0, 0.2, -1], round, len, len * 0.42, K, 'cream', { fold: 0.3 }));
    }
  }
  return merge(...out);
}

/**
 * One folded wing, the right, in its bone's frame at the shoulder: its
 * feathers rooted along the top of the flank and lying back and down along
 * it, outermost on top -- brown coverts with dark tips over the slate
 * secondaries over the long blue primaries, the Skyrange's with an olive and
 * a grey one among them. Each feather's corners are listed (`spans`), with
 * its root and how far it turns (degrees) as the wing fans open.
 */
interface Wing { mesh: Mesh; spans: Array<[number, number, V3, number]> }
function wingOf(s: Sky, K: number): Wing {
  const W = s.wing, L = W.len, hang = W.hang * DEG;
  const parts: Array<{ m: Mesh; root: V3; k: number }> = [];
  // Each layer's feathers rooted close together high on the flank and lying straight back and down it at the wing's slope, the top
  // ones a little steeper so the tips close to a point: together a teardrop from the shoulder down to the tips, outermost on top.
  const lay = (count: number, top: number, bottom: number, len0: number, len1: number, wd: number, x: number, a0: number, a1: number, tone: (q: number) => Tone, row: number): void => {
    for (let q = 0; q < count; q++) {
      const f = count > 1 ? q / (count - 1) : 0;
      const root: V3 = [x + 0.01 * f, (0.05 - 0.1 * f) * L, lerp(top, bottom, f) * L];
      const a = hang + lerp(a0, a1, f) * DEG;
      const dir: V3 = [0.03, -Math.cos(a), -Math.sin(a)];
      // The coverts each a little longer or shorter than the next, so they lie as feathers rather than as the ribs of a cone.
      const len = lerp(len0, len1, f) * L * (tone(q) === 'covert' ? 0.8 + 0.4 * jitter(q * 7 + 3) : 0.9 + 0.2 * jitter(q * 5 + row * 11));
      // How far it turns as the wing opens, by where it is across the whole wing: the primaries from a little up to a little down,
      // the secondaries below them and the coverts lowest, so the opened wing is a fan of separate feathers.
      const fan = row === 2 ? lerp(-30, 15, f) : row === 1 ? lerp(10, 40, f) : lerp(35, 55, f);
      parts.push({ m: feather(root, dir, add(dir, [0, -0.25, 0.1]), [1, 0, 0.32], len, wd * L, K, tone(q), { tip: tone(q) === 'covert' ? 0.15 : 0.22, fold: 0.12 }), root, k: fan });
    }
  };
  // The primaries, innermost and longest: their tips the point of the wing.
  lay(W.primaries, 0, -0.22, 1.0, 0.84, 0.12, 0, 7, -7, (q) => (s.stage === 2 && q === W.primaries - 2 ? 'olive' : s.stage === 2 && q === 1 ? 'slate' : 'blue'), 2);
  // The secondaries over their lower part, shorter, slate grey-blue and blue by turns.
  lay(W.seconds, -0.1, -0.3, 0.68, 0.52, 0.11, 0.04, 0, -10, (q) => (q % 2 && s.stage ? 'blue' : 'slate'), 1);
  // The coverts over the front of it all, short and broad, brown with dark tips.
  lay(W.coverts, 0.04, -0.26, 0.38, 0.26, 0.12, 0.08, 6, -8, () => 'covert', 0);
  // A pad of brown at the shoulder the feathers come out of, so the wing is rooted in the body rather than laid against it.
  const pad = orbAlong([0.02, -0.04 * L, -0.06 * L], [0, -Math.cos(hang), -Math.sin(hang)], [Math.min(0.22, 0.1 * L + 0.04), Math.min(0.35, 0.2 * L), Math.min(0.14, 0.06 * L + 0.05)], 7, 4, 'coat');
  const spans: Array<[number, number, V3, number]> = [];
  let at = pad.v.length;
  for (const p of parts) {
    spans.push([at, at + p.m.v.length, p.root, p.k]);
    at += p.m.v.length;
  }
  return { mesh: merge(pad, ...parts.map((p) => p.m)), spans };
}

/** A wing fanned as it opens (`wingsOf`): each feather turned down and back about its root by how far down the wing it is, so the flight feathers spread. */
function fanned(s: Sky, w: Wing, mirror: boolean): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { open } = wingsOf(s, a);
    if (open <= 0.001) return v as V3[];
    const out = v.slice() as V3[];
    for (const [from, to, r0, k] of w.spans) {
      const r: V3 = mirror ? [-r0[0], r0[1], r0[2]] : r0;
      // Spread: each feather turned about its root by its own share of the fan (`wingOf`).
      const ang = open * k * DEG, c = Math.cos(ang), sn = Math.sin(ang);
      for (let i = from; i < to; i++) {
        const p = sub(v[i], r);
        out[i] = add(r, [p[0], p[1] * c - p[2] * sn, p[1] * sn + p[2] * c]);
      }
    }
    return out;
  };
}

/** A foot: two dark toes for the chick; a dark split hoof; or a pale cloven hoof with dark claws at the front of each toe. */
function footOf(s: Sky, n: number): Mesh {
  const r = s.foot.r, h = s.fore.len[2];
  // Nothing of it below its sole, which is where the ground is when it stands (`LegSpec.len`).
  const m = footShape(s, n, r, h);
  return { ...m, v: m.v.map((p) => [p[0], p[1], Math.max(-h, p[2])] as V3) };
}
function footShape(s: Sky, n: number, r: number, h: number): Mesh {
  if (s.foot.kind === 'toes') {
    // Two toes forward from a little pad, splayed, and the pad's heel.
    return merge(
      tube([[0, 0, 0.06], [0, 0.0, -h * 0.5]], [r * 0.7, r * 0.75], [r * 0.7, r * 0.75], n, 'hoof', { seam: 'start' }),
      ...[-1, 1].map((sd) => tube([[sd * r * 0.25, 0, -h * 0.55], [sd * r * 0.5, r * 0.8, -h + r * 0.3], [sd * r * 0.65, r * 1.4, -h + r * 0.55]], [r * 0.42, r * 0.36, r * 0.14], [r * 0.3, r * 0.28, r * 0.1], 5, 'hoof')),
    );
  }
  const pale = s.foot.kind === 'pale';
  return merge(...[-1, 1].map((sd) => merge(
    // Each half of the hoof a wedge, longer forward than it is wide, a narrow cleft between them.
    tube([[sd * r * 0.4, -r * 0.1, 0.05], [sd * r * 0.46, r * 0.12, -h * 0.55], [sd * r * 0.5, r * 0.3, -h]],
      [r * 0.42, r * 0.48, r * 0.5], [r * 0.62, r * 0.8, r * 0.9], n, pale ? 'horn' : 'hoof', { seam: 'start' }),
    // The pale hoof's claw: a dark point at the front of each toe, along the ground.
    pale && orbAlong([sd * r * 0.5, r * 1.05, -h + r * 0.2], [0, 1, -0.3], [r * 0.3, r * 0.42, r * 0.22], 5, 3, 'hoof'),
  )));
}

/** The feathered tuft round the fetlock, over the hoof: fawn feathers pointing down and back, longer behind. */
function fetlockOf(s: Sky, lower: number, w: number, K: number, seed: number): Mesh {
  if (!s.fetlock) return merge();
  const out: Mesh[] = [];
  for (let q = 0; q < 7; q++) {
    const th = (q / 7) * TAU + 0.4 * jitter(seed + q), rad: V3 = [Math.cos(th), Math.sin(th), 0];
    const back = Math.max(0, -rad[1]);
    const root = add(scale(rad, w * 0.9), [0, 0, -lower * 0.8]);
    const len = s.fetlock * (0.3 + 0.7 * back + 0.15 * jitter(seed + q + 5));
    out.push(feather(root, unit(add(scale(rad, 0.5), [0, -0.85 * back - 0.1, -0.38])), [0, -1, 0], rad, len, len * 0.28, K, q % 2 ? 'covert' : 'fawn', { tip: 0.35 }));
  }
  return merge(...out);
}

/** The tail: a short tuft of brown feathers out of the rump, pointing back and down, cream under. */
function tailOf(s: Sky, K: number): Mesh {
  const L = s.tail;
  return merge(
    ...[-1, 1].map((q) => feather([q * 0.05, 0.04, 0], [q * 0.2, -1, -0.1], [q * 0.25, -1, -0.4], [q * 0.3, 0.1, 1], L * 0.85, L * 0.3, K, 'flag', { tip: 0.25 })),
    feather([0, 0.04, 0.02], [0, -1, 0.05], [0, -1, -0.3], [0, 0.1, 1], L, L * 0.34, K, 'flag', { tip: 0.3 }),
  );
}

/** Darker speckles over the back, the feathering of a fawn's coat: small dabs either side of the spine and down over the haunches. */
function speckles(s: Sky): Mesh {
  const out: Disc[] = [];
  const B = s.body, span = B.y[B.y.length - 2] - B.y[1];
  for (let q = 0; q < 16; q++) {
    for (const sd of [1, -1]) {
      const y = B.y[1] + span * (0.05 + 0.85 * jitter(q * 3 + (sd > 0 ? 0 : 1))), th = Math.PI / 2 - sd * (0.25 + 0.75 * jitter(q * 5 + 2));
      const at = onRings(B, y, th);
      const r = 0.045 + 0.035 * jitter(q + 11);
      out.push(disc(add(at.p, scale(at.n, 0.012)), at.n, r * (1 + s.stage * 0.2), r * 0.65 * (1 + s.stage * 0.2), 6, 'featherDark', { spin: jitter(q) * 3 }));
    }
  }
  return paint(out);
}

/**
 * The Skyrange's garlands: a collar of leaves round the root of its neck,
 * lying on it and on the tops of its shoulders and hanging a little down
 * over its chest (in the ruff bone's frame); and a strand of leaves hung from
 * behind each ear down the side of the neck (in the head's).
 */
/**
 * The Skyrange's garland down each wing: a run of leaves laid over the top edge of the folded wing, from in front of the shoulder
 * back along it, each lying on the coverts and hanging a little down over them, in the right wing's frame (the left is its
 * mirror) so it goes with the wing as it opens.
 */
function garlandOf(s: Sky, K: number): Mesh {
  const W = s.wing, L = W.len, a = W.hang * DEG + 6 * DEG;
  const dir: V3 = [0.03, -Math.cos(a), -Math.sin(a)], down: V3 = [0, Math.sin(a) * 0.3, -1];
  const out: Mesh[] = [];
  const count = 5;
  for (let q = 0; q < count; q++) {
    const u = q / (count - 1);
    // Along the edge from a little in front of the shoulder to a fifth of the way down the wing, on top of the coverts: seen from
    // the side, and out of sight behind the wing from behind.
    const root = add([0.11, 0.1 * L, 0.03 * L], scale(dir, (u * 0.22 - 0.06) * L));
    const sway = q % 2 ? 0.45 : -0.25;
    const ld = unit(add(scale(down, 0.75 + 0.2 * jitter(q)), scale(dir, sway)));
    const len = (0.32 + 0.1 * jitter(q + 3)) * (1 - 0.25 * u);
    out.push(leaf(root, ld, [1, 0, 0.35], len, len * 0.42, K, jitter(q + 7) < 0.3, 'leaf'));
  }
  return merge(...out);
}
function collarOf(s: Sky, K: number): Mesh {
  const lean = s.neck.lean * DEG, R = s.neck.w[0];
  const A: V3 = [0, Math.sin(lean), Math.cos(lean)], u: V3 = [1, 0, 0], v = cross(A, u);
  const out: Mesh[] = [];
  // Round the front of the neck's root, hanging a little over the chest between the shoulders.
  const count = 7;
  for (let q = 0; q < count; q++) {
    const phi = ((q + 0.5) / count - 0.5) * 3.0;
    const round = add(scale(v, Math.cos(phi)), scale(u, Math.sin(phi)));
    const root = add(scale(A, 0.02), scale(round, R * 1.0));
    const dir = unit(add(scale(round, 0.3), [0, 0.05, -1]));
    const len = (0.34 + 0.1 * jitter(q + 3)) * (1 - 0.3 * Math.abs(Math.sin(phi)));
    out.push(leaf(root, dir, round, len, len * 0.42, K, jitter(q + 7) < 0.35));
  }
  return merge(...out);
}
function strandsOf(s: Sky, K: number): Mesh {
  const H = s.head, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    let at = onRings(H, lerp(H.y[0], H.y[1], 0.6), 0.4);
    if (sd < 0) at = left(at);
    // Hung from behind the ear: the first two leaves of a strand that goes on down the side of the neck (`neckStrandsOf`).
    let p = sub(at.p, scale(at.n, 0.02));
    for (let q = 0; q < 1; q++) {
      const out0: V3 = [sd, -0.25, 0];
      const dir = unit([sd * 0.25, -0.35, -1]);
      const len = 0.3 + 0.06 * jitter(q + (sd > 0 ? 0 : 20));
      out.push(leaf(p, add(dir, scale(out0, 0.35 * (q % 2 ? 1 : -0.4))), out0, len, len * 0.44, K, q % 3 === 2));
      p = add(p, scale(dir, 0.2));
    }
  }
  return merge(...out);
}
/** How thick the neck is, `z` up it from its root (`skyBuild`'s neck). */
function neckR(s: Sky, z: number): number {
  const NL = s.neck.len, [w0, w1] = s.neck.w;
  const zs = [-0.3, NL * 0.12, NL * 0.4, NL * 0.72, NL], ws = [w0 * 1.1, w0, lerp(w0, w1, 0.6), w1 * 1.02, w1];
  let k = 0;
  while (k < zs.length - 2 && zs[k + 1] < z) k++;
  return lerp(ws[k], ws[k + 1], clamp((z - zs[k]) / (zs[k + 1] - zs[k])));
}
/** The rest of each strand, rooted on the side of the neck below the head and hanging down along it, in the neck's frame. */
function neckStrandsOf(s: Sky, K: number): Mesh {
  const NL = s.neck.len, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    // Two a side, on the front of the side of the neck, where the neck hides them from behind.
    for (let q = 0; q < 2; q++) {
      const z = NL * (0.84 - 0.14 * q), r = neckR(s, z), th = 0.35 + 0.15 * q;
      const n: V3 = [Math.cos(th) * sd, Math.sin(th), 0];
      const root: V3 = [sd * r * Math.cos(th) * 0.92, r * Math.sin(th) * 0.92, z];
      const len = 0.3 + 0.06 * jitter(q + (sd > 0 ? 3 : 30));
      out.push(leaf(root, unit(add([0, -0.1, -1], scale(n, 0.3 + 0.15 * (q % 2)))), n, len, len * 0.44, K, q % 3 === 1));
    }
  }
  return merge(...out);
}

/** A leg's pieces on its three bones: a fawn upper, a lower dark from the knee down, the fetlock's tuft and the foot. */
function legPieces(s: Sky, key: string, fore: boolean, side: number, n: number, K: number): Piece[] {
  const L = fore ? s.fore.len : s.hind.len, [u0, u1, l0, l1] = s.thick;
  const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
  // The hind's upper is its haunch and gaskin, much thicker at the top; the fore's its forearm.
  // The hind's upper is its gaskin, coming out of the round of the haunch and quickly slim, so no flat plank of thigh shows under the
  // belly; the fore's its forearm.
  const top = fore ? u0 * 0.85 : u0, mid = fore ? lerp(top, u1, 0.6) : u1 * 1.4;
  const upper = tube([[0, 0, 0.15], [0, 0, -L[0] * 0.4], [0, 0, -L[0]]], [top, mid, u1], [top, mid, u1], n, 'coat', { seam: 'both' });
  const lap = l0 * 0.8;
  const lower = tube([[0, 0, lap], [0, 0, -L[1] * 0.12], [0, 0, -L[1] * 0.6], [0, 0.01, -L[1]]], [l0, l0, lerp(l0, l1, 0.6), l1], [l0, l0, lerp(l0, l1, 0.6), l1], n,
    (ring) => (ring === 0 ? 'coat' : 'bark'), { seam: 'both' });
  const foot = footOf(s, n);
  const tuft = fetlockOf(s, 0.12, l1, K, key.charCodeAt(0) * 7 + key.charCodeAt(1));
  return [
    { key: `${key}0`, mesh: upper, bone: `${key}0`, bias: 0.01, under: 'body', convex: true },
    { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: 'body', front, convex: true },
    { key: `${key}2`, mesh: side < 0 ? mirrored(foot) : foot, bone: `${key}2`, bias: 0.03, after: 'body', front },
    ...(s.fetlock ? [{ key: `${key}tuft`, mesh: tuft, bone: `${key}t`, bias: 0.035, after: [`${key}1`, `${key}2`, 'body'], front, thin: true } as Piece] : []),
  ];
}

/** A stage's pieces. */
function skyBuild(s: Sky, lod: number): Piece[] {
  const n = cut(lod, 7, 10), K = lod ? 6 : 4;
  const B = s.body;
  // The barrel: fawn, cream under the belly and down the front of the chest.
  const last = B.y.length - 1;
  const barrel = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n,
    (ring, j) => ((ring > 0 && under(n, j, 0.8)) || (ring >= last - 1 && under(n, j, 1.7)) ? 'mark' : 'coat'));
  // The haunches, a rounded mass over each hind leg, and the shoulders over each fore.
  const spec = specOf(s);
  const quarters = merge(...[1, -1].flatMap((sd) => {
    const hip = spec.hind.at, sh = spec.fore.at, t = s.thick[0];
    return [
      orb([sd * (hip[0] + t * 0.15), hip[1] + 0.02, hip[2] + 0.05], [t * 1.3 + 0.05, t * 1.8 + 0.08, B.h[2] * 0.6], n, 4, 'coat'),
      orb([sd * (sh[0] + t * 0.05), sh[1] - 0.04, sh[2] + 0.24], [t * 1.0 + 0.05, t * 1.4 + 0.06, B.h[4] * 0.55], n, 4, 'coat'),
    ];
  }));
  // The neck: fawn behind, cream down the front; tapering from where it comes out of the shoulders to the head.
  const NL = s.neck.len;
  const neckPts: V3[] = [[0, -0.06, -0.3], [0, -0.02, NL * 0.12], [0, 0, NL * 0.4], [0, 0.02, NL * 0.72], [0, 0.04, NL]];
  const nw = [s.neck.w[0] * 1.1, s.neck.w[0], lerp(s.neck.w[0], s.neck.w[1], 0.6), s.neck.w[1] * 1.02, s.neck.w[1]];
  const neck = tube(neckPts, nw, nw.map((x) => x * 1.05), n, (ring, j) => (Math.sin(((j + 1) / n) * TAU) > -0.25 ? 'mark' : 'coat'), { seam: 'both' });
  const hide = headSolids(s), skull = hide[0];
  const ear = moved(earOf(s.ear.len, s.ear.w, n), [0, 0, 0], -40);
  const wing = wingOf(s, K), wingL = { mesh: mirrored(wing.mesh), spans: wing.spans };
  const pieces: Piece[] = [
    { key: 'body', mesh: merge(barrel, quarters, speckles(s)), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } },
    { key: 'neck', mesh: neck, bone: 'neck', bias: 0, under: 'head', convex: true },
    { key: 'head', mesh: headOf(s, n + 1, false), shut: headOf(s, n + 1, true), bone: 'head', bias: 0.2, hide },
    { key: 'ear0', mesh: mirrored(ear), bone: 'ear0', bias: 0.21, after: 'head', hide, hideIn: 'head' },
    { key: 'ear1', mesh: ear, bone: 'ear1', bias: 0.21, after: 'head', hide, hideIn: 'head' },
    {
      key: 'crest', mesh: crestOf2(s, K), bone: 'crest', bias: 0.23, after: ['head', 'ear0', 'ear1'], hide: [skull], hideIn: 'head',
      // Grown in as it evolves, about its root.
      bent: (v, a) => {
        if (a.act?.kind !== 'evolve') return v as V3[];
        const k = growOf(a.act.t);
        return v.map((p) => scale(p, k));
      },
    },
    { key: 'ruff', mesh: ruffOf(s, K), bone: 'ruff', bias: 0.16, after: ['neck', 'body'], front: [0, 1, 0], thin: true, lines: false },
    { key: 'tail0', mesh: tailOf(s, K), bone: 'tail0', bias: -0.05, thin: true },
    { key: 'wing0', mesh: wingL.mesh, bone: 'wing0', bias: 0.05, after: ['body', 'hl0', 'fl0'], front: [-1, 0, 0], bent: fanned(s, wingL, true) },
    { key: 'wing1', mesh: wing.mesh, bone: 'wing1', bias: 0.05, after: ['body', 'hr0', 'fr0'], front: [1, 0, 0], bent: fanned(s, wing, false) },
  ];
  if (s.cheek[0]) pieces.push({ key: 'cheeks', mesh: cheeksOf(s, K), bone: 'head', bias: 0.215, after: 'head', hide: [skull], thin: true });
  if (s.garland) {
    const garland = garlandOf(s, K);
    pieces.push({ key: 'garland0', mesh: mirrored(garland), bone: 'wing0', bias: 0.06, after: ['wing0', 'body'], front: [-0.8, 0.6, 0] });
    pieces.push({ key: 'garland1', mesh: garland, bone: 'wing1', bias: 0.06, after: ['wing1', 'body'], front: [0.8, 0.6, 0] });
    pieces.push({ key: 'collar', mesh: collarOf(s, K), bone: 'ruff', bias: 0.17, after: ['neck', 'body', 'ruff'], front: [0, 1, 0] });
    pieces.push({ key: 'strands', mesh: strandsOf(s, K), bone: 'head', bias: 0.19, after: ['neck'], hide: [skull] });
    pieces.push({ key: 'neckStrands', mesh: neckStrandsOf(s, K), bone: 'neck', bias: 0.05, after: ['neck'] });
  }
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    pieces.push(...legPieces(s, key, fore, side, n, K));
  }
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const SKY_BLUE: RGB = [118, 178, 236];
const PALE_GOLD: RGB = [250, 226, 150];
const FEATHER_BLUE: RGB = [98, 146, 206];
const FEATHER_TIP: RGB = [44, 62, 104];
const FEATHER_FAWN: RGB = [214, 168, 116];
const LEAF: RGB = [138, 172, 96];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** A feather in the air, `len` long, turned `ang`: a long vane with a dark tip and a pale quill down it. */
function flyingFeather(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const vane = (): void => {
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.quadraticCurveTo(-len * 0.1, -len * 0.22, len / 2, -len * 0.02);
    g.quadraticCurveTo(-len * 0.05, len * 0.2, -len / 2, 0);
  };
  vane();
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = len * 0.07;
  g.strokeStyle = css(mix(c, [30, 30, 50], 0.5), al);
  g.stroke();
  // Its dark tip.
  g.save();
  vane();
  g.clip();
  g.fillStyle = css(mix(c, FEATHER_TIP, 0.75), al);
  g.fillRect(len * 0.22, -len, len, len * 2);
  g.restore();
  g.restore();
}

/** A soft puff of dust on the ground at a point, `r` across. */
function dust(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  if (al <= 0.01) return;
  const [x, y] = onScreen(view, at);
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css([196, 172, 136], al));
  grad.addColorStop(1, css([196, 172, 136], 0));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y - r * 0.2, r, r * 0.6, 0, 0, TAU);
  g.fill();
}

/** A ring on the ground about `c`, `r` across, as a run of short strokes each drawn only on its own side of the body (`nearSide`). */
function groundRing(g: CanvasRenderingContext2D, view: View, c: V3, r: number, mid: V3, width: number, col: RGB, al: number, front: boolean, z = 0.02): void {
  if (al <= 0.01 || r <= 0) return;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.strokeStyle = css(col, al);
  const N = 40;
  g.beginPath();
  let on = false;
  for (let q = 0; q <= N; q++) {
    const a = (q / N) * TAU, p: V3 = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z];
    const keep = nearSide(p, mid, view) === front;
    const [x, y] = onScreen(view, p);
    if (keep && on) g.lineTo(x, y);
    else if (keep) { g.moveTo(x, y); on = true; } else on = false;
  }
  g.stroke();
}

/** A breath of wind: a short curved white stroke swept along `dir` on the screen, fading at either end. */
function gust(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, curl: number, al: number, width: number): void {
  if (al <= 0.01) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const grad = g.createLinearGradient(-len / 2, 0, len / 2, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, css([250, 252, 255], al));
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.strokeStyle = grad;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -curl * len, len / 2, 0);
  g.stroke();
  g.restore();
}

/** A small mote of light: a bright point with a little glow about it. */
function mote(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  const halo = g.createRadialGradient(x, y, 0, x, y, r * 3);
  halo.addColorStop(0, css([255, 255, 255], al * 0.6));
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  g.fillStyle = css(c, al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** A soft round puff of light-filled cloud, `r` across. */
function puff(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number): void {
  if (al <= 0.01) return;
  const grad = g.createRadialGradient(x, y - r * 0.15, 0, x, y, r);
  grad.addColorStop(0, css(mix(c, [255, 255, 255], 0.5), al));
  grad.addColorStop(0.55, css(c, al * 0.75));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling slowly as a feather does; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 3): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Skywarden's. */
const bigness = (s: Sky): number => [0.9, 1, 1.25][s.stage];
/** The middle of the body, for what is in front of it and what behind. */
const midOf = (b: Bones): V3 => b.body.t;

/**
 * Striking: as the blow lands, feathers shaken loose off the wings flying up
 * and out and drifting down, a burst of wind off the wings, and a puff of
 * dust where the hooves come down; for the Skyrange a ring of wind going out
 * over the ground from its fore hooves; for the Skylooklet the wind off its
 * beak.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Sky, b: Bones, at: Bones, t: number, front: boolean): void {
  const hit = HIT[s.stage], big = bigness(s), mid = midOf(at);
  const since = (t - hit) * ACT_SECS.strike;
  // Where the blow lands: under the fore hooves, or in front of the beak.
  const feet = s.strike.rear ? [place(at.fl2, [0, 0.1, -s.fore.len[2]]), place(at.fr2, [0, 0.1, -s.fore.len[2]])] : [];
  const beak = place(at.head, [0, s.head.y[s.head.y.length - 1] + 0.25, s.head.z[s.head.z.length - 1]]);
  const land: V3 = s.strike.rear ? [(feet[0][0] + feet[1][0]) / 2, (feet[0][1] + feet[1][1]) / 2, 0.02] : beak;
  if (since > 0) {
    const fade = 1 - ramp(t, hit + 0.18, 1);
    // Dust where the hooves come down.
    if (s.strike.rear && front) for (const f of feet) dust(g, view, [f[0], f[1], 0.05], (0.6 + 2.6 * since) * big, 0.55 * fade);
    // Feathers off the wings: up and out, then drifting down, spinning.
    const count = [9, 9, 12][s.stage];
    for (let q = 0; q < count; q++) {
      const sd = q % 2 ? 1 : -1, wing = sd > 0 ? at.wing1 : at.wing0;
      const from = place(wing, [0, -s.wing.len * (0.3 + 0.4 * jitter(q + 3)), -0.15]);
      const v: V3 = [sd * (2.2 + 2 * jitter(q + 9)), -0.8 + 1.6 * jitter(q + 4), 3 + 2.4 * jitter(q + 2)];
      const p = thrown(from, v, since, 5);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const spin = q * 1.3 + since * (5 + 4 * jitter(q + 5)) * (q % 3 ? 1 : -1) + 0.4 * Math.sin(since * 9 + q);
      flyingFeather(g, x, y, (0.8 + 0.3 * jitter(q + 1)) * big, spin, q % 3 === 2 ? FEATHER_FAWN : FEATHER_BLUE, fade);
    }
    // The wind of it: a ring going out over the ground from the hooves (or, pecking, curls of wind blown on ahead of the beak).
    const out = clamp(since / 0.24);
    if (s.strike.rear) {
      groundRing(g, view, land, (0.6 + (s.strike.both ? 3.4 : 2.2) * out) * big, mid, (0.22 - 0.14 * out) * big, [244, 250, 255], 0.75 * (1 - out), front);
      if (s.strike.both) groundRing(g, view, land, (0.4 + 2.2 * out) * big, mid, (0.16 - 0.1 * out) * big, [200, 226, 250], 0.6 * (1 - out), front);
    } else {
      // Pecking, a small ring of wind out over the ground under the blow, and curls of wind blown on ahead of the beak.
      // Drawn whole over everything, so it shows from behind too, where the body would otherwise hide most of it.
      if (front) for (const side of [true, false]) groundRing(g, view, [beak[0], beak[1], 0.02], (0.5 + 2.1 * out) * big, mid, (0.16 - 0.1 * out) * big, [244, 250, 255], 0.75 * (1 - out), side);
    }
    if (!s.strike.rear && (front || !nearSide(beak, mid, view))) {
      const fwd = sub(place(at.head, [0, 2, 0]), place(at.head, [0, 0, 0]));
      for (let q = 0; q < 3; q++) {
        const p = add(beak, add(scale(unit(fwd), 0.2 + 1.2 * out + 0.15 * q), [0, 0, (q - 1) * 0.25]));
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p), [x0, y0] = onScreen(view, beak);
        gust(g, x, y, (0.7 + 0.3 * q) * big * (0.6 + out), Math.atan2(y - y0, x - x0) + Math.PI / 2, 0.35, 0.8 * (1 - out), 0.14 * big);
      }
    }
  }
  // The wind off the wings as they flare and beat: curls swept up and out off the ends of the wings.
  const beatK = s.strike.rear ? hump(t, hit - 0.08, 0.14) : hump(t, hit - 0.02, 0.12);
  if (beatK > 0) {
    for (const wing of [at.wing0, at.wing1]) {
      const tip = place(wing, [0, -s.wing.len * 0.75, -0.3]), root = place(wing, [0, 0, 0]);
      for (let q = 0; q < 2; q++) {
        const p = add(tip, [0, 0, 0.35 + 0.45 * q]);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p), [x0, y0] = onScreen(view, root);
        gust(g, x, y, (0.9 + 0.3 * q) * big, Math.atan2(y - y0, x - x0), 0.3, 0.7 * beatK, 0.13 * big);
      }
    }
  }
}

/**
 * Evolving: at the start a burst of blue feathers and light out of it, thick
 * enough to cover the moment it changes into its new body; then feathers --
 * and, for the Skyrange, leaves -- going up round it in a spiral; and at the
 * flash, as its crest grows in, a bright sky-blue ring sweeping out over the
 * ground far past it and a second at the height of its eyes, the pulse of
 * how far it sees.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Sky, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = midOf(b);
  const since = t * ACT_SECS.evolve;
  const tall = place(b.head, [0, 0, 0])[2] + 0.6;
  const burst = ramp(t, 0, 0.02) * (1 - ramp(t, 0.1, 0.26)), grow = 0.5 + 0.5 * ramp(t, 0, 0.05);
  // A cloud of sky-blue and white light round the whole of it as it begins, thick enough to hide the change of body, thinning
  // by a seventh of the way through.
  const cloud = ramp(t, 0, 0.02) * (1 - ramp(t, 0.05, 0.22));
  if (cloud > 0) {
    for (let q = 0; q < 10; q++) {
      const a = (q / 10) * TAU + 0.4, h = tall * (0.12 + 0.8 * jitter(q + 2));
      const r = (0.5 + 0.4 * jitter(q + 5)) * big + since * 1.2;
      const c: V3 = [Math.cos(a) * r * 0.7, mid[1] + Math.sin(a) * r * 0.7, h + since * 0.8];
      if (nearSide(c, mid, view) !== front) continue;
      const [x, y] = onScreen(view, c);
      puff(g, x, y, ((1.3 + 0.7 * jitter(q)) * big + since * 2) * (0.7 + 0.3 * tall / 6), q % 3 ? [196, 226, 252] : [255, 250, 236], 0.85 * cloud);
    }
  }
  if (burst > 0) {
    for (let q = 0; q < 30; q++) {
      const th = (q / 30) * TAU * 2.4 + jitter(q) * 0.7, el = jitter(q + 40);
      const from: V3 = [Math.cos(th) * 0.4, mid[1] + Math.sin(th) * 0.4, tall * (0.2 + 0.65 * el)];
      const p = thrown(from, [Math.cos(th) * (2.6 + 2.2 * jitter(q + 3)), Math.sin(th) * (2.6 + 2.2 * jitter(q + 5)), 1.4 + 2.4 * jitter(q + 7)], since, 2.5);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 3 === 0) mote(g, x, y, 0.16 * big, q % 2 ? SKY_BLUE : PALE_GOLD, burst);
      else if (s.stage === 2 && q % 5 === 1) flyingFeather(g, x, y, 0.8 * big * grow, q * 1.1 + since * 6, LEAF, burst);
      else flyingFeather(g, x, y, (0.95 + 0.35 * jitter(q)) * big * grow, q * 1.3 + since * 7, q % 4 === 1 ? FEATHER_FAWN : FEATHER_BLUE, burst);
    }
  }
  // The swirl: feathers up round it, wide at its feet and gathering in as they rise.
  const fade = ramp(t, 0.1, 0.24) * (1 - ramp(t, 0.72, 0.95));
  const wide = 1.4 * big + 0.6;
  for (let q = 0; q < 16; q++) {
    const rise = frac(t * 1.15 + q / 16), ang = (q / 16) * TAU * 3 + t * TAU * 1.4;
    const r = wide * (1 - 0.4 * rise);
    const p: V3 = [Math.cos(ang) * r, mid[1] + Math.sin(ang) * r, rise * tall * 1.05];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const al = fade * Math.sin(rise * Math.PI);
    if (q % 4 === 2) mote(g, x, y, 0.13 * big, q % 8 ? SKY_BLUE : PALE_GOLD, al);
    else if (s.stage === 2 && q % 4 === 3) flyingFeather(g, x, y, 0.7 * big, ang * 1.5 + rise * 4, LEAF, al);
    else flyingFeather(g, x, y, 0.7 * big, ang * 1.5 + rise * 4, q % 4 === 1 ? FEATHER_FAWN : FEATHER_BLUE, al);
  }
  // The pulse at the flash: a bright ring out over the ground, far past it, and a fainter one at the height of its eyes.
  const out = clamp((t - 0.5) / 0.32);
  if (out > 0 && out < 1) {
    const reach = (2 + 9 * smooth(out)) * big, al = (1 - out) ** 1.3;
    groundRing(g, view, [0, mid[1], 0], reach, mid, (0.3 - 0.2 * out) * big, SKY_BLUE, 0.9 * al, front);
    groundRing(g, view, [0, mid[1], 0], reach * 0.82, mid, (0.16 - 0.1 * out) * big, [236, 248, 255], 0.7 * al, front);
  }
}

/**
 * A cool flash where the blow lands: drawn over the body when it is on the viewer's side, and under it, fainter, when it is on the
 * far side, so from behind the flash at the nose or the hooves does not paint over the back of the head.
 */
function strikeFlash(g: CanvasRenderingContext2D, view: View, s: Sky, at: Bones, t: number, front: boolean): void {
  const k = hump(t, HIT[s.stage] + 0.02, 0.1);
  if (k <= 0) return;
  const p: V3 = s.strike.rear
    ? [(at.fl2.t[0] + at.fr2.t[0]) / 2, (at.fl2.t[1] + at.fr2.t[1]) / 2 + 0.2, 0.25]
    : place(at.head, [0, s.head.y[s.head.y.length - 1] + 0.15, 0]);
  const near = nearSide(p, midOf(at), view);
  if (near !== front) return;
  const [x, y] = onScreen(view, p), r = [0.9, 1.3, 1.9][s.stage], al = [0.4, 0.35, 0.45][s.stage] * k * (near ? 1 : 0.35);
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css([226, 240, 255], al));
  grad.addColorStop(0.45, css([226, 240, 255], al * 0.35));
  grad.addColorStop(1, css([226, 240, 255], 0));
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

/** Light: a sky-blue glow over the crest as it grows in, evolving. */
function skyGlow(s: Sky, b: Bones, a: Anim, atHit: (a: Anim) => Bones): Array<{ p: V3; r: number; c: RGB; a: number }> {
  void atHit;
  const act = a.act;
  if (act?.kind === 'evolve') {
    const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.9)) + 0.5 * hump(act.t, 0.5, 0.05);
    if (k <= 0) return [];
    const top = s.crest[0][0] * 0.5;
    return [{ p: place(b.crest, [0, -top * 0.4, top]), r: 0.8 + top, c: [170, 214, 255], a: k }];
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A colour pushed further from its own grey, so it reads at the size the island is played at. */
const richer = (c: RGB, k: number): RGB => {
  const m = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => clamp(m + (x - m) * k, 0, 255)) as RGB;
};

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes and evolves. */
function skyKind(s: Sky): Kind {
  const bones = skyBones(s);
  // Where everything is at the moment the blow lands, for what is thrown off then to fly from.
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: HIT[s.stage] } });
  return {
    bones,
    build: (lod) => skyBuild(s, lod),
    // The variant's coat for its fawn, a little deeper and warmer so it holds against the grass; its markings for its cream throat,
    // chest, belly and ruff. The blue of its crest and flight feathers, the dark of its lower legs and hooves, the pink of its ears
    // and its leaves are its own, the same on every variant.
    palette: (coat, mark) => {
      // A grey variant's greys leaning warm, to a grey-brown and a pale stone, rather than the dove-lilac greys go to by default.
      const fur = richer(darker(pastel(coat, 30), 0.1), 1.15);
      const cream = pastel(mark, 40);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: darker(fur, 0.2),
        coatLight: lighter(fur, 0.3),
        mark: cream,
        belly: mix(cream, fur, 0.18),
        muzzle: lighter(cream, 0.2),
        feather: darker(fur, 0.26),
        featherDark: mix(darker(fur, 0.55), [70, 50, 44], 0.3),
        inner: [236, 166, 172],
        nose: [62, 46, 50],
        lid: [62, 44, 48],
        eye: [34, 28, 40],
        eyeWhite: [255, 252, 246],
        // The iris: a clear blue-grey.
        billDark: [104, 140, 182],
        // The flight feathers and the crest: a slate blue, deep at the tips; a grey-blue; an olive.
        crystal: [86, 140, 210],
        crystalDark: [40, 58, 104],
        stone: [128, 156, 196],
        stoneDark: [76, 96, 132],
        moss: [164, 176, 84],
        // The lower legs, dark brown, a little of the coat in them; the hooves darker; the Skyrange's pale.
        // The chick's a lighter brown, so its short legs do not run together into one dark block at the size it is played at.
        bark: s.stage === 0 ? mix([128, 94, 70], fur, 0.15) : mix([88, 62, 50], fur, 0.12),
        hoof: [56, 42, 40],
        horn: [232, 218, 192],
        // Its leaves a deeper green than the grass, so a garland reads as leaves and not as a hole through to the ground.
        leaf: [96, 150, 60],
        stem: [190, 214, 112],
        leafDark: [60, 100, 48],
      }, 30);
    },
    shadow: [[0.95, 1.4, 1.75][s.stage], [0.75, 0.85, 1.0][s.stage]],
    // The two that bound at a run are carried through the air between their footfalls (`leapOf`).
    leaps: s.gait.bound ? [false, true] : undefined,
    stride: 1.2,
    size: s.size,
    blinks: 5,
    acts: ['strike'],
    // Evolving, the motes rising round it are sky blue and pale gold.
    motes: [SKY_BLUE, PALE_GOLD],
    glow: (b, a) => skyGlow(s, b, a, atHit),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') {
        strikeBurst(g, view, s, b, atHit(a), act.t, front);
        strikeFlash(g, view, s, atHit(a), act.t, front);
      }
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SKYLOOKLET = skyKind(SKYLOOKLET_LOOK);
export const SKYWARDEN = skyKind(SKYWARDEN_LOOK);
export const SKYRANGE = skyKind(SKYRANGE_LOOK);
/** The stand pose's scan, for a tool that wants to show it (`lookout`). */
export const SKY_SCANS = SCANS;
