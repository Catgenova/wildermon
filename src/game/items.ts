import { matOfItem, workingQl } from './materials';
import { COINS_PER_LUMP, INGOT_LUMPS, INGOT_WEIGHT, ingotOf, METALS, MOULDS, RARE_LUMP_FACTOR } from './metal';
import { dyeIn, dyeHex, colourWord, dyeWord } from './dyestuffs';
import { MATERIAL_BY_ID, WALL_TYPES } from './building';
import { candleBurn, lanternReach, torchBurn, torchReach } from './light';
import { CLOSE_CLOTH, CLOSE_RIGHT } from './wounds';
import { metres } from './piers';
import { article, capital, fill, listed, numberWord, percent, timeWords } from './words';
import { CIRCLET_SHARE, CIRCLET_STONES, JEWEL_BONUS } from './gems';
import { TELE_FAR, TELE_FAST, TELE_NEAR, TELE_QL_HIGH, TELE_QL_LOW, TELE_RANGE_STEP, TELE_REST_STEP, TELE_SLOW, TELESTONE } from './runestones';
import { elementIslands, MOTE_ELEMENTS, moteItem, moteName, MOTES_LEAST, MOTES_MOST, MOTES_MOST_AT, MOTES_STEP, SWIRL_DARK, SWIRL_LIGHT } from './motes';
import {
  ENCHANT_BREAK, ENCHANT_HARM, ENCHANT_LEAST, ENCHANT_MOST, ENCHANTMENT_LIST, enchantMarker, ON_WORDS, roomMul, ROLLED_EFFECTS, SCROLL_HARM, SHOT_EFFECTS, type Enchant,
} from './enchant';

export type ItemCategory = 'tool' | 'material' | 'food' | 'plant' | 'misc';

import type { Nutrient } from './nutrition';
import { GEAR_ITEMS } from './wildgear';

export interface ItemDef {
  name: string;
  category: ItemCategory;
  /** Weight in kilograms per unit. */
  weight: number;
  stackable?: boolean;
  /**
   * Raw: it came out of the ground, off a tree, out of a vein, off a beast or
   * out of a field, and no bench, kiln, smelter or anvil has touched it — ore,
   * logs, dirt, shards, wool, hides. It is what a raw material bin takes, and
   * the island reads the same word off `item_def.raw`.
   */
  raw?: boolean;
  /**
   * Kept in a larder, though it is not food.
   *
   * Flour, dough and cornmeal are ground grain and what is made of it before
   * an oven gets near it. Nobody eats them, they keep like a material and they
   * decay like one, so they are not in the `food` category and should not be
   * -- but the place they live is a larder, which is what was asked for. It is
   * a flag rather than a category for exactly that reason: where a thing is
   * kept and what a thing is are two questions, and this is the first one.
   *
   * They stay worked materials, so the craft material bin still takes them.
   * The larder is not part of the partition the two material bins make between
   * them; it simply also has room for these three.
   */
  larder?: boolean;
  /** Restores this much hunger (0..1) when eaten. */
  food?: number;
  /** Restores this much thirst (0..1) per drink. */
  drink?: number;
  /** Puts back this much stamina (0..1) when it is drunk: a Naturalist's herb tea. */
  stamina?: number;
  /**
   * What is actually in it, by nutrient. Raw food feeds one of them a little;
   * a cooked dish feeds several, and feeds them properly. Anything nourishing
   * without a line here feeds nothing but the food bar.
   */
  feeds?: Partial<Record<Nutrient, number>>;
  /** What it holds when full, in litres for a vessel or a skin (one drink a litre); the item carries `charges` of them (`litresOf`). */
  charges?: number;
  /**
   * Litres it holds when it is full, for a vessel that fills a little at a
   * time and is not drunk from: a part bucket of milk (`dairy.ts`). The item
   * carries the litres in it as `charges`, and its name says them.
   */
  fills?: number;
  /**
   * How many times as long the knack it gives lasts as its food and drink
   * alone would make it, past the ceiling they have: a Cook's spirit, distilled
   * down from a brew.
   */
  knack?: number;
  /** Damage taken per real hour while lying on the ground; defaults by category. */
  decay?: number;
  description?: string;
  /**
   * A thing that holds other things: how many it takes. What is in a bag is
   * out of reach until it comes out again, which is the point of a bag.
   */
  holds?: number;
  /**
   * How much of the weather it keeps off what is inside, for a bag left on
   * the ground. Half means what is in it rots at half the rate.
   */
  shelter?: number;
  /** A bag that holds food and drink only, and one kind of it at a time (an Artisan's amphora). */
  oneKind?: boolean;
}

/**
 * A material a bench has touched: the exact complement of `raw` inside the
 * material category, and what a craft material bin takes.
 *
 * Written down rather than spelled out at the door, because the island has the
 * same predicate under the same name (`item_worked`) and the pair of bins only
 * partitions the materials so long as the two of them agree.
 */
export const isWorked = (id: string): boolean => {
  const d = ITEM_DEFS[id];
  return !!d && d.category === 'material' && !d.raw;
};

/** Ground decay per hour by category: food rots in about half an hour, tools last most of a day. */
export const CATEGORY_DECAY: Record<ItemCategory, number> = { food: 200, plant: 100, material: 25, tool: 12, misc: 12 };
/** What a settlement does to the rot of everything lying on its land: a tenth of the pace in the wild. */
export const DEED_DECAY = 0.1;

export const ITEM_DEFS: Record<string, ItemDef> = {
  shovel: { name: 'Shovel', category: 'tool', weight: 3, description: 'Digs, flattens and packs dirt.' },
  pickaxe: { name: 'Pickaxe', category: 'tool', weight: 4, description: 'Mines rock.' },
  hammer: { name: 'Hammer', category: 'tool', weight: 1.5, description: 'Tool for: {uses}.' },
  hatchet: { name: 'Hatchet', category: 'tool', weight: 2, description: 'Fells trees.' },
  sickle: { name: 'Sickle', category: 'tool', weight: 1.5, description: 'Forestry: prunes a tree back one growth stage; cuts what a bush bears.' },
  carving_knife: { name: 'Carving knife', category: 'tool', weight: 0.5, description: 'Carves wood.' },
  chisel: { name: 'Stone chisel', category: 'tool', weight: 1, description: 'Shapes stone.' },
  quern: { name: 'Quern', category: 'tool', weight: 9, description: 'Grinds wheat into flour and corn into cornmeal; presses olives into oil and fruit into juice or cider.' },
  whetstone: { name: 'Whetstone', category: 'tool', weight: 1.2, description: 'Needed to improve anything metal or stone.' },
  file: { name: 'File', category: 'tool', weight: 0.8, description: 'Needed to improve anything metal or wooden.' },
  hinge: { name: 'Hinges', category: 'material', weight: 0.5, stackable: true, decay: 1, description: '{per} per lump. Door: {wall.door.hinge}; double door: {wall.double_door.hinge}; gate: {wall.fence_gate.hinge}.' },
  bracket: { name: 'Brackets', category: 'material', weight: 0.25, stackable: true, decay: 1, description: '{per} per lump. Iron gate: {wall.iron_gate.bracket}; it holds against everything but players.' },
  hinge_mould: { name: 'Hinge mould', category: 'tool', weight: 1.2, decay: 1 },
  bracket_mould: { name: 'Bracket mould', category: 'tool', weight: 1.2, decay: 1 },
  gem: { name: 'Gem', category: 'material', weight: 0.05, stackable: true, raw: true, description: 'Set in a ring or pendant (jewellery). Worn: more skill gain in one skill.' },
  ring: { name: 'Ring', category: 'material', weight: 0.05, stackable: true, decay: 1, description: '{per} per lump. Takes one gem.' },
  pendant: { name: 'Pendant', category: 'material', weight: 0.1, stackable: true, decay: 1, description: '{per} per lump. Takes one gem.' },
  ring_mould: { name: 'Ring mould', category: 'tool', weight: 1.2, decay: 1 },
  pendant_mould: { name: 'Pendant mould', category: 'tool', weight: 1.2, decay: 1 },
  focus: { name: 'Focus', category: 'tool', weight: 0.3, description: 'Spells are cast from it. Each cast wears it; used up when worn through.' },
  jewelled_ring: { name: 'Jewelled ring', category: 'misc', weight: 0.06, decay: 1, description: 'Worn: {bonus:pct} more skill per action in its gem\'s skill.' },
  jewelled_pendant: { name: 'Jewelled pendant', category: 'misc', weight: 0.12, decay: 1, description: 'Worn: {bonus:pct} more skill per action in its gem\'s skill.' },
  // An Artisan's Circlet.
  circlet: { name: 'Circlet', category: 'misc', weight: 0.2, decay: 1, description: 'Head slot, in place of a helm. Up to {stones} gems, each set from the gem\'s menu. Worn: each gives {share:pct} of a ring\'s bonus, {each:pct} more skill per action in its skill.' },
  horseshoe: { name: 'Horseshoes', category: 'material', weight: 0.25, stackable: true, decay: 1, description: '{per} per lump; {shoes.perMount} per mount, nailed on by a farrier with a mallet. Lasts {shoes.days} days. Mount speed on laid stone: +{shoes.quicker:pct}. Climbs a step {shoes.step:m} steeper.' },
  horseshoe_mould: { name: 'Horseshoe mould', category: 'tool', weight: 1.2, decay: 1 },
  coin_die: { name: 'Coin die', category: 'tool', weight: 1.5, description: 'Strike a gold lump at an anvil: {coinsPerLump} coins. Wears each strike.' },
  coin_die_mould: { name: 'Coin die mould', category: 'tool', weight: 1.2, decay: 1 },
  // What a poured mould cools into, named for its piece by `itemName` and
  // stacked by it: a shovel head casting is not a hatchet head casting.
  casting: { name: 'Casting', category: 'material', weight: 1, stackable: true, decay: 3, description: 'Poured at a smelter. Smith it at an anvil into its piece.' },
  bell_casting: { name: 'Bell casting', category: 'misc', weight: 16, description: 'Hangs in a bell frame. {lumps} lumps.' },
  statue_casting: { name: 'Statue casting', category: 'misc', weight: 24, description: 'Set on a slab to stand.' },
  bell_mould: { name: 'Bell mould', category: 'tool', weight: 3, decay: 1, description: 'Casts a bell. Wears each filling; cannot be mended.' },
  statue_mould: { name: 'Statue mould', category: 'tool', weight: 4, decay: 1, description: 'Casts a statue. Wears each filling; cannot be mended.' },
  coin: { name: 'Coins', category: 'misc', weight: 0.005, stackable: true, description: '{coinsPerLump} per gold lump, struck at an anvil with a coin die. Melts back into a lump.' },
  needle: { name: 'Needle', category: 'tool', weight: 0.05, description: 'Needed to improve cloth and leather.' },
  awl: { name: 'Awl', category: 'tool', weight: 0.2, description: 'Needed to improve leather.' },
  mallet: { name: 'Mallet', category: 'tool', weight: 1.5, description: 'Plans buildings; builds wooden walls.' },
  trowel: { name: 'Trowel', category: 'tool', weight: 1, description: 'Lays bricks, mortar and stone floors.' },
  saw: { name: 'Saw', category: 'tool', weight: 1.5, description: 'Cuts logs into planks and timbers.' },
  rake: { name: 'Rake', category: 'tool', weight: 1.5, description: 'Tills grass and dirt into a field.' },
  brush: { name: 'Brush', category: 'tool', weight: 0.6, description: 'Brush a wildermon: it works better, learns faster and breeds better young.' },
  sword: { name: 'Sword', category: 'tool', weight: 2, description: '{damage} damage, a blow every {swing} seconds, reach {reach} tiles.' },
  short_sword: { name: 'Short sword', category: 'tool', weight: 1.4, description: '{damage} damage, a blow every {swing} seconds, reach {reach} tiles. One hand: a shield fits.' },
  long_sword: { name: 'Long sword', category: 'tool', weight: 3, description: 'Two hands: no shield. {damage} damage, a blow every {swing} seconds, reach {reach} tiles.' },
  hunting_knife: { name: 'Hunting knife', category: 'tool', weight: 0.8, description: '{damage} damage, a blow every {swing} seconds, reach {reach} tiles.' },
  battle_axe: { name: 'Battle axe', category: 'tool', weight: 4, description: 'Two hands: no shield. {damage} damage, a blow every {swing} seconds, reach {reach} tiles.' },
  javelin: { name: 'Javelin', category: 'tool', weight: 1.4, description: 'Thrown: {damage} damage, a throw every {swing} seconds, reach {reach} tiles.' },
  throwing_axe: { name: 'Throwing axe', category: 'tool', weight: 1.8, description: 'Thrown: {damage} damage, a throw every {swing} seconds, reach {reach} tiles.' },
  club: { name: 'Club', category: 'tool', weight: 2.5, description: '{damage} damage, a blow every {swing} seconds, reach {reach} tiles.' },
  maul: { name: 'Maul', category: 'tool', weight: 5, description: 'Two hands: no shield. {damage} damage, a blow every {swing} seconds, reach {reach} tiles.' },
  spear: { name: 'Spear', category: 'tool', weight: 2.2, description: '{damage} damage, a blow every {swing} seconds, reach {reach} tiles: {past} more than a sword.' },
  short_bow: { name: 'Short bow', category: 'tool', weight: 1, description: 'Range {range} tiles, {damage} damage before skill and quality, a shot every {swing} seconds.' },
  medium_bow: { name: 'Medium bow', category: 'tool', weight: 1.4, description: 'Range {range} tiles, {damage} damage before skill and quality, a shot every {swing} seconds.' },
  long_bow: { name: 'Long bow', category: 'tool', weight: 1.8, description: 'Range {range} tiles, {damage} damage before skill and quality, a shot every {swing} seconds.' },
  helm: { name: 'Helm', category: 'tool', weight: 3 },
  wool_cap: { name: 'Wool cap', category: 'tool', weight: 0.4 },
  // Cloth armour: light, quiet and better than nothing.
  cloth_tunic: { name: 'Cloth tunic', category: 'tool', weight: 1.2 },
  cloth_sleeves: { name: 'Cloth sleeves', category: 'tool', weight: 0.7 },
  cloth_trousers: { name: 'Cloth trousers', category: 'tool', weight: 1 },
  cloth_shoes: { name: 'Cloth shoes', category: 'tool', weight: 0.6 },
  // Leather, cut and stitched from hide.
  leather_cap: { name: 'Leather cap', category: 'tool', weight: 0.8 },
  leather_jerkin: { name: 'Leather jerkin', category: 'tool', weight: 2.4 },
  leather_sleeves: { name: 'Leather sleeves', category: 'tool', weight: 1.4 },
  leather_trousers: { name: 'Leather trousers', category: 'tool', weight: 2 },
  leather_boots: { name: 'Leather boots', category: 'tool', weight: 1.6 },
  // Chain, rings drawn and riveted at an anvil.
  chain_coif: { name: 'Chain coif', category: 'tool', weight: 2.6 },
  chain_hauberk: { name: 'Chain hauberk', category: 'tool', weight: 7.5 },
  chain_sleeves: { name: 'Chain sleeves', category: 'tool', weight: 3.4 },
  chain_leggings: { name: 'Chain leggings', category: 'tool', weight: 5 },
  chain_boots: { name: 'Chain boots', category: 'tool', weight: 3 },
  // Plate, beaten out of a mould and strapped on over everything.
  plate_breastplate: { name: 'Breastplate', category: 'tool', weight: 11 },
  plate_arms: { name: 'Plate arms', category: 'tool', weight: 5 },
  plate_legs: { name: 'Plate legs', category: 'tool', weight: 7.5 },
  plate_boots: { name: 'Plate boots', category: 'tool', weight: 4.5 },
  wooden_shield: { name: 'Wooden shield', category: 'tool', weight: 3.5, description: 'Off hand. Blocks {blockLow:pct} of blows at QL {qlLow}, {blockHigh:pct} at QL {qlTop}, {blockSkilled:pct} at QL {qlTop} with shields {skillTop}. A blocked blow: no damage to you; {wear} damage to the shield per whole health it would have taken.' },
  metal_shield: { name: 'Metal shield', category: 'tool', weight: 6, description: 'Off hand. Blocks {blockLow:pct} of blows at QL {qlLow}, {blockHigh:pct} at QL {qlTop}, {blockSkilled:pct} at QL {qlTop} with shields {skillTop}. A blocked blow: no damage to you; {wear} damage to the shield per whole health it would have taken.' },
  frying_pan: { name: 'Frying pan', category: 'tool', weight: 2, description: 'Fries meat at a campfire; frying cannot fail.' },
  anvil: { name: 'Anvil', category: 'misc', weight: 60, decay: 0.5, description: 'Place it to smith at it.' },
  butchering_knife: { name: 'Butchering knife', category: 'tool', weight: 1, description: 'Butchers corpses. More yield than bare hands.' },
  clay_bowl: { name: 'Clay bowl', category: 'tool', weight: 0.6, description: 'Cooks stews and compotes over a campfire.' },
  clay_pot: { name: 'Clay pot', category: 'tool', weight: 1.2, description: 'Cooks pottage over a campfire.' },
  clay_jar: { name: 'Clay jar', category: 'tool', weight: 0.8, description: 'Makes preserves from fruit; preserves rot far slower than fruit.' },
  // An Artisan's Amphora: a bag for one kind of food or drink.
  amphora: { name: 'Amphora', category: 'misc', weight: 2.6, decay: 2, holds: 20, shelter: 0.5, oneKind: true, description: 'Holds {holds} of one food or drink. Left lying: contents rot at {shelter:pct} of the rate.' },
  deed_stake: { name: 'Settlement stake', category: 'misc', weight: 1, decay: 4, description: 'Plant to found a settlement centred on you: {deedAcross} × {deedAcross} tiles around a totem. One settlement per player.' },
  crate_log: { name: 'Log crate', category: 'misc', weight: 30, decay: 6, description: 'Holds {capacity} things. Placed on any spot of a tile.' },
  crate_plank: { name: 'Plank crate', category: 'misc', weight: 15, decay: 6, description: 'Holds {capacity} things. Placed on any spot of a tile.' },
  water_skin: { name: 'Water skin', category: 'misc', weight: 0.5, drink: 0.35, charges: 5, description: 'Holds water. Fill at any shore.' },
  bucket: { name: 'Bucket', category: 'tool', weight: 1.6, decay: 8, description: 'Fill at any shore. Ashes and water make lye in it.' },
  water_bucket: { name: 'Bucket of water', category: 'tool', weight: 6, decay: 8, charges: 5, description: '{bucketLitres} L. Full: leaches ashes into lye.' },
  lye_bucket: { name: 'Bucket of lye', category: 'tool', weight: 6, decay: 10, charges: 5, description: '{bucketLitres} L. Tanning a hide: {recipe.tan_hide.lye_bucket} L. Cleaning a wound, removing dye or paint: {lyeUse} L.' },
  dirt: { name: 'Dirt', category: 'material', weight: 20, stackable: true, raw: true, description: 'Drop to raise the ground.' },
  moss: { name: 'Moss', category: 'material', weight: 0.5, stackable: true, raw: true, description: 'Cutting a moss tile gives {moss.cut}. Plant {moss.plant} on a dirt tile: the tile becomes moss.' },
  sand: { name: 'Sand', category: 'material', weight: 20, stackable: true, raw: true },
  /*
   * Glass comes off the smelter in two steps, both glassblowing: sand melted
   * down into lumps, and a lump blown and flattened into a panel. The panel
   * kept the id the pane had, so every window, bay and glasshouse roof that
   * was glazed or half built stays exactly as it was.
   */
  glass_lump: { name: 'Glass lump', category: 'material', weight: 1, stackable: true, decay: 0,
    description: 'Glassblowing makes it into a glass panel.' },
  glass: { name: 'Glass panel', category: 'material', weight: 2, stackable: true, decay: 0,
    description: 'Window: {wall.window.glass}. Bay window: {wall.bay.glass}. Glasshouse roofs are laid in them. '
      + 'Dye: {paneDye} litre per panel; a window or bay window takes the colour of the last panel fitted.' },
  bottle: { name: 'Bottle', category: 'misc', weight: 0.5, decay: 1, holds: 4, shelter: 0.25, oneKind: true,
    description: 'Holds {holds} of one food or drink. Left lying: contents rot at {shelter:pct} of the rate.' },
  stained_glass_pane: { name: 'Stained glass pane', category: 'material', weight: 0.1, stackable: true, decay: 0,
    description: 'Solid stained glass wall: {stainedGlassWall.stained_glass_pane}.' },
  clay: { name: 'Clay', category: 'material', weight: 20, stackable: true, raw: true },
  peat: { name: 'Peat', category: 'material', weight: 2, stackable: true, raw: true },
  // Raked out of a fire, and nothing a bench has touched — which is the whole
  // of the test. A raw material bin refused it until now, so the one thing a
  // furnace produces by the cartload had nowhere bulk to go.
  ash: { name: 'Ashes', category: 'material', weight: 0.3, stackable: true, decay: 4, description: 'Water leaches lye out of it.' },
  tar: { name: 'Tar', category: 'material', weight: 2, stackable: true, raw: true },
  rock_shards: { name: 'Rock shards', category: 'material', weight: 20, stackable: true, raw: true, decay: 5, description: 'Builds cobblestone walls; chiselled into bricks.' },
  slate_shards: { name: 'Slate shards', category: 'material', weight: 20, stackable: true, raw: true, decay: 5 },
  marble_shards: { name: 'Marble shards', category: 'material', weight: 20, stackable: true, raw: true, decay: 5 },
  sandstone_shards: { name: 'Sandstone shards', category: 'material', weight: 20, stackable: true, raw: true, decay: 5 },
  stone_brick: { name: 'Stone brick', category: 'material', weight: 15, stackable: true, decay: 3 },
  slate_brick: { name: 'Slate brick', category: 'material', weight: 15, stackable: true, decay: 3 },
  marble_brick: { name: 'Marble brick', category: 'material', weight: 15, stackable: true, decay: 3 },
  sandstone_brick: { name: 'Sandstone brick', category: 'material', weight: 15, stackable: true, decay: 3 },
  stone_slab: { name: 'Stone slab', category: 'material', weight: 18, stackable: true, decay: 2, description: 'Paving, one tile each.' },
  slate_slab: { name: 'Slate slab', category: 'material', weight: 18, stackable: true, decay: 2 },
  marble_slab: { name: 'Marble slab', category: 'material', weight: 18, stackable: true, decay: 2 },
  sandstone_slab: { name: 'Sandstone slab', category: 'material', weight: 18, stackable: true, decay: 2 },
  unfired_clay_brick: { name: 'Unfired clay brick', category: 'material', weight: 3, stackable: true, decay: 12, description: 'Fire in a kiln to use.' },
  unfired_clay_bowl: { name: 'Unfired clay bowl', category: 'material', weight: 0.7, stackable: true, decay: 12, description: 'Fire in a kiln to use.' },
  unfired_clay_pot: { name: 'Unfired clay pot', category: 'material', weight: 1.4, stackable: true, decay: 12, description: 'Fire in a kiln to use.' },
  unfired_clay_jar: { name: 'Unfired clay jar', category: 'material', weight: 0.9, stackable: true, decay: 12, description: 'Fire in a kiln to use.' },
  unfired_amphora: { name: 'Unfired amphora', category: 'material', weight: 3.2, stackable: true, decay: 12, description: 'Fire in a kiln to use.' },
  clay_brick: { name: 'Clay brick', category: 'material', weight: 3, stackable: true, decay: 6 },
  adobe: { name: 'Adobe', category: 'material', weight: 3, stackable: true, decay: 10 },
  mortar: { name: 'Mortar', category: 'material', weight: 2, stackable: true, decay: 40 },
  concrete: { name: 'Concrete', category: 'material', weight: 2.5, stackable: true, decay: 40, description: 'Raises a bare rock corner by one. Not on soil or under water.' },
  // Ore comes out of the seam; the smelter turns it into lumps.
  copper_ore: { name: 'Copper ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  iron_ore: { name: 'Iron ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  tin_ore: { name: 'Tin ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  zinc_ore: { name: 'Zinc ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  lead_ore: { name: 'Lead ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  silver_ore: { name: 'Silver ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  gold_ore: { name: 'Gold ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  adamantine_ore: { name: 'Adamantine ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  glimmersteel_ore: { name: 'Glimmersteel ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  mithril_ore: { name: 'Mithril ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  seryll_ore: { name: 'Seryll ore', category: 'material', weight: 2, stackable: true, raw: true, decay: 2 },
  copper_lump: { name: 'Copper lump', category: 'material', weight: 1, stackable: true, decay: 2 },
  iron_lump: { name: 'Iron lump', category: 'material', weight: 1, stackable: true, decay: 3 },
  coal: { name: 'Coal', category: 'material', weight: 1, stackable: true, raw: true, decay: 3, description: 'Fuel for a campfire.' },
  tin_lump: { name: 'Tin lump', category: 'material', weight: 1, stackable: true, decay: 2 },
  zinc_lump: { name: 'Zinc lump', category: 'material', weight: 1, stackable: true, decay: 2 },
  lead_lump: { name: 'Lead lump', category: 'material', weight: 1, stackable: true, decay: 1 },
  silver_lump: { name: 'Silver lump', category: 'material', weight: 0.1, stackable: true, decay: 1 },
  gold_lump: { name: 'Gold lump', category: 'material', weight: 0.1, stackable: true, decay: 1 },
  adamantine_lump: { name: 'Adamantine lump', category: 'material', weight: 0.1, stackable: true, decay: 0.5, description: '{grams} grams a lump: a mould takes {rareLumps}× the lumps it takes of iron.' },
  glimmersteel_lump: { name: 'Glimmersteel lump', category: 'material', weight: 0.1, stackable: true, decay: 0.5, description: '{grams} grams a lump: a mould takes {rareLumps}× the lumps it takes of iron.' },
  mithril_lump: { name: 'Mithril lump', category: 'material', weight: 0.1, stackable: true, decay: 0.5 },
  seryll_lump: { name: 'Seryll lump', category: 'material', weight: 0.1, stackable: true, decay: 0.5 },
  // Alloys, mixed in a smelter.
  bronze_lump: { name: 'Bronze lump', category: 'material', weight: 1, stackable: true, decay: 1 },
  steel_lump: { name: 'Steel lump', category: 'material', weight: 1, stackable: true, decay: 1 },
  brass_lump: { name: 'Brass lump', category: 'material', weight: 1, stackable: true, decay: 1 },
  pewter_lump: { name: 'Pewter lump', category: 'material', weight: 1, stackable: true, decay: 1 },
  electrum_lump: { name: 'Electrum lump', category: 'material', weight: 1, stackable: true, decay: 1 },
  // Moulds, fired from sand, and the pieces beaten out of them.
  anvil_mould: { name: 'Anvil mould', category: 'tool', weight: 1.2, decay: 1 },
  nail_mould: { name: 'Nail mould', category: 'tool', weight: 1.2, decay: 1, description: '{per} nails per filling. Wears each filling; cannot be mended.' },
  pan_mould: { name: 'Pan mould', category: 'tool', weight: 1.2, decay: 1 },
  rake_head_mould: { name: 'Rake head mould', category: 'tool', weight: 1.2, decay: 1 },
  shovel_head_mould: { name: 'Shovel head mould', category: 'tool', weight: 1.2, decay: 1 },
  hatchet_head_mould: { name: 'Hatchet head mould', category: 'tool', weight: 1.2, decay: 1 },
  sickle_blade_mould: { name: 'Sickle blade mould', category: 'tool', weight: 1.2, decay: 1 },
  pickaxe_head_mould: { name: 'Pickaxe head mould', category: 'tool', weight: 1.2, decay: 1 },
  knife_blade_mould: { name: 'Knife blade mould', category: 'tool', weight: 1.2, decay: 1 },
  sword_blade_mould: { name: 'Sword blade mould', category: 'tool', weight: 1.2, decay: 1 },
  helm_mould: { name: 'Helm mould', category: 'tool', weight: 1.2, decay: 1 },
  axle_mould: { name: 'Axle mould', category: 'tool', weight: 1.4, decay: 1, description: 'Casts a big axle. Wears each filling; cannot be mended.' },
  ribbon_mould: { name: 'Ribbon mould', category: 'tool', weight: 1.2, decay: 1, description: 'One lump casts one metal ribbon. Wears each filling; cannot be mended.' },
  nail: { name: 'Nails', category: 'material', weight: 0.01, stackable: true, decay: 1, description: '{grams} grams each.' },
  padlock: { name: 'Padlock', category: 'tool', weight: 0.6, description: 'Fit to a crate, cupboard, cart or chest: cuts its key as it closes.' },
  key: { name: 'Key', category: 'tool', weight: 0.02, description: 'Opens one lock. Whoever holds it opens it; lost, only the settlement\'s founder can open it.' },
  arrow: { name: 'Arrows', category: 'material', weight: 0.05, stackable: true, decay: 3, description: 'A bow spends one per shot.' },
  broadhead_arrow: { name: 'Broadhead arrows', category: 'material', weight: 0.06, stackable: true, decay: 3, description: 'Hit: bleeds {arrowHead.bleed:pct} of the shot per second for {arrowHead.bleedSecs} seconds; never kills.' },
  bodkin_arrow: { name: 'Bodkin arrows', category: 'material', weight: 0.05, stackable: true, decay: 3, description: 'Hit: {arrowHead.hide:pct} more damage on thick hide, shell or scales.' },
  blunt_arrow: { name: 'Blunt arrows', category: 'material', weight: 0.04, stackable: true, decay: 3, description: 'Made without arrow heads. Crushing. Hit: cancels a heavy blow and delays the next blow by {arrowHead.stagger} second.' },
  arrow_head: { name: 'Arrow heads', category: 'material', weight: 0.02, stackable: true, decay: 1 },
  feather: { name: 'Feathers', category: 'material', weight: 0.01, stackable: true, raw: true, decay: 20, description: 'Fletching for arrows. Only from birds.' },
  bow_string: { name: 'Bowstring', category: 'material', weight: 0.05, stackable: true, decay: 8 },
  yarn: { name: 'Yarn', category: 'material', weight: 0.15, stackable: true, decay: 12, description: 'Woven into cloth on a loom.' },
  long_sword_blade: { name: 'Long sword blade', category: 'material', weight: 2, stackable: true, decay: 1 },
  short_sword_blade: { name: 'Short sword blade', category: 'material', weight: 1, stackable: true, decay: 1 },
  axe_head: { name: 'Axe head', category: 'material', weight: 2.6, stackable: true, decay: 1 },
  maul_head: { name: 'Maul head', category: 'material', weight: 3.4, stackable: true, decay: 1 },
  spear_head: { name: 'Spear head', category: 'material', weight: 1.2, stackable: true, decay: 1 },
  shield_boss: { name: 'Shield boss', category: 'material', weight: 2, stackable: true, decay: 1 },
  rake_head: { name: 'Rake head', category: 'material', weight: 1.2, stackable: true, decay: 1 },
  shovel_head: { name: 'Shovel head', category: 'material', weight: 1.2, stackable: true, decay: 1 },
  hatchet_head: { name: 'Hatchet head', category: 'material', weight: 1.2, stackable: true, decay: 1 },
  sickle_blade: { name: 'Sickle blade', category: 'material', weight: 1, stackable: true, decay: 1 },
  // What a sickle cuts off a bush. Dyestuffs, both of them: what each boils into is said after (`dyestuffUse`).
  rose_petals: { name: 'Rose petals', category: 'material', weight: 0.05, stackable: true, raw: true, decay: 6, description: 'Cut off a rose bush with a sickle.' },
  lavender: { name: 'Lavender', category: 'material', weight: 0.05, stackable: true, raw: true, decay: 6, description: 'Cut off a lavender bush with a sickle.' },
  // Picked off grass in flower (`world/flowers.ts`), and boiled for dye.
  wildflowers: { name: 'Wildflowers', category: 'material', weight: 0.05, stackable: true, raw: true, decay: 6, description: 'Picked off grass in flower: one per clump.' },
  // Off a planted water lily and a lotus: see `watergarden.ts`. The lotus is a dyestuff; the water lily no longer is.
  water_lily: { name: 'Water lily', category: 'material', weight: 0.05, stackable: true, raw: true, decay: 6, description: 'Picked off a water lily planted in still water.' },
  lotus_flower: { name: 'Lotus flower', category: 'material', weight: 0.08, stackable: true, raw: true, decay: 6, description: 'Picked off a lotus planted in still water.' },
  // What is planted in still water to grow them: found by botanizing at the water's edge, and a lotus's own seed heads.
  lily_root: { name: 'Water lily root', category: 'plant', weight: 0.2, stackable: true, decay: 20,
    description: 'Found by botanizing at the water\'s edge. Plant in still water {shallow} to {deep} m deep (pond, pool, sea shallows; not running water): pads at once. Roots in {rooting}; then {year}, white or pink, open by day, shut at night. Winter: root only; pads return in spring. A picked flower is gone until the season turns.' },
  lotus_seed: { name: 'Lotus seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40, food: 0.03, feeds: { starch: 0.02, fat: 0.01 },
    description: 'Found by botanizing at the water\'s edge; {seeds} per lotus seed head. Raw: {food:pct} food; roasted at a campfire: {item.roast_lotus_seeds.food:pct}. Plant in still water {shallow} to {deep} m deep: leaves on stalks at once. Roots in {rooting}; then {year}. Winter: root only. Picked is gone until the season turns.' },
  pickaxe_head: { name: 'Pickaxe head', category: 'material', weight: 1.2, stackable: true, decay: 1 },
  hammer_head: { name: 'Hammer head', category: 'material', weight: 1, stackable: true, decay: 1 },
  knife_blade: { name: 'Knife blade', category: 'material', weight: 1.2, stackable: true, decay: 1 },
  saw_blade: { name: 'Saw blade', category: 'material', weight: 1.2, stackable: true, decay: 1 },
  trowel_blade: { name: 'Trowel blade', category: 'material', weight: 1, stackable: true, decay: 1 },
  sword_blade: { name: 'Sword blade', category: 'material', weight: 1.2, stackable: true, decay: 1 },
  log: { name: 'Log', category: 'material', weight: 24, stackable: true, raw: true, decay: 18 },
  plank: { name: 'Plank', category: 'material', weight: 2, stackable: true, decay: 20 },
  timber: { name: 'Timber', category: 'material', weight: 6, stackable: true, decay: 18 },
  wool: { name: 'Wool', category: 'material', weight: 0.4, stackable: true, raw: true, decay: 14, description: 'Shorn from a living Cloudlet; grows back.' },
  cloth: { name: 'Cloth', category: 'material', weight: 0.3, stackable: true, decay: 14, description: 'Stuffs mattresses; makes clothing.' },
  fur: { name: 'Fur', category: 'material', weight: 1, stackable: true, raw: true, decay: 16, description: 'From a butchered wildermon.' },
  hide: { name: 'Hide', category: 'material', weight: 2, stackable: true, raw: true, decay: 40, description: 'Tan in lye to make leather.' },
  leather: { name: 'Leather', category: 'material', weight: 1.5, stackable: true, decay: 12, description: 'Leatherworking material.' },
  bone: { name: 'Bone', category: 'material', weight: 1, stackable: true, raw: true, decay: 8 },
  offal: { name: 'Offal', category: 'material', weight: 0.2, stackable: true, raw: true, decay: 90, description: 'Fishing bait.' },
  broth: { name: 'Broth', category: 'food', weight: 0.4, stackable: true, food: 0.25, decay: 60, description: 'Feeds every food group.', feeds: { flesh: 0.08, starch: 0.08, greens: 0.08, fat: 0.08 } },
  gland: { name: 'Gland', category: 'material', weight: 0.2, stackable: true, raw: true, decay: 90, description: 'Ink ingredient. Rare butchering drop.' },
  shaft: { name: 'Shaft', category: 'material', weight: 1, stackable: true, decay: 20, description: 'Tool handles and fence rails.' },
  ribbon: { name: 'Metal ribbon', category: 'material', weight: 0.4, stackable: true, decay: 1, description: 'One lump each.' },
  big_axle: { name: 'Big axle', category: 'material', weight: 8, stackable: true, decay: 1, description: 'Large cart: {recipe.make_large_cart.big_axle}. Wagon: {recipe.make_wagon.big_axle}.' },
  large_wheel: { name: 'Large wheel', category: 'material', weight: 12, stackable: true, decay: 10, description: 'Large cart: {recipe.make_large_cart.large_wheel}. Wagon: {recipe.make_wagon.large_wheel}.' },
  yoke: { name: 'Yoke', category: 'material', weight: 4, stackable: true, decay: 10, description: 'Hitches a wildermon to pull.' },
  milk_bucket: { name: 'Bucket of milk', category: 'food', weight: 6, decay: 30, drink: 0.3, charges: 5, description: '{bucketLitres} litres. Drink it; press in a clay bowl: {recipe.make_cheese.count} cheeses, bucket left full of whey; churn at a butter churn: {recipe.churn_butter.count} pats of butter, bucket returned empty.', feeds: { fat: 0.1, flesh: 0.08 } },
  cheese: { name: 'Cheese', category: 'food', weight: 0.4, stackable: true, food: 0.3, decay: 3, description: '{recipe.make_cheese.count} per bucket of milk, pressed in a clay bowl. Left lying: rots at {keep:pct} of the rate of a bucket of milk.', feeds: { fat: 0.12, flesh: 0.1 } },
  butter: { name: 'Butter', category: 'food', weight: 0.1, stackable: true, food: 0.1, decay: 6, description: '{recipe.churn_butter.count} pats per bucket of milk, at a butter churn. Left lying: rots at {keep:pct} of the rate of a bucket of milk. {recipe.bake_pastry.butter} pats + {recipe.bake_pastry.dough} dough: {recipe.bake_pastry.count} pastries at a lit fire or oven.', feeds: { fat: 0.16 } },
  pastry: { name: 'Pastry', category: 'food', weight: 0.2, stackable: true, food: 0.38, decay: 40, description: 'Dough and butter baked at a lit fire or oven: {recipe.bake_pastry.count} per bake.', feeds: { starch: 0.2, fat: 0.16 } },
  honey: { name: 'Honey', category: 'food', weight: 0.3, stackable: true, food: 0.22, decay: 0.4, description: 'From a hive. Barely rots.', feeds: { starch: 0.1, fat: 0.03 } },
  wax: { name: 'Beeswax', category: 'material', weight: 0.2, stackable: true, decay: 1, description: 'Makes candles and waxed thread.' },
  lantern: { name: 'Lantern', category: 'tool', weight: 1.4, decay: 3, description: 'Holds a candle; light it at a fire. Light: {light.lanternNear} tiles at lowest QL, {light.lanternFar} at best. A candle lasts {light.candleShort:time} at lowest QL, {light.candleLong:time} at best.' },
  torch: { name: 'Torch', category: 'tool', weight: 0.8, decay: 4, description: 'Light at a fire. Burns {light.torchShort:time} to {light.torchLong:time} and lights {light.torchNear} to {light.torchFar} tiles, by QL.' },
  candle: { name: 'Candle', category: 'misc', weight: 0.2, stackable: true, decay: 2, description: 'Burns in a lantern.' },
  compost: { name: 'Compost', category: 'material', weight: 1.2, stackable: true, raw: true, decay: 2, description: 'From {compostMaker}. Spread on tilled ground.' },
  saddle: { name: 'Saddle', category: 'material', weight: 7, stackable: true, decay: 8, description: 'Fit to a Thistlekit to ride it.' },
  bridle: { name: 'Bridle', category: 'material', weight: 2, stackable: true, decay: 8, description: 'Needed to steer a mount.' },
  thatch: { name: 'Thatch', category: 'material', weight: 0.5, stackable: true, decay: 60 },
  sprout: { name: 'Sprout', category: 'plant', weight: 0.1, stackable: true, decay: 160, description: 'Plant on grass or dirt to grow a tree. Rots fast lying on the ground.' },
  blueberry: { name: 'Blueberries', category: 'food', weight: 0.1, stackable: true, food: 0.08, feeds: { greens: 0.05 } },
  raspberry: { name: 'Raspberries', category: 'food', weight: 0.1, stackable: true, food: 0.08, feeds: { greens: 0.05 } },
  strawberry: { name: 'Strawberries', category: 'food', weight: 0.1, stackable: true, food: 0.08, feeds: { greens: 0.05 } },
  lingonberry: { name: 'Lingonberries', category: 'food', weight: 0.1, stackable: true, food: 0.06, feeds: { greens: 0.04 } },
  acorn: { name: 'Acorn', category: 'food', weight: 0.05, stackable: true, food: 0.02, feeds: { fat: 0.02 } },
  nuts: { name: 'Nuts', category: 'food', weight: 0.1, stackable: true, food: 0.05, feeds: { fat: 0.05 } },
  meat: { name: 'Meat', category: 'food', weight: 0.5, stackable: true, food: 0.18, decay: 160, description: 'Raw: {food:pct} food. Cooked at a campfire: {item.cooked_meat.food:pct}.', feeds: { flesh: 0.09 } },
  cooked_meat: { name: 'Cooked meat', category: 'food', weight: 0.4, stackable: true, food: 0.35, decay: 90, feeds: { flesh: 0.22, fat: 0.05 } },
  baked_potato: { name: 'Baked potato', category: 'food', weight: 0.2, stackable: true, food: 0.22, decay: 90, feeds: { starch: 0.18, greens: 0.03 } },
  roast_onion: { name: 'Roast onion', category: 'food', weight: 0.15, stackable: true, food: 0.16, decay: 90, feeds: { greens: 0.12, fat: 0.02 } },
  roast_nuts: { name: 'Roasted nuts', category: 'food', weight: 0.1, stackable: true, food: 0.12, decay: 40, feeds: { fat: 0.14 } },
  roast_lotus_seeds: { name: 'Roasted lotus seeds', category: 'food', weight: 0.06, stackable: true, food: 0.14, decay: 40, feeds: { starch: 0.1, fat: 0.04 } },
  berry_compote: { name: 'Berry compote', category: 'food', weight: 0.3, stackable: true, food: 0.3, decay: 60, feeds: { greens: 0.2, starch: 0.06 } },
  stew: { name: 'Stew', category: 'food', weight: 0.6, stackable: true, food: 0.75, decay: 70, feeds: { flesh: 0.26, starch: 0.22, greens: 0.2, fat: 0.12 } },
  pottage: { name: 'Pottage', category: 'food', weight: 0.7, stackable: true, food: 0.6, decay: 50, feeds: { starch: 0.24, greens: 0.22, fat: 0.1 } },
  bread: { name: 'Bread', category: 'food', weight: 0.35, stackable: true, food: 0.42, decay: 70, feeds: { starch: 0.3, fat: 0.04 } },
  porridge: { name: 'Porridge', category: 'food', weight: 0.4, stackable: true, food: 0.32, decay: 80, feeds: { starch: 0.24, fat: 0.08, greens: 0.05 } },
  preserves: { name: 'Preserves', category: 'food', weight: 0.3, stackable: true, food: 0.28, decay: 12, description: 'Rots slowly.', feeds: { greens: 0.18, starch: 0.1 } },
  flour: { name: 'Flour', category: 'material', weight: 0.1, stackable: true, decay: 30, larder: true, description: 'Wet it to make dough. Stored in a larder or craft material bin.' },
  cornmeal: { name: 'Cornmeal', category: 'material', weight: 0.12, stackable: true, decay: 30, larder: true, description: 'Boiled into porridge. Stored in a larder or craft material bin.' },
  dough: { name: 'Dough', category: 'material', weight: 0.3, stackable: true, decay: 150, larder: true, description: 'Cooked at a fire. Stored in a larder or craft material bin.' },
  bandage: { name: 'Bandage', category: 'misc', weight: 0.05, stackable: true, decay: 10, description: 'Binds one wound.' },
  reed: { name: 'Reed', category: 'material', weight: 0.2, stackable: true, raw: true, decay: 60, description: 'Pressed into papyrus.' },
  papyrus: { name: 'Papyrus', category: 'material', weight: 0.05, stackable: true, decay: 14, description: 'Writing material.' },
  ink: { name: 'Ink', category: 'material', weight: 0.1, stackable: true, decay: 8 },
  book: { name: 'Book', category: 'misc', weight: 1.2, decay: 6, description: 'Study: mind logic. Wears the pages.' },
  // An Artisan's Trade Book: its trade is its label.
  trade_book: { name: 'Trade book', category: 'misc', weight: 1.2, decay: 6, description: 'Study: its trade\'s skill, named on the spine, in place of mind logic. Wears the pages.' },
  fragment: { name: 'Fragment', category: 'misc', weight: 0.6, decay: 3, description: 'Find the other pieces: a restorer joins them. Cannot be repaired before then; gone if it breaks.' },
  treasure_map: { name: 'Treasure map', category: 'misc', weight: 0.1, decay: 20, description: 'Read it to see the picture; find the matching ground and dig. A hoard is always guarded. Rots if left lying on the ground, and the hoard with it; keep it in a pack or crate.' },
  // A square of the island drawn on papyrus (`cartography.ts`): what it holds is its `extra`.
  drawn_map: { name: 'Map', category: 'misc', weight: 0.05, decay: 14, description: '{sheet}: a square of the island centred on the tile it was drawn on, {least} tiles each way and one tile further for every {perTile} QL, so {most} each way at QL {top}. Its name gives place and reach. Study: adds the square to your map. Copy onto another sheet: QL at most the map\'s, the sheet\'s or your papyrusmaking; reach by its own QL.' },
  statuette: { name: 'Statuette', category: 'misc', weight: 1.4, decay: 2 },
  tarnished_bauble: { name: 'Tarnished bauble', category: 'misc', weight: 0.1, decay: 3, description: 'No effect until restored. Restoration difficulty by grade: minor {bauble.minor.difficulty}, major {bauble.major.difficulty}, ancient {bauble.ancient.difficulty}; effect and rarity set at random then. Cannot be repaired before then; gone if it breaks.' },
  bauble_minor: { name: 'Minor bauble', category: 'misc', weight: 0.1, description: 'Set in one of the {bauble.minor.slots} minor sockets of your settlement\'s altar. Citizens working there get its effect on that one skill: less time per action, or more skill gained.' },
  bauble_major: { name: 'Major bauble', category: 'misc', weight: 0.1, description: 'Set in one of the {bauble.major.slots} major sockets of your settlement\'s altar. Citizens working there get its chance of {bauble.yield}× the yield per action in that one skill.' },
  bauble_regret: { name: 'Bauble of Regret', category: 'misc', weight: 0.1, description: 'Undoes a trade or class. Trades window, Undo on your crafting trade or fighting class: as if never taken, tree cleared, this used up. Next trade or class in its place: free (a change costs {regret.saves} silver). Island only.' },
  // What a sacrifice at the altar now and again leaves (`sacrifice.ts`).
  soul: { name: 'Soul', category: 'misc', weight: 0.01, stackable: true, description: 'Left by {sacrifice.soul:pct} of altar sacrifices, at the rarity of what was given. Absorb into (on the soul): an ordinary thing in your pack, or one of a stack, takes its rarity. Used up.' },
  bauble_ancient: { name: 'Ancient bauble', category: 'misc', weight: 0.1, description: 'Set in one of the {bauble.ancient.slots} ancient sockets of your settlement\'s altar. Citizens working there get its bonus added to every yield of that one action.' },
  // A relic's restored thing, used on a wildermon of yours (`creatureActions.ts`, `mirrored`).
  bronze_mirror: { name: 'Bronze mirror', category: 'misc', weight: 0.8, decay: 3, description: 'Use on your wildermon (its menu): its next covering\'s young get its best trait (highest rarity; first listed on a tie) at that rarity, in place of a draw. One mark at a time, used up at that covering. Used up.' },
  /*
   * What four relics are restored into, and good for on a wildermon of yours
   * (`creatureActions.ts`, `{artifact.*}`): a bone comb, an old file, an old
   * lamp and an old pot. Their own things rather than an ordinary file and clay
   * pot, so that nothing made at a bench does what only a restored one does.
   * The comb was `bone_comb` and the lamp `old_lamp` before; a save carries
   * them across (`RENAMED`), as the island did.
   */
  ancient_comb: { name: 'Ancient comb', category: 'misc', weight: 0.15, decay: 3, description: 'Use on your wildermon (its menu): one age younger. Old → grown (as if just grown); grown → young (as if just born). Old: {artifact.oldSpeed:pct} speed, {artifact.oldPull:pct} pull. Grown: full. Young: cannot work, be ridden or pull. No effect on young. Used up.' },
  ancient_file: { name: 'Ancient file', category: 'misc', weight: 0.8, decay: 3, description: 'Use on your wildermon (its menu): 1 in {artifact.fileOdds}, one rarity step up: ordinary → rare → supreme → fantastic. Every blood figure at rare, supreme, fantastic: {artifact.rareBlood} of an ordinary one; drawn bigger. Used up either way.' },
  ancient_lamp: { name: 'Ancient lamp', category: 'misc', weight: 0.9, decay: 3, description: 'Use on your wildermon (its menu): rerolls its lowest-rarity trait (random among ties) to one it lacks, same rarity, or 1 in {artifact.lampOdds} one rarity up ({artifact.tierSteps}). Never lower. At {artifact.topTier}: always another {artifact.topTier} trait. Under {artifact.slots} traits: fills the empty slot, {artifact.lowTier}, or 1 in {artifact.lampOdds} {artifact.nextLowTier}. Used up.' },
  ancient_pot: { name: 'Ancient pot', category: 'misc', weight: 1.2, decay: 3, description: 'Use on your wildermon (its menu): one point to a random base stat under {artifact.potMost}: {artifact.stats}. Each point: {artifact.potStep:pct} more of that stat over its kind and blood. Max {artifact.potMost} per stat. Used up.' },
  /*
   * Six more relics' restored things (`archaeology.ts`): a collar and a bridle
   * for a wildermon of yours (`creatureActions.ts`), and a whetstone, a seed
   * jar, a stamp and a tablet for you and your things (`relicuse.ts`).
   */
  ancient_collar: { name: 'Ancient collar', category: 'misc', weight: 0.4, decay: 3, description: 'Use on your wildermon (its menu): upkeep (hunger rate) −{relicFit.collar:pct}, for good. Once per wildermon. Used up.' },
  ancient_bridle: { name: 'Ancient bridle', category: 'misc', weight: 0.6, decay: 3, description: 'Use on your wildermon (its menu): speed ridden and in a team +{relicFit.bridle:pct}, past the speed cap, for good. Once per wildermon. Used up.' },
  ancient_brace: { name: 'Ancient brace', category: 'misc', weight: 0.7, decay: 3, description: 'Use on your wildermon (its menu): action (task) speed +{relicFit.braceStep:pct} a use, up to {relicFit.braceMost} uses (+{relicFit.braceTop:pct}). Used up.' },
  ancient_whetstone: { name: 'Ancient whetstone', category: 'misc', weight: 0.5, decay: 3, description: 'Hone with it (on a damaged tool or weapon in your pack): all damage off, QL kept. Used up.' },
  ancient_seed_jar: { name: 'Ancient seed jar', category: 'misc', weight: 0.7, decay: 3, description: 'Open: {relicUse.jarSeeds} seeds of one of {relicUse.crops} crops at random, at the jar\'s QL. Used up.' },
  ancient_stamp: { name: 'Ancient stamp', category: 'misc', weight: 0.3, decay: 3, description: 'Carried: rare chance ×{relicUse.stampRare} on your next {relicUse.stampGoes} crafts and forgings. One go each; used up after the last.' },
  rune_tablet: { name: 'Rune tablet', category: 'misc', weight: 1.1, decay: 3, description: 'Read (Skills window, Rune tablet on a skill under {relicUse.tabletBelow}): that skill +{relicUse.tabletGain}. Used up.' },
  // Wildermon gear, a slot and a size each, fitted from its menu (`wildgear.ts`).
  ...GEAR_ITEMS,
  mixed_grass: { name: 'Mixed grass', category: 'material', weight: 0.1, stackable: true, raw: true, decay: 120, description: 'Cutting a grass tile gives {grass.cut}. Plant {grass.plant} on a dirt tile: the tile becomes grass.' },
  sage: { name: 'Sage', category: 'plant', weight: 0.05, stackable: true, food: 0.01, feeds: { greens: 0.01 } },
  basil: { name: 'Basil', category: 'plant', weight: 0.05, stackable: true, food: 0.01, feeds: { greens: 0.01 } },
  thyme: { name: 'Thyme', category: 'plant', weight: 0.05, stackable: true, food: 0.01, feeds: { greens: 0.01 } },
  mint: { name: 'Mint', category: 'plant', weight: 0.05, stackable: true, food: 0.01, feeds: { greens: 0.01 } },
  rosemary: { name: 'Rosemary', category: 'plant', weight: 0.05, stackable: true, food: 0.01, feeds: { greens: 0.01 } },
  // Crop seeds, gathered in the wild and sown on a tilled field.
  onion_seed: { name: 'Onion seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  carrot_seed: { name: 'Carrot seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  cabbage_seed: { name: 'Cabbage seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  potato_seed: { name: 'Seed potatoes', category: 'plant', weight: 0.1, stackable: true, decay: 40 },
  wheat_seed: { name: 'Wheat seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  corn_seed: { name: 'Corn seeds', category: 'plant', weight: 0.03, stackable: true, decay: 40 },
  sage_seed: { name: 'Sage seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  basil_seed: { name: 'Basil seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  thyme_seed: { name: 'Thyme seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  mint_seed: { name: 'Mint seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  rosemary_seed: { name: 'Rosemary seeds', category: 'plant', weight: 0.02, stackable: true, decay: 40 },
  cotton_seed: { name: 'Cotton seeds', category: 'plant', weight: 0.05, stackable: true, decay: 40 },
  wemp_seed: { name: 'Wemp seeds', category: 'plant', weight: 0.05, stackable: true, decay: 40 },
  potato: { name: 'Potato', category: 'food', weight: 0.2, stackable: true, food: 0.1, feeds: { starch: 0.06 } },
  carrot: { name: 'Carrot', category: 'food', weight: 0.12, stackable: true, food: 0.08, feeds: { greens: 0.05 } },
  cabbage: { name: 'Cabbage', category: 'food', weight: 0.4, stackable: true, food: 0.12, feeds: { greens: 0.07 } },
  wheat: { name: 'Wheat', category: 'food', weight: 0.1, stackable: true, food: 0.05, feeds: { starch: 0.04 } },
  corn: { name: 'Corn', category: 'food', weight: 0.2, stackable: true, food: 0.11, feeds: { starch: 0.06 } },
  cotton: { name: 'Cotton', category: 'material', weight: 0.1, stackable: true, raw: true, decay: 30 },
  wemp: { name: 'Wemp fibre', category: 'material', weight: 0.1, stackable: true, raw: true, decay: 30 },
  toolbelt: { name: 'Toolbelt', category: 'tool', weight: 1.1, decay: 3, description: 'Worn: carries your most used actions. One loop per {loopEvery} QL.' },
  rug: { name: 'Rug', category: 'tool', weight: 2.2, decay: 6, description: 'Meditate on it.' },
  composite_bow: { name: 'Composite bow', category: 'tool', weight: 2, description: 'Range {range} tiles, {damage} damage before skill and quality, a shot every {swing} seconds.' },
  scale_helm: { name: 'Scale helm', category: 'tool', weight: 1.6 },
  scale_cuirass: { name: 'Scale cuirass', category: 'tool', weight: 5, description: 'Scale soaks more than plate; burden less than chain.' },
  scale_sleeves: { name: 'Scale sleeves', category: 'tool', weight: 3 },
  scale_leggings: { name: 'Scale leggings', category: 'tool', weight: 4 },
  scale_boots: { name: 'Scale boots', category: 'tool', weight: 2.4 },
  tusk: { name: 'Tusk', category: 'material', weight: 1.6, stackable: true, raw: true, decay: 1, description: 'The belly of a composite bow.' },
  sinew: { name: 'Sinew', category: 'material', weight: 0.2, stackable: true, raw: true, decay: 4, description: 'The back of a composite bow.' },
  dragon_scale: { name: 'Dragon scale', category: 'material', weight: 1.2, stackable: true, raw: true, decay: 0.2, description: 'Scale armour. From a dragon only.' },
  worm: { name: 'Worms', category: 'material', weight: 0.05, stackable: true, raw: true, decay: 90, description: 'Dug from damp dirt with a shovel. Fishing bait for small fish.' },
  fishing_net: { name: 'Fishing net', category: 'tool', weight: 3.5, decay: 5, description: 'Drag through shallow water: many small fish at once; big fish escape.' },
  creel: { name: 'Creel', category: 'misc', weight: 3, decay: 4, description: 'Trap: set in water and bait it.' },
  snare: { name: 'Snare', category: 'misc', weight: 1.2, decay: 5, description: 'Trap: set on land and bait it.' },
  deadfall: { name: 'Deadfall', category: 'misc', weight: 12, decay: 4, description: 'Trap: holds nearly anything that walks.' },
  herb_tea: { name: 'Herb tea', category: 'misc', weight: 0.3, stackable: true, decay: 30, stamina: 0.2, description: 'Drink: +{stamina:pct} stamina.' },
  salve: { name: 'Salve', category: 'misc', weight: 0.1, stackable: true, decay: 6, description: 'Rub in over a dressing: the wound cannot go bad until it closes.' },
  tincture: { name: 'Tincture', category: 'misc', weight: 0.1, stackable: true, decay: 3, description: 'Taken: {skills} gain {bonus:pct} faster for {span:time}.' },
  cover: { name: 'Healing cover', category: 'tool', weight: 0.2, stackable: true, decay: 12, description: 'On the wound it suits: stops bleeding, keeps dirt out, closes it {cover.overCloth} times as fast as cloth.' },
  dye_bucket: { name: 'Bucket of dye', category: 'tool', weight: 6, decay: 10,
    description: 'Up to {bucketLitres} litres of one mix of red, yellow and blue at one QL, in the lye bucket it was boiled in. A boil: {dyeBoil} litres of one primary, {perKg} litre per kg of dyestuff. '
      + 'Poured into an empty or dye barrel: mixes; each primary\'s percentage and the QL average by litres. QL is brightness: black at {qlBlack}, the mix at {qlPure}, white at {qlWhite}. '
      + 'Litres per dyeing: garment, cloth, bag, saddle or bridle {dye.garment}; banner or flag {dye.banner}; sailing boat {dye.sail}; caravel {dye.ship}; wall side or floor tile {dye.wall}. From one bucket in your pack or one dye barrel within reach.' },
  banner: { name: 'Banner', category: 'misc', weight: 4, decay: 5, description: 'Plant on the settlement: flies your colour.' },
  flagpole: { name: 'Flagpole', category: 'misc', weight: 8, decay: 5, description: 'Flag flies downwind: straight out in a gale, hanging in a calm. Dyed: your colour. On a settlement: the settlement\'s device.' },
  rose_arch: { name: 'Rose arch', category: 'misc', weight: 30, decay: 5, description: 'One tile across; walk through it. {rule}' },
  stone_rose_arch: { name: 'Stone rose arch', category: 'misc', weight: 60, decay: 3, description: 'One tile across; walk through it. {rule}' },
  rope: { name: 'Rope', category: 'material', weight: 0.6, stackable: true, decay: 6, description: '{recipe.make_rope.wemp} wemp fibres, laid on a rope tool.' },
  thick_rope: { name: 'Thick rope', category: 'material', weight: 2.4, stackable: true, decay: 4, description: '{recipe.make_thick_rope.rope} ropes. Moors a hull, hangs a bucket down a shaft, carries a bridge span.' },
  onion: { name: 'Onion', category: 'food', weight: 0.15, stackable: true, food: 0.06, feeds: { greens: 0.04 } },
  corpse: { name: 'Corpse', category: 'misc', weight: 12, decay: 90, description: 'Butcher before it rots. Wildermon: meat, fur, leather, bone, glands. Monsters: tusk, sinew and more.' },
  // Furniture, carried flat-packed and set down on the subtile grid.
  stool: { name: 'Stool', category: 'misc', weight: 4, decay: 4, description: 'Set down anywhere.' },
  sign: { name: 'Sign', category: 'misc', weight: 5, decay: 5, description: 'Set it up and name it: the name shows to passers-by.' },
  great_sign: { name: 'Signboard', category: 'misc', weight: 11, decay: 5, description: 'Set it up and write a sentence on it.' },
  chair: { name: 'Chair', category: 'misc', weight: 7, decay: 4, description: 'Set down anywhere.' },
  bench: { name: 'Bench', category: 'misc', weight: 12, decay: 4, description: 'Set down anywhere.' },
  table: { name: 'Table', category: 'misc', weight: 18, decay: 4 },
  long_table: { name: 'Long table', category: 'misc', weight: 34, decay: 4 },
  desk: { name: 'Writing desk', category: 'misc', weight: 24, decay: 4, description: 'Holds {capacity} things.' },
  bed: { name: 'Bed', category: 'misc', weight: 30, decay: 5 },
  // Wildermon beds (`den` in `furniture.ts`): who sleeps in one and what it does for them, filled in by `creatures.ts` off the rule (`BED_REST`, `denClass`).
  den_small: { name: 'Small wildermon bed', category: 'misc', weight: 3, decay: 6, description: 'Your settlement workers tire every {den.tire} cycles and rest. Sleeps one first-evolution-stage wildermon (under level {den.first}), or a non-evolving one under {den.small} health: rest {den.share:pct} as long, {den.bed:time} instead of {den.rest:time}. One at a time; no other size.' },
  den_medium: { name: 'Medium wildermon bed', category: 'misc', weight: 8, decay: 6, description: 'Your settlement workers tire every {den.tire} cycles and rest. Sleeps one second-evolution-stage wildermon (level {den.first} to {den.secondLast}), or a non-evolving one with {den.small} health or more, under {den.large}: rest {den.share:pct} as long, {den.bed:time} instead of {den.rest:time}. One at a time; no other size.' },
  den_large: { name: 'Large wildermon bed', category: 'misc', weight: 16, decay: 6, description: 'Your settlement workers tire every {den.tire} cycles and rest. Sleeps one third-evolution-stage wildermon (level {den.second} and over), or a non-evolving one with {den.large} health or more: rest {den.share:pct} as long, {den.bed:time} instead of {den.rest:time}. One at a time; no other size.' },
  cot: { name: 'Cot', category: 'misc', weight: 16, decay: 5 },
  tent: { name: 'Tent', category: 'misc', weight: 6, decay: 5, description: 'Sleep in it at night: {ofBed:pct} of the rest of a bed of the same QL.' },
  chest: { name: 'Chest', category: 'misc', weight: 26, decay: 4, description: 'Holds {capacity} things.' },
  coffer: { name: 'Coffer', category: 'misc', weight: 10, decay: 4, description: 'Holds {capacity} things.' },
  cupboard: { name: 'Cupboard', category: 'misc', weight: 30, decay: 4, description: 'Holds {capacity} things.' },
  wardrobe: { name: 'Wardrobe', category: 'misc', weight: 42, decay: 4, description: 'Holds {capacity} things.' },
  shelves: { name: 'Shelves', category: 'misc', weight: 34, decay: 4, description: 'Holds {capacity} things.' },
  bookshelf: { name: 'Bookshelf', category: 'misc', weight: 30, decay: 4, description: 'Holds {capacity} things.' },
  larder: { name: 'Larder', category: 'misc', weight: 48, decay: 4, description: 'Holds {capacity} things: food, drink, flour, dough and cornmeal.' },
  crate_shelf: { name: 'Crate shelf', category: 'misc', weight: 64, decay: 4, description: '{w} spots across, {h} deep. Holds {crates} plank crates, each its own crate; shows how many are full.' },
  trellis: { name: 'Trellis', category: 'misc', weight: 8, decay: 4, description: 'For a grapevine; as wide as its wall. {rule} {refused} A grape cutting planted at its foot grows up it.' },
  barrel: { name: 'Barrel', category: 'misc', weight: 14, decay: 4, description: 'Holds {liquid} litres of one liquid. No solids.' },
  creature_crate: {
    name: 'Wildermon crate', category: 'misc', weight: 10, decay: 0,
    description: 'Holds one wildermon. With one already following you, a second can only be tamed into an empty crate in your pack. Set down: shows who is inside; open it to have them follow you or work the settlement. Does not rot.',
  },
  lectern: { name: 'Lectern', category: 'misc', weight: 12, decay: 4 },
  coat_rack: { name: 'Coat rack', category: 'misc', weight: 6, decay: 4 },
  planter: { name: 'Planter', category: 'misc', weight: 12, decay: 4, description: 'Grows one crop, indoors or out: sown, tended and harvested like a field, same seeds and yields, at {growth:pct} of the crop\'s pace in every season, winter included.' },
  firewood_rack: { name: 'Firewood rack', category: 'misc', weight: 14, decay: 4, description: 'Holds {capacity} things.' },
  // The two a lantern is fitted to, and burns at for everybody: see `lamps.ts`.
  lamp_post: { name: 'Lantern post', category: 'misc', weight: 12, decay: 4, description: 'Hang a lantern of yours on it: lights the night for everyone at the lantern\'s reach, {light.lanternNear} tiles at lowest QL, {light.lanternFar} at best. A candle in it lasts as long as in the hand, {light.candleShort:time} to {light.candleLong:time}. Lit, put out and given candles as a lantern.' },
  lamp_pillar: { name: 'Lantern pillar', category: 'misc', weight: 60, decay: 3, description: 'Stand a lantern of yours in it: lights the night for everyone at the lantern\'s reach, {light.lanternNear} tiles at lowest QL, {light.lanternFar} at best. A candle in it lasts as long as in the hand, {light.candleShort:time} to {light.candleLong:time}. Lit, put out and given candles as a lantern.' },
  // And one with no lantern in it: see `runelantern.ts`.
  rune_lantern: { name: 'Rune lantern post', category: 'misc', weight: 60, decay: 3, description: 'Lights the night for everyone as a lantern of its QL: {light.lanternNear} tiles at lowest QL, {light.lanternFar} at best. No lantern, no candle; never goes out.' },
  ale_bucket: { name: 'Bucket of ale', category: 'food', weight: 6, decay: 2, drink: 0.4, charges: 5, description: 'Drink: gives a drink boost.', feeds: { starch: 0.12 } },
  cider_bucket: { name: 'Bucket of cider', category: 'food', weight: 6, decay: 2, drink: 0.45, charges: 5, description: 'Drink: gives a drink boost.', feeds: { greens: 0.1 } },
  juice_bucket: { name: 'Bucket of juice', category: 'food', weight: 6, decay: 6, drink: 0.5, charges: 5, feeds: { greens: 0.1 } },
  mead_bucket: { name: 'Bucket of mead', category: 'food', weight: 6, decay: 1.5, drink: 0.5, charges: 5, description: 'Honey and water, {brew.mead.time:time} in a barrel. Aged in its barrel: {ageing}', feeds: { starch: 0.12, greens: 0.04 } },
  wine_bucket: { name: 'Bucket of wine', category: 'food', weight: 6, decay: 1, drink: 0.5, charges: 5, description: 'Cherries and water, {brew.wine.time:time} in a barrel. Aged in its barrel: {ageing}', feeds: { greens: 0.1 } },
  grape_wine_bucket: { name: 'Bucket of grape wine', category: 'food', weight: 6, decay: 1, drink: 0.5, charges: 5, description: 'Grapes and water, {brew.grape_wine.time:time} in a barrel. Aged in its barrel: {ageing}', feeds: { greens: 0.1 } },
  spirit_bucket: { name: 'Bucket of spirit', category: 'food', weight: 6, decay: 0.5, drink: 0.5, charges: 5, knack: 3, description: 'A drink gives a drink boost lasting {knack}× as long as a drink of {spirit.asStrong} at the same QL.', feeds: { starch: 0.06 } },
  fishing_rod: { name: 'Fishing rod', category: 'tool', weight: 1.4, decay: 3, description: 'Stand at water to fish.' },
  minnow: { name: 'Minnow', category: 'food', weight: 0.1, stackable: true, food: 0.06, decay: 9, description: 'Fishing bait.', feeds: { flesh: 0.04 } },
  perch: { name: 'Perch', category: 'food', weight: 0.5, stackable: true, food: 0.2, decay: 8, feeds: { flesh: 0.09 } },
  trout: { name: 'Trout', category: 'food', weight: 1.2, stackable: true, food: 0.34, decay: 8, description: 'In deep water.', feeds: { flesh: 0.13 } },
  pike: { name: 'Pike', category: 'food', weight: 3, stackable: true, food: 0.55, decay: 7, feeds: { flesh: 0.18 } },
  sturgeon: { name: 'Sturgeon', category: 'food', weight: 9, stackable: true, food: 0.85, decay: 6, description: 'In deep water. Rare.', feeds: { flesh: 0.24 } },
  cooked_fish: { name: 'Cooked fish', category: 'food', weight: 0.6, stackable: true, food: 0.52, decay: 4, feeds: { flesh: 0.28, fat: 0.1 } },
  apple: { name: 'Apple', category: 'food', weight: 0.2, stackable: true, food: 0.16, decay: 2, description: 'Bakes into a pie; presses into cider.', feeds: { greens: 0.07 } },
  // Off a vine on a trellis, in its season (`vineyard.ts`).
  grape: { name: 'Grape', category: 'food', weight: 0.05, stackable: true, food: 0.07, decay: 5, description: 'Picked off a vine on a trellis, in {grapeSeason} only. {brew.grape_wine.count} grapes + {brew.grape_wine.litres} litres of water: a barrel of grape wine.', feeds: { greens: 0.04 } },
  grape_cutting: { name: 'Grape cutting', category: 'plant', weight: 0.1, stackable: true, decay: 160, description: 'Cut off the wild vines in a {wild} with a {tool}. {rule}' },
  cherry: { name: 'Cherry', category: 'food', weight: 0.05, stackable: true, food: 0.07, decay: 5, feeds: { greens: 0.04 } },
  olive: { name: 'Olive', category: 'food', weight: 0.06, stackable: true, food: 0.09, decay: 1.5, description: 'Pressed into olive oil.', feeds: { fat: 0.05 } },
  // The eight the chart holds to an island each. Where each grows is in its line.
  pear: { name: 'Pear', category: 'food', weight: 0.2, stackable: true, food: 0.15, decay: 2.5, description: 'Grows on the Crescent.', feeds: { greens: 0.07 } },
  plum: { name: 'Plum', category: 'food', weight: 0.06, stackable: true, food: 0.08, decay: 4, description: 'Grows in the cold north.', feeds: { greens: 0.04 } },
  peach: { name: 'Peach', category: 'food', weight: 0.15, stackable: true, food: 0.12, decay: 4, description: 'Grows on Middle Isle. Rots fast.', feeds: { greens: 0.06 } },
  fig: { name: 'Fig', category: 'food', weight: 0.05, stackable: true, food: 0.1, decay: 5, description: 'Grows on the skerry, on bare rock.', feeds: { starch: 0.03, greens: 0.03 } },
  lemon: { name: 'Lemon', category: 'food', weight: 0.1, stackable: true, food: 0.04, decay: 1.5, description: 'Grows on the volcano\'s slopes.', feeds: { greens: 0.03 } },
  pomegranate: { name: 'Pomegranate', category: 'food', weight: 0.25, stackable: true, food: 0.12, decay: 1.5, description: 'Grows on the dry steppe.', feeds: { greens: 0.05 } },
  apricot: { name: 'Apricot', category: 'food', weight: 0.05, stackable: true, food: 0.08, decay: 4, description: 'Grows on the steppe.', feeds: { greens: 0.04 } },
  quince: { name: 'Quince', category: 'food', weight: 0.25, stackable: true, food: 0.1, decay: 1.2, description: 'Grows on the Crescent.', feeds: { greens: 0.05 } },
  olive_oil: { name: 'Olive oil', category: 'food', weight: 0.4, stackable: true, food: 0.3, decay: 0.6, description: 'Barely rots.', feeds: { fat: 0.18 } },
  apple_pie: { name: 'Apple pie', category: 'food', weight: 0.9, stackable: true, food: 0.62, decay: 3, feeds: { starch: 0.22, greens: 0.2, fat: 0.1 } },
  sack: { name: 'Sack', category: 'misc', weight: 0.4, decay: 8, holds: 40, shelter: 0.8, description: 'Holds {holds} things. Worn (side): carry limit +{carry:pct} × QL%. Left on the ground: contents rot at {shelter:pct} of the rate.' },
  satchel: { name: 'Satchel', category: 'misc', weight: 1.2, decay: 4, holds: 25, shelter: 0.5, description: 'Holds {holds} things. Left on the ground: contents rot at {shelter:pct} of the rate.' },
  backpack: { name: 'Backpack', category: 'misc', weight: 2.4, decay: 4, holds: 60, shelter: 0.4, description: 'Holds {holds} things. Worn (back): carry limit +{carry:pct} × QL%. Left on the ground: contents rot at {shelter:pct} of the rate. A full one dropped at a work post keeps.' },
  work_post: { name: 'Work post', category: 'misc', weight: 5, decay: 4, description: 'Drive into open ground off your settlement. Stands {post.shortest:time} to {post.longest:time} by QL. One wildermon works from it as from a settlement; returns to you when it falls.' },
  fish_pond: { name: 'Fish pond', category: 'misc', weight: 60, decay: 2, description: 'Set on your settlement: stocks one fish per {every:time}, up to {pond}.' },
  // An Artisan's Potter's Wheel.
  potters_wheel: { name: 'Potter\'s wheel', category: 'misc', weight: 40, decay: 2, description: 'Shaping clay within {reach} tiles: {less:pct} less time per action.' },
  // A Mender's two: a kit that mends anything anywhere, and a seal against decay.
  repair_kit: { name: 'Repair kit', category: 'misc', weight: 1.5, stackable: true, decay: 3, description: 'Use on anything damaged: -{mend} damage, no QL lost. Used up.' },
  sealant: { name: 'Sealant', category: 'material', weight: 0.3, stackable: true, decay: 1, description: 'Seals a thing: it never decays. One per thing; a stack takes one per item.' },
  skep: { name: 'Skep', category: 'misc', weight: 3, decay: 4, description: 'Set down: one honey every {hours} hours per wildflower clump within {reach} tiles; one beeswax per {wax} honey; up to {holds} honey. Nothing in {idle}. Take honey empties it.' },
  hive: { name: 'Hive', category: 'misc', weight: 10, decay: 4, description: 'Set on your settlement. Vesp set to tend it: a honey per {vespHours} hours worked per wildflower clump within {vespReach} tiles, as a skep; a beeswax per {vespWax} honey; none in {vespIdle}. Holds {hive}.' },
  rope_tool: { name: 'Rope tool', category: 'tool', weight: 1.2, description: 'Needed to make rope.' },
  spindle: { name: 'Spindle', category: 'misc', weight: 5, decay: 4, description: 'Spins wool, cotton and wemp into yarn. Stand at it.' },
  loom: { name: 'Loom', category: 'misc', weight: 30, decay: 4, description: 'Weaves yarn into cloth. Stand at it.' },
  // Reed is pressed into papyrus at one of these and nowhere else (`enchant.ts`).
  enchanters_plinth: { name: 'Enchanter\'s plinth', category: 'misc', weight: 60, decay: 3, description: 'Enchant (a scroll into a thing): only within {reach} tiles of the middle of one set on the ground. Writing a scroll: not needed.' },
  // A mason's stone with a line of somebody's own words cut into it (`memorial.ts`).
  memorial_stone: { name: 'Memorial stone', category: 'misc', weight: 40, decay: 0, description: 'Set down; Engrave with a {chisel}: one line, up to {max} characters, masonry. Whoever set it down and anyone of its settlement can recut it. Examine reads it. Keeps its line when moved. Does not decay.' },
  butter_churn: { name: 'Butter churn', category: 'misc', weight: 14, decay: 4, description: 'Churn a bucket of milk into {recipe.churn_butter.count} pats of butter (cooking), within {reach} tiles of one set on the ground; bucket returned empty.' },
  paper_press: { name: 'Paper press', category: 'misc', weight: 24, decay: 4, description: 'Press reed into papyrus, at one set on the ground.' },
  // Brick and mortar, carried flat-packed like everything else until it is set down.
  smelter: { name: 'Smelter', category: 'misc', weight: 52, decay: 3, description: 'Smelts ore into lumps; mixes alloys. Set down on your own settlement.' },
  kiln: { name: 'Kiln', category: 'misc', weight: 34, decay: 3, description: 'Fires clay. Set down on dry, flat ground. Take up when cold and empty.' },
  oven: { name: 'Oven', category: 'misc', weight: 46, decay: 3, description: 'Fuel with wood, light, cook as at a fire: food does not burn.' },
  well: { name: 'Well', category: 'misc', weight: 58, decay: 3, description: 'Draws its own water, faster by QL. Holds {well} litres.' },
  fountain: { name: 'Tiered fountain', category: 'misc', weight: 64, decay: 3, description: 'A well: draws {least} litres a minute at the least, {most} at QL {top}; holds {well} litres. Fill a bucket or waterskin at it, or drink from it.' },
  bulk_bin: { name: 'Raw material bin', category: 'misc', weight: 38, decay: 4, description: 'Raw materials only (ore, logs, dirt, shards, hides). Holds {capacity}.' },
  craft_bin: { name: 'Craft material bin', category: 'misc', weight: 38, decay: 4, description: 'Worked materials only (planks, nails, ribbons, hinges, lumps, bricks). Holds {heft} kg, by weight.' },
  seed_bin: { name: 'Seed bin', category: 'misc', weight: 14, decay: 4, description: 'Seeds. Holds {heft} kg, by weight: {fits.wheat_seed} wheat seeds or {fits.potato_seed} seed potatoes.' },
  sprout_bin: { name: 'Sprout bin', category: 'misc', weight: 14, decay: 4, description: 'Sprouts. Holds {heft} kg, by weight: {fits.sprout} sprouts.' },
  trash_crate: { name: 'Trash crate', category: 'misc', weight: 6, decay: 4, description: 'Contents rot {trash}× faster than in the rain.' },
  cart: { name: 'Small cart', category: 'misc', weight: 26, decay: 4, description: 'Take hold of it: follows you, carrying {capacity} things.' },
  large_cart: { name: 'Large cart', category: 'misc', weight: 180, decay: 4, description: '{bill.large_wheel} large wheels. Holds {capacity} things of any weight. Moves only with a wildermon hitched.' },
  wagon: { name: 'Wagon', category: 'misc', weight: 420, decay: 4, description: '{bill.large_wheel} wheels, {bill.big_axle} axles. Holds {capacity} things of any weight. Moves only with {team} yokes filled.' },
  rowing_boat: { name: 'Rowing boat', category: 'misc', weight: 210, decay: 4, description: 'Launch into {boat.draught:m} deep of water; board and row. Carries {capacity} things and you.' },
  caravel: { name: 'Caravel', category: 'misc', weight: 2400, decay: 4, description: 'A whole tile; needs {boat.draught:m} deep of water. Holds {capacity} things and carries {boat.passengers} passengers plus the helmsman.' },
  sailing_boat: { name: 'Sailing boat', category: 'misc', weight: 620, decay: 4, description: 'Mast, sail and rudder. Needs {boat.draught:m} deep of water. Carries {capacity} things.' },
  small_barrel: { name: 'Small barrel', category: 'misc', weight: 7, decay: 4, description: 'Holds {liquid} litres of one liquid. No solids.' },
  large_barrel: { name: 'Large barrel', category: 'misc', weight: 34, decay: 4, description: 'Holds {liquid} litres of one liquid. Slow to fill and empty.' },
};

/**
 * `fill`, and a stretch of time in figures: `{post.longest:time}` is "3
 * hours", by `timeWords`, where `:span` would say "three hours". Every count
 * and quantity a player reads is in digits ("use digits, not number words").
 */
function fillText(text: string, values: object): string {
  // And a height in metres: `{shoes.step:m}` is "0.8 m", off height units by `metres`.
  return fill(text.replace(/\{([\w.]+):(time|m)\}/g, (whole, key: string, kind: string) => {
    let v: unknown = values;
    for (const k of key.split('.')) v = v === null || v === undefined ? undefined : (v as Record<string, unknown>)[k];
    if (typeof v !== 'number') return whole;
    return kind === 'm' ? `${metres(v)} m` : timeWords(v);
  }), values);
}

/*
 * Every mould the metal table knows is an item, named off that table.
 *
 * Seventeen of them had no entry above and showed on screen as their ids:
 * `arrow_head_mould` in the crafting window, weighing a kilo, because
 * `itemDef` hands back a fallback for anything it has never heard of. The
 * ones written out above keep their own words; the rest are filled in here
 * from the mould table, so a mould added there is named here, and on the
 * island, which reads this list, without a second entry to forget.
 *
 * A mould says how many pieces a filling casts, and the piece says how many
 * come of a lump and how many lumps went into it, both off the mould's own
 * row: `{per}` and `{lumps}` in their text.
 */
const piecesOf = (id: string): string => {
  const name = (ITEM_DEFS[id]?.name ?? id).toLowerCase();
  return name.endsWith('s') ? name : `${name}s`;
};
for (const m of MOULDS) {
  const d = (ITEM_DEFS[m.id] ??= { name: m.name, category: 'tool', weight: 1.2, decay: 1 });
  d.description = fillText(d.description ?? `${(m.per ?? 1) > 1 ? `{per} ${piecesOf(m.makes)} per filling. ` : ''}`
    + 'Wears each filling; cannot be mended.', m);
  const piece = ITEM_DEFS[m.makes];
  if (piece?.description) piece.description = fillText(piece.description, m);
}

/*
 * An ingot of every metal there is a lump of: a Smith's Ingots pours
 * `INGOT_LUMPS` lumps into one at the smelter (`pour_ingot`). It weighs
 * `INGOT_WEIGHT` of what those lumps did, and counts as that many of them
 * wherever the smelter, the anvil, a recipe or Improve takes lumps of its
 * metal. Named off the metal table, as the moulds are, so a metal added
 * there has its ingot here and on the island without a second entry.
 */
for (const m of METALS) {
  const lump = ITEM_DEFS[m.lump];
  if (!lump) continue;
  ITEM_DEFS[ingotOf(m)] ??= {
    name: `${m.name} ingot`,
    category: 'material',
    weight: lump.weight * INGOT_LUMPS * INGOT_WEIGHT,
    stackable: true,
    decay: lump.decay,
    description: `Counts as ${INGOT_LUMPS} ${lump.name.toLowerCase()}s at the smelter, the anvil, the bench and the file. `
      + `Weight: ${percent(INGOT_WEIGHT)} of theirs, {grams} grams. What an action leaves of it comes back as lumps.`,
  };
}

/*
 * A mote of each element, off a mote swirl (`motes.ts`): `earth_mote` and the
 * rest. Not the altar's `soul`, which is a rarity left by a sacrifice; these
 * are named for their element, so no two share a name in a menu, a search or
 * the ledger.
 */
for (const e of MOTE_ELEMENTS) {
  const where = e === 'water' ? 'over water, on every island'
    : e === 'dark' || e === 'light' ? `over land anywhere: ${percent(e === 'dark' ? SWIRL_DARK : SWIRL_LIGHT)} of the swirls on land`
      : `over land on ${elementIslands(e)}`;
  ITEM_DEFS[moteItem(e)] ??= {
    name: moteName(e),
    category: 'misc',
    weight: 0.01,
    stackable: true,
    description: `Collect motes on ${article(e)} ${e} mote swirl, found ${where}. `
      + `Per swirl: ${MOTES_LEAST} at Elementalism under ${MOTES_STEP}, one more per ${MOTES_STEP} points, ${MOTES_MOST} from ${MOTES_MOST_AT}.`
      // A light mote is what a rune gate's pillars are lit by (`runegate.ts`).
      + (e === 'light' ? ' Rune gate: {wall.rune_gate.light_mote} over its stone, one per pillar.' : ''),
  };
}

/*
 * A Telestone (`runestones.ts`): cut with stonecutting out of earth motes and a
 * stone brick, and carried. What it does at either end of its quality is said
 * off the rule, and Examine says what this one does.
 */
ITEM_DEFS[TELESTONE] ??= {
  name: 'Telestone',
  category: 'misc',
  weight: 2,
  description: `Travel to a Runestone: to a free tile beside any Runestone within reach of you. `
    + `Reach: ${TELE_NEAR} tiles at QL ${TELE_QL_LOW}, ${TELE_FAR} at QL ${TELE_QL_HIGH}, ${TELE_RANGE_STEP.toFixed(1)} tiles more per QL between. `
    + `Wait after a journey: ${timeWords(TELE_SLOW)} at QL ${TELE_QL_LOW}, ${timeWords(TELE_FAST)} at QL ${TELE_QL_HIGH}, `
    + `${(TELE_REST_STEP / 60).toFixed(1)} minutes less per QL between. The wait is yours, whichever Telestone you carry. Not used up.`,
};

/*
 * An enchantment scroll (`enchant.ts`), one to each row of the table: written
 * with enchanting out of papyrus and motes, and put into a melee weapon with
 * Enchant. What a hit then does is put in by `enchanting.ts`
 * (`{enchant.<id>.does}`), off the rules it borrows: a Kindler's burn, a
 * knife's bleed, a stun.
 */
for (const e of ENCHANTMENT_LIST) {
  ITEM_DEFS[e.scroll] ??= {
    name: `${e.name} scroll`,
    category: 'misc',
    weight: 0.05,
    decay: 14,
    description: `Enchant (on the scroll): into ${ON_WORDS[e.on]} in your pack. Chance: the average of your enchanting and the scroll's QL, as a percent, `
      + `${percent(ENCHANT_LEAST)} to ${percent(ENCHANT_MOST)}. Enchantment QL: about that average, at most the scroll's QL `
      + `and the QL of what it goes into. Fail: the thing takes ${ENCHANT_HARM} damage, and ${percent(ENCHANT_BREAK)} of the time is destroyed. `
      + `Scroll used up either way. One enchantment per thing. {enchant.${e.id}.does}`
      + `${ROLLED_EFFECTS.has(e.effect) ? ' Triggers on a landed ordinary melee swing only; not class blows, shots or throws.' : ''}`
      + `${SHOT_EFFECTS.has(e.effect) ? ' Triggers on a landed ordinary bow shot only; not class shots.' : ''} `
      + `Failed writing: motes lost; the papyrus takes ${SCROLL_HARM} damage.`,
  };
}

/**
 * Put numbers into every item's text from the module that holds them.
 *
 * An item is written as one object literal, which cannot name its own fields
 * or anybody else's, so its text names them -- `{capacity}`, `{range:W}`,
 * `{recipe.make_rope.wemp:w}` -- and the module that owns each number fills
 * it in when it loads: furniture, crates, weapons, recipes, brews, posts and
 * the rest. What the rule says is what the text says. `benefit.ts` checks that
 * nothing is left unfilled, here and in what the island is handed.
 */
export function describeWith(values: object): void {
  for (const d of Object.values(ITEM_DEFS)) if (d.description?.includes('{')) d.description = fillText(d.description, values);
}
/** The same, for one item, from the definition that holds its numbers. */
export function describeFrom(id: string, values: object): void {
  const d = ITEM_DEFS[id];
  if (d?.description?.includes('{')) d.description = fillText(d.description, values);
}

// And the numbers this module can see: each item's own fields, its weight in
// grams, the other items, and the few rules below it in the graph.
for (const d of Object.values(ITEM_DEFS)) {
  if (!d.description?.includes('{')) continue;
  d.description = fillText(d.description, {
    ...d,
    grams: Math.round(d.weight * 1000),
    item: ITEM_DEFS,
    coinsPerLump: COINS_PER_LUMP,
    rareLumps: RARE_LUMP_FACTOR,
    wall: Object.fromEntries(WALL_TYPES.map((w) => [w.id, Object.fromEntries(w.fittings ?? [])])),
    stainedGlassWall: Object.fromEntries(MATERIAL_BY_ID.get('stained_glass')?.bill ?? []),
    light: {
      lanternNear: lanternReach(1), lanternFar: lanternReach(100), candleShort: candleBurn(1), candleLong: candleBurn(100),
      torchNear: torchReach(1), torchFar: torchReach(100), torchShort: torchBurn(1), torchLong: torchBurn(100),
    },
    cover: { overCloth: (CLOSE_RIGHT / CLOSE_CLOTH).toFixed(1) },
  });
}


// What a stone set in a piece gives, off the rule that gives it (`jewelGain`).
describeFrom('jewelled_ring', { bonus: JEWEL_BONUS });
describeFrom('jewelled_pendant', { bonus: JEWEL_BONUS });
describeFrom('circlet', { stones: CIRCLET_STONES, share: CIRCLET_SHARE, each: JEWEL_BONUS * CIRCLET_SHARE });

/**
 * What a hoard is made of: the deep metals, best first.
 *
 * Here rather than in `butcher.ts` with the dragon it used to come off,
 * because a hoard is come by two ways now and `butcher.ts` reaches into
 * `creatures.ts`. `treasure.ts` importing it from there closed a ring —
 * treasure → butcher → creatures → treasure — and the module that lost the
 * race was the one whose actions `ACTIONS` spreads, so the whole action list
 * came up empty at run time with "TREASURE_ACTIONS is not iterable". It
 * builds perfectly either way; only running it says so.
 */
/** Gold is not among them: the Northeast Tundra's mountain is the one place it comes out of the ground. */
export const HOARD_METALS = ['adamantine_lump', 'glimmersteel_lump', 'mithril_lump', 'seryll_lump', 'silver_lump'];

export interface Item {
  uid: number;
  id: string;
  ql: number;
  dmg: number;
  count: number;
  /** Free text qualifier such as a wood or tree species. */
  extra?: string;
  /** Litres left in a vessel or a skin (`litresOf`), or seconds of candle left in a lantern. */
  charges?: number;
  /** Alight, for the things that burn. */
  lit?: boolean;
  /**
   * Handed out rather than made. What you washed ashore with is serviceable
   * and no more: it can be mended, but there is nothing in it to better.
   */
  issued?: boolean;
  /**
   * How fast it rots lying on the ground, against its own rate: fish a
   * Fisher with Cool Pack set down. Set when it is dropped and gone when it is
   * picked up; nothing rots in a pack.
   */
  cool?: number;
  /** 1 rare, 2 supreme, 3 fantastic; absent for the ordinary run of things. */
  rare?: number;
  /** Who made it, for rare work and better: a maker's mark. The island keeps the same. */
  maker?: string;
  /** What is in it, for the things that hold things. */
  inside?: Item[];
  /** The colour it has been dyed, for the things that take a dye. */
  dye?: string;
  /** Circles of cunning worked into it, 1..3; absent for the ordinary run of things. */
  bless?: number;
  /**
   * Locked. A locked thing will not be dropped, eaten, fed to anything, put on
   * a hook, or swallowed by a craft that was looking for one of its kind. It
   * is the only way to keep your last good hatchet out of the next recipe.
   */
  locked?: boolean;
  /**
   * Which lock this opens, for a key, and nothing at all for anything else.
   *
   * The number is the uid of the padlock it was cut against at the moment it
   * was fitted, so it is unique on an island for as long as the island lasts
   * and there is nothing anywhere to keep in step. A store stamped with the
   * same number is the one it opens.
   */
  keyed?: number;
  /**
   * What it is asking, in silver, laid out on a stall. Absent on everything
   * that is not for sale, which is nearly everything.
   */
  price?: number;
  /**
   * The piece a casting is of: the id of what it becomes at the anvil. A
   * mould poured at a smelter gives one of these rather than the piece
   * itself, and the anvil beats it true. The island keeps the same column.
   */
  piece?: string;
  /**
   * The wildermon shut in it, for a wildermon crate, by its id. Absent on an
   * empty crate and on everything else. See `creaturecrate.ts`; the island
   * keeps the same column.
   */
  creature?: number;
  /**
   * The name of the wildermon in it, as the island tells it for a crate in a store, on a counter or on a rack, where
   * the wildermon may be somebody else's (`storedThing`). Shown after the crate's name.
   */
  occupant?: string;
  /** What its maker's perks put into it as it was made (`Mark`), which stays with it. */
  mark?: Mark;
  /**
   * The enchantment put into it from a scroll, and its quality (`enchant.ts`):
   * an Emberbrand sword. One to a thing. The island keeps the same column.
   */
  enchant?: Enchant;
  /**
   * The line cut into a memorial stone, carried in the pack as it stood on
   * the ground (`memorial.ts`). The island keeps the same column.
   */
  engraving?: string;
}

/**
 * What a maker's perks put into a thing as it is made, and which stays with
 * the thing whoever holds it after: a Carpenter's Deep Drawers make a chest
 * that holds more, and it goes on holding more after it is sold.
 *
 * Each family is a multiplier on one number of the thing's own: `hold` on
 * what it holds, `speed` on how fast it goes, `damage` on what it hits for,
 * `range` on how far it reaches, `soak` on how much of a blow a piece of
 * armour turns aside, `aim` on how often a weapon lands and `last` on how
 * many fillings a mould lasts (the wear a filling does is divided by it).
 * `temper` is the one that is not: it is the quality a quench adds, once,
 * and a thing without it has none to add (`temperOf`). And `seal` is not a
 * maker's at all but whoever sealed it (a Mender's Sealant): nought, on how
 * fast it decays set down; `glaze` is an Artisan's the same way.
 *
 * An Artisan's: `bright` on what a jewel gives, `cut` the most a jewel adds
 * to that at the top of its quality (none without it, `cutOf`), `thrift` on
 * the wear a focus takes and `force` on what it casts, `serve` the servings a
 * pot or bowl adds to a dish cooked in it (none without it, `serveOf`),
 * `keeps` on how fast what is put up in a jar rots, and `teach` and `sturdy`
 * on what a book teaches and the damage studying does it.
 *
 * A perk puts one in with the key `<family>:<what is made>` (`hold:chest`),
 * read off the maker's fold as the thing comes off the bench or the anvil. A
 * thing fitted together from marked parts keeps what the parts carried -- a
 * Smith's Keen Edge in a sword blade goes into the sword, whoever fits it --
 * except a temper, which is for what was finished. The island keeps the same
 * map in the `mark` column of an item and of a piece set down, and carries it
 * between the two.
 */
export type MarkFamily = 'hold' | 'speed' | 'damage' | 'range' | 'soak' | 'aim' | 'last' | 'temper' | 'feed' | 'fill' | 'knack' | 'rot' | 'catch' | 'seal'
  | 'bright' | 'cut' | 'thrift' | 'force' | 'serve' | 'keeps' | 'glaze' | 'teach' | 'sturdy';
export const MARK_FAMILIES: readonly MarkFamily[] = [
  'hold', 'speed', 'damage', 'range', 'soak', 'aim', 'last', 'temper', 'feed', 'fill', 'knack', 'rot', 'catch', 'seal',
  'bright', 'cut', 'thrift', 'force', 'serve', 'keeps', 'glaze', 'teach', 'sturdy',
];
/** The families that are whoever worked a thing over rather than its maker, said on their own and not carried from a part. */
const OVER_WORK: readonly MarkFamily[] = ['seal', 'glaze'];
export type Mark = Partial<Record<MarkFamily, number>>;

/** A thing's mark on one family, which is one where it has none. */
export const markOf = (thing: { mark?: Mark | null }, family: MarkFamily): number => thing.mark?.[family] ?? 1;
/** The quality a quench would add to a thing, which is none unless its maker's mark says otherwise (a Smith's Temper Bath). */
export const temperOf = (thing: { mark?: Mark | null }): number => thing.mark?.temper ?? 0;
/** The most a jewel adds to what it gives at the top of its quality, which is nothing without its setter's mark (an Artisan's Cut True). */
export const cutOf = (thing: { mark?: Mark | null }): number => thing.mark?.cut ?? 0;
/** The servings a pot or bowl adds to a dish cooked in it, which is none without its maker's mark (an Artisan's Deep Pot). */
export const serveOf = (thing: { mark?: Mark | null } | undefined): number => thing?.mark?.serve ?? 0;

/**
 * What a thing fitted together from these parts carries of theirs: every
 * family any of them was marked with, the larger where two say the same, and
 * never a temper, which belongs to whoever finishes the thing, nor a seal or a
 * glaze, which is on the part and not on what it went into.
 */
export function partsMark(parts: ReadonlyArray<{ mark?: Mark | null }>): Mark {
  const out: Mark = {};
  for (const p of parts) {
    for (const f of MARK_FAMILIES) {
      const v = p.mark?.[f];
      if (f === 'temper' || OVER_WORK.includes(f) || v === undefined) continue;
      out[f] = Math.max(out[f] ?? v, v);
    }
  }
  return out;
}

/**
 * A maker's own mark over what the parts carried: the maker's where both say
 * the same, but a pace multiplied, since a yoke's and a builder's are two
 * reasons to go faster (a Tailor's Saddler in the yoke, a Carpenter's in the
 * cart). The island's `perform_craft` does the same.
 */
export function overParts(parts: Mark, made: Mark | undefined): Mark {
  const out: Mark = { ...parts, ...(made ?? {}) };
  if (parts.speed !== undefined && made?.speed !== undefined) out.speed = parts.speed * made.speed;
  return out;
}

/** The mark a maker's perks put on a thing of this id as it is made, or nothing. */
export function makersMark(perk: (key: string, otherwise: number) => number, id: string): Mark | undefined {
  const out: Mark = {};
  for (const f of MARK_FAMILIES) {
    const v = perk(`${f}:${id}`, Number.NaN);
    if (!Number.isNaN(v)) out[f] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** What a mark does, said: " Maker's mark: holds 20% more and goes 10% faster." Nothing for no mark. */
export function markSays(mark: Mark | undefined | null): string {
  if (!mark) return '';
  const pct = (m: number): string => `${Math.round((m - 1) * 100)}%`;
  const said: Record<MarkFamily, (m: number) => string> = {
    hold: (m) => `holds ${pct(m)} more`,
    speed: (m) => `goes ${pct(m)} faster`,
    damage: (m) => `hits ${pct(m)} harder`,
    range: (m) => `reaches ${pct(m)} further`,
    soak: (m) => `turns aside ${pct(m)} more of a blow`,
    aim: (m) => `lands ${pct(m)} more often`,
    last: (m) => `lasts ${+m.toFixed(2)}× the fillings`,
    temper: (m) => `can be quenched once, for +${m} QL`,
    feed: (m) => `feeds each thing it feeds ${pct(m)} more`,
    fill: (m) => `fills ${pct(m)} more of the food bar`,
    knack: (m) => `gives a meal or drink boost that lasts ${pct(m)} longer`,
    rot: (m) => `rots ${Math.round((1 - m) * 100)}% slower`,
    catch: (m) => `catches ${pct(m)} more`,
    seal: () => '',
    bright: (m) => `gives ${pct(m)} more than a plain setting on its stone's skill`,
    cut: (m) => `adds up to ${Math.round(m * 100)}% more skill from every action in its stone's skill, by its quality`,
    thrift: (m) => `wears ${Math.round((1 - m) * 100)}% slower when a spell is cast from it`,
    force: (m) => `makes a spell cast from it ${pct(m)} stronger, and a hold ${pct(m)} longer`,
    serve: (m) => `gives ${m} more ${m === 1 ? 'serving' : 'servings'} of a dish cooked in it`,
    keeps: (m) => `keeps what is put up in it ${+(1 / m).toFixed(2)}× as long`,
    glaze: () => '',
    teach: (m) => `teaches ${pct(m)} more`,
    sturdy: (m) => `takes ${Math.round((1 - m) * 100)}% less damage when studied`,
  };
  const parts = MARK_FAMILIES.filter((f) => !OVER_WORK.includes(f) && mark[f] !== undefined).map((f) => said[f](mark[f] as number));
  // A seal and a glaze are whoever worked it over, not the maker, and are said on their own: nought, the only one there is.
  const sealed = (mark.seal !== undefined ? ' Sealed: never decays.' : '') + (mark.glaze !== undefined ? ' Glazed: never decays.' : '');
  if (!parts.length) return sealed;
  const joined = parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return ` Maker's mark: ${joined}.${sealed}`;
}

/** Whether two things carry the same mark, or both none. */
export const sameMark = (a: { mark?: Mark }, b: { mark?: Mark }): boolean =>
  MARK_FAMILIES.every((f) => a.mark?.[f] === b.mark?.[f]);

/**
 * Rarity. Now and again a thing comes off the bench better than the hands
 * that made it had any right to produce — the grain runs true, the temper
 * takes, the joint pulls up square the first time. Nothing about the maker
 * decides it and nothing can be done to bring it on; it simply happens, and
 * what it leaves behind is better at whatever it was for, slower to wear and
 * slower to rot, and can be bettered past the ceiling of the skill that made
 * it.
 */
export interface RarityDef {
  name: string;
  /** Multiplier on what the thing is for: its edge, its soak, its bite, its room. */
  boost: number;
  /** Multiplier on how fast it wears and rots. */
  keep: number;
  /** Quality it may be improved past your own skill by. */
  ceiling: number;
  /** Its colour, as the island draws it: the shine on a rare thing and the tint on a rare beast. */
  colour: string;
  /**
   * The colour its name is written in on the page: a token the interface's
   * look sets (`--rarity-*` in src/style.css), falling back to `colour` in
   * Classic. Pale blue on pale stone is unreadable, so the page cannot simply
   * reuse the canvas colour.
   */
  css: string;
  /** How much bigger a wildermon that came into the world this rare is than an ordinary one of its kind. */
  size: number;
  /**
   * What it does for a wildermon's every figure: each channel of its blood
   * (`TraitChannel`) is this much better -- multiplied by it where more is
   * better, divided by it where less is (its upkeep, what a blow costs it,
   * how often one lands on it).
   */
  blood: number;
}

export const RARITIES: RarityDef[] = [
  { name: '', boost: 1, keep: 1, ceiling: 0, colour: '', css: '', size: 1, blood: 1 },
  { name: 'rare', boost: 1.1, keep: 0.8, ceiling: 5, colour: '#8fc8f0', css: 'var(--rarity-rare, #8fc8f0)', size: 1.5, blood: 1.2 },
  { name: 'supreme', boost: 1.25, keep: 0.6, ceiling: 12, colour: '#c79bf0', css: 'var(--rarity-supreme, #c79bf0)', size: 2, blood: 1.4 },
  { name: 'fantastic', boost: 1.5, keep: 0.35, ceiling: 25, colour: '#f0c060', css: 'var(--rarity-fantastic, #f0c060)', size: 3, blood: 1.6 },
];

/**
 * Chance of each step, rolled in turn: one thing in a hundred is rare, one in
 * a thousand supreme, one in ten thousand fantastic. Nobody sets out to make
 * a fantastic anything; you make ten thousand ordinary ones and find you have.
 */
export const RARITY_ODDS = [1 / 100, 1 / 10, 1 / 10];
/** What is said when one comes off the bench. */
export const RARITY_WORD = RARITIES.map((r) => (r.name ? `Rarity: ${r.name}.` : ''));

/**
 * What is said when a thing you are already working becomes more than it was.
 *
 * Its own three sentences rather than the bench's, because they are a
 * different moment: nothing has been set down, and the thing in your hands is
 * one you have been at for a while.
 */
export const RARITY_LIFT = RARITIES.map((r) => (r.name ? `Rarity raised: ${r.name}.` : ''));

export const rarityOf = (item: { rare?: number }): RarityDef => RARITIES[Math.max(0, Math.min(3, item.rare ?? 0))];

/**
 * What a container holds, given what a plain one of it holds.
 *
 * A rare chest is a chest somebody got right: the boards sit closer, the lid
 * shuts true, and there is more room inside it than it has any business
 * having. A twentieth more per step -- 5% for rare, 10% for supreme, 15% for
 * fantastic -- and it applies to everything with a limit on what goes into
 * it: bags, crates, cupboards, the weight bins, the charge a smelter takes
 * and the load a kiln fires.
 *
 * Never less than one more unit per step, which is the whole reason this is a
 * function and not a multiplier. A twentieth of a small container rounds to
 * nothing: a kiln holds sixteen, and both a tenth and three twentieths of
 * sixteen round to eighteen, so supreme and fantastic would have been the
 * same kiln. Each step has to be a step.
 */
export const RARITY_ROOM = 0.05;
export function roomFor(base: number, thing: { rare?: number }): number {
  const plain = Math.round(base);
  const step = Math.max(0, Math.min(RARITIES.length - 1, thing.rare ?? 0));
  // A measure the thing has none of stays none: a rare larder counts things, and never gains a kilo of heft.
  return step && plain > 0 ? plain + Math.max(step, Math.round(plain * RARITY_ROOM * step)) : plain;
}

/**
 * Which step a rarity's word is, for reading the island back.
 *
 * The island keeps rarity as the word -- 'rare', 'supreme', 'fantastic' --
 * and this side counts it 1, 2, 3, so every place that reads a row off the
 * wire has to turn one into the other. It was written out at each of them.
 */
export const rarityStep = (word: string | null | undefined): number | undefined => {
  if (!word) return undefined;
  const i = RARITIES.findIndex((r) => r.name === word);
  return i > 0 ? i : undefined;
};

/**
 * The chance a thing is this rare *at all*, rather than the chance of the step
 * on its own.
 *
 * `RARITY_ODDS` is rolled in turn, so each entry is conditional on the one
 * before it: a tenth, of a tenth, of a hundredth. What somebody actually means
 * by "the odds of a fantastic" is the three multiplied out — one in ten
 * thousand — and that is what this is.
 */
export const rarityChance = (step: number, first = RARITY_ODDS[0]): number =>
  step < 1 || step >= RARITIES.length ? 0 : RARITY_ODDS.slice(0, step).reduce((p, o, i) => p * (i === 0 ? first : o), 1);

/**
 * A step up under the file, on a pass that went well.
 *
 * The same odds as making one outright, and one step at a time: a hundred good
 * passes turn a plain thing rare about once, a thousand turn a rare thing
 * supreme, ten thousand turn a supreme thing fantastic. Never two steps — an
 * ordinary thing does not become fantastic because somebody was lucky once,
 * and there is no way to reach the top of it but through the middle.
 *
 * Null when nothing happened, which is almost always, and when there is
 * nothing above what it already is.
 */
export function liftRarity(item: { rare?: number }, rand: () => number): number | null {
  const step = (item.rare ?? 0) + 1;
  if (step >= RARITIES.length) return null;
  return rand() < rarityChance(step) ? step : null;
}

/**
 * Roll for rarity on a newly made thing. `first` is the chance of the first
 * step, which a perk may better (a Carpenter's Master Joiner); the steps after
 * it are rolled at their own odds whatever it is, as `perk_rare` has them.
 */
export function rollRarity(rand: () => number, first = RARITY_ODDS[0]): number {
  let step = 0;
  for (const odds of RARITY_ODDS) {
    if (rand() >= (step === 0 ? first : odds)) break;
    step++;
  }
  return step;
}

/**
 * What the rare things that went into a craft do to the chance of what comes
 * out of it.
 *
 * Asked for: "When crafting, if an ingredient used to craft is rare+, the
 * chance that the outcome is rare+ is increased by the percentage of total
 * ingredients that rare ingredient represents. E.g. a craft with two
 * ingredients, one of which is supreme, has a +50% chance to be supreme."
 *
 * `units` is how many of the units a go used up were at each step, ordinary at
 * nought: counted by the unit, so that four rare planks in a chest of eight
 * are half of it, and only what is used up. A tool, the station it is made at
 * and the bucket a liquid comes back out of are not ingredients, and a
 * container that comes back is not counted on either side of the share.
 *
 * Each step's share of the units goes onto the chance of coming out at
 * exactly that step, rolled from the top step down, the first that comes up
 * winning, and no step's chance more than the steps above it left of a
 * certainty. A step's own odds (`rarityChance`, `first` the first step's,
 * which a perk may better) stay under the share: two units, one of them
 * supreme, come out supreme half the time and the thousandth part they always
 * did, fantastic the ten-thousandth part they always did, and rare or plain
 * the rest. Nothing rare in it and it is the ordinary odds, step for step.
 *
 * The chance of each step, ordinary at nought: the island's `rarity_bands`.
 */
export function rarityBands(units: readonly number[], first = RARITY_ODDS[0]): number[] {
  const total = units.reduce((a, n) => a + Math.max(0, n), 0);
  const bands = RARITIES.map(() => 0);
  let above = 0;
  for (let step = RARITIES.length - 1; step >= 1; step--) {
    const own = rarityChance(step, first) - rarityChance(step + 1, first);
    const share = total > 0 ? Math.max(0, units[step] ?? 0) / total : 0;
    bands[step] = Math.max(0, Math.min(1 - above, own + share));
    above += bands[step];
  }
  bands[0] = Math.max(0, 1 - above);
  return bands;
}

/** Whether anything rare went into it at all, which is when `rarityBands` changes the roll. */
export const anyRareIn = (units: readonly number[]): boolean => units.some((n, step) => step > 0 && n > 0);

/**
 * Roll for rarity on a thing made out of `units` (`rarityBands`): with nothing
 * rare in it, the very roll `rollRarity` always made, dice and all; with
 * something, one die against the steps from the top down.
 */
export function rollRarityFrom(rand: () => number, units: readonly number[], first = RARITY_ODDS[0]): number {
  if (!anyRareIn(units)) return rollRarity(rand, first);
  const bands = rarityBands(units, first);
  const roll = rand();
  let below = 0;
  for (let step = RARITIES.length - 1; step >= 1; step--) {
    below += bands[step];
    if (roll < below) return step;
  }
  return 0;
}

/**
 * What a go says of the rare things that went into it, or null when there were
 * none: each step's share of the units used, as the points it put on the
 * chance of coming out at that step, and the count it is the share of. The
 * island's `rare_input_said`, word for word.
 */
export function rareInputSaid(units: readonly number[]): string | null {
  if (!anyRareIn(units)) return null;
  const total = units.reduce((a, n) => a + Math.max(0, n), 0);
  const parts = units.flatMap((n, step) => (step > 0 && n > 0
    ? [`+${Math.round((n * 100) / total)}% chance of ${RARITIES[step].name} (${n} of ${total} units used)`] : []));
  return `Rare ingredients: ${parts.reverse().join(', ')}.`;
}

/** A tally of units by step, ordinary at nought, to count a go's ingredients into. */
export const rarityTally = (): number[] => RARITIES.map(() => 0);

export function itemDef(id: string): ItemDef {
  return ITEM_DEFS[id] ?? { name: id, category: 'misc', weight: 1 };
}

/**
 * What a trowel turns up that a restorer has not had yet: a piece of a relic
 * and a tarnished bauble.
 *
 * Asked for: "Artifacts that have not been restored should not be able to be
 * repaired. If not restored before broken they are gone." So nothing takes
 * damage off one of these -- not Repair, not a repair kit, not Mend, not a
 * worker mending the stores -- and it comes out of the ground damaged and
 * only ever takes more, from a restoring that fails and from lying out in the
 * weather. At a hundred it breaks and is gone, as anything is. Restored, it
 * is a thing like any other and mends like one. The island's `unrestored`.
 */
export const UNRESTORED: ReadonlySet<string> = new Set(['fragment', 'tarnished_bauble']);
export const unrestored = (item: { id: string }): boolean => UNRESTORED.has(item.id);
/** Why nothing mends one, in the island's words (`not_restored_says`). */
export const NOT_RESTORED = 'Not restored: cannot be repaired. Gone if it breaks first.';

/** What is counted by the lot rather than one by one: 4 cloth, not 4 cloths. */
const BY_THE_LOT = new Set(['cloth', 'wool', 'leather', 'mortar', 'yarn', 'wax', 'sand', 'clay', 'dirt', 'moss', 'thatch', 'peat', 'tar', 'coal', 'concrete', 'cotton', 'wemp', 'mixed_grass', 'sinew', 'honey', 'flour', 'cornmeal', 'dough', 'wheat', 'corn', 'thyme', 'basil', 'mint', 'sage', 'rosemary', 'lavender']);

/**
 * So many of a thing, as it is said: "12 planks", "4 cloth", "a timber". In
 * figures, as every count the player reads is ("use digits, not number
 * words, for every count and quantity"); words only where a caller asks for
 * them with `figures` false.
 */
export function countOf(id: string, n: number, figures = true): string {
  const name = itemDef(id).name.toLowerCase();
  if (n === 1) return `${article(name)} ${name}`;
  const many = BY_THE_LOT.has(id) || name.endsWith('s') ? name : /[^aeiou]y$/.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`;
  return `${figures ? n : numberWord(n)} ${many}`;
}

/** A bill of materials as it is read: "12 planks, 4 timbers, 4 cloth and 26 nails". */
export const billWords = (bill: ReadonlyArray<readonly [string, number]>, figures = true): string =>
  listed(bill.map(([id, n]) => countOf(id, n, figures)));

/**
 * Damage per real hour for an item lying on the ground; better quality holds
 * up longer, and what it is made of decides the rest. A cedar chest left in
 * the rain is still a chest a long time after the pine one has gone. And a
 * dish rots slower for its maker's hand in it (a Cook's Long-lasting, `rot`),
 * and fish a Fisher with Cool Pack set down slower again (`cool`). A thing a
 * Mender's sealant is on does not decay at all (`seal`), nor a pot an
 * Artisan has glazed (`glaze`).
 */
/** What a barrel or a bucket may hold. */
export type LiquidKind = 'water' | 'lye' | 'milk' | 'ale' | 'cider' | 'mead' | 'wine' | 'grape_wine' | 'juice' | 'spirit' | 'dye' | 'whey';
export const LIQUID_NAME: Record<LiquidKind, string> = { water: 'water', lye: 'lye', milk: 'milk', ale: 'ale', cider: 'cider', mead: 'mead', wine: 'wine', grape_wine: 'grape wine', juice: 'juice', spirit: 'spirit', dye: 'dye', whey: 'whey' };
/** A bucket holds five litres, whichever way it is going. */
export const BUCKET_LITRES = 5;
/** Which liquid a full vessel is carrying, and which empty vessel it leaves. */
export const VESSELS: Record<string, { liquid: LiquidKind; empty: string }> = {
  water_bucket: { liquid: 'water', empty: 'bucket' },
  lye_bucket: { liquid: 'lye', empty: 'bucket' },
  milk_bucket: { liquid: 'milk', empty: 'bucket' },
  ale_bucket: { liquid: 'ale', empty: 'bucket' },
  cider_bucket: { liquid: 'cider', empty: 'bucket' },
  mead_bucket: { liquid: 'mead', empty: 'bucket' },
  wine_bucket: { liquid: 'wine', empty: 'bucket' },
  grape_wine_bucket: { liquid: 'grape_wine', empty: 'bucket' },
  juice_bucket: { liquid: 'juice', empty: 'bucket' },
  spirit_bucket: { liquid: 'spirit', empty: 'bucket' },
  // Dye, which says what is in it on the bucket itself (`dyestuffs.ts`).
  dye_bucket: { liquid: 'dye', empty: 'bucket' },
  // Whey, which a bucket of milk pressed into cheese leaves in the bucket (`dairy.ts`).
  whey_bucket: { liquid: 'whey', empty: 'bucket' },
};
/** Which full vessel a litre of each liquid fills an empty bucket into. */
export const BUCKET_OF: Record<LiquidKind, string> = { water: 'water_bucket', lye: 'lye_bucket', milk: 'milk_bucket', ale: 'ale_bucket', cider: 'cider_bucket', mead: 'mead_bucket', wine: 'wine_bucket', grape_wine: 'grape_wine_bucket', juice: 'juice_bucket', spirit: 'spirit_bucket', dye: 'dye_bucket', whey: 'whey_bucket' };

/** Litres a drink out of a skin or a bucket takes. The island's `drink_litres()`. */
export const DRINK_LITRES = 1;
/** Litres of lye tanning a hide takes (`tan_hide`). */
export const TAN_LYE = 1;

/**
 * A litre of what a vessel holds, in kilograms: what a full bucket of water
 * weighs over an empty one, by its litres. The island's `litre_kg`.
 */
export const LITRE_KG = Math.round((ITEM_DEFS.water_bucket.weight - ITEM_DEFS.bucket.weight) / (ITEM_DEFS.water_bucket.charges ?? BUCKET_LITRES) * 1000) / 1000;

/**
 * The litres in a vessel or a skin: its `charges`, full where it has none
 * (one made before vessels held litres); a bucket of dye, its dye's. The
 * island's `item_litres`.
 */
export function litresOf(item: { id: string; charges?: number; dye?: string }): number {
  if (item.id === 'dye_bucket') return dyeIn(item as Item)?.litres ?? 0;
  const def = ITEM_DEFS[item.id];
  // A part bucket is as full as it was milked (`dairy.ts`).
  if (def?.fills) return item.charges ?? 0;
  return item.charges ?? def?.charges ?? 0;
}

export function groundDecayRate(item: Item): number {
  const def = itemDef(item.id);
  const base = def.decay ?? CATEGORY_DECAY[def.category];
  return base * Math.max(0.3, 1.4 - item.ql / 120) * matOfItem(item).decay * rarityOf(item).keep * markOf(item, 'rot') * markOf(item, 'seal')
    * markOf(item, 'glaze') * (item.cool ?? 1);
}

/**
 * What one of a thing weighs, which is its make and what it is made of; a
 * vessel, its empty make and the litres in it (`LITRE_KG`).
 */
export const unitWeight = (item: { id: string; extra?: string; charges?: number; dye?: string }): number =>
  (VESSELS[item.id] ? itemDef(VESSELS[item.id].empty).weight + litresOf(item) * LITRE_KG : itemDef(item.id).weight) * matOfItem(item).weight;
/** What a whole stack of it weighs, and everything it has inside it. */
export const itemWeight = (item: { id: string; extra?: string; charges?: number; dye?: string; count: number; inside?: Item[] }): number =>
  unitWeight(item) * item.count + (item.inside ?? []).reduce((n, it) => n + itemWeight(it), 0);

// ---- Bags: the things that hold other things. ----

/** How many a bag takes, or nothing at all for the things that are not bags. */
/** What a bag holds: its make, its maker's mark (a Tailor's Sack Maker and Deep Pockets), and its rarity. The island's `bag_room`. */
export const bagRoom = (item: Item): number => roomFor((itemDef(item.id).holds ?? 0) * markOf(item, 'hold') * roomMul(item), item);
export const isBag = (item: Item): boolean => bagRoom(item) > 0;
export const bagUnits = (item: Item): number => (item.inside ?? []).reduce((n, it) => n + it.count, 0);
/** How much more a bag will take. */
export const bagSpare = (item: Item): number => Math.max(0, bagRoom(item) - bagUnits(item));

/**
 * What a put says, including what would not go in.
 *
 * Asked for: "when trying to put 48 items in a container that has room for 13,
 * deposit 13 and reject the 35." It used to be all or nothing — a stack that
 * would not fit whole came back whole, and the answer to an armful of ore and
 * a nearly full crate was to count the difference yourself and split the stack
 * by hand. So a put now takes what there is room for and leaves the rest where
 * it was, and says how much stayed behind rather than letting you find out by
 * looking. Written once here because the island says the same sentence, and a
 * sentence said twice is a sentence that drifts.
 */
export const storedLine = (count: number, what: string, where: string, left: number): string =>
  `Stored: ${count} × ${what.toLowerCase()} in ${where.toLowerCase()}.`
  + (left > 0 ? ` ${left} did not fit.` : '');

/**
 * Why a bag will not take something, or null. Nothing that holds things may
 * go inside something else that holds things: that way lies a bag inside a
 * bag inside a bag, and a weight nobody can work out.
 */
export function bagRefuses(bag: Item, item: Item): string | null {
  const name = itemDef(bag.id).name.toLowerCase();
  if (!isBag(bag)) return `${capital(name)}: not a container.`;
  if (isBag(item)) return 'No bags inside bags.';
  // An Artisan's amphora: food and drink, and one kind of it at a time.
  if (itemDef(bag.id).oneKind) {
    if (itemDef(item.id).category !== 'food') return `${capital(name)}: food and drink only.`;
    const had = bag.inside?.[0];
    if (had && had.id !== item.id) return `${capital(name)}: one kind at a time; holds ${itemDef(had.id).name.toLowerCase()}.`;
  }
  if (bagUnits(bag) + item.count > bagRoom(bag)) return `${capital(name)} full.`;
  return null;
}

/**
 * Whether two things may share a stack.
 *
 * Everything that shows in the name or changes what the thing *is* has to
 * match, because a stack has one of each: one quality, one damage, one maker's
 * mark. What is left over is quality and damage, and those average by the
 * unit — a stack is worth what is in it.
 *
 * A locked thing stacks with nothing. Locking is how somebody says *this one,
 * not the next one the game reaches for*, and folding it into a pile would
 * throw that away the moment it was set.
 *
 * `pack_stacks` on the island is this sentence in SQL and the two are asked to
 * agree in the suite. A difference between them is a stack that merges on one
 * side and splits on the other.
 */
export function sameStack(a: Item, b: Item): boolean {
  if (!ITEM_DEFS[a.id]?.stackable) return false;
  return a.id === b.id && !a.locked && !b.locked && !a.lit && !b.lit
    && a.extra === b.extra && a.rare === b.rare && a.dye === b.dye
    && a.bless === b.bless && a.maker === b.maker && a.piece === b.piece
    && !!a.issued === !!b.issued && a.charges === b.charges && sameMark(a, b)
    // An enchanted saddle or bridle is a pile of its own, by the enchantment and its quality.
    && a.enchant?.id === b.enchant?.id && a.enchant?.ql === b.enchant?.ql;
}

/** Fold one thing into another, both quality and damage by the unit. */
export function foldInto(stack: Item, item: Item): void {
  const units = stack.count + item.count;
  stack.ql = (stack.ql * stack.count + item.ql * item.count) / units;
  stack.dmg = (stack.dmg * stack.count + item.dmg * item.count) / units;
  stack.count = units;
}

/** Put something in a bag, stacking with what is already in it where it will. */
export function bagAdd(bag: Item, item: Item): boolean {
  if (bagRefuses(bag, item)) return false;
  if (!bag.inside) bag.inside = [];
  const stack = bag.inside.find((it) => sameStack(it, item));
  if (stack) foldInto(stack, item);
  else bag.inside.push(item);
  return true;
}

/**
 * Use up `n` of one thing in a list of things -- what is in a bag, a crate or
 * a chest -- and take it off the list if that was the last of it. False, and
 * nothing touched, when there are not that many.
 */
export function spendOut(items: Item[], uid: number, n: number): boolean {
  const idx = items.findIndex((it) => it.uid === uid);
  if (idx < 0 || n <= 0 || items[idx].count < n) return false;
  items[idx].count -= n;
  if (items[idx].count <= 0) items.splice(idx, 1);
  return true;
}

/** Take something out of a bag, whole. */
export function bagTake(bag: Item, uid: number): Item | null {
  const idx = (bag.inside ?? []).findIndex((it) => it.uid === uid);
  if (idx < 0) return null;
  const [item] = (bag.inside as Item[]).splice(idx, 1);
  return item;
}

/** An item made over in place as `fresh` would be added new, keeping its number. */
const remake = (it: Item, fresh: Omit<Item, 'uid'>): void => {
  const { uid } = it;
  for (const k of Object.keys(it)) delete (it as unknown as Record<string, unknown>)[k];
  Object.assign(it, { uid, ...fresh });
};

/**
 * gates: a padlock fitted, to a store, a gate or a hidden door: its own item
 * becomes the key cut to it, numbered as it was, so the padlock, the lock and
 * the key share the one number and nothing new is numbered. It is what a key
 * cut new would be -- the padlock's quality and what it was made of, and
 * nothing else of it. Every key is keyed to its own number this way, so no
 * key says more about its lock than another. The island's `key_from_padlock`.
 */
export function keyFromPadlock(it: Item): void {
  remake(it, { id: 'key', ql: it.ql, dmg: 0, count: 1, extra: it.extra, keyed: it.uid });
}

/**
 * And the key, thrown in after its padlock as the padlock comes off: the same
 * item, a padlock again, as a new one is handed back. The island's
 * `padlock_from_key`.
 */
export function padlockFromKey(it: Item): void {
  remake(it, { id: 'padlock', ql: 40, dmg: 0, count: 1, extra: undefined });
}

/**
 * gates: the padlock fitting one takes, to a store, a gate or a hidden door:
 * the first numbered of those in the pack that are not locked against use, as
 * the island takes it (`and not locked order by id`). One locked against use
 * is not there to be fitted, and with only those there is no padlock to fit.
 */
export const padlockToFit = (items: readonly Item[]): Item | undefined =>
  items.filter((i) => i.id === 'padlock' && !i.locked).sort((a, b) => a.uid - b.uid)[0];

/** The goes a fresh ancient stamp is good for, for its name: `relicuse.ts` has the rule, and reads this. */
export const STAMP_GOES_NAMED = 5;

export function itemName(item: Item): string {
  const def = itemDef(item.id);
  const rare = rarityOf(item).name;
  // Colour comes first, then rarity, then the thing itself: a Blue supreme
  // cloth tunic reads the way somebody would actually say it.
  // A bucket of dye is called by the colour of what is in it and how much: a Bucket of purple dye (3 litres).
  const held = dyeIn(item);
  const colour = held ? null : dyeWord(item.dye);
  const words = [colour, rare].filter(Boolean).join(' ');
  // A casting is named for the piece it is of: a shovel head casting, not a casting.
  const plain = item.piece ? `${itemDef(item.piece).name} casting`
    : held ? `${def.name.replace(/ dye$/, '')} ${colourWord(dyeHex(held.liquid))} dye` : def.name;
  const base = words ? `${words.charAt(0).toUpperCase()}${words.slice(1)} ${plain.toLowerCase()}` : plain;
  let name = item.extra ? `${base} (${item.extra.toLowerCase()})` : base;
  // What a vessel holds, in litres: a Bucket of water (3 L).
  if (held) name += ` (${held.litres} L)`;
  else if (def.charges || def.fills) name += ` (${litresOf(item)} L)`;
  // And the goes an ancient stamp has left in it (`relicuse.ts`): an Ancient stamp (3 goes).
  else if (item.id === 'ancient_stamp') name += ` (${Math.max(0, item.charges ?? STAMP_GOES_NAMED)} goes)`;
  // And who is in it, for a wildermon crate in a store: a Wildermon crate (Biscuit).
  if (item.occupant) name += ` (${item.occupant})`;
  // And what is enchanted into it: a Sword (iron) (Emberbrand).
  return name + enchantMarker(item.enchant);
}

/**
 * Where item numbers come from: one well per island, not one per pack.
 *
 * Every item ever made here gets a number, and two items wearing the same
 * number are the same item as far as anything that looks one up is concerned
 * — a crate, a trade, a save. While each pack minted its own numbers, the
 * second guest through the door began counting from wherever the first had
 * begun, and their shovel and his spoon were the same item.
 *
 * So the counter is a thing that can be held rather than a number that can be
 * copied, and everybody on the island holds the same one.
 */
export class UidWell {
  constructor(public next = 1) {}
}

export class Inventory {
  items: Item[] = [];
  onChange?: () => void;
  /** The island's item numbers, shared with every other pack and with the ground. */
  readonly well: UidWell;

  constructor(items?: Item[], nextUid?: number | UidWell) {
    this.well = nextUid instanceof UidWell ? nextUid : new UidWell(nextUid ?? 1);
    if (items) {
      this.items = items;
      this.nextUid = Math.max(this.nextUid, items.reduce((m, it) => Math.max(m, it.uid), 0) + 1);
    }
  }

  /** Next item uid; shared with items lying on the ground so uids never collide. */
  get nextUid(): number {
    return this.well.next;
  }

  set nextUid(v: number) {
    this.well.next = v;
  }

  add(id: string, opts: { ql?: number; count?: number; extra?: string; issued?: boolean; piece?: string; mark?: Mark; rare?: number; maker?: string; enchant?: Item['enchant'] } = {}): Item {
    const def = itemDef(id);
    const count = opts.count ?? 1;
    const ql = Math.max(1, Math.min(100, opts.ql ?? 20));
    const item: Item = { uid: this.nextUid++, id, ql, dmg: 0, count, extra: opts.extra };
    // Rare before it is folded in, so it goes on a pile of its own rather than making a whole pile rare.
    if (opts.rare) item.rare = opts.rare;
    if (opts.maker) item.maker = opts.maker;
    if (opts.issued) item.issued = true;
    if (opts.piece) item.piece = opts.piece;
    // Marked before it is folded in, so it goes on the pile with the same mark or starts one of its own.
    if (opts.mark && Object.keys(opts.mark).length) item.mark = opts.mark;
    // And enchanted the same way: a saddle back off a mount with its Fleetfoot in it.
    if (opts.enchant) item.enchant = opts.enchant;
    if (def.charges) item.charges = def.charges;
    return this.addItem(item);
  }

  /** Whether anything may quietly take this: a craft, a hook, a hungry beast. Never a crate with a wildermon in it. */
  loose(item: Item): boolean {
    return !item.locked && item.creature === undefined;
  }

  /** Put an existing item into the inventory, merging it into a matching stack. */
  addItem(item: Item): Item {
    if (item.uid >= this.nextUid) this.nextUid = item.uid + 1;
    const existing = this.items.find((it) => it.uid !== item.uid && sameStack(it, item));
    if (existing) {
      foldInto(existing, item);
      this.onChange?.();
      return existing;
    }
    this.items.push(item);
    this.onChange?.();
    return item;
  }

  /** Take `count` units out as a separate item (the whole item when it has no more than that). */
  take(uid: number, count = 1): Item | null {
    const idx = this.items.findIndex((it) => it.uid === uid);
    if (idx < 0) return null;
    const item = this.items[idx];
    // A crate with a wildermon in it goes nowhere but down on the ground, which is `remove`.
    if (item.creature !== undefined) return null;
    if (count >= item.count) {
      this.items.splice(idx, 1);
      this.onChange?.();
      return item;
    }
    item.count -= count;
    this.onChange?.();
    return { ...item, uid: this.nextUid++, count };
  }

  /** Removes `count` units of an item; returns false when there were not enough. */
  remove(uid: number, count = 1): boolean {
    const idx = this.items.findIndex((it) => it.uid === uid);
    if (idx < 0) return false;
    const item = this.items[idx];
    if (item.count < count) return false;
    item.count -= count;
    if (item.count <= 0) this.items.splice(idx, 1);
    this.onChange?.();
    return true;
  }

  /**
   * Consume `count` of an item id, drawing across as many stacks as it takes.
   * Once wood and metal are told apart, a pack holds three separate piles of
   * plank as often as one, and a bill for five of them should not care.
   */
  /**
   * Take things to be used up. A **locked** thing is never taken: that is the
   * whole of what locking is for, and it is why `find`, `consume` and `count`
   * look past one while `has`, `get` and `tool` do not — you can still work
   * with a locked hatchet, nothing will quietly eat it.
   */
  consume(id: string, count = 1, extra?: string): boolean {
    const stacks = this.items.filter((it) => it.id === id && !it.locked && (extra === undefined || it.extra === extra));
    if (stacks.reduce((n, it) => n + it.count, 0) < count) return false;
    let left = count;
    for (const st of [...stacks]) {
      if (left <= 0) break;
      const take = Math.min(left, st.count);
      if (this.remove(st.uid, take)) left -= take;
    }
    return left === 0;
  }

  /** The first loose one of a kind: something locked is not offered up. */
  find(id: string, extra?: string): Item | undefined {
    return this.items.find((it) => it.id === id && !it.locked && (extra === undefined || it.extra === extra));
  }

  get(uid: number): Item | undefined {
    return this.items.find((it) => it.uid === uid);
  }

  /**
   * A thing you are carrying, wherever in the pack it is: loose in your hands
   * or stowed in one of your bags.
   *
   * Deliberately not `get`. A hundred places ask `get` what is in your hands
   * and then spend it, and `remove` and `take` only know about the top level,
   * so widening that one would offer jobs that quietly did nothing — the
   * shape of bug the bag work exists to fix. This is asked by the few that
   * the island has agreed may reach into a bag: filling something, drinking
   * out of it, and taking one thing back out.
   */
  held(uid: number): Item | undefined {
    const loose = this.items.find((it) => it.uid === uid);
    if (loose) return loose;
    // One bag will not go inside another, so there is no deeper to look.
    for (const bag of this.items) {
      const inside = bag.inside?.find((it) => it.uid === uid);
      if (inside) return inside;
    }
    return undefined;
  }

  /** The bag a thing is stowed in, when it is in one. */
  bagWith(uid: number): Item | undefined {
    return this.items.find((b) => b.inside?.some((it) => it.uid === uid));
  }

  has(id: string): boolean {
    return this.items.some((it) => it.id === id);
  }

  /** How many of a kind are loose and could be spent. */
  count(id: string): number {
    return this.items.filter((it) => it.id === id && !it.locked).reduce((n, it) => n + it.count, 0);
  }

  /** How many there are of a kind, locked or not, for saying so plainly. */
  countAll(id: string): number {
    return this.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
  }

  /**
   * The best tool of a kind to work with, or undefined. Quality is only half
   * of it once metals differ: a bronze hatchet at forty beats a copper one at
   * fifty, so they are weighed by what they are actually worth at the work.
   */
  tool(id: string): Item | undefined {
    let best: Item | undefined;
    let bestWorth = -1;
    for (const it of this.items) {
      if (it.id !== id) continue;
      const worth = workingQl(it.ql, it.extra) * Math.max(0.3, 1 - it.dmg / 160);
      if (worth > bestWorth) [bestWorth, best] = [worth, it];
    }
    return best;
  }

  /**
   * What a back will take before it starts to tell. Body strength is most of
   * it, and everything above this is carried at a price in pace and wind.
   */
  totalWeight(): number {
    return this.items.reduce((sum, it) => sum + itemWeight(it) * (this.weightMul?.(it.id) ?? 1), 0);
  }

  /**
   * What a trade's perks make of a thing's weight in this pack, by its id: a
   * Terraformer's Soil Porter halves dirt, sand and clay. Nothing, in a game
   * without trades. The island weighs a pack the same way in `carried_weight`.
   */
  weightMul: ((id: string) => number) | null = null;
}
