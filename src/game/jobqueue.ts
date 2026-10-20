/**
 * The jobs lined up behind the one in hand, put in another order or thinned.
 *
 * Asked for: a list of everything queued that can be reordered and pruned.
 * The job in hand is never in the list (`Game.action` here, `player.act` on
 * the island), so nothing done to the list can move it; only what waits
 * behind it moves. The island does the same in `rpc_queue_order`
 * (`a_queue_put_in_order.sql`), in the same words.
 *
 * An order is the places, counted from nought, of the jobs as they were seen,
 * in the order they are to go: `[2, 0, 1]` brings the third to the front, and
 * a place left out is a job put out of mind. It is checked against what was
 * seen, so a list that moved on under the pointer -- the job in hand finished
 * and the next came off the front -- is refused rather than shuffled wrong.
 */

/** A job as the list shows it: what it is and how many goes. */
export interface SeenJob {
  action: string;
  goes: number;
}

/** The list changed between being drawn and being reordered. */
export const QUEUE_MOVED = 'Queue changed first: nothing moved.';
/** An order that is not a set of places in the list: one out of range, or one twice. */
export const QUEUE_NO_ORDER = 'Not an order of the queued jobs: nothing moved.';

/** What a dropped job is said as, in the log: the same line `clearQueue` says for the lot. */
export const queueDropped = (labels: readonly string[]): string =>
  labels.length === 1 ? `Dropped from queue: ${labels[0].toLowerCase()}.` : `Dropped from queue: ${labels.length} jobs.`;

/** The list as it is seen: each job's action and its goes, never under one. */
export const seenOf = (queue: ReadonlyArray<{ def: { id: string }; goes?: number }>): SeenJob[] =>
  queue.map((q) => ({ action: q.def.id, goes: Math.max(1, q.goes ?? 1) }));

/** Why this order cannot be put on a list that is `now`, having been `seen`, or null. */
export function orderRefusal(seen: readonly SeenJob[], now: readonly SeenJob[], order: readonly number[]): string | null {
  if (seen.length !== now.length || seen.some((s, i) => s.action !== now[i].action || s.goes !== now[i].goes)) return QUEUE_MOVED;
  if (order.some((k) => !Number.isInteger(k) || k < 0 || k >= now.length) || new Set(order).size !== order.length) return QUEUE_NO_ORDER;
  return null;
}

/** A list moved: one job taken from `from` and put at `to`, as an order. */
export const moveOrder = (n: number, from: number, to: number): number[] => {
  const order = Array.from({ length: n }, (_, i) => i);
  const [k] = order.splice(from, 1);
  order.splice(Math.max(0, Math.min(n - 1, to)), 0, k);
  return order;
};

/** A list with one job taken out, as an order. */
export const dropOrder = (n: number, at: number): number[] => Array.from({ length: n }, (_, i) => i).filter((i) => i !== at);
