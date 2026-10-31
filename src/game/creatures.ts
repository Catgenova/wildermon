import { describeGoals } from './journal';
import { TileType, TILE_DEFS, TREE_DEFS, treeAge, treeSpecies, packTreeData, TREE_AGES } from '../world/tiles';
import { isSeam } from '../world/tiles';
import { mapFromBeast } from './treasure';
import { BOTANIZE_TABLE, FORAGE_TABLE, rollTable } from './forage';
import { fruitsAt, inSeason } from './fruiting';
import type { DeedStore, Game } from './game';
import { DAY_SECONDS } from './pace';
import { CROP_BY_SEED, cropDef, cropReady, cropYield, harvestSeeds } from './farming';
import { GLAZE_ASH, GLAZEABLE, MINE_COLLAPSE, MINE_DEPTH } from './actions';
import { groomGain, GROOM_HEAL } from './husbandry';
import { healAmount } from './firstaid';
import { BUTCHER_PARTS, butcherYield, corpseSpecies, HOARD_LUMPS, HOARD_METALS, HOARD_MORE } from './butcher';
import { RECIPE_BY_ID, RECIPES, type Recipe } from './recipes';
import { anvilCentre, type PlacedAnvil } from './anvil';
import { isOreItem, METAL_BY_ID, METAL_BY_LUMP, METAL_BY_ORE, METALS, MOULD_BY_ID, RARE_METALS, smeltSeconds } from './metal';
import { smelterCapacity, smelterCentre, type PlacedSmelter } from './smelter';
import { fireSeconds, firedQl, kilnCapacity, kilnCentre, POTTERY, POTTERY_BY_UNFIRED, isGreenware, type PlacedKiln } from './kiln';
import { BREWS, isWorking, type BrewDef } from './brewing';
import { fragmentOf, RELICS, RESTORE_AGE, type RelicDef } from './archaeology';
import { fitsDen, furnitureDef, furnitureRefuses, furnitureRoom, holdsLiquid, isPlanter, isWell, litresIn } from './furniture';
import { crateCentre } from './crates';
import { storeMarkable } from './stores';

import { milkLitres } from './dairy';
import { COMPANION_SIGHT as KEPT_SIGHT, NIGHT_LOSS as KEPT_NIGHT_LOSS, SHEAR_FEATHERS, SHEAR_FROM, SHEAR_WOOL } from './limits';
import { candleBurn } from './light';
import { isLampPiece } from './lamps';
import { GRAPE, grapesFor, isTrellis, vineStage } from './vineyard';
import { BUSH_DEFS, bushSpecies, FLOWERS_PICKED, mownDays, MOWN_TODAY } from '../world/tiles';
import { besideWater, CUT_GRASS, PAN_ORES, RESIN_TREE, RICH_WORMS, tappable, WORMY } from './actions';
import { flowersHere } from './wildflowers';
import { SKEP, SKEP_CLUMP_HOURS, SKEP_IDLE, SKEP_REACH, SKEP_WAX_EVERY, skepFlowers, VESP_REST, vespHoney, vespTrip } from './bees';
import { SEASON_DAYS, SHORT_SEASON_DAYS, seasonAt } from '../world/calendar';
import { greenNow, greenOnTile, scrubTile } from './greening';
import { GRASS_PER_CUT, MOSS_PER_CUT, QL_TOP } from './limits';
import { PIER_SHOO } from './piers';
import { bedrockAt, oreAt } from '../world/ore';
import { chartRegion } from '../world/chart';
import { lairOf, REGIONS } from '../world/regions';
import { DIGGABLE, findChance, relicsWithin } from './archaeology';
import { FISH, fishable, fishHere, waterDepth } from './fishing';
import { describeFrom, describeWith, itemDef, litresOf, markOf, TAN_LYE, RARITIES, rarityOf, rarityStep, rollRarity, type Item, type Mark } from './items';
import { drainVessel } from './placeables';
import { FROST_PACE, FROST_SECS, PAPER_PRESS, swingEnchant, type Enchant, type EnchantEffect } from './enchant';
import { CLASS_SPELL_BY_ID } from './talents';
import type { BeastAct } from './events';
import { article, capital, daySays, fill, listed, listedOr, percent, share, timeWords } from './words';
import { BASE_SPEED, groundStep, standsOn, SWIM_DEPTH } from './player';
import type { World } from '../world/world';
import { skillGain } from './skills';
import { DRIVING, DRIVING_LEARN } from './travel';
import { BARDING_CUT, gearGoneSays, gearOn, gearShare, HARNESS_PACE, PACK_LOADS, wearGear, type GearSlot } from './wildgear';
import { keyX, keyY, tileKey } from './tileindex';
import { ASH_QL, fireCentre, FIRE_CAPACITY, FUELS, FUEL_VALUES, isFuel } from './campfire';
import { BUCKET_LITRES, furnitureCentre, hearthCapacity, type PlacedFurniture } from './furniture';
import type { WoundKind } from './wounds';
import { WORKER_REST_FIRST } from './keep';
import { auraMul, BLOOD_CHANNELS, bredLine, breedTraits, channelOf, LAMP_TIER_ODDS, lineMul, lineSaid, mirrorTrait, mutationOf, pct, rollTraits, slotDraw, SLOTS_PER_STAGE, stageSlots, TIERS, traitList, traitMul, traitName, traitAdd, traitSays, traitOf, traitTier, TRAIT_SLOTS, type Line, type PairBlood, type TraitChannel, type TraitSource } from './traits';
import { ACTION_FLOOR, ACTION_PACE, WORKER_WEIGHT } from './pace';
import { world } from './pace';
import { emptyCrate, shutIn, standingCrate } from './creaturecrate';
import { IDLE_WANTS, IDLE_WHYS, ledgerAdd, ledgerRoll, type Idle, type IdleWhy, type WorkLedger } from './workerlog';
import { kindNames } from './journal-b';
import { workFromLedger, workTime, type WorkStats } from './workstats';
import { bredForm, formMul, wildFormRoll, type SizeForm } from './wildforms';
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
  /**
   * How deep its line ran on each channel when it was born, where that was past
   * one (`bredLine`); absent on one born before lines were kept, which stands at
   * one on every channel it carries a trait on.
   */
  line?: Line;
}

/** What is coming, settled at the covering so no sire need survive to the birth. */
export interface Unborn {
  traits: string[];
  sex: Sex;
  /** The sire and where each trait came from; a covering made before pedigrees were kept has neither. */
  sire?: Parent;
  from?: Record<string, TraitSource>;
  /** Its line, settled with its traits while both parents stood there (`bredLine`); none from a covering made before lines were kept. */
  line?: Line;
  /** Its forms, off its parents' (`bredForm`); none from a covering made before forms were kept, or with none. */
  formColour?: boolean;
  formSize?: SizeForm;
  /** A second young, bred at the same covering (a Herdsman's Twins): its own traits, sex and line, the same sire. */
  twin?: { traits: string[]; sex: Sex; from?: Record<string, TraitSource>; line?: Line; formColour?: boolean; formSize?: SizeForm };
}

/** What a card and a tooltip say of a pedigree: "Dam Snow · sire Horn". */
export const pedigreeLine = (p: Pedigree): string => `Dam ${p.dam.name} · sire ${p.sire.name}`;
/** And how deep its line runs, a line a channel it runs past one on: "Line: 4 generations bred for damage, +6% damage". */
export const lineLines = (c: Pick<Creature, 'traits' | 'pedigree'>): string[] => lineSaid(c.traits, c.pedigree?.line);

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
  // A snedda (a Saplingreach) prunes what would otherwise die; a grubba digs out stumps.
  | 'prune'
  | 'stump'
  // A plucka picks what a bearing tree has on it and carries it home.
  | 'fruit'
  // A vesp works a hive on the deed as bees work a skep: out to the wildflowers in reach of it and back with honey (`vespTrip`).
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
  // moss, and panning the sand at the water's edge, which no kind does since a siffa took to smithing ribbons.
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
  | 'fill'
  // And three more at your own: an ulva spins yarn at a spindle, a dowse smiths nails and a siffa metal ribbons at an anvil.
  | 'spin'
  | 'nail'
  | 'ribbon'
  // And a glimmip melts sand from the stores into glass lumps at a lit smelter of yours.
  | 'glass';
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
/** A worker's chance of something in the pan, at no skill and at a hundred: a Miner's who has learned to pan (`pan` perk) to twice it. */
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
/** What an ulva spins at a spindle of yours, in the order it tries them: the recipes your own hands spin at one. The island's `tend_recipes('spin')`. */
export const SPIN_RECIPES = ['spin_wool', 'spin_cotton', 'spin_wemp'];
/** What a glimmip makes at a lit smelter of yours: glass lumps, as your own hands melt them there. The island's `tend_recipes('glass')`. */
export const GLASS_RECIPES = ['make_glass'];
/** The furniture each trade worked off a recipe at a piece of yours works at: a papra's press and an ulva's spindle. The island's `station_target`. */
export const STATION_TRADES: Partial<Record<GatherKind, { piece: string; recipes: readonly string[] }>> = {
  paper: { piece: PAPER_PRESS, recipes: PAPER_RECIPES },
  spin: { piece: 'spindle', recipes: SPIN_RECIPES },
};
/**
 * What a dowse and a siffa smith at an anvil of yours: the piece a mould of yours casts (`MOULDS`), as many a lump as
 * one filling of it makes, out of a lump of one of these metals, tried in this order. No mould and no hammer: the lump
 * is beaten out at the anvil. A siffa leaves the rare metals alone, a filling of which takes `RARE_LUMP_FACTOR` lumps.
 * The island's `smith_trade`.
 */
export const SMITH_TRADES: Partial<Record<GatherKind, { mould: string; metals: readonly string[] }>> = {
  nail: { mould: 'nail_mould', metals: ['iron'] },
  ribbon: { mould: 'ribbon_mould', metals: METALS.filter((m) => !RARE_METALS.has(m.id)).map((m) => m.id) },
};
/** The piece a smithing trade makes, and how many a lump. */
export const smithMakes = (kind: GatherKind): string => MOULD_BY_ID.get(SMITH_TRADES[kind]!.mould)!.makes;
export const smithPer = (kind: GatherKind): number => MOULD_BY_ID.get(SMITH_TRADES[kind]!.mould)!.per ?? 1;
/** The lumps a smithing trade takes, by item id, in the order it takes them. */
export const smithLumps = (kind: GatherKind): string[] => (SMITH_TRADES[kind]?.metals ?? []).map((id) => METAL_BY_ID.get(id)!.lump);
/** A piece's name as more than one: "nails", "metal ribbons". */
const plural = (name: string): string => (name.endsWith('s') ? name : `${name}s`);
/** "smith iron lumps in your settlement stores into nails at your anvils, 5 a lump", and for metals but a few, the ones left alone. */
function smithSays(kind: GatherKind): string {
  const metals = SMITH_TRADES[kind]!.metals;
  const name = (id: string): string => METAL_BY_ID.get(id)!.name.toLowerCase();
  const left = METALS.filter((m) => !metals.includes(m.id)).map((m) => m.id);
  const which = metals.length <= left.length ? `${listedOr(metals.map(name))} lumps` : `metal lumps (not ${listedOr(left.map(name))})`;
  return `smith ${which} in your settlement stores into ${plural(itemDef(smithMakes(kind)).name.toLowerCase())} at your anvils, ${smithPer(kind)} a lump`;
}
/** What a Kilnlet loads: every piece of unfired clay a kiln fires (`POTTERY`), by name: "unfired clay bricks, …". */
const kilnLoads = (): string => listed(POTTERY.map((p) => plural(itemDef(p.unfired).name.toLowerCase())));
/** The fibres an ulva spins: "wool, cotton and wemp". */
const spinFibres = (): string => listed(SPIN_RECIPES.map((id) => itemDef(RECIPE_BY_ID.get(id)!.inputs[0].item).name.toLowerCase()));
/** What a spinning makes of what: "2 yarn per 2 fibres", once where every spinning recipe says the same. */
const spinSays = (): string => {
  const each = SPIN_RECIPES.map((id) => `${recipeMakes(id)} yarn per ${RECIPE_BY_ID.get(id)!.inputs[0].count ?? 1}`);
  return new Set(each).size === 1 ? `${each[0]} fibres` : listed(each.map((e, i) => `${e} ${itemDef(RECIPE_BY_ID.get(SPIN_RECIPES[i])!.inputs[0].item).name.toLowerCase()}`));
};
/** What a glimmip makes of what, off the recipe: "make glass lumps from sand in your settlement stores at your lit smelters, 2 per 3 sand". */
const glassSays = (): string => {
  const r = RECIPE_BY_ID.get(GLASS_RECIPES[0])!;
  const sand = itemDef(r.inputs[0].item).name.toLowerCase();
  return `make ${plural(itemDef(r.result).name.toLowerCase())} from ${sand} in your settlement stores at your lit smelters, ${recipeMakes(r.id)} per ${r.inputs[0].count ?? 1} ${sand}`;
};
/** How many a recipe makes, and how many of one of its inputs it takes: the numbers a trade's words give. */
const recipeMakes = (id: string): number => RECIPE_BY_ID.get(id)?.count ?? 1;
const recipeTakes = (id: string, item: string): number => RECIPE_BY_ID.get(id)?.inputs.find((i) => i.item === item)?.count ?? 1;
/** The litres of liquid a recipe takes, for saying so. */
const recipeLitres = (id: string): number => RECIPE_BY_ID.get(id)?.inputs.find((i) => i.litres)?.litres ?? 0;
/**
 * What a simma cooks, in the order it tries them: every recipe worked at a lit campfire or oven that no perk
 * gates, as the recipes are listed. The island's `tend_recipes('cook')` names the same.
 */
export const cookRecipes = (): string[] => RECIPES.filter((r) => r.station === 'campfire' && !r.perk).map((r) => r.id);
/** The tools these recipes want in your own hands, by name, once each: what a worker at them does without. */
const toolsOf = (ids: readonly string[]): string[] => [...new Set(ids.map((id) => RECIPE_BY_ID.get(id)?.tool).filter((t): t is string => !!t))].map((t) => itemDef(t).name.toLowerCase());
/** The bowls, pots, jars and pans the cooking recipes want in your own hands, which a simma does without: "clay bowl, frying pan, …". */
const cookTools = (): string[] => toolsOf(cookRecipes());
/** Every tool a recipe a worker works wants in your own hands, by name, once each: none of which a worker needs. */
export const workerSkipsTools = (): string[] =>
  toolsOf([...Object.values(STORE_RECIPES).flat(), ...cookRecipes(), ...Object.values(STATION_TRADES).flatMap((t) => t.recipes), ...LYE_RECIPES, ...GLASS_RECIPES]);
/** The trades that work at the stores or at one of your own rather than walking out to a tile, and bring nothing home in their arms. */
export const TEND_JOBS = new Set<GatherKind>(['groom', 'dairy', 'heal', 'butcher', 'tan', 'mill', 'lamp', 'smelt', 'kiln', 'ash', 'brew', 'cook', 'restore', 'patch', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'paper', 'glaze', 'fill', 'spin', 'nail', 'ribbon', 'glass']);
/** The recipe a cindra leaches its ashes into. */
export const LYE_RECIPES = ['make_lye'];
/** What restoring brings out of what the pieces were worth, at a restoration: a person's hands' (`restoredQl`), with no perk. The island's `errand_do`. */
export const restoredMul = (skill: number): number => 0.72 + skill / 260;
/** Tar a tap of a pine gives an ambra: one, where a Forester's Tap Resin gives its rank's worth. */
export const RESIN_TAPPED = 1;


/** The faces a quarry cuts: bare rock, and rock under snow (a mountain top's marble). The island's `worker_gatherable`. */
const STONE_FACES: ReadonlySet<number> = new Set([TileType.Rock, TileType.Snow]);
export const GATHER_SKILL: Record<GatherKind, string> = { forage: 'foraging', botanize: 'botanizing', woodcut: 'woodcutting', farm: 'farming', mine: 'mining', sand: 'digging', clay: 'digging', quarry: 'mining', stoke: 'smelting', fetch: 'foraging', guard: 'body_strength', hunt: 'fighting', peat: 'digging', reed: 'foraging', water: 'carrying', prospect: 'prospecting', plant: 'forestry', hod: 'masonry', mend: 'repair', compost: 'farming', seek: 'archaeology', fish: 'fishing', prune: 'forestry', stump: 'digging', fruit: 'forestry' , hive: 'animal_husbandry', groom: 'animal_husbandry', dairy: 'animal_husbandry', heal: 'first_aid', butcher: 'butchering', tan: 'leatherworking', mill: 'milling', lamp: 'carrying', bush: 'forestry', grass: 'foraging', pan: 'prospecting', smelt: 'smelting', kiln: 'pottery', ash: 'alchemy', brew: 'brewing', cook: 'cooking', restore: 'restoration', patch: 'farming', worm: 'digging', sprout: 'forestry', resin: 'forestry', flower: 'foraging', scrub: 'masonry', saw: 'carpentry', chisel: 'stonecutting', brick: 'pottery', rope: 'ropemaking', fletch: 'fletching', paper: 'papyrusmaking', glaze: 'pottery', fill: 'carrying', spin: 'tailoring', nail: 'blacksmithing', ribbon: 'blacksmithing', glass: 'glassblowing' };
export const GATHER_VERB: Record<GatherKind, string> = { forage: 'foraging', botanize: 'botanizing', woodcut: 'felling trees', farm: 'farming', mine: 'mining ore', sand: 'collecting sand', clay: 'collecting clay', quarry: 'cutting stone', stoke: 'stoking', fetch: 'fetching', guard: 'guarding', hunt: 'hunting', peat: 'collecting peat and tar', reed: 'cutting reeds', water: 'carrying water', prospect: 'prospecting', plant: 'planting', hod: 'hod carrying', mend: 'mending', compost: 'composting', seek: 'seeking relics', fish: 'fishing', prune: 'pruning', stump: 'digging out stumps', fruit: 'picking fruit' , hive: 'tending hives', groom: 'grooming', dairy: 'milking and shearing', heal: 'healing', butcher: 'butchering', tan: 'tanning hides', mill: 'milling', lamp: 'lamplighting', bush: 'picking bushes and vines', grass: 'cutting grass and moss', pan: 'panning', smelt: 'charging smelters', kiln: 'loading kilns', ash: 'raking ashes', brew: 'brewing', cook: 'cooking', restore: 'restoring', patch: 'tending planters', worm: 'digging worms', sprout: 'picking sprouts', resin: 'tapping pines', flower: 'picking wildflowers', scrub: 'scrubbing stone', saw: 'sawing planks', chisel: 'chiselling stone brick', brick: 'shaping clay brick', rope: 'making rope', fletch: 'fletching arrows', paper: 'pressing papyrus', glaze: 'glazing pottery', fill: 'filling buckets', spin: 'spinning yarn', nail: 'smithing nails', ribbon: 'smithing ribbons', glass: 'making glass lumps' };
/** The plain form, for "it will forage" rather than "it will foraging". */
export const GATHER_DO: Record<GatherKind, string> = { forage: 'forage', botanize: 'botanize', woodcut: 'fell trees', farm: 'sow, tend and harvest fields', mine: 'mine ore', sand: 'collect sand', clay: 'collect clay', quarry: 'cut stone', stoke: 'keep your campfires, ovens, braziers, smelters and kilns fuelled', fetch: 'pick up dropped items; sort raw and worked materials from your settlement stores into your raw and craft material bins', guard: 'guard the settlement', hunt: 'hunt round the settlement and bring carcasses home', peat: 'collect peat and tar', reed: 'cut reeds', water: 'carry water to your barrels from the shore or a well', prospect: 'prospect for metal and mark finds', plant: 'plant sprouts where trees were cut', hod: 'carry what planned building work wants from your settlement stores and fit it: walls and columns on their storey; floors, roofs, staircases and ladders from the storey under; bridge or aqueduct spans, foundations; storeys up by staircase, not ladder', mend: 'mend damaged gear in your settlement stores', compost: 'turn rotting items into compost', seek: 'find buried relics and mark dig sites', fish: 'fish round the settlement and bring the catch home', prune: 'prune dying wood', stump: 'dig out stumps', fruit: 'pick fruit trees' , hive: 'fill your hives with honey and beeswax', groom: `brush your wildermon under ${percent(CARE_WANTING)} care`, dairy: `milk your cudda into empty buckets in your settlement stores; shear or pluck your others at ${percent(DAIRY_FULL)} regrowth; output to your settlement stores`, heal: `dress your wildermon that are bleeding or under ${percent(HEAL_BELOW)} health, with a bandage or cover from your settlement stores`, butcher: 'butcher carcasses in your settlement stores; output to your settlement stores', tan: 'tan hides in your settlement stores with lye', mill: 'grind wheat and corn and press olives in your settlement stores', lamp: 'put candles from your settlement stores in your empty lantern posts and pillars; light them after dark, put them out by day', bush: 'pick bushes and trellis vines', grass: 'cut grass and moss', pan: 'pan sand at the water\'s edge', smelt: 'charge your smelters with ore from your settlement stores and empty them', get kiln() { return `load your kilns with ${kilnLoads()} from your settlement stores and empty them`; }, ash: 'rake ashes from your campfires, ovens, smelters and kilns into your settlement stores; leach ash and buckets of water from your settlement stores into lye', brew: 'start a brew in each idle water barrel of yours from makings in your settlement stores', cook: 'cook from your settlement stores at your lit campfires and ovens', restore: 'restore relics whose pieces are all in your settlement stores', patch: 'sow, tend and harvest your planters from your settlement stores', worm: 'dig worms', sprout: 'pick tree sprouts', resin: 'tap pines for tar, once a day each', flower: 'pick wildflowers, except those a skep or hive feeds on', scrub: 'scrub moss off your paving, foundations and statues and ivy off your stone walls',
  // Read when asked for rather than when this module loads, so the recipes and the glaze are there to be read.
  get saw() { return `saw logs in your settlement stores into planks, ${recipeMakes('make_planks')} a log`; },
  get chisel() { return `chisel rock shards in your settlement stores into stone brick, ${recipeMakes('make_stone_brick')} a shard`; },
  get brick() { return `shape clay in your settlement stores into unfired clay brick, ${recipeMakes('make_clay_brick')} a lump`; },
  get rope() { return `make rope from wemp in your settlement stores, ${recipeTakes('make_rope', 'wemp')} fibres a rope`; },
  get fletch() { return `fletch arrows from shafts, arrowheads and feathers in your settlement stores, ${recipeMakes('make_arrows')} a shaft, ${recipeTakes('make_arrows', 'arrow_head')} heads and ${recipeTakes('make_arrows', 'feather')} feathers`; },
  get paper() { return `press reeds in your settlement stores into papyrus at your paper presses, ${recipeMakes('make_papyrus')} sheets per ${recipeTakes('make_papyrus', 'reed')} reeds and ${recipeLitres('make_papyrus')} L water from your settlement stores`; },
  get glaze() { return `glaze fired pots, bowls, jars and amphorae in your settlement stores with ${GLAZE_ASH} ${GLAZE_ASH === 1 ? 'ash' : 'ashes'} each from your settlement stores; glazed pottery never decays`; },
  fill: 'fill empty buckets from your settlement stores with water at the shore or a well; output to your settlement stores',
  get spin() { return `spin ${spinFibres()} in your settlement stores into yarn at your spindles, ${spinSays()}; output to your settlement stores`; },
  get nail() { return `${smithSays('nail')}; output to your settlement stores`; },
  get ribbon() { return `${smithSays('ribbon')}; output to your settlement stores`; },
  get glass() { return `${glassSays()}; output to your settlement stores`; },
};
const GATHER_TABLE: Record<GatherKind, Array<[string, number]>> = { forage: FORAGE_TABLE, botanize: BOTANIZE_TABLE, woodcut: [], farm: [], mine: [], sand: [], clay: [], quarry: [], stoke: [], fetch: [], guard: [], hunt: [], peat: [], reed: [], water: [], prospect: [], plant: [], hod: [], mend: [], compost: [], seek: [], fish: [], prune: [], stump: [], fruit: [] , hive: [], groom: [], dairy: [], heal: [], butcher: [], tan: [], mill: [], lamp: [], bush: [], grass: [], pan: [], smelt: [], kiln: [], ash: [], brew: [], cook: [], restore: [], patch: [], worm: [], sprout: [], resin: [], flower: [], scrub: [], saw: [], chisel: [], brick: [], rope: [], fletch: [], paper: [], glaze: [], fill: [], spin: [], nail: [], ribbon: [], glass: [] };
export type ButcherPart = 'meat' | 'fur' | 'leather' | 'bone' | 'gland' | 'feather' | 'clay' | 'tusk' | 'sinew' | 'scale' | 'hoard';
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
  defensive: 'Attacks what attacks it or you.',
  aggressive: `Attacks wildermon within ${COMPANION_SIGHT} tiles of you.`,
  guard: `Attacks what hunts you within ${COMPANION_SIGHT} tiles before it strikes, and what attacks it or you. Breaks off ${GUARD_RANGE} tiles from you (other stances: ${COMPANION_LEASH}).`,
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
   * knows decides how fast a vehicle goes and how steep a line it can take --
   * or, for a kind that learns its own skill by pulling (`learns.by` 'pull'),
   * that skill in climbing's place (`tracesSkill`).
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
  /**
   * Its pace in water (`waterOver`), for a kind bred for it: in water a rider gets `Game.mountSpeed`'s rule on this in
   * place of `speed`, and on land its `speed` flat (`landRidden`). The island's `species_def.swim_speed`.
   */
  swimSpeed?: number;
  /** Only put down wild in deep water (`deepWater`), and keeps to it in the wild. The island's `species_def.deep_water`. */
  deepWater?: boolean;
  /** Its share of a team's pull; `PULL_DEFAULT` unless it was bred for the traces. */
  pull?: number;
  /** Things it carries on its own back, for the ones that take panniers. */
  pannier?: number;
  /** What shearing takes off it; wool unless it says otherwise. */
  shearYield?: string;
  /** Can be milked into an empty bucket. */
  milk?: boolean;
  /** Works hives: its trade fills them with honey off the wildflowers in reach (`vespTrip`). */
  hives?: boolean;
  /** Only ever found out of doors after dark. */
  nocturnal?: boolean;
  /**
   * Only put down wild on these days of the year (`WildSeason`), and gone from the wild on every other: one tamed,
   * kept, bred or penned stays all year.
   */
  season?: WildSeason;
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
  /**
   * For a kind with no trade, the skill it learns and what teaches it (`LearnsBy`). A draught beast that learns by
   * pulling keeps this skill in the traces where another keeps climbing (`tracesSkill`).
   */
  learns?: { skill: string; by: LearnsBy };
  /** What it evolves into at each of `EVOLVE_AT`, for a kind that evolves: a name and words of each stage's own. */
  stages?: [StageDef, StageDef];
  /** What the kind used to be called, which a carcass or a crate from before can still say. */
  was?: readonly string[];
}

/**
 * The days of the year a kind is put down wild on, by the calendar in UTC, from and to and both of them in: each a
 * [month, day], the month counted from one. One that runs past the new year (from later in the year than to) runs from
 * its first day to the year's end and from the year's start to its last. The island's `season_holds`, which has each
 * as `month * 100 + day` (`species_def.season_from`, `season_to`).
 */
export interface WildSeason {
  from: readonly [number, number];
  to: readonly [number, number];
}
/** The Whispet's: asked for, "only available October 15-november 15". */
export const HALLOW_SEASON: WildSeason = { from: [10, 15], to: [11, 15] };
/** A day of the year as the island keeps it: `month * 100 + day`. */
export const seasonDay = ([month, day]: readonly [number, number]): number => month * 100 + day;
/** Whether a season holds at a moment, in epoch seconds: the day it falls on in UTC is one of its days. */
export function seasonHolds(s: WildSeason, now: number): boolean {
  const d = new Date(now * 1000);
  const day = (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  const from = seasonDay(s.from);
  const to = seasonDay(s.to);
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}
/** Whether a kind may be put down wild, or stay wild, at a moment (epoch seconds): always, but for a kind with a season. */
export const wildInSeason = (def: SpeciesDef, now: number): boolean => !def.season || seasonHolds(def.season, now);
/** A season's days, in words: "15 October to 15 November". */
export const seasonSays = (s: WildSeason): string => `${daySays(s.from)} to ${daySays(s.to)}`;

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
/** How much quicker each stage is at its task, and at growing back its fleece, than the one before. */
const STAGE_QUICKER = 1.15;
/**
 * What each stage multiplies over the one before, on the channels its blood is counted on (`bloodMul`): its health
 * (hardy), its blow (tough), its pace (speed), how fast it gets a task done (work), and how fast its fleece grows back
 * (grow; asked for: "Yes, faster regrowth"). The island's `evo_mul`.
 */
export const STAGE_MUL: Partial<Record<TraitChannel, number>> = { hardy: 1.2, tough: 1.2, speed: 1.2, work: STAGE_QUICKER, grow: STAGE_QUICKER };
/** Which stage it is at: nought below the first of `EVOLVE_AT`, and so on; nought always for a kind that does not evolve. The island's `stage_of`. */
export function stageOf(c: Pick<Creature, 'species' | 'skills'>): 0 | 1 | 2 {
  if (!SPECIES[c.species]?.stages) return 0;
  const level = creatureLevel(c);
  return level >= EVOLVE_AT[1] ? 2 : level >= EVOLVE_AT[0] ? 1 : 0;
}
/** What its stage makes of one channel of its blood. */
export const evoMul = (c: Pick<Creature, 'species' | 'skills'>, channel: TraitChannel): number =>
  (STAGE_MUL[channel] ?? 1) ** stageOf(c) * perkBlood(c, channel);
/**
 * What each stage lets a deed worker do at once, by the stage it is at (`stageOf`): a trade that carries a load
 * between where it gets it and where it goes carries this many loads a trip, and a trade worked in place on things in
 * your stores handles this many of them a go, where there are that many to do (`LOAD_TRADES`, `HANDS_TRADES`). Asked
 * for: "Each stage unlocks something, not just bigger numbers", "a stage-2 worker carries 2 loads a trip, a stage-3
 * worker 3", and "a stage-2 worker handles 2 targets per go". A go still teaches what one go teaches: a load more in
 * its arms or a thing more in its hands is no more gain. The island's `stage_loads`.
 */
export const STAGE_LOADS = [1, 2, 3] as const;
/**
 * How many loads a trip, or things a go, it takes at the stage it is at, with its line's own third-stage loads
 * (`perkN`) and a pack on it on a trade that carries loads (`packLoads`).
 */
export const stageLoads = (c: Pick<Creature, 'species' | 'skills'> & Partial<Pick<Creature, 'gear' | 'trade' | 'traits'>>): number =>
  STAGE_LOADS[stageOf(c)] + perkN(c, 'loads') + packLoads(c)
  // And its blood's loads a trip (`deep-pocketed`).
  + traitAdd(c.traits, 'loads');

/*
 * A skill of each line's own at its third stage. Asked for: "every evolving line gains one perk of its own at its
 * third stage ... concrete and modest, with a number". One to a line (`STAGE_PERKS`, by its kind), from the stage at
 * `PERK_STAGE` on, over what every stage gives (`STAGE_MUL`, `STAGE_LOADS`):
 *
 *   more   +n to what one action of its trade brings in, a worker's gather (`perkMore`)
 *   loads  +n loads a trip or things a cycle (`stageLoads`)
 *   rest   its ability's cooldown −n (`abilityRestOf`)
 *   stun   its stun n seconds longer (`styleBlow`)
 *   wool   +n wool a shearing, by you or a worker
 *   blood  one channel of its blood ×n (`evoMul`)
 *
 * The island's `species_def.perk`, `perk_n` and `perk_channel`, read by `perk_n(c, kind)` and `evo_mul`.
 */
export type PerkKind = 'more' | 'loads' | 'rest' | 'stun' | 'wool' | 'blood';
export interface StagePerk {
  kind: PerkKind;
  n: number;
  /** The channel a `blood` one is on. */
  channel?: TraitChannel;
  /** What it is more of, as a label: "reeds per cut", "blow". */
  what?: string;
}
/** The stage (`stageOf`) a line's own skill comes in at: its third. */
export const PERK_STAGE = 2;
export const STAGE_PERKS: Record<string, StagePerk> = {
  rabba: { kind: 'more', n: 1, what: 'finds per forage' },
  vola: { kind: 'more', n: 1, what: 'finds per botanize' },
  bevere: { kind: 'more', n: 1, what: 'logs per tree felled' },
  crawler: { kind: 'more', n: 1, what: 'sand per dig' },
  noot: { kind: 'more', n: 1, what: 'clay per dig' },
  quarra: { kind: 'more', n: 1, what: 'stone per cut' },
  mola: { kind: 'more', n: 1, what: 'ore per action' },
  seavic: { kind: 'more', n: 1, what: 'produce per harvest' },
  bogga: { kind: 'more', n: 1, what: 'peat or tar per cut' },
  sedra: { kind: 'more', n: 1, what: 'reeds per cut' },
  sprigga: { kind: 'more', n: 1, what: 'sprouts per pick' },
  embra: { kind: 'loads', n: 1, what: 'fuel per trip' },
  holla: { kind: 'loads', n: 1, what: 'buckets of water per trip' },
  sappa: { kind: 'loads', n: 1, what: 'sprouts per trip' },
  cobbe: { kind: 'loads', n: 1, what: 'pieces per trip' },
  tinka: { kind: 'loads', n: 1, what: 'items mended per cycle' },
  wicka: { kind: 'loads', n: 1, what: 'candles per trip' },
  woola: { kind: 'wool', n: 1, what: 'wool per shearing' },
  orse: { kind: 'blood', n: 1.05, channel: 'speed', what: 'speed' },
  springlet: { kind: 'blood', n: 1.05, channel: 'speed', what: 'speed' },
  roxxen: { kind: 'blood', n: 1.1, channel: 'haul', what: 'hauling' },
  rowl: { kind: 'blood', n: 1.1, channel: 'tough', what: 'blow' },
  warda: { kind: 'blood', n: 1.1, channel: 'sight', what: 'sight' },
  snout: { kind: 'blood', n: 1.2, channel: 'range', what: 'work range' },
  thumpa: { kind: 'stun', n: 1 },
  lungra: { kind: 'rest', n: 0.2 },
  stona: { kind: 'rest', n: 0.2 },
  whispet: { kind: 'rest', n: 0.2 },
  magga: { kind: 'loads', n: 1, what: 'items per trip' },
  grazza: { kind: 'more', n: 1, what: 'grass or moss per cut' },
  grubba: { kind: 'blood', n: 1.2, channel: 'range', what: 'work range' },
  wurla: { kind: 'more', n: 1, what: 'worms per dig' },
  mudda: { kind: 'loads', n: 1, what: 'bricks per cycle' },
  dippa: { kind: 'loads', n: 1, what: 'buckets per trip' },
  middun: { kind: 'loads', n: 1, what: 'items per trip' },
  sparra: { kind: 'blood', n: 1.1, channel: 'tough', what: 'blow' },
  plucka: { kind: 'more', n: 1, what: 'fruit per pick' },
  grista: { kind: 'loads', n: 1, what: 'batches per cycle' },
  relka: { kind: 'loads', n: 1, what: 'relics per cycle' },
  wadd: { kind: 'more', n: 1, what: 'fish per catch' },
  dowse: { kind: 'loads', n: 1, what: 'lumps per cycle' },
  bedda: { kind: 'loads', n: 1, what: 'seed per trip' },
  vesp: { kind: 'blood', n: 1.2, channel: 'range', what: 'work range' },
  siffa: { kind: 'loads', n: 1, what: 'lumps per cycle' },
  ambra: { kind: 'more', n: 1, what: 'tar per pine' },
  ulva: { kind: 'loads', n: 1, what: 'batches per cycle' },
  petta: { kind: 'more', n: 1, what: 'flowers per pick' },
  potta: { kind: 'blood', n: 1.2, channel: 'range', what: 'work range' },
  rippa: { kind: 'blood', n: 1.2, channel: 'range', what: 'work range' },
  papra: { kind: 'blood', n: 1.2, channel: 'range', what: 'work range' },
  glimmip: { kind: 'more', n: 1, what: 'glass lumps per batch' },
  kemma: { kind: 'loads', n: 1, what: 'wildermon brushed per cycle' },
  snedda: { kind: 'blood', n: 1.2, channel: 'range', what: 'work range' },
  sheela: { kind: 'blood', n: 1.2, channel: 'range', what: 'work range' },
  tanna: { kind: 'loads', n: 1, what: 'hides per cycle' },
};
/** Its line's own skill, once it is at `PERK_STAGE`; null below it, and for a kind that has none. */
export const stagePerk = (c: Pick<Creature, 'species' | 'skills'>): StagePerk | null =>
  (stageOf(c) >= PERK_STAGE ? STAGE_PERKS[c.species] ?? null : null);
/** What its line's skill of a kind comes to now: its number at `PERK_STAGE` and over, nought below it or of another kind. */
export function perkN(c: Pick<Creature, 'species' | 'skills'>, kind: Exclude<PerkKind, 'blood'>): number {
  const p = stagePerk(c);
  return p && p.kind === kind ? p.n : 0;
}
/** What its line's skill makes of one channel of its blood: its `blood` one's number, or one. */
export function perkBlood(c: Pick<Creature, 'species' | 'skills'>, channel: TraitChannel): number {
  const p = stagePerk(c);
  return p && p.kind === 'blood' && p.channel === channel ? p.n : 1;
}
/** One action's gather, with its line's `more` on it, but for seed carried off a field: the island's `perk_more`. */
export function perkMore<T extends { id: string; count: number }>(c: Pick<Creature, 'species' | 'skills'>, got: T | null): T | null {
  const n = perkN(c, 'more');
  if (got && n > 0 && !CROP_BY_SEED.has(got.id)) got.count += n;
  return got;
}
/** A line's own skill, in words, for its stage's words, its card and the Field guide: "reeds per cut +1". */
export function perkSays(species: string): string {
  const p = STAGE_PERKS[species];
  const def = SPECIES[species];
  if (!p || !def) return '';
  if (p.kind === 'blood') return `${p.what ?? channelOf(p.channel!)?.label ?? p.channel} +${percent(p.n - 1)}`;
  if (p.kind === 'rest') {
    const id = def.ability!;
    return `${abilityName(id)} cooldown −${percent(p.n)} (${abilityRest(id)} to ${+(abilityRest(id) * (1 - p.n)).toFixed(1)} seconds)`;
  }
  if (p.kind === 'stun') return `stun +${p.n} ${p.n === 1 ? 'second' : 'seconds'} (${STUN_SECS} to ${STUN_SECS + p.n})`;
  return `${p.what} +${p.n}`;
}
/** Its line's skill as a label with the stage it comes in at: "Stage 3 skill: reeds per cut +1". */
export const perkLine = (species: string): string => (STAGE_PERKS[species] ? `Stage ${PERK_STAGE + 1} skill: ${perkSays(species)}` : '');

/**
 * A trait for each slot its stages from `from` to `to` open (`stageSlots`), each drawn by `slotDraw`, up to the slots it
 * has at `to`: one that evolves gains one trait a stage, and one put out in the wild at a later stage has that stage's.
 * Where each came from goes into its pedigree, on one that has one. The island's `open_slots`.
 */
export function openSlots(c: Pick<Creature, 'traits' | 'pedigree'>, from: number, to: number, husbandry: number, rand: () => number): void {
  for (let n = 0; n < (to - from) * SLOTS_PER_STAGE && c.traits.length < stageSlots(to); n++) {
    const got = slotDraw(c.traits, husbandry, rand);
    if (!got) return;
    c.traits = [...c.traits, got.id];
    if (c.pedigree) c.pedigree.from = { ...c.pedigree.from, [got.id]: got.from };
  }
}
/**
 * A wildermon pack's loads a trip (`PACK_LOADS`, `wildgear.ts`), for a trade that carries loads (`LOAD_TRADES`) and a
 * pack of its size. The island's `pack_loads_of`, in `stage_loads`.
 */
export function packLoads(c: Pick<Creature, 'species' | 'skills'> & Partial<Pick<Creature, 'gear' | 'trade'>>): number {
  if (!c.gear?.pack) return 0;
  const kind = c.trade ?? SPECIES[c.species]?.gathers;
  return kind && LOAD_TRADES.has(kind) && gearOn(c, 'pack', denClass(c)) ? PACK_LOADS : 0;
}
/** The loads in its arms: the one it is carrying and the ones gathered before it this trip (`Creature.laden`). */
export const loadsIn = (c: Pick<Creature, 'carrying' | 'laden'>): number => (c.carrying ? 1 : 0) + (c.laden?.length ?? 0);

/*
 * Rest. Asked for: "Workers tire after N goes and rest for a short while. A bed or pen on the deed shortens the rest",
 * and of the wildermon beds, "wildermon can only use [the bed] equivalent to their evolution stage". A deed worker
 * spends a `TIRE_GOES`th of its stamina a go -- a go being what one gain is, so a stage's extra loads and handlings
 * (`STAGE_LOADS`) cost it nothing more -- and with none left, once its arms are empty (or between the steps of an
 * errand), it rests `REST_FOR` and comes back to it full. With a bed of its own size free on its settlement
 * (`denClass`, `FurnitureDef.den`), it walks to the nearest and sleeps in it (`PlacedFurniture.sleeper`) for
 * `BED_REST` of that. The island's `tire_goes`, `rest_for`, `bed_rest`, `den_class` and `worker_settle`.
 */
export const TIRE_GOES = 30;
/** How long a worker with no stamina left rests, in seconds. */
export const REST_FOR = 4 * 60;
/** What a bed of its size on its settlement makes of that rest. */
export const BED_REST = 0.5;
/** How long it rests, in a bed or not; one of yours as long as its blood makes it (`rest`). The island's `rest_of`. */
export const restFor = (inBed: boolean, c?: Creature): number => REST_FOR * (inBed ? BED_REST : 1) * (c ? bloodMul(c, 'rest') : 1);
/**
 * Its goes before it tires: `TIRE_GOES` as its blood makes it (`stamina`), to the nearest whole go, read to four places
 * first so that the island's figures, kept as `real`, round the same way. The island's `tire_of`.
 */
export const tireOf = (c: Creature): number => Math.round(Math.round(TIRE_GOES * bloodMul(c, 'stamina') * 1e4) / 1e4);
/** Its goes and its rest, as its blood makes them where there is a beast to read them off, and the rule's without. */
const tireOrRule = (c: Creature | Pick<Creature, 'worn'>): number => ('traits' in c ? tireOf(c) : TIRE_GOES);
const restOrRule = (c: Creature | Pick<Creature, 'worn'>, inBed: boolean): number => ('traits' in c ? restFor(inBed, c) : restFor(inBed));
/** Its stamina, a share of full: what is left of its goes (`tireOf`) since it last rested (`Creature.worn`). */
export const staminaOf = (c: Creature | Pick<Creature, 'worn'>): number => Math.max(0, 1 - (c.worn ?? 0) / tireOrRule(c));
/**
 * The base health under which a kind that does not evolve sleeps in a small bed, and then in a medium one; at the
 * second and over, a large one. One that evolves sleeps in the bed of its stage. The island's `den_health_1` and
 * `den_health_2`.
 */
export const DEN_HEALTH = [25, 40] as const;
/**
 * The bed it fits, by `FurnitureDef.den`: for a kind that evolves the stage it is at (`stageOf`), and for one that does
 * not the band its kind's base health is in (`DEN_HEALTH`). It sleeps in a bed of exactly this and no other. The
 * island's `den_class`.
 */
export function denClass(c: Pick<Creature, 'species' | 'skills'>): 0 | 1 | 2 {
  const def = SPECIES[c.species];
  if (def?.stages) return stageOf(c);
  const health = def?.health ?? 0;
  return health < DEN_HEALTH[0] ? 0 : health < DEN_HEALTH[1] ? 1 : 2;
}

/*
 * Upkeep. Asked for: "Each worker eats from deed stores once per island day. An unfed one works at -50% and shows it
 * on its card, so food production matters." A deed worker eats out of the stores on its settlement whenever it is
 * hungry, as ever (`GRAZE_HUNGRY`, `HUNGRY`); the time it has worked since its last meal is kept (`Creature.unfed`),
 * and once that is `UPKEEP_FOR` it takes its task at `UNFED_PACE` of its pace until it next eats. The island's
 * `upkeep_for`, `unfed_pace` and `creature.unfed`.
 */
export const UPKEEP_FOR = DAY_SECONDS;
export const UNFED_PACE = 0.5;
/** Whether it has gone `UPKEEP_FOR` at work without a meal. */
export const unfedNow = (c: Pick<Creature, 'unfed'>): boolean => (c.unfed ?? 0) >= UPKEEP_FOR;

/*
 * Specialties. Asked for: "Three or more workers of one trade on a deed unlock a +10% bonus for that trade." With
 * `SPECIALTY_AT` or more deed workers of a trade on a settlement, every one of them takes its task in `1 +
 * SPECIALTY_BONUS` less time, where its stage and its blood already speed it (`STAGE_MUL.work`). The island's
 * `specialty_at`, `specialty_bonus` and `deed_trade_workers`.
 */
export const SPECIALTY_AT = 3;
export const SPECIALTY_BONUS = 0.1;
/** What so many workers of a trade on a settlement make of each one's pace at it. */
export const specialtyMul = (n: number): number => (n >= SPECIALTY_AT ? 1 + SPECIALTY_BONUS : 1);
/** Whether a trade is one a specialty speeds: one with a go to take less time over, which a watch and a hunt have not. */
export const specialtyTrade = (kind: GatherKind | null | undefined): kind is GatherKind => !!kind && kind !== 'guard' && kind !== 'hunt';
/** Its stamina, for its card: "Stamina: 21 of 30 goes left before it rests." */
export const staminaSays = (c: Creature | Pick<Creature, 'worn'>): string =>
  `Stamina: ${Math.max(0, tireOrRule(c) - (c.worn ?? 0))}/${tireOrRule(c)} cycles. Rest: ${timeWords(restOrRule(c, false))}, ${timeWords(restOrRule(c, true))} in a bed of its size on the settlement.`;
/** For its card, once it has gone `UPKEEP_FOR` without a meal: "Unfed for 1 hour and 12 minutes: works at 50% until it eats." */
export function unfedSays(c: Pick<Creature, 'unfed' | 'species'>): string {
  if (!unfedNow(c)) return '';
  const def = SPECIES[c.species];
  return `Unfed for ${timeWords(c.unfed ?? 0)}: work pace ${percent(UNFED_PACE)} until fed. No food it eats in your settlement stores${def ? ` (${def.baitHint})` : ''}.`;
}
/** A trade's specialty on a settlement, for a card and the settlement window: "Specialty: cutting reeds, 4 workers: +10% speed at its task." */
export function specialtySays(kind: GatherKind, n: number): string {
  if (n >= SPECIALTY_AT) return `Specialty: ${GATHER_VERB[kind]}, ${n} workers: task speed +${percent(SPECIALTY_BONUS)}.`;
  return `${capital(GATHER_VERB[kind])}: ${n}/${SPECIALTY_AT} workers for a specialty (task speed +${percent(SPECIALTY_BONUS)}).`;
}
// What a wildermon bed does and for whom (`den` in `furniture.ts`), off the stages, the health bands and the rest.
describeWith({
  den: {
    first: EVOLVE_AT[0], secondLast: EVOLVE_AT[1] - 1, second: EVOLVE_AT[1], small: DEN_HEALTH[0], large: DEN_HEALTH[1],
    tire: TIRE_GOES, share: share(BED_REST), bed: timeWords(restFor(true)), rest: timeWords(restFor(false)),
  },
});
/**
 * The trades that carry a load between where they get it and where it goes, and so carry their stage's loads a trip
 * (`STAGE_LOADS`): every trade that walks out to the ground and brings a load home, which with room in its arms for
 * another walks on to the next tile rather than home -- where a trade already brings several a go, its trip is that
 * many goes' worth, not more a go -- and the errands that carry: water, a hod's pieces as many as the work wants,
 * fuel as much as the hearth takes, sprouts, candles, seed and empty buckets. The island's `load_trade`.
 */
export const LOAD_TRADES: ReadonlySet<GatherKind> = new Set<GatherKind>([
  'forage', 'botanize', 'woodcut', 'farm', 'mine', 'sand', 'clay', 'quarry', 'fetch', 'peat', 'reed', 'fish', 'seek', 'fruit',
  'bush', 'grass', 'pan', 'worm', 'sprout', 'resin', 'flower', 'compost',
  'water', 'hod', 'stoke', 'plant', 'lamp', 'patch', 'fill',
]);
/**
 * The trades worked in place on things in your stores, or on your wildermon round about, that handle their stage's
 * number a go (`STAGE_LOADS`), where there are that many to do: the mender the most damaged things in the stores, the
 * trades at the stores and at a fire or a press that many batches, the butcher that many carcasses at the store, the
 * restorer that many relics, the glazer that many pieces, the ash-raker that many of a hearth raked and lye leached;
 * and the brusher, the milker and shearer and the dresser of hurts that many of yours within `TEND_REACH` of the one it
 * went to, with a bucket or a dressing for each out of what it fetched. The island's `hands_trade`.
 *
 * Left as they were, as no step of theirs is something a stage could do more of at once: a keeping watch and a hunt,
 * which carry nothing but a carcass on a walk of its own; pruning, digging out stumps and scrubbing, which bring
 * nothing home; a Vesp's trip, one flower and back to its hive; reading the ground, which carries nothing and reads
 * where it stands; charging a smelter or a kiln, whose every go already moves a whole stack, as much as the furnace
 * has room for; and brewing, where each barrel is a walk of its own.
 */
export const HANDS_TRADES: ReadonlySet<GatherKind> = new Set<GatherKind>([
  'mend', 'butcher', 'restore', 'glaze', 'tan', 'mill', 'saw', 'chisel', 'brick', 'rope', 'fletch', 'cook', 'paper', 'ash',
  'groom', 'dairy', 'heal', 'spin', 'nail', 'ribbon', 'glass',
]);
/** How far from it the others a herd trade sees to in the same go may stand, in tiles: the island's `errand_do` reads 3. */
export const TEND_REACH = 3;
/** What a stage lets a trade do at once, as a verb and the rest, for its stages' words (`lineSays`): "carries", "2 loads home a trip". */
const STAGE_WORK: Partial<Record<GatherKind, [verb: string, rest: (n: number) => string]>> = {
  water: ['carries', (n) => `${n} ${n === 1 ? 'bucket' : 'buckets'} of water a trip (${n * BUCKET_LITRES} litres)`],
  hod: ['carries', (n) => `up to ${n} ${n === 1 ? 'piece' : 'pieces'} a trip, up to what the work still wants, fitted at once`],
  stoke: ['carries', (n) => `up to ${n} ${n === 1 ? 'piece' : 'pieces'} of fuel a trip, up to the hearth's room, fed at once`],
  plant: ['carries', (n) => `${n} ${n === 1 ? 'sprout' : 'sprouts'} a trip`],
  lamp: ['carries', (n) => `${n} ${n === 1 ? 'candle' : 'candles'} a trip`],
  patch: ['carries', (n) => `${n} ${n === 1 ? 'seed' : 'seeds'} a trip`],
  fill: ['fills', (n) => `${n} ${n === 1 ? 'bucket' : 'buckets'} a trip`],
  mend: ['mends', (n) => `the ${n} most damaged ${n === 1 ? 'item' : 'items'} in your settlement stores a cycle`],
  butcher: ['butchers', (n) => `${n} ${n === 1 ? 'carcass' : 'carcasses'} a cycle`],
  restore: ['restores', (n) => `${n} ${n === 1 ? 'relic' : 'relics'} a cycle`],
  glaze: ['glazes', (n) => `${n} ${n === 1 ? 'piece' : 'pieces'} a cycle`],
  ash: ['does', (n) => `${n} ${n === 1 ? 'action' : 'actions'} a cycle (a hearth raked out or a batch of lye)`],
  groom: ['brushes', (n) => `up to ${n} of your wildermon within ${TEND_REACH} tiles a cycle`],
  dairy: ['milks or shears', (n) => `up to ${n} of your wildermon within ${TEND_REACH} tiles a cycle, a bucket from the settlement stores per milking`],
  heal: ['dresses', (n) => `up to ${n} of your wildermon within ${TEND_REACH} tiles a cycle, a dressing from the settlement stores each`],
};
/**
 * What its stage lets a trade do at once, in words, for a stage's words: "carries 2 loads home a trip". Null for a
 * trade a stage lets do no more at once.
 */
export function stageWorkSays(kind: GatherKind | null | undefined, n: number): [verb: string, rest: string] | null {
  if (!kind) return null;
  const own = STAGE_WORK[kind];
  if (own) return [own[0], own[1](n)];
  if (STORE_RECIPES[kind] || kind === 'cook' || kind === 'glass' || STATION_TRADES[kind]) return ['works', `${n} ${n === 1 ? 'batch' : 'batches'} a cycle, while the settlement stores hold the makings`];
  if (SMITH_TRADES[kind]) return ['smiths', `${n} ${n === 1 ? 'lump' : 'lumps'} a cycle, while the settlement stores hold them`];
  if (LOAD_TRADES.has(kind)) return ['carries', `${n} ${n === 1 ? 'load' : 'loads'} a trip`];
  return null;
}
/** Everything in its arms, and its arms emptied: what it puts down when it stops working, the loads of a trip and all. */
export function takeArms(c: Pick<Creature, 'carrying' | 'laden' | 'homeward'>): Item[] {
  const all = [...(c.carrying ? [c.carrying] : []), ...(c.laden ?? [])];
  c.carrying = null;
  c.laden = undefined;
  c.homeward = false;
  return all;
}
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
 * Evolved in the wild, rarely. Asked for: "When a wild one of an evolving kind is spawned, one time in 20 it comes in at
 * stage 2 ... and one time in 200 at stage 3". One put out in the country (`standWild`, the island's `wild_stage_put`)
 * of a kind that evolves comes in at its second stage one time in the first of these and at its third one time in the
 * second, and at its first otherwise. The island's `wild_stage_odds_1` and `wild_stage_odds_2`.
 */
export const WILD_STAGE_ODDS = [20, 200] as const;
/** The taming one asks for each stage it is past its first. The island's `wild_stage_tame`. */
export const WILD_STAGE_TAME = 15;
/** What each stage it is past its first multiplies its kind's base chance an offering by. The island's `wild_stage_chance`. */
export const WILD_STAGE_CHANCE = 0.5;
/**
 * The stage one put out in the wild comes in at, off one roll: its third for a roll under one in the second of
 * `WILD_STAGE_ODDS`, its second for one under that and one in the first, so each comes up exactly as often as it says;
 * always its first for a kind that does not evolve. The island's `wild_stage_roll`.
 */
export function wildStageRoll(def: SpeciesDef, roll: number): 0 | 1 | 2 {
  if (!def.stages) return 0;
  const third = 1 / WILD_STAGE_ODDS[1];
  return roll < third ? 2 : roll < third + 1 / WILD_STAGE_ODDS[0] ? 1 : 0;
}
/** How many levels past where the third stage begins one put out in the wild at it may be: asked for, "[EVOLVE_AT[1], EVOLVE_AT[1]+10)". The island's `wild_stage_span`. */
export const WILD_STAGE_SPAN = 10;
/** The levels one put out in the wild at a stage may be at, the first of them in and the last out: the whole of its second stage, and the first `WILD_STAGE_SPAN` of its third. The island's `wild_stage_levels`. */
export const stageLevels = (stage: 1 | 2): readonly [number, number] =>
  (stage === 1 ? [EVOLVE_AT[0], EVOLVE_AT[1]] : [EVOLVE_AT[1], EVOLVE_AT[1] + WILD_STAGE_SPAN]);
/**
 * The skill a kind's level is (`creatureLevel`): its trade's, or its own for one with none, or what a draught beast
 * keeps in the traces, or the climbing a mount learns under a rider. The island's `level_skill`.
 */
export const levelSkill = (def: SpeciesDef): string | null =>
  workSkill(def) ?? def.learns?.skill ?? (def.draught || def.mount ? tracesSkill(def) : null);
/**
 * What it takes to win one over at the stage it is at: its kind's taming and `WILD_STAGE_TAME` more for each stage past
 * its first, and its kind's base chance an offering times `WILD_STAGE_CHANCE` for each. Every check of taming reads
 * this -- an offering, a trap, the card. The island's `tame_needs`.
 */
export function tameNeeds(c: Pick<Creature, 'species' | 'skills'>): { level: number; chance: number } {
  const def = SPECIES[c.species];
  const stage = stageOf(c);
  return { level: (def?.tameLevel ?? 1) + WILD_STAGE_TAME * stage, chance: (def?.tameChance ?? 0) * WILD_STAGE_CHANCE ** stage };
}

/**
 * Taming an attempt teaches, by how hard the one tried is: its gain once over, and once more for every `TAME_HARD`
 * taming it needs (`tameNeeds`). The island's `tame_hard` and `tame_learn`.
 */
export const TAME_HARD = 20;
export const tameLearn = (c: Pick<Creature, 'species' | 'skills'>): number => 1 + tameNeeds(c).level / TAME_HARD;

/**
 * Food quality matters. Asked for: "when a tame wildermon eats a food item of quality q (0–100), it gets a learning
 * bonus of FED_LEARN (= 0.2) × q/100 for FED_FOR (= one island hour) ... If the food is the FIRST item of its diet list
 * (its favourite), the bonus is doubled. Grazing grass counts as quality 0 (no bonus)", and "each food item eaten adds
 * FED_CARE (= 0.05) × q/100 to care (clamped to 1)". Feeding put nothing into care before this, so the care is all
 * this. The island's `fed_learn`, `fed_for`, `fed_care` and `beast_fed`.
 */
export const FED_LEARN = 0.2;
/** How long a meal's learning lasts: an hour at the world's pace. */
export const FED_FOR = world(60 * 60);
export const FED_CARE = 0.05;
/** What its favourite multiplies a meal's learning by. */
export const FED_FAVOURITE = 2;
/** Its favourite food: the first of its diet. */
export const favouriteOf = (def: SpeciesDef): string | undefined => def.diet[0];
/** The learning a meal of something at a quality is worth to a kind: `FED_LEARN` at quality 100, twice that for its favourite. */
export const fedBonus = (def: SpeciesDef, item: string, ql: number): number =>
  FED_LEARN * Math.max(0, Math.min(QL_TOP, ql)) / QL_TOP * (item === favouriteOf(def) ? FED_FAVOURITE : 1);
/**
 * The quality a meal counts for to one of yours: what it falls short of the top by, as its blood makes that (`food`).
 * The island's `meal_ql`.
 */
export const mealQuality = (c: Creature, ql: number): number =>
  QL_TOP - (QL_TOP - Math.max(0, Math.min(QL_TOP, ql))) * bloodMul(c, 'food');
/** The learning a meal is putting on it now, nought once its hour is out. */
export const fedNow = (c: Pick<Creature, 'fedBonus' | 'fedUntil'>, time: number): number =>
  (c.fedUntil ?? -Infinity) > time ? c.fedBonus ?? 0 : 0;
/**
 * One of yours eats something: the learning it is worth replaces a smaller one still on it and starts its hour again
 * (one as large starts the hour again too), and one smaller leaves what is on it be; and its care goes up by
 * `FED_CARE` at quality 100. A wild one is fed nothing by this. The island's `beast_fed`.
 */
export function fedOn(c: Creature, item: string, ql: number, time: number): void {
  const def = SPECIES[c.species];
  if (!def || c.mode === 'wild') return;
  const q = mealQuality(c, ql);
  const bonus = fedBonus(def, item, q);
  if (bonus > 0 && bonus >= fedNow(c, time)) {
    c.fedBonus = bonus;
    c.fedUntil = time + FED_FOR;
  }
  c.care = Math.min(1, c.care + FED_CARE * q / QL_TOP);
  // And it has eaten (`UPKEEP_FOR`).
  c.unfed = 0;
}
/** Its favourite and what it is worth, for its card and its page: "Favourite: reed, +40% learning for two and a half hours at quality 100". */
export function favouriteSays(def: SpeciesDef): string {
  const fav = favouriteOf(def);
  return fav ? `Favourite: ${itemDef(fav).name.toLowerCase()}, learning +${percent(fedBonus(def, fav, QL_TOP))} for ${timeWords(FED_FOR)} at QL ${QL_TOP}` : '';
}
/** A meal's learning still on it, for its card: "Well fed: +14% learning for 38 minutes more"; nothing once it is out. */
export function wellFedSays(c: Pick<Creature, 'fedBonus' | 'fedUntil'>, time: number): string {
  const fed = fedNow(c, time);
  return fed > 0 ? `Well fed: learning +${percent(fed)}, ${timeWords((c.fedUntil ?? time) - time)} left` : '';
}
/**
 * What a wild one past its first stage asks over its kind's, for its card: "Already a Reedweaver: 15 more taming than a
 * Reedpup and 50% of its base chance an offering"; nothing for one at its first.
 */
export function stageTameSays(c: Pick<Creature, 'species' | 'skills'>): string {
  const def = SPECIES[c.species];
  const stage = stageOf(c);
  if (!def || !stage) return '';
  return `${kindName(c)}: taming needed +${WILD_STAGE_TAME * stage}, chance per offering ${percent(WILD_STAGE_CHANCE ** stage)} of a ${def.name}'s`;
}

/**
 * What teaches a wildermon with no trade its one skill, which is its level: being sheared, plucked or milked
 * (`tended`); a spar swing of yours landing on it (`spar`); being out -- at your heel or keeping a settlement -- for
 * every `OUT_EVERY` of it (`out`), or for every `OUT_EVERY` of it after dark (`dark`); or pulling, a go for every tile
 * a large cart or a wagon it is hitched to goes into while you drive it (`pull`). Asked for: "Give skill-less
 * wildermon a skill that levels as they complete tasks", and "Roxxen need to have the Driving trade and gain
 * experience in it when pulling a large cart or wagon". The island's `beast_learns`. And a Sparra's spar with a guard
 * of yours on a settlement (`bout`, `sparTaskSays`), which teaches the skill its spar does at a factor of its own, as
 * that spar comes round at a worker's go rather than at your swing.
 */
export type LearnsBy = 'tended' | 'spar' | 'out' | 'dark' | 'pull' | 'bout';
/** Seconds of being out that count as one go at its task, for a kind that learns by being out. */
export const OUT_EVERY = 30;
/**
 * What a tile pulled teaches a kind that learns by pulling, as the base of a gain: what the same tile teaches whoever
 * has the reins (`DRIVING_LEARN`), as a deed worker's go at its task is priced about as yours at it is. A lone Roxxen
 * takes a large cart along at under a tile a second and a wagon team goes at nearer three, so this comes to from under
 * half to a little over what a kind that learns by being out (`LEARNS_GAIN.out` every `OUT_EVERY`) picks up in the
 * same time.
 */
export const PULL_LEARN = DRIVING_LEARN;
/** What a spar teaches a Sparra, as the base of a gain: your swing that lands on it, and a spar with a guard on a settlement. */
const SPAR_GAIN = 0.05;
/** What each go teaches, as the base of a gain: a shearing or a milking, a spar swing, a spell of being out, a tile pulled, and a spar on a settlement. */
export const LEARNS_GAIN: Record<LearnsBy, number> = { tended: 0.3, spar: SPAR_GAIN, out: 0.2, dark: 0.2, pull: PULL_LEARN, bout: SPAR_GAIN };
/** The least and the most a trade's learning is multiplied by (`LEARN_PACE`). */
export const LEARN_PACE_LEAST = 0.25;
export const LEARN_PACE_MOST = 4;
/**
 * What every gain of a deed worker's level skill is multiplied by, by its trade, or for a kind with no trade by what
 * teaches it (`LearnsBy`). Asked for: "Even out the time to evolve across trades": each trade's go comes round at its
 * own rate -- a mender's at the stores, a water carrier's after two goes and a walk to the shore and back, a kind that
 * learns by being out every `OUT_EVERY` -- so some lines reached `EVOLVE_AT` in a fraction of the time others took.
 *
 * Derived from the measured go rates, not chosen: `supabase/test/learnrate.ts` works out, from each trade's go on the
 * island (its walks at its kind's pace, `workDuration` at its stage, the second the island rests after a go, its rest
 * of `REST_FOR` every `TIRE_GOES` goes, and the share of its goes that teach), the minutes a well-kept worker with no traits takes from level 1 to the first of
 * `EVOLVE_AT` and from there to the second, takes the median trade as the mark, and divides each trade's time by it
 * (the two spans' ratios multiplied and the root taken), held to between `LEARN_PACE_LEAST` and `LEARN_PACE_MOST`.
 * That test recomputes these and fails when one has drifted from what the rule now makes. Rerun it with `--table` to
 * see the minutes. A keeping watch is measured by its spar with a Sparra on the settlement (`sparTaskSays`), the one
 * go of its that comes round at a rate. A hunt is 1: what it learns by is what wild things come onto the deed, which
 * no deed sets. The island's `learn_pace`, off `learn_pace_def`.
 */
export const LEARN_PACE: Record<GatherKind | LearnsBy, number> = {
  // Out to the ground and home with a load.
  forage: 0.94, botanize: 0.95, woodcut: 0.92, farm: 0.91, mine: 1.01, quarry: 1.04, sand: 1, clay: 1.01, peat: 1.04,
  reed: 0.98, fetch: 1, compost: 1.03, fruit: 1.01, bush: 1.06, grass: 1.01, sprout: 0.99, resin: 1.06, flower: 1.04,
  worm: 0.98, fish: 0.99, seek: 0.99, pan: 0.95, prune: 0.95, stump: 0.96, scrub: 0.95, hive: 1.01,
  // At the stores, a fire, a press or a barrel, one thing after another.
  mend: 1, butcher: 0.7, restore: 0.7, glaze: 1.05, tan: 0.84, mill: 0.81, saw: 0.84, chisel: 0.84, brick: 0.84,
  rope: 0.84, fletch: 0.84, cook: 0.84, paper: 0.84, spin: 0.86, nail: 0.86, ribbon: 0.86, glass: 0.84, ash: 0.97, brew: 0.71,
  // To one of yours, or to a piece of yours, with something out of the stores for some.
  groom: 0.87, dairy: 0.87, heal: 1.75, lamp: 2.16, smelt: 1.32, kiln: 1.32, patch: 1.04,
  // Carrying between the stores, the water and the work.
  fill: 3.34, water: 2.2, hod: 0.96, stoke: 1.12, plant: 0.99, prospect: 1.01,
  // A spar with a Sparra on the settlement; and what wild things come onto the deed.
  guard: 2.02, hunt: 1,
  // A kind with no trade.
  out: 0.94, dark: 3.66, tended: LEARN_PACE_MOST, spar: 0.26, pull: 1.53,
  // A Sparra's spar with a guard on a settlement.
  bout: LEARN_PACE_MOST,
};
/** What its level is learned by: its trade, or for a kind with no trade what teaches it; null for neither. */
export function learnsAt(c: Pick<Creature, 'species' | 'trade'>): GatherKind | LearnsBy | null {
  const def = SPECIES[c.species];
  return c.trade ?? def?.gathers ?? def?.learns?.by ?? null;
}
/**
 * What a gain of this skill is multiplied by for its trade (`LEARN_PACE`): its level skill only, the skill its trade
 * or what teaches it trains, and 1 for anything else it learns. The island's `learn_pace`.
 */
export function learnPace(c: Pick<Creature, 'species' | 'trade'>, skill: string): number {
  const at = learnsAt(c);
  if (!at) return 1;
  const own = at in GATHER_SKILL ? GATHER_SKILL[at as GatherKind] : SPECIES[c.species]?.learns?.skill;
  return own === skill ? LEARN_PACE[at] : 1;
}
/** What a kind that learns its own skill does to learn it, for its card and the help. */
const BOUT_SAYS = 'per spar with a guard of yours on the settlement';
export const LEARNS_SAYS: Record<LearnsBy, string> = {
  tended: 'per shearing, plucking or milking',
  spar: `per spar swing of yours that lands on it, learning ${percent(LEARN_PACE.spar)}; ${BOUT_SAYS}, learning ${percent(LEARN_PACE.bout)}`,
  bout: BOUT_SAYS,
  out: `per ${OUT_EVERY} seconds out at your heel or keeping a settlement`,
  dark: `per ${OUT_EVERY} seconds out at your heel or keeping a settlement after dark`,
  pull: `per tile driven in the traces of a large cart or wagon, ${percent(LEARN_PACE.pull)} of what the tile teaches you at the reins`,
};
/** What a kind with no trade learns by, as a trade is named (`GATHER_VERB`), for the help. */
const LEARNS_VERB: Record<LearnsBy, string> = {
  tended: 'shorn, plucked or milked', spar: 'sparred with by you', out: 'out', dark: 'out after dark', pull: 'pulling a cart or wagon',
  bout: 'sparring a guard on a settlement',
};
/** And the two trades `GATHER_VERB` calls the same, told apart. */
const PACE_VERB: Partial<Record<GatherKind, string>> = { fetch: 'fetching', compost: 'composting', dairy: 'milking or shearing' };
/**
 * Every trade's factor and every way of learning's (`LEARN_PACE`), the ones at the same factor together, least first:
 * "33% for sparring; 67% for butchering and restoring; ...". Leaves out a hunt, which is 1.
 */
export function learnPaceSays(): string {
  const by = new Map<number, string[]>();
  for (const [at, f] of Object.entries(LEARN_PACE) as Array<[GatherKind | LearnsBy, number]>) {
    if (at === 'hunt') continue;
    by.set(f, [...(by.get(f) ?? []), PACE_VERB[at as GatherKind] ?? (at in GATHER_VERB ? GATHER_VERB[at as GatherKind] : LEARNS_VERB[at as LearnsBy])]);
  }
  return [...by].sort((a, b) => a[0] - b[0]).map(([f, names]) => `${listed(names)} ${percent(f)}`).join('; ');
}

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
  shield: `each blow it lands turns every wild creature within ${GUARD_RANGE} tiles that is after you or yours onto it`,
  flank: `blow +${percent(BLINDSIDE - 1)} on a target fighting you or another of yours rather than it`,
  bleed: `bites bleed the target ${percent(KNIFE_BLEED)} of the bite per second for ${KNIFE_BLEED_SECS} seconds (as a knife)`,
  stun: `1 blow in ${HEAVY_EVERY} stuns the target ${STUN_SECS} seconds: no moving or striking`,
  venom: `bite poisons other creatures: ${percent(VENOM_DRAIN)} of their health per second for ${VENOM_SECS} seconds`,
  bore: `blow +${percent(BODKIN_HIDE - 1)} on thick hide, shell or scales (as a bodkin)`,
  spar: `Spar with it while it is out with you: a swing teaches fighting, the weapon skill and body strength as a swing at a wild creature does, and wears the weapon as much; your blows stop at ${percent(SPAR_YIELD)} of its health, where it yields until above it; never strikes back`,
};
/**
 * What one of yours does in a fight once every so often, instead of a blow, wherever it fights -- at your heel or
 * keeping a settlement: a fighting trade's spell, used as the trade's own spell is and at its numbers and its rest
 * (`CLASS_SPELLS`), or a frost breath, or a Whispet's Fear (`FEAR_SECS`, `FEAR_REST`). A wild one of these kinds
 * fights as any other does. The island's `beast_ability`, which reads the same spells off `class_spell`.
 */
export type AbilityId = 'beastmaster_pounce' | 'blade_hamstring' | 'berserker_skull_crack' | 'blade_shield_bash'
  | 'berserker_execute' | 'berserker_whirlwind' | 'kindler_scorch' | 'frost_breath' | 'binder_root' | 'binder_dull_claws'
  | 'binder_brittle' | 'pikeman_keep_away' | 'blade_guardians_call' | 'skirmisher_marked_for_death' | 'warder_ward'
  | 'warder_stoneskin' | 'chirurgeon_leech' | 'fear';
/** What is on a creature for a while (`Creature.marks`). */
export type MarkKind = 'ability' | 'root' | 'dull' | 'brittle' | 'marked' | 'stone' | 'keep_away' | 'fear';
/** Seconds between a frost breath and the next. */
export const FROST_BREATH_REST = 15;
/**
 * A Fear (a Whispet's): what it fights runs from it for this many seconds, as a Chaos Fright runs it (`fleeFrom`, the
 * island's `flee_from`), and not again for its rest. Asked for: "has a fear ability on cooldown".
 */
export const FEAR_SECS = 5;
export const FEAR_REST = 20;
/** The skin a wardo lays over you, as a share of your full health: it takes that much of the blows that come at you. */
export const WARD_SKIN = 0.1;
/** Seconds between goes at an ability. */
export const abilityRest = (id: AbilityId): number =>
  (id === 'frost_breath' ? FROST_BREATH_REST : id === 'fear' ? FEAR_REST : CLASS_SPELL_BY_ID.get(id)?.rest ?? 0);
/**
 * Seconds between one wildermon's goes at its ability: its line's third-stage `rest` off it (`perkN`), and its blood's
 * `cooldown`. The island's `beast_ability`.
 */
export const abilityRestOf = (c: Creature, id: AbilityId): number => abilityRest(id) * (1 - perkN(c, 'rest')) * bloodMul(c, 'cooldown');
/** A number an ability is used at: its spell's own. */
export const abilityFx = (id: AbilityId, k: string): number => (id === 'fear' ? ({ secs: FEAR_SECS } as Record<string, number>)[k] ?? 0 : CLASS_SPELL_BY_ID.get(id)?.fx[k] ?? 0);
/** An ability's name: its spell's. */
export const abilityName = (id: AbilityId): string =>
  (id === 'frost_breath' ? 'Frost Breath' : id === 'fear' ? 'Fear' : CLASS_SPELL_BY_ID.get(id)?.name ?? id);
/** What an ability does, in the game's own terms, for a species' words, the help and What's new. */
export function abilitySays(id: AbilityId): string {
  const f = (k: string): number => abilityFx(id, k);
  const said: Record<AbilityId, () => string> = {
    beastmaster_pounce: () => `leaps to a target within ${f('reach')} tiles: blow ×${percent(f('more'))}, target's next blow ${f('back')} seconds later`,
    blade_hamstring: () => `blow ×${percent(f('more'))}; target pace ${percent(f('pace'))} for ${f('secs')} seconds`,
    berserker_skull_crack: () => `blow ×${percent(f('more'))}; target held, no moving or striking, ${f('hold')} seconds (a monster ${f('hold') * f('monster')})`,
    blade_shield_bash: () => `blow ×${percent(f('more'))}; cancels a heavy blow; target's next blow ${f('back')} seconds later`,
    berserker_execute: () => `blow ×${percent(f('more'))} on a target under ${percent(f('low'))} health`,
    berserker_whirlwind: () => `${f('blows')} blows ×${percent(f('more'))} on every wild creature within ${f('reach')} tiles`,
    kindler_scorch: () => `blow ×${percent(f('fire'))}; target burns ${percent(f('each'))} of its health per second for ${f('secs')} seconds`,
    frost_breath: () => `blow; target pace ${percent(FROST_PACE)} for ${FROST_SECS} seconds (as Frostbite)`,
    binder_root: () => `target rooted ${f('secs')} seconds: can strike, cannot move`,
    binder_dull_claws: () => `target's blows −${percent(1 - f('dealt'))} for ${f('secs')} seconds`,
    binder_brittle: () => `target takes +${percent(f('taken') - 1)} from every blow for ${f('secs')} seconds`,
    pikeman_keep_away: () => `for ${f('secs')} seconds each blow it lands pushes the target ${f('push')} ${f('push') === 1 ? 'tile' : 'tiles'} back`,
    blade_guardians_call: () => `every wild creature within ${f('reach')} tiles that is after anybody turns on it for ${f('secs')} seconds`,
    skirmisher_marked_for_death: () => `for ${f('secs')} seconds your blows, throws and shots on its target crit chance ×${f('crit')}`,
    warder_ward: () => `while at your heel, a skin on you that absorbs damage up to ${percent(WARD_SKIN)} of your health, when your skin is smaller`,
    warder_stoneskin: () => `damage taken −${percent(f('cut'))} for ${f('secs')} seconds`,
    chirurgeon_leech: () => `blow ×${percent(f('more'))}; heals the same % of its health as the blow took of the target's`,
    fear: () => `target (not a monster) flees and strikes nothing for ${f('secs')} seconds or until you strike it`,
  };
  return `${said[id]()}; cooldown ${abilityRest(id)} seconds`;
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
  `Hit: ${c.name} ${Math.max(0, Math.ceil(c.health))}/${maxHealth(c, SPECIES[c.species])}${yielded(c) ? ', yields' : ''}.`;
/**
 * A Sparra kept on a settlement spars with your guards there. Asked for: "Fighting only type wildermon have no real way
 * to gain experience. If paired with Sparra on deed, both fight and gain experience for doing so."
 *
 * It takes a worker's place and has no other task. It picks a guard of yours on the same settlement (`sparsAsGuard`:
 * a worker whose trade is keeping watch, which is every wildermon that fights for a living but the hunter) that is not
 * resting or tired, not after an intruder, not yielded and not sparring with another Sparra, standing where the guard's
 * work range of the totem reaches, the one that sparred longest ago first; the guard walks to within `SPAR_REACH` of
 * it and they spar: a go at the guard's task (`workDuration` at its level skill, over its `taskMul`) and then the
 * second after a go, a blow each way at the end of it. Neither blow takes anybody below `SPAR_YIELD` of its health,
 * and neither wounds, bleeds or kills (`sparBlow`); one that has yielded stands until it is above it again
 * (`SPAR_SLACK`). Each go teaches the guard its level skill `GUARD_LEARN`, as an attack on a wild creature does, and the
 * Sparra its fighting (`LEARNS_GAIN.bout`, the base your spar swing teaches it) at its own factor (`LEARN_PACE.bout`,
 * measured as every trade's is), and spends a go of each one's stamina (`TIRE_GOES`). After every go the
 * Sparra picks again, so two guards take turns. A guard drops it at once for something wild on the settlement. The
 * island's `worker_settle`, off `spar_with` and `spar_at`.
 */
/** The base of what a guard's level skill learns from an attack on a wild creature, and from a spar. The island's `guard_learn`. */
export const GUARD_LEARN = 0.1;
/** How near a guard comes to a Sparra to spar with it, in tiles. */
export const SPAR_REACH = 1;
/** Whether one of yours is a guard a Sparra on a settlement may spar with: its trade is keeping watch. */
export const sparsAsGuard = (c: Pick<Creature, 'species' | 'trade'>): boolean => (c.trade ?? SPECIES[c.species]?.gathers) === 'guard';
/** The health a yielded one has its breath back above, whole. */
export const sparBack = (c: Creature): number => Math.ceil(sparFloor(c) + SPAR_SLACK);
/** What a Sparra kept on a settlement does, every number read off the rule, for its words and the help. */
export function sparTaskSays(): string {
  const level = GATHER_SKILL.guard.replace(/_/g, ' ');
  return `Settlement task: spar with a guard of yours on the settlement, 1 at a time, the one that sparred longest ago first. `
    + `Time per spar: the guard's time per action, ${Math.round(workDuration(1))} seconds at level 1, ${Math.round(workDuration(SKILL_TOP))} at level ${SKILL_TOP}. `
    + `Per spar: 1 blow each; guard ${level} as per attack on a wild creature; ${SPECIES.sparra.name} fighting as per spar swing of yours, learning ${percent(LEARN_PACE.bout)} (${percent(LEARN_PACE.spar)} when you spar it); 1 action of each one's stamina. `
    + `Blows stop at ${percent(SPAR_YIELD)} of health, on both; a yielded one stands until above it.`;
}

/**
 * What a stage adds over a kind's first, in words: its health, its blow, its pace and, for a kind with a task, its task,
 * and for one with a fleece, how fast that grows back, each as a share.
 */
export function stageSays(stage: number, task = true, fleece = false): string {
  const more = (ch: TraitChannel): string => percent((STAGE_MUL[ch] ?? 1) ** stage - 1);
  const parts = [`health +${more('hardy')}`, `blow +${more('tough')}`, `speed +${more('speed')}`];
  if (task) parts.push(`task speed +${more('work')}`);
  if (fleece) parts.push(`fleece regrowth +${more('grow')}`);
  return parts.join(', ');
}

/**
 * The words of a kind that evolves, at each stage: what it does, what its level is, and what each stage is and adds,
 * every number read off the rule it describes.
 */
function lineSays(names: readonly [string, string, string], job: string, level: string, stage: 0 | 1 | 2, task: boolean, fleece: boolean, kind: GatherKind | null = null, id = '', staged = ''): string {
  if (stage === 0) return `${job} ${level} Evolves at level ${EVOLVE_AT[0]}: ${names[1]}.`;
  const next = stage === 1 ? ` Evolves at level ${EVOLVE_AT[1]}: ${names[2]}.` : '';
  // And what its stage lets it do at once (`STAGE_LOADS`), for a trade that has something to do more of, its line's
  // own third-stage loads with it (`stageLoads`).
  const own = stage >= PERK_STAGE && STAGE_PERKS[id]?.kind === 'loads' ? STAGE_PERKS[id].n : 0;
  const work = stageWorkSays(kind, STAGE_LOADS[stage] + own);
  const more = work ? ` It ${work[0]} ${work[1]} (${names[0]}: ${STAGE_LOADS[0]}).` : '';
  // And its line's own skill, at the stage it comes in at (`STAGE_PERKS`).
  const skill = stage >= PERK_STAGE && STAGE_PERKS[id] ? ` ${perkLine(id)}.` : '';
  return `Evolution stage ${stage + 1}, level ${EVOLVE_AT[stage - 1]}+. Over ${article(names[0])} ${names[0]}: ${stageSays(stage, task, fleece)}.${more}${skill} ${job}${staged ? ` ${staged}` : ''}${next}`;
}

/** Seconds between chances for an unruly companion to turn on its keeper. */
export const NIP_EVERY = 25;

/** What a digger's lump of sand or clay comes out at, as a share of its digging: anywhere between the two. */
export const DIG_QL: readonly [number, number] = [0.6, 1.4];
/** A reed cutter's armful: one reed a cut, and one more for every this many levels of its foraging (`finishReed`). */
export const REED_LEVELS = 35;

/**
 * Writes a line's words onto its kind and its two stages, once every number they read is here; `staged`, what its
 * second and third stages do over its first.
 */
/**
 * Asked for: "walks very slowly on land (unmounted player walking speed .5)". A Springlet's pace on land, under a rider
 * or not, as a share of a walker's (`BASE_SPEED`): its `speed`. Under a rider on land that is flat (`landRidden`).
 */
export const SPRINGLET_LAND = 0.5;

function sayLine(id: string, job: string, level: string, staged = ''): void {
  const d = SPECIES[id];
  const names = [d.name, d.stages![0].name, d.stages![1].name] as const;
  // Its stages work faster only at a task, so a kind with none is not told they do; a guard's spar is timed as a task's go.
  const task = !!d.gathers;
  const fleece = !!d.fleece;
  d.description = lineSays(names, job, level, 0, task, fleece);
  d.stages = [
    { name: names[1], description: lineSays(names, job, level, 1, task, fleece, d.gathers, '', staged) },
    { name: names[2], description: lineSays(names, job, level, 2, task, fleece, d.gathers, id, staged) },
  ];
}

export const SPECIES: Record<string, SpeciesDef> = {
  rabba: {
    id: 'rabba',
    name: 'Snufflet',
    was: ['Rabba'],
    // Asked for: "This first will replace Rabba. Snufflet, Snuffroot, Snuffthorn". Its words, and each stage's, say what it
    // does and what each stage adds, in the game's own numbers, and are written once those are all here (`sayLine`).
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
  },
  vola: {
    id: 'vola',
    name: 'Sporeling',
    was: ['Vola'],
    // Asked for: "Now to replace Vola with Sporeling, Sporekin, Sporelord". Its words are written with every number they
    // read (`sayLine`).
    description: '',
    stages: [
      { name: 'Sporekin', description: '' },
      { name: 'Sporelord', description: '' },
    ],
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
    // Its coat and its cap: cream with a coral cap, white with a rose one, fawn with a red one, and grey-cream with a lilac one.
    variants: [
      ['#f3e8d6', '#ea8486'],
      ['#fbf8f2', '#e47c98'],
      ['#d8b48e', '#d4453e'],
      ['#ddd6cb', '#b48ad0'],
    ],
    butcher: { meat: 2, fur: 3, leather: 2, bone: 2, gland: 1 },
  },
  bevere: {
    id: 'bevere',
    name: 'Sapgnaw',
    was: ['Bevere'],
    // Asked for: a "family to replace bevere": Sapgnaw, Logchewer, Timberlord. Its words, and each stage's, are written once every
    // number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Logchewer', description: '' },
      { name: 'Timberlord', description: '' },
    ],
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
      ['#a8693a', '#ecd0a2'],
      ['#8a4426', '#e6c896'],
      ['#4e3424', '#c9a477'],
      ['#c8914a', '#f2e2c2'],
    ],
    butcher: { meat: 3, fur: 3, leather: 3, bone: 2, gland: 1 },
    nearWater: true,
    defaultStance: 'passive',
  },
  crawler: {
    id: 'crawler',
    hide: 'shell',
    wound: 'cut',
    venom: true,
    name: 'Sandpip',
    was: ['Crawler'],
    // Asked for: "Sandpip, sandpincher, sandpinnacle for crawler replacement". Its words, and each stage's, are written once every
    // number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Sandpincher', description: '' },
      { name: 'Sandpinnacle', description: '' },
    ],
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
      // Its body and legs, and the main colour of the speckles on its claws and bowl: peach with coral-pink, pale coral with
      // sky-blue, sandy tan with peach, and rose with cream. Its cream bowl and the gold sand in it are the same on every one.
      ['#ec9460', '#ee6f80'],
      ['#f2a894', '#6fa8e6'],
      ['#d4a46e', '#f49a66'],
      ['#d9727f', '#f7e4c4'],
    ],
    butcher: { meat: 3, leather: 1, bone: 4, gland: 1 },
    onSand: true,
    defensive: true,
    defaultStance: 'defensive',
    unruly: 0.12,
  },
  noot: {
    id: 'noot',
    wound: 'pierce',
    name: 'Mudlet',
    was: ['Noot'],
    // Asked for: "This family to replace the Noot". Its words, and each stage's, are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Clayburrow', description: '' },
      { name: 'Terramole', description: '' },
    ],
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
      // The coat and the clay: cream fur with rust clay; cream with brown clay; sandy with red-brown clay; grey-cream with dark
      // umber clay. Its teal glaze is its own, the same on every one.
      ['#f2e2c4', '#c8642e'],
      ['#f0e0c6', '#94603c'],
      ['#e6cc9a', '#a8402a'],
      ['#dcd6c8', '#5c3e2c'],
    ],
    // The clay caked in its coat and packed in its armour comes off with it.
    butcher: { meat: 3, leather: 2, bone: 2, gland: 1, clay: 4 },
    nearClay: true,
  },
  embra: {
    id: 'embra',
    wound: 'burn',
    name: 'Sluglow',
    was: ['Embra'],
    // Asked for: "Embra > sluglow slugember slugferno". Its words, and each stage's, are written once every number is here
    // (`sayLine`).
    description: '',
    stages: [
      { name: 'Slugember', description: '' },
      { name: 'Slugferno', description: '' },
    ],
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
    // Its body and its spots: cream with peach-orange spots, ivory with coral, pale peach with umber, pale ash-grey with amber.
    variants: [
      ['#f6e8d0', '#f29a5c'],
      ['#fbf4e6', '#ee7666'],
      ['#f7dcc4', '#93644a'],
      ['#e4e0da', '#eca83e'],
    ],
    butcher: { meat: 2, fur: 2, leather: 2, bone: 2, gland: 2 },
    nearTar: true,
  },
  quarra: {
    id: 'quarra',
    hide: 'shell',
    wound: 'crush',
    name: 'Chiptail',
    was: ['Quarra'],
    // Asked for: "Begin work on this family line to replace Quarra": Chiptail, Quarrybash, Monolithump. Its words are
    // written with every number they read (`sayLine`).
    description: '',
    stages: [
      { name: 'Quarrybash', description: '' },
      { name: 'Monolithump', description: '' },
    ],
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
    // Its fur, and the rust of its stone: beige under rust and grey, grey under slate, sandstone under ochre, and dark granite
    // under orange.
    variants: [
      ['#d2b78c', '#c0703e'],
      ['#bab5ad', '#66727e'],
      ['#ddb47a', '#c48a2c'],
      ['#7e7774', '#d77a34'],
    ],
    butcher: { meat: 4, leather: 3, bone: 4, gland: 1 },
    onStone: true,
  },
  woola: {
    id: 'woola',
    name: 'Cloudlet',
    was: ['Woola'],
    // Asked for: "Cloudlet, cloudram, cloudborne", in place of the Woola. Its words are written with every number they
    // read (`sayLine`).
    description: '',
    stages: [
      { name: 'Cloudram', description: '' },
      { name: 'Cloudborne', description: '' },
    ],
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
    // [coat, cloud]: cream with sky-blue clouds, white with lavender, warm fawn with peach, slate grey with silver-blue.
    variants: [
      ['#f2e8d4', '#8fbcf0'],
      ['#fbf9f5', '#b9a2ea'],
      ['#d9b48e', '#f4a888'],
      ['#7f8494', '#a6c0e0'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2 },
    fleece: 1 / 900,
    learns: { skill: 'animal_husbandry', by: 'tended' },
  },
  ulva: {
    id: 'ulva',
    wound: 'cut',
    name: 'Sprindle',
    was: ['Ulva'],
    // Asked for, with a reference sheet: Sprindle, Webloom, Silkward.
    description: '',
    stages: [
      { name: 'Webloom', description: '' },
      { name: 'Silkward', description: '' },
    ],
    health: 34,
    attack: 9,
    speed: 2.1,
    tameLevel: 30,
    tameChance: 0.06,
    diet: ['meat', 'cooked_meat'],
    baitHint: 'meat',
    timid: false,
    gathers: 'spin',
    workRange: 12,
    // [fur, face]: the sheet's brown with cream, chocolate with pale gold, ash with white, and russet with peach.
    variants: [
      ['#80522f', '#f2e2c2'],
      ['#5a3a2c', '#ecd59e'],
      ['#7a726c', '#f4f0e6'],
      ['#a0542c', '#f6dcc4'],
    ],
    butcher: { meat: 5, fur: 4, leather: 4, bone: 4, gland: 2 },
    defensive: true,
  },
  magga: {
    id: 'magga',
    wound: 'cut',
    name: 'Chestkit',
    was: ['Magga'],
    // Chestkit, Lootvent, Hoardback.
    description: 'Settlement task: carry items lying on the settlement home; sort raw and worked materials from the settlement stores into raw and craft material bins.',
    stages: [
      { name: 'Lootvent', description: '' },
      { name: 'Hoardback', description: '' },
    ],
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
    // Its oak and its green hide: oak with moss, walnut with fern, honey oak with lichen, and weathered grey oak with sage.
    variants: [
      ['#8a5a32', '#6f8f4a'],
      ['#6e4630', '#5f8a5a'],
      ['#a87444', '#86994a'],
      ['#7a5a48', '#5d7f6e'],
    ],
    butcher: { meat: 1, leather: 1, bone: 1, gland: 1 },
    nearTrees: true,
  },
  mola: {
    id: 'mola',
    wound: 'cut',
    name: 'Ironemole',
    was: ['Mola'],
    // Asked for: "Begin work on this line to replace Mola": Ironemole, Ferrodrill, Oremander, "Mines metals from the
    // ground". Its words are written with every number they read (`sayLine`).
    description: '',
    stages: [
      { name: 'Ferrodrill', description: '' },
      { name: 'Oremander', description: '' },
    ],
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
    // Its fur and its crystals: umber with copper, charcoal with slate, tawny with gold, and near black with rust.
    variants: [
      ['#4a3a30', '#c96a3a'],
      ['#34353a', '#8a96a6'],
      ['#7a5a3a', '#d9a640'],
      ['#2a2422', '#a8452c'],
    ],
    butcher: { meat: 2, fur: 2, leather: 2, bone: 2, gland: 2 },
    onOre: true,
  },
  seavic: {
    id: 'seavic',
    name: 'Pigroot',
    was: ['Seavic'],
    // Asked for: "Pigroot, plowhog, harvestusk to replace seavic". Its words are written with every number they read
    // (`sayLine`).
    description: '',
    stages: [
      { name: 'Plowhog', description: '' },
      { name: 'Harvestusk', description: '' },
    ],
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
      // Tan with cream; russet with cream; dark brown with tan; pale fawn with white.
      ['#b07a48', '#f2dfba'],
      ['#a8502a', '#f0d6ae'],
      ['#5c3e2c', '#c99a66'],
      ['#dcbf96', '#fbf6ec'],
    ],
    butcher: { meat: 1, fur: 2, leather: 1, bone: 1, gland: 1 },
    nearTrees: true,
    defaultStance: 'passive',
  },
  roxxen: {
    id: 'roxxen',
    hide: 'thick',
    heavy: true,
    wound: 'crush',
    name: 'Cartling',
    was: ['Roxxen'],
    // Asked for: "This family to replace Roxxen once specced and rated": Cartling, Wagonox, Haulhorn. Its words, and each
    // stage's, are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Wagonox', description: '' },
      { name: 'Haulhorn', description: '' },
    ],
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
      ['#c9a06a', '#f1e6cc'],
      ['#b08454', '#eadcbc'],
      ['#d6b07a', '#f6eedb'],
      ['#9e7a4e', '#e2d2b0'],
    ],
    butcher: { meat: 26, fur: 4, leather: 14, bone: 18, gland: 1 },
    defensive: true,
    draught: true,
    pull: 0.3,
    learns: { skill: DRIVING, by: 'pull' },
  },
  orse: {
    id: 'orse',
    wound: 'crush',
    name: 'Thistlekit',
    was: ['Orse'],
    // Asked for: "This family to replace Orse as a rideable mount": Thistlekit, Bunnycourser, Moonhare. Its words, and each
    // stage's, are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Bunnycourser', description: '' },
      { name: 'Moonhare', description: '' },
    ],
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
      ['#f4ece4', '#c8a6d6'],
      ['#efe6ee', '#b996cc'],
      ['#f7efe6', '#d6a8c8'],
      ['#e9e2ea', '#a68fc4'],
    ],
    butcher: { meat: 14, fur: 3, leather: 10, bone: 12, gland: 1 },
    defensive: true,
    draught: true,
    mount: 16,
  },
  rowl: {
    id: 'rowl',
    wound: 'cut',
    name: 'Snarepup',
    was: ['Rowl'],
    // Snarepup, Lashrunner, Vinehunter. Its words, and each stage's, are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Lashrunner', description: '' },
      { name: 'Vinehunter', description: '' },
    ],
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
      ['#dcc8a0', '#6f8f3e'],
      ['#d2b98c', '#8a963a'],
      ['#cfd0bc', '#4f7a4a'],
      ['#d9b48c', '#a86a34'],
    ],
    butcher: { meat: 8, fur: 6, leather: 5, bone: 6, gland: 2 },
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
    name: 'Mosskip',
    was: ['Bogga'],
    // Mosskip, Craghopper, Bastiontoad.
    description: 'Settlement task: cut peat and tar from the bog; output home.',
    stages: [
      { name: 'Craghopper', description: '' },
      { name: 'Bastiontoad', description: '' },
    ],
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
      ['#86a85e', '#eaa0a0'],
      ['#7a9e66', '#f0b49a'],
      ['#94a855', '#e892b4'],
      ['#6e9a74', '#c8a0d8'],
    ],
    butcher: { meat: 4, leather: 3, bone: 3, gland: 1 },
    nearTar: true,
  },
  sedra: {
    id: 'sedra',
    name: 'Reedpup',
    was: ['Sedra'],
    // Asked for: "To replace sedra": Reedpup, Reedweaver, Marshreaper. Its words, and each stage's, are written once every
    // number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Reedweaver', description: '' },
      { name: 'Marshreaper', description: '' },
    ],
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
      ['#8a5a36', '#f0e2c6'],
      ['#6e4a32', '#e8d8bc'],
      ['#9c6a40', '#f4e8d0'],
      ['#5e4334', '#dccbb0'],
    ],
    butcher: { meat: 3, fur: 2, leather: 1, bone: 2 },
    nearWater: true,
  },
  holla: {
    id: 'holla',
    name: 'Puddlehop',
    was: ['Holla'],
    // Asked for: "To replace holla": Puddlehop, Springcarrier, Aquavoyager. Its words, and each stage's, are written once
    // every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Springcarrier', description: '' },
      { name: 'Aquavoyager', description: '' },
    ],
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
      ['#7aa04a', '#3f86b0'],
      ['#6c9446', '#4a8fb8'],
      ['#86a85a', '#3a7aa0'],
      ['#5e8a44', '#5197bf'],
    ],
    butcher: { meat: 6, leather: 4, bone: 4, gland: 1 },
    nearWater: true,
  },
  dowse: {
    id: 'dowse',
    name: 'Nailsprout',
    was: ['Dowse'],
    // Asked for, with a reference sheet: Nailsprout, Hammertin, Nailwright. Its words, and each stage's, are written once
    // every number they read is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Hammertin', description: '' },
      { name: 'Nailwright', description: '' },
    ],
    health: 20,
    attack: 3,
    speed: 1.8,
    tameLevel: 15,
    tameChance: 0.1,
    diet: ['nuts', 'acorn', 'clay', 'potato'],
    baitHint: 'nuts or a root',
    timid: true,
    gathers: 'nail',
    workRange: 8,
    rangePerStep: 12,
    variants: [
      ['#5f554e', '#f2dfc3'],
      ['#3f3a3a', '#eadccb'],
      ['#7a5a44', '#f3e2c6'],
      ['#4e5862', '#efe6d6'],
    ],
    butcher: { meat: 2, fur: 3, leather: 2, bone: 2, gland: 2 },
    onOre: true,
  },
  sappa: {
    id: 'sappa',
    name: 'Pipseed',
    was: ['Sappa'],
    // Asked for: Pipseed, Sprigwing, Arborcrest. Its words, and each stage's, are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Sprigwing', description: '' },
      { name: 'Arborcrest', description: '' },
    ],
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
      ['#f2e8d6', '#d9572e'],
      ['#efe2c4', '#e0a030'],
      ['#f4ece0', '#b8323a'],
      ['#e8d9c0', '#c7703a'],
    ],
    butcher: { meat: 3, feather: 3, leather: 2, bone: 2, gland: 1 },
    nearTrees: true,
  },
  snedda: {
    id: 'snedda',
    name: 'Saplingreach',
    was: ['Snedda'],
    // Asked for, with a reference sheet: Saplingreach, Canopyshaper, Grovemaster.
    description: 'Settlement task: prune trees whose next growth stage is dead; nothing else.',
    stages: [
      { name: 'Canopyshaper', description: '' },
      { name: 'Grovemaster', description: '' },
    ],
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
    // [coat, dapples]: the sheet's warm cream with sage, fawn with moss, ivory with lime, and tan with deep green.
    variants: [
      ['#f2e2bf', '#8fae55'],
      ['#e8d0a4', '#7c9c48'],
      ['#f6ecd8', '#a2bb5a'],
      ['#e0c294', '#6c8c4a'],
    ],
    butcher: { meat: 2, fur: 2, leather: 2, bone: 2, gland: 1 },
    nearTrees: true,
  },
  grubba: {
    id: 'grubba',
    name: 'Budscarab',
    was: ['Grubba'],
    // Budscarab, Blossomhorn, Florantler.
    description: 'Settlement task: dig out stumps.',
    stages: [
      { name: 'Blossomhorn', description: '' },
      { name: 'Florantler', description: '' },
    ],
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
      ['#7a7448', '#f2a2b4'],
      ['#86684a', '#f6b496'],
      ['#64785a', '#ea8eb6'],
      ['#706258', '#cfa4e0'],
    ],
    butcher: { meat: 4, leather: 3, bone: 3, gland: 1 },
    nearTrees: true,
  },
  plucka: {
    id: 'plucka',
    name: 'Vanari',
    was: ['Plucka'],
    // Asked for, with a reference sheet: Vanari, Orchibelle, Arboanari.
    description: 'Settlement task: pick what the fruit trees bear; output to the crate.',
    stages: [
      { name: 'Orchibelle', description: '' },
      { name: 'Arboanari', description: '' },
    ],
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
      ['#5e3c28', '#f4ead6'],
      ['#6e4a30', '#f2e4c8'],
      ['#4e3a32', '#ece6da'],
      ['#86603e', '#f8eedc'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 2, gland: 1 },
    nearTrees: true,
  },
  cobbe: {
    id: 'cobbe',
    hide: 'thick',
    name: 'Brickling',
    was: ['Cobbe'],
    // Asked for: "Implement this family through a rate loop to replace Cobbe": Brickling, Mortarback, Bastiondrake. Its
    // words, and each stage's, are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Mortarback', description: '' },
      { name: 'Bastiondrake', description: '' },
    ],
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
      ['#b4532f', '#ecd9b8'],
      ['#9a3f27', '#e3cba4'],
      ['#c56b3f', '#f1e2c6'],
      ['#7e3a25', '#d8c09e'],
    ],
    butcher: { meat: 6, fur: 1, leather: 5, bone: 6 },
    defensive: true,
  },
  tinka: {
    id: 'tinka',
    name: 'Stitchkit',
    was: ['Tinka'],
    // Asked for: "This family to replace reppa", the Tinka: Stitchkit, Patchcoon, Mendermask. Its words, and each stage's,
    // are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Patchcoon', description: '' },
      { name: 'Mendermask', description: '' },
    ],
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
      ['#8a7a6a', '#efe3cf'],
      ['#7a6e66', '#e6dccb'],
      ['#96806a', '#f2e6d2'],
      ['#6e6660', '#ddd3c4'],
    ],
    butcher: { meat: 1, fur: 2, leather: 1, bone: 1, gland: 2 },
  },
  middun: {
    id: 'middun',
    name: 'Snaileaf',
    was: ['Middun'],
    // Snaileaf, Middunsnail, Hearthsnail.
    description: 'Settlement task: turn rotting items on the settlement into compost.',
    stages: [
      { name: 'Middunsnail', description: '' },
      { name: 'Hearthsnail', description: '' },
    ],
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
    // Its body and its spots: cream with brown, tan with caramel, ivory with umber, sand with cinnamon.
    variants: [
      ['#f2e2c4', '#a8703e'],
      ['#e8cfa4', '#c88a4a'],
      ['#f6ecdc', '#7e5434'],
      ['#e4d2b2', '#b46a3c'],
    ],
    butcher: { meat: 3, leather: 2, bone: 3, gland: 1 },
  },
  // ---- The settlement's own hands. ----
  // Each says what it does on a settlement in the game's own terms; the numbers are the trades' (`TEND_JOBS`, `GATHER_DO`).
  kemma: {
    id: 'kemma',
    name: 'Whispling',
    was: ['Kemma'],
    // Asked for, with a reference sheet: Whispling, Hushwing, Songroost.
    description: 'Settlement task: brush your wildermon within its reach under {careWanting:pct} care, as a keeper of its skill with a brush of QL equal to its skill. No brush needed.',
    stages: [
      { name: 'Hushwing', description: '' },
      { name: 'Songroost', description: '' },
    ],
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
    // [leaf-feathers, peach]: the sheet's olive sage with peach, moss with rose, straw with apricot, and sea-sage with pink.
    variants: [
      ['#9db870', '#f4b48a'],
      ['#6c9a6c', '#f0a4a8'],
      ['#b4a45a', '#f6c084'],
      ['#78a092', '#eeb0c4'],
    ],
    butcher: { meat: 3, feather: 3, leather: 2, bone: 2 },
  },
  sheela: {
    id: 'sheela',
    name: 'Shearling',
    was: ['Sheela'],
    // Asked for, with a reference sheet: Shearling, Clipperoo, Shearlord.
    description: 'Settlement task: milk your cudda into empty buckets in your settlement stores; shear or pluck your other fleeced or feathered wildermon at {dairyFull:pct} regrowth. Output: your settlement stores.',
    stages: [
      { name: 'Clipperoo', description: '' },
      { name: 'Shearlord', description: '' },
    ],
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
    // [leaf-feathers, fleece]: the sheet's sage with cream, moss with oatmeal, olive with white, and teal with peach.
    variants: [
      ['#8c9c5c', '#f4e6d0'],
      ['#5e7a3e', '#e8d6b4'],
      ['#a09a4c', '#f6f2ea'],
      ['#5f8a78', '#f6dcc6'],
    ],
    butcher: { meat: 3, fur: 3, leather: 2, bone: 2 },
  },
  salva: {
    id: 'salva',
    name: 'Salva',
    description: 'Settlement task: dress your wildermon within its reach that are bleeding or under {healBelow:pct} health, with a bandage or herb cover from your settlement stores: stops bleeding, heals as a dressing of that QL at its first aid.',
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
    nearTrees: true,
  },
  carra: {
    id: 'carra',
    name: 'Carra',
    description: 'Settlement task: butcher carcasses in your settlement stores, yield as a butcher of its skill with a knife of QL equal to its skill. No knife needed. Output: your settlement stores.',
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
    nearTrees: true,
  },
  tanna: {
    id: 'tanna',
    name: 'Peltling',
    was: ['Tanna'],
    // Asked for, with a reference sheet: Peltling, Peltipede, Hideweaver.
    description: 'Settlement task: tan hides in your settlement stores, a hide and {tanLye} L lye per leather. No carving knife needed. Output: your settlement stores.',
    stages: [
      { name: 'Peltipede', description: '' },
      { name: 'Hideweaver', description: '' },
    ],
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
    // [feather plates, fleece]: the sheet's sage with cream, moss with oatmeal, sea sage with white, and olive with peach.
    variants: [
      ['#8f9a58', '#f4dcbc'],
      ['#6f8a4c', '#eed8b4'],
      ['#7f9a84', '#f4ece0'],
      ['#aaa052', '#f8dcc4'],
    ],
    butcher: { meat: 3, fur: 3, leather: 3, bone: 2 },
    nearWater: true,
  },
  grista: {
    id: 'grista',
    name: 'Wheatley',
    was: ['Grista'],
    // Wheatley, Wheatwhirl, Wheatcheeks.
    description: 'Settlement task: grind wheat and corn and press olives in your settlement stores. No quern needed. Output: flour, cornmeal and oil to your settlement stores.',
    stages: [
      { name: 'Wheatwhirl', description: '' },
      { name: 'Wheatcheeks', description: '' },
    ],
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
      ['#d9a35a', '#f6ead2'],
      ['#c8804a', '#f4e4cc'],
      ['#e2bd7a', '#fbf3e4'],
      ['#a88c6c', '#efe6d6'],
    ],
    butcher: { meat: 4, fur: 3, leather: 2, bone: 3 },
  },
  wicka: {
    id: 'wicka',
    name: 'Glimmoth',
    was: ['Wicka'],
    // Asked for: a moth family to replace the wicka: Glimmoth, Lurewing, Noctilure. Its words, and each stage's, are written
    // elsewhere once every number is here.
    description: '',
    stages: [
      { name: 'Lurewing', description: '' },
      { name: 'Noctilure', description: '' },
    ],
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
    // The coat is its fur and the moss of its wings; the markings, the light of its lantern.
    variants: [
      ['#7d9a3e', '#ffcf4a'],
      ['#5f8a4a', '#ffe596'],
      ['#8f8445', '#ffaa48'],
      ['#6f8a72', '#e6f07a'],
    ],
    butcher: { meat: 1, fur: 1, leather: 1, gland: 2 },
    nocturnal: true,
  },
  brambo: {
    id: 'brambo',
    name: 'Brambo',
    description: 'Settlement task: pick bushes in season, as many as your hands would at its forestry, and ripe trellis vines; output home.',
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
    nearTrees: true,
  },
  grazza: {
    id: 'grazza',
    name: 'Sprigmant',
    was: ['Grazza'],
    // Sprigmant, Petalblade, Bloomreaper.
    description: 'Settlement task: cut grass, {grassPerCut} mixed grass a cut, and moss, {mossPerCut} a cut; output home. Grass it keeps cut on your settlement turns to lawn.',
    stages: [
      { name: 'Petalblade', description: '' },
      { name: 'Bloomreaper', description: '' },
    ],
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
    // Its green and its pink: sage with blush, mint with coral, lime with rose, and celery with peach. Its feelers and the blue
    // in its hindwings are the same on every one.
    variants: [
      ['#a8c47a', '#f2a0b4'],
      ['#9cc08a', '#f4a88e'],
      ['#b6c870', '#ee9ac8'],
      ['#c0c890', '#f0b0a0'],
    ],
    butcher: { meat: 4, leather: 3, bone: 3 },
  },
  siffa: {
    id: 'siffa',
    name: 'Ribbonip',
    was: ['Siffa'],
    // Asked for, with a reference sheet: Ribbonip, Stripforge, Metallocurl. Its words, and each stage's, are written once every
    // number they read is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Stripforge', description: '' },
      { name: 'Metallocurl', description: '' },
    ],
    health: 16,
    attack: 2,
    speed: 2.2,
    tameLevel: 20,
    tameChance: 0.09,
    diet: ['minnow', 'perch', 'trout', 'nuts'],
    baitHint: 'a fish',
    timid: true,
    gathers: 'ribbon',
    workRange: 8,
    variants: [
      ['#8a6446', '#efd3a2'],
      ['#585a62', '#dcdcd4'],
      ['#a0502e', '#f4c98a'],
      ['#4a3428', '#efe6d0'],
    ],
    butcher: { meat: 2, fur: 1, leather: 1, bone: 2, scale: 5 },
    onSand: true,
    nearWater: true,
  },
  // ---- Twelve more hands: the furnaces, the kitchen, the stores and the ground. ----
  forga: {
    id: 'forga',
    name: 'Forga',
    description: 'Settlement task: empty your smelters into your settlement stores and charge them with ore from your settlement stores, a charge per ore, up to capacity. Does not light or fuel them.',
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
    onStone: true,
  },
  potta: {
    id: 'potta',
    name: 'Kilnlet',
    was: ['Potta'],
    // Asked for, with a reference sheet: Kilnlet, Terrabrick, Kilnspire. Its words are written once the kiln's ware is here (`STORE_WORDS`).
    description: '',
    stages: [
      { name: 'Terrabrick', description: '' },
      { name: 'Kilnspire', description: '' },
    ],
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
    // [coat, markings]: the sheet's terracotta with cream, umber with pale gold, ash with white, and ochre with peach.
    variants: [
      ['#c8664a', '#f6e0c2'],
      ['#8e4a36', '#ecd3a2'],
      ['#968a84', '#f4eee4'],
      ['#c48a3e', '#f8e0c6'],
    ],
    butcher: { meat: 3, scale: 2, leather: 2, bone: 2 },
    nearClay: true,
  },
  cindra: {
    id: 'cindra',
    name: 'Cindra',
    description: 'Settlement task: rake whole ashes from your campfires, ovens, smelters and kilns into your settlement stores; with none to rake, leach ash and a bucket of water from your settlement stores into lye, per the lye recipe.',
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
    nearTar: true,
  },
  hoppa: {
    id: 'hoppa',
    name: 'Hoppa',
    description: 'Settlement task: start a brew in each idle barrel of yours with enough water, from makings in your settlement stores, brews tried in list order. Never spoils a brew. Brew QL: half the makings\' QL plus half its brewing.',
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
  },
  simma: {
    id: 'simma',
    name: 'Simma',
    // Its words are written once the recipes are here (`STORE_WORDS`).
    description: '',
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
  },
  relka: {
    id: 'relka',
    name: 'Kintsu',
    was: ['Relka'],
    // Asked for, with a reference sheet: Kintsu, Relicrawler, Aureliax.
    description: 'Settlement task: restore each relic whose pieces are all in your settlement stores, at the pieces\' worth less their damage and at its restoration, as your hands would. Output: your settlement stores. Never fails.',
    stages: [
      { name: 'Relicrawler', description: '' },
      { name: 'Aureliax', description: '' },
    ],
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
    // Its shell and its gold: turquoise, cerulean, jade and a deep teal, each mended in gold.
    variants: [
      ['#3f9c9c', '#c9a13a'],
      ['#3f88a8', '#cfa648'],
      ['#4ea488', '#c49a3c'],
      ['#2f8486', '#d4ae52'],
    ],
    butcher: { meat: 2, leather: 1, bone: 2, gland: 1 },
  },
  bedda: {
    id: 'bedda',
    name: 'Sprigkit',
    was: ['Bedda'],
    // Asked for, with a reference sheet: Sprigkit, Bloomwhisk, Floramane.
    description: 'Settlement task: harvest ripe crops in your planters into your settlement stores, tend growing ones, sow empty ones with seed from your settlement stores.',
    stages: [{ name: 'Bloomwhisk', description: '' }, { name: 'Floramane', description: '' }],
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
      ['#d98a3e', '#f6ecd8'],
      ['#dba062', '#f8f0e2'],
      ['#b5602c', '#f1e0c4'],
      ['#8e8a98', '#f3efe8'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 1 },
  },
  wurla: {
    id: 'wurla',
    name: 'Pebblebeak',
    was: ['Wurla'],
    // Pebblebeak, Soilwhistle, Wormheron.
    description: 'Settlement task: dig worms on dry grass, dirt, marsh and moss as your spade would, more in marsh or moss, sometimes none; output home. A dug tile rests as long as a forage bed.',
    stages: [
      { name: 'Soilwhistle', description: '' },
      { name: 'Wormheron', description: '' },
    ],
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
      ['#8a6248', '#efe2c8'],
      ['#a0583e', '#f2dcc0'],
      ['#6e6456', '#e6e2d6'],
      ['#94784c', '#f4e8cc'],
    ],
    butcher: { meat: 2, feather: 2, leather: 1, bone: 1 },
    nearWater: true,
  },
  sprigga: {
    id: 'sprigga',
    name: 'Lemlet',
    was: ['Sprigga'],
    // Lemlet, Lemleaf, Lemorian. Its words, and each stage's, are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Lemleaf', description: '' },
      { name: 'Lemorian', description: '' },
    ],
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
      ['#8e7466', '#f3e3c8'],
      ['#9a7e68', '#f4e0c0'],
      ['#7c7c84', '#eeeae2'],
      ['#6a5c58', '#e8d6b8'],
    ],
    butcher: { meat: 2, fur: 2, leather: 1, bone: 1 },
    nearTrees: true,
  },
  ambra: {
    id: 'ambra',
    name: 'Saplet',
    was: ['Ambra'],
    // Asked for, with a reference sheet: Saplet, Mapletap, Tapsylvan.
    description: 'Settlement task: tap each pine big enough to tap, {resinTapped} tar per pine per day; output home.',
    stages: [
      { name: 'Mapletap', description: '' },
      { name: 'Tapsylvan', description: '' },
    ],
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
      ['#8c5a38', '#f2dcb8'],
      ['#6e6a68', '#ece8e0'],
      ['#a8542c', '#f6e2c6'],
      ['#4e3a30', '#e2cca6'],
    ],
    butcher: { meat: 2, fur: 3, leather: 1, bone: 1 },
    nearTrees: true,
  },
  petta: {
    id: 'petta',
    name: 'Briarling',
    was: ['Petta'],
    // Asked for, with a reference sheet: Briarling, Meadowtide, Floracrux.
    description: 'Settlement task: pick wildflowers, a flower per clump on a tile; output home. Not within {skepReach} tiles of a skep or a hive.',
    stages: [
      { name: 'Meadowtide', description: '' },
      { name: 'Floracrux', description: '' },
    ],
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
    // [coat, markings]: the sheet's tan with cream, chocolate with oatmeal, ash with white, and russet with peach.
    variants: [
      ['#b4875c', '#f6e8d0'],
      ['#6e4a32', '#eedcbc'],
      ['#8a847c', '#f4f2ec'],
      ['#a65a32', '#f8dcc2'],
    ],
    butcher: { meat: 1, fur: 2, leather: 1 },
  },
  scurra: {
    id: 'scurra',
    name: 'Scurra',
    description: 'Settlement task: scrub moss off your paving, poured foundations and statues and ivy off your stone walls once greened a day, back to bare stone. Carries nothing home.',
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
    onStone: true,
  },
  rippa: {
    id: 'rippa',
    name: 'Logkit',
    was: ['Rippa'],
    // Asked for, with a reference sheet: Logkit, Sawquill, Timberback.
    description: '',
    stages: [
      { name: 'Sawquill', description: '' },
      { name: 'Timberback', description: '' },
    ],
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
    // [fur, face]: the sheet's russet with cream, chestnut with honey, ash brown with white, and ginger with peach.
    variants: [
      ['#a8562a', '#f4e0bc'],
      ['#6a3c24', '#e8c88e'],
      ['#7a6656', '#f2ece0'],
      ['#c27a36', '#f8dcc0'],
    ],
    butcher: { meat: 4, fur: 2, leather: 3, bone: 2 },
  },
  chissa: {
    id: 'chissa',
    name: 'Chissa',
    description: '',
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
  },
  mudda: {
    id: 'mudda',
    name: 'Sliplet',
    was: ['Mudda'],
    // Sliplet, Wheelmote, Rollterra.
    description: 'Settlement task: shape each lump of clay in your settlement stores into an unfired clay brick. Output: your settlement stores. Never spoils a brick.',
    stages: [
      { name: 'Wheelmote', description: '' },
      { name: 'Rollterra', description: '' },
    ],
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
      ['#7894c0', '#cc7c50'],
      ['#6c88b4', '#c06c44'],
      ['#8aa0bc', '#d8946a'],
      ['#7484a8', '#b46848'],
    ],
    butcher: { meat: 3, leather: 2, bone: 2 },
  },
  cordra: {
    id: 'cordra',
    name: 'Cordra',
    description: '',
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
  },
  flecha: {
    id: 'flecha',
    name: 'Flecha',
    description: '',
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
  },
  papra: {
    id: 'papra',
    name: 'Reedling',
    was: ['Papra'],
    // Asked for, with a reference sheet: Reedling, Papyruskin, Pressmere.
    description: 'Settlement task: press reeds and buckets of water from your settlement stores into papyrus at your paper presses. Output: sheets and the empty bucket to your settlement stores. Never fails.',
    stages: [
      { name: 'Papyruskin', description: '' },
      { name: 'Pressmere', description: '' },
    ],
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
    // [leaf-feathers, face]: the sheet's olive with cream, moss with pale gold, straw with white, and sage with peach.
    variants: [
      ['#8aa052', '#f2e2c0'],
      ['#5e7c3a', '#ecd8a0'],
      ['#a89c4c', '#f6f0e0'],
      ['#5f8c76', '#f4dcc4'],
    ],
    butcher: { meat: 2, fur: 2, leather: 2, bone: 1 },
  },
  glimmip: {
    id: 'glimmip',
    wound: 'cut',
    name: 'Glimmip',
    // Asked for, with a reference sheet: Glimmip, Glascade, Prismetail. Its words are written once the recipe is here (`STORE_WORDS`).
    description: '',
    stages: [
      { name: 'Glascade', description: '' },
      { name: 'Prismetail', description: '' },
    ],
    health: 18,
    attack: 2,
    speed: 2,
    tameLevel: 20,
    tameChance: 0.09,
    diet: ['worm', 'honey', 'peach', 'apricot'],
    baitHint: 'worms, honey, peaches or apricots',
    timid: true,
    gathers: 'glass',
    workRange: 6,
    // [scales, belly]: the sheet's mint with ivory, seafoam with cream, sky with pale peach, and sage with white.
    variants: [
      ['#9fd8c4', '#fbf0de'],
      ['#86ccb8', '#f6e6cc'],
      ['#a8cfe4', '#fbe8d8'],
      ['#b4d4a8', '#f8f4ea'],
    ],
    butcher: { meat: 2, scale: 4, leather: 1, bone: 2 },
    onSand: true,
    nearWater: true,
  },
  glossa: {
    id: 'glossa',
    name: 'Glossa',
    description: 'Settlement task: glaze each fired pot, bowl, jar and amphora in your settlement stores with ash from your settlement stores; glazed pottery never decays, as with an Artisan\'s glaze. Needs no Artisan learning.',
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
    butcher: { meat: 3, leather: 2, bone: 2 },
  },
  dippa: {
    id: 'dippa',
    name: 'Pailbara',
    was: ['Dippa'],
    // Asked for, with a reference sheet: Pailbara, Caskybara, Reservara.
    description: 'Settlement task: fill empty buckets from your settlement stores with water at the shore or a well; output to your settlement stores. Never spills.',
    stages: [
      { name: 'Caskybara', description: '' },
      { name: 'Reservara', description: '' },
    ],
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
      ['#c8945e', '#b89ad8'],
      ['#b8845a', '#e8a0b4'],
      ['#d4a676', '#f0e6c8'],
      ['#a87a56', '#a8b8e8'],
    ],
    butcher: { meat: 4, fur: 2, leather: 3, bone: 2 },
  },
  testa: {
    id: 'testa',
    name: 'Testa',
    description: `Tamed: ${STYLE_SAYS.shield}. Default stance: guarding you.`,
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
    butcher: { meat: 6, leather: 3, bone: 4 },
    hide: 'shell',
    defensive: true,
    defaultStance: 'guard',
    style: 'shield',
  },
  skulka: {
    id: 'skulka',
    name: 'Skulka',
    description: `Tamed: ${STYLE_SAYS.flank}.`,
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
    wound: 'bite',
    defensive: true,
    style: 'flank',
  },
  gasha: {
    id: 'gasha',
    name: 'Gasha',
    description: `Tamed: ${STYLE_SAYS.bleed}.`,
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
    wound: 'cut',
    defensive: true,
    style: 'bleed',
  },
  thumpa: {
    id: 'thumpa',
    name: 'Pebbletooth',
    was: ['Thumpa'],
    description: `Tamed: ${STYLE_SAYS.stun}.`,
    stages: [
      { name: 'Shaleclaw', description: '' },
      { name: 'Cragjaws', description: '' },
    ],
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
      ['#a08a6c', '#e2d2b4'],
      ['#7a7e84', '#cfcbc0'],
      ['#9c7650', '#e4cca8'],
      ['#55504c', '#b4aa9a'],
    ],
    butcher: { meat: 6, leather: 4, bone: 5 },
    wound: 'crush',
    defensive: true,
    style: 'stun',
  },
  spitta: {
    id: 'spitta',
    name: 'Spitta',
    description: `Wild: venomous bite. Tamed: ${STYLE_SAYS.venom}.`,
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
    butcher: { meat: 3, leather: 2, bone: 2, gland: 2 },
    wound: 'pierce',
    defensive: true,
    venom: true,
    style: 'venom',
  },
  awla: {
    id: 'awla',
    name: 'Awla',
    description: `Tamed: ${STYLE_SAYS.bore}.`,
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
    wound: 'pierce',
    defensive: true,
    style: 'bore',
  },
  sparra: {
    id: 'sparra',
    name: 'Dummicub',
    was: ['Sparra'],
    description: `Tamed: ${STYLE_SAYS.spar}.`,
    stages: [
      { name: 'Dummibear', description: '' },
      { name: 'Dummititan', description: '' },
    ],
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
    // Its straw-fur and the pink of its target and wraps: caramel with rose, honey with coral, russet with raspberry, and flax
    // with a blue target. Its cream patches, dark pads, leaves and rope are the same on every one.
    variants: [
      ['#c99a62', '#e2808c'],
      ['#dcb478', '#e98f74'],
      ['#a87850', '#cf6680'],
      ['#d6c08e', '#88a8cc'],
    ],
    butcher: { meat: 5, leather: 3, bone: 3 },
    wound: 'crush',
    style: 'spar',
    learns: { skill: 'fighting', by: 'spar' },
  },
  lungra: {
    id: 'lungra',
    name: 'Blushkit',
    was: ['Lungra'],
    description: `Tamed, ${abilityName('beastmaster_pounce')}: ${abilitySays('beastmaster_pounce')}.`,
    stages: [
      { name: 'Briarpounce', description: '' },
      { name: 'Thornlance', description: '' },
    ],
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
    // Its fur and its sage patches: cream with sage, blush with mint, white with fern, and fawn with olive. Its pink leaves are
    // the same blush on every one.
    variants: [
      ['#f0dcc2', '#9cb07a'],
      ['#f0c8bc', '#8fb39a'],
      ['#fbf6ee', '#7fa068'],
      ['#e2c6a4', '#a6ab6c'],
    ],
    butcher: { meat: 5, fur: 3, leather: 3, bone: 3 },
    wound: 'bite',
    defensive: true,
    ability: 'beastmaster_pounce',
  },
  hamma: {
    id: 'hamma',
    name: 'Hamma',
    description: `Tamed, ${abilityName('blade_hamstring')}: ${abilitySays('blade_hamstring')}.`,
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
    wound: 'cut',
    defensive: true,
    ability: 'blade_hamstring',
  },
  crakka: {
    id: 'crakka',
    name: 'Crakka',
    description: `Tamed, ${abilityName('berserker_skull_crack')}: ${abilitySays('berserker_skull_crack')}.`,
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
    wound: 'crush',
    defensive: true,
    ability: 'berserker_skull_crack',
  },
  bashka: {
    id: 'bashka',
    name: 'Bashka',
    description: `Tamed, ${abilityName('blade_shield_bash')}: ${abilitySays('blade_shield_bash')}.`,
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
    wound: 'crush',
    defensive: true,
    ability: 'blade_shield_bash',
  },
  executa: {
    id: 'executa',
    name: 'Executa',
    description: `Tamed, ${abilityName('berserker_execute')}: ${abilitySays('berserker_execute')}.`,
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
    wound: 'cut',
    defensive: true,
    ability: 'berserker_execute',
  },
  whirla: {
    id: 'whirla',
    name: 'Whirla',
    description: `Tamed, ${abilityName('berserker_whirlwind')}: ${abilitySays('berserker_whirlwind')}.`,
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
    wound: 'cut',
    defensive: true,
    ability: 'berserker_whirlwind',
  },
  scorcha: {
    id: 'scorcha',
    name: 'Scorcha',
    description: `Tamed, ${abilityName('kindler_scorch')}: ${abilitySays('kindler_scorch')}.`,
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
    butcher: { meat: 4, leather: 3, bone: 3 },
    wound: 'burn',
    defensive: true,
    ability: 'kindler_scorch',
  },
  frosta: {
    id: 'frosta',
    name: 'Frosta',
    description: `Tamed, ${abilityName('frost_breath')}: ${abilitySays('frost_breath')}.`,
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
    wound: 'bite',
    defensive: true,
    ability: 'frost_breath',
  },
  rootle: {
    id: 'rootle',
    name: 'Rootle',
    description: `Tamed, ${abilityName('binder_root')}: ${abilitySays('binder_root')}.`,
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
    wound: 'pierce',
    defensive: true,
    ability: 'binder_root',
  },
  dulla: {
    id: 'dulla',
    name: 'Dulla',
    description: `Tamed, ${abilityName('binder_dull_claws')}: ${abilitySays('binder_dull_claws')}.`,
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
    wound: 'bite',
    defensive: true,
    ability: 'binder_dull_claws',
  },
  brittla: {
    id: 'brittla',
    name: 'Brittla',
    description: `Tamed, ${abilityName('binder_brittle')}: ${abilitySays('binder_brittle')}.`,
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
    butcher: { meat: 3, leather: 2, bone: 3 },
    wound: 'cut',
    defensive: true,
    ability: 'binder_brittle',
  },
  shova: {
    id: 'shova',
    name: 'Shova',
    description: `Tamed, ${abilityName('pikeman_keep_away')}: ${abilitySays('pikeman_keep_away')}.`,
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
    wound: 'crush',
    defensive: true,
    ability: 'pikeman_keep_away',
  },
  howla: {
    id: 'howla',
    name: 'Howla',
    description: `Tamed, ${abilityName('blade_guardians_call')}: ${abilitySays('blade_guardians_call')}.`,
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
    wound: 'bite',
    defensive: true,
    ability: 'blade_guardians_call',
  },
  marka: {
    id: 'marka',
    name: 'Marka',
    description: `Tamed, ${abilityName('skirmisher_marked_for_death')}: ${abilitySays('skirmisher_marked_for_death')}.`,
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
    wound: 'cut',
    defensive: true,
    ability: 'skirmisher_marked_for_death',
  },
  wardo: {
    id: 'wardo',
    name: 'Wardo',
    description: `Tamed, ${abilityName('warder_ward')}: ${abilitySays('warder_ward')}.`,
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
    wound: 'bite',
    defensive: true,
    ability: 'warder_ward',
  },
  stona: {
    id: 'stona',
    name: 'Zephlet',
    was: ['Stona'],
    description: `Tamed, ${abilityName('warder_stoneskin')}: ${abilitySays('warder_stoneskin')}.`,
    stages: [
      { name: 'Galecrest', description: '' },
      { name: 'Tempestwyrm', description: '' },
    ],
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
    // Its back and blue feathers, and its peach ones: powder blue with peach, lilac with rose, seafoam with apricot, and dusk
    // blue with sand.
    variants: [
      ['#8fb0d6', '#f4b496'],
      ['#ac9ed8', '#f0a2b2'],
      ['#8ec6c0', '#f4c48e'],
      ['#8492b8', '#eec09e'],
    ],
    butcher: { meat: 5, leather: 3, bone: 4 },
    wound: 'crush',
    defensive: true,
    ability: 'warder_stoneskin',
  },
  leecha: {
    id: 'leecha',
    name: 'Leecha',
    description: `Tamed, ${abilityName('chirurgeon_leech')}: ${abilitySays('chirurgeon_leech')}.`,
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
    wound: 'pierce',
    defensive: true,
    ability: 'chirurgeon_leech',
  },
  whispet: {
    id: 'whispet',
    // Asked for: "Add a Halloween event wildermon only available October 15-november 15. Combat creature, has a fear
    // ability on cooldown". Its words, and each stage's, are written once every number is here (`sayLine`).
    name: 'Whispet',
    description: '',
    stages: [
      { name: 'Lanternveil', description: '' },
      { name: 'Hallowmire', description: '' },
    ],
    health: 28,
    attack: 5,
    speed: 2.0,
    tameLevel: 28,
    tameChance: 0.06,
    diet: ['apple', 'nuts', 'acorn'],
    baitHint: 'an apple or nuts',
    timid: false,
    gathers: 'guard',
    workRange: 10,
    variants: [
      // Its body and the wisps of its hem, curls and tail: pearl white with lavender, moon-white with a pale blue-violet,
      // ivory with rose-lilac, and a pale mint-white with violet. Its hat, pumpkins and lanterns are the same on all four.
      ['#f6f3fb', '#ae94e4'],
      ['#eef2fb', '#98a2e6'],
      ['#fbf6ea', '#d29ad6'],
      ['#eef8f2', '#9478d8'],
    ],
    // Nothing in it but what a gland is made of: no meat, hide, bone or fur on a ghost.
    butcher: { gland: 3 },
    wound: 'crush',
    defensive: true,
    nocturnal: true,
    season: HALLOW_SEASON,
    ability: 'fear',
  },
  // ---- Backs and saddles. ----
  bura: {
    id: 'bura',
    hide: 'thick',
    wound: 'crush',
    name: 'Bura',
    description: 'Panniers: {pannier} items on its back.',
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
    defensive: true,
    pannier: 200,
    learns: { skill: 'body_strength', by: 'out' },
  },
  gorral: {
    id: 'gorral',
    wound: 'crush',
    name: 'Gorral',
    description: 'Mount: climbing counts ×{pitch} toward the slopes it takes a rider up.',
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
    name: 'Finlet',
    was: ['Wadd'],
    // Asked for, with a reference sheet: Finlet, Reeffin, Tideharvest. Its words, and each stage's, are written once
    // every number they read is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Reeffin', description: '' },
      { name: 'Tideharvest', description: '' },
    ],
    health: 40,
    attack: 6,
    speed: 2.2,
    tameLevel: 38,
    tameChance: 0.07,
    diet: ['meat', 'reed', 'nuts'],
    baitHint: 'meat or reeds',
    timid: false,
    variants: [
      ['#2c3a66', '#f4ead6'],
      ['#3e4a58', '#eef0ee'],
      ['#22545c', '#f2e6cc'],
      ['#4c3c5e', '#f6e4da'],
    ],
    butcher: { meat: 9, feather: 6, leather: 6, bone: 7, gland: 2 },
    nearWater: true,
    defensive: true,
    draught: true,
    mount: 14,
    swims: true,
    gathers: 'fish',
    workRange: 10,
  },
  springlet: {
    id: 'springlet',
    wound: 'bite',
    name: 'Springlet',
    // Asked for, with a reference sheet: Springlet, Springsail, Tidecourser. "A water mount that walks very slowly on land
    // (unmounted player walking speed .5) but operates same speed as a hare mount when swimming in water. Rarely found,
    // only spawns in deep water. Eats fish. Requires saddle and bridle to mount like land mount". Its words, and each
    // stage's, are written once every number they read is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Springsail', description: '' },
      { name: 'Tidecourser', description: '' },
    ],
    health: 45,
    attack: 6,
    // On land, under a rider or not, half a walker's pace (`SPRINGLET_LAND`); in water a Thistlekit's (`swimSpeed`, set below).
    speed: SPRINGLET_LAND * BASE_SPEED,
    tameLevel: 40,
    tameChance: 0.05,
    // Every fish a line brings up, raw, and cooked fish.
    diet: [...FISH.map((f) => f.id), 'cooked_fish'],
    baitHint: 'fish',
    timid: false,
    gathers: null,
    workRange: 6,
    variants: [
      // Cream with pink fins, as drawn; pearl with sea-blue, warm cream with coral, and pearl with lavender.
      ['#f6ecdc', '#f2a0b4'],
      ['#eef0f0', '#86bfdc'],
      ['#f8ead2', '#f2a07a'],
      ['#f0eaf2', '#b49ad8'],
    ],
    butcher: { meat: 10, leather: 8, bone: 7, gland: 2 },
    defensive: true,
    mount: 12,
    swims: true,
    deepWater: true,
  },
  shaggan: {
    id: 'shaggan',
    hide: 'thick',
    heavy: true,
    wound: 'crush',
    name: 'Shaggan',
    description: 'Traces: team pace +{pull:pct} (most wildermon: +{pullDefault:pct}). Slowest of the draught wildermon.',
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
    defensive: true,
    draught: true,
    pull: 0.45,
  },
  // ---- Eyes, produce and the rare sort. ----
  warda: {
    id: 'warda',
    wound: 'cut',
    name: 'Skylooklet',
    was: ['Warda'],
    // Asked for: "This family to replace warda". Its words, and each stage's, are written once every number is here (`sayLine`).
    description: '',
    stages: [
      { name: 'Skywarden', description: '' },
      { name: 'Skyrange', description: '' },
    ],
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
      // Fawn with cream, tawny brown with cream, pale sand with white, dusky grey-brown with pale grey: the coat and the throat, chest
      // and belly. Its blue crest and flight feathers are its own, the same on every one.
      ['#a8703c', '#f0dcb8'],
      ['#7e4e2a', '#ead2aa'],
      ['#c4a272', '#fbf8f0'],
      ['#6a5c52', '#cdcac4'],
    ],
    butcher: { meat: 4, feather: 5, leather: 2, bone: 3, gland: 1 },
    defensive: true,
    sight: 18,
    learns: { skill: 'awareness', by: 'out' },
  },
  quill: {
    id: 'quill',
    wound: 'pierce',
    name: 'Quill',
    description: 'Pluck with a carving knife for feathers.',
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
    fleece: 1 / 700,
    shearYield: 'feather',
    learns: { skill: 'animal_husbandry', by: 'tended' },
  },
  cudda: {
    id: 'cudda',
    wound: 'crush',
    name: 'Cudda',
    description: 'Milk a female into an empty bucket.',
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
    fleece: 1 / 600,
    milk: true,
    learns: { skill: 'animal_husbandry', by: 'tended' },
  },
  vesp: {
    id: 'vesp',
    wound: 'pierce',
    venom: true,
    name: 'Buzzlet',
    was: ['Vesp'],
    // Asked for, with a reference sheet: Buzzlet, Combworker, Hivemaster.
    description: 'Settlement task: the nearest hive with room within its reach of the totem. Per go: one wildflower tile within {skepReach} tiles of the hive, in turn, and back. Honey into the hive: a honey per {skepHours} hours worked per wildflower clump within {skepReach} tiles, as a skep there; a beeswax per {skepWax} honey; none in {skepIdle}. Defends it.',
    stages: [{ name: 'Combworker', description: '' }, { name: 'Hivemaster', description: '' }],
    health: 12,
    attack: 3,
    speed: 2.4,
    tameLevel: 18,
    tameChance: 0.1,
    diet: ['blueberry', 'raspberry', 'strawberry', 'honey'],
    baitHint: 'berries or honey',
    timid: false,
    // Its trade: set to work the deed, it works the hives there as bees work a skep (asked: "Vesp work hives like bees for their deed trade, producing honey").
    gathers: 'hive',
    workRange: 8,
    variants: [
      ['#f4c22c', '#5e3a1c'],
      ['#f6dc84', '#3a3433'],
      ['#eaa040', '#53301f'],
      ['#efe6cf', '#7b5236'],
    ],
    butcher: { meat: 1, gland: 3 },
    defensive: true,
    hives: true,
  },
  snout: {
    id: 'snout',
    name: 'Dirtlet',
    was: ['Snout'],
    // Asked for: a badger line to replace the snout: Dirtlet, Tunnelclaw, Earthrend. Its words, and each stage's, are written
    // once every number is here.
    description: '',
    stages: [
      { name: 'Tunnelclaw', description: '' },
      { name: 'Earthrend', description: '' },
    ],
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
      ['#6b5444', '#f1ead9'],
      ['#4d4744', '#ebe7e0'],
      ['#8c6440', '#f3e2c2'],
      ['#34302c', '#d9d2c3'],
    ],
    butcher: { meat: 4, fur: 3, leather: 3, bone: 3, gland: 3 },
  },
  lume: {
    id: 'lume',
    wound: 'burn',
    name: 'Lume',
    description: 'Lights {glow} tiles round itself at any hour. Out only after dark.',
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
    description: '',
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
    description: '',
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
    description: '',
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
    description: '',
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
    hunter: true,
    defensive: true,
    glow: 5,
    defaultStance: 'aggressive',
  },
};
// Asked for: a Springlet "operates same speed as a hare mount when swimming in water": in water, a Thistlekit's pace.
SPECIES.springlet.swimSpeed = SPECIES.orse.speed;
// The journal's goals name kinds by what they are called (`journal-b.ts`).
kindNames(SPECIES);

/** A beast's share of a team's pull when it was not bred for the traces. */
export const PULL_DEFAULT = 0.25;
/** No mount carries a rider faster than this. */
export const MAX_MOUNT_SPEED = 5;
/** Why a rider a storey up does not get down there: mounted and dismounted on the ground floor only. The island's `ride_refusal`. */
export const MOUNT_STOREY_SAID = 'Ride to the ground floor first: mount and dismount on the ground only.';
/** Why a mount is not mounted: you, or it, off the ground floor (the island's `mount_ground_said`). */
export const mountGroundSaid = (who: string, level: number): string =>
  `Mount: ground floor only. ${who}: ${level < 0 ? 'cellar' : `storey ${level + 1}`}.`;
/** What a mounted walk to a storey your own feet would reach says (`Game.rideRule`). */
export const MOUNT_STAIRS_SAID = 'Dismount first: mounts take wide staircases and wide doorways only.';
/** What practice on bad ground is worth to a beast's pace, from its climbing. */
export const footing = (climb: number): number => 0.9 + climb / 140;
/**
 * Whether a tile is in water, for a kind with a pace of its own there (`swimSpeed`): water stands over the middle of its
 * bed, the sea's or a pond's, however shallow. The island's `water_over`.
 */
export const waterOver = (w: World, x: number, y: number): boolean => w.bedCenter(x, y) < w.surfaceAt(x, y);
/** Whether a kind with a pace of its own in water goes at its land pace here, flat under a rider (`Game.mountSpeed`). */
export const landRidden = (def: SpeciesDef, w: World, x: number, y: number): boolean =>
  def.swimSpeed !== undefined && !waterOver(w, x, y);
/**
 * Whether a tile is ground a kind of the deep water (`deepWater`) is put down on, and keeps to in the wild: on the
 * island, not on piers, and water over it deeper than a swimmer's depth (`SWIM_DEPTH`), measured at its middle. The
 * island's `deep_tile`.
 */
export function deepTile(game: Game, x: number, y: number): boolean {
  const w = game.world;
  if (!w.inBounds(x, y)) return false;
  if (game.buildings.pierTiles.size && game.buildings.onPiers(x, y)) return false;
  return w.bedCenter(x, y) < w.surfaceAt(x, y) - SWIM_DEPTH;
}

/**
 * A mender's go at a damaged thing in the stores (`mendStep`): this much damage off it and one more for every
 * `MEND_DMG_LEVELS` of its repair, and this much quality lost with it less one for every `MEND_QL_LEVELS`, never under
 * `MEND_QL_LEAST`; a go takes what a go at any trade does (`workDuration`). The island's errand mends by the same numbers.
 */
export const MEND_DMG = 2;
export const MEND_DMG_LEVELS = 12;
export const MEND_QL = 0.6;
export const MEND_QL_LEVELS = 220;
export const MEND_QL_LEAST = 0.05;
// A species says what it carries and pulls off its own row.
for (const s of Object.values(SPECIES)) {
  s.description = fill(s.description, {
    ...s, pullDefault: PULL_DEFAULT, careWanting: CARE_WANTING, dairyFull: DAIRY_FULL, healBelow: HEAL_BELOW, tanLye: TAN_LYE,
    grassPerCut: GRASS_PER_CUT, mossPerCut: MOSS_PER_CUT, panLeast: PAN_FIND[0], panMost: PAN_FIND[1], skillTop: SKILL_TOP, resinTapped: RESIN_TAPPED,
    skepReach: SKEP_REACH, skepHours: SKEP_CLUMP_HOURS, skepWax: SKEP_WAX_EVERY, skepIdle: SKEP_IDLE,
  });
}
/**
 * The words of the trades worked off a recipe or a mould, read off it when asked for rather than when this module
 * loads, so the recipes are there to be read: how many each makes of what, and the tool your own hands would want that
 * a worker does without.
 */
const STORE_WORDS: Record<string, () => string> = {
  ulva: () => `Settlement task: spin ${spinFibres()} in your settlement stores into yarn at your spindles, ${spinSays()}. No spinning tool needed. Output: your settlement stores. Never fails.`,
  dowse: () => `Found only on ground with metal under it. Settlement task: ${smithSays('nail')}. No mould or hammer needed. Output: your settlement stores. Never fails.`,
  siffa: () => `Settlement task: ${smithSays('ribbon')}. No mould or hammer needed. Output: your settlement stores. Never fails.`,
  rippa: () => `Settlement task: saw each log in your settlement stores into planks, ${recipeMakes('make_planks')} a log. No saw needed. Output: your settlement stores. Never spoils a log.`,
  chissa: () => `Settlement task: chisel each rock shard in your settlement stores into stone brick, ${recipeMakes('make_stone_brick')} a shard. No chisel needed. Output: your settlement stores. Never spoils a shard.`,
  cordra: () => `Settlement task: make rope from wemp in your settlement stores, ${recipeTakes('make_rope', 'wemp')} fibres a rope. No rope tool needed. Output: your settlement stores. Never fails.`,
  flecha: () => `Settlement task: fletch arrows from shafts, arrowheads and feathers in your settlement stores, ${recipeMakes('make_arrows')} a shaft, ${recipeTakes('make_arrows', 'arrow_head')} heads and ${recipeTakes('make_arrows', 'feather')} feathers. No carving knife needed. Output: your settlement stores. Never spoils a shaft.`,
  potta: () => `Settlement task: empty your kilns into your settlement stores and load them from your settlement stores, up to capacity. Loads: ${kilnLoads()}. Does not light or fuel them.`,
  simma: () => `Settlement task: cook from your settlement stores at your lit campfires and ovens, recipes tried in list order. No ${listedOr(cookTools())} needed. Output: your settlement stores. Never burns.`,
  glimmip: () => `Settlement task: ${glassSays()}. Any lit smelter, charged or not. Does not light or fuel it. Output: your settlement stores. Never fails.`,
};
for (const [id, words] of Object.entries(STORE_WORDS)) Object.defineProperty(SPECIES[id], 'description', { get: words, enumerable: true, configurable: true });
/**
 * A line whose words read a mould or a recipe: its words and each stage's, written when asked for, as `STORE_WORDS`
 * are, and the way `sayLine` writes them.
 */
function sayLineLater(id: string, level: string): void {
  const d = SPECIES[id];
  const words = STORE_WORDS[id];
  const names = [d.name, d.stages![0].name, d.stages![1].name] as const;
  const at = (stage: 0 | 1 | 2): PropertyDescriptor => ({
    get: () => lineSays(names, words(), level, stage, true, !!d.fleece, stage ? d.gathers : null, stage === 2 ? id : ''),
    enumerable: true, configurable: true,
  });
  Object.defineProperty(d, 'description', at(0));
  d.stages!.forEach((st, i) => Object.defineProperty(st, 'description', at((i + 1) as 1 | 2)));
}
sayLineLater('dowse', 'Level: blacksmithing.');
sayLineLater('siffa', 'Level: blacksmithing.');
sayLineLater('ulva', 'Level: tailoring.');
sayLineLater('rippa', 'Level: carpentry.');
sayLineLater('potta', 'Level: pottery.');
sayLineLater('glimmip', 'Level: glassblowing.');

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
/**
 * What a kind of wildermon was called before it was renamed, by its id, off its `was`: a wild one stood up under the old name keeps
 * it as its own until it is called something else, so one tamed since was still a Rabba. A name that is its kind's
 * old one is its kind's name now (`renamedKind`, in a save; the island's migration, on an island).
 */
export const FORMER_NAME: Record<string, string> = Object.fromEntries(
  Object.values(SPECIES).filter((s) => s.was?.length).map((s) => [s.id, s.was![0]]),
);
/**
 * Whether what it is called is only one of its kind's own names -- its kind's, a stage's, or one its kind went by
 * before (`was`) -- so that nobody has named it. The island's `kind_named`.
 */
export function kindNamed(c: Pick<Creature, 'species' | 'name'>): boolean {
  const d = SPECIES[c.species];
  return !!d && (c.name === d.name || !!d.stages?.some((st) => st.name === c.name) || !!d.was?.includes(c.name));
}
/**
 * Its name, or, where nobody has named it, what its kind is called at the stage it is at: one stood up a Pigroot that
 * is a Harvestusk now is called a Harvestusk (asked for: "Stage 3 evolutions that never had a name change should have
 * their names updated as they evolve"), and one stood up under its kind's old name its kind's name now.
 */
export const renamedKind = (c: Pick<Creature, 'species' | 'name' | 'skills'>): string => (kindNamed(c) ? kindName(c) : c.name);

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
  // Asked for: "Rarely found, only spawns in deep water" (`deepWater`).
  ['springlet', 1],
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
  // Asked for: a glass gecko found on sand near water.
  ['glimmip', 4],
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
  // Only out after dark and only in its season, so put down twice as often as the kinds with an ability that are out
  // all year whenever it may be.
  ['whispet', 4],
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
export const HEARTH_FULL = 600;
/**
 * The fuel a stoker takes first, best first, out of all your settlement stores; any other fuel after these, nearest
 * store first (`stokeRank`). The island's `stoke_rank`.
 */
export const STOKE_FIRST = ['tar', 'peat', 'coal'] as const;
export const stokeRank = (id: string): number => {
  const i = (STOKE_FIRST as readonly string[]).indexOf(id);
  return i < 0 ? STOKE_FIRST.length : i;
};
/**
 * The stage (`stageOf`) from which a stoker also does a smelter worker's work when no hearth wants fuel (or there is no
 * fuel for it): your smelters emptied into your settlement stores, then charged with ore from them (`furnaceStep`).
 * Its second. The island's `stoke_smelts_at`.
 */
export const STOKE_SMELTS_AT = 1;
/** A deed worker goes looking for a meal once its belly is down to this. */
export const HUNGRY = 0.25;
/** What a clearer takes off the ground to turn into compost: a carcass, or anything this damaged or worse. */
export const ROT_DMG = 40;
export const isRotting = (it: Pick<Item, 'id' | 'dmg'>): boolean => it.id === 'corpse' || it.dmg >= ROT_DMG;

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
const ERRAND_JOBS = new Set<GatherKind>(['water', 'hod', 'mend', 'plant', 'prospect', ...TEND_JOBS]);
const INDOOR_JOBS = new Set<GatherKind>(['woodcut', 'farm', 'mine', 'sand', 'clay', 'quarry', 'stoke', 'fetch', 'guard', 'hunt', 'water', 'prospect', 'plant', 'hod', 'mend', 'compost', 'seek', 'prune', 'stump', ...TEND_JOBS, 'bush', 'grass', 'pan', 'worm', 'sprout', 'resin', 'flower', 'scrub']);
export const wildGather = (species: SpeciesDef): GatherKind | null => (species.gathers && INDOOR_JOBS.has(species.gathers) ? 'forage' : species.gathers);
/** The task skill a species trains, if it has a job. */
export const workSkill = (species: SpeciesDef): string | null => (species.gathers ? GATHER_SKILL[species.gathers] : null);
/** Every ten levels of its task skill let a worker range ten tiles further from the token. */
export const SKILL_STEP = 10;
/**
 * A worker more than this many tiles past the ground it works walks back to it before taking up its trade, this many
 * tiles a leg: the island's `home_slack` and `home_leg` (`errandhome` holds the two sides to one number).
 */
export const HOME_SLACK = 8;
export const HOME_LEG = 2;
export const RANGE_PER_STEP = 10;
export const rangeSteps = (skill: number): number => Math.floor(skill / SKILL_STEP);
/** A worker's task skill, or 0 for a species with no job. */
export function taskSkill(c: Creature, species: SpeciesDef): number {
  const id = workSkill(species);
  return id ? (c.skills[id] ?? 1) : 0;
}
/** A guard's level line: what teaches it, wild creatures and a Sparra's line on the settlement. */
export const GUARD_LEVEL = `Level: ${GATHER_SKILL.guard.replace(/_/g, ' ')}, learned per attack on a wild creature while guarding a settlement or sparring with ${article(SPECIES.sparra.name)} ${SPECIES.sparra.name} on the settlement.`;
// The words of each line that evolves, and its stages', now that every number they read is here.
/** A stoker's fuel order (`STOKE_FIRST`), as its words and What's new say it. */
export const STOKE_SAYS = `Fuel order: ${STOKE_FIRST.map((id) => FUELS.find((f) => f.id === id)!.said).join(', ')}, then any other.`;
/** What a stoker does from `STOKE_SMELTS_AT` on, as its stages' words say it. */
export const STOKE_SMELT_SAYS = 'No hearth to fuel, or no fuel: empties your smelters into your settlement stores, then charges them with ore from your settlement stores.';
const reach = (id: string): string =>
  `within ${SPECIES[id].workRange} tiles of the totem, +${SPECIES[id].rangePerStep ?? RANGE_PER_STEP} per ${SKILL_STEP} levels`;
const yieldQl = (skill: string): string => `${percent(DIG_QL[0])}–${percent(DIG_QL[1])} of its ${skill}, raised by yield traits, max 100`;
sayLine('rabba', `Settlement task: forage ${reach('rabba')}; output to the crate.`, 'Level: foraging.');
sayLine('vola', `Settlement task: botanize ${reach('vola')}; output to the crate.`, 'Level: botanizing.');
sayLine('woola', `Shear with a carving knife from ${percent(SHEAR_FROM)} fleece regrowth: up to ${SHEAR_WOOL} wool when full. Regrowth, grown: ${Math.round(1 / SPECIES.woola.fleece! / 60)} minutes.`,
  `Level: animal husbandry, learned ${LEARNS_SAYS.tended}.`);
sayLine('seavic', `Settlement task: sow, tend and harvest your tilled fields ${reach('seavic')}; seed from the crate, harvest and unused seed back to it. Does not till.`,
  'Level: farming.');
sayLine('quarra', `Settlement task: cut rock shards from bare rock with no seam ${reach('quarra')}; output home.`, 'Level: mining.');
sayLine('mola', `Settlement task: mine the nearest ore seam ${reach('mola')}, QL up to its mining and the seam's; output home. Skips metals above its mining: ${listed(METALS.filter((m) => m.level > 1).map((m) => `${m.name.toLowerCase()} ${m.level}`))}.`,
  'Level: mining.');
sayLine('bevere', `Settlement task: fell trees ${reach('bevere')}, as many bites a tree as a person's swings; a stump is left where the tree had timber. Log QL: ${yieldQl('woodcutting')}. Every log of the tree to your settlement stores.`,
  'Level: woodcutting.');
sayLine('orse', `Mount, saddled and bridled: ${+(SPECIES.orse.speed * footing(0)).toFixed(2)} tiles a second grown and fed at 0 climbing, +${percent(1 / 140 / footing(0))} per climbing level, max ${MAX_MOUNT_SPEED} tiles a second before a Saddler's tack. Higher climbing: steeper ground. Traces of a large cart or wagon: team pace +${percent(SPECIES.orse.pull ?? PULL_DEFAULT)}.`,
  'Level: climbing, learned under a rider and in the traces.');
sayLine('wadd', `Settlement task: fish ${reach('wadd')}; the catch home. Mount, saddled and bridled: crosses deep water with a rider. Traces of a large cart or wagon: team pace +${percent(SPECIES.wadd.pull ?? PULL_DEFAULT)}.`,
  'Level: fishing.');
sayLine('springlet', `Mount, saddled and bridled: on land ${+SPECIES.springlet.speed.toFixed(2)} tiles a second, flat; in water ${+(SPECIES.springlet.swimSpeed! * footing(0)).toFixed(2)} tiles a second grown and fed at 0 climbing, +${percent(1 / 140 / footing(0))} per climbing level, max ${MAX_MOUNT_SPEED} tiles a second before a Saddler's tack. Crosses deep water with a rider. Wild: only in deep water.`,
  'Level: climbing, learned under a rider.');
sayLine('roxxen', `No settlement task. Traces of a large cart or wagon: team pace +${percent(SPECIES.roxxen.pull!)} (wildermon not bred for it: +${percent(PULL_DEFAULT)}); its driving counts as climbing for team pace and the steepest step the wheels take.`,
  `Level: driving, learned ${LEARNS_SAYS.pull}.`);
sayLine('tinka', `Settlement task: mend damaged gear in your settlement stores, most damaged first. Time per action: ${Math.round(workDuration(1))} seconds at level 1, ${Math.round(workDuration(SKILL_TOP))} at level ${SKILL_TOP}, less for care. Per action: damage −${MEND_DMG}, 1 more per ${MEND_DMG_LEVELS} levels; QL −${MEND_QL}, 0.1 less per ${MEND_QL_LEVELS / 10} levels, min ${MEND_QL_LEAST}.`,
  'Level: repair.');
sayLine('holla', `Settlement task: fill a bladder at the shore or a well ${reach('holla')}, ${BUCKET_LITRES} litres a bucket; poured into a settlement barrel with room for water.`,
  'Level: carrying.');
sayLine('sedra', `Settlement task: cut reed beds ${reach('sedra')}, from the bank. Reeds per cut: 1, +1 per ${REED_LEVELS} levels. QL: ${percent(DIG_QL[0])}–${percent(DIG_QL[1])} of its foraging +1, max 100. Output to the crate.`,
  'Level: foraging.');
sayLine('cobbe', `Settlement task: carry what planned building work still wants from your settlement stores, crates and furniture, ${reach('cobbe')}, 1 piece a trip, and fit it as a builder's action: walls and columns standing on their storey; floors, roofs, staircases and ladders from the storey under; bridge or aqueduct spans, foundations. A storey up: by finished staircases from their foot, over finished floors, through doorways; no ladders. Order: where the carried piece is wanted, else the nearest work wanting something in your settlement stores; of that work's wants, the one furthest behind its bill. Carried piece no work in range wants: back to your settlement stores.`,
  'Level: masonry.');
sayLine('embra', `Settlement task: keep your campfires, ovens, braziers, smelters and kilns fuelled and lit, ${reach('embra')}: under ${HEARTH_FULL / 60} minutes of fuel, it carries 1 piece of fuel from your settlement stores to the nearest, whole pieces that fit only, and relights it if out (brazier: after dark). ${STOKE_SAYS} Eats only cooked food.`,
  'Level: smelting.', STOKE_SMELT_SAYS);
sayLine('noot', `Settlement task: collect clay off clay ground ${reach('noot')}, 1 lump a collect. QL: ${yieldQl('digging')}. Output to the crate.`,
  'Level: digging.');
sayLine('crawler', `Settlement task: collect sand off sandy ground ${reach('crawler')}, 1 heap a collect. QL: ${yieldQl('digging')}. Output to the crate. Wild bite: venom, ${percent(VENOM_DRAIN)} of your health a second for ${VENOM_SECS} seconds unless dressed. Kept: ${percent(SPECIES.crawler.unruly!)} chance every ${NIP_EVERY} seconds to attack you when beside you. Strikes back every time.`,
  'Level: digging.');
sayLine('whispet', `Tamed, ${abilityName('fear')}: ${abilitySays('fear')}. Strikes back every time. Wild: after dark only, ${seasonSays(SPECIES.whispet.season!)} (UTC); none wild on other days. Tamed, kept or bred ones stay all year.`,
  GUARD_LEVEL);
sayLine('warda', `Sight for you, at your heel or keeping a settlement: ${SPECIES.warda.sight} tiles (most: ${KEPT_SIGHT}), −${percent(KEPT_NIGHT_LOSS / 2)} at the dead of night. Strikes back every time.`,
  `Level: awareness, learned ${LEARNS_SAYS.out}.`);
sayLine('rowl', `Wild: attacks on sight. Settlement task: hunt ${reach('rowl')}; carcasses home.`, 'Level: fighting.');
sayLine('bogga', `Settlement task: collect peat and tar from the bog ${reach('bogga')}; output home.`, 'Level: digging.');
sayLine('sappa', `Settlement task: plant sprouts where trees were cut, ${reach('sappa')}.`, 'Level: forestry.');
sayLine('wicka', `Settlement task: put a candle from your settlement stores in each of your lantern posts and pillars without one, ${reach('wicka')}; lights them after dark, puts them out by day.`,
  'Level: carrying.');
sayLine('sprigga', `Settlement task: pick sprouts off living trees ${reach('sprigga')}, each named for its tree; output home. A picked tree rests as long as a forage bed.`,
  'Level: forestry.');
sayLine('snout', `Settlement task: find buried relics and mark dig sites ${reach('snout')}.`, 'Level: archaeology.');
sayLine('thumpa', `Tamed: ${STYLE_SAYS.stun}.`, GUARD_LEVEL);
sayLine('lungra', `Tamed, ${abilityName('beastmaster_pounce')}: ${abilitySays('beastmaster_pounce')}.`, GUARD_LEVEL);
sayLine('stona', `Tamed, ${abilityName('warder_stoneskin')}: ${abilitySays('warder_stoneskin')}.`, GUARD_LEVEL);
// The seven lines asked for on 22–23 October: each one's words as its kind already says them, at every stage.
for (const [id, level] of [['magga', 'foraging'], ['grazza', 'foraging'], ['grubba', 'digging'], ['wurla', 'digging'],
  ['mudda', 'pottery'], ['dippa', 'carrying'], ['middun', 'farming']] as const) sayLine(id, SPECIES[id].description, `Level: ${level}.`);
for (const id of ['plucka', 'grista', 'relka', 'tanna']) sayLine(id, SPECIES[id].description, `Level: ${GATHER_SKILL[SPECIES[id].gathers!]}.`);
sayLine('vesp', SPECIES.vesp.description, 'Level: animal husbandry.');
sayLine('bedda', SPECIES.bedda.description, 'Level: farming.');
sayLine('petta', SPECIES.petta.description, 'Level: foraging.');
sayLine('kemma', SPECIES.kemma.description, 'Level: animal husbandry.');
sayLine('sheela', SPECIES.sheela.description, 'Level: animal husbandry.');
sayLine('papra', SPECIES.papra.description, 'Level: papyrusmaking.');
sayLine('ambra', SPECIES.ambra.description, 'Level: forestry.');
sayLine('snedda', SPECIES.snedda.description, 'Level: forestry.');
describeFrom('hive', { vesp: SPECIES.vesp.name });
describeGoals({ vesp: SPECIES.vesp.name });
describeFrom('compost', { compostMaker: `${article(SPECIES.middun.name)} ${SPECIES.middun.name}` });
// And the Sparra, which does not evolve: how it fights, its settlement task, and its level (`sparTaskSays`).
sayLine('sparra', `Tamed: ${STYLE_SAYS.spar}. ${sparTaskSays()}`, `Level: fighting, learned ${LEARNS_SAYS.spar}.`);

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
  // traces, which is what decides the pace of everything it is put in front of
  // (or, for a kind that learns by pulling, its own skill does: `tracesSkill`).
  if (species.draught) skills[tracesSkill(species)] = 1;
  // And a mount that is no draught beast learns climbing under a rider.
  else if (species.mount) skills[HAUL_SKILL] = 1;
  return skills;
};

/**
 * A saved book of skills, carried over to what its kind learns now. A Roxxen learned climbing in the traces until it
 * was given Driving to learn by pulling: one saved with climbing has it as driving instead, the higher of the two
 * where it somehow has both, so nobody's Roxxen comes back a level lower. The island moved its own the same way
 * (`20261019210000_a_roxxen_learns_driving_in_the_traces`).
 */
export function carriedSkills(species: SpeciesDef, saved: Record<string, number> | undefined): Record<string, number> {
  const skills = { ...startSkills(species), ...(saved ?? {}) };
  const traces = tracesSkill(species);
  if (traces !== HAUL_SKILL && skills[HAUL_SKILL] !== undefined) {
    skills[traces] = Math.max(skills[traces] ?? 0, skills[HAUL_SKILL]);
    delete skills[HAUL_SKILL];
  }
  return skills;
}

/**
 * Age. Everything alive on the island was born at some hour and gets older
 * from there. A young one is small, quick to trust and no use in the traces;
 * a grown one is what the numbers in the book describe; an old one has slowed
 * down and put on weight, which is bad for a cart and good for a butcher.
 */
export type Age = 'young' | 'grown' | 'old';
/** A day of the wall clock, in seconds: what life stages are counted in. */
export const REAL_DAY = 24 * 60 * 60;
/**
 * Seconds spent young, and the second it turns old. The days of each were scaled with the seasons when they were
 * lengthened (`SEASON_DAYS` over `SHORT_SEASON_DAYS`, asked for: "Scale life stages to match the 90-day seasons"), and
 * are counted in days of the wall clock rather than of the island's (asked for: "Change the age transitions of wildermon
 * to be real life days").
 */
export const AGE_SCALE = SEASON_DAYS / SHORT_SEASON_DAYS;
export const YOUNG_FOR = ((world(60 * 60) * AGE_SCALE) / DAY_SECONDS) * REAL_DAY;
export const OLD_AT = ((world(6 * 60 * 60) * AGE_SCALE) / DAY_SECONDS) * REAL_DAY;
/** How long it lives once old, and then it dies of old age: ninety days. The island's `old_for` and `old_age_sweep`. */
export const OLD_FOR = 90 * REAL_DAY;
/** How long a dam carries: half an island day. */
export const GESTATION = world(12 * 60);
/** How long after a covering either parent will look at another. */
export const BREED_REST = world(20 * 60);
// ---- Traits part B ----
/** How long a dam carries: `GESTATION`, a breeder's Quick Gestation and her blood (`gestation`). The island's `gestation_of`. */
export const gestationOf = (perk: number, dam: Creature): number => GESTATION * perk * bloodMul(dam, 'gestation');
/**
 * The chance a covering throws a second young: young per birth are one and a breeder's Twins, times the dam's blood
 * (`twins`), and what is past one is the chance. The island's `twin_chance`.
 */
export const twinChance = (perk: number, dam: Creature): number => Math.max(0, Math.min(1, (1 + perk) * bloodMul(dam, 'twins') - 1));
/** What a pair's blood does to the draw: the better parent's on each channel (`PairBlood`). The island's `pair_fresh` and `pair_mutate`. */
export const pairBlood = (dam: Creature, sire: Creature): PairBlood => ({
  fresh: Math.min(bloodMul(dam, 'fresh'), bloodMul(sire, 'fresh')),
  mutate: Math.max(bloodMul(dam, 'mutate'), bloodMul(sire, 'mutate')),
});

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
  // On an island, the island's word for it: the hour it was born is never sent, so the sum below would read every one grown.
  if (c.islandAge) return c.islandAge;
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
  care >= 0.75 ? 'well kept' : care >= CARE_WANTING ? 'kept' : care >= 0.12 ? 'needs brushing' : 'neglected';

/**
 * What its rarity makes of one channel: `RARITIES[rare].blood` times as good,
 * which is multiplied in where more is better and divided in where less is.
 */
export const rarityMul = (c: Pick<Creature, 'rare'>, channel: TraitChannel): number => {
  const ch = channelOf(channel);
  // Nothing on a channel out of the blood (`ChannelDef.blood`): only its traits' own figure moves it.
  if (!c.rare || ch?.blood === false) return 1;
  const k = rarityOf(c).blood;
  return ch?.up === false ? 1 / k : k;
};

/**
 * What a step of rarity does to a wildermon's blood, channel by channel, the
 * way a card prints a trait: "+20% speed, work, ... and healing, −17% upkeep,
 * damage taken and chance to be hit". Every channel its traits move, up where
 * more is better and down where less is, by the step's own figure.
 */
export function rarityEffects(c: Pick<Creature, 'rare'>): string {
  const k = rarityOf(c).blood;
  const up = BLOOD_CHANNELS.filter((ch) => ch.up).map((ch) => ch.label);
  const down = BLOOD_CHANNELS.filter((ch) => !ch.up).map((ch) => ch.label);
  return `${pct(k)} ${listed(up)}, ${pct(1 / k)} ${listed(down)}`;
}

/** What its rarity makes of it, for a card: nothing for an ordinary one. */
export function rarityLine(c: Pick<Creature, 'rare'>): string {
  if (!c.rare) return '';
  const r = rarityOf(c);
  return `${r.name[0].toUpperCase()}${r.name.slice(1)} · size ×${r.size} · ${rarityEffects(c)}`;
}

/** And as a sentence, for what is said when you look it over. */
export function raritySays(c: Pick<Creature, 'rare'>): string {
  if (!c.rare) return '';
  const r = rarityOf(c);
  return ` Rarity: ${r.name}, size ×${r.size}, ${rarityEffects(c)}.`;
}

/**
 * Ancient pots. A restored old pot used on a wildermon of yours puts one point
 * into one of its base stats, chosen at random among those not yet at
 * `POT_MOST`, and each point is `POT_STEP` more of that stat than its kind and
 * its blood would give it on their own: its health (the `hardy` channel), the
 * blow it lands (`tough`), its pace on its feet, under a rider and in the
 * traces (`speed`), and how quickly it gets a go of its task done (`work`).
 * They are the four figures every stage of evolving lifts (`STAGE_MUL`), and
 * the four every rule of fighting, travelling and working reads through its
 * blood, so a point goes wherever its blood goes. Asked for: "Old pot
 * increases one base stat randomly by 1 (max 10 per stat per wildermon)". The
 * island's `pot_step`, `pot_most` and `pot_mul`.
 */
export type BaseStat = 'hardy' | 'tough' | 'speed' | 'work';
export const BASE_STATS: ReadonlyArray<{ id: BaseStat; name: string; says: string }> = [
  { id: 'hardy', name: 'Health', says: 'max health' },
  { id: 'tough', name: 'Attack', says: 'blow damage' },
  { id: 'speed', name: 'Speed', says: 'pace on foot, under a rider and in the traces' },
  { id: 'work', name: 'Work', says: 'task speed' },
];
/** What each point an ancient pot puts into a stat is worth, over what its kind and blood give it. */
export const POT_STEP = 0.03;
/** The most points any one stat of one wildermon takes. */
export const POT_MOST = 10;
const BASE_STAT_IDS: ReadonlySet<string> = new Set(BASE_STATS.map((s) => s.id));
/** The points ancient pots have put into one of its stats, as many as there may be. */
export const potPoints = (c: Pick<Creature, 'boosts'>, stat: BaseStat): number =>
  Math.max(0, Math.min(POT_MOST, Math.floor(c.boosts?.[stat] ?? 0)));
/**
 * An ancient collar and an ancient bridle, each fitted once and for good, kept
 * in `boosts` beside the pot points (`collar`, `bridle`): the collar takes
 * `COLLAR_CUT` off its upkeep (`appetite`), and the bridle puts `BRIDLE_PACE`
 * on its speed ridden and in a team, past the cap as tack is (`tackSpeed`,
 * `bridleTeam`). Asked for: "Old collar, old bridle". The island's
 * `collar_cut`, `bridle_pace` and `fitted`.
 */
export type RelicFit = 'collar' | 'bridle';
export const COLLAR_CUT = 0.2;
export const BRIDLE_PACE = 0.1;
/**
 * An ancient brace: `BRACE_STEP` on a wildermon's action speed (`work`) a use,
 * up to `BRACE_MOST` uses, kept in `boosts.brace`. Asked for: "an Ancient Brace
 * that increases wildermon action speed by 1% per, up to 50 uses per
 * wildermon". The island's `brace_step`, `brace_most` and `brace_points`.
 */
export const BRACE_STEP = 0.01;
export const BRACE_MOST = 50;
/** What `boosts` keeps: pot points by stat, a collar and a bridle fitted, brace uses, and a bronze mirror's mark. */
export type BoostKey = BaseStat | RelicFit | 'brace' | 'mirror';
export const bracePoints = (c: Pick<Creature, 'boosts'>): number => Math.max(0, Math.min(BRACE_MOST, Math.floor(c.boosts?.brace ?? 0)));
export const fitted = (c: Pick<Creature, 'boosts'>, fit: RelicFit): boolean => (c.boosts?.[fit] ?? 0) > 0;
/**
 * A bronze mirror's mark, one at a time, kept in `boosts.mirror`: the young of
 * its next covering get its best trait (`mirrorTrait`) as it carries it, in
 * place of a draw, and the mark is used up at that covering. Asked for: "Copy a
 * trait to a newborn: at breeding, the newborn gets the parent's best trait at
 * that parent's value instead of rolling it. Used up on the birth." The
 * island's `mirrored` and `mirror_copy`.
 */
export const mirrored = (c: Pick<Creature, 'boosts'>): boolean => (c.boosts?.mirror ?? 0) > 0;
/** What a covering copies: each mirrored parent's best trait, the dam's first. */
export const mirrorCopy = (dam: Pick<Creature, 'boosts' | 'traits'>, sire: Pick<Creature, 'boosts' | 'traits'>): string[] =>
  [dam, sire].filter(mirrored).map((c) => mirrorTrait(c.traits)).filter((id): id is string => id !== null);
/** A trait as a bronze mirror names it: "fleet (rare)", a fighting trait's grade already in its name. The island's `mirror_names`. */
export const mirrorNames = (id: string): string => {
  const t = traitOf(id);
  return t?.family ? t.name : `${traitName(id)} (${traitTier(id)})`;
};
/** A team's bridles on its pace: the share of it bridled, each at `BRIDLE_PACE` more. The island's `bridle_team`. */
export const bridleTeam = (team: ReadonlyArray<Pick<Creature, 'boosts'>>): number =>
  (team.length ? 1 + (BRIDLE_PACE * team.filter((c) => fitted(c, 'bridle')).length) / team.length : 1);

/**
 * A team's wildermon harnesses on its pace: `HARNESS_PACE` at each one's share (`gearShare`), over the team, as the
 * bridles' (`wildgear.ts`). The island's `harness_team`.
 */
export function harnessTeam(team: ReadonlyArray<Pick<Creature, 'species' | 'skills' | 'gear'>>): number {
  if (!team.length) return 1;
  let sum = 0;
  for (const c of team) {
    const it = c.gear?.harness && gearOn(c, 'harness', denClass(c));
    if (it) sum += HARNESS_PACE * gearShare(it);
  }
  return 1 + sum / team.length;
}
/** What wildermon barding of its size makes of a blow on it: `BARDING_CUT` at its share (`wildgear.ts`). The island's `barding_mul`. */
export function bardingMul(c: Pick<Creature, 'species' | 'skills' | 'gear'>): number {
  const it = c.gear?.barding && gearOn(c, 'barding', denClass(c));
  return it ? 1 - BARDING_CUT * gearShare(it) : 1;
}

/** What they make of one channel: `POT_STEP` more for each point, on the four base stats; and a collar's upkeep. */
export const potMul = (c: Pick<Creature, 'boosts'>, channel: TraitChannel): number =>
  (BASE_STAT_IDS.has(channel) ? 1 + POT_STEP * potPoints(c, channel as BaseStat)
    : channel === 'appetite' && fitted(c, 'collar') ? 1 - COLLAR_CUT : 1)
  // And an ancient brace's uses on its action speed (`BRACE_STEP`).
  * (channel === 'work' ? 1 + BRACE_STEP * bracePoints(c) : 1);
/** The stats an ancient pot could still put a point into. */
export const potRoom = (c: Pick<Creature, 'boosts'>): BaseStat[] => BASE_STATS.filter((s) => potPoints(c, s.id) < POT_MOST).map((s) => s.id);

/**
 * An ancient comb takes one stage off a wildermon's age: an old one is grown
 * again and a grown one young. Its birth is moved on to the start of the stage
 * below, `COMB_INTO` seconds into it so that the sum lands inside it, as its
 * keeper's Kin and Long-lived age it (`kept:age`): an old one is as old as one
 * that has only just grown up, and a grown one as one only just born. Null for
 * a young one, which has no stage below. The island's `comb_into` and the
 * comb's half of `perform_artifact`.
 */
export const COMB_INTO = 1;
export function combedBorn(c: Creature, now: number): number | null {
  const age = ageOf(c, now);
  if (age === 'young') return null;
  const pace = keptOf(c, 'kept:age', 1);
  return now - ((age === 'old' ? YOUNG_FOR : 0) + COMB_INTO) / pace;
}

/**
 * An ancient file raises a wildermon's rarity one step, one time in
 * `FILE_RARITY_ODDS`, and never past the rarest there is. The island's
 * `file_rarity_odds`.
 */
export const FILE_RARITY_ODDS = 20;

// The numbers an ancient comb, file, lamp and pot quote, from the rules themselves.
describeWith({
  artifact: {
    oldSpeed: AGES.old.speed,
    oldPull: AGES.old.pull,
    fileOdds: FILE_RARITY_ODDS,
    rareBlood: listed(RARITIES.slice(1).map((r) => pct(r.blood))),
    potMost: POT_MOST,
    potStep: POT_STEP,
    stats: listed(BASE_STATS.map((s) => `${s.name.toLowerCase()} (${s.says})`)),
    slots: TRAIT_SLOTS,
    lampOdds: LAMP_TIER_ODDS,
    tierSteps: listed(TIERS.slice(1).map((t, i) => `${TIERS[i]} to ${t}`)),
    topTier: TIERS[TIERS.length - 1],
    lowTier: TIERS[0],
    nextLowTier: TIERS[1],
  },
  relicFit: { collar: COLLAR_CUT, bridle: BRIDLE_PACE, braceStep: BRACE_STEP, braceMost: BRACE_MOST, braceTop: BRACE_STEP * BRACE_MOST },
});

/**
 * Its own blood on one channel, as rare as it is, as deep as its line runs
 * (`lineMul`) and with what ancient pots put into it, with nothing communal in
 * it. The island's `beast_mul`.
 */
export const bloodMul = (c: Creature, channel: TraitChannel): number =>
  traitMul(c.traits, channel) * lineMul(c.traits, c.pedigree?.line, channel) * rarityMul(c, channel) * evoMul(c, channel) * potMul(c, channel)
  // And its size form, a large one's health and a small one's speed (`formMul`).
  * formMul(c, channel);

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

/**
 * What a breeder's perks add to a covering: more of the pair in it, and more of
 * it a tier better, for a Herdsman's True Blood and Bred Up, and more of the
 * latter for Love's Good Stock. What `pair` draws with and a breeding preview
 * counts with.
 */
export const breedPlus = (game: Game): { keepPlus: number; upPlus: number } => ({
  keepPlus: game.perk('breed:inherit', 0),
  upPlus: game.perk('breed:upgrade', 0) + game.pathFx('up', 0),
});

/**
 * What a birth says of a mutation, after its traits: " It is born with a
 * mutation: swift (supreme), which neither parent carries: +40% speed." Nothing
 * for a young one without one. The island's `mutation_said`.
 */
export function mutationSaid(from: Record<string, TraitSource> | undefined): string {
  const id = mutationOf(from);
  const t = id ? traitOf(id) : undefined;
  // A fighting trait's grade is already in its name: "heavy-pawed (fantastic)".
  return t ? ` Mutation, in neither parent: ${t.family ? t.name : `${t.name} (${t.tier})`}, ${traitSays(t)}.` : '';
}

/** What a draught beast trains by pulling, and a mount by being ridden. */
export const HAUL_SKILL = 'climbing';
/**
 * Climbing a tile ridden or pulled teaches a beast: `HAUL_LEARN` on the flat, and one more for every `HAUL_LEARN_RISE`
 * of height between the tile's centre and the last's, to `HAUL_LEARN_STEEP` more. The island's `haul_learn`,
 * `haul_learn_steep`, `haul_learn_rise` and `haul_learn_of`.
 */
export const HAUL_LEARN = 0.05;
export const HAUL_LEARN_STEEP = 0.5;
export const HAUL_LEARN_RISE = 24;
export const haulLearn = (rise: number): number => HAUL_LEARN + Math.min(HAUL_LEARN_STEEP, Math.abs(rise) / HAUL_LEARN_RISE);
/**
 * The skill a draught beast keeps in the traces, which a team's pace and the steepest step its wheels take read
 * (`Game.teamClimb`): climbing, but for a kind that learns its own skill by pulling, whose own skill stands in it. The
 * island's `beast_climb`.
 */
export const tracesSkill = (species: SpeciesDef): string => species.learns?.by === 'pull' ? species.learns.skill : HAUL_SKILL;
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
  /** Its wild forms (`wildforms.ts`): the island's `form_colour` and `form_size`. */
  formColour?: boolean;
  formSize?: SizeForm | null;
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
  /** How old it is, as the island reckons it ('young', 'grown', 'old'). */
  age?: string;
  /** What ancient pots have put into its base stats, by the stat: sent for your own only, and null for one that has had none. */
  boosts?: Partial<Record<BoostKey, number>> | null;
  /** The wildermon gear fitted on it, by the slot (`wildgear.ts`): sent for your own only, and null for one with none. */
  gear?: Partial<Record<GearSlot, { def: string; ql: number; dmg: number }>> | null;
  /** Shod, by the island's clock. */
  shod?: boolean;
  /** Saddled and bridled, by the island's word: what Mount asks. */
  tacked?: boolean | null;
  /** Whether the one asking is up on it, by the island's word: what rides it (`Game.mounted`). */
  ridden?: boolean;
  /** Who is up on it, by their uid, whoever they are: somebody else's is drawn on it and it goes where they go. */
  rider?: string | null;
  /**
   * The storey its rider is on, under a rider: a mount goes up wide staircases (`Game.rideRule`). Otherwise a
   * worker's own, at the end of the leg it is on, up a building's staircases to its work (`creature_way`); sent with
   * `storeyFrom`, at the leg's start, and its `way`, only off the ground.
   */
  storey?: number | null;
  storeyFrom?: number | null;
  /** The legs of a worker's way still to walk after this one, each `[x, y, storey, seconds]` (`worker_way_leg`). */
  way?: [number, number, number, number][] | null;
  /** What the tack on it carries of its makers' marks, when anything (a Tailor's Saddler). */
  tack?: Record<string, Mark> | null;
  /** The enchantments in the tack on it, by the piece, when any (Fleetfoot, Tamer's Bridle). */
  tack_enchant?: Record<string, Enchant> | null;
  /** What its keeper's perks make of keeping it (a Herdsman's), when anything. */
  kept?: Record<string, number> | null;
  /** The vehicle it is in the traces of; absent from older islands. */
  hitchedTo?: number | null;
  /** The work post it works out of, when it does; absent from older islands. */
  post?: number | null;
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
  /** The learning a meal is putting on it, and the seconds of it left (`beast_fed`); absent when none is. */
  fed?: number;
  fedLeft?: number;
  /** What the island says it is up to: `idle`, `out`, `work`, `home`, and the rest. */
  phase?: string;
  /** When the rest after its ability runs out (epoch seconds), which moves each time it uses it; null before the first. */
  cast?: number | null;
  carrying?: { def: string; count?: number; ql?: number } | null;
  /**
   * Why a worker of yours last found nothing to do (`IdleWhy`) and its number, cleared when it next sets to work;
   * null for one at work. `idlePost` is whether it works off a post rather than the token.
   */
  idleWhy?: string | null;
  idleN?: number | null;
  idlePost?: boolean;
  /** What a worker of yours did this island day and the one before (`WorkLedger`), yours only. */
  ledger?: WorkLedger | null;
  /** Its lifetime at work (`WorkStats`), yours only. */
  work?: WorkStats | null;
  /** For a rest in a wildermon bed, the bed's kind (`Idle.bed`). */
  idleBed?: string | null;
  /** For `stock`, what the work in range wants that the stores do not hold (`Idle.what`). */
  idleWhat?: string[] | null;
  /**
   * A worker of yours: its goes since it rested (`TIRE_GOES`), its seconds at work since it last ate (`UPKEEP_FOR`),
   * and how many deed workers of its trade its settlement has (`SPECIALTY_AT`).
   */
  worn?: number;
  unfed?: number;
  specialty?: number;
  /** A Sparra or a guard of yours on a settlement: the one it is sparring with, by id (`sparTaskSays`). */
  sparWith?: number | null;
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
const STATE_OF: Record<string, string> = { out: 'toForage', work: 'forage', rest: 'rest', bed: 'toBed' };

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
  /** Its kind's colour form, and a size form, rolled in the wild and bred on (`wildforms.ts`). Saved. The island's `form_colour`, `form_size`. */
  formColour?: boolean;
  formSize?: SizeForm | null;
  x: number;
  y: number;
  mode: CreatureMode;
  stance: Stance;
  health: number;
  hunger: number;
  carrying: Item | null;
  /**
   * The loads it has gathered this trip before the one in `carrying`, for a worker whose stage lets it carry more
   * than one home (`stageLoads`); put away one after another when it gets there, the first first.
   */
  laden?: Item[];
  /** Walking home with what it has gathered, however few loads that is: no more is to be had, or its arms are full. */
  homeward?: boolean;
  /** A Vesp at its trade: the game time it set off from its hive on the trip it is on (`vespTrip`). */
  tripAt?: number;
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
  /**
   * The points ancient pots have put into its base stats, by the stat
   * (`BASE_STATS`), each at most `POT_MOST`; absent on one that has had none.
   * It is its own, as its rarity is, and nothing breeds true for it. The
   * island keeps the same map in the creature's `boosts` column.
   */
  boosts?: Partial<Record<BoostKey, number>>;
  /** The wildermon gear fitted on it, the whole item a slot (`wildgear.ts`); absent with none. The island's `creature.gear`. */
  gear?: Partial<Record<GearSlot, Item>>;
  /** How well it has been looked after lately, 0..1. Brushing puts it up; time takes it down. */
  care: number;
  /** The learning its last good meal put on it (`fedOn`), and the game time that runs out; absent before its first. */
  fedBonus?: number;
  fedUntil?: number;
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
  /** When the island last said its ability's rest runs out, for telling when it used its ability there. */
  islandCast?: number | null;
  /** Heard of from the island before, so that what it says next is a change rather than the first word of it. */
  islandSeen?: boolean;
  /** How old the island says it is (`rpc_creatures`), which `ageOf` reads before its own sum; missing off an island. */
  islandAge?: Age;
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
  /**
   * Why a worker last found nothing to do, and its number, for its card (`idleSays`); null while it has work in
   * hand. The island's `idle_why` and `idle_n`.
   */
  idle?: Idle | null;
  /** What a worker did this island day and the one before (`ledgerAdd`). Saved. The island's `ledger`. */
  ledger?: WorkLedger | null;
  /** Its lifetime at work (`workFromLedger`, `workTime`). Saved. The island's `work_stats`, sent to its keeper only. */
  work?: WorkStats | null;
  /** Goes at its task since it last rested (`TIRE_GOES`, `staminaOf`). Saved. The island's `worn`. */
  worn?: number;
  /**
   * While it rests (`REST_FOR`): the game time it gets up, and the wildermon bed it is walking to or asleep in, by
   * the piece's id (`PlacedFurniture.sleeper`). Saved. The island's phase `rest` and `bed`, its `until` and `bed`.
   */
  restUntil?: number;
  bed?: number;
  /** Seconds it has worked since it last ate (`UPKEEP_FOR`, `unfedNow`). Saved. The island's `unfed`. */
  unfed?: number;
  /** On an island, how many deed workers of its trade its settlement has, as the island counts them (`deed_trade_workers`). */
  specialty?: number;
  /**
   * Sparring on a settlement (`sparTaskSays`): the Sparra or the guard it is sparring with, by id, and for a guard the
   * game time it last sparred, which picks whose turn it is. The island's `spar_with` and `spar_at`.
   */
  sparWith?: number | null;
  sparAt?: number;
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
  /** Who is up on its back by the island's word, by their uid, whoever they are. */
  riderUid?: string;
  /**
   * The storey its rider is on, by the island's word, for one under somebody else (`Game.creatureStorey`); for a
   * worker, its own at the end of the leg it is on, and `storeyFrom` at its start (`Game.creatureLift`).
   */
  storey?: number;
  storeyFrom?: number;
  /** A worker's legs still to walk after this one, up or down a building's stairs, each `[x, y, storey, seconds]` (`walkLegs`). */
  way?: [number, number, number, number][];
  /** The hour it was born, which is all that age is. */
  born: number;
  /** When a wild one was put out, which its stay in the wild is counted from (`WILD_STAY`); its birth where it is not kept. */
  putAt?: number;
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
/** What a stoker keeps alight: campfires, smelters, kilns, and furniture that burns (an oven, a brazier: `hearth`). */
export type Hearth = 'campfire' | 'smelter' | 'kiln' | 'furniture';
/** A hearth a stoker may feed (`coldHearth`): where, its fuel and its room for fuel (`cap`). */
interface StokeHearth { x: number; y: number; fuel: number; lit: boolean; kind: Hearth; id: number; cap: number }

export interface CreatureJSON {
  id: number;
  species: string;
  name: string;
  variant: number;
  formColour?: boolean;
  formSize?: SizeForm | null;
  x: number;
  y: number;
  mode: CreatureMode;
  stance: Stance;
  health: number;
  hunger: number;
  carrying: Item | null;
  laden?: Item[];
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
  /** What ancient pots have put into its base stats; absent on one that has had none, and in a save from before there were any. */
  boosts?: Partial<Record<BoostKey, number>>;
  /** The wildermon gear fitted on it, by the slot (`wildgear.ts`). */
  gear?: Partial<Record<GearSlot, Item>>;
  care?: number;
  /** A meal's learning and when it runs out (`fedOn`); absent in a save from before meals were worth any. */
  fedBonus?: number;
  fedUntil?: number;
  bredAt?: number;
  due?: number;
  unborn?: Unborn | null;
  pedigree?: Pedigree | null;
  trade?: GatherKind | null;
  /** What it did this island day and the one before, on a worker; absent in a save from before there was a ledger. */
  ledger?: WorkLedger | null;
  /** Its lifetime at work; absent in a save from before it was kept. */
  work?: WorkStats | null;
  /** Its goes since it rested, when it rests and the bed it is in, and its work since it ate; absent from a save from before. */
  worn?: number;
  restUntil?: number;
  bed?: number;
  unfed?: number;
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
export const tackSpeed = (c: { tack?: Record<string, Mark>; tackEnchant?: Record<string, Enchant>; boosts?: Creature['boosts'] }): number =>
  Math.max(1, ...TACK.map((id) => markOf({ mark: c.tack?.[id] }, 'speed')))
  // And a Fleetfoot in its saddle on top.
  * (1 + tackEnchant(c, 'fleet'))
  // And an ancient bridle on it (`BRIDLE_PACE`).
  * (fitted(c, 'bridle') ? 1 + BRIDLE_PACE : 1);
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
/** Exported for a track alone, which can find only what is out (`trackAction.ts`). */
export const CULL_RANGE = 85;
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
 * How long a wild one stays out in the country before it goes, in seconds of real time: a day.
 *
 * Asked: "I havent seen a single one of the new 60 wildermon. Are they populated on the island?" They were in the
 * roll (`WILD_SPECIES`) and almost never rolled for, because nothing wild ever left. A stretch of country was put out
 * once and afterwards only topped up for what had been killed, so the island was still the mix the weights asked for
 * on the day it was first walked, and every kind added since stood up only in the gaps a hunter left. Fifty-two of
 * them had not one wild head anywhere.
 *
 * So a wild thing has a span. Each one goes once it is older than this and between once and twice this, by its id
 * (`wildStayOf`), so that what stood up together does not all go together; and it goes the way one out of its season
 * goes (`wild_out_of_season`, `stream`), at the next stocking of its stretch of country, which then tops the
 * stretch up off the weights as they are now. Only one that has nothing to do with anybody (`wildUntouched`): a
 * monster, a tamed one, one in a fight, in a trap, in the traces, under a rider or a mark, being coaxed or being
 * acted on stays.
 *
 * A day, because the oldest goes at two, so the whole mix is the current weights within two days of a change, and a
 * stretch of country you walk every evening holds a different set every few evenings rather than every hour. It is
 * also as long as the most either side dates a new one's birth back (`WILD_BORN_BACK`, the island's `creature_stock_block`)
 * so nothing stood up is old enough to go on the pass after it is put out.
 *
 * The island's `wild_stay()`, emitted from here.
 */
export const WILD_STAY = 24 * 60 * 60;
/**
 * The most a new wild one's birth is dated back, so the wild holds every age: the island's `creature_stock_block`. Its
 * stay is counted from when it was put out (`putAt`, the island's `put_at`), not from its birth.
 */
export const WILD_BORN_BACK = OLD_AT * 1.6;
/** The step the share of a second span a wild one gets goes up by from one id to the next: the golden ratio's, so neighbours land far apart. The island's `wild_stay_of`. */
const WILD_SPREAD = (Math.sqrt(5) - 1) / 2;
/** How old a wild one is when it goes, by its id: `WILD_STAY` and up to as much again. The island's `wild_stay_of`. */
export const wildStayOf = (id: number): number => {
  const s = id * WILD_SPREAD;
  return WILD_STAY * (1 + (s - Math.floor(s)));
};
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
/** What an errand waits after fetching what it carries out of the stores, as the island's `worker_settle` does after a fetch. */
const ERRAND_FETCH = 0.5;

/** A creature's level, read off its best task skill. */
/**
 * A wildermon's level is its skill: the one it was born to (its job's, a draught beast's hauling, or its own), to the whole
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
      if (r.formColour !== undefined) c.formColour = !!r.formColour;
      if (r.formSize !== undefined) c.formSize = r.formSize;
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
      // How old it is, by the island's clock and its keeper's perks, which is what `ageOf` reads here.
      c.islandAge = r.age === 'young' || r.age === 'grown' || r.age === 'old' ? r.age : undefined;
      // What ancient pots have put into it, which comes for yours and for nobody else's.
      if (r.boosts !== undefined) c.boosts = r.boosts ?? undefined;
      // And the gear fitted on it, which comes for yours and for nobody else's (`wildgear.ts`).
      if (r.gear !== undefined) {
        c.gear = r.gear && Object.keys(r.gear).length
          ? Object.fromEntries(Object.entries(r.gear).map(([slot, g]) => [slot, { uid: 0, id: g.def, ql: g.ql, dmg: g.dmg, count: 1 }]))
          : undefined;
      }
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
      // Saddled and bridled is the island's word too. Reported: a Thistlekit saddled and bridled, and Mount
      // refused "no saddle and bridle": the island never sent it, so this side's stayed as the crate let it out.
      if (r.tacked !== undefined && r.tacked !== null) c.tacked = r.tacked;
      // And whether you are up on it. Reported: "Mounting a wildermon doesnt actually mount it": the island seated the
      // rider and never said so, so this side never read the body as mounted.
      if (r.ridden !== undefined) c.ridden = r.ridden;
      // And who, which anybody else's screen draws on it (`walkLegs`, `Renderer`).
      if (r.rider !== undefined) c.riderUid = r.rider ?? undefined;
      // And the storey they ride it on, up a wide staircase (`Game.creatureStorey`); or a worker's own, up a
      // building's staircases to its work, at each end of its leg, and the legs of its way after it (`creature_way`).
      if (r.storey || r.storeyFrom) {
        c.storey = r.storey ?? 0;
        if (r.storeyFrom !== undefined && r.storeyFrom !== null) c.storeyFrom = r.storeyFrom;
        else delete c.storeyFrom;
      } else {
        delete c.storey;
        delete c.storeyFrom;
      }
      if (r.way?.length) c.way = r.way.map((p) => [...p] as [number, number, number, number]);
      else delete c.way;
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
      // And which work post it works out of, which the island kept and never said: every worked post read as idle.
      if (r.post !== undefined) c.post = r.post;
      // The working life, which comes for yours and for nobody else's.
      if (r.care !== undefined) {
        c.care = r.care;
        // And what a meal is putting on its learning, on this side's clock (`beast_fed`), which comes with it.
        c.fedBonus = r.fed ?? undefined;
        c.fedUntil = r.fed && r.fedLeft ? time + r.fedLeft : undefined;
      }
      if (r.xp !== undefined) c.xp = r.xp;
      if (r.skills) {
        // Evolved there since it was last heard of: drawn and heard here as it would be in a game of your own.
        const was = stageOf(c);
        c.skills = r.skills;
        if (c.islandSeen && stageOf(c) > was) this.acted(c, 'evolve', time);
        c.islandSeen = true;
      }
      // And one nobody has named called what its kind is now, whatever name the island still keeps for it (`renamedKind`).
      c.name = renamedKind(c);
      if (r.phase !== undefined) {
        c.state = STATE_OF[r.phase] ?? 'idle';
        // Struck or set to work there since it was last heard of: drawn and heard here as it would be in a game of your own.
        if (r.phase !== c.islandPhase && (r.phase === 'strike' || r.phase === 'work')) this.acted(c, r.phase, time);
        c.islandPhase = r.phase;
      }
      if (r.cast !== undefined) {
        // Used its ability there since it was last heard of: drawn and heard here as it would be in a game of your own.
        if (c.islandCast !== undefined && r.cast !== null && r.cast !== c.islandCast) this.acted(c, 'cast', time);
        c.islandCast = r.cast;
      }
      // Why it is standing about, and what it did yesterday: the island's words for both, said on its card here (`idleSays`).
      if (r.idleWhy !== undefined) {
        c.idle = r.idleWhy && (IDLE_WHYS as readonly string[]).includes(r.idleWhy)
          ? { why: r.idleWhy as IdleWhy, n: r.idleN ?? 0, post: !!r.idlePost, ...(r.idleBed ? { bed: r.idleBed } : {}), ...(r.idleWhat?.length ? { what: r.idleWhat } : {}) }
          : null;
      }
      if (r.ledger !== undefined) c.ledger = r.ledger;
      if (r.work !== undefined) c.work = r.work;
      // Its stamina, its time since it ate and its settlement's specialty, the island's words for each (`staminaOf`, `unfedNow`, `specialtyMul`).
      if (r.worn !== undefined) c.worn = r.worn;
      if (r.unfed !== undefined) c.unfed = r.unfed;
      if (r.specialty !== undefined) c.specialty = r.specialty;
      // And who it is sparring with on its settlement, said on its card (`sparTaskSays`).
      if (r.sparWith !== undefined) c.sparWith = r.sparWith;
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
  /** Where the driver of the vehicle each creature is in the traces of was drawn last frame, for the way they are going. */
  private driverAt = new Map<number, [number, number]>();
  private walkLegs(game: Game): void {
    const now = Date.now();
    for (const c of this.list.values()) {
      /*
       * Under somebody else: where they are drawn, going as they go. Reported: "Other players dont see me mounted, just
       * zipping around with a wildermon in tow": the rider came on every beat of their body and the mount on the
       * slower one of the wildlife, behind them.
       */
      /*
       * Under you: where you are, going as you go (`Game.carryRider`), which already set it walking this frame.
       * Reported: "mounts when ridden do no animations like walking": the island's leg for it, a leg of no length,
       * stopped it here every frame after.
       */
      // And in the traces of a vehicle you drive: where `Game.haulVehicle` put it, going as you go.
      const cart = c.hitchedTo !== null ? game.furniture.get(c.hitchedTo) : undefined;
      if (c.ridden || cart?.driven) {
        this.place(c);
        continue;
      }
      /*
       * In the traces of one somebody else drives: a length ahead of where they are drawn, the way they are going,
       * going as they go. The island drags it to their feet (`drag_along`) on a leg of no length, which stood it still
       * under them.
       */
      const driver = cart?.helm ? game.roster.byUid(cart.helm) : undefined;
      if (cart && driver && driver.level >= 0) {
        const [dx, dy] = game.roster.drawnAt(driver);
        const was = this.driverAt.get(c.id);
        this.driverAt.set(c.id, [dx, dy]);
        const gone = was ? Math.hypot(dx - was[0], dy - was[1]) : 0;
        c.moving = driver.moving && gone > 0.002;
        if (c.moving) {
          c.dirX = (dx - was![0]) / gone;
          c.dirY = (dy - was![1]) / gone;
          c.walkPhase += gone * 6;
        }
        const len = Math.hypot(c.dirX, c.dirY) || 1;
        const team = cart.team ?? [];
        [c.x, c.y] = game.traceSpot(dx, dy, c.dirX / len, c.dirY / len, Math.max(0, team.indexOf(c.id)), Math.max(1, team.length));
        this.place(c);
        continue;
      }
      this.driverAt.delete(c.id);
      const rider = c.riderUid ? game.roster.byUid(c.riderUid) : undefined;
      // On the ground or a storey up a wide staircase (`Game.rideRule`); never down a cellar.
      if (rider && rider.level >= 0) {
        const [nx, ny] = game.roster.drawnAt(rider);
        const gone = Math.hypot(nx - c.x, ny - c.y);
        c.moving = rider.moving && gone > 0.002;
        if (c.moving) {
          c.dirX = nx - c.x;
          c.dirY = ny - c.y;
          c.walkPhase += gone * 6;
        }
        c.x = nx;
        c.y = ny;
        this.place(c);
        continue;
      }
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
      // Off the end of a leg up or down a building's stairs: on along the way the island gave it, leg by leg, until it says more.
      while (c.way?.length && now >= c.legEnds) {
        const [wx, wy, wl, secs] = c.way.shift()!;
        c.legFromX = c.legToX;
        c.legFromY = c.legToY;
        c.legToX = wx;
        c.legToY = wy;
        c.storeyFrom = c.storey ?? 0;
        c.storey = wl;
        c.legAt = c.legEnds;
        c.legEnds = c.legAt + Math.max(1, secs * 1000);
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

  /**
   * How long a worker with nothing to do waits before it looks again: `WORKER_REST_FIRST`, by its blood and its
   * herd's (`settler`). The island's `worker_rest` times `beast_mul(c, 'idle')`.
   */
  idleRest(c: Creature): number {
    return WORKER_REST_FIRST * this.mul(c, 'idle');
  }

  /** Everything that bears on how fast it moves: and its keeper's Fleet while it follows them. */
  speedMul(c: Creature): number {
    return bloodMul(c, 'speed') * this.aura(c, 'speed') * companionMul(c, 'speed');
  }

  /** Everything that bears on how fast it gets a task done: blood, herd, and how it is kept. */
  workMul(c: Creature): number {
    return bloodMul(c, 'work') * this.aura(c, 'work') * careMul(c);
  }

  /** Everything that bears on how fast the work goes into it: and a good meal's learning while it lasts (`fedNow`). */
  learnMul(c: Creature, time: number): number {
    return bloodMul(c, 'learn') * this.aura(c, 'learn') * careMul(c) * (1 + fedNow(c, time));
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
   * A chance its traits give on a channel that is a chance (`heavy`, `rip`): the points their figure is over one, as
   * the rest of its blood lifts that figure (`mul` over the traits alone); nought where its traits put it at one or
   * below. The island's `beast_chance`.
   */
  chance(c: Creature, channel: TraitChannel): number {
    const t = traitMul(c.traits, channel);
    return t > 1 ? ((t - 1) * this.mul(c, channel)) / t : 0;
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

  /** The ones shut in wildermon crates. */
  stored(): Creature[] {
    return [...this.list.values()].filter((c) => c.mode === 'stored');
  }

  /**
   * The wildermon working the settlement itself. One set to a work post is at
   * work too, but not on the deed's books: it costs no settlement slot, which
   * is most of what a post is for.
   *
   * Your own only (`mine`, which the island says of each and which is unset in
   * a game of your own, where everything is yours). On an island the list holds
   * every worker within sight, a neighbour's as well, and counting theirs
   * against your settlement's places refused a third worker of two as the fifth
   * of five, beside a neighbour's four. The island's `workers_on_deed` counts
   * by keeper.
   */
  workers(): Creature[] {
    return [...this.list.values()].filter((c) => c.mode === 'deed' && c.post === null && c.mine !== false);
  }

  /** Everything of yours at work anywhere, posts included. */
  working(): Creature[] {
    return [...this.list.values()].filter((c) => c.mode === 'deed' && c.mine !== false);
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
    // A kind of the deep water, only there (`deepTile`; asked for: "only spawns in deep water").
    if (def.deepWater) {
      if (!deepTile(game, x, y)) return false;
    } else if (def.onOre) {
      if (!isSeam(bedrockAt(w, x, y))) return false;
    } else if (def.onSand) {
      if (w.getTile(x, y) !== TileType.Sand) return false;
    } else if (def.onStone) {
      // Bare rock with nothing in it: the Ironemole takes the seams, the Chiptail the rest.
      if (w.getTile(x, y) !== TileType.Rock || isSeam(bedrockAt(w, x, y))) return false;
    } else if (!TILE_DEFS[w.getTile(x, y)].forage) return false;
    if (def.nearWater && !nearWater(game, x, y)) return false;
    if (def.nearTrees && !nearTrees(game, x, y)) return false;
    if (def.nearClay && !nearClay(game, x, y)) return false;
    if (def.nearTar && !nearTar(game, x, y)) return false;
    if (def.nocturnal && !game.isNight()) return false;
    // And only in its season, for a kind with one (`WildSeason`), by the wall clock's day.
    if (!wildInSeason(def, game.wallNow())) return false;
    return true;
  }

  /**
   * One put out in the country. Born at some point in the past, so the country is not all yearlings; and one of a kind
   * that evolves comes in now and then already past its first stage (`wildStageRoll`), at a level somewhere in that
   * stage's span (`stageLevels`) on the skill its level is (`levelSkill`), called and as big as that stage, as one that
   * evolved does. The island's `wild_stage_put`.
   */
  standWild(game: Game, id: string, x: number, y: number): Creature {
    const c = this.spawn(id, x, y, 'wild', game.rand, game.time - game.rand() * WILD_BORN_BACK);
    c.putAt = game.time;
    const def = this.species(c);
    const stage = def.stages ? wildStageRoll(def, game.rand()) : 0;
    const skill = levelSkill(def);
    if (stage && skill) {
      const [lo, hi] = stageLevels(stage);
      c.skills[skill] = lo + game.rand() * (hi - lo);
      c.name = kindName(c);
      // And the trait slots its stage has opened, each drawn as at an evolution, by nobody's husbandry (`openSlots`).
      openSlots(c, 0, stage, 0, game.rand);
      c.health = maxHealth(c, def);
    }
    // And now and then in its colour form, or a size form, each off a roll of its own (`wildFormRoll`, `wild_form_put`).
    const form = wildFormRoll(def, game.rand(), game.rand());
    if (form.formColour) c.formColour = true;
    if (form.formSize) {
      c.formSize = form.formSize;
      c.health = maxHealth(c, def);
    }
    return c;
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

  /** As `groundOk`, for a kind of the deep water: deep water (`deepTile`), off a deed and out of the player's sight. */
  private waterOk(game: Game, x: number, y: number, minDistance: number): boolean {
    if (!deepTile(game, x, y) || game.onDeed(x, y)) return false;
    return Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y) >= minDistance;
  }

  /**
   * Ground that suits a species, or nothing: `SITE_LOOKS` looks at ground a
   * creature could stand on, given three times that many throws to find them.
   */
  private siteFor(game: Game, id: string, minDistance: number): { x: number; y: number } | null {
    const w = game.world;
    // A kind of the deep water looks at deep water rather than at ground (`deepTile`), as the island's `site_for` does.
    const deep = !!SPECIES[id]?.deepWater;
    let looks = 0;
    for (let i = 0; i < SITE_LOOKS * 3 && looks < SITE_LOOKS; i++) {
      const x = Math.floor(game.rand() * w.w);
      const y = Math.floor(game.rand() * w.h);
      if (deep ? !this.waterOk(game, x, y, minDistance) : !this.groundOk(game, x, y, minDistance)) continue;
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
      this.standWild(game, id, x + 0.5, y + 0.5);
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
      this.walkLegs(game);
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
      // Called to heel, crated or let go while it rested: out of its bed, and its rest is over.
      if (c.mode !== 'deed' && (c.bed !== undefined || c.restUntil !== undefined)) {
        this.outOfBed(game, c);
        c.restUntil = undefined;
        if (c.state === 'rest' || c.state === 'toBed') c.state = 'idle';
      }
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
   * The creatures something else has hold of by id: what is being fought, brawled with or led in a pack, what struck
   * one of them or you inside `BLOW_MEMORY`, and what you are acting on. The island's `held` in `wild_turnover`.
   */
  heldIds(game: Game): Set<number> {
    const held = new Set<number>();
    for (const o of this.list.values()) {
      if (o.enemy !== null) held.add(o.enemy);
      if (o.brawl !== null) held.add(o.brawl);
      if (o.packLead !== null && o.packLead !== o.id) held.add(o.packLead);
      if (o.attackedBy !== null && game.time - o.attackedAt < BLOW_MEMORY) held.add(o.attackedBy);
    }
    const p = game.player;
    if (p.attackedBy !== null && game.time - p.attackedAt < BLOW_MEMORY) held.add(p.attackedBy);
    const t = game.action?.target;
    if (t?.kind === 'creature') held.add(t.id);
    return held;
  }

  /**
   * Whether a wild one has nothing to do with anybody, and so may go when its span is out (`WILD_STAY`): not a
   * monster, not anybody's, not fighting, struck inside `BLOW_MEMORY`, held (`heldIds`), in a trap, in the traces,
   * ridden, tied to a post, stunned, under a mark or being coaxed inside `COAX_LAPSE`. The island's `wild_turnover`.
   */
  wildUntouched(game: Game, c: Creature, held: Set<number>): boolean {
    if (c.mode !== 'wild' || c.mine || this.species(c).monster) return false;
    if (c.trapped !== null || c.hitchedTo !== null || c.ridden || c.post !== null) return false;
    if (c.enemy !== null || c.brawl !== null || c.packLead !== null || held.has(c.id)) return false;
    if (c.attackedBy !== null && game.time - c.attackedAt < BLOW_MEMORY) return false;
    if ((c.stunUntil ?? 0) > game.time) return false;
    if (Object.values(c.marks ?? {}).some((m) => m && m.until > game.time)) return false;
    if (c.coaxed > 0 && game.time - c.coaxedAt < COAX_LAPSE) return false;
    return true;
  }

  /**
   * Put away what has been left behind and let out what has been come upon.
   * This is the whole of streaming: the island keeps its wildlife as numbers,
   * and only the stretch of it being walked costs anything.
   */
  private stream(game: Game): void {
    const px = game.player.x;
    const py = game.player.y;
    // Away and unwatched: put it back on the books. And a wild one whose season is over, wherever it is, fighting or
    // not: the island's `wild_out_of_season`. One in a trap is the trap's.
    const now = game.wallNow();
    // And one past its span (`WILD_STAY`) that has nothing to do with anybody, which is the island's `wild_turnover`:
    // what comes out again in its place is rolled off the weights as they are now.
    const held = this.heldIds(game);
    for (const c of [...this.list.values()]) {
      if (c.mode !== 'wild' || c.trapped !== null) continue;
      if (!wildInSeason(this.species(c), now)
        || (game.time - (c.putAt ?? c.born) > wildStayOf(c.id) && this.wildUntouched(game, c, held))) {
        const r = this.region(c.x, c.y);
        this.banked.set(r, (this.banked.get(r) ?? 0) + 1);
        this.list.delete(c.id);
        continue;
      }
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
      this.standWild(game, id, x + 0.5, y + 0.5);
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
    // And one kept to an island (`Region.lair`) only on that island.
    const here = REGIONS[chartRegion(x + 0.5, y + 0.5, game.world.w)];
    const room = MONSTERS.filter(([id]) => (alive[id] ?? 0) < (MONSTER_CAP[id] ?? 1) && (lairOf(id) ?? here) === here);
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
      // As much of it as its blood's `bleed` lets out.
      if (c.health > 1) c.health = Math.max(1, c.health - c.bleedRate * this.mul(c, 'bleed') * secs);
      // And while it bleeds it is hurt, so it mends nothing.
      c.attackedAt = Math.max(c.attackedAt, from + secs);
    }
    c.moving = false;
    const top = maxHealth(c, def);
    if (c.health > top) c.health = top;
    // Its blood and its herd's communal healing (`aura`), as the island's `beast_mul`.
    else if (c.health < top && game.time - c.attackedAt > 6) c.health = Math.min(top, c.health + elapsed * (c.mode === 'wild' ? 0.25 : 0.6) * bloodMul(c, 'mend') * this.aura(c, 'mend'));
    // A yearling grows no fleece and gives no milk; an old one is slower at both.
    const growth = ageDef(c, game.time).growth;
    if (def.fleece && growth > 0 && c.fleece < 1) c.fleece = Math.min(1, c.fleece + elapsed * def.fleece * growth * bloodMul(c, 'grow'));
    // A brushing wears off over a few hours of being left to itself: longer for a Herdsman's Lasting Care.
    if (c.care > 0) c.care = Math.max(0, c.care - elapsed * bloodMul(c, 'carefade') / (keptOf(c, 'kept:care_hours', CARE_HOURS) * 3600));
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
    game.hurtPlayer(attackOf(c, def) * BLOW_SHARE, `${c.name} turns on you`, def.wound ?? 'bite');
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
      // A bed of the right sort, collected off the top as a player's Collect does (ground left as it was, no timer).
      if (game.world.getTile(x, y) !== (kind === 'sand' ? TileType.Sand : TileType.Clay)) return false;
      return this.tileOk(game, x, y) && !this.claimed(x, y, c);
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
      if (kind === 'sprout') return treeAge(data).alive && treeAge(data).logs > 0 && !game.isForaged(x, y, 'sprout');
      return treeSpecies(data) === RESIN_TREE && tappable(data) && !game.tappedToday(x, y);
    }
    if (kind === 'flower') {
      // In flower, and not where a skep or a Vesp's hive gathers (`SKEP_REACH`): its honey is the flowers in reach of it.
      if (flowersHere(game, x, y, game.wallNow()) <= 0 || !this.tileOk(game, x, y) || this.claimed(x, y, c)) return false;
      for (const f of game.furniture.values()) {
        if ((f.kind === SKEP || f.kind === 'hive') && Math.max(Math.abs(f.x - x), Math.abs(f.y - y)) <= SKEP_REACH) return false;
      }
      return true;
    }
    if (kind === 'scrub') return this.tileOk(game, x, y) && !this.claimed(x, y, c) && greenOnTile(game, x, y, greenNow()) > 0;
    if (kind === 'quarry') {
      // Bare stone with no metal in it, snow over it or not, and one cutter to a face.
      const rock = bedrockAt(game.world, x, y);
      if (!STONE_FACES.has(game.world.getTile(x, y)) || isSeam(rock)) return false;
      return game.world.rockHeight(x, y) > -MINE_DEPTH && this.reachableFace(game, x, y) && !this.claimed(x, y, c);
    }
    if (kind === 'peat') {
      // A bed of the black stuff, taken off the top and left as it was.
      const t = game.world.getTile(x, y);
      if (t !== TileType.Peat && t !== TileType.Tar) return false;
      return this.tileOk(game, x, y) && !this.claimed(x, y, c);
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
    if (kind === 'compost') {
      // A carcass, or anything knocked about past saving, lying on the deed (`isRotting`): the island's `worker_gatherable`.
      if (!game.onDeed(x, y) || !game.groundAt(x, y).some((it) => isRotting(it))) return false;
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
    c.until = game.time + (c.mode === 'deed' ? workDuration(c.skills[GATHER_SKILL[kind]] ?? 1) / this.taskMul(c, kind) : FORAGE_TIME);
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
    if (kind === 'sand' || kind === 'clay') return this.finishCollect(game, c, kind === 'sand' ? 'sand' : 'clay');
    if (kind === 'stoke' || kind === 'guard') return null;
    // A Vesp works the flower and flies back to its hive with what it gathered (`vespTrip`), the island's `worker_do`.
    if (kind === 'hive') return this.finishNectar(game, c);
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
    if (kind === 'compost') return this.finishCompost(game, c);
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
   * A Vesp's go at a flower: it learns, as any go, and has in its arms what it flies back to the hive, at the quality
   * of its skill (`madeQl`). How much honey that is, is the trip's (`vespHoney`), worked out at the hive.
   */
  private finishNectar(game: Game, c: Creature): Item | null {
    if (c.mode !== 'deed') return null;
    const skillId = GATHER_SKILL.hive;
    const skill = c.skills[skillId] ?? 1;
    this.gainSkill(game, c, skillId, 0.225);
    return { uid: game.inventory.nextUid++, id: 'honey', ql: this.madeQl(game, c, skill), dmg: 0, count: 0 };
  }

  /**
   * A Vesp back at its hive with what it gathered (`vespTrip`): into the hive, as much honey as a skep there would
   * have made over the trip (`vespHoney`, `Game.hivePut`), and what it made to its ledger; and it stands `VESP_REST`
   * before it sets off again. Its hive gone, what it gathered is lost. The island's `worker_settle`, at `home`.
   */
  private vespHome(game: Game, c: Creature, dt: number): void {
    const f = hiveAt(game, c.workX, c.workY);
    const done = (wait: number): void => {
      c.carrying = null;
      c.tripAt = undefined;
      c.state = 'idle';
      c.until = game.time + wait;
    };
    if (!f || !c.carrying) return done(VESP_REST);
    const [hx, hy] = furnitureCentre(f);
    if (Math.hypot(hx - c.x, hy - c.y) <= 1.3) {
      const now = game.wallNow();
      const secs = game.time - (c.tripAt ?? game.time) + VESP_REST;
      const made = game.hivePut(f, vespHoney(skepFlowers(game, f.x, f.y, now), seasonAt(now).season, secs), c.carrying.ql);
      if (made.honey) this.toLedger(game, c, { item: 'honey', n: made.honey });
      if (made.wax) this.toLedger(game, c, { item: 'wax', n: made.wax });
      done(VESP_REST);
    } else if (this.stepToward(game, c, hx, hy, dt) === 'blocked') done(2);
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

  /** Fell the tree a worker walked to, and hand it the logs it carries home. */
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
    // The same spread as a dig, raised by its yield traits, as on an island.
    const ql = Math.min(100, Math.max(1, skill * (DIG_QL[0] + game.rand() * (DIG_QL[1] - DIG_QL[0])) + 1) * this.yieldMul(c));
    // Every log of the tree home in one trip. Asked for: "carry all logs to storage on cut down instead of just 1".
    return { uid: game.inventory.nextUid++, id: 'log', ql, dmg: 0, count: logs, extra: def.name };
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

  /** Collect a load off the bed a worker walked to, as a player's Collect does: the ground is left as it was. */
  private finishCollect(game: Game, c: Creature, yields: 'sand' | 'clay'): Item | null {
    if (game.world.getTile(c.workX, c.workY) !== (yields === 'sand' ? TileType.Sand : TileType.Clay)) return null;
    const skill = c.skills.digging ?? 1;
    this.gainSkill(game, c, 'digging', 0.225);
    // Times what its yield traits bring, as the island's `worker_do` has it.
    const ql = Math.min(100, Math.max(1, skill * (DIG_QL[0] + game.rand() * (DIG_QL[1] - DIG_QL[0])) + 1) * this.yieldMul(c));
    return { uid: game.inventory.nextUid++, id: yields, ql, dmg: 0, count: 1 };
  }

  /** Cut stone from the face a quarrier walked to. */
  private finishQuarry(game: Game, c: Creature): Item | null {
    const w = game.world;
    const rock = bedrockAt(w, c.workX, c.workY);
    if (!STONE_FACES.has(w.getTile(c.workX, c.workY)) || isSeam(rock)) return null;
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
    const count = 1 + Math.floor(skill / REED_LEVELS);
    return { uid: game.inventory.nextUid++, id: 'reed', ql: Math.min(100, Math.max(1, skill * (DIG_QL[0] + game.rand() * (DIG_QL[1] - DIG_QL[0])) + 1)), dmg: 0, count };
  }

  /** Nose through a patch of soil for something worked and long buried. */
  private finishSeek(game: Game, c: Creature): Item | null {
    const skill = c.skills[GATHER_SKILL.seek] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.seek, 0.225);
    game.markForaged(c.workX, c.workY, 'dig');
    // Its blood and its herd's on the find (`lucky finder`).
    if (game.rand() > findChance(skill, 30) * this.mul(c, 'find')) return null;
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

  /**
   * Pick up one thing lying on the tile a fetcher walked to; with nothing lying there, the stack it sorts out of the
   * store standing on it (`sortStack`), as many of it as the roomiest bin that takes it has room for. The island's
   * `worker_do` and `sort_take`.
   */
  private finishFetch(game: Game, c: Creature): Item | null {
    const pile = game.groundAt(c.workX, c.workY);
    if (!pile.length) {
      const sort = this.sortStack(game, c, c.workX, c.workY);
      if (!sort) return null;
      this.gainSkill(game, c, GATHER_SKILL.fetch, 0.225);
      return this.takeFrom(sort.store, (it) => it === sort.item, sort.n, game);
    }
    this.gainSkill(game, c, GATHER_SKILL.fetch, 0.225);
    const [item] = game.takeFromGround(c.workX, c.workY, pile[0].uid);
    return item ?? null;
  }

  /**
   * Clear one thing rotting on the tile a clearer walked to -- a carcass, or anything knocked about past saving -- and
   * hand it the compost it carries home: half as many as there were of it and one at the least, better for its
   * farming. A trade that walks out to a tile, as the island's `worker_do` has it, not an errand.
   */
  private finishCompost(game: Game, c: Creature): Item | null {
    const rot = game.groundAt(c.workX, c.workY).find((it) => isRotting(it));
    if (!rot) return null;
    const [taken] = game.takeFromGround(c.workX, c.workY, rot.uid);
    if (!taken) return null;
    const skill = c.skills[GATHER_SKILL.compost] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.compost, 0.225);
    return { uid: game.inventory.nextUid++, id: 'compost', ql: Math.min(100, 20 + skill * 0.6), dmg: 0, count: Math.max(1, Math.round(taken.count / 2)) };
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
    // Seed `SEED_CHANCE` of the time (`harvestSeeds`), and nothing to carry home the rest.
    const seedCount = harvestSeeds(game.rand);
    const seeds: Item = { uid: game.inventory.nextUid++, id: def.seed, ql: grade, dmg: 0, count: seedCount };
    if (seedCount > 0) {
      if (c.pouch && c.pouch.id === seeds.id) c.pouch.count += seeds.count;
      else if (!c.pouch) c.pouch = seeds;
      else game.dropOnGround(x, y, seeds);
    }
    return { uid: game.inventory.nextUid++, id: def.produce, ql: grade, dmg: 0, count: y2.produce };
  }

  /**
   * A fire, furnace, kiln, oven or brazier on the deed under `HEARTH_FULL` of fuel, nearest first, that no other worker
   * is carrying fuel to; with `fuel`, only one with room for a whole piece of it. The island's `stoke_hearth`.
   */
  private coldHearth(game: Game, c: Creature, range: number, fuel: string | null): StokeHearth | null {
    const deed = game.deed;
    if (!deed) return null;
    let best: StokeHearth | null = null;
    let bestD = Infinity;
    const busy = (x: number, y: number): boolean => {
      for (const o of this.list.values()) {
        if (o !== c && o.mode === 'deed' && o.carrying && isFuel(o.carrying.id) && o.job && o.workX === x && o.workY === y) return true;
      }
      return false;
    };
    const consider = (x: number, y: number, now: number, lit: boolean, kind: Hearth, id: number, cap: number): void => {
      if (now >= HEARTH_FULL) return;
      if (Math.max(Math.abs(x - deed.x), Math.abs(y - deed.y)) > range) return;
      // On its keeper's settlement only: its reach runs onto the next one's (the island's `on_my_deed`).
      if (!game.onDeed(x, y)) return;
      if (fuel !== null && cap - now < (FUEL_VALUES[fuel] ?? Infinity)) return;
      const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
      if (d < bestD && !busy(x, y)) {
        bestD = d;
        best = { x, y, fuel: now, lit, kind, id, cap };
      }
    };
    for (const f of game.campfires.values()) consider(...(fireCentre(f).map(Math.floor) as [number, number]), f.fuel, f.lit, 'campfire', f.id, FIRE_CAPACITY);
    for (const sm of game.smelters.values()) consider(sm.x, sm.y, sm.fuel, sm.lit, 'smelter', sm.id, FIRE_CAPACITY);
    for (const k of game.kilns.values()) consider(k.x, k.y, k.fuel, k.lit, 'kiln', k.id, FIRE_CAPACITY);
    for (const f of game.furniture.values()) if (furnitureDef(f.kind).hearth) consider(f.x, f.y, f.fuel ?? 0, !!f.lit, 'furniture', f.id, hearthCapacity(f));
    return best;
  }

  /**
   * The fuel a stoker fetches for a hearth with `room` seconds of room in it: the best by `stokeRank` of what a whole
   * piece fits, out of whichever of your settlement stores holds it nearest. The island's `stoke_fuel`.
   */
  private stokeFuel(game: Game, c: Creature, room: number): { store: DeedStore; item: Item } | null {
    let best: { store: DeedStore; item: Item; rank: number; d: number } | null = null;
    for (const store of game.deedStores()) {
      const d = Math.hypot(store.centre[0] - c.x, store.centre[1] - c.y);
      for (const item of store.items) {
        if (!isFuel(item.id) || item.count <= 0 || item.locked || FUEL_VALUES[item.id] > room) continue;
        const rank = stokeRank(item.id);
        if (!best || rank < best.rank || (rank === best.rank && d < best.d)) best = { store, item, rank, d };
      }
    }
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
    // Building work on its keeper's settlement only: its reach runs onto the next one's (the island's `on_my_deed`).
    if (kind === 'hod') return this.hodStep(game, c, dt, goto, (x, y, dir) => near(x, y) && game.workOnDeed(x, y, dir), deed, range);
    if (kind === 'mend') return this.mendStep(game, c, goto);
    if (kind === 'plant') return this.plantStep(game, c, goto, near, range, deed);
    if (kind === 'prospect') return this.prospectStep(game, c, goto, near, range, deed);
    if (kind === 'groom' || kind === 'dairy' || kind === 'heal') return this.herdStep(game, c, kind, goto, near, range);
    if (kind === 'butcher') return this.butcherStep(game, c, goto);
    const atStores = STORE_RECIPES[kind];
    if (atStores) return this.recipeStep(game, c, atStores, goto);
    if (kind === 'lamp') return this.lampStep(game, c, goto, near, range);
    if (kind === 'smelt' || kind === 'kiln') return this.furnaceStep(game, c, kind, goto, near, range);
    if (kind === 'ash') return this.ashStep(game, c, goto, near) || this.recipeStep(game, c, LYE_RECIPES, goto) || this.why(c, 'range', range);
    if (kind === 'brew') return this.brewStep(game, c, goto, near, range);
    if (kind === 'cook') return this.cookStep(game, c, goto, near, range);
    if (kind === 'restore') return this.restoreStep(game, c, goto);
    if (kind === 'patch') return this.planterStep(game, c, goto, near, range);
    if (kind === 'paper' || kind === 'spin') return this.pressStep(game, c, kind, goto, near, range);
    if (kind === 'glass') return this.glassStep(game, c, goto, near, range);
    if (SMITH_TRADES[kind]) return this.anvilStep(game, c, kind, goto, near, range);
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
   * into the stores first, and then the ore or the unfired clay (`POTTERY`) out of
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
    range: number,
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
    if (!to) return this.why(c, 'range', range);
    if (!holding) {
      const store = this.storeWhere(game, c, fits);
      if (!store) return this.why(c, 'stock');
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
    // At a stage, lye leached where it stands after the raking, in the same go.
    this.moreRecipes(game, c, LYE_RECIPES, null, it.x, it.y);
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
  private brewStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean, range: number): boolean {
    if (c.carrying) return false;
    const brew = this.brewInStores(game);
    if (!brew) return this.why(c, 'stock');
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
    if (!f) return this.why(c, 'range', range);
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
   * no bowl, pot or pan needed -- worked at the nearest lit campfire or
   * oven of yours, and what it makes put in the stores.
   */
  private cookStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean, range: number): boolean {
    if (c.carrying) return false;
    const job = this.recipeInStores(game, cookRecipes());
    if (!job) return this.why(c, 'stock');
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
    if (!at) return this.why(c, 'range', range);
    const spot = at as [number, number];
    if (!goto(spot[0], spot[1], 1.8)) return true;
    this.workRecipe(game, c, job.recipe, null, Math.floor(spot[0]), Math.floor(spot[1]));
    this.moreRecipes(game, c, cookRecipes(), null, Math.floor(spot[0]), Math.floor(spot[1]));
    return true;
  }

  /**
   * Pressing papyrus and spinning yarn: the first of its trade's recipes
   * (`STATION_TRADES`) the stores hold everything for, worked at the nearest
   * paper press or spindle of yours, and what it makes and the bucket it hands
   * back put in the stores.
   */
  private pressStep(game: Game, c: Creature, kind: GatherKind, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean, range: number): boolean {
    if (c.carrying) return this.why(c, 'full');
    const { piece, recipes } = STATION_TRADES[kind]!;
    const job = this.recipeInStores(game, recipes);
    if (!job) return this.why(c, 'stock');
    let at: [number, number] | undefined;
    let bestD = Infinity;
    for (const f of game.furniture.values()) {
      if (f.kind !== piece || !near(f.x, f.y) || !game.onDeed(f.x, f.y)) continue;
      const p = furnitureCentre(f);
      const d = Math.hypot(p[0] - c.x, p[1] - c.y);
      if (d < bestD) {
        bestD = d;
        at = p;
      }
    }
    if (!at) return this.why(c, 'range', range);
    const spot = at as [number, number];
    if (!goto(spot[0], spot[1], 1.8)) return true;
    this.workRecipe(game, c, job.recipe, null, Math.floor(spot[0]), Math.floor(spot[1]));
    this.moreRecipes(game, c, recipes, null, Math.floor(spot[0]), Math.floor(spot[1]));
    return true;
  }

  /**
   * Making glass: the makings of a glass lump (`GLASS_RECIPES`) out of the
   * stores, melted at the nearest lit smelter of yours -- lit and fuelled, as
   * your own hands want one, charged or not -- and the lumps, with its line's
   * third-stage `more` on each batch, put in the stores. It neither lights nor
   * fuels one. The island's `errand_step` and `errand_do`.
   */
  private glassStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean, range: number): boolean {
    if (c.carrying) return this.why(c, 'full');
    const job = this.recipeInStores(game, GLASS_RECIPES);
    if (!job) return this.why(c, 'stock');
    let at: [number, number] | undefined;
    let bestD = Infinity;
    for (const sm of game.smelters.values()) {
      if (!sm.lit || sm.fuel <= 0 || !near(sm.x, sm.y) || !game.onDeed(sm.x, sm.y)) continue;
      const p = smelterCentre(sm);
      const d = Math.hypot(p[0] - c.x, p[1] - c.y);
      if (d < bestD) {
        bestD = d;
        at = p;
      }
    }
    if (!at) return this.why(c, 'range', range);
    const spot = at as [number, number];
    if (!goto(spot[0], spot[1], 1.8)) return true;
    const more = perkN(c, 'more');
    this.workRecipe(game, c, job.recipe, null, Math.floor(spot[0]), Math.floor(spot[1]), true, more);
    this.moreRecipes(game, c, GLASS_RECIPES, null, Math.floor(spot[0]), Math.floor(spot[1]), more);
    return true;
  }

  /**
   * Smithing nails or ribbons: a lump of one of its trade's metals (`SMITH_TRADES`) out of the stores, beaten out at
   * the nearest anvil of yours into as many pieces as a filling of its mould makes, of that metal and at its own
   * hand's quality (`madeQl`), and put in the stores. No mould and no hammer. The island's `errand_step` and
   * `errand_do`.
   */
  private anvilStep(game: Game, c: Creature, kind: GatherKind, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean, range: number): boolean {
    if (c.carrying) return this.why(c, 'full');
    const lumps = smithLumps(kind);
    if (!lumps.some((id) => this.inStores(game, id) > 0)) return this.why(c, 'stock');
    let at: PlacedAnvil | undefined;
    let bestD = Infinity;
    for (const a of game.anvils.values()) {
      if (!near(a.x, a.y) || !game.onDeed(a.x, a.y)) continue;
      const p = anvilCentre(a);
      const d = Math.hypot(p[0] - c.x, p[1] - c.y);
      if (d < bestD) {
        bestD = d;
        at = a;
      }
    }
    if (!at) return this.why(c, 'range', range);
    const spot = anvilCentre(at);
    if (!goto(spot[0], spot[1], 1.8)) return true;
    const skill = c.skills[GATHER_SKILL[kind]] ?? 1;
    for (let n = 0; n < stageLoads(c); n++) {
      const id = lumps.find((l) => this.inStores(game, l) > 0);
      if (!id) break;
      this.takeOne(game, [id]);
      const metal = METAL_BY_LUMP.get(id);
      this.intoStores(game, { uid: game.inventory.nextUid++, id: smithMakes(kind), ql: this.madeQl(game, c, skill), dmg: 0, count: smithPer(kind), extra: metal?.name },
        null, at.x, at.y);
    }
    this.gainSkill(game, c, GATHER_SKILL[kind], 0.25);
    this.errandWork(game, c, kind);
    return true;
  }

  /**
   * Litres of a liquid out of its vessels in the stores, the emptiest first, each left an empty bucket at its last
   * litre. The island's `errand_do`, by `drain_vessel`.
   */
  private takeLitres(game: Game, vessel: string, litres: number): void {
    let left = litres;
    const piles = game.deedStores().flatMap((st) => st.items.filter((x: Item) => x.id === vessel && !x.locked).map((x: Item) => ({ st, x })))
      .sort((a, b) => litresOf(a.x) - litresOf(b.x));
    for (const { st, x } of piles) {
      while (left > 0 && x.id === vessel && x.count > 0) {
        const m = Math.min(left, litresOf(x));
        if (!drainVessel(game, st.items, x, m, () => game.events.emit('crate'))) break;
        left -= m;
      }
      if (left <= 0) return;
    }
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
    if (c.carrying) return this.why(c, 'full');
    if (this.inStores(game, 'ash') < GLAZE_ASH) return this.why(c, 'stock');
    const bare = (it: Item): boolean => GLAZEABLE.has(it.id) && it.mark?.glaze === undefined && !it.locked;
    const st = this.storeWhere(game, c, bare);
    if (!st) return this.why(c, 'stock');
    if (!goto(st.centre[0], st.centre[1])) return true;
    if (!st.items.find(bare)) return true;
    // The piece it came to and, at a stage, the next bare one nearest it, its stage's number of them in the one go
    // (`stageLoads`), while the stores hold the ash.
    for (let n = 0; n < stageLoads(c); n++) {
      const at = n === 0 ? st : this.storeWhere(game, c, bare);
      const it = at?.items.find(bare);
      if (!at || !it || (n > 0 && this.inStores(game, 'ash') < GLAZE_ASH)) break;
      for (let k = 0; k < GLAZE_ASH; k++) this.takeOne(game, ['ash'], at);
      it.mark = { ...(it.mark ?? {}), glaze: 0 };
      at.changed();
    }
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
      if (!st) {
        this.why(c, 'full');
        return true;
      }
      if (!goto(st.centre[0], st.centre[1])) return true;
      this.intoStores(game, held, st, st.x, st.y, false);
      c.carrying = null;
      return true;
    }
    if (!source) return this.why(c, 'range', range);
    if (held) {
      if (!goto(source.x, source.y, 1.5)) return true;
      // Every bucket it carries, filled in the one go.
      if (source.well) game.drawFromWell(source.well, held.count * BUCKET_LITRES);
      c.carrying = { ...held, id: 'water_bucket' };
      this.gainSkill(game, c, GATHER_SKILL.fill, 0.2);
      this.errandWork(game, c, 'fill');
      return true;
    }
    const st = this.storeWith(game, c, ['bucket']);
    if (!st) return this.why(c, 'stock');
    if (!goto(st.centre[0], st.centre[1])) return true;
    // Its stage's buckets a trip (`stageLoads`), as many as the water it is filling them at holds whole.
    c.carrying = this.takeFrom(st, (it) => it.id === 'bucket', this.bucketsAt(c, source), game);
    return true;
  }

  /**
   * How many buckets a trip it fills at this water: its stage's (`stageLoads`), at a well as many whole ones as the
   * well holds and one at the least. The island's `fill_buckets`.
   */
  private bucketsAt(c: Creature, source: { well?: PlacedFurniture }): number {
    const n = stageLoads(c);
    return source.well ? Math.max(1, Math.min(n, Math.floor((source.well.litres ?? 0) / BUCKET_LITRES))) : n;
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
    if (!set) return this.why(c, 'stock');
    if (!goto(set.at.centre[0], set.at.centre[1])) return true;
    const skill = c.skills[GATHER_SKILL.restore] ?? 1;
    // The relic it came to and, at a stage, the next whose pieces are all in the stores too, its stage's number of
    // them in the one go (`stageLoads`), each put in the store it came to.
    for (let n = 0; n < stageLoads(c); n++) {
      const one = n === 0 ? set : this.relicInStores(game);
      if (!one) break;
      let worth = 0;
      for (let part = 1; part <= one.relic.parts; part++) {
        let piece: { st: DeedStore; it: Item } | undefined;
        for (const st of game.deedStores()) {
          for (const it of st.items) {
            const f = it.id === 'fragment' && !it.locked ? fragmentOf(it) : null;
            if (f && f.relic === one.relic && f.part === part && (!piece || it.dmg < piece.it.dmg)) piece = { st, it };
          }
        }
        if (!piece) return n > 0;
        worth += piece.it.ql * (1 - piece.it.dmg / RESTORE_AGE);
        if (piece.it.count > 1) piece.it.count -= 1;
        else piece.st.items.splice(piece.st.items.indexOf(piece.it), 1);
        piece.st.changed();
      }
      const ql = Math.max(1, Math.min(100, (worth / one.relic.parts) * restoredMul(skill)));
      this.intoStores(game, { uid: game.inventory.nextUid++, id: one.relic.result, ql, dmg: 0, count: 1 }, set.at, set.at.x, set.at.y);
    }
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
  private planterStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean, near: (x: number, y: number) => boolean, range: number): boolean {
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
    if (!f) return this.why(c, 'range', range);
    const crop = game.planted.get(f.id);
    if (!crop && !holding) {
      const store = this.storeWhere(game, c, seed);
      if (!store) return this.why(c, 'stock');
      if (!goto(store.centre[0], store.centre[1])) return true;
      // Its stage's seeds a trip (`stageLoads`), each sown in a go of its own.
      c.carrying = this.takeFrom(store, seed, stageLoads(c), game);
      return true;
    }
    const [fx, fy] = furnitureCentre(f);
    if (!goto(fx, fy, 1.8)) return true;
    const skill = c.skills[GATHER_SKILL.patch] ?? 1;
    const made = this.madeQl(game, c, skill);
    if (!crop) {
      const def = CROP_BY_SEED.get(c.carrying!.id)!;
      game.sowPlanter(f, def.id, c.carrying!.ql);
      c.carrying!.count -= 1;
      if (c.carrying!.count <= 0) c.carrying = null;
    } else if (cropReady(crop)) {
      const def = cropDef(crop.id);
      const y = cropYield(crop.tended);
      const ql = Math.max(1, Math.min(100, (crop.ql + made) / 2));
      this.intoStores(game, { uid: game.inventory.nextUid++, id: def.produce, ql, dmg: 0, count: y.produce }, null, f.x, f.y);
      const seeds = harvestSeeds(game.rand);
      if (seeds > 0) this.intoStores(game, { uid: game.inventory.nextUid++, id: def.seed, ql, dmg: 0, count: seeds }, null, f.x, f.y);
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
    this.toLedger(game, c, { goes: 1 });
    c.busyUntil = game.time + workDuration(c.skills[GATHER_SKILL[kind]] ?? 1) / this.taskMul(c, kind);
  }

  /** What it fetched out of the stores for an errand in its arms: the half second the island's errand waits after a fetch. */
  private errandFetched(game: Game, c: Creature): void {
    c.busyUntil = game.time + ERRAND_FETCH;
  }

  /**
   * What a deed worker's go at its task is quickened by: its blood, its care and its stage (`workMul`); its
   * settlement's specialty in the trade (`specialtyMul`); and `UNFED_PACE` while it has gone `UPKEEP_FOR` without a
   * meal. Every go's work time is divided by it. The island's `worker_pace`.
   */
  taskMul(c: Creature, kind: GatherKind | null): number {
    return this.workMul(c) * (unfedNow(c) ? UNFED_PACE : 1) * (specialtyTrade(kind) ? specialtyMul(this.tradeWorkers(kind)) : 1);
  }

  /**
   * How many deed workers of a trade its settlement has, the one asking among them, in a game of your own; on an
   * island each of yours carries the island's count (`Creature.specialty`, its `deed_trade_workers`).
   */
  tradeWorkers(kind: GatherKind): number {
    let n = 0;
    for (const o of this.list.values()) if (o.mode === 'deed' && (o.trade ?? this.species(o).gathers) === kind) n++;
    return n;
  }

  /** How many deed workers of its trade a worker's settlement has: the island's count on an island (`specialty`), or this side's. */
  specialtyOf(c: Creature): number {
    const kind = c.trade ?? this.species(c).gathers;
    if (!specialtyTrade(kind)) return 0;
    return this.fromIsland ? c.specialty ?? 0 : this.tradeWorkers(kind);
  }

  /** Every trade your deed workers are at that a specialty speeds, with how many of them its settlement has, most first. */
  specialties(): Array<{ kind: GatherKind; n: number }> {
    const by = new Map<GatherKind, number>();
    for (const c of this.working()) {
      const kind = c.trade ?? this.species(c).gathers;
      if (specialtyTrade(kind)) by.set(kind, Math.max(by.get(kind) ?? 0, this.specialtyOf(c)));
    }
    return [...by].map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n || a.kind.localeCompare(b.kind));
  }

  /** What a worker of this skill makes a thing at: the same spread a tile's load is taken at. */
  private madeQl(game: Game, c: Creature, skill: number): number {
    return Math.min(100, Math.max(1, skill * (0.6 + game.rand() * 0.8) + 1) * this.yieldMul(c));
  }

  /**
   * Something made at the stores, put into them: the store it was made at
   * while that has room, then whichever on the settlement will take it, and
   * failing all of them on the ground where it was made. The island's
   * `worker_put`. Counted to an errand's go as made (`making`) unless `made`
   * is false: a load carried back, or what a recipe hands back. The island's
   * `worker_put_back`.
   */
  private intoStores(game: Game, item: Item, at: DeedStore | null, x: number, y: number, made = true): void {
    if (made && this.making) this.making.push([item.id, item.count]);
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
    range: number,
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
    if (!o) return this.why(c, 'range', range);
    const def = this.species(o);
    const skill = c.skills[GATHER_SKILL[kind]] ?? 1;
    const want = kind === 'heal' ? DRESSINGS : kind === 'dairy' && Creatures.milker(def) ? ['bucket'] : null;
    if (want && !want.includes(c.carrying?.id ?? '')) {
      if (c.carrying) return false;
      const store = this.storeWith(game, c, want);
      if (!store) return this.why(c, 'stock');
      if (!goto(store.centre[0], store.centre[1])) return true;
      // Its stage's buckets or dressings (`stageLoads`), one for each it may see to in a go.
      c.carrying = this.takeFrom(store, (it) => want.includes(it.id), stageLoads(c), game);
      return true;
    }
    if (!goto(o.x, o.y, 1.6)) return true;
    this.tendOne(game, c, o, kind, skill, true);
    // At a stage, the next of yours wanting it within `TEND_REACH` of where it stands, its stage's number of them in
    // the one go (`stageLoads`), each with a bucket or a dressing of what it carries where it wants one. The island's
    // `errand_go`.
    for (let n = 1; n < stageLoads(c); n++) {
      let next: Creature | undefined;
      let nearD = Infinity;
      for (const x of this.list.values()) {
        const d = Math.hypot(x.x - c.x, x.y - c.y);
        if (d > TEND_REACH || d >= nearD || !this.herdWants(game, c, x, kind, carried.includes(c.carrying?.id ?? ''))) continue;
        nearD = d;
        next = x;
      }
      if (!next) break;
      const needs = kind === 'heal' ? DRESSINGS : kind === 'dairy' && Creatures.milker(this.species(next)) ? ['bucket'] : null;
      if (needs && !needs.includes(c.carrying?.id ?? '')) break;
      this.tendOne(game, c, next, kind, skill, false);
    }
    game.events.emit('creature');
    this.errandWork(game, c, kind);
    return true;
  }

  /** Brushing, milking or shearing, or dressing a hurt on one of yours: `learn` false for one after the first in a go. */
  private tendOne(game: Game, c: Creature, o: Creature, kind: GatherKind, skill: number, learn: boolean): void {
    const def = this.species(o);
    const gain = (id: string, base: number): void => {
      if (learn) this.gainSkill(game, c, id, base);
    };
    const top = maxHealth(o, def);
    if (kind === 'groom') {
      // As a keeper of its skill with a brush as good (`groomGain`), and the small hurts seen to with it.
      o.care = Math.min(1, o.care + groomGain(skill, skill));
      if (o.health < top) o.health = Math.min(top, o.health + top * GROOM_HEAL);
      gain(GATHER_SKILL.groom, 0.25);
    } else if (kind === 'dairy') {
      const [x, y] = [Math.floor(o.x), Math.floor(o.y)];
      if (Creatures.milker(def)) {
        // A bucket off it, as the keeper's own milking fills one (`milk_go`): what it has been fed on is what comes out of it.
        const ql = Math.max(1, Math.min(100, 20 + o.fleece * 40 + o.hunger * 30));
        if (c.carrying && (c.carrying.count -= 1) <= 0) c.carrying = null;
        this.intoStores(game, { uid: game.inventory.nextUid++, id: 'milk_bucket', ql, dmg: 0, count: 1 }, null, x, y);
      } else {
        // A full fleece is three, a full crop of feathers six, and quality follows what was there.
        const yields = def.shearYield ?? 'wool';
        // And its line's third-stage `wool` (`perkN`).
        const n = Math.max(1, Math.round(o.fleece * (yields === 'wool' ? SHEAR_WOOL : SHEAR_FEATHERS))) + perkN(o, 'wool');
        const ql = Math.max(1, Math.min(100, 15 + o.fleece * 45 + skill * 0.4));
        this.intoStores(game, { uid: game.inventory.nextUid++, id: yields, ql, dmg: 0, count: n }, null, x, y);
      }
      o.fleece = 0;
      this.learnBy(game, o, 'tended');
      gain(GATHER_SKILL.dairy, 0.25);
    } else {
      // A dressing's share of a life, at its first aid and the dressing's quality (`healAmount`), and the bleeding stopped.
      const ql = c.carrying?.ql ?? 1;
      if (c.carrying && (c.carrying.count -= 1) <= 0) c.carrying = null;
      o.health = Math.min(top, o.health + top * healAmount(skill, ql));
      o.bleedUntil = 0;
      o.bleedRate = 0;
      gain(GATHER_SKILL.heal, 0.25);
    }
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
    if (!store || !corpse) return this.why(c, 'stock');
    if (!goto(store.centre[0], store.centre[1])) return true;
    if (!corpseSpecies(corpse)) return false;
    const at = store;
    const skill = c.skills[GATHER_SKILL.butcher] ?? 1;
    const share = butcherYield(skill, skill);
    const put = (id: string, count: number, q: number): void => this.intoStores(game, { uid: game.inventory.nextUid++, id, ql: q, dmg: 0, count }, at, at.x, at.y);
    // The carcass it came to and, at a stage, the next in the same store, its stage's number of them in the one go
    // (`stageLoads`).
    for (let n = 0; n < stageLoads(c); n++) {
      const one = n === 0 ? corpse : at.items.find((x: Item) => x.id === 'corpse' && !x.locked && !!corpseSpecies(x));
      const def = one && corpseSpecies(one);
      if (!one || !def) break;
      const ql = this.madeQl(game, c, skill);
      if (one.count > 1) one.count -= 1;
      else at.items.splice(at.items.indexOf(one), 1);
      at.changed();
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
    }
    this.gainSkill(game, c, GATHER_SKILL.butcher, 0.3);
    this.errandWork(game, c, 'butcher');
    return true;
  }

  /**
   * The first of these recipes the stores hold everything for: every input
   * across them. A worker needs no tool, so a recipe's is not looked for. Null
   * when none is. The island's `recipe_in_stores`.
   */
  recipeInStores(game: Game, recipes: readonly string[]): { recipe: Recipe; at: DeedStore } | null {
    const stores = game.deedStores();
    const has = (id: string, n: number): boolean =>
      stores.reduce((sum, st) => sum + st.items.filter((x: Item) => x.id === id && !x.locked).reduce((a, x) => a + x.count, 0), 0) >= n;
    // Litres of a liquid, in its vessels in the stores (`RecipeInput.litres`).
    const hasLitres = (id: string, n: number): boolean =>
      stores.reduce((sum, st) => sum + st.items.filter((x: Item) => x.id === id && !x.locked).reduce((a, x) => a + litresOf(x) * x.count, 0), 0) >= n;
    for (const id of recipes) {
      const r = RECIPE_BY_ID.get(id);
      if (!r || !r.inputs.every((i) => (i.litres ? hasLitres(i.item, i.litres) : has(i.item, i.count ?? 1)))) continue;
      const at = stores.find((st) => st.items.some((x: Item) => x.id === r.inputs[0].item && !x.locked));
      if (at) return { recipe: r, at };
    }
    return null;
  }

  /**
   * Tanning and milling: a recipe worked at the stores, its inputs taken out
   * of them, no tool needed, and what it makes -- with what it
   * hands back, a bucket after the lye -- put back in. The island's
   * `errand_do`.
   */
  private recipeStep(game: Game, c: Creature, recipes: readonly string[], goto: (x: number, y: number, reach?: number) => boolean): boolean {
    if (c.carrying) return false;
    const job = this.recipeInStores(game, recipes);
    if (!job) return this.why(c, 'stock');
    const { recipe: r, at } = job;
    if (!goto(at.centre[0], at.centre[1])) return true;
    this.workRecipe(game, c, r, at, at.x, at.y);
    this.moreRecipes(game, c, recipes, at, at.x, at.y);
    return true;
  }

  /**
   * At a stage, the next batches after the first in the same go, its stage's number in all (`stageLoads`), while the
   * stores hold the makings of one: taken out of them as the first's were, and made where it stands. The island's
   * `errand_go`.
   */
  private moreRecipes(game: Game, c: Creature, recipes: readonly string[], at: DeedStore | null, x: number, y: number, more = 0): void {
    for (let n = 1; n < stageLoads(c); n++) {
      const next = this.recipeInStores(game, recipes);
      if (!next) return;
      this.workRecipe(game, c, next.recipe, at, x, y, false, more);
    }
  }

  /**
   * One go at a recipe out of the stores: its inputs taken, and what it makes and hands back put in them. `go` false
   * for a batch after the first in the same go, which teaches nothing more and takes no more time; `more`, what its
   * line's third stage adds to what a batch makes (a glimmip's lumps).
   */
  private workRecipe(game: Game, c: Creature, r: Recipe, at: DeedStore | null, x: number, y: number, go = true, more = 0): void {
    for (const i of r.inputs) {
      if (i.litres) this.takeLitres(game, i.item, i.litres);
      else for (let n = 0; n < (i.count ?? 1); n++) this.takeOne(game, [i.item], at ?? undefined);
    }
    const kind = this.species(c).gathers ?? 'mill';
    const skill = c.skills[GATHER_SKILL[kind]] ?? 1;
    this.intoStores(game, { uid: game.inventory.nextUid++, id: r.result, ql: this.madeQl(game, c, skill), dmg: 0, count: (r.count ?? 1) + more }, at, x, y);
    for (const [id, n] of r.returns ?? []) this.intoStores(game, { uid: game.inventory.nextUid++, id, ql: 40, dmg: 0, count: n }, at, x, y, false);
    if (!go) return;
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
    range: number,
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
    if (!f) return this.why(c, 'range', range);
    const want = this.lampWants(game, f);
    if (want === 'candle' && !holding) {
      const store = this.storeWith(game, c, ['candle']);
      if (!store) return this.why(c, 'stock');
      if (!goto(store.centre[0], store.centre[1])) return true;
      // Its stage's candles a trip (`stageLoads`), each set in a go of its own.
      c.carrying = this.takeFrom(store, (it) => it.id === 'candle', stageLoads(c), game);
      return true;
    }
    const [fx, fy] = furnitureCentre(f);
    if (!goto(fx, fy, 1.6)) return true;
    if (want === 'candle' && f.lamp) {
      f.fuel = Math.round(candleBurn(f.lamp.ql));
      f.lit = game.isNight();
      c.carrying!.count -= 1;
      if (c.carrying!.count <= 0) c.carrying = null;
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
    if (!vessel) return this.why(c, 'room');
    if (full) {
      const [vx, vy] = furnitureCentre(vessel);
      if (!goto(vx, vy)) return true;
      // As many of the buckets it carries as the barrel has room for, poured in one go (`stageLoads`); the rest go on
      // to the next barrel.
      const held = c.carrying!;
      const room = (furnitureDef(vessel.kind).liquid ?? 0) - (vessel.litres ?? 0);
      const n = Math.max(1, Math.min(held.count, Math.ceil(room / BUCKET_LITRES)));
      game.pourInto(vessel, n * BUCKET_LITRES, 'water');
      held.count -= n;
      if (held.count <= 0) c.carrying = null;
      this.gainSkill(game, c, GATHER_SKILL.water, 0.2);
      // A go, timed as the island's errand times it (`workDuration`).
      this.errandWork(game, c, 'water');
      return true;
    }
    const source = game.waterSource(c.x, c.y, range, near);
    if (!source) return this.why(c, 'range', range);
    if (!goto(source.x, source.y, 1.5)) return true;
    // Its stage's buckets a trip: at a well, as many whole ones as it holds, and one at the least as ever.
    const n = this.bucketsAt(c, source);
    if (source.well) game.drawFromWell(source.well, n * BUCKET_LITRES);
    c.carrying = { uid: game.inventory.nextUid++, id: 'water_bucket', ql: 40, dmg: 0, count: n };
    // A go, as the island's `errand_do` counts the filling as one and times it as one.
    this.errandWork(game, c, 'water');
    return true;
  }

  /** Carrying the hod: one piece of planned work at a time, out of the stores (`Game.hodNeeding`). */
  private hodStep(
    game: Game,
    c: Creature,
    dt: number,
    goto: (x: number, y: number, reach?: number) => boolean,
    near: (x: number, y: number, dir?: string) => boolean,
    deed: { x: number; y: number },
    range: number,
  ): boolean {
    // What the stores hold to bring, crates and furniture alike, and never what is kept back.
    const takeable = (it: Item, item: string): boolean => it.id === item && it.count > 0 && !it.locked;
    const stocked = (item: string): boolean => game.deedStores().some((st) => st.items.some((it: Item) => takeable(it, item)));
    const job = game.hodNeeding(near, c.carrying?.id, deed, stocked);
    // Holding a piece nothing within reach wants: back to the nearest store with room for it (`storeFor`).
    if (c.carrying && job?.item !== c.carrying.id) {
      const held = c.carrying;
      const st = this.storeFor(game, c, held);
      if (!st) return this.why(c, 'full');
      if (!goto(st.centre[0], st.centre[1])) return true;
      this.intoStores(game, held, st, st.x, st.y, false);
      c.carrying = null;
      this.errandWork(game, c, 'hod');
      return true;
    }
    if (!job) {
      // Work within reach wanting only what the stores do not hold: `stock`, naming it. None at all: `range`.
      const wanted = game.hodWanted(near, deed);
      return wanted.n > 0 ? this.why(c, 'stock', wanted.n, wanted.items.slice(0, IDLE_WANTS)) : this.why(c, 'range', range);
    }
    if (!c.carrying) {
      // The store nearest the work holding it (the island's `store_holding`).
      const holding = game.deedStores().filter((st) => st.items.some((it: Item) => takeable(it, job.item)));
      const store = holding.sort((a, b) => Math.hypot(a.centre[0] - job.x - 0.5, a.centre[1] - job.y - 0.5) - Math.hypot(b.centre[0] - job.x - 0.5, b.centre[1] - job.y - 0.5))[0];
      const stock = store?.items.find((it: Item) => takeable(it, job.item));
      if (!store || !stock) return this.why(c, 'stock');
      const [sx, sy] = store.centre;
      if (!goto(sx, sy)) return true;
      // Its stage's pieces a trip (`stageLoads`), as many as the work still wants.
      const n = Math.max(1, Math.min(stageLoads(c), stock.count, game.hodWants(job.target, job.item)));
      stock.count -= n;
      if (stock.count <= 0) store.items.splice(store.items.indexOf(stock), 1);
      store.changed();
      c.carrying = { uid: game.inventory.nextUid++, id: job.item, ql: stock.ql, dmg: 0, count: n };
      this.errandFetched(game, c);
      return true;
    }
    if (!goto(job.x + 0.5, job.y + 0.5, 1.6)) return true;
    // Every piece it carries that the work still wants, in the one go; any over go on to the next work wanting them.
    const held = c.carrying;
    do {
      game.fitPiece(job.target, held.id);
      held.count -= 1;
    } while (held.count > 0 && game.hodWants(job.target, held.id) > 0);
    if (held.count <= 0) c.carrying = null;
    this.gainSkill(game, c, GATHER_SKILL.hod, 0.25);
    this.errandWork(game, c, 'hod');
    return true;
  }

  /** Mending: it works at the stores, on whatever in them is knocked about. */
  private mendStep(game: Game, c: Creature, goto: (x: number, y: number, reach?: number) => boolean): boolean {
    const found = game.damagedInStores();
    if (!found) return this.why(c, 'stock');
    const [sx, sy] = found.store.centre;
    if (!goto(sx, sy)) return true;
    const skill = c.skills[GATHER_SKILL.mend] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.mend, 0.2);
    // The most damaged thing in the stores and, at a stage, the next most damaged after it, its stage's number of
    // them in the one go (`stageLoads`), each mended once.
    const done = new Set<Item>();
    for (let one: typeof found | undefined = found; one && done.size < stageLoads(c); one = game.damagedInStores(done)) {
      done.add(one.item);
      // The same bargain the player's own repair makes: damage out, a little
      // quality with it, and a better hand loses less of it.
      one.item.dmg = Math.max(0, one.item.dmg - (MEND_DMG + skill / MEND_DMG_LEVELS));
      one.item.ql = Math.max(1, one.item.ql - Math.max(MEND_QL_LEAST, MEND_QL - skill / MEND_QL_LEVELS));
      one.store.changed();
    }
    // A go takes what a go at its trade does (`workDuration`), as the island's errand times it.
    this.errandWork(game, c, 'mend');
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
      if (!store || !sprout) return this.why(c, 'stock');
      const [sx, sy] = store.centre;
      if (!goto(sx, sy)) return true;
      // Its stage's sprouts a trip (`stageLoads`), each planted in a go of its own.
      const n = Math.min(stageLoads(c), sprout.count);
      sprout.count -= n;
      if (sprout.count <= 0) store.items.splice(store.items.indexOf(sprout), 1);
      store.changed();
      c.carrying = { uid: game.inventory.nextUid++, id: 'sprout', ql: sprout.ql, dmg: 0, count: n, extra: sprout.extra };
      this.errandFetched(game, c);
      return true;
    }
    if (c.carrying.id !== 'sprout') return false;
    if (c.workX < 0 || !game.plantableTile(c.workX, c.workY)) {
      const spot = game.plantingSpot(deed.x, deed.y, range, near, c.x, c.y);
      if (!spot) return this.why(c, 'range', range);
      c.workX = spot.x;
      c.workY = spot.y;
    }
    if (!goto(c.workX + 0.5, c.workY + 0.5)) return true;
    game.plantSprout(c.workX, c.workY, c.carrying.extra);
    c.carrying.count -= 1;
    if (c.carrying.count <= 0) c.carrying = null;
    c.workX = -1;
    this.gainSkill(game, c, GATHER_SKILL.plant, 0.25);
    this.errandWork(game, c, 'plant');
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
      if (!spot) return this.why(c, 'range', range);
      c.workX = spot.x;
      c.workY = spot.y;
    }
    if (!goto(c.workX + 0.5, c.workY + 0.5)) return true;
    const skill = c.skills[GATHER_SKILL.prospect] ?? 1;
    this.gainSkill(game, c, GATHER_SKILL.prospect, 0.22);
    game.readGround(c, c.workX, c.workY, 2 + Math.floor(skill / 20));
    c.workX = -1;
    this.errandWork(game, c, 'prospect');
    return true;
  }

  /** Nothing else to do: walk the border, and look again in a moment. */

  /**
   * A stoker's step, for whatever is not fuel on its way to a hearth (`feedFire`): fuel for the nearest hearth under
   * `HEARTH_FULL`, the best there is (`stokeFuel`), as many whole pieces as fit in it and its stage carries
   * (`stageLoads`); fuel in its arms with no hearth to take it to, back into the stores; and from `STOKE_SMELTS_AT` on,
   * with no hearth wanting fuel or no fuel for it, a smelter worker's work (`furnaceStep`). The island's `errand_step`
   * for `stoke`.
   */
  private stokeStep(game: Game, c: Creature, dt: number, site: WorkSite): boolean {
    const range = siteRange(c, this.species(c), site);
    const smelts = stageOf(c) >= STOKE_SMELTS_AT;
    const held = c.carrying;
    if (held) {
      // Ore, at a stage that charges smelters: into one, or back to the stores when none has room.
      if (smelts && !isFuel(held.id) && this.stokeSmelt(game, c, dt, site)) return true;
      // Fuel: to the nearest hearth with room for a piece of it, or back to the stores.
      const to = isFuel(held.id) ? this.coldHearth(game, c, range, held.id) : null;
      if (to) {
        c.workX = to.x;
        c.workY = to.y;
        c.job = to.kind;
        return true;
      }
      return this.stokeBack(game, c, dt);
    }
    const hearth = this.coldHearth(game, c, range, null);
    const fuel = hearth && this.stokeFuel(game, c, hearth.cap - hearth.fuel);
    if (!hearth || !fuel) {
      if (smelts && this.stokeSmelt(game, c, dt, site)) return true;
      // No hearth wanting fuel: why the smelter work found nothing, at a stage that does it.
      if (!hearth) return smelts ? false : this.why(c, 'range', range);
      return this.why(c, 'stock');
    }
    c.idle = null;
    const { store, item } = fuel;
    const [cx, cy] = store.centre;
    if (Math.hypot(cx - c.x, cy - c.y) > 1.3) {
      if (this.stepToward(game, c, cx, cy, dt) === 'blocked') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return true;
    }
    // Its stage's pieces (`stageLoads`), and no more whole pieces than the hearth has room for.
    const n = Math.min(stageLoads(c), item.count, Math.floor((hearth.cap - hearth.fuel) / FUEL_VALUES[item.id]));
    item.count -= n;
    if (item.count <= 0) store.items.splice(store.items.indexOf(item), 1);
    store.changed();
    c.carrying = { uid: game.inventory.nextUid++, id: item.id, ql: item.ql, dmg: 0, count: n };
    c.workX = hearth.x;
    c.workY = hearth.y;
    c.job = hearth.kind;
    this.errandFetched(game, c);
    return true;
  }

  /**
   * A stoker's smelter work: `furnaceStep` for `smelt`, through `errandStep`, with what went in and what it made
   * (`making`) counted to its ledger as an errand's go is. The island's `errand_step` and `errand_do` asked for `smelt`.
   */
  private stokeSmelt(game: Game, c: Creature, dt: number, site: WorkSite): boolean {
    c.idle = null;
    const held = c.carrying ? { id: c.carrying.id, n: c.carrying.count } : null;
    this.went = false;
    this.making = [];
    let busy: boolean;
    let made: Array<[string, number]>;
    try {
      busy = this.errandStep(game, c, dt, 'smelt', site);
    } finally {
      made = this.making ?? [];
      this.making = null;
    }
    if (this.went && held) {
      const left = c.carrying?.id === held.id ? c.carrying.count : 0;
      if (left < held.n) this.toLedger(game, c, { item: held.id, n: held.n - left });
    }
    if (this.went) for (const [id, n] of made) this.toLedger(game, c, { item: id, n });
    return busy;
  }

  /** What a stoker has in its arms and nowhere to take, back into the nearest store with room (`storeFor`): a go. */
  private stokeBack(game: Game, c: Creature, dt: number): boolean {
    const held = c.carrying!;
    const st = this.storeFor(game, c, held);
    if (!st) return this.why(c, 'full');
    c.idle = null;
    c.job = null;
    if (Math.hypot(st.centre[0] - c.x, st.centre[1] - c.y) > 1.3) {
      if (this.stepToward(game, c, st.centre[0], st.centre[1], dt) === 'blocked') {
        c.state = 'idle';
        c.until = game.time + 2;
      }
      return true;
    }
    this.intoStores(game, held, st, st.x, st.y, false);
    c.carrying = null;
    this.toLedger(game, c, { item: held.id, n: held.count });
    this.errandWork(game, c, 'stoke');
    return true;
  }

  /**
   * Carry the fuel to the hearth it was fetched for, feed it as many whole pieces as it has room for while it is under
   * `HEARTH_FULL`, and light it if out (a brazier lights itself after dark). Pieces left over stay in its arms for the
   * next hearth or the stores (`stokeStep`).
   */
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
    let fed = 0;
    const light = (fuel: number, lit: boolean, cap: number, set: (f: number, l: boolean) => void, what: string, lights = true): void => {
      if (fuel >= HEARTH_FULL || per <= 0) return;
      fed = Math.max(0, Math.min(carrying.count, Math.floor((cap - fuel) / per)));
      if (fed <= 0) return;
      set(fuel + per * fed, lit || lights);
      this.gainSkill(game, c, GATHER_SKILL.stoke, 0.2);
      if (!lit && lights) game.logMsg(`${c.name} relit the ${what}.`, 'wildermon');
    };
    if (c.job === 'campfire') {
      const f = [...game.campfires.values()].find((k) => Math.floor(fireCentre(k)[0]) === c.workX && Math.floor(fireCentre(k)[1]) === c.workY);
      if (f) light(f.fuel, f.lit, FIRE_CAPACITY, (fuel, lit) => { f.fuel = fuel; f.lit = lit; }, 'campfire');
    } else if (c.job === 'smelter') {
      const sm = [...game.smelters.values()].find((k) => k.x === c.workX && k.y === c.workY);
      if (sm) light(sm.fuel, sm.lit, FIRE_CAPACITY, (fuel, lit) => { sm.fuel = fuel; sm.lit = lit; }, 'smelter');
    } else if (c.job === 'kiln') {
      const k = [...game.kilns.values()].find((n) => n.x === c.workX && n.y === c.workY);
      if (k) light(k.fuel, k.lit, FIRE_CAPACITY, (fuel, lit) => { k.fuel = fuel; k.lit = lit; }, 'kiln');
    } else if (c.job === 'furniture') {
      const f = [...game.furniture.values()].find((n) => n.x === c.workX && n.y === c.workY && furnitureDef(n.kind).hearth);
      if (f) light(f.fuel ?? 0, !!f.lit, hearthCapacity(f), (fuel, lit) => { f.fuel = fuel; f.lit = lit; }, furnitureDef(f.kind).name.toLowerCase(), f.kind !== 'brazier');
    }
    c.job = null;
    c.state = 'idle';
    c.until = game.time + 1;
    // Nothing fed (full by now, or gone): the fuel goes on to the next hearth or back to the stores (`stokeStep`).
    if (fed <= 0) return;
    game.events.emit('smelter');
    game.events.emit('world', c.workX, c.workY);
    // A go, timed as the island's errand times one (`workDuration`), and the pieces it fed in handled, as the island's
    // `worker_settle` counts a stoker's.
    this.toLedger(game, c, { item: carrying.id, n: fed });
    this.errandWork(game, c, 'stoke');
    carrying.count -= fed;
    if (carrying.count <= 0) c.carrying = null;
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
    game.logMsg(`${c.name} attacks: ${this.species(best).name.toLowerCase()} on the settlement.`, 'fight');
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
        // Something wild on the settlement: a spar is dropped at once for it.
        this.sparOff(c);
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
        this.sparOff(c);
        c.enemy = best.id;
        this.gainSkill(game, c, GATHER_SKILL.guard, GUARD_LEARN);
        return;
      }
    }
    // Nothing about: a spar with a Sparra of yours on the settlement, when one has picked it (`sparTaskSays`).
    if (this.sparGo(game, c, dt)) return;
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
    c.until = game.time + this.idleRest(c);
  }

  /**
   * Put two together. What the pairing throws is settled here and now, at the
   * covering, and carried by the dam: a sire that is sold, released or eaten
   * before the hour comes has already had his say. So is his name, and where
   * each trait came from, which the young one is born with as its pedigree.
   */
  pair(game: Game, dam: Creature, sire: Creature, husbandry: number, sex?: Sex): void {
    const care = (dam.care + sire.care) / 2;
    const { keepPlus, upPlus } = breedPlus(game);
    // A bronze mirror's copies (`mirrorCopy`), in every young of this covering.
    const copy = mirrorCopy(dam, sire);
    // And what the pair's blood does to the draw (`pairBlood`).
    const pb = pairBlood(dam, sire);
    const young = (): { traits: string[]; sex: Sex; from: Record<string, TraitSource>; line: Line } => {
      const bred = breedTraits(sire.traits, dam.traits, husbandry, care, game.rand, keepPlus, upPlus, copy, pb);
      // The one the breeder asked for (a Herdsman's Choose the Sex), or even odds.
      const born: Sex = sex ?? (game.rand() < 0.5 ? 'male' : 'female');
      // And how deep its line runs, off both parents as they stand now.
      const line = bredLine(bred.traits, { traits: dam.traits, line: dam.pedigree?.line }, { traits: sire.traits, line: sire.pedigree?.line });
      // And its parents' forms, at `FORM_PASS` for each that has one (`bredForm`).
      const form = bredForm(dam, sire, game.rand(), game.rand());
      return { traits: bred.traits, sex: born, from: bred.from, line, ...(form.formColour ? { formColour: true } : {}), ...(form.formSize ? { formSize: form.formSize } : {}) };
    };
    dam.unborn = { ...young(), sire: { id: sire.id, name: sire.name } };
    // And a second at the same covering, now and then (a Herdsman's Twins, and the dam's blood: `twinChance`).
    if (game.rand() < twinChance(game.perk('breed:twins', 0), dam)) dam.unborn.twin = young();
    // Carried for less of the time (a Herdsman's Quick Gestation, and the dam's blood: `gestationOf`).
    dam.due = game.time + gestationOf(game.perk('breed:gestation', 1), dam);
    // And both ready again sooner (a Herdsman's Short Rest): the rest left is the perk's share of it.
    dam.bredAt = game.time - BREED_REST * (1 - game.perk('breed:rest', 1));
    sire.bredAt = dam.bredAt;
    // And each mirror's mark used up, and said.
    for (const c of [dam, sire]) {
      if (!mirrored(c)) continue;
      const { mirror: _, ...rest } = c.boosts ?? {};
      c.boosts = Object.keys(rest).length ? rest : undefined;
      const id = mirrorTrait(c.traits);
      if (id) {
        game.logMsg(`Bronze mirror: ${mirrorNames(id)} from ${c.name} to the young. Mark used up.`, 'wildermon');
        // A mirror used on a pairing, for the journal (the island's `pair_them` the same).
        game.note('mirrored');
      }
    }
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
     * does; goes into an empty wildermon crate in your pack when something
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
      where = ' Follows you.';
    } else if (crate && 'kind' in crate) {
      mode = 'stored';
      where = ` In the empty wildermon crate at (${crate.x}, ${crate.y}) on ${game.deed?.name ?? 'your settlement'}.`;
    } else if (crate) {
      mode = 'stored';
      where = ' In the wildermon crate in your pack.';
    } else {
      where = ' No free companion slot or empty wildermon crate in your pack or on your settlement: released into the wild.';
    }
    const c = this.spawn(dam.species, at[0], at[1], mode, game.rand, game.time);
    c.traits = coming.traits;
    c.sex = coming.sex;
    if (coming.formColour) c.formColour = true;
    if (coming.formSize) c.formSize = coming.formSize;
    /*
     * And its pedigree, for good: the dam as she is now, and the sire and
     * where each trait came from as the covering wrote them down. A young one
     * of a covering made before pedigrees were kept has none, rather than
     * half of one.
     */
    c.pedigree = coming.sire ? { dam: { id: dam.id, name: dam.name }, sire: coming.sire, from: coming.from ?? {}, ...(coming.line ? { line: coming.line } : {}) } : null;
    c.hunger = 0.9;
    c.care = 0.5;
    c.health = maxHealth(c, def);
    if (crate) shutIn(game, c, crate);
    game.logMsg(`Born to ${dam.name}: ${SEX_NAMES[c.sex]} ${def.name.toLowerCase()}, ${traitList(c.traits)}.${mutationSaid(coming.from)}${where}`, 'wildermon');
    game.note('bred');
    // A page of the field guide, for a young one born to a dam somebody keeps:
    // one let go before her hour drops hers in the wild, and it is nobody's.
    if (dam.mode !== 'wild') game.guideMark(dam.species, 'bred');
    if (c.traits.some((t) => traitTier(t) === 'supreme' || traitTier(t) === 'fantastic')) game.note('goodblood');
    if (c.traits.some((t) => traitTier(t) === 'fantastic')) game.note('fantasticblood');
    // A mutation, the depth of its line and a wild form, for the journal (the island's `drop_young` the same).
    if (dam.mode !== 'wild') {
      if (mutationOf(coming.from)) game.note('mutated');
      const depth = Math.max(0, ...Object.values(coming.line ?? {}).map((d) => d ?? 0));
      if (depth > 1) game.note(`line:${depth}`);
      if (c.formColour || c.formSize) game.note('bred:form');
    }
    game.events.emit('creature');
    return c;
  }

  /** Off whatever spar it was in, and the one it was sparring with off it too (`sparTaskSays`). */
  private sparOff(c: Creature): void {
    if (c.sparWith == null) return;
    const o = this.list.get(c.sparWith);
    if (o && o.sparWith === c.id) {
      o.sparWith = null;
      if (o.state === 'spar') o.state = 'idle';
    }
    c.sparWith = null;
    if (c.state === 'spar') c.state = 'idle';
  }

  /**
   * Whether a guard may spar with a Sparra of yours on a settlement (`sparTaskSays`): a worker of yours there whose trade
   * is keeping watch, after nothing wild, not called over, resting or tired, not yielded, not sparring with another
   * Sparra, and with the Sparra inside its work range of the totem. The island's `spar_may`.
   */
  private sparMay(game: Game, g: Creature, s: Creature, site: WorkSite): boolean {
    return g.mode === 'deed' && g.post === null && g.mine !== false && sparsAsGuard(g) && g.enemy === null
      && g.state !== 'rest' && g.state !== 'toBed' && (g.worn ?? 0) < tireOf(g) && !yielded(g)
      && (g.sparWith == null || g.sparWith === s.id) && game.time - g.calledAt >= CALL_WINDOW
      && Math.max(Math.abs(site.x + 0.5 - s.x), Math.abs(site.y + 0.5 - s.y)) <= workRangeOf(g, this.species(g));
  }

  /**
   * A Sparra on a settlement (`sparTaskSays`): true while it is sparring or has yielded, which is all it does then.
   * Yielded, it stands until it has its breath back (`sparBack`). Otherwise it keeps to the guard it is sparring with
   * while that one may, or picks the guard whose turn it is -- the one that sparred longest ago -- and stands for it to
   * come; with none, it says so and goes about as any worker with nothing to do. The island's `worker_settle`.
   */
  private sparraStep(game: Game, c: Creature, site: WorkSite): boolean {
    if (yielded(c)) {
      this.sparOff(c);
      c.state = 'idle';
      c.moving = false;
      this.why(c, 'yielded', sparBack(c));
      return true;
    }
    if (c.idle?.why === 'yielded') c.idle = null;
    let g = c.sparWith != null ? this.list.get(c.sparWith) : undefined;
    if (g && !this.sparMay(game, g, c, site)) {
      this.sparOff(c);
      g = undefined;
    }
    if (!g && (c.state === 'idle' || c.state === 'wander') && game.time >= c.until) {
      let best: Creature | undefined;
      const turn = (o: Creature): number => o.sparAt ?? -Infinity;
      for (const o of this.list.values()) {
        if (!this.sparMay(game, o, c, site)) continue;
        if (!best || turn(o) < turn(best) || (turn(o) === turn(best) && o.id < best.id)) best = o;
      }
      if (best) {
        g = best;
        c.sparWith = g.id;
        g.sparWith = c.id;
      } else this.why(c, 'nospar');
    }
    if (!g) return false;
    c.idle = null;
    c.state = 'idle';
    c.moving = false;
    c.until = game.time;
    return true;
  }

  /**
   * A guard picked by a Sparra on the settlement (`sparTaskSays`): it walks to within `SPAR_REACH` of it and spars, a
   * go at its task and a blow each way at the end of it, and then the second after a go. True while it is about it,
   * and while it stands yielded. The island's `worker_settle`.
   */
  private sparGo(game: Game, c: Creature, dt: number): boolean {
    const s = c.sparWith != null ? this.list.get(c.sparWith) : undefined;
    if (!s || s.sparWith !== c.id || s.mode !== 'deed' || yielded(s) || s.state === 'rest' || s.state === 'toBed') {
      this.sparOff(c);
      // Yielded, it stands until it has its breath back.
      if (c.idle?.why === 'yielded') {
        if (yielded(c)) {
          c.moving = false;
          return true;
        }
        c.idle = null;
      }
      return false;
    }
    c.idle = null;
    if (c.state === 'spar') {
      if (game.time < c.until) return true;
      this.sparBlows(game, c, s);
      c.state = 'idle';
      c.until = game.time + 1;
      return true;
    }
    if (c.state === 'idle' && game.time < c.until) return true;
    if (Math.hypot(s.x - c.x, s.y - c.y) > SPAR_REACH) {
      if (this.stepToward(game, c, s.x, s.y, dt) === 'blocked') this.sparOff(c);
      return true;
    }
    c.state = 'spar';
    c.until = game.time + workDuration(c.skills[GATHER_SKILL.guard] ?? 1) / this.taskMul(c, 'guard');
    return true;
  }

  /** One blow in a spar, as one of yours strikes, and nothing besides: no style, no ability, no wound. The island's `spar_blow`. */
  private sparBlow(game: Game, a: Creature): number {
    return this.species(a).attack * this.mul(a, 'tough') * trainedHit(a.skills[FIGHT_SKILL] ?? 0) * (0.7 + game.rand() * 0.6);
  }

  /**
   * A go of a spar (`sparTaskSays`): a blow each way, neither taking anybody below where it yields (`sparFloor`); the
   * guard its level skill as an attack on a wild creature teaches it, the Sparra its fighting, and a go of stamina and
   * of the ledger each; then the Sparra picks again, so the guards take turns. The island's `spar_go`.
   */
  private sparBlows(game: Game, g: Creature, s: Creature): void {
    for (const [a, t] of [[g, s], [s, g]] as const) {
      t.health = Math.min(t.health, Math.max(sparFloor(t), t.health - this.sparBlow(game, a)));
      t.attackedAt = game.time;
      this.acted(a, 'strike', game.time);
    }
    g.sparAt = game.time;
    this.gainSkill(game, g, GATHER_SKILL.guard, GUARD_LEARN);
    // The Sparra its own skill, at what a spar on a settlement is worth (`bout`).
    const l = this.species(s).learns;
    if (l) this.gainSkill(game, s, l.skill, LEARNS_GAIN.bout, LEARN_PACE.bout);
    this.toLedger(game, g, { goes: 1 });
    this.toLedger(game, s, { goes: 1 });
    // A spar on your settlement, for the journal (the island's `spar_go` the same).
    if (s.mine !== false) game.note('sparred');
    this.sparOff(s);
    for (const o of [g, s]) if (yielded(o)) this.why(o, 'yielded', sparBack(o));
  }

  /** A go at its own task, for a kind that learns its own skill this way (`LearnsBy`). The island's `beast_learns`. */
  learnBy(game: Game, c: Creature, by: LearnsBy): void {
    const l = this.species(c).learns;
    if (l && l.by === by && c.mode !== 'wild') this.gainSkill(game, c, l.skill, LEARNS_GAIN[by]);
  }

  /** Same diminishing curve as the player's skills. */
  gainSkill(game: Game, c: Creature, id: string, base: number, pace = learnPace(c, id)): number {
    const v = c.skills[id] ?? 1;
    // A beast learns on the same curve a player does, and crawls the same last
    // stretch of it; its level skill at what its trade's goes are worth against every other trade's (`LEARN_PACE`),
    // or at the factor of what taught it, where that is not its own (a Sparra's spar on a settlement, `bout`).
    const gain = skillGain(v, base * this.learnMul(c, game.time) * pace, 0.6 + 0.8 * game.rand());
    const before = creatureLevel(c);
    const beforeSteps = rangeSteps(v);
    c.skills[id] = Math.min(100, v + gain);
    c.xp += gain;
    // What a worker learns at work is counted to its ledger (`worker_learn`).
    if (c.mode === 'deed' && c.skills[id] > v) this.toLedger(game, c, { skill: c.skills[id] - v });
    if (creatureLevel(c) > before) game.logMsg(`${c.name}: level ${creatureLevel(c)}.`, 'wildermon');
    // And evolves, at a level a stage begins at: what it can take grows with it, as full as it was (`EVOLVE_AT`).
    const stage = stageOf(c);
    const was = stageOf({ species: c.species, skills: { ...c.skills, [id]: v } });
    if (stage > was) {
      c.health *= STAGE_MUL.hardy ?? 1;
      // And a trait for each slot the stage opens (`stageSlots`), by its keeper's husbandry: you, for one of yours.
      openSlots(c, was, stage, c.mode === 'wild' ? 0 : game.skills.get('animal_husbandry'), game.rand);
      if (c.mode !== 'wild') game.logMsg(`${c.name} evolved: ${kindName(c)}.`, 'wildermon');
      // Each stage reached by one of yours, for the journal (the island's `worker_learn_paced` the same).
      if (c.mode !== 'wild' && c.mine !== false) for (let st = was + 1; st <= stage; st++) game.note(`evolved:${st}`);
      // And one nobody has named is called what it has become (`kindNamed`).
      if (kindNamed(c)) c.name = kindName(c);
      game.events.emit('evolve', c.id, stage);
      this.acted(c, 'evolve', game.time);
    }
    const def = this.species(c);
    if (c.mode === 'deed' && id === workSkill(def) && rangeSteps(c.skills[id]) > beforeSteps) {
      game.logMsg(`${c.name}: work range ${workRangeOf(c, def)} tiles.`, 'wildermon');
    }
    return gain;
  }

  private updateWild(c: Creature, dt: number, game: Game): void {
    c.hunger = Math.max(0, c.hunger - dt * HUNGER_RATE.wild * bloodMul(c, 'appetite'));
    const def = this.species(c);
    const kind = wildGather(def);
    if (c.state === 'flee') {
      if (game.time >= c.until) c.state = 'idle';
      // Frightened, it stands where its run ended until the fright is out, as the island's leg does (`fleeFrom`).
      else if (this.stepToward(game, c, c.tx, c.ty, dt, FLEE_PACE) !== 'moving' && markOn(game, c, 'fear', 0) <= 0) c.state = 'idle';
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
      if (c.brawl !== null) game.logMsg(`${this.species(c).name} attacks you again.`, 'fight');
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
    // Whatever it was about, it is about you now; and a blow of yours ends a fright, as on the island (`engage_beast`),
    // unless what it was on still holds it.
    if (c.state !== 'flee' || (c.brawl === null && markOn(game, c, 'fear', 0) > 0)) {
      if (c.marks?.fear) delete c.marks.fear;
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
      // And from closer by night to one in a Shadowcloak (`shadowNotice`), and to a more aware one (`awareNotice`).
      if (!mate && d > (def.notice ?? HUNT_SIGHT) * game.shadowNotice() * game.awareNotice()) return false;
      c.searchAt = game.time + 2;
      if (!this.tileOk(game, Math.floor(p.x), Math.floor(p.y))) return false;
      c.enemy = PLAYER_ATTACKER;
      c.huntX = c.x;
      c.huntY = c.y;
      c.blows = 0;
      c.windup = 0;
      c.packLead = !def.pack ? null : mate ? (mate.packLead ?? mate.id) : c.id;
      game.logMsg(mate ? `Another ${def.name.toLowerCase()} joins.` : `${def.name} hunting you.`, 'fight');
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
      } else game.logMsg(`${capital(name)} heavy blow: missed.`, 'fight');
      return true;
    }
    if (def.throws && this.throwStep(game, c, def, d, dt)) return true;
    if (d <= HUNT_REACH) {
      if (c.cooldown <= 0) {
        // Every `HEAVY_EVERY`th blow of a kind that hits heavy is drawn back for first.
        if (def.heavy && (c.blows + 1) % HEAVY_EVERY === 0) {
          c.windup = WIND_UP;
          game.logMsg(`${capital(name)} winding up a heavy blow: step out of reach.`, 'fight');
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
    game.logMsg(`${def.name} fled.`, 'fight');
  }

  /**
   * It runs from a spot for so long, as a Chaos Fright runs it (the island's `flee_from`): its hunt and its fight
   * dropped and none taken up meanwhile, and a leg away as far as it runs in that time at the pace a nerve gone makes
   * it (`FLEE_PACE`). It strikes nothing until the time is out. Frightened (`fear`), it stands where the run ends.
   */
  fleeFrom(game: Game, c: Creature, fx: number, fy: number, secs: number): void {
    const d = Math.max(0.001, Math.hypot(c.x - fx, c.y - fy));
    const run = Math.max(0.1, this.species(c).speed * ageDef(c, game.time).speed * this.speedMul(c) * FLEE_PACE) * secs;
    c.enemy = null;
    c.brawl = null;
    c.windup = 0;
    c.huntRest = Math.max(c.huntRest, game.time + secs);
    c.state = 'flee';
    c.tx = c.x + ((c.x - fx) / d) * run;
    c.ty = c.y + ((c.y - fy) / d) * run;
    c.until = game.time + secs;
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
        game.logMsg(`${c.name} attacks: ${this.species(found).name.toLowerCase()}.`, 'fight');
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
      // What it is worth to its learning and its care, by its quality (`fedOn`).
      fedOn(c, worst.id, worst.ql, game.time);
      if (worst.count > 1) worst.count -= 1;
      else crate.items.splice(crate.items.indexOf(worst), 1);
      c.hunger = Math.min(1, c.hunger + GRAZE_FILL);
      game.events.emit('crate');
      return true;
    }
    return false;
  }

  /** Nothing to do, and why (`IdleWhy`): kept on it for its card, and false, for a step to return. The island's `idle_why`. */
  private why(c: Creature, why: IdleWhy, n = 0, what?: string[]): false {
    c.idle = { why, n, post: c.post !== null, ...(what?.length ? { what } : {}) };
    return false;
  }

  /**
   * Counted to a worker's ledger for the island day it is (`ledgerAdd`), as the island's `ledger_add` counts it; and a
   * go spends a `TIRE_GOES`th of its stamina (`worn`), as the island's `worker_settle` spends it where it counts one.
   */
  private toLedger(game: Game, c: Creature, add: { goes?: number; skill?: number; item?: string; n?: number }): void {
    if (c.mode !== 'deed') return;
    // As it stood, since `ledgerAdd` writes into the day it is on.
    const was = c.ledger ? { ...c.ledger, now: { ...c.ledger.now, made: { ...c.ledger.now.made } } } : null;
    c.ledger = ledgerAdd(c.ledger, game.islandDay(), add);
    // And onto its lifetime, what that write added (`workFromLedger`), as the island's `work_stats_keep` puts it on.
    c.work = workFromLedger(c.work, was, c.ledger);
    if (add.goes) {
      this.went = true;
      c.worn = (c.worn ?? 0) + add.goes;
      // And a wildermon pack that carries for it wears a cycle (`packLoads`, `wildgear.ts`).
      if (packLoads(c)) this.wearGear(game, c, 'pack');
    }
  }

  /**
   * Out of the bed it is in or walking to, if any: the bed is free again (`PlacedFurniture.sleeper`). When it gets up,
   * is called over, stops working or dies. The island clears `placed.sleeper` at the same moments (`worker_settle`,
   * `creature_out_of_bed`).
   */
  outOfBed(game: Game, c: Creature): void {
    if (c.bed === undefined) return;
    const f = game.furniture.get(c.bed);
    if (f?.sleeper === c.id) {
      f.sleeper = undefined;
      game.events.emit('world', f.x, f.y);
    }
    c.bed = undefined;
  }

  /** Whether a bed is free for this one: nobody in it, or only somebody who is no longer lying there. */
  private bedFree(f: PlacedFurniture, c: Creature): boolean {
    if (f.sleeper === undefined || f.sleeper === c.id) return true;
    const o = this.list.get(f.sleeper);
    return !o || o.mode !== 'deed' || o.bed !== f.id;
  }

  /**
   * The nearest wildermon bed on its settlement that is free and of its own class (`denClass`, `fitsDen`), or none.
   * The island's `free_bed`.
   */
  freeBed(game: Game, c: Creature): PlacedFurniture | undefined {
    const cls = denClass(c);
    let best: PlacedFurniture | undefined;
    let bestD = Infinity;
    for (const f of game.furniture.values()) {
      if (!fitsDen(f.kind, cls) || !game.onDeed(f.x, f.y) || !this.bedFree(f, c)) continue;
      const [fx, fy] = furnitureCentre(f);
      const d = Math.hypot(fx - c.x, fy - c.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  /**
   * Resting (`TIRE_GOES`, `REST_FOR`): true while it rests or walks to a bed to rest in, which is all it does. With no
   * stamina left, standing idle with its arms empty -- or between the steps of an errand, whatever it holds -- it
   * walks to the nearest free bed of its size on the settlement and sleeps in it for `BED_REST` of the rest, or rests
   * where it stands for all of it; and gets up with its stamina full. The island's `worker_settle`, phases `bed` and
   * `rest`.
   */
  private restStep(game: Game, c: Creature, dt: number, kind: GatherKind | null): boolean {
    const post = c.post !== null;
    if (c.state === 'toBed') {
      const f = c.bed !== undefined ? game.furniture.get(c.bed) : undefined;
      if (!f || !this.bedFree(f, c) || !fitsDen(f.kind, denClass(c))) {
        // Gone, or taken by another on the way: it looks again.
        c.bed = undefined;
        c.state = 'idle';
      } else {
        const [bx, by] = furnitureCentre(f);
        const r = Math.hypot(bx - c.x, by - c.y) <= 1.3 ? 'arrived' : this.stepToward(game, c, bx, by, dt);
        if (r === 'moving') {
          c.idle = { why: 'tired', n: 0, post, bed: f.kind };
          return true;
        }
        c.state = 'rest';
        if (r === 'arrived') {
          f.sleeper = c.id;
          // In a bed you built, for the journal (the island's `worker_settle` the same).
          if (c.mine !== false && f.mine !== false) game.note('bedded:own');
          c.x = bx;
          c.y = by;
          game.events.emit('world', f.x, f.y);
          c.restUntil = game.time + restFor(true, c);
        } else {
          // No way through to it: it rests where it stands.
          c.bed = undefined;
          c.restUntil = game.time + restFor(false, c);
        }
      }
    }
    if (c.state === 'rest') {
      if (game.time >= (c.restUntil ?? 0)) {
        this.outOfBed(game, c);
        c.worn = 0;
        c.restUntil = undefined;
        c.state = 'idle';
        c.until = game.time;
        c.idle = null;
        return false;
      }
      const f = c.bed !== undefined ? game.furniture.get(c.bed) : undefined;
      c.moving = false;
      c.idle = f?.sleeper === c.id
        ? { why: 'bed', n: (c.restUntil ?? 0) - game.time, post, bed: f.kind }
        : { why: 'rest', n: (c.restUntil ?? 0) - game.time, post };
      return true;
    }
    if ((c.worn ?? 0) < tireOf(c) || c.state !== 'idle' || game.time < c.until) return false;
    if (c.carrying && !(kind && (ERRAND_JOBS.has(kind) || kind === 'stoke'))) return false;
    // Done sparring for now (`sparTaskSays`).
    this.sparOff(c);
    const f = this.freeBed(game, c);
    if (f) {
      c.bed = f.id;
      c.state = 'toBed';
      c.idle = { why: 'tired', n: 0, post, bed: f.kind };
    } else {
      c.state = 'rest';
      c.restUntil = game.time + restFor(false, c);
      c.idle = { why: 'rest', n: restFor(false, c), post };
    }
    return true;
  }

  /** Set when a worker's step has just counted a go to its ledger, for what was in its arms to be counted with it. */
  private went = false;

  /**
   * What an errand's step put into the stores as its work (`intoStores`), while one is being stepped, for its go to
   * count to its ledger; null otherwise. The island's `wurm.made` (`worker_made_take`).
   */
  private making: Array<[string, number]> | null = null;

  private updateWorker(c: Creature, dt: number, game: Game): void {
    // The time onto its lifetime, by why it stood about for it, or at work for nothing (`workTime`).
    if (c.mode === 'deed') c.work = workTime(c.work, dt, c.idle?.why);
    this.workerStep(c, dt, game);
    /*
     * Off its ground, which is what its card says until it is back on it,
     * whatever else it is about: the island walks it home before anything
     * else (`worker_settle`), by the same test, and says `far` while it does.
     */
    const site = c.mode === 'deed' ? game.workSite(c) : null;
    if (!site) return;
    const off = Math.max(Math.abs(site.x + 0.5 - c.x), Math.abs(site.y + 0.5 - c.y)) > siteRange(c, this.species(c), site) + HOME_SLACK;
    // Resting is what it is doing wherever it rests, as the island's rest comes before its walk home.
    if (c.state === 'rest' || c.state === 'toBed') return;
    if (off) c.idle = { why: 'far', n: Math.hypot(site.x + 0.5 - c.x, site.y + 0.5 - c.y), post: c.post !== null };
    else if (c.idle?.why === 'far') c.idle = null;
  }

  private workerStep(c: Creature, dt: number, game: Game): void {
    c.hunger = Math.max(0, c.hunger - dt * HUNGER_RATE.deed * bloodMul(c, 'appetite') * keptOf(c, 'kept:hunger', 1));
    // Its time at work since it last ate (`UPKEEP_FOR`), which a meal puts back to nought (`fedOn`).
    c.unfed = (c.unfed ?? 0) + dt;
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
    if (this.comeWhenCalled(c, dt, game)) {
      // Called over, it gets out of bed for it, and finishes its rest where it is let go.
      this.outOfBed(game, c);
      return;
    }
    // Nothing in its arms is nothing to walk home with, whatever it was doing when its arms emptied.
    if (!c.carrying && c.homeward) c.homeward = false;
    const def = this.species(c);
    const kind = c.trade ?? def.gathers;
    // Resting, or too tired to do anything else (`TIRE_GOES`).
    if (this.restStep(game, c, dt, kind)) return;
    // Standing orders come before any job: an intruder is everyone's business. A guard's trade is meeting it, whatever
    // its stance, as the island's `fight_target` has it for a trade that fights: its own step looks (`guardStep`).
    if (kind !== 'guard' && this.defendDeed(game, c, dt, deed)) {
      this.sparOff(c);
      return;
    }
    if (kind === 'guard') {
      this.guardStep(game, c, dt, deed);
      return;
    }
    // A Sparra on the settlement spars with a guard of yours there (`sparTaskSays`), or eats and potters about as any.
    if (def.style === 'spar' && c.post === null && this.sparraStep(game, c, deed)) return;
    // A stoker with fuel for a hearth in its arms feeds it (`feedFire`); otherwise its own step (`stokeStep`).
    if (kind === 'stoke' && !(c.carrying && c.job) && c.state !== 'forage') {
      if (this.stokeStep(game, c, dt, deed)) return;
    }
    if (kind === 'hunt' && !c.carrying && c.state !== 'forage') {
      if (this.packHunt(game, c, dt, deed)) return;
    }
    if (kind && ERRAND_JOBS.has(kind) && c.state !== 'forage') {
      // Whatever it finds to do clears why it had nothing; a step that finds nothing says why (`why`).
      c.idle = null;
      const held = c.carrying ? { id: c.carrying.id, n: c.carrying.count } : null;
      this.went = false;
      this.making = [];
      let busy: boolean;
      let made: Array<[string, number]>;
      try {
        busy = this.errandStep(game, c, dt, kind, deed);
      } finally {
        made = this.making ?? [];
        this.making = null;
      }
      // What was in its arms and went into a go is what it handled, as the island's `worker_settle` counts it.
      if (this.went && held) {
        const left = c.carrying?.id === held.id ? c.carrying.count : 0;
        if (left < held.n) this.toLedger(game, c, { item: held.id, n: held.n - left });
      }
      // And what the go made and put into the stores (`intoStores`), as the island's counts it (`worker_made_take`).
      if (this.went) for (const [id, n] of made) this.toLedger(game, c, { item: id, n });
      if (busy) return;
    }
    if (c.state === 'forage') {
      if (game.time >= c.until) {
        // What it got goes into its arms with whatever it has gathered already this trip (`stageLoads`).
        // And its line's third-stage `more` on it (`perkMore`).
        const got = kind === 'hive' ? this.finishForage(game, c, kind) : kind ? perkMore(c, this.finishForage(game, c, kind)) : null;
        if (got) {
          if (c.carrying) (c.laden ??= []).push(c.carrying);
          c.carrying = got;
        }
        if (kind) this.acted(c, 'work', game.time);
        if (kind) this.toLedger(game, c, { goes: 1 });
        c.state = 'idle';
        // A Vesp is off back to its hive at once, as the island sends it.
        c.until = game.time + (kind === 'hive' ? 0 : 0.5);
      }
      return;
    }
    if (c.carrying && kind === 'stoke') {
      if (c.job) this.feedFire(game, c, dt);
      return;
    }
    // A Vesp with what it gathered flies it to its hive, not to the stores (`vespHome`).
    if (c.carrying && kind === 'hive') {
      this.vespHome(game, c, dt);
      return;
    }
    // With room in its arms for another load of its trade (`stageLoads`), it goes on to the next tile rather than home.
    if (c.carrying && !this.roomInArms(c, kind)) {
      c.homeward = true;
      if (c.hunger < HUNGRY && isBaitFor(def, c.carrying.id)) {
        c.hunger = Math.min(1, c.hunger + 0.5);
        fedOn(c, c.carrying.id, c.carrying.ql, game.time);
        c.carrying = c.laden?.shift() ?? null;
        if (!c.carrying) c.homeward = false;
        return;
      }
      const store = this.storeFor(game, c, c.carrying);
      if (!store) {
        // Everything on the deed is full. A worker will not tip a load out on
        // the ground: it holds on to it and waits for room.
        this.why(c, 'full');
        if (game.time - c.noRoomAt > 60) {
          c.noRoomAt = game.time;
          game.logMsg(`${c.name} holding ${itemDef(c.carrying.id).name.toLowerCase()}: settlement storage full.`, 'error');
        }
        this.wanderTarget(game, c, 2, deed.x + 0.5, deed.y + 0.5);
        c.state = 'wander';
        c.until = game.time + 5;
        return;
      }
      const [dx, dy] = store.centre;
      if (Math.hypot(dx - c.x, dy - c.y) <= 1.3) {
        const load = c.carrying;
        if (!store.add(load)) return;
        // Brought in: counted to its ledger as the island counts a load into a store (`worker_settle`'s `home`).
        this.toLedger(game, c, { item: load.id, n: load.count });
        // And the next load of the trip, put away the same way, until its arms are empty.
        c.carrying = c.laden?.shift() ?? null;
        if (!c.laden?.length) c.laden = undefined;
        if (!c.carrying) c.homeward = false;
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
     * Pigroot's mouth, so seed left in one is seed nobody can see, count, cook
     * or plant by hand. Reported from the island as a farm hand that harvested
     * all season and put nothing but the crop in the crate.
     *
     * It goes in at the next store it stands at, which in the ordinary run of
     * things is the one it has just put the harvest into — so the round trip
     * this costs is usually no trip at all. Only when there is somewhere for
     * it to go: a worker with its hands full and nowhere to empty them stops
     * working, and a mouthful of seed is not worth stopping a farm for.
     */
    if (!c.carrying && c.pouch && c.pouch.count > 0 && this.storeFor(game, c, c.pouch)) {
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
            fedOn(c, it.id, it.ql, game.time);
            it.count -= 1;
            if (it.count <= 0) larder.items.splice(idx, 1);
            larder.changed();
            c.hunger = Math.min(1, c.hunger + 0.5);
            game.logMsg(`${c.name} ate ${itemDef(it.id).name.toLowerCase()} from the ${larder.name.toLowerCase()}.`, 'wildermon');
          }
        } else this.stepToward(game, c, lx, ly, dt);
        return;
      }
    }
    if (c.state === 'toForage') {
      const r = this.stepToward(game, c, c.tx, c.ty, dt);
      if (r === 'arrived') {
        // A fetcher works the tile it was sent to: what lies on it, or the store standing on it it sorts (`sortStack`).
        const apart = !!kind && (kind === 'fetch' || this.worksBeside(game, kind, c.workX, c.workY));
        const wx = apart ? c.workX : Math.floor(c.x);
        const wy = apart ? c.workY : Math.floor(c.y);
        // A Vesp works the flower it flew to, its hive being its work (`vespTrip`), as the island's `out` does.
        if (kind === 'hive') this.beginForage(game, c, kind);
        else if (kind && (this.gatherable(game, wx, wy, kind, c) || (kind === 'fetch' && this.sortStack(game, c, wx, wy)))) this.beginForage(game, c, kind);
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
    // A Vesp: out from the nearest hive in its range with room to the next flower in reach of it, or why not (`vespTrip`).
    if (kind === 'hive') {
      const trip = vespTrip(game, c.x, c.y, deed.x, deed.y, siteRange(c, def, deed), ledgerRoll(c.ledger, game.islandDay()).now.goes, game.wallNow());
      if ('hive' in trip) {
        c.idle = null;
        c.job = null;
        c.workX = trip.hive.x;
        c.workY = trip.hive.y;
        c.tx = trip.x + 0.5;
        c.ty = trip.y + 0.5;
        c.tripAt = game.time;
        c.state = 'toForage';
        return;
      }
      this.why(c, trip.why, trip.n);
      this.wanderTarget(game, c, 3, deed.x + 0.5, deed.y + 0.5);
      c.until = game.time + this.idleRest(c);
      return;
    }
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
          c.idle = null;
          c.job = kind === 'farm' ? this.farmJobAt(game, c, t.x, t.y) : null;
          c.workX = t.x;
          c.workY = t.y;
          c.tx = spot.x + 0.5;
          c.ty = spot.y + 0.5;
          c.state = 'toForage';
          return;
        }
      }
      // Nothing lying about: a magga on its settlement sorts the stores into the bins (`sortStack`), the island's
      // `worker_settle` off `sort_stack`.
      const sort = kind === 'fetch' && c.post === null ? this.sortStack(game, c) : null;
      if (sort) {
        c.idle = null;
        c.job = null;
        c.workX = sort.x;
        c.workY = sort.y;
        [c.tx, c.ty] = sort.centre;
        c.state = 'toForage';
        return;
      }
      // Nothing more to be had and loads in its arms: home with what it has.
      if (c.carrying) {
        c.homeward = true;
        return;
      }
    }
    // Nothing of its trade within its range of the token: the island's `find_work_tile` coming back empty. An errand
    // trade has said its own why already.
    if (kind && !ERRAND_JOBS.has(kind) && kind !== 'stoke') this.why(c, 'range', siteRange(c, def, deed));
    // Nothing to do right now: potter about near the token.
    this.wanderTarget(game, c, 3, deed.x + 0.5, deed.y + 0.5);
    c.until = game.time + this.idleRest(c);
  }

  /**
   * Whether a worker with a load in its arms goes on for another rather than home: a trade that walks out to the
   * ground and carries loads home (`LOAD_TRADES`), with fewer in its arms than its stage carries (`stageLoads`), and
   * not already on its way home. The island's `worker_settle`, off `loads_in` and `stage_loads`.
   */
  private roomInArms(c: Creature, kind: GatherKind | null): boolean {
    return !!kind && LOAD_TRADES.has(kind) && !ERRAND_JOBS.has(kind) && !c.homeward && loadsIn(c) < stageLoads(c);
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
   * The stack a magga sorts next (`GATHER_DO.fetch`): out of the store standing on (`atX`, `atY`) when given, the
   * nearest to it otherwise; with how many of it the roomiest raw or craft material bin on the settlement that takes it
   * (`furnitureRefuses`) has room for (`furnitureRoom`). Out of a crate, or furniture that may be marked a store
   * (`storeMarkable`) and takes anything; never out of a bin, a padlocked or marked store, or a locked item. Null
   * when there is none, or no such bin. The island's `sort_stack`.
   */
  sortStack(game: Game, c: Creature, atX?: number, atY?: number):
    { x: number; y: number; centre: [number, number]; store: DeedStore; item: Item; n: number } | null {
    const bins: PlacedFurniture[] = [];
    for (const f of game.furniture.values()) {
      const takes = furnitureDef(f.kind).takes;
      if ((takes === 'raw' || takes === 'worked') && game.onDeed(f.x, f.y)) bins.push(f);
    }
    if (!bins.length) return null;
    const rooms = new Map<string, number>();
    const roomFor = (it: Item): number => {
      let n = rooms.get(it.id);
      if (n === undefined) {
        n = 0;
        for (const b of bins) if (!furnitureRefuses(b, it)) n = Math.max(n, furnitureRoom(b, it));
        rooms.set(it.id, n);
      }
      return n;
    };
    type Source = { kind: 0 | 1; id: number; x: number; y: number; centre: [number, number]; store: DeedStore };
    const sources: Source[] = [];
    const stores = game.deedStores();
    const storeAt = (x: number, y: number, items: Item[]): DeedStore | undefined => stores.find((s) => s.x === x && s.y === y && s.items === items);
    const at = (x: number, y: number): boolean => atX === undefined || (x === atX && y === atY);
    for (const cr of game.crates.values()) {
      if (cr.lock || cr.storeOf || !at(cr.x, cr.y) || !game.onDeed(cr.x, cr.y)) continue;
      const store = storeAt(cr.x, cr.y, cr.items);
      if (store) sources.push({ kind: 0, id: cr.id, x: cr.x, y: cr.y, centre: crateCentre(cr), store });
    }
    for (const f of game.furniture.values()) {
      const def = furnitureDef(f.kind);
      if (def.takes || f.lock || f.storeOf || !storeMarkable(f.kind, def) || !at(f.x, f.y) || !game.onDeed(f.x, f.y)) continue;
      const store = storeAt(f.x, f.y, f.items);
      if (store) sources.push({ kind: 1, id: f.id, x: f.x, y: f.y, centre: furnitureCentre(f), store });
    }
    const [fx, fy] = atX === undefined ? [c.x, c.y] : [atX + 0.5, (atY ?? 0) + 0.5];
    const d2 = (s: Source): number => (s.centre[0] - fx) ** 2 + (s.centre[1] - fy) ** 2;
    sources.sort((a, b) => d2(a) - d2(b) || a.kind - b.kind || a.id - b.id);
    for (const s of sources) {
      for (const item of s.store.items) {
        if (item.count <= 0 || item.locked) continue;
        const room = roomFor(item);
        if (room > 0) return { x: s.x, y: s.y, centre: s.centre, store: s.store, item, n: Math.min(item.count, room) };
      }
    }
    return null;
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
    let dmg = this.species(a).attack * this.mul(a, 'tough') * trained * (0.7 + game.rand() * 0.6) * game.herdMul(a, 'dealt')
      * (style === 'bore' && this.species(t).hide ? BODKIN_HIDE : 1)
      * (style === 'flank' && this.elsewhere(t, a) ? BLINDSIDE : 1)
      // And smaller while its claws are dulled (`binder_dull_claws`).
      * markOn(game, a, 'dull');
    // A heavy blow, at its blood's chance (`heavy`): `HEAVY_HIT` as hard. The dice are thrown only for one that has a chance.
    const heavy = this.chance(a, 'heavy');
    const big = heavy > 0 && game.rand() < heavy;
    if (big) dmg *= HEAVY_HIT;
    this.hurt(game, t, dmg, a, big);
    if (style && t.health > 0 && this.list.has(t.id)) this.styleBlow(game, a, t, style, dmg);
    // And a bleed, at its blood's chance (`rip`), as a knife opens it; a kind whose bites bleed already bleeds it.
    const rip = style === 'bleed' ? 0 : this.chance(a, 'rip');
    if (rip > 0 && game.rand() < rip && t.health > 0 && this.list.has(t.id)) {
      t.bleedRate = Math.max(t.bleedRate, dmg * KNIFE_BLEED);
      t.bleedFrom = game.time;
      t.bleedUntil = game.time + KNIFE_BLEED_SECS;
    }
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
      case 'fear': {
        // Monsters are not frightened, as a Fright does not frighten them; and one already running from it is left to run.
        // As long as its blood's `fear` lets it run: never, for one that is fearless.
        const secs = f('secs') * this.mul(t, 'fear');
        if (tdef.monster || secs <= 0 || markOn(game, t, 'fear', 0) > 0 || t.mode !== 'wild') return false;
        this.fleeFrom(game, t, a.x, a.y, secs);
        putMark(game, t, 'fear', 1, secs);
        break;
      }
      case 'chirurgeon_leech': {
        const was = t.health;
        const top = maxHealth(t, tdef);
        const b = this.blowAt(game, a, t, f('more'));
        a.health = Math.min(maxHealth(a, this.species(a)), a.health + (Math.min(b.dmg, was) / top) * maxHealth(a, this.species(a)));
        break;
      }
    }
    putMark(game, a, 'ability', 1, abilityRestOf(a, id));
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
    putMark(game, c, 'ability', 1, abilityRestOf(c, id));
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
      // As much as its blood's `venom` lets in: none, for one that is venom-proof.
      const rate = maxHealth(t, this.species(t)) * VENOM_DRAIN * this.mul(t, 'venom');
      if (rate <= 0) return;
      const running = t.bleedUntil > game.time;
      t.bleedRate = running ? Math.max(t.bleedRate, rate) : rate;
      if (!running) t.bleedFrom = game.time;
      t.bleedUntil = Math.max(running ? t.bleedUntil : 0, game.time + VENOM_SECS);
    } else if (style === 'stun') {
      a.blows += 1;
      // As a Concussion stuns it (`stun` in `enchanting.ts`).
      if (a.blows % HEAVY_EVERY === 0) {
        // And its line's third-stage `stun` longer (`perkN`).
        t.stunUntil = Math.max(t.stunUntil ?? 0, game.time + STUN_SECS + perkN(a, 'stun'));
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
        if (a.mode === 'active') game.logMsg(`${this.species(o).name} attacks ${a.name}.`, 'fight');
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
    if (by.mode === 'active') game.logMsg(`${this.species(t).name} attacks ${by.name}.`, 'fight');
  }

  /** A use's wear on the wildermon gear in a slot (`wearGear`), said to its keeper when it falls apart. The island's `gear_wear`. */
  wearGear(game: Game, c: Creature, slot: GearSlot): void {
    const it = c.gear?.[slot];
    if (it && wearGear(c, slot) && c.mine !== false) game.logMsg(gearGoneSays(c, it), 'wildermon');
  }

  /** Deal damage from a creature or the player; timid wild creatures bolt, and a kill leaves a corpse. */
  hurt(game: Game, t: Creature, dmg: number, by: Creature | 'player', crit = false): void {
    const from = by === 'player' ? game.player : by;
    const before = t.health;
    // What a blow costs it is its blood's to say, and its herd's.
    // And less on your companion inside a Heart of the Herd (`herd_heart`).
    // And more while it is brittle, and less inside a stone skin (`binder_brittle`, `warder_stoneskin`; the island's `class_brittle`).
    // And less for wildermon barding on it (`bardingMul`), which wears a blow (`wearGear`).
    t.health -= dmg * this.mul(t, 'soak') * game.herdMul(t, 'taken') * markOn(game, t, 'brittle') * markOn(game, t, 'stone') * bardingMul(t);
    if (t.gear?.barding) this.wearGear(game, t, 'barding');
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
    if (t.mode === 'active' && by !== 'player' && game.time - (t.busyUntil ?? 0) > 0) game.logMsg(`${t.name} hurt by a ${this.species(by).name.toLowerCase()}.`, 'fight');
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
    // And a bed it was asleep in is free.
    this.outOfBed(game, t);
    // A hunter marks where its kill went down and comes back for it.
    if (killer && killer !== 'player' && this.species(killer).gathers === 'hunt' && !killer.carrying) {
      killer.workX = Math.floor(t.x);
      killer.workY = Math.floor(t.y);
      this.gainSkill(game, killer, FIGHT_SKILL, 0.4);
    }
    this.list.delete(t.id);
    for (const o of this.list.values()) if (o.enemy === t.id) o.enemy = null;
    const def = this.species(t);
    // A rare wildermon killed: the island counts it, as it counts every kill.
    if (t.rare && killer === 'player') game.note('slewrare');
    // Killing one of the bad things is worth writing down.
    if (def.monster && killer === 'player') {
      game.note(`slew:${def.id}`);
      if (!quiet) game.logMsg(`Killed: ${def.name.toLowerCase()}. Butcher it before it rots.`, 'fight');
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
    if (killer === 'player') game.logMsg(`Killed: wild ${def.name.toLowerCase()}.`, 'fight');
    else if (t.mode === 'active' || t.mode === 'deed') game.logMsg(`${t.name} died.`, 'fight');
    else if (killer && killer.mode !== 'wild') game.logMsg(`${killer.name} killed a wild ${def.name.toLowerCase()}.`, 'fight');
  }

  describe(c: Creature): string {
    const job = c.trade ?? this.species(c).gathers;
    const verb = job ? GATHER_VERB[job] : 'busy';
    if (c.ridden) return 'ridden';
    if (c.hitchedTo !== null) return 'in the traces';
    switch (c.mode) {
      case 'active':
        return `your companion · ${STANCE_NAMES[c.stance].toLowerCase()}`;
      case 'deed':
        if (c.carrying) return `settlement worker · carrying ${itemDef(c.carrying.id).name.toLowerCase()}`;
        if (c.state === 'forage') return `settlement worker · ${job === 'farm' && c.job ? `${c.job}ing a field` : verb}`;
        return 'settlement worker';
      case 'stored':
        return 'in a wildermon crate';
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
        formColour: c.formColour || undefined,
        formSize: c.formSize ?? undefined,
        x: c.x,
        y: c.y,
        mode: c.mode,
        stance: c.stance,
        health: c.health,
        hunger: c.hunger,
        carrying: c.carrying,
        laden: c.laden?.length ? c.laden : undefined,
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
        boosts: c.boosts,
        gear: c.gear,
        care: c.care,
        fedBonus: c.fedBonus,
        fedUntil: c.fedUntil,
        bredAt: c.bredAt,
        due: c.due,
        unborn: c.unborn,
        pedigree: c.pedigree,
        homeX: c.homeX,
        homeY: c.homeY,
        trade: c.trade,
        shodAt: c.shodAt,
        ledger: c.ledger ?? undefined,
        work: c.work ?? undefined,
        worn: c.worn || undefined,
        restUntil: c.restUntil,
        bed: c.bed,
        unfed: c.unfed || undefined,
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
      Object.assign(c, { name: j.name, variant: j.variant, formColour: j.formColour, formSize: j.formSize, stance: j.stance, health: j.health, hunger: j.hunger, carrying: j.carrying ?? null, laden: j.laden?.length ? j.laden : undefined, pouch: j.pouch ?? null, xp: j.xp ?? 0, fleece: j.fleece ?? 1, tacked: !!j.tacked, tack: j.tack, tackEnchant: j.tackEnchant, shodAt: j.shodAt ?? -1e9, pannier: j.pannier ?? [], post: j.post ?? null, trapped: j.trapped ?? null, born: j.born ?? 0, sex: j.sex ?? (j.id % 2 ? 'male' : 'female'), traits: j.traits ?? rollTraits(Math.random), rare: j.rare ?? 0, boosts: j.boosts ?? undefined, care: j.care ?? 0, bredAt: j.bredAt ?? -1e9, due: j.due ?? 0, unborn: j.unborn ?? null, pedigree: j.pedigree ?? null, homeX: j.homeX ?? j.x, homeY: j.homeY ?? j.y, trade: j.trade && (SPECIES[j.species]?.trades ?? []).includes(j.trade) ? j.trade : null, skills: carriedSkills(SPECIES[j.species] ?? SPECIES.rabba, j.skills), fedBonus: j.fedBonus, fedUntil: j.fedUntil, ledger: j.ledger ?? null, work: j.work ?? null, worn: j.worn, restUntil: j.restUntil, bed: j.bed, unfed: j.unfed });
      if (j.gear) c.gear = j.gear;
      // A rest it was taking when the game was saved goes on where it left off, or the walk to its bed (`restStep`).
      if (c.restUntil !== undefined) c.state = 'rest';
      else if (c.bed !== undefined) c.state = 'toBed';
      cs.list.set(c.id, c);
      if (c.id >= cs.nextId) cs.nextId = c.id + 1;
    }
    return cs;
  }
}
