import { MIND_GAIN, tryGain } from './learn';
import { madeBy } from './signing';
import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import {
  countOf, describeFrom, describeWith, itemDef, makersMark, markOf, overParts, partsMark, rareInputSaid, rarityTally, rollRarityFrom, RARITY_ODDS, RARITY_WORD,
  serveOf, type Item,
} from './items';
import { QL_PER_LOOP } from './belt';
import { campfireFood, describeGoals } from './journal';
import { fill, listed } from './words';
import { FURNITURE, ONE_ALTAR, VESSELS } from './furniture';
import { trellisWallWords } from './building';
import { SUBTILES } from './crates';
import { castWhole, INGOT_LUMPS, ingotOf, METAL_BY_LUMP, MOULD_BY_MAKES, MOULD_SKILL, MOULDS } from './metal';
import { FISH } from './fishing';
import { BOIL_IN, boilCount, boilCountPlain, boiledDye, boilRefusal, BOIL_LITRES, isBoilStuff } from './dyes';
import { DYE_BUCKET, DYESTUFFS, dyeRecipeId } from './dyestuffs';
import { HERBS, WOUND_KINDS } from './wounds';
import { TRAPS } from './traps';
import { BREWS } from './brewing';
import { isMaterialKind, matOf, type MaterialKind } from './materials';
import { TREE_DEFS } from '../world/tiles';
import { CLASSES } from './classes';
import { CIRCLET_STONES } from './gems';
import { SKILL_DEFS } from './skills';
import { CANDLE_DRAWN } from './light';
import { ENCHANTERS_PLINTH, ENCHANTING, ENCHANTMENT_LIST, PAPER_PRESS, PLINTH_NAME, SCROLL_DIFFICULTY, SCROLL_HARM, SCROLL_SHEETS, scrollOf } from './enchant';
import { DAMAGE_MAX } from './limits';
import { BUTTER_CHURN, BUTTER_PATS, CHURN_BUTTER, WHEY_BUCKET } from './dairy';

/** What working a thing out with your hands teaches the head. */
export const CRAFT_HEAD = MIND_GAIN;

/**
 * How many tiles a craft reaches for what goes into it.
 *
 * Asked for: "When crafting, allow the ingredients to be used from any
 * container within 3 tiles." Measured the way every job's reach is, tile to
 * tile along each side, so it is the square seven tiles across with you in
 * the middle of it. The island reads the same number, as `craft_reach()`.
 */
export const CRAFT_REACH = 3;

/**
 * One stack a craft may spend: in the pack, in a bag on your back, or in a
 * store within `CRAFT_REACH`. `Game.craftStock` lists them in the order a
 * craft spends them.
 */
export interface CraftStock {
  item: Item;
  /** Whether it is on you, in the pack or a bag, rather than in a store you are standing near. */
  carried: boolean;
  /** The store it is in, by name, when it is not carried: "Wagon (pine)". */
  store?: string;
  /** Use up `n` of it; false when there are not that many. */
  spend(n: number): boolean;
}

const lower = (id: string): string => itemDef(id).name.toLowerCase();
const plural = (id: string, n: number): string => (n === 1 ? lower(id) : `${lower(id)}${itemDef(id).stackable && !lower(id).endsWith('s') ? 's' : ''}`);
/** "a" or "an", off the name rather than the id: an anvil, a big axle. */
const article = (id: string): string => (/^[aeiou]/.test(lower(id)) ? 'an ' : 'a ');

/**
 * Everything the player can make from what they carry and what is stored
 * within reach. A recipe is a tool (kept, and carried) plus materials (used
 * up) that become a result. Each recipe is also an item action, so it shows on
 * the material's menu as well as in the crafting window.
 */
export type RecipeCategory = 'Woodwork' | 'Furniture' | 'Stonework' | 'Clay & thatch' | 'Cloth' | 'Alchemy' | 'Writing' | 'Cooking' | 'Smelting' | 'Glassblowing'
  | 'Jewellery' | 'Mending' | 'Enchanting';
/** A place a recipe has to be worked at, beyond what is carried. */
export type Station = 'campfire' | 'smelter' | 'spindle' | 'loom' | typeof PAPER_PRESS | typeof ENCHANTERS_PLINTH | typeof BUTTER_CHURN;
/** What a station is called where a recipe says it wants one. The island's `station_name` is generated from this. */
export const STATION_NAME: Record<Station, string> = { campfire: 'lit campfire', smelter: 'hot smelter', spindle: 'spindle', loom: 'loom', paper_press: 'paper press',
  [ENCHANTERS_PLINTH]: PLINTH_NAME, [BUTTER_CHURN]: 'butter churn' };

export interface RecipeInput {
  item: string;
  count?: number;
}

export interface Recipe {
  id: string;
  category: RecipeCategory;
  /** Item id made. */
  result: string;
  /** Units of the result per craft. */
  count?: number;
  /** Materials used up per craft; the first is the one shown in the item menu label. */
  inputs: RecipeInput[];
  /** Tool that must be carried but is not used up. */
  tool?: string;
  /** Something that must be standing nearby, such as a lit fire to cook on. */
  station?: Station;
  /**
   * Worked only standing on a settlement of yours -- one you founded or one
   * you are a citizen of -- as an altar is. The island keeps the same flag,
   * as `recipe.deed`, and refuses in the same words (`DEED_ONLY`).
   */
  deed?: boolean;
  skill: string;
  /** Menu label on the material, such as "Saw into planks". */
  label: string;
  /**
   * One short line under the name in the crafting book, for a recipe whose
   * result is not the thing anybody is actually after -- and, because the
   * book searches it along with everything else on the row, the words that
   * find it. A mould is the case: nobody wants an axle mould, they want the
   * axle, and "big axle" turned up nothing at all.
   */
  note?: string;
  verb: string;
  baseTime: number;
  stamina: number;
  /** When set, a skill check can fail. */
  difficulty?: number;
  /** Food burns: a failed attempt eats the ingredients anyway. */
  consumeOnFail?: boolean;
  /**
   * The product's quality comes from what went into it rather than from the
   * worker's hands. Mixing two fine lumps gives fine metal; skill only decides
   * how little of that quality is lost in the pouring.
   */
  qlFromInputs?: boolean;
  /**
   * The product is made of something, and takes it from the first input that
   * carries a material of this kind: a plank crate is of the wood its planks
   * were, a fitted sword of the metal of its blade. One craft draws on one
   * material; you cannot nail an oak plank to a pine one and call it a chest.
   */
  material?: MaterialKind;
  /** The one wood it may be made from, for the things that are that fussy. */
  wood?: string;
  /**
   * A fixed qualifier stamped on the product instead of the material it was
   * made from: the herb on a healing cover, which is what tells five covers
   * apart when they are all one item.
   */
  extra?: string;
  /** Things handed back when it succeeds, such as the bucket the lye was in. */
  returns?: Array<[string, number]>;
  /**
   * What you are left holding when it fails, if that is not simply what a
   * success hands back. A spoiled batch wastes what went into it; it does not
   * eat the bucket it was mixed in.
   */
  salvage?: Array<[string, number]>;
  done: string;
  fail?: string;
  /**
   * A perk that has to be held to make it at all, by its key (a Cook's Broth
   * and Distil). Everybody sees it in the crafting window; only a trade that
   * has learned it may make it, and `RECIPE_PERK_SAYS` is what the others are
   * told.
   */
  perk?: string;
  /**
   * The trade a book is written on (an Artisan's Trade Book), which the writer
   * has to have `TRADE_BOOK_AT` of. The island reads it off the recipe's id.
   */
  writes?: string;
}

/**
 * Parts not beaten out at an anvil that still carry their maker's mark into
 * what they are built into: a yoke's pace into the cart or wagon it goes on
 * (a Tailor's Saddler). The island's `perform_craft` reads the same list.
 */
export const MARKED_PARTS: ReadonlySet<string> = new Set(['yoke']);

/** What a Tailor's Lye Saver says when the vessel's liquid is left in it. The island says the same. */
export const VESSEL_KEPT = 'Lye Saver: bucket not used up.';

/** What somebody without the perk a recipe wants is told, by the perk's key. The island says the same. */
export const RECIPE_PERK_SAYS: Record<string, string> = {
  broth: 'Need perk: Broth (Cook).',
  distil: 'Need perk: Distil (Cook).',
  tent: 'Need perk: Tent (Tailor).',
  herb_tea: 'Need perk: Herb Tea (Naturalist).',
  salve: 'Need perk: Salve (Naturalist).',
  tincture: 'Need perk: Tincture (Naturalist).',
  smoke_fish: 'Need perk: Smoke Fish (Fisher).',
  fish_pond: 'Need perk: Fish Pond (Fisher).',
  repair_kit: 'Need perk: Repair Kit (Mender).',
  sealant: 'Need perk: Sealant (Mender).',
  circlet: 'Need perk: Circlet (Artisan).',
  amphora: 'Need perk: Amphora (Artisan).',
  potters_wheel: 'Need perk: Potter\'s Wheel (Artisan).',
  trade_book: 'Need perk: Trade Book (Artisan).',
};

/**
 * A dish: food that is eaten a serving at a time, rather than drunk out of the
 * vessel it came in (a bucket of spirit off a still). What an Artisan's Deep
 * Pot makes a serving more of. The island's `is_dish`.
 */
export const isDish = (id: string): boolean => itemDef(id).category === 'food' && !itemDef(id).charges;

/** What a failed focus says when an Artisan's Keep the Stone has the stone out of it whole. The island says the same. */
export const STONE_KEPT = 'Failed: focus. Silver lost; gem kept.';

export const RECIPES: Recipe[] = [
  // Woodwork
  { id: 'make_planks', category: 'Woodwork', result: 'plank', count: 3, inputs: [{ item: 'log' }], tool: 'saw', skill: 'carpentry', material: 'wood', label: 'Saw into planks', verb: 'sawing', baseTime: 5, stamina: 0.04, done: '' },
  { id: 'make_timbers', category: 'Woodwork', result: 'timber', count: 2, inputs: [{ item: 'log' }], tool: 'saw', skill: 'carpentry', material: 'wood', label: 'Saw into timbers', verb: 'sawing', baseTime: 5, stamina: 0.04, done: '' },
  { id: 'make_shafts', category: 'Woodwork', result: 'shaft', count: 4, inputs: [{ item: 'log' }], tool: 'carving_knife', skill: 'carpentry', material: 'wood', label: 'Carve shafts', verb: 'carving shafts', baseTime: 5, stamina: 0.03, done: '' },
  { id: 'make_mallet', category: 'Woodwork', result: 'mallet', inputs: [{ item: 'log' }], tool: 'carving_knife', skill: 'carpentry', material: 'wood', label: 'Carve a mallet', verb: 'carving a mallet', baseTime: 8, stamina: 0.04, difficulty: 8, done: '' },
  { id: 'make_deed_stake', category: 'Woodwork', result: 'deed_stake', inputs: [{ item: 'shaft' }], tool: 'carving_knife', skill: 'carpentry', material: 'wood', label: 'Carve a settlement stake', verb: 'carving a settlement stake', baseTime: 10, stamina: 0.05, difficulty: 10, done: '' },
  { id: 'make_log_crate', category: 'Woodwork', result: 'crate_log', inputs: [{ item: 'log', count: 3 }], tool: 'mallet', skill: 'carpentry', material: 'wood', label: 'Build log crate', verb: 'building a crate', baseTime: 6, stamina: 0.05, done: 'Place on any spot of a tile.' },
  { id: 'make_plank_crate', category: 'Woodwork', result: 'crate_plank', inputs: [{ item: 'plank', count: 6 }, { item: 'nail', count: 12 }], tool: 'mallet', skill: 'carpentry', material: 'wood', label: 'Build plank crate', verb: 'building a crate', baseTime: 6, stamina: 0.05, done: 'Place on any spot of a tile.' },
  // Stonework
  { id: 'make_stone_brick', category: 'Stonework', result: 'stone_brick', count: 2, inputs: [{ item: 'rock_shards' }], tool: 'chisel', skill: 'stonecutting', label: 'Chisel stone brick', verb: 'chiselling', baseTime: 6, stamina: 0.04, difficulty: 12, done: '' },
  { id: 'make_slate_brick', category: 'Stonework', result: 'slate_brick', count: 2, inputs: [{ item: 'slate_shards' }], tool: 'chisel', skill: 'stonecutting', label: 'Chisel slate brick', verb: 'chiselling', baseTime: 6, stamina: 0.04, difficulty: 12, done: '' },
  { id: 'make_marble_brick', category: 'Stonework', result: 'marble_brick', count: 2, inputs: [{ item: 'marble_shards' }], tool: 'chisel', skill: 'stonecutting', label: 'Chisel marble brick', verb: 'chiselling', baseTime: 6, stamina: 0.04, difficulty: 12, done: '' },
  { id: 'make_sandstone_brick', category: 'Stonework', result: 'sandstone_brick', count: 2, inputs: [{ item: 'sandstone_shards' }], tool: 'chisel', skill: 'stonecutting', label: 'Chisel sandstone brick', verb: 'chiselling', baseTime: 6, stamina: 0.04, difficulty: 12, done: '' },
  { id: 'make_whetstone', category: 'Stonework', result: 'whetstone', inputs: [{ item: 'rock_shards', count: 2 }], tool: 'chisel', skill: 'stonecutting', label: 'Shape a whetstone', verb: 'shaping a whetstone', baseTime: 8, stamina: 0.04, difficulty: 10, done: '' },
  // The two brick-built workshops, carried flat-packed like any other piece.
  { id: 'make_smelter', category: 'Stonework', result: 'smelter', inputs: [{ item: 'stone_brick', count: 48 }, { item: 'mortar', count: 24 }], tool: 'trowel', skill: 'masonry', label: 'Build a smelter', verb: 'building a smelter', baseTime: 20, stamina: 0.07, difficulty: 22, done: 'Set down on your settlement.', consumeOnFail: true },
  { id: 'make_kiln', category: 'Stonework', result: 'kiln', inputs: [{ item: 'stone_brick', count: 24 }, { item: 'mortar', count: 8 }], tool: 'trowel', skill: 'masonry', label: 'Build a kiln', verb: 'building a kiln', baseTime: 14, stamina: 0.05, difficulty: 16, done: 'Set down on dry, flat ground.', consumeOnFail: true },
  { id: 'make_quern', category: 'Stonework', result: 'quern', inputs: [{ item: 'rock_shards', count: 3 }], tool: 'chisel', skill: 'stonecutting', label: 'Dress a quern', verb: 'dressing a quern', baseTime: 16, stamina: 0.06, difficulty: 24, done: '', consumeOnFail: true },
  // Slabs: two shards squared off into one flat stone, for paving.
  // A Telestone (`runestones.ts`): the motes worked into a brick, which takes you to a Runestone.
  { id: 'make_telestone', category: 'Stonework', result: 'telestone', inputs: [{ item: 'earth_mote', count: 5 }, { item: 'stone_brick' }], tool: 'chisel', skill: 'stonecutting', label: 'Cut a Telestone', verb: 'cutting a Telestone', baseTime: 20, stamina: 0.06, difficulty: 30, done: '' },
  { id: 'make_stone_slab', category: 'Stonework', result: 'stone_slab', inputs: [{ item: 'rock_shards', count: 5 }], tool: 'chisel', skill: 'stonecutting', label: 'Cut a stone slab', verb: 'cutting a slab', baseTime: 9, stamina: 0.05, difficulty: 16, done: '' },
  { id: 'make_slate_slab', category: 'Stonework', result: 'slate_slab', inputs: [{ item: 'slate_shards', count: 5 }], tool: 'chisel', skill: 'stonecutting', label: 'Cut a slate slab', verb: 'cutting a slab', baseTime: 9, stamina: 0.05, difficulty: 14, done: '' },
  { id: 'make_marble_slab', category: 'Stonework', result: 'marble_slab', inputs: [{ item: 'marble_shards', count: 5 }], tool: 'chisel', skill: 'stonecutting', label: 'Cut a marble slab', verb: 'cutting a slab', baseTime: 10, stamina: 0.05, difficulty: 20, done: '' },
  { id: 'make_sandstone_slab', category: 'Stonework', result: 'sandstone_slab', inputs: [{ item: 'sandstone_shards', count: 5 }], tool: 'chisel', skill: 'stonecutting', label: 'Cut a sandstone slab', verb: 'cutting a slab', baseTime: 9, stamina: 0.05, difficulty: 15, done: '' },
  { id: 'mix_concrete', category: 'Stonework', result: 'concrete', inputs: [{ item: 'mortar' }, { item: 'ash' }], skill: 'masonry', label: 'Mix concrete', verb: 'mixing concrete', baseTime: 4, stamina: 0.03, done: '' },
  { id: 'make_mortar', category: 'Stonework', result: 'mortar', count: 5, inputs: [{ item: 'clay' }, { item: 'sand' }], skill: 'masonry', label: 'Mix mortar', verb: 'mixing mortar', baseTime: 4, stamina: 0.03, done: '' },
  // Clay & thatch
  { id: 'make_clay_brick', category: 'Clay & thatch', result: 'unfired_clay_brick', inputs: [{ item: 'clay' }], skill: 'pottery', label: 'Shape clay brick', verb: 'shaping clay', baseTime: 4, stamina: 0.02, difficulty: 6, done: 'Fire in a kiln.' },
  { id: 'make_clay_pot', category: 'Clay & thatch', result: 'unfired_clay_pot', inputs: [{ item: 'clay', count: 2 }], skill: 'pottery', label: 'Shape a pot', verb: 'shaping a pot', baseTime: 8, stamina: 0.03, difficulty: 12, done: 'Fire in a kiln.' },
  { id: 'make_clay_jar', category: 'Clay & thatch', result: 'unfired_clay_jar', inputs: [{ item: 'clay' }], skill: 'pottery', label: 'Shape a jar', verb: 'shaping a jar', baseTime: 7, stamina: 0.02, difficulty: 10, done: 'Fire in a kiln.' },
  { id: 'make_adobe', category: 'Clay & thatch', result: 'adobe', inputs: [{ item: 'clay' }, { item: 'mixed_grass' }], skill: 'pottery', label: 'Make adobe', verb: 'making adobe', baseTime: 4, stamina: 0.02, done: '' },
  { id: 'fit_rake_head', category: 'Woodwork', result: 'rake', inputs: [{ item: 'rake_head' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a shaft', verb: 'fitting a shaft', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'fit_shovel_head', category: 'Woodwork', result: 'shovel', inputs: [{ item: 'shovel_head' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a shaft', verb: 'fitting a shaft', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'fit_hatchet_head', category: 'Woodwork', result: 'hatchet', inputs: [{ item: 'hatchet_head' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a shaft', verb: 'fitting a shaft', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'fit_sickle_blade', category: 'Woodwork', result: 'sickle', inputs: [{ item: 'sickle_blade' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a handle', verb: 'fitting a handle', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'fit_hammer_head', category: 'Woodwork', result: 'hammer', inputs: [{ item: 'hammer_head' }, { item: 'shaft' }, { item: 'nail' }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a hammer shaft', verb: 'fitting a shaft', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'fit_pickaxe_head', category: 'Woodwork', result: 'pickaxe', inputs: [{ item: 'pickaxe_head' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a shaft', verb: 'fitting a shaft', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'fit_knife_blade', category: 'Woodwork', result: 'butchering_knife', inputs: [{ item: 'knife_blade' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a shaft', verb: 'fitting a shaft', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'fit_sword_blade', category: 'Woodwork', result: 'sword', inputs: [{ item: 'sword_blade' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a shaft', verb: 'fitting a shaft', baseTime: 5, stamina: 0.02, done: '' },
  // Fibre is spun on a spindle and woven on a loom; nothing shortcuts either.
  { id: 'make_toolbelt', category: 'Cloth', result: 'toolbelt', inputs: [{ item: 'leather', count: 4 }, { item: 'ribbon', count: 2 }], tool: 'awl', skill: 'leatherworking', label: 'Stitch a toolbelt', verb: 'stitching a toolbelt', baseTime: 16, stamina: 0.04, difficulty: 22, done: `One loop per ${QL_PER_LOOP} QL.`, consumeOnFail: true },
  { id: 'make_rug', category: 'Cloth', result: 'rug', inputs: [{ item: 'cloth', count: 4 }, { item: 'yarn', count: 6 }], tool: 'needle', station: 'loom', skill: 'tailoring', label: 'Weave a rug', verb: 'weaving a rug', baseTime: 20, stamina: 0.04, difficulty: 20, done: '', consumeOnFail: true },
  { id: 'make_composite_bow', category: 'Cloth', result: 'composite_bow', inputs: [{ item: 'tusk', count: 2 }, { item: 'sinew', count: 4 }, { item: 'shaft', count: 2 }, { item: 'rope', count: 1 }], tool: 'carving_knife', skill: 'bowyery', label: 'Lay up a composite bow', verb: 'laying up a composite bow', baseTime: 30, stamina: 0.06, difficulty: 46, done: '', consumeOnFail: true },
  { id: 'make_scale_helm', category: 'Cloth', result: 'scale_helm', inputs: [{ item: 'dragon_scale', count: 3 }, { item: 'leather', count: 2 }, { item: 'ribbon', count: 1 }], tool: 'awl', skill: 'leatherworking', label: 'Rivet a scale helm', verb: 'riveting scale', baseTime: 22, stamina: 0.05, difficulty: 50, done: '', consumeOnFail: true },
  { id: 'make_scale_cuirass', category: 'Cloth', result: 'scale_cuirass', inputs: [{ item: 'dragon_scale', count: 8 }, { item: 'leather', count: 5 }, { item: 'ribbon', count: 2 }], tool: 'awl', skill: 'leatherworking', label: 'Rivet a scale cuirass', verb: 'riveting scale', baseTime: 40, stamina: 0.08, difficulty: 58, done: '', consumeOnFail: true },
  { id: 'make_scale_sleeves', category: 'Cloth', result: 'scale_sleeves', inputs: [{ item: 'dragon_scale', count: 5 }, { item: 'leather', count: 3 }, { item: 'ribbon', count: 1 }], tool: 'awl', skill: 'leatherworking', label: 'Rivet scale sleeves', verb: 'riveting scale', baseTime: 30, stamina: 0.06, difficulty: 54, done: '', consumeOnFail: true },
  { id: 'make_scale_leggings', category: 'Cloth', result: 'scale_leggings', inputs: [{ item: 'dragon_scale', count: 6 }, { item: 'leather', count: 4 }, { item: 'ribbon', count: 2 }], tool: 'awl', skill: 'leatherworking', label: 'Rivet scale leggings', verb: 'riveting scale', baseTime: 34, stamina: 0.07, difficulty: 56, done: '', consumeOnFail: true },
  { id: 'make_scale_boots', category: 'Cloth', result: 'scale_boots', inputs: [{ item: 'dragon_scale', count: 4 }, { item: 'leather', count: 3 }, { item: 'ribbon', count: 1 }], tool: 'awl', skill: 'leatherworking', label: 'Rivet scale boots', verb: 'riveting scale', baseTime: 26, stamina: 0.05, difficulty: 52, done: '', consumeOnFail: true },
  { id: 'make_net', category: 'Cloth', result: 'fishing_net', inputs: [{ item: 'yarn', count: 12 }, { item: 'rope', count: 2 }], tool: 'needle', skill: 'ropemaking', label: 'Knot a net', verb: 'knotting a net', baseTime: 22, stamina: 0.05, difficulty: 24, done: '', consumeOnFail: true },
  // Off the creel's own bill in `traps.ts`, which is what the help reads, so the two cannot differ.
  { id: 'make_creel', category: 'Cloth', result: 'creel', inputs: TRAPS.creel.bill.map(([item, count]) => ({ item, count })), skill: 'ropemaking', label: 'Weave a creel', verb: 'weaving a creel', baseTime: 16, stamina: 0.04, difficulty: 16, done: '', consumeOnFail: true },
  { id: 'make_rope_tool', category: 'Woodwork', result: 'rope_tool', inputs: [{ item: 'plank' }, { item: 'shaft' }], tool: 'carving_knife', skill: 'carpentry', material: 'wood', label: 'Carve a rope tool', verb: 'carving a rope tool', baseTime: 7, stamina: 0.02, difficulty: 6, done: '' },
  { id: 'make_rope', category: 'Cloth', result: 'rope', inputs: [{ item: 'wemp', count: 4 }], tool: 'rope_tool', skill: 'ropemaking', label: 'Lay up a rope', verb: 'laying up a rope', baseTime: 9, stamina: 0.03, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'make_thick_rope', category: 'Cloth', result: 'thick_rope', inputs: [{ item: 'rope', count: 3 }], tool: 'rope_tool', skill: 'ropemaking', label: 'Lay up a hawser', verb: 'laying up a hawser', baseTime: 16, stamina: 0.05, difficulty: 28, done: '', consumeOnFail: true },
  { id: 'spin_wool', category: 'Cloth', result: 'yarn', count: 2, inputs: [{ item: 'wool', count: 2 }], station: 'spindle', skill: 'tailoring', label: 'Spin into yarn', verb: 'spinning', baseTime: 6, stamina: 0.02, difficulty: 8, done: '', consumeOnFail: true },
  { id: 'spin_cotton', category: 'Cloth', result: 'yarn', count: 2, inputs: [{ item: 'cotton', count: 2 }], station: 'spindle', skill: 'tailoring', label: 'Spin into yarn', verb: 'spinning', baseTime: 6, stamina: 0.02, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'spin_wemp', category: 'Cloth', result: 'yarn', count: 2, inputs: [{ item: 'wemp', count: 2 }], station: 'spindle', skill: 'tailoring', label: 'Spin into yarn', verb: 'spinning', baseTime: 6, stamina: 0.02, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'weave_cloth', category: 'Cloth', result: 'cloth', inputs: [{ item: 'yarn', count: 3 }], station: 'loom', skill: 'tailoring', label: 'Weave cloth', verb: 'weaving', baseTime: 9, stamina: 0.03, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'make_brush', category: 'Woodwork', result: 'brush', inputs: [{ item: 'plank' }, { item: 'nail', count: 3 }], tool: 'carving_knife', skill: 'animal_husbandry', material: 'wood', label: 'Set a brush', verb: 'setting a brush', baseTime: 8, stamina: 0.03, difficulty: 8, done: '', consumeOnFail: true },
  { id: 'make_needle', category: 'Cloth', result: 'needle', count: 2, inputs: [{ item: 'bone' }], tool: 'carving_knife', skill: 'tailoring', label: 'Carve needles', verb: 'carving needles', baseTime: 6, stamina: 0.02, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'make_sack', category: 'Cloth', result: 'sack', inputs: [{ item: 'cloth', count: 2 }], tool: 'needle', skill: 'tailoring', label: 'Stitch a sack', verb: 'stitching a sack', baseTime: 7, stamina: 0.02, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'make_satchel', category: 'Cloth', result: 'satchel', inputs: [{ item: 'leather', count: 3 }, { item: 'ribbon', count: 1 }], tool: 'awl', skill: 'leatherworking', label: 'Stitch a satchel', verb: 'stitching a satchel', baseTime: 12, stamina: 0.03, difficulty: 18, done: '', consumeOnFail: true },
  { id: 'make_backpack', category: 'Cloth', result: 'backpack', inputs: [{ item: 'leather', count: 6 }, { item: 'ribbon', count: 2 }], tool: 'awl', skill: 'leatherworking', label: 'Stitch a backpack', verb: 'stitching a backpack', baseTime: 18, stamina: 0.05, difficulty: 26, done: '', consumeOnFail: true },
  { id: 'make_bandage', category: 'Cloth', result: 'bandage', count: 3, inputs: [{ item: 'cloth' }], tool: 'carving_knife', skill: 'first_aid', label: 'Cut into bandages', verb: 'cutting bandages', baseTime: 6, stamina: 0.02, difficulty: 8, done: '', consumeOnFail: true },
  { id: 'make_awl', category: 'Cloth', result: 'awl', inputs: [{ item: 'bone' }], tool: 'carving_knife', skill: 'leatherworking', label: 'Carve an awl', verb: 'carving an awl', baseTime: 6, stamina: 0.02, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'make_bow_string', category: 'Cloth', result: 'bow_string', inputs: [{ item: 'yarn', count: 2 }], skill: 'bowyery', label: 'Twist a bowstring', verb: 'twisting a string', baseTime: 6, stamina: 0.02, difficulty: 14, done: '', consumeOnFail: true },
  // Cloth armour: sewn from what the loom gives you.
  { id: 'make_wool_cap', category: 'Cloth', result: 'wool_cap', inputs: [{ item: 'cloth', count: 2 }], skill: 'tailoring', label: 'Sew a wool cap', verb: 'sewing a cap', baseTime: 10, stamina: 0.03, difficulty: 14, done: '' },
  { id: 'make_cloth_tunic', category: 'Cloth', result: 'cloth_tunic', inputs: [{ item: 'cloth', count: 4 }], skill: 'tailoring', label: 'Sew a cloth tunic', verb: 'sewing a tunic', baseTime: 14, stamina: 0.04, difficulty: 18, done: '' },
  { id: 'make_cloth_sleeves', category: 'Cloth', result: 'cloth_sleeves', inputs: [{ item: 'cloth', count: 2 }], skill: 'tailoring', label: 'Sew cloth sleeves', verb: 'sewing sleeves', baseTime: 10, stamina: 0.03, difficulty: 15, done: '' },
  { id: 'make_cloth_trousers', category: 'Cloth', result: 'cloth_trousers', inputs: [{ item: 'cloth', count: 3 }], skill: 'tailoring', label: 'Sew cloth trousers', verb: 'sewing trousers', baseTime: 12, stamina: 0.03, difficulty: 16, done: '' },
  { id: 'make_cloth_shoes', category: 'Cloth', result: 'cloth_shoes', inputs: [{ item: 'cloth', count: 2 }], skill: 'tailoring', label: 'Sew cloth shoes', verb: 'sewing shoes', baseTime: 9, stamina: 0.03, difficulty: 14, done: '' },
  // Leather, cut from hide with a knife.
  { id: 'make_leather_cap', category: 'Cloth', result: 'leather_cap', inputs: [{ item: 'leather', count: 2 }], tool: 'carving_knife', skill: 'leatherworking', label: 'Cut a leather cap', verb: 'working leather', baseTime: 11, stamina: 0.04, difficulty: 16, done: '', consumeOnFail: true },
  { id: 'make_leather_jerkin', category: 'Cloth', result: 'leather_jerkin', inputs: [{ item: 'leather', count: 5 }], tool: 'carving_knife', skill: 'leatherworking', label: 'Cut a leather jerkin', verb: 'working leather', baseTime: 16, stamina: 0.05, difficulty: 22, done: '', consumeOnFail: true },
  { id: 'make_leather_sleeves', category: 'Cloth', result: 'leather_sleeves', inputs: [{ item: 'leather', count: 3 }], tool: 'carving_knife', skill: 'leatherworking', label: 'Cut leather sleeves', verb: 'working leather', baseTime: 12, stamina: 0.04, difficulty: 19, done: '', consumeOnFail: true },
  { id: 'make_leather_trousers', category: 'Cloth', result: 'leather_trousers', inputs: [{ item: 'leather', count: 4 }], tool: 'carving_knife', skill: 'leatherworking', label: 'Cut leather trousers', verb: 'working leather', baseTime: 14, stamina: 0.05, difficulty: 20, done: '', consumeOnFail: true },
  { id: 'make_leather_boots', category: 'Cloth', result: 'leather_boots', inputs: [{ item: 'leather', count: 3 }], tool: 'carving_knife', skill: 'leatherworking', label: 'Cut leather boots', verb: 'working leather', baseTime: 13, stamina: 0.04, difficulty: 18, done: '', consumeOnFail: true },
  // Vehicle parts. A wheel is a carpenter's piece; the metal in it is banded on.
  { id: 'make_large_wheel', category: 'Woodwork', result: 'large_wheel', inputs: [{ item: 'plank', count: 4 }, { item: 'shaft', count: 6 }, { item: 'ribbon', count: 1 }, { item: 'nail', count: 12 }], tool: 'mallet', skill: 'carpentry', material: 'wood', label: 'Build a large wheel', verb: 'building a wheel', baseTime: 16, stamina: 0.05, difficulty: 28, done: '', consumeOnFail: true },
  { id: 'make_saddle', category: 'Cloth', result: 'saddle', inputs: [{ item: 'leather', count: 6 }, { item: 'plank', count: 2 }, { item: 'ribbon', count: 1 }, { item: 'nail', count: 8 }], tool: 'awl', skill: 'leatherworking', label: 'Stitch a saddle', verb: 'stitching a saddle', baseTime: 18, stamina: 0.05, difficulty: 26, done: '', consumeOnFail: true },
  { id: 'make_bridle', category: 'Cloth', result: 'bridle', inputs: [{ item: 'leather', count: 3 }, { item: 'rope', count: 1 }, { item: 'ribbon', count: 1 }], tool: 'awl', skill: 'leatherworking', label: 'Stitch a bridle', verb: 'stitching a bridle', baseTime: 10, stamina: 0.03, difficulty: 18, done: '', consumeOnFail: true },
  { id: 'make_yoke', category: 'Cloth', result: 'yoke', inputs: [{ item: 'shaft', count: 1 }, { item: 'leather', count: 2 }, { item: 'nail', count: 4 }], tool: 'awl', skill: 'leatherworking', material: 'wood', label: 'Stitch a yoke', verb: 'stitching a yoke', baseTime: 12, stamina: 0.04, difficulty: 18, done: '', consumeOnFail: true },
  { id: 'make_cheese', category: 'Cooking', result: 'cheese', count: 3, inputs: [{ item: 'milk_bucket' }], tool: 'clay_bowl', skill: 'cooking', returns: [[WHEY_BUCKET, 1]], salvage: [['bucket', 1]], label: 'Press into cheese', verb: 'pressing cheese', baseTime: 14, stamina: 0.03, difficulty: 14, done: 'Whey left in the bucket.', consumeOnFail: true },
  // Churned standing at a butter churn (`dairy.ts`), and the bucket comes back.
  { id: CHURN_BUTTER, category: 'Cooking', result: 'butter', count: BUTTER_PATS, inputs: [{ item: 'milk_bucket' }], station: BUTTER_CHURN, skill: 'cooking', returns: [['bucket', 1]], label: 'Churn butter', verb: 'churning butter', baseTime: 12, stamina: 0.04, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'make_padlock', category: 'Smelting', result: 'padlock', inputs: [{ item: 'ribbon', count: 2 }, { item: 'nail', count: 4 }], tool: 'hammer', station: 'smelter', skill: 'blacksmithing', material: 'metal', label: 'Forge a padlock', verb: 'forging a padlock', baseTime: 16, stamina: 0.05, difficulty: 28, done: 'Key cut when fitted.', consumeOnFail: true },
  { id: 'make_lantern', category: 'Cloth', result: 'lantern', inputs: [{ item: 'ribbon', count: 4 }, { item: 'cloth', count: 2 }, { item: 'shaft' }], tool: 'hammer', skill: 'blacksmithing', label: 'Build a lantern', verb: 'building a lantern', baseTime: 18, stamina: 0.04, difficulty: 24, done: '', consumeOnFail: true },
  { id: 'make_torch', category: 'Cloth', result: 'torch', inputs: [{ item: 'shaft' }, { item: 'cloth' }], skill: 'ropemaking', material: 'wood', label: 'Wind a torch', verb: 'winding a torch', baseTime: 5, stamina: 0.02, difficulty: 6, done: '', consumeOnFail: true },
  { id: 'make_candle', category: 'Cloth', result: 'candle', count: CANDLE_DRAWN.count, inputs: CANDLE_DRAWN.inputs, skill: 'alchemy', label: 'Draw candles', verb: 'drawing candles', baseTime: 9, stamina: 0.02, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'make_work_post', category: 'Woodwork', result: 'work_post', inputs: [{ item: 'plank', count: 2 }, { item: 'shaft', count: 2 }, { item: 'nail', count: 4 }, { item: 'ribbon', count: 1 }], tool: 'mallet', skill: 'carpentry', material: 'wood', label: 'Build a work post', verb: 'building a work post', baseTime: 9, stamina: 0.04, difficulty: 16, done: '' },
  { id: 'make_bucket', category: 'Woodwork', result: 'bucket', inputs: [{ item: 'plank', count: 3 }, { item: 'nail', count: 6 }], tool: 'mallet', skill: 'carpentry', material: 'wood', label: 'Build a bucket', verb: 'building a bucket', baseTime: 7, stamina: 0.03, difficulty: 12, done: '' },
  // Weapons: a head from the anvil and a length of wood to put it on.
  { id: 'fit_short_sword_blade', category: 'Woodwork', result: 'short_sword', inputs: [{ item: 'short_sword_blade' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a grip', verb: 'fitting a grip', baseTime: 6, stamina: 0.03, done: '' },
  { id: 'fit_long_sword_blade', category: 'Woodwork', result: 'long_sword', inputs: [{ item: 'long_sword_blade' }, { item: 'shaft', count: 2 }, { item: 'nail', count: 3 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a grip', verb: 'fitting a grip', baseTime: 8, stamina: 0.04, done: '' },
  { id: 'fit_axe_head', category: 'Woodwork', result: 'battle_axe', inputs: [{ item: 'axe_head' }, { item: 'shaft', count: 2 }, { item: 'nail', count: 3 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a haft', verb: 'fitting a haft', baseTime: 8, stamina: 0.04, done: '' },
  { id: 'fit_maul_head', category: 'Woodwork', result: 'maul', inputs: [{ item: 'maul_head' }, { item: 'shaft', count: 2 }, { item: 'nail', count: 4 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a haft', verb: 'fitting a haft', baseTime: 8, stamina: 0.05, done: '' },
  { id: 'fit_spear_head', category: 'Woodwork', result: 'spear', inputs: [{ item: 'spear_head' }, { item: 'shaft', count: 2 }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a shaft', verb: 'fitting a shaft', baseTime: 6, stamina: 0.03, done: '' },
  { id: 'make_hunting_knife', category: 'Woodwork', result: 'hunting_knife', inputs: [{ item: 'knife_blade' }, { item: 'shaft' }, { item: 'nail' }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a grip', verb: 'fitting a grip', baseTime: 5, stamina: 0.02, done: '' },
  /*
   * And the three handles that were never written down. A blade comes out of
   * a mould and a tool comes off the bench; these three had the first half and
   * not the second, so the saw, the trowel and the carving knife you came
   * ashore with were the only ones there would ever be.
   */
  { id: 'make_carving_knife', category: 'Woodwork', result: 'carving_knife', inputs: [{ item: 'knife_blade' }, { item: 'shaft' }, { item: 'nail' }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a carving grip', verb: 'fitting a grip', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'fit_saw_blade', category: 'Woodwork', result: 'saw', inputs: [{ item: 'saw_blade' }, { item: 'shaft' }, { item: 'nail', count: 2 }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a saw handle', verb: 'fitting a handle', baseTime: 6, stamina: 0.02, done: '' },
  { id: 'fit_trowel_blade', category: 'Woodwork', result: 'trowel', inputs: [{ item: 'trowel_blade' }, { item: 'shaft' }, { item: 'nail' }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a trowel handle', verb: 'fitting a handle', baseTime: 5, stamina: 0.02, done: '' },
  { id: 'make_club', category: 'Woodwork', result: 'club', inputs: [{ item: 'log' }], tool: 'carving_knife', skill: 'carpentry', material: 'wood', label: 'Carve a club', verb: 'carving a club', baseTime: 7, stamina: 0.04, difficulty: 8, done: '' },
  { id: 'make_wooden_shield', category: 'Woodwork', result: 'wooden_shield', inputs: [{ item: 'plank', count: 4 }, { item: 'nail', count: 8 }], tool: 'mallet', skill: 'carpentry', material: 'wood', label: 'Build a wooden shield', verb: 'building a shield', baseTime: 11, stamina: 0.05, difficulty: 16, done: '' },
  { id: 'make_metal_shield', category: 'Woodwork', result: 'metal_shield', inputs: [{ item: 'shield_boss' }, { item: 'plank', count: 3 }, { item: 'nail', count: 8 }], tool: 'mallet', skill: 'carpentry', material: 'metal', label: 'Build a metal shield', verb: 'building a shield', baseTime: 13, stamina: 0.06, difficulty: 20, done: '' },
  // Bows and arrows.
  { id: 'make_short_bow', category: 'Woodwork', result: 'short_bow', inputs: [{ item: 'shaft', count: 2 }, { item: 'bow_string' }], tool: 'carving_knife', skill: 'bowyery', material: 'wood', wood: 'Willow', label: 'Tiller a short bow', verb: 'tillering a bow', baseTime: 12, stamina: 0.04, difficulty: 16, done: '', consumeOnFail: true },
  { id: 'make_medium_bow', category: 'Woodwork', result: 'medium_bow', inputs: [{ item: 'shaft', count: 3 }, { item: 'bow_string' }], tool: 'carving_knife', skill: 'bowyery', material: 'wood', wood: 'Birch', label: 'Tiller a medium bow', verb: 'tillering a bow', baseTime: 15, stamina: 0.05, difficulty: 22, done: '', consumeOnFail: true },
  { id: 'make_long_bow', category: 'Woodwork', result: 'long_bow', inputs: [{ item: 'shaft', count: 4 }, { item: 'bow_string' }], tool: 'carving_knife', skill: 'bowyery', material: 'wood', wood: 'Oak', label: 'Tiller a long bow', verb: 'tillering a bow', baseTime: 18, stamina: 0.06, difficulty: 30, done: '', consumeOnFail: true },
  { id: 'make_javelin', category: 'Woodwork', result: 'javelin', inputs: [{ item: 'shaft', count: 2 }, { item: 'arrow_head', count: 1 }], tool: 'carving_knife', skill: 'fletching', material: 'metal', label: 'Shave a javelin', verb: 'shaving a javelin', baseTime: 7, stamina: 0.03, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'fit_throwing_axe', category: 'Woodwork', result: 'throwing_axe', inputs: [{ item: 'hatchet_head' }, { item: 'shaft' }, { item: 'nail' }], skill: 'carpentry', qlFromInputs: true,  material: 'metal', label: 'Fit a short haft', verb: 'fitting a short haft', baseTime: 6, stamina: 0.03, done: '' },
  { id: 'make_arrows', category: 'Woodwork', result: 'arrow', count: 3, inputs: [{ item: 'shaft' }, { item: 'arrow_head', count: 3 }, { item: 'feather', count: 3 }], tool: 'carving_knife', skill: 'fletching', material: 'metal', label: 'Fletch arrows', verb: 'fletching', baseTime: 8, stamina: 0.03, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'make_broadhead_arrows', category: 'Woodwork', result: 'broadhead_arrow', count: 3, inputs: [{ item: 'shaft' }, { item: 'arrow_head', count: 6 }, { item: 'feather', count: 3 }], tool: 'carving_knife', skill: 'fletching', material: 'metal', label: 'Fletch broadhead arrows', verb: 'fletching', baseTime: 10, stamina: 0.03, difficulty: 18, done: '', consumeOnFail: true },
  { id: 'make_bodkin_arrows', category: 'Woodwork', result: 'bodkin_arrow', count: 3, inputs: [{ item: 'shaft' }, { item: 'arrow_head', count: 3 }, { item: 'feather', count: 3 }], tool: 'carving_knife', skill: 'fletching', material: 'metal', label: 'Fletch bodkin arrows', verb: 'fletching', baseTime: 10, stamina: 0.03, difficulty: 26, done: '', consumeOnFail: true },
  { id: 'make_blunt_arrows', category: 'Woodwork', result: 'blunt_arrow', count: 3, inputs: [{ item: 'shaft' }, { item: 'feather', count: 3 }], tool: 'carving_knife', skill: 'fletching', material: 'wood', label: 'Fletch blunt arrows', verb: 'fletching', baseTime: 6, stamina: 0.02, difficulty: 6, done: '', consumeOnFail: true },
  // Alchemy: ashes leached in water, and what lye is for.
  { id: 'make_lye', category: 'Alchemy', result: 'lye_bucket', inputs: [{ item: 'water_bucket' }, { item: 'ash', count: 2 }], skill: 'alchemy', label: 'Leach into lye', verb: 'making lye', baseTime: 12, stamina: 0.03, difficulty: 14, done: '', consumeOnFail: true, salvage: [['bucket', 1]] },
  { id: 'tan_hide', category: 'Alchemy', result: 'leather', inputs: [{ item: 'hide' }, { item: 'lye_bucket' }], tool: 'carving_knife', skill: 'leatherworking', returns: [['bucket', 1]], label: 'Tan in lye', verb: 'tanning a hide', baseTime: 14, stamina: 0.05, difficulty: 16, done: '', consumeOnFail: true },
  // Writing: reed beds into paper, and what is written on it.
  // Pressed standing at a paper press, as cloth is woven at a loom (`enchant.ts`).
  { id: 'make_papyrus', category: 'Writing', result: 'papyrus', count: 3, inputs: [{ item: 'reed', count: 4 }, { item: 'water_bucket' }], station: PAPER_PRESS, skill: 'papyrusmaking', returns: [['bucket', 1]], label: 'Press into papyrus', verb: 'pressing papyrus', baseTime: 13, stamina: 0.04, difficulty: 16, done: '', consumeOnFail: true },
  { id: 'make_ink', category: 'Writing', result: 'ink', count: 2, inputs: [{ item: 'gland' }, { item: 'ash', count: 2 }, { item: 'water_bucket' }], skill: 'alchemy', returns: [['bucket', 1]], label: 'Grind into ink', verb: 'grinding ink', baseTime: 11, stamina: 0.03, difficulty: 20, done: '', consumeOnFail: true },
  /*
   * An enchantment scroll, one to each enchantment there is (`enchant.ts`):
   * papyrus and motes, rolled on enchanting. A scroll that fails loses its
   * motes and damages its sheet (`scrollFails`); one that comes off is never
   * better than the sheet it was written on.
   */
  ...ENCHANTMENT_LIST.map((e): Recipe => ({
    id: `make_${e.scroll}`, category: 'Enchanting', result: e.scroll,
    inputs: [{ item: 'papyrus', count: SCROLL_SHEETS }, ...e.motes.map(([item, count]) => ({ item, count }))],
    skill: ENCHANTING, label: `Write ${article(e.name)}${e.name} scroll`, verb: 'writing a scroll', baseTime: 12, stamina: 0.03, difficulty: SCROLL_DIFFICULTY,
    note: 'QL at most the papyrus QL',
    done: '',
    fail: `${e.motes.reduce((n, [, k]) => n + k, 0)} motes lost.`,
  })),
  { id: 'make_book', category: 'Writing', result: 'book', inputs: [{ item: 'papyrus', count: 6 }, { item: 'leather', count: 2 }, { item: 'ink' }], tool: 'needle', skill: 'papyrusmaking', label: 'Write and bind a book', verb: 'binding a book', baseTime: 26, stamina: 0.07, difficulty: 28, done: '', consumeOnFail: true },
  { id: 'make_thatch', category: 'Clay & thatch', result: 'thatch', inputs: [{ item: 'mixed_grass', count: 2 }], skill: 'carpentry', label: 'Bundle into thatch', verb: 'bundling thatch', baseTime: 3, stamina: 0.02, done: '' },
  { id: 'make_clay_bowl', category: 'Clay & thatch', result: 'unfired_clay_bowl', inputs: [{ item: 'clay' }], skill: 'pottery', label: 'Shape a bowl', verb: 'shaping a bowl', baseTime: 6, stamina: 0.02, difficulty: 8, done: 'Fire in a kiln.' },
  // Cooking. Everything here needs a lit campfire to work at.
  { id: 'cook_meat', category: 'Cooking', result: 'cooked_meat', inputs: [{ item: 'meat' }], station: 'campfire', skill: 'cooking', label: 'Cook over the fire', verb: 'cooking', baseTime: 8, stamina: 0.02, difficulty: 6, done: '', consumeOnFail: true },
  { id: 'bake_potato', category: 'Cooking', result: 'baked_potato', inputs: [{ item: 'potato' }], station: 'campfire', skill: 'cooking', label: 'Bake in the embers', verb: 'baking', baseTime: 7, stamina: 0.02, done: '' },
  { id: 'roast_onion', category: 'Cooking', result: 'roast_onion', inputs: [{ item: 'onion' }], station: 'campfire', skill: 'cooking', label: 'Roast over the fire', verb: 'roasting', baseTime: 6, stamina: 0.02, done: '' },
  { id: 'roast_nuts', category: 'Cooking', result: 'roast_nuts', inputs: [{ item: 'nuts' }], station: 'campfire', skill: 'cooking', label: 'Roast the nuts', verb: 'roasting nuts', baseTime: 4, stamina: 0.01, done: '' },
  // A lotus seed head's seeds (`watergarden.ts`), a handful at a time.
  { id: 'roast_lotus_seeds', category: 'Cooking', result: 'roast_lotus_seeds', inputs: [{ item: 'lotus_seed', count: 3 }], station: 'campfire', skill: 'cooking', label: 'Roast lotus seeds', verb: 'roasting lotus seeds', baseTime: 4, stamina: 0.01, done: '' },
  { id: 'make_compote', category: 'Cooking', result: 'berry_compote', inputs: [{ item: 'blueberry', count: 3 }], tool: 'clay_bowl', station: 'campfire', skill: 'cooking', label: 'Stew into compote', verb: 'stewing berries', baseTime: 10, stamina: 0.02, done: '' },
  { id: 'fry_meat', category: 'Cooking', result: 'cooked_meat', count: 2, inputs: [{ item: 'meat', count: 2 }], tool: 'frying_pan', station: 'campfire', skill: 'cooking', label: 'Fry in the pan', verb: 'frying', baseTime: 9, stamina: 0.02, done: '' },
  { id: 'make_pottage', category: 'Cooking', result: 'pottage', count: 2, inputs: [{ item: 'cabbage' }, { item: 'carrot' }, { item: 'wheat' }], tool: 'clay_pot', station: 'campfire', skill: 'cooking', label: 'Simmer a pottage', verb: 'simmering a pottage', baseTime: 14, stamina: 0.03, difficulty: 8, done: '', consumeOnFail: true },
  { id: 'make_preserves', category: 'Cooking', result: 'preserves', count: 2, inputs: [{ item: 'strawberry', count: 2 }, { item: 'raspberry', count: 2 }], tool: 'clay_jar', station: 'campfire', skill: 'cooking', label: 'Put up preserves', verb: 'putting up preserves', baseTime: 12, stamina: 0.02, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'make_flour', category: 'Cooking', result: 'flour', inputs: [{ item: 'wheat', count: 2 }], tool: 'quern', skill: 'milling', label: 'Grind into flour', verb: 'grinding flour', baseTime: 9, stamina: 0.05, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'make_cornmeal', category: 'Cooking', result: 'cornmeal', inputs: [{ item: 'corn', count: 2 }], tool: 'quern', skill: 'milling', label: 'Grind into cornmeal', verb: 'grinding cornmeal', baseTime: 9, stamina: 0.05, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'make_dough', category: 'Cooking', result: 'dough', count: 2, inputs: [{ item: 'flour', count: 2 }, { item: 'water_bucket' }], skill: 'cooking', returns: [['bucket', 1]], label: 'Work into dough', verb: 'working dough', baseTime: 8, stamina: 0.04, difficulty: 6, done: '', consumeOnFail: true },
  { id: 'bake_bread', category: 'Cooking', result: 'bread', inputs: [{ item: 'dough' }], station: 'campfire', skill: 'cooking', label: 'Bake on the stone', verb: 'baking bread', baseTime: 12, stamina: 0.03, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'make_porridge', category: 'Cooking', result: 'porridge', count: 2, inputs: [{ item: 'cornmeal' }, { item: 'water_bucket' }], tool: 'clay_bowl', station: 'campfire', skill: 'cooking', returns: [['bucket', 1]], label: 'Boil into porridge', verb: 'boiling porridge', baseTime: 10, stamina: 0.03, difficulty: 8, done: '', consumeOnFail: true },
  { id: 'make_fishing_rod', category: 'Woodwork', result: 'fishing_rod', inputs: [{ item: 'shaft', count: 2 }, { item: 'bow_string' }, { item: 'ribbon' }], tool: 'carving_knife', skill: 'carpentry', material: 'wood', label: 'Splice a fishing rod', verb: 'splicing a rod', baseTime: 10, stamina: 0.03, difficulty: 14, done: '' },
  { id: 'bake_pastry', category: 'Cooking', result: 'pastry', count: 2, inputs: [{ item: 'dough' }, { item: 'butter', count: 2 }], station: 'campfire', skill: 'cooking', label: 'Bake pastry', verb: 'baking pastry', baseTime: 12, stamina: 0.03, difficulty: 14, done: '', consumeOnFail: true },
  { id: 'make_apple_pie', category: 'Cooking', result: 'apple_pie', count: 2, inputs: [{ item: 'dough' }, { item: 'apple', count: 4 }], tool: 'clay_bowl', station: 'campfire', skill: 'cooking', label: 'Bake an apple pie', verb: 'baking a pie', baseTime: 18, stamina: 0.03, difficulty: 20, done: '', consumeOnFail: true },
  { id: 'make_cherry_preserves', category: 'Cooking', result: 'preserves', count: 2, inputs: [{ item: 'cherry', count: 12 }], tool: 'clay_bowl', station: 'campfire', skill: 'cooking', label: 'Preserve cherries', verb: 'preserving cherries', baseTime: 14, stamina: 0.03, difficulty: 14, done: '', consumeOnFail: true },
  { id: 'press_olives', category: 'Cooking', result: 'olive_oil', count: 2, inputs: [{ item: 'olive', count: 10 }], tool: 'quern', skill: 'milling', label: 'Press into oil', verb: 'pressing olives', baseTime: 16, stamina: 0.05, difficulty: 18, done: '', consumeOnFail: true },
  { id: 'make_broth', category: 'Cooking', result: 'broth', count: 2, inputs: [{ item: 'bone', count: 2 }, { item: 'water_bucket' }], tool: 'clay_pot', station: 'campfire', skill: 'cooking', returns: [['bucket', 1]], label: 'Boil a broth', verb: 'boiling a broth', baseTime: 12, stamina: 0.03, difficulty: 10, done: '', consumeOnFail: true, perk: 'broth' },
  { id: 'make_stew', category: 'Cooking', result: 'stew', inputs: [{ item: 'cooked_meat' }, { item: 'potato' }, { item: 'onion' }], tool: 'clay_bowl', station: 'campfire', skill: 'cooking', label: 'Simmer a stew', verb: 'simmering a stew', baseTime: 16, stamina: 0.03, difficulty: 10, done: '', consumeOnFail: true },
  // A stone goes into a plain casting with a file. The piece takes the stone's name, the way a chest takes its wood, and the rarer the stone the harder the seating.
  { id: 'set_focus', category: 'Jewellery', result: 'focus', inputs: [{ item: 'gem' }, { item: 'silver_lump' }], tool: 'file', skill: 'jewellery', material: 'gem', label: 'Set a focus', verb: 'setting a focus', baseTime: 14, stamina: 0.04, difficulty: 20, done: '', consumeOnFail: true },
  { id: 'set_ring', category: 'Jewellery', result: 'jewelled_ring', inputs: [{ item: 'gem' }, { item: 'ring' }], tool: 'file', skill: 'jewellery', material: 'gem', label: 'Set in a ring', verb: 'setting a stone', baseTime: 10, stamina: 0.03, difficulty: 10, done: '' },
  { id: 'set_pendant', category: 'Jewellery', result: 'jewelled_pendant', inputs: [{ item: 'gem' }, { item: 'pendant' }], tool: 'file', skill: 'jewellery', material: 'gem', label: 'Set in a pendant', verb: 'setting a stone', baseTime: 10, stamina: 0.03, difficulty: 12, done: '' },
  ...[],
];

/**
 * Every mould is fired from sand at a smelter; the table decides the rest.
 *
 * Each one says what it casts and how many of them a filling makes, so a
 * search for the piece finds the mould that is the only way to one. Reported
 * as a hole in the game -- "is there no crafting recipe for Big Axle?" -- and
 * it was never a hole: an axle is cast, and the word "axle" appeared nowhere
 * in the book except in the name of the mould, which nobody thinks to look
 * for. The piece, its count and its metal all come off the mould's own row,
 * so none of this can say something the table does not.
 *
 * Every mould is formed by blacksmithing, whatever it casts: asked, "mould
 * QLs when formed should be based off blacksmithing level". The QL is the
 * smith's (`productQl`, the island's `product_ql`) and never the sand's; what
 * the mould casts is beaten true afterwards by the trade its row names.
 */
const MOULD_RECIPES: Recipe[] = MOULDS.map((m) => ({
  id: `make_${m.id}`,
  category: 'Smelting' as RecipeCategory,
  result: m.id,
  inputs: [{ item: 'sand', count: m.sand }],
  station: 'smelter' as Station,
  skill: MOULD_SKILL,
  label: `Fire ${/^[aeiou]/i.test(m.name) ? 'an' : 'a'} ${m.name.toLowerCase()}`,
  note: `Casts ${(m.per ?? 1) > 1 ? `${m.per} × ` : ''}${lower(m.makes)} from ${m.lumps} × metal lump, poured at a smelter${castWhole(m) ? '' : ', smithed at an anvil'}`,
  verb: 'firing a mould',
  baseTime: 8 + m.sand,
  stamina: 0.03,
  difficulty: Math.round(m.difficulty * 0.6),
  done: '',
  consumeOnFail: true,
}));

const SMELTER_RECIPES: Recipe[] = [
  /*
   * Glass, at a hot smelter and by its own trade. Sand is melted down into
   * lumps; a lump is blown and flattened into the panel a window, a bay and a
   * glasshouse roof are glazed with; sand goes straight to a bottle; and a gem
   * ground into the melt colours a batch of the panes stained glass is laid in.
   * Nothing is lost when the panes fail but the time: a gem is one stone in
   * hundreds out of the rock.
   */
  { id: 'make_glass', category: 'Glassblowing', result: 'glass_lump', count: 2, inputs: [{ item: 'sand', count: 3 }], station: 'smelter', skill: 'glassblowing', label: 'Melt into glass', verb: 'melting glass', baseTime: 12, stamina: 0.03, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'make_glass_panel', category: 'Glassblowing', result: 'glass', inputs: [{ item: 'glass_lump' }], station: 'smelter', skill: 'glassblowing', label: 'Blow a glass panel', verb: 'blowing a panel', baseTime: 10, stamina: 0.03, difficulty: 16, done: '', consumeOnFail: true },
  { id: 'make_bottle', category: 'Glassblowing', result: 'bottle', inputs: [{ item: 'sand', count: 2 }], station: 'smelter', skill: 'glassblowing', label: 'Blow a bottle', verb: 'blowing a bottle', baseTime: 10, stamina: 0.03, difficulty: 20, done: '', consumeOnFail: true },
  { id: 'make_stained_glass', category: 'Glassblowing', result: 'stained_glass_pane', count: 20, inputs: [{ item: 'gem' }, { item: 'sand', count: 4 }], station: 'smelter', skill: 'glassblowing', label: 'Make stained glass', verb: 'making stained glass', baseTime: 16, stamina: 0.04, difficulty: 26, done: '' },
  { id: 'make_bronze', category: 'Smelting', result: 'bronze_lump', count: 4, inputs: [{ item: 'copper_lump', count: 3 }, { item: 'tin_lump', count: 1 }], station: 'smelter', skill: 'smelting', qlFromInputs: true, label: 'Mix bronze', verb: 'mixing an alloy', baseTime: 10, stamina: 0.03, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'make_steel', category: 'Smelting', result: 'steel_lump', count: 3, inputs: [{ item: 'iron_lump', count: 3 }, { item: 'coal', count: 1 }], station: 'smelter', skill: 'smelting', qlFromInputs: true, label: 'Make steel', verb: 'making steel', baseTime: 14, stamina: 0.04, difficulty: 20, done: '', consumeOnFail: true },
  { id: 'make_brass', category: 'Smelting', result: 'brass_lump', count: 4, inputs: [{ item: 'copper_lump', count: 3 }, { item: 'zinc_lump', count: 1 }], station: 'smelter', skill: 'smelting', qlFromInputs: true, label: 'Mix brass', verb: 'mixing an alloy', baseTime: 10, stamina: 0.03, difficulty: 12, done: '', consumeOnFail: true },
  { id: 'make_pewter', category: 'Smelting', result: 'pewter_lump', count: 4, inputs: [{ item: 'tin_lump', count: 3 }, { item: 'lead_lump', count: 1 }], station: 'smelter', skill: 'smelting', qlFromInputs: true, label: 'Mix pewter', verb: 'mixing an alloy', baseTime: 10, stamina: 0.03, difficulty: 10, done: '', consumeOnFail: true },
  { id: 'make_electrum', category: 'Smelting', result: 'electrum_lump', count: 4, inputs: [{ item: 'silver_lump', count: 2 }, { item: 'gold_lump', count: 2 }], station: 'smelter', skill: 'smelting', qlFromInputs: true, label: 'Mix electrum', verb: 'mixing an alloy', baseTime: 10, stamina: 0.03, difficulty: 18, done: '', consumeOnFail: true },
];

/**
 * The quern presses fruit as well as olives. Asked for: ten of any fruit
 * into a bucket of juice, and twenty apples or pears straight into a bucket
 * of cider with no barrel and no waiting. One bucket, where the barrel
 * would have made three from the same fruit and fifteen litres of water: a
 * quicker cider and a dearer one. The bucket goes in with the fruit and
 * comes out full; a spoiled press hands it back empty.
 */
const FRUITS: string[] = TREE_DEFS.map((t) => t.fruit).filter((f): f is string => !!f);
const PRESS_RECIPES: Recipe[] = [
  ...FRUITS.map((fruit): Recipe => ({
    id: `press_${fruit}_juice`,
    category: 'Cooking' as RecipeCategory,
    result: 'juice_bucket',
    inputs: [{ item: fruit, count: 10 }, { item: 'bucket' }],
    tool: 'quern',
    skill: 'milling',
    label: 'Press into juice',
    verb: 'pressing juice',
    baseTime: 12,
    stamina: 0.04,
    difficulty: 10,
    done: '',
    consumeOnFail: true,
    salvage: [['bucket', 1]],
  })),
  ...['apple', 'pear'].map((fruit): Recipe => ({
    id: `press_${fruit}_cider`,
    category: 'Cooking' as RecipeCategory,
    result: 'cider_bucket',
    inputs: [{ item: fruit, count: 20 }, { item: 'bucket' }],
    tool: 'quern',
    skill: 'milling',
    label: 'Press into cider',
    verb: 'pressing cider',
    baseTime: 20,
    stamina: 0.05,
    difficulty: 18,
    done: '',
    consumeOnFail: true,
    salvage: [['bucket', 1]],
  })),
];

/**
 * A Cook's Distil: three buckets of one brew boiled off over a fire into one
 * of spirit, whose knack outlasts the brew's (`knack` on the spirit), and two
 * of the buckets back empty.
 */
export const DISTIL_BUCKETS = 3;
const DISTIL_RECIPES: Recipe[] = BREWS.map((b): Recipe => ({
  id: `distil_${b.id}`,
  category: 'Cooking',
  result: 'spirit_bucket',
  inputs: [{ item: `${b.id}_bucket`, count: DISTIL_BUCKETS }],
  tool: 'clay_pot',
  station: 'campfire',
  skill: 'brewing',
  returns: [['bucket', DISTIL_BUCKETS - 1]],
  label: `Distil ${b.name.toLowerCase()}`,
  verb: 'distilling',
  baseTime: 20,
  stamina: 0.04,
  difficulty: 20,
  done: '',
  consumeOnFail: true,
  salvage: [['bucket', DISTIL_BUCKETS]],
  perk: 'distil',
}));
RECIPES.push(...MOULD_RECIPES, ...SMELTER_RECIPES, ...PRESS_RECIPES, ...DISTIL_RECIPES);

/** The twenty pieces of furniture, each nailed together by a fine carpenter; a grave is dug by dying, not built. */
const FURNITURE_RECIPES: Recipe[] = FURNITURE.filter((f) => !f.grave).map((f) => ({
  id: `make_${f.id}`,
  category: 'Furniture' as RecipeCategory,
  result: f.id,
  inputs: f.bill.map(([item, count]) => ({ item, count })),
  tool: f.tool ?? 'mallet',
  skill: f.skill ?? 'fine_carpentry',
  // A carpenter's piece is of the wood it is built from; a mason's is brick, and a tailor's cloth.
  material: f.material ?? (f.skill === 'masonry' || f.skill === 'tailoring' || f.skill === 'fishing' || f.skill === 'ropemaking' ? undefined : ('wood' as const)),
  ...(f.deed ? { deed: true } : {}),
  ...(f.perk ? { perk: f.perk } : {}),
  label: `Build ${f.name.toLowerCase()}`,
  verb: `building ${/^[aeiou]/i.test(f.name) ? 'an' : 'a'} ${f.name.toLowerCase()}`,
  baseTime: f.time,
  stamina: 0.05,
  difficulty: f.difficulty,
  // A trellis goes against a wall, along the whole of a side of its tile (`vineyard.ts`); everything else anywhere on a tile.
  done: [f.done, f.vine
    ? `Set down outside a building, against the outer face of a finished ${trellisWallWords()}: takes the ${SUBTILES} spots along that side of its tile.`
    : 'Set down on any spot of a tile.'].filter(Boolean).join(' '),
}));

RECIPES.push(...FURNITURE_RECIPES);

/**
 * Every fish goes over the fire the same way; how much comes off it is the
 * only difference, and a sturgeon is ten times a perch.
 */
const FISH_PORTIONS: Record<string, number> = { minnow: 1, perch: 1, trout: 2, pike: 4, sturgeon: 10 };
const FISH_RECIPES: Recipe[] = FISH.map((f) => ({
  id: `cook_${f.id}`,
  category: 'Cooking' as RecipeCategory,
  result: 'cooked_fish',
  count: FISH_PORTIONS[f.id] ?? 1,
  inputs: [{ item: f.id }],
  station: 'campfire' as Station,
  skill: 'cooking',
  label: `Cook the ${f.name.toLowerCase()}`,
  verb: 'cooking fish',
  baseTime: 5 + (FISH_PORTIONS[f.id] ?? 1),
  stamina: 0.02,
  done: '',
}));

RECIPES.push(...FISH_RECIPES);

/**
 * A Fisher's Smoke Fish: any fish hung in the smoke of a lit campfire comes
 * off the same fish, keeping its own quality, with the smoker's mark on it to
 * rot slower wherever it is left (`rot:<fish>`, which `groundDecayRate`
 * reads). Worked with fishing rather than cooking, so a Cook's perks on the
 * dishes leave it alone, and made only by a Fisher who has learned it.
 */
const SMOKE_RECIPES: Recipe[] = FISH.map((f) => ({
  id: `smoke_${f.id}`,
  category: 'Cooking' as RecipeCategory,
  result: f.id,
  inputs: [{ item: f.id }],
  station: 'campfire' as Station,
  skill: 'fishing',
  qlFromInputs: true,
  label: `Smoke the ${f.name.toLowerCase()}`,
  verb: 'smoking fish',
  baseTime: 8 + (FISH_PORTIONS[f.id] ?? 1),
  stamina: 0.02,
  done: 'Smoked: rots slower.',
  perk: 'smoke_fish',
}));

RECIPES.push(...SMOKE_RECIPES);

/**
 * A Mender's two, on repair: a kit that takes damage off anything anywhere,
 * and a sealant that stops a thing decaying. Only a Mender who has learned one
 * may make it; anybody may use it.
 */
RECIPES.push(
  {
    id: 'make_repair_kit', category: 'Mending', result: 'repair_kit',
    inputs: [{ item: 'cloth', count: 2 }, { item: 'nail', count: 2 }, { item: 'plank' }], tool: 'hammer', skill: 'repair',
    label: 'Make up a repair kit', verb: 'making up a repair kit', baseTime: 8, stamina: 0.03, difficulty: 20,
    done: '', perk: 'repair_kit',
  },
  {
    id: 'make_sealant', category: 'Mending', result: 'sealant',
    inputs: [{ item: 'tar' }, { item: 'wax' }], skill: 'repair',
    label: 'Mix sealant', verb: 'mixing sealant', baseTime: 6, stamina: 0.02, difficulty: 16,
    done: '', perk: 'sealant',
  },
);

/**
 * An Artisan's three things to make, each only by an Artisan who has learned
 * it: a gold circlet, which takes its stones one at a time off each stone's
 * own menu; an amphora, shaped here and fired in a kiln like any other pot;
 * and a book on a trade, one recipe for each craft trade, written only by
 * somebody who has `TRADE_BOOK_AT` of it. Anybody may wear the first, fill
 * the second and read the third.
 */
export const TRADE_BOOK_AT = 50;
/** The trades a book may be written on: the craft trades' own, one recipe each. */
export const TRADE_BOOK_SKILLS: readonly string[] = CLASSES.filter((c) => c.kind === 'craft').map((c) => c.main);
/** A trade by its name, "Animal husbandry". */
export const skillName = (id: string): string => SKILL_DEFS.find((d) => d.id === id)?.name ?? id;
RECIPES.push(
  {
    id: 'make_circlet', category: 'Jewellery', result: 'circlet',
    inputs: [{ item: 'gold_lump', count: 2 }], tool: 'file', skill: 'jewellery',
    label: 'Draw out a circlet', verb: 'drawing out a circlet', baseTime: 16, stamina: 0.04, difficulty: 24,
    done: `${CIRCLET_STONES} gem settings.`, perk: 'circlet',
  },
  {
    id: 'make_amphora', category: 'Clay & thatch', result: 'unfired_amphora',
    inputs: [{ item: 'clay', count: 4 }], skill: 'pottery',
    label: 'Shape an amphora', verb: 'shaping an amphora', baseTime: 12, stamina: 0.04, difficulty: 18,
    done: 'Fire in a kiln.', perk: 'amphora',
  },
  ...TRADE_BOOK_SKILLS.map((skill): Recipe => ({
    id: `write_trade_book_${skill}`, category: 'Writing', result: 'trade_book',
    inputs: [{ item: 'papyrus', count: 6 }, { item: 'leather', count: 2 }, { item: 'ink', count: 2 }], tool: 'needle', skill: 'papyrusmaking',
    label: `Write a book on ${skillName(skill).toLowerCase()}`, verb: 'writing a book', baseTime: 30, stamina: 0.07, difficulty: 32,
    extra: skillName(skill), writes: skill,
    done: '', consumeOnFail: true, perk: 'trade_book',
  })),
);

/**
 * Every dye is boiled the same way: something that grows, a kilo of it by
 * weight for every litre of lye in the bucket, and a long simmer. What comes
 * off is the bucket itself, with as many litres of dye in it as there was lye:
 * one primary, pure, at the boil's QL (`boiledDye`). Nothing boils into any
 * other colour. The count written here is the fewest whole items over the
 * weight with no perk; what a go takes is worked out from the weight under
 * your perks (`needOf`, `boilCount`).
 */
const DYE_RECIPES: Recipe[] = DYESTUFFS.map((d) => ({
  id: dyeRecipeId(d.from),
  category: 'Alchemy' as RecipeCategory,
  result: DYE_BUCKET,
  inputs: [{ item: d.from, count: boilCountPlain(d.from) }, { item: BOIL_IN }],
  skill: 'alchemy',
  salvage: [['bucket', 1]] as Array<[string, number]>,
  label: `Boil ${itemDef(d.from).name.toLowerCase()} for ${d.primary} dye`,
  verb: `boiling ${d.primary} dye`,
  baseTime: 12,
  stamina: 0.04,
  difficulty: d.difficulty,
  done: `${BOIL_LITRES} litres of ${d.primary} dye.`,
  consumeOnFail: true,
}));

RECIPES.push(...DYE_RECIPES);

/**
 * A healing cover is the herb that suits a wound, bruised into cotton so it
 * will sit on one. The herb is written on the cover, which is what tells five
 * of them apart when they are all one item.
 */
const COVER_RECIPES: Recipe[] = Object.values(WOUND_KINDS).map((k) => ({
  id: `make_cover_${k.herb}`,
  category: 'Alchemy' as RecipeCategory,
  result: 'cover',
  count: 3,
  inputs: [{ item: k.herb, count: 2 }, { item: 'cotton', count: 1 }],
  skill: 'first_aid',
  label: `Work ${k.herb} into a cover`,
  verb: `working a ${k.herb} cover`,
  baseTime: 9,
  stamina: 0.02,
  difficulty: 12,
  extra: k.herb.charAt(0).toUpperCase() + k.herb.slice(1),
  done: `For ${k.name}s.`,
  consumeOnFail: true,
}));

RECIPES.push(...COVER_RECIPES);

/**
 * A Naturalist's three remedies, each made of any one of the healing herbs:
 * a tea that puts stamina back, a salve that keeps a dressed wound from going
 * bad, and a tincture that makes their own four trades go in faster. Only a
 * Naturalist who has learned one may make it; anybody may use it.
 */
const REMEDY_RECIPES: Recipe[] = HERBS.flatMap((herb): Recipe[] => [
  {
    id: `brew_tea_${herb}`, category: 'Alchemy', result: 'herb_tea', count: 3,
    inputs: [{ item: herb, count: 2 }, { item: 'water_bucket' }], skill: 'alchemy', returns: [['bucket', 1]],
    label: `Steep ${herb} into tea`, verb: 'steeping tea', baseTime: 8, stamina: 0.02, difficulty: 10,
    done: '', consumeOnFail: true, perk: 'herb_tea',
  },
  {
    id: `make_salve_${herb}`, category: 'Alchemy', result: 'salve',
    inputs: [{ item: herb, count: 2 }, { item: 'wax' }], skill: 'first_aid',
    label: `Work ${herb} into a salve`, verb: 'working a salve', baseTime: 9, stamina: 0.02, difficulty: 14,
    done: '', consumeOnFail: true, perk: 'salve',
  },
  {
    id: `make_tincture_${herb}`, category: 'Alchemy', result: 'tincture',
    inputs: [{ item: herb, count: 3 }], skill: 'alchemy',
    label: `Steep ${herb} into a tincture`, verb: 'steeping a tincture', baseTime: 12, stamina: 0.03, difficulty: 16,
    done: '', consumeOnFail: true, perk: 'tincture',
  },
]);

RECIPES.push(...REMEDY_RECIPES);

/**
 * The traps that are *built*, out of the same book the game reads them from.
 *
 * Not all of them are. A creel is reed and rope rather than plank and nail,
 * and it has its own recipe further up under ropemaking. It was generated here
 * as well, which gave two recipes one id — and since the map that looks them
 * up keeps whichever it saw last, the hand-written one was dead from the day
 * it was written, and weaving a reed basket trained carpentry and came out
 * made of wood.
 *
 * So anything that already has a recipe of its own keeps it, and the
 * duplicate check below makes sure this cannot happen again quietly.
 */
const TRAP_RECIPES: Recipe[] = Object.values(TRAPS)
  .filter((d) => !RECIPES.some((r) => r.id === `make_${d.id}`))
  .map((d) => ({
    id: `make_${d.id}`,
    category: 'Woodwork' as RecipeCategory,
    result: d.id,
    inputs: d.bill.map(([item, count]) => ({ item, count })),
    tool: d.id === 'deadfall' ? 'mallet' : undefined,
    skill: 'carpentry',
    material: 'wood' as MaterialKind,
    label: `Build a ${d.name.toLowerCase()}`,
    verb: `building a ${d.name.toLowerCase()}`,
    baseTime: d.time,
    stamina: 0.03,
    difficulty: d.difficulty,
    done: '',
  }));

RECIPES.push(...TRAP_RECIPES);

// What a hammer is for, off the recipes that ask for one, so its text cannot name one that does not.
describeFrom('hammer', {
  uses: listed(RECIPES.filter((r) => r.tool === 'hammer').map((r) => `${article(r.result)}${lower(r.result)}`)),
});

/*
 * A recipe's lines say how many it makes and how many of a thing go in off
 * the recipe itself -- `{count:w}`, `{inputs.rope:w}` -- so "three planks"
 * is the three the saw gives. And every item's text and journal line may
 * name a recipe's numbers the same way: a thick rope is
 * `{recipe.make_thick_rope.rope:W}` ropes laid up again, whatever the bill
 * says that is.
 */
/**
 * What a go says when it comes off: how many of what, its material and its
 * QL, then whatever the recipe adds (`done`, a note on what to do with it).
 * "Made: 3 × plank, pine, QL 23.4." The island's `craft_made_said`.
 */
export const madeSaid = (result: string, n: number, mat: string | undefined, ql: number, note: string): string =>
  `Made: ${n > 1 ? `${n} × ` : ''}${lower(result)}${mat ? `, ${mat.toLowerCase()}` : ''}, QL ${ql.toFixed(1)}.${note ? ` ${note}` : ''}`;

/**
 * What a failed go says: what failed, then what was lost, off the recipe --
 * everything that went in when it is lost on a fail, with what comes back
 * (`salvage`, or `returns`), and nothing otherwise -- or the recipe's own
 * word on it (`fail`), for a scroll, whose motes go and whose sheet stays.
 */
const failSaid = (r: Recipe, own?: string): string => {
  const back = r.salvage ?? r.returns ?? [];
  const lost = r.consumeOnFail
    ? `Inputs lost${back.length ? `; ${listed(back.map(([id, n]) => countOf(id, n, true)))} returned` : ''}.`
    : 'Inputs kept.';
  return `Failed: ${lower(r.result)}. ${own || lost}`;
};
/** What a Mason's or a Tailor's Nothing Wasted says when it keeps what a failed go would have lost. The island says the same. */
export const SPARED = 'Nothing Wasted: inputs kept.';

const inputsOf = (r: Recipe): Record<string, number> => Object.fromEntries(r.inputs.map((i) => [i.item, i.count ?? 1]));
for (const r of RECIPES) {
  const said = { ...r, count: r.count ?? 1, inputs: inputsOf(r) };
  r.done = fill(r.done, said);
  r.fail = failSaid(r, r.fail && fill(r.fail, said));
}
const RECIPE_SAID = { recipe: Object.fromEntries(RECIPES.map((r) => [r.id, { count: r.count ?? 1, ...inputsOf(r) }])) };
describeWith(RECIPE_SAID);
describeGoals(RECIPE_SAID);
// What the journal counts as cooking on a campfire: whatever Crafting cooks at one.
campfireFood(RECIPES.filter((r) => r.station === 'campfire' && r.category === 'Cooking').map((r) => r.result));

/** Why a recipe that is worked on a settlement is refused anywhere else; the island says the same (`craft_refusal`). */
export const DEED_ONLY = 'Build only on a settlement of yours.';
/** What makes an altar, which a settlement that already has one will not see built on it (`ONE_ALTAR`). */
const ALTARS = new Set(FURNITURE.filter((f) => f.altar).map((f) => f.id));
/** Whether this recipe would be the settlement's second altar, for somebody standing where the player stands. */
const secondAltar = (r: Recipe, g: Game): boolean => ALTARS.has(r.result) && !!g.altarOfDeedAt(g.player.tileX, g.player.tileY);

/*
 * Jewellery was a category from the day the stones came in and never one the
 * window listed, so a ring, a pendant and a focus were set only off the
 * stone's own menu. It is listed now, with the circlet.
 */
export const RECIPE_CATEGORIES: RecipeCategory[] = ['Woodwork', 'Furniture', 'Stonework', 'Clay & thatch', 'Cloth', 'Alchemy', 'Writing', 'Cooking', 'Smelting',
  'Glassblowing', 'Jewellery', 'Mending', 'Enchanting'];
export const stationName = (s: Station): string => STATION_NAME[s];

export interface RecipeStatus {
  /** Tool carried, or no tool needed. */
  tool: boolean;
  /** Standing at the station it needs, or none needed. */
  station: boolean;
  /** Standing on a settlement of yours, or it can be made anywhere. */
  deed: boolean;
  /** It is an altar, and the settlement you stand on has one already (`ONE_ALTAR`). */
  second: boolean;
  /** Each input: how many a go takes, how many are at hand, and how many of those are on you rather than stored nearby. */
  inputs: Array<{ item: string; need: number; have: number; carried: number }>;
  /** Everything is at hand for at least one craft. */
  ready: boolean;
  /** How many times it can be made with what is carried and stored within reach. */
  max: number;
  /** What it would come out made of, for the recipes that are made of something. */
  material?: string;
}

/**
 * What a go at this would come out at, and what is holding it back.
 *
 * The rule that decides the quality of everything anybody makes here is
 * written in one function, `productQl`, and said out loud nowhere at all. You
 * find it out by making forty whetstones and noticing. It is two facts:
 *
 *   **Your skill is the ceiling.** Nothing you make is better than your hands,
 *   ever. Not with a perfect tool, not on a lucky day.
 *
 *   **Your tool decides how often you reach it.** A go rolls against the
 *   tool's quality: land it and the piece comes out at your skill, miss and it
 *   comes out at roughly what the tool is worth. So a copper chisel at fifteen
 *   gets you your ceiling about one go in seven and something rough the rest
 *   of the time, and that is the whole reason to better a tool.
 *
 * Which is worth saying in the one window where it bites — a recipe row can
 * say it in six words — rather than leaving it to be discovered by a player
 * who has concluded the game is broken. It was reported as exactly that:
 * "i've made a lot of whetstones and haven't managed anything other than QL 1".
 */
export interface Prospect {
  /** The best it can be: your own hands. */
  ceiling: number;
  /** The share of goes that reach it, which is what the tool is worth. */
  reach: number;
  /** Roughly what a go that falls short comes out at. */
  short: number;
  /** Whether the tool rather than the hands is the thing in the way. */
  toolBound: boolean;
  /** Whether a tool is involved at all. */
  tooled: boolean;
  /** Whether the parts decide it rather than the hands, and there is no roll. */
  fromInputs: boolean;
  /** The share of what the parts are worth that survives the work. */
  keep: number;
  /** Whether every part it is made of is at hand, carried or stored within reach, so there is a number to give. */
  partsInHand: boolean;
}

/** How much of what goes into a recipe comes out the other side of it. */
export const inputKeep = (g: Game, r: Recipe): number => 0.78 + g.skills.get(r.skill) / 460;

export function prospect(r: Recipe, g: Game, stock: readonly CraftStock[] = g.craftStock()): Prospect {
  const ceiling = Math.min(100, Math.max(1, g.skills.get(r.skill)));
  /*
   * A thing made out of its own parts is not rolled for at all: what comes
   * off the bench is what went into it, less whatever the hands lose of it.
   * So the number to show is the parts, not the skill -- and until every part
   * is at hand there is no number to show, only the share.
   */
  if (r.qlFromInputs) {
    const keep = inputKeep(g, r);
    const partsInHand = r.inputs.every((i) => stock.some((s) => s.item.id === i.item));
    return {
      ceiling: partsInHand ? Math.max(1, Math.min(100, inputQl(stock, r) * keep)) : 0,
      reach: 1,
      short: 0,
      toolBound: false,
      tooled: false,
      fromInputs: true,
      keep,
      partsInHand,
    };
  }
  const toolQl = r.tool ? g.toolQl(r.tool) : 0;
  const rolled = { fromInputs: false, keep: 1, partsInHand: false };
  if (!r.tool || toolQl <= 0) return { ceiling, reach: 1, short: ceiling, toolBound: false, tooled: false, ...rolled };
  return {
    ceiling,
    reach: Math.max(0, Math.min(1, toolQl / 100)),
    short: Math.min(ceiling, Math.max(1, toolQl)),
    // A tool is in the way when missing with it costs you something worth
    // having. A tool already better than your hands costs a miss nothing.
    toolBound: toolQl < ceiling * 0.9,
    tooled: true,
    ...rolled,
  };
}

/**
 * How many of an input a go takes from you: the recipe's own count, or fewer
 * for a perk on the recipe (a Carpenter's String Maker), and never under one,
 * as `recipe_need` has it on the island.
 */
export const needOf = (g: Game, r: Recipe, i: { item?: string; count?: number }): number =>
  // A boil's dyestuff by its weight, the fewest whole items over it (`boilCount`); the island's `recipe_need` the same.
  (i.item && isBoilStuff(r.id, i.item) ? boilCount(g, r.id, i.item)
    : Math.max(1, Math.ceil((i.count ?? 1) * g.perk(`need:${r.id}`, 1))));

/**
 * What a recipe needs against what is at hand.
 *
 * `stock` is what is at hand, `g.craftStock()` unless it is handed in: the
 * crafting window asks this of every recipe in the book at once, and lists
 * the pack and the stores around you once for the lot rather than once a row.
 */
export function recipeStatus(r: Recipe, g: Game, want?: string, stock: readonly CraftStock[] = g.craftStock(undefined, false, reachFor(g, r))): RecipeStatus {
  const tool = !r.tool || g.inventory.has(r.tool);
  const station = !r.station || g.atStation(r.station);
  const deed = !r.deed || g.onDeed(g.player.tileX, g.player.tileY);
  const second = secondAltar(r, g);
  const material = chooseMaterial(g, r, undefined, want, stock);
  const inputs = r.inputs.map((i) => ({
    item: i.item,
    need: needOf(g, r, i),
    have: countFor(stock, r, i.item, material),
    carried: countFor(stock, r, i.item, material, true),
  }));
  const max = tool && station && deed && !second ? Math.min(...inputs.map((i) => Math.floor(i.have / i.need))) : 0;
  return { tool, station, deed, second, inputs, ready: max >= 1, max, material };
}

/**
 * How many of an item are at hand for a craft. Once a material has been
 * settled on, only stock of that material counts towards the inputs that
 * carry one — the nails in an oak chest are still whatever metal the nails
 * are, but every plank in it has to be oak.
 *
 * `onYou` counts only what is carried, for saying how much of it is.
 */
function countFor(stock: readonly CraftStock[], r: Recipe, id: string, mat: string | undefined, onYou = false): number {
  let matching = 0;
  let all = 0;
  // An input that could be of this material has to be of the chosen one; one
  // that never is — the nails in an oak chest — counts whatever it is. Which
  // of those an input is, is asked of everything at hand, carried or not.
  let strict = false;
  // Lumps of a metal count its ingots too, each as its lumps (a Smith's
  // Ingots); the island breaks into one for what the go takes.
  const lumpOf = METAL_BY_LUMP.get(id);
  const bar = lumpOf ? ingotOf(lumpOf) : undefined;
  for (const s of stock) {
    const it = s.item;
    const per = it.id === id ? 1 : it.id === bar ? INGOT_LUMPS : 0;
    if (!per) continue;
    if (mat && isMaterialKind(it.extra, r.material as MaterialKind)) strict = true;
    if (onYou && !s.carried) continue;
    all += it.count * per;
    if (mat && it.extra === mat) matching += it.count * per;
  }
  return strict ? matching : all;
}

/**
 * How far a recipe reaches into your stores: as far as any craft, as far as a
 * Smith's Forge Reach takes work at the smelter for a recipe made there, as
 * far as a Cook's Pantry Reach takes cooking, and as far as a Tailor's
 * Workshop Reach takes tailoring, leatherworking and ropemaking.
 */
export const reachFor = (g: Game, r: Recipe): number =>
  (r.station === 'smelter' ? g.forgeReach()
    : r.skill === 'cooking' ? Math.max(CRAFT_REACH, Math.floor(g.perk('reach:cook', CRAFT_REACH)))
      : TAILOR_SKILLS.has(r.skill) ? Math.max(CRAFT_REACH, Math.floor(g.perk('reach:tailor', CRAFT_REACH)))
        : CRAFT_REACH);

/** The trades a Tailor's Workshop Reach takes further: the island's `tailor_work`. */
export const TAILOR_SKILLS: ReadonlySet<string> = new Set(['tailoring', 'leatherworking', 'ropemaking']);

/** Whether this input has to be of the settled material rather than anything. */
const strictInput = (stock: readonly CraftStock[], r: Recipe, id: string): boolean =>
  !!r.material && stock.some(({ item: it }) => it.id === id && isMaterialKind(it.extra, r.material as MaterialKind));

/**
 * The materials of its kind a craft could be made of, off what is at hand:
 * the woods among the planks for a chest. The first input that has stock of
 * the kind decides, the way `chooseMaterial` reads it; a recipe that names
 * its wood offers nothing to choose.
 */
export function materialChoices(g: Game, r: Recipe, stock: readonly CraftStock[] = g.craftStock(undefined, false, reachFor(g, r))): string[] {
  if (!r.material || r.wood) return [];
  for (const i of r.inputs) {
    const stacks = stock.filter(({ item: it }) => it.id === i.item && isMaterialKind(it.extra, r.material as MaterialKind));
    if (stacks.length) return [...new Set(stacks.map((s) => s.item.extra as string))].sort();
  }
  return [];
}

/**
 * Which material this craft will be made of: whatever was clicked if it will
 * serve, then whatever the crafting window was set to if any of it is at
 * hand, and otherwise whichever there is most of. A recipe that names its
 * wood takes that and nothing else.
 */
export function chooseMaterial(g: Game, r: Recipe, preferUid?: number, want?: string, stock: readonly CraftStock[] = g.craftStock(preferUid, false, reachFor(g, r))): string | undefined {
  if (!r.material) return undefined;
  if (r.wood) return r.wood;
  for (const i of r.inputs) {
    const stacks = stock.filter(({ item: it }) => it.id === i.item && isMaterialKind(it.extra, r.material as MaterialKind)).map((s) => s.item);
    if (!stacks.length) continue;
    const clicked = stacks.find((it) => it.uid === preferUid);
    if (clicked) return clicked.extra;
    if (want && stacks.some((it) => it.extra === want)) return want;
    const need = needOf(g, r, i);
    const held = new Map<string, number>();
    for (const st of stacks) held.set(st.extra as string, (held.get(st.extra as string) ?? 0) + st.count);
    let best: string | undefined;
    let bestN = -1;
    for (const [name, n] of held) if (n >= need && n > bestN) [bestN, best] = [n, name];
    if (best) return best;
    // Nothing named covers it. Plain stock from before the woods were told
    // apart still will, so let that through rather than blocking on it.
    const plain = stock.filter(({ item: it }) => it.id === i.item && !it.extra).reduce((n, s) => n + s.item.count, 0);
    return plain >= need ? undefined : [...held.keys()][0];
  }
  return undefined;
}

/** Why a recipe cannot be made right now, or null. */
export function recipeReason(r: Recipe, g: Game, preferUid?: number, stock: readonly CraftStock[] = g.craftStock(preferUid, false, reachFor(g, r))): string | null {
  if (r.perk && g.perk(r.perk, 0) <= 0) return RECIPE_PERK_SAYS[r.perk] ?? 'Need a perk.';
  // A book on a trade is written only by somebody who knows enough of it.
  if (r.writes && g.skills.get(r.writes) < TRADE_BOOK_AT) {
    return `Need ${skillName(r.writes).toLowerCase()} ${TRADE_BOOK_AT}.`;
  }
  if (r.tool && !g.inventory.has(r.tool)) return `Need ${article(r.tool)}${lower(r.tool)}.`;
  if (r.station && !g.atStation(r.station)) return `Need: ${STATION_NAME[r.station]}.`;
  if (r.deed && !g.onDeed(g.player.tileX, g.player.tileY)) return DEED_ONLY;
  if (secondAltar(r, g)) return ONE_ALTAR;
  const mat = chooseMaterial(g, r, preferUid, undefined, stock);
  if (r.wood) {
    const i = r.inputs[0];
    const need = needOf(g, r, i);
    if (countFor(stock, r, i.item, r.wood) < need) return `Need ${need} ${plural(i.item, need)} of ${r.wood.toLowerCase()} only.`;
  }
  for (const i of r.inputs) {
    const need = needOf(g, r, i);
    // A boil says the weight it takes and the weight there is (`boilRefusal`).
    const short = isBoilStuff(r.id, i.item) ? boilRefusal(g, r.id, i.item, countFor(stock, r, i.item, mat)) : null;
    if (short) return short;
    if (countFor(stock, r, i.item, mat) < need) {
      const of = mat && strictInput(stock, r, i.item) ? ` of ${mat.toLowerCase()}` : '';
      return `Need ${need} ${plural(i.item, need)}${of}${r.inputs.length > 1 ? ` (${r.inputs.map((x) => `${needOf(g, r, x)} ${plural(x.item, needOf(g, r, x))}`).join(', ')})` : ''}.`;
    }
  }
  return null;
}

/** Human readable list of what a recipe needs: "clay bowl · 1 cooked meat · 1 potato". */
export function recipeNeeds(r: Recipe): string {
  const parts = r.inputs.map((i) => `${i.count ?? 1} ${plural(i.item, i.count ?? 1)}`);
  return (r.tool ? [lower(r.tool), ...parts] : parts).join(' · ');
}

/**
 * The quality of what a recipe is about to consume, weighted by how much of
 * each of it goes in -- by mass, not by the count.
 *
 * It used to weigh by the count, which is the same answer for every recipe
 * that had ever asked: the five alloys take lumps, and the lumps of a given
 * alloy all weigh the same, so three of one and one of another divides the
 * same way whichever unit you use. It is a different answer the moment a
 * recipe takes things of different sizes -- a pickaxe head, a shaft and two
 * nails -- where counting makes a nail worth as much as the head, and the two
 * nails between them worth more. Two hundredths of a kilogram of iron do not
 * decide what a pickaxe is.
 *
 * Each input is read off the stack a go would spend first -- the clicked one
 * where it is one of them, and otherwise the first `drawFor` reaches -- so the
 * number the window gives is the number the bench makes.
 */
function inputQl(stock: readonly CraftStock[], r: Recipe, preferUid?: number, mat?: string): number {
  let total = 0;
  let mass = 0;
  for (const i of r.inputs) {
    const stack = drawFor(stock, i.item, i.count ?? 1, preferUid, mat)?.[0]?.item
      ?? stock.find((s) => s.item.id === i.item)?.item;
    if (!stack) continue;
    const share = itemDef(i.item).weight * (i.count ?? 1);
    total += stack.ql * share;
    mass += share;
  }
  return mass ? total / mass : 1;
}

/**
 * The stacks `n` units of an item would be spent from, in the order they are
 * spent: the clicked stack first, and then the rest as `Game.craftStock` lists
 * them -- the pack, the bags, the stores nearest first. Once a material has
 * been settled on, only stock of that material is drawn from for the inputs
 * that have enough of it, which is what stops a chest being half oak and half
 * pine. Null when there is not enough of it at all.
 */
function drawFor(stock: readonly CraftStock[], id: string, n: number, preferUid?: number, mat?: string, strict = false): CraftStock[] | null {
  const pool = stock.filter((s) => s.item.id === id && (!mat || s.item.extra === mat));
  const enough = pool.reduce((sum, s) => sum + s.item.count, 0) >= n;
  if (strict && !enough) return null;
  const from = enough ? pool : stock.filter((s) => s.item.id === id);
  if (from.reduce((sum, s) => sum + s.item.count, 0) < n) return null;
  // A stable sort: the clicked stack to the front, everything else where it was.
  return [...from].sort((a, b) => Number(b.item.uid === preferUid) - Number(a.item.uid === preferUid));
}

/**
 * Use up `n` units of an item from the stacks `drawFor` names, and count what
 * was taken into `tally` by its rarity where one is handed in: what a craft's
 * rare ingredients put on the chance of a rare one is the units actually used
 * (`rarityBands`).
 */
function consumeAcross(stock: readonly CraftStock[], id: string, n: number, preferUid?: number, mat?: string, strict = false, tally?: number[]): boolean {
  const from = drawFor(stock, id, n, preferUid, mat, strict);
  if (!from) return false;
  let left = n;
  for (const s of from) {
    if (left <= 0) break;
    const take = Math.min(left, s.item.count);
    const step = s.item.rare ?? 0;
    if (take > 0 && s.spend(take)) {
      left -= take;
      if (tally) tally[step] = (tally[step] ?? 0) + take;
    }
  }
  return left === 0;
}

/**
 * A scroll that did not come off: its motes are used up, and the sheet of
 * papyrus a go would have spent first takes `SCROLL_HARM` damage as one of its
 * pile -- the pile's damage up by that over its sheets -- or, where that takes
 * the sheet to `DAMAGE_MAX`, is used up. Which of the two, for the words. The
 * island's `scroll_fails` does the same to the same sheet.
 */
function scrollFails(stock: readonly CraftStock[], r: Recipe, preferUid: number): 'harmed' | 'used' | 'none' {
  for (const i of r.inputs) if (i.item !== 'papyrus') consumeAcross(stock, i.item, i.count ?? 1, preferUid);
  const s = drawFor(stock, 'papyrus', SCROLL_SHEETS, preferUid)?.[0];
  if (!s) return 'none';
  if (s.item.dmg + SCROLL_HARM >= DAMAGE_MAX) {
    s.spend(1);
    return 'used';
  }
  s.item.dmg += SCROLL_HARM / s.item.count;
  return 'harmed';
}

/** What a failed scroll did to its sheet, in the words the island says too (`scroll_harm_said`). */
export const scrollHarmSaid = (harm: 'harmed' | 'used' | 'none'): string =>
  (harm === 'used' ? `Papyrus: ${SCROLL_HARM} damage, used up.`
    : harm === 'harmed' ? `Papyrus: ${SCROLL_HARM} damage.` : '');

export function recipeAction(r: Recipe): ActionDef {
  const materials = r.inputs.map((i) => i.item);
  const toolQl = (g: Game): number => (r.tool ? g.toolQl(r.tool) : 0);
  /**
   * Whether another one can still be made.
   *
   * This used to count down a number carried *inside the target* — `t.count`,
   * decremented on every go — which is the mechanism a stack-mover uses, where
   * the number means "how many of this pile" and the island reads it off the
   * target. A craft's number never meant that. It meant *how many goes*, which
   * is `goes`, which travels through `rpc_act`'s `p_times` and which the craft
   * window never sent: so the island was asked for one craft with a meaningless
   * 19 tied to it, and made one.
   *
   * With `goes` doing the counting, all this has to answer is whether the
   * bench can go round again. A recipe is no longer a `quantity` action, and
   * the toolbelt will offer it by the handful like every other job.
   */
  const more = (t: Target, g: Game): boolean =>
    t.kind === 'item' && recipeReason(r, g, t.uid) === null;
  /**
   * Keep a run of goes going on the next pile of the same thing, once a go has
   * used up the pile it was started on.
   *
   * A run is aimed at one stack, and a job whose stack has gone has nothing
   * left to do (`applies`). That was right while every pile of a thing sat in
   * the pack as one stack. With the stores beside you counted in, twenty goes
   * asked for off two logs in the pack and a crate of them would stop at the
   * second, with the crate untouched. So the job moves on to the next pile of
   * the same thing, of the same wood or metal: the pile the next go would have
   * reached for anyway.
   */
  const carryOn = (t: Extract<Target, { kind: 'item' }>, g: Game, was: Item | undefined, mat: string | undefined): void => {
    if (!was || g.craftItem(t.uid, reachFor(g, r))) return;
    const next = g.craftStock(undefined, false, reachFor(g, r)).find((s) => s.item.id === was.id && (!mat || s.item.extra === mat));
    if (next) t.uid = next.item.uid;
  };
  return {
    id: r.id,
    label: r.label,
    verb: r.verb,
    skill: r.skill,
    tool: r.tool,
    stamina: r.stamina,
    baseTime: r.baseTime,
    difficulty: r.difficulty,
    repeat: true,
    // Aimed at a stack of one of its materials, wherever a craft may reach it:
    // the pack, a bag on your back, or a store within `CRAFT_REACH`.
    applies: (t, g) => t.kind === 'item' && materials.includes(g.craftItem(t.uid, reachFor(g, r))?.id ?? ''),
    check: (t, g) => recipeReason(r, g, t.kind === 'item' ? t.uid : undefined),
    // Counted with the stack it was started on, which may be one the settings would not have picked.
    maxRepeat: (t, g) => recipeStatus(r, g, undefined, g.craftStock(t.kind === 'item' ? t.uid : undefined, false, reachFor(g, r))).max,
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      // Everything this go may spend, listed once: the pack, then the bags,
      // then the stores within reach, nearest first -- and the stack it was
      // started on, whatever the settings say about rare stock.
      const stock = g.craftStock(t.uid, false, reachFor(g, r));
      const was = stock.find((s) => s.item.uid === t.uid)?.item;
      // An oven holds its heat evenly: what would burn over a fire comes out right.
      const oven = r.station === 'campfire' ? g.hotOvenNear() : undefined;
      const ease = g.mindEase() + (oven ? 10 : 0);
      // What it is being made of decides how stubborn the work is: oak and
      // the deep metals fight the hands that shape them.
      const mat = chooseMaterial(g, r, t.uid, undefined, stock);
      // Worked out before anything is used up, since using things up changes
      // the answer.
      const strict = new Map(r.inputs.map((i) => [i.item, strictInput(stock, r, i.item)]));
      const hard = (r.difficulty ?? 0) + matOf(mat).difficulty;
      // Surer for a perk on the recipe (a Mason's Sure Chisel, a Tailor's Sure Needle).
      if (r.difficulty !== undefined && !g.sureCheck(r.id, r.skill, hard, toolQl(g), ease)) {
        // A scroll that fails loses its motes and damages the sheet it was being written on (`scrollFails`).
        if (scrollOf(r.result)) {
          const harm = scrollFails(stock, r, t.uid);
          carryOn(t, g, was, mat);
          g.missed();
          g.gainSkill('mind_logic', tryGain(false, CRAFT_HEAD));
          g.logMsg([r.fail, scrollHarmSaid(harm)].filter(Boolean).join(' '), 'event');
          return more(t, g);
        }
        // And nothing lost of what went into it, now and then, for a perk on
        // the recipe (a Mason's or a Tailor's Nothing Wasted), as the island has it.
        const keep = r.consumeOnFail ? g.perk(`spare:${r.id}`, 0) : 0;
        const spared = keep > 0 && g.rand() < keep;
        // And the stone out of it whole, whatever else is lost, for an Artisan's Keep the Stone.
        const stone = r.consumeOnFail && !spared && g.perk(`stone:${r.id}`, 0) > 0 && r.inputs.some((i) => i.item === 'gem');
        if (r.consumeOnFail && !spared) {
          for (const i of r.inputs) {
            if (stone && i.item === 'gem') continue;
            consumeAcross(stock, i.item, needOf(g, r, i), t.uid, mat, strict.get(i.item));
          }
          // The batch is wasted, not the vessel: you tip the ruin out and keep
          // the bucket.
          for (const [id, n] of r.salvage ?? r.returns ?? []) g.inventory.add(id, { count: n, ql: 20 });
          carryOn(t, g, was, mat);
        }
        g.missed();
        g.gainSkill('mind_logic', tryGain(false, CRAFT_HEAD));
        g.logMsg(stone ? STONE_KEPT : r.fail ?? `Failed: ${lower(r.result)}.`, 'event');
        if (spared) g.logMsg(SPARED, 'event');
        return more(t, g);
      }
      const fromInputs = r.qlFromInputs ? inputQl(stock, r, t.uid, mat) : 0;
      // A scroll is never better than the sheet it is written on, read off the sheet a go spends first.
      const sheet = scrollOf(r.result) ? drawFor(stock, 'papyrus', SCROLL_SHEETS, t.uid)?.[0]?.item.ql : undefined;
      // What the parts the anvil beat out carry of their makers' marks, read
      // off the stacks a go spends first, before spending them: a Smith's Keen
      // Edge in a sword blade goes into the sword whoever fits it.
      const parts = itemDef(r.result).stackable ? [] : r.inputs.filter((i) => MOULD_BY_MAKES.has(i.item) || MARKED_PARTS.has(i.item))
        .map((i) => drawFor(stock, i.item, needOf(g, r, i), t.uid, mat, strict.get(i.item))?.[0]?.item)
        .filter((it): it is Item => !!it);
      // A Cook's Frugal Cook: one of the first ingredient that is not a
      // vessel, at the quality of the stack it came off, now and then.
      const spare = r.inputs.find((i) => !VESSELS[i.item] && i.item !== 'bucket');
      const spareQl = spare ? drawFor(stock, spare.item, needOf(g, r, spare), t.uid, mat, strict.get(spare.item))?.[0]?.item.ql : undefined;
      // A Tailor's Lye Saver: now and then the vessel's liquid is not used up,
      // and the full vessel stays as it was rather than coming back empty.
      const keepVessel = g.perk(`lye:${r.id}`, 0);
      const vesselKept = keepVessel > 0 && g.rand() < keepVessel;
      // The pot, the bowl or the jar it is done in, and what its maker put into it: a serving more of
      // a dish for an Artisan's Deep Pot, and what is put up in it keeping longer for their Sealed Jar.
      const vessel = r.tool ? g.inventory.tool(r.tool) : undefined;
      const served = isDish(r.result) ? serveOf(vessel) : 0;
      const keeps = vessel ? markOf(vessel, 'keeps') : 1;
      // What a boil takes of its dyestuff, to say so when it comes off (`boiledDye`).
      const boiled = r.result === DYE_BUCKET ? needOf(g, r, r.inputs[0]) : 0;
      // The units used up, by their rarity, for what rare ones put on the
      // chance of a rare one (`rarityBands`). A bucket of water or lye is the
      // bucket's rarity and the bucket comes back, so it is no ingredient.
      const used = rarityTally();
      for (const i of r.inputs) {
        if (vesselKept && VESSELS[i.item]) continue;
        if (!consumeAcross(stock, i.item, needOf(g, r, i), t.uid, mat, strict.get(i.item), VESSELS[i.item] ? undefined : used)) return;
      }
      carryOn(t, g, was, mat);
      /*
       * Two rules, and which one a recipe takes is whether the thing is made
       * out of its parts or made by the hands out of raw stuff.
       *
       * A pickaxe is its head. It was taking the second rule -- a straight
       * roll on carpentry, with the head thrown away -- so an eighty-four
       * quality vein, mined at ninety-three, smelted, poured and forged into
       * a head worth seventy-eight became whatever the roll said, and every
       * step of the metal before it counted for nothing. Reported from the
       * island as a wall: the best anybody could get out of an eighty-four
       * ore was seventy-two, however good their mining.
       *
       * So the seventeen recipes that join a forged part to a handle take the
       * first rule now, the one the alloys have always taken: the parts,
       * weighed by how much of each goes in, and the hands deciding how much
       * of that survives -- 78% of it at no skill and 99.7% at a hundred. The
       * ceiling is the parts; nothing is finer than what it is made of.
       */
      const rolled = r.qlFromInputs ? Math.max(1, Math.min(100, fromInputs * inputKeep(g, r))) : g.productQl(r.skill, toolQl(g) + (oven ? oven.ql * 0.3 : 0));
      // And better for a perk on the recipe (a Cook's Fine Fare), and for a Masterwork on the station it is made at
      // (`Game.masterAt`), and a scroll never better than its sheet, whatever made it.
      const better = Math.min(100, rolled * g.perk(`ql:${r.id}`, 1) + (r.station ? g.masterAt(r.station) : 0));
      const ql = sheet === undefined ? better : Math.min(better, sheet);
      // More, the go a bauble on the trade comes up in the altar of the settlement
      // you work on, and more again for a perk (a Carpenter's Clean Sawing).
      const goes = g.madeAGo(r) + served;
      // A boil fills the one bucket it is done in, so a bauble has no go to add to it (`boiledDye`).
      const count = r.result === DYE_BUCKET ? goes : g.baubleYield(r.result, goes);
      // What the maker's perks put into it, which stays with it (a Carpenter's
      // Deep Drawers, a Smith's Temper Bath, a Cook's Hearty), over what its
      // parts carried. A pile of the same thing marked the same way is one
      // pile, and it goes in with the mark so that it stacks by it.
      const stackable = !!itemDef(r.result).stackable;
      const own = stackable ? makersMark((k, d) => g.perk(k, d), r.result) : overParts(partsMark(parts), makersMark((k, d) => g.perk(k, d), r.result));
      const mark = keeps !== 1 ? { ...(own ?? {}), rot: markOf({ mark: own }, 'rot') * keeps } : own;
      const marked = mark && Object.keys(mark).length ? mark : undefined;
      // Now and again a thing comes off the bench better than the hands that
      // made it had any right to produce, the odds bettered by a perk on the
      // recipe (a Carpenter's Master Joiner) and by the rare things that went
      // into it, each step by its share of the units used (`rarityBands`).
      // Rolled before it goes into the pack, and rare work carries its maker's
      // name, so that it starts a pile of its own: set after, it made the whole
      // pile it went onto rare.
      const rare = rollRarityFrom(g.rand, used, g.perk(`rare:${r.id}`, RARITY_ODDS[0]));
      const rareIn = rareInputSaid(used);
      const item = g.inventory.add(r.result, {
        count, ql, extra: r.extra ?? mat, ...(stackable && marked ? { mark: marked } : {}), ...(rare ? { rare } : {}),
        // Rare work, and one thing made at the signing QL, carries its maker's name (`signing.ts`).
        maker: madeBy(g.player.name, r.result, ql, rare),
      });
      if (!stackable && marked) item.mark = marked;
      // A boil leaves its dye in the bucket it was boiled in (`dyes.ts`).
      if (r.result === DYE_BUCKET) boiledDye(g, item, r.inputs[0].item, boiled);
      // What the rare ingredients put on the chance, said whether or not it came up.
      if (rareIn) g.logMsg(rareIn, 'event');
      if (rare) {
        g.note(['', 'rare', 'supreme', 'fantastic'][rare]);
        g.logMsg(RARITY_WORD[rare], 'skill');
      }
      g.madeIt(r.result, item.ql, count, rare);
      for (const [id, n] of r.returns ?? []) {
        if (vesselKept && r.inputs.some((i) => VESSELS[i.item]?.empty === id)) continue;
        g.inventory.add(id, { count: n, ql: 20 });
      }
      if (vesselKept) g.logMsg(VESSEL_KEPT, 'event');
      if (spare && g.rand() < g.perk(`keep:${r.id}`, 0)) {
        g.inventory.add(spare.item, { count: 1, ql: spareQl ?? item.ql });
        g.logMsg(`Frugal Cook: ${article(spare.item)}${lower(spare.item)} kept.`, 'event');
      }
      // Working a thing out with your hands is what sharpens the head.
      g.gainSkill('mind_logic', tryGain(true, CRAFT_HEAD));
      // Saying the count made, where a perk makes more than the recipe's own (a Tailor's Even Thread).
      g.logMsg(madeSaid(r.result, goes, mat, item.ql, r.done), 'event');
      return more(t, g);
    },
  };
}

export const RECIPE_ACTIONS: ActionDef[] = RECIPES.map(recipeAction);
export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/**
 * Everything somebody made that is worth eating, worked out once.
 *
 * Reported: a knack off a raw berry. `boonOf` gated on "anything with
 * something in it", which is a handful of blueberries as much as a stew — so a
 * trade could be favoured for twenty minutes by eating fruit straight off a
 * bush, and the line over the list in `boons.ts` has said "everything cooked"
 * since the day it was written while the code under it said nothing of the
 * kind.
 *
 * It lives here rather than in `boons.ts` because the rule is "is there a
 * recipe for it", and `boons.ts` may not ask: `actions.ts` imports it, and
 * this file reaches back through traps to `actions.ts`. Everything that grants
 * a knack is already on this side of that ring.
 *
 * A dish off a fire, a cheese, an oil pressed under a quern, a barrel that has
 * finished working: things that took a fire, a tool or a month. Meat off a
 * kill, a fish off a line, a berry off a bush and milk out of a beast are food
 * and are not a knack.
 */
let cooked: Set<string> | null = null;
export function knackable(id: string): boolean {
  if (!cooked) {
    cooked = new Set(RECIPES.map((r) => r.result));
    // A barrel that has finished working is drawn off into `<brew>_bucket`.
    for (const brew of BREWS) cooked.add(`${brew.id}_bucket`);
  }
  return cooked.has(id);
}
