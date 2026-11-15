import { ITEM_DEFS, itemDef } from './items';

/**
 * Containers named for an item: the Chestkit line's named sort.
 *
 * Asked for: "If a player names an eligible container on their settlement, the
 * wildermon will transport items to that container from any unmatched or
 * unnamed containers." A crate or a storage piece on the settlement (the ones
 * that may be marked a store, `storeMarkable`) is a target when its name
 * (`name_thing`) is an item's: its name, its plural or its id, in any case,
 * spaces round it ignored. Every other one is a source. A Chestkit on its
 * settlement moves an item out of the sources into a target for it with room,
 * as much as fits; never out of a target, never between two. The island's
 * `private.hoard_items`, `private.hoard_move`, `private.hoard_take` and
 * `private.hoard_into`; the browser's `Creatures.hoardMove`.
 */

/** A name as it is matched: lower case, spaces round it off. The island's `private.hoard_fold`. */
export const hoardFold = (name: string | null | undefined): string => (name ?? '').replace(/^ +| +$/g, '').toLowerCase();

/**
 * An item's name made plural, lower case: "planks", "berries"; a name ending in s as it is. Every plural `countOf`
 * says is this or the name itself. The island's `private.hoard_plural`.
 */
export const hoardPlural = (name: string): string => {
  const n = name.toLowerCase();
  if (n.endsWith('s')) return n;
  return /[^aeiou]y$/.test(n) ? `${n.slice(0, -1)}ies` : `${n}s`;
};

const ITEMS_FOR = new Map<string, readonly string[]>();

/**
 * The items a container's name is for, by id in code-point order: every item whose name, plural (`hoardPlural`) or id
 * is the name (`hoardFold`). Empty for no name and for a name no item has: such a container is a source.
 */
export function hoardItems(name: string | null | undefined): readonly string[] {
  const v = hoardFold(name);
  if (!v) return [];
  let ids = ITEMS_FOR.get(v);
  if (!ids) {
    ids = Object.entries(ITEM_DEFS)
      .filter(([id, d]) => id.toLowerCase() === v || d.name.toLowerCase() === v || hoardPlural(d.name) === v)
      .map(([id]) => id)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    ITEMS_FOR.set(v, ids);
  }
  return ids;
}

/** Whether a container's name makes it a target (`hoardItems`). */
export const hoardTarget = (name: string | null | undefined): boolean => hoardItems(name).length > 0;

/** Whether a container's name is for items and not this one: never filled with it by a magga. The island's `private.hoard_other`. */
export const hoardOther = (name: string | null | undefined, id: string): boolean => {
  const ids = hoardItems(name);
  return ids.length > 0 && !ids.includes(id);
};

/** What a container's name is for, as a list: "mortar", "log or log crate"; empty for none. */
export const hoardForSaid = (name: string | null | undefined): string =>
  hoardItems(name).map((id) => itemDef(id).name.toLowerCase()).join(' or ');

/** A container as the named sort sees it (`hoardItems`): its name, and whether it is padlocked or marked a settlement store. */
export interface HoardSeen {
  name?: string;
  lock?: unknown;
  storeOf?: unknown;
}

/** The hover's line for a named container: "named for: mortar", or that its name is no item's; nothing unnamed. */
export function hoardHover(s: HoardSeen): string | null {
  if (!s.name) return null;
  const for_ = hoardForSaid(s.name);
  return for_ ? `Named for: ${for_}` : 'Name: no item';
}

/**
 * Examine's labels for a container on the named sort (`hoard.ts`), `line` the worker line that does it and `max` the
 * longest name (`NAME_MAX`): its name and what it is for, and whether that line moves things into it, out of it, or
 * neither.
 */
export function hoardExamine(s: HoardSeen, line: string, max: number): string[] {
  const for_ = hoardForSaid(s.name);
  const out = [s.name ? `Name: ${s.name}` : 'Name: none'];
  if (for_) {
    out.push(`Named for: ${for_}`, `${line}: moves ${for_} in from your other containers on the settlement, up to its room; never out`);
    return out;
  }
  if (s.name) out.push('Name: no item');
  if (s.lock) out.push(`${line}: never moves out of it (padlocked)`);
  else if (s.storeOf) out.push(`${line}: never moves out of it (settlement store)`);
  else out.push(`${line}: moves items out of it into a container on the settlement named for them`);
  out.push(`Name for an item: its name, plural or id, any case; max ${max} characters`);
  return out;
}
