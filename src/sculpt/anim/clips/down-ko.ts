/**
 * K1, knocked down: a body whose health has reached nought (`FigurePose.down`, `../../../game/fell.ts`) lain where it fell
 * (`ko`), with its own way down (`ko-down`, `../down.ts`): the knees buckling under it, down onto them, the trunk folding
 * forward, toppled over onto its right side and lain there slack, the arms let go where they fell. Played backward, the
 * way down is the getting up as the body wakes (pushed up off the ground onto the knees, stood).
 *
 * Lain (`ko`): on the right side rolled a little onto the front, the head on the ground on its right cheek, the right arm
 * out ahead on the ground under it, the left over the body in front of the chest; the top leg drawn forward at the hip
 * and the knee, the under one near straight; a shallow breath a run, the eyes shut (`../down.ts` eyesShut).
 */
import type { Clip } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import { downInto, type Down } from '../down';
import { FALL_SECS } from '../../../game/fell';

/** Where the idle stands the feet (`./idle.ts` plant): the way down keeps them there while it says. */
const STANCE: Record<string, Euler> = { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] };
/** The arms hanging, the hands loose, as the idle's. */
const HANG: Record<string, Euler> = {
  upperarm_l: [-2, 0, 2], upperarm_r: [-2, 0, -2], lowerarm_l: [12, 0, 0], lowerarm_r: [12, 0, 0], hand_l: [0, -50, 0], hand_r: [0, 50, 0],
  fingers_01_l: [12, 0, 0], fingers_01_r: [12, 0, 0], fingers_02_l: [18, 0, 0], fingers_02_r: [18, 0, 0],
};
/** Slack fingers, half curled. */
const SLACK: Record<string, Euler> = { fingers_01_l: [20, 0, 0], fingers_01_r: [20, 0, 0], fingers_02_l: [25, 0, 0], fingers_02_r: [25, 0, 0] };
/** Stood as the idle stands. */
const STOOD: KeyPose = { rot: { ...STANCE, ...HANG } };
/** Gone slack: the knees giving, the hips dropping, the head falling forward, the arms hanging dead. */
const BUCKLE: KeyPose = {
  rot: {
    ...SLACK,
    pelvis: [12, 0, -3], spine_01: [6, 0, 0], spine_02: [8, 0, 2], spine_03: [8, 0, 2], neck_01: [14, 0, 0], neck_02: [8, 0, 0], head: [12, 0, 4],
    thigh_l: [38, -3, 6], thigh_r: [42, 3, -6], calf_l: [-62, 0, 0], calf_r: [-70, 0, 0], foot_l: [10, 0, 0], foot_r: [12, 0, 0],
    upperarm_l: [8, 0, 6], upperarm_r: [6, 0, -4], lowerarm_l: [10, 0, 0], lowerarm_r: [8, 0, 0], hand_l: [0, -40, 0], hand_r: [0, 40, 0],
  },
  move: [0, -0.12, -0.02],
};
/** Down on both knees, sat back a little toward the heels, the trunk folded forward over them, the head hanging. */
const KNEES: KeyPose = {
  rot: {
    ...SLACK,
    pelvis: [26, 0, -6], spine_01: [10, 0, -2], spine_02: [12, 0, -3], spine_03: [10, 0, -2], neck_01: [18, 0, 0], neck_02: [10, 0, 0], head: [16, 0, 6],
    thigh_l: [42, -3, 8], thigh_r: [40, 3, -6], calf_l: [-106, 0, 0], calf_r: [-104, 0, 0], foot_l: [-55, 0, 0], foot_r: [-55, 0, 0],
    upperarm_l: [16, 0, 8], upperarm_r: [22, 0, -6], lowerarm_l: [14, 0, 0], lowerarm_r: [12, 0, 0], hand_l: [0, -40, 0], hand_r: [0, 40, 0],
  },
  move: [0, -0.3, -0.02],
};
/** Going over onto the right side: the hips turning over, the trunk pitched forward and down, the right arm thrown out to it. */
const TOPPLE: KeyPose = {
  rot: {
    ...SLACK,
    pelvis: [30, 0, 48], spine_01: [10, 0, -6], spine_02: [12, 0, -6], spine_03: [8, 0, -4], neck_01: [10, 0, -4], neck_02: [6, 0, -4], head: [8, 0, -6],
    thigh_l: [30, -3, -12], thigh_r: [24, 3, -10], calf_l: [-100, 0, 0], calf_r: [-90, 0, 0], foot_l: [-20, 0, 0], foot_r: [-20, 0, 0],
    upperarm_l: [40, 0, 8], upperarm_r: [80, 0, -20], lowerarm_l: [24, 0, 0], lowerarm_r: [16, 0, 0], hand_l: [0, -30, 0], hand_r: [0, 50, 0],
  },
  move: [-0.06, -0.33, 0.06],
};
/** Lain on the right side, rolled a little onto the front; the head on its right cheek; the arms and legs let go where they fell. */
const LAIN: KeyPose = {
  rot: {
    ...SLACK,
    pelvis: [6, 0, 96], spine_01: [3, 0, -4], spine_02: [3, 0, -4], spine_03: [2, 0, -4], neck_01: [-2, 0, -8], neck_02: [-2, 0, -8], head: [-4, 10, -10],
    thigh_l: [52, 0, -22], thigh_r: [14, 0, -4], calf_l: [-72, 0, 0], calf_r: [-24, 0, 0], foot_l: [-20, 0, 6], foot_r: [-24, 0, 4],
    upperarm_l: [62, 0, -12], upperarm_r: [130, 0, 4], lowerarm_l: [26, 0, 0], lowerarm_r: [20, 0, 0], hand_l: [0, -20, 0], hand_r: [0, 60, 0],
  },
  move: [-0.02, -0.4, 0.02],
};

/** One shallow breath, seconds: a run. */
const BREATH = 4.5;
export const KO: Clip = {
  name: 'ko', loop: true, length: BREATH, mask: 'full',
  ...poseToPose([{ t: 0, pose: LAIN, ease: 'inOut', stage: 'key', name: 'lain' }], { length: BREATH, loop: true }),
  breath: { count: 1, depth: 0.8 },
  armsFree: true,
  // her legs longer for her height: let further down onto the ground
  bodies: { woman: { move: [1, 1.22, 1] } },
};

/** The way down: buckled, on the knees, toppled over, lain. Played backward it is the getting up. */
const DOWN_BEATS: Beat[] = [
  { t: 0, pose: STOOD, ease: 'inOut', name: 'stood' },
  { t: 0.22, pose: BUCKLE, ease: 'in', name: 'buckled' },
  { t: 0.5, pose: KNEES, ease: 'in', name: 'on the knees' },
  { t: 0.78, pose: TOPPLE, ease: 'in', name: 'toppling' },
  { t: 1.0, pose: merge(LAIN, { rot: {}, move: [-0.02, -0.405, 0.02] }), ease: 'out', name: 'down' },
  { t: FALL_SECS, pose: LAIN, ease: 'inOut', name: 'lain' },
];
export const KO_DOWN: Down = {
  name: 'ko-down', loop: false, length: FALL_SECS, mask: 'full', armsFree: true,
  ...poseToPose(DOWN_BEATS, { length: FALL_SECS, loop: false }),
  plant: { rot: STANCE },
  planted: [{ t: 0, v: 1 }, { t: 0.3, v: 1 }, { t: 0.5, v: 0 }],
  bodies: { woman: { move: [1, 1.22, 1] } },
};

downInto('ko', KO_DOWN);
