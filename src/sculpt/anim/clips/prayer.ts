/**
 * P1 to P3, knelt at prayer: on both knees with the toes tucked under, the trunk upright over the knees. Praying
 * (`pray`): the hands pressed together before the chest, the head bowed over them, bowed a little lower and back up
 * over a run. At a statue (`pray-statue`): the same, the hands at the chin and the head raised to the statue ahead. A
 * sacrifice (`sacrifice`): both hands cupped palm up, gathered at the waist, raised high ahead, held, then bowed down to
 * lay them at the ground ahead, and back. The knees and the balls of the feet planted throughout.
 *
 * The idle stands the feet where these do (`plant`), so the fade in and out of it (`../index.ts` SETTLE) is the getting
 * down onto the knees and up off them, as the ground's (`./ground.ts`).
 */
import type { Clip, HandReach, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** Each foot rolled up onto its toes about the ball, degrees (the toes kept flat on the ground). */
const TOES = 70;
const FEET: KeyPose['feet'] = { l: { z: 0, lift: 0, pitch: -TOES }, r: { z: 0, lift: 0, pitch: -TOES } };

/**
 * Knelt upright: the thighs straight down from the hips, the knees on the ground a shin's length ahead of the feet, the
 * hips over them; the back held up, the shoulders let forward a little. The legs are bent to reach the feet (`plant`).
 */
const KNELT: KeyPose = {
  rot: {
    pelvis: [3, 0, 0], spine_01: [2, 0, 0], spine_02: [2, 0, 0], spine_03: [1, 0, 0], clavicle_l: [6, 0, 0], clavicle_r: [6, 0, 0],
    thigh_l: [2, 0, 3], thigh_r: [2, 0, -3], calf_l: [-90, 0, 0], calf_r: [-90, 0, 0],
  },
  move: [0, -0.274, 0.22],
  feet: FEET,
};

/** The hands clasped, the fingers of each closed over the other's. */
const FLAT: Record<string, Euler> = { fingers_01_l: [50, 0, 0], fingers_02_l: [60, 0, 0], fingers_01_r: [50, 0, 0], fingers_02_r: [60, 0, 0], thumb_02_l: [10, 0, 0], thumb_02_r: [10, 0, 0] };
/** The hands cupped, palm up. */
const CUP: Record<string, Euler> = { fingers_01_l: [22, 0, 0], fingers_02_l: [24, 0, 0], fingers_01_r: [22, 0, 0], fingers_02_r: [24, 0, 0] };
/** The elbows down at the sides and a little out, which side each reached arm bends to (`Clip.hands`). */
const ELBOWS: Record<string, Euler> = { upperarm_l: [20, 0, 12], upperarm_r: [20, 0, -12], lowerarm_l: [90, 0, 0], lowerarm_r: [90, 0, 0] };
/** The elbows forward and out, the arms raised ahead. */
const RAISED: Record<string, Euler> = { upperarm_l: [70, 0, 18], upperarm_r: [70, 0, -18], lowerarm_l: [40, 0, 0], lowerarm_r: [40, 0, 0] };

/** A key pose knelt, its trunk and head turned further, its hands at their places (`HAND_AT`). */
const knelt = (rot: Record<string, Euler>, move?: Euler): KeyPose => merge(KNELT, { rot, feet: FEET, ...(move ? { move } : {}) });

/** How far across each hand's place is from the middle, body heights, clasped together: the two fists closed on one place. */
const PRESS = 0.004;
/** Clasped: each grip's way toward its thumb up and a little back, the knuckles along the forearms toward each other. */
const CLASP = { l: [0, 1, -0.25] as Euler, r: [0, 1, -0.25] as Euler };

/* ---- praying ------------------------------------------------------------------------------------------------------- */

/** A run of prayer: the bow held, bowed lower, held, back up, seconds. */
const PRAY = 7;
/** Bowed over the hands: the neck and head down, the shoulders a little round. */
const BOWED = knelt({ ...ELBOWS, ...FLAT, spine_02: [4, 0, 0], spine_03: [5, 0, 0], neck_01: [12, 0, 0], neck_02: [8, 0, 0], head: [16, 0, 0] });
/** Bowed lower: the back rounded over the hands from the waist, the head further down. */
const LOWER = knelt({ ...ELBOWS, ...FLAT, pelvis: [12, 0, 0], spine_01: [7, 0, 0], spine_02: [11, 0, 0], spine_03: [11, 0, 0], neck_01: [18, 0, 0], neck_02: [12, 0, 0], head: [24, 0, 0] }, [0, -0.282, 0.224]);
const PRAY_BEATS: Beat[] = [
  { t: 0, pose: BOWED, ease: 'inOut', stage: 'key', name: 'bowed' },
  { t: 2.4, pose: BOWED, ease: 'inOut' },
  { t: 3.8, pose: LOWER, ease: 'inOut', stage: 'key', name: 'bowed lower' },
  { t: 5.4, pose: LOWER, ease: 'inOut' },
];
/** The hands' places over the run: before the chest, carried down and forward with the lower bow. */
const PRAY_HANDS: Array<[number, number, number]> = [[0, 0.43, 0.37], [2.4, 0.43, 0.37], [3.8, 0.39, 0.41], [5.4, 0.39, 0.41]];

/* ---- at a statue --------------------------------------------------------------------------------------------------- */

/** Looking up to the statue ahead, the hands at the chin. */
const UP = knelt({ ...ELBOWS, ...FLAT, spine_02: [1, 0, 0], spine_03: [0, 0, 0], neck_01: [-4, 0, 0], neck_02: [-4, 0, 0], head: [-12, 0, 0] });
/** Bowed to it a little: the head nodded down, the hands kept. */
const NOD = knelt({ ...ELBOWS, ...FLAT, spine_02: [3, 0, 0], spine_03: [3, 0, 0], neck_01: [4, 0, 0], neck_02: [3, 0, 0], head: [6, 0, 0] });
const STATUE_BEATS: Beat[] = [
  { t: 0, pose: UP, ease: 'inOut', stage: 'key', name: 'looking up' },
  { t: 2.6, pose: UP, ease: 'inOut' },
  { t: 3.8, pose: NOD, ease: 'inOut', stage: 'key', name: 'nodded' },
  { t: 5.4, pose: NOD, ease: 'inOut' },
];
const STATUE_HANDS: Array<[number, number, number]> = [[0, 0.48, 0.37], [2.6, 0.48, 0.37], [3.8, 0.465, 0.38], [5.4, 0.465, 0.38]];

/* ---- a sacrifice --------------------------------------------------------------------------------------------------- */

/** A run: gathered, raised, held, laid down, held, back; seconds. */
const OFFER = 4;
const GATHERED = knelt({ ...ELBOWS, ...CUP, neck_01: [8, 0, 0], neck_02: [6, 0, 0], head: [10, 0, 0] });
/** Raised high ahead: leant back a little from the hips, the head up after the hands. */
const RAISE = knelt({ ...RAISED, ...CUP, pelvis: [0, 0, 0], spine_01: [-2, 0, 0], spine_02: [-3, 0, 0], spine_03: [-3, 0, 0], neck_01: [-6, 0, 0], neck_02: [-5, 0, 0], head: [-14, 0, 0] });
/** Laid at the ground ahead: bowed down from the hips over the knees, the head down after the hands. */
const LAID = knelt({ ...RAISED, ...CUP, pelvis: [28, 0, 0], spine_01: [10, 0, 0], spine_02: [10, 0, 0], spine_03: [8, 0, 0], neck_01: [6, 0, 0], neck_02: [6, 0, 0], head: [16, 0, 0] }, [0, -0.29, 0.21]);
const OFFER_BEATS: Beat[] = [
  { t: 0, pose: GATHERED, ease: 'inOut', stage: 'key', name: 'gathered' },
  { t: 1.1, pose: RAISE, ease: 'inOut', stage: 'key', name: 'raised' },
  { t: 1.9, pose: RAISE, ease: 'inOut' },
  { t: 2.9, pose: LAID, ease: 'inOut', stage: 'key', name: 'laid down' },
  { t: 3.4, pose: LAID, ease: 'inOut' },
];
/** Each hand's place: cupped side by side at the waist, raised high ahead, laid at the ground ahead of the knees. */
const OFFER_HANDS: Array<[number, number, number]> = [[0, 0.33, 0.36], [1.1, 0.64, 0.45], [1.9, 0.64, 0.45], [2.9, 0.07, 0.56], [3.4, 0.07, 0.56]];

/* ---- the clips ----------------------------------------------------------------------------------------------------- */

/** The hands' places as reached hands: side by side `apart` across, each its way toward the thumb; a body's moved by `d`. */
function handsOf(at: Array<[number, number, number]>, apart: number, way: { l: Euler; r: Euler }): Partial<Record<'l' | 'r', HandReach>> {
  const keys = (s: number): Array<Key<Euler>> => at.map(([t, y, z]) => ({ t, v: [s * apart, y, z] as Euler, ease: 'inOut' as const }));
  return { l: { at: keys(1), way: way.l }, r: { at: keys(-1), way: way.r } };
}
/** The head and the hands trailing the trunk: seconds each bone's keys are late. */
const LAG = { neck_01: 0.08, neck_02: 0.12, head: 0.16 };
/** Hers: her shins longer for her height stand her hips higher, so she is let further down and forward to put her knees on the ground; her hands as far below her chin as his. */
const HER = { thighs: { thigh_l: [0, 0, -6] as Euler, thigh_r: [0, 0, 6] as Euler }, move: [1, 1.33, 1.14] as Euler };

function knelt_clip(name: string, beats: Beat[], length: number, hands: Partial<Record<'l' | 'r', HandReach>>, her: Euler, o: Partial<Clip> = {}): Clip {
  const { footKeys, ...keys } = poseToPose(beats, { length, loop: true, lag: LAG });
  return {
    name, loop: true, length, mask: 'full',
    // the feet where the idle stands them (so the fade in and out of it keeps them put), rolled up onto the toes
    plant: { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } },
    feet: { stride: 1, ...(footKeys as NonNullable<typeof footKeys>) },
    breath: { count: 2, depth: 0.7 },
    ...keys,
    armsFree: true,
    hands,
    bodies: {
      woman: { add: HER.thighs, move: HER.move, hands: { l: her, r: her } },
    },
    ...o,
  };
}

export const PRAY_CLIP: Clip = knelt_clip('pray', PRAY_BEATS, PRAY, handsOf(PRAY_HANDS, PRESS, CLASP), [0, -0.1, 0.02]);
export const PRAY_STATUE: Clip = knelt_clip('pray-statue', STATUE_BEATS, PRAY, handsOf(STATUE_HANDS, PRESS, CLASP), [0, -0.1, 0.02]);
export const SACRIFICE: Clip = knelt_clip('sacrifice', OFFER_BEATS, OFFER, handsOf(OFFER_HANDS, 0.045, { l: [1, 0, 0], r: [-1, 0, 0] }), [0, -0.1, 0.02], {
  breath: { count: 1, depth: 0.6 },
  // a go fitted to its length by the holds raised and laid down
  stretch: [[1.1, 1.9], [2.9, 3.4]],
});
export const BEATS: Beat[] = PRAY_BEATS;
