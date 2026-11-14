/**
 * The garden pieces' numbers and kinds, in a leaf of their own so that the
 * furniture table (`furniture.ts`) and the rules (`garden.ts`) can both read
 * them. Every number here reaches the island as a def (`scripts/dump-defs.ts`).
 */
import type { Season } from '../world/calendar';

/* ---- the pieces ------------------------------------------------------------------------- */

export const FLOWER_BED = 'flower_bed';
export const WINDOW_BOX = 'window_box';
export const HANGING_BASKET = 'hanging_basket';
export const HERB_BOX = 'herb_box';
export const TOPIARY_TUB = 'topiary_tub';
export const POTTED_FERN = 'potted_fern';
export const POTTED_PALM = 'potted_palm';
export const HEDGE = 'hedge';
export const WISTERIA_PERGOLA = 'wisteria_pergola';
export const BONSAI = 'bonsai';
export const FLOWER_CART = 'flower_cart';
export const BIRDHOUSE = 'birdhouse';
export const ARBOUR_BENCH = 'arbour_bench';
export const CARVED_FIGURE = 'carved_figure';
export const TROPHY_PLAQUE = 'trophy_plaque';
export const FOLDING_SCREEN = 'folding_screen';
export const PLANT_STAND = 'plant_stand';
export const WIND_CHIME = 'wind_chime';

/** The potted plants: what a plant stand holds on its steps. */
export const POTS: readonly string[] = [POTTED_FERN, POTTED_PALM];

/* ---- wildflowers in a bed, a box and a basket --------------------------------------------- */

/**
 * The kinds of wildflower a bed is planted with: the meadow's four colours
 * (`FLOWER_COLOURS` in render/flowers.ts), each chosen into a slot of its own.
 */
export const BLOOM_KINDS = ['pink', 'white', 'yellow', 'blue'] as const;
export type BloomKind = (typeof BLOOM_KINDS)[number];
/** Slots of wildflower kinds each piece holds. */
export const BED_SLOTS = 4;
export const BOX_SLOTS = 3;
export const BASKET_SLOTS = 2;
/** Wildflowers a slot takes to plant. */
export const BLOOM_COST = 2;
/** Seconds a slot takes to plant, and to pull a piece's flowers up; and the trade it is. */
export const BLOOM_TIME = 6;
export const CLEAR_TIME = 4;
export const BLOOM_SKILL = 'farming';

/* ---- a herb box ------------------------------------------------------------------------ */

/** A herb box's harvest, as a share of a planter's (`reap_planter`). */
export const HERB_SHARE = 0.5;

/* ---- topiary --------------------------------------------------------------------------- */

export const TOPIARY_SHAPES = ['ball', 'cone', 'spiral', 'wildermon'] as const;
export type TopiaryShape = (typeof TOPIARY_SHAPES)[number];
/** Days of the island's year after its last trim that a topiary shrub has grown back out of shape. */
export const TOPIARY_GROWS_OUT = 7;
/** Seconds a trim takes, the trade and the tool. */
export const TRIM_TIME = 12;
export const TRIM_SKILL = 'forestry';
export const TRIM_TOOL = 'sickle';

/* ---- a hedge --------------------------------------------------------------------------- */

/** Days of the island's year after it is set down that a hedge is full. */
export const HEDGE_FULL = 5;
export const HEDGE_CLIPS = ['flat', 'round'] as const;
export type HedgeClip = (typeof HEDGE_CLIPS)[number];
/** Seconds a clip takes; the trade and the tool are a trim's. */
export const CLIP_TIME = 10;

/* ---- a bonsai -------------------------------------------------------------------------- */

/** Days of the island's year after it is set down that a bonsai is grown. */
export const BONSAI_GROWN = 30;
/** Steps of shaping it takes, one a prune. */
export const BONSAI_STEPS = 5;
/** Days of the island's year between one prune and the next. */
export const PRUNE_REST = 1;
/** Seconds a prune takes, the trade and the tool. */
export const PRUNE_TIME = 15;
export const PRUNE_SKILL = 'forestry';
export const PRUNE_TOOL = 'carving_knife';

/* ---- what is shown on a plaque and a stand ----------------------------------------------- */

/** How many each holds. */
export const PLAQUE_HOLDS = 1;
export const STAND_HOLDS = 3;
/** Seconds hanging or setting one takes, and taking it down. */
export const SHOW_TIME = 3;

/* ---- a birdhouse ----------------------------------------------------------------------- */

/** Birds about a birdhouse at once, at the most; and the seasons none come. */
export const BIRDS_MOST = 3;
export const BIRDS_AWAY: readonly Season[] = ['winter'];

/* ---- a wind chime ---------------------------------------------------------------------- */

/** Wind force under which a chime hangs still and silent. */
export const CHIME_STILL = 0.2;
/** Chimes a second from one chime at the strongest wind; fewer as the wind drops. */
export const CHIME_RATE = 0.12;
/** Seconds at the least between any two chimes heard, however many hang in earshot. */
export const CHIME_GAP = 3;

/* ---- fixed to a wall, or hung ------------------------------------------------------------ */

/**
 * How a piece is fixed (`FurnitureDef.mount`): under a window, against its
 * outer face (`window`); on the face of a solid wall, either side (`wall`); or
 * hung, from an eave -- the outer face of a solid wall or a window -- or from
 * a lantern post, a lantern pillar or a flagpole standing on its tile
 * (`hang`). Each goes in the row of spots along the side of the tile it faces,
 * as a trellis does.
 */
export type Mount = 'window' | 'wall' | 'hang';
/** The pieces a hung one hangs from, standing on its tile. */
export const HANG_FROM: readonly string[] = ['lamp_post', 'lamp_pillar', 'flagpole'];

/**
 * Where a piece fixed in each way goes, in words, round the wall types a hung
 * one hangs from (`trellisWallWords`) and the pieces it hangs from: for its
 * item, its recipe and the help.
 */
export const mountWords = (mount: Mount, wallWords: string, hangFrom: string): string => (mount === 'window'
  ? 'Under a window: the outer face of a finished window, ground level, outside a building.'
  : mount === 'wall'
    ? 'On a wall: either face of a finished solid wall, on your storey.'
    : `Hung from an eave or a post: the outer face of a finished ${wallWords} at ground level outside a building, or a tile with a ${hangFrom} on it.`);
/** Where a hedge goes, in words. */
export const HEDGE_WHERE = 'Along one side of its tile, outside a building, ground level.';
/** Why a plaque or a stand with something on show is not picked up (`garden_said('showing')`). */
export const SHOWING_SAID = 'Take what is on it down first.';

/** Why a figure of a kind will not be carved: none chosen, or one the maker has not seen in the field guide (`figure_said`). */
export const FIGURE_SAID = {
  pick: 'Choose a kind seen in your field guide.',
  unseen: 'Not seen: carve only a kind in your field guide.',
};
/** Why a carved figure of `kind` will not be made by somebody who has seen what `seen` says, or null (`figure_refusal`). */
export const figureRefusal = (seen: (kind: string) => boolean, kind: string | undefined): string | null =>
  (!kind ? FIGURE_SAID.pick : seen(kind) ? null : FIGURE_SAID.unseen);
