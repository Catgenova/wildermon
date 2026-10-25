/**
 * A settlement's visitor log: who came onto its land, and when.
 *
 * Only an island has one. `rpc_move` writes a row the first time in an hour
 * somebody who is not its founder and not on its roll stands inside its
 * border (`deed_visit`, one row per visitor per settlement per hour: the
 * hour is the key, so a second word that hour writes nothing), and a
 * schedule lets every row older than `VISIT_KEEP_DAYS` go. Its founder, and
 * a rank holding Visitor log, read it in the Settlement window
 * (`rpc_deed_visitors`): each visitor once, newest first, at most
 * `VISIT_LIST_MAX` of them, with the last hour and the first they were seen
 * and how many hours they were seen in.
 *
 * Imports nothing, so `ranks.ts` -- kept free of imports for the reason it
 * gives -- can say these limits in its rules. The island's
 * `visit_keep_days` and `visit_list_max`
 * (`20261026150000_settlement_at_a_glance.sql`); `supabase/test/deedmanage.ts`
 * holds the two to each other.
 */

/** How many days a settlement's visitor log keeps a visit. */
export const VISIT_KEEP_DAYS = 7;

/** How many visitors the log lists, the latest first. */
export const VISIT_LIST_MAX = 50;

/** One visitor, as `rpc_deed_visitors` lists them. */
export interface Visitor {
  name: string;
  /** The start of the last hour they were seen in, in seconds. */
  last: number;
  /** The start of the first hour they were seen in, within `VISIT_KEEP_DAYS`. */
  first: number;
  /** How many hours they were seen in. */
  hours: number;
}

/** The stances a settlement's orders may set its workers to: a companion's Guarding you is not one. */
export const ORDER_STANCES = ['passive', 'defensive', 'aggressive'] as const;
export type OrderStance = (typeof ORDER_STANCES)[number];

/**
 * A settlement's watch, as `rpc_deed_watch` answers it to its founder and its
 * citizens: the orders set on it (null where none ever were), how many of its
 * settlement workers hold each stance, how many of them guard (the `guard`
 * trade), and its visitors -- or, for a rank without Visitor log, the
 * sentence that says so.
 */
export interface DeedWatch {
  deed: string;
  founder: string;
  orders: OrderStance | null;
  /** Whether you may set its orders: its founder, or a rank holding Wildermon orders. */
  order: boolean;
  /** Its settlement workers, its founder's and its citizens', by stance. */
  stances: Partial<Record<string, number>>;
  /** How many of them are at the guard trade. */
  guards: number;
  visitors?: Visitor[];
  /** How many visitors it had in all, of which `VISIT_LIST_MAX` at most are listed. */
  total?: number;
  /** Why its visitors are not shown: your rank. */
  visitorsWhy?: string;
}
