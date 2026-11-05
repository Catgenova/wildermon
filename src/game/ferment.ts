import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { describeFrom, type Item } from './items';
import { fermentLeftSaid, fermentRecipes, madeSaid, recipeTitle, SEALED_ITEM, type Recipe } from './recipes';

/**
 * Ferments and ageings: a recipe that is set going rather than made (`Recipe.ferment`).
 *
 * A go at one uses its inputs up as any craft does, its vessel among them, and puts a Sealed vessel in the pack in place
 * of what it makes: at the go's QL and rarity, named for what it will be (`recipeTitle` in `extra`), ready `seconds` of
 * game time after (`charges`). Opened before then it says how long is left; opened after, it gives the recipe's result,
 * as many as a go makes, at the vessel's QL, and the vessel back. One that wants a cellar is set going only standing in
 * one (`fermentPlaceOk`).
 *
 * The island's `ferment_recipes`, the `ferment_seal` branch of `perform_craft`, and `open_ferment` as a relic use
 * (`relic_use_refusal`, `perform_relic_use`).
 */

/** What opening one is. */
export const OPEN_FERMENT = 'open_ferment';
/** The quality a vessel comes back at, as a recipe's `returns` do. */
export const VESSEL_BACK_QL = 20;

/** The ferment recipe a sealed vessel holds, off its `extra`, or none. */
export const fermentOf = (item: Pick<Item, 'id' | 'extra'> | null | undefined): Recipe | undefined =>
  item?.id === SEALED_ITEM ? fermentRecipes().find((r) => recipeTitle(r) === item.extra) : undefined;

/** Game seconds until a sealed vessel may be opened; none once it is ready. */
export const fermentLeft = (g: Game, item: Pick<Item, 'charges'>): number => Math.max(0, (item.charges ?? 0) - g.time);

/** What opening one too soon says. The island says the same. */
export const fermentNotReady = (left: number): string => `Ready in ${fermentLeftSaid(left)}.`;

const held = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get(t.uid) : undefined);

/** Why a sealed vessel will not be opened, or null. */
export function openFermentRefusal(g: Game, t: Target): string | null {
  const it = held(g, t);
  if (!it || !fermentOf(it)) return 'It is gone.';
  const left = fermentLeft(g, it);
  return left > 0 ? fermentNotReady(left) : null;
}

export const FERMENT_ACTIONS: ActionDef[] = [
  {
    id: OPEN_FERMENT,
    label: 'Open',
    verb: 'opening it',
    stamina: 0.01,
    baseTime: 3,
    applies: (t, g) => held(g, t)?.id === SEALED_ITEM,
    check: (t, g) => openFermentRefusal(g, t),
    perform: (t, g) => {
      if (openFermentRefusal(g, t)) return;
      const it = held(g, t)!;
      const r = fermentOf(it)!;
      const { ql, rare } = it;
      if (!g.inventory.remove(it.uid, 1)) return;
      const n = r.count ?? 1;
      g.inventory.add(r.result, { count: n, ql, ...(r.extra ? { extra: r.extra } : {}), ...(rare ? { rare } : {}) });
      g.inventory.add(r.ferment!.vessel, { ql: VESSEL_BACK_QL });
      g.madeIt(r.result, ql, n, rare ?? 0);
      g.events.emit('inventory');
      g.logMsg(madeSaid(r.result, n, undefined, ql, r.done), 'event');
    },
  },
];

describeFrom(SEALED_ITEM, { back: VESSEL_BACK_QL });
