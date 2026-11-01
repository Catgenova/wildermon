import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { ARMOUR_BY_ID } from './gear';
import { describeFrom, describeWith, ITEM_DEFS, itemDef, type Item } from './items';
import { BUCKET_LITRES, furnitureCentre, furnitureDef, furnitureName, holdsLiquid, isWell, litresIn, type PlacedFurniture } from './furniture';
import { BRUSH_TOOL, lacksTool } from './jobtools';
import { drawFrom, dyeInPiece, litresAtHand, lyeCarried, LYE_USE, NEED_LYE, takeLitres, vesselBecomes } from './placeables';
import { bestSheet, CHART_SHEET } from './cartography';
import { MIND_GAIN, tryGain } from './learn';
import { damageDrawn, failDamagedSaid, type FailStack } from './faildamage';
import {
  colourWord, DYE_BUCKET, DYE_LITRES, DYE_LITRES_PER_KG, DYE_PANE_LITRES, DYE_PARTS, DYE_QL_BLACK, DYE_QL_PURE, DYE_QL_WHITE, DYE_RECIPE, dyeGrams, dyeHex, dyeIn,
  dyeLitresFor, dyeQl, dyeRecipeId, dyeSays, DYESTUFF_OF, DYESTUFFS, dyeText, isHex, kgSaid, PRIMARIES, pureDye, qlSaid, RECIPE_STUFF, recipeOf, sharesSaid,
  type DyeLiquid, type Dyestuff, type Primary,
} from './dyestuffs';

/**
 * Colour.
 *
 * Everything made on this island comes out the colour of what it was made
 * from: cloth is the grey-white of the wool, leather the brown of the hide.
 * A **dye** changes that.
 *
 * A dyestuff boiled in a bucket of lye gives one primary, pure: red, yellow
 * or blue (`DYESTUFFS`), a kilo of it by weight for every litre of lye, and as
 * many litres of dye as there was lye. Every other colour is mixed by pouring
 * one dye into another in a barrel, and the QL of a dye is how bright it is
 * (`dyestuffs.ts`). Dyeing a thing takes litres out of one bucket of dye in
 * the pack or one barrel of dye within reach, by the size of the thing
 * (`DYE_LITRES`), and gives it exactly the dye's colour.
 */

/**
 * What will take a dye: anything woven or tanned, and the things made out of
 * them; and a glass panel, stained through. Metal will not, and neither will a
 * tool you are going to get dirty.
 */
const DYEABLE_ARMOUR = new Set(['cloth', 'leather']);
export const DYEABLE_ITEMS = new Set(['cloth', 'sack', 'satchel', 'backpack', 'saddle', 'bridle', 'banner', 'flagpole', 'sailing_boat', 'caravel', 'glass']);

/**
 * The pane a window and a bay window are glazed with, which takes a dye.
 *
 * A dyed panel keeps its colour as any dyed thing does (`Item.dye`), and a
 * pile of one colour is a pile of its own. Fitted into a window or a bay
 * window (`build_wall`), it gives the glass its colour: each pane fitted sets
 * the window's `glass` to its own colour, or clears it for a clear one, so a
 * window glazed in panes of one colour is that colour and the pane fitted
 * last decides a mixed one. The island keeps the same on `wall.glass`
 * (`take_material`, `wall_glass_tint`).
 */
export const TINTED_PANE = 'glass';
/** The colour a pane gives the glass it is fitted into: its dye's hex, or none for a clear one. */
export const paneTint = (pane: { dye?: string | null } | undefined): string | undefined =>
  isHex(pane?.dye) ? pane.dye : undefined;
export function takesDye(id: string): boolean {
  const a = ARMOUR_BY_ID.get(id);
  if (a) return DYEABLE_ARMOUR.has(a.cls);
  return DYEABLE_ITEMS.has(id);
}

/* ---- boiling ------------------------------------------------------------ */

/**
 * What a dye boil is done in, and the litres of water in it: a bucket of lye,
 * which is a bucket of water with ashes leached into it and is always full.
 * Nothing else that holds water goes over a fire: a barrel stands where it
 * was put, and a clay pot holds no liquid. The lye comes off as as many
 * litres of dye.
 */
export const BOIL_IN = 'lye_bucket';
export const BOIL_LITRES = BUCKET_LITRES;

/** The trade a boil is worked on, and the seconds and wind a go takes: from a dyestuff (`recipes.ts`) or from a recipe. */
export const DYE_SKILL = 'alchemy';
export const DYE_BOIL_TIME = 12;
export const DYE_BOIL_WIND = 0.04;

/** One of a dyestuff, in grams: what a boil weighs it by. */
export const gramsOf = (id: string): number => Math.round(itemDef(id).weight * 1000);
/** The fewest whole items of a dyestuff that weigh `grams` or more. */
export const countForGrams = (id: string, grams: number): number => {
  const each = gramsOf(id);
  return Math.floor((grams + each - 1) / each);
};
/** The plain name of a dyestuff, for a weight of it: "raspberries", "lotus flower". */
const stuffName = (id: string): string => itemDef(id).name.toLowerCase();

/**
 * Grams of its dyestuff a boil takes from you: a kilo for every litre of lye
 * in the bucket, at the litres a kilo makes under your perks (a Naturalist's
 * Double Boil, `litres:dye`) and the share of the weight they ask (a
 * Thrifty Dyer's, `need:` and the recipe). The island's `dye_boil_grams`.
 */
export const boilGrams = (g: Game, recipe: string): number =>
  dyeGrams(BOIL_LITRES, g.perk('litres:dye', DYE_LITRES_PER_KG), g.perk(`need:${recipe}`, 1));

/** Whether this input of this recipe is a boil's dyestuff, which is counted by its weight. */
export const isBoilStuff = (recipe: string, item: string): boolean => DYESTUFF_OF.has(item) && recipe === dyeRecipeId(item);

/** The items of its dyestuff a boil takes from you, the fewest whole ones over the weight. */
export const boilCount = (g: Game, recipe: string, item: string): number => countForGrams(item, boilGrams(g, recipe));

/** The items a boil takes with no perk: what its recipe is written down as. */
export const boilCountPlain = (item: string): number => countForGrams(item, dyeGrams(BOIL_LITRES, DYE_LITRES_PER_KG));

/**
 * Why a boil will not go for want of weight, `have` being how many of the
 * dyestuff are at hand: "It takes 5 kg of raspberries for 5 litres of lye;
 * you have 3.2 kg." The island's `dye_boil_refusal`.
 */
export function boilRefusal(g: Game, recipe: string, item: string, have: number): string | null {
  return weightRefusal(item, boilGrams(g, recipe), have);
}

/** Why `have` of a dyestuff is short of `grams` of it for a boil, or null. The island's `dye_weight_refusal`. */
export const weightRefusal = (item: string, grams: number, have: number): string | null =>
  (have * gramsOf(item) >= grams ? null
    : `Need ${kgSaid(grams)} kg of ${stuffName(item)} per ${BOIL_LITRES} litres of lye; have ${kgSaid(have * gramsOf(item))} kg.`);

/** What a dyestuff's card says it is for, off the boil itself. */
export const dyestuffUse = (d: Dyestuff): string =>
  `Boil in a bucket of lye for ${d.primary} dye: ${kgSaid(dyeGrams(1, DYE_LITRES_PER_KG))} kg per litre of lye, ${kgSaid(dyeGrams(BOIL_LITRES, DYE_LITRES_PER_KG))} kg `
  + `(${boilCountPlain(d.from)} × ${kgSaid(gramsOf(d.from))} kg) per bucket of ${BOIL_LITRES} litres. Output: ${BOIL_LITRES} litres of dye.`;

/** What a boil says it took: "You boil down 5 kg of raspberries, 50 of them, in 5 litres of lye." The island's `dye_boil_said`. */
export const boilSaid = (from: string, used: number): string =>
  `Boiled: ${kgSaid(used * gramsOf(from))} kg of ${stuffName(from)} (${used}), in ${BOIL_LITRES} litres of lye.`;

/**
 * A boil, come off the bench: the bucket of lye is a bucket of the
 * dyestuff's primary at the boil's QL, as many litres as there was lye, and
 * it says what it took. One bucket, and full: a boil is done in the one
 * bucket it had, so a bauble's go adds nothing to it (`recipeAction` asks
 * none of a boil).
 */
export function boiledDye(g: Game, made: Item, from: string, used: number): void {
  const stuff = DYESTUFF_OF.get(from);
  if (!stuff || made.id !== DYE_BUCKET) return;
  made.count = 1;
  made.dye = dyeText(pureDye(stuff.primary, made.ql), BOIL_LITRES);
  g.inventory.onChange?.();
  g.logMsg(boilSaid(from, used), 'event');
}

/* ---- a dye written down, and boiled again -------------------------------- */

/**
 * A recipe: a dye written down, to boil again.
 *
 * **Make a recipe**, on a bucket of dye in the pack or a barrel of dye beside
 * you, turns a sheet of papyrus (the best in the pack, as a map is copied onto)
 * into a dye recipe that records the dye's parts and QL (`DYE_RECIPE`, its
 * `dye`). Nothing is taken out of the dye.
 *
 * **Boil from recipe**, on the recipe, is a boil as a dyestuff's is (the trade,
 * the seconds, the wind, the roll and what a failed one loses), done in one
 * bucket of lye with each primary of the mix's dyestuff (`RECIPE_STUFF`) by its
 * share of a whole boil's weight (`shareGrams`): the bucket comes off as
 * `BOIL_LITRES` of exactly the recipe's parts, at the QL the boil rolls and
 * never above the recipe's. The recipe is kept. The island's `dye_recipe_*`.
 */
export const MAKE_DYE_RECIPE = 'make_dye_recipe';
export const BOIL_DYE_RECIPE = 'boil_dye_recipe';
/** Seconds and wind writing one takes. */
export const RECIPE_TIME = 6;
export const RECIPE_WIND = 0.01;

/**
 * Grams of a primary's dyestuff a boil from a recipe takes for `parts` of it:
 * its share of a whole boil's weight, under the litres a kilo makes and the
 * share of the weight asked (`dyeGrams`). Whole grams, rounded up. The
 * island's `dye_share_grams`.
 */
export const shareGrams = (parts: number, perKg = DYE_LITRES_PER_KG, need = 1): number =>
  Math.ceil((BOIL_LITRES * 1000 * parts / DYE_PARTS / perKg) * need - 1e-6);

/** One primary of a recipe's mix: its dyestuff, the grams of it and the fewest whole items over them. */
export interface RecipeShare {
  primary: Primary;
  from: string;
  grams: number;
  count: number;
}

/** Each primary in the mix, in order, at the grams `grams` gives: with no perk, what a recipe is written down as. */
export const recipeShares = (l: DyeLiquid, grams: (p: Primary, from: string) => number = (p) => shareGrams(l[p])): RecipeShare[] =>
  PRIMARIES.filter((p) => l[p] > 0).map((p) => {
    const from = RECIPE_STUFF[p];
    const n = grams(p, from);
    return { primary: p, from, grams: n, count: countForGrams(from, n) };
  });

/** And what a boil from it takes from you, under your perks: a Naturalist's Double Boil and Thrifty Dyer, as on the dyestuff's own boil. */
export const sharesFor = (g: Game, l: DyeLiquid): RecipeShare[] =>
  recipeShares(l, (p, from) => shareGrams(l[p], g.perk('litres:dye', DYE_LITRES_PER_KG), g.perk(`need:${dyeRecipeId(from)}`, 1)));

/** How hard a boil from it is: the hardest boil of the dyestuffs it takes. The island's `dye_recipe_hard`. */
export const recipeDifficulty = (l: DyeLiquid): number =>
  Math.max(0, ...recipeShares(l).map((s) => DYESTUFF_OF.get(s.from)?.difficulty ?? 0));
/**
 * And the dyestuff's boil it is rolled as, the hardest of them and the first on a tie, so that what is surer
 * on a boil is surer on this (a Naturalist's Sure Boil, `fail:` and the recipe). The island's `dye_recipe_job`.
 */
export const recipeBoilOf = (l: DyeLiquid): string => {
  const hard = recipeDifficulty(l);
  const s = recipeShares(l).find((x) => (DYESTUFF_OF.get(x.from)?.difficulty ?? 0) === hard);
  return s ? dyeRecipeId(s.from) : BOIL_DYE_RECIPE;
};

/** One share said: "2.5 kg of raspberries (25)". */
const shareSaid = (s: RecipeShare): string => `${kgSaid(s.grams)} kg of ${stuffName(s.from)} (${s.count})`;

/**
 * What Examine adds of a recipe: the colour, the mix, and per bucket of lye
 * the kilos of each dyestuff and what comes off. The island's `dye_recipe_says`.
 */
export const recipeSays = (l: DyeLiquid): string =>
  ` Recipe: ${colourWord(dyeHex(l))}, ${dyeHex(l)}: ${sharesSaid(l)}. Per ${BOIL_LITRES} L of lye: ${recipeShares(l).map(shareSaid).join(', ')}.`
  + ` Output: ${BOIL_LITRES} L, QL at most ${qlSaid(l.ql)}.`;

/** What making and boiling one say. The island's `dye_recipe_said` and the rest. */
export const DYE_RECIPE_SAID = {
  gone: 'It is gone.',
  noDye: 'No dye in it.',
  far: 'Stand next to it.',
  noSheet: `Need a sheet of ${itemDef(CHART_SHEET).name.toLowerCase()}.`,
  blank: 'Recipe is blank.',
  noLye: `Need ${/^[aeiou]/i.test(itemDef(BOIL_IN).name) ? 'an' : 'a'} ${itemDef(BOIL_IN).name.toLowerCase()}.`,
  failed: `Failed: ${itemDef(DYE_BUCKET).name.toLowerCase()}.`,
};
export const recipeWrittenSaid = (l: DyeLiquid): string =>
  `Recipe written: ${colourWord(dyeHex(l))}, ${dyeHex(l)} at QL ${qlSaid(l.ql)}: ${sharesSaid(l)}.`;
export const recipeBoiledSaid = (shares: readonly RecipeShare[], made: DyeLiquid): string =>
  `Boiled from recipe: ${shares.map(shareSaid).join(', ')}, in ${BOIL_LITRES} litres of lye. Made: ${dyeSays(made, BOIL_LITRES)}`;

const nearPiece = (g: Game, f: PlacedFurniture, range = 2.4): boolean => {
  const [cx, cy] = furnitureCentre(f);
  return Math.hypot(cx - g.player.x, cy - g.player.y) <= range;
};
const pieceOf = (g: Game, t: Target): PlacedFurniture | undefined => (t.kind === 'furniture' ? g.furniture.get(t.id) : undefined);

/** The dye a recipe would be written from: a bucket of it in the pack, or a barrel of it. */
const recipeSource = (g: Game, t: Target): DyeLiquid | null => {
  if (t.kind === 'furniture') {
    const f = pieceOf(g, t);
    return f ? dyeInPiece(f) : null;
  }
  return dyeIn(itemOf(g, t))?.liquid ?? null;
};

/** Why a recipe will not be written from this, or null. The island's `dye_recipe_refusal`, question for question. */
export function makeRecipeRefusal(g: Game, t: Target): string | null {
  if (t.kind === 'furniture') {
    const f = pieceOf(g, t);
    if (!f) return DYE_RECIPE_SAID.gone;
    if (!nearPiece(g, f)) return DYE_RECIPE_SAID.far;
    if (!dyeInPiece(f)) return DYE_RECIPE_SAID.noDye;
  } else {
    const it = itemOf(g, t);
    if (!it) return DYE_RECIPE_SAID.gone;
    if (!dyeIn(it)) return DYE_RECIPE_SAID.noDye;
  }
  return bestSheet(g) ? null : DYE_RECIPE_SAID.noSheet;
}

/** Why a boil from this recipe will not go, or null: the lye, then each dyestuff by its weight. The island's `dye_recipe_refusal`. */
export function boilRecipeRefusal(g: Game, t: Target): string | null {
  const it = itemOf(g, t);
  if (!it) return DYE_RECIPE_SAID.gone;
  const l = recipeOf(it);
  if (!l) return DYE_RECIPE_SAID.blank;
  if (g.inventory.count(BOIL_IN) < 1) return DYE_RECIPE_SAID.noLye;
  for (const s of sharesFor(g, l)) {
    const short = weightRefusal(s.from, s.grams, g.inventory.count(s.from));
    if (short) return short;
  }
  return null;
}

/* ---- what a dyeing draws from ---------------------------------------------- */

/**
 * One place a dyeing can draw from: a bucket of dye loose in the pack, or a
 * barrel of dye within reach. `key` is how a target names it in `dyeFrom`,
 * the same on the island: `item:<number>` or `furniture:<number>`.
 */
export interface DyeSource {
  key: string;
  liquid: DyeLiquid;
  litres: number;
  hex: string;
  /** Where it is, said: "Bucket, in your pack", "Barrel". */
  where: string;
  item?: Item;
  piece?: PlacedFurniture;
}

/** The dye chosen on a target, if one was. */
export const dyeChoice = (t: Target): string | undefined => {
  const v = (t as Target & { dyeFrom?: unknown }).dyeFrom;
  return typeof v === 'string' ? v : undefined;
};

/**
 * The barrels of dye a dyeing reaches: the stores a craft reaches
 * (`Game.liquidStoresWithin`, `CRAFT_REACH` tiles, yours or on a settlement
 * of yours and not locked against you) that hold a whole litre of dye. The
 * island's `dye_barrels`.
 */
export function dyeBarrels(g: Game): PlacedFurniture[] {
  return g.liquidStoresWithin().filter((f) => holdsLiquid(f) && !isWell(f) && !!dyeInPiece(f) && Math.floor(litresIn(f)) >= 1)
    .sort((a, b) => a.id - b.id);
}

/**
 * Every bucket of dye loose in the pack and not kept back, by number, then
 * every barrel of dye within reach, by number: each with what is in it. The
 * island lists them in the same order (`dye_sources`).
 */
export function dyeSources(g: Game): DyeSource[] {
  const out: DyeSource[] = [];
  for (const it of [...g.inventory.items].sort((a, b) => a.uid - b.uid)) {
    const d = dyeIn(it);
    // A bucket kept back is not spent, as nothing kept back is.
    if (!d || it.locked) continue;
    out.push({ key: `item:${it.uid}`, liquid: d.liquid, litres: d.litres, hex: dyeHex(d.liquid), where: 'Bucket, in your pack', item: it });
  }
  for (const f of dyeBarrels(g)) {
    const l = dyeInPiece(f);
    if (l) out.push({ key: `furniture:${f.id}`, liquid: l, litres: Math.floor(litresIn(f)), hex: dyeHex(l), where: furnitureName(f), piece: f });
  }
  return out;
}

/** Those of them that hold `litres` or more. */
export const dyeEnough = (g: Game, litres: number): DyeSource[] => dyeSources(g).filter((s) => s.litres >= litres);

/**
 * The dye a dyeing of `litres` will use: the one chosen, while it holds
 * enough; with none chosen, the first that holds enough. Null if there is
 * none, or the one chosen is gone or holds too little.
 */
export function pickDye(g: Game, litres: number, choice?: string): DyeSource | null {
  const all = dyeEnough(g, litres);
  return (choice !== undefined ? all.find((s) => s.key === choice) : all[0]) ?? null;
}

export const litresWord = (n: number): string => `${n} ${n === 1 ? 'litre' : 'litres'}`;
/** What is said when there is no dye to dye with at all, `reach` being how far a dyeing reaches for a barrel. */
export const noDye = (reach: number): string =>
  `No dye in your pack or a barrel within ${reach} tiles. Boil a dyestuff in a bucket of lye for red, yellow or blue dye.`;
/** And when there is, but no one bucket or barrel of it holds what this takes. */
export const tooLittleDye = (litres: number, most: number): string =>
  `Need ${litresWord(litres)} of dye from one bucket or barrel; the most in one is ${litresWord(most)}.`;
/** And when the one chosen is gone, or has too little left in it. */
export const dyeGone = (litres: number): string => `Chosen dye gone or under ${litresWord(litres)}. Choose again.`;
/** A thing that is that colour already. */
export const dyedAlready = (hex: string): string => `Already ${colourWord(hex)} (${hex}).`;

/**
 * Why a dyeing of `litres` will not go onto a thing that is `has` now, or
 * null: no dye at all, none that holds enough, the one chosen gone, or the
 * thing that colour already. With several that hold enough and none chosen
 * yet, the one asking is asked which (`Game.requestAction`), so it is refused
 * only if every one of them is the colour the thing is. The island's
 * `dye_reason`.
 */
export function dyeReason(g: Game, litres: number, choice: string | undefined, has: string | null | undefined, reach: number): string | null {
  const all = dyeSources(g);
  const enough = all.filter((s) => s.litres >= litres);
  if (!enough.length) return all.length ? tooLittleDye(litres, Math.max(...all.map((s) => s.litres))) : noDye(reach);
  const d = choice !== undefined ? enough.find((s) => s.key === choice) : enough.length === 1 ? enough[0] : undefined;
  if (choice !== undefined && !d) return dyeGone(litres);
  if (d) return has === d.hex ? dyedAlready(d.hex) : null;
  return enough.every((s) => s.hex === has) ? dyedAlready(enough[0].hex) : null;
}

/** Take `litres` out of a bucket or a barrel of dye; a bucket left with none is an empty bucket. */
export function spendDye(g: Game, from: DyeSource, litres: number): boolean {
  if (from.piece) return drawFrom(g, from.piece, litres);
  const bucket = from.item;
  const d = dyeIn(bucket);
  if (!bucket || !d || d.litres < litres) return false;
  const left = d.litres - litres;
  if (left <= 0) return vesselBecomes(g, bucket, 'bucket');
  bucket.dye = dyeText(d.liquid, left);
  g.inventory.onChange?.();
  g.events.emit('inventory');
  return true;
}

/** What the picker lists for a source: where it is, and what Examine says of the dye in it. */
export const sourceSays = (s: DyeSource): string => `${s.where}: ${dyeSays(s.liquid, s.litres)}`;
/** What the picker asks. */
export const pickDyeAsks = (litres: number): string => `Which dye? Needs ${litresWord(litres)}, from one bucket or barrel.`;

type ItemTarget = Extract<Target, { kind: 'item' }>;
const isItem = (t: Target): t is ItemTarget => t.kind === 'item';
const itemOf = (g: Game, t: Target): Item | undefined => (isItem(t) ? g.inventory.get(t.uid) : undefined);

/*
 * Scrubbed off with a brush, the other way to remove a dye than boiling it out in lye (`strip_dye`, `strip_wall_paint`):
 * no lye, and no skill, so a go is worked at 50 as every job without one is. On a thing in the pack, a piece set down
 * that took a dye (a banner, a flagpole, a boat), a painted side of a wall and a painted floor (`buildActions.ts`).
 * The island's `private.scrub_refusal` and `private.perform_scrub`, and `build_refusal`'s and `perform_building`'s own.
 */
/** What it is scrubbed with, worn a go's worth every go as every job's tool is. */
export const SCRUB_TOOL = BRUSH_TOOL;
/** Seconds a go at skill 1, at no skill worked at 50: twice a lye removal's (`strip_dye`) at alchemy 50. */
export const SCRUB_TIME = 12;
/** Wind a go: twice a lye removal's. */
export const SCRUB_WIND = 0.04;
/** What every removal says of a thing with no dye on it. */
export const NO_COLOUR = 'No colour to remove.';
/** What a removal off a thing says: "Dye removed: plain banner." */
export const dyeRemovedSaid = (name: string): string => `Dye removed: plain ${name.toLowerCase()}.`;

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
/** A piece set down, aimed at. */
const pieceAt = (g: Game, t: Target): PlacedFurniture | undefined => (t.kind === 'furniture' ? g.furniture.get((t as PieceTarget).id) : undefined);
/** Whether a thing carries a colour of its own to remove: dyed, and of a kind that takes a dye (not a barrel's dye). */
const coloured = (thing: { dye?: string } | undefined, kind: string | undefined): boolean => !!thing?.dye && !!kind && takesDye(kind);

/**
 * Why a scrubbing off a thing in the pack or a piece set down will not go, or null: the brush, first, as the island's
 * tool check comes first; a piece's padlock, as lifting it asks (`pick_up_furniture`); and a colour to remove. The
 * reach is the walk's business here and the island's there (`private.scrub_refusal`).
 */
export function scrubRefusal(g: Game, t: Target): string | null {
  const brush = lacksTool(g, SCRUB_TOOL);
  if (brush) return brush;
  if (t.kind === 'furniture') {
    const f = pieceAt(g, t);
    if (!f) return 'It is gone.';
    const shut = g.lockRefusal(f);
    if (shut) return shut;
    return coloured(f, f.kind) ? null : NO_COLOUR;
  }
  const it = itemOf(g, t);
  return coloured(it, it?.id) ? null : NO_COLOUR;
}

export const DYE_ACTIONS: ActionDef[] = [
  {
    id: 'dye_item',
    label: 'Dye it',
    verb: 'dyeing',
    skill: 'alchemy',
    stamina: 0.02,
    baseTime: 8,
    applies: (t, g) => {
      const it = itemOf(g, t);
      return !!it && takesDye(it.id);
    },
    dyeLitres: (t, g) => {
      const it = itemOf(g, t);
      return it && takesDye(it.id) ? dyeLitresFor(it.id) : null;
    },
    labelFor: (t, g) => {
      const it = itemOf(g, t);
      const all = it ? dyeEnough(g, dyeLitresFor(it.id)) : [];
      return all.length === 1 ? `Dye it ${colourWord(all[0].hex)}` : 'Dye it';
    },
    check: (t, g) => {
      const it = itemOf(g, t);
      if (!it) return 'It is gone.';
      if (!takesDye(it.id)) return 'Cannot be dyed.';
      return dyeReason(g, dyeLitresFor(it.id), dyeChoice(t), it.dye, g.dyeReach());
    },
    perform: (t, g) => {
      const it = itemOf(g, t);
      if (!it) return;
      const need = dyeLitresFor(it.id);
      const d = pickDye(g, need, dyeChoice(t));
      if (!d || !spendDye(g, d, need)) return;
      // A stack is split so the rest stays the colour it was.
      const one = it.count > 1 ? g.inventory.take(it.uid, 1) : it;
      if (!one) return;
      one.dye = d.hex;
      if (one !== it) g.inventory.addItem(one);
      g.gainSkill('alchemy', 0.3);
      g.note('dyed');
      g.note(`dyed:${one.id}`);
      g.logMsg(`Dyed: ${colourWord(d.hex)} (${d.hex}). Dye used: ${litresWord(need)}.`, 'event');
      g.events.emit('inventory');
    },
  },
  {
    id: MAKE_DYE_RECIPE,
    label: 'Make a recipe',
    verb: 'writing a dye recipe',
    stamina: RECIPE_WIND,
    baseTime: RECIPE_TIME,
    applies: (t, g) => !!recipeSource(g, t),
    check: (t, g) => makeRecipeRefusal(g, t),
    perform: (t, g) => {
      const l = recipeSource(g, t);
      const sheet = bestSheet(g);
      if (!l || !sheet || makeRecipeRefusal(g, t)) return;
      g.inventory.remove(sheet.uid, 1);
      const it = g.inventory.add(DYE_RECIPE, { ql: l.ql });
      it.dye = dyeText(l);
      g.inventory.onChange?.();
      g.logMsg(recipeWrittenSaid(l), 'event');
      g.events.emit('inventory');
    },
  },
  {
    id: BOIL_DYE_RECIPE,
    label: 'Boil from recipe',
    verb: 'boiling dye from a recipe',
    skill: DYE_SKILL,
    stamina: DYE_BOIL_WIND,
    baseTime: DYE_BOIL_TIME,
    repeat: true,
    applies: (t, g) => !!recipeOf(itemOf(g, t)),
    check: (t, g) => boilRecipeRefusal(g, t),
    perform: (t, g) => {
      const l = recipeOf(itemOf(g, t));
      if (!l || boilRecipeRefusal(g, t)) return false;
      const shares = sharesFor(g, l);
      const spend = (): void => {
        for (const s of shares) g.inventory.consume(s.from, s.count);
        g.inventory.consume(BOIL_IN, 1);
      };
      // A boil that does not come off uses nothing up: the dyestuffs and the lye are damaged by their QL, as a dyestuff's boil's are (`faildamage.ts`).
      if (!g.sureCheck(recipeBoilOf(l), DYE_SKILL, recipeDifficulty(l), 0, g.mindEase())) {
        const pack = (id: string): FailStack[] => g.inventory.items.filter((it) => it.id === id && !it.locked)
          .map((it) => ({ item: it, spend: (n: number) => g.inventory.remove(it.uid, n), touched: () => g.inventory.onChange?.() }));
        const hurt = [...shares.flatMap((s) => damageDrawn(pack(s.from), s.count)), ...damageDrawn(pack(BOIL_IN), 1)];
        g.missed();
        g.gainSkill('mind_logic', tryGain(false, MIND_GAIN));
        g.logMsg(failDamagedSaid(DYE_RECIPE_SAID.failed, hurt), 'event');
        g.events.emit('inventory');
        return boilRecipeRefusal(g, t) === null;
      }
      // What the boil rolls, never above the recipe's.
      const ql = Math.min(g.productQl(DYE_SKILL), l.ql);
      spend();
      const made: DyeLiquid = { red: l.red, yellow: l.yellow, blue: l.blue, ql: dyeQl(ql) };
      const bucket = g.inventory.add(DYE_BUCKET, { ql });
      bucket.dye = dyeText(made, BOIL_LITRES);
      g.inventory.onChange?.();
      g.madeIt(DYE_BUCKET, bucket.ql, 1);
      g.gainSkill('mind_logic', tryGain(true, MIND_GAIN));
      g.logMsg(recipeBoiledSaid(shares, made), 'event');
      g.events.emit('inventory');
      return boilRecipeRefusal(g, t) === null;
    },
  },
  {
    id: 'strip_dye',
    label: 'Remove dye',
    verb: 'boiling the colour out',
    skill: 'alchemy',
    stamina: 0.02,
    baseTime: 6,
    applies: (t, g) => {
      const it = itemOf(g, t);
      return !!it?.dye && takesDye(it.id);
    },
    check: (t, g) => {
      const it = itemOf(g, t);
      if (!it?.dye || !takesDye(it.id)) return NO_COLOUR;
      if (litresAtHand(lyeCarried(g)) < LYE_USE) return NEED_LYE;
      return null;
    },
    perform: (t, g) => {
      const it = itemOf(g, t);
      if (!it || !takeLitres(lyeCarried(g), LYE_USE)) return;
      delete it.dye;
      g.gainSkill('alchemy', 0.2);
      g.logMsg(dyeRemovedSaid(itemDef(it.id).name), 'event');
      g.events.emit('inventory');
    },
  },
  {
    id: 'scrub_dye',
    label: 'Scrub off dye',
    verb: 'scrubbing off dye',
    tool: SCRUB_TOOL,
    stamina: SCRUB_WIND,
    baseTime: SCRUB_TIME,
    applies: (t, g) => {
      const it = itemOf(g, t);
      const f = pieceAt(g, t);
      return coloured(it, it?.id) || coloured(f, f?.kind);
    },
    check: (t, g) => scrubRefusal(g, t),
    perform: (t, g) => {
      if (scrubRefusal(g, t)) return;
      const f = pieceAt(g, t);
      if (f) {
        delete f.dye;
        g.logMsg(dyeRemovedSaid(furnitureDef(f.kind).name), 'event');
        g.events.emit('world', f.x, f.y);
        return;
      }
      const it = itemOf(g, t);
      if (!it) return;
      delete it.dye;
      g.inventory.onChange?.();
      g.logMsg(dyeRemovedSaid(itemDef(it.id).name), 'event');
      g.events.emit('inventory');
    },
  },
];

// What each dyestuff boils into, off the boil itself, onto its card.
for (const s of DYESTUFFS) {
  const d = ITEM_DEFS[s.from];
  if (d) d.description = [d.description, dyestuffUse(s)].filter(Boolean).join(' ');
}

// What a recipe is written on and how much lye it is boiled in, into its own text.
describeFrom(DYE_RECIPE, { sheet: itemDef(CHART_SHEET).name.toLowerCase(), litres: BOIL_LITRES });

// The litres a dyeing takes and a boil makes, into the text of a bucket of dye.
describeWith({ dye: DYE_LITRES, paneDye: DYE_PANE_LITRES, dyeBoil: BOIL_LITRES, perKg: DYE_LITRES_PER_KG, qlBlack: DYE_QL_BLACK, qlPure: DYE_QL_PURE, qlWhite: DYE_QL_WHITE });
