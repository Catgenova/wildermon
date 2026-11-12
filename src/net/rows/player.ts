import type { PlayerRow } from '../../contract/rows';
import { isNum, type Fields } from './read';

const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/**
 * A `player` row as the roster reads it (`PEOPLE_COLUMNS`), or null for one
 * with no uid or no square. The rest of the row rides as it came.
 */
export function playerRow(r: Fields): PlayerRow | null {
  const { uid, x, y } = r;
  if (typeof uid !== 'string' || !isNum(x) || !isNum(y)) return null;
  return {
    ...r,
    world_id: typeof r.world_id === 'string' ? r.world_id : '',
    uid,
    name: typeof r.name === 'string' ? r.name : '',
    x, y,
    level: isNum(r.level) ? r.level : 0,
    act: strOrNull(r.act),
    act_ends: strOrNull(r.act_ends),
  };
}
