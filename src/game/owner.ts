import type { Creature } from './creatures';

/**
 * Whose a tamed wildermon is, by name: the island's word for it (`keeperName`, `rpc_creatures`), else, for your
 * own, your name (`me`); null for a wild one, and for somebody else's on an island that does not send the name.
 */
export function ownerOf(c: Pick<Creature, 'mode' | 'mine' | 'keeperName'>, me: string): string | null {
  if (c.mode === 'wild') return null;
  if (c.keeperName) return c.keeperName;
  return c.mine !== false && me ? me : null;
}

/** The name over a creature: its name, and a tamed one's owner after it ("Bastiondrake · catgenova"). */
export function creatureLabel(c: Pick<Creature, 'name' | 'mode' | 'mine' | 'keeperName'>, me: string): string {
  const owner = ownerOf(c, me);
  return owner ? `${c.name} · ${owner}` : c.name;
}

/** "Owner: catgenova", for a card, a menu or a hover; null for a wild one or an owner not known. */
export function ownerLine(c: Pick<Creature, 'mode' | 'mine' | 'keeperName'>, me: string): string | null {
  const owner = ownerOf(c, me);
  return owner ? `Owner: ${owner}` : null;
}
