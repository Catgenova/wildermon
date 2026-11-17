/**
 * What the browser holds of the ground read's burning half (`rpc_ground`), so it asks for only what changed.
 *
 * The island hands every answer a cursor (`at`); handed back, the next answer's `placed`, `lying` and `cellarLying`
 * carry only the rows sent again (written since, come into range or into reach, or ones whose answer moves without
 * their row being written: one burning, a well, a grave), and `ids`, every id in each list now. This keeps every row
 * as it came, lets go of the ones no longer listed, and lays each list again whole, in the island's order (by id),
 * so what the game is handed is what the whole answer says. `crates` come whole, or are left out of an answer that
 * is not whole when they are as the cursor had them (its `c<hash>:`), and then are the ones held. The slow half
 * comes whole on every answer that has it, and passes through as it came. The whole answer is asked for with every
 * slow half (`RECONCILE_EVERY` seconds, and after anything we do).
 *
 * Asked as a browser that keeps what it holds (`p_keep`): a piece sent again without `things` keeps the contents
 * held for it. And the slow half's walls and floors (`p_build_since`, the `bat` of the last slow answer): an answer
 * whose `buildings` says `delta` carries only the walls and floors sent again, and every key in range (`wallKeys`,
 * `floorKeys`) when one may be gone; the rest are the ones held. A wall's `greenAgo` is held as the moment it says,
 * and given again as the seconds since then.
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

/** A wall's key and a floor's, as the island lists them in `wallKeys` and `floorKeys`. */
type Built = Record<string, unknown>;
const wallKey = (w: Built): string => `${w.level},${w.dir},${w.x},${w.y}`;
const floorKey = (f: Built): string => `${f.level},${f.x},${f.y}`;
const builtOf = (v: unknown): Built[] | null =>
  Array.isArray(v) ? (v as unknown[]).filter((r): r is Built => !!r && typeof r === 'object') : null;
const keysOf = (v: unknown): string[] | null => (Array.isArray(v) ? (v as unknown[]).map(String) : null);

const rowsOf = (v: unknown): Row[] | null =>
  Array.isArray(v) ? (v as unknown[]).filter((r): r is Row => !!r && typeof r === 'object' && typeof (r as Row).id === 'number') : null;

export class GroundHeld {
  /** The cursor the last answer laid carried, to hand back; null until there is one. */
  at: string | null = null;
  private held: Record<List, Map<number, Row>> = { placed: new Map(), lying: new Map(), cellarLying: new Map() };
  /** The crates of the last answer that had them, for one that leaves them out. */
  private crates: unknown[] | null = null;
  /** The cursor for the walls and floors (`bat`), from the last slow answer laid; null until there is one. */
  bat: string | null = null;
  /** The walls and floors held, by key, and the moment each wall's ivy began (`greenAgo` on this machine's clock). */
  private walls: Map<string, Built> | null = null;
  private floors: Map<string, Built> | null = null;
  private greenAt = new Map<string, number>();

  /** Nothing held: the next answer asked for is the whole one. */
  clear(): void {
    this.at = null;
    this.crates = null;
    for (const k of GROUND_LISTS) this.held[k].clear();
    this.bat = null;
    this.walls = null;
    this.floors = null;
    this.greenAt.clear();
  }

  /**
   * Lay an answer and give back the ground as the whole answer says it, in the shape it always had (no `at`, `full`
   * or `ids`); or null for an answer that is not one, or one that names a row this side does not hold, which leaves
   * what is held as it was and asks for the whole answer next.
   */
  take(said: GroundAnswer, now = Date.now() / 1000): Record<string, unknown> | null {
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
    // Crates left out are the ones held; with none held, this side has lost step.
    const crates = Array.isArray(said.crates) ? said.crates : null;
    if (!crates && (full || said.crates !== undefined || !this.crates)) return this.lost();
    // Every id the island lists must be held after this answer: a row it did not send again is one already here.
    if (!full) {
      for (const k of GROUND_LISTS) {
        const fresh = new Set(sent[k].map((r) => r.id));
        for (const id of ids![k] as unknown[]) if (!fresh.has(Number(id)) && !this.held[k].has(Number(id))) return this.lost();
      }
    }
    // A piece sent again without its contents keeps the ones held; one this side never held them for is lost step.
    for (const r of sent.placed) {
      if (r.things !== undefined) continue;
      const was = this.held.placed.get(r.id);
      if (!was || was.things === undefined) return this.lost();
      r.things = was.things;
    }
    const buildings = this.build(said.buildings, now);
    if (buildings === false) return this.lost();
    for (const k of GROUND_LISTS) {
      const keep = full ? null : new Set((ids![k] as unknown[]).map(Number));
      const held = this.held[k];
      if (keep) {
        for (const id of [...held.keys()]) if (!keep.has(id)) held.delete(id);
      } else held.clear();
      for (const r of sent[k]) held.set(r.id, r);
    }
    this.at = said.at;
    if (crates) this.crates = crates;
    if (typeof said.bat === 'string') this.bat = said.bat;
    const out: Record<string, unknown> = { ...said, crates: this.crates };
    if (buildings) out.buildings = buildings;
    delete out.at;
    delete out.full;
    delete out.ids;
    delete out.bat;
    for (const k of GROUND_LISTS) out[k] = [...this.held[k].values()].sort((a, b) => a.id - b.id);
    return out;
  }

  /**
   * The slow half's walls and floors laid: whole, or only what changed (`delta`) on top of those held. The buildings
   * as a whole answer has them; undefined for an answer with no slow half; false when a delta names a key this side
   * does not hold, or comes with none held.
   */
  private build(b: unknown, now: number): Built | undefined | false {
    if (!b || typeof b !== 'object' || Array.isArray(b)) return undefined;
    const said = b as Built;
    const walls = builtOf(said.walls) ?? [];
    const floors = builtOf(said.floors) ?? [];
    const delta = said.delta === true;
    if (delta && (!this.walls || !this.floors)) return false;
    const heldWalls = delta ? this.walls! : new Map<string, Built>();
    const heldFloors = delta ? this.floors! : new Map<string, Built>();
    if (!delta) this.greenAt.clear();
    for (const w of walls) {
      const k = wallKey(w);
      heldWalls.set(k, w);
      if (typeof w.greenAgo === 'number') this.greenAt.set(k, now - w.greenAgo);
      else this.greenAt.delete(k);
    }
    for (const f of floors) heldFloors.set(floorKey(f), f);
    for (const [held, keys, gone] of [[heldWalls, keysOf(said.wallKeys), true], [heldFloors, keysOf(said.floorKeys), false]] as const) {
      if (!delta || !keys) continue;
      const keep = new Set(keys);
      for (const k of keep) if (!held.has(k)) return false;
      for (const k of [...held.keys()]) if (!keep.has(k)) {
        held.delete(k);
        if (gone) this.greenAt.delete(k);
      }
    }
    this.walls = heldWalls;
    this.floors = heldFloors;
    const out: Built = { ...said };
    delete out.delta;
    delete out.wallKeys;
    delete out.floorKeys;
    out.walls = [...heldWalls.entries()].map(([k, w]) => {
      const at = this.greenAt.get(k);
      return at === undefined ? w : { ...w, greenAgo: Math.max(0, now - at) };
    });
    out.floors = [...heldFloors.values()];
    return out;
  }

  /** This side has lost step with the island: nothing held, and the whole answer next. */
  private lost(): null {
    this.clear();
    return null;
  }
}
