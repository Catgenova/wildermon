import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, lifted, merge, mix, orbAlong, paint,
  pastel, quadBones, quadPose, scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind,
  type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The petal line: the Budscarab, a small beetle of a beast on four legs, its
 * back layered with cream shell plates with pink and green leaf-petals
 * sprouting between them, two pink leafy feelers swept back off its head, a
 * small pointed snout and a big dark eye; which grows into the Blossomhorn,
 * bigger and hunched, armoured in overlapping cream plates edged in leaves,
 * long pink feathery leaf-horns swept back, a mane of pink and green leaves
 * with a white blossom in it, and big hooked dark fore-claws; and then the
 * Florantler, large and heavy, its back crowded with cream plates, pink and
 * green leaf-blades and white blossoms, huge branching pink-and-peach
 * antlers swept up and back, a long snout and heavy fore-claws. The species
 * is still `grubba` underneath, as saves and the database know it: the
 * worker that digs out stumps.
 *
 * Built the way the badger line is (`./wild-badger`): one set of functions
 * from a description of the stage (`Petal`), every foot given a point on the
 * ground to be at and its leg bent to reach it, the knee always the same way
 * round, so a planted foot stays where it was put. It walks four beats, its
 * shell rolling onto each fore foot. At its task it digs out a stump: its
 * snout nudged at the stump's foot, its fore claws in turn hooked over the
 * stump and raked down and back through the earth at its roots, dirt and bark
 * flung back; then its snout and horns driven in under it, and the whole of
 * it heaved up and back, levering the stump up as its roots tear out of the
 * ground; and a shake of the head.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }
type HeadRings = Rings & { pitch: number };

interface Petal {
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
  /** The fore claws: how many, how long, how thick at the root; and the hind claws' length. */
  claw: { n: number; len: number; w: number };
  hindClaw: number;
  neck: { at: V3; len: number; w: number; lean: number };
  head: HeadRings;
  /** How far up round the head its jaw comes, as the sine of the angle from its side, and its colour: peach or olive green. */
  jaw: number;
  jawMat: Mat;
  /** The peach tip of its snout, how big. */
  nose: number;
  /** The eye: how far along the head, how far up round it (radians from the side), its size, how tall, and how far its brow is down. */
  eye: { y: number; up: number; size: number; tall: number; lid: number };
  /**
   * Its horns, each side: where they root on the head (a share along its back, and up round it), how long the longest is and
   * how broad (a half-width), how far out and back they sweep, how many leafy fronds each has, and whether they branch off a
   * beam of antler.
   */
  horn: { at: [number, number]; len: number; w: number; out: number; back: number; fronds: number; antler: boolean };
  /** The cream shell plates down its back, in rows from the shoulders to the rump; how big, how thick, how far the back edge stands up. */
  plates: { from: number; to: number; rows: number; per: number; spread: number; a: number; b: number; t: number; lift: number };
  /** Leaf-petals between the plates: how many, how long, from how far forward to how far back. */
  leaves: { n: number; len: number; from: number; to: number };
  /** Leaves round its neck, a mane: how many (nought for none). */
  mane: number;
  /** White blossoms on its back and its head: where each is on the back (along it, a share rump to chest; round it), and how big. */
  blossoms: ReadonlyArray<readonly [number, number, number]>;
  /** A blossom on its brow between the horns, how big; nought for none. */
  crown: number;
  /** Shell plates on its forearms and its thighs. */
  armour: boolean;
  tail: { len: number; w: number; lift: number; leaves: number };
  /**
   * How it goes: how far its body drops at each footfall (units), a walk's and a run's; how much of a stride a foot is down;
   * how far a leg swings (degrees); how high a foot is lifted; how far the shell rolls and the head nods and swings; and how
   * much what is on its back stirs.
   */
  gait: { bob: [number, number]; duty: [number, number]; swing: [number, number]; step: number; roll: number; nod: number; sway: number; jiggle: number };
  /** Its strike: a pounce and swipe, a rake of both fore claws and a toss of the horns, or reared up and slammed down. */
  strike: 0 | 1 | 2;
  /** Rakes of its fore claws to a go at its task, the two paws in turn. */
  digs: number;
  /** Its go at its task, in time (`Work`). */
  work: Work;
  size: number;
}

/** A Budscarab: small and round on four legs, cream shell plates with pink and green leaf-petals between, two pink leafy feelers, a small pointed snout. */
const BUDSCARAB_LOOK: Petal = {
  stage: 0,
  body: { y: [-0.74, -0.62, -0.34, 0, 0.32, 0.52, 0.62], z: [0.0, 0.03, 0.06, 0.07, 0.06, 0.03, 0.0], w: [0.26, 0.46, 0.56, 0.58, 0.54, 0.44, 0.22], h: [0.16, 0.29, 0.37, 0.39, 0.37, 0.29, 0.15] },
  len: 0.94,
  fore: [0.2, 0.19, 0.06], hind: [0.23, 0.22, 0.06], thick: 0.1, hip: 0.62, hindThick: 1.12,
  stand: { fore: [6, 44], hind: [26, -60] },
  paw: 0.08, hindPaw: 0.075,
  claw: { n: 3, len: 0.1, w: 0.028 }, hindClaw: 0.06,
  neck: { at: [0, 0.58, 0.18], len: 0.14, w: 0.24, lean: 66 },
  head: {
    // A round skull, big for its body, and a short pointed snout turned down out of the front of it like a beak.
    y: [-0.2, -0.17, -0.085, 0.015, 0.11, 0.19, 0.26, 0.31, 0.35], z: [0.035, 0.045, 0.045, 0.028, 0.0, -0.028, -0.055, -0.075, -0.09],
    w: [0.07, 0.2, 0.24, 0.24, 0.195, 0.13, 0.085, 0.05, 0.026], h: [0.07, 0.2, 0.235, 0.225, 0.17, 0.115, 0.077, 0.05, 0.026], pitch: -12,
  },
  jaw: -0.35,
  jawMat: 'membrane',
  nose: 0.028,
  eye: { y: 0.0, up: 0.36, size: 0.1, tall: 1.12, lid: 0 },
  horn: { at: [0.45, 1.0], len: 1.0, w: 0.3, out: 0.95, back: 0.85, fronds: 1, antler: false },
  plates: { from: 0.22, to: -0.46, rows: 3, per: 2, spread: 1.08, a: 0.4, b: 0.4, t: 0.07, lift: 0.08 },
  leaves: { n: 13, len: 0.5, from: 0.32, to: -0.56 },
  mane: 0,
  blossoms: [],
  crown: 0,
  armour: false,
  tail: { len: 0.14, w: 0.08, lift: 20, leaves: 2 },
  gait: { bob: [0.05, 0.06], duty: [0.58, 0.44], swing: [36, 40], step: 0.5, roll: 8, nod: 4, sway: 6, jiggle: 0.5 },
  strike: 0,
  digs: 3,
  work: { nose: 0.12, dig: 0.52, lever: 0.62, heave: 0.78 },
  size: 4.3,
};

/** A Blossomhorn: bigger and hunched, overlapping cream plates edged in leaves, long pink leaf-horns swept back, a leafy mane with a blossom, big hooked fore-claws. */
const BLOSSOMHORN_LOOK: Petal = {
  stage: 1,
  body: { y: [-1.16, -1.0, -0.56, 0, 0.52, 0.9, 1.04], z: [-0.1, -0.02, 0.12, 0.22, 0.24, 0.14, 0.04], w: [0.4, 0.72, 0.88, 0.92, 0.88, 0.7, 0.36], h: [0.26, 0.5, 0.68, 0.78, 0.76, 0.6, 0.3] },
  len: 1.86,
  fore: [0.36, 0.32, 0.12], hind: [0.28, 0.25, 0.1], thick: 0.32, hip: 0.68, hindThick: 0.8,
  stand: { fore: [10, 50], hind: [24, -62] },
  paw: 0.2, hindPaw: 0.16,
  claw: { n: 3, len: 0.52, w: 0.1 }, hindClaw: 0.1,
  neck: { at: [0, 0.94, 0.2], len: 0.24, w: 0.5, lean: 112 },
  head: {
    y: [-0.344, -0.289, -0.151, 0.028, 0.206, 0.358, 0.482, 0.578, 0.647], z: [0.096, 0.11, 0.103, 0.069, 0.028, -0.007, -0.034, -0.055, -0.069],
    w: [0.123, 0.354, 0.417, 0.385, 0.3, 0.208, 0.139, 0.085, 0.046], h: [0.123, 0.339, 0.385, 0.347, 0.254, 0.169, 0.115, 0.077, 0.043], pitch: -24,
  },
  jaw: 0.22,
  jawMat: 'moss',
  nose: 0.045,
  eye: { y: 0.035, up: 0.52, size: 0.078, tall: 1.0, lid: 0.25 },
  horn: { at: [0.6, 1.0], len: 1.65, w: 0.3, out: 0.75, back: 1.2, fronds: 2, antler: false },
  plates: { from: 0.8, to: -0.86, rows: 4, per: 3, spread: 1.12, a: 0.46, b: 0.46, t: 0.09, lift: 0.08 },
  leaves: { n: 24, len: 0.85, from: 0.82, to: -0.96 },
  mane: 7,
  blossoms: [],
  crown: 0.2,
  armour: true,
  tail: { len: 0.46, w: 0.17, lift: -8, leaves: 3 },
  gait: { bob: [0.08, 0.1], duty: [0.6, 0.5], swing: [34, 38], step: 0.42, roll: 8, nod: 3, sway: 5, jiggle: 0.45 },
  strike: 1,
  digs: 3,
  work: { nose: 0.12, dig: 0.52, lever: 0.62, heave: 0.78 },
  size: 4.6,
};

/** A Florantler: large and heavy, a back crowded with plates, leaf-blades and white blossoms, huge branching pink-and-peach antlers, a long snout, heavy fore-claws. */
const FLORANTLER_LOOK: Petal = {
  stage: 2,
  body: { y: [-2.8, -2.5, -1.55, 0, 1.36, 2.18, 2.52], z: [-0.4, -0.2, 0.2, 0.5, 0.6, 0.4, 0.1], w: [0.86, 1.5, 1.92, 2.0, 1.92, 1.6, 0.8], h: [0.42, 0.8, 1.2, 1.5, 1.56, 1.16, 0.5] },
  len: 4.7,
  fore: [0.98, 0.86, 0.34], hind: [0.78, 0.66, 0.32], thick: 1.32, hip: 0.66, hindThick: 0.72,
  stand: { fore: [10, 50], hind: [24, -62] },
  paw: 0.66, hindPaw: 0.48,
  claw: { n: 3, len: 1.75, w: 0.38 }, hindClaw: 0.3,
  neck: { at: [0, 2.2, 0.5], len: 0.6, w: 1.4, lean: 108 },
  head: {
    // A long snout: the skull drawn out to a point, its tip peach.
    y: [-0.846, -0.705, -0.296, 0.254, 0.818, 1.311, 1.735, 2.059, 2.27], z: [0.353, 0.409, 0.366, 0.225, 0.071, -0.028, -0.092, -0.127, -0.141],
    w: [0.406, 1.183, 1.331, 1.135, 0.827, 0.568, 0.381, 0.236, 0.122], h: [0.406, 1.103, 1.183, 0.957, 0.649, 0.438, 0.284, 0.187, 0.101], pitch: -30,
  },
  jaw: 0.42,
  jawMat: 'moss',
  nose: 0.14,
  eye: { y: 0.26, up: 0.6, size: 0.16, tall: 0.95, lid: 0.38 },
  horn: { at: [0.55, 1.1], len: 3.7, w: 1.25, out: 0.28, back: 0.7, fronds: 3, antler: true },
  plates: { from: 1.9, to: -2.2, rows: 5, per: 4, spread: 1.18, a: 0.98, b: 0.98, t: 0.17, lift: 0.12 },
  leaves: { n: 36, len: 2.3, from: 2.0, to: -2.4 },
  mane: 9,
  blossoms: [[0.62, 1.2, 0.55], [0.34, 1.75, 0.5], [0.8, 0.75, 0.42], [0.18, 1.0, 0.4]],
  crown: 0.42,
  armour: true,
  tail: { len: 1.4, w: 0.56, lift: -6, leaves: 4 },
  gait: { bob: [0.2, 0.24], duty: [0.64, 0.54], swing: [30, 34], step: 0.32, roll: 6, nod: 2, sway: 6, jiggle: 0.3 },
  strike: 2,
  digs: 2,
  work: { nose: 0.12, dig: 0.5, lever: 0.6, heave: 0.78 },
  size: 2.9,
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

/** When each stage's blows land, as shares of its strike: the Budscarab's swipe, the Blossomhorn's two rakes, the Florantler's slam. */
export const PETAL_HITS: ReadonlyArray<readonly number[]> = [[0.5], [0.45, 0.62], [0.58]];
/** Rakes of the fore claws to a go at its task, each stage's. */
export const PETAL_DIGS: readonly number[] = [BUDSCARAB_LOOK.digs, BLOSSOMHORN_LOOK.digs, FLORANTLER_LOOK.digs];
/** Each stage's go at its task, in time (`Work`). */
export const PETAL_WORK: readonly Work[] = [BUDSCARAB_LOOK.work, BLOSSOMHORN_LOOK.work, FLORANTLER_LOOK.work];
/**
 * A go at its task, digging out a stump, as shares of it: its snout nudged at the stump's foot until `nose`; its fore claws
 * hooked over the stump and raked down and back through the earth at its roots from then until `dig`, the rakes evenly
 * spread; its snout and horns driven in under the stump until `lever`; heaved up and back until `heave`, the roots tearing
 * out of the ground; and its head shaken and set down again by the end.
 */
export interface Work { nose: number; dig: number; lever: number; heave: number }
/** A rake of its claws, as shares of the rake: reached up and over the stump until `bite`, dragged down and back through the dirt until `fling`. */
export const RAKE_STROKE = { bite: 0.34, fling: 0.78 } as const;

/* ---- its legs, by where its feet go ---------------------------------------------------------- */

/** How far a knee folds for a fold of one: the poses here give a knee in degrees, through this. */
const FOLD = 60;
const SIDE = [-1, 1, -1, 1];

/** A stage's body on four legs (`QuadSpec`). */
const specOf = (s: Petal): QuadSpec => ({
  high: s.fore[0] + s.fore[1] + 0.5,
  fore: { at: [s.body.w[4] * s.hip, s.len * 0.5, -s.body.h[4] * 0.42], len: s.fore, rest: [s.stand.fore[0], s.stand.fore[1], 0], fold: [FOLD, FOLD], toe: [s.paw * 1.1, s.paw * 0.6] },
  hind: { at: [s.body.w[2] * s.hip * 1.04, -s.len * 0.5, -s.body.h[2] * 0.42], len: s.hind, rest: [s.stand.hind[0], s.stand.hind[1], 0], fold: [FOLD, FOLD], toe: [s.hindPaw * 1.1, s.hindPaw * 0.6] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.1, s.body.z[0] + s.body.h[1] * 0.4], links: 1, len: s.tail.len, lift: s.tail.lift, curl: 0, sway: 12 },
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
function restOf(s: Petal, spec: QuadSpec): Rest {
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
    // The underside of the head, from the jaw to the end of the snout: what would go into the ground first.
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
 * the body's middle is, how far it is carried forward, and how far the shell rolls and rocks over its legs.
 */
interface Plan { at: V3[]; foot: number[]; H: number; surge: number; roll: number; rock: number }

/** Where a fore paw's middle claw ends, in the foot's frame. */
const clawTip = (s: Petal): V3 => [0, s.paw * 0.8 + s.claw.len * 0.86, -s.fore[2] + 0.02];
/** The ankle that puts a fore paw's claw tip at `tip`, its foot pitched `e` past level. */
const ankleFor = (R: Rest, tip: V3, e: number): V3 => sub(tip, rotX(R.tip, e));
/** A claw tip at rest, on the ground ahead of its paw. */
const restTip = (R: Rest, i: number): V3 => add(R.ankle[i], R.tip);

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
 * a walk, the shell rolling onto each fore foot as it takes the weight; at a run, the diagonals together.
 */
function goingPlan(s: Petal, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
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
    // Each foot swung out a little as it comes forward, round the shell.
    const out = (i < 2 ? 0.08 : 0.12) * legLen * SIDE[i] * Math.sin(Math.PI * u);
    at.push([A[0] + out, y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)]);
    // Long hooked claws tipped up clear of the ground as a fore foot comes forward, so it goes on its knuckles.
    const big = s.claw.len > 0.3;
    foot.push((i < 2 ? (big ? 16 : -16) : big ? 10 : -14) * Math.sin(Math.PI * u) ** 2);
  }
  // The shell rolled onto whichever fore foot is down, and rocked fore and aft on the four beats.
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

/** A go at its task: how far its head is down at the stump (eased in and out of, unless it is already down). */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.9, 1)));

/** Which rake of its claws it is at, and how far through it; and the paw making it, the right first. */
function strokeOf(s: Petal, t: number): { k: number; w: number; paw: number } | null {
  const W = s.work;
  if (t < W.nose || t >= W.dig) return null;
  const x = ((t - W.nose) / (W.dig - W.nose)) * s.digs, k = Math.min(s.digs - 1, Math.floor(x));
  return { k, w: x - k, paw: k % 2 ? 0 : 1 };
}
/** When rake `k` of a go begins, as a share of the go. */
const strokeAt = (s: Petal, k: number): number => s.work.nose + ((s.work.dig - s.work.nose) * k) / s.digs;

/** Where the stump's foot is, along the ground: ahead of its fore paws' claws, between them, as far as a paw reaches. */
const stumpOf = (s: Petal, R: Rest): V3 => [0, R.ankle[0][1] + R.tip[1] + (s.fore[0] + s.fore[1]) * 0.3, 0];
/** How high on the stump a rake hooks over it. */
const hookHigh = (s: Petal): number => (s.fore[0] + s.fore[1]) * [0.95, 1.0, 1.1][s.stage];
/** How far a fore paw is pitched to rake, against a small one's: long claws are turned less, or the paw is lifted off the ground by them. */
const tilt = (s: Petal): number => clamp(0.13 / s.claw.len, 0.12, 1);

/**
 * The claw tip of a raking paw through a rake, and how its foot is pitched: lifted and reached forward up over the stump, hooked
 * into it and dragged down it and back through the earth at its roots to under its chest, and flicked back to where it stood.
 */
function rakePath(s: Petal, R: Rest, i: number, w: number): { tip: V3; e: number } {
  const { bite, fling } = RAKE_STROKE, home = restTip(R, i), stump = stumpOf(s, R), k = tilt(s);
  const L = s.fore[0] + s.fore[1];
  const big = s.stage === 2;
  const over: V3 = [home[0] * (big ? 1.2 : 0.7), stump[1] + L * (big ? 0.05 : 0.15), hookHigh(s)];
  const back: V3 = [home[0] * 0.8, home[1] - L * (big ? 0.1 : 0.18), 0.005];
  if (w < bite) {
    const u = w / bite;
    return { tip: arc(home, over, u, L * 0.2), e: k * (34 * Math.sin(Math.PI * u * 0.5) + 10 * smooth(u)) };
  }
  if (w < fling) {
    // Down the face of the stump to its foot, then back through the earth: the claws hooked, curled under.
    const u = (w - bite) / (fling - bite), foot: V3 = [over[0], stump[1] - L * 0.12, 0.005];
    const tip = u < 0.45 ? mixV(over, foot, smooth(u / 0.45)) : mixV(foot, back, smooth((u - 0.45) / 0.55));
    return { tip, e: k * (44 * (1 - smooth(u / 0.45)) - 18 - 10 * Math.sin(Math.PI * u)) };
  }
  const u = (w - fling) / (1 - fling);
  return { tip: arc(back, home, u, L * 0.12), e: k * (-18 * (1 - smooth(u)) + 14 * Math.sin(Math.PI * u)) };
}

/** How far its snout is driven under the stump, and how far it is heaving it up, through a go. */
function leverOf(s: Petal, t: number): { hook: number; heave: number } {
  const W = s.work;
  const hook = ramp(t, W.dig - 0.03, W.dig + 0.05) * (1 - ramp(t, W.heave + 0.02, W.heave + 0.12));
  const heave = ramp(t, W.lever, W.heave) * (1 - ramp(t, W.heave + 0.05, 0.96));
  return { hook, heave };
}

/** Where its snout is to be over the ground through a go at its task: at the stump's foot as it nudges, low over it as it rakes, under it as it hooks in, high as it heaves. */
function noseHeight(s: Petal, t: number, stand: number): number {
  const W = s.work;
  const low = Math.min(s.head.h[2] * 0.14, stand * 0.12), mid = stand * (s.stage === 2 ? 0.95 : 0.7);
  // Nudging at the foot of the stump, twice.
  const nudge = 1 - ramp(t, W.nose - 0.04, W.nose + 0.04);
  const dab = Math.abs(Math.sin((t / W.nose) * Math.PI * 2)) * 0.8;
  let z = lerp(mid, low * (1 + dab), nudge);
  const { hook, heave } = leverOf(s, t);
  z = lerp(z, 0.02, hook);
  return lerp(z, Math.max(stand * 0.75, s.head.h[2] * 0.9), heave);
}

/**
 * A go at its task, digging out a stump: head down, its snout nudged at the stump's foot; then its fore paws in turn reaching
 * up over the stump, hooking into it and raking it down and back through the earth at its roots, the shell rocking onto the
 * raking side and the head turned away from the paw so the claws are seen; its snout driven down under the stump and its
 * weight gathered; then the whole of it heaved up and back, chest up and head thrown high, levering the stump up as its roots
 * tear out; and a shake of its head as it settles.
 */
function workPlan(s: Petal, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim, t: number, down: number): Plan {
  const plan = stillPlan(R, p), W = s.work;
  plan.roll *= 1 - down;
  // The paws eased into their work at the start of a go, but not out of it: each rake ends where the paw stands.
  const paws = Math.max(a.graze, ramp(t, 0, 0.1));
  const st = strokeOf(s, t);
  const side = st ? (st.paw ? 1 : -1) : 0;
  const drag = st && st.w > RAKE_STROKE.bite && st.w < RAKE_STROKE.fling ? Math.sin(Math.PI * (st.w - RAKE_STROKE.bite) / (RAKE_STROKE.fling - RAKE_STROKE.bite)) : 0;
  const reach = st && st.w < RAKE_STROKE.bite ? Math.sin((Math.PI * st.w) / RAKE_STROKE.bite) : 0;
  // Crouched over the stump, hind legs braced, the shell rocking onto the raking side, rising into each reach and nodding into each drag.
  plan.H -= down * R.h * (0.06 + 0.03 * drag - 0.04 * reach);
  p.pitch -= down * (2 + 3 * drag - 5 * reach);
  plan.roll += down * 5 * side * (st ? Math.sin(Math.PI * st.w) : 0);
  plan.rock += down * 2 * drag;
  // Nudging: the snout pushed at the stump with a little swing of the neck.
  const nudge = 1 - ramp(t, W.nose - 0.05, W.nose + 0.02);
  p.neck[1] += down * 8 * Math.sin((t / W.nose) * TAU) * nudge;
  p.tail[0] += down * 8;
  p.tail[1] += down * (st ? 22 * Math.sin(TAU * st.w) * side : 0);
  if (st) {
    const { tip, e } = rakePath(s, R, st.paw, st.w);
    const i = st.paw;
    plan.at[i] = mixV(R.ankle[i], ankleFor(R, tip, e), paws);
    plan.foot[i] = e * paws;
  }
  // The head turned away from the raking paw through each rake, so its claws are seen beside the face.
  const aside = st ? Math.sin(Math.PI * st.w) ** 2 : 0;
  p.neck[1] += down * (s.stage === 2 ? 34 : 24) * side * aside;
  // Hooked in under the stump: crouched low, chest down, rump up; then heaved up and back, chest high and the body drawn back
  // over its hind legs, the fore feet kept planted, the tail thrown up.
  const { hook, heave } = leverOf(s, t);
  plan.H += R.h * (-0.1 * hook * (1 - heave) + 0.1 * heave);
  p.pitch += -4 * hook * (1 - heave) + 8 * heave;
  plan.surge -= s.len * 0.06 * heave;
  p.tail[0] += 20 * heave;
  // Straining against it at the top of the heave, a judder through the whole of it.
  const strain = hump(t, W.heave - 0.02, 0.06);
  plan.roll += 2.5 * strain * Math.sin(t * 160);
  // A shake of the head as it settles, the dirt shaken off its snout and horns.
  const shake = hump(t, (W.heave + 1) / 2 + 0.02, 0.07);
  p.head[2] += 16 * shake * Math.sin(t * TAU * 9);
  p.neck[1] += 5 * shake * Math.sin(t * TAU * 9 + 1);
  // Its snout brought to the height it is to be at, by bowing the neck and the head together.
  const stand = noseOver(spec, R, p, plan, 0);
  const want = Math.max(0.012, lerp(stand, noseHeight(s, t, stand), down));
  let lo = -0.8, hi = 1.2;
  for (let q = 0; q < 16; q++) {
    const mid = (lo + hi) / 2;
    if (noseOver(spec, R, p, plan, mid) > want) lo = mid;
    else hi = mid;
  }
  bow(p, (lo + hi) / 2);
  // Heaving, its snout tipped up under the stump rather than down, the horns going back with it.
  p.head[0] += 18 * heave;
  return plan;
}

/** The neck and the head bowed together toward the ground, `x` of the way. */
function bow(p: QuadPose, x: number): void {
  p.neck[0] += 70 * x;
  p.head[0] -= 34 * x;
}
/** How high its snout is over the ground, bowed `x` (`bow`). */
function noseOver(spec: QuadSpec, R: Rest, p: QuadPose, plan: Plan, x: number): number {
  const q: QuadPose = { ...p, neck: [p.neck[0], p.neck[1]], head: [p.head[0], p.head[1], p.head[2]] };
  bow(q, x);
  const b = quadBones(spec, q);
  return Math.min(...R.chin.map((c) => place(b.head, c)[2])) - b.body.t[2] + plan.H;
}

/* ---- the strike ------------------------------------------------------------------------------ */

/**
 * The Budscarab's pounce: it crouches, its rump up and wiggling, springs forward with all four feet off the ground, its right
 * claw thrown up, and comes down with that claw swiping down onto whatever it pounced on; then it hops back to where it was.
 */
function pouncePlan(s: Petal, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = PETAL_HITS[0][0];
  const L = s.fore[0] + s.fore[1], J = s.len * 0.5;
  const crouch = ramp(t, 0.02, 0.18) * (1 - ramp(t, 0.18, 0.3));
  const out = ramp(t, 0.2, 0.48) * (1 - ramp(t, 0.68, 0.88));
  plan.surge = J * out;
  const fly = hump(t, 0.35, 0.17), hop = hump(t, 0.78, 0.11);
  const land = hump(t, hit + 0.02, 0.07) + 0.6 * hump(t, 0.88, 0.05);
  plan.H += R.h * (-0.1 * crouch + 0.6 * fly + 0.3 * hop - 0.06 * land);
  // Reared up as it springs, its front high, so the claw thrown up is over its own head; down onto the blow.
  p.pitch += -7 * crouch + 22 * fly - 6 * hump(t, hit, 0.08);
  plan.roll += 7 * crouch * Math.sin(t * TAU * 6);
  p.tail[0] += 40 * crouch + 20 * fly;
  p.tail[1] += 40 * crouch * Math.sin(t * TAU * 7);
  p.neck[0] += 10 * crouch - 8 * fly;
  // Its head turned away from the swiping claw and its weight leant off it: the swipe is seen clear of its face.
  const swipe = ramp(t, 0.16, 0.34) * (1 - ramp(t, hit + 0.06, 0.8));
  p.neck[1] += 30 * swipe;
  p.head[2] -= 12 * swipe;
  plan.roll -= 9 * swipe;
  p.head[0] += 6 * crouch;
  const there = (i: number): V3 => [R.ankle[i][0], R.ankle[i][1] + J, R.ankle[i][2]];
  for (const i of [0, 2, 3]) {
    const A = R.ankle[i];
    const [t0, t1] = i === 0 ? [0.22, 0.47] : [0.25, 0.48];
    if (t > t0 && t < t1) plan.at[i] = arc(A, there(i), ramp(t, t0, t1), L * (i < 2 ? 0.7 : 0.45));
    else if (t >= t1 && t < 0.7) plan.at[i] = there(i);
    else if (t >= 0.7 && t < 0.87) plan.at[i] = arc(there(i), A, ramp(t, 0.7, 0.87), L * 0.35);
    plan.foot[i] = -18 * Math.sin(Math.PI * ramp(t, t0, t1)) - 12 * Math.sin(Math.PI * ramp(t, 0.7, 0.87));
  }
  // The right claw thrown up high ahead, and swiped down onto the ground in front: the blow.
  const A = R.ankle[1], strike: V3 = [A[0], A[1] + J + s.paw * 0.5, A[2]];
  const sh = add(rotX([spec.fore.at[0], spec.fore.at[1], spec.fore.at[2]], p.pitch), [0, plan.surge, plan.H]);
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
 * The Blossomhorn's rake: it gathers itself, rears its fore end up with both claws raised, and rakes them down onto the ground
 * in front one after the other, then lunges with its head down and tosses its horns up; then it settles back and puts its paws back.
 */
function rakePlan(s: Petal, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), [h1, h2] = PETAL_HITS[1];
  const L = s.fore[0] + s.fore[1];
  const gather = ramp(t, 0, 0.22) * (1 - ramp(t, 0.22, 0.4));
  const rear = ramp(t, 0.12, 0.36) * (1 - ramp(t, h2 - 0.1, h2 + 0.12));
  const lunge = ramp(t, 0.26, 0.5) * (1 - ramp(t, 0.68, 1));
  plan.surge = s.len * 0.12 * lunge;
  plan.H += R.h * (-0.12 * gather + 0.22 * rear);
  p.pitch += -4 * gather + 22 * rear - 3 * hump(t, h1, 0.07) - 3 * hump(t, h2, 0.07);
  // The head driven down after the second rake and tossed up: a sweep of the horns.
  const butt = hump(t, h2 + 0.05, 0.08), toss = hump(t, h2 + 0.16, 0.09);
  p.neck[0] += -10 * gather - 12 * rear + 24 * butt - 16 * toss;
  p.head[0] += 6 * rear - 18 * butt + 26 * toss;
  p.tail[0] += 30 * gather + 24 * rear;
  p.tail[1] += 30 * Math.sin(t * TAU * 3) * (gather + rear);
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

/** How long the Florantler's slam takes to come down, as a share of its strike: after it has reared and held a moment at the top. */
const SLAM_DROP = 0.16;
/** How far reared up the Florantler is through its strike: up, held at the top a moment, and dropped, fastest as it lands. */
function slamRear(t: number): number {
  const hit = PETAL_HITS[2][0], top = hit - SLAM_DROP;
  return ramp(t, 0.02, top - 0.05) * (1 - clamp((t - top) / (hit - top)) ** 2);
}

/**
 * The Florantler's slam: it rears up on its hind legs, both fore claws raised high and its antlers thrown back, and slams the
 * claws down onto the ground in front of it, its antlers swept down after them, the whole of it shaking as it lands; then it
 * steps its paws back one at a time.
 */
function slamPlan(s: Petal, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = PETAL_HITS[2][0];
  const L = s.fore[0] + s.fore[1];
  const top = hit - SLAM_DROP, rear = slamRear(t);
  const shake = t > hit ? Math.sin((t - hit) * 70) * (1 - ramp(t, hit, 0.9)) : 0;
  const land = hump(t, hit + 0.03, 0.08);
  plan.H += R.h * (0.2 * rear - 0.08 * land) + 0.02 * shake;
  p.pitch += 24 * rear - 3 * land;
  p.neck[0] += -18 * rear + 10 * land;
  p.head[0] += -10 * rear - 10 * land;
  p.tail[0] += -14 * rear + 30 * land;
  p.tail[1] += 10 * shake;
  plan.rock += 2.5 * shake;
  plan.roll += 2 * shake;
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

/** Evolving: hunched as the light gathers and its plates and leaves grow over its back, then drawn up tall at the turn, a shake of the head, and settled. */
function evolvePlan(R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p);
  const hunch = ramp(t, 0.06, 0.38) * (1 - ramp(t, 0.38, 0.54)), up = ramp(t, 0.44, 0.6) * (1 - ramp(t, 0.72, 0.94));
  plan.H += R.h * -0.08 * hunch;
  p.pitch += -3 * hunch + 3 * up;
  p.neck[0] += 18 * hunch - 14 * up;
  p.head[0] += -10 * hunch + 16 * up;
  p.head[2] += (14 - 4 * (R.h > 1 ? 2 : R.h > 0.6 ? 1 : 0)) * hump(t, 0.62, 0.1) * Math.sin(t * (R.h > 1 ? 50 : 70));
  p.tail[0] += 30 * up;
  plan.roll += 3 * hump(t, 0.62, 0.1) * Math.sin(t * 60);
  return plan;
}

/* ---- its bones ------------------------------------------------------------------------------- */

/** Where its snout ends, in the head's frame. */
const noseTip = (s: Petal): V3 => { const H = s.head, last = H.y.length - 1; return [0, H.y[last] + s.nose * 0.9, H.z[last] - H.h[last] * 0.3]; };

/** Its pose for what it is doing, over the one a body on four legs has (`quadPose`), and where its feet go. */
function planOf(s: Petal, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
  p.pitch += R.pitch;
  const act = a.act;
  if (act?.kind === 'strike') return s.strike === 0 ? pouncePlan(s, spec, R, p, act.t) : s.strike === 1 ? rakePlan(s, spec, R, p, act.t) : slamPlan(s, spec, R, p, act.t);
  if (act?.kind === 'work') return workPlan(s, spec, R, p, a, act.t, downOf(act.t, a.graze));
  if (act?.kind === 'evolve') return evolvePlan(R, p, act.t);
  if (a.graze > 0 && a.go <= 0) return workPlan(s, spec, R, p, a, 0, a.graze);
  if (a.go <= 0) return still(s, R, p, a);
  const going = goingPlan(s, spec, R, p, a), g = smooth(a.go);
  const G = s.gait, w = frac(a.u);
  // Going: the head low and nodding with the stride, swinging against the roll; the tail going.
  p.neck[0] += g * (6 + 4 * a.gait);
  p.neck[1] += g * G.sway * Math.sin(w * TAU - 0.6);
  p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.8) - g * 3;
  p.tail[1] += g * 18 * Math.sin(w * TAU + 1);
  // Its weight let down onto each fore foot as it lands: a squash of the shell that stirs what is on its back.
  p.squash += g * (s.stage === 2 ? 0.035 : 0.02) * (pulse(w - 0.78) + pulse(w - 0.28));
  return a.go >= 1 ? going : mixPlan(still(s, R, p, a), going, g);
}

/**
 * Standing about: its snout working at the air, down now and then for a sniff of the ground, and now and then its head lifted
 * and turned to look about, its horns swaying with it.
 */
function still(s: Petal, R: Rest, p: QuadPose, a: Anim): Plan {
  const plan = stillPlan(R, p);
  const sniff = beat(a.t, [6.2, 18.4], 1.6);
  const lift = beat(a.t, [2.4, 11.6, 21.2], 2.2);
  p.neck[0] += 12 * sniff - 16 * lift;
  p.head[0] += 2.5 * Math.sin(a.t * TAU * 2.5) * (1 - sniff) - 12 * sniff + 3 * sniff * Math.sin(a.t * 28) + 10 * lift;
  p.head[2] += 8 * lift * Math.sin(a.t * TAU * 0.5);
  p.neck[1] += 14 * lift * Math.sin(a.t * TAU * 0.25);
  return plan;
}

/** How low a leg's shin and knee come, the rings of their tubes as `legPieces` builds them: the lowest point of any. */
function shinLow(s: Petal, b: Bones, i: number): number {
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
 * the pose says and carried forward as far, and the shell rolled and rocked over its legs, so the feet stay where they are.
 */
function petalBones(s: Petal): (a: Anim) => Bones {
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
    const planted = a.act?.kind === 'strike' || a.act?.kind === 'evolve' || a.act?.kind === 'work';
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

/* ---- shell plates, leaves and blossoms ---------------------------------------------------------- */

/** One plate: rooted at `root` on the body, `n` the way out there and `back` the way it lies; `a` long and `b` wide (halves), `t` thick, its back edge up `lift`. */
interface Plate { root: V3; n: V3; back: V3; a: number; b: number; t: number; lift: number; id: number; mats?: readonly [Mat, Mat, Mat] }

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
 * A shell plate: a smooth rounded dome, an oval a little longer than it is wide, its rim going down into the body, its top
 * domed in two steps to a pale crown; lying back like a shingle, its back edge standing up off the one behind it. Cream, its
 * rim in shadow.
 */
function plateMesh(P: Plate): Mesh {
  const z = unit(P.n), y = unit(sub(P.back, scale(z, dot(P.back, z)))), x = cross(y, z);
  const S = 8, spin = jitter(P.id) * 0.5;
  const ring = (k: number, h: number): V3[] => Array.from({ length: S }, (_, j) => {
    const th = spin + (j / S) * TAU, jj = 0.94 + 0.1 * jitter(P.id * 7 + j);
    const lx = Math.cos(th) * P.b * k * jj, ly = Math.sin(th) * P.a * k * jj;
    // The back half pointed a little, a scale's shape rather than an egg's.
    const pt = ly > 0 ? 1 + 0.18 * (ly / (P.a * k)) ** 2 : 1;
    return add(P.root, add(add(scale(x, lx / pt), scale(y, ly * pt)), scale(z, h + P.lift * (ly / P.a))));
  });
  const base = ring(0.98, -P.t * 0.9), rim = ring(0.9, P.t), crown = ring(0.58, P.t * 1.45);
  const apex = add(P.root, add(scale(y, P.a * 0.1), scale(z, P.t * 1.65 + P.lift * 0.12)));
  const v: V3[] = [...base, ...rim, ...crown, apex];
  const f: Face[] = [], want: V3[] = [];
  const [edge, face, crownM] = P.mats ?? ['shellDark', 'shell', 'horn'];
  for (let j = 0; j < S; j++) {
    const j1 = (j + 1) % S;
    const out = unit(sub(scale(add(rim[j], rim[j1]), 0.5), add(P.root, scale(z, P.t))));
    f.push({ i: [j, j1, S + j1, S + j], m: edge, soft: true });
    want.push(out);
    f.push({ i: [S + j, S + j1, 2 * S + j1, 2 * S + j], m: face });
    want.push(unit(add(out, scale(z, 1.2))));
    f.push({ i: [2 * S + j, 2 * S + j1, 3 * S], m: j % 3 === 1 ? crownM : face });
    want.push(unit(add(scale(out, 0.4), z)));
  }
  return mesh(v, wound(v, f, want));
}

/**
 * The plates down its back in rows from the shoulders to the rump, set like bricks, each lying back toward the tail and out
 * down the flank, the biggest along the ridge of its back.
 */
function platesOf(s: Petal): Plate[] {
  const C = s.plates, out: Plate[] = [];
  for (let r = 0; r < C.rows; r++) {
    const f = r / Math.max(1, C.rows - 1);
    const y0 = lerp(C.from, C.to, f);
    const count = C.per + (r % 2 ? -1 : 0);
    for (let q = 0; q < count; q++) {
      const id = 100 + r * 17 + q;
      const g = count > 1 ? q / (count - 1) - 0.5 : 0, edge = Math.abs(g) * 2;
      const th = Math.PI / 2 + g * 2 * C.spread + (jitter(id) - 0.5) * 0.1;
      const at = onRings(s.body, y0 + (jitter(id + 3) - 0.5) * 0.06, th);
      const c = Math.cos(th), sn = Math.sin(th), wv = Math.sign(c) || 1;
      const round: V3 = unit([wv * sn, 0, -wv * c * 0.9]);
      const back = unit(add([0, -1, 0], scale(round, edge * 1.2)));
      const k = (1 - 0.18 * edge) * (0.92 + 0.16 * jitter(id + 5)) * (1 - 0.2 * Math.abs(f - 0.4));
      out.push({ root: add(at.p, scale(at.n, -0.02)), n: at.n, back, a: C.a * k, b: C.b * k, t: C.t, lift: C.lift * k, id });
    }
  }
  return out;
}

/**
 * A leaf: a broad blade from `root` out along `dir`, its face turned toward `face`, `L` long, its tip drooping; a shallow V
 * along its middle rib, with a face on either side and no edges between, which a leaf is too thin to show.
 */
function leafMesh(root: V3, dir: V3, face: V3, L: number, droop = 0.26, mat: Mat = 'leaf'): Mesh {
  const d = unit(dir), n0 = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n0));
  const pts = [root, add(add(root, scale(d, L * 0.4)), [0, 0, L * 0.05]), add(add(root, scale(d, L * 0.78)), [0, 0, -L * droop * 0.4]), add(add(root, scale(d, L)), [0, 0, -L * droop])];
  const ws = [L * 0.05, L * 0.3, L * 0.24, L * 0.02], th = L * 0.025;
  const v: V3[] = [];
  for (let k = 0; k < pts.length; k++) {
    const lift = scale(n0, ws[k] * 0.12);
    v.push(add(add(pts[k], scale(side, -ws[k])), lift), pts[k], add(add(pts[k], scale(side, ws[k])), lift));
  }
  for (let k = 0; k < pts.length; k++) for (let j = 0; j < 3; j++) v.push(sub(v[k * 3 + j], scale(n0, th)));
  const f: Face[] = [], want: V3[] = [], B = pts.length * 3;
  for (let k = 0; k < pts.length - 1; k++) {
    for (const j of [0, 1]) {
      f.push({ i: [k * 3 + j, k * 3 + j + 1, (k + 1) * 3 + j + 1, (k + 1) * 3 + j], m: k === 0 && mat === 'leaf' ? 'leafDark' : mat });
      want.push(n0);
      f.push({ i: [B + k * 3 + j, B + k * 3 + j + 1, B + (k + 1) * 3 + j + 1, B + (k + 1) * 3 + j], m: mat });
      want.push(scale(n0, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/**
 * A frond: a long leaf with a toothed edge, like a feather, along a run of points, its face turned toward `face`, `w` its
 * half-width at its widest; each step one notch of its edge, so the edge goes in and out the whole way. Its first share
 * `stalk` is a green stalk, the rest its own colour, the tip `tipMat`.
 */
function frondMesh(pts: readonly V3[], face: V3, w: number, mat: Mat, o: { stalk?: number; stalkMat?: Mat; tipMat?: Mat; th?: number } = {}): Mesh {
  const K = pts.length, th = o.th ?? w * 0.12, stalk = o.stalk ?? 0.12;
  const v: V3[] = [];
  const n0s: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const n0 = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n0));
    const f = k / (K - 1);
    // Narrow at the stalk, broadest a third of the way out, to a point; every other step a notch in.
    const env = f < stalk ? 0.12 : Math.sin(Math.PI * ((f - stalk) / (1 - stalk)) ** 0.75) ** 0.6;
    const ww = w * Math.max(0.04, env) * (k % 2 && f >= stalk && k < K - 1 ? 1 : 0.78);
    const lift = scale(n0, ww * 0.4);
    v.push(add(add(pts[k], scale(side, -ww)), lift), pts[k], add(add(pts[k], scale(side, ww)), lift));
    n0s.push(n0);
  }
  for (let k = 0; k < K; k++) for (let j = 0; j < 3; j++) v.push(sub(v[k * 3 + j], scale(n0s[k], th)));
  const f: Face[] = [], want: V3[] = [], B = K * 3;
  for (let k = 0; k < K - 1; k++) {
    const fr = (k + 0.5) / (K - 1);
    const m: Mat = fr < stalk ? o.stalkMat ?? 'moss' : fr > 0.8 && o.tipMat ? o.tipMat : mat;
    const n0 = n0s[k];
    for (const j of [0, 1]) {
      f.push({ i: [k * 3 + j, k * 3 + j + 1, (k + 1) * 3 + j + 1, (k + 1) * 3 + j], m });
      want.push(n0);
      f.push({ i: [B + k * 3 + j, B + k * 3 + j + 1, B + (k + 1) * 3 + j + 1, B + (k + 1) * 3 + j], m });
      want.push(scale(n0, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/** A curve of `n` steps out of `root` along `dir`, `L` long, curling toward `curl` by its tip. */
function sweep(root: V3, dir: V3, curl: V3, L: number, n: number): V3[] {
  const d = unit(dir), c = unit(curl);
  return curve(root, add(root, scale(d, L * 0.55)), add(root, add(scale(d, L * 0.72), scale(c, L * 0.42))), n);
}

/**
 * A white blossom: five round petals in one flat star, a little cupped, and a yellow middle; `r` across, facing out along `n`.
 * One solid shape, so a whole flower costs a few faces.
 */
function blossomMesh(c: V3, n: V3, r: number, id: number): Mesh {
  const z = unit(n);
  let x = cross([0, 1, 0.2], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x), spin = jitter(id) * TAU, P = 5, per = 3, th = r * 0.14;
  const top: V3[] = [];
  for (let q = 0; q < P * per; q++) {
    const petal = Math.floor(q / per), u = (q % per + 0.5) / per;
    const a = spin + ((petal + u) / P) * TAU;
    const k = r * (0.4 + 0.6 * Math.sin(Math.PI * u) ** 0.5);
    top.push(add(c, add(add(scale(x, Math.cos(a) * k), scale(y, Math.sin(a) * k)), scale(z, th + (k / r) * r * 0.12))));
  }
  const bot = top.map((p) => sub(p, scale(z, th * 1.6)));
  const N = top.length, v: V3[] = [...top, ...bot];
  const f: Face[] = [{ i: top.map((_, q) => q), m: 'spot' }, { i: bot.map((_, q) => N + q), m: 'spot' }];
  const want: V3[] = [z, scale(z, -1)];
  for (let q = 0; q < N; q++) {
    const q1 = (q + 1) % N;
    f.push({ i: [q, q1, N + q1, N + q], m: 'spot', soft: true });
    want.push(unit(sub(scale(add(top[q], top[q1]), 0.5), c)));
  }
  const heart = orbAlong(add(c, scale(z, th * 1.6 + r * 0.12)), z, [r * 0.24, r * 0.24, r * 0.14], 6, 3, 'bloom');
  return merge(mesh(v, wound(v, f, want)), heart);
}

/** What stirs on its back, as one mesh: each corner's root (what it sways on) and a phase of its own. */
interface Stir { mesh: Mesh; root: V3[]; ph: number[]; k: number[] }
function stirOf(parts: ReadonlyArray<{ mesh: Mesh; root: V3; id: number; k?: number }>): Stir {
  const root: V3[] = [], ph: number[] = [], k: number[] = [];
  for (const p of parts) for (let q = 0; q < p.mesh.v.length; q++) { root.push(p.root); ph.push(jitter(p.id + 31) * TAU); k.push(p.k ?? 1); }
  return { mesh: merge(...parts.map((p) => p.mesh)), root, ph, k };
}

type Bit = { mesh: Mesh; root: V3; id: number; k?: number };

/**
 * The leaf-petals on its back, out from under the plates and all sweeping back along it like feathers: along its ridge lying
 * back over it, along its flanks out and back, and lowest along its sides out, back and down; pink feathery petals green at
 * the root, and long green and olive leaves, the longest toward its rump. Ahead of them, round its neck, its mane.
 */
function leavesOf(s: Petal, ridge: boolean): Bit[] {
  const B = s.body, Lf = s.leaves, out: Bit[] = [];
  const pinkOf = (id: number): Mat => (jitter(id + 8) < 0.6 ? 'petal' : 'feather');
  // Rows round it, as how far down from the ridge (radians, shares of the plates' spread), and how each row's leaves lie: out, up.
  const rows: ReadonlyArray<readonly [number, number, number]> = [[0.3, 0.1, 0.42], [0.8, 0.3, 0.16], [1.28, 0.4, -0.5]];
  for (let q = 0; q < Lf.n; q++) {
    const id = 600 + q;
    // The ridge's row lies over the plates, the flanks' go under them.
    if ((q % 3 === 0) !== ridge) continue;
    const row = rows[q % 3], sd = Math.floor(q / 3) % 2 ? -1 : 1;
    const f = clamp((Math.floor(q / 3) + 0.5 * (q % 3) / 3) / Math.max(1, Math.ceil(Lf.n / 3) - 1));
    const y = lerp(Lf.from, Lf.to, f) + (jitter(id) - 0.5) * 0.06 * s.len;
    const th = Math.PI / 2 - sd * row[0] * s.plates.spread * (0.9 + 0.2 * jitter(id + 1));
    const at = onRings(B, y, th);
    const L = Lf.len * (0.75 + 0.5 * f) * (0.85 + 0.3 * jitter(id + 2)) * (q % 3 === 2 ? 1.15 : 1);
    const dir = unit([sd * (row[1] + 0.15 * jitter(id + 5)), -1, row[2] + 0.12 * jitter(id + 6)]);
    const root = add(at.p, scale(at.n, s.plates.t * 0.4));
    const up = unit(add(at.n, [0, 0, 0.8]));
    const face = unit(sub(up, scale(dir, dot(up, dir))));
    // Pink mostly along the top, green mostly low down its sides.
    const tint = jitter(id + 9), pink = [0.62, 0.45, 0.2][q % 3];
    if (tint < pink) out.push({ mesh: frondMesh(sweep(root, dir, [0, -0.4, -0.5], L, 6), face, L * 0.26, pinkOf(id), { stalk: 0.2, tipMat: 'feather' }), root, id, k: 1 });
    else {
      const g = (tint - pink) / (1 - pink);
      out.push({ mesh: leafMesh(root, dir, face, L * 0.85, 0.22, g < 0.45 ? 'leaf' : g < 0.75 ? 'moss' : 'leafDark'), root, id, k: 1 });
    }
  }
  // The mane: a ruff of leaves round the front of its shell behind its head, pink and green, sweeping back.
  for (let q = 0; q < (ridge ? s.mane : 0); q++) {
    const id = 800 + q;
    const g = s.mane > 1 ? q / (s.mane - 1) : 0.5;
    const th = lerp(0.2, Math.PI - 0.2, g);
    const sd = Math.cos(th) >= 0 ? 1 : -1;
    const at = onRings(B, B.y[5] - 0.02 * s.len, th);
    const L = Lf.len * (1.0 + 0.4 * Math.sin(Math.PI * g)) * (0.9 + 0.2 * jitter(id));
    const dir = unit([Math.cos(th) * 0.6, -0.8, Math.sin(th) * 0.7 + 0.25]);
    const root = add(at.p, scale(at.n, s.plates.t * 0.5));
    const fc: V3 = [sd * 0.6, 0.2, 1];
    const face = unit(sub(fc, scale(dir, dot(fc, dir))));
    out.push(q % 2
      ? { mesh: leafMesh(root, dir, face, L * 0.9, 0.22, q % 4 === 1 ? 'leaf' : 'moss'), root, id, k: 1.2 }
      : { mesh: frondMesh(sweep(root, dir, [0, -0.3, -0.5], L, 6), face, L * 0.2, pinkOf(id), { stalk: 0.15, tipMat: 'feather' }), root, id, k: 1.2 });
  }
  return out;
}

/** The white blossoms on its back, each on a plate, facing up and out. */
function blossomsOf(s: Petal): Bit[] {
  const B = s.body, sz = s.plates.a;
  return s.blossoms.map(([f, th, r], q) => {
    const id = 900 + q;
    const at = onRings(B, lerp(B.y[0], B.y[B.y.length - 1], f), th);
    const root = add(at.p, scale(at.n, s.plates.t * 2.2));
    return { mesh: blossomMesh(root, unit(add(at.n, [0, 0, 0.6])), r * sz * 1.4, id), root, id, k: 0.6 };
  });
}

/**
 * Its horns, each side, built on its head: the Budscarab's a pink leafy feeler on a thin brown stalk; the Blossomhorn's a long
 * feathery pink leaf-horn swept back in a crescent, a shorter one out beside it; the Florantler's a great branching antler, a
 * thick peach beam curving up and back with three tines standing up off it, each tine and the beam's end a pink frond. The
 * two of a pair are not alike: the right stands up and the left sweeps back and is rooted further back, so side on both are
 * seen, one behind the other.
 */
function hornsOf(s: Petal, side: number): Bit[] {
  const H = s.head, Hn = s.horn, out: Bit[] = [];
  const along = Hn.at[0] + (side > 0 ? 0.18 : -0.18);
  const q0 = onRings(H, lerp(H.y[0], H.y[3], along), Hn.at[1]), q = side > 0 ? q0 : left(q0);
  const root = sub(q.p, scale(q.n, 0.03 * Hn.len));
  const id0 = side > 0 ? 1000 : 1050;
  const upright = side > 0;
  if (!Hn.antler) {
    for (let f = 0; f < Hn.fronds; f++) {
      const k = f === 0 ? 1 : 0.5;
      const dir = unit([side * (Hn.out + 0.5 * f), (upright ? (s.stage ? 0.3 - Hn.back * 0.6 : 0.55) : -Hn.back * (s.stage ? 1.15 : 1.55)) - 0.2 * f, (upright ? 1 : 1.15) - 0.3 * f]);
      const L = Hn.len * k * (upright ? 1 : 0.95);
      const pts = sweep(root, dir, [side * 0.08, -1, -0.35], L, 12);
      out.push({ mesh: frondMesh(pts, unit([side, -0.45, 0.3]), Hn.w * k, 'petal', { stalk: s.stage ? 0.1 : 0.18, stalkMat: s.stage ? 'moss' : 'bark', tipMat: 'feather' }), root, id: id0 + f, k: f ? 0.8 : 0.6 });
    }
    return out;
  }
  // The beam: thick and peach at the root, curving up and then back, tapering.
  const back = upright ? 0.7 : 1.6, reach = upright ? 0.85 : 1;
  const B0 = root, B1 = add(root, scale([side * Hn.out, -0.35 * back, 0.9], Hn.len * 0.3 * reach)), B2 = add(root, scale([side * Hn.out * 1.5, -1.25 * back, upright ? 0.85 : 0.6], Hn.len * 0.6 * reach));
  const beamPts = curve(B0, B1, B2, 8), wb = beamPts.map((_, k) => Hn.w * lerp(0.42, 0.12, k / 8));
  const meshes: Mesh[] = [tube(beamPts, wb, wb, 6, (ring) => (ring < 2 ? 'horn' : 'membrane'), { seam: 'start' })];
  // The tines: off the top of the beam, standing up and a little forward, each a short peach spike going on into a pink frond.
  [[0.32, 0.5, 0.72], [0.56, 0.42, 0.85], [0.8, 0.34, 0.75]].forEach(([u, lean, k], q) => {
    const at = beamPts[Math.round(u * 8)];
    const dir = unit([side * 0.35, lean - 0.5 * back * u, 1]);
    const L = Hn.len * 0.56 * k * reach;
    const pts = sweep(at, dir, [side * 0.1, -1, 0], L, 8);
    const wt = pts.slice(0, 4).map((_, j) => Hn.w * lerp(0.13, 0.05, j / 3));
    meshes.push(tube(pts.slice(0, 4), wt, wt, 5, 'membrane', { seam: 'start' }));
    // Each turned a little differently, as the leaves of a spray are, so from any side some are seen flat.
    meshes.push(frondMesh(pts, unit([side, q % 2 ? 0.5 : -0.5, 0.4]), Hn.w * 1.1 * k, q ? 'petal' : 'membrane', { stalk: 0.25, stalkMat: 'membrane', tipMat: 'feather' }));
  });
  // The beam's end: the biggest frond, swept on back.
  const end = beamPts[8], endDir = unit(sub(beamPts[8], beamPts[6]));
  const endPts = sweep(end, unit(add(endDir, [0, -0.6, 0])), [side * 0.1, -1, -0.4], Hn.len * 0.6 * reach, 10);
  meshes.push(frondMesh([beamPts[5], beamPts[6], beamPts[7], ...endPts], unit([side, -0.5, 0.5]), Hn.w * 1.0, 'petal', { stalk: 0.2, stalkMat: 'membrane', tipMat: 'feather' }));
  out.push({ mesh: merge(...meshes), root, id: id0 + 10, k: 0.25 });
  return out;
}

/** What grows on its brow, between its horns: on the Blossomhorn a tall pink leaf with a white blossom at its foot, on the Florantler a blossom between two short fronds. */
function crownOf(s: Petal): Bit[] {
  if (!s.crown) return [];
  const H = s.head, at = onRings(H, lerp(H.y[1], H.y[3], 0.55), Math.PI / 2);
  const root = add(at.p, scale(at.n, -s.crown * 0.05));
  const out: Bit[] = [];
  const crest = s.stage === 1 ? [[0, 0.2, 1, 5.6, 1.7]] : [[0.5, -0.4, 1, 2.2, 0.8], [-0.5, -0.4, 1, 2.2, 0.8]];
  crest.forEach(([x, y, z, len, w], q) => {
    const dir = unit([x, y, z]);
    const pts = sweep(root, dir, [0, -1, 0], s.crown * len, 10);
    out.push({ mesh: frondMesh(pts, unit([x ? Math.sign(x) : 1, 0.6, 0.2]), s.crown * w * 0.5, 'petal', { stalk: 0.06, tipMat: 'feather' }), root, id: 940 + q, k: 0.4 });
  });
  const bud = add(at.p, add(scale(at.n, s.crown * 0.12), [0, s.crown * 0.5, 0]));
  out.push({ mesh: blossomMesh(bud, unit(add(at.n, [0, 0.9, 0.2])), s.crown, 950), root: bud, id: 950, k: 0.4 });
  return out;
}

/**
 * How what is on its back stirs this moment: how far each thing sways on its root and how fast, and how far grown it is. A
 * breeze through its leaves standing; stirred with each step as it goes, shaken as a blow lands, as it rakes and as it heaves;
 * and as it evolves, growing out of its back from under half their size.
 */
function stirring(s: Petal, a: Anim, leaf: boolean): { jig: number; at: number; grow: number } {
  let jig = leaf ? 0.05 * (1 - a.go) * (0.6 + 0.4 * cyc(a.t, 3)) : 0, at = a.t * TAU * 0.5, grow = 1;
  if (a.go > 0) {
    jig += smooth(a.go) * s.gait.jiggle * (0.05 + 0.03 * a.gait) * (leaf ? 2.2 : 0.6);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    for (const h of PETAL_HITS[s.strike]) jig += (leaf ? 0.16 : 0.05) * hump(act.t, h + 0.05, 0.16);
    at = act.t * 60;
  } else if (act?.kind === 'work') {
    const st = strokeOf(s, act.t);
    if (st) jig += downOf(act.t, a.graze) * (leaf ? 0.09 : 0.03) * hump(st.w, RAKE_STROKE.bite + 0.05, 0.2);
    jig += (leaf ? 0.14 : 0.04) * (hump(act.t, s.work.heave, 0.06) + hump(act.t, (s.work.heave + 1) / 2 + 0.02, 0.07));
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
function stirred(s: Petal, G: Stir, leaf: boolean): (v: readonly V3[], a: Anim) => V3[] {
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
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m };
}

/**
 * The eyes: big and dark, a dark rim and a glint or two, painted on the head itself so they follow its curve; on the
 * Blossomhorn and the Florantler under a cream brow come down over the top, which is what makes the face set. All of an eye
 * goes out of sight together behind the head.
 */
function eyesOf(s: Petal, shut: boolean): Mesh {
  const E = s.eye, H = s.head, meshes: Mesh[] = [];
  const c0 = onRings(H, E.y, E.up), rho = Math.max(0.05, Math.hypot(c0.p[0], c0.p[2] - lerp(H.z[2], H.z[4], 0.5)));
  for (const side of [1, -1]) {
    const q = side > 0 ? c0 : left(c0), out: Disc[] = [];
    const at = sub(q.p, scale(q.n, H.w[2] * 0.05));
    // Each shape painted onto the head itself, every corner on its curve: `cy` along the head and `cu` up it from the eye's
    // middle, `ry` by `ru` across, `lift` off the surface; `tilt` slants it.
    const patch = (cy: number, cu: number, ry: number, ru: number, sides: number, m: Mat, lift: number, o: { tilt?: number; lit?: boolean } = {}): Disc => {
      const v: V3[] = [];
      let nx = 0, ny = 0, nz = 0;
      for (let j = 0; j < sides; j++) {
        const a = ((j + 0.5) / sides) * TAU, dy = cy + Math.cos(a) * ry, du = cu + Math.sin(a) * ru + (o.tilt ?? 0) * side * Math.cos(a) * ry;
        const r0 = onRings(H, E.y + dy, E.up + du / rho), r1 = side > 0 ? r0 : left(r0);
        v.push(add(r1.p, scale(r1.n, lift)));
      }
      for (let c = 0; c < v.length; c++) {
        const a = v[c], b = v[(c + 1) % v.length];
        nx += (a[1] - b[1]) * (a[2] + b[2]);
        ny += (a[2] - b[2]) * (a[0] + b[0]);
        nz += (a[0] - b[0]) * (a[1] + b[1]);
      }
      return { v: nx * q.n[0] + ny * q.n[1] + nz * q.n[2] < 0 ? v.reverse() : v, m, at, lit: o.lit };
    };
    const r = E.size, tall = E.tall;
    const away: V3 = [-q.n[0], -q.n[1], 0.62 - q.n[2]];
    const done = (): void => { const m = paint(out); m.f.forEach((f) => { f.unless = away; }); meshes.push(m); };
    if (shut) {
      out.push(patch(0, -r * 0.1, r * 1.1, r * 0.28, 8, 'lid', 0.012));
      done();
      continue;
    }
    out.push(patch(0, 0, r * 1.18, r * tall * 1.18, 12, 'lid', 0.008));
    out.push(patch(0, 0, r, r * tall, 12, 'eye', 0.012));
    // A warm brown low in the eye, so the dark of it has a depth.
    out.push(patch(-r * 0.12, -r * tall * 0.36, r * 0.55, r * tall * 0.36, 8, 'bark', 0.016));
    if (E.lid) out.push(patch(0, r * tall * (1.38 - E.lid * 1.1), r * 1.4, r * tall * 0.72, 10, 'muzzle', 0.02, { tilt: -0.3 }));
    out.push(patch(r * 0.3, r * tall * (E.lid ? 0.1 : 0.36), r * 0.3, r * 0.3, 6, 'glint', 0.024, { lit: true }));
    out.push(patch(-r * 0.32, -r * tall * 0.42, r * 0.13, r * 0.13, 5, 'glint', 0.024, { lit: true }));
    done();
  }
  return merge(...meshes);
}

/**
 * The head, built as rings from the back of the skull to the end of the snout: cream, its jaw olive green under the line of
 * its mouth, its snout going to peach at the end, two small nostrils, and a mouth line back along the snout.
 */
function headOf(s: Petal, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1, len = H.y[last] - H.y[0];
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => {
    const up = Math.sin(((j + 1) / n) * TAU), f = (H.y[Math.min(ring, last)] - H.y[0]) / len;
    if (ring >= last - 1) return up < s.jaw ? 'nose' : 'membrane';
    if (up < s.jaw) return f < 0.2 ? 'coat' : s.jawMat;
    // The Florantler's long snout olive along its top, under the cream of its brow.
    if (s.stage === 2 && f > 0.45 && up > 0.55) return 'moss';
    return 'muzzle';
  });
  const tipC: V3 = [0, H.y[last] + s.nose * 0.1, H.z[last] - H.h[last] * 0.15];
  const nose = orbAlong(tipC, [0, 1, -0.2], [s.nose * 1.15, s.nose * 1.2, s.nose * 0.95], 6, 4, 'nose');
  const front: V3 = [0, tipC[1] + s.nose * 0.9, tipC[2] + s.nose * 0.1];
  const nostrils = paint([1, -1].map((sd) => disc(add(front, [sd * s.nose * 0.42, -s.nose * 0.15, s.nose * 0.18]), [sd * 0.4, 1, 0.5], s.nose * 0.16, s.nose * 0.24, 5, 'pad')));
  const parts: Array<Mesh | undefined | false> = [skull, nose, nostrils];
  // The mouth: back along the side of the snout from under its tip, turned up at its corner.
  parts.push(paint([1, -1].map((sd) => {
    const pts = Array.from({ length: 6 }, (_, q) => {
      const f = q / 5, y = lerp(H.y[last - 1], H.y[last] - len * 0.4, f);
      const th = Math.asin(clamp(s.jaw, -1, 1)) + 0.04 + 0.22 * f ** 2;
      const at = onRings(H, y, th);
      return sd > 0 ? at : left(at);
    });
    return { ...line(pts, H.w[2] * 0.025, 'lid'), at: sub(pts[3].p, scale(pts[3].n, 0.05)) };
  })));
  parts.push(eyesOf(s, shut));
  return merge(...parts);
}

/** Solids inside the head that hide what is round the far side of them: the skull and the snout. */
function headSolids(s: Petal): Array<{ c: V3; r: V3 }> {
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

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A fore paw (the right; the left is its mirror): a rounded olive paw and, out of the front of it, its dark claws, each a thick hooked talon arching forward and down to the ground. */
function forePaw(s: Petal, n: number, k: number): Mesh {
  const r = s.paw, d = s.fore[2], C = s.claw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.64], [0, 1, 0], [r * 1.0, r * 0.66, r * 1.04], n, k, 'coatDark');
  const claws = Array.from({ length: C.n }, (_, q) => {
    const f = C.n > 1 ? q / (C.n - 1) - 0.5 : 0, L = C.len * (1 - 0.25 * Math.abs(f));
    const root: V3 = [f * r * 1.2, r * 0.75, -d + r * 0.75];
    const tip: V3 = [f * r * 1.5, r * 0.75 + L * 0.86, -d + 0.02];
    const pts = curve(root, [f * r * 1.4, root[1] + L * 0.6, -d + r * 0.75 + L * 0.42], tip, 4);
    const cw = C.w;
    return tube(pts, [cw * 0.8, cw * 0.7, cw * 0.52, cw * 0.3, 0.01], [cw, cw * 0.92, cw * 0.66, cw * 0.36, 0.01], 5, (_ring, j) => (Math.sin(((j + 1) / 5) * TAU) > 0.5 ? 'hornDark' : 'claw'), { seam: 'start' });
  });
  return merge(paw, ...claws);
}

/** A hind paw: smaller, olive, with short dark claws. */
function hindPaw(s: Petal, n: number, k: number): Mesh {
  const r = s.hindPaw, d = s.hind[2], L = s.hindClaw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.62], [0, 1, 0], [r, r * 0.6, r * 1.12], n, k, 'coatDark');
  const claws = [-1, 0, 1].map((f) => {
    const root: V3 = [f * r * 0.55, r * 1.0, -d + r * 0.45];
    const w = Math.max(0.025, L * 0.34);
    return tube(curve(root, [f * r * 0.65, root[1] + L * 0.6, root[2] + L * 0.12], [f * r * 0.75, root[1] + L, -d + 0.02], 2), [w * 0.7, w * 0.5, 0.008], [w, w * 0.7, 0.008], 5, 'claw', { seam: 'start' });
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

/** The barrel as one solid, a little inside its skin: its middle and its half-sizes. */
function barrelSolid(s: Petal): { c: V3; r: V3 } {
  const B = s.body, y0 = B.y[0], y1 = B.y[B.y.length - 1];
  return { c: [0, (y0 + y1) / 2, 0], r: [Math.max(...B.w) * 0.88, ((y1 - y0) / 2) * 0.88, Math.max(...B.h) * 0.88] };
}

/** The legs: short and stout, rooted up inside the body, olive going darker toward the paw; on the bigger two a shell plate on each forearm and thigh, and a leaf out from under it. */
function legPieces(s: Petal, n: number, k: number): Piece[] {
  const out: Piece[] = [];
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick);
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const upper = tube([0, 1, 2, 3, 4].map((q) => [0, 0, lerp(w * 0.5, -L[0], q / 4)] as V3), [w * 0.55, w * 1.0, w * 0.98, w * 0.84, w * 0.62], [w * 0.55, w * 0.96, w * 0.94, w * 0.8, w * 0.6], n, 'coat', { seam: 'end' });
    const lap = w * (fore ? 0.25 : 0.55);
    const end = Math.min(w * 0.62, L[2] * (fore ? 1.05 : 0.85));
    const lower = tube([0, 1, 2, 3].map((q) => [0, 0.02 * (q / 3), lerp(lap, -L[1], q / 3)] as V3), [w * 0.5, w * 0.58, lerp(w * 0.56, end, 0.5), end], [w * 0.5, w * 0.58, lerp(w * 0.56, end, 0.5), end], n, (ring) => (ring >= 1 ? 'coatDark' : 'coat'), { seam: 'both' });
    const foot = fore ? forePaw(s, n, k) : hindPaw(s, n, k);
    const hide = [barrelSolid(s)];
    if (s.armour) {
      // A plate down the outside and front of each forearm, a leaf out from under its top; and one over each thigh.
      const id = (fore ? 40 : 50) + (side > 0 ? 0 : 5), r = w * 0.7;
      const plate = fore
        ? merge(
          plateMesh({ root: [side * w * 0.28, w * 0.34, -L[1] * 0.45], n: unit([side, 0.9, 0.1]), back: [0, 0, 1], a: L[1] * 0.6, b: r * 1.25, t: w * 0.16, lift: w * 0.16, id, mats: ['featherDark', 'membrane', 'feather'] }),
          plateMesh({ root: [side * w * 0.3, w * 0.36, -L[1] * 0.02], n: unit([side, 0.9, 0.3]), back: [0, -0.2, 1], a: L[1] * 0.4, b: r * 1.1, t: w * 0.14, lift: w * 0.12, id: id + 3, mats: ['shellDark', 'shell', 'horn'] }),
        )
        : plateMesh({ root: [side * w * 0.55, 0, -L[0] * 0.2], n: unit([side, -0.1, 0.5]), back: [0, -0.4, 1], a: r * 1.1, b: r * 1.0, t: w * 0.12, lift: w * 0.1, id });
      const leaf = fore
        ? leafMesh([side * w * 0.55, w * 0.2, -L[1] * 0.02], [side * 0.7, -0.3, 0.65], [side, 0.3, 0.2], w * 1.4, 0.2, 'petal')
        : leafMesh([side * w * 0.6, -w * 0.4, -L[0] * 0.05], [side * 0.6, -0.8, 0.2], [side, 0, 0.6], w * 1.6, 0.25, 'leaf');
      out.push({ key: `${key}s`, mesh: merge(plate, leaf), bone: fore ? `${key}1` : `${key}0`, bias: 0.025, after: fore ? [`${key}1`] : ['body', `${key}0`], front, hide, hideIn: 'trunk' });
    }
    // A hind leg's haunch: a round bulge of muscle over the top of the thigh.
    const thigh = fore ? upper : merge(upper, orbAlong([-side * w * 0.04, -w * 0.04, -L[0] * 0.18], [0, 0, 1], [w * 1.05, w * 0.95, w * 0.95], n, k, 'coat'));
    const hideF = fore ? hide : undefined, hideIn = fore ? 'trunk' : undefined;
    out.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, under: 'body', convex: fore },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: 'body', front, convex: fore, hide: hideF, hideIn },
      { key: `${key}2`, mesh: side < 0 ? mirror(foot) : foot, bone: `${key}2`, bias: 0.03, after: 'body', front, hide: hideF, hideIn },
    );
  }
  return out;
}
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/** A stage's pieces: a body on four legs with its own head, horns, paws and claws, and its plates, leaves and blossoms. */
function petalBuild(s: Petal, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6);
  const B = s.body, skull = headSolids(s)[0];
  const R = domed(B);
  // Under the plates, the top of its back leafy dark green as far down as the plates go; its hide under that, paler on its belly.
  const shell = Math.sin(Math.PI / 2 - s.plates.spread - 0.15);
  const nb = cut(lod, 10, 14);
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, nb,
    (ring, j) => {
      const up = Math.sin(((j + 1) / nb) * TAU);
      if (ring > 1 && ring < R.y.length - 2 && up < -0.55) return 'belly';
      return up > shell && ring > 0 && ring < R.y.length - 1 ? 'moss' : 'coat';
    });
  // Its underside tucked in toward the belly, so seen from behind it is a dome on its legs rather than a box.
  const body = mesh(barrel.v.map((p, i) => {
    const q = Math.min(R.y.length - 1, Math.floor(i / nb)), t = clamp((R.z[q] - p[2]) / R.h[q]);
    return [p[0] * (1 - 0.3 * t * t), p[1], p[2] + R.h[q] * 0.08 * t * t] as V3;
  }), barrel.f);
  // A pale chest under the chin.
  const bib = orbAlong([0, B.y[5] + 0.02, B.z[5] - B.h[5] * 0.34], [0, 1, -0.5], [B.w[5] * 0.6, B.h[5] * 0.5, B.h[5] * 0.36], n, k, 'belly');
  const solid = barrelSolid(s);
  const extras: Piece[] = [];
  // Leaves out from under the plates down its flanks; the plates over them; and over the plates, leaves along its ridge and its mane.
  const L = stirOf(leavesOf(s, false));
  extras.push({ key: 'leaves', mesh: L.mesh, bone: 'trunk', bias: 0.1, after: ['body'], hide: [solid], bent: stirred(s, L, true) });
  const G = stirOf(platesOf(s).map((P) => ({ mesh: plateMesh(P), root: P.root, id: P.id })));
  extras.push({ key: 'plates', mesh: G.mesh, bone: 'trunk', bias: 0.12, after: ['body', 'leaves'], bent: stirred(s, G, false) });
  const T = stirOf(leavesOf(s, true));
  extras.push({ key: 'tufts', mesh: T.mesh, bone: 'trunk', bias: 0.14, after: ['body', 'leaves', 'plates'], hide: [solid], bent: stirred(s, T, true) });
  const bl = blossomsOf(s);
  if (bl.length) {
    const F = stirOf(bl);
    extras.push({ key: 'blossoms', mesh: F.mesh, bone: 'trunk', bias: 0.16, after: ['body', 'plates', 'leaves', 'tufts'], hide: [solid], bent: stirred(s, F, true) });
  }
  const tailW = s.tail.w, tailL = s.tail.len;
  const tailLeaves: Mesh[] = [];
  for (let q = 0; q < s.tail.leaves; q++) {
    const root: V3 = [0, -tailL * 0.85, tailW * 0.2];
    const sd = q - (s.tail.leaves - 1) / 2;
    const dir = unit([sd * 0.8, -0.7, 0.6]);
    const face = unit(add(cross(dir, [1, 0, 0]), [0, 0, 0.5]));
    tailLeaves.push(q % 2 ? leafMesh(root, dir, face, tailL * 0.9 + tailW, 0.2, 'leaf') : frondMesh(sweep(root, dir, [0, -0.3, -0.5], tailL * 0.9 + tailW, 5), face, (tailL + tailW) * 0.16, 'petal', { stalk: 0.08 }));
  }
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.85, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    tail: [merge(
      tube(curve([0, 0.04, 0], [0, -tailL * 0.5, 0.03], [0, -tailL, -0.02], 2), [tailW, tailW * 0.8, tailW * 0.3], [tailW * 0.9, tailW * 0.72, tailW * 0.3], 5, 'coat', { seam: 'start' }),
      ...tailLeaves,
    )],
    fore: { upper: [0, -s.fore[0], s.thick, s.thick], lower: [0, -s.fore[1], s.thick, s.thick], foot: forePaw(s, n, k) },
    hind: { upper: [0, -s.hind[0], s.thick, s.thick], lower: [0, -s.hind[1], s.thick, s.thick], foot: hindPaw(s, n, k) },
    breath: 0.035,
    extras,
  }).filter((pc) => !/^(fl|fr|hl|hr)[012]$/.test(pc.key));
  pieces.push(...legPieces(s, n, k));
  const hide = headSolids(s);
  for (const side of [1, -1]) {
    const H = stirOf(hornsOf(s, side));
    pieces.push({ key: side > 0 ? 'horn1' : 'horn0', mesh: H.mesh, bone: 'head', bias: 0.21, after: ['head'], hide, hideIn: 'head', bent: stirred(s, H, true) });
  }
  const crown = crownOf(s);
  if (crown.length) {
    const C = stirOf(crown);
    pieces.push({ key: 'crown', mesh: C.mesh, bone: 'head', bias: 0.22, after: ['head', 'horn0', 'horn1'], bent: stirred(s, C, true) });
  }
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(body, bib) };
    // The top of its neck leafy dark green like its back, so no hide shows behind its head from in front; its throat its hide.
    if (pc.key === 'neck') {
      const nw = s.neck.w, nh = s.neck.w * 0.85, nl = s.neck.len;
      return { ...pc, mesh: tube([[0, 0, -0.3], [0, 0, nl * 0.5], [0, 0.05, nl]], nw, nh, n, (_r, j) => (Math.sin(((j + 1) / n) * TAU) < -0.15 ? 'leafDark' : 'coat'), { seam: 'both' }) };
    }
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

/** Dug earth: rich brown, darker, and grey pebbles in it; bark and the pale wood under it; roots; petals; the pale dust off dry ground. */
const SOIL_RGB: RGB = [150, 104, 70];
const LOAM_RGB: RGB = [104, 72, 52];
const PEBBLE_RGB: RGB = [168, 162, 150];
const BARK_RGB: RGB = [126, 92, 66];
const WOOD_RGB: RGB = [226, 196, 150];
const ROOT_RGB: RGB = [156, 116, 80];
const LEAF_RGB: RGB = [140, 172, 92];
const PINK_RGB: RGB = [242, 168, 184];
const DUST_RGB: RGB = [222, 200, 168];
const css = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Blossomhorn's: less than in proportion on the small one, so they still read. */
const bigness = (s: Petal): number => 0.25 + 0.75 * (s.len / 1.86);

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

/** A leaf or a petal tumbling: a pointed oval with a darker rib, turned `ang`. */
function leafBit(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB = LEAF_RGB): void {
  if (len <= 0.03) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.42, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.42, -len / 2, 0);
  g.fillStyle = css(c);
  g.fill();
  g.lineWidth = len * 0.08;
  g.strokeStyle = css(mix(c, [60, 40, 40], 0.55));
  g.stroke();
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(len * 0.4, 0);
  g.stroke();
  g.restore();
}

/** A splinter of bark: a thin sliver, dark bark on one face and pale wood on the other, turned `ang`. */
function splinter(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number): void {
  if (len <= 0.03) return;
  const c = Math.cos(ang), s = Math.sin(ang), w = len * 0.2;
  g.beginPath();
  g.moveTo(x - c * len * 0.5, y - s * len * 0.5);
  g.lineTo(x - s * w, y + c * w);
  g.lineTo(x + c * len * 0.5, y + s * len * 0.5);
  g.lineTo(x + s * w * 0.6, y - c * w * 0.6);
  g.closePath();
  g.fillStyle = css(WOOD_RGB);
  g.fill();
  g.lineWidth = Math.max(0.04, w * 0.45);
  g.strokeStyle = css(BARK_RGB);
  g.stroke();
}

/** A scatter of earth on the ground: a flattened blob and a few crumbs round it, shrinking away by `k`. */
function scatter(g: CanvasRenderingContext2D, view: View, at: V3, r: number, k: number, c: RGB, id: number): void {
  if (k <= 0.02) return;
  const [x, y] = onScreen(view, [at[0], at[1], 0.01]);
  const rr = r * k;
  g.fillStyle = css(mix(c, [60, 40, 30], 0.2));
  g.beginPath();
  g.ellipse(x, y, rr, rr * 0.45, 0, 0, TAU);
  g.fill();
  for (let q = 0; q < 4; q++) {
    const a = jitter(id + q) * TAU, d = rr * (1.25 + 0.4 * jitter(id + q + 7));
    g.beginPath();
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.45, rr * 0.16, 0, TAU);
    g.fill();
  }
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
 * Claw streaks slashed through the air: three crescents, white over a pink glow, drawn in on `sweep` and gone by `k` by
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
      g.fillStyle = pass ? 'rgb(255,250,244)' : 'rgb(236,150,170)';
      g.fill();
    }
  }
  g.restore();
}

/** The body's frame at a blow, along the ground: its trunk, as it was posed when the blow landed. */
const at0 = (b: Bones): Bones[string] => b.trunk;

/**
 * The strike: where each blow lands, claw streaks in the air in front of the paw, clods of earth and a petal or two knocked up
 * off the ground and a puff of dust; and for the Florantler's slam, the ground cracked, a ring of dust going out over it, and
 * earth, leaves and petals thrown up high, over its back so it is seen from behind. Each thing sorted in front of the body or
 * behind it.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Petal, b: Bones, hits: Bones[], R: Rest, t: number, front: boolean): void {
  const big = bigness(s), hs = PETAL_HITS[s.strike];
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
          if (nearSide(p, mid, view) !== front) continue;
          const [x, y] = onScreen(view, p);
          if (c % 4 === 1) leafBit(g, x, y, 0.42 * big * k, id + since * 9, PINK_RGB);
          else lump(g, x, y, (c % 4 === 3 ? 0.11 : 0.16 + 0.08 * jitter(id + 4)) * big * k, id, c % 4 === 3 ? PEBBLE_RGB : c % 2 ? SOIL_RGB : LOAM_RGB);
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
    // The slam: the ground cracked under the paws, a ring of dust going out over it, and earth, leaves and petals thrown up high.
    const ground = scale(add(place(at.fl2, R.tip), place(at.fr2, R.tip)), 0.5);
    ground[2] = 0.02;
    const [gx, gy] = onScreen(view, ground);
    if (!front) {
      const k = 1 - ramp(since, 0.3, 0.5);
      g.save();
      g.strokeStyle = 'rgb(84,58,40)';
      g.lineCap = 'round';
      for (let c = 0; c < 9; c++) {
        const th = (c / 9) * TAU + jitter(c + 50) * 0.6, L = (1.0 + 0.9 * jitter(c + 51)) * big * ramp(since, 0, 0.05);
        g.lineWidth = 0.14 * big * k;
        g.beginPath();
        g.moveTo(gx, gy);
        g.lineTo(gx + Math.cos(th) * L * 0.5 + 0.1 * big, gy + Math.sin(th) * L * 0.28);
        g.lineTo(gx + Math.cos(th) * L, gy + Math.sin(th) * L * 0.52);
        g.stroke();
      }
      g.restore();
      const out = ramp(since, 0, 0.32), rx = big * (2 + 5 * out);
      g.lineWidth = 0.18 * big * (1 - out);
      g.strokeStyle = css(DUST_RGB);
      g.beginPath();
      g.ellipse(gx, gy, rx, rx * 0.45, 0, 0, TAU);
      g.stroke();
    }
    if (since < 0.6) {
      const k = 1 - smooth((since - 0.3) / 0.3);
      for (let c = 0; c < 14; c++) {
        const id = 200 + c;
        const th = (c / 14) * TAU + jitter(id) * 0.5;
        const sd = c % 2 ? 1 : -1, paw = place(at[sd > 0 ? 'fr2' : 'fl2'], R.tip);
        const v: V3 = [sd * (5 + 5 * jitter(id + 1)), Math.sin(th) * (2.5 + 2 * jitter(id + 2)), 7 + 4 * jitter(id + 3)];
        if (dot(v, view.T) > 0) v[2] += 2;
        const p = thrown([paw[0], paw[1], 0.15], v, since, 13);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        if (c % 4 === 0) leafBit(g, x, y, 0.6 * big * k, id + since * 10, c % 8 ? LEAF_RGB : PINK_RGB);
        else if (c % 4 === 2) leafBit(g, x, y, 0.5 * big * k, id + since * 12, PINK_RGB);
        else lump(g, x, y, (0.2 + 0.1 * jitter(id + 4)) * big * k, id, c % 3 === 0 ? PEBBLE_RGB : SOIL_RGB);
      }
    }
  });
}

/**
 * Digging out a stump: the earth loosened round the stump's foot under its claws, dark, with a rim of clods; at each rake, as
 * the claws hook into the stump, splinters of bark knocked off it, and as they come out of the ground, clods flung back under
 * and past its hind legs on either side, high enough to be seen over its back from behind, scattering where they land; as it
 * heaves, the stump's roots torn up out of the ground, stretched from the earth to its snout and snapping, a clod of earth
 * held up on its snout, a burst of earth and a puff of dust where they come out.
 */
function stumpSpray(g: CanvasRenderingContext2D, view: View, s: Petal, b: Bones, R: Rest, a: Anim, t: number, front: boolean, flung: readonly V3[], hooked: readonly V3[], crest: ReadonlyArray<[string, V3]>): void {
  const big = bigness(s), down = downOf(t, a.graze), mid = b.body.t, W = s.work;
  const top = R.h + Math.max(...s.body.h.map((h, q) => h + s.body.z[q])) + s.plates.t * 3;
  const stump: V3 = [0, stumpOf(s, R)[1], 0.01];
  const dug = clamp(Math.max(a.graze < 0.5 ? 0 : 1, ramp(t, W.nose, W.dig)));
  const { heave } = leverOf(s, t);
  const L = s.fore[0] + s.fore[1];
  const span = s.paw * 2.2 + s.claw.len * 0.6;
  if (!front && dug > 0) {
    const [x, y] = onScreen(view, stump);
    const r = span * down * (0.4 + 0.6 * dug) * (1 + 0.25 * heave);
    g.fillStyle = css(mix(LOAM_RGB, [44, 30, 24], 0.4));
    g.beginPath();
    g.ellipse(x, y, r * 1.5, r * 0.62, 0, 0, TAU);
    g.fill();
    for (let q = 0; q < 7; q++) {
      const ox = (jitter(q + 60) - 0.5) * 2.8 * r, oy = (jitter(q + 61) - 0.5) * 1.0 * r;
      lump(g, x + ox, y + oy, 0.15 * big * down * dug, q * 2.1, q % 3 === 2 ? PEBBLE_RGB : q % 2 ? SOIL_RGB : LOAM_RGB);
    }
  }
  // Bark splinters knocked off the stump where the claws hook into it, at the top of each rake.
  for (let k = 0; k < s.digs; k++) {
    const each = (W.dig - W.nose) / s.digs, t0 = strokeAt(s, k) + RAKE_STROKE.bite * each;
    const since = (t - t0) * ACT_SECS.work;
    if (since < 0 || since > 0.4) continue;
    const from = hooked[k], kk = 1 - ramp(since, 0.2, 0.4);
    for (let q = 0; q < 4; q++) {
      const id = 400 + k * 11 + q, sd = q % 2 ? -1 : 1;
      const v: V3 = [sd * (0.8 + 1.2 * jitter(id)), 0.6 + 1.4 * jitter(id + 1), 2.5 + 2 * jitter(id + 2)];
      const p = thrown(from, scale(v, Math.sqrt(big)), since, 9);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      splinter(g, x, y, 0.36 * big * kk, id + since * 14);
    }
  }
  // The roots: a ball of earth and root lifted on its snout as it heaves, and the roots out of it down into the ground round
  // the stump's foot, thick at the ball and thinning to the ground, stretched as it rises; snapping at the top of the heave,
  // their torn ends whipping up toward the ball, and all of it shrinking away as it is shaken off.
  const snout = place(b.head, R.nose);
  const shown = ramp(t, W.lever - 0.03, W.lever + 0.03) * (1 - ramp(t, W.heave + 0.08, W.heave + 0.18));
  if (shown > 0) {
    const snap = ramp(t, W.heave - 0.005, W.heave + 0.06);
    const ball: V3 = [snout[0], snout[1] - s.nose * 0.6, Math.max(0.04 * big, snout[2] - s.nose * 1.4)];
    const rb = 0.3 * big * shown * (1 - 0.4 * snap);
    g.save();
    g.lineCap = 'round';
    for (let q = 0; q < 5; q++) {
      const id = 500 + q, th = (q / 5) * TAU + 0.6 + jitter(id) * 0.7;
      const r = span * (1.0 + 0.7 * jitter(id + 1));
      const ground: V3 = [stump[0] + Math.cos(th) * r, stump[1] + Math.sin(th) * r * 0.8, 0.01];
      // Torn free, its ground end whipped up toward the ball.
      const lo = mixV(ground, add(ball, [Math.cos(th) * r * 0.5, Math.sin(th) * r * 0.4, -rb * 0.2]), snap * (0.55 + 0.3 * jitter(id + 2)));
      const hi: V3 = add(ball, [Math.cos(th) * rb * 0.3, Math.sin(th) * rb * 0.3, -rb * 0.2]);
      const midP: V3 = [lerp(lo[0], hi[0], 0.45) + Math.cos(th) * r * 0.15, lerp(lo[1], hi[1], 0.45) + Math.sin(th) * r * 0.12, lerp(lo[2], hi[2], 0.6) + L * 0.04];
      if (nearSide(midP, mid, view) !== front) continue;
      const [x0, y0] = onScreen(view, lo), [x1, y1] = onScreen(view, hi), [xm, ym] = onScreen(view, midP);
      const w = (0.17 + 0.07 * jitter(id + 3)) * big * shown;
      // Along the curve from the ball to the ground in four lengths, each thinner than the last: dark under, the root over it.
      const at = (u: number): [number, number] => [(1 - u) * (1 - u) * x1 + 2 * u * (1 - u) * xm + u * u * x0, (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * ym + u * u * y0];
      for (const [c, k] of [[mix(ROOT_RGB, [50, 34, 26], 0.6), 1], [ROOT_RGB, 0.58]] as Array<[RGB, number]>) {
        g.strokeStyle = css(c);
        for (let j = 0; j < 4; j++) {
          const [ax, ay] = at(j / 4), [bx, by] = at((j + 1) / 4);
          g.lineWidth = w * k * (1 - 0.2 * j);
          g.beginPath();
          g.moveTo(ax, ay);
          g.lineTo(bx, by);
          g.stroke();
        }
      }
      // A fine rootlet off it.
      const [rx, ry] = at(0.6);
      g.strokeStyle = css(mix(ROOT_RGB, [50, 34, 26], 0.5));
      g.lineWidth = w * 0.3;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx + w * 2.5 * Math.cos(th + 1), ry + w * 2);
      g.stroke();
    }
    g.restore();
    if (nearSide(ball, mid, view) === front) {
      const [x, y] = onScreen(view, ball);
      lump(g, x, y, rb, 3.3, LOAM_RGB);
      lump(g, x - rb * 0.6, y + rb * 0.25, rb * 0.55, 1.1, SOIL_RGB);
    }
  }
  // At the top of the heave, a burst of earth up out of where the roots come out, and dust.
  const since = (t - W.heave) * ACT_SECS.work;
  if (since > -0.02 && since < 0.5) {
    const k = 1 - smooth((since - 0.25) / 0.25);
    for (let q = 0; q < 10 + 2 * s.stage; q++) {
      const id = 300 + q, th = (q / 10) * TAU + jitter(id) * 0.7;
      const v: V3 = [Math.cos(th) * (1 + 1.4 * jitter(id + 1)), Math.sin(th) * (1 + 1.2 * jitter(id + 2)), 3 + 2.5 * jitter(id + 3)];
      if (dot(v, view.T) > 0) v[2] += 1;
      const p = thrown([stump[0] + Math.cos(th) * span * 0.6, stump[1] + Math.sin(th) * span * 0.4, 0.1], scale(v, Math.sqrt(big)), Math.max(0, since), 9);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 5 === 4) splinter(g, x, y, 0.3 * big * k, id + since * 10);
      else lump(g, x, y, (0.13 + 0.08 * jitter(id + 4)) * big * k, id + since * 6, q % 3 === 0 ? PEBBLE_RGB : q % 2 ? SOIL_RGB : LOAM_RGB);
    }
    const dustAt: V3 = [stump[0], stump[1], 0.12 * big];
    if (nearSide(dustAt, mid, view) === front) puff(g, view, dustAt, big * (0.6 + 0.6 * ramp(since, 0, 0.1)) * (1 - ramp(since, 0.04, 0.16)) * [0.26, 0.38, 0.6][s.stage], since * 3, 11);
  }
  // Its outline's top across the screen as it stands now, in strips: what a clod thrown toward the viewer must clear.
  const toward = -view.T[1] > 0.3, strip = 0.12 * big, sky = new Map<number, number>(), floor = new Map<number, number>();
  let x0 = Infinity, x1 = -Infinity;
  if (toward) {
    for (const [key, v] of crest) {
      const under = key[0] === '-', [sx, sy] = onScreen(view, place(b[under ? key.slice(1) : key], v)), i = Math.round(sx / strip);
      if (under) floor.set(i, Math.max(floor.get(i) ?? -Infinity, sy));
      else {
        sky.set(i, Math.min(sky.get(i) ?? Infinity, sy));
        x0 = Math.min(x0, sx);
        x1 = Math.max(x1, sx);
      }
    }
  }
  const outlineAt = (sx: number): number => {
    const i = Math.round(sx / strip);
    return Math.min(sky.get(i - 1) ?? Infinity, sky.get(i) ?? Infinity, sky.get(i + 1) ?? Infinity);
  };
  const bellyAt = (sx: number): number => {
    const i = Math.round(sx / strip);
    return Math.max(floor.get(i - 1) ?? -Infinity, floor.get(i) ?? -Infinity, floor.get(i + 1) ?? -Infinity);
  };
  const { fling } = RAKE_STROKE, each = (W.dig - W.nose) / s.digs;
  for (let k = 0; k < s.digs; k++) {
    const t0 = strokeAt(s, k) + (fling - 0.06) * each;
    if (t < t0 && a.graze < 0.5) continue;
    const since = frac(t - t0) * ACT_SECS.work;
    if (since > 0.75) continue;
    const sd = k % 2 ? -1 : 1;
    const claws = flung[k];
    const many = 6 + 2 * s.strike;
    for (let q = 0; q < many; q++) {
      const id = q * 5 + k * 23;
      const late = q % 3 === 2 ? 0.05 : 0;
      if (since < late) continue;
      const side = sd * (q % 3 === 1 ? -0.6 : 1);
      // Back under it and out between and past its hind legs, some low along the ground and some lobbed up over its rump.
      const high = q % 2 === 0, wide = q % 4 === 3;
      const apex = top * (high ? 0.45 + 0.3 * jitter(id + 2) + (toward ? 0.6 : 0) : 0.1 + 0.1 * jitter(id + 2));
      const k0 = Math.sqrt(top) * (s.strike === 2 ? 1.25 : 1);
      const out = wide ? 1.4 + jitter(id) : toward ? 0.8 + 0.6 * jitter(id) : 0.15 + 0.35 * jitter(id);
      const v: V3 = [side * k0 * out, -k0 * (2.6 + 1.6 * jitter(id + 1)), Math.sqrt(2 * 9 * apex)];
      const p = thrown([claws[0], claws[1], 0.08], v, (since - late) * (toward ? 2 : 1));
      // Coming toward a viewer behind it, drawn behind the body while it is over it on the screen, and in front once clear of it.
      let clear = !toward;
      if (!clear) {
        const [sx, sy] = onScreen(view, p);
        clear = sx < x0 - strip * 0.5 || sx > x1 + strip * 0.5 || sy < outlineAt(sx) - strip * 0.3 || sy > bellyAt(sx) + strip * 0.3;
      }
      if ((nearSide(p, mid, view) && clear) !== front) continue;
      const landed = p[2] <= 0.025;
      const k2 = 1 - smooth((since - 0.45) / 0.3);
      const c = q % 5 === 4 ? PEBBLE_RGB : q % 2 ? SOIL_RGB : LOAM_RGB;
      if (landed) {
        if (!front) scatter(g, view, p, 0.3 * big, k2, c, id);
      } else {
        const [x, y] = onScreen(view, p);
        lump(g, x, y, (0.14 + 0.1 * jitter(id + 3)) * big * (s.strike === 2 ? 1.3 : s.strike === 0 ? 1.35 : 1) * (c === PEBBLE_RGB ? 0.7 : 1), id + since * 6, c);
      }
    }
  }
}

/**
 * Evolving: at the start a burst of petals and leaves out of its back, which covers the moment it changes into its new body;
 * then a swirl of petals and leaves going round and up it as its plates and horns grow.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Petal, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]];
  const burst = ramp(t, 0, 0.02) * (1 - ramp(t, 0.12, 0.3));
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 28; q++) {
      const th = (q / 28) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * s.body.w[3] * 0.4, s.body.y[3] + Math.sin(th) * s.len * 0.3, s.body.h[3] * 0.8]);
      const v: V3 = [Math.cos(th) * (2.2 + 2.2 * jitter(q + 3)), Math.sin(th) * (2.2 + 2.2 * jitter(q + 5)), 3 + 3.5 * jitter(q + 7)];
      const p = thrown(from, v, since, 5);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      leafBit(g, x, y, 0.8 * big * burst, q * 1.3 + since * 8, q % 3 === 0 ? LEAF_RGB : q % 3 === 1 ? PINK_RGB : [250, 246, 238]);
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
      leafBit(g, x, y, 0.55 * big * k, ang * 2 + q, q % 2 ? PINK_RGB : LEAF_RGB);
    }
  }
}

/**
 * The warm flash at the claws where each blow lands, drawn with the body rather than over all of it: in front of it when the
 * claws are on the viewer's side of it, and behind it, where the body covers it, when they are round the far side.
 */
function blowFlash(g: CanvasRenderingContext2D, view: View, s: Petal, b: Bones, R: Rest, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t;
  g.save();
  g.globalCompositeOperation = 'lighter';
  PETAL_HITS[s.strike].forEach((h, q) => {
    const k = hump(t, h + 0.02, 0.1);
    if (k <= 0) return;
    const keys = s.strike === 2 ? ['fl2', 'fr2'] : s.strike === 1 ? [q ? 'fr2' : 'fl2'] : ['fr2'];
    for (const key of keys) {
      const p = place(b[key], R.tip);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p), r = (0.8 + 0.4 * s.strike) * big, al = 0.35 * k;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,214,222,${al})`);
      grad.addColorStop(0.45, `rgba(255,214,222,${al * 0.35})`);
      grad.addColorStop(1, 'rgba(255,214,222,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  g.restore();
}

/** Light over the whole of it as it evolves: a pink glow as it begins, and over its back at the turn. */
function petalGlow(s: Petal, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 0.6]), r: s.body.y[6] - s.body.y[0], c: [250, 206, 214], a: 0.6 * open });
  const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 1.4]), r: s.len * 0.9 + 0.5, c: [246, 226, 206], a: k });
  return out;
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, digs out a stump and evolves. */
function petalKind(s: Petal): Kind {
  const bones = petalBones(s);
  const spec = specOf(s), R = restOf(s, spec);
  const atHits = (a: Anim): Bones[] => PETAL_HITS[s.strike].map((t) => bones({ ...a, act: { kind: 'strike', t } }));
  const a0: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
  /**
   * Where the claws are as they hook into the stump and as they flick the earth back at each rake of a go, along the ground:
   * the same every go, so worked out once rather than posed again every frame.
   */
  let flung: V3[] | undefined, hooked: V3[] | undefined;
  const clawsAt = (): void => {
    const each = (s.work.dig - s.work.nose) / s.digs;
    const tipAt = (k: number, w: number): V3 => place(bones({ ...a0, act: { kind: 'work', t: strokeAt(s, k) + w * each } })[k % 2 ? 'fl2' : 'fr2'], R.tip);
    flung = Array.from({ length: s.digs }, (_, k) => tipAt(k, RAKE_STROKE.fling - 0.06));
    hooked = Array.from({ length: s.digs }, (_, k) => tipAt(k, RAKE_STROKE.bite));
  };
  /** The top of everything on it but its legs, as a few points on their bones, so its outline on the screen can be found. Worked out once. */
  let crest: Array<[string, V3]> | undefined;
  const crestOf = (): Array<[string, V3]> => {
    if (!crest) {
      const b = bones(a0);
      crest = [];
      for (const pc of petalBuild(s, 0)) {
        if (/^[fh][lr]/.test(pc.key) || !b[pc.bone]) continue;
        const v = [...pc.mesh.v].sort((p, q) => place(b[pc.bone], q)[2] - place(b[pc.bone], p)[2]);
        for (let i = 0; i < Math.min(v.length, 48); i += 1) crest.push([pc.bone, v[i]]);
        if (pc.key === 'body') for (let i = Math.max(0, v.length - 48); i < v.length; i++) crest.push([`-${pc.bone}`, v[i]]);
      }
    }
    return crest;
  };
  return {
    bones,
    build: (lod) => petalBuild(s, lod),
    // The variant's first colour for its legs and hide, its second for its petals and horns; cream plates, a cream face with a
    // peach snout, sage and olive leaves, white blossoms and dark claws on every variant.
    palette: (coat, mark) => {
      const hide = mix(coat, [128, 116, 80], 0.15);
      const pink = pastel(mark), cream: RGB = mix([236, 222, 192], pink, 0.08);
      return coatPalette(coat, mark, {
        coat: hide,
        coatDark: mix(hide, [56, 46, 38], 0.32),
        coatLight: mix(hide, [255, 246, 232], 0.3),
        mark: pink,
        belly: mix(hide, [236, 226, 196], 0.5),
        shell: cream,
        shellDark: mix(cream, [150, 124, 92], 0.38),
        horn: mix(cream, [255, 252, 244], 0.55),
        muzzle: mix(cream, [250, 222, 196], 0.3),
        petal: mix(pink, [228, 112, 142], 0.35),
        feather: mix(pink, [246, 176, 190], 0.4),
        featherDark: mix(pink, [190, 76, 106], 0.45),
        membrane: mix([246, 192, 150], pink, 0.25),
        nose: [232, 146, 108],
        pad: [92, 52, 50],
        inner: pink,
        lid: [64, 46, 44],
        eye: [34, 24, 28],
        bark: [92, 60, 46],
        glint: [255, 253, 246],
        claw: [54, 44, 46],
        hornDark: [98, 86, 84],
        leaf: [138, 168, 96],
        leafDark: [88, 114, 70],
        moss: [120, 132, 74],
        stem: [112, 136, 72],
        spot: [252, 250, 244],
        bloom: [246, 206, 92],
      }, 30);
    },
    shadow: [s.len * 0.8 + 0.25, s.body.w[4] * 1.05],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are petal pink and leaf green.
    motes: [[244, 172, 190], [156, 186, 104]],
    glow: (b, a) => petalGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') {
        strikeBurst(g, view, s, b, atHits(a), R, act.t, front);
        blowFlash(g, view, s, b, R, act.t, front);
      } else if (act.kind === 'work') {
        if (!flung || !hooked) clawsAt();
        stumpSpray(g, view, s, b, R, a, act.t, front, flung!, hooked!, crestOf());
      } else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const BUDSCARAB = petalKind(BUDSCARAB_LOOK);
export const BLOSSOMHORN = petalKind(BLOSSOMHORN_LOOK);
export const FLORANTLER = petalKind(FLORANTLER_LOOK);
