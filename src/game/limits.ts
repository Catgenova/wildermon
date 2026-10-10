/**
 * The two ends of the scales a thing is measured on.
 *
 * A leaf, so that the modules `game.ts` is built out of can read them without
 * reaching back into it: `game.ts` says them on to everybody else as it always
 * has.
 */

/** The best a thing's QL can be. */
export const QL_TOP = 100;
/** Damage a thing goes to pieces at. */
export const DAMAGE_MAX = 100;
