import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, lifted, merge, mix, orbAlong, paint,
  quadBones, quadPose, scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
  type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The badger line: the Dirtlet, a small round badger kit, brown and earthy,
 * its face striped black and white, a mat of moss and leaves on its back,
 * rough stones on its shoulders and haunches and a leaf sprouting from its
 * head; which grows into the Tunnelclaw, bigger and stocky and low, dark,
 * a white stripe down its face, armoured in mossy stone plates over its
 * shoulders, haunches and forelegs, leaves growing along its back and big
 * pale digging claws; and then the Earthrend, a huge heavy badger, long and
 * low, its back a mound of mossy boulders and leaves like a hillside, massive
 * claws, and a determined face under a dark brow. The species is still
 * `snout` underneath, as saves and the database know it: the seeker, that
 * finds buried relics and marks dig sites.
 *
 * Built the way the clay line is (`./wild-clay`): one set of functions from a
 * description of the stage (`Badger`), every foot given a point on the
 * ground to be at and its leg bent to reach it, the knee always the same way
 * round, so a foot on the ground stays where it was put. It walks four beats
 * with its barrel rolling onto each fore foot, a waddle. At its task it
 * snuffles along the ground with its nose sweeping, digs with its fore claws,
 * flicking the dirt back past its hind legs, pushes its nose into the hole,
 * and marks the spot with a stamp and a scrape of its right paw.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }
type HeadRings = Rings & { pitch: number };

interface Badger {
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
  /**
   * Its face's markings, as the sine of how far up round the head each edge is: the white stripe down the middle of its face
   * above `stripe`, the dark band through its eye above `band`, its white cheek above `cheek`; and from how far back along the
   * head (a share of its length) the band and the cheek begin, the fur behind them.
   */
  mask: { stripe: number; band: number; cheek: number; back: number };
  nose: number;
  /** The eye: how far along the head, how far up round it (radians from the side), its size, how tall, and how heavy the brow over it. */
  eye: { y: number; up: number; size: number; tall: number; lid: number };
  /** Its ears: how long, how wide, how far turned out and swept back, and where on the head (along its back, up round it). */
  ear: { len: number; w: number; out: number; back: number; at: [number, number] };
  /** The mossy plates down its back, in rows from the shoulders to the rump; how big, how thick, how far the back edge stands up. */
  plates: { from: number; to: number; rows: number; per: number; spread: number; a: number; b: number; t: number; lift: number };
  /** The stones on its shoulders and haunches, how big; and whether its forearms and thighs are armoured with them too. */
  stones: number;
  legStones: boolean;
  /** Leaves along its back: how many, how long, from how far forward to how far back. */
  leaves: { n: number; len: number; from: number; to: number };
  /** The leaf sprouting from its head, how tall; nought for none. */
  sprout: number;
  /** Boulders heaped on its back, how many: the Earthrend's hillside. */
  mound: number;
  tail: { len: number; w: number; lift: number; leaves: number };
  /**
   * How it goes: how far its body drops at each footfall (units), a walk's and a run's; how much of a stride a foot is down;
   * how far a leg swings (degrees); how high a foot is lifted; how far the barrel rolls and the head nods and swings; and how
   * much what is on its back stirs.
   */
  gait: { bob: [number, number]; duty: [number, number]; swing: [number, number]; step: number; roll: number; nod: number; sway: number; jiggle: number };
  /** Its strike: a pounce and swipe, a rake of both fore claws, or reared up and slammed down. */
  strike: 0 | 1 | 2;
  /** Strokes of its fore claws to a go at its task, the two paws in turn. */
  digs: number;
  /** Its go at its task, in time (`Work`). */
  work: Work;
  size: number;
}

/** A Dirtlet: a small round badger kit, a striped face, a mat of moss and leaves on its back, stones on its haunches, a sprout on its head. */
const DIRTLET_LOOK: Badger = {
  stage: 0,
  body: { y: [-0.86, -0.72, -0.4, 0, 0.4, 0.64, 0.76], z: [-0.04, -0.01, 0.02, 0.04, 0.06, 0.06, 0.04], w: [0.36, 0.62, 0.74, 0.76, 0.72, 0.6, 0.32], h: [0.21, 0.35, 0.42, 0.43, 0.42, 0.35, 0.2] },
  len: 1.0,
  fore: [0.12, 0.11, 0.07], hind: [0.12, 0.11, 0.07], thick: 0.22, hip: 0.56, hindThick: 1.08,
  stand: { fore: [0, 44], hind: [24, -60] },
  paw: 0.15, hindPaw: 0.14,
  claw: { n: 4, len: 0.12, w: 0.038 }, hindClaw: 0.07,
  neck: { at: [0, 0.6, 0.1], len: 0.12, w: 0.42, lean: 76 },
  head: {
    // A round face, full cheeks, and a short wedge of a muzzle out of the front of them to a big nose.
    y: [-0.37, -0.317, -0.194, -0.026, 0.132, 0.255, 0.352, 0.422, 0.466], z: [0.053, 0.062, 0.062, 0.035, 0, -0.035, -0.053, -0.07, -0.079],
    w: [0.092, 0.37, 0.48, 0.509, 0.451, 0.352, 0.246, 0.158, 0.088], h: [0.096, 0.374, 0.455, 0.466, 0.378, 0.273, 0.194, 0.132, 0.07], pitch: -4,
  },
  mask: { stripe: 0.93, band: 0.6, cheek: -0.6, back: 0.26 },
  nose: 0.068,
  eye: { y: 0.15, up: 0.74, size: 0.09, tall: 1.12, lid: 0 },
  ear: { len: 0.23, w: 0.19, out: 62, back: 18, at: [0.5, 1.05] },
  plates: { from: 0.46, to: -0.66, rows: 5, per: 4, spread: 0.8, a: 0.2, b: 0.19, t: 0.05, lift: 0.04 },
  stones: 0.2,
  legStones: false,
  leaves: { n: 7, len: 0.5, from: 0.46, to: -0.56 },
  sprout: 0.56,
  mound: 0,
  tail: { len: 0.18, w: 0.1, lift: 26, leaves: 0 },
  gait: { bob: [0.05, 0.06], duty: [0.58, 0.44], swing: [38, 42], step: 0.5, roll: 10, nod: 4, sway: 6, jiggle: 0.5 },
  strike: 0,
  digs: 3,
  work: { snuffle: 0.2, dig: 0.56, sniff: 0.66, mark: 0.8 },
  size: 3.8,
};

/** A Tunnelclaw: bigger, stocky and low, dark, a white stripe down its face, mossy stone plates and leaves along its back, big digging claws. */
const TUNNELCLAW_LOOK: Badger = {
  stage: 1,
  body: { y: [-1.4, -1.22, -0.7, -0.05, 0.62, 1.06, 1.24], z: [-0.2, -0.12, 0, 0.1, 0.18, 0.14, 0.04], w: [0.46, 0.8, 0.96, 0.98, 0.94, 0.76, 0.4], h: [0.24, 0.44, 0.6, 0.7, 0.74, 0.62, 0.32] },
  len: 2.1,
  fore: [0.22, 0.19, 0.1], hind: [0.22, 0.19, 0.1], thick: 0.34, hip: 0.66, hindThick: 1.06,
  stand: { fore: [10, 52], hind: [24, -64] },
  paw: 0.24, hindPaw: 0.19,
  claw: { n: 4, len: 0.34, w: 0.075 }, hindClaw: 0.13,
  neck: { at: [0, 1.04, 0.16], len: 0.26, w: 0.74, lean: 102 },
  head: {
    // A wedge: broad over the cheeks and tapering to the nose, flatter than it is wide.
    y: [-0.604, -0.46, -0.144, 0.184, 0.483, 0.736, 0.92, 1.035], z: [0.172, 0.201, 0.172, 0.086, 0, -0.057, -0.086, -0.101],
    w: [0.237, 0.822, 0.948, 0.854, 0.628, 0.425, 0.287, 0.172], h: [0.249, 0.773, 0.846, 0.699, 0.472, 0.299, 0.207, 0.127], pitch: -16,
  },
  mask: { stripe: 0.93, band: 0.6, cheek: -0.6, back: 0.2 },
  nose: 0.115,
  eye: { y: 0.17, up: 0.72, size: 0.105, tall: 1.0, lid: 0.25 },
  ear: { len: 0.42, w: 0.34, out: 56, back: 26, at: [0.55, 1.1] },
  plates: { from: 1.06, to: -1.25, rows: 6, per: 4, spread: 0.85, a: 0.36, b: 0.34, t: 0.07, lift: 0.05 },
  stones: 0.42,
  legStones: true,
  leaves: { n: 11, len: 0.85, from: 1.05, to: -1.05 },
  sprout: 0,
  mound: 0,
  tail: { len: 0.75, w: 0.2, lift: -12, leaves: 0 },
  gait: { bob: [0.08, 0.1], duty: [0.6, 0.5], swing: [36, 40], step: 0.42, roll: 9, nod: 3, sway: 5, jiggle: 0.45 },
  strike: 1,
  digs: 3,
  work: { snuffle: 0.2, dig: 0.56, sniff: 0.66, mark: 0.8 },
  size: 4.6,
};

/** An Earthrend: a huge heavy badger, long and low, its back a mound of mossy boulders and leaves, massive claws, a determined face. */
const EARTHREND_LOOK: Badger = {
  stage: 2,
  body: { y: [-3.2, -2.85, -1.8, 0, 1.55, 2.45, 2.8], z: [-0.2, -0.05, 0.2, 0.4, 0.5, 0.32, 0.06], w: [0.95, 1.6, 2.0, 2.05, 2.05, 1.72, 0.85], h: [0.46, 0.88, 1.3, 1.5, 1.52, 1.12, 0.48] },
  len: 5.2,
  fore: [0.7, 0.58, 0.34], hind: [0.66, 0.56, 0.32], thick: 1.24, hip: 0.64, hindThick: 0.96,
  stand: { fore: [10, 52], hind: [24, -62] },
  paw: 0.66, hindPaw: 0.54,
  claw: { n: 4, len: 1.0, w: 0.22 }, hindClaw: 0.3,
  neck: { at: [0, 2.4, 0.42], len: 0.6, w: 2.0, lean: 102 },
  head: {
    y: [-1.431, -1.077, -0.253, 0.701, 1.613, 2.385, 2.946, 3.311], z: [0.539, 0.623, 0.539, 0.287, 0.034, -0.118, -0.203, -0.218],
    w: [0.575, 2, 2.223, 1.926, 1.399, 0.954, 0.631, 0.378], h: [0.539, 1.789, 1.896, 1.545, 1.055, 0.645, 0.421, 0.253], pitch: -22,
  },
  mask: { stripe: 0.93, band: 0.6, cheek: -0.6, back: 0.2 },
  nose: 0.29,
  eye: { y: 0.51, up: 0.7, size: 0.24, tall: 0.92, lid: 0.38 },
  ear: { len: 1.2, w: 0.96, out: 56, back: 26, at: [0.55, 1.1] },
  plates: { from: 2.4, to: -2.85, rows: 7, per: 5, spread: 1.2, a: 0.74, b: 0.7, t: 0.12, lift: 0.08 },
  stones: 0.95,
  legStones: true,
  leaves: { n: 12, len: 2.0, from: 2.3, to: -2.3 },
  sprout: 0,
  mound: 5,
  tail: { len: 1.7, w: 0.62, lift: -6, leaves: 3 },
  gait: { bob: [0.2, 0.24], duty: [0.64, 0.54], swing: [30, 34], step: 0.32, roll: 7, nod: 2, sway: 6, jiggle: 0.3 },
  strike: 2,
  digs: 2,
  work: { snuffle: 0.2, dig: 0.56, sniff: 0.67, mark: 0.82 },
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

/** When each stage's blows land, as shares of its strike: the Dirtlet's swipe, the Tunnelclaw's two rakes, the Earthrend's slam. */
export const BADGER_HITS: ReadonlyArray<readonly number[]> = [[0.5], [0.45, 0.62], [0.58]];
/** Strokes of the fore claws to a go at its task, each stage's. */
export const BADGER_DIGS: readonly number[] = [DIRTLET_LOOK.digs, TUNNELCLAW_LOOK.digs, EARTHREND_LOOK.digs];
/** Each stage's go at its task, in time (`Work`). */
export const BADGER_WORK: readonly Work[] = [DIRTLET_LOOK.work, TUNNELCLAW_LOOK.work, EARTHREND_LOOK.work];
/**
 * A go at its task, as shares of it: nose down, it snuffles over the ground, its nose sweeping from side to side, until
 * `snuffle`; its claws dig from then until `dig`, the strokes evenly spread; it pushes its nose into the hole until `sniff`;
 * and its right paw comes up and is stamped down beside the hole at `mark`, scraped back to score the spot, and put back where
 * it stood by the end.
 */
export interface Work { snuffle: number; dig: number; sniff: number; mark: number }
/** A stroke of its claws, as shares of the stroke: reached forward until `bite`, dragged back through the dirt until `fling`. */
export const DIG_STROKE = { bite: 0.32, fling: 0.78 } as const;
/** How long its paw is scraped back after the stamp, as a share of a go. */
const SCRAPE = 0.07;

/* ---- its legs, by where its feet go ---------------------------------------------------------- */

/** How far a knee folds for a fold of one: the poses here give a knee in degrees, through this. */
const FOLD = 60;
const SIDE = [-1, 1, -1, 1];

/** A stage's body on four legs (`QuadSpec`). */
const specOf = (s: Badger): QuadSpec => ({
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
function restOf(s: Badger, spec: QuadSpec): Rest {
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

/** Where a fore paw's middle claw ends, in the foot's frame. */
const clawTip = (s: Badger): V3 => [0, s.paw * 0.8 + s.claw.len * 0.95, -s.fore[2] + 0.02];
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
 * a walk, the barrel rolling well over onto each fore foot as it takes the weight and the rump swinging the other way: a
 * waddle. At a run, the diagonals together.
 */
function goingPlan(s: Badger, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
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

/** A go at its task: how far its head is down at the ground (eased in and out of, unless it is already down). */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.9, 1)));

/** Which stroke of its claws it is at, and how far through it; and the paw making it, the right first. */
function strokeOf(s: Badger, t: number): { k: number; w: number; paw: number } | null {
  const W = s.work;
  if (t < W.snuffle || t >= W.dig) return null;
  const x = ((t - W.snuffle) / (W.dig - W.snuffle)) * s.digs, k = Math.min(s.digs - 1, Math.floor(x));
  return { k, w: x - k, paw: k % 2 ? 0 : 1 };
}
/** When stroke `k` of a go begins, as a share of the go. */
const strokeAt = (s: Badger, k: number): number => s.work.snuffle + ((s.work.dig - s.work.snuffle) * k) / s.digs;

/** Where the hole it digs is, along the ground: ahead of its fore paws' claws, between them, as far as a paw reaches. */
const holeOf = (s: Badger, R: Rest): V3 => [0, R.ankle[0][1] + R.tip[1] + (s.fore[0] + s.fore[1]) * 0.22, 0];
/** Where it marks the spot: beside the hole on its right, a little nearer. */
const markOf = (s: Badger, R: Rest): V3 => [restTip(R, 1)[0] * 1.35 + s.paw * 0.3, holeOf(s, R)[1] - s.claw.len * 0.3, 0];
/** How far a fore paw is pitched to dig, against a kit's: long claws are turned less, or the paw is lifted off the ground by them. */
const tilt = (s: Badger): number => clamp(0.13 / s.claw.len, 0.12, 1);

/**
 * The claw tip of a digging paw through a stroke, and how its foot is pitched: lifted and reached forward over the hole, struck
 * down into it, dragged back through the dirt to under its chest, and flicked up and back to where it stood.
 */
function digPath(s: Badger, R: Rest, i: number, w: number): { tip: V3; e: number } {
  const { bite, fling } = DIG_STROKE, home = restTip(R, i), hole = holeOf(s, R), k = tilt(s);
  const L = s.fore[0] + s.fore[1];
  const big = s.stage === 2;
  const into: V3 = [home[0] * 0.6, big ? lerp(home[1], hole[1], 0.7) : hole[1], 0.005];
  const back: V3 = [home[0] * 0.8, home[1] - L * (big ? 0.12 : 0.2), 0.005];
  const up = L * (s.stage === 0 ? 0.14 : 0.17);
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
 * The right paw marking the spot, at the end of a go: lifted up high in front of its chest, stamped down beside the hole at
 * `mark`, scraped back along the ground to score it, and put back where it stood. As where its claw tip goes, and how its foot
 * is pitched. Nothing until `sniff`.
 */
function markPath(s: Badger, R: Rest, t: number): { tip: V3; e: number } | null {
  const W = s.work, t0 = W.sniff - 0.02;
  if (t < t0) return null;
  const home = restTip(R, 1), spot = markOf(s, R), L = s.fore[0] + s.fore[1], k = tilt(s);
  const high: V3 = [lerp(home[0], spot[0], 0.6) * 1.15, lerp(home[1], spot[1], 0.7) + L * 0.15, L * (s.stage === 2 ? 1.2 : 1.5)];
  const scored: V3 = [spot[0], spot[1] - L * 0.6, 0.005];
  const up = W.mark - 0.05;
  if (t < up) return { tip: arc(home, high, ramp(t, t0, up), 0), e: 40 * k * ramp(t, t0, up) };
  if (t < W.mark) return { tip: mixV(high, spot, ((t - up) / (W.mark - up)) ** 2), e: lerp(40 * k, -8 * k, (t - up) / (W.mark - up)) };
  if (t < W.mark + SCRAPE) return { tip: arc(spot, scored, ramp(t, W.mark, W.mark + SCRAPE), 0), e: -8 * k - 10 * k * Math.sin(Math.PI * ramp(t, W.mark, W.mark + SCRAPE)) };
  const u = ramp(t, W.mark + SCRAPE, 0.98);
  return { tip: arc(scored, home, u, L * 0.12), e: -8 * k * (1 - u) + 12 * k * Math.sin(Math.PI * u) };
}

/** Where its nose is to be over the ground through a go at its task: at the ground as it snuffles, over the hole as it digs, in it as it sniffs, up as it marks. */
function noseHeight(s: Badger, t: number, stand: number): number {
  const W = s.work;
  const low = Math.min(s.head.h[2] * 0.12, stand * 0.1), hi = Math.min(s.head.h[2] * 0.75, stand * 0.5), look = stand + s.head.h[2] * 0.5;
  // Snuffling along the ground, its nose dabbing down onto it twice a sweep.
  const snuffle = 1 - ramp(t, W.snuffle - 0.04, W.snuffle + 0.04);
  const dab = Math.abs(Math.sin((t / W.snuffle) * Math.PI * 3)) * 0.6;
  let z = lerp(hi, low * (1 + dab), snuffle);
  // Into the hole once, held there a moment as it sniffs, and out.
  const dip = ramp(t, W.dig - 0.05, W.dig + 0.04) * (1 - ramp(t, W.sniff - 0.04, W.sniff + 0.04));
  z = lerp(z, 0.02, dip);
  const up = ramp(t, W.sniff, W.sniff + 0.08) * (1 - ramp(t, 0.92, 1));
  return lerp(z, look, up);
}

/**
 * A go at its task, seeking: head down and its nose sweeping over the ground from side to side as it snuffles; then its fore
 * paws in turn reaching out, striking into the ground and dragging the dirt back under its chest, flinging it back past its
 * hind legs, the barrel rocking onto the digging side and the tail going with each stroke; its nose pushed into the hole for a
 * sniff; and its head up as its right paw is stamped down beside the hole and scraped back, marking it.
 */
function workPlan(s: Badger, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim, t: number, down: number): Plan {
  const plan = stillPlan(R, p), W = s.work;
  plan.roll *= 1 - down;
  // The paws eased into their work at the start of a go, but not out of it: each stroke, and the mark, ends where the paw stands.
  const paws = Math.max(a.graze, ramp(t, 0, 0.1));
  const st = strokeOf(s, t);
  const side = st ? (st.paw ? 1 : -1) : 0;
  const drag = st && st.w > DIG_STROKE.bite && st.w < DIG_STROKE.fling ? Math.sin(Math.PI * (st.w - DIG_STROKE.bite) / (DIG_STROKE.fling - DIG_STROKE.bite)) : 0;
  // Crouched over the ground, hind legs braced, the barrel rocking onto the digging side and nodding behind each stroke.
  plan.H -= down * R.h * (0.07 + 0.02 * drag);
  p.pitch -= down * (3 + 2 * drag);
  plan.roll += down * 5 * side * (st ? Math.sin(Math.PI * st.w) : 0);
  plan.rock += down * 2 * drag;
  // Snuffling: the nose swept from side to side twice, the neck swinging it, the barrel leaning after it and the tail the other way.
  const snuffle = 1 - ramp(t, W.snuffle - 0.05, W.snuffle + 0.02);
  const sweep = Math.sin((t / W.snuffle) * TAU) * snuffle;
  p.neck[1] += down * 16 * sweep;
  plan.roll += down * 3 * sweep;
  // The tail going with each stroke, and up and wagging as it sniffs: what is seen of it from behind.
  const sniff = ramp(t, W.dig, W.dig + 0.03) * (1 - ramp(t, W.sniff - 0.02, W.sniff + 0.02));
  p.tail[0] += down * (10 + 22 * sniff);
  p.tail[1] += down * (st ? 26 * Math.sin(TAU * st.w) * side : 18 * Math.sin(TAU * t * 9) * sniff - 14 * sweep);
  for (const e of p.ears) e[0] += down * 14;
  if (st) {
    const { tip, e } = digPath(s, R, st.paw, st.w);
    const i = st.paw;
    plan.at[i] = mixV(R.ankle[i], ankleFor(R, tip, e), paws);
    plan.foot[i] = e * paws;
  }
  const mk = markPath(s, R, t);
  if (mk) {
    plan.at[1] = mixV(R.ankle[1], ankleFor(R, mk.tip, mk.e), paws);
    plan.foot[1] = mk.e * paws;
    // Leaning onto the stamp, and looking down at the spot.
    const stamp = hump(t, W.mark + 0.01, 0.06);
    plan.H -= R.h * 0.05 * stamp;
    plan.roll += 4 * stamp;
  }
  // The head turned away from the digging paw through each stroke, so its claws are seen beside the face; toward the spot as it marks.
  const marking = ramp(t, W.sniff, W.mark - 0.04) * (1 - ramp(t, W.mark + SCRAPE, 1));
  const aside = st ? Math.sin(Math.PI * st.w) ** 2 : 0;
  p.neck[1] += down * (8 * side * aside - 26 * marking);
  // Its head wagging in the hole as it sniffs, less the bigger and longer the head.
  p.head[2] += (down * 1.6 * Math.sin(TAU * t * 8) * sniff) / Math.max(0.25, s.head.y[s.head.y.length - 1] - s.head.y[0]);
  p.head[0] -= down * 8 * sniff;
  // Its nose brought down to the height it is to be at, by bowing the neck and the head together.
  const stand = noseOver(spec, R, p, plan, 0);
  const want = Math.max(0.012, lerp(stand, noseHeight(s, t, stand), down));
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

/* ---- the strike ------------------------------------------------------------------------------ */

/**
 * The Dirtlet's pounce: it crouches, its rump up and wiggling and its tail going, springs forward with all four feet off the
 * ground, its right paw thrown up, and comes down with that paw swiping down onto whatever it pounced on; then it hops back
 * to where it was.
 */
function pouncePlan(s: Badger, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = BADGER_HITS[0][0];
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
function rakePlan(s: Badger, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), [h1, h2] = BADGER_HITS[1];
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
  const hit = BADGER_HITS[2][0], top = hit - SLAM_DROP;
  return ramp(t, 0.02, top - 0.05) * (1 - clamp((t - top) / (hit - top)) ** 2);
}

/**
 * The Earthrend's slam: it rears up on its hind legs, crouched on its haunches, both fore paws raised high, and slams them down
 * onto the ground in front of it, the whole of it shaking as it lands; then it steps its paws back one at a time.
 */
function slamPlan(s: Badger, spec: QuadSpec, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R, p), hit = BADGER_HITS[2][0];
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
function earRoot(s: Badger): V3 {
  const H = s.head, q = onRings(H, lerp(H.y[0], H.y[2], s.ear.at[0]), s.ear.at[1]);
  return sub(q.p, scale(q.n, 0.04));
}
/** Where its nose ends, in the head's frame. */
const noseTip = (s: Badger): V3 => { const H = s.head, last = H.y.length - 1; return [0, H.y[last] + s.nose * 0.9, H.z[last] - H.h[last] * 0.4]; };

/** Its pose for what it is doing, over the one a body on four legs has (`quadPose`), and where its feet go. */
function planOf(s: Badger, spec: QuadSpec, R: Rest, p: QuadPose, a: Anim): Plan {
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
function still(s: Badger, R: Rest, p: QuadPose, a: Anim): Plan {
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
function shinLow(s: Badger, b: Bones, i: number): number {
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
function badgerBones(s: Badger): (a: Anim) => Bones {
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

/* ---- moss, stones and leaves ------------------------------------------------------------------- */

/** The colours of a plate: green moss, brown earth, and grey stone; each a light face, a dark face and a bright one. */
type Tone = 'moss' | 'soil' | 'stone';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = { moss: ['moss', 'leafDark', 'leaf'], soil: ['bark', 'shellDark', 'bark'], stone: ['stone', 'stoneDark', 'crystal'] };

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
 * A plate of moss or earth: a low faceted slab, its sides going down into the body, its top a shallow point of light and dark
 * faces so it reads as a clump; lying back like a shingle, its back edge standing up off the one behind it.
 */
function plateMesh(P: Plate): Mesh {
  const z = unit(P.n), y = unit(sub(P.back, scale(z, dot(P.back, z)))), x = cross(y, z);
  const S = 7, spin = jitter(P.id) * TAU;
  const ring = (k: number, h: number): V3[] => Array.from({ length: S }, (_, j) => {
    const th = spin + (j / S) * TAU, jj = 0.86 + 0.24 * jitter(P.id * 7 + j);
    const lx = Math.cos(th) * P.b * k * jj, ly = Math.sin(th) * P.a * k * jj;
    return add(P.root, add(add(scale(x, lx), scale(y, ly)), scale(z, h + P.lift * (ly / P.a))));
  });
  const base = ring(0.96, -P.t * 0.8), top = ring(0.84, P.t);
  const apex = add(P.root, add(scale(y, P.a * 0.12), scale(z, P.t * 1.4 + P.lift * 0.12)));
  const v: V3[] = [...base, ...top, apex];
  const f: Face[] = [], want: V3[] = [];
  const [light, dark, bright] = TONES[P.tone];
  for (let j = 0; j < S; j++) {
    const j1 = (j + 1) % S;
    const out = unit(sub(scale(add(top[j], top[j1]), 0.5), add(P.root, scale(z, P.t))));
    f.push({ i: [j, j1, S + j1, S + j], m: dot(out, y) > 0.3 ? dark : light, soft: true });
    want.push(out);
    f.push({ i: [S + j, S + j1, 2 * S], m: jitter(P.id * 3 + j) < 0.3 ? dark : j % 4 === 0 ? bright : light });
    want.push(unit(add(out, scale(z, 1.6))));
  }
  return mesh(v, wound(v, f, want));
}

/**
 * A rough stone: a lumpy faceted ball `r` big along `up` and across it, half sunk into whatever it sits on; its faces grey,
 * dark underneath, and those facing the sky green with moss where `moss` says.
 */
function rockMesh(c: V3, r: V3, up: V3, id: number, moss: number, n = 7, k = 4): Mesh {
  const b = orbAlong([0, 0, 0], up, r, n, k, 'stone');
  const v = b.v.map((p, i) => {
    const j = 0.9 + 0.18 * jitter(id * 31 + i);
    return add(c, scale(p, j)) as V3;
  });
  const sky: V3 = unit(add(unit(up), [0, 0, 0.8]));
  const f = b.f.map((face) => {
    const mid = scale(face.i.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    const out = unit(sub(mid, c)), u = dot(out, sky), z = out[2];
    const m: Mat = u > 1 - moss ? (jitter(id + face.i[0]) < 0.3 ? 'leafDark' : 'moss') : z < -0.25 ? 'stoneDark' : jitter(id * 3 + face.i[0]) < 0.12 ? 'crystal' : 'stone';
    return { ...face, m };
  });
  return mesh(v, f);
}

/**
 * The plates down its back in rows from the shoulders to the rump, set like bricks, each lying back toward the tail and out
 * down the flank: green moss along the top, clumps of brown earth among it, and grey stones out where the back turns down to
 * the flank.
 */
function platesOf(s: Badger): Plate[] {
  const C = s.plates, out: Plate[] = [];
  for (let r = 0; r < C.rows; r++) {
    const f = r / Math.max(1, C.rows - 1);
    const y0 = lerp(C.from, C.to, f);
    const count = C.per + (r % 2 ? -1 : 0);
    for (let q = 0; q < count; q++) {
      const id = 100 + r * 17 + q;
      const g = count > 1 ? q / (count - 1) - 0.5 : 0, edge = Math.abs(g) * 2;
      const th = Math.PI / 2 + g * 2 * C.spread + (jitter(id) - 0.5) * 0.12;
      const at = onRings(s.body, y0 + (jitter(id + 3) - 0.5) * 0.08, th);
      const c = Math.cos(th), sn = Math.sin(th), wv = Math.sign(c) || 1;
      const round: V3 = unit([wv * sn, 0, -wv * c * 0.9]);
      const back = unit(add([0, -1, 0], scale(round, edge * 1.4)));
      const k = (1 - 0.2 * edge) * (0.9 + 0.2 * jitter(id + 5)) * (1 - 0.25 * Math.abs(f - 0.4));
      const tone: Tone = edge > 0.75 && s.stage === 2 ? 'soil' : jitter(id + 9) < 0.18 ? 'soil' : 'moss';
      out.push({ root: add(at.p, scale(at.n, -0.02)), n: at.n, back, a: C.a * k, b: C.b * k, t: C.t * (tone === 'moss' ? 1.1 : 1), lift: C.lift * k, tone, id });
    }
  }
  return out;
}

/** The stones on it: one over each shoulder and each haunch, a couple on its flanks; and on the Earthrend, boulders heaped on its back. */
function stonesOf(s: Badger, n: number): Mesh {
  const B = s.body, S = s.stones, out: Mesh[] = [];
  // along (share from rump to chest), round (radians up from the side), size, id
  const spots: Array<[number, number, number, number]> = [
    [0.8, 0.12, 0.85, 1], [0.2, 0.18, 1.05, 2],
  ];
  if (s.stage > 0) spots.push([0.04, 0.45, 0.7, 4]);
  for (const sd of [1, -1]) {
    for (const [f, th, k, id0] of spots) {
      const id = id0 + (sd > 0 ? 0 : 20);
      const y = lerp(B.y[0], B.y[B.y.length - 1], f) + (jitter(id) - 0.5) * 0.05 * s.len;
      const q0 = onRings(B, y, th), q = sd > 0 ? q0 : left(q0);
      const r = S * k * (0.9 + 0.2 * jitter(id + 1));
      // Half sunk into the flank, flattened against it: a plate of stone rather than a pebble stuck on.
      out.push(rockMesh(add(q.p, scale(q.n, r * 0.12)), [r * 1.05, r * 0.95, r * 0.55], q.n, id, 0.3, n, 4));
    }
  }
  // The hillside: boulders heaped along the top of its back, the biggest over its middle, each mossed on top.
  for (let q = 0; q < s.mound; q++) {
    const id = 300 + q;
    const f = q / Math.max(1, s.mound - 1);
    const y = lerp(B.y[5] - 0.2, B.y[1] + 0.3, f);
    const th = Math.PI / 2 + (q % 2 ? 1 : -1) * (0.55 + 0.3 * jitter(id));
    const at = onRings(B, y, th);
    const r = S * (0.8 + 0.35 * Math.sin(Math.PI * f)) * (0.85 + 0.3 * jitter(id + 2));
    out.push(rockMesh(add(at.p, scale(at.n, r * 0.05)), [r * 1.15, r * 1.05, r * 0.7], at.n, id, 0.6, n, 4));
  }
  return merge(...out);
}

/**
 * A leaf: a broad green blade from `root` out along `dir`, its face turned toward `face`, `L` long, its tip drooping; a shallow
 * V along its middle rib, with a face on either side and no edges between, which a leaf is too thin to show: a third of the
 * corners a blade of its own (`blade`) has, as there are many on its back.
 */
function leafMesh(root: V3, dir: V3, face: V3, L: number, droop = 0.26, mat: Mat = 'leaf'): Mesh {
  const d = unit(dir), n0 = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n0));
  const pts = [root, add(add(root, scale(d, L * 0.4)), [0, 0, L * 0.05]), add(add(root, scale(d, L * 0.78)), [0, 0, -L * droop * 0.4]), add(add(root, scale(d, L)), [0, 0, -L * droop])];
  const ws = [L * 0.05, L * 0.33, L * 0.26, L * 0.03], th = L * 0.025;
  const v: V3[] = [];
  // Each step along it: its left edge, its rib and its right edge, the edges lifted a little off the rib; and under them again.
  for (let k = 0; k < pts.length; k++) {
    const lift = scale(n0, ws[k] * 0.12);
    v.push(add(add(pts[k], scale(side, -ws[k])), lift), pts[k], add(add(pts[k], scale(side, ws[k])), lift));
  }
  for (let k = 0; k < pts.length; k++) for (let j = 0; j < 3; j++) v.push(sub(v[k * 3 + j], scale(n0, th)));
  const f: Face[] = [], want: V3[] = [], B = pts.length * 3;
  for (let k = 0; k < pts.length - 1; k++) {
    for (const j of [0, 1]) {
      f.push({ i: [k * 3 + j, k * 3 + j + 1, (k + 1) * 3 + j + 1, (k + 1) * 3 + j], m: j ? mat : k === 0 ? 'leafDark' : mat });
      want.push(n0);
      f.push({ i: [B + k * 3 + j, B + k * 3 + j + 1, B + (k + 1) * 3 + j + 1, B + (k + 1) * 3 + j], m: mat });
      want.push(scale(n0, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/** What stirs on its back, as one mesh: each corner's root (what it sways on) and a phase of its own. */
interface Stir { mesh: Mesh; root: V3[]; ph: number[]; k: number[] }
function stirOf(parts: ReadonlyArray<{ mesh: Mesh; root: V3; id: number; k?: number }>): Stir {
  const root: V3[] = [], ph: number[] = [], k: number[] = [];
  for (const p of parts) for (let q = 0; q < p.mesh.v.length; q++) { root.push(p.root); ph.push(jitter(p.id + 31) * TAU); k.push(p.k ?? 1); }
  return { mesh: merge(...parts.map((p) => p.mesh)), root, ph, k };
}

/**
 * The leaves along its back: in two rows either side of the spine from the shoulders back, each leaning out and back off it,
 * the biggest over the shoulders; on the Earthrend among its boulders. And the Earthrend's tail ends in a few more.
 */
function leavesOf(s: Badger): Array<{ mesh: Mesh; root: V3; id: number; k?: number }> {
  const B = s.body, Lf = s.leaves, out: Array<{ mesh: Mesh; root: V3; id: number; k?: number }> = [];
  // Two big leaves standing up over its shoulders, behind its head, the way a sprout grows out of a bank.
  if (s.stage > 0) {
    for (const sd of [1, -1]) {
      const id = 590 + sd;
      const at = onRings(B, Lf.from - 0.06 * s.len, Math.PI / 2 - sd * 0.3);
      const dir = unit([sd * 0.6, -0.55, 0.6]);
      const up = unit([sd * 0.7, 0.2, 0.7]);
      const root = add(at.p, scale(at.n, s.plates.t * 0.6));
      out.push({ mesh: leafMesh(root, dir, unit(sub(up, scale(dir, dot(up, dir)))), Lf.len * (sd > 0 ? 1.45 : 1.25), 0.18), root, id, k: 1.4 });
    }
  }
  for (let q = 0; q < Lf.n; q++) {
    const id = 600 + q;
    const f = Lf.n > 1 ? q / (Lf.n - 1) : 0;
    const sd = q % 2 ? -1 : 1;
    const y = lerp(Lf.from, Lf.to, f) + (jitter(id) - 0.5) * 0.06 * s.len;
    const th = Math.PI / 2 - sd * (0.2 + 0.75 * jitter(id + 1));
    const at = onRings(B, y, th);
    const L = Lf.len * 0.8 * (1.3 - 0.6 * f) * (0.85 + 0.3 * jitter(id + 2));
    // Up off the back and out to its side, lying back over it.
    const dir = unit([sd * (0.55 + 0.35 * jitter(id + 5)), -0.65 - 0.35 * jitter(id + 3), 0.32 + 0.2 * jitter(id + 6)]);
    const root = add(at.p, scale(at.n, s.plates.t * 0.6));
    const up = unit(add(at.n, [0, 0, 1]));
    const face = unit(sub(up, scale(dir, dot(up, dir))));
    // Most green, some a darker green, and now and then one turned the rust of autumn.
    const tint = jitter(id + 8);
    out.push({ mesh: leafMesh(root, dir, face, L, 0.26, tint < 0.08 ? 'ember' : tint < 0.42 ? 'moss' : 'leaf'), root, id, k: 1 });
    // A second, smaller, out of the same root, the other way: leaves grow in sprays.
    if (jitter(id + 4) < 0.35) {
      const d2 = unit(add(dir, [sd * 0.5, 0.5, -0.1]));
      out.push({ mesh: leafMesh(root, d2, unit(sub(up, scale(d2, dot(up, d2)))), L * 0.7), root, id: id + 50, k: 1.2 });
    }
  }
  return out;
}

/** The sprout on the Dirtlet's head: a short stem and two big leaves either way off its top, a small one between. */
function sproutOf(s: Badger): { mesh: Mesh; root: V3 } | undefined {
  if (!s.sprout) return undefined;
  const H = s.head, L = s.sprout;
  const crown = onRings(H, lerp(H.y[1], H.y[3], 0.6), Math.PI / 2);
  const root = sub(crown.p, scale(crown.n, 0.02));
  const top = add(root, [0, -L * 0.08, L * 0.36]);
  const stem = tube(curve(root, add(root, [0.01, 0.02, L * 0.2]), top, 3), [L * 0.06, L * 0.05, L * 0.045, L * 0.04], [L * 0.06, L * 0.05, L * 0.045, L * 0.04], 5, 'stem', { seam: 'start' });
  // Two leaves in a V, along the head a little across it, so a side view sees their faces; and a small one between.
  const leaf = (dir: V3, len: number): Mesh => { const d = unit(dir); return leafMesh(top, d, unit(add(cross(d, [0, 0, 1]), [0, 0, 0.3])), len, 0.12); };
  return { mesh: merge(stem, leaf([0.4, 0.75, 0.6], L * 0.95), leaf([-0.4, -0.7, 0.65], L * 0.85), leaf([0.1, 0.1, 1], L * 0.4)), root };
}

/**
 * How what is on its back stirs this moment: how far each thing sways on its root and how fast, and how far grown it is. A
 * breeze through its leaves standing; stirred with each step as it goes, shaken as a blow lands and as it digs; and as it
 * evolves, growing out of its back from under half their size.
 */
function stirring(s: Badger, a: Anim, leaf: boolean): { jig: number; at: number; grow: number } {
  // A breeze, standing: a slow sway, three a minute, and a quicker shiver over it.
  let jig = leaf ? 0.05 * (1 - a.go) * (0.6 + 0.4 * cyc(a.t, 3)) : 0, at = a.t * TAU * 0.5, grow = 1;
  if (a.go > 0) {
    jig += smooth(a.go) * s.gait.jiggle * (0.05 + 0.03 * a.gait) * (leaf ? 2.2 : 0.6);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    for (const h of BADGER_HITS[s.strike]) jig += (leaf ? 0.16 : 0.05) * hump(act.t, h + 0.05, 0.16);
    at = act.t * 60;
  } else if (act?.kind === 'work') {
    const st = strokeOf(s, act.t);
    if (st) jig += downOf(act.t, a.graze) * (leaf ? 0.09 : 0.03) * hump(st.w, DIG_STROKE.bite + 0.05, 0.2);
    jig += (leaf ? 0.1 : 0.03) * hump(act.t, s.work.mark + 0.01, 0.06);
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
function stirred(s: Badger, G: Stir, leaf: boolean): (v: readonly V3[], a: Anim) => V3[] {
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
 * The white stripe down the middle of its face, painted on the head from the back of its crown to just short of its nose:
 * broad over the crown and narrowing toward the nose, so it reads at any size the facets under it are cut at.
 */
function stripeOf(s: Badger): Disc {
  const H = s.head, last = H.y.length - 1, len = H.y[last] - H.y[0];
  const ys = Array.from({ length: 8 }, (_, q) => lerp(H.y[0] + len * 0.08, H.y[last] - len * 0.04, q / 7));
  const half = (y: number): number => lerp(0.5, 0.32, (y - H.y[0]) / len);
  const v = [
    ...ys.map((y) => { const q = onRings(H, y, Math.PI / 2 - half(y)); return add(q.p, scale(q.n, 0.01)); }),
    ...[...ys].reverse().map((y) => { const q = onRings(H, y, Math.PI / 2 + half(y)); return add(q.p, scale(q.n, 0.01)); }),
  ];
  // Wound to face up out of the head.
  let nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nz < 0 ? v.reverse() : v, m: 'mark' };
}

/**
 * The dark band down either side of its face through the eye, painted on the head from just behind the nose back to under the
 * ear, widest behind the eye: what makes a badger's face whatever the facets under it are cut at.
 */
function bandOf(s: Badger, side: number): Disc {
  const H = s.head, last = H.y.length - 1, len = H.y[last] - H.y[0], c = s.eye.up;
  const ys = Array.from({ length: 8 }, (_, q) => lerp(H.y[0] + len * (s.mask.back + 0.02), H.y[last] - len * 0.06, q / 7));
  const half = (y: number): number => lerp(0.36, 0.16, ((y - H.y[0]) / len - s.mask.back) / (1 - s.mask.back));
  const on = (y: number, th: number): V3 => { const q0 = onRings(H, y, th), q = side > 0 ? q0 : left(q0); return add(q.p, scale(q.n, 0.008)); };
  const v = [...ys.map((y) => on(y, c - half(y))), ...[...ys].reverse().map((y) => on(y, c + half(y) * 0.8))];
  const out = side > 0 ? onRings(H, s.eye.y, c).n : left(onRings(H, s.eye.y, c)).n;
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const p = v[q], r = v[(q + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * out[0] + ny * out[1] + nz * out[2] < 0 ? v.reverse() : v, m: 'spot' };
}

/**
 * The eyes: amber, round, a dark middle and a glint, set in the dark band through its face; on the Tunnelclaw and the
 * Earthrend narrowed under a heavy dark brow, which is what makes the face determined. All of an eye goes out of sight
 * together behind the head.
 */
function eyesOf(s: Badger, shut: boolean): Mesh {
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
    // Not drawn once it is turned more than about eighty degrees from the viewer, as it goes round toward the outline.
    const away: V3 = [-q.n[0], -q.n[1], 0.62 - q.n[2]];
    const done = (): void => { const m = paint(out); m.f.forEach((f) => { f.unless = away; }); meshes.push(m); };
    if (shut) {
      out.push(patch(0, -r * 0.1, r * 1.1, r * 0.28, 8, 'lid', 0.012));
      done();
      continue;
    }
    out.push(patch(0, r * 0.05, r * 1.22, r * tall * 1.2, 10, 'lid', 0.008));
    out.push(patch(0, 0, r, r * tall, 12, 'bloom', 0.012));
    out.push(patch(r * 0.08, 0, r * 0.55, r * tall * 0.62, 8, 'eye', 0.016));
    // The brow: a dark lid come down over the top of the eye, slanting down toward the nose.
    if (E.lid) out.push(patch(0, r * tall * (1.35 - E.lid * 1.1), r * 1.35, r * tall * 0.75, 10, 'lid', 0.02, { tilt: -0.4 }));
    out.push(patch(r * 0.32, r * tall * (E.lid ? 0.12 : 0.36), r * 0.28, r * 0.28, 6, 'glint', 0.024, { lit: true }));
    if (!E.lid) out.push(patch(-r * 0.3, -r * tall * 0.4, r * 0.13, r * 0.13, 5, 'glint', 0.024, { lit: true }));
    done();
  }
  return merge(...meshes);
}

/**
 * The head, built as rings from the back of the skull to the end of the nose, a wedge: fur behind, a white stripe down the
 * middle of the face, a dark band either side of it through each eye, white cheeks under the bands, a dark jaw under them; a
 * big dark nose on the end, and a mouth line back along the muzzle, turned up in a small smile.
 */
function headOf(s: Badger, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1, M = s.mask, len = H.y[last] - H.y[0];
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => {
    const up = Math.sin(((j + 1) / n) * TAU), f = (H.y[Math.min(ring, last)] - H.y[0]) / len;
    if (up > M.stripe) return 'mark';
    if (ring >= last) return up < M.cheek ? 'spot' : 'muzzle';
    if (f < M.back) return up < M.cheek ? 'coatDark' : 'coat';
    if (up > M.band) return 'spot';
    if (up > M.cheek) return 'muzzle';
    return 'spot';
  });
  const tipC: V3 = [0, H.y[last] + s.nose * 0.2, H.z[last] - H.h[last] * 0.1];
  const nose = orbAlong(tipC, [0, 1, 0.15], [s.nose * 1.25, s.nose * 0.9, s.nose * 0.95], 7, 4, 'nose');
  const front: V3 = [0, tipC[1] + s.nose * 0.86, tipC[2]];
  const nostrils = paint([1, -1].map((sd) => disc(add(front, [sd * s.nose * 0.4, 0.006, -s.nose * 0.1]), [0, 1, 0.1], s.nose * 0.17, s.nose * 0.24, 6, 'pad')));
  const parts: Array<Mesh | undefined | false> = [skull, nose, nostrils, paint([stripeOf(s), bandOf(s, 1), bandOf(s, -1)])];
  // The mouth: back along the side of the muzzle from under the nose, turned up at its corner.
  parts.push(paint([1, -1].map((sd) => {
    const pts = Array.from({ length: 6 }, (_, q) => {
      const f = q / 5, y = lerp(H.y[last - 1], H.y[last] - len * (s.stage === 0 ? 0.32 : 0.36), f);
      const th = -0.6 + 0.32 * f ** 2;
      const at = onRings(H, y, th);
      return sd > 0 ? at : left(at);
    });
    return { ...line(pts, H.w[2] * 0.03, 'lid'), at: sub(pts[3].p, scale(pts[3].n, 0.05)) };
  })));
  parts.push(eyesOf(s, shut));
  return merge(...parts);
}

/** Solids inside the head that hide what is round the far side of them: the skull and the muzzle. */
function headSolids(s: Badger): Array<{ c: V3; r: V3 }> {
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

/** An ear: small and round, a thick cup of fur with a pale rim and a pink inside. */
function earOf(s: Badger, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  return merge(
    tube(curve([0, 0, -0.03], [0, 0.03, L * 0.5], [0, -0.02, L], 4), [w * 0.8, w, w * 0.92, w * 0.6, 0.02], w * 0.42, n, (ring) => (ring >= 3 ? 'coatLight' : 'coat'), { up: [0, 1, 0], seam: 'start' }),
    paint([disc([0, w * 0.44, L * 0.42], [0, 1, 0.08], w * 0.58, L * 0.3, 8, 'inner')]),
  );
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A fore paw (the right; the left is its mirror): a broad dark paw and, out of the front of it, its pale claws, each a thick curved blade reaching forward and down to the ground. */
function forePaw(s: Badger, n: number, k: number): Mesh {
  const r = s.paw, d = s.fore[2], C = s.claw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.64], [0, 1, 0], [r * 1.08, r * 0.64, r * 1.08], n, k, 'coatDark');
  const claws = Array.from({ length: C.n }, (_, q) => {
    const f = C.n > 1 ? q / (C.n - 1) - 0.5 : 0, L = C.len * (1 - 0.3 * Math.abs(f));
    const root: V3 = [f * r * 1.3, r * 0.8, -d + r * 0.7];
    const tip: V3 = [f * r * 1.6, r * 0.8 + L * 0.95, -d + 0.02];
    const pts = curve(root, [f * r * 1.5, root[1] + L * 0.62, -d + r * 0.7 + L * 0.2], tip, 3);
    const cw = C.w;
    return tube(pts, [cw * 0.8, cw * 0.66, cw * 0.4, 0.012], [cw, cw * 0.86, cw * 0.52, 0.012], 5, (_ring, j) => (Math.sin(((j + 1) / 5) * TAU) < -0.5 ? 'hornDark' : 'claw'), { seam: 'start' });
  });
  return merge(paw, ...claws);
}

/** A hind paw: smaller, dark, with short pale claws. */
function hindPaw(s: Badger, n: number, k: number): Mesh {
  const r = s.hindPaw, d = s.hind[2], L = s.hindClaw;
  const paw = orbAlong([0, r * 0.3, -d + r * 0.62], [0, 1, 0], [r, r * 0.6, r * 1.12], n, k, 'coatDark');
  const claws = [-1, -0.33, 0.33, 1].map((f) => {
    const root: V3 = [f * r * 0.6, r * 1.0, -d + r * 0.45];
    const w = Math.max(0.03, L * 0.32);
    return tube(curve(root, [f * r * 0.7, root[1] + L * 0.6, root[2] + L * 0.05], [f * r * 0.8, root[1] + L, -d + 0.02], 2), [w * 0.7, w * 0.5, 0.008], [w, w * 0.7, 0.008], 5, 'claw', { seam: 'start' });
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
  let nx = 0, ny = 0, nz = 0;
  for (let c2 = 0; c2 < n; c2++) {
    const p = v[c2], r2 = v[(c2 + 1) % n];
    nx += (p[1] - r2[1]) * (p[2] + r2[2]);
    ny += (p[2] - r2[2]) * (p[0] + r2[0]);
    nz += (p[0] - r2[0]) * (p[1] + r2[1]);
  }
  return { v: nx * q.n[0] + ny * q.n[1] + nz * q.n[2] < 0 ? v.reverse() : v, m };
}

/** Paler patches of fur on its flanks, under the moss: over the shoulder, the middle and the haunch. */
function patches(s: Badger): Mesh {
  const B = s.body, out: Disc[] = [];
  const spots: Array<[number, number, number]> = [[0.72, -0.15, 0.13], [0.45, -0.35, 0.11], [0.2, -0.1, 0.12]];
  for (const sd of [1, -1]) spots.forEach(([f, th, r], q) => out.push(blot(B, lerp(B.y[0], B.y[B.y.length - 1], f), th, r * s.len * 1.3, 'coatLight', 70 + q + (sd > 0 ? 0 : 9), sd)));
  return paint(out);
}

/** The barrel as one solid, a little inside its skin: its middle and its half-sizes. */
function barrelSolid(s: Badger): { c: V3; r: V3 } {
  const B = s.body, y0 = B.y[0], y1 = B.y[B.y.length - 1];
  return { c: [0, (y0 + y1) / 2, 0], r: [Math.max(...B.w) * 0.88, ((y1 - y0) / 2) * 0.88, Math.max(...B.h) * 0.88] };
}

/** The legs: thick and short, rooted up inside the body, the fur darker toward the paw; on the bigger two a stone on each forearm and thigh. */
function legPieces(s: Badger, n: number, k: number): Piece[] {
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
    // A stone down the outside of each forearm, and one over each thigh.
    if (s.legStones) {
      const id = (fore ? 40 : 50) + (side > 0 ? 0 : 5), r = w * 0.62;
      const stone = fore
        ? rockMesh([side * w * 0.42, w * 0.22, -L[1] * 0.38], [r * 0.95, r * 0.7, r * 1.15], [side, 0.5, 0.2], id, 0.35, 6, 4)
        : rockMesh([side * w * 0.5, -w * 0.05, -L[0] * 0.2], [r * 1.25, r * 1.1, r * 0.9], [side, -0.2, 0.6], id, 0.45, 6, 4);
      out.push({ key: `${key}s`, mesh: stone, bone: fore ? `${key}1` : `${key}0`, bias: 0.025, after: fore ? [`${key}1`] : ['body', `${key}0`], front, hide, hideIn: 'trunk' });
    }
    // A hind leg's haunch: a round bulge of muscle over the top of the thigh.
    const thigh = fore ? upper : merge(upper, orbAlong([-side * w * 0.04, -w * 0.04, -L[0] * 0.18], [0, 0, 1], [w * 1.1, w * 1.0, w * 1.0], n, k, 'coat'));
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

/** A stage's pieces: a body on four legs with its own head, ears, paws and claws, and its moss, stones and leaves. */
function badgerBuild(s: Badger, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6);
  const B = s.body, skull = headSolids(s)[0];
  const R = domed(B);
  // Under the moss, the top of its back dark earth as far down as the plates go; its fur under that, paler on its belly.
  const shell = Math.sin(Math.PI / 2 - s.plates.spread - 0.1);
  // The barrel cut finer round than the rest, so it is a loaf and not a box.
  const nb = cut(lod, 10, 14);
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, nb,
    (ring, j) => {
      const up = Math.sin(((j + 1) / nb) * TAU);
      if (ring > 1 && ring < R.y.length - 2 && up < -0.55) return 'belly';
      return up > shell && ring > 0 && ring < R.y.length - 1 ? 'shellDark' : 'coat';
    });
  // Its underside tucked in toward the belly, so seen from behind it is a dome on its legs rather than a box.
  const body = mesh(barrel.v.map((p, i) => {
    const q = Math.min(R.y.length - 1, Math.floor(i / nb)), t = clamp((R.z[q] - p[2]) / R.h[q]);
    return [p[0] * (1 - 0.3 * t * t), p[1], p[2] + R.h[q] * 0.08 * t * t] as V3;
  }), barrel.f);
  // A pale bib on the chest under the chin, the white of its cheeks carried down.
  const bib = orbAlong([0, B.y[5] + 0.02, B.z[5] - B.h[5] * 0.34], [0, 1, -0.5], [B.w[5] * 0.62, B.h[5] * 0.5, B.h[5] * 0.36], n, k, 'belly');
  const solid = barrelSolid(s);
  const extras: Piece[] = [];
  const plates = platesOf(s);
  const G = stirOf(plates.map((P) => ({ mesh: plateMesh(P), root: P.root, id: P.id })));
  extras.push({ key: 'plates', mesh: G.mesh, bone: 'trunk', bias: 0.1, after: ['body'], bent: stirred(s, G, false), lines: false });
  extras.push({ key: 'stones', mesh: stonesOf(s, cut(lod, 6, 7)), bone: 'trunk', bias: 0.12, after: ['body', 'plates'], hide: [solid] });
  const leaves = leavesOf(s);
  const tailLeaves: Array<{ mesh: Mesh; root: V3; id: number }> = [];
  if (leaves.length) {
    const L = stirOf(leaves);
    extras.push({ key: 'leaves', mesh: L.mesh, bone: 'trunk', bias: 0.16, after: ['body', 'plates', 'stones'], hide: [solid], bent: stirred(s, L, true), lines: false });
  }
  const tailW = s.tail.w, tailL = s.tail.len;
  for (let q = 0; q < s.tail.leaves; q++) {
    const root: V3 = [0, -tailL * 0.8, tailW * 0.3];
    const sd = q - (s.tail.leaves - 1) / 2;
    const dir = unit([sd * 0.9, -0.6, 0.9]);
    tailLeaves.push({ mesh: leafMesh(root, dir, unit(add(cross(dir, [1, 0, 0]), [0, 0, 0.5])), tailL * 0.8), root, id: 800 + q });
  }
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.85, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -40,
    tail: [merge(
      // A short thick tail, tapering, its tip pale; the Earthrend's knobbed with a stone and ending in leaves.
      tube(curve([0, 0.04, 0], [0, -tailL * 0.5, 0.03], [0, -tailL, -0.02], 2), [tailW, tailW * 0.82, tailW * 0.3], [tailW * 0.9, tailW * 0.74, tailW * 0.3], 5, (ring) => (ring >= 2 ? 'shell' : 'coat'), { seam: 'start' }),
      s.tail.leaves > 0 && rockMesh([0, -tailL * 0.45, tailW * 0.55], [tailW * 0.8, tailW * 1.1, tailW * 0.6], [0, -0.3, 1], 77, 0.5, 6, 4),
      tailLeaves.length > 0 && merge(...tailLeaves.map((t) => t.mesh)),
    )],
    fore: { upper: [0, -s.fore[0], s.thick, s.thick], lower: [0, -s.fore[1], s.thick, s.thick], foot: forePaw(s, n, k) },
    hind: { upper: [0, -s.hind[0], s.thick, s.thick], lower: [0, -s.hind[1], s.thick, s.thick], foot: hindPaw(s, n, k) },
    breath: 0.035,
    extras,
  }).filter((pc) => !/^(fl|fr|hl|hr)[012]$/.test(pc.key));
  pieces.push(...legPieces(s, n, k));
  const sprout = sproutOf(s);
  if (sprout) {
    const S = stirOf([{ mesh: sprout.mesh, root: sprout.root, id: 5, k: 1.3 }]);
    pieces.push({ key: 'sprout', mesh: S.mesh, bone: 'head', bias: 0.22, after: ['head', 'ear0', 'ear1'], bent: stirred(s, S, true) });
  }
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(body, bib, patches(s)) };
    // The top of its neck dark earth like its back, so no fur shows between its ears from in front; its throat its fur.
    if (pc.key === 'neck') {
      const nw = s.neck.w, nh = s.neck.w * 0.85, nl = s.neck.len;
      return { ...pc, mesh: tube([[0, 0, -0.3], [0, 0, nl * 0.5], [0, 0.05, nl]], nw, nh, n, (_r, j) => (Math.sin(((j + 1) / n) * TAU) < -0.15 ? 'shellDark' : 'coat'), { seam: 'both' }) };
    }
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

/** Dug earth: rich brown, darker, and grey pebbles in it; the gold of a relic's glint; the pale dust off dry ground. */
const SOIL_RGB: RGB = [150, 104, 70];
const LOAM_RGB: RGB = [104, 72, 52];
const PEBBLE_RGB: RGB = [168, 162, 150];
const LEAF_RGB: RGB = [132, 176, 82];
const GOLD_RGB: RGB = [255, 214, 110];
const DUST_RGB: RGB = [222, 200, 168];
const css = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Tunnelclaw's: less than in proportion on the small one, so they still read. */
const bigness = (s: Badger): number => 0.25 + 0.75 * (s.len / 2.1);

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

/** A relic's glint: a small four-pointed star of gold light, `r` across, `k` of the way grown. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, k: number): void {
  if (k <= 0.02) return;
  const R = r * k, w = R * 0.22;
  g.save();
  g.fillStyle = css(GOLD_RGB);
  g.beginPath();
  g.moveTo(x, y - R);
  g.quadraticCurveTo(x + w, y - w, x + R, y);
  g.quadraticCurveTo(x + w, y + w, x, y + R);
  g.quadraticCurveTo(x - w, y + w, x - R, y);
  g.quadraticCurveTo(x - w, y - w, x, y - R);
  g.fill();
  g.fillStyle = 'rgb(255,252,238)';
  g.beginPath();
  g.arc(x, y, w * 0.9, 0, TAU);
  g.fill();
  g.restore();
}

/** The body's frame at a blow, along the ground: its trunk, as it was posed when the blow landed. */
const at0 = (b: Bones): Bones[string] => b.trunk;

/**
 * The strike: where each blow lands, claw streaks in the air in front of the paw, clods of earth and a pebble or two knocked
 * up off the ground and a puff of dust; and for the Earthrend's slam, the ground cracked, a ring of dust going out over it, and
 * earth and leaves thrown up high, over its back so it is seen from behind. Each thing sorted in front of the body or behind it.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Badger, b: Bones, hits: Bones[], R: Rest, t: number, front: boolean): void {
  const big = bigness(s), hs = BADGER_HITS[s.strike];
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
          lump(g, x, y, (c % 4 === 3 ? 0.11 : 0.16 + 0.08 * jitter(id + 4)) * big * k, id, c % 4 === 3 ? PEBBLE_RGB : c % 2 ? SOIL_RGB : LOAM_RGB);
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
    // The slam: the ground cracked under the paws, a ring of dust going out over it, and earth and leaves thrown up high.
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
        if (c % 4 === 0) leafBit(g, x, y, 0.6 * big * k, id + since * 10);
        else lump(g, x, y, (0.2 + 0.1 * jitter(id + 4)) * big * k, id, c % 3 === 0 ? PEBBLE_RGB : c % 2 ? SOIL_RGB : LOAM_RGB);
      }
    }
  });
}

/**
 * Seeking: puffs of dust where its nose snuffles at the ground; under its fore paws the hole it digs, dark earth with a rim of
 * clods; at each stroke, as the claws come out of the ground, clods flung back under and past its hind legs on either side,
 * high enough to be seen over its back from behind, scattering where they land; a puff where its nose goes into the hole and a
 * glint of something buried in it as its head comes up; and the spot beside the hole marked, a puff as its paw stamps and three
 * claw scores in the earth where it scrapes back, lying there to the end of the go.
 */
function seekSpray(g: CanvasRenderingContext2D, view: View, s: Badger, b: Bones, R: Rest, a: Anim, t: number, front: boolean, flung: readonly V3[], crest: ReadonlyArray<[string, V3]>): void {
  const big = bigness(s), down = downOf(t, a.graze), mid = b.body.t, W = s.work;
  const top = R.h + Math.max(...s.body.h.map((h, q) => h + s.body.z[q])) + s.plates.t * 2 + s.stones * (s.mound ? 1.4 : 0.4);
  const hole: V3 = [0, holeOf(s, R)[1] - 0.15 * s.paw, 0.01];
  const dug = clamp(Math.max(a.graze < 0.5 ? 0 : 1, ramp(t, W.snuffle, W.dig)));
  if (!front && dug > 0) {
    const [x, y] = onScreen(view, hole);
    const r = (s.paw * 2.2 + s.claw.len * 0.7) * down * (0.4 + 0.6 * dug);
    g.fillStyle = css(mix(LOAM_RGB, [44, 30, 24], 0.4));
    g.beginPath();
    g.ellipse(x, y, r * 1.5, r * 0.62, 0, 0, TAU);
    g.fill();
    for (let q = 0; q < 6; q++) {
      const ox = (jitter(q + 60) - 0.5) * 2.6 * r, oy = (jitter(q + 61) - 0.5) * 0.9 * r;
      lump(g, x + ox, y + oy, 0.15 * big * down * dug, q * 2.1, q % 3 === 2 ? PEBBLE_RGB : q % 2 ? SOIL_RGB : LOAM_RGB);
    }
    // Something buried glinting in the hole as its nose comes out of it, until it has marked the spot.
    const k = ramp(t, W.sniff - 0.03, W.sniff + 0.04) * (1 - ramp(t, W.mark + 0.04, W.mark + 0.12));
    const tw = 0.75 + 0.25 * Math.sin(t * 90);
    glint(g, x + r * 0.2, y - r * 0.3, 0.85 * big, k * tw);
  }
  // The mark: three scores in the earth beside the hole where the claws scraped back, drawn in as they go and lying there.
  if (!front && t > W.mark) {
    const spot = markOf(s, R), L = s.fore[0] + s.fore[1];
    const drawn = ramp(t, W.mark, W.mark + SCRAPE * 0.9), gone = 1 - ramp(t, 0.94, 1);
    g.save();
    g.lineCap = 'round';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? css(mix(LOAM_RGB, [40, 26, 20], 0.35)) : css(SOIL_RGB);
      g.lineWidth = (pass ? 0.09 : 0.17) * big * gone;
      for (let c = -1; c <= 1; c++) {
        const off = c * Math.max(s.paw * 0.55, 0.08);
        const [x0, y0] = onScreen(view, [spot[0] + off, spot[1], 0.01]);
        const [x1, y1] = onScreen(view, [spot[0] + off * 1.15, spot[1] - L * 0.6 * drawn, 0.01]);
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }
    g.restore();
  }
  // Puffs where its nose dabs at the ground as it snuffles, and where it stamps.
  const puffs: Array<[number, V3, number]> = [];
  for (const c of [W.snuffle * 0.3, W.snuffle * 0.8]) puffs.push([c, place(b.head, R.nose), 0.07]);
  puffs.push([W.dig + 0.02, place(b.head, R.nose), 0.1]);
  puffs.push([W.mark, markOf(s, R), 0.18]);
  puffs.forEach(([c, p0, r], q) => {
    const since = (t - c) * ACT_SECS.work;
    if (since < 0 || since > 0.18) return;
    const p: V3 = [p0[0], p0[1] + 0.05, 0.06 * big];
    if (nearSide(p, mid, view) === front) puff(g, view, p, r * big * (0.6 + ramp(since, 0, 0.06)) * (1 - ramp(since, 0.08, 0.18)), since * 2, 7 + q);
  });
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
  const { fling } = DIG_STROKE, each = (W.dig - W.snuffle) / s.digs;
  for (let k = 0; k < s.digs; k++) {
    const t0 = strokeAt(s, k) + (fling - 0.06) * each;
    if (t < t0 && a.graze < 0.5) continue;
    const since = frac(t - t0) * ACT_SECS.work;
    if (since > 0.75) continue;
    const sd = k % 2 ? -1 : 1;
    // From the claws of the paw that dug it, at the ground, as they flick the earth back.
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
 * Evolving: at the start a burst of earth and leaves out of its back, which covers the moment it changes into its new body;
 * then a swirl of leaves and crumbs of earth going round and up it as its moss and stones grow.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Badger, b: Bones, t: number, front: boolean): void {
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
      if (q % 3 === 0) leafBit(g, x, y, 0.9 * big * burst, q * 1.3 + since * 8);
      else lump(g, x, y, 0.3 * big * burst, q * 1.3 + since * 8, q % 3 === 1 ? SOIL_RGB : PEBBLE_RGB);
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
      else lump(g, x, y, 0.18 * big * k, ang * 2 + q, q % 3 ? SOIL_RGB : PEBBLE_RGB);
    }
  }
}

/**
 * The warm flash at the claws where each blow lands, drawn with the body rather than over all of it: in front of it when the
 * claws are on the viewer's side of it, and behind it, where the body covers it, when they are round the far side.
 */
function blowFlash(g: CanvasRenderingContext2D, view: View, s: Badger, b: Bones, R: Rest, t: number, front: boolean): void {
  const big = bigness(s), mid = b.body.t;
  g.save();
  g.globalCompositeOperation = 'lighter';
  BADGER_HITS[s.strike].forEach((h, q) => {
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
function badgerGlow(s: Badger, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
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

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, seeks and evolves. */
function badgerKind(s: Badger): Kind {
  const bones = badgerBones(s);
  const spec = specOf(s), R = restOf(s, spec);
  const atHits = (a: Anim): Bones[] => BADGER_HITS[s.strike].map((t) => bones({ ...a, act: { kind: 'strike', t } }));
  /** The top of everything on it but its legs, as a few points on their bones, so its outline on the screen can be found. Worked out once. */
  /**
   * Where the claws are as they flick the earth back at each stroke of a go, along the ground: the same every go, so worked out
   * once rather than posed again every frame.
   */
  let flung: V3[] | undefined;
  const flungOf = (): V3[] => {
    if (!flung) {
      const a0: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
      const each = (s.work.dig - s.work.snuffle) / s.digs;
      flung = Array.from({ length: s.digs }, (_, k) => place(bones({ ...a0, act: { kind: 'work', t: strokeAt(s, k) + (DIG_STROKE.fling - 0.06) * each } })[k % 2 ? 'fl2' : 'fr2'], R.tip));
    }
    return flung;
  };
  let crest: Array<[string, V3]> | undefined;
  const crestOf = (): Array<[string, V3]> => {
    if (!crest) {
      const b = bones({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
      crest = [];
      for (const pc of badgerBuild(s, 0)) {
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
    build: (lod) => badgerBuild(s, lod),
    // The variant's coat for its fur, its markings for the white of its face; the dark of its face's bands from its fur; grey
    // stone, green moss and leaves, dark earth and pale claws on every variant.
    palette: (coat, mark) => {
      // The kit a lighter tan than it grows into; the Tunnelclaw a darker, greyer brown.
      const fur = mix(coat, s.stage === 0 ? [176, 146, 112] : s.stage === 1 ? [96, 84, 78] : [128, 100, 78], s.stage === 1 ? 0.16 : 0.12);
      const dark = mix(fur, [40, 32, 34], 0.62), white = mix(mark, [252, 248, 238], 0.25);
      const earth = mix(fur, [92, 66, 46], 0.55);
      const stone = mix([184, 164, 134], fur, 0.15);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: mix(fur, [52, 40, 38], 0.32),
        coatLight: mix(fur, [255, 246, 232], 0.3),
        mark: white,
        spot: dark,
        muzzle: mix(white, [236, 226, 210], 0.2),
        belly: mix(fur, [240, 228, 206], 0.55),
        lid: mix(dark, [24, 18, 20], 0.4),
        nose: [44, 34, 38],
        pad: [26, 20, 22],
        inner: [214, 160, 150],
        eye: [34, 22, 18],
        bloom: [222, 168, 64],
        glint: [255, 253, 246],
        claw: [236, 222, 192],
        hornDark: [176, 156, 128],
        stone,
        stoneDark: mix(stone, [70, 66, 70], 0.42),
        crystal: mix(stone, [236, 230, 214], 0.35),
        shell: mix(earth, [236, 222, 200], 0.25),
        shellDark: earth,
        bark: mix(earth, [130, 92, 60], 0.4),
        moss: [128, 150, 66],
        leaf: [144, 176, 80],
        ember: [194, 128, 66],
        leafDark: [96, 122, 56],
        stem: [110, 140, 66],
      }, 30);
    },
    shadow: [s.len * 0.8 + 0.25, s.body.w[4] * 1.05],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are moss green and the earth's brown.
    motes: [[146, 184, 86], [176, 128, 84]],
    glow: (b, a) => badgerGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') {
        strikeBurst(g, view, s, b, atHits(a), R, act.t, front);
        blowFlash(g, view, s, b, R, act.t, front);
      }
      else if (act.kind === 'work') seekSpray(g, view, s, b, R, a, act.t, front, flungOf(), crestOf());
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const DIRTLET = badgerKind(DIRTLET_LOOK);
export const TUNNELCLAW = badgerKind(TUNNELCLAW_LOOK);
export const EARTHREND = badgerKind(EARTHREND_LOOK);
