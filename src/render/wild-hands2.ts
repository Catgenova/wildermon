import {
  add, beat, coatPalette, curve, cyc, disc, lighter, merge, moved, orb, orbAlong, paint, pastel, quadBonesOf, scale, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { blade, cut, earMesh, pawMesh, quadPieces, type QuadLook } from './beastkit';
import { place, type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { links, snout } from './wild-hands';

/**
 * More of the settlement's hands: the forga, the potta, the cindra,
 * the hoppa, the simma, the ambra, the petta and the scurra (the bedda is
 * the Sprigkit now, `./wild-calico`, the relka the Kintsu, `./wild-relic`, the sprigga the Lemlet,
 * `./wild-lemur`, and the wurla the Pebblebeak, `./wild-curlew`). As with
 * the first ten (`./wild-hands`), each wears the tool of its trade: tongs
 * for a tail, a spoon, a trowel, a scrubbing brush.
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

const thinEars = (pieces: Piece[]): Piece[] => pieces.map((pc) => (pc.key === 'ear0' || pc.key === 'ear1' ? { ...pc, thin: true, airy: true } : pc));

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

/* ---- the potta: a little pot for a hat, a paddle for a tail ------------------------- */

const POTTA_SPEC: QuadSpec = { ...pawed({ high: 1.3, len: 2.2, legs: 0.7, neck: 0.3, lean: 60, swing: [20, 34], ears: [45, 20], tail: [0.5, 2, 2] }), nose: 10 };
const POTTA_HEAD = { c: [0, 0.35, 0.12] as V3, r: [1.08, 1.0, 0.92] as V3 };

function pottaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = POTTA_HEAD;
  // A small clay pot sitting on its head, its mouth open to the sky.
  const pot = merge(
    tube([[0, 0.1, 0.85], [0, 0.1, 1.05], [0, 0.1, 1.25], [0, 0.1, 1.33]], [0.26, 0.36, 0.3, 0.24], [0.26, 0.36, 0.3, 0.24], 10, 'stone', { seam: 'end' }),
    paint([disc([0, 0.1, 1.335], [0, 0, 1], 0.2, 0.2, 10, 'stoneDark')]),
  );
  // A flat paddle of a tail, for smoothing.
  const paddle = merge(taper([[0, 0.05, 0], [0, -0.3, 0]], 0.12, 0.09, n, 'coat'), tube([[0, -0.28, 0], [0, -0.55, 0], [0, -0.9, 0.02]], [0.12, 0.28, 0.26], [0.04, 0.05, 0.04], 8, 'wood', { up: [0, 0, 1] }));
  return quadPieces({
    n, k,
    body: barrel(2.5, 1.2, 0.95),
    neck: { w: 0.66, h: 0.66, len: 0.3 },
    head: { c: H.c, r: H.r, face: merge(snout(1.05, -0.2, [0.42, 0.32, 0.36], 0.12, n, k), pot), eye: { dir: [0.74, 0.52, 0.32], size: 0.31, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.19] },
    ear: earMesh(0.34, 0.26, n),
    earTurn: 35,
    tail: [paddle],
    ...paws(n, k, 0.7, 0.28, 0.24, 'stone'),
  });
}

export const POTTA: Kind = {
  bones: quadBonesOf(POTTA_SPEC, trot),
  build: pottaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ stone: [196, 120, 84], stoneDark: [120, 70, 52], wood: [160, 116, 76] }), 30),
  shadow: [1.5, 1.25],
  stride: 1.35,
  size: 1.65,
};

/* ---- the cindra: a dustpan for a tail ----------------------------------------------- */

const CINDRA_SPEC: QuadSpec = { ...pawed({ high: 1.2, len: 1.9, legs: 0.65, neck: 0.3, lean: 45, swing: [24, 40], ears: [30, 25], tail: [0.4, 12, 10] }), nose: 12 };
const CINDRA_HEAD = { c: [0, 0.3, 0.2] as V3, r: [1.02, 0.96, 0.92] as V3 };

function cindraBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = CINDRA_HEAD;
  // A dustpan: a short handle and a broad tin scoop, its lip turned up at the back.
  const pan = merge(
    taper([[0, 0.05, 0], [0, -0.3, 0]], 0.11, 0.08, n, 'coat'),
    tube([[0, -0.28, 0], [0, -0.45, 0]], 0.05, 0.05, 5, 'wood'),
    tube([[0, -0.45, 0], [0, -0.95, -0.05]], [0.3, 0.38], [0.03, 0.03], 8, 'metal', { up: [0, 0, 1] }),
    tube([[0, -0.45, 0.04], [0, -0.45, 0.18]], 0.32, 0.03, 8, 'metalDark', { up: [0, 1, 0] }),
  );
  // Fluff like ash, in tufts on its back.
  const fluff = merge(...([[0, -0.4, 0.85], [0.3, 0.1, 0.82], [-0.3, 0.1, 0.82], [0, 0.45, 0.8]] as V3[]).map((c) => orb(c, 0.26, 6, 4, 'coatLight')));
  return quadPieces({
    n, k,
    body: barrel(2.0, 0.95, 0.85),
    neck: { w: 0.58, h: 0.58, len: 0.3 },
    head: { c: H.c, r: H.r, face: snout(0.98, -0.22, [0.36, 0.28, 0.32], 0.1, n, k), eye: { dir: [0.74, 0.52, 0.34], size: 0.33, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.18] },
    ear: earMesh(0.42, 0.26, n, { point: true }),
    earTurn: 30,
    tail: [pan],
    ...paws(n, k, 0.65, 0.22, 0.2, 'coatDark'),
    extras: [{ key: 'fluff', mesh: fluff, bone: 'trunk', bias: 0.04, after: ['body'], lines: false }],
  });
}

export const CINDRA: Kind = {
  bones: quadBonesOf(CINDRA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it sweeps with its pan now and then.
    if (a.go <= 0) p.tail[1] += 24 * Math.sin(a.t * TAU * 1.5) * beat(a.t, [6.1, 17.4], 1.8);
  }),
  build: cindraBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ metal: [176, 180, 186], metalDark: [120, 124, 132], wood: [150, 110, 76] }), 250),
  shadow: [1.2, 1.0],
  stride: 1.3,
  size: 1.45,
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

/* ---- the ambra: amber on its back, a pine cone for a tail --------------------------- */

const AMBRA_SPEC: QuadSpec = { ...pawed({ high: 1.35, len: 2.1, legs: 0.8, neck: 0.35, lean: 40, swing: [24, 40], ears: [30, 22], tail: [0.45, 30, 16] }), nose: 12 };
const AMBRA_HEAD = { c: [0, 0.3, 0.18] as V3, r: [1.0, 0.95, 0.9] as V3 };

function ambraBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = AMBRA_HEAD;
  // Drops of amber caught in its coat along the back, each catching the light.
  const drops = merge(...([[0, -0.5, 0.82], [0.28, -0.1, 0.8], [-0.26, 0.15, 0.8], [0.12, 0.5, 0.76]] as V3[]).map((c) => orbAlong(c, [0, 0, 1], [0.12, 0.12, 0.16], 6, 4, 'crystal')));
  // A pine cone for a tail: rings of scales, wide in the middle.
  const cone = merge(
    taper([[0, 0.05, 0], [0, -0.25, 0]], 0.12, 0.09, n, 'coat'),
    ...[0, 1, 2, 3, 4].map((q) => {
      const y = -0.3 - q * 0.13, r = 0.12 + 0.1 * Math.sin(((q + 0.5) / 5) * Math.PI);
      return tube([[0, y, 0], [0, y - 0.12, 0]], [r, r * 0.7], [r, r * 0.7], 8, q % 2 ? 'bark' : 'barkDark' as Mat);
    }),
  );
  return quadPieces({
    n, k,
    body: barrel(2.15, 0.95, 0.85, 0.15),
    neck: { w: 0.58, h: 0.58, len: 0.35 },
    head: { c: H.c, r: H.r, face: snout(1.0, -0.22, [0.36, 0.28, 0.34], 0.11, n, k), eye: { dir: [0.74, 0.52, 0.34], size: 0.31, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.18] },
    ear: earMesh(0.42, 0.26, n, { point: true }),
    earTurn: 30,
    tail: [cone],
    ...paws(n, k, 0.8, 0.22, 0.21, 'coatDark'),
    extras: [{ key: 'drops', mesh: drops, bone: 'trunk', bias: 0.05, after: ['body'] }],
  });
}

export const AMBRA: Kind = {
  bones: quadBonesOf(AMBRA_SPEC, trot),
  build: ambraBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ crystal: [244, 170, 60], bark: [150, 104, 64], ['barkDark' as Mat]: [110, 76, 48] }), 40),
  shadow: [1.3, 1.05],
  stride: 1.3,
  size: 1.55,
};

/* ---- the petta: petals for ears and a flower for a crown ---------------------------- */

const PETTA_SPEC: QuadSpec = { ...pawed({ high: 1.3, len: 1.7, legs: 0.8, neck: 0.35, lean: 30, swing: [26, 42], ears: [20, 30], tail: [0.4, 30, 24] }), nose: 12 };
const PETTA_HEAD = { c: [0, 0.28, 0.22] as V3, r: [0.98, 0.94, 0.9] as V3 };

function pettaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = PETTA_HEAD;
  // A flower on its crown: five petals round a yellow heart.
  const crown = merge(
    ...[0, 1, 2, 3, 4].map((q) => {
      const a = (q / 5) * TAU, d: V3 = [Math.cos(a), Math.sin(a) * 0.6, 0];
      return blade(curve(add([0, 0.05, 1.18], scale(d, 0.05)), add([0, 0.05, 1.26], scale(d, 0.22)), add([0, 0.05, 1.24], scale(d, 0.38)), 3), [0.05, 0.14, 0.12, 0.02], [0, 0, 1], { mat: 'petal' });
    }),
    orb([0, 0.05, 1.22], 0.1, 6, 4, 'bloom'),
  );
  const petal = blade(curve([0, 0, 0], [0, -0.04, 0.3], [0, 0, 0.6], 4), [0.06, 0.2, 0.22, 0.14, 0.02], [0, 1, 0], { twist: -0.6, fold: 0.3, mat: 'petal' });
  return thinEars(quadPieces({
    n, k,
    body: barrel(1.75, 0.82, 0.76, 0.18),
    neck: { w: 0.52, h: 0.52, len: 0.35 },
    head: { c: H.c, r: H.r, face: merge(snout(0.96, -0.22, [0.32, 0.26, 0.3], 0.1, n, k), crown), eye: { dir: [0.74, 0.52, 0.34], size: 0.34, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.2] },
    ear: petal,
    earTurn: 20,
    tail: links([0.14, 0.12, 0.09, 0.04], 0.28, n, 'coat'),
    ...paws(n, k, 0.8, 0.18, 0.17, 'coatLight'),
  }));
}

export const PETTA: Kind = {
  bones: quadBonesOf(PETTA_SPEC, (p, a) => {
    trot(p, a);
    // Light on its feet: a little lift at every step, and standing, a bob as if it would float off.
    p.lift += a.go * 0.06 * Math.abs(Math.sin((a.u % 1) * TAU));
    if (a.go <= 0) p.lift += 0.04 * (1 + cyc(a.t, 4));
  }),
  build: pettaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ petal: lighter(pastel(mark), 0.1), bloom: [250, 214, 110] }), 320),
  shadow: [1.0, 0.85],
  stride: 1.2,
  size: 1.4,
};

/* ---- the scurra: bristles down its back, a scrubbing brush for a tail --------------- */

const SCURRA_SPEC: QuadSpec = { ...pawed({ high: 1.25, len: 2.4, legs: 0.65, neck: 0.3, lean: 60, swing: [20, 34], ears: [40, 20], tail: [0.4, 6, 2] }), nose: 10 };
const SCURRA_HEAD = { c: [0, 0.35, 0.1] as V3, r: [1.05, 0.98, 0.9] as V3 };

function scurraBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = SCURRA_HEAD;
  // Stiff bristles down its spine, in tufts.
  const bristles = merge(...[-0.9, -0.55, -0.2, 0.15, 0.5].flatMap((y) => [-0.12, 0, 0.12].map((x) => taper([[x, y, 0.75], [x * 1.4, y - 0.05, 1.05]], 0.05, 0.015, 4, 'coatDark'))));
  // A scrubbing brush for a tail: a wooden block and bristles under it.
  const brush = merge(
    taper([[0, 0.05, 0], [0, -0.25, 0]], 0.12, 0.09, n, 'coat'),
    tube([[0, -0.25, 0.04], [0, -0.75, 0.04]], 0.2, 0.08, 6, 'wood', { up: [0, 0, 1] }),
    ...[-0.12, 0, 0.12].flatMap((x) => [-0.35, -0.5, -0.65].map((y) => taper([[x, y, -0.02], [x, y, -0.18]], 0.04, 0.03, 4, 'stem'))),
  );
  return quadPieces({
    n, k,
    body: barrel(2.45, 1.1, 0.88),
    neck: { w: 0.64, h: 0.62, len: 0.3 },
    head: { c: H.c, r: H.r, face: snout(1.02, -0.18, [0.4, 0.3, 0.36], 0.12, n, k), eye: { dir: [0.72, 0.54, 0.34], size: 0.29, rim: 0.12 } },
    ear: earMesh(0.34, 0.24, n),
    earTurn: 35,
    tail: [brush],
    ...paws(n, k, 0.65, 0.26, 0.23, 'coatDark'),
    extras: [{ key: 'bristles', mesh: bristles, bone: 'trunk', bias: 0.05, after: ['body'], thin: true }],
  });
}

export const SCURRA: Kind = {
  bones: quadBonesOf(SCURRA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it scrubs: the brush going hard from side to side.
    if (a.go <= 0) p.tail[1] += 26 * Math.sin(a.t * TAU * 3) * beat(a.t, [4.4, 13.9, 20.5], 1.6);
  }),
  build: scurraBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ wood: [160, 116, 76], stem: [214, 196, 150] }), 220),
  shadow: [1.5, 1.2],
  stride: 1.35,
  size: 1.6,
};

