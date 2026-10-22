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
/**
 * Damage one use puts on a tool of this quality, before what it is made of
 * and its rarity: a poor tool goes to pieces far faster than a good one.
 * The island's `wear_per_use`.
 */
export const wearPerUse = (ql: number): number => 0.06 + 3 / (10 + ql);
/**
 * What damage makes of a tool's worth at the work (`toolWorth`): a share of it
 * off for each point of damage over this many, and never under the floor.
 */
export const WORN_SPAN = 160;
export const WORN_FLOOR = 0.3;
/** What is left of a thing's worth at this damage. */
export const wornShare = (dmg: number): number => Math.max(WORN_FLOOR, 1 - dmg / WORN_SPAN);

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

/** How grown a fleece has to be to shear, and what a full one gives: wool, or a bird's feathers. The island has the same. */
export const SHEAR_FROM = 0.35;
export const SHEAR_WOOL = 3;
export const SHEAR_FEATHERS = 6;

/** Tamed creatures are extra eyes, but not far-seeing ones: this many tiles, unless the kind says otherwise. */
export const COMPANION_SIGHT = 7;
/** How much of your sight the dark takes: three quarters of it. A kept creature's eyes lose half of that. */
export const NIGHT_LOSS = 0.75;
