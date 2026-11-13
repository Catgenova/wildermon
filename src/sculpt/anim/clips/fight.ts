/**
 * F1, a fight with a weapon swung in one hand (`../index.ts` ONE_HAND): the strike at the bench (`./work.ts`) with the
 * weapon in the right fist in place of the mallet (`Clip.tools`, `../index.ts` toolsIn), its blow a downward cut from
 * beside the ear to across the front. Its own where the work clip holds the work: nothing in the left hand, which is kept
 * back by the hip out of the blade's way (its arm as keyed, not reached to the chisel); the right arm reaching further
 * out ahead of the chest and the fist turned so the blade or head leads out toward the foe rather than across the body
 * (`TURNS`, held throughout: the blade clear of the chest and the shawl's front); the head and neck raised off the work to
 * look at the foe. Fitted to a go's length as the work clip is (its holds stretched, never the blow); played mirrored,
 * left-handed, from the facings the work clip is (`../index.ts` lefty).
 */
import type { Clip, Key } from '../clip';
import type { Euler } from '../math';
import { WORK } from './work';

/** Turns added to the work clip's throughout (degrees). */
const TURNS: Record<string, Euler> = {
  // the head and neck raised off the bench
  neck_01: [-5, 0, 0], neck_02: [-3, 0, 0], head: [-9, 0, 0],
  // the left upper arm swung back and out from the side, the forearm less bent: the fist by the hip, behind the cut's end
  upperarm_l: [-22, 0, 14], lowerarm_l: [-55, 0, 0],
  // the right upper arm raised further ahead and out, the elbow opened: the fist out ahead of the chest; the fist turned
  // about the hand's length, the blade leading out ahead
  upperarm_r: [42, 0, -20], lowerarm_r: [-40, 0, 0], hand_r: [0, 35, 0],
};
const held = (v: Euler): Array<Key<Euler>> => [{ t: 0, v }];

export const FIGHT: Clip = {
  ...WORK,
  name: 'fight',
  // the work's accents (none) and the turns, held throughout
  accents: { ...(WORK.accents ?? {}), ...Object.fromEntries(Object.entries(TURNS).map(([b, v]) => [b, held(v)])) },
  // nothing held to the work: the left arm as keyed
  hands: undefined,
  tools: { r: 'sword' },
};
