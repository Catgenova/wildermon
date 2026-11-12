/**
 * H1, work with the hands and no tool: stood at a bench's height, bowed over what is worked a forearm's length ahead of
 * the belt, both hands on it near the middle, the head down on the hands; one hand pressed forward and down into it as
 * the trunk leans in behind it and the other holds, lifted back, then the other hand's press. Both feet planted, the
 * knees given on each press. The jobs done with no tool at waist height play it (`../index.ts` CLIP_OF_JOB): the
 * crafting from the pack and at a waist-high station, mending, sealing, dyeing, mixing, writing a scroll.
 *
 * The bow is taken from the hips and the spine, the neck kept nearly straight and the head pitched at the skull (the
 * shawl's and the hood's collars); the hands near the middle and ahead, where the first outfit's shawl parts round them
 * (its corrective shapes for a hand across the chest and for bending over, hands ahead).
 */
import type { Clip, Key } from '../clip';
import { merge, mirror, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** One run: the right hand's press, the left's, back to the right's. */
const LENGTH = 1.6;
const HALF = LENGTH / 2;
/** From a gather to its press, and the press's give after it lands: seconds. */
const PRESS = 0.36, GIVE = 0.14;

/**
 * The arms solved on him (the palm's middle, the fingers' way, the palm's face and the elbow aimed at), gathered for the
 * right hand's press (the right hand lifted back, the left holding) and pressed (the right hand forward and down, palm
 * down; the left turned down onto the far side).
 */
const ARMS_GATHER: Record<string, Euler> = {
  upperarm_r: [45.6, -46.6, 2.8], lowerarm_r: [58.8, 40.2, 0], hand_r: [-18.9, -60.1, 12.2],
  upperarm_l: [47.3, 46.4, -3], lowerarm_l: [53, -40.8, 0], hand_l: [-19, 62, -11.9],
};
const ARMS_PRESS: Record<string, Euler> = {
  upperarm_r: [59.9, -53, 3.7], lowerarm_r: [43.5, 34.5, 0], hand_r: [-16.3, -102.5, 11.1],
  upperarm_l: [51, 43.9, -1.8], lowerarm_l: [53, -40.4, 0], hand_l: [-19.7, 82.7, -11.5],
};
/** The same solved on her (her arms shorter for her height: the same reach, a shoulder's share of hers). */
const HER_GATHER: Record<string, Euler> = {
  upperarm_r: [48.6, -44.2, 2], lowerarm_r: [69.4, 41.5, 0], hand_r: [-6.8, -64.5, 12.4],
  upperarm_l: [50.2, 43.5, -2.3], lowerarm_l: [64.3, -41.4, 0], hand_l: [-5.6, 65.1, -12.4],
};
const HER_PRESS: Record<string, Euler> = {
  upperarm_r: [62.5, -48.6, 2.7], lowerarm_r: [55.8, 41.2, 0], hand_r: [0.6, -114.4, 12],
  upperarm_l: [54.1, 40.6, -1.1], lowerarm_l: [63.6, -41.3, 0], hand_l: [-4.4, 87.4, -12.1],
};

/** The fingers closed a little on what is held; the pressing hand's opened onto its heel. */
const HOLD: Record<string, Euler> = { fingers_01_l: [16, 0, 0], fingers_02_l: [22, 0, 0], fingers_01_r: [16, 0, 0], fingers_02_r: [22, 0, 0] };
const HEEL: Record<string, Euler> = { fingers_01_r: [4, 0, 0], fingers_02_r: [6, 0, 0] };

/** Gathered for the right hand's press: bowed over the work from the hips and the spine, the head down on the hands. */
const GATHER: KeyPose = merge({ rot: HOLD }, {
  rot: {
    ...ARMS_GATHER,
    pelvis: [5, 0, 0], spine_01: [5, 0, 0], spine_02: [6, 0, 0], spine_03: [5, 0, 0],
    neck_01: [3, 0, 0], neck_02: [2, 0, 0], head: [12, 0, 0],
  },
  move: [0, -0.004, 0],
});
/** The right hand's press: leant in behind it, the weight over to the right, the knees given, the head turned after the hand. */
const PRESSED: KeyPose = merge({ rot: HOLD }, {
  rot: {
    ...ARMS_PRESS, ...HEEL,
    pelvis: [7, 0, 0], spine_01: [6, 0, 0], spine_02: [8, 0, 0], spine_03: [6, 0, 0],
    neck_01: [3, 0, 0], neck_02: [2, 0, 0], head: [11, -6, 0],
  },
  move: [-0.004, -0.009, 0.003],
});
/** The press's give: sunk a little further into it, the head nodded. */
const GIVEN: KeyPose = merge(PRESSED, { rot: { spine_02: [9.5, 0, 0], head: [13, -6, 0] }, move: [-0.005, -0.012, 0.004] });

/** Her arms as turns added to his (`Clip.bodies.woman.tracks`), at the same beats. */
const herOf = (his: Record<string, Euler>, hers: Record<string, Euler>): KeyPose => ({ rot: Object.fromEntries(Object.keys(hers).map((b) => [b, [hers[b][0] - his[b][0], hers[b][1] - his[b][1], hers[b][2] - his[b][2]] as Euler])) });
const HER_G = herOf(ARMS_GATHER, HER_GATHER), HER_P = herOf(ARMS_PRESS, HER_PRESS);

/** The beats: each hand's gather and press the key poses, the give a breakdown. */
const beats = (g: KeyPose, p: KeyPose, given: KeyPose): Beat[] => [
  { t: 0, pose: g, ease: 'inOut', stage: 'key', name: 'gather right' },
  { t: PRESS, pose: p, ease: 'in', stage: 'key', name: 'press right' },
  { t: PRESS + GIVE, pose: given, ease: 'out', name: 'give right' },
  { t: HALF, pose: mirror(g), ease: 'inOut', stage: 'key', name: 'gather left' },
  { t: HALF + PRESS, pose: mirror(p), ease: 'in', stage: 'key', name: 'press left' },
  { t: HALF + PRESS + GIVE, pose: mirror(given), ease: 'out', name: 'give left' },
];
export const BEATS: Beat[] = beats(GATHER, PRESSED, GIVEN);
/** The hands trailing the forearms, the trunk the arms, the head the trunk: seconds each bone's keys are late. */
export const LAG = { hand_l: 0.03, hand_r: 0.03, pelvis: 0.01, spine_01: 0.02, spine_02: 0.03, spine_03: 0.04, neck_01: 0.06, neck_02: 0.07, head: 0.08 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });
const HER = poseToPose(beats(HER_G, HER_P, HER_P), { length: LENGTH, loop: true, lag: LAG }).tracks as Record<string, Array<Key<Euler>>>;

export const HANDS: Clip = {
  name: 'hands',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // stood as the idle stands, feet a little apart and turned out; hers closer together
  plant: { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } },
  breath: { count: 1, depth: 0.6 },
  ...KEYS,
  // a job's go fitted to its length by the gathers (the presses keep their speed)
  stretch: [[PRESS + GIVE, HALF], [HALF + PRESS + GIVE, LENGTH]],
  bodies: {
    // (the arms kept off the body by the clip's own turns: the forearms reach in to the work)
    // (his head pitched less: his jaw kept off the shawl's collar)
    man: { armsOut: -3, add: { head: [-3, 0, 0] } },
    woman: { armsOut: -3, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] }, tracks: HER },
  },
};
