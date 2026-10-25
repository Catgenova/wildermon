import type { ActionDef, Target } from './actions';
import { enchantTail, roomMul, type Enchant } from './enchant';
import { SIDE_NAMES, type Side } from './building';
import { STORE_REACH, SUBTILES } from './crates';
import { CROP_BY_SEED } from './farming';
import type { Game } from './game';
import { describeFrom, describeWith, isWorked, ITEM_DEFS, itemDef, itemName, markOf, rarityOf, roomFor, storedLine, type Item, type Mark } from './items';
import { fill, heatSaid } from './words';
import { world } from './pace';
import { matOf } from './materials';
import { climberRule, roseSays, type Climber } from './roses';
import { STATE_TAILS } from './pieceTails';
import type { Lamp } from './lamps';
import { colourWord, dyeHex, readDye } from './dyestuffs';
import { ENCHANTERS_PLINTH } from './enchant';
import { lanternReach } from './light';
import { storeMoveRefusal, storeUse } from './stores';

/**
 * What a store takes, for the five that take one sort of thing: raw materials,
 * worked materials, food, seed, sprouts. `TAKES` below holds the test and the
 * sentence for each.
 */
export type Takes = 'raw' | 'worked' | 'food' | 'seed' | 'sprout';

/**
 * Furniture: everything a fine carpenter nails together and sets down indoors.
 * A piece covers a block of subtiles like a smelter does, and the ones with
 * doors and shelves on them hold far more than any crate.
 */
export interface FurnitureDef {
  id: string;
  name: string;
  /** Subtiles it covers, across and down. */
  w: number;
  h: number;
  /** Things it holds, for the pieces that hold anything. */
  capacity?: number;
  /**
   * Kilograms it holds, for a piece measured that way instead.
   *
   * A count is the wrong unit for worked materials. Twelve hundred nails and
   * twelve hundred planks are the same number and not remotely the same load,
   * and a smith who has spent a morning at the anvil has thousands of the one
   * and dozens of the other. So the craft material bin has no count limit at
   * all: what fills it is weight, and a bin of nails takes a quarter of a
   * million of them where a bin of timber takes four hundred.
   *
   * Capacity and this are exclusive. A piece has one or the other, and
   * `furnitureRoom` is the one place that knows which.
   */
  heft?: number;
  /**
   * A counter that sells. What is in it carries a price, anybody may buy from
   * it, and the coins wait in its till for whoever set it up.
   */
  stall?: boolean;
  /**
   * A box the post uses. A parcel goes in at one and comes out at any other,
   * which is the only way anything but words crosses an island between two
   * people who are not standing together.
   */
  post?: boolean;
  /** A board made to be written on: its name is painted across the world. */
  sign?: boolean;
  /** Boards, shafts and nails it is nailed together from. */
  bill: Array<[string, number]>;
  /** How hard it is to make well. */
  difficulty: number;
  /** Seconds of work. */
  time: number;
  /** What the carpenter says when it comes out right. */
  done: string;
  /** Trade that builds it; fine carpentry with a mallet unless it says otherwise. */
  skill?: string;
  tool?: string;
  /**
   * What this store takes, for the ones that take one sort of thing.
   *
   * It was two booleans, `raw` and `crafted`, while the raw material bin and
   * the craft material bin were the only two restricted stores. There are five
   * now, and five parallel flags would be five places to forget one: instead a
   * single field naming the kind, and `TAKES` holding the test and the
   * sentence for each, so the sixth is a row rather than a branch in two files.
   */
  takes?: Takes;
  /** What is put in rots this many times faster than it would in the open. */
  trash?: number;
  /** Can be taken hold of and pulled along behind you. */
  cart?: boolean;
  /** A wheeled thing a team is hitched to and a driver sits on. */
  vehicle?: VehicleDef;
  /** A hull that floats, and is pushed along by whoever is sitting in it. */
  boat?: BoatDef;
  /** Litres of one liquid it holds, and nothing else. */
  liquid?: number;
  /** Draws its own water, up to this many litres. */
  well?: number;
  /** Burns fuel, and cooks whatever a campfire cooks. */
  hearth?: boolean;
  /** Can be slept in; the number is how much of a rest it is. */
  bed?: number;
  /** A perk that has to be held to build it at all, by its key (a Tailor's Tent). */
  perk?: string;
  /**
   * A go at one trade within `reach` tiles of it takes `by` the time, after
   * the floor, whoever built it and whoever is working (an Artisan's potter's
   * wheel). `Game.pieceSpeed`, and `piece_pace` on the island.
   */
  pace?: { skill: string; by: number; reach: number };
  /** A stone table to kneel at. Praying at one banks favour. */
  altar?: boolean;
  /**
   * Built, and set down, only on a settlement of yours, founded or joined.
   * The building is `Recipe.deed`; the setting down is asked of the tile it
   * goes on (`Game.furniturePlaceReason`), and the island reads both off
   * `recipe.deed` on the piece's own recipe.
   */
  deed?: boolean;
  /** Rung on a settlement: every wildermon of the deed comes, and every citizen hears where it hangs. */
  bell?: boolean;
  /** On the map from the day it is set up. */
  landmark?: boolean;
  /**
   * Stone that stands out of doors and greens over with moss from the day it
   * is set down (`greening.ts`), until somebody scrubs it with a brush.
   */
  mossy?: boolean;
  /** What the piece is of, when it is not the wood it was built from. */
  material?: 'wood' | 'metal';
  /**
   * A swarm's own house. Nobody puts anything into a hive: a Vesp set to work
   * the settlement fills it with honey and beeswax off the wildflowers in
   * reach of it (`bees.ts`), and the number is how much it holds before the
   * swarm stops and waits for it to be emptied.
   */
  hive?: number;
  /**
   * A Fisher's pond. Nothing is put into it either: it stocks itself, a fish
   * every `POND_EVERY` standing on a settlement, and the number is how many
   * it holds before it stops until some are taken out.
   */
  pond?: number;
  /**
   * A skep (`bees.ts`): nothing is put into it either. It fills itself with
   * honey and beeswax off the wildflowers in reach of it, worked out from
   * `PlacedFurniture.skepAt` whenever it is looked at or emptied.
   */
  skep?: boolean;
  /**
   * Crate spots on its deck: one to a subtile, so a rack of `w` by `h` holds
   * `w * h` of them.
   *
   * Nothing is stored *in* a piece with this on it. What stands on the deck is
   * an ordinary placed crate at an ordinary subtile — the same crate, with the
   * same contents, the same name and the same deed flag it would have on bare
   * ground. The rack's footprint simply *is* its crate spots, which is why
   * this needs no store of its own on either side of the wire and why a crate
   * on it survives the rack being a browser's idea rather than an island's.
   */
  crates?: number;
  /**
   * Dug where somebody died rather than built: it holds what they were
   * carrying, only they may empty it, and it crumbles on its own. Nobody
   * makes one, so it has no recipe. See `graves.ts`.
   */
  grave?: boolean;
  /**
   * What is planted at its feet and climbs it -- roses or lavender -- growing
   * from the moment it is set down (`roses.ts`): the island hands every
   * browser that moment for a piece with this, and no other (`rpc_ground`,
   * `furniture_def.roses`, true for either).
   */
  climber?: Climber;
  /**
   * A grapevine is planted at its foot and grows up it (`vineyard.ts`): a
   * trellis. It is set down on the ground outside a building, against the
   * outer face of a wall on the side of the tile it faces, and runs the whole
   * of that side: a footprint a row of subtiles long, standing in the row
   * along that side (`furnitureAnchor`).
   */
  vine?: boolean;
  /**
   * A box of earth that one crop is sown in, tended and harvested like a
   * field, growing at `PLANTER_GROWTH` of its pace in every season wherever
   * it stands (`farming.ts`). The island's `is_planter` names the same pieces.
   */
  planter?: boolean;
  /**
   * A place a lantern is fitted and burns for everybody (`lamps.ts`): hung off
   * an iron arm (`arm`), or standing in the top of a pillar (`top`).
   */
  lamp?: 'arm' | 'top';
  /**
   * A light of its own: a band of runes with light motes set in them, which
   * at night lights the ground round it as a lantern of the piece's own
   * quality does, for everybody, and burns nothing (`runelantern.ts`).
   */
  runes?: boolean;
  /**
   * A wildermon bed (`render/dens.ts`): the bed class it is sized for
   * (`denClass` in `creatures.ts`: a kind that evolves by its stage, nought
   * before its first evolution, and one that does not by its health), and
   * only that class fits it (`fitsDen`). A tired deed worker of that class
   * sleeps in one free on its settlement for `BED_REST` of its rest, named in
   * `PlacedFurniture.sleeper` while it does.
   */
  den?: 0 | 1 | 2;
}

/**
 * What it takes to put a vehicle on the road.
 *
 * A large cart rolls behind one wildermon and rolls better behind two; a wagon
 * has four yokes and will not stir until every one of them is filled. Nothing
 * about the load decides it — a full wagon is no slower than an empty one —
 * but the team does: a fast animal gets there sooner, and more of them pull
 * better than fewer.
 */
export interface VehicleDef {
  /** Places a wildermon can be hitched. */
  yokes: number;
  /** Yokes that have to be filled before it will move at all. */
  needs: number;
  /** How high off the ground the seat is in pixels, for drawing the driver. */
  seat: number;
}

/**
 * What it takes to float. A boat goes on water and nowhere else: it is
 * launched into it, it will not cross dry land, and the one aboard has to
 * find a shore again before getting out. Nothing is hitched to it; the pace
 * is the hull's and the arms or the wind behind it.
 */
export interface BoatDef {
  /** Tiles a second at a fair effort. */
  speed: number;
  /** Height units of water it needs under it. */
  draught: number;
  /** How high the deck sits, for drawing whoever is in it. */
  seat: number;
  /**
   * Where whoever has the helm stands, in tiles from her middle along her
   * toward the bow and across her toward starboard, when her helm is on a
   * deck of its own rather than a seat in her middle. They are drawn on their
   * feet there, `seat` up.
   */
  helm?: [number, number];
  /** How high the deck her passengers stand on sits; `seat` when left out. */
  waist?: number;
  /** True when the wind does the work, so the body behind it matters less. */
  sail?: boolean;
  /**
   * People she carries besides whoever has the helm. They come aboard beside
   * her, go wherever she is steered, and step ashore when land is in reach.
   */
  passengers?: number;
  /**
   * Where each of them stands, in tiles from her middle: along her toward the
   * bow, and across her toward starboard. One a place, in the order the
   * places are handed out.
   */
  deck?: Array<[number, number]>;
}

/** Litres a well holds when it is full. */
export const WELL_HOLDS = 200;
/** Litres a tiered fountain holds when it is full. */
export const FOUNTAIN_HOLDS = 50;
/**
 * What a well draws in a second: this much at the least, and this much more
 * the better it was built, all of it at quality 100 (`Game.wellRate`). The
 * island's `well_rate` is the same sum.
 */
export const WELL_TRICKLE = 0.012;
export const WELL_TRICKLE_QL = 0.055;
/** The quality a well draws all of `WELL_TRICKLE_QL` more at. */
export const WELL_TRICKLE_AT = 100;

const piece = (
  id: string,
  name: string,
  w: number,
  h: number,
  bill: Array<[string, number]>,
  difficulty: number,
  time: number,
  done: string,
  capacity?: number,
  extra: Partial<FurnitureDef> = {},
): FurnitureDef => ({ id, name, w, h, bill, difficulty, time, done, capacity, ...extra });

/**
 * Every piece, from a three-legged stool to a wagon. Everything a carpenter
 * builds here is nailed rather than pegged, so every one of them takes nails.
 */
/** Why a piece built only on a settlement of yours will not stand anywhere else; the island says the same (`fire_refusal`). */
export const DEED_PLACE = 'Set down only on a settlement of yours.';
/**
 * Why a second altar will not go up or down on a settlement: it has its one.
 * The island says the same, off the same `altar` flag, and it is the one it
 * refuses both a building and a setting down of with.
 */
export const ONE_ALTAR = 'Settlement already has an altar; one per settlement.';

export const FURNITURE: FurnitureDef[] = [
  piece('stool', 'Stool', 1, 1, [['plank', 4], ['shaft', 3], ['nail', 12]], 8, 6, ''),
  piece('chair', 'Chair', 1, 1, [['plank', 8], ['shaft', 4], ['nail', 20]], 12, 8, ''),
  piece('bench', 'Bench', 2, 1, [['plank', 16], ['shaft', 4], ['nail', 28]], 12, 9, ''),
  piece('table', 'Table', 2, 2, [['plank', 24], ['shaft', 4], ['nail', 32]], 14, 11, ''),
  piece('long_table', 'Long table', 3, 2, [['plank', 40], ['timber', 8], ['shaft', 4], ['nail', 52]], 20, 16, ''),
  piece('desk', 'Writing desk', 2, 2, [['plank', 32], ['timber', 8], ['nail', 40]], 22, 14, '', 20),
  piece('bed', 'Bed', 3, 2, [['plank', 24], ['timber', 16], ['cloth', 8], ['nail', 40]], 18, 15, '', undefined, { bed: 1 }),
  piece('cot', 'Cot', 2, 2, [['plank', 16], ['timber', 8], ['cloth', 4], ['nail', 24]], 12, 10, '', undefined, { bed: 0.7 }),
  // A Tailor's tent: cloth over a ridge pole, light enough to carry and set down wherever the night finds you.
  /*
   * Wildermon beds, one to a stage (`den`): a woven basket nest of reed on
   * bent shafts, a cushion of cloth stuffed with fur in the shape of a
   * flower, moss and wildflowers round the rim, and over the two bigger ones
   * a vine hood hung with lavender bells. A subtile across for the smallest,
   * two for the next and three for the last, by how big each stage is drawn.
   */
  piece('den_small', 'Small wildermon bed', 1, 1, [['plank', 1], ['reed', 12], ['shaft', 2], ['cloth', 2], ['moss', 2], ['wildflowers', 3]], 10, 8,
    '', undefined,
    { skill: 'carpentry', tool: 'carving_knife', den: 0 }),
  piece('den_medium', 'Medium wildermon bed', 2, 2, [['plank', 2], ['reed', 24], ['shaft', 6], ['cloth', 4], ['fur', 1], ['moss', 4], ['wildflowers', 6], ['lavender', 3]], 16, 12,
    '', undefined,
    { skill: 'carpentry', tool: 'carving_knife', den: 1 }),
  piece('den_large', 'Large wildermon bed', 3, 3, [['plank', 4], ['reed', 40], ['shaft', 12], ['cloth', 8], ['fur', 2], ['moss', 6], ['wildflowers', 10], ['lavender', 6]], 22, 16,
    '', undefined,
    { skill: 'carpentry', tool: 'carving_knife', den: 2 }),
  piece('tent', 'Tent', 2, 2, [['cloth', 8], ['rope', 2], ['shaft', 3]], 16, 14, '', undefined, { bed: 0.5, skill: 'tailoring', tool: 'needle', perk: 'tent' }),
  piece('chest', 'Chest', 2, 2, [['plank', 32], ['timber', 8], ['nail', 36]], 16, 12, '', 60),
  piece('coffer', 'Coffer', 1, 1, [['plank', 16], ['nail', 20]], 14, 8, '', 25),
  piece('cupboard', 'Cupboard', 2, 1, [['plank', 40], ['timber', 8], ['nail', 44]], 20, 14, '', 80),
  piece('wardrobe', 'Wardrobe', 2, 2, [['plank', 56], ['timber', 16], ['nail', 60]], 24, 18, '', 100),
  piece('shelves', 'Shelves', 3, 1, [['plank', 48], ['timber', 8], ['nail', 52]], 18, 15, '', 120),
  piece('bookshelf', 'Bookshelf', 2, 1, [['plank', 40], ['timber', 8], ['nail', 44]], 20, 14, '', 90),
  piece('larder', 'Larder', 2, 2, [['plank', 64], ['timber', 16], ['nail', 68]], 26, 20,
    '', 250,
    { takes: 'food' }),
  piece('barrel', 'Barrel', 1, 1, [['plank', 24], ['shaft', 2], ['nail', 20]], 18, 10, '', undefined, { liquid: 80 }),
  /*
   * The two pieces that exist for other people.
   *
   * A **stall** is a counter with goods on it and a price on each, and it
   * sells while you are asleep: anybody standing at it may buy, the coins go
   * into its till, and you empty the till when you next come by. It is the
   * only thing on this island that does anything for you while you are not
   * here, and it is the whole reason coins are worth striking.
   *
   * A **mailbox** is the other half of the post. A letter has carried four
   * hundred characters and nothing else since letters landed; a parcel goes
   * in at one of these and comes out at another, which is what turns writing
   * to somebody into sending them something.
   */
  piece('stall', 'Market stall', 3, 2, [['plank', 48], ['timber', 16], ['cloth', 16], ['nail', 52]], 22, 18,
    'Set a price on what you lay out: it sells while you are away.', 60,
    { stall: true }),
  piece('mailbox', 'Mailbox', 1, 1, [['plank', 16], ['ribbon', 4], ['nail', 16]], 18, 10,
    'A parcel put in at one comes out at any other.', 30,
    { post: true }),
  // One wildermon, shut in to be carried or set down: see `creaturecrate.ts`.
  piece('creature_crate', 'Wildermon crate', 2, 2, [['plank', 32], ['nail', 8], ['ribbon', 4]], 16, 10,
    ''),
  piece('lectern', 'Lectern', 1, 1, [['plank', 16], ['shaft', 2], ['nail', 16]], 16, 9, ''),
  piece('coat_rack', 'Coat rack', 1, 1, [['plank', 4], ['shaft', 4], ['nail', 12]], 10, 6, ''),
  piece('planter', 'Planter', 2, 1, [['plank', 24], ['nail', 20]], 10, 7, '', undefined, { planter: true }),
  // A grapevine climbs it, planted at its foot: see `vineyard.ts`.
  piece('trellis', 'Trellis', SUBTILES, 1, [['plank', 4], ['shaft', 6], ['nail', 12]], 10, 8, '', undefined, { vine: true }),
  piece('firewood_rack', 'Firewood rack', 2, 1, [['plank', 8], ['shaft', 6], ['nail', 20]], 12, 8, '', 40),
  /*
   * The biggest thing a carpenter builds, and the only one whose footprint is
   * the point of it: two subtiles across and four deep, and every one of the
   * eight takes a plank crate.
   *
   * It holds nothing itself. Eight crates stand on it and each is its own
   * crate — a crate of iron ore beside a crate of wheat, named, filled and
   * emptied exactly as they are on the floor. What the rack gives is that they
   * stand in one place, in a row, and you can see across a warehouse how much
   * of it is full.
   */
  piece('crate_shelf', 'Crate shelf', 2, 4,
    [['plank', 80], ['timber', 32], ['nail', 88]], 24, 22,
    '',
    undefined, { crates: 8 }),
  piece('bell', 'Bell', 1, 1, [['bell_casting', 1], ['timber', 8], ['thick_rope', 1], ['nail', 16]], 22, 18, 'Rung on your settlement: every settlement worker comes; every citizen hears where it hangs.', undefined, { bell: true, material: 'metal' }),
  piece('statue', 'Statue', 1, 1, [['statue_casting', 1], ['stone_slab', 1]], 24, 20, 'Shown on the map.', undefined, { landmark: true, material: 'metal', skill: 'masonry', tool: 'trowel', mossy: true }),
  piece('hive', 'Hive', 2, 1, [['plank', 24], ['shaft', 2], ['cloth', 4], ['nail', 24]], 18, 13, '', undefined, { hive: 40 }),
  /*
   * A skep (`bees.ts`): coils of thatch bound into a dome with split reed, a
   * mouth cut at its foot. Woven with a carving knife as a creel is, by
   * ropemaking.
   */
  piece('skep', 'Skep', 1, 1, [['thatch', 6], ['reed', 4]], 12, 10,
    '',
    undefined, { skill: 'ropemaking', tool: 'carving_knife', skep: true }),
  // A Fisher's pond: dug and puddled with clay, a ring of stones round it and reeds at the edge. It stocks itself.
  piece('fish_pond', 'Fish pond', 2, 2, [['clay', 20], ['rock_shards', 12], ['reed', 8]], 20, 20, '', undefined, { pond: 10, skill: 'fishing', tool: 'shovel', perk: 'fish_pond', deed: true }),
  // An Artisan's potter's wheel: a stone flywheel on a spindle in a plank frame, and anybody's pottery near it goes quicker.
  piece('potters_wheel', 'Potter\'s wheel', 1, 1, [['plank', 12], ['shaft', 2], ['stone_slab', 1], ['nail', 12]], 18, 12,
    '', undefined,
    { skill: 'pottery', perk: 'potters_wheel', pace: { skill: 'pottery', by: 0.7, reach: 2.4 } }),
  // The two the cloth trade is built on. Stand at one to spin or weave.
  piece('spindle', 'Spindle', 1, 1, [['plank', 8], ['shaft', 3], ['nail', 16]], 14, 9, ''),
  piece('loom', 'Loom', 2, 2, [['plank', 32], ['timber', 16], ['shaft', 6], ['nail', 48]], 22, 18, ''),
  /*
   * Where reed is pressed into papyrus, and nowhere else (`enchant.ts`): a
   * screw press, built with carpentry. Between a spindle and a loom in what
   * it takes -- a frame of timber the loom's weight would want, on a spindle's
   * footing -- since it is a bench of one job as each of those is.
   */
  piece('paper_press', 'Paper press', 1, 1, [['plank', 24], ['timber', 12], ['shaft', 4], ['nail', 36]], 20, 16,
    '', undefined,
    { skill: 'carpentry' }),
  /*
   * Where a bucket of milk is churned into butter, and nowhere else
   * (`dairy.ts`): a hooped staved tub on its own foot with a dasher through
   * the lid. A bucket's staves and hoops, more of them, on a spindle's footing.
   */
  piece('butter_churn', 'Butter churn', 1, 1, [['plank', 12], ['shaft', 2], ['ribbon', 2], ['nail', 12]], 16, 10,
    '', undefined,
    { skill: 'carpentry' }),
  // Masonry, not carpentry: these two are laid in brick and mortar.
  piece('oven', 'Oven', 2, 2, [['stone_brick', 40], ['mortar', 16]], 24, 18, '', undefined, { skill: 'masonry', tool: 'trowel', hearth: true }),
  /*
   * A fire you can put where you want one, which an oven is not.
   *
   * `hearth` is the whole of what makes it burn: fuelling, lighting, raking
   * out and taking the ashes have read `furnitureDef(kind).hearth` since the
   * oven was written, so a second hearth needed no action of its own. What it
   * needed was a reason to exist, and that is the night — a brazier lights
   * itself at dusk, goes out at dawn, and shows the ground around it while it
   * burns.
   */
  piece('brazier', 'Brazier', 1, 1, [['stone_brick', 24], ['mortar', 8], ['ribbon', 4]], 20, 12, '', undefined, { skill: 'masonry', tool: 'trowel', hearth: true }),
  /*
   * And two that burn a lantern rather than a fire (`lamps.ts`): a squared
   * post with an iron arm off its head for the lantern to hang from, and a
   * coursed pillar with an iron cage in its top for it to stand in. Neither
   * comes with a lantern: the one fitted is the one you carry.
   */
  piece('lamp_post', 'Lantern post', 1, 1, [['timber', 1], ['ribbon', 2], ['nail', 6]], 14, 10,
    '', undefined,
    { skill: 'carpentry', lamp: 'arm' }),
  piece('lamp_pillar', 'Lantern pillar', 1, 1, [['stone_brick', 8], ['mortar', 4], ['ribbon', 2]], 20, 16,
    '', undefined,
    { skill: 'masonry', tool: 'trowel', lamp: 'top' }),
  /*
   * Where a scroll is put into a thing, and nowhere else (`enchant.ts`): a
   * carved stone table, hip high, its rim cut with runes and its top dished
   * where the scroll is laid. Laid in brick like a brazier, a little more of
   * it for the shaft and two slabs for the top, and a light mote and a dark
   * one for its runes. Moss gathers on it as on a statue (`greening.ts`).
   */
  piece(ENCHANTERS_PLINTH, 'Enchanter\'s plinth', 2, 2, [['stone_brick', 32], ['mortar', 12], ['stone_slab', 2], ['light_mote', 1], ['dark_mote', 1]], 26, 24,
    '',
    undefined, { skill: 'masonry', tool: 'trowel', mossy: true }),
  /*
   * And one that needs no lantern (`runelantern.ts`): a squat stone pillar
   * with a band of runes cut round its head and light motes set in them. It
   * lights the ground at night as a lantern of its own quality does, burns
   * nothing and never goes out. Stone out of doors, it greens over as a
   * statue does.
   */
  piece('rune_lantern', 'Rune lantern post', 1, 1, [['stone_brick', 8], ['light_mote', 3]], 24, 20,
    '', undefined,
    { skill: 'masonry', tool: 'trowel', runes: true, mossy: true }),
  /*
   * A memorial stone: a carved stone on a plinth with a line of somebody's
   * own words cut into it (`memorial.ts`). A lantern pillar's mason's work in
   * a slab rather than a column -- a stone slab for its face, bricks and
   * mortar for its plinth -- on a two-by-two block, room round its foot.
   */
  piece('memorial_stone', 'Memorial stone', 2, 2, [['stone_slab', 2], ['stone_brick', 8], ['mortar', 4]], 22, 18,
    '', undefined,
    { skill: 'masonry', tool: 'trowel' }),
  piece('altar', 'Altar', 2, 2, [['stone_brick', 64], ['mortar', 32], ['stone_slab', 4]], 40, 40, 'Kneel here at dawn.', undefined, { skill: 'masonry', tool: 'trowel', altar: true, deed: true }),
  piece('banner', 'Banner', 1, 1, [['cloth', 16], ['shaft', 2], ['rope', 1], ['nail', 12]], 10, 10, '', undefined, { skill: 'tailoring' }),
  /*
   * A pole twice a banner's height with a flag on a halyard at the top of it,
   * which streams out down the wind (`render/furniture.ts`). Dyed as cloth is,
   * before it is set down, and on a settlement it carries the settlement's
   * device as a banner does.
   */
  piece('flagpole', 'Flagpole', 1, 1, [['cloth', 12], ['timber', 2], ['rope', 2], ['nail', 8]], 14, 12, '', undefined, { skill: 'tailoring' }),
  /*
   * An arch over a path, a tile across and a subtile deep, walked through like
   * any piece: a timber one a carpenter builds and a stone one a mason lays,
   * each with a climbing rose -- or lavender -- planted at its feet (`roses.ts`).
   */
  ...(['rose', 'lavender'] as const).flatMap((climber) => {
    const [cut, name] = climber === 'rose' ? ['rose_petals', 'Rose'] : ['lavender', 'Lavender'];
    return [
      piece(`${climber}_arch`, `${name} arch`, 4, 1, [['plank', 24], ['shaft', 6], ['nail', 36], [cut, 16]], 16, 16,
        '', undefined,
        { skill: 'carpentry', climber }),
      piece(`stone_${climber}_arch`, `Stone ${name.toLowerCase()} arch`, 4, 1, [['stone_brick', 36], ['mortar', 12], [cut, 16]], 24, 22,
        '', undefined,
        { skill: 'masonry', tool: 'trowel', climber }),
    ];
  }),
  piece('well', 'Well', 2, 2, [['stone_brick', 48], ['mortar', 16], ['shaft', 4], ['thick_rope', 1], ['nail', 16]], 30, 24, '', undefined, { skill: 'masonry', tool: 'trowel', well: WELL_HOLDS }),
  /*
   * A tiered fountain: basins of cut slab, each smaller than the one under
   * it, on a coursed column, the water welling over the top one and spilling
   * round the rim of each into the next. It is a well to every rule there is
   * -- it draws its own water at a well's rate, up to a well's litres, and a
   * bucket, a skin or a mouth takes from it as from one -- because `well` is
   * the whole of what makes a thing a well, on both sides. Its cost is a
   * well's, in dressed stone rather than a windlass.
   */
  piece('fountain', 'Tiered fountain', 3, 3, [['stone_brick', 32], ['stone_slab', 3], ['mortar', 16]], 32, 26, '', undefined, { skill: 'masonry', tool: 'trowel', well: FOUNTAIN_HOLDS }),
  // Storage of a different sort: raw materials, rubbish, and something to pull it in.
  piece('bulk_bin', 'Raw material bin', 2, 2, [['plank', 48], ['timber', 16], ['nail', 48]], 20, 16, '', 400, { takes: 'raw' }),
  /*
   * Its opposite number, off the same bill of materials.
   *
   * The raw bin solved half the problem: a cartload of ore has somewhere to
   * go. What a smith and a carpenter turn out all day had nowhere -- nails,
   * ribbons, hinges, planks, lumps, bricks -- and they fill a chest in an
   * afternoon because a chest counts things.
   *
   * Counting is the wrong unit for them. This one is measured in kilograms
   * instead: two and a half tonnes of whatever a bench has touched, which is
   * two hundred and fifty thousand nails or twelve hundred planks. There is
   * no count limit on it at all.
   */
  piece('craft_bin', 'Craft material bin', 2, 2, [['plank', 48], ['timber', 16], ['nail', 48]], 20, 16, '', undefined, { heft: 2500, takes: 'worked' }),
  /*
   * And the two small ones, for the two things a farmer and a forester carry
   * home by the handful.
   *
   * Both are weighed rather than counted, for the same reason the craft bin
   * is: a sprout weighs 0.1 kg and a wheat seed 0.02, so a hundred kilograms
   * is a thousand sprouts or five thousand seeds, and no one number of things
   * would have been right for both.
   */
  piece('seed_bin', 'Seed bin', 1, 1, [['plank', 20], ['nail', 20]], 12, 9,
    '',
    undefined, { heft: 100, takes: 'seed' }),
  piece('sprout_bin', 'Sprout bin', 1, 1, [['plank', 20], ['nail', 20]], 12, 9,
    '',
    undefined, { heft: 100, takes: 'sprout' }),
  piece('trash_crate', 'Trash crate', 1, 1, [['plank', 12], ['nail', 12]], 8, 5, '', 30, { trash: 30 }),
  piece('cart', 'Small cart', 2, 1, [['plank', 32], ['shaft', 4]], 18, 14, '', 100, { cart: true }),
  // The two that are driven rather than carried. A wheelwright's bill: wheels
  // on cast axles, a body banded with metal ribbon, and a yoke a wildermon is
  // hitched into.
  piece('large_cart', 'Large cart', 3, 2, [['plank', 80], ['timber', 24], ['large_wheel', 2], ['big_axle', 1], ['ribbon', 16], ['yoke', 2], ['nail', 80]], 30, 40, '', 1000, { skill: 'carpentry', vehicle: { yokes: 2, needs: 1, seat: 15 } }),
  piece('wagon', 'Wagon', 4, 3, [['plank', 160], ['timber', 48], ['large_wheel', 4], ['big_axle', 2], ['ribbon', 32], ['yoke', 4], ['nail', 160]], 45, 75, '', 10000, { skill: 'carpentry', vehicle: { yokes: 4, needs: 4, seat: 19 } }),
  // The two that float. Built on the bank and launched into water with a
  // couple of feet under it; they carry their load and their crew and will
  // not be dragged up a beach.
  piece('rowing_boat', 'Rowing boat', 3, 2, [['plank', 200], ['timber', 60], ['shaft', 2], ['rope', 4], ['nail', 150]], 28, 34, '', 300, { skill: 'carpentry', boat: { speed: 1.9, draught: 2, seat: 9 } }),
  piece('sailing_boat', 'Sailing boat', 4, 3, [['plank', 480], ['timber', 168], ['shaft', 6], ['cloth', 72], ['rope', 24], ['thick_rope', 6], ['ribbon', 24], ['nail', 420]], 42, 70, '', 1500, { skill: 'carpentry', boat: { speed: 3.4, draught: 4, seat: 13, sail: true } }),
  /*
   * And the ship. Every line of her bill is at least three times the sailing
   * boat's, she takes the whole of a tile, she wants deeper water under her,
   * and she is the one hull that carries anybody besides whoever is steering.
   */
  piece('caravel', 'Caravel', 4, 4, [['plank', 1500], ['timber', 520], ['shaft', 18], ['cloth', 220], ['rope', 80], ['thick_rope', 20], ['ribbon', 80], ['nail', 1300]], 60, 180, '', 5000, { skill: 'carpentry', boat: { speed: 4, draught: 5, seat: 33, helm: [-0.65, 0], waist: 18, sail: true, passengers: 3, deck: [[-0.3, 0], [-0.05, 0], [0.3, 0]] } }),
  // Barrels hold liquid and nothing else, in three sizes.
  piece('small_barrel', 'Small barrel', 1, 1, [['plank', 12], ['shaft', 1], ['nail', 12]], 12, 7, '', undefined, { liquid: 30 }),
  piece('large_barrel', 'Large barrel', 2, 2, [['plank', 56], ['shaft', 4], ['nail', 52]], 26, 20, '', undefined, { liquid: 250 }),
  // A board on a post, made to carry writing. Name it and the name stands in
  // the world where anyone walking past can read it.
  piece('sign', 'Sign', 1, 1, [['plank', 8], ['shaft', 2], ['nail', 12]], 10, 7, '', undefined, { sign: true }),
  piece('great_sign', 'Signboard', 2, 1, [['plank', 20], ['timber', 4], ['shaft', 2], ['nail', 24]], 18, 12, '', undefined, { sign: true }),
  /*
   * And the one nobody builds: a mound of earth with a marker at its head,
   * dug where somebody fell and holding what they were carrying. It is a
   * piece so that it opens in the same window and is emptied by the same
   * two doors as a chest; `graves.ts` says who may and for how long.
   */
  piece('grave', 'Grave', 1, 2, [], 0, 0, '', undefined, { grave: true }),
];

export const FURNITURE_BY_ID = new Map(FURNITURE.map((f) => [f.id, f]));
/** Whether a piece is a wildermon bed, and the stage it is sized for (`FurnitureDef.den`). */
export const denStage = (kind: string): 0 | 1 | 2 | undefined => FURNITURE_BY_ID.get(kind)?.den;
/** Whether a wildermon of a bed class (`denClass`) fits a bed of this kind: only the class it is sized for does. */
export const fitsDen = (kind: string, cls: number): boolean => denStage(kind) === cls;
export const isFurniture = (id: string): boolean => FURNITURE_BY_ID.has(id);
export const furnitureDef = (id: string): FurnitureDef => FURNITURE_BY_ID.get(id) ?? FURNITURE[0];
/** Pieces that hold things, largest first: the point of a larder. */
export const STORES = FURNITURE.filter((f) => f.capacity).sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));

export interface PlacedFurniture {
  id: number;
  /** The enchantment set into it where it stands (`enchanting.ts`), which it keeps through being picked up and set down. */
  enchant?: Enchant;
  /** How far gone it is, out of a hundred: a scroll that did not take on it (`enchanting.ts`). Absent is none. */
  dmg?: number;
  /**
   * Whose this is, on an island. Absent in the game you play by yourself,
   * where everything on the ground is yours because there is only you.
   */
  mine?: boolean;

  x: number;
  y: number;
  /** Top-left subtile of the block it covers. */
  sx: number;
  sy: number;
  /**
   * Which way it faces: the side its front is turned to. It stands that way
   * whichever way the view is turned. Absent means south, which is how every
   * piece stood before pieces could be turned.
   */
  facing?: Side;
  /** Which of the twenty it is. */
  kind: string;
  ql: number;
  /** The storey it stands on: `CELLAR_LEVEL` down in a cellar, absent on the ground. */
  level?: number;
  /**
   * 1 rare, 2 supreme, 3 fantastic; absent for the ordinary run of things.
   *
   * A piece set down used to lose it. `place_furniture` copied the quality,
   * the wood and the dye off the item and left the rarity behind, and picking
   * it up again made a plain new one -- so a rare chest was a rare chest until
   * the first time anybody put it in a room, and then it was a chest. It also
   * meant a rare thing could never shine on the ground, because by the time it
   * was on the ground it was not rare any more.
   */
  rare?: number;
  /** Who made it, which rare work and better carries. */
  maker?: string;
  /** What its maker's perks put into it (`Mark`): more room, more pace. */
  mark?: Mark;
  /** What you have called it, when you have called it anything. */
  name?: string;
  /** What is stored in it, for the pieces that store anything. */
  items: Item[];
  /**
   * Seconds of fuel left and whether it is alight, for the oven; and for a
   * lantern post, seconds of candle left in its lantern and whether it burns.
   */
  fuel?: number;
  lit?: boolean;
  ash?: number;
  /** Litres held, and of what, for barrels and the well. */
  litres?: number;
  liquid?: LiquidKind;
  /** Set while the cart is being pulled along behind you. */
  hitched?: boolean;
  /** Wildermon hitched to it, in yoke order; only vehicles have any. */
  team?: number[];
  /** Set while the player is up on the seat with the reins in hand. */
  driven?: boolean;
  /**
   * Somebody else at the helm or on the reins, by their uid on the island,
   * while they are there to hold it. Only an island says this: on this
   * machine alone the only hands are the ones `driven` stands for.
   */
  helm?: string;
  /**
   * Somebody else's helm or reins whose holder has gone away. The reins of a
   * wagon left like that are anybody's; the helm of a hull is taken over from
   * her deck only, so the one who went away has a place to be put in.
   */
  helmAway?: string;
  /**
   * Who is aboard as a passenger, and the place on deck each one has. On an
   * island these are uids; on this machine alone, `riderId` of the body.
   */
  riders?: Array<{ who: string; seat: number }>;
  /** Who has the reins, by who they are on the wire. Absent means whoever is local. */
  driverId?: number;
  /** Honey a hive has toward its next whole one, off its Vesps' trips (`hiveTakes`); its quality; and the honey it has made, for its beeswax. */
  nectar?: number;
  nectarQl?: number;
  honeys?: number;
  /** How far a pond is toward its next fish, a whole one being a fish. */
  stock?: number;
  /** Seconds a brew still has to work before it can be drawn off. */
  ferment?: number;
  /**
   * For a barrel of a brew that ages, the moment it stops (or stopped)
   * working, in epoch seconds: what its age is counted from (`ageing.ts`; the
   * island's `placed.aged_from`). Gone when the barrel is emptied.
   */
  agedFrom?: number;
  /**
   * For a trellis, the moment a vine was planted at its foot and the moment
   * it was last picked, in epoch seconds (`vineyard.ts`; the island's
   * `placed.vine_at` and `placed.picked_at`).
   */
  vineAt?: number;
  pickedAt?: number;
  /**
   * How much longer the knack of what is in it lasts, for its brewer's hand
   * in it (a Cook's Strong Brew): stamped when the brew is set going, drawn
   * off into every bucket filled from it, and gone when it is empty.
   */
  knack?: number;
  /** The wood it was built of, for the pieces a carpenter builds. */
  material?: string;
  /**
   * The colour it was dyed, `#rrggbb`, for a banner, a flag and a sail; and
   * for a barrel of dye, the dye in it (`dyeText`), its litres being `litres`.
   */
  dye?: string;
  /**
   * When it was set down, in epoch seconds, for a piece with roses or lavender
   * on it (`climber`): the island's own moment for it (`placed.made_at`), so
   * that every browser that sees one arch sees it grown as far.
   */
  setAt?: number;
  /**
   * The padlock fitted to it, by the number it shares with its key. See
   * `locks.ts`. Only means anything on a piece that holds things.
   */
  lock?: number;
  /**
   * The founder of the settlement it is a store of, when it is marked one
   * (`stores.ts`): it opens for that settlement's founder and the ranks
   * holding Use the stores, padlock or not, and every take and put is logged.
   */
  storeOf?: string;
  /**
   * What a stall has taken, in silver, waiting for whoever set it up.
   *
   * It goes into the till rather than into a pocket because the pocket is
   * very likely asleep — which is the whole point of a stall and the only
   * thing on this island that does anything for you while you are away.
   */
  till?: number;
  /** The wildermon shut in it, for a wildermon crate standing on the ground. It is drawn inside. */
  creature?: number;
  /**
   * For a grave: who lies under it, what they were called, and the moment it
   * crumbles, in real seconds. On an island `mine` says whether it is yours
   * and `who` is left out, and `units` is how many things are in it, to its
   * owner, however far off -- `items` comes only from within reach. On this
   * machine `who` is the body that died, by the name its machine keeps for it
   * (`Actor.who`). See `graves.ts`.
   */
  grave?: { who?: string; name: string; crumbles: number; units?: number };
  /**
   * For a wildermon bed (`FurnitureDef.den`): the wildermon asleep in it, by
   * its id, drawn curled on its cushion (`render/dens.ts`). Set when a tired
   * worker of its class (`fitsDen`) lies down in it, and cleared when it gets
   * up or stops being a worker (`Creatures.outOfBed`). The island's
   * `placed.sleeper`.
   */
  sleeper?: number;
  /**
   * When the moss on a piece that gathers it (`FurnitureDef.mossy`) began, in
   * real seconds: when it was set down or last scrubbed. See `greening.ts`.
   */
  greenSince?: number;
  /**
   * For a planter: the crop it was last sown with, which a Farmer's Crop
   * Rotation asks after as it does of a field's. What is growing in it now is
   * `Game.planted`, by the piece's id. Picked up, a planter forgets it, as a
   * field broken up does; on an island it is `state.sown` on the placed row.
   */
  sown?: string;
  /** The lantern fitted to a lantern post or pillar (`lamps.ts`); on the island `state -> lamp`. */
  lamp?: Lamp;
  /** The line cut into a memorial stone (`memorial.ts`); on the island the placed row's `engraving`. */
  engraving?: string;
  /**
   * For a skep: when it was set down or last emptied, in epoch seconds, which
   * what it has made is worked out from (`bees.ts`); on the island
   * `state -> skep_at`.
   */
  skepAt?: number;
}

/** Whether a piece is a planter: a box of earth a crop is sown in (`FurnitureDef.planter`). */
export const isPlanter = (f: { kind: string }): boolean => !!furnitureDef(f.kind).planter;
/**
 * Why a planter will not be picked up while something grows in it. The
 * island says the same (`planter_growing_said`, off this).
 */
export const PLANTER_GROWING = 'Harvest or pull up the crop first.';
/**
 * Why a lantern post or pillar with its lantern in will not be picked up: the
 * lantern comes down first (`lamps.ts`). The island says the same.
 */
export const LAMP_TAKE_FIRST = 'Take the lantern down first.';

export { BUCKET_LITRES, BUCKET_OF, LIQUID_NAME, VESSELS, type LiquidKind } from './items';
import { BUCKET_LITRES, LIQUID_NAME, type LiquidKind } from './items';

/*
 * What a piece says about itself, off the piece: what it holds and how much,
 * how many crates stand on it, what it is built of, how much water it wants
 * under it and how many of its yokes have to be filled. Its `done` and its
 * item's description name the fields (`{capacity}`, `{bill.shaft:w}`) and
 * they are put in here, so the words and the rule are one number.
 */
export const teamSaid = (v: VehicleDef): string =>
  v.needs === v.yokes ? `all ${v.yokes}` : `${v.needs} of its ${v.yokes}`;
for (const f of FURNITURE) {
  const said = {
    ...f,
    bill: Object.fromEntries(f.bill),
    team: f.vehicle ? teamSaid(f.vehicle) : undefined,
    // What a weighed store's kilograms come to, counted in one thing: a seed bin's hundred kilograms in wheat seed.
    fits: f.heft === undefined ? undefined
      : Object.fromEntries(Object.entries(ITEM_DEFS).map(([id, d]) => [id, Math.floor((f.heft ?? 0) / d.weight + 1e-9)])),
  };
  f.done = fill(f.done, said);
  describeFrom(f.id, said);
}
describeWith({ bucketLitres: BUCKET_LITRES });
/**
 * How far from a station's middle you can stand and still be at it, in tiles,
 * for every station that is a piece set down (`Game.furnitureNear`): a paper
 * press, a loom, an enchanter's plinth. The island's `at_station` the same.
 */
export const STATION_REACH = 2.4;
describeFrom(ENCHANTERS_PLINTH, { reach: STATION_REACH });
describeFrom('butter_churn', { reach: STATION_REACH });
// What a fountain draws, off the well's own rate: litres a minute at the least, and at quality 100.
describeFrom('fountain', { least: (WELL_TRICKLE * 60).toFixed(1), most: ((WELL_TRICKLE + WELL_TRICKLE_QL) * 60).toFixed(1), top: WELL_TRICKLE_AT });
// A tent's night measured against a bed's, off the two pieces.
describeFrom('tent', { ofBed: (furnitureDef('tent').bed ?? 0) / (furnitureDef('bed').bed ?? 1) });
// How the roses or lavender on an arch grow, off the rule that grows them.
for (const d of FURNITURE) if (d.climber) describeFrom(d.id, { rule: climberRule(d.climber) });

/**
 * What to call a piece standing on the ground.
 *
 * A name you gave it wins outright, and otherwise it is said the way the pack
 * says it: the word for what it is, the wood it was built of, and -- since a
 * piece keeps its rarity when it is set down -- rare, supreme or fantastic in
 * front of the lot.
 */
export const furnitureName = (f: PlacedFurniture): string => {
  if (f.name) return f.name;
  const plain = f.material ? `${furnitureDef(f.kind).name} (${f.material.toLowerCase()})` : furnitureDef(f.kind).name;
  const rare = rarityOf(f).name;
  return rare ? `${rare.charAt(0).toUpperCase()}${rare.slice(1)} ${plain.toLowerCase()}` : plain;
};
export const furnitureUnits = (f: PlacedFurniture): number => f.items.reduce((n, it) => n + it.count, 0);
/** How much more a counting piece will take. `furnitureRoom` is the general one. */
export const furnitureSpare = (f: PlacedFurniture): number => Math.max(0, furnitureCapacity(f) - furnitureUnits(f));
/** What it holds: its build, how strong a wood it was built out of, and its maker's mark. */
// And more for a Deep Hold, a True Axle or a Bag of Holding set into it (`roomMul`), in all three measures.
export const furnitureCapacity = (f: PlacedFurniture): number =>
  roomFor((furnitureDef(f.kind).capacity ?? furnitureDef(f.kind).hive ?? furnitureDef(f.kind).pond ?? 0) * matOf(f.material).hold * markOf(f, 'hold') * roomMul(f), f);
/** Kilograms it holds, for a piece measured that way. Nought for the rest. */
export const furnitureHeft = (f: PlacedFurniture): number =>
  roomFor((furnitureDef(f.kind).heft ?? 0) * matOf(f.material).hold * markOf(f, 'hold') * roomMul(f), f);
/** Kilograms standing in it, which is the only thing a heft bin counts. */
export const furnitureKg = (f: PlacedFurniture): number =>
  f.items.reduce((kg, it) => kg + itemDef(it.id).weight * it.count, 0);
/**
 * Whether a piece holds things at all.
 *
 * This used to be `furnitureCapacity(f) > 0` written out in eight places, and
 * every one of them would have said no to a bin whose limit is weight. One
 * question, asked once.
 */
export const furnitureHolds = (f: PlacedFurniture): boolean => furnitureCapacity(f) > 0 || furnitureHeft(f) > 0;
/**
 * How big a store a piece is for a given thing: what it holds when empty.
 *
 * The straight generalisation of `furnitureCapacity`, and what two stores
 * standing beside each other are ranked by -- so a counting piece is ranked on
 * exactly the number it always was, and a bin measured in kilograms joins the
 * ranking rather than sorting last on a capacity of nought.
 */
export const furnitureSize = (f: PlacedFurniture, item: { id: string }): number => {
  const heft = furnitureHeft(f);
  if (!heft) return furnitureCapacity(f);
  const each = itemDef(item.id).weight;
  return each > 0 ? Math.floor(heft / each) : furnitureCapacity(f);
};
/**
 * How many of a thing will go in.
 *
 * The one place that knows a piece may be measured either way, and the reason
 * it takes the thing as well as the piece: once weight is the limit, how much
 * room there is depends on what you are putting in it. Two hundred and fifty
 * thousand nails and four hundred timbers are the same bin.
 */
export const furnitureRoom = (f: PlacedFurniture, item: { id: string }): number => {
  const heft = furnitureHeft(f);
  if (!heft) return furnitureSpare(f);
  // Nothing on this island weighs nothing, but a divide is a divide.
  const each = itemDef(item.id).weight;
  if (each <= 0) return furnitureUnits(f) > 0 ? 0 : 1;
  return Math.max(0, Math.floor((heft - furnitureKg(f)) / each));
};
/** The four ways a piece can face, in the order a turn to the right takes them: south, west, north, east. */
export const FACINGS: readonly Side[] = ['s', 'w', 'n', 'e'];
/** Which way a piece faces; everything stood facing south before pieces could be turned. */
export const facingOf = (f: { facing?: Side }): Side => f.facing ?? 's';
/** The facing a quarter turn away: to the right for +1, to the left for -1. */
export const turnedFacing = (facing: Side, step: number): Side => FACINGS[(((FACINGS.indexOf(facing) + step) % 4) + 4) % 4];
/** The block of subtiles a piece covers: its width and depth, swapped when it stands across the tile. */
export function furnitureFootprint(kind: string, facing: Side = 's'): [number, number] {
  const def = furnitureDef(kind);
  return facing === 'e' || facing === 'w' ? [def.h, def.w] : [def.w, def.h];
}
export const furnitureCentre = (f: PlacedFurniture): [number, number] => {
  const [w, h] = furnitureFootprint(f.kind, facingOf(f));
  return [f.x + (f.sx + w / 2) / SUBTILES, f.y + (f.sy + h / 2) / SUBTILES];
};

export function furnitureCovers(f: { kind: string; sx: number; sy: number; facing?: Side }, sx: number, sy: number): boolean {
  const [w, h] = furnitureFootprint(f.kind, facingOf(f));
  return sx >= f.sx && sx < f.sx + w && sy >= f.sy && sy < f.sy + h;
}

/** Whether a piece is a rack whose footprint is its crate spots. */
export const rackSpots = (f: { kind: string }): number => furnitureDef(f.kind).crates ?? 0;

/**
 * The subtiles of a rack's deck, in the order its spots fill.
 *
 * Front to back and left to right, which is the order somebody loading one
 * would actually work in and the order the model draws them — so a rack that
 * is three full looks three full from any side rather than showing a gap where
 * the fourth ought to be.
 */
export function rackDeck(f: { kind: string; sx: number; sy: number; facing?: Side }): Array<[number, number]> {
  const [w, h] = furnitureFootprint(f.kind, facingOf(f));
  const out: Array<[number, number]> = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([f.sx + dx, f.sy + dy]);
  return out;
}

/**
 * Top-left subtile of the block a piece would take, kept inside the tile. A
 * piece that stands against a wall (`FurnitureDef.vine`) goes into the row of
 * subtiles along the side it faces, wherever on the tile it was asked for.
 * The island's `piece_anchor`.
 */
export function furnitureAnchor(kind: string, sx: number, sy: number, facing: Side = 's'): [number, number] {
  const [w, h] = furnitureFootprint(kind, facing);
  const ax = Math.max(0, Math.min(SUBTILES - w, sx)), ay = Math.max(0, Math.min(SUBTILES - h, sy));
  if (!furnitureDef(kind).vine) return [ax, ay];
  return [facing === 'w' ? 0 : facing === 'e' ? SUBTILES - w : ax, facing === 'n' ? 0 : facing === 's' ? SUBTILES - h : ay];
}

/** The vehicle a piece is, if it is one. */
export const vehicleOf = (f: { kind: string }): VehicleDef | undefined => furnitureDef(f.kind).vehicle;
export const isVehicle = (f: { kind: string }): boolean => !!furnitureDef(f.kind).vehicle;
/**
 * Why a team is not put into or taken out of the traces of a vehicle standing
 * a storey up, where it was driven up a wide staircase, or null on the ground:
 * the team goes up and down with it and nowhere on its own. The island's
 * `ride_refusal` says the same.
 */
export const tracesStoreyRefusal = (f: PlacedFurniture): string | null =>
  (f.level ?? 0) > 0 ? `Bring the ${furnitureName(f).toLowerCase()} to the ground floor first: teams yoke and unyoke on the ground only.` : null;
/** The boat a piece is, if it is one. */
export const boatOf = (f: { kind: string }): BoatDef | undefined => furnitureDef(f.kind).boat;
export const isBoat = (f: { kind: string }): boolean => !!furnitureDef(f.kind).boat;
/** Anything that is boarded and steered: wheels or hull. */
export const isDriveable = (f: { kind: string }): boolean => isVehicle(f) || isBoat(f);
/** Places on deck for passengers: none on anything but a hull built to carry them. */
export const passengerPlaces = (f: { kind: string }): number => furnitureDef(f.kind).boat?.passengers ?? 0;
/** Who is aboard her as a passenger. */
export const ridersOf = (f: PlacedFurniture): Array<{ who: string; seat: number }> => f.riders ?? [];
/** The first place on deck nobody has, or null when every one is taken. */
export function freeSeat(f: PlacedFurniture): number | null {
  const taken = new Set(ridersOf(f).map((r) => r.seat));
  for (let s = 1; s <= passengerPlaces(f); s++) if (!taken.has(s)) return s;
  return null;
}
/** The way a piece's width runs in the world for each way it faces; a hull's bow is at the far end of it. */
export const ACROSS_OF: Record<Side, [number, number]> = { s: [1, 0], e: [0, -1], n: [-1, 0], w: [0, 1] };
/** Where the passenger in a place stands, in tiles from her middle: along toward the bow, and across toward starboard. */
export const deckSpot = (kind: string, seat: number): [number, number] =>
  furnitureDef(kind).boat?.deck?.[seat - 1] ?? [0, 0];
/** Wildermon hitched to it, which is an empty list for everything else. */
export const teamOf = (f: PlacedFurniture): number[] => f.team ?? [];

/** Litres a vessel holds: a barrel by its build, a well by how deep it was sunk. */
export const liquidCapacity = (f: PlacedFurniture): number => {
  const def = furnitureDef(f.kind);
  // A well is a lined shaft in the ground; only the coopered things vary.
  return def.liquid ? Math.round(def.liquid * matOf(f.material).hold * markOf(f, 'hold') * roomMul(f)) : def.well ?? 0;
};
export const holdsLiquid = (f: PlacedFurniture): boolean => liquidCapacity(f) > 0;
export const litresIn = (f: PlacedFurniture): number => f.litres ?? 0;
/** A well draws its own water; a barrel only holds what is poured into it. */
export const isWell = (f: PlacedFurniture): boolean => (furnitureDef(f.kind).well ?? 0) > 0;
/** Room left in a hive, which takes nothing from anyone's hands: its Vesps fill it (`hiveTakes`). */
export const hiveRoom = (f: PlacedFurniture): number => furnitureCapacity(f) - furnitureUnits(f);

export const isHive = (f: { kind: string }): boolean => (furnitureDef(f.kind).hive ?? 0) > 0;

/**
 * How a Fisher's pond stocks itself: a fish every this many seconds while it
 * stands on a settlement and has room, drawn from all five at their plain
 * weights, at about the pond's quality. The island's `pond_sweep` reads the same.
 */
export const POND_EVERY = 3600;
export const isPond = (f: { kind: string }): boolean => (furnitureDef(f.kind).pond ?? 0) > 0;
describeFrom('fish_pond', { every: POND_EVERY });
{
  const wheel = FURNITURE.find((f) => f.id === 'potters_wheel')?.pace;
  if (wheel) describeFrom('potters_wheel', { reach: wheel.reach, less: 1 - wheel.by });
}

/**
 * What a raw material bin says to anything a bench has touched. The island
 * says it in the same words (`furniture_refuses`).
 */
export const RAW_BIN_REFUSAL = 'Raw material bin: raw materials only (ore, logs, dirt, shards, wool).';

/**
 * And what the other bin says to anything straight out of the ground. The
 * island says it in the same words (`furniture_refuses`).
 */
export const CRAFT_BIN_REFUSAL = 'Craft material bin: worked materials only (planks, nails, ribbons, hinges).';

export const LARDER_REFUSAL = 'Larder: food, drink, flour, dough and cornmeal only.';
export const SEED_BIN_REFUSAL = 'Seed bin: seeds only.';
export const SPROUT_BIN_REFUSAL = 'Sprout bin: sprouts only.';

/**
 * The five restricted stores: what each takes, and what it says to the rest.
 *
 * One table rather than a flag apiece, because the door is the same door five
 * times over and the only thing that varies is the question at it. The island
 * holds the same five under the same names, in `furniture_takes`, and the two
 * of them have to answer alike or a put the browser allows is a put the
 * island refuses.
 */
export const TAKES: Record<Takes, { is: (id: string) => boolean; refusal: string }> = {
  raw: { is: (id) => !!itemDef(id).raw, refusal: RAW_BIN_REFUSAL },
  worked: { is: isWorked, refusal: CRAFT_BIN_REFUSAL },
  /*
   * Food, drink, and the three things that are kept in a larder without being
   * food: flour, dough and cornmeal. Asked for: "flour and dough should go in
   * the larder too." They are ground grain and what is made of it, they keep
   * and decay like materials because that is what they are, and `ItemDef.larder`
   * says where they live rather than what they are.
   */
  food: { is: (id) => itemDef(id).category === 'food' || !!itemDef(id).larder, refusal: LARDER_REFUSAL },
  seed: { is: (id) => CROP_BY_SEED.has(id), refusal: SEED_BIN_REFUSAL },
  sprout: { is: (id) => id === 'sprout', refusal: SPROUT_BIN_REFUSAL },
};

/**
 * Why a piece will not take something, or null if it will. A barrel takes no
 * solids at all, a hive is the swarm's, and the five restricted stores each
 * ask `TAKES` the one question they were built around.
 */
export function furnitureRefuses(f: PlacedFurniture, item: Item): string | null {
  const def = furnitureDef(f.kind);
  const it = def.name;
  if (holdsLiquid(f)) return `${it}: liquids only.`;
  if (def.hive) return `${it}: take only; nothing goes in.`;
  if (def.pond) return `${it}: take fish only; nothing goes in.`;
  if (!furnitureHolds(f)) return `${it}: holds nothing.`;
  // Its id is spelled out rather than imported: creaturecrate.ts imports this file.
  if (item.id === 'creature_crate' && !def.stall) return 'Wildermon crates go on a stall only.';
  const takes = def.takes && TAKES[def.takes];
  if (takes && !takes.is(item.id)) return takes.refusal;
  return null;
}

/** Most fuel an oven holds: it is bigger than a campfire and burns longer. */
export const OVEN_CAPACITY = world(7200);

/**
 * How fast a brazier eats what is in it, by how well it was built.
 *
 * A shallow bowl with a bad draw roars through its fuel; one laid true and
 * banded tight burns low and long. Seconds of fuel spent per second alight:
 * about one and a half at quality 1, one at 40, and three fifths at 100 — so
 * a well-made brazier gets nearly three times the night out of the same
 * armful of wood as a rough one.
 *
 * Braziers only. Every other fire on this island burns a second a second, and
 * quietly re-pricing the smelters and the kilns is not what anybody asked for.
 */
export const BRAZIER_BURN_AT_ONE = 1.55;
export const BRAZIER_BURN_AT_HUNDRED = 0.6;
export const brazierBurn = (ql: number): number =>
  BRAZIER_BURN_AT_ONE
  + (BRAZIER_BURN_AT_HUNDRED - BRAZIER_BURN_AT_ONE) * (Math.max(1, Math.min(100, ql)) - 1) / 99;

/** What a brazier holds: a night's worth and a little over. */
export const BRAZIER_CAPACITY = world(3600);

/**
 * What a hearth holds: an oven's or a brazier's. Here beside its state line
 * (`furnitureState`) rather than with the four actions that fuel, light, put
 * out and rake one (`placeables.ts`), which import it from here.
 */
export const hearthCapacity = (f: PlacedFurniture): number =>
  (f.kind === 'brazier' ? BRAZIER_CAPACITY : OVEN_CAPACITY);

/**
 * Seconds of fuel a hearth spends per second alight.
 *
 * One, for everything that was here before this: an oven, a smelter and a
 * kiln all burn a second a second, and quietly re-pricing them is not what
 * anybody asked for.
 */
export const hearthBurn = (f: PlacedFurniture): number =>
  (f.kind === 'brazier' ? brazierBurn(f.ql ?? 20) : 1);

/**
 * Seconds a hearth burns on what is in it: its fuel over how fast it goes,
 * which for everything but a brazier are the same number.
 */
export const hearthLeft = (f: PlacedFurniture): number => (f.fuel ?? 0) / hearthBurn(f);

/** A piece's status line, and the enchantment set into it where it stands (`enchantTail`). */
export const furnitureState = (f: PlacedFurniture): string => stateOf(f) + STATE_TAILS.map((tail) => tail(f)).join('') + enchantTail(f);
function stateOf(f: PlacedFurniture): string {
  const def = furnitureDef(f.kind);
  const ql = `QL ${f.ql.toFixed(0)}`;
  if (holdsLiquid(f)) {
    const litres = litresIn(f);
    // Dye says its colour, its hex and its QL (`dyeSays` in full, on Examine).
    const dye = f.liquid === 'dye' ? readDye(f.dye) : null;
    const what = dye ? `${colourWord(dyeHex(dye.liquid))} dye, ${dyeHex(dye.liquid)} at QL ${dye.liquid.ql.toFixed(2)}` : f.liquid ? LIQUID_NAME[f.liquid] : 'empty';
    // A barrel that is working says so, and how long it has to go.
    const left = f.ferment ?? 0;
    const working = left > 0 ? ` · working, ${left >= 60 ? `${Math.ceil(left / 60)}m` : `${Math.ceil(left)}s`} to go` : '';
    return `${ql} · ${litres.toFixed(0)} / ${liquidCapacity(f)} litres of ${what}${working}`;
  }
  // Lit or not and the fuel left, as a fire, a smelter and a kiln say it.
  if (def.hearth) return `${ql} · ${heatSaid(f.lit, f.fuel, hearthLeft(f))}`;
  // A rune lantern's reach is a lantern's of its quality (`runelantern.ts`).
  if (def.runes) return `${ql} · lights ${lanternReach(f.ql)} tiles at night, burns nothing`;
  // A memorial stone, what is cut into it (`memorial.ts`).
  if (f.engraving) return `${ql} · \u201c${f.engraving}\u201d`;
  if (def.climber) return `${ql} · ${roseSays(f.setAt, Date.now() / 1000, def.climber)}`;
  if (def.hive) return `${ql} · ${furnitureUnits(f)} / ${furnitureCapacity(f)} of comb`;
  if (def.pond) return `${ql} · ${furnitureUnits(f)} / ${furnitureCapacity(f)} fish`;
  // A bin measured in kilograms says so; everything else counts things.
  const heft = furnitureHeft(f);
  if (heft) return `${ql} · ${furnitureKg(f).toFixed(0)} / ${heft} kg`;
  const cap = furnitureCapacity(f);
  const held = cap ? `${ql} · ${furnitureUnits(f)} / ${cap} things` : ql;
  // A hull with places for passengers says how many are taken.
  const places = passengerPlaces(f);
  if (places) return `${held} · ${ridersOf(f).length} of ${places} passenger places taken`;
  const v = def.vehicle;
  if (!v) return held;
  return `${held} · ${teamOf(f).length} of ${v.yokes} yoked${f.driven ? ' · you have the reins' : ''}`;
}

type FurnitureTarget = Extract<Target, { kind: 'furniture' }>;
const pieceOf = (g: Game, t: Target): PlacedFurniture | undefined => (t.kind === 'furniture' ? g.furniture.get((t as FurnitureTarget).id) : undefined);
const nearPiece = (g: Game, f: PlacedFurniture): boolean => {
  const [cx, cy] = furnitureCentre(f);
  return Math.hypot(cx - g.player.x, cy - g.player.y) <= STORE_REACH;
};

/**
 * The piece a thing is being put away into: the one the ask names, and
 * otherwise the nearest that will have it — which is all it used to be. Two
 * chests side by side took what you gave either of them into whichever stood
 * closer, the same way a rack of crates did.
 */
/**
 * Why a piece of furniture shuts against you when you reach into it, or
 * null: a settlement store by its own rule (`storeUse`), in place of its
 * padlock; anything else by its padlock. The island's `store_shut_piece`.
 */
export function pieceShut(g: Game, f: PlacedFurniture): string | null {
  const use = storeUse(g, f, furnitureName(f).toLowerCase());
  if (use) return use === 'open' ? null : use;
  return g.lockRefusal(f);
}

const storeInto = (g: Game, t: Target, item: Item): PlacedFurniture | undefined => {
  if (t.kind === 'item' && t.into !== undefined) {
    const named = g.furniture.get(t.into);
    if (named && furnitureHolds(named)) return named;
  }
  return g.nearestStore(item);
};

export const FURNITURE_ACTIONS: ActionDef[] = [
  {
    id: 'place_furniture',
    label: 'Set it down',
    verb: 'setting the furniture down',
    hidden: true,
    stamina: 0.03,
    baseTime: 3,
    applies: (t) => t.kind === 'tile',
    check: (t, g) => {
      if (t.kind !== 'tile' || t.itemUid === undefined || t.sx === undefined || t.sy === undefined) return 'Choose a piece and a spot.';
      const item = g.inventory.get(t.itemUid);
      if (!item || !isFurniture(item.id)) return 'That is not furniture.';
      // On the storey it was picked on, when one is pinned (`storeyview.ts`); else the one you stand on.
      return g.furniturePlaceReason(item.id, t.x, t.y, t.sx, t.sy, t.facing ?? 's', undefined, t.level);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile' || t.itemUid === undefined || t.sx === undefined || t.sy === undefined) return;
      const item = g.inventory.get(t.itemUid);
      if (!item || !isFurniture(item.id) || !g.inventory.remove(item.uid, 1)) return;
      const f = g.addFurniture(item.id, t.x, t.y, t.sx, t.sy, item.ql, [], item.extra, t.facing ?? 's', g.player.level);
      if (item.dye) f.dye = item.dye;
      // Roses or lavender planted at its feet grow from now, on the wall clock (`roses.ts`).
      if (furnitureDef(item.id).climber) f.setAt = Date.now() / 1000;
      // A skep starts filling from now, on the wall clock (`bees.ts`).
      if (furnitureDef(item.id).skep) f.skepAt = g.wallNow();
      // Everything the thing was keeps standing when the thing is standing.
      if (item.rare) f.rare = item.rare;
      // Its enchantment and its wear go down with it, and come up again with it (`enchanting.ts`).
      if (item.enchant) f.enchant = item.enchant;
      if (item.dmg) f.dmg = item.dmg;
      if (item.maker) f.maker = item.maker;
      if (item.mark) f.mark = item.mark;
      // And a memorial stone's line, which it reads standing as it did in the pack (`memorial.ts`).
      if (item.engraving) f.engraving = item.engraving;
      // And whoever is shut in it, who stands where it stands and is seen in it.
      const inside = item.creature !== undefined ? g.creatures.get(item.creature) : undefined;
      if (inside?.mode === 'stored') {
        f.creature = inside.id;
        [inside.x, inside.y] = furnitureCentre(f);
        g.events.emit('creature');
      }
      g.logMsg(inside?.mode === 'stored'
        ? `Set down: ${furnitureName(f).toLowerCase()}, with ${inside.name}.`
        : `Set down: ${furnitureName(f).toLowerCase()}.`, 'event');
      g.events.emit('world', f.x, f.y);
    },
  },
  {
    // A quarter turn to the right, in place. A piece standing across the tile
    // takes its width and depth swapped, and is walked to the nearest spot it
    // fits; what it would swing into stops it.
    id: 'turn_furniture',
    label: 'Turn it',
    verb: 'turning it round',
    stamina: 0.03,
    baseTime: 10,
    applies: (t) => t.kind === 'furniture',
    check: (t, g) => {
      const f = pieceOf(g, t);
      if (!f) return 'It is gone.';
      // A settlement store is turned by whoever set it down and its founder (`storeMoveRefusal`).
      const kept = storeMoveRefusal(g, f, furnitureName(f).toLowerCase());
      if (kept) return kept;
      if (f.lit) return 'Put it out first.';
      if (f.hitched) return 'Let go of it first.';
      if (teamOf(f).length) return 'Unhitch the team first.';
      if (f.driven) return 'Get down off it first.';
      if (ridersOf(f).length) return 'Passengers aboard.';
      if (rackSpots(f) && g.cratesOn(f).length) return 'Take the crates off it first.';
      // A trellis goes round to the next side of its tile with a wall it stands against, and stays put with none (`vineyard.ts`).
      const stuck = g.trellisTurnRefusal(f);
      if (stuck) return stuck;
      // A quarter turn, or on round past a facing a lantern post's arm would go into a wall (`lamps.ts`).
      const facing = g.pieceTurnsTo(f);
      const [ax, ay] = furnitureAnchor(f.kind, f.sx, f.sy, facing);
      const why = g.furniturePlaceReason(f.kind, f.x, f.y, ax, ay, facing, f.id, f.level ?? 0);
      return why ? 'Blocked.' : null;
    },
    perform: (t, g) => {
      const f = pieceOf(g, t);
      if (!f) return;
      const facing = g.pieceTurnsTo(f);
      const [ax, ay] = furnitureAnchor(f.kind, f.sx, f.sy, facing);
      if (g.furniturePlaceReason(f.kind, f.x, f.y, ax, ay, facing, f.id, f.level ?? 0)) return;
      f.facing = facing;
      f.sx = ax;
      f.sy = ay;
      g.logMsg(`Turned: ${furnitureName(f).toLowerCase()}, facing ${SIDE_NAMES[facing]}.`, 'event');
      g.events.emit('world', f.x, f.y);
    },
  },
  {
    id: 'pick_up_furniture',
    label: 'Pick it up',
    verb: 'lifting the furniture',
    stamina: 0.04,
    baseTime: 3,
    applies: (t) => t.kind === 'furniture',
    check: (t, g) => {
      const f = pieceOf(g, t);
      if (!f) return 'It is gone.';
      // A settlement store is picked up by whoever set it down and its founder (`storeMoveRefusal`).
      const kept = storeMoveRefusal(g, f, furnitureName(f).toLowerCase());
      if (kept) return kept;
      // Locked, it stays where it is: lifting a ship or a cart and setting it
      // down somewhere else is taking it, padlock and all.
      const shut = g.lockRefusal(f);
      if (shut) return shut;
      // A lantern post with its lantern still in it: that comes down first,
      // lit or not -- the island asks this next, after the lock (`lamp_lift_refusal`).
      if (f.lamp) return LAMP_TAKE_FIRST;
      if (f.items.length) return 'Empty it first.';
      // A crop is not carried about in a box of earth: it is harvested, or turned back into the soil.
      if (g.planted.has(f.id)) return PLANTER_GROWING;
      // A rack holds nothing of its own, so `items` is empty however loaded it
      // is: what stands on it are eight crates of somebody else's, and lifting
      // the rack out from under them would leave them standing in the air.
      if (rackSpots(f)) {
        const on = g.cratesOn(f).length;
        if (on) return `Take the ${on === 1 ? 'crate' : `${on} crates`} off it first.`;
      }
      if (f.lit) return 'Put it out first.';
      if (litresIn(f) > 0) return 'Empty it out first.';
      if (f.hitched) return 'Let go of it first.';
      if (teamOf(f).length) return 'Unhitch the team first.';
      if (f.driven) return 'Get down off it first.';
      if (ridersOf(f).length) return 'Passengers aboard.';
      return null;
    },
    perform: (t, g) => {
      const f = pieceOf(g, t);
      if (!f || f.items.length || f.lit || f.lamp || litresIn(f) > 0 || f.hitched || f.driven || teamOf(f).length || ridersOf(f).length) return;
      if (rackSpots(f) && g.cratesOn(f).length) return;
      if (g.planted.has(f.id)) return;
      g.removeFurniture(f.id);
      const back = g.inventory.add(f.kind, { ql: f.ql, extra: f.material });
      if (f.dye) back.dye = f.dye;
      if (f.rare) back.rare = f.rare;
      if (f.enchant) back.enchant = f.enchant;
      if (f.dmg) back.dmg = f.dmg;
      if (f.maker) back.maker = f.maker;
      if (f.mark) back.mark = f.mark;
      if (f.engraving) back.engraving = f.engraving;
      // Whoever is shut in it comes too, and is where you are from now on.
      const inside = f.creature !== undefined ? g.creatures.get(f.creature) : undefined;
      if (inside?.mode === 'stored') {
        back.creature = inside.id;
        inside.x = g.player.x;
        inside.y = g.player.y;
        g.events.emit('creature');
      }
      g.logMsg(inside?.mode === 'stored'
        ? `Picked up: ${furnitureName(f).toLowerCase()}, with ${inside.name}.`
        : `Picked up: ${furnitureName(f).toLowerCase()}.`, 'event');
      g.events.emit('world', f.x, f.y);
    },
  },
  {
    id: 'furniture_take_all',
    label: 'Take everything',
    verb: 'emptying it',
    stamina: 0.01,
    baseTime: 1,
    applies: (t, g) => !!pieceOf(g, t)?.items.length,
    check: (t, g) => {
      const f = pieceOf(g, t);
      if (!f) return 'It is gone.';
      if (!nearPiece(g, f)) return 'Stand next to it.';
      // A settlement store by its rule, anything else by its padlock.
      const shut = pieceShut(g, f);
      if (shut) return shut;
      return f.items.length ? null : 'It is empty.';
    },
    perform: (t, g) => {
      const f = pieceOf(g, t);
      if (!f || !f.items.length) return;
      const items = f.items.splice(0, f.items.length);
      for (const it of items) g.inventory.addItem(it);
      // Honey out of a hive, for the journal (the island's `perform_holding` the same).
      if (f.kind === 'hive' && items.some((it) => it.id === 'honey')) g.note('honey');
      // Your own grave emptied, for the journal (the island's `perform_holding` the same).
      if (f.kind === 'grave' && (f.mine ?? f.grave?.who === g.actor.who)) g.note('grave');
      g.events.emit('crate');
      const names = items.map((it) => (it.count > 1 ? `${it.count} × ${itemName(it).toLowerCase()}` : itemName(it).toLowerCase()));
      g.logMsg(`Taken from ${furnitureName(f).toLowerCase()}: ${names.join(', ')}.`, 'event');
    },
  },
  {
    id: 'store_in_furniture',
    label: 'Put away',
    verb: 'putting it away',
    instant: true,
    quantity: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      // A piece of furniture goes into no store, but for a wildermon crate, which goes on a stall to be sold.
      return !!item && (!isFurniture(item.id) || item.id === 'creature_crate') && storeInto(g, t, item) !== undefined;
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const item = g.inventory.get(t.uid);
      const f = item && storeInto(g, t, item);
      if (!item) return 'It is gone.';
      if (!f || !nearPiece(g, f)) {
        // Say why the thing beside you will not take it, rather than that nothing will.
        const beside = [...g.furniture.values()].filter((o) => nearPiece(g, o));
        beside.sort((a, b) => furnitureSize(b, item) - furnitureSize(a, item));
        for (const other of beside) {
          const why = pieceShut(g, other) ?? furnitureRefuses(other, item);
          if (why) return why;
        }
        return 'No store in reach takes it.';
      }
      // A settlement store by its rule, anything else by its padlock.
      const shut = pieceShut(g, f);
      if (shut) return shut;
      const refused = furnitureRefuses(f, item);
      if (refused) return refused;
      // Room for some of it is enough; what will not fit stays in the pack.
      if (furnitureRoom(f, item) <= 0) return `${furnitureName(f)} full.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const held = g.inventory.get(t.uid);
      const f = held && storeInto(g, t, held);
      if (!f) return;
      const want = t.count ?? 1;
      const fits = Math.min(want, furnitureRoom(f, held));
      if (fits <= 0) {
        g.logMsg(`${furnitureName(f)} full.`, 'error');
        return;
      }
      const item = g.inventory.take(t.uid, fits);
      if (!item) return;
      if (!g.furnitureAdd(f, item)) {
        g.inventory.addItem(item);
        g.logMsg(`${furnitureName(f)} full.`, 'error');
        return;
      }
      g.logMsg(storedLine(item.count, itemName(item), furnitureName(f), want - item.count), 'event');
    },
  },
];

export const FURNITURE_ACTION_BY_ID = new Map(FURNITURE_ACTIONS.map((a) => [a.id, a]));
export { itemDef };

/** Tiles out from your own a vehicle is looked for room to be deployed in (`deploySpot`). */
export const DEPLOY_REACH = 2;
/** Deploy with no room for it near enough. */
export const DEPLOY_SAID = `No room within ${DEPLOY_REACH} tiles.`;

/**
 * Where a carried vehicle goes down on Deploy: the nearest spot beside you, off your own tile, it
 * may be set down on (`place_furniture`'s own check), turned the way you face
 * first, then each other way; or null with no room within `DEPLOY_REACH`.
 */
export function deploySpot(g: Game, item: Item): Extract<Target, { kind: 'tile' }> | null {
  const place = FURNITURE_ACTION_BY_ID.get('place_furniture');
  if (!place) return null;
  const p = g.player;
  const ahead: Side = Math.abs(p.dirX) >= Math.abs(p.dirY) ? (p.dirX >= 0 ? 'e' : 'w') : (p.dirY >= 0 ? 's' : 'n');
  const facings = [0, 1, 3, 2].map((k) => turnedFacing(ahead, k));
  const px = p.tileX, py = p.tileY;
  // Not on the tile you stand on, which would set it down on top of you.
  for (let r = 1; r <= DEPLOY_REACH; r++) {
    const ring: Array<[number, number]> = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([px + dx, py + dy]);
    // Nearest the body first, and those ahead of it before those behind.
    ring.sort((a, b) => Math.hypot(a[0] + 0.5 - p.x, a[1] + 0.5 - p.y) - Math.hypot(b[0] + 0.5 - p.x, b[1] + 0.5 - p.y));
    for (const [x, y] of ring) {
      for (const facing of facings) {
        const [w, h] = furnitureFootprint(item.id, facing);
        for (let sy = 0; sy <= SUBTILES - h; sy++) {
          for (let sx = 0; sx <= SUBTILES - w; sx++) {
            const t: Extract<Target, { kind: 'tile' }> = { kind: 'tile', x, y, cx: x, cy: y, sx, sy, itemUid: item.uid, facing };
            if (!(place.check?.(t, g) ?? null)) return t;
          }
        }
      }
    }
  }
  return null;
}
