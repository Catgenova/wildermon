import type { Goal } from './journal';
import type { Game } from './game';
import { CROP_LIST } from './farming';
import { FURNITURE_BY_ID, furnitureCapacity, furnitureUnits } from './furniture';
import { ARMOUR } from './gear';
import { IMPROVED_TO } from './improve';
import { MOULD_BY_MAKES } from './metal';
import { balance, NUTRIENT_NAMES, NUTRIENTS, WANTING_NOTHING } from './nutrition';
import { SIGN_QL } from './signing';
import { SKEP_IDLE } from './bees';
import { SEASONS } from '../world/calendar';
import { FLOWER_SEASONS } from '../world/flowers';
import { lairOf } from '../world/regions';
import { TREE_DEFS } from '../world/tiles';
import { listed } from './words';

/*
 * Thirty-six more goals for the journal's crafts, land and water chapters.
 *
 * Every count read here is the island's (`Game.tallyFromIsland`), noted for
 * whoever did the thing where it happens (`journal_note`; the island's side is
 * `supabase/migrations/20261023071034_goals_crafts_land_water.sql`), or
 * something of your own the browser already holds: your pack, what you wear,
 * your pieces, your wildermon and your body. Nothing is imported from
 * `journal.ts`, which imports this, so either may load first.
 */

const did = (key: string, n = 1) => (g: Game): boolean => (g.tally[key] ?? 0) >= n;
/** How many of the keys have been noted at all. */
const kinds = (g: Game, keys: Iterable<string>): number => [...keys].filter((k) => (g.tally[k] ?? 0) > 0).length;
/** Your own, not a neighbour's in view (as `journal.ts` reads them). */
const ours = <T extends { mine?: boolean }>(xs: Iterable<T>): T[] => [...xs].filter((x) => x.mine !== false);

/**
 * Everything Crafting cooks at a campfire, handed over by `recipes.ts` as it
 * loads, as `journal.ts` has it for its own campfire goal: importing the
 * recipes here would start them ahead of the game they lean on.
 */
const DISHES = new Set<string>();
export function cookedDishes(ids: Iterable<string>): void {
  for (const id of ids) DISHES.add(id);
}

/** Arrows of every head, as Crafting fletches them. */
const ARROWS = ['arrow', 'broadhead_arrow', 'bodkin_arrow', 'blunt_arrow'];
/** Goal sizes: how many of a thing the journal asks for. */
const BRICKS = 20;
const FLETCHED = 50;
const IMPROVED_ITEMS = 10;
const DISH_KINDS = 10;
const FRUIT_KINDS = 4;
const SAIL_TILES = 1000;

/** The slots a full suit covers, off the armour table. */
const SUIT_SLOTS = [...new Set(ARMOUR.map((a) => a.slot))];
/** A piece of armour cast in a mould is metal: chain and plate. */
const metalArmour = (id: string | undefined): boolean => !!id && !!MOULD_BY_MAKES.get(id) && ARMOUR.some((a) => a.id === id);

/** The fruit a tree bears, each once. */
const FRUITS = [...new Set(TREE_DEFS.map((t) => t.fruit).filter((f): f is string => !!f))];
/** The seasons a skep makes honey in: all but its idle one. */
const SKEP_SEASONS = SEASONS.filter((s) => s !== SKEP_IDLE);

const piece = (id: string) => FURNITURE_BY_ID.get(id);
const LARDER_HOLDS = piece('larder')?.capacity ?? 0;
const POND_HOLDS = piece('fish_pond')?.pond ?? 0;

/** A piece of yours of this kind, filled to what it holds. */
const filled = (g: Game, kind: string): boolean =>
  ours(g.furniture.values()).some((f) => f.kind === kind && furnitureCapacity(f) > 0 && furnitureUnits(f) >= furnitureCapacity(f));

const DRAGON_ISLE = lairOf('dragon')?.name ?? 'the dragon\'s island';
const MILKED = 'cudda';
const COMPOSTER = 'middun';
/**
 * What each kind of wildermon is called, handed over by `creatures.ts` as it
 * loads: importing it here would start the recipes ahead of the game, as the
 * dishes above would. Read when a line is read.
 */
let KINDS: Readonly<Record<string, { name: string }>> = {};
export function kindNames(species: Readonly<Record<string, { name: string }>>): void {
  KINDS = species;
}
const speciesName = (id: string): string => KINDS[id]?.name ?? id;

export const CRAFTS_B: Goal[] = [
  {
    id: 'bottle', text: 'Blow a glass bottle', met: did('made:bottle'),
    how: 'At a lit smelter, Crafting (R): "Blow a bottle" ({recipe.make_bottle.sand} sand). Glassblowing.',
  },
  {
    id: 'tinted', text: 'Dye a glass panel', hint: 'Glass panel: a lump blown at a smelter', met: did('dyed:glass'),
    how: 'Smelter: "Melt into glass", then "Blow a glass panel". Boil a dye in Crafting (R), right-click the panel: "Dye it".',
  },
  {
    id: 'glazed', text: 'Glaze a fired pot, bowl, jar or amphora', hint: 'Perk: Glaze (Artisan)', met: did('glazed'),
    how: 'Learn the Artisan\'s Glaze. With ash in the pack ("Rake out the ashes" at a fire), right-click a fired pot, bowl, jar or amphora: "Glaze". No decay after.',
  },
  {
    id: 'bricks', text: `Fire ${BRICKS} clay bricks in a kiln`, met: did('fired:clay_brick', BRICKS),
    how: 'Crafting (R): "Shape clay brick" ({recipe.make_clay_brick.clay} clay each, a trowel). At a kiln: "Fire in the kiln". Counts as they go in.',
  },
  {
    id: 'signed', text: 'Sign a masterwork', hint: `A single item you made at QL ${SIGN_QL}+`, met: did('signed'),
    how: `Make one item, not a pile or furniture, at QL ${SIGN_QL} or better. Right-click it: "Sign", and type the line. Once only.`,
  },
  {
    id: 'jewel', text: 'Set a gem in a ring or a pendant', met: (g) => did('made:jewelled_ring')(g) || did('made:jewelled_pendant')(g),
    how: 'Gems: mining, now and then. Cast a ring or a pendant at the anvil. Crafting (R), with a file: "Set in a ring" or "Set in a pendant".',
  },
  {
    id: 'arrows', text: `Fletch ${FLETCHED} arrows`, hint: 'Any head', met: (g) => ARROWS.reduce((n, id) => n + (g.tally[`made:${id}`] ?? 0), 0) >= FLETCHED,
    how: 'Crafting (R), with a carving knife: "Fletch arrows", or broadhead, bodkin or blunt. Every arrow made counts.',
  },
  {
    id: 'rope', text: 'Lay up a rope', met: did('made:rope'),
    how: 'Crafting (R): "Carve a rope tool", then "Lay up a rope" ({recipe.make_rope.wemp} wemp).',
  },
  {
    id: 'charted', text: 'Draw a map', met: did('charted'),
    how: 'Papyrus in the pack: right-click your own tile, "Draw a map". It holds the square round where you stand.',
  },
  {
    id: 'melted', text: 'Melt an item down for its metal', met: did('melted'),
    how: 'At a smelter: "Melt down" and a cast metal item from your pack. Comes back as lumps once it burns.',
  },
  {
    id: 'metalsuit', text: 'Wear a full suit of metal armour', hint: `Chain or plate: ${listed(SUIT_SLOTS)}`,
    met: (g) => SUIT_SLOTS.every((sl) => metalArmour(g.worn(sl)?.id)),
    how: 'Pour each piece\'s mould at a smelter and smith it at an anvil (chainsmithing or platesmithing). Right-click each: "Wear". Chain and plate mix.',
  },
  {
    id: 'tanned', text: 'Tan a hide', met: did('made:leather'),
    how: 'Butcher for a hide. Crafting (R), with a carving knife and lye: "Tan in lye".',
  },
  {
    id: 'improve70', text: `Improve ${IMPROVED_ITEMS} items to QL ${IMPROVED_TO}`, hint: `Each counts once, on the pass that takes it past QL ${IMPROVED_TO}`,
    met: did('improved70', IMPROVED_ITEMS),
    how: `Inventory: "Improve" an item until a pass of yours takes it to QL ${IMPROVED_TO} or past. Items made or bought at QL ${IMPROVED_TO}+ do not count.`,
  },
  {
    id: 'coins', text: 'Strike coins', met: did('minted'),
    how: 'At an anvil with a metal lump in the pack: "Strike coins".',
  },
  {
    id: 'flour', text: 'Grind flour in a quern', met: did('made:flour'),
    how: 'Crafting (R): "Dress a quern" ({recipe.make_quern.rock_shards} rock shards, a chisel), then "Grind into flour" ({recipe.make_flour.wheat} wheat).',
  },
  {
    id: 'lantern', text: 'Draw candles and light a lantern with one',
    met: (g) => did('made:candle')(g) && g.inventory.items.some((it) => it.id === 'lantern' && !!it.lit && (it.charges ?? 0) > 0),
    how: 'Crafting (R): "Draw candles" and "Build a lantern". On the lantern: "Put a candle in", then "Strike a light" at a fire. Lit in the pack when the journal looks.',
  },
];

export const LAND_B: Goal[] = [
  {
    id: 'crops', text: 'Harvest every crop', hint: listed(CROP_LIST.map((c) => c.name.toLowerCase())),
    met: (g) => CROP_LIST.every((c) => (g.tally[`harvest:${c.produce}`] ?? 0) > 0),
    how: 'Sow each on a tilled field or in a planter and "Harvest" it ripe. Seeds: "Forage" and "Botanize".',
  },
  {
    id: 'flowers', text: `Pick wildflowers in ${listed(FLOWER_SEASONS)}`,
    met: (g) => FLOWER_SEASONS.every((s) => (g.tally[`flowers:${s}`] ?? 0) > 0),
    how: 'Right-click grass in flower: "Pick flowers". A tile is picked bare until the next spring.',
  },
  {
    id: 'skepyear', text: `Take honey from a skep in ${listed(SKEP_SEASONS)}`,
    met: (g) => SKEP_SEASONS.every((s) => (g.tally[`skep:${s}`] ?? 0) > 0),
    how: `Set a skep down near wildflowers. "Take honey" once it holds one, in each season. Nothing made in ${SKEP_IDLE}.`,
  },
  {
    id: 'grapes', text: 'Pick grapes off a trellis', met: did('grapes'),
    how: 'Thorn bush, with a sickle: "Cut a grape cutting". Set a trellis against a finished wall: "Plant a grape cutting". Once it bears: "Pick grapes", in season.',
  },
  {
    id: 'fruits', text: `Pick ${FRUIT_KINDS} kinds of fruit`, hint: listed(FRUITS.map((f) => f.replace(/_/g, ' '))),
    met: (g) => kinds(g, FRUITS.map((f) => `fruit:${f}`)) >= FRUIT_KINDS,
    how: 'Right-click a fruit tree in season: "Pick fruit". Each kind of tree its own season; Examine says when.',
  },
  {
    id: 'cheese', text: 'Press cheese', met: did('made:cheese'),
    how: 'Milk into a bucket. Crafting (R), with a clay bowl: "Press into cheese" ({recipe.make_cheese.count} from a bucket of milk).',
  },
  {
    id: 'milked',
    get text() {
      return `Milk a ${speciesName(MILKED)}`;
    },
    met: did(`milked:${MILKED}`),
    get how() {
      return `Tame a female ${speciesName(MILKED)}. Empty bucket in the pack, stand beside her: "Milk it".`;
    },
  },
  {
    id: 'sheared', text: 'Shear or pluck a wildermon', met: did('sheared'),
    how: 'A tamed wildermon with a fleece or feathers grown back, a carving knife in the pack: "Shear" or "Pluck".',
  },
  {
    id: 'compost',
    get text() {
      return `Turn rot into compost with a ${speciesName(COMPOSTER)}`;
    },
    met: (g) => g.creatures.yours().some((c) => (c.work?.made.compost ?? 0) > 0),
    get how() {
      return `Tame a ${speciesName(COMPOSTER)} and "Assign to deed": it turns rotting things on your settlement into compost.`;
    },
  },
  {
    id: 'dishes', text: `Cook ${DISH_KINDS} different dishes`, met: (g) => kinds(g, [...DISHES].map((id) => `made:${id}`)) >= DISH_KINDS,
    how: 'At a lit campfire or oven, Crafting (R) lists what cooks there. Each different dish counts once.',
  },
  {
    id: 'wellfed', text: `Eat until wanting for nothing: ${listed(NUTRIENTS.map((n) => NUTRIENT_NAMES[n].toLowerCase()))} at ${Math.round(WANTING_NOTHING * 100)}%`,
    met: (g) => balance(g.player.nutrition) >= WANTING_NOTHING,
    how: 'Cooked dishes feed several at once. Health window: the nutrient bars; the lowest is what counts.',
  },
  {
    id: 'larder', text: 'Fill a larder', hint: `${LARDER_HOLDS} things in a plain one`, met: (g) => filled(g, 'larder'),
    how: 'Crafting (R): "Build larder", set it down. Food, drink, flour, dough and cornmeal only. Nothing rots in it.',
  },
];

export const WATER_B: Goal[] = [
  {
    id: 'roundisle', text: 'Sail round the island', hint: 'One boat, all the way round', met: did('circled'),
    how: 'Take the helm of a boat of any kind and keep the land on one side until you have gone right round. Another boat starts over.',
  },
  {
    id: 'volcano', text: `Land on ${DRAGON_ISLE}`, met: did('landed:dragon'),
    how: `Sail north to ${DRAGON_ISLE} and step ashore on your own feet.`,
  },
  {
    id: 'supremefish', text: 'Catch a supreme fish', hint: 'Perk: Rare Catch (Fisher)', met: (g) => did('catch:supreme')(g) || did('catch:fantastic')(g),
    how: 'Learn the Fisher\'s Rare Catch, then "Fish" or "Drag the net": now and then a fish comes up rare, supreme or fantastic.',
  },
  {
    id: 'reeds', text: 'Cut reeds', met: did('reeds'),
    how: 'Right-click a reed bed at the water\'s edge, with a carving knife: "Cut reeds".',
  },
  {
    id: 'fishpond', text: 'Stock a fish pond to full', hint: `${POND_HOLDS} fish in a plain one; Fisher's Fish Pond perk`, met: (g) => filled(g, 'fish_pond'),
    how: 'Learn the Fisher\'s Fish Pond; Crafting (R): "Build fish pond", set it on your settlement. It stocks itself; leave the fish in it.',
  },
  {
    id: 'sailed', text: `Sail ${SAIL_TILES.toLocaleString('en')} tiles`, met: did('sailed', SAIL_TILES),
    how: 'Every tile a boat goes into under your helm counts, any boat.',
  },
  {
    id: 'cartbridge', text: 'Drive a laden cart over a bridge you built', met: did('cartbridge'),
    how: 'Build a bridge (the last span yours). Load a cart, hitch a team, take the reins and drive onto the deck.',
  },
  {
    id: 'waters', text: 'Fish the sea and a spring\'s pond', met: (g) => did('fished:sea')(g) && did('fished:pond')(g),
    how: '"Fish" or "Drag the net" in the sea, and in water a spring has filled ("Dig a spring" makes one).',
  },
];

/** How many goals this file adds, for What's new. */
export const GOALS_B = CRAFTS_B.length + LAND_B.length + WATER_B.length;
