/**
 * L1, the walk: on the spot, the game carrying the body forward, a whole stride (the left foot down and up and the right)
 * at the body's own length, played as fast as the game's walking pace carries it over that ground (`../index.ts`
 * walkTime). Each foot is keyed where it goes (`Clip.feet`): on the ground from the heel strike
 * to the toe leaving it, going back at the pace the game carries the body forward; in the air, peeled up behind, its knee
 * lifted through and the heel reached out ahead for the next, each foot on a line under its own hip. Over them the hips
 * bob and sway and turn with the leading leg, the chest held up and the shoulders turned against them, the arms swinging
 * from the shoulders against the legs, the forearms trailing, and the head kept level.
 */
import type { Clip, Foot } from '../clip';
import { merge, mirror, mirrorPer, poseToPose, type Beat, type KeyPose } from '../author';
import { BASE_SPEED } from '../../../game/player';
import { UNITS_PER_TILE } from '../../../render/iso';

/**
 * The ground a planted foot goes back over in a whole stride, the game's units: his, and hers. A full step for each
 * body's legs (his three-quarters of his leg's length; hers a touch shorter for her build, which sinks lower over a longer
 * one); the game's own walk takes 10.25.
 */
export const STRIDE = { man: 12, woman: 11.0 };
/** Seconds his whole stride takes at the game's walking pace (hers a little longer, played at her own rate). */
const LENGTH = STRIDE.man / (BASE_SPEED * UNITS_PER_TILE);
/** How much of a stride each foot is on the ground: both are down for the first `DOWN - 0.5` of each step. */
const DOWN = 0.54;
/** How far ahead of where it stands a foot's heel comes down, in strides; it goes back `DOWN` of a stride from there. */
const REACH = 0.36;

/**
 * One foot through its own stride, from its heel strike (0): on the ground going back a stride a stride, rolled from the
 * heel onto the flat and up onto the toes; then peeled up behind, carried through and reached out ahead. Keyed at the
 * beats' times (`u`, the foot's share of its stride).
 */
const FOOT: Array<[number, Foot]> = [
  [0, { z: REACH, lift: 0, pitch: 24 }],
  [DOWN - 0.5, { z: REACH - DOWN + 0.5, lift: 0, pitch: 12 }],
  [0.12, { z: REACH - 0.12, lift: 0, pitch: 0 }],
  [0.25, { z: REACH - 0.25, lift: 0, pitch: 0 }],
  [0.37, { z: REACH - 0.37, lift: 0, pitch: -16 }],
  [0.5, { z: REACH - 0.5, lift: 0, pitch: -34 }],
  [DOWN, { z: REACH - DOWN, lift: 0, pitch: -40 }],
  [0.62, { z: REACH - DOWN - 0.027, lift: 0.03, pitch: -50 }],
  [0.75, { z: 0.04, lift: 0.055, pitch: -15 }],
  [0.87, { z: REACH + 0.03, lift: 0.03, pitch: 18 }],
];
const footAt = (u: number): Foot => { const w = ((u % 1) + 1) % 1; return (FOOT.find(([at]) => Math.abs(at - w) < 1e-6 || Math.abs(at - w + 1) < 1e-6) as [number, Foot])[1]; };

/** The arms loose, the hands hanging empty, the fingers curled a little. */
const HANDS: KeyPose = {
  rot: {
    hand_l: [0, -50, 0], hand_r: [0, 50, 0],
    fingers_01_l: [14, 0, 0], fingers_01_r: [14, 0, 0],
    fingers_02_l: [20, 0, 0], fingers_02_r: [20, 0, 0],
  },
};

/*
 * The four key poses of the left foot's step, the right's their mirror. The hips turn with the leading leg (ry: to the
 * body's left, so -6 is the left hip forward) and drop on the side of the leg in the air (rz: the left hip up); the spine
 * turns the shoulders the other way, the neck takes it back so the head looks ahead.
 */
/** Contact: the left heel down out ahead, the right on its toes behind; the right arm forward. */
const CONTACT: KeyPose = merge(HANDS, {
  rot: {
    pelvis: [0, -10, -1],
    spine_01: [2, 6, 1], spine_02: [-1, 6, 1], spine_03: [-2, 7, 0],
    neck_01: [2, -6, 0], neck_02: [0, -2, 0], head: [0, -1, 0],
    thigh_l: [24, 0, 0], calf_l: [-4, 0, 0], thigh_r: [-16, 0, 0], calf_r: [-24, 0, 0],
    upperarm_r: [36, 0, -3], lowerarm_r: [18, 0, 0],
    upperarm_l: [-28, 0, 3], lowerarm_l: [6, 0, 0],
  },
  move: [-0.002, -0.025, 0],
});
/** Down: the weight taken on the bent left knee, the body at its lowest, the right hip dropped; the arms at their ends. */
const DOWNP: KeyPose = merge(HANDS, {
  rot: {
    pelvis: [1, -6, 3],
    spine_01: [3, 4, -2], spine_02: [1, 4, -2], spine_03: [-1, 4, -2],
    neck_01: [0, -4, 0], neck_02: [0, -1, 0], head: [3, -1, 0],
    thigh_l: [18, 0, 0], calf_l: [-20, 0, 0], thigh_r: [-12, 0, 0], calf_r: [-60, 0, 0],
    upperarm_r: [34, 0, -3], lowerarm_r: [22, 0, 0],
    upperarm_l: [-26, 0, 3], lowerarm_l: [8, 0, 0],
  },
  move: [0.009, -0.027, 0],
});
/** Passing: the right foot carried by under the body, the body over the left foot and rising. */
const PASSING: KeyPose = merge(HANDS, {
  rot: {
    pelvis: [0, 0, 2],
    spine_01: [2, 0, -1], spine_02: [-1, 0, -1], spine_03: [-2, 0, -1],
    neck_01: [2, 0, 0], neck_02: [0, 0, 0], head: [0, 0, 0],
    thigh_l: [0, 0, 0], calf_l: [-6, 0, 0], thigh_r: [12, 0, 0], calf_r: [-70, 0, 0],
    upperarm_r: [4, 0, -3], lowerarm_r: [18, 0, 0],
    upperarm_l: [-4, 0, 3], lowerarm_l: [16, 0, 0],
  },
  move: [0.014, 0, 0],
});
/** Up: pushed up onto the left toes, the body at its highest, the right leg reaching out ahead. */
const UP: KeyPose = merge(HANDS, {
  rot: {
    pelvis: [-1, 6, 1],
    spine_01: [2, -4, 0], spine_02: [-2, -4, 0], spine_03: [-3, -4, 0],
    neck_01: [3, 4, 0], neck_02: [0, 1, 0], head: [0, 0, 0],
    thigh_l: [-12, 0, 0], calf_l: [-6, 0, 0], thigh_r: [24, 0, 0], calf_r: [-30, 0, 0],
    upperarm_r: [-16, 0, -3], lowerarm_r: [8, 0, 0],
    upperarm_l: [22, 0, 3], lowerarm_l: [14, 0, 0],
  },
  move: [0.006, 0.006, 0],
});
/** Toe off (a breakdown): the right toes leaving the ground behind as the left foot comes down flat. */
const TOE_OFF: KeyPose = merge(CONTACT, {
  rot: { pelvis: [0, -8, 2], thigh_r: [-14, 0, 0], calf_r: [-40, 0, 0] },
  move: [0.002, -0.028, 0],
});

/** Taking the weight: the arms swung to their ends and the chest dipped past the pose and settled back (overshoot). */
const SETTLE = { upperarm_l: { ease: 'back' as const, back: 0.2 }, upperarm_r: { ease: 'back' as const, back: 0.2 }, spine_02: { ease: 'back' as const, back: 0.25 }, head: { ease: 'back' as const, back: 0.3 } };
/** The feet's channels: on the ground at an even pace (z linear), in the air eased. */
const ON = { ease: 'linear' as const };
/** One step's beats, from the left heel strike, with each foot where it is at that moment of its own stride. */
const STEP: Array<Omit<Beat, 'pose'> & { pose: KeyPose; u: number }> = [
  { u: 0, t: 0, pose: CONTACT, ease: 'inOut', stage: 'key', name: 'contact', per: { $z_l: { ease: 'out' }, $z_r: ON, $pitch_l: { ease: 'out' } } },
  { u: DOWN - 0.5, t: 0, pose: TOE_OFF, ease: 'inOut', name: 'toe off', per: { $z_l: ON, $z_r: ON, $move: { ease: 'out' } } },
  { u: 0.12, t: 0, pose: DOWNP, ease: 'out', stage: 'key', name: 'down', per: { $z_l: ON, $z_r: { ease: 'out' }, $lift_r: { ease: 'out' }, $pitch_l: { ease: 'out' }, ...SETTLE } },
  { u: 0.25, t: 0, pose: PASSING, ease: 'inOut', stage: 'key', name: 'passing', per: { $z_l: ON, $z_r: { ease: 'inOut' } } },
  { u: 0.37, t: 0, pose: UP, ease: 'inOut', stage: 'key', name: 'up', per: { $z_l: ON, $z_r: { ease: 'inOut' } } },
];
/** The whole stride: the left step, then the right step its mirror half a stride on. */
export const BEATS: Beat[] = [0, 1].flatMap((side) => STEP.map(({ u, pose, per, name, ...b }): Beat => {
  const at = u + side / 2, p = side ? mirror(pose) : pose;
  return { ...b, t: +(at * LENGTH).toFixed(4), pose: { ...p, feet: { l: footAt(at), r: footAt(at - 0.5) } }, per: side ? mirrorPer(per) : per, ...(name ? { name: `${name} ${side ? 'right' : 'left'}` } : {}) };
}));
/** The arms trailing the shoulders, the forearms the upper arms, the head the neck: seconds each bone's keys are late. */
export const LAG = { upperarm_l: 0.03, upperarm_r: 0.03, lowerarm_l: 0.055, lowerarm_r: 0.055, hand_l: 0.07, hand_r: 0.07, head: 0.03, neck_02: 0.015 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });

export const WALK: Clip = {
  name: 'walk',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // the feet a little turned out
  plant: { rot: { thigh_l: [0, -2, 0], thigh_r: [0, 2, 0] } },
  tracks: KEYS.tracks,
  move: KEYS.move,
  poses: KEYS.poses,
  // the shoulders dropped as the weight lands on each foot and lifted as the body goes up over it
  accents: {
    clavicle_l: [{ t: 0, v: [0, 0, 0] }, { t: 0.12 * LENGTH, v: [0, 0, -2.5], ease: 'out' }, { t: 0.37 * LENGTH, v: [0, 0, 1.5] }, { t: 0.5 * LENGTH, v: [0, 0, 0] }, { t: 0.62 * LENGTH, v: [0, 0, -2.5], ease: 'out' }, { t: 0.87 * LENGTH, v: [0, 0, 1.5] }],
    clavicle_r: [{ t: 0, v: [0, 0, 0] }, { t: 0.12 * LENGTH, v: [0, 0, 2.5], ease: 'out' }, { t: 0.37 * LENGTH, v: [0, 0, -1.5] }, { t: 0.5 * LENGTH, v: [0, 0, 0] }, { t: 0.62 * LENGTH, v: [0, 0, 2.5], ease: 'out' }, { t: 0.87 * LENGTH, v: [0, 0, -1.5] }],
  },
  feet: { stride: STRIDE.man, ...(KEYS.footKeys as NonNullable<typeof KEYS.footKeys>) },
  // his feet each under his hip and his sway halved (his crotch's faces cross as a thigh comes in under the body); her
  // feet nearer the middle, her hips swung and turned further, her arms further out to clear her hips
  bodies: {
    man: { armsOut: 0.06, move: [0.5, 1, 1], scale: { pelvis: [1, 1, 0.5] }, feet: { in: 0.016, stride: STRIDE.man }, add: { upperarm_l: [0, 0, 3], upperarm_r: [0, 0, -3] } },
    woman: { armsOut: 0.11, feet: { in: 0.05, stride: STRIDE.woman }, scale: { pelvis: 1.4 }, add: { upperarm_l: [0, 0, 4], upperarm_r: [0, 0, -4] } },
  },
};
