import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, DEG, disc, dot, frac, lerp, lifted, merge, mix, orbAlong, paint,
  quadBones, quadPose, scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
  type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces, under } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The gnaw line: the Sapgnaw, a round kit of a beaver sitting up on its big
 * hind feet with a sprig of maple on its head, which grows into the
 * Logchewer, a beaver on all fours under a mantle of wood-chip shingles and
 * leaves, and then the Timberlord, a massive one whose back bristles with a
 * crest of pale split stakes and whose buck teeth have grown into tusks. All
 * three carry the big flat paddle of a tail, bark-hatched and mossy. The
 * species is still `bevere` underneath, as saves and the database know it.
 *
 * Built the way the clay line is (`./wild-clay`): one set of functions from a
 * description of each stage, every foot given a point to be at and each leg
 * bent to reach it, the knee always the same way round, so a planted foot
 * stays where it was put and a knee never flips. What is its own: the body is
 * pitched up to sit on its haunches, its tail is set by where its tip is to
 * be over the ground, and at its task its teeth are carried to the bark of a
 * trunk in front of it bite by bite.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }
type HeadRings = Rings & { pitch: number; cream: number[] };

/** A pose it holds: how far its body is pitched up, how high its middle is, where its feet are, its neck's lean from upright and its tail tip's height. */
interface Mode { pitch: number; h: number; ankle: V3[]; foot: number[]; lean: number; tip: number; surge: number }

interface Gnaw {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest, at a pitch of nought. */
  body: Rings;
  /** Shoulder to hip. */
  len: number;
  /** The fore legs and the hind: upper, lower, and the ankle's height over the sole. */
  fore: [number, number, number];
  hind: [number, number, number];
  thick: number;
  hindThick: number;
  /** How far out its hips and shoulders are, as a share of the body's width there. */
  hip: number;
  /** How far down the barrel its shoulders and hips are, as shares of its depth there. */
  drop: [number, number];
  /** Each leg's upper and lower, standing (degrees): the lower's sign is which way that knee bends, for good. */
  bend: { fore: [number, number]; hind: [number, number] };
  /** A fore paw's size and its claws' length; a hind foot's length heel to toe and its claws'. */
  paw: number;
  claw: number;
  foot: number;
  toe: number;
  neck: { at: V3; len: number; w: number; lean: number };
  head: HeadRings;
  nose: number;
  eye: { y: number; up: number; size: number; tall: number };
  ear: { len: number; w: number; out: number; back: number; at: [number, number] };
  /** The buck teeth: how long, how wide each, and how far its mouth hangs open (a fold of the jaw). */
  teeth: { len: number; w: number; curve: number; open: number };
  /** The paddle: its length, half-width and half-thickness; its tilt up behind (degrees) standing, walking and gnawing. */
  tail: { len: number; w: number; t: number; up: [number, number, number] };
  /** Maple leaves: a sprig on its crown and a collar round its neck. */
  sprig: number;
  collar: number;
  /** Shingles of wood chips over its back and shoulders, in rows; down its neck and on its crown; sleeves on its fore legs and armour on its haunches. */
  mane: null | { from: number; to: number; rows: number; per: number; spread: number; a: number; b: number; t: number; lift: number; neck: number; crown: number; sleeve: number; haunch: number };
  /** The crest of stakes along its back: how many, how tall the tallest. */
  stakes: number;
  stakeLen: number;
  /** Standing: sat up on its haunches with its fore paws at its chest, or on all fours with its chest raised. */
  stand: { pitch: number; sit: boolean; lean: number };
  walk: { pitch: number; lean: number };
  gnaw: { pitch: number; sit: boolean; lean: number };
  gait: {
    /** Where each leg (fl, fr, hl, hr) is in its stride at a walk and at a run. */
    beats: [number[], number[]];
    duty: [number, number]; swing: [number, number];
    /** How high a foot is lifted, against the leg's length; how far the body goes down at a footfall, a walk's and a run's, and how many times a stride. */
    step: number; hindStep: number; bob: [number, number]; bobs: [number, number];
    /** How far the barrel rolls from side to side, and pitches; how far the tail sways (degrees); whether it drags its tail. */
    roll: number; rock: number; nod: number; sway: number; drag: boolean; jiggle: number;
  };
  strike: 0 | 1 | 2;
  /** Bites to a go at its task. */
  bites: number;
  size: number;
}

/** A head's rings scaled by `k` and its snout drawn out by `snout`. */
function headRings(k: number, snout: number, pitch: number, cream: number[]): HeadRings {
  const y = [-0.36, -0.3, -0.14, 0.04, 0.2, 0.32, 0.4, 0.45];
  return {
    y: y.map((v) => (v > 0.04 ? 0.04 + (v - 0.04) * snout : v) * k),
    z: [0.04, 0.05, 0.05, 0.03, -0.01, -0.05, -0.07, -0.08].map((v) => v * k),
    w: [0.18, 0.33, 0.42, 0.44, 0.38, 0.29, 0.22, 0.13].map((v) => v * k),
    h: [0.18, 0.31, 0.38, 0.38, 0.33, 0.26, 0.2, 0.12].map((v) => v * k),
    pitch, cream,
  };
}

/** A Sapgnaw: a round kit sat up on its haunches, its fore paws at its chest, a sprig of maple on its head and a collar of leaves. */
const SAPGNAW_LOOK: Gnaw = {
  stage: 0,
  body: { y: [-0.5, -0.41, -0.2, 0.03, 0.25, 0.4, 0.48], z: [0.03, 0.02, 0.01, 0.02, 0.04, 0.06, 0.08], w: [0.42, 0.72, 0.8, 0.72, 0.58, 0.44, 0.24], h: [0.34, 0.52, 0.58, 0.54, 0.46, 0.36, 0.2] },
  len: 0.62,
  fore: [0.22, 0.2, 0.06], hind: [0.25, 0.22, 0.06], thick: 0.11, hindThick: 1.35, hip: 0.52, drop: [0.68, 0.3],
  bend: { fore: [-20, 45], hind: [18, -44] },
  paw: 0.075, claw: 0.05, foot: 0.32, toe: 0.05,
  neck: { at: [0, 0.4, 0.2], len: 0.08, w: 0.36, lean: 60 },
  head: headRings(1.0, 1, 10, [-0.62, -0.58, -0.48, -0.34, -0.1, 0.2, 0.4, 0.62]),
  nose: 0.075,
  eye: { y: 0.17, up: 0.5, size: 0.088, tall: 1.12 },
  ear: { len: 0.15, w: 0.13, out: 62, back: 18, at: [0.28, 1.05] },
  teeth: { len: 0.27, w: 0.075, curve: 0.015, open: 0 },
  tail: { len: 0.95, w: 0.42, t: 0.075, up: [55, 22, 8] },
  sprig: 3, collar: 7,
  mane: null, stakes: 0, stakeLen: 0,
  stand: { pitch: 48, sit: true, lean: 12 },
  walk: { pitch: 20, lean: 60 },
  gnaw: { pitch: 62, sit: true, lean: 30 },
  gait: { beats: [[0.5, 0.56, 0, 0.06], [0.5, 0.56, 0, 0.06]], duty: [0.6, 0.42], swing: [19, 24], step: 0.3, hindStep: 0.27, bob: [0.08, 0.085], bobs: [1, 1], roll: 7, rock: 4, nod: 4, sway: 14, drag: false, jiggle: 0 },
  strike: 0,
  bites: 4,
  size: 3.1,
};

/** A Logchewer: on all fours with its chest raised, a mantle of chip shingles and leaves, shingle sleeves, long teeth and a big mossy tail. */
const LOGCHEWER_LOOK: Gnaw = {
  stage: 1,
  body: { y: [-1.0, -0.86, -0.46, 0, 0.44, 0.78, 0.94], z: [-0.04, -0.03, 0.02, 0.08, 0.15, 0.22, 0.27], w: [0.4, 0.7, 0.84, 0.86, 0.82, 0.68, 0.38], h: [0.36, 0.6, 0.72, 0.76, 0.76, 0.64, 0.36] },
  len: 1.3,
  fore: [0.56, 0.52, 0.1], hind: [0.37, 0.33, 0.09], thick: 0.28, hindThick: 1.32, hip: 0.5, drop: [0.3, 0.42],
  bend: { fore: [-16, 30], hind: [34, -62] },
  paw: 0.14, claw: 0.16, foot: 0.5, toe: 0.1,
  neck: { at: [0, 0.74, 0.42], len: 0.2, w: 0.5, lean: 60 },
  head: headRings(1.26, 1.15, 4, [-0.62, -0.58, -0.48, -0.34, -0.1, 0.2, 0.4, 0.62]),
  nose: 0.1,
  eye: { y: 0.2, up: 0.5, size: 0.088, tall: 1.05 },
  ear: { len: 0.18, w: 0.16, out: 62, back: 22, at: [0.28, 1.05] },
  teeth: { len: 0.36, w: 0.07, curve: 0.04, open: 0 },
  tail: { len: 1.3, w: 0.55, t: 0.11, up: [46, 4, 6] },
  sprig: 5, collar: 0,
  mane: { from: 0.9, to: -0.5, rows: 8, per: 8, spread: 1.2, a: 0.42, b: 0.22, t: 0.045, lift: 0.06, neck: 3, crown: 4, sleeve: 1, haunch: 1 },
  stakes: 0, stakeLen: 0,
  stand: { pitch: 8, sit: false, lean: 22 },
  walk: { pitch: 9, lean: 50 },
  gnaw: { pitch: 56, sit: true, lean: 32 },
  gait: { beats: [[0.25, 0.75, 0, 0.5], [0, 0.5, 0.5, 0]], duty: [0.66, 0.5], swing: [19, 23], step: 0.24, hindStep: 0.32, bob: [0.12, 0.14], bobs: [2, 2], roll: 6, rock: 1.4, nod: 3, sway: 16, drag: true, jiggle: 0.6 },
  strike: 1,
  bites: 3,
  size: 3.3,
};

/** A Timberlord: massive and heavy-shouldered, a crest of pale stakes over shingles and leaves, tusks for teeth, mouth open. */
const TIMBERLORD_LOOK: Gnaw = {
  stage: 2,
  body: { y: [-1.8, -1.56, -0.86, 0, 0.84, 1.42, 1.72], z: [-0.12, -0.08, 0.04, 0.2, 0.4, 0.56, 0.66], w: [0.8, 1.32, 1.6, 1.7, 1.82, 1.56, 0.84], h: [0.7, 1.1, 1.34, 1.48, 1.56, 1.36, 0.76] },
  len: 2.4,
  fore: [0.98, 0.9, 0.2], hind: [0.66, 0.58, 0.18], thick: 0.6, hindThick: 1.3, hip: 0.5, drop: [0.3, 0.42],
  bend: { fore: [-14, 26], hind: [32, -58] },
  paw: 0.3, claw: 0.36, foot: 0.95, toe: 0.22,
  neck: { at: [0, 1.3, 0.8], len: 0.62, w: 1.02, lean: 58 },
  head: headRings(2.45, 1.12, 6, [-0.62, -0.58, -0.48, -0.34, -0.1, 0.2, 0.4, 0.62]),
  nose: 0.16,
  eye: { y: 0.32, up: 0.52, size: 0.13, tall: 1.0 },
  ear: { len: 0.3, w: 0.26, out: 62, back: 22, at: [0.28, 1.05] },
  teeth: { len: 0.95, w: 0.12, curve: 0.18, open: 3.4 },
  tail: { len: 2.4, w: 1.04, t: 0.2, up: [44, 10, 8] },
  sprig: 6, collar: 0,
  mane: { from: 1.6, to: -1.45, rows: 10, per: 9, spread: 1.3, a: 0.58, b: 0.32, t: 0.08, lift: 0.22, neck: 3, crown: 4, sleeve: 1, haunch: 2 },
  stakes: 9, stakeLen: 1.4,
  stand: { pitch: 14, sit: false, lean: -4 },
  walk: { pitch: 6, lean: 40 },
  gnaw: { pitch: 14, sit: false, lean: 40 },
  gait: { beats: [[0.25, 0.75, 0, 0.5], [0, 0.5, 0.5, 0]], duty: [0.75, 0.58], swing: [10, 14], step: 0.1, hindStep: 0.2, bob: [0.26, 0.29], bobs: [2, 2], roll: 3.5, rock: 1.2, nod: 2, sway: 18, drag: false, jiggle: 0.4 },
  strike: 2,
  bites: 2,
  size: 2.7,
};

/** A number of its own for each thing, nought to one, so a pattern is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

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
/** A path through the air from `a` to `b`, `u` of the way, rising `up` over the straight line at its middle. */
function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}

/* ---- the strike and the task, in time ------------------------------------------------------- */

/** When each stage's blows land, as shares of its strike: the Sapgnaw's bite, the Logchewer's bite and its tail's slap, the Timberlord's slam. */
export const GNAW_HITS: ReadonlyArray<readonly number[]> = [[0.48], [0.5, 0.64], [0.58]];
/** A go at its task: its bites spread from `from` to `to`; it tugs at the trunk at `tug`, the tree giving, and its tail slaps at `slap`. */
export const GNAW_GO = { from: 0.08, to: 0.72, tug: 0.8, slap: 0.86 } as const;
/** Bites to a go, each stage's. */
export const GNAW_BITES: readonly number[] = [SAPGNAW_LOOK.bites, LOGCHEWER_LOOK.bites, TIMBERLORD_LOOK.bites];
/** How far through a bite its teeth close on the bark. */
export const BITE_AT = 0.55;
/** When each bite of a go closes on the bark, as shares of the go. */
export const biteTimes = (stage: number): number[] => {
  const st = Math.max(0, Math.min(2, stage)), n = GNAW_BITES[st], from = BITE_FROM[st], d = (GNAW_GO.to - from) / n;
  return Array.from({ length: n }, (_, k) => from + (k + BITE_AT) * d);
};
/** When each stage's first bite starts: once it has set itself to the trunk, so the first bite is not on top of getting there. */
export const BITE_FROM: readonly number[] = [0.18, 0.3, 0.18];

/* ---- its legs, by where its feet go ---------------------------------------------------------- */

/** How far a knee folds for a fold of one: the poses here give a knee in degrees, through this. */
const FOLD = 60;
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];

/** Where each ear is rooted on the head (the right one). */
function earRoot(s: Gnaw): V3 {
  const H = s.head, q = onRings(H, lerp(H.y[0], H.y[2], s.ear.at[0]), s.ear.at[1]);
  return sub(q.p, scale(q.n, 0.02 * (H.w[3] / 0.44)));
}

/** A stage's body on four legs (`QuadSpec`). */
const specOf = (s: Gnaw): QuadSpec => ({
  high: s.fore[0] + s.fore[1] + 0.5,
  fore: { at: [s.body.w[4] * s.hip, s.len * 0.5, s.body.z[4] - s.body.h[4] * s.drop[0]], len: s.fore, rest: [s.bend.fore[0], s.bend.fore[1], 0], fold: [FOLD, FOLD], toe: [s.paw, s.paw] },
  hind: { at: [s.body.w[2] * s.hip, -s.len * 0.5, s.body.z[2] - s.body.h[2] * s.drop[1]], len: s.hind, rest: [s.bend.hind[0], s.bend.hind[1], 0], fold: [FOLD, FOLD], toe: [s.foot, s.foot * 0.1] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: s.gait.duty,
  graze: 0, nose: 0, bow: 0, rock: 0,
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
  const most = (L0 + L1) * 0.985, ease = (L0 + L1) * 0.95, d0 = Math.hypot(loc[1], loc[2]);
  const D = clamp(d0 > ease ? ease + (most - ease) * Math.tanh((d0 - ease) / (most - ease)) : d0, Math.abs(L0 - L1) + 0.04 * (L0 + L1), most);
  const b = (rest[1] >= 0 ? 1 : -1) * Math.acos(clamp((D * D - L0 * L0 - L1 * L1) / (2 * L0 * L1), -1, 1));
  const a = Math.atan2(loc[1], -loc[2]) - Math.atan2(L1 * Math.sin(b), L0 + L1 * Math.cos(b));
  return [a / DEG - rest[0], (rest[1] - b / DEG) / FOLD];
}

/** Where the tail comes out of the rump, in the body's frame. */
const tailRoot = (s: Gnaw): V3 => [0, s.body.y[0] + (s.body.y[1] - s.body.y[0]) * 0.7, s.body.z[0] - s.body.h[1] * 0.3];

/** How low the barrel comes, pitched `pitch`, under its middle. */
function barrelLow(s: Gnaw, pitch: number): number {
  const B = s.body;
  let low = Infinity;
  for (let q = 0; q < B.y.length; q++) for (let j = 0; j < 16; j++) {
    const th = (j / 16) * TAU;
    low = Math.min(low, rotX([B.w[q] * Math.cos(th), B.y[q], B.z[q] + B.h[q] * Math.sin(th)], pitch)[2]);
  }
  return low;
}

/** A stage at rest: its poses, and what of it would go into the ground or meet the bark. */
interface Rest {
  stand: Mode; walk: Mode; gnaw: Mode;
  /** The points of each foot that could touch the ground, in its frame. */
  sole: V3[][];
  /** The tips of its teeth, in the head's frame; the underside of its head, and of its jaw. */
  teeth: V3; chin: V3[]; jawLow: V3[];
  /** Where the bark of the trunk it gnaws is, along the ground ahead of its middle; how long its head is. */
  trunk: number; headLen: number;
  /** A leg's reach, fore and hind; how tall it stands, to the top of its head or its crest. */
  foreLen: number; hindLen: number; top: number;
}

/** The tips of its buck teeth, in the head's frame. */
function teethTip(s: Gnaw): V3 {
  const H = s.head, last = H.y.length - 1, T = s.teeth;
  return [0, H.y[last] - H.h[last] * 0.35 + T.curve, H.z[last] - H.h[last] * 0.7 - T.len];
}

/** A fore paw held up in front of its chest, the elbow bent down under it: as far forward of the shoulder as most of the arm, and a little up. */
function chestPaw(s: Gnaw, spec: QuadSpec, i: number, pitch: number, h: number, surge = 0): V3 {
  const sh = rotX([SIDE[i] * spec.fore.at[0], spec.fore.at[1], spec.fore.at[2]], pitch), arm = s.fore[0] + s.fore[1];
  return [sh[0] * 0.8, sh[1] + arm * 0.64 + surge, sh[2] + h + arm * 0.2];
}

/** A pose, held: its body pitched `pitch`, sat on its haunches or stood on all fours. */
function modeOf(s: Gnaw, spec: QuadSpec, pitch: number, sit: boolean, lean: number, up: number): Mode {
  const at = (i: number): V3 => { const L = i < 2 ? spec.fore : spec.hind; return [SIDE[i] * L.at[0], L.at[1], L.at[2]]; };
  const rest = (i: number): V3 => { const L = i < 2 ? spec.fore : spec.hind, r = L.rest ?? [0, 0, 0]; return add(rotX(at(i), pitch), rotX(ankleAt(L.len, r[0], r[1]), pitch)); };
  const ankle: V3[] = [];
  let h: number;
  if (!sit) {
    const f = rest(0);
    h = Math.max(s.fore[2] - f[2], 0.02 * (s.len / 0.66) - barrelLow(s, pitch));
    for (let i = 0; i < 4; i++) {
      const a = rest(i);
      ankle.push([a[0], a[1], i < 2 ? s.fore[2] : s.hind[2]]);
    }
  } else {
    // Sat on its rump: the barrel down to the ground, its hind feet flat in front of its hips and its fore paws held at its chest.
    h = 0.04 * (s.len / 0.66) - barrelLow(s, pitch);
    for (let i = 0; i < 4; i++) {
      if (i < 2) ankle.push(chestPaw(s, spec, i, pitch, h));
      else {
        const hip = rotX(at(i), pitch);
        ankle.push([hip[0] * 1.12, hip[1] + s.hind[0] * 0.5, s.hind[2]]);
      }
    }
  }
  const root = rotX(tailRoot(s), pitch)[2] + h;
  const tip = Math.max(s.tail.t * 1.1 + 0.012, root + s.tail.len * Math.sin(up * DEG));
  return { pitch, h, ankle, foot: [sit ? 30 : 0, sit ? 30 : 0, 0, 0], lean, tip, surge: 0 };
}

function restOf(s: Gnaw, spec: QuadSpec): Rest {
  const stand = modeOf(s, spec, s.stand.pitch, s.stand.sit, s.stand.lean, s.tail.up[0]);
  const walk = modeOf(s, spec, s.walk.pitch, false, s.walk.lean, s.tail.up[1]);
  const gnaw = modeOf(s, spec, s.gnaw.pitch, s.gnaw.sit, s.gnaw.lean, s.tail.up[2]);
  // Setting itself to the trunk it keeps its feet where they stand and moves its body over them: sat back onto its hind feet,
  // or, on all fours, all four where they are.
  if (s.gnaw.sit) gnaw.surge = stand.ankle[2][1] - gnaw.ankle[2][1];
  for (let i = s.gnaw.sit ? 2 : 0; i < 4; i++) gnaw.ankle[i] = [...stand.ankle[i]] as V3;
  if (!s.gnaw.sit) gnaw.h = stand.h;
  const H = s.head, last = H.y.length - 1;
  const teeth = teethTip(s);
  const R: Rest = {
    stand, walk, gnaw, teeth,
    chin: [...H.y.map((y, q) => [0, y, H.z[q] - H.h[q]] as V3), teeth, [teeth[0] + s.teeth.w * 2, teeth[1], teeth[2]]],
    jawLow: jawPoints(s),
    trunk: 0, headLen: H.y[last] - H.y[0],
    foreLen: s.fore[0] + s.fore[1], hindLen: s.hind[0] + s.hind[1],
    top: stand.h + Math.max(...s.body.h.map((h, q) => h + s.body.z[q])) + s.stakeLen * 0.9 + s.head.h[3] * 1.5,
    sole: [0, 1, 2, 3].map((i) => {
      if (i < 2) return [[0, s.paw * 1.0 + s.claw * 0.9, -s.fore[2] + 0.004], [0, -s.paw * 0.6, -s.fore[2]], [s.paw * 0.6, s.paw * 0.8, -s.fore[2]]] as V3[];
      return [[0, s.foot + s.toe * 0.9, -s.hind[2] + 0.004], [0, -s.foot * 0.12, -s.hind[2]], [s.foot * 0.3, s.foot * 0.7, -s.hind[2]], [-s.foot * 0.3, s.foot * 0.7, -s.hind[2]]] as V3[];
    }),
  };
  // The trunk: as far ahead as its teeth come gnawing, stretched a little toward it.
  const p = quadPose(spec, { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
  const plan = stillPlan(gnaw);
  aim(s, p, plan);
  const b = quadBones(spec, p);
  R.trunk = Math.min(place(b.head, teeth)[1] + gnaw.surge + R.headLen * 0.2, teethY(spec, R, p, plan, 0.8, bodyShare(s)));
  // Sat to gnaw, its fore paws on the bark, a little under its chin.
  if (gnaw.ankle && s.gnaw.sit) {
    const tz = place(b.head, teeth)[2] - b.body.t[2] + gnaw.h;
    for (const i of [0, 1]) gnaw.ankle[i] = [SIDE[i] * s.body.w[5] * 0.4, R.trunk - s.paw * 0.9, Math.max(s.fore[2] + 0.05, tz - R.headLen * 0.35)];
    gnaw.foot = [70, 70, 0, 0];
  }
  return R;
}

/**
 * Where its feet are to be this moment and how the rest of it is carried: for each leg the point its ankle is to be at (from
 * under the body's middle along the ground, and its height over the ground) and how its foot is pitched past level; how high
 * its middle is, how far it is carried forward, its pitch, its neck's lean from upright; the barrel's roll and rock; where its
 * tail's tip is over the ground and how far it is swung and banked; and how much its teeth go for the bark at `bite`.
 */
interface Plan { at: V3[]; foot: number[]; H: number; surge: number; pitch: number; lean: number; roll: number; rock: number; tip: number; sway: number; bank: number; reach: number; bite: number }

function stillPlan(M: Mode): Plan {
  return { at: M.ankle.map((a) => [...a] as V3), foot: [...M.foot], H: M.h, surge: M.surge, pitch: M.pitch, lean: M.lean, roll: 0, rock: 0, tip: M.tip, sway: 0, bank: 0, reach: 0, bite: 0 };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)),
    foot: a.foot.map((x, i) => lerp(x, b.foot[i], k)),
    H: lerp(a.H, b.H, k), surge: lerp(a.surge, b.surge, k), pitch: lerp(a.pitch, b.pitch, k), lean: lerp(a.lean, b.lean, k),
    roll: lerp(a.roll, b.roll, k), rock: lerp(a.rock, b.rock, k), tip: lerp(a.tip, b.tip, k), sway: lerp(a.sway, b.sway, k), bank: lerp(a.bank, b.bank, k),
    reach: lerp(a.reach, b.reach, k), bite: lerp(a.bite, b.bite, k),
  };
}

/** The neck and the head turned against the body's pitch: the neck at the plan's lean from upright, the head carried level. */
function aim(s: Gnaw, p: QuadPose, plan: Plan): void {
  p.pitch = plan.pitch;
  p.roll = 0;
  p.neck[0] += plan.lean - s.neck.lean + plan.pitch;
  p.head[0] -= plan.pitch;
}

/** How much of a swing at either end a foot goes straight up off the ground or down onto it. */
const SWING_EDGE = 0.1;

/**
 * Going: each foot down for its share of a stride, swept back under the body at the speed the ground goes by, and brought
 * forward again through the air, leaving the ground and landing on it at the ground's speed so it never skates. The Sapgnaw
 * hop-shuffles, both hind feet nearly together and then both fore, rocking and rolling; the Logchewer rolls along a four-beat
 * waddle dragging its tail; the Timberlord lumbers, slow and heavy, its tail swinging.
 */
function goingPlan(s: Gnaw, spec: QuadSpec, R: Rest, a: Anim): Plan {
  const G = s.gait, g = a.gait, w = frac(a.u), run = g >= 0.5 ? 1 : 0;
  const M = R.walk;
  const duty = lerp(G.duty[0], G.duty[1], g), amp = lerp(G.swing[0], G.swing[1], g);
  const legLen = Math.min(R.foreLen, R.hindLen);
  const half = legLen * Math.sin(amp * DEG);
  const beats = G.beats[run];
  const bob = lerp(G.bob[0], G.bob[1], g), bobs = G.bobs[run];
  // Lowest as the weight comes down on the feet: once a stride for a hop, twice for a walk.
  const low = bobs === 1 ? frac(beats[0] + duty * 0.3) : frac(0.75 + duty / 2);
  const drop = bob * (0.5 + 0.5 * Math.cos(bobs * TAU * (w - low)));
  const at: V3[] = [], foot: number[] = [];
  for (let i = 0; i < 4; i++) {
    const ph = frac(a.u + beats[i]), A = M.ankle[i];
    if (ph < duty) {
      at.push([A[0], A[1] + half * (1 - (2 * ph) / duty), A[2]]);
      foot.push(0);
      continue;
    }
    const u = (ph - duty) / (1 - duty), v = ((2 * half) / duty) * (1 - duty), e = s.stage ? 0.14 : SWING_EDGE;
    const L = i < 2 ? R.foreLen : R.hindLen, lift = (i < 2 ? G.step : G.hindStep - (s.stage === 0 ? 0.02 * g : 0)) * L * (1 + 0.2 * g) * (g > 0.5 && s.stage ? 0.85 : 1);
    const y0 = A[1] - half - v * e, y1 = A[1] + half + v * e;
    const y = u < e ? A[1] - half - v * u : u > 1 - e ? A[1] + half + v * (1 - u) : hermite(y0, y1, -v * (1 - 2 * e), -v * (1 - 2 * e), (u - e) / (1 - 2 * e));
    at.push([A[0], y, A[2] + lift * (1 - (1 - Math.sin(Math.PI * u)) ** 1.6)]);
    // A fore paw goes over on its knuckles as it comes forward; a big hind foot hangs a little toe-down.
    // A big hind foot is carried level, toes a little up on the big ones, so its long sole clears the ground at the top of the swing.
    foot.push((i < 2 ? 18 : s.stage === 2 ? 6 : s.stage === 1 ? 0 : -10) * Math.sin(Math.PI * u) ** 2);
  }
  const roll = G.roll * Math.sin((w - low) * TAU + Math.PI / 2) * (bobs === 1 ? 1 : 0.8);
  const rock = G.rock * Math.sin((w - low) * TAU * bobs);
  // The tail: dragged along the ground and swaying, or carried just off it and swung.
  const sway = G.sway * Math.sin(w * TAU + 1.2);
  const tip = G.drag ? s.tail.t * 1.1 + 0.012 : M.tip + (s.stage === 0 ? 0.04 * Math.sin(w * TAU) : 0.03 * Math.sin(w * TAU * 2));
  // The kit carried a little lower at a walk, so its short fore legs keep their paws flat on the ground to the end of each stance.
  return { at, foot, H: M.h - drop - (s.stage === 0 ? 0.016 * (1 - g) : 0), surge: 0, pitch: M.pitch + rock, lean: M.lean, roll, rock: 0, tip, sway, bank: -0.3 * sway, reach: 0, bite: 0 };
}

/* ---- standing ------------------------------------------------------------------------------- */

/** A slap of the tail, `len` seconds long from each of `at`: lifted slowly, brought down fast, a little bounce. */
function slapOf(t: number, at: readonly number[], len: number): number {
  let k = 0;
  for (const x of at) {
    const u = (t - x) / len;
    if (u <= 0 || u >= 1) continue;
    k = Math.max(k, u < 0.62 ? smooth(u / 0.62) : u < 0.74 ? 1 - smooth((u - 0.62) / 0.12) : 0.18 * Math.sin(Math.PI * (u - 0.74) / 0.26));
  }
  return k;
}

/** Standing about: sat up, its nose twitching in bursts, looking about, and now and then a slap of its tail on the ground. */
function still(s: Gnaw, R: Rest, p: QuadPose, a: Anim): Plan {
  const plan = stillPlan(R.stand);
  const t = a.t;
  const twitch = beat(t, [1.5, 7.2, 11.8, 16.4, 21.3], 1.4);
  p.head[0] += 2.6 * Math.sin(t * TAU * 6) * twitch;
  p.head[2] += 1.4 * Math.sin(t * TAU * 3) * twitch;
  const sniff = beat(t, [4.4, 18.6], 1.6);
  p.neck[0] += 6 * sniff;
  p.head[0] += 6 * sniff;
  const slap = slapOf(t, [9.3, 14.0, 22.4], 0.9);
  plan.tip += s.tail.len * 0.45 * slap;
  if (s.stand.sit) {
    // Its paws fidgeting at its chest as it sniffs.
    for (const i of [0, 1]) plan.at[i] = add(plan.at[i], [0, 0, s.fore[0] * 0.15 * twitch * Math.sin(t * TAU * 1.5 + i)]);
  }
  return plan;
}

/* ---- the task ------------------------------------------------------------------------------- */

/** A go at its task: how far it is set to the trunk (eased in and out of, unless it is already at it). */
const downOf = (t: number, graze: number, rise = 0.18, end = 0.76): number => Math.max(graze, ramp(t, 0, rise) * (1 - ramp(t, end, 1)));
/** When a go played once lets go of the trunk: the Logchewer, dropping from sitting to all fours, takes longer over it. */
const endOf = (s: Gnaw): number => (s.stage === 1 ? 0.64 : 0.76);
/** How long a stage takes to set itself to the trunk at the start of a go played once: the Logchewer rears up to sit, which takes longer. */
const riseOf = (s: Gnaw): number => BITE_FROM[s.stage];

/** Which bite it is at, and how far through it. */
function biteOf(s: Gnaw, t: number): { k: number; w: number } | null {
  const from = BITE_FROM[s.stage];
  if (t < from || t >= GNAW_GO.to) return null;
  const x = ((t - from) / (GNAW_GO.to - from)) * s.bites, k = Math.min(s.bites - 1, Math.floor(x));
  return { k, w: x - k };
}
/** How far its teeth are drawn back off the bark through a bite: back and open, then driven in, closing at `BITE_AT`. */
const pullOf = (w: number): number => (w < BITE_AT ? Math.sin((Math.PI * w) / BITE_AT) ** 2 : 0);
/** How far its mouth is open through a bite: opened slowly as it draws back, snapped shut as its teeth go in. */
const gapeOf = (w: number): number => (w < 0.45 ? smooth(w / 0.45) : w < BITE_AT ? 1 - smooth((w - 0.45) / (BITE_AT - 0.45)) : 0);

/** The tug at the end of a go, as the tree gives: back, and forward again to where it was. */
const tugOf = (t: number): number => ramp(t, GNAW_GO.to, GNAW_GO.tug + 0.04) * (1 - ramp(t, GNAW_GO.tug + 0.05, 0.995));

/**
 * A go at its task, gnawing a trunk: set to it -- the Sapgnaw and the Logchewer sat up with their fore paws on the bark, the
 * Timberlord braced on all fours -- its head pumping, each bite drawn back with its mouth open and driven in, its jaw closing
 * on the bark, a grind side to side as the chip comes away; then a tug back as the tree gives, and its tail slapped down.
 */
function workPlan(s: Gnaw, R: Rest, p: QuadPose, t: number, down: number): Plan {
  const plan = mixPlan(stillPlan(R.stand), stillPlan(R.gnaw), down);
  const bt = biteOf(s, t);
  const pull = bt ? pullOf(bt.w) : 0, gape = bt ? gapeOf(bt.w) : 0;
  const grind = bt && bt.w > BITE_AT ? Math.sin((TAU * (bt.w - BITE_AT)) / (1 - BITE_AT)) : 0;
  const tug = tugOf(t);
  plan.reach = down;
  const draw = [0.22, 0.22, 0.22][s.stage];
  plan.bite = R.trunk - R.headLen * (draw * pull + (s.stage === 2 ? 0.12 : 0.2) * tug);
  // Each bite in the whole of it: a lean back as it draws back, forward as it drives in, and the shoulders with it; the kit
  // rocking its whole body into it, and rolling with the grind, so it is seen from behind; the big one heaving back.
  plan.pitch += down * ([5, 2.2, 2.2][s.stage] * pull - 1.5 * tug);
  plan.roll += down * (s.stage === 0 ? 3 : 1.5) * grind;
  plan.surge -= down * s.len * (0.07 * tug + (s.stage === 2 ? 0.035 : 0) * pull);
  // Its paws on the bark give a little with each draw, rather than holding the shoulders where the body pulls them from.
  if (s.gnaw.sit) for (const i of [0, 1]) plan.at[i] = add(plan.at[i], [0, -0.3 * R.headLen * draw * pull * down, 0]);
  p.jaw += down * ([2.4, 1.9, 1.5][s.stage] * gape);
  p.head[2] += down * 9 * grind;
  p.neck[1] += down * 4 * grind;
  p.head[0] += down * (-6 * pull + 8 * tug);
  // The tail: down on the ground as a prop while it gnaws, lifted as it tugs and slapped down as the tree gives.
  const slap = ramp(t, GNAW_GO.to, GNAW_GO.slap - 0.07) * (1 - ramp(t, GNAW_GO.slap - 0.07, GNAW_GO.slap));
  const floor = s.tail.t * 1.1 + 0.012;
  plan.tip = lerp(plan.tip, floor + s.tail.len * 0.6, down * slap);
  plan.tip += down * s.tail.len * (0.06 * hump(t, GNAW_GO.slap + 0.04, 0.05) + 0.05 * pull);
  plan.sway += (down * 6 * grind) / (1 + s.stage);
  for (const e of p.ears) e[0] += down * [25, 9, 7][s.stage] * (pull + tug);
  return plan;
}

/* ---- the strike ------------------------------------------------------------------------------ */

/** The Sapgnaw's lunge: it sits back gathering itself, mouth opening, lunges down and forward onto its fore paws snapping its teeth shut, and sits back up. */
function lungePlan(s: Gnaw, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R.stand), hit = GNAW_HITS[0][0];
  const gather = ramp(t, 0.02, 0.22) * (1 - ramp(t, 0.22, 0.34));
  const out = ramp(t, 0.24, hit - 0.02) * (1 - ramp(t, 0.66, 0.94));
  const J = (s.body.y[6] - s.body.y[0]) * 0.32;
  plan.pitch = lerp(R.stand.pitch, 6, out) + 6 * gather;
  plan.H = lerp(R.stand.h, R.walk.h * 0.95, out);
  plan.surge = J * out;
  plan.lean = lerp(R.stand.lean, 58, out) - 8 * gather;
  for (const i of [0, 1]) {
    const ground: V3 = [R.walk.ankle[i][0], R.walk.ankle[i][1] + J * 1.6, s.fore[2]];
    const k = ramp(t, 0.18, hit) * (1 - ramp(t, 0.66, 0.94));
    plan.at[i] = mixV(R.stand.ankle[i], ground, k);
    plan.at[i][2] += s.fore[0] * 0.5 * Math.sin(Math.PI * k) * (t < 0.6 ? 1 : 0.6);
    plan.foot[i] = lerp(30, 0, k);
  }
  p.jaw += 2.8 * ramp(t, 0.12, 0.36) * (1 - ramp(t, hit - 0.06, hit));
  p.head[0] += -8 * out + 10 * gather - 4 * hump(t, hit, 0.06);
  p.neck[1] += 0;
  plan.tip = lerp(plan.tip + s.tail.len * 0.08 * gather, s.tail.t * 1.1 + 0.012, 0.4 * out) + s.tail.len * 0.1 * hump(t, hit + 0.04, 0.07);
  for (const e of p.ears) e[0] += 26 * gather + 10 * out;
  return plan;
}

/** The Logchewer's rearing bite: it rears up with its fore paws drawn to its chest and its mouth open, drops onto them biting, and slaps its tail down behind. */
function rearPlan(s: Gnaw, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R.stand), [hit, slapAt] = GNAW_HITS[1];
  // Up over the first third, and down onto the bite gathering speed, fastest as the teeth go home.
  const rear = ramp(t, 0.0, 0.32) * (1 - clamp((t - 0.28) / (hit - 0.28)) ** 2);
  const lunge = clamp((t - 0.28) / (hit - 0.28)) ** 2 * (1 - ramp(t, 0.66, 0.96));
  const J = s.len * 0.18;
  plan.pitch += 28 * rear - 4 * lunge;
  plan.H += R.stand.h * (0.12 * rear - 0.04 * lunge);
  plan.surge = J * lunge;
  plan.lean += -10 * rear + 22 * lunge;
  for (const i of [0, 1]) {
    const A = R.stand.ankle[i];
    const up = mixV(A, chestPaw(s, specOf(s), i, plan.pitch, plan.H, plan.surge), 0.38);
    const down: V3 = [A[0], A[1] + J * 1.6, A[2]];
    if (t < hit) plan.at[i] = mixV(arc(A, up, ramp(t, 0.0, 0.32), s.fore[0] * 0.2), down, ((clamp((t - 0.28) / (hit - 0.28))) ** 2));
    else if (t < 0.72) plan.at[i] = down;
    else plan.at[i] = arc(down, A, ramp(t, 0.72 + 0.06 * i, 0.92 + 0.04 * i), s.fore[0] * 0.3);
    plan.foot[i] = 24 * rear;
  }
  p.jaw += 2.8 * ramp(t, 0.1, 0.34) * (1 - ramp(t, hit - 0.05, hit));
  p.head[0] += 14 * rear - 10 * hump(t, hit, 0.08);
  // The tail lifted behind as it rears, and slapped flat as the bite goes home.
  const floor = s.tail.t * 1.1 + 0.012;
  const raised = lerp(R.stand.tip, floor + s.tail.len * 0.85, ramp(t, 0.1, slapAt - 0.12));
  plan.tip = lerp(lerp(raised, floor, ramp(t, slapAt - 0.09, slapAt)), R.stand.tip, ramp(t, slapAt + 0.1, 0.98)) + s.tail.len * 0.05 * hump(t, slapAt + 0.05, 0.05);
  plan.sway += 10 * Math.sin(t * TAU * 1.5) * rear;
  plan.tip += s.tail.len * 0.1 * hump(t, hit + 0.04, 0.06);
  for (const e of p.ears) e[0] += 24 * 0.7 * rear;
  return plan;
}

/** Nought to one at an even speed but for a quarter at either end where it gets going and slows: the most it moves is a third over its average. */
function trapezoid(u: number): number {
  const x = clamp(u), a = 0.25, v = 1 / (1 - a);
  return x < a ? (v * x * x) / (2 * a) : x < 1 - a ? v * (x - a / 2) : 1 - (v * (1 - x) ** 2) / (2 * a);
}

/** How long the Timberlord's slam takes to come down, as a share of its strike: after it has reared and held a moment at the top. */
const SLAM_DROP = 0.16;
/** How far reared up the Timberlord is through its strike: up, held at the top a moment, and dropped, fastest as it lands. */
function slamRear(t: number): number {
  const hit = GNAW_HITS[2][0], top = hit - SLAM_DROP;
  return trapezoid((t - 0.0) / top) * (1 - clamp((t - top) / (hit - top)) ** 2);
}

/** The Timberlord's slam: it rears up onto its haunches, both fore paws high, its tusked mouth gaping, and slams them down biting, the ground and its crest shaking. */
function slamPlan(s: Gnaw, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R.stand), hit = GNAW_HITS[2][0];
  const top = hit - SLAM_DROP, rear = slamRear(t);
  const shake = t > hit ? Math.sin((t - hit) * 26) * (1 - ramp(t, hit, 0.85)) : 0;
  const land = hump(t, hit + 0.05, 0.13);
  plan.H += R.stand.h * (0.16 * rear - 0.05 * land) + 0.02 * shake;
  plan.pitch += 24 * rear - 3 * land;
  plan.lean += -12 * rear + 8 * land;
  plan.rock += 2.5 * shake;
  plan.roll += 2 * shake;
  for (const i of [0, 1]) {
    const A = R.stand.ankle[i];
    const high: V3 = [A[0] * 1.1, A[1] + R.foreLen * 0.3, A[2] + R.foreLen * 0.6];
    const down: V3 = [A[0] * 0.95, A[1] + s.len * 0.08, A[2]];
    const [b0, b1] = i ? [0.74, 0.99] : [0.64, 0.9];
    if (t < top) plan.at[i] = mixV(A, high, trapezoid(t / top));
    else if (t < hit) plan.at[i] = mixV(high, down, ((t - top) / (hit - top)) ** 2);
    else if (t < b0) plan.at[i] = down;
    else if (t < b1) plan.at[i] = arc(down, A, ramp(t, b0, b1), R.foreLen * 0.08);
    plan.foot[i] = 18 * trapezoid(t / top) * (1 - ramp(t, top, hit)) - 8 * hump(t, hit, 0.04);
  }
  p.jaw += 1.6 * ramp(t, 0.06, top) * (1 - ramp(t, hit - 0.06, hit)) - 0.6 * hump(t, hit + 0.03, 0.06);
  p.head[0] += 12 * rear - 5 * land;
  const floor = s.tail.t * 1.1 + 0.012;
  // Its tail swung up behind as it rears and brought down with the slam, a flick at the blow, never thrown all the way down.
  plan.tip = Math.max(floor, R.stand.tip + s.tail.len * (0.1 * rear - 0.18 * hump(t, hit + 0.06, 0.16)));
  plan.sway += 5 * shake;
  for (const e of p.ears) e[0] += 20 * rear;
  return plan;
}

/** Evolving: hunched as the light gathers and its leaves and wood grow on it, then drawn up tall at the turn, a shake, and settled. */
function evolvePlan(s: Gnaw, R: Rest, p: QuadPose, t: number): Plan {
  const plan = stillPlan(R.stand);
  const hunch = ramp(t, 0.06, 0.38) * (1 - ramp(t, 0.38, 0.54)), up = ramp(t, 0.44, 0.6) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.64, 0.1) * Math.sin(t * (s.stage === 2 ? 46 : 64));
  if (s.stand.sit) plan.pitch += -6 * hunch + 6 * up;
  plan.lean += 10 * hunch - 8 * up;
  p.head[0] += -8 * hunch + 14 * up;
  p.head[2] += 10 * shake;
  plan.roll += 3 * shake;
  plan.tip += s.tail.len * 0.3 * up;
  for (const e of p.ears) e[0] += 25 * hunch;
  return plan;
}

/* ---- its bones ------------------------------------------------------------------------------- */

/** Its pose for what it is doing, over the one a body on four legs has (`quadPose`), and where its feet go. */
function planOf(s: Gnaw, R: Rest, p: QuadPose, a: Anim): Plan {
  const act = a.act;
  if (act?.kind === 'strike') return s.strike === 0 ? lungePlan(s, R, p, act.t) : s.strike === 1 ? rearPlan(s, R, p, act.t) : slamPlan(s, R, p, act.t);
  if (act?.kind === 'work') return workPlan(s, R, p, act.t, downOf(act.t, a.graze, riseOf(s), endOf(s)));
  if (act?.kind === 'evolve') return evolvePlan(s, R, p, act.t);
  if (a.graze > 0 && a.go <= 0) return workPlan(s, R, p, 0, a.graze);
  if (a.go <= 0) return still(s, R, p, a);
  const going = goingPlan(s, specOf(s), R, a), g = smooth(a.go);
  const G = s.gait, w = frac(a.u);
  p.neck[1] += g * 4 * Math.sin(w * TAU - 0.6);
  p.head[0] += g * G.nod * Math.sin(w * TAU * G.bobs[a.gait >= 0.5 ? 1 : 0] - 0.8);
  // The Timberlord's weight let down onto each fore foot: a squash of the barrel that shakes its crest.
  // The kit's round body let down and drawn out as it goes on all fours, so it walks long and low rather than as a box.
  if (s.stage === 0) p.squash += g * 0.28;
  if (s.stage === 2) p.squash += g * 0.03 * (Math.max(0, Math.cos(TAU * (w - 0.78))) ** 14 + Math.max(0, Math.cos(TAU * (w - 0.28))) ** 14);
  return a.go >= 1 ? going : mixPlan(still(s, R, p, a), going, g);
}

/** How thick a lower leg is: a hind shin slimmer than the haunch over it, which is all a beaver's hind leg shows. */
const lowerW = (s: Gnaw, fore: boolean): number => s.thick * (fore ? 1 : 1.12);

/** How low a leg's shin and knee come, the rings of their tubes as `legPieces` builds them: the lowest point of any. */
function shinLow(s: Gnaw, b: Bones, i: number): number {
  const fore = i < 2, key = LEGS4[i], L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick), wl = lowerW(s, fore);
  const end = Math.min(wl * 0.6, L[2] * 0.95);
  const rings: Array<[string, V3, number]> = [
    [`${key}0`, [0, 0, -L[0]], w * 0.62],
    [`${key}1`, [0, 0, 0], wl * 0.55], [`${key}1`, [0, 0.01, -L[1] * 0.5], lerp(wl * 0.55, end, 0.5)], [`${key}1`, [0, 0.017, -L[1] * 0.85], lerp(wl * 0.55, end, 0.85) * 0.8],
  ];
  let low = Infinity;
  for (const [bone, at, r] of rings) {
    const c = place(b[bone], at), d = sub(place(b[bone], add(at, [0, 0, -1])), c);
    low = Math.min(low, c[2] - r * Math.sqrt(Math.max(0, 1 - d[2] * d[2])));
  }
  return low;
}

/**
 * Leant `x` toward the trunk: the body tipped forward over its feet and the neck bowed with it, the head kept all but level, so
 * its teeth go forward as `x` grows (and back as it goes under nought) whatever the length of its neck.
 */
function bowed(p: QuadPose, x: number, body = 10): QuadPose {
  return { ...p, pitch: p.pitch - body * x, neck: [p.neck[0] + (36 - body) * x, p.neck[1]], head: [p.head[0] + (body - 4) * x, p.head[1], p.head[2]] };
}
/** How much of a lean toward the trunk is the body's: the Timberlord, braced on all four, leans with its neck. */
const bodyShare = (s: Gnaw): number => (s.stage === 2 ? 4 : 10);
/** Where its teeth tips are along the ground, leant `x` toward the trunk. */
function teethY(spec: QuadSpec, R: Rest, p: QuadPose, plan: Plan, x: number, body = 10): number {
  return place(quadBones(spec, bowed(p, x, body)).head, R.teeth)[1] + plan.surge;
}
/** How low its head and jaw come, over the ground, leant `x` (negative lifts it). */
function headOver(spec: QuadSpec, R: Rest, p: QuadPose, plan: Plan, x: number): number {
  const b = quadBones(spec, bowed(p, x));
  return Math.min(...R.chin.map((c) => place(b.head, c)[2]), ...R.jawLow.map((c) => place(b.jaw, c)[2])) - b.body.t[2] + plan.H;
}

/**
 * The bones of a stage: its pose, its teeth carried to the bark when it gnaws, every leg bent to put its foot where the pose
 * says (`legTo`), the body raised to the height the pose says and carried forward as far, the barrel rolled and rocked over its
 * legs, and its tail laid from its rump to where its tip is to be.
 */
function gnawBones(s: Gnaw): (a: Anim) => Bones {
  const spec = specOf(s), R = restOf(s, spec), root = tailRoot(s);
  return (a) => {
    const p = quadPose(spec, { ...a, graze: 0, go: a.act ? 0 : a.go });
    p.lift = 0;
    p.jaw = s.teeth.open;
    const plan = planOf(s, R, p, a);
    aim(s, p, plan);
    // Its teeth carried to the bark: the neck bowed toward the trunk, and the head with it, as far as puts them there.
    if (plan.reach > 0) {
      const k = bodyShare(s), y0 = teethY(spec, R, p, plan, 0, k), want = lerp(y0, plan.bite, plan.reach);
      let lo = -1.2, hi = 1.6;
      for (let q = 0; q < 16; q++) {
        const mid = (lo + hi) / 2;
        if (teethY(spec, R, p, plan, mid, k) < want) lo = mid;
        else hi = mid;
      }
      Object.assign(p, bowed(p, (lo + hi) / 2, k));
    }
    // However it is posed, its head and teeth never down in the ground.
    if (headOver(spec, R, p, plan, 0) < 0.012) {
      let lo = -1.5, hi = 0;
      for (let q = 0; q < 14; q++) {
        const mid = (lo + hi) / 2;
        if (headOver(spec, R, p, plan, mid) < 0.012) hi = mid;
        else lo = mid;
      }
      Object.assign(p, bowed(p, lo));
    }
    for (let i = 0; i < 4; i++) {
      const g = plan.at[i], floor = Math.max(...R.sole[i].map((q) => -rotX(q, plan.foot[i])[2]));
      if (g[2] < floor) g[2] = floor;
      p.foot[i] = plan.foot[i];
    }
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
    // Nor a shin or a knee: a leg whose shin would dip into the ground has its foot put up by as much and is bent again; in a
    // strike, whose hind feet stay down, the body is raised instead.
    const planted = !!a.act || a.graze > 0;
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
    b.shadow = shadowOf(b.body, Math.max(0, plan.H - R.walk.h - 0.05));
    if (plan.surge) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + plan.surge, b[k].t[2]] };
    if (plan.roll || plan.rock) b.trunk = joint(b.trunk, [0, 0, 0], plan.rock, plan.roll, 0);
    // The tail: from its root on the rump, straight back to where its tip is to be over the ground, swung and banked.
    const r0 = place(b.trunk, root), L = s.tail.len;
    const E = Math.asin(clamp((plan.tip - r0[2]) / L, -0.98, 0.98)) / DEG;
    b.tail0 = joint({ m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: r0 } as Xf, [0, 0, 0], -E, plan.bank, plan.sway);
    return b;
  };
}

/* ---- wood, leaves and the rest of what it wears ---------------------------------------------- */

/** The tones of its wood: pale tan, light brown and dark brown chips, each a lit face and a shaded one; and the pale stakes. */
const TONES: ReadonlyArray<readonly [Mat, Mat]> = [['wood', 'woodDark'], ['shell', 'shellDark'], ['crystal', 'crystalDark']];

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

/** A frame on a surface: `n` out of it, `y` along the way something lies on it, `x` across. */
function frameOf(n: V3, along: V3): { x: V3; y: V3; z: V3 } {
  const z = unit(n), y = unit(sub(along, scale(z, dot(along, z)))), x = cross(y, z);
  return { x, y, z };
}

/**
 * A shingle of wood: a split chip, long and pointed, its top ridged down the middle into a lit half and a shaded half so it
 * reads as split wood, its root sunk into the body and its tip lifted off it, lying the way `along` says.
 */
function shingle(root: V3, n: V3, along: V3, a: number, b: number, t: number, lift: number, tone: number, id: number): Mesh {
  const { x, y, z } = frameOf(n, along);
  const [lit, dark] = TONES[tone % 3];
  const out: Array<[number, number]> = [[0, -0.22], [0.66, -0.04], [0.92, 0.36], [0.56, 0.78], [0, 1.06], [-0.56, 0.78], [-0.92, 0.36], [-0.66, -0.04]];
  const k = 0.9 + 0.2 * jitter(id), S = out.length;
  const pt = (u: number, v: number, h: number): V3 => add(root, add(add(scale(x, u * b * k), scale(y, v * a * k)), scale(z, h + lift * Math.max(0, v))));
  const base = out.map(([u, v]) => pt(u * 0.94, v * 0.94, -t * 0.9));
  const top = out.map(([u, v]) => pt(u, v, t * 0.4));
  const ridge = [pt(0, -0.1, t * 1.3), pt(0, 0.9, t * 1.1)];
  const v: V3[] = [...base, ...top, ...ridge];
  const f: Face[] = [], want: V3[] = [];
  const mid = pt(0, 0.4, 0);
  for (let j = 0; j < S; j++) {
    const j1 = (j + 1) % S, o = unit(sub(scale(add(top[j], top[j1]), 0.5), mid));
    f.push({ i: [j, j1, S + j1, S + j], m: dark, soft: true });
    want.push(o);
  }
  // The top: each half a fan to its end of the ridge, lit on the right and shaded on the left.
  const R0 = 2 * S, R1 = 2 * S + 1;
  const half = (js: number[], m: Mat, sgn: number): void => {
    for (let q = 0; q < js.length - 1; q++) {
      const a0 = js[q], a1 = js[q + 1], r = out[a0][1] + out[a1][1] < 0.8 ? R0 : R1;
      f.push({ i: [S + a0, S + a1, r], m });
      want.push(unit(add(z, scale(x, 0.4 * sgn))));
    }
  };
  half([0, 1, 2, 3, 4], lit, 1);
  half([4, 5, 6, 7, 0], dark, -1);
  f.push({ i: [S + 0, R1, R0], m: lit });
  want.push(z);
  f.push({ i: [S + 4, R0, R1], m: dark });
  want.push(z);
  f.push({ i: [S + 2, R1, R0], m: lit });
  want.push(z);
  return mesh(v, wound(v, f, want));
}

/**
 * A maple leaf, flat with a little fold down its middle: a lobed outline -- a long middle lobe, two at its sides and two small
 * ones at its base -- one half its green and the other a shade darker, rooted at `root` and lying along `dir`, its face out
 * along `face`.
 */
function mapleLeaf(root: V3, dir: V3, face: V3, L: number, tone: number, fine: boolean): Mesh {
  const { x, y, z } = frameOf(face, dir);
  const half: Array<[number, number]> = fine
    ? [[0, 1], [0.13, 0.76], [0.1, 0.6], [0.44, 0.72], [0.3, 0.46], [0.24, 0.38], [0.46, 0.26], [0.18, 0.12], [0.05, 0.06]]
    : [[0, 1], [0.12, 0.66], [0.44, 0.7], [0.26, 0.4], [0.44, 0.24], [0.06, 0.06]];
  const outline: Array<[number, number]> = [...half, ...[...half].reverse().slice(1, -1).map(([u, v]) => [-u, v] as [number, number])];
  const fold = 0.16, th = L * 0.04;
  const at = (u: number, v: number, h: number): V3 => add(root, add(add(scale(x, u * L), scale(y, v * L)), scale(z, h + fold * Math.abs(u) * L)));
  const S = outline.length;
  const top = outline.map(([u, v]) => at(u, v, 0)), bot = outline.map(([u, v]) => at(u, v, -th));
  const c0 = at(0, 0.42, -L * 0.02), c1 = at(0, 0.42, -th - L * 0.02);
  const v: V3[] = [...top, ...bot, c0, c1];
  const f: Face[] = [], want: V3[] = [];
  const [light, dark]: [Mat, Mat] = tone ? ['leafDark', 'moss'] : ['leaf', 'leafDark'];
  for (let j = 0; j < S; j++) {
    const j1 = (j + 1) % S, side = outline[j][0] + outline[j1][0];
    f.push({ i: [j, j1, 2 * S], m: side >= 0 ? light : dark });
    want.push(z);
    f.push({ i: [S + j, S + j1, 2 * S + 1], m: dark });
    want.push(scale(z, -1));
    const o = unit(sub(scale(add(top[j], top[j1]), 0.5), c0));
    f.push({ i: [j, j1, S + j1, S + j], m: dark, soft: true });
    want.push(o);
  }
  // A short stalk into whatever it grows from.
  const stalk = tube([sub(root, scale(y, L * 0.12)), at(0, 0.08, 0)], [L * 0.04, L * 0.03], [L * 0.04, L * 0.03], 4, 'stem', { seam: 'start' });
  return merge(mesh(v, wound(v, f, want)), stalk);
}

/**
 * A stake of split wood: a pale tan five-sided spike, its faces split light and shaded, from inside the body to a point, a
 * little bent.
 */
function stake(root: V3, dir: V3, L: number, r: number, bendTo: V3, face: V3): Mesh {
  const d = unit(dir);
  const pts = curve(sub(root, scale(d, r * 1.2)), add(root, add(scale(d, L * 0.5), scale(bendTo, L * 0.06))), add(root, scale(d, L)), 4);
  // A split plank: broad across, thin through, its end split to a point; its face pale, its edges and back darker, and a dark
  // stripe of grain down the middle of its face.
  const ws = [r, r, r * 0.92, r * 0.62, r * 0.08], ds = ws.map((w) => w * 0.45);
  return tube(pts, ws, ds, 8, (_r, j) => {
    const a = ((j + 1) / 8) * 360;
    return (a === 90 ? 'shellDark' : a > 0 && a < 180 ? 'horn' : 'hornDark') as Mat;
  }, { up: face, seam: 'start' });
}

/** What rattles and grows on it, as one mesh: each corner's root (what it rocks on and grows from) and a phase of its own. */
interface Rattle { mesh: Mesh; root: V3[]; ph: number[] }
function rattleOf(parts: ReadonlyArray<{ mesh: Mesh; root: V3; id: number }>): Rattle {
  const root: V3[] = [], ph: number[] = [];
  for (const p of parts) for (let q = 0; q < p.mesh.v.length; q++) { root.push(p.root); ph.push(jitter(p.id + 31) * TAU); }
  return { mesh: merge(...parts.map((p) => p.mesh)), root, ph };
}

/** The most anything on it is tipped as it rattles, in radians: wood rocks on its root. */
const RATTLE_MOST = 0.09;

/**
 * How what is on it moves this moment: how far each thing is rocked on its root and how fast, and how far grown it is. Rattling
 * as it goes, at each bite and the tug, as a blow lands; and as it evolves, its leaves and chips growing out of it from under
 * half their size and its stakes rising out of its back.
 */
function rattle(s: Gnaw, a: Anim, stakes: boolean): { jig: number; at: number; grow: number } {
  let jig = 0, at = 0, grow = 1;
  if (a.go > 0) {
    jig = smooth(a.go) * s.gait.jiggle * (0.035 + 0.02 * a.gait) * (stakes ? 1.4 : 1);
    at = frac(a.u) * TAU * 2;
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    // Shaken by each blow at about six times a second, dying away over a quarter second.
    for (const h of GNAW_HITS[s.strike]) {
      const k = act.t < h ? smooth((act.t - h + 0.06) / 0.06) : Math.exp(-((act.t - h) * ACT_SECS.strike) / 0.25);
      jig += (stakes ? 0.09 : 0.06) * k;
    }
    at = act.t * 22;
  } else if (act?.kind === 'work' || (!act && a.graze > 0)) {
    const t = act?.t ?? 0, down = downOf(t, a.graze, riseOf(s), endOf(s));
    for (const h of biteTimes(s.stage)) jig += down * (stakes ? 0.06 : 0.04) * hump(t, h + 0.03, 0.08);
    jig += down * 0.07 * hump(t, GNAW_GO.slap + 0.02, 0.08);
    at = t * 55;
  } else if (act?.kind === 'evolve') {
    const t = act.t;
    grow = stakes ? ramp(t, 0.22, 0.56) * (1 + 0.14 * hump(t, 0.6, 0.07)) : 0.35 + 0.65 * ramp(t, 0.04, 0.5) + 0.12 * hump(t, 0.54, 0.08);
    jig += 0.06 * hump(t, 0.64, 0.1);
    at = t * 70;
  }
  return { jig: Math.min(RATTLE_MOST, jig), at, grow };
}

/** A piece of things that rattle and grow (`rattle`): each whole, scaled from its root and rocked on it, a beat of its own. */
function rattling(s: Gnaw, G: Rattle, stakes: boolean): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { jig, at, grow } = rattle(s, a, stakes);
    if (!jig && grow === 1) return v as V3[];
    return v.map((p, i) => {
      const r = G.root[i], ph = G.ph[i];
      let [x, y, z] = scale(sub(p, r), Math.max(0.001, grow));
      const side = jig * Math.sin(at + ph), fore = jig * 0.6 * Math.cos(at + ph * 1.3);
      const cs = Math.cos(side), ss = Math.sin(side), cf = Math.cos(fore), sf = Math.sin(fore);
      [x, z] = [x * cs + z * ss, -x * ss + z * cs];
      [y, z] = [y * cf - z * sf, y * sf + z * cf];
      return [r[0] + x, r[1] + y, r[2] + z];
    });
  };
}

/** The shingles and leaves of its mantle over its back and shoulders, in rows like brickwork, each lying back toward its tail and out down its flank. */
function maneOf(s: Gnaw, fine: boolean): Array<{ mesh: Mesh; root: V3; id: number }> {
  const C = s.mane, out: Array<{ mesh: Mesh; root: V3; id: number }> = [];
  if (!C) return out;
  for (let r = 0; r < C.rows; r++) {
    const f = r / Math.max(1, C.rows - 1);
    const y0 = lerp(C.from, C.to, f);
    // Fewer and narrower toward the rump, where the mantle thins out over its fur.
    const count = Math.max(3, Math.round(C.per * (1.15 - 0.45 * f)) + (r % 2 ? -1 : 0));
    const spread = C.spread * (1.25 - 0.5 * f);
    for (let q = 0; q < count; q++) {
      const id = 100 + r * 17 + q;
      const g = count > 1 ? q / (count - 1) - 0.5 : 0, edge = Math.abs(g) * 2;
      // Never so far down the flank that a chip is seen edge on past the outline.
      const th = clamp(Math.PI / 2 + g * 2 * spread + (jitter(id) - 0.5) * 0.14, Math.PI / 2 - 1.25, Math.PI / 2 + 1.25);
      const at = onRings(s.body, y0 + (jitter(id + 3) - 0.5) * 0.1 * (s.len / 1.3), th);
      const c = Math.cos(th), sn = Math.sin(th), wv = Math.sign(c) || 1;
      const round: V3 = unit([wv * sn, 0, -wv * c * 0.9]);
      const back = unit(add([0, -1, 0], scale(round, edge * 1.6)));
      const k = (1 - 0.2 * edge) * (0.88 + 0.24 * jitter(id + 5));
      const root = sub(at.p, scale(at.n, C.t * 0.4));
      // A leaf every so often in place of a chip, thicker at the front where the reference's mantle is greenest.
      const leafy = (r + q * 2) % (f < 0.4 ? 5 : 6) === 0;
      if (leafy) out.push({ mesh: mapleLeaf(add(root, scale(at.n, C.t * 1.4)), back, at.n, C.a * 1.2 * k, (id % 3) === 0 ? 1 : 0, fine), root, id });
      else out.push({ mesh: shingle(root, at.n, back, C.a * k, C.b * k, C.t, C.lift * k, Math.floor(jitter(id + 9) * 3), id), root, id });
    }
  }
  // Armour over its haunches: chips lying down the outside of the rump, over the tops of its thighs, never low enough to touch
  // the ground however it sits.
  for (let row = 0; row < C.haunch; row++) for (const sd of [1, -1]) for (let q = 0; q < 4; q++) {
    const id = 470 + row * 13 + q + (sd > 0 ? 0 : 60);
    const y = lerp(s.body.y[2], s.body.y[1], 0.2 + 0.25 * q + 0.1 * row) * (0.95 + 0.1 * jitter(id));
    const at0 = onRings(s.body, y, 0.5 - 0.32 * row + 0.08 * (q % 2)), at = sd > 0 ? at0 : left(at0);
    const along = unit(add([0, -0.5, -1], scale(at.n, 0.2)));
    out.push({ mesh: shingle(sub(at.p, scale(at.n, C.t * 0.4)), at.n, along, C.a * 1.05, C.b * 1.05, C.t, C.lift * 0.4, (row + q) % 3, id), root: at.p, id });
  }
  return out;
}

/** The crest of the Timberlord: stakes along its back from its shoulders, tallest over them, leaning back and out, leaves at their feet. */
function stakesOf(s: Gnaw, n: number, fine: boolean): Array<{ mesh: Mesh; root: V3; id: number }> {
  const out: Array<{ mesh: Mesh; root: V3; id: number }> = [];
  if (!s.stakes) return out;
  for (let q = 0; q < s.stakes; q++) {
    const id = 600 + q, f = q / Math.max(1, s.stakes - 1);
    const sd = q % 2 ? -1 : 1;
    const y = lerp(s.body.y[5] * 0.95, s.body.y[1] * 0.75, f) + (jitter(id) - 0.5) * 0.12;
    const th = Math.PI / 2 + sd * (q < 2 ? 0.55 : 0.12 + 0.36 * jitter(id + 1) + (q % 3 === 2 ? 0.5 : 0));
    const at = onRings(s.body, y, th);
    // The two over its shoulders the longest; every third leant well out to the side, so from in front or behind they fan out
    // past its shoulders and over its ears rather than hiding behind its head.
    const L = s.stakeLen * (q < 2 ? 1.25 : (1 - 0.3 * f) * (0.86 + 0.24 * jitter(id + 2)) * (q % 3 === 2 ? 0.95 : 1));
    const dir = unit(add(scale(at.n, 0.55), [sd * (q < 2 ? 0.35 : q % 3 === 2 ? 0.7 : 0.12), -0.25 - 0.3 * f, 1]));
    const root = sub(at.p, scale(at.n, 0.04));
    const r = 0.26 + 0.08 * jitter(id + 3);
    let m = stake(root, dir, L, r, [sd, 0, 0], at.n);
    // Leaves at its foot, tucked against it.
    m = merge(m, mapleLeaf(add(root, scale(at.n, 0.05)), unit(add(dir, scale(at.n, 0.9))), unit(add(at.n, [0, -0.6, 0])), 0.7, q % 2, fine));
    out.push({ mesh: m, root, id });
  }
  void n;
  return out;
}

/** Chips down the back of its neck, lying down toward its shoulders, and a few leaves. */
function napeOf(s: Gnaw, fine: boolean): Array<{ mesh: Mesh; root: V3; id: number }> {
  const C = s.mane, out: Array<{ mesh: Mesh; root: V3; id: number }> = [];
  if (!C || !C.neck) return out;
  const r = s.neck.w;
  for (let row = 0; row < C.neck; row++) {
    const z = lerp(s.neck.len * 1.05, -0.05, row / Math.max(1, C.neck - 1));
    for (let q = 0; q < 5; q++) {
      const id = 300 + row * 11 + q;
      // Round the nape (-y in the neck's frame) and its sides.
      const th = -Math.PI / 2 + (q - 2) * 0.55 + (row % 2 ? 0.27 : 0);
      const nrm: V3 = [Math.cos(th), Math.sin(th) * 0.85, 0];
      const root: V3 = [Math.cos(th) * r * 0.92, Math.sin(th) * r * 0.8, z];
      const along = unit(add([0, 0, -1], scale(nrm, 0.5)));
      if ((row + q) % 3 === 1) out.push({ mesh: mapleLeaf(add(root, scale(nrm, C.t)), along, nrm, C.a * 1.8, q % 2, fine), root, id });
      else out.push({ mesh: shingle(root, nrm, along, C.a * 0.9, C.b * 0.9, C.t, C.lift * 0.4, (row + q) % 3, id), root, id });
    }
  }
  return out;
}

/** Shingles down the outside of a fore leg's upper (a sleeve) or over a haunch, pointing down the leg; `side` its side. */
function sleeveOf(s: Gnaw, side: number, rows: number, hind: boolean): Mesh | undefined {
  const C = s.mane;
  if (!C || !rows) return undefined;
  const L = hind ? s.hind[0] : s.fore[0], r = s.thick * (hind ? s.hindThick * 1.12 : 0.62);
  const out: Mesh[] = [];
  for (let row = 0; row < rows; row++) {
    const z = lerp(hind ? L * 0.1 : s.thick * 0.5, hind ? -L * 0.25 : -s.fore[1] * 0.3, row / Math.max(1, rows - 1));
    for (let q = 0; q < (hind ? 4 : 3); q++) {
      const id = 400 + row * 7 + q + (side > 0 ? 0 : 50) + (hind ? 100 : 0);
      // Round the outside and the front of the leg.
      const th = (side > 0 ? 0 : Math.PI) + side * ((q - 1.2) * 0.62 + (row % 2 ? 0.3 : 0)) * (hind ? -1 : 1);
      const nrm: V3 = [Math.cos(th), Math.sin(th), 0];
      const root: V3 = [Math.cos(th) * r * (hind ? 0.85 : 0.9), Math.sin(th) * r * (hind ? 0.85 : 0.9), z];
      // Long chips lying flat down the leg, not standing off it.
      out.push(shingle(root, nrm, unit(add([0, 0, -1], scale(nrm, 0.12))), C.a * (hind ? 1.1 : 0.85), C.b * (hind ? 1.1 : 0.75), C.t, C.lift * (hind ? 0.3 : 0.05), 1 + ((row + q) % 2), id));
    }
  }
  return merge(...out);
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
 * The eyes: round and black and glossy, a glint high on the light's side and a small one low. Each painted onto the skull
 * itself, every corner on its curve, so none of it stands out past the outline, and all of an eye goes out of sight together
 * once it is turned away round the head.
 */
function eyesOf(s: Gnaw, shut: boolean): Mesh {
  const E = s.eye, H = s.head, meshes: Mesh[] = [];
  const c0 = onRings(H, E.y, E.up), rho = Math.max(0.05, Math.hypot(c0.p[0], c0.p[2] - lerp(H.z[2], H.z[4], 0.5)));
  for (const side of [1, -1]) {
    const q = side > 0 ? c0 : left(c0), out: Disc[] = [];
    const at = sub(q.p, scale(q.n, H.w[2] * 0.05));
    const patch = (cy: number, cu: number, ry: number, ru: number, sides: number, m: Mat, lift: number, o: { lit?: boolean } = {}): Disc => {
      const v: V3[] = [];
      let nx = 0, ny = 0, nz = 0;
      for (let j = 0; j < sides; j++) {
        const a = ((j + 0.5) / sides) * TAU, dy = cy + Math.cos(a) * ry, du = cu + Math.sin(a) * ru;
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
    const r = E.size, tall = E.tall, k = H.w[3] / 0.44;
    const away: V3 = [-q.n[0], -q.n[1], 0.62 - q.n[2]];
    const done = (): void => { const m = paint(out); m.f.forEach((f) => { f.unless = away; }); meshes.push(m); };
    if (shut) {
      out.push(patch(0, -r * 0.1, r * 1.1, r * 0.3, 8, 'lid', 0.01 * k));
      done();
      continue;
    }
    out.push(patch(0, r * 0.04, r * 1.18, r * tall * 1.16, 10, 'lid', 0.008 * k));
    out.push(patch(0, 0, r, r * tall, 12, 'eye', 0.012 * k));
    out.push(patch(0, -r * tall * 0.32, r * 0.6, r * tall * 0.36, 8, 'pad', 0.016 * k));
    out.push(patch(r * 0.3, r * tall * 0.36, r * 0.32, r * 0.32, 6, 'glint', 0.024 * k, { lit: true }));
    out.push(patch(-r * 0.32, -r * tall * 0.42, r * 0.14, r * 0.14, 5, 'glint', 0.024 * k, { lit: true }));
    done();
  }
  return merge(...meshes);
}

/** Where its lower jaw's underside is, in the jaw's frame (its frame is the head's, turned at the head's middle). */
function jawPoints(s: Gnaw): V3[] {
  const H = s.head, last = H.y.length - 1;
  return [3, 4, 5, 6].map((q) => [0, H.y[q] * (q === 6 ? 0.98 : 1), H.z[q] - H.h[q] * 1.08] as V3).concat([[0, H.y[last] - H.h[last] * 0.6, H.z[last] - H.h[last] * 1.05]]);
}

/**
 * The head, built as rings from the back of the skull to the end of the muzzle: round, its fur warm over the crown and cream
 * on the muzzle and the cheeks, a broad black nose on top of the muzzle's end, a cleft lip down to its teeth, and round black
 * eyes high on its sides.
 */
function headOf(s: Gnaw, n: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1;
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring, j) => {
    const up = Math.sin(((j + 1) / n) * TAU);
    return up > H.cream[Math.min(ring, H.cream.length - 1)] ? 'coat' : 'muzzle';
  });
  // Cheeks: a full pad of cream either side of the muzzle, so the face is broad.
  const cheeks = merge(...[1, -1].map((sd) => orbAlong([sd * H.w[4] * 0.42, H.y[5], H.z[5] - H.h[5] * 0.3], [0, 1, 0], [H.w[5] * 0.55, H.h[5] * 0.66, H.h[5] * 0.6], n, 4, 'muzzle')));
  const nz = s.nose;
  const tipC: V3 = [0, H.y[last] + nz * 0.15, H.z[last] + H.h[last] * 0.35];
  const nose = orbAlong(tipC, [0, 1, 0.3], [nz * 1.35, nz * 0.95, nz * 0.85], 7, 4, 'nose');
  const front: V3 = [0, tipC[1] + nz * 0.8, tipC[2] + nz * 0.1];
  const nostrils = paint([1, -1].map((sd) => disc(add(front, [sd * nz * 0.45, 0.004, -nz * 0.05]), [0, 1, 0.3], nz * 0.2, nz * 0.26, 6, 'pad')));
  // The cleft from the nose down to the teeth, and the mouth's line back along each side of the muzzle.
  const lip = onRings(H, H.y[last] - 0.001, -Math.PI / 2 + 0.3), lip2 = onRings(H, H.y[last] - 0.001, Math.PI / 4);
  const cleft: Disc = line([{ p: [0, lip2.p[1] + nz * 0.1, lip2.p[2]], n: [0, 1, 0] }, { p: [0, lip.p[1] + nz * 0.05, H.z[last] - H.h[last] * 0.5], n: [0, 1, -0.2] }], H.w[2] * 0.025, 'lid');
  const mouth = [1, -1].map((sd) => {
    const pts = Array.from({ length: 5 }, (_, q) => {
      const f = q / 4, y = lerp(H.y[last], H.y[4], f), th = -0.95 + 0.12 * f;
      const at = onRings(H, y, th);
      return sd > 0 ? at : left(at);
    });
    return { ...line(pts, H.w[2] * 0.028, 'lid'), at: sub(pts[2].p, scale(pts[2].n, 0.05)) };
  });
  return merge(skull, cheeks, nose, nostrils, paint([cleft, ...mouth]), eyesOf(s, shut));
}

/** Solids inside the head that hide what is round the far side of them: the skull and the muzzle. */
function headSolids(s: Gnaw): Array<{ c: V3; r: V3 }> {
  const H = s.head;
  return [
    { c: [0, H.y[2], H.z[2]], r: [H.w[2] * 0.85, (H.y[4] - H.y[0]) * 0.5, H.h[2] * 0.85] },
    ...H.y.slice(2, -1).map((y, q): { c: V3; r: V3 } => {
      const k = q + 2;
      return { c: [0, y, H.z[k]], r: [H.w[k] * 0.85, Math.max(0.02, (H.y[k + 1] - H.y[k - 1]) * 0.3), H.h[k] * 0.85] };
    }),
  ];
}

/**
 * Its buck teeth: two broad ivory incisors side by side down from under the muzzle's end, square-ended, their fronts brighter
 * than their backs and a dark line between them so they read as two; the Logchewer's longer, the Timberlord's long tusks,
 * curving out forward and down.
 */
function teethOf(s: Gnaw): Mesh {
  const H = s.head, last = H.y.length - 1, T = s.teeth;
  const top: V3 = [0, H.y[last] - H.h[last] * 0.35, H.z[last] - H.h[last] * 0.45];
  const out: Mesh[] = [];
  for (const sd of [1, -1]) {
    const x = sd * T.w * 1.06;
    const a: V3 = [x, top[1], top[2]];
    const b: V3 = [x, top[1] + T.curve * 0.7, top[2] - T.len * 0.55 - H.h[last] * 0.25];
    const c: V3 = [x * (T.curve > 0.1 ? 1.15 : 1), top[1] + T.curve, top[2] - T.len - H.h[last] * 0.25];
    const ws = [T.w, T.w, T.w * 0.96, T.w * (T.curve > 0.1 ? 0.8 : 0.92), T.w * (T.curve > 0.1 ? 0.62 : 0.88)];
    const ds = ws.map((w) => w * 0.8);
    out.push(tube(curve(a, b, c, 4), ws, ds, 4, (_r, j) => (j === 0 ? 'tooth' : j === 3 ? 'stone' : 'stone'), { turn: 0, seam: 'start' }));
  }
  return merge(...out);
}

/** The lower jaw: a cream chin under the muzzle, its inside dark and a pink tongue, seen as it opens. */
function jawOf(s: Gnaw, n: number): Mesh {
  const H = s.head, last = H.y.length - 1;
  const chin = orbAlong([0, lerp(H.y[4], H.y[last], 0.4), H.z[5] - H.h[5] * 0.62], [0, 1, -0.15], [H.w[5] * 0.62, (H.y[last] - H.y[4]) * 0.55, H.h[5] * 0.42], n, 4, 'muzzle');
  const tongue = orbAlong([0, lerp(H.y[4], H.y[last], 0.42), H.z[5] - H.h[5] * 0.3], [0, 1, 0], [H.w[5] * 0.4, (H.y[last] - H.y[4]) * 0.4, H.h[5] * 0.16], n, 3, 'tongue');
  return merge(chin, tongue);
}
/** The inside of its mouth: a dark between its jaws, seen only as they part. */
function mouthOf(s: Gnaw, n: number): Mesh {
  const H = s.head, last = H.y.length - 1;
  return orbAlong([0, lerp(H.y[3], H.y[last], 0.55), H.z[5] - H.h[5] * 0.55], [0, 1, 0], [H.w[5] * 0.72, (H.y[last] - H.y[3]) * 0.55, H.h[5] * 0.62], n, 4, 'pad');
}

/** Whiskers: three a side, fine dark lines out from the muzzle. */
function whiskersOf(s: Gnaw): Mesh {
  const H = s.head, last = H.y.length - 1, out: Mesh[] = [];
  for (const sd of [1, -1]) for (let q = 0; q < 3; q++) {
    const at0 = onRings(H, H.y[last - 1], 0.05 - q * 0.22), at = sd > 0 ? at0 : left(at0);
    const L = H.w[3] * (0.48 + 0.06 * q);
    const tip = add(at.p, [sd * L * 0.9, -L * 0.25, (0.08 - q * 0.12) * L]);
    out.push(tube(curve(sub(at.p, scale(at.n, 0.01)), add(at.p, [sd * L * 0.5, -L * 0.06, 0.02 * L]), tip, 3), [0.005, 0.004, 0.0035, 0.002].map((w) => w * (H.w[3] / 0.44)), [0.005, 0.004, 0.0035, 0.002].map((w) => w * (H.w[3] / 0.44)), 3, 'featherDark'));
  }
  return merge(...out);
}

/** An ear: small and round, the coat's colour with a pink inside, cupped so its inside shows side on as well as face on. */
function earOf(s: Gnaw, n: number): Mesh {
  const E = s.ear, L = E.len, w = E.w;
  return merge(
    tube(curve([0, 0, -0.03 * L / 0.15], [0, 0.03 * L, L * 0.55], [0, -0.01, L], 4), [w * 0.8, w, w * 0.92, w * 0.62, w * 0.12], w * 0.42, n, 'coatDark', { up: [0, 1, 0], seam: 'start' }),
    paint([disc([0, w * 0.44, L * 0.5], [0, 1, 0.08], w * 0.6, L * 0.34, 8, 'inner')]),
  );
}

/** Maple leaves out of its crown, splayed up and back, on a short twig. */
function sprigOf(s: Gnaw, fine: boolean): Array<{ mesh: Mesh; root: V3; id: number }> {
  const H = s.head, out: Array<{ mesh: Mesh; root: V3; id: number }> = [];
  const n = s.sprig, k = H.w[3] / 0.44;
  for (let q = 0; q < n; q++) {
    const f = n > 1 ? q / (n - 1) - 0.5 : 0, id = 800 + q;
    const at = onRings(H, lerp(H.y[1], H.y[3], 0.4 + 0.35 * jitter(id)), Math.PI / 2 + f * 1.3);
    const root = sub(at.p, scale(at.n, 0.02 * k));
    const dir = unit([f * 1.3, -0.35 - 0.3 * jitter(id + 1), 0.9]);
    const L = (0.3 + 0.08 * jitter(id + 2)) * k * (s.stage ? 0.85 : 1);
    out.push({ mesh: mapleLeaf(root, dir, unit([f * 0.4, 0.85, 0.35]), L, q % 2, fine), root, id });
  }
  return out;
}

/** The Sapgnaw's collar: leaves round the foot of its neck, hanging out and down over its shoulders and chest. */
function collarOf(s: Gnaw, fine: boolean): Array<{ mesh: Mesh; root: V3; id: number }> {
  const out: Array<{ mesh: Mesh; root: V3; id: number }> = [];
  const r = s.neck.w;
  for (let q = 0; q < s.collar; q++) {
    const id = 850 + q, th = -0.5 + (q / Math.max(1, s.collar - 1)) * (Math.PI + 1.0);
    const nrm: V3 = [Math.cos(th), Math.sin(th), 0];
    // The leaves at the front of the throat set lower and turned out to the sides, clear of its teeth.
    const front = Math.sin(th) > 0.85, aside = front ? Math.sign(Math.cos(th) || (q % 2 ? 1 : -1)) * 0.4 : 0;
    const root: V3 = [Math.cos(th) * r * 0.95, Math.sin(th) * r * 0.9, front ? -0.1 : -0.05];
    // Out and down over the body, more down at the throat.
    const turned: V3 = [nrm[0] * Math.cos(aside) - nrm[1] * Math.sin(aside), nrm[0] * Math.sin(aside) + nrm[1] * Math.cos(aside), 0];
    const dir = unit(add(scale(turned, 1), [0, 0, -0.8 - 0.3 * Math.max(0, Math.sin(th))]));
    out.push({ mesh: mapleLeaf(root, dir, unit(add([0, 0, 1], scale(nrm, 0.6))), 0.34 * (0.9 + 0.2 * jitter(id)), q % 2, fine), root, id });
  }
  return out;
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A fore paw (the right): a small dark hand with long dark claws out of its front, curving down to the ground. */
function forePaw(s: Gnaw, n: number, k: number): Mesh {
  const r = s.paw, d = s.fore[2];
  const paw = orbAlong([0, r * 0.35, -d + r * 0.6], [0, 1, 0], [r * 1.1, r * 0.62, r * 1.0], n, k, 'hoof');
  const claws = [-1, -0.33, 0.33, 1].map((f) => {
    const L = s.claw * (1 - 0.2 * Math.abs(f));
    const root: V3 = [f * r * 0.75, r * 0.75, -d + r * 0.5];
    const tip: V3 = [f * r * 0.95, r * 0.8 + L, -d + 0.004];
    const w = Math.max(0.018, r * 0.22);
    return tube(curve(root, [f * r * 0.9, root[1] + L * 0.6, root[2] + L * 0.08], tip, 3), [w, w * 0.8, w * 0.5, 0.006], [w * 1.1, w * 0.9, w * 0.55, 0.006], 5, 'claw', { seam: 'start' });
  });
  return merge(paw, ...claws);
}

/** A hind foot: long and flat and webbed, dark, with five claws. */
function hindFoot(s: Gnaw, n: number, k: number): Mesh {
  const F = s.foot, d = s.hind[2], W = F * 0.3;
  const foot = orbAlong([0, F * 0.42, -d + d * 0.7], [0, 1, 0], [W, d * 0.72, F * 0.55], n, k, 'hoof');
  const heel = orbAlong([0, F * 0.04, -d + d * 0.82], [0, 1, 0], [W * 0.75, d * 0.8, F * 0.2], n, k, 'hoof');
  const claws = [-1, -0.5, 0, 0.5, 1].map((f) => {
    const L = s.toe * (1 - 0.25 * Math.abs(f));
    const root: V3 = [f * W * 0.75, F * 0.86, -d + d * 0.5];
    const w = Math.max(0.016, W * 0.15);
    return tube(curve(root, [f * W * 0.85, root[1] + L * 0.6, root[2]], [f * W * 0.9, root[1] + L, -d + 0.004], 2), [w, w * 0.7, 0.005], [w * 1.1, w * 0.7, 0.005], 5, 'claw', { seam: 'start' });
  });
  return merge(foot, heel, ...claws);
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
function barrelSolid(s: Gnaw): { c: V3; r: V3 } {
  const B = s.body, y0 = B.y[0], y1 = B.y[B.y.length - 1];
  return { c: [0, (y0 + y1) / 2, (B.z[0] + B.z[B.z.length - 1]) / 2], r: [Math.max(...B.w) * 0.9, ((y1 - y0) / 2) * 0.9, Math.max(...B.h) * 0.9] };
}

/**
 * The paddle of a tail: broad, flat and thick, rounded at its end, dark brown, its upper face cross-hatched like bark, and
 * patches of moss on it. Built back along -y from its root.
 */
function tailOf(s: Gnaw, n: number, fine: boolean): Mesh {
  const L = s.tail.len, W = s.tail.w, T = s.tail.t;
  const ys = [0.12, 0, -0.1, -0.24, -0.42, -0.62, -0.8, -0.93, -1].map((f) => f * L);
  const ws = [0.32, 0.36, 0.56, 0.84, 1, 0.98, 0.84, 0.56, 0.18].map((f) => f * W);
  const hs = [1.6, 1.5, 1.15, 1, 1, 0.96, 0.88, 0.7, 0.4].map((f) => f * T);
  const N = Math.max(10, n + 2);
  const slab = tube(ys.map((y) => [0, y, 0] as V3), ws, hs, N, (_r, j) => { const u = Math.sin(((j + 1) / N) * TAU); return (u > 0.3 ? 'bark' : u < -0.3 ? 'shell' : 'grip') as Mat; }, { up: [0, 0, 1] });
  // The bark's hatching: diagonal scales of a darker brown painted on its upper face, few enough to stay scales when it is small.
  const marks: Disc[] = [];
  const top = (x: number, y: number): V3 => {
    let k = 0;
    while (k < ys.length - 2 && ys[k + 1] > y) k++;
    const f = clamp((y - ys[k]) / (ys[k + 1] - ys[k])), w = lerp(ws[k], ws[k + 1], f), h = lerp(hs[k], hs[k + 1], f);
    const u = clamp(x / w, -0.98, 0.98);
    return [x, y, h * Math.sqrt(1 - u * u) + 0.006 * (L / 0.5)];
  };
  const rows = fine ? 6 : 4, cols = fine ? 4 : 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const y = -L * (0.14 + 0.74 * (r + 0.5) / rows), wAt = ws[Math.min(ws.length - 1, Math.round(-y / L * 8))] ?? W;
    const x = wAt * 0.8 * ((c + 0.5 + (r % 2 ? 0.5 : 0)) / cols - 0.5) * 2 * 0.9;
    if (Math.abs(x) > wAt * 0.82) continue;
    const dy = L * 0.36 / rows, dx = wAt * 0.42 / cols;
    // A scale: a diamond, its long way along the tail.
    const v = [top(x, y + dy), top(x + dx, y), top(x, y - dy), top(x - dx, y)];
    marks.push({ v: v.reverse(), m: 'stoneDark' });
  }
  // Moss: soft green patches on its upper face, and over its edge on one side.
  const moss: Array<[number, number, number]> = [[0.35, -0.55, 0.28], [-0.45, -0.3, 0.22], [0.1, -0.82, 0.2], [-0.2, -0.66, 0.16]];
  moss.forEach(([fx, fy, fr], q) => {
    const y = fy * L, wAt = W * 0.95, cx = fx * wAt, r = fr * W;
    const v: V3[] = [];
    for (let j = 0; j < 9; j++) {
      const a = (j / 9) * TAU, kk = r * (0.7 + 0.45 * jitter(q * 9 + j));
      v.push(top(cx + Math.cos(a) * kk, y + Math.sin(a) * kk * 1.2));
    }
    marks.push({ v: v.reverse(), m: q % 2 ? 'moss' : 'leafDark' });
  });
  // The same on its underside, which is what is seen of it from behind once it is lifted.
  const below = marks.map((d) => ({ ...d, v: d.v.map((q) => [q[0], q[1], -q[2]] as V3).reverse() }));
  return merge(slab, paint([...marks, ...below]));
}

/** The legs: round, rooted up inside the body, warm fur above and the dark of its forearms and shins below. */
function legPieces(s: Gnaw, n: number, k: number): Piece[] {
  const out: Piece[] = [];
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const L = fore ? s.fore : s.hind, w = s.thick * (fore ? 1 : s.hindThick), wl = lowerW(s, fore);
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const upMat: Mat[] = fore ? ['coat', 'coat', 'hoof'] : ['coat', 'coat', 'coat'];
    const upper = tube([0, 1, 2, 3, 4].map((q) => [0, 0, lerp(w * 0.6, -L[0], q / 4)] as V3), [w * 0.55, w * 1.0, w * 0.98, w * 0.86, w * 0.64], [w * 0.55, w * 0.96, w * 0.94, w * 0.82, w * 0.62], n, (ring) => upMat[Math.min(2, Math.max(0, ring - 1))], { seam: 'end' });
    const end = Math.min(wl * 0.6, L[2] * 0.95);
    const lap = w * (fore ? 0.3 : 0.55);
    const lower = tube([0, 1, 2, 3].map((q) => [0, 0.02 * (q / 3), lerp(lap, -L[1], q / 3)] as V3), [wl * 0.56, wl * 0.58, lerp(wl * 0.55, end, 0.5), end], [wl * 0.56, wl * 0.58, lerp(wl * 0.55, end, 0.5), end], n, 'hoof', { seam: 'both' });
    const foot = fore ? forePaw(s, n, k) : hindFoot(s, n, k);
    // A hind leg's haunch: a big round bulge of muscle over the thigh, which a beaver sits on.
    const thigh = fore ? upper : merge(upper, orbAlong([-side * w * 0.05, w * 0.05, -L[0] * 0.2], [0, 1, 0.3], [w * 1.12, w * 1.2, w * 1.05], n, k, 'coat'));
    const hide = fore ? [barrelSolid(s)] : undefined, hideIn = fore ? 'trunk' : undefined;
    out.push(
      { key: `${key}0`, mesh: thigh, bone: `${key}0`, bias: 0.01, under: 'body', convex: fore },
      { key: `${key}1`, mesh: lower, bone: `${key}1`, bias: 0.02, after: 'body', front, convex: fore, hide, hideIn },
      { key: `${key}2`, mesh: side < 0 ? mirror(foot) : foot, bone: `${key}2`, bias: 0.03, after: 'body', front, hide, hideIn },
    );
    const sl = fore ? sleeveOf(s, side, s.mane?.sleeve ?? 0, false) : undefined;
    if (sl) out.push({ key: `${key}s`, mesh: sl, bone: fore ? `${key}1` : `${key}0`, bias: 0.025, after: ['body', `${key}1`], front, hide, hideIn });
  }
  return out;
}
const mirror = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/** A stage's pieces: a body on four legs with its own head, teeth, ears, paws, feet and tail, and its leaves, chips and stakes. */
function gnawBuild(s: Gnaw, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6), fine = lod > 0;
  const B = s.body, skull = headSolids(s)[0], solids = headSolids(s);
  const R = domed(B);
  // The barrel: warm fur, cream down its chest and belly.
  const barrel = tube(R.y.map((y, q) => [0, y, R.z[q]] as V3), R.w, R.h, n, (ring, j) => {
    const front = ring / (R.y.length - 1);
    return ring > 1 && ring < R.y.length - 1 && under(n, j, 0.55 + 0.75 * front) ? 'belly' : 'coat';
  });
  const body = mesh(barrel.v.map((p, i) => {
    const q = Math.min(R.y.length - 1, Math.floor(i / n)), t = clamp((R.z[q] - p[2]) / R.h[q]);
    return [p[0] * (1 - 0.14 * t * t), p[1], p[2] + R.h[q] * 0.05 * t * t] as V3;
  }), barrel.f);
  const extras: Piece[] = [];
  const add2 = (key: string, bone: string, parts: Array<{ mesh: Mesh; root: V3; id: number }>, o: Partial<Piece>, stakes = false): void => {
    if (!parts.length) return;
    const G = rattleOf(parts);
    extras.push({ key, mesh: G.mesh, bone, bent: rattling(s, G, stakes), ...o });
  };
  add2('mane', 'trunk', maneOf(s, fine), { bias: 0.1, after: ['body'] });
  add2('stakes', 'trunk', stakesOf(s, n, fine), { bias: 0.12, after: ['body', 'mane'] }, true);
  add2('nape', 'neck', napeOf(s, fine), { bias: 0.05, after: ['neck', 'body'], under: 'head' });
  add2('collar', 'neck', collarOf(s, fine), { bias: 0.06, after: ['neck', 'body'] });
  add2('sprig', 'head', sprigOf(s, fine), { bias: 0.22, after: ['head'], hide: solids, hideIn: 'head' });
  if (s.mane?.crown) {
    const H = s.head, crown: Array<{ mesh: Mesh; root: V3; id: number }> = [];
    for (let q = 0; q < s.mane.crown; q++) {
      const id = 880 + q, f = q / Math.max(1, s.mane.crown - 1) - 0.5;
      const at = onRings(H, lerp(H.y[0], H.y[2], 0.5), Math.PI / 2 + f * 1.4);
      crown.push({ mesh: shingle(sub(at.p, scale(at.n, 0.01)), at.n, unit(add([0, -1, 0], [f * 1.2, 0, 0])), s.mane.a * 0.85, s.mane.b * 0.85, s.mane.t, s.mane.lift * 0.6, q % 3, id), root: at.p, id });
    }
    add2('crown', 'head', crown, { bias: 0.215, after: ['head'], hide: solids, hideIn: 'head' });
  }
  extras.push({ key: 'teeth', mesh: teethOf(s), bone: 'head', bias: 0.005, after: ['head', 'jaw'], front: [0, 1, 0], hide: solids, hideIn: 'head' });
  extras.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.003, after: ['body', 'neck'], under: 'head', front: [0, 1, 0], hide: [{ c: skull.c, r: skull.r }], hideIn: 'head' });
  extras.push({ key: 'mouth', mesh: mouthOf(s, n), bone: 'jaw', bias: 0.002, after: ['body', 'neck'], under: ['head', 'jaw'], front: [0, 1, 0] });
  if (fine) extras.push({ key: 'whiskers', mesh: whiskersOf(s), bone: 'head', bias: 0.006, after: ['head'], front: [0, 1, 0], hide: solids, hideIn: 'head', thin: true, airy: true });
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.9, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -40,
    tail: [tailOf(s, n, fine)],
    fore: { upper: [0, -s.fore[0], s.thick, s.thick], lower: [0, -s.fore[1], s.thick, s.thick], foot: forePaw(s, n, k) },
    hind: { upper: [0, -s.hind[0], s.thick, s.thick], lower: [0, -s.hind[1], s.thick, s.thick], foot: hindFoot(s, n, k) },
    breath: 0.03,
    extras,
  }).filter((pc) => !/^(fl|fr|hl|hr)[012]$/.test(pc.key));
  pieces.push(...legPieces(s, n, k));
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, false), shut: headOf(s, n, true), hide: solids, after: ['body', 'neck', 'nape', 'collar'], front: [0, 1, 0.2] };
    if (pc.key === 'body') return { ...pc, mesh: body };
    // The neck warm fur over its nape, cream down its throat into the chest.
    if (pc.key === 'neck') {
      const nw = s.neck.w, nh = s.neck.w * 0.9, nl = s.neck.len;
      return { ...pc, mesh: tube([[0, 0, -0.16 * (nw / 0.34)], [0, 0, nl * 0.5], [0, 0.03, nl]], nw, nh, n, (_r, j) => (Math.sin(((j + 1) / n) * TAU) > 0.3 ? 'belly' : 'coat'), { seam: 'both' }) };
    }
    if (pc.key === 'tail0') return { ...pc, bias: -0.04 };
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

/** Wood chips: pale fresh-cut tan, light brown, and the dark of bark; sawdust; leaves. */
const CHIP_RGB: readonly RGB[] = [[238, 204, 146], [204, 150, 92], [118, 80, 52]];
const DUST_RGB: RGB = [236, 214, 170];
const LEAF_RGB: readonly RGB[] = [[112, 176, 58], [128, 146, 46]];
const css = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Logchewer's: less than in proportion on the small one, so they still read. */
const bigness = (s: Gnaw): number => 0.45 + 0.55 * (s.len / 1.3);

/**
 * A wood chip in the air: a flat splinter, a pale fresh face over its upper half and a darker under it, a dark edge and a line
 * of grain; drawn whole, going by shrinking rather than fading, so chips over each other never show through one another.
 */
function woodChip(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB): void {
  if (len <= 0.02) return;
  // Never under two and a half pixels long while it is whole, so it reads at the size the island is played at.
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  len = Math.max(len, Math.min(2.5 / px, len * 4));
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(-len * 0.18, -len * 0.2);
  g.lineTo(len / 2, -len * 0.06);
  g.lineTo(len * 0.22, len * 0.16);
  g.closePath();
  g.fillStyle = css(mix(c, [70, 44, 28], 0.22));
  g.fill();
  g.lineWidth = len * 0.07;
  g.strokeStyle = css(mix(c, [52, 32, 22], 0.6));
  g.stroke();
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(-len * 0.18, -len * 0.2);
  g.lineTo(len / 2, -len * 0.06);
  g.closePath();
  g.fillStyle = css(mix(c, [255, 246, 224], 0.3));
  g.fill();
  g.lineWidth = len * 0.04;
  g.strokeStyle = css(mix(c, [80, 52, 32], 0.45));
  g.beginPath();
  g.moveTo(-len * 0.36, -len * 0.02);
  g.lineTo(len * 0.36, -len * 0.05);
  g.stroke();
  g.restore();
}

/** A leaf in the air: a pointed maple-ish leaf, two side lobes, its dark rib and edge, fluttering as it turns. */
function leafBit(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, flat: number, c: RGB): void {
  if (r <= 0.02) return;
  const tr = g.getTransform(), px = Math.hypot(tr.a, tr.b) || 1;
  r = Math.max(r, Math.min(1.5 / px, r * 4));
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(1, Math.max(0.25, Math.abs(flat)));
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(r * 0.3, -r * 0.5, r * 0.75, -r * 0.45);
  g.quadraticCurveTo(r * 0.45, -r * 0.05, r * 0.6, r * 0.3);
  g.quadraticCurveTo(r * 0.2, r * 0.35, 0, r * 0.75);
  g.quadraticCurveTo(-r * 0.2, r * 0.35, -r * 0.6, r * 0.3);
  g.quadraticCurveTo(-r * 0.45, -r * 0.05, -r * 0.75, -r * 0.45);
  g.quadraticCurveTo(-r * 0.3, -r * 0.5, 0, -r);
  g.closePath();
  g.fillStyle = css(c);
  g.fill();
  g.lineWidth = r * 0.12;
  g.strokeStyle = css(mix(c, [30, 46, 18], 0.6));
  g.stroke();
  g.beginPath();
  g.moveTo(0, -r * 0.8);
  g.lineTo(0, r * 0.95);
  g.lineWidth = r * 0.08;
  g.stroke();
  g.restore();
}

/**
 * A puff of sawdust: a soft translucent cloud of three lobes, each a radial falloff with no edge, growing half again as it
 * goes and thinning to nothing over its life (`age`, nought to one), so it reads as dust in the air rather than a cut-out.
 */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0, base: RGB = DUST_RGB): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.45 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.6 * age);
  const c = mix(base, [252, 246, 232], 0.25 + 0.4 * age);
  g.save();
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + jitter(id) * TAU, d = q ? rr * 0.4 : 0, lr = rr * (q ? 0.7 : 1);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.6 - rr * 0.15 * age;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, lr);
    grad.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(al * (q ? 0.7 : 1)).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(al * 0.45 * (q ? 0.7 : 1)).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0)`);
    g.fillStyle = grad;
    g.fillRect(cx - lr, cy - lr, lr * 2, lr * 2);
  }
  g.restore();
}

/** The top of its outline across the screen, in strips, as it stands now: what a chip thrown toward a viewer behind it must clear. */
interface Outline { toward: boolean; clear: (sx: number, sy: number) => boolean }
function outlineOf(view: View, b: Bones, crest: ReadonlyArray<[string, V3]>, strip: number): Outline {
  const toward = -view.T[1] > 0.3, sky = new Map<number, number>();
  let x0 = Infinity, x1 = -Infinity;
  if (toward) {
    for (const [key, v] of crest) {
      if (!b[key]) continue;
      const [sx, sy] = onScreen(view, place(b[key], v)), i = Math.round(sx / strip);
      sky.set(i, Math.min(sky.get(i) ?? Infinity, sy));
      x0 = Math.min(x0, sx);
      x1 = Math.max(x1, sx);
    }
  }
  const top = (sx: number): number => { const i = Math.round(sx / strip); return Math.min(sky.get(i - 1) ?? Infinity, sky.get(i) ?? Infinity, sky.get(i + 1) ?? Infinity); };
  return { toward, clear: (sx, sy) => !toward || sx < x0 - strip * 0.5 || sx > x1 + strip * 0.5 || sy < top(sx) - strip * 0.3 };
}

/** Whether a point on the screen is inside the head's outline there, roughly: a chip rising from the teeth is not drawn across the face. */
function onFace(view: View, b: Bones, s: Gnaw, sx: number, sy: number): boolean {
  const c = place(b.head, [0, s.head.y[4], s.head.z[4]]), [cx, cy] = onScreen(view, c);
  const r = Math.hypot(view.ex[0], view.ex[1]) * s.head.w[3] * 1.05;
  return Math.hypot(sx - cx, (sy - cy) * 1.1) < r;
}

/**
 * One spray of wood: chips and a few leaves thrown from `from`, `since` seconds after, out to either side and up, some high
 * enough to be seen over its crest from behind; each sorted in front of the body or behind it, a chip coming toward a viewer
 * behind it drawn in front only once it is out past its outline, and never across its face while it rises.
 */
function spray(g: CanvasRenderingContext2D, view: View, s: Gnaw, b: Bones, from: V3, since: number, front: boolean, o: { count: number; id: number; speed: number; up: number; leaves: number; ahead: number; life: number; size?: number; high?: boolean; boost?: number; over?: boolean }, line: Outline): void {
  const big = bigness(s), mid = b.body.t;
  if (since < 0 || since > o.life) return;
  for (let c = 0; c < o.count; c++) {
    const id = o.id + c * 7;
    const sd = c % 2 ? 1 : -1, high = o.high || c % 3 === 0;
    // Out past its flanks in a third of a second, and the high ones up over the top of it.
    const out = o.speed * (0.7 + 0.6 * jitter(id + 1)) * (line.toward ? 1.3 : 1);
    const lift = high ? Math.sqrt(2 * 9 * Math.max(0.2, o.up - from[2]) * (0.9 + 0.3 * jitter(id + 3))) : Math.sqrt(2 * 9 * Math.max(0.1, (o.up - from[2]) * 0.3));
    const v: V3 = [sd * out, o.ahead + (jitter(id + 2) - 0.5) * o.speed * 0.5, lift + (o.boost ?? 0)];
    const leaf = c < o.leaves;
    const p = thrown(from, v, since, leaf ? 6 : 9);
    const [x, y] = onScreen(view, p);
    // Thrown up off the top of its head toward a viewer behind it, a chip is over the back of its head from the first moment.
    const near = (o.over && line.toward) || (nearSide(p, mid, view) && line.clear(x, y));
    if (near !== front) continue;
    if (front && since < 0.12 && onFace(view, b, s, x, y)) continue;
    const k = 1 - smooth((since - o.life * 0.6) / (o.life * 0.4));
    if (leaf) leafBit(g, x, y, 0.26 * big * k * (o.size ?? 1), id + since * 7, Math.cos(since * 14 + id), LEAF_RGB[c % 2]);
    else woodChip(g, x, y, (0.34 + 0.14 * jitter(id + 4)) * big * k * (o.size ?? 1), id + since * (9 + 6 * jitter(id)), CHIP_RGB[c % 3]);
  }
}

/**
 * Gnawing: at each bite, as its teeth close on the bark, wood chips spraying out from its teeth to either side and up and a
 * puff of sawdust at the bark; at the tug, as the tree gives, a bigger burst of chips and a leaf or two shaken down; and as its
 * tail slaps down, dust off the ground behind it. A go played once throws nothing until its first bite.
 */
function workSpray(g: CanvasRenderingContext2D, view: View, s: Gnaw, b: Bones, R: Rest, a: Anim, t: number, front: boolean, at: (t: number) => Bones, crest: ReadonlyArray<[string, V3]>): void {
  const big = bigness(s), mid = b.body.t, line = outlineOf(view, b, crest, 0.12 * big), down = downOf(t, a.graze, riseOf(s), endOf(s));
  const loop = a.graze >= 0.5;
  const since = (t0: number): number => (t < t0 && !loop ? -1 : frac(t - t0) * ACT_SECS.work);
  const speed = s.body.w[3] * 2.6, up = R.top * 1.08;
  biteTimes(s.stage).forEach((h, k) => {
    const dt = since(h);
    if (dt < 0 || dt > 0.6) return;
    const from = place(at(h).head, R.teeth);
    from[1] = R.trunk;
    spray(g, view, s, b, from, dt, front, { count: 8 + s.stage, id: 40 + k * 31, speed, up, leaves: 0, ahead: -0.3 * speed, life: 0.6 }, line);
    if (line.toward) spray(g, view, s, b, from, dt, front, { count: 2, id: 90 + k * 17, speed: s.body.w[3] * 0.5, up: R.top * 1.2, leaves: 0, ahead: 0, life: 0.6, high: true }, line);
    const p: V3 = [from[0], from[1] + 0.04 * big, from[2]];
    if (nearSide(p, mid, view) === front) puff(g, view, p, 0.3 * big, dt / 0.3, k + 2);
  });
  // The tree giving: a burst of chips and a couple of leaves shaken down off it.
  const dt = since(GNAW_GO.tug - 0.02);
  if (dt >= 0 && dt < 0.75 && down > 0.3) {
    const from = place(at(GNAW_GO.tug - 0.02).head, R.teeth);
    from[1] = R.trunk;
    spray(g, view, s, b, from, dt, front, { count: 11 + 2 * s.stage, id: 300, speed: speed * 1.15, up: up * 1.12, leaves: 4, ahead: -0.2 * speed, life: 0.75, size: 1.15 }, line);
  }
  // The tail slapped down behind it: dust off the ground either side of its end.
  const ds = since(GNAW_GO.slap);
  if (ds >= 0 && ds < 0.35 && down > 0.3) tailDust(g, view, s, at(GNAW_GO.slap), mid, ds, front, 0.8);
}

/** Dust off the ground where its tail slaps down, to either side of the paddle, rising: seen from behind as well as in front. */
function tailDust(g: CanvasRenderingContext2D, view: View, s: Gnaw, b: Bones, mid: V3, since: number, front: boolean, k: number): void {
  const big = bigness(s);
  const end = place(b.tail0, [0, -s.tail.len * 0.75, 0]);
  for (const sd of [-1, 1]) {
    const p: V3 = [end[0] + sd * (s.tail.w + 0.5 * big * ramp(since, 0, 0.25)), end[1], (0.15 + 0.5 * ramp(since, 0, 0.25)) * big];
    if (nearSide(p, mid, view) === front) puff(g, view, p, big * k * 0.75, since / 0.35, sd + 9);
  }
  if (!front) {
    // Bits of earth and leaf litter thrown up off the ground.
    for (let c = 0; c < 6; c++) {
      const v: V3 = [(jitter(c + 70) - 0.5) * 3, -1 - jitter(c + 71), 3 + 2 * jitter(c + 72)];
      const p = thrown([end[0], end[1], 0.05], scale(v, Math.sqrt(big)), since, 9);
      const [x, y] = onScreen(view, p);
      if (c % 2) leafBit(g, x, y, 0.16 * big * (1 - ramp(since, 0.2, 0.35)), c + since * 9, Math.cos(since * 12 + c), LEAF_RGB[c % 2]);
      else woodChip(g, x, y, 0.2 * big * (1 - ramp(since, 0.2, 0.35)), c * 2 + since * 8, CHIP_RGB[2]);
    }
  }
}

/**
 * The strike: where its bite lands, chips and leaves bursting from its teeth and a puff; the Logchewer's tail slapped down, with
 * dust off the ground; and the Timberlord's slam, the ground cracked under its paws, a ring of dust going out, and a burst of
 * chips and leaves thrown up high, over its crest so it is seen from behind.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Gnaw, b: Bones, R: Rest, hits: Bones[], t: number, front: boolean, crest: ReadonlyArray<[string, V3]>): void {
  const big = bigness(s), hs = GNAW_HITS[s.strike], mid = b.body.t, line = outlineOf(view, b, crest, 0.12 * big);
  const since = (h: number): number => (t - h) * ACT_SECS.strike;
  // The bite.
  {
    const dt = since(hs[0]);
    if (dt > 0) {
      const from = place(hits[0].head, R.teeth);
      spray(g, view, s, b, from, dt, front, { count: 8 + 3 * s.strike, id: 500, speed: s.body.w[3] * 2.8, up: R.top * 1.1, leaves: 3 + s.strike, ahead: 1.0 * Math.sqrt(big), life: 0.5 }, line);
      // Seen from behind, a few thrown straight up over the top of it as the bite lands.
      if (line.toward && dt < 0.6) {
        const H = s.head, crown = place(hits[0].head, [0, H.y[1], H.z[1] + H.h[1]]);
        spray(g, view, s, b, crown, dt, front, { count: 6, id: 560, speed: s.body.w[3] * 3.4, up: crown[2] + R.headLen * 0.35, leaves: 2, ahead: 0, life: 0.5, high: true, boost: 1.5, size: 1.3, over: true }, line);
      }
      const p: V3 = [from[0], from[1] + 0.1 * big, from[2]];
      if (nearSide(p, mid, view) === front) puff(g, view, p, 0.36 * big, dt / 0.3, 4);
    }
  }
  if (s.strike === 1) {
    const dt = since(hs[1]);
    if (dt > 0 && dt < 0.35) tailDust(g, view, s, hits[1], mid, dt, front, 1.0);
  }
  if (s.strike !== 2) return;
  const dt = since(hs[0]);
  if (dt < 0) return;
  const at = hits[0];
  const paws = ['fl2', 'fr2'].map((k) => place(at[k], [0, s.paw, -s.fore[2]]));
  const ground = scale(add(paws[0], paws[1]), 0.5);
  ground[2] = 0.02;
  const [gx, gy] = onScreen(view, ground);
  if (!front) {
    const k = 1 - ramp(dt, 0.25, 0.45);
    g.save();
    g.strokeStyle = 'rgb(78,54,36)';
    g.lineCap = 'round';
    for (let c = 0; c < 9; c++) {
      const th = (c / 9) * TAU + jitter(c + 50) * 0.6, L = (1.0 + 0.9 * jitter(c + 51)) * big * ramp(dt, 0, 0.05);
      g.lineWidth = 0.13 * big * k;
      g.beginPath();
      g.moveTo(gx, gy);
      g.lineTo(gx + Math.cos(th) * L * 0.5 + 0.1 * big, gy + Math.sin(th) * L * 0.28);
      g.lineTo(gx + Math.cos(th) * L, gy + Math.sin(th) * L * 0.52);
      g.stroke();
    }
    g.restore();
  }
  // A ring of dust going out over the ground from under the slam: low soft puffs travelling out on an ellipse, each sorted with
  // the body, rather than a drawn hoop.
  if (dt < 0.45) {
    const out = ramp(dt, 0, 0.35), rx = big * (1.6 + 3.6 * out);
    for (let c = 0; c < 9; c++) {
      const th = (c / 9) * TAU + 0.3;
      const p: V3 = [ground[0] + Math.cos(th) * rx, ground[1] + Math.sin(th) * rx * 0.75, 0.15 * big];
      if (nearSide(p, mid, view) === front) puff(g, view, p, big * 0.55, dt / 0.45, 30 + c);
    }
  }
  // Dust out past its flanks, and a burst of chips and leaves thrown up high from under its paws.
  if (dt < 0.4) for (const sd of [-1, 1]) {
    const p: V3 = [paws[sd > 0 ? 1 : 0][0] + sd * big * (0.6 + 0.8 * ramp(dt, 0, 0.3)), paws[0][1], (0.3 + 0.6 * ramp(dt, 0, 0.3)) * big];
    if (nearSide(p, mid, view) === front) puff(g, view, p, big * 1.0, dt / 0.45, sd + 5);
  }
  for (const [q, paw] of paws.entries()) spray(g, view, s, b, [paw[0], paw[1], 0.15], dt, front, { count: 9, id: 700 + q * 50, speed: s.body.w[3] * 2.6, up: R.top * 1.1, leaves: 3, ahead: 0.6, life: 0.6 }, line);
}

/**
 * Evolving: at the start a burst of leaves and chips out of its back, which covers the moment it changes into its new body;
 * then a swirl of leaves and wood chips going round it and up as its mantle and its stakes grow in.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Gnaw, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]];
  const B = s.body;
  const burst = ramp(t, 0, 0.02) * (1 - ramp(t, 0.12, 0.3));
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 30; q++) {
      const th = (q / 30) * TAU * 2.4 + jitter(q) * 0.7;
      const from = place(b.trunk, [Math.cos(th) * B.w[3] * 0.4, B.y[3] + Math.sin(th) * s.len * 0.3, B.z[3] + B.h[3] * 0.8]);
      const v: V3 = [Math.cos(th) * (2.2 + 2.2 * jitter(q + 3)), Math.sin(th) * (2.2 + 2.2 * jitter(q + 5)), 3 + 3.5 * jitter(q + 7)];
      const p = thrown(from, scale(v, Math.sqrt(big)), since, 5);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 2) leafBit(g, x, y, 0.32 * big * burst, q * 1.3 + since * 6, Math.cos(since * 10 + q), LEAF_RGB[q % 2]);
      else woodChip(g, x, y, 0.45 * big * burst, q * 1.3 + since * 8, CHIP_RGB[q % 3]);
    }
  }
  const swirl = ramp(t, 0.08, 0.18) * (1 - ramp(t, 0.66, 0.86));
  if (swirl > 0) {
    const rx = B.w[3] * 1.4 + 0.3 * big, ry = s.len * 0.8 + 0.3 * big, top = B.h[3] * 2.4 + 1.2 * big;
    for (let q = 0; q < 20; q++) {
      const rise = frac(t * 1.6 + jitter(q + 20));
      const ang = (q / 20) * TAU + t * 9;
      const p = place(b.trunk, [Math.cos(ang) * rx, Math.sin(ang) * ry, -B.h[3] * 0.6 + rise * top]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const k = swirl * Math.sin(rise * Math.PI);
      if (q % 2) leafBit(g, x, y, 0.28 * big * k, ang * 2, Math.cos(ang * 3), LEAF_RGB[q % 2]);
      else woodChip(g, x, y, 0.36 * big * k, ang * 2 + q, CHIP_RGB[q % 3]);
    }
  }
}

/** Light over the whole of it as it evolves: a green-gold glow as it begins, and over its back at the turn. */
function gnawGlow(s: Gnaw, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act, B = s.body;
  if (act?.kind !== 'evolve') return [];
  const out: Array<{ p: V3; r: number; c: RGB; a: number }> = [];
  const open = 1 - ramp(act.t, 0.02, 0.1);
  if (open > 0) out.push({ p: place(b.trunk, [0, B.y[3], B.h[3] * 0.6]), r: B.y[6] - B.y[0], c: [214, 236, 150], a: 0.55 * open });
  const k = 0.2 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.95)) + 0.32 * hump(act.t, 0.5, 0.08);
  if (k > 0) out.push({ p: place(b.trunk, [0, B.y[3], B.h[3] * 1.4]), r: s.len * 0.9 + 0.5, c: [236, 222, 160], a: k });
  return out;
}

/* ---- the kinds ----------------------------------------------------------------------------- */


/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, gnaws and evolves. */
function gnawKind(s: Gnaw): Kind {
  const bones = gnawBones(s);
  const spec = specOf(s), R = restOf(s, spec);
  const atHits = (a: Anim): Bones[] => GNAW_HITS[s.strike].map((t) => bones({ ...a, act: { kind: 'strike', t } }));
  /** The top of everything on it but its legs, as a few points on their bones, worked out once: its outline on the screen. */
  let crest: Array<[string, V3]> | undefined;
  const crestOf = (): Array<[string, V3]> => {
    if (!crest) {
      const b = bones({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 });
      crest = [];
      for (const pc of gnawBuild(s, 0)) {
        if (/^[fh][lr]/.test(pc.key) || !b[pc.bone]) continue;
        const v = [...pc.mesh.v].sort((p, q) => place(b[pc.bone], q)[2] - place(b[pc.bone], p)[2]);
        for (let i = 0; i < Math.min(v.length, 48); i++) crest.push([pc.bone, v[i]]);
      }
    }
    return crest;
  };
  return {
    bones,
    build: (lod) => gnawBuild(s, lod),
    // The variant's coat for its fur, its markings for the cream of its muzzle, chest and belly; the dark of its forearms, shins,
    // feet and tail from its coat; and in every variant the same wood, leaves, moss and ivory teeth.
    palette: (coat, mark) => {
      const fur = mix(coat, [246, 196, 140], 0.16), cream = mark;
      const limb = mix(fur, [56, 36, 26], 0.56), tail: RGB = mix([160, 112, 74], limb, 0.2);
      return {
        ...coatPaletteFor(fur, cream),
        coat: fur,
        coatDark: mix(fur, [80, 50, 34], 0.25),
        coatLight: mix(fur, [255, 240, 220], 0.3),
        mark: cream,
        belly: mix(cream, [248, 220, 176], 0.6),
        muzzle: mix(cream, [250, 232, 200], 0.12),
        lid: [44, 30, 28],
        nose: [36, 28, 28],
        pad: [70, 46, 40],
        inner: [236, 156, 152],
        eye: [24, 18, 20],
        glint: [255, 253, 246],
        tongue: [214, 112, 112],
        featherDark: [104, 82, 70],
        hoof: limb,
        claw: [46, 32, 28],
        tooth: [252, 242, 206],
        stone: [222, 206, 164],
        stoneDark: mix(tail, [52, 34, 24], 0.42),
        bark: tail,
        grip: mix(tail, [52, 34, 24], 0.2),
        wood: [236, 200, 140],
        woodDark: [196, 154, 98],
        shell: [196, 136, 82],
        shellDark: [148, 98, 58],
        crystal: [128, 88, 58],
        crystalDark: [96, 64, 42],
        horn: [210, 170, 112],
        hornDark: [160, 118, 76],
        leaf: [116, 180, 62],
        leafDark: [96, 140, 48],
        moss: [132, 152, 50],
        stem: [110, 84, 52],
      } as ReturnType<Kind['palette']>;
    },
    shadow: [s.len * 0.75 + s.tail.len * 0.3, s.body.w[3] * 1.0],
    stride: 1.2,
    size: s.size,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are leaf green and fresh-cut wood.
    motes: [[124, 190, 70], [236, 200, 140]],
    glow: (b, a) => gnawGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, R, atHits(a), act.t, front, crestOf());
      else if (act?.kind === 'work') workSpray(g, view, s, b, R, a, act.t, front, (t) => bones({ ...a, act: { kind: 'work', t } }), crestOf());
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

/** The palette every kind starts from, for the colours not set here. */
const coatPaletteFor = (coat: RGB, mark: RGB): ReturnType<Kind['palette']> => coatPalette(coat, mark, {}, 28);

export const SAPGNAW = gnawKind(SAPGNAW_LOOK);
export const LOGCHEWER = gnawKind(LOGCHEWER_LOOK);
export const TIMBERLORD = gnawKind(TIMBERLORD_LOOK);
