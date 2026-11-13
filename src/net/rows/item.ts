import type { ItemRow } from '../../contract/rows';
import { isNum, type Fields } from './read';

const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);

/**
 * An `item` row (`PACK_COLUMNS`), or null for one with no id, no kind or no
 * count. The columns the browser names are typed; the rest (`mark`,
 * `enchant`, `creature`, `engraving`) ride as they came, for `packed`.
 */
export function itemRow(r: Fields): ItemRow | null {
  const { id, def, count } = r;
  if (!isNum(id) || typeof def !== 'string' || !isNum(count)) return null;
  return {
    ...r,
    id, def, count,
    ql: isNum(r.ql) ? r.ql : 1,
    dmg: isNum(r.dmg) ? r.dmg : 0,
    extra: strOrNull(r.extra),
    holder: typeof r.holder === 'string' ? r.holder : '',
    charges: numOrNull(r.charges),
    locked: r.locked === true,
    issued: r.issued === true,
    rare: strOrNull(r.rare),
    dye: strOrNull(r.dye),
    bless: numOrNull(r.bless),
    maker: strOrNull(r.maker),
    piece: strOrNull(r.piece),
    lit: r.lit === true,
    lit_at: strOrNull(r.lit_at),
    inside: numOrNull(r.inside),
    gx: numOrNull(r.gx),
    gy: numOrNull(r.gy),
  };
}
