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

/** What a creature's attack takes off a player it lands on, as a share of a life, before armour (`creatures.ts`). */
export const BLOW_SHARE = 0.012;
/**
 * How near the middle of a thing standing on the ground you must be to work
 * on it where it stands, in tiles: the island's `placed_in_reach` default.
 */
export const PLACED_REACH = 2.4;

/** Bundles of mixed grass a cut gives. */
export const GRASS_PER_CUT = 2;
/**
 * Moss a cut of a moss tile gives: as many as a cut of grass gives bundles.
 * Asked for: "make that cuttable like grass into mixed grass, but yielding
 * moss." The island's `moss_per_cut`.
 */
export const MOSS_PER_CUT = GRASS_PER_CUT;
