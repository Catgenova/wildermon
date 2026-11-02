import {
  beat, coatPalette, merge, orb, quadBonesOf, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { cut, earMesh, quadPieces } from './beastkit';
import { type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { snout } from './wild-hands';
import { barrel, OWN, paws } from './wild-hands2';

/**
 * Two more of the settlement's hands: the chissa and the cordra. As with
 * the others (`./wild-hands`, `./wild-hands2`), each wears the tool of its
 * trade: a chisel and a rope. The mudda is the Sliplet now
 * (`./wild-clayroll`), the dippa the Pailbara (`./wild-capy`), the rippa the
 * Logkit (`./wild-timber`), the papra the Reedling (`./wild-papyrus`), the
 * flecha the Sablekit (`./wild-sable`) and the glossa the Mortarshell
 * (`./wild-mortoise`).
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
