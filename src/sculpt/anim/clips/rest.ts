/**
 * R1 and R2, at rest on the ground, each with its own way down onto it and up (`../down.ts`):
 * - sleeping (`sleep`): lain on the right side, the head on the right forearm, the left hand on the ground before the
 *   chest, the knees drawn up, the top one ahead; a slow breath a run;
 * - meditating (`meditate`): sat on the ground cross-legged, the knees fallen open, the left shin under the right, the
 *   hands on the knees palm up, the back held up and the head a little bowed; a slow breath a run.
 * The way down (`sleep-down`, `meditate-down`): crouched, sat down on the ground behind the feet, the feet kept where the
 * idle stands them; then lain down onto the right side, or the legs crossed.
 */
import type { Clip, HandReach, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import type { Down } from '../down';

/** Where the idle stands the feet (`./idle.ts` plant): the way down keeps them there while it says. */
const STANCE: Record<string, Euler> = { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] };
/** The arms hanging, the hands loose, as the idle's. */
const HANG: Record<string, Euler> = {
  upperarm_l: [-2, 0, 2], upperarm_r: [-2, 0, -2], lowerarm_l: [12, 0, 0], lowerarm_r: [12, 0, 0], hand_l: [0, -50, 0], hand_r: [0, 50, 0],
  fingers_01_l: [12, 0, 0], fingers_01_r: [12, 0, 0], fingers_02_l: [18, 0, 0], fingers_02_r: [18, 0, 0],
};
/** Stood as the idle stands, before going down. */
const STOOD: KeyPose = { rot: { ...STANCE, ...HANG } };
/** Crouched over the feet: the hips let down and back, the trunk leant forward over the knees, the arms ahead for balance. */
const CROUCH: KeyPose = {
  rot: {
    pelvis: [30, 0, 0], spine_01: [8, 0, 0], spine_02: [8, 0, 0], spine_03: [6, 0, 0], neck_01: [-14, 0, 0], neck_02: [-6, 0, 0], head: [0, 0, 0],
    thigh_l: [95, -3, 12], thigh_r: [95, 3, -12], calf_l: [-130, 0, 0], calf_r: [-130, 0, 0],
    upperarm_l: [55, 0, 14], upperarm_r: [55, 0, -14], lowerarm_l: [40, 0, 0], lowerarm_r: [40, 0, 0], hand_l: [0, -40, 0], hand_r: [0, 40, 0],
    fingers_01_l: [12, 0, 0], fingers_01_r: [12, 0, 0], fingers_02_l: [18, 0, 0], fingers_02_r: [18, 0, 0],
  },
  move: [0, -0.3, -0.1],
};
/** Sat on the ground behind the feet, the knees up, the hands on the ground beside the hips. */
const SAT: KeyPose = {
  rot: {
    pelvis: [-12, 0, 0], spine_01: [8, 0, 0], spine_02: [8, 0, 0], spine_03: [6, 0, 0], neck_01: [0, 0, 0], neck_02: [0, 0, 0], head: [4, 0, 0],
    thigh_l: [100, -3, 12], thigh_r: [100, 3, -12], calf_l: [-110, 0, 0], calf_r: [-110, 0, 0],
    upperarm_l: [-10, 0, 22], upperarm_r: [-10, 0, -22], lowerarm_l: [10, 0, 0], lowerarm_r: [10, 0, 0], hand_l: [0, -50, 0], hand_r: [0, 50, 0],
    fingers_01_l: [6, 0, 0], fingers_01_r: [6, 0, 0], fingers_02_l: [8, 0, 0], fingers_02_r: [8, 0, 0],
  },
  move: [0, -0.41, -0.24],
};

/* ---- meditating ---------------------------------------------------------------------------------------------------- */

/** One breath, in and out, seconds (as the flat figure's). */
const BREATH = 5.5;
/**
 * Cross-legged: the hips on the ground, a little rolled back; each thigh forward to near level and out, turned out so the
 * knee falls open; the left shin folded in under the right, the right over it a little ahead. The back held up, the head
 * a little bowed. (The thighs' turns solved as forward, out and turned out about themselves, in the world.)
 */
const CROSSED: KeyPose = {
  rot: {
    pelvis: [-8, 0, 0], spine_01: [3, 0, 0], spine_02: [3, 0, 0], spine_03: [1, 0, 0], neck_01: [6, 0, 0], neck_02: [4, 0, 0], head: [8, 0, 0],
    clavicle_l: [3, 0, 0], clavicle_r: [3, 0, 0],
    thigh_l: [41.6, -169.2, 94], thigh_r: [41.1, -175, -96.6], calf_l: [-140, 0, 0], calf_r: [-132, 0, 0], foot_l: [-15, 0, -35], foot_r: [-15, 0, 35],
    upperarm_l: [10, 0, 20], upperarm_r: [10, 0, -20], lowerarm_l: [60, 0, 0], lowerarm_r: [60, 0, 0],
    fingers_01_l: [14, 0, 0], fingers_01_r: [14, 0, 0], fingers_02_l: [20, 0, 0], fingers_02_r: [20, 0, 0],
  },
  move: [0, -0.43, 0],
};
/** The hands' places on the knees, palm up, his: body heights across, up and forward. */
const KNEE_HAND: Euler = [0.135, 0.105, 0.16];
const onKnees = (at: Euler, keys: Array<[number, number]>): Partial<Record<'l' | 'r', HandReach>> => {
  const k = (s: number): Array<Key<Euler>> => keys.map(([t, dy]) => ({ t, v: [s * at[0], at[1] + dy, at[2]] as Euler, ease: 'inOut' as const }));
  return { l: { at: k(1), way: [1, 0, 0.3] }, r: { at: k(-1), way: [-1, 0, 0.3] } };
};
const MED_BEATS: Beat[] = [{ t: 0, pose: CROSSED, ease: 'inOut', stage: 'key', name: 'sat' }];
const MED = poseToPose(MED_BEATS, { length: BREATH, loop: true });

export const MEDITATE: Clip = {
  name: 'meditate', loop: true, length: BREATH, mask: 'full',
  ...MED,
  breath: { count: 1, depth: 1.6 },
  armsFree: true,
  // the hands lifted a little with each breath in
  hands: onKnees(KNEE_HAND, [[0, 0], [BREATH * 0.4, 0.006], [BREATH * 0.9, 0]]),
  bodies: {
    // her legs longer for her height: let further down onto the ground
    woman: { move: [1, 1.22, 1], hands: { l: [0.005, -0.01, -0.04], r: [-0.005, -0.01, -0.04] } },
  },
};

/** On the way from sat to cross-legged: the knees lifted and let open, the shins folded in. */
const FOLD: KeyPose = merge(CROSSED, {
  rot: { pelvis: [-10, 0, 0], thigh_l: [54.1, -172.8, 125.6], thigh_r: [52.9, -178.1, -128.2], calf_l: [-135, 0, 0], calf_r: [-132, 0, 0], foot_l: [-25, 0, -35], foot_r: [-25, 0, 35] },
  move: [0, -0.43, -0.06],
});
/** The way down: stood, crouched, sat behind the feet, the legs folded in and crossed, the hands to the knees. */
const MED_DOWN_BEATS: Beat[] = [
  { t: 0, pose: STOOD, ease: 'inOut', name: 'stood' },
  { t: 0.55, pose: CROUCH, ease: 'inOut', name: 'crouched' },
  { t: 1.0, pose: SAT, ease: 'inOut', name: 'sat' },
  { t: 1.35, pose: FOLD, ease: 'inOut', name: 'folded' },
  { t: 1.75, pose: CROSSED, ease: 'inOut', name: 'crossed' },
];
export const MEDITATE_DOWN: Down = {
  name: 'meditate-down', loop: false, length: 1.75, mask: 'full', armsFree: true,
  ...poseToPose(MED_DOWN_BEATS, { length: 1.75, loop: false }),
  plant: { rot: STANCE },
  planted: [{ t: 0, v: 1 }, { t: 1.0, v: 1 }, { t: 1.3, v: 0 }],
  bodies: { woman: { move: [1, 1.22, 1] } },
};

/* ---- sleeping ------------------------------------------------------------------------------------------------------ */

/** One slow breath, seconds: a run, which is a go of lying down (`sleep`, 4 seconds). */
const SLEEP_BREATH = 4;
/**
 * Lain on the right side: the whole body turned over at the hips onto it, the head toward its right; the chest let up a
 * little off the ground over the shoulder, the head on the right forearm; the knees drawn up, the left (on top) further
 * and ahead, down on the ground before the right.
 */
const LAIN: KeyPose = {
  rot: {
    pelvis: [0, 0, 90], spine_01: [3, 0, -5], spine_02: [3, 0, -5], spine_03: [2, 0, -5], neck_01: [4, 0, 3], neck_02: [3, 0, 3], head: [6, 0, 5],
    thigh_l: [70, 0, -28], thigh_r: [45, 0, -4], calf_l: [-80, 0, 0], calf_r: [-85, 0, 0], foot_l: [20, 0, 35], foot_r: [20, 0, 25],
    upperarm_l: [40, 0, 10], upperarm_r: [120, 0, 10], lowerarm_l: [40, 0, 0], lowerarm_r: [110, 0, 0], hand_r: [0, 60, 0],
    fingers_01_l: [14, 0, 0], fingers_01_r: [14, 0, 0], fingers_02_l: [20, 0, 0], fingers_02_r: [20, 0, 0],
  },
  move: [-0.01, -0.39, 0],
};
/** The left hand's place lain: on the ground before the chest. */
const BEFORE: Euler = [-0.16, 0.025, 0.17];
const SLEEP_BEATS: Beat[] = [{ t: 0, pose: LAIN, ease: 'inOut', stage: 'key', name: 'lain' }];

export const SLEEP: Clip = {
  name: 'sleep', loop: true, length: SLEEP_BREATH, mask: 'full',
  ...poseToPose(SLEEP_BEATS, { length: SLEEP_BREATH, loop: true }),
  breath: { count: 1, depth: 1.4 },
  armsFree: true,
  // (the right arm as keyed: it is under the head)
  hands: { l: { at: [{ t: 0, v: BEFORE }], way: [-1, 0, 0] } },
  // her legs longer for her height: let further down onto the ground
  bodies: { woman: { move: [1, 1.25, 1] } },
};
/** Leant onto the right elbow from sat: turned over toward the right, the right hand down on the ground. */
const LEANT: KeyPose = merge(SAT, {
  rot: { pelvis: [-10, 0, 40], spine_01: [6, 0, -4], spine_02: [6, 0, -4], spine_03: [4, 0, -4], thigh_l: [90, 0, -10], thigh_r: [80, 0, -6], calf_l: [-100, 0, 0], calf_r: [-100, 0, 0] },
  move: [-0.02, -0.4, -0.15],
});
const SLEEP_DOWN_BEATS: Beat[] = [
  { t: 0, pose: STOOD, ease: 'inOut', name: 'stood' },
  { t: 0.55, pose: CROUCH, ease: 'inOut', name: 'crouched' },
  { t: 1.0, pose: SAT, ease: 'inOut', name: 'sat' },
  { t: 1.4, pose: LEANT, ease: 'inOut', name: 'leant over' },
  { t: 1.9, pose: LAIN, ease: 'inOut', name: 'lain' },
];
export const SLEEP_DOWN: Down = {
  name: 'sleep-down', loop: false, length: 1.9, mask: 'full', armsFree: true,
  ...poseToPose(SLEEP_DOWN_BEATS, { length: 1.9, loop: false }),
  plant: { rot: STANCE },
  planted: [{ t: 0, v: 1 }, { t: 1.0, v: 1 }, { t: 1.4, v: 0 }],
  bodies: { woman: { move: [1, 1.25, 1] } },
};
