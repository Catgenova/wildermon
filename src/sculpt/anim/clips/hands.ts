/**
 * H1, work with the hands and no tool: stood at a bench's height, both hands on what is worked a forearm's length ahead
 * of the belt and a shoulder's width apart, the head down over it; one hand pressed down and forward into it with the
 * trunk behind it as the other holds, both lifted back, then the other hand's press. Both feet planted, the knees given
 * on each press. The jobs done with no tool at waist height play it (`../index.ts` CLIP_OF_JOB): the crafting from the
 * pack and at a waist-high station, mending, sealing, dyeing, mixing, writing a scroll.
 *
 * The arms are kept where every outfit takes them: the upper arms forward no more than 28 degrees and turned in no more
 * than 14, the elbows bent no more than 70 (the first outfit's shawl hangs over the upper arms, the leather chest's
 * sleeves bunch at the elbow), the forearms straight ahead and the hands turned in at the wrist; the trunk leant without
 * a twist and the neck kept nearly straight, the head pitched at the skull (the shawl's and the hood's collars).
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
 * The arms gathered for the right hand's press (the right hand lifted back, the left on the work) and pressed (the right
 * arm reached forward and down, the left holding). The hands solved on him to face the work: the presser's palm down and
 * out to its side, then flat down; the holder's down and in.
 */
const ARMS_GATHER: Record<string, Euler> = {
  upperarm_r: [18, -10, -10], lowerarm_r: [70, 0, 0], hand_r: [-10.9, -43.8, 8.9],
  upperarm_l: [20, 13, 10], lowerarm_l: [64, 0, 0], hand_l: [-15.8, 42.1, -11.8],
};
const ARMS_PRESS: Record<string, Euler> = {
  upperarm_r: [28, -14, -11], lowerarm_r: [50, 0, 0], hand_r: [-31.8, -67.9, 16.5],
  upperarm_l: [21, 13, 10], lowerarm_l: [62, 0, 0], hand_l: [-23.3, 46.8, -13],
};
/** Her hands solved the same on her (the arms as his). */
const HER_GATHER: Record<string, Euler> = { hand_r: [-7.8, -45, 2], hand_l: [-12.7, 44.1, -4.8] };
const HER_PRESS: Record<string, Euler> = { hand_r: [-26.2, -70.8, 11.1], hand_l: [-19.6, 49.4, -6.3] };

/** The fingers closed a little on what is held; the pressing hand's opened onto its heel. */
const HOLD: Record<string, Euler> = { fingers_01_l: [16, 0, 0], fingers_02_l: [22, 0, 0], fingers_01_r: [16, 0, 0], fingers_02_r: [22, 0, 0] };
const HEEL: Record<string, Euler> = { fingers_01_r: [4, 0, 0], fingers_02_r: [6, 0, 0] };

/** Gathered for the right hand's press: leant a little over the work from the hips, the head down on the hands. */
const GATHER: KeyPose = merge({ rot: HOLD }, {
  rot: { ...ARMS_GATHER, head: [12, 0, 0] },
});
/** The right hand's press: leant in behind it from the hips, the weight over to the right, the knees given. */
const PRESSED: KeyPose = merge({ rot: HOLD }, {
  rot: { ...ARMS_PRESS, ...HEEL, head: [10, 0, 0] },
  move: [-0.005, -0.003, 0.002],
});
/** The press's give: sunk a little further into it. */
const GIVEN: KeyPose = merge(PRESSED, { rot: { lowerarm_r: [47, 0, 0], head: [12, 0, 0] }, move: [-0.006, -0.004, 0.002] });

/** Her hands as turns added to his (`Clip.bodies.woman.tracks`), at the same beats. */
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
    // (the arms kept off the body by the clip's own turns, as every outfit takes them)
    man: { armsOut: -3 },
    woman: { armsOut: -3, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] }, tracks: HER },
  },
};
