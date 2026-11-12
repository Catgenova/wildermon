/**
 * G1, work at the ground with both hands and no tool: knelt on both knees with the toes tucked under, bowed low over the
 * ground in front of the knees, the head down on the hands; one hand dug in and drawn back toward the knees as the other
 * lifts and comes forward over the spot, then the other's dig. The shoulders roll down after the digging hand, the head
 * turned after it. The knees and the balls of the feet planted throughout. The jobs done with no tool at the ground play
 * it (`../index.ts` CLIP_OF_JOB): planting and sowing, foraging and searching, the traps, picking up, at the water's
 * edge, at a campfire.
 *
 * The idle stands the feet where this does (`plant`), so the fade in and out of it (`../index.ts` SETTLE) is the
 * getting down and up: the heels rolled up off the ground about the balls of the feet as the knees come down.
 */
import type { Clip, Key } from '../clip';
import { merge, mirror, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** One run: the right hand's dig, the left's. */
const LENGTH = 1.4;
const HALF = LENGTH / 2;
/** From a hand over the spot to its dig landing, and the dig drawn back: seconds. */
const DIG = 0.3, DRAW = 0.45;
/** Each foot rolled up onto its toes about the ball, degrees (the toes kept flat on the ground). */
const TOES = 70;

/**
 * The arms solved on him (the palm's middle, the fingers' way and the palm's face) over the right hand's half: over the
 * spot (the left lifted from its dig), dug in (the left at the top of its lift), drawn back (the left over its spot).
 */
const ARMS_REACH: Record<string, Euler> = {
  upperarm_r: [43.8, 3.8, -13.7], lowerarm_r: [96.4, -21.1, 0], hand_r: [18.4, -53.3, 17.4],
  upperarm_l: [37, 6, 8.4], lowerarm_l: [77, 34.1, 0], hand_l: [6, 59.9, -29.4],
};
const ARMS_DIG: Record<string, Euler> = {
  upperarm_r: [47.6, 22.3, -21.5], lowerarm_r: [82.2, -26.2, 0], hand_r: [25, -59.8, 16],
  upperarm_l: [34.3, 15.4, 6.1], lowerarm_l: [100.4, 33.9, 0], hand_l: [11.8, 62.3, -27.8],
};
const ARMS_DRAW: Record<string, Euler> = {
  upperarm_r: [43.8, 8, -15.9], lowerarm_r: [68.7, -31.5, 0], hand_r: [11.1, -59.5, 24.1],
  upperarm_l: [45.3, 4.8, 6], lowerarm_l: [99.8, 31.4, 0], hand_l: [26.7, 66.2, -22.5],
};

/** Knelt: the thighs a little forward of upright, bowed from the hips and the spine, the shoulders let down, the head down on the ground ahead. */
const KNELT: KeyPose = {
  rot: {
    pelvis: [55, 0, 0], spine_01: [20, 0, 0], spine_02: [16, 0, 0], spine_03: [12, 0, 0], clavicle_l: [12, 0, 0], clavicle_r: [12, 0, 0], neck_01: [12, 0, 0], neck_02: [6, 0, 0], head: [18, 0, 0],
    thigh_l: [30, 0, -4], thigh_r: [30, 0, 4], calf_l: [-90, 0, 0], calf_r: [-90, 0, 0],
    fingers_01_l: [20, 0, 0], fingers_02_l: [30, 0, 0], fingers_01_r: [20, 0, 0], fingers_02_r: [30, 0, 0],
  },
  move: [0, -0.2786, 0.2303],
  feet: { l: { z: 0, lift: 0, pitch: -TOES }, r: { z: 0, lift: 0, pitch: -TOES } },
};
/** The right hand over its spot. */
const REACH: KeyPose = merge(KNELT, { rot: { ...ARMS_REACH,  } });
/** The right hand's dig: the shoulders rolled down after it, the head turned to it. */
const DUG: KeyPose = merge(KNELT, { rot: { ...ARMS_DIG, spine_02: [17, 4, 0], spine_03: [13, 4, 0], head: [18, -6, 0] } });
/** The dig drawn back toward the knees. */
const DRAWN: KeyPose = merge(KNELT, { rot: { ...ARMS_DRAW, spine_02: [16, 2, 0], spine_03: [12, 2, 0], head: [18, -4, 0] } });

/** Her arms as turns added to his (`Clip.bodies.woman.tracks`), at the same beats. */
const HER_REACH: Record<string, Euler> = {"upperarm_r":[36,8.6,11.9],"lowerarm_r":[-16.9,-14.2,0],"hand_r":[14.1,-0.6,-10.8],"upperarm_l":[32.6,-24,-6.1],"lowerarm_l":[-14.9,6.2,0],"hand_l":[12.6,8.7,29.1]};
const HER_DIG: Record<string, Euler> = {"upperarm_r":[43.8,12.5,20.7],"lowerarm_r":[-19.4,-18.8,0],"hand_r":[15,-6.5,-16.2],"upperarm_l":[31.9,-20.7,-1.1],"lowerarm_l":[-10.5,7.6,0],"hand_l":[17.7,-0.9,30.7]};
const HER_DRAW: Record<string, Euler> = {"upperarm_r":[37.4,27.1,13.8],"lowerarm_r":[-17.5,-11.4,0],"hand_r":[12.8,-11.5,-23.6],"upperarm_l":[37,-16.4,-4.1],"lowerarm_l":[-19.3,9.6,0],"hand_l":[17.9,-5.9,30.5]};

/** The beats: each hand's reach and dig the key poses, the draw a breakdown. */
const beats = (reach: KeyPose, dug: KeyPose, drawn: KeyPose): Beat[] => [
  { t: 0, pose: reach, ease: 'inOut', stage: 'key', name: 'over the spot, right' },
  { t: DIG, pose: dug, ease: 'in', stage: 'key', name: 'dig right' },
  { t: DRAW, pose: drawn, ease: 'out', name: 'drawn back, right' },
  { t: HALF, pose: mirror(reach), ease: 'inOut', stage: 'key', name: 'over the spot, left' },
  { t: HALF + DIG, pose: mirror(dug), ease: 'in', stage: 'key', name: 'dig left' },
  { t: HALF + DRAW, pose: mirror(drawn), ease: 'out', name: 'drawn back, left' },
];
export const BEATS: Beat[] = beats(REACH, DUG, DRAWN);
/** The hands trailing the forearms, the shoulders the hands, the head the shoulders: seconds each bone's keys are late. */
export const LAG = {hand_l: 0.03, hand_r: 0.03, spine_02: 0.03, spine_03: 0.04, neck_01: 0.06, neck_02: 0.07, head: 0.08};
const { footKeys, ...KEYS } = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });
const HER = poseToPose(beats({ rot: HER_REACH }, { rot: HER_DIG }, { rot: HER_DRAW }), { length: LENGTH, loop: true, lag: LAG }).tracks as Record<string, Array<Key<Euler>>>;

export const GROUND: Clip = {
  name: 'ground',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // the feet where the idle stands them (so the fade in and out of it keeps them put), rolled up onto the toes
  plant: { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } },
  feet: { stride: 1, ...(footKeys as NonNullable<typeof footKeys>) },
  breath: { count: 1, depth: 0.5 },
  ...KEYS,
  // a job's go fitted to its length by each hand's wait over its spot
  stretch: [[DRAW, HALF], [HALF + DRAW, LENGTH]],
  bodies: {
    // (the arms kept off the body by the clip's own turns)
    man: { armsOut: -3 },
    // her shins longer for her height: further down and forward to put her knees on the ground; her feet closer together, as the idle stands them
    woman: { armsOut: -3, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] }, move: [1, 1.2042, 1.3574], tracks: HER },
  },
};
