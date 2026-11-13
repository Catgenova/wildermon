/**
 * Reading what the island sends, a row at a time.
 *
 * Every decoder in this folder takes `unknown`, looks at the fields the
 * browser reads, and gives back the row typed, or null for a row that is not
 * the shape it says: a function whose signature has moved on, an error
 * object from PostgREST, a proxy putting its own page in the way. A list
 * keeps the rows that read and drops the rest, so one bad row is one thing
 * not shown rather than a throw out of an animation frame.
 */

/** A JSON object, as opposed to a list, a value or nothing. */
export type Fields = Record<string, unknown>;

export const isFields = (v: unknown): v is Fields => !!v && typeof v === 'object' && !Array.isArray(v);

/** A number that is one (not NaN, not infinite). */
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Each row of `data` that `one` reads; nothing for anything that is not a list. */
export function listOf<T>(data: unknown, one: (row: Fields) => T | null): T[] {
  if (!Array.isArray(data)) return [];
  const out: T[] = [];
  for (const raw of data) {
    if (!isFields(raw)) continue;
    const row = one(raw);
    if (row !== null) out.push(row);
  }
  return out;
}

/** The strings in a list, and nothing else that is in it. */
export const stringsIn = (data: unknown): string[] =>
  Array.isArray(data) ? data.filter((v): v is string => typeof v === 'string') : [];

/** The numbers in a list, and nothing else that is in it. */
export const numbersIn = (data: unknown): number[] =>
  Array.isArray(data) ? data.filter(isNum) : [];
