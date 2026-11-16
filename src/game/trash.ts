/**
 * A trash crate destroys what is put in it: each stack whole, a time after it went in that the crate's own QL sets,
 * `TRASH_SECS_AT_1` at QL `TRASH_QL_LOW` down to `TRASH_SECS_AT_100` at QL `TRASH_QL_HIGH` in a straight line. A
 * stack put onto one already in it goes with that one; a stack taken out before its time is kept.
 *
 * The island plays it (`trash_span`, `trash_sweep`, `item.binned_at`); this is what the browser says of it.
 */
import { waitWords } from './words';

/** The QL the two ends are at; a crate's QL is held between them. */
export const TRASH_QL_LOW = 1;
export const TRASH_QL_HIGH = 100;
/** Seconds a stack lasts in a trash crate of QL 1, from when it was put in. */
export const TRASH_SECS_AT_1 = 3 * 3600;
/** Seconds a stack lasts in a trash crate of QL 100. */
export const TRASH_SECS_AT_100 = 30 * 60;

/** Seconds a stack lasts in a trash crate of this QL, QL held to 1..100: the island's `trash_span`. */
export function trashSpan(ql: number): number {
  const q = Math.min(TRASH_QL_HIGH, Math.max(TRASH_QL_LOW, ql));
  return TRASH_SECS_AT_1 - ((q - TRASH_QL_LOW) * (TRASH_SECS_AT_1 - TRASH_SECS_AT_100)) / (TRASH_QL_HIGH - TRASH_QL_LOW);
}

/** "3 h at QL 1, 30 min at QL 100". */
export const TRASH_ENDS = `${waitWords(TRASH_SECS_AT_1)} at QL ${TRASH_QL_LOW}, ${waitWords(TRASH_SECS_AT_100)} at QL ${TRASH_QL_HIGH}`;
/** "Destroys contents: 3 h at QL 1, 30 min at QL 100". */
export const TRASH_RULE = `Destroys contents: ${TRASH_ENDS}`;

/** This crate's own time: "This one (QL 50): 1 h 45 min". */
export const trashSays = (ql: number): string => `This one (QL ${Math.round(ql)}): ${waitWords(trashSpan(ql))}`;
