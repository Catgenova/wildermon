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
      clavicle_l: [0, 0, 22], clavicle_r: [0, 0, -22],
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
  ready: { upperarm_r: [90, -65, 0], lowerarm_r: [37, 73, 0], hand_r: [31, 107, 57] },
  lift: { upperarm_r: [89, -4, -25], lowerarm_r: [71, 63, 0], hand_r: [-19, 73, 44] },
  top: { upperarm_r: [112, 47, -16], lowerarm_r: [76, 25, 0], hand_r: [14, 53, -7] },
  strike: { upperarm_r: [154, 1, 9], lowerarm_r: [5, 69, 0], hand_r: [-5, 34, 38] },
  smear: { upperarm_r: [117, 7, 4], lowerarm_r: [22, 77, 0], hand_r: [63, 33, 68] },
  impact: { upperarm_r: [104, -49, 5], lowerarm_r: [9, 109, 0], hand_r: [40, 26, 76] },
};
/** Where the right fist is wanted at each key on him, body heights (across, up from the ground, forward), and the blade's way. */
export const ARM_AT: Record<string, { at: [number, number, number]; way: [number, number, number] }> = {
  ready: { at: [-0.03, 0.62, 0.3], way: [0.05, 0.8, 0.6] },
  lift: { at: [-0.03, 0.9, 0.18], way: [0, 0.85, -0.5] },
  top: { at: [-0.05, 0.98, -0.06], way: [0.25, -0.45, -0.85] },
  strike: { at: [-0.02, 0.98, 0.22], way: [0, 0.95, -0.3] },
  smear: { at: [-0.02, 0.72, 0.32], way: [0, 0.3, 0.95] },
  impact: { at: [-0.03, 0.4, 0.27], way: [0, -0.6, 0.8] },
};
/** The left arm keyed as the right's mirror (or as a key gives it), for the side its elbow is kept on as it is reached onto the grip. */
const mirrorArm = (a: Record<string, Euler>): Record<string, Euler> => Object.fromEntries(Object.entries(a).map(([b, e]) => [b.replace(/_r$/, '_l'), [e[0], -e[1], -e[2]] as Euler]));
/**
 * Her own turns at a key, where the man's do not fit her (the sword is as long as she is tall: its guard by her head at
 * the top, so her hands further back and her shoulders higher there): solved as his are, for her.
 */
export const WOMAN: Record<string, Record<string, Euler>> = {
  ready: { upperarm_r: [106, 22, -38], lowerarm_r: [5, 23, 0], hand_r: [42, 106, 43] },
  lift: { upperarm_r: [138, 77, -1], lowerarm_r: [5, -34, 0], hand_r: [7, 85, 29], upperarm_l: [140, 0, 30], clavicle_l: [0, 0, 24], clavicle_r: [0, 0, -14] },
  // (her left elbow kept up and out, so the forearm goes over her head and not across her face)
  top: { upperarm_r: [123, 4, 25], lowerarm_r: [61, 49, 0], hand_r: [11, 47, 28], upperarm_l: [150, 0, 30], clavicle_l: [0, 0, 28], clavicle_r: [0, 0, -26] },
  strike: { upperarm_r: [154, 38, 20], lowerarm_r: [4, 31, 0], hand_r: [2, 48, 42], upperarm_l: [150, 0, 25], clavicle_l: [0, 0, 16], clavicle_r: [0, 0, -16] },
  // (the blow: her hips turned the other way so the pommel goes by her right hip, crouched lower and bent further)
  smear: { upperarm_r: [136, 2, 18], lowerarm_r: [4, 76, 0], hand_r: [11, 46, 52], upperarm_l: [134, 18, 4], pelvis: [9, 10, 0], spine_01: [9, -4, 0], spine_02: [10, -4, 0], spine_03: [8, -3, 0], $move: [0, -0.05, 0.008] },
  impact: {
    upperarm_r: [118, -35, 17], lowerarm_r: [4, 120, 0], hand_r: [20, 44, 63],
    pelvis: [13, 12, 0], spine_01: [20, -6, 0], spine_02: [23, -6, 0], spine_03: [19, -4, 0], neck_01: [-30, -6, 0], head: [-12, -4, 0], $move: [0, -0.075, 0.004],
  },
};
/** The right arm's bones, keyed; the left's are their mirror. */
const RIGHT_ARM = ['upperarm_r', 'lowerarm_r', 'hand_r'];
/** A key pose, with a body's own turns (`$move`: its shift) over his where it has them. */
const keyOf = (k: string, own: Record<string, Record<string, Euler>> = {}): KeyPose => {
  const o = own[k] ?? {}, arms = Object.fromEntries(RIGHT_ARM.map((b) => [b, o[b] ?? ARMS[k][b]]));
  const base = merge(FISTS, TRUNK[k], { rot: { ...arms, ...mirrorArm(arms), ...Object.fromEntries(Object.entries(ARMS[k]).filter(([b]) => b.endsWith('_l'))) } });
  const rest = Object.fromEntries(Object.entries(o).filter(([b]) => !RIGHT_ARM.includes(b) && b !== '$move'));
  return { rot: { ...base.rot, ...rest }, move: o.$move ?? base.move };
};

/** A pose carried further the way it was going: each turn and the shift `by` of the way from `from` again. */
const past = (from: KeyPose, to: KeyPose, by: number): KeyPose => {
  const rot: Record<string, Euler> = {};
  for (const [b, e] of Object.entries(to.rot)) { const f = from.rot[b] ?? [0, 0, 0]; rot[b] = [e[0] + (e[0] - f[0]) * by, e[1] + (e[1] - f[1]) * by, e[2] + (e[2] - f[2]) * by]; }
  const m = to.move ?? [0, 0, 0], fm = from.move ?? [0, 0, 0];
  return { rot, move: [m[0] + (m[0] - fm[0]) * by, m[1] + (m[1] - fm[1]) * by, m[2] + (m[2] - fm[2]) * by] };
};
/** A pose's trunk carried on as `past` does, its arms kept: a hold that keeps moving, or a follow-through, with the hands where they were. */
const settle = (from: KeyPose, to: KeyPose, by: number, still = false): KeyPose => {
  const p = past(from, to, by);
  return { rot: { ...p.rot, ...Object.fromEntries(Object.entries(to.rot).filter(([b]) => /^(upperarm_|lowerarm_|hand_|fingers_|thumb_|clavicle_|neck_|head)/.test(b))) }, move: still ? to.move : p.move };
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
    { t: 0.76, pose: settle(LIFT, TOP, 0.06), ease: 'inOut', name: 'held' },
    { t: 0.82, pose: STRIKE, ease: 'in', name: 'strike' },
    { t: 0.86, pose: SMEAR, ease: 'linear', name: 'down' },
    { t: IMPACT, pose: HIT, ease: 'linear', stage: 'key', name: 'impact' },
    { t: 1.0, pose: settle(SMEAR, HIT, 0.06, true), ease: 'out', stage: 'key', name: 'follow-through' },
    { t: 1.12, pose: toward(HIT, READY, 0.3), ease: 'inOut', name: 'rebound' },
  ];
}
export const BEATS: Beat[] = beatsOf((k) => keyOf(k));
/** Her correction: at each beat, her turns less his, keyed as the beats are. */
const HERS = beatsOf((k) => keyOf(k, WOMAN));
const herTracks = (): Record<string, Array<Key<Euler>>> => {
  const bones = new Set(Object.values(WOMAN).flatMap((o) => Object.keys(o)).flatMap((b) => (RIGHT_ARM.includes(b) ? [b, b.replace(/_r$/, '_l')] : [b])));
  return Object.fromEntries([...bones].map((b) => [b, BEATS.map((beat, i): Key<Euler> => {
    const m = (b === '$move' ? beat.pose.move : beat.pose.rot[b]) ?? [0, 0, 0], w = (b === '$move' ? HERS[i].pose.move : HERS[i].pose.rot[b]) ?? [0, 0, 0];
    return { t: beat.t, v: [w[0] - m[0], w[1] - m[1], w[2] - m[2]], ...(beat.ease ? { ease: beat.ease } : {}) };
  })]));
};
/** The head trailing the trunk and the neck between: seconds each bone's keys are late (the arms keep the beat: they hold the sword). */
export const LAG = { head: 0.03, neck_02: 0.015 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });
/** The blow's jolt, on its own timing over the beats: the chest, neck and head thrown on and settled (the arms, on the sword, kept). */
const J = IMPACT;
const ACCENTS: Clip['accents'] = {
  spine_03: [{ t: 0, v: [0, 0, 0] }, { t: J, v: [0, 0, 0] }, { t: J + 0.04, v: [1.2, 0, 0], ease: 'out' }, { t: J + 0.18, v: [0, 0, 0] }],
  neck_01: [{ t: 0, v: [0, 0, 0] }, { t: J, v: [0, 0, 0] }, { t: J + 0.05, v: [2, 0, 0], ease: 'out' }, { t: J + 0.2, v: [0, 0, 0] }],
  head: [{ t: 0, v: [0, 0, 0] }, { t: J + 0.01, v: [0, 0, 0] }, { t: J + 0.06, v: [4, 0, 0], ease: 'out' }, { t: J + 0.22, v: [0, 0, 0], ease: 'back', back: 0.25 }],
};

export const SWING: Clip = {
  name: 'swing',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // braced: the feet apart and turned out, the left ahead
  plant: { rot: { thigh_l: [10, -6, 9], thigh_r: [-6, 6, -9] } },
  ...KEYS,
  accents: ACCENTS,
  events: [{ t: IMPACT, name: 'impact' }],
  // the point stopped just off the ground (game units; its edges a little lower)
  grip: { ground: 0.6 },
  stretch: [[0, 0.16], [0.56, 0.76]],
  bodies: { woman: { tracks: herTracks() } },
};
