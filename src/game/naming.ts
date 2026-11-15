import type { ActionDef, Target } from './actions';
import { crateName, crateNotYours } from './crates';
import { furnitureName, furnitureNameInLine, pieceShut } from './furniture';
import type { Game } from './game';
import { postName } from './posts';
import { lacks } from './ranks';
import { isSettlementStore } from './stores';
import { trapName } from './traps';

/**
 * Calling things by name.
 *
 * A settlement of any age has six bins, four crates and a row of chests, and
 * every one of them is called "Raw material bin (oak)". Naming them is the difference
 * between hunting through the lot and walking to the one marked Planks. Any
 * crate, bin, chest, cart, piece of furniture, work post or trap takes a name,
 * and that name is what it is called everywhere afterwards: the Stores window,
 * the settlement window, its own menu, and the tooltip when you point at it.
 */
export const NAME_MAX = 28;

/** What a thing is called now, whatever kind of thing it is. */
function nameOf(g: Game, t: Target): string | null {
  if (t.kind === 'crate') return g.crates.get(t.id) ? crateName(g.crates.get(t.id)!) : null;
  if (t.kind === 'furniture') return g.furniture.get(t.id) ? furnitureName(g.furniture.get(t.id)!) : null;
  if (t.kind === 'post') return g.posts.get(t.id) ? postName(g.posts.get(t.id)!) : null;
  if (t.kind === 'trap') return g.traps.get(t.id) ? trapName(g.traps.get(t.id)!) : null;
  return null;
}

/** The thing itself, for writing the name onto. */
function thingOf(g: Game, t: Target): { name?: string } | null {
  if (t.kind === 'crate') return g.crates.get(t.id) ?? null;
  if (t.kind === 'furniture') return g.furniture.get(t.id) ?? null;
  if (t.kind === 'post') return g.posts.get(t.id) ?? null;
  if (t.kind === 'trap') return g.traps.get(t.id) ?? null;
  return null;
}

/**
 * Why you may not name it, or null, in the island's words (`hands_refusal`, `private.name_shut`). A crate: yours to
 * use. A piece: a settlement store by its rule and a padlock by its key (`pieceShut`); otherwise yours, or on a
 * settlement of yours whose rank for you holds Crates and stores.
 */
export function nameThingRefusal(g: Game, t: Target): string | null {
  if (t.kind === 'crate') {
    const c = g.crates.get(t.id);
    if (!c) return 'That is not there any more.';
    return crateNotYours(g, c) ? 'That is not yours to name.' : null;
  }
  if (t.kind !== 'furniture') return null;
  const f = g.furniture.get(t.id);
  if (!f) return 'That is not there any more.';
  const shut = pieceShut(g, f);
  if (shut || isSettlementStore(f) || f.mine !== false) return shut;
  const d = g.deedOfMineAt(f.x, f.y);
  return d ? lacks(d, 'stores') : `Not yours to name: ${furnitureNameInLine(f)}.`;
}

export const NAMING_ACTIONS: ActionDef[] = [
  {
    id: 'name_thing',
    /*
     * `allowEmpty`, because here an empty answer is an answer: it takes the
     * name off again rather than being a refusal, which is what the rest of
     * `perform` goes on to do with it.
     */
    asks: {
      question: 'What is this called?',
      fallback: (t, g) => nameOf(g, t) ?? '',
      max: NAME_MAX,
      allowEmpty: true,
    },
    label: 'Give it a name',
    verb: 'naming it',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => thingOf(g, t) !== null,
    check: (t, g) => nameThingRefusal(g, t),
    labelFor: (t, g) => (thingOf(g, t)?.name ? 'Call it something else' : 'Give it a name'),
    perform: (t, g) => {
      const thing = thingOf(g, t);
      if (!thing) return;
      const was = nameOf(g, t) ?? '';
      const name = ((t as { name?: string }).name ?? '').trim().slice(0, NAME_MAX);
      if (!name) {
        // An empty answer takes the name off again rather than leaving a blank.
        if (thing.name) {
          delete thing.name;
          g.logMsg(`Name removed: ${(nameOf(g, t) ?? 'thing').toLowerCase()}.`, 'info');
        }
      } else {
        thing.name = name;
        g.logMsg(`Named: ${was.toLowerCase()} is now ${name}.`, 'info');
      }
      g.events.emit('world', 0, 0);
      g.events.emit('crate');
    },
  },
];

export const NAMING_ACTION_BY_ID = new Map(NAMING_ACTIONS.map((a) => [a.id, a]));
