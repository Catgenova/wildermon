/**
 * The fittings' numbers and kinds (`fitting.ts` holds their rules): a paper
 * lantern pole, a moss boulder, a tree bench, a spice shelf, a window seat, a
 * training dummy, an archery target, a mooring post and a stone bust. A leaf
 * of their own, so that the furniture table (`furniture.ts`), the rules and
 * the renderer can each read them. Every number here reaches the island as a
 * def (`scripts/dump-defs.ts`).
 */

/* ---- the pieces ------------------------------------------------------------------------- */

export const LANTERN_POLE = 'lantern_pole';
export const MOSS_BOULDER = 'moss_boulder';
export const TREE_BENCH = 'tree_bench';
export const SPICE_SHELF = 'spice_shelf';
export const WINDOW_SEAT = 'window_seat';
export const TRAINING_DUMMY = 'training_dummy';
export const ARCHERY_TARGET = 'archery_target';
export const MOORING_POST = 'mooring_post';
export const STONE_BUST = 'stone_bust';

/* ---- a paper lantern pole --------------------------------------------------------------- */

/** Paper lanterns on a pole: each a colour of its own, and each a candle. */
export const POLE_LANTERNS = 3;
/** Why a pole with every lantern dyed takes no more (`dyes.ts`; the island's `fitting_said('poleColours')`). */
export const POLE_COLOURS_SAID = `Paper lantern pole: ${POLE_LANTERNS} colours. Remove the dye first.`;
/** Tiles a pole lights at night while its candles burn, whatever its QL. */
export const POLE_REACH = 3;

/* ---- a moss boulder --------------------------------------------------------------------- */

/** Days a boulder takes to green over, bare to as green as it gets, by the moss rule (`greening.ts`). */
export const BOULDER_MOSS_DAYS = 5;

/* ---- seats ------------------------------------------------------------------------------ */

/** Bodies a tree bench seats (`FurnitureDef.seats`). */
export const TREE_BENCH_SEATS = 6;
/** Bodies a window seat seats. */
export const WINDOW_SEATS = 2;

/* ---- a spice shelf ---------------------------------------------------------------------- */

/** Herbs a spice shelf holds, a jar each. */
export const SHELF_HOLDS = 12;

/* ---- a training dummy and an archery target --------------------------------------------- */

/** A swing at a training dummy, and a shot at an archery target: the jobs. */
export const PRACTISE = 'practise_dummy';
export const SHOOT_TARGET = 'shoot_target';
/** The fight a practice job is timed, costed and drawn as: a swing (`attack_creature`) or a draw (`shoot_creature`). The island's `practice_as`. */
export const practiceAs = (id: string): string => (id === PRACTISE ? 'attack_creature' : id === SHOOT_TARGET ? 'shoot_creature' : id);
/** A practice swing's or shot's skill gain, × a real fight's. */
export const PRACTICE_GAIN = 0.5;
/** Arrows an archery target holds before they are pulled. */
export const TARGET_HOLDS = 12;
/** Arrows that break pulled out of a target: one in this many. */
export const ARROW_BREAK_IN = 4;
/** Seconds: arrows pulled out of a target. */
export const PULL_TIME = 3;

/* ---- a mooring post --------------------------------------------------------------------- */

/** Tiles from a post a boat is tied up within, and stays tied within. */
export const MOOR_REACH = 1;
/** Seconds: a boat tied up or untied. */
export const MOOR_TIME = 3;

/* ---- a stone bust ----------------------------------------------------------------------- */

/** Seconds: a bust carved as a citizen. */
export const CARVE_TIME = 10;

/* ---- the times -------------------------------------------------------------------------- */

/** Seconds: candles put in a pole; herbs put on a shelf or taken off. */
export const FIT_TIME = 2;
