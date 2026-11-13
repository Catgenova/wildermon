/**
 * The clips of daily life, by name, for `../index.ts` CLIPS: lain asleep and sat meditating, each with its way down
 * onto the ground and up (`./rest.ts`, `../down.ts`); eating and drinking from a cup or a skin stood (`./meal.ts`); praying,
 * at a statue and a sacrifice knelt (`./prayer.ts`).
 */
import type { Clip } from '../clip';
import { mirrorClip } from '../author';
import { downInto } from '../down';
import { DRINK_CUP, DRINK_SKIN, EAT } from './meal';
import { PRAY_CLIP, PRAY_STATUE, SACRIFICE } from './prayer';
import { MEDITATE, MEDITATE_DOWN, SLEEP, SLEEP_DOWN } from './rest';

downInto('sleep', SLEEP_DOWN);
downInto('meditate', MEDITATE_DOWN);

export const LIFE: Record<string, Clip> = {
  sleep: SLEEP, 'sleep-down': SLEEP_DOWN, meditate: MEDITATE, 'meditate-down': MEDITATE_DOWN,
  pray: PRAY_CLIP, 'pray-statue': PRAY_STATUE, sacrifice: SACRIFICE,
  eat: EAT, 'eat-left': mirrorClip(EAT, 'eat-left'), 'drink-cup': DRINK_CUP, 'drink-cup-left': mirrorClip(DRINK_CUP, 'drink-cup-left'),
  'drink-skin': DRINK_SKIN, 'drink-skin-left': mirrorClip(DRINK_SKIN, 'drink-skin-left'),
};
/**
 * The clips played mirrored left-handed from the facings the work is (`../index.ts` LEFT_OF), by name: what is eaten or
 * drunk from in the hand on the near side, not lifted across the face.
 */
export const LIFE_LEFT: Record<string, string> = { eat: 'eat-left', 'drink-cup': 'drink-cup-left', 'drink-skin': 'drink-skin-left' };
/** Seconds the fade into and out of a knelt clip takes: the getting down onto the knees and up (`../index.ts` SETTLE). */
export const LIFE_SETTLE: Record<string, number> = { pray: 0.6, 'pray-statue': 0.6, sacrifice: 0.6 };
