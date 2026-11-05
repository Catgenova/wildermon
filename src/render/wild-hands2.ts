import {
  add, coatPalette, cyc, disc, merge, orbAlong, paint, quadBonesOf, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { cut, earMesh, pawMesh, quadPieces, type QuadLook } from './beastkit';
import { type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { links } from './wild-hands';

/**
 * More of the settlement's hands: the cindra and the hoppa (the forga is gone, `REMOVED_KINDS`)
 * (the simma is the Brothlet now, `./wild-broth`, the scurra is the Wallkit now, `./wild-wall`, the bedda
 * the Sprigkit, `./wild-calico`, the petta the Briarling, `./wild-goat`, the potta the
 * Kilnlet, `./wild-kiln`, the
 * ambra the Saplet, `./wild-maple`, the relka the Kintsu, `./wild-relic`,
 * the sprigga the Lemlet, `./wild-lemur`, and the wurla the Pebblebeak,
 * `./wild-curlew`). As with
 * the first ten (`./wild-hands`), each wears the tool of its trade: tongs
 * for a tail, a spoon, a trowel.
 */

/* ---- shared by these kinds ---------------------------------------------------------- */

export const OWN = (own: Partial<Record<Mat, RGB>>): Partial<Record<Mat, RGB>> => own;

/** A round body of rings, `len` long, `w` wide and `h` deep at its widest, its back rising `rise` toward the shoulders. */
export function barrel(len: number, w: number, h: number, rise = 0.12): QuadLook['body'] {
  const ys = [-0.5, -0.4, -0.2, 0.04, 0.26, 0.42, 0.5].map((f) => f * len);
  const k = [0.25, 0.82, 0.96, 1, 0.95, 0.8, 0.26];
  return { y: ys, z: ys.map((_, q) => 0.08 + rise * (q / 6)), w: k.map((f) => f * w), h: k.map((f) => f * h), belly: true };
}

/** The usual four paws, `r` across, the legs `legs` long and `thick` thick. */
export function paws(n: number, k: number, legs: number, thick: number, r: number, mat: Mat = 'coatLight'): Pick<QuadLook, 'fore' | 'hind'> {
  return {
    fore: { upper: [0.26, -legs * 0.5, thick, thick * 0.86], lower: [0, -legs * 0.46, thick * 0.86, thick * 0.78], foot: pawMesh(r, n, k, mat) },
    hind: { upper: [0.28, -legs * 0.52, thick * 1.1, thick * 0.94], lower: [0, -legs * 0.48, thick * 0.86, thick * 0.78], foot: pawMesh(r, n, k, mat) },
  };
}

/* ---- the hoppa: a cork for a nose and hops for a crown ------------------------------ */

const HOPPA_SPEC: QuadSpec = { ...pawed({ high: 1.3, len: 2.2, legs: 0.7, neck: 0.3, lean: 50, swing: [22, 36], ears: [40, 20], tail: [0.35, 30, 10] }), nose: 12 };
const HOPPA_HEAD = { c: [0, 0.3, 0.15] as V3, r: [1.08, 1.0, 0.92] as V3 };

function hoppaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = HOPPA_HEAD;
  // A cork for a nose, and a crown of hop cones between its ears.
  const cork = tube([[0, 1.0, -0.15], [0, 1.4, -0.2]], [0.22, 0.2], [0.22, 0.2], 8, 'wood', { seam: 'end' });
  const hop = (c: V3): Mesh => merge(...[0, 1, 2].map((q) => orbAlong(add(c, [0, 0, -q * 0.07]), [0, 0, 1], [0.12 - q * 0.02, 0.12 - q * 0.02, 0.1], 6, 3, q % 2 ? 'leafDark' : 'leaf')));
  const hops = merge(hop([0, 0.05, 1.0]), hop([0.2, -0.05, 0.94]), hop([-0.2, -0.05, 0.94]));
  return quadPieces({
    n, k,
    body: barrel(2.4, 1.3, 1.05, 0.05),
    neck: { w: 0.66, h: 0.66, len: 0.3 },
    head: { c: H.c, r: H.r, face: merge(cork, paint([disc([0, 1.405, -0.2], [0, 1, 0], 0.18, 0.18, 8, 'woodDark')]), hops), eye: { dir: [0.74, 0.52, 0.34], size: 0.31, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.21] },
    ear: earMesh(0.38, 0.28, n),
    earTurn: 35,
    tail: links([0.16, 0.12, 0.06], 0.25, n, 'coat'),
    ...paws(n, k, 0.7, 0.28, 0.24, 'mark'),
  });
}

export const HOPPA: Kind = {
  bones: quadBonesOf(HOPPA_SPEC, (p, a) => {
    trot(p, a);
    // A merry roll as it goes, and standing, a sway as if to a tune.
    p.roll += a.go * 3 * Math.sin((a.u % 1) * TAU);
    if (a.go <= 0) p.roll += 4 * cyc(a.t, 3);
  }),
  build: hoppaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ wood: [196, 160, 112], woodDark: [150, 116, 80], leaf: [176, 214, 120], leafDark: [128, 170, 90] }), 40),
  shadow: [1.5, 1.35],
  stride: 1.35,
  size: 1.6,
};

