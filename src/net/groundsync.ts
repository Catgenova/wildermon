/**
 * What the browser holds of the ground read's burning half (`rpc_ground`), so it asks for only what changed.
 *
 * The island hands every answer a cursor (`at`); handed back, the next answer's `placed`, `lying` and `cellarLying`
 * carry only the rows sent again (written since, come into range or into reach, or ones whose answer moves without
 * their row being written: one burning, a well, a grave), and `ids`, every id in each list now. This keeps every row
 * as it came, lets go of the ones no longer listed, and lays each list again whole, in the island's order (by id),
 * so what the game is handed is what the whole answer says. `crates` and the slow half come whole on every answer
 * that has them, and pass through as they came. The whole answer is asked for with every slow half
 * (`RECONCILE_EVERY` seconds, and after anything we do).
 */

/** The lists the island sends only what changed of, as the answer names them. */
export const GROUND_LISTS = ['placed', 'lying', 'cellarLying'] as const;
type List = (typeof GROUND_LISTS)[number];

/** A row of any of those lists: all the browser needs of it here is its id. */
type Row = { id: number } & Record<string, unknown>;

/** An answer in the new shape: the cursor, whether it is the whole answer, the ids in each list, and the rest. */
export interface GroundAnswer {
  at?: unknown;
  full?: unknown;
  ids?: unknown;
  [key: string]: unknown;
}

const rowsOf = (v: unknown): Row[] | null =>
  Array.isArray(v) ? (v as unknown[]).filter((r): r is Row => !!r && typeof r === 'object' && typeof (r as Row).id === 'number') : null;

export class GroundHeld {
  /** The cursor the last answer laid carried, to hand back; null until there is one. */
  at: string | null = null;
  private held: Record<List, Map<number, Row>> = { placed: new Map(), lying: new Map(), cellarLying: new Map() };

  /** Nothing held: the next answer asked for is the whole one. */
  clear(): void {
    this.at = null;
    for (const k of GROUND_LISTS) this.held[k].clear();
  }

  /**
   * Lay an answer and give back the ground as the whole answer says it, in the shape it always had (no `at`, `full`
   * or `ids`); or null for an answer that is not one, or one that names a row this side does not hold, which leaves
   * what is held as it was and asks for the whole answer next.
   */
  take(said: GroundAnswer): Record<string, unknown> | null {
    if (!said || typeof said !== 'object' || Array.isArray(said) || typeof said.at !== 'string') return null;
    const full = said.full === true;
    const ids = said.ids as Record<string, unknown> | undefined;
    const sent = {} as Record<List, Row[]>;
    for (const k of GROUND_LISTS) {
      const rows = rowsOf(said[k]);
      if (!rows) return null;
      sent[k] = rows;
      if (!full && (!ids || !Array.isArray(ids[k]))) return null;
    }
    // Every id the island lists must be held after this answer: a row it did not send again is one already here.
    if (!full) {
      for (const k of GROUND_LISTS) {
        const fresh = new Set(sent[k].map((r) => r.id));
        for (const id of ids![k] as unknown[]) if (!fresh.has(Number(id)) && !this.held[k].has(Number(id))) return this.lost();
      }
    }
    for (const k of GROUND_LISTS) {
      const keep = full ? null : new Set((ids![k] as unknown[]).map(Number));
      const held = this.held[k];
      if (keep) {
        for (const id of [...held.keys()]) if (!keep.has(id)) held.delete(id);
      } else held.clear();
      for (const r of sent[k]) held.set(r.id, r);
    }
    this.at = said.at;
    const out: Record<string, unknown> = { ...said };
    delete out.at;
    delete out.full;
    delete out.ids;
    for (const k of GROUND_LISTS) out[k] = [...this.held[k].values()].sort((a, b) => a.id - b.id);
    return out;
  }

  /** This side has lost step with the island: nothing held, and the whole answer next. */
  private lost(): null {
    this.clear();
    return null;
  }
}
