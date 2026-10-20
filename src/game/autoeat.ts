import { ACTION_BY_ID } from './actions';
import { EXHAUSTED } from './body';
import type { Game } from './game';
import { itemDef, markOf, type Item } from './items';

/**
 * Eating by itself (`settings.autoEat`).
 *
 * A long run of work stalls when Food runs out, and the only cure was to stop,
 * eat and set it going again. With this on, when Food falls under the share
 * chosen, an Eat goes in behind the job in hand -- the same job as a click
 * on the food, asked of the island when there is one -- for the food in your
 * pack that fills most, or the worst of it first. It never cuts a job short,
 * never touches a locked stack or what is in a bag, and leaves "Do it again"
 * aimed at what you last asked for.
 */

/** The shares of Food it may be set to eat under; nought is never. */
export const AUTO_EAT_AT = [0, 0.2, 0.3, 0.5] as const;
/** Seconds between two looks, and the least between two asks, so a refusal is not asked again every frame. */
const LOOK_EVERY = 2;
const ASK_EVERY = 10;
/** Seconds between two lines saying there is nothing to eat. */
const NOTHING_EVERY = 300;

/** What a mouthful of it puts on Food, as the Eat job works it out. */
export const fillOf = (item: Item): number => (itemDef(item.id).food ?? 0) * (0.7 + item.ql / 200) * markOf(item, 'fill');

/** The food it would eat now: loose in the pack, not locked; the one that fills most, or the worst first. */
export function foodToEat(g: Game, worst = g.settings.autoEatWorst): Item | null {
  const foods = g.inventory.items.filter((it) => !!itemDef(it.id).food && !it.locked && it.count > 0);
  if (!foods.length) return null;
  return foods.reduce((a, b) => (worst ? (b.ql < a.ql ? b : a) : (fillOf(b) > fillOf(a) ? b : a)));
}

export class AutoEat {
  private lookedAt = -Infinity;
  private askedAt = -Infinity;
  private saidAt = -Infinity;

  constructor(private readonly g: Game) {}

  /** Called every frame, with the time in seconds. */
  update(now: number): void {
    const g = this.g;
    const under = g.settings.autoEat;
    if (!under || now - this.lookedAt < LOOK_EVERY) return;
    this.lookedAt = now;
    if (g.player.stats.hunger >= under) return;
    // One Eat at a time: already eating, or one waiting its turn.
    if (g.action?.def.id === 'eat' || g.queue.some((q) => q.def.id === 'eat')) return;
    // Nothing that would only be refused: too spent to do anything, or no room to hold one more job.
    if (g.player.stats.stamina < EXHAUSTED || (g.action && g.queue.length >= g.queueCapacity())) return;
    if (now - this.askedAt < ASK_EVERY) return;
    const eat = ACTION_BY_ID.get('eat');
    const food = foodToEat(g);
    if (!eat || !food) {
      if (now - this.saidAt >= NOTHING_EVERY) {
        this.saidAt = now;
        g.logMsg(`Food under ${Math.round(under * 100)}%: nothing to eat in your pack.`, 'error');
      }
      return;
    }
    this.askedAt = now;
    // Asked as a click on it would be, without taking "Do it again" off what you asked for last.
    const last = g.lastAsked;
    g.requestAction(eat, { kind: 'item', uid: food.uid });
    g.lastAsked = last;
  }
}
