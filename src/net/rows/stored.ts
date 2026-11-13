import type { StoredThing } from '../../contract/ground';
import { rarityStep, type Item } from '../../game/items';

/** A stored thing as this side holds one: the same fields `packed` reads off a pack's row. */
export const storedThing = (it: StoredThing): Item => ({
  uid: it.id, id: it.def, ql: it.ql, dmg: it.dmg, count: it.count,
  extra: it.extra ?? undefined,
  rare: rarityStep(it.rare),
  dye: it.dye ?? undefined,
  enchant: it.enchant ?? undefined,
  ...(typeof it.creature === 'number' ? { creature: it.creature } : {}),
  ...(it.occupant ? { occupant: it.occupant } : {}),
  ...(typeof it.price === 'number' ? { price: it.price } : {}),
});
