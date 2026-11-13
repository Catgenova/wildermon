import type { Item, Mark } from '../../game/items';
import type { SmeltJob } from '../../game/smelter';
import { isFields, isNum, type Fields } from './read';

const strOr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/**
 * What a furnace off the island is working on and has finished, as things the
 * browser knows.
 *
 * The island writes a finished piece as `{def, ql, count, extra}` — its own
 * shape for a thing — and a job as `{makes, left, total, ql}` with nothing
 * about what went in. The browser's item has an `id`, and its job has an
 * `item`. Reported from the island as a right-click on a smelter that locked
 * the game up: the menu named what was finished in it, a piece with no `id`
 * has no name, and a name with nothing in it cannot be lowercased. The list
 * had been taken as it came, cast and not looked at.
 *
 * The uid is the furnace's and the piece's place in it, negative so it can
 * never be a uid of anything in the pack, and the same on every read so a
 * menu built off one read and used after the next still names the same
 * piece.
 *
 * An entry that is not an object is passed over; its place still counts, so
 * the uids of the rest do not move.
 */
export function furnaceOutput(furnace: number, rows: unknown[] | undefined): Item[] {
  const out: Item[] = [];
  (rows ?? []).forEach((raw, i) => {
    if (!isFields(raw)) return;
    const o: Fields = raw;
    out.push({
      uid: isNum(o.uid) ? o.uid : -(furnace * 1000 + i + 1),
      id: strOr(o.id) ?? strOr(o.def) ?? 'lump',
      ql: isNum(o.ql) ? o.ql : 1,
      dmg: isNum(o.dmg) ? o.dmg : 0,
      count: isNum(o.count) ? o.count : 1,
      extra: strOr(o.extra),
      piece: strOr(o.piece),
      // The island's own `Mark`, carried as it came.
      ...(isFields(o.mark) ? { mark: o.mark as Mark } : {}),
    });
  });
  return out;
}

/** And the jobs, each with something in the `item` a local finish would read. */
export function furnaceJobs(rows: unknown[] | undefined): SmeltJob[] {
  const out: SmeltJob[] = [];
  for (const raw of rows ?? []) {
    if (!isFields(raw)) continue;
    const ql = isNum(raw.ql) ? raw.ql : 1;
    const extra = strOr(raw.extra);
    const makes = strOr(raw.makes) ?? '';
    const left = isNum(raw.left) ? raw.left : 0;
    out.push({
      // An `item` the island put there itself, carried as it came; else one made up from what it makes.
      item: isFields(raw.item) ? raw.item as unknown as Item : { uid: 0, id: extra ? `${extra.toLowerCase()}_lump` : makes, ql, dmg: 0, count: 1 },
      makes,
      left,
      total: isNum(raw.total) ? raw.total : left,
      ql,
      extra,
      piece: strOr(raw.piece),
    });
  }
  return out;
}
