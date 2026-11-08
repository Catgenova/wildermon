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
      pelvis: [10, -6, 0], spine_01: [15, 2, 0], spine_02: [17, 2, 0], spine_03: [14, 2, 0],
      neck_01: [-20, 0, 0], neck_02: [-3, 0, 0], head: [-5, 0, 0],
      clavicle_l: [0, 0, -2], clavicle_r: [0, 0, 2],
    },
    move: [0, -0.062, 0.004],
  },
  /** Gathered before the pull: sunk lower, turned a little the other way, the weight onto the left foot. */
  gather: {
    rot: {
      pelvis: [11, -2, -2], spine_01: [14, 5, -2], spine_02: [15, 5, -2], spine_03: [12, 4, -1],
      neck_01: [-18, -3, 0], neck_02: [-3, -1, 0], head: [-5, -2, 0],
      clavicle_l: [0, 0, -3], clavicle_r: [0, 0, 3],
    },
    move: [0.008, -0.066, 0.004],
  },
  /** Pulling: turned to the right and leant into it, the weight going over onto the right foot, the hands out to the right. */
  drag: {
    rot: {
      pelvis: [11, -12, 3], spine_01: [12, -8, 5], spine_02: [12, -8, 4], spine_03: [9, -6, 3],
      neck_01: [-16, 4, 0], neck_02: [-3, 2, 0], head: [-4, 3, 0],
      clavicle_l: [0, 0, -2], clavicle_r: [0, 0, 4],
    },
    move: [-0.018, -0.066, 0],
  },
  /** Round to the right: turned furthest, the hands by the right hip, the blade out to the side on the ground. */
  around: {
    rot: {
      pelvis: [9, -16, 3], spine_01: [10, -11, 5], spine_02: [9, -11, 4], spine_03: [7, -9, 3],
      neck_01: [-13, 8, 0], neck_02: [-2, 3, 0], head: [-2, 6, 0],
      clavicle_l: [0, 0, 2], clavicle_r: [0, 0, -2],
    },
    move: [-0.024, -0.062, -0.006],
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
  rest: { upperarm_r: [80, -18, 61], lowerarm_r: [5, 55, 0], hand_r: [33, 27, 66] },
  gather: { upperarm_r: [74, 18, 50], lowerarm_r: [5, 34, 0], hand_r: [13, 13, 75] },
  drag: { upperarm_r: [72, 13, 39], lowerarm_r: [5, 15, 0], hand_r: [1, 0, 82] },
  around: { upperarm_r: [65, 23, 24], lowerarm_r: [5, 63, 0], hand_r: [10, 32, 71] },
  up: { upperarm_r: [36, 35, 24], lowerarm_r: [41, 51, 0], hand_r: [53, 71, 47] },
  heave: { upperarm_r: [70, -13, -57], lowerarm_r: [83, -49, 0], hand_r: [3, 30, -38] },
  rise: { upperarm_r: [69, 25, -14], lowerarm_r: [80, 19, 0], hand_r: [-33, 56, -54] },
  top: { upperarm_r: [112, 47, -16], lowerarm_r: [76, 25, 0], hand_r: [14, 53, -7] },
  strike: { upperarm_r: [154, 1, 9], lowerarm_r: [5, 69, 0], hand_r: [-5, 34, 38] },
  smear: { upperarm_r: [117, 7, 4], lowerarm_r: [22, 77, 0], hand_r: [63, 33, 68] },
  impact: { upperarm_r: [104, -49, 5], lowerarm_r: [9, 109, 0], hand_r: [40, 26, 76] },
};
/** Where the right fist is wanted at each key on him, body heights (across, up from the ground, forward), and the blade's way. */
export const ARM_AT: Record<string, { at: [number, number, number]; way: [number, number, number] }> = {
  rest: { at: [-0.03, 0.36, 0.25], way: [-0.15, -0.72, 0.68] },
  gather: { at: [0, 0.36, 0.22], way: [-0.05, -0.7, 0.7] },
  drag: { at: [-0.2, 0.37, 0.13], way: [-0.3, -0.7, 0.65] },
  around: { at: [-0.25, 0.39, 0.08], way: [-0.8, -0.58, 0.15] },
  up: { at: [-0.27, 0.52, 0.02], way: [-0.75, -0.45, -0.45] },
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
  rise: { upperarm_r: [83, 9, 27], lowerarm_r: [72, 26, 0], hand_r: [-30, 75, -29] },
  up: { upperarm_r: [60, 38, -5], lowerarm_r: [11, 22, 0], hand_r: [63, 120, 27] },
  heave: { upperarm_r: [91, -45, -60], lowerarm_r: [48, -48, 0], hand_r: [22, 58, -35] },
  // (bent and crouched further over the blade on the ground, her hands as low as his)
  rest: { upperarm_r: [123, 34, 7], lowerarm_r: [4, 18, 0], hand_r: [50, 59, 65], pelvis: [13, -6, 0], spine_01: [19, 2, 0], spine_02: [22, 2, 0], spine_03: [18, 2, 0], neck_01: [-26, 0, 0], $move: [0, -0.078, 0.004] },
  gather: { upperarm_r: [116, 42, 12], lowerarm_r: [12, 20, 0], hand_r: [44, 41, 74], pelvis: [14, -2, -2], spine_01: [19, 5, -2], spine_02: [21, 5, -2], spine_03: [17, 4, -1], neck_01: [-26, -3, 0], $move: [0.008, -0.084, 0.004] },
  drag: { upperarm_r: [116, 27, -8], lowerarm_r: [5, 31, 0], hand_r: [-11, 23, 62], pelvis: [14, -12, 3], spine_01: [17, -8, 5], spine_02: [17, -8, 4], spine_03: [13, -6, 3], neck_01: [-24, 4, 0], $move: [-0.018, -0.084, 0] },
  around: { upperarm_r: [80, 34, 14], lowerarm_r: [3, 10, 0], hand_r: [62, 74, 45], pelvis: [12, -16, 3], spine_01: [14, -11, 5], spine_02: [13, -11, 4], spine_03: [10, -9, 3], neck_01: [-20, 8, 0], $move: [-0.024, -0.078, -0.006] },
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
 * Breakdowns through the drag and the lift (generated, a frame apart: the fist put on a curve through the keys' fists,
 * eased as the keys are, the blade turned evenly between their ways, the right arm and the left forearm's twist solved
 * from the frame before for the wrists' bend and twist, the left fist on the grip, the forearms, the left arm and the
 * sword clear of the body, and the point on the ground through the drag): at `t`, `w` of the way from one key to the
 * next (the trunk, head and stance), the arms, his and hers. One at a key's own time puts its arms on that key. Between
 * them the beats are linear: the easing is in the breakdowns.
 */
export const BETWEEN: Array<{ t: number; from: string; to: string; w: number; man: Arm; woman: Arm }> = [];
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
/** The beats for a body: its plan's, with the breakdowns put in among them (and the beats after them reached linearly). */
function beatsOf(key: (k: string) => KeyPose, body: 'man' | 'woman'): Beat[] {
  const plan = planOf(key).map((b): Beat => {
    const at = BETWEEN.find((d) => Math.abs(d.t - b.t) < 1e-6);
    return at ? { ...b, pose: { ...b.pose, rot: { ...b.pose.rot, ...armOf(at[body]) } } } : b;
  });
  const between: Beat[] = BETWEEN.filter((d) => !plan.some((b) => Math.abs(d.t - b.t) < 1e-6)).map((d) => {
    const p = toward(key(d.from), key(d.to), d.w);
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
