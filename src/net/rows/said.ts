import { isNum, type Fields } from './read';

/**
 * The small rows the island answers with whole lists of: what was foraged
 * round you, a settlement on the map, a line of talk.
 */

/** A foraged spot: its tile, what was taken and when. */
export interface ForagedRow { x: number; y: number; kind: string; at: string }

export function foragedRow(r: Fields): ForagedRow | null {
  const { x, y, kind, at } = r;
  return isNum(x) && isNum(y) && typeof kind === 'string' && typeof at === 'string' ? { x, y, kind, at } : null;
}

/** A settlement on the map (`rpc_settlements`): its name, its token, how far it reaches, whether it is yours. */
export interface DeedSpot { name: string; x: number; y: number; radius: number; mine: boolean }

export function deedSpot(r: Fields): DeedSpot | null {
  const { x, y, radius } = r;
  if (!isNum(x) || !isNum(y) || !isNum(radius)) return null;
  return { name: String(r.name ?? ''), x, y, radius, mine: !!r.mine };
}

/** A line of talk from before you came ashore (`rpc_chat`): its number in the log, what was said and when. */
export interface ChatRow { n: number; text: string; at?: string }

export function chatRow(r: Fields): ChatRow | null {
  const { n, text, at } = r;
  if (!isNum(n) || typeof text !== 'string') return null;
  return typeof at === 'string' ? { n, text, at } : { n, text };
}
