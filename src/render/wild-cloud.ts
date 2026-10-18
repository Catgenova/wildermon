import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, lifted, LOOP, merge, mix, onEgg, orb, orbAlong, paint, pastel,
  quadBonesOf, scale, shadowOf, smile, smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type LegSpec, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The cloud line: the Cloudlet, a round lamb buried in a fleece that is a
 * cloud, which grows into the Cloudram, a tall young ram, and then the
 * Cloudborne, a big ram under a towering heap of cloud. The species is still
 * `woola` underneath, as saves and the database know it.
 *
 * Each is a cream sheep with a soft face, big blue eyes, pink-lined ears held
 * out to the sides, dark cloven hooves, and brown ram's horns curling round
 * its ears, bigger at each stage, with gold bands on them from the Cloudram
 * on; ice-blue crystals hang on gold chains from its throat, its horns and
 * its chest. Its fleece is cream and sky-blue puffs of cloud, and lavender on
 * the Cloudborne, with flowers in it; it grows (`Anim.fleece`) and is shorn,
 * and shorn it is a slim short-coated sheep with cuffs of cloud round its
 * ankles, a tuft on its head and its tail, and from the Cloudram a ruff of
 * cloud on its chest and a puff on its rump. All three are built by one set
 * of functions from a description of the stage (`Cloud`), so a stage is its
 * numbers.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** The colours its cloud comes in: cream, sky blue, and on the Cloudborne lavender. */
type Tint = 'cream' | 'blue' | 'lilac';

/** Rings along a body or a head: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Cloud {
  /** The barrel's rings, rump to chest: the body under the fleece, which is all there is of it shorn. */
  body: Rings;
  /** Shoulder to hip, and the legs: how long, how thick at the top, and how tall the hoof is. */
  len: number;
  legs: number;
  thick: number;
  hoof: number;
  /** The neck's root on the body, its length, width and how far forward of upright it is carried (degrees). */
  neck: { at: V3; len: number; w: number; lean: number };
  /**
   * The head, in its own frame: the skull, an egg (its middle and half-sizes); the muzzle, an egg out of the front of it (its
   * middle, the way it points, and its half-sizes across, up and along); and how far nose-up it is carried (degrees).
   */
  head: { skull: { c: V3; r: V3 }; muzzle: { c: V3; dir: V3; r: V3 }; pitch: number };
  /** The eyes: the way out of the skull to the right one, how big, and how far a lid comes down over each (nought to one). */
  eye: { dir: V3; size: number; lid: number };
  /** Each ear: its length and width, and how far it is held out to the side and laid back (degrees). */
  ear: { len: number; w: number; out: number; back: number };
  /**
   * Each horn: how thick at the root, the radius its curl starts at, how many turns it makes, how far out from the head the curl
   * goes by its tip, where along it (nought at the root, one at the tip) its gold bands are and its crystals hang from, and
   * where round its curl it starts (degrees from straight ahead of the curl's middle, up positive: ninety is straight over it,
   * less starts it ahead, with the curl's middle back behind the root).
   */
  horn: { r: number; R: number; turns: number; flare: number; bands: number[]; drops: number[]; start: number };
  /**
   * The fleece: how far out from the body the middles of its puffs stand, how big a puff is, how many rings of them along the
   * body and how many round a ring, how many big billows along the top, how far its skirt hangs, and how many of its puffs
   * are blue and how many lavender (scattered, low on it); and its patches of colour, down each side: how far along the body
   * each is (nought the rump, one the chest), how far round it from the side (radians, up positive), how big, and its colour.
   */
  fleece: { loft: number; puff: number; rows: number; per: number; billows: number; skirt: number; blue: number; lilac: number; spots: Array<[number, number, number, Tint]> };
  /** The cloud it keeps shorn: a ruff round the chest, a puff on the rump, cuffs round the ankles, a tuft on the crown, and the tail's puff. */
  ruff: number;
  rump: number;
  cuff: number;
  tuft: number;
  tail: number;
  /**
   * Its flowers: blue cloud-flowers on its fleece, so many down each side, or garlands of cream blossoms, each with a leaf,
   * along its chains, so many down each flank and one more across its chest; and a blue cloud-flower on its crown.
   */
  bloom: { cream: boolean; side: number };
  /** Its crystals: one on a charm at the throat, how many on a chain across the chest, and how many on a chain down each flank. */
  charm: { throat: boolean; chest: number; flank: number; big: number };
  /**
   * How it goes, a trot at a walk and at a run, the diagonals together: how much it bounces at a walk and at a run; how far it
   * dips at a walk, on knees that give under it in the middle of each pair's stance; how far it nods; how far its legs swing at a walk and a run and for how much of a stride a foot is down; and how far its fleece
   * drifts behind it.
   */
  gait: { bounce: [number, number]; dip: number; nod: number; swing: [number, number]; duty: [number, number]; drift: number };
  /** Its strike: a hop and a butt, a rearing butt, or a charging slam. */
  strike: 0 | 1 | 2;
  size: number;
}

/** A head scaled by `k` about its neck, for a head drawn bigger or smaller against its body. */
const sized = (k: number, H: Cloud['head']): Cloud['head'] => ({
  skull: { c: scale(H.skull.c, k), r: scale(H.skull.r, k) }, muzzle: { c: scale(H.muzzle.c, k), dir: H.muzzle.dir, r: scale(H.muzzle.r, k) }, pitch: H.pitch,
});

/**
 * A Cloudlet: a small round lamb, short in the leg, with a big round head, huge blue eyes and small curled horns, buried in a
 * round cloud of a fleece; a blue crystal on a gold charm at its throat and a blue cloud-flower on its crown and its side.
 */
const CLOUDLET_LOOK: Cloud = {
  body: { y: [-1.02, -0.9, -0.5, 0.04, 0.52, 0.84, 0.98], z: [0.12, 0.1, 0.06, 0.06, 0.08, 0.14, 0.18], w: [0.3, 0.56, 0.66, 0.66, 0.64, 0.56, 0.3], h: [0.32, 0.58, 0.64, 0.66, 0.64, 0.58, 0.34] },
  len: 1.8, legs: 0.92, thick: 0.2, hoof: 0.13,
  neck: { at: [0, 0.9, 0.44], len: 0.5, w: 0.34, lean: 32 },
  head: sized(1.25, { skull: { c: [0, 0, 0.32], r: [0.58, 0.56, 0.54] }, muzzle: { c: [0, 0.42, 0.08], dir: [0, 1, -0.45], r: [0.25, 0.22, 0.3] }, pitch: -4 }),
  eye: { dir: [0.6, 0.62, 0.4], size: 0.165, lid: 0 },
  ear: { len: 0.48, w: 0.16, out: 92, back: 40 },
  horn: { r: 0.12, R: 0.28, turns: 0.74, flare: 0.08, bands: [], drops: [], start: 95 },
  fleece: { loft: 0.36, puff: 0.5, rows: 3, per: 7, billows: 3, skirt: 0.12, blue: 0.12, lilac: 0, spots: [[0.45, 0.25, 0.42, 'blue']] },
  ruff: 0.2, rump: 0, cuff: 0.11, tuft: 0.17, tail: 0.21,
  bloom: { cream: false, side: 1 },
  charm: { throat: true, chest: 0, flank: 0, big: 0.06 },
  gait: { bounce: [0.24, 0.28], dip: 0, nod: 6, swing: [28, 40], duty: [0.5, 0.36], drift: 0 },
  strike: 0,
  size: 1.8,
};

/**
 * A Cloudram: a taller, leggier young ram, longer in the face, its horns curling right round its ears with a gold band on
 * each; its fleece a heap of cream puffs, blue over its shoulders and its hip, with garlands of cream blossoms across its
 * chest and over its shoulders, and crystals on gold chains hanging from its horns and across its chest.
 */
const CLOUDRAM_LOOK: Cloud = {
  body: { y: [-1.3, -1.16, -0.68, 0, 0.66, 1.1, 1.26], z: [0.14, 0.1, 0.06, 0.08, 0.12, 0.2, 0.24], w: [0.34, 0.6, 0.68, 0.68, 0.68, 0.6, 0.32], h: [0.34, 0.6, 0.68, 0.72, 0.76, 0.72, 0.4] },
  len: 2.3, legs: 1.5, thick: 0.22, hoof: 0.15,
  neck: { at: [0, 1.22, 0.62], len: 0.92, w: 0.4, lean: 24 },
  head: sized(1.18, { skull: { c: [0, 0, 0.3], r: [0.5, 0.5, 0.48] }, muzzle: { c: [0, 0.44, 0.06], dir: [0, 1, -0.42], r: [0.24, 0.23, 0.38] }, pitch: -2 }),
  eye: { dir: [0.58, 0.66, 0.42], size: 0.145, lid: 0.12 },
  ear: { len: 0.54, w: 0.17, out: 90, back: 36 },
  horn: { r: 0.18, R: 0.4, turns: 1.1, flare: 0.07, bands: [0.62], drops: [0.62, 0.62], start: 78 },
  fleece: { loft: 0.42, puff: 0.62, rows: 4, per: 7, billows: 4, skirt: 0.2, blue: 0.12, lilac: 0, spots: [[0.8, 0.45, 0.5, 'blue'], [0.2, 0.3, 0.42, 'blue']] },
  ruff: 0.3, rump: 0.36, cuff: 0.15, tuft: 0.2, tail: 0.24,
  bloom: { cream: true, side: 2 },
  charm: { throat: false, chest: 3, flank: 0, big: 0.08 },
  gait: { bounce: [0.04, 0.34], dip: 0.24, nod: 4, swing: [24, 36], duty: [0.5, 0.38], drift: 0.04 },
  strike: 1,
  size: 1.86,
};

/**
 * A Cloudborne: a big, calm ram on long legs, its head carried high on a tall neck, with a long noble face, half-lidded eyes
 * and huge curling horns, bigger than its head, with two gold bands on each, under a towering cloud of cream with blue and
 * lavender heaped over the top; many crystals hang from its horns and from gold chains, garlanded with cream blossoms, round
 * its chest and down its flanks.
 */
const CLOUDBORNE_LOOK: Cloud = {
  body: { y: [-1.66, -1.48, -0.9, -0.04, 0.84, 1.42, 1.62], z: [0.16, 0.12, 0.08, 0.12, 0.2, 0.3, 0.34], w: [0.42, 0.74, 0.86, 0.88, 0.9, 0.8, 0.4], h: [0.42, 0.74, 0.86, 0.94, 1.02, 0.98, 0.5] },
  len: 2.95, legs: 1.75, thick: 0.27, hoof: 0.18,
  neck: { at: [0, 1.52, 0.84], len: 1.3, w: 0.5, lean: 15 },
  head: sized(1.2, { skull: { c: [0, 0, 0.32], r: [0.52, 0.54, 0.5] }, muzzle: { c: [0, 0.52, 0.06], dir: [0, 1, -0.38], r: [0.25, 0.25, 0.45] }, pitch: 2 }),
  eye: { dir: [0.56, 0.68, 0.44], size: 0.135, lid: 0.4 },
  ear: { len: 0.6, w: 0.19, out: 88, back: 32 },
  horn: { r: 0.32, R: 0.8, turns: 1.1, flare: 0.2, bands: [0.3, 0.6], drops: [0.3, 0.6, 0.6], start: 70 },
  fleece: { loft: 0.5, puff: 0.74, rows: 4, per: 9, billows: 5, skirt: 0.3, blue: 0.12, lilac: 0.06, spots: [[0.3, 1.25, 0.62, 'blue'], [0.7, 0.9, 0.55, 'lilac'], [0.15, 0.2, 0.5, 'lilac'], [0.6, 0.15, 0.45, 'blue']] },
  ruff: 0.38, rump: 0.48, cuff: 0.21, tuft: 0.24, tail: 0.28,
  bloom: { cream: true, side: 3 },
  charm: { throat: false, chest: 3, flank: 2, big: 0.1 },
  gait: { bounce: [0, 0.38], dip: 0.3, nod: 2.5, swing: [17, 26], duty: [0.5, 0.42], drift: 0.12 },
  strike: 2,
  size: 2.1,
};

/** A number of its own for each puff and flower, nought to one, so a fleece is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);

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
const onBody = (s: Cloud, y: number, th: number): { p: V3; n: V3 } => onRings(s.body, y, th);
/** Where the way `dir` out of the middle of the skull meets it, and the way out of it there. */
const onSkull = (s: Cloud, dir: V3): { p: V3; n: V3 } => onEgg(s.head.skull.c, s.head.skull.r, dir);
/** The muzzle's own frame: across it (to the left), up it, and along it. */
function muzzleFrame(s: Cloud): [V3, V3, V3] {
  const z = unit(s.head.muzzle.dir), x = unit(cross([0, 0, 1], z));
  return [x, cross(z, x), z];
}
/** Where the way `dir` out of the middle of the muzzle, in its own frame (`muzzleFrame`), meets it, and the way out of it there. */
function onMuzzle(s: Cloud, dir: V3): { p: V3; n: V3 } {
  const M = s.head.muzzle, [x, y, z] = muzzleFrame(s), q = onEgg([0, 0, 0], M.r, dir);
  const to = (v: V3): V3 => add(add(scale(x, v[0]), scale(y, v[1])), scale(z, v[2]));
  return { p: add(M.c, to(q.p)), n: unit(to(q.n)) };
}
/** The end of the muzzle, where the nose is. */
export const noseOf = (s: Cloud): V3 => add(s.head.muzzle.c, scale(unit(s.head.muzzle.dir), s.head.muzzle.r[2]));
/** Where the horns' root is on the skull (the right one): high on the crown toward the side, behind the eyes. */
const hornRoot = (s: Cloud): V3 => onSkull(s, [0.42, -0.22, 0.88]).p;
/** The same point and way out, on the left side. */
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** Solids the body is, in the trunk's frame, for what is on the far side of it to be hidden behind (`Piece.hide`): its back half and its front. */
function bodySolids(s: Cloud, k = 0.92): Array<{ c: V3; r: V3 }> {
  const B = s.body, h = (B.y[5] - B.y[1]) / 4;
  return [
    { c: [0, B.y[1] + h * 1.2, B.z[2] + 0.02], r: [B.w[2] * k, h * 1.5, B.h[2] * k] },
    { c: [0, B.y[5] - h * 1.2, B.z[4] + 0.02], r: [B.w[4] * k, h * 1.5, B.h[4] * k] },
  ];
}
/** The skull, in the head's frame, for what is round the far side of it to be hidden behind. */
function skullOf(s: Cloud): { c: V3; r: V3 } {
  return { c: s.head.skull.c, r: scale(s.head.skull.r, 0.9) };
}
/** The muzzle, in the head's frame, near enough as an egg square to it: what hides the far eye from the front. */
function muzzleOf(s: Cloud): { c: V3; r: V3 } {
  const M = s.head.muzzle;
  return { c: M.c, r: [M.r[0] * 0.85, M.r[2] * 0.85, M.r[1] * 0.85] };
}

/* ---- its bones ------------------------------------------------------------------------- */

/** Where each ear is rooted on the head (the right one): on the side of the skull, under where the horn curls. */
function earRoot(s: Cloud): V3 {
  const S = s.head.skull, C = curlOf(s);
  return [S.c[0] + S.r[0] * 0.84, C[1], C[2]];
}
/** The middle of the horn's curl (the right one), beside the skull: as far round from the root as the horn starts its curl. */
function curlOf(s: Cloud): V3 {
  const S = s.head.skull, h = s.horn, root = hornRoot(s), th0 = h.start * DEG;
  return [S.c[0] + S.r[0] + h.r * 0.9, root[1] - h.R * Math.cos(th0), root[2] - h.R * Math.sin(th0)];
}

/** How the legs hang from the body standing: the hips and shoulders, and each leg's two parts' pitch (degrees, forward positive). */
const FORE_AT = -0.3, HIND_AT = -0.16, FORE_REST: [number, number, number] = [-4, 8, 0], HIND_REST: [number, number, number] = [16, -30, 0];
/** How long each part of a fore leg is, and of a hind leg: a hind leg long enough, bent as it stands, for its hoof to stand on the ground the fore hooves stand on. */
const foreLen = (s: Cloud): number => s.legs * 0.5;
function hindLen(s: Cloud): number {
  const c = (d: number): number => Math.cos(d * DEG);
  const reach = -FORE_AT + foreLen(s) * (c(FORE_REST[0]) + c(FORE_REST[0] + FORE_REST[1]));
  return (reach + HIND_AT) / (c(HIND_REST[0]) + c(HIND_REST[0] + HIND_REST[1]));
}

/** A stage's body on four hooves (`QuadSpec`): its legs, neck, ears and tail from its numbers, and a sheep's stride. */
const specOf = (s: Cloud): QuadSpec => ({
  high: s.legs + 0.6,
  fore: { at: [s.body.w[4] * 0.5, s.len * 0.44, FORE_AT], len: [foreLen(s), foreLen(s), s.hoof], rest: FORE_REST, fold: [55, 90], toe: [s.thick * 0.7, s.thick * 0.3] },
  hind: { at: [s.body.w[2] * 0.52, -s.len * 0.4, HIND_AT], len: [hindLen(s), hindLen(s), s.hoof], rest: HIND_REST, fold: [35, 60], toe: [s.thick * 0.7, s.thick * 0.3] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.12, s.body.z[0] + s.body.h[1] * 0.55], links: 2, len: 0.14, lift: 10, curl: -30, sway: 10 },
  ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: s.gait.duty,
  // Grazing, the neck bowed down from however upright it is carried and the nose down past it, for the muzzle to reach the
  // grass; the chest is let down on bent fore legs by `cloudPose` (`tipped`), not by the pose's own bow, which lifts the hooves.
  graze: 148 - s.neck.lean,
  nose: 34,
  bow: 0,
  rock: 4,
});

/** Where each leg's foot is in a stride at a walk as `quadPose` has it, a four-beat, and in a trot, the diagonals together. */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/**
 * A leg's stride at a walk: standing, as `step` has it; swinging, its hoof
 * taken along a path of its own rather than wherever turning the leg and
 * folding it put it. Up, it is lifted by `step`'s fold, and folded further by
 * as much as the body dips (`dip`, `DIP_FOLD` to each unit), which would
 * otherwise carry it down toward the grass; along the ground it waits where
 * it lifted until it is up (`LIFTED` of the swing), eases forward, and is
 * over its mark by `REACHED`, then holds there: so it rises straight off the
 * grass and comes straight down onto its mark, never skimming along low and
 * fast. The leg is swung to whatever puts its hoof there, folded as it is, so
 * it is never turned to the other side of its knee.
 */
const REACHED = 0.88, LIFTED = 0.26, DIP_FOLD = 1.6;
function lifting(L: LegSpec, u: number, duty: number, amp: number, dip = 0): [number, number, number] {
  const [sw0, , off] = step(u, duty, amp);
  if (!off) return [sw0, 0, 0];
  const e = smooth((off - LIFTED) / (REACHED - LIFTED)), fold = Math.sin(Math.PI * off) + DIP_FOLD * dip;
  const from = ankleOf(L, -amp, 0)[0], to = ankleOf(L, amp, 0)[0], want = lerp(from, to, e);
  // The hoof's place along the body only goes forward as the leg is swung forward, at any fold: found by halving.
  let lo = -amp - 70, hi = amp + 70;
  for (let q = 0; q < 18; q++) {
    const mid = (lo + hi) / 2;
    if (ankleOf(L, mid, fold)[0] < want) lo = mid;
    else hi = mid;
  }
  return [(lo + hi) / 2, fold, off];
}

/**
 * How far a fore leg (`fore`) or a hind leg swings against the other, for
 * their hooves to sweep back over the grass equally fast: as the other's hoof
 * is far from its hip against its own, standing.
 */
function sweepOf(spec: QuadSpec, fore: boolean): number {
  const r = (L: LegSpec): number => { const [y, z] = ankleOf(L, 0, 0); return Math.hypot(y - L.at[1], z - L.at[2]); };
  const f = r(spec.fore), h = r(spec.hind), mid = (f + h) / 2;
  return mid / (fore ? f : h);
}

/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/** How far through a strike each stage's blow lands: when its horns meet what it butts. */
export const CLOUD_HITS = [0.5, 0.52, 0.52] as const;

/**
 * A go at its task, grazing and fluffing itself: its muzzle at the grass and
 * four bites (`bites`, each a nibble), then its head part of the way up
 * (`up`, to `lift` of the way to standing) and a shake of its whole body that
 * fluffs the fleece out (`shake`, start and end), and its head eased back down
 * to the grass (`down`) for the next go. Played once, from standing, it
 * raises its head the rest of the way after the shake (`stand`) and stands.
 */
export const CLOUD_WORK = { bites: [0.05, 0.11, 0.17, 0.23], up: [0.26, 0.56], lift: 0.6, shake: [0.5, 0.76], down: [0.69, 1], stand: [0.76, 1] } as const;
/** How fast it shakes: radians of the to and fro to the whole of a go, which is about six times a second. */
export const SHAKE = 42;

/** How far through a shake it is, nought outside it: a bump that starts and ends at rest. */
const shakeOf = (t: number): number => {
  const [a, b] = CLOUD_WORK.shake;
  return t <= a || t >= b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)) ** 2;
};

/**
 * A go at its task: how far its head is down at the grass, how far into a
 * bite it is, and how hard it is shaking. Looping, its head goes back down
 * after the shake to where it began; played once, from standing, it eases
 * down first and stays up once it has shaken.
 */
function workOf(t: number, graze: number): { head: number; bite: number; shake: number } {
  const W = CLOUD_WORK;
  const loop = 1 - W.lift * ramp(t, W.up[0], W.up[1]) + W.lift * ramp(t, W.down[0], W.down[1]);
  const once = ramp(t, 0, 0.42) * (1 - W.lift * ramp(t, W.up[0], W.up[1])) * (1 - ramp(t, W.stand[0], W.stand[1]));
  const head = clamp(lerp(once, loop, clamp(graze)));
  let bite = 0;
  for (const b of W.bites) bite = Math.max(bite, hump(t, b, 0.035));
  return { head, bite: bite * head, shake: shakeOf(t) };
}

/** How far the whole body is carried forward this moment, in its own units, as it strikes. Its legs are swung back by as much, so its hooves stay put. */
function surge(s: Cloud, a: Anim): number {
  const act = a.act;
  if (act?.kind !== 'strike') return 0;
  const t = act.t, hit = CLOUD_HITS[s.strike];
  if (s.strike === 0) return s.len * (0.2 * ramp(t, 0.2, hit) * (1 - ramp(t, hit + 0.1, 1)) - 0.05 * ramp(t, 0.02, 0.2) * (1 - ramp(t, 0.2, 0.34)));
  if (s.strike === 1) return s.len * (0.1 * ramp(t, 0.34, hit) * (1 - ramp(t, hit + 0.12, 1)) - 0.06 * ramp(t, 0.03, 0.25) * (1 - ramp(t, 0.25, 0.47)));
  // The Cloudborne drawn well back onto its haunches, then the charge, carried a long way forward into the blow.
  return s.len * (0.2 * ramp(t, 0.3, hit) * (1 - ramp(t, hit + 0.1, 1)) - 0.15 * ramp(t, 0.02, 0.28) * (1 - ramp(t, 0.3, 0.46)));
}

/** How far up the Cloudram is reared, `t` through its strike. */
const rearOf = (t: number): number => ramp(t, 0.03, 0.25) * (1 - ramp(t, 0.25, 0.47));
/** How far up it rears, in degrees, over its hind hooves. */
const REAR = 19;

/**
 * How far the whole body is moved along as it strikes, legs and all, so the
 * hooves on the grass stay put as it tips over them: the Cloudram rearing
 * over its hind hooves (`tipped`, which tips the body about its middle, so its
 * hind hips, and the hooves under them, are carried forward as it goes up).
 */
function rocked(spec: QuadSpec, s: Cloud, a: Anim): number {
  if (a.act?.kind !== 'strike' || s.strike !== 1) return 0;
  const P = REAR * rearOf(a.act.t) * DEG, [, y, z] = spec.hind.at;
  return -(y * (Math.cos(P) - 1) - z * Math.sin(P));
}

/** A rebound after a blow that dies away, `t` through the strike. */
const settleOf = (t: number, hit: number): number => {
  const after = clamp((t - hit) / (1 - hit));
  return t > hit ? Math.sin(after * Math.PI * 2) * (1 - after) : 0;
};

/** How far the body dips at a walk this moment (`Cloud.gait`): deepest in the middle of each pair's stance, nought as they change over. */
const dipOf = (G: Cloud['gait'], a: Anim): number => (a.go > 0 && a.gait < 0.5 ? smooth(a.go) * (1 - 2 * a.gait) * G.dip * Math.sin(frac(a.u) * TAU) ** 2 : 0);

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its own
 * gait -- the Cloudlet's bouncing skip; the Cloudram's trot, grounded at a
 * walk and springing at a run; the Cloudborne's slow stately walk, dipping on
 * its knees with every step, and its bounding run; standing, an ear flicked
 * and the tail going; and its moves -- the strike, grazing and its shake, and
 * evolving.
 */
function cloudPose(s: Cloud, spec: QuadSpec, p: QuadPose, a: Anim, reach = 0): void {
  const g = smooth(a.go), G = s.gait;
  if (a.go > 0 && a.gait < 0.5) {
    // A trot at a walk too, the diagonals together, rather than the four-beat walk the pose is given.
    // Each pair swung through as much as sweeps its hooves back as fast as the other's: a fore leg stands straighter, its hoof
    // further from its shoulder than a hind hoof from its hip, so it swings a little less.
    const duty = lerp(G.duty[0], G.duty[1], a.gait), amp = lerp(G.swing[0], G.swing[1], a.gait);
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + FOUR_BEAT[i], duty, amp), now = lifting(i < 2 ? spec.fore : spec.hind, a.u + DIAGONALS[i], duty, amp * sweepOf(spec, i < 2), dipOf(G, a));
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
  }
  if (a.go > 0) {
    const w = frac(a.u);
    // A lamb's skip, up off each pair of hooves at a walk too; the Cloudram barely off the grass at a walk and springing at a
    // run; the Cloudborne all but level at a walk, a hoof always down, and bounding at a run; the head nodding a beat after it.
    // The bounce highest as the diagonals change over -- both pairs of hooves off the grass for a moment in a trot -- and lowest
    // at the middle of each pair's stance, so a hoof comes down as the body comes down onto it and not while it is still
    // swinging forward. In place of the pose's own rise, which peaks at mid-stance.
    const duty = lerp(G.duty[0], G.duty[1], a.gait), over = (duty + 0.5) / 2;
    p.lift = g * lerp(G.bounce[0], G.bounce[1], a.gait) * (0.5 + 0.5 * Math.cos((w - over) * TAU * 2));
    // At a walk the body let down on knees that give under it as each pair takes its weight, lowest in the middle of their
    // stance and up again as the pairs change over, every hoof standing kept where it is (`sunk`). Each pair is down half the
    // stride at a walk, so the dip is nought at every footfall and every lift; the pair swinging is folded up by as much as it
    // is carried down (`lifting`).
    if (G.dip && a.gait < 0.5) sunk(spec, p, dipOf(G, a), false);
    p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 1.1);
    p.neck[0] += g * (3 + 3 * a.gait);
    p.ears[0][0] += g * (2.5 * G.nod * Math.sin(w * TAU * 2 - 1.8) - 10);
    p.ears[1][0] += g * (2.5 * G.nod * Math.sin(w * TAU * 2 - 1.5) - 10);
    p.ears[0][1] += g * 8 * Math.sin(w * TAU * 2 - 2.0);
    p.ears[1][1] += g * 8 * Math.sin(w * TAU * 2 - 1.7);
    p.tail[1] += g * 16 * Math.sin(w * TAU + 0.6);
    // A roll from side to side only at a run: walking on a diagonal pair, a roll lifts one of the pair off the grass.
    p.roll = lerp(p.roll, p.roll * a.gait + a.gait * 2 * Math.sin(w * TAU), g);
    // A swinging hoof curled back as it lifts and flat again before it comes down, rather than curled until the moment it lands
    // and snapped flat there (`quadBones` curls it by as far into its swing as it is, which is all of it as it lands).
    for (let i = 0; i < 4; i++) {
      const L = i < 2 ? spec.fore : spec.hind, rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75];
      const [sw, fold, off] = p.legs[i];
      if (!off) continue;
      const flat = -(p.pitch + rest[0] + sw + rest[1] - fold * lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40)));
      const had = clamp(off * 3), want = clamp(off * 3) * smooth((1 - off) * 4);
      p.foot[i] += (had - want) * (0.6 * flat + 35 * fold);
    }
  } else {
    // Standing: an ear flicked now and then, the tail going.
    p.ears[0][0] += 20 * beat(a.t, [4.1, 15.3], 0.4);
    p.ears[1][0] += 20 * beat(a.t, [9.7, 20.2], 0.4);
    p.tail[1] += 12 * cyc(a.t, 6);
  }
  // Grazing, or at its task with its head down: the fore legs kept under it rather than folded as the pose has them (which
  // lifts the hooves off the grass), and the chest let down on them instead, bent at the knee with the hooves where they are.
  // At its task, `graze` is already how far its head is down (`cloudBones` poses it so, for `quadPose` to have the same).
  const gz = a.act?.kind === 'work' ? a.graze : a.act ? 0 : a.graze * (1 - g);
  if (gz > 0) {
    p.legs[0][1] -= 0.85 * gz;
    p.legs[1][1] -= 0.85 * gz;
    // The chest let down over its hind hooves, tipping the rump up behind them; and as much further as brings its nose down to
    // the grass (`reach`, found for each stage in `cloudBones`): the chest let further down, the neck bowed on toward hanging
    // straight down, the face down.
    tipped(spec, p, (8 + 6 * reach) * gz);
    p.neck[0] += Math.min(24, 20 * reach) * gz;
    p.head[0] -= 32 * reach * gz;
    // The tail flicked up now and then as it crops.
    p.tail[0] += 26 * gz * beat(a.t, [2.3, 7.9, 13.1, 19.4], 0.3);
  }
  // However far the body is carried forward, the legs swung back by as much (before the strike tips it, so that a hoof is
  // brought onto the grass from where this leaves it), so the hooves stay where they are: all of it for a
  // hoof on the ground, none for one lifted off it, which goes with the body.
  const d = surge(s, a);
  if (d) {
    // Each leg turned about its hip by as much as takes its hoof back by `d` along the grass, however it is bent.
    const P = p.pitch * DEG;
    for (let i = 0; i < 4; i++) {
      const L = i < 2 ? spec.fore : spec.hind, [y, z] = ankleOf(L, p.legs[i][0], p.legs[i][1]);
      const vy = y - L.at[1], vz = z - L.at[2];
      const wy = vy * Math.cos(P) - vz * Math.sin(P), wz = vy * Math.sin(P) + vz * Math.cos(P), r = Math.hypot(wy, wz);
      const was = Math.atan2(wy, -wz), now = Math.asin(clamp(Math.sin(was) - d / r, -0.95, 0.95));
      turned(spec, p, i, (1 - smooth(p.legs[i][2] * 3)) * (now - was) / DEG);
    }
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, spec, p, act.t);
  else if (act?.kind === 'work') {
    const w = workOf(act.t, 1);
    w.bite *= gz;
    // Grazing (the neck is bowed by `graze`, in `cloudBones`): a nibble at each bite, the jaw working, the ears laid back.
    p.head[0] -= w.bite * 5;
    p.jaw = Math.max(p.jaw, w.bite);
    // Its tail flicked up at every bite, which is what shows of grazing from behind.
    p.tail[0] += 24 * w.bite;
    p.tail[1] += 14 * w.bite * Math.sin(act.t * 50);
    // The shake: the barrel and its fleece twisting from side to side over its legs (`cloudBones`), fast, the head going the
    // other way and the ears flapping.
    const sh = w.shake, k = Math.sin(act.t * SHAKE);
    p.head[2] -= 10 * sh * k;
    p.neck[1] += 6 * sh * Math.sin(act.t * SHAKE - 0.8);
    p.ears[0][1] += 36 * sh * Math.sin(act.t * SHAKE - 1.3);
    p.ears[1][1] -= 36 * sh * Math.sin(act.t * SHAKE - 1.3);
    p.ears[0][0] += 60 * sh * Math.sin(act.t * SHAKE - 1.0);
    p.ears[1][0] -= 60 * sh * Math.sin(act.t * SHAKE - 1.0);
    p.tail[1] += 30 * sh * Math.sin(act.t * SHAKE + 1);
    p.squash -= 0.05 * sh;
  } else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, the fleece puffing up round it, then at the turn a shake of the head.
    const t = act.t, up = ramp(t, 0.1, 0.45) * (1 - ramp(t, 0.62, 0.85)), shake = hump(t, 0.56, 0.1);
    p.neck[0] -= 12 * up;
    p.head[0] += 12 * up;
    p.head[2] += 16 * shake * Math.sin(t * 70);
    p.ears[0][1] += 25 * shake * Math.sin(t * 70);
    p.ears[1][1] -= 25 * shake * Math.sin(t * 70);
    p.squash -= 0.04 * up;
    p.tail[1] += 25 * Math.sin(t * 30) * up;
  }
  // A move tips the body as it goes; every hoof meant to be on the ground is brought down onto it, so none is left hanging.
  if (act?.kind === 'strike' || act?.kind === 'evolve') grounded(spec, p);
}

/**
 * Every hoof that is down (its leg not lifted, `QuadPose.legs`) brought onto
 * the ground the lowest of them stands on, its leg bent or straightened to
 * reach it (`legTo`) as far forward as it is: a body tipped over its fore
 * hooves, or back onto its hind, keeps all of them on the grass.
 */
function grounded(spec: QuadSpec, p: QuadPose): void {
  const P = p.pitch * DEG;
  // How far each hoof counts as down: wholly on the ground, and none of it once its leg is a little way into being lifted, or
  // the whole body is up in the air in a hop.
  const air = 1 - smooth(p.lift / 0.1);
  const at = [0, 1, 2, 3].map((i) => {
    const L = i < 2 ? spec.fore : spec.hind, [y, z] = ankleOf(L, p.legs[i][0], p.legs[i][1]);
    return { i, L, w: 1 - smooth(p.legs[i][2] * 2.5), wz: y * Math.sin(P) + z * Math.cos(P), along: y * Math.cos(P) - z * Math.sin(P) };
  });
  // The ground: the lowest hoof that is down. The others are brought down to it, never it up to them: raising a hoof means
  // bending a leg that stands nearly straight, which swings its knee a long way for a little height. A hoof coming down counts
  // as higher than it is by as much as it is still up (so the ground does not drop to meet it before it lands).
  const ground = Math.min(...at.map((f) => f.wz + (1 - f.w)));
  for (const f of at) {
    // One down on it, and one coming down eased onto it as it lands; one well up left where it is.
    const want = ground + (1 - f.w) * (f.wz - ground);
    const ty = f.along * Math.cos(P) + want * Math.sin(P), tz = -f.along * Math.sin(P) + want * Math.cos(P);
    // Reached for on its own leg's side of the knee only, and as much as it is down, so a lifted leg folded the other way is
    // never turned inside out to reach.
    // Stretched no further than it is already, or a little short of straight if it is not, so a leg standing nearly straight
    // is not bent by being reached for.
    const [y0, z0] = ankleOf(f.L, p.legs[f.i][0], p.legs[f.i][1]), now = Math.hypot(y0 - f.L.at[1], z0 - f.L.at[2]) / (f.L.len[0] + f.L.len[1]);
    const [sw, fold] = legTo(f.L, ty, tz, f.i < 2, Math.max(0.985, Math.min(0.999, now)));
    p.legs[f.i][0] = lerp(p.legs[f.i][0], sw, f.w * air);
    p.legs[f.i][1] = lerp(p.legs[f.i][1], fold, f.w * air);
  }
}

/**
 * The swing and the fold (`QuadPose.legs`) that put a leg's ankle at a point
 * in the body's own frame, `y` forward and `z` up: the knee forward of the
 * line from hip to ankle, as a hind leg bends, or with `elbow` behind it, as
 * a fore leg does. A point out of reach gets the leg straight at it. Always
 * called with the leg's own way of bending (a fore leg's elbow behind, a hind
 * leg's knee in front), never with whichever way it happens to be bent: the
 * two answers are far apart for a bent leg, and switching between them snaps
 * the knee across.
 */
function legTo(L: LegSpec, y: number, z: number, elbow: boolean, stretch = 0.999): [number, number] {
  const rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75];
  const L0 = L.len[0], L1 = L.len[1];
  const dy = y - L.at[1], dz = z - L.at[2];
  // Pulled no straighter than `stretch`: near full stretch the knee swings a long way for a hair more reach, so a move that
  // stretches a leg leaves a point a little out of reach short, the hoof up on its toe, rather than snapping the knee to it.
  const d = Math.min((L0 + L1) * stretch, Math.max(Math.abs(L0 - L1) + 1e-3, Math.hypot(dy, dz)));
  const knee = Math.acos(clamp((L0 * L0 + d * d - L1 * L1) / (2 * L0 * d), -1, 1));
  const a1 = Math.atan2(dy, -dz) + (elbow ? -knee : knee);
  const ky = L.at[1] + L0 * Math.sin(a1), kz = L.at[2] - L0 * Math.cos(a1);
  let a2 = Math.atan2(y - ky, kz - z) - a1;
  while (a2 > Math.PI) a2 -= TAU;
  while (a2 < -Math.PI) a2 += TAU;
  const sw = a1 / DEG - rest[0];
  return [sw, (rest[1] - a2 / DEG) / lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40))];
}

/**
 * A leg turned `deg` degrees about its hip (forward positive), its knee bent
 * as it was: its ankle swung round to where that takes it and the leg put
 * there (`legTo`), so a bent leg keeps its bend (turning its swing alone does
 * not, since how far a fold bends it goes with the swing). A leg lifted off
 * the grass (`QuadPose.legs`), folded its own way, is turned by its swing.
 */
function turned(spec: QuadSpec, p: QuadPose, i: number, deg: number): void {
  if (!deg) return;
  const L = i < 2 ? spec.fore : spec.hind, [sw0, fold0, off] = p.legs[i], w = 1 - smooth(off * 3);
  const [y, z] = ankleOf(L, sw0, fold0), vy = y - L.at[1], vz = z - L.at[2], c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  const [sw, fold] = w > 0 ? legTo(L, L.at[1] + vy * c - vz * s, L.at[2] + vy * s + vz * c, i < 2) : [sw0 + deg, fold0];
  p.legs[i][0] = lerp(sw0 + deg, sw, w);
  p.legs[i][1] = lerp(fold0, fold, w);
}

/** Where a leg's ankle is in the body's own frame (`y`, `z`), swung and folded as the pose has it: the other way round from `legTo`. */
function ankleOf(L: LegSpec, sw: number, fold: number): [number, number] {
  const rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75];
  const a1 = (rest[0] + sw) * DEG, a2 = (rest[1] - fold * lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40))) * DEG;
  return [L.at[1] + L.len[0] * Math.sin(a1) + L.len[1] * Math.sin(a1 + a2), L.at[2] - L.len[0] * Math.cos(a1) - L.len[1] * Math.cos(a1 + a2)];
}


/**
 * Every hoof bearing weight brought `dz` nearer the body, its leg bent to
 * reach it (`legTo`): the body, stood on its hooves, let down by as much. A
 * leg swinging is tucked up by as much, folded the way it folds to swing
 * (unless `tuck` is false, when it is left as it is): a crouch, or a rear sat
 * down on its haunches (`strikePose`), or the dip of a walk.
 */
function sunk(spec: QuadSpec, p: QuadPose, dz: number, tuck = true): void {
  if (!dz) return;
  for (let i = 0; i < 4; i++) {
    const L = i < 2 ? spec.fore : spec.hind, [sw0, fold0, off] = p.legs[i];
    const [y, z] = ankleOf(L, sw0, fold0);
    if (off > 0 && !tuck) continue;
    if (off > 0) {
      // Swinging, it is folded further the way it folds as it swings, its hoof carried up by as much.
      let lo = fold0, hi = fold0 + 1.5;
      for (let k = 0; k < 16; k++) {
        const mid = (lo + hi) / 2;
        if (ankleOf(L, sw0, mid)[1] < z + dz) lo = mid;
        else hi = mid;
      }
      p.legs[i][1] = hi;
      continue;
    }
    // A fore leg standing is shortened by bending it further back at the knee, which is a fold the other way.
    const [sw, fold] = legTo(L, y, z + dz, i < 2);
    p.legs[i][0] = sw;
    p.legs[i][1] = fold;
  }
}

/**
 * The body tipped `deg` degrees nose-down (or up, negative) over one pair of
 * hooves, `keep` (`fore` or `hind`), which stand as they did, their legs
 * turned back by as much; the other pair's legs bent or straightened to keep
 * their hooves on the grass where they are (`legTo`). Over its hind hooves
 * nose-down, a sheep letting its chest down to graze or lunging; over its fore
 * hooves nose-up, sat back on its haunches, or nose-down, its rump raised.
 */
function tipped(spec: QuadSpec, p: QuadPose, deg: number, keep: 'fore' | 'hind' = 'hind'): void {
  if (!deg) return;
  const P0 = p.pitch * DEG, P1 = (p.pitch - deg) * DEG;
  const kept = keep === 'fore' ? [0, 1] : [2, 3], moved = keep === 'fore' ? [2, 3] : [0, 1];
  const K = keep === 'fore' ? spec.fore : spec.hind, M = keep === 'fore' ? spec.hind : spec.fore;
  // Where the ground is in the body's frame, from the kept hooves standing on it, before and after the tip: their legs are
  // given the tip back (below), so after it a kept hoof is where its hip has been tipped to, and as far below that as it was.
  const worldZ = (y: number, z: number, P: number): number => y * Math.sin(P) + z * Math.cos(P);
  const foot = ankleOf(K, p.legs[kept[0]][0], p.legs[kept[0]][1]), hip = K.at;
  const ground0 = worldZ(foot[0], foot[1], P0);
  const ground1 = worldZ(hip[1], hip[2], P1) + worldZ(foot[0] - hip[1], foot[1] - hip[2], P0);
  // And as far along it: the body is tipped about its middle, so the kept hooves move along with their hips, and the others
  // are moved along by as much, which is what tipping about the kept hooves is.
  const along0 = (y: number, z: number, P: number): number => y * Math.cos(P) - z * Math.sin(P);
  const shift = along0(hip[1], hip[2], P1) - along0(hip[1], hip[2], P0);
  p.pitch -= deg;
  for (const i of moved) {
    // A leg lifted off the grass (a hoof raised in a rear) goes with the body as it is, and one coming down is eased onto it.
    const [sw0, fold0, off] = p.legs[i], w = 1 - smooth(off * 1.5);
    if (w <= 0) continue;
    const [y, z] = ankleOf(M, sw0, fold0);
    // The hoof as high over the ground as it was, and as far along it from the kept ones.
    const over = worldZ(y, z, P0) - ground0, along = along0(y, z, P0) + shift;
    const wz = ground1 + over;
    // Back into the tipped body's frame: along the ground `along`, up from it `wz`.
    const ty = along * Math.cos(P1) + wz * Math.sin(P1), tz = -along * Math.sin(P1) + wz * Math.cos(P1);
    const [sw, fold] = legTo(M, ty, tz, i < 2);
    p.legs[i][0] = lerp(sw0, sw, w);
    p.legs[i][1] = lerp(fold0, fold, w);
  }
  for (const i of kept) turned(spec, p, i, deg);
}

/** The rebound after a blow, `deg` nose-up (or down, negative): sat back over its fore hooves, or tipped forward over its hind. */
const settled = (spec: QuadSpec, p: QuadPose, deg: number): void => tipped(spec, p, -deg, deg > 0 ? 'fore' : 'hind');

/**
 * Each stage's strike. The Cloudlet crouches, hops forward and butts with its
 * little horns as it lands; the Cloudram rears up on its hind legs, its fore
 * hooves high, and comes down driving its horns forward; the Cloudborne
 * draws back, charges, and slams its horns home with its head low.
 */
function strikePose(s: Cloud, spec: QuadSpec, p: QuadPose, t: number): void {
  const hit = CLOUD_HITS[s.strike], st = settleOf(t, hit);
  // At the blow its tail flicks up, and its rump comes up over its fore hooves after it, which shows from behind.
  const flick = hump(t, hit + 0.02, 0.1);
  p.tail[0] += 40 * flick;
  p.tail[1] += 24 * flick * Math.sin(t * 60);
  if (s.strike === 0) {
    const crouch = ramp(t, 0.02, 0.18) * (1 - ramp(t, 0.16, 0.32));
    const hop = t > 0.18 && t < hit ? Math.sin(Math.PI * (t - 0.18) / (hit - 0.18)) ** 1.5 : 0;
    const butt = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 0.9));
    p.lift += 0.24 * hop;
    // Crouched down on its legs and its haunches dipped, sat back on them, every hoof where it stands (`sunk`, `tipped`), its
    // tail flicked up as it springs; up in the air, its legs reaching fore and aft, the hind ones kicked out behind it, which is
    // what shows of the hop from behind.
    sunk(spec, p, 0.06 * crouch);
    tipped(spec, p, -11 * crouch, 'fore');
    p.tail[0] += 48 * hump(t, 0.2, 0.08);
    p.legs[0][0] += 8 * hop;
    p.legs[1][0] += 8 * hop;
    p.legs[2][0] -= 16 * hop;
    p.legs[3][0] -= 16 * hop;
    p.legs[2][1] += 0.25 * hop;
    p.legs[3][1] += 0.25 * hop;
    p.pitch += 6 * hop;
    settled(spec, p, 3 * st);
    // Landed, its chest let down into the butt over its fore hooves and its rump up behind it.
    tipped(spec, p, 8 * butt * (1 - hop), 'hind');
    p.neck[0] += 10 * crouch + 30 * butt - 6 * st;
    p.head[0] += -16 * crouch - 22 * butt + 6 * st;
    for (const e of p.ears) e[0] += 30 * crouch + 20 * hop - 10 * st;
    p.squash += 0.08 * hump(t, hit + 0.03, 0.07) - 0.05 * hop;
    p.tail[0] += 20 * hop;
    return;
  }
  if (s.strike === 1) {
    const rear = rearOf(t);
    const drive = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.14, 0.95));
    const down = ramp(t, 0.42, hit + 0.04) * (1 - ramp(t, hit + 0.14, 0.95));
    // Reared up on its haunches over its hind hooves (`tipped`), sat down on them with its rump tucked under (`sunk`) and its
    // tail clamped down, which is what shows of it from behind; its fore legs folded up under its chest, its chin tucked so the
    // horns face forward.
    sunk(spec, p, 0.17 * rear);
    for (const i of [0, 1]) p.legs[i][2] = Math.max(p.legs[i][2], rear);
    tipped(spec, p, -REAR * rear, 'hind');
    for (const i of [0, 1]) {
      p.legs[i][0] += 24 * rear;
      p.legs[i][1] = Math.max(p.legs[i][1], 0.55 * rear);
    }
    settled(spec, p, 3 * st);
    // Down again, driving in: once its fore hooves are down, its chest let down over them (`tipped`) and its rump up behind.
    tipped(spec, p, 7 * down, 'hind');
    p.neck[0] += -14 * rear + 26 * drive - 6 * st;
    p.head[0] += -18 * rear - 20 * drive + 6 * st;
    for (const e of p.ears) e[0] += 26 * rear + 18 * drive;
    p.squash += 0.07 * hump(t, hit + 0.03, 0.08);
    p.tail[0] -= 34 * rear;
    p.tail[1] += 10 * rear * Math.sin(t * 40);
    return;
  }
  // The Cloudborne: drawn back onto its haunches with its head up, then a charge with its chest down and its head low, below
  // its withers, and its horns forward, and the slam.
  const gather = ramp(t, 0.02, 0.28) * (1 - ramp(t, 0.3, 0.44));
  const charge = ramp(t, 0.3, hit) * (1 - ramp(t, hit + 0.14, 0.95));
  const shake = t > hit ? Math.sin((t - hit) * 80) * (1 - ramp(t, hit, 0.85)) : 0;
  // Sat back: its rump let down over its fore hooves (`tipped`); charging, its chest let down over its hind hooves and its
  // rump up, twelve degrees nose-down in all.
  tipped(spec, p, -7 * gather, 'fore');
  tipped(spec, p, 11 * charge, 'hind');
  tipped(spec, p, 1 * charge, 'fore');
  settled(spec, p, 2 * st);
  p.neck[0] += -12 * gather + 72 * charge - 6 * st;
  p.head[0] += 10 * gather - 52 * charge + 8 * st;
  p.head[2] += 4 * shake;
  for (const e of p.ears) e[0] += 30 * gather + 24 * charge;
  p.squash += 0.08 * hump(t, hit + 0.03, 0.08) + 0.015 * shake;
  p.roll += 1.5 * shake;
  p.tail[0] += 14 * gather + 20 * charge;
}

const LEG_KEYS = ['fl', 'fr', 'hl', 'hr'];
/**
 * How low the lowest sole of `feet` is (under the hoof, ahead to its toe and
 * back to its heel), each counted as higher than it is by how far it is into
 * being lifted (`QuadPose.legs`, its third number): a hoof lifted as it steps
 * or rears does not bear the body's weight, and is let go of smoothly as it
 * lifts, so the body does not jump as its weight goes from one to the next.
 */
function lowOf(spec: QuadSpec, b: Bones, feet: readonly number[], p?: QuadPose, go = 0): number {
  let low = Infinity;
  for (const i of feet) {
    const L = i < 2 ? spec.fore : spec.hind, [ahead, behind] = L.toe ?? [0.3, 0.3];
    // A stride's swing (`step`) runs from lifting off to touching down, so a hoof going is let go of as it lifts and taken up
    // again as it comes down; a hoof lifted by a move is let go of and held off.
    const s = p ? p.legs[i][2] : 0, off = p ? 0.8 * smooth(s * 4) * lerp(1, smooth((1 - s) * 4), smooth(go)) : 0;
    for (const y of [ahead, -behind]) low = Math.min(low, place(b[`${LEG_KEYS[i]}2`], [0, y, -L.len[2]])[2] + off);
  }
  return low;
}

/** A pendant's bone: where it hangs from and how it swings, and the frame it is hung in. */
interface Drop { bone: 'head' | 'ruff' | 'trunk'; at: (fleece: number) => V3; len: number; r: number; side: number; id: number }

/** The bones of a stage: a body on four hooves stood on the ones bearing its weight, carried forward as it strikes, and its crystals hanging. */
function cloudBones(s: Cloud, drops: readonly Drop[]): (a: Anim) => Bones {
  const spec = specOf(s);
  let last: QuadPose | undefined, reach = 0, found = false;
  const posed = quadBonesOf(spec, (p, a) => { cloudPose(s, spec, p, a, reach); last = p; });
  /**
   * How much further it bows grazing (`cloudPose`'s `reach`: chest, neck and face) for the nose to come down to the grass, just
   * clear of it, between bites: found once for the stage, by trying, since it is a matter of the whole body's shape.
   */
  const grass = 0.07;
  const noseAt = (extra: number): number => {
    reach = extra;
    const b = posed({ t: 0, u: 0, go: 0, gait: 0, graze: 1, blink: false, breath: 0.5, fleece: 1, seed: 0 });
    return place(b.head, noseOf(s))[2];
  };
  const calibrate = (): void => {
    found = true;
    // The least that brings it down, by stepping out to where it first is and halving back; or, if it never is (bowed past
    // hanging straight down the nose comes back up), as far down as it goes.
    let lo = 0, best = 0, low = noseAt(0);
    for (let x = 0.1; x <= 1.6 + 1e-9; x += 0.1) {
      const z = noseAt(x);
      if (z <= grass) {
        let hi = x;
        for (let q = 0; q < 12; q++) {
          const mid = (lo + hi) / 2;
          if (noseAt(mid) > grass) lo = mid;
          else hi = mid;
        }
        reach = hi;
        return;
      }
      if (z < low) { low = z; best = x; }
      lo = x;
    }
    reach = best;
  };
  return (a) => {
    if (!found) calibrate();
    const act = a.act;
    // Its head goes down to the grass as it works, as it does to graze; a strike or evolving is posed from standing.
    const graze = act?.kind === 'work' ? workOf(act.t, a.graze).head : act ? 0 : a.graze;
    let b = posed({ ...a, graze });
    const p = last as QuadPose;
    if (!(graze > 0 && a.go < 1)) {
      // Stood on the hooves bearing its weight (`quadBones` stood it on the lowest of all four), so a hoof lifted as it steps or
      // rears does not lift it (`lowOf`); but never so low that one swinging through goes into the ground.
      const all = [0, 1, 2, 3];
      b = lifted(b, Math.max(-lowOf(spec, b, all, p, act ? 0 : a.go), -lowOf(spec, b, all)) + Math.max(0, p.lift));
      b.shadow = shadowOf(b.body, p.lift);
    }
    const d = surge(s, a) + rocked(spec, s, a);
    if (d) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + d, b[k].t[2]] };
    // Shaking itself, the barrel and its fleece twisted from side to side over its legs, which stay where they stand.
    if (act?.kind === 'work') {
      const sh = workOf(act.t, a.graze).shake;
      if (sh) b.trunk = joint(b.trunk, [0, 0, 0], 0, 10 * sh * Math.sin(act.t * SHAKE), 2 * sh * Math.sin(act.t * SHAKE + 1.2));
    }
    // The ruff on its chest goes half as far as the neck does: its bone is the neck's, turned back by half the bow.
    b.ruff = joint(b.neck, [0, 0, 0], spec.neck.lean + 0.5 * p.neck[0]);
    // Each crystal hangs straight down from where it is hung, whatever the head is doing, and swings (`swingOf`).
    drops.forEach((dr, q) => {
      const at = place(b[dr.bone], dr.at(a.fleece));
      const [pitch, roll] = swingOf(s, a, dr, q);
      b[`drop${q}`] = joint({ m: ROOT.m, t: at }, [0, 0, 0], pitch, roll, 0);
    });
    // The little clouds that drift off its back while its fleece is grown.
    for (let q = 0; q < 2; q++) b[`puff${q}`] = drifting(s, b, a, q);
    return b;
  };
}

/**
 * How far a crystal swings this moment, fore and aft and from side to side,
 * in degrees: a beat behind the body at a walk and a trot, thrown about by a
 * strike and ringing on after the blow, flung from side to side by a shake,
 * and stirring a little standing.
 */
function swingOf(s: Cloud, a: Anim, dr: Drop, q: number): [number, number] {
  const g = smooth(a.go), w = frac(a.u), ph = 0.35 * jitter(dr.id);
  let pitch = 3 * cyc(a.t, 2 + (q % 3), dr.id) * (1 - g);
  let roll = 3 * cyc(a.t, 3 + (q % 2), dr.id * 2) * (1 - g);
  pitch += g * (8 + 10 * a.gait) * Math.sin(w * TAU * 2 - 2.0 - ph) + g * (6 + 8 * a.gait);
  roll += g * 7 * Math.sin(w * TAU - 1.6 - ph);
  const act = a.act;
  // Grazing, hanging back against its chest as its head is down, as at its task.
  if (!act) pitch -= 8 * a.graze * (1 - g);
  if (act?.kind === 'strike') {
    const t = act.t, hit = CLOUD_HITS[s.strike];
    const ring = t > hit ? Math.sin((t - hit) * 26 + ph) * Math.exp(-(t - hit) * 5) : 0;
    pitch += -14 * ramp(t, 0.05, 0.3) * (1 - ramp(t, 0.3, hit)) + 18 * ramp(t, 0.32, hit) * (1 - ramp(t, hit, hit + 0.06)) + 34 * ring;
    roll += 10 * ring * dr.side;
  } else if (act?.kind === 'work') {
    const sh = shakeOf(act.t);
    roll += 26 * sh * Math.sin(act.t * SHAKE - 1.6 - ph);
    pitch += 10 * sh * Math.sin(act.t * SHAKE * 0.5 - ph) - 8 * workOf(act.t, a.graze).head;
  } else if (act?.kind === 'evolve') {
    const t = act.t, k = hump(t, 0.56, 0.12);
    roll += 24 * k * Math.sin(t * 70 + ph);
    pitch += 12 * k * Math.sin(t * 50 + ph);
  }
  return [pitch, roll];
}

/**
 * A little cloud drifting off its back as it goes: it swells out of the
 * fleece over the rump, floats up and back, trailing behind, and thins away to
 * nothing, and the next comes, two in turn a loop; none standing. Its bone is
 * scaled by how big it is, so it is a point while it is gone.
 */
function drifting(s: Cloud, b: Bones, a: Anim, q: number): Xf {
  const P = LOOP / 4, u = frac(a.t / P + q * 0.5 + 0.25), g = smooth(a.go);
  const top = s.body.z[2] + s.body.h[2] + s.fleece.loft + s.fleece.puff * 0.5;
  // Swelling out of the fleece quickly, and thinning away slowly as it rises.
  const grow = smooth(u / 0.25) * (1 - smooth((u - 0.45) / 0.55));
  const sd = q ? -1 : 1, k = grow * (q ? 0.8 : 1) * clamp((a.fleece - 0.55) * 4) * g;
  const at = place(b.body, [sd * (0.25 + 0.25 * u), s.body.y[1] + 0.2 - 0.5 * u - g * (0.4 + 0.5 * u), top - 0.35 + 1.1 * u - g * 0.4 * u + 0.06 * Math.sin(u * TAU * 2)]);
  return { m: [k, 0, 0, 0, k, 0, 0, 0, k], t: at };
}

/* ---- the fleece -------------------------------------------------------------------------- */

const TINT: Record<Tint, Mat> = { cream: 'coatLight', blue: 'cap', lilac: 'feather' };

/**
 * One puff of its fleece: where its middle is grown and where it is rooted on
 * the body, how big it is, and how soon it goes as it is shorn; and whether
 * it is on the outline (over the back and up the sides), drawn rounder.
 */
interface Puff { c: V3; root: V3; r: V3; tint: Tint; th: number; id: number; fine: boolean }

/**
 * Which colour a puff is, its middle at `c`: the colour of a patch it is in
 * (`fleece.spots`, the nearest if it is in two), the patch's edge a little
 * ragged; out of them mostly cream, a few sky blue low on the flanks and
 * toward the rump, and on the Cloudborne lavender ones among them.
 */
function tintOf(s: Cloud, id: number, low: number, c?: V3): Tint {
  if (c) {
    let best = Infinity, tint: Tint | undefined;
    for (const [f, th, r, tn] of s.fleece.spots) {
      const q = onBody(s, lerp(s.body.y[1], s.body.y[5], f), c[0] >= 0 ? th : Math.PI - th);
      const at = add(q.p, scale(q.n, s.fleece.loft));
      const d = Math.hypot(c[0] - at[0], c[1] - at[1], c[2] - at[2]) / (r * (0.85 + 0.3 * jitter(id + 17)));
      if (d < 1 && d < best) { best = d; tint = tn; }
    }
    if (tint) return tint;
  }
  const j = jitter(id * 3 + 7);
  if (j < s.fleece.blue * (0.85 + 0.35 * low) * (low > -0.3 ? 1 : 0.35)) return 'blue';
  if (j > 1 - s.fleece.lilac * (0.85 + 0.35 * low)) return 'lilac';
  return 'cream';
}

/**
 * The fleece, puff by puff: rings of puffs round the body from rump to chest,
 * standing furthest out over the back and closest under the belly, none
 * under it, and none over the withers where the neck comes up out of it; big
 * billows heaped along the back behind the withers, so the outline is a
 * cloud's from every side; and puffs round the rump and over the chest, so
 * its ends are cloud too. Each is rooted on the body's skin, and the further
 * out a puff stands, the sooner it goes as the fleece is shorn.
 */
function fleecePuffs(s: Cloud): Puff[] {
  const F = s.fleece, B = s.body, out: Puff[] = [];
  const put = (y: number, th: number, lift: number, r: number, id: number, outer: number, squash = 0.92): void => {
    const { p, n } = onBody(s, y, th);
    const low = -Math.sin(th) + (y < 0 ? -0.5 * y / s.len : 0);
    const c = add(p, scale(n, F.loft * lift));
    out.push({ c, root: add(p, scale(n, -r * 0.3)), r: [r * 1.05, r, r * squash], tint: tintOf(s, id, low, c), th: clamp(0.4 * outer + 0.06 * jitter(id + 11), 0, 0.6), id, fine: outer > 0.5 || Math.sin(th) > 0.05 });
  };
  const y0 = B.y[1] + 0.05, y1 = B.y[5] - 0.02, withers = lerp(B.y[4], B.y[5], 0.35);
  for (let r = 0; r < F.rows; r++) {
    const row = lerp(y0, y1, r / (F.rows - 1)), dy = (y1 - y0) / (F.rows - 1);
    for (let q = 0; q < F.per; q++) {
      // Each a little off its place in the ring, along the body and round it, so the rings do not show as rows.
      const y = clamp(row + 0.45 * dy * (jitter(r * 53 + q * 7) - 0.5), y0, y1);
      const th = -0.55 + ((q + (r % 2) * 0.5) / F.per) * (Math.PI + 1.1) + 0.3 * (jitter(r * 31 + q) - 0.5);
      if (th > Math.PI + 0.55) continue;
      // Over the withers the neck comes up out of the fleece, with the ruff round it; and the front ring is only down the sides
      // of the chest, so the face is clear of it.
      const up = Math.sin(th);
      if (y > withers && up > 0.72) continue;
      if (r === F.rows - 1 && up > 0.25) continue;
      const id = r * 37 + q;
      const lift = 0.45 + 0.55 * Math.max(0, up) + 0.25 * Math.max(0, -up) * 0;
      put(y, th, lift + 0.2 * (jitter(id + 9) - 0.5), F.puff * (0.66 + 0.28 * Math.max(0, up) + 0.36 * jitter(id + 5)), id, 0.2 * jitter(id + 3) + 0.15 * Math.max(0, up));
    }
  }
  // The billows along the back, bigger and further out, a little either side of the spine in turn.
  for (let q = 0; q < F.billows; q++) {
    const y = lerp(y0 + 0.05, withers - 0.1, F.billows > 1 ? q / (F.billows - 1) : 0.5), id = 600 + q;
    put(y, Math.PI / 2 + (q % 2 ? 0.42 : -0.42) + 0.2 * (jitter(id) - 0.5), 0.9 + 0.25 * jitter(id + 3) + 0.25 * s.strike, F.puff * (1.0 + 0.2 * jitter(id + 1) + 0.08 * s.strike), id, 0.85, 0.88);
  }
  // A row low along each flank, close under the belly line, hanging a little over the tops of the legs.
  const skirt = Math.max(3, F.rows);
  for (const sd of [1, -1]) {
    for (let q = 0; q < skirt; q++) {
      const id = 700 + q + (sd > 0 ? 0 : 50), y = lerp(y0, y1, (q + 0.6 * (jitter(id + 4) - 0.5)) / (skirt - 1));
      const th = (sd > 0 ? -0.95 : Math.PI + 0.95) + sd * 0.25 * (jitter(id + 6) - 0.5);
      const { p, n } = onBody(s, y, th);
      const r = F.puff * (0.55 + 0.3 * jitter(id));
      const c = add(add(p, scale(n, F.loft * 0.35)), [0, 0, -F.skirt]);
      out.push({ c, root: add(p, scale(n, -r * 0.3)), r: [r, r, r * 0.85], tint: tintOf(s, id, 1.2, c), th: clamp(0.12 + 0.18 * jitter(id + 2), 0, 0.6), id, fine: false });
    }
  }
  // Round the rump, and over the chest under the neck, so its ends are cloud too.
  for (let q = 0; q < 7; q++) {
    const a = (q / 7) * TAU + 0.3, id = 800 + q, up = Math.sin(a);
    const rump: V3 = [Math.cos(a) * B.w[1] * 0.6, B.y[0] - F.loft * (0.35 + 0.25 * Math.max(0, up)), B.z[1] + up * B.h[1] * 0.6 + 0.08];
    const r = F.puff * (0.78 + 0.2 * Math.max(0, up) + 0.2 * jitter(id));
    out.push({ c: rump, root: [rump[0] * 0.6, B.y[0] + 0.25, rump[2]], r: [r, r, r * 0.92], tint: tintOf(s, id, 0.8 - 0.5 * up), th: clamp(0.05 + 0.2 * jitter(id + 4), 0, 0.6), id, fine: up > 0 });
    if (up > 0.2) continue;
    const id2 = 850 + q;
    const chest: V3 = [Math.cos(a) * B.w[5] * 0.62, B.y[6] - 0.05, B.z[5] + up * B.h[5] * 0.62 - 0.1];
    const r2 = F.puff * (0.62 + 0.15 * jitter(id2));
    out.push({ c: chest, root: [chest[0] * 0.6, B.y[6] - 0.2, chest[2]], r: [r2, r2 * 0.9, r2 * 0.92], tint: tintOf(s, id2, 0.3, chest), th: clamp(0.05 + 0.2 * jitter(id2 + 4), 0, 0.6), id: id2, fine: false });
  }
  return out;
}

/**
 * How a puff of the fleece is this moment: how big against grown (nought,
 * gone), and where its middle is -- drawn in onto the skin as the fleece is
 * shorn, every puff smaller and the outer ones gone first, so a fleece
 * growing back is a close crop over the body that fills out into a cloud.
 */
function grownPuff(pf: Puff, f: number): { k: number; c: V3 } {
  const k = smooth((f - pf.th) / 0.16) * (0.62 + 0.38 * f);
  const c = add(pf.root, scale(sub(pf.c, pf.root), 0.05 + 0.95 * f));
  return { k, c };
}

/**
 * How the fleece moves this moment, over its growth: puffed up as it shakes
 * and as it evolves, jiggling as it shakes; bobbing a beat behind the body as
 * it goes, the higher puffs further; and on the Cloudborne drifting behind
 * it as it walks.
 */
function fleeceMotion(s: Cloud, a: Anim): { puff: number; jig: number; bob: number; drift: number; phase: number } {
  let puff = 0, jig = 0, bob = 0, drift = 0;
  const act = a.act;
  if (act?.kind === 'work') {
    const sh = shakeOf(act.t);
    puff += 0.16 * sh + 0.1 * ramp(act.t, CLOUD_WORK.shake[1] - 0.04, CLOUD_WORK.shake[1] + 0.06) * (1 - ramp(act.t, 0.9, 1));
    jig += sh;
  } else if (act?.kind === 'evolve') {
    puff += 0.3 * hump(act.t, 0.5, 0.3);
  } else if (act?.kind === 'strike') {
    puff += 0.08 * hump(act.t, CLOUD_HITS[s.strike] + 0.05, 0.12);
  }
  const g = smooth(a.go), w = frac(a.u);
  if (g > 0) {
    bob = g * lerp(s.gait.bounce[0], s.gait.bounce[1], a.gait) * Math.sin(w * TAU * 2 - 2.1);
    drift = g * s.gait.drift * (0.75 + 0.25 * Math.sin(w * TAU * 2 - 2.4)) * (1 + 0.6 * a.gait);
  }
  return { puff, jig, bob, drift, phase: act ? act.t * SHAKE : 0 };
}

/** A mesh made of pieces, each moved as one: a puff with what is on it. */
interface Group { from: number; to: number; pf: Puff }

/**
 * Its fleece as it grows and moves (`grownPuff`, `fleeceMotion`): every
 * corner of each puff, and of what is on it, moved with its puff.
 */
function growing(s: Cloud, groups: readonly Group[], top: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const f = clamp(a.fleece), m = fleeceMotion(s, a);
    if (f >= 1 && !m.puff && !m.jig && !m.bob && !m.drift) return v as V3[];
    const out = v.slice() as V3[];
    for (const gr of groups) {
      const { k: k0, c: c0 } = grownPuff(gr.pf, f);
      const k = k0 * (1 + m.puff * (0.6 + 0.8 * jitter(gr.pf.id + 9)));
      // How high up the fleece it is, nought at the belly to one over the top: the higher, the further it swings.
      const hi = clamp((gr.pf.c[2] + 0.5) / (top + 0.5));
      const j = m.jig * 0.06 * Math.sin(m.phase + gr.pf.id) * (0.5 + hi);
      const c: V3 = [c0[0] + j, c0[1] - m.drift * hi * (0.6 + 0.4 * jitter(gr.pf.id)), c0[2] + m.bob * hi * 0.6 + m.jig * 0.04 * hi];
      for (let i = gr.from; i < gr.to; i++) out[i] = [c[0] + (v[i][0] - gr.pf.c[0]) * k, c[1] + (v[i][1] - gr.pf.c[1]) * k, c[2] + (v[i][2] - gr.pf.c[2]) * k];
    }
    return out;
  };
}

/** A cloud puff: a ball a little flattened underneath, its colour on top and the colour's shade under it where it is big enough to show. */
const puffMesh = (c: V3, r: V3 | number, n: number, k: number, m: Mat): Mesh => orb(c, r, n, k, m);

/* ---- flowers and leaves ---------------------------------------------------------------- */

/**
 * A flat thing along a line of points -- a leaf -- `widths` across it at
 * each, its face turned along `face`, folded a little down its middle: a top
 * in two halves and an underside.
 */
function sheet(pts: readonly V3[], widths: readonly number[], face: V3, fold: number, mats: readonly [Mat, Mat, Mat]): Mesh {
  const K = pts.length, v: V3[] = [], f: Face[] = [], want: V3[] = [], ns: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n)), w = widths[Math.min(k, widths.length - 1)];
    const row: V3[] = [add(add(pts[k], scale(side, -w)), scale(n, fold * w)), pts[k], add(add(pts[k], scale(side, w)), scale(n, fold * w))];
    v.push(...row, ...row);
    ns.push(n);
  }
  for (let k = 0; k < K - 1; k++) {
    const A = k * 6, B = A + 6, n = unit(add(ns[k], ns[k + 1]));
    for (const j of [0, 1]) {
      f.push({ i: [A + j, A + j + 1, B + j + 1, B + j], m: mats[j] });
      want.push(n);
      f.push({ i: [B + 3 + j, B + 4 + j, A + 4 + j, A + 3 + j], m: mats[2] });
      want.push(scale(n, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

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

/** A small pointed sage leaf from `root` along `dir`, its face turned along `face`. */
function leaf(root: V3, dir: V3, face: V3, len: number): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const tip = add(root, scale(d, len)), mid = add(add(root, scale(d, len * 0.5)), scale(f, len * 0.12));
  return sheet(curve(root, mid, tip, 3), [0.02, len * 0.26, len * 0.2, 0.02], f, 0.25, ['leaf', 'stem', 'leafDark']);
}

/** A frame square to `n`: two ways across it. */
function across(n: V3): [V3, V3] {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  return [x, cross(z, x)];
}

/**
 * A flower facing along `n`, `r` across: a blue cloud-flower of five round
 * puffs of petal round a pale middle, or a cream blossom of five petals round
 * a gold one. Both lit whichever way they are turned, so a flower turned from
 * the light is its colour and not a smudge.
 */
function flower(c: V3, n: V3, r: number, cream: boolean, spin = 0): Mesh {
  const z = unit(n), [x, y] = across(z);
  const petals: Mesh[] = [], paints: Disc[] = [];
  for (let q = 0; q < 5; q++) {
    const t = spin + (q / 5) * TAU, d = add(scale(x, Math.cos(t)), scale(y, Math.sin(t)));
    const at = add(add(c, scale(d, r * 0.55)), scale(z, r * 0.06));
    if (cream) petals.push(orbAlong(at, z, [r * 0.42, r * 0.3, r * 0.1], 5, 3, 'petal'));
    else petals.push(orbAlong(at, z, [r * 0.42, r * 0.42, r * 0.22], 6, 3, 'cap'));
  }
  paints.push(disc(add(c, scale(z, r * 0.2)), z, r * 0.26, r * 0.26, 7, cream ? 'bloom' : 'petal', { lit: true }));
  return merge(...petals, orbAlong(add(c, scale(z, r * 0.08)), z, [r * 0.24, r * 0.24, r * 0.14], 6, 3, cream ? 'bloom' : 'petal'), paint(paints));
}

/* ---- crystals and gold ------------------------------------------------------------------- */

/**
 * A two-pointed prism, `sides` round, from `top` down along -z: a short point
 * up to `top` over its widest, `r` across, and a long one down from there:
 * a crystal, or a gold bead. Its faces alternate light and dark, the upper
 * ones brightest, so it glints facet by facet as it turns.
 */
function prism(top: V3, up: number, down: number, r: number, sides: number, mats: readonly [Mat, Mat, Mat], spin = 0): Mesh {
  const v: V3[] = [top];
  const mid: V3 = [top[0], top[1], top[2] - up];
  for (let q = 0; q < sides; q++) {
    const t = spin + (q / sides) * TAU;
    v.push([mid[0] + Math.cos(t) * r, mid[1] + Math.sin(t) * r, mid[2]]);
  }
  v.push([top[0], top[1], top[2] - up - down]);
  const f: Face[] = [], want: V3[] = [];
  const bot = sides + 1;
  for (let q = 0; q < sides; q++) {
    const a = 1 + q, b = 1 + ((q + 1) % sides);
    const t = spin + ((q + 0.5) / sides) * TAU, out: V3 = [Math.cos(t), Math.sin(t), 0];
    f.push({ i: [0, a, b], m: mats[2] });
    want.push(add(out, [0, 0, 0.8]));
    f.push({ i: [a, bot, b], m: q % 2 ? mats[0] : mats[1] });
    want.push(add(out, [0, 0, -0.3]));
  }
  return mesh(v, wound(v, f, want));
}

/**
 * A crystal on its chain, hung from its bone at the top: a fine gold chain,
 * a small gold bead where it is fixed, and an ice-blue crystal under that,
 * with a spark of light on it.
 */
function pendant(len: number, r: number, n: number): Mesh {
  const chain = tube([[0, 0, 0.02], [0, 0, -len]], r * 0.16, r * 0.16, 4, 'metal');
  const bead = prism([0, 0, -len + r * 0.5], r * 0.5, r * 0.6, r * 0.55, 4, ['metal', 'metalDark', 'metalLit'], Math.PI / 4);
  const top = -len - r * 0.25;
  const gem = prism([0, 0, top], r * 0.9, r * 2.3, r, n >= 8 ? 6 : 5, ['crystal', 'crystalDark', 'gem']);
  const glint = paint([disc([r * 0.36, r * 0.55, top - r * 1.15], [0.45, 0.85, 0.2], r * 0.22, r * 0.4, 5, 'glint', { lit: true })]);
  return merge(chain, bead, gem, glint);
}

/* ---- the horns ------------------------------------------------------------------------------ */

/**
 * The line of the right horn, in the head's frame, `N + 1` points from root
 * to tip: out of the top of the skull behind the eyes, back over and down
 * behind the ear, forward under it and up again in front of it, a ram's curl
 * round the ear, flaring out from the head as it goes; and its thickness at
 * each point, tapering to the tip.
 */
function hornLine(s: Cloud, N: number): { pts: V3[]; r: number[] } {
  const h = s.horn;
  const root = hornRoot(s);
  const th0 = h.start * DEG;
  // The curl's middle, beside the skull under the root, about where the ear comes out.
  const C = curlOf(s);
  const pts: V3[] = [], r: number[] = [];
  for (let q = 0; q <= N; q++) {
    const u = q / N, th = th0 + u * h.turns * TAU, R = h.R * (1 - 0.42 * u);
    // Out from the top of the skull to the side of it, and on out a little as it curls.
    const x = lerp(root[0], C[0], smooth(Math.min(1, u * 3))) + h.flare * u;
    pts.push([x, C[1] + R * Math.cos(th), C[2] + R * Math.sin(th)]);
    r.push(h.r * (1 - 0.62 * u ** 1.2));
  }
  // Rooted a little down inside the skull.
  pts[0] = sub(pts[0], [0.04, 0, 0.06]);
  return { pts, r };
}

/** Where it butts with, in the head's frame: the brow between the roots of its horns, a little ahead of it. */
const browOf = (s: Cloud): V3 => add(onSkull(s, [0, 0.75, 0.66]).p, [0, s.horn.r + 0.1, 0]);

/** Where a point `u` along the horn is, and how thick it is there. */
function hornAt(line: { pts: V3[]; r: number[] }, u: number): { p: V3; r: number; d: V3 } {
  const N = line.pts.length - 1, x = clamp(u) * N, k = Math.min(N - 1, Math.floor(x)), f = x - k;
  const p: V3 = add(line.pts[k], scale(sub(line.pts[k + 1], line.pts[k]), f));
  return { p, r: lerp(line.r[k], line.r[k + 1], f), d: unit(sub(line.pts[k + 1], line.pts[k])) };
}

/**
 * The right horn: ridged brown, the ridges in a darker shade every third
 * ring, and its gold bands, each a short wide ring round it with a bright
 * edge. The left is its mirror.
 */
function hornOf(s: Cloud, n: number): Mesh {
  const N = 22, line = hornLine(s, N);
  const horn = tube(line.pts, line.r, line.r, n, (ring) => (ring % 3 === 1 ? 'hornDark' : 'horn'), { seam: 'start' });
  const bands = s.horn.bands.map((u) => {
    const a = hornAt(line, u - 0.018), b = hornAt(line, u), c = hornAt(line, u + 0.018), w = b.r * 1.22;
    return tube([a.p, b.p, c.p], [w, w * 1.04, w], [w, w * 1.04, w], n, (ring) => (ring === 1 ? 'metal' : 'metalDark'));
  });
  return merge(horn, ...bands);
}

/* ---- the head ------------------------------------------------------------------------------- */

/** A painted shape of corners `v`, wound so it faces out along `n` as a disc does. */
function facing(v: V3[], n: V3, m: Mat): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m };
}

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth, a lid. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  return facing(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/**
 * The eyes, open or shut, on the curve of the skull where it narrows into the
 * muzzle and looking forward as much as out: big and sky blue with a dark
 * middle, a big glint and a small one, under a soft lid line, the lid coming
 * down over the Cloudborne's calm eye. All of an eye goes out of sight
 * together when the skull or the muzzle is between it and the viewer (`at`).
 */
function eyesOf(s: Cloud, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q0 = onSkull(s, E.dir), q = side > 0 ? q0 : left(q0);
    const n = unit(add(q.n, [0, 0.1, 0.04])), p = add(q.p, scale(n, 0.005));
    // Gone together behind the skull a little before it would be turned edge on to the viewer, so it is never a sliver at the
    // edge of the head: tested from a point round the side of the skull from it, toward the back.
    const at = onSkull(s, add(scale(q.n, 1), [side * 0.75, -0.25, 0])).p;
    const up = unit(cross(cross(n, [0, 0, 1]), n)), side3 = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const r = E.size;
    if (shut) {
      // A shut eye: a curved lid-line, its ends down, across where the eye was.
      out.push(line(Array.from({ length: 5 }, (_, k) => {
        const f = k / 4 - 0.5, pt = add(add(p, scale(side3, f * r * 2.1)), scale(up, -r * 0.1 + r * 0.35 * (1 - 4 * f * f)));
        return { p: pt, n };
      }), r * 0.2, 'lid'));
      continue;
    }
    out.push(disc(add(p, scale(up, r * 0.08)), n, r * 1.12, r * 1.16, 12, 'lid', o));
    out.push(disc(add(p, scale(n, 0.004)), n, r, r * 1.05, 12, 'water', o));
    out.push(disc(add(add(p, scale(n, 0.008)), scale(up, -r * 0.05)), n, r * 0.52, r * 0.58, 10, 'eye', o));
    out.push(disc(add(add(add(p, scale(n, 0.012)), scale(up, r * 0.34)), scale(side3, -side * r * 0.3)), n, r * 0.3, r * 0.3, 7, 'glint', { ...o, lit: true }));
    out.push(disc(add(add(add(p, scale(n, 0.012)), scale(up, -r * 0.42)), scale(side3, side * r * 0.32)), n, r * 0.13, r * 0.13, 5, 'glint', { ...o, lit: true }));
    // A heavy lid on a calm old eye: the face's colour over its top, with a line along its edge.
    if (E.lid > 0) {
      const lid: V3[] = [];
      for (let k = 0; k <= 8; k++) {
        const t = Math.PI * (k / 8);
        lid.push(add(add(add(p, scale(n, 0.016)), scale(side3, Math.cos(t) * r * 1.16)), scale(up, Math.sin(t) * r * 1.2)));
      }
      const cut = r * (1.2 - 2.3 * E.lid);
      for (let k = 8; k >= 0; k--) {
        const t = Math.PI * (k / 8);
        lid.push(add(add(add(p, scale(n, 0.016)), scale(side3, Math.cos(t) * r * 1.16)), scale(up, cut - Math.sin(t) * r * 0.12)));
      }
      out.push({ ...facing(lid, n, 'muzzle'), at });
      out.push(disc(add(add(p, scale(n, 0.02)), scale(up, cut - r * 0.06)), n, r * 1.1, r * 0.14, 8, 'lid', o));
    }
  }
  // Every corner laid onto the skull's curve, each layer a hair over the last, so an eye turned toward the edge of the head
  // wraps round it as an eye does rather than standing off it past the outline.
  const S = s.head.skull;
  return paint(out.map((d, q) => ({ ...d, v: d.v.map((v) => { const e = onEgg(S.c, S.r, sub(v, S.c)); return add(e.p, scale(e.n, 0.008 + 0.002 * (q % 6))); }) })));
}

/**
 * The head: a sheep's -- a round domed skull, biggest against its body on the
 * Cloudlet, and a soft muzzle out of the front of it sloping down, longer at
 * each stage, with a pink nose at the end of it, a small smile under that,
 * and a blush on each cheek -- and its eyes.
 */
function headOf(s: Cloud, n: number, k: number, shut: boolean): Mesh {
  const S = s.head.skull;
  const skull = orb(S.c, S.r, n + 2, k + 1, 'muzzle');
  const cheek = onSkull(s, [0.7, 0.5, -0.32]);
  const blush = paint([cheek, left(cheek)].map((q) => disc(add(q.p, scale(q.n, 0.02)), q.n, S.r[0] * 0.2, S.r[2] * 0.12, 8, 'inner')));
  return merge(skull, blush, eyesOf(s, shut));
}

/**
 * The muzzle, a piece of its own over the skull with no line where it meets
 * it, so the face is one soft shape: an egg out of the front of the skull,
 * with the nose and the smile on it.
 */
function muzzleMesh(s: Cloud, n: number, k: number): Mesh {
  const M = s.head.muzzle;
  const muzzle = orbAlong(M.c, M.dir, M.r, n + 2, k + 1, 'muzzle');
  const tip = onMuzzle(s, [0, 0.35, 1]), [x, y] = muzzleFrame(s), nr = M.r[0] * 0.42;
  const nose = paint([facing([0, 1, 2, 3, 4, 5, 6].map((q) => {
    const t = Math.PI / 2 + (q / 7) * TAU;
    return add(add(add(tip.p, scale(tip.n, 0.012)), scale(x, Math.cos(t) * nr * (1 - 0.38 * Math.max(0, Math.sin(t))))), scale(y, Math.sin(t) * nr * 0.8 * (Math.sin(t) > 0 ? 0.55 : 1)));
  }), tip.n, 'nose')]);
  const mouth = onMuzzle(s, [0, -0.45, 0.9]);
  return merge(muzzle, nose, smile(add(mouth.p, scale(mouth.n, -0.01)), mouth.n, M.r[0] * 0.8, 'lid'));
}

/** An ear: a soft leaf, cream outside and pink inside, built upright facing forward and cupped a little so its lining shows. */
function earOf(len: number, w: number, n: number): Mesh {
  const spine = curve([0, 0, 0], [0, 0.04, len * 0.5], [0, -0.02, len], 4);
  const ws = [w * 0.55, w * 0.95, w, w * 0.75, 0.02];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.35 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(spine, ws, ws.map((x) => Math.max(0.025, x * 0.22)), n, 'muzzle', { up: [0, 1, 0], seam: 'start' });
  const edge = (sd: number): V3[] => [1, 2, 3].map((q) => cup([sd * ws[q] * 0.62, ws[q] * 0.22 + 0.014, spine[q][2]]));
  return merge(mesh(shell.v.map(cup), shell.f), paint([{ v: [cup([0, 0.03, len * 0.08]), ...edge(-1), cup([0, 0.03, len * 0.9]), ...edge(1).reverse()], m: 'inner' }]));
}

/* ---- the cloud it keeps shorn ---------------------------------------------------------------- */

/** A cuff of cloud round the lower leg over the hoof: a ring of puffs, cream and blue, on the lower leg's bone. */
function cuffOf(s: Cloud, lower: number, n: number, k: number, seed: number): Mesh {
  const out: Mesh[] = [];
  const R = s.thick * 0.7 + s.cuff * 0.45;
  for (let q = 0; q < 6; q++) {
    const id = seed + q, th = (q / 6) * TAU + 0.4 * jitter(id);
    const r = s.cuff * (0.85 + 0.3 * jitter(id + 3));
    out.push(puffMesh([Math.cos(th) * R, Math.sin(th) * R, -lower * (0.86 - 0.08 * (q % 2))], [r, r, r * 0.85], n, k, jitter(id + 5) < 0.4 ? 'cap' : 'coatLight'));
  }
  return merge(...out);
}

/** Where a point on a ring round the neck is, in the ruff's frame (the body's, at the neck's root): `t` up the neck, `th` round it, pushed out by `out`. */
function onNeck(s: Cloud, t: number, th: number, out = 0): { p: V3; n: V3 } {
  const lean = s.neck.lean * DEG, A: V3 = [0, Math.sin(lean), Math.cos(lean)], v = cross(A, [1, 0, 0]);
  const n = add(scale([1, 0, 0], Math.cos(th)), scale(v, -Math.sin(th)));
  return { p: add(scale(A, t), scale(n, s.neck.w * 0.95 + out)), n };
}

/**
 * The ruff of cloud round the root of the neck and down over the chest: two
 * rings of puffs, cream with a blue one or two, bigger at the front of the
 * chest. In the ruff's frame, so it goes down a little with the head.
 */
function ruffPuffs(s: Cloud, n: number, k: number): Mesh {
  const out: Mesh[] = [];
  const R = s.ruff;
  for (const [ring, count, t] of [[0, 8, 0.1], [1, 7, -0.25]] as const) {
    for (let q = 0; q < count; q++) {
      const id = 900 + ring * 20 + q, th = ((q + 0.5 * ring) / count) * TAU + 0.3 * jitter(id);
      // None on the back of the neck, where the fleece or the mane is; the front, under the chin, fullest.
      const front = -Math.sin(th);
      if (front < -0.4) continue;
      const big = R * (0.8 + 0.35 * Math.max(0, front)) * (0.9 + 0.2 * jitter(id + 1));
      const at = onNeck(s, t - 0.15 * Math.max(0, front) * ring, th, big * 0.35);
      out.push(puffMesh(at.p, [big, big, big * 0.9], n, k, jitter(id + 4) < 0.22 ? 'cap' : 'coatLight'));
    }
  }
  return merge(...out);
}

/** Where the chain across the chest runs, in the ruff's frame: from the shoulder on one side, down under the chest over the ruff, and up to the other. */
function chestChain(s: Cloud, K: number): V3[] {
  const pts: V3[] = [];
  for (let q = 0; q <= K; q++) {
    const f = q / K, th = lerp(-0.25, -Math.PI + 0.25, f);
    pts.push(onNeck(s, -0.28 - 0.1 * Math.sin(Math.PI * f), th, s.ruff * 1.05).p);
  }
  return pts;
}

/** The necklace on the Cloudlet: a fine gold ring round the root of its neck, over the ruff, the charm hanging at the front of it. */
function necklace(s: Cloud, K: number): V3[] {
  return Array.from({ length: K + 1 }, (_, q) => onNeck(s, 0.02 - 0.05 * Math.cos((q / K) * TAU + Math.PI / 2), (q / K) * TAU, s.ruff * 0.85).p);
}

/** A run of chain along points, fine gold, closed if it comes back round. */
const chainOf = (pts: readonly V3[], r: number, closed = false): Mesh => tube(closed ? [...pts, pts[1]] : pts, r, r, 4, (ring) => (ring % 2 ? 'metalLit' : 'metal'));

/**
 * Where the chain down a flank runs, in the trunk's frame, `side` its side:
 * from the shoulder along the side of the fleece to the hip, sagging in the
 * middle, laid on the fleece however far it has grown.
 */
function flankAt(s: Cloud, f: number, side: number, u: number): V3 {
  const B = s.body, y = lerp(B.y[5] - 0.25, B.y[1] + 0.35, u);
  const q = onBody(s, y, 0.55 - 0.45 * Math.sin(Math.PI * u));
  const out = (s.fleece.loft + s.fleece.puff * 0.75) * (0.3 + 0.7 * f) * smooth(f / 0.3) + 0.03;
  const p = add(q.p, scale(q.n, out));
  return [side * p[0], p[1], p[2]];
}

/** How big a cream blossom is on a garland. */
const blossomOf = (s: Cloud): number => 0.26 + 0.045 * s.strike;

/**
 * A garland: a cream blossom at each of `at` (where, and the way out there),
 * turned out from what it lies on, each with one leaf beside it, to one side
 * and the other in turn along the run (`along`, the way the run goes there).
 */
function garland(at: ReadonlyArray<{ p: V3; n: V3; along: V3 }>, r: number): Mesh[] {
  return at.map((q, i) => {
    const sd = i % 2 ? 1 : -1, n = unit(q.n), d = unit(sub(q.along, scale(n, dot(q.along, n))));
    const c = add(q.p, scale(n, r * 0.3));
    return merge(flower(c, n, r, true, i * 0.7), leaf(add(c, scale(d, sd * r * 0.55)), add(scale(d, sd), scale(n, 0.25)), n, r * 1.4));
  });
}

/** The garland across the chest, in the ruff's frame: blossoms along the chain there, one more than down each flank. */
function chestGarland(s: Cloud): Mesh {
  const N = s.bloom.side + 1, out: Array<{ p: V3; n: V3; along: V3 }> = [];
  for (let q = 0; q < N; q++) {
    const f = lerp(0.12, 0.88, N > 1 ? q / (N - 1) : 0.5), th = lerp(-0.25, -Math.PI + 0.25, f);
    const at = onNeck(s, -0.28 - 0.1 * Math.sin(Math.PI * f), th, s.ruff * 1.05);
    const next = onNeck(s, -0.28 - 0.1 * Math.sin(Math.PI * (f + 0.01)), th - 0.01 * (Math.PI - 0.5), s.ruff * 1.05);
    out.push({ p: at.p, n: unit(add(at.n, [0, 0.4, 0])), along: sub(next.p, at.p) });
  }
  return merge(...garland(out, blossomOf(s)));
}

/**
 * The garland down a flank, `side` its side, in the trunk's frame: blossoms
 * along the chain there, over the shoulder half of it on the Cloudram, which
 * has no chain; moved out or in with the fleece it lies on, each blossom with
 * its leaf as one.
 */
function flankGarland(s: Cloud, side: number): { mesh: Mesh; bent: (v: readonly V3[], a: Anim) => V3[] } {
  const N = s.bloom.side, end = s.charm.flank ? 0.9 : 0.5, us = Array.from({ length: N }, (_, q) => lerp(0.08, end, N > 1 ? q / (N - 1) : 0.5));
  const at = us.map((u) => {
    const p = flankAt(s, 1, side, u), next = flankAt(s, 1, side, u + 0.01);
    const B = s.body, q = onBody(s, lerp(B.y[5] - 0.25, B.y[1] + 0.35, u), 0.55 - 0.45 * Math.sin(Math.PI * u));
    return { p, n: [side * q.n[0], q.n[1], q.n[2]] as V3, along: sub(next, p) };
  });
  const parts = garland(at, blossomOf(s));
  const ends: number[] = [];
  let total = 0;
  for (const m of parts) ends.push((total += m.v.length));
  return {
    mesh: merge(...parts),
    bent: (v, a) => {
      if (a.fleece >= 1) return v as V3[];
      // Each blossom with its leaf moved with the fleece under it, and grown from nothing as the fleece comes back, so none
      // stands out past a fleece too short to hold it.
      const k = smooth((a.fleece - 0.4) / 0.35), to = us.map((u) => flankAt(s, a.fleece, side, u));
      let q = 0;
      return v.map((p, i) => {
        while (i >= ends[q]) q++;
        return add(to[q], scale(sub(p, at[q].p), k));
      });
    },
  };
}

/* ---- its pieces -------------------------------------------------------------------------------- */

/** Where its crystals hang, each from its own bone (`cloudBones`): from its horns, its throat, the chain across its chest, and down its flanks. */
function dropsOf(s: Cloud): Drop[] {
  const out: Drop[] = [];
  const big = s.charm.big;
  if (s.horn.drops.length) {
    const line = hornLine(s, 22);
    for (const side of [1, -1]) {
      s.horn.drops.forEach((u, q) => {
        const a = hornAt(line, u + (q - (s.horn.drops.length - 1) / 2) * 0.03);
        const at: V3 = [side * a.p[0], a.p[1], a.p[2] - a.r * 1.2];
        out.push({ bone: 'head', at: () => at, len: big * (2.2 + 1.6 * (q % 2)), r: big, side, id: out.length + 1 });
      });
    }
  }
  if (s.charm.throat) {
    const at = onNeck(s, 0.02 - 0.05 * Math.cos(Math.PI * 1.5 + Math.PI / 2), -Math.PI / 2, s.ruff * 0.85).p;
    out.push({ bone: 'ruff', at: () => at, len: big * 1.2, r: big * 1.15, side: 0, id: out.length + 1 });
  }
  if (s.charm.chest) {
    const pts = chestChain(s, 12);
    for (let q = 0; q < s.charm.chest; q++) {
      const at = pts[Math.round(lerp(3, 9, s.charm.chest > 1 ? q / (s.charm.chest - 1) : 0.5))];
      out.push({ bone: 'ruff', at: () => at, len: big * (q === 1 ? 2.6 : 1.6), r: big * (q === 1 ? 1.2 : 1), side: q - 1, id: out.length + 1 });
    }
  }
  for (const side of [1, -1]) {
    for (let q = 0; q < s.charm.flank; q++) {
      const u = (q + 1) / (s.charm.flank + 1);
      out.push({ bone: 'trunk', at: (f) => flankAt(s, f, side, u), len: big * 2, r: big, side, id: out.length + 1 });
    }
  }
  return out;
}

/** A stage's pieces: a sheep's body (`quadPieces`) with its own head, and its horns, ears, fleece, cloud, flowers, chains and crystals. */
function cloudBuild(s: Cloud, drops: readonly Drop[], lod: number): Piece[] {
  // Fine enough for the head, the horns and the legs; the fleece's puffs on its outline as fine, so it scallops round, and the
  // rest coarser, and the small ones coarser still: a foraging sheep is drawn afresh every frame.
  const n = cut(lod, 7, 10), k = cut(lod, 5, 6), pn = cut(lod, 7, 9), pk = cut(lod, 4, 5), fn = cut(lod, 7, 12), fk = cut(lod, 4, 6), sn = 7, sk = 4;
  const skull = skullOf(s);
  const cloudy = { lines: false, sheen: 'eyeWhite' as Mat };
  // The fleece, puff by puff.
  const puffs = fleecePuffs(s);
  const groups: Group[] = [];
  const meshes: Mesh[] = [];
  let at = 0;
  const grouped = (m: Mesh, pf: Puff, into: Mesh[], list: Group[], base: { at: number }): void => {
    list.push({ from: base.at, to: base.at + m.v.length, pf });
    base.at += m.v.length;
    into.push(m);
  };
  const fb = { at };
  for (const pf of puffs) grouped(puffMesh(pf.c, pf.r, pf.fine ? fn : pn, pf.fine ? fk : pk, TINT[pf.tint]), pf, meshes, groups, fb);
  const fleece = merge(...meshes);
  const top = Math.max(...puffs.map((pf) => pf.c[2]));
  // Blue cloud-flowers on the fleece, down each side, each on the puff nearest where it goes, out on the top of it. (Cream
  // blossoms are on garlands, along its chains.)
  const bloomList: Mesh[] = [], bloomGroups: Group[] = [], bb = { at: 0 };
  for (const sd of s.bloom.cream ? [] : [1, -1]) {
    for (let q = 0; q < s.bloom.side; q++) {
      const y = lerp(s.body.y[4] + 0.1, s.body.y[2], s.bloom.side > 1 ? q / (s.bloom.side - 1) : 0.4) + 0.15 * (jitter(q + (sd > 0 ? 0 : 9)) - 0.5);
      const th = 0.25 + 0.5 * jitter(q * 2 + (sd > 0 ? 1 : 4));
      const want = onBody(s, y, sd > 0 ? th : Math.PI - th);
      let host = puffs[0], best = Infinity;
      for (const pf of puffs) {
        const d = Math.hypot(pf.c[0] - want.p[0] * 1.6, pf.c[1] - want.p[1], pf.c[2] - want.p[2] * 1.2);
        if (d < best && pf.c[0] * sd > 0) { best = d; host = pf; }
      }
      const out = unit(sub(host.c, host.root));
      const c = add(host.c, scale(out, host.r[1] * 0.92));
      grouped(flower(c, out, 0.2, false, q), host, bloomList, bloomGroups, bb);
    }
  }
  const blooms = bloomList.length ? merge(...bloomList) : undefined;
  // The crown: a tuft of cloud between the horns with a blue cloud-flower on it.
  const crown = onSkull(s, [0, -0.15, 1]).p;
  const T = s.tuft;
  const tuft = merge(
    puffMesh(add(crown, [0, 0, T * 0.35]), [T * 1.1, T, T * 0.85], sn, sk, 'coatLight'),
    puffMesh(add(crown, [T * 0.8, -T * 0.3, T * 0.1]), [T * 0.8, T * 0.8, T * 0.7], sn, sk, 'coatLight'),
    puffMesh(add(crown, [-T * 0.8, -T * 0.3, T * 0.1]), [T * 0.8, T * 0.8, T * 0.7], sn, sk, 'coatLight'),
    puffMesh(add(crown, [0, -T * 0.7, T * 0.2]), [T * 0.85, T * 0.8, T * 0.75], sn, sk, 'cap'),
  );
  const crownFlower = flower(add(crown, [T * 0.55, T * 0.35, T * 0.75]), [0.5, 0.45, 1], 0.2 * (s.tuft / 0.17) ** 0.5, false, 0.3);
  // The tail: a short stub and a puff of cloud on the end of it.
  const tailPuff = merge(
    puffMesh([0, -s.tail * 0.6, s.tail * 0.2], [s.tail, s.tail * 1.05, s.tail], sn, sk, 'coatLight'),
    puffMesh([s.tail * 0.5, -s.tail * 0.2, -s.tail * 0.3], [s.tail * 0.7, s.tail * 0.7, s.tail * 0.65], sn, sk, 'cap'),
  );
  // The rump's puff, kept shorn: over the root of the tail and down the backs of the thighs.
  const B = s.body, R = s.rump;
  const rump = R ? merge(...[[0, 0.15, 1], [0.6, -0.15, 0.85], [-0.6, -0.15, 0.85], [0.95, -0.65, 0.75], [-0.95, -0.65, 0.75], [0, -0.5, 0.8]].map(([x, z, k2], q) =>
    puffMesh([x * B.w[1] * 0.75, B.y[0] + 0.1 - 0.12 * Math.abs(x), B.z[1] + z * B.h[1] + 0.12], [R * k2, R * k2 * 0.9, R * k2 * 0.9], sn, sk, q > 2 && q < 5 ? 'cap' : 'coatLight'))) : undefined;
  const ruff = ruffPuffs(s, sn, sk);
  // The chains: the necklace, the swag across the chest, and the chain down each flank.
  const necklaceMesh = s.charm.throat ? chainOf(necklace(s, 16), 0.022, true) : undefined;
  const chest = s.charm.chest ? chainOf(chestChain(s, 12), 0.028) : undefined;
  const flank = (side: number): { mesh: Mesh; bent: (v: readonly V3[], a: Anim) => V3[] } => {
    const K = 12, pts = Array.from({ length: K + 1 }, (_, q) => flankAt(s, 1, side, q / K));
    const m = chainOf(pts, 0.03);
    // Each ring of the chain moved out or in with the fleece it lies on: its corners go four to a point along it (`chainOf`).
    return {
      mesh: m,
      bent: (v, a) => {
        if (a.fleece >= 1) return v as V3[];
        return v.map((p, i) => {
          const q = Math.min(K, Math.floor(i / 4));
          return add(p, sub(flankAt(s, a.fleece, side, q / K), pts[q]));
        });
      },
    };
  };
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh } => {
    const L = fore ? foreLen(s) : hindLen(s), w = s.thick;
    // The upper leg round, not much wider at the top than at the knee, and rooted well up inside the barrel, so however it
    // swings its top stays inside it and never shows past it as a blade.
    return { upper: [fore ? 0.3 : 0.26, -L, w * (fore ? 1.3 : 1.4), w * 1.0], lower: [0, -L, w * 0.82, w * 0.62], foot: cloven(w * 0.78, s.hoof, n) };
  };
  const solids = bodySolids(s);
  const extras: Piece[] = [
    { key: 'fleece', mesh: fleece, bone: 'trunk', bias: 0.05, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0', 'rump'], hide: solids, bent: growing(s, groups, top), shown: (a) => a.fleece > 0.02, ...cloudy },
    // The ruff over the fleece from in front and the side, and under it from behind, where the fleece is between it and the viewer.
    { key: 'ruff', mesh: ruff, bone: 'ruff', bias: 0.07, after: ['neck', 'body', 'fleece'], front: [0, 1, 0.2], ...cloudy },
    { key: 'tuft', mesh: tuft, bone: 'head', bias: 0.235, after: ['head', 'horn0', 'horn1'], hide: [skull], ...cloudy },
    { key: 'muzzle', mesh: muzzleMesh(s, n, k), bone: 'head', bias: 0.205, after: ['head'], front: [0, 1, 0], lines: false },
    { key: 'crownFlower', mesh: crownFlower, bone: 'head', bias: 0.24, after: ['tuft'], hide: [skull], thin: true },
  ];
  if (blooms) extras.push({ key: 'blooms', mesh: blooms, bone: 'trunk', bias: 0.06, after: ['fleece', 'body'], hide: bodySolids(s, 1.2), bent: growing(s, bloomGroups, top), shown: (a) => a.fleece > 0.3, thin: true });
  // The garlands of cream blossoms: across the chest along the chain there, and down each flank along the chain there (on the
  // Cloudram, which has none, the same way over its shoulder), laid on the fleece however far it has grown.
  if (s.bloom.cream) {
    extras.push({ key: 'garland', mesh: chestGarland(s), bone: 'ruff', bias: 0.085, after: ['ruff', 'fleece', 'neck', 'chest'], front: [0, 1, 0.2], thin: true });
    for (const [side, key] of [[1, 'garlandR'], [-1, 'garlandL']] as const) {
      const g = flankGarland(s, side);
      extras.push({ key, mesh: g.mesh, bone: 'trunk', bias: 0.075, after: ['fleece', `flank${side > 0 ? 'R' : 'L'}`], front: [side, 0, 0.3], bent: g.bent, shown: (a) => a.fleece > 0.3, thin: true });
    }
  }
  if (rump) extras.push({ key: 'rump', mesh: rump, bone: 'trunk', bias: 0.03, after: ['body', 'hl0', 'hr0'], ...cloudy });
  if (necklaceMesh) extras.push({ key: 'necklace', mesh: necklaceMesh, bone: 'ruff', bias: 0.08, after: ['ruff', 'neck'], front: [0, 1, 0.2], hide: [{ c: [0, 0, 0.05], r: [s.neck.w * 0.9, s.neck.w * 0.9, s.neck.w] }], thin: true });
  if (chest) extras.push({ key: 'chest', mesh: chest, bone: 'ruff', bias: 0.08, after: ['ruff', 'fleece', 'neck'], front: [0, 1, 0.2], thin: true });
  if (s.charm.flank) {
    for (const [side, key] of [[1, 'flankR'], [-1, 'flankL']] as const) {
      const f = flank(side);
      extras.push({ key, mesh: f.mesh, bone: 'trunk', bias: 0.07, after: ['fleece', 'blooms'], front: [side, 0, 0.3], bent: f.bent, thin: true });
    }
  }
  // Each horn, after the head and over the ear; the far one under the head.
  const horn = hornOf(s, n);
  const mirrorX = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
  extras.push(
    { key: 'horn1', mesh: horn, bone: 'head', bias: 0.22, after: ['head'], front: [1, 0, 0], hide: [skull] },
    { key: 'horn0', mesh: mirrorX(horn), bone: 'head', bias: 0.22, after: ['head'], front: [-1, 0, 0], hide: [skull] },
  );
  // The crystals, each on its own bone, hanging; the far ones under the body and the head.
  // From the horns, over the head and the horns on the near side and under them on the far, and ordered against the rest by
  // the head's own depth, so from behind they go under the fleece with the head; from the chains, over or under what they lie on.
  const hang = drops.map((dr, q): Piece => ({
    key: `drop${q}`, mesh: pendant(dr.len, dr.r, n), bone: `drop${q}`, bias: dr.bone === 'head' ? 0.25 : 0.1,
    after: dr.bone === 'head' ? ['head', 'horn0', 'horn1', 'tuft'] : dr.bone === 'ruff' ? ['ruff', 'fleece', 'chest', 'necklace'] : ['fleece', 'blooms', `flank${dr.side > 0 ? 'R' : 'L'}`],
    front: dr.bone === 'head' ? [dr.side, 0.2, 0] : dr.bone === 'ruff' ? [0, 1, 0.2] : [dr.side, 0, 0.3], thin: true,
  }));
  extras.push(...hang);
  // The little clouds drifting off its back.
  for (let q = 0; q < 2; q++) {
    const r = s.fleece.puff * (q ? 0.65 : 0.82);
    extras.push({ key: `puff${q}`, mesh: merge(puffMesh([0, 0, 0], [r * 1.2, r, r * 0.8], sn, sk, 'eyeWhite'), puffMesh([r * 0.9, 0.05, -r * 0.2], r * 0.65, sn, sk, 'eyeWhite'), puffMesh([-r * 0.85, -0.05, -r * 0.25], r * 0.58, sn, sk, 'cap')), bone: `puff${q}`, bias: -0.2, airy: true, thin: true, shown: (a) => a.fleece > 0.6, ...cloudy });
  }
  const pieces = quadPieces({
    n, k,
    body: { ...s.body, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 1.05, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s.ear.len, s.ear.w, n),
    earTurn: -15,
    tail: [tube(curve([0, 0.04, 0], [0, -0.1, 0.04], [0, -0.16, 0], 2), 0.07, 0.07, 5, 'coat', { seam: 'start' }), tailPuff],
    fore: legs(true),
    hind: legs(false),
    breath: 0.03,
    extras,
  });
  // The cuffs of cloud round each lower leg, over the leg and the hoof.
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const lower = fore ? foreLen(s) : hindLen(s);
    pieces.push({ key: `${key}cuff`, mesh: cuffOf(s, lower, sn, sk, key.charCodeAt(0) * 7 + key.charCodeAt(1)), bone: `${key}1`, bias: 0.04, after: [`${key}1`, `${key}2`, 'body'], front: [side * 0.7, fore ? 0.7 : -0.7, 0], ...cloudy });
  }
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: [skull, muzzleOf(s)] };
    if (pc.key === 'tail1') return { ...pc, ...cloudy };
    // The body finer round than the rest, so a shorn barrel is round and not a box, and its rump rounded off behind rather than
    // cut flat: two smaller rings past the last.
    if (pc.key === 'body') {
      const B = s.body, cap = [[-0.07, 0.72], [-0.12, 0.32]] as const;
      const ys = [...cap.map(([dy]) => B.y[0] + dy).reverse(), ...B.y], zs = [B.z[0], B.z[0], ...B.z];
      const ws = [...cap.map(([, k2]) => B.w[0] * k2).reverse(), ...B.w], hs = [...cap.map(([, k2]) => B.h[0] * k2).reverse(), ...B.h];
      // Its outline along it a smooth curve through the rings (three to each span), swelling a little in the middle of the
      // barrel and drawn in toward each end, so from the side it is a round barrel rather than a box.
      const cr = (v: readonly number[], q: number, f: number): number => {
        const a = v[Math.max(0, q - 1)], b = v[q], c = v[q + 1], d = v[Math.min(v.length - 1, q + 2)];
        return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
      };
      const Y: number[] = [], Z: number[] = [], Wd: number[] = [], H: number[] = [];
      for (let q = 0; q < ys.length - 1; q++) {
        for (let k2 = 0; k2 < 3; k2++) {
          const f = k2 / 3, y = cr(ys, q, f), mid = clamp((y - B.y[1]) / (B.y[5] - B.y[1])), swell = 1 + 0.07 * Math.sin(Math.PI * mid);
          Y.push(y); Z.push(cr(zs, q, f)); Wd.push(cr(ws, q, f) * swell); H.push(cr(hs, q, f) * swell);
        }
      }
      Y.push(ys[ys.length - 1]); Z.push(zs[zs.length - 1]); Wd.push(ws[ws.length - 1]); H.push(hs[hs.length - 1]);
      return { ...pc, mesh: tube(Y.map((y, q) => [0, y, Z[q]] as V3), Wd, H, cut(lod, 9, 14), 'coat') };
    }
    if (pc.key === 'ear0' || pc.key === 'ear1') return { ...pc, bias: 0.225, after: ['head', pc.key === 'ear0' ? 'horn0' : 'horn1'] };
    return pc;
  });
}

/** A cloven hoof: two dark toes side by side with a cleft between them. */
function cloven(r: number, h: number, n: number): Mesh {
  return merge(...[-1, 1].map((sd) => tube([[sd * r * 0.42, r * 0.1, 0.04], [sd * r * 0.46, r * 0.2, -h * 0.5], [sd * r * 0.48, r * 0.3, -h]],
    [r * 0.42, r * 0.48, r * 0.5], [r * 0.6, r * 0.74, r * 0.82], n, 'hoof', { seam: 'start' })));
}

/* ---- what it throws about --------------------------------------------------------------- */

const CREAM: RGB = [255, 251, 240];
const SKY: RGB = [168, 204, 246];
const ICE: RGB = [196, 228, 255];
const GOLD: RGB = [246, 214, 128];
const GRASS: RGB = [128, 168, 88];
const INK: RGB = [96, 102, 150];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/**
 * How big a stage's things in the air are drawn, against the Cloudram's, in
 * the units of the screen they are drawn on: about two to a unit of its body
 * (a unit along the ground is 1.7 of them, and up, 2.25).
 */
const bigness = (s: Cloud): number => 2 * Math.max(0.9, (s.len / 2.3) ** 0.8);

/**
 * A puff of cloud in the air at (x, y), `r` across: three overlapping
 * rounds, lit on top, with a soft lavender-grey edge. Never see-through, so
 * no edge shows through it as a bubble's would: `al` is how much of it is
 * left, and as it goes it shrinks and pales, its edge paling into it, to
 * nothing.
 */
function cloudPuff(g: CanvasRenderingContext2D, x: number, y: number, r0: number, c0: RGB, al: number, spin = 0): void {
  const left = clamp(al), r = r0 * left ** 0.75;
  if (left <= 0.01 || r <= 0.05) return;
  const c = mix(c0, [255, 255, 255], 0.5 * (1 - left));
  const rounds: Array<[number, number, number]> = [[0, 0, 1], [Math.cos(spin) * 0.75, -0.2 + Math.sin(spin) * 0.15, 0.72], [-Math.cos(spin) * 0.7, -0.1, 0.66]];
  g.save();
  g.lineWidth = Math.max(0.15, r * 0.18);
  g.strokeStyle = css(mix(c, INK, 0.45 * left), 1);
  g.beginPath();
  for (const [dx, dy, k] of rounds) { g.moveTo(x + dx * r + k * r, y + dy * r); g.arc(x + dx * r, y + dy * r, k * r, 0, TAU); }
  g.stroke();
  g.fillStyle = css(c, 1);
  g.fill();
  g.fillStyle = css(mix(c, [255, 255, 255], 0.55), 1);
  g.beginPath();
  g.arc(x - r * 0.15, y - r * 0.3, r * 0.55, 0, TAU);
  g.fill();
  g.restore();
}

/** A four-pointed sparkle at (x, y), `r` from its middle to its points: the glint off a crystal or a bit of gold. */
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number, spin = 0): void {
  if (al <= 0.01 || r <= 0) return;
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.beginPath();
  for (let q = 0; q < 8; q++) {
    const t = (q / 8) * TAU, k = q % 2 ? r * 0.22 : r;
    if (q) g.lineTo(Math.cos(t) * k, Math.sin(t) * k);
    else g.moveTo(Math.cos(t) * k, Math.sin(t) * k);
  }
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.beginPath();
  g.arc(0, 0, r * 0.22, 0, TAU);
  g.fillStyle = css([255, 255, 255], al);
  g.fill();
  g.restore();
}

/** A fleck of fleece in the air: a small soft round of cream or blue, shrinking to nothing as it goes (`al` how much is left). */
function mote(g: CanvasRenderingContext2D, x: number, y: number, r0: number, c: RGB, al: number): void {
  const left = clamp(al), r = r0 * Math.sqrt(left);
  if (left <= 0.01 || r <= 0.03) return;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = css(c, 1);
  g.fill();
  g.lineWidth = r * 0.3;
  g.strokeStyle = css(mix(c, INK, 0.35 * left), 1);
  g.stroke();
}

/** Where something let go of at `p` with velocity `v` is `s` seconds on, slowing as it drifts: cloud rather than stone. */
const drifted = (p: V3, v: V3, s: number, drag = 2.2): V3 => {
  const k = (1 - Math.exp(-drag * s)) / drag;
  return [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k];
};

/**
 * The blow: where the horns meet what it butts, a burst of cloud puffing out
 * from the impact, up and away from the fleece, and crystal sparkles flying
 * out of it; on the Cloudborne a bigger burst, a ring of cloud rolling out
 * over the ground, and more sparkles.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Cloud, b: Bones, at: Bones, t: number, front: boolean): void {
  const hit = CLOUD_HITS[s.strike], since = (t - hit) * ACT_SECS.strike;
  // The puffs shot up go a little before the blow on the Cloudlet, whose head is low behind its fleece, so they clear its back
  // as soon as the others' do.
  const rise = since + (s.strike === 0 ? 0.03 * ACT_SECS.strike : 0);
  if (rise <= 0) return;
  upward(g, view, s, at, b.body.t, rise, front);
  if (since <= 0) return;
  // Sizes on the screen (`big`), and distances and speeds in its body's own units (`far`).
  const big = bigness(s) * (1 + 0.15 * s.strike), far = big / 2, fade = 1 - ramp(t, hit + 0.15, 1);
  // Where the horns are at the blow: the front of the curl, ahead of the face.
  const impact = place(at.head, browOf(s));
  const mid = b.body.t;
  // The poof itself, swelling at the horns and thinning away: over everything from the front, under it from behind.
  const poof = 1 - ramp(since, 0.05, 0.32);
  if (poof > 0 && nearSide(impact, mid, view) === front) {
    const [x, y] = onScreen(view, impact);
    cloudPuff(g, x, y, (0.32 + 0.4 * ramp(since, 0, 0.12)) * big, CREAM, poof, 0.7);
  }
  // Puffs thrown off round it, out to the sides and up clear of the fleece, slowing as cloud does and settling near it.
  const count = 6 + 3 * s.strike;
  for (let q = 0; q < count; q++) {
    const th = (q / count) * TAU + jitter(q) * 0.5;
    const v: V3 = [Math.cos(th) * (2.0 + 0.8 * jitter(q + 3)) * far, (0.6 + 0.8 * jitter(q + 5)) * far, (6.5 + 2.0 * Math.max(0, Math.sin(th)) + 1.2 * jitter(q + 7)) * far];
    const p = drifted(impact, v, since, 3.4);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const grow = 0.45 + 0.55 * ramp(since, 0, 0.2);
    cloudPuff(g, x, y, (0.3 + 0.1 * jitter(q + 9)) * big * grow, q % 3 === 2 ? SKY : CREAM, 0.95 * fade, q);
  }
  // The crystal sparkles, out faster and further, twinkling as they go.
  const sparks = 5 + 3 * s.strike;
  for (let q = 0; q < sparks; q++) {
    const th = (q / sparks) * TAU + 0.4 + jitter(q + 20);
    const v: V3 = [Math.cos(th) * 2.6 * far, 1.4 * jitter(q + 22) * far, (3.4 + 2.0 * jitter(q + 24)) * far];
    const p = drifted(impact, v, since, 3.2);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const tw = 0.6 + 0.4 * Math.sin(since * 40 + q * 2);
    sparkle(g, x, y, 0.4 * big * tw * (1 - 0.4 * ramp(since, 0, 0.3)), q % 2 ? ICE : GOLD, fade, q * 0.3);
  }
  // The Cloudborne's slam: a ring of cloud rolling out over the ground round its fore hooves.
  if (s.strike === 2) {
    const fl = place(at.fl2, [0, 0, 0]), fr = place(at.fr2, [0, 0, 0]);
    const ground: V3 = [(fl[0] + fr[0]) / 2, (fl[1] + fr[1]) / 2, 0.15];
    const n = 9;
    for (let q = 0; q < n; q++) {
      const th = (q / n) * TAU, rr = (0.5 + 1.8 * (1 - Math.exp(-since * 6))) * far;
      const p: V3 = [ground[0] + Math.cos(th) * rr, ground[1] + Math.sin(th) * rr * 0.8, ground[2] + 0.2 * ramp(since, 0, 0.2)];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      cloudPuff(g, x, y, 0.26 * big * (0.7 + 0.3 * ramp(since, 0, 0.15)), q % 3 ? CREAM : SKY, 0.9 * fade * (1 - ramp(since, 0.15, 0.45)), q * 1.3);
    }
  }
}

/**
 * A few puffs of the blow shot straight up and a little back, fast, `since`
 * seconds after they go, so the blow shows from behind too, clearing the top
 * of it within a few hundredths of a second.
 */
function upward(g: CanvasRenderingContext2D, view: View, s: Cloud, at: Bones, mid: V3, since: number, front: boolean): void {
  const big = bigness(s) * (1 + 0.15 * s.strike), far = big / 2, impact = place(at.head, browOf(s));
  const fade = 1 - ramp(since / ACT_SECS.strike, 0.15, 1 - CLOUD_HITS[s.strike]);
  for (let q = 0; q < 3; q++) {
    const v: V3 = [(q - 1) * 0.8 * far, -(0.8 + 0.5 * q) * far, (14 + 2 * q + 1.2 * jitter(q + 60)) * far];
    const p = drifted(impact, v, since, 4.5);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    cloudPuff(g, x, y, (0.34 + 0.08 * q) * big * (0.5 + 0.5 * ramp(since, 0, 0.2)), q === 1 ? CREAM : SKY, 0.95 * fade, q + 4);
  }
}

/**
 * Its task: a fleck of grass or two at each bite while its muzzle is at the
 * grass; and as it shakes, wisps of cloud and flecks of fleece shaken off it,
 * drifting up off its back and fading. Looping, the last go's wisps carry on
 * across the turn rather than going; played once, nothing before its shake.
 */
function workWisps(g: CanvasRenderingContext2D, view: View, s: Cloud, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), far = big / 2, mid = b.body.t;
  const w = workOf(t, a.graze);
  // Grass at the bites, under the muzzle: over the body if the muzzle is on the viewer's side of it, under it if not.
  const tip = place(b.head, noseOf(s));
  if (w.head > 0.5 && nearSide(tip, mid, view) === front) {
    for (const t0 of CLOUD_WORK.bites) {
      const since = (t - t0) * ACT_SECS.work;
      if (since < 0 || since > 0.25) continue;
      for (let q = 0; q < 2; q++) {
        const p = drifted([tip[0], tip[1], Math.max(0.1, tip[2])], [(q ? 1 : -1) * 0.8, 0.3, 1.2], since, 4);
        const [x, y] = onScreen(view, p);
        g.save();
        g.translate(x, y);
        g.rotate(q + since * 9);
        g.fillStyle = css(GRASS, 1 - since / 0.25);
        g.fillRect(-0.18 * big, -0.03 * big, 0.36 * big, 0.06 * big);
        g.restore();
      }
    }
  }
  // The wisps and the motes, from the shake.
  const t0 = (CLOUD_WORK.shake[0] + CLOUD_WORK.shake[1]) / 2 - 0.08;
  if (t < t0 && a.graze < 0.5) return;
  const since = frac(t - t0) * ACT_SECS.work;
  const life = 0.95;
  if (since > life) return;
  const fade = (1 - smooth(since / life)) * ramp(since, 0, 0.08);
  const top = s.body.z[2] + s.body.h[2] + s.fleece.loft * clamp(a.fleece);
  const n = 8 + 2 * s.strike;
  for (let q = 0; q < n; q++) {
    const th = (q / n) * TAU + jitter(q + 40);
    const from = place(b.trunk, [Math.cos(th) * s.body.w[3] * 1.1, lerp(s.body.y[1], s.body.y[5], jitter(q + 41)), top]);
    const p = drifted(from, [Math.cos(th) * 1.8 * far, Math.sin(th) * 1.3 * far, (2.4 + 1.4 * jitter(q + 43)) * far], since, 1.5);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 2) cloudPuff(g, x, y, (0.26 + 0.08 * jitter(q)) * big * clamp(a.fleece + 0.45), q % 4 === 1 ? SKY : CREAM, 0.9 * fade, q);
    else mote(g, x, y, 0.1 * big, q % 4 === 0 ? CREAM : SKY, fade);
  }
}

/**
 * Evolving: at the start a swell of cloud billowing out of it that covers the
 * moment it changes into its new body; then crystal sparkles drawn in to its
 * crystals from all round as the light gathers, flashing on them at the turn;
 * and cloud wisps going up round it.
 */
function evolveFx(g: CanvasRenderingContext2D, view: View, s: Cloud, b: Bones, drops: readonly Drop[], t: number, front: boolean): void {
  const big = bigness(s), far = big / 2, mid: V3 = [0, 0, b.body.t[2]];
  // Already there as it begins, so the moment it changes body is never seen.
  const swell = 1 - ramp(t, 0.12, 0.3);
  if (swell > 0) {
    const R = s.len * 0.5 + s.fleece.loft;
    for (let q = 0; q < 16; q++) {
      const th = (q / 16) * TAU * 1.6 + jitter(q) * 0.5, el = jitter(q + 30) * 1.8 - 0.3;
      const out = R * (0.7 + 0.6 * ramp(t, 0, 0.25));
      const p: V3 = [Math.cos(th) * out * 0.8, Math.sin(th) * out, b.body.t[2] + el * s.body.h[3] * 1.2 + 0.6 * t * 4];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      cloudPuff(g, x, y, (0.55 + 0.25 * jitter(q + 2)) * big * (0.7 + 0.5 * ramp(t, 0, 0.1)), q % 3 === 0 ? SKY : CREAM, swell, q * 0.7);
    }
  }
  // Sparkles drawn in to each crystal, arriving at the turn, and flashing there.
  const gather = ramp(t, 0.22, 0.5);
  for (let q = 0; q < drops.length; q++) {
    const dr = drops[q], bone = b[`drop${q}`];
    if (!bone) continue;
    const gem = place(bone, [0, 0, -dr.len - dr.r * 1.2]);
    if (t > 0.2 && t < 0.5) {
      for (let k = 0; k < 2; k++) {
        const th = q * 1.7 + k * Math.PI, d = (1 - gather) * 2.4 * far;
        const p: V3 = [gem[0] + Math.cos(th) * d, gem[1] + Math.sin(th) * d, gem[2] + d * 0.6];
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        sparkle(g, x, y, 0.22 * big, k ? ICE : GOLD, ramp(t, 0.2, 0.28), th);
      }
    }
    const flash = hump(t, 0.5 + 0.015 * (q % 4), 0.07);
    if (flash > 0 && nearSide(gem, mid, view) === front) {
      const [x, y] = onScreen(view, gem);
      sparkle(g, x, y, (0.35 + 0.2 * flash) * big, ICE, flash, q);
    }
  }
  // Cloud wisps going up round it through the middle of it.
  const rise = ramp(t, 0.15, 0.3) * (1 - ramp(t, 0.75, 1));
  if (rise > 0) {
    const tall = s.legs + s.body.h[3] * 2 + s.fleece.loft * 2 + 0.8;
    for (let q = 0; q < 10; q++) {
      const u = frac(t * 1.1 + q / 10), ang = (q / 10) * TAU * 2 + t * TAU;
      const r = s.len * 0.7 * (1 - 0.35 * u);
      const p: V3 = [Math.cos(ang) * r * 0.75, Math.sin(ang) * r, u * tall];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      cloudPuff(g, x, y, 0.22 * big, q % 2 ? SKY : CREAM, rise * Math.sin(u * Math.PI) * 0.9, ang);
    }
  }
}

/**
 * Its crystals glinting as it stands and goes, one now and another then: a
 * small sparkle on a crystal on the near side of it, never two at once on the
 * same one, a few to a loop each.
 */
function glints(g: CanvasRenderingContext2D, view: View, s: Cloud, b: Bones, drops: readonly Drop[], a: Anim): void {
  const big = bigness(s);
  const head = b.head?.t ?? b.body.t;
  for (let q = 0; q < drops.length; q++) {
    const dr = drops[q], bone = b[`drop${q}`];
    if (!bone) continue;
    const at = place(bone, [0, 0, -dr.len - dr.r * 0.9]);
    // Hidden round the far side of the body or the head.
    const c = dr.bone === 'head' ? head : b.body.t;
    if (dr.side !== 0 && !nearSide(at, c, view)) continue;
    const k = beat(a.t, [(q * 5.3 + 1.1) % LOOP, (q * 5.3 + 9.7) % LOOP, (q * 5.3 + 17.3) % LOOP], 0.7);
    if (k <= 0) continue;
    const [x, y] = onScreen(view, at);
    sparkle(g, x, y, 0.3 * big * k, [255, 255, 255], 0.9 * k, a.t * 2);
  }
}

/** Light: a soft flash at the horns as the blow lands; and a cool glow on its crystals at the turn of evolving. */
function cloudGlow(s: Cloud, b: Bones, drops: readonly Drop[], a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = hump(act.t, CLOUD_HITS[s.strike] + 0.02, 0.1);
    if (k <= 0) return [];
    return [{ p: place(b.head, browOf(s)), r: 0.5 * bigness(s) + 0.4 * s.strike, c: [236, 244, 255], a: 0.4 * k }];
  }
  if (act?.kind === 'evolve') {
    const k = hump(act.t, 0.5, 0.12);
    if (k <= 0) return [];
    return drops.map((dr, q) => ({ p: place(b[`drop${q}`], [0, 0, -dr.len - dr.r]), r: 0.3 * bigness(s), c: [200, 228, 255] as RGB, a: 0.45 * k }));
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A colour pushed further from its own grey by `k`: a sky blue rather than a grey-blue. */
const richer = (c: RGB, k: number): RGB => {
  const m = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => clamp(m + (x - m) * k, 0, 255)) as RGB;
};

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, grazes and evolves. */
function cloudKind(s: Cloud): Kind {
  const drops = dropsOf(s);
  const bones = cloudBones(s, drops);
  // Where everything is at the moment the horns meet what it butts, for the burst to come from.
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: CLOUD_HITS[s.strike] } });
  return {
    bones,
    build: (lod) => cloudBuild(s, drops, lod),
    // The variant's coat for its body and the cream of its fleece, a little lighter; its markings for the cloud's colour, kept
    // as bright as it is (the island's pastels would take a sky blue to a grey); and its horns, hooves, gold and crystals the
    // same on every variant.
    palette: (coat0, mark0) => {
      const coat = pastel(coat0), sky = richer(mix(mark0, coat, 0.12), 1.25);
      const face = mix(coat, [250, 228, 206], 0.3);
      return coatPalette(coat0, mark0, {
        coat,
        coatLight: mix(coat, [255, 253, 246], 0.55),
        coatDark: mix(coat, [176, 168, 210], 0.3),
        muzzle: face,
        cap: sky,
        feather: mix(sky, [196, 170, 238], 0.6),
        featherDark: mix(sky, [150, 130, 210], 0.5),
        eyeWhite: [255, 255, 255],
        inner: [242, 168, 180],
        nose: [226, 136, 150],
        lid: mix(coat, [92, 64, 70], 0.62),
        water: [86, 150, 226],
        eye: [34, 40, 78],
        glint: [255, 255, 255],
        horn: [158, 108, 72],
        hornDark: [132, 88, 58],
        hoof: [88, 64, 58],
        metal: [226, 182, 86],
        metalLit: [255, 234, 160],
        metalDark: [168, 122, 52],
        crystal: [132, 190, 250],
        crystalDark: [82, 136, 222],
        gem: [214, 238, 255],
        petal: [255, 248, 228],
        bloom: [246, 206, 112],
        leaf: [172, 204, 140],
        stem: [150, 184, 120],
        leafDark: [156, 190, 128],
      }, 250);
    },
    shadow: [s.len * 0.75 + s.fleece.loft, s.body.w[4] + s.fleece.loft * 1.2],
    stride: 1.3,
    size: s.size,
    blinks: 4,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are cream and sky blue, its fleece's colours.
    motes: [[255, 248, 230], [150, 196, 246]],
    glow: (b, a) => cloudGlow(s, b, drops, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (front && !act && a.fleece >= 0) glints(g, view, s, b, drops, a);
      if (!act) return;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') workWisps(g, view, s, b, a, act.t, front);
      else if (act.kind === 'evolve') evolveFx(g, view, s, b, drops, act.t, front);
    },
  };
}

export const CLOUDLET = cloudKind(CLOUDLET_LOOK);
export const CLOUDRAM = cloudKind(CLOUDRAM_LOOK);
export const CLOUDBORNE = cloudKind(CLOUDBORNE_LOOK);
