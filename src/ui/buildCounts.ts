/**
 * Building a planned piece a number of goes at a time.
 *
 * Asked for: "Allow bulk actions when building structures like walls and floors, e.g. build 5 10 25 50 instead of
 * having to click Build Wall 50x". Each go of Build wall or Build floor fits one piece of what the bill still needs
 * (`consumeUnit`). On an island a job runs the goes it is asked for and no more (`rpc_act`'s `p_times`), so a
 * wall of fifty logs was fifty clicks. A row for one now opens onto counts, and the job stops early, as a counted job
 * always has, once the piece is finished or nothing it needs is to hand.
 */
import type { ActionDef, Target } from '../game/actions';
import type { Bill } from '../game/building';
import type { Game } from '../game/game';
import type { MenuItem } from './contextmenu';

/** The counts offered past one, each where the piece still needs more than it. */
export const BUILD_COUNTS = [5, 10, 25, 50] as const;
/** The most goes one ask is taken for, as the island takes it (`rpc_act`'s `p_times`). */
export const MOST_GOES = 100;

/** How many goes a piece still wants: one for each unit of anything its bill still needs. */
export const goesLeft = (bill: Bill): number => Object.values(bill.needed).reduce((n, k) => n + Math.max(0, k), 0);

/**
 * A row for building a piece, opening onto counts where it wants more than one go: one, each of `BUILD_COUNTS` under
 * what it still needs, and all of it (up to `MOST_GOES` an ask). Barred, or wanting one go, it is the plain row.
 */
export function buildRow(g: Game, def: ActionDef, target: Target, label: string, bill: Bill, reason: string | null): MenuItem {
  const left = goesLeft(bill);
  const run = (goes: number) => () => g.requestAction(def, target, goes);
  if (reason || left <= 1) return { label, hint: reason ?? undefined, disabled: !!reason, onSelect: run(1) };
  const all = Math.min(left, MOST_GOES);
  const counts = [1, ...BUILD_COUNTS.filter((n) => n < all)];
  return {
    label,
    children: [
      ...counts.map((n) => ({ label: `Fit ${n}`, note: `${n} of the ${left} still needed`, onSelect: run(n) })),
      { label: all === left ? `Fit all ${left}` : `Fit ${all}`, note: all === left ? 'until finished' : `of ${left} needed; max per go`, onSelect: run(all) },
    ],
  };
}
