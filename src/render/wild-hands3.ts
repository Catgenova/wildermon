import {
  beat, coatPalette, merge, quadBonesOf, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { cut, earMesh, quadPieces } from './beastkit';
import { type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { snout } from './wild-hands';
import { barrel, OWN, paws } from './wild-hands2';

/**
 * One more of the settlement's hands: the chissa (the cordra is gone, `REMOVED_KINDS`). As
 * with the others (`./wild-hands`, `./wild-hands2`), it wears the tool of its
 * trade: a chisel. The mudda is the Sliplet now
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

