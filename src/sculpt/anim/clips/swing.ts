/**
 * S1, the two-handed overhead swing: a heavy blade (the long sword, as long as she is tall) brought down overhead in both
 * hands; the work clip for mining too, whatever is held. Both hands on the grip (`Clip.grip`): the right arm keyed, its
 * fist the lead under the guard, the left reached onto the grip below it.
 *
 * Braced, feet apart and the left ahead. At rest bent over the blade, its point on the ground ahead; gathered, then the
 * blade dragged out and round to the right along the ground, its point trailing on it (`Grip.rest`), the body turning
 * and leaning into the pull; heaved up off the ground by the right hip, over the right shoulder, the blade hanging down
 * the back; risen overhead past the top and settled there, held; brought down fast, the hands leading and the blade
 * whipping over after them, the trunk bending into it and the knees giving, the point stopped at the ground (the
 * `impact` event, the slash trail's from the `strike` event: `../trail.ts`); carried on past and let down to the rest.
 * Both feet planted. Fitted to an action's length by stretching the rest, the drag and the top's hold (`Clip.stretch`),
 * never the heave or the blow.
 */
import type { Clip, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

const LENGTH = 2;
/** The point reaching the ground, seconds in. */
export const IMPACT = 1.7;
/** The top's hold let go, the blow begun, seconds in. */
export const STRIKE = 1.56;

/** Both fists closed (the held prop's own curl replaces this when it gives one). */
const FISTS: KeyPose = {
  rot: {
    fingers_01_l: [70, 0, 0], fingers_01_r: [70, 0, 0],
    fingers_02_l: [80, 0, 0], fingers_02_r: [80, 0, 0],
  },
};

/** The trunk, head and stance at each key, before the arms. */
export const TRUNK: Record<string, KeyPose> = {
  /** At rest after the blow: still bent over the blade, its point down on the ground ahead. */
  rest: {
    rot: {
      pelvis: [7, -6, 0], spine_01: [10, 2, 0], spine_02: [11, 2, 0], spine_03: [9, 2, 0],
      neck_01: [-16, 0, 0], neck_02: [-3, 0, 0], head: [-5, 0, 0],
      clavicle_l: [0, 0, -2], clavicle_r: [0, 0, 2],
    },
    move: [0, -0.045, 0.004],
  },
  /** Gathered before the pull: sunk lower, turned a little the other way, the weight onto the left foot. */
  gather: {
    rot: {
      pelvis: [9, -2, -2], spine_01: [11, 5, -2], spine_02: [11, 5, -2], spine_03: [9, 4, -1],
      neck_01: [-16, -3, 0], neck_02: [-3, -1, 0], head: [-5, -2, 0],
      clavicle_l: [0, 0, -3], clavicle_r: [0, 0, 3],
    },
    move: [0.008, -0.056, 0.004],
  },
  /** Pulling: turned to the right and leant into it, the weight going over onto the right foot, the hands out to the right. */
  drag: {
    rot: {
      pelvis: [9, -12, 3], spine_01: [9, -8, 5], spine_02: [9, -8, 4], spine_03: [7, -6, 3],
      neck_01: [-13, 4, 0], neck_02: [-3, 2, 0], head: [-4, 3, 0],
      clavicle_l: [0, 0, -2], clavicle_r: [0, 0, 4],
    },
    move: [-0.018, -0.056, 0],
  },
  /** Round to the right: turned furthest, the hands by the right hip, the blade out to the side on the ground. */
  around: {
    rot: {
      pelvis: [7, -16, 3], spine_01: [8, -11, 5], spine_02: [7, -11, 4], spine_03: [5, -9, 3],
      neck_01: [-10, 8, 0], neck_02: [-2, 3, 0], head: [-2, 6, 0],
      clavicle_l: [0, 0, 2], clavicle_r: [0, 0, -2],
    },
    move: [-0.024, -0.052, -0.006],
  },
  /** Coming up off the ground: the hands rising by the right hip, the blade swinging out and round behind. */
  up: {
    rot: {
      pelvis: [5, -16, 1], spine_01: [4, -12, 2], spine_02: [2, -12, 2], spine_03: [1, -10, 1],
      neck_01: [-4, 8, 0], neck_02: [-1, 3, 0], head: [0, 5, 0],
      clavicle_l: [0, 0, 8], clavicle_r: [0, 0, -8],
    },
    move: [-0.02, -0.05, -0.01],
  },
  /** Heaved up: the hands by the right shoulder, the blade hanging down the back, the trunk rising and arching under it. */
  heave: {
    rot: {
      pelvis: [0, -14, 0], spine_01: [-2, -12, -2], spine_02: [-4, -12, -2], spine_03: [-4, -10, -2],
      neck_01: [4, 6, 0], neck_02: [1, 2, 0], head: [2, 4, 0],
      clavicle_l: [0, 0, 16], clavicle_r: [0, 0, -18],
    },
    move: [-0.01, -0.012, -0.012],
  },
  /** Rising to the top: the hands going up past the right ear, the trunk turning back to the front. */
  rise: {
    rot: {
      pelvis: [-3, -7, 0], spine_01: [-4, -8, -1], spine_02: [-6, -8, -1], spine_03: [-6, -6, -1],
      neck_01: [7, 6, 0], neck_02: [2, 2, 0], head: [4, 3, 0],
      clavicle_l: [0, 0, 22], clavicle_r: [0, 0, -20],
    },
    move: [-0.005, -0.004, -0.016],
  },
  /** Over the head: the back arched, the weight back, risen, the shoulders up by the ears. */
  top: {
    rot: {
      pelvis: [-5, 0, 0], spine_01: [-5, -3, 0], spine_02: [-8, -4, 0], spine_03: [-8, -3, 0],
      neck_01: [9, 5, 0], neck_02: [3, 1, 0], head: [5, 1, 0],
      clavicle_l: [0, 0, 28], clavicle_r: [0, 0, -22],
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
  rest: { upperarm_r: [66, -47, 84], lowerarm_r: [19, 101, 0], hand_r: [25, 101, -20], lowerarm_l: [19, 13, 0] },
  gather: { upperarm_r: [53, -38, 81], lowerarm_r: [48, 102, 0], hand_r: [27, 105, -30], lowerarm_l: [48, 101, 0] },
  drag: { upperarm_r: [62, -64, 90], lowerarm_r: [18, 102, 0], hand_r: [16, 96, -22], lowerarm_l: [18, 55, 0] },
  around: { upperarm_r: [55, 4, 87], lowerarm_r: [7, 64, 0], hand_r: [31, 73, -19], lowerarm_l: [7, 22, 0] },
  up: { upperarm_r: [57, -28, -9], lowerarm_r: [57, -15, 0], hand_r: [14, -108, 56], lowerarm_l: [57, 0, 0] },
  heave: { upperarm_r: [40, -14, 67], lowerarm_r: [35, 94, 0], hand_r: [-21, 72, -52], lowerarm_l: [35, -56, 0] },
  rise: { upperarm_r: [86, -25, 10], lowerarm_r: [83, 54, 0], hand_r: [-47, 48, 8], lowerarm_l: [83, -43, 0] },
  top: { upperarm_r: [112, 47, -16], lowerarm_r: [76, 25, 0], hand_r: [14, 53, -7] },
  strike: { upperarm_r: [154, 1, 9], lowerarm_r: [5, 69, 0], hand_r: [-5, 34, 38] },
  smear: { upperarm_r: [117, 7, 4], lowerarm_r: [22, 77, 0], hand_r: [63, 33, 68] },
  impact: { upperarm_r: [104, -49, 5], lowerarm_r: [9, 109, 0], hand_r: [40, 26, 76] },
};
/** Where the right fist is wanted at each key on him, body heights (across, up from the ground, forward), and the blade's way. */
export const ARM_AT: Record<string, { at: [number, number, number]; way: [number, number, number] }> = {
  rest: { at: [-0.02, 0.56, 0.28], way: [-0.1, -0.82, 0.56] },
  gather: { at: [0.02, 0.55, 0.28], way: [-0.05, -0.82, 0.57] },
  drag: { at: [-0.12, 0.55, 0.26], way: [-0.45, -0.8, 0.38] },
  around: { at: [-0.2, 0.55, 0.2], way: [-0.7, -0.7, -0.15] },
  up: { at: [-0.3, 0.62, 0.06], way: [-0.65, -0.55, -0.5] },
  heave: { at: [-0.2, 0.74, 0.06], way: [-0.3, -0.62, -0.72] },
  rise: { at: [-0.08, 0.9, 0.02], way: [-0.1, -0.5, -0.86] },
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
  rise: { upperarm_r: [121, 80, -59], lowerarm_r: [72, 4, 0], hand_r: [-34, 101, 63], lowerarm_l: [72, -28, 0] },
  up: { upperarm_r: [86, -90, 18], lowerarm_r: [28, -65, 0], hand_r: [51, 5, -12], lowerarm_l: [28, -6, 0] },
  heave: { upperarm_r: [60, 35, 67], lowerarm_r: [-1, 85, 0], hand_r: [-3, 78, -43], lowerarm_l: [-1, 2, 0] },
  rest: { upperarm_r: [75, -19, 84], lowerarm_r: [5, 87, 0], hand_r: [26, 106, 6], lowerarm_l: [5, -21, 0] },
  gather: { upperarm_r: [87, -48, 82], lowerarm_r: [23, 100, 0], hand_r: [22, 112, 13], lowerarm_l: [23, -13, 0] },
  drag: { upperarm_r: [119, 92, -66], lowerarm_r: [5, 98, 0], hand_r: [14, 107, -12], lowerarm_l: [5, -4, 0] },
  around: { upperarm_r: [66, 8, 82], lowerarm_r: [2, 45, 0], hand_r: [23, 100, -11], lowerarm_l: [2, -9, 0] },
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

/** The arms' turns at a breakdown: the right upper arm's three, its forearm's bend and twist, its hand's three; the left forearm's twist. */
type Arm = [number, number, number, number, number, number, number, number, number];
/**
 * Breakdowns through the drag and the lift, and back down from the blow to the rest (generated, a frame apart: the fist
 * put on a curve through the keys' fists, eased as the keys are, the blade turned evenly between their ways, the right
 * arm and the left forearm's twist solved from the frame before for the wrists' bend and twist, the left fist on the
 * grip, the forearms, the left arm and the sword clear of the body, and the point on the ground through the drag): at
 * `t`, `w` of the way from one of the plan's beats to the next (the trunk, head and stance), the arms, his and hers. One
 * at a beat's own time puts its arms on that beat. Between them the beats are linear: the easing is in the breakdowns.
 */
export const BETWEEN: Array<{ t: number; from: string; to: string; w: number; man: Arm; woman: Arm }> = [
  { t: 0, from: 'rest', to: 'gather', w: 0, man: [65, -43, 81, 21, 100, 26, 100, -18, 13], woman: [76, -17, 81, 4, 90, 27, 105, 7, -19] },
  { t: 0.04, from: 'rest', to: 'gather', w: 0.198, man: [63, -41, 80, 25, 100, 27, 100, -18, 13], woman: [77, -17, 80, 5, 89, 27, 104, 7, -18] },
  { t: 0.08, from: 'rest', to: 'gather', w: 0.606, man: [59, -42, 81, 33, 100, 27, 100, -19, 16], woman: [81, -19, 80, 8, 90, 27, 100, 12, -20] },
  { t: 0.12, from: 'rest', to: 'gather', w: 0.945, man: [55, -38, 81, 43, 101, 28, 100, -21, 20], woman: [82, -22, 81, 15, 93, 26, 98, 13, -18] },
  { t: 0.14, from: 'gather', to: 'drag', w: 0, man: [52, -36, 80, 49, 101, 29, 100, -22, 22], woman: [81, -24, 80, 23, 95, 23, 97, 13, -16] },
  { t: 0.16, from: 'gather', to: 'drag', w: 0.008, man: [51, -35, 80, 51, 100, 29, 100, -21, 23], woman: [81, -26, 80, 24, 95, 24, 97, 17, -16] },
  { t: 0.2, from: 'gather', to: 'drag', w: 0.067, man: [50, -36, 80, 50, 100, 29, 100, -20, 25], woman: [81, -27, 78, 25, 95, 24, 97, 21, -17] },
  { t: 0.24, from: 'gather', to: 'drag', w: 0.171, man: [49, -37, 80, 48, 99, 28, 99, -19, 25], woman: [75, -27, 80, 15, 97, 22, 102, 15, -16] },
  { t: 0.28, from: 'gather', to: 'drag', w: 0.307, man: [48, -36, 79, 46, 98, 26, 98, -19, 25], woman: [70, -21, 82, 18, 86, 23, 103, -2, -4] },
  { t: 0.32, from: 'gather', to: 'drag', w: 0.461, man: [48, -36, 79, 44, 97, 25, 97, -19, 25], woman: [68, -28, 83, 21, 91, 23, 102, -2, -3] },
  { t: 0.36, from: 'gather', to: 'drag', w: 0.617, man: [50, -36, 79, 42, 96, 24, 96, -18, 25], woman: [67, -35, 83, 24, 93, 22, 98, -4, -2] },
  { t: 0.4, from: 'gather', to: 'drag', w: 0.764, man: [53, -37, 80, 38, 94, 23, 95, -16, 25], woman: [64, -44, 75, 27, 97, 25, 100, -1, 3] },
  { t: 0.44, from: 'gather', to: 'drag', w: 0.886, man: [55, -40, 80, 35, 93, 22, 94, -13, 25], woman: [68, -48, 88, 24, 97, 17, 100, -9, 7] },
  { t: 0.48, from: 'gather', to: 'drag', w: 0.969, man: [56, -43, 80, 33, 93, 21, 93, -9, 25], woman: [67, -53, 89, 24, 102, 18, 100, -10, 8] },
  { t: 0.52, from: 'drag', to: 'around', w: 0, man: [55, -45, 80, 33, 93, 19, 92, -8, 25], woman: [63, -55, 83, 26, 101, 17, 103, -12, 15] },
  { t: 0.56, from: 'drag', to: 'around', w: 0.043, man: [56, -45, 80, 33, 94, 18, 91, -8, 25], woman: [57, -54, 82, 29, 100, 16, 101, -10, 15] },
  { t: 0.6, from: 'drag', to: 'around', w: 0.156, man: [56, -44, 80, 31, 95, 17, 91, -9, 25], woman: [56, -51, 81, 31, 99, 15, 101, -9, 16] },
  { t: 0.64, from: 'drag', to: 'around', w: 0.316, man: [57, -42, 80, 28, 95, 16, 90, -11, 25], woman: [58, -51, 81, 33, 100, 14, 98, -10, 13] },
  { t: 0.68, from: 'drag', to: 'around', w: 0.5, man: [57, -40, 80, 24, 94, 16, 88, -14, 24], woman: [62, -49, 68, 27, 105, 11, 104, -10, 18] },
  { t: 0.72, from: 'drag', to: 'around', w: 0.684, man: [56, -37, 79, 21, 93, 15, 86, -16, 23], woman: [64, -39, 71, 20, 101, 6, 108, -16, 18] },
  { t: 0.76, from: 'drag', to: 'around', w: 0.844, man: [55, -34, 78, 19, 93, 15, 85, -18, 23], woman: [66, -42, 74, 20, 97, 7, 104, -11, 20] },
  { t: 0.8, from: 'drag', to: 'around', w: 0.957, man: [55, -32, 77, 18, 92, 15, 84, -20, 23], woman: [66, -39, 73, 17, 97, 6, 104, -14, 20] },
  { t: 0.84, from: 'around', to: 'up', w: 0, man: [55, -31, 77, 18, 92, 16, 83, -21, 23], woman: [66, -39, 74, 16, 96, 8, 103, -10, 20] },
  { t: 0.88, from: 'around', to: 'up', w: 0.095, man: [56, -29, 74, 17, 93, 17, 84, -21, 23], woman: [70, -34, 74, 13, 97, 0, 100, -9, 18] },
  { t: 0.92, from: 'around', to: 'up', w: 0.379, man: [56, -19, 67, 19, 99, 17, 93, -26, 18], woman: [71, -31, 71, 12, 98, 6, 95, -12, 18] },
  { t: 0.97, from: 'up', to: 'heave', w: 0, man: [54, -1, 53, 34, 99, 16, 90, -37, 18], woman: [81, -28, 70, 11, 98, -2, 90, -12, 13] },
  { t: 1, from: 'up', to: 'heave', w: 0.135, man: [50, 4, 52, 38, 98, 16, 89, -41, 21], woman: [81, -27, 66, 7, 98, -6, 93, -15, 13] },
  { t: 1.04, from: 'up', to: 'heave', w: 0.558, man: [44, 4, 59, 36, 98, 10, 82, -43, 21], woman: [74, -22, 68, 8, 99, -14, 94, -23, 15] },
  { t: 1.08, from: 'up', to: 'heave', w: 0.936, man: [39, 2, 71, 35, 97, 4, 72, -48, 21], woman: [63, -11, 73, 13, 102, -27, 92, -30, 13] },
  { t: 1.1, from: 'heave', to: 'rise', w: 0, man: [39, 2, 75, 33, 96, 4, 68, -51, 21], woman: [62, -12, 72, 9, 100, -26, 89, -36, 15] },
  { t: 1.12, from: 'heave', to: 'rise', w: 0.421, man: [38, -7, 81, 58, 83, 14, 53, -62, 23], woman: [63, -11, 83, 27, 90, -23, 69, -40, 16] },
  { t: 1.16, from: 'heave', to: 'rise', w: 0.875, man: [46, -37, 82, 81, 66, 13, 29, -40, 21], woman: [68, -33, 80, 67, 73, -3, 44, -38, 8] },
  { t: 1.2, from: 'heave', to: 'rise', w: 0.995, man: [55, -51, 81, 85, 63, 6, 21, -22, 19], woman: [71, -43, 80, 79, 74, -2, 31, -29, 7] },
  { t: 1.22, from: 'rise', to: 'top', w: 0, man: [59, -57, 81, 86, 63, 1, 18, -20, 18], woman: [75, -48, 80, 78, 76, -5, 27, -25, 7] },
  { t: 1.24, from: 'rise', to: 'top', w: 0.618, man: [75, -67, 81, 93, 67, -12, 16, -3, 15], woman: [97, -48, 71, 84, 85, -9, 25, 3, 3] },
  { t: 1.28, from: 'rise', to: 'top', w: 1.088, man: [85, -74, 81, 96, 71, -29, 16, 9, 12], woman: [111, -37, 58, 77, 94, -20, 22, 28, -8] },
  { t: 1.32, from: 'rise', to: 'top', w: 1.035, man: [90, -76, 80, 97, 76, -41, 16, 14, 8], woman: [119, -35, 52, 73, 94, -32, 27, 39, -19] },
  { t: 1.71, from: 'impact', to: 'follow-through', w: 0.271, man: [102, -48, -5, 18, 110, 11, 62, 61, -86], woman: [110, -31, 29, 14, 120, -5, 70, 35, -90] },
  { t: 1.72, from: 'impact', to: 'follow-through', w: 0.488, man: [92, -56, 22, 26, 80, 21, 70, 54, -64], woman: [88, -39, 48, 36, 107, -6, 78, 31, -91] },
  { t: 1.73, from: 'impact', to: 'follow-through', w: 0.657, man: [68, -21, 61, 25, 95, 20, 73, 33, -79], woman: [86, -46, 55, 33, 101, -1, 90, 14, -74] },
  { t: 1.74, from: 'impact', to: 'follow-through', w: 0.784, man: [64, -19, 55, 26, 100, 39, 94, 5, -58], woman: [86, -53, 63, 30, 101, 1, 94, 2, -50] },
  { t: 1.75, from: 'impact', to: 'follow-through', w: 0.875, man: [63, -21, 53, 26, 102, 38, 101, -5, -42], woman: [83, -55, 74, 25, 101, 14, 96, -17, -31] },
  { t: 1.76, from: 'impact', to: 'follow-through', w: 0.936, man: [54, -31, 62, 40, 100, 36, 110, -22, -13], woman: [74, -62, 81, 34, 95, 19, 110, -39, -20] },
  { t: 1.78, from: 'impact', to: 'follow-through', w: 0.992, man: [54, -33, 62, 40, 100, 35, 111, -24, -9], woman: [74, -63, 81, 34, 98, 20, 110, -41, -20] },
  { t: 1.8, from: 'follow-through', to: 'settle', w: 0, man: [54, -34, 62, 40, 100, 34, 111, -25, -5], woman: [72, -66, 80, 29, 103, 21, 115, -40, -23] },
  { t: 1.82, from: 'follow-through', to: 'settle', w: 0.104, man: [54, -33, 61, 38, 100, 33, 111, -27, -1], woman: [71, -53, 72, 30, 100, 26, 109, -35, -26] },
  { t: 1.84, from: 'follow-through', to: 'settle', w: 0.352, man: [54, -31, 59, 35, 100, 33, 110, -28, 4], woman: [71, -40, 71, 23, 93, 30, 104, -27, -27] },
  { t: 1.86, from: 'follow-through', to: 'settle', w: 0.648, man: [56, -29, 55, 31, 100, 31, 110, -28, 9], woman: [73, -30, 65, 19, 91, 31, 105, -20, -23] },
  { t: 1.88, from: 'follow-through', to: 'settle', w: 0.896, man: [62, -33, 53, 30, 100, 28, 110, -23, 7], woman: [76, -30, 65, 15, 91, 32, 104, -10, -20] },
  { t: 1.9, from: 'settle', to: 'rest', w: 0, man: [65, -37, 64, 29, 99, 28, 105, -15, 10], woman: [76, -29, 71, 14, 93, 35, 103, -3, -13] },
  { t: 1.92, from: 'settle', to: 'rest', w: 0.104, man: [66, -46, 71, 28, 100, 27, 107, -16, 14], woman: [74, -25, 79, 14, 92, 36, 99, 1, -17] },
  { t: 1.94, from: 'settle', to: 'rest', w: 0.352, man: [64, -45, 75, 29, 100, 27, 103, -18, 13], woman: [75, -21, 80, 12, 92, 35, 101, 4, -17] },
  { t: 1.96, from: 'settle', to: 'rest', w: 0.648, man: [64, -44, 80, 25, 100, 28, 101, -18, 13], woman: [75, -19, 80, 8, 92, 34, 102, 4, -19] },
  { t: 1.98, from: 'settle', to: 'rest', w: 0.896, man: [65, -43, 80, 22, 100, 27, 100, -18, 13], woman: [76, -17, 82, 4, 91, 30, 104, 6, -19] },
];
/** A breakdown's arms as turns: the left keyed as the right's mirror (the side its elbow is kept on), its forearm's twist its own. */
const armOf = (x: Arm): Record<string, Euler> => ({
  upperarm_r: [x[0], x[1], x[2]], lowerarm_r: [x[3], x[4], 0], hand_r: [x[5], x[6], x[7]],
  upperarm_l: [x[0], -x[1], -x[2]], lowerarm_l: [x[3], x[8], 0],
});

/** The beats for a set of key poses, in order: the rest, the top and the blow are the key poses (before the breakdowns). */
export function planOf(key: (k: string) => KeyPose): Beat[] {
  const REST = key('rest'), GATHER = key('gather'), DRAG = key('drag'), AROUND = key('around'), UP = key('up'), HEAVE = key('heave'), RISE = key('rise');
  const TOP = key('top'), BLOW = key('strike'), SMEAR = key('smear'), HIT = key('impact');
  return [
    { t: 0, pose: REST, ease: 'inOut', stage: 'key', name: 'rest' },
    { t: 0.14, pose: GATHER, ease: 'inOut', name: 'gather' },
    { t: 0.52, pose: DRAG, ease: 'inOut', stage: 'key', name: 'drag' },
    { t: 0.84, pose: AROUND, ease: 'inOut', stage: 'key', name: 'around' },
    { t: 0.97, pose: UP, ease: 'in', name: 'up' },
    { t: 1.1, pose: HEAVE, ease: 'inOut', stage: 'key', name: 'heave' },
    { t: 1.22, pose: RISE, ease: 'out', name: 'rise' },
    { t: 1.34, pose: TOP, ease: 'back', back: 0.1, stage: 'key', name: 'top' },
    { t: STRIKE, pose: settle(HEAVE, TOP, 0.04), ease: 'inOut', name: 'held' },
    { t: 1.62, pose: BLOW, ease: 'in', name: 'strike' },
    { t: 1.66, pose: SMEAR, ease: 'linear', name: 'down' },
    { t: IMPACT, pose: HIT, ease: 'linear', stage: 'key', name: 'impact' },
    { t: 1.8, pose: settle(SMEAR, HIT, 0.06, true), ease: 'out', name: 'follow-through' },
    { t: 1.9, pose: toward(HIT, REST, 0.6), ease: 'inOut', name: 'settle' },
  ];
}
/** The beats for a body: its plan's, with the breakdowns put in among them (between the plan's beats they name; the beats after them reached linearly). */
function beatsOf(key: (k: string) => KeyPose, body: 'man' | 'woman'): Beat[] {
  const plan = planOf(key).map((b): Beat => {
    const at = BETWEEN.find((d) => Math.abs(d.t - b.t) < 1e-6);
    return at ? { ...b, pose: { ...b.pose, rot: { ...b.pose.rot, ...armOf(at[body]) } } } : b;
  });
  const named = new Map(plan.map((b) => [b.name, b.pose]));
  const between: Beat[] = BETWEEN.filter((d) => !plan.some((b) => Math.abs(d.t - b.t) < 1e-6)).map((d) => {
    const p = toward(named.get(d.from) as KeyPose, named.get(d.to) as KeyPose, d.w);
    return { t: d.t, pose: { rot: { ...p.rot, ...armOf(d[body]) }, move: p.move }, ease: 'linear', stage: 'breakdown' };
  });
  const all = [...plan, ...between].sort((a, b) => a.t - b.t);
  return all.map((b, i) => (i > 0 && all[i - 1].stage === 'breakdown' && b.stage !== 'breakdown' ? { ...b, ease: 'linear', back: undefined } : b));
}
export const BEATS: Beat[] = beatsOf((k) => keyOf(k), 'man');
/** The plan before the breakdowns, his and hers (for the tool that makes them). */
export const PLAN = { man: planOf((k) => keyOf(k)), woman: planOf((k) => keyOf(k, WOMAN)) };
/** Her correction: at each beat, her turns less his, keyed as the beats are. */
const HERS = beatsOf((k) => keyOf(k, WOMAN), 'woman');
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
  // the blow from the top hold's end to the point at the ground (the slash trail's: ../trail.ts)
  events: [{ t: STRIKE, name: 'strike' }, { t: IMPACT, name: 'impact' }],
  // the blade's end kept off the ground (game units), let down onto it through the drag, lifted off it by the heave,
  // let down again after the blow
  grip: {
    ground: 0.02, rest: [{ t: 0, v: 1 }, { t: 0.84, v: 1 }, { t: 1.02, v: 0 }, { t: IMPACT, v: 0 }, { t: 1.9, v: 1 }],
    // the left elbow put where its wrist bends least through the drag and the lift; as keyed over the top and the blow
    lineUp: [{ t: 0, v: 0.75 }, { t: 1.22, v: 0.75 }, { t: 1.34, v: 0 }, { t: 1.8, v: 0 }, { t: 1.96, v: 0.75 }],
  },
  stretch: [[0, 0.14], [0.14, 0.84], [1.34, STRIKE]],
  bodies: { woman: { tracks: herTracks() } },
};
