import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { describeFrom, itemDef, type Item } from './items';
import { lockedRecipes, recipeTitle, type Recipe } from './recipes';
import { listed, percent } from './words';

/**
 * Recipes found, read and used up.
 *
 * A shut recipe (`Recipe.locked`) is listed in the crafting window, greyed and
 * padlocked, and cannot be made until its Recipe is read. A Recipe comes off a
 * goblin's or an orc's carcass, one butchering in `RECIPE_DROP_ODDS`; reading
 * it opens the recipe for good and uses it up, and one already open is not
 * read. The island's `recipe_drop_odds`, `recipe_droppers`, `locked_recipes`,
 * `private.recipe_known` and the `read_recipe` branch of `perform_relic_use`.
 */

/** The item a shut recipe is written on; its `extra` is the recipe's title (`recipeTitle`). */
export const RECIPE_ITEM = 'cooking_recipe';
/** The odds of a Recipe off one butchering of a carcass of a kind that drops them. */
export const RECIPE_DROP_ODDS = 0.05;
/** The kinds whose carcasses carry a Recipe. */
export const RECIPE_DROPPERS: readonly string[] = ['goblin', 'orc'];
/** What a Recipe is read as. */
export const READ_RECIPE = 'read_recipe';
/** What reading one already open says. The island says the same. */
export const RECIPE_KNOWN = 'Recipe known.';

/** The shut recipe a Recipe opens, off its `extra`, or none. */
export const recipeOn = (item: Pick<Item, 'id' | 'extra'> | null | undefined): Recipe | undefined =>
  item?.id === RECIPE_ITEM ? lockedRecipes().find((r) => recipeTitle(r) === item.extra) : undefined;

/**
 * The shut recipe a Recipe off a carcass opens: one at random of those you have
 * not read, or of them all once you have read every one (to sell or give on).
 * None when nothing is shut.
 */
export function recipeToDrop(g: Game, roll: number = g.rand()): Recipe | undefined {
  const all = lockedRecipes();
  const unread = all.filter((r) => !g.knowsRecipe(r.id));
  const from = unread.length ? unread : all;
  return from.length ? from[Math.min(from.length - 1, Math.floor(roll * from.length))] : undefined;
}

/**
 * A Recipe, maybe, off a carcass just butchered: `RECIPE_DROP_ODDS` of one for a
 * kind in `RECIPE_DROPPERS`, into the pack. The line it was found with, or null.
 */
export function dropRecipe(g: Game, kind: string, ql: number): string | null {
  if (!RECIPE_DROPPERS.includes(kind) || g.rand() >= RECIPE_DROP_ODDS) return null;
  const r = recipeToDrop(g);
  if (!r) return null;
  g.inventory.add(RECIPE_ITEM, { ql, extra: recipeTitle(r) });
  g.events.emit('inventory');
  return `Found: ${itemDef(RECIPE_ITEM).name} (${recipeTitle(r).toLowerCase()}).`;
}

const held = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get(t.uid) : undefined);

/** Why a Recipe will not be read, or null. */
export function readRecipeRefusal(g: Game, t: Target): string | null {
  const it = held(g, t);
  const r = recipeOn(it);
  if (!it || !r) return 'It is gone.';
  if (g.knowsRecipe(r.id)) return RECIPE_KNOWN;
  return null;
}

export const RECIPE_BOOK_ACTIONS: ActionDef[] = [
  {
    id: READ_RECIPE,
    label: 'Read recipe',
    verb: 'reading the recipe',
    stamina: 0.01,
    baseTime: 3,
    applies: (t, g) => held(g, t)?.id === RECIPE_ITEM,
    check: (t, g) => readRecipeRefusal(g, t),
    perform: (t, g) => {
      if (readRecipeRefusal(g, t)) return;
      const it = held(g, t);
      const r = recipeOn(it);
      if (!it || !r || !g.inventory.remove(it.uid, 1)) return;
      g.knownRecipes.add(r.id);
      g.events.emit('inventory');
      g.logMsg(`Recipe read: ${recipeTitle(r)}. Recipe used up.`, 'skill');
    },
  },
];

describeFrom(RECIPE_ITEM, {
  from: listed([...RECIPE_DROPPERS]),
  odds: percent(RECIPE_DROP_ODDS),
});
