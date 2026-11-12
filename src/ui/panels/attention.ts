import { GESTATION } from '../../game/creatures';

/**
 * What counts as wanting attention. The footer has always counted these and
 * the cards never said which ones they were, so the count sent you looking
 * through the herd by eye. One definition, read by both, so they cannot drift.
 *
 * A leaf, so the Care panel (`care.ts`) can read them without loading the
 * Wildermon panel that opens it (`wildermon.ts`), which says them on.
 */
export const HURT_AT = 0.6;
export const HUNGRY_AT = 0.3;
/** A dam due within this many seconds wants attention too: a quarter of her carrying. */
export const DUE_SOON = GESTATION / 4;
