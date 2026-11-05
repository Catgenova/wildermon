import {
  coatPalette, merge, orb, quadBonesOf, taper, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { cut, earMesh, quadPieces } from './beastkit';
import { type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { snout } from './wild-hands';
import { barrel, OWN, paws } from './wild-hands2';

/**
 * Six that had an ability of their own (`AbilityId`), settlement workers now: each wears what it
 * did -- a whirl of blades, embers, icicles, tendrils, a round sucking
 * mouth for a leech (the brittla, a brittle shell, is gone: `REMOVED_KINDS`).
 */

/** A tail's root, out of the body, before what is on the end of it. */
const root = (n: number): Mesh => taper([[0, 0.05, 0], [0, -0.25, 0]], 0.12, 0.09, n, 'coat');

/** How a kind here looks, in the few numbers each differs by, and what it wears. */
interface Look {
  spec: QuadSpec;
  head: { c: V3; r: V3 };
  /** The body's length, width, depth, and how far its back rises to the shoulders. */
  body: [number, number, number, number?];
  /** The neck's width, depth and length. */
  neck: [number, number, number];
  /** The ears' length, width and turn. */
  ear: [number, number, number];
  /** The legs' length and thickness, the paw across, and what the paws are. */
  legs: [number, number, number, Mat];
  /** The snout: how far forward, how low, its radii, the nose. */
  snout: [number, number, V3, number];
  face?: (n: number, k: number) => Mesh;
  tail: (n: number, k: number) => Mesh;
  /** What it wears on its back, on the trunk. */
  back?: (n: number, k: number) => Mesh;
  thin?: boolean;
  own: Partial<Record<Mat, RGB>>;
  mark: number;
  shadow: [number, number];
  stride: number;
  size: number;
}

function kindOf(l: Look): Kind {
  const build = (lod: number): Piece[] => {
    const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
    const [at, z, r, nose] = l.snout;
    const face = snout(at, z, r, nose, n, k);
    return quadPieces({
      n, k,
      body: barrel(l.body[0], l.body[1], l.body[2], l.body[3]),
      neck: { w: l.neck[0], h: l.neck[1], len: l.neck[2] },
      head: { c: l.head.c, r: l.head.r, face: l.face ? merge(face, l.face(n, k)) : face, eye: { dir: [0.74, 0.52, 0.34], size: 0.29, rim: 0.12 } },
      ear: earMesh(l.ear[0], l.ear[1], n),
      earTurn: l.ear[2],
      tail: [l.tail(n, k)],
      ...paws(n, k, l.legs[0], l.legs[1], l.legs[2], l.legs[3]),
      extras: l.back ? [{ key: 'back', mesh: l.back(n, k), bone: 'trunk', bias: 0.05, after: ['body'], thin: l.thin }] : [],
    });
  };
  return {
    bones: quadBonesOf(l.spec, trot),
    build,
    palette: (coat, mark) => coatPalette(coat, mark, OWN(l.own), l.mark),
    shadow: l.shadow,
    stride: l.stride,
    size: l.size,
  };
}

const HEAD = (y: number, z: number, r: V3): { c: V3; r: V3 } => ({ c: [0, y, z], r });

/* ---- the scorcha: embers on its back, a flame at its tail ---------------------------- */

export const SCORCHA = kindOf({
  spec: { ...pawed({ high: 1.3, len: 2.2, legs: 0.75, neck: 0.34, lean: 50, swing: [22, 36], ears: [35, 22], tail: [0.45, 20, 8] }), nose: 12 },
  head: HEAD(0.32, 0.14, [1.0, 0.96, 0.88]), body: [2.2, 1.05, 0.88], neck: [0.6, 0.6, 0.34], ear: [0.32, 0.24, 35], legs: [0.75, 0.25, 0.23, 'coatDark'],
  snout: [1.0, -0.2, [0.4, 0.32, 0.34], 0.11],
  back: () => merge(...[[-0.7, 0.2], [-0.3, -0.25], [0.1, 0.2], [0.45, -0.2], [-0.05, 0]].map(([y, x]) => orb([x, y, 0.82], 0.11, 5, 3, 'ember'))),
  tail: (n) => merge(root(n), tube([[0, -0.2, 0], [0, -0.75, 0.15]], 0.08, 0.08, 5, 'coat'),
    taper([[0, -0.75, 0.15], [0, -0.95, 0.45]], 0.16, 0.01, 5, 'flame')),
  own: { ember: [255, 140, 50], flame: [255, 196, 80] }, mark: 30, shadow: [1.5, 1.2], stride: 1.4, size: 1.65,
});

