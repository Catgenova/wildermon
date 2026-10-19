import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, DEG, disc, dot, frac, lerp, lifted, merge, mix, orb, orbAlong, paint,
  quadBones, quadPose, scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
  type QuadPose, type QuadSpec,
} from './beasts';
import { blade, cut, quadPieces, under } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The clay line: the Mudlet, a round cream pup splotched with clay, which
 * grows into the Clayburrow, a low long-snouted digger under a shell of baked
 * clay plates and teal glazed tiles, and then the Terramole, a hunched mound of
 * a thing bigger than a person with a pale skull of a snout, its back a hill
 * of plates with a cluster of clay pots on top and a sprout growing out of
 * one. The species is still `noot` underneath, as saves and the database know
 * it.
 *
 * All three are built by one set of functions from a description of the stage
 * (`Clay`), so a stage is its numbers. Their legs are placed by where their
 * feet go: every foot is given a point and each leg is bent to reach it, the
 * knee always the same way round, so a foot on the ground stays where it was
 * put and a knee never flips.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }
type HeadRings = Rings & { pitch: number; cream: number[] };

interface Clay {
  /** The barrel's rings, rump to chest. */
  body: Rings;
  /** Shoulder to hip. */
  len: number;
  /** The fore legs and the hind: upper, lower, and the drop from the ankle to the sole; how thick at the top. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  /** How far out from the middle its hips and shoulders are, as a share of the body's width there: well inside it, so a leg comes out from under it. */
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
  /** A pup's round face, a digger's long snout, or a bony skull. */
  face: 'pup' | 'snout' | 'skull';
  nose: number;
  eye: { y: number; up: number; size: number; tall: number; lid: number };
  /** Its ears: a pup's upright leaves, swept-back fans, or horns. */
  ear: { kind: 'pup' | 'swept' | 'horn'; len: number; w: number; out: number; back: number; at: [number, number] };
  /** The plates down its back, in rows from the shoulders to the rump; how big, how thick, how far the back edge stands up, and the share of them glazed teal. */
  plates: null | { from: number; to: number; rows: number; per: number; spread: number; a: number; b: number; t: number; lift: number; teal: number };
  /** Clay pots on top of it, with a sprout out of one; leaves along its flanks; mud dripping off its plates; spikes on its skull. */
  pots: number;
  fringe: number;
  drips: number;
  spikes: number;
  /** Patches of clay on a bare coat. */
  splotch: boolean;
  /** How its legs are coloured: brown mud socks, cream with brown feet, or cream banded with brown clay. */
  legs: 'socks' | 'paws' | 'bands';
  tail: { len: number; w: number; lift: number };
  /**
   * How it goes: the diagonals together at a walk (a scamper) or a four-beat walk; how far its body drops at each footfall (units),
   * a walk's and a run's; how much of a stride a foot is down; how far a leg swings (degrees); how high a foot is lifted; how far
   * the barrel rolls and the head nods and swings; and how much what is on its back rattles.
   */
  gait: { trot: boolean; bob: [number, number]; duty: [number, number]; swing: [number, number]; step: number; roll: number; nod: number; sway: number; jiggle: number };
  /** Its strike: a pounce and swipe, a rake of both fore claws, or reared up and slammed down. */
  strike: 0 | 1 | 2;
  /** Strokes of its fore claws to a go at its task, the two paws in turn. */
  digs: number;
  /** Its go at its task, in time (`Work`). */
  work: Work;
  size: number;
}

/** A Mudlet: a small round cream pup splotched with clay, big upright ears, big glossy eyes, brown mud socks. */
const MUDLET_LOOK: Clay = {
  body: { y: [-0.6, -0.5, -0.28, 0, 0.28, 0.48, 0.58], z: [0.06, 0.05, 0.02, 0, 0.02, 0.05, 0.07], w: [0.28, 0.48, 0.58, 0.6, 0.57, 0.47, 0.25], h: [0.25, 0.4, 0.46, 0.48, 0.46, 0.4, 0.23] },
  len: 0.74,
  fore: [0.22, 0.19, 0.09], hind: [0.22, 0.2, 0.09], thick: 0.15, hip: 0.44, hindThick: 1.06,
  stand: { fore: [-22, 50], hind: [32, -64] },
  paw: 0.15, hindPaw: 0.14,
  claw: { n: 3, len: 0.1, w: 0.045 }, hindClaw: 0.07,
  neck: { at: [0, 0.4, 0.12], len: 0.14, w: 0.34, lean: 52 },
  head: {
    // A dome of a face: full round cheeks well forward, and a small muzzle out of the front of them.
    y: [-0.46, -0.4, -0.25, -0.04, 0.16, 0.31, 0.43, 0.52, 0.58], z: [0.07, 0.08, 0.08, 0.05, 0, -0.05, -0.09, -0.12, -0.13],
    w: [0.2, 0.42, 0.55, 0.6, 0.57, 0.48, 0.34, 0.21, 0.11], h: [0.2, 0.42, 0.52, 0.55, 0.51, 0.42, 0.3, 0.19, 0.1], pitch: -2,
    cream: [0.5, 0.3, 0, -0.2, -0.3, -0.4, -0.5, 1.2],
  },
  face: 'pup',
  nose: 0.07,
  eye: { y: 0.33, up: 0.3, size: 0.14, tall: 1.18, lid: 0 },
  ear: { kind: 'pup', len: 0.44, w: 0.28, out: 50, back: 8, at: [0.55, 0.92] },
  plates: null,
  pots: 0, fringe: 0, drips: 0, spikes: 0,
  splotch: true,
  legs: 'socks',
  tail: { len: 0.26, w: 0.11, lift: 50 },
  gait: { trot: true, bob: [0.08, 0.07], duty: [0.56, 0.4], swing: [26, 30], step: 0.3, roll: 4, nod: 5, sway: 0, jiggle: 0 },
  strike: 0,
  digs: 3,
  work: { dig: 0.48, sniff: 0.6, scoop: 0.65, up: 0.75, toss: 0.84 },
  size: 3.2,
};

/** A Clayburrow: low and long, a long pale snout, swept-back rust ears, a shell of clay plates and teal tiles, huge fore claws. */
const CLAYBURROW_LOOK: Clay = {
  body: { y: [-1.12, -0.98, -0.55, -0.05, 0.5, 0.88, 1.02], z: [-0.04, 0.0, 0.08, 0.12, 0.08, 0.0, -0.04], w: [0.4, 0.66, 0.8, 0.82, 0.78, 0.64, 0.34], h: [0.3, 0.5, 0.64, 0.68, 0.62, 0.5, 0.28] },
  len: 1.7,
  fore: [0.26, 0.22, 0.1], hind: [0.25, 0.24, 0.1], thick: 0.21, hip: 0.44, hindThick: 1.06,
  stand: { fore: [-22, 50], hind: [28, -56] },
  paw: 0.22, hindPaw: 0.18,
  claw: { n: 3, len: 0.5, w: 0.11 }, hindClaw: 0.14,
  neck: { at: [0, 0.84, -0.04], len: 0.24, w: 0.44, lean: 108 },
  head: {
    y: [-0.38, -0.28, -0.05, 0.2, 0.52, 0.82, 1.06, 1.18], z: [0.14, 0.16, 0.13, 0.06, -0.01, -0.05, -0.07, -0.08],
    w: [0.24, 0.42, 0.47, 0.36, 0.23, 0.15, 0.1, 0.065], h: [0.26, 0.4, 0.43, 0.32, 0.21, 0.14, 0.1, 0.065], pitch: -22,
    cream: [0.72, 0.8, 0.92, 1.2, 1.2, 1.2, 1.2],
  },
  face: 'snout',
  nose: 0.06,
  eye: { y: 0.28, up: 0.66, size: 0.085, tall: 1.1, lid: 0 },
  ear: { kind: 'swept', len: 0.58, w: 0.3, out: 52, back: 52, at: [0.55, 0.7] },
  plates: { from: 0.84, to: -1.0, rows: 6, per: 5, spread: 1.3, a: 0.34, b: 0.32, t: 0.07, lift: 0.05, teal: 0.26 },
  pots: 0, fringe: 0, drips: 0, spikes: 0,
  splotch: false,
  legs: 'paws',
  tail: { len: 0.3, w: 0.12, lift: 10 },
  gait: { trot: false, bob: [0.085, 0.1], duty: [0.66, 0.52], swing: [24, 27], step: 0.26, roll: 5, nod: 3, sway: 5, jiggle: 0.6 },
  strike: 1,
  digs: 3,
  work: { dig: 0.48, sniff: 0.6, scoop: 0.64, up: 0.76, toss: 0.84 },
  size: 4.6,

};

/** A Terramole: a hunched mound bigger than a person, a bony pale skull of a snout, horn ears, a hill of plates with pots on top. */
const TERRAMOLE_LOOK: Clay = {
  body: { y: [-2.6, -2.3, -1.4, 0, 1.2, 1.95, 2.25], z: [0, 0.08, 0.2, 0.26, 0.24, 0.12, -0.02], w: [0.9, 1.5, 1.9, 2.0, 2.05, 1.72, 0.82], h: [0.55, 0.9, 1.2, 1.3, 1.28, 1.02, 0.48] },
  len: 4.2,
  fore: [0.84, 0.66, 0.34], hind: [0.7, 0.6, 0.32], thick: 0.86, hip: 0.36, hindThick: 0.95,
  stand: { fore: [-22, 50], hind: [26, -52] },
  paw: 0.6, hindPaw: 0.48,
  claw: { n: 3, len: 1.15, w: 0.24 }, hindClaw: 0.3,
  neck: { at: [0, 1.95, -0.14], len: 0.5, w: 1.05, lean: 112 },
  head: {
    y: [-0.74, -0.57, -0.15, 0.42, 1.06, 1.64, 2.1, 2.34], z: [0.27, 0.32, 0.27, 0.14, 0.0, -0.08, -0.12, -0.13],
    w: [0.4, 0.72, 0.77, 0.58, 0.39, 0.27, 0.19, 0.12], h: [0.42, 0.67, 0.7, 0.51, 0.35, 0.25, 0.17, 0.12], pitch: -30,
    cream: [1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2],
  },
  face: 'skull',
  nose: 0.075,
  eye: { y: 0.36, up: 0.48, size: 0.1, tall: 0.9, lid: 0.3 },
  ear: { kind: 'horn', len: 1.8, w: 0.34, out: 56, back: 24, at: [0.55, 0.75] },
  plates: { from: 1.95, to: -2.35, rows: 9, per: 8, spread: 1.3, a: 0.6, b: 0.56, t: 0.13, lift: 0.09, teal: 0.28 },
  pots: 3, fringe: 4, drips: 3, spikes: 5,
  splotch: false,
  legs: 'bands',
  tail: { len: 0.5, w: 0.26, lift: 5 },
  gait: { trot: false, bob: [0.24, 0.28], duty: [0.72, 0.56], swing: [17, 19], step: 0.13, roll: 4, nod: 2, sway: 6, jiggle: 0.3 },
  strike: 2,
  digs: 2,
  work: { dig: 0.48, sniff: 0.61, scoop: 0.68, up: 0.84, toss: 0.86 },
  size: 3.2,
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

/** When each stage's blows land, as shares of its strike: the Mudlet's swipe, the Clayburrow's two rakes, the Terramole's slam. */
export const CLAY_HITS: ReadonlyArray<readonly number[]> = [[0.5], [0.45, 0.62], [0.58]];
/** Strokes of the fore claws to a go at its task, each stage's. */
export const CLAY_DIGS: readonly number[] = [MUDLET_LOOK.digs, CLAYBURROW_LOOK.digs, TERRAMOLE_LOOK.digs];
/** Each stage's go at its task, in time (`Work`). */
export const CLAY_WORK: readonly Work[] = [MUDLET_LOOK.work, CLAYBURROW_LOOK.work, TERRAMOLE_LOOK.work];
/**
 * A go at its task, as shares of it: its claws dig until `dig`, the strokes evenly spread; it snuffles in the hole with its
 * snout until `sniff`; its right paw goes in for a lump of clay, its claws in the clay at `scoop`, lifts it out in front of
 * its chest by `up`, holds it there, and at `toss` flicks it aside, the paw going back to where it stood by the end.
 */
export interface Work { dig: number; sniff: number; scoop: number; up: number; toss: number }
/** How long the lump tossed aside is in the air, in seconds. */
export const WORK_LAND = 0.26;
/** A stroke of its claws, as shares of the stroke: reached forward until `bite`, dragged back through the clay until `fling`. */
export const DIG_STROKE = { bite: 0.32, fling: 0.78 } as const;

/* ---- its legs, by where its feet go ---------------------------------------------------------- */

/** How far a knee folds for a fold of one: the poses here give a knee in degrees, through this. */
const FOLD = 60;
const SIDE = [-1, 1, -1, 1];

/** A stage's body on four legs (`QuadSpec`). */
const specOf = (s: Clay): QuadSpec => ({
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
 * knee. The knee bends the way it does standing whatever the foot is asked, a fore leg's elbow back and a hind leg's knee
 * forward, so it never flips; a point out of reach is reached for as far as the leg goes.
 */
function legTo(spec: QuadSpec, i: number, pitch: number, T: V3): [number, number] {
  const L = i < 2 ? spec.fore : spec.hind, rest = L.rest ?? [0, 0, 0];
  const loc = sub(rotX(T, -pitch), [SIDE[i] * L.at[0], L.at[1], L.at[2]]);
  const L0 = L.len[0], L1 = L.len[1];
  // Never quite straight: past nineteen twentieths of its length a reach is eased toward the most it goes, so a knee never
  // whips round as a leg comes straight.
  const most = (L0 + L1) * 0.985, ease = (L0 + L1) * 0.95, d0 = Math.hypot(loc[1], loc[2]);
  const D = clamp(d0 > ease ? ease + (most - ease) * Math.tanh((d0 - ease) / (most - ease)) : d0, Math.abs(L0 - L1) + 0.02 * (L0 + L1), most);
  const b = (rest[1] >= 0 ? 1 : -1) * Math.acos(clamp((D * D - L0 * L0 - L1 * L1) / (2 * L0 * L1), -1, 1));
  const a = Math.atan2(loc[1], -loc[2]) - Math.atan2(L1 * Math.sin(b), L0 + L1 * Math.cos(b));
  return [a / DEG - rest[0], (rest[1] - b / DEG) / FOLD];
}

/** A stage standing: how far its body is tipped to stand on all four feet, how high its middle is, and where each ankle is (along the ground, its height over it). */
interface Rest { pitch: number; h: number; ankle: V3[]; tip: V3; nose: V3; sole: V3[][]; chin: V3[] }
function restOf(s: Clay, spec: QuadSpec): Rest {
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
      // The claws' tips a hundredth under where they end, for the thickness of the outer ones as they curve down.
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

/** Where a fore paw's middle claw ends, in the foot's frame. */
const clawTip = (s: Clay): V3 => [0, s.paw * 0.8 + s.claw.len * 0.95, -s.fore[2] + 0.02];
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

/**
 * Going: each foot down for its share of a stride, swept back under the body at the speed the ground goes by, and brought
 * forward again through the air, leaving the ground and landing on it at the ground's speed so it never skates. The body is
 * lowest as the feet bearing it are under it and highest between, by as much as the stage says; and at a run with the
 * diagonals in turn it is in the air between them. The Mudlet scampers on its diagonals; the others walk four beats, the
 * barrel rolling onto each fore foot as it takes the weight.
 */
function goingPlan(s: Clay, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u);
  const trot = G.trot || g >= 0.5;
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const legLen = Math.min(spec.fore.len[0] + spec.fore.len[1], spec.hind.len[0] + spec.hind.len[1]);
  const half = legLen * Math.sin(amp * DEG);
  const beats = trot ? [0, 0.5, 0.5, 0] : [0.25, 0.75, 0, 0.5];
  // Lowest as the feet bearing it are under it: the middle of a diagonal's stance, or of a fore foot's.
  const mid = trot ? duty / 2 : frac(0.75 + duty / 2);
  const bob = lerp(G.bob[0], G.bob[1], g);
  const drop = bob * (0.5 + 0.5 * Math.cos(4 * Math.PI * (w - mid)));
  // In the air between the diagonals, when a stance is under half a stride.
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
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty), e = SWING_EDGE * (1 + (G.trot ? 0.5 : 0) * g);
    const L = (i < 2 ? spec.fore : spec.hind).len, lift = G.step * (L[0] + L[1]) * (1 + (G.trot ? 0.3 : 0.1) * g);
    const y0 = A[1] - half - v * e, y1 = A[1] + half + v * e;
    const y = u < e ? A[1] - half - v * u : u > 1 - e ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * e), -v * (1 - 2 * e), (u - e) / (1 - 2 * e));
    at.push([A[0], y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)]);
    // A pup's paw flicked over as it comes forward; a digger's claws tipped up clear of the ground, so it goes on its knuckles.
    // A hind foot's claws tipped up too on a digger, so they clear the ground as the foot comes forward; on the pup a toe flick,
    // no more than its lift lets its claw tips clear.
    const hindReach = s.hindPaw + s.hindClaw, flick = Math.min(1, lift / (hindReach * Math.sin(18 * DEG)));
    foot.push((i < 2 ? (s.claw.len > 0.3 ? 14 : -22) : s.claw.len > 0.3 ? 10 : -18 * flick) * Math.sin(Math.PI * u) ** 2);
  }
  // The barrel rolled onto whichever fore foot is down, and rocked fore and aft on the four-beat.
  const roll = G.roll * Math.sin((w - mid) * TAU + Math.PI / 2) * (trot ? 0.5 : 1);
  const rock = trot ? 2 * Math.sin(w * TAU * 2) : 1.4 * Math.sin((w - mid) * TAU * 2);
  return { at, foot, H: R.h - drop + air, surge: 0, roll, rock };
}

/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const SWING_EDGE = 0.1;

/** A plan `k` of the way from `a` to `b`. */

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  return {
    at: a.at.map((x, i) => [lerp(x[0], b.at[i][0], k), lerp(x[1], b.at[i][1], k), lerp(x[2], b.at[i][2], k)] as V3),
    foot: a.foot.map((x, i) => lerp(x, b.foot[i], k)),
    H: lerp(a.H, b.H, k), surge: lerp(a.surge, b.surge, k), roll: lerp(a.roll, b.roll, k), rock: lerp(a.rock, b.rock, k),
  };
}

/* ---- the task ------------------------------------------------------------------------------- */

/** A go at its task: how far its head is down at the ground (eased in and out of, unless it is already down). */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.1) * (1 - ramp(t, 0.86, 1)));

/** Which stroke of its claws it is at, and how far through it; and the paw making it, the right first. */
function strokeOf(s: Clay, t: number): { k: number; w: number; paw: number } | null {
  if (t >= s.work.dig) return null;
  const x = (t / s.work.dig) * s.digs, k = Math.min(s.digs - 1, Math.floor(x));
  return { k, w: x - k, paw: k % 2 ? 0 : 1 };
}

/** Where the hole it digs is, along the ground: ahead of its fore paws' claws, between them, as far as a paw reaches. */
const holeOf = (s: Clay, R: Rest): V3 => [0, R.ankle[0][1] + R.tip[1] + (s.fore[0] + s.fore[1]) * 0.22, 0];
/** How far a fore paw is pitched to dig, against a pup's: long claws are turned less, or the paw is lifted off the ground by them. */
const tilt = (s: Clay): number => clamp(0.13 / s.claw.len, 0.12, 1);

/**
 * The claw tip of a digging paw through a stroke, and how its foot is pitched: lifted and reached forward over the hole, struck
 * down into it, dragged back along the clay to under its chest, and flicked up and back to where it stood.
 */
function digPath(s: Clay, R: Rest, i: number, w: number): { tip: V3; e: number } {
  const { bite, fling } = DIG_STROKE, home = restTip(R, i), hole = holeOf(s, R), k = tilt(s);
  const L = s.fore[0] + s.fore[1];
  const big = s.face === 'skull';
  const into: V3 = [home[0] * 0.6, big ? lerp(home[1], hole[1], 0.7) : hole[1], 0.005];
  const back: V3 = [home[0] * 0.8, home[1] - L * (big ? 0.12 : 0.2), 0.005];
  const up = L * (s.face === 'pup' ? 0.12 : 0.17);
  if (w < bite) {
    const u = w / bite;
    return { tip: arc(home, into, u, up), e: k * (26 * Math.sin(Math.PI * u) - 14 * smooth(u)) };
  }
  if (w < fling) {
    const u = (w - bite) / (fling - bite);
    return { tip: arc(into, back, u, 0), e: k * (-14 - 16 * Math.sin(Math.PI * u)) };
  }
  const u = (w - fling) / (1 - fling);
  return { tip: arc(back, home, u, up * 0.7), e: k * (-14 * (1 - smooth(u)) + 18 * Math.sin(Math.PI * u)) };
}

/**
 * The right paw going in for a lump of clay at the end of a go: its claws down into the hole, the lump lifted up in front of
 * its chin, claws turned up under it, and held there; tossed aside, and the paw put back where it stood. As where its ankle
 * goes, and how its foot is pitched. Nothing until `sniff`.
 */
function scoopPath(s: Clay, spec: QuadSpec, R: Rest, p: QuadPose, plan: Plan, t: number): { at: V3; e: number } | null {
  const t0 = s.work.sniff - 0.05;
  if (t < t0) return null;
  const k = tilt(s), home = R.ankle[1], hole = holeOf(s, R);
  const eIn = -24 * k, eUp = 15 + 40 * k;
  const into = ankleFor(R, [restTip(R, 1)[0] * 0.4, hole[1] - s.claw.len * 0.15, 0.005], eIn);
  const L = s.fore[0] + s.fore[1];
  // Held out in front of its chest, the leg most of the way straight, its claws turned up under the lump.
  const held: V3 = [home[0] * 0.6, home[1] + L * (s.face === 'skull' ? 0.36 : 0.5), home[2] + L * (s.face === 'skull' ? 0.22 : s.face === 'snout' ? 0.42 : 0.5)];
  const out: V3 = s.face === 'skull' ? [home[0] + L * 0.22, home[1] + L * 0.2, home[2] + L * 0.25] : [home[0] + L * 0.25, home[1] + L * 0.3, home[2] + L * 0.35];
  if (t < s.work.scoop) return { at: arc(home, into, ramp(t, t0, s.work.scoop), L * (s.face === 'skull' ? 0.16 : 0.3)), e: eIn * ramp(t, t0, s.work.scoop) };
  if (t < s.work.up) return { at: arc(into, held, ramp(t, s.work.scoop, s.work.up), 0), e: lerp(eIn, eUp, ramp(t, s.work.scoop, s.work.up)) };
  if (t < s.work.toss) return { at: add(held, [0, 0, 0.04 * L * Math.sin(Math.PI * ramp(t, s.work.up, s.work.toss))]), e: eUp };
  // Flicked out to the side and down to where it stood in one sweep, through `out`.
  const u = ramp(t, s.work.toss, 1);
  const at = add(add(scale(held, (1 - u) ** 2), scale(out, 2 * u * (1 - u))), scale(home, u * u));
  return { at, e: eUp * (1 - u) ** 2 };
}

/** Where its nose is to be over the ground through a go at its task: over the hole as it digs, in it as it snuffles, up as it holds the lump. */
function noseHeight(s: Clay, t: number, stand: number): number {
  // Over the hole as it digs, at half the height it carries its chin at; level with that as it looks at the lump.
  const hi = Math.min(s.head.h[2] * 0.75, stand * 0.5), look = Math.min(s.head.h[2] * 1.4, stand * 0.9);
  // Into the hole once, held there a moment as it snuffles, and out.
  const dip = ramp(t, s.work.dig - 0.07, s.work.dig + 0.07) * (1 - ramp(t, s.work.sniff - 0.07, s.work.sniff + 0.07));
  const z = lerp(hi, 0.02, dip);
  const up = ramp(t, s.work.scoop, s.work.up) * (1 - ramp(t, s.work.toss + 0.02, 1));
  return lerp(z, look, up);
}

/**
 * A go at its task, digging clay: head down, the fore paws in turn reaching out, striking into the clay and dragging it back
 * under its chest, flinging it back past its hind legs, the barrel rocking onto the digging side and the tail going with each
 * stroke; then its snout pushed into the hole for a snuffle, and its right paw going in for a lump of clay, lifting it up to
 * look at, and tossing it aside.
 */
function workPlan(s: Clay, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim, t: number, down: number): Plan {
  const plan = stillPlan(R, p);
  plan.roll *= 1 - down;
  // The paws eased into their work at the start of a go, but not out of it: each stroke, and the toss, ends where the paw stands.
  const paws = Math.max(a.graze, ramp(t, 0, 0.1));
  const st = strokeOf(s, t);
  const side = st ? (st.paw ? 1 : -1) : 0;
  const drag = st && st.w > DIG_STROKE.bite && st.w < DIG_STROKE.fling ? Math.sin(Math.PI * (st.w - DIG_STROKE.bite) / (DIG_STROKE.fling - DIG_STROKE.bite)) : 0;
  // Crouched over the hole, hind legs braced, the barrel rocking onto the digging side and nodding behind each stroke.
  plan.H -= down * R.h * (0.07 + 0.02 * drag);
  p.pitch -= down * (3 + 2 * drag);
  plan.roll += down * 5 * side * (st ? Math.sin(Math.PI * st.w) : 0);
  plan.rock += down * 2 * drag;
  // The tail going with each stroke, and up as it snuffles: what is seen of it from behind.
  const sniff = ramp(t, s.work.dig, s.work.dig + 0.03) * (1 - ramp(t, s.work.sniff - 0.02, s.work.sniff + 0.02));
  p.tail[0] += down * (14 + 22 * sniff);
  p.tail[1] += down * (st ? 26 * Math.sin(TAU * st.w) * side : 18 * Math.sin(TAU * t * 9) * sniff);
  for (const e of p.ears) e[0] += down * (s.ear.kind === 'pup' ? 14 : 22);
  if (st) {
    const { tip, e } = digPath(s, R, st.paw, st.w);
    const i = st.paw;
    plan.at[i] = mixV(R.ankle[i], ankleFor(R, tip, e), paws);
    plan.foot[i] = e * paws;
  }
  const sc = scoopPath(s, spec, R, p, plan, t);
  if (sc) {
    plan.at[1] = mixV(R.ankle[1], sc.at, paws);
    plan.foot[1] = sc.e * paws;
  }
  // The head turned away from the digging paw through each stroke, so its claws are seen beside the face, easing out of the
  // turn and into the next one at the ends of the stroke where the paw changes; toward the lump as it holds it.
  const hold = ramp(t, s.work.scoop, s.work.up) * (1 - ramp(t, s.work.toss, 1));
  const aside = st ? Math.sin(Math.PI * st.w) ** 2 : 0;
  p.neck[1] += down * ((s.face === 'skull' ? 7 : 8) * side * aside - 14 * hold);
  // Its head wagging in the hole as it snuffles, less the bigger and longer the head.
  p.head[2] += (down * 1.6 * Math.sin(TAU * t * 8) * sniff) / Math.max(0.25, s.head.y[s.head.y.length - 1] - s.head.y[0]);
  p.head[0] -= down * 8 * sniff;
  // Its nose brought down to the height it is to be at, by bowing the neck and the head together.
  const stand = noseOver(spec, R, p, plan, 0);
  const want = Math.max(0.012, lerp(stand, noseHeight(s, t, stand), down));
  let lo = -0.3, hi = 1.2;
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
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/* ---- the strike ------------------------------------------------------------------------------ */

/**
 * The Mudlet's pounce: it crouches, its rump up and wiggling and its tail going, springs forward with all four feet off the
 * ground, its right paw thrown up, and comes down with that paw swiping down onto whatever it pounced on; then it hops back
 * to where it was.
 */
function pouncePlan(s: Clay, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = CLAY_HITS[0][0];
  const L = s.fore[0] + s.fore[1], J = s.len * 0.5;
  const crouch = ramp(t, 0.02, 0.18) * (1 - ramp(t, 0.18, 0.3));
  const out = ramp(t, 0.2, 0.48) * (1 - ramp(t, 0.68, 0.88));
  plan.surge = J * out;
  // Up off the ground on the way there and on the way back, eased in and out of, highest halfway.
  const fly = hump(t, 0.35, 0.17), hop = hump(t, 0.78, 0.11);
  const land = hump(t, hit + 0.02, 0.07) + 0.6 * hump(t, 0.88, 0.05);
  plan.H += R.h * (-0.1 * crouch + 0.6 * fly + 0.3 * hop - 0.06 * land);
  p.pitch += -7 * crouch + 9 * fly - 5 * hump(t, hit, 0.08);
  // The rump wiggled from side to side as it gathers itself, and the tail up and going: what is seen of it from behind.
  plan.roll += 7 * crouch * Math.sin(t * TAU * 6);
  p.tail[0] += 40 * crouch + 20 * fly;
  p.tail[1] += 40 * crouch * Math.sin(t * TAU * 7);
  p.neck[0] += 10 * crouch - 8 * fly;
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
  // Thrown up ahead of its shoulder as it leaps, the leg most of the way straight: wherever the shoulder is, the paw is out
  // in front of it and up, never folded back into it.
  const sh = add(rotX([spec.fore.at[0], spec.fore.at[1], spec.fore.at[2]], p.pitch), [0, plan.surge, plan.H]);
  const up: V3 = [A[0] * 1.1, sh[1] + L * 0.66, sh[2] + L * 0.16];
  // Swung up round the shoulder, by angle and by reach, so it never folds back into the shoulder as the body leaps past it;
  // slowly at first, while the body is still springing off, so the two do not add up to a jerk; then brought down on its prey
  // from where that leaves it, from early enough that the blow is fast but not a snap.
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
 * The Clayburrow's rake: it gathers itself, rears its fore end up with both claws raised, and rakes them down onto the ground
 * in front one after the other, lunging into it; then it settles back and puts its paws back where they stood.
 */
function rakePlan(s: Clay, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), [h1, h2] = CLAY_HITS[1];
  const L = s.fore[0] + s.fore[1];
  const gather = ramp(t, 0, 0.22) * (1 - ramp(t, 0.22, 0.4));
  const rear = ramp(t, 0.12, 0.36) * (1 - ramp(t, h2 - 0.1, h2 + 0.12));
  const lunge = ramp(t, 0.26, 0.5) * (1 - ramp(t, 0.68, 1));
  plan.surge = s.len * 0.1 * lunge;
  plan.H += R.h * (-0.12 * gather + 0.22 * rear);
  // Reared well up, so its raised claws come up over the line of its shell and are seen from behind.
  p.pitch += -4 * gather + 24 * rear - 3 * hump(t, h1, 0.07) - 3 * hump(t, h2, 0.07);
  p.neck[0] += -10 * gather - 12 * rear;
  p.head[0] += 6 * rear;
  // The tail lashing and the haunches shifting onto the side raking: what is seen of it from behind.
  p.tail[0] += 30 * gather + 24 * rear;
  p.tail[1] += 30 * Math.sin(t * TAU * 3) * (gather + rear);
  for (const e of p.ears) e[0] += 20 * gather + 16 * rear;
  plan.roll += 7 * (hump(t, h2, 0.12) - hump(t, h1, 0.12));
  const rake = (i: number, hit: number, raise0: number): void => {
    const A = R.ankle[i];
    // Raised high, over the line of its shell, so a claw is seen going up from behind.
    const high: V3 = [A[0] * 1.2, A[1] + plan.surge + L * 0.5, A[2] + L * 1.35];
    const down: V3 = [A[0] * 0.85, A[1] + s.len * 0.1 + L * 0.3, A[2]];
    const drawn: V3 = [down[0], down[1] - L * 0.3, down[2]];
    const top = hit - 0.09;
    if (t > raise0 && t < top) plan.at[i] = arc(A, high, ramp(t, raise0, top), 0);
    else if (t >= top && t < hit) plan.at[i] = mixV(high, down, ((t - top) / (hit - top)) ** 2);
    else if (t >= hit && t < hit + 0.14) plan.at[i] = arc(down, drawn, ramp(t, hit, hit + 0.14), 0);
    else if (t >= hit + 0.14 && t < hit + 0.36) plan.at[i] = arc(drawn, A, ramp(t, hit + 0.14, hit + 0.36), L * 0.22);
    // Long claws are pitched little: turned far, they would lift the paw off the ground by their length.
    plan.foot[i] = tilt(s) * (24 * hump(t, top, 0.12) - 16 * hump(t, hit + 0.04, 0.07));
  };
  rake(0, h1, 0.14);
  rake(1, h2, 0.24);
  return plan;
}

/**
 * The Terramole's slam: it rears right up on its hind legs, crouched on its haunches, both fore paws raised high, and slams
 * them down onto the ground in front of it, the whole of it shaking as it lands; then it steps its paws back one at a time.
 */
function slamPlan(s: Clay, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = CLAY_HITS[2][0];
  const L = s.fore[0] + s.fore[1];
  const top = hit - SLAM_DROP, rear = slamRear(t);
  const shake = t > hit ? Math.sin((t - hit) * 70) * (1 - ramp(t, hit, 0.9)) : 0;
  const land = hump(t, hit + 0.03, 0.08);
  // Its haunches sunk as it rears, crouched on them: from behind, its hindquarters go down as its front goes up.
  plan.H += R.h * (0.2 * rear - 0.08 * land) + 0.02 * shake;
  p.pitch += 26 * rear - 3 * land;
  p.neck[0] += -18 * rear + 6 * land;
  p.head[0] += -10 * rear;
  // The tail swung up as it rears and slapped down as it lands: what is seen of it from behind, with the haunches.
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

/** How long the Terramole's slam takes to come down, as a share of its strike: after it has reared and held a moment at the top. */
const SLAM_DROP = 0.16;
/** How far reared up the Terramole is through its strike: up, held at the top a moment, and dropped, fastest as it lands. */
function slamRear(t: number): number {
  const hit = CLAY_HITS[2][0], top = hit - SLAM_DROP;
  return ramp(t, 0.02, top - 0.05) * (1 - clamp((t - top) / (hit - top)) ** 2);
}

/** Evolving: hunched as the light gathers and its plates form on its back, then drawn up tall at the turn, a shake of the head, and settled. */
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
function earRoot(s: Clay): V3 {
  const H = s.head, q = onRings(H, lerp(H.y[0], H.y[2], s.ear.at[0]), s.ear.at[1]);
  return sub(q.p, scale(q.n, 0.04));
}
/** Where its nose ends, in the head's frame. */
const noseTip = (s: Clay): V3 => { const H = s.head, last = H.y.length - 1; return [0, H.y[last] + s.nose * 0.9, H.z[last] - H.h[last] * 0.4]; };

/** Its pose for what it is doing, over the one a body on four legs has (`quadPose`), and where its feet go. */
function planOf(s: Clay, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
  p.pitch += R.pitch;
  const act = a.act;
  if (act?.kind === 'strike') return s.strike === 0 ? pouncePlan(s, spec, R, p, act.t) : s.strike === 1 ? rakePlan(s, spec, R, p, act.t) : slamPlan(s, spec, R, p, act.t);
  if (act?.kind === 'work') return workPlan(s, spec, R, p, a, act.t, downOf(act.t, a.graze));
  if (act?.kind === 'evolve') return evolvePlan(R, p, act.t);
  if (a.graze > 0 && a.go <= 0) return workPlan(s, spec, R, p, a, 0, a.graze);
  if (a.go <= 0) return still(s, R, p, a);
  const going = goingPlan(s, spec, R, p, a), g = smooth(a.go);
  const G = s.gait, w = frac(a.u);
  // Going: the head nodding and swinging with the stride, the tail going, the ears back with speed.
  p.neck[0] += g * (4 + 4 * a.gait);
  p.neck[1] += g * G.sway * Math.sin(w * TAU - 0.6);
  p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.8) - g * 3;
  p.tail[1] += g * 18 * Math.sin(w * TAU + 1);
  // The Terramole's weight let down onto each fore foot as it lands: a squash of the barrel that shakes what is on its back.
  if (!G.trot) p.squash += g * 0.035 * (pulse(w - 0.78) + pulse(w - 0.28));
  return a.go >= 1 ? going : mixPlan(still(s, R, p, a), going, g);
}

/** Standing about: a pup's tail going and its ears pricking now and then; a digger's nose working at the air and down for a sniff. */
function still(s: Clay, R: Rest, p: QuadPose, a: Anim): Plan {
  const plan = stillPlan(R, p);
  const sniff = beat(a.t, [6.2, 18.4], 1.6);
  p.neck[0] += 12 * sniff;
  p.head[0] += 2.5 * Math.sin(a.t * TAU * 2.5) * (1 - sniff) - 12 * sniff + 3 * sniff * Math.sin(a.t * 28);
  if (s.face === 'pup') {
    p.tail[1] += 22 * Math.sin(a.t * TAU * 2) * beat(a.t, [2.4, 9.6, 15.1, 21.0], 2.4);
    for (const e of p.ears) e[0] -= 10 * beat(a.t, [4.2, 13.3], 0.5);
  } else {
    // A big ear or a horn is not flicked like a pup's: the flick it is given standing (`quadStill`) mostly taken back out.
    for (const e of p.ears) e[0] *= 0.3;
  }
  return plan;
}

/** How low a leg's shin and knee come, the rings of their tubes as `legPieces` builds them: the lowest point of any. */
function shinLow(s: Clay, b: Bones, i: number): number {
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
function clayBones(s: Clay): (a: Anim) => Bones {
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
    // Nor the shin or the knee: a leg whose shin would dip into the ground, its knee come low with the foot up behind it,
    // has its foot put up by as much, and is bent again.
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

/* ---- plates, pots and the rest of what it wears ---------------------------------------------- */

/** The colours of its plates: baked rust clay, brown clay, and teal glaze; each a light face, a dark face and a bright one. */
type Tone = 'rust' | 'brown' | 'teal';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = { rust: ['crystal', 'crystalDark', 'ember'], brown: ['shell', 'shellDark', 'bark'], teal: ['water', 'scale', 'gem'] };

/** One plate: rooted at `root` on the body, `n` the way out there and `back` the way it lies; `a` long and `b` wide (halves), `t` thick, its back edge up `lift`. */
interface Plate { root: V3; n: V3; back: V3; a: number; b: number; t: number; lift: number; tone: Tone; id: number }

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
 * A plate of baked clay: a low faceted slab, its sides going down into the body, its top a shallow point of light and dark
 * faces so it reads as a fired chunk; lying back like a shingle, its back edge standing up off the one behind it. A teal tile
 * is squarer and flatter, glazed, with a glint on it.
 */
function plateMesh(P: Plate): Mesh {
  const z = unit(P.n), y = unit(sub(P.back, scale(z, dot(P.back, z)))), x = cross(y, z);
  const teal = P.tone === 'teal', S = teal ? 4 : 7, spin = teal ? 0 : jitter(P.id) * TAU;
  // A teal tile a long diamond pointing back, a leaf of glaze; a plate a rounded slab, a little ragged.
  const ring = (k: number, h: number): V3[] => Array.from({ length: S }, (_, j) => {
    const th = spin + (j / S) * TAU, jj = teal ? 1 : 0.88 + 0.2 * jitter(P.id * 7 + j);
    const lx = Math.cos(th) * P.b * k * jj * (teal ? 0.78 : 1), ly = Math.sin(th) * P.a * k * jj * (teal ? 1.1 : 1);
    return add(P.root, add(add(scale(x, lx), scale(y, ly)), scale(z, h + P.lift * (ly / P.a))));
  });
  const base = ring(0.96, -P.t * 0.8), top = ring(0.84, P.t);
  // A plate's top a low peak, so it reads as a fired chunk; a tile's flat, its middle level with its edge, glaze laid flat.
  const apex = teal ? scale(top.reduce((t, q) => add(t, q), [0, 0, 0] as V3), 1 / S) : add(P.root, add(scale(y, P.a * 0.12), scale(z, P.t * 1.3 + P.lift * 0.12)));
  const v: V3[] = [...base, ...top, apex];
  const f: Face[] = [], want: V3[] = [];
  const [light, dark, bright] = TONES[P.tone];
  for (let j = 0; j < S; j++) {
    const j1 = (j + 1) % S;
    const out = unit(sub(scale(add(top[j], top[j1]), 0.5), add(P.root, scale(z, P.t))));
    // Its rim dark where it faces back down the slope it lies on, light where it faces up it.
    f.push({ i: [j, j1, S + j1, S + j], m: dot(out, y) > 0.3 ? dark : light, soft: true });
    want.push(out);
    f.push({ i: [S + j, S + j1, 2 * S], m: teal ? light : j % 3 === 0 ? bright : light });
    want.push(unit(add(out, scale(z, 1.6))));
  }
  const body = mesh(v, wound(v, f, want));
  if (!teal) return body;
  const c = add(P.root, add(scale(z, P.t * 1.05), scale(y, -P.a * 0.15)));
  return merge(body, paint([disc(c, z, P.b * 0.09, P.a * 0.05, 5, 'glint', { up: y, lit: true })]));
}

/**
 * The plates down its back in rows from the shoulders to the rump, set like bricks, each lying back toward the tail and out
 * down the flank; most rust, some brown, and teal tiles set among them in a pattern rather than at random, so they read.
 */
function platesOf(s: Clay): Plate[] {
  const C = s.plates, out: Plate[] = [];
  if (!C) return out;
  for (let r = 0; r < C.rows; r++) {
    const f = r / Math.max(1, C.rows - 1);
    const y0 = lerp(C.from, C.to, f);
    const count = C.per + (r % 2 ? -1 : 0);
    for (let q = 0; q < count; q++) {
      const id = 100 + r * 17 + q;
      const g = count > 1 ? q / (count - 1) - 0.5 : 0, edge = Math.abs(g) * 2;
      const th = Math.PI / 2 + g * 2 * C.spread + (jitter(id) - 0.5) * 0.12;
      const at = onRings(s.body, y0 + (jitter(id + 3) - 0.5) * 0.08, th);
      // Back along the body, and down round it on the flanks.
      const c = Math.cos(th), sn = Math.sin(th), wv = Math.sign(c) || 1;
      const round: V3 = unit([wv * sn, 0, -wv * c * 0.9]);
      const back = unit(add([0, -1, 0], scale(round, edge * 1.4)));
      const k = (1 - 0.25 * edge) * (0.9 + 0.2 * jitter(id + 5)) * (1 - 0.25 * Math.abs(f - 0.4));
      // Teal only on the back, where a tile is seen face on: out on the flanks it is seen edge on, a sliver like a shard.
      // Glazed tiles in diagonal bands across the back and down onto the flanks, flat, so they read as tiles set among the
      // plates rather than as stones; one in three plates on the Clayburrow, one in four on the Terramole's broad back.
      const band = (r + q) % (C.rows > 7 ? 4 : 3) === 0 && edge < 0.95;
      const tone: Tone = band ? 'teal' : jitter(id + 9) < 0.62 ? 'rust' : 'brown';
      const tk = tone === 'teal' ? 0.86 : 1;
      // A tile laid over the plates round it, not under them, so it is not buried.
      out.push({ root: add(at.p, scale(at.n, tone === 'teal' ? C.t * (0.9 - 0.5 * edge) : -0.02)), n: at.n, back, a: C.a * k * tk, b: C.b * k * tk, t: C.t * (tone === 'teal' ? 0.45 : 1), lift: C.lift * k * (tone === 'teal' ? 0.15 : 1), tone, id });
    }
  }
  return out;
}

/** What rattles on its back, as one mesh: each corner's root (what it rocks on) and a phase of its own. */
interface Rattle { mesh: Mesh; root: V3[]; ph: number[]; grow: number[] }
function rattleOf(parts: ReadonlyArray<{ mesh: Mesh; root: V3; id: number }>, grow = 1): Rattle {
  const root: V3[] = [], ph: number[] = [], g: number[] = [];
  for (const p of parts) for (let q = 0; q < p.mesh.v.length; q++) { root.push(p.root); ph.push(jitter(p.id + 31) * TAU); g.push(grow); }
  return { mesh: merge(...parts.map((p) => p.mesh)), root, ph, grow: g };
}

/** A pot of fired clay, `r` round and `h` tall, standing on `root` along `up`: a round belly, a narrow neck and a flared lip, its mouth earth-brown (black would read as a hole); some banded with teal glaze. */
function potMesh(root: V3, up: V3, r: number, h: number, band: boolean, n: number): Mesh {
  const u = unit(up);
  const zs = [-0.16, 0, 0.2, 0.46, 0.7, 0.84, 0.98, 1.0], ws = [0.6, 0.7, 0.94, 1, 0.8, 0.52, 0.66, 0.62];
  const pts = zs.map((z) => add(root, scale(u, z * h)));
  const last = pts.length - 1;
  return tube(pts, ws.map((w) => w * r), ws.map((w) => w * r), n, (ring) => (ring >= last ? 'shellDark' : ring === 3 ? (band ? 'water' : 'leatherDark') : ring === 6 ? 'leatherLit' : 'leather'), { start: false });
}

/** A sprout out of a pot's mouth: a green stem and two leaves and a bud, sage. */
function sproutMesh(at: V3, up: V3, L: number): Mesh {
  const u = unit(up);
  const top = add(at, scale(u, L));
  const stem = tube(curve(sub(at, scale(u, L * 0.2)), add(at, add(scale(u, L * 0.5), [0.02, 0, 0])), top, 3), [L * 0.07, L * 0.06, L * 0.05, L * 0.04], [L * 0.07, L * 0.06, L * 0.05, L * 0.04], 5, 'stem');
  const leaf = (dir: V3, len: number, face: V3): Mesh => {
    const d = unit(dir);
    return blade(curve(top, add(top, add(scale(d, len * 0.55), [0, 0, len * 0.18])), add(top, add(scale(d, len), [0, 0, len * 0.05])), 3), [L * 0.03, len * 0.28, len * 0.26, L * 0.02], face, { mat: 'leaf', rib: 'leafDark', thick: len * 0.06, fold: 0.3 });
  };
  return merge(stem, leaf([1, 0.3, 0.5], L * 0.9, [0, 0, 1]), leaf([-1, -0.2, 0.6], L * 0.75, [0, 0, 1]), orbAlong(add(top, scale(u, L * 0.1)), u, [L * 0.08, L * 0.08, L * 0.14], 5, 3, 'leafDark'));
}

/** The pots on the Terramole's back, sitting on its plates at the top of the hill, and the sprout out of the first. */
function potsOf(s: Clay, n: number): Array<{ mesh: Mesh; root: V3; id: number }> {
  if (!s.pots || !s.plates) return [];
  const P = s.plates;
  const spots: Array<[number, number, number, number, number]> = [
    // along, round (radians from the right), radius, height, tilt
    // Nestled low into the plates along the top of its back, side by side, none on another.
    [0.15, 1.7, 0.5, 0.7, 0.12], [-0.75, 1.3, 0.42, 0.56, -0.25], [-0.55, 2.0, 0.34, 0.48, 0.3],
  ];
  return spots.slice(0, s.pots).map(([y, th, r, h, tilt], q) => {
    const at = onRings(s.body, y, th);
    const root = add(at.p, scale(at.n, P.t * 0.4));
    const up = unit(add(add([0, 0, 1], scale(at.n, 0.35)), [Math.sin(tilt) * 0.3, -0.1, 0]));
    let m = potMesh(root, up, r, h, q % 2 === 1, n);
    if (q === 0) m = merge(m, sproutMesh(add(root, scale(up, h * 0.95)), add(up, [0.1, 0.15, 0]), h * 0.62));
    return { mesh: m, root, id: 900 + q };
  });
}

/** Leaves of teal-green along the Terramole's flanks under its plates, hanging down and back. */
function fringeOf(s: Clay): Mesh | undefined {
  if (!s.fringe || !s.plates) return undefined;
  const P = s.plates, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < s.fringe; q++) {
      const id = 500 + q + (sd > 0 ? 0 : 40);
      const y = lerp(P.from - 0.5, P.to + 0.6, (q + 0.5) / s.fringe);
      const th0 = Math.PI / 2 - P.spread - 0.1;
      const at0 = onRings(s.body, y, th0), at = sd > 0 ? at0 : left(at0);
      // Broad leaf-shaped tiles of glaze hanging down the flank and back, only a little out from it, so from in front or behind
      // they stay inside its outline rather than standing out to the sides like wings.
      const dir = unit(add(add(scale(at.n, 0.6), [0, -0.45, 0]), [0, 0, -1.3]));
      const L = (0.95 + 0.15 * jitter(id + 2)), W = L * 0.42;
      const root = sub(at.p, scale(at.n, 0.04));
      const mid = add(root, add(scale(dir, L * 0.55), scale(at.n, L * 0.12)));
      out.push(blade([root, mid, add(root, scale(dir, L * 0.8)), add(root, scale(dir, L))], [W * 0.45, W, W * 0.7, W * 0.08], at.n, { mat: 'moss', rib: 'membrane', thick: W * 0.18, fold: 0.2 }));
    }
  }
  return merge(...out);
}

/** Mud dripping off its plates down its flanks: a few fat brown drips, each a run and a drop. */
function dripsOf(s: Clay, n: number): Mesh | undefined {
  if (!s.drips || !s.plates) return undefined;
  const P = s.plates, out: Mesh[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < s.drips; q++) {
      const id = 700 + q + (sd > 0 ? 0 : 30);
      // Off the lowest plates' edge between the leaves of glaze, so neither hides the other.
      const y = lerp(P.from - 0.5, P.to + 0.6, (q + 1) / (s.drips + 1)) + (s.fringe ? 0 : 0.2 * jitter(id));
      const th0 = Math.PI / 2 - P.spread + 0.05;
      const at0 = onRings(s.body, y, th0), at = sd > 0 ? at0 : left(at0);
      // A sag of mud run down off a plate's edge, fat at the bottom, and a drop under it.
      const L = (0.34 + 0.12 * jitter(id + 1)) * Math.min(1.2, s.len / 3), r = L * 0.34;
      const c = add(at.p, add(scale(at.n, r * 0.1), [0, 0, -L * 0.45]));
      out.push(orbAlong(c, [0, 0.1, 1], [r * 0.85, r * 0.7, L * 0.55], n, 5, 'bark'));
      out.push(orb(add(c, [0, 0, -L * 0.62]), r * 0.5, n, 4, 'bark'));
    }
  }
  return merge(...out);
}

/** The most anything on its back is tipped as it rattles, in radians: it is clay, and rocks on its root. */
const RATTLE_MOST = 0.07;

/**
 * How what is on its back moves this moment: how far each thing is rocked on its root and how fast, and how far grown it is.
 * Rattling as it goes, as a blow lands and as it digs; and as it evolves, the plates growing out of its back from under half
 * their size and the pots coming up out of them.
 */
function rattle(s: Clay, a: Anim, pots: boolean): { jig: number; at: number; grow: number; tip: number } {
  let jig = 0, at = 0, grow = 1, tip = 0;
  if (a.go > 0) {
    jig = smooth(a.go) * s.gait.jiggle * (0.04 + 0.02 * a.gait) * (pots ? 1.6 : 1);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    for (const h of CLAY_HITS[s.strike]) jig += 0.06 * hump(act.t, h + 0.05, 0.14);
    at = act.t * 60;
    // The pots tipped back on their roots as it rears, and thrown forward as it lands: seen from behind too.
    if (pots && s.strike === 2) tip = 0.12 * slamRear(act.t) - 0.12 * hump(act.t, CLAY_HITS[2][0] + 0.04, 0.08);
  } else if (act?.kind === 'work') {
    const st = strokeOf(s, act.t);
    if (st) jig += downOf(act.t, a.graze) * 0.03 * hump(st.w, DIG_STROKE.bite + 0.05, 0.15);
    at = act.t * 50;
  } else if (act?.kind === 'evolve') {
    const t = act.t;
    grow = pots ? ramp(t, 0.26, 0.54) * (1 + 0.16 * hump(t, 0.58, 0.07)) : 0.45 + 0.55 * ramp(t, 0.04, 0.5) + 0.12 * hump(t, 0.54, 0.08);
    jig += 0.05 * hump(t, 0.62, 0.1);
    at = t * 70;
  }
  return { jig: Math.min(RATTLE_MOST, jig), at, grow, tip };
}

/** A piece of things that rattle and grow (`rattle`): each whole, scaled from its root and rocked on it, a beat of its own. */
function rattling(s: Clay, G: Rattle, pots: boolean): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { jig, at, grow, tip } = rattle(s, a, pots);
    if (!jig && grow === 1 && !tip) return v as V3[];
    return v.map((p, i) => {
      const r = G.root[i], ph = G.ph[i];
      let [x, y, z] = scale(sub(p, r), grow);
      const side = jig * Math.sin(at + ph), fore = jig * 0.6 * Math.cos(at + ph * 1.3) + tip;
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

/** A blot painted on a body of rings, following its curve: `r` across along it and round it, ragged, in `m`. */
function blot(R: Rings, y: number, th: number, r: number, m: Mat, id: number, side = 1): Disc {
  const c = onRings(R, y, th), q = side > 0 ? c : left(c);
  const n = 9, v: V3[] = [];
  const wAt = Math.max(0.05, Math.hypot(c.p[0], c.p[2] - lerp(R.z[0], R.z[R.z.length - 1], 0.5)));
  for (let j = 0; j < n; j++) {
    const a = (j / n) * TAU, k = r * (0.72 + 0.4 * jitter(id * 5 + j));
    const pt = onRings(R, y + Math.sin(a) * k, th + (Math.cos(a) * k) / wAt);
    const pp = side > 0 ? pt : left(pt);
    v.push(add(pp.p, scale(pp.n, 0.012)));
  }
  // Wound to face out of the body.
  let nx = 0, ny = 0, nz = 0;
  for (let c2 = 0; c2 < n; c2++) {
    const p = v[c2], r2 = v[(c2 + 1) % n];
    nx += (p[1] - r2[1]) * (p[2] + r2[2]);
    ny += (p[2] - r2[2]) * (p[0] + r2[0]);
    nz += (p[0] - r2[0]) * (p[1] + r2[1]);
  }
  return { v: nx * q.n[0] + ny * q.n[1] + nz * q.n[2] < 0 ? v.reverse() : v, m };
}

/**
 * The eyes: big, round and glossy on the Mudlet, a dark ball with two glints; small and dark with a glint on the Clayburrow;
 * small, deep in a darker socket and narrowed under a bony brow on the Terramole. All of an eye goes out of sight together
 * behind the skull or the snout.
 */
function eyesOf(s: Clay, shut: boolean): Mesh {
  const E = s.eye, H = s.head, meshes: Mesh[] = [];
  // How far round the head a step across its surface is, at the eye.
  const c0 = onRings(H, E.y, E.up), rho = Math.max(0.05, Math.hypot(c0.p[0], c0.p[2] - lerp(H.z[2], H.z[4], 0.5)));
  for (const side of [1, -1]) {
    const q = side > 0 ? c0 : left(c0), out: Disc[] = [];
    // Hidden whole as soon as it starts round the far side of the skull.
    const at = sub(q.p, scale(q.n, H.w[2] * 0.05));
    // Each shape painted onto the skull itself, every corner on its curve, so none of it can stand out past the outline: `cy`
    // along the head and `cu` up it from the eye's middle, `ry` by `ru` across, `lift` off the surface; `tilt` slants it.
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
    if (s.face === 'skull') out.push(patch(0, 0, r * 1.9, r * 1.6, 9, 'hornDark', 0.006));
    // And not drawn once it is turned more than about eighty degrees from the viewer, as it goes round toward the outline
    // (`Face.unless`): the way out of the eye, turned back, and tipped up as far as the view always looks down.
    // The view always looks down by the same amount (0.353 of the way toward the viewer is up), so this hides the eye when
    // its own facing toward the viewer falls under about a sixth.
    const away: V3 = [-q.n[0], -q.n[1], 0.62 - q.n[2]];
    const done = (): void => { const m = paint(out); m.f.forEach((f) => { f.unless = away; }); meshes.push(m); };
    if (shut) {
      out.push(patch(0, -r * 0.1, r * 1.1, r * 0.28, 8, 'lid', 0.01));
      done();
      continue;
    }
    out.push(patch(0, r * 0.05, r * 1.16, r * tall * 1.14, 10, 'lid', 0.008));
    out.push(patch(0, 0, r, r * tall, 12, 'eye', 0.012));
    if (!E.lid) out.push(patch(0, -r * tall * 0.3, r * 0.62, r * tall * 0.4, 8, 'hoof', 0.016));
    if (E.lid) out.push(patch(0, r * tall * (1.35 - E.lid * 1.1), r * 1.3, r * tall * 0.75, 10, 'horn', 0.02, { tilt: -0.35 }));
    const gy = E.lid ? 0.1 : 0.38;
    out.push(patch(r * 0.32, r * tall * gy, r * 0.3, r * 0.3, 6, 'glint', 0.024, { lit: true }));
    if (!E.lid) out.push(patch(-r * 0.3, -r * tall * 0.42, r * 0.14, r * 0.14, 5, 'glint', 0.024, { lit: true }));
    done();
  }
  return merge(...meshes);
}

/**
 * The head, built as rings from the back of the skull to the end of the snout: the Mudlet's round, cream, a clay patch about
 * one ear and mud on its cheek, a small pink-brown nose and a smile, a tuft and a teal fleck on its crown; the Clayburrow's a
 * long pale snout under a rust cap; the Terramole's a long bony skull, small spikes along its brow and crown.
 */
function headOf(s: Clay, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1, F = s.face;
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => {
    const up = Math.sin(((j + 1) / n) * TAU);
    if (F === 'skull') return up < -0.5 ? 'hornDark' : 'horn';
    return up > H.cream[Math.min(ring, H.cream.length - 1)] ? (F === 'pup' ? 'coat' : 'mark') : 'muzzle';
  });
  const tipC: V3 = [0, H.y[last] + s.nose * 0.2, H.z[last] - H.h[last] * 0.2];
  const nose = orbAlong(tipC, [0, 1, 0.1], [s.nose * 1.15, s.nose * 0.85, s.nose * 0.85], 7, 4, 'nose');
  const front: V3 = [0, tipC[1] + s.nose * 0.82, tipC[2]];
  const nostrils = paint([1, -1].map((sd) => disc(add(front, [sd * s.nose * 0.38, 0.006, -s.nose * 0.1]), [0, 1, 0.1], s.nose * 0.17, s.nose * 0.24, 6, 'pad')));
  const parts: Array<Mesh | undefined | false> = [skull, nose, nostrils];
  // The mouth: back along the side of the muzzle from under the nose, the pup's turned up at its corner in a smile.
  const pup = F === 'pup';
  parts.push(paint([1, -1].map((sd) => {
    const pts = Array.from({ length: 6 }, (_, q) => {
      const f = q / 5, y = lerp(H.y[last - 1], pup ? H.y[last] - (H.y[last] - H.y[0]) * 0.3 : lerp(H.y[2], H.y[3], 0.5), f);
      const th = pup ? -0.62 + 0.36 * f ** 2 : -0.62 + 0.1 * f;
      const at = onRings(H, y, th);
      return sd > 0 ? at : left(at);
    });
    return { ...line(pts, H.w[2] * (pup ? 0.035 : 0.03), 'lid'), at: sub(pts[3].p, scale(pts[3].n, 0.05)) };
  })));
  if (pup) {
    // A clay patch over the crown about the right ear, another at the back of the left, and mud on the right cheek.
    const dabs: Disc[] = [
      blot(H, H.y[1] + 0.06, 1.1, H.w[2] * 0.36, 'mark', 41, 1),
      blot(H, H.y[1] + 0.02, 0.9, H.w[2] * 0.28, 'bark', 43, -1),
      blot(H, s.eye.y - 0.06, -0.3, H.w[2] * 0.2, 'mark', 47, 1),
    ];
    parts.push(paint(dabs.map((d) => ({ ...d, at: sub(d.v[0], [0, 0, 0.0]) }))));
    // The tuft: three curls of brown fur up off the crown; and before it a teal fleck, a little glazed tile.
    const crown = onRings(H, lerp(H.y[1], H.y[2], 0.5), Math.PI / 2);
    parts.push(merge(...[-1, 0, 1].map((q) => {
      const root = add(crown.p, [q * H.w[2] * 0.08, -q * q * 0.02, -0.02]);
      const L = H.h[2] * (0.42 - 0.08 * Math.abs(q));
      return tube(curve(root, add(root, [q * L * 0.3, L * 0.25, L * 0.7]), add(root, [q * L * 0.55, -L * 0.15, L * 1.0]), 3), [L * 0.2, L * 0.16, L * 0.1, 0.008], [L * 0.16, L * 0.13, L * 0.08, 0.008], 5, 'bark', { seam: 'start' });
    })));
    const fl = onRings(H, lerp(H.y[3], H.y[4], 0.2), Math.PI / 2 - 0.1);
    parts.push(plateMesh({ root: sub(fl.p, scale(fl.n, 0.012)), n: fl.n, back: [0, -1, 0], a: H.w[2] * 0.2, b: H.w[2] * 0.2, t: 0.025, lift: 0.004, tone: 'teal', id: 3 }));
  }
  if (F === 'skull') {
    // Spikes: two over the brow, swept back, and a row down the crown to the neck.
    const spikes: Mesh[] = [];
    for (let q = 0; q < s.spikes; q++) {
      const brow = q < 2, sd = q % 2 ? -1 : 1;
      const at0 = brow ? onRings(H, s.eye.y - 0.06, s.eye.up + 0.42) : onRings(H, lerp(H.y[2], H.y[0], (q - 2) / Math.max(1, s.spikes - 3)), Math.PI / 2);
      const at = brow && sd < 0 ? left(at0) : at0;
      const L = (brow ? 0.2 : 0.26 - 0.03 * (q - 2)) * (s.len / 3);
      const dir = unit(add(scale(at.n, 0.7), [0, -0.8, 0.2]));
      spikes.push(tube([sub(at.p, scale(at.n, 0.04)), add(at.p, scale(dir, L * 0.5)), add(at.p, scale(dir, L))], [L * 0.32, L * 0.18, 0.006], [L * 0.32, L * 0.18, 0.006], 5, 'hornDark', { seam: 'start' }));
    }
    parts.push(merge(...spikes));
    // A heavy bony brow over each small eye.
    parts.push(merge(...[1, -1].map((sd) => {
      const q0 = onRings(H, s.eye.y - 0.02, s.eye.up + s.eye.size * 2.4), q = sd > 0 ? q0 : left(q0);
      return orbAlong(sub(q.p, scale(q.n, s.eye.size * 0.5)), [0, 1, -0.25], [s.eye.size * 1.4, s.eye.size * 2.4, s.eye.size * 1.3], 6, 4, 'horn');
    })));
  }
  parts.push(eyesOf(s, shut));
  return merge(...parts);
}

/** Solids inside the head that hide what is round the far side of them: the skull and the snout. */
function headSolids(s: Clay): Array<{ c: V3; r: V3 }> {
  const H = s.head;
  return [
    { c: [0, H.y[2], H.z[2]], r: [H.w[2] * 0.85, (H.y[3] - H.y[0]) * 0.5, H.h[2] * 0.85] },
    { c: [0, (H.y[4] + H.y[6]) / 2, H.z[5]], r: [H.w[5] * 0.9, (H.y[6] - H.y[4]) / 2, H.h[5] * 0.85] },
    // And one in each ring between, following the head as it narrows, so nothing round the far side of the face shows through.
    ...H.y.slice(2, -1).map((y, q): { c: V3; r: V3 } => {
      const k = q + 2;
      return { c: [0, y, H.z[k]], r: [H.w[k] * 0.85, Math.max(0.02, (H.y[k + 1] - H.y[k - 1]) * 0.3), H.h[k] * 0.85] };
    }),
  ];
}

/** An ear: the Mudlet's a tall leaf, brown with rust inside; the Clayburrow's a broad rust fan; the Terramole's a curved horn, swept back. */
function earOf(s: Clay, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  if (E.kind === 'horn') {
    const pts = curve([0, 0, -0.04], [0, 0.06 * L, 0.55 * L], [0, -0.5 * L, 0.9 * L], 4);
    // A broad sweeping crescent, brown over a cream inside, so it reads past the plates behind it.
    return tube(pts, [w, w * 0.95, w * 0.78, w * 0.46, 0.01], [w * 0.62, w * 0.58, w * 0.46, w * 0.3, 0.01], n, (_r, j) => (under(n, j, 1.3) ? 'horn' : 'bark'), { seam: 'start' });
  }
  const shape = E.kind === 'pup' ? [w * 0.85, w, w * 0.86, w * 0.5, 0.02] : [w * 0.7, w, w * 0.92, w * 0.55, 0.02];
  return merge(
    // A thick cupped ear, so its inside is a broad patch of colour seen side on as well as face on.
    tube(curve([0, 0, -0.03], [0, 0.04, L * 0.5], [0, E.kind === 'pup' ? 0.02 : -0.06, L], 4), shape, w * 0.42, n, E.kind === 'pup' ? 'bark' : 'mark', { up: [0, 1, 0], seam: 'start' }),
    paint([disc([0, w * 0.44, L * 0.46], [0, 1, 0.08], w * 0.6, L * 0.33, 8, 'inner')]),
  );
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/**
 * A fore paw (the right; the left is its mirror): a broad paw of brown clay-caked fur and, out of the front of it, its claws,
 * each a thick curved blade reaching forward and down to the ground, dark grey: small on the Mudlet, huge on the others,
 * so the Clayburrow and the Terramole go on the backs of them.
 */
function forePaw(s: Clay, n: number, k: number): Mesh {
  const r = s.paw, d = s.fore[2], C = s.claw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.64], [0, 1, 0], [r * 1.05, r * 0.62, r * 1.08], n, k, 'bark');
  const claws = Array.from({ length: C.n }, (_, q) => {
    const f = C.n > 1 ? q / (C.n - 1) - 0.5 : 0, L = C.len * (1 - 0.3 * Math.abs(f) * 2 * 0.5);
    const root: V3 = [f * r * 1.2, r * 0.8, -d + r * 0.7];
    const tip: V3 = [f * r * 1.5, r * 0.8 + L * 0.95, -d + 0.02];
    const pts = curve(root, [f * r * 1.4, root[1] + L * 0.62, -d + r * 0.7 + L * 0.2], tip, 4);
    const cw = C.w;
    return tube(pts, [cw * 0.8, cw * 0.74, cw * 0.58, cw * 0.32, 0.012], [cw, cw * 0.94, cw * 0.74, cw * 0.42, 0.012], 6, (_ring, j) => (under(6, j, 1.3) ? 'stoneDark' : 'claw'), { seam: 'start' });
  });
  return merge(paw, ...claws);
}

/** A hind paw: smaller, brown, with short dark claws. */
function hindPaw(s: Clay, n: number, k: number): Mesh {
  const r = s.hindPaw, d = s.hind[2], L = s.hindClaw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.62], [0, 1, 0], [r, r * 0.6, r * 1.12], n, k, 'bark');
  const claws = [-1, 0, 1].map((f) => {
    const root: V3 = [f * r * 0.55, r * 1.0, -d + r * 0.45];
    const w = Math.max(0.03, L * 0.35);
    return tube(curve(root, [f * r * 0.65, root[1] + L * 0.6, root[2] + L * 0.05], [f * r * 0.75, root[1] + L, -d + 0.02], 2), [w * 0.7, w * 0.5, 0.008], [w, w * 0.7, 0.008], 5, 'claw', { seam: 'start' });
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

/** The Mudlet's coat: big bold patches of clay, rust and brown, on its back, its shoulders and its haunches. */
function splotches(s: Clay): Mesh {
  const B = s.body, out: Disc[] = [];
  const spots: Array<[number, number, number, Mat, number]> = [
    // along, round, size, colour, side
    [-0.42, 0.35, 0.2, 'bark', 1], [0.28, 0.25, 0.16, 'mark', 1], [-0.05, 1.15, 0.17, 'mark', 1],
    [-0.48, 0.55, 0.17, 'mark', -1], [0.2, 0.15, 0.13, 'bark', -1], [0.05, 0.75, 0.12, 'bark', -1],
  ];
  spots.forEach(([y, th, r, m, sd], q) => out.push(blot(B, y, th, r, m, 60 + q * 3, sd)));
  return paint(out);
}

/** The barrel as one solid, a little inside its skin: its middle and its half-sizes. */
function barrelSolid(s: Clay): { c: V3; r: V3 } {
  const B = s.body, y0 = B.y[0], y1 = B.y[B.y.length - 1];
  return { c: [0, (y0 + y1) / 2, 0], r: [Math.max(...B.w) * 0.9, ((y1 - y0) / 2) * 0.9, Math.max(...B.h) * 0.9] };
}

/** The legs, over the ones a body on four legs has: round, rooted up inside the body, and coloured by the stage's clay. */
function legPieces(s: Clay, n: number, k: number): Piece[] {
  const out: Piece[] = [];
  const mats = (fore: boolean): [Mat[], Mat[]] => {
    if (s.legs === 'socks') return [['coat', 'coat', 'coat'], ['coat', 'bark', 'bark']];
    if (s.legs === 'paws') return [['coat', 'coat', 'coat'], ['coat', 'coat', 'bark']];
    return [['coat', 'coat', 'bark'], ['coat', 'coat', 'bark']];
  };
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick);
    const [up, lo] = mats(fore);
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    // Its top well up inside the body and closed, rounded off, so nothing of it shows past the body as a fin or a hole.
    const upper = tube([0, 1, 2, 3, 4].map((q) => [0, 0, lerp(w * 0.5, -L[0], q / 4)] as V3), [w * 0.55, w * 1.0, w * 0.98, w * 0.84, w * 0.62], [w * 0.55, w * 0.96, w * 0.94, w * 0.8, w * 0.6], n, (ring) => up[Math.min(2, Math.max(0, ring - 1))], { seam: 'end' });
    // A hind shin's top well up past the knee into the thigh, so there is no notch at the back of the knee to see the ground through.
    const lap = w * (fore ? 0.25 : 0.55);
    // Tapering to the paw, so at the ankle it is no wider than the paw is high off the ground; a hind one, which trails flat
    // behind at the end of its stride, narrower still.
    const end = Math.min(w * 0.62, L[2] * (fore ? 1.05 : 0.85));
    const lower = tube([0, 1, 2, 3].map((q) => [0, 0.02 * (q / 3), lerp(lap, -L[1], q / 3)] as V3), [w * 0.5, w * 0.58, lerp(w * 0.56, end, 0.5), end], [w * 0.5, w * 0.58, lerp(w * 0.56, end, 0.5), end], n, (ring) => lo[Math.min(2, ring)], { seam: 'both' });
    const foot = fore ? forePaw(s, n, k) : hindPaw(s, n, k);
    // The Terramole's forearms armoured: a plate of baked clay down the outside of each.
    if (fore && s.legs === 'bands') {
      const plate = plateMesh({ root: [side * w * 0.5, w * 0.12, -L[1] * 0.42], n: unit([side, 0.35, 0.1]), back: [0, 0, -1], a: L[1] * 0.42, b: w * 0.62, t: w * 0.12, lift: w * 0.06, tone: 'rust', id: side > 0 ? 31 : 37 });
      out.push({ key: `${key}a`, mesh: plate, bone: `${key}1`, bias: 0.025, after: [`${key}1`], front, hide: [barrelSolid(s)], hideIn: 'trunk' });
    }
    // A hind leg's haunch: a round bulge of muscle over the top of the thigh, so the back half carries as much weight as the
    // front; biggest on the Terramole, whose back half holds up the most.
    const hk = s.legs === 'bands' ? 1 : 0.86;
    const thigh = fore ? upper : merge(upper, orbAlong([-side * w * 0.04, -w * 0.04, -L[0] * 0.18], [0, 0, 1], [w * 1.14 * hk, w * 1.02 * hk, w * 1.02 * hk], n, k, up[0]));
    // A fore paw thrown up in a strike can come round behind the barrel, seen from behind, while its own front still faces the
    // viewer: whatever of it is behind the barrel is hidden by it, rather than drawn over the rump.
    const hide = fore ? [barrelSolid(s)] : undefined, hideIn = fore ? 'trunk' : undefined;
    out.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, under: 'body', convex: fore },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: 'body', front, convex: fore, hide, hideIn },
      { key: `${key}2`, mesh: side < 0 ? mirror(foot) : foot, bone: `${key}2`, bias: 0.03, after: 'body', front, hide, hideIn },
    );
  }
  return out;
}
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/** A stage's pieces: a body on four legs with its own head, ears, paws and claws, and its plates, pots and leaves. */
function clayBuild(s: Clay, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6);
  const B = s.body, skull = headSolids(s)[0];
  const R = domed(B);
  // Under the plates, a shell of brown clay over its back and down its flanks as far as they go; cream fur under it.
  const shell = s.plates ? Math.sin(Math.PI / 2 - s.plates.spread - 0.08) : 2;
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, n,
    (ring, j) => (ring > 1 && ring < R.y.length - 3 && under(n, j, 0.9) ? 'belly' : Math.sin(((j + 1) / n) * TAU) > shell && ring > 0 && ring < R.y.length - 1 ? 'shellDark' : 'coat'));
  // Its underside tucked in toward the belly, so seen from behind it is a dome on its legs rather than a box.
  const body = mesh(barrel.v.map((p, i) => {
    const q = Math.min(R.y.length - 1, Math.floor(i / n)), t = clamp((R.z[q] - p[2]) / R.h[q]);
    // Rounded in under it, more the bigger the belly, so its underside is a curve and not a flat plane with corners.
    const k = s.plates ? 0.34 : 0.22;
    return [p[0] * (1 - k * t * t), p[1], p[2] + R.h[q] * 0.08 * t * t] as V3;
  }), barrel.f);
  // A cream bib on the chest under the head.
  const bib = orbAlong([0, B.y[5] + 0.02, B.z[5] - B.h[5] * 0.36], [0, 1, -0.5], [B.w[5] * 0.68, B.h[5] * 0.5, B.h[5] * 0.36], n, k, 'belly');
  const extras: Piece[] = [];
  const plates = platesOf(s);
  if (plates.length) {
    const G = rattleOf(plates.map((P) => ({ mesh: plateMesh(P), root: P.root, id: P.id })));
    extras.push({ key: 'plates', mesh: G.mesh, bone: 'trunk', bias: 0.1, after: ['body'], sheen: 'ember', bent: rattling(s, G, false) });
  }
  const pots = potsOf(s, n);
  if (pots.length) {
    const G = rattleOf(pots);
    extras.push({ key: 'pots', mesh: G.mesh, bone: 'trunk', bias: 0.14, after: ['body', 'plates'], bent: rattling(s, G, true) });
  }
  const fringe = fringeOf(s);
  if (fringe) extras.push({ key: 'fringe', mesh: fringe, bone: 'trunk', bias: 0.05, after: ['body'] });
  const drips = dripsOf(s, cut(lod, 5, 6));
  if (drips) extras.push({ key: 'drips', mesh: drips, bone: 'trunk', bias: 0.04, after: ['body'] });
  const tailW = s.tail.w, tailL = s.tail.len;
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.85, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: s.ear.kind === 'horn' ? 0 : s.ear.kind === 'pup' ? -48 : -36,
    tail: [merge(
      tube(curve([0, 0.04, 0], [0, -tailL * 0.5, 0.03], [0, -tailL, -0.02], 2), [tailW, tailW * 0.8, tailW * 0.3], [tailW * 0.9, tailW * 0.72, tailW * 0.3], 5, s.face === 'pup' ? 'bark' : 'coat', { seam: 'start' }),
      // The pup's ends in a little fan of tufts.
      s.face === 'pup' && merge(...[-1, 0, 1].map((q) => tube([[0, -tailL * 0.7, 0], [q * tailW * 0.9, -tailL * 1.45, tailW * (0.5 - 0.3 * Math.abs(q))]], [tailW * 0.5, 0.008], [tailW * 0.42, 0.008], 5, 'bark', { seam: 'start' })))
    )],
    fore: { upper: [0, -s.fore[0], s.thick, s.thick], lower: [0, -s.fore[1], s.thick, s.thick], foot: forePaw(s, n, k) },
    hind: { upper: [0, -s.hind[0], s.thick, s.thick], lower: [0, -s.hind[1], s.thick, s.thick], foot: hindPaw(s, n, k) },
    breath: 0.035,
    extras,
  }).filter((pc) => !/^(fl|fr|hl|hr)[012]$/.test(pc.key));
  pieces.push(...legPieces(s, n, k));
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(body, bib, s.splotch && splotches(s)) };
    // Under a shell, the top of its neck brown clay like the shell's, so no cream shows between its ears from in front; its
    // throat cream. The neck's own down is along its frame's y.
    if (pc.key === 'neck' && s.plates) {
      const nw = s.neck.w, nh = s.neck.w * 0.85, nl = s.neck.len;
      return { ...pc, mesh: tube([[0, 0, -0.3], [0, 0, nl * 0.5], [0, 0.05, nl]], nw, nh, n, (_r, j) => (Math.sin(((j + 1) / n) * TAU) < -0.15 ? 'shellDark' : 'coat'), { seam: 'both' }) };
    }
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

/** Wet clay: rust-orange, darker brown, and the pale rim of a fresh-cut lump. */
const CLAY_RGB: RGB = [206, 104, 56];
const MUD_RGB: RGB = [132, 82, 54];
const TEAL_RGB: RGB = [72, 178, 172];
/** Dust off dry clay, pale and warm: seen against grass and against the clay of its back. */
const DUST_RGB: RGB = [226, 196, 160];
const css = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Clayburrow's: less than in proportion on the small one, so they still read. */
const bigness = (s: Clay): number => 0.4 + 0.6 * (s.len / 1.8);
/**
 * A lump of wet clay: a rounded blob of the clay's colour, a lighter face toward the light and a dark rim, drawn whole; it
 * goes by shrinking rather than fading, so lumps over each other never show through one another.
 */
function lump(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB): void {
  if (r <= 0.02) return;
  g.beginPath();
  for (let q = 0; q < 7; q++) {
    const t = ang + (q / 7) * TAU, k = r * (0.82 + 0.22 * Math.sin(q * 2.3 + ang * 1.7));
    if (q) g.lineTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.86);
    else g.moveTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.86);
  }
  g.closePath();
  g.fillStyle = css(c);
  g.fill();
  g.lineWidth = Math.max(0.05, r * 0.22);
  g.strokeStyle = css(mix(c, [50, 28, 22], 0.55));
  g.stroke();
  g.beginPath();
  g.ellipse(x - r * 0.25, y - r * 0.28, r * 0.42, r * 0.26, -0.5, 0, TAU);
  g.fillStyle = css(mix(c, [255, 236, 210], 0.38));
  g.fill();
}

/** A splat of mud on the ground: a flattened blob and a few drops round it, shrinking away by `k`. */
function splat(g: CanvasRenderingContext2D, view: View, at: V3, r: number, k: number, c: RGB, id: number): void {
  if (k <= 0.02) return;
  const [x, y] = onScreen(view, [at[0], at[1], 0.01]);
  const rr = r * k;
  g.fillStyle = css(mix(c, [60, 36, 26], 0.25));
  g.beginPath();
  g.ellipse(x, y, rr, rr * 0.45, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(mix(c, [255, 230, 200], 0.15));
  g.beginPath();
  g.ellipse(x - rr * 0.2, y - rr * 0.08, rr * 0.5, rr * 0.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = css(mix(c, [60, 36, 26], 0.25));
  for (let q = 0; q < 4; q++) {
    const a = jitter(id + q) * TAU, d = rr * (1.25 + 0.4 * jitter(id + q + 7));
    g.beginPath();
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.45, rr * 0.16, 0, TAU);
    g.fill();
  }
}

/**
 * A puff of dust: one cloud of four lobes of different sizes run together, under one ragged outline, paler on its upper side; it goes
 * by shrinking rather than fading, lightening as it goes, so puffs over each other read as one cloud and never show through.
 */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, k: number, id = 0): void {
  r *= 0.75;
  if (r <= 0.02) return;
  const [x, y] = onScreen(view, at);
  const c = mix(DUST_RGB, [250, 242, 228], 0.25 + 0.75 * clamp(k)), edge = mix(c, [150, 128, 108], 0.3);
  // The middle lobe the biggest, the rest overlapping it, each 0.5 to 1 of it across.
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
  // Its sunlit upper side: the same lobes smaller and up toward the light, paler.
  g.fillStyle = css(mix(c, [255, 252, 244], 0.5));
  outline(0, 0.66, 0.5);
  g.fill();
}

/** A chip in the air: a flat angular flake, light over its upper half and dark under, with a dark edge; a teal one with a glint. */
function chip(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB, glaze = false): void {
  if (len <= 0.02) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(-len * 0.1, -len * 0.3);
  g.lineTo(len / 2, -len * 0.05);
  g.lineTo(len * 0.1, len * 0.26);
  g.closePath();
  g.fillStyle = css(mix(c, [40, 26, 22], 0.2));
  g.fill();
  g.lineWidth = len * 0.08;
  g.strokeStyle = css(mix(c, [40, 26, 22], 0.55));
  g.stroke();
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(-len * 0.1, -len * 0.3);
  g.lineTo(len / 2, -len * 0.05);
  g.closePath();
  g.fillStyle = css(mix(c, [255, 244, 228], glaze ? 0.45 : 0.25));
  g.fill();
  if (glaze) {
    g.fillStyle = 'rgb(255,253,244)';
    g.beginPath();
    g.arc(-len * 0.08, -len * 0.1, len * 0.1, 0, TAU);
    g.fill();
  }
  g.restore();
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
      g.fillStyle = pass ? 'rgb(255,250,238)' : 'rgb(232,140,84)';
      g.fill();
    }
  }
  g.restore();
}

/**
 * The strike: where each blow lands, claw streaks in the air in front of the paw (not from behind, where they would be drawn
 * over its back), clay chunks knocked up off the ground and a puff of dust; and for the Terramole's slam, the ground
 * cracked, a ring of dust going out over it, and a burst of clay chunks and teal glaze thrown up high, over its back so it is
 * seen from behind. Each thing sorted in front of the body or behind it, as it is.
 */
/** The body's frame at a blow, along the ground: its trunk, as it was posed when the blow landed. */
const at0 = (b: Bones): Bones[string] => b.trunk;

function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Clay, b: Bones, hits: Bones[], R: Rest, t: number, front: boolean): void {
  const big = bigness(s), hs = CLAY_HITS[s.strike];
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
        streaks(g, view, add(tip, [0, 0, (s.strike ? 0.7 : 0.45) * big]), fwd, (s.strike ? 2.2 : 1.6) * big, sweep, k, key === 'fl2' ? -1 : 1);
      }
      // Clay chunks knocked up off the ground where the claws come down, a few of them teal, and a puff of dust.
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
          if (c % 4 === 3) chip(g, x, y, 0.42 * big * k, id + since * 12, TEAL_RGB, true);
          else lump(g, x, y, (0.16 + 0.08 * jitter(id + 4)) * big * k, id, c % 2 ? CLAY_RGB : MUD_RGB);
        }
        const dustAt: V3 = [tip[0], tip[1], 0.15 * big];
        if (nearSide(dustAt, mid, view) === front) {
          const grow = ramp(since, 0, 0.08), gone = 1 - ramp(since, 0.08, 0.28);
          puff(g, view, dustAt, (0.5 + 0.5 * grow) * big * gone * (s.strike === 2 ? 1.6 : 1), since * 3, q + 3);
        }
      }
    }
    // Dust bursting out from under it on both sides as the blow lands, past its flanks: seen from behind as well as in front.
    if (since > 0 && since < 0.42) {
      const k = s.strike === 2 ? 1 : 0.6;
      for (const sd of [-1, 1]) {
        const at = place(at0(hits[q]), [sd * s.body.w[3] * 1.15, s.len * 0.3, 0]);
        const p: V3 = [at[0] + sd * big * 0.8 * k * ramp(since, 0, 0.3), at[1], (0.3 + 0.6 * ramp(since, 0, 0.3)) * big * k];
        if (nearSide(p, mid, view) === front) puff(g, view, p, big * k * (0.6 + 0.6 * ramp(since, 0, 0.12)) * (1 - ramp(since, 0.18, 0.4)), since * 3, sd + 5 + q);
      }
    }
    if (s.strike !== 2 || since < 0) return;
    // The slam: the ground cracked under the paws, a ring of dust going out over it, and clay thrown up high.
    const ground = scale(add(place(at.fl2, R.tip), place(at.fr2, R.tip)), 0.5);
    ground[2] = 0.02;
    const [gx, gy] = onScreen(view, ground);
    if (!front) {
      const k = 1 - ramp(since, 0.3, 0.5);
      g.save();
      g.strokeStyle = 'rgb(84,50,34)';
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
        // Thrown wide and high, out past its flanks and up over its back, so it is seen from every side.
        // From under each paw, out past that flank fast: the act is over a quarter second after the slam.
        const sd = c % 2 ? 1 : -1, paw = place(at[sd > 0 ? 'fr2' : 'fl2'], R.tip);
        const v: V3 = [sd * (5 + 5 * jitter(id + 1)), Math.sin(th) * (2.5 + 2 * jitter(id + 2)), 7 + 4 * jitter(id + 3)];
        if (dot(v, view.T) > 0) v[2] += 2;
        const p = thrown([paw[0], paw[1], 0.15], v, since, 13);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        if (c % 4 === 0) chip(g, x, y, 0.55 * big * k, id + since * 10, TEAL_RGB, true);
        else lump(g, x, y, (0.2 + 0.1 * jitter(id + 4)) * big * k, id, c % 2 ? CLAY_RGB : MUD_RGB);
      }
    }
  });
}

/**
 * Digging: under its fore paws the hole it digs, dark wet clay with a rim of lumps; at each stroke, as the claws come out of
 * the clay, clods of wet clay flung back under and past its hind legs on either side, high enough to be seen over its back
 * from behind, splatting where they land; a puff where its snout goes into the hole; and the lump of clay its paw lifts out,
 * held up, tossed aside, landing with a splat and lying there a moment. A go played once throws nothing until its first
 * stroke.
 */
function digSpray(g: CanvasRenderingContext2D, view: View, s: Clay, b: Bones, R: Rest, a: Anim, t: number, front: boolean, release: V3, at: (t: number) => Bones, crest: ReadonlyArray<[string, V3]>): void {
  const big = bigness(s), down = downOf(t, a.graze), mid = b.body.t;
  const top = R.h + Math.max(...s.body.h.map((h, q) => h + s.body.z[q])) + (s.plates ? s.plates.t * 2 : 0);
  // Along the ground under the body is the island's ground here: the body is never turned, and only carried forward by a strike.
  const hole: V3 = [0, holeOf(s, R)[1] - 0.15 * s.paw, 0.01];
  if (!front) {
    const [x, y] = onScreen(view, hole);
    const r = (s.paw * 2.2 + s.claw.len * 0.7) * down;
    g.fillStyle = css(mix(MUD_RGB, [50, 30, 22], 0.4));
    g.beginPath();
    g.ellipse(x, y, r * 1.5, r * 0.62, 0, 0, TAU);
    g.fill();
    for (let q = 0; q < 6; q++) {
      const ox = (jitter(q + 60) - 0.5) * 2.6 * r, oy = (jitter(q + 61) - 0.5) * 0.9 * r;
      lump(g, x + ox, y + oy, 0.16 * big * down, q * 2.1, q % 2 ? CLAY_RGB : MUD_RGB);
    }
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
  const { fling } = DIG_STROKE;
  for (let k = 0; k < s.digs; k++) {
    const t0 = ((k + fling - 0.06) / s.digs) * s.work.dig;
    if (t < t0 && a.graze < 0.5) continue;
    const since = frac(t - t0) * ACT_SECS.work;
    if (since > 0.75) continue;
    const sd = k % 2 ? -1 : 1;
    // From the claws of the paw that dug it, at the ground, as they flick the clay back.
    const claws = place(at(frac(t0))[k % 2 ? 'fl2' : 'fr2'], R.tip);
    const many = 7 + 2 * s.strike;
    for (let q = 0; q < many; q++) {
      const id = q * 5 + k * 23;
      const late = q % 3 === 2 ? 0.05 : 0;
      if (since < late) continue;
      const side = sd * (q % 3 === 1 ? -0.6 : 1);
      // Back under it and out between and past its hind legs, some low along the ground and some lobbed up over its rump, so
      // they are seen coming out behind it from behind; and a few out past its flank on the digging side.
      const high = q % 2 === 0, wide = q % 4 === 3;
      // Thrown toward a viewer behind it, a lobbed one goes higher, up clear over its rump rather than low across its back.
      const apex = top * (high ? 0.7 + 0.45 * jitter(id + 2) + (toward ? 0.6 : 0) : 0.12 + 0.12 * jitter(id + 2));
      const k0 = Math.sqrt(top) * (s.strike === 2 ? 1.25 : 1);
      // Toward that viewer they fan out to either side too, so they are seen to come out past its flanks.
      const out = wide ? 1.4 + jitter(id) : toward ? 0.8 + 0.6 * jitter(id) : 0.15 + 0.35 * jitter(id);
      const v: V3 = [side * k0 * out, -k0 * (2.6 + 1.6 * jitter(id + 1)), Math.sqrt(2 * 9 * apex)];
      // and quicker, the same arc in less time, so they are up and out past its outline while the stroke that threw them goes on.
      const p = thrown([claws[0], claws[1], 0.08], v, (since - late) * (toward ? 2 : 1));
      // And coming toward that viewer it is drawn behind the body while it is over it on the screen, and in front once it is
      // above its outline there (its back, its ears, its pots), out past its side or below its belly between its hind legs,
      // rather than smudged over its back.
      let clear = !toward;
      if (!clear) {
        const [sx, sy] = onScreen(view, p);
        clear = sx < x0 - strip * 0.5 || sx > x1 + strip * 0.5 || sy < outlineAt(sx) - strip * 0.3 || sy > bellyAt(sx) + strip * 0.3;
      }
      if ((nearSide(p, mid, view) && clear) !== front) continue;
      const landed = p[2] <= 0.025;
      const k2 = 1 - smooth((since - 0.45) / 0.3);
      if (landed) {
        if (!front) splat(g, view, p, 0.32 * big, k2, q % 2 ? CLAY_RGB : MUD_RGB, id);
      } else {
        const [x, y] = onScreen(view, p);
        lump(g, x, y, (0.15 + 0.1 * jitter(id + 3)) * big * (s.strike === 2 ? 1.3 : s.strike === 0 ? 1.35 : 1), id + since * 6, q % 2 ? CLAY_RGB : MUD_RGB);
      }
    }
  }
  // A puff of clay dust where its snout goes into the hole, sorted with the body like everything else.
  {
    for (const c of [s.work.dig + 0.05]) {
      const since = (t - c) * ACT_SECS.work;
      if (since < 0 || since > 0.3) continue;
      const nose = place(b.head, R.nose);
      const p: V3 = [nose[0], nose[1] + 0.05, 0.1 * big];
      if (nearSide(p, mid, view) === front) puff(g, view, p, 0.35 * big * (0.6 + ramp(since, 0, 0.1)) * (1 - ramp(since, 0.12, 0.3)), since * 2, 7);
    }
  }
  // The lump: in the claws of the right paw from when they go into the clay until it is tossed; then thrown out to the side,
  // landing with a splat, lying, and gone. In a loop, last go's lump is still lying there as the next begins.
  const tipNow = place(b.fr2, R.tip);
  const r = (0.34 + 0.1 * s.strike) * big;
  if (t >= s.work.scoop && t < s.work.toss) {
    const grow = ramp(t, s.work.scoop, s.work.scoop + 0.04);
    const p: V3 = [tipNow[0], tipNow[1] - s.claw.len * 0.1, tipNow[2] + r * 0.45 * grow];
    if (nearSide(p, mid, view) === front) {
      const [x, y] = onScreen(view, p);
      lump(g, x, y, r * grow, 1.3, CLAY_RGB);
    }
  }
  const tossed = (t >= s.work.toss || a.graze >= 0.5) ? frac(t - s.work.toss) * ACT_SECS.work : -1;
  if (tossed >= 0 && tossed < 1.1) {
    // Thrown from where the paw held it as it let go, out to its right and a little back, landing `WORK_LAND` seconds on.
    const p0: V3 = [release[0], release[1], release[2] + r * 0.45];
    const dt = WORK_LAND;
    const v: V3 = [(s.body.w[4] * 1.1 + s.len * 0.3) / dt, (-s.len * 0.15 - s.paw) / dt, (0.02 - p0[2] + 0.5 * 9 * dt * dt) / dt];
    const p = thrown(p0, v, Math.min(tossed, dt), 9);
    const lying = tossed >= dt, k = 1 - smooth((tossed - 0.7) / 0.35);
    if (nearSide(p, mid, view) === front || (lying && !front)) {
      if (lying) {
        if (!front) {
          splat(g, view, p, r * 1.2, k * (1 - 0.3 * ramp(tossed, dt, dt + 0.1)), MUD_RGB, 77);
          const [x, y] = onScreen(view, p);
          lump(g, x, y - r * 0.3 * k, r * k * (1 - 0.15 * hump(tossed, dt + 0.03, 0.05)), 1.3, CLAY_RGB);
        }
      } else {
        const [x, y] = onScreen(view, p);
        lump(g, x, y, r, 1.3 + tossed * 9, CLAY_RGB);
      }
    }
  }
}

/**
 * Evolving: at the start a burst of clay chips and teal glaze out of its back, which covers the moment it changes into its new
 * body; then a swirl of chips and flecks going round and up it as its plates form; and on the Terramole a puff of dust as each
 * pot comes up out of its back.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Clay, b: Bones, t: number, front: boolean): void {
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
      if (q % 3 === 0) chip(g, x, y, 0.8 * big * burst, q * 1.3 + since * 8, TEAL_RGB, true);
      else chip(g, x, y, 0.9 * big * burst, q * 1.3 + since * 8, q % 3 === 1 ? CLAY_RGB : MUD_RGB);
    }
  }
  // The swirl: chips and flecks going round it and up, as its plates form.
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
      if (q % 3 === 0) chip(g, x, y, 0.5 * big * k, ang * 2, TEAL_RGB, true);
      else chip(g, x, y, 0.55 * big * k, ang * 2 + q, q % 2 ? CLAY_RGB : MUD_RGB);
    }
  }
  // Each pot coming up out of its back with a puff of dust.
  if (s.pots && front) {
    for (const [y, th] of [[0.15, 1.7], [-0.75, 1.3], [-0.55, 2.0]].slice(0, s.pots)) {
      const at = onRings(s.body, y, th);
      const p = place(b.trunk, add(at.p, scale(at.n, 0.2)));
      const k = hump(t, 0.4 + 0.05 * y, 0.12);
      if (k > 0) puff(g, view, p, 0.5 * big * k, 1 - k, Math.round(y * 10));
    }
  }
}

/**
 * The warm flash at the claws where each blow lands, drawn with the body rather than over all of it: in front of it when the
 * claws are on the viewer's side of it, and behind it, where the body covers it, when they are round the far side.
 */
function blowFlash(g: CanvasRenderingContext2D, view: View, s: Clay, b: Bones, R: Rest, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t;
  g.save();
  g.globalCompositeOperation = 'lighter';
  CLAY_HITS[s.strike].forEach((h, q) => {
    const k = hump(t, h + 0.02, 0.1);
    if (k <= 0) return;
    const keys = s.strike === 2 ? ['fl2', 'fr2'] : s.strike === 1 ? [q ? 'fr2' : 'fl2'] : ['fr2'];
    for (const key of keys) {
      const p = place(b[key], R.tip);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p), r = (0.8 + 0.4 * s.strike) * big, al = 0.35 * k;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,214,170,${al})`);
      grad.addColorStop(0.45, `rgba(255,214,170,${al * 0.35})`);
      grad.addColorStop(1, 'rgba(255,214,170,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  g.restore();
}

/** Light over the whole of it as it evolves: a terracotta glow as it begins, and over its back at the turn (a blow's flash is `blowFlash`). */
function clayGlow(s: Clay, b: Bones, R: Rest, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind === 'evolve') {
    const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
    const open = 1 - ramp(act.t, 0.02, 0.1);
    if (open > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 0.6]), r: s.body.y[6] - s.body.y[0], c: [255, 170, 120], a: 0.6 * open });
    const k = 0.22 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.35 * hump(act.t, 0.5, 0.08);
    if (k > 0) out.push({ p: place(b.trunk, [0, s.body.y[3], s.body.h[3] * 1.4]), r: s.len * 0.9 + 0.5, c: [255, 186, 140], a: k });
    return out;
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A colour pushed further from its own grey, a fifth again: rust rather than salmon. */
const richer = (c: RGB, k = 1.25): RGB => {
  const m = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => clamp(m + (x - m) * k, 0, 255)) as RGB;
};

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, digs and evolves. */
function clayKind(s: Clay): Kind {
  const bones = clayBones(s);
  const spec = specOf(s), R = restOf(s, spec);
  const atHits = (a: Anim): Bones[] => CLAY_HITS[s.strike].map((t) => bones({ ...a, act: { kind: 'strike', t } }));
  /** Where the lump is let go of, tossed aside: its claw tip at the toss. */
  const release = (a: Anim): V3 => place(bones({ ...a, act: { kind: 'work', t: s.work.toss } }).fr2, R.tip);
  /**
   * The top of everything on it but its legs, as a few points on their bones: the highest corners of each piece as it stands
   * (its back, its head and ears, its pots), so its outline on the screen can be found as it is posed. Worked out once.
   */
  let crest: Array<[string, V3]> | undefined;
  const crestOf = (): Array<[string, V3]> => {
    if (!crest) {
      const b = bones({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
      crest = [];
      for (const pc of clayBuild(s, 0)) {
        if (/^[fh][lr]/.test(pc.key) || !b[pc.bone]) continue;
        const v = [...pc.mesh.v].sort((p, q) => place(b[pc.bone], q)[2] - place(b[pc.bone], p)[2]);
        for (let i = 0; i < Math.min(v.length, 48); i += 1) crest.push([pc.bone, v[i]]);
        // And the underside of its barrel, which a clod thrown out low between its hind legs is seen under.
        if (pc.key === 'body') for (let i = Math.max(0, v.length - 48); i < v.length; i++) crest.push([`-${pc.bone}`, v[i]]);
      }
    }
    return crest;
  };
  return {
    bones,
    build: (lod) => clayBuild(s, lod),
    // The variant's coat for its fur, a pale cream; its markings for its clay, the rust of its plates and patches and, darker,
    // the brown of its mud; teal glaze, dark grey claws and a sage sprout on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, [252, 246, 234], 0.1), clay = richer(mark, 1.18), mud = mix(clay, [72, 44, 30], 0.42);
      const pot = mix(clay, [214, 116, 70], 0.4);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [150, 118, 96], 0.3),
        coatLight: mix(fur, [255, 252, 244], 0.4),
        mark: clay,
        belly: mix(fur, [255, 250, 240], 0.3),
        muzzle: mix(fur, [255, 250, 240], 0.4),
        lid: [76, 48, 42],
        nose: [176, 108, 100],
        pad: [92, 52, 48],
        // Inside its ears the rust of its clay, a little lighter: a dark inside reads from in front as a pair of eyes on its shell.
        inner: s.ear.kind === 'pup' ? mix(clay, [240, 150, 100], 0.3) : mix(clay, [255, 222, 190], 0.18),
        eye: [34, 24, 28],
        hoof: [92, 58, 52],
        claw: [100, 98, 106],
        stoneDark: [64, 62, 70],
        horn: [240, 232, 212],
        hornDark: [196, 182, 160],
        tooth: [250, 246, 234],
        crystal: clay,
        crystalDark: mix(clay, [96, 34, 18], 0.4),
        ember: mix(clay, [255, 218, 180], 0.32),
        shell: mud,
        shellDark: mix(mud, [44, 26, 20], 0.35),
        bark: mud,
        water: [76, 180, 174],
        scale: [42, 128, 130],
        gem: [124, 206, 196],
        leather: pot,
        leatherDark: mix(pot, [96, 40, 24], 0.4),
        leatherLit: mix(pot, [255, 220, 186], 0.3),
        grip: [64, 36, 28],
        leaf: [140, 186, 104],
        leafDark: [96, 148, 84],
        stem: [112, 152, 86],
        moss: [76, 172, 142],
        membrane: [44, 124, 108],
      }, 30);
    },
    shadow: [s.len * 0.75 + 0.2, s.body.w[4] * 1.0],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are terracotta and teal, its clay's and its glaze's colours.
    motes: [[214, 108, 58], [76, 186, 176]],
    glow: (b, a) => clayGlow(s, b, R, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') {
        strikeBurst(g, view, s, b, atHits(a), R, act.t, front);
        blowFlash(g, view, s, b, R, act.t, front);
      }
      else if (act.kind === 'work') digSpray(g, view, s, b, R, a, act.t, front, release(a), (t) => bones({ ...a, act: { kind: 'work', t } }), crestOf());
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const MUDLET = clayKind(MUDLET_LOOK);
export const CLAYBURROW = clayKind(CLAYBURROW_LOOK);
export const TERRAMOLE = clayKind(TERRAMOLE_LOOK);
