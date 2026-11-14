/**
 * The six home pieces' numbers and kinds (`decor.ts` holds their rules): a
 * sundial, a compost bin, a stone lantern, a woven rug, curtains and an
 * armour stand. A leaf of their own, so that the furniture table
 * (`furniture.ts`), the rules and the renderer can each read them. Every
 * number here reaches the island as a def (`scripts/dump-defs.ts`).
 */

/* ---- the pieces ------------------------------------------------------------------------- */

export const SUNDIAL = 'sundial';
export const COMPOST_BIN = 'compost_bin';
export const STONE_LANTERN = 'stone_lantern';
export const WOVEN_RUG = 'woven_rug';
export const CURTAINS = 'curtains';
export const ARMOUR_STAND = 'armour_stand';

/* ---- a stone lantern -------------------------------------------------------------------- */

/** Tiles a stone lantern lights at night, whatever its QL. */
export const STONE_LANTERN_REACH = 4;

/* ---- a compost bin ---------------------------------------------------------------------- */

/** What a compost bin makes, and what spreading it gives (`farming.ts` reads it at the harvest). */
export const COMPOST = 'compost';
/** Things a bin takes besides spoiled food: weeds (mixed grass, moss) and ash. */
export const COMPOST_TAKES: readonly string[] = ['mixed_grass', 'moss', 'ash'];
/** Damage at which food is spoiled and goes in a bin: what a clearer takes off the ground as rotting (`ROT_DMG`). */
export const COMPOST_SPOILED = 40;
/** Things a bin holds at once. */
export const COMPOST_HOLDS = 20;
/** Things put in to one compost made, rounded up. */
export const COMPOST_PER = 2;
/** Days of the island's year after the last thing went in that what is in a bin is compost. */
export const COMPOST_DAYS = 2;
/** QL a field's or a planter's next harvest gains for compost spread on it, to at most 100. */
export const COMPOST_BOOST = 10;
/** Compost a spreading takes. */
export const SPREAD_COST = 1;
/** Seconds: filling a bin, emptying it, spreading it; and the trade spreading is. */
export const COMPOST_FILL_TIME = 3;
export const COMPOST_EMPTY_TIME = 4;
export const SPREAD_TIME = 5;
export const SPREAD_SKILL = 'farming';

/* ---- a woven rug ------------------------------------------------------------------------ */

/** The patterns a rug is woven in, chosen at the loom. */
export const RUG_PATTERNS = ['stripes', 'border', 'diamond'] as const;
export type RugPattern = (typeof RUG_PATTERNS)[number];
/** Colours a rug takes, each a dyeing of its own. */
export const RUG_COLOURS = 3;

/* ---- curtains --------------------------------------------------------------------------- */

/** Where curtains hang: either face of a finished window, on your storey. */
export const CURTAIN_WHERE = 'On a window: either face of a finished window, on your storey.';

/* ---- an armour stand ------------------------------------------------------------------ */

/** Seconds: putting a piece on a stand, taking one off, and changing every slot with what is worn. */
export const DRESS_TIME = 3;
export const SWAP_TIME = 6;
