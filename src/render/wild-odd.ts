import {
  add, beat, birdBones, coatPalette, curve, eyes, frac, merge, mirrored, mix, orb, orbAlong, smooth, TAU, tube, type BirdSpec, type Kind, type Piece,
} from './beasts';
import type { V3 } from './figure';
import { birdLegPieces, cut, under } from './beastkit';

/** The magga, on two legs. */

/* ---- the magga ---------------------------------------------------------------------- */

/**
 * A magga: a round black-and-white treetop bird that cannot leave anything
 * shiny where it lies. Its long tail ends in a stone of its own, and it wears
 * a little crown of three feathers; its wings and tail have the sheen of oil
 * on water.
 */
const MAGGA_SPEC: BirdSpec = {
  high: 1.25,
  leg: { at: [0.32, 0.05, -0.42], len: [0.42, 0.55, 0.08], rest: [28, -58] },
  neck: { at: [0, 0.72, 0.28], len: 0.3, lean: 20 },
  head: { pitch: 0 },
  wing: { at: [0.6, 0.42, 0.24] },
  tail: { at: [0, -0.95, 0.1], lift: 4 },
  swing: [26, 40],
  hop: true,
  thrust: 7,
  // Foraging, tipped well over, the neck bowed right down and crouched low on its legs, so that the beak meets the ground with the face
  // still to be seen. The legs are swung forward past where they stood by as much as the bend at the knee would slant them back, so the
  // shanks stand as steep as they did, under its middle, rather than trailing back.
  peck: 120,
  tip: 40,
  nose: 16,
  crouch: 1.2,
  stance: 1.8,
};

/** The head: long enough in the face that the eyes, turned well forward so both show from in front, still have face before them in profile. */
const MAGGA_HEAD = { c: [0, 0.22, 0.32] as V3, r: [0.6, 0.82, 0.56] as V3 };

function maggaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 7);
  // A round body, black above and white beneath.
  const ys = [-1.05, -0.8, -0.3, 0.3, 0.72, 0.95];
  const body = tube(ys.map((y, q) => [0, y, [0.05, 0.08, 0.1, 0.12, 0.2, 0.28][q]] as V3), [0.2, 0.6, 0.76, 0.74, 0.55, 0.2], [0.18, 0.5, 0.62, 0.6, 0.46, 0.2], n,
    (ring, j) => (ring > 0 && under(n, j, 1.25) ? 'mark' : 'coat'));
  // A folded wing: a long feather-shaped flap down the flank, white across the shoulder, which is what shows it pied, and the rest sheened.
  const wingPts: V3[] = [[0, 0.1, 0.05], [0, -0.35, 0.02], [0, -0.9, -0.06], [0, -1.45, -0.12], [0, -1.8, -0.14]];
  const wing = tube(wingPts, [0.3, 0.44, 0.4, 0.28, 0.04], 0.08, n, (ring) => (ring <= 1 ? 'mark' : 'feather'), { up: [1, 0, 0] });
  // The long tail, flat, and the stone at its end.
  const tailPts: V3[] = curve([0, 0, 0], [0, -0.99, 0.02], [0, -1.9, 0.16], 5);
  const tail = merge(
    tube(tailPts, [0.18, 0.26, 0.3, 0.28, 0.22, 0.06], 0.06, n, 'feather', { up: [0, 0, 1] }),
    orbAlong(add(tailPts[5], [0, -0.18, 0.04]), [0, -1, 0.1], [0.16, 0.16, 0.26], 6, 4, 'crystal'),
  );
  const H = MAGGA_HEAD;
  const skull = orb(H.c, H.r, n + 1, k, 'coat');
  const beak = tube([[0, 0.88, 0.2], [0, 1.14, 0.15], [0, 1.42, 0.08]], [0.16, 0.1, 0.0], [0.13, 0.08, 0.0], 6, 'bill');
  // The eyes turned about 55 degrees off the line of the beak, so that from in front they sit on the face rather than on its edge.
  const look = (shut: boolean) => eyes(H.c, H.r, [0.7, 0.5, 0.3], 0.21, { tall: 1.15, shut, rim: 0.28 });
  // The crown: three short feathers standing up from the crown of the head, one behind another, each tipped with a spark.
  const crown = merge(...[-1, 0, 1].map((q) => merge(
    tube(curve([q * 0.03, 0.09 + q * 0.14, 0.78], [q * 0.05, 0.06 + q * 0.2, 1.0], [q * 0.07, -0.01 + q * 0.26, 1.14 - Math.abs(q) * 0.06], 2), [0.07, 0.06, 0.03], [0.07, 0.06, 0.03], 5, 'coat'),
    orb([q * 0.07, -0.02 + q * 0.27, 1.18 - Math.abs(q) * 0.06], 0.1, 5, 3, 'crystal'),
  )));
  const hide = [{ c: H.c, r: H.r }];
  const pieces: Piece[] = [
    { key: 'body', mesh: body, bone: 'body', bias: 0, breathes: { c: [0, 0, 0.1], k: 0.05 } },
    { key: 'tail', mesh: tail, bone: 'tail0', bias: -0.05 },
    { key: 'neck', mesh: tube([[0, 0, -0.2], [0, 0, 0.3]], 0.45, 0.42, n, 'coat'), bone: 'neck', bias: 0, under: 'head', convex: true },
    { key: 'head', mesh: merge(skull, beak, look(false)), shut: merge(skull, beak, look(true)), bone: 'head', bias: 0.2 },
    { key: 'crown', mesh: crown, bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'wing0', mesh: mirrored(wing), bone: 'wing0', bias: 0.03, after: 'body', front: [-1, 0, 0] },
    { key: 'wing1', mesh: wing, bone: 'wing1', bias: 0.03, after: 'body', front: [1, 0, 0] },
    ...birdLegPieces('bl', -1, 0.55, 0.07, 5),
    ...birdLegPieces('br', 1, 0.55, 0.07, 5),
  ];
  return pieces;
}

export const MAGGA: Kind = {
  bones: (a) => birdBones(MAGGA_SPEC, a, (p) => {
    if (a.go > 0) {
      // Going, the tail is carried a little under the line of the back and swung a third as far as a hop would swing it, so that
      // hopping toward the viewer the stone at its end stays down behind the head rather than bobbing up over the crown.
      p.tail[0] += smooth(a.go) * (8 * Math.sin(frac(a.u) * TAU) - 14);
      return;
    }
    const t = a.t, gz = a.graze;
    // Its snapped looks about a little smaller than most birds', so its face stays turned to whoever is looking at it.
    p.head[1] *= 0.7;
    p.head[2] *= 0.7;
    // Twice a loop the tail pumped, up and down and up again, the way a magpie's is, swinging the stone at its end.
    p.tail[0] += 24 * beat(t, [4.4, 4.85, 16.4, 16.85], 0.45) * (1 - gz);
    // Foraging, the tail is not cocked up as far as the body tips but held lower and turned aside, so that seen from in front it
    // lies out beside the body rather than standing up over the head.
    p.tail[0] -= 35 * gz;
    p.tail[1] -= 35 * gz;
  }),
  build: maggaBuild,
  palette: (coat, mark) => coatPalette(coat, mark, {
    feather: mix(coat, [70, 130, 170], 0.55), featherDark: mix(coat, [60, 110, 150], 0.4),
    crystal: [150, 226, 236], bill: [112, 104, 124], claw: [66, 62, 70], eye: [30, 26, 34],
  }),
  shadow: [1.4, 0.8],
  stride: 1.2,
  size: 1.9,
};
