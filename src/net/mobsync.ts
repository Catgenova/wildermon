/**
 * What the browser holds of the creatures read (`rpc_creatures`), so it asks for only what changed.
 *
 * The island hands every answer a cursor (`at`); handed back with the ids held (`p_have`), the next answer carries
 * only the rows written since, the ones not held, and `gone`. This keeps every row as it came and lays the whole
 * list again on each answer, each row as a whole answer would read it now: what counts down on a row (a leg, a blow
 * drawn back, a stun, a slow, a meal, young due) counted down by the seconds since it came, and where it stands
 * along its leg worked out again as the island works it out (`creature_x`). What only moves with the clock and not
 * by the second (an age, a shoe worn out) waits for the whole answer, which the island is asked for every
 * `RECONCILE_EVERY` seconds and after anything we do.
 *
 * Asked for packed (`p_pack`), each row comes as an array: its values in the order of `cols`, which the whole answer
 * carries, and then one object with whatever else it says. The keys are laid back on here, so a row is held as the
 * object the whole answer in the old shape says (`unpack`).
 */
import type { IslandCreature } from '../game/creatures';

/** An answer in the new shape: the cursor, the rows, the ids no longer in it, and whether it is the whole answer. */
export interface MobsAnswer {
  at?: unknown;
  rows?: unknown;
  gone?: unknown;
  full?: unknown;
  /** Packed: the keys of a row's values, in order; on the whole answer. */
  cols?: unknown;
}

/**
 * A packed row as the object it stands for: each of `cols` with the value in its place, and then what else it says
 * (the last element); null for one that is not a packed row of these columns.
 */
export function unpack(row: unknown, cols: readonly string[]): IslandCreature | null {
  if (!Array.isArray(row) || row.length !== cols.length + 1) return null;
  const more = row[cols.length];
  if (!more || typeof more !== 'object' || Array.isArray(more)) return null;
  const out: Record<string, unknown> = {};
  for (let i = 0; i < cols.length; i++) out[cols[i]] = row[i];
  Object.assign(out, more);
  return typeof out.id === 'number' ? (out as unknown as IslandCreature) : null;
}

/** Seconds off a count down, and null once it has run out, as the island says of one that has. */
const less = (v: number | null | undefined, secs: number): number | null | undefined =>
  typeof v === 'number' ? (v - secs > 0 ? v - secs : null) : v;

/**
 * A row as the island would say it `secs` seconds after it did, for a creature whose row has not been written since.
 */
export function agedMob(r: IslandCreature, secs: number): IslandCreature {
  if (!(secs > 0)) return r;
  // The island says null of a count down that has run out, whatever the type says of it.
  const out: Record<string, unknown> = { ...r };
  if (typeof r.legLeft === 'number') {
    const left = Math.max(0, r.legLeft - secs);
    out.legLeft = left;
    // Along the leg as `leg_t` puts it: the share of it walked, and the end of it once it is.
    if (typeof r.fromX === 'number' && typeof r.fromY === 'number' && typeof r.toX === 'number' && typeof r.toY === 'number') {
      const t = typeof r.legFor === 'number' && r.legFor > 0 ? Math.min(1, Math.max(0, 1 - left / r.legFor)) : 1;
      out.x = r.fromX + (r.toX - r.fromX) * t;
      out.y = r.fromY + (r.toY - r.fromY) * t;
    }
  }
  for (const k of ['windup', 'stunned', 'slowed', 'fedLeft', 'dueIn'] as const) {
    if (k in r) out[k] = less(r[k], secs);
  }
  // And what goes with a slow and a meal, said only while they last.
  if (out.slowed === null) out.slowPace = null;
  if (out.fedLeft === null) out.fed = null;
  return out as unknown as IslandCreature;
}

export class MobsHeld {
  /** The cursor the last answer carried, to hand back; null until there is one. */
  at: string | null = null;
  /** The keys of a packed row, as the last whole answer said them. */
  private cols: string[] | null = null;
  /** Every row held, by id, with the moment (ms) it came. */
  private rows = new Map<number, { row: IslandCreature; t: number }>();

  /** The ids held, for `p_have`. */
  have(): number[] {
    return [...this.rows.keys()];
  }

  /** Nothing held: the next answer asked for is the whole one. */
  clear(): void {
    this.at = null;
    this.cols = null;
    this.rows.clear();
  }

  /**
   * Lay an answer that came at `t` (ms) and give back every creature in it as the whole answer would read it at
   * `t`, by id; or null for an answer that is not one, which leaves what is held as it was.
   */
  take(said: MobsAnswer, t: number): IslandCreature[] | null {
    if (!said || typeof said !== 'object' || !Array.isArray(said.rows) || typeof said.at !== 'string') return null;
    const cols = Array.isArray(said.cols) && said.cols.every((c) => typeof c === 'string') ? said.cols as string[] : said.full === true ? null : this.cols;
    // Every row as the object it stands for, before anything held is touched: one that will not unpack (packed with
    // columns this side does not hold) leaves what is held as it was, and the whole answer is asked for next.
    const rows: IslandCreature[] = [];
    for (const r of said.rows as unknown[]) {
      const row = Array.isArray(r) ? (cols ? unpack(r, cols) : null) : r as IslandCreature;
      if (Array.isArray(r) && !row) return this.lost();
      if (row && typeof row === 'object' && typeof row.id === 'number') rows.push(row);
    }
    if (said.full === true) {
      this.rows.clear();
      this.cols = cols;
    }
    if (Array.isArray(said.gone)) for (const id of said.gone) this.rows.delete(Number(id));
    for (const r of rows) this.rows.set(r.id, { row: r, t });
    this.at = said.at;
    return this.all(t);
  }

  /** This side has lost step with the island: nothing held, and the whole answer next. */
  private lost(): null {
    this.clear();
    return null;
  }

  /** Every creature held, by id, as the whole answer would read it at `t` (ms). */
  all(t: number): IslandCreature[] {
    return [...this.rows.values()]
      .sort((a, b) => a.row.id - b.row.id)
      .map((h) => agedMob(h.row, (t - h.t) / 1000));
  }
}
