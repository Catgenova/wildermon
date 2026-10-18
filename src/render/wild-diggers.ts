import {
  add, beat, coatPalette, cross, curve, DEG, disc, merge, onEgg, orb, orbAlong, paint, quadBonesOf, scale, smile, sub, taper, TAU, tube, unit,
  type Anim, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { blade, cut, earMesh, hoofMesh, pawMesh, quadPieces } from './beastkit';
import { joint, place, type Mat, type RGB, type V3 } from './figure';

/** The diggers: the dowse and the snout, long and low and nose-first. (The mola is the iron line now, in `./wild-iron`, and the vola the spore line, in `./wild-spore`.) */

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

/* ---- the snout ----------------------------------------------------------------------- */

/**
 * A snout: wrinkled, half blind, and the finest nose on the island, which it
 * wears like a trumpet with a flower at its end, pink petals round its
 * nostrils; sleepy lidded eyes, long soft ears, and folds down its back.
 */
const SNOUT_SPEC: QuadSpec = { ...digger({ high: 1.15, len: 3.4, legs: 0.75, neck: 0.35, graze: 6, nose: 3, bow: 7 }), ears: { at: [0.7, -0.12, 0.42], out: 140, back: 10 } };
const SNOUT_HEAD = { c: [0, 0.2, 0.15] as V3, r: [0.95, 0.9, 0.8] as V3 };
const SNOUT_EYE: V3 = [0.66, 0.6, 0.5];
/** Where the trumpet goes into the head, and where it ends, in the head's frame: the middle of the flower. */
const TRUMPET_ROOT: V3 = [0, 0.7, -0.05];
const BELL: V3 = [0, 2.3, -0.28];

/**
 * How far the trumpet is swung round its root, in degrees, standing: sniffing over the ground from side to side once every four
 * seconds. It is the trumpet that sweeps and not the head, so the face stays where somebody watching it side on can see it.
 */
const trumpetSwing = (a: Anim): number => 25 * Math.sin((a.t * TAU) / 4) * (1 - a.go);

/** A point of the trumpet swung round its root by `deg` degrees, the more the further along it is, so it bends as it swings. */
function swung(p: V3, deg: number): V3 {
  const s = Math.min(1, Math.max(0, (p[1] - TRUMPET_ROOT[1]) / (BELL[1] - TRUMPET_ROOT[1]))) ** 1.5;
  const t = deg * s * DEG, c = Math.cos(t), sn = Math.sin(t);
  const y = p[1] - TRUMPET_ROOT[1];
  return [p[0] * c - y * sn, TRUMPET_ROOT[1] + p[0] * sn + y * c, p[2]];
}

function snoutBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const H = SNOUT_HEAD;
  // The trumpet: long, sagging a little along its length, wrinkled in bands, and flared at its end into a pink bell; slender, so
  // the flower on its end is the widest thing about it and it is a nose rather than a trunk.
  const line = curve(TRUMPET_ROOT, [0, 1.5, -0.44], [0, 2.18, -0.3], 6);
  const trumpet = tube([...line, BELL], [0.24, 0.21, 0.19, 0.17, 0.16, 0.16, 0.17, 0.3], [0.23, 0.2, 0.18, 0.16, 0.15, 0.15, 0.16, 0.28], n,
    (ring) => (ring >= 6 ? 'petal' : ring % 2 ? 'coatDark' : 'coatLight'));
  // The flower round its nostrils: eight petals opening forward out of the rim of the bell, flat and turned to show their faces.
  // Built from the trumpet's root, on a bone of its own there that swings with the trumpet's end.
  const petals = merge(...Array.from({ length: 8 }, (_, q) => {
    const a = ((q + 0.5) / 8) * TAU, c = Math.cos(a), sn = Math.sin(a);
    const at = (r: number, y: number): V3 => sub([c * r, BELL[1] + y, BELL[2] + sn * r], TRUMPET_ROOT);
    return blade([at(0.24, -0.06), at(0.36, 0.06), at(0.46, 0.18), at(0.52, 0.26)], [0.07, 0.13, 0.11, 0.03], [-c * 0.86, 0.5, -sn * 0.86], { fold: 0.3, thick: 0.04, mat: 'petal' });
  }));
  const bell = sub(BELL, TRUMPET_ROOT);
  const nostrils = paint([1, -1].map((s) => disc(add(bell, [s * 0.1, 0.01, 0.02]), [0, 1, 0], 0.06, 0.09, 6, 'nose')));
  // Sleepy: the top half of each eye under a heavy lid of its coat, painted after the eye so it lies over it, and the lid's edge
  // drawn across the eye in a dark line, sagging a little in the middle.
  const lids = paint([1, -1].flatMap((s) => {
    const { p, n: out } = onEgg(H.c, H.r, [SNOUT_EYE[0] * s, SNOUT_EYE[1], SNOUT_EYE[2]]);
    const u = unit(cross([0, 0, 1], out)), up = cross(out, u);
    const at = (x: number, y: number, o: number): V3 => add(add(p, scale(out, o)), add(scale(u, x), scale(up, y)));
    const edge = (x: number): number => 0.04 - 0.06 * (1 - (x / 0.36) ** 2);
    const xs = Array.from({ length: 7 }, (_, q) => -0.36 + (q / 6) * 0.72);
    return [
      { v: [...Array.from({ length: 9 }, (_, q) => at(Math.cos((q / 8) * Math.PI) * 0.36, 0.04 + Math.sin((q / 8) * Math.PI) * 0.38, 0.05)), ...xs.slice(1, -1).map((x) => at(x, edge(x), 0.05))], m: 'coatDark' as Mat },
      { v: [...xs.map((x) => at(x, edge(x) - 0.035, 0.06)), ...[...xs].reverse().map((x) => at(x, edge(x) + 0.035, 0.06))], m: 'lid' as Mat },
    ];
  }));
  const folds = paint([-1.2, -0.5, 0.2, 0.9].map((y) => disc([0, y, 0.82], [0, 0, 1], 0.9, 0.08, 8, 'coatDark')));
  const pieces = quadPieces({
    n, k,
    body: { y: [-1.9, -1.6, -0.9, 0, 0.9, 1.5, 1.8], z: [0.1, 0.16, 0.2, 0.22, 0.22, 0.25, 0.3], w: [0.2, 0.9, 1.12, 1.16, 1.08, 0.86, 0.25], h: [0.2, 0.66, 0.78, 0.82, 0.78, 0.66, 0.22], belly: true },
    neck: { w: 0.72, h: 0.62, len: 0.35 },
    head: { c: H.c, r: H.r, face: trumpet, eye: { dir: SNOUT_EYE, size: 0.3, rim: 0.08 }, blush: [[0.8, 0.45, -0.3], 0.18] },
    // Long soft ears, hanging down either side of the face and turned out to show their faces: each a flap twisted along its
    // length and cupped, so from no side is it an edge like a stick.
    ear: blade(curve([0, 0, 0], [0, 0.04, 0.5], [0, 0.18, 1.0], 4), [0.15, 0.27, 0.29, 0.22, 0.07], [0, 1, 0], { twist: 0.9, fold: 0.4, thick: 0.08, mat: 'coat', rib: 'inner' }),
    earTurn: 60,
    tail: [taper([[0, 0, 0], [0, -0.35, 0]], 0.14, 0.1, 5, 'coat'), taper([[0, 0, 0], [0, -0.35, 0]], 0.1, 0.02, 5, 'coat')],
    fore: { upper: [0.25, -0.42, 0.28, 0.22], lower: [0, -0.34, 0.22, 0.2], foot: hoofMesh(0.22, 0.12, n, 'pad') },
    hind: { upper: [0.3, -0.45, 0.34, 0.24], lower: [0, -0.38, 0.22, 0.2], foot: hoofMesh(0.22, 0.12, n, 'pad') },
    extras: [
      { key: 'folds', mesh: folds, bone: 'trunk', bias: 0.005, after: 'body' },
      { key: 'lids', mesh: lids, bone: 'head', bias: 0.2, after: 'head', hide: [{ c: H.c, r: H.r }], hideIn: 'head' },
      // The flower goes on over the end of the trumpet with no lines across it, which on petals this small would be all of them;
      // seen from behind, it goes under the head. Standing, its petals open and close a little once a second, sniffing.
      {
        key: 'flower', mesh: merge(petals, nostrils), bone: 'bell', bias: 0.22, after: 'head', front: [0, 1, 0], hide: [{ c: add(bell, [0, -0.06, 0]), r: [0.3, 0.06, 0.28] }], lines: false,
        bent: (v, a) => {
          const k = 1 + 0.14 * (0.5 + 0.5 * Math.sin(a.t * TAU)) * (1 - a.go);
          return v.map((p, i) => (i < petals.v.length ? [bell[0] + (p[0] - bell[0]) * k, p[1], bell[2] + (p[2] - bell[2]) * k] : p));
        },
      },
    ],
  });
  // The trumpet bends as it swings: its corners in the head, the more the further along it they are.
  return pieces.map((pc) => {
    if (pc.key !== 'head') return pc;
    const from = pc.mesh.v.indexOf(trumpet.v[0]), to = from + trumpet.v.length;
    return from < 0 ? pc : { ...pc, bent: (v, a) => {
      const deg = trumpetSwing(a);
      return deg ? v.map((q, i) => (i >= from && i < to ? swung(q, deg) : q)) : [...v];
    } };
  });
}

const snoutBones = quadBonesOf(SNOUT_SPEC, (p, a) => {
  scurry(p, a);
  // Standing, the head looks about only a little and follows the trumpet's sweep a little, so it never turns its face away. (On a
  // neck carried as far forward as this, it is the head's tilt that turns it, and its turn that tilts it.)
  if (a.go <= 0) {
    p.neck[1] = 0.4 * p.neck[1] + 3 * Math.sin((a.t * TAU) / 4);
    p.head[2] *= 0.5;
  }
});

export const SNOUT: Kind = {
  // The flower on the trumpet's end has a bone of its own, at the trumpet's root, swung as far as the trumpet's end is.
  bones: (a) => {
    const b = snoutBones(a);
    b.bell = joint(b.head, TRUMPET_ROOT, 0, 0, trumpetSwing(a));
    return b;
  },
  build: snoutBuild,
  // Its greys a dusty mauve.
  palette: (coat, mark) => coatPalette(coat, mark, { petal: [250, 180, 200], nose: [196, 104, 132], pad: [150, 120, 110] }, 300),
  shadow: [2.1, 1.2],
  stride: 1.7,
  size: 2.1,
};
