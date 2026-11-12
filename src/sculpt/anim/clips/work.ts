/**
 * W1, work at the bench: a one-handed overhand strike onto the work at belt height, the other hand holding a second tool
 * on it. The clip of every job done with a tool struck with, or held to the work, in one hand (`../index.ts`
 * CLIP_OF_TOOL): a hammer, a mallet, a chisel, a hatchet, a cleaver, an awl, a carving knife, a trowel, a file, a
 * whetstone. Drawn with the placeholder mallet in the right hand and the chisel in the left (`Clip.tools`).
 *
 * Feet planted, the left ahead. The left fist holds the chisel upright on the work (`Clip.hands`: reached to its place,
 * which stays where it is in the world as the body moves over it). From the rest after a blow: the weight going back onto
 * the right foot, the chest turning right, the mallet lifted past the shoulder to beside the ear, held there; then
 * brought down fast, the chest turning back and bending into it and the weight driven onto the left foot, the knees
 * giving, the mallet's face onto the chisel's top (the `impact` event); a rebound, let down to the rest. The head bowed
 * at the work throughout. Fitted to a go's length by stretching the rest and the top's hold (`Clip.stretch`), never the
 * blow. Played mirrored, left-handed, from the facings the flat figure works left-handed from (`../index.ts` lefty).
 */
import type { Clip, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

const LENGTH = 1;
/** The top's hold let go, the blow begun, seconds in. */
export const STRIKE = 0.56;
/** The mallet's face on the chisel's top, seconds in. */
export const IMPACT = 0.8;

/**
 * Where the left fist holds the chisel (its grip's middle), body heights: across (the body's left), up from the ground,
 * forward; and the chisel's way up from its edge toward its top (the grip's way toward the thumb), leant a little back
 * toward the body and over toward the mallet.
 */
export const HOLD: Euler = [0.11, 0.53, 0.25];
export const UPRIGHT: Euler = [-0.12, 0.97, -0.2];
/** How far the chisel is driven down by the blow, body heights, and how soon it is back. */
const JOLT = 0.006;

/** The trunk, head and stance at each key, before the right arm. */
export const TRUNK: Record<string, KeyPose> = {
  /** At rest after the blow: bent over the work, square to it, the weight between the feet. */
  rest: {
    rot: {
      pelvis: [5, -10, 0], spine_01: [4, -3, 0], spine_02: [4, -3, 0], spine_03: [3, -2, 0],
      neck_01: [6, 0, 0], neck_02: [4, 0, 0], head: [10, 0, 0],
      clavicle_l: [0, 0, -2], clavicle_r: [0, 0, 2],
    },
    move: [0.004, -0.02, 0.006],
  },
  /** Rising: the weight going back onto the right foot, the chest turning right after the mallet, still bent. */
  rise: {
    rot: {
      pelvis: [5, -14, 1], spine_01: [3, -5, 1], spine_02: [3, -5, 0], spine_03: [2, -4, 0],
      neck_01: [8, 3, 0], neck_02: [5, 2, 0], head: [9, 3, 0],
      clavicle_l: [0, 0, -2], clavicle_r: [0, 0, -8],
    },
    move: [-0.01, -0.012, 0.004],
  },
  /** At the top: risen, the chest turned furthest right and opened, the right shoulder up; the head still on the work. */
  top: {
    rot: {
      pelvis: [4, -18, 2], spine_01: [3, -7, 1], spine_02: [2, -7, 0], spine_03: [1, -6, 0],
      neck_01: [9, 5, 0], neck_02: [5, 3, 0], head: [8, 4, 0],
      clavicle_l: [0, 0, -1], clavicle_r: [0, 0, -14],
    },
    move: [-0.016, -0.006, 0.004],
  },
  /** Coming over: the hips already turning back and the chest bending, ahead of the arm. */
  strike: {
    rot: {
      pelvis: [4, -13, 1], spine_01: [3, -4, 0], spine_02: [3, -4, 0], spine_03: [2, -3, 0],
      neck_01: [7, 2, 0], neck_02: [4, 1, 0], head: [9, 1, 0],
      clavicle_l: [0, 0, -2], clavicle_r: [0, 0, -6],
    },
    move: [-0.006, -0.016, 0.002],
  },
  /** Coming down, the mallet out ahead of the face: the hips square, the chest following. */
  over: {
    rot: {
      pelvis: [5, -10, 0], spine_01: [4, -2, 0], spine_02: [4, -2, 0], spine_03: [3, -1, 0],
      neck_01: [7, 1, 0], neck_02: [4, 0, 0], head: [9, 0, 0],
      clavicle_l: [0, 0, -2], clavicle_r: [0, 0, -3],
    },
    move: [0.002, -0.024, 0.005],
  },
  /** Coming down onto the chisel: nearly over it, the knees giving. */
  smear: {
    rot: {
      pelvis: [6, -8, 0], spine_01: [4, -1, -1], spine_02: [4, -1, 0], spine_03: [3, 0, 0],
      neck_01: [6, 0, 0], neck_02: [4, 0, 0], head: [10, 0, 0],
      clavicle_l: [0, 0, -3], clavicle_r: [0, 0, 0],
    },
    move: [0.01, -0.03, 0.008],
  },
  /** The blow landed: bent over it, turned back past square, the knees given, the weight onto the left foot. */
  impact: {
    rot: {
      pelvis: [6, -6, -1], spine_01: [4, 0, -1], spine_02: [4, 0, 0], spine_03: [3, 1, 0],
      neck_01: [6, -1, 0], neck_02: [4, 0, 0], head: [10, -1, 0],
      clavicle_l: [0, 0, -3], clavicle_r: [0, 0, 4],
    },
    move: [0.016, -0.038, 0.012],
  },
};

/**
 * Where the mallet is wanted at each key: the fist (`fist`, the grip's middle: body heights from the ground under the
 * body, as `HOLD`), or through the blow its face's middle (`contact`) from the chisel's top, body heights (across, up,
 * forward); the way its face looks (`face`, the blow's way: the socket's x) and the way its haft runs from the fist to the
 * head (`way`: the socket's y); and the side the elbow is out on from the line from the shoulder to the fist (`pole`):
 * out and down at the blow, out and back at the top. At the impact the face is on the
 * top and looks down the chisel.
 */
export const ARM_AT: Record<string, { fist?: Euler; contact?: Euler; face: Euler; way: Euler; pole: Euler }> = {
  rest: { fist: [-0.11, 0.62, 0.18], face: [0.1, -0.8, 0.55], way: [0.85, 0.3, 0.42], pole: [-1, -0.6, 0] },
  rise: { fist: [-0.25, 0.74, 0.12], face: [0, 0.3, 0.95], way: [-0.1, 0.95, -0.2], pole: [-0.8, -0.8, -0.2] },
  top: { fist: [-0.23, 0.9, 0.03], face: [0, 0.97, 0.15], way: [0.1, 0.2, -1], pole: [-0.7, -0.6, -0.4] },
  strike: { fist: [-0.2, 0.84, 0.1], face: [0, -0.4, 0.9], way: [0.1, 0.9, 0.4], pole: [-0.8, -0.5, -0.3] },
  over: { fist: [-0.18, 0.74, 0.21], face: [0, -0.6, 0.8], way: [0.4, 0.75, 0.5], pole: [-0.9, -0.4, -0.1] },
  smear: { contact: [-0.05, 0.13, 0], face: [0.2, -0.75, 0.6], way: [0.85, 0.4, 0.35], pole: [-0.9, -0.5, 0] },
  impact: { contact: [0, 0, 0], face: [0.12, -0.97, 0.2], way: [0.9, 0.1, 0.42], pole: [-1, -0.6, 0] },
};
/** Hers where they differ (her arms are shorter for her height, her work nearer): the downswing kept further from her face. */
export const ARM_AT_WOMAN: Record<string, { fist?: Euler; contact?: Euler; face: Euler; way: Euler; pole: Euler }> = {
  over: { fist: [-0.23, 0.69, 0.24], face: [0, -0.7, 0.7], way: [0.5, 0.6, 0.6], pole: [-0.9, -0.4, -0.1] },
  smear: { contact: [-0.06, 0.08, 0.04], face: [0.2, -0.8, 0.55], way: [0.85, 0.3, 0.45], pole: [-0.9, -0.5, 0] },
  impact: { contact: [0, 0, 0], face: [0.12, -0.97, 0.2], way: [0.95, 0.05, 0.3], pole: [-1, -0.6, 0] },
};
/** The right arm at each key, solved on him for `ARM_AT` (`tools/sculpt/lowworksolve.mjs`). */
export const ARMS: Record<string, Record<string, Euler>> = {
  impact: { upperarm_r: [38, -28, -30], lowerarm_r: [81, 0, 0], hand_r: [10, 92, -17] },
  rest: { upperarm_r: [39, -21, -15], lowerarm_r: [88, 0, 0], hand_r: [11, 87, 1] },
  rise: { upperarm_r: [37, 24, -17], lowerarm_r: [93, 0, 0], hand_r: [-3, 105, 4] },
  top: { upperarm_r: [41, 77, -66], lowerarm_r: [97, 0, 0], hand_r: [-8, 110, 21] },
  strike: { upperarm_r: [31, 62, -70], lowerarm_r: [103, 0, 0], hand_r: [11, 134, -2] },
  over: { upperarm_r: [37, 33, -78], lowerarm_r: [84, 0, 0], hand_r: [12, 135, 1] },
  smear: { upperarm_r: [37, -14, -44], lowerarm_r: [107, 0, 0], hand_r: [12, 116, -11] },
};
/** Her right arm where his does not fit her, solved as his is. */
export const WOMAN: Record<string, Record<string, Euler>> = {
  impact: { upperarm_r: [32, -37, -19], lowerarm_r: [85, 0, 0], hand_r: [-3, 85, -25] },
  rest: { upperarm_r: [36, -23, -24], lowerarm_r: [91, 0, 0], hand_r: [9, 85, 1] },
  rise: { upperarm_r: [37, 38, -24], lowerarm_r: [86, 0, 0], hand_r: [-5, 114, 7] },
  top: { upperarm_r: [28, 90, -76], lowerarm_r: [81, 0, 0], hand_r: [-5, 113, 27] },
  strike: { upperarm_r: [21, 67, -71], lowerarm_r: [99, 0, 0], hand_r: [13, 145, -2] },
  over: { upperarm_r: [46, 24, -75], lowerarm_r: [49, 0, 0], hand_r: [15, 132, 15] },
  smear: { upperarm_r: [30, -15, -44], lowerarm_r: [107, 0, 0], hand_r: [-1, 105, -11] },
};

/** The left arm as keyed before it is reached to the chisel: the elbow out and down, which side the reach keeps it on. */
const LEFT: Record<string, Euler> = { upperarm_l: [0, 0, 4], lowerarm_l: [100, 0, 0], hand_l: [0, 0, 0] };
/** The arm at the strike: on its way from the top to coming down onto the chisel, `STRIKE_ARM` of the way. */
const STRIKE_ARM = 0.45;
const armOf = (k: string, arms: Record<string, Record<string, Euler>>): Record<string, Euler> => {
  if (k !== 'strike' || arms.strike || ARMS.strike) return arms[k] ?? ARMS[k];
  const a = arms.top ?? ARMS.top, b = arms.smear ?? ARMS.smear;
  return Object.fromEntries(Object.keys(a).map((n) => [n, a[n].map((x, j) => x + (b[n][j] - x) * STRIKE_ARM) as Euler]));
};
/** A key pose, with a body's own right arm over his where it has one. */
export const keyOf = (k: string, own: Record<string, Record<string, Euler>> = {}): KeyPose => merge(TRUNK[k], { rot: { ...LEFT, ...armOf(k, ARMS), ...(own.top || own.smear ? armOf(k, { ...ARMS, ...own }) : {}), ...(own[k] ?? {}) } });

/** A pose carried on further the way it was going (`by` of the way from `from` again), or between two (`by` negative). */
const past = (from: KeyPose, to: KeyPose, by: number): KeyPose => {
  const rot: Record<string, Euler> = {};
  for (const [b, e] of Object.entries(to.rot)) { const f = from.rot[b] ?? [0, 0, 0]; rot[b] = [e[0] + (e[0] - f[0]) * by, e[1] + (e[1] - f[1]) * by, e[2] + (e[2] - f[2]) * by]; }
  const m = to.move ?? [0, 0, 0], fm = from.move ?? [0, 0, 0];
  return { rot, move: [m[0] + (m[0] - fm[0]) * by, m[1] + (m[1] - fm[1]) * by, m[2] + (m[2] - fm[2]) * by] };
};
const toward = (a: KeyPose, b: KeyPose, w: number): KeyPose => past(b, a, -w);

/** The beats of a body, its key poses by name. */
export function planOf(key: (k: string) => KeyPose): Beat[] {
  const REST = key('rest'), RISE = key('rise'), TOP = key('top'), STR = key('strike'), OVER = key('over'), SMEAR = key('smear'), HIT = key('impact');
  return [
    { t: 0, pose: REST, ease: 'inOut', stage: 'key', name: 'rest' },
    { t: 0.22, pose: RISE, ease: 'inOut', stage: 'key', name: 'rise' },
    { t: 0.38, pose: TOP, ease: 'back', back: 0.12, stage: 'key', name: 'top' },
    { t: STRIKE, pose: past(RISE, TOP, 0.05), ease: 'inOut', name: 'held' },
    { t: 0.66, pose: STR, ease: 'in', stage: 'key', name: 'strike' },
    { t: 0.71, pose: OVER, ease: 'in', name: 'over' },
    { t: 0.75, pose: SMEAR, ease: 'linear', name: 'down' },
    { t: IMPACT, pose: HIT, ease: 'linear', stage: 'key', name: 'impact' },
    { t: 0.82, pose: HIT, ease: 'linear', name: 'stuck' },
    { t: 0.88, pose: toward(HIT, REST, 0.4), ease: 'out', name: 'rebound' },
  ];
}
export const BEATS: Beat[] = planOf((k) => keyOf(k));
const HERS = planOf((k) => keyOf(k, WOMAN));
/** Her correction: at each beat, her turns less his. */
const herTracks = (): Record<string, Array<Key<Euler>>> => {
  const bones = new Set(Object.values(WOMAN).flatMap((o) => Object.keys(o)));
  return Object.fromEntries([...bones].map((b) => [b, BEATS.map((beat, i): Key<Euler> => {
    const m = beat.pose.rot[b] ?? [0, 0, 0], w = HERS[i].pose.rot[b] ?? [0, 0, 0];
    return { t: beat.t, v: [w[0] - m[0], w[1] - m[1], w[2] - m[2]], ...(beat.ease ? { ease: beat.ease } : {}), ...(beat.back !== undefined ? { back: beat.back } : {}) };
  })]));
};
/** Her hips carried further over the front foot (body heights forward): her arms are shorter for her height. */
const HER_LEAN: Euler = [0, 0, 0.05];
/** The head and neck trailing the chest: seconds each bone's keys are late. */
export const LAG = { neck_02: 0.02, head: 0.04 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });

export const WORK: Clip = {
  name: 'work',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // planted, the left foot ahead under the work, the right back
  plant: { rot: { thigh_l: [9, -4, 6], thigh_r: [-5, 5, -6] } },
  ...KEYS,
  armsFree: true,
  hands: {
    // the chisel held on the work, driven down a little by each blow and back
    l: { at: [{ t: 0, v: HOLD }, { t: IMPACT, v: HOLD }, { t: IMPACT + 0.03, v: [HOLD[0], HOLD[1] - JOLT, HOLD[2]], ease: 'out' }, { t: IMPACT + 0.15, v: HOLD, ease: 'inOut' }], way: UPRIGHT },
  },
  tools: { r: 'mallet', l: 'chisel' },
  events: [{ t: STRIKE, name: 'strike' }, { t: IMPACT, name: 'impact' }],
  stretch: [[0, 0.22], [0.38, STRIKE]],
  // her arms shorter for her height: the chisel held nearer
  bodies: { woman: { tracks: { ...herTracks(), $move: [{ t: 0, v: HER_LEAN }] }, hands: { l: [0.0, 0.02, -0.05] }, grip: { r: 0.8 } } },
};
