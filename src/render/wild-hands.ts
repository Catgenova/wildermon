import {
  add, beat, coatPalette, curve, merge, orb, orbAlong, quadBonesOf, scale, smile, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { blade, cut, pawMesh, quadPieces } from './beastkit';
import { type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';

/**
 * The settlement's own hands: the brambo (the salva is the Herbpup now,
 * `./wild-herbpup`; the kemma the Whispling, `./wild-owl`; the sheela the Shearling, `./wild-shear`;
 * the tanna the Peltling, `./wild-pelt`; the carra the Lognib, `./wild-log`).
 * Each carries the tool of its trade on its body, as every wildermon carries
 * something no field guide has: a bandaged tail.
 */

/* ---- shared by these kinds ---------------------------------------------------------- */

/** A small round muzzle out in front of the eyes with a nose on it and a mouth under. */
export function snout(at: number, z: number, r: V3, nose: number, n: number, k: number, mat: Mat = 'muzzle'): Mesh {
  const c: V3 = [0, at, z];
  return merge(
    orbAlong(c, [0, 1, -0.1], r, n, k, mat),
    orbAlong([0, at + r[2] * 0.9, z + r[1] * 0.35], [0, 1, 0.2], [nose, nose * 0.7, nose * 0.75], 6, 3, 'nose'),
    smile([0, at + r[2] * 0.75, z - r[1] * 0.55], [0, 1, -0.6], r[0] * 0.5),
  );
}

/** A tail of links, each a short tube, the tip of the last pointing back along -y. */
export function links(r: readonly number[], len: number, n: number, mat: Mat | ((ring: number, j: number) => Mat)): Mesh[] {
  return r.slice(0, -1).map((r0, q) => tube([[0, 0.1, 0], [0, 0, 0], [0, -len, 0]], [r0, r0, r[q + 1]], [r0, r0, r[q + 1]], n, mat, { seam: q === r.length - 2 ? 'start' : 'both' }));
}

const OWN = (own: Partial<Record<Mat, RGB>>) => own;


/* ---- the brambo: a coat of burrs and berries --------------------------------------- */

/**
 * A brambo: a burr-coated rummager of the hedges, round as a bush, with
 * burrs caught all over its back, a crown of berries between its ears, and
 * leaves for ears. It strips a bush clean with its mouth.
 */
const BRAMBO_SPEC: QuadSpec = { ...pawed({ high: 1.25, len: 2.2, legs: 0.62, neck: 0.3, lean: 70, swing: [20, 34], ears: [45, 25], tail: [0.3, 20, 0] }), nose: 10 };
const BRAMBO_HEAD = { c: [0, 0.35, 0.1] as V3, r: [1.05, 0.95, 0.88] as V3 };

function bramboBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = BRAMBO_HEAD;
  const berries = merge(...([[0, 0.1, 0.95], [0.2, 0.0, 0.9], [-0.2, 0.05, 0.92], [0.08, -0.15, 0.98], [-0.1, 0.25, 0.9]] as V3[]).map((c, q) => orb(c, 0.15, 6, 4, q % 2 ? 'petal' : 'bloom')));
  const face = merge(snout(1.05, -0.2, [0.4, 0.32, 0.36], 0.11, n, k), berries);
  // Burrs: little spiky balls caught in the coat, along the back and the flanks.
  const burr = (c: V3): Mesh => merge(orb(c, 0.12, 5, 3, 'bark'), ...[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]].map((d) => taper([c, add(c, scale(d as V3, 0.22))], 0.04, 0.005, 3, 'bark')));
  const spots: V3[] = [];
  for (const y of [-0.8, -0.35, 0.1, 0.55]) for (const a of [-0.9, -0.3, 0.3, 0.9]) spots.push([Math.sin(a) * 1.05, y, 0.15 + Math.cos(a) * 0.85]);
  const burrs = merge(...spots.map((c, q) => burr(add(c, [0, (q % 3) * 0.06, 0]))));
  const ear = merge(
    tube([[0, 0, -0.05], [0, 0, 0.12]], 0.05, 0.05, 5, 'stem', { seam: 'start' }),
    blade(curve([0, 0, 0.1], [0, -0.04, 0.36], [0, 0, 0.6], 4), [0.06, 0.18, 0.2, 0.12, 0.02], [0, 1, 0], { twist: -0.8, fold: 0.26, mat: 'leaf', rib: 'leafDark' }),
  );
  return quadPieces({
    n, k,
    body: { y: [-1.25, -1.0, -0.5, 0.05, 0.6, 0.95, 1.15], z: [0.1, 0.12, 0.15, 0.17, 0.18, 0.2, 0.22], w: [0.3, 1.0, 1.15, 1.18, 1.12, 0.96, 0.3], h: [0.28, 0.84, 0.96, 0.98, 0.92, 0.8, 0.28], belly: true },
    neck: { w: 0.66, h: 0.64, len: 0.3 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.74, 0.52, 0.32], size: 0.31, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.19] },
    ear,
    earTurn: 25,
    tail: [taper([[0, 0.05, 0], [0, -0.3, 0]], 0.14, 0.06, n, 'coat')],
    fore: { upper: [0.24, -0.32, 0.26, 0.22], lower: [0, -0.3, 0.22, 0.2], foot: pawMesh(0.22, n, k, 'mark') },
    hind: { upper: [0.26, -0.34, 0.28, 0.24], lower: [0, -0.32, 0.22, 0.2], foot: pawMesh(0.22, n, k, 'mark') },
    extras: [{ key: 'burrs', mesh: burrs, bone: 'trunk', bias: 0.04, after: ['body'] }],
  }).map((pc) => (pc.key === 'ear0' || pc.key === 'ear1' ? { ...pc, thin: true, airy: true } : pc));
}

export const BRAMBO: Kind = {
  bones: quadBonesOf(BRAMBO_SPEC, (p, a) => {
    trot(p, a);
    // A waddle, and standing, a shake now and then that rattles every burr on it.
    p.roll += a.go * 3 * Math.sin((a.u % 1) * TAU);
    if (a.go <= 0) p.roll += 7 * Math.sin(a.t * TAU * 5) * beat(a.t, [8.2, 20.6], 0.7);
  }),
  build: bramboBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ bark: [120, 88, 60], petal: [130, 40, 90], bloom: [190, 40, 60], leaf: [140, 196, 110], leafDark: [96, 150, 80], stem: [120, 140, 90] }), 30),
  shadow: [1.5, 1.25],
  stride: 1.4,
  size: 1.65,
};
