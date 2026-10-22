import {
  beat, coatPalette, curve, disc, merge, orb, orbAlong, paint, quadBonesOf, smile, taper, TAU,
  type Anim, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, earMesh, pawMesh, quadPieces } from './beastkit';
import { place, type RGB, type V3 } from './figure';

/** The diggers: the dowse, long and low and nose-first. (The mola is the iron line now, in `./wild-iron`, the vola the spore line, in `./wild-spore`, and the snout the badger line, in `./wild-badger`.) */

/**
 * A long low burrower: short legs, the body close to the ground, the head carried forward and low. `lean` is how far forward of
 * upright the neck is carried, and `graze`, `nose` and `bow` how far the neck, the head and the chest go down to the ground
 * (`QuadSpec`).
 */
const digger = (o: { high: number; len: number; legs: number; neck: number; lean?: number; graze?: number; nose?: number; bow?: number; swing?: [number, number] }): QuadSpec => ({
  high: o.high,
  fore: { at: [0.55, o.len * 0.42, -0.35], len: [o.legs * 0.55, o.legs * 0.45, 0.12], rest: [4, -8, 0], fold: [55, 85], toe: [0.35, 0.1] },
  hind: { at: [0.58, -o.len * 0.4, -0.3], len: [o.legs * 0.6, o.legs * 0.5, 0.12], rest: [22, -40, 0], fold: [45, 70], toe: [0.4, 0.12] },
  neck: { at: [0, o.len * 0.5, 0.1], len: o.neck, lean: o.lean ?? 72 },
  head: { pitch: -4 },
  tail: { at: [0, -o.len * 0.52, 0.1], links: 2, len: 0.32, lift: 8, curl: -10, sway: 14 },
  ears: { at: [0.62, -0.2, 0.42], out: 40, back: 20 },
  swing: o.swing ?? [30, 46],
  graze: o.graze ?? 20,
  nose: o.nose ?? 14,
  bow: o.bow ?? 16,
  rock: 5,
});

/** A scurry: small quick steps, the whole body wagging with them; and standing, the nose always going, and down for a sniff `sniff` degrees deep. */
function scurry(p: QuadPose, a: Anim, sniff = 14): void {
  const w = a.u - Math.floor(a.u);
  if (a.go > 0) {
    p.roll += a.go * 4 * Math.sin(w * TAU);
    p.lift += a.go * 0.08 * Math.abs(Math.sin(w * TAU * 2));
    p.neck[1] += a.go * 8 * Math.sin(w * TAU);
    p.tail[1] += a.go * 20 * Math.sin(w * TAU + 1);
    return;
  }
  // Working at the air three times a second, and down to the ground for a sniff twice a loop, the nose tipped down into it.
  const down = beat(a.t, [5.2, 17.6], 1.4);
  p.head[0] += 3 * Math.sin(a.t * Math.PI * 6) - sniff * 0.5 * down;
  p.neck[0] += sniff * down;
}

/* ---- the dowse ----------------------------------------------------------------------- */

/**
 * A dowse: a round, whiskered burrower that reads the ground for metal with
 * the forked rod that grows from its brow, whose two tips glow; long
 * whiskers, big ears, and spots of ore colour on its back.
 */
const DOWSE_BASE = digger({ high: 1.05, len: 2.6, legs: 0.66, neck: 0.3 });
const DOWSE_SPEC: QuadSpec = { ...DOWSE_BASE, ears: { at: [0.62, -0.1, 0.55], out: 22, back: 8 }, tail: { ...DOWSE_BASE.tail!, at: [0, -1.5, 0.2] } };
const DOWSE_HEAD = { c: [0, 0.3, 0.2] as V3, r: [1.0, 0.92, 0.84] as V3 };
/**
 * The two tips of the rod, in the head's frame: parted forward and back as
 * well as side to side, so the fork is a fork seen from any side rather than
 * one stick side on.
 */
const ROD_TIPS: V3[] = [[0.45, 0.82, 2.2], [-0.45, 0.38, 2.2]];

function dowseBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = DOWSE_HEAD;
  const rod = merge(
    taper(curve([0, 0.2, 0.85], [0, 0.3, 1.3], [0, 0.35, 1.55], 2), 0.09, 0.07, 5, 'horn'),
    ...ROD_TIPS.map((t) => taper(curve([0, 0.35, 1.55], [t[0] * 0.6, (0.35 + t[1]) / 2, 1.8], t, 3), 0.07, 0.04, 5, 'horn')),
    ...ROD_TIPS.map((c) => orb(c, 0.13, 6, 4, 'crystal')),
  );
  // Long whiskers out of the muzzle, fine and pale, and too fine for a line round them. They grow from ahead of the eyes and fan
  // forward as well as out, so side on they spread in front of the face rather than standing in a streak across the eye.
  const whiskers = merge(...[-1, 1].flatMap((s) => [0, 0.12].map((z, q) => taper(curve([s * 0.3, 1.28, z], [s * 0.82, 1.5, z + 0.12], [s * 1.22, 1.66, z + (q ? 0.14 : -0.02)], 3), 0.035, 0.012, 4, 'mark'))));
  // A muzzle standing forward of the eyes, so side on there is a nose line in front of them; the nose on the end of it a piece of
  // its own (below), which no lines are drawn across, as they would be most of it.
  const face = merge(
    orbAlong([0, 1.05, -0.08], [0, 1, -0.2], [0.42, 0.32, 0.4], n, k, 'muzzle'),
    smile([0, 1.34, -0.24], [0, 1, -0.2], 0.22),
  );
  const nose = orbAlong([0, 1.42, 0.02], [0, 1, 0.3], [0.16, 0.11, 0.11], 6, 3, 'nose');
  const spots = paint(([[0.4, -0.2, 0.62], [-0.3, 0.2, 0.66], [0.1, -0.7, 0.58], [-0.5, -0.6, 0.5]] as V3[]).map((c) => disc(c, [c[0] * 0.8, c[1] * 0.4, 0.8], 0.18, 0.14, 6, 'gem')));
  return quadPieces({
    n, k,
    // A round rump drawn in to the tail, rather than a loaf's cut end.
    body: {
      y: [-1.6, -1.4, -1.2, -0.6, 0.1, 0.8, 1.2, 1.4], z: [0.22, 0.24, 0.26, 0.3, 0.3, 0.3, 0.32, 0.35],
      w: [0.2, 0.6, 0.9, 1.15, 1.2, 1.1, 0.8, 0.2], h: [0.2, 0.5, 0.72, 0.86, 0.88, 0.8, 0.62, 0.2], belly: true,
    },
    neck: { w: 0.7, h: 0.62, len: 0.3 },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.72, 0.6, 0.3], size: 0.32, rim: 0.12 }, blush: [[0.78, 0.5, -0.25], 0.18] },
    ear: earMesh(0.75, 0.42, n),
    earTurn: 40,
    tail: [taper([[0, 0, 0], [0, -0.3, 0]], 0.1, 0.08, 5, 'coat'), taper([[0, 0, 0], [0, -0.3, 0]], 0.08, 0.02, 5, 'coat')],
    fore: { upper: [0.25, -0.36, 0.24, 0.18], lower: [0, -0.3, 0.18, 0.15], foot: pawMesh(0.2, n, k, 'mark', 0.12) },
    hind: { upper: [0.25, -0.4, 0.3, 0.2], lower: [0, -0.33, 0.18, 0.15], foot: pawMesh(0.2, n, k, 'mark', 0.12) },
    extras: [
      { key: 'rod', mesh: rod, bone: 'head', bias: 0.25, after: ['head', 'ear0', 'ear1'] },
      { key: 'nose', mesh: nose, bone: 'head', bias: 0.23, after: 'head', hide: [{ c: H.c, r: H.r }], hideIn: 'head', lines: false },
      // Hidden where they are behind the head or the muzzle, which seen from behind they would otherwise be drawn across.
      { key: 'whiskers', mesh: whiskers, bone: 'head', bias: 0.24, after: ['head', 'nose'], rim: false, hide: [{ c: H.c, r: H.r }, { c: [0, 1.05, -0.08], r: [0.42, 0.4, 0.32] }], hideIn: 'head' },
      { key: 'spots', mesh: spots, bone: 'trunk', bias: 0.01, after: 'body' },
    ],
  });
}

export const DOWSE: Kind = {
  bones: quadBonesOf(DOWSE_SPEC, (p, a) => {
    scurry(p, a);
    // Standing, it reads the ground: the head down and still, the rod dipping, then up and a look round.
    if (a.go <= 0) p.neck[0] += 18 * beat(a.t, [2.5, 10.5, 18.5], 2.4);
  }),
  build: dowseBuild,
  palette: (coat, mark) => coatPalette(coat, mark, { horn: [196, 150, 110], crystal: [172, 240, 214], gem: [214, 128, 84], nose: [220, 130, 146] }, 40),
  shadow: [1.7, 1.2],
  stride: 1.8,
  size: 1.55,
  // The rod's tips glow, brighter and dimmer every second, as if it were listening.
  glow: (b, a) => ROD_TIPS.map((c) => ({ p: place(b.head, c), r: 0.9, c: [170, 255, 220] as RGB, a: 0.25 + 0.15 * Math.sin(a.t * Math.PI * 2) })),
};
