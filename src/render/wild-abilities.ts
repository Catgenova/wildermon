import {
  coatPalette, curve, disc, merge, moved, orb, paint, quadBonesOf, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { blade, cut, earMesh, quadPieces } from './beastkit';
import { type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { snout } from './wild-hands';
import { barrel, OWN, paws } from './wild-hands2';

/**
 * Seventeen with an ability of their own (`AbilityId`): each wears what it
 * does -- a coiled spring of a tail for a pounce, a boulder of a skull for a
 * skull crack, a scythe for an execute, embers, icicles, tendrils, a ring of
 * shimmer for a ward, a round sucking mouth for a leech.
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

/* ---- the lungra: a coiled spring of a tail ------------------------------------------- */

export const LUNGRA = kindOf({
  spec: { ...pawed({ high: 1.45, len: 2.3, legs: 0.9, neck: 0.38, lean: 35, swing: [26, 44], ears: [20, 30], tail: [0.5, 10, 6] }), nose: 12 },
  head: HEAD(0.3, 0.18, [0.98, 0.96, 0.88]), body: [2.3, 1.0, 0.9], neck: [0.6, 0.6, 0.38], ear: [0.42, 0.22, 20], legs: [0.9, 0.26, 0.24, 'coatDark'],
  snout: [1.0, -0.18, [0.38, 0.32, 0.34], 0.11],
  tail: (n) => merge(root(n), tube(Array.from({ length: 13 }, (_, i): V3 => {
    const a = (i / 12) * TAU * 2.5;
    return [Math.cos(a) * 0.16, -0.2 - i * 0.07, Math.sin(a) * 0.16 + 0.05];
  }), 0.06, 0.06, 5, 'coat')),
  own: {}, mark: 30, shadow: [1.5, 1.15], stride: 1.55, size: 1.7,
});

/* ---- the hamma: sickle hooks on its tail --------------------------------------------- */

export const HAMMA = kindOf({
  spec: { ...pawed({ high: 1.05, len: 2.5, legs: 0.6, neck: 0.38, lean: 70, swing: [24, 40], ears: [20, 30], tail: [0.55, 2, 4] }), nose: 12 },
  head: HEAD(0.34, 0.08, [0.9, 1.0, 0.8]), body: [2.5, 0.95, 0.75, 0.04], neck: [0.54, 0.52, 0.38], ear: [0.34, 0.2, 20], legs: [0.6, 0.24, 0.22, 'coatDark'],
  snout: [1.04, -0.16, [0.36, 0.36, 0.3], 0.1],
  tail: (n) => merge(root(n), tube([[0, -0.2, 0], [0, -0.8, 0.04]], 0.08, 0.08, 5, 'coat'),
    ...[-1, 1].map((s) => tube(curve([0, -0.8, 0.04], [s * 0.25, -1.0, 0.0], [s * 0.1, -1.2, -0.12], 4), [0.06, 0.04, 0.01], [0.03, 0.02, 0.01], 4, 'hornDark'))),
  own: { hornDark: [70, 66, 60] }, mark: 30, shadow: [1.55, 1.05], stride: 1.5, size: 1.6,
});

/* ---- the crakka: a boulder of a skull ------------------------------------------------ */

export const CRAKKA = kindOf({
  spec: { ...pawed({ high: 1.35, len: 2.4, legs: 0.72, neck: 0.32, lean: 55, swing: [18, 30], ears: [45, 15], tail: [0.4, 6, 2] }), nose: 10 },
  head: HEAD(0.35, 0.1, [1.1, 1.0, 0.95]), body: [2.4, 1.35, 1.05, 0.2], neck: [0.78, 0.76, 0.32], ear: [0.26, 0.24, 45], legs: [0.72, 0.33, 0.3, 'coatDark'],
  snout: [1.02, -0.24, [0.44, 0.3, 0.36], 0.12],
  face: (n, k) => merge(orb([0, 0.45, 0.72], [0.72, 0.62, 0.42], n, k, 'stone'), orb([0.25, 0.75, 0.82], 0.12, 5, 3, 'stoneDark')),
  tail: (n) => taper([[0, 0.05, 0], [0, -0.45, 0.05]], 0.15, 0.05, n, 'coat'),
  own: { stone: [150, 140, 126], stoneDark: [104, 96, 86] }, mark: 30, shadow: [1.7, 1.35], stride: 1.3, size: 1.8,
});

/* ---- the bashka: a plate of bone across its brow ------------------------------------- */

export const BASHKA = kindOf({
  spec: { ...pawed({ high: 1.3, len: 2.4, legs: 0.7, neck: 0.32, lean: 55, swing: [18, 30], ears: [45, 18], tail: [0.4, 6, 2] }), nose: 10 },
  head: HEAD(0.35, 0.1, [1.08, 1.0, 0.92]), body: [2.4, 1.35, 1.0, 0.15], neck: [0.76, 0.74, 0.32], ear: [0.28, 0.24, 45], legs: [0.7, 0.32, 0.29, 'coatDark'],
  snout: [1.02, -0.24, [0.44, 0.3, 0.36], 0.12],
  face: (n, k) => orb([0, 0.62, 0.62], [0.82, 0.32, 0.36], n, k, 'horn'),
  tail: (n) => taper([[0, 0.05, 0], [0, -0.45, 0.05]], 0.14, 0.05, n, 'coat'),
  own: { horn: [222, 212, 190] }, mark: 30, shadow: [1.7, 1.35], stride: 1.3, size: 1.75,
});

/* ---- the executa: a scythe for a tail ------------------------------------------------ */

export const EXECUTA = kindOf({
  spec: { ...pawed({ high: 1.4, len: 2.2, legs: 0.85, neck: 0.42, lean: 40, swing: [22, 38], ears: [25, 25], tail: [0.55, 30, 10] }), nose: 12 },
  head: HEAD(0.3, 0.16, [0.92, 0.98, 0.84]), body: [2.2, 0.9, 0.8], neck: [0.52, 0.54, 0.42], ear: [0.4, 0.2, 25], legs: [0.85, 0.22, 0.21, 'coatDark'],
  snout: [1.02, -0.18, [0.36, 0.34, 0.3], 0.1],
  tail: (n) => merge(root(n), tube([[0, -0.2, 0], [0, -0.9, 0.2]], 0.07, 0.07, 5, 'coat'),
    blade(curve([0, -0.9, 0.2], [0, -0.75, 0.55], [0, -0.35, 0.7], 4), [0.02, 0.14, 0.12, 0.01], [1, 0, 0], { mat: 'metal' })),
  own: { metal: [196, 198, 206] }, mark: 210, shadow: [1.45, 1.05], stride: 1.5, size: 1.65,
});

/* ---- the whirla: a whip of a tail --------------------------------------------------- */

export const WHIRLA = kindOf({
  spec: { ...pawed({ high: 1.3, len: 2.1, legs: 0.8, neck: 0.36, lean: 40, swing: [24, 40], ears: [30, 24], tail: [0.4, 16, 8] }), nose: 12 },
  head: HEAD(0.3, 0.16, [0.98, 0.96, 0.88]), body: [2.1, 0.95, 0.82], neck: [0.56, 0.56, 0.36], ear: [0.36, 0.22, 30], legs: [0.8, 0.23, 0.22, 'coatDark'],
  snout: [1.0, -0.18, [0.38, 0.32, 0.34], 0.11],
  tail: (n) => merge(root(n), tube(Array.from({ length: 14 }, (_, i): V3 => {
    const a = (i / 13) * TAU * 1.1, rr = 0.15 + i * 0.07;
    return [Math.sin(a) * rr, -0.2 - Math.cos(a) * rr * 0.6 - i * 0.04, 0.05 + i * 0.01];
  }), [0.08, 0.02], [0.08, 0.02], 5, 'coat')),
  own: {}, mark: 30, shadow: [1.5, 1.15], stride: 1.45, size: 1.6,
});

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

/* ---- the frosta: icicles hanging off its flanks --------------------------------------- */

export const FROSTA = kindOf({
  spec: { ...pawed({ high: 1.3, len: 2.2, legs: 0.72, neck: 0.34, lean: 50, swing: [22, 36], ears: [35, 22], tail: [0.45, 16, 6] }), nose: 12 },
  head: HEAD(0.32, 0.14, [1.02, 0.98, 0.9]), body: [2.2, 1.15, 0.95], neck: [0.64, 0.64, 0.34], ear: [0.32, 0.26, 35], legs: [0.72, 0.28, 0.25, 'coatLight'],
  snout: [1.0, -0.2, [0.4, 0.32, 0.34], 0.11],
  back: () => merge(...[-0.6, -0.2, 0.2, 0.55].flatMap((y) => [-1, 1].map((s) => taper([[s * 0.55, y, 0.15], [s * 0.6, y, -0.25]], 0.07, 0.01, 4, 'crystal')))),
  thin: true,
  tail: (n) => merge(root(n), taper([[0, -0.2, 0], [0, -0.7, 0.1]], 0.16, 0.06, n, 'coatLight')),
  own: { crystal: [190, 230, 250] }, mark: 30, shadow: [1.55, 1.25], stride: 1.4, size: 1.7,
});

/* ---- the rootle: tendrils down into the ground ---------------------------------------- */

export const ROOTLE = kindOf({
  spec: { ...pawed({ high: 1.15, len: 2.3, legs: 0.6, neck: 0.32, lean: 60, swing: [16, 26], ears: [40, 18], tail: [0.4, 4, 2] }), nose: 10 },
  head: HEAD(0.35, 0.1, [1.02, 0.98, 0.88]), body: [2.3, 1.2, 0.9, 0.06], neck: [0.66, 0.64, 0.32], ear: [0.28, 0.24, 40], legs: [0.6, 0.3, 0.27, 'bark'],
  snout: [1.0, -0.22, [0.42, 0.3, 0.34], 0.11],
  back: () => merge(...[[-0.7, 1], [-0.2, -1], [0.3, 1], [0.6, -1]].map(([y, s]) =>
    tube(curve([s * 0.5, y, 0.3], [s * 0.85, y + 0.1, -0.1], [s * 1.0, y - 0.1, -0.55], 4), [0.06, 0.04, 0.02], [0.06, 0.04, 0.02], 4, 'stem'))),
  thin: true,
  tail: (n) => merge(root(n), tube(curve([0, -0.2, 0], [0.1, -0.6, -0.2], [-0.05, -0.85, -0.5], 4), [0.08, 0.05, 0.02], [0.08, 0.05, 0.02], 5, 'stem')),
  own: { bark: [96, 76, 50], stem: [120, 96, 60] }, mark: 30, shadow: [1.6, 1.3], stride: 1.25, size: 1.65,
});

/* ---- the dulla: soft round paws and a puff of a tail ---------------------------------- */

export const DULLA = kindOf({
  spec: { ...pawed({ high: 1.2, len: 2.1, legs: 0.62, neck: 0.32, lean: 55, swing: [18, 30], ears: [55, 20], tail: [0.3, 8, 4] }), nose: 10 },
  head: HEAD(0.34, 0.12, [1.08, 1.0, 0.92]), body: [2.1, 1.2, 0.95, 0.06], neck: [0.68, 0.66, 0.32], ear: [0.3, 0.32, 55], legs: [0.62, 0.3, 0.36, 'coatLight'],
  snout: [1.0, -0.2, [0.42, 0.32, 0.34], 0.11],
  tail: (n, k) => merge(root(n), orb([0, -0.42, 0.06], 0.28, n, k, 'coatLight')),
  own: {}, mark: 30, shadow: [1.55, 1.3], stride: 1.25, size: 1.6,
});

/* ---- the brittla: glassy shards along its back --------------------------------------- */

export const BRITTLA = kindOf({
  spec: { ...pawed({ high: 1.3, len: 2.1, legs: 0.75, neck: 0.34, lean: 45, swing: [22, 36], ears: [30, 24], tail: [0.4, 14, 6] }), nose: 12 },
  head: HEAD(0.32, 0.15, [0.98, 0.96, 0.88]), body: [2.1, 1.0, 0.85], neck: [0.58, 0.58, 0.34], ear: [0.34, 0.22, 30], legs: [0.75, 0.24, 0.22, 'coatDark'],
  snout: [1.0, -0.18, [0.38, 0.32, 0.32], 0.1],
  back: () => merge(...[[-0.7, 0.1, 18], [-0.35, -0.12, -14], [0, 0.12, 22], [0.35, -0.08, -10]].map(([y, x, lean]) =>
    moved(taper([[0, 0, 0], [0, 0, 0.42]], 0.11, 0.01, 4, 'crystal'), [x, y, 0.72], 0, lean, lean))),
  thin: true,
  tail: (n) => merge(root(n), taper([[0, -0.2, 0], [0, -0.75, 0.15], [0, -1.0, 0.2]], 0.09, 0.02, n, 'crystalDark')),
  own: { crystal: [200, 226, 240], crystalDark: [140, 176, 196] }, mark: 30, shadow: [1.45, 1.15], stride: 1.45, size: 1.6,
});

/* ---- the shova: curled ram's horns ---------------------------------------------------- */

export const SHOVA = kindOf({
  spec: { ...pawed({ high: 1.35, len: 2.4, legs: 0.72, neck: 0.3, lean: 55, swing: [18, 30], ears: [55, 15], tail: [0.35, 6, 2] }), nose: 10 },
  head: HEAD(0.35, 0.1, [1.06, 1.0, 0.92]), body: [2.4, 1.35, 1.05, 0.18], neck: [0.8, 0.78, 0.3], ear: [0.24, 0.22, 55], legs: [0.72, 0.33, 0.3, 'coatDark'],
  snout: [1.02, -0.24, [0.44, 0.3, 0.36], 0.12],
  face: () => merge(...[-1, 1].map((s) => tube([[s * 0.6, 0.3, 0.75], [s * 1.2, 0.0, 0.7], [s * 1.25, 0.2, 0.15], [s * 1.0, 0.55, 0.05]],
    [0.18, 0.15, 0.1, 0.05], [0.18, 0.15, 0.1, 0.05], 6, 'horn'))),
  tail: (n) => taper([[0, 0.05, 0], [0, -0.35, 0.02]], 0.14, 0.05, n, 'coat'),
  own: { horn: [200, 182, 150] }, mark: 30, shadow: [1.7, 1.4], stride: 1.3, size: 1.8,
});

/* ---- the howla: a shaggy mane ---------------------------------------------------------- */

export const HOWLA = kindOf({
  spec: { ...pawed({ high: 1.45, len: 2.4, legs: 0.82, neck: 0.36, lean: 45, swing: [22, 36], ears: [25, 25], tail: [0.55, 24, 10] }), nose: 12 },
  head: HEAD(0.32, 0.15, [1.0, 0.98, 0.9]), body: [2.4, 1.15, 0.98, 0.16], neck: [0.68, 0.68, 0.36], ear: [0.38, 0.22, 25], legs: [0.82, 0.28, 0.26, 'coatDark'],
  snout: [1.04, -0.18, [0.38, 0.36, 0.32], 0.11],
  back: () => merge(...[0.45, 0.65, 0.85].flatMap((y) => [-0.5, -0.25, 0, 0.25, 0.5].map((x) =>
    taper([[x, y, 0.55], [x * 1.5, y - 0.25, 0.95 - Math.abs(x) * 0.4]], 0.09, 0.02, 4, 'coatDark')))),
  thin: true,
  tail: (n) => merge(root(n), taper([[0, -0.2, 0], [0, -0.6, 0.25], [0, -1.0, 0.35]], 0.16, 0.05, n, 'coatDark')),
  own: {}, mark: 30, shadow: [1.65, 1.3], stride: 1.45, size: 1.8,
});

/* ---- the marka: red stripes down its flanks ------------------------------------------ */

export const MARKA = kindOf({
  spec: { ...pawed({ high: 1.3, len: 2.1, legs: 0.8, neck: 0.38, lean: 40, swing: [24, 40], ears: [20, 30], tail: [0.45, 18, 8] }), nose: 12 },
  head: HEAD(0.3, 0.16, [0.94, 0.98, 0.86]), body: [2.1, 0.95, 0.82], neck: [0.54, 0.56, 0.38], ear: [0.42, 0.2, 20], legs: [0.8, 0.23, 0.21, 'coatDark'],
  snout: [1.02, -0.17, [0.36, 0.34, 0.3], 0.1],
  back: () => merge(...[-0.55, -0.15, 0.25].flatMap((y) => [-1, 1].map((s) =>
    moved(tube([[0, -0.08, 0], [0, 0.08, 0]], 0.03, 0.34, 4, 'spot', { up: [0, 0, 1] }), [s * 0.5, y, 0.45], 0, 0, s * 30)))),
  thin: true,
  tail: (n) => merge(root(n), taper([[0, -0.2, 0], [0, -0.7, 0.2]], 0.1, 0.03, n, 'coat')),
  own: { spot: [196, 40, 40] }, mark: 30, shadow: [1.45, 1.1], stride: 1.5, size: 1.6,
});

/* ---- the wardo: a ring of shimmer about it -------------------------------------------- */

export const WARDO = kindOf({
  spec: { ...pawed({ high: 1.3, len: 2.1, legs: 0.74, neck: 0.34, lean: 45, swing: [22, 36], ears: [30, 24], tail: [0.45, 20, 8] }), nose: 12 },
  head: HEAD(0.32, 0.16, [1.0, 0.98, 0.9]), body: [2.1, 1.05, 0.9], neck: [0.6, 0.6, 0.34], ear: [0.34, 0.24, 30], legs: [0.74, 0.25, 0.23, 'coatLight'],
  snout: [1.0, -0.18, [0.4, 0.32, 0.34], 0.11],
  back: () => tube(Array.from({ length: 17 }, (_, i): V3 => [Math.cos((i / 16) * TAU) * 1.0, Math.sin((i / 16) * TAU) * 1.35, 0.45]), 0.04, 0.04, 4, 'crystal'),
  thin: true,
  tail: (n, k) => merge(root(n), taper([[0, -0.2, 0], [0, -0.65, 0.2]], 0.12, 0.04, n, 'coat'), orb([0, -0.7, 0.24], 0.1, n, k, 'crystal')),
  own: { crystal: [200, 186, 250] }, mark: 30, shadow: [1.5, 1.2], stride: 1.4, size: 1.65,
});

/* ---- the stona: plates of stone on its back ------------------------------------------- */

export const STONA = kindOf({
  spec: { ...pawed({ high: 1.1, len: 2.3, legs: 0.58, neck: 0.32, lean: 60, swing: [16, 26], ears: [45, 15], tail: [0.35, 4, 2] }), nose: 10 },
  head: HEAD(0.36, 0.08, [1.04, 0.98, 0.88]), body: [2.3, 1.4, 0.95, 0.04], neck: [0.7, 0.68, 0.32], ear: [0.24, 0.22, 45], legs: [0.58, 0.34, 0.3, 'stoneDark'],
  snout: [1.0, -0.22, [0.42, 0.3, 0.34], 0.11],
  back: (n, k) => merge(...[[-0.65, 0], [-0.2, -0.35], [-0.2, 0.35], [0.25, 0], [0.6, -0.3], [0.6, 0.3]].map(([y, x]) =>
    orb([x, y, 0.72], [0.3, 0.28, 0.14], n, k, 'stone'))),
  tail: (n) => taper([[0, 0.05, 0], [0, -0.35, 0.02]], 0.16, 0.06, n, 'stoneDark'),
  own: { stone: [150, 148, 140], stoneDark: [104, 102, 96] }, mark: 30, shadow: [1.65, 1.35], stride: 1.2, size: 1.7,
});

/* ---- the leecha: a round sucking mouth ------------------------------------------------- */

export const LEECHA = kindOf({
  spec: { ...pawed({ high: 1.05, len: 2.5, legs: 0.55, neck: 0.42, lean: 70, swing: [24, 40], ears: [70, 6], tail: [0.6, -6, 4] }), nose: 10 },
  head: HEAD(0.38, 0.05, [0.86, 1.0, 0.74]), body: [2.5, 0.95, 0.72, 0.02], neck: [0.5, 0.48, 0.42], ear: [0.16, 0.16, 70], legs: [0.55, 0.22, 0.2, 'coatDark'],
  snout: [1.0, -0.16, [0.4, 0.3, 0.3], 0.06],
  face: () => merge(tube([[0, 1.18, -0.16], [0, 1.32, -0.16]], 0.22, 0.22, 10, 'lip', { up: [0, 0, 1] }),
    paint([disc([0, 1.325, -0.16], [0, 1, 0], 0.15, 0.15, 10, 'inner')])),
  tail: (n) => tube(curve([0, 0.05, 0], [0.1, -0.7, -0.04], [-0.05, -1.4, 0], 5), [0.13, 0.09, 0.02], [0.12, 0.08, 0.02], 6, 'coat'),
  own: { lip: [150, 80, 100], inner: [90, 30, 50] }, mark: 30, shadow: [1.5, 0.95], stride: 1.45, size: 1.55,
});
