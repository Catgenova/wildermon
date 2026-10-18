import {
  add, beat, birdBones, coatPalette, curve, cyc, darker, disc, eyes, lerp, merge, mirrored, moved, orb, orbAlong, paint, pastel, quadBonesOf, scale, smile, taper, TAU, tube,
  type BirdSpec, type Kind, type Piece, type QuadSpec,
} from './beasts';
import { birdLegPieces, blade, cut, earMesh, pawMesh, quadPieces, under } from './beastkit';
import { place, type Mat, type Mesh, type RGB, type V3 } from './figure';
import { pawed, trot } from './wild-paws';

/**
 * The settlement's own hands: the kemma, the sheela, the salva, the carra,
 * the tanna, the grista, the wicka, the brambo, the grazza and the siffa.
 * Each carries the tool of its trade on its body, as every wildermon carries
 * something no field guide has: a brush for a tail, shears for teeth, a
 * cleaver for a beak, millstones for cheeks, a pan for a bill.
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

/* ---- the kemma: a brush for a tail -------------------------------------------------- */

/**
 * A kemma: a soft, round grazer that is always clean, with a broad pink
 * tongue it keeps a little out. Its tail is a hairbrush -- a polished wooden
 * back with rows of bristles under it -- and it grooms with that too.
 */
const KEMMA_SPEC: QuadSpec = { ...pawed({ high: 1.35, len: 2.3, legs: 0.75, neck: 0.4, lean: 55, swing: [22, 36], ears: [40, 20], tail: [0.45, 30, 4] }), nose: 12 };
const KEMMA_HEAD = { c: [0, 0.35, 0.15] as V3, r: [1.08, 1.0, 0.92] as V3 };

function kemmaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = KEMMA_HEAD;
  const face = merge(
    snout(1.05, -0.2, [0.46, 0.34, 0.4], 0.12, n, k),
    // The tongue, a broad pink lick out of the side of the mouth.
    orbAlong([0.12, 1.38, -0.52], [0.25, 1, -0.6], [0.16, 0.06, 0.2], 6, 3, 'tongue'),
  );
  // The brush: a wooden back, long and flat, and two rows of bristles hanging under it.
  const back = tube([[0, 0.05, 0.05], [0, -0.45, 0.1], [0, -1.0, 0.08]], [0.1, 0.32, 0.28], [0.09, 0.11, 0.1], 6, 'wood');
  const bristles = merge(...[-0.18, 0, 0.18].flatMap((x) => [-0.25, -0.45, -0.65, -0.85].map((y) => taper([[x, y, 0], [x * 1.3, y, -0.32]], 0.06, 0.035, 4, 'coatLight'))));
  return quadPieces({
    n, k,
    body: { y: [-1.3, -1.05, -0.5, 0.1, 0.65, 1.0, 1.2], z: [0.1, 0.12, 0.16, 0.18, 0.2, 0.22, 0.24], w: [0.3, 1.0, 1.18, 1.2, 1.12, 0.95, 0.3], h: [0.28, 0.82, 0.95, 0.98, 0.92, 0.8, 0.28], belly: true },
    neck: { w: 0.66, h: 0.66, len: 0.4 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.76, 0.5, 0.32], size: 0.32, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.2] },
    ear: earMesh(0.55, 0.3, n),
    earTurn: 30,
    tail: [merge(taper([[0, 0.05, 0], [0, -0.2, 0]], 0.16, 0.1, n, 'coat'), moved(merge(back, bristles), [0, -0.15, 0]))],
    fore: { upper: [0.28, -0.4, 0.28, 0.24], lower: [0, -0.36, 0.24, 0.22], foot: pawMesh(0.24, n, k, 'coatLight') },
    hind: { upper: [0.3, -0.42, 0.3, 0.26], lower: [0, -0.4, 0.24, 0.22], foot: pawMesh(0.24, n, k, 'coatLight') },
  });
}

export const KEMMA: Kind = {
  bones: quadBonesOf(KEMMA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, now and then it turns its head and licks its own shoulder clean.
    if (a.go <= 0) {
      const lick = beat(a.t, [5.5, 16.8], 2.2) * (1 - a.graze);
      p.neck[1] += 55 * lick;
      p.head[0] += 18 * lick;
    }
  }),
  build: kemmaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ wood: [176, 122, 78], tongue: [236, 132, 150] }), 30),
  shadow: [1.6, 1.25],
  stride: 1.3,
  size: 1.7,
};

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

/* ---- the grista: millstones for cheeks, a broom for a tail ------------------------- */

/**
 * A grista: a stout, dusty creature whose cheeks are a pair of millstones,
 * grooved and grey, and whose tail is a straw broom it sweeps the floor
 * with. It is always a little floury.
 */
const GRISTA_SPEC: QuadSpec = { ...pawed({ high: 1.3, len: 2.4, legs: 0.7, neck: 0.35, lean: 65, swing: [20, 34], ears: [45, 20], tail: [0.5, -10, 4] }), nose: 10 };
const GRISTA_HEAD = { c: [0, 0.35, 0.1] as V3, r: [1.15, 1.0, 0.95] as V3 };

function gristaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = GRISTA_HEAD;
  // A millstone on each cheek: a thick grey disc, its face cut with grooves, its eye in the middle.
  const stone = (s: number): Mesh => {
    const c: V3 = [s * 0.98, 0.55, -0.15];
    const d: V3 = [s, 0.25, 0];
    return merge(
      tube([c, add(c, scale(d, 0.16))], 0.42, 0.42, 10, 'stone', { up: [0, 0, 1] }),
      paint([
        disc(add(c, scale(d, 0.17)), d, 0.42, 0.42, 10, 'stone'),
        ...[0, 1, 2, 3].map((q) => disc(add(c, scale(d, 0.175)), d, 0.4, 0.035, 4, 'stoneDark', { spin: (q / 4) * Math.PI })),
        disc(add(c, scale(d, 0.18)), d, 0.08, 0.08, 6, 'stoneDark'),
      ]),
    );
  };
  const face = merge(snout(1.08, -0.18, [0.44, 0.34, 0.36], 0.12, n, k), stone(-1), stone(1));
  // The broom: a short handle and a fan of straw bound round with a band.
  const broom = merge(
    taper([[0, 0.05, 0], [0, -0.3, 0]], 0.08, 0.07, 6, 'wood'),
    tube([[0, -0.28, 0], [0, -0.36, 0]], 0.12, 0.12, 6, 'leatherDark'),
    ...[-0.18, -0.09, 0, 0.09, 0.18].map((x) => taper([[x * 0.4, -0.34, 0], [x, -0.85, 0]], 0.05, 0.04, 4, 'stem')),
  );
  // Flour dusted on its back and its feet.
  const dust = paint(([[0, -0.4, 0.98], [0.3, 0.2, 0.92], [-0.35, 0.5, 0.88], [0.1, 0.75, 0.86], [-0.2, -0.85, 0.85]] as V3[]).map((c) => disc(c, [c[0] * 0.5, 0, 1], 0.2, 0.16, 7, 'coatLight')));
  return quadPieces({
    n, k,
    body: { y: [-1.35, -1.1, -0.55, 0.05, 0.65, 1.05, 1.25], z: [0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2], w: [0.3, 1.08, 1.25, 1.28, 1.22, 1.05, 0.32], h: [0.26, 0.8, 0.92, 0.95, 0.9, 0.78, 0.26], belly: true },
    neck: { w: 0.7, h: 0.68, len: 0.35 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.66, 0.6, 0.34], size: 0.28, rim: 0.12 } },
    ear: earMesh(0.36, 0.24, n),
    earTurn: 35,
    tail: [broom],
    fore: { upper: [0.26, -0.36, 0.28, 0.24], lower: [0, -0.32, 0.24, 0.22], foot: pawMesh(0.24, n, k, 'coatLight') },
    hind: { upper: [0.28, -0.38, 0.3, 0.26], lower: [0, -0.34, 0.24, 0.22], foot: pawMesh(0.24, n, k, 'coatLight') },
    extras: [{ key: 'dust', mesh: dust, bone: 'trunk', bias: 0.03, after: ['body'] }],
  });
}

export const GRISTA: Kind = {
  bones: quadBonesOf(GRISTA_SPEC, (p, a) => {
    trot(p, a);
    // Standing, it grinds: the jaw going round, which is the head nodding and turning a little in a circle; and the broom sweeps.
    if (a.go <= 0) {
      const g = beat(a.t, [3.1, 11.4, 18.8], 2.6) * (1 - a.graze);
      p.head[0] += 4 * Math.sin(a.t * TAU * 1.5) * g;
      p.head[1] += 4 * Math.cos(a.t * TAU * 1.5) * g;
      p.tail[1] += 22 * cyc(a.t, 4);
    }
  }),
  build: gristaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ stone: [170, 166, 160], stoneDark: [118, 114, 110], wood: [164, 118, 76], stem: [222, 192, 120], leatherDark: [120, 84, 60] }), 40),
  shadow: [1.7, 1.3],
  stride: 1.4,
  size: 1.75,
};

/* ---- the wicka: moth wings and a candle-flame tail -------------------------------- */

/**
 * A wicka: a small, soft thing on four little legs with a moth's wings
 * folded along its back -- eyed like a moth's -- and two feathered feelers,
 * and the tuft of its tail is a candle flame that is always alight.
 */
const WICKA_SPEC: QuadSpec = { ...pawed({ high: 1.05, len: 1.6, legs: 0.6, neck: 0.3, lean: 40, swing: [26, 42], ears: [20, 30], tail: [0.35, 40, 20] }), nose: 12 };
const WICKA_HEAD = { c: [0, 0.3, 0.2] as V3, r: [1.0, 0.92, 0.9] as V3 };

function wickaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = WICKA_HEAD;
  const face = snout(0.95, -0.24, [0.34, 0.28, 0.3], 0.1, n, k);
  // A feeler: a thin curved stalk with a fringe of fine barbs, like a moth's.
  const feeler = merge(
    tube(curve([0, 0, 0], [0, 0.25, 0.5], [0, 0.55, 0.75], 4), 0.035, 0.03, 4, 'stem'),
    ...[0.2, 0.35, 0.5, 0.65].map((t) => {
      const p: V3 = [0, 0.55 * t * 1.2, 0.75 * Math.min(1, t * 1.4)];
      return merge(taper([p, add(p, [0.14, 0.04, 0.04])], 0.02, 0.01, 3, 'stem'), taper([p, add(p, [-0.14, 0.04, 0.04])], 0.02, 0.01, 3, 'stem'));
    }),
  );
  // A wing: a broad rounded membrane folded back along the flank, an eye-spot painted on it.
  const wing = (s: number): Mesh => merge(
    blade(curve([s * 0.4, 0.5, 0.75], [s * 0.95, -0.2, 0.95], [s * 0.7, -1.1, 0.6], 4), [0.12, 0.5, 0.6, 0.45, 0.08], [s, 0, 0.5], { mat: 'membrane', thick: 0.03 }),
    paint([disc([s * 0.86, -0.3, 0.88], [s, 0, 0.5], 0.16, 0.2, 8, 'spot'), disc([s * 0.89, -0.3, 0.885], [s, 0, 0.5], 0.07, 0.09, 6, 'lid')]),
  );
  // The tail's tuft: a candle flame, yellow at the heart.
  const flame = merge(orbAlong([0, -0.4, 0.15], [0, -0.4, 1], [0.13, 0.13, 0.26], 6, 4, 'flame'), orbAlong([0, -0.4, 0.1], [0, -0.4, 1], [0.07, 0.07, 0.14], 5, 3, 'ember'));
  return quadPieces({
    n, k,
    body: { y: [-0.85, -0.7, -0.3, 0.1, 0.45, 0.7, 0.85], z: [0.1, 0.12, 0.16, 0.2, 0.24, 0.27, 0.3], w: [0.24, 0.72, 0.84, 0.86, 0.82, 0.7, 0.24], h: [0.24, 0.66, 0.78, 0.8, 0.76, 0.64, 0.24], belly: true },
    neck: { w: 0.5, h: 0.5, len: 0.3 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.72, 0.55, 0.36], size: 0.36, rim: 0.12 }, blush: [[0.86, 0.36, -0.28], 0.17] },
    ear: feeler,
    earTurn: 10,
    tail: [merge(taper([[0, 0.05, 0], [0, -0.35, 0]], 0.12, 0.06, n, 'coat'), flame)],
    fore: { upper: [0.24, -0.32, 0.18, 0.16], lower: [0, -0.28, 0.16, 0.14], foot: pawMesh(0.17, n, k, 'mark') },
    hind: { upper: [0.24, -0.32, 0.2, 0.17], lower: [0, -0.3, 0.17, 0.15], foot: pawMesh(0.17, n, k, 'mark') },
    extras: [
      { key: 'wing0', mesh: wing(-1), bone: 'trunk', bias: 0.06, after: ['body'], thin: true },
      { key: 'wing1', mesh: wing(1), bone: 'trunk', bias: 0.06, after: ['body'], thin: true },
    ],
  }).map((pc) => (pc.key === 'ear0' || pc.key === 'ear1' ? { ...pc, thin: true, airy: true } : pc));
}

export const WICKA: Kind = {
  bones: quadBonesOf(WICKA_SPEC, (p, a) => {
    trot(p, a);
    // The feelers always moving a little; standing, a flutter of the wings now and then lifts it on its toes.
    p.ears[0][0] += 10 * cyc(a.t, 6);
    p.ears[1][0] += 10 * cyc(a.t, 6, 1.3);
    if (a.go <= 0) p.lift += 0.08 * beat(a.t, [7.4, 19.0], 0.8) * Math.abs(Math.sin(a.t * TAU * 4));
  }),
  build: wickaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ membrane: darker(pastel(mark), 0.08), spot: darker(pastel(coat), 0.3), stem: [150, 130, 100], flame: [255, 200, 90], ember: [255, 244, 190] }), 40),
  // The flame at the tip of its tail throws a little light, flickering.
  glow: (b, a) => (b.tail0 ? [{ p: place(b.tail0, [0, -0.4, 0.2]), r: 0.6, c: [255, 196, 110] as RGB, a: 0.22 + 0.06 * Math.sin(a.t * Math.PI * 6) }] : []),
  shadow: [1.0, 0.8],
  stride: 1.4,
  size: 1.35,
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

/* ---- the grazza: a crest of grass and a scythe of a tail -------------------------- */

/**
 * A grazza: a low, wide grazer, flat as the blade of a scythe. A crest of
 * long grass grows along its back, and its tail is a scythe blade, curved
 * and bright, that it carries low over the ground.
 */
const GRAZZA_SPEC: QuadSpec = { ...pawed({ high: 1.1, len: 2.8, legs: 0.6, neck: 0.4, lean: 75, swing: [20, 32], ears: [60, 20], tail: [0.5, -8, -2] }), nose: 10, graze: 40 };
const GRAZZA_HEAD = { c: [0, 0.4, 0.05] as V3, r: [1.1, 1.0, 0.82] as V3 };

function grazzaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = GRAZZA_HEAD;
  const face = snout(1.1, -0.15, [0.5, 0.3, 0.42], 0.12, n, k);
  // The crest: tufts of long grass blades in a row down the middle of the back.
  const crest = merge(...[-0.9, -0.5, -0.1, 0.3, 0.7].flatMap((y, q) => [-0.18, 0, 0.18].map((x, j) => {
    const lean = (j - 1) * 0.18;
    return blade(curve([x * 0.5, y, 0.68], [x + lean * 0.5, y - 0.1, 1.05], [x + lean, y - 0.25, 1.35 + (q % 2) * 0.1], 3), [0.04, 0.08, 0.05, 0.01], [1, 0, 0], { mat: j === 1 ? 'leaf' : 'leafDark' });
  })));
  // The scythe: a long curved steel blade off a short snath, carried low.
  const scythe = merge(
    taper([[0, 0.05, 0], [0, -0.3, 0]], 0.1, 0.08, 6, 'wood'),
    tube(curve([0, -0.3, 0], [0.3, -0.75, -0.05], [0.85, -0.95, -0.1], 5), [0.06, 0.12, 0.14, 0.12, 0.08, 0.01], [0.03, 0.035, 0.035, 0.03, 0.02, 0.01], 4, 'blade', { up: [0, 0, 1] }),
  );
  return quadPieces({
    n, k,
    body: { y: [-1.5, -1.25, -0.6, 0.0, 0.6, 1.15, 1.4], z: [0.05, 0.06, 0.08, 0.1, 0.1, 0.12, 0.14], w: [0.3, 1.15, 1.3, 1.32, 1.28, 1.12, 0.32], h: [0.22, 0.58, 0.66, 0.68, 0.66, 0.58, 0.22], belly: true },
    neck: { w: 0.66, h: 0.56, len: 0.4 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.72, 0.56, 0.36], size: 0.3, rim: 0.12 }, blush: [[0.86, 0.38, -0.26], 0.18] },
    ear: earMesh(0.42, 0.26, n),
    earTurn: 40,
    tail: [scythe],
    fore: { upper: [0.24, -0.3, 0.26, 0.24], lower: [0, -0.28, 0.24, 0.22], foot: pawMesh(0.24, n, k, 'coatDark') },
    hind: { upper: [0.26, -0.32, 0.28, 0.26], lower: [0, -0.3, 0.24, 0.22], foot: pawMesh(0.24, n, k, 'coatDark') },
    extras: [{ key: 'crest', mesh: crest, bone: 'trunk', bias: 0.05, after: ['body'], thin: true, airy: true }],
  });
}

export const GRAZZA: Kind = {
  bones: quadBonesOf(GRAZZA_SPEC, (p, a) => {
    trot(p, a);
    // The scythe swung from side to side as it grazes, as a mower's is.
    p.tail[1] += 26 * a.graze * Math.sin(a.t * TAU * 0.6);
  }),
  build: grazzaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ leaf: [170, 210, 110], leafDark: [124, 170, 84], blade: [214, 220, 228], wood: [160, 116, 76] }), 90),
  shadow: [1.9, 1.4],
  stride: 1.45,
  size: 1.8,
};

/* ---- the siffa: a pan for a bill ---------------------------------------------------- */

/**
 * A siffa: a long-legged shore wader whose bill ends in a shallow pan, a
 * round dish it swirls the wet sand in; a nugget of something bright sits
 * in the bottom of it more often than not. A crest of three plumes sweeps
 * back from its head.
 */
const SIFFA_SPEC: BirdSpec = {
  high: 2.6,
  leg: { at: [0.3, 0.05, -0.42], len: [0.28, 1.75, 0.08], rest: [18, -36] },
  neck: { at: [0, 0.7, 0.32], len: 1.1, lean: 18 },
  head: { pitch: -8 },
  wing: { at: [0.58, 0.32, 0.26] },
  tail: { at: [0, -1.0, 0.05], lift: -8 },
  swing: [22, 34],
  thrust: 12,
  peck: 100,
  tip: 44,
  nose: 12,
  crouch: 0.8,
  stance: 1.4,
};
const SIFFA_HEAD = { c: [0, 0.12, 0.22] as V3, r: [0.62, 0.7, 0.58] as V3 };

function siffaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 7);
  const ys = [-1.05, -0.8, -0.3, 0.25, 0.65, 0.9];
  const body = tube(ys.map((y, q) => [0, y, [0.0, 0.04, 0.08, 0.14, 0.24, 0.32][q]] as V3), [0.2, 0.6, 0.74, 0.72, 0.54, 0.2], [0.2, 0.56, 0.68, 0.64, 0.48, 0.2], n,
    (ring, j) => (ring > 0 && under(n, j, 1.2) ? 'mark' : 'coat'));
  const neck = tube([[0, 0, -0.2], [0, -0.08, 0.4], [0, 0.1, 0.8], [0, 0.04, 1.1]], [0.32, 0.26, 0.24, 0.26], [0.32, 0.26, 0.24, 0.26], n,
    (ring, j) => (under(n, (j + n / 4) % n, 1.0) ? 'mark' : 'coat'), { seam: 'both' });
  const H = SIFFA_HEAD;
  const skull = orb(H.c, H.r, n + 1, k, 'coat');
  const look = (shut: boolean): Mesh => eyes(H.c, H.r, [0.85, 0.42, 0.3], 0.25, { tall: 1.12, shut, rim: 0.16 });
  // The bill: a long straight shank, and at its end the pan, a shallow round dish tipped up, a bright nugget in the bottom.
  const pan = merge(
    tube([[0, 0.55, 0.12], [0, 1.1, 0.06], [0, 1.45, 0.02]], [0.1, 0.07, 0.06], [0.07, 0.05, 0.05], n, 'bill', { up: [1, 0, 0] }),
    tube([[0, 1.75, -0.02], [0, 1.75, 0.08]], [0.26, 0.36], [0.26, 0.36], 10, 'billDark', { up: [0, 1, 0], seam: 'end' }),
    paint([disc([0, 1.75, -0.015], [0, 0, 1], 0.25, 0.25, 10, 'bill')]),
    orb([0.06, 1.72, 0.03], 0.07, 5, 3, 'crystal'),
  );
  const plumes = merge(...([[-0.12, 0.25, -0.75], [0.0, 0.45, -1.0], [0.12, 0.2, -1.25]] as V3[]).map(([x, up, back]) =>
    blade(curve([x, -0.2, 0.5], [x * 1.4, back * 0.5, 0.9 + up], [x * 2, back, 0.6 + up], 3), [0.04, 0.1, 0.08, 0.01], [1, 0, 0], { mat: 'featherDark' })));
  const tail = merge(...[-0.3, 0, 0.3].map((sp) => blade(curve([0, 0, 0], [sp * 0.3, -0.45, -0.02], [sp * 0.6, -0.85, -0.12], 3), [0.05, 0.16, 0.14, 0.02], [0, 0.2, 1], { mat: 'featherDark' })));
  const wing = (): Mesh => tube([[0, 0.1, 0.05], [0, -0.3, 0.02], [0, -0.75, -0.06], [0, -1.2, -0.12], [0, -1.45, -0.14]], [0.28, 0.4, 0.36, 0.22, 0.03], 0.08, n, (ring) => (ring === 0 ? 'coat' : 'feather'), { up: [1, 0, 0] });
  const hide = [{ c: H.c, r: H.r }];
  return [
    { key: 'body', mesh: body, bone: 'body', bias: 0, breathes: { c: [0, 0, 0.1], k: 0.05 } },
    { key: 'tail', mesh: tail, bone: 'tail0', bias: -0.05 },
    { key: 'neck', mesh: neck, bone: 'neck', bias: 0, under: 'head' },
    { key: 'head', mesh: merge(skull, look(false)), shut: merge(skull, look(true)), bone: 'head', bias: 0.2 },
    { key: 'pan', mesh: pan, bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'plumes', mesh: plumes, bone: 'head', bias: 0.19, hide },
    { key: 'wing0', mesh: mirrored(wing()), bone: 'wing0', bias: 0.03, after: 'body', front: [-1, 0, 0] },
    { key: 'wing1', mesh: wing(), bone: 'wing1', bias: 0.03, after: 'body', front: [1, 0, 0] },
    ...birdLegPieces('bl', -1, 1.75, 0.09, 5),
    ...birdLegPieces('br', 1, 1.75, 0.09, 5),
  ];
}

export const SIFFA: Kind = {
  bones: (a) => birdBones(SIFFA_SPEC, a, (p) => {
    // Foraging, it swirls the pan: the head going round in a small circle over the sand.
    if (a.graze > 0) {
      p.head[1] += 10 * Math.sin(a.t * TAU * 1.2) * a.graze;
      p.head[2] += 10 * Math.cos(a.t * TAU * 1.2) * a.graze;
    } else if (a.go <= 0) {
      p.head[1] = lerp(p.head[1], p.head[1] * 0.6, 1);
    }
  }),
  build: siffaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, OWN({ bill: [206, 196, 176], billDark: [150, 140, 120], crystal: [250, 214, 96], claw: [214, 150, 120] }), 200),
  shadow: [1.4, 1.0],
  stride: 1.1,
  size: 2.4,
};
