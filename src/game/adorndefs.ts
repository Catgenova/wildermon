/**
 * The adornments' numbers and kinds (`adorn.ts` holds their rules): a lily
 * pond, an ivy wall panel, a garden obelisk, a herb spiral, a buoy, a cauldron
 * hearth, a cheese rack, a pelt rug, a plush wildermon, a game table, a gem
 * lamp, a pedigree board and a worker nameplate (and the garden footbridge,
 * which is a bridge: `bridges.ts`). A leaf of their own, so that the furniture
 * table (`furniture.ts`), the rules and the renderer can each read them. Every
 * number here reaches the island as a def (`scripts/dump-defs.ts`).
 */
import type { Ageing } from './brewing';

/* ---- the pieces ------------------------------------------------------------------------- */

export const LILY_POND = 'lily_pond';
export const IVY_PANEL = 'ivy_panel';
export const GARDEN_OBELISK = 'garden_obelisk';
export const HERB_SPIRAL = 'herb_spiral';
export const BUOY = 'buoy';
export const CAULDRON_HEARTH = 'cauldron_hearth';
export const CHEESE_RACK = 'cheese_rack';
export const PELT_RUG = 'pelt_rug';
export const PLUSH = 'plush_wildermon';
export const GAME_TABLE = 'game_table';
export const GEM_LAMP = 'gem_lamp';
export const PEDIGREE_BOARD = 'pedigree_board';
/** Not a piece set down: hung on a wildermon bed (`hang_plate`). */
export const NAMEPLATE = 'worker_nameplate';
/** The garden footbridge, a bridge kind (`BRIDGES.footbridge`). */
export const FOOTBRIDGE = 'footbridge';

/* ---- a lily pond ------------------------------------------------------------------------ */

/** Lily roots a pond takes, planted one a go. */
export const POND_LILIES = 3;

/* ---- an ivy wall panel ------------------------------------------------------------------ */

/** What a panel is made of, cut off a wall by Clear the ivy: one a wall cleared. */
export const IVY_CUTTING = 'ivy_cutting';
/** Ivy cuttings Clear the ivy gives, a wall cleared. */
export const IVY_CUTTINGS = 1;
/** Days a panel takes to green the wall it hangs on over, bare to full, by the ivy look (`greening.ts`). */
export const IVY_PANEL_DAYS = 7;

/* ---- a garden obelisk ------------------------------------------------------------------- */

/** The colours its sweet peas may be chosen in, by name. */
export const PEA_COLOURS: Readonly<Record<string, string>> = { pink: '#ec9cc0', purple: '#a77ccc', white: '#f6f0f2', red: '#dc5f78' };
/** And by season, unchosen: the bloom seasons' own. */
export const PEA_BY_SEASON: Readonly<Record<string, string>> = { spring: 'pink', summer: 'purple' };

/* ---- a herb spiral ---------------------------------------------------------------------- */

/** Herbs a spiral grows at once, a slot each, each sown, grown and picked on its own. */
export const SPIRAL_SLOTS = 4;
/** Herbs a ripe slot gives a pick, before it grows again from sown. */
export const SPIRAL_PICK = 2;

/* ---- a buoy ----------------------------------------------------------------------------- */

/** Tiles a buoy lights at night. */
export const BUOY_REACH = 2;

/* ---- a cauldron hearth ------------------------------------------------------------------ */

/** Servings a pot dish makes at a lit cauldron hearth, × its inputs, in one go's time. */
export const CAULDRON_SERVINGS = 4;
/** The station (`Station`): a cauldron hearth, lit. */
export const CAULDRON_STATION = CAULDRON_HEARTH;

/* ---- a cheese rack ---------------------------------------------------------------------- */

/** Cheeses a rack holds. */
export const RACK_HOLDS = 8;
/** What it holds. */
export const CHEESE = 'cheese';
/** How cheese on a rack ages, by the wine rule (`ageing.ts`): QL a day of the island's year, and the most over what it went up at. */
export const CHEESE_AGEING: Ageing = { rate: 1, cap: 20 };

/* ---- a pelt rug ------------------------------------------------------------------------- */

/** What a pelt rug is made of: fur, each carrying the kind it came off (`item.extra`, at butchering). */
export const FUR = 'fur';

/* ---- a plush wildermon ----------------------------------------------------------------- */

/** Why a plush will not be sewn: no kind chosen, or one its maker has not tamed (`adorn_said`). */
export const PLUSH_SAID = { pick: 'Choose a kind.', untamed: 'Not a kind you have tamed.' };
/** Why a plush of `kind` will not be sewn by somebody who has tamed what `tamed` says, or null (the island's `plush_refusal`). */
export const plushRefusal = (tamed: (kind: string) => boolean, kind: string | undefined): string | null =>
  (!kind ? PLUSH_SAID.pick : tamed(kind) ? null : PLUSH_SAID.untamed);

/* ---- a game table ----------------------------------------------------------------------- */

/** Bodies a game table seats (`FurnitureDef.seats`): the players of a round of stones. */
export const TABLE_SEATS = 2;
/** Stones: a race between two players to this many points. */
export const STONES_GOAL = 12;
/** A throw: `STONES_LEAST` to this many points, each as likely. */
export const STONES_SIDES = 6;
export const STONES_LEAST = 1;
/** Seconds: a throw. */
export const THROW_TIME = 2;

/* ---- a gem lamp ------------------------------------------------------------------------- */

/** Tiles a gem lamp lights at night, in its gem's colour. */
export const GEM_LAMP_REACH = 2;

/* ---- the times -------------------------------------------------------------------------- */

/** Seconds: a lily planted, a slot sown or picked, a cheese put up or taken, a nameplate hung or taken down. */
export const ADORN_TIME = 3;
/** Seconds: a wildermon's lineage set on a board. */
export const LINEAGE_TIME = 6;
