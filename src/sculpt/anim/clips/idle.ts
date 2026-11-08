/**
 * I1, the idle stand: weight settled on one leg, shifted across to the other and back, a look to the side on the way,
 * breathing in the chest and shoulders throughout. Both feet planted.
 */
import type { Clip } from '../clip';
import { merge, mirror, poseToPose, type Beat, type KeyPose } from '../author';

const LENGTH = 6;

/** The arms hanging relaxed, the hands loose and empty. */
const ARMS: KeyPose = {
  rot: {
    upperarm_l: [-2, 0, 2], upperarm_r: [-2, 0, -2],
    lowerarm_l: [12, 0, 0], lowerarm_r: [12, 0, 0],
    hand_l: [0, -50, 0], hand_r: [0, 50, 0],
    fingers_01_l: [12, 0, 0], fingers_01_r: [12, 0, 0],
    fingers_02_l: [18, 0, 0], fingers_02_r: [18, 0, 0],
  },
};

/** Weight on the left leg: the hips out over it, the right hip dropped and that knee bent, the shoulders tilted against the hips. */
const LEFT: KeyPose = merge(ARMS, {
  rot: {
    pelvis: [0, 6, 3],
    spine_01: [0, -2, -4], spine_02: [-1, -2.5, -5], spine_03: [-2, -2, -5],
    neck_01: [2, 0, 4], neck_02: [1, 0, 3], head: [-2, 0, 4],
    thigh_l: [0, -3, 0], calf_l: [-14, 0, 0],
    thigh_r: [5, 4, 2], calf_r: [-30, 0, 0],
    // the arms hanging plumb as the shoulders tilt, the one over the hip pushed out kept clear of it
    upperarm_l: [-2, 0, 14], upperarm_r: [-3, 0, 6],
    lowerarm_l: [10, 0, 0], lowerarm_r: [16, 0, 0],
  },
  move: [0.022, 0, 0],
});
const RIGHT = mirror(LEFT);
/** Settled further into the stance over a hold, so the hold is not dead. */
const settle = (p: KeyPose): KeyPose => merge(p, { rot: { pelvis: [0, (p.rot.pelvis?.[1] ?? 0) * 1.2, (p.rot.pelvis?.[2] ?? 0) * 1.15] }, move: [(p.move?.[0] ?? 0) * 1.04, -0.003, 0] });
/** Gathered before the shift: dipped, leant a little forward, pushed further over the leg it is leaving, the arms back. */
const gather = (p: KeyPose): KeyPose => merge(p, {
  rot: { spine_02: [5, (p.rot.spine_02?.[1] ?? 0), (p.rot.spine_02?.[2] ?? 0)], neck_01: [-2, 0, (p.rot.neck_01?.[2] ?? 0)], upperarm_l: [-8, 0, p.rot.upperarm_l?.[2] ?? 0], upperarm_r: [-8, 0, p.rot.upperarm_r?.[2] ?? 0] },
  move: [(p.move?.[0] ?? 0) * 1.1, -0.012, 0],
});

/** The hips and legs arrive without overshooting (the hip crease is at its limit there); the trunk, head and arms overshoot. */
const HIPS = { $move: { ease: 'out' as const }, pelvis: { ease: 'out' as const }, thigh_l: { ease: 'out' as const }, thigh_r: { ease: 'out' as const }, calf_l: { ease: 'out' as const }, calf_r: { ease: 'out' as const } };

/** The beats, in order: the two weights are the key poses, the settles and gathers the breakdowns between them. */
export const BEATS: Beat[] = [
    { t: 0, pose: LEFT, ease: 'back', back: 0.2, per: HIPS, stage: 'key', name: 'weight left' },
    { t: 1.7, pose: settle(LEFT), ease: 'inOut', name: 'settled left' },
    { t: 2.05, pose: gather(LEFT), ease: 'inOut', name: 'gather' },
    { t: 2.55, pose: RIGHT, ease: 'back', back: 0.2, per: HIPS, stage: 'key', name: 'weight right' },
    { t: 5.0, pose: settle(RIGHT), ease: 'inOut' },
    { t: 5.4, pose: gather(RIGHT), ease: 'inOut', name: 'gather back' },
];
/** The arms trailing the hips, the head the neck: seconds each bone's keys are late. */
export const LAG = { upperarm_l: 0.1, upperarm_r: 0.1, lowerarm_l: 0.16, lowerarm_r: 0.16, head: 0.06, neck_02: 0.03 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });

export const IDLE: Clip = {
  name: 'idle',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // feet a little apart and turned out, flat; hers closer together
  plant: { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } },
  breath: { count: 3, depth: 1 },
  ...KEYS,
  // a roll of the free shoulder in the first hold: dropped, rolled up and forward, back, popped down
  accents: {
    clavicle_r: [{ t: 0, v: [0, 0, 0] }, { t: 0.5, v: [0, 0, 0] }, { t: 0.64, v: [0, 0, 2] }, { t: 0.86, v: [-3, 0, -6], ease: 'back' }, { t: 1.1, v: [3, 0, -5] }, { t: 1.4, v: [0, 0, 0], ease: 'out' }],
    upperarm_r: [{ t: 0, v: [0, 0, 0] }, { t: 0.55, v: [0, 0, 0] }, { t: 0.7, v: [0, 0, 1] }, { t: 0.92, v: [3, 0, -3], ease: 'back' }, { t: 1.16, v: [-2, 0, -3] }, { t: 1.48, v: [0, 0, 0], ease: 'out' }],
  // the look to the side over the weight on the right: down and away first, snapped round, held, popped back
    neck_01: [{ t: 0, v: [0, 0, 0] }, { t: 3.2, v: [0, 0, 0] }, { t: 3.42, v: [3, -6, 0] }, { t: 3.68, v: [-1, 32, 0], ease: 'back', back: 0.12 }, { t: 4.38, v: [-1, 34, 0] }, { t: 4.68, v: [0, 0, 0], ease: 'hold', hold: 0.35 }],
    neck_02: [{ t: 0, v: [0, 0, 0] }, { t: 3.22, v: [0, 0, 0] }, { t: 3.44, v: [1, -1, 0] }, { t: 3.7, v: [0, 4, 0], ease: 'back' }, { t: 4.4, v: [0, 4, 0] }, { t: 4.7, v: [0, 0, 0], ease: 'hold', hold: 0.35 }],
    head: [{ t: 0, v: [0, 0, 0] }, { t: 3.25, v: [0, 0, 0] }, { t: 3.46, v: [3, 0, 0] }, { t: 3.72, v: [-2, 2, -3], ease: 'back' }, { t: 4.42, v: [-2, 2, -3] }, { t: 4.72, v: [0, 0, 0], ease: 'hold', hold: 0.35 }],
  },
  bodies: {
    woman: { armsOut: 0.07, scale: { clavicle_r: 0.6 }, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6], upperarm_l: [0, 0, 4], upperarm_r: [0, 0, -4], lowerarm_l: [4, 0, 0], lowerarm_r: [4, 0, 0] } },
  },
};
