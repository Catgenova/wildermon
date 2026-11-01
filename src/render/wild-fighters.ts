import {
  coatPalette, curve, merge, moved, quadBonesOf, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { cut, earMesh, quadPieces } from './beastkit';
import { type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { snout } from './wild-hands';
import { barrel, OWN, paws } from './wild-hands2';

/**
 * One that fought, a settlement worker now: the spitta, which wears how it
 * fought (`FightStyle`): bands and a forked tongue. The thumpa is the crag
 * line (`./wild-crag`), the sparra the dummy line (`./wild-dummy`), the awla
 * the spiral line (`./wild-spiral`).
 */

/* ---- the spitta: bands down its back, a forked tongue -------------------------------- */

const SPITTA_SPEC: QuadSpec = { ...pawed({ high: 1.0, len: 2.5, legs: 0.5, neck: 0.45, lean: 70, swing: [24, 40], ears: [70, 6], tail: [0.8, -8, 6] }), nose: 10 };
const SPITTA_HEAD = { c: [0, 0.38, 0.05] as V3, r: [0.86, 1.0, 0.72] as V3 };

function spittaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = SPITTA_HEAD;
  // A forked tongue out past the snout.
  const tongue = merge(
    tube([[0, 1.25, -0.3], [0, 1.55, -0.32]], 0.04, 0.015, 4, 'tongue'),
    ...[-1, 1].map((s) => tube([[0, 1.55, -0.32], [s * 0.08, 1.72, -0.3]], 0.025, 0.012, 3, 'tongue')),
  );
  // Bands across its back.
  const bands = merge(...[-0.9, -0.45, 0, 0.45].map((y) => moved(tube([[-0.55, 0, 0], [0.55, 0, 0]], 0.12, 0.02, 4, 'coatDark', { up: [0, 0, 1] }), [0, y, 0.68])));
  return quadPieces({
    n, k,
    body: barrel(2.5, 0.95, 0.68, 0.02),
    neck: { w: 0.5, h: 0.48, len: 0.45 },
    head: { c: H.c, r: H.r, face: merge(snout(1.0, -0.18, [0.36, 0.34, 0.26], 0.08, n, k), tongue), eye: { dir: [0.66, 0.6, 0.34], size: 0.25, rim: 0.12 } },
    ear: earMesh(0.18, 0.16, n),
    earTurn: 70,
    tail: [tube(curve([0, 0.05, 0], [0.1, -0.7, -0.04], [-0.05, -1.5, 0], 5), [0.13, 0.09, 0.02], [0.12, 0.08, 0.02], 6, 'coat')],
    ...paws(n, k, 0.5, 0.22, 0.2, 'coatDark'),
    extras: [{ key: 'bands', mesh: bands, bone: 'trunk', bias: 0.05, after: ['body'], thin: true }],
  });
}

export const SPITTA: Kind = {
  bones: quadBonesOf(SPITTA_SPEC, trot),
  build: spittaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ tongue: [200, 70, 90] }), 60),
  shadow: [1.5, 0.95],
  stride: 1.5,
  size: 1.55,
};
