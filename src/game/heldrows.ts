/**
 * What a ground read says, laid over what is already held, by id.
 *
 * A ground read comes about once a second and names everything set down near
 * you. It used to clear every collection and build every crate, fire and
 * stick of furniture again, and file them all by tile again, though nearly
 * every read says exactly what the last one said. Now each piece the island
 * names again keeps the object it had, and what the read says is written
 * into it key by key, so it holds exactly what a fresh one built from the
 * read would hold. One that has a key the read no longer carries is let go
 * for the fresh one. Only when something is new, gone, let go, reordered or
 * standing somewhere else is the collection laid out again and the index of
 * what stands where rebuilt.
 */

/** Whether two values read off the island are the same: numbers, strings, arrays and plain objects, all the way down. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return a !== a && b !== b;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const pa = Object.getPrototypeOf(a), pb = Object.getPrototypeOf(b);
  if ((pa !== Object.prototype && pa !== null) || pa !== pb) return false;
  const A = a as Record<string, unknown>, B = b as Record<string, unknown>;
  for (const k in A) if (!Object.prototype.hasOwnProperty.call(B, k) || !same(A[k], B[k])) return false;
  for (const k in B) if (!Object.prototype.hasOwnProperty.call(A, k)) return false;
  return true;
}

/**
 * Keys that change on every read without anything having happened: the
 * caller's own (`team` and `worker`, made again from the creatures after
 * every read, and a trap's `checkAt`, which is the moment of the read), and
 * what this side draws forward between one read and the next (fuel burning
 * down, a brazier's at more than a second a second, ash building up, a well
 * filling, a wine working; absent counts as none) or what lands a few milliseconds of latency later each time (moss
 * and ivy begun, a grave's hour). Written as the read says, as every key is;
 * not news to a window showing them unless they are further out than that.
 * A well filling here says it holds water before the island does, which is
 * not news either: what it holds is (`litres`).
 */
const OWN = new Set(['team', 'worker', 'checkAt']);
const DRAWN: Record<string, number> = { fuel: 60, ash: 0.5, litres: 2, ferment: 2, greenSince: 5 };
/** Within `by` of each other. A fire burnt out is news by its `lit`, which is not one of these. */
const near = (a: unknown, b: unknown, by: number): boolean => {
  if (a === b) return true;
  if ((typeof a !== 'number' && a !== undefined) || (typeof b !== 'number' && b !== undefined)) return same(a, b);
  return Math.abs((a ?? 0) - (b ?? 0)) <= by;
};
const sameLiquid = (a: unknown, b: unknown): boolean => a === b || (a ?? 'water') === (b ?? 'water');
const graveSame = (a: unknown, b: unknown): boolean => {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return same(a, b);
  const A = a as Record<string, unknown>, B = b as Record<string, unknown>;
  return same({ ...A, crumbles: 0 }, { ...B, crumbles: 0 }) && near(A.crumbles, B.crumbles, 5);
};

/** A vehicle's team, which `teamsFromCreatures` makes again after every read from nothing: left on it for that to do. */
const REMADE = 'team';
/** What writing a read into a held piece found. */
const NEWS = 1, GONE = 2;
/**
 * Write `fresh` into `held`, so `held` carries the values `fresh` does; a
 * value the same all the way down as the one held is left as the one held.
 * `NEWS` when anything changed that a window showing the piece would show
 * differently; `GONE` when `held` has a key `fresh` does not, which is not
 * taken off it (an object a key is deleted from is slow to read ever after,
 * and so is every loop over the collection it is in): the caller keeps
 * `fresh` in its place instead.
 */
function writeInto(held: Record<string, unknown>, fresh: Record<string, unknown>): number {
  let news = 0, shared = 0;
  const had = Object.keys(held).length;
  for (const k in fresh) {
    const was = held[k], now = fresh[k];
    const has = was !== undefined || k in held;
    if (has) shared++;
    if (has && (was === now || (typeof now === 'object' && now !== null && typeof was === 'object' && same(was, now)))) continue;
    held[k] = now;
    if (OWN.has(k)) continue;
    const by = DRAWN[k];
    if (by !== undefined ? !near(was, now, by) : k === 'grave' ? !graveSame(was, now) : k === 'liquid' ? !sameLiquid(was, now) : true) news = NEWS;
  }
  if (had === shared) return news;
  for (const k in held) if (k !== REMADE && !(k in fresh)) return NEWS | GONE;
  return news;
}

/** What laying a read over a collection did. */
export interface Laid {
  /** Something is new, gone, in another order or standing somewhere else: the index of where things stand wants making again. */
  moved: boolean;
  /** Anything changed that a window showing it would show differently. */
  news: boolean;
}

/**
 * Lay what a read built (`fresh`, in the read's order) over what is held,
 * by id, and empty `fresh` for the next read. Afterwards `held` holds what
 * it would hold had it been cleared and filled from `fresh`, in the same
 * order, but each piece named again is the object it was.
 */
export function layOver<T extends { id: number; x: number; y: number; level?: number }>(held: Map<number, T>, fresh: Map<number, T>): Laid {
  let moved = held.size !== fresh.size;
  if (!moved) {
    const ids = held.keys();
    for (const id of fresh.keys()) if (ids.next().value !== id) { moved = true; break; }
  }
  let news = moved;
  for (const [id, f] of fresh) {
    const h = held.get(id);
    if (!h) continue;
    if (h.x !== f.x || h.y !== f.y || h.level !== f.level) moved = true;
    const said = writeInto(h as unknown as Record<string, unknown>, f as unknown as Record<string, unknown>);
    if (said & NEWS) news = true;
    // Something it had is not said any more: the fresh one, as it was before any of this, and filed again.
    if (said & GONE) moved = true;
    else fresh.set(id, h);
  }
  if (moved) {
    held.clear();
    for (const [id, h] of fresh) held.set(id, h);
  }
  fresh.clear();
  return { moved, news };
}
