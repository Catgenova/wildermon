/**
 * Panniers: the Packlet line's (`bura`) stores on its own back.
 *
 * Asked for: "Pannier capacity by stage: 200 items at stage 1, 500 at stage 2, 1000 at stage 3"; "Its panniers open
 * like a storage container ... for its keeper (and whoever else may use the keeper's stores, as a chest on their
 * settlement would)"; "Its panniers count as nearby storage"; and "It cannot be crated or released unless its
 * panniers are empty".
 *
 * So a pack beast's panniers are a store: opened from its menu in the same window as a chest (`CratePanel`), put into
 * by `store_in_pannier` and taken out of by `take_from_store`, as a chest's are, and a store within `CRAFT_REACH`
 * tiles for crafting and building (`Game.storesWithin`). They hold `SpeciesDef.pannier` at its stage (`stageOf`), times
 * its blood's hauling (`bloodMul`). They open for its keeper, and for anybody whose rank on its keeper's settlement may
 * use the stores while it stands on that settlement, as a chest standing there would: the island decides that and
 * sends the panniers only to those it opens for (`pannier_shut`, `pannier_sent`), which is what `panniersOpen` is.
 *
 * Every way it leaves your keeping that you ask for is refused while anything is in them: into a crate, released,
 * culled, and sent into a crate to make way for another (`companionSwap`). The island refuses in the same words
 * (`pannier_exit_said`). On its death what is in them is lost with it, as it always was.
 */
import type { ActionDef, Target } from './actions';
import { STORE_REACH, crateKindOfItem } from './crates';
import { bloodMul, SPECIES, stageOf, type Creature } from './creatures';
import type { Game } from './game';
import { itemDef, itemName, type Item } from './items';

/** Whether a kind carries panniers at all. */
export const hasPanniers = (species: string): boolean => !!SPECIES[species]?.pannier;

/** What its panniers hold at its stage, before its blood. */
export const pannierAt = (c: Pick<Creature, 'species' | 'skills'>): number => SPECIES[c.species]?.pannier?.[stageOf(c)] ?? 0;

/** What its panniers hold: its stage's, times its blood's hauling. The island's `pannier_cap`. */
export const pannierCap = (c: Creature): number => Math.round(pannierAt(c) * bloodMul(c, 'haul'));

/** How many things are in them. The island's `pannier_units`. */
export const pannierUnits = (c: Creature): number => c.pannier.reduce((n, it) => n + it.count, 0);

/** Room left in them. */
export const pannierSpare = (c: Creature): number => Math.max(0, pannierCap(c) - pannierUnits(c));

/** Its panniers, as a store's window and a line name them. */
export const pannierName = (c: Creature): string => `${c.name}'s panniers`;

/** Full, in the island's words (`pannier_full_said`). */
export const pannierFullSaid = (c: Creature): string => `${pannierName(c)} full.`;

/** Every way out of your keeping, while anything is in them: the island's `pannier_exit_said`. */
export const pannierExitSaid = (name: string): string => `${name}: empty its panniers first.`;

/** Why it may not go into a crate, be let go or culled: something in its panniers. The island's `pannier_exit_refusal`. */
export const pannierExitRefusal = (c: Creature): string | null => (pannierUnits(c) > 0 ? pannierExitSaid(c.name) : null);

/**
 * Why its panniers will not open for you, or null: as the island's `pannier_refusal` says it. Gone, none, in a crate,
 * not yours to open (`pannier_shut`), and too far to reach into (`STORE_REACH`, as a chest is reached).
 */
export function pannierRefusal(g: Game, c: Creature | undefined): string | null {
  if (!c) return 'Gone.';
  if (!hasPanniers(c.species)) return `${SPECIES[c.species]?.name ?? c.name}: no panniers.`;
  if (c.mode === 'stored') return `${c.name} is in a wildermon crate: open it first.`;
  if (c.mode === 'wild' || (c.mine === false && !c.panniersOpen)) return `Not yours: ${pannierName(c)}.`;
  if (Math.hypot(c.x - g.player.x, c.y - g.player.y) > STORE_REACH) return `Stand next to ${c.name}.`;
  return null;
}

/**
 * Whether to offer to open them: a kind with panniers, out of a crate, that opens for you: your own (the island says
 * `mine`), or one whose panniers the island sent (`panniersOpen`).
 */
export const panniersOffered = (c: Creature): boolean =>
  hasPanniers(c.species) && c.mode !== 'wild' && c.mode !== 'stored' && (c.mine !== false || !!c.panniersOpen);

/** The panniers a put is aimed at: the ones it names, or the nearest of yours in reach. The island's `pannier_into`. */
export function pannierInto(g: Game, t: Target): Creature | undefined {
  if (t.kind !== 'item') return undefined;
  if (t.into !== undefined) return g.creatures.get(t.into);
  let best: Creature | undefined;
  let far = Infinity;
  for (const c of g.creatures.list.values()) {
    if (!panniersOffered(c) || c.mine === false) continue;
    const d = Math.hypot(c.x - g.player.x, c.y - g.player.y);
    if (d <= STORE_REACH && (d < far || (d === far && best && c.id < best.id))) {
      best = c;
      far = d;
    }
  }
  return best;
}

/** "Stored: 3 × planks in Pip's panniers." with what did not fit, as the island says it. */
export const pannierStoredLine = (count: number, what: string, c: Creature, left: number): string =>
  `Stored: ${count} × ${what.toLowerCase()} in ${pannierName(c)}.` + (left > 0 ? ` ${left} did not fit.` : '');

/** Load something onto its back, as much of it as fits; false when none does. */
export function pannierAdd(g: Game, c: Creature, item: Item): boolean {
  if (item.count > pannierSpare(c)) return false;
  const stack = itemDef(item.id).stackable
    ? c.pannier.find((it) => it.id === item.id && it.extra === item.extra && it.piece === item.piece && (it.rare ?? 0) === (item.rare ?? 0))
    : undefined;
  if (stack) {
    stack.ql = (stack.ql * stack.count + item.ql * item.count) / (stack.count + item.count);
    stack.count += item.count;
  } else c.pannier.push(item);
  g.events.emit('crate');
  return true;
}

/** Take a row back off its back. */
export function pannierTake(g: Game, c: Creature, uid: number): Item | null {
  const i = c.pannier.findIndex((it) => it.uid === uid);
  if (i < 0) return null;
  const [item] = c.pannier.splice(i, 1);
  g.events.emit('crate');
  return item;
}

/**
 * Putting a thing from the pack into a pack beast's panniers: what a drag into their window, and Put all in, ask for.
 * Room for some of a stack is enough, and what does not fit stays in the pack, as a crate's put goes.
 */
export const PANNIER_ACTIONS: ActionDef[] = [{
  id: 'store_in_pannier',
  label: 'Put in panniers',
  verb: 'loading the panniers',
  instant: true,
  quantity: true,
  stamina: 0,
  baseTime: 0,
  // Not in the item menu: it is what a drop into the panniers' window means, and the beast is named in the ask.
  hidden: true,
  applies: (t, g) => t.kind === 'item' && !!g.inventory.get(t.uid) && !!pannierInto(g, t),
  check: (t, g) => {
    if (t.kind !== 'item') return null;
    const item = g.inventory.get(t.uid);
    if (!item) return 'It is gone.';
    if (crateKindOfItem(item.id)) return 'No crates in panniers.';
    const c = pannierInto(g, t);
    if (!c) return t.into !== undefined ? 'Gone.' : 'No panniers in reach.';
    const why = pannierRefusal(g, c);
    if (why) return why;
    // A thing that stacks goes in as far as there is room; one that does not goes in whole or not at all.
    const need = itemDef(item.id).stackable ? 1 : Math.min(item.count, t.count ?? 1);
    return pannierSpare(c) < need ? pannierFullSaid(c) : null;
  },
  perform: (t, g) => {
    if (t.kind !== 'item') return;
    const held = g.inventory.get(t.uid);
    const c = pannierInto(g, t);
    if (!held || !c) return;
    const want = Math.max(1, Math.min(held.count, t.count ?? 1));
    const fits = Math.min(want, pannierSpare(c));
    if (fits <= 0) {
      g.logMsg(pannierFullSaid(c), 'error');
      return;
    }
    const item = g.inventory.take(t.uid, fits);
    if (!item) return;
    if (!pannierAdd(g, c, item)) {
      g.inventory.addItem(item);
      g.logMsg(pannierFullSaid(c), 'error');
      return;
    }
    g.logMsg(pannierStoredLine(item.count, itemName(item), c, want - item.count), 'event');
  },
}];
