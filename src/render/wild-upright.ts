import {
  add, beat, bend, bipedBones, coatPalette, cross, curve, cyc, darker, disc, drift, eyes, lighter, merge, mirrored, mix, moved, onEgg, orb, orbAlong, paint,
  pastel, scale, sub, taper, TAU, tube, unit, type BipedPose, type BipedSpec, type Disc, type Kind, type Piece,
} from './beasts';
import type { Mat, Mesh, V3 } from './figure';
import { blade, cut } from './beastkit';
import { MONSTER_GROWTH } from './monster-size';

/**
 * The ones that stand up: the three bad things of the high ground -- the
 * goblin, the orc and the ogre -- each a chunky soft-edged body like every
 * other wildermon, and each with what it carries in its hand. (The tinka is
 * the mend line now, `./wild-mend`; the orc's three subspecies are drawn in
 * `./wild-orc`.)
 */

/** Arms and legs on the upright bones: an upper and a lower tube down each, a hand and a foot as the kind makes them. */
function limbs(o: { n: number; arm: [number, number]; armW: [number, number]; hand: Mesh; leg: [number, number]; legW: [number, number]; foot: Mesh; armMat?: Mat; legMat?: Mat }): Piece[] {
  const out: Piece[] = [];
  for (const [k, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    out.push(
      { key: `arm${k}`, mesh: tube([[0, 0, 0.12], [0, 0, -o.arm[0]]], [o.armW[0], o.armW[0] * 0.9], [o.armW[0], o.armW[0] * 0.9], o.n, o.armMat ?? 'coat', { seam: 'both' }), bone: `arm${k}`, bias: 0.03, after: 'body', front, convex: true },
      { key: `fore${k}`, mesh: tube([[0, 0, 0.05], [0, 0, -o.arm[1]]], [o.armW[1], o.armW[1] * 0.92], [o.armW[1], o.armW[1] * 0.92], o.n, o.armMat ?? 'coat', { seam: 'both' }), bone: `elbow${k}`, bias: 0.035, after: 'body', front, convex: true },
      { key: `hand${k}`, mesh: sd < 0 ? mirrored(o.hand) : o.hand, bone: `hand${k}`, bias: 0.04, after: 'body', front },
    );
  }
  for (const [key, sd] of [['ll', -1], ['lr', 1]] as Array<[string, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    out.push(
      // After the hips as well as the body: the near thigh comes out over the seat of the hips however far it swings back.
      { key: `${key}0`, mesh: tube([[0, 0, 0.12], [0, 0, -o.leg[0]]], [o.legW[0], o.legW[0] * 0.9], [o.legW[0], o.legW[0] * 0.9], o.n, o.legMat ?? 'coat', { seam: 'both' }), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front, convex: true },
      { key: `${key}1`, mesh: tube([[0, 0, 0.05], [0, 0, -o.leg[1]]], [o.legW[1], o.legW[1] * 0.92], [o.legW[1], o.legW[1] * 0.92], o.n, o.legMat ?? 'coat', { seam: 'both' }), bone: `${key}1`, bias: 0.015, after: 'body', front, convex: true },
      { key: `${key}2`, mesh: sd < 0 ? mirrored(o.foot) : o.foot, bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/**
 * A hand: a palm and `fingers` fingers `len` long fanned forward and down
 * from it, the thumb in; each finger `thick` of the palm across at its root,
 * in a colour of its own if it has one, and its last joint in another if
 * its tips are dark.
 */
function hand(r: number, fingers: number, len: number, n: number, mat: Mat = 'coat', o: { thick?: number; fingerMat?: Mat; tipMat?: Mat } = {}): Mesh {
  const spread = 0.5, w = o.thick ?? 0.24;
  const fingerMat = o.fingerMat ?? mat, tipMat = o.tipMat;
  return merge(
    orbAlong([0, r * 0.3, -r * 0.4], [0, 0.4, -1], [r * 0.9, r * 0.8, r], n, 4, mat),
    ...Array.from({ length: fingers }, (_, q) => {
      const a = fingers > 1 ? (q / (fingers - 1) - 0.5) * spread * 2 : 0;
      const root: V3 = [Math.sin(a) * r * 0.6, r * 0.55, -r * 0.9];
      const mid = add(root, [Math.sin(a) * len * 0.35, len * 0.35, -len * 0.4]), tip = add(root, [Math.sin(a) * len * 0.6, len * 0.45, -len * 0.95]);
      // A dark tip is the last fifth of the finger.
      return tipMat
        ? taper([0, 0.45, 0.8, 1].map((t) => bend(root, mid, tip, t)), r * w, r * w * 0.66, 5, (ring) => (ring >= 2 ? tipMat : fingerMat))
        : taper(curve(root, mid, tip, 2), r * w, r * w * 0.66, 5, fingerMat);
    }),
  );
}

/** A bare foot: a soft lump forward of the ankle, toes rounded. */
const pawFoot = (r: number, len: number, n: number, mat: Mat = 'coat'): Mesh => orbAlong([0, len * 0.35, -r * 0.55], [0, 1, 0], [r, len * 0.62, r * 0.6], n, 4, mat);

/* ---- a monster's face -------------------------------------------------------------- */

/** The corners of a flat shape, in the order that makes it face out along `n` (the way `render` tells which way a facet faces). */
function outward(v: V3[], n: V3): V3[] {
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const a = v[q], b = v[(q + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v;
}

/**
 * The glower the bad things of the high ground have instead of the round
 * eyes every other wildermon looks back with: over eyes made by `eyes` with
 * the same `dir`, `size` and `tall`, a lid on the top of each whose lower edge
 * is a straight line sloping down toward the nose -- `drop` of the eye's
 * height down at its middle, lower by `slope` of it at the inner corner --
 * and above it a heavy brow along the skin, sloping the same way and
 * thickest over the nose. The lids are painted on the head, after its eyes;
 * the brows are a piece of their own, drawn over the head.
 */
export function glower(c: V3, r: V3, dir: V3, size: number, o: { tall?: number; drop?: number; slope?: number; brow?: number } = {}): { lids: Mesh; brows: Mesh } {
  const tall = o.tall ?? 1.15, drop = o.drop ?? 0.4, slope = o.slope ?? 0.3, br = o.brow ?? size * 0.3;
  const A = size * 1.12, B = size * tall * 1.12;
  const lids: Disc[] = [];
  const brows: Mesh[] = [];
  for (const s of [1, -1]) {
    const { p, n } = onEgg(c, r, [dir[0] * s, dir[1], dir[2]]);
    // Across the eye toward the nose, and up it.
    let u = unit(cross([0, 0, 1], n));
    if (u[0] * s > 0) u = scale(u, -1);
    let w = cross(n, u);
    if (w[2] < 0) w = scale(w, -1);
    const at = (a: number, b: number, lift: number): V3 => add(add(p, scale(n, lift)), add(scale(u, a), scale(w, b)));
    // The lid: the top of an ellipse a little bigger than the eye, cut off along the sloping line.
    const edge = (a: number): number => B * (1 - 2 * drop) - (slope * B * a) / A;
    const round: Array<[number, number]> = Array.from({ length: 16 }, (_, q) => [Math.cos((q / 16) * TAU) * A, Math.sin((q / 16) * TAU) * B]);
    const lid: Array<[number, number]> = [];
    round.forEach(([a0, b0], q) => {
      const [a1, b1] = round[(q + 1) % round.length];
      const f0 = b0 - edge(a0), f1 = b1 - edge(a1);
      if (f0 >= 0) lid.push([a0, b0]);
      if (f0 >= 0 !== f1 >= 0) lid.push([a0 + ((a1 - a0) * f0) / (f0 - f1), b0 + ((b1 - b0) * f0) / (f0 - f1)]);
    });
    lids.push({ v: outward(lid.map(([a, b]) => at(a, b, 0.06)), n), m: 'lid' });
    // The brow, a little above the lid, laid on the skin.
    const pts = [-1.15, 0, 1.15].map((f) => {
      const on = onEgg(c, r, sub(at(f * A, B * (1.2 - slope * f * 0.9), 0), c));
      return add(on.p, scale(on.n, br * 0.45));
    });
    brows.push(tube(pts, [br * 0.7, br, br * 1.1], [br * 0.6, br * 0.85, br * 0.95], 5, 'coatDark'));
  }
  return { lids: paint(lids), brows: merge(...brows) };
}

/**
 * A mouth laid along the skin of a head through `dirs` (ways out of the
 * middle of it), `w` thick, with teeth hanging from the top of it: each tooth
 * where along the mouth it is (nought to one) and how long.
 */
function grin(c: V3, r: V3, dirs: V3[], w: number, teeth: Array<[number, number]>): Mesh {
  const on = dirs.map((d) => onEgg(c, r, d));
  const pts = on.map(({ p, n }) => add(p, scale(n, w * 0.8)));
  const fangs = teeth.map(([f, len]): Disc => {
    const x = f * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)), k = x - i;
    const n = unit(add(scale(on[i].n, 1 - k), scale(on[i + 1].n, k)));
    const along = unit(sub(pts[i + 1], pts[i]));
    let down = unit(cross(along, n));
    if (down[2] > 0) down = scale(down, -1);
    const base = add(add(pts[i], scale(sub(pts[i + 1], pts[i]), k)), scale(n, w * 1.3));
    return { v: outward([add(base, scale(along, -len * 0.42)), add(base, scale(along, len * 0.42)), add(base, scale(down, len))], n), m: 'tooth' };
  });
  return merge(tube(pts, w, w, 4, 'nose'), paint(fangs));
}

/* ---- the goblin -------------------------------------------------------------------- */

/**
 * A goblin: knee-high, green-grey and entirely malice, all ears and grin,
 * in a jerkin somebody else made -- patched, belted, too big -- and holding
 * a notched blade it did not make either.
 */
const GOBLIN_SPEC: BipedSpec = {
  high: 1.0,
  leg: { at: [0.34, 0, -0.1], len: [0.46, 0.46, 0.1], rest: [16, -32] },
  chest: { at: [0, 0, 0.18], lean: 20 },
  neck: { at: [0, 0.12, 1.02], len: 0.2, lean: 0 },
  head: { pitch: -8 },
  arm: { at: [0.68, 0.1, 0.8], len: [0.5, 0.5], rest: [10, 16, 30] },
  swing: [32, 46],
  waddle: 6,
  armSwing: 24,
};

const GOBLIN_HEAD = { c: [0, 0.14, 0.58] as V3, r: [0.95, 0.9, 0.84] as V3 };

/** Where the cutting edge of the goblin's blade is, along it: its line, with two notches bitten out of it. */
const GOBLIN_EDGE: Array<[number, number]> = [[0.05, 0.2], [0.3, 0.26], [0.52, 0.27], [0.62, 0.06], [0.72, 0.26], [0.9, 0.25], [1.0, 0.07], [1.1, 0.22], [1.3, 0.14], [1.48, 0.02]];

function goblinBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  // The jerkin: leather, too big for it, belted, with a patch sewn on in another leather.
  const jerkin = merge(
    tube([[0, 0, -0.35], [0, 0.03, 0.05], [0, 0.04, 0.55], [0, 0.02, 0.95], [0, 0, 1.12]], [0.66, 0.72, 0.68, 0.56, 0.32], [0.6, 0.64, 0.6, 0.5, 0.3], n, 'leather', { up: [0, 1, 0] }),
    tube([[0, 0.02, 0.12], [0, 0.02, 0.24]], 0.76, 0.68, n, 'leatherDark', { up: [0, 1, 0] }),
    paint([disc([0.28, 0.64, 0.6], [0.3, 1, 0], 0.18, 0.2, 4, 'mark', { spin: 0.3 }), disc([0, 0.72, 0.18], [0, 1, 0], 0.1, 0.08, 4, 'crystal')]),
  );
  const H = GOBLIN_HEAD;
  const skull = orb(H.c, H.r, n + 1, k + 1, 'coat');
  // Malice: the eyes big and yellow under lids that slope down to a long nose, and a grin laid right round the face with three
  // teeth in it. The eyes far enough round that one is whole inside the outline seen side on.
  const eyeDir: V3 = [0.66, 0.74, 0.12];
  const { lids, brows } = glower(H.c, H.r, eyeDir, 0.3, { tall: 0.95, drop: 0.42, slope: 0.32, brow: 0.08 });
  const face = merge(
    orbAlong(add(H.c, [0, 1.0, -0.1]), [0, 1, -0.35], [0.17, 0.3, 0.3], n, k, 'coat'),
    grin(H.c, H.r, [[-0.55, 0.8, -0.28], [-0.3, 0.9, -0.5], [0, 0.9, -0.58], [0.3, 0.9, -0.5], [0.55, 0.8, -0.28]], 0.045, [[0.3, 0.15], [0.55, 0.17], [0.74, 0.14]]),
  );
  const look = (shut: boolean): Mesh => merge(eyes(H.c, H.r, eyeDir, 0.3, { tall: 0.95, shut, iris: 'bloom', pupil: 0.32, rim: 0 }), lids);
  // Ears: long and pointed, swept out and back from the sides of the head and a little up, pink inside, so that they show their
  // length seen side on and make a V seen from in front. Each is thick at the root and its flat rolled toward the sky, so the far
  // one, seen past the head from in front and to the side, is a pointed ear and not a leaf seen edge on as a stick.
  const earThick = [0.16, 0.15, 0.12, 0.07, 0.01];
  const ear = (s: number): Mesh => {
    const root = add(H.c, [s * 0.72, -0.05, 0.25]), mid = add(H.c, [s * 1.12, -0.5, 0.42]), tip = add(H.c, [s * 1.58, -1.22, 0.62]);
    const along = unit(sub(tip, root)), up: V3 = [s * 0.45, 0.35, 0.82];
    const face = unit(sub(up, scale(along, along[0] * up[0] + along[1] * up[1] + along[2] * up[2])));
    // The pink laid on the flat two fifths of the way out, where the ear is between its second ring and its third.
    const lift = earThick[1] + (earThick[2] - earThick[1]) * 0.6 + 0.01;
    return merge(
      tube(curve(root, mid, tip, 4), [0.34, 0.33, 0.25, 0.12, 0.01], earThick, n, 'coat', { up }),
      paint([disc(add(bend(root, mid, tip, 0.4), scale(face, lift)), face, 0.34, 0.15, 6, 'inner', { up: cross(face, along) })]),
    );
  };
  // The blade: short, broad and notched, in dark iron with its edge ground bright; a bar for a guard, a grip bound in rag. Its
  // back is straight, and the notches are bitten out of its edge.
  const back = -0.2;
  const sword = merge(
    blade(GOBLIN_EDGE.map(([y, e]) => [0, y, (e + back) / 2] as V3), GOBLIN_EDGE.map(([, e]) => (e - back) / 2), [1, 0, 0], { mat: 'stone', rib: 'stoneDark', fold: 0.04, thick: 0.06 }),
    blade(GOBLIN_EDGE.slice(0, -1).map(([y, e]) => [0, y, e - 0.035] as V3), GOBLIN_EDGE.slice(0, -1).map(() => 0.035), [1, 0, 0], { mat: 'spot', fold: 0, thick: 0.075 }),
    tube([[0, 0.03, -0.26], [0, 0.03, 0.3]], 0.055, 0.055, 5, 'bark'),
    tube([[0, 0.02, 0], [0, -0.28, 0]], 0.06, 0.06, 5, 'leatherDark'),
  );
  // Held tipped out, away from its own face.
  const grip = moved(sword, [0, 0.1, -0.12], -28, -30, 0);
  const hide = [{ c: H.c, r: H.r }];
  return [
    { key: 'hips', mesh: orb([0, 0, 0], [0.6, 0.52, 0.48], n, k, 'leatherDark'), bone: 'body', bias: 0 },
    { key: 'body', mesh: jerkin, bone: 'chest', bias: 0.005, breathes: { c: [0, 0, 0.4], k: 0.04 } },
    { key: 'head', mesh: merge(skull, face, look(false)), shut: merge(skull, face, look(true)), bone: 'head', bias: 0.2 },
    { key: 'brows', mesh: brows, bone: 'head', bias: 0.21, after: 'head', hide },
    // Each ear a piece of its own, over the head and hidden where it goes round behind it: laid back along the head as they are,
    // the head would otherwise cover the near one from one side and the far one would show through it from the other.
    { key: 'ear0', mesh: ear(-1), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear1', mesh: ear(1), bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'sword', mesh: grip, bone: 'hand1', bias: 0.05, after: ['hand1', 'body'], front: [1, 0.4, 0] },
    ...limbs({ n, arm: [0.5, 0.5], armW: [0.16, 0.14], hand: hand(0.18, 4, 0.22, n), leg: [0.46, 0.46], legW: [0.2, 0.17], foot: pawFoot(0.19, 0.5, n) }),
  ];
}

export { MONSTER_GROWTH };

export const GOBLIN: Kind = {
  bones: (a) => bipedBones(GOBLIN_SPEC, a, (p: BipedPose) => {
    // The blade held out ahead of it at the belly, point forward and out, going or standing: low enough that seen side on it is
    // under the face rather than across it however far the head turns, and seen from in front and to the side, out past the grin.
    p.arms[1] = [p.arms[1][0] * 0.4 + 14, p.arms[1][1] + 33, p.arms[1][2] + 10];
    if (a.go > 0) return;
    const t = a.t;
    // Shifty: a quick look to one side, held a moment and snapped back, then one to the other -- never so far round that its face
    // is gone, and between them facing ahead, so that seen side on its face is there most of the time -- a crouch, and the flat
    // of the blade slapped into the other palm.
    const glance = (at: number[]): number => Math.min(1, 2 * beat(t, at, 2.4));
    const shift = glance([0.6, 9.4, 16.8]) - glance([5.4, 13.6, 21.2]) + 0.15 * drift(t, 1.3);
    p.head[1] = 14 * shift;
    p.neck[1] = 4 * shift;
    const slap = beat(t, [4.4, 12.8, 20.1], 0.7);
    p.arms[0] = [p.arms[0][0] + 40 * slap, p.arms[0][1] - 10 * slap, p.arms[0][2] + 50 * slap];
    p.arms[1] = [p.arms[1][0] + 10 * slap, p.arms[1][1] - 12 * slap, p.arms[1][2] + 10 * slap];
    p.legs = p.legs.map((l) => [l[0] + 6 * (0.5 + 0.5 * cyc(t, 3)), l[1] + 0.12 * (0.5 + 0.5 * cyc(t, 3)), l[2]] as [number, number, number]);
  }),
  build: goblinBuild,
  palette: (coat, mark) => {
    // The green-grey skin taken halfway to a pale lime: the variants' own green-grey is nearly the colour of the grass it stands on,
    // and this stands off it by being lighter and yellower.
    const skin = mix(pastel(coat, 90), [214, 226, 160], 0.5);
    return coatPalette(coat, mark, {
      coat: skin, coatLight: lighter(skin, 0.2),
      leather: [176, 128, 96], leatherDark: [140, 98, 76], mark: mix(pastel(mark), [196, 150, 110], 0.5), bloom: [250, 220, 90], lid: darker(pastel(coat), 0.3),
      coatDark: darker(pastel(coat), 0.45), stone: [150, 158, 172], stoneDark: [122, 130, 146], spot: [236, 242, 250], bark: [150, 110, 84], crystal: [226, 200, 120],
      nose: [70, 50, 60], tooth: [250, 246, 226],
    }, 90);
  },
  shadow: [1.1, 1.0],
  stride: 1.7,
  size: 2.0 * MONSTER_GROWTH,
  blinks: 3,
};

/* ---- the ogre ---------------------------------------------------------------------- */

/**
 * The ogre's bones: a hill of shoulder on short legs, a small head sunk in it.
 * Its three subspecies are built on them in `./wild-ogre`.
 */
export const OGRE_SPEC: BipedSpec = {
  high: 1.4,
  leg: { at: [0.62, 0, -0.1], len: [0.62, 0.62, 0.14], rest: [8, -14] },
  chest: { at: [0, 0, 0.3], lean: 18 },
  neck: { at: [0, 0.55, 1.95], len: 0.2, lean: 30 },
  head: { pitch: -4 },
  arm: { at: [1.62, 0.2, 1.75], len: [1.0, 0.95], rest: [6, 20, 18] },
  swing: [22, 32],
  waddle: 8,
  armSwing: 14,
};
