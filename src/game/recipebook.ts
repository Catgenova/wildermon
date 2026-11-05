import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { describeFrom, itemDef, type Item } from './items';
import { BOOK_DROPS, BOOKS, bookDrops, type BookKind } from './bookdrops';
import { bookOf, lockedRecipes, recipeTitle, type Recipe } from './recipes';
import { listed, percent } from './words';

/**
 * Recipes and Formulas found, read and used up.
 *
 * A shut recipe (`Recipe.locked`) is listed in the crafting window, greyed and
 * padlocked, and cannot be made until its book is read: a Recipe for a dish
 * (`bookOf`), a Formula for an enchantment scroll. A Recipe comes off a
 * goblin's or an orc's carcass, a Formula off an ogre's or a dragon's, at the
 * odds in `BOOK_DROPS`, one butchering at a time; reading one opens its recipe
 * for good and uses it up, and one already open is not read. The island's
 * `book_drops`, `book_item`, `book_known_says`, `recipe_book`, `locked_recipes`,
 * `private.recipe_known` and the `read_recipe` / `read_formula` branches of
 * `perform_relic_use`.
 */

export { BOOK_DROPS, BOOK_KINDS, BOOKS, bookDrops } from './bookdrops';

/** The kinds that carry a book of this kind. */
export const bookDroppers = (book: BookKind): string[] => bookDrops(book).map((d) => d.kind);

export const RECIPE_ITEM = BOOKS.recipe.item;
export const FORMULA_ITEM = BOOKS.formula.item;
export const READ_RECIPE = BOOKS.recipe.read;
export const READ_FORMULA = BOOKS.formula.read;
export const RECIPE_KNOWN = BOOKS.recipe.known;
export const FORMULA_KNOWN = BOOKS.formula.known;
/** The odds of a Recipe off one butchering of a goblin or an orc (one figure for both). */
export const RECIPE_DROP_ODDS = BOOK_DROPS.find((d) => d.book === 'recipe')!.odds;
/** The kinds whose carcasses carry a Recipe. */
export const RECIPE_DROPPERS: readonly string[] = bookDroppers('recipe');

/** The kind of book an item is, or none. */
export const bookOfItem = (id: string | undefined): BookKind | undefined =>
  (Object.keys(BOOKS) as BookKind[]).find((b) => BOOKS[b].item === id);

/** The shut recipe a Recipe or Formula opens, off its `extra`, or none. */
export const recipeOn = (item: Pick<Item, 'id' | 'extra'> | null | undefined): Recipe | undefined => {
  const book = bookOfItem(item?.id);
  return book ? lockedRecipes(book).find((r) => recipeTitle(r) === item?.extra) : undefined;
};

/**
 * The shut recipe a book of this kind off a carcass opens: one at random of
 * those you have not read, or of them all once you have read every one (to
 * sell or give on). None when nothing of the kind is shut.
 */
export function recipeToDrop(g: Game, book: BookKind = 'recipe', roll: number = g.rand()): Recipe | undefined {
  const all = lockedRecipes(book);
  const unread = all.filter((r) => !g.knowsRecipe(r.id));
  const from = unread.length ? unread : all;
  return from.length ? from[Math.min(from.length - 1, Math.floor(roll * from.length))] : undefined;
}

/**
 * A book, maybe, off a carcass just butchered: the odds in `BOOK_DROPS` for a
 * kind that carries one, into the pack. The line it was found with, or null.
 */
export function dropRecipe(g: Game, kind: string, ql: number): string | null {
  const drop = BOOK_DROPS.find((d) => d.kind === kind);
  if (!drop || g.rand() >= drop.odds) return null;
  const r = recipeToDrop(g, drop.book);
  if (!r) return null;
  const item = BOOKS[drop.book].item;
  g.inventory.add(item, { ql, extra: recipeTitle(r) });
  g.events.emit('inventory');
  return `Found: ${itemDef(item).name} (${recipeTitle(r).toLowerCase()}).`;
}

const held = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get(t.uid) : undefined);

/** Why a book will not be read, or null. */
export function readRecipeRefusal(g: Game, t: Target): string | null {
  const it = held(g, t);
  const r = recipeOn(it);
  if (!it || !r) return 'It is gone.';
  if (g.knowsRecipe(r.id)) return BOOKS[bookOf(r)].known;
  return null;
}

const readAction = (book: BookKind): ActionDef => {
  const { item, read, label } = BOOKS[book];
  const name = itemDef(item).name;
  return {
    id: read,
    label,
    verb: `reading the ${book}`,
    stamina: 0.01,
    baseTime: 3,
    applies: (t, g) => held(g, t)?.id === item,
    check: (t, g) => readRecipeRefusal(g, t),
    perform: (t, g) => {
      if (readRecipeRefusal(g, t)) return;
      const it = held(g, t);
      const r = recipeOn(it);
      if (!it || !r || !g.inventory.remove(it.uid, 1)) return;
      g.knownRecipes.add(r.id);
      g.events.emit('inventory');
      g.logMsg(`${name} read: ${recipeTitle(r)}. ${name} used up.`, 'skill');
    },
  };
};

export const RECIPE_BOOK_ACTIONS: ActionDef[] = [readAction('recipe'), readAction('formula')];

for (const book of Object.keys(BOOKS) as BookKind[]) {
  const from = bookDrops(book);
  describeFrom(BOOKS[book].item, {
    from: listed(from.map((d) => d.kind)),
    odds: from.map((d) => `${d.kind} ${percent(d.odds)}`).join(', '),
  });
}
