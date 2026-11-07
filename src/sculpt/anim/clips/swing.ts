/**
 * S1, the two-handed overhead swing: a heavy blade (the long sword, as long as she is tall) brought down overhead in both
 * hands; the work clip for mining too, whatever is held. Both hands on the grip (`Clip.grip`): the right arm keyed, its
 * fist the lead under the guard, the left reached onto the grip below it, the point kept off the ground.
 *
 * Braced, feet apart and the left ahead, the blade up before the face; lifted up past the face and over the head, the
 * weight going back and the back arching, the blade dropping behind the back; held at the top; brought down fast, the
 * hands leading and the blade whipping over after them, the trunk bending into it and the knees giving, the point stopped
 * at the ground (the `impact` event); the body carried on past and rebounding; lifted back to the guard. Both feet
 * planted. Fitted to an action's length by stretching the two holds (`Clip.stretch`: the guard and the top), never the
 * blow.
 */
import type { Clip, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

const LENGTH = 1.5;
/** The point reaching the ground, seconds in. */
export const IMPACT = 0.9;

/** Both fists closed (the held prop's own curl replaces this when it gives one). */
const FISTS: KeyPose = {
  rot: {
    fingers_01_l: [70, 0, 0], fingers_01_r: [70, 0, 0],
    fingers_02_l: [80, 0, 0], fingers_02_r: [80, 0, 0],
  },
};

/** The trunk, head and stance at each key, before the arms. */
export const TRUNK: Record<string, KeyPose> = {
  /** On guard: crouched a little, leant to the work, the head down to it. */
  ready: {
    rot: {
      pelvis: [4, -6, 0], spine_01: [3, 2, 0], spine_02: [3, 2, 0], spine_03: [2, 2, 0],
      neck_01: [-3, 0, 0], neck_02: [0, 0, 0], head: [2, 0, 0],
    },
    move: [0, -0.022, 0],
  },
  /** Going up past the face: the trunk straightening and turning the right shoulder back, the shoulders lifting. */
  lift: {
    rot: {
      pelvis: [0, -2, 0], spine_01: [-1, -2, 0], spine_02: [-3, -3, 0], spine_03: [-3, -2, 0],
      neck_01: [3, 4, 0], neck_02: [1, 1, 0], head: [2, 1, 0],
      clavicle_l: [0, 0, 8], clavicle_r: [0, 0, -8],
    },
    move: [0, -0.006, -0.008],
  },
  /** Over the head: the back arched, the weight back, risen, the shoulders up by the ears. */
  top: {
    rot: {
      pelvis: [-5, 0, 0], spine_01: [-5, -3, 0], spine_02: [-8, -4, 0], spine_03: [-8, -3, 0],
      neck_01: [9, 5, 0], neck_02: [3, 1, 0], head: [5, 1, 0],
      clavicle_l: [0, 0, 16], clavicle_r: [0, 0, -16],
    },
    move: [0, 0.002, -0.02],
  },
  /** Coming over: the hips and chest already turning and bending into it ahead of the arms. */
  strike: {
    rot: {
      pelvis: [3, -6, 0], spine_01: [3, 1, 0], spine_02: [2, 1, 0], spine_03: [0, 1, 0],
      neck_01: [-2, 0, 0], neck_02: [0, 0, 0], head: [0, 0, 0],
      clavicle_l: [0, 0, 10], clavicle_r: [0, 0, -10],
    },
    move: [0, -0.02, 0.004],
  },
  /** Halfway down: the arms out ahead, the blade level, the trunk bending. */
  smear: {
    rot: {
      pelvis: [7, -7, 0], spine_01: [7, 3, 0], spine_02: [8, 3, 0], spine_03: [6, 2, 0],
      neck_01: [-8, 0, 0], neck_02: [-1, 0, 0], head: [-3, 0, 0],
      clavicle_l: [0, 0, 2], clavicle_r: [0, 0, -2],
    },
    move: [0, -0.04, 0.01],
  },
  /** The blow landed: bent over it, the knees given, the weight onto the front foot, the head up to watch it. */
  impact: {
    rot: {
      pelvis: [9, -8, 0], spine_01: [16, 3, 0], spine_02: [19, 3, 0], spine_03: [16, 2, 0],
      neck_01: [-24, 0, 0], neck_02: [-6, 0, 0], head: [-10, 0, 0],
      clavicle_l: [0, 0, -3], clavicle_r: [0, 0, 3],
    },
    move: [0, -0.05, 0.006],
  },
};

/** The right arm at each key, solved on him for `ARM_AT`; the left reached onto the grip. */
export const ARMS: Record<string, Record<string, Euler>> = {
  ready: { upperarm_r: [41, -7, 60], lowerarm_r: [54, 18, 0], hand_r: [15, 8, 40] },
  lift: { upperarm_r: [96, 1, -11], lowerarm_r: [71, 70, 0], hand_r: [30, 42, 32] },
  top: { upperarm_r: [94, 1, 16], lowerarm_r: [111, 37, 0], hand_r: [10, 22, 29] },
  strike: { upperarm_r: [166, 13, 16], lowerarm_r: [5, 65, 0], hand_r: [64, 36, 30] },
  smear: { upperarm_r: [100, 1, 0], lowerarm_r: [42, 93, 0], hand_r: [66, 54, 47] },
  impact: { upperarm_r: [68, 10, 60], lowerarm_r: [5, 23, 0], hand_r: [7, 6, 72] },
};
/** Where the right fist is wanted at each key on him, body heights (across, up from the ground, forward), and the blade's way. */
export const ARM_AT: Record<string, { at: [number, number, number]; way: [number, number, number] }> = {
  ready: { at: [-0.03, 0.6, 0.25], way: [0.05, 0.8, 0.6] },
  lift: { at: [-0.03, 0.88, 0.14], way: [0, 0.85, -0.5] },
  top: { at: [-0.1, 0.94, -0.08], way: [0.3, -0.45, -0.84] },
  strike: { at: [-0.02, 0.98, 0.12], way: [0, 0.95, -0.3] },
  smear: { at: [-0.02, 0.7, 0.3], way: [0, 0.3, 0.95] },
  impact: { at: [-0.03, 0.4, 0.18], way: [0, -0.6, 0.8] },
};
/** The left arm keyed as the right's mirror, for the side its elbow is kept on as it is reached onto the grip. */
const mirrorArm = (a: Record<string, Euler>): Record<string, Euler> => Object.fromEntries(Object.entries(a).map(([b, e]) => [b.replace(/_r$/, '_l'), [e[0], -e[1], -e[2]] as Euler]));
/**
 * Her own turns at a key, where the man's do not fit her (the sword is as long as she is tall: its guard by her head at
 * the top, so her hands further back and her shoulders higher there): solved as his are, for her.
 */
export const WOMAN: Record<string, Record<string, Euler>> = {
  top: { upperarm_r: [118, 13, 7], lowerarm_r: [121, 23, 0], hand_r: [5, 8, 54], clavicle_l: [0, 0, 26], clavicle_r: [0, 0, -20] },
  impact: { upperarm_r: [87, 12, 65], lowerarm_r: [3, 90, 0], hand_r: [-4, -10, 36] },
};
const keyOf = (k: string, own: Record<string, Record<string, Euler>> = {}): KeyPose => {
  const arms = { ...ARMS[k], ...own[k] };
  const rh = Object.fromEntries(['upperarm_r', 'lowerarm_r', 'hand_r'].map((b) => [b, arms[b]]));
  return merge(FISTS, TRUNK[k], { rot: { ...rh, ...mirrorArm(rh), ...(own[k]?.clavicle_l ? { clavicle_l: own[k].clavicle_l } : {}), ...(own[k]?.clavicle_r ? { clavicle_r: own[k].clavicle_r } : {}) } });
};

/** A pose carried further the way it was going: each turn and the shift `by` of the way from `from` again. */
const past = (from: KeyPose, to: KeyPose, by: number): KeyPose => {
  const rot: Record<string, Euler> = {};
  for (const [b, e] of Object.entries(to.rot)) { const f = from.rot[b] ?? [0, 0, 0]; rot[b] = [e[0] + (e[0] - f[0]) * by, e[1] + (e[1] - f[1]) * by, e[2] + (e[2] - f[2]) * by]; }
  const m = to.move ?? [0, 0, 0], fm = from.move ?? [0, 0, 0];
  return { rot, move: [m[0] + (m[0] - fm[0]) * by, m[1] + (m[1] - fm[1]) * by, m[2] + (m[2] - fm[2]) * by] };
};
/** Between two poses: `w` of the way from one to the other. */
const toward = (a: KeyPose, b: KeyPose, w: number): KeyPose => past(b, a, -w);

/** The beats for a set of key poses, in order: the guard, the top and the blow are the key poses. */
function beatsOf(key: (k: string) => KeyPose): Beat[] {
  const READY = key('ready'), LIFT = key('lift'), TOP = key('top'), STRIKE = key('strike'), SMEAR = key('smear'), HIT = key('impact');
  return [
    { t: 0, pose: READY, ease: 'inOut', stage: 'key', name: 'guard' },
    { t: 0.16, pose: past(HIT, READY, 0.06), ease: 'inOut', name: 'braced' },
    { t: 0.36, pose: LIFT, ease: 'inOut', name: 'lift' },
    { t: 0.56, pose: TOP, ease: 'out', stage: 'key', name: 'top' },
    { t: 0.76, pose: past(LIFT, TOP, 0.06), ease: 'inOut', name: 'held' },
    { t: 0.82, pose: STRIKE, ease: 'in', name: 'strike' },
    { t: 0.86, pose: SMEAR, ease: 'linear', name: 'down' },
    { t: IMPACT, pose: HIT, ease: 'linear', stage: 'key', name: 'impact' },
    { t: 1.0, pose: past(SMEAR, HIT, 0.1), ease: 'out', stage: 'key', name: 'follow-through' },
    { t: 1.12, pose: toward(HIT, READY, 0.3), ease: 'inOut', name: 'rebound' },
  ];
}
export const BEATS: Beat[] = beatsOf((k) => keyOf(k));
/** Her correction: at each beat, her turns less his, keyed as the beats are. */
const HERS = beatsOf((k) => keyOf(k, WOMAN));
const herTracks = (): Record<string, Array<Key<Euler>>> => {
  const bones = new Set(Object.values(WOMAN).flatMap((o) => Object.keys(o)).flatMap((b) => [b, b.replace(/_r$/, '_l')]));
  return Object.fromEntries([...bones].map((b) => [b, BEATS.map((beat, i): Key<Euler> => {
    const m = beat.pose.rot[b] ?? [0, 0, 0], w = HERS[i].pose.rot[b] ?? [0, 0, 0];
    return { t: beat.t, v: [w[0] - m[0], w[1] - m[1], w[2] - m[2]], ...(beat.ease ? { ease: beat.ease } : {}) };
  })]));
};
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true });

export const SWING: Clip = {
  name: 'swing',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // braced: the feet apart and turned out, the left ahead
  plant: { rot: { thigh_l: [10, -6, 9], thigh_r: [-6, 6, -9] } },
  ...KEYS,
  events: [{ t: IMPACT, name: 'impact' }],
  // the point stopped just off the ground (game units; its edges a little lower)
  grip: { ground: 0.45 },
  stretch: [[0, 0.16], [0.56, 0.76]],
  bodies: { woman: { tracks: herTracks() } },
};
