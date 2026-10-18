import { TileType, TILE_DEFS, TREE_DEFS, treeAge, treeSpecies, packTreeData, TREE_AGES } from '../world/tiles';
import { isSeam } from '../world/tiles';
import { mapFromBeast } from './treasure';
import { BOTANIZE_TABLE, FORAGE_TABLE, rollTable } from './forage';
import { fruitsAt, inSeason } from './fruiting';
import type { DeedStore, Game } from './game';
import { DAY_SECONDS } from './game';
import { CROP_BY_SEED, cropDef, cropReady, cropYield } from './farming';
import { GLAZE_ASH, GLAZEABLE, MINE_COLLAPSE, MINE_DEPTH } from './actions';
import { groomGain, GROOM_HEAL } from './husbandry';
import { healAmount } from './firstaid';
import { BUTCHER_PARTS, butcherYield, corpseSpecies, HOARD_LUMPS, HOARD_METALS, HOARD_MORE } from './butcher';
import { RECIPE_BY_ID, RECIPES, type Recipe } from './recipes';
import { isOreItem, METAL_BY_ORE, smeltSeconds } from './metal';
import { smelterCapacity, smelterCentre, type PlacedSmelter } from './smelter';
import { fireSeconds, firedQl, kilnCapacity, kilnCentre, POTTERY_BY_UNFIRED, isGreenware, type PlacedKiln } from './kiln';
import { BREWS, isWorking, type BrewDef } from './brewing';
import { fragmentOf, RELICS, RESTORE_AGE, type RelicDef } from './archaeology';
import { furnitureDef, holdsLiquid, isPlanter, isWell, litresIn } from './furniture';

import { milkLitres } from './dairy';
import { SHEAR_FEATHERS, SHEAR_WOOL } from './creatureActions';
import { candleBurn } from './light';
import { isLampPiece } from './lamps';
import { GRAPE, grapesFor, isTrellis, vineStage } from './vineyard';
import { BUSH_DEFS, bushSpecies, FLOWERS_PICKED, mownDays, MOWN_TODAY } from '../world/tiles';
import { besideWater, CUT_GRASS, PAN_ORES, RESIN_TREE, RICH_WORMS, tappable, WORMY } from './actions';
import { flowersHere } from './wildflowers';
import { SKEP, SKEP_REACH } from './bees';
import { greenNow, greenOnTile, scrubTile } from './greening';
import { GRASS_PER_CUT, MOSS_PER_CUT } from './limits';
import { PIER_SHOO } from './piers';
import { bedrockAt, oreAt } from '../world/ore';
import { DIGGABLE, findChance, relicsWithin } from './archaeology';
import { fishable, fishHere, waterDepth } from './fishing';
import { describeWith, itemDef, markOf, rarityOf, rarityStep, rollRarity, type Item, type Mark } from './items';
import { FROST_PACE, FROST_SECS, PAPER_PRESS, swingEnchant, type Enchant, type EnchantEffect } from './enchant';
import { CLASS_SPELL_BY_ID } from './talents';
import type { BeastAct } from './events';
import { fill, listed, numberWord, percent, times } from './words';
import { groundStep, standsOn } from './player';
import { skillGain } from './skills';
import { keyX, keyY, tileKey } from './tileindex';
import { ASH_QL, fireCentre, FIRE_CAPACITY, FUEL_VALUES, isFuel } from './campfire';
import { BUCKET_LITRES, furnitureCentre, type PlacedFurniture } from './furniture';
import type { WoundKind } from './wounds';
import { auraMul, breedTraits, channelOf, CHANNELS, pct, rollTraits, traitList, traitMul, traitTier, TRAIT_SLOTS, type TraitChannel, type TraitSource } from './traits';
import { ACTION_FLOOR, ACTION_PACE, WORKER_WEIGHT } from './pace';
import { world } from './pace';
import { emptyCrate, shutIn, standingCrate } from './creaturecrate';
import { BACK_PACE, BACK_SLACK, BLINDSIDE, blowEvery, BODKIN_HIDE, KNIFE_BLEED, STUN_SECS, THREAT_HOLD, VENOM_DRAIN, VENOM_SECS, circlePoint, CIRCLE_ARC, CIRCLE_R, COMPANION_BLOW, COMPANION_LEASH, COMPANION_PACE, COMPANION_REACH, COMPANION_SIGHT, COWARD_DRAG, FIGHT_GIVE_UP, FIGHT_LEASH, FLEE_PACE, FLEE_SECS, GUARD_RANGE, HEAVY_EVERY, HEAVY_HIT, HUNT_REACH, KEEP_OFF, KNIFE_BLEED_SECS, PACK_CALL, PACK_MOST, PACK_RANGE, slotAngle, THROW_HIT, THROW_REACH, turnsAt, turnTo, WIND_UP, type Hide } from './fight';

/**
 * Wildermon: creatures that roam the wild, can be tamed with the taming
 * skill, and then either travel with the player or work on the deed.
 */

export type CreatureMode = 'wild' | 'active' | 'deed' | 'stored';
/** Every wildermon is one or the other, and it takes one of each to breed. */
export type Sex = 'male' | 'female';
export const SEX_NAMES: Record<Sex, string> = { male: 'male', female: 'female' };
export const SEX_MARK: Record<Sex, string> = { male: '\u2642', female: '\u2640' };

/** One of a young one's parents: its id, and its name as it was then, the sire's at the covering and the dam's at the birth. */
export interface Parent {
  id: number;
  name: string;
}

/**
 * A young one's pedigree: its dam, its sire, and where each trait it was born
 * with came from. Only something bred has one; anything caught out of the
 * wild, or born before pedigrees were kept, has none.
 *
 * Names as well as ids, because an island hands a dead creature's id to the
 * next thing born there.
 */
export interface Pedigree {
  dam: Parent;
  sire: Parent;
  /** Where each trait came from, by trait id. */
  from: Record<string, TraitSource>;
}

/** What is coming, settled at the covering so no sire need survive to the birth. */
export interface Unborn {
  traits: string[];
  sex: Sex;
  /** The sire and where each trait came from; a covering made before pedigrees were kept has neither. */
  sire?: Parent;
  from?: Record<string, TraitSource>;
  /** A second young, bred at the same covering (a Herdsman's Twins): its own traits and sex, the same sire. */
  twin?: { traits: string[]; sex: Sex; from?: Record<string, TraitSource> };
}

/** What a card and a tooltip say of a pedigree: "Dam Snow · sire Horn". */
export const pedigreeLine = (p: Pedigree): string => `Dam ${p.dam.name} · sire ${p.sire.name}`;

export type Stance = 'passive' | 'defensive' | 'aggressive' | 'guard';
/** What a creature gathers from the land, as a wild grazer and as a deed job. */
export type GatherKind =
  | 'forage'
  | 'botanize'
  | 'woodcut'
  | 'farm'
  | 'mine'
  | 'sand'
  | 'clay'
  | 'quarry'
  | 'stoke'
  | 'fetch'
  | 'guard'
  | 'hunt'
  | 'peat'
  | 'reed'
  | 'water'
  | 'prospect'
  | 'plant'
  | 'hod'
  | 'mend'
  | 'compost'
  | 'seek'
  | 'fish'
  // A snedda prunes what would otherwise die; a grubba digs out stumps.
  | 'prune'
  | 'stump'
  // A plucka picks what a bearing tree has on it and carries it home.
  | 'fruit'
  // A vesp tends the hives on the deed, which fill with honey and beeswax while it does (`HIVE_SWARMS`).
  | 'hive'
  // The settlement's own hands (`TEND_JOBS`): a kemma brushes the herd, a sheela milks and shears it, a salva
  // dresses its hurts, a carra butchers the carcasses in the stores, a tanna tans the hides, a grista mills
  // the grain and a wicka keeps the lanterns.
  | 'groom'
  | 'dairy'
  | 'heal'
  | 'butcher'
  | 'tan'
  | 'mill'
  | 'lamp'
  // And three that walk out for a load: a brambo picks the bushes and the vines, a grazza cuts grass and
  // moss, and a siffa pans the sand at the water's edge.
  | 'bush'
  | 'grass'
  | 'pan'
  // Twelve more: a forga charges the smelters, a potta the kilns, a cindra rakes the ashes and leaches lye, a hoppa
  // sets the brews going, a simma cooks, a relka restores, and a bedda keeps the planters (`TEND_JOBS`) ...
  | 'smelt'
  | 'kiln'
  | 'ash'
  | 'brew'
  | 'cook'
  | 'restore'
  | 'patch'
  // ... and a wurla digs worms, a sprigga picks sprouts, an ambra taps the pines, a petta picks wildflowers and a
  // scurra scrubs the moss and clears the ivy.
  | 'worm'
  | 'sprout'
  | 'resin'
  | 'flower'
  | 'scrub'
  // Eight more, all at the stores or at your own (`TEND_JOBS`): a rippa saws planks, a chissa chisels stone brick,
  // a mudda shapes clay brick, a cordra lays up rope and a flecha fletches arrows, each at the stores; a papra
  // presses papyrus at a paper press, a glossa glazes the pottery and a dippa fills the empty buckets with water.
  | 'saw'
  | 'chisel'
  | 'brick'
  | 'rope'
  | 'fletch'
  | 'paper'
  | 'glaze'
  | 'fill';
/**
 * How far a wild thing will drift from where it stands, and how long it stands.
 *
 * It used to pick a spot up to four tiles off, walk it, stand for one to six
 * seconds, and go again — fifty-odd tiles of wandering a minute, for ever.
 * That was written for a game where clicking a creature reached it instantly.
 * On an island you ask, and then your feet have to carry you there, and a
 * thing that has moved five tiles by the time you arrive cannot be tamed at
 * all. Reported exactly so: "its almost impossible to tame them as theyre
 * always too far away".
 *
 * A step and a half, and half a minute of standing about, is about a tenth of
 * the ground and still plainly alive — a beast grazing rather than a beast on
 * its way somewhere. It also happens to be most of the cure for the jumping:
 * a poll two seconds apart nearly always finds a thing that has not moved.
 */
export const WILD_REACH = 1.5;
/*
 * Eight to thirty seconds between turns, which is nineteen on average.
 *
 * These were doubled the night the island went slow, as the cheapest thing on
 * it that could give: a wild thing grazes and stands about, and standing about
 * for twice as long costs the clock half as much. It bought the round back.
 *
 * It was the wrong lever, though, and it is put back here. What was actually
 * broken was that a round had no end: `creature_sweep` took a hundred and
 * twenty at a time and the clock called it once per player per island, so a
 * backlog multiplied instead of draining, and `order by id` meant the same
 * near creatures were looked at every round while the overdue ones waited.
 * Both are fixed -- a round now spends `settle_budget()` on wildlife and no
 * more, and takes the longest-waiting first -- and with them fixed a live
 * round measures 72 ms against a budget of 250.
 *
 * So the rest goes back to the figure the game was designed around, and the
 * budget rather than the rest interval is what keeps a round short. If the
 * demand ever does outrun the budget the queue simply lags: every wild thing
 * moves a little less often, which is what doubling this did by hand, only
 * without a hand.
 */
export const WILD_REST = 8;
export const WILD_REST_SPREAD = 22;

/**
 * How far from its home ground a wild thing will get.
 *
 * Nothing kept a wild animal anywhere. A wander target was drawn a tile and a
 * half from wherever it was standing, from wherever it had got to last time,
 * for ever — a random walk with nothing pulling on it. So an island's
 * wildlife had no geography at all: a thing that spawned in the tundra was as
 * likely to be found on the south beach an hour later, and the places you
 * learned to go for a particular animal were places only until you next
 * looked.
 *
 * Everything wild has a home now, and a step that would take it past this far
 * from home is drawn towards home instead. Twenty-eight tiles is a few
 * screens: big enough that an animal is not pacing a cage, small enough that
 * a valley keeps what lives in it.
 */
export const WILD_RANGE = 28;

/**
 * And how near another of its own kind a grazer has to be to throw in with
 * it.
 *
 * Herds are made at the moment a thing arrives rather than kept as a list: a
 * grazer spawning within this of another of its species takes *that one's*
 * home for its own, so the two of them wander the same patch of country and
 * are found together ever after. Chains of that are what makes a herd, and it
 * costs one look round at birth and nothing at all thereafter.
 *
 * Hunters do not do this. Two hunters sharing a range is a pair of animals
 * competing for the same dinner, and what makes a hunter frightening is
 * meeting it where it lives rather than meeting six of them.
 */
export const HERD_REACH = 14;
/**
 * How many looks at standable ground a rolled species gets before the roll is
 * given up on.
 *
 * What stands up is rolled against `WILD_SPECIES` and the ground says where.
 * Throwing a roll away because *this* tile is wrong for it makes a species as
 * common as its weight times the share of the island that suits it: a mola
 * wants metal under it, metal is a seventh of the ground, and one mola in a
 * hundred and forty is a mola nobody meets. Reported exactly so — "I have yet
 * to see a single mola spawn". So a place is looked for instead, and eight
 * looks put every species back within a fraction of its weight.
 *
 * Looks at ground a creature could stand on, not throws: on an island that is
 * mostly sea, eight throws into the water are no goes at all.
 */
export const SITE_LOOKS = 8;

/** Handed back for a tile nothing is standing on, so the common answer is free. */
const NOBODY: readonly Creature[] = [];
/**
 * How many tiles the creature index may keep arrays for before the lot go.
 * A tick fills as many tiles as there are creatures; this is slack enough
 * that a settled island never pays for the clear.
 */
const TILE_SLACK = 4096;

/** Care under which a wildermon is said to be wanting a brush, and the Wildermon window counts it as wanting attention; a kemma brushes what is under it. */
export const CARE_WANTING = 0.4;
/** How far grown back a fleece, a crop of feathers or a cudda's milk is before a sheela takes it: the more there is, the more and the better comes off. */
export const DAIRY_FULL = 0.9;
/** The share of its health under which a salva dresses one of yours; a bleeding one it dresses whatever its health. */
export const HEAL_BELOW = 0.75;
/** What a salva puts a dressing on: cloth, or a herb cover. */
export const DRESSINGS = ['bandage', 'cover'];
/** A siffa's chance of something in the pan, at no skill and at a hundred: a Miner's who has learned to pan (`pan` perk) to twice it. */
export const PAN_FIND = [1 / 8, 1 / 4] as const;
/** The top of a worker's skill, where its numbers stop rising. */
export const SKILL_TOP = 100;
export const panFind = (skill: number): number => PAN_FIND[0] + (PAN_FIND[1] - PAN_FIND[0]) * Math.max(0, Math.min(SKILL_TOP, skill)) / SKILL_TOP;
/** The recipes a tanna and a grista work at the stores, each with its tool somewhere in them. */
export const TAN_RECIPES = ['tan_hide'];
export const MILL_RECIPES = ['make_flour', 'make_cornmeal', 'press_olives'];
/**
 * Every trade worked at the stores off a recipe, with the recipes each tries in order: a tanna's and a grista's,
 * and a rippa's, a chissa's, a mudda's, a cordra's and a flecha's. The island's `tend_recipes`.
 */
export const STORE_RECIPES: Partial<Record<GatherKind, readonly string[]>> = {
  tan: TAN_RECIPES,
  mill: MILL_RECIPES,
  saw: ['make_planks'],
  chisel: ['make_stone_brick'],
  brick: ['make_clay_brick'],
  rope: ['make_rope'],
  fletch: ['make_arrows'],
};
/** What a papra presses at a paper press of yours. */
export const PAPER_RECIPES = ['make_papyrus'];
/** How many a recipe makes, and how many of one of its inputs it takes: the numbers a trade's words give. */
const recipeMakes = (id: string): number => RECIPE_BY_ID.get(id)?.count ?? 1;
const recipeTakes = (id: string, item: string): number => RECIPE_BY_ID.get(id)?.inputs.find((i) => i.item === item)?.count ?? 1;
/**
 * What a simma cooks, in the order it tries them: every recipe worked at a lit campfire or oven that no perk
 * gates, as the recipes are listed. The island's `tend_recipes('cook')` names the same.
 */
export const cookRecipes = (): string[] => RECIPES.filter((r) => r.station === 'campfire' && !r.perk).map((r) => r.id);
/** The trades that work at the stores or at one of your own rather than walking out to a tile, and bring nothing home in their arms. */
export const TEND_JOBS = new Set<GatherKind>(['groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp', 'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'glaze', 'fill']);
/** The recipe a cindra leaches its ashes into. */
export const LYE_RECIPES = ['make_lye'];
/** What restoring brings out of what the pieces were worth, at a restoration: a person's hands' (`restoredQl`), with no perk. The island's `errand_do`. */
export const restoredMul = (skill: number): number => 0.72 + skill / 260;
/** Tar a tap of a pine gives an ambra: one, where a Forester's Tap Resin gives its rank's worth. */
export const RESIN_TAPPED = 1;


export const GATHER_SKILL: Record<GatherKind, string> = { forage: 'foraging', botanize: 'botanizing', woodcut: 'woodcutting', farm: 'farming', mine: 'mining', sand: 'digging', clay: 'digging', quarry: 'mining', stoke: 'smelting', fetch: 'foraging', guard: 'body_strength', hunt: 'fighting', peat: 'digging', reed: 'foraging', water: 'carrying', prospect: 'prospecting', plant: 'forestry', hod: 'masonry', mend: 'repair', compost: 'farming', seek: 'archaeology', fish: 'fishing', prune: 'forestry', stump: 'digging', fruit: 'forestry' , hive: 'animal_husbandry', groom: 'animal_husbandry', dairy: 'animal_husbandry', heal: 'first_aid', butcher: 'butchering', tan: 'leatherworking', mill: 'milling', lamp: 'carrying', bush: 'forestry', grass: 'foraging', pan: 'prospecting', smelt: 'smelting', kiln: 'pottery', ash: 'alchemy', brew: 'brewing', cook: 'cooking', restore: 'restoration', patch: 'farming', worm: 'digging', sprout: 'forestry', resin: 'forestry', flower: 'foraging', scrub: 'masonry', saw: 'carpentry', chisel: 'stonecutting', brick: 'pottery', rope: 'ropemaking', fletch: 'fletching', paper: 'papyrusmaking', glaze: 'pottery', fill: 'carrying' };
export const GATHER_VERB: Record<GatherKind, string> = { forage: 'foraging', botanize: 'botanizing', woodcut: 'felling trees', farm: 'working the fields', mine: 'working the seams', sand: 'digging sand', clay: 'digging clay', quarry: 'cutting stone', stoke: 'keeping the fires in', fetch: 'clearing up', guard: 'keeping watch', hunt: 'hunting', peat: 'cutting peat', reed: 'cutting reeds', water: 'carrying water', prospect: 'reading the ground', plant: 'planting', hod: 'carrying the hod', mend: 'mending', compost: 'clearing up', seek: 'nosing about', fish: 'fishing', prune: 'pruning the wood', stump: 'digging out stumps', fruit: 'picking fruit' , hive: 'tending the hives', groom: 'brushing the herd', dairy: 'milking and shearing', heal: 'dressing hurts', butcher: 'butchering', tan: 'tanning hides', mill: 'milling', lamp: 'keeping the lanterns', bush: 'picking bushes and vines', grass: 'cutting grass and moss', pan: 'panning', smelt: 'charging the smelters', kiln: 'loading the kilns', ash: 'raking out ashes', brew: 'brewing', cook: 'cooking', restore: 'restoring', patch: 'keeping the planters', worm: 'digging for worms', sprout: 'picking sprouts', resin: 'tapping the pines', flower: 'picking wildflowers', scrub: 'scrubbing the stone', saw: 'sawing planks', chisel: 'chiselling stone brick', brick: 'shaping clay brick', rope: 'laying up rope', fletch: 'fletching arrows', paper: 'pressing papyrus', glaze: 'glazing pottery', fill: 'filling buckets' };
/** The plain form, for "it will forage" rather than "it will foraging". */
export const GATHER_DO: Record<GatherKind, string> = { forage: 'forage', botanize: 'botanize', woodcut: 'fell trees', farm: 'sow, tend and harvest the fields', mine: 'mine the ore', sand: 'dig sand and carry it home', clay: 'dig clay and carry it home', quarry: 'cut stone and carry it home', stoke: 'keep the fires and furnaces fed', fetch: 'pick up what is lying about', guard: 'keep watch over the deed', hunt: 'hunt the country round the deed and bring the carcasses home', peat: 'cut peat and tar and carry them home', reed: 'cut reeds and carry them home', water: 'carry water from the shore or the well to your barrels', prospect: 'read the ground for metal and mark what it finds', plant: 'plant sprouts where the trees have been cut', hod: 'carry brick and timber to your planned walls and fit it', mend: 'mend the damaged gear in your stores', compost: 'clear away what is rotting and turn it into compost', seek: 'smell out buried relics and mark where to dig', fish: 'fish the water round the deed and carry the catch home', prune: 'prune what would otherwise die', stump: 'dig out stumps', fruit: 'pick what the fruit trees have on them and carry it home' , hive: 'tend the hives', groom: `brush down your wildermon whose care is under ${percent(CARE_WANTING)}`, dairy: `milk your cudda into the empty buckets in your stores and shear or pluck your others, each once it is ${percent(DAIRY_FULL)} grown back, and put what comes off in your stores`, heal: `dress your wildermon that are bleeding or under ${percent(HEAL_BELOW)} of their health with a bandage or a cover out of your stores`, butcher: 'butcher the carcasses in your stores and put what comes off them back in', tan: 'tan the hides in your stores in its lye, with a carving knife kept in them', mill: 'grind the wheat and corn and press the olives in your stores, on a quern kept in them', lamp: 'put a candle out of your stores in every lantern post and pillar of yours that has none, light them after dark and put them out by day', bush: 'pick the bushes and the vines on your trellises and carry it home', grass: 'cut grass and moss and carry it home', pan: 'pan the sand at the water\'s edge and carry home what settles in the pan', smelt: 'charge your smelters with the ore in your stores and take out what they have made', kiln: 'load your kilns with the unfired pottery in your stores and take out what they have fired', ash: 'rake the ashes out of your campfires, ovens, smelters and kilns into your stores and leach them with buckets of water from your stores into lye', brew: 'set a brew going in every barrel of water of yours whose makings are in your stores', cook: 'cook what is in your stores at your lit campfires and ovens', restore: 'restore every relic whose pieces are all in your stores', patch: 'sow, tend and harvest your planters out of your stores', worm: 'dig for worms and carry them home', sprout: 'pick sprouts off the trees and carry them home', resin: 'tap the pines for tar, once a day each, and carry it home', flower: 'pick wildflowers, leaving the ones a skep feeds on, and carry them home', scrub: 'scrub the moss off your paving, foundations and statues and clear the ivy off your stone walls',
  // Read when asked for rather than when this module loads, so the recipes and the glaze are there to be read.
  get saw() { return `saw the logs in your stores into planks, ${numberWord(recipeMakes('make_planks'))} to a log, with a saw kept in them`; },
  get chisel() { return `chisel the rock shards in your stores into stone brick, ${numberWord(recipeMakes('make_stone_brick'))} bricks to a shard, with a chisel kept in them`; },
  get brick() { return `shape the clay in your stores into unfired clay brick, ${numberWord(recipeMakes('make_clay_brick'))} to a lump`; },
  get rope() { return `lay up the wemp in your stores into rope, ${numberWord(recipeTakes('make_rope', 'wemp'))} wemp fibres to a rope, on a rope tool kept in them`; },
  get fletch() { return `fletch the shafts, arrowheads and feathers in your stores into arrows, ${numberWord(recipeMakes('make_arrows'))} to a shaft, ${numberWord(recipeTakes('make_arrows', 'arrow_head'))} heads and ${numberWord(recipeTakes('make_arrows', 'feather'))} feathers, with a carving knife kept in them`; },
  get paper() { return `press the reeds in your stores into papyrus at your paper presses, ${numberWord(recipeMakes('make_papyrus'))} sheets to ${numberWord(recipeTakes('make_papyrus', 'reed'))} reeds and a bucket of water, and put the empty bucket back in your stores`; },
  get glaze() { return `glaze every fired pot, bowl, jar and amphora in your stores with ${GLAZE_ASH === 1 ? 'an ash' : `${numberWord(GLAZE_ASH)} ashes`} out of them each, after which it never decays`; },
  fill: 'fill the empty buckets in your stores with water at the shore or a well and put them back in your stores',
};
const GATHER_TABLE: Record<GatherKind, Array<[string, number]>> = { forage: FORAGE_TABLE, botanize: BOTANIZE_TABLE, woodcut: [], farm: [], mine: [], sand: [], clay: [], quarry: [], stoke: [], fetch: [], guard: [], hunt: [], peat: [], reed: [], water: [], prospect: [], plant: [], hod: [], mend: [], compost: [], seek: [], fish: [], prune: [], stump: [], fruit: [] , hive: [], groom: [], dairy: [], heal: [], butcher: [], tan: [], mill: [], lamp: [], bush: [], grass: [], pan: [], smelt: [], kiln: [], ash: [], brew: [], cook: [], restore: [], patch: [], worm: [], sprout: [], resin: [], flower: [], scrub: [], saw: [], chisel: [], brick: [], rope: [], fletch: [], paper: [], glaze: [], fill: [] };
export type ButcherPart = 'meat' | 'fur' | 'leather' | 'bone' | 'gland' | 'feather' | 'tusk' | 'sinew' | 'scale' | 'hoard';
/** Marks a creature as last hurt by the player rather than another creature. */
export const PLAYER_ATTACKER = -1;

/**
 * A wild creature that is a danger to you: one of a kind that hunts on sight
 * (`SpeciesDef.hunter`), or anything hunting you now. Marked in red over
 * whatever stands in front of it (`Renderer.drawThreats`).
 */
export const threatens = (c: Creature, def: SpeciesDef): boolean =>
  c.mode === 'wild' && c.health > 0 && (c.enemy === PLAYER_ATTACKER || !!def.hunter);
/** What a settlement's workers can be set to; a companion can also guard you (`COMPANION_STANCES`). */
export const STANCES: Stance[] = ['passive', 'defensive', 'aggressive'];
export const COMPANION_STANCES: Stance[] = ['passive', 'defensive', 'guard', 'aggressive'];
export const STANCE_NAMES: Record<Stance, string> = { passive: 'Passive', defensive: 'Defensive', aggressive: 'Aggressive', guard: 'Guarding you' };
/** A companion's numbers, which are the fight's (`fight.ts`), said again here where its keepers have always looked for them. */
export { COMPANION_SIGHT, COMPANION_LEASH, COMPANION_REACH, COMPANION_BLOW, COMPANION_PACE };
/** How long a blow at a companion or at you is remembered; also how long a defensive worker on a deed remembers one. */
export const BLOW_MEMORY = 8;
/**
 * How many swings you turn on something with when it bites you: enough to
 * see a fight out, and the first refusal — dead, gone, out of reach — ends
 * the run, as it ends any run of goes. The next bite starts it again.
 */
export const FIGHT_BACK_GOES = 100;
export const STANCE_HINTS: Record<Stance, string> = {
  passive: 'Never attacks.',
  defensive: 'Fights back when it or you are attacked.',
  aggressive: `Hunts other wildermon within ${COMPANION_SIGHT} tiles of you.`,
  guard: `Goes for anything hunting you within ${COMPANION_SIGHT} tiles of you before it lands a blow, as well as what strikes it or you; gives up a fight ${GUARD_RANGE} tiles from you rather than ${COMPANION_LEASH}.`,
};

export interface SpeciesDef {
  id: string;
  name: string;
  description: string;
  health: number;
  attack: number;
  /** Tiles per second. */
  speed: number;
  /** Taming skill needed to try. */
  tameLevel: number;
  /** Base chance per attempt at the minimum skill. */
  tameChance: number;
  /** Items it eats and that work as taming bait. */
  diet: string[];
  /** Short description of its bait for menus: "a berry or vegetable". */
  baitHint: string;
  /** Runs rather than fights when hurt. */
  timid: boolean;
  /** How it feeds itself in the wild and what it does as a job on the deed. */
  gathers: GatherKind | null;
  /**
   * The trades it may be set to instead, `gathers` among them, for a species
   * with more than one. A bevere fells, prunes or digs out stumps; you say
   * which when you set it to work, and `Creature.trade` remembers.
   */
  trades?: GatherKind[];
  /** How far from the token a deed worker roams before it earns any skill. */
  workRange: number;
  /** Body and belly colours per variant. */
  variants: Array<[string, string]>;
  /** What a full butchering of its corpse can yield. */
  butcher: Partial<Record<ButcherPart, number>>;
  /** How it shrugs off a failed taming attempt. */
  tameFail: string;
  /** How it leaves when released. */
  leaves: string;
  /** Only settles within a few tiles of open water. */
  nearWater?: boolean;
  /** Only settles among trees. */
  nearTrees?: boolean;
  /** Only settles on a seam of ore. */
  onOre?: boolean;
  /** Only settles on sand. */
  onSand?: boolean;
  /** Only settles within a few tiles of a clay pit. */
  nearClay?: boolean;
  /** Only settles on the black ground: tar, peat and the marshes they lie in. */
  nearTar?: boolean;
  /** Only settles on bare rock with no metal in it. */
  onStone?: boolean;
  /** Hunts the player on sight rather than waiting to be struck. */
  hunter?: boolean;
  /** Grows a fleece that can be shorn, and how fast. */
  fleece?: number;
  /** Fights back rather than bolting, every time it is struck. */
  defensive?: boolean;
  /** Chance a tamed one turns on the player when it has the chance. */
  unruly?: number;
  /** Tiles of working range earned per ten levels of skill; ten by default. */
  rangePerStep?: number;
  /** Stance a newly tamed one takes; defensive unless it is a gentle sort. */
  defaultStance?: Stance;
  /**
   * Bred to pull. A draught beast trains climbing in the traces, and what it
   * knows decides how fast a vehicle goes and how steep a line it can take.
   */
  draught?: boolean;
  /** Can be ridden once it is saddled and bridled; the seat height in pixels. */
  mount?: number;
  /** How far it sees for you, in tiles; seven unless it is a watcher. */
  sight?: number;
  /** Lights the ground around it whatever the hour, like a carried fire. */
  glow?: number;
  /** What its climbing is worth as slope under a rider: one unless it is a goat. */
  pitch?: number;
  /** Crosses deep water with a rider on its back. */
  swims?: boolean;
  /** Its share of a team's pull; `PULL_DEFAULT` unless it was bred for the traces. */
  pull?: number;
  /** Things it carries on its own back, for the ones that take panniers. */
  pannier?: number;
  /** What shearing takes off it; wool unless it says otherwise. */
  shearYield?: string;
  /** Can be milked into an empty bucket. */
  milk?: boolean;
  /** Keeps a hive of its own going, so long as one stands on the deed. */
  hives?: boolean;
  /** Only ever found out of doors after dark. */
  nocturnal?: boolean;
  /**
   * The kind of wound it leaves. A hoof bruises, a claw opens, a sting goes
   * deep and narrow, and something that carries its own fire burns. Most
   * things bite.
   */
  wound?: WoundKind;
  /**
   * Not a wildermon at all. A monster cannot be tamed, trapped, bred, brushed
   * or kept; it comes at you on sight from a long way off, it hits far harder
   * than anything else that walks, and it is worth killing for what is on it.
   */
  monster?: boolean;
  /** How far off it notices you, in tiles; a monster sees a long way. */
  notice?: number;
  /** What it wears against a blow (`HIDE_TAKES`); a soft one takes every blow as it comes. */
  hide?: Hide;
  /** Big enough to draw back for a heavy blow every `HEAVY_EVERY` (`fight.ts`). */
  heavy?: boolean;
  /** Runs in a pack: shares a home with its kind, comes when one of them has your scent, and spreads round you (`PACK_CALL`). */
  pack?: boolean;
  /** Keeps its distance and throws (`KEEP_OFF`, `THROW_REACH`). */
  throws?: boolean;
  /** Turns tail at `COWARD_AT` of its health, and sooner when one of its kind has run (`COWARD_DRAG`). */
  coward?: boolean;
  /** Its bite leaves venom in the wound (`VENOM_DRAIN`, `VENOM_SECS`). */
  venom?: boolean;
  /** How one of yours fights another creature, besides its blow (`FightStyle`). */
  style?: FightStyle;
  /** What one of yours does in a fight once every so often instead of a blow (`AbilityId`). */
  ability?: AbilityId;
  /** For a kind with no trade and no traces, the skill it learns and what teaches it (`LearnsBy`). */
  learns?: { skill: string; by: LearnsBy };
  /** What it evolves into at each of `EVOLVE_AT`, for a kind that evolves: a name and words of each stage's own. */
  stages?: [StageDef, StageDef];
}

/** A stage a wildermon evolves into: what it is called, and its words. */
export interface StageDef {
  name: string;
  description: string;
}
/**
 * The levels a kind that evolves does so at: its second stage, and its third. Asked for: "Evolutions happen at level 25
 * and 50", and "Each evolution add movement speed and task speed and base stats".
 */
export const EVOLVE_AT = [25, 50] as const;
/**
 * What each stage multiplies over the one before, on the channels its blood is counted on (`bloodMul`): its health
 * (hardy), its blow (tough), its pace (speed) and how fast it gets a task done (work). The island's `evo_mul`.
 */
export const STAGE_MUL: Partial<Record<TraitChannel, number>> = { hardy: 1.2, tough: 1.2, speed: 1.2, work: 1.15 };
/** Which stage it is at: nought below the first of `EVOLVE_AT`, and so on; nought always for a kind that does not evolve. The island's `stage_of`. */
export function stageOf(c: Pick<Creature, 'species' | 'skills'>): 0 | 1 | 2 {
  if (!SPECIES[c.species]?.stages) return 0;
  const level = creatureLevel(c);
  return level >= EVOLVE_AT[1] ? 2 : level >= EVOLVE_AT[0] ? 1 : 0;
}
/** What its stage makes of one channel of its blood. */
export const evoMul = (c: Pick<Creature, 'species' | 'skills'>, channel: TraitChannel): number => (STAGE_MUL[channel] ?? 1) ** stageOf(c);
/** What it is called at the stage it is at. */
export function kindName(c: Pick<Creature, 'species' | 'skills'>): string {
  const def = SPECIES[c.species];
  const stage = stageOf(c);
  return stage && def?.stages ? def.stages[stage - 1].name : def?.name ?? c.species;
}
/** Its words at the stage it is at. */
export function kindDescription(c: Pick<Creature, 'species' | 'skills'>): string {
  const def = SPECIES[c.species];
  const stage = stageOf(c);
  return stage && def?.stages ? def.stages[stage - 1].description : def?.description ?? '';
}

/**
 * What teaches a wildermon with no trade and no traces its one skill, which is its level: being sheared, plucked or
 * milked (`tended`); a spar swing of yours landing on it (`spar`); being out -- at your heel or keeping a settlement --
 * for every `OUT_EVERY` of it (`out`), or for every `OUT_EVERY` of it after dark (`dark`). Asked for: "Give skill-less
 * wildermon a skill that levels as they complete tasks". The island's `beast_learns`.
 */
export type LearnsBy = 'tended' | 'spar' | 'out' | 'dark';
/** Seconds of being out that count as one go at its task, for a kind that learns by being out. */
export const OUT_EVERY = 30;
/** What each go teaches, as the base of a gain: a shearing or a milking, a spar swing, and a spell of being out. */
export const LEARNS_GAIN: Record<LearnsBy, number> = { tended: 0.3, spar: 0.05, out: 0.2, dark: 0.2 };
/** What a kind that learns its own skill does to learn it, for its card and the help. */
export const LEARNS_SAYS: Record<LearnsBy, string> = {
  tended: 'each time it is sheared, plucked or milked',
  spar: 'each time a spar swing of yours lands on it',
  out: `for every ${OUT_EVERY} seconds it is out at your heel or keeping a settlement`,
  dark: `for every ${OUT_EVERY} seconds it is out at your heel or keeping a settlement after dark`,
};

/**
 * How a wildermon of yours fights, wherever its blows land on another creature
 * -- at your heel, or keeping a settlement -- besides what its blow takes:
 *
 *   shield  every wild thing after you or one of yours within `GUARD_RANGE`
 *           of it turns on it, each time it lands a blow;
 *   flank   its blows land `BLINDSIDE` as hard on anything fighting you or
 *           another of yours rather than it, as yours do;
 *   bleed   it bleeds what it bites as a knife does (`KNIFE_BLEED` for
 *           `KNIFE_BLEED_SECS`);
 *   stun    every `HEAVY_EVERY`th blow it lands stuns for `STUN_SECS`;
 *   venom   its bite leaves venom, `VENOM_DRAIN` of the thing's health a
 *           second for `VENOM_SECS`, as a venomous bite does on you;
 *   bore    its blows land `BODKIN_HIDE` as hard on anything with a hide, as
 *           a bodkin does;
 *   spar    you may attack it, and your blows take it no lower than
 *           `SPAR_YIELD` of its health, where it yields.
 *
 * A wild one of these kinds fights as any other does. The island's
 * `style_dealt` and `style_blow`, and `perform_fight` for a spar.
 */
export type FightStyle = 'shield' | 'flank' | 'bleed' | 'stun' | 'venom' | 'bore' | 'spar';
/** The share of its health a sparring partner yields at: your blows take it no lower. */
export const SPAR_YIELD = 0.5;
/** What each way of fighting does, in the game's own terms, for a species' words and the help. */
export const STYLE_SAYS: Record<FightStyle, string> = {
  shield: `every blow it lands turns each wild thing within ${GUARD_RANGE} tiles of it that is after you or another of yours onto it instead`,
  flank: `its blows land ${percent(BLINDSIDE - 1)} harder on anything fighting you or another of yours rather than it`,
  bleed: `every bite it lands on another creature bleeds it ${percent(KNIFE_BLEED)} of the bite a second for ${KNIFE_BLEED_SECS} seconds, as a knife does`,
  stun: `the last of every ${numberWord(HEAVY_EVERY)} blows it lands on another creature stuns it for ${STUN_SECS} seconds, in which it neither moves nor strikes`,
  venom: `its bite leaves venom in other creatures, taking ${percent(VENOM_DRAIN)} of their health a second for ${VENOM_SECS} seconds, as it would take yours`,
  bore: `its blows land ${percent(BODKIN_HIDE - 1)} harder on anything with a thick hide, a shell or scales, as a bodkin does`,
  spar: `you may Spar with it while it is out with you: each swing teaches the fighting, the weapon skill and the body strength a swing at a wild thing teaches, and wears your weapon as much, but your blows take it no lower than ${percent(SPAR_YIELD)} of its health, where it yields until it is back above it, and it never strikes back`,
};
/**
 * What one of yours does in a fight once every so often, instead of a blow, wherever it fights -- at your heel or
 * keeping a settlement: a fighting trade's spell, used as the trade's own spell is and at its numbers and its rest
 * (`CLASS_SPELLS`), or a frost breath. A wild one of these kinds fights as any other does. The island's
 * `beast_ability`, which reads the same spells off `class_spell`.
 */
export type AbilityId = 'beastmaster_pounce' | 'blade_hamstring' | 'berserker_skull_crack' | 'blade_shield_bash'
  | 'berserker_execute' | 'berserker_whirlwind' | 'kindler_scorch' | 'frost_breath' | 'binder_root' | 'binder_dull_claws'
  | 'binder_brittle' | 'pikeman_keep_away' | 'blade_guardians_call' | 'skirmisher_marked_for_death' | 'warder_ward'
  | 'warder_stoneskin' | 'chirurgeon_leech';
/** What is on a creature for a while (`Creature.marks`). */
export type MarkKind = 'ability' | 'root' | 'dull' | 'brittle' | 'marked' | 'stone' | 'keep_away';
/** Seconds between a frost breath and the next. */
export const FROST_BREATH_REST = 15;
/** The skin a wardo lays over you, as a share of your full health: it takes that much of the blows that come at you. */
export const WARD_SKIN = 0.1;
/** Seconds between goes at an ability. */
export const abilityRest = (id: AbilityId): number => (id === 'frost_breath' ? FROST_BREATH_REST : CLASS_SPELL_BY_ID.get(id)?.rest ?? 0);
/** A number an ability is used at: its spell's own. */
export const abilityFx = (id: AbilityId, k: string): number => CLASS_SPELL_BY_ID.get(id)?.fx[k] ?? 0;
/** An ability's name: its spell's. */
export const abilityName = (id: AbilityId): string => (id === 'frost_breath' ? 'Frost Breath' : CLASS_SPELL_BY_ID.get(id)?.name ?? id);
/** What an ability does, in the game's own terms, for a species' words, the help and What's new. */
export function abilitySays(id: AbilityId): string {
  const f = (k: string): number => abilityFx(id, k);
  const said: Record<AbilityId, () => string> = {
    beastmaster_pounce: () => `when what it is going for is within ${f('reach')} tiles of it, it leaps to it and strikes at ${percent(f('more'))} of a blow, and puts its next blow back ${f('back')} seconds`,
    blade_hamstring: () => `a blow at ${percent(f('more'))} after which what it strikes goes at ${percent(f('pace'))} of its pace for ${f('secs')} seconds`,
    berserker_skull_crack: () => `a blow at ${percent(f('more'))} that holds what it strikes where it stands, neither moving nor striking, for ${f('hold')} seconds, a monster for ${f('hold') * f('monster')}`,
    blade_shield_bash: () => `a blow at ${percent(f('more'))} that knocks a heavy blow off its stroke and puts the next blow of what it strikes back ${f('back')} seconds`,
    berserker_execute: () => `a blow at ${percent(f('more'))} on anything below ${percent(f('low'))} of its health`,
    berserker_whirlwind: () => `${numberWord(f('blows'))} blows at ${percent(f('more'))} on every wild thing within ${f('reach')} tiles of it`,
    kindler_scorch: () => `a blow at ${percent(f('fire'))} that sets what it strikes burning, ${percent(f('each'))} of its health a second for ${f('secs')} seconds`,
    frost_breath: () => `a blow that leaves what it strikes going at ${percent(FROST_PACE)} of its pace for ${FROST_SECS} seconds, as a Frostbite does`,
    binder_root: () => `roots what it fights where it stands for ${f('secs')} seconds: it may strike but not move`,
    binder_dull_claws: () => `for ${f('secs')} seconds what it fights lands its blows ${percent(1 - f('dealt'))} smaller`,
    binder_brittle: () => `for ${f('secs')} seconds what it fights takes ${percent(f('taken') - 1)} more from everything that strikes it`,
    pikeman_keep_away: () => `for ${f('secs')} seconds every blow it lands pushes what it lands on ${f('push')} ${f('push') === 1 ? 'tile' : 'tiles'} further from it`,
    blade_guardians_call: () => `every wild thing within ${f('reach')} tiles of it that is after anybody turns on it, and stays on it for ${f('secs')} seconds`,
    skirmisher_marked_for_death: () => `for ${f('secs')} seconds every blow, throw and shot of yours that lands on what it fights is critical ${times(f('crit'))} as often`,
    warder_ward: () => `while it is at your heel, lays a skin over you that takes the next ${percent(WARD_SKIN)} of your health of the blows that come at you, when the skin over you is smaller`,
    warder_stoneskin: () => `for ${f('secs')} seconds it takes ${percent(f('cut'))} less from every blow`,
    chirurgeon_leech: () => `a blow at ${percent(f('more'))}, and it gets back the share of its own health that the blow took of the other's`,
  };
  return `${said[id]()}, once every ${abilityRest(id)} seconds`;
}
/** A mark on a creature while it holds, or `none` once it has run out. The island's `beast_mark`. */
export const markOn = (game: { time: number }, c: Creature | undefined, kind: MarkKind, none = 1): number => {
  const m = c?.marks?.[kind];
  return m && m.until > game.time ? m.val : none;
};
/** A mark put on a creature, to the later of its end and one already on it. The island's `class_mark_put`. */
export function putMark(game: { time: number }, c: Creature, kind: MarkKind, val: number, secs: number): void {
  const was = c.marks?.[kind];
  (c.marks ??= {})[kind] = { val, until: Math.max(was && was.until > game.time ? was.until : 0, game.time + secs) };
}
/** Within this of `SPAR_YIELD` of its health, a sparring partner has yielded and will not spar until it has its breath back. */
export const SPAR_SLACK = 0.5;
/** The health a sparring partner yields at. */
export const sparFloor = (c: Creature): number => maxHealth(c, SPECIES[c.species]) * SPAR_YIELD;
/** Whether it is a sparring partner of yours, out and about, and so may be attacked. */
export const sparring = (c: Creature | undefined): boolean => !!c && c.mode !== 'wild' && c.mode !== 'stored' && SPECIES[c.species]?.style === 'spar';
/** Whether a sparring partner has yielded. */
export const yielded = (c: Creature): boolean => c.health <= sparFloor(c) + SPAR_SLACK;
/** What a blow that lands on a sparring partner says. The island's `spar_said`. */
export const sparSaid = (c: Creature): string =>
  `You land one on ${c.name}. It is down to ${Math.max(0, Math.ceil(c.health))} of ${maxHealth(c, SPECIES[c.species])}${yielded(c) ? ', and yields' : ''}.`;

/** What a stage adds over a kind's first, in words: its health, its blow, its pace and its task, each as a share. */
export function stageSays(stage: number): string {
  const more = (ch: TraitChannel): string => percent((STAGE_MUL[ch] ?? 1) ** stage - 1);
  return `${more('hardy')} more health, a ${more('tough')} harder blow, ${more('speed')} faster on its feet and ${more('work')} quicker at each go of its task`;
}

/** A Snufflet's words at each stage: its trade, what it eats, and what each stage is and adds. */
function snuffSays(stage: 0 | 1 | 2): string {
  const names = ['Snufflet', 'Snuffroot', 'Snuffthorn'];
  const job = `Set to work on a settlement it forages within ${SPECIES.rabba.workRange} tiles of the token, ${RANGE_PER_STEP} further for every ${SKILL_STEP} levels, and brings what it finds to the crate.`;
  const level = 'Its level is its foraging.';
  if (stage === 0) return `${job} ${level} At level ${EVOLVE_AT[0]} it evolves into a ${names[1]}.`;
  const next = stage === 1 ? ` At level ${EVOLVE_AT[1]} it evolves into a ${names[2]}.` : '';
  return `A ${names[0]} at level ${EVOLVE_AT[stage - 1]} and over: ${stageSays(stage)} than a ${names[0]}. ${job}${next}`;
}

export const SPECIES: Record<string, SpeciesDef> = {
  rabba: {
    id: 'rabba',
    name: 'Snufflet',
    // Asked for: "This first will replace Rabba. Snufflet, Snuffroot, Snuffthorn". Its words, and each stage's, say what it
    // does and what each stage adds, in the game's own numbers, and are written once those are all here (`snuffSays`).
    description: '',
    stages: [
      { name: 'Snuffroot', description: '' },
      { name: 'Snuffthorn', description: '' },
    ],
    health: 20,
    attack: 3,
    speed: 2.2,
    tameLevel: 1,
    tameChance: 0.12,
    diet: ['blueberry', 'raspberry', 'strawberry', 'lingonberry', 'potato', 'onion'],
    baitHint: 'a berry or vegetable',
    timid: true,
    gathers: 'forage',
    workRange: 8,
    // Its coat and its patches: cream with pink, blush with rose, a dun with cinnamon, and white with the palest pink.
    variants: [
      ['#f6e9da', '#eda4ae'],
      ['#f2bcc0', '#d97f90'],
      ['#b88c68', '#8e5a48'],
      ['#fdfbf7', '#f2cdd2'],
    ],
    butcher: { meat: 3, fur: 2, leather: 2, bone: 3, gland: 1 },
    tameFail: 'nibbles the {food}, twitches its nose, and hops off unconvinced',
    leaves: 'bounds off into the wild',
  },
  vola: {
    id: 'vola',
    name: 'Vola',
    description: 'A velvet-furred digger with a pink snout and broad shovel paws. It noses through the undergrowth for herbs and roots and would rather burrow than bite.',
    health: 16,
    attack: 2,
    speed: 1.9,
    tameLevel: 1,
    tameChance: 0.12,
    diet: ['sage', 'basil', 'thyme', 'mint', 'rosemary', 'potato', 'onion'],
    baitHint: 'a spice or vegetable',
    timid: true,
    gathers: 'botanize',
    workRange: 8,
    variants: [
      ['#4a3b33', '#7d6a5c'],
      ['#6f6c68', '#a09a92'],
      ['#7d5a3c', '#b8926a'],
      ['#2b2624', '#5b524c'],
    ],
    butcher: { meat: 2, fur: 3, leather: 2, bone: 2, gland: 1 },
    tameFail: 'snuffles the {food} out of your palm, then shuffles away and buries itself in the leaf litter',
    leaves: 'shuffles off and burrows out of sight',
  },
  bevere: {
    id: 'bevere',
    name: 'Bevere',
    description: 'A broad, flat-tailed gnawer with orange teeth and oiled fur. It never strays far from water, and it fells trees for whoever keeps it.',
    health: 26,
    attack: 3,
    speed: 1.8,
    tameLevel: 1,
    tameChance: 0.1,
    diet: ['potato', 'carrot', 'cabbage', 'onion', 'corn', 'wheat', 'acorn', 'nuts'],
    baitHint: 'a vegetable or something starchy',
    timid: true,
    gathers: 'woodcut',
    workRange: 8,
    /** It will not settle more than this far from water. */
    variants: [
      ['#6b4a2e', '#a67c4e'],
      ['#4f3a2a', '#8a6a48'],
      ['#7d5636', '#c09163'],
      ['#3b2f26', '#6f5a44'],
    ],
    butcher: { meat: 3, fur: 3, leather: 3, bone: 2, gland: 1 },
    tameFail: 'takes the {food} in both paws, eats it without hurry, and slips back into the water',
    leaves: 'slaps its tail and slides into the water',
    nearWater: true,
    defaultStance: 'passive',
  },
  crawler: {
    id: 'crawler',
    hide: 'shell',
    wound: 'cut',
    venom: true,
    name: 'Crawler',
    description: 'A broad sand-coloured crab that goes at everything sideways. It shovels sand with its claws, and it has never once been sorry for pinching anybody.',
    health: 24,
    attack: 5,
    speed: 1.6,
    tameLevel: 1,
    tameChance: 0.1,
    diet: ['potato', 'carrot', 'cabbage', 'onion'],
    baitHint: 'a vegetable',
    timid: false,
    gathers: 'sand',
    workRange: 8,
    variants: [
      ['#c58a52', '#e8c79a'],
      ['#a8623c', '#dba173'],
      ['#8f8a6e', '#cfc7a6'],
      ['#b5483a', '#e0937f'],
    ],
    butcher: { meat: 3, leather: 1, bone: 4, gland: 1 },
    tameFail: 'takes the {food} in one claw, waves the other at you, and backs off sideways',
    leaves: 'scuttles off sideways and buries itself in the sand',
    onSand: true,
    defensive: true,
    defaultStance: 'defensive',
    unruly: 0.12,
  },
  noot: {
    id: 'noot',
    wound: 'pierce',
    name: 'Noot',
    description: 'A plump, upright waddler in a slate coat, with a broad bill it uses as a spade and a flat tail it uses as a stool. It spends its whole day up to the knees in a clay pit and appears to think this is the good life.',
    health: 26,
    attack: 3,
    speed: 1.5,
    tameLevel: 1,
    tameChance: 0.12,
    diet: ['carrot', 'onion', 'potato', 'mixed_grass'],
    baitHint: 'a root vegetable',
    timid: true,
    gathers: 'clay',
    workRange: 9,
    variants: [
      ['#4a5a6e', '#eceff3'],
      ['#3d4a5c', '#e2e7ee'],
      ['#5c5348', '#f0ece2'],
      ['#46605c', '#e6efec'],
    ],
    butcher: { meat: 3, leather: 2, bone: 2, gland: 1, feather: 4 },
    tameFail: 'takes the {food} in its bill, honks once through it, and waddles off',
    leaves: 'waddles back to the nearest clay pit and settles into it',
    nearClay: true,
  },
  embra: {
    id: 'embra',
    wound: 'burn',
    name: 'Embra',
    description: 'A soot-dark, slow-blinking creature that sleeps in the peat and tar of the marshes and wakes up wherever there is a fire. It carries wood the way other creatures carry food, and it will not eat anything raw.',
    health: 24,
    attack: 4,
    speed: 1.5,
    tameLevel: 1,
    tameChance: 0.1,
    diet: ['cooked_meat', 'baked_potato', 'roast_onion', 'roast_nuts', 'berry_compote', 'stew', 'pottage'],
    baitHint: 'something cooked',
    timid: true,
    gathers: 'stoke',
    workRange: 10,
    variants: [
      ['#3c3631', '#e08a3c'],
      ['#4a3d33', '#f0a850'],
      ['#33312e', '#d2702c'],
      ['#453a3a', '#e8c35a'],
    ],
    butcher: { meat: 2, fur: 2, leather: 2, bone: 2, gland: 2 },
    tameFail: 'sniffs at the {food}, finds it cold, and turns its back on you',
    leaves: 'settles into the warm ash and pays you no more attention',
    nearTar: true,
  },
  quarra: {
    id: 'quarra',
    hide: 'shell',
    wound: 'crush',
    name: 'Quarra',
    description: 'A low, broad creature with a jaw like a chisel and a hide the colour of the rock it sits on. It eats clay by the mouthful and spends the rest of the day taking the mountain apart a piece at a time.',
    health: 34,
    attack: 5,
    speed: 1.2,
    tameLevel: 1,
    tameChance: 0.09,
    diet: ['clay'],
    baitHint: 'a lump of clay',
    timid: false,
    gathers: 'quarry',
    workRange: 8,
    rangePerStep: 6,
    variants: [
      ['#8d8a84', '#c3bfb6'],
      ['#6f7684', '#a9b0bc'],
      ['#9a8f7e', '#cfc6b4'],
      ['#7c7269', '#b4aa9c'],
    ],
    butcher: { meat: 4, leather: 3, bone: 4, gland: 1 },
    tameFail: 'takes the {food} in one bite, considers you, and goes back to the rock',
    leaves: 'lumbers off and settles against the nearest stone face',
    onStone: true,
  },
  woola: {
    id: 'woola',
    name: 'Woola',
    description: 'A round, mild grazer under a deep fleece, which it grows back as fast as you can take it off. It has no opinion about anything and no job worth speaking of, and everyone keeps one anyway.',
    health: 26,
    attack: 2,
    speed: 1.3,
    tameLevel: 1,
    tameChance: 0.2,
    diet: ['mixed_grass', 'cabbage', 'carrot', 'wheat', 'corn'],
    baitHint: 'grass or greens',
    timid: true,
    gathers: null,
    workRange: 6,
    variants: [
      ['#efe9dc', '#d8cfbc'],
      ['#e3d6c2', '#c6b69c'],
      ['#4c4742', '#6d665e'],
      ['#f4efe6', '#cdc0ac'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2 },
    tameFail: 'eats the {food} without appearing to notice you at all',
    leaves: 'wanders off grazing and does not look back',
    fleece: 1 / 900,
    learns: { skill: 'animal_husbandry', by: 'tended' },
  },
  ulva: {
    id: 'ulva',
    wound: 'cut',
    name: 'Ulva',
    description: 'Grey, lean and long in the leg, and the first thing on this island that will come at you without being struck first. Tame one and it will do the same for everything that comes near your border.',
    health: 34,
    attack: 9,
    speed: 2.1,
    tameLevel: 30,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 12,
    variants: [
      ['#6b6a66', '#cfcac0'],
      ['#4c4a47', '#b2ada4'],
      ['#7d7263', '#d9d2c4'],
      ['#5a5f66', '#bcc2c8'],
    ],
    butcher: { meat: 5, fur: 4, leather: 4, bone: 4, gland: 2 },
    tameFail: 'takes the {food} off your palm with its teeth and watches you back away',
    leaves: 'trots to the edge of the field, looks back once, and is gone',
    hunter: true,
    defensive: true,
    defaultStance: 'aggressive',
  },
  magga: {
    id: 'magga',
    wound: 'cut',
    name: 'Magga',
    description: 'A sharp-eyed black and white bird that lives in the treetops and cannot leave anything shiny where it lies. Tamed, it clears a settlement of everything dropped and forgotten; wild, it is the reason your things are not where you left them.',
    health: 16,
    attack: 3,
    speed: 2,
    tameLevel: 5,
    tameChance: 0.14,
    diet: ['blueberry', 'raspberry', 'strawberry', 'lingonberry', 'acorn', 'nuts'],
    baitHint: 'a berry or a handful of nuts',
    timid: true,
    gathers: 'fetch',
    workRange: 12,
    rangePerStep: 12,
    variants: [
      ['#26282e', '#f2f0ea'],
      ['#2e2a33', '#e6e3dc'],
      ['#20262c', '#dfe6ea'],
      ['#332a26', '#efe6d8'],
    ],
    butcher: { meat: 1, leather: 1, bone: 1, gland: 1, feather: 6 },
    tameFail: 'snatches the {food} and is twenty feet up a tree before you can blink',
    leaves: 'lifts off with a rattle of wings and is gone over the trees',
    nearTrees: true,
  },
  mola: {
    id: 'mola',
    wound: 'cut',
    name: 'Mola',
    description: 'A heavy-shouldered mole with claws like trowels and grit worked into its coat. It can smell metal through a foot of stone and would rather be underground than not.',
    health: 22,
    attack: 4,
    speed: 1.5,
    tameLevel: 1,
    tameChance: 0.1,
    diet: ['sage', 'basil', 'thyme', 'mint', 'rosemary'],
    baitHint: 'a spice',
    timid: true,
    gathers: 'mine',
    workRange: 8,
    rangePerStep: 5,
    variants: [
      ['#3f3b38', '#78706a'],
      ['#4a4038', '#8a7c6e'],
      ['#5c5450', '#9a9088'],
      ['#332e2c', '#6a625c'],
    ],
    butcher: { meat: 2, fur: 2, leather: 2, bone: 2, gland: 2 },
    tameFail: 'noses the {food} over, thinks better of you, and digs itself out of sight',
    leaves: 'digs straight down and is gone',
    onOre: true,
  },
  seavic: {
    id: 'seavic',
    name: 'Seavic',
    description: 'A quick red-brown squirrel with a tail it wears like a cloak and cheeks it stuffs with seed. It lives in the treetops and cannot leave a field alone.',
    health: 14,
    attack: 2,
    speed: 2.6,
    tameLevel: 1,
    tameChance: 0.12,
    diet: ['acorn', 'nuts'],
    baitHint: 'an acorn or a handful of nuts',
    timid: true,
    gathers: 'farm',
    workRange: 8,
    variants: [
      ['#a65a2e', '#e0b189'],
      ['#8a8f95', '#d6dade'],
      ['#3a3230', '#8c8078'],
      ['#c98f4e', '#f0dcc0'],
    ],
    butcher: { meat: 1, fur: 2, leather: 1, bone: 1, gland: 1 },
    tameFail: 'stuffs the {food} into its cheeks and is up the nearest trunk before you can blink',
    leaves: 'flicks its tail and runs up the nearest tree',
    nearTrees: true,
    defaultStance: 'passive',
  },
  roxxen: {
    id: 'roxxen',
    hide: 'thick',
    heavy: true,
    wound: 'crush',
    name: 'Roxxen',
    description: 'A great slab-shouldered ox with horns that sweep forward and a head it holds low. It will not start anything, and it will finish most things that start with it. Nothing but a Shaggan pulls a loaded wagon like a pair of them.',
    health: 80,
    attack: 11,
    speed: 1.1,
    tameLevel: 25,
    tameChance: 0.07,
    diet: ['mixed_grass', 'wheat', 'corn', 'cabbage', 'carrot'],
    baitHint: 'grass or grain',
    timid: false,
    gathers: null,
    workRange: 6,
    variants: [
      ['#7a5a3c', '#c2a077'],
      ['#4a4441', '#8f8880'],
      ['#8d4f34', '#caa484'],
      ['#b3a894', '#e4dccb'],
    ],
    butcher: { meat: 26, fur: 4, leather: 14, bone: 18, gland: 1 },
    tameFail: 'chews through the {food} without once looking up, and goes back to the grass',
    leaves: 'walks off at its own pace and does not look back',
    defensive: true,
    draught: true,
    pull: 0.3,
  },
  orse: {
    id: 'orse',
    wound: 'crush',
    name: 'Orse',
    description: 'Long in the leg and deep in the chest, with a mane that falls to one side. It will carry a rider once it is saddled and bridled, and the further it has been worked the surer its footing on a bad slope.',
    health: 50,
    attack: 7,
    speed: 3,
    tameLevel: 30,
    tameChance: 0.07,
    diet: ['mixed_grass', 'wheat', 'corn', 'carrot', 'acorn'],
    baitHint: 'grass, grain or a root',
    timid: false,
    gathers: null,
    workRange: 6,
    variants: [
      ['#6b4830', '#2e2320'],
      ['#8f8880', '#514c47'],
      ['#3a3330', '#211d1b'],
      ['#a8703c', '#e0c294'],
    ],
    butcher: { meat: 14, fur: 3, leather: 10, bone: 12, gland: 1 },
    tameFail: 'lips the {food} out of your hand, tosses its head, and moves off a few lengths',
    leaves: 'wheels away at a canter and is over the rise before you can call it',
    defensive: true,
    draught: true,
    mount: 16,
  },
  rowl: {
    id: 'rowl',
    wound: 'cut',
    name: 'Rowl',
    description: 'A deep-chested hunter that runs the treeline in the half-light. It hunts the moment it sees you, and tamed it will hunt for you instead: give it a settlement and it works a circuit of it, and the more it fights the wider that circuit gets.',
    health: 46,
    attack: 14,
    speed: 2.5,
    tameLevel: 35,
    tameChance: 0.05,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'hunt',
    workRange: 12,
    rangePerStep: 12,
    variants: [
      ['#575450', '#b5aea3'],
      ['#2f2c2a', '#6f6862'],
      ['#c8c2b6', '#eee9df'],
      ['#7a5b40', '#c8ac8c'],
    ],
    butcher: { meat: 8, fur: 6, leather: 5, bone: 6, gland: 2 },
    tameFail: 'takes the {food} and keeps its shoulder to you the whole while, unconvinced',
    leaves: 'goes off at a long easy lope and is lost in the trees',
    nearTrees: true,
    hunter: true,
    pack: true,
    defensive: true,
    unruly: 0.08,
    defaultStance: 'aggressive',
  },
  // ---- The working sorts. ----
  bogga: {
    id: 'bogga',
    name: 'Bogga',
    description: 'A flat-tailed wallower, black to the shoulder and never far from the black ground. It works peat and tar out of the bog with its forepaws and thinks nothing of the smell.',
    health: 30,
    attack: 4,
    speed: 1.4,
    tameLevel: 10,
    tameChance: 0.11,
    diet: ['mixed_grass', 'cabbage', 'carrot', 'potato'],
    baitHint: 'grass or a root',
    timid: true,
    gathers: 'peat',
    workRange: 9,
    variants: [
      ['#3a332c', '#7a6c58'],
      ['#2b2a28', '#645f56'],
      ['#4a3b2c', '#8b7458'],
      ['#221f1d', '#4f4a44'],
    ],
    butcher: { meat: 4, fur: 3, leather: 3, bone: 3, gland: 1 },
    tameFail: 'takes the {food} in both paws, eats it where it stands, and wallows off',
    leaves: 'slides back into the peat and is gone',
    nearTar: true,
  },
  sedra: {
    id: 'sedra',
    name: 'Sedra',
    description: 'A long-necked wader that stands in the shallows all day and cuts reeds with a bill like a pair of shears. Papyrus starts with this bird whether you keep one or not.',
    health: 22,
    attack: 3,
    speed: 2,
    tameLevel: 8,
    tameChance: 0.12,
    diet: ['reed', 'wheat', 'corn', 'nuts'],
    baitHint: 'reeds or grain',
    timid: true,
    gathers: 'reed',
    workRange: 10,
    variants: [
      ['#9aa88c', '#e4e0cc'],
      ['#7d8c9a', '#d6dce2'],
      ['#b0a276', '#eee7cd'],
      ['#6f7a6a', '#c8ccb8'],
    ],
    butcher: { meat: 3, feather: 4, leather: 1, bone: 2 },
    tameFail: 'lifts one foot, looks at the {food}, and goes back to the reeds',
    leaves: 'runs three steps on the water and is away',
    nearWater: true,
  },
  holla: {
    id: 'holla',
    name: 'Holla',
    description: 'A barrel of a creature with a throat pouch that holds more water than you would credit. It carries the shore to your barrels so that you do not have to.',
    health: 34,
    attack: 3,
    speed: 1.6,
    tameLevel: 12,
    tameChance: 0.1,
    diet: ['mixed_grass', 'wheat', 'corn', 'cabbage'],
    baitHint: 'grass or grain',
    timid: true,
    gathers: 'water',
    workRange: 10,
    variants: [
      ['#6f8496', '#cfd8dd'],
      ['#57707f', '#b6c3cb'],
      ['#8a8f7a', '#dcdcc8'],
      ['#4a5a66', '#9fadb6'],
    ],
    butcher: { meat: 6, fur: 2, leather: 4, bone: 4, gland: 1 },
    tameFail: 'drinks noisily, takes the {food} as an afterthought, and lumbers off',
    leaves: 'wades out until only the pouch shows, and then not even that',
    nearWater: true,
  },
  dowse: {
    id: 'dowse',
    name: 'Dowse',
    description: 'A whiskered burrower that will not settle anywhere there is no metal under it. Put one on a deed and it spends its days reading the ground and telling you what is down there.',
    health: 20,
    attack: 3,
    speed: 1.8,
    tameLevel: 15,
    tameChance: 0.1,
    diet: ['nuts', 'acorn', 'clay', 'potato'],
    baitHint: 'nuts or a root',
    timid: true,
    gathers: 'prospect',
    workRange: 8,
    rangePerStep: 12,
    variants: [
      ['#6d6357', '#c3b49a'],
      ['#8a7a5e', '#ded0ae'],
      ['#514b44', '#a49a8a'],
      ['#7c6a6a', '#cbb9b4'],
    ],
    butcher: { meat: 2, fur: 3, leather: 2, bone: 2, gland: 2 },
    tameFail: 'sniffs the {food}, sniffs the ground, and decides the ground is more interesting',
    leaves: 'goes down a hole that was not there a moment ago',
    onOre: true,
  },
  sappa: {
    id: 'sappa',
    name: 'Sappa',
    description: 'A moss-backed browser of the deep woods that buries more seed than it eats and forgets where. Kept on a deed it plants the ground back up behind your axe.',
    health: 26,
    attack: 3,
    speed: 1.7,
    tameLevel: 10,
    tameChance: 0.12,
    diet: ['acorn', 'nuts', 'sprout', 'blueberry'],
    baitHint: 'nuts or an acorn',
    timid: true,
    gathers: 'plant',
    workRange: 10,
    variants: [
      ['#5d6b45', '#b6bd94'],
      ['#6f5a3c', '#c4ab80'],
      ['#47533c', '#9aa585'],
      ['#7a6f4e', '#d3c8a0'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2, gland: 1 },
    tameFail: 'buries the {food} instead of eating it and wanders off pleased with itself',
    leaves: 'goes up the nearest trunk and out of sight among the leaves',
    nearTrees: true,
  },
  snedda: {
    id: 'snedda',
    name: 'Snedda',
    description: 'A long-necked browser of the wood\'s edge with a mouth like a pair of shears. It nips the dead wood out of a tree and leaves the live, and kept on a deed it prunes what would otherwise die, and nothing else.',
    health: 24,
    attack: 2,
    speed: 1.6,
    tameLevel: 14,
    tameChance: 0.1,
    diet: ['apple', 'cherry', 'olive', 'sprout', 'nuts'],
    baitHint: 'fruit off a tree, or a sprout',
    timid: true,
    gathers: 'prune',
    workRange: 8,
    variants: [
      ['#6e7d4a', '#c9cf9a'],
      ['#807a52', '#d9d2a4'],
      ['#556343', '#a9b58c'],
      ['#8a7f5c', '#e2d8b2'],
    ],
    butcher: { meat: 2, fur: 2, leather: 2, bone: 2, gland: 1 },
    tameFail: 'takes the {food} at the very tips of its teeth, chews it a long while, and goes back to nipping at a branch',
    leaves: 'reaches up into the branches and is a branch itself by the time you look again',
    nearTrees: true,
  },
  grubba: {
    id: 'grubba',
    name: 'Grubba',
    description: 'A squat, hump-shouldered rooter with claws like mattock blades. It digs for what lives under old stumps and takes the stump with it; kept on a deed it clears the ground behind your axe.',
    health: 30,
    attack: 4,
    speed: 1.4,
    tameLevel: 8,
    tameChance: 0.12,
    diet: ['worm', 'acorn', 'nuts', 'potato', 'carrot', 'onion'],
    baitHint: 'worms, or a root out of the ground',
    timid: true,
    gathers: 'stump',
    workRange: 8,
    variants: [
      ['#5a4a3a', '#a08a6a'],
      ['#6b5040', '#b89a7a'],
      ['#4a4640', '#948c80'],
      ['#7a5a3e', '#c9a880'],
    ],
    butcher: { meat: 4, fur: 2, leather: 3, bone: 3, gland: 1 },
    tameFail: 'snuffles the {food} out of your hand and goes straight back to its digging',
    leaves: 'shoulders into the undergrowth and is gone',
    nearTrees: true,
  },
  plucka: {
    id: 'plucka',
    name: 'Plucka',
    description: 'A long-armed climber of the orchard\'s edge with hands like a child\'s and a tail it hangs by. It goes up a bearing tree and comes down with the fruit, and kept on a deed it picks what the trees have on them and carries it home to the crate.',
    health: 18,
    attack: 1,
    speed: 1.7,
    tameLevel: 10,
    tameChance: 0.12,
    diet: ['apple', 'cherry', 'olive', 'pear', 'plum', 'peach', 'fig', 'lemon', 'pomegranate', 'apricot', 'quince', 'nuts'],
    baitHint: 'fruit off a tree',
    timid: true,
    gathers: 'fruit',
    workRange: 8,
    variants: [
      ['#7a5a3a', '#e0c79a'],
      ['#5c4a3c', '#c9b58e'],
      ['#8a6a44', '#efd9ac'],
      ['#4e4238', '#b8a88a'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 2, gland: 1 },
    tameFail: 'takes the {food} in both hands, eats it in three bites and is back up the tree before you have moved',
    leaves: 'swings up into the canopy and is gone hand over hand',
    nearTrees: true,
  },
  cobbe: {
    id: 'cobbe',
    hide: 'thick',
    name: 'Cobbe',
    description: 'A squat, hard-headed hauler with shoulders like a wall itself. It carries brick and mortar to whatever you have planned and fits it, one piece at a time, unasked.',
    health: 40,
    attack: 5,
    speed: 1.5,
    tameLevel: 20,
    tameChance: 0.09,
    diet: ['bread', 'baked_potato', 'mixed_grass', 'corn'],
    baitHint: 'bread or something cooked',
    timid: false,
    gathers: 'hod',
    workRange: 12,
    variants: [
      ['#8a8178', '#cfc7bb'],
      ['#6e6259', '#b2a79a'],
      ['#9a8467', '#ddcaa8'],
      ['#5c5a58', '#a09d99'],
    ],
    butcher: { meat: 6, fur: 1, leather: 5, bone: 6 },
    tameFail: 'eats the {food} in one, looks at you, and goes back to shoving rocks about',
    leaves: 'walks off with its head down and does not look back',
    defensive: true,
  },
  tinka: {
    id: 'tinka',
    name: 'Tinka',
    description: 'A small, fussy thing with far too many fingers, forever taking something apart to see how it is put together. Left alone with your gear it mends it, which is more than most would do.',
    health: 16,
    attack: 2,
    speed: 2,
    tameLevel: 25,
    tameChance: 0.08,
    diet: ['nuts', 'acorn', 'blueberry', 'honey'],
    baitHint: 'nuts or something sweet',
    timid: true,
    gathers: 'mend',
    workRange: 6,
    variants: [
      ['#8c7a5c', '#e0d1ac'],
      ['#6a6a72', '#bdbdc6'],
      ['#94694f', '#e4bb96'],
      ['#5f6b5a', '#b3c0ab'],
    ],
    butcher: { meat: 1, fur: 2, leather: 1, bone: 1, gland: 2 },
    tameFail: 'turns the {food} over twice looking for a seam in it, then puts it down',
    leaves: 'pockets something of yours and is gone before you can see which',
  },
  middun: {
    id: 'middun',
    name: 'Middun',
    description: 'A low, patient scavenger that eats what everything else has given up on. What comes out the other end is the best thing that ever happened to a field.',
    health: 24,
    attack: 3,
    speed: 1.5,
    tameLevel: 8,
    tameChance: 0.13,
    diet: ['meat', 'potato', 'cabbage', 'corpse'],
    baitHint: 'meat or a vegetable',
    timid: true,
    gathers: 'compost',
    workRange: 10,
    variants: [
      ['#5a4a38', '#9f8a6e'],
      ['#41382e', '#7d7062'],
      ['#6d5a44', '#b39a78'],
      ['#332e2a', '#665f57'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 3, gland: 1 },
    tameFail: 'eats the {food} and everything within a foot of where it fell',
    leaves: 'shuffles into the undergrowth after something it can smell and you cannot',
  },
  // ---- The settlement's own hands. ----
  // Each says what it does on a settlement in the game's own terms; the numbers are the trades' (`TEND_JOBS`, `GATHER_DO`).
  kemma: {
    id: 'kemma',
    name: 'Kemma',
    description: 'A soft, round grazer with a broad tongue and a coat that is always clean. Set to work on a settlement it brushes down every wildermon of yours within its reach whose care is under {careWanting:pct}, as a keeper of its skill with a brush of the same quality would.',
    health: 18,
    attack: 2,
    speed: 2,
    tameLevel: 12,
    tameChance: 0.12,
    diet: ['mixed_grass', 'carrot', 'cabbage', 'apple'],
    baitHint: 'grass or a vegetable',
    timid: true,
    gathers: 'groom',
    workRange: 8,
    variants: [
      ['#c9b48e', '#f3e7cf'],
      ['#a89c8c', '#e6ddd1'],
      ['#b98f6e', '#f0d3b8'],
      ['#8f9a86', '#d8e0cf'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2 },
    tameFail: 'licks the {food} clean and leaves it',
    leaves: 'wanders off grooming its own shoulder',
  },
  sheela: {
    id: 'sheela',
    name: 'Sheela',
    description: 'A short, deft creature with clever forepaws and shears for teeth. Set to work on a settlement it milks your cudda into the empty buckets in your stores, and shears or plucks every other of yours with a fleece or feathers, each once it is {dairyFull:pct} grown back; what comes off goes in your stores.',
    health: 20,
    attack: 2,
    speed: 2.2,
    tameLevel: 16,
    tameChance: 0.1,
    diet: ['mixed_grass', 'wheat', 'carrot', 'cheese'],
    baitHint: 'grass, grain or cheese',
    timid: true,
    gathers: 'dairy',
    workRange: 8,
    variants: [
      ['#d6c7a6', '#7a6248'],
      ['#b8b2a8', '#5d564e'],
      ['#c9a77f', '#6e4f36'],
      ['#e1d9c8', '#857462'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2 },
    tameFail: 'snips the {food} in half and walks off with the bigger piece',
    leaves: 'trots away clicking its teeth',
  },
  salva: {
    id: 'salva',
    name: 'Salva',
    description: 'A long-fingered, careful creature that smells of crushed leaves. Set to work on a settlement it dresses any wildermon of yours within its reach that is bleeding or under {healBelow:pct} of its health, with a bandage or a herb cover out of your stores: the bleeding stops, and it puts back the share of a life a dressing of that quality at its first aid would.',
    health: 16,
    attack: 1,
    speed: 2,
    tameLevel: 20,
    tameChance: 0.09,
    diet: ['blueberry', 'raspberry', 'honey', 'apple'],
    baitHint: 'berries or honey',
    timid: true,
    gathers: 'heal',
    workRange: 8,
    variants: [
      ['#7f9a7a', '#dfe9d6'],
      ['#8d8a6c', '#e8e3c4'],
      ['#6f8590', '#d2e0e6'],
      ['#9a7f8c', '#eadbe2'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 1, gland: 2 },
    tameFail: 'sniffs the {food}, decides you are the one who needs looking after, and pats your hand',
    leaves: 'goes off into the long grass looking for something to put on a cut',
    nearTrees: true,
  },
  carra: {
    id: 'carra',
    name: 'Carra',
    description: 'A heavy-jawed scavenger with a cleaver of a beak, which goes where the hunters have been. Set to work on a settlement it butchers the carcasses in your stores, taking as much of each as a butcher of its skill with a knife of the same quality would, and puts what comes off back in your stores.',
    health: 30,
    attack: 5,
    speed: 2,
    tameLevel: 22,
    tameChance: 0.09,
    diet: ['meat', 'offal', 'cooked_meat', 'minnow'],
    baitHint: 'meat or a fish',
    timid: false,
    gathers: 'butcher',
    workRange: 6,
    variants: [
      ['#4a4440', '#c2b7a8'],
      ['#5b4636', '#d1b79a'],
      ['#3b3f45', '#aab3bb'],
      ['#614a3f', '#d8c0ae'],
    ],
    butcher: { meat: 4, fur: 2, leather: 2, bone: 3, feather: 4 },
    tameFail: 'takes the {food} apart into neat pieces and eats none of them',
    leaves: 'lopes off toward wherever something last died',
    nearTrees: true,
  },
  tanna: {
    id: 'tanna',
    name: 'Tanna',
    description: 'A sleek, bark-brown wader with hands stained to the wrist. Set to work on a settlement it tans the hides in your stores, a hide and a bucket of lye to each piece of leather, so long as a carving knife is kept in your stores; the bucket goes back in with the leather.',
    health: 22,
    attack: 3,
    speed: 2,
    tameLevel: 18,
    tameChance: 0.1,
    diet: ['minnow', 'perch', 'trout', 'acorn'],
    baitHint: 'a fish or an acorn',
    timid: true,
    gathers: 'tan',
    workRange: 6,
    variants: [
      ['#7a5634', '#d9b98e'],
      ['#5e4630', '#c7a982'],
      ['#8c6a43', '#e6cba2'],
      ['#4d3b2c', '#b39878'],
    ],
    butcher: { meat: 3, fur: 3, leather: 3, bone: 2 },
    tameFail: 'dunks the {food} in the nearest water and forgets about it',
    leaves: 'slides off toward the water',
    nearWater: true,
  },
  grista: {
    id: 'grista',
    name: 'Grista',
    description: 'A stout, dusty creature with jaws like millstones and a tail it sweeps the floor with. Set to work on a settlement it grinds the wheat and corn and presses the olives in your stores, so long as a quern is kept in your stores, and puts the flour, cornmeal and oil back in.',
    health: 26,
    attack: 3,
    speed: 1.6,
    tameLevel: 14,
    tameChance: 0.11,
    diet: ['wheat', 'corn', 'nuts', 'bread'],
    baitHint: 'grain or bread',
    timid: true,
    gathers: 'mill',
    workRange: 6,
    variants: [
      ['#d8cfbf', '#9b8b72'],
      ['#c2b49a', '#7f6e55'],
      ['#e4dccb', '#a69677'],
      ['#b7aa94', '#6e604c'],
    ],
    butcher: { meat: 4, fur: 3, leather: 2, bone: 3 },
    tameFail: 'grinds the {food} to dust and blows it away',
    leaves: 'shuffles off in a small cloud of flour',
  },
  wicka: {
    id: 'wicka',
    name: 'Wicka',
    description: 'A small, moth-winged thing that comes out at dusk and goes to every light it can see. Set to work on a settlement it puts a candle out of your stores in every lantern post and pillar of yours that has none, lights them once it is dark and puts them out by day, so no candle burns while the sun is up.',
    health: 10,
    attack: 1,
    speed: 2.6,
    tameLevel: 24,
    tameChance: 0.08,
    diet: ['honey', 'apple', 'pear', 'plum'],
    baitHint: 'honey or soft fruit',
    timid: true,
    gathers: 'lamp',
    workRange: 8,
    variants: [
      ['#6e6354', '#f0d58a'],
      ['#5a5a66', '#e9d9a8'],
      ['#7d6a52', '#f5c77a'],
      ['#4f5b56', '#dfe3a0'],
    ],
    butcher: { meat: 1, fur: 1, leather: 1, gland: 2 },
    tameFail: 'flutters round the {food} twice and settles on your lantern instead',
    leaves: 'flits off toward the nearest light',
    nocturnal: true,
  },
  brambo: {
    id: 'brambo',
    name: 'Brambo',
    description: 'A burr-coated rummager of the hedges with a mouth that strips a bush clean. Set to work on a settlement it picks the bushes in their season, as many off each as your hands would at its forestry, and the ripe vines on your trellises, and carries it home.',
    health: 22,
    attack: 3,
    speed: 2,
    tameLevel: 10,
    tameChance: 0.12,
    diet: ['blueberry', 'raspberry', 'strawberry', 'grape'],
    baitHint: 'berries or grapes',
    timid: true,
    gathers: 'bush',
    workRange: 8,
    variants: [
      ['#6b4f3a', '#c69a72'],
      ['#4f5a38', '#a7b47e'],
      ['#7a4a46', '#d39a92'],
      ['#5a4a5e', '#b49ab8'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2 },
    tameFail: 'eats the {food} and then the bush you were standing by',
    leaves: 'pushes off into the nearest hedge',
    nearTrees: true,
  },
  grazza: {
    id: 'grazza',
    name: 'Grazza',
    description: 'A low, wide grazer that crops the ground as it goes, flat as a scythe. Set to work on a settlement it cuts grass, {grassPerCut:w} bundles of mixed grass a cut, and moss, {mossPerCut:w} clumps a cut, and carries it home; grass it keeps cut on your settlement turns to lawn as it does for you.',
    health: 24,
    attack: 2,
    speed: 1.8,
    tameLevel: 6,
    tameChance: 0.14,
    diet: ['mixed_grass', 'wheat', 'carrot', 'cabbage'],
    baitHint: 'grass or a vegetable',
    timid: true,
    gathers: 'grass',
    workRange: 8,
    variants: [
      ['#8a9a5c', '#d8e2b0'],
      ['#7d8a6a', '#cdd6bd'],
      ['#9a8a5a', '#e2d6a8'],
      ['#6a7a5a', '#bfcaae'],
    ],
    butcher: { meat: 4, fur: 3, leather: 3, bone: 3 },
    tameFail: 'eats the {food} and the grass under it',
    leaves: 'grazes its way off in a straight line',
  },
  siffa: {
    id: 'siffa',
    name: 'Siffa',
    description: 'A long-legged shore wader with a scoop of a bill it swirls the wet sand in. Set to work on a settlement it pans the sand at the water\u2019s edge and carries home what settles: something {panLeast:pct} of the time at no skill, rising to {panMost:pct} at {skillTop} prospecting.',
    health: 16,
    attack: 2,
    speed: 2.2,
    tameLevel: 20,
    tameChance: 0.09,
    diet: ['minnow', 'perch', 'trout', 'nuts'],
    baitHint: 'a fish',
    timid: true,
    gathers: 'pan',
    workRange: 8,
    variants: [
      ['#b9a27a', '#efe2c4'],
      ['#8f9aa0', '#dde5ea'],
      ['#a68d6a', '#e8d6b6'],
      ['#7f8b7a', '#d4dccd'],
    ],
    butcher: { meat: 2, fur: 1, leather: 1, bone: 2, feather: 5 },
    tameFail: 'washes the {food} in the shallows until there is nothing left of it',
    leaves: 'stalks off along the waterline',
    onSand: true,
    nearWater: true,
  },
  // ---- Twelve more hands: the furnaces, the kitchen, the stores and the ground. ----
  forga: {
    id: 'forga',
    name: 'Forga',
    description: 'A squat, soot-streaked thing with a bellows of a chest and hands that do not feel heat. Set to work on a settlement it takes what your smelters have made out into your stores and charges them with the ore in your stores, a charge to an ore as yours are, up to what each will hold. It neither lights nor fuels them.',
    health: 28,
    attack: 4,
    speed: 1.8,
    tameLevel: 20,
    tameChance: 0.09,
    diet: ['meat', 'bread', 'nuts', 'cooked_meat'],
    baitHint: 'meat or bread',
    timid: false,
    gathers: 'smelt',
    workRange: 6,
    variants: [
      ['#5a4f48', '#d98a4e'],
      ['#4a4a52', '#c9a06a'],
      ['#62503f', '#e0b070'],
      ['#3f4448', '#b8865a'],
    ],
    butcher: { meat: 3, fur: 2, leather: 3, bone: 3 },
    tameFail: 'sniffs the {food}, finds it not hot enough and drops it',
    leaves: 'stumps off toward the nearest smoke',
    onStone: true,
  },
  potta: {
    id: 'potta',
    name: 'Potta',
    description: 'A round, clay-caked creature with a wide flat tail it smooths things with. Set to work on a settlement it takes what your kilns have fired out into your stores and packs them with the unfired pottery in your stores, up to what each will hold. It neither lights nor fuels them.',
    health: 22,
    attack: 2,
    speed: 1.8,
    tameLevel: 14,
    tameChance: 0.11,
    diet: ['potato', 'carrot', 'bread', 'corn'],
    baitHint: 'a vegetable or bread',
    timid: true,
    gathers: 'kiln',
    workRange: 6,
    variants: [
      ['#b5855e', '#e8cdb0'],
      ['#a07454', '#dbc0a0'],
      ['#c09070', '#f0d8bc'],
      ['#8c6a50', '#d0b498'],
    ],
    butcher: { meat: 3, fur: 2, leather: 2, bone: 2 },
    tameFail: 'presses the {food} into a little pot and leaves it to dry',
    leaves: 'waddles off to the nearest clay',
    nearClay: true,
  },
  cindra: {
    id: 'cindra',
    name: 'Cindra',
    description: 'A small grey creature soft as ash, with a dustpan of a tail. Set to work on a settlement it rakes every whole ash out of your campfires, ovens, smelters and kilns into your stores, and with none to rake it leaches ash and a bucket of water from your stores into lye, as the lye recipe takes them.',
    health: 18,
    attack: 2,
    speed: 2,
    tameLevel: 16,
    tameChance: 0.1,
    diet: ['nuts', 'acorn', 'bread', 'potato'],
    baitHint: 'nuts or bread',
    timid: true,
    gathers: 'ash',
    workRange: 8,
    variants: [
      ['#9a9894', '#e4e2dc'],
      ['#8a8478', '#d8d2c4'],
      ['#a4a0a8', '#e8e4ec'],
      ['#7c7a74', '#cac6bc'],
    ],
    butcher: { meat: 2, fur: 3, leather: 1, bone: 1 },
    tameFail: 'buries the {food} in the cinders and forgets it',
    leaves: 'drifts off like smoke',
    nearTar: true,
  },
  hoppa: {
    id: 'hoppa',
    name: 'Hoppa',
    description: 'A cheerful, round-bellied creature with a cork of a nose and a smell of malt. Set to work on a settlement it sets a brew going in every barrel of yours that holds water enough and is not working, with makings from your stores, trying the brews in the order they are listed. It never spoils a brew, and what it brews is half the quality of what went in and half its brewing.',
    health: 22,
    attack: 2,
    speed: 1.8,
    tameLevel: 18,
    tameChance: 0.1,
    diet: ['wheat', 'apple', 'honey', 'bread'],
    baitHint: 'grain, apples or honey',
    timid: true,
    gathers: 'brew',
    workRange: 6,
    variants: [
      ['#b8925a', '#f0dca8'],
      ['#9c7a4a', '#e2c890'],
      ['#c4a070', '#f4e2bc'],
      ['#8a6c48', '#d6bc8c'],
    ],
    butcher: { meat: 3, fur: 2, leather: 2, bone: 2 },
    tameFail: 'sniffs the {food}, decides it is not ready yet and sets it aside',
    leaves: 'rolls off whistling',
  },
  simma: {
    id: 'simma',
    name: 'Simma',
    description: 'A plump creature with a spoon of a tail and a nose for anything on the fire. Set to work on a settlement it cooks what your stores hold the makings of at your lit campfires and ovens, trying the recipes in the order they are listed, with any bowl, pot or pan a recipe wants kept in your stores, and puts what it cooks back in your stores. It never burns anything.',
    health: 20,
    attack: 2,
    speed: 1.8,
    tameLevel: 16,
    tameChance: 0.1,
    diet: ['meat', 'potato', 'onion', 'bread'],
    baitHint: 'meat or a vegetable',
    timid: true,
    gathers: 'cook',
    workRange: 6,
    variants: [
      ['#d4a07a', '#f6e0c8'],
      ['#c08c68', '#ecd2b8'],
      ['#dcb08c', '#f8e8d4'],
      ['#b08060', '#e4c8ac'],
    ],
    butcher: { meat: 4, fur: 2, leather: 2, bone: 2 },
    tameFail: 'cooks the {food} on nothing at all and eats it',
    leaves: 'waddles off toward a smell of supper',
  },
  relka: {
    id: 'relka',
    name: 'Relka',
    description: 'A careful, whiskered creature with fine fingers and a magnifying lens of an eye. Set to work on a settlement it restores every relic all of whose pieces are in your stores, at what the pieces were worth less their damage and at its restoration, as your own hands would, and puts the relic in your stores. It never fails.',
    health: 16,
    attack: 1,
    speed: 1.8,
    tameLevel: 28,
    tameChance: 0.08,
    diet: ['nuts', 'honey', 'apple', 'blueberry'],
    baitHint: 'nuts or honey',
    timid: true,
    gathers: 'restore',
    workRange: 6,
    variants: [
      ['#8a7a6a', '#e6dacc'],
      ['#7a7a84', '#d8d8e2'],
      ['#94806c', '#ecdcc8'],
      ['#6e6a60', '#cec8bc'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 2, gland: 1 },
    tameFail: 'turns the {food} over looking for where it was mended',
    leaves: 'scuttles off with its nose to the ground',
  },
  bedda: {
    id: 'bedda',
    name: 'Bedda',
    description: 'A small, mossy-backed creature with a trowel of a nose. Set to work on a settlement it harvests the ripe crops in your planters into your stores, tends the growing ones, and sows the empty ones with seed from your stores.',
    health: 18,
    attack: 2,
    speed: 1.8,
    tameLevel: 10,
    tameChance: 0.12,
    diet: ['carrot', 'cabbage', 'wheat', 'potato'],
    baitHint: 'a vegetable or grain',
    timid: true,
    gathers: 'patch',
    workRange: 8,
    variants: [
      ['#7a8a5a', '#d8e2b8'],
      ['#8a7a5a', '#e2d6b0'],
      ['#6a8070', '#ccdcd0'],
      ['#8c8064', '#e4dcc0'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 1 },
    tameFail: 'plants the {food} and waits for it to grow',
    leaves: 'burrows off under the nearest hedge',
  },
  wurla: {
    id: 'wurla',
    name: 'Wurla',
    description: 'A long, low, damp-nosed digger with a spade of a snout. Set to work on a settlement it digs for worms on dry grass, dirt, marsh and moss as your spade would, more in a marsh or under moss and now and then none, and carries them home; a tile it has dug rests as long as a forage bed.',
    health: 18,
    attack: 2,
    speed: 1.8,
    tameLevel: 8,
    tameChance: 0.13,
    diet: ['worm', 'carrot', 'potato', 'cabbage'],
    baitHint: 'worms or a vegetable',
    timid: true,
    gathers: 'worm',
    workRange: 8,
    variants: [
      ['#8a6a5a', '#e0c4b4'],
      ['#7a6458', '#d4bcae'],
      ['#946c58', '#e8c8b4'],
      ['#6c5c52', '#c8b4a8'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 1 },
    tameFail: 'eats the {food} and the soil it was lying on',
    leaves: 'noses off into the soft ground',
    nearWater: true,
  },
  sprigga: {
    id: 'sprigga',
    name: 'Sprigga',
    description: 'A slim, leaf-eared climber that strips a tree of its shoots without hurting it. Set to work on a settlement it picks a sprout off a living tree, one at a time, named for the tree it came off, and carries it home; a tree it has picked rests as long as a forage bed.',
    health: 16,
    attack: 2,
    speed: 2.2,
    tameLevel: 10,
    tameChance: 0.12,
    diet: ['acorn', 'nuts', 'apple', 'blueberry'],
    baitHint: 'acorns, nuts or fruit',
    timid: true,
    gathers: 'sprout',
    workRange: 8,
    variants: [
      ['#6a8a5a', '#d4e6c4'],
      ['#7a7a4a', '#e2e2b4'],
      ['#5a7a6a', '#c4dccf'],
      ['#8a8a5a', '#e6e6c0'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 1 },
    tameFail: 'plants the {food} in the nearest crack and waits',
    leaves: 'runs up the nearest trunk',
    nearTrees: true,
  },
  ambra: {
    id: 'ambra',
    name: 'Ambra',
    description: 'A sticky-pawed, honey-coloured climber of the pinewoods. Set to work on a settlement it taps every pine big enough to tap, {resinTapped:w} tar a pine a day, and carries it home.',
    health: 18,
    attack: 2,
    speed: 2,
    tameLevel: 18,
    tameChance: 0.1,
    diet: ['nuts', 'acorn', 'honey', 'apple'],
    baitHint: 'nuts or honey',
    timid: true,
    gathers: 'resin',
    workRange: 8,
    variants: [
      ['#c08a3a', '#f2d8a0'],
      ['#a8762e', '#e6c890'],
      ['#c89848', '#f6e0b0'],
      ['#946a2c', '#dcbc84'],
    ],
    butcher: { meat: 2, fur: 3, leather: 1, bone: 1 },
    tameFail: 'gets the {food} stuck to its paws and gives up',
    leaves: 'climbs off into the pines',
    nearTrees: true,
  },
  petta: {
    id: 'petta',
    name: 'Petta',
    description: 'A light, petal-eared creature that floats from flower to flower. Set to work on a settlement it picks wildflowers, one for each clump on a tile, and carries them home, leaving the flowers in reach of a skep to the skep.',
    health: 12,
    attack: 1,
    speed: 2.4,
    tameLevel: 10,
    tameChance: 0.12,
    diet: ['honey', 'blueberry', 'strawberry', 'raspberry'],
    baitHint: 'honey or berries',
    timid: true,
    gathers: 'flower',
    workRange: 8,
    variants: [
      ['#d6a0c0', '#f8e4f0'],
      ['#c0a0d6', '#ece4f8'],
      ['#e0b0a0', '#fae8e0'],
      ['#a0c0d6', '#e4f0f8'],
    ],
    butcher: { meat: 1, fur: 2, leather: 1 },
    tameFail: 'smells the {food} and goes back to the flowers',
    leaves: 'drifts off across the meadow',
  },
  scurra: {
    id: 'scurra',
    name: 'Scurra',
    description: 'A stiff-bristled, stone-grey creature that cannot leave anything green alone. Set to work on a settlement it scrubs the moss off your paving, poured foundations and statues and clears the ivy off your stone walls once any of it has greened a day, which leaves it bare stone again. It carries nothing home.',
    health: 22,
    attack: 3,
    speed: 1.8,
    tameLevel: 14,
    tameChance: 0.11,
    diet: ['mixed_grass', 'carrot', 'cabbage', 'potato'],
    baitHint: 'grass or a vegetable',
    timid: true,
    gathers: 'scrub',
    workRange: 8,
    variants: [
      ['#8c8c88', '#d8d8d0'],
      ['#7c7c84', '#cacad4'],
      ['#948c80', '#ddd4c4'],
      ['#747874', '#c4c8c0'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2 },
    tameFail: 'scrubs the {food} clean and leaves it',
    leaves: 'shuffles off scrubbing a stone as it goes',
    onStone: true,
  },
  rippa: {
    id: 'rippa',
    name: 'Rippa',
    description: 'A long-armed, sawdust-coloured creature with a toothed ridge down its back. Set to work on a settlement it saws every log in your stores into planks, as many to a log as your own saw gets, with a saw kept in your stores, and puts the planks in your stores. It never spoils a log.',
    health: 24,
    attack: 3,
    speed: 1.8,
    tameLevel: 14,
    tameChance: 0.11,
    diet: ['nuts', 'apple', 'carrot', 'bread'],
    baitHint: 'nuts or an apple',
    timid: true,
    gathers: 'saw',
    workRange: 6,
    variants: [
      ['#c8a070', '#f0dcbc'],
      ['#b48c5c', '#e6ccaa'],
      ['#d4ac7c', '#f6e4c8'],
      ['#a07c50', '#dcc0a0'],
    ],
    butcher: { meat: 4, fur: 2, leather: 3, bone: 2 },
    tameFail: 'saws the {food} in two and leaves both halves',
    leaves: 'lopes off with a rasp of its back on the brush',
  },
  chissa: {
    id: 'chissa',
    name: 'Chissa',
    description: 'A squat, dusty-grey creature with a chisel of a front tooth. Set to work on a settlement it chisels every rock shard in your stores into stone brick, as many to a shard as your own chisel gets, with a chisel kept in your stores, and puts the bricks in your stores. It never splits a shard the wrong way.',
    health: 28,
    attack: 3,
    speed: 1.8,
    tameLevel: 16,
    tameChance: 0.1,
    diet: ['carrot', 'potato', 'cabbage', 'mixed_grass'],
    baitHint: 'a vegetable or grass',
    timid: true,
    gathers: 'chisel',
    workRange: 6,
    variants: [
      ['#9a948c', '#dcd8d0'],
      ['#8a8a90', '#d0d0d8'],
      ['#a49a8c', '#e4dccc'],
      ['#7c7c7c', '#c8c8c4'],
    ],
    butcher: { meat: 4, fur: 2, leather: 3, bone: 3 },
    tameFail: 'chips the {food} into little cubes and leaves them',
    leaves: 'trundles off tapping at the stones',
  },
  mudda: {
    id: 'mudda',
    name: 'Mudda',
    description: 'A round, clay-red creature with wide flat paws. Set to work on a settlement it shapes every lump of clay in your stores into an unfired clay brick, and puts the bricks in your stores for a kiln. It never lets a brick slump.',
    health: 20,
    attack: 2,
    speed: 1.8,
    tameLevel: 8,
    tameChance: 0.13,
    diet: ['mixed_grass', 'carrot', 'cabbage', 'reed'],
    baitHint: 'grass or a vegetable',
    timid: true,
    gathers: 'brick',
    workRange: 6,
    variants: [
      ['#b06a4c', '#e8c0a8'],
      ['#a05c40', '#dcb098'],
      ['#bc7858', '#f0ccb4'],
      ['#8c5038', '#d0a088'],
    ],
    butcher: { meat: 3, fur: 2, leather: 2, bone: 2 },
    tameFail: 'pats the {food} flat and leaves it to dry',
    leaves: 'plods off leaving square prints',
  },
  cordra: {
    id: 'cordra',
    name: 'Cordra',
    description: 'A lean, straw-coloured creature with a long twisted tail. Set to work on a settlement it lays up the wemp in your stores into rope, as many fibres to a rope as your own hands take, on a rope tool kept in your stores, and puts the rope in your stores. It never lets a lay unspool.',
    health: 20,
    attack: 2,
    speed: 1.8,
    tameLevel: 14,
    tameChance: 0.11,
    diet: ['mixed_grass', 'apple', 'carrot', 'wheat'],
    baitHint: 'grass or an apple',
    timid: true,
    gathers: 'rope',
    workRange: 6,
    variants: [
      ['#d4bc84', '#f4e8c8'],
      ['#c4a874', '#ecdcb8'],
      ['#dcc894', '#f8f0d4'],
      ['#b49864', '#e0ccac'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2 },
    tameFail: 'twists the {food} into a knot and leaves it',
    leaves: 'winds off through the grass',
  },
  flecha: {
    id: 'flecha',
    name: 'Flecha',
    description: 'A sharp-eyed, slender creature with a crest of stiff barred feathers. Set to work on a settlement it fletches arrows out of the shafts, arrowheads and feathers in your stores, with a carving knife kept in your stores, and puts the arrows in your stores. It never spoils a shaft.',
    health: 18,
    attack: 3,
    speed: 1.8,
    tameLevel: 20,
    tameChance: 0.09,
    diet: ['nuts', 'blueberry', 'apple', 'meat'],
    baitHint: 'nuts or a berry',
    timid: true,
    gathers: 'fletch',
    workRange: 6,
    variants: [
      ['#8c7058', '#dcc8b4'],
      ['#6c6460', '#c8c0b8'],
      ['#9c7c5c', '#e4d0b8'],
      ['#5c5450', '#bcb4ac'],
    ],
    butcher: { meat: 3, feather: 4, leather: 2, bone: 2 },
    tameFail: 'splits the {food} down the middle and leaves it',
    leaves: 'darts off with its crest flat',
  },
  papra: {
    id: 'papra',
    name: 'Papra',
    description: 'A flat, pale creature that folds itself in sheets when it sleeps. Set to work on a settlement it presses the reeds and the buckets of water in your stores into papyrus at your paper presses, and puts the sheets and the empty bucket back in your stores. It never tears a sheet.',
    health: 16,
    attack: 1,
    speed: 1.8,
    tameLevel: 18,
    tameChance: 0.1,
    diet: ['reed', 'mixed_grass', 'apple', 'cabbage'],
    baitHint: 'reeds or grass',
    timid: true,
    gathers: 'paper',
    workRange: 6,
    variants: [
      ['#e4dcc0', '#faf6e8'],
      ['#d8ccac', '#f4ecd8'],
      ['#ece4cc', '#fcfaf0'],
      ['#ccc0a0', '#ece4cc'],
    ],
    butcher: { meat: 2, fur: 2, leather: 2, bone: 1 },
    tameFail: 'presses the {food} flat between its paws and leaves it',
    leaves: 'flutters off like a loose page',
  },
  glossa: {
    id: 'glossa',
    name: 'Glossa',
    description: 'A smooth creature whose hide shines as if it had been fired. Set to work on a settlement it glazes every fired pot, bowl, jar and amphora in your stores with the ash in your stores, after which none of them ever decays, as an Artisan\'s glaze does. It never needs the Artisan\'s learning.',
    health: 22,
    attack: 2,
    speed: 1.8,
    tameLevel: 24,
    tameChance: 0.08,
    diet: ['honey', 'apple', 'nuts', 'blueberry'],
    baitHint: 'honey or an apple',
    timid: true,
    gathers: 'glaze',
    workRange: 6,
    variants: [
      ['#4c7c9c', '#bcd8e8'],
      ['#3c8070', '#b0dccc'],
      ['#8c5c3c', '#e0c4a8'],
      ['#6c6c8c', '#ccccdc'],
    ],
    butcher: { meat: 3, scale: 3, leather: 2, bone: 2 },
    tameFail: 'licks the {food} until it shines and leaves it',
    leaves: 'slides off with a gleam',
  },
  dippa: {
    id: 'dippa',
    name: 'Dippa',
    description: 'A plump, web-footed creature with a deep pouch of a chin. Set to work on a settlement it takes the empty buckets out of your stores, fills them with water at the shore or out of a well, and puts them back in your stores full. It never spills a drop.',
    health: 22,
    attack: 2,
    speed: 1.8,
    tameLevel: 6,
    tameChance: 0.14,
    diet: ['mixed_grass', 'reed', 'carrot', 'cabbage'],
    baitHint: 'grass or reeds',
    timid: true,
    gathers: 'fill',
    workRange: 8,
    variants: [
      ['#6c94a4', '#c8dce4'],
      ['#5c8494', '#bcd0dc'],
      ['#7ca0ac', '#d4e4ec'],
      ['#4c7484', '#acc4d0'],
    ],
    butcher: { meat: 4, fur: 2, leather: 3, bone: 2 },
    tameFail: 'dunks the {food} in a puddle and leaves it',
    leaves: 'waddles off toward the water',
  },
  testa: {
    id: 'testa',
    name: 'Testa',
    description: `A broad, low creature under a domed shell, slow and very hard to put down. Tamed, ${STYLE_SAYS.shield}, and it guards you unless you tell it otherwise.`,
    health: 80,
    attack: 3,
    speed: 1.4,
    tameLevel: 26,
    tameChance: 0.07,
    diet: ['meat', 'cooked_meat', 'cabbage'],
    baitHint: 'meat or a cabbage',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#7c6a4c', '#d8c8a4'],
      ['#6a6458', '#ccc4b4'],
      ['#84704c', '#e0cca0'],
      ['#5c5444', '#bcb09c'],
    ],
    butcher: { meat: 6, scale: 4, leather: 3, bone: 4 },
    tameFail: 'draws its head in over the {food} and does not come out',
    leaves: 'plods off with its head held low',
    hide: 'shell',
    defensive: true,
    defaultStance: 'guard',
    style: 'shield',
  },
  skulka: {
    id: 'skulka',
    name: 'Skulka',
    description: `A low, long-bodied creature that slips round behind whatever it is fighting. Tamed, ${STYLE_SAYS.flank}.`,
    health: 30,
    attack: 8,
    speed: 2.2,
    tameLevel: 24,
    tameChance: 0.07,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#4c4844', '#a8a098'],
      ['#5c4c3c', '#b8a48c'],
      ['#3c4044', '#9ca4a8'],
      ['#64584c', '#c4b8a8'],
    ],
    butcher: { meat: 4, fur: 4, leather: 3, bone: 3 },
    tameFail: 'snatches the {food} and is behind you before you see it go',
    leaves: 'slinks off along the nearest shadow',
    wound: 'bite',
    defensive: true,
    style: 'flank',
  },
  gasha: {
    id: 'gasha',
    name: 'Gasha',
    description: `A wiry, rust-red creature with a mouthful of hooked teeth. Tamed, ${STYLE_SAYS.bleed}.`,
    health: 28,
    attack: 7,
    speed: 2.0,
    tameLevel: 22,
    tameChance: 0.08,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#9c4c34', '#e0a890'],
      ['#8c3c2c', '#d49480'],
      ['#a8583c', '#ecb49c'],
      ['#743424', '#c48470'],
    ],
    butcher: { meat: 4, fur: 3, leather: 3, bone: 3, tusk: 1 },
    tameFail: 'tears the {food} to strips and leaves them',
    leaves: 'lopes off licking its teeth',
    wound: 'cut',
    defensive: true,
    style: 'bleed',
  },
  thumpa: {
    id: 'thumpa',
    name: 'Thumpa',
    description: `A heavy-shouldered creature with a club of a tail. Tamed, ${STYLE_SAYS.stun}.`,
    health: 44,
    attack: 9,
    speed: 1.6,
    tameLevel: 28,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat', 'potato'],
    baitHint: 'meat or a potato',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#6c5c4c', '#c8b8a4'],
      ['#5c5c54', '#bcbcb0'],
      ['#7c644c', '#d8c0a0'],
      ['#4c4840', '#aca89c'],
    ],
    butcher: { meat: 6, fur: 3, leather: 4, bone: 5 },
    tameFail: 'flattens the {food} with its tail and walks off',
    leaves: 'stamps off shaking the ground',
    wound: 'crush',
    defensive: true,
    style: 'stun',
  },
  spitta: {
    id: 'spitta',
    name: 'Spitta',
    description: `A slim, bright-banded creature with a forked tongue. Wild, its bite leaves venom in you. Tamed, ${STYLE_SAYS.venom}.`,
    health: 24,
    attack: 6,
    speed: 2.0,
    tameLevel: 26,
    tameChance: 0.07,
    diet: ['meat', 'cooked_meat', 'perch'],
    baitHint: 'meat or a fish',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#5c8c3c', '#d4e0a0'],
      ['#8c8c2c', '#e8e4a0'],
      ['#3c7c5c', '#b4dcc4'],
      ['#7c5c2c', '#dcc49c'],
    ],
    butcher: { meat: 3, scale: 4, leather: 2, bone: 2, gland: 2 },
    tameFail: 'tastes the {food} with its tongue and leaves it',
    leaves: 'slides off through the grass',
    wound: 'pierce',
    defensive: true,
    venom: true,
    style: 'venom',
  },
  awla: {
    id: 'awla',
    name: 'Awla',
    description: `A narrow-headed creature with a horn like an awl. Tamed, ${STYLE_SAYS.bore}.`,
    health: 30,
    attack: 8,
    speed: 1.9,
    tameLevel: 24,
    tameChance: 0.07,
    diet: ['meat', 'cooked_meat', 'nuts'],
    baitHint: 'meat or nuts',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#8c7c64', '#dcd0bc'],
      ['#7c6c5c', '#d0c4b4'],
      ['#948468', '#e4d8c0'],
      ['#6c6050', '#c4b8a4'],
    ],
    butcher: { meat: 4, fur: 2, leather: 3, bone: 3, tusk: 1 },
    tameFail: 'spears the {food} on its horn and shakes it off',
    leaves: 'trots off with its horn down',
    wound: 'pierce',
    defensive: true,
    style: 'bore',
  },
  sparra: {
    id: 'sparra',
    name: 'Sparra',
    description: `A sturdy, good-natured creature that circles anyone it likes with its fists up. Tamed, ${STYLE_SAYS.spar}.`,
    health: 60,
    attack: 2,
    speed: 1.9,
    tameLevel: 6,
    tameChance: 0.12,
    diet: ['apple', 'carrot', 'bread', 'nuts'],
    baitHint: 'an apple or bread',
    timid: true,
    gathers: null,
    workRange: 0,
    variants: [
      ['#c49c74', '#f0dcc4'],
      ['#b48c64', '#e8d0b4'],
      ['#cca884', '#f4e4cc'],
      ['#a07c58', '#dcc4a8'],
    ],
    butcher: { meat: 5, fur: 3, leather: 3, bone: 3 },
    tameFail: 'boxes the {food} out of your hand and grins',
    leaves: 'bounces off with its fists still up',
    wound: 'crush',
    style: 'spar',
    learns: { skill: 'fighting', by: 'spar' },
  },
  lungra: {
    id: 'lungra',
    name: 'Lungra',
    description: `A long-legged, deep-chested creature that never runs at anything when it can jump at it. Tamed, ${abilitySays('beastmaster_pounce')}.`,
    health: 30,
    attack: 8,
    speed: 2.3,
    tameLevel: 24,
    tameChance: 0.07,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#8c6c4c', '#e0c8a8'],
      ['#7c5c40', '#d4b898'],
      ['#9c7c58', '#ecd4b4'],
      ['#6c5038', '#c8ac8c'],
    ],
    butcher: { meat: 5, fur: 3, leather: 3, bone: 3 },
    tameFail: 'leaps on the {food} and is gone with it',
    leaves: 'bounds off in great leaps',
    wound: 'bite',
    defensive: true,
    ability: 'beastmaster_pounce',
  },
  hamma: {
    id: 'hamma',
    name: 'Hamma',
    description: `A low, quick creature that goes for the back of the leg and nothing else. Tamed, ${abilitySays('blade_hamstring')}.`,
    health: 28,
    attack: 7,
    speed: 2.2,
    tameLevel: 22,
    tameChance: 0.08,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#6c6458', '#c8c0b0'],
      ['#5c544c', '#b8b0a4'],
      ['#7c7060', '#d4c8b8'],
      ['#4c4844', '#aca8a0'],
    ],
    butcher: { meat: 4, fur: 3, leather: 3, bone: 3 },
    tameFail: 'nips the {food} at the heel and leaves it',
    leaves: 'slips off low through the grass',
    wound: 'cut',
    defensive: true,
    ability: 'blade_hamstring',
  },
  crakka: {
    id: 'crakka',
    name: 'Crakka',
    description: `A heavy-browed creature with a skull like a boulder, which it uses. Tamed, ${abilitySays('berserker_skull_crack')}.`,
    health: 40,
    attack: 9,
    speed: 1.7,
    tameLevel: 28,
    tameChance: 0.06,
    diet: ['meat', 'potato'],
    baitHint: 'meat or a potato',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#7c7064', '#d4cbc0'],
      ['#6c6c68', '#c4c4c0'],
      ['#8c7c68', '#e0d4c0'],
      ['#5c5650', '#b4ada4'],
    ],
    butcher: { meat: 6, fur: 3, leather: 4, bone: 5 },
    tameFail: 'butts the {food} across the ground and leaves it',
    leaves: 'plods off rubbing its brow on a stone',
    wound: 'crush',
    defensive: true,
    ability: 'berserker_skull_crack',
  },
  bashka: {
    id: 'bashka',
    name: 'Bashka',
    description: `A broad creature with a flat plate of bone across its forehead. Tamed, ${abilitySays('blade_shield_bash')}.`,
    health: 38,
    attack: 8,
    speed: 1.7,
    tameLevel: 26,
    tameChance: 0.07,
    diet: ['meat', 'cabbage'],
    baitHint: 'meat or a cabbage',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#8c8478', '#dcd4c8'],
      ['#7c746c', '#ccc4bc'],
      ['#948c7c', '#e4dcd0'],
      ['#6c6460', '#bcb4ac'],
    ],
    butcher: { meat: 5, fur: 2, leather: 4, bone: 5 },
    tameFail: 'shoves the {food} away with its plate',
    leaves: 'shoulders its way off through the brush',
    wound: 'crush',
    defensive: true,
    ability: 'blade_shield_bash',
  },
  executa: {
    id: 'executa',
    name: 'Executa',
    description: `A gaunt, patient creature that hangs back until something is nearly finished. Tamed, ${abilitySays('berserker_execute')}.`,
    health: 30,
    attack: 8,
    speed: 2.0,
    tameLevel: 30,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#4c4448', '#a8a0a4'],
      ['#3c3c44', '#9c9ca8'],
      ['#5c4c4c', '#b8a8a8'],
      ['#34343c', '#8c8c98'],
    ],
    butcher: { meat: 4, fur: 4, leather: 3, bone: 3 },
    tameFail: 'watches the {food} until it gives up, then leaves it',
    leaves: 'is simply not there any more',
    wound: 'cut',
    defensive: true,
    ability: 'berserker_execute',
  },
  whirla: {
    id: 'whirla',
    name: 'Whirla',
    description: `A wiry creature with a long whip of a tail it spins about itself. Tamed, ${abilitySays('berserker_whirlwind')}.`,
    health: 32,
    attack: 7,
    speed: 2.1,
    tameLevel: 30,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#a07c50', '#e8d0b0'],
      ['#8c6c44', '#dcc0a0'],
      ['#b08c5c', '#f0dcbc'],
      ['#7c5c3c', '#ccb090'],
    ],
    butcher: { meat: 4, fur: 3, leather: 3, bone: 3 },
    tameFail: 'spins round the {food} three times and leaves it',
    leaves: 'spins off in a cloud of dust',
    wound: 'cut',
    defensive: true,
    ability: 'berserker_whirlwind',
  },
  scorcha: {
    id: 'scorcha',
    name: 'Scorcha',
    description: `A sooty creature that smells of burning and breathes out sparks. Tamed, ${abilitySays('kindler_scorch')}.`,
    health: 30,
    attack: 7,
    speed: 1.9,
    tameLevel: 30,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#5c3c2c', '#d89c6c'],
      ['#4c3428', '#c88c5c'],
      ['#6c4430', '#e4a878'],
      ['#3c2c24', '#b47c50'],
    ],
    butcher: { meat: 4, scale: 3, leather: 3, bone: 3 },
    tameFail: 'chars the {food} black and leaves it',
    leaves: 'trots off trailing a thread of smoke',
    wound: 'burn',
    defensive: true,
    ability: 'kindler_scorch',
  },
  frosta: {
    id: 'frosta',
    name: 'Frosta',
    description: `A pale, thick-furred creature whose breath hangs white in the air even in summer. Tamed, ${abilitySays('frost_breath')}.`,
    health: 32,
    attack: 7,
    speed: 1.9,
    tameLevel: 28,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#c8d8e0', '#f4fcff'],
      ['#b8c8d4', '#ecf4fc'],
      ['#d4e0e8', '#f8fcff'],
      ['#a8b8c8', '#e0ecf4'],
    ],
    butcher: { meat: 4, fur: 5, leather: 3, bone: 3 },
    tameFail: 'breathes on the {food} until it is frozen and leaves it',
    leaves: 'pads off leaving frost in its footprints',
    wound: 'bite',
    defensive: true,
    ability: 'frost_breath',
  },
  rootle: {
    id: 'rootle',
    name: 'Rootle',
    description: `A gnarled, bark-brown creature with tendrils that creep along the ground about it. Tamed, ${abilitySays('binder_root')}.`,
    health: 34,
    attack: 5,
    speed: 1.6,
    tameLevel: 24,
    tameChance: 0.07,
    diet: ['carrot', 'cabbage', 'apple', 'meat'],
    baitHint: 'a vegetable or meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#6c5c3c', '#c8b890'],
      ['#5c4c34', '#b8a880'],
      ['#7c6c44', '#d8c8a0'],
      ['#4c4030', '#a89878'],
    ],
    butcher: { meat: 3, fur: 2, leather: 3, bone: 2 },
    tameFail: 'wraps the {food} in tendrils and leaves it',
    leaves: 'creeps off, its tendrils last to go',
    wound: 'pierce',
    defensive: true,
    ability: 'binder_root',
  },
  dulla: {
    id: 'dulla',
    name: 'Dulla',
    description: `A soft-pawed, grey-blue creature that leaves everything it touches slower and blunter. Tamed, ${abilitySays('binder_dull_claws')}.`,
    health: 30,
    attack: 5,
    speed: 1.8,
    tameLevel: 24,
    tameChance: 0.07,
    diet: ['meat', 'perch'],
    baitHint: 'meat or a fish',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#6c7c8c', '#c8d4e0'],
      ['#5c6c7c', '#b8c4d4'],
      ['#7c8c9c', '#d4e0ec'],
      ['#4c5c6c', '#a8b8c8'],
    ],
    butcher: { meat: 4, fur: 4, leather: 3, bone: 2 },
    tameFail: 'paws the {food} until it is dull and leaves it',
    leaves: 'ambles off unhurried',
    wound: 'bite',
    defensive: true,
    ability: 'binder_dull_claws',
  },
  brittla: {
    id: 'brittla',
    name: 'Brittla',
    description: `A glassy-eyed creature with a cracked, crystalline sheen to its hide. Tamed, ${abilitySays('binder_brittle')}.`,
    health: 28,
    attack: 6,
    speed: 1.9,
    tameLevel: 28,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#8ca4b4', '#dce8f0'],
      ['#7c94a4', '#ccdce8'],
      ['#9cb4c4', '#e4f0f8'],
      ['#6c8494', '#bccce0'],
    ],
    butcher: { meat: 3, scale: 4, leather: 2, bone: 3 },
    tameFail: 'taps the {food} until it cracks and leaves it',
    leaves: 'tinkles off into the long grass',
    wound: 'cut',
    defensive: true,
    ability: 'binder_brittle',
  },
  shova: {
    id: 'shova',
    name: 'Shova',
    description: `A thick-necked creature that shoulders everything out of its way. Tamed, ${abilitySays('pikeman_keep_away')}.`,
    health: 40,
    attack: 7,
    speed: 1.8,
    tameLevel: 24,
    tameChance: 0.07,
    diet: ['meat', 'potato'],
    baitHint: 'meat or a potato',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#7c6448', '#d4bc9c'],
      ['#6c5840', '#c4ac8c'],
      ['#8c7050', '#e0c8a8'],
      ['#5c4c38', '#b49c80'],
    ],
    butcher: { meat: 6, fur: 3, leather: 4, bone: 4 },
    tameFail: 'shoves the {food} back at you and leaves it',
    leaves: 'shoulders off through the herd',
    wound: 'crush',
    defensive: true,
    ability: 'pikeman_keep_away',
  },
  howla: {
    id: 'howla',
    name: 'Howla',
    description: `A shaggy, big-voiced creature whose call carries right across a valley. Tamed, ${abilitySays('blade_guardians_call')}.`,
    health: 44,
    attack: 6,
    speed: 1.8,
    tameLevel: 26,
    tameChance: 0.07,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#5c5450', '#bcb4ac'],
      ['#4c4844', '#aca8a0'],
      ['#6c605c', '#ccc0b8'],
      ['#3c3834', '#9c9890'],
    ],
    butcher: { meat: 6, fur: 5, leather: 4, bone: 4 },
    tameFail: 'howls at the {food} and leaves it',
    leaves: 'lopes off howling',
    wound: 'bite',
    defensive: true,
    ability: 'blade_guardians_call',
  },
  marka: {
    id: 'marka',
    name: 'Marka',
    description: `A sharp-eyed creature that marks what it hunts with a smear of something that will not wash off. Tamed, ${abilitySays('skirmisher_marked_for_death')}.`,
    health: 26,
    attack: 6,
    speed: 2.1,
    tameLevel: 26,
    tameChance: 0.07,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#8c3c3c', '#e4a4a4'],
      ['#7c3434', '#d49494'],
      ['#9c4848', '#ecb4b4'],
      ['#6c2c2c', '#c48484'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2, gland: 1 },
    tameFail: 'smears the {food} red and leaves it',
    leaves: 'slinks off, watching you',
    wound: 'cut',
    defensive: true,
    ability: 'skirmisher_marked_for_death',
  },
  wardo: {
    id: 'wardo',
    name: 'Wardo',
    description: `A calm creature with a faint shimmer about its fur, as if the air near it were thicker. Tamed, ${abilitySays('warder_ward')}.`,
    health: 30,
    attack: 4,
    speed: 1.8,
    tameLevel: 30,
    tameChance: 0.06,
    diet: ['apple', 'honey', 'nuts', 'meat'],
    baitHint: 'an apple or honey',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#c4b8d4', '#f0ecf8'],
      ['#b4a8c4', '#e8e0f0'],
      ['#d0c4e0', '#f8f4fc'],
      ['#a498b4', '#dcd4e8'],
    ],
    butcher: { meat: 3, fur: 4, leather: 2, bone: 2 },
    tameFail: 'holds the {food} in its shimmer and leaves it',
    leaves: 'fades off into the haze',
    wound: 'bite',
    defensive: true,
    ability: 'warder_ward',
  },
  stona: {
    id: 'stona',
    name: 'Stona',
    description: `A squat creature whose hide goes grey and hard as stone when it is struck. Tamed, ${abilitySays('warder_stoneskin')}.`,
    health: 46,
    attack: 6,
    speed: 1.5,
    tameLevel: 26,
    tameChance: 0.07,
    diet: ['meat', 'potato', 'carrot'],
    baitHint: 'meat or a vegetable',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#8c8c84', '#d4d4cc'],
      ['#7c7c78', '#c8c8c0'],
      ['#94948c', '#dcdcd4'],
      ['#6c6c68', '#bcbcb4'],
    ],
    butcher: { meat: 5, scale: 4, leather: 3, bone: 4 },
    tameFail: 'sets like stone over the {food} and leaves it',
    leaves: 'grinds off over the rocks',
    wound: 'crush',
    defensive: true,
    ability: 'warder_stoneskin',
  },
  leecha: {
    id: 'leecha',
    name: 'Leecha',
    description: `A sleek, dark creature with a round sucking mouth. Tamed, ${abilitySays('chirurgeon_leech')}.`,
    health: 28,
    attack: 6,
    speed: 2.0,
    tameLevel: 28,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      ['#3c2c3c', '#a08ca0'],
      ['#2c2c3c', '#8c8ca8'],
      ['#4c3444', '#b098a8'],
      ['#2c242c', '#847484'],
    ],
    butcher: { meat: 3, leather: 4, bone: 2, gland: 2 },
    tameFail: 'drains the {food} dry and leaves it',
    leaves: 'slides off licking its lips',
    wound: 'pierce',
    defensive: true,
    ability: 'chirurgeon_leech',
  },
  // ---- Backs and saddles. ----
  bura: {
    id: 'bura',
    hide: 'thick',
    wound: 'crush',
    name: 'Bura',
    description: 'A broad, slow, endlessly patient creature that was clearly made to have things strapped to it. {pannier:W} things ride on its back, and it neither hurries nor complains.',
    health: 55,
    attack: 6,
    speed: 1.5,
    tameLevel: 22,
    tameChance: 0.09,
    diet: ['mixed_grass', 'wheat', 'corn', 'carrot'],
    baitHint: 'grass or grain',
    timid: false,
    gathers: null,
    workRange: 6,
    variants: [
      ['#9c8a6a', '#ded0b0'],
      ['#7a6a54', '#c0b090'],
      ['#6a6f74', '#b4bcc2'],
      ['#8a6a58', '#cfae99'],
    ],
    butcher: { meat: 14, fur: 4, leather: 9, bone: 10, gland: 1 },
    tameFail: 'accepts the {food}, considers it, and goes back to standing still',
    leaves: 'ambles away at exactly the pace it does everything else',
    defensive: true,
    pannier: 200,
    learns: { skill: 'body_strength', by: 'out' },
  },
  gorral: {
    id: 'gorral',
    wound: 'crush',
    name: 'Gorral',
    description: 'A horned cliff-goat that stands on ground you would not put a ladder against. Under a saddle it goes up what an Orse turns away from, and the more it is worked the worse the ground it will take.',
    health: 44,
    attack: 7,
    speed: 2.4,
    tameLevel: 40,
    tameChance: 0.06,
    diet: ['mixed_grass', 'cabbage', 'acorn', 'carrot'],
    baitHint: 'grass or a root',
    timid: false,
    gathers: null,
    workRange: 6,
    variants: [
      ['#8e8578', '#e2dbcd'],
      ['#5d5751', '#aaa49b'],
      ['#a8865c', '#e6cda4'],
      ['#3f3d3b', '#8a8681'],
    ],
    butcher: { meat: 10, fur: 5, leather: 7, bone: 8, gland: 1 },
    tameFail: 'takes the {food} off the flat of your hand and is four lengths up the rock before you blink',
    leaves: 'goes up the face in three bounds and looks down at you from the top',
    onStone: true,
    defensive: true,
    draught: true,
    mount: 15,
    pitch: 2,
    // A female is milked too, for less than a Cudda gives (`GORRAL_MILK`), and what comes back on it comes back slowly.
    fleece: 1 / 1200,
    milk: true,
  },
  wadd: {
    id: 'wadd',
    wound: 'crush',
    name: 'Wadd',
    description: 'A slick-furred swimmer with webbed feet and a rudder of a tail. It is the one thing on the island that will take a rider across deep water instead of drowning them.',
    health: 40,
    attack: 6,
    speed: 2.2,
    tameLevel: 38,
    tameChance: 0.07,
    diet: ['meat', 'reed', 'nuts'],
    baitHint: 'meat or reeds',
    timid: false,
    variants: [
      ['#4a5a52', '#a8bcae'],
      ['#3c4a58', '#9cb0c0'],
      ['#5f5142', '#c0ab90'],
      ['#2e3a38', '#84968e'],
    ],
    butcher: { meat: 9, fur: 6, leather: 6, bone: 7, gland: 2 },
    tameFail: 'slides the {food} into the water, eats it there, and looks back at you',
    leaves: 'goes into the water without a sound and surfaces a long way out',
    nearWater: true,
    defensive: true,
    draught: true,
    mount: 14,
    swims: true,
    gathers: 'fish',
    workRange: 10,
  },
  shaggan: {
    id: 'shaggan',
    hide: 'thick',
    heavy: true,
    wound: 'crush',
    name: 'Shaggan',
    description: 'A mountain of hair, slower than anything else that pulls and stronger than all of them: in the traces it adds {pull:pct} to its team\'s pace, where most beasts add {pullDefault:pct}.',
    health: 90,
    attack: 12,
    speed: 1,
    tameLevel: 35,
    tameChance: 0.06,
    diet: ['mixed_grass', 'wheat', 'corn', 'cabbage'],
    baitHint: 'grass or grain',
    timid: false,
    gathers: null,
    workRange: 6,
    variants: [
      ['#6b5a44', '#b39a76'],
      ['#4a4038', '#8d8076'],
      ['#8a7050', '#d0b288'],
      ['#585a56', '#a2a49e'],
    ],
    butcher: { meat: 30, fur: 10, leather: 16, bone: 20, gland: 1 },
    tameFail: 'eats the {food}, and the grass around it, and stands there',
    leaves: 'turns and walks into the wind, which is where it was going anyway',
    defensive: true,
    draught: true,
    pull: 0.45,
  },
  // ---- Eyes, produce and the rare sort. ----
  warda: {
    id: 'warda',
    wound: 'cut',
    name: 'Warda',
    description: 'A tall, still, long-sighted thing that picks the highest ground it can find and watches from it. Nothing comes near a settlement with one of these on the hill without you knowing.',
    health: 30,
    attack: 5,
    speed: 1.9,
    tameLevel: 30,
    tameChance: 0.08,
    diet: ['meat', 'nuts', 'acorn'],
    baitHint: 'meat or nuts',
    timid: false,
    gathers: null,
    workRange: 8,
    variants: [
      ['#7d7a72', '#d6d2c6'],
      ['#5a6470', '#b0bac6'],
      ['#8a7256', '#d9c19c'],
      ['#43474a', '#93989c'],
    ],
    butcher: { meat: 4, feather: 5, leather: 2, bone: 3, gland: 1 },
    tameFail: 'takes the {food} without once taking its eyes off the horizon',
    leaves: 'lifts, circles once to see everything, and is a speck',
    defensive: true,
    sight: 18,
    learns: { skill: 'awareness', by: 'out' },
  },
  quill: {
    id: 'quill',
    wound: 'pierce',
    name: 'Quill',
    description: 'A heavy ground-bird that would rather run than fly and would rather eat than run. Its long wing feathers grow back as fast as you can take them, which is what keeps an archer in arrows.',
    health: 26,
    attack: 4,
    speed: 1.9,
    tameLevel: 12,
    tameChance: 0.11,
    diet: ['wheat', 'corn', 'nuts', 'acorn'],
    baitHint: 'grain or nuts',
    timid: true,
    gathers: null,
    workRange: 6,
    variants: [
      ['#8a6a44', '#e0c08a'],
      ['#6a5a4a', '#c2ae94'],
      ['#96585a', '#e2a8a4'],
      ['#4f5a44', '#a8b894'],
    ],
    butcher: { meat: 5, feather: 8, leather: 2, bone: 3 },
    tameFail: 'bolts with the {food} and eats it at a safe distance, watching you',
    leaves: 'runs off with its neck out, going faster than looks possible',
    fleece: 1 / 700,
    shearYield: 'feather',
    learns: { skill: 'animal_husbandry', by: 'tended' },
  },
  cudda: {
    id: 'cudda',
    wound: 'crush',
    name: 'Cudda',
    description: 'A placid, deep-bellied grazer that chews whatever it is given and gives milk back for it. Bring a bucket.',
    health: 48,
    attack: 4,
    speed: 1.2,
    tameLevel: 14,
    tameChance: 0.12,
    diet: ['mixed_grass', 'cabbage', 'carrot', 'wheat'],
    baitHint: 'grass, grain or a root',
    timid: true,
    gathers: null,
    workRange: 6,
    variants: [
      ['#a89880', '#eee3cf'],
      ['#7d6a58', '#c8b49a'],
      ['#5e5a55', '#aaa49c'],
      ['#b0705a', '#e8bfa6'],
    ],
    butcher: { meat: 18, fur: 4, leather: 10, bone: 12, gland: 1 },
    tameFail: 'chews the {food} at you for a while and then chews something else',
    leaves: 'walks to the far side of the field and carries on chewing',
    fleece: 1 / 600,
    milk: true,
    learns: { skill: 'animal_husbandry', by: 'tended' },
  },
  vesp: {
    id: 'vesp',
    wound: 'pierce',
    venom: true,
    name: 'Vesp',
    description: 'Not one creature so much as a small furious cloud of them, which settles where there are flowers. Give the swarm a hive on your deed and it will fill it with honey and wax and defend it from anything foolish.',
    health: 12,
    attack: 3,
    speed: 2.4,
    tameLevel: 18,
    tameChance: 0.1,
    diet: ['blueberry', 'raspberry', 'strawberry', 'honey'],
    baitHint: 'berries or honey',
    timid: false,
    // Its trade: set to work the deed, it tends the hives there (asked: "vesp should work beehives as their trade").
    gathers: 'hive',
    workRange: 8,
    variants: [
      ['#c8a03a', '#3a3128'],
      ['#a8862e', '#2e2820'],
      ['#d8b858', '#4a3f30'],
      ['#8a6a24', '#241f18'],
    ],
    butcher: { meat: 1, gland: 3 },
    tameFail: 'lifts off the {food} in a body, hangs in the air a moment, and settles again',
    leaves: 'rises all at once and pours away over the hedge',
    defensive: true,
    hives: true,
  },
  snout: {
    id: 'snout',
    name: 'Snout',
    description: 'Wrinkled, half blind, and the finest nose on the island. It smells what is under the ground, and what is under the ground on this island is other people\'s lives.',
    health: 24,
    attack: 4,
    speed: 1.6,
    tameLevel: 50,
    tameChance: 0.05,
    diet: ['meat', 'nuts', 'gland', 'cooked_meat'],
    baitHint: 'meat or nuts',
    timid: false,
    gathers: 'seek',
    workRange: 10,
    rangePerStep: 12,
    variants: [
      ['#8a7a6a', '#d8c8b4'],
      ['#6a5a50', '#b6a294'],
      ['#a08878', '#e6d2c0'],
      ['#4f4844', '#98908a'],
    ],
    butcher: { meat: 4, fur: 3, leather: 3, bone: 3, gland: 3 },
    tameFail: 'works its way over the {food}, over your boots, and over the ground you are standing on',
    leaves: 'follows its nose away and is not seen again',
  },
  lume: {
    id: 'lume',
    wound: 'burn',
    name: 'Lume',
    description: 'A pale slow drifter that is only ever out after dark, and glows with a light that has nothing to do with fire. Keep one and it lights {glow:w} tiles round itself however dark the night.',
    health: 10,
    attack: 1,
    speed: 1.3,
    tameLevel: 55,
    tameChance: 0.05,
    diet: ['gland', 'nuts', 'honey'],
    baitHint: 'a gland or something sweet',
    timid: true,
    gathers: null,
    workRange: 6,
    variants: [
      ['#dfe6c8', '#f6f8e6'],
      ['#c8e0e6', '#e8f6f8'],
      ['#e6d6c0', '#f8efdd'],
      ['#d0c8e6', '#eee8f8'],
    ],
    butcher: { meat: 1, gland: 4 },
    tameFail: 'drifts around the {food} twice, dims, and drifts away',
    leaves: 'goes out like a blown candle and is not there when the light comes back',
    glow: 8,
    nocturnal: true,
    learns: { skill: 'awareness', by: 'dark' },
  },

  // ---- The things that are not wildermon ----
  //
  // Nothing below this line can be tamed, trapped, bred or brushed. They are
  // rare, they notice you from further off than anything else, they hit hard
  // enough to matter, and every one of them is carrying something you cannot
  // get any other way.
  goblin: {
    id: 'goblin',
    monster: true,
    notice: 11,
    wound: 'cut',
    name: 'Goblin',
    description: 'Knee-high, green-grey and entirely malice, in a jerkin of somebody else\u2019s leather with a notched blade it did not make. The commonest of the bad things, and the only one a careful beginner survives meeting.',
    health: 40,
    attack: 14,
    speed: 2.3,
    tameLevel: 999,
    tameChance: 0,
    diet: [],
    baitHint: 'nothing you would offer it',
    timid: false,
    gathers: null,
    workRange: 0,
    variants: [
      ['#6f7f52', '#c3cf9e'],
      ['#5d6d48', '#aab98a'],
      ['#7c8a5e', '#d0daa9'],
    ],
    butcher: { meat: 2, leather: 3, bone: 4, sinew: 2 },
    tameFail: 'spits at your hand',
    leaves: 'slinks off into the undergrowth',
    hunter: true,
    pack: true,
    throws: true,
    coward: true,
    defensive: true,
    defaultStance: 'aggressive',
  },
  orc: {
    id: 'orc',
    heavy: true,
    monster: true,
    notice: 13,
    wound: 'cut',
    name: 'Orc',
    description: 'A head taller than you, grey-skinned, tusked, and carrying iron it took the trouble to sharpen. Orcs come down out of the high ground in ones and twos and they do not run from anything.',
    health: 95,
    attack: 22,
    speed: 2.5,
    tameLevel: 999,
    tameChance: 0,
    diet: [],
    baitHint: 'nothing you would offer it',
    timid: false,
    gathers: null,
    workRange: 0,
    variants: [
      ['#5f6a63', '#b3bcb2'],
      ['#4d5851', '#9aa49b'],
      ['#6d7a6f', '#c2cbc0'],
    ],
    butcher: { meat: 5, leather: 6, bone: 7, sinew: 4, tusk: 2 },
    tameFail: 'laughs at you',
    leaves: 'turns and walks away without hurrying',
    hunter: true,
    pack: true,
    defensive: true,
    defaultStance: 'aggressive',
  },
  ogre: {
    id: 'ogre',
    hide: 'thick',
    heavy: true,
    monster: true,
    notice: 12,
    wound: 'crush',
    name: 'Ogre',
    description: 'A hill of shoulder with a tree in one fist and very little behind the eyes. It is slow, it is stupid, and if it gets a hand on you none of that matters.',
    health: 170,
    attack: 34,
    speed: 1.8,
    tameLevel: 999,
    tameChance: 0,
    diet: [],
    baitHint: 'nothing you would offer it',
    timid: false,
    gathers: null,
    workRange: 0,
    variants: [
      ['#8a7358', '#d8c4a4'],
      ['#6f5c47', '#bda88a'],
      ['#9a8464', '#e4d3b3'],
    ],
    butcher: { meat: 14, leather: 10, bone: 14, sinew: 8, tusk: 4, gland: 2 },
    tameFail: 'looks at the {food}, then at you',
    leaves: 'lumbers off, flattening everything in its way',
    hunter: true,
    defensive: true,
    defaultStance: 'aggressive',
  },
  dragon: {
    id: 'dragon',
    hide: 'scaled',
    heavy: true,
    monster: true,
    notice: 20,
    wound: 'burn',
    name: 'Dragon',
    description: 'There is one. Nobody agrees where, everybody agrees it is real, and the few who have seen it and come back describe the same thing: scales like roof slates, a smell of hot metal, and the ground going by underneath very fast.',
    health: 700,
    attack: 70,
    speed: 2.9,
    tameLevel: 999,
    tameChance: 0,
    diet: [],
    baitHint: 'nothing in the world',
    timid: false,
    gathers: null,
    workRange: 0,
    variants: [
      ['#7a3b3b', '#d98a4a'],
      ['#3b4f7a', '#5a9ad9'],
      ['#3f6b46', '#7fd07f'],
      ['#4a3f5f', '#a98ad9'],
    ],
    butcher: { meat: 40, leather: 24, bone: 30, sinew: 20, scale: 24, gland: 6, hoard: 1 },
    tameFail: 'does not appear to have noticed',
    leaves: 'is simply not there any more',
    hunter: true,
    defensive: true,
    glow: 5,
    defaultStance: 'aggressive',
  },
};

/** A beast's share of a team's pull when it was not bred for the traces. */
export const PULL_DEFAULT = 0.25;
// A species says what it carries and pulls off its own row.
for (const s of Object.values(SPECIES)) {
  s.description = fill(s.description, {
    ...s, pullDefault: PULL_DEFAULT, careWanting: CARE_WANTING, dairyFull: DAIRY_FULL, healBelow: HEAL_BELOW,
    grassPerCut: GRASS_PER_CUT, mossPerCut: MOSS_PER_CUT, panLeast: PAN_FIND[0], panMost: PAN_FIND[1], skillTop: SKILL_TOP, resinTapped: RESIN_TAPPED,
  });
}

/** Which species roam wild, by weight. */
/**
 * The bad things, and how often one of the wild's slots turns out to be one.
 * A goblin is a bad afternoon; a dragon is something almost nobody sees.
 */
export const MONSTERS: Array<[string, number]> = [
  ['goblin', 60],
  ['orc', 26],
  ['ogre', 12],
  ['dragon', 2],
];
/** The share of everything that stands up out there that is a monster. */
export const MONSTER_SHARE = 0.022;
/** How many of each may be walking about at once, across the whole island. */
export const MONSTER_CAP: Record<string, number> = { goblin: 6, orc: 3, ogre: 2, dragon: 1 };
/** How far from a settlement's token each keeps, in tiles: the bigger the thing, the further out. */
export const MONSTER_KEEP_OFF: Record<string, number> = { goblin: 26, orc: 40, ogre: 55, dragon: 90 };

export const WILD_SPECIES: Array<[string, number]> = [
  ['rabba', 27],
  ['vola', 23],
  ['bevere', 15],
  ['seavic', 15],
  ['mola', 10],
  ['crawler', 10],
  ['noot', 10],
  ['woola', 12],
  ['magga', 10],
  ['quarra', 8],
  ['embra', 6],
  ['ulva', 6],
  ['roxxen', 9],
  ['orse', 9],
  ['rowl', 5],
  ['middun', 9],
  ['quill', 9],
  ['cudda', 9],
  ['sedra', 8],
  ['sappa', 8],
  ['snedda', 5],
  ['grubba', 5],
  ['plucka', 5],
  ['bogga', 6],
  ['holla', 6],
  ['cobbe', 6],
  ['bura', 6],
  ['vesp', 6],
  ['dowse', 5],
  ['warda', 5],
  ['tinka', 4],
  ['gorral', 4],
  ['wadd', 4],
  ['shaggan', 4],
  ['snout', 2],
  ['lume', 2],
  ['kemma', 6],
  ['sheela', 5],
  ['salva', 4],
  ['carra', 4],
  ['tanna', 5],
  ['grista', 5],
  ['wicka', 3],
  ['brambo', 6],
  ['grazza', 7],
  ['siffa', 5],
  ['forga', 4],
  ['potta', 5],
  ['cindra', 4],
  ['hoppa', 5],
  ['simma', 5],
  ['relka', 3],
  ['bedda', 5],
  ['wurla', 6],
  ['sprigga', 5],
  ['ambra', 4],
  ['petta', 6],
  ['scurra', 4],
  ['rippa', 5],
  ['chissa', 5],
  ['mudda', 6],
  ['cordra', 5],
  ['flecha', 4],
  ['papra', 4],
  ['glossa', 3],
  ['dippa', 6],
  ['testa', 3],
  ['skulka', 3],
  ['gasha', 3],
  ['thumpa', 3],
  ['spitta', 3],
  ['awla', 3],
  ['sparra', 4],
  ['lungra', 2],
  ['hamma', 2],
  ['crakka', 2],
  ['bashka', 2],
  ['executa', 2],
  ['whirla', 2],
  ['scorcha', 2],
  ['frosta', 2],
  ['rootle', 2],
  ['dulla', 2],
  ['brittla', 2],
  ['shova', 2],
  ['howla', 2],
  ['marka', 2],
  ['wardo', 2],
  ['stona', 2],
  ['leecha', 2],
];

/** How far off a hunter picks up your scent, and how far you must get to lose it. */
export const HUNT_SIGHT = 7;
const HUNT_GIVE_UP = 13;

/**
 * How far a hunter will come from where it first had your scent, in tiles.
 *
 * Reported as being chased until you are dead, and that is exactly what
 * happened: the only thing that called a hunt off was the gap between hunter
 * and hunted, and a hunter runs at `speed * 1.15` — so the gap it was measured
 * against was a gap it was closing. Outrunning one was the only way to lose
 * it, and most things on this island are faster than a body carrying a pack.
 *
 * So the leash is tied where the chase *began* instead. Thirty tiles is a
 * screen and a half: far enough that a goblin is worth running from and not a
 * formality, short enough that running works.
 */
export const HUNT_LEASH = 30;

/**
 * And how far from its own home ground it will go while hunting.
 *
 * The leash above is tied where a chase began, which is the right measure for
 * a hunter you walked in on and the wrong one for a hunter that had already
 * wandered halfway to the next valley — that one would take you thirty tiles
 * further still, which is sixty tiles of country between it and anywhere it
 * has any business being.
 *
 * Both are asked, and the first to run out ends it. So a hunter met at its
 * den chases you the full thirty as it always did, and one met at the edge of
 * its range gives up in a dozen, because it is already nearly as far from
 * home as it is willing to be. A dozen over the range is deliberate: a bound
 * exactly at the range would have a hunter at the edge turn back before it
 * had gone anywhere, which is not a hunter at all.
 */
export const HUNT_HOME = WILD_RANGE + 12;

/**
 * And how long it wants nothing to do with hunting after it gives one up.
 *
 * Without this it drops the chase at the end of the leash, notices you again
 * on the next breath because you are still within its sight, and the leash is
 * measured afresh from there — which is the same endless chase with a stutter
 * in it.
 */
export const HUNT_REST = world(60);
/** Fuel in a hearth above which a stoker leaves it alone: ten minutes' worth. */
const HEARTH_FULL = 600;
/** A deed worker goes looking for a meal once its belly is down to this. */
export const HUNGRY = 0.25;

/**
 * How close to open water a water-bound species will settle, and to the
 * trees, the clay or the black ground the others want. Exported for the field
 * guide, which says so in tiles.
 */
export const WATER_RANGE = 4;

/** Whether open water lies within a few tiles of here. */
/** The hive standing on a tile, if one does: where a vesp set to tend the hives goes to work. The island's `worker_gatherable` asks the same. */
/** The trellis standing on a tile with its vine ripe (`vineStage`), if one does: where a brambo goes to pick grapes. The island's `worker_gatherable` asks the same. */
export function ripeTrellisAt(game: Game, x: number, y: number): PlacedFurniture | undefined {
  for (const f of game.furniture.values()) {
    if (isTrellis(f) && Math.floor(f.x) === x && Math.floor(f.y) === y && vineStage(f, game.wallNow()) === 'ripe') return f;
  }
  return undefined;
}

/** The hive standing on a tile, if one does: where a vesp set to tend the hives goes to work. The island's `worker_gatherable` asks the same. */
export function hiveAt(game: Game, x: number, y: number): PlacedFurniture | undefined {
  for (const f of game.furniture.values()) if (f.kind === 'hive' && f.x === x && f.y === y) return f;
  return undefined;
}

export function nearWater(game: Game, x: number, y: number, range = WATER_RANGE): boolean {
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (game.world.inBounds(x + dx, y + dy) && game.world.hasWater(x + dx, y + dy)) return true;
    }
  }
  return false;
}

/** Whether there is clay to work within a few tiles of here. */
export function nearClay(game: Game, x: number, y: number, range = WATER_RANGE): boolean {
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (game.world.inBounds(x + dx, y + dy) && game.world.getTile(x + dx, y + dy) === TileType.Clay) return true;
    }
  }
  return false;
}

/** Whether there is black burnable ground — tar, peat or the marsh they sit in — nearby. */
export function nearTar(game: Game, x: number, y: number, range = WATER_RANGE): boolean {
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const t = game.world.inBounds(x + dx, y + dy) ? game.world.getTile(x + dx, y + dy) : null;
      if (t === TileType.Tar || t === TileType.Peat || t === TileType.Marsh) return true;
    }
  }
  return false;
}

/** Whether there are trees to live in within a few tiles of here. */
export function nearTrees(game: Game, x: number, y: number, range = WATER_RANGE): boolean {
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (game.world.inBounds(x + dx, y + dy) && game.world.getTile(x + dx, y + dy) === TileType.Tree) return true;
    }
  }
  return false;
}

export const isBaitFor = (species: SpeciesDef, itemId: string): boolean => species.diet.includes(itemId);
/**
 * What a working wildermon may help itself to out of a store on the deed.
 *
 * Its own diet, and then the two things that are somebody's: a locked thing,
 * because locking is how a person says *not this one, not the next thing the
 * game reaches for*, and a thing with a price on it, because that is stock on
 * a stall and not lunch. The island adds post in a mailbox and goods promised
 * in a deal to that list, which this side does not model.
 */
export const mayEat = (species: SpeciesDef, item: Item): boolean =>
  isBaitFor(species, item.id) && !item.locked && item.price === undefined;
/** What a wild one does to feed itself; felling trees puts no food in its belly. */
/** The jobs that are errands rather than a walk out for a load of something. */
const ERRAND_JOBS = new Set<GatherKind>(['water', 'hod', 'mend', 'plant', 'prospect', 'compost', ...TEND_JOBS]);
const INDOOR_JOBS = new Set<GatherKind>(['woodcut', 'farm', 'mine', 'sand', 'clay', 'quarry', 'stoke', 'fetch', 'guard', 'hunt', 'water', 'prospect', 'plant', 'hod', 'mend', 'compost', 'seek', 'prune', 'stump', ...TEND_JOBS, 'bush', 'grass', 'pan', 'worm', 'sprout', 'resin', 'flower', 'scrub']);
export const wildGather = (species: SpeciesDef): GatherKind | null => (species.gathers && INDOOR_JOBS.has(species.gathers) ? 'forage' : species.gathers);
/** The task skill a species trains, if it has a job. */
export const workSkill = (species: SpeciesDef): string | null => (species.gathers ? GATHER_SKILL[species.gathers] : null);
/** Every ten levels of its task skill let a worker range ten tiles further from the token. */
export const SKILL_STEP = 10;
export const RANGE_PER_STEP = 10;
export const rangeSteps = (skill: number): number => Math.floor(skill / SKILL_STEP);
/** A worker's task skill, or 0 for a species with no job. */
export function taskSkill(c: Creature, species: SpeciesDef): number {
  const id = workSkill(species);
  return id ? (c.skills[id] ?? 1) : 0;
}
// A Snufflet's words and its stages', now that every number they read is here.
SPECIES.rabba.description = snuffSays(0);
SPECIES.rabba.stages = [{ name: 'Snuffroot', description: snuffSays(1) }, { name: 'Snuffthorn', description: snuffSays(2) }];

/** How far from the token this worker may range right now. */
export function workRangeOf(c: Creature, species: SpeciesDef): number {
  const earned = species.workRange + rangeSteps(taskSkill(c, species)) * (species.rangePerStep ?? RANGE_PER_STEP);
  return Math.round(earned * bloodMul(c, 'range'));
}

/**
 * Where a worker takes its orders from: a settlement, or a work post standing
 * in for one. A deed lets a worker range as far as it has earned; a post is a
 * work site rather than a settlement, and holds it to the post's own reach
 * however much the creature has learned.
 */
export interface WorkSite {
  x: number;
  y: number;
  radius: number;
  /** Set when the site is a post rather than the settlement. */
  post?: number;
}

/** How far this worker ranges from this site. */
export const siteRange = (c: Creature, species: SpeciesDef, site: WorkSite): number =>
  site.post !== undefined ? Math.min(workRangeOf(c, species), site.radius) : workRangeOf(c, species);
/** Fresh task skills for a species. */
const startSkills = (species: SpeciesDef): Record<string, number> => {
  const id = workSkill(species);
  const skills: Record<string, number> = id ? { [id]: 1 } : {};
  // A kind with no trade learns its own (`LearnsBy`).
  if (species.learns) skills[species.learns.skill] = 1;
  // A beast bred to pull starts knowing nothing about hills and learns in the
  // traces, which is what decides the pace of everything it is put in front of.
  if (species.draught) skills[HAUL_SKILL] = 1;
  return skills;
};

/**
 * Age. Everything alive on the island was born at some hour and gets older
 * from there. A young one is small, quick to trust and no use in the traces;
 * a grown one is what the numbers in the book describe; an old one has slowed
 * down and put on weight, which is bad for a cart and good for a butcher.
 */
export type Age = 'young' | 'grown' | 'old';
/** Seconds of real time spent young, and the hour it turns old. */
export const YOUNG_FOR = world(60 * 60);
export const OLD_AT = world(6 * 60 * 60);
/** How long a dam carries: half an island day. */
export const GESTATION = world(12 * 60);
/** How long after a covering either parent will look at another. */
export const BREED_REST = world(20 * 60);

export interface AgeDef {
  id: Age;
  name: string;
  /** Multiplier on how fast it moves, in the traces and under a rider alike. */
  speed: number;
  /** Multiplier on its share of a team's pull. */
  pull: number;
  /** Multiplier on what the carcass is worth. */
  yield: number;
  /** Multiplier on how fast fleece grows back and milk comes in. */
  growth: number;
  /** How much of its full size it is drawn at. */
  scale: number;
  /** Taming is easier on something that has not learned to mistrust you. */
  tame: number;
  /** Old enough to be worked, ridden or put in the traces. */
  works: boolean;
}

export const AGES: Record<Age, AgeDef> = {
  young: { id: 'young', name: 'young', speed: 0.8, pull: 0.4, yield: 0.4, growth: 0, scale: 0.62, tame: 1.6, works: false },
  grown: { id: 'grown', name: 'grown', speed: 1, pull: 1, yield: 1, growth: 1, scale: 1, tame: 1, works: true },
  old: { id: 'old', name: 'old', speed: 0.85, pull: 0.8, yield: 1.35, growth: 0.6, scale: 1.12, tame: 0.8, works: true },
};

/**
 * What your own perks make of keeping a beast, offline: set from the fold
 * whenever it changes (`Game.setPerks`), and read for every beast that is not
 * wild when the island has not said otherwise.
 */
let LOCAL_KEPT: Record<string, number> = {};
export const setLocalKept = (fx: Record<string, number>): void => {
  LOCAL_KEPT = Object.fromEntries(Object.entries(fx).filter(([k]) => k.startsWith('kept:')));
};
/**
 * One of its keeper's numbers for keeping it: what the island stamped on it,
 * or offline your own; the rule's own number for a wild one or a keeper
 * without the perk. The island's `kept`.
 */
export const keptOf = (c: { mode: CreatureMode; kept?: Record<string, number> | null }, key: string, dflt: number): number => {
  if (c.kept !== undefined) return c.kept?.[key] ?? dflt;
  return c.mode === 'wild' ? dflt : LOCAL_KEPT[key] ?? dflt;
};

/** The channels a Beastmaster's passives move, and the keeper's number for each: Thick Hide, Hardy Stock, Fleet and Quick Paws. */
const COMPANION_KEPT: Partial<Record<TraitChannel, string>> = { hardy: 'kept:hardy', soak: 'kept:soak', speed: 'kept:speed', haste: 'kept:haste' };
/**
 * What its keeper's trade makes of a companion on one channel, while it
 * follows its keeper and only then: one in a crate or on a deed is a beast
 * like any other. The island's `beast_mul` asks the same of `kept`.
 */
export const companionMul = (c: { mode: CreatureMode; kept?: Record<string, number> | null }, channel: TraitChannel): number => {
  const key = COMPANION_KEPT[channel];
  return key !== undefined && c.mode === 'active' ? keptOf(c, key, 1) : 1;
};

/**
 * How old a creature is now. Its keeper's Long-lived keeps it grown longer,
 * and their Kin (Love's) ages it slower through all of it: the time it has
 * lived counts at `kept:age` of itself.
 */
export const ageOf = (c: Creature, now: number): Age => {
  // Nothing born before the clock started has an age worth working out: what
  // was already walking about when the island was raised is simply grown.
  if (c.born <= 0) return 'grown';
  const lived = Math.max(0, now - c.born) * keptOf(c, 'kept:age', 1);
  return lived < YOUNG_FOR ? 'young' : lived < keptOf(c, 'kept:old_at', OLD_AT) ? 'grown' : 'old';
};
export const ageDef = (c: Creature, now: number): AgeDef => AGES[ageOf(c, now)];
/** How long until it is grown, in seconds; zero once it is. */
export const growsAt = (c: Creature, now: number): number => Math.max(0, c.born + YOUNG_FOR / keptOf(c, 'kept:age', 1) - now);

/**
 * Care. A wildermon that is brushed and looked over works better and learns
 * faster than one that is only fed, and the care goes out of it again over a
 * few hours of being left alone. It is also half of what decides whether a
 * pairing throws anything worth keeping.
 */
export const CARE_HOURS = 3;
/** What a thoroughly looked-after beast is worth over a neglected one. */
export const CARE_BONUS = 0.25;
export const careMul = (c: Creature): number => 1 + Math.max(0, Math.min(1, c.care)) * keptOf(c, 'kept:care_bonus', CARE_BONUS);
/** How it reads on a card: groomed, kept, or let go. */
export const careWord = (care: number): string =>
  care >= 0.75 ? 'well looked after' : care >= CARE_WANTING ? 'kept' : care >= 0.12 ? 'wanting a brush' : 'neglected';

/**
 * What its rarity makes of one channel: `RARITIES[rare].blood` times as good,
 * which is multiplied in where more is better and divided in where less is.
 */
export const rarityMul = (c: Pick<Creature, 'rare'>, channel: TraitChannel): number => {
  const k = rarityOf(c).blood;
  return channelOf(channel)?.up === false ? 1 / k : k;
};

/**
 * What a step of rarity does to a wildermon's blood, channel by channel, the
 * way a card prints a trait: "+20% speed, work, ... and healing, −17% upkeep,
 * damage taken and chance to be hit". Every channel its traits move, up where
 * more is better and down where less is, by the step's own figure.
 */
export function rarityEffects(c: Pick<Creature, 'rare'>): string {
  const k = rarityOf(c).blood;
  const up = CHANNELS.filter((ch) => ch.up).map((ch) => ch.label);
  const down = CHANNELS.filter((ch) => !ch.up).map((ch) => ch.label);
  return `${pct(k)} ${listed(up)}, ${pct(1 / k)} ${listed(down)}`;
}

/** What its rarity makes of it, for a card: nothing for an ordinary one. */
export function rarityLine(c: Pick<Creature, 'rare'>): string {
  if (!c.rare) return '';
  const r = rarityOf(c);
  return `${r.name[0].toUpperCase()}${r.name.slice(1)} · ${times(r.size)} the size of its kind · ${rarityEffects(c)}`;
}

/** And as a sentence, for what is said when you look it over. */
export function raritySays(c: Pick<Creature, 'rare'>): string {
  if (!c.rare) return '';
  const r = rarityOf(c);
  return ` It came into the world ${r.name}: ${times(r.size)} the size of its kind, ${rarityEffects(c)}.`;
}

/** Its own blood on one channel, as rare as it is, with nothing communal in it. */
export const bloodMul = (c: Creature, channel: TraitChannel): number => traitMul(c.traits, channel) * rarityMul(c, channel) * evoMul(c, channel);

/** What it can take, once its blood is counted, and its keeper's Thick Hide while it follows them. */
export const maxHealth = (c: Creature, species: SpeciesDef): number =>
  Math.round(species.health * bloodMul(c, 'hardy') * companionMul(c, 'hardy'));
/** What its attack lands for. */
export const attackOf = (c: Creature, species: SpeciesDef): number => species.attack * bloodMul(c, 'tough');
// What a creature's attack takes off a player, as a share of a life: kept in `limits.ts`, a leaf, so that what reads it as it loads (enchanting's words) never waits on this.
import { BLOW_SHARE } from './limits';
export { BLOW_SHARE };

/** What a set of traits is worth, written out for a log line. */
export const TRAIT_COUNT = TRAIT_SLOTS;

/** What a draught beast trains by pulling, and a mount by being ridden. */
export const HAUL_SKILL = 'climbing';
/** What a hunter trains, which decides how hard it hits and how far it ranges. */
export const FIGHT_SKILL = 'fighting';
/** A hunter hits harder the more hunting it has done: half again at mastery. */
export const trainedHit = (fighting: number): number => 1 + fighting / 200;

/**
 * What a fight may pick as its quarry: something wild, and nothing in the
 * traces. Nothing tame is ever picked; one in harness is not picked whatever
 * else is true of it.
 */
export const quarry = (o: Creature): boolean => o.mode === 'wild' && o.hitchedTo === null;

/**
 * A wild thing as the island describes it.
 *
 * `rpc_creatures` builds this; nothing here invents any of it. The leg — where
 * it is walking from, to, and between which two of the island's own instants —
 * is what lets a browser draw movement between one word and the next without
 * ever deciding where anything goes.
 */
export interface IslandCreature {
  id: number;
  species: string;
  name: string;
  variant: number;
  mode: string;
  stance: string;
  x: number;
  y: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  /**
   * How long the leg is and how much of it is left, in seconds.
   *
   * Seconds rather than the two instants, for the same reason the action bar
   * takes seconds: a browser whose clock is out by even a few seconds would
   * otherwise pin every leg at one end and re-pin it on the next answer, which
   * is a thing jumping about rather than a thing walking.
   */
  legFor?: number | null;
  legLeft?: number | null;
  health: number;
  max?: number;
  /** How much fleece has grown back, 0..1: sent for your own only. */
  fleece?: number;
  /** Seconds until her young are due, for your own while she carries; absent or null otherwise. */
  dueIn?: number | null;
  hunger?: number;
  sex?: string;
  traits?: string[];
  hunting?: boolean;
  /** Seconds left of a heavy blow it is drawing back for, when it is. */
  windup?: number;
  /** Seconds left of a stun on it (`STUN_SECS`), when it is stunned. */
  stunned?: number;
  /** Seconds left of a slow on it, and the share of its pace it goes at (`enchant_frost`). */
  slowed?: number;
  slowPace?: number;
  /** The one leading the pack it hunts with, when it runs with one. */
  lead?: number | null;
  /** What a companion of yours is fighting, said only of your own. */
  enemy?: number | null;
  /** The tame creature a wild one has turned on, when it has. */
  brawl?: number | null;
  mine?: boolean;
  /** How rare it is, as the island words it ('rare', 'supreme', 'fantastic'); absent for an ordinary one. */
  rare?: string | null;
  /** Shod, by the island's clock. */
  shod?: boolean;
  /** What the tack on it carries of its makers' marks, when anything (a Tailor's Saddler). */
  tack?: Record<string, Mark> | null;
  /** The enchantments in the tack on it, by the piece, when any (Fleetfoot, Tamer's Bridle). */
  tack_enchant?: Record<string, Enchant> | null;
  /** What its keeper's perks make of keeping it (a Herdsman's), when anything. */
  kept?: Record<string, number> | null;
  /** The vehicle it is in the traces of; absent from older islands. */
  hitchedTo?: number | null;
  /** The trade a worker was set to, which is its species' own unless it was told otherwise. */
  job?: string | null;
  /*
   * And, for your own only, the working life the card used to invent.
   *
   * `rpc_creatures` carried a body and a leg and nothing about what a thing
   * was doing with its day, so the wildermon window filled the rest in from
   * the book: every wildermon on an island read Foraging 1.00, Experience 0.0,
   * Care 0% and "Looking for work", however long it had been at it.
   */
  care?: number;
  xp?: number;
  skills?: Record<string, number>;
  /** What the island says it is up to: `idle`, `out`, `work`, `home`, and the rest. */
  phase?: string;
  carrying?: { def: string; count?: number; ql?: number } | null;
  /**
   * Its dam, its sire and where each trait came from, for anything bred and
   * for nothing else. Somebody else's says where a trait came from only for
   * the traits you can read.
   */
  pedigree?: Pedigree;
}

/**
 * The island's word for what a worker is doing, in the browser's.
 *
 * Two words each side of the same thing: the island counts a trip as out,
 * work, home; this side has toForage, forage, and a thing with its arms full.
 */
const STATE_OF: Record<string, string> = { out: 'toForage', work: 'forage' };

export interface Creature {
  id: number;
  /**
   * Whose this is, on an island. Absent in the game you play by yourself,
   * where everything on the ground is yours because there is only you.
   */
  mine?: boolean;

  species: string;
  name: string;
  variant: number;
  x: number;
  y: number;
  mode: CreatureMode;
  stance: Stance;
  health: number;
  hunger: number;
  carrying: Item | null;
  /** Total experience earned from work. */
  xp: number;
  /** How much fleece has grown back, 0..1, for the species that carry one. */
  fleece: number;
  /** Task skills, on the same 1..100 scale as the player's. */
  skills: Record<string, number>;
  /** Male or female. It decides what can be bred, and what can be milked. */
  sex: Sex;
  /** The three traits it was born with. Blood, and the whole of what breeding is for. */
  traits: string[];
  /**
   * How rare it came into the world, a step as a made thing's is: nought for
   * an ordinary one, and rare, supreme or fantastic at a made thing's odds
   * (`RARITY_ODDS`). A rare one is bigger (`RARITIES[rare].size`), better at
   * every figure its blood decides (`rarityMul`) and was born with better
   * blood (`rollTraits`). It is its own and not its parents': nothing breeds
   * true for it.
   */
  rare: number;
  /** How well it has been looked after lately, 0..1. Brushing puts it up; time takes it down. */
  care: number;
  /** Game time it was last put to a mate, so nothing is bred twice in an afternoon. */
  bredAt: number;
  /** Game time a carried young is due, or 0 for one that is not in calf. */
  due: number;
  /** What is coming, settled at the covering so no sire need survive to the birth. */
  unborn: Unborn | null;
  /** Its dam, its sire and where each trait came from, if it was bred. */
  pedigree: Pedigree | null;
  // Runtime state below; not saved.
  /**
   * What its keeper's perks make of keeping it (a Herdsman's Light Eaters,
   * Lasting Care, Well Kept and Long-lived), as the island stamps it on the
   * beast. Absent offline, where every kept beast is yours: `keptOf` reads
   * your own perks then.
   */
  kept?: Record<string, number> | null;
  /**
   * The leg the island last said it was on, when the island is the one
   * thinking. Milliseconds off `Date.parse`, walked in `walkLegs`.
   */
  legFromX: number;
  legFromY: number;
  legToX: number;
  legToY: number;
  legAt: number;
  legEnds: number;
  state: string;
  until: number;
  tx: number;
  ty: number;
  dirX: number;
  dirY: number;
  walkPhase: number;
  moving: boolean;
  enemy: number | null;
  attackedBy: number | null;
  attackedAt: number;
  cooldown: number;
  /** Seconds left of a heavy blow it is drawing back for; nought when it is not. */
  windup: number;
  /** Blows it has landed or loosed in this fight, which is what brings the heavy one round. */
  blows: number;
  /** Health it is bleeding a second from a knife, and the game time it stops. */
  bleedRate: number;
  bleedUntil: number;
  /** When the bleed running now was opened, which is where it runs from; missing on one kept before it was kept. */
  bleedFrom?: number;
  /** The game time a burn a Kindler started on it stops, which is a bleed while it runs; missing on one never burned. */
  burnUntil?: number;
  /** The game time a stun on it ends (`STUN_SECS`): until then it neither moves nor strikes. Missing on one never stunned. */
  stunUntil?: number;
  /** The game time a slow on it ends, and the share of its pace it goes at until then (a Frostbite, `frost`). Missing on one never slowed. */
  slowUntil?: number;
  slowPace?: number;
  /** The last thing it did that is drawn and heard (`BeastAct`), and when, on the game clock; missing on one that has done nothing yet. */
  act?: BeastAct;
  actAt?: number;
  /** The phase the island last said it was in, for telling when it struck or set to work there. */
  islandPhase?: string;
  /** Heard of from the island before, so that what it says next is a change rather than the first word of it. */
  islandSeen?: boolean;
  /**
   * What is on it for a while and what it is worth (`markOn`): a root, dulled claws, a brittleness, a mark for
   * death, a stone skin, a keep-away, and when its own ability is ready again. The island's `class_mark`.
   * Missing on one never marked.
   */
  marks?: Partial<Record<MarkKind, { val: number; until: number }>>;
  busyUntil: number;
  searchAt: number;
  /** Where it first had your scent, which is what the leash is tied to. */
  huntX: number;
  huntY: number;
  /**
   * The middle of its own ground: where it wanders about, and what a hunter's
   * leash is measured from.
   *
   * Set where it is first put down, and shared with the herd it joined if it
   * joined one. Nought for anything that is not wild — a tame thing's home is
   * wherever its keeper is, and a worker's is the settlement.
   */
  homeX: number;
  homeY: number;
  /** When it will take an interest again, after giving a chase up. */
  huntRest: number;
  /** The one leading the pack it hunts with (its own id for the leader), or null hunting alone. */
  packLead: number | null;
  /** A companion told to fall back starts no fight before this game time. */
  heelUntil: number;
  /** A tame creature a wild one has turned on, for hurting it (`THREAT_HOLD`); null when it is not. */
  brawl: number | null;
  /** When whatever it is fighting last hurt it. */
  threatAt: number;
  /** When it last said it had nowhere to put a load down. */
  noRoomAt: number;
  /** Time banked up while nobody was watching, spent on the next think. */
  owed: number;
  /** When the player last called it over for an action; it drops everything and comes. */
  calledAt: number;
  /** Next time an unruly one gets a chance to turn on its keeper. */
  nipAt: number;
  /** Offerings made to a wild one in a row, and when the last was made. */
  coaxed: number;
  coaxedAt: number;
  /** The tile this worker walked out to work on: a tree, a seam, a field. */
  workX: number;
  workY: number;
  /** Seeds held in the cheeks, for a farm worker to sow. */
  pouch: Item | null;
  /** What the worker walked out to do: a farm job, or the hearth a stoker is feeding. */
  job: FarmJob | Hearth | null;
  /**
   * The trade it was set to, when that is not its species' own. Null means
   * `gathers`. The island keeps the same thing in the creature's `job`
   * column, which there has only ever held a trade.
   */
  trade: GatherKind | null;
  /**
   * The vehicle whose traces it is in, if any. Worked out from the vehicles
   * themselves when a world is read back, so it is never saved twice.
   */
  hitchedTo: number | null;
  /** Saddled and bridled, for the sorts that can be ridden. */
  tacked: boolean;
  /**
   * What the tack on it carries of its makers' marks, by the piece: a
   * Tailor's Saddler's pace. Absent for plain tack, and gone with the tack.
   */
  tack?: Record<string, Mark>;
  /** The enchantments in the tack on it, by the piece (Fleetfoot, Tamer's Bridle). Absent for plain tack, and gone with the tack. */
  tackEnchant?: Record<string, Enchant>;
  /** When it was last shod; shoes hold `SHOE_DAYS`. Long ago when it never was. */
  shodAt: number;
  /** What is riding on its back, for the sorts that carry panniers. */
  pannier: Item[];
  /** Set while the player is up on its back. */
  ridden: boolean;
  /** The hour it was born, which is all that age is. */
  born: number;
  /** The trap holding it, if it has walked into one. It does nothing at all while it is held. */
  trapped: number | null;
  /**
   * The work post it takes its orders from, if any. A worker with one treats
   * that post exactly as another treats the settlement token — until the post
   * rots through under it.
   */
  post: number | null;
}

export type FarmJob = 'sow' | 'tend' | 'harvest';
/** The three things a stoker keeps alight. */
export type Hearth = 'campfire' | 'smelter' | 'kiln';

export interface CreatureJSON {
  id: number;
  species: string;
  name: string;
  variant: number;
  x: number;
  y: number;
  mode: CreatureMode;
  stance: Stance;
  health: number;
  hunger: number;
  carrying: Item | null;
  pouch?: Item | null;
  xp?: number;
  fleece?: number;
  skills?: Record<string, number>;
  tacked?: boolean;
  tack?: Record<string, Mark>;
  tackEnchant?: Record<string, Enchant>;
  shodAt?: number;
  pannier?: Item[];
  post?: number | null;
  trapped?: number | null;
  born?: number;
  sex?: Sex;
  traits?: string[];
  /** How rare it came into the world; absent in a save from before there were rare ones, which were all ordinary. */
  rare?: number;
  care?: number;
  bredAt?: number;
  due?: number;
  unborn?: Unborn | null;
  pedigree?: Pedigree | null;
  trade?: GatherKind | null;
  /**
   * The middle of its own ground. Saved, because a herd that scattered every
   * time somebody reloaded would not be a herd; a save from before this has
   * none, and everything in it takes where it is standing as home, which is
   * the same answer it would have got had it only just arrived.
   */
  homeX?: number;
  homeY?: number;
}

/**
 * How fast hunger drains, per second. Roughly the pace a player's own hunger
 * falls, so a wildermon goes most of an hour between meals rather than
 * needing one every few minutes.
 */
export const HUNGER_RATE: Record<Exclude<CreatureMode, 'stored'>, number> = {
  wild: 0.0005,
  active: 0.00025,
  deed: 0.0004,
};

/**
 * When a wildermon goes looking for food, and how much a meal is worth.
 *
 * Written out four times between the grazing, the bait and now the stores,
 * which is three copies too many of a number that has to agree with itself.
 */
export const GRAZE_HUNGRY = 0.5;
export const GRAZE_FILL = 0.5;

/** How long a called creature keeps making its way over. */
export const CALL_WINDOW = 12;
/**
 * Horseshoes. Four to a mount, nailed on with a mallet; they hold a week,
 * quicker on laid stone by a share and up a steeper step by a fixed
 * height. The island reads the same four.
 */
export const SHOES_PER_MOUNT = 4;
export const SHOE_DAYS = 7;
export const SHOE_PACE = 1.15;
export const SHOE_STEP = 8;
describeWith({ shoes: { perMount: SHOES_PER_MOUNT, days: SHOE_DAYS, quicker: SHOE_PACE - 1, step: SHOE_STEP } });
/** Whether the shoes are still on: a week from the fitting, in the clock that fitted them. */

/** What a mount wears to be ridden: a saddle and a bridle. */
export const TACK = ['saddle', 'bridle'];
/**
 * How much faster its tack lets a mount go: the larger of the two pieces'
 * makers' marks (a Tailor's Saddler), after the cap, as the island's
 * `tack_speed` has it. One for plain tack.
 */
export const tackSpeed = (c: { tack?: Record<string, Mark>; tackEnchant?: Record<string, Enchant> }): number =>
  Math.max(1, ...TACK.map((id) => markOf({ mark: c.tack?.[id] }, 'speed')))
  // And a Fleetfoot in its saddle on top.
  * (1 + tackEnchant(c, 'fleet'));
/** What the enchantments in the tack on it come to for this effect: the most of any one piece. The island's `tack_enchant_of`. */
export const tackEnchant = (c: { tackEnchant?: Record<string, Enchant> }, effect: EnchantEffect): number =>
  Math.max(0, ...TACK.map((id) => swingEnchant({ enchant: c.tackEnchant?.[id] }, effect)));

export const isShod = (now: number, c: { shodAt: number }): boolean => now - c.shodAt < SHOE_DAYS * DAY_SECONDS;
/** How close it comes before standing still, well inside arm's reach. */
const CALL_DISTANCE = 0.9;

/**
 * The floor under an island's wildlife, however small the island is.
 *
 * Three times what it was, with `PER_REGION`: a 64-tile island is four
 * stretches of country and would otherwise hold four head, so on anything you
 * can walk across in a minute this number is the whole of the answer.
 */
export const WILD_TARGET = 96;
const RESPAWN_EVERY = 22;
/**
 * How closely creatures are followed, by tiles from the player. Anything being
 * looked at is followed whatever the distance; these are for the rest.
 */
const NEAR_RANGE = 26;
const FAR_RANGE = 70;
/** How often something out of sight thinks, in seconds. */
const FAR_STEP = 0.25;
const ASLEEP_STEP = 2;
/** The most time one think may cover, so nothing strides through a wall. */
const MAX_STEP_TIME = 0.34;
/**
 * Streaming. Wild creatures only exist in memory near whoever is playing: past
 * CULL_RANGE one is put away into the count for the stretch of country it was
 * in, and when somebody comes back within LIVE_RANGE it is let out again. What
 * is banked is a number, not a creature, so an island of any size costs the
 * same as the piece of it being walked. Both ranges sit well outside how far
 * anyone can see, so nothing is ever seen to come or go.
 */
const LIVE_RANGE = 60;
const CULL_RANGE = 85;
/** Tiles to a stretch of country, for the purposes of banking. */
const REGION = 32;
/** How often creatures are put away and let out, in seconds. */
const STREAM_EVERY = 2;
/** Most creatures let out in one pass, so a walk never stalls on it. */
const STREAM_BATCH = 6;
/**
 * Wildlife a stretch of country holds, which is what the island adds up to.
 *
 * Back to one, and the reason is worth writing down because the number itself
 * is not the fault.
 *
 * It was one, and "wildermon are too rare" was a fair report: a head to a
 * thirty-two tile square is a creature every thousand tiles and the country
 * between settlements read as empty. So it went to three. What that also did
 * — and nobody looked, which is the actual mistake — was treble the work the
 * island does to *put them out*, and that work happens inside `rpc_move`,
 * which is the call a walking browser makes constantly.
 *
 * `creature_stock_block` throws darts at a two-hundred-and-fifty-six tile
 * square until it has placed what the square is owed, giving up after twelve
 * throws per head. Only an eighth of this island is ground anything can stand
 * on, so most throws miss. Measured on Bigness, one block, inside the walk
 * call:
 *
 *     three a region: 6,963 ms for a land block, 1,797 ms for open sea
 *     one a region:   1,430 ms for a land block,   651 ms for open sea
 *
 * Seven seconds of server, on the move call, every time somebody walks into
 * country nobody has been through in the last fifty minutes. Reported as the
 * island severely delaying its answers, and that is what it was.
 *
 * One again, then, which is a fifth of the stall — and the density question is
 * still open and still fair. The answer to it is not this number, it is that
 * putting the wildlife out has no business happening on the walk call at all;
 * it belongs on the heartbeat, where nobody is waiting for it. Until it moves
 * there, the price of a fuller island is paid by whoever is walking across it.
 *
 * The island reads this number rather than keeping one of its own, so the two
 * of them cannot drift: `wild_per_region()` and `wild_floor()` are emitted
 * from here with the rest of the rulebook.
 */
export const PER_REGION = 1;

/**
 * How much wildlife a piece of country that size should hold.
 *
 * A function of the measurements rather than of the world, because the island
 * asks the same question of a block of 256 tiles as this asks of a whole map,
 * and because it is the one thing both sides have to answer the same way.
 */
export const wildTargetFor = (w: number, h: number): number =>
  Math.max(WILD_TARGET, Math.round(Math.ceil(w / REGION) * Math.ceil(h / REGION) * PER_REGION));
/**
 * Coaxing. A wild thing offered food again and again grows used to the hand
 * holding it, so every attempt in a row makes the next a little likelier. A
 * run lapses if you leave it alone, and raising a hand to it ends the run
 * outright: nothing that has been hit takes food from you.
 *
 * It used to stop at four offerings — a ceiling of twelve points, which on a
 * hard tame is not enough to see, and which turned a long run of refusals back
 * into no progress at all: the very thing coaxing is for. There is no ceiling
 * on it now. Keep offering and it keeps warming, and the only limit is the one
 * on the whole chance, which `tameChance` has always clamped at 0.95 — so
 * patience buys a hard tame rather than guaranteeing it, and the run still
 * lapses the moment you walk away.
 */
export const COAX_STEP = 0.03;
export const COAX_LAPSE = world(90);

/** What a run of offerings is worth to the next one, 0 when the run has lapsed; each worth more to a Herdsman's Patient Coax. */
export const coaxBonus = (c: Creature, time: number, step = COAX_STEP): number =>
  c.coaxed <= 0 || time - c.coaxedAt > COAX_LAPSE ? 0 : c.coaxed * step;

/** Forget a run of offerings: it was tamed, or hurt, or simply left alone. */
export const forgetCoaxing = (c: Creature): void => {
  c.coaxed = 0;
  c.coaxedAt = -1e9;
};

/** Seconds a wild creature spends grazing. */
const FORAGE_TIME = 2.5;
/** Seconds between chances for an unruly companion to turn on its keeper. */
export const NIP_EVERY = 25;

/** A creature's level, read off its best task skill. */
/**
 * A wildermon's level is its skill: the one it was born to (its job's, or a draught beast's hauling), to the whole
 * number below, and one for a kind that has none. Asked for: "Level should be equal to that skill, since there's only
 * 1 skill per wildermon". The island's `creature_level`.
 */
export const creatureLevel = (c: Pick<Creature, 'skills'>): number => Math.max(1, Math.floor(Math.max(0, ...Object.values(c.skills))));

/** How long a deed worker takes over a task: twice what a player of the same skill would. */
export function workDuration(skill: number): number {
  return 2 * Math.max(ACTION_FLOOR, WORKER_WEIGHT * ACTION_PACE * (1 - skill / 140));
}

type MoveResult = 'arrived' | 'moving' | 'blocked';

/** A blow the island reported by the health it took off, and where it landed. */
export interface Hurt {
  x: number;
  y: number;
  taken: number;
}

/**
 * How much health has to go before it is worth a number.
 *
 * A body's top health moves with its age, so an old thing shedding a
 * hundredth as it goes past its prime is not a wound, and neither is the
 * rounding between one answer and the next. The renderer writes anything
 * under this as "blocked", which would be a lie about both.
 */
const HURT_FLOOR = 0.05;

export class Creatures {
  readonly list = new Map<number, Creature>();
  nextId = 1;
  /** Told whenever a wildermon strikes, finishes a go at its task or uses its ability: the game passes it on as `beast`. */
  onAct?: (id: number, act: BeastAct) => void;

  /** It did something worth drawing and hearing (`BeastAct`): marked on it, and passed on. */
  acted(c: Creature, act: BeastAct, time: number): void {
    c.act = act;
    c.actAt = time;
    this.onAct?.(c.id, act);
  }
  /**
   * Who is standing where, filed under the tile and rebuilt every tick.
   *
   * Numbers for keys rather than `"x,y"` strings, and the arrays are emptied
   * and kept rather than thrown away: this is rebuilt from scratch on every
   * frame for every creature on the island, so it was making a string and an
   * array per creature per frame and handing both straight to the collector.
   */
  private byTile = new Map<number, Creature[]>();
  /** Tiles written to this tick, so the rest can be left alone. */
  private filled: number[] = [];
  /**
   * Wildlife that belongs to a stretch of country but is not in memory just
   * now, by region. A number apiece: what comes back is of the country rather
   * than the particular creature that walked away from it.
   */
  banked = new Map<number, number>();
  private streamAt = 0;

  /**
   * How the creatures stand: how many are being followed closely, how many are
   * out of sight, how many are left to themselves, and how many of the lot
   * actually thought on the last frame. The last number is the one that says
   * whether any of this is earning its keep.
   */
  ticked = { near: 0, far: 0, asleep: 0, thought: 0 };
  private respawnClock = 0;

  /**
   * Whether the island is the one doing the thinking.
   *
   * Set on an island kept in Postgres, where every wild thing's hunger,
   * wandering and hunting is settled there — the same seam as actions. Nothing
   * here may decide anything about a creature then: this side is handed legs
   * with times on them and walks them, so that the frames between one word
   * from the island and the next have something to draw.
   */
  fromIsland = false;

  get(id: number): Creature | undefined {
    return this.list.get(id);
  }

  species(c: Creature): SpeciesDef {
    return SPECIES[c.species] ?? SPECIES.rabba;
  }

  spawn(species: string, x: number, y: number, mode: CreatureMode = 'wild', rand: () => number = Math.random, born = 0): Creature {
    const c = Creatures.make(this.nextId++, species, x, y, mode, rand);
    c.born = born;
    if (mode === 'wild') this.joinHerd(c);
    this.list.set(c.id, c);
    return c;
  }

  /**
   * Throw in with the nearest of its own kind, if there is one about.
   *
   * A herd is not a list anywhere: it is a shared home. A grazer arriving
   * within `HERD_REACH` of another of its species takes that one's home
   * ground for its own, so the pair of them wander the same patch and are
   * found together ever after — and the next one along joins whichever of
   * them it lands nearest, which is how a herd grows out of one look round at
   * birth and no bookkeeping at all.
   *
   * Hunters keep their own ground. Six goblins sharing a range would be a
   * pack, and what makes a hunter frightening is meeting it where it lives.
   */
  /** How many wild ones of its kind share its home. */
  private homeCount(o: Creature): number {
    let n = 0;
    for (const m of this.list.values()) if (m.species === o.species && m.mode === 'wild' && m.homeX === o.homeX && m.homeY === o.homeY) n++;
    return n;
  }

  private joinHerd(c: Creature): void {
    const def = SPECIES[c.species];
    // A hunter keeps its own ground, unless its kind runs in a pack, and then no more than `PACK_MOST` to a home.
    if (def?.hunter && !def.pack) return;
    let bestD = HERD_REACH;
    let best: Creature | null = null;
    for (const o of this.list.values()) {
      if (o.species !== c.species || o.mode !== 'wild') continue;
      const d = Math.hypot(o.homeX - c.x, o.homeY - c.y);
      if (d < bestD && (!def?.pack || this.homeCount(o) < PACK_MOST)) {
        bestD = d;
        best = o;
      }
    }
    if (!best) return;
    c.homeX = best.homeX;
    c.homeY = best.homeY;
  }

  private static make(id: number, species: string, x: number, y: number, mode: CreatureMode, rand: () => number): Creature {
    const def = SPECIES[species] ?? SPECIES.rabba;
    const variant = Math.floor(rand() * def.variants.length);
    const hunger = 0.6 + rand() * 0.4;
    const fleece = 0.6 + rand() * 0.4;
    const sex: Sex = rand() < 0.5 ? 'male' : 'female';
    // As rare as a made thing may come out, and born with blood to match; a monster is not a wildermon and is never rare.
    const rare = def.monster ? 0 : rollRarity(rand);
    const c: Creature = {
      id,
      species: def.id,
      name: def.name,
      variant,
      x,
      y,
      mode,
      stance: def.defaultStance ?? 'defensive',
      health: def.health,
      hunger,
      carrying: null,
      xp: 0,
      fleece,
      skills: startSkills(def),
      sex,
      traits: rollTraits(rand, 0, rare),
      rare,
      care: 0,
      bredAt: -1e9,
      due: 0,
      unborn: null,
      pedigree: null,
      legFromX: x,
      legFromY: y,
      legToX: x,
      legToY: y,
      legAt: 0,
      legEnds: 0,
      state: 'idle',
      until: 0,
      tx: x,
      ty: y,
      dirX: 1,
      dirY: 0,
      walkPhase: 0,
      moving: false,
      enemy: null,
      attackedBy: null,
      attackedAt: -1e9,
      cooldown: 0,
      windup: 0,
      blows: 0,
      bleedRate: 0,
      bleedUntil: 0,
      busyUntil: 0,
      searchAt: 0,
      huntX: 0,
      huntY: 0,
      homeX: x,
      homeY: y,
      huntRest: -1e9,
      packLead: null,
      heelUntil: -1e9,
      brawl: null,
      threatAt: -1e9,
      noRoomAt: 0,
      owed: 0,
      calledAt: -1e9,
      nipAt: 0,
      coaxed: 0,
      coaxedAt: -1e9,
      workX: -1,
      workY: -1,
      pouch: null,
      job: null,
      trade: null,
      hitchedTo: null,
      tacked: false,
      shodAt: -1e9,
      ridden: false,
      pannier: [],
      post: null,
      trapped: null,
      born: 0,
    };
    // Blood decides what it can take, so the ceiling is read off the traits it
    // was just given rather than off the book.
    c.health = maxHealth(c, def);
    return c;
  }

  /**
   * Everything the island says is about, in one word.
   *
   * The browser never asked. `rpc_creatures` has been there since the island
   * was built and nothing under `src/` called it, so on a live island the
   * wildlife was there, moving, hunting — and invisible. The footer said
   * `0/0 mobs` and meant it.
   *
   * Replaces rather than merges: what is not in the list has wandered out of
   * the range we asked about, or is dead, and either way it is not here.
   */
  sawAll(rows: IslandCreature[], time = 0): Hurt[] {
    const now = Date.now();
    const seen = new Set<number>();
    const hurt: Hurt[] = [];
    for (const r of rows) {
      seen.add(r.id);
      let c = this.list.get(r.id);
      // What it stood at before this answer, which is the only record of a
      // blow anybody struck between two of them.
      const was = c?.health;
      if (!c) {
        c = Creatures.make(r.id, r.species, r.x, r.y, r.mode as CreatureMode, Math.random);
        this.list.set(r.id, c);
        if (r.id >= this.nextId) this.nextId = r.id + 1;
      }
      c.name = r.name ?? c.name;
      c.variant = r.variant ?? c.variant;
      c.mode = r.mode as CreatureMode;
      c.stance = r.stance as Stance;
      c.health = r.health;
      /*
       * A number over anything that lost health since the last answer.
       *
       * Not a claim about who struck it — on a shared island it may have been
       * somebody else, and the island does not say. It is what the thing lost,
       * which is what a damage number means. Only over something we had
       * already seen: the first sight of a creature is not a wound.
       */
      if (was !== undefined && was - r.health > HURT_FLOOR) {
        hurt.push({ x: r.x, y: r.y, taken: was - r.health });
      }
      c.hunger = r.hunger ?? c.hunger;
      // How much fleece has grown back, sent for your own (`rpc_creatures`), which Shear and Milk read.
      c.fleece = r.fleece ?? c.fleece;
      // When her young are due, on this side's clock, for the Wildermon window's Needs attention; sent for your own only.
      if (r.dueIn !== undefined) c.due = r.dueIn ? time + r.dueIn : 0;
      c.sex = (r.sex as Sex) ?? c.sex;
      c.traits = r.traits ?? c.traits;
      // How rare it is, which the island rolled when it came into the world; nothing said is an ordinary one.
      c.rare = rarityStep(r.rare) ?? 0;
      // The island sends a pedigree with anything bred and with nothing else.
      c.pedigree = r.pedigree ?? null;
      // The island says `hunting` only of one that is after you (`rpc_creatures`), and that is what `PLAYER_ATTACKER` means here.
      c.enemy = r.hunting ? PLAYER_ATTACKER : (r.enemy ?? null);
      c.windup = r.windup ?? 0;
      // A stun the island says it is under, to the game clock here, for the target panel (`enchant_stun`).
      c.stunUntil = r.stunned ? time + r.stunned : undefined;
      // And a slow, with the share of its pace it goes at (`enchant_frost`, a Binder's or a Sworn Blade's too).
      c.slowUntil = r.slowed ? time + r.slowed : undefined;
      c.slowPace = r.slowed ? r.slowPace ?? undefined : undefined;
      c.packLead = r.lead ?? null;
      c.brawl = r.brawl ?? null;
      // Whose it is, which the island says and the journal has to know.
      c.mine = r.mine;
      // And what it was set to, if that is not what its kind does anyway.
      if (r.job !== undefined) c.trade = r.job && r.job !== SPECIES[c.species]?.gathers && (SPECIES[c.species]?.trades ?? []).includes(r.job as GatherKind) ? (r.job as GatherKind) : null;
      // Shod or not is the island's word; the browser keeps its own clock of it.
      if (r.shod !== undefined) c.shodAt = r.shod ? (isShod(time, c) ? c.shodAt : time) : -1e9;
      if (r.tack !== undefined) {
        if (r.tack) c.tack = r.tack;
        else delete c.tack;
      }
      if (r.tack_enchant !== undefined) {
        if (r.tack_enchant) c.tackEnchant = r.tack_enchant;
        else delete c.tackEnchant;
      }
      // What its keeper's perks make of keeping it: the island's word, never this machine's perks.
      c.kept = r.kept ?? null;
      /*
       * And which traces it is in, which the island never said: every hitched
       * animal on an island read as free, so its menu offered to hitch it again
       * and never to take it out, and the wagon's yokes read empty.
       */
      if (r.hitchedTo !== undefined) c.hitchedTo = r.hitchedTo;
      // The working life, which comes for yours and for nobody else's.
      if (r.care !== undefined) c.care = r.care;
      if (r.xp !== undefined) c.xp = r.xp;
      if (r.skills) {
        // Evolved there since it was last heard of: drawn and heard here as it would be in a game of your own.
        const was = stageOf(c);
        c.skills = r.skills;
        if (c.islandSeen && stageOf(c) > was) this.acted(c, 'evolve', time);
        c.islandSeen = true;
      }
      if (r.phase !== undefined) {
        c.state = STATE_OF[r.phase] ?? 'idle';
        // Struck or set to work there since it was last heard of: drawn and heard here as it would be in a game of your own.
        if (r.phase !== c.islandPhase && (r.phase === 'strike' || r.phase === 'work')) this.acted(c, r.phase, time);
        c.islandPhase = r.phase;
      }
      if (r.carrying !== undefined) {
        c.carrying = r.carrying
          ? { uid: 0, id: r.carrying.def, ql: r.carrying.ql ?? 1, dmg: 0, count: r.carrying.count ?? 1 }
          : null;
      }
      /*
       * The leg it is on, put on this machine's clock as it arrives.
       *
       * The island says how long the leg is and how much of it is left; both
       * ends are worked out from `now` here. Nothing has to agree about the
       * time, which is the whole point — the two instants used to travel
       * instead, and a phone a few seconds out pinned every leg at one end and
       * then re-pinned it with the next answer.
       */
      c.legFromX = r.fromX ?? r.x;
      c.legFromY = r.fromY ?? r.y;
      c.legToX = r.toX ?? r.x;
      c.legToY = r.toY ?? r.y;
      const span = (r.legFor ?? 0) * 1000;
      const left = Math.max(0, r.legLeft ?? 0) * 1000;
      if (span > 0) {
        c.legEnds = now + left;
        c.legAt = c.legEnds - span;
      } else {
        c.legAt = 0;
        c.legEnds = 0;
        c.x = r.x;
        c.y = r.y;
      }
    }
    for (const id of [...this.list.keys()]) if (!seen.has(id)) this.list.delete(id);
    return hurt;
  }

  /**
   * Walk everything along the leg the island last gave it.
   *
   * The clock is the browser's, and the two do not have to agree to within
   * anything: a leg that has run out just holds at its far end until the next
   * word arrives, which is a body standing still rather than a body in the
   * wrong place.
   */
  private walkLegs(): void {
    const now = Date.now();
    for (const c of this.list.values()) {
      if (!c.legAt || c.legEnds <= c.legAt) {
        /*
         * A leg of no length is a thing standing still, and it still has to be
         * filed under the tile it is standing on.
         *
         * Reported as "wildermon active with the player are not visible,
         * perhaps those working on deed too", and that is exactly the set: the
         * island parks a companion at its keeper's feet, one kept at the token
         * beside the token, and an idle worker where it stands, each with
         * `leg_at` and `leg_ends` both set to now. This loop is the only thing
         * that fills the tile index while the island owns the wildlife, and it
         * went straight past all three — so `atTile` never returned them and
         * nothing drew them. A wild thing between walks kept its last leg's
         * timestamps and was filed, which is why only tame ones vanished.
         */
        c.moving = false;
        this.place(c);
        continue;
      }
      const t = Math.max(0, Math.min(1, (now - c.legAt) / (c.legEnds - c.legAt)));
      const nx = c.legFromX + (c.legToX - c.legFromX) * t;
      const ny = c.legFromY + (c.legToY - c.legFromY) * t;
      const dx = nx - c.x;
      const dy = ny - c.y;
      c.moving = Math.hypot(dx, dy) > 0.002;
      if (c.moving) {
        c.dirX = dx;
        c.dirY = dy;
        c.walkPhase += Math.hypot(dx, dy) * 6;
      }
      c.x = nx;
      c.y = ny;
      this.place(c);
    }
  }

  remove(id: number): void {
    this.list.delete(id);
  }

  /**
   * Creatures standing on a tile, from the index rebuilt each update. The
   * array is the index's own — read it, do not keep it or reorder it — and an
   * empty tile hands back one shared empty array.
   */
  atTile(x: number, y: number): readonly Creature[] {
    return this.byTile.get(tileKey(x, y)) ?? NOBODY;
  }

  /** How far this one ranges from the token at the skill it has now. */
  rangeFor(c: Creature): number {
    return workRangeOf(c, this.species(c));
  }

  /**
   * The communal part of a channel: what every wildermon working the same
   * settlement — or the same post — lends to all of them, the bearer included.
   * A lead beast standing in the field makes the whole deed quicker.
   */
  aura(c: Creature, channel: TraitChannel): number {
    if (c.mode !== 'deed') return 1;
    let m = 1;
    for (const o of this.list.values()) {
      if (o.mode !== 'deed' || o.post !== c.post) continue;
      m *= auraMul(o.traits, channel);
    }
    return m;
  }

  /** Everything that bears on how fast it moves: and its keeper's Fleet while it follows them. */
  speedMul(c: Creature): number {
    return bloodMul(c, 'speed') * this.aura(c, 'speed') * companionMul(c, 'speed');
  }

  /** Everything that bears on how fast it gets a task done: blood, herd, and how it is kept. */
  workMul(c: Creature): number {
    return bloodMul(c, 'work') * this.aura(c, 'work') * careMul(c);
  }

  /** Everything that bears on how fast the work goes into it. */
  learnMul(c: Creature): number {
    return bloodMul(c, 'learn') * this.aura(c, 'learn') * careMul(c);
  }

  /** Everything that bears on what it brings home from a trip out. */
  yieldMul(c: Creature): number {
    return bloodMul(c, 'yield') * this.aura(c, 'yield');
  }

  /** Its blood and its herd together on one channel: what a fight rule reads; and its keeper's trade while it follows them. */
  mul(c: Creature, channel: TraitChannel): number {
    return bloodMul(c, channel) * this.aura(c, channel) * companionMul(c, channel);
  }

  /**
   * The player's companion: the one of yours following you.
   *
   * Not one in the traces. It was, so a beast backed into a wagon went on
   * counting as the one that follows you, and the next could not be let out of
   * its crate to be hitched beside it -- reported as "once it's hitched it
   * still counts as following me and i can't bring out the next mon". A
   * companion put in the traces is the wagon's until it comes out again
   * (`teamOutRefusal`).
   */
  active(): Creature | undefined {
    for (const c of this.list.values()) if (c.mode === 'active' && c.mine !== false && c.hitchedTo === null) return c;
    return undefined;
  }

  /**
   * Every tamed wildermon that is yours. On an island everybody's come in the
   * one list, each marked yours or not by the island (`mine`); by yourself
   * every tame one is, as there is nobody else to have tamed it.
   */
  yours(): Creature[] {
    return [...this.list.values()].filter((c) => c.mode !== 'wild' && c.mine !== false);
  }

  /** The ones shut in creature crates. */
  stored(): Creature[] {
    return [...this.list.values()].filter((c) => c.mode === 'stored');
  }

  /**
   * The wildermon working the settlement itself. One set to a work post is at
   * work too, but not on the deed's books: it costs no settlement slot, which
   * is most of what a post is for.
   */
  workers(): Creature[] {
    return [...this.list.values()].filter((c) => c.mode === 'deed' && c.post === null);
  }

  /** Everything at work anywhere, posts included. */
  working(): Creature[] {
    return [...this.list.values()].filter((c) => c.mode === 'deed');
  }

  wildCount(): number {
    let n = 0;
    for (const c of this.list.values()) if (c.mode === 'wild') n++;
    return n;
  }

  /**
   * Whether a tile is somewhere a creature can walk: passable, dry, in
   * bounds, and no steeper than anything stands on -- and not a tile on
   * piers, under a deck or on one, where nothing goes but a body on its own
   * two feet (`piers.ts`, the island's `creature_tile_ok`).
   */
  tileOk(game: Game, x: number, y: number): boolean {
    const w = game.world;
    if (game.buildings.pierTiles.size && game.buildings.onPiers(x, y)) return false;
    return w.inBounds(x, y) && w.isPassable(x, y) && w.centerHeight(x, y) >= -1 && standsOn(w, x, y);
  }

  /**
   * Every creature standing on a tile just planned on piers, moved off it:
   * to the middle of the nearest tile it may walk, ring by ring out to
   * `PIER_SHOO` tiles, each ring from its north-west corner a row at a time;
   * left where it is if there is none. One in a crate is where its crate is,
   * and one in the traces where its cart is. The island's `pier_shoo_all`,
   * tile for tile, which moves one walking to the tile as well: a creature
   * there walks a leg at a time, and this one a step.
   */
  shoo(game: Game, x: number, y: number): void {
    for (const c of this.list.values()) {
      if (c.mode === 'stored' || c.hitchedTo !== null || Math.floor(c.x) !== x || Math.floor(c.y) !== y) continue;
      this.moveOff(game, c, x, y);
    }
  }

  /**
   * A creature put down on a tile on piers -- let out of a crate standing on
   * a deck, or at the feet of somebody standing on one -- moved off it as
   * `shoo` moves one. The island's `creature_off_piers`.
   */
  offPiers(game: Game, c: Creature): void {
    const x = Math.floor(c.x), y = Math.floor(c.y);
    if (game.buildings.pierTiles.size && game.buildings.onPiers(x, y)) this.moveOff(game, c, x, y);
  }

  private moveOff(game: Game, c: Creature, x: number, y: number): void {
    const to = this.nearestOk(game, x, y, PIER_SHOO);
    if (!to) return;
    c.x = to[0] + 0.5;
    c.y = to[1] + 0.5;
    c.tx = c.x;
    c.ty = c.y;
    c.moving = false;
    if (c.state === 'wander') c.state = 'idle';
  }

  /** The nearest tile to (x, y) a creature may walk, `reach` tiles off at most, ring by ring, rows from the north; or null. */
  nearestOk(game: Game, x: number, y: number, reach: number): [number, number] | null {
    for (let r = 1; r <= reach; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.tileOk(game, x + dx, y + dy)) return [x + dx, y + dy];
        }
      }
    }
    return null;
  }

  /**
   * Whether a rock face can be worked at all, which is not the same question
   * as whether a body can stand on it.
   *
   * A person may put a pick to a corner under ten units of water — that is
   * `MINE_DEPTH`, about waist deep, and the comment on it says in as many
   * words that you work standing in it. A wildermon could only ever work one
   * under a single unit, because the only question ever asked was whether it
   * could stand there, and a shore face is the whole reason anybody digs at a
   * shore. Reported as a mola that would not touch ore, seam or rock below the
   * tide line.
   *
   * So the same ten units, and a face too deep to stand on is worked from the
   * bank instead — which is what `beside` is for and what a feller, a pruner,
   * an angler and a fruit picker have always done. Past ten it is over
   * everybody's head and nobody swings anything.
   *
   * The tile's own centre rather than one of its corners, which is where this
   * and the person's rule differ and have to: a person puts a pick to a named
   * corner and a worker takes the tile, so the tile's middle is the closest
   * thing it has to the corner being asked about.
   */
  reachableFace(game: Game, x: number, y: number): boolean {
    // Standing on it is still the first answer, and the usual one: dry rock
    // is worked from on top of it exactly as it always was.
    if (this.tileOk(game, x, y)) return true;
    const w = game.world;
    if (!w.inBounds(x, y)) return false;
    // Otherwise the only two questions are how much water is over the face and
    // whether there is a bank to swing from. Its own slope is not asked about
    // — that is a question about standing on it, and nobody is going to.
    if (w.centerHeight(x, y) < -MINE_DEPTH) return false;
    return !!this.beside(game, x, y);
  }

  /**
   * Whether a job is done from the tile beside the one it is done to.
   *
   * A tree, a rod and a fruit bough are always worked from beside, because
   * nothing stands on them. A rock face is worked from beside only when it is
   * standing in water too deep to work from — dry rock is worked from on top
   * of it, as it always was.
   *
   * One function because it used to be two lists that did not agree: the one
   * that chose where to walk had `prune` in it and the one that checked on
   * arrival did not, so a pruner walked to the tile beside a tree and then
   * asked whether the tile it was standing on was a tree worth pruning.
   */
  private worksBeside(game: Game, kind: GatherKind, x: number, y: number): boolean {
    if (kind === 'woodcut' || kind === 'prune' || kind === 'fish' || kind === 'fruit' || kind === 'sprout' || kind === 'resin') return true;
    return (kind === 'mine' || kind === 'quarry') && !this.tileOk(game, x, y);
  }

  /**
   * Whether a stretch of ground is the sort a species settles on. A Mola
   * settles over metal, bare or buried, a Crawler on the sand and a Gorral on
   * bare rock; the rest want something growing. Beyond the ground itself a
   * few of them want water, trees, clay or tar within sight of the door, and
   * a Lume wants the sun down.
   */
  suits(game: Game, def: SpeciesDef | undefined, x: number, y: number): boolean {
    if (!def) return false;
    const w = game.world;
    if (def.onOre) {
      if (!isSeam(bedrockAt(w, x, y))) return false;
    } else if (def.onSand) {
      if (w.getTile(x, y) !== TileType.Sand) return false;
    } else if (def.onStone) {
      // Bare rock with nothing in it: the Mola takes the seams, the Quarra the rest.
      if (w.getTile(x, y) !== TileType.Rock || isSeam(bedrockAt(w, x, y))) return false;
    } else if (!TILE_DEFS[w.getTile(x, y)].forage) return false;
    if (def.nearWater && !nearWater(game, x, y)) return false;
    if (def.nearTrees && !nearTrees(game, x, y)) return false;
    if (def.nearClay && !nearClay(game, x, y)) return false;
    if (def.nearTar && !nearTar(game, x, y)) return false;
    if (def.nocturnal && !game.isNight()) return false;
    return true;
  }

  /** Drop wild creatures on grazing land away from the player and the deed. */
  spawnWild(game: Game, count: number, minDistance = 12): number {
    return this.spawnSpecies(game, null, count, minDistance);
  }

  /**
   * Whether anything at all may be put down here: a question about the ground
   * rather than about the species standing on it.
   */
  private groundOk(game: Game, x: number, y: number, minDistance: number): boolean {
    const w = game.world;
    if (!this.tileOk(game, x, y)) return false;
    if (w.centerHeight(x, y) < 2 || game.onDeed(x, y)) return false;
    return Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y) >= minDistance;
  }

  /**
   * Ground that suits a species, or nothing: `SITE_LOOKS` looks at ground a
   * creature could stand on, given three times that many throws to find them.
   */
  private siteFor(game: Game, id: string, minDistance: number): { x: number; y: number } | null {
    const w = game.world;
    let looks = 0;
    for (let i = 0; i < SITE_LOOKS * 3 && looks < SITE_LOOKS; i++) {
      const x = Math.floor(game.rand() * w.w);
      const y = Math.floor(game.rand() * w.h);
      if (!this.groundOk(game, x, y, minDistance)) continue;
      looks++;
      if (this.suits(game, SPECIES[id], x, y)) return { x, y };
    }
    return null;
  }

  /** As spawnWild, but for one species; pass null to roll the wild mix. */
  spawnSpecies(game: Game, species: string | null, count: number, minDistance = 12): number {
    const w = game.world;
    let placed = 0;
    for (let tries = 0; tries < count * 40 && placed < count; tries++) {
      let x = Math.floor(game.rand() * w.w);
      let y = Math.floor(game.rand() * w.h);
      if (!this.groundOk(game, x, y, minDistance)) continue;
      const id = species ?? (game.rand() < MONSTER_SHARE ? this.pickMonster(game, x, y) : rollTable(WILD_SPECIES, game.rand()));
      if (!id) continue;
      if (!this.suits(game, SPECIES[id], x, y)) {
        /*
         * The roll says what stands up; the ground says where. Throwing the
         * roll away because this tile is wrong for it made a species as common
         * as its weight times the share of the island that suits it, which is
         * how a mola — one in thirty by weight, metal under a seventh of the
         * ground — came out at one in two hundred. A monster keeps the tile it
         * was rolled on: how far it stands from a deed was settled there.
         */
        if (SPECIES[id]?.monster) continue;
        const site = this.siteFor(game, id, minDistance);
        if (!site) continue;
        x = site.x;
        y = site.y;
        tries += SITE_LOOKS;
      }
      // Born at some point in the past, so the country is not all yearlings.
      this.spawn(id, x + 0.5, y + 0.5, 'wild', game.rand, game.time - game.rand() * OLD_AT * 1.6);
      placed++;
    }
    return placed;
  }

  /**
   * Everything alive, once a frame — but not everything at the same rate.
   *
   * What is being watched moves every frame, because you would see it stutter.
   * What is out of sight but close enough to matter thinks a few times a
   * second. What is far away and unwatched keeps its body going — it heals, it
   * grows its fleece, it gets hungry — and thinks once in a while, which is
   * all anybody could tell from where they are standing. That is what lets a
   * map grow: the cost follows what is being looked at rather than what exists.
   */
  update(dt: number, game: Game): void {
    this.clearTiles();
    if (this.fromIsland) {
      this.walkLegs();
      // A heavy blow the island said one is drawing back for runs down here between answers, for the tell.
      for (const c of this.list.values()) if (c.windup > 0) c.windup = Math.max(0, c.windup - dt);
      return;
    }
    this.respawnClock += dt;
    if (this.respawnClock >= RESPAWN_EVERY) {
      this.respawnClock = 0;
      // The island's wildlife grows in the abstract; it only takes a body when
      // somebody is near enough to meet it.
      if (this.wildCount() + this.bankedTotal() < this.islandTarget(game)) this.bankOne(game);
    }
    if (game.time - this.streamAt >= STREAM_EVERY) {
      this.streamAt = game.time;
      this.stream(game);
    }
    this.ticked = { near: 0, far: 0, asleep: 0, thought: 0 };
    const px = game.player.x;
    const py = game.player.y;
    for (const c of this.list.values()) {
      // A young one arrives on its own hour, whether or not anybody is looking
      // and whether its dam is out working or standing at the token.
      if (c.due > 0 && game.time >= c.due) this.giveBirth(game, c);
      if (c.mode === 'stored') continue;
      // A kind that learns by being out, a go for every `OUT_EVERY` of it (after dark, for one that learns in the dark).
      const learns = this.species(c).learns;
      if (learns && (c.mode === 'active' || c.mode === 'deed') && (learns.by === 'out' || (learns.by === 'dark' && game.isNight()))
        && game.rand() < dt / OUT_EVERY) this.learnBy(game, c, learns.by);
      const tier = this.tierOf(game, c, px, py);
      this.ticked[tier]++;
      let step = dt;
      let elapsed = dt;
      if (tier !== 'near') {
        // Out of sight: bank the time and think in longer, rarer steps. Until
        // its turn comes round nothing at all is done to it, which is what
        // keeps the cost of a crowded map off every frame.
        c.owed += dt;
        const every = tier === 'far' ? FAR_STEP : ASLEEP_STEP;
        if (c.owed < every) {
          // Something left to itself is not worth filing under a tile either:
          // nothing is going to look it up out there.
          if (tier === 'far') this.place(c);
          continue;
        }
        elapsed = c.owed;
        // Never hand a creature so much time that it walks through a wall.
        step = Math.min(c.owed, MAX_STEP_TIME);
        c.owed = 0;
      }
      this.ticked.thought++;
      const def = this.body(game, c, elapsed);
      // Held in a trap: it breathes, it heals, it gets hungry. It does not
      // wander off, and it does not fight.
      if (c.trapped !== null) {
        c.enemy = null;
        c.moving = false;
        this.place(c);
        continue;
      }
      // Stunned (`STUN_SECS`): it neither moves nor strikes until the stun runs out, and keeps its fight.
      if ((c.stunUntil ?? 0) > game.time) {
        c.moving = false;
        this.place(c);
        continue;
      }
      // A beast in the traces, or under a rider, goes where it is taken. It
      // heals and grows its fleece like any other; it just does no thinking.
      if (c.hitchedTo !== null || c.ridden) {
        this.place(c);
        continue;
      }

      if (def.unruly && c.mode !== 'wild') this.maybeNip(game, c, def);
      if (game.time >= c.busyUntil) {
        switch (c.mode) {
          case 'wild':
            this.updateWild(c, step, game);
            break;
          case 'active':
            this.updateActive(c, step, game);
            break;
          case 'deed':
            this.updateWorker(c, step, game);
            break;
        }
      }
      if (c.moving) c.walkPhase += step * 12;
      if (tier !== 'asleep') this.place(c);
    }
  }

  /**
   * Lay a whole island's wildlife on the books at once. Nothing is stood up
   * here: the first streaming pass gives bodies to whatever is near enough to
   * be met, which is how a map ten times the size costs the same to start.
   */
  stockIsland(game: Game): void {
    const want = this.islandTarget(game) - this.wildCount() - this.bankedTotal();
    for (let i = 0; i < want; i++) this.bankOne(game);
  }

  /** Which stretch of country a point belongs to. */
  private region(x: number, y: number): number {
    return Math.floor(y / REGION) * 4096 + Math.floor(x / REGION);
  }

  /** How much wildlife is banked across the whole island. */
  bankedTotal(): number {
    let n = 0;
    for (const v of this.banked.values()) n += v;
    return n;
  }

  /** How much wildlife an island of this size should hold in all. */
  private islandTarget(game: Game): number {
    return wildTargetFor(game.world.w, game.world.h);
  }

  /** Put one more head of wildlife on the books, somewhere out there. */
  private bankOne(game: Game): void {
    const w = game.world;
    for (let tries = 0; tries < 20; tries++) {
      const x = Math.floor(game.rand() * w.w);
      const y = Math.floor(game.rand() * w.h);
      if (!this.tileOk(game, x, y) || w.centerHeight(x, y) < 2 || game.onDeed(x, y)) continue;
      const r = this.region(x, y);
      this.banked.set(r, (this.banked.get(r) ?? 0) + 1);
      return;
    }
  }

  /**
   * Put away what has been left behind and let out what has been come upon.
   * This is the whole of streaming: the island keeps its wildlife as numbers,
   * and only the stretch of it being walked costs anything.
   */
  private stream(game: Game): void {
    const px = game.player.x;
    const py = game.player.y;
    // Away and unwatched: put it back on the books.
    for (const c of [...this.list.values()]) {
      if (c.mode !== 'wild' || c.trapped !== null) continue;
      if (c.enemy !== null || c.attackedBy !== null) continue;
      const d = Math.max(Math.abs(c.x - px), Math.abs(c.y - py));
      if (d <= CULL_RANGE || game.vision.isWatched(c.x, c.y)) continue;
      const r = this.region(c.x, c.y);
      this.banked.set(r, (this.banked.get(r) ?? 0) + 1);
      this.list.delete(c.id);
    }
    // Come upon: let out what belongs to the country around you, a few at a time.
    let out = 0;
    const reach = Math.ceil(LIVE_RANGE / REGION) + 1;
    const rx = Math.floor(px / REGION);
    const ry = Math.floor(py / REGION);
    for (let gy = ry - reach; gy <= ry + reach && out < STREAM_BATCH; gy++) {
      for (let gx = rx - reach; gx <= rx + reach && out < STREAM_BATCH; gx++) {
        if (gx < 0 || gy < 0) continue;
        const r = gy * 4096 + gx;
        let owed = this.banked.get(r) ?? 0;
        while (owed > 0 && out < STREAM_BATCH) {
          if (!this.releaseInto(game, gx, gy)) break;
          owed--;
          out++;
        }
        if (owed > 0) this.banked.set(r, owed);
        else this.banked.delete(r);
      }
    }
  }

  /** Try to stand a creature up somewhere in one stretch of country. */
  private releaseInto(game: Game, gx: number, gy: number): boolean {
    const w = game.world;
    const px = game.player.x;
    const py = game.player.y;
    for (let tries = 0; tries < 24; tries++) {
      const x = gx * REGION + Math.floor(game.rand() * REGION);
      const y = gy * REGION + Math.floor(game.rand() * REGION);
      if (!w.inBounds(x, y) || !this.tileOk(game, x, y)) continue;
      if (w.centerHeight(x, y) < 2 || game.onDeed(x, y)) continue;
      // Never where it could be seen appearing, and never so far off that it
      // would be put away again on the next pass.
      const d = Math.max(Math.abs(x + 0.5 - px), Math.abs(y + 0.5 - py));
      if (d < 30 || d > LIVE_RANGE) continue;
      // Now and again what stands up out there is not a wildermon at all.
      const id = game.rand() < MONSTER_SHARE ? this.pickMonster(game, x, y) : rollTable(WILD_SPECIES, game.rand());
      if (!id || !this.suits(game, SPECIES[id], x, y)) continue;
      this.spawn(id, x + 0.5, y + 0.5, 'wild', game.rand, game.time - game.rand() * OLD_AT * 1.6);
      return true;
    }
    return false;
  }

  /**
   * Which of the bad things, if any. Each sort is capped across the island and
   * the big ones keep away from anywhere anybody lives: nothing walks out of
   * the trees onto your deed.
   */
  private pickMonster(game: Game, x: number, y: number): string | null {
    const alive: Record<string, number> = {};
    for (const c of this.list.values()) if (c.mode === 'wild') alive[c.species] = (alive[c.species] ?? 0) + 1;
    const room = MONSTERS.filter(([id]) => (alive[id] ?? 0) < (MONSTER_CAP[id] ?? 1));
    if (!room.length) return null;
    const id = rollTable(room, game.rand());
    // A settlement keeps the worst of it at arm's length. The bigger the
    // thing, the further out it wants to be.
    const deed = game.deed;
    if (deed) {
      if (Math.hypot(x - deed.x, y - deed.y) < (MONSTER_KEEP_OFF[id] ?? 0)) return null;
    }
    return id;
  }

  /**
   * The part of a creature that goes on whether it is thinking or not: wounds
   * closing, fleece growing, a cooldown running out. It is handed all the time
   * banked since its last turn, so a creature left alone for a minute comes
   * back as rested as one that was watched the whole while.
   */
  private body(game: Game, c: Creature, elapsed: number): SpeciesDef {
    const def = this.species(c);
    c.cooldown = Math.max(0, c.cooldown - elapsed);
    /*
     * A knife's bleeding, for the part of the time banked that it ran, and
     * never the last of it: what finishes a thing is a blow (`KNIFE_BLEED`).
     */
    const from = Math.max(game.time - elapsed, c.bleedFrom ?? c.bleedUntil - KNIFE_BLEED_SECS);
    const secs = Math.min(game.time, c.bleedUntil) - from;
    if (secs > 0) {
      if (c.health > 1) c.health = Math.max(1, c.health - c.bleedRate * secs);
      // And while it bleeds it is hurt, so it mends nothing.
      c.attackedAt = Math.max(c.attackedAt, from + secs);
    }
    c.moving = false;
    const top = maxHealth(c, def);
    if (c.health > top) c.health = top;
    else if (c.health < top && game.time - c.attackedAt > 6) c.health = Math.min(top, c.health + elapsed * (c.mode === 'wild' ? 0.25 : 0.6) * bloodMul(c, 'mend'));
    // A yearling grows no fleece and gives no milk; an old one is slower at both.
    const growth = ageDef(c, game.time).growth;
    if (def.fleece && growth > 0 && c.fleece < 1) c.fleece = Math.min(1, c.fleece + elapsed * def.fleece * growth * bloodMul(c, 'grow'));
    // A brushing wears off over a few hours of being left to itself: longer for a Herdsman's Lasting Care.
    if (c.care > 0) c.care = Math.max(0, c.care - elapsed / (keptOf(c, 'kept:care_hours', CARE_HOURS) * 3600));
    return def;
  }

  /** How closely a creature is being followed, and so how often it thinks. */
  private tierOf(game: Game, c: Creature, px: number, py: number): 'near' | 'far' | 'asleep' {
    const d = Math.max(Math.abs(c.x - px), Math.abs(c.y - py));
    if (d <= NEAR_RANGE) return 'near';
    // Outside the box that anything can see into, there is no need to ask.
    const b = game.vision.bounds;
    const maybe = !game.settings.fog || (!!b && c.x >= b.x0 && c.x <= b.x1 + 1 && c.y >= b.y0 && c.y <= b.y1 + 1);
    if (maybe && game.vision.isWatched(c.x, c.y)) return 'near';
    // Your own creatures are never left entirely to themselves: a deed worker
    // out of sight is still meant to be working.
    if (c.mode !== 'wild') return 'far';
    return d <= FAR_RANGE ? 'far' : 'asleep';
  }

  /** File a creature under the tile it is standing on, for quick lookups. */
  private place(c: Creature): void {
    const key = tileKey(Math.floor(c.x), Math.floor(c.y));
    let arr = this.byTile.get(key);
    if (!arr) {
      arr = [];
      this.byTile.set(key, arr);
    }
    if (!arr.length) this.filled.push(key);
    arr.push(c);
  }

  /**
   * Empty the tile index for the tick about to be filled.
   *
   * Only the tiles that were written to, and the arrays are kept: a creature
   * that is standing still stands on the same tile next frame, so the array is
   * wanted again in a moment. The whole map goes only when it has grown past
   * what any one tick could want, which is a herd having wandered over a great
   * deal of country since the map was last thrown away.
   */
  private clearTiles(): void {
    if (this.byTile.size > TILE_SLACK) {
      this.byTile.clear();
      this.filled.length = 0;
      return;
    }
    for (const key of this.filled) {
      const arr = this.byTile.get(key);
      if (arr) arr.length = 0;
    }
    this.filled.length = 0;
  }

  /**
   * Some creatures never quite stop being wild. Now and then, with its keeper
   * in reach, one of those gets its chance and takes it.
   */
  private maybeNip(game: Game, c: Creature, def: SpeciesDef): void {
    if (game.time < c.nipAt) return;
    c.nipAt = game.time + NIP_EVERY;
    const p = game.player;
    if (Math.hypot(p.x - c.x, p.y - c.y) > 2 || game.rand() >= (def.unruly ?? 0)) return;
    p.attackedBy = c.id;
    p.attackedAt = game.time;
    game.hurtPlayer(attackOf(c, def) * BLOW_SHARE, `${c.name} rounds on you and gets a claw in`, def.wound ?? 'bite');
  }

  private stepToward(game: Game, c: Creature, tx: number, ty: number, dt: number, speedMul = 1): MoveResult {
    const dx = tx - c.x;
    const dy = ty - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.12) return 'arrived';
    // Rooted where it stands (`binder_root`): it goes nowhere until the root lets go.
    if (markOn(game, c, 'root', 0) > 0) return 'moving';
    const pace = c.mode === 'deed' ? 1 + Math.max(1, ...Object.values(c.skills)) / 500 : 1;
    // And slower while a frost holds it (`frost`), as the island's `beast_mul` has a slow.
    const slow = (c.slowUntil ?? 0) > game.time ? c.slowPace ?? 1 : 1;
    const step = Math.min(this.species(c).speed * ageDef(c, game.time).speed * this.speedMul(c) * speedMul * pace * slow * dt, dist);
    const vx = dx / dist;
    const vy = dy / dist;
    const nx = c.x + vx * step;
    const ny = c.y + vy * step;
    let moved = false;
    if (this.canMove(game, c.x, c.y, nx, ny)) {
      c.x = nx;
      c.y = ny;
      moved = true;
    } else if (Math.abs(nx - c.x) > 1e-6 && this.canMove(game, c.x, c.y, nx, c.y)) {
      c.x = nx;
      moved = true;
    } else if (Math.abs(ny - c.y) > 1e-6 && this.canMove(game, c.x, c.y, c.x, ny)) {
      c.y = ny;
      moved = true;
    }
    if (!moved) return 'blocked';
    c.dirX = vx;
    c.dirY = vy;
    c.moving = true;
    return 'moving';
  }

  private canMove(game: Game, fx: number, fy: number, tx: number, ty: number): boolean {
    const tX = Math.floor(tx);
    const tY = Math.floor(ty);
    if (!this.tileOk(game, tX, tY)) return false;
    const fX = Math.floor(fx);
    const fY = Math.floor(fy);
    if (fX !== tX || fY !== tY) {
      if (!groundStep(game.world, fX, fY, tX, tY)) return false;
      if (game.buildings.blocksAt(0, fX, fY, tX, tY, true)) return false;
    }
    return true;
  }

  private wanderTarget(game: Game, c: Creature, radius: number, aroundX = c.x, aroundY = c.y): void {
    for (let i = 0; i < 8; i++) {
      const x = aroundX + (game.rand() * 2 - 1) * radius;
      const y = aroundY + (game.rand() * 2 - 1) * radius;
      if (this.tileOk(game, Math.floor(x), Math.floor(y))) {
        c.tx = x;
        c.ty = y;
        c.state = 'wander';
        return;
      }
    }
    c.state = 'idle';
    c.until = game.time + 2;
  }

  /**
   * What a field wants next, or null. A farm worker only ever works ground
   * that has already been tilled; it never rakes a field of its own.
   */
  farmJobAt(game: Game, c: Creature, x: number, y: number): FarmJob | null {
    if (game.world.getTile(x, y) !== TileType.Field) return null;
    const crop = game.cropAt(x, y);
    if (!crop) return this.seedFor(game, c) ? 'sow' : null;
    if (cropReady(crop)) return 'harvest';
    return crop.tendedNow ? null : 'tend';
  }

  /**
   * A seed to put in the ground: one out of its own cheeks first, and failing
   * that one from any store on the deed — the settlement crate, a bin, a chest,
   * whichever has seed in it. `store` is null when the seed is its own.
   */
  private seedFor(game: Game, c: Creature): { seed: Item; store: DeedStore | null } | null {
    if (c.pouch && CROP_BY_SEED.has(c.pouch.id) && c.pouch.count > 0) return { seed: c.pouch, store: null };
    for (const store of game.deedStores()) {
      const seed = store.items.find((it: Item) => CROP_BY_SEED.has(it.id) && it.count > 0);
      if (seed) return { seed, store };
    }
    return null;
  }

  /** Whether another worker is already on its way to this tile, or working it. */
  private claimed(x: number, y: number, self?: Creature): boolean {
    for (const o of this.list.values()) {
      if (o === self || o.mode !== 'deed') continue;
      if (o.workX === x && o.workY === y && (o.state === 'toForage' || o.state === 'forage')) return true;
    }
    return false;
  }

  /**
   * Whether a tile can be foraged, botanized, felled, farmed or mined right now.
   *
   * The floor under the two mining trades is the person's floor — ten units of
   * water, `MINE_DEPTH` — and not the waterline. It read `rockHeight > 1`,
   * which is a waterline rule wearing the clothes of an "is there any rock
   * here" one: bedrock at minus three is bedrock three under the sea, so every
   * tile under water failed it however shallow, and no depth allowance
   * anywhere else could have helped. A person has no such rule; their pick
   * stops at ten under and so does this.
   */
  /**
   * Whether a tile is this kind of work, which `shore.ts` asks of both sides
   * over the same ground — so it is open the way `reachableFace` is, and for
   * the same reason.
   */
  gatherable(game: Game, x: number, y: number, kind: GatherKind, c?: Creature): boolean {
    if (kind === 'mine') {
      // One seam to a miner, and only metal its skill can work.
      const ore = oreAt(game.world, x, y);
      if (!ore || (c && (c.skills[GATHER_SKILL.mine] ?? 1) < ore.level)) return false;
      return game.world.rockHeight(x, y) > -MINE_DEPTH && this.reachableFace(game, x, y) && !this.claimed(x, y, c);
    }
    if (kind === 'sand' || kind === 'clay') {
      // Soft ground left on a corner of the right sort of tile, and one digger to it.
      if (game.world.getTile(x, y) !== (kind === 'sand' ? TileType.Sand : TileType.Clay)) return false;
      return this.sandCorner(game, x, y) !== null && this.tileOk(game, x, y) && !this.claimed(x, y, c);
    }
    // Stoking and guarding are not tile work; they never send a worker walking to one.
    if (kind === 'stoke' || kind === 'guard') return false;
    // A hive standing on the tile, which as many swarms may tend as like (`hiveAt`): no claim on it.
    if (kind === 'hive') return hiveAt(game, x, y) !== undefined;
    // The errands at the stores and at your own are never a tile's work.
    if (TEND_JOBS.has(kind)) return false;
    if (kind === 'bush') {
      // A bush in its season with nothing taken off it today, or a trellis whose vine is ripe (`vineStage`).
      if (this.claimed(x, y, c) || !this.tileOk(game, x, y)) return false;
      if (ripeTrellisAt(game, x, y)) return true;
      if (game.world.getTile(x, y) !== TileType.Bush) return false;
      const yields = BUSH_DEFS[bushSpecies(game.world.getData(x, y))].yields;
      return !!yields && fruitsAt(yields, game.wallNow()) && !game.isForaged(x, y, 'forage');
    }
    if (kind === 'grass') {
      // Grass that has grown back since its last cut, or moss.
      if (this.claimed(x, y, c) || !this.tileOk(game, x, y)) return false;
      const t = game.world.getTile(x, y);
      if (t === TileType.Moss) return !game.isForaged(x, y, 'moss');
      return CUT_GRASS.has(t) && !game.isForaged(x, y, 'grass');
    }
    if (kind === 'pan') {
      // Sand with the water at one of its corners, as a person's pan wants (`besideWater`).
      return game.world.getTile(x, y) === TileType.Sand && besideWater(game, x, y) && this.tileOk(game, x, y) && !this.claimed(x, y, c);
    }
    if (kind === 'worm') {
      // Ground a spade turns worms up in, dry, and not turned over since it last rested as a forage bed does.
      return WORMY.has(game.world.getTile(x, y)) && !game.world.hasWater(x, y) && this.tileOk(game, x, y)
        && !game.isForaged(x, y, 'worm') && !this.claimed(x, y, c);
    }
    if (kind === 'sprout' || kind === 'resin') {
      // A living tree, picked from beside it, and a sprout taken off it not lately; a pine big enough to tap, not tapped since dawn.
      if (game.world.getTile(x, y) !== TileType.Tree || !this.beside(game, x, y) || this.claimed(x, y, c)) return false;
      const data = game.world.getData(x, y);
      if (kind === 'sprout') return treeAge(data).alive && !game.isForaged(x, y, 'sprout');
      return treeSpecies(data) === RESIN_TREE && tappable(data) && !game.tappedToday(x, y);
    }
    if (kind === 'flower') {
      // In flower, and not where a skep gathers (`SKEP_REACH`): its honey is the flowers in reach of it.
      if (flowersHere(game, x, y, game.wallNow()) <= 0 || !this.tileOk(game, x, y) || this.claimed(x, y, c)) return false;
      for (const f of game.furniture.values()) if (f.kind === SKEP && Math.max(Math.abs(f.x - x), Math.abs(f.y - y)) <= SKEP_REACH) return false;
      return true;
    }
    if (kind === 'scrub') return this.tileOk(game, x, y) && !this.claimed(x, y, c) && greenOnTile(game, x, y, greenNow()) > 0;
    if (kind === 'quarry') {
      // Bare stone with no metal in it, and one cutter to a face.
      const rock = bedrockAt(game.world, x, y);
      if (game.world.getTile(x, y) !== TileType.Rock || isSeam(rock)) return false;
      return game.world.rockHeight(x, y) > -MINE_DEPTH && this.reachableFace(game, x, y) && !this.claimed(x, y, c);
    }
    if (kind === 'peat') {
      // A bed of the black stuff, taken off the top and left as it was.
      const t = game.world.getTile(x, y);
      if (t !== TileType.Peat && t !== TileType.Tar) return false;
      return this.tileOk(game, x, y) && !game.isForaged(x, y, 'dig') && !this.claimed(x, y, c);
    }
    if (kind === 'reed') {
      if (game.world.getTile(x, y) !== TileType.Reed) return false;
      return !game.isForaged(x, y, 'reed') && !!this.beside(game, x, y) && !this.claimed(x, y, c);
    }
    if (kind === 'fish') {
      // Water with depth in it, and a bank beside it to stand a rod on.
      if (!fishable(game, x, y)) return false;
      return !game.isForaged(x, y, 'reed') && !!this.beside(game, x, y) && !this.claimed(x, y, c);
    }
    if (kind === 'seek') {
      // Ground nobody has been over yet, which is the only ground worth a nose.
      if (game.world.hasWater(x, y) || !DIGGABLE.has(game.world.getTile(x, y))) return false;
      return this.tileOk(game, x, y) && !game.isForaged(x, y, 'dig') && !this.claimed(x, y, c);
    }
    if (kind === 'fetch') {
      // Anything lying on the deed that is not already somebody's errand.
      if (!game.onDeed(x, y) || !game.groundAt(x, y).length) return false;
      return this.tileOk(game, x, y) && !this.claimed(x, y, c);
    }
    if (kind === 'farm') return !!c && this.farmJobAt(game, c, x, y) !== null;
    if (kind === 'woodcut') return game.world.getTile(x, y) === TileType.Tree && !!this.beside(game, x, y);
    if (kind === 'prune') {
      // What would otherwise die: a stage that prunes back and whose next
      // stage has no life in it. Nothing else is touched — a mature tree
      // pruned stops bearing, and a sapling pruned is a shrub for good.
      if (game.world.getTile(x, y) !== TileType.Tree || !this.beside(game, x, y)) return false;
      const age = treeAge(game.world.getData(x, y));
      return age.pruned !== null && age.next !== null && !TREE_AGES[age.next].alive;
    }
    if (kind === 'fruit') {
      // A bearing tree with something on it, and a tile beside it to stand on.
      if (game.world.getTile(x, y) !== TileType.Tree || !this.beside(game, x, y)) return false;
      const data = game.world.getData(x, y);
      const age = treeAge(data);
      // And in its season (`fruiting.ts`): out of it there is nothing to climb for.
      const fruit = TREE_DEFS[treeSpecies(data)].fruit;
      return !!fruit && fruitsAt(fruit, game.wallNow()) && age.bears && age.alive && !game.isForaged(x, y, 'forage') && !this.claimed(x, y, c);
    }
    if (kind === 'stump') return game.world.getTile(x, y) === TileType.Stump && this.tileOk(game, x, y);
    const def = TILE_DEFS[game.world.getTile(x, y)];
    return !!(kind === 'forage' ? def.forage : def.botanize) && !game.isForaged(x, y, kind);
  }

  /**
   * The corner of a tile there is still a load to be had from: above the water,
   * with soil over the rock. The highest goes first, so the pit a digger leaves
   * comes out level rather than ragged.
   */
  private sandCorner(game: Game, x: number, y: number): [number, number] | null {
    const w = game.world;
    let best: [number, number] | null = null;
    let bestH = -Infinity;
    for (const [cx, cy] of [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ]) {
      const h = w.getHeight(cx, cy);
      if (h <= 0 || w.getDirt(cx, cy) <= 0) continue;
      if (h > bestH) {
        bestH = h;
        best = [cx, cy];
      }
    }
    return best;
  }

  /**
   * A tree blocks movement, so a feller works from a tile beside it: the one
   * nearest whoever is walking there, since it cannot path around the trunk.
   */
  private beside(game: Game, x: number, y: number, fromX = x, fromY = y): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!this.tileOk(game, nx, ny)) continue;
      const d = Math.hypot(nx + 0.5 - fromX, ny + 0.5 - fromY);
      if (d < bestD) {
        bestD = d;
        best = { x: nx, y: ny };
      }
    }
    return best;
  }

/**
   * Nearest tile within `range` of a point that can be gathered from right now.
   * Searched in rings outward, stopping one ring past the first hit, so a
   * skilled worker allowed to range a hundred tiles still costs a handful of
   * checks while there is anything to pick near the token.
   */
  private findForageTile(game: Game, cx: number, cy: number, range: number, kind: GatherKind, who?: Creature): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    const visit = (x: number, y: number): void => {
      // A tree is never walkable, so a feller, a pruner, a picker and a tapper judge the tile beside it instead.
      if (kind !== 'woodcut' && kind !== 'prune' && kind !== 'fruit' && kind !== 'sprout' && kind !== 'resin' && !this.tileOk(game, x, y)) return;
      if (!this.gatherable(game, x, y, kind, who)) return;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + game.rand() * 1.5;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    };
    let lastRing = Infinity;
    for (let r = 0; r <= range && r <= lastRing; r++) {
      if (r === 0) visit(x0, y0);
      else {
        for (let x = x0 - r; x <= x0 + r; x++) {
          visit(x, y0 - r);
          visit(x, y0 + r);
        }
        for (let y = y0 - r + 1; y <= y0 + r - 1; y++) {
          visit(x0 - r, y);
          visit(x0 + r, y);
        }
      }
      // One more ring after the first hit, so the pick is not a hard square shell.
      if (best && lastRing === Infinity) lastRing = r + 1;
    }
    return best;
  }

  private beginForage(game: Game, c: Creature, kind: GatherKind): void {
    c.state = 'forage';
    c.until = game.time + (c.mode === 'deed' ? workDuration(c.skills[GATHER_SKILL[kind]] ?? 1) / this.workMul(c) : FORAGE_TIME);
  }

  /**
   * Finish gathering: the tile goes on cooldown as if a player had picked it
   * over. Workers roll like a player of their skill and learn from it at half
   * a player's pace.
   */
  private finishForage(game: Game, c: Creature, kind: GatherKind): Item | null {
    const x = Math.floor(c.x);
    const y = Math.floor(c.y);
    if (kind === 'woodcut') return this.finishFelling(game, c);
    if (kind === 'prune') return this.finishPruning(game, c);
    if (kind === 'stump') return this.finishStumping(game, c);
    if (kind === 'farm') return this.finishFarming(game, c, x, y);
    if (kind === 'mine') return this.finishMining(game, c);
    if (kind === 'sand' || kind === 'clay') return this.finishDigging(game, c, kind === 'sand' ? 'sand' : 'clay');
    if (kind === 'stoke' || kind === 'guard') return null;
    // Tending a hive brings nothing home: the hive fills itself while a swarm keeps it (`Game.fillHive`).
    if (kind === 'hive') return null;
    if (kind === 'bush' || kind === 'grass' || kind === 'pan') return this.finishHands(game, c, kind, x, y);
    if (kind === 'worm' || kind === 'flower' || kind === 'scrub') return this.finishHands(game, c, kind, x, y);
    if (kind === 'sprout' || kind === 'resin') return this.finishHands(game, c, kind, c.workX, c.workY);
    if (kind === 'quarry') return this.finishQuarry(game, c);
    if (kind === 'peat') return this.finishPeat(game, c);
    if (kind === 'reed') return this.finishReed(game, c);
    if (kind === 'fruit') return this.finishFruit(game, c);
    if (kind === 'fish') return this.finishFish(game, c);
    if (kind === 'seek') return this.finishSeek(game, c);
    if (kind === 'fetch') return this.finishFetch(game, c);
    game.markForaged(x, y, kind);
    // Only what is in season is there to find (`fruiting.ts`), the rest at the weights they had.
    const table = inSeason(GATHER_TABLE[kind], game.wallNow());
    // An errand has no table to roll on: it is done where it is done, and
    // whatever it produced was handed over there.
    if (!table.length) return null;
    if (c.mode !== 'deed') {
      if (game.rand() < 0.25) return null;
      const id = rollTable(table, game.rand());
      return { uid: game.inventory.nextUid++, id, ql: 5 + game.rand() * 30, dmg: 0, count: 1 };
    }
    const skillId = GATHER_SKILL[kind];
    const skill = c.skills[skillId] ?? 1;
    this.gainSkill(game, c, skillId, 0.225);
    const careful = this.yieldMul(c);
    const chance = Math.min(0.98, Math.max(0.3, 0.6 + (skill / 100) * 0.38 - 5 / 150) * careful);
    if (game.rand() < 0.2 || game.rand() >= chance) return null;
    const id = rollTable(table, game.rand());
    const ql = Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1) * careful);
    return { uid: game.inventory.nextUid++, id, ql, dmg: 0, count: 1 };
  }

  /**
   * Picking a bush or a vine, cutting grass or moss, and panning: the load
   * the worker carries home, as much as a person's hands would take at its
   * skill. The island's `worker_do`.
   */
  private finishHands(game: Game, c: Creature, kind: GatherKind, x: number, y: number): Item | null {
    if (c.mode !== 'deed') return null;
    const skillId = GATHER_SKILL[kind];
    const skill = c.skills[skillId] ?? 1;
    this.gainSkill(game, c, skillId, 0.225);
    const ql = this.madeQl(game, c, skill);
    const load = (id: string, count: number): Item => ({ uid: game.inventory.nextUid++, id, ql, dmg: 0, count });
    const w = game.world;
    if (kind === 'bush') {
      const trellis = ripeTrellisAt(game, x, y);
      if (trellis) {
        trellis.pickedAt = game.wallNow();
        game.events.emit('world', x, y);
        return load(GRAPE, grapesFor(skill));
      }
      if (w.getTile(x, y) !== TileType.Bush) return null;
      const yields = BUSH_DEFS[bushSpecies(w.getData(x, y))].yields;
      if (!yields) return null;
      game.markForaged(x, y, 'forage');
      // As a person's sickle takes off a bush (`harvest_bush`): more to a practised hand, and never nothing.
      return load(yields, Math.max(1, Math.round(3 * (0.5 + skill / 130) * (0.7 + game.rand() * 0.6))));
    }
    if (kind === 'grass') {
      const t = w.getTile(x, y);
      if (t === TileType.Moss) {
        game.markForaged(x, y, 'moss');
        return load('moss', MOSS_PER_CUT);
      }
      game.markForaged(x, y, 'grass');
      // Grass kept cut on a settlement becomes lawn, as it does under your own hands (`cut_grass`).
      if (t === TileType.Grass && game.onDeed(x, y)) {
        w.setTile(x, y, TileType.Grass, mownDays(w.getData(x, y)) | MOWN_TODAY);
        game.events.emit('world', x, y);
      }
      return load('mixed_grass', GRASS_PER_CUT);
    }
    if (kind === 'worm') {
      // As a person's spade turns them up (`dig_worms`): more in a marsh or under moss, and now and then none.
      game.markForaged(x, y, 'worm');
      const rich = RICH_WORMS.has(w.getTile(x, y));
      const n = Math.floor(game.rand() * (rich ? 5 : 3)) + (rich ? 1 : 0);
      return n > 0 ? { ...load('worm', n), ql: 20 + game.rand() * 40 } : null;
    }
    if (kind === 'sprout') {
      if (w.getTile(x, y) !== TileType.Tree) return null;
      game.markForaged(x, y, 'sprout');
      return { ...load('sprout', 1), extra: TREE_DEFS[treeSpecies(w.getData(x, y))].name };
    }
    if (kind === 'resin') {
      if (w.getTile(x, y) !== TileType.Tree) return null;
      game.markTapped(x, y);
      return load('tar', RESIN_TAPPED);
    }
    if (kind === 'flower') {
      // A wildflower for each clump on the tile, and the tile picked bare until the year turns (`FLOWERS_PICKED`).
      const n = flowersHere(game, x, y, game.wallNow());
      if (n <= 0) return null;
      w.setTile(x, y, w.getTile(x, y), w.getData(x, y) | FLOWERS_PICKED);
      game.events.emit('world', x, y);
      return load('wildflowers', n);
    }
    if (kind === 'scrub') {
      // Back to bare stone: the clock on all of it starts again, as under your own brush and sickle. Nothing is carried home.
      scrubTile(game, x, y, greenNow());
      return null;
    }
    // Panning: something in the pan `panFind` of the time, one of what a person's pan turns up.
    if (game.rand() >= panFind(skill)) return null;
    return load(PAN_ORES[Math.floor(game.rand() * PAN_ORES.length)], 1);
  }

  /** Fell the tree a worker walked to, and hand it the log it carries home. */
  private finishFelling(game: Game, c: Creature): Item | null {
    const tx = c.workX;
    const ty = c.workY;
    if (game.world.getTile(tx, ty) !== TileType.Tree) return null;
    const data = game.world.getData(tx, ty);
    const def = TREE_DEFS[treeSpecies(data)];
    const age = treeAge(data);
    const skill = c.skills[GATHER_SKILL.woodcut] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.woodcut, 0.225);
    // A worker swings the same number of times a person would, and the notch
    // it leaves is the same notch: anybody may finish the tree it started.
    const cuts = game.world.notchAt(tx, ty) + 1;
    if (cuts < age.hits) {
      game.world.setNotch(tx, ty, cuts);
      return null;
    }
    const logs = age.logs;
    // A tree with timber in it leaves a stump, as it does under a hatchet.
    game.world.setTile(tx, ty, logs ? TileType.Stump : TileType.Grass, logs ? packTreeData(treeSpecies(data), 0) : 0);
    if (!logs) return null;
    const ql = Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1));
    // The rest of the tree is left at the stump; it can only carry one at a time.
    if (logs > 1) {
      game.dropOnGround(tx, ty, { uid: game.inventory.nextUid++, id: 'log', ql, dmg: 0, count: logs - 1, extra: def.name });
    }
    return { uid: game.inventory.nextUid++, id: 'log', ql, dmg: 0, count: 1, extra: def.name };
  }

  /** Prune the tree a forester walked to back a stage. It carries nothing home. */
  private finishPruning(game: Game, c: Creature): Item | null {
    const tx = c.workX;
    const ty = c.workY;
    if (game.world.getTile(tx, ty) !== TileType.Tree) return null;
    const data = game.world.getData(tx, ty);
    const age = treeAge(data);
    if (age.pruned === null) return null;
    this.gainSkill(game, c, GATHER_SKILL.prune, 0.225);
    // The age and nothing else, as under a sickle: the species stays, and so
    // does any notch, since the tile is still a tree.
    game.world.setTile(tx, ty, TileType.Tree, packTreeData(treeSpecies(data), age.pruned));
    return null;
  }

  /** Dig out the stump a forester walked to. Bare dirt where it stood. */
  private finishStumping(game: Game, c: Creature): Item | null {
    const tx = c.workX;
    const ty = c.workY;
    if (game.world.getTile(tx, ty) !== TileType.Stump) return null;
    this.gainSkill(game, c, GATHER_SKILL.stump, 0.225);
    game.world.setTile(tx, ty, TileType.Dirt);
    return null;
  }

  /** Work the seam a miner walked to, and hand it the ore it carries home. */
  private finishMining(game: Game, c: Creature): Item | null {
    const ore = oreAt(game.world, c.workX, c.workY);
    if (!ore) return null;
    const skill = c.skills[GATHER_SKILL.mine] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.mine, 0.225);
    // Its own skill decides the metal, though no seam gives up more than it holds.
    const ql = Math.min(ore.maxQl, Math.max(1, Math.min(100, skill * (0.6 + game.rand() * 0.8) + 1)));
    // As with a miner's pick, the face only comes down by luck -- and never a corner of a building (`piers.ts`).
    if (game.rand() < MINE_COLLAPSE && game.world.rockHeight(c.workX, c.workY) > 1 && !game.buildings.aroundCorner(c.workX, c.workY)) {
      game.world.setHeight(c.workX, c.workY, game.world.getHeight(c.workX, c.workY) - 1);
      game.world.setDirt(c.workX, c.workY, 0);
      game.exposeRock(c.workX, c.workY);
    }
    return { uid: game.inventory.nextUid++, id: ore.yields, ql, dmg: 0, count: 1 };
  }

  /** Dig out the ground a worker walked to, and hand it the load it carries home. */
  private finishDigging(game: Game, c: Creature, yields: 'sand' | 'clay'): Item | null {
    const corner = this.sandCorner(game, c.workX, c.workY);
    if (!corner) return null;
    const [cx, cy] = corner;
    const w = game.world;
    const skill = c.skills.digging ?? 1;
    this.gainSkill(game, c, 'digging', 0.225);
    // Claws take the ground down the same way a shovel does.
    w.setHeight(cx, cy, w.getHeight(cx, cy) - 1);
    const left = w.getDirt(cx, cy) - 1;
    w.setDirt(cx, cy, left);
    if (left <= 0) game.exposeRock(cx, cy);
    game.events.emit('world', c.workX, c.workY);
    const ql = Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1));
    return { uid: game.inventory.nextUid++, id: yields, ql, dmg: 0, count: 1 };
  }

  /** Cut stone from the face a quarrier walked to. */
  private finishQuarry(game: Game, c: Creature): Item | null {
    const w = game.world;
    const rock = bedrockAt(w, c.workX, c.workY);
    if (w.getTile(c.workX, c.workY) !== TileType.Rock || isSeam(rock)) return null;
    const skill = c.skills[GATHER_SKILL.quarry] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.quarry, 0.225);
    const ql = Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1));
    // Cutting the face back is a matter of luck, as it is for a miner -- and never a corner of a building (`piers.ts`).
    if (game.rand() < MINE_COLLAPSE && w.rockHeight(c.workX, c.workY) > 1 && !game.buildings.aroundCorner(c.workX, c.workY)) {
      w.setHeight(c.workX, c.workY, w.getHeight(c.workX, c.workY) - 1);
      w.setDirt(c.workX, c.workY, 0);
      game.exposeRock(c.workX, c.workY);
    }
    return { uid: game.inventory.nextUid++, id: rock.yields, ql, dmg: 0, count: 1 };
  }

  /** Cut a shovel of peat or tar without touching the shape of the bog. */
  private finishPeat(game: Game, c: Creature): Item | null {
    const t = game.world.getTile(c.workX, c.workY);
    const id = t === TileType.Tar ? 'tar' : t === TileType.Peat ? 'peat' : null;
    if (!id) return null;
    const skill = c.skills[GATHER_SKILL.peat] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.peat, 0.225);
    game.markForaged(c.workX, c.workY, 'dig');
    return { uid: game.inventory.nextUid++, id, ql: Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1)), dmg: 0, count: 1 };
  }

  /**
   * A cast off the bank. What comes up follows the same table the player's
   * rod does, only the depth is whatever the worker walked to.
   */
  private finishFish(game: Game, c: Creature): Item | null {
    const skill = c.skills[GATHER_SKILL.fish] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.fish, 0.225);
    game.markForaged(c.workX, c.workY, 'reed');
    const depth = waterDepth(game, c.workX, c.workY);
    const pool = fishHere(depth, skill);
    if (!pool.length || game.rand() > Math.min(0.9, 0.3 + skill / 190)) return null;
    let total = 0;
    for (const f of pool) total += f.weight;
    let roll = game.rand() * total;
    let got = pool[0];
    for (const f of pool) {
      roll -= f.weight;
      if (roll <= 0) {
        got = f;
        break;
      }
    }
    return { uid: game.inventory.nextUid++, id: got.id, ql: Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1)), dmg: 0, count: 1 };
  }

  /**
   * Pick what a bearing tree has on it, as many as a person's hands would
   * take: an old tree carries more than one only just come into bearing.
   * The tree is left picked for the day, as it is behind a person.
   */
  private finishFruit(game: Game, c: Creature): Item | null {
    if (game.world.getTile(c.workX, c.workY) !== TileType.Tree) return null;
    const data = game.world.getData(c.workX, c.workY);
    const def = TREE_DEFS[treeSpecies(data)];
    const age = treeAge(data);
    if (!def.fruit || !age.bears || !age.alive) return null;
    const skill = c.skills[GATHER_SKILL.fruit] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.fruit, 0.225);
    game.markForaged(c.workX, c.workY, 'forage');
    const old = age.id === 2 || age.id === 4;
    const count = Math.max(1, Math.round((old ? 5 : 3) * (0.5 + skill / 130) * (0.7 + game.rand() * 0.6)));
    return { uid: game.inventory.nextUid++, id: def.fruit, ql: Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1)), dmg: 0, count };
  }

  /** Shear a stand of reeds back to the water, as the player's knife would. */
  private finishReed(game: Game, c: Creature): Item | null {
    if (game.world.getTile(c.workX, c.workY) !== TileType.Reed) return null;
    const skill = c.skills[GATHER_SKILL.reed] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.reed, 0.225);
    game.markForaged(c.workX, c.workY, 'reed');
    const count = 1 + Math.floor(skill / 35);
    return { uid: game.inventory.nextUid++, id: 'reed', ql: Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1)), dmg: 0, count };
  }

  /** Nose through a patch of soil for something worked and long buried. */
  private finishSeek(game: Game, c: Creature): Item | null {
    const skill = c.skills[GATHER_SKILL.seek] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.seek, 0.225);
    game.markForaged(c.workX, c.workY, 'dig');
    if (game.rand() > findChance(skill, 30)) return null;
    const within = relicsWithin(skill);
    if (!within.length) return null;
    const relic = within[Math.floor(game.rand() * within.length)];
    const part = 1 + Math.floor(game.rand() * relic.parts);
    const ql = Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8)));
    return {
      uid: game.inventory.nextUid++,
      id: 'fragment',
      ql,
      dmg: 20 + game.rand() * 45,
      count: 1,
      extra: `${relic.name} ${part}/${relic.parts}`,
    };
  }

  /** Pick up one thing lying on the tile a fetcher walked to. */
  private finishFetch(game: Game, c: Creature): Item | null {
    const pile = game.groundAt(c.workX, c.workY);
    if (!pile.length) return null;
    this.gainSkill(game, c, GATHER_SKILL.fetch, 0.12);
    const [item] = game.takeFromGround(c.workX, c.workY, pile[0].uid);
    return item ?? null;
  }

  /** Sow, tend or harvest the field the worker is standing on. */
  private finishFarming(game: Game, c: Creature, x: number, y: number): Item | null {
    const job = this.farmJobAt(game, c, x, y);
    if (!job) return null;
    const skill = c.skills[GATHER_SKILL.farm] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.farm, 0.225);
    const ql = Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1));
    if (job === 'sow') {
      const found = this.seedFor(game, c);
      if (!found) return null;
      const { seed, store } = found;
      seed.count -= 1;
      if (!store && seed.count <= 0) c.pouch = null;
      if (store) {
        if (seed.count <= 0) store.items.splice(store.items.indexOf(seed), 1);
        store.changed();
      }
      const def = CROP_BY_SEED.get(seed.id);
      if (def) game.plantCrop(x, y, def.id, seed.ql);
      return null;
    }
    const crop = game.cropAt(x, y);
    if (!crop) return null;
    if (job === 'tend') {
      crop.tendedNow = true;
      crop.tended += 1;
      crop.ql = (crop.ql * crop.tended + ql) / (crop.tended + 1);
      game.events.emit('world', x, y);
      return null;
    }
    /*
     * Harvest: the crop is carried to the crate and the seed rides home in its
     * cheeks to go in after it. Seed of some other crop still in there — which
     * takes two harvests without a trip home in between, and so almost never
     * happens now the cheeks are emptied at every store — is left on the field
     * for the next sowing, or for whoever is clearing up, to find.
     */
    const def = cropDef(crop.id);
    const y2 = cropYield(crop.tended);
    const grade = Math.max(1, Math.min(100, (crop.ql + ql) / 2));
    game.removeCrop(x, y);
    const seeds: Item = { uid: game.inventory.nextUid++, id: def.seed, ql: grade, dmg: 0, count: y2.seeds };
    if (c.pouch && c.pouch.id === seeds.id) c.pouch.count += seeds.count;
    else if (!c.pouch) c.pouch = seeds;
    else game.dropOnGround(x, y, seeds);
    return { uid: game.inventory.nextUid++, id: def.produce, ql: grade, dmg: 0, count: y2.produce };
  }

  /**
   * A fire, furnace or kiln on the deed that is running low, nearest first.
   * Anything with less than a few minutes in it counts as wanting wood.
   */
  private coldHearth(game: Game, c: Creature, range: number): { x: number; y: number; fuel: number; lit: boolean; kind: Hearth; id: number } | null {
    const deed = game.deed;
    if (!deed) return null;
    let best: { x: number; y: number; fuel: number; lit: boolean; kind: Hearth; id: number } | null = null;
    let bestD = Infinity;
    const consider = (x: number, y: number, fuel: number, lit: boolean, kind: Hearth, id: number): void => {
      if (fuel >= HEARTH_FULL) return;
      if (Math.max(Math.abs(x - deed.x), Math.abs(y - deed.y)) > range) return;
      const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
      if (d < bestD) {
        bestD = d;
        best = { x, y, fuel, lit, kind, id };
      }
    };
    for (const f of game.campfires.values()) consider(...(fireCentre(f).map(Math.floor) as [number, number]), f.fuel, f.lit, 'campfire', f.id);
    for (const sm of game.smelters.values()) consider(sm.x, sm.y, sm.fuel, sm.lit, 'smelter', sm.id);
    for (const k of game.kilns.values()) consider(k.x, k.y, k.fuel, k.lit, 'kiln', k.id);
    return best;
  }

  /**
   * Fetch wood from the crate for whatever is burning low. Returns true when
   * the stoker has taken the job in hand this tick.
   */
  /**
   * The errand jobs: the ones that do not come home with a load of something.
   *
   * Each is the same shape — look for a thing worth doing inside the range the
   * worker has earned, walk to it, do one unit of it — and each returns true
   * while it has work in hand, so the ordinary worker loop leaves it alone.
   */
  private errandStep(game: Game, c: Creature, dt: number, kind: GatherKind, deed: WorkSite): boolean {
    const def = this.species(c);
    const range = siteRange(c, def, deed);
    const goto = (tx: number, ty: number, reach = 1.3): boolean => {
      if (Math.hypot(tx - c.x, ty - c.y) <= reach) return true;
      if (this.stepToward(game, c, tx, ty, dt) === 'blocked') {
        // There is no way through to it: drop the spot and pick another.
        c.workX = -1;
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return false;
    };
    const near = (x: number, y: number): boolean => Math.max(Math.abs(x - deed.x), Math.abs(y - deed.y)) <= range;

    if (kind === 'water') return this.waterStep(game, c, dt, range, goto, near);
    if (kind === 'hod') return this.hodStep(game, c, dt, goto, near);
    if (kind === 'mend') return this.mendStep(game, c, goto);
    if (kind === 'plant') return this.plantStep(game, c, goto, near, range, deed);
    if (kind === 'prospect') return this.prospectStep(game, c, goto, near, range, deed);
    if (kind === 'compost') return this.compostStep(game, c, goto, near);
    if (kind === 'groom' || kind === 'dairy' || kind === 'heal') return this.herdStep(game, c, kind, goto, near);
    if (kind === 'butcher') return this.butcherStep(game, c, goto);
    const atStores = STORE_RECIPES[kind];
    if (atStores) return this.recipeStep(game, c, atStores, goto);
    if (kind === 'lamp') return this.lampStep(game, c, goto, near);
    if (kind === 'smelt' || kind === 'kiln') return this.furnaceStep(game, c, kind, goto, near);
    if (kind === 'ash') return this.ashStep(game, c, goto, near) || this.recipeStep(game, c, LYE_RECIPES, goto);
    if (kind === 'brew') return this.brewStep(game, c, goto, near);
    if (kind === 'cook') return this.cookStep(game, c, goto, near);
    if (kind === 'restore') return this.restoreStep(game, c, goto);
    if (kind === 'patch') return this.planterStep(game, c, goto, near);
    if (kind === 'paper') return this.pressStep(game, c, goto, near);
    if (kind === 'glaze') return this.glazeStep(game, c, goto);
    if (kind === 'fill') return this.fillStep(game, c, range, goto, near);
    return false;
  }

  /** The nearest store on the settlement holding something that passes, or undefined. */
  private storeWhere(game: Game, c: Creature, ok: (it: Item) => boolean): DeedStore | undefined {
    let best: DeedStore | undefined;
    let bestD = Infinity;
    for (const st of game.deedStores()) {
      if (!st.items.some((x: Item) => ok(x) && x.count > 0 && !x.locked)) continue;
      const d = Math.hypot(st.centre[0] - c.x, st.centre[1] - c.y);
      if (d < bestD) {
        bestD = d;
        best = st;
      }
    }
    return best;
  }

  /** Up to `n` of the first stack that passes, out of this store: what is carried away, or null. */
  private takeFrom(store: DeedStore, ok: (it: Item) => boolean, n: number, game: Game): Item | null {
    const it = store.items.find((x: Item) => ok(x) && x.count > 0 && !x.locked);
    if (!it) return null;
    const k = Math.min(n, it.count);
    it.count -= k;
    if (it.count <= 0) store.items.splice(store.items.indexOf(it), 1);
    store.changed();
    return { ...it, uid: game.inventory.nextUid++, count: k };
  }

  /**
   * Charging the smelters and loading the kilns: what each has made goes
   * into the stores first, and then the ore or the unfired pottery out of
   * the stores goes in, a stack at a time up to the room it has. A job is
   * the one a person's charging makes (`smelt_ore`, `load_kiln`). The
   * island's `errand_step` and `errand_do`.
   */
  private furnaceStep(
    game: Game,
    c: Creature,
    kind: GatherKind,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
  ): boolean {
    const smelt = kind === 'smelt';
    const fits = (it: Item): boolean => (smelt ? isOreItem(it.id) : isGreenware(it.id));
    type Furnace = { f: PlacedSmelter | PlacedKiln; at: [number, number]; room: number };
    const all: Furnace[] = [];
    for (const f of smelt ? game.smelters.values() : game.kilns.values()) {
      if (!near(f.x, f.y) || !game.onDeed(f.x, f.y)) continue;
      const cap = smelt ? smelterCapacity(f) : kilnCapacity(f);
      all.push({ f, at: smelt ? smelterCentre(f as PlacedSmelter) : kilnCentre(f as PlacedKiln), room: cap - f.jobs.length });
    }
    const nearest = (list: Furnace[]): Furnace | undefined => list.sort((a, b) => Math.hypot(a.at[0] - c.x, a.at[1] - c.y) - Math.hypot(b.at[0] - c.x, b.at[1] - c.y))[0];
    // What it has made, out first.
    const done = c.carrying ? undefined : nearest(all.filter((x) => x.f.output.length > 0));
    if (done) {
      if (!goto(done.at[0], done.at[1], 1.8)) return true;
      for (const it of done.f.output.splice(0)) this.intoStores(game, it, null, done.f.x, done.f.y);
      game.events.emit('smelter');
      this.errandWork(game, c, kind);
      return true;
    }
    const holding = !!c.carrying && fits(c.carrying);
    if (c.carrying && !holding) return false;
    const to = nearest(all.filter((x) => x.room > 0));
    if (!to) return false;
    if (!holding) {
      const store = this.storeWhere(game, c, fits);
      if (!store) return false;
      if (!goto(store.centre[0], store.centre[1])) return true;
      c.carrying = this.takeFrom(store, fits, to.room, game);
      return true;
    }
    if (!goto(to.at[0], to.at[1], 1.8)) return true;
    const item = c.carrying!;
    const n = Math.min(item.count, to.room);
    if (smelt) {
      const metal = METAL_BY_ORE.get(item.id)!;
      const secs = smeltSeconds(metal.id, item.ql, to.f.ql);
      for (let i = 0; i < n; i++) (to.f as PlacedSmelter).jobs.push({ item: { ...item, count: 1 }, makes: metal.lump, left: secs, total: secs, ql: item.ql });
    } else {
      const def = POTTERY_BY_UNFIRED.get(item.id)!;
      const secs = fireSeconds(def, to.f.ql);
      for (let i = 0; i < n; i++) (to.f as PlacedKiln).jobs.push({ item: { ...item, count: 1 }, makes: def.fired, left: secs, total: secs, ql: firedQl(item.ql, to.f.ql) });
    }
    item.count -= n;
    if (item.count <= 0) c.carrying = null;
    game.events.emit('smelter');
    this.gainSkill(game, c, GATHER_SKILL[kind], 0.25);
    this.errandWork(game, c, kind);
    return true;
  }

  /**
   * Raking out the ashes: every whole ash a campfire, an oven, a smelter or a
   * kiln of yours has made, into the stores, as a person's rake takes them
   * (`rakeAshes`). Leaching them into lye is `LYE_RECIPES`, worked when there
   * is nothing to rake.
   */
  private ashStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean): boolean {
    if (c.carrying) return false;
    let best: { h: { ash?: number }; at: [number, number]; x: number; y: number } | undefined;
    let bestD = Infinity;
    const look = (h: { ash?: number }, at: [number, number], x: number, y: number): void => {
      if (Math.floor(h.ash ?? 0) < 1 || !near(x, y) || !game.onDeed(x, y)) return;
      const d = Math.hypot(at[0] - c.x, at[1] - c.y);
      if (d < bestD) {
        bestD = d;
        best = { h, at, x, y };
      }
    };
    for (const f of game.campfires.values()) look(f, fireCentre(f), Math.floor(fireCentre(f)[0]), Math.floor(fireCentre(f)[1]));
    for (const s of game.smelters.values()) look(s, smelterCentre(s), s.x, s.y);
    for (const k of game.kilns.values()) look(k, kilnCentre(k), k.x, k.y);
    for (const f of game.furniture.values()) if (furnitureDef(f.kind).hearth) look(f, furnitureCentre(f), f.x, f.y);
    if (!best) return false;
    const it = best as { h: { ash?: number }; at: [number, number]; x: number; y: number };
    if (!goto(it.at[0], it.at[1], 1.8)) return true;
    const whole = Math.floor(it.h.ash ?? 0);
    it.h.ash = (it.h.ash ?? 0) - whole;
    this.intoStores(game, { uid: game.inventory.nextUid++, id: 'ash', ql: ASH_QL, dmg: 0, count: whole }, null, it.x, it.y);
    this.gainSkill(game, c, GATHER_SKILL.ash, 0.2);
    this.errandWork(game, c, 'ash');
    return true;
  }

  /** The first brew whose makings are all in the stores, in the order the brews are listed. */
  brewInStores(game: Game): BrewDef | undefined {
    return BREWS.find((b) => game.deedStores().reduce((n, st) => n + st.items.filter((x: Item) => x.id === b.input && !x.locked).reduce((a, x) => a + x.count, 0), 0) >= b.count);
  }

  /**
   * Setting a brew going: a barrel of yours with water enough in it and
   * nothing working, and the makings of a brew in the stores, as a person
   * sets one (`start_brew`), at the quality of what went in and its own hand.
   */
  private brewStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean): boolean {
    if (c.carrying) return false;
    const brew = this.brewInStores(game);
    if (!brew) return false;
    let f: PlacedFurniture | undefined;
    let bestD = Infinity;
    for (const x of game.furniture.values()) {
      if (!holdsLiquid(x) || isWell(x) || isWorking(x) || x.liquid !== 'water' || litresIn(x) < brew.litres || !near(x.x, x.y) || !game.onDeed(x.x, x.y)) continue;
      const [fx, fy] = furnitureCentre(x);
      const d = Math.hypot(fx - c.x, fy - c.y);
      if (d < bestD) {
        bestD = d;
        f = x;
      }
    }
    if (!f) return false;
    const [fx, fy] = furnitureCentre(f);
    if (!goto(fx, fy, 1.8)) return true;
    let qls = 0;
    for (let i = 0; i < brew.count; i++) qls += this.takeOne(game, [brew.input])?.ql ?? 20;
    const skill = c.skills[GATHER_SKILL.brew] ?? 1;
    f.litres = brew.litres;
    f.liquid = brew.id;
    f.ferment = brew.time;
    if (brew.ages) f.agedFrom = game.wallNow() + brew.time;
    else delete f.agedFrom;
    delete f.knack;
    f.ql = Math.max(1, Math.min(100, (qls / brew.count + skill) / 2));
    game.events.emit('crate');
    this.gainSkill(game, c, GATHER_SKILL.brew, 0.3);
    this.errandWork(game, c, 'brew');
    return true;
  }

  /**
   * Cooking: the first of `cookRecipes` the stores hold everything for --
   * its tool kept in one of them -- worked at the nearest lit campfire or
   * oven of yours, and what it makes put in the stores.
   */
  private cookStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean): boolean {
    if (c.carrying) return false;
    const job = this.recipeInStores(game, cookRecipes());
    if (!job) return false;
    let at: [number, number] | undefined;
    let bestD = Infinity;
    const look = (p: [number, number]): void => {
      const [x, y] = [Math.floor(p[0]), Math.floor(p[1])];
      if (!near(x, y) || !game.onDeed(x, y)) return;
      const d = Math.hypot(p[0] - c.x, p[1] - c.y);
      if (d < bestD) {
        bestD = d;
        at = p;
      }
    };
    for (const f of game.campfires.values()) if (f.lit) look(fireCentre(f));
    for (const f of game.furniture.values()) if (f.lit && furnitureDef(f.kind).hearth) look(furnitureCentre(f));
    if (!at) return false;
    const spot = at as [number, number];
    if (!goto(spot[0], spot[1], 1.8)) return true;
    this.workRecipe(game, c, job.recipe, null, Math.floor(spot[0]), Math.floor(spot[1]));
    return true;
  }

  /**
   * Pressing papyrus: the first of `PAPER_RECIPES` the stores hold everything
   * for, worked at the nearest paper press of yours, and what it makes and the
   * bucket it hands back put in the stores.
   */
  private pressStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean): boolean {
    if (c.carrying) return false;
    const job = this.recipeInStores(game, PAPER_RECIPES);
    if (!job) return false;
    let at: [number, number] | undefined;
    let bestD = Infinity;
    for (const f of game.furniture.values()) {
      if (f.kind !== PAPER_PRESS || !near(f.x, f.y) || !game.onDeed(f.x, f.y)) continue;
      const p = furnitureCentre(f);
      const d = Math.hypot(p[0] - c.x, p[1] - c.y);
      if (d < bestD) {
        bestD = d;
        at = p;
      }
    }
    if (!at) return false;
    const spot = at as [number, number];
    if (!goto(spot[0], spot[1], 1.8)) return true;
    this.workRecipe(game, c, job.recipe, null, Math.floor(spot[0]), Math.floor(spot[1]));
    return true;
  }

  /** How many of a thing the stores hold between them, leaving out what is locked. */
  private inStores(game: Game, id: string): number {
    return game.deedStores().reduce((sum, st) => sum + st.items.filter((x: Item) => x.id === id && !x.locked).reduce((a, x) => a + x.count, 0), 0);
  }

  /**
   * Glazing: the nearest store holding a fired pot, bowl, jar or amphora with
   * no glaze on it, and while the stores hold the ash for it, the ash brushed
   * over it as an Artisan's glaze is (`glaze_item`), after which it never decays.
   */
  private glazeStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean): boolean {
    if (c.carrying || this.inStores(game, 'ash') < GLAZE_ASH) return false;
    const bare = (it: Item): boolean => GLAZEABLE.has(it.id) && it.mark?.glaze === undefined && !it.locked;
    const st = this.storeWhere(game, c, bare);
    if (!st) return false;
    if (!goto(st.centre[0], st.centre[1])) return true;
    const it = st.items.find(bare);
    if (!it) return true;
    for (let n = 0; n < GLAZE_ASH; n++) this.takeOne(game, ['ash'], st);
    it.mark = { ...(it.mark ?? {}), glaze: 0 };
    st.changed();
    this.gainSkill(game, c, GATHER_SKILL.glaze, 0.2);
    this.errandWork(game, c, 'glaze');
    return true;
  }

  /**
   * Filling buckets: an empty bucket out of the stores, filled at the shore or
   * out of a well as your own hands fill one (`fill_bucket`), and put back in
   * the stores full. A bucket it is holding when there is no water in reach
   * goes back in the stores empty. The island's `errand_step` and `errand_do`.
   */
  private fillStep(
    game: Game,
    c: Creature,
    range: number,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
  ): boolean {
    const held = c.carrying;
    const source = held?.id === 'water_bucket' ? undefined : game.waterSource(c.x, c.y, range, near);
    if (held?.id === 'water_bucket' || (held && (held.id !== 'bucket' || !source))) {
      // Home with it: the nearest store with room.
      const st = this.storeFor(game, c, held);
      if (!st) return true;
      if (!goto(st.centre[0], st.centre[1])) return true;
      this.intoStores(game, held, st, st.x, st.y);
      c.carrying = null;
      return true;
    }
    if (!source) return false;
    if (held) {
      if (!goto(source.x, source.y, 1.5)) return true;
      if (source.well) game.drawFromWell(source.well, BUCKET_LITRES);
      c.carrying = { ...held, id: 'water_bucket' };
      this.gainSkill(game, c, GATHER_SKILL.fill, 0.2);
      this.errandWork(game, c, 'fill');
      return true;
    }
    const st = this.storeWith(game, c, ['bucket']);
    if (!st) return false;
    if (!goto(st.centre[0], st.centre[1])) return true;
    c.carrying = this.takeOne(game, ['bucket'], st);
    return true;
  }

  /**
   * Restoring: a relic every piece of which is in the stores, put back
   * together at the store holding its first piece, at what the pieces are
   * worth less their damage and at its restoration, as a person's hands
   * would (`restore_relic`), and the relic put in the stores.
   */
  private restoreStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean): boolean {
    if (c.carrying) return false;
    const set = this.relicInStores(game);
    if (!set) return false;
    if (!goto(set.at.centre[0], set.at.centre[1])) return true;
    let worth = 0;
    for (let part = 1; part <= set.relic.parts; part++) {
      let piece: { st: DeedStore; it: Item } | undefined;
      for (const st of game.deedStores()) {
        for (const it of st.items) {
          const f = it.id === 'fragment' && !it.locked ? fragmentOf(it) : null;
          if (f && f.relic === set.relic && f.part === part && (!piece || it.dmg < piece.it.dmg)) piece = { st, it };
        }
      }
      if (!piece) return false;
      worth += piece.it.ql * (1 - piece.it.dmg / RESTORE_AGE);
      if (piece.it.count > 1) piece.it.count -= 1;
      else piece.st.items.splice(piece.st.items.indexOf(piece.it), 1);
      piece.st.changed();
    }
    const skill = c.skills[GATHER_SKILL.restore] ?? 1;
    const ql = Math.max(1, Math.min(100, (worth / set.relic.parts) * restoredMul(skill)));
    this.intoStores(game, { uid: game.inventory.nextUid++, id: set.relic.result, ql, dmg: 0, count: 1 }, set.at, set.at.x, set.at.y);
    this.gainSkill(game, c, GATHER_SKILL.restore, 0.3);
    this.errandWork(game, c, 'restore');
    return true;
  }

  /** The first relic, by name, every piece of which is in the stores; and the store holding its first piece. The island's `relic_in_stores`. */
  relicInStores(game: Game): { relic: RelicDef; at: DeedStore } | null {
    const stores = game.deedStores();
    for (const relic of [...RELICS].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const have = new Set<number>();
      let at: DeedStore | undefined;
      for (const st of stores) {
        for (const it of st.items) {
          const f = it.id === 'fragment' && !it.locked ? fragmentOf(it) : null;
          if (f?.relic !== relic) continue;
          have.add(f.part);
          if (f.part === 1 && !at) at = st;
        }
      }
      if (at && have.size === relic.parts) return { relic, at };
    }
    return null;
  }

  /**
   * Keeping the planters: a ripe crop harvested into the stores, one wanting
   * tending tended, and an empty planter sown out of the stores, as a
   * person's hands do each (`plant_seed`, `tend_crop`, `harvest_crop`).
   */
  private planterStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean): boolean {
    const seed = (it: Item): boolean => CROP_BY_SEED.has(it.id);
    const holding = !!c.carrying && seed(c.carrying);
    if (c.carrying && !holding) return false;
    const seedToHave = holding || !!this.storeWhere(game, c, seed);
    let f: PlacedFurniture | undefined;
    let bestD = Infinity;
    for (const x of game.furniture.values()) {
      if (!isPlanter(x) || !near(x.x, x.y) || !game.onDeed(x.x, x.y)) continue;
      const crop = game.planted.get(x.id);
      const wants = crop ? cropReady(crop) || !crop.tendedNow : seedToHave;
      if (!wants) continue;
      const [fx, fy] = furnitureCentre(x);
      const d = Math.hypot(fx - c.x, fy - c.y);
      if (d < bestD) {
        bestD = d;
        f = x;
      }
    }
    if (!f) return false;
    const crop = game.planted.get(f.id);
    if (!crop && !holding) {
      const store = this.storeWhere(game, c, seed);
      if (!store) return false;
      if (!goto(store.centre[0], store.centre[1])) return true;
      c.carrying = this.takeFrom(store, seed, 1, game);
      return true;
    }
    const [fx, fy] = furnitureCentre(f);
    if (!goto(fx, fy, 1.8)) return true;
    const skill = c.skills[GATHER_SKILL.patch] ?? 1;
    const made = this.madeQl(game, c, skill);
    if (!crop) {
      const def = CROP_BY_SEED.get(c.carrying!.id)!;
      game.sowPlanter(f, def.id, c.carrying!.ql);
      c.carrying = null;
    } else if (cropReady(crop)) {
      const def = cropDef(crop.id);
      const y = cropYield(crop.tended);
      const ql = Math.max(1, Math.min(100, (crop.ql + made) / 2));
      this.intoStores(game, { uid: game.inventory.nextUid++, id: def.produce, ql, dmg: 0, count: y.produce }, null, f.x, f.y);
      this.intoStores(game, { uid: game.inventory.nextUid++, id: def.seed, ql, dmg: 0, count: y.seeds }, null, f.x, f.y);
      game.uproot(crop);
    } else {
      crop.tendedNow = true;
      crop.tended += 1;
      crop.ql = (crop.ql * crop.tended + made) / (crop.tended + 1);
      game.events.emit('world', f.x, f.y);
    }
    this.gainSkill(game, c, GATHER_SKILL.patch, 0.25);
    this.errandWork(game, c, 'patch');
    return true;
  }

  /** How long a go at an errand keeps it where it is, as it would at a tile of its trade (`workDuration`). */
  private errandWork(game: Game, c: Creature, kind: GatherKind): void {
    this.acted(c, 'work', game.time);
    c.busyUntil = game.time + workDuration(c.skills[GATHER_SKILL[kind]] ?? 1) / this.workMul(c);
  }

  /** What a worker of this skill makes a thing at: the same spread a tile's load is taken at. */
  private madeQl(game: Game, c: Creature, skill: number): number {
    return Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1) * this.yieldMul(c));
  }

  /**
   * Something made at the stores, put into them: the store it was made at
   * while that has room, then whichever on the settlement will take it, and
   * failing all of them on the ground where it was made. The island's
   * `worker_put`.
   */
  private intoStores(game: Game, item: Item, at: DeedStore | null, x: number, y: number): void {
    const to = at && at.room(item) ? at : game.deedStores().find((st) => st.room(item));
    if (to && to.add(item)) {
      to.changed();
      return;
    }
    game.dropOnGround(x, y, item);
  }

  /** One of a thing taken out of whichever store on the settlement has it, or null. */
  private takeOne(game: Game, ids: readonly string[], prefer?: DeedStore): Item | null {
    const stores = game.deedStores();
    for (const store of prefer ? [prefer, ...stores.filter((st) => st !== prefer)] : stores) {
      const it = store.items.find((x: Item) => ids.includes(x.id) && x.count > 0 && !x.locked);
      if (!it) continue;
      it.count -= 1;
      if (it.count <= 0) store.items.splice(store.items.indexOf(it), 1);
      store.changed();
      return { uid: game.inventory.nextUid++, id: it.id, ql: it.ql, dmg: 0, count: 1, extra: it.extra };
    }
    return null;
  }

  /** The nearest store on the settlement holding one of these, or undefined. */
  private storeWith(game: Game, c: Creature, ids: readonly string[]): DeedStore | undefined {
    let best: DeedStore | undefined;
    let bestD = Infinity;
    for (const st of game.deedStores()) {
      if (!st.items.some((x: Item) => ids.includes(x.id) && x.count > 0 && !x.locked)) continue;
      const d = Math.hypot(st.centre[0] - c.x, st.centre[1] - c.y);
      if (d < bestD) {
        bestD = d;
        best = st;
      }
    }
    return best;
  }

  /** Whether a sheela milks this one, rather than shearing it: one that fills a bucket at a milking (`milkLitres`). */
  static milker(def: SpeciesDef): boolean {
    return !!def.milk && milkLitres(def.id) >= BUCKET_LITRES;
  }

  /**
   * Whether one of yours wants a kemma, a sheela or a salva: care under
   * `CARE_WANTING`; a fleece, feathers or milk `DAIRY_FULL` grown back (and
   * for a milker an empty bucket to be had, `has`); bleeding, or under
   * `HEAL_BELOW` of its health (and a dressing to be had, `has`).
   */
  herdWants(game: Game, c: Creature, o: Creature, kind: GatherKind, has: boolean): boolean {
    if (o === c || (o.mode !== 'deed' && o.mode !== 'active') || o.mine === false || o.health <= 0) return false;
    const def = this.species(o);
    if (def.monster) return false;
    if (kind === 'groom') return o.care < CARE_WANTING;
    if (kind === 'dairy') return !!def.fleece && o.fleece >= DAIRY_FULL && (!Creatures.milker(def) || has);
    if (kind === 'heal') return has && (o.bleedUntil > game.time || o.health < maxHealth(o, def) * HEAL_BELOW);
    return false;
  }

  /**
   * Brushing, milking and shearing, and dressing hurts: the errands done to
   * one of your own wildermon within reach of the token. What it needs out
   * of the stores first -- an empty bucket for a cudda, a dressing for a
   * hurt -- it fetches before it goes, and what comes off goes in the stores.
   */
  private herdStep(
    game: Game,
    c: Creature,
    kind: GatherKind,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
  ): boolean {
    // Whether what it would carry to one -- a bucket, a dressing -- is in its arms or to be had, asked once for the whole herd.
    const carried = kind === 'heal' ? DRESSINGS : ['bucket'];
    const has = kind !== 'groom' && (carried.includes(c.carrying?.id ?? '') || !!this.storeWith(game, c, carried));
    let o: Creature | undefined;
    let bestD = Infinity;
    for (const x of this.list.values()) {
      if (!near(Math.floor(x.x), Math.floor(x.y)) || !this.herdWants(game, c, x, kind, has)) continue;
      const d = Math.hypot(x.x - c.x, x.y - c.y);
      if (d < bestD) {
        bestD = d;
        o = x;
      }
    }
    // Nothing wanting it: a bucket or a dressing in its arms goes back with everything else carried.
    if (!o) return false;
    const def = this.species(o);
    const skill = c.skills[GATHER_SKILL[kind]] ?? 1;
    const want = kind === 'heal' ? DRESSINGS : kind === 'dairy' && Creatures.milker(def) ? ['bucket'] : null;
    if (want && !want.includes(c.carrying?.id ?? '')) {
      if (c.carrying) return false;
      const store = this.storeWith(game, c, want);
      if (!store) return false;
      if (!goto(store.centre[0], store.centre[1])) return true;
      c.carrying = this.takeOne(game, want, store);
      return true;
    }
    if (!goto(o.x, o.y, 1.6)) return true;
    const top = maxHealth(o, def);
    if (kind === 'groom') {
      // As a keeper of its skill with a brush as good (`groomGain`), and the small hurts seen to with it.
      o.care = Math.min(1, o.care + groomGain(skill, skill));
      if (o.health < top) o.health = Math.min(top, o.health + top * GROOM_HEAL);
      this.gainSkill(game, c, GATHER_SKILL.groom, 0.25);
    } else if (kind === 'dairy') {
      const [x, y] = [Math.floor(o.x), Math.floor(o.y)];
      if (Creatures.milker(def)) {
        // A bucket off it, as the keeper's own milking fills one (`milk_go`): what it has been fed on is what comes out of it.
        const ql = Math.max(1, Math.min(100, 20 + o.fleece * 40 + o.hunger * 30));
        c.carrying = null;
        this.intoStores(game, { uid: game.inventory.nextUid++, id: 'milk_bucket', ql, dmg: 0, count: 1 }, null, x, y);
      } else {
        // A full fleece is three, a full crop of feathers six, and quality follows what was there.
        const yields = def.shearYield ?? 'wool';
        const n = Math.max(1, Math.round(o.fleece * (yields === 'wool' ? SHEAR_WOOL : SHEAR_FEATHERS)));
        const ql = Math.max(1, Math.min(100, 15 + o.fleece * 45 + skill * 0.4));
        this.intoStores(game, { uid: game.inventory.nextUid++, id: yields, ql, dmg: 0, count: n }, null, x, y);
      }
      o.fleece = 0;
      this.learnBy(game, o, 'tended');
      this.gainSkill(game, c, GATHER_SKILL.dairy, 0.25);
    } else {
      // A dressing's share of a life, at its first aid and the dressing's quality (`healAmount`), and the bleeding stopped.
      const ql = c.carrying?.ql ?? 1;
      c.carrying = null;
      o.health = Math.min(top, o.health + top * healAmount(skill, ql));
      o.bleedUntil = 0;
      o.bleedRate = 0;
      this.gainSkill(game, c, GATHER_SKILL.heal, 0.25);
    }
    game.events.emit('creature');
    this.errandWork(game, c, kind);
    return true;
  }

  /**
   * Butchering: at the store with a carcass in it, taken apart as a butcher
   * of its skill with a knife as good would (`butcherYield`), and what comes
   * off it put back in the stores. The island's `errand_do`.
   */
  private butcherStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean): boolean {
    if (c.carrying) return false;
    let store: DeedStore | undefined;
    let corpse: Item | undefined;
    let bestD = Infinity;
    for (const st of game.deedStores()) {
      const it = st.items.find((x: Item) => x.id === 'corpse' && !x.locked && !!corpseSpecies(x));
      const d = Math.hypot(st.centre[0] - c.x, st.centre[1] - c.y);
      if (it && d < bestD) {
        bestD = d;
        store = st;
        corpse = it;
      }
    }
    if (!store || !corpse) return false;
    if (!goto(store.centre[0], store.centre[1])) return true;
    const def = corpseSpecies(corpse);
    if (!def) return false;
    const skill = c.skills[GATHER_SKILL.butcher] ?? 1;
    const share = butcherYield(skill, skill);
    const ql = this.madeQl(game, c, skill);
    if (corpse.count > 1) corpse.count -= 1;
    else store.items.splice(store.items.indexOf(corpse), 1);
    store.changed();
    const put = (id: string, count: number, q: number): void => this.intoStores(game, { uid: game.inventory.nextUid++, id, ql: q, dmg: 0, count }, store, store.x, store.y);
    const hoard = def.butcher.hoard ?? 0;
    for (let i = 0; i < Math.round(hoard * (HOARD_LUMPS + share * HOARD_MORE)); i++) {
      put(HOARD_METALS[Math.floor(game.rand() * HOARD_METALS.length)], 1, Math.max(20, Math.min(100, 40 + game.rand() * 55)));
    }
    for (const [part, id] of BUTCHER_PARTS) {
      const base = def.butcher[part] ?? 0;
      if (!base) continue;
      let count = Math.floor(base * share);
      if (game.rand() < base * share - count) count += 1;
      if (part === 'gland' && count > 0 && game.rand() > 0.35 * (0.5 + share)) count = 0;
      if (count > 0) put(id, count, ql);
    }
    this.gainSkill(game, c, GATHER_SKILL.butcher, 0.3);
    this.errandWork(game, c, 'butcher');
    return true;
  }

  /**
   * The first of these recipes the stores hold everything for: its tool in
   * one of them, and every input across them. Null when none is.
   */
  recipeInStores(game: Game, recipes: readonly string[]): { recipe: Recipe; at: DeedStore } | null {
    const stores = game.deedStores();
    const has = (id: string, n: number): boolean =>
      stores.reduce((sum, st) => sum + st.items.filter((x: Item) => x.id === id && !x.locked).reduce((a, x) => a + x.count, 0), 0) >= n;
    for (const id of recipes) {
      const r = RECIPE_BY_ID.get(id);
      if (!r || (r.tool && !has(r.tool, 1)) || !r.inputs.every((i) => has(i.item, i.count ?? 1))) continue;
      const at = stores.find((st) => st.items.some((x: Item) => x.id === r.inputs[0].item && !x.locked));
      if (at) return { recipe: r, at };
    }
    return null;
  }

  /**
   * Tanning and milling: a recipe worked at the stores, its inputs taken out
   * of them, its tool kept in one of them, and what it makes -- with what it
   * hands back, a bucket after the lye -- put back in. The island's
   * `errand_do`.
   */
  private recipeStep(game: Game, c: Creature, recipes: readonly string[], goto: (x: number, y: number, reach?: number) => boolean): boolean {
    if (c.carrying) return false;
    const job = this.recipeInStores(game, recipes);
    if (!job) return false;
    const { recipe: r, at } = job;
    if (!goto(at.centre[0], at.centre[1])) return true;
    this.workRecipe(game, c, r, at, at.x, at.y);
    return true;
  }

  /** One go at a recipe out of the stores: its inputs taken, and what it makes and hands back put in them. */
  private workRecipe(game: Game, c: Creature, r: Recipe, at: DeedStore | null, x: number, y: number): void {
    for (const i of r.inputs) for (let n = 0; n < (i.count ?? 1); n++) this.takeOne(game, [i.item], at ?? undefined);
    const kind = this.species(c).gathers ?? 'mill';
    const skill = c.skills[GATHER_SKILL[kind]] ?? 1;
    this.intoStores(game, { uid: game.inventory.nextUid++, id: r.result, ql: this.madeQl(game, c, skill), dmg: 0, count: r.count ?? 1 }, at, x, y);
    for (const [id, n] of r.returns ?? []) this.intoStores(game, { uid: game.inventory.nextUid++, id, ql: 40, dmg: 0, count: n }, at, x, y);
    this.gainSkill(game, c, GATHER_SKILL[kind], 0.25);
    this.errandWork(game, c, kind);
  }

  /** What a lantern post or pillar of yours wants of a wicka, or null: a candle, a light after dark, or putting out by day. */
  lampWants(game: Game, f: PlacedFurniture): 'candle' | 'light' | 'douse' | null {
    if (!isLampPiece(f) || !f.lamp) return null;
    if ((f.fuel ?? 0) <= 0) return 'candle';
    const night = game.isNight();
    if (night && !f.lit) return 'light';
    if (!night && f.lit) return 'douse';
    return null;
  }

  /**
   * Keeping the lanterns: a candle out of the stores into every post and
   * pillar of yours that has none, each lit once it is dark and put out by
   * day. The island's `errand_step` and `errand_do`.
   */
  private lampStep(
    game: Game,
    c: Creature,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
  ): boolean {
    const holding = c.carrying?.id === 'candle';
    if (c.carrying && !holding) return false;
    const candles = holding || !!this.storeWith(game, c, ['candle']);
    let f: PlacedFurniture | undefined;
    let bestD = Infinity;
    for (const x of game.furniture.values()) {
      if (!near(x.x, x.y) || !game.onDeed(x.x, x.y)) continue;
      const want = this.lampWants(game, x);
      if (!want || (want === 'candle' && !candles)) continue;
      const [fx, fy] = furnitureCentre(x);
      const d = Math.hypot(fx - c.x, fy - c.y);
      if (d < bestD) {
        bestD = d;
        f = x;
      }
    }
    if (!f) return false;
    const want = this.lampWants(game, f);
    if (want === 'candle' && !holding) {
      const store = this.storeWith(game, c, ['candle']);
      if (!store) return false;
      if (!goto(store.centre[0], store.centre[1])) return true;
      c.carrying = this.takeOne(game, ['candle'], store);
      return true;
    }
    const [fx, fy] = furnitureCentre(f);
    if (!goto(fx, fy, 1.6)) return true;
    if (want === 'candle' && f.lamp) {
      f.fuel = Math.round(candleBurn(f.lamp.ql));
      f.lit = game.isNight();
      c.carrying = null;
    } else if (want === 'light') f.lit = true;
    else if (want === 'douse') f.lit = false;
    this.gainSkill(game, c, GATHER_SKILL.lamp, 0.2);
    game.events.emit('world', f.x, f.y);
    this.errandWork(game, c, 'lamp');
    return true;
  }

  /**
   * Carrying water. A pouch is filled at the shore or out of a well and poured
   * into whichever barrel on the deed has room for it, which is the errand
   * nobody wants to run themselves.
   */
  private waterStep(
    game: Game,
    c: Creature,
    dt: number,
    range: number,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
  ): boolean {
    const full = c.carrying?.id === 'water_bucket';
    const vessel = game.thirstyVessel();
    if (!vessel) return false;
    if (full) {
      const [vx, vy] = furnitureCentre(vessel);
      if (!goto(vx, vy)) return true;
      game.pourInto(vessel, BUCKET_LITRES, 'water');
      c.carrying = null;
      this.gainSkill(game, c, GATHER_SKILL.water, 0.2);
      c.state = 'idle';
      c.until = game.time + 0.5;
      return true;
    }
    const source = game.waterSource(c.x, c.y, range, near);
    if (!source) return false;
    if (!goto(source.x, source.y, 1.5)) return true;
    if (source.well) game.drawFromWell(source.well, BUCKET_LITRES);
    c.carrying = { uid: game.inventory.nextUid++, id: 'water_bucket', ql: 40, dmg: 0, count: 1 };
    return true;
  }

  /** Carrying the hod: one piece of a planned wall at a time, out of the stores. */
  private hodStep(
    game: Game,
    c: Creature,
    dt: number,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
  ): boolean {
    const job = game.wallNeeding(near, c.carrying?.id);
    if (!job) {
      c.carrying = null;
      return false;
    }
    if (!c.carrying) {
      const store = game.deedStores().find((st) => st.items.some((it: Item) => it.id === job.item));
      const stock = store?.items.find((it: Item) => it.id === job.item);
      if (!store || !stock) return false;
      const [sx, sy] = store.centre;
      if (!goto(sx, sy)) return true;
      stock.count -= 1;
      if (stock.count <= 0) store.items.splice(store.items.indexOf(stock), 1);
      store.changed();
      c.carrying = { uid: game.inventory.nextUid++, id: job.item, ql: stock.ql, dmg: 0, count: 1 };
      return true;
    }
    if (!goto(job.x + 0.5, job.y + 0.5, 1.6)) return true;
    game.fitIntoWall(job.wall, c.carrying.id);
    c.carrying = null;
    this.gainSkill(game, c, GATHER_SKILL.hod, 0.25);
    return true;
  }

  /** Mending: it works at the stores, on whatever in them is knocked about. */
  private mendStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean): boolean {
    const found = game.damagedInStores();
    if (!found) return false;
    const [sx, sy] = found.store.centre;
    if (!goto(sx, sy)) return true;
    const skill = c.skills[GATHER_SKILL.mend] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.mend, 0.2);
    // The same bargain the player's own repair makes: damage out, a little
    // quality with it, and a better hand loses less of it.
    found.item.dmg = Math.max(0, found.item.dmg - (2 + skill / 12));
    found.item.ql = Math.max(1, found.item.ql - Math.max(0.05, 0.6 - skill / 220));
    found.store.changed();
    c.busyUntil = game.time + 1.5;
    return true;
  }

  /** Planting: a sprout out of the stores, put in where the wood has gone. */
  private plantStep(
    game: Game,
    c: Creature,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
    range: number,
    deed: { x: number; y: number },
  ): boolean {
    if (!c.carrying) {
      const store = game.deedStores().find((st) => st.items.some((it: Item) => it.id === 'sprout'));
      const sprout = store?.items.find((it: Item) => it.id === 'sprout');
      if (!store || !sprout) return false;
      const [sx, sy] = store.centre;
      if (!goto(sx, sy)) return true;
      sprout.count -= 1;
      if (sprout.count <= 0) store.items.splice(store.items.indexOf(sprout), 1);
      store.changed();
      c.carrying = { uid: game.inventory.nextUid++, id: 'sprout', ql: sprout.ql, dmg: 0, count: 1, extra: sprout.extra };
      return true;
    }
    if (c.carrying.id !== 'sprout') return false;
    if (c.workX < 0 || !game.plantableTile(c.workX, c.workY)) {
      const spot = game.plantingSpot(deed.x, deed.y, range, near, c.x, c.y);
      if (!spot) return false;
      c.workX = spot.x;
      c.workY = spot.y;
    }
    if (!goto(c.workX + 0.5, c.workY + 0.5)) return true;
    game.plantSprout(c.workX, c.workY, c.carrying.extra);
    c.carrying = null;
    c.workX = -1;
    this.gainSkill(game, c, GATHER_SKILL.plant, 0.25);
    return true;
  }

  /** Reading the ground: it walks the country and marks what is under it. */
  private prospectStep(
    game: Game,
    c: Creature,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
    range: number,
    deed: { x: number; y: number },
  ): boolean {
    if (c.workX < 0) {
      const spot = game.unreadGround(deed.x, deed.y, range, near, c.x, c.y);
      if (!spot) return false;
      c.workX = spot.x;
      c.workY = spot.y;
    }
    if (!goto(c.workX + 0.5, c.workY + 0.5)) return true;
    const skill = c.skills[GATHER_SKILL.prospect] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.prospect, 0.22);
    game.readGround(c, c.workX, c.workY, 2 + Math.floor(skill / 20));
    c.workX = -1;
    c.busyUntil = game.time + 2;
    return true;
  }

  /** Clearing up: what is rotting on the ground goes back to the fields. */
  private compostStep(
    game: Game,
    c: Creature,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number) => boolean,
  ): boolean {
    if (c.carrying) return false;
    const rot = game.rottingNear(near);
    if (!rot) return false;
    if (!goto(rot.x + 0.5, rot.y + 0.5)) return true;
    const [taken] = game.takeFromGround(rot.x, rot.y, rot.uid);
    if (!taken) return true;
    this.gainSkill(game, c, GATHER_SKILL.compost, 0.2);
    // Whatever it was, what comes back is compost, and the more of it the better.
    c.carrying = { uid: game.inventory.nextUid++, id: 'compost', ql: Math.min(100, 20 + (c.skills[GATHER_SKILL.compost] ?? 1) * 0.6), dmg: 0, count: Math.max(1, Math.round(taken.count / 2)) };
    return true;
  }

  /** Nothing else to do: walk the border, and look again in a moment. */

  private stokeStep(game: Game, c: Creature, dt: number, site: WorkSite): boolean {
    const def = this.species(c);
    const hearth = this.coldHearth(game, c, siteRange(c, def, site));
    if (!hearth) return false;
    // Nothing to carry: go to whichever store has wood in it and take a piece.
    const store = game.deedStores().find((st) => st.items.some((it: Item) => isFuel(it.id)));
    const fuel = store?.items.find((it: Item) => isFuel(it.id));
    if (!store || !fuel) return false;
    const [cx, cy] = store.centre;
    if (Math.hypot(cx - c.x, cy - c.y) > 1.3) {
      if (this.stepToward(game, c, cx, cy, dt) === 'blocked') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return true;
    }
    fuel.count -= 1;
    if (fuel.count <= 0) store.items.splice(store.items.indexOf(fuel), 1);
    store.changed();
    c.carrying = { uid: game.inventory.nextUid++, id: fuel.id, ql: fuel.ql, dmg: 0, count: 1 };
    c.workX = hearth.x;
    c.workY = hearth.y;
    c.job = hearth.kind;
    return true;
  }

  /** Carry the wood to the hearth it was fetched for, feed it and light it. */
  private feedFire(game: Game, c: Creature, dt: number): void {
    const carrying = c.carrying;
    if (!carrying) return;
    const tx = c.workX + 0.5;
    const ty = c.workY + 0.5;
    if (Math.hypot(tx - c.x, ty - c.y) > 1.6) {
      if (this.stepToward(game, c, tx, ty, dt) === 'blocked') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return;
    }
    const per = FUEL_VALUES[carrying.id] ?? 0;
    const light = (fuel: number, lit: boolean, set: (f: number, l: boolean) => void, what: string): void => {
      const now = Math.min(FIRE_CAPACITY, fuel + per);
      set(now, lit || now > 0);
      this.gainSkill(game, c, GATHER_SKILL.stoke, 0.18);
      if (!lit) game.logMsg(`${c.name} gets the ${what} going again.`, 'event');
    };
    if (c.job === 'campfire') {
      const f = [...game.campfires.values()].find((k) => Math.floor(fireCentre(k)[0]) === c.workX && Math.floor(fireCentre(k)[1]) === c.workY);
      if (f) light(f.fuel, f.lit, (fuel, lit) => { f.fuel = fuel; f.lit = lit; }, 'campfire');
    } else if (c.job === 'smelter') {
      const sm = [...game.smelters.values()].find((k) => k.x === c.workX && k.y === c.workY);
      if (sm) light(sm.fuel, sm.lit, (fuel, lit) => { sm.fuel = fuel; sm.lit = lit; }, 'smelter');
    } else if (c.job === 'kiln') {
      const k = [...game.kilns.values()].find((n) => n.x === c.workX && n.y === c.workY);
      if (k) light(k.fuel, k.lit, (fuel, lit) => { k.fuel = fuel; k.lit = lit; }, 'kiln');
    }
    game.events.emit('smelter');
    game.events.emit('world', c.workX, c.workY);
    c.carrying = null;
    c.job = null;
    c.state = 'idle';
    c.until = game.time + 1;
  }

  /**
   * What a worker does about company. Aggressive ones go for anything wild that
   * crosses the border; defensive ones only answer what has already struck at
   * them or at their keeper; passive ones carry on working whatever happens.
   * Returns true when the creature is dealing with it rather than working.
   */
  private defendDeed(game: Game, c: Creature, dt: number, deed: WorkSite): boolean {
    if (c.stance === 'passive') {
      c.enemy = null;
      return false;
    }
    const range = deed.radius + 1;
    const inside = (o: Creature): boolean => Math.max(Math.abs(o.x - deed.x), Math.abs(o.y - deed.y)) <= range;
    if (c.enemy !== null && c.enemy !== PLAYER_ATTACKER) {
      const e = this.list.get(c.enemy);
      if (!e || !quarry(e) || !inside(e)) c.enemy = null;
      else {
        if (Math.hypot(e.x - c.x, e.y - c.y) <= 1) {
          if (c.cooldown <= 0) {
            this.attack(game, c, e);
            c.cooldown = 1.2 / this.mul(c, 'haste');
          }
        } else if (this.stepToward(game, c, e.x, e.y, dt, 1.3) === 'blocked') c.enemy = null;
        return true;
      }
    }
    if (game.time < c.searchAt) return false;
    c.searchAt = game.time + 1.5;
    const recent = (at: number): boolean => game.time - at < BLOW_MEMORY;
    let best: Creature | null = null;
    let bestD = Infinity;
    for (const o of this.list.values()) {
      if (o.id === c.id || !quarry(o) || !inside(o)) continue;
      // A defensive one waits to be given a reason; an aggressive one does not. Guarding is a companion's, and on a deed is defensive.
      if (c.stance === 'defensive' || c.stance === 'guard') {
        const struck = (recent(c.attackedAt) && c.attackedBy === o.id) || (recent(game.player.attackedAt) && game.player.attackedBy === o.id);
        if (!struck) continue;
      }
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (!best) return false;
    c.enemy = best.id;
    game.logMsg(`${c.name} breaks off and goes for the ${this.species(best).name.toLowerCase()} on the deed.`, 'fight');
    return true;
  }

  /** A guard walks its border and goes for anything wild that crosses it. */
  /**
   * A hunter's circuit of the settlement.
   *
   * It runs down anything wild inside its range, and its range is what it has
   * learned: a young one works the border, an old one quarters half a valley.
   * What it pulls down it goes back for, and carries home like any other load,
   * because a carcass left in the grass is meat nobody eats.
   */
  private packHunt(game: Game, c: Creature, dt: number, deed: WorkSite): boolean {
    const def = this.species(c);
    const range = siteRange(c, def, deed);
    if (c.enemy !== null) {
      const e = this.list.get(c.enemy);
      const gone = !e || !quarry(e) || Math.max(Math.abs(e.x - deed.x), Math.abs(e.y - deed.y)) > range + 4;
      if (gone) c.enemy = null;
      else {
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d <= 1.1) {
          if (c.cooldown <= 0) {
            this.attack(game, c, e);
            c.cooldown = 1.1 / this.mul(c, 'haste');
          }
        } else if (this.stepToward(game, c, e.x, e.y, dt, 1.4) === 'blocked') c.enemy = null;
        return true;
      }
    }
    // Nothing in its teeth: go back for a carcass, this kill or an older one
    // left lying about. The piles on the ground are few, so the whole lot is
    // cheaper to look through than a box of tiles round the hunter.
    if (c.workX < 0 && game.time >= c.searchAt) {
      let bestD = Infinity;
      for (const [key, pile] of game.ground) {
        if (!pile.some((it) => it.id === 'corpse')) continue;
        const gx = keyX(key);
        const gy = keyY(key);
        if (Math.max(Math.abs(gx - deed.x), Math.abs(gy - deed.y)) > range) continue;
        const d = Math.hypot(gx + 0.5 - c.x, gy + 0.5 - c.y);
        if (d < bestD) {
          bestD = d;
          c.workX = gx;
          c.workY = gy;
        }
      }
    }
    // Back for the kill, wherever it went down.
    if (c.workX >= 0) {
      const pile = game.groundAt(c.workX, c.workY);
      const carcass = pile.find((it) => it.id === 'corpse');
      if (!carcass) c.workX = -1;
      else if (Math.hypot(c.workX + 0.5 - c.x, c.workY + 0.5 - c.y) <= 1.2) {
        const [taken] = game.takeFromGround(c.workX, c.workY, carcass.uid);
        c.workX = -1;
        if (taken) {
          c.carrying = taken;
          c.state = 'idle';
          c.until = game.time + 0.5;
          return true;
        }
      } else if (this.stepToward(game, c, c.workX + 0.5, c.workY + 0.5, dt) === 'blocked') c.workX = -1;
      else return true;
    }
    if (game.time >= c.searchAt) {
      c.searchAt = game.time + 1.2;
      let best: Creature | null = null;
      let bestD = Infinity;
      for (const o of this.list.values()) {
        if (o.id === c.id || !quarry(o)) continue;
        if (Math.max(Math.abs(o.x - deed.x), Math.abs(o.y - deed.y)) > range) continue;
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      if (best) {
        c.enemy = best.id;
        this.gainSkill(game, c, FIGHT_SKILL, 0.08);
        return true;
      }
    }
    // Nothing worth chasing: walk the country and look again.
    if (c.state === 'wander') {
      if (this.stepToward(game, c, c.tx, c.ty, dt, 0.9) !== 'moving') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return true;
    }
    if (game.time >= c.until) {
      this.wanderTarget(game, c, Math.min(range, 8), deed.x + 0.5, deed.y + 0.5);
      c.state = 'wander';
      c.until = game.time + 6;
    }
    return true;
  }

  private guardStep(game: Game, c: Creature, dt: number, deed: WorkSite): void {
    const range = deed.radius + 1;
    if (c.enemy !== null) {
      const e = this.list.get(c.enemy);
      const gone = !e || !quarry(e) || Math.max(Math.abs(e.x - deed.x), Math.abs(e.y - deed.y)) > range + 3;
      if (gone) c.enemy = null;
      else {
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d <= 1) {
          if (c.cooldown <= 0) {
            this.attack(game, c, e);
            c.cooldown = 1.2 / this.mul(c, 'haste');
          }
        } else if (this.stepToward(game, c, e.x, e.y, dt, 1.3) === 'blocked') c.enemy = null;
        return;
      }
    }
    if (game.time >= c.searchAt) {
      c.searchAt = game.time + 1.5;
      let best: Creature | null = null;
      let bestD = Infinity;
      for (const o of this.list.values()) {
        if (o.id === c.id || !quarry(o)) continue;
        if (Math.max(Math.abs(o.x - deed.x), Math.abs(o.y - deed.y)) > range) continue;
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      if (best) {
        c.enemy = best.id;
        this.gainSkill(game, c, GATHER_SKILL.guard, 0.1);
        return;
      }
    }
    // Nothing about: walk the border.
    if (c.state === 'wander') {
      if (this.stepToward(game, c, c.tx, c.ty, dt, 0.8) !== 'moving') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return;
    }
    if (game.time < c.until) return;
    this.wanderTarget(game, c, Math.max(2, deed.radius), deed.x + 0.5, deed.y + 0.5);
    c.until = game.time + 4;
  }

  /**
   * Put two together. What the pairing throws is settled here and now, at the
   * covering, and carried by the dam: a sire that is sold, released or eaten
   * before the hour comes has already had his say. So is his name, and where
   * each trait came from, which the young one is born with as its pedigree.
   */
  pair(game: Game, dam: Creature, sire: Creature, husbandry: number, sex?: Sex): void {
    const care = (dam.care + sire.care) / 2;
    // More of the pair in it, and more of it a tier better, for a Herdsman's True Blood and Bred Up.
    const keepPlus = game.perk('breed:inherit', 0);
    // And more for Love's Good Stock.
    const upPlus = game.perk('breed:upgrade', 0) + game.pathFx('up', 0);
    const young = (): { traits: string[]; sex: Sex; from: Record<string, TraitSource> } => {
      const bred = breedTraits(sire.traits, dam.traits, husbandry, care, game.rand, keepPlus, upPlus);
      // The one the breeder asked for (a Herdsman's Choose the Sex), or even odds.
      return { traits: bred.traits, sex: sex ?? (game.rand() < 0.5 ? 'male' : 'female'), from: bred.from };
    };
    dam.unborn = { ...young(), sire: { id: sire.id, name: sire.name } };
    // And a second at the same covering, now and then (a Herdsman's Twins).
    if (game.rand() < game.perk('breed:twins', 0)) dam.unborn.twin = young();
    // Carried for less of the time (a Herdsman's Quick Gestation).
    dam.due = game.time + GESTATION * game.perk('breed:gestation', 1);
    // And both ready again sooner (a Herdsman's Short Rest): the rest left is the perk's share of it.
    dam.bredAt = game.time - BREED_REST * (1 - game.perk('breed:rest', 1));
    sire.bredAt = dam.bredAt;
  }

  /** The hour comes: one young, or two from a covering that threw twins, each placed as a tamed one is. */
  giveBirth(game: Game, dam: Creature): Creature | null {
    const coming = dam.unborn;
    dam.unborn = null;
    dam.due = 0;
    if (!coming) return null;
    let first: Creature | null = null;
    for (const one of [coming, ...(coming.twin ? [{ ...coming.twin, sire: coming.sire }] : [])]) {
      const c = this.dropYoung(game, dam, one);
      first ??= c;
    }
    return first;
  }

  /** One young dropped: where it goes, what it carries, and what is said. */
  private dropYoung(game: Game, dam: Creature, coming: Unborn): Creature {
    const def = this.species(dam);
    /*
     * Where it goes, now that nothing is kept at the token: where a tamed one
     * goes, and then a crate standing on your settlement. A dam let go before
     * her hour drops a wild one. Otherwise it follows you when nothing else
     * does; goes into an empty creature crate in your pack when something
     * does; and, carrying none, into an empty one of yours standing on your
     * settlement, the nearest the dam. With none of those it goes off into
     * the wild.
     */
    const crate = dam.mode !== 'wild' && this.active() ? emptyCrate(game) ?? standingCrate(game, dam.x, dam.y) : undefined;
    let mode: CreatureMode = 'wild';
    let at: [number, number] = [dam.x, dam.y];
    let where = '';
    if (dam.mode === 'wild') {
      // Hers, and she is nobody's.
    } else if (!this.active()) {
      mode = 'active';
      at = [game.player.x, game.player.y];
      where = ' It follows you.';
    } else if (crate && 'kind' in crate) {
      mode = 'stored';
      where = ` It goes into the empty creature crate at (${crate.x}, ${crate.y}) on ${game.deed?.name ?? 'your settlement'}.`;
    } else if (crate) {
      mode = 'stored';
      where = ' It goes into the creature crate in your pack.';
    } else {
      where = ' Something already follows you and there is no empty creature crate in your pack or standing on your settlement, so it goes off into the wild.';
    }
    const c = this.spawn(dam.species, at[0], at[1], mode, game.rand, game.time);
    c.traits = coming.traits;
    c.sex = coming.sex;
    /*
     * And its pedigree, for good: the dam as she is now, and the sire and
     * where each trait came from as the covering wrote them down. A young one
     * of a covering made before pedigrees were kept has none, rather than
     * half of one.
     */
    c.pedigree = coming.sire ? { dam: { id: dam.id, name: dam.name }, sire: coming.sire, from: coming.from ?? {} } : null;
    c.hunger = 0.9;
    c.care = 0.5;
    c.health = maxHealth(c, def);
    if (crate) shutIn(game, c, crate);
    game.logMsg(`${dam.name} drops a young ${def.name.toLowerCase()} (${SEX_NAMES[c.sex]}): ${traitList(c.traits)}.${where}`, 'event');
    game.note('bred');
    // A page of the field guide, for a young one born to a dam somebody keeps:
    // one let go before her hour drops hers in the wild, and it is nobody's.
    if (dam.mode !== 'wild') game.guideMark(dam.species, 'bred');
    if (c.traits.some((t) => traitTier(t) === 'supreme' || traitTier(t) === 'fantastic')) game.note('goodblood');
    if (c.traits.some((t) => traitTier(t) === 'fantastic')) game.note('fantasticblood');
    game.events.emit('creature');
    return c;
  }

  /** A go at its own task, for a kind that learns its own skill this way (`LearnsBy`). The island's `beast_learns`. */
  learnBy(game: Game, c: Creature, by: LearnsBy): void {
    const l = this.species(c).learns;
    if (l && l.by === by && c.mode !== 'wild') this.gainSkill(game, c, l.skill, LEARNS_GAIN[by]);
  }

  /** Same diminishing curve as the player's skills. */
  gainSkill(game: Game, c: Creature, id: string, base: number): number {
    const v = c.skills[id] ?? 1;
    // A beast learns on the same curve a player does, and crawls the same last
    // stretch of it.
    const gain = skillGain(v, base * this.learnMul(c), 0.6 + 0.8 * game.rand());
    const before = creatureLevel(c);
    const beforeSteps = rangeSteps(v);
    c.skills[id] = Math.min(100, v + gain);
    c.xp += gain;
    if (creatureLevel(c) > before) game.logMsg(`${c.name} reaches level ${creatureLevel(c)}.`, 'skill');
    // And evolves, at a level a stage begins at: what it can take grows with it, as full as it was (`EVOLVE_AT`).
    const stage = stageOf(c);
    if (stage > stageOf({ species: c.species, skills: { ...c.skills, [id]: v } })) {
      c.health *= STAGE_MUL.hardy ?? 1;
      if (c.mode !== 'wild') game.logMsg(`${c.name} evolves into a ${kindName(c)}!`, 'skill');
      game.events.emit('evolve', c.id, stage);
      this.acted(c, 'evolve', game.time);
    }
    const def = this.species(c);
    if (c.mode === 'deed' && id === workSkill(def) && rangeSteps(c.skills[id]) > beforeSteps) {
      game.logMsg(`${c.name} knows the land better and will now work up to ${workRangeOf(c, def)} tiles from where it is set to work.`, 'skill');
    }
    return gain;
  }

  private updateWild(c: Creature, dt: number, game: Game): void {
    c.hunger = Math.max(0, c.hunger - dt * HUNGER_RATE.wild * bloodMul(c, 'appetite'));
    const def = this.species(c);
    const kind = wildGather(def);
    if (c.state === 'flee') {
      if (game.time >= c.until) c.state = 'idle';
      else if (this.stepToward(game, c, c.tx, c.ty, dt, 1.6) !== 'moving') c.state = 'idle';
      return;
    }
    if (c.state === 'forage') {
      if (game.time >= c.until) {
        const food = kind ? this.finishForage(game, c, kind) : null;
        if (food && isBaitFor(def, food.id)) c.hunger = Math.min(1, c.hunger + GRAZE_FILL);
        c.state = 'idle';
        c.until = game.time + 2 + game.rand() * 3;
      }
      return;
    }
    if (c.state === 'toForage') {
      const r = this.stepToward(game, c, c.tx, c.ty, dt);
      if (r === 'arrived') {
        if (kind && this.gatherable(game, Math.floor(c.x), Math.floor(c.y), kind, c)) this.beginForage(game, c, kind);
        else c.state = 'idle';
      } else if (r === 'blocked') c.state = 'idle';
      return;
    }
    if (c.brawl !== null && this.brawlStep(game, c, def, dt)) return;
    if ((def.hunter || c.enemy === PLAYER_ATTACKER) && this.huntStep(game, c, def, dt)) return;
    if (kind && c.hunger < GRAZE_HUNGRY && game.time >= c.searchAt) {
      c.searchAt = game.time + 4;
      const t = this.findForageTile(game, c.x, c.y, 3, kind, c);
      if (t) {
        c.tx = t.x + 0.5;
        c.ty = t.y + 0.5;
        c.state = 'toForage';
        return;
      }
    }
    if (c.state === 'wander') {
      if (this.stepToward(game, c, c.tx, c.ty, dt, 0.7) !== 'moving') {
        c.state = 'idle';
        c.until = game.time + WILD_REST + game.rand() * WILD_REST_SPREAD;
      }
      return;
    }
    /*
     * A step about its own country, rather than a step from wherever it last
     * got to. Past the edge of its range it turns for home instead, which is
     * what keeps an island's wildlife somewhere in particular.
     */
    if (game.time >= c.until) {
      // A pack keeps closer to home, so that it is met together.
      if (Math.hypot(c.x - c.homeX, c.y - c.homeY) > (def.pack ? PACK_RANGE : WILD_RANGE)) this.wanderTarget(game, c, WILD_REACH, c.homeX, c.homeY);
      else this.wanderTarget(game, c, WILD_REACH);
    }
  }

  /**
   * A wild thing you have struck, that does not bolt, turns on you: it comes
   * at you and lands its own blows on its own clock (`blowEvery`) until you
   * are `FIGHT_GIVE_UP` tiles off or it has come `FIGHT_LEASH` from where it
   * was struck. A hunter already on you carries on as it was.
   */
  engage(game: Game, c: Creature): void {
    if (c.mode !== 'wild' || c.health <= 0) return;
    if (this.species(c).timid) return;
    /*
     * Threat: it goes for whatever hurt it last, once what it is on has not
     * hurt it for `THREAT_HOLD` seconds. On something else that has, it stays
     * on that, and comes for you after.
     */
    if (c.brawl === null || game.time - c.threatAt >= THREAT_HOLD) {
      if (c.brawl !== null) game.logMsg(`The ${this.species(c).name.toLowerCase()} turns back on you.`, 'fight');
      c.brawl = null;
      c.threatAt = game.time;
    }
    if (c.enemy === PLAYER_ATTACKER) return;
    c.enemy = PLAYER_ATTACKER;
    c.huntX = c.x;
    c.huntY = c.y;
    c.blows = 0;
    c.windup = 0;
    // One of a pack struck leads whatever of its pack comes to it (`PACK_CALL`).
    c.packLead = this.species(c).pack ? c.id : null;
    // Whatever it was about, it is about you now.
    if (c.state !== 'flee') {
      c.state = 'idle';
      c.until = game.time;
    }
  }

  /**
   * A hunter closing on the player, or anything else you have struck that
   * stands and fights. A hunter gives up when you get far enough away, and
   * turns tail when its nerve goes (`nerveGoes`); the rest fight on the
   * shorter leash a fight they did not go looking for is worth.
   *
   * One of a pack comes when another of its kind within `PACK_CALL` is on you,
   * and a pack spreads round you (`packWay`); a thrower keeps its distance
   * (`throwStep`).
   */
  private huntStep(game: Game, c: Creature, def: SpeciesDef, dt: number): boolean {
    const p = game.player;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    const hunting = c.enemy === PLAYER_ATTACKER;
    const giveUp = !def.hunter ? FIGHT_GIVE_UP : def.monster ? HUNT_GIVE_UP * 2.2 : HUNT_GIVE_UP;
    /*
     * Two measures, and the first to run out ends it. How far it has come
     * from where the chase began is the one that grows while it chases — the
     * gap to you does not, because it is closing that — and how far it is
     * from its own home ground is what stops a hunter that had already
     * strayed from taking you another thirty tiles beyond where it strayed
     * to.
     */
    const came = Math.hypot(c.x - c.huntX, c.y - c.huntY);
    const out = Math.hypot(c.x - c.homeX, c.y - c.homeY);
    const spent = came > (def.hunter ? HUNT_LEASH : FIGHT_LEASH) || out > HUNT_HOME;
    if (hunting && (d > giveUp || spent)) {
      c.enemy = null;
      c.windup = 0;
      if (spent) {
        c.huntRest = game.time + HUNT_REST;
        // And back to its own country, rather than standing wherever it
        // happened to stop. A hunter that gave up ten valleys from home and
        // stayed there is how a range stops meaning anything.
        c.tx = c.homeX;
        c.ty = c.homeY;
        c.state = 'wander';
      }
      return false;
    }
    if (hunting && this.nerveGoes(game, c, def)) {
      this.turnTail(game, c, def);
      return true;
    }
    if (!hunting) {
      // Only a hunter goes looking for a fight.
      if (!def.hunter) return false;
      if (game.time < c.searchAt || game.time < c.huntRest) return false;
      // One of its pack already on you brings it, from wherever it can hear.
      const mate = def.pack ? this.packmateOn(game, c) : null;
      // And from closer by night to one in a Shadowcloak (`shadowNotice`).
      if (!mate && d > (def.notice ?? HUNT_SIGHT) * game.shadowNotice()) return false;
      c.searchAt = game.time + 2;
      if (!this.tileOk(game, Math.floor(p.x), Math.floor(p.y))) return false;
      c.enemy = PLAYER_ATTACKER;
      c.huntX = c.x;
      c.huntY = c.y;
      c.blows = 0;
      c.windup = 0;
      c.packLead = !def.pack ? null : mate ? (mate.packLead ?? mate.id) : c.id;
      game.logMsg(mate ? `Another ${def.name.toLowerCase()} comes with it.` : `A ${def.name.toLowerCase()} has your scent.`, 'fight');
    }
    const name = def.name.toLowerCase();
    /*
     * Drawing back for a heavy blow: it stands where it is for `WIND_UP`, and
     * lands it on whatever is still in its reach. Stepping out of it is the
     * whole of the answer.
     */
    if (c.windup > 0) {
      c.windup -= dt;
      if (c.windup > 0) return true;
      c.windup = 0;
      c.blows += 1;
      c.cooldown = blowEvery(def) / this.mul(c, 'haste');
      if (d <= HUNT_REACH) {
        p.attackedBy = c.id;
        p.attackedAt = game.time;
        // With less of its extra weight on Power's Unshaken (`heavy_on`).
        game.hurtPlayer(attackOf(c, def) * BLOW_SHARE * (1 + (HEAVY_HIT - 1) * game.pathFx('heavy', 1)), `The ${name}'s heavy blow lands`, def.wound ?? 'bite');
      } else game.logMsg(`The ${name}'s heavy blow falls short.`, 'fight');
      return true;
    }
    if (def.throws && this.throwStep(game, c, def, d, dt)) return true;
    if (d <= HUNT_REACH) {
      if (c.cooldown <= 0) {
        // Every `HEAVY_EVERY`th blow of a kind that hits heavy is drawn back for first.
        if (def.heavy && (c.blows + 1) % HEAVY_EVERY === 0) {
          c.windup = WIND_UP;
          game.logMsg(`The ${name} draws back for a heavy blow. Step out of its reach.`, 'fight');
          return true;
        }
        c.blows += 1;
        c.cooldown = blowEvery(def) / this.mul(c, 'haste');
        p.attackedBy = c.id;
        p.attackedAt = game.time;
        game.hurtPlayer(attackOf(c, def) * BLOW_SHARE, `The ${name} is on you`, def.wound ?? 'bite');
      }
      return true;
    }
    // A pack goes round to its own sides of you; anything else comes straight in.
    const way = this.packWay(game, c, CIRCLE_R) ?? p;
    if (this.stepToward(game, c, way.x, way.y, dt, 1.15) === 'blocked') c.enemy = null;
    return true;
  }

  /**
   * A wild thing fighting a tame one that hurt it (`brawl`): it goes to it and
   * lands its blows on its own clock, as it would on you, until the other is
   * gone, `FIGHT_LEASH` off, or it loses its nerve. Then whatever it was after
   * before, if anything, it goes back to.
   */
  private brawlStep(game: Game, c: Creature, def: SpeciesDef, dt: number): boolean {
    const e = c.brawl === null ? undefined : this.list.get(c.brawl);
    if (!e || e.mode === 'wild' || e.mode === 'stored' || e.health <= 0 || e.hitchedTo !== null
        || Math.hypot(e.x - c.x, e.y - c.y) > FIGHT_LEASH) {
      c.brawl = null;
      return false;
    }
    if (def.hunter && c.health < maxHealth(c, def) * turnsAt(def)) {
      this.turnTail(game, c, def, e);
      return true;
    }
    if (Math.hypot(e.x - c.x, e.y - c.y) <= HUNT_REACH) {
      if (c.cooldown <= 0) {
        c.cooldown = blowEvery(def) / this.mul(c, 'haste');
        this.attack(game, c, e);
      }
      return true;
    }
    if (this.stepToward(game, c, e.x, e.y, dt, 1.15) === 'blocked') c.brawl = null;
    return true;
  }

  /** What is after you this frame, worked out once a frame for the pack rules to look through. */
  private onYouAt = -1;
  private onYouList: Creature[] = [];
  private onYou(game: Game): Creature[] {
    if (this.onYouAt !== game.time) {
      this.onYouAt = game.time;
      this.onYouList = [];
      for (const o of this.list.values()) if (o.mode === 'wild' && o.enemy === PLAYER_ATTACKER && o.health > 0) this.onYouList.push(o);
    }
    return this.onYouList;
  }

  /** Another of its kind within `PACK_CALL` of it that is already after you. */
  private packmateOn(game: Game, c: Creature): Creature | null {
    for (const o of this.onYou(game)) {
      if (o.id !== c.id && o.species === c.species && Math.hypot(o.x - c.x, o.y - c.y) <= PACK_CALL) return o;
    }
    return null;
  }

  /**
   * Where one of a pack on you makes for next while it is not yet on its own
   * side of you, `r` tiles out; null once it is, or when it hunts alone.
   *
   * The pack is the leader and every one following it; the leader's side is
   * where it already is, and the rest share the circle out evenly from there
   * in the order they came into the world (`slotAngle`).
   */
  private packWay(game: Game, c: Creature, r: number): { x: number; y: number } | null {
    if (c.packLead === null) return null;
    const p = game.player;
    const pack = this.onYou(game).filter((o) => o.packLead === c.packLead)
      .sort((a, b) => (a.id === c.packLead ? -1 : b.id === c.packLead ? 1 : a.id - b.id));
    const k = pack.indexOf(c);
    if (pack.length < 2 || k < 0) return null;
    const lead = pack[0];
    const slot = slotAngle(Math.atan2(lead.y - p.y, lead.x - p.x), k, pack.length);
    const own = Math.atan2(c.y - p.y, c.x - p.x);
    if (Math.abs(turnTo(own, slot)) <= CIRCLE_ARC) return null;
    const at = circlePoint(p.x, p.y, own, slot);
    // `circlePoint` is `CIRCLE_R` out; a thrower goes round further out.
    return { x: p.x + ((at.x - p.x) * r) / CIRCLE_R, y: p.y + ((at.y - p.y) * r) / CIRCLE_R };
  }

  /**
   * A thrower's step. Nearer than `KEEP_OFF - BACK_SLACK` it backs away from
   * you, and when it has nowhere to back to it is false, for the blow by hand;
   * within `THROW_REACH` it stands and throws on its blow clock; further, it
   * closes to `KEEP_OFF`, round to its own side of you when it runs with a pack.
   */
  private throwStep(game: Game, c: Creature, def: SpeciesDef, d: number, dt: number): boolean {
    const p = game.player;
    if (d < KEEP_OFF - BACK_SLACK) {
      const away = Math.max(0.001, d);
      return this.stepToward(game, c, c.x + ((c.x - p.x) / away) * 2, c.y + ((c.y - p.y) / away) * 2, dt, BACK_PACE) === 'moving';
    }
    if (d <= THROW_REACH) {
      if (c.cooldown <= 0) {
        c.blows += 1;
        c.cooldown = blowEvery(def) / this.mul(c, 'haste');
        p.attackedBy = c.id;
        p.attackedAt = game.time;
        game.hurtPlayer(attackOf(c, def) * BLOW_SHARE * THROW_HIT, `The ${def.name.toLowerCase()}'s stone finds you`, 'crush');
      }
      return true;
    }
    const way = this.packWay(game, c, KEEP_OFF) ?? { x: p.x + ((c.x - p.x) / d) * KEEP_OFF, y: p.y + ((c.y - p.y) / d) * KEEP_OFF };
    if (this.stepToward(game, c, way.x, way.y, dt, 1.15) === 'blocked') c.enemy = null;
    return true;
  }

  /**
   * Whether a hunter on you has had enough: hurt below what its kind stands
   * (`turnsAt`), the one leading its pack dead or run, or a coward below
   * `COWARD_DRAG` with another of its kind within `PACK_CALL` already run.
   */
  private nerveGoes(game: Game, c: Creature, def: SpeciesDef): boolean {
    if (!def.hunter) return false;
    const max = maxHealth(c, def);
    if (c.health < max * turnsAt(def)) return true;
    if (c.packLead !== null && c.packLead !== c.id) {
      const lead = this.list.get(c.packLead);
      if (!lead || lead.mode !== 'wild' || lead.health <= 0 || game.time < lead.huntRest) return true;
    }
    if (def.coward && c.health < max * COWARD_DRAG) {
      for (const o of this.list.values()) {
        if (o.id !== c.id && o.species === c.species && o.mode === 'wild' && game.time < o.huntRest
            && Math.hypot(o.x - c.x, o.y - c.y) <= PACK_CALL) return true;
      }
    }
    return false;
  }

  /** It runs: away from you, or from what it was fighting, at `FLEE_PACE` for `FLEE_SECS`, and takes no interest in you for `HUNT_REST`. */
  private turnTail(game: Game, c: Creature, def: SpeciesDef, from: { x: number; y: number } = game.player): void {
    const p = from;
    const d = Math.max(0.001, Math.hypot(c.x - p.x, c.y - p.y));
    const run = def.speed * FLEE_PACE * FLEE_SECS;
    c.enemy = null;
    c.brawl = null;
    c.windup = 0;
    c.huntRest = game.time + HUNT_REST;
    c.state = 'flee';
    c.tx = c.x + ((c.x - p.x) / d) * run;
    c.ty = c.y + ((c.y - p.y) / d) * run;
    c.until = game.time + FLEE_SECS;
    game.logMsg(`The ${def.name.toLowerCase()} turns tail.`, 'fight');
  }

  private updateActive(c: Creature, dt: number, game: Game): void {
    c.hunger = Math.max(0, c.hunger - dt * HUNGER_RATE.active * bloodMul(c, 'appetite') * keptOf(c, 'kept:hunger', 1));
    const p = game.player;
    const distP = Math.hypot(p.x - c.x, p.y - c.y);
    if (distP > 18) {
      // Lost sight of you: catches up -- unless you are on a deck on piers,
      // where it does not go (`tileOk`): it waits for you to come off it.
      if (!game.buildings.onPiers(Math.floor(p.x), Math.floor(p.y))) {
        c.x = p.x;
        c.y = p.y;
      }
      c.enemy = null;
      return;
    }
    if (this.comeWhenCalled(c, dt, game)) return;
    // Fallen back (`FALL_BACK`): at your side, and no fight of its own until the time is up.
    // A passive one fights only what it is told to (`order_attack`), which is the one way it has an enemy.
    // As far as it looks and as far as it follows a fight: further for a Beastmaster's Long Leash.
    const sight = game.perk('sight:companion', COMPANION_SIGHT);
    const leash = game.perk('leash:companion', COMPANION_LEASH);
    if (game.time < c.heelUntil) c.enemy = null;
    else if (c.enemy === null && c.stance !== 'passive') {
      let found: Creature | null = null;
      // Guarding you: whatever is hunting you, nearest first, before it lands a blow.
      if (c.stance === 'guard') {
        let bestD = Infinity;
        for (const o of this.onYou(game)) {
          const d = Math.hypot(o.x - p.x, o.y - p.y);
          if (quarry(o) && d <= sight && d < bestD) {
            bestD = d;
            found = o;
          }
        }
      }
      if (found) {
        // Found above.
      } else if (c.stance === 'aggressive') {
        let bestD = Infinity;
        for (const o of this.list.values()) {
          if (o.id === c.id || !quarry(o)) continue;
          const d = Math.hypot(o.x - p.x, o.y - p.y);
          if (d <= sight && d < bestD) {
            bestD = d;
            found = o;
          }
        }
      } else {
        const recent = (at: number): boolean => game.time - at < BLOW_MEMORY;
        const threat = recent(c.attackedAt) ? c.attackedBy : recent(p.attackedAt) ? p.attackedBy : null;
        const t = threat === null ? undefined : this.list.get(threat);
        // Only something wild: a worker of your own that nipped you is not a fight for it.
        if (t && t.id !== c.id && quarry(t)) found = t;
      }
      if (found) {
        c.enemy = found.id;
        game.logMsg(`${c.name} goes for the ${this.species(found).name.toLowerCase()}.`, 'fight');
      }
    }
    if (c.enemy !== null) {
      const e = c.enemy === PLAYER_ATTACKER ? undefined : this.list.get(c.enemy);
      // However far it has gone for Love's Steady Herd (`companion_target`), or a Tamer's Bridle on it.
      const steady = game.pathFx('steady', 0) > 0 || (c.tacked && tackEnchant(c, 'tame') > 0);
      if (!e || !quarry(e) || (!steady && Math.hypot(e.x - p.x, e.y - p.y) > (c.stance === 'guard' ? GUARD_RANGE : leash))) {
        c.enemy = null;
      } else {
        const d = Math.hypot(e.x - c.x, e.y - c.y);
        if (d <= COMPANION_REACH) {
          if (c.cooldown <= 0) {
            this.attack(game, c, e);
            c.cooldown = COMPANION_BLOW / this.mul(c, 'haste');
          }
        } else if (c.cooldown <= 0 && this.pounce(game, c, e, d)) {
          c.cooldown = COMPANION_BLOW / this.mul(c, 'haste');
        } else if (this.stepToward(game, c, e.x, e.y, dt, COMPANION_PACE) === 'blocked') {
          c.enemy = null;
        }
        return;
      }
    }
    if (distP > 2.2) {
      this.stepToward(game, c, p.x, p.y, dt, 1.25);
      return;
    }
    if (c.state === 'wander') {
      if (this.stepToward(game, c, c.tx, c.ty, dt, 0.6) !== 'moving') {
        c.state = 'idle';
        c.until = game.time + 2 + game.rand() * 4;
      }
    } else if (game.time >= c.until) this.wanderTarget(game, c, 1.5, p.x, p.y);
  }

  /**
   * A hungry wildermon on a deed helps itself from the stores.
   *
   * A wild one walks to a forage bed and grazes; one kept inside a border has
   * no bed to walk to and, until now, nothing else either — a penned animal
   * simply starved beside a crate of the very thing it eats. It takes the
   * plainest thing in there first, because the good stuff keeps for people.
   *
   * Only what its own kind eats: `isBaitFor` is the same diet that decides
   * what will tame one, and is crossed into `species_diet` for the island.
   */
  private feedFromStores(game: Game, c: Creature, site: { x: number; y: number; radius: number }): boolean {
    const def = this.species(c);
    for (const crate of game.crates.values()) {
      if (Math.abs(crate.x - site.x) > site.radius || Math.abs(crate.y - site.y) > site.radius) continue;
      let worst: Item | undefined;
      for (const it of crate.items ?? []) {
        if (!isBaitFor(def, it.id)) continue;
        if (!worst || it.ql < worst.ql) worst = it;
      }
      if (!worst) continue;
      if (worst.count > 1) worst.count -= 1;
      else crate.items.splice(crate.items.indexOf(worst), 1);
      c.hunger = Math.min(1, c.hunger + GRAZE_FILL);
      game.events.emit('crate');
      return true;
    }
    return false;
  }

  private updateWorker(c: Creature, dt: number, game: Game): void {
    c.hunger = Math.max(0, c.hunger - dt * HUNGER_RATE.deed * bloodMul(c, 'appetite') * keptOf(c, 'kept:hunger', 1));
    // A post stands in for the token: the same loop, a different middle.
    const deed = game.workSite(c);
    if (!deed) {
      c.mode = 'wild';
      return;
    }
    // Hungry, and standing on land with stores on it. Looked for on the same
    // clock the wild ones look for a forage bed on, so it costs no more.
    if (c.hunger < GRAZE_HUNGRY && game.time >= c.searchAt) {
      c.searchAt = game.time + 4;
      this.feedFromStores(game, c, deed);
    }
    if (this.comeWhenCalled(c, dt, game)) return;
    const def = this.species(c);
    const kind = c.trade ?? def.gathers;
    // Standing orders come before any job: an intruder is everyone's business.
    if (this.defendDeed(game, c, dt, deed)) return;
    if (kind === 'guard') {
      this.guardStep(game, c, dt, deed);
      return;
    }
    if (kind === 'stoke' && !c.carrying && c.state !== 'forage') {
      if (this.stokeStep(game, c, dt, deed)) return;
    }
    if (kind === 'hunt' && !c.carrying && c.state !== 'forage') {
      if (this.packHunt(game, c, dt, deed)) return;
    }
    if (kind && ERRAND_JOBS.has(kind) && c.state !== 'forage') {
      if (this.errandStep(game, c, dt, kind, deed)) return;
    }
    if (c.state === 'forage') {
      if (game.time >= c.until) {
        c.carrying = kind ? this.finishForage(game, c, kind) : null;
        if (kind) this.acted(c, 'work', game.time);
        c.state = 'idle';
        c.until = game.time + 0.5;
      }
      return;
    }
    if (c.carrying && kind === 'stoke') {
      this.feedFire(game, c, dt);
      return;
    }
    if (c.carrying) {
      if (c.hunger < HUNGRY && isBaitFor(def, c.carrying.id)) {
        c.hunger = Math.min(1, c.hunger + 0.5);
        c.carrying = null;
        return;
      }
      const store = this.storeFor(game, c, c.carrying);
      if (!store) {
        // Everything on the deed is full. A worker will not tip a load out on
        // the ground: it holds on to it and waits for room.
        if (game.time - c.noRoomAt > 60) {
          c.noRoomAt = game.time;
          game.logMsg(`${c.name} is holding ${itemDef(c.carrying.id).name.toLowerCase()} with nowhere on the deed to put it. Empty something, or build more storage.`, 'error');
        }
        this.wanderTarget(game, c, 2, deed.x + 0.5, deed.y + 0.5);
        c.state = 'wander';
        c.until = game.time + 5;
        return;
      }
      const [dx, dy] = store.centre;
      if (Math.hypot(dx - c.x, dy - c.y) <= 1.3) {
        if (!store.add(c.carrying)) return;
        c.carrying = null;
        c.state = 'idle';
        c.until = game.time + 1;
      } else if (this.stepToward(game, c, dx, dy, dt) === 'blocked') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return;
    }
    /*
     * Seed does not live in a worker's cheeks.
     *
     * The pouch is how a harvest's seed rides home, not a place to keep it: a
     * field is sown out of the settlement's stores just as readily as out of a
     * Seavic's mouth, so seed left in one is seed nobody can see, count, cook
     * or plant by hand. Reported from the island as a farm hand that harvested
     * all season and put nothing but the crop in the crate.
     *
     * It goes in at the next store it stands at, which in the ordinary run of
     * things is the one it has just put the harvest into — so the round trip
     * this costs is usually no trip at all. Only when there is somewhere for
     * it to go: a worker with its hands full and nowhere to empty them stops
     * working, and a mouthful of seed is not worth stopping a farm for.
     */
    if (c.pouch && c.pouch.count > 0 && this.storeFor(game, c, c.pouch)) {
      c.carrying = c.pouch;
      c.pouch = null;
      return;
    }
    if (c.pouch && c.pouch.count <= 0) c.pouch = null;
    if (c.hunger < HUNGRY) {
      const larder = this.foodCrate(game, c, def);
      if (larder) {
        const [lx, ly] = larder.centre;
        if (Math.hypot(lx - c.x, ly - c.y) <= 1.3) {
          const idx = larder.items.findIndex((it) => mayEat(def, it));
          if (idx >= 0) {
            const it = larder.items[idx];
            it.count -= 1;
            if (it.count <= 0) larder.items.splice(idx, 1);
            larder.changed();
            c.hunger = Math.min(1, c.hunger + 0.5);
            game.logMsg(`${c.name} helps itself to ${itemDef(it.id).name.toLowerCase()} from the ${larder.name.toLowerCase()}.`, 'event');
          }
        } else this.stepToward(game, c, lx, ly, dt);
        return;
      }
    }
    if (c.state === 'toForage') {
      const r = this.stepToward(game, c, c.tx, c.ty, dt);
      if (r === 'arrived') {
        const apart = !!kind && this.worksBeside(game, kind, c.workX, c.workY);
        const wx = apart ? c.workX : Math.floor(c.x);
        const wy = apart ? c.workY : Math.floor(c.y);
        if (kind && this.gatherable(game, wx, wy, kind, c)) this.beginForage(game, c, kind);
        else c.state = 'idle';
      } else if (r === 'blocked') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return;
    }
    if (c.state === 'wander') {
      if (this.stepToward(game, c, c.tx, c.ty, dt, 0.7) !== 'moving') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return;
    }
    if (game.time < c.until) return;
    // An errand worker never walks out to a tile to work it, so it does not
    // join the search below: when its errand has nothing in it, it waits.
    if (kind && !ERRAND_JOBS.has(kind)) {
      const t = this.findForageTile(game, deed.x + 0.5, deed.y + 0.5, siteRange(c, def, deed), kind, c);
      if (t) {
        // A tree cannot be stood on, so a feller walks to the tile beside it.
        // A tree cannot be stood on and neither can the water: both are worked from beside.
        const spot = kind && this.worksBeside(game, kind, t.x, t.y) ? this.beside(game, t.x, t.y, c.x, c.y) : t;
        if (kind === 'mine') c.job = null;
        if (spot) {
          c.job = kind === 'farm' ? this.farmJobAt(game, c, t.x, t.y) : null;
          c.workX = t.x;
          c.workY = t.y;
          c.tx = spot.x + 0.5;
          c.ty = spot.y + 0.5;
          c.state = 'toForage';
          return;
        }
      }
    }
    // Nothing to do right now: potter about near the token.
    this.wanderTarget(game, c, 3, deed.x + 0.5, deed.y + 0.5);
    c.until = game.time + 4;
  }

  /**
   * Where a load should go: the store built for exactly this thing, then the
   * settlement's own crate while it has room, then the nearest other store
   * that will take it. Null means every place on the deed is full, which is a
   * reason to stop rather than to tip the load out on the ground.
   *
   * The purpose-built store comes first because that is what it is for. A raw
   * material bin holds four hundred where a crate holds a fraction of that and
   * takes nothing a bench has touched, and a worker that filled the deed crate
   * with ore left nowhere for the things only a crate will hold. Asked for:
   * "molas should prioritize storing into raw material bins."
   *
   * It needs no test on what the load is: the list has already been through
   * `furnitureRefuses`, so a restricted store still in it is the one built for
   * this thing. Which is how the craft bin, and then the larder, the seed bin
   * and the sprout bin, joined the rule without a clause each.
   */
  storeFor(game: Game, c: Creature, item: Item): DeedStore | null {
    // A worker out on a post fills whatever stands beside the post before it
    // walks the load all the way home; a worker on the deed fills the
    // settlement's own crate first, as it always has.
    const near = game.postStores(c).filter((s) => s.room(item));
    const stores = near.length ? near : game.deedStores().filter((s) => s.room(item));
    if (!stores.length) return null;
    const nearest = (of: DeedStore[]): DeedStore | null => {
      let best: DeedStore | null = null;
      let bestD = Infinity;
      for (const s of of) {
        const d = Math.hypot(s.centre[0] - c.x, s.centre[1] - c.y);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    };
    // A bin that will have it is the bin built for it: the island's
    // `worker_store` orders by the same one flag, with no second test on what
    // the load is.
    const bin = nearest(stores.filter((s) => s.bin));
    if (bin) return bin;
    const own = near.length ? undefined : stores.find((s) => s.deed);
    if (own) return own;
    return nearest(stores) ?? stores[0];
  }

  /**
   * The nearest store on the deed holding something this creature will eat.
   *
   * Every store on the deed, not only the crates: a larder holds a hundred and
   * fifty and is where anybody would actually keep the food, and a worker that
   * looked in crates alone starved standing next to one. `deedStores` is the
   * same list a load gets put away into, so a cupboard, a chest, a shelf or a
   * cart all count, and a trash crate does not.
   */
  private foodCrate(game: Game, c: Creature, def: SpeciesDef): DeedStore | null {
    let best: DeedStore | null = null;
    let bestD = Infinity;
    for (const store of game.deedStores()) {
      if (!store.items.some((it: Item) => mayEat(def, it))) continue;
      const d = Math.hypot(store.centre[0] - c.x, store.centre[1] - c.y);
      if (d < bestD) {
        bestD = d;
        best = store;
      }
    }
    return best;
  }

  /** Ask a tamed creature to come over, so an action on it can start where the player stands. */
  callToPlayer(game: Game, c: Creature): void {
    if (c.mode === 'wild' || c.mode === 'stored') return;
    c.calledAt = game.time;
    c.enemy = null;
    c.state = 'idle';
    c.until = game.time;
  }

  /** True while a called creature is making its way to the player, or waiting there. */
  private comeWhenCalled(c: Creature, dt: number, game: Game): boolean {
    if (game.time - c.calledAt >= CALL_WINDOW) return false;
    const p = game.player;
    c.enemy = null;
    if (Math.hypot(p.x - c.x, p.y - c.y) > CALL_DISTANCE && this.stepToward(game, c, p.x, p.y, dt, 1.35) === 'moving') return true;
    // Arrived, or cannot get closer: stand still so the action can run.
    c.state = 'idle';
    c.until = game.time + 1;
    return true;
  }

  attack(game: Game, a: Creature, t: Creature): void {
    // Its own ability instead, when it is ready and there is a use for it (`AbilityId`).
    if (a.mode !== 'wild' && this.species(a).ability && this.ability(game, a, t)) return;
    this.acted(a, 'strike', game.time);
    const trained = trainedHit(a.skills[FIGHT_SKILL] ?? 0);
    const style = a.mode === 'wild' ? undefined : this.species(a).style;
    // Its blood has a say in what it lands for, as it does in what it bites you for.
    // And more by your companion inside a Heart of the Herd (`herd_heart`).
    // And harder for how it fights (`FightStyle`): a borer on a hide, a flanker on one whose mind is elsewhere.
    const dmg = this.species(a).attack * this.mul(a, 'tough') * trained * (0.7 + game.rand() * 0.6) * game.herdMul(a, 'dealt')
      * (style === 'bore' && this.species(t).hide ? BODKIN_HIDE : 1)
      * (style === 'flank' && this.elsewhere(t, a) ? BLINDSIDE : 1)
      // And smaller while its claws are dulled (`binder_dull_claws`).
      * markOn(game, a, 'dull');
    this.hurt(game, t, dmg, a);
    if (style && t.health > 0 && this.list.has(t.id)) this.styleBlow(game, a, t, style, dmg);
    // And pushed off while a keep-away holds on what struck it (`pikeman_keep_away`).
    const push = markOn(game, a, 'keep_away', 0);
    if (push > 0 && t.health > 0 && this.list.has(t.id)) this.shove(game, t, a.x, a.y, push);
    if (a.skills[FIGHT_SKILL] !== undefined) this.gainSkill(game, a, FIGHT_SKILL, 0.05);
  }

  /** A blow of one of yours at a share of its own, as a Beastmaster's companion strikes (`class_beast_blow`). */
  private blowAt(game: Game, a: Creature, t: Creature, more: number): { died: boolean; dmg: number } {
    const dmg = this.species(a).attack * this.mul(a, 'tough') * trainedHit(a.skills[FIGHT_SKILL] ?? 0) * (0.7 + game.rand() * 0.6)
      * game.herdMul(a, 'dealt') * more;
    this.hurt(game, t, dmg, a);
    if (a.skills[FIGHT_SKILL] !== undefined) this.gainSkill(game, a, FIGHT_SKILL, 0.05);
    return { died: !this.list.has(t.id) || t.health <= 0, dmg };
  }

  /** Held where it stands, neither moving nor striking, as a Skull Crack holds it (`class_hold`). */
  private holdFor(game: Game, t: Creature, secs: number): void {
    t.stunUntil = Math.max(t.stunUntil ?? 0, game.time + secs);
    t.windup = 0;
    t.moving = false;
  }

  /** Pushed this far from a point, as far of it as the ground lets it go in quarters. The island's `class_shove`. */
  private shove(game: Game, t: Creature, fx: number, fy: number, by: number): void {
    const d = Math.hypot(t.x - fx, t.y - fy);
    if (d < 0.001 || t.mode !== 'wild') return;
    for (let i = 4; i >= 1; i--) {
      const x = t.x + ((t.x - fx) / d) * by * i / 4;
      const y = t.y + ((t.y - fy) / d) * by * i / 4;
      if (this.tileOk(game, Math.floor(x), Math.floor(y)) && this.clearLine(game, t.x, t.y, x, y)) {
        t.x = x;
        t.y = y;
        return;
      }
    }
  }

  /** Nothing a creature cannot stand on between two points. The island's `line_clear`. */
  private clearLine(game: Game, x0: number, y0: number, x1: number, y1: number): boolean {
    const n = Math.max(1, Math.ceil(2 * Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      if (!this.tileOk(game, Math.floor(x0 + ((x1 - x0) * i) / n), Math.floor(y0 + ((y1 - y0) * i) / n))) return false;
    }
    return true;
  }

  /**
   * One of yours uses its ability on what it is fighting, when it is ready and there is a use for it: true when that
   * was its blow, false when it strikes as well or did nothing. Then not again for its rest. The island's
   * `beast_ability`.
   */
  private ability(game: Game, a: Creature, t: Creature): boolean {
    const id = this.species(a).ability!;
    if (markOn(game, a, 'ability', 0) > 0) return false;
    const f = (k: string): number => abilityFx(id, k);
    const tdef = this.species(t);
    let spent = true;
    switch (id) {
      case 'beastmaster_pounce':
        // Used on the way to it (`pounce`), never in reach.
        return false;
      case 'blade_hamstring': {
        if (!this.blowAt(game, a, t, f('more')).died) {
          t.slowPace = f('pace');
          t.slowUntil = game.time + f('secs');
        }
        break;
      }
      case 'berserker_skull_crack':
        if (!this.blowAt(game, a, t, f('more')).died) this.holdFor(game, t, f('hold') * (tdef.monster ? f('monster') : 1));
        break;
      case 'blade_shield_bash':
        if (!this.blowAt(game, a, t, f('more')).died) {
          t.windup = 0;
          t.cooldown = Math.max(0, t.cooldown) + f('back');
        }
        break;
      case 'berserker_execute':
        if (t.health >= maxHealth(t, tdef) * f('low')) return false;
        this.blowAt(game, a, t, f('more'));
        break;
      case 'berserker_whirlwind':
        for (const o of [...this.list.values()]) {
          if (o.mode !== 'wild' || o.health <= 0 || Math.hypot(o.x - a.x, o.y - a.y) > f('reach')) continue;
          for (let n = 0; n < f('blows'); n++) if (this.blowAt(game, a, o, f('more')).died) break;
        }
        break;
      case 'kindler_scorch':
        if (!this.blowAt(game, a, t, f('fire')).died) {
          // As a burn of yours runs (`burn`), at the spell's own numbers.
          const rate = maxHealth(t, tdef) * f('each');
          const running = t.bleedUntil > game.time;
          t.bleedRate = running ? Math.max(t.bleedRate, rate) : rate;
          if (!running) t.bleedFrom = game.time;
          t.bleedUntil = Math.max(running ? t.bleedUntil : 0, game.time + f('secs'));
          t.burnUntil = Math.max(t.burnUntil ?? 0, game.time + f('secs'));
        }
        break;
      case 'frost_breath':
        if (!this.blowAt(game, a, t, 1).died) {
          // As a Frostbite leaves it (`frost`).
          const running = (t.slowUntil ?? 0) > game.time;
          t.slowPace = running ? Math.min(t.slowPace ?? 1, FROST_PACE) : FROST_PACE;
          t.slowUntil = Math.max(running ? t.slowUntil ?? 0 : 0, game.time + FROST_SECS);
        }
        break;
      case 'binder_root':
        if (markOn(game, t, 'root', 0) > 0) return false;
        putMark(game, t, 'root', 1, f('secs'));
        break;
      case 'binder_dull_claws':
        if (markOn(game, t, 'dull') < 1) return false;
        putMark(game, t, 'dull', f('dealt'), f('secs'));
        break;
      case 'binder_brittle':
        if (markOn(game, t, 'brittle') > 1) return false;
        putMark(game, t, 'brittle', f('taken'), f('secs'));
        break;
      case 'skirmisher_marked_for_death':
        if (markOn(game, t, 'marked') > 1) return false;
        putMark(game, t, 'marked', f('crit'), f('secs'));
        break;
      case 'pikeman_keep_away':
        putMark(game, a, 'keep_away', f('push'), f('secs'));
        spent = false;
        break;
      case 'warder_stoneskin':
        putMark(game, a, 'stone', 1 - f('cut'), f('secs'));
        spent = false;
        break;
      case 'blade_guardians_call': {
        let n = 0;
        for (const o of this.list.values()) {
          if (o.mode !== 'wild' || o.health <= 0 || o.brawl === a.id || this.species(o).timid) continue;
          const after = o.enemy === PLAYER_ATTACKER || o.brawl !== null || (o.enemy !== null && this.list.get(o.enemy)?.mode !== 'wild');
          if (!after || Math.hypot(o.x - a.x, o.y - a.y) > f('reach')) continue;
          o.brawl = a.id;
          // Held on it for the whole of the call, as the spell holds them on you.
          o.threatAt = game.time + f('secs') - THREAT_HOLD;
          o.windup = 0;
          n += 1;
        }
        if (n === 0) return false;
        spent = false;
        break;
      }
      case 'warder_ward':
        if (a.mode !== 'active' || game.player.skin.size >= WARD_SKIN) return false;
        game.player.skin = { size: WARD_SKIN, mine: false, by: a.name };
        spent = false;
        break;
      case 'chirurgeon_leech': {
        const was = t.health;
        const top = maxHealth(t, tdef);
        const b = this.blowAt(game, a, t, f('more'));
        a.health = Math.min(maxHealth(a, this.species(a)), a.health + (Math.min(b.dmg, was) / top) * maxHealth(a, this.species(a)));
        break;
      }
    }
    putMark(game, a, 'ability', 1, abilityRest(id));
    this.acted(a, 'cast', game.time);
    if (a.mode === 'active') game.logMsg(`${a.name} uses ${abilityName(id)}.`, 'fight');
    return spent;
  }

  /**
   * A pounce, on the way to what it is going for: within the spell's reach of it and nothing in between, it leaps to
   * half its own reach short of it and strikes, and puts its next blow back. True when it did. The island's
   * `beast_pounce`.
   */
  private pounce(game: Game, c: Creature, e: Creature, d: number): boolean {
    const id: AbilityId = 'beastmaster_pounce';
    if (this.species(c).ability !== id || markOn(game, c, 'ability', 0) > 0 || d > abilityFx(id, 'reach')) return false;
    if (!this.clearLine(game, c.x, c.y, e.x, e.y)) return false;
    let x = e.x - ((e.x - c.x) / Math.max(d, 0.001)) * COMPANION_REACH / 2;
    let y = e.y - ((e.y - c.y) / Math.max(d, 0.001)) * COMPANION_REACH / 2;
    if (!this.tileOk(game, Math.floor(x), Math.floor(y))) {
      x = e.x;
      y = e.y;
    }
    c.x = x;
    c.y = y;
    if (!this.blowAt(game, c, e, abilityFx(id, 'more')).died) {
      e.windup = 0;
      e.cooldown = Math.max(0, e.cooldown) + abilityFx(id, 'back');
    }
    putMark(game, c, 'ability', 1, abilityRest(id));
    this.acted(c, 'cast', game.time);
    if (c.mode === 'active') game.logMsg(`${c.name} uses ${abilityName(id)}.`, 'fight');
    return true;
  }

  /** Whether a wild thing's mind is on a fight with something other than this one: you, or another of yours. The island's `style_dealt`. */
  private elsewhere(t: Creature, a: Creature): boolean {
    return t.brawl !== null ? t.brawl !== a.id : t.enemy !== null && t.enemy !== a.id;
  }

  /** What a blow of one of yours does besides its damage, by how it fights (`FightStyle`). The island's `style_blow`. */
  private styleBlow(game: Game, a: Creature, t: Creature, style: FightStyle, dmg: number): void {
    if (style === 'bleed') {
      // As a knife opens it (`sideBlow`).
      t.bleedRate = Math.max(t.bleedRate, dmg * KNIFE_BLEED);
      t.bleedFrom = game.time;
      t.bleedUntil = game.time + KNIFE_BLEED_SECS;
    } else if (style === 'venom') {
      // As a Venom enchantment leaves it (`venom` in `enchanting.ts`): the stronger of it and a bleed already running, to the later end.
      const rate = maxHealth(t, this.species(t)) * VENOM_DRAIN;
      const running = t.bleedUntil > game.time;
      t.bleedRate = running ? Math.max(t.bleedRate, rate) : rate;
      if (!running) t.bleedFrom = game.time;
      t.bleedUntil = Math.max(running ? t.bleedUntil : 0, game.time + VENOM_SECS);
    } else if (style === 'stun') {
      a.blows += 1;
      // As a Concussion stuns it (`stun` in `enchanting.ts`).
      if (a.blows % HEAVY_EVERY === 0) {
        t.stunUntil = Math.max(t.stunUntil ?? 0, game.time + STUN_SECS);
        t.windup = 0;
        t.moving = false;
      }
    } else if (style === 'shield') {
      for (const o of this.list.values()) {
        if (o.mode !== 'wild' || o.health <= 0 || o.brawl === a.id || this.species(o).timid) continue;
        // After you, or after one of yours.
        const after = o.enemy === PLAYER_ATTACKER || o.brawl !== null || (o.enemy !== null && this.list.get(o.enemy)?.mode !== 'wild');
        if (!after || Math.hypot(o.x - a.x, o.y - a.y) > GUARD_RANGE) continue;
        o.brawl = a.id;
        o.threatAt = game.time;
        o.windup = 0;
        if (a.mode === 'active') game.logMsg(`The ${this.species(o).name.toLowerCase()} turns on ${a.name}.`, 'fight');
      }
    }
  }

  /**
   * Threat, from a tame creature's blow: a wild thing turns on it when what it
   * is on has not hurt it for `THREAT_HOLD` seconds, or at once when it is
   * guarding you.
   */
  private threat(game: Game, t: Creature, by: Creature): void {
    if (t.brawl === by.id) {
      // Kept on it at least as long as it was held there already (`blade_guardians_call`).
      t.threatAt = Math.max(t.threatAt, game.time);
      return;
    }
    if (by.stance !== 'guard' && game.time - t.threatAt < THREAT_HOLD) return;
    t.brawl = by.id;
    t.threatAt = game.time;
    t.windup = 0;
    if (by.mode === 'active') game.logMsg(`The ${this.species(t).name.toLowerCase()} turns on ${by.name}.`, 'fight');
  }

  /** Deal damage from a creature or the player; timid wild creatures bolt, and a kill leaves a corpse. */
  hurt(game: Game, t: Creature, dmg: number, by: Creature | 'player', crit = false): void {
    const from = by === 'player' ? game.player : by;
    const before = t.health;
    // What a blow costs it is its blood's to say, and its herd's.
    // And less on your companion inside a Heart of the Herd (`herd_heart`).
    // And more while it is brittle, and less inside a stone skin (`binder_brittle`, `warder_stoneskin`; the island's `class_brittle`).
    t.health -= dmg * this.mul(t, 'soak') * game.herdMul(t, 'taken') * markOn(game, t, 'brittle') * markOn(game, t, 'stone');
    t.attackedBy = by === 'player' ? PLAYER_ATTACKER : by.id;
    t.attackedAt = game.time;
    game.events.emit('hit', t.x, t.y, Math.max(0, before - Math.max(0, t.health)), crit ? 'crit' : 'dealt');
    // A wild thing that stands and fights turns on a tame one that hurt it (`THREAT_HOLD`).
    if (by !== 'player' && t.mode === 'wild' && by.mode !== 'wild' && t.health > 0 && !this.species(t).timid) this.threat(game, t, by);
    // Nothing that has been hit takes food from the hand that hit it.
    if (by === 'player') forgetCoaxing(t);
    if (t.mode === 'wild' && this.species(t).timid) {
      const dx = t.x - from.x;
      const dy = t.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      t.tx = t.x + (dx / len) * 5;
      t.ty = t.y + (dy / len) * 5;
      t.state = 'flee';
      t.until = game.time + 3;
    }
    if (t.mode === 'active' && by !== 'player' && game.time - (t.busyUntil ?? 0) > 0) game.logMsg(`${t.name} is hurt by a ${this.species(by).name.toLowerCase()}!`, 'fight');
    if (t.health <= 0) this.kill(game, t, by);
  }

  /**
   * Remove a creature and leave its corpse lying on the tile, ready for
   * butchering. `quiet` holds back the lines this writes, for the one caller
   * that has better words of its own: culling a beast you kept is not the
   * same event as killing a wild one, and "has died" is not what happened.
   */
  kill(game: Game, t: Creature, killer: Creature | 'player' | null, quiet = false): void {
    // A beast that dies in the traces leaves an empty yoke behind it, and one
    // that dies under a rider puts them on the ground.
    if (t.hitchedTo !== null) game.unhitch(t);
    if (t.ridden) game.dismount();
    // A hunter marks where its kill went down and comes back for it.
    if (killer && killer !== 'player' && this.species(killer).gathers === 'hunt' && !killer.carrying) {
      killer.workX = Math.floor(t.x);
      killer.workY = Math.floor(t.y);
      this.gainSkill(game, killer, FIGHT_SKILL, 0.4);
    }
    this.list.delete(t.id);
    for (const o of this.list.values()) if (o.enemy === t.id) o.enemy = null;
    const def = this.species(t);
    // Killing one of the bad things is worth writing down.
    if (def.monster && killer === 'player') {
      game.note(`slew:${def.id}`);
      if (!quiet) game.logMsg(`The ${def.name.toLowerCase()} goes down. Butcher it before it rots: there is a great deal on it.`, 'fight');
    }
    const x = Math.floor(t.x);
    const y = Math.floor(t.y);
    // What the carcass is worth follows the size of the thing that left it.
    const size = ageDef(t, game.time).yield;
    game.dropOnGround(x, y, { uid: game.inventory.nextUid++, id: 'corpse', ql: Math.max(1, Math.min(100, (15 + game.rand() * 35) * size)), dmg: 0, count: 1, extra: def.name });
    /*
     * And what it was keeping, which is the other half of where a map comes
     * from. Only a monster, and only to whoever struck it down: the odds and
     * the quality both come off its health, so a goblin carries a scrap and a
     * dragon carries a dragon's.
     */
    if (killer === 'player' && def.monster) mapFromBeast(game, def.health, x, y);
    if (quiet) return;
    if (killer === 'player') game.logMsg(`You kill the wild ${def.name.toLowerCase()}. Its corpse lies where it fell.`, 'fight');
    else if (t.mode === 'active' || t.mode === 'deed') game.logMsg(`${t.name} has died.`, 'fight');
    else if (killer && killer.mode !== 'wild') game.logMsg(`${killer.name} killed a wild ${def.name.toLowerCase()}.`, 'fight');
  }

  describe(c: Creature): string {
    const job = c.trade ?? this.species(c).gathers;
    const verb = job ? GATHER_VERB[job] : 'busy';
    if (c.ridden) return 'under the saddle';
    if (c.hitchedTo !== null) return 'in the traces';
    switch (c.mode) {
      case 'active':
        return `your companion · ${STANCE_NAMES[c.stance].toLowerCase()}`;
      case 'deed':
        if (c.carrying) return `deed worker · carrying ${itemDef(c.carrying.id).name.toLowerCase()}`;
        if (c.state === 'forage') return `deed worker · ${job === 'farm' && c.job ? `${c.job}ing a field` : verb}`;
        return 'deed worker';
      case 'stored':
        return 'in a creature crate';
      default:
        return c.state === 'forage' ? `wild · ${verb}` : c.state === 'flee' ? 'wild · fleeing' : 'wild';
    }
  }

  toJSON(): { nextId: number; list: CreatureJSON[]; banked?: Array<[number, number]> } {
    return {
      nextId: this.nextId,
      banked: [...this.banked.entries()],
      list: [...this.list.values()].map((c) => ({
        id: c.id,
        species: c.species,
        name: c.name,
        variant: c.variant,
        x: c.x,
        y: c.y,
        mode: c.mode,
        stance: c.stance,
        health: c.health,
        hunger: c.hunger,
        carrying: c.carrying,
        pouch: c.pouch,
        xp: c.xp,
        fleece: c.fleece,
        skills: c.skills,
        tacked: c.tacked,
        tack: c.tack,
        tackEnchant: c.tackEnchant,
        pannier: c.pannier,
        post: c.post,
        trapped: c.trapped,
        born: c.born,
        sex: c.sex,
        traits: c.traits,
        rare: c.rare,
        care: c.care,
        bredAt: c.bredAt,
        due: c.due,
        unborn: c.unborn,
        pedigree: c.pedigree,
        homeX: c.homeX,
        homeY: c.homeY,
        trade: c.trade,
        shodAt: c.shodAt,
      })),
    };
  }

  static fromJSON(data: { nextId: number; list: CreatureJSON[]; banked?: Array<[number, number]> } | undefined): Creatures {
    const cs = new Creatures();
    if (!data) return cs;
    cs.nextId = data.nextId ?? 1;
    for (const [r, n] of data.banked ?? []) cs.banked.set(r, n);
    for (const j of data.list ?? []) {
      const c = Creatures.make(j.id, j.species, j.x, j.y, j.mode, Math.random);
      Object.assign(c, { name: j.name, variant: j.variant, stance: j.stance, health: j.health, hunger: j.hunger, carrying: j.carrying ?? null, pouch: j.pouch ?? null, xp: j.xp ?? 0, fleece: j.fleece ?? 1, tacked: !!j.tacked, tack: j.tack, tackEnchant: j.tackEnchant, shodAt: j.shodAt ?? -1e9, pannier: j.pannier ?? [], post: j.post ?? null, trapped: j.trapped ?? null, born: j.born ?? 0, sex: j.sex ?? (j.id % 2 ? 'male' : 'female'), traits: j.traits ?? rollTraits(Math.random), rare: j.rare ?? 0, care: j.care ?? 0, bredAt: j.bredAt ?? -1e9, due: j.due ?? 0, unborn: j.unborn ?? null, pedigree: j.pedigree ?? null, homeX: j.homeX ?? j.x, homeY: j.homeY ?? j.y, trade: j.trade && (SPECIES[j.species]?.trades ?? []).includes(j.trade) ? j.trade : null, skills: { ...startSkills(SPECIES[j.species] ?? SPECIES.rabba), ...(j.skills ?? {}) } });
      cs.list.set(c.id, c);
      if (c.id >= cs.nextId) cs.nextId = c.id + 1;
    }
    return cs;
  }
}
