/**
 * K1-K5, the kitchen's work: the jobs done with a quern, a vessel, a frying pan or at a fire with none
 * (`../routes.ts` CLIP_OF_TOOL, CLIP_OF_JOB):
 * - `quern` (K1, grinding): knelt at the hand quern set down ahead of the knees (`QUERN_AT`; the quern on the ground's own
 *   bone, `../../lowpoly.ts` GROUND), the right fist round the peg turning the runner in circles, two turns a run, the
 *   trunk swayed after it; the left hand on the left thigh, lifted over the eye once a run to drop in grain;
 * - `press` (K2, pressing): knelt at the quern, both hands flat on the runner, the trunk leant in over them to press down
 *   and let up;
 * - `stir` (K3): stood, the left fist round the vessel's lug at the belt (a pot, a bowl or a jar: `../index.ts` TOOLS_OF),
 *   the right stirring the spoon round inside it, two rounds a run, the head bowed over it;
 * - `roast` (K4, cooking at a fire with no tool): knelt, leant toward the fire ahead, the right fist holding the skewer out
 *   over it, turned one way and back by the elbow raised and let down (the fist rolled about the stick);
 * - `fry` (K5): knelt the same, the pan held out over the fire in the right fist, shaken forward and back twice and tossed.
 * Each played mirrored, left-handed, from the facings the flat figure works left-handed from (`../index.ts` LEFT_OF; the
 * press is the same either way). The knelt clips kneel as the ground clip does (`./ground.ts`: both knees down, the toes
 * tucked under, the get-down and get-up a long fade, `../index.ts` SETTLE), the trunk more upright.
 *
 * The hands are put on their places (`Clip.hands`, body heights from where the feet stand, as the ground under them is
 * there: the toes tucked under lift the frame by `UP`); the arms as keyed only say which side each elbow is on.
 */
import type { Clip, HandReach, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/* ---- knelt ----------------------------------------------------------------------------------------------------------- */
/** Each foot rolled up onto its toes about the ball, degrees (as the ground clip's). */
const TOES = 70;
/** How far the toes tucked under lift the frame the hands are put in (the ankles' rise), body heights: his, and hers (of her height). */
const UP = 0.02, HER_UP = 0.013;
/** The legs and the shift knelt on both knees (the ground clip's: the knees on the ground, the hips over them). */
const KNEEL: KeyPose = {
  rot: { thigh_l: [30, 0, -10], thigh_r: [30, 0, 10], calf_l: [-90, 0, 0], calf_r: [-90, 0, 0] },
  move: [0, -0.2544, 0.3203],
  feet: { l: { z: 0, lift: 0, pitch: -TOES }, r: { z: 0, lift: 0, pitch: -TOES } },
};
/** Knelt upright over what is worked ahead of the knees: leant forward from the hips, the head bowed to it. */
const SAT: KeyPose = merge(KNEEL, {
  rot: {
    pelvis: [34, 0, 0], spine_01: [9, 0, 0], spine_02: [8, 0, 0], spine_03: [6, 0, 0], clavicle_l: [14, 0, 0], clavicle_r: [14, 0, 0],
    neck_01: [-20, 0, 0], neck_02: [-8, 0, 0], head: [22, 0, 0],
  },
});
/** The arms as keyed, which side the elbows are reached on: out and a little back, the forearms in toward the work. */
const ELBOWS: Record<string, Euler> = {
  upperarm_r: [14, -6, -30], lowerarm_r: [60, -13, 0], upperarm_l: [14, 6, 30], lowerarm_l: [60, 13, 0],
};
/** A pose's bones turned further by `d` (degrees, bone by bone), its shift moved by `dm`. */
const plus = (p: KeyPose, d: Record<string, Euler>, dm: Euler = [0, 0, 0]): KeyPose => {
  const rot = { ...p.rot };
  for (const [b, e] of Object.entries(d)) { const a = rot[b] ?? [0, 0, 0]; rot[b] = [a[0] + e[0], a[1] + e[1], a[2] + e[2]]; }
  const m = p.move ?? [0, 0, 0];
  return { ...p, rot, move: [m[0] + dm[0], m[1] + dm[1], m[2] + dm[2]] };
};
/** Her corrections knelt (the ground clip's: her feet closer together, her shins longer for her height). */
const HER_KNEEL = { add: { thigh_l: [0, 0, -6] as Euler, thigh_r: [0, 0, 6] as Euler }, move: [1, 1.2421, 1.3066] as Euler };
/** The knelt clips' stance: the feet where the idle stands them, so the fade into and out of it keeps them put. */
const STANCE = { rot: { thigh_l: [0, -3, 6] as Euler, thigh_r: [0, 3, -6] as Euler } };

/** Keys of a hand's place over a run, eased evenly between them (a hand going round). */
const linear = (pts: Array<[number, Euler]>): Array<Key<Euler>> => pts.map(([t, v]) => ({ t: +t.toFixed(4), v, ease: 'linear' as const }));

/* ---- K1, the quern: the runner turned by its peg ---------------------------------------------------------------------- */
/** Where the quern's foot is, body heights ahead of where the feet stand (his; hers `HER_AHEAD` further). */
export const QUERN_AT: Euler = [0, 0, 0.49];
const HER_AHEAD = 0.065;
/** The runner's top, the peg's circle and the fist round the peg, body heights (the quern drawn the same share of her height). */
const RUNNER_TOP = 1.19 / 16.5, PEG = 1.25 / 16.5, FIST = (1.19 + 1.65) / 16.5;
/** Seconds a turn of the runner takes; two turns a run. */
const TURN = 1.2;
const QUERN_LENGTH = 2 * TURN;
/** The fist round the peg at time t: round the quern's middle, from the near side over the left to the far side. */
const pegAt = (t: number): Euler => {
  const a = (t / TURN) * Math.PI * 2;
  return [QUERN_AT[0] + PEG * Math.sin(a), FIST - UP, QUERN_AT[2] - PEG * Math.cos(a)];
};
/** The trunk after the fist: leant in as it goes away, turned to the side it is on. */
const SWAY = (a: number): Record<string, Euler> => {
  const far = (1 - Math.cos(a)) / 2, side = Math.sin(a);
  return { pelvis: [3 * far, 2 * side, 0], spine_02: [2 * far, 3 * side, 0], spine_03: [1.5 * far, 3 * side, 0], head: [-2 * far, -2 * side, 0] };
};
/** The left hand: on the left thigh; over the eye with a pinch of grain, let go into it. */
const LAP: Euler = [0.085, 0.15 - UP, 0.375], EYE: Euler = [0.028, 0.175 - UP, QUERN_AT[2] + 0.005];
/** The fingers: closed a little at rest, pinched round the grain, opened to let it go. */
const REST_F: Record<string, Euler> = { fingers_01_l: [18, 0, 0], fingers_02_l: [24, 0, 0] };
const PINCH: Record<string, Euler> = { fingers_01_l: [48, 0, 0], fingers_02_l: [58, 0, 0], thumb_01_l: [20, 0, 0], thumb_02_l: [20, 0, 0] };
const OPEN: Record<string, Euler> = { fingers_01_l: [4, 0, 0], fingers_02_l: [4, 0, 0], thumb_01_l: [0, 0, 0], thumb_02_l: [0, 0, 0] };
/** The feed's times in the second turn (the fist then on the far and the right side, away from the left hand). */
const FEED = { lift: 1.3, over: 1.72, drop: 1.92, back: 2.3 };
const quernPose = (t: number, fingers: Record<string, Euler>, lean: Record<string, Euler> = {}): KeyPose => plus(merge(SAT, { rot: { ...ELBOWS, ...REST_F, ...fingers } }), { ...SWAY((t / TURN) * Math.PI * 2), ...lean });
const QUERN_BEATS: Beat[] = [
  { t: 0, pose: quernPose(0, {}), ease: 'inOut', stage: 'key', name: 'near' },
  { t: 0.3, pose: quernPose(0.3, {}), ease: 'inOut', name: 'left' },
  { t: 0.6, pose: quernPose(0.6, {}), ease: 'inOut', stage: 'key', name: 'far' },
  { t: 0.9, pose: quernPose(0.9, {}), ease: 'inOut', name: 'right' },
  { t: 1.2, pose: quernPose(1.2, {}), ease: 'inOut', stage: 'key', name: 'near, second turn' },
  { t: 1.5, pose: quernPose(1.5, PINCH, { spine_03: [1, 2, 0], head: [2, 3, 0] }), ease: 'inOut', name: 'left, the grain taken up' },
  { t: 1.8, pose: quernPose(1.8, PINCH, { head: [3, 4, 0] }), ease: 'inOut', stage: 'key', name: 'far, over the eye' },
  { t: 1.98, pose: quernPose(1.98, OPEN, { head: [3, 3, 0] }), ease: 'out', stage: 'key', name: 'the grain dropped' },
  { t: 2.1, pose: quernPose(2.1, OPEN), ease: 'inOut', name: 'right' },
];
const QUERN_KEYS = poseToPose(QUERN_BEATS, { length: QUERN_LENGTH, loop: true, lag: { head: 0.06, spine_03: 0.03 } });
const quernHands = (): Partial<Record<'l' | 'r', HandReach>> => ({
  r: { at: linear(Array.from({ length: 24 }, (_, k) => [k * 0.1, pegAt(k * 0.1)])), way: [0, 1, 0] },
  l: {
    at: [
      { t: 0, v: LAP }, { t: FEED.lift, v: LAP, ease: 'inOut' },
      { t: FEED.over, v: EYE, ease: 'inOut' }, { t: FEED.drop, v: [EYE[0], EYE[1] - 0.012, EYE[2]], ease: 'inOut' },
      { t: FEED.back, v: LAP, ease: 'inOut' },
    ],
    way: [0, 0.2, 1],
  },
});
const { footKeys: QUERN_FEET, ...QUERN_REST } = QUERN_KEYS;
export const QUERN: Clip = {
  name: 'quern',
  loop: true,
  length: QUERN_LENGTH,
  mask: 'full',
  plant: STANCE,
  feet: { stride: 1, ...(QUERN_FEET as NonNullable<typeof QUERN_FEET>) },
  breath: { count: 1, depth: 0.4 },
  ...QUERN_REST,
  armsFree: true,
  hands: quernHands(),
  tools: { r: 'quern_handle', l: 'quern' },
  bodies: { man: { armsOut: -3 }, woman: { armsOut: -3, ...HER_KNEEL, hands: { l: [0, UP - HER_UP, HER_AHEAD], r: [0, UP - HER_UP, HER_AHEAD] } } },
};

/* ---- K2, the press: both hands flat on the runner, leant in over them ------------------------------------------------- */
const PRESS_LENGTH = 1.6;
/** Each hand flat on the runner a little to its side of the eye; pressed down by `SINK`. */
const PRESS_AT = (s: 1 | -1, sink = 0): Euler => [QUERN_AT[0] + s * 0.05, RUNNER_TOP + 0.02 - sink - UP, QUERN_AT[2] - 0.01];
const SINK = 0.008;
const FLAT: Record<string, Euler> = { fingers_01_l: [6, 0, 0], fingers_02_l: [6, 0, 0], fingers_01_r: [6, 0, 0], fingers_02_r: [6, 0, 0] };
/** Bowed further than the quern's turning, the hands down on the runner. */
const BOW: Record<string, Euler> = { pelvis: [14, 0, 0], spine_02: [3, 0, 0], spine_03: [3, 0, 0], clavicle_l: [10, 0, 0], clavicle_r: [10, 0, 0], neck_01: [-10, 0, 0] };
const PRESS_UP = plus(merge(SAT, { rot: { ...ELBOWS, ...FLAT } }), BOW);
/** Leant in over the hands: the hips up off the heels, bowed further, the head down. */
const PRESS_DOWN = plus(PRESS_UP, { pelvis: [6, 0, 0], spine_01: [3, 0, 0], spine_02: [3, 0, 0], spine_03: [2, 0, 0], neck_01: [-4, 0, 0], head: [2, 0, 0] }, [0, 0.012, 0.01]);
const PRESS_BEATS: Beat[] = [
  { t: 0, pose: PRESS_UP, ease: 'inOut', stage: 'key', name: 'let up' },
  { t: 0.5, pose: PRESS_DOWN, ease: 'in', stage: 'key', name: 'pressed' },
  { t: 0.9, pose: plus(PRESS_DOWN, { pelvis: [1, 0, 0] }, [0, 0.002, 0]), ease: 'out', name: 'held' },
  { t: 1.25, pose: PRESS_UP, ease: 'inOut', name: 'letting up' },
];
const { footKeys: PRESS_FEET, ...PRESS_REST } = poseToPose(PRESS_BEATS, { length: PRESS_LENGTH, loop: true, lag: { head: 0.05 } });
const pressHand = (s: 1 | -1): HandReach => ({
  at: [{ t: 0, v: PRESS_AT(s) }, { t: 0.5, v: PRESS_AT(s, SINK), ease: 'in' }, { t: 0.9, v: PRESS_AT(s, SINK), ease: 'linear' }, { t: 1.25, v: PRESS_AT(s), ease: 'inOut' }],
  way: [-s * 0.55, 0, 0.83],
});
export const PRESS: Clip = {
  name: 'press',
  loop: true,
  length: PRESS_LENGTH,
  mask: 'full',
  plant: STANCE,
  feet: { stride: 1, ...(PRESS_FEET as NonNullable<typeof PRESS_FEET>) },
  breath: { count: 1, depth: 0.4 },
  ...PRESS_REST,
  armsFree: true,
  hands: { l: pressHand(1), r: pressHand(-1) },
  tools: { l: 'quern' },
  // a go fitted to its length by the press's hold and the rest before the next
  stretch: [[0.5, 0.9], [1.25, PRESS_LENGTH]],
  bodies: { man: { armsOut: -3 }, woman: { armsOut: -3, ...HER_KNEEL, hands: { l: [0, UP - HER_UP, HER_AHEAD], r: [0, UP - HER_UP, HER_AHEAD] } } },
};

/* ---- K3, stirring: stood, the vessel held by its lug at the belt, the spoon going round in it --------------------------- */
const STIR_LENGTH = 1.6;
/** The left fist round the vessel's lug, the thumb up: the vessel out ahead of the knuckles, toward the middle. */
export const LUG: Euler = [0.08, 0.52, 0.21];
/** The middle of the vessel's mouth with the fist there (measured on him), how far round the spoon goes, its fist over it. */
const MOUTH: Euler = [0.03, 0.529, 0.279], ROUND = 0.026, SPOON = (1.75 - 0.47) / 16.5 - 0.006;
/** Her hands moved from his (body heights): the lug as far as she reaches, the spoon over her vessel's mouth. */
const HER_LUG: Euler = [0, 0.02, -0.04], HER_MOUTH: Euler = [-0.003, 0.037, -0.025];
const spoonAt = (t: number): Euler => {
  const a = (t / (STIR_LENGTH / 2)) * Math.PI * 2;
  return [MOUTH[0] + ROUND * Math.sin(a), MOUTH[1] + SPOON, MOUTH[2] - ROUND * Math.cos(a)];
};
const STOOD: KeyPose = {
  rot: {
    pelvis: [11, 0, 0], spine_01: [5, 0, 0], spine_02: [5, 0, 0], spine_03: [4, 0, 0], neck_01: [2, 0, 0], neck_02: [2, 0, 0], head: [14, 0, 0],
    upperarm_r: [5, -10, -25], lowerarm_r: [100, 0, 0], upperarm_l: [25, 10, 70], lowerarm_l: [80, 0, 0],
    fingers_01_l: [20, 0, 0], fingers_02_l: [26, 0, 0],
  },
  move: [0, -0.008, -0.01],
};
const stirPose = (t: number): KeyPose => {
  const a = (t / (STIR_LENGTH / 2)) * Math.PI * 2, s = Math.sin(a), f = (1 - Math.cos(a)) / 2;
  return plus(STOOD, { spine_02: [f, 1.5 * s, 0], spine_03: [f, 1.5 * s, 0], head: [0, -2 * s, 0] }, [0.002 * s, 0, 0]);
};
const STIR_BEATS: Beat[] = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4].map((t, k) => ({ t, pose: stirPose(t), ease: 'inOut' as const, ...(k % 2 ? {} : { stage: 'key' as const }), name: ['near', 'left', 'far', 'right'][k % 4] }));
export const STIR: Clip = {
  name: 'stir',
  loop: true,
  length: STIR_LENGTH,
  mask: 'full',
  // stood as the idle stands
  plant: STANCE,
  breath: { count: 1, depth: 0.6 },
  ...poseToPose(STIR_BEATS, { length: STIR_LENGTH, loop: true, lag: { head: 0.06, spine_03: 0.03 } }),
  armsFree: true,
  hands: {
    l: { at: [{ t: 0, v: LUG }], way: [0, 1, 0] },
    r: { at: linear(Array.from({ length: 16 }, (_, k) => [k * 0.1, spoonAt(k * 0.1)])), way: [0, 1, 0] },
  },
  tools: { r: 'wooden_spoon', l: 'clay_pot' },
  // (the hand the spoon goes round in: the vessel the job's own is put in the other, `../index.ts` TOOLS_OF)
  strike: { side: 'r', t: 0 },
  // her arms shorter for her height: bowed further over the vessel, held nearer
  bodies: { man: { armsOut: -3 }, woman: { armsOut: -3, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6], pelvis: [6, 0, 0], spine_01: [3, 0, 0], head: [-4, 0, 0] }, hands: { l: HER_LUG, r: HER_MOUTH } } },
};

/* ---- K4, at a fire: the skewer held out over it, turned ------------------------------------------------------------- */
const ROAST_LENGTH = 2;
/** Leant toward the fire from the knees. */
const AT_FIRE: KeyPose = plus(SAT, { pelvis: [4, 0, 0], neck_01: [-4, 0, 0], head: [-6, 0, 0] });
/** The right fist out ahead, low, the stick through it toward the fire (the thumb toward its far end), down a little. */
const SKEWER_AT: Euler = [-0.12, 0.21 - UP, 0.54], SKEWER_WAY: Euler = [0.2, -0.3, 0.93];
/** The left hand on the left thigh. */
const THIGH: Euler = [0.128, 0.2 - UP, 0.36];
/** The elbow out and up (the fist rolled over one way about the stick) and in and down (the other). */
const ELBOW_OUT: Record<string, Euler> = { upperarm_r: [40, 0, -80], lowerarm_r: [40, 0, 0] };
const ELBOW_IN: Record<string, Euler> = { upperarm_r: [-10, 0, 10], lowerarm_r: [100, 0, 0] };
const ROAST_A = merge(AT_FIRE, { rot: { ...ELBOWS, ...ELBOW_OUT, ...REST_F } }), ROAST_B = merge(AT_FIRE, { rot: { ...ELBOWS, ...ELBOW_IN, ...REST_F } });
const ROAST_BEATS: Beat[] = [
  { t: 0, pose: ROAST_A, ease: 'inOut', stage: 'key', name: 'turned over' },
  { t: 0.25, pose: ROAST_A, ease: 'linear', name: 'held' },
  { t: 1.0, pose: plus(ROAST_B, { head: [2, 0, 0] }), ease: 'inOut', stage: 'key', name: 'turned back' },
  { t: 1.25, pose: plus(ROAST_B, { head: [2, 0, 0] }), ease: 'linear', name: 'held' },
];
const { footKeys: ROAST_FEET, ...ROAST_REST } = poseToPose(ROAST_BEATS, { length: ROAST_LENGTH, loop: true, lag: { head: 0.08 } });
export const ROAST: Clip = {
  name: 'roast',
  loop: true,
  length: ROAST_LENGTH,
  mask: 'full',
  plant: STANCE,
  feet: { stride: 1, ...(ROAST_FEET as NonNullable<typeof ROAST_FEET>) },
  breath: { count: 1, depth: 0.4 },
  ...ROAST_REST,
  armsFree: true,
  hands: {
    // (a little up as it turns over, the fire's heat let off it)
    r: { at: [{ t: 0, v: SKEWER_AT }, { t: 0.6, v: [SKEWER_AT[0], SKEWER_AT[1] + 0.025, SKEWER_AT[2] - 0.012], ease: 'inOut' }, { t: 1.0, v: SKEWER_AT, ease: 'inOut' }, { t: 1.6, v: [SKEWER_AT[0], SKEWER_AT[1] + 0.008, SKEWER_AT[2]], ease: 'inOut' }], way: SKEWER_WAY },
    l: { at: [{ t: 0, v: THIGH }], way: [0, -0.2, 1] },
  },
  tools: { r: 'skewer' },
  stretch: [[0, 0.25], [1.0, 1.25]],
  // (his shawl's front hangs further from his chest as he bows: he leans in less, his fist out past it)
  bodies: { man: { armsOut: -3, add: { pelvis: [-8, 0, 0], spine_01: [-2, 0, 0], neck_01: [6, 0, 0] } }, woman: { armsOut: -3, ...HER_KNEEL, hands: { l: [0, UP - HER_UP, HER_AHEAD], r: [0, UP - HER_UP, HER_AHEAD] } } },
};

/* ---- K5, frying: the pan held out over the fire, shaken and tossed ---------------------------------------------------- */
const FRY_LENGTH = 1.4;
/** The right fist out ahead, the handle through it toward the pan (the thumb toward it), out to the left a little. */
const PAN_AT: Euler = [-0.12, 0.23 - UP, 0.53], PAN_WAY: Euler = [0.4, 0, 0.92];
const shift = (p: Euler, d: Euler): Euler => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
const FRY_HOLD = merge(plus(AT_FIRE, { pelvis: [5, 0, 0], head: [-4, 0, 0] }), { rot: { ...ELBOWS, ...ELBOW_OUT, ...REST_F, upperarm_r: [24, 0, -40] } });
const FRY_BEATS: Beat[] = [
  { t: 0, pose: FRY_HOLD, ease: 'inOut', stage: 'key', name: 'held' },
  { t: 0.15, pose: plus(FRY_HOLD, { spine_03: [1, 0, 0] }), ease: 'out', name: 'forward' },
  { t: 0.3, pose: FRY_HOLD, ease: 'out', name: 'back' },
  { t: 0.45, pose: plus(FRY_HOLD, { spine_03: [1, 0, 0] }), ease: 'out', name: 'forward' },
  { t: 0.6, pose: FRY_HOLD, ease: 'out', stage: 'key', name: 'back' },
  { t: 0.78, pose: plus(FRY_HOLD, { spine_03: [-2, 0, 0], head: [-2, 0, 0] }), ease: 'in', stage: 'key', name: 'tossed' },
  { t: 0.95, pose: FRY_HOLD, ease: 'out', name: 'caught' },
];
const { footKeys: FRY_FEET, ...FRY_REST } = poseToPose(FRY_BEATS, { length: FRY_LENGTH, loop: true, lag: { head: 0.06 } });
export const FRY: Clip = {
  name: 'fry',
  loop: true,
  length: FRY_LENGTH,
  mask: 'full',
  plant: STANCE,
  feet: { stride: 1, ...(FRY_FEET as NonNullable<typeof FRY_FEET>) },
  breath: { count: 1, depth: 0.4 },
  ...FRY_REST,
  armsFree: true,
  hands: {
    r: {
      at: [
        { t: 0, v: PAN_AT }, { t: 0.15, v: shift(PAN_AT, [0, 0, 0.03]), ease: 'out' }, { t: 0.3, v: PAN_AT, ease: 'out' },
        { t: 0.45, v: shift(PAN_AT, [0, 0, 0.03]), ease: 'out' }, { t: 0.6, v: shift(PAN_AT, [0, 0, -0.008]), ease: 'out' },
        { t: 0.78, v: shift(PAN_AT, [0, 0.01, 0]), ease: 'in' }, { t: 0.95, v: PAN_AT, ease: 'out' },
      ],
      way: PAN_WAY,
    },
    l: { at: [{ t: 0, v: THIGH }], way: [0, -0.2, 1] },
  },
  tools: { r: 'frying_pan' },
  stretch: [[0.95, FRY_LENGTH]],
  // (his shawl's front hangs further from his chest as he bows: he leans in less, his fist out past it)
  bodies: { man: { armsOut: -3, add: { pelvis: [-8, 0, 0], spine_01: [-2, 0, 0], neck_01: [6, 0, 0] } }, woman: { armsOut: -3, ...HER_KNEEL, hands: { l: [0, UP - HER_UP, HER_AHEAD], r: [0, UP - HER_UP, HER_AHEAD] } } },
};
