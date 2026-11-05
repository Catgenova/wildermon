import { itemDef } from './items';
import { recipeTitle, stationName, type Recipe } from './recipes';
import { SKILL_DEFS } from './skills';

/**
 * What the crafting window's search reads off a recipe, and whether a shut
 * recipe not yet read (`recipeUnread`) is listed at all.
 *
 * An open recipe answers to everything on its row: what it makes, the trade,
 * the station, the tool and every material. A shut one unread is not listed
 * unless "Show locked" is ticked, and then answers to its own name only, so a
 * search for a common material is not buried under dishes nobody can make yet.
 * Once read it is an open recipe like any other.
 */

const skillName = (id: string): string => SKILL_DEFS.find((s) => s.id === id)?.name ?? id;
const lower = (id: string): string => itemDef(id).name.toLowerCase();

/** Everything on an open recipe's row, lower case, for the search. */
export function recipeWords(r: Recipe): string {
  return [itemDef(r.result).name, r.label, r.note ?? '', r.category, skillName(r.skill), r.tool ? lower(r.tool) : '', r.station ? stationName(r.station) : '',
    r.deed ? 'settlement deed' : '', ...r.inputs.map((i) => lower(i.item))].join(' ').toLowerCase();
}

/** A shut recipe's own name, lower case: its title and what it makes. */
export const recipeNameWords = (r: Recipe): string => `${recipeTitle(r)} ${itemDef(r.result).name}`.toLowerCase();

/**
 * How a recipe stands against what has been typed (`query`, trimmed, lower
 * case; empty for none): `'listed'` when it is on the page; `'hidden'` when it
 * is a shut recipe unread that would be on the page with "Show locked" ticked,
 * for the count at the foot; `'no'` otherwise.
 */
export function recipeSearch(r: Recipe, query: string, unread: boolean, showLocked: boolean): 'listed' | 'hidden' | 'no' {
  if (!unread) return !query || recipeWords(r).includes(query) ? 'listed' : 'no';
  const named = !query || recipeNameWords(r).includes(query);
  if (!named) return 'no';
  return showLocked ? 'listed' : 'hidden';
}

/** The line at the foot of a search that matched shut recipes left off the page: "Locked recipes: 3 · Show". */
export const lockedHiddenSays = (n: number): string => `Locked recipes: ${n} · Show`;
