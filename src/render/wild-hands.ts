import {
  add, beat, coatPalette, curve, cyc, disc, merge, moved, orb, orbAlong, paint, quadBonesOf, scale, smile, taper, TAU, tube,
  type Kind, type Piece, type QuadSpec,
} from './beasts';
import { blade, cut, earMesh, pawMesh, quadPieces } from './beastkit';
import { type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';

/**
 * The settlement's own hands: the sheela, the salva, the carra, the tanna
 * and the brambo (the kemma is the Whispling now, `./wild-owl`).
 * Each carries the tool of its trade on its body, as every wildermon carries
 * something no field guide has: shears for teeth, a cleaver for a beak.
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

/* ---- the sheela: shears for teeth, and a pail at the throat ------------------------- */

/**
 * A sheela: a short, deft creature with clever forepaws. Its two front teeth
 * are the blades of a pair of shears, and a little milk pail hangs at its
 * throat like a bell; a curl of wool sits on its head.
 */
const SHEELA_SPEC: QuadSpec = { ...pawed({ high: 1.3, len: 2.0, legs: 0.75, neck: 0.35, lean: 40, swing: [24, 40], ears: [30, 18], tail: [0.35, 25, 10] }), nose: 12 };
const SHEELA_HEAD = { c: [0, 0.3, 0.2] as V3, r: [1.0, 0.95, 0.9] as V3 };

function sheelaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = SHEELA_HEAD;
  // The shears: two narrow steel blades for front teeth, crossed a little at their tips.
  const shears = merge(...[-1, 1].map((s) => tube([[s * 0.07, 1.22, -0.48], [s * 0.04, 1.3, -0.72], [-s * 0.03, 1.34, -0.9]], [0.07, 0.06, 0.01], [0.025, 0.025, 0.01], 4, 'blade', { up: [1, 0, 0] })));
  const curl = merge(...([[0, 0.05, 0.95], [-0.22, 0.12, 0.88], [0.22, 0.12, 0.88], [0, 0.3, 0.9]] as V3[]).map((c) => orb(c, 0.2, 6, 4, 'coatLight')));
  const face = merge(snout(1.0, -0.22, [0.42, 0.32, 0.36], 0.11, n, k), shears, curl);
  // The pail: a little metal bucket hanging at the throat on a strap, milk-white inside.
  const pail = merge(
    tube([[0, 0, 0], [0, 0, -0.38]], [0.2, 0.17], [0.2, 0.17], 8, 'metal', { seam: 'end' }),
    paint([disc([0, 0, 0.005], [0, 0, 1], 0.17, 0.17, 8, 'cap')]),
    tube(curve([-0.2, 0, 0.0], [0, 0, 0.26], [0.2, 0, 0.0], 4), 0.025, 0.025, 4, 'metalDark'),
  );
  return quadPieces({
    n, k,
    body: { y: [-1.1, -0.9, -0.4, 0.1, 0.55, 0.88, 1.05], z: [0.1, 0.12, 0.16, 0.2, 0.24, 0.27, 0.3], w: [0.28, 0.9, 1.04, 1.06, 1.0, 0.86, 0.28], h: [0.26, 0.78, 0.9, 0.92, 0.86, 0.74, 0.26], belly: true },
    neck: { w: 0.62, h: 0.62, len: 0.35 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.76, 0.5, 0.3], size: 0.31, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.19] },
    ear: earMesh(0.5, 0.26, n, { point: true }),
    earTurn: 35,
    tail: links([0.18, 0.15, 0.08], 0.3, n, 'coat'),
    fore: { upper: [0.28, -0.4, 0.24, 0.2], lower: [0, -0.36, 0.2, 0.18], foot: pawMesh(0.2, n, k, 'mark') },
    hind: { upper: [0.3, -0.42, 0.28, 0.24], lower: [0, -0.4, 0.22, 0.2], foot: pawMesh(0.22, n, k, 'mark') },
    extras: [{ key: 'pail', mesh: moved(pail, [0, 0.55, -0.45]), bone: 'neck', bias: 0.05, after: ['body', 'neck'] }],
  });
}

export const SHEELA: Kind = {
  bones: quadBonesOf(SHEELA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, a snip of its teeth at nothing now and then, the head nodding to it.
    if (a.go <= 0) p.head[0] += 6 * Math.sin(a.t * TAU * 3) * beat(a.t, [4.2, 13.6, 20.1], 0.8) * (1 - a.graze);
  }),
  build: sheelaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ blade: [206, 212, 220], metal: [178, 186, 196], metalDark: [120, 128, 140], cap: [250, 248, 238] }), 30),
  shadow: [1.4, 1.1],
  stride: 1.3,
  size: 1.6,
};

/* ---- the salva: a bandaged tail and mint for ears ----------------------------------- */

/**
 * A salva: a long-fingered, careful creature that smells of crushed leaves.
 * Its ears are mint leaves, a sprig of herbs grows on its head, and its tail
 * is wound round and round with a clean bandage.
 */
const SALVA_BASE = pawed({ high: 1.45, len: 2.0, legs: 0.9, neck: 0.4, lean: 30, swing: [24, 40], ears: [35, 25], tail: [0.4, 18, 14] });
const SALVA_SPEC: QuadSpec = { ...SALVA_BASE, tail: { ...SALVA_BASE.tail!, links: 4, len: 0.34 }, nose: 12 };
const SALVA_HEAD = { c: [0, 0.3, 0.2] as V3, r: [0.98, 0.94, 0.92] as V3 };

function salvaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = SALVA_HEAD;
  const sprig = merge(
    tube(curve([0, 0.1, 0.8], [0.05, 0.05, 1.15], [0.12, -0.1, 1.45], 3), 0.04, 0.04, 4, 'stem'),
    ...([[0.06, 0.02, 1.12, 1], [0.1, -0.05, 1.3, -1], [0.12, -0.1, 1.45, 1]] as Array<[number, number, number, number]>).map(([x, y, z, s]) =>
      blade(curve([x, y, z], [x + s * 0.15, y, z + 0.08], [x + s * 0.28, y - 0.02, z + 0.04], 3), [0.03, 0.09, 0.08, 0.01], [0, 1, 0.2], { mat: 'leaf', rib: 'leafDark' })),
  );
  const face = merge(snout(1.0, -0.2, [0.36, 0.3, 0.38], 0.1, n, k), sprig);
  // An ear: a mint leaf on a short stalk, serrated by its ribs, turned to show its face.
  const ear = merge(
    tube([[0, 0, -0.05], [0, 0, 0.12]], 0.05, 0.05, 5, 'stem', { seam: 'start' }),
    blade(curve([0, 0, 0.1], [0, -0.04, 0.38], [0, 0, 0.66], 4), [0.06, 0.2, 0.22, 0.14, 0.02], [0, 1, 0], { twist: -0.8, fold: 0.3, mat: 'leaf', rib: 'leafDark' }),
  );
  // The tail wound with bandage: cloth and coat by turns down its length, the tip left bare.
  const wrap = (q: number): Mat => (q % 2 ? 'cap' : 'coatDark');
  const tail = [
    taper([[0, 0, 0], [0, -0.34, 0]], 0.16, 0.15, 7, (r) => wrap(r)),
    taper([[0, 0, 0], [0, -0.34, 0]], 0.15, 0.14, 7, (r) => wrap(r + 1)),
    taper([[0, 0, 0], [0, -0.34, 0]], 0.14, 0.12, 7, (r) => wrap(r)),
    taper([[0, 0, 0], [0, -0.3, 0]], 0.12, 0.05, 6, 'coat'),
  ];
  // Long fingers: a narrow paw with three long fingers forward.
  const hand = (lod2: number): Mesh => merge(
    orbAlong([0, 0.08, -0.08], [0, 1, 0], [0.18, 0.14, 0.3], lod2, 4, 'mark'),
    ...[-0.08, 0, 0.08].map((x) => taper([[x, 0.2, -0.1], [x * 1.4, 0.48, -0.12]], 0.05, 0.035, 4, 'mark')),
  );
  return quadPieces({
    n, k,
    body: { y: [-1.05, -0.85, -0.4, 0.1, 0.55, 0.85, 1.0], z: [0.1, 0.12, 0.17, 0.22, 0.28, 0.32, 0.35], w: [0.25, 0.8, 0.94, 0.96, 0.9, 0.78, 0.25], h: [0.24, 0.7, 0.82, 0.84, 0.8, 0.68, 0.24], belly: true },
    neck: { w: 0.56, h: 0.56, len: 0.4 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.76, 0.5, 0.32], size: 0.3, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.18] },
    ear,
    earTurn: 25,
    tail,
    fore: { upper: [0.3, -0.5, 0.2, 0.17], lower: [0, -0.46, 0.16, 0.14], foot: hand(n) },
    hind: { upper: [0.3, -0.5, 0.26, 0.22], lower: [0, -0.46, 0.2, 0.17], foot: pawMesh(0.2, n, k, 'mark') },
  }).map((pc) => (pc.key === 'ear0' || pc.key === 'ear1' ? { ...pc, thin: true, airy: true } : pc));
}

export const SALVA: Kind = {
  bones: quadBonesOf(SALVA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it looks you over: the head tipped one way and then the other, as somebody does looking for what is wrong.
    if (a.go <= 0) p.head[2] += 14 * cyc(a.t, 2) * (1 - a.graze);
  }),
  build: salvaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ leaf: [150, 210, 150], leafDark: [96, 160, 104], stem: [120, 150, 96], cap: [250, 250, 244] }), 140),
  shadow: [1.3, 1.0],
  stride: 1.25,
  size: 1.6,
};

/* ---- the carra: a cleaver for a beak ----------------------------------------------- */

/**
 * A carra: a heavy-jawed scavenger on four legs with a ruff of dark feathers
 * round its neck and a beak that is a cleaver -- a broad flat steel blade
 * with a wooden grip for a brow -- and a fan of feathers for a tail.
 */
const CARRA_SPEC: QuadSpec = { ...pawed({ high: 1.75, len: 2.6, legs: 1.0, neck: 0.5, lean: 30, swing: [24, 40], ears: [10, 10], tail: [0.4, 25, -10] }), nose: 16 };
const CARRA_HEAD = { c: [0, 0.25, 0.2] as V3, r: [1.0, 1.0, 0.95] as V3 };

function carraBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = CARRA_HEAD;
  // The cleaver: a deep flat blade standing on its edge, down from a wooden spine along the top of the face.
  const blade0 = tube([[0, 0.75, 0.2], [0, 1.25, 0.12], [0, 1.75, -0.02], [0, 1.95, -0.2]], [0.08, 0.07, 0.06, 0.02], [0.62, 0.66, 0.6, 0.3], n, 'blade', { up: [1, 0, 0] });
  const spine = tube([[0, 0.7, 0.5], [0, 1.3, 0.44], [0, 1.85, 0.3]], 0.1, 0.08, 6, 'wood');
  const ruff = merge(...Array.from({ length: 9 }, (_, q) => {
    const a = (q / 9) * TAU;
    const d: V3 = [Math.cos(a), 0, Math.sin(a)];
    return blade(curve(scale(d, 0.5), add(scale(d, 0.85), [0, -0.1, 0]), add(scale(d, 1.05), [0, -0.3, 0]), 3), [0.12, 0.2, 0.14, 0.02], [0, 1, 0], { mat: q % 2 ? 'feather' : 'featherDark' });
  }));
  const fan = merge(...[-0.5, -0.25, 0, 0.25, 0.5].map((s) => blade(curve([0, 0, 0], [s * 0.3, -0.45, 0.1], [s * 0.7, -0.95, 0.2], 3), [0.06, 0.18, 0.16, 0.03], [0, 0.2, 1], { mat: 'featherDark', rib: 'feather' })));
  return quadPieces({
    n, k,
    body: { y: [-1.35, -1.1, -0.5, 0.1, 0.7, 1.1, 1.3], z: [0.05, 0.08, 0.14, 0.2, 0.28, 0.34, 0.38], w: [0.28, 0.95, 1.1, 1.12, 1.08, 0.92, 0.3], h: [0.26, 0.8, 0.94, 0.98, 0.96, 0.84, 0.3], belly: true },
    neck: { w: 0.66, h: 0.7, len: 0.5 },
    head: { c: H.c, r: H.r, face: merge(blade0, spine), eye: { dir: [0.72, 0.55, 0.35], size: 0.28, rim: 0.14 } },
    ear: earMesh(0.3, 0.2, n, { point: true }),
    earTurn: 45,
    tail: [fan],
    fore: { upper: [0.3, -0.55, 0.28, 0.24], lower: [0, -0.5, 0.22, 0.2], foot: pawMesh(0.24, n, k, 'claw') },
    hind: { upper: [0.32, -0.55, 0.32, 0.26], lower: [0, -0.52, 0.24, 0.2], foot: pawMesh(0.24, n, k, 'claw') },
    extras: [{ key: 'ruff', mesh: moved(ruff, [0, 0.15, 0.3]), bone: 'neck', bias: 0.1, after: ['body', 'neck'] }],
  });
}

export const CARRA: Kind = {
  bones: quadBonesOf(CARRA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, the head cocked and the cleaver brought down at nothing, once in a while.
    if (a.go <= 0) {
      const chop = beat(a.t, [6.3, 17.7], 0.7) * (1 - a.graze);
      p.head[0] += 24 * chop;
    }
  }),
  build: carraBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ blade: [214, 220, 228], wood: [150, 104, 70], claw: [90, 84, 80] }), 260),
  shadow: [1.8, 1.3],
  stride: 1.2,
  size: 1.9,
};

/* ---- the tanna: a saddle of leather on its back ------------------------------------ */

/**
 * A tanna: a sleek, bark-brown wader, an otter's shape, with hands stained
 * to the wrist. A patch of tanned leather, stitched at its edges, lies on its
 * back like a saddle, and its paddle of a tail is leather too.
 */
const TANNA_SPEC: QuadSpec = { ...pawed({ high: 1.15, len: 2.8, legs: 0.62, neck: 0.5, lean: 55, swing: [22, 36], ears: [50, 20], tail: [0.55, 4, 4] }), nose: 12 };
const TANNA_HEAD = { c: [0, 0.4, 0.1] as V3, r: [0.95, 0.95, 0.82] as V3 };

function tannaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = TANNA_HEAD;
  const face = merge(snout(1.0, -0.12, [0.5, 0.34, 0.42], 0.13, n, k), paint([-1, 1].map((s) => disc([s * 0.28, 1.25, -0.2], [s * 0.3, 1, -0.2], 0.04, 0.12, 5, 'lid'))));
  // The saddle: a thick leather shape lying along the top of the back, with a stitch line round it.
  const saddle = merge(
    tube([[0, -0.75, 0.82], [0, -0.3, 0.92], [0, 0.25, 0.92], [0, 0.65, 0.84]], [0.5, 0.78, 0.8, 0.5], [0.06, 0.08, 0.08, 0.06], n, 'leather', { up: [0, 0, 1] }),
    paint(Array.from({ length: 10 }, (_, q) => {
      const y = -0.6 + q * 0.13;
      return disc([0, y, 0.97], [0, 0, 1], 0.03, 0.05, 4, 'cap');
    })),
  );
  // A paddle of a tail, flat and leather.
  const tail = links([0.22, 0.24, 0.26, 0.04], 0.32, n, 'leather').map((m) => moved(m, [0, 0, 0]));
  return quadPieces({
    n, k,
    body: { y: [-1.5, -1.25, -0.6, 0.0, 0.6, 1.15, 1.4], z: [0.05, 0.08, 0.1, 0.12, 0.14, 0.17, 0.2], w: [0.25, 0.82, 0.92, 0.95, 0.92, 0.8, 0.28], h: [0.22, 0.66, 0.76, 0.78, 0.74, 0.62, 0.22], belly: true },
    neck: { w: 0.6, h: 0.58, len: 0.5 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.74, 0.55, 0.3], size: 0.3, rim: 0.12 }, blush: [[0.86, 0.38, -0.28], 0.17] },
    ear: earMesh(0.28, 0.22, n),
    earTurn: 40,
    tail,
    fore: { upper: [0.25, -0.32, 0.22, 0.2], lower: [0, -0.3, 0.2, 0.18], foot: pawMesh(0.22, n, k, 'bark'), mat: 'coatDark' },
    hind: { upper: [0.25, -0.34, 0.26, 0.22], lower: [0, -0.32, 0.22, 0.2], foot: pawMesh(0.22, n, k, 'bark'), mat: 'coatDark' },
    extras: [{ key: 'saddle', mesh: saddle, bone: 'trunk', bias: 0.04, after: ['body'] }],
  });
}

export const TANNA: Kind = {
  bones: quadBonesOf(TANNA_SPEC, (p, a) => {
    trot(p, a);
    // A low, flowing gait, the body rolling more than a dog's; standing, up on its haunches to look round now and then.
    p.roll += a.go * 2 * Math.sin((a.u % 1) * TAU);
    if (a.go <= 0) {
      const up = beat(a.t, [9.1, 21.3], 2.0) * (1 - a.graze);
      p.pitch += 22 * up;
      p.neck[0] -= 16 * up;
    }
  }),
  build: tannaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ leather: [168, 110, 62], cap: [240, 226, 196], bark: [104, 70, 46] }), 30),
  shadow: [1.9, 1.0],
  stride: 1.4,
  size: 1.7,
};

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
