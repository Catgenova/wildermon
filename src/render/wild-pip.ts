import {
  ACT_SECS, add, beat, birdBones, clamp, coatPalette, cross, curve, cyc, DEG, dot, eyes, frac, lerp, merge, mirrored, mix, orb,
  orbAlong, scale, smooth, sub, taper, TAU, tube, unit, type Anim, type BirdPose, type BirdSpec, type Bones, type Kind, type Piece,
} from './beasts';
import { birdLegPieces, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';
import { patch } from './wild-birds';

/**
 * The leaf-bird line: the Pipseed, a round cream chick with a crest and
 * wings of autumn leaves and an acorn in its beak, which grows into the
 * Sprigwing, long-legged, brown-backed, a bigger crest and a fanned tail of
 * layered leaves, carrying a sapling by its stem; and then the Arborcrest, a
 * great bird whose wings are red maple leaves over cream coverts, a crest
 * like a flame, holding a sapling by its root ball in its talons. The species
 * is still `sappa` underneath, as saves and the database know it: the planter,
 * that sets sprouts where trees were cut.
 *
 * Every feather that is not down is a leaf: a flat maple leaf of five lobes
 * (`leafMesh`), red, orange or gold, folded a little along its rib. A wing is
 * a fan of them on one bone that opens as the wing spreads (`spreadOf`).
 *
 * The Pipseed hops, the Sprigwing walks, and the Arborcrest, its right foot
 * full, stands on its left and flies low wherever it goes, beating its great
 * wings once a stride; standing, it keeps them a little open over its back,
 * and now and then spreads them high to show them.
 *
 * At its task it bows and pushes what it carries into the ground ahead of it,
 * lets go, tamps the soil round it twice and takes the next from the two it
 * has laid by at its side (`PIP_WORK`). The Arborcrest plants with its foot.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** The three colours of autumn its leaves come in. */
type Tone = 'red' | 'orange' | 'gold';

/** A leaf of a crest or a tail: its length and half-width, how far back from upright it leans (degrees), how far out to the side (degrees), and its colour. */
type Plume = [number, number, number, number, Tone];

/**
 * A leaf of a wing, built folded along the flank: its root along the arm, how long and wide, the way it points folded and spread
 * (degrees round from straight back toward up), how far out from the flank it lies (its layer), and its colour, or a cream covert.
 */
interface Pinion { at: number; len: number; w: number; fold: number; open: number; layer: number; tone: Tone | Covert }

interface Pip {
  stage: 0 | 1 | 2;
  spec: BirdSpec;
  /** The body's egg, and how far its front is tipped up (degrees). */
  body: { c: V3; r: V3; pitch: number };
  /** How far down each flank the brown of the back comes (radians from the top); nought for none. */
  back: number;
  neck: { w: number; len: number };
  head: { c: V3; r: V3 };
  eye: { dir: V3; size: number };
  /** The beak: its root on the face, how long, how thick at the root, how far it points down (degrees), and how far its tip hooks. */
  beak: { at: V3; len: number; w: number; drop: number; hook: number };
  /** The crest: its root on the crown, its leaves. */
  crest: { at: V3; plumes: Plume[] };
  wing: { at: V3; pinions: Pinion[] };
  tail: Plume[];
  /** Small leaves down the breast and flank, on each side: where (along, round from the front, degrees), how long, colour. */
  tufts: Array<[number, number, number, Tone]>;
  leg: { shank: number; w: number };
  /** What it carries and in what: an acorn in its beak, a sapling in its beak, or a sapling in its talons. */
  hold: 'acorn' | 'beak' | 'talon';
  /** How big what it carries is, against the Sprigwing's sapling. */
  load: number;
  /** How far its head bows to plant: the body tipped (degrees), the neck bent, the head down past level. */
  bow: { tip: number; neck: number; nose: number; crouch: number };
  size: number;
}

/** A Pipseed: small and round, the head nearly the size of the body, a big dark eye, a tall crest of leaves, short leaf wings, an acorn in its beak. */
const PIPSEED_LOOK: Pip = {
  stage: 0,
  spec: {
    high: 1.15,
    leg: { at: [0.32, -0.05, -0.5], len: [0.22, 0.3, 0.06], rest: [8, -22] },
    neck: { at: [0, 0.5, 0.28], len: 0.16, lean: 40 },
    head: { pitch: 0 },
    wing: { at: [0.7, 0.24, 0.2] },
    tail: { at: [0, -0.8, 0.2], lift: 30 },
    swing: [26, 34],
    hop: true,
    thrust: 6,
    // Foraging, it bows as it does to plant (`posePip`), not as a bird of its build would.
    peck: 0, tip: 0, nose: 0, crouch: 0, stance: 1.2,
  },
  body: { c: [0, -0.08, 0], r: [0.8, 1.04, 0.7], pitch: 6 },
  back: 0,
  neck: { w: 0.5, len: 0.16 },
  head: { c: [0, 0.32, 0.06], r: [0.66, 0.64, 0.6] },
  eye: { dir: [0.7, 0.66, 0.16], size: 0.25 },
  beak: { at: [0, 0.82, 0.02], len: 0.36, w: 0.17, drop: 14, hook: 0 },
  crest: {
    at: [0, 0.12, 0.62],
    plumes: [
      [0.84, 0.26, 4, 0, 'orange'], [1.08, 0.3, 24, -12, 'red'], [1.08, 0.3, 24, 12, 'orange'], [1.08, 0.3, 46, -20, 'orange'], [1.08, 0.3, 46, 20, 'red'],
      [0.96, 0.28, 68, -14, 'red'], [0.96, 0.28, 68, 14, 'gold'], [0.74, 0.24, 92, 0, 'gold'],
    ],
  },
  wing: {
    at: [0.76, 0.24, 0.16],
    pinions: [
      { at: 0.02, len: 1.25, w: 0.32, fold: 46, open: 112, layer: 0, tone: 'red' },
      { at: 0.08, len: 1.2, w: 0.32, fold: 32, open: 76, layer: 0.03, tone: 'orange' },
      { at: 0.14, len: 1.08, w: 0.3, fold: 18, open: 40, layer: 0.06, tone: 'red' },
      { at: 0.2, len: 0.86, w: 0.28, fold: 4, open: 8, layer: 0.09, tone: 'orange' },
      { at: 0.04, len: 0.6, w: 0.24, fold: -6, open: -20, layer: 0.13, tone: 'gold' },
    ],
  },
  tail: [[0.82, 0.28, 26, 0, 'red'], [0.74, 0.26, 44, -24, 'orange'], [0.74, 0.26, 44, 24, 'red'], [0.58, 0.22, 64, -12, 'gold'], [0.58, 0.22, 64, 12, 'orange']],
  tufts: [[0.5, 46, 0.34, 'orange'], [0.28, 58, 0.36, 'gold'], [0.62, 26, 0.28, 'gold']],
  leg: { shank: 0.42, w: 0.07 },
  hold: 'acorn',
  load: 0.5,
  bow: { tip: 30, neck: 50, nose: 26, crouch: 0.5 },
  size: 2.3,
};

/** A Sprigwing: tall on long legs, a cream face and breast and a brown back, a bigger crest, a fanned tail of layered leaves, a sapling in its beak. */
const SPRIGWING_LOOK: Pip = {
  stage: 1,
  spec: {
    high: 2.2,
    leg: { at: [0.32, -0.12, -0.5], len: [0.55, 0.95, 0.08], rest: [14, -34] },
    neck: { at: [0, 0.7, 0.36], len: 0.5, lean: 26 },
    head: { pitch: 0 },
    wing: { at: [0.62, 0.36, 0.26] },
    tail: { at: [0, -1.05, 0.12], lift: 8 },
    swing: [26, 36],
    thrust: 10,
    waddle: 3,
    peck: 0, tip: 0, nose: 0, crouch: 0, stance: 1.4,
  },
  body: { c: [0, -0.1, 0], r: [0.74, 1.14, 0.78], pitch: 6 },
  back: 1.3,
  neck: { w: 0.44, len: 0.5 },
  head: { c: [0, 0.14, 0.2], r: [0.56, 0.64, 0.52] },
  eye: { dir: [0.72, 0.6, 0.26], size: 0.17 },
  beak: { at: [0, 0.68, 0.1], len: 0.82, w: 0.11, drop: 8, hook: 0 },
  crest: {
    at: [0, -0.12, 0.38],
    plumes: [
      [1.0, 0.3, -8, 0, 'orange'], [1.3, 0.34, 10, -12, 'red'], [1.3, 0.34, 10, 12, 'red'], [1.32, 0.34, 30, -20, 'orange'], [1.32, 0.34, 30, 20, 'red'],
      [1.18, 0.32, 50, -14, 'red'], [1.18, 0.32, 50, 14, 'orange'], [0.9, 0.28, 70, -8, 'gold'], [0.9, 0.28, 70, 8, 'gold'],
    ],
  },
  wing: {
    at: [0.7, 0.36, 0.24],
    pinions: [
      { at: 0.04, len: 1.25, w: 0.3, fold: 14, open: 104, layer: 0, tone: 'red' },
      { at: 0.1, len: 1.22, w: 0.3, fold: 6, open: 72, layer: 0.03, tone: 'orange' },
      { at: 0.18, len: 1.12, w: 0.3, fold: -2, open: 40, layer: 0.06, tone: 'red' },
      { at: 0.26, len: 0.92, w: 0.28, fold: -8, open: 10, layer: 0.09, tone: 'gold' },
      { at: 0.06, len: 0.66, w: 0.24, fold: -16, open: -18, layer: 0.12, tone: 'orange' },
      { at: 0.0, len: 0.8, w: 0.26, fold: 6, open: 80, layer: 0.16, tone: 'brown' },
      { at: 0.08, len: 0.72, w: 0.26, fold: -6, open: 40, layer: 0.19, tone: 'brown' },
      { at: 0.16, len: 0.6, w: 0.24, fold: -14, open: 6, layer: 0.22, tone: 'brown' },
    ],
  },
  tail: [
    [1.95, 0.48, 26, 0, 'red'], [1.85, 0.46, 36, -20, 'orange'], [1.85, 0.46, 36, 20, 'red'], [1.7, 0.44, 50, -36, 'red'], [1.7, 0.44, 50, 36, 'orange'],
    [1.6, 0.42, 12, -12, 'orange'], [1.6, 0.42, 12, 12, 'gold'], [1.4, 0.4, 64, -50, 'gold'], [1.4, 0.4, 64, 50, 'red'],
    [1.15, 0.36, 0, -28, 'gold'], [1.15, 0.36, 0, 28, 'orange'],
  ],
  tufts: [],
  leg: { shank: 0.95, w: 0.09 },
  hold: 'beak',
  load: 1,
  bow: { tip: 32, neck: 58, nose: 22, crouch: 0.6 },
  size: 2.3,
};

/** An Arborcrest: large and upright, great wings of red maple leaves over cream coverts, a crest like a flame, a hooked beak, a sapling in its talons. */
const ARBORCREST_LOOK: Pip = {
  stage: 2,
  spec: {
    high: 2.4,
    leg: { at: [0.42, -0.1, -0.72], len: [0.6, 0.72, 0.1], rest: [10, -26] },
    neck: { at: [0, 0.82, 0.62], len: 0.72, lean: 16 },
    head: { pitch: 0 },
    wing: { at: [0.78, 0.4, 0.5] },
    tail: { at: [0, -1.2, -0.1], lift: -24 },
    swing: [22, 30],
    thrust: 4,
    waddle: 2,
    peck: 0, tip: 0, nose: 0, crouch: 0, stance: 1.2,
  },
  body: { c: [0, -0.1, 0], r: [1.0, 1.32, 1.04], pitch: 22 },
  back: 1.55,
  neck: { w: 0.5, len: 0.72 },
  head: { c: [0, 0.12, 0.2], r: [0.6, 0.7, 0.58] },
  eye: { dir: [0.72, 0.56, 0.3], size: 0.15 },
  beak: { at: [0, 0.7, 0.12], len: 0.62, w: 0.17, drop: 14, hook: 0.22 },
  crest: {
    at: [0, -0.2, 0.42],
    plumes: [
      [1.4, 0.36, 14, 0, 'orange'], [1.7, 0.4, 30, -12, 'red'], [1.7, 0.4, 30, 12, 'orange'], [1.66, 0.4, 48, -24, 'orange'], [1.66, 0.4, 48, 24, 'red'],
      [1.46, 0.36, 66, -14, 'red'], [1.46, 0.36, 66, 14, 'gold'], [1.16, 0.32, 84, -8, 'gold'], [1.16, 0.32, 84, 8, 'red'], [0.86, 0.28, 0, -30, 'gold'], [0.86, 0.28, 0, 30, 'gold'],
    ],
  },
  wing: {
    at: [0.92, 0.46, 0.4],
    pinions: [
      { at: 0.1, len: 3.6, w: 0.83, fold: 8, open: 112, layer: 0, tone: 'red' },
      { at: 0.2, len: 3.66, w: 0.85, fold: 3, open: 88, layer: 0.03, tone: 'red' },
      { at: 0.32, len: 3.48, w: 0.83, fold: -2, open: 64, layer: 0.06, tone: 'orange' },
      { at: 0.44, len: 3.12, w: 0.78, fold: -7, open: 40, layer: 0.09, tone: 'red' },
      { at: 0.56, len: 2.64, w: 0.71, fold: -12, open: 18, layer: 0.12, tone: 'orange' },
      { at: 0.66, len: 2.16, w: 0.62, fold: -18, open: -4, layer: 0.15, tone: 'red' },
      { at: 0.0, len: 1.25, w: 0.3, fold: 14, open: 96, layer: 0.2, tone: 'covert' },
      { at: 0.1, len: 1.2, w: 0.3, fold: 4, open: 66, layer: 0.23, tone: 'covert' },
      { at: 0.22, len: 1.1, w: 0.3, fold: -6, open: 36, layer: 0.26, tone: 'covert' },
      { at: 0.34, len: 0.9, w: 0.28, fold: -14, open: 8, layer: 0.29, tone: 'covert' },
    ],
  },
  tail: [
    [2.1, 0.5, 6, 0, 'red'], [1.95, 0.48, 0, -20, 'orange'], [1.95, 0.48, 0, 20, 'orange'], [1.7, 0.44, -8, -38, 'red'], [1.7, 0.44, -8, 38, 'red'],
    [1.4, 0.4, 18, -12, 'gold'], [1.4, 0.4, 18, 12, 'gold'],
  ],
  tufts: [],
  leg: { shank: 0.72, w: 0.16 },
  hold: 'talon',
  load: 1.25,
  bow: { tip: 30, neck: 60, nose: 18, crouch: 0.3 },
  size: 3.0,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each leaf, nought to one, so a crest is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
/** A ringing that dies away, `since` seconds after a blow. */
const ringOut = (since: number, k: number, f = 2.4, damp = 4): number => (since < 0 ? 0 : k * Math.exp(-since * damp) * Math.sin(since * TAU * f));
/** A frame turned about z by `yaw` degrees, then pitched and rolled, at `t`. */
const frameAt = (t: V3, yaw: number, pitch = 0, roll = 0): Xf => joint(joint({ m: ROOT.m, t }, [0, 0, 0], 0, 0, yaw), [0, 0, 0], pitch, roll);
/** A bone's frame squashed toward its own ground: what has been planted sinking into the soil. */
const sunk = (x: Xf, k: number): Xf => ({ m: [x.m[0], x.m[1], x.m[2] * k, x.m[3], x.m[4], x.m[5] * k, x.m[6], x.m[7], x.m[8] * k], t: x.t });
/** A bone's frame made smaller about its own joint: a leaf blown away dwindling. */
const shrunk = (x: Xf, k: number): Xf => ({ m: x.m.map((v) => v * k) as Xf['m'], t: x.t });
/** Which way a bone faces over the ground, in degrees (left positive), from where its forward goes. */
const headingOf = (x: Xf): number => Math.atan2(-x.m[1], x.m[4]) / DEG;

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

/* ---- a leaf -------------------------------------------------------------------------- */

/**
 * Half a leaf's outline, across and along it, from its stalk to its tip: a maple's five lobes, a narrower one of three for a
 * crest, and a plain rounded one for a cream covert.
 */
type Lobes = ReadonlyArray<readonly [number, number]>;
const MAPLE: Lobes = [[0.1, 0.04], [0.5, 0.12], [0.26, 0.27], [0.74, 0.46], [0.3, 0.54], [0.4, 0.74], [0.15, 0.76]];
const SPRAY: Lobes = [[0.18, 0.1], [0.44, 0.3], [0.26, 0.38], [0.46, 0.58], [0.22, 0.66], [0.26, 0.82], [0.1, 0.86]];
const COVERT: Lobes = [[0.4, 0.12], [0.62, 0.36], [0.64, 0.6], [0.5, 0.82], [0.24, 0.96]];

/** A covert of a wing: a plain rounded feather, cream or the brown of the back. */
type Covert = 'covert' | 'brown';
/** The two colours of a leaf of each tone: its face, and its back. */
const TONES: Record<Tone | Covert, readonly [Mat, Mat]> = { red: ['leafDark', 'flame'], orange: ['leaf', 'flame'], gold: ['petal', 'leaf'], covert: ['mark', 'mark'], brown: ['feather', 'featherDark'] };

/**
 * A leaf from `root` along `dir`, `len` long and `w` across each side of its rib, its face turned along `face`: two halves either
 * side of the rib, each lifted toward its edge by `fold` so it is a shallow V, and arched along its length. No thickness: its
 * face and its back, whichever is turned to the viewer drawn, the back in the darker colour of its tone.
 */
function leafMesh(root: V3, dir: V3, face: V3, len: number, w: number, tone: Tone | Covert, o: { lobes?: Lobes; fold?: number; arch?: number } = {}): Mesh {
  const d = unit(dir), n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n));
  const lobes = o.lobes ?? (tone === 'covert' || tone === 'brown' ? COVERT : MAPLE), fold = o.fold ?? 0.3, arch = o.arch ?? 0.1;
  const wide = Math.max(...lobes.map(([x]) => x));
  const at = (x: number, y: number): V3 => add(add(add(root, scale(d, y * len)), scale(side, (x / wide) * w)), scale(n, fold * Math.abs(x / wide) * w + arch * len * Math.sin(Math.PI * y)));
  const right = [at(0, 0), ...lobes.map(([x, y]) => at(x, y)), at(0, 1)];
  const left = [at(0, 1), ...[...lobes].reverse().map(([x, y]) => at(-x, y)), at(0, 0)];
  const [top, back] = TONES[tone];
  const v: V3[] = [...right, ...left, ...right, ...left];
  const R = right.length, L = left.length, H = R + L;
  const f: Face[] = [
    { i: Array.from({ length: R }, (_, k) => k), m: top },
    { i: Array.from({ length: L }, (_, k) => R + k), m: top },
    { i: Array.from({ length: R }, (_, k) => H + k), m: back },
    { i: Array.from({ length: L }, (_, k) => H + R + k), m: back },
  ];
  const nb = scale(n, -1);
  return mesh(v, woundTo(v, f, [n, n, nb, nb]));
}

/** A crest or a tail: its leaves from a root, each `up` degrees back from `axis` and `out` to the side, faced outward. */
function plumes(root: V3, list: readonly Plume[], axisUp: V3, axisBack: V3, lobes: Lobes, arch = 0.12, slim = 1): Mesh {
  return merge(...list.map(([len, w, up, out], q) => {
    const tone = list[q][4];
    const a = up * DEG, o = out * DEG;
    // Back from the axis by `up`, then out to the side by `out`.
    const inPlane = add(scale(axisUp, Math.cos(a)), scale(axisBack, Math.sin(a)));
    const dir = unit(add(scale(inPlane, Math.cos(o)), [Math.sin(o), 0, 0]));
    const sd = out < 0 ? -1 : out > 0 ? 1 : q % 2 ? -1 : 1;
    const face = unit([sd * 0.85, 0.1, 0.55]);
    const r = add(root, [sd * Math.min(0.06, Math.abs(out) * 0.003), 0, 0]);
    return leafMesh(r, dir, face, len, w * slim, tone, { lobes, arch: arch * (0.8 + 0.4 * jitter(q + len)) });
  }));
}

/* ---- what it carries ----------------------------------------------------------------- */

/** An acorn: a round-ended brown nut in a rough cap with a stalk, its point along `axis` from `c`. */
function acornMesh(c: V3, axis: V3, r: number, n: number): Mesh {
  const d = unit(axis);
  return merge(
    orbAlong(add(c, scale(d, r * 0.18)), d, [r, r, r * 1.3], n, 4, 'horn'),
    orbAlong(add(c, scale(d, -r * 0.42)), d, [r * 1.08, r * 1.08, r * 0.62], n, 3, 'bark'),
    taper([add(c, scale(d, -r * 0.95)), add(c, scale(d, -r * 1.35))], r * 0.16, r * 0.1, 4, 'bark'),
  );
}

/** A sapling's leaves: a few green ones off the top of its stem, in its own frame, the stem going up from its foot `z0` to `z1`. */
function saplingTop(k: number, z1: number): Mesh {
  const top: V3 = [0, 0, z1];
  const list: Array<[V3, number, Mat]> = [
    [[0, 0.1, 1], 0.42, 'moss'], [[0.9, 0.2, 0.5], 0.38, 'spot'], [[-0.9, -0.1, 0.55], 0.38, 'moss'], [[0.5, -0.8, 0.45], 0.34, 'spot'],
    [[-0.4, 0.9, 0.4], 0.34, 'moss'], [[0.8, 0.6, 0.15], 0.28, 'moss'], [[-0.7, -0.7, 0.1], 0.28, 'spot'],
  ];
  return merge(...list.map(([d, len], q) => {
    const at = add(top, [0, 0, -0.2 * k * (q > 4 ? 2 : q > 0 ? 1 : 0)]);
    const out = unit(d), face = unit(add([0, 0, 1], scale(out, -0.4)));
    // A plain pointed leaf, green, each its own shade.
    return recolour(leafMesh(at, out, face, len * k * 1.7, len * k * 0.55, 'orange', { lobes: [[0.5, 0.2], [0.62, 0.5], [0.36, 0.8]], fold: 0.25, arch: 0.08 }), list[q][2]);
  }));
}
/** The same mesh with every face one colour. */
const recolour = (m: Mesh, mat: Mat): Mesh => mesh(m.v, m.f.map((f) => ({ ...f, m: mat })));

/**
 * A sapling in its own frame, `k` big: a thin stem up from a round root ball, a few roots trailing from the ball, and leaves off
 * the top. Held by its stem (`grip`), the frame's origin is that far up the stem; held by its ball, it is the ball's middle.
 */
function saplingMesh(k: number, n: number, grip: 'stem' | 'ball', ball = true): Mesh {
  const R = 0.3 * k, stem = 1.05 * k;
  const z0 = grip === 'stem' ? -0.55 * k : R * 0.7;
  const z1 = z0 + stem;
  const ballAt: V3 = [0, 0, z0 - R * 0.7];
  return merge(
    tube(curve([0, 0, z0 - R * 0.4], [0.04 * k, 0.02, (z0 + z1) / 2], [0, 0.04 * k, z1], 3), [0.05 * k, 0.045 * k, 0.04 * k, 0.03 * k], [0.05 * k, 0.045 * k, 0.04 * k, 0.03 * k], 5, 'bark'),
    // Two twigs off the stem.
    taper([[0, 0, z0 + stem * 0.55], [0.22 * k, 0.05, z0 + stem * 0.72]], 0.03 * k, 0.015 * k, 4, 'bark'),
    taper([[0, 0, z0 + stem * 0.68], [-0.2 * k, -0.04, z0 + stem * 0.86]], 0.03 * k, 0.015 * k, 4, 'bark'),
    saplingTop(k, z1),
    ball && orb(ballAt, [R, R, R * 0.9], n, 4, 'shell'),
    ball && merge(...[0, 1, 2, 3].map((q) => {
      const a = q * 1.7 + 0.4;
      const from: V3 = add(ballAt, [Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, -R * 0.55]);
      return taper(curve(from, add(from, [Math.cos(a) * 0.1 * k, Math.sin(a) * 0.1 * k, -0.12 * k]), add(from, [Math.cos(a + 0.6) * 0.16 * k, Math.sin(a + 0.6) * 0.16 * k, -0.26 * k]), 2), 0.035 * k, 0.01 * k, 4, 'shellDark');
    })),
  );
}

/** How tall a sapling `k` big stands out of the ground once planted, from its foot. */
const saplingFoot = (k: number): number => 0.3 * k * 0.7;

/** A little heap of turned soil, `r` across: what a planting leaves round its foot. */
const moundMesh = (r: number, n: number): Mesh => orbAlong([0, 0, 0], [0, 0, 1], [r, r, r * 0.45], n, 3, 'stone');

/* ---- the moves, in time -------------------------------------------------------------- */

/** The strike: when the blow lands, a stage at a time. */
export const PIP_HITS: readonly number[] = [0.48, 0.52, 0.58];

/**
 * A go at its task, in shares of it: bowing to the ground (`down`), what it carries pushed in and let go (`set`), the two taps of
 * the soil round it (`tamps`), the next taken up from those it has laid by (`take`), and back upright by `up`. What was planted
 * sinks out of sight over `sink`, the soil it is in becoming the ground's.
 */
export const PIP_WORK = { down: [0.04, 0.24] as const, set: 0.3, tamps: [0.42, 0.54] as const, take: 0.76, up: 0.94, sink: [0.86, 1] as const } as const;

/** Its call now and then, standing: seconds into the loop. */
export const PIP_CALLS: readonly number[] = [5.2, 16.8];

/* ---- its bones ----------------------------------------------------------------------- */

/**
 * How far its wings are spread (nought folded along its flanks, one its leaves fanned open), how far each is rolled up and out
 * about its shoulder (degrees: nought along the flank, ninety held out level, less held high), and swung forward (degrees).
 */
interface WingSet { spread: number; raise: number; sweep: number }

/** When the Arborcrest opens its wings standing, to show them: seconds into the loop, and for how long. */
const DISPLAY = [6.4, 17.6] as const, DISPLAY_LEN = 2.6;

function wingsOf(s: Pip, a: Anim): WingSet {
  const act = a.act;
  let spread = 0, raise = 0, sweep = 0;
  if (act?.kind === 'strike') {
    const hit = PIP_HITS[s.stage];
    if (s.stage === 2) {
      // Opened wide and held high, then beaten down and forward into the blow, and folded again.
      const open = ramp(act.t, 0.02, 0.3) * (1 - ramp(act.t, hit + 0.14, 0.98));
      spread = open;
      raise = open * (52 + 66 * ramp(act.t, hit - 0.2, hit) - 30 * ramp(act.t, hit + 0.04, hit + 0.3));
      sweep = open * (-8 + 18 * ramp(act.t, hit - 0.2, hit));
    } else {
      // Flared up and out as it gathers itself, and beaten down with the blow.
      const k = ramp(act.t, 0.04, hit - 0.12) * (1 - ramp(act.t, hit + 0.1, 0.95));
      spread = [0.95, 0.9][s.stage] * k;
      raise = k * (26 + 60 * ramp(act.t, hit - 0.12, hit));
      sweep = 14 * hump(act.t, hit, 0.1);
    }
  } else if (act?.kind === 'evolve') {
    const k = ramp(act.t, 0.2, 0.48) * (1 - ramp(act.t, 0.62, 0.95));
    spread = k;
    raise = 62 * k;
  } else if (act?.kind === 'work') {
    // A flick of the wings for balance as it bows, and again as it straightens.
    const k = hump(act.t, 0.2, 0.12) + 0.8 * hump(act.t, 0.86, 0.1);
    spread = 0.2 * k;
    raise = 34 * k;
  } else {
    const g = a.go;
    if (s.stage === 2 && g > 0) {
      // Flying low over the ground, a slow beat of its great wings once a stride: high on the upstroke, a little under level at the
      // bottom of the downstroke, the leaves fanned widest as they come down.
      const w = frac(a.u) * TAU;
      spread = g * (0.85 + 0.12 * Math.sin(w + 0.6));
      raise = g * (78 + 36 * Math.sin(w));
      sweep = g * 8 * Math.cos(w);
    } else if (g > 0) {
      // A flutter out on each hop, or held a little out at a run, for balance.
      const w = frac(a.u);
      const flick = s.spec.hop ? Math.sin(Math.PI * clamp((w - 0.06) / 0.5)) : 0.5 * a.gait;
      spread = g * 0.35 * flick;
      raise = g * 48 * flick;
    }
    if (g < 1) {
      const still = 1 - g;
      // A shake of the wings now and then; and the Arborcrest's display, its wings opened wide and held high, and folded again.
      const shake = beat(a.t, [11.3, 22.1], 0.7) * still;
      spread += 0.3 * shake;
      raise += shake * (28 + 12 * Math.sin(a.t * TAU * 4));
      if (s.stage === 2) {
        // Held a little open always, mantled over its back, so its leaves show.
        spread += 0.32 * still;
        raise += 18 * still;
        const show = (beat(a.t, [DISPLAY[0]], DISPLAY_LEN) ** 0.6 + beat(a.t, [DISPLAY[1]], DISPLAY_LEN) ** 0.6) * still * (1 - a.graze);
        // Opened as a fan held up beside it rather than out flat, so its leaves show their faces from the side as well as in front.
        spread += 0.68 * show;
        raise += 14 * show + 5 * show * Math.sin(a.t * TAU * 0.9);
        sweep += -6 * show;
      }
    }
  }
  return { spread: clamp(spread), raise, sweep };
}

/** How far the crest is lifted (degrees, up toward upright and forward) and how it flutters (degrees, to the side), this moment. */
function crestOf(s: Pip, a: Anim): [number, number] {
  const t = a.t, act = a.act;
  let lift = 0, side = 0;
  if (act?.kind === 'strike') {
    const hit = PIP_HITS[s.stage];
    lift = 22 * ramp(act.t, 0.04, hit - 0.1) * (1 - ramp(act.t, hit + 0.1, 0.95)) - 8 * hump(act.t, hit + 0.06, 0.08);
    side = ringOut((act.t - hit) * ACT_SECS.strike, 9, 5, 5);
  } else if (act?.kind === 'evolve') {
    lift = 26 * ramp(act.t, 0.2, 0.5) * (1 - ramp(act.t, 0.6, 0.9));
    side = 6 * Math.sin(act.t * 40) * hump(act.t, 0.5, 0.2);
  } else if (act?.kind === 'work') {
    // Shaken by each tap at the soil.
    for (const tp of PIP_WORK.tamps) side += ringOut((act.t - tp) * ACT_SECS.work, 7, 5, 6);
    lift = -10 * hump(act.t, 0.24, 0.18);
  } else {
    const g = a.go, w = frac(a.u);
    // Going: thrown back as it lands and forward as it goes up, a beat after each hop or step.
    const bob = s.spec.hop ? Math.sin(w * TAU - 1.1) : Math.sin(w * TAU * 2 - 1.1) * 0.6;
    lift = g * (s.stage === 2 ? -14 : 10 * bob - 4 * a.gait);
    side = g * (s.stage === 2 ? 3 * Math.sin(w * TAU) : 3 * Math.sin(w * TAU - 0.6));
    // Standing: stirring in the air, a ruffle now and then, and lifted as it calls.
    const st = 1 - g;
    const ruffle = beat(t, [3.9, 13.4, 20.2], 0.9);
    lift += st * (3 * cyc(t, 7) + 12 * beat(t, PIP_CALLS, 0.8) + 6 * ruffle);
    side += st * (2.5 * cyc(t, 11, 0.5) + 7 * ruffle * Math.sin(t * TAU * 3.2));
  }
  return [lift, side];
}

/**
 * How far through each part of a go at its task it is this moment, nought to one: bowed to plant, at each tap of the soil, bowed to
 * take up the next, the push as it sets what it carries in, and how far round to its side it has turned.
 */
function workOf(t: number): { plant: number; tamp: number; take: number; push: number; turn: number } {
  const W = PIP_WORK;
  const plant = ramp(t, W.down[0], W.down[1]) * (1 - ramp(t, W.set + 0.02, W.set + 0.1));
  const tamp = hump(t, W.tamps[0], 0.06) + hump(t, W.tamps[1], 0.06);
  const turn = ramp(t, 0.58, 0.68) * (1 - ramp(t, W.take + 0.06, W.up));
  const take = ramp(t, 0.62, W.take - 0.02) * (1 - ramp(t, W.take + 0.02, W.up));
  return { plant, tamp, take, push: hump(t, W.set - 0.03, 0.04), turn };
}

/**
 * How far a stage bows (or, the Arborcrest, swings its foot forward, in degrees) for each part of its task, worked out once from its
 * own bones (`reachOf`), so that what it carries meets the ground, a tap meets the soil, and it reaches what it has laid by.
 */
interface Reach { plant: number; tamp: number; take: number }
const reaches = new Map<Pip, Reach>();

/** The Arborcrest's right leg holding up its sapling: swung forward and bent at the knee. */
const HOLD = [92, 0.3] as const;

/** A leg's swing, fold and lift (`BirdPose.legs`). */
type Leg3 = [number, number, number];
const mixLeg = (x: Leg3, y: Leg3, k: number): Leg3 => [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)];
/** How far the Arborcrest's knee is bent as it plants, presses the soil and takes up the next: nearly straight out ahead, then nearer. */
const FOOT_FOLD = { plant: 0.1, tamp: 0.3, take: 0.5 } as const;

/** The least `x` in `lo`..`hi` at which `f`, falling as `x` rises, is down to `goal`. */
function solve(f: (x: number) => number, goal: number, lo: number, hi: number, rising = false): number {
  for (let q = 0; q < 22; q++) {
    const mid = (lo + hi) / 2, past = rising ? f(mid) > goal : f(mid) < goal;
    if (past) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** How far under its grip a sapling's root ball reaches, `k` big, held by its stem (`saplingMesh`). */
const ballDrop = (k: number): number => 1.03 * k;

function reachOf(s: Pip): Reach {
  const had = reaches.get(s);
  if (had) return had;
  const R: Reach = s.hold === 'talon' ? { plant: HOLD[0], tamp: HOLD[0], take: HOLD[0] } : { plant: 1, tamp: 1, take: 1 };
  reaches.set(s, R);
  const W = PIP_WORK;
  const at = (t: number): Bones => poseOf(s, { ...BASE, act: { kind: 'work', t } });
  const peak = { plant: (W.down[1] + W.set) / 2, tamp: W.tamps[0], take: W.take };
  if (s.hold === 'talon') {
    // The foot swung forward until the root ball it holds just meets the ground; pressing, until the foot's sole does; taking up
    // the next, until it is down to the one lying there.
    const ball = 0.3 * s.load * 0.9;
    R.plant = solve((x) => { R.plant = x; return place(at(peak.plant).gr2, TALON)[2] - ball; }, 0, 0, 120, true);
    R.tamp = solve((x) => { R.tamp = x; return place(at(peak.tamp).gr2, [0, 0.2, -0.08])[2]; }, 0.02, 0, 120, true);
    R.take = solve((x) => { R.take = x; return place(at(peak.take).gr2, TALON)[2]; }, 0.3 * s.load * 0.85, 0, 120, true);
  } else {
    const tip = beakTip(s);
    const low = s.hold === 'acorn' ? 0.2 : ballDrop(s.load);
    const grip = s.hold === 'acorn' ? tip : beakGrip(s);
    R.plant = solve((x) => { R.plant = x; return place(at(peak.plant).head, grip)[2] - low; }, 0, 0.1, 2);
    R.tamp = solve((x) => { R.tamp = x; return place(at(peak.tamp).head, tip)[2]; }, s.hold === 'acorn' ? 0.06 : 0.1, 0.1, 2);
    R.take = solve((x) => { R.take = x; return place(at(peak.take).head, tip)[2]; }, s.hold === 'acorn' ? 0.2 : 0.3, 0.1, 2);
  }
  return R;
}

/** Which side it lays by what it is to plant next: on its right. */
const STOCK_SIDE = 1;

/**
 * Its own moves over the pose a bird has (`birdBones`): head cocked to one side and the other standing, its strike, its task, and
 * evolving. The wings are posed on their own (`wingsOf`), so they are left folded here.
 */
function posePip(s: Pip, p: BirdPose, a: Anim): void {
  p.wings = [[0, 0], [0, 0]];
  const act = a.act, t = a.t;
  // At a strike or its task it looks where it is going, not about it.
  if (act) {
    const k = 1 - ramp(act.t, 0, 0.12) * (1 - ramp(act.t, 0.9, 1));
    p.head[1] *= k;
    p.head[2] *= k;
  }
  const bowBy = (k: number, side = 0): void => {
    const B = s.bow, tip = k * B.tip;
    p.pitch -= tip;
    p.neck[0] += k * B.neck;
    p.neck[1] += side;
    p.head[0] += tip - k * B.nose;
    for (const l of p.legs) {
      l[0] += tip * (s.spec.stance ?? 1) + k * 20 * B.crouch;
      l[1] += k * B.crouch;
    }
  };
  if (!act && a.go < 1) {
    const st = 1 - a.go;
    // A cock of the head to one side and the other, as it looks at something on the ground, and a call now and then.
    const cock = beat(t, [2.4, 9.6, 19.0], 1.4) - beat(t, [7.1, 14.6], 1.2);
    p.head[2] += st * 26 * cock;
    p.head[1] *= 0.5;
    const call = beat(t, PIP_CALLS, 0.8) * st;
    p.head[0] += 14 * call;
    p.jaw = Math.max(p.jaw, call * (0.5 + 0.5 * Math.sin(t * TAU * 5)));
  }
  if (!act && a.graze > 0 && a.go < 1) {
    // Foraging: bowed to pick at the ground just short of where it plants, so what it carries in its beak stays out of the soil.
    bowBy(a.graze * (1 - a.go) * (s.hold === 'talon' ? 0.85 : s.hold === 'beak' ? reachOf(s).plant * 0.92 : reachOf(s).tamp * 0.94));
  }
  if (s.stage === 2 && !act) {
    // Standing on its left foot with the sapling held up in its right; going, it flies low, the sapling under it.
    const g = a.go, w = frac(a.u);
    p.legs[1] = [lerp(HOLD[0], 40, g), lerp(HOLD[1], 0.9, g), 0];
    if (g > 0) {
      p.legs[0] = [lerp(p.legs[0][0], -40, g), lerp(p.legs[0][1], 1.2, g), lerp(p.legs[0][2], 0.5, g)];
      p.lift = g * (1.5 + 0.18 * Math.sin(w * TAU + 2.2));
      p.pitch = lerp(p.pitch, -10 + 3 * Math.sin(w * TAU + 2.2), g);
      p.neck = [lerp(p.neck[0], -6, g), 0];
      p.head = [lerp(p.head[0], 8, g), 0, 0];
      p.tail = [lerp(p.tail[0], -10 + 6 * Math.sin(w * TAU + 1), g), 0];
      p.roll = 0;
    }
  }
  if (act?.kind === 'strike') {
    const hit = PIP_HITS[s.stage], since = (act.t - hit) * ACT_SECS.strike;
    const gather = ramp(act.t, 0.02, hit - 0.14) * (1 - ramp(act.t, hit - 0.14, hit));
    const thrust = ramp(act.t, hit - 0.16, hit) * (1 - ramp(act.t, hit + 0.08, 0.95));
    if (s.stage === 0) {
      // Crouched and leaning back, then a hop forward into a peck with the acorn, and a little bounce back.
      p.lift += 0.4 * hump(act.t, hit - 0.08, 0.14);
      p.pitch += 12 * gather - 16 * thrust + ringOut(since, 5);
      p.neck[0] += -14 * gather + 24 * thrust;
      p.head[0] += 6 * gather - 10 * thrust;
      for (const l of p.legs) { l[0] += 16 * gather - 4 * thrust; l[1] += 0.5 * gather; }
    } else if (s.stage === 1) {
      // Drawn up tall with the neck back, then a hard stab forward of the long beak, and a rebound.
      p.pitch += 12 * gather - 12 * thrust + ringOut(since, 4);
      p.neck[0] += -26 * gather + 38 * thrust;
      p.head[0] += 12 * gather - 12 * thrust;
      p.tail[0] += 16 * gather - 8 * thrust;
      for (const l of p.legs) { l[0] += -6 * gather + 12 * thrust; l[1] += 0.15 * thrust; }
    } else {
      // Rearing up on its foot with its wings high, then down and forward with its wings into the blow and a strike of the beak.
      p.lift += 0.45 * gather;
      p.pitch += 12 * gather - 12 * thrust + ringOut(since, 5);
      p.neck[0] += -20 * gather + 32 * thrust;
      p.head[0] += 10 * gather - 12 * thrust;
      p.tail[0] += -12 * gather + 10 * thrust;
      p.legs[0][0] += -6 * gather + 12 * thrust;
      p.legs[1] = [HOLD[0] - 10 * thrust, HOLD[1], 0];
    }
    p.jaw = Math.max(p.jaw, s.stage === 0 ? 0 : 0.9 * hump(act.t, hit - 0.08, 0.12));
  } else if (act?.kind === 'work') {
    const w = workOf(act.t), R = reachOf(s);
    if (s.hold === 'talon') {
      // It leans over and sets the sapling in ahead of it with its foot, presses the soil down round it with the same foot twice,
      // and takes up the next from where it lies before its other foot; its head bowed to watch.
      bowBy(0.55 * w.plant + 0.5 * w.tamp + 0.45 * w.take);
      const held: Leg3 = [HOLD[0], HOLD[1], 0];
      let leg = mixLeg(held, [R.plant, FOOT_FOLD.plant, 0], w.plant);
      leg = mixLeg(leg, [R.tamp, FOOT_FOLD.tamp, 0], Math.min(1, w.tamp) * (1 - w.plant));
      leg = mixLeg(leg, [R.take, FOOT_FOLD.take, 0], w.take);
      // Between the taps the foot is held a little up over the soil, not taken all the way back up.
      const between = ramp(act.t, PIP_WORK.set + 0.04, PIP_WORK.tamps[0] - 0.04) * (1 - ramp(act.t, PIP_WORK.tamps[1] + 0.04, 0.64));
      leg = mixLeg(leg, [R.tamp + 14, FOOT_FOLD.tamp + 0.2, 0], between * (1 - Math.min(1, w.tamp)));
      p.legs[1] = leg;
      p.head[0] -= 10 * (w.plant + w.tamp);
    } else {
      // Its head down to the ground ahead, the load pushed in, two taps of the soil round it, then round to its side for the next.
      bowBy(Math.max(w.plant * R.plant + 0.05 * w.push, w.tamp * R.tamp, w.take * R.take), -STOCK_SIDE * 50 * w.turn);
      p.head[1] += -STOCK_SIDE * 24 * w.turn;
      p.head[2] += STOCK_SIDE * 8 * w.turn;
    }
  } else if (act?.kind === 'evolve') {
    const k = ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.65, 0.95));
    p.neck[0] -= 14 * k;
    p.head[0] += 12 * k;
    p.lift += 0.25 * k * (s.stage === 2 ? 2 : 1);
    if (s.stage === 2) p.legs[1] = [HOLD[0], HOLD[1], 0];
  }
}

/** How far forward its strike carries the whole of it this moment, in its own units, and back again after. */
function surgeOf(s: Pip, a: Anim): number {
  if (a.act?.kind !== 'strike' || s.stage === 1) return 0;
  const t = a.act.t, hit = PIP_HITS[s.stage];
  return (s.stage === 0 ? 0.55 : 0.4) * ramp(t, hit - 0.18, hit) * (1 - ramp(t, hit + 0.12, 0.96));
}

/** The bones of a stage in a pose before what it plants is set down: its body, its wings, its crest and what it carries. */
function poseOf(s: Pip, a: Anim): Bones {
  const act = a.act;
  const b = birdBones(s.spec, act ? { ...a, go: 0 } : a, (p) => posePip(s, p, a));
  // A wing's bone is its shoulder, square to the body, so that which side of the body it is on says whether it is drawn over it;
  // it is opened, rolled up and out and swept, within itself (`wingBent`).
  for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1;
    const at = s.wing.at;
    b[`wing${k}`] = joint(b.body, [sd * at[0], at[1], at[2]]);
  }
  const [lift, side] = crestOf(s, a);
  b.crest = joint(b.head, s.crest.at, lift, side);
  // Its strike carries it forward: the Pipseed hops into its peck, the Arborcrest lunges as it beats its wings down.
  const fwd = surgeOf(s, a);
  if (fwd) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + fwd, b[k].t[2]] };
  if (s.hold === 'talon') {
    // The Arborcrest's legs are named apart from a walker's, so that its feet hanging in the air as it flies are not taken for a stride.
    for (const k of ['0', '1', '2']) {
      b[`gl${k}`] = b[`bl${k}`];
      b[`gr${k}`] = b[`br${k}`];
      delete b[`bl${k}`];
      delete b[`br${k}`];
    }
  }
  return b;
}

/** Where the beak's tip is, in the head's frame. */
const beakTip = (s: Pip): V3 => {
  const B = s.beak, d = B.drop * DEG;
  return add(B.at, [0, Math.cos(d) * B.len, -Math.sin(d) * B.len]);
};
/** Where on the beak a sapling's stem is held, in the head's frame. */
const beakGrip = (s: Pip): V3 => {
  const B = s.beak, d = (B.drop + 4) * DEG, k = 0.62;
  return add(B.at, [0, Math.cos(d) * B.len * k, -Math.sin(d) * B.len * k]);
};
/** Where in a foot's frame a root ball is held, gripped in the toes. */
const TALON: V3 = [0, 0.18, -0.02];

/** A stage's ground points, once: where it plants, where it lays by what it plants next, and where the strike lands. */
interface Site { plant: V3; stock: V3; hit: V3 }
const sites = new Map<Pip, Site>();
const BASE: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
function siteOf(s: Pip): Site {
  const had = sites.get(s);
  if (had) return had;
  const at = (t: number): Bones => poseOf(s, { ...BASE, act: { kind: 'work', t } });
  let plant: V3, stock: V3;
  if (s.hold === 'talon') {
    plant = place(at(PIP_WORK.set).gr2, TALON);
    stock = place(at(PIP_WORK.take).gr2, TALON);
  } else {
    plant = place(at(PIP_WORK.set).head, s.hold === 'acorn' ? beakTip(s) : beakGrip(s));
    stock = place(at(PIP_WORK.take).head, beakTip(s));
  }
  const hb = poseOf(s, { ...BASE, act: { kind: 'strike', t: PIP_HITS[s.stage] } });
  const hit = place(hb.head, beakTip(s));
  const site = { plant: [plant[0], plant[1], 0] as V3, stock: [stock[0], stock[1], 0] as V3, hit };
  sites.set(s, site);
  return site;
}

/** Whether it has what it plants in hand this moment, rather than in the ground: not between letting it go and taking up the next. */
const holding = (a: Anim): boolean => !(a.act?.kind === 'work' && a.act.t >= PIP_WORK.set && a.act.t < PIP_WORK.take);
/** Whether what it planted shows, and how far it has sunk: from when it is let go to the end of the go. */
const plantedOf = (a: Anim): number => (a.act?.kind === 'work' && a.act.t >= PIP_WORK.set ? 1 - ramp(a.act.t, PIP_WORK.sink[0], PIP_WORK.sink[1]) : 0);

/** How far what it has just taken up still lies along the ground, as it lifts it and it swings down to hang: one as it takes it. */
const liftedOf = (a: Anim): number => (a.act?.kind === 'work' && a.act.t >= PIP_WORK.take ? 1 - ramp(a.act.t, PIP_WORK.take + 0.02, PIP_WORK.up + 0.04) : 0);

/** How far a load hung from the beak swings, forward and to the side (degrees): lagging the head as it goes and as it strikes. */
function swingOf(s: Pip, a: Anim): [number, number] {
  const act = a.act;
  if (act?.kind === 'strike') {
    const hit = PIP_HITS[s.stage];
    return [-18 * ramp(act.t, hit - 0.16, hit) * (1 - ramp(act.t, hit, 0.9)) + ringOut((act.t - hit) * ACT_SECS.strike, 24, 1.8, 3.5), 0];
  }
  if (act) return [0, 0];
  const w = frac(a.u) * TAU, g = a.go;
  return [g * (8 * Math.sin(w * 2 - 1.4) - 6 * a.gait) + (1 - g) * 3 * cyc(a.t, 6), g * 5 * Math.sin(w - 1.2) + (1 - g) * 2 * cyc(a.t, 4, 1)];
}

/** Leaves thrown off by its strike: how many, each flying out from where the blow lands. */
const GUSTS = 5;

function pipBones(s: Pip): (a: Anim) => Bones {
  return (a) => {
    const b = poseOf(s, a);
    const site = siteOf(s);
    // What it carries: hung upright from the beak, or held in the right foot's toes; and the acorn rides in the beak.
    if (s.hold === 'beak') {
      const [fwd, side] = swingOf(s, a);
      b.load = frameAt(place(b.head, beakGrip(s)), headingOf(b.head), fwd - 90 * liftedOf(a), side);
    } else if (s.hold === 'talon') {
      const [fwd] = swingOf(s, a);
      b.load = frameAt(place(b.gr2, TALON), headingOf(b.body), fwd * 0.4 - 90 * liftedOf(a), 0);
    }
    // While it plants: what it set in the ground, sinking into it at the end; and those laid by at its side.
    const sinkK = plantedOf(a);
    if (sinkK > 0) b.planted = sunk(frameAt(site.plant, 0), Math.max(0.02, sinkK));
    if (a.act?.kind === 'work') b.stock = frameAt(site.stock, 30);
    // The leaves thrown off by the strike, tumbling out and down from where it lands.
    if (a.act?.kind === 'strike') {
      const since = (a.act.t - PIP_HITS[s.stage]) * ACT_SECS.strike;
      if (since > 0) {
        const big = [0.7, 1, 1.4][s.stage];
        for (let q = 0; q < GUSTS; q++) {
          const ang = (q / (GUSTS - 1) - 0.5) * 2.6 + (jitter(q + 3) - 0.5) * 0.4, sp = big * (5 + 3 * jitter(q + 7));
          // Thrown out fast and slowed by the air, falling.
          const d = 0.25 * big + (sp * (1 - Math.exp(-since * 6))) / 6;
          const p: V3 = add(site.hit, [Math.sin(ang) * d, Math.cos(ang) * d * 0.7, (2.4 + jitter(q) * 1.6) * since * big - 7 * since * since]);
          const fade = 1 - ramp(since, 0.2, 0.29);
          b[`gust${q}`] = shrunk(frameAt([p[0], p[1], Math.max(0.05, p[2])], q * 70 + since * 500, since * (400 + 300 * jitter(q + 1)), q * 40), Math.max(0.02, fade));
        }
      }
    }
    if (s.stage === 2 && a.go > 0 && !a.act) b.shadow = { m: [0.75, 0, 0, 0, 0.75, 0, 0, 0, 1], t: [b.body.t[0], b.body.t[1], 0] };
    return b;
  };
}

/* ---- its pieces ---------------------------------------------------------------------- */

/**
 * A wing's leaves or its coverts, built folded along the right flank, and how to fan them: each leaf's corners, and the turn about its root that takes it
 * from folded to spread.
 */
function wingOf(s: Pip, coverts: boolean): { mesh: Mesh; spans: Array<[number, number, V3, number]> } {
  const parts: Mesh[] = [];
  const spans: Array<[number, number, V3, number]> = [];
  let count = 0;
  // The arm goes back along the flank from the shoulder, a little down.
  const arm = unit([0, -1, -0.25]);
  for (const P of s.wing.pinions) {
    if ((P.tone === 'covert' || P.tone === 'brown') !== coverts) continue;
    const root = add(scale(arm, P.at), [P.layer, 0, 0]);
    const a = P.fold * DEG;
    const dir: V3 = [0, -Math.cos(a), Math.sin(a)];
    const m = leafMesh(root, dir, [1, 0, 0.45], P.len, P.w, P.tone, { fold: 0.22, arch: 0.06 });
    parts.push(m);
    spans.push([count, count + m.v.length, root, (P.open - P.fold) * DEG]);
    count += m.v.length;
  }
  return { mesh: merge(...parts), spans };
}

/**
 * A wing's corners as it is this moment (`wingsOf`), on the left (`sd` -1) or the right: its leaves fanned open about their roots,
 * the whole rolled up and out about the shoulder, and swept forward.
 */
function wingBent(s: Pip, v: readonly V3[], spans: ReadonlyArray<[number, number, V3, number]>, a: Anim, sd: number): V3[] {
  const W = wingsOf(s, a);
  const out = fanned(v, spans, W.spread, sd);
  if (Math.abs(W.raise) < 0.01 && Math.abs(W.sweep) < 0.01) return out;
  const r = sd * W.raise * DEG, y = -sd * W.sweep * DEG;
  const cr = Math.cos(r), sr = Math.sin(r), cy = Math.cos(y), sy = Math.sin(y);
  return out.map(([x0, y0, z0]) => {
    const x1 = cr * x0 + sr * z0, z1 = -sr * x0 + cr * z0;
    return [cy * x1 - sy * y0, sy * x1 + cy * y0, z1] as V3;
  });
}

/** A wing's corners fanned open by `k` (nought folded, one spread), each leaf turned about its own root. */
function fanned(v: readonly V3[], spans: ReadonlyArray<[number, number, V3, number]>, k: number, sd: number): V3[] {
  if (k <= 0.001) return v as V3[];
  const out = v.slice() as V3[];
  for (const [s0, e, r0, turn] of spans) {
    const r: V3 = [sd * r0[0], r0[1], r0[2]];
    const c = Math.cos(turn * k), sn = Math.sin(turn * k);
    for (let i = s0; i < e; i++) {
      const y = v[i][1] - r[1], z = v[i][2] - r[2];
      // Turned from pointing back toward pointing up, about the leaf's own root.
      out[i] = [v[i][0], r[1] + y * c + z * sn, r[2] - y * sn + z * c];
    }
  }
  return out;
}

function pipBuild(s: Pip, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 7);
  const B = s.body, H = s.head;
  // The body: an egg tipped up at the front, the brown of the back over it for the two that have it, the cream of the breast below.
  const bodyR = B.r;
  // Rings from the tail to the breast, each facet the brown of the back over the top, cream down the sides and paler under.
  const rings = k + 3;
  const egg = tube(Array.from({ length: rings + 1 }, (_, q) => [B.c[0], B.c[1] - bodyR[1] * Math.cos((Math.PI * q) / rings), B.c[2]] as V3),
    Array.from({ length: rings + 1 }, (_, q) => bodyR[0] * Math.max(0.06, Math.sin((Math.PI * q) / rings))),
    Array.from({ length: rings + 1 }, (_, q) => bodyR[2] * Math.max(0.06, Math.sin((Math.PI * q) / rings))),
    n + 3, (ring, j) => {
      const ang = (((j + 1) / (n + 3)) * TAU) % TAU;
      if (s.back > 0 && ring < rings - 1 && Math.abs(ang - Math.PI / 2) < s.back * (ring < 2 ? 1.25 : 1)) return 'feather';
      return Math.abs(ang - Math.PI * 1.5) < 0.95 ? 'belly' : 'coat';
    });
  const tilt = (m: Mesh): Mesh => mesh(m.v.map((p) => {
    const a = B.pitch * DEG, y = p[1] - B.c[1], z = p[2] - B.c[2];
    return [p[0], B.c[1] + y * Math.cos(a) - z * Math.sin(a), B.c[2] + y * Math.sin(a) + z * Math.cos(a)] as V3;
  }), m.f);
  const body = tilt(egg);
  // The flank's small leaves, down from under the wing each side: the Pipseed's autumn breast.
  const tufts = merge(...s.tufts.flatMap(([along, round, len, tone], q) => [1, -1].map((sd) => {
    const a = round * DEG;
    const at: V3 = [sd * bodyR[0] * Math.sin(a) * 0.92, B.c[1] + along * bodyR[1] * 0.6, B.c[2] - bodyR[2] * Math.cos(a) * 0.5];
    return leafMesh(at, unit([sd * 0.25, -0.5, -0.8]), unit([sd, 0.3, 0.1]), len, len * 0.36, tone, { lobes: SPRAY, arch: 0.1 + 0.05 * jitter(q) });
  })));
  const neck = tube([[0, 0, -0.3], [0, 0.02, s.neck.len * 0.5], [0, 0.04, s.neck.len + 0.05]], s.neck.w, s.neck.w * 0.95, n, 'coat', { seam: 'both' });
  // The head: an egg of cream, a brown nape on the two that have a brown back, a blush, big dark eyes.
  const skull = orb(H.c, H.r, n + 2, k + 1, 'coat');
  const nape = s.back > 0 && patch(H.c, H.r, [0, -1, 0.35], 0.75, 0.55, 'feather', { sides: 12 });
  const cheek = patch(H.c, H.r, [0.62, 0.42, -0.42], 0.22, 0.14, 'inner', { sides: 10 });
  const cheekL = patch(H.c, H.r, [-0.62, 0.42, -0.42], 0.22, 0.14, 'inner', { sides: 10 });
  const look = (shut: boolean): Mesh => eyes(H.c, H.r, s.eye.dir, s.eye.size, { shut, tall: 1.12, rim: 0.12, glint: 0.4 });
  // The beak: upper on the head, lower on the jaw; the Arborcrest's hooked over at the tip.
  const Bk = s.beak, dr = Bk.drop * DEG;
  const fwd: V3 = [0, Math.cos(dr), -Math.sin(dr)];
  const tip = beakTip(s);
  const upper = Bk.hook > 0
    ? taper(curve(add(Bk.at, [0, -0.04, 0.03]), add(add(Bk.at, scale(fwd, Bk.len * 0.75)), [0, 0, 0.08]), add(tip, [0, 0, -Bk.hook]), 4), Bk.w, 0.02, 6, 'bill', 0.9)
    : taper([add(Bk.at, [0, -0.04, 0.02]), add(Bk.at, scale(fwd, Bk.len * 0.5)), tip], Bk.w, 0.015, 6, 'bill', 0.75);
  const lower = taper([add(Bk.at, [0, -0.04, -Bk.w * 0.45]), add(add(Bk.at, scale(fwd, Bk.len * 0.8)), [0, 0, -Bk.w * 0.35])], Bk.w * 0.75, 0.015, 5, 'billDark', 0.6);
  const headMesh = (shut: boolean): Mesh => merge(skull, nape, cheek, cheekL, upper, look(shut));
  // The crest, rooted on the crown and fanning up and back.
  const crest = plumes([0, 0, 0], s.crest.plumes, [0, 0.15, 1], [0, -1, 0.1], SPRAY, 0.14, 0.62);
  // The tail: a fan of leaves out of the rump, back and up.
  const tail = plumes([0, 0, 0], s.tail, [0, -1, 0.02], [0, -0.1, 1], MAPLE, 0.1, 0.8);
  const wing = wingOf(s, false), cover = wingOf(s, true);
  const legKeys = s.hold === 'talon' ? ['gl', 'gr'] : ['bl', 'br'];
  const L0 = s.spec.leg.len[0];
  const thigh = orbAlong([0, 0.02, -L0 * 0.5], [0, 0, 1], [s.leg.w * 2.6, s.leg.w * 2.8, L0 * 0.62], n, k, s.back > 0 ? 'feather' : 'coat');
  const pieces: Piece[] = [
    { key: 'body', mesh: body, bone: 'body', bias: 0, breathes: { c: [0, 0, 0], k: 0.04 } },
    { key: 'tail', mesh: tail, bone: 'tail0', bias: -0.08, lines: false },
    { key: 'neck', mesh: neck, bone: 'neck', bias: 0, under: 'head', convex: true, lines: false },
    { key: 'head', mesh: headMesh(false), shut: headMesh(true), bone: 'head', bias: 0.2 },
    { key: 'jaw', mesh: lower, bone: 'jaw', bias: 0.19, under: 'head' },
    { key: 'crest', mesh: crest, bone: 'crest', bias: 0.21, after: 'head', hide: [{ c: H.c, r: scale(H.r, 0.86) }], hideIn: 'head', lines: false },
    // Each wing its leaves, and over them its coverts, inked only round their outside so they lie on the leaves as one soft layer.
    ...[0, 1].flatMap((q): Piece[] => {
      const sd = q ? 1 : -1;
      const fan = (W: typeof wing): Piece['bent'] => (v, a) => wingBent(s, v, W.spans, a, sd);
      const out: Piece[] = [{
        key: `wing${q}`, mesh: q ? wing.mesh : mirrored(wing.mesh), bone: `wing${q}`, bias: 0.04, after: 'body', front: [sd, 0, 0], lines: s.stage === 2,
        bent: fan(wing),
      }];
      if (cover.mesh.v.length) out.push({ key: `cover${q}`, mesh: q ? cover.mesh : mirrored(cover.mesh), bone: `wing${q}`, bias: 0.045, after: `wing${q}`, front: [sd, 0, 0], lines: false, bent: fan(cover) });
      return out;
    }),
    // The thighs, feathered down to the knee, coming out from under the body.
    ...[0, 1].map((q): Piece => ({
      key: `thigh${q}`, mesh: thigh, bone: `${legKeys[q]}0`, bias: 0.015, after: 'body', front: [q ? 1 : -1, 0.3, 0], lines: false,
    })),
    ...birdLegPieces(`${legKeys[0]}`, -1, s.leg.shank, s.leg.w, 5),
    ...birdLegPieces(`${legKeys[1]}`, 1, s.leg.shank, s.leg.w, 5),
  ];
  if (s.tufts.length) pieces.push({ key: 'tufts', mesh: tufts, bone: 'body', bias: 0.02, after: 'body', lines: false });
  // What it carries, what it plants, and what it has laid by.
  const K = s.load;
  // Laid by at its side, two of what it plants: the nearer one is the one it takes up, gone once it has it.
  const taken = (a: Anim): boolean => a.act?.kind === 'work' && a.act.t < PIP_WORK.take;
  if (s.hold === 'acorn') {
    pieces.push(
      { key: 'seed', mesh: acornMesh(add(tip, scale(fwd, 0.14)), add(fwd, [0, 0, -0.35]), 0.2, n), bone: 'head', bias: 0.21, shown: holding },
      { key: 'planted', mesh: acornMesh([0, 0, 0.1], [0.2, 0.3, -1], 0.17, n), bone: 'planted', bias: 0.01, shown: (a) => plantedOf(a) > 0 },
      { key: 'stock', mesh: acornMesh([-0.3, 0.22, 0.13], [-0.6, 1, 0], 0.17, n), bone: 'stock', bias: 0.01 },
      { key: 'stock1', mesh: acornMesh([0.04, 0, 0.13], [1, 0.3, -0.1], 0.17, n), bone: 'stock', bias: 0.012, shown: taken },
    );
  } else {
    const held = saplingMesh(K, n, s.hold === 'beak' ? 'stem' : 'ball');
    const laid = lying(saplingMesh(K * 0.9, n, 'ball'), K * 0.9);
    pieces.push(
      { key: 'load', mesh: held, bone: 'load', bias: s.hold === 'beak' ? 0.22 : 0.05, shown: holding, lines: false },
      { key: 'planted', mesh: moved0(saplingMesh(K, n, 'ball', false), -saplingFoot(K) + 0.06), bone: 'planted', bias: 0.01, shown: (a) => plantedOf(a) > 0, lines: false },
      { key: 'stock', mesh: mesh(laid.v.map((v) => [v[0] - 0.45 * K, v[1] + 0.3 * K, v[2]] as V3), laid.f), bone: 'stock', bias: 0.01, lines: false },
      { key: 'stock1', mesh: laid, bone: 'stock', bias: 0.012, shown: taken, lines: false },
    );
  }
  pieces.push({ key: 'mound', mesh: moundMesh(0.34 * Math.max(0.8, K), n), bone: 'planted', bias: 0.02, after: 'planted', shown: (a) => plantedOf(a) > 0 && (a.act?.t ?? 0) > PIP_WORK.tamps[0] - 0.04 });
  for (let q = 0; q < GUSTS; q++) {
    const big = [0.5, 0.6, 0.8][s.stage];
    pieces.push({ key: `gust${q}`, mesh: leafMesh([0, -big * 0.5, 0], [0, 1, 0], [0, 0, 1], big, big * 0.45, (['red', 'orange', 'gold'] as const)[q % 3], { fold: 0.15 }), bone: `gust${q}`, bias: 0.3, lines: false });
  }
  return pieces;
}

/** A mesh moved straight up or down. */
const moved0 = (m: Mesh, dz: number): Mesh => mesh(m.v.map((p) => [p[0], p[1], p[2] + dz] as V3), m.f);
/** A sapling laid on its side on the ground, its ball on the ground and its leaves away along it, as one taken up is turned. */
const lying = (m: Mesh, k: number): Mesh => mesh(m.v.map((p) => [p[0], p[2], Math.max(0.02, 0.3 * k * 0.9 - p[1])] as V3), m.f);


/* ---- the ground it works ------------------------------------------------------------- */

/** The soil a stage turns as it plants: a dark patch where it digs, and crumbs thrown up at each push and tap. */
const SOIL: RGB = [128, 98, 70];
const SOIL_DARK: RGB = [96, 70, 52];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al.toFixed(3)})`;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };

function groundPatch(g: CanvasRenderingContext2D, view: View, c: V3, r: number, fill: RGB, al: number): void {
  if (al <= 0.01) return;
  g.beginPath();
  for (let q = 0; q < 14; q++) {
    const a = (q / 14) * TAU, rr = r * (0.86 + 0.18 * jitter(q + 2));
    const [x, y] = onScreen(view, [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * 0.9, 0]);
    if (q) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = css(fill, al);
  g.fill();
}

/** Crumbs of soil thrown up from `c`, `since` seconds after, each a small dark speck falling back. */
function crumbs(g: CanvasRenderingContext2D, view: View, c: V3, since: number, id: number, big: number): void {
  if (since < 0 || since > 0.35) return;
  const px = pxOf(g), al = 1 - smooth((since - 0.2) / 0.15);
  g.fillStyle = css(SOIL_DARK, al);
  for (let q = 0; q < 5; q++) {
    const k = id + q * 5, a = jitter(k) * TAU, sp = big * (0.8 + 0.8 * jitter(k + 1));
    const p: V3 = [c[0] + Math.cos(a) * sp * since, c[1] + Math.sin(a) * sp * since, big * 2.4 * since - 9 * since * since];
    if (p[2] < 0) continue;
    const [x, y] = onScreen(view, p);
    const r = Math.max(0.9 * px, big * 0.05);
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/* ---- the kinds ----------------------------------------------------------------------- */

/** How a stage's leaves are coloured from its variant's markings: its own red, orange and gold, the markings' hue leading. */
function autumn(mark: RGB): { red: RGB; orange: RGB; gold: RGB } {
  const hue = (c: RGB): number => {
    const r = c[0] / 255, gg = c[1] / 255, bb = c[2] / 255, mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), d = mx - mn;
    if (!d) return 20;
    const h = mx === r ? (gg - bb) / d + (gg < bb ? 6 : 0) : mx === gg ? (bb - r) / d + 2 : (r - gg) / d + 4;
    return h * 60;
  };
  const hsl = (h: number, sat: number, l: number): RGB => {
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    const f = (t: number): number => {
      const u = ((t % 1) + 1) % 1;
      return u < 1 / 6 ? p + (q - p) * 6 * u : u < 0.5 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
    };
    return [f(h / 360 + 1 / 3) * 255, f(h / 360) * 255, f(h / 360 - 1 / 3) * 255];
  };
  const h = hue(mark);
  // Kept warm whatever the markings: a hue past violet comes round as a crimson.
  const base = h > 300 ? h - 360 : Math.min(h, 60);
  // The gold never past a yellow, or a golden variant's paler leaves would come out green.
  return { red: hsl(base - 4, 0.68, 0.53), orange: hsl(Math.min(base + 14, 42), 0.8, 0.6), gold: hsl(Math.min(base + 30, 50), 0.82, 0.66) };
}

function pipKind(s: Pip): Kind {
  return {
    bones: pipBones(s),
    build: (lod) => pipBuild(s, lod),
    // The variant's coat is its down, kept a cream; its markings lead the colour of its leaves (`autumn`). Its back is a warm brown,
    // its beak a dark slate, its legs a grey-brown; what it plants is the same on every variant.
    palette: (coat, mark) => {
      const A = autumn(mark);
      const cream = mix([240, 216, 182], coat, 0.2);
      return coatPalette(coat, mark, {
        coat: cream,
        coatDark: mix(cream, [150, 120, 100], 0.2),
        coatLight: mix(cream, [255, 252, 244], 0.4),
        mark: mix(cream, [255, 248, 232], 0.4),
        belly: mix(cream, [250, 206, 160], 0.35),
        feather: mix([168, 120, 84], coat, 0.12),
        featherDark: mix([128, 88, 62], coat, 0.1),
        leaf: A.orange,
        leafDark: A.red,
        petal: A.gold,
        flame: mix(mix(A.red, A.orange, 0.4), [120, 52, 40], 0.15),
        inner: [240, 168, 156],
        bill: [92, 82, 84],
        billDark: [70, 62, 66],
        claw: [178, 134, 94],
        eye: [40, 28, 30],
        lid: [120, 92, 76],
        glint: [255, 253, 246],
        eyeWhite: [70, 54, 52],
        horn: [190, 128, 70],
        bark: [124, 88, 58],
        moss: [156, 194, 82],
        spot: [112, 156, 62],
        shell: [156, 116, 80],
        shellDark: [118, 88, 64],
        stone: [142, 108, 78],
      });
    },
    shadow: [[1.0, 1.25, 1.6][s.stage], [0.85, 0.9, 1.2][s.stage]],
    stride: s.stage === 2 ? 0.75 : 1.1,
    size: s.size,
    blinks: 6,
    acts: ['strike', 'work'],
    leaps: s.stage === 0 ? [true, true] : undefined,
    motes: [[236, 132, 70], [246, 196, 96]],
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (act?.kind !== 'work') return;
      const site = siteOf(s), big = [0.7, 1, 1.25][s.stage], T = ACT_SECS.work;
      if (under) {
        // The ground turned where it plants, darker as it digs in.
        const dug = ramp(act.t, PIP_WORK.down[1] - 0.06, PIP_WORK.set) * (1 - ramp(act.t, PIP_WORK.sink[0], 1));
        groundPatch(g, view, site.plant, 0.8 * big, SOIL, 0.85 * dug);
        groundPatch(g, view, site.plant, 0.45 * big, SOIL_DARK, 0.8 * dug);
        return;
      }
      crumbs(g, view, add(site.plant, [0, 0, 0.05]), (act.t - PIP_WORK.set + 0.04) * T, 3, big);
      for (const [q, tp] of PIP_WORK.tamps.entries()) crumbs(g, view, add(site.plant, [0.12 * (q ? 1 : -1), 0.1, 0.05]), (act.t - tp) * T, 11 + q * 7, big * 0.8);
    },
  };
}

export const PIPSEED = pipKind(PIPSEED_LOOK);
export const SPRIGWING = pipKind(SPRIGWING_LOOK);
export const ARBORCREST = pipKind(ARBORCREST_LOOK);

