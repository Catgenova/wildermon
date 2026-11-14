/**
 * The furnishings' numbers and kinds (`furnish.ts` holds their rules): a
 * birdbath, a stone bench, a garden swing, a gazebo, a hay bale stack, a
 * water trough, a signpost, a cairn, a fireplace, a four-poster bed, a vase,
 * a side table, a footstool and a trophy fish mount. A leaf of their own, so
 * that the furniture table (`furniture.ts`), the rules and the renderer can
 * each read them. Every number here reaches the island as a def
 * (`scripts/dump-defs.ts`).
 */

/* ---- the pieces ------------------------------------------------------------------------- */

export const BIRDBATH = 'birdbath';
export const STONE_BENCH = 'stone_bench';
export const GARDEN_SWING = 'garden_swing';
export const GAZEBO = 'gazebo';
export const HAY_BALE = 'hay_bale';
export const WATER_TROUGH = 'water_trough';
export const SIGNPOST = 'signpost';
export const CAIRN = 'cairn';
export const FIREPLACE = 'fireplace';
export const FOUR_POSTER = 'four_poster_bed';
export const VASE = 'vase';
export const SIDE_TABLE = 'side_table';
export const FOOTSTOOL = 'footstool';
export const FISH_MOUNT = 'fish_mount';

/* ---- seats ------------------------------------------------------------------------------ */

/** Bodies each seat takes at once (`FurnitureDef.seats`). */
export const BENCH_SEATS = 2;
export const SWING_SEATS = 1;
export const GAZEBO_SEATS = 6;
export const STOOL_SEATS = 1;
/** Seconds a sitting lasts before you get up of your own accord. */
export const SIT_TIME = 120;
/** Stamina back while sat in a garden swing, × standing still's (`wind_rest`); every other seat ×1. */
export const SWING_REST = 1.15;

/* ---- a four-poster bed ------------------------------------------------------------------ */

/** Its rest (`FurnitureDef.bed`): × a plain bed's sleep bonus a second and health on lying down. */
export const FOUR_POSTER_REST = 1.25;

/* ---- a fireplace ------------------------------------------------------------------------ */

/** Tiles a lit fireplace lights. */
export const FIREPLACE_REACH = 5;

/* ---- a hay bale stack ------------------------------------------------------------------- */

/** Mixed grass a stack holds: what it is built of, and what it takes back. */
export const HAY_HOLDS = 20;
/** What it holds and feeds. */
export const HAY = 'mixed_grass';
/** Tiles from it a wildermon is fed, from its tile's middle. */
export const HAY_REACH = 8;
/** Mixed grass each wildermon in reach eats from it a day of the island's year, at most. */
export const HAY_A_DAY = 1;
/** Seconds: grass added to it. */
export const HAY_FILL_TIME = 4;

/* ---- a water trough --------------------------------------------------------------------- */

/** Litres it holds, of water only (`FurnitureDef.liquid`). */
export const TROUGH_HOLDS = 40;
/** Why anything but water does not go in one (`furnish_said('troughWater')`). */
export const TROUGH_WATER_ONLY = 'Water trough: water only.';
/** Tiles from it a wildermon drinks, from its tile's middle. */
export const TROUGH_REACH = 8;
/** Litres each wildermon in reach drinks from it a day of the island's year. */
export const TROUGH_DRINK = 1;
/** How much longer a wildermon's care holds, × (`care_hours`), while it has a trough with water in reach. */
export const TROUGH_CARE = 1.25;

/* ---- a signpost ------------------------------------------------------------------------- */

/** Arms a signpost holds. */
export const SIGN_ARMS = 4;

/* ---- a cairn ---------------------------------------------------------------------------- */

/** The longest name a cairn takes, in characters. */
export const CAIRN_NAME_MAX = 32;
/** Seconds: a name cut on it. */
export const CAIRN_NAME_TIME = 6;

/* ---- a vase ----------------------------------------------------------------------------- */

/** Wildflowers a vase holds. */
export const VASE_HOLDS = 3;
/** What it holds. */
export const VASE_FLOWER = 'wildflowers';
/** Days of the island's year wildflowers keep fresh in it, from the last put in. */
export const VASE_FRESH = 7;

/* ---- a side table ----------------------------------------------------------------------- */

/** Things a side table holds on its top. */
export const TABLE_HOLDS = 2;

/* ---- a trophy fish mount ---------------------------------------------------------------- */

/**
 * A fish's weight on the mount, kg: its kind's weight (`ItemDef.weight`) ×
 * (`FISH_SIZE_LEAST` + its QL × `FISH_SIZE_PER`), so the biggest of a kind is
 * the best caught. Rounded to `FISH_KG_STEP`.
 */
export const FISH_SIZE_LEAST = 0.5;
export const FISH_SIZE_PER = 0.01;
export const FISH_KG_STEP = 0.01;

/* ---- the times -------------------------------------------------------------------------- */

/** Seconds: a thing put on a table or in a vase or a mount, or taken off. */
export const PUT_TIME = 2;
