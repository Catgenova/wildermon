/**
 * Perks: what a craft trade gives, six tiers of three.
 *
 * Asked for: "We are replacing the current bonuses. Each 10 levels in the
 * primary skill of the class grants 1 skill point, for a total of 6 (class
 * starts with 1 point)", and then "Every class will have 6 tiers: level 50,
 * 60, 70, 80, 90, 100. Each tier allows one choice between 3 choices." The
 * sixth has opened at 99 since: "Change tier 6 class perks from requiring
 * level 100 to requiring 99."
 *
 * So a trade in `PERK_CLASSES` has no tree. It has eighteen perks, three to a
 * tier, and at each tier its holder takes one of the three. The first tier
 * opens with the trade; the other five open at sixty to ninety-nine in the
 * trade's main skill (`PERK_TIER_AT`). A perk taken is taken: the way to
 * choose again is to put the trade down, which clears it, and costs what
 * putting a trade down always has -- `CLASS_CHANGE_COST` in silver, or a
 * Bauble of Regret.
 *
 * ## Which perk is in which tier
 *
 * `TIERS`, trade by trade: the three offered at each of the six tiers, by the
 * number each perk was picked under, as the tiers were swept one trade at a
 * time. Moving a perk between tiers is moving its number in that list; the
 * island clears whoever held a perk that moved, so that nobody keeps two
 * from one tier.
 *
 * ## What a perk does, as data
 *
 * Every perk is a handful of numbers in `fx`, keyed by what they change and
 * where: `time:flatten` is the time a go of Flatten takes, `ql:dig` the
 * quality of what Dig brings up. The island folds the perks somebody has
 * taken into one map on their row (`class_fold`) and every rule that a perk
 * changes reads its key off that map, with the old number as the default --
 * so a rule nobody has a perk for is exactly the rule it was.
 *
 * How two perks with the same key add up is the key's family, `FX_RULE`:
 * times and qualities multiply, a carry adds, and everything else -- a depth,
 * a reach, a chance -- is the larger of the two. The island does the same in
 * `class_fold`, and the suite holds the two folds to each other.
 *
 * ## What a perk says
 *
 * `note` is the exact benefit, in the game's own terms, and every number in it
 * is read off `fx` or off the rule it changes. It is built by a function of the
 * perk's own `fx` so that the two cannot say different things, and the
 * benefit check reads these functions as it reads any other note.
 */
import { CLASSES, PERK_CLASSES, PERK_TIER_AT, PERKS_PER_TIER, tiersAtFor } from './classes';
import { BLOCK_MOST, COMPANION_BLOW, COMPANION_LEASH, COMPANION_SIGHT, CRIT_HIT, DRAW_CLOSEST, DRAW_WALK, FIGHT_BACK_STILL, HUNT_REACH, KNIFE_BLEED_SECS, reachOf, STANCE_DEALT, STANCE_TAKEN, THROW_REACH } from './fight';
import { classSpellsOf, GUARDIAN_REACH, spellTerms } from './talents';
import {
  ACTION_BY_ID, CHIP_CHANCE, CLEARED_TO, DIG_TILE_TIME, DREDGE_DEPTH, FLATTEN_STEP, GRASS_PER_CUT, MINE_COLLAPSE, MINE_DEPTH, PAN_ORES,
  PLANTED_AGE, plantedAge, PROSPECT_REACH, PROSPECT_STEP, REED_CUT, REED_EXTRA_AT, RESIN_TREE, SLOPE_FLOOR, SLOPE_PER_SKILL, SPOIL_REACH,
  TILE_CORNERS, KIT_MEND, repairGo, GLAZE_ASH, GLAZEABLE,
} from './actions';
import {
  FIND_BASE, FIND_CAP, FIND_PER_SKILL, FIND_PER_TOOL, RESTORE_AGE, RESTORE_HARM, RESTORE_HARM_SPREAD, STUDY_WEAR, STUDY_WEAR_SPREAD,
} from './archaeology';
import { BAUBLE_HIGH, BAUBLE_LOW, BAUBLE_SHARE, BAUBLE_TIERS } from './baubles';
import { BRIDGES } from './bridges';
import { BUILD_ACTION_BY_ID, REPOINT_BACK } from './buildActions';
import { FENCE_TYPES, MATERIAL_BY_ID, MATERIALS, MAX_LEVELS, storeySkill, TALL_STOREYS, wallBill } from './building';
import { BUCKET_LITRES, FURNITURE, furnitureDef } from './furniture';
import { GORRAL_MILK } from './dairy';
import { ARMOUR, ARMOUR_BY_ID, ARMOUR_CLASSES, HIT_CAP, SOAK_CAP, WEAPON_BY_ID, WEAPONS } from './gear';
import { CIRCLET_SHARE, CIRCLET_STONES, GEM_ODDS, GEMS, JEWEL_BONUS, tradeName } from './gems';
import {
  CARRY_BASE, CARRY_PER_STRENGTH, goSeconds, MAX_MOUNT_SPEED, MAX_VEHICLE_SPEED, QL_TOP, TOOL_QL_SPAN,
} from './game';
import { CROP_LIST, cropYield, RIPE, type CropDef } from './farming';
import { IMPROVE_FLOOR, improveStepAt } from './improve';
import { POST_LIFE_MAX, POST_LIFE_MIN } from './posts';
import { billWords, countOf, ITEM_DEFS, RARITY_ODDS, type Item } from './items';
import { MELT_KEEP, MELT_SHARE, meltLumps } from './melt';
import {
  castWhole, COIN_DIFFICULTY, FORGE_WORK, INGOT_LUMPS, INGOT_WEIGHT, METALS, MOULD_BY_ID, MOULD_BY_MAKES, MOULD_DENT, mouldLumps, MOULDS,
  mouldUsesLeft,
} from './metal';
import { MAP_ODDS } from './treasure';
import { CRAFT_REACH, DISTIL_BUCKETS, isDish, RECIPES, TAILOR_SKILLS, TRADE_BOOK_AT, TRADE_BOOK_SKILLS, type Recipe } from './recipes';
import { BUSH_DEFS, ROAD_TILES, ROCK_VARIANTS, TILE_DEFS, TileType, TREE_AGES, TREE_DAWN_UTC, TREE_DEFS } from '../world/tiles';
import { walkKey } from './player';
import { metres } from './piers';

/** The daily reset as the hud's clock shows it: "13:00" (`TREE_DAWN_UTC`). */
const resetHour = (): string =>
  `${String(Math.floor(TREE_DAWN_UTC)).padStart(2, '0')}:${String(Math.round((TREE_DAWN_UTC % 1) * 60)).padStart(2, '0')}`;

import { article, capital, listed, listedOr, percent } from './words';
import { helpingOf, NUTRIENTS, TABLE_BEST } from './nutrition';
import { BREWS } from './brewing';
import { boonTime, durationSaid, TINCTURE_BONUS, TINCTURE_SECONDS } from './boons';
import { EMPTY_CHANCE, PER_ROLL } from './forage';
import { DRESS_CHECK } from './firstaid';
import { TINCTURE_NAMES } from './remedies';
import { FESTER_CLOTH, FESTER_WRONG } from './wounds';
import { BAIT_BY_ID, BAIT_PULL, BAITS, biteShare, CAST, FISH, HOOK_BAIT, HOOK_MOST, NET_HAUL, NET_LEAST, NET_REACH } from './fishing';
import { POND_EVERY } from './furniture';
import { DYE_BUCKET, DYE_LITRES_PER_KG, dyeGrams, kgSaid as dyeKg } from './dyestuffs';
import { TRAPS } from './traps';
import { BUTCHER_BAIT } from './butcher';
import { SHEAR_FROM, SHEAR_WOOL, TAME_MOST } from './creatureActions';
import { AGES, BREED_REST, CARE_BONUS, CARE_HOURS, COAX_STEP, GESTATION, HUNGER_RATE, OLD_AT, SPECIES } from './creatures';
import { GROOM_HEAL, groomGain } from './husbandry';
import { inheritChance, TRAIT_SLOTS, upgradeChance } from './traits';

/** What the perks somebody holds come to, key by key. */
export type Fx = Record<string, number>;

/**
 * How two perks' numbers for the same key add up, by the key's family: the
 * part before the colon. Anything not named here is the larger of the two.
 */
export const FX_RULE: Record<string, 'mul' | 'add'> = {
  time: 'mul', ql: 'mul', weight: 'mul', walk: 'mul', fail: 'mul', wear: 'mul', need: 'mul', bill: 'mul',
  grow: 'mul', rotate: 'mul', feed: 'mul', fill: 'mul', knack: 'mul', rot: 'mul', cool: 'mul', catch: 'mul', empty: 'mul', mend: 'mul',
  bite: 'mul', cost: 'mul', worn: 'mul', life: 'mul', harm: 'mul', age: 'mul', wind: 'mul', severity: 'mul', dmg: 'mul', swing: 'mul',
  bright: 'mul', thrift: 'mul', force: 'mul', keeps: 'mul', teach: 'mul', sturdy: 'mul',
  carry: 'add', serve: 'add', jobs: 'add', plus: 'add', bumper: 'add', fodder: 'add', tool: 'add', passes: 'add', hook: 'add', haul: 'add',
  block: 'add', leech: 'add', length: 'add', save: 'add', crit: 'add', stamina: 'add',
  gap: 'mul', monster: 'mul', still: 'mul', closest: 'mul', ambush: 'mul', far: 'mul', bleed: 'mul', fester: 'mul',
  burn: 'mul', ward: 'mul', cast: 'mul', bind: 'mul', chill: 'mul', skin: 'mul',
};

export const fxFamily = (key: string): string => key.split(':')[0];

/** Fold perks' numbers together, in the order given, by `FX_RULE`. */
export function foldFx(list: readonly Fx[]): Fx {
  const out: Fx = {};
  for (const fx of list) {
    for (const [k, v] of Object.entries(fx)) {
      const rule = FX_RULE[fxFamily(k)];
      if (!(k in out)) out[k] = v;
      else if (rule === 'mul') out[k] *= v;
      else if (rule === 'add') out[k] += v;
      else out[k] = Math.max(out[k], v);
    }
  }
  return out;
}

export interface PerkDef {
  /** `<class>_<name>`, which is what the island keeps. */
  id: string;
  class: string;
  /** The number it was offered under, which is the number it was picked by. */
  num: number;
  name: string;
  /** One to six. */
  tier: number;
  fx: Fx;
  note: string;
}

/** A perk as it is written: its note is made from its own numbers. */
interface Seed {
  num: number;
  name: string;
  /** What its id is made of, where that is not its name: a perk renamed keeps its id, and whoever took it keeps it. */
  key?: string;
  fx: Fx;
  note: (fx: Fx) => string;
}

/** "1 in 200", from a chance of 0.005. */
const oneIn = (p: number): string => `1 in ${Math.round(1 / p)}`;
/** A Naturalist's Field Medic and a Chirurgeon's Field Surgeon: more out of a dressing put on somebody else. */
const dressOthersNote = (fx: Fx): string => `Dressing on another player: health restored ${more(fx['heal:others'])}, `
  + `wound closing ${more(fx['heal:others'])} (base: same as on yourself).`;
/** "+10%" on, from a multiplier of 1.1. */
function more(m: number): string { return `+${percent(m - 1)}`; }
/** "−35%" off, from a multiplier of 0.65. */
const cut = (m: number): string => `−${percent(1 - m)}`;
/** "×0.5", a multiplier as it stands. */
const mul = (m: number): string => `×${Number(m.toFixed(3))}`;
const secs = (s: number): string => `${Number(s.toFixed(1))} s`;
const base = (id: string): number => ACTION_BY_ID.get(id)?.baseTime ?? 0;
const diff = (id: string): number => ACTION_BY_ID.get(id)?.difficulty ?? 0;
const kg = (id: string): number => ITEM_DEFS[id]?.weight ?? 0;
/** "15 percentage points", from 0.15 added to a chance. */
const points = (x: number): string => `${Math.round(x * 100)} percentage points`;
/** "a, b or c". */
const either = (xs: readonly string[]): string =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}` : (xs[0] ?? '');
const itemName = (id: string): string => (ITEM_DEFS[id]?.name ?? id).toLowerCase();

/*
 * ---------------------------------------------------------------------------
 * The Terraformer: digging and paving.
 * ---------------------------------------------------------------------------
 */
const TERRAFORMER: Seed[] = [
  {
    num: 5, name: 'Clean Earth',
    fx: { 'ql:dig': 1.1, 'ql:dredge': 1.1, 'ql:collect': 1.1, 'ql:flatten': 1.1 },
    note: (fx) => `QL ${more(fx['ql:dig'])}: dirt, sand, clay, peat and tar from Dig, Dredge, Collect and Flatten.`,
  },
  {
    num: 6, name: 'Rare Earth',
    fx: { 'rare:dig': 0.01, 'rare:dredge': 0.01, 'rare:collect': 0.01 },
    note: (fx) => `Rare chance on Dig, Dredge and Collect: ${oneIn(fx['rare:dig'])} (base: none). `
      + 'Rare may become supreme or fantastic at crafting odds.',
  },
  {
    num: 9, name: 'Level Hand',
    fx: { 'flatten:step': 2 },
    note: (fx) => `Flatten height per action: ${metres(fx['flatten:step'])} m (base ${metres(FLATTEN_STEP)} m).`,
  },
  {
    num: 10, name: 'Quick Level',
    fx: { 'time:flatten': 0.65 },
    note: (fx) => `Flatten time ${cut(fx['time:flatten'])} (base ${secs(base('flatten'))}).`,
  },
  {
    num: 12, name: 'Steep Cut',
    fx: { 'slope:digging': 4 },
    note: (fx) => `Max slope left by Dig, Drop dirt and Dredge: ${metres(fx['slope:digging'])} m per digging level `
      + `(base ${metres(SLOPE_PER_SKILL)} m, min ${metres(SLOPE_FLOOR)} m).`,
  },
  {
    num: 14, name: 'Wader',
    fx: { 'depth:dig': 20 },
    note: (fx) => `Dig and Flatten max water depth: ${metres(fx['depth:dig'])} m (base ${metres(MINE_DEPTH)} m).`,
  },
  {
    num: 15, name: 'Dredger',
    fx: { 'depth:dredge': 60, 'time:dredge': 0.8 },
    note: (fx) => `Dredge max depth: ${metres(fx['depth:dredge'])} m (base ${metres(DREDGE_DEPTH)} m). Dredge time ${cut(fx['time:dredge'])}.`,
  },
  {
    num: 17, name: 'Bed Worker',
    fx: { 'time:collect': 0.7 },
    note: (fx) => `Collect time ${cut(fx['time:collect'])} (base ${secs(base('collect'))}).`,
  },
  {
    num: 20, name: 'Treasure Nose',
    fx: { 'map:dig': 1 / 200, 'map:dig_tile': 1 / 200 },
    note: (fx) => `Treasure map chance per dig: ${oneIn(fx['map:dig'])} (base ${oneIn(MAP_ODDS)}).`,
  },
  {
    num: 23, name: 'Stump Puller',
    fx: { 'time:dig_stump': 0.5, 'stump:log': 1 },
    note: (fx) => `Dig out the stump time ${cut(fx['time:dig_stump'])}. `
      + `Output: ${fx['stump:log']} log of the tree's kind (base: none).`,
  },
  {
    num: 25, name: 'Quick Paver',
    fx: { 'time:pack': 0.65, 'time:pave_cobble': 0.65, 'time:pave_slabs': 0.65 },
    note: (fx) => `Pack, Pave (cobblestone) and Pave (slabs) time ${cut(fx['time:pack'])}.`,
  },
  {
    num: 26, name: 'Bed True',
    fx: { 'fail:pave_slabs': 0 },
    note: () => `Pave (slabs) never fails (base: check at difficulty ${diff('pave_slabs')} against the slab's QL).`,
  },
  {
    num: 27, name: 'Frugal Cobbler',
    fx: { 'keep:pave_cobble': 1 / 3 },
    note: (fx) => `Pave (cobblestone) uses no stone brick: ${oneIn(fx['keep:pave_cobble'])} actions.`,
  },
  {
    num: 29, name: 'Road Legs',
    fx: { 'walk:road': 1.15 },
    note: (fx) => `Walk speed ${more(fx['walk:road'])} on `
      + `${listed(ROAD_TILES.map((t) => TILE_DEFS[t].name.toLowerCase()))}.`,
  },
  {
    num: 32, name: 'Soil Porter',
    fx: { 'weight:dirt': 0.5, 'weight:sand': 0.5, 'weight:clay': 0.5 },
    note: (fx) => `Dirt, sand and clay weight: ${kg('dirt') * fx['weight:dirt']} kg per unit (base ${kg('dirt')} kg).`,
  },
  {
    num: 33, name: 'Strong Back',
    fx: { carry: 40 },
    note: (fx) => `Carry weight +${fx.carry} kg (base ${CARRY_BASE} kg, +${CARRY_PER_STRENGTH} kg per body strength level).`,
  },
  {
    num: 34, name: 'Long Reach',
    fx: { 'reach:soil': 5 },
    note: (fx) => `Drop dirt and Flatten take soil from carts and containers within ${fx['reach:soil']} tiles `
      + `(base ${SPOIL_REACH}). Dug material goes into the nearest unlocked cart or wagon within ${fx['reach:soil']} tiles `
      + 'not pulled or driven by another player (base: your pack).',
  },
  {
    num: 44, name: 'Dig Out the Tile',
    fx: { dig_tile: 1 },
    note: () => `New action: Dig out the tile. Lowers all ${TILE_CORNERS} corners by ${metres(1)} m in one action: ${secs(DIG_TILE_TIME)} base `
      + `(${TILE_CORNERS} digs: ${secs(TILE_CORNERS * base('dig'))}). Output: ${TILE_CORNERS} of the material.`,
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Miner: the face, the seam, and what else is in the ground.
 * ---------------------------------------------------------------------------
 */
/** The veins an ore comes out of, from the least mining they want to the most. */
const ORES = ROCK_VARIANTS.filter((r) => r.yields.endsWith('_ore'))
  .map((r) => ({ yields: r.yields, level: r.level ?? 0 })).sort((a, b) => a.level - b.level);
const oreName = (yields: string): string => itemName(yields).replace(/ ore$/, '');
/** Each ore with the mining it would want of somebody `below` short of it: "gold at 40". */
const oresAt = (below: number): string => {
  const any = ORES.filter((o) => o.level - below <= 0).map((o) => oreName(o.yields));
  const rest = ORES.filter((o) => o.level - below > 0).map((o) => `${oreName(o.yields)} at ${o.level - below}`);
  return listed([...(any.length ? [`${listed(any)} at any mining`] : []), ...rest]);
};

const MINER: Seed[] = [
  {
    num: 1, name: 'Quick Pick',
    fx: { 'time:mine': 0.75 },
    note: (fx) => `Mine time ${cut(fx['time:mine'])} (base ${secs(base('mine'))}).`,
  },
  {
    num: 2, name: 'Rich Seam',
    fx: { 'more:mine': 0.15 },
    note: (fx) => `Mine: one extra output on ${percent(fx['more:mine'])} of actions.`,
  },
  {
    num: 3, name: 'Sure Swing',
    fx: { 'fail:mine': 0.5 },
    note: (fx) => `Mine failure chance ${mul(fx['fail:mine'])} (base: check at difficulty ${diff('mine')} with the pickaxe's QL).`,
  },
  {
    num: 6, name: 'Rare Ore',
    fx: { 'rare:mine': 0.01 },
    note: (fx) => `Rare chance on Mine: ${oneIn(fx['rare:mine'])} (base: none). `
      + 'Rare may become supreme or fantastic at crafting odds.',
  },
  {
    num: 7, name: 'Ore Sense',
    fx: { 'ore:below': 10 },
    note: (fx) => `Mine, Chip corner and Mine out the cellar: mining needed per ore −${fx['ore:below']}. ${capital(oresAt(fx['ore:below']))} `
      + `(base: ${oresAt(0)}).`,
  },
  {
    num: 8, name: 'Coal Hand',
    fx: { 'count:coal': 2 },
    note: (fx) => `Coal per Mine on a coal seam: ${fx['count:coal']} (base one).`,
  },
  {
    num: 9, name: 'Chipper',
    fx: { 'chip:chance': 0.5 },
    note: (fx) => `Chip corner lowers the corner: ${oneIn(fx['chip:chance'])} actions (base ${oneIn(CHIP_CHANCE)}).`,
  },
  {
    num: 11, name: 'Face Shaper',
    fx: { 'chip:step': 2 },
    note: (fx) => `Chip corner drop per success: ${metres(fx['chip:step'])} m (base ${metres(1)} m). Never below a level you have taken.`,
  },
  {
    num: 13, name: 'Rock Slide',
    fx: { 'slide:more': 3 },
    note: (fx) => `Face collapse while mining (${oneIn(MINE_COLLAPSE)} actions): +${fx['slide:more']} of the mined material.`,
  },
  {
    num: 14, name: 'Wet Work',
    fx: { 'depth:mine': 20 },
    note: (fx) => `Mine and Chip corner max water depth: ${metres(fx['depth:mine'])} m (base ${metres(MINE_DEPTH)} m).`,
  },
  {
    num: 15, name: 'Gem Eye',
    fx: { 'gem:mine': 1 / 150 },
    note: (fx) => `Gem chance per Mine: ${oneIn(fx['gem:mine'])} (base ${oneIn(GEM_ODDS)}).`,
  },
  {
    num: 17, name: 'Treasure in the Rock',
    fx: { 'map:mine': 1 / 200 },
    note: (fx) => `Treasure map chance per Mine: ${oneIn(fx['map:mine'])} (base ${oneIn(MAP_ODDS)}).`,
  },
  {
    num: 19, name: 'Far Reader',
    fx: { 'further:prospect': 3 },
    note: (fx) => `Prospect range +${fx['further:prospect']} tiles `
      + `(base ${PROSPECT_REACH}, one more per ${PROSPECT_STEP} prospecting).`,
  },
  {
    num: 25, name: 'Keen Trowel',
    fx: { 'find:investigate': 0.15, 'cap:investigate': 0.85 },
    note: (fx) => `Investigate find chance +${points(fx['find:investigate'])}, max ${percent(fx['cap:investigate'])} `
      + `(base ${percent(FIND_BASE)} + ${percent(FIND_PER_SKILL)} of archaeology + ${percent(FIND_PER_TOOL)} `
      + `of trowel QL, max ${percent(FIND_CAP)}).`,
  },
  {
    num: 27, name: 'Pieces that Fit',
    fx: { 'fit:relic': 0.5 },
    note: (fx) => `Investigate: ${percent(fx['fit:relic'])} of relic pieces found are a missing piece of an unfinished relic you hold.`,
  },
  {
    num: 28, name: 'Bauble Hunter',
    fx: { 'share:bauble': 0.4 },
    note: (fx) => `Investigate finds that are tarnished baubles: ${percent(fx['share:bauble'])} (base ${percent(BAUBLE_SHARE)}).`,
  },
  {
    num: 35, name: 'Ore Cart',
    fx: { 'into:mine': 5 },
    note: (fx) => `Mine output goes into the nearest unlocked cart or wagon not pulled or driven by another player, `
      + `or container you built or on your settlement, within ${fx['into:mine']} tiles (base: your pack).`,
  },
  {
    num: 50, name: 'Pan',
    fx: { pan: 1 / 8 },
    note: (fx) => `New action: Pan, on sand with water at a corner. ${oneIn(fx.pan)} actions give `
      + `${either(PAN_ORES.map(itemName))} (equal odds), QL by prospecting.`,
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Mason: the chisel, the trowel, and the rock under both.
 * ---------------------------------------------------------------------------
 */
/** Everything cut with a chisel: the bricks, the slabs, the whetstone and the quern. */
const STONECUTTING = RECIPES.filter((r) => r.skill === 'stonecutting');
/** The bricks a shard or a block is chiselled into, a few at a go. */
const CHISELLED = STONECUTTING.filter((r) => r.result.endsWith('_brick'));
/** What comes off the chisel as bricks and slabs, which Brick Porter lightens. */
const CUT_STONE = [...new Set(STONECUTTING.map((r) => r.result).filter((id) => /_(brick|slab)$/.test(id)))];
/** The masonry a failed go pulls down with its materials in it. */
const LOST_ON_FAIL = RECIPES.filter((r) => r.skill === 'masonry' && r.consumeOnFail);
/** What a building is made of that is not stone: the timber a Mason's perks leave as they find it. */
const TIMBER = MATERIALS.filter((m) => m.kind !== 'stone').map((m) => m.name.toLowerCase());
const STONE_WORK = `stone, anything but ${either(TIMBER)}`;
/** "6–16", or "8" where they are all one. */
const range = (xs: readonly number[]): string => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
};
/** The same number on every one of a list of keys. */
const each = (keys: readonly string[], v: number): Fx => Object.fromEntries(keys.map((k) => [k, v]));
/** "bricks, whetstones, querns and slabs": what a run of recipes makes, by the last word of each. */
const kinds = (rs: readonly Recipe[]): string =>
  listed([...new Set(rs.map((r) => `${itemName(r.result).split(' ').pop()}s`))]);
/** "stone, slate, marble or sandstone": the stone of each brick, without the brick. */
const stonesOf = (ids: readonly string[]): string[] => ids.map((id) => itemName(id).replace(/ (brick|slab)$/, ''));
/** A bill in words: "24 stone bricks and 12 mortar". */
const billOf = (bill: ReadonlyArray<readonly [string, number]>): string =>
  listed(bill.map(([id, n]) => `${n} ${n === 1 ? itemName(id) : plural(itemName(id))}`));
const plural = (name: string): string =>
  (/(s|mortar|ash)$/.test(name) ? name : /(kni|shel)fe?$/.test(name) ? name.replace(/fe?$/, 'ves') : `${name}s`);
/** What each stone stands now, tallest first: "stone brick, marble, ornate silver and ornate gold 10, slate 8". */
const standsNow = (): string => {
  const by = new Map<number, string[]>();
  for (const m of MATERIALS.filter((x) => x.kind === 'stone')) by.set(m.storeys, [...(by.get(m.storeys) ?? []), m.name.toLowerCase()]);
  return [...by].sort((a, b) => b[0] - a[0]).map(([n, names]) => `${listed(names)} ${n}`).join(', ');
};
const STONE_BRICK_WALL = MATERIAL_BY_ID.get('stone_brick')!;
const CONCRETE = RECIPES.find((r) => r.result === 'concrete')!;

const MASON: Seed[] = [
  {
    num: 1, name: 'Quick Chisel',
    fx: each(STONECUTTING.map((r) => `time:${r.id}`), 0.75),
    note: (fx) => `Stonecutting time ${cut(fx[`time:${STONECUTTING[0].id}`])}: ${kinds(STONECUTTING)} `
      + `(base ${range(STONECUTTING.map((r) => r.baseTime))} s).`,
  },
  {
    num: 2, name: 'Three from a Shard',
    fx: each(CHISELLED.map((r) => `count:${r.result}`), 3),
    note: (fx) => `Bricks per action, ${either(stonesOf(CHISELLED.map((r) => r.result)))}: `
      + `${fx[`count:${CHISELLED[0].result}`]} (base ${CHISELLED[0].count ?? 1}).`,
  },
  {
    num: 4, name: 'Sure Chisel',
    fx: each(STONECUTTING.map((r) => `fail:${r.id}`), 0.5),
    note: (fx) => `Stonecutting failure chance ${mul(fx[`fail:${STONECUTTING[0].id}`])} `
      + `(base: check at difficulty ${range(STONECUTTING.map((r) => r.difficulty ?? 0))}).`,
  },
  {
    num: 8, name: 'Quick Mason',
    fx: { 'time:build_stone': 0.7 },
    note: (fx) => `Build wall and Build floor time ${cut(fx['time:build_stone'])} on ${STONE_WORK} `
      + `(base ${secs(base('build_wall'))}).`,
  },
  {
    num: 9, name: 'Two at a Time',
    fx: { 'lay:build_stone': 2 },
    note: (fx) => `Build wall and Build floor units per action on ${STONE_WORK}: ${fx['lay:build_stone']} if carried `
      + `(base one; stone-brick wall: ${billOf(STONE_BRICK_WALL.bill)}).`,
  },
  {
    num: 12, name: 'Tall Walls',
    fx: { 'storeys:build_stone': TALL_STOREYS },
    note: (fx) => `Max storeys of stone in buildings you planned: +${fx['storeys:build_stone']}, `
      + `max ${MAX_LEVELS + fx['storeys:build_stone']} (base ${standsNow()}; max ${MAX_LEVELS}). `
      + `Timber unchanged; a building is capped by its shortest material. `
      + `Each storey above ${MAX_LEVELS} needs masonry ${storeySkill(MAX_LEVELS)} on the storey below.`,
  },
  {
    num: 16, name: 'Salvage',
    fx: { 'salvage:build_stone': 0.5 },
    note: (fx) => `Remove wall returns ${percent(fx['salvage:build_stone'])} of the stone in a wall of ${STONE_WORK}, `
      + `rounded down: stone-brick wall ${Math.floor(STONE_BRICK_WALL.bill[0][1] * fx['salvage:build_stone'])} of `
      + `${STONE_BRICK_WALL.bill[0][1]} stone bricks (base: none).`,
  },
  {
    num: 17, name: 'Concrete Hand',
    fx: { 'fail:raise_rock': 0 },
    note: () => `Raise the rock with concrete never fails (base: check at difficulty ${diff('raise_rock')}; `
      + 'concrete lost on failure).',
  },
  {
    num: 18, name: 'Double Lift',
    fx: { 'lift:raise_rock': 2 },
    note: (fx) => `Raise the rock with concrete: ${metres(fx['lift:raise_rock'])} m per concrete `
      + `(base ${metres(1)} m), where your slope limit and level allow; otherwise ${metres(1)} m.`,
  },
  {
    num: 19, name: 'Steep Stone',
    fx: { 'slope:masonry': 4 },
    note: (fx) => `Max slope left by raising rock: ${metres(fx['slope:masonry'])} m per masonry level `
      + `(base ${metres(SLOPE_PER_SKILL)} m, min ${metres(SLOPE_FLOOR)} m).`,
  },
  {
    num: 20, name: 'Good Mix',
    fx: { 'count:concrete': 2 },
    note: (fx) => `Mix concrete output: ${fx['count:concrete']} concrete from the same `
      + `${listed(CONCRETE.inputs.map((i) => itemName(i.item)))} (base ${CONCRETE.count ?? 1}).`,
  },
  {
    num: 22, name: 'Wet Set',
    fx: { 'depth:raise_rock': 10 },
    note: (fx) => `Raising rock max water depth: ${metres(fx['depth:raise_rock'])} m (base: above water only).`,
  },
  {
    num: 24, name: 'Careful Builder', key: 'nothing_wasted',
    fx: each(LOST_ON_FAIL.map((r) => `spare:${r.id}`), 1),
    note: () => `Failed ${either(LOST_ON_FAIL.map((r) => itemName(r.result)))}: materials kept (base: lost).`,
  },
  {
    num: 29, name: 'Bridge Mason',
    fx: { 'time:bridge_stone': 0.7, 'span:bridge_stone': 10 },
    note: (fx) => `${BRIDGES.stone.name} work time ${cut(fx['time:bridge_stone'])} `
      + `(base ${secs(base('build_bridge'))}). Max span: ${fx['span:bridge_stone']} tiles (base ${BRIDGES.stone.span}).`,
  },
  {
    num: 33, name: 'Brick Porter',
    fx: each(CUT_STONE.map((id) => `weight:${id}`), 0.5),
    note: (fx) => `Weight ${mul(fx[`weight:${CUT_STONE[0]}`])}: bricks and slabs of ${either([...new Set(stonesOf(CUT_STONE))])}. `
      + `Brick ${kg('stone_brick') * fx['weight:stone_brick']} kg, slab `
      + `${kg('stone_slab') * fx['weight:stone_slab']} kg (base ${kg('stone_brick')} and ${kg('stone_slab')}).`,
  },
  {
    num: 35, name: 'Hod Carrier',
    fx: { 'reach:build_stone': 5 },
    note: (fx) => `Build wall and Build floor on ${STONE_WORK}: take from crates, carts and craft-reachable containers within `
      + `${fx['reach:build_stone']} tiles (base ${CRAFT_REACH}), with Use stores within reach on or off.`,
  },
  {
    num: 47, name: 'Repoint',
    fx: { repoint: 1 },
    note: () => `New action: Repoint, on a finished wall of ${STONE_WORK}. Relays it in another stone in one action: `
      + `${secs(BUILD_ACTION_BY_ID.get('repoint_wall')?.baseTime ?? 0)} base. Cost: the new stone's full bill. `
      + `Returns ${percent(REPOINT_BACK)} of the old stone, rounded down.`,
  },
  {
    num: 48, name: 'Rubble Fill',
    fx: { rubble: 5 },
    note: (fx) => `New action: Raise the rock with rubble. Raises a bare rock corner ${metres(1)} m for ${fx.rubble} rock shards `
      + `instead of a concrete; same rules and check (difficulty ${diff('raise_rock')}) as concrete.`,
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Carpenter: the saw, the bench, the hull and the bow.
 * ---------------------------------------------------------------------------
 */
const recipeOf = (id: string): Recipe => {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) throw new Error(`no recipe ${id}`);
  return r;
};
/** What a log is sawn or carved into, a go at a time. */
const SAWN = ['make_planks', 'make_timbers', 'make_shafts'].map(recipeOf);
const PLANKS = recipeOf('make_planks');
const TIMBERS = recipeOf('make_timbers');
const THATCH = recipeOf('make_thatch');
const BOWSTRING = recipeOf('make_bow_string');
/** A piece of furniture's recipe, by the piece. */
const pieceRecipe = (id: string): Recipe => recipeOf(`make_${id}`);
/** Every piece of furniture made of wood at the bench: its recipe is carpentry or fine carpentry. */
const JOINERY = FURNITURE.filter((f) => RECIPES.some((r) => r.result === f.id && (r.skill === 'carpentry' || r.skill === 'fine_carpentry')))
  .map((f) => pieceRecipe(f.id));
/** The storage Deep Drawers deepen: the chests, cupboards, barrels, bins, shelves, wardrobes and larders. */
const DRAWERS = ['chest', 'coffer', 'cupboard', 'wardrobe', 'shelves', 'bookshelf', 'larder',
  'small_barrel', 'barrel', 'large_barrel', 'bulk_bin', 'craft_bin', 'seed_bin', 'sprout_bin'].map(furnitureDef);
const BOATS = FURNITURE.filter((f) => f.boat);
/** What goes on wheels behind a team. A hand cart has no pace of its own: it goes at yours. */
const VEHICLES = FURNITURE.filter((f) => f.vehicle);
/** Boats, carts and wagons: what Sure Hull steadies the hands on. */
const HULLS = FURNITURE.filter((f) => f.boat || f.vehicle || f.cart).map((f) => pieceRecipe(f.id));
/** The bows a bowyer makes: every weapon that throws an arrow and is tillered at the bench. */
const BOWS = WEAPONS.filter((w) => w.ammo && RECIPES.some((r) => r.result === w.id && r.skill === 'bowyery'));
/** The tools Saw Care keeps. */
const SAW_TOOLS = ['saw', 'carving_knife', 'mallet', 'file'];
/** A fence, a gate or a half wall: the wall types that stand on a border of their own. */
const FENCES = FENCE_TYPES.map((t) => t.name.toLowerCase());
const PLANK_WALL = MATERIAL_BY_ID.get('plank')!;
const piece = (id: string): string => furnitureDef(id).name.toLowerCase();
const pieces = (ids: readonly string[]): string => listed(ids.map((id) => plural(piece(id))));
const bill = (b: Record<string, number>): string => listed(Object.entries(b).map(([id, n]) => `${n} ${n === 1 ? itemName(id) : plural(itemName(id))}`));
/** "6.6", to a tenth. */
const tenth = (x: number): string => `${Number(x.toFixed(1))}`;
/** The same multiplier on the same family for every one of a list of things. */
const onEach = (family: string, ids: readonly string[], v: number): Fx => each(ids.map((id) => `${family}:${id}`), v);

const CARPENTER: Seed[] = [
  {
    num: 1, name: 'Quick Saw',
    fx: onEach('time', SAWN.map((r) => r.id), 0.7),
    note: (fx) => `${listed(SAWN.map((r) => r.label))} time ${cut(fx[`time:${SAWN[0].id}`])} `
      + `(base ${range(SAWN.map((r) => r.baseTime))} s).`,
  },
  {
    num: 2, name: 'Clean Sawing',
    fx: { 'count:plank': 4 },
    note: (fx) => `${PLANKS.label}: ${fx['count:plank']} planks per log (base ${PLANKS.count ?? 1}).`,
  },
  {
    num: 3, name: 'Heavy Timber',
    fx: { 'count:timber': 3 },
    note: (fx) => `${TIMBERS.label}: ${fx['count:timber']} timbers per log (base ${TIMBERS.count ?? 1}).`,
  },
  {
    num: 6, name: 'Thatcher',
    fx: { 'count:thatch': 2 },
    note: (fx) => `${THATCH.label}: ${fx['count:thatch']} thatch per ${THATCH.inputs[0].count ?? 1} `
      + `${itemName(THATCH.inputs[0].item)} (base ${THATCH.count ?? 1}).`,
  },
  {
    num: 10, name: 'Master Joiner',
    fx: onEach('rare', JOINERY.map((r) => r.id), RARITY_ODDS[0] * 2),
    note: (fx) => `Rare chance on carpentry and fine carpentry furniture (${JOINERY.length} pieces, boats, carts and wagons included): `
      + `${oneIn(fx[`rare:${JOINERY[0].id}`])} (base ${oneIn(RARITY_ODDS[0])}). Supreme and fantastic at usual odds.`,
  },
  {
    num: 12, name: 'Deep Drawers',
    fx: onEach('hold', DRAWERS.map((f) => f.id), 1.2),
    note: (fx) => `Capacity ${more(fx[`hold:${DRAWERS[0].id}`])}, before wood and rarity: ${pieces(DRAWERS.map((f) => f.id))} you make. `
      + `Chest ${Math.round((furnitureDef('chest').capacity ?? 0) * fx['hold:chest'])} `
      + `(base ${furnitureDef('chest').capacity}), barrel ${Math.round((furnitureDef('barrel').liquid ?? 0) * fx['hold:barrel'])} litres `
      + `(base ${furnitureDef('barrel').liquid}). Stays with the piece.`,
  },
  {
    num: 14, name: 'Shipwright',
    fx: onEach('time', BOATS.map((f) => `make_${f.id}`), 0.7),
    note: (fx) => `Build time ${cut(fx[`time:make_${BOATS[0].id}`])}: ${listed(BOATS.map((f) => piece(f.id)))} `
      + `(base ${listed(BOATS.map((f) => `${pieceRecipe(f.id).baseTime} s`))}).`,
  },
  {
    num: 15, name: 'Keel Layer',
    fx: onEach('speed', BOATS.map((f) => f.id), 1.1),
    note: (fx) => `Boat speed ${more(fx[`speed:${BOATS[0].id}`])} on boats you build, at fair effort, in tiles/s: `
      + `${listed(BOATS.map((f) => `${piece(f.id)} ${tenth((f.boat?.speed ?? 0) * fx[`speed:${f.id}`])}`))} `
      + `(base ${listed(BOATS.map((f) => `${f.boat?.speed}`))}). Stays with the boat.`,
  },
  {
    num: 16, name: 'Deep Hold',
    fx: onEach('hold', BOATS.map((f) => f.id), 1.25),
    note: (fx) => `Boat capacity ${more(fx[`hold:${BOATS[0].id}`])} on boats you build, before wood and rarity: `
      + `${listed(BOATS.map((f) => `${piece(f.id)} ${Math.round((f.capacity ?? 0) * fx[`hold:${f.id}`])}`))} `
      + `(base ${listed(BOATS.map((f) => `${f.capacity}`))}). Stays with the boat.`,
  },
  {
    num: 18, name: 'Smooth Axle',
    fx: onEach('speed', VEHICLES.map((f) => f.id), 1.1),
    note: (fx) => `Vehicle speed ${more(fx[`speed:${VEHICLES[0].id}`])}: ${pieces(VEHICLES.map((f) => f.id))} you build. `
      + `Max ${tenth(MAX_VEHICLE_SPEED * fx[`speed:${VEHICLES[0].id}`])} tiles/s (base max ${MAX_VEHICLE_SPEED}). `
      + 'Stays with the vehicle.',
  },
  {
    num: 19, name: 'Sure Hull',
    fx: onEach('fail', HULLS.map((r) => r.id), 0.5),
    note: (fx) => `Boat, cart and wagon building failure chance ${mul(fx[`fail:${HULLS[0].id}`])} `
      + `(base: check at difficulty ${range(HULLS.map((r) => r.difficulty ?? 0))}).`,
  },
  {
    num: 25, name: 'Fence Builder',
    fx: { 'time:fence': 0.5, 'bill:fence': 0.5 },
    note: (fx) => `${capital(listed(FENCES.map(plural)))}: time ${mul(fx['time:fence'])} `
      + `(base ${secs(base('build_wall'))}), material ${mul(fx['bill:fence'])} rounded up. Plank fence: `
      + `${bill(wallBill('plank', 'fence', fx['bill:fence']).needed)} (base ${bill(wallBill('plank', 'fence').needed)}). `
      + 'Hinges and brackets unchanged.',
  },
  {
    num: 26, name: 'Timber Salvage',
    fx: { 'salvage:build_wood': 0.5 },
    note: (fx) => `Remove wall returns ${percent(fx['salvage:build_wood'])} of the logs or planks in a wall of `
      + `${either(TIMBER)}, rounded down: plank wall ${Math.floor(PLANK_WALL.bill[0][1] * fx['salvage:build_wood'])} of `
      + `${PLANK_WALL.bill[0][1]} planks (base: none).`,
  },
  {
    num: 27, name: 'Bridge Wright',
    fx: {
      'time:bridge_wood': 0.7, 'time:bridge_rope': 0.7,
      'span:bridge_wood': BRIDGES.wood.span + 2, 'span:bridge_rope': BRIDGES.rope.span + 2,
    },
    note: (fx) => `${BRIDGES.wood.name} and ${BRIDGES.rope.name.toLowerCase()} work time `
      + `${cut(fx['time:bridge_wood'])} (base ${secs(base('build_bridge'))}). Max span +`
      + `${fx['span:bridge_wood'] - BRIDGES.wood.span} tiles: ${fx['span:bridge_wood']} and ${fx['span:bridge_rope']} `
      + `(base ${BRIDGES.wood.span} and ${BRIDGES.rope.span}).`,
  },
  {
    num: 31, name: "Bowyer's Draw",
    fx: onEach('damage', BOWS.map((w) => w.id), 1.1),
    note: (fx) => `Bow damage ${more(fx[`damage:${BOWS[0].id}`])} on bows you make, base damage: `
      + `${listed(BOWS.map((w) => `${itemName(w.id)} ${tenth(w.damage * fx[`damage:${w.id}`])}`))} `
      + `(base ${listed(BOWS.map((w) => `${w.damage}`))}). Stays with the bow.`,
  },
  {
    num: 32, name: 'True Bow',
    fx: onEach('range', BOWS.map((w) => w.id), 1.1),
    note: (fx) => `Bow range ${more(fx[`range:${BOWS[0].id}`])} on bows you make, in tiles: `
      + `${listed(BOWS.map((w) => `${itemName(w.id)} ${tenth((w.range ?? 0) * fx[`range:${w.id}`])}`))} `
      + `(base ${listed(BOWS.map((w) => `${w.range}`))}). Stays with the bow.`,
  },
  {
    num: 37, name: 'String Maker',
    fx: { [`need:${BOWSTRING.id}`]: 0.5, [`fail:${BOWSTRING.id}`]: 0 },
    note: (fx) => `${BOWSTRING.label}: ${Math.max(1, Math.ceil((BOWSTRING.inputs[0].count ?? 1) * fx[`need:${BOWSTRING.id}`]))} `
      + `${itemName(BOWSTRING.inputs[0].item)} (base ${BOWSTRING.inputs[0].count ?? 1}), never fails `
      + `(base: check at difficulty ${BOWSTRING.difficulty}).`,
  },
  {
    num: 45, name: 'Saw Care',
    fx: onEach('wear', SAW_TOOLS, 0.5),
    note: (fx) => `Tool damage per use ${mul(fx[`wear:${SAW_TOOLS[0]}`])}: ${listed(SAW_TOOLS.map((id) => plural(itemName(id))))}, `
      + 'any quality and material.',
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Smith: the smelter, the anvil and the file.
 * ---------------------------------------------------------------------------
 */
/** The alloys: every lump the smelter mixes rather than smelts out of ore. */
const ALLOYS = RECIPES.filter((r) => METALS.some((m) => m.ore === null && m.lump === r.result));
const GLASS = recipeOf('make_glass');
/** What the anvil beats out of a casting: every mould's piece but the anvil's and the two cast whole. */
const BEATEN = MOULDS.filter((m) => m.makes !== 'anvil' && !castWhole(m));
/** Every tool a job asks for. */
const TOOLS = new Set([...ACTION_BY_ID.values()].map((a) => a.tool).concat(RECIPES.map((r) => r.tool)).filter((t): t is string => !!t));
/** The things made one at a time out of any of these parts. */
const fittedFrom = (parts: readonly string[]): string[] =>
  [...new Set(RECIPES.filter((r) => !ITEM_DEFS[r.result]?.stackable && r.inputs.some((i) => parts.includes(i.item))).map((r) => r.result))];
/** The heads and blades the anvil beats out, which is what a weapon or a tool is fitted round -- not its nails or ribbons. */
const HEADS = BEATEN.map((m) => m.makes).filter((id) => /_(head|blade)$/.test(id));
/** The heads and blades a weapon is fitted from. */
const WEAPON_PARTS = HEADS.filter((id) => fittedFrom([id]).some((w) => WEAPON_BY_ID.has(w)));
/** And those a tool some job asks for is fitted from. */
const TOOL_PARTS = HEADS.filter((id) => fittedFrom([id]).some((t) => TOOLS.has(t)));
const WEAPONS_FITTED = fittedFrom(WEAPON_PARTS).filter((id) => WEAPON_BY_ID.has(id));
/** Chain and plate the anvil beats out: every piece of the class that has a mould. */
const armourOf = (cls: string): string[] => ARMOUR.filter((a) => a.cls === cls && MOULD_BY_MAKES.has(a.id)).map((a) => a.id);
const CHAIN = armourOf('chain');
const PLATE = armourOf('plate');
/** What Temper Bath quenches: a weapon or a tool fitted from a head or blade the anvil beat out, or one it beats out whole. */
const TEMPERED = [...new Set([
  ...fittedFrom([...WEAPON_PARTS, ...TOOL_PARTS]).filter((id) => WEAPON_BY_ID.has(id) || TOOLS.has(id)),
  ...BEATEN.map((m) => m.makes).filter((id) => !ITEM_DEFS[id]?.stackable && !ARMOUR_BY_ID.has(id)),
])];
/** Every mould but the anvil's, which one filling uses up whole. */
const MOULDS_KEPT = MOULDS.filter((m) => m.makes !== 'anvil').map((m) => m.id);
const NAIL = MOULD_BY_ID.get('nail_mould')!;
const SWORD = WEAPON_BY_ID.get('sword')!;
/** Examples the notes work their numbers through: examples, not rules. */
const SAMPLE = { mould: 50, dent: 40, head: 50, swing: 0.7, skill: 50, piece: 40, ql: 50 };
const HAUBERK = { uid: 0, id: 'chain_hauberk', ql: SAMPLE.ql, dmg: 0, count: 1, extra: 'Iron' } as Item;
const label = (id: string): string => ACTION_BY_ID.get(id)?.label ?? id;

const SMITH: Seed[] = [
  {
    num: 7, name: 'Sure Alloy',
    fx: onEach('fail', ALLOYS.map((r) => r.id), 0.5),
    note: (fx) => `${listed(ALLOYS.map((r) => r.label))} failure chance ${mul(fx[`fail:${ALLOYS[0].id}`])} `
      + `(base: check at difficulty ${range(ALLOYS.map((r) => r.difficulty ?? 0))}).`,
  },
  {
    num: 8, name: 'Glassblower',
    fx: { [`count:${GLASS.result}`]: 3 },
    note: (fx) => `${GLASS.label}: ${fx[`count:${GLASS.result}`]} ${itemName(GLASS.result).toLowerCase()} per `
      + `${GLASS.inputs[0].count ?? 1} ${itemName(GLASS.inputs[0].item).toLowerCase()} (base ${GLASS.count ?? 1}).`,
  },
  {
    num: 9, name: 'Reclaimer',
    fx: { 'melt:share': 0.75, 'melt:keep': 0.85 },
    note: (fx) => `Melt down returns ${percent(fx['melt:share'])} of an item's lumps at ${percent(fx['melt:keep'])} of its `
      + `QL minus damage (base ${percent(MELT_SHARE)} at ${percent(MELT_KEEP)}). ${capital(itemName(HAUBERK.id))}: `
      + `${meltLumps(HAUBERK, 1, fx['melt:share'])} lumps (base ${meltLumps(HAUBERK, 1)}).`,
  },
  {
    num: 12, name: 'Hard Sand',
    fx: onEach('last', MOULDS_KEPT, 2),
    note: (fx) => `Mould uses ${mul(fx[`last:${MOULDS_KEPT[0]}`])} on moulds you make, all but the anvil mould (one use). `
      + `QL ${SAMPLE.mould} mould: ${mouldUsesLeft(SAMPLE.mould, 0, fx[`last:${MOULDS_KEPT[0]}`])} copper fillings `
      + `(base ${mouldUsesLeft(SAMPLE.mould, 0)}). Stays with the mould.`,
  },
  {
    num: 13, name: 'Clean Pour',
    fx: { 'pour:wear': 0 },
    note: (fx) => `Mould damage counted against the pour: ${fx['pour:wear'] ? mul(fx['pour:wear']) : 'none'} `
      + `(base ${mul(MOULD_DENT)}). QL ${SAMPLE.mould} mould at ${SAMPLE.dent} damage pours as ${SAMPLE.mould - SAMPLE.dent * fx['pour:wear']} `
      + `(base ${SAMPLE.mould - SAMPLE.dent * MOULD_DENT}); the casting also counts lump QL and smelting.`,
  },
  {
    num: 16, name: 'Sure Hammer',
    fx: { 'fail:smith': 0.5, 'fail:strike_coins': 0.5 },
    note: (fx) => `${label('smith')} and ${label('strike_coins')} failure chance ${mul(fx['fail:smith'])} `
      + `(base: check at difficulty ${range(BEATEN.map((m) => m.difficulty))} for a piece, ${COIN_DIFFICULTY} for coins, `
      + 'more for hard metals).',
  },
  {
    num: 20, name: 'Second Heat',
    fx: { 'spare:smith': 1 },
    note: (fx) => `Failed ${label('smith')}: casting kept for another try${fx['spare:smith'] >= 1 ? '' : ` on ${oneIn(fx['spare:smith'])}`} `
      + '(base: metal lost).',
  },
  {
    num: 22, name: 'Nail Maker',
    fx: { 'count:nail': 8 },
    note: (fx) => `Nails per nail-mould filling: ${fx['count:nail']} `
      + `(base ${NAIL.per ?? 1}). ${fx['count:nail']} nails per ${NAIL.lumps === 1 ? 'iron lump' : `${NAIL.lumps} iron lumps`}, `
      + `per ${mouldLumps(NAIL, 'gold')} gold.`,
  },
  {
    num: 24, name: 'Keen Edge',
    fx: onEach('damage', WEAPON_PARTS, 1.1),
    note: (fx) => `Weapon damage ${more(fx[`damage:${WEAPON_PARTS[0]}`])} on weapons fitted from heads and blades you beat out, `
      + `by anyone: ${listed(WEAPONS_FITTED.map((id) => plural(itemName(id))))}. Sword ${tenth(SWORD.damage * fx[`damage:${WEAPON_PARTS[0]}`])} `
      + `base damage (base ${SWORD.damage}). Passes from part to weapon and stays with it.`,
  },
  {
    num: 25, name: 'Balanced',
    fx: onEach('aim', WEAPON_PARTS, 1.05),
    note: (fx) => `Hit chance ${more(fx[`aim:${WEAPON_PARTS[0]}`])} on weapons fitted from heads and blades you beat out, `
      + `by anyone; max ${percent(HIT_CAP)}. A ${percent(SAMPLE.swing)} swing hits `
      + `${percent(Math.min(HIT_CAP, SAMPLE.swing * fx[`aim:${WEAPON_PARTS[0]}`]))}. Passes from part to weapon and stays with it.`,
  },
  {
    num: 26, name: 'Mail Maker',
    fx: onEach('soak', CHAIN, 1.1),
    note: (fx) => `Damage stopped ${more(fx[`soak:${CHAIN[0]}`])} on chain you beat out, max ${percent(SOAK_CAP)}: `
      + `${listed(CHAIN.map((id) => itemName(id)))}. ${percent(ARMOUR_CLASSES.chain.soak)} chain stops `
      + `${percent(ARMOUR_CLASSES.chain.soak * fx[`soak:${CHAIN[0]}`])}. Stays with the piece.`,
  },
  {
    num: 27, name: 'Plate Maker',
    fx: onEach('soak', PLATE, 1.1),
    note: (fx) => `Damage stopped ${more(fx[`soak:${PLATE[0]}`])} on plate you beat out, max ${percent(SOAK_CAP)}: `
      + `${listed(PLATE.map((id) => itemName(id)))}. ${percent(ARMOUR_CLASSES.plate.soak)} plate stops `
      + `${percent(ARMOUR_CLASSES.plate.soak * fx[`soak:${PLATE[0]}`])}. Stays with the piece.`,
  },
  {
    num: 30, name: 'Toolsmith',
    fx: onEach('ql', TOOL_PARTS, 1.1),
    note: (fx) => `QL ${more(fx[`ql:${TOOL_PARTS[0]}`])} on tool heads and blades you beat out: `
      + `${listed(TOOL_PARTS.map((id) => plural(itemName(id))))}. QL ${SAMPLE.head} becomes `
      + `${tenth(SAMPLE.head * fx[`ql:${TOOL_PARTS[0]}`])}.`,
  },
  {
    num: 32, name: 'Metal Polisher',
    fx: { 'improve:metal': 1.5 },
    note: (fx) => `Improve gain per pass ${more(fx['improve:metal'])} on metal. At skill ${SAMPLE.skill}, QL `
      + `${SAMPLE.piece}: ${tenth(improveStepAt(SAMPLE.skill, SAMPLE.piece) * fx['improve:metal'])} per pass `
      + `(base ${tenth(improveStepAt(SAMPLE.skill, SAMPLE.piece))}).`,
  },
  {
    num: 36, name: 'Forge Reach',
    fx: { 'reach:forge': 6 },
    note: (fx) => `Smelter and anvil work takes from your stores within ${fx['reach:forge']} tiles `
      + `(base ${CRAFT_REACH}): ${listed(FORGE_WORK.map((id) => label(id).toLowerCase()))} and every smelter recipe.`,
  },
  {
    num: 19, name: 'Master’s Mark',
    fx: { 'rare:smith': RARITY_ODDS[0] * 2 },
    note: (fx) => `Rare chance at the anvil: ${oneIn(fx['rare:smith'])} (base ${oneIn(RARITY_ODDS[0])}). `
      + 'Supreme and fantastic at usual odds.',
  },
  {
    num: 45, name: 'Temper Bath',
    fx: onEach('temper', TEMPERED, 5),
    note: (fx) => `New action: Quench, at water or beside a barrel or well of it, by you or any Smith with Temper Bath. `
      + `+${fx[`temper:${TEMPERED[0]}`]} QL, once, on a weapon or tool you finish: `
      + `${listed(TEMPERED.map((id) => plural(itemName(id))))} (fitted from an anvil-beaten head or blade, or anvil-beaten whole). `
      + 'Stays with the item until quenched.',
  },
  {
    num: 49, name: 'Ingots',
    fx: { ingot: 1 },
    note: () => `New smelter recipe: ingot from ${INGOT_LUMPS} lumps of a metal, at the lumps' QL. Weight `
      + `${mul(INGOT_WEIGHT)} of its lumps. Counts as ${INGOT_LUMPS} lumps at the smelter, anvil, recipes and `
      + 'Improve; unused lumps are returned.',
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Forester: the hatchet, the sickle and the growing wood.
 * ---------------------------------------------------------------------------
 */
/** The ground a walker is slowed on that a Forester's Woodsman's Stride takes at full pace. */
export const STRIDE = [TileType.Bush, TileType.Reed, TileType.Stump, TileType.Marsh];
const tileName = (t: TileType): string => TILE_DEFS[t].name.toLowerCase();
/** The stages a tree is felled in more than one stroke. */
const MANY_STROKES = TREE_AGES.filter((a) => a.hits > 1);
/** A tree that can be coppiced: one grown enough to bear. */
const COPPICED = TREE_AGES.filter((a) => a.alive && a.bears);
const age = (id: number): string => TREE_AGES[id].name.toLowerCase();

const FORESTER: Seed[] = [
  {
    num: 1, name: 'Clean Stroke',
    fx: { 'time:cut_down': 0.75 },
    note: (fx) => `${label('cut_down')} time per stroke ${cut(fx['time:cut_down'])} (base ${secs(base('cut_down'))}), trees and bushes.`,
  },
  {
    num: 2, name: 'Heavy Swing',
    fx: { 'fewer:cut_down': 1 },
    note: (fx) => `Strokes to fell a tree −${fx['fewer:cut_down']}, min one: `
      + `${listed(MANY_STROKES.map((a) => `${a.name.toLowerCase()} ${Math.max(1, a.hits - fx['fewer:cut_down'])} (base ${a.hits})`))}.`,
  },
  {
    num: 3, name: 'Sure Hatchet',
    fx: { 'fail:cut_down': 0.5 },
    note: (fx) => `${label('cut_down')} failure chance ${mul(fx['fail:cut_down'])} (base: check at difficulty `
      + `${diff('cut_down')}), trees and bushes.`,
  },
  {
    num: 5, name: 'Choice Logs',
    fx: { 'ql:cut_down': 1.1 },
    note: (fx) => `Felled log QL ${more(fx['ql:cut_down'])}.`,
  },
  {
    num: 6, name: 'Rare Heartwood',
    fx: { 'rare:cut_down': RARITY_ODDS[0] },
    note: (fx) => `Rare log chance per tree felled: ${oneIn(fx['rare:cut_down'])} (base: none). `
      + 'Rare may become supreme or fantastic at crafting odds.',
  },
  {
    num: 7, name: 'Clean Drop',
    fx: { 'stump:clear': 1 },
    note: () => 'Felled tree leaves grass (base: a stump, for a day or until dug out).',
  },
  {
    num: 10, name: 'Sprout Picker',
    fx: { 'fail:pick_sprout': 0, 'count:sprout': 2 },
    note: (fx) => `${label('pick_sprout')} never fails (base: check at difficulty ${diff('pick_sprout')}). `
      + `Sprouts per action: ${fx['count:sprout']} (base one).`,
  },
  {
    num: 11, name: 'Nursery',
    fx: { 'grown:plant': 1 },
    note: (fx) => {
      const grown = TREE_AGES[plantedAge(fx['grown:plant'])];
      return `Planted sprout age: ${grown.name.toLowerCase()} (base ${age(PLANTED_AGE)}). `
        + `Logs when felled: ${grown.logs} (base ${TREE_AGES[PLANTED_AGE].logs})`
        + `${grown.bears ? '. Fruit trees bear at once' : ''}.`;
    },
  },
  {
    num: 14, name: 'Master Grafter',
    fx: { 'fail:graft': 0, 'time:graft': 0.7 },
    note: (fx) => `${label('graft')} never fails (base: check at difficulty ${diff('graft')}; sprout used either way). `
      + `Time ${cut(fx['time:graft'])} (base ${secs(base('graft'))}).`,
  },
  {
    num: 16, name: 'Fruitful',
    fx: { 'more:pick_fruit': 1 },
    note: (fx) => `${label('pick_fruit')}: one extra fruit on ${fx['more:pick_fruit'] >= 1 ? 'every pick' : `${percent(fx['more:pick_fruit'])} of picks`}.`,
  },
  {
    num: 20, name: 'Hedge Harvest',
    fx: { 'more:harvest_bush': 1 },
    note: (fx) => `Bush harvest: one extra ${either(BUSH_DEFS.flatMap((b) => (b.yields ? [itemName(b.yields)] : [])))} on `
      + `${fx['more:harvest_bush'] >= 1 ? 'every action' : `${percent(fx['more:harvest_bush'])} of actions`}.`,
  },
  {
    num: 21, name: 'Nest Finder',
    fx: { 'nest:chance': 0.1, 'nest:feathers': 3 },
    note: (fx) => `Tree felled for timber: ${oneIn(fx['nest:chance'])} give ${fx['nest:feathers']} `
      + `${itemName('feather')} at the logs' QL.`,
  },
  {
    num: 22, name: 'Honey Hunter',
    fx: { 'honey:chance': 0.05, 'honey:count': 2 },
    note: (fx) => `Tree felled for timber: ${oneIn(fx['honey:chance'])} give ${fx['honey:count']} `
      + `${itemName('honey')} at the logs' QL.`,
  },
  {
    num: 24, name: 'Kindling',
    fx: { 'bush:shaft': 2 },
    note: (fx) => `Cut down a bush: ${fx['bush:shaft']} ${plural(itemName('shaft'))} (base: none).`,
  },
  {
    num: 34, name: "Woodsman's Stride",
    fx: Object.fromEntries(STRIDE.map((t) => [walkKey(t), 1 / TILE_DEFS[t].speed])),
    note: () => `Full walk speed on foot through ${listed(STRIDE.map(tileName))} `
      + `(base ${listed(STRIDE.map((t) => `${tileName(t)} ${percent(TILE_DEFS[t].speed)}`))}).`,
  },
  {
    num: 40, name: 'Coppice',
    fx: { coppice: 2 },
    note: (fx) => `New action: ${label('coppice')} (hatchet, ${secs(base('coppice'))}, check at difficulty ${diff('coppice')}). `
      + `Cuts ${either(COPPICED.map((a) => a.name.toLowerCase()))} trees back to ${age(PLANTED_AGE)} for `
      + `${fx.coppice} logs; the tree stays standing.`,
  },
  {
    num: 43, name: 'Tap Resin',
    fx: { tap_resin: 1 },
    note: (fx) => `New action: ${label('tap_resin')} (carving knife, ${secs(base('tap_resin'))}). ${fx.tap_resin} `
      + `${itemName('tar')} from a living ${TREE_DEFS[RESIN_TREE].name.toLowerCase()}, once a day per tree; day starts at the `
      + `daily reset (${resetHour()} UTC).`,
  },
  {
    num: 44, name: 'Clear Brush',
    fx: { clear_brush: 1 },
    note: (fx) => `New action: ${label('clear_brush')} (sickle, ${secs(base('clear_brush'))}). Clears every bush and reed in a `
      + `${2 * fx.clear_brush + 1}×${2 * fx.clear_brush + 1} area at once. Bush leaves `
      + `${tileName(CLEARED_TO[TileType.Bush] as TileType)}, reed leaves ${tileName(CLEARED_TO[TileType.Reed] as TileType)}. `
      + 'No output.',
  },
];

/** What a quern presses: juice and cider into a bucket, and olive oil. */
const PRESSES = RECIPES.filter((r) => ['juice_bucket', 'cider_bucket', 'olive_oil'].includes(r.result));
/** The fruit a press takes, which is its first input. */
const pressFruit = (r: Recipe): number => r.inputs[0]?.count ?? 1;
/** Each crop's produce and seed, flour and cornmeal: what a Farmer's Sack Porter lightens. */
const SACKED = [...CROP_LIST.flatMap((c) => [c.produce, c.seed]), 'flour', 'cornmeal'];
const cropNames = (list: readonly CropDef[]): string => listed(list.map((c) => c.name.toLowerCase()));
const HERBS = CROP_LIST.filter((c) => c.look === 'herb');
const GRAINS = CROP_LIST.filter((c) => c.look === 'grain');
const FIBRES = CROP_LIST.filter((c) => c.kind === 'fibre');
const plusOn = (list: readonly CropDef[], n: number): Fx => Object.fromEntries(list.map((c) => [`plus:${c.produce}`, n]));
/** The quickest crop and the slowest, for what a Farmer's pace does to a stage. */
const QUICKEST = CROP_LIST.reduce((a, b) => (b.stageSeconds < a.stageSeconds ? b : a));
const SLOWEST = CROP_LIST.reduce((a, b) => (b.stageSeconds > a.stageSeconds ? b : a));
const stageRange = (m: number): string =>
  `${QUICKEST.name.toLowerCase()} ${secs(QUICKEST.stageSeconds * m)} (base ${secs(QUICKEST.stageSeconds)}) `
  + `to ${SLOWEST.name.toLowerCase()} ${secs(SLOWEST.stageSeconds * m)} (base ${secs(SLOWEST.stageSeconds)})`;
/** "3×3", the patch a Farmer's patch job covers at a reach of `r`. */
const patchSide = (r: number): string => `${2 * r + 1}×${2 * r + 1}`;
const madeOf = (id: string): number => RECIPES.find((r) => r.id === id)?.count ?? 1;
const recipeLabel = (id: string): string => RECIPES.find((r) => r.id === id)?.label ?? id;

const FARMER: Seed[] = [
  {
    num: 4, name: 'Seed Saver',
    fx: { 'keep:plant_seed': 0.25 },
    note: (fx) => `Sow and Sow a patch use no seed: ${oneIn(fx['keep:plant_seed'])} fields.`,
  },
  {
    num: 5, name: 'Fast Growth',
    fx: { 'grow:plant_seed': 0.8 },
    note: (fx) => `Crop growth stage time ${cut(fx['grow:plant_seed'])} on crops you sow: ${stageRange(fx['grow:plant_seed'])}.`,
  },
  {
    num: 6, name: 'Crop Rotation',
    fx: { 'rotate:plant_seed': 0.75 },
    note: (fx) => `Crop growth stage time ${cut(fx['rotate:plant_seed'])} on a field last sown with a different crop: `
      + `${stageRange(fx['rotate:plant_seed'])}. A field never sown, or broken up since, has no last crop.`,
  },
  {
    num: 8, name: 'Bumper Crop',
    fx: { 'bumper:harvest_crop': 1 },
    note: (fx) => `Harvest of a crop tended at all ${RIPE} growth stages: ${cropYield(RIPE, fx['bumper:harvest_crop']).produce} `
      + `produce (base ${cropYield(RIPE).produce}).`,
  },
  {
    num: 11, name: 'Rare Harvest',
    fx: { 'rare:harvest_crop': RARITY_ODDS[0] },
    note: (fx) => `Rare harvest chance: ${oneIn(fx['rare:harvest_crop'])} crops (base: none); seed is never rare. `
      + 'Rare may become supreme or fantastic at crafting odds.',
  },
  {
    num: 14, name: 'Fodder',
    fx: { 'fodder:harvest_crop': 2 },
    note: (fx) => `Harvest: +${fx['fodder:harvest_crop']} ${itemName('mixed_grass')} at the harvest's QL, into your pack.`,
  },
  {
    num: 15, name: 'Herb Plot',
    fx: plusOn(HERBS, 2),
    note: (fx) => `Harvest +${fx[`plus:${HERBS[0].produce}`]}: ${cropNames(HERBS)}.`,
  },
  {
    num: 16, name: 'Grain Master',
    fx: plusOn(GRAINS, 2),
    note: (fx) => `Harvest +${fx[`plus:${GRAINS[0].produce}`]}: ${cropNames(GRAINS)}.`,
  },
  {
    num: 17, name: 'Fibre Farmer',
    fx: plusOn(FIBRES, 2),
    note: (fx) => `Harvest +${fx[`plus:${FIBRES[0].produce}`]}: ${cropNames(FIBRES)}.`,
  },
  {
    num: 22, name: 'More Meal',
    fx: { 'count:flour': 2, 'count:cornmeal': 2 },
    note: (fx) => `${recipeLabel('make_flour')}: ${fx['count:flour']} ${itemName('flour')} per action `
      + `(base ${madeOf('make_flour')}). ${recipeLabel('make_cornmeal')}: ${fx['count:cornmeal']} `
      + `${itemName('cornmeal')} (base ${madeOf('make_cornmeal')}).`,
  },
  {
    num: 23, name: 'Full Press',
    fx: Object.fromEntries(PRESSES.map((r) => [`need:${r.id}`, 0.8])),
    note: (fx) => {
      const m = fx[`need:${PRESSES[0].id}`];
      const took = [...new Set(PRESSES.map(pressFruit))].sort((a, b) => a - b);
      return `Quern juice, cider and olive oil: fruit needed ${cut(m)}, `
        + `${listed(took.map((n) => `${Math.max(1, Math.ceil(n * m))} (base ${n})`))}; `
        + `output per fruit ${more(1 / m)}. Juice and cider: one bucket per pressing.`;
    },
  },
  {
    num: 25, name: 'Milkmaid',
    fx: { 'time:milk_creature': 0.6, 'more:milk_creature': 0.5 },
    note: (fx) => `${capital(ACTION_BY_ID.get('milk_creature')?.verb ?? 'milking')} time ${cut(fx['time:milk_creature'])} (base ${secs(base('milk_creature'))}). `
      + `Cudda: second bucket of milk on ${oneIn(fx['more:milk_creature'])} actions, if you carry another empty bucket. `
      + `Gorral: ${GORRAL_MILK} litres per milking either way.`,
  },
  {
    num: 28, name: 'Sack Porter',
    fx: Object.fromEntries(SACKED.map((id) => [`weight:${id}`, 0.5])),
    note: (fx) => `Weight ${cut(fx[`weight:${SACKED[0]}`])}: produce and seed of every crop, flour, cornmeal. `
      + `${capital(listed(['potato', 'wheat_seed', 'flour'].map((id) => `${itemName(id)} ${kg(id) * fx[`weight:${id}`]} kg per unit (base ${kg(id)} kg)`)))}.`,
  },
  {
    num: 30, name: 'Barn Reach',
    fx: { 'into:harvest_crop': 5, 'into:harvest_patch': 5 },
    note: (fx) => `Harvest and Harvest a patch output goes into the nearest unlocked cart or wagon not pulled or driven by `
      + `another player, or container you built or on your settlement, within ${fx['into:harvest_crop']} tiles `
      + '(base: your pack).',
  },
  {
    num: 34, name: 'Worn-in Rake',
    fx: { 'tool:till': 20 },
    note: (fx) => `Rake QL counts +${fx['tool:till']} when tilling, max ${QL_TOP}: ${label('till')} time `
      + `−${percent(fx['tool:till'] / TOOL_QL_SPAN)} (base ${secs(base('till'))}; each tool QL point `
      + `−${percent(1 / TOOL_QL_SPAN)} of an action's time).`,
  },
  {
    num: 39, name: 'Sow a Patch',
    fx: { sow_patch: 1 },
    note: (fx) => `New action: ${label('sow_patch')} (${secs(base('sow_patch'))}, the time of ${base('sow_patch') / base('plant_seed')} `
      + `sowings). Sows the chosen seed on every empty field in a ${patchSide(fx.sow_patch)} area, `
      + 'one seed per field.',
  },
  {
    num: 40, name: 'Tend a Patch',
    fx: { tend_patch: 1 },
    note: (fx) => `New action: ${label('tend_patch')} (${secs(base('tend_patch'))}, the time of ${base('tend_patch') / base('tend_crop')} `
      + `tendings). Tends every unripe crop not yet tended at its growth stage in a ${patchSide(fx.tend_patch)} area.`,
  },
  {
    num: 41, name: 'Harvest a Patch',
    fx: { harvest_patch: 1 },
    note: (fx) => `New action: ${label('harvest_patch')} (${secs(base('harvest_patch'))}, the time of `
      + `${base('harvest_patch') / base('harvest_crop')} harvests). Harvests every ripe crop in a ${patchSide(fx.harvest_patch)} `
      + 'area, each by its own tending.',
  },
];

/** A Cook's dishes: what a cooking recipe makes that is food. */
const DISHES = RECIPES.filter((r) => r.skill === 'cooking' && ITEM_DEFS[r.result]?.category === 'food');
/** Everything made with cooking, which a Cook's Quick Kitchen makes quicker. */
const COOKED = RECIPES.filter((r) => r.skill === 'cooking');
const DISH_ITEMS = [...new Set(DISHES.map((r) => r.result))];
const onDishes = (fam: string, v: number): Fx => Object.fromEntries(DISH_ITEMS.map((id) => [`${fam}:${id}`, v]));
const onDishRecipes = (fam: string, v: number): Fx => Object.fromEntries(DISHES.map((r) => [`${fam}:${r.id}`, v]));
/** What a Cook's Big Pot makes one more of, a go. */
const BIG_POT = ['stew', 'pottage', 'porridge', 'preserves'];
const madeOfItem = (id: string): number => RECIPES.find((r) => r.result === id)?.count ?? 1;
/** What a Cook's Hide Keeper takes better off a carcass. */
const HIDES = ['hide', 'fur', 'bone'];

const COOK: Seed[] = [
  {
    num: 3, name: 'Fine Fare',
    fx: onDishRecipes('ql', 1.1),
    note: (fx) => `Dish QL ${more(fx[`ql:${DISHES[0].id}`])}: all ${DISHES.length} cooking recipes that make food.`,
  },
  {
    num: 5, name: 'Big Pot',
    fx: Object.fromEntries(BIG_POT.map((id) => [`count:${id}`, madeOfItem(id) + 1])),
    note: (fx) => `Output per action: `
      + `${listed(BIG_POT.map((id) => `${itemName(id)} ${fx[`count:${id}`]} (base ${madeOfItem(id)})`))}.`,
  },
  {
    num: 6, name: 'Frugal Cook',
    fx: onDishRecipes('keep', 0.2),
    note: (fx) => `Dishes you cook: ${oneIn(fx[`keep:${DISHES[0].id}`])} return one of the first ingredient (not a bucket), `
      + 'at the QL of its stack.',
  },
  {
    num: 7, name: 'Hearty',
    fx: onDishes('feed', 1.25),
    note: (fx) => `Nutrition ${more(fx[`feed:${DISH_ITEMS[0]}`])} on all ${NUTRIENTS.length} nutrients, dishes you cook, for whoever eats them.`,
  },
  {
    num: 8, name: 'Long-lasting',
    fx: onDishes('rot', 0.5),
    note: (fx) => `Rot rate on the ground ${cut(fx[`rot:${DISH_ITEMS[0]}`])}, dishes you cook, whoever sets them down. `
      + 'Nothing rots in a pack or store.',
  },
  {
    num: 11, name: 'Flavoursome',
    fx: onDishes('knack', 1.5),
    note: (fx) => `Meal boost duration ${more(fx[`knack:${DISH_ITEMS[0]}`])}, dishes you cook, for whoever eats them.`,
  },
  {
    num: 14, name: 'Balanced Diet',
    fx: { 'table:best': 0.3 },
    note: (fx) => `Full table bonus to skill gain: up to +${percent(fx['table:best'])} (base +${percent(TABLE_BEST)}).`,
  },
  {
    num: 15, name: 'Filling',
    fx: onDishes('fill', 1.25),
    note: (fx) => `Food bar filled ${more(fx[`fill:${DISH_ITEMS[0]}`])}, dishes you cook, for whoever eats them.`,
  },
  {
    num: 18, name: 'Full Carcass',
    fx: { 'share:butcher': 1.15 },
    note: (fx) => `Butchering yield ${more(fx['share:butcher'])}, max the whole carcass.`,
  },
  {
    num: 20, name: 'Prime Cuts',
    fx: { 'ql:meat': 1.1 },
    note: (fx) => `Butchered ${itemName('meat')} QL ${more(fx['ql:meat'])}.`,
  },
  {
    num: 21, name: 'Hide Keeper',
    fx: Object.fromEntries(HIDES.map((id) => [`ql:${id}`, 1.1])),
    note: (fx) => `Butchered ${listed(HIDES.map((id) => plural(itemName(id))))} QL ${more(fx[`ql:${HIDES[0]}`])}.`,
  },
  {
    num: 28, name: 'Strong Brew',
    fx: Object.fromEntries(BREWS.map((b) => [`brewed:${b.id}`, 1.5])),
    note: (fx) => `Drink boost duration ${more(fx[`brewed:${BREWS[0].id}`])}: ${listed(BREWS.map((b) => b.name.toLowerCase()))} you brew, `
      + 'for whoever drinks it, from the barrel or a bucket drawn off it.',
  },
  {
    num: 31, name: 'Pantry Reach',
    fx: { 'reach:cook': 6 },
    note: (fx) => `Cooking takes ingredients from containers within ${fx['reach:cook']} tiles (base ${CRAFT_REACH}).`,
  },
  {
    num: 1, name: 'Quick Kitchen',
    fx: onEach('time', COOKED.map((r) => r.id), 0.7),
    note: (fx) => `Cooking time ${cut(fx[`time:${COOKED[0].id}`])}: all ${COOKED.length} cooking recipes `
      + `(base ${range(COOKED.map((r) => r.baseTime))} s).`,
  },
  {
    num: 46, name: 'Broth',
    fx: { broth: 1 },
    note: () => {
      const r = RECIPES.find((x) => x.id === 'make_broth')!;
      const feeds = ITEM_DEFS.broth.feeds ?? {};
      return `New recipe: ${r.label}. ${capital(listed(r.inputs.map((i) => `${i.count ?? 1} ${(i.count ?? 1) > 1 ? plural(itemName(i.item)) : itemName(i.item)}`)))} `
        + `over a campfire: ${r.count ?? 1} ${itemName('broth')}. Feeds all ${NUTRIENTS.length} nutrients, at QL ${QL_TOP}: `
        + `${listed(Object.entries(feeds).map(([k, v]) => `${k} ${percent((v ?? 0) * helpingOf(QL_TOP))}`))}.`;
    },
  },
  {
    num: 47, name: 'Distil',
    fx: { distil: 1 },
    note: () => `New recipe per brew: ${DISTIL_BUCKETS} buckets (${DISTIL_BUCKETS * BUCKET_LITRES} litres) over a campfire `
      + `make one bucket of spirit (${BUCKET_LITRES} litres) and return ${DISTIL_BUCKETS - 1} empty buckets. Spirit drink boost at QL ${QL_TOP}: `
      + `${durationSaid(boonTime('spirit_bucket', QL_TOP))} (${listed(BREWS.map((b) => `${b.name.toLowerCase()} `
      + `${durationSaid(boonTime(`${b.id}_bucket`, QL_TOP))}`))}).`,
  },
  {
    num: 49, name: 'Bait Maker',
    fx: { 'bait:butcher': 2 },
    note: (fx) => `Butchering: +${fx['bait:butcher']} ${itemName(BUTCHER_BAIT)} (fishing bait`
      + `${BAIT_BY_ID.get(BUTCHER_BAIT)?.favours.length ? `; draws ${listed(BAIT_BY_ID.get(BUTCHER_BAIT)!.favours.map((f) => itemName(f)))}` : ''}).`,
  },
  {
    num: 50, name: 'Taste',
    fx: { taste: 1 },
    note: () => 'Examine on food or drink shows: food bar filled (or thirst quenched) per helping, '
      + `each of the ${NUTRIENTS.length} nutrients fed, and meal or drink boost duration, at its QL and maker.`,
  },
];

/** A Tailor's spinning, weaving and trades. */
const SPINS = ['spin_wool', 'spin_cotton', 'spin_wemp'].map((id) => recipeOf(id));
const WEAVE = recipeOf('weave_cloth');
const TAILORED = RECIPES.filter((r) => r.skill === 'tailoring' && r.difficulty !== undefined);
const LEATHERED = RECIPES.filter((r) => r.skill === 'leatherworking' && r.difficulty !== undefined);
const TAILOR_RARE = RECIPES.filter((r) => r.skill === 'tailoring');
const TAILOR_LOST = RECIPES.filter((r) => TAILOR_SKILLS.has(r.skill) && r.consumeOnFail);
/** What a Tailor's Light Pack lightens, and the tack a Saddler's hand is in. */
const LIGHT = ['cloth', 'leather', 'yarn', 'hide'];
const TACKED = ['saddle', 'bridle', 'yoke'];
const needFor = (r: Recipe, m: number): number => Math.max(1, Math.ceil((r.inputs[0].count ?? 1) * m));
const holds = (id: string, m = 1): number => Math.round((ITEM_DEFS[id]?.holds ?? 0) * m);
const kgSaid = (x: number): string => `${Number(x.toFixed(3))} kg`;

const TAILOR: Seed[] = [
  {
    num: 2, name: 'Full Fleece',
    fx: { 'plus:wool': 1 },
    note: (fx) => `Wool per shearing +${fx['plus:wool']} (base ${Math.max(1, Math.round(SHEAR_FROM * SHEAR_WOOL))} `
      + `to ${SHEAR_WOOL}, by fleece growth).`,
  },
  {
    num: 3, name: 'Quick Spindle',
    fx: onEach('time', SPINS.map((r) => r.id), 0.6),
    note: (fx) => `Spinning time ${cut(fx[`time:${SPINS[0].id}`])} (base ${secs(SPINS[0].baseTime)}): wool, cotton and wemp.`,
  },
  {
    num: 4, name: 'Even Thread',
    fx: { 'count:yarn': 3 },
    note: (fx) => `Yarn per spinning: ${fx['count:yarn']} (base ${SPINS[0].count ?? 1}) from `
      + `${SPINS[0].inputs[0].count ?? 1} fibre.`,
  },
  {
    num: 7, name: 'Tight Weave',
    fx: { [`need:${WEAVE.id}`]: 2 / 3 },
    note: (fx) => `${capital(WEAVE.label)}: ${needFor(WEAVE, fx[`need:${WEAVE.id}`])} yarn (base ${needFor(WEAVE, 1)}).`,
  },
  {
    num: 9, name: 'Sure Needle',
    fx: onEach('fail', TAILORED.map((r) => r.id), 0.5),
    note: (fx) => `Tailoring failure chance ${mul(fx[`fail:${TAILORED[0].id}`])} (base: check at difficulty `
      + `${range(TAILORED.map((r) => r.difficulty ?? 0))}).`,
  },
  {
    num: 11, name: 'Master Tailor',
    fx: onEach('rare', TAILOR_RARE.map((r) => r.id), RARITY_ODDS[0] * 2),
    note: (fx) => `Rare chance on tailoring (${TAILOR_RARE.length} recipes): ${oneIn(fx[`rare:${TAILOR_RARE[0].id}`])} `
      + `(base ${oneIn(RARITY_ODDS[0])}). Supreme and fantastic at usual odds.`,
  },
  {
    num: 16, name: 'Sack Maker',
    fx: { 'hold:sack': 1.5 },
    note: (fx) => `Sack capacity: ${holds('sack', fx['hold:sack'])} (base ${holds('sack')}), sacks you stitch. Stays with the sack.`,
  },
  {
    num: 18, name: 'Sure Tan',
    fx: { 'fail:tan_hide': 0.5 },
    note: (fx) => `${capital(label('tan_hide'))} failure chance ${mul(fx['fail:tan_hide'])} (base: check at difficulty ${diff('tan_hide')}).`,
  },
  {
    num: 19, name: 'Lye Saver',
    fx: { 'lye:tan_hide': 0.5 },
    note: (fx) => `Tanning keeps the lye in the bucket: ${oneIn(fx['lye:tan_hide'])} actions (base: bucket returned empty).`,
  },
  {
    num: 21, name: 'Sure Awl',
    fx: onEach('fail', LEATHERED.map((r) => r.id), 0.5),
    note: (fx) => `Leatherworking failure chance ${mul(fx[`fail:${LEATHERED[0].id}`])} (base: check at difficulty `
      + `${range(LEATHERED.map((r) => r.difficulty ?? 0))}).`,
  },
  {
    num: 25, name: 'Deep Pockets',
    fx: { 'hold:satchel': 1.25, 'hold:backpack': 1.25 },
    note: (fx) => `Capacity, bags you stitch: satchel ${holds('satchel', fx['hold:satchel'])} (base ${holds('satchel')}), backpack `
      + `${holds('backpack', fx['hold:backpack'])} (base ${holds('backpack')}). Stays with the bag.`,
  },
  {
    num: 27, name: 'Saddler',
    fx: onEach('speed', TACKED, 1.1),
    note: (fx) => `Mount speed ${more(fx['speed:saddle'])} in a saddle or bridle you stitched, max `
      + `${tenth(MAX_MOUNT_SPEED * fx['speed:saddle'])} tiles/s (base max ${MAX_MOUNT_SPEED}). Cart and wagon speed `
      + `${more(fx['speed:yoke'])} with yokes you stitched, on top of the builder's bonus. Any rider or driver.`,
  },
  {
    num: 31, name: "Fisher's Friend",
    fx: { 'catch:fishing_net': 1.2, 'catch:creel': 1.2 },
    note: (fx) => `Catch ${more(fx['catch:fishing_net'])} on nets and creels you make, for any user: net haul, `
      + 'creel fish chance per check.',
  },
  {
    num: 34, name: 'Nothing Wasted',
    fx: each(TAILOR_LOST.map((r) => `spare:${r.id}`), 1),
    note: () => `Failed tailoring, leatherworking and ropemaking: materials kept (base: lost), on all `
      + `${TAILOR_LOST.length} recipes that lose them.`,
  },
  {
    num: 35, name: 'Light Pack',
    fx: each(LIGHT.map((id) => `weight:${id}`), 0.5),
    note: (fx) => `Weight ${cut(fx['weight:cloth'])}: `
      + `${listed(LIGHT.map((id) => `${itemName(id)} ${kgSaid(kg(id) * fx[`weight:${id}`])} per unit `
      + `(base ${kgSaid(kg(id))})`))}.`,
  },
  {
    num: 37, name: 'Workshop Reach',
    fx: { 'reach:tailor': 6 },
    note: (fx) => `Tailoring, leatherworking and ropemaking take materials from containers within ${fx['reach:tailor']} tiles `
      + `(base ${CRAFT_REACH}).`,
  },
  {
    num: 46, name: 'Patch',
    fx: { patch_item: 20 },
    note: (fx) => `New action: ${label('patch_item')} (${secs(base('patch_item'))}). Removes ${fx.patch_item} damage from a cloth or `
      + 'leather item for one cloth or leather. No QL loss.',
  },
  {
    num: 49, name: 'Tent',
    fx: { tent: 1 },
    note: () => `New build: ${piece('tent')} (${billWords(furnitureDef('tent').bill, true)}, needle). Place anywhere; sleep in it `
      + `for ${percent((furnitureDef('tent').bed ?? 0) / (furnitureDef('bed').bed ?? 1))} of a bed's rest.`,
  },
];

/** What a kept beast's hunger comes to, full to empty, at a pace. */
const emptyIn = (mode: 'active' | 'deed', m: number): string => durationSaid(1 / (HUNGER_RATE[mode] * m));
const CRATE_KG = kg('creature_crate');

const HERDSMAN: Seed[] = [
  {
    num: 1, name: 'Soft Hand',
    fx: { 'tame:offer': 0.1 },
    note: (fx) => `Tame chance per offering +${points(fx['tame:offer'])}, after all other factors `
      + `(max ${percent(TAME_MOST)}).`,
  },
  {
    num: 2, name: 'Patient Coax',
    fx: { 'coax:step': 0.06 },
    note: (fx) => `Tame chance after each refused offering +${points(fx['coax:step'])} (base +${points(COAX_STEP)}).`,
  },
  {
    num: 9, name: 'Young Trust',
    fx: { 'tame:young': 2.5 },
    note: (fx) => `Young wildermon tame chance: ×${fx['tame:young']} a grown one's (base ×${AGES.young.tame}).`,
  },
  {
    num: 10, name: 'Any Offering', key: 'any_bait',
    fx: { 'bait:any': 1 },
    note: () => 'Taming: any food is accepted as an offering, any kind (base: only its own foods). '
      + 'Feeding a kept one still needs its own food.',
  },
  {
    num: 11, name: 'Brushwork',
    fx: { 'groom:care': 1.5 },
    note: (fx) => `Care per brushing ${more(fx['groom:care'])} (base ${percent(groomGain(0, 0))} to ${percent(groomGain(100, 100))} `
      + 'of full care, by husbandry and brush).',
  },
  {
    num: 13, name: 'Lasting Care',
    fx: { 'kept:care_hours': 6 },
    note: (fx) => `Care wear-off time, wildermon you keep: ${durationSaid(fx['kept:care_hours'] * 3600)} `
      + `(base ${durationSaid(CARE_HOURS * 3600)}), whoever brushed it.`,
  },
  {
    num: 14, name: 'Well Kept',
    fx: { 'kept:care_bonus': 0.4 },
    note: (fx) => `Work and learning speed at full care, wildermon you keep: +${percent(fx['kept:care_bonus'])} `
      + `(base +${percent(CARE_BONUS)}); scales with care: +${percent(fx['kept:care_bonus'] / 2)} at half.`,
  },
  {
    num: 15, name: 'Healing Hands',
    fx: { 'groom:heal': 0.15 },
    note: (fx) => `Brushing heals ${percent(fx['groom:heal'])} of a wildermon's health (base ${percent(GROOM_HEAL)}).`,
  },
  {
    num: 16, name: 'Light Eaters',
    fx: { 'kept:hunger': 0.7 },
    note: (fx) => `Hunger rate ${cut(fx['kept:hunger'])}, wildermon you keep. Fed to empty: following you `
      + `${emptyIn('active', fx['kept:hunger'])} (base ${emptyIn('active', 1)}), working a settlement `
      + `${emptyIn('deed', fx['kept:hunger'])} (base ${emptyIn('deed', 1)}).`,
  },
  {
    num: 18, name: 'Long-lived',
    fx: { 'kept:old_at': OLD_AT * 25 / 15 },
    note: (fx) => `Old age at ${durationSaid(fx['kept:old_at'])}, wildermon you keep (base ${durationSaid(OLD_AT)}).`,
  },
  {
    num: 21, name: 'Short Rest',
    fx: { 'breed:rest': 0.5 },
    note: (fx) => `Breeding rest, pairs you put together: ${durationSaid(BREED_REST * fx['breed:rest'])} `
      + `(base ${durationSaid(BREED_REST)}); half that after a failed pairing (base ${durationSaid(BREED_REST / 2)}).`,
  },
  {
    num: 22, name: 'Quick Gestation',
    fx: { 'breed:gestation': 0.5 },
    note: (fx) => `Gestation, mothers you pair: ${durationSaid(GESTATION * fx['breed:gestation'])} (base ${durationSaid(GESTATION)}).`,
  },
  {
    num: 24, name: 'Twins',
    fx: { 'breed:twins': 0.2 },
    note: (fx) => `Twins chance: ${oneIn(fx['breed:twins'])} pairings. The second young is bred separately from the pair.`,
  },
  {
    num: 25, name: 'True Blood',
    fx: { 'breed:inherit': 0.1 },
    note: (fx) => `Chance each of a young's ${TRAIT_SLOTS} traits is drawn from its parents' blood: +${points(fx['breed:inherit'])} `
      + `(base ${percent(inheritChance(0, 0))}, +${Number(((inheritChance(100, 0) - inheritChance(0, 0)) / 100 * 100).toFixed(2))} `
      + `percentage points per husbandry level, up to +${points(inheritChance(0, 1) - inheritChance(0, 0))} for care, `
      + `max ${percent(inheritChance(100, 1))}). Max certain.`,
  },
  {
    num: 26, name: 'Bred Up',
    fx: { 'breed:upgrade': 0.1 },
    note: (fx) => `Chance each of a young's traits comes out one rarity higher: +${points(fx['breed:upgrade'])} (base `
      + `+${Number((upgradeChance(100, 0) / 100 * 100).toFixed(2))} percentage points per husbandry level, up to `
      + `+${points(upgradeChance(0, 1))} for care, max ${percent(upgradeChance(100, 1))}).`,
  },
  {
    num: 28, name: 'Choose the Sex',
    fx: { 'breed:sex': 1 },
    note: () => 'Pairing: choose male or female young, twins included (base: even odds).',
  },
  {
    num: 37, name: 'Light Crate',
    fx: { 'weight:creature_crate': 0.3 },
    note: (fx) => `${capital(itemName('creature_crate'))} weight: ${kgSaid(CRATE_KG * fx['weight:creature_crate'])} (base ${kgSaid(CRATE_KG)}).`,
  },
  {
    num: 50, name: 'Stud Book',
    fx: { stud_book: 1 },
    note: () => 'Examine on one of yours shows, for its mate: pairing success chance, and per trait the chance it is drawn '
      + 'from their blood and the chance it comes out one rarity higher.',
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Naturalist: foraging and botanizing, alchemy and first aid.
 * ---------------------------------------------------------------------------
 */
const DYE_BOILS = RECIPES.filter((r) => r.result === DYE_BUCKET);
const ALCHEMY = RECIPES.filter((r) => r.skill === 'alchemy' && r.difficulty !== undefined);
const COVER = recipeOf('make_cover_thyme');
const TEA = recipeOf('brew_tea_thyme');
const SALVE = recipeOf('make_salve_thyme');
const TINCTURE = recipeOf('make_tincture_thyme');
/** "two of one herb", from a recipe whose first input is the herb. */
const ofOneHerb = (r: Recipe): string => `${r.inputs[0].count ?? 1} of one herb`;

const NATURALIST: Seed[] = [
  {
    num: 2, name: 'Keen Eye',
    fx: { 'passes:forage': 1, 'passes:botanize': 1 },
    note: (fx) => `Foraging and botanizing looks per action +${fx['passes:forage']} `
      + `(base one, one more per ${PER_ROLL} skill).`,
  },
  {
    num: 3, name: 'Sure Find',
    fx: { 'empty:forage': 0, 'empty:botanize': 0 },
    note: () => `Foraging and botanizing: no empty look by chance (base ${oneIn(EMPTY_CHANCE)}, `
      + 'before the skill check).',
  },
  {
    num: 10, name: 'Hay Cutter',
    fx: { 'count:mixed_grass': 3 },
    note: (fx) => `Cut grass: ${fx['count:mixed_grass']} bundles (base ${GRASS_PER_CUT}).`,
  },
  {
    num: 11, name: 'Reed Cutter',
    fx: { 'count:reed': 3 },
    note: (fx) => `Cut reeds: always ${fx['count:reed']} (base ${REED_CUT}, one more on a foraging check against `
      + `${REED_EXTRA_AT}).`,
  },
  {
    num: 12, name: 'Rare Find',
    fx: { 'rare:forage': RARITY_ODDS[0], 'rare:botanize': RARITY_ODDS[0] },
    note: (fx) => `Rare chance on foraging and botanizing finds: ${oneIn(fx['rare:forage'])} (base: none). Supreme and fantastic `
      + 'at usual odds.',
  },
  {
    num: 13, name: 'Quick Lye',
    fx: { 'time:make_lye': 0.6 },
    note: (fx) => `${capital(recipeOf('make_lye').verb)} time ${cut(fx['time:make_lye'])} (base ${secs(base('make_lye'))}).`,
  },
  {
    num: 15, name: 'Double Boil',
    // Litres of dye a kilo of dyestuff makes, which is the weight a boil takes for the lye in its bucket.
    fx: { 'litres:dye': 2 * DYE_LITRES_PER_KG },
    note: (fx) => `Dye per kg of dyestuff: ${fx['litres:dye']} litres (base ${DYE_LITRES_PER_KG}). Dyestuff per boil ${mul(DYE_LITRES_PER_KG / fx['litres:dye'])}: `
      + `${dyeKg(dyeGrams(BUCKET_LITRES, fx['litres:dye']))} kg for a ${BUCKET_LITRES}-litre bucket of lye `
      + `(base ${dyeKg(dyeGrams(BUCKET_LITRES, DYE_LITRES_PER_KG))} kg). Output unchanged: ${BUCKET_LITRES} litres.`,
  },
  {
    num: 16, name: 'Thrifty Dyer',
    fx: onEach('need', DYE_BOILS.map((r) => r.id), 0.75),
    note: (fx) => `Dyestuff per boil ${mul(fx[`need:${DYE_BOILS[0].id}`])}: `
      + `${dyeKg(dyeGrams(BUCKET_LITRES, DYE_LITRES_PER_KG, fx[`need:${DYE_BOILS[0].id}`]))} kg for a ${BUCKET_LITRES}-litre bucket of lye `
      + `(base ${dyeKg(dyeGrams(BUCKET_LITRES, DYE_LITRES_PER_KG))} kg). Lye unchanged: one bucket.`,
  },
  {
    num: 17, name: 'Sure Boil',
    fx: onEach('fail', ALCHEMY.map((r) => r.id), 0.5),
    note: (fx) => `Alchemy failure chance ${mul(fx[`fail:${ALCHEMY[0].id}`])} (base: check at difficulty `
      + `${range(ALCHEMY.map((r) => r.difficulty ?? 0))}).`,
  },
  {
    num: 19, name: 'Ink Maker',
    fx: { 'count:ink': 4 },
    note: (fx) => `${capital(recipeOf('make_ink').verb)} output: ${fx['count:ink']} (base ${recipeOf('make_ink').count ?? 1}).`,
  },
  {
    num: 23, name: 'Quick Dressing',
    fx: { 'time:bind_wound': 0.6 },
    note: (fx) => `Dressing time ${cut(fx['time:bind_wound'])} (base ${secs(base('bind_wound'))}).`,
  },
  {
    num: 24, name: 'Sure Hands',
    fx: { 'fail:bind_wound': 0.5 },
    note: (fx) => `Dressing slip chance ${mul(fx['fail:bind_wound'])} (base: check at difficulty ${DRESS_CHECK}).`,
  },
  {
    num: 29, name: 'Quick Mend',
    fx: { 'mend:bind_wound': 1.5 },
    note: (fx) => `Wound closing speed ${more(fx['mend:bind_wound'])} under your dressing, anyone's wound, until closed or cleaned out.`,
  },
  {
    num: 30, name: 'Cover Maker',
    fx: { 'count:cover': 5 },
    note: (fx) => `Healing covers from ${ofOneHerb(COVER)} and ${COVER.inputs[1].count ?? 1} cotton: ${fx['count:cover']} `
      + `(base ${COVER.count ?? 1}).`,
  },
  {
    num: 34, name: 'Field Medic',
    fx: { 'heal:others': 1.3 },
    note: (fx) => dressOthersNote(fx),
  },
  {
    num: 43, name: 'Herb Tea',
    fx: { herb_tea: 1 },
    note: () => `New recipe: ${ofOneHerb(TEA)} and a bucket of water make ${TEA.count ?? 1} cups of herb tea. `
      + `Per cup: stamina +${percent(ITEM_DEFS.herb_tea.stamina ?? 0)}.`,
  },
  {
    num: 44, name: 'Salve',
    fx: { salve: 1 },
    note: () => `New recipe: ${ofOneHerb(SALVE)} and ${SALVE.inputs[1].count ?? 1} beeswax make a salve. Applied over a `
      + `dressing: the wound never festers (base: ${percent(FESTER_CLOTH)} of the chance under cloth, ${percent(FESTER_WRONG)} `
      + 'with the wrong herb).',
  },
  {
    num: 50, name: 'Tincture',
    fx: { tincture: 1 },
    note: () => `New recipe: ${ofOneHerb(TINCTURE)} make a tincture. Effect: skill gain +${percent(TINCTURE_BONUS)} on ${TINCTURE_NAMES} `
      + `for ${durationSaid(TINCTURE_SECONDS)}, alongside any dish effect.`,
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Fisher: the rod, the net and the creel.
 * ---------------------------------------------------------------------------
 */
/** The fish that run in water a net mostly misses: trout and deeper. */
const BIG_FISH = FISH.filter((f) => f.depth >= 8);
const fishName = (id: string): string => itemName(id);
const POND = furnitureDef('fish_pond');
/** A share of bites where every fish runs and nothing is on the hook, with a Fisher's perks or without. */
const bigShare = (fx: Fx): number => BIG_FISH.reduce((n, f) => n + biteShare(f.id, undefined, (k, d) => fx[k] ?? d), 0);
const SMOKED = recipeOf('smoke_trout');

const FISHER: Seed[] = [
  {
    num: 1, name: 'Quick Cast',
    fx: { 'time:fish': 0.7 },
    note: (fx) => `Cast time ${cut(fx['time:fish'])} (base ${secs(base('fish'))}).`,
  },
  {
    num: 2, name: 'Long Cast',
    fx: { 'reach:fish': 6 },
    note: (fx) => `Cast range: ${fx['reach:fish']} tiles (base ${CAST}). Clicking further casts into `
      + `the deepest water within ${Math.floor(fx['reach:fish'])} tiles each way (base ${Math.floor(CAST)}).`,
  },
  {
    num: 3, name: 'Steady Hand',
    fx: { 'hook:fish': 0.15 },
    note: (fx) => `Hook chance on a bite +${points(fx['hook:fish'])}, after all other factors `
      + `(max ${percent(HOOK_MOST)}).`,
  },
  {
    num: 4, name: 'Bait Saver',
    fx: { 'spare:fish': 1 },
    note: (fx) => `Bait kept when a fish gets away${fx['spare:fish'] >= 1 ? '' : `: ${percent(fx['spare:fish'])} of the time`}; `
      + 'bait used only on a landed fish (base: every baited cast).',
  },
  {
    num: 5, name: 'Strong Bait',
    fx: { 'bait:pull': 2 },
    note: (fx) => `Bait pull ${mul(fx['bait:pull'])}, on the hook and in creels you set: `
      + `${BAIT_PULL * fx['bait:pull']}× plain weight for its first favoured fish, ${(BAIT_PULL * fx['bait:pull']) / 2}× for the `
      + `second (base ${BAIT_PULL}× and ${BAIT_PULL / 2}×).`,
  },
  {
    num: 6, name: 'Any Bait',
    fx: { 'bait:food': 1 },
    note: () => 'With no fish bait in your pack, any food works as bait on the hook or in a creel: draws every fish at '
      + `plain weight, hook chance +${points(HOOK_BAIT)} as any bait (base: only `
      + `${either(BAITS.map((b) => itemName(b.id)))}).`,
  },
  {
    num: 9, name: 'Big Fish',
    fx: onEach('bite', BIG_FISH.map((f) => f.id), 2),
    note: (fx) => `Bite weight ${mul(fx[`bite:${BIG_FISH[0].id}`])}: ${listed(BIG_FISH.map((f) => fishName(f.id)))}, `
      + `on your rod, your net and creels you set. With every fish present and no bait: `
      + `${percent(bigShare(fx))} of bites (base ${percent(bigShare({}))}).`,
  },
  {
    num: 12, name: 'Rare Catch',
    fx: { 'rare:fish': RARITY_ODDS[0], 'rare:drag_net': RARITY_ODDS[0] },
    note: (fx) => `Rare chance on fish landed by rod or net: ${oneIn(fx['rare:fish'])} (base: none). Supreme and fantastic `
      + 'at usual odds.',
  },
  {
    num: 13, name: 'Quick Net',
    fx: { 'time:drag_net': 0.7 },
    note: (fx) => `Drag net time ${cut(fx['time:drag_net'])} (base ${secs(base('drag_net'))}).`,
  },
  {
    num: 14, name: 'Full Net',
    fx: { 'haul:drag_net': 2 },
    note: (fx) => `Net haul +${fx['haul:drag_net']} fish: ${NET_LEAST + fx['haul:drag_net']} to `
      + `${NET_HAUL + fx['haul:drag_net']} by net QL (base ${NET_LEAST} to ${NET_HAUL}), before the maker's bonus.`,
  },
  {
    num: 15, name: 'Wide Net',
    fx: { 'reach:drag_net': 4 },
    note: (fx) => `Net range: ${fx['reach:drag_net']} tiles (base ${NET_REACH}). Clicking further drags `
      + `the deepest water within ${Math.floor(fx['reach:drag_net'])} tiles each way (base ${Math.floor(NET_REACH)}).`,
  },
  {
    num: 17, name: 'Net Care',
    fx: { 'wear:fishing_net': 0.5 },
    note: (fx) => `Fishing net damage per drag ${mul(fx['wear:fishing_net'])}, any quality.`,
  },
  {
    num: 19, name: 'Deep Creel',
    fx: { 'hold:creel': 2 },
    note: (fx) => `Creel capacity, creels you make: ${Math.round((TRAPS.creel.hold ?? 0) * fx['hold:creel'])} fish `
      + `(base ${TRAPS.creel.hold}).`,
  },
  {
    num: 25, name: 'Cool Pack',
    fx: onEach('cool', FISH.map((f) => f.id), 0.5),
    note: (fx) => `Rot rate on the ground ${cut(fx[`cool:${FISH[0].id}`])}: ${listed(FISH.map((f) => fishName(f.id)))} you drop, `
      + 'until picked up. Nothing rots in a pack.',
  },
  {
    num: 27, name: 'Smoke Fish',
    fx: { smoke_fish: 1, ...onEach('rot', FISH.map((f) => f.id), 0.2) },
    note: (fx) => `New recipe: smoke a fish over a lit campfire, on fishing, at the fish's QL. Rot rate `
      + `${cut(fx[`rot:${SMOKED.result}`])} anywhere: keeps ${mul(1 / fx[`rot:${SMOKED.result}`])} as long.`,
  },
  {
    num: 33, name: 'Rod Care',
    fx: { 'wear:fishing_rod': 0.5 },
    note: (fx) => `Fishing rod damage per cast ${mul(fx['wear:fishing_rod'])}, any quality and wood.`,
  },
  {
    num: 45, name: 'Fishing Journal',
    fx: { fish_journal: 1 },
    note: () => 'Examine water also shows: depth, each landable fish\'s % of bites with your bait, '
      + 'and your rod\'s hook chance.',
  },
  {
    num: 47, name: 'Fish Pond',
    fx: { fish_pond: 1 },
    note: () => `New build: ${POND.name.toLowerCase()} (${billWords(POND.bill, true)}, ${itemName(POND.tool ?? 'shovel')}), `
      + `on your settlement. Restock time per fish: ${durationSaid(POND_EVERY)}, max ${POND.pond} fish, `
      + 'every fish at plain weight.',
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Mender: the repair bench, the tool kit and the restorer's table.
 * ---------------------------------------------------------------------------
 */
/**
 * The skill a trade's perk is first offered at, by the number it was picked
 * under: where its tier opens. Read when the notes are written, after `TIERS`.
 */
const offeredAt = (cls: string, num: number): number => PERK_TIER_AT[Math.max(0, (TIERS[cls] ?? []).findIndex((row) => row.includes(num)))];
/** Every tool a job or a recipe wears that there is, and the brush, which grooming wears by hand. */
const WORN_TOOLS = [...TOOLS, 'brush'].filter((id) => ITEM_DEFS[id]).sort();
const TRAP_KINDS = Object.keys(TRAPS);
const KIT = recipeOf('make_repair_kit');
const SEALANT = recipeOf('make_sealant');
/** What goes into a recipe, counted: "two cloth, two nails and one plank". */
const counted = (r: Recipe): string =>
  listed(r.inputs.map((i) => countOf(i.item, i.count ?? 1, true)));
/** "4.8", the damage a go of Repair takes out at this skill, times a perk's. */
const healedAt = (skill: number, m = 1): string => tenth(repairGo(skill).healed * m);
/** "0.0092", the quality a point of damage taken out costs at this skill, times a perk's. */
const costAt = (skill: number, m = 1): string => `${Number((repairGo(skill).cost * m).toFixed(4))}`;
/** "a minor one major and a major one ancient": what each tier of bauble comes out as a tier up. */
const tiersUp = (): string =>
  BAUBLE_TIERS.slice(0, -1).map((t, i) => `${t.id} → ${BAUBLE_TIERS[i + 1].id}`).join(', ');

const MENDER: Seed[] = [
  {
    num: 1, name: 'Big Mend',
    fx: { 'mend:repair_item': 1.5 },
    note: (fx) => `Damage removed per Repair action ${more(fx['mend:repair_item'])}, same QL cost per point: `
      + `${healedAt(offeredAt('mender', 1), fx['mend:repair_item'])} at repair ${offeredAt('mender', 1)} (base ${healedAt(offeredAt('mender', 1))}).`,
  },
  {
    num: 2, name: 'Light Touch',
    fx: { 'cost:repair_item': 0.5 },
    note: (fx) => `Repair QL cost per damage point ${mul(fx['cost:repair_item'])}: `
      + `${costAt(offeredAt('mender', 2), fx['cost:repair_item'])} QL at repair ${offeredAt('mender', 2)} (base ${costAt(offeredAt('mender', 2))}).`,
  },
  {
    num: 3, name: 'Clean Repair',
    fx: { 'keep:repair_item': 0.25 },
    note: (fx) => `Repair costs no QL: ${oneIn(fx['keep:repair_item'])} actions.`,
  },
  {
    num: 4, name: 'Quick Hands',
    fx: { 'time:repair_item': 0.6 },
    note: (fx) => `Repair time ${cut(fx['time:repair_item'])}: ${secs(goSeconds(base('repair_item')) * fx['time:repair_item'])} `
      + `(base ${secs(goSeconds(base('repair_item')))}, the minimum for any action without a perk).`,
  },
  {
    num: 9, name: 'Tool Care',
    fx: onEach('wear', WORN_TOOLS, 0.75),
    note: (fx) => `Tool damage per use ${cut(fx[`wear:${WORN_TOOLS[0]}`])}: every tool, any action and material.`,
  },
  {
    num: 10, name: 'Armour Care',
    fx: { 'worn:armour': 0.75, 'worn:shield': 0.75, 'worn:weapon': 0.75 },
    note: (fx) => `Damage to your gear ${cut(fx['worn:armour'])}: armour per blow taken, shield `
      + `${cut(fx['worn:shield'])} per blow blocked, weapon ${cut(fx['worn:weapon'])} per blow or arrow landed.`,
  },
  {
    num: 14, name: 'Post Keeper',
    fx: onEach('life', ['work_post', ...TRAP_KINDS], 1.5),
    note: (fx) => `Duration ${more(fx['life:work_post'])}: work posts, ${listed(TRAP_KINDS.map((k) => plural(TRAPS[k as keyof typeof TRAPS].name.toLowerCase())))} you set. `
      + `Work post ${durationSaid(POST_LIFE_MIN * fx['life:work_post'])} to `
      + `${durationSaid(POST_LIFE_MAX * fx['life:work_post'])} by QL (base ${durationSaid(POST_LIFE_MIN)} to ${durationSaid(POST_LIFE_MAX)}).`,
  },
  {
    num: 17, name: 'Quick Restore',
    fx: { 'time:restore_relic': 0.6 },
    note: (fx) => `Relic and bauble restoring time ${cut(fx['time:restore_relic'])} (base ${secs(base('restore_relic'))}).`,
  },
  {
    num: 18, name: 'Sure Restore',
    fx: { 'fail:restore_relic': 0.5 },
    note: (fx) => `Relic and bauble restoring failure chance ${mul(fx['fail:restore_relic'])}.`,
  },
  {
    num: 19, name: 'Gentle Hands',
    fx: { 'harm:restore_relic': 0 },
    note: (fx) => `Damage from a failed restoring: ${fx['harm:restore_relic'] <= 0 ? 'none' : cut(fx['harm:restore_relic'])} `
      + `(base ${RESTORE_HARM} to ${RESTORE_HARM + RESTORE_HARM_SPREAD} to each piece or the bauble).`,
  },
  {
    num: 20, name: 'Fine Restore',
    fx: { 'ql:restore_relic': 1.1 },
    note: (fx) => `Restored relic and bauble QL ${more(fx['ql:restore_relic'])}, max ${QL_TOP}.`,
  },
  {
    num: 21, name: 'Age Undone',
    fx: { 'age:restore_relic': 0 },
    note: (fx) => `QL lost to damage on the pieces or bauble when restoring: ${fx['age:restore_relic'] <= 0 ? 'none' : cut(fx['age:restore_relic'])} `
      + `(base ${percent(1 / RESTORE_AGE)} per damage point).`,
  },
  {
    num: 24, name: 'Lucky Polish',
    fx: { 'rare:restore_relic': 2 * RARITY_ODDS[0] },
    note: (fx) => `Rare chance on baubles you restore: ${oneIn(fx['rare:restore_relic'])} (base ${oneIn(RARITY_ODDS[0])}). Supreme and fantastic `
      + 'at usual odds.',
  },
  {
    num: 25, name: 'Second Look',
    fx: { 'rolls:bauble': 2 },
    note: (fx) => `Minor and major baubles you restore: strength drawn ${fx['rolls:bauble']} times, best kept `
      + `(each draw ${BAUBLE_LOW}–${BAUBLE_HIGH}% before rarity). Ancient baubles unchanged.`,
  },
  {
    num: 26, name: 'Grade Up', key: 'tier_up',
    fx: { 'tier:restore_relic': 0.1 },
    note: (fx) => `Baubles you restore come out one grade higher: ${oneIn(fx['tier:restore_relic'])} (${tiersUp()}).`,
  },
  {
    num: 27, name: 'Handyman',
    fx: { 'floor:improve': 30 },
    note: (fx) => `Improve anything to QL ${fx['floor:improve']} regardless of skill (base ${IMPROVE_FLOOR}); above that, `
      + 'skill is the cap.',
  },
  {
    num: 42, name: 'Repair Kit',
    fx: { repair_kit: 1 },
    note: () => `New recipe, on repair: ${counted(KIT)} with a ${itemName(KIT.tool ?? 'hammer')} make a repair kit. `
      + `Per use: −${KIT_MEND} damage on any item, anywhere, no QL loss. Usable by anyone.`,
  },
  {
    num: 50, name: 'Sealant',
    fx: { sealant: 1 },
    note: () => `New recipe, on repair: ${counted(SEALANT)} make sealant. Applied item never decays, `
      + 'anywhere: one per item, one per item in a pile. Usable by anyone.',
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Artisan: the jeweller's file, the potter's hands and the binder's needle.
 * ---------------------------------------------------------------------------
 */
/** The recipes a stone is set by: in a ring, a pendant or a focus. */
const SETTINGS = ['set_ring', 'set_pendant', 'set_focus'];
/** What a stone is set in to be worn. */
const JEWELS = ['jewelled_ring', 'jewelled_pendant', 'circlet'];
/** The dishes a recipe makes in one of these, as the recipes have them. */
const madeIn = (tools: readonly string[]): string[] =>
  [...new Set(RECIPES.filter((r) => r.tool && tools.includes(r.tool) && isDish(r.result)).map((r) => itemName(r.result)))];
const POT_DISHES = madeIn(['clay_pot', 'clay_bowl']);
const PUT_UP = madeIn(['clay_jar']);
const MORE_STONES = GEMS.filter((g) => g.perk === 'more_stones');
const CIRCLET_MAKE = recipeOf('make_circlet');
const AMPHORA_SHAPE = recipeOf('make_amphora');
const TRADE_BOOK = recipeOf(`write_trade_book_${TRADE_BOOK_SKILLS[0]}`);
const WHEEL = furnitureDef('potters_wheel');
/** "a clay pot, a clay bowl, a clay jar or an amphora". */
const GLAZE_ON = either([...GLAZEABLE].map((id) => `${article(itemName(id))} ${itemName(id)}`));

const ARTISAN: Seed[] = [
  {
    num: 2, name: 'Sure Setting',
    fx: onEach('fail', [...SETTINGS, 'set_in_circlet'], 0.5),
    note: (fx) => `Stone setting failure chance ${mul(fx['fail:set_ring'])}: ring, pendant, focus and circlet.`,
  },
  {
    num: 3, name: 'Keep the Stone',
    fx: { 'stone:set_focus': 1 },
    note: () => 'Failed focus setting: stone returned whole, only the silver lost (base: stone splits).',
  },
  {
    num: 26, name: 'Deep Pot',
    fx: { 'serve:unfired_clay_pot': 1, 'serve:unfired_clay_bowl': 1 },
    note: (fx) => `Servings +${fx['serve:unfired_clay_pot']} on every dish cooked in a pot or bowl you shape, `
      + `by anyone: ${listed(POT_DISHES)}.`,
  },
  {
    num: 7, name: 'Cut True',
    fx: onEach('cut', JEWELS, 0.05),
    note: (fx) => `Rings, pendants and circlets you make: skill gain on each stone's skill up to +${percent(fx['cut:jewelled_ring'])}, `
      + `by QL: full at QL ${QL_TOP}, half at QL ${QL_TOP / 2} (base: QL has no effect). `
      + `Circlet stones give ${percent(CIRCLET_SHARE)} of it.`,
  },
  {
    num: 9, name: 'Fine Castings',
    fx: { 'ql:ring': 1.1, 'ql:pendant': 1.1 },
    note: (fx) => `QL ${more(fx['ql:ring'])} on rings and pendants you forge from a casting, max ${QL_TOP}.`,
  },
  {
    num: 10, name: 'Gem Finder', key: 'gem_eye',
    fx: { 'gem:mine': 1 / 300 },
    note: (fx) => `Gem chance per Mine: ${oneIn(fx['gem:mine'])} (base ${oneIn(GEM_ODDS)}).`,
  },
  {
    num: 13, name: 'Focus Cutter',
    fx: { 'thrift:focus': 0.75 },
    note: (fx) => `Focus wear per cast ${cut(fx['thrift:focus'])} on foci you set, any caster.`,
  },
  {
    num: 27, name: 'Sealed Jar',
    fx: { 'keeps:unfired_clay_jar': 0.5 },
    note: (fx) => `Keeping time ${mul(1 / fx['keeps:unfired_clay_jar'])} for food put up in a jar you shape, by anyone: `
      + `${listed(PUT_UP)}.`,
  },
  {
    num: 35, name: 'Sturdy Binding',
    fx: onEach('sturdy', ['book', 'trade_book'], 0.5),
    note: (fx) => `Study damage ${mul(fx['sturdy:book'])} on books you bind (base ${STUDY_WEAR} to `
      + `${STUDY_WEAR + STUDY_WEAR_SPREAD} per action).`,
  },
  {
    num: 4, name: 'Bright Stone',
    fx: onEach('bright', JEWELS, 1.5),
    note: (fx) => `Skill gain on the stone's skill: rings and pendants you make +${percent(JEWEL_BONUS * fx['bright:jewelled_ring'])} `
      + `(base +${percent(JEWEL_BONUS)}); each stone in a circlet you make `
      + `+${percent(JEWEL_BONUS * CIRCLET_SHARE * fx['bright:circlet'])} (base +${percent(JEWEL_BONUS * CIRCLET_SHARE)}).`,
  },
  {
    num: 14, name: 'Keen Focus',
    fx: { 'force:focus': 1.1 },
    note: (fx) => `Spell strength ${more(fx['force:focus'])} and hold duration ${more(fx['force:focus'])} from foci you set, `
      + 'any caster.',
  },
  {
    num: 34, name: 'Good Read',
    fx: onEach('teach', ['book', 'trade_book'], 1.25),
    note: (fx) => `Study skill gain ${more(fx['teach:book'])} from books you bind, any reader.`,
  },
  {
    num: 12, name: 'More Stones',
    fx: { more_stones: 1 },
    note: () => `Mining can find ${MORE_STONES.length} more stones, only for you: `
      + `${listed(MORE_STONES.map((g) => `${g.name.toLowerCase()} (${tradeName(g.skill)})`))}. `
      + 'Set and worn like any other stone.',
  },
  {
    num: 46, name: 'Amphora',
    fx: { amphora: 1 },
    note: () => `New pottery recipe: ${counted(AMPHORA_SHAPE)} make an unfired amphora; fire it in a kiln. Holds `
      + `${ITEM_DEFS.amphora?.holds} of one food or drink. Rot rate when left out ${mul(ITEM_DEFS.amphora?.shelter ?? 1)}. `
      + 'Usable by anyone.',
  },
  {
    num: 49, name: "Potter's Wheel",
    fx: { potters_wheel: 1 },
    note: () => `New build: potter's wheel (${billWords(WHEEL.bill, true)}). Pottery time ${cut(WHEEL.pace?.by ?? 1)} within `
      + `${WHEEL.pace?.reach} tiles, for anyone, on top of other bonuses.`,
  },
  {
    num: 28, name: 'Glaze',
    fx: { glaze_item: 1 },
    note: () => `New action: Glaze it, on ${GLAZE_ON}. Cost: ${GLAZE_ASH} ${GLAZE_ASH === 1 ? 'lot' : 'lots'} of ashes. `
      + 'Glazed item never decays, anywhere.',
  },
  {
    num: 36, name: 'Trade Book',
    fx: { trade_book: 1 },
    note: () => `New papyrusmaking recipe: ${counted(TRADE_BOOK)} with a ${itemName(TRADE_BOOK.tool ?? 'needle')} make a `
      + `book on any crafting skill you have at ${TRADE_BOOK_AT}+. Study teaches that skill, as much per action as a plain book `
      + 'teaches mind logic. Readable by anyone.',
  },
  {
    num: 48, name: 'Circlet',
    fx: { circlet: 1 },
    note: () => `New jewellery recipe: ${counted(CIRCLET_MAKE)} with a ${itemName(CIRCLET_MAKE.tool ?? 'file')} make a `
      + `circlet (head slot, replaces a helm). Holds ${CIRCLET_STONES} stones, set by anyone from the stone's `
      + `menu; each gives ${percent(CIRCLET_SHARE)} of a ring's bonus: +${percent(JEWEL_BONUS * CIRCLET_SHARE)} skill gain `
      + 'on its skill.',
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Sworn Blade: swords, shields and chain armour.
 *
 * Twelve spells and six passives, picked from fifty and thirty. A spell's
 * numbers are in `talents.ts`, and its perk here is what puts it among the
 * spells you know, so it has nothing to fold. The passives were offered under
 * their own numbers, one to thirty; they are a hundred on from those here, so
 * that no passive shares a number with a spell.
 * ---------------------------------------------------------------------------
 */
const BLADE: Seed[] = [
  ...classSpellsOf('blade').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 108, name: 'Light Sword',
    fx: { 'wind:swords': 0.7 },
    note: (fx) => `Sword swing stamina ${cut(fx['wind:swords'])}.`,
  },
  {
    num: 111, name: 'Counterweight',
    fx: { 'stagger:block': 0.5 },
    note: (fx) => `Blocked blow: attacker's next blow delayed ${secs(fx['stagger:block'])}.`,
  },
  {
    num: 127, name: 'Battle-Hardened',
    fx: { 'severity:wound': 0.8 },
    note: (fx) => `Wound severity from blows on you ${cut(fx['severity:wound'])} (less bleeding and slowing). `
      + 'Health damage unchanged.',
  },
  {
    num: 123, name: 'Stalwart',
    fx: { 'stance:defensive_taken': 0.7, 'stance:defensive_dealt': 0.85 },
    note: (fx) => `Defensive stance: damage taken ${cut(fx['stance:defensive_taken'])}, dealt `
      + `${cut(fx['stance:defensive_dealt'])} (base ${cut(STANCE_TAKEN.defensive)} and ${cut(STANCE_DEALT.defensive)}).`,
  },
  {
    num: 129, name: 'Guardian',
    fx: { 'cover:share': 0.2 },
    note: (fx) => `With a shield in your off hand: ${percent(fx['cover:share'])} of creature blows on other players `
      + `or companions within ${GUARDIAN_REACH} tiles land on your shield instead, with no effect on them.`,
  },
  {
    num: 109, name: 'Shield Mastery',
    fx: { 'block:shield': 0.08, 'blockcap:shield': 0.7 },
    note: (fx) => `Shield block chance +${points(fx['block:shield'])}, max `
      + `${percent(fx['blockcap:shield'])} (base max ${percent(BLOCK_MOST)}).`,
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Berserker: axes and mauls, hitting harder for every risk taken. As the
 * Sworn Blade's, its spells have no numbers of their own here, and its
 * passives are a hundred on from the numbers they were offered under.
 * ---------------------------------------------------------------------------
 */
const BERSERKER: Seed[] = [
  ...classSpellsOf('berserker').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 101, name: 'Axe Mastery',
    fx: { 'dmg:axes': 1.1 },
    note: (fx) => `Axe damage ${more(fx['dmg:axes'])}.`,
  },
  {
    num: 106, name: 'Maul Mastery',
    fx: { 'dmg:mauls': 1.1 },
    note: (fx) => `Maul damage ${more(fx['dmg:mauls'])}.`,
  },
  {
    num: 125, name: 'Executioner',
    fx: { 'finish:below': 0.25, 'finish:dmg': 1.25 },
    note: (fx) => `Damage ${more(fx['finish:dmg'])} on creatures below ${percent(fx['finish:below'])} health.`,
  },
  {
    num: 112, name: 'Pain Fuels',
    fx: { 'pain:below': 0.5, 'pain:dmg': 1.15, 'pain:deep': 0.25, 'pain:deeper': 1.3 },
    note: (fx) => `Damage ${more(fx['pain:dmg'])} below ${percent(fx['pain:below'])} of your health, `
      + `${more(fx['pain:deeper'])} below ${percent(fx['pain:deep'])}.`,
  },
  {
    num: 130, name: 'Wild Strength',
    fx: { 'swing:two_handed': 0.9 },
    note: (fx) => `Swing time ${cut(fx['swing:two_handed'])} with a two-handed weapon.`,
  },
  {
    num: 113, name: 'Thirst for Blood',
    fx: { 'leech:blow': 0.01 },
    note: (fx) => `Health +${percent(fx['leech:blow'])} per blow landed on a creature.`,
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Pikeman: a spear's length, plate, and the ground between. As the other
 * fighting trades', its spells have no numbers of their own here, and its
 * passives are a hundred on from the numbers they were offered under.
 * ---------------------------------------------------------------------------
 */
/** Every kind of creature that is a monster, which is what a Monster Hunter's blows are harder on. */
const MONSTERS = Object.values(SPECIES).filter((sp) => sp.monster).map((sp) => sp.name.toLowerCase());
/** A length in tiles, to the hundredth: 3.7, not 3.7000000000000002. */
const tiles = (n: number): string => `${Number(n.toFixed(2))}`;
const SPEAR = WEAPON_BY_ID.get('spear');
if (!SPEAR) throw new Error('Long Reach is written for a spear, and there is no spear');
const PIKEMAN: Seed[] = [
  ...classSpellsOf('pikeman').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 129, name: 'Scarred',
    fx: { 'severity:new': 0.8 },
    note: (fx) => `Starting severity of new wounds on you ${cut(fx['severity:new'])} (less bleeding and slowing); `
      + 'deepening of open wounds and health damage unchanged.',
  },
  {
    num: 105, name: 'Light Haft',
    fx: { 'wind:polearms': 0.75 },
    note: (fx) => `Polearm swing stamina ${cut(fx['wind:polearms'])}.`,
  },
  {
    num: 121, name: 'Monster Hunter',
    fx: { 'monster:dmg': 1.15 },
    note: (fx) => `Blow and shot damage ${more(fx['monster:dmg'])} on monsters (${either(MONSTERS)}).`,
  },
  {
    num: 113, name: 'Bastion',
    fx: { 'still:taken': 0.85 },
    note: (fx) => `Damage taken ${cut(fx['still:taken'])} after standing still for ${secs(FIGHT_BACK_STILL)}.`,
  },
  {
    num: 102, name: 'Long Reach',
    fx: { 'length:polearms': 0.5 },
    note: (fx) => `Polearm reach +${tiles(fx['length:polearms'])} tiles: spear ${tiles(reachOf(SPEAR) + fx['length:polearms'])} `
      + `(base ${tiles(reachOf(SPEAR))}).`,
  },
  {
    num: 118, name: 'Reach Discipline',
    fx: { 'gap:dmg': 1.2 },
    note: (fx) => `Blow and shot damage ${more(fx['gap:dmg'])} on a creature inside your reach but outside its own `
      + `(${HUNT_REACH} tiles, ${THROW_REACH} for throwers).`,
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Archer: the bow, the eye and leather. As the other fighting trades',
 * its spells have no numbers of their own here, and its passives are a
 * hundred on from the numbers they were offered under.
 * ---------------------------------------------------------------------------
 */
/** Every bow there is, shortest reach first: what a Long Draw is measured on. */
const DRAWN = WEAPONS.filter((w) => w.ammo).sort((a, b) => (a.range ?? 0) - (b.range ?? 0));
const ARCHER: Seed[] = [
  ...classSpellsOf('archer').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 108, name: 'Arrow Saver',
    fx: { 'save:arrow': 0.25 },
    note: (fx) => `Arrow returned to your pack after hitting a creature: ${oneIn(fx['save:arrow'])}.`,
  },
  {
    num: 107, name: 'Close Quarters',
    fx: { 'closest:draw': 0.5 },
    note: (fx) => `Min draw distance: ${tiles(DRAW_CLOSEST * fx['closest:draw'])} tiles (base ${DRAW_CLOSEST}).`,
  },
  {
    num: 114, name: 'Ambush',
    fx: { 'ambush:dmg': 1.5 },
    note: (fx) => `Shot damage ${more(fx['ambush:dmg'])} on a creature not targeting you (unaware of you or after someone else).`,
  },
  {
    num: 124, name: 'Mobile Archer',
    fx: { 'pace:draw': 0.8 },
    note: (fx) => `Walk speed while drawing: ${percent(fx['pace:draw'])} (base ${percent(DRAW_WALK)}).`,
  },
  {
    num: 101, name: 'Bow Mastery',
    fx: { 'dmg:archery': 1.1 },
    note: (fx) => `Shot damage ${more(fx['dmg:archery'])}.`,
  },
  {
    num: 102, name: 'Long Draw',
    fx: { 'far:archery': 1.15 },
    note: (fx) => {
      const [near, far] = [DRAWN[0], DRAWN[DRAWN.length - 1]];
      return `Bow range ${more(fx['far:archery'])}: ${itemName(near.id)} ${tiles((near.range ?? 0) * fx['far:archery'])} tiles `
        + `(base ${near.range}), ${itemName(far.id)} ${tiles((far.range ?? 0) * fx['far:archery'])} (base ${far.range}).`;
    },
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Skirmisher: the thrown weapon, the knife and the feet. As the other
 * fighting trades', its spells have no numbers of their own here, and its
 * passives are a hundred on from the numbers they were offered under.
 * ---------------------------------------------------------------------------
 */
/** Every weapon that is thrown, shortest reach first: what a Long Arm is measured on. */
const THROWN = WEAPONS.filter((w) => w.thrown).sort((a, b) => reachOf(a) - reachOf(b));
const SKIRMISHER: Seed[] = [
  ...classSpellsOf('skirmisher').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 104, name: 'Light Throw',
    fx: { 'wind:throwing': 0.75 },
    note: (fx) => `Javelin and throwing axe swing stamina ${cut(fx['wind:throwing'])}.`,
  },
  {
    num: 107, name: 'Keen Edge',
    fx: { 'crit:throwing': 0.04 },
    note: (fx) => `Javelin and throwing axe critical chance +${points(fx['crit:throwing'])}.`,
  },
  {
    num: 112, name: 'Lethal',
    fx: { 'crithit:knives': 2.25 },
    note: (fx) => `Knife critical damage: ×${fx['crithit:knives']} (base ×${CRIT_HIT}).`,
  },
  {
    num: 110, name: 'Long Bleed',
    fx: { 'bleed:secs': 1.5 },
    note: (fx) => `Bleed duration: ${secs(KNIFE_BLEED_SECS * fx['bleed:secs'])} (base ${secs(KNIFE_BLEED_SECS)}): `
      + 'knife, broadhead arrow and Gut Throw.',
  },
  {
    num: 120, name: 'Riposte',
    fx: { 'riposte:blow': 0.5 },
    note: (fx) => `Dodged creature blow: counter-blow at ${percent(fx['riposte:blow'])} of a swing with what you hold, `
      + 'if within your reach.',
  },
  {
    num: 102, name: 'Long Arm',
    fx: { 'length:throwing': 1 },
    note: (fx) => {
      const by = fx['length:throwing'];
      return `Javelin and throwing axe reach +${tiles(by)} ${by === 1 ? 'tile' : 'tiles'}: `
        + THROWN.map((w) => `${itemName(w.id)} ${tiles(reachOf(w) + by)} (base ${tiles(reachOf(w))})`).join(', ') + '.';
    },
  },
];

/*
 * ---------------------------------------------------------------------------
 * The Chirurgeon: the dressing, the wound and cloth. As the other fighting
 * trades', its spells have no numbers of their own here, and its passives are
 * a hundred on from the numbers they were offered under.
 * ---------------------------------------------------------------------------
 */
const CHIRURGEON: Seed[] = [
  ...classSpellsOf('chirurgeon').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 101, name: 'Field Surgeon',
    fx: { 'heal:others': 1.3 },
    note: (fx) => dressOthersNote(fx),
  },
  {
    num: 105, name: 'Quick Bandage',
    fx: { 'time:bind_wound': 0.7 },
    note: (fx) => `Dressing time ${cut(fx['time:bind_wound'])}: ${secs(base('bind_wound') * fx['time:bind_wound'])} `
      + `(base ${secs(base('bind_wound'))}).`,
  },
  {
    num: 104, name: 'Clean Cloth',
    fx: { 'fester:bind_wound': 0.5 },
    note: (fx) => `Fester chance under your dressing ${mul(fx['fester:bind_wound'])}, anyone's wound.`,
  },
  {
    num: 122, name: 'Bedside Manner',
    fx: { 'stamina:bind_wound': 0.1 },
    note: (fx) => `Your dressing restores +${percent(fx['stamina:bind_wound'])} stamina to its wearer.`,
  },
  {
    num: 106, name: 'Sure Dressing',
    fx: { 'fail:bind_wound': 0 },
    note: () => `Your dressings never slip (base: check at difficulty ${DRESS_CHECK}).`,
  },
  {
    num: 123, name: 'Triage Instinct',
    fx: { 'triage:below': 0.3, 'triage:heal': 1.5 },
    note: (fx) => `Dressing health restored ${more(fx['triage:heal'])} on a target below ${percent(fx['triage:below'])} health.`,
  },
];

/*
 * The Beastmaster's. Its spells, and six passives on the companion following
 * you: what it can take, how it runs and strikes, how far it fights from you,
 * and a share of what lands on you. A beast you keep wears its keeper's
 * `kept:` numbers (`kept_of`), and these four read only while it follows you.
 */
const BEASTMASTER: Seed[] = [
  ...classSpellsOf('beastmaster').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 106, name: 'Fleet',
    fx: { 'kept:speed': 1.3 },
    note: (fx) => `Companion speed ${more(fx['kept:speed'])}.`,
  },
  {
    num: 120, name: 'Long Leash',
    fx: { 'leash:companion': 14, 'sight:companion': 8 },
    note: (fx) => `Companion fight range from you: ${fx['leash:companion']} tiles (base ${COMPANION_LEASH}). `
      + `Guarding or aggressive engage range: ${fx['sight:companion']} tiles (base ${COMPANION_SIGHT}).`,
  },
  {
    num: 101, name: 'Thick Hide',
    fx: { 'kept:hardy': 1.2 },
    note: (fx) => `Companion max health ${more(fx['kept:hardy'])}.`,
  },
  {
    num: 102, name: 'Hardy Stock',
    fx: { 'kept:soak': 0.85 },
    note: (fx) => `Companion damage taken ${cut(fx['kept:soak'])}.`,
  },
  {
    num: 108, name: 'Quick Paws',
    fx: { 'kept:haste': 1.15 },
    note: (fx) => `Companion attack rate ${more(fx['kept:haste'])}: every `
      + `${Number((COMPANION_BLOW / fx['kept:haste']).toFixed(2))} s (base ${secs(COMPANION_BLOW)}).`,
  },
  {
    num: 119, name: 'Shared Wounds',
    fx: { 'bond:share': 0.2, 'bond:reach': 4 },
    note: (fx) => `Companion within ${fx['bond:reach']} tiles takes ${percent(fx['bond:share'])} of every `
      + 'blow on you instead.',
  },
];

/*
 * The Kindler's. Its spells, and six passives on what it casts and what it
 * starts burning: a creature that strikes you set alight, spells that cost
 * less, fire that grows as you keep casting, burns that last longer and take
 * more, and less from whatever is burning. A burn is a bleed a Kindler
 * started (`class_burn`), and "your fire" is what its spells deal.
 */
const KINDLER: Seed[] = [
  ...classSpellsOf('kindler').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 125, name: 'Burning Retort',
    fx: { 'retort:each': 0.01, 'retort:secs': 3 },
    note: (fx) => `Creature that hits you: burn ${percent(fx['retort:each'])} of its max health per second for `
      + `${secs(fx['retort:secs'])}, as your burn. Burns never take the last of its health.`,
  },
  {
    num: 118, name: 'Deep Breath',
    fx: { 'cast:cost': 0.8 },
    note: (fx) => `Spell stamina cost ${cut(fx['cast:cost'])}.`,
  },
  {
    num: 106, name: 'Blaze Momentum',
    fx: { 'momentum:step': 0.1, 'momentum:most': 0.3, 'momentum:secs': 5 },
    note: (fx) => `Fire damage +${percent(fx['momentum:step'])} per spell cast, max `
      + `+${percent(fx['momentum:most'])}; resets after ${secs(fx['momentum:secs'])} without a cast. Not on the spell that `
      + 'adds it.',
  },
  {
    num: 109, name: 'Lingering Burn',
    fx: { 'burn:secs': 1.5 },
    note: (fx) => `Burn duration ${more(fx['burn:secs'])}.`,
  },
  {
    num: 124, name: 'Flame Ward',
    fx: { 'ward:burning': 0.7 },
    note: (fx) => `Damage taken from burning creatures ${cut(fx['ward:burning'])}.`,
  },
  {
    num: 108, name: 'Searing Burn',
    fx: { 'burn:rate': 1.5 },
    note: (fx) => `Burn damage per second ${more(fx['burn:rate'])}.`,
  },
];

/*
 * The Binder's. Its spells, and six passives on what it holds and what holds
 * it back: a further reach, a slow after a hold, longer holds, a held
 * creature taking more, less taken standing still, and less from a creature
 * that is held, rooted or slowed. A hold is a Snare's share out of the focus
 * (`talents.ts`), and Unmoved is the rule a Pikeman's Bastion already is.
 */
/** The Binder's spells that hold, which its passives on a hold change; a Snare out of the school is not one of them. */
const BINDER_HOLDS = classSpellsOf('binder').filter((sp) => 'hold' in sp.fx).map((sp) => sp.name);
const BINDER: Seed[] = [
  ...classSpellsOf('binder').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 108, name: 'Far Reach',
    fx: { 'reach:spell': 3 },
    note: (fx) => `Range +${fx['reach:spell']} tiles on spells cast at a creature.`,
  },
  {
    num: 103, name: 'Lingering Chill',
    fx: { 'chill:pace': 0.7, 'chill:secs': 5 },
    note: (fx) => `When your ${listedOr(BINDER_HOLDS)} ends: creature speed ${percent(fx['chill:pace'])} `
      + `for ${secs(fx['chill:secs'])}.`,
  },
  {
    num: 101, name: 'Firm Grip',
    fx: { 'bind:secs': 1.2 },
    note: (fx) => `Hold duration ${more(fx['bind:secs'])}: ${listed(BINDER_HOLDS)}.`,
  },
  {
    num: 105, name: 'Brittle Hold',
    fx: { 'bind:brittle': 1.2 },
    note: (fx) => `Damage taken ${more(fx['bind:brittle'])} by a creature held by your ${listedOr(BINDER_HOLDS)}, from blows, `
      + 'shots, throws, fire and shatter.',
  },
  {
    num: 110, name: 'Hard Edges',
    fx: { 'shatter:size': 1.2 },
    note: (fx) => `Shatter damage ${more(fx['shatter:size'])}.`,
  },
  {
    num: 122, name: 'Frost Ward',
    fx: { 'ward:stilled': 0.7 },
    note: (fx) => `Damage taken from held, rooted or slowed creatures ${cut(fx['ward:stilled'])}.`,
  },
];

/*
 * The Warder's. Its spells, and six passives on the skins it lays and the
 * blows that land: larger skins, larger again over somebody else, skins that
 * add up rather than only replace, stamina back when a skin is used up, a
 * creature that strikes somebody near you turned on you, and a share of its
 * own attack back on whatever strikes you. A skin is a share of an Aegis out
 * of the focus (`talents.ts`).
 */
const WARDER: Seed[] = [
  ...classSpellsOf('warder').map((sp): Seed => ({ num: sp.num, name: sp.name, fx: {}, note: () => `${spellTerms(sp)} ${sp.note}` })),
  {
    num: 115, name: 'Second Wind',
    fx: { 'stamina:skin': 0.1 },
    note: (fx) => `Stamina +${percent(fx['stamina:skin'])} when a blow uses up your skin.`,
  },
  {
    num: 125, name: 'Watchful',
    fx: { 'watch:reach': 4 },
    note: (fx) => `A creature that hits anyone within ${fx['watch:reach']} tiles of you turns on you.`,
  },
  {
    num: 122, name: 'Protector',
    fx: { 'skin:other': 1.25 },
    note: (fx) => `Skin size on others ${more(fx['skin:other'])}.`,
  },
  {
    num: 128, name: 'Thorns',
    fx: { 'thorns:attack': 0.1 },
    note: (fx) => `Creature that hits you takes ${percent(fx['thorns:attack'])} of its own attack as damage.`,
  },
  {
    num: 101, name: 'Thick Skin',
    fx: { 'skin:size': 1.2 },
    note: (fx) => `Skin size ${more(fx['skin:size'])}, the school's Aegis and Bulwark included.`,
  },
  {
    num: 104, name: 'Overcharge',
    fx: { 'skin:over': 1.5 },
    note: (fx) => `A skin laid over an existing one adds to it, max ${percent(fx['skin:over'])} of the larger `
      + '(base: replaces a smaller one only).',
  },
];

/** Every trade's perks, in the order they were picked. */
const SEEDS: Record<string, Seed[]> = {
  terraformer: TERRAFORMER,
  miner: MINER,
  mason: MASON,
  carpenter: CARPENTER,
  smith: SMITH,
  forester: FORESTER,
  farmer: FARMER,
  cook: COOK,
  tailor: TAILOR,
  herdsman: HERDSMAN,
  naturalist: NATURALIST,
  fisher: FISHER,
  mender: MENDER,
  artisan: ARTISAN,
  blade: BLADE,
  berserker: BERSERKER,
  pikeman: PIKEMAN,
  archer: ARCHER,
  skirmisher: SKIRMISHER,
  chirurgeon: CHIRURGEON,
  beastmaster: BEASTMASTER,
  kindler: KINDLER,
  binder: BINDER,
  warder: WARDER,
};

const slug = (name: string): string => name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Every perk there is, three to a tier in the order they were picked. */
/**
 * The perks each tier offers, lowest tier first, by the number each was picked
 * under. Every trade with perks has its six rows of three here.
 */
export const TIERS: Record<string, number[][]> = {
  terraformer: [[10, 17, 25], [9, 14, 23], [15, 12, 26], [32, 29, 27], [33, 34, 44], [5, 6, 20]],
  miner: [[7, 8, 9], [14, 13, 19], [1, 2, 25], [3, 27, 35], [28, 15, 11], [50, 17, 6]],
  mason: [[1, 8, 17], [4, 18, 19], [20, 22, 33], [2, 9, 29], [16, 35, 48], [47, 24, 12]],
  carpenter: [[1, 37, 45], [3, 6, 14], [15, 26, 31], [16, 19, 32], [2, 18, 25], [10, 12, 27]],
  smith: [[8, 26, 27], [30, 32, 49], [12, 20, 22], [24, 25, 36], [7, 9, 13], [16, 19, 45]],
  forester: [[34, 43, 44], [21, 22, 40], [1, 2, 3], [7, 16, 24], [10, 11, 20], [5, 6, 14]],
  farmer: [[14, 25, 28], [4, 5, 8], [22, 23, 30], [6, 34, 39], [11, 40, 41], [15, 16, 17]],
  cook: [[11, 18, 28], [31, 49, 50], [3, 7, 8], [5, 6, 15], [1, 20, 21], [14, 46, 47]],
  tailor: [[2, 3, 18], [27, 31, 37], [9, 19, 21], [16, 25, 34], [4, 7, 35], [11, 46, 49]],
  herdsman: [[1, 11, 21], [15, 37, 50], [2, 13, 22], [9, 16, 25], [14, 24, 28], [10, 18, 26]],
  naturalist: [[2, 13, 23], [10, 11, 19], [3, 17, 24], [16, 29, 30], [12, 15, 34], [43, 44, 50]],
  fisher: [[1, 4, 13], [2, 15, 45], [17, 25, 33], [3, 14, 19], [5, 6, 9], [12, 27, 47]],
  mender: [[4, 9, 17], [3, 10, 19], [1, 14, 18], [2, 20, 21], [24, 25, 42], [26, 27, 50]],
  artisan: [[2, 3, 26], [7, 9, 10], [13, 27, 35], [4, 14, 34], [12, 46, 49], [28, 36, 48]],
  // Two spells and a passive to a tier, in order of what they are worth.
  blade: [[1, 32, 108], [2, 11, 111], [15, 29, 127], [19, 26, 123], [12, 31, 129], [33, 28, 109]],
  berserker: [[18, 30, 101], [2, 3, 106], [21, 29, 125], [20, 6, 112], [8, 14, 130], [45, 50, 113]],
  pikeman: [[38, 13, 129], [6, 5, 105], [33, 32, 121], [14, 19, 113], [2, 17, 102], [35, 3, 118]],
  archer: [[2, 1, 101], [29, 9, 107], [6, 10, 114], [3, 7, 124], [14, 25, 108], [48, 49, 102]],
  skirmisher: [[2, 3, 104], [31, 7, 107], [8, 12, 112], [4, 9, 110], [44, 36, 120], [10, 49, 102]],
  chirurgeon: [[1, 2, 101], [49, 4, 105], [43, 17, 104], [6, 19, 122], [46, 15, 106], [50, 20, 123]],
  beastmaster: [[1, 15, 106], [2, 28, 120], [27, 8, 101], [13, 18, 102], [32, 50, 108], [48, 41, 119]],
  kindler: [[3, 6, 125], [11, 5, 118], [44, 46, 106], [4, 10, 109], [24, 13, 124], [14, 26, 108]],
  binder: [[1, 29, 108], [6, 36, 103], [20, 21, 101], [8, 27, 105], [2, 35, 110], [16, 15, 122]],
  warder: [[1, 11, 115], [2, 47, 125], [12, 20, 122], [7, 32, 128], [3, 14, 101], [42, 44, 104]],
};

/** Every perk there is, tier by tier, and in each tier by the number it was picked under, as the island lists them. */
export const PERKS: PerkDef[] = Object.entries(SEEDS).flatMap(([cls, seeds]) =>
  (TIERS[cls] ?? []).flatMap((nums, t) => [...nums].sort((a, b) => a - b).map((num) => {
    const s = seeds.find((x) => x.num === num);
    if (!s) throw new Error(`${cls}'s tier ${t + 1} offers ${num}, and there is no such perk`);
    return {
      id: `${cls}_${s.key ?? slug(s.name)}`,
      class: cls,
      num: s.num,
      name: s.name,
      tier: t + 1,
      fx: s.fx,
      note: s.note(s.fx),
    };
  })));

export const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p]));
export const perksOf = (cls: string): PerkDef[] => PERKS.filter((p) => p.class === cls);

/** The skill a tier opens at. The first opens with the trade itself. */
export const tierAt = (tier: number): number => PERK_TIER_AT[tier - 1];

/** What a set of taken perks comes to. */
export const foldPerks = (taken: readonly string[]): Fx =>
  foldFx(taken.map((id) => PERK_BY_ID.get(id)).filter((p): p is PerkDef => !!p).map((p) => p.fx));

/**
 * Why a perk cannot be taken, or nothing.
 *
 * The same refusals the island builds in `perk_refusal`, in the same order and
 * the same words, which the suite asks the two of them to agree on: it is not
 * your trade's, you have it, you took another at that tier, or the tier is not
 * open yet.
 */
export function perkRefusal(p: PerkDef, mine: string | null, taken: readonly string[], main: number): string | null {
  if (p.class !== mine) return `Not your class: ${CLASSES.find((c) => c.id === p.class)?.name ?? p.class}.`;
  if (taken.includes(p.id)) return 'Already taken.';
  const c = CLASSES.find((x) => x.id === p.class);
  // A fighting class's tiers are class tiers, a craft class's perk tiers.
  const tier = c?.kind === 'combat' ? 'Class tier' : 'Perk tier';
  const other = taken.map((id) => PERK_BY_ID.get(id)).find((o) => o && o.class === p.class && o.tier === p.tier);
  if (other) return `${tier} already taken: ${other.name}.`;
  // A fighting trade's tiers open on its own level (`CLASS_TIER_AT`), and `main` is that level.
  const at = tiersAtFor(c?.kind ?? 'craft')[p.tier - 1];
  if (p.tier > 1 && main < at) {
    return c?.kind === 'combat'
      ? `${tier} opens at class level ${at} (have ${Math.floor(main)}).`
      : `${tier} opens at ${(c?.main ?? '').replace(/_/g, ' ')} ${at} (have ${Math.floor(main)}).`;
  }
  return null;
}

// Every trade moved over has its full eighteen, three to each of six tiers, and
// every trade with perks has been moved over: a card is never offered with a
// tier missing, nor a trade half moved.
for (const cls of PERK_CLASSES) {
  const n = perksOf(cls).length;
  if (n !== PERK_TIER_AT.length * PERKS_PER_TIER) throw new Error(`${cls} has ${n} perks`);
  // Every perk offered at exactly one tier, and every tier offering its three.
  const rows = TIERS[cls] ?? [];
  if (rows.length !== PERK_TIER_AT.length || rows.some((r) => r.length !== PERKS_PER_TIER)) {
    throw new Error(`${cls} does not have ${PERK_TIER_AT.length} tiers of ${PERKS_PER_TIER}`);
  }
  if (new Set(rows.flat()).size !== n || (SEEDS[cls] ?? []).some((s) => !rows.flat().includes(s.num))) {
    throw new Error(`${cls} offers a perk at two tiers, or one at none`);
  }
}
for (const cls of Object.keys(SEEDS)) {
  if (!PERK_CLASSES.has(cls)) throw new Error(`${cls} has perks but still has its tree`);
}
