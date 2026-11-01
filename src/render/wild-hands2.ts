import {
  add, beat, coatPalette, curve, cyc, disc, merge, moved, orb, orbAlong, paint, quadBonesOf, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { blade, cut, earMesh, pawMesh, quadPieces, type QuadLook } from './beastkit';
import { place, type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { links, snout } from './wild-hands';

/**
 * More of the settlement's hands: the forga, the cindra, the hoppa,
 * and the simma (the scurra is the Wallkit now, `./wild-wall`, the bedda
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

/* ---- the forga: tongs for a tail, a bellows for a chest ----------------------------- */

const FORGA_SPEC: QuadSpec = { ...pawed({ high: 1.4, len: 2.4, legs: 0.75, neck: 0.35, lean: 60, swing: [20, 34], ears: [35, 15], tail: [0.5, 20, 6] }), nose: 12 };
const FORGA_HEAD = { c: [0, 0.35, 0.12] as V3, r: [1.1, 1.0, 0.92] as V3 };

function forgaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = FORGA_HEAD;
  // The tongs: two iron arms off a rivet, their jaws a little open.
  const tongs = merge(
    taper([[0, 0.05, 0], [0, -0.25, 0]], 0.13, 0.09, n, 'coat'),
    orb([0, -0.3, 0], 0.08, 6, 4, 'metal'),
    ...[-1, 1].map((s) => tube(curve([0, -0.3, 0], [s * 0.18, -0.75, 0.02], [s * 0.08, -1.25, 0.08], 4), 0.07, 0.06, 5, 'metalDark')),
  );
  // The bellows on its chest: two boards with a leather pleat between, its nozzle pointing down.
  const bellows = merge(
    tube([[0, 0, 0.32], [0, 0, -0.32]], 0.42, 0.06, 8, 'wood', { up: [0, 1, 0] }),
    tube([[0, -0.1, 0.28], [0, -0.1, -0.28]], 0.36, 0.08, 8, 'leather', { up: [0, 1, 0] }),
    taper([[0, 0, -0.32], [0, 0, -0.55]], 0.06, 0.03, 5, 'metal'),
  );
  return quadPieces({
    n, k,
    body: barrel(2.7, 1.25, 0.95),
    neck: { w: 0.7, h: 0.7, len: 0.35 },
    head: { c: H.c, r: H.r, face: snout(1.05, -0.2, [0.44, 0.32, 0.38], 0.12, n, k), eye: { dir: [0.74, 0.52, 0.34], size: 0.3, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.18] },
    ear: earMesh(0.36, 0.26, n),
    earTurn: 35,
    tail: [tongs],
    ...paws(n, k, 0.75, 0.3, 0.25, 'coatDark'),
    extras: [{ key: 'bellows', mesh: moved(bellows, [0, 1.25, -0.15]), bone: 'trunk', bias: 0.05, after: ['body'] }],
  });
}

export const FORGA: Kind = {
  bones: quadBonesOf(FORGA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it pumps its chest now and then, as a bellows is worked.
    if (a.go <= 0) p.squash += 0.05 * Math.max(0, Math.sin(a.t * TAU * 1.5)) * beat(a.t, [5.2, 15.1], 2.4);
  }),
  build: forgaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ metal: [150, 150, 158], metalDark: [96, 98, 108], wood: [150, 104, 70], leather: [120, 80, 52] }), 20),
  glow: (b, a) => [{ p: place(b.trunk, [0, 0, 0.9]), r: 0.7, c: [255, 150, 70] as RGB, a: 0.12 + 0.05 * Math.sin(a.t * Math.PI * 3) }],
  shadow: [1.6, 1.3],
  stride: 1.35,
  size: 1.75,
};

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

/* ---- the simma: a wooden spoon for a tail ------------------------------------------- */

const SIMMA_SPEC: QuadSpec = { ...pawed({ high: 1.3, len: 2.3, legs: 0.7, neck: 0.3, lean: 50, swing: [22, 36], ears: [35, 20], tail: [0.5, 40, 12] }), nose: 12 };
const SIMMA_HEAD = { c: [0, 0.3, 0.15] as V3, r: [1.08, 1.0, 0.92] as V3 };

function simmaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = SIMMA_HEAD;
  // A wooden spoon: a long handle and a round bowl at the end, held up behind.
  const spoon = merge(
    taper([[0, 0.05, 0], [0, -0.25, 0]], 0.13, 0.08, n, 'coat'),
    tube([[0, -0.25, 0], [0, -0.75, 0.02]], 0.05, 0.045, 6, 'wood'),
    orbAlong([0, -0.95, 0.03], [0, 1, 0], [0.2, 0.08, 0.26], 8, 4, 'wood'),
    paint([disc([0, -0.95, 0.115], [0, 0, 1], 0.15, 0.2, 8, 'woodDark')]),
  );
  // A white kerchief tied round its neck.
  const kerchief = merge(tube([[0, 0, 0.0], [0, 0, 0.12]], 0.4, 0.4, 10, 'cap', { seam: 'both' }), blade(curve([0, 0.3, -0.05], [0, 0.42, -0.25], [0, 0.4, -0.45], 3), [0.14, 0.2, 0.12, 0.02], [0, 1, -0.3], { mat: 'cap' }));
  return quadPieces({
    n, k,
    body: barrel(2.4, 1.25, 1.0, 0.06),
    neck: { w: 0.66, h: 0.66, len: 0.3 },
    head: { c: H.c, r: H.r, face: snout(1.05, -0.22, [0.42, 0.32, 0.36], 0.12, n, k), eye: { dir: [0.74, 0.52, 0.34], size: 0.31, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.22] },
    ear: earMesh(0.4, 0.28, n),
    earTurn: 35,
    tail: [spoon],
    ...paws(n, k, 0.7, 0.28, 0.24, 'coatLight'),
    extras: [{ key: 'kerchief', mesh: kerchief, bone: 'neck', bias: 0.05, after: ['body', 'neck'] }],
  });
}

export const SIMMA: Kind = {
  bones: quadBonesOf(SIMMA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it stirs: the spoon going round.
    if (a.go <= 0) {
      const stir = beat(a.t, [3.6, 12.2, 19.8], 2.4);
      p.tail[1] += 18 * Math.sin(a.t * TAU * 1.2) * stir;
      p.tail[0] += 10 * Math.cos(a.t * TAU * 1.2) * stir;
    }
  }),
  build: simmaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ wood: [190, 140, 92], woodDark: [140, 100, 66], cap: [250, 248, 240] }), 30),
  shadow: [1.5, 1.3],
  stride: 1.35,
  size: 1.6,
};
