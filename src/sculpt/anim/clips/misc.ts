/**
 * The gates, the carts and a few jobs of their own (`../routes.ts` CLIP_OF_JOB):
 *
 * - `crank` (raising a portcullis or a drawbridge): both fists side by side on a winch's handle at the belt's height a
 *   forearm ahead, turned round: pushed away over the top, pulled back under, the trunk leant in after the push and
 *   back after the pull, the knees given at the bottom; `crank-back` (letting either down) turned the other way.
 * - `key` (taking a padlock off): the left hand holding the lock at the chest, the right turning the key in it a quarter
 *   turn and back, twice, the head bowed to it.
 * - `cart` (taking up a cart's shafts): crouched to them at the sides, gripped, stood up with them at the hips and leant
 *   into them.
 * - `board` (taking the reins or the helm, boarding as a passenger): both hands up to the rail ahead, the right foot
 *   up onto the step, pulled up onto it onto the left toes, the hips turned toward the seat: the seat's own sat pose
 *   (`./seated.ts`) is faded into from there as the body is put on it.
 * - `bell` (ringing a bell): both fists one behind the other on the end of the bell's rope out ahead at the belt, pulled
 *   back and down to the belly with the weight onto the heels, let forward with it, the head up to the bell.
 * - `totem` (founding a settlement, upgrading one): both fists on the stake, lifted overhead and driven down into the
 *   ground ahead with the knees bent.
 * - `bauble` (setting a bauble into the altar): the right hand out to the altar, pressed in, held, drawn back.
 * - `enchant` (enchanting a statue): both palms out toward it at the chest's height, pressed toward it and eased back.
 *
 * Unhitching a team plays the tack clip (`./tend.ts`). The hands are put on their places (`Clip.hands`, the arms reached
 * to them), the rest keyed; the feet stand where the idle stands them (`plant`) but on the board, which keys them. The
 * one-handed clips (`key`, `bauble`) are played mirrored, left-handed, from the facings the flat figure works left-handed
 * from (`../index.ts` LEFT_OF).
 */
import type { Clip, HandReach, Key } from '../clip';
import { merge, mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** The base man's height in the game's units, hers 0.85 of his (as `./dig.ts`): the board's feet keyed in body heights. */
const HEIGHT = { man: 16.5, woman: 16.5 * 0.85 };
/** The feet where the idle stands them (`./idle.ts`). */
const PLANT: NonNullable<Clip['plant']> = { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } };
/** Hers closer together, as the idle stands them. */
const HER_FEET: Record<string, Euler> = { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] };

/** The fingers closed on what they hold (a handle, a rope, a stake, a shaft). */
const FIST_L: Record<string, Euler> = { fingers_01_l: [70, 0, 0], fingers_02_l: [80, 0, 0], thumb_02_l: [20, 0, 0] };
const FIST_R: Record<string, Euler> = { fingers_01_r: [70, 0, 0], fingers_02_r: [80, 0, 0], thumb_02_r: [20, 0, 0] };
/** The fingers out flat (a palm held out). */
const FLAT_L: Record<string, Euler> = { fingers_01_l: [4, 0, 0], fingers_02_l: [6, 0, 0] };
const FLAT_R: Record<string, Euler> = { fingers_01_r: [4, 0, 0], fingers_02_r: [6, 0, 0] };
/** The right finger and thumb pinched on a key. */
const PINCH_R: Record<string, Euler> = { fingers_01_r: [55, 0, 0], fingers_02_r: [65, 0, 0], thumb_02_r: [30, 0, 0] };
/** The arms keyed before the reach: each elbow out and down, which side the reach keeps it on (`Clip.hands`). */
const ELBOWS: Record<string, Euler> = { upperarm_l: [20, 0, 12], lowerarm_l: [70, 0, 0], upperarm_r: [20, 0, -12], lowerarm_r: [70, 0, 0] };
/** The arms keyed before a reach above the shoulders: the elbows forward and in, under the hands, off the shawl's sides. */
const RAISED: Record<string, Euler> = { upperarm_l: [70, 0, 4], lowerarm_l: [60, 0, 0], upperarm_r: [70, 0, -4], lowerarm_r: [60, 0, 0] };
/** The left arm hanging loose at the side, a little forward. */
const HANG_L: Record<string, Euler> = { upperarm_l: [6, 0, 6], lowerarm_l: [22, 0, 0], hand_l: [0, -40, 0], fingers_01_l: [14, 0, 0], fingers_02_l: [20, 0, 0] };

/** A beat of a clip here: a key pose and where each reached hand is (body heights across to the left, up, forward). */
interface HandBeat extends Beat { hands?: Partial<Record<'l' | 'r', Euler>>; ways?: Partial<Record<'l' | 'r', Euler>> }
/** The reached hands' places (or their grips' ways, `ways`) from the beats that give them, eased as the beats are. */
function handKeys(beats: HandBeat[], side: 'l' | 'r', what: 'hands' | 'ways' = 'hands'): Array<Key<Euler>> {
  return beats.filter((b) => b[what]?.[side]).map((b) => ({ t: b.t, v: b[what]?.[side] as Euler, ...(b.ease ? { ease: b.ease } : {}) }));
}
/**
 * A clip from its beats: the feet planted as the idle stands them (or keyed, when every beat places them), the hands
 * reached where the beats put them along `way` (or the beats' `ways`); looped unless `o.loop` is false.
 */
function handClip(name: string, length: number, beats: HandBeat[], way: Partial<Record<'l' | 'r', Euler>>, o: Partial<Clip> & { lag?: Record<string, number> } = {}): Clip {
  const { lag, ...rest } = o, loop = o.loop ?? true;
  const { footKeys, ...keys } = poseToPose(beats, { length, loop, lag });
  const hands: Partial<Record<'l' | 'r', HandReach>> = {};
  for (const s of ['l', 'r'] as const) {
    if (!way[s]) continue;
    const ways = handKeys(beats, s, 'ways');
    hands[s] = { at: handKeys(beats, s), way: way[s] as Euler, ...(ways.length ? { ways } : {}) };
  }
  return {
    name, loop, length, mask: 'full', plant: PLANT, breath: { count: 1, depth: 0.5 }, armsFree: true,
    tracks: keys.tracks, move: keys.move, poses: keys.poses, hands,
    ...(footKeys ? { feet: { stride: HEIGHT.man, ...footKeys } } : {}),
    bodies: { woman: { add: HER_FEET, ...(footKeys ? { feet: { stride: HEIGHT.woman } } : {}) } },
    ...rest,
  };
}

/* ---- G1 crank: a portcullis's or a drawbridge's winch ------------------------------------------------------------ */
/** Seconds a turn of the handle. */
const CRANK_LENGTH = 1.4;
/** The handle's hub (body heights: across, up, forward) and how far out from it the handle goes round; each fist's side. */
const HUB: Euler = [0, 0.57, 0.235], THROW = 0.075, FIST_X = 0.045;
/** Stood square to the winch, both fists side by side on its handle. */
const CRANK_BASE: KeyPose = {
  rot: { ...ELBOWS, ...FIST_L, ...FIST_R, spine_01: [3, 0, 0], spine_02: [3, 0, 0], neck_01: [-2, 0, 0], head: [8, 0, 0] },
  move: [0, -0.01, 0],
};
/**
 * The beats of a turn, the handle at the top first: eight steps round, turned away over the top (`sense` 1: raising) or
 * toward the body over it (-1: letting down); leant in as far as the handle is out, the knees given as low as it is.
 */
function crankBeats(sense: 1 | -1): HandBeat[] {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((k): HandBeat => {
    const a = (k * Math.PI) / 4, out = Math.sin(a) * sense, up = Math.cos(a);
    const at = (x: number): Euler => [x, HUB[1] + up * THROW, HUB[2] + out * THROW];
    return {
      t: (k * CRANK_LENGTH) / 8, ease: 'linear', stage: k % 2 ? undefined : 'key', name: ['top', '', 'out', '', 'bottom', '', 'in', ''][k] || undefined,
      pose: merge(CRANK_BASE, { rot: { pelvis: [4 + 4 * out, 0, 0], spine_02: [3 + 3 * out, 0, 0], spine_03: [1 + 2 * out, 0, 0], head: [8 - 2 * out, 0, 0] }, move: [0, -0.012 - 0.012 * (1 - up) / 2, 0.012 * out] }),
      hands: { r: at(-FIST_X), l: at(FIST_X) },
    };
  });
}
/** Her arms shorter for her height: the handle nearer and lower. */
const CRANK_O = { lag: { spine_02: 0.05, spine_03: 0.07, head: 0.1, pelvis: 0.04 }, bodies: { woman: { add: HER_FEET, hands: { l: [0, -0.02, -0.09] as Euler, r: [0, -0.02, -0.09] as Euler } } } };
export const CRANK = handClip('crank', CRANK_LENGTH, crankBeats(1), { l: [-1, 0, 0], r: [1, 0, 0] }, CRANK_O);
export const CRANK_BACK = handClip('crank-back', CRANK_LENGTH, crankBeats(-1), { l: [-1, 0, 0], r: [1, 0, 0] }, CRANK_O);

/* ---- G2 key: a padlock taken off ---------------------------------------------------------------------------------- */
/** Seconds a run: the key turned (0.5), back (0.8), turned again (1.2), held, drawn back to turn again. */
const KEY_LENGTH = 2;
/** The lock held in the left hand at the chest, the key in it a fist's width to its right. */
const LOCK: Euler = [0.04, 0.64, 0.27], KEYHOLE: Euler = [-0.03, 0.65, 0.285], TURNED_AT: Euler = [-0.045, 0.635, 0.28];
const KEY_BASE: KeyPose = {
  rot: { ...ELBOWS, ...FIST_L, ...PINCH_R, spine_02: [3, 0, 0], spine_03: [2, 0, 0], neck_01: [6, 0, 0], neck_02: [4, 0, 0], head: [14, 0, 0] },
  move: [0, -0.008, 0.004],
};
/** The key turned: the right elbow lifted out with the turn, the head cocked after it. */
const KEY_TURNED: KeyPose = merge(KEY_BASE, { rot: { upperarm_r: [20, 0, -40], head: [14, -3, -4] } });
/** The key's grip upright, and turned a quarter to the right (the thumb's way laid over). */
const UPRIGHT: Euler = [0, 1, 0], TURNED: Euler = [-0.95, 0.3, 0];
const KEY_BEATS: HandBeat[] = [
  { t: 0, pose: KEY_BASE, ease: 'inOut', stage: 'key', name: 'key in', hands: { l: LOCK, r: KEYHOLE }, ways: { r: UPRIGHT } },
  { t: 0.5, pose: KEY_TURNED, ease: 'inOut', stage: 'key', name: 'turned', hands: { l: LOCK, r: TURNED_AT }, ways: { r: TURNED } },
  { t: 0.8, pose: KEY_BASE, ease: 'inOut', name: 'back', hands: { l: LOCK, r: KEYHOLE }, ways: { r: [-0.4, 0.9, 0] } },
  { t: 1.2, pose: KEY_TURNED, ease: 'inOut', stage: 'key', name: 'turned again', hands: { l: LOCK, r: TURNED_AT }, ways: { r: TURNED } },
  { t: 1.6, pose: KEY_TURNED, ease: 'inOut', name: 'held', hands: { l: [0.04, 0.63, 0.26], r: [-0.045, 0.625, 0.27] }, ways: { r: TURNED } },
];
/** Her arms shorter for her height: the lock held nearer. */
export const KEY = handClip('key', KEY_LENGTH, KEY_BEATS, { l: [0, 1, 0], r: UPRIGHT }, { lag: { head: 0.08 }, stretch: [[1.2, 1.6]], bodies: { woman: { add: HER_FEET, hands: { l: [0, -0.01, -0.06], r: [0, -0.01, -0.06] } } } });

/* ---- C1 cart: a cart's shafts taken up ---------------------------------------------------------------------------- */
/** Seconds: crouched to the shafts (0.45), gripped (to 0.7), stood with them (1.1), leant into them (1.5). */
const CART_LENGTH = 1.5;
/** Each shaft's place at the hand, the right's: low at the side, at the hip, and at the hip leant into. */
const SHAFT_LOW: Euler = [-0.175, 0.33, 0.06], SHAFT_UP: Euler = [-0.175, 0.46, 0.02], SHAFT_LEANT: Euler = [-0.175, 0.45, -0.02];
const across = (v: Euler): Euler => [-v[0], v[1], v[2]];
/** The right fist hanging at the side, a little forward: where the hands start from stood. */
const HANG: Euler = [-0.15, 0.51, 0.07];
/** Her hands nearer the middle at the sides (her hips narrower for her height), and nearer to reach ahead. */
const HER_SIDES: Partial<Record<'l' | 'r', Euler>> = { l: [-0.03, 0.03, -0.01], r: [0.03, 0.03, -0.01] };
const CART_STAND: KeyPose = { rot: { ...ELBOWS, ...FLAT_L, ...FLAT_R, upperarm_l: [4, 0, 14], upperarm_r: [4, 0, -14], lowerarm_l: [20, 0, 0], lowerarm_r: [20, 0, 0] } };
/** Crouched to the shafts: the hips let down, the trunk over the thighs, the head up. */
const CART_DOWN: KeyPose = {
  rot: {
    ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [22, 0, 0], spine_01: [6, 0, 0], spine_02: [6, 0, 0], spine_03: [3, 0, 0], neck_01: [-10, 0, 0], head: [6, 0, 0],
    thigh_l: [40, -4, 8], thigh_r: [40, 4, -8], calf_l: [-70, 0, 0], calf_r: [-70, 0, 0],
  },
  move: [0, -0.1, 0.02],
};
/** Stood with the shafts at the hips: upright, the arms down along the sides. */
const CART_UP: KeyPose = { rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [2, 0, 0], spine_02: [1, 0, 0], head: [2, 0, 0] }, move: [0, -0.006, 0] };
/** Leant into them: the trunk forward from the ankles, the head up ahead. */
const CART_LEANT: KeyPose = { rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [10, 0, 0], spine_01: [3, 0, 0], spine_02: [2, 0, 0], neck_01: [-6, 0, 0], head: [-4, 0, 0] }, move: [0, -0.014, 0.02] };
const CART_BEATS: HandBeat[] = [
  { t: 0, pose: CART_STAND, ease: 'inOut', name: 'stood', hands: { r: HANG, l: across(HANG) } },
  { t: 0.45, pose: CART_DOWN, ease: 'inOut', stage: 'key', name: 'down to the shafts', hands: { r: SHAFT_LOW, l: across(SHAFT_LOW) } },
  { t: 0.7, pose: CART_DOWN, ease: 'linear', name: 'gripped', hands: { r: SHAFT_LOW, l: across(SHAFT_LOW) } },
  { t: 1.1, pose: CART_UP, ease: 'inOut', stage: 'key', name: 'stood with them', hands: { r: SHAFT_UP, l: across(SHAFT_UP) } },
  { t: CART_LENGTH, pose: CART_LEANT, ease: 'inOut', stage: 'key', name: 'leant in', hands: { r: SHAFT_LEANT, l: across(SHAFT_LEANT) } },
];
export const CART = handClip('cart', CART_LENGTH, CART_BEATS, { l: [0, 0, 1], r: [0, 0, 1] }, { loop: false, oneAGo: true, lag: { head: 0.06 }, stretch: [[0.45, 0.7]], bodies: { woman: { add: HER_FEET, hands: HER_SIDES } } });

/* ---- C2 board: climbing aboard a vehicle ------------------------------------------------------------------------- */
/** Seconds: hands to the rail and the foot up (0.35), on the step (0.6), pulled up (1.0), swung in toward the seat. */
const BOARD_LENGTH = 1.5;
/** The rail ahead, each fist's place on it (the right's). */
const RAIL: Euler = [-0.13, 0.66, 0.3];
const FLAT = { z: 0, lift: 0, pitch: 0 };
const BOARD_STAND: KeyPose = { rot: { ...HANG_L, upperarm_r: [6, 0, -6], lowerarm_r: [22, 0, 0], hand_r: [0, 40, 0], fingers_01_r: [14, 0, 0], fingers_02_r: [20, 0, 0] }, feet: { l: FLAT, r: FLAT } };
/** Reached to the rail, the right knee up and the foot on its way to the step. */
const BOARD_REACH: KeyPose = {
  rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [6, 0, 0], spine_02: [3, 0, 0], neck_01: [-4, 0, 0], head: [-4, 0, 0] },
  move: [0, -0.01, 0.01],
  feet: { l: FLAT, r: { z: 0.1, lift: 0.1, pitch: 10 } },
};
/** The right foot on the step, the weight onto it. */
const BOARD_STEP: KeyPose = {
  rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [12, 0, 0], spine_01: [4, 0, 0], spine_02: [4, 0, 0], neck_01: [-6, 0, 0], head: [-2, 0, 0] },
  move: [0, -0.02, 0.05],
  feet: { l: { z: 0, lift: 0, pitch: -20 }, r: { z: 0.13, lift: 0.12, pitch: 0 } },
};
/**
 * Pulled up onto it: the body up over the step, the left heel off the ground and the weight on its toes, the arms bent.
 * (A body is drawn stood on its lowest sole, `../../lowpoly.ts`: the left foot's toes stay on the ground throughout.)
 */
const BOARD_UP: KeyPose = {
  rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [10, 0, 0], spine_01: [3, 0, 0], spine_02: [2, 0, 0], neck_01: [-4, 0, 0], head: [0, 0, 0] },
  move: [0, 0.045, 0.09],
  feet: { l: { z: 0, lift: 0, pitch: -40 }, r: { z: 0.13, lift: 0.12, pitch: 0 } },
};
/** Swung in: the hips turned toward the seat and sat back over the step, the trunk upright, the right hand still on the rail. */
const BOARD_IN: KeyPose = {
  rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [-2, -22, 0], spine_01: [4, 6, 0], spine_02: [4, 6, 0], spine_03: [2, 4, 0], neck_01: [2, 3, 0], head: [2, 3, 0] },
  move: [0.01, 0.05, 0.11],
  feet: { l: { z: 0.02, lift: 0, pitch: -55 }, r: { z: 0.13, lift: 0.12, pitch: 0 } },
};
const BOARD_BEATS: HandBeat[] = [
  { t: 0, pose: BOARD_STAND, ease: 'inOut', name: 'stood', hands: { r: HANG, l: across(HANG) } },
  { t: 0.35, pose: BOARD_REACH, ease: 'inOut', stage: 'key', name: 'reached up', hands: { r: RAIL, l: across(RAIL) } },
  { t: 0.6, pose: BOARD_STEP, ease: 'inOut', stage: 'key', name: 'on the step', hands: { r: RAIL, l: across(RAIL) } },
  { t: 1.0, pose: BOARD_UP, ease: 'inOut', stage: 'key', name: 'pulled up', hands: { r: RAIL, l: across(RAIL) } },
  { t: BOARD_LENGTH, pose: BOARD_IN, ease: 'inOut', stage: 'key', name: 'swung in', hands: { r: RAIL, l: [0.12, 0.66, 0.36] } },
];
export const BOARD = handClip('board', BOARD_LENGTH, BOARD_BEATS, { l: [0, 1, 0], r: [0, 1, 0] }, {
  loop: false, oneAGo: true, lag: { head: 0.06 },
  bodies: { woman: { add: HER_FEET, feet: { stride: HEIGHT.woman }, hands: { l: [-0.03, 0.02, -0.04], r: [0.03, 0.02, -0.04] } } },
});

/* ---- B1 bell: a bell rope pulled ----------------------------------------------------------------------------------- */
/** Seconds a pull: back (0.45), held (to 0.6), let forward with the rope. */
const BELL_LENGTH = 1.3;
/**
 * The bell's rope (hung from its clapper to below the waist, under a bell as wide as a body's height is half of) at its
 * end, reached for out ahead at the belt, and pulled back and down to the belly: the right fist's place, the left's a fist
 * nearer and below on the rope's slant.
 */
const ROPE_OUT: Euler = [-0.01, 0.54, 0.27], ROPE_IN: Euler = [-0.01, 0.5, 0.17], BELOW: Euler = [0.02, -0.035, -0.035];
const below = (v: Euler): Euler => [v[0] + BELOW[0], v[1] + BELOW[1], v[2] + BELOW[2]];
/** Reached out to the rope: bent from the hips toward it, the head up to the bell. */
const BELL_OUT: KeyPose = { rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [14, 0, 0], spine_01: [4, 0, 0], spine_02: [3, 0, 0], neck_01: [-10, 0, 0], head: [-10, 0, 0] }, move: [0, -0.02, 0.015] };
/** Pulled: the weight back onto the heels, the knees given, the trunk upright over them. */
const BELL_IN: KeyPose = { rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [2, 0, 0], spine_01: [0, 0, 0], spine_02: [-2, 0, 0], neck_01: [-6, 0, 0], head: [-8, 0, 0], thigh_l: [12, 0, 4], thigh_r: [12, 0, -4] }, move: [0, -0.045, -0.02] };
const BELL_BEATS: HandBeat[] = [
  { t: 0, pose: BELL_OUT, ease: 'out', stage: 'key', name: 'reached out', hands: { r: ROPE_OUT, l: below(ROPE_OUT) } },
  { t: 0.45, pose: BELL_IN, ease: 'in', stage: 'key', name: 'pulled', hands: { r: ROPE_IN, l: below(ROPE_IN) } },
  { t: 0.6, pose: BELL_IN, ease: 'out', name: 'held', hands: { r: [ROPE_IN[0], ROPE_IN[1] - 0.005, ROPE_IN[2] - 0.005], l: below([ROPE_IN[0], ROPE_IN[1] - 0.005, ROPE_IN[2] - 0.005]) } },
];
/** Her arms shorter for her height: the rope's end nearer. */
export const BELL = handClip('bell', BELL_LENGTH, BELL_BEATS, { l: [0, 0.6, 0.8], r: [0, 0.6, 0.8] }, { lag: { head: 0.08, spine_03: 0.04 }, bodies: { woman: { add: HER_FEET, hands: { l: [0, 0.01, -0.05], r: [0, 0.01, -0.05] } } } });

/* ---- D1 totem: a settlement's stake driven in --------------------------------------------------------------------- */
/** Seconds a drive: lifted overhead (0.8), held (to 1.0), driven down (1.25), let settle. */
const TOTEM_LENGTH = 2;
/** The stake's head in both fists (the right's above): driven in ahead, and lifted over the head. */
const STAKE_DOWN: Euler = [-0.01, 0.48, 0.25], STAKE_UP: Euler = [-0.01, 0.9, 0.18], STAKE_BELOW: Euler = [0.02, -0.06, 0];
const stake = (v: Euler): Euler => [v[0] + STAKE_BELOW[0], v[1] + STAKE_BELOW[1], v[2] + STAKE_BELOW[2]];
/** Bent over the stake driven in: the knees bent, the trunk over it, the head down to it. */
const TOTEM_LOW: KeyPose = {
  rot: { ...ELBOWS, ...FIST_L, ...FIST_R, pelvis: [26, 0, 0], spine_01: [8, 0, 0], spine_02: [8, 0, 0], spine_03: [5, 0, 0], neck_01: [-6, 0, 0], head: [10, 0, 0], thigh_l: [20, 0, 4], thigh_r: [20, 0, -4] },
  move: [0, -0.07, 0.03],
};
/** Stood with it overhead: up on the balls of the feet, leant back a touch, the head up to it. */
const TOTEM_HIGH: KeyPose = { rot: { ...RAISED, ...FIST_L, ...FIST_R, pelvis: [-3, 0, 0], spine_02: [-4, 0, 0], spine_03: [-4, 0, 0], neck_01: [-6, 0, 0], head: [-12, 0, 0] }, move: [0, 0.004, -0.01] };
const TOTEM_BEATS: HandBeat[] = [
  { t: 0, pose: TOTEM_LOW, ease: 'inOut', stage: 'key', name: 'driven in', hands: { r: STAKE_DOWN, l: stake(STAKE_DOWN) } },
  { t: 0.8, pose: TOTEM_HIGH, ease: 'inOut', stage: 'key', name: 'overhead', hands: { r: STAKE_UP, l: stake(STAKE_UP) } },
  { t: 1.0, pose: TOTEM_HIGH, ease: 'linear', name: 'held', hands: { r: STAKE_UP, l: stake(STAKE_UP) } },
  { t: 1.25, pose: TOTEM_LOW, ease: 'in', stage: 'key', name: 'driven', hands: { r: STAKE_DOWN, l: stake(STAKE_DOWN) } },
];
export const TOTEM = handClip('totem', TOTEM_LENGTH, TOTEM_BEATS, { l: [0, 1, 0], r: [0, 1, 0] }, {
  lag: { head: 0.06, spine_03: 0.03 },
  events: [{ t: 1.25, name: 'impact' }],
  stretch: [[0.8, 1.0], [1.25, TOTEM_LENGTH]],
  bodies: { woman: { add: HER_FEET, hands: { l: [0, 0.01, -0.08], r: [0, 0.01, -0.08] } } },
});

/* ---- D2 bauble: set into the altar --------------------------------------------------------------------------------- */
/** Seconds: the hand out (0.6), pressed in (0.9), held (to 1.6), drawn back. */
const BAUBLE_LENGTH = 2;
const BAUBLE_BASE: KeyPose = { rot: { ...ELBOWS, ...HANG_L, ...PINCH_R, spine_02: [4, 0, 0], spine_03: [2, 0, 0], neck_01: [4, 0, 0], head: [12, 0, 0] }, move: [0, -0.01, 0.006] };
const BAUBLE_IN: KeyPose = merge(BAUBLE_BASE, { rot: { pelvis: [10, 6, 0], spine_02: [6, 4, 0], head: [12, 2, 0] }, move: [0, -0.018, 0.024] });
const BAUBLE_BEATS: HandBeat[] = [
  { t: 0, pose: BAUBLE_BASE, ease: 'inOut', stage: 'key', name: 'in hand', hands: { r: [-0.1, 0.55, 0.2] } },
  { t: 0.6, pose: BAUBLE_IN, ease: 'inOut', stage: 'key', name: 'out to it', hands: { r: [-0.06, 0.64, 0.3] } },
  { t: 0.9, pose: BAUBLE_IN, ease: 'inOut', stage: 'key', name: 'pressed in', hands: { r: [-0.06, 0.63, 0.33] } },
  { t: 1.6, pose: BAUBLE_IN, ease: 'linear', name: 'held', hands: { r: [-0.06, 0.63, 0.33] } },
];
export const BAUBLE = handClip('bauble', BAUBLE_LENGTH, BAUBLE_BEATS, { r: [0, 1, 0] }, { lag: { head: 0.08 }, stretch: [[0.9, 1.6]], bodies: { woman: { add: HER_FEET, hands: { r: [0, -0.01, -0.04] } } } });

/* ---- D3 enchant: a statue enchanted ------------------------------------------------------------------------------- */
/** Seconds a run: pressed toward it (1.0), held (to 1.6), eased back. */
const ENCHANT_LENGTH = 2.4;
/** The palms out ahead at the chest, the right's place: drawn in and pressed out. */
const PALM_IN: Euler = [-0.1, 0.68, 0.28], PALM_OUT: Euler = [-0.11, 0.67, 0.34];
const ENCHANT_BASE: KeyPose = { rot: { ...ELBOWS, ...FLAT_L, ...FLAT_R, spine_02: [2, 0, 0], neck_01: [2, 0, 0], head: [8, 0, 0] }, move: [0, -0.008, 0] };
const ENCHANT_OUT: KeyPose = merge(ENCHANT_BASE, { rot: { pelvis: [5, 0, 0], spine_02: [4, 0, 0], spine_03: [2, 0, 0], head: [6, 0, 0] }, move: [0, -0.014, 0.018] });
const ENCHANT_BEATS: HandBeat[] = [
  { t: 0, pose: ENCHANT_BASE, ease: 'inOut', stage: 'key', name: 'drawn in', hands: { r: PALM_IN, l: across(PALM_IN) } },
  { t: 1.0, pose: ENCHANT_OUT, ease: 'inOut', stage: 'key', name: 'pressed out', hands: { r: PALM_OUT, l: across(PALM_OUT) } },
  { t: 1.6, pose: ENCHANT_OUT, ease: 'linear', name: 'held', hands: { r: [PALM_OUT[0], PALM_OUT[1], PALM_OUT[2] + 0.005], l: across([PALM_OUT[0], PALM_OUT[1], PALM_OUT[2] + 0.005]) } },
];
/** The palms facing ahead, the fingers up: the thumbs' way in toward the middle, the knuckles up. */
const PALMS = handClip('enchant', ENCHANT_LENGTH, ENCHANT_BEATS, { l: [-1, 0, 0], r: [1, 0, 0] }, { lag: { head: 0.08 }, stretch: [[1.0, 1.6]], bodies: { woman: { add: HER_FEET, hands: { l: [0, -0.02, -0.07], r: [0, -0.02, -0.07] } } } });
const UP: Array<Key<Euler>> = [{ t: 0, v: [0, 1, 0.3] }];
export const ENCHANT: Clip = { ...PALMS, hands: Object.fromEntries(Object.entries(PALMS.hands ?? {}).map(([s, h]) => [s, { ...h, knuckles: UP }])) };

/** Every clip here, and the mirrors of the one-handed ones, by name (`../index.ts` CLIPS, LEFT_OF). */
const BOTH = [CRANK, CRANK_BACK, CART, BOARD, BELL, TOTEM, ENCHANT], ONE = [KEY, BAUBLE];
export const MISC_CLIPS: Record<string, Clip> = Object.fromEntries([
  ...BOTH.map((c) => [c.name, c]),
  ...ONE.flatMap((c) => [[c.name, c], [`${c.name}-left`, mirrorClip(c, `${c.name}-left`)]]),
]);
export const MISC_LEFT: Record<string, string> = Object.fromEntries(ONE.map((c) => [c.name, `${c.name}-left`]));
