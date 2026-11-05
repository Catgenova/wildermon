/**
 * The kinds of book that open a shut recipe (`recipebook.ts`), and the carcasses
 * that carry them. A leaf on purpose: no value imports, so the journal and the
 * help can read the odds without pulling the recipe table in ahead of the game.
 */

/** What opens a shut recipe: a Recipe for a dish, a Formula for an enchantment scroll (`bookOf`). */
export type BookKind = 'recipe' | 'formula';
export const BOOK_KINDS: readonly BookKind[] = ['recipe', 'formula'];

/** What each kind of book is: the item it is written on (its `extra` the recipe's title), the action that reads it, what reading one already open says. */
export const BOOKS: Record<BookKind, { item: string; read: string; label: string; known: string }> = {
  recipe: { item: 'cooking_recipe', read: 'read_recipe', label: 'Read recipe', known: 'Recipe known.' },
  formula: { item: 'enchant_formula', read: 'read_formula', label: 'Read formula', known: 'Formula known.' },
};

/** The kinds whose carcasses carry a book, which book, and the odds of one per butchering. */
export const BOOK_DROPS: ReadonlyArray<{ kind: string; book: BookKind; odds: number }> = [
  { kind: 'goblin', book: 'recipe', odds: 0.05 },
  { kind: 'orc', book: 'recipe', odds: 0.05 },
  { kind: 'ogre', book: 'formula', odds: 0.05 },
  { kind: 'dragon', book: 'formula', odds: 0.25 },
];

/** The drops of one kind of book. */
export const bookDrops = (book: BookKind): Array<{ kind: string; odds: number }> => BOOK_DROPS.filter((d) => d.book === book);
