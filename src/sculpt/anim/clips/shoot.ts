/**
 * F2, a shot with a bow: stood side-on to the mark, the left side leading, the bow held up in the left fist at arm's
 * length toward it; the string drawn to the chin, held while it aims, loosed (the drawing hand flicked back past the
 * ear), a fresh arrow taken from the quiver over the right shoulder and laid to the string. A fight with an archery
 * weapon plays it (`../index.ts` clipFor), one shot a go, the aim held as long as the go asks (`stretch`).
 *
 * The fists are reached to their places (`Clip.hands`): the bow's grip ahead of the left shoulder, upright; the drawing
 * fist at the string, then at the chin, behind the ear, at the quiver's mouth. The bow is drawn in the left fist while it
 * plays (`Clip.wields`), its string to the drawing fist while it is drawn and the arrow on that fist from the quiver to
 * the loose (`Clip.bow`, `../../lowpoly.ts`).
 */
import type { Clip, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** One shot: the draw, the aim, the loose, the reach to the quiver and back to the string. */
const LENGTH = 2.2;
const DRAWN = 0.55, LOOSE = 1.2, FLICK = 1.3, QUIVER = 1.72, NOCK = 2.05;

/** The stance: side-on, the left foot toward the mark, the hips and the trunk turned to the right; hers closer. */
const STANCE: Record<string, Euler> = { pelvis: [0, -38, 0], thigh_l: [0, 30, 10], thigh_r: [0, 46, -10] };
/** The trunk turned on further, the head turned back to the mark and lowered onto the arrow. */
const TRUNK: Record<string, Euler> = { spine_01: [0, -6, 0], spine_02: [0, -8, 1], spine_03: [0, -8, 2], neck_01: [0, 20, 0], neck_02: [0, 18, 0], head: [6, 24, 4] };
/** The arms as the reach starts them: the bow arm out ahead, the drawing arm raised out to the side, its elbow up and back. */
const ARMS: Record<string, Euler> = {
  clavicle_l: [0, 0, 0], upperarm_l: [80, 0, -10], lowerarm_l: [8, 0, 0],
  clavicle_r: [0, 0, 6], upperarm_r: [75, 50, 40], lowerarm_r: [120, 0, 0],
};

const READY: KeyPose = { rot: { ...STANCE, ...TRUNK, ...ARMS, head: [8, 18, 3] } };
/** At full draw: the shoulders squared to the line, the drawing elbow behind, the head down onto the string. */
const FULL: KeyPose = merge(READY, { rot: { spine_03: [-2, -10, 2], clavicle_r: [0, 0, 2], head: [6, 26, 5] } });
/** Loosed: the drawing hand flicked back, the bow arm dropped a touch. */
const LOOSED: KeyPose = merge(FULL, { rot: { spine_03: [-3, -12, 2], head: [4, 26, 5] } });
/** The reach to the quiver: the trunk a little up and round, the head turned a little after the hand. */
const REACH: KeyPose = merge(READY, { rot: { spine_03: [-4, -2, 0], head: [2, 14, 2], clavicle_r: [0, 0, 14] } });

export const BEATS: Beat[] = [
  { t: 0, pose: READY, ease: 'inOut', stage: 'key', name: 'nocked' },
  { t: DRAWN, pose: FULL, ease: 'inOut', stage: 'key', name: 'full draw' },
  { t: LOOSE, pose: FULL, ease: 'linear', name: 'aim' },
  { t: FLICK, pose: LOOSED, ease: 'out', stage: 'key', name: 'loose' },
  { t: QUIVER, pose: REACH, ease: 'inOut', stage: 'key', name: 'quiver' },
];
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true });

/** Where the fists go, body heights (across to the left, up, forward), in the frame the feet stand in. */
const GRIP: Euler = [0.0, 0.795, 0.43];
const STRING: Euler = [0.0, 0.83, 0.33];
const ANCHOR: Euler = [-0.015, 0.84, 0.035];
const BEHIND: Euler = [-0.05, 0.86, -0.02];
const QUIVER_AT: Euler = [-0.09, 0.95, -0.09];
const key = (t: number, v: Euler, ease: Key<Euler>['ease'] = 'inOut'): Key<Euler> => ({ t, v, ease });

export const SHOOT: Clip = {
  name: 'shoot',
  loop: true,
  length: LENGTH,
  mask: 'full',
  plant: { rot: STANCE },
  breath: { count: 1, depth: 0.4 },
  ...KEYS,
  armsFree: true,
  hands: {
    l: { at: [key(0, GRIP), key(LOOSE, GRIP), key(FLICK, [GRIP[0], GRIP[1] - 0.006, GRIP[2]], 'out'), key(QUIVER, [GRIP[0] + 0.01, GRIP[1] - 0.02, GRIP[2] - 0.03])], way: [0, 1, 0] },
    r: { at: [key(0, STRING), key(DRAWN, ANCHOR), key(LOOSE, ANCHOR, 'linear'), key(FLICK, BEHIND, 'out'), key(QUIVER, QUIVER_AT), key(NOCK, STRING)], way: [0, 1, 0] },
  },
  wields: 'l',
  bow: { drawn: [0, LOOSE], arrow: [QUIVER, LENGTH], full: (DRAWN + LOOSE) / 2 },
  events: [{ t: LOOSE, name: 'loose' }],
  // at the loose, the string's flicker from tip to tip and the streak where the arrow flies, from the nock through its rest
  // (`../../../render/fx/combat.ts`)
  fx: [
    { at: LOOSE, from: { tool: 'top', side: 'l' }, to: { tool: 'bottom', side: 'l' }, kind: 'twang' },
    { at: LOOSE, from: { tool: 'rest', side: 'l' }, to: { bone: 'hand_r' }, kind: 'loose' },
  ],
  // a go fitted to its length by the aim (the draw and the loose keep their speed)
  stretch: [[DRAWN, LOOSE]],
  bodies: {
    woman: { add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] } },
  },
};
