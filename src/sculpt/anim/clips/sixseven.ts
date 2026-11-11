/**
 * G1, the "6 7" gesture: both elbows bent, the hands out at chest height palms up, one forearm lifted from the elbow
 * as the other drops, then swapped, over and over; the shoulders and trunk tilted after the higher hand, the head bobbed
 * on each swap, the legs stood still. Both feet planted. Also the placeholder clip for every state with no clip of its
 * own (`../index.ts` PLACEHOLDER).
 */
import type { Clip } from '../clip';
import { merge, mirror, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** One run: the right hand up, the left up, back to the right. */
const LENGTH = 0.6;
const HALF = LENGTH / 2;

/**
 * The left arm with its hand up and with its hand down, solved on him: the elbow out from the side (about a fifth of his
 * height from the pelvis across, a seventh up), the wrist ahead of it and out, the palm up and the hand along the forearm.
 * Up: the forearm lifted 44 degrees further from the elbow, the wrist turned back to keep the palm up.
 */
const UP: Record<string, Euler> = { upperarm_l: [25, -59, 32], lowerarm_l: [93, 0, 0], hand_l: [48, 153, 22] };
const DOWN: Record<string, Euler> = { upperarm_l: [26, -39, 24], lowerarm_l: [49, 0, 0], hand_l: [7, 173, 5] };

/** Both hands open: the fingers straight. */
const OPEN: KeyPose = {
  rot: {
    fingers_01_l: [0, 0, 0], fingers_01_r: [0, 0, 0],
    fingers_02_l: [0, 0, 0], fingers_02_r: [0, 0, 0],
  },
};

/** The left hand up, the right down: the left shoulder lifted and the trunk tilted after it, the head kept near level. */
const LEFT: KeyPose = merge(OPEN, { rot: UP }, mirror({ rot: DOWN }), {
  rot: {
    spine_01: [0, 1, 1.2], spine_02: [0, 1.5, 1.6], spine_03: [0, 1.5, 2],
    clavicle_l: [0, 0, 3], clavicle_r: [0, 0, 0],
    neck_01: [0, 0, -2], head: [0, 2, -1.5],
  },
});
const RIGHT = mirror(LEFT);

/** The beats: each hand's top a key pose, half a run apart. */
export const BEATS: Beat[] = [
  { t: 0, pose: RIGHT, ease: 'inOut', stage: 'key', name: 'right up' },
  { t: HALF, pose: LEFT, ease: 'inOut', stage: 'key', name: 'left up' },
];
/** The hands trailing the forearms, the trunk and head trailing the hands: seconds each bone's keys are late. */
export const LAG = { hand_l: 0.025, hand_r: 0.025, spine_01: 0.03, spine_02: 0.035, spine_03: 0.04, clavicle_l: 0.02, clavicle_r: 0.02, neck_01: 0.05, head: 0.06 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });

/** The head's bob: dipped as each hand tops out, back up as the hands pass. */
const BOB: Euler = [3, 0, 0];
const bob = (): Clip['accents'] => {
  const keys = [0, HALF].flatMap((t0) => [{ t: t0 + 0.04, v: BOB, ease: 'out' as const }, { t: t0 + 0.2, v: [0, 0, 0] as Euler, ease: 'inOut' as const }]);
  return { head: keys, neck_01: keys.map((k) => ({ ...k, t: k.t - 0.02, v: [k.v[0] / 2, 0, 0] as Euler })) };
};

export const SIXSEVEN: Clip = {
  name: 'sixseven',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // stood as the idle stands, feet a little apart and turned out; hers closer together
  plant: { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } },
  ...KEYS,
  accents: bob(),
  bodies: {
    // his elbows lower and nearer his sides: the forearms clear of the first outfit's shawl, whose cape hangs to his elbows
    man: { add: { upperarm_l: [-20, 0, -10], upperarm_r: [-20, 0, 10] } },
    woman: { add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] } },
  },
};
