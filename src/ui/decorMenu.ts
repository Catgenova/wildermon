import { ACTION_BY_ID, type Target } from '../game/actions';
import {
  compostTakes, DRAW_CURTAINS, EMPTY_COMPOST, FILL_COMPOST, READ_SUNDIAL, STAND_PUT, STAND_SLOTS, STAND_SWAP, STAND_TAKE,
} from '../game/decor';
import { COMPOST_BIN, CURTAINS, STANDS, SUNDIAL } from '../game/decordefs';
import type { PlacedFurniture } from '../game/furniture';
import type { Game } from '../game/game';
import { isArmour, slotOf, SLOT_NAMES, type Slot } from '../game/gear';
import type { Item } from '../game/items';
import { seenName } from '../game/skillgates';
import type { MenuItem } from './contextmenu';

/** Each home piece's jobs, in menu order (`decor.ts`). */
const JOBS: Readonly<Record<string, readonly string[]>> = {
  [SUNDIAL]: [READ_SUNDIAL],
  [COMPOST_BIN]: [FILL_COMPOST, EMPTY_COMPOST],
  [CURTAINS]: [DRAW_CURTAINS],
  ...Object.fromEntries(STANDS.map((s) => [s, [STAND_PUT, ...STAND_SLOTS.map(STAND_TAKE), STAND_SWAP]])),
};

/** What a job that takes a thing from the pack is offered: a compost bin's Add, every stack it takes; a stand's Put on stand, every armour piece, carried and worn. */
const choices = (g: Game, id: string): Item[] =>
  id === FILL_COMPOST ? g.inventory.items.filter((it) => compostTakes(it) && !it.locked)
    : id === STAND_PUT ? g.inventory.items.filter((it) => isArmour(it.id) && !it.locked)
      .sort((a, b) => Number(g.isEquipped(a.uid)) - Number(g.isEquipped(b.uid)) || STAND_SLOTS.indexOf(slotOf(a.id) as Slot) - STAND_SLOTS.indexOf(slotOf(b.id) as Slot))
    : [];

/**
 * A home piece's own entries: a sundial's Examine; a compost bin's Add to compost and Take compost; curtains' Open or
 * Close; an armour stand's Put on stand, a Take off for each slot with a piece on it, and Swap with worn. Each refused
 * in the island's words (`decor_refusal`). Add and Put on stand name what in the pack goes in the ask (`itemUid`), and
 * list each when there is more than one.
 */
export function decorEntries(g: Game, f: PlacedFurniture): MenuItem[] {
  const jobs = JOBS[f.kind];
  if (!jobs) return [];
  const ft: Target = { kind: 'furniture', id: f.id };
  const entries: MenuItem[] = [];
  for (const id of jobs) {
    const def = ACTION_BY_ID.get(id);
    if (!def || !def.applies(ft, g)) continue;
    const row = (t: Target, label: string, note?: string): MenuItem => {
      const why = def.check?.(t, g) ?? null;
      return { label, note, hint: why ?? undefined, disabled: !!why, onSelect: () => g.requestAction(def, t) };
    };
    const some = choices(g, id);
    if (some.length > 1) {
      entries.push({
        label: def.label,
        children: some.map((it) => row({ ...ft, itemUid: it.uid }, it.count > 1 ? `${seenName(it, g)} (${it.count})` : seenName(it, g),
          id === STAND_PUT ? `${SLOT_NAMES[slotOf(it.id) as Slot]}${g.isEquipped(it.uid) ? ' · worn' : ''}` : undefined)),
      });
      continue;
    }
    // The one there is, named all the same, so a slot taken is said of it.
    const t: Target = some.length ? { ...ft, itemUid: some[0].uid } : ft;
    entries.push(row(t, def.labelFor?.(t, g) ?? def.label));
  }
  return entries;
}
