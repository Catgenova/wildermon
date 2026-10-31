import {
  ACT_SECS, add, beat, LOOP, birdBones, clamp, coatPalette, cross, curve, cyc, DEG, dot, eyes, frac, lerp, merge, mirrored, mix, moved, orbAlong,
  scale, smooth, sub, taper, TAU, tube, unit, type Anim, type BirdPose, type BirdSpec, type Bones, type Kind, type Piece,
} from './beasts';
import { cut, earMesh } from './beastkit';
import { ball, joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import { patch } from './wild-birds';

/**
 * The owl line: the Whispling, a small round owlet with a cream face and
 * chest, a short hooked peach beak, big brown eyes, pink-lined ears in tufts
 * of sage-green leaf-feathers, and a body cloaked in layered sage-green and
 * peach feathers on short legs with dark brown talons; which grows into the
 * Hushwing, a lighter, longer owl that holds its broad wings spread -- cream
 * and peach flight feathers under green coverts -- with larger leafy ear tufts
 * and a long tail of green and pink feathers; and then the Songroost, a tall
 * upright owl on long feathered legs, a tall crest of feather tufts, its wings
 * folded into a long cloak of feathers that reaches the ground. The species
 * is still `kemma` underneath, as saves and the database know it: it grooms.
 *
 * Each is its variant's coat for the green of its leaf-feathers and its
 * markings for their peach; the cream of its face and chest, its eyes, beak
 * and talons are the same on every variant. All three are built by one set of
 * functions from a description of the stage (`Owl`), on the two-legged body a
 * bird has (`birdBones`).
 *
 * At its task it brushes the wildermon beside it (`OWL_WORK`): it turns to its
 * right, opens that wing and sweeps its flight feathers along it, three strokes
 * forward and back, with loose fluff drifting off at the end of each, then
 * folds the wing again.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/**
 * A feather of a wing, built folded along the right flank: how far along the arm its root is, how long and wide, the way it points folded
 * and spread (degrees round from straight back toward up), how far out from the flank it lies (its layer), and its two colours.
 */
interface Pinion { at: number; len: number; w: number; fold: number; open: number; layer: number; flare?: number; yaw?: number; mats: readonly [Mat, Mat] }

/** A leaf-feather of a tuft, a tail or a plume: its length and half-width, how far it leans from its axis (degrees), out to the side (degrees), and its two colours. */
type Plume = readonly [number, number, number, number, Mat, Mat];

/** How far its wings are spread (nought folded, one fanned open), rolled up and out about the shoulder (degrees), and swept forward. */
interface WingSet { spread: number; raise: number; sweep: number }

interface Owl {
  stage: 0 | 1 | 2;
  spec: BirdSpec;
  /** The body: an egg, square to the body's bone. How far down its back the green comes (the height, nought the middle, one the top). */
  body: { c: V3; r: V3; green: number };
  /** Rows of small scale-feathers over its shoulders and back: rows, how many in the top row, length and half-width, from and to (heights round the egg), and how far round each side from straight back (degrees). */
  mantle: { rows: number; count: number; len: number; w: number; from: number; to: number; round: number };
  /** The ruff of longer leaf-feathers round the root of its neck: how many, how long and wide, how far round each side from straight back (degrees), and how high up the body (height round the egg). */
  ruff: { n: number; len: number; w: number; round: number; at: number };
  /** The cream bib of fluff down its front: rows, how long a tuft. */
  bib: { rows: number; len: number };
  /** Rows of leaf-feathers down its neck, over the back and sides, and how long each is; none for a neck the head sits on. */
  collar?: { rows: number; len: number; w: number };
  head: { c: V3; r: V3 };
  eye: { dir: V3; size: number };
  beak: { len: number; w: number };
  /** Each ear: its root on the head (right side), how long and wide, how far out from upright and back (degrees). */
  ear: { at: V3; len: number; w: number; out: number; back: number };
  /** The leaf-feathers round each ear: up and back of upright toward out (degrees, as `Plume`). */
  tuft: Plume[];
  /** A crest of leaf-feathers up the middle of its crown, fanned from upright (0) back (degrees, as `Plume`); none for most. */
  crest?: Plume[];
  /** The wing: its shoulder, its feathers, and how it is held standing. */
  /** The wing: its shoulder, the way its arm runs back from it folded, how far the arm swings up spread (degrees), its feathers, and how it is held standing. */
  wing: { at: V3; arm: V3; reach: number; pinions: Pinion[]; rest: WingSet };
  tail: Plume[];
  /** Its legs: the thigh's fluff, how thick the shank is, how long its talons, and whether green leaf-feathers hang down them (how many, how long). */
  leg: { fluff: number; w: number; talon: number; shag: [number, number] };
  size: number;
}

/**
 * A tuft of `n` leaf-feathers fanned from upright (`from` degrees) out to the side (`to`), the longest `len` and `w` across at upright and
 * shorter out to the side; the green ones' shades mixed, with peach and pink ones among them.
 */
function fan(n: number, len: number, w: number, from: number, to: number): Plume[] {
  const shades: ReadonlyArray<readonly [Mat, Mat]> = [['leaf', 'leafDark'], ['moss', 'leaf'], ['leafDark', 'leaf'], ['petal', 'bloom'], ['leaf', 'moss'], ['feather', 'petal']];
  return Array.from({ length: n }, (_, q) => {
    const u = q / Math.max(1, n - 1), up = lerp(from, to, u);
    const [m0, m1] = shades[[0, 1, 2, 4, 3, 0, 2, 1, 5, 4, 0, 2][q % 12]];
    return [len * (1 - 0.22 * Math.abs(u - 0.2) - 0.06 * (q % 2)), w * (1 - 0.1 * u), up, 0, m0, m1] as const;
  });
}

/**
 * A row of `n` feathers of a wing, the first to the last: how far along the arm each is rooted, how long, how wide, the way each
 * points folded and spread, how far round from the flank toward the back it is rooted (`Pinion.yaw`), how far out it flares, its
 * layer, and the colours it cycles through.
 */
function row(n: number, o: {
  at: readonly [number, number]; len: readonly [number, number]; w: number; fold: readonly [number, number]; open: readonly [number, number];
  layer: number; flare?: number; yaw?: readonly [number, number]; mats: ReadonlyArray<readonly [Mat, Mat]>;
}): Pinion[] {
  return Array.from({ length: n }, (_, q) => {
    const u = n > 1 ? q / (n - 1) : 0;
    return {
      at: lerp(o.at[0], o.at[1], u), len: lerp(o.len[0], o.len[1], u), w: o.w, fold: lerp(o.fold[0], o.fold[1], u), open: lerp(o.open[0], o.open[1], u),
      layer: o.layer + 0.004 * q, flare: o.flare ?? 0, yaw: o.yaw ? lerp(o.yaw[0], o.yaw[1], u) : 0, mats: o.mats[q % o.mats.length],
    };
  });
}

/** The colours a row of feathers cycles through: green ones, peach ones. */
const GREENS: ReadonlyArray<readonly [Mat, Mat]> = [['leaf', 'leafDark'], ['moss', 'leaf'], ['leafDark', 'leaf'], ['leaf', 'moss']];
const PEACHES: ReadonlyArray<readonly [Mat, Mat]> = [['petal', 'feather'], ['feather', 'featherDark'], ['featherDark', 'petal'], ['feather', 'petal']];

/** A Whispling: small and pear-shaped, a big head, pink-lined ears in fans of leaf-feathers, its wings a cloak of green over peach. */
const WHISPLING_LOOK: Owl = {
  stage: 0,
  spec: {
    high: 1.0,
    leg: { at: [0.34, 0.14, -0.6], len: [0.2, 0.16, 0.05], rest: [6, -16] },
    neck: { at: [0, 0.06, 0.6], len: 0.16, lean: 4 },
    head: { pitch: -4 },
    wing: { at: [0.66, 0.0, 0.3] },
    tail: { at: [0, -0.7, -0.45], lift: -30 },
    swing: [30, 40],
    thrust: 2,
    waddle: 7,
    peck: 30, tip: 24, nose: 26, crouch: 0.3, stance: 1,
  },
  body: { c: [0, 0, -0.14], r: [1.12, 0.98, 0.86], green: 0.1 },
  mantle: { rows: 4, count: 11, len: 0.3, w: 0.15, from: 0.72, to: 0.2, round: 150 },
  ruff: { n: 13, len: 0.46, w: 0.17, round: 132, at: 0.78 },
  bib: { rows: 5, len: 0.24 },
  head: { c: [0, 0.04, 0.36], r: [0.72, 0.64, 0.62] },
  eye: { dir: [0.37, 0.88, 0.22], size: 0.145 },
  beak: { len: 0.19, w: 0.075 },
  ear: { at: [0.46, -0.02, 0.8], len: 0.5, w: 0.3, out: 40, back: 6 },
  tuft: fan(9, 1.2, 0.27, 0, 112),
  wing: {
    at: [1.0, 0.04, 0.42],
    arm: [0, -0.4, -1],
    reach: 30,
    pinions: [
      // The flight feathers, peach and cream, round the side from the front of the flank to the back, nearly to its feet.
      ...row(8, { at: [0.2, 0.3], len: [1.12, 1.24], w: 0.27, fold: [-96, -66], open: [-40, 40], layer: 0, flare: 0.42, yaw: [-48, 62], mats: PEACHES }),
      // Rows of green coverts over them, shorter row by row, the top one the scale-feathers of the shoulder.
      ...row(8, { at: [0.06, 0.12], len: [0.8, 0.86], w: 0.25, fold: [-96, -64], open: [-30, 34], layer: 0.08, flare: 0.36, yaw: [-52, 58], mats: GREENS }),
      ...row(7, { at: [0.0, 0.04], len: [0.52, 0.56], w: 0.23, fold: [-94, -62], open: [-20, 30], layer: 0.15, flare: 0.3, yaw: [-50, 54], mats: GREENS }),
      ...row(6, { at: [-0.04, 0], len: [0.32, 0.34], w: 0.2, fold: [-92, -60], open: [-10, 24], layer: 0.21, flare: 0.24, yaw: [-44, 50], mats: GREENS }),
    ],
    rest: { spread: 0, raise: 0, sweep: 0 },
  },
  tail: [[0.5, 0.14, 0, 0, 'leaf', 'leafDark'], [0.46, 0.13, 6, -22, 'petal', 'leaf'], [0.46, 0.13, 6, 22, 'leaf', 'petal']],
  leg: { fluff: 0.1, w: 0.09, talon: 0.19, shag: [0, 0] },
  size: 1.9,
};

/** A Hushwing: lighter and longer, hovering on broad wings raised in a V, bigger leafy ear tufts, a long green and pink tail. */
const HUSHWING_LOOK: Owl = {
  stage: 1,
  spec: {
    high: 1.7,
    leg: { at: [0.32, 0.22, -0.56], len: [0.48, 0.5, 0.06], rest: [-14, -30] },
    neck: { at: [0, 0.6, 0.56], len: 0.3, lean: 10 },
    head: { pitch: -10 },
    wing: { at: [0.5, 0.3, 0.32] },
    tail: { at: [0, -0.9, -0.1], lift: -58 },
    swing: [30, 40],
    hop: true,
    thrust: 4,
    waddle: 3,
    peck: 34, tip: 22, nose: 24, crouch: 0.4, stance: 1,
  },
  body: { c: [0, 0, 0], r: [0.8, 1.04, 0.86], green: 0.45 },
  mantle: { rows: 5, count: 9, len: 0.38, w: 0.16, from: 0.66, to: -0.1, round: 115 },
  ruff: { n: 14, len: 0.6, w: 0.18, round: 140, at: 0.68 },
  bib: { rows: 6, len: 0.3 },
  head: { c: [0, 0.06, 0.44], r: [0.82, 0.74, 0.7] },
  eye: { dir: [0.38, 0.87, 0.24], size: 0.14 },
  beak: { len: 0.2, w: 0.075 },
  ear: { at: [0.54, -0.02, 0.92], len: 0.54, w: 0.34, out: 42, back: 8 },
  tuft: fan(10, 1.35, 0.28, 0, 108),
  wing: {
    at: [0.74, 0.42, 0.56],
    arm: [0, -1, -0.1],
    reach: 100,
    pinions: [
      // The flight feathers, cream and peach, broad and long, rooted along the arm and fanned so their tips stand apart.
      ...row(10, { at: [0.15, 2.1], len: [2.0, 3.0], w: 0.38, fold: [-6, -2], open: [4, 136], layer: 0, mats: PEACHES }),
      // The coverts: green, in two rows along the leading edge, over and under the roots of the flight feathers.
      ...row(10, { at: [0.05, 2.1], len: [2.0, 1.6], w: 0.34, fold: [-4, -4], open: [50, 112], layer: 0.16, mats: GREENS }),
      ...row(9, { at: [0.05, 2.1], len: [0.9, 0.8], w: 0.28, fold: [-4, -4], open: [84, 112], layer: 0.22, mats: GREENS }),
      ...row(10, { at: [0.05, 2.1], len: [2.0, 1.6], w: 0.34, fold: [-4, -4], open: [50, 112], layer: -0.09, mats: GREENS }),
      ...row(9, { at: [0.05, 2.1], len: [0.9, 0.8], w: 0.28, fold: [-4, -4], open: [84, 112], layer: -0.14, mats: GREENS }),
    ],
    rest: { spread: 0.92, raise: 60, sweep: 66 },
  },
  tail: [
    [2.3, 0.22, 0, 0, 'bloom', 'petal'], [2.2, 0.21, 4, -10, 'petal', 'bloom'], [2.2, 0.21, 4, 10, 'bloom', 'petal'],
    [2.0, 0.21, 8, -22, 'leaf', 'leafDark'], [2.0, 0.21, 8, 22, 'leafDark', 'leaf'], [1.75, 0.2, 12, -34, 'moss', 'leaf'],
    [1.75, 0.2, 12, 34, 'leaf', 'moss'], [1.45, 0.19, 16, -46, 'leaf', 'leafDark'], [1.45, 0.19, 16, 46, 'leafDark', 'leaf'],
  ],
  leg: { fluff: 0.24, w: 0.085, talon: 0.24, shag: [0, 0] },
  size: 2.1,
};

/** A Songroost: tall and upright on long shaggy legs, two tall ear tufts and a crest, its wings a cloak of long feathers to the ground. */
const SONGROOST_LOOK: Owl = {
  stage: 2,
  spec: {
    high: 2.85,
    leg: { at: [0.46, 0.1, -1.0], len: [0.82, 0.78, 0.08], rest: [4, -14] },
    neck: { at: [0, 0.1, 1.24], len: 0.5, lean: -2 },
    head: { pitch: 0 },
    wing: { at: [0.7, 0.02, 0.8] },
    tail: { at: [0, -0.5, -0.9], lift: -40 },
    swing: [20, 28],
    thrust: 2,
    waddle: 2,
    peck: 40, tip: 18, nose: 20, crouch: 0.35, stance: 1,
  },
  body: { c: [0, 0, 0.1], r: [1.04, 0.84, 1.44], green: 0.35 },
  mantle: { rows: 7, count: 11, len: 0.46, w: 0.18, from: 0.86, to: -0.4, round: 140 },
  ruff: { n: 15, len: 0.72, w: 0.2, round: 145, at: 0.86 },
  bib: { rows: 8, len: 0.3 },
  collar: { rows: 3, len: 0.5, w: 0.17 },
  head: { c: [0, 0.06, 0.34], r: [0.62, 0.56, 0.54] },
  eye: { dir: [0.4, 0.86, 0.22], size: 0.11 },
  beak: { len: 0.2, w: 0.075 },
  ear: { at: [0.38, -0.02, 0.72], len: 0.5, w: 0.26, out: 24, back: 6 },
  tuft: fan(8, 1.55, 0.26, -6, 48),
  crest: [
    [1.3, 0.2, 0, 0, 'leaf', 'leafDark'], [1.15, 0.19, 24, 0, 'moss', 'leaf'], [1.0, 0.18, 48, 0, 'leaf', 'moss'],
    [0.85, 0.17, 72, 0, 'leafDark', 'leaf'], [1.05, 0.18, -20, 0, 'petal', 'feather'],
  ],
  wing: {
    at: [1.0, 0.02, 1.0],
    arm: [0, -0.3, -1],
    reach: 30,
    pinions: [
      // The cloak: long flight feathers, cream and peach, hanging close from the shoulder round to the back, the back ones longest and
      // trailing behind it to the ground; long green ones over them; rows of green coverts over the shoulder.
      ...row(8, { at: [0.3, 0.3], len: [2.5, 3.9], w: 0.34, fold: [-92, -58], open: [30, -16], layer: 0, flare: 0.12, yaw: [-4, 90], mats: PEACHES }),
      ...row(7, { at: [0.16, 0.16], len: [2.2, 3.5], w: 0.28, fold: [-92, -60], open: [26, -8], layer: 0.07, flare: 0.12, yaw: [-8, 86], mats: GREENS }),
      ...row(7, { at: [0.04, 0.04], len: [1.4, 1.8], w: 0.26, fold: [-88, -66], open: [20, 10], layer: 0.14, flare: 0.1, yaw: [-10, 84], mats: GREENS }),
      ...row(6, { at: [0.0, 0.0], len: [0.86, 0.94], w: 0.23, fold: [-84, -70], open: [10, 10], layer: 0.21, flare: 0.08, yaw: [-8, 82], mats: GREENS }),
    ],
    rest: { spread: 0, raise: -4, sweep: 0 },
  },
  tail: [
    [2.0, 0.24, 0, 0, 'feather', 'petal'], [1.9, 0.23, 6, -16, 'leaf', 'leafDark'], [1.9, 0.23, 6, 16, 'leafDark', 'leaf'],
    [1.7, 0.22, 12, -30, 'petal', 'feather'], [1.7, 0.22, 12, 30, 'feather', 'petal'],
  ],
  leg: { fluff: 0.42, w: 0.16, talon: 0.32, shag: [16, 0.8] },
  size: 2.3,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so feathers are not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A ringing that dies away, `since` seconds after a blow. */
const ringOut = (since: number, k: number, f = 2.4, damp = 4): number => (since < 0 ? 0 : k * Math.exp(-since * damp) * Math.sin(since * TAU * f));

/** Each face wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
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
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}

/** A ball whose every facet is coloured by which way out of the middle it faces (`matOf`, given that way on a unit ball). */
function ballBy(c: V3, r: V3, n: number, k: number, matOf: (d: V3) => Mat): Mesh {
  const b = ball(c, r, n, k, 'coat');
  return mesh(b.v, b.f.map((face) => {
    let x = 0, y = 0, z = 0;
    for (const i of face.i) {
      x += (b.v[i][0] - c[0]) / r[0];
      y += (b.v[i][1] - c[1]) / r[1];
      z += (b.v[i][2] - c[2]) / r[2];
    }
    return { ...face, m: matOf(unit([x, y, z])) };
  }));
}

/** Where a way out of the middle of an egg (on a unit ball) meets its shell, and the way out of it there. */
function onShell(c: V3, r: V3, d: V3): { p: V3; n: V3 } {
  const u = unit(d);
  return { p: [c[0] + u[0] * r[0], c[1] + u[1] * r[1], c[2] + u[2] * r[2]], n: unit([u[0] / r[0], u[1] / r[1], u[2] / r[2]]) };
}

/**
 * A leaf-feather from `root` along `dir`, `len` long and `w` across each side of its shaft, its face turned along `face`: two halves
 * either side of a shaft that bows a little toward its face, each its own colour, cupped, and pointed at the tip.
 */
function vane(root: V3, dir: V3, face: V3, len: number, w: number, mats: readonly [Mat, Mat], o: { curl?: number; cup?: number; back?: Mat } = {}): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, f));
  const K = 5, curl = o.curl ?? 0.1, cup = o.cup ?? 0.2;
  const rib: V3[] = [], L: V3[] = [], R: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K, bow = Math.sin(Math.PI * u) * len * curl;
    const p = add(add(root, scale(d, len * u)), scale(f, bow - len * curl * 0.6 * u * u));
    rib.push(p);
    if (k === 0 || k === K) continue;
    // Broadest a little past its middle, as a feather is.
    const ww = w * Math.sin(Math.PI * u ** 0.75);
    L.push(add(add(p, scale(side, -ww)), scale(f, -ww * cup)));
    R.push(add(add(p, scale(side, ww)), scale(f, -ww * cup)));
  }
  const v: V3[] = [...rib, ...L, ...R];
  const ribI = rib.map((_, q) => q), LI = L.map((_, q) => rib.length + q), RI = R.map((_, q) => rib.length + L.length + q);
  const halfL = [...ribI, ...[...LI].reverse()], halfR = [...ribI, ...[...RI].reverse()];
  const back = o.back ?? mats[1];
  const faces: Face[] = [{ i: halfL, m: mats[0] }, { i: [...halfR], m: mats[1] }, { i: [...halfL], m: back }, { i: [...halfR], m: back }];
  return mesh(v, woundTo(v, faces, [f, f, scale(f, -1), scale(f, -1)]));
}

/** Leaf-feathers from a root, each `up` degrees from `axis` toward `toward` and `out` to the side, faced along `face`. */
function plumes(root: V3, list: readonly Plume[], axis: V3, toward: V3, face: V3, o: { curl?: number; side?: V3 } = {}): Mesh {
  const sideAxis = o.side ?? [1, 0, 0];
  return merge(...list.map(([len, w, up, out, m0, m1], q) => {
    const a = up * DEG, b = out * DEG;
    const inPlane = add(scale(axis, Math.cos(a)), scale(toward, Math.sin(a)));
    const dir = unit(add(scale(inPlane, Math.cos(b)), scale(sideAxis, Math.sin(b))));
    return vane(root, dir, add(face, scale(sideAxis, Math.sin(b) * 0.4)), len, w, [m0, m1], { curl: (o.curl ?? 0.1) * (0.8 + 0.4 * jitter(q + len)) });
  }));
}

/* ---- the moves, in time -------------------------------------------------------------- */

/** The strike: when the blow lands, a stage at a time. */
export const OWL_HITS: readonly number[] = [0.5, 0.52, 0.55];

/**
 * A go at its task, in shares of it: turned to its right and the wing opened (`open`), three strokes of the wing forward along the one
 * beside it and back (`strokes`, each the middle of a stroke forward), and the wing folded again (`fold`).
 */
export const OWL_WORK = { open: [0.04, 0.16] as const, strokes: [0.3, 0.5, 0.7] as const, fold: [0.84, 0.98] as const } as const;

/** Its hoot now and then, standing: seconds into the loop. */
export const OWL_CALLS: readonly number[] = [7.4, 19.2];

/** Which side it keeps the one it brushes: its right. */
const BRUSH_SIDE = 1;

/** How far through its task it is turned to its work, and where in its strokes the wing is (nought back, one forward). */
function brushOf(t: number): { on: number; stroke: number; ends: number } {
  const W = OWL_WORK;
  const on = ramp(t, W.open[0], W.open[1]) * (1 - ramp(t, W.fold[0], W.fold[1]));
  // Forward and back about each stroke's middle: a sine over the strokes, starting and ending back.
  const span = (W.strokes[2] - W.strokes[0]) / 2;
  const u = (t - (W.strokes[0] - span / 2)) / (span * 3);
  const stroke = u <= 0 || u >= 1 ? 0 : 0.5 - 0.5 * Math.cos(u * TAU * 1.5);
  // How near the far end of a stroke it is: where the fluff comes off.
  const ends = W.strokes.reduce((acc, s) => acc + hump(t, s + span * 0.25, 0.05), 0);
  return { on, stroke, ends };
}

/* ---- its bones ----------------------------------------------------------------------- */

/** Each wing as it is held this moment, left then right. */
function wingsOf(s: Owl, a: Anim): [WingSet, WingSet] {
  const act = a.act, R = s.wing.rest, t = a.t;
  // Out from the body: a wing held up rolls out as it rises, one that hangs down its flank rolls out the other way.
  const out = s.stage === 1 ? 1 : -1;
  const rest = (): WingSet => ({ ...R });
  const L = rest(), Rt = rest();
  if (act?.kind === 'strike') {
    // Flared wide as it gathers itself, and thrown forward with the blow.
    const hit = OWL_HITS[s.stage];
    const k = ramp(act.t, 0.04, hit - 0.12) * (1 - ramp(act.t, hit + 0.12, 0.96));
    const fwd = ramp(act.t, hit - 0.12, hit) * (1 - ramp(act.t, hit + 0.12, 0.96));
    for (const w of [L, Rt]) {
      w.spread = lerp(w.spread, 0.95, k);
      w.raise = lerp(w.raise, out * [70, 76, 56][s.stage], k);
      w.sweep = lerp(w.sweep, 34, fwd);
    }
  } else if (act?.kind === 'evolve') {
    const k = ramp(act.t, 0.18, 0.46) * (1 - ramp(act.t, 0.64, 0.95));
    for (const w of [L, Rt]) {
      w.spread = lerp(w.spread, 1, k);
      w.raise = lerp(w.raise, out * [80, 74, 64][s.stage], k);
      w.sweep = lerp(w.sweep, 10, k);
    }
  } else if (act?.kind === 'work') {
    // The wing on the side of the one it brushes opened out to it, and swept forward and back along it.
    const B = brushOf(act.t);
    const w = BRUSH_SIDE > 0 ? Rt : L;
    w.spread = lerp(w.spread, [0.7, 0.7, 0.6][s.stage], B.on);
    w.raise = lerp(w.raise, out * ([72, 96, 62][s.stage] + 8 * B.stroke), B.on);
    w.sweep = lerp(w.sweep, -20 + 60 * B.stroke, B.on);
    // The other held a little out for balance, the Hushwing's lowered a little.
    const o = BRUSH_SIDE > 0 ? L : Rt;
    o.spread = lerp(o.spread, s.stage === 1 ? 0.6 : 0.15, B.on);
    o.raise = lerp(o.raise, out * (s.stage === 1 ? 44 : 12), B.on);
  } else {
    const g = a.go, w = frac(a.u);
    if (s.stage === 1) {
      // Hovering: a slow beat of the spread wings, down as it rises (`hoverOf`), and now and then it mantles them higher; going, a
      // stronger beat to each hop.
      const mantle = beat(t, [4.6, 15.8], 1.6);
      const flap = Math.sin(w * TAU), hover = hoverBeat(t);
      for (const x of [L, Rt]) {
        x.raise += (1 - g) * (14 * hover + 10 * mantle) + g * (8 + 18 * flap);
        x.spread = clamp(x.spread + (1 - g) * 0.1 * mantle + g * 0.1 * flap);
        x.sweep += g * 6 * flap + (1 - g) * 4 * hover;
      }
    } else if (s.stage === 0) {
      // A flutter of the little wings at a run, and a stretch of them now and then, standing.
      const stretch = beat(t, [10.6], 1.2) * (1 - g) * (1 - a.graze);
      for (const x of [L, Rt]) {
        x.spread += g * a.gait * 0.35 * (0.5 + 0.5 * Math.sin(w * TAU * 4)) + 0.75 * stretch;
        x.raise -= g * a.gait * 30 + stretch * 60;
      }
    } else {
      // The cloak swings with its stride, and now and then it shrugs it straight.
      const shrug = beat(t, [12.2], 1.4) * (1 - g);
      L.sweep += g * 5 * Math.sin(w * TAU) - shrug * 4;
      Rt.sweep -= g * 5 * Math.sin(w * TAU) + shrug * 4;
      for (const x of [L, Rt]) {
        x.raise -= g * 3 + shrug * 10;
        x.spread += shrug * 0.12;
      }
    }
  }
  for (const x of [L, Rt]) x.spread = clamp(x.spread);
  return [L, Rt];
}

/** How far each ear tuft is lifted (degrees, back of upright toward up) and turned (degrees), this moment: left, right. */
function tuftsOf(s: Owl, a: Anim): [[number, number], [number, number]] {
  const t = a.t, act = a.act;
  let lift = 0, flick0 = 0, flick1 = 0;
  if (act?.kind === 'strike') {
    const hit = OWL_HITS[s.stage];
    lift = -22 * ramp(act.t, 0.04, hit - 0.1) * (1 - ramp(act.t, hit + 0.14, 0.95));
  } else if (act?.kind === 'evolve') {
    lift = 18 * ramp(act.t, 0.2, 0.5) * (1 - ramp(act.t, 0.6, 0.9));
  } else if (act?.kind === 'work') {
    for (const st of OWL_WORK.strokes) flick1 += ringOut((act.t - st) * ACT_SECS.work, 6, 4, 6);
    flick0 = flick1 * 0.6;
  } else {
    const st = 1 - a.go;
    // A twitch of one ear and then the other, standing; a bob with each step, going.
    flick0 = st * 10 * beat(t, [3.2, 13.9], 0.5) + a.go * 4 * Math.sin(frac(a.u) * TAU * 2);
    flick1 = st * 10 * beat(t, [8.5, 21.1], 0.5) + a.go * 4 * Math.sin(frac(a.u) * TAU * 2 + 0.6);
    lift = st * 8 * beat(t, OWL_CALLS, 1.0);
  }
  return [[lift + flick0, -flick0 * 0.5], [lift + flick1, flick1 * 0.5]];
}

/**
 * Its own moves over the pose a bird has (`birdBones`): standing, the owl's slow turn of the head, a long way round, held and turned
 * again, a cock of it now and then and a hoot; a waddle, a hop or a stalk going; its strike, its task and evolving.
 */
function poseOwl(s: Owl, p: BirdPose, a: Anim): void {
  p.wings = [[0, 0], [0, 0]];
  const act = a.act, t = a.t;
  if (act) {
    const k = 1 - ramp(act.t, 0, 0.12) * (1 - ramp(act.t, 0.9, 1));
    p.head[1] *= k;
    p.head[2] *= k;
  }
  if (!act && a.go < 1) {
    const st = 1 - a.go;
    // The head turned smoothly round to look, held there, and turned again: eight looks a loop, as far as three-quarters of a right angle.
    const looks = 8, at = (t * looks) / LOOP, q = Math.floor(at);
    const lookAt = (n: number): number => { const r = ((n % looks) + looks) % looks; return Math.sin(r * 2.3 + 0.4) * (0.55 + 0.45 * Math.sin(r * 1.7)); };
    const turn = smooth(clamp((at - q) * 3));
    p.head[1] = st * 70 * lerp(lookAt(q - 1), lookAt(q), turn);
    // A cock of the head, as an owl puzzles over a thing.
    const cock = beat(t, [2.6, 11.2, 17.8], 1.6) - beat(t, [6.8, 21.6], 1.4);
    p.head[2] = st * 20 * cock;
    p.head[0] = st * 2 * cyc(t, 4);
    // Its hoot: the head lowered and the throat swelled, the beak a little open.
    const call = beat(t, OWL_CALLS, 1.0) * st * (1 - a.graze);
    p.head[0] -= 14 * call;
    p.neck[0] += 6 * call;
    p.jaw = Math.max(p.jaw, call * 0.5 * (0.5 + 0.5 * Math.sin(t * TAU * 3)));
    p.tail[0] += st * 6 * beat(t, [5.2, 16.4], 0.4);
  }
  if (s.stage === 1) {
    // The Hushwing is light: it hovers a little off the ground on its spread wings, rising on each downbeat, its legs hanging and
    // its talons held forward; going, it bounds along under them.
    const st = act?.kind === 'evolve' ? 1 : 1 - a.go;
    p.lift += 0.5 + 0.08 * Math.sin((t * TAU * 30) / LOOP - 1.2) * st;
    p.pitch -= 12;
    p.head[0] += 10;
    for (const l of p.legs) {
      l[0] -= 44;
      l[1] += 0.3;
      l[2] += 0.2;
    }
  }
  if (a.go > 0 && !act) {
    const g = a.go, w = frac(a.u);
    if (s.stage === 0) {
      // The owlet's waddle: rolled from foot to foot, the head held level against it, a bob at each step.
      p.roll *= 1.4;
      p.head[2] -= p.roll * 0.6;
      p.lift += g * 0.04 * Math.abs(Math.sin(w * TAU));
      p.pitch += g * -3;
    } else if (s.stage === 2) {
      // The stalk: upright, slow, the head carried level.
      p.lift *= 0.5;
      p.roll *= 0.6;
      p.pitch += g * Math.sin(w * TAU * 2);
      p.head[2] -= p.roll * 0.8;
    }
  }
  if (act?.kind === 'strike') {
    const hit = OWL_HITS[s.stage], since = (act.t - hit) * ACT_SECS.strike;
    const gather = ramp(act.t, 0.04, hit - 0.16) * (1 - ramp(act.t, hit - 0.14, hit));
    const thrust = ramp(act.t, hit - 0.14, hit) * (1 - ramp(act.t, hit + 0.12, 0.95));
    // Crouched with the wings up, then a hop forward with the talons thrown out ahead, and a bounce.
    p.lift += [0.3, 0.5, 0.5][s.stage] * hump(act.t, hit - 0.04, 0.14);
    p.pitch += 10 * gather + 14 * thrust + ringOut(since, 4);
    p.head[0] -= 10 * gather + 8 * thrust;
    for (const l of p.legs) {
      l[0] += 12 * gather - 46 * thrust;
      l[1] += 0.5 * gather;
    }
    p.jaw = Math.max(p.jaw, 0.7 * hump(act.t, hit - 0.08, 0.12));
  } else if (act?.kind === 'work') {
    const B = brushOf(act.t);
    // Turned to its right to watch the wing's strokes, the head going with each.
    p.neck[1] -= BRUSH_SIDE * 26 * B.on;
    p.head[1] -= BRUSH_SIDE * (30 + 14 * B.stroke) * B.on;
    p.head[2] -= BRUSH_SIDE * 12 * B.on;
    p.head[0] -= 10 * B.on;
    p.roll += BRUSH_SIDE * 4 * B.on;
    p.lift += 0.02 * B.ends;
  } else if (act?.kind === 'evolve') {
    const k = ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.65, 0.95));
    p.head[0] += 14 * k;
    p.lift += 0.3 * k;
  }
}

/** The Hushwing's hovering beat, standing: thirty beats a loop, one at the wings' top and minus one at their bottom. */
const hoverBeat = (t: number): number => cyc(t, 30);

/** How far forward its strike carries the whole of it this moment, in its own units, and back again after. */
function surgeOf(s: Owl, a: Anim): number {
  if (a.act?.kind !== 'strike') return 0;
  const t = a.act.t, hit = OWL_HITS[s.stage];
  return [0.6, 0.7, 0.7][s.stage] * ramp(t, hit - 0.16, hit) * (1 - ramp(t, hit + 0.12, 0.96));
}

function owlBones(s: Owl): (a: Anim) => Bones {
  return (a) => {
    const act = a.act;
    const b = birdBones(s.spec, act ? { ...a, go: 0 } : a, (p) => poseOwl(s, p, a));
    // A wing's bone is its shoulder, square to the body; it is opened, rolled up and out and swept within itself (`wingBent`).
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1, at = s.wing.at;
      b[`wing${k}`] = joint(b.body, [sd * at[0], at[1], at[2]]);
    }
    const T = tuftsOf(s, a);
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1, E = s.ear;
      b[`tuft${k}`] = joint(b.head, [sd * E.at[0], E.at[1], E.at[2]], T[k][0], 0, T[k][1] * sd);
    }
    const fwd = surgeOf(s, a);
    if (fwd) for (const key of Object.keys(b)) b[key] = { m: b[key].m, t: [b[key].t[0], b[key].t[1] + fwd, b[key].t[2]] };
    return b;
  };
}

/* ---- its pieces ---------------------------------------------------------------------- */

/** A wing's feathers, built folded along the right flank, and how to fan them: each feather's corners, and its turn about its root. */
function wingOf(s: Owl): { mesh: Mesh; spans: Span[] } {
  const parts: Mesh[] = [];
  const spans: Span[] = [];
  let count = 0;
  const arm = unit(s.wing.arm);
  // Round the shoulder toward the back: a feather turned `yaw` is rooted that far round the body from the flank and faces out there.
  const R = s.wing.at[0];
  s.wing.pinions.forEach((P, q) => {
    const yaw = (P.yaw ?? 0) * DEG, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const turn = (v: V3): V3 => [v[0] * cy, v[1] - v[0] * sy, v[2]];
    const ax: V3 = [cy, -sy, 0];
    const root = add(add(scale(arm, P.at), scale(ax, P.layer)), [R * (cy - 1), -R * sy, 0]);
    const a = P.fold * DEG;
    const dir = unit(add(turn([0, -Math.cos(a), Math.sin(a)]), scale(ax, (P.flare ?? 0) + 0.04 * (q % 3))));
    const m = vane(root, dir, add(ax, [0, 0, 0.12]), P.len, P.w, P.mats, { curl: 0.04, cup: 0.12 });
    parts.push(m);
    spans.push([count, count + m.v.length, root, (P.open - P.fold) * DEG, ax, s.wing.reach * DEG]);
    count += m.v.length;
  });
  return { mesh: merge(...parts), spans };
}

/** A feather of a wing: its corners from and to, its root, how far it turns spread, the axis it turns about, and how far its arm swings. */
type Span = [number, number, V3, number, V3, number];

/** A wing's corners as it is this moment (`wingsOf`), on the left (`sd` -1) or the right: fanned, rolled up and out, swept forward. */
function wingBent(v: readonly V3[], spans: readonly Span[], W: WingSet, sd: number): V3[] {
  const out = fanned(v, spans, W.spread, sd);
  if (Math.abs(W.raise) < 0.01 && Math.abs(W.sweep) < 0.01) return out;
  const r = sd * W.raise * DEG, y = -sd * W.sweep * DEG;
  const cr = Math.cos(r), sr = Math.sin(r), cy = Math.cos(y), sy = Math.sin(y);
  return out.map(([x0, y0, z0]) => {
    const x1 = cr * x0 + sr * z0, z1 = -sr * x0 + cr * z0;
    return [cy * x1 - sy * y0, sy * x1 + cy * y0, z1] as V3;
  });
}

/** `p` turned by `ang` radians about the unit axis `ax`. */
function spun(p: V3, ax: V3, ang: number): V3 {
  const c = Math.cos(ang), sn = Math.sin(ang);
  return add(add(scale(p, c), scale(cross(ax, p), sn)), scale(ax, dot(ax, p) * (1 - c)));
}

/**
 * A wing's corners fanned open by `k` (nought folded, one spread): the arm swung up about the shoulder, carrying each feather's root
 * with it, and each feather turned about its own root, on the way it faces.
 */
function fanned(v: readonly V3[], spans: readonly Span[], k: number, sd: number): V3[] {
  if (k <= 0.001) return v as V3[];
  const out = v.slice() as V3[];
  for (const [s0, e, r0, turn, ax0, reach] of spans) {
    const r: V3 = [sd * r0[0], r0[1], r0[2]];
    // Up from the back about the way it faces, on the right; on the left the mirror of that.
    const ax: V3 = [ax0[0], sd * ax0[1], sd * ax0[2]];
    const to = spun(r, ax, -reach * k);
    for (let i = s0; i < e; i++) out[i] = add(to, spun(sub(v[i], r), ax, -turn * k));
  }
  return out;
}

/** The body's egg: cream, with green over its back down to `green` of its height. */
function bodyOf(s: Owl, n: number, k: number): Mesh {
  const B = s.body;
  return ballBy(B.c, B.r, n + 4, k + 3, (d) => ((d[1] < 0.1 && d[2] > -0.1 - B.green + 0.5 * d[1]) || Math.abs(d[0]) > 0.62 ? 'leaf' : d[2] < -0.55 ? 'belly' : 'coat'));
}

/** A way out of the body's middle, `round` degrees round from straight back toward the right, at `h` up it (nought its middle, one its top). */
const backDir = (round: number, h: number): V3 => {
  const a = round * DEG, c = Math.sqrt(Math.max(0, 1 - h * h));
  return [Math.sin(a) * c, -Math.cos(a) * c, h];
};

/** The small scale-feathers laid in rows over its shoulders and back, each pointing down the body, overlapping the row below. */
function mantleOf(s: Owl, fine: boolean): Mesh {
  const B = s.body, M = s.mantle;
  const out: Mesh[] = [];
  const mats: Array<readonly [Mat, Mat]> = [['leaf', 'leafDark'], ['moss', 'leaf'], ['leaf', 'moss'], ['petal', 'leaf'], ['leafDark', 'leaf']];
  for (let r = 0; r < M.rows; r++) {
    const h = lerp(M.from, M.to, r / Math.max(1, M.rows - 1));
    const count = Math.max(3, Math.round((M.count + r) * (fine ? 1 : 0.7)));
    for (let q = 0; q < count; q++) {
      const round = lerp(-M.round, M.round, (q + 0.5 * (r % 2)) / (count - 0.5 * (r % 2 ? 0 : 1) + (r % 2 ? 0 : 0)));
      const e = onShell(B.c, B.r, backDir(round + 6 * (jitter(r * 31 + q) - 0.5), h));
      // Down the body along its shell, and out from it a little.
      const down = unit(sub([0, 0, -1], scale(e.n, dot([0, 0, -1], e.n))));
      const root = add(e.p, scale(e.n, 0.02 + 0.015 * r));
      const pick = mats[(r * 3 + q * 2 + (jitter(q + r * 7) > 0.7 ? 1 : 0)) % mats.length];
      // The lower rows peach-tipped more often, as drawn.
      const mm: readonly [Mat, Mat] = r >= M.rows - 2 && jitter(q * 5 + r) > 0.6 ? ['petal', 'feather'] : pick;
      out.push(vane(root, add(down, scale(e.n, 0.3)), e.n, M.len * (0.85 + 0.3 * jitter(q + r * 13)), M.w, mm, { curl: 0.12, cup: 0.15 }));
    }
  }
  return merge(...out);
}

/** The ruff of longer leaf-feathers round the root of the neck, over the top of the mantle, open at the front for the bib. */
function ruffOf(s: Owl): Mesh {
  const B = s.body, R = s.ruff;
  const out: Mesh[] = [];
  for (let q = 0; q < R.n; q++) {
    const round = lerp(-R.round, R.round, q / (R.n - 1));
    const e = onShell(B.c, B.r, backDir(round, R.at));
    const down = unit(sub([0, 0, -1], scale(e.n, dot([0, 0, -1], e.n))));
    const root = add(e.p, scale(e.n, 0.08));
    const mm: readonly [Mat, Mat] = q % 4 === 1 ? ['moss', 'leaf'] : q % 4 === 3 ? ['leaf', 'moss'] : ['leaf', 'leafDark'];
    out.push(vane(root, add(down, scale(e.n, 0.55)), e.n, R.len * (0.9 + 0.2 * jitter(q)), R.w, mm, { curl: 0.14, cup: 0.2 }));
  }
  return merge(...out);
}

/** Rows of leaf-feathers round the neck, from the back round each side, each hanging down over the row under it. */
function collarOf(s: Owl): Mesh {
  const C = s.collar!, H = s.head, N = s.spec.neck;
  const r = H.r[0] * 0.62, out: Mesh[] = [];
  for (let row = 0; row < C.rows; row++) {
    const z = lerp(N.len + 0.05, 0.0, row / Math.max(1, C.rows - 1));
    const count = 9 + row;
    for (let q = 0; q < count; q++) {
      const a = lerp(-150, 150, (q + 0.5 * (row % 2)) / (count - 0.5)) * DEG;
      const o: V3 = [Math.sin(a), -Math.cos(a), 0];
      const mm: readonly [Mat, Mat] = (q + row) % 3 === 1 ? ['moss', 'leaf'] : (q + row) % 3 === 2 ? ['leafDark', 'leaf'] : ['leaf', 'leafDark'];
      out.push(vane(add(scale(o, r * 0.95), [0, 0, z]), unit(add([0, 0, -1], scale(o, 0.5))), o, C.len * (0.85 + 0.3 * jitter(q + row * 5)), C.w, mm, { curl: 0.12 }));
    }
  }
  return merge(...out);
}

/** The bib: cream tufts of fluff down its breast in rows, overlapping, each pointing down. */
function bibOf(s: Owl): Mesh {
  const B = s.body, F = s.bib;
  const out: Mesh[] = [];
  for (let r = 0; r < F.rows; r++) {
    const h = 0.62 - r * ((F.len * 0.8) / B.r[2]);
    const n = 6 + (r % 2);
    for (let q = 0; q < n; q++) {
      const round = 180 + lerp(-50, 50, (q + 0.5) / n) + 8 * (jitter(r * 9 + q) - 0.5);
      const e = onShell(B.c, B.r, backDir(round, h));
      const down = unit(sub([0, 0, -1], scale(e.n, dot([0, 0, -1], e.n))));
      out.push(vane(add(e.p, scale(e.n, 0.02)), add(down, scale(e.n, 0.18)), e.n, F.len * (0.85 + 0.3 * jitter(q + r * 3)), F.len * 0.4,
        (q + r) % 2 ? ['coat', 'coatLight'] : ['coatLight', 'coat'], { curl: 0.08, cup: 0.1 }));
    }
  }
  return merge(...out);
}

/** The skull: cream at its face in a heart, peaked between the eyes, green over the crown, the back and round the face's edge. */
function skullOf(s: Owl, n: number, k: number): Mesh {
  const H = s.head;
  return ballBy(H.c, H.r, n + 4, k + 3, (d) => {
    const az = Math.abs(Math.atan2(d[0], d[1])) / DEG, el = Math.asin(clamp(d[2], -1, 1)) / DEG;
    // The heart's top: low at its middle, between the eyes, and up over each eye.
    const top = 28 + 26 * Math.min(1, az / 26) - 16 * Math.max(0, (az - 56) / 26);
    const face = (az < 84 && el < top) || (az < 112 && el < -6);
    return face || el < -40 ? 'coat' : 'leaf';
  });
}

function owlBuild(s: Owl, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 7), fine = lod > 0;
  const B = s.body, H = s.head;
  const body = bodyOf(s, n, k);
  const solid = { c: B.c, r: scale(B.r, 0.97) };
  // The head: the skull, its green specks over the crown, the eyes, the blush of freckles under them, and the beak.
  const skull = skullOf(s, n, k);
  const specks = merge(...Array.from({ length: fine ? 12 : 6 }, (_, q) => {
    const d: V3 = [(jitter(q + 60) - 0.5) * 1.6, -0.6 + 1.2 * jitter(q + 70), 0.7 + 0.5 * jitter(q + 80)];
    return patch(H.c, H.r, d, 0.06, 0.05, q % 3 ? 'spot' : 'petal', { sides: 5 });
  }));
  const freckles = merge(...[1, -1].flatMap((sd) => [0, 1, 2].map((q) => patch(H.c, H.r, [sd * (0.5 + 0.08 * q), 0.82, -0.08 - 0.07 * (q % 2)], 0.04, 0.035, 'mark', { sides: 5 }))));
  const look = (shut: boolean): Mesh => eyes(H.c, H.r, s.eye.dir, s.eye.size, { shut, tall: 1.06, iris: 'bark', pupil: 0.52, glint: 0.34 });
  const headMesh = (shut: boolean): Mesh => merge(skull, specks, freckles, look(shut));
  // The beak: short, hooked, coming out of the face under the eyes; the lower half on the jaw.
  const front = onShell(H.c, H.r, [0, 1, -0.12]);
  const root = add(front.p, [0, -0.06, 0]);
  const Bk = s.beak;
  const upper = taper(curve(root, add(root, [0, Bk.len * 0.6, 0.0]), add(root, [0, Bk.len * 0.62, -Bk.len * 0.85]), 4), Bk.w, Bk.w * 0.1, 6, 'bill', 0.85);
  const lower = taper([add(root, [0, -0.02, -Bk.w * 0.6]), add(root, [0, Bk.len * 0.3, -Bk.w * 0.9])], Bk.w * 0.7, Bk.w * 0.2, 5, 'billDark', 0.6);
  // Each ear: pink inside, peach outside, pointed, turned out and back; the leaf-feathers of its tuft fanned behind it.
  const E = s.ear;
  const ear = moved(earMesh(E.len, E.w, 6, { mat: 'petal', point: true }), [0, 0, 0], 0, -E.back, E.out);
  // Three fans of leaf-feathers: one faced forward round the ear, one turned out and back behind it, and a short one turned in over
  // the crown, so the tuft is full from every side.
  const back = s.tuft.filter((_, q) => q % 2).map(([l, w, up, o, m0, m1]) => [l * 0.8, w, up, o, m1, m0] as const);
  const tuft = merge(
    plumes([0, -0.04, 0], s.tuft, unit([0.25, -0.1, 1]), unit([1, -0.15, -0.1]), [0.2, 1, 0.3], { curl: 0.12 }),
    moved(plumes([0, -0.1, -0.02], back, unit([0.25, -0.2, 1]), unit([1, -0.1, -0.1]), [0.2, 1, 0.3], { curl: 0.12 }), [0, 0, 0], 40),
  );
  // The tail: a fan of leaf-feathers.
  const tail = plumes([0, 0, 0], s.tail, [0, -1, 0], [0, 0, -1], [0, -0.2, 1], { curl: 0.06 });
  const wing = wingOf(s);
  // The legs: a cream fluff of a thigh, a feathered shank, and dark toes with long talons.
  const L = s.spec.leg.len, Lg = s.leg;
  const thigh = orbAlong([0, 0.02, -L[0] * 0.45], [0, 0, 1], [Lg.fluff, Lg.fluff * 1.1, Math.max(Lg.fluff * 1.1, L[0] * 0.62)], n, k, Lg.shag[0] ? 'leaf' : 'coat');
  const shank = tube([[0, 0, 0.04], [0, 0.01, -L[1] * 0.5], [0, 0.02, -L[1] - 0.02]], [Lg.w * 1.5, Lg.w * 1.35, Lg.w * 1.2], [Lg.w * 1.5, Lg.w * 1.35, Lg.w * 1.2], 6, Lg.shag[0] ? 'leafDark' : 'coat', { seam: 'start' });
  const T = Lg.talon;
  const toe = (yaw: number, len: number): Mesh => moved(merge(
    tube([[0, -0.02, 0.02], [0, len * 0.55, -0.01], [0, len, -0.03]], [Lg.w * 0.9, Lg.w * 0.75, Lg.w * 0.55], [Lg.w * 0.8, Lg.w * 0.65, Lg.w * 0.5], 5, 'claw'),
    taper(curve([0, len, -0.02], [0, len + T * 0.55, 0.0], [0, len + T * 0.7, -T * 0.55], 3), Lg.w * 0.42, 0.006, 4, 'hornDark'),
  ), [0, 0, 0], yaw);
  const foot = moved(merge(toe(-24, T * 1.6), toe(2, T * 1.9), toe(26, T * 1.6), toe(180, T * 1.1)), [0, 0, -L[2] + Lg.w * 0.7]);
  const pieces: Piece[] = [
    { key: 'body', mesh: body, bone: 'body', bias: 0, breathes: { c: B.c, k: 0.04 } },
    { key: 'mantle', mesh: mantleOf(s, fine), bone: 'body', bias: 0.03, after: ['body'], hide: [solid], airy: true, breathes: { c: B.c, k: 0.04 } },
    { key: 'bib', mesh: bibOf(s), bone: 'body', bias: 0.02, after: ['body'], hide: [solid], airy: true, breathes: { c: B.c, k: 0.04 } },
    { key: 'ruff', mesh: ruffOf(s), bone: 'body', bias: 0.06, after: ['body', 'mantle'], hide: [solid], airy: true, breathes: { c: B.c, k: 0.04 } },
    { key: 'tail', mesh: tail, bone: 'tail0', bias: -0.06, airy: true },
    { key: 'neck', mesh: tube([[0, 0, -0.2], [0, 0.02, s.spec.neck.len + 0.1]], H.r[0] * 0.62, H.r[1] * 0.62, n, (_r, j) => (Math.sin(((j + 1) / n) * TAU) < -0.2 ? 'leaf' : 'coat'), { seam: 'both' }), bone: 'neck', bias: 0, under: 'head', convex: true, lines: false },
    { key: 'head', mesh: headMesh(false), shut: headMesh(true), bone: 'head', bias: 0.2 },
    { key: 'beak', mesh: upper, bone: 'head', bias: 0.215, after: ['head'], thin: true },
    { key: 'jaw', mesh: lower, bone: 'jaw', bias: 0.21, after: ['head'], under: ['beak'], thin: true },
    ...[0, 1].flatMap((q): Piece[] => {
      const sd = q ? 1 : -1;
      const mine = (m: Mesh): Mesh => (q ? m : mirrored(m));
      return [
        { key: `ear${q}`, mesh: mine(ear), bone: `tuft${q}`, bias: 0.22, after: ['head', `tuft${q}`], front: [sd * 0.3, 1, 0.2], thin: true },
        { key: `tuft${q}`, mesh: mine(tuft), bone: `tuft${q}`, bias: 0.19, after: ['head'], front: [sd, -0.3, 0.3], hide: [{ c: H.c, r: scale(H.r, 0.92) }], hideIn: 'head', thin: true },
        {
          key: `wing${q}`, mesh: mine(wing.mesh), bone: `wing${q}`, bias: 0.05, after: ['body', 'mantle'], front: [sd, 0, 0], thin: true,
          bent: (v, a) => wingBent(v, wing.spans, wingsOf(s, a)[q], sd),
        },
        // The owlet's thighs are lost in its body; the others' are a cream fluff.
        ...(s.stage ? [{ key: `thigh${q}`, mesh: thigh, bone: `${['bl', 'br'][q]}0`, bias: 0.012, after: 'body', front: [sd, 0.3, 0] as V3, lines: false }] : []),
        { key: `shank${q}`, mesh: shank, bone: `${['bl', 'br'][q]}1`, bias: 0.02, after: 'body', front: [sd, 0.2, 0], convex: true },
        { key: `foot${q}`, mesh: foot, bone: `${['bl', 'br'][q]}2`, bias: 0.03, after: 'body', front: [sd, 0.2, 0], thin: true },
      ];
    }),
  ];
  if (s.crest) {
    // Up the middle of the crown and back over it, faced to either side.
    const top: V3 = [0, H.c[1] - H.r[1] * 0.2, H.c[2] + H.r[2] * 0.82];
    const crest = merge(
      plumes(top, s.crest, [0, 0.1, 1], [0, -1, 0.1], [1, 0, 0.2], { curl: 0.1 }),
      plumes(add(top, [0, -0.08, -0.02]), s.crest.slice(1).map(([l, w, up, o, m0, m1]) => [l * 0.85, w, up + 10, o, m1, m0] as const), [0, 0.1, 1], [0, -1, 0.1], [-1, 0, 0.2], { curl: 0.1 }),
    );
    pieces.push({ key: 'crest', mesh: crest, bone: 'head', bias: 0.195, after: ['head'], hide: [{ c: H.c, r: scale(H.r, 0.92) }], hideIn: 'head', thin: true });
  }
  if (s.collar) {
    pieces.push({ key: 'collar', mesh: collarOf(s), bone: 'neck', bias: 0.07, after: ['neck', 'body', 'ruff'], under: ['head'], hide: [{ c: [0, 0, s.spec.neck.len / 2], r: [H.r[0] * 0.6, H.r[0] * 0.6, s.spec.neck.len] }], airy: true });
  }
  if (Lg.shag[0]) {
    // The Songroost's legs: green leaf-feathers hanging down the outside of each, over the cream.
    const [count, len] = Lg.shag;
    const shag = merge(...Array.from({ length: count }, (_, q) => {
      // Round the outside and the front of the thigh, in two rows, hanging down over the shank.
      const row = q % 2, a = lerp(-80, 120, q / (count - 1)) * DEG, z = -L[0] * (0.15 + 0.4 * row);
      const out: V3 = [Math.cos(a), Math.sin(a), 0];
      return vane(add(scale(out, Lg.fluff * 0.8), [0, 0, z]), unit(add([0, 0, -1], scale(out, 0.22))), out, len * (0.85 + 0.3 * jitter(q)), 0.2,
        q % 3 === 1 ? ['moss', 'leaf'] : q % 3 === 2 ? ['leafDark', 'leaf'] : ['leaf', 'leafDark'], { curl: 0.1 });
    }));
    const shinShag = merge(...Array.from({ length: 8 }, (_, q) => {
      const a = lerp(-70, 120, q / 7) * DEG, z = -L[1] * (0.05 + 0.3 * (q % 3) / 2);
      const out: V3 = [Math.cos(a), Math.sin(a), 0];
      return vane(add(scale(out, Lg.w * 1.2), [0, 0, z]), unit(add([0, 0, -1], scale(out, 0.2))), out, len * 0.75, 0.15, q % 2 ? ['leaf', 'moss'] : ['leafDark', 'leaf'], { curl: 0.1 });
    }));
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1, mine = (m: Mesh): Mesh => (q ? m : mirrored(m));
      pieces.push(
        { key: `shag${q}`, mesh: mine(shag), bone: `${['bl', 'br'][q]}0`, bias: 0.016, after: [`thigh${q}`, 'body'], front: [sd, 0, 0], airy: true },
        { key: `shin${q}`, mesh: mine(shinShag), bone: `${['bl', 'br'][q]}1`, bias: 0.022, after: [`shank${q}`], front: [sd, 0, 0], airy: true },
      );
    }
  }
  return pieces;
}

/* ---- the fluff it brushes off -------------------------------------------------------- */

/** Wisps of loose fluff brushed off the one beside it at the end of each stroke, drifting down and away. */
function wisps(g: CanvasRenderingContext2D, view: View, c: V3, since: number, big: number, seed: number): void {
  if (since < 0 || since > 0.5) return;
  const al = 0.85 * (1 - smooth((since - 0.25) / 0.25));
  g.beginPath();
  for (let q = 0; q < 4; q++) {
    const a = seed + q * 1.7, sp = big * (0.6 + 0.6 * jitter(q + seed));
    const d = sp * since;
    const [x, y] = onScreen(view, [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d * 0.6, c[2] + big * 0.3 * since - since * since * 1.2]);
    const r = big * (0.06 + 0.03 * jitter(q + 7));
    g.moveTo(x + r, y);
    g.ellipse(x, y, r, r * 0.6, a, 0, TAU);
  }
  g.fillStyle = `rgba(250,244,232,${al.toFixed(3)})`;
  g.fill();
}

/* ---- the kinds ----------------------------------------------------------------------- */

function owlKind(s: Owl): Kind {
  return {
    bones: owlBones(s),
    build: (lod) => owlBuild(s, lod),
    // The variant's coat is the green of its leaf-feathers, its markings their peach; the cream, the eyes, the beak and the talons are
    // the same on every variant.
    palette: (coat, mark) => {
      const sage = mix([132, 164, 100], coat, 0.4);
      const peach = mix([246, 174, 128], mark, 0.45);
      const cream: RGB = [255, 240, 216];
      return coatPalette(coat, mark, {
        coat: cream,
        coatLight: [255, 250, 238],
        coatDark: [244, 226, 200],
        belly: [252, 238, 214],
        leaf: sage,
        leafDark: mix(sage, [70, 104, 62], 0.45),
        moss: mix(sage, [184, 198, 112], 0.42),
        petal: peach,
        bloom: mix(peach, [238, 138, 156], 0.7),
        feather: mix(cream, peach, 0.28),
        featherDark: mix(peach, [214, 140, 112], 0.3),
        inner: mix(peach, [244, 160, 170], 0.7),
        mark: [238, 170, 160],
        spot: mix(sage, [70, 92, 60], 0.45),
        bill: [236, 168, 128],
        billDark: [214, 142, 108],
        claw: [78, 56, 46],
        hornDark: [58, 40, 34],
        bark: [150, 92, 44],
        eye: [46, 28, 22],
        eyeWhite: [250, 242, 228],
        lid: mix(sage, [80, 70, 60], 0.3),
        glint: [255, 253, 246],
      });
    },
    shadow: [[0.95, 1.2, 1.15][s.stage], [0.85, 1.0, 1.0][s.stage]],
    stride: 1.1,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    motes: [[160, 184, 128], [246, 196, 168]],
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (under || act?.kind !== 'work') return;
      // Fluff off the one beside it, where the wing's feathers end their stroke: out to its right, ahead of the shoulder.
      const big = [0.8, 1, 1.3][s.stage];
      const reach = s.wing.pinions[0].len * 0.7;
      const at = place(b.body, [BRUSH_SIDE * (s.body.r[0] + reach * 0.6), s.body.c[1] + reach * 0.4, s.body.c[2] - s.body.r[2] * 0.2]);
      OWL_WORK.strokes.forEach((st, q) => wisps(g, view, at, (act.t - st - 0.06) * ACT_SECS.work, big, q * 2.1 + 0.4));
    },
  };
}

export const WHISPLING = owlKind(WHISPLING_LOOK);
export const HUSHWING = owlKind(HUSHWING_LOOK);
export const SONGROOST = owlKind(SONGROOST_LOOK);
