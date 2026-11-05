import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { itemDef, ITEM_DEFS, type Item, type ServeDef } from './items';

/**
 * A dish for a group (`ItemDef.serve`): one dish, served out in shares.
 *
 * Serving it uses the dish up and hands one share (`serve.serving`, a food of its own) to each other player awake and
 * ashore within `serve.reach` tiles, nearest first, up to one fewer than `serve.count`; the rest go to the server. Each
 * share is at the dish's QL. Nobody reaches into anybody's pack: what is handed out is handed to them.
 *
 * The island's `serve_dishes` and `serve_dish` as a relic use (`relic_use_refusal`, `perform_relic_use`), which hands
 * the shares out; the browser knows the others only as `folkAshore` does, and says the same count.
 */

/** What serving one is. */
export const SERVE_DISH = 'serve_dish';
/** Shares handed to each other player in reach when a dish is served; the island's `serve_dish` hands the same. */
export const SHARES_EACH = 1;

/** The dishes for a group, by item id. */
export const serveDishes = (): Array<[string, ServeDef]> =>
  Object.entries(ITEM_DEFS).filter((e): e is [string, typeof e[1] & { serve: ServeDef }] => !!e[1].serve).map(([id, d]) => [id, d.serve]);

/** What serving a dish says to whoever served it: its shares out and kept. The island says the same. */
export const servedSays = (dish: string, others: number, mine: number): string =>
  `Served: ${itemDef(dish).name.toLowerCase()}. Shares: ${others} to others, ${mine} to you.`;
/** What a share handed to you says. The island says the same. */
export const servedYouSays = (serving: string, by: string): string =>
  `Served to you: ${itemDef(serving).name.toLowerCase()}, by ${by}.`;

const held = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get(t.uid) : undefined);

/** The other players in reach of a share, as far as the browser knows them: awake, ashore, nearest first. */
export function othersInReach(g: Game, reach: number): number {
  return (g.folkAshore ?? []).filter((f) => f.online && f.x !== undefined && f.y !== undefined
    && Math.hypot(f.x - g.player.x, f.y - g.player.y) <= reach).length;
}

export const FEAST_ACTIONS: ActionDef[] = [
  {
    id: SERVE_DISH,
    label: 'Serve',
    verb: 'serving it',
    stamina: 0.01,
    baseTime: 4,
    applies: (t, g) => !!itemDef(held(g, t)?.id ?? '').serve,
    check: (t, g) => (itemDef(held(g, t)?.id ?? '').serve ? null : 'It is gone.'),
    perform: (t, g) => {
      const it = held(g, t);
      const serve = it ? itemDef(it.id).serve : undefined;
      if (!it || !serve) return;
      const { ql, id } = it;
      if (!g.inventory.remove(it.uid, 1)) return;
      const others = Math.min(Math.max(0, serve.count - SHARES_EACH), othersInReach(g, serve.reach) * SHARES_EACH);
      const mine = serve.count - others;
      g.inventory.add(serve.serving, { count: mine, ql });
      g.events.emit('inventory');
      g.logMsg(servedSays(id, others, mine), 'event');
    },
  },
];
