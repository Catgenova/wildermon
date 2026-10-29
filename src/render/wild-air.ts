import {
  coatPalette, curve, cyc, disc, eyes, frac, LOOP, merge, mirrored, orb, paint, pastel, smile, TAU, tube, type Anim, type Bones, type Kind,
  type Piece,
} from './beasts';
import { joint, ROOT, type Mesh, type RGB, type V3 } from './figure';
import { blade, cut } from './beastkit';

/** The one that does not walk: the lume, which drifts. */

/* ---- the lume ---------------------------------------------------------------------- */

/**
 * A lume: a pale bell of light that drifts a little over the ground on soft
 * moth's wings, trailing ribbons, with a small sleepy face on it and two
 * feathered feelers; the light it gives has nothing to do with fire.
 */
const LUME_RIBBONS = 4;
/** How long each of the three links of a ribbon is: all three together end well clear of the grass, so it is seen to float. */
const LUME_LINK = 0.36;

function lumeBuild(lod: number): Piece[] {
  const n = cut(lod, 9, 12), k = cut(lod, 5, 7);
  // The bell: a dome with a scalloped rim.
  const bell = tube([[0, 0, 0.95], [0, 0, 0.85], [0, 0, 0.55], [0, 0, 0.1], [0, 0, -0.3], [0, 0, -0.42]], [0.05, 0.45, 0.85, 1.05, 1.08, 0.98], [0.05, 0.45, 0.85, 1.05, 1.08, 0.98], n + 2,
    (ring, j) => (ring === 4 && j % 2 ? 'crystalDark' : 'crystal'), { up: [0, 1, 0] });
  const inner = orb([0, 0, 0.05], [0.6, 0.6, 0.5], n, k, 'spot');
  const face = merge(
    eyes([0, 0, 0.2], [1.0, 1.0, 0.9], [0.62, 0.78, 0.05], 0.2, { tall: 1.0, rim: 0.05 }),
    smile([0, 1.06, -0.12], [0, 1, 0], 0.3),
    paint([1, -1].map((s) => disc([s * 0.58, 0.86, -0.08], [s * 0.55, 0.83, 0], 0.14, 0.1, 6, 'petal'))),
  );
  // Feathered feelers: each a little plume off the crown, curved forward and out in a wide V, pale, with a dark quill. Stood
  // straight up, from behind they were a rabbit's ears.
  const feeler = (s: number): Mesh => blade(curve([s * 0.12, 0.28, 0.86], [s * 0.36, 0.58, 1.3], [s * 0.72, 0.9, 1.36], 4), [0.03, 0.1, 0.13, 0.1, 0.03], [s * 0.3, 1, 0.2], { mat: 'petal', rib: 'crystalDark', fold: 0.2, thick: 0.03 });
  // Soft moth's wings: a forewing and a smaller hindwing each side, each with an eye-spot. The forewing is broadest at its end, cut
  // square across as a moth's is, since a wing rounded at both ends and raised is an ear.
  const wing = merge(
    blade(curve([0, 0.1, 0], [0.9, 0.35, 0.14], [1.7, 0.1, 0.2], 4), [0.1, 0.34, 0.48, 0.55, 0.46], [0, 0.2, 1], { mat: 'petal', rib: 'crystalDark', fold: 0.12, thick: 0.04 }),
    blade(curve([0, -0.1, -0.05], [0.7, -0.45, 0.0], [1.15, -0.7, -0.05], 3), [0.1, 0.3, 0.32, 0.08], [0, 0.2, 1], { mat: 'petal', rib: 'crystalDark', fold: 0.1, thick: 0.04 }),
    paint([disc([1.05, 0.28, 0.23], [0, 0.1, 1], 0.16, 0.16, 7, 'bloom', { lit: true }), disc([1.05, 0.28, 0.25], [0, 0.1, 1], 0.07, 0.07, 6, 'crystalDark')]),
  );
  // A ribbon in three links, one colour its whole length and narrowing all the way down, so that it is one streamer and not a leg
  // in joints.
  const across = [0.11, 0.085, 0.06, 0.02];
  const ribbon = (r: number, k2: number): Mesh => blade([[0, 0, 0], [0.03, 0.02, -LUME_LINK / 2], [0, 0, -LUME_LINK]], [across[k2], (across[k2] + across[k2 + 1]) / 2, across[k2 + 1]], [0, 1, 0],
    { twist: 0.9 * (k2 % 2 ? 1 : -1), mat: r % 2 ? 'water' : 'crystal', fold: 0.05, thick: 0.03 });
  const out: Piece[] = [
    // Inked lightly all round: a dark line down the sides of a bell of light is a hood.
    { key: 'bell', mesh: merge(bell, face), bone: 'body', bias: 0, lines: false, airy: true },
    { key: 'inner', mesh: inner, bone: 'body', bias: -0.01, rim: false },
    { key: 'feelers', mesh: merge(feeler(1), feeler(-1)), bone: 'body', bias: 0.01, airy: true },
    { key: 'wing0', mesh: mirrored(wing), bone: 'wing0', bias: 0.02, airy: true, front: [-1, 0, 0] },
    { key: 'wing1', mesh: wing, bone: 'wing1', bias: 0.02, airy: true, front: [1, 0, 0] },
  ];
  for (let r = 0; r < LUME_RIBBONS; r++) {
    for (let k2 = 0; k2 < 3; k2++) out.push({ key: `rib${r}_${k2}`, mesh: ribbon(r, k2), bone: `rib${r}_${k2}`, bias: -0.02, airy: true, chain: `rib${r}` });
  }
  return out;
}

function lumeBones(a: Anim): Bones {
  const t = a.t, go = a.go, w = frac(a.u);
  // Drifting: a slow bob and a slow sway standing; going, leaning into it and bobbing once a stride.
  const bob = (1 - go) * 0.28 * cyc(t, 4) + go * 0.2 * Math.sin(w * TAU);
  const body = joint(ROOT, [0, 0, 2.3 + bob], -14 * go + 4 * cyc(t, 3) * (1 - go), 5 * cyc(t, 2) * (1 - go), 0);
  const b: Bones = { body };
  // The wings from the back of the bell, spread and swept well back as a moth's are, beating slow and soft about level: once
  // every couple of seconds standing, faster going. Raised much over level they stand up from the front like a rabbit's ears;
  // from the sides of the bell, and not swept back, the near one lies across the bell in profile rather than behind it.
  const beatW = (1 - go) * Math.sin(t * TAU * 12 / LOOP) + go * Math.sin(w * TAU * 2);
  for (let k = 0; k < 2; k++) {
    const sd = k ? 1 : -1;
    b[`wing${k}`] = joint(body, [sd * 0.62, -0.55, 0.35], 0, sd * (12 + 12 * beatW), sd * -40);
  }
  // Ribbons hanging from the rim, each link swinging a little behind the one above.
  for (let r = 0; r < LUME_RIBBONS; r++) {
    const ang = (r / LUME_RIBBONS) * TAU + 0.4;
    let prev = joint(body, [Math.cos(ang) * 0.72, Math.sin(ang) * 0.72, -0.4], 0, 0, 0);
    for (let k2 = 0; k2 < 3; k2++) {
      const lag = (1 - go) * 18 * Math.sin(t * TAU * 5 / LOOP - k2 * 0.8 + r) + go * (22 + 8 * Math.sin(w * TAU - k2 * 0.9 + r));
      prev = joint(prev, k2 ? [0, 0, -LUME_LINK] : [0, 0, 0], lag, 6 * Math.sin(t * TAU * 7 / LOOP + r + k2), 0);
      b[`rib${r}_${k2}`] = prev;
    }
  }
  b.shadow = { m: [0.7, 0, 0, 0, 0.7, 0, 0, 0, 1], t: [0, 0, 0] };
  return b;
}

export const LUME: Kind = {
  bones: lumeBones,
  build: lumeBuild,
  palette: (coat, mark) => {
    const c = pastel(coat), m = pastel(mark);
    return coatPalette(coat, mark, {
      crystal: m, crystalDark: [150, 144, 196], spot: [255, 252, 236], petal: [c[0] * 0.5 + 118, c[1] * 0.5 + 110, c[2] * 0.5 + 125] as RGB, water: [196, 226, 246], bloom: [255, 226, 150],
    });
  },
  shadow: [1.0, 1.0],
  stride: 0.8,
  size: 2.3,
  blinks: 6,
  // A soft light out of the mouth of the bell, on its rim and its ribbons and the air about it. Laid over the middle of the bell,
  // it washed the bell's own light and shade out to one flat white by day.
  glow: (b, a) => {
    const B = b.body;
    const mouth = (down: number): V3 => [B.t[0] - B.m[2] * down, B.t[1] - B.m[5] * down, B.t[2] - B.m[8] * down];
    const pulse = 0.18 + 0.05 * cyc(a.t, 6);
    return [
      { p: mouth(0.45), r: 1.9, c: [220, 240, 255], a: pulse },
      { p: mouth(0.5), r: 0.9, c: [255, 250, 230], a: 0.18 },
    ];
  },
};

