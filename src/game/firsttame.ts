import { SPECIES } from './creatures';

/**
 * First tame: sure. A player's first tame of a wildermon cannot fail on the
 * roll: an offering is taken (`tameChance` 1) and one in a trap comes out
 * clean. Every refusal before it stands: the taming a kind asks, the offering,
 * reach, the room for one more. Never a monster.
 *
 * The island decides it (`first_tame`, `player.tamed_at`: null until the
 * player has tamed anything) and says it on every beat (`first_tame`) and at
 * the join (`tamed_at` on your row); this side only shows it, in the odds
 * (`creatureinfo.ts`), the Tame entry of a wildermon's menu, Take out of a
 * trap, and the Guiding Light's tame steps. `supabase/test/newplayer.ts`
 * holds the two to it.
 */

/** The label, wherever the odds would be. */
export const FIRST_TAME_SAYS = 'First tame: sure';

/** Whether a tame of this kind, by somebody whose first tame is still to come, is sure. */
export const firstTameSure = (first: boolean, species: string): boolean => first && !!SPECIES[species] && !SPECIES[species].monster;
