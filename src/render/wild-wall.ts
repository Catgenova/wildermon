import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, lifted, merge, mix, moved, orbAlong, paint,
  quadBones, quadPose, scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
  type QuadPose, type QuadSpec,
} from './beasts';
import { blade, cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import { bit } from './wild-moss';

/**
 * The wall line: the Wallkit, a small round kit, brown and cream, its cream face masked in dark brown over its eyes and brow,
 * round brown ears cream inside, amber eyes, a big fluffy cream tail curled up behind, a mantle of green leaves over its back
 * and shoulders and a small straw brush in a wooden cuff held between its fore paws; which grows into the Bristleward, bigger
 * and longer, a thicker mantle with white blossom hanging from it, cream plumes on its shoulders and flanks, and both forearms
 * ending in big straw brushes bound in mossy wooden cuffs carved with a spiral; and then the Stonepolish, large and heavy, a
 * great mane of leaves and blossom, cream plumes swept back from its head and shoulders, a carved wooden pauldron on each
 * shoulder and massive forearms in mossy carved cuffs ending in huge fanned brushes. The species is still `scurra`
 * underneath, as saves and the database know it: the scrubber, that scrubs the moss off your paving and the ivy off your
 * walls.
 *
 * Built the way the badger line is (`./wild-badger`): one set of functions from a description of the stage (`Wall`), every
 * foot given a point on the ground to be at and its leg bent to reach it. It walks four beats, its barrel rolling onto each
 * fore foot. At its task it scrubs the stone before it: the Wallkit pushes its brush out and draws it back with both paws, the
 * bigger two their two brushes by turns, one going out as the other comes back, and green moss flies off the stone at the end
 * of every stroke.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }
type HeadRings = Rings & { pitch: number };

interface Wall {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest. */
  body: Rings;
  /** Shoulder to hip. */
  len: number;
  /** The fore legs and the hind: upper, lower, and the drop from the ankle to the sole; how thick at the top. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  /** How far out from the middle its hips and shoulders are, as a share of the body's width there. */
  hip: number;
  /** How thick its hind legs are against its fore. */
  hindThick: number;
  /** Standing: each leg's upper pitched forward, and its lower against it, in degrees. Its sign says which way the knee bends, for good. */
  stand: { fore: [number, number]; hind: [number, number] };
  paw: number;
  hindPaw: number;
  /** The fore claws (the Wallkit's; the bigger two have brushes): how many, how long, how thick at the root; and the hind claws' length. */
  claw: { n: number; len: number; w: number };
  hindClaw: number;
  neck: { at: V3; len: number; w: number; lean: number };
  head: HeadRings;
  /**
   * Its face: brown above `crown` (the sine of how far up round the head), cream below; from how far back along the head (a
   * share of its length) the fur behind the face begins; the dark mask through its eyes, how far it reaches toward the nose
   * and back toward the ear (shares of the head's length) and how high it is at the eye (radians round the head), rising
   * toward the ear by `rise`.
   */
  mask: { crown: number; back: number; nose: number; ear: number; high: number; rise: number };
  nose: number;
  /** The eye: how far along the head, how far up round it (radians from the side), its size, how tall, and how heavy the brow over it. */
  eye: { y: number; up: number; size: number; tall: number; lid: number };
  /** Its ears: how long, how wide, how far turned out and swept back, and where on the head (along its back, up round it). */
  ear: { len: number; w: number; out: number; back: number; at: [number, number] };
  /**
   * The mantle of leaves over its back and shoulders: rows from `from` to `to` along the body, `per` leaves across each, out to
   * `spread` radians either side of the ridge; how long a leaf, how many layers deep, how far the top layer stands off the
   * back, and how far the edge leaves hang down over the flanks (a share of a leaf).
   */
  mantle: { from: number; to: number; rows: number; per: number; spread: number; len: number; layers: number; lift: number; hang: number };
  /** Sprigs of white blossom hanging from its mantle. */
  blossoms: number;
  /** Cream plumes: on its cheeks, swept back from its head, on its shoulders and on its flanks, how long each; nought for none. */
  plumes: { cheek: number; head: number; shoulder: number; flank: number };
  /**
   * Its brush: held between its fore paws (the Wallkit), or the end of each forearm (the bigger two). The wooden cuff, how
   * thick and how long, how many carved bands; the straw, how long and how far it fans.
   */
  brush: { held: boolean; cuff: [number, number]; bands: number; straw: number; fan: number };
  /** A carved wooden pauldron on each shoulder, how big; nought for none. */
  pauldron: number;
  /** Its tail: how long, how thick, how far lifted (degrees), how far it curls over toward its back, and leaves along it. */
  tail: { len: number; w: number; lift: number; curl: number; leaves: number };
  /**
   * How it goes: how far its body drops at each footfall (units), a walk's and a run's; how much of a stride a foot is down;
   * how far a leg swings (degrees); how high a foot is lifted; how far the barrel rolls and the head nods and swings; and how
   * much what is on its back stirs.
   */
  gait: { bob: [number, number]; duty: [number, number]; swing: [number, number]; step: number; roll: number; nod: number; sway: number; jiggle: number };
  /** Its strike: a pounce and swipe, a rake of both brushes, or reared up and slammed down. */
  strike: 0 | 1 | 2;
  /** Its go at its task, in time (`Work`). */
  work: Work;
  size: number;
}

/** A Wallkit: a small round kit, a masked face, a mantle of leaves, a fluffy tail curled up behind, a little brush in its paws. */
const WALLKIT_LOOK: Wall = {
  stage: 0,
  body: { y: [-0.8, -0.68, -0.38, 0, 0.36, 0.58, 0.7], z: [-0.02, 0.01, 0.04, 0.06, 0.07, 0.06, 0.04], w: [0.34, 0.58, 0.7, 0.72, 0.68, 0.56, 0.3], h: [0.2, 0.34, 0.41, 0.42, 0.4, 0.33, 0.19] },
  len: 0.95,
  fore: [0.13, 0.12, 0.07], hind: [0.13, 0.12, 0.07], thick: 0.21, hip: 0.56, hindThick: 1.12,
  stand: { fore: [0, 44], hind: [24, -60] },
  paw: 0.14, hindPaw: 0.13,
  claw: { n: 4, len: 0.05, w: 0.026 }, hindClaw: 0.04,
  neck: { at: [0, 0.56, 0.12], len: 0.12, w: 0.42, lean: 72 },
  head: {
    // A round face, full cheeks, and a short pointed muzzle out of the front of them to a small dark nose.
    y: [-0.4, -0.35, -0.22, -0.04, 0.13, 0.25, 0.35, 0.42, 0.465], z: [0.058, 0.068, 0.068, 0.04, 0, -0.04, -0.07, -0.088, -0.096],
    w: [0.12, 0.43, 0.54, 0.57, 0.53, 0.42, 0.27, 0.16, 0.085], h: [0.12, 0.42, 0.5, 0.51, 0.44, 0.31, 0.2, 0.13, 0.07], pitch: -2,
  },
  mask: { crown: 0.86, back: 0.22, nose: 0.82, ear: 0.24, high: 0.42, rise: 0.22 },
  nose: 0.066,
  eye: { y: 0.15, up: 0.52, size: 0.092, tall: 1.12, lid: 0 },
  ear: { len: 0.27, w: 0.2, out: 50, back: 14, at: [0.5, 1.02] },
  mantle: { from: 0.56, to: -0.56, rows: 5, per: 5, spread: 1.0, len: 0.34, layers: 2, lift: 0.07, hang: 0.35 },
  blossoms: 0,
  plumes: { cheek: 0.3, head: 0, shoulder: 0, flank: 0 },
  brush: { held: true, cuff: [0.1, 0.2], bands: 1, straw: 0.42, fan: 0.36 },
  pauldron: 0,
  tail: { len: 1.0, w: 0.3, lift: 18, curl: 1, leaves: 0 },
  gait: { bob: [0.05, 0.06], duty: [0.58, 0.44], swing: [38, 42], step: 0.5, roll: 9, nod: 4, sway: 6, jiggle: 0.5 },
  strike: 0,
  work: { from: 0.1, to: 0.88, strokes: 4 },
  size: 3.5,
};

/** A Bristleward: bigger and longer, a thick mantle with blossom, cream plumes, both forearms ending in straw brushes in carved cuffs. */
const BRISTLEWARD_LOOK: Wall = {
  stage: 1,
  body: { y: [-1.5, -1.3, -0.76, -0.05, 0.64, 1.08, 1.28], z: [-0.12, -0.04, 0.06, 0.14, 0.2, 0.16, 0.06], w: [0.44, 0.76, 0.9, 0.92, 0.9, 0.74, 0.38], h: [0.24, 0.46, 0.6, 0.66, 0.68, 0.56, 0.28] },
  len: 2.15,
  fore: [0.36, 0.32, 0.17], hind: [0.36, 0.3, 0.14], thick: 0.3, hip: 0.64, hindThick: 1.15,
  stand: { fore: [16, 40], hind: [26, -58] },
  paw: 0.2, hindPaw: 0.18,
  claw: { n: 4, len: 0.08, w: 0.04 }, hindClaw: 0.08,
  neck: { at: [0, 1.1, 0.24], len: 0.3, w: 0.66, lean: 96 },
  head: {
    // A longer face than the kit's, a pointed muzzle.
    y: [-0.424, -0.326, -0.099, 0.128, 0.341, 0.53, 0.666, 0.757], z: [0.15, 0.18, 0.16, 0.08, 0, -0.05, -0.08, -0.095],
    w: [0.22, 0.72, 0.82, 0.74, 0.55, 0.38, 0.25, 0.15], h: [0.23, 0.7, 0.78, 0.64, 0.44, 0.28, 0.19, 0.115], pitch: -12,
  },
  mask: { crown: 0.84, back: 0.2, nose: 0.84, ear: 0.18, high: 0.4, rise: 0.26 },
  nose: 0.1,
  eye: { y: 0.18, up: 0.5, size: 0.1, tall: 1.0, lid: 0.18 },
  ear: { len: 0.44, w: 0.3, out: 48, back: 22, at: [0.52, 1.06] },
  mantle: { from: 1.0, to: -1.05, rows: 5, per: 5, spread: 0.68, len: 0.56, layers: 2, lift: 0.18, hang: 0.15 },
  blossoms: 3,
  plumes: { cheek: 0.34, head: 0, shoulder: 0.72, flank: 0.75 },
  brush: { held: false, cuff: [0.25, 0.4], bands: 1, straw: 0.56, fan: 0.4 },
  pauldron: 0,
  tail: { len: 0.7, w: 0.22, lift: 6, curl: 0.2, leaves: 2 },
  gait: { bob: [0.07, 0.09], duty: [0.6, 0.5], swing: [34, 38], step: 0.4, roll: 8, nod: 3, sway: 5, jiggle: 0.45 },
  strike: 1,
  work: { from: 0.1, to: 0.88, strokes: 4 },
  size: 3.5,
};

/** A Stonepolish: large and heavy, a great mane of leaves and blossom, cream plumes, carved pauldrons, huge fanned brushes. */
const STONEPOLISH_LOOK: Wall = {
  stage: 2,
  body: { y: [-2.5, -2.2, -1.35, 0, 1.25, 1.95, 2.25], z: [-0.1, 0.05, 0.24, 0.42, 0.56, 0.48, 0.24], w: [0.86, 1.42, 1.76, 1.86, 1.86, 1.58, 0.82], h: [0.5, 1.0, 1.4, 1.6, 1.66, 1.3, 0.56] },
  len: 4.2,
  fore: [1.15, 1.0, 0.46], hind: [1.08, 0.92, 0.34], thick: 1.02, hip: 0.62, hindThick: 1.05,
  stand: { fore: [14, 40], hind: [24, -58] },
  paw: 0.52, hindPaw: 0.48,
  claw: { n: 4, len: 0.2, w: 0.1 }, hindClaw: 0.2,
  neck: { at: [0, 1.95, 0.95], len: 0.7, w: 1.5, lean: 58 },
  head: {
    y: [-0.739, -0.561, -0.148, 0.311, 0.724, 1.065, 1.316, 1.478], z: [0.34, 0.4, 0.36, 0.2, 0.04, -0.06, -0.12, -0.14],
    w: [0.44, 1.36, 1.5, 1.32, 0.96, 0.64, 0.42, 0.25], h: [0.4, 1.2, 1.28, 1.02, 0.7, 0.44, 0.3, 0.18], pitch: -8,
  },
  mask: { crown: 0.82, back: 0.2, nose: 0.84, ear: 0.16, high: 0.38, rise: 0.3 },
  nose: 0.17,
  eye: { y: 0.36, up: 0.5, size: 0.15, tall: 0.86, lid: 0.32 },
  ear: { len: 0.72, w: 0.48, out: 46, back: 26, at: [0.52, 1.08] },
  mantle: { from: 1.95, to: -1.9, rows: 6, per: 5, spread: 0.72, len: 1.2, layers: 2, lift: 0.55, hang: 0.15 },
  blossoms: 5,
  plumes: { cheek: 0.75, head: 1.9, shoulder: 1.6, flank: 1.5 },
  brush: { held: false, cuff: [0.86, 1.2], bands: 2, straw: 1.8, fan: 1.3 },
  pauldron: 0.95,
  tail: { len: 1.5, w: 0.44, lift: -6, curl: 0, leaves: 4 },
  gait: { bob: [0.16, 0.2], duty: [0.64, 0.54], swing: [30, 34], step: 0.32, roll: 6, nod: 2, sway: 5, jiggle: 0.3 },
  strike: 2,
  work: { from: 0.1, to: 0.88, strokes: 4 },
  size: 2.5,
};

/** A number of its own for each thing, nought to one, so a pattern is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/** Where a point on a body of rings is, `y` along it and `th` round it from its right side (up positive), and the way out of it there. */
function onRings(R: Rings, y: number, th: number): { p: V3; n: V3 } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** `v` pitched about x by `deg` degrees, as a joint's pitch turns it. */
function rotX(v: V3, deg: number): V3 {
  const a = deg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}
/** A cubic from `a` to `b` leaving and arriving at `m` a unit of `s`. */
function hermite(a: number, b: number, m0: number, m1: number, s: number): number {
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b + (s3 - s2) * m1;
}

/* ---- the strike and the task, in time ------------------------------------------------------- */

/** When each stage's blows land, as shares of its strike: the Wallkit's swipe, the Bristleward's two rakes, the Stonepolish's slam. */
export const WALL_HITS: ReadonlyArray<readonly number[]> = [[0.5], [0.45, 0.62], [0.58]];
/**
 * A go at its task, as shares of it: its brushes scrub the stone from `from` to `to`, `strokes` strokes out and back. The
 * Wallkit's brush goes out and back once a stroke, both paws on it; the bigger two's by turns, one going out as the other comes
 * back.
 */
export interface Work { from: number; to: number; strokes: number }
/** Each stage's go at its task. */
export const WALL_WORK: readonly Work[] = [WALLKIT_LOOK.work, BRISTLEWARD_LOOK.work, STONEPOLISH_LOOK.work];
/** The three stages, in order. */
const LOOKS: readonly Wall[] = [WALLKIT_LOOK, BRISTLEWARD_LOOK, STONEPOLISH_LOOK];

/* ---- its legs, by where its feet go ---------------------------------------------------------- */

/** How far a knee folds for a fold of one: the poses here give a knee in degrees, through this. */
const FOLD = 60;
const SIDE = [-1, 1, -1, 1];

/** A stage's body on four legs (`QuadSpec`). */
const specOf = (s: Wall): QuadSpec => ({
  high: s.fore[0] + s.fore[1] + 0.5,
  fore: { at: [s.body.w[4] * s.hip, s.len * 0.5, -s.body.h[4] * 0.42], len: s.fore, rest: [s.stand.fore[0], s.stand.fore[1], 0], fold: [FOLD, FOLD], toe: [s.paw * 1.1, s.paw * 0.6] },
  hind: { at: [s.body.w[2] * s.hip * 1.04, -s.len * 0.5, -s.body.h[2] * 0.42], len: s.hind, rest: [s.stand.hind[0], s.stand.hind[1], 0], fold: [FOLD, FOLD], toe: [s.hindPaw * 1.1, s.hindPaw * 0.6] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.1, s.body.z[0] + s.body.h[1] * 0.4], links: 1, len: s.tail.len, lift: s.tail.lift, curl: 0, sway: 12 },
  ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: s.gait.duty,
  graze: 30,
  nose: 16,
  bow: 4,
  rock: 3,
});

/** Where a leg's ankle is from its hip, the upper pitched `a` and the lower `b` against it (degrees). */
function ankleAt(len: readonly number[], a: number, b: number): V3 {
  const A = a * DEG, B = (a + b) * DEG;
  return [0, len[0] * Math.sin(A) + len[1] * Math.sin(B), -(len[0] * Math.cos(A) + len[1] * Math.cos(B))];
}

/**
 * A leg bent so its ankle is at `T` (from the body's middle, level, along the ground): the swing of its upper and the fold of its
 * knee. The knee bends the way it does standing whatever the foot is asked, so it never flips; a point out of reach is reached
 * for as far as the leg goes.
 */
function legTo(spec: QuadSpec, i: number, pitch: number, T: V3): [number, number] {
  const L = i < 2 ? spec.fore : spec.hind, rest = L.rest ?? [0, 0, 0];
  const loc = sub(rotX(T, -pitch), [SIDE[i] * L.at[0], L.at[1], L.at[2]]);
  const L0 = L.len[0], L1 = L.len[1];
  // Never quite straight: past nineteen twentieths of its length a reach is eased toward the most it goes.
  const most = (L0 + L1) * 0.985, ease = (L0 + L1) * 0.95, d0 = Math.hypot(loc[1], loc[2]);
  const D = clamp(d0 > ease ? ease + (most - ease) * Math.tanh((d0 - ease) / (most - ease)) : d0, Math.abs(L0 - L1) + 0.02 * (L0 + L1), most);
  const b = (rest[1] >= 0 ? 1 : -1) * Math.acos(clamp((D * D - L0 * L0 - L1 * L1) / (2 * L0 * L1), -1, 1));
  const a = Math.atan2(loc[1], -loc[2]) - Math.atan2(L1 * Math.sin(b), L0 + L1 * Math.cos(b));
  return [a / DEG - rest[0], (rest[1] - b / DEG) / FOLD];
}

/** A stage standing: how far its body is tipped to stand on all four feet, how high its middle is, and where each ankle is. */
interface Rest { pitch: number; h: number; ankle: V3[]; tip: V3; nose: V3; sole: V3[][]; chin: V3[] }
function restOf(s: Wall, spec: QuadSpec): Rest {
  const ankle = (i: number, pitch: number): V3 => {
    const L = i < 2 ? spec.fore : spec.hind, r = L.rest ?? [0, 0, 0];
    return add(rotX([SIDE[i] * L.at[0], L.at[1], L.at[2]], pitch), rotX(ankleAt(L.len, r[0], r[1]), pitch));
  };
  const gap = (pitch: number): number => (ankle(0, pitch)[2] - spec.fore.len[2]) - (ankle(2, pitch)[2] - spec.hind.len[2]);
  let lo = -30, hi = 30;
  for (let q = 0; q < 40; q++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) > 0) hi = mid;
    else lo = mid;
  }
  const pitch = (lo + hi) / 2;
  const h = -(ankle(0, pitch)[2] - spec.fore.len[2]);
  return {
    pitch, h,
    ankle: [0, 1, 2, 3].map((i) => { const a = ankle(i, pitch); return [a[0], a[1], (i < 2 ? spec.fore : spec.hind).len[2]] as V3; }),
    tip: clawTip(s),
    nose: noseTip(s),
    // The underside of the head, from the jaw to the end of the nose: what would go into the ground first.
    chin: [...s.head.y.map((y, q) => [0, y, s.head.z[q] - s.head.h[q]] as V3), [0, s.head.y[s.head.y.length - 1] + s.nose, s.head.z[s.head.y.length - 1] - s.nose * 0.6]],
    // The points of each foot that could touch the ground, in its frame: the sole's toe and heel, and the claws' tips.
    sole: [0, 1, 2, 3].map((i) => {
      const L = i < 2 ? spec.fore : spec.hind, [ahead, behind] = L.toe ?? [0.3, 0.3];
      const claw: V3 = i < 2 ? sub(clawTip(s), [0, 0, 0.012]) : [0, s.hindPaw + s.hindClaw, -s.hind[2] + 0.008];
      return [[0, ahead, -L.len[2]], [0, -behind, -L.len[2]], claw, [0, claw[1] * 0.6, claw[2] + 0.005]] as V3[];
    }),
  };
}

/**
 * Where its feet are to be this moment and how the rest of it is carried: for each leg the point its ankle is to be at (from
 * under the body's middle along the ground, and its height over the ground) and how its foot is pitched past level; how high
 * the body's middle is, how far it is carried forward, and how far the barrel rolls and rocks over its legs.
 */
interface Plan { at: V3[]; foot: number[]; H: number; surge: number; roll: number; rock: number }

/** A beat once a turn at `x` nought, smooth all the way round: a footfall's jolt. */
const pulse = (x: number): number => Math.max(0, Math.cos(TAU * x)) ** 14;

/** A path through the air from `a` to `b`, `u` of the way, rising `up` over the straight line at its middle. */
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}

/** Standing: every foot where it stands. */
function stillPlan(R: Rest, p: QuadPose): Plan {
  return { at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0], H: R.h, surge: 0, roll: p.roll, rock: 0 };
}

/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const SWING_EDGE = 0.1;

/**
 * Going: each foot down for its share of a stride, swept back under the body at the speed the ground goes by, and brought
 * forward again through the air, leaving the ground and landing on it at the ground's speed so it never skates. Four beats at
 * a walk, the barrel rolling well over onto each fore foot as it takes the weight and the rump swinging the other way: a
 * waddle. At a run, the diagonals together.
 */
function goingPlan(s: Wall, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const trot = g >= 0.5;
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const legLen = Math.min(spec.fore.len[0] + spec.fore.len[1], spec.hind.len[0] + spec.hind.len[1]);
  const half = legLen * Math.sin(amp * DEG);
  const beats = trot ? [0, 0.5, 0.5, 0] : [0.25, 0.75, 0, 0.5];
  // Lowest as the feet bearing it are under it: the middle of a diagonal's stance, or of a fore foot's.
  const mid = trot ? duty / 2 : frac(0.75 + duty / 2);
  const bob = lerp(G.bob[0], G.bob[1], g);
  const drop = bob * (0.5 + 0.5 * Math.cos(4 * Math.PI * (w - mid)));
  let air = 0;
  if (trot && duty < 0.5) {
    const x = frac(w * 2) * 0.5;
    if (x >= duty) air = bob * 1.6 * Math.sin((Math.PI * (x - duty)) / (0.5 - duty)) ** 2;
  }
  const at: V3[] = [], foot: number[] = [];
  for (let i = 0; i < 4; i++) {
    const ph = frac(a.u + beats[i]), A = R.ankle[i];
    if (ph < duty) {
      at.push([A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]]);
      foot.push(0);
      continue;
    }
    // Lifted straight up off the ground and put straight down onto it, still going back under the body at the ground's speed
    // while it is near it, so it never slides; brought forward between, high.
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty), e = SWING_EDGE;
    const L = (i < 2 ? spec.fore : spec.hind).len, lift = G.step * (L[0] + L[1]) * (1 + 0.2 * g);
    const y0 = A[1] - half - v * e, y1 = A[1] + half + v * e;
    const y = u < e ? A[1] - half - v * u : u > 1 - e ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * e), -v * (1 - 2 * e), (u - e) / (1 - 2 * e));
    // Each foot swung out a little as it comes forward, round the barrel: the waddle's paddle.
    const out = (i < 2 ? 0.1 : 0.14) * legLen * SIDE[i] * Math.sin(Math.PI * u);
    at.push([A[0] + out, y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)]);
    // Long claws tipped up clear of the ground, so it goes on its knuckles; a kit's paw flicked over as it comes forward.
    const big = s.claw.len > 0.3;
    foot.push((i < 2 ? (big ? 14 : -18) : big ? 10 : -14) * Math.sin(Math.PI * u) ** 2);
  }
  // The barrel rolled onto whichever fore foot is down, and rocked fore and aft on the four beats.
  const roll = G.roll * Math.sin((w - mid) * TAU + Math.PI / 2) * (trot ? 0.5 : 1);
  const rock = trot ? 2 * Math.sin(w * TAU * 2) : 1.4 * Math.sin((w - mid) * TAU * 2);
  return { at, foot, H: R.h - drop + air, surge: 0, roll, rock };
}

/** A plan `k` of the way from `a` to `b`. */
function mixPlan(a: Plan, b: Plan, k: number): Plan {
  return {
    at: a.at.map((x, i) => [lerp(x[0], b.at[i][0], k), lerp(x[1], b.at[i][1], k), lerp(x[2], b.at[i][2], k)] as V3),
    foot: a.foot.map((x, i) => lerp(x, b.foot[i], k)),
    H: lerp(a.H, b.H, k), surge: lerp(a.surge, b.surge, k), roll: lerp(a.roll, b.roll, k), rock: lerp(a.rock, b.rock, k),
  };
}
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/* ---- the task ------------------------------------------------------------------------------- */

/** A go at its task: how far it is crouched over the stone (eased in and out of, unless it is already down). */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.9, 1)));

/** How far through a stroke the brush is at its furthest out, where it turns back. */
const PUSH = 0.48;
/** A stroke of its brushes: when it begins and how long it lasts, as shares of a go, and which paw makes it (both, on the Wallkit). */
interface Stroke { at: number; len: number; paw: number }
/**
 * The strokes of a go: the Wallkit's one after another, both paws on its brush; the bigger two's by turns, the right first,
 * each beginning as the one before turns back, so one brush goes out as the other comes back.
 */
function strokesOf(s: Wall): Stroke[] {
  const W = s.work, n = W.strokes, span = W.to - W.from;
  if (s.brush.held) return Array.from({ length: n }, (_, k) => ({ at: W.from + (span * k) / n, len: span / n, paw: -1 }));
  const step = span / (n + 0.5);
  return Array.from({ length: n }, (_, k) => ({ at: W.from + step * k, len: step * 1.5, paw: k % 2 ? 0 : 1 }));
}
/** When in a go each stroke reaches its furthest and the moss flies off the stone, as shares of the go: what its voice's swish lands on. */
export const wallScrubs = (stage: number): number[] => strokesOf(LOOKS[Math.max(0, Math.min(2, stage))]).map((k) => k.at + k.len * PUSH);
/** How far out a brush is through a stroke, nought to one: pushed out, eased at the turn, and drawn back. */
const outOf = (w: number): number => (w < PUSH ? smooth(w / PUSH) : 1 - smooth((w - PUSH) / (1 - PUSH)));
/** How far out each fore paw's brush is at `t` of a go, nought to one, the left and the right. */
function brushOut(s: Wall, t: number): [number, number] {
  const out: [number, number] = [0, 0];
  for (const k of strokesOf(s)) {
    const w = (t - k.at) / k.len;
    if (w <= 0 || w >= 1) continue;
    const x = outOf(w);
    if (k.paw < 0) { out[0] = x; out[1] = x; }
    else out[k.paw] = Math.max(out[k.paw], x);
  }
  return out;
}

/** Where a fore paw's brush (or the Wallkit's paws on its brush) is at its furthest out: ahead along the ground and a little out to its side. */
function reachOf(s: Wall, i: number): V3 {
  return s.brush.held ? [0, s.len * 0.3, 0] : [SIDE[i] * s.len * 0.07, s.len * 0.24, 0];
}

/**
 * A go at its task, scrubbing: crouched over the stone before it, its head down watching its brush, and its brushes pushed out
 * over the stone and drawn back, pressed flat to it: the Wallkit's both paws together, the bigger two's by turns, its body
 * rolling onto whichever is pushing and carried a little after it, and its tail swinging with every stroke.
 */
function workPlan(s: Wall, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim, t: number, down: number): Plan {
  const plan = stillPlan(R, p);
  plan.roll *= 1 - down;
  // The paws eased into their work at the start of a go, and back where they stand by its end.
  const paws = Math.max(a.graze, ramp(t, 0, 0.1));
  const [l, r] = brushOut(s, t);
  for (const i of [0, 1]) {
    const k = (i ? r : l) * paws, home = R.ankle[i], d = reachOf(s, i);
    plan.at[i] = [home[0] + d[0] * k, home[1] + d[1] * k, home[2]];
    plan.foot[i] = -6 * Math.sin(Math.PI * k);
  }
  const push = Math.max(l, r), side = r - l;
  // Crouched over the stone and leaning into each stroke: the body carried forward after the brush and rolled onto its side.
  plan.H -= down * R.h * (0.08 + 0.03 * push);
  p.pitch -= down * (4 + 3 * push);
  plan.surge = down * s.len * 0.07 * push;
  plan.roll += down * 6 * side;
  plan.rock += down * 1.5 * push;
  // Its head turned to the brush going out, its ears forward, its tail swinging the other way.
  p.neck[1] += down * 12 * side;
  for (const e of p.ears) e[0] += down * 10;
  p.tail[1] -= down * 22 * side + down * 8 * Math.sin(TAU * t * s.work.strokes);
  p.tail[0] += down * 6;
  // Its nose brought down to look at the stone, by bowing the neck and the head together.
  const stand = noseOver(spec, R, p, plan, 0);
  const want = Math.max(0.03, lerp(stand, stand * 0.78, down));
  let lo = -0.6, hi = 1.2;
  for (let q = 0; q < 16; q++) {
    const mid = (lo + hi) / 2;
    if (noseOver(spec, R, p, plan, mid) > want) lo = mid;
    else hi = mid;
  }
  bow(p, (lo + hi) / 2);
  return plan;
}

/** The neck and the head bowed together toward the ground, `x` of the way. */
function bow(p: QuadPose, x: number): void {
  p.neck[0] += 70 * x;
  p.head[0] -= 34 * x;
}
/** How high its nose is over the ground, bowed `x` (`bow`). */
function noseOver(spec: QuadSpec, R: Rest, p: QuadPose, plan: Plan, x: number): number {
  const q: QuadPose = { ...p, neck: [p.neck[0], p.neck[1]], head: [p.head[0], p.head[1], p.head[2]] };
  bow(q, x);
  const b = quadBones(spec, q);
  return Math.min(...R.chin.map((c) => place(b.head, c)[2])) - b.body.t[2] + plan.H;
}

/** How far a fore foot is pitched in a rake, against a kit's: a brush is turned half as far. */
const tilt = (s: Wall): number => (s.brush.held ? clamp(0.13 / s.claw.len, 0.12, 1) : 0.5);

/* ---- the strike ------------------------------------------------------------------------------ */

/**
 * The Dirtlet's pounce: it crouches, its rump up and wiggling and its tail going, springs forward with all four feet off the
 * ground, its right paw thrown up, and comes down with that paw swiping down onto whatever it pounced on; then it hops back
 * to where it was.
 */
function pouncePlan(s: Wall, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = WALL_HITS[0][0];
  const L = s.fore[0] + s.fore[1], J = s.len * 0.5;
  const crouch = ramp(t, 0.02, 0.18) * (1 - ramp(t, 0.18, 0.3));
  const out = ramp(t, 0.2, 0.48) * (1 - ramp(t, 0.68, 0.88));
  plan.surge = J * out;
  const fly = hump(t, 0.35, 0.17), hop = hump(t, 0.78, 0.11);
  const land = hump(t, hit + 0.02, 0.07) + 0.6 * hump(t, 0.88, 0.05);
  plan.H += R.h * (-0.1 * crouch + 0.6 * fly + 0.3 * hop - 0.06 * land);
  // Reared up as it springs, its front high, so the paw thrown up is over its own head; down onto the blow.
  p.pitch += -7 * crouch + 22 * fly - 6 * hump(t, hit, 0.08);
  plan.roll += 7 * crouch * Math.sin(t * TAU * 6);
  p.tail[0] += 40 * crouch + 20 * fly;
  p.tail[1] += 40 * crouch * Math.sin(t * TAU * 7);
  p.neck[0] += 10 * crouch - 8 * fly;
  // Its head turned away from the swiping paw and its weight leant off it as the paw goes up and comes down: the swipe is
  // seen clear of its face.
  const swipe = ramp(t, 0.16, 0.34) * (1 - ramp(t, hit + 0.06, 0.8));
  p.neck[1] += 30 * swipe;
  p.head[2] -= 12 * swipe;
  plan.roll -= 9 * swipe;
  p.head[0] += 6 * crouch;
  for (const e of p.ears) e[0] += 30 * crouch - 10 * fly;
  const there = (i: number): V3 => [R.ankle[i][0], R.ankle[i][1] + J, R.ankle[i][2]];
  for (const i of [0, 2, 3]) {
    const A = R.ankle[i];
    const [t0, t1] = i === 0 ? [0.22, 0.47] : [0.25, 0.48];
    if (t > t0 && t < t1) plan.at[i] = arc(A, there(i), ramp(t, t0, t1), L * (i < 2 ? 0.7 : 0.45));
    else if (t >= t1 && t < 0.7) plan.at[i] = there(i);
    else if (t >= 0.7 && t < 0.87) plan.at[i] = arc(there(i), A, ramp(t, 0.7, 0.87), L * 0.35);
    plan.foot[i] = -18 * Math.sin(Math.PI * ramp(t, t0, t1)) - 12 * Math.sin(Math.PI * ramp(t, 0.7, 0.87));
  }
  // The right paw thrown up high ahead, and swiped down onto the ground in front: the blow.
  const A = R.ankle[1], strike: V3 = [A[0], A[1] + J + s.paw * 0.5, A[2]];
  const sh = add(rotX([spec.fore.at[0], spec.fore.at[1], spec.fore.at[2]], p.pitch), [0, plan.surge, plan.H]);
  // Thrown up high beside its face, so the paw is seen over its shoulder from any side and not lost behind its head.
  const up: V3 = [A[0] * 1.15, sh[1] + L * 0.4, sh[2] + L * 0.8];
  // Swung up round the shoulder, by angle and by reach, so it never folds back into the shoulder as the body leaps past it.
  const DOWN = 0.38;
  const swung = (e: number): V3 => {
    const r0 = sub(A, sh), r1 = sub(up, sh);
    const d = Math.min(L * 0.8, lerp(Math.hypot(r0[1], r0[2]), Math.hypot(r1[1], r1[2]), e)), ang = lerp(Math.atan2(r0[1], -r0[2]), Math.atan2(r1[1], -r1[2]), e);
    return [lerp(A[0], up[0], e), sh[1] + d * Math.sin(ang), sh[2] - d * Math.cos(ang)];
  };
  if (t > 0.14 && t < DOWN) plan.at[1] = swung(ramp(t, 0.14, DOWN) ** 2);
  else if (t >= DOWN && t < hit) plan.at[1] = mixV(swung(1), strike, ((t - DOWN) / (hit - DOWN)) ** 2);
  else if (t >= hit && t < 0.7) plan.at[1] = strike;
  else if (t >= 0.7 && t < 0.87) plan.at[1] = arc(strike, A, ramp(t, 0.7, 0.87), L * 0.35);
  plan.foot[1] = 28 * hump(t, DOWN - 0.02, 0.12) - 18 * hump(t, hit, 0.05) - 12 * Math.sin(Math.PI * ramp(t, 0.7, 0.87));
  return plan;
}

/**
 * The Tunnelclaw's rake: it gathers itself, rears its fore end up with both claws raised, and rakes them down onto the ground
 * in front one after the other, lunging into it with its jaws thrust forward; then it settles back and puts its paws back.
 */
function rakePlan(s: Wall, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), [h1, h2] = WALL_HITS[1];
  const L = s.fore[0] + s.fore[1];
  const gather = ramp(t, 0, 0.22) * (1 - ramp(t, 0.22, 0.4));
  const rear = ramp(t, 0.12, 0.36) * (1 - ramp(t, h2 - 0.1, h2 + 0.12));
  const lunge = ramp(t, 0.26, 0.5) * (1 - ramp(t, 0.68, 1));
  plan.surge = s.len * 0.12 * lunge;
  plan.H += R.h * (-0.12 * gather + 0.22 * rear);
  p.pitch += -4 * gather + 22 * rear - 3 * hump(t, h1, 0.07) - 3 * hump(t, h2, 0.07);
  // The head thrown forward and down after the second rake: a snap of the jaws.
  const snap = hump(t, h2 + 0.04, 0.09);
  p.neck[0] += -10 * gather - 12 * rear + 26 * snap;
  p.head[0] += 6 * rear - 14 * snap;
  p.tail[0] += 30 * gather + 24 * rear;
  p.tail[1] += 30 * Math.sin(t * TAU * 3) * (gather + rear);
  for (const e of p.ears) e[0] += 20 * gather + 16 * rear;
  plan.roll += 7 * (hump(t, h2, 0.12) - hump(t, h1, 0.12));
  const rake = (i: number, hit: number, raise0: number): void => {
    const A = R.ankle[i];
    const high: V3 = [A[0] * 1.2, A[1] + plan.surge + L * 0.5, A[2] + L * 1.35];
    const down: V3 = [A[0] * 0.85, A[1] + s.len * 0.1 + L * 0.3, A[2]];
    const drawn: V3 = [down[0], down[1] - L * 0.3, down[2]];
    const top = hit - 0.09;
    if (t > raise0 && t < top) plan.at[i] = arc(A, high, ramp(t, raise0, top), 0);
    else if (t >= top && t < hit) plan.at[i] = mixV(high, down, ((t - top) / (hit - top)) ** 2);
    else if (t >= hit && t < hit + 0.14) plan.at[i] = arc(down, drawn, ramp(t, hit, hit + 0.14), 0);
    else if (t >= hit + 0.14 && t < hit + 0.36) plan.at[i] = arc(drawn, A, ramp(t, hit + 0.14, hit + 0.36), L * 0.22);
    plan.foot[i] = tilt(s) * (24 * hump(t, top, 0.12) - 16 * hump(t, hit + 0.04, 0.07));
  };
  rake(0, h1, 0.14);
  rake(1, h2, 0.24);
  return plan;
}

/** How long the Earthrend's slam takes to come down, as a share of its strike: after it has reared and held a moment at the top. */
const SLAM_DROP = 0.16;
/** How far reared up the Earthrend is through its strike: up, held at the top a moment, and dropped, fastest as it lands. */
function slamRear(t: number): number {
  const hit = WALL_HITS[2][0], top = hit - SLAM_DROP;
  return ramp(t, 0.02, top - 0.05) * (1 - clamp((t - top) / (hit - top)) ** 2);
}

/**
 * The Earthrend's slam: it rears up on its hind legs, crouched on its haunches, both fore paws raised high, and slams them down
 * onto the ground in front of it, the whole of it shaking as it lands; then it steps its paws back one at a time.
 */
function slamPlan(s: Wall, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = WALL_HITS[2][0];
  const L = s.fore[0] + s.fore[1];
  const top = hit - SLAM_DROP, rear = slamRear(t);
  const shake = t > hit ? Math.sin((t - hit) * 70) * (1 - ramp(t, hit, 0.9)) : 0;
  const land = hump(t, hit + 0.03, 0.08);
  plan.H += R.h * (0.2 * rear - 0.08 * land) + 0.02 * shake;
  p.pitch += 24 * rear - 3 * land;
  p.neck[0] += -18 * rear + 6 * land;
  p.head[0] += -10 * rear;
  p.tail[0] += -14 * rear + 30 * land;
  p.tail[1] += 10 * shake;
  plan.rock += 2.5 * shake;
  plan.roll += 2 * shake;
  for (const e of p.ears) e[0] += 20 * rear;
  for (const i of [0, 1]) {
    const A = R.ankle[i];
    const high: V3 = [A[0] * 1.1, A[1] + L * 0.45, A[2] + L * 1.05];
    const down: V3 = [A[0] * 0.9, A[1] + s.len * 0.08, A[2]];
    const [b0, b1] = i ? [0.78, 0.96] : [0.66, 0.84];
    if (t < top) plan.at[i] = arc(A, high, ramp(t, 0.04, top - 0.05), 0);
    else if (t < hit) plan.at[i] = mixV(high, down, ((t - top) / (hit - top)) ** 2);
    else if (t < b0) plan.at[i] = down;
    else if (t < b1) plan.at[i] = arc(down, A, ramp(t, b0, b1), L * 0.16);
    plan.foot[i] = 18 * ramp(t, 0.04, top - 0.05) * (1 - ramp(t, top, hit)) - 8 * hump(t, hit, 0.04);
  }
  return plan;
}

/** Evolving: hunched as the light gathers and its moss and stones grow over its back, then drawn up tall at the turn, a shake of the head, and settled. */
function evolvePlan(R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p);
  const hunch = ramp(t, 0.06, 0.38) * (1 - ramp(t, 0.38, 0.54)), up = ramp(t, 0.44, 0.6) * (1 - ramp(t, 0.72, 0.94));
  plan.H += R.h * -0.08 * hunch;
  p.pitch += -3 * hunch + 3 * up;
  p.neck[0] += 18 * hunch - 14 * up;
  p.head[0] += -10 * hunch + 16 * up;
  p.head[2] += (14 - 4 * (R.h > 1 ? 2 : R.h > 0.6 ? 1 : 0)) * hump(t, 0.62, 0.1) * Math.sin(t * (R.h > 1 ? 50 : 70));
  p.tail[0] += 30 * up;
  for (const e of p.ears) e[0] += 25 * hunch;
  plan.roll += 3 * hump(t, 0.62, 0.1) * Math.sin(t * 60);
  return plan;
}

/* ---- its bones ------------------------------------------------------------------------------- */

/** Where each ear is rooted on the head (the right one). */
function earRoot(s: Wall): V3 {
  const H = s.head, q = onRings(H, lerp(H.y[0], H.y[2], s.ear.at[0]), s.ear.at[1]);
  return sub(q.p, scale(q.n, 0.04));
}
/** Where its nose ends, in the head's frame. */
const noseTip = (s: Wall): V3 => { const H = s.head, last = H.y.length - 1; return [0, H.y[last] + s.nose * 0.9, H.z[last] - H.h[last] * 0.4]; };

/** Its pose for what it is doing, over the one a body on four legs has (`quadPose`), and where its feet go. */
function planOf(s: Wall, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
  p.pitch += R.pitch;
  const act = a.act;
  if (act?.kind === 'strike') return s.strike === 0 ? pouncePlan(s, spec, R, p, act.t) : s.strike === 1 ? rakePlan(s, spec, R, p, act.t) : slamPlan(s, spec, R, p, act.t);
  if (act?.kind === 'work') return workPlan(s, spec, R, p, a, act.t, downOf(act.t, a.graze));
  if (act?.kind === 'evolve') return evolvePlan(R, p, act.t);
  if (a.graze > 0 && a.go <= 0) return workPlan(s, spec, R, p, a, 0, a.graze);
  if (a.go <= 0) return still(s, R, p, a);
  const going = goingPlan(s, spec, R, p, a), g = smooth(a.go);
  const G = s.gait, w = frac(a.u);
  // Going: the head low and nodding with the stride, swinging against the waddle; the tail going, the ears back with speed.
  p.neck[0] += g * (6 + 4 * a.gait);
  p.neck[1] += g * G.sway * Math.sin(w * TAU - 0.6);
  p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.8) - g * 3;
  p.tail[1] += g * 18 * Math.sin(w * TAU + 1);
  // Its weight let down onto each fore foot as it lands: a squash of the barrel that stirs what is on its back.
  p.squash += g * (s.stage === 2 ? 0.035 : 0.02) * (pulse(w - 0.78) + pulse(w - 0.28));
  return a.go >= 1 ? going : mixPlan(still(s, R, p, a), going, g);
}

/**
 * Standing about: its nose working at the air, down now and then for a sniff of the ground, and now and then its head lifted
 * right up, nose high, to sniff the wind; a kit's ears pricking.
 */
function still(s: Wall, R: Rest, p: QuadPose, a: Anim): Plan {
  const plan = stillPlan(R, p);
  const sniff = beat(a.t, [6.2, 18.4], 1.6);
  const lift = beat(a.t, [2.4, 11.6, 21.2], 2.2);
  p.neck[0] += 12 * sniff - 22 * lift;
  p.head[0] += 2.5 * Math.sin(a.t * TAU * 2.5) * (1 - sniff) - 12 * sniff + 3 * sniff * Math.sin(a.t * 28) + 14 * lift + 2 * lift * Math.sin(a.t * 30);
  p.head[2] += 10 * lift * Math.sin(a.t * TAU * 0.5);
  if (s.stage === 0) for (const e of p.ears) e[0] -= 10 * beat(a.t, [4.2, 13.3], 0.5);
  else for (const e of p.ears) e[0] *= 0.3;
  return plan;
}

/** How low a leg's shin and knee come, the rings of their tubes as `legPieces` builds them: the lowest point of any. */
function shinLow(s: Wall, b: Bones, i: number): number {
  const fore = i < 2, key = LEGS4[i], L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick);
  const end = Math.min(w * 0.62, L[2] * (fore ? 1.05 : 0.85)), lap = w * (fore ? 0.25 : 0.55);
  const rings: Array<[string, V3, number]> = [
    [`${key}0`, [0, 0, -L[0]], w * 0.62],
    [`${key}1`, [0, 0, lap], w * 0.5], [`${key}1`, [0, 0.007, lap - (lap + L[1]) / 3], w * 0.58], [`${key}1`, [0, 0.013, -L[1] * 0.66], lerp(w * 0.56, end, 0.5)], [`${key}1`, [0, 0.02, -L[1]], end],
  ];
  let low = Infinity;
  for (const [bone, at, r] of rings) {
    const c = place(b[bone], at), d = sub(place(b[bone], add(at, [0, 0, -1])), c);
    low = Math.min(low, c[2] - r * Math.sqrt(Math.max(0, 1 - d[2] * d[2])));
  }
  return low;
}
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];

/**
 * The bones of a stage: its pose, every leg bent to put its foot where the pose says (`legTo`), the body raised to the height
 * the pose says and carried forward as far, and the barrel rolled and rocked over its legs, so the feet stay where they are.
 */
function wallBones(s: Wall): (a: Anim) => Bones {
  const spec = specOf(s), R = restOf(s, spec);
  return (a) => {
    const p = quadPose(spec, { ...a, graze: 0, go: a.act ? 0 : a.go });
    const plan = planOf(s, spec, R, p, a);
    // However it is posed, its head never down in the ground: its neck and head lifted together just as far as keeps it out.
    if (noseOver(spec, R, p, plan, 0) < 0.012) {
      let lo = -1.5, hi = 0;
      for (let q = 0; q < 14; q++) {
        const mid = (lo + hi) / 2;
        if (noseOver(spec, R, p, plan, mid) < 0.012) hi = mid;
        else lo = mid;
      }
      bow(p, lo);
    }
    for (let i = 0; i < 4; i++) {
      // However the foot is pitched, no point of its sole or its claws below the ground.
      const g = plan.at[i], floor = Math.max(...R.sole[i].map((q) => -rotX(q, plan.foot[i])[2]));
      if (g[2] < floor) g[2] = floor;
      p.foot[i] = plan.foot[i];
    }
    p.roll = 0;
    const solve = (): Bones => {
      for (let i = 0; i < 4; i++) {
        const g = plan.at[i];
        const [sw, fold] = legTo(spec, i, p.pitch, [g[0], g[1] - plan.surge, g[2] - plan.H]);
        p.legs[i] = [sw, fold, 0];
      }
      return lifted(quadBones(spec, p), 0);
    };
    let b = solve();
    b = lifted(b, plan.H - b.body.t[2]);
    // Nor the shin or the knee: a leg whose shin would dip into the ground has its foot put up by as much, and is bent again.
    // In a strike, whose hind feet never leave the ground, the body is raised by as much instead, so they stay down.
    const planted = a.act?.kind === 'strike' || a.act?.kind === 'evolve';
    for (let pass = 0; pass < 3; pass++) {
      let again = false, rise = 0;
      for (let i = 0; i < 4; i++) {
        const dip = 0.012 - shinLow(s, b, i);
        if (dip <= 0) continue;
        again = true;
        if (planted && i >= 2) rise = Math.max(rise, dip * 1.15);
        else plan.at[i][2] += dip * 1.15;
      }
      if (!again) break;
      plan.H += rise;
      b = solve();
      b = lifted(b, plan.H - b.body.t[2]);
    }
    b.shadow = shadowOf(b.body, Math.max(0, plan.H - R.h));
    if (plan.surge) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + plan.surge, b[k].t[2]] };
    if (plan.roll || plan.rock) b.trunk = joint(b.trunk, [0, 0, 0], plan.rock, plan.roll, 0);
    return b;
  };
}

/* ---- leaves, blossom and plumes ------------------------------------------------------------------- */

/** Each face wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
function wound(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}

/**
 * A leaf: a broad pointed oval from `root` out along `dir`, its face turned toward `face`, `L` long, its tip drooping `droop`
 * of its length (lifted, if less than nought); a shallow V along its middle rib, its root darker, its body `mat` and its tip
 * `tip`, the bright young green of a leaf's edge in the sun.
 */
function leafMesh(root: V3, dir: V3, face: V3, L: number, droop: number, mat: Mat, tip: Mat): Mesh {
  const d = unit(dir), n0 = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n0));
  const fall = (k: number): V3 => scale(n0, -L * droop * k);
  const at = [0, 0.2, 0.45, 0.7, 0.88, 1], falls = [0, 0.04, 0.2, 0.5, 0.78, 1];
  const pts = at.map((k, q) => add(add(root, scale(d, L * k)), fall(falls[q])));
  // An oval with a point: widest a little before its middle, rounding in to the tip.
  const ws = [0.06, 0.25, 0.32, 0.28, 0.17, 0.015].map((w) => w * L), th = L * 0.02;
  const v: V3[] = [];
  // Each step along it: its left edge, its rib and its right edge, the edges lifted a little off the rib; and under them again.
  for (let k = 0; k < pts.length; k++) {
    const lift = scale(n0, ws[k] * 0.2);
    v.push(add(add(pts[k], scale(side, -ws[k])), lift), pts[k], add(add(pts[k], scale(side, ws[k])), lift));
  }
  for (let k = 0; k < pts.length; k++) for (let j = 0; j < 3; j++) v.push(sub(v[k * 3 + j], scale(n0, th)));
  const f: Face[] = [], want: V3[] = [], B = pts.length * 3;
  for (let k = 0; k < pts.length - 1; k++) {
    const m: Mat = k === 0 ? 'leafDark' : k >= 3 ? tip : mat;
    for (const j of [0, 1]) {
      f.push({ i: [k * 3 + j, k * 3 + j + 1, (k + 1) * 3 + j + 1, (k + 1) * 3 + j], m: k === 1 && j === 0 ? mat : m });
      want.push(n0);
      f.push({ i: [B + k * 3 + j, B + k * 3 + j + 1, B + (k + 1) * 3 + j + 1, B + (k + 1) * 3 + j], m: 'leafDark' });
      want.push(scale(n0, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/** One thing among many that stir on its back: its mesh, the root it sways on, a number of its own and how much it sways. */
interface Sway { mesh: Mesh; root: V3; id: number; k?: number }

/**
 * The mantle: leaves over its back and shoulders in sprays, rows of them from the shoulders to the rump set like bricks, the
 * leaves of each spray fanned out round it and lying back and down the way the back falls away, tilted up off it so they
 * overlap; those along the edge hanging down over the flanks. On the bigger two a second layer over the first, standing off
 * the back, so the mantle is thick. And at its front a few big leaves standing up over its shoulders behind the head.
 */
function mantleOf(s: Wall): Sway[] {
  const B = s.body, M = s.mantle, out: Sway[] = [];
  for (let layer = 0; layer < M.layers; layer++) {
    const top = layer === M.layers - 1;
    const rows = Math.max(2, M.rows - 2 * layer), per = Math.max(2, M.per - layer);
    for (let r = 0; r < rows; r++) {
      const f = r / Math.max(1, rows - 1);
      const y0 = lerp(M.from, M.to, f) - (layer ? 0.03 * s.len : 0);
      const count = per + (r % 2 ? -1 : 0);
      for (let q = 0; q < count; q++) {
        const id = 100 + layer * 300 + r * 17 + q;
        const g = count > 1 ? q / (count - 1) - 0.5 : 0, edge = Math.abs(g) * 2;
        // Narrower toward the rump, as a mantle is over the shoulders; the layer over it narrower again.
        const spread = M.spread * (1 - 0.15 * f) * (top && M.layers > 1 ? 0.72 : 1);
        const th = Math.PI / 2 + g * 2 * spread + (jitter(id) - 0.5) * 0.12;
        const at = onRings(B, y0 + (jitter(id + 3) - 0.5) * 0.06 * s.len, th);
        const c = Math.cos(th), wv = Math.sign(c) || 1;
        const round: V3 = unit([wv * Math.sin(th), 0, -wv * c * 0.9]);
        // Which way is downhill here: back along the spine, turning down the flank toward the edge.
        const fall = unit(add(scale([0, -1, 0], 1 - 0.7 * edge), scale(round, 0.2 + 1.0 * edge)));
        const z = at.n, side = unit(cross(z, fall));
        const lift = M.lift * (top ? 1 : 0.3) * (1 - 0.6 * edge);
        const c0 = add(at.p, scale(z, lift));
        const k = edge > 0.8 ? 4 : 5;
        for (let e = 0; e < k; e++) {
          const lid = id * 7 + e;
          // Fanned round from one side of downhill to the other, the middle leaf furthest down; tilted up off the back.
          const a = lerp(-1.9, 1.9, k > 1 ? e / (k - 1) : 0.5) + (jitter(lid) - 0.5) * 0.5;
          const tilt = (edge > 0.8 ? 0.1 : top ? 0.42 + 0.3 * jitter(lid + 1) : 0.3 + 0.2 * jitter(lid + 1)) * (1 - 0.4 * Math.abs(a) / 1.9);
          const flat = add(scale(fall, Math.cos(a)), scale(side, Math.sin(a)));
          const dir = unit(add(scale(flat, Math.cos(tilt)), scale(z, Math.sin(tilt))));
          const up = unit(add(z, [0, 0, 0.4]));
          const face = unit(sub(up, scale(dir, dot(up, dir))));
          const L = M.len * (0.95 + 0.4 * jitter(lid + 2)) * (1 - 0.25 * Math.abs(a) / 1.9) * (1 + 0.2 * edge) * (1.12 - 0.2 * f);
          const root = add(c0, scale(flat, M.len * 0.12));
          const droop = 0.1 + M.hang * edge ** 1.5 * Math.cos(a) ** 2;
          const tint = jitter(lid + 8);
          const mat: Mat = top ? (tint < 0.25 ? 'moss' : 'leaf') : 'leafDark';
          const tip: Mat = top ? (tint < 0.25 ? 'leaf' : 'moss') : 'leaf';
          out.push({ mesh: leafMesh(root, dir, face, L, droop, mat, tip), root: c0, id, k: 0.6 + 0.8 * edge });
        }
      }
    }
  }
  // The big leaves standing up off its shoulders, behind its head, leaning back: two either side on the kit, three on the others.
  const ups = s.stage === 0 ? 2 : 3;
  for (const sd of [1, -1]) {
    for (let q = 0; q < ups; q++) {
      const id = 590 + q * 3 + (sd > 0 ? 0 : 1);
      const at = onRings(B, M.from - (0.02 + 0.07 * q) * s.len, Math.PI / 2 - sd * (0.35 + 0.3 * q));
      const dir = unit([sd * (0.35 + 0.25 * q), -0.55 - 0.2 * q, 0.8 - 0.15 * q]);
      const up = unit([sd * 0.8, 0.4, 0.4]);
      const root = add(at.p, scale(at.n, M.lift * 0.6));
      out.push({ mesh: leafMesh(root, dir, unit(sub(up, scale(dir, dot(up, dir)))), M.len * (1.25 - 0.12 * q), 0.18, 'leaf', 'moss'), root, id, k: 1.3 });
    }
  }
  return out;
}

/**
 * A sprig of white blossom hanging from its mantle, as wisteria hangs: two open flowers at the top, five white petals about a
 * yellow middle, and under them a hanging string of buds, each smaller than the one above.
 */
function sprigOf(root: V3, out: V3, R: number, id: number): Mesh {
  const parts: Mesh[] = [], discs: Disc[] = [];
  const o = unit(out), hang = unit(add(o, [0, -0.2, -1.6]));
  const n = 6;
  for (let q = 0; q < n; q++) {
    const k = q / (n - 1);
    const c = add(add(root, scale(hang, R * (0.6 + 3.2 * k))), scale(o, R * 0.5 * Math.sin(Math.PI * k * 0.8)));
    const r = R * (0.62 - 0.3 * k) * (0.9 + 0.2 * jitter(id + q));
    parts.push(orbAlong(c, hang, [r, r, r * 1.15], 5, 3, 'petal'));
  }
  for (let e = 0; e < 2; e++) {
    const c = add(root, add(scale(o, R * (0.5 + 0.2 * e)), [0, (e ? -1 : 1) * R * 0.9, R * 0.2]));
    const nn = unit(add(o, [0, e ? -0.3 : 0.3, 0.4]));
    let u = cross([0, 0, 1], nn);
    if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = [1, 0, 0];
    u = unit(u);
    const w = cross(nn, u);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU + id;
      discs.push(disc(add(c, add(scale(u, Math.cos(a) * R * 0.62), scale(w, Math.sin(a) * R * 0.62))), nn, R * 0.52, R * 0.52, 6, 'petal'));
    }
    discs.push(disc(add(c, scale(nn, 0.006)), nn, R * 0.3, R * 0.3, 6, 'bloom'));
  }
  return merge(...parts, paint(discs));
}

/** Its sprigs of blossom: out on the mantle's edge over each shoulder, and further back by turns. */
function blossomsOf(s: Wall): Sway[] {
  const B = s.body, M = s.mantle, out: Sway[] = [];
  for (let q = 0; q < s.blossoms; q++) {
    const sd = q % 2 ? -1 : 1, id = 700 + q;
    const f = s.blossoms > 1 ? Math.floor(q / 2) / Math.max(1, Math.ceil(s.blossoms / 2) - 1) : 0;
    const y = lerp(M.from - 0.12 * s.len, lerp(M.from, M.to, 0.55), f);
    const th = Math.PI / 2 - sd * M.spread * (0.55 + 0.15 * jitter(id));
    const at = onRings(B, y, th);
    const root = add(at.p, scale(at.n, M.lift * 0.9 + M.len * 0.12));
    out.push({ mesh: sprigOf(root, at.n, M.len * 0.2, id), root, id, k: 1.6 });
  }
  return out;
}

/**
 * A plume of cream fur: `n` long soft feathers fanned from `root` along `dir`, each curving toward `bend` as it goes, in the
 * plane square to `face`; broad in the middle, a point at the tip, a paler rib down each.
 */
function plumeOf(root: V3, dir: V3, bend: V3, face: V3, L: number, W: number, n: number, id: number, fine: boolean, mats: readonly [Mat, Mat] = ['coatLight', 'belly']): Mesh {
  const d0 = unit(dir), f0 = unit(sub(face, scale(d0, dot(face, d0)))), across = unit(cross(f0, d0));
  const out: Mesh[] = [];
  const N = fine ? 5 : 3;
  for (let q = 0; q < n; q++) {
    const g = n > 1 ? q / (n - 1) - 0.5 : 0;
    const d = unit(add(d0, scale(across, g * 0.9)));
    const len = L * (1 - 0.35 * Math.abs(g) * 2) * (0.9 + 0.2 * jitter(id + q));
    const pts: V3[] = [], ws: number[] = [];
    for (let e = 0; e <= N; e++) {
      const k = e / N;
      pts.push(add(add(root, scale(d, len * k)), scale(bend, len * 0.45 * k * k)));
      ws.push(e === N ? 0.004 : W * Math.sin(Math.PI * Math.min(1, 0.18 + k * 0.82)) ** 0.8);
    }
    out.push(blade(pts, ws, f0, { mat: mats[q % 2], rib: 'muzzle', fold: 0.3, thick: W * 0.12 }));
  }
  return merge(...out);
}

/** The plumes on its flanks over its haunches, sweeping back and down, both sides (its shoulders' are on its fore legs, `legPieces`). */
function bodyPlumes(s: Wall, fine: boolean): Mesh {
  const B = s.body, P = s.plumes, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    if (P.flank) {
      const q0 = onRings(B, lerp(B.y[1], B.y[2], 0.6), -0.3), q = sd > 0 ? q0 : left(q0);
      const root = add(q.p, scale(q.n, 0.02));
      out.push(plumeOf(root, [sd * 0.5, -0.8, -0.25], [sd * 0.1, -0.2, -0.3], [sd, 0, 0.2], P.flank, P.flank * 0.2, 3, 40 + sd, fine));
    }
  }
  return merge(...out);
}

/** Its head's plumes: fluffy cheeks, and on the Stonepolish a mane of plumes swept back from the back of its head. */
function headPlumes(s: Wall, fine: boolean): Mesh {
  const H = s.head, P = s.plumes, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    if (P.cheek) {
      const q0 = onRings(H, lerp(H.y[1], H.y[2], 0.7), -0.25), q = sd > 0 ? q0 : left(q0);
      out.push(plumeOf(sub(q.p, scale(q.n, 0.02)), [sd * 0.75, -0.5, -0.35], [sd * 0.1, -0.15, -0.15], [sd * 0.2, 0.25, 1], P.cheek, P.cheek * 0.34, 4, 50 + sd, fine, ['mark', 'coatLight']));
    }
    if (P.head) {
      // Three tiers swept back from behind the cheeks, the jaw and the crown, the lowest longest, over the neck and shoulders.
      for (let k = 0; k < 3; k++) {
        const q0 = onRings(H, lerp(H.y[0], H.y[2], 0.55 - 0.1 * k), -0.35 + 0.65 * k), q = sd > 0 ? q0 : left(q0);
        out.push(plumeOf(sub(q.p, scale(q.n, 0.04)), [sd * (0.55 - 0.15 * k), -0.85, 0.05 + 0.25 * k], [sd * 0.1, -0.2, -0.35], [sd, 0.1, 0.45],
          P.head * (1 - 0.15 * k), P.head * 0.2, 4, 60 + sd + k * 5, fine));
      }
    }
  }
  return merge(...out);
}

/** What stirs on its back, as one mesh: each corner's root (what it sways on) and a phase of its own. */
interface Stir { mesh: Mesh; root: V3[]; ph: number[]; k: number[] }
function stirOf(parts: ReadonlyArray<{ mesh: Mesh; root: V3; id: number; k?: number }>): Stir {
  const root: V3[] = [], ph: number[] = [], k: number[] = [];
  for (const p of parts) for (let q = 0; q < p.mesh.v.length; q++) { root.push(p.root); ph.push(jitter(p.id + 31) * TAU); k.push(p.k ?? 1); }
  return { mesh: merge(...parts.map((p) => p.mesh)), root, ph, k };
}

/**
 * How what is on its back stirs this moment: how far each thing sways on its root and how fast, and how far grown it is. A
 * breeze through its leaves standing; stirred with each step as it goes, shaken as a blow lands and as it digs; and as it
 * evolves, growing out of its back from under half their size.
 */
function stirring(s: Wall, a: Anim, leaf: boolean): { jig: number; at: number; grow: number } {
  // A breeze, standing: a slow sway, three a minute, and a quicker shiver over it.
  let jig = leaf ? 0.05 * (1 - a.go) * (0.6 + 0.4 * cyc(a.t, 3)) : 0, at = a.t * TAU * 0.5, grow = 1;
  if (a.go > 0) {
    jig += smooth(a.go) * s.gait.jiggle * (0.05 + 0.03 * a.gait) * (leaf ? 2.2 : 0.6);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    for (const h of WALL_HITS[s.strike]) jig += (leaf ? 0.16 : 0.05) * hump(act.t, h + 0.05, 0.16);
    at = act.t * 60;
  } else if (act?.kind === 'work') {
    // Shaken at the end of every stroke, as the brush turns back.
    for (const h of wallScrubs(s.stage)) jig += downOf(act.t, a.graze) * (leaf ? 0.07 : 0.03) * hump(act.t, h + 0.02, 0.08);
    at = act.t * 50;
  } else if (act?.kind === 'evolve') {
    const t = act.t;
    grow = 0.45 + 0.55 * ramp(t, 0.04, 0.5) + 0.12 * hump(t, 0.54, 0.08);
    jig += 0.08 * hump(t, 0.62, 0.1);
    at = t * 70;
  }
  return { jig: Math.min(leaf ? 0.3 : 0.07, jig), at, grow };
}

/** A piece of things that stir and grow (`stirring`): each whole, scaled from its root and swayed on it, a beat of its own. */
function stirred(s: Wall, G: Stir, leaf: boolean): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { jig, at, grow } = stirring(s, a, leaf);
    if (!jig && grow === 1) return v as V3[];
    return v.map((p, i) => {
      const r = G.root[i], ph = G.ph[i], kk = G.k[i];
      let [x, y, z] = scale(sub(p, r), grow);
      const side = jig * kk * Math.sin(at + ph), fore = jig * kk * 0.6 * Math.cos(at * 1.3 + ph * 1.3);
      const cs = Math.cos(side), ss = Math.sin(side), cf = Math.cos(fore), sf = Math.sin(fore);
      [x, z] = [x * cs + z * ss, -x * ss + z * cs];
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      return [r[0] + x, r[1] + y, r[2] + z];
    });
  };
}

/* ---- the head ------------------------------------------------------------------------------- */

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth's line. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.012)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  const n = pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3);
  return { v: facingOut(v, n) ? v : v.reverse(), m };
}

/** Whether a ring of corners, as listed, faces along `n`. */
function facingOut(v: readonly V3[], n: V3): boolean {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return nx * n[0] + ny * n[1] + nz * n[2] >= 0;
}

/**
 * The brown stripe down the middle of its face, painted on the head from its brown crown to the bridge of its nose: broad
 * over the brow and narrowing toward the nose, so the cream of its face shows either side of it as a pale stripe over each
 * eye.
 */
function stripeOf(s: Wall): Disc {
  const H = s.head, last = H.y.length - 1, len = H.y[last] - H.y[0];
  const ys = Array.from({ length: 8 }, (_, q) => lerp(H.y[0] + len * 0.2, H.y[last] - len * 0.12, q / 7));
  const half = (y: number): number => lerp(0.26, 0.06, (y - H.y[0]) / len);
  const v = [
    ...ys.map((y) => { const q = onRings(H, y, Math.PI / 2 - half(y)); return add(q.p, scale(q.n, 0.01)); }),
    ...[...ys].reverse().map((y) => { const q = onRings(H, y, Math.PI / 2 + half(y)); return add(q.p, scale(q.n, 0.01)); }),
  ];
  return { v: facingOut(v, [0, 0, 1]) ? v : v.reverse(), m: 'coat' };
}

/**
 * The dark mask down either side of its face through the eye, painted on the head from beside the nose back to under the ear,
 * rising toward the ear and widest behind the eye: what makes its face whatever the facets under it are cut at.
 */
function bandOf(s: Wall, side: number): Disc {
  const H = s.head, last = H.y.length - 1, len = H.y[last] - H.y[0], M = s.mask, c = s.eye.up;
  const y0 = H.y[0] + len * M.ear, y1 = H.y[0] + len * M.nose;
  const ys = Array.from({ length: 9 }, (_, q) => lerp(y0, y1, q / 8));
  // Its middle line: through the eye, rising toward the ear; how high it is either side of that, most just behind the eye.
  const mid = (y: number): number => c + M.rise * clamp((s.eye.y - y) / (s.eye.y - y0));
  const half = (y: number): number => {
    const f = (y - y0) / (y1 - y0), e = (s.eye.y - y0) / (y1 - y0);
    return M.high * (f < e ? lerp(0.7, 1, smooth(f / e)) : lerp(1, 0.3, smooth((f - e) / (1 - e))));
  };
  const on = (y: number, th: number): V3 => { const q0 = onRings(H, y, th), q = side > 0 ? q0 : left(q0); return add(q.p, scale(q.n, 0.008)); };
  const v = [...ys.map((y) => on(y, mid(y) - half(y) * 0.85)), ...[...ys].reverse().map((y) => on(y, mid(y) + half(y)))];
  const out = side > 0 ? onRings(H, s.eye.y, c).n : left(onRings(H, s.eye.y, c)).n;
  return { v: facingOut(v, out) ? v : v.reverse(), m: 'spot' };
}

/**
 * The eyes: amber, round, a dark middle and two glints, set in the dark mask through its face, ringed dark; on the Bristleward
 * and the Stonepolish narrowed under a heavier brow, which is what makes the face set to its work. All of an eye goes out of
 * sight together behind the head.
 */
function eyesOf(s: Wall, shut: boolean): Mesh {
  const E = s.eye, H = s.head, meshes: Mesh[] = [];
  const c0 = onRings(H, E.y, E.up), rho = Math.max(0.05, Math.hypot(c0.p[0], c0.p[2] - lerp(H.z[2], H.z[4], 0.5)));
  for (const side of [1, -1]) {
    const q = side > 0 ? c0 : left(c0), out: Disc[] = [];
    const at = sub(q.p, scale(q.n, H.w[2] * 0.05));
    // Each shape painted onto the head itself, every corner on its curve: `cy` along the head and `cu` up it from the eye's
    // middle, `ry` by `ru` across, `lift` off the surface; `tilt` slants it.
    const patch = (cy: number, cu: number, ry: number, ru: number, sides: number, m: Mat, lift: number, o: { tilt?: number; lit?: boolean } = {}): Disc => {
      const v: V3[] = [];
      for (let j = 0; j < sides; j++) {
        const a = ((j + 0.5) / sides) * TAU, dy = cy + Math.cos(a) * ry, du = cu + Math.sin(a) * ru + (o.tilt ?? 0) * side * Math.cos(a) * ry;
        const r0 = onRings(H, E.y + dy, E.up + du / rho), r1 = side > 0 ? r0 : left(r0);
        v.push(add(r1.p, scale(r1.n, lift)));
      }
      return { v: facingOut(v, q.n) ? v : v.reverse(), m, at, lit: o.lit };
    };
    const r = E.size, tall = E.tall;
    // Not drawn once it is turned more than about eighty degrees from the viewer, as it goes round toward the outline.
    const away: V3 = [-q.n[0], -q.n[1], 0.62 - q.n[2]];
    const done = (): void => { const m = paint(out); m.f.forEach((f) => { f.unless = away; }); meshes.push(m); };
    if (shut) {
      out.push(patch(0, -r * 0.1, r * 1.1, r * 0.28, 8, 'lid', 0.012));
      done();
      continue;
    }
    // A pale rim round it, as the cream of the face shows round the eye in the mask; then the eye, ringed dark.
    out.push(patch(-r * 0.05, r * 0.02, r * 1.42, r * tall * 1.36, 10, 'muzzle', 0.006));
    out.push(patch(0, r * 0.05, r * 1.2, r * tall * 1.18, 10, 'lid', 0.009));
    out.push(patch(0, 0, r, r * tall, 12, 'bloom', 0.012));
    out.push(patch(r * 0.08, 0, r * 0.52, r * tall * 0.62, 8, 'eye', 0.016));
    // The brow: a dark lid come down over the top of the eye, slanting down toward the nose.
    if (E.lid) out.push(patch(0, r * tall * (1.35 - E.lid * 1.1), r * 1.35, r * tall * 0.75, 10, 'lid', 0.02, { tilt: -0.4 }));
    out.push(patch(r * 0.3, r * tall * (E.lid ? 0.14 : 0.34), r * 0.28, r * 0.28, 6, 'glint', 0.024, { lit: true }));
    if (!E.lid) out.push(patch(-r * 0.3, -r * tall * 0.4, r * 0.13, r * 0.13, 5, 'glint', 0.024, { lit: true }));
    done();
  }
  return merge(...meshes);
}

/**
 * The head, built as rings from the back of the skull to the end of the nose: brown fur over the crown and behind the face,
 * the face cream; a brown stripe down the middle of the brow, a dark mask either side through each eye, a small dark nose on
 * the end, and a mouth line back along the muzzle, turned up in a small smile.
 */
/** A head's rings with one more between each two, on a smooth curve through them, so the head is round and not cut in steps. */
function finer(H: HeadRings): Rings {
  const out: Rings = { y: [], z: [], w: [], h: [] }, N = H.y.length;
  const cr = (a: readonly number[], i: number, t: number): number => {
    const p0 = a[Math.max(0, i - 1)], p1 = a[i], p2 = a[i + 1], p3 = a[Math.min(N - 1, i + 2)];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  };
  for (let i = 0; i < N - 1; i++) {
    for (const t of [0, 0.5]) {
      out.y.push(cr(H.y, i, t)); out.z.push(cr(H.z, i, t)); out.w.push(Math.max(0.01, cr(H.w, i, t))); out.h.push(Math.max(0.01, cr(H.h, i, t)));
    }
  }
  out.y.push(H.y[N - 1]); out.z.push(H.z[N - 1]); out.w.push(H.w[N - 1]); out.h.push(H.h[N - 1]);
  return out;
}

function headOf(s: Wall, n0: number, k: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1, M = s.mask, len = H.y[last] - H.y[0];
  const F = finer(H), fl = F.y.length - 1, n = Math.round(n0 * 1.5);
  const skull = tube(F.y.map((y, q) => [0, y, F.z[q]] as V3), F.w, F.h, n, (ring, j) => {
    const up = Math.sin(((j + 1) / n) * TAU), f = (F.y[Math.min(ring, fl)] - F.y[0]) / len;
    if (f < M.back) return up < -0.3 ? 'mark' : 'coat';
    // The crown brown between the ears, back of the brow.
    if (up > M.crown && f < M.back + 0.22) return 'coat';
    return ring >= fl - 1 ? 'muzzle' : 'mark';
  });
  const tipC: V3 = [0, H.y[last] + s.nose * 0.2, H.z[last] - H.h[last] * 0.1];
  const nose = orbAlong(tipC, [0, 1, 0.15], [s.nose * 1.3, s.nose * 0.9, s.nose * 0.95], 7, 4, 'nose');
  const front: V3 = [0, tipC[1] + s.nose * 0.86, tipC[2]];
  const nostrils = paint([1, -1].map((sd) => disc(add(front, [sd * s.nose * 0.4, 0.006, -s.nose * 0.1]), [0, 1, 0.1], s.nose * 0.17, s.nose * 0.24, 6, 'pad')));
  const parts: Array<Mesh | undefined | false> = [skull, nose, nostrils, paint([stripeOf(s), bandOf(s, 1), bandOf(s, -1)])];
  // The mouth: back along the side of the muzzle from under the nose, turned up at its corner.
  parts.push(paint([1, -1].map((sd) => {
    const pts = Array.from({ length: 6 }, (_, q) => {
      const f = q / 5, y = lerp(H.y[last - 1], H.y[last] - len * (s.stage === 0 ? 0.3 : 0.34), f);
      const th = -0.6 + 0.32 * f ** 2;
      const at = onRings(H, y, th);
      return sd > 0 ? at : left(at);
    });
    return { ...line(pts, H.w[2] * 0.028, 'lid'), at: sub(pts[3].p, scale(pts[3].n, 0.05)) };
  })));
  parts.push(eyesOf(s, shut));
  return merge(...parts);
}

/** Solids inside the head that hide what is round the far side of them: the skull and the muzzle. */
function headSolids(s: Wall): Array<{ c: V3; r: V3 }> {
  const H = s.head;
  return [
    { c: [0, H.y[2], H.z[2]], r: [H.w[2] * 0.85, (H.y[3] - H.y[0]) * 0.5, H.h[2] * 0.85] },
    { c: [0, (H.y[4] + H.y[6]) / 2, H.z[5]], r: [H.w[5] * 0.9, (H.y[6] - H.y[4]) / 2, H.h[5] * 0.85] },
    ...H.y.slice(2, -1).map((y, q): { c: V3; r: V3 } => {
      const k = q + 2;
      return { c: [0, y, H.z[k]], r: [H.w[k] * 0.85, Math.max(0.02, (H.y[k + 1] - H.y[k - 1]) * 0.3), H.h[k] * 0.85] };
    }),
  ];
}

/** An ear: round, a thick cup of brown fur, darker at its rim, cream inside. */
function earOf(s: Wall, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  return merge(
    tube(curve([0, 0, -0.03], [0, 0.03, L * 0.5], [0, -0.02, L], 4), [w * 0.8, w, w * 0.95, w * 0.66, 0.02], w * 0.42, n, (ring) => (ring >= 3 ? 'coatDark' : 'coat'), { up: [0, 1, 0], seam: 'start' }),
    paint([disc([0, w * 0.44, L * 0.44], [0, 1, 0.08], w * 0.62, L * 0.34, 8, 'inner')]),
  );
}

/* ---- its brushes, cuffs and pauldrons ------------------------------------------------------------- */

/**
 * A spiral carved into a surface: a groove `w` wide winding `turns` times out from the middle to `R`, every corner on the
 * surface (`on` takes a point across it and along it from the middle to where that is on the surface and the way out there).
 */
function spiralOn(on: (a: number, b: number) => { p: V3; n: V3 }, R: number, turns: number, w: number, m: Mat): Disc {
  const N = Math.round(12 * turns), pts: Array<{ p: V3; n: V3 }> = [];
  for (let q = 0; q <= N; q++) {
    const f = q / N, a = f * turns * TAU, r = R * (0.12 + 0.88 * f);
    pts.push(on(Math.cos(a) * r, Math.sin(a) * r));
  }
  const edge = (q: number, k: number): V3 => {
    const t = unit(sub(pts[Math.min(N, q + 1)].p, pts[Math.max(0, q - 1)].p)), sd = unit(cross(pts[q].n, t));
    return add(add(pts[q].p, scale(pts[q].n, w * 0.3)), scale(sd, k * w * (0.6 + 0.4 * (q / N))));
  };
  const v = [...pts.map((_, q) => edge(q, 1)), ...pts.map((_, q) => edge(N - q, -1))];
  return { v: facingOut(v, pts[N >> 1].n) ? v : v.reverse(), m };
}

/**
 * A fan of straw: bristles bound together at `root` and spreading out along `dir` to `L` long, `r0` across and through at the
 * root and `r1` at the ends: a full core, ragged at its end, and over and under it tufts fanned out across it, each a flat
 * blade of straw with a darker line down it, so it reads as straw from above and from the side.
 */
function strawOf(root: V3, dir: V3, r0: [number, number], r1: [number, number], L: number, n: number, id: number, fine: boolean): Mesh {
  const d = unit(dir), pts = [0, 0.3, 0.65, 0.92].map((k) => add(root, scale(d, L * k)));
  const ws = [r0[0], lerp(r0[0], r1[0], 0.45), lerp(r0[0], r1[0], 0.8), r1[0] * 0.92].map((w) => w * 0.86);
  const hs = [r0[1], lerp(r0[1], r1[1], 0.55), lerp(r0[1], r1[1], 0.85), r1[1]].map((h) => h * 0.8);
  const sides = Math.max(10, n + 2);
  const t = tube(pts, ws, hs, sides, (ring, j) => (ring >= 3 ? 'hornDark' : j % 2 ? 'hornDark' : 'horn'), { up: [0, 0, 1] });
  // The core's end ragged: every other corner of the last ring a little further out along it.
  const last = (pts.length - 1) * sides;
  const v = t.v.map((p, i) => (i >= last ? add(p, scale(d, L * (i % 2 ? 0.06 : -0.03) * (0.6 + 0.8 * jitter(id + i)))) : p));
  const out: Mesh[] = [mesh(v, t.f)];
  const across = unit(cross(d, [0, 0, 1])), up = unit(cross(across, d));
  const tufts = fine ? 7 : 5;
  for (const layer of [1, -0.55]) {
    for (let q = 0; q < tufts; q++) {
      const g = q / (tufts - 1) - 0.5;
      const a = g * 2 * Math.atan2(r1[0] - r0[0], L) * 1.05;
      const dd = unit(add(scale(d, Math.cos(a)), scale(across, Math.sin(a))));
      const len = L * (1.02 + 0.08 * jitter(id + q * 3 + (layer > 0 ? 0 : 50)));
      const base = add(add(root, scale(up, layer * r0[1] * 0.5)), scale(across, g * r0[0] * 1.2));
      const tp: V3[] = [0, 0.35, 0.7, 1].map((k) => add(add(base, scale(dd, len * k)), scale(up, layer * r1[1] * 0.7 * k)));
      const tw = (r1[0] / tufts) * 1.5;
      out.push(blade(tp, [r0[0] * 0.3, tw * 0.75, tw, tw * 0.45], up, { mat: 'horn', rib: 'hornDark', fold: 0.12, thick: r1[1] * 0.06 }));
    }
  }
  return merge(...out);
}

/**
 * A wooden cuff round a forearm, from just past the wrist up its length: a band of wood with a lip at either end, `bands`
 * of them one over another; a spiral carved into each, on the outside toward the front; moss grown over its top.
 */
function cuffOf(s: Wall, L1: number, n: number, fine: boolean): Mesh {
  const [rc, cl] = s.brush.cuff, B = s.brush.bands;
  const z0 = -L1 - rc * 0.45, each = cl / B;
  const zs: number[] = [], rs: number[] = [];
  for (let b = 0; b < B; b++) {
    const a = z0 + b * each;
    zs.push(a, a + each * 0.12, a + each * 0.2, a + each * 0.8, a + each * 0.88, a + each);
    rs.push(rc * 1.02, rc * 1.1, rc, rc, rc * 1.1, rc * 1.02);
  }
  // Its top drawn in round the forearm going into it, and left open there: a sleeve, not a log with a lid.
  const arm = Math.max(s.thick * 0.66, rc * 0.62);
  zs.push(z0 + cl + rc * 0.25);
  rs.push(arm);
  const N = Math.max(10, n);
  const wood = tube(zs.map((z) => [0, 0, z] as V3), rs, rs, N, (ring) => {
    if (ring >= zs.length - 2) return 'wood';
    const r = ring % 6;
    return r === 0 || r === 4 ? 'bark' : 'wood';
  }, { seam: 'end', start: false });
  // Its open mouth at the wrist: the bound ends of the straw in it, not a wooden lid.
  const parts: Mesh[] = [wood, paint([disc([0, 0, z0 + rc * 0.05], [0, 0, -1], rc * 0.98, rc * 0.98, N, 'hornDark')])];
  // The spiral, on each band, facing out and toward the front.
  const face = 40 * DEG, discs: Disc[] = [];
  for (let b = 0; b < B; b++) {
    const zc = z0 + (b + 0.5) * each;
    const on = (a: number, h: number): { p: V3; n: V3 } => {
      const ph = face + a / rc, nn: V3 = [Math.cos(ph), Math.sin(ph), 0];
      return { p: [rc * nn[0], rc * nn[1], zc + h], n: nn };
    };
    discs.push(spiralOn(on, Math.min(each * 0.32, rc * 0.62), 1.6, Math.max(0.008, rc * 0.07), 'woodDark'));
  }
  parts.push(paint(discs));
  // Moss over its top and down its outside: clumps round the upper lip, mostly on the outside and the top of the arm.
  const top = z0 + cl;
  const clumps = fine ? 5 : 3;
  for (let q = 0; q < clumps; q++) {
    const ph = lerp(-0.6, 2.2, q / (clumps - 1)) + (jitter(q + 11) - 0.5) * 0.4;
    const nn: V3 = [Math.cos(ph), Math.sin(ph), 0.6];
    const c: V3 = [rc * Math.cos(ph) * 0.98, rc * Math.sin(ph) * 0.98, top - each * (0.1 + 0.25 * jitter(q + 3))];
    parts.push(mossClump(c, unit(nn), rc * (0.34 + 0.12 * jitter(q)), 900 + q, fine));
  }
  return merge(...parts);
}

/**
 * A clump of moss: a low lumpy mound, darker round its foot, ringed with short soft tufts lying out over what it grows on,
 * their tips the bright yellow-green of new growth.
 */
function mossClump(c: V3, n: V3, R: number, id: number, fine: boolean): Mesh {
  const z = unit(n);
  let x = cross([0, 1, 0], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const b = orbAlong([0, 0, 0], z, [R * 0.9, R * 0.8, R * 0.5], fine ? 7 : 5, 3, 'moss');
  const out: Mesh[] = [mesh(b.v.map((p, i) => add(c, scale(p, 0.86 + 0.28 * jitter(id * 31 + i))) as V3), b.f.map((f, q) => ({ ...f, m: jitter(id + q) < 0.35 ? 'leaf' : 'moss' })))];
  const tufts = fine ? 6 : 4;
  for (let q = 0; q < tufts; q++) {
    const a = (q / tufts) * TAU + jitter(id + q) * 0.8;
    const o = add(scale(x, Math.cos(a)), scale(y, Math.sin(a)));
    const d = unit(add(scale(z, 0.45), o));
    const root = add(c, scale(o, R * 0.45));
    const face = unit(sub(z, scale(d, dot(z, d))));
    out.push(leafMesh(root, d, face, R * (0.7 + 0.3 * jitter(id * 3 + q)), 0.3, 'moss', 'leaf'));
  }
  return merge(...out);
}

/**
 * A pauldron: a domed plate of carved wood over the outside of the shoulder, `r` across, its spiral carved in the middle, a
 * darker rim, moss along its top edge.
 */
function pauldronOf(r: number, ax0: V3, n: number, fine: boolean): Mesh {
  const ax = unit(ax0);
  const R: V3 = [r * 0.95, r * 0.82, r * 0.34];
  const dome = orbAlong([0, 0, 0], ax, R, Math.max(10, n), 5, 'wood');
  // Its frame: out along `ax`, across it `u` (forward) and `w` (up it).
  const u = unit(cross([0, 0, 1], ax)), w = cross(ax, u);
  const local = (p: V3): V3 => [dot(p, u), dot(p, w), dot(p, ax)];
  const faces = dome.f.map((f) => {
    const mid = scale(f.i.reduce((t, i) => add(t, dome.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const l = local(mid);
    const m: Mat = l[2] < 0 ? 'woodDark' : l[2] < R[2] * 0.35 ? 'bark' : 'wood';
    return { ...f, m };
  });
  const on = (a: number, b: number): { p: V3; n: V3 } => {
    const x = a / R[0], y = b / R[1], h = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    const p = add(add(scale(u, a), scale(w, b)), scale(ax, R[2] * h));
    const nn = unit(add(add(scale(u, x / R[0]), scale(w, y / R[1])), scale(ax, h / R[2])));
    return { p, n: nn };
  };
  const parts: Mesh[] = [mesh(dome.v, faces), paint([spiralOn(on, r * 0.5, 1.75, r * 0.06, 'woodDark')])];
  for (let q = 0; q < (fine ? 4 : 2); q++) {
    const b = R[1] * 0.78, a = lerp(-0.6, 0.6, q / Math.max(1, (fine ? 4 : 2) - 1)) * R[0];
    const at = on(a, b * Math.sqrt(Math.max(0.05, 1 - (a / R[0]) ** 2)));
    parts.push(mossClump(at.p, unit(add(at.n, w)), r * 0.2, 940 + q, fine));
  }
  return merge(...parts);
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A fore paw (the Wallkit's; the right, the left its mirror): a round dark paw and its small dark claws. */
function forePaw(s: Wall, n: number, k: number): Mesh {
  const r = s.paw, d = s.fore[2], C = s.claw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.62], [0, 1, 0], [r * 1.08, r * 0.7, r * 1.04], n, k, 'coatDark');
  const claws = Array.from({ length: C.n }, (_, q) => {
    const f = C.n > 1 ? q / (C.n - 1) - 0.5 : 0, L = C.len * (1 - 0.3 * Math.abs(f));
    const root: V3 = [f * r * 1.3, r * 0.8, -d + r * 0.5];
    const tip: V3 = [f * r * 1.5, r * 0.8 + L * 0.95, -d + 0.01];
    return tube(curve(root, [f * r * 1.45, root[1] + L * 0.6, -d + r * 0.45], tip, 2), [C.w * 0.8, C.w * 0.5, 0.006], [C.w, C.w * 0.6, 0.006], 5, 'claw', { seam: 'start' });
  });
  return merge(paw, ...claws);
}

/** Where a fore foot's working end touches the ground, in the foot's frame: the Wallkit's middle claw, the others' straw. */
const clawTip = (s: Wall): V3 => (s.brush.held ? [0, s.paw * 0.8 + s.claw.len * 0.95, -s.fore[2] + 0.02] : [0, s.brush.straw * 0.92, -s.fore[2] + 0.01]);

/** A fore foot of the bigger two (the right): no paw, the straw of its brush fanning out of the cuff forward and down to the ground. */
function brushFoot(s: Wall, n: number, fine: boolean): Mesh {
  const [rc] = s.brush.cuff, d = s.fore[2], L = s.brush.straw, F = s.brush.fan;
  const root: V3 = [0, -rc * 0.1, -rc * 0.05];
  const end: V3 = [0, L, -d + F * 0.42];
  // A dark binding round the straw where it comes out of the cuff.
  const bind = tube([add(root, [0, -rc * 0.1, 0]), add(root, [0, rc * 0.45, -rc * 0.12])], [rc * 0.9, rc * 0.96], [rc * 0.8, rc * 0.86], Math.max(8, n), 'stem');
  return merge(bind, strawOf(root, sub(end, root), [rc * 0.85, rc * 0.72], [F, F * 0.42], Math.hypot(end[1] - root[1], end[2] - root[2]), n, 77, fine));
}

/**
 * The Wallkit's brush, held in its fore paws: a broad wooden cuff gripped between them, its ends under each paw, held up off
 * the ground at the height of its wrists, and its straw fanning out ahead of it down to the stone. In the right fore foot's
 * frame, `x0` its middle and `ax` how far either way its cuff reaches.
 */
function heldBrush(s: Wall, x0: number, ax: number, n: number, fine: boolean): Mesh {
  const [rc, cl] = s.brush.cuff, d = s.fore[2], L = s.brush.straw, F = s.brush.fan;
  const y0 = -s.paw * 0.25, z = -d + s.paw * 0.95;
  const at = (k: number): V3 => [x0, y0 + cl * k, z - cl * k * 0.25];
  const cuff = tube([at(0), at(0.12), at(0.88), at(1)], [ax * 0.96, ax, ax, ax * 0.96], [rc * 0.9, rc, rc, rc * 0.9], Math.max(10, n), (ring) => (ring === 1 ? 'wood' : 'bark'));
  const band = tube([at(0.42), at(0.58)], ax * 1.04, rc * 1.08, Math.max(10, n), 'woodDark');
  const root = at(0.9);
  const end: V3 = [x0, y0 + cl + L, -d + F * 0.32];
  return merge(cuff, band, strawOf(root, sub(end, root), [ax * 0.86, rc * 0.8], [F, F * 0.32], Math.hypot(end[1] - root[1], end[2] - root[2]), n, 71, fine));
}

/** A hind paw: smaller, dark, with short dark claws. */
function hindPaw(s: Wall, n: number, k: number): Mesh {
  const r = s.hindPaw, d = s.hind[2], L = s.hindClaw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.62], [0, 1, 0], [r, r * 0.62, r * 1.1], n, k, 'coatDark');
  const claws = [-1, -0.33, 0.33, 1].map((f) => {
    const root: V3 = [f * r * 0.6, r * 0.95, -d + r * 0.42];
    const w = Math.max(0.02, L * 0.34);
    return tube(curve(root, [f * r * 0.7, root[1] + L * 0.6, root[2] + L * 0.05], [f * r * 0.8, root[1] + L, -d + 0.01], 2), [w * 0.7, w * 0.5, 0.006], [w, w * 0.7, 0.006], 5, 'claw', { seam: 'start' });
  });
  return merge(paw, ...claws);
}

/** A barrel's rings with its ends rounded, so the rump and the chest are domes rather than cut off flat. */
function domed(B: Rings): Rings {
  const out: Rings = { y: [], z: [], w: [], h: [] };
  const put = (y: number, z: number, w: number, h: number): void => { out.y.push(y); out.z.push(z); out.w.push(w); out.h.push(h); };
  const between = (a: number, b: number, f: number): void => {
    const g = f * f;
    put(lerp(B.y[a], B.y[b], f), lerp(B.z[a], B.z[b], f), lerp(B.w[a], B.w[b], g), lerp(B.h[a], B.h[b], g));
  };
  const last = B.y.length - 1;
  put(B.y[0], B.z[0], B.w[0], B.h[0]);
  between(1, 0, 0.6);
  for (let k = 1; k < last; k++) put(B.y[k], B.z[k], B.w[k], B.h[k]);
  between(last - 1, last, 0.6);
  put(B.y[last], B.z[last], B.w[last], B.h[last]);
  return out;
}

/** A blot painted on a body of rings, following its curve: `r` across along it and round it, ragged, in `m`. */
function blot(R: Rings, y: number, th: number, r: number, m: Mat, id: number, side = 1): Disc {
  const c = onRings(R, y, th), q = side > 0 ? c : left(c);
  const n = 9, v: V3[] = [];
  const wAt = Math.max(0.05, Math.hypot(c.p[0], c.p[2] - lerp(R.z[0], R.z[R.z.length - 1], 0.5)));
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU, k = r * (0.72 + 0.4 * jitter(id * 5 + j));
    const pt = onRings(R, y + Math.sin(a) * k, th + (Math.cos(a) * k * 0.6) / wAt);
    const pp = side > 0 ? pt : left(pt);
    v.push(add(pp.p, scale(pp.n, 0.012)));
  }
  return { v: facingOut(v, q.n) ? v : v.reverse(), m };
}

/** Cream patches of fur low on its flanks: behind the shoulder and over the haunch. */
function patches(s: Wall): Mesh {
  const B = s.body, out: Disc[] = [];
  const spots: Array<[number, number, number]> = [[0.72, -0.3, 0.16], [0.24, -0.25, 0.16], [0.48, -0.55, 0.14]];
  for (const sd of [1, -1]) spots.forEach(([f, th, r], q) => out.push(blot(B, lerp(B.y[0], B.y[B.y.length - 1], f), th, r * s.len * 1.3, 'coatLight', 70 + q + (sd > 0 ? 0 : 9), sd)));
  return paint(out);
}

/** The barrel as one solid, a little inside its skin: its middle and its half-sizes. */
function barrelSolid(s: Wall): { c: V3; r: V3 } {
  const B = s.body, y0 = B.y[0], y1 = B.y[B.y.length - 1];
  return { c: [0, (y0 + y1) / 2, 0], r: [Math.max(...B.w) * 0.88, ((y1 - y0) / 2) * 0.88, Math.max(...B.h) * 0.88] };
}

/**
 * The legs: short and thick, rooted up inside the body, the fur darker toward the paw. The Wallkit's fore paws are paws, and
 * its brush is held between them; the bigger two's forearms go into wooden cuffs and end in brushes; the Stonepolish's
 * shoulders wear pauldrons.
 */
function legPieces(s: Wall, n: number, k: number, fine: boolean): Piece[] {
  const out: Piece[] = [];
  const spec = specOf(s), R = restOf(s, spec);
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick);
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    // The upper legs cream on the bigger two, as their chests and flanks are; brown on the kit.
    const upper = tube([0, 1, 2, 3, 4].map((q) => [0, 0, lerp(w * 0.5, -L[0], q / 4)] as V3), [w * 0.55, w * 1.0, w * 0.98, w * 0.84, w * 0.62], [w * 0.55, w * 0.96, w * 0.94, w * 0.8, w * 0.6], n, s.stage ? 'coatLight' : 'coat', { seam: 'end' });
    const lap = w * (fore ? 0.25 : 0.55);
    const brushed = fore && !s.brush.held;
    const end = brushed ? w * 0.6 : Math.min(w * 0.62, L[2] * (fore ? 1.05 : 0.85));
    const lower = tube([0, 1, 2, 3].map((q) => [0, 0.02 * (q / 3), lerp(lap, -L[1], q / 3)] as V3), [w * 0.5, w * 0.58, lerp(w * 0.56, end, 0.5), end], [w * 0.5, w * 0.58, lerp(w * 0.56, end, 0.5), end], n, (ring) => (ring >= 1 && !brushed ? 'coatDark' : 'coat'), { seam: 'both' });
    const foot = fore ? (brushed ? brushFoot(s, n, fine) : forePaw(s, n, k)) : hindPaw(s, n, k);
    const hide = [barrelSolid(s)];
    // A hind leg's haunch: a round bulge of muscle over the top of the thigh.
    const thigh = fore ? upper : merge(upper, orbAlong([-side * w * 0.04, -w * 0.04, -L[0] * 0.18], [0, 0, 1], [w * 1.1, w * 1.0, w * 1.0], n, k, s.stage ? 'coatLight' : 'coat'));
    const hideF = fore ? hide : undefined, hideIn = fore ? 'trunk' : undefined;
    out.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, under: 'body', convex: fore },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: 'body', front, convex: fore, hide: hideF, hideIn },
      { key: `${key}2`, mesh: side < 0 ? mirror(foot) : foot, bone: `${key}2`, bias: 0.03, after: brushed ? ['body', `${key}1`] : 'body', front, hide: hideF, hideIn },
    );
    if (brushed) {
      const cuff = cuffOf(s, L[1], n, fine);
      out.push({ key: `${key}c`, mesh: side < 0 ? mirror(cuff) : cuff, bone: `${key}1`, bias: 0.04, after: ['body', `${key}1`, `${key}2`], front, hide, hideIn: 'trunk' });
    }
    // A plume on the outside of each shoulder, curling up and back over the mantle's edge.
    if (fore && s.plumes.shoulder) {
      const P = s.plumes.shoulder;
      const pl = plumeOf([w * 0.72, -w * 0.05, w * 0.1], [0.6, -0.5, 0.75], [0.1, -0.55, -0.15], [1, 0.35, 0.1], P, P * 0.22, 4, 30, fine);
      out.push({ key: `${key}f`, mesh: side < 0 ? mirror(pl) : pl, bone: `${key}0`, bias: 0.08, after: ['body', `${key}0`], front });
    }
    // A pauldron over the top of each shoulder, on the body above the fore leg, below the mantle's edge.
    if (fore && s.pauldron) {
      const B = s.body, q = onRings(B, lerp(B.y[4], B.y[5], 0.55), 0.62);
      const p = moved(pauldronOf(s.pauldron * w * 0.8, add(q.n, [0, 0.15, 0.25]), n, fine), add(q.p, scale(q.n, w * 0.06)));
      out.push({ key: `${key}p`, mesh: side < 0 ? mirror(p) : p, bone: 'trunk', bias: 0.2, after: ['body', 'leaves'], front });
    }
  }
  // The Wallkit's brush, held between its fore paws: carried on its right paw, both paws on it as it scrubs.
  if (s.brush.held) {
    out.push({ key: 'brush', mesh: heldBrush(s, -R.ankle[1][0], R.ankle[1][0] - s.paw * 0.35, n, fine), bone: 'fr2', bias: 0.05, after: ['body', 'fr2', 'fl2'], front: [0, 1, 0] });
  }
  return out;
}
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/**
 * Its tail: the Wallkit's a big fluffy cream brush of a tail, swept back and up off its rump and curled forward over its back;
 * the Bristleward's a shorter bushy one; the Stonepolish's long and brown, leaves hanging along it.
 */
function tailOf(s: Wall, n: number): Mesh {
  const T = s.tail, L = T.len, w = T.w, c = T.curl;
  const straight: V3[] = [[0, 0.04, 0], [0, -0.22 * L, 0.02], [0, -0.44 * L, 0.02], [0, -0.64 * L, 0], [0, -0.82 * L, -0.03], [0, -0.95 * L, -0.06], [0, -L, -0.08]];
  const curled: V3[] = [[0, 0.04, 0], [0, -0.26 * L, 0.12 * L], [0, -0.42 * L, 0.38 * L], [0, -0.42 * L, 0.66 * L], [0, -0.28 * L, 0.88 * L], [0, -0.1 * L, 0.96 * L], [0, 0.02 * L, 0.92 * L]];
  const pts = straight.map((p, q) => mixV(p, curled[q], c));
  const ws = [0.5, 0.92, 1.18, 1.2, 1.02, 0.7, 0.12].map((f) => f * w);
  const N = Math.max(14, n), brown = s.stage === 2;
  const t = tube(pts, ws, ws, N, (ring, j) => (brown ? (ring >= 5 ? 'coatDark' : 'coat') : ring === 0 ? 'coat' : ring === 1 && j % 2 ? 'coat' : j % 3 === 0 ? 'belly' : ring >= 5 ? 'mark' : 'coatLight'));
  // Fluffed: every other corner round each ring pushed out, so its outline is tufted.
  const v = t.v.map((p, i) => {
    const ring = Math.floor(i / N), j = i % N;
    if (ring === 0 || ring >= pts.length - 1 || brown) return p;
    return add(pts[ring], scale(sub(p, pts[ring]), j % 2 ? 1.08 : 0.94));
  });
  const parts: Mesh[] = [mesh(v, t.f)];
  // A fluffy tail feathered all along with long soft locks lying toward its tip, either side and over the top.
  if (!brown) {
    for (let k = 2; k < pts.length - 1; k += 2) {
      const d = unit(sub(pts[k + 1], pts[k - 1])), up0 = unit(cross([1, 0, 0], d));
      for (const [ox, oz, id] of [[1, 0.2, 1], [-1, 0.2, 2], [0, 1, 3]] as Array<[number, number, number]>) {
        const o = unit(add(scale([1, 0, 0], ox), scale(up0, oz)));
        const root = add(pts[k], scale(o, ws[k] * 0.55));
        const face = unit(cross(d, cross(o, d)));
        parts.push(plumeOf(root, add(d, scale(o, 0.22)), scale(o, 0.12), face, ws[k] * 1.25, ws[k] * 0.85, 2, k * 10 + id, true, ['coatLight', 'belly']));
      }
    }
  }
  for (let q = 0; q < T.leaves; q++) {
    const f = (q + 1) / (T.leaves + 1), at = pts[Math.min(pts.length - 2, Math.round(f * (pts.length - 1)))];
    const sd = q % 2 ? -1 : 1, dir = unit([sd * 0.7, -0.6, -0.5]);
    parts.push(leafMesh(add(at, [sd * w * 0.5, 0, w * 0.5]), dir, unit(add(cross(dir, [1, 0, 0]), [0, 0, 0.5])), s.mantle.len * 0.9, 0.3, 'leaf', 'moss'));
  }
  return merge(...parts);
}

/** A stage's pieces: a body on four legs with its own head, ears and paws, its mantle, blossom and plumes, its brushes and its tail. */
function wallBuild(s: Wall, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6), fine = lod > 0;
  const B = s.body, skull = headSolids(s)[0], M = s.mantle;
  const R = domed(B);
  // Under the mantle, the top of its back dark green, so no fur shows between the leaves; its fur under that, cream on its belly.
  const under = Math.sin(Math.PI / 2 - M.spread * 0.85);
  const nb = cut(lod, 10, 14);
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, nb,
    (ring, j) => {
      const up = Math.sin(((j + 1) / nb) * TAU), y = R.y[Math.min(ring, R.y.length - 1)];
      if (ring > 1 && ring < R.y.length - 2 && up < -0.55) return 'belly';
      return up > under && y < M.from + 0.1 * s.len && y > M.to - 0.15 * s.len ? 'leafDark' : 'coat';
    });
  // Its underside tucked in toward the belly, so seen from behind it is a dome on its legs rather than a box.
  const body = mesh(barrel.v.map((p, i) => {
    const q = Math.min(R.y.length - 1, Math.floor(i / nb)), t = clamp((R.z[q] - p[2]) / R.h[q]);
    return [p[0] * (1 - 0.3 * t * t), p[1], p[2] + R.h[q] * 0.08 * t * t] as V3;
  }), barrel.f);
  // A cream bib on the chest under the chin, the cream of its face carried down.
  const bib = orbAlong([0, B.y[5] + 0.02, B.z[5] - B.h[5] * 0.3], [0, 1, -0.5], [B.w[5] * 0.66, B.h[5] * 0.52, B.h[5] * 0.4], n, k, 'belly');
  const solid = barrelSolid(s);
  const extras: Piece[] = [];
  const leaves = [...mantleOf(s), ...blossomsOf(s)];
  const G = stirOf(leaves);
  extras.push({ key: 'leaves', mesh: G.mesh, bone: 'trunk', bias: 0.16, after: ['body'], hide: [solid], bent: stirred(s, G, true) });
  const plumes = bodyPlumes(s, fine);
  if (plumes.v.length) extras.push({ key: 'plumes', mesh: plumes, bone: 'trunk', bias: 0.12, after: ['body'], hide: [solid] });
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.85, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -40,
    tail: [tailOf(s, n)],
    fore: { upper: [0, -s.fore[0], s.thick, s.thick], lower: [0, -s.fore[1], s.thick, s.thick], foot: forePaw(s, n, k) },
    hind: { upper: [0, -s.hind[0], s.thick, s.thick], lower: [0, -s.hind[1], s.thick, s.thick], foot: hindPaw(s, n, k) },
    breath: 0.035,
    extras,
  }).filter((pc) => !/^(fl|fr|hl|hr)[012]$/.test(pc.key));
  pieces.push(...legPieces(s, n, k, fine));
  const mane = headPlumes(s, fine);
  if (mane.v.length) pieces.push({ key: 'mane', mesh: mane, bone: 'head', bias: 0.05, after: ['head'], hide: headSolids(s) });
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(body, bib, patches(s)) };
    // The top of its neck under the mantle's front, its throat cream.
    if (pc.key === 'neck') {
      const nw = s.neck.w, nh = s.neck.w * 0.85, nl = s.neck.len;
      return { ...pc, mesh: tube([[0, 0, -0.3], [0, 0, nl * 0.5], [0, 0.05, nl]], nw, nh, n, (_r, j) => (Math.sin(((j + 1) / n) * TAU) < -0.15 ? 'coat' : 'belly'), { seam: 'both' }) };
    }
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

/** Moss knocked off stone: a bright green and a dull one, and grey grit with it; a leaf's green; the pale dust off dry stone. */
const MOSS_RGB: RGB = [150, 182, 66];
const MOSS_DARK_RGB: RGB = [96, 128, 52];
const GRIT_RGB: RGB = [176, 168, 154];
const LEAF_RGB: RGB = [132, 176, 82];
const DUST_RGB: RGB = [226, 216, 196];
const css = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Tunnelclaw's: less than in proportion on the small one, so they still read. */
const bigness = (s: Wall): number => 0.25 + 0.75 * (s.len / 2.1);

/** A clod of earth: a rounded blob, a lighter face toward the light and a dark rim, drawn whole; it goes by shrinking. */
function lump(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB): void {
  if (r <= 0.02) return;
  g.beginPath();
  for (let q = 0; q < 6; q++) {
    const t = ang + (q / 6) * TAU, k = r * (0.8 + 0.25 * Math.sin(q * 2.3 + ang * 1.7));
    if (q) g.lineTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.86);
    else g.moveTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.86);
  }
  g.closePath();
  g.fillStyle = css(c);
  g.fill();
  g.lineWidth = Math.max(0.05, r * 0.22);
  g.strokeStyle = css(mix(c, [46, 30, 24], 0.55));
  g.stroke();
  g.beginPath();
  g.ellipse(x - r * 0.25, y - r * 0.28, r * 0.4, r * 0.24, -0.5, 0, TAU);
  g.fillStyle = css(mix(c, [255, 238, 214], 0.3));
  g.fill();
}

/** A leaf tumbling: a pointed green oval with a darker rib, turned `ang`. */
function leafBit(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number): void {
  if (len <= 0.03) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.42, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.42, -len / 2, 0);
  g.fillStyle = css(LEAF_RGB);
  g.fill();
  g.lineWidth = len * 0.08;
  g.strokeStyle = css(mix(LEAF_RGB, [30, 50, 26], 0.55));
  g.stroke();
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(len * 0.4, 0);
  g.stroke();
  g.restore();
}

/** A puff of dust: one cloud of four lobes run together under one ragged outline, paler on its upper side; it goes by shrinking. */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, k: number, id = 0): void {
  r *= 0.75;
  if (r <= 0.02) return;
  const [x, y] = onScreen(view, at);
  const c = mix(DUST_RGB, [250, 242, 228], 0.25 + 0.75 * clamp(k)), edge = mix(c, [150, 128, 108], 0.3);
  const lobes = [0, 1, 2, 3].map((q) => {
    const a = (q / 3) * TAU + jitter(id) * TAU, d = q ? r * 0.35 * (0.8 + 0.4 * jitter(id + q * 3)) : 0;
    return { cx: x + Math.cos(a) * d, cy: y + Math.sin(a) * d * 0.7, lr: r * 0.62 * (q ? 0.5 + 0.5 * jitter(id + q * 5 + 1) : 1), a };
  });
  const outline = (grow: number, k = 1, lift = 0): void => {
    g.beginPath();
    for (const L of lobes) {
      for (let q = 0; q < 7; q++) {
        const t = L.a + (q / 7) * TAU, rr = (L.lr * k + grow) * (0.86 + 0.16 * Math.sin(q * 2.3 + L.a * 1.7));
        const px = L.cx - L.lr * lift * 0.3 + Math.cos(t) * rr, py = L.cy - L.lr * lift + Math.sin(t) * rr * 0.9;
        if (q) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
    }
  };
  g.fillStyle = css(edge);
  outline(Math.max(0.6, r * 0.07));
  g.fill();
  g.fillStyle = css(c);
  outline(0);
  g.fill();
  g.fillStyle = css(mix(c, [255, 252, 244], 0.5));
  outline(0, 0.66, 0.5);
  g.fill();
}

/**
 * Claw streaks slashed through the air: three crescents, white over a warm glow, drawn in on `sweep` and gone by `k` by
 * thinning, from up and behind the paw to down and ahead of it.
 */
function streaks(g: CanvasRenderingContext2D, view: View, at: V3, fwd: V3, size: number, sweep: number, k: number, turn: number): void {
  if (k <= 0.01 || sweep <= 0) return;
  const [x, y] = onScreen(view, at), [fx0] = onScreen(view, add(at, fwd));
  const ahead = Math.abs(fx0 - x) > 0.15 ? Math.sign(fx0 - x) : Math.sign(turn || 1);
  const dx = ahead * 0.55 + turn * 0.25, dy = 1;
  const dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl, px = -uy, py = ux;
  const bend = Math.sign(ahead) || 1;
  g.save();
  for (const pass of [0, 1]) {
    for (let q = -1; q <= 1; q++) {
      const L = size * (q ? 0.8 : 1), off = q * size * 0.2, th = size * (q ? 0.05 : 0.065) * (pass ? 1 : 1.9) * k;
      const ax = x - ux * L * 0.55 + px * off, ay = y - uy * L * 0.55 + py * off;
      const bx = ax + ux * L * sweep, by = ay + uy * L * sweep;
      const mx = (ax + bx) / 2 + px * L * 0.16 * bend * sweep, my = (ay + by) / 2 + py * L * 0.16 * bend * sweep;
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo(mx + px * th * bend, my + py * th * bend, bx, by);
      g.quadraticCurveTo(mx - px * th * bend, my - py * th * bend, ax, ay);
      g.fillStyle = pass ? 'rgb(255,250,238)' : 'rgb(214,164,96)';
      g.fill();
    }
  }
  g.restore();
}

/** The body's frame at a blow, along the ground: its trunk, as it was posed when the blow landed. */
const at0 = (b: Bones): Bones[string] => b.trunk;

/**
 * The strike: where each blow lands, claw streaks in the air in front of the paw, clods of earth and a pebble or two knocked
 * up off the ground and a puff of dust; and for the Earthrend's slam, the ground cracked, a ring of dust going out over it, and
 * earth and leaves thrown up high, over its back so it is seen from behind. Each thing sorted in front of the body or behind it.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Wall, b: Bones, hits: Bones[], R: Rest, t: number, front: boolean): void {
  const big = bigness(s), hs = WALL_HITS[s.strike];
  const mid = b.body.t;
  hs.forEach((h, q) => {
    const since = (t - h) * ACT_SECS.strike;
    if (since < -0.05) return;
    const at = hits[q];
    const paws = s.strike === 0 ? ['fr2'] : s.strike === 1 ? [q ? 'fr2' : 'fl2'] : ['fl2', 'fr2'];
    for (const key of paws) {
      const tip = place(at[key], R.tip);
      const fwd = unit(sub(place(at.body, [0, 1, 0]), at.body.t));
      fwd[2] = 0;
      const away = dot(fwd, view.T) < -0.35;
      if (front && !away && s.strike < 2) {
        const sweep = ramp(since, -0.03, 0.035), k = 1 - ramp(since, 0.06, 0.2);
        streaks(g, view, add(tip, [0, 0, (s.strike ? 0.7 : 0.6) * big]), fwd, (s.strike ? 2.2 : 2.1) * big, sweep, k, key === 'fl2' ? -1 : 1);
      }
      if (since > 0 && since < 0.5) {
        const k = 1 - smooth((since - 0.25) / 0.25), count = 5 + 3 * s.strike;
        for (let c = 0; c < count; c++) {
          const id = c * 7 + q * 31 + (key === 'fl2' ? 13 : 0);
          const th = (c / count) * TAU + jitter(id) * 0.8;
          const v: V3 = [Math.cos(th) * (1.2 + 1.6 * jitter(id + 1)), 0.8 + Math.sin(th) * 1.6 + 1.2 * jitter(id + 2), 2.6 + 2.2 * jitter(id + 3)];
          if (dot(v, view.T) > 0) v[2] += 1.5 + s.strike;
          const p = thrown([tip[0], tip[1], 0.1], scale(v, 0.8 + 0.3 * s.strike), since, 9);
          if (p[2] <= 0.03 || nearSide(p, mid, view) !== front) continue;
          const [x, y] = onScreen(view, p);
          lump(g, x, y, (c % 4 === 3 ? 0.11 : 0.16 + 0.08 * jitter(id + 4)) * big * k, id, c % 4 === 3 ? GRIT_RGB : c % 2 ? MOSS_RGB : MOSS_DARK_RGB);
        }
        const dustAt: V3 = [tip[0], tip[1], 0.15 * big];
        if (nearSide(dustAt, mid, view) === front) {
          const grow = ramp(since, 0, 0.08), gone = 1 - ramp(since, 0.08, 0.28);
          puff(g, view, dustAt, (0.5 + 0.5 * grow) * big * gone * [0.45, 1, 1.6][s.strike], since * 3, q + 3);
        }
      }
    }
    // Dust bursting out from under it on both sides as the blow lands, past its flanks: seen from behind as well as in front.
    if (since > 0 && since < 0.42) {
      const k = [0.22, 0.6, 1][s.strike];
      for (const sd of [-1, 1]) {
        const at = place(at0(hits[q]), [sd * s.body.w[3] * 1.15, s.len * 0.3, 0]);
        const p: V3 = [at[0] + sd * big * 0.8 * k * ramp(since, 0, 0.3), at[1], (0.3 + 0.6 * ramp(since, 0, 0.3)) * big * k];
        if (nearSide(p, mid, view) === front) puff(g, view, p, big * k * (0.6 + 0.6 * ramp(since, 0, 0.12)) * (1 - ramp(since, 0.18, 0.4)), since * 3, sd + 5 + q);
      }
    }
    if (s.strike !== 2 || since < 0) return;
    // The slam: moss and leaves thrown up high off the blow.
    if (since < 0.6) {
      const k = 1 - smooth((since - 0.3) / 0.3);
      for (let c = 0; c < 14; c++) {
        const id = 200 + c;
        const th = (c / 14) * TAU + jitter(id) * 0.5;
        const sd = c % 2 ? 1 : -1, paw = place(at[sd > 0 ? 'fr2' : 'fl2'], R.tip);
        const v: V3 = [sd * (5 + 5 * jitter(id + 1)), Math.sin(th) * (2.5 + 2 * jitter(id + 2)), 7 + 4 * jitter(id + 3)];
        if (dot(v, view.T) > 0) v[2] += 2;
        const p = thrown([paw[0], paw[1], 0.15], v, since, 13);
        if (p[2] <= 0.03 || nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        if (c % 4 === 0) leafBit(g, x, y, 0.6 * big * k, id + since * 10);
        else lump(g, x, y, (0.2 + 0.1 * jitter(id + 4)) * big * k, id, c % 3 === 0 ? GRIT_RGB : c % 2 ? MOSS_RGB : MOSS_DARK_RGB);
      }
    }
  });
}

/** Moss coming off stone: a dull green, a bright one and a dark one. */
const MOSSES: readonly RGB[] = [[118, 150, 58], [168, 192, 72], [96, 124, 50]];

/**
 * Scrubbing: at the end of every stroke a spray of green moss flies up off the brush's end, ahead and out to the side, and is
 * gone before it comes down. Nothing is drawn on the ground: the stone it scrubs is the island's own.
 */
function scrubSpray(g: CanvasRenderingContext2D, view: View, s: Wall, b: Bones, ends: readonly V3[], a: Anim, t: number, front: boolean): void {
  const big = bigness(s), down = downOf(t, a.graze), mid = b.body.t;
  if (down < 0.03) return;
  wallScrubs(s.stage).forEach((h, k) => {
    const since = (t - h) * ACT_SECS.work;
    if (since < 0 || since > 0.4) return;
    const from = ends[k], sd = Math.sign(from[0]) || (k % 2 ? -1 : 1);
    for (let q = 0; q < 6 + 3 * s.stage; q++) {
      const id = q * 7 + k * 19;
      const v: V3 = [sd * (0.6 + 1.6 * jitter(id)) * big + (jitter(id + 4) - 0.5) * big, (1.2 + 1.8 * jitter(id + 1)) * big, (3 + 2 * jitter(id + 2)) * Math.sqrt(big)];
      const p = thrown([from[0], from[1], 0.12 * big], v, since, 9);
      // Only while it is in the air, well off the ground.
      if (p[2] < 0.1 * big || nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      bit(g, x, y, (0.07 + 0.05 * jitter(id + 3)) * big, id + since * 9, MOSSES[q % 3], 1 - ramp(since, 0.25, 0.4));
    }
  });
}

/**
 * Evolving: at the start a burst of earth and leaves out of its back, which covers the moment it changes into its new body;
 * then a swirl of leaves and crumbs of earth going round and up it as its moss and stones grow.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Wall, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]];
  const burst = ramp(t, 0, 0.02) * (1 - ramp(t, 0.12, 0.3));
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 28; q++) {
      const th = (q / 28) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * s.body.w[3] * 0.4, s.body.y[3] + Math.sin(th) * s.len * 0.3, s.body.h[3] * 0.8]);
      const v: V3 = [Math.cos(th) * (2.2 + 2.2 * jitter(q + 3)), Math.sin(th) * (2.2 + 2.2 * jitter(q + 5)), 3 + 3.5 * jitter(q + 7)];
      const p = thrown(from, v, since, 5);
      if (p[2] <= 0.03 || nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 3 === 0) leafBit(g, x, y, 0.9 * big * burst, q * 1.3 + since * 8);
      else lump(g, x, y, 0.3 * big * burst, q * 1.3 + since * 8, q % 3 === 1 ? MOSS_RGB : GRIT_RGB);
    }
  }
  const swirl = ramp(t, 0.08, 0.18) * (1 - ramp(t, 0.66, 0.86));
  if (swirl > 0) {
    const rx = s.body.w[3] * 1.35 + 0.3, ry = s.len * 0.75 + 0.3, top = s.body.h[3] * 2 + 1;
    for (let q = 0; q < 18; q++) {
      const rise = frac(t * 1.6 + jitter(q + 20));
      const ang = (q / 18) * TAU + t * 9;
      const p = place(b.trunk, [Math.cos(ang) * rx, Math.sin(ang) * ry, -s.body.h[3] * 0.6 + rise * top]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const k = swirl * Math.sin(rise * Math.PI);
      if (q % 2 === 0) leafBit(g, x, y, 0.6 * big * k, ang * 2 + q);
      else lump(g, x, y, 0.18 * big * k, ang * 2 + q, q % 3 ? MOSS_RGB : GRIT_RGB);
    }
  }
}

/**
 * The warm flash at the claws where each blow lands, drawn with the body rather than over all of it: in front of it when the
 * claws are on the viewer's side of it, and behind it, where the body covers it, when they are round the far side.
 */
function blowFlash(g: CanvasRenderingContext2D, view: View, s: Wall, b: Bones, R: Rest, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t;
  g.save();
  g.globalCompositeOperation = 'lighter';
  WALL_HITS[s.strike].forEach((h, q) => {
    const k = hump(t, h + 0.02, 0.1);
    if (k <= 0) return;
    const keys = s.strike === 2 ? ['fl2', 'fr2'] : s.strike === 1 ? [q ? 'fr2' : 'fl2'] : ['fr2'];
    for (const key of keys) {
      const p = place(b[key], R.tip);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p), r = (0.8 + 0.4 * s.strike) * big, al = 0.35 * k;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,222,170,${al})`);
      grad.addColorStop(0.45, `rgba(255,222,170,${al * 0.35})`);
      grad.addColorStop(1, 'rgba(255,222,170,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  g.restore();
}

/** Light over the whole of it as it evolves: a green-gold glow as it begins, and over its back at the turn. */
function wallGlow(s: Wall, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 0.6]), r: s.body.y[6] - s.body.y[0], c: [210, 230, 150], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 1.4]), r: s.len * 0.9 + 0.5, c: [226, 236, 170], a: k });
  return out;
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, scrubs and evolves. */
function wallKind(s: Wall): Kind {
  const bones = wallBones(s);
  const spec = specOf(s), R = restOf(s, spec);
  const atHits = (a: Anim): Bones[] => WALL_HITS[s.strike].map((t) => bones({ ...a, act: { kind: 'strike', t } }));
  /**
   * Where each stroke's brush end is as it turns back and the moss flies, along the ground: the same every go, so worked out
   * once rather than posed again every frame.
   */
  let ends: V3[] | undefined;
  const endsOf = (): V3[] => {
    if (!ends) {
      const a0: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
      const strokes = strokesOf(s);
      ends = wallScrubs(s.stage).map((h, k) => {
        const b = bones({ ...a0, act: { kind: 'work', t: h } });
        if (s.brush.held) return place(b.fr2, [-R.ankle[1][0], s.brush.cuff[1] + s.brush.straw * 0.8, -s.fore[2] + 0.05]);
        return place(b[strokes[k].paw ? 'fr2' : 'fl2'], R.tip);
      });
    }
    return ends;
  };
  return {
    bones,
    build: (lod) => wallBuild(s, lod),
    // The variant's coat for its fur, its markings for the cream of its face, belly and plumes; the dark of its mask from its
    // fur; green leaves, white blossom, straw and wood on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, [120, 88, 60], 0.12);
      const cream = mix(mark, [250, 240, 218], 0.2);
      const dark = mix(fur, [44, 30, 26], 0.6);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [50, 36, 30], 0.4),
        coatLight: mix(cream, [230, 200, 156], 0.35),
        mark: cream,
        spot: dark,
        muzzle: mix(cream, [255, 250, 240], 0.3),
        belly: mix(cream, [232, 214, 182], 0.3),
        lid: mix(dark, [24, 16, 14], 0.5),
        nose: [58, 40, 34],
        pad: [30, 22, 20],
        inner: mix(cream, [214, 190, 160], 0.35),
        eye: [40, 22, 14],
        bloom: [232, 150, 40],
        glint: [255, 253, 246],
        claw: [64, 46, 38],
        horn: [234, 204, 128],
        hornDark: [184, 144, 78],
        wood: [196, 156, 104],
        woodDark: [116, 84, 58],
        bark: [160, 120, 80],
        stem: [120, 92, 58],
        moss: [172, 194, 58],
        leaf: [86, 116, 38],
        leafDark: [50, 76, 30],
        petal: [252, 250, 244],
      }, 30);
    },
    shadow: [s.len * 0.85 + 0.3, s.body.w[4] * 1.1],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are leaf green and blossom white.
    motes: [[150, 190, 80], [250, 246, 232]],
    glow: (b, a) => wallGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      const front = !under;
      if (!act) return;
      if (act.kind === 'strike') {
        strikeBurst(g, view, s, b, atHits(a), R, act.t, front);
        blowFlash(g, view, s, b, R, act.t, front);
      }
      else if (act.kind === 'work') scrubSpray(g, view, s, b, endsOf(), a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const WALLKIT = wallKind(WALLKIT_LOOK);
export const BRISTLEWARD = wallKind(BRISTLEWARD_LOOK);
export const STONEPOLISH = wallKind(STONEPOLISH_LOOK);
