/**
 * The obsidian pieces' numbers and kinds (`obsidian.ts` holds their rules): a
 * black glass lantern, an obsidian throne, an obsidian obelisk, a dragon-glass
 * fountain, a shard garden, an obsidian vase, a lava lamp column, an obsidian
 * wind chime, an obsidian bust, a glass shard path and an ember orb on a
 * stand. Each is made of obsidian (`items.ts`) and more. A leaf of its own, so
 * that the furniture table (`furniture.ts`), the rules and the renderer can
 * each read them. Every number here reaches the island as a def
 * (`scripts/dump-defs.ts`).
 */

/* ---- the pieces ------------------------------------------------------------------------- */

/** What every one of them is made of. */
export const OBSIDIAN = 'obsidian';

export const BLACK_LANTERN = 'black_glass_lantern';
export const OBSIDIAN_THRONE = 'obsidian_throne';
export const OBSIDIAN_OBELISK = 'obsidian_obelisk';
export const DRAGON_FOUNTAIN = 'dragon_glass_fountain';
export const SHARD_GARDEN = 'shard_garden';
export const OBSIDIAN_VASE = 'obsidian_vase';
export const LAVA_LAMP = 'lava_lamp';
export const OBSIDIAN_CHIME = 'obsidian_wind_chime';
export const OBSIDIAN_BUST = 'obsidian_bust';
export const SHARD_PATH = 'glass_shard_path';
export const EMBER_ORB = 'ember_orb';

/** Every one of them, in the order the help lists them. */
export const OBSIDIAN_PIECES: readonly string[] = [
  BLACK_LANTERN, OBSIDIAN_THRONE, OBSIDIAN_OBELISK, DRAGON_FOUNTAIN, SHARD_GARDEN, OBSIDIAN_VASE, LAVA_LAMP, OBSIDIAN_CHIME, OBSIDIAN_BUST, SHARD_PATH, EMBER_ORB,
];

/* ---- a black glass lantern -------------------------------------------------------------- */

/** Candles a black glass lantern takes at once: its fuel, burning a candle's time in a lantern of its QL (`candleBurn`). */
export const LANTERN_CANDLES = 1;
/** Tiles a black glass lantern lights at night while its candle burns, whatever its QL. */
export const BLACK_LANTERN_REACH = 3;

/* ---- an obsidian throne ----------------------------------------------------------------- */

/** Bodies a throne seats (`FurnitureDef.seats`): its settlement's founder. */
export const THRONE_SEATS = 1;

/* ---- an obsidian obelisk ---------------------------------------------------------------- */

/** Game hours either side of dawn and of dusk (`DAWN`, `DUSK`) that an obelisk's glint plays. */
export const OBELISK_GLINT = 0.5;

/* ---- a lava lamp column ----------------------------------------------------------------- */

/** Tiles a lava lamp column lights at night, always on. */
export const LAVA_LAMP_REACH = 3;
/** Seconds a blob of melt takes to rise the height of the column, drawn. */
export const LAVA_RISE = 9;

/* ---- an obsidian wind chime ------------------------------------------------------------- */

/** An obsidian chime's loudness at the least wind it chimes in (`CHIME_STILL`), × its loudest; rising evenly to ×1 at full wind. */
export const GLASS_CHIME_LEAST = 0.3;

/* ---- an ember orb on a stand ------------------------------------------------------------ */

/** Tiles an ember orb lights at full night, and in daylight; between the two by how dark it is (`Game.darkness`). */
export const ORB_NIGHT_REACH = 4;
export const ORB_DAY_REACH = 1;

/* ---- the light they throw --------------------------------------------------------------- */

/** The colour of an ember's glow on the ground round it, and how strong at full dark: a lantern's warmth, redder. */
export const EMBER_CAST = '255, 104, 60';
export const EMBER_CAST_ALPHA = 0.2;

/* ---- the times -------------------------------------------------------------------------- */

/** Seconds: a candle put in a black glass lantern. */
export const OBSIDIAN_FIT_TIME = 2;
