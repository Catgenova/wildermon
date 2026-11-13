/**
 * B1, a blow taken on the shield (`../index.ts` blockOver), `BLOCK_SECS` long from the island's word (`player.blocked_at`):
 * laid over whatever the body is playing (the fight, the idle, the walk) while it lasts, and only with a shield worn.
 *
 * The shield arm (`SHIELD_ARM`) is taken from what plays to the guard (`GUARD`) and given back to it, as far as `COVER`
 * says: snapped up and forward across the chest by the peak, the shield's face square to the front between the chin and
 * the belt; knocked back toward the chest at the impact (`JOLT`); settled back onto the guard and let go of. The rest is
 * added to what plays: the trunk leant in a little behind the shield, rocked back at the impact, the head kept on the
 * foe; the hips let down on knees that give (the feet kept where they stand, on a stood clip only).
 */
import type { Clip, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import { BLOCK_SECS } from '../../../game/fight';

const LENGTH = BLOCK_SECS;
/** The guard reached; the blow landing on it; settled back onto it. */
const PEAK = 0.1, IMPACT = 0.15, SETTLED = 0.25;
/** When the blow lands on the shield, seconds in (the flat figure's knock, `../../../render/figure.ts`). */
export const BLOCK_IMPACT = IMPACT;

/**
 * The shield arm at the guard: the upper arm raised forward and in, the elbow bent so the forearm lies across the chest,
 * rolled so the shield's face (out from the forearm at rest) is to the front; the fist closed on the shield's grip.
 */
const GUARD: Record<string, Euler> = {
  clavicle_l: [0, 0, -14],
  upperarm_l: [98, 100, 13],
  lowerarm_l: [77, -32, 0],
  // (the shield on the forearm takes two-thirds of the wrist's roll: the rest of its turn to the front)
  hand_l: [0, -72, 0],
  fingers_01_l: [62, 0, 0], fingers_02_l: [70, 0, 0],
  thumb_01_l: [10, 0, 0], thumb_02_l: [24, 0, 0], thumb_03_l: [20, 0, 0],
};
/** The bones the block takes from what plays rather than adding to it. */
export const SHIELD_ARM: readonly string[] = Object.keys(GUARD);
/** The shield knocked back toward the chest at the impact: the upper arm let back, the elbow closed. */
const JOLT: Record<string, Euler> = { ...GUARD, clavicle_l: [0, 0, -16], upperarm_l: [90, 100, 13], lowerarm_l: [84, -32, 0] };

/** Braced behind the shield: leant in from the hips a little, the head held up to the foe, the hips let down. */
const BRACE: KeyPose = {
  rot: {
    ...GUARD,
    spine_01: [2, 0, 0], spine_02: [3, 2, 0], spine_03: [3, 3, 0],
    neck_01: [-2, 0, 0], head: [-4, -2, 0],
  },
  move: [0, -0.012, 0.004],
};
/** At the impact: the trunk rocked back onto the heels, the shield arm knocked in, the knees giving further. */
const STRUCK: KeyPose = merge(BRACE, {
  rot: { ...JOLT, spine_01: [0, 0, 0], spine_02: [0, 2, 0], spine_03: [-1, 4, 0], neck_01: [0, 0, 0], head: [-2, -2, 0] },
  move: [0, -0.016, -0.004],
});
/** Nothing added (the arm held at the guard while `COVER` lets it go). */
const REST: KeyPose = { rot: { ...GUARD }, move: [0, 0, 0] };

export const BEATS: Beat[] = [
  { t: 0, pose: REST, ease: 'inOut', stage: 'key', name: 'rest' },
  { t: PEAK, pose: BRACE, ease: 'out', stage: 'key', name: 'peak' },
  { t: IMPACT, pose: STRUCK, ease: 'out', stage: 'key', name: 'jolt' },
  { t: SETTLED, pose: BRACE, ease: 'inOut', stage: 'key', name: 'recover' },
  { t: LENGTH, pose: REST, ease: 'inOut', name: 'end' },
];
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: false });

/** How far the shield arm is at the guard rather than as what plays has it: snapped up by the peak, held, eased back. */
export const COVER: Array<Key<number>> = [
  { t: 0, v: 0 }, { t: PEAK, v: 1, ease: 'out' }, { t: SETTLED, v: 1, ease: 'linear' }, { t: LENGTH, v: 0, ease: 'inOut' },
];

export const BLOCK: Clip = {
  name: 'block',
  loop: false,
  length: LENGTH,
  mask: 'additive',
  ...KEYS,
  events: [{ t: IMPACT, name: 'impact' }],
};
