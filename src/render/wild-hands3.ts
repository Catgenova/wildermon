import {
  beat, coatPalette, curve, merge, orb, quadBonesOf, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { blade, cut, earMesh, quadPieces } from './beastkit';
import { type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { snout } from './wild-hands';
import { barrel, OWN, paws } from './wild-hands2';

/**
 * Four more of the settlement's hands: the chissa, the cordra, the flecha
 * and the glossa. As with the others (`./wild-hands`, `./wild-hands2`), each
 * wears the tool of its trade: a chisel, a rope, an arrow and a glazing brush.
 * The mudda is the Sliplet now (`./wild-clayroll`), the dippa the Pailbara
 * (`./wild-capy`), the rippa the Logkit (`./wild-timber`) and the papra the
 * Reedling (`./wild-papyrus`).
 */

/** A tail's root, out of the body, before the tool on the end of it. */
const root = (n: number): ReturnType<typeof taper> => taper([[0, 0.05, 0], [0, -0.25, 0]], 0.12, 0.09, n, 'coat');

/* ---- the chissa: a chisel of a tooth, a mallet for a tail ---------------------------- */

const CHISSA_SPEC: QuadSpec = { ...pawed({ high: 1.15, len: 2.2, legs: 0.6, neck: 0.3, lean: 60, swing: [20, 34], ears: [40, 18], tail: [0.4, 6, 2] }), nose: 10 };
const CHISSA_HEAD = { c: [0, 0.35, 0.1] as V3, r: [1.08, 1.0, 0.9] as V3 };

function chissaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = CHISSA_HEAD;
  // One broad front tooth, ground flat at the end like a chisel.
  const tooth = tube([[0, 1.36, -0.3], [0, 1.4, -0.52], [0, 1.42, -0.7]], [0.17, 0.17, 0.16], [0.07, 0.06, 0.03], 4, 'tooth', { up: [0, 1, 0] });
  // A mallet on the end of the tail: a short haft and a round wooden head.
  const mallet = merge(
    root(n),
    tube([[0, -0.25, 0], [0, -0.6, 0.02]], 0.06, 0.06, 5, 'wood'),
    tube([[-0.22, -0.72, 0.04], [0.22, -0.72, 0.04]], 0.18, 0.18, 8, 'woodDark'),
  );
  return quadPieces({
    n, k,
    body: barrel(2.3, 1.25, 0.95, 0.08),
    neck: { w: 0.72, h: 0.7, len: 0.3 },
    head: { c: H.c, r: H.r, face: merge(snout(1.02, -0.2, [0.44, 0.32, 0.38], 0.12, n, k), tooth), eye: { dir: [0.74, 0.52, 0.32], size: 0.28, rim: 0.12 } },
    ear: earMesh(0.32, 0.26, n),
    earTurn: 35,
    tail: [mallet],
    ...paws(n, k, 0.6, 0.3, 0.26, 'coatDark'),
  });
}

export const CHISSA: Kind = {
  bones: quadBonesOf(CHISSA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it taps: the mallet brought down now and then.
    if (a.go <= 0) p.tail[1] -= 22 * Math.max(0, Math.sin(a.t * TAU * 2)) * beat(a.t, [4.6, 14.2], 2);
  }),
  build: chissaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ wood: [168, 128, 86], woodDark: [128, 92, 60] }), 210),
  shadow: [1.55, 1.3],
  stride: 1.3,
  size: 1.65,
};

/* ---- the cordra: a tail of two strands laid up into a rope --------------------------- */

const CORDRA_SPEC: QuadSpec = { ...pawed({ high: 1.35, len: 2.2, legs: 0.8, neck: 0.35, lean: 40, swing: [24, 40], ears: [30, 22], tail: [0.6, 16, 10] }), nose: 12 };
const CORDRA_HEAD = { c: [0, 0.3, 0.18] as V3, r: [0.98, 0.94, 0.88] as V3 };

function cordraBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = CORDRA_HEAD;
  // Two strands twisted about each other, two turns of lay, a knot at the end.
  const strand = (phase: number, mat: 'coat' | 'coatLight') => tube(
    Array.from({ length: 9 }, (_, i): V3 => {
      const t = i / 8, a = phase + t * TAU * 2;
      return [Math.cos(a) * 0.07, -0.1 - t * 1.35, Math.sin(a) * 0.07];
    }), 0.075, 0.075, 5, mat);
  const rope = merge(root(n), strand(0, 'coat'), strand(Math.PI, 'coatLight'), orb([0, -1.5, 0], 0.13, 6, 4, 'coatDark'));
  return quadPieces({
    n, k,
    body: barrel(2.3, 1.0, 0.85),
    neck: { w: 0.6, h: 0.6, len: 0.35 },
    head: { c: H.c, r: H.r, face: snout(1.0, -0.18, [0.4, 0.3, 0.34], 0.11, n, k), eye: { dir: [0.74, 0.52, 0.36], size: 0.3, rim: 0.12 } },
    ear: earMesh(0.38, 0.22, n),
    earTurn: 35,
    tail: [rope],
    ...paws(n, k, 0.8, 0.25, 0.22, 'coatDark'),
  });
}

export const CORDRA: Kind = {
  bones: quadBonesOf(CORDRA_SPEC, trot),
  build: cordraBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({}), 40),
  shadow: [1.5, 1.15],
  stride: 1.4,
  size: 1.65,
};

/* ---- the flecha: a crest of barred feathers, an arrow for a tail ---------------------- */

const FLECHA_SPEC: QuadSpec = { ...pawed({ high: 1.45, len: 2.0, legs: 0.9, neck: 0.4, lean: 30, swing: [26, 42], ears: [25, 25], tail: [0.4, 14, 8] }), nose: 12 };
const FLECHA_HEAD = { c: [0, 0.28, 0.22] as V3, r: [0.96, 0.94, 0.88] as V3 };

function flechaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = FLECHA_HEAD;
  // A crest of stiff feathers swept back off the crown, each barred.
  const crest = merge(...[-0.16, 0, 0.16].map((x, q) => blade(
    curve([x, 0.15, 0.95], [x * 1.3, -0.15, 1.3], [x * 1.6, -0.55, 1.5 - q % 2 * 0.08], 4), [0.04, 0.1, 0.09, 0.05, 0.01], [1, 0, 0],
    { fold: 0.1, mat: q % 2 ? 'featherDark' : 'feather', rib: 'featherDark' })));
  // An arrow for a tail: the shaft, a head at the root and the fletching at the far end.
  const arrow = merge(
    root(n),
    tube([[0, -0.2, 0], [0, -1.35, 0.02]], 0.04, 0.04, 5, 'wood'),
    ...[0, TAU / 3, (2 * TAU) / 3].map((a) => blade(
      curve([0, -1.0, 0.02], [Math.cos(a) * 0.12, -1.18, 0.02 + Math.sin(a) * 0.12], [Math.cos(a) * 0.04, -1.38, 0.02 + Math.sin(a) * 0.04], 3),
      [0.02, 0.07, 0.05, 0.01], [Math.sin(a), 0, -Math.cos(a)], { mat: 'feather' })),
  );
  return quadPieces({
    n, k,
    body: barrel(2.1, 0.95, 0.82),
    neck: { w: 0.56, h: 0.58, len: 0.4 },
    head: { c: H.c, r: H.r, face: snout(0.98, -0.16, [0.36, 0.34, 0.3], 0.1, n, k), eye: { dir: [0.72, 0.56, 0.36], size: 0.33, rim: 0.12 } },
    ear: earMesh(0.3, 0.2, n),
    earTurn: 35,
    tail: [arrow],
    ...paws(n, k, 0.9, 0.23, 0.21, 'coatDark'),
    extras: [{ key: 'crest', mesh: crest, bone: 'head', bias: 0.05, after: ['head'], thin: true }],
  });
}

export const FLECHA: Kind = {
  bones: quadBonesOf(FLECHA_SPEC, trot),
  build: flechaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ wood: [176, 140, 96], feather: [236, 228, 214], featherDark: [92, 72, 60] }), 30),
  shadow: [1.4, 1.1],
  stride: 1.5,
  size: 1.6,
};

/* ---- the glossa: a glazed bowl for a hat, a brush for a tail -------------------------- */

const GLOSSA_SPEC: QuadSpec = { ...pawed({ high: 1.3, len: 2.1, legs: 0.7, neck: 0.32, lean: 50, swing: [22, 36], ears: [35, 22], tail: [0.45, 20, 10] }), nose: 12 };
const GLOSSA_HEAD = { c: [0, 0.32, 0.14] as V3, r: [1.04, 0.98, 0.9] as V3 };

function glossaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = GLOSSA_HEAD;
  // A small glazed bowl upside down on its crown.
  const bowl = merge(
    tube([[0, 0.1, 0.86], [0, 0.1, 1.04], [0, 0.1, 1.16]], [0.36, 0.3, 0.12], [0.36, 0.3, 0.12], 10, 'crystal', { seam: 'end' }),
    orb([0.12, 0.2, 1.06], 0.05, 4, 3, 'glint'),
  );
  // A glazing brush: a haft and a soft tuft dipped in the slip.
  const brush = merge(
    root(n),
    tube([[0, -0.22, 0], [0, -0.75, 0.02]], 0.05, 0.05, 5, 'wood'),
    taper([[0, -0.72, 0.02], [0, -0.92, 0.02], [0, -1.08, 0.03]], 0.13, 0.05, 6, 'crystalDark'),
  );
  return quadPieces({
    n, k,
    body: barrel(2.2, 1.1, 0.9),
    neck: { w: 0.64, h: 0.64, len: 0.32 },
    head: { c: H.c, r: H.r, face: merge(snout(1.02, -0.2, [0.42, 0.32, 0.36], 0.12, n, k), bowl), eye: { dir: [0.74, 0.52, 0.34], size: 0.31, rim: 0.12 } },
    ear: earMesh(0.34, 0.24, n),
    earTurn: 35,
    tail: [brush],
    ...paws(n, k, 0.7, 0.27, 0.24, 'coatDark'),
  });
}

export const GLOSSA: Kind = {
  bones: quadBonesOf(GLOSSA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it brushes: the tail drawn slowly across.
    if (a.go <= 0) p.tail[1] += 18 * Math.sin(a.t * TAU * 0.9) * beat(a.t, [5.6, 16.3], 3);
  }),
  build: glossaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ crystal: [86, 140, 176], crystalDark: [60, 104, 136], glint: [236, 246, 255], wood: [160, 116, 76] }), 200),
  shadow: [1.5, 1.2],
  stride: 1.35,
  size: 1.65,
};
