import {
  beat, coatPalette, curve, merge, moved, orb, quadBonesOf, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { cut, earMesh, quadPieces } from './beastkit';
import { type V3 } from './figure';
import { pawed, trot } from './wild-paws';
import { snout } from './wild-hands';
import { barrel, OWN, paws } from './wild-hands2';

/**
 * Seven that fight: the testa, the skulka, the gasha, the thumpa, the spitta,
 * the awla and the sparra. Each wears how it fights (`FightStyle`): a shell
 * to take what it draws, a low slinking body, hooked teeth, a club of a tail,
 * bands and a forked tongue, a horn, and a pair of raised fists.
 */

/** A tail's root, out of the body, before what is on the end of it. */
const root = (n: number): ReturnType<typeof taper> => taper([[0, 0.05, 0], [0, -0.25, 0]], 0.12, 0.09, n, 'coat');

/* ---- the testa: a domed shell over a broad low body ---------------------------------- */

const TESTA_SPEC: QuadSpec = { ...pawed({ high: 1.05, len: 2.4, legs: 0.5, neck: 0.4, lean: 70, swing: [16, 26], ears: [50, 10], tail: [0.3, -4, 2] }), nose: 8 };
const TESTA_HEAD = { c: [0, 0.38, 0.05] as V3, r: [0.95, 0.95, 0.82] as V3 };

function testaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = TESTA_HEAD;
  // The dome over its back, with a rim standing out from it and plates picked out in a darker horn.
  const shell = merge(
    orb([0, -0.1, 0.62], [0.95, 1.35, 0.62], n + 2, k + 1, 'horn'),
    tube([[0, -1.4, 0.32], [0, 1.2, 0.32]], [0.06, 0.06], [0.04, 0.04], 4, 'hornDark'),
    ...[-0.6, 0, 0.6].map((y) => orb([0, y - 0.1, 1.2], [0.32, 0.3, 0.1], 6, 3, 'hornDark')),
  );
  return quadPieces({
    n, k,
    body: barrel(2.4, 1.5, 0.9, 0.04),
    neck: { w: 0.6, h: 0.58, len: 0.4 },
    head: { c: H.c, r: H.r, face: snout(0.98, -0.22, [0.42, 0.3, 0.34], 0.1, n, k), eye: { dir: [0.72, 0.54, 0.3], size: 0.27, rim: 0.12 } },
    ear: earMesh(0.24, 0.22, n),
    earTurn: 50,
    tail: [taper([[0, 0.05, 0], [0, -0.3, -0.02]], 0.12, 0.04, n, 'coat')],
    ...paws(n, k, 0.5, 0.34, 0.3, 'coatDark'),
    extras: [{ key: 'shell', mesh: shell, bone: 'trunk', bias: 0.05, after: ['body'] }],
  });
}

export const TESTA: Kind = {
  bones: quadBonesOf(TESTA_SPEC, trot),
  build: testaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ horn: [150, 124, 84], hornDark: [100, 82, 56] }), 30),
  shadow: [1.75, 1.45],
  stride: 1.2,
  size: 1.75,
};

/* ---- the skulka: long and low, a tail held flat ------------------------------------- */

const SKULKA_SPEC: QuadSpec = { ...pawed({ high: 1.0, len: 2.8, legs: 0.55, neck: 0.4, lean: 75, swing: [24, 40], ears: [25, 30], tail: [0.7, -6, 2] }), nose: 14 };
const SKULKA_HEAD = { c: [0, 0.32, 0.1] as V3, r: [0.9, 1.02, 0.8] as V3 };

function skulkaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = SKULKA_HEAD;
  // A long tail carried flat, so nothing shows over the grass.
  const tail = tube(curve([0, 0.05, 0], [0, -0.7, -0.05], [0, -1.5, 0.02], 5), [0.14, 0.1, 0.03], [0.14, 0.1, 0.03], 6, 'coat');
  return quadPieces({
    n, k,
    body: barrel(2.9, 0.95, 0.7, 0.02),
    neck: { w: 0.54, h: 0.52, len: 0.4 },
    head: { c: H.c, r: H.r, face: snout(1.05, -0.16, [0.36, 0.38, 0.3], 0.1, n, k), eye: { dir: [0.7, 0.58, 0.32], size: 0.26, rim: 0.14 } },
    ear: earMesh(0.36, 0.2, n),
    earTurn: 25,
    tail: [tail],
    ...paws(n, k, 0.55, 0.24, 0.22, 'coatDark'),
  });
}

export const SKULKA: Kind = {
  bones: quadBonesOf(SKULKA_SPEC, trot),
  build: skulkaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({}), 210),
  shadow: [1.6, 1.0],
  stride: 1.55,
  size: 1.6,
};

/* ---- the gasha: hooked teeth over its lip, a ruff up its neck ------------------------ */

const GASHA_SPEC: QuadSpec = { ...pawed({ high: 1.35, len: 2.2, legs: 0.8, neck: 0.38, lean: 45, swing: [24, 40], ears: [30, 24], tail: [0.5, 16, 8] }), nose: 12 };
const GASHA_HEAD = { c: [0, 0.32, 0.15] as V3, r: [0.98, 0.96, 0.86] as V3 };

function gashaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = GASHA_HEAD;
  // Two pairs of hooked teeth down over the lip.
  const teeth = merge(...[-0.16, -0.06, 0.06, 0.16].map((x) =>
    tube(curve([x, 1.24, -0.32], [x * 1.1, 1.3, -0.5], [x * 0.9, 1.22, -0.6], 3), [0.04, 0.03, 0.01], [0.04, 0.03, 0.01], 4, 'tooth')));
  // A ruff of stiff hair standing up the back of its neck.
  const ruff = merge(...[-0.2, -0.05, 0.1, 0.25].flatMap((y) => [-0.14, 0, 0.14].map((x) => taper([[x, y + 0.6, 0.7], [x * 1.5, y + 0.5, 1.0]], 0.05, 0.015, 4, 'coatDark'))));
  return quadPieces({
    n, k,
    body: barrel(2.2, 1.0, 0.85),
    neck: { w: 0.6, h: 0.62, len: 0.38 },
    head: { c: H.c, r: H.r, face: merge(snout(1.02, -0.18, [0.4, 0.32, 0.34], 0.11, n, k), teeth), eye: { dir: [0.72, 0.54, 0.34], size: 0.27, rim: 0.14 } },
    ear: earMesh(0.36, 0.22, n),
    earTurn: 30,
    tail: [tube(curve([0, 0.05, 0], [0, -0.5, 0.15], [0, -0.95, 0.3], 4), [0.13, 0.1, 0.04], [0.13, 0.1, 0.04], 6, 'coat')],
    ...paws(n, k, 0.8, 0.25, 0.23, 'coatDark'),
    extras: [{ key: 'ruff', mesh: ruff, bone: 'trunk', bias: 0.05, after: ['body'], thin: true }],
  });
}

export const GASHA: Kind = {
  bones: quadBonesOf(GASHA_SPEC, trot),
  build: gashaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({}), 30),
  shadow: [1.5, 1.15],
  stride: 1.5,
  size: 1.65,
};

/* ---- the thumpa: heavy shoulders, a club for a tail --------------------------------- */

const THUMPA_SPEC: QuadSpec = { ...pawed({ high: 1.45, len: 2.5, legs: 0.75, neck: 0.32, lean: 55, swing: [18, 30], ears: [40, 18], tail: [0.55, 12, 4] }), nose: 10 };
const THUMPA_HEAD = { c: [0, 0.35, 0.1] as V3, r: [1.08, 1.0, 0.92] as V3 };

function thumpaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = THUMPA_HEAD;
  // A club on the end of the tail: a knob of bone with blunt studs round it.
  const club = merge(
    root(n),
    tube([[0, -0.2, 0], [0, -0.75, 0.04]], 0.11, 0.11, 6, 'coat'),
    orb([0, -0.95, 0.06], [0.3, 0.32, 0.28], n, k, 'hornDark'),
    ...[0, 1, 2, 3].map((q) => orb([Math.cos(q * TAU / 4) * 0.28, -0.95, 0.06 + Math.sin(q * TAU / 4) * 0.26], 0.08, 4, 3, 'horn')),
  );
  return quadPieces({
    n, k,
    body: barrel(2.5, 1.4, 1.1, 0.22),
    neck: { w: 0.78, h: 0.78, len: 0.32 },
    head: { c: H.c, r: H.r, face: snout(1.02, -0.22, [0.46, 0.32, 0.38], 0.12, n, k), eye: { dir: [0.74, 0.52, 0.3], size: 0.26, rim: 0.12 } },
    ear: earMesh(0.3, 0.26, n),
    earTurn: 40,
    tail: [club],
    ...paws(n, k, 0.75, 0.34, 0.3, 'coatDark'),
  });
}

export const THUMPA: Kind = {
  bones: quadBonesOf(THUMPA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it swings the club now and then.
    if (a.go <= 0) p.tail[1] += 24 * Math.sin(a.t * TAU * 1.2) * beat(a.t, [4.2, 13.4], 2.2);
  }),
  build: thumpaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ horn: [200, 190, 168], hornDark: [130, 118, 98] }), 30),
  shadow: [1.75, 1.4],
  stride: 1.3,
  size: 1.8,
};

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

/* ---- the awla: a horn like an awl ---------------------------------------------------- */

const AWLA_SPEC: QuadSpec = { ...pawed({ high: 1.35, len: 2.2, legs: 0.8, neck: 0.38, lean: 45, swing: [22, 38], ears: [35, 22], tail: [0.4, 14, 6] }), nose: 12 };
const AWLA_HEAD = { c: [0, 0.3, 0.15] as V3, r: [0.92, 1.0, 0.86] as V3 };

function awlaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = AWLA_HEAD;
  // One long straight horn off the brow, ridged and very sharp.
  const horn = merge(
    taper([[0, 0.95, 0.35], [0, 1.45, 0.62], [0, 1.95, 0.85]], 0.13, 0.01, 6, 'horn'),
    ...[1.15, 1.4, 1.65].map((y) => orb([0, y, 0.46 + (y - 1.15) * 0.48], [0.1 - (y - 1.15) * 0.1, 0.03, 0.1 - (y - 1.15) * 0.1], 6, 2, 'hornDark')),
  );
  return quadPieces({
    n, k,
    body: barrel(2.2, 1.05, 0.88),
    neck: { w: 0.58, h: 0.6, len: 0.38 },
    head: { c: H.c, r: H.r, face: merge(snout(1.0, -0.2, [0.36, 0.34, 0.32], 0.1, n, k), horn), eye: { dir: [0.72, 0.54, 0.34], size: 0.27, rim: 0.12 } },
    ear: earMesh(0.34, 0.22, n),
    earTurn: 35,
    tail: [tube(curve([0, 0.05, 0], [0, -0.45, 0.1], [0, -0.85, 0.12], 4), [0.11, 0.08, 0.03], [0.11, 0.08, 0.03], 6, 'coat')],
    ...paws(n, k, 0.8, 0.25, 0.23, 'coatDark'),
  });
}

export const AWLA: Kind = {
  bones: quadBonesOf(AWLA_SPEC, trot),
  build: awlaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ horn: [222, 214, 196], hornDark: [150, 140, 120] }), 30),
  shadow: [1.5, 1.15],
  stride: 1.45,
  size: 1.65,
};

/* ---- the sparra: fists up ------------------------------------------------------------ */

const SPARRA_SPEC: QuadSpec = { ...pawed({ high: 1.35, len: 2.0, legs: 0.75, neck: 0.32, lean: 35, swing: [22, 38], ears: [30, 24], tail: [0.35, 20, 8] }), nose: 12 };
const SPARRA_HEAD = { c: [0, 0.3, 0.18] as V3, r: [1.04, 0.98, 0.9] as V3 };

function sparraBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = SPARRA_HEAD;
  // Two padded fists held up in front of its chest, as a boxer holds them.
  const fists = merge(...[-1, 1].map((s) => merge(
    tube([[s * 0.5, 0.9, 0.1], [s * 0.88, 1.15, 0.2]], 0.15, 0.15, 6, 'coatLight'),
    orb([s * 1.0, 1.25, 0.22], [0.26, 0.26, 0.26], n, k, 'leather'),
  )));
  return quadPieces({
    n, k,
    body: barrel(2.0, 1.15, 0.95, 0.16),
    neck: { w: 0.66, h: 0.66, len: 0.32 },
    head: { c: H.c, r: H.r, face: snout(1.02, -0.2, [0.42, 0.32, 0.36], 0.12, n, k), eye: { dir: [0.74, 0.52, 0.36], size: 0.31, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.18] },
    ear: earMesh(0.34, 0.24, n),
    earTurn: 30,
    tail: [taper([[0, 0.05, 0], [0, -0.3, 0.1]], 0.13, 0.05, n, 'coat')],
    ...paws(n, k, 0.75, 0.27, 0.24, 'coatDark'),
    extras: [{ key: 'fists', mesh: fists, bone: 'trunk', bias: 0.05, after: ['body'] }],
  });
}

export const SPARRA: Kind = {
  bones: quadBonesOf(SPARRA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it bobs on its feet.
    if (a.go <= 0) p.squash += 0.04 * Math.max(0, Math.sin(a.t * TAU * 2)) * beat(a.t, [3.6, 9.8, 15.2], 2.4);
  }),
  build: sparraBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ leather: [176, 52, 46] }), 30),
  shadow: [1.5, 1.2],
  stride: 1.4,
  size: 1.65,
};
