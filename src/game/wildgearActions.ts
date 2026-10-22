import type { ActionDef, Target } from './actions';
import { denClass, type Creature } from './creatures';
import type { Game } from './game';
import { itemDef, type Item } from './items';
import { gearA, gearId, gearOf, gearOn, gearSays, gearShare, GEAR_SIZES, GEAR_SLOTS, slotName, type GearSize, type GearSlot } from './wildgear';

/**
 * Fitting wildermon gear on a wildermon of yours and taking it off, from its
 * menu, a slot each (`wildgear.ts` has the rule): `fit_gear_<slot>` fits the
 * piece chosen (`itemUid`) or the best of its size you carry, and
 * `remove_gear_<slot>` puts it back in your pack as it is, its QL and damage
 * kept. The island's `gear_action`, `gear_refusal` and `perform_gear`, which
 * refuse in the same words.
 */
export const fitGearId = (slot: GearSlot): string => `fit_gear_${slot}`;
export const removeGearId = (slot: GearSlot): string => `remove_gear_${slot}`;

const creatureOf = (g: Game, t: Target): Creature | undefined => (t.kind === 'creature' ? g.creatures.get(t.id) : undefined);
const near = (g: Game, c: Creature): boolean => Math.hypot(c.x - g.player.x, c.y - g.player.y) <= 1.9;
const gearName = (id: string): string => itemDef(id).name;
/** The pieces of a slot in your pack, unlocked, of any size. */
const carried = (g: Game, slot: GearSlot): Item[] => g.inventory.items.filter((it) => !it.locked && gearOf(it.id)?.slot === slot);

/** The piece a fitting would use: the one chosen, or the best of the slot at its size you carry. */
function pieceFor(g: Game, c: Creature, slot: GearSlot, uid: number | undefined): Item | undefined {
  if (uid !== undefined) return g.inventory.get(uid);
  const want = gearId(slot, denClass(c) as GearSize);
  return carried(g, slot).filter((it) => it.id === want).sort((a, b) => gearShare(b) - gearShare(a) || a.uid - b.uid)[0];
}

/** Why it cannot be handled here: gone, not yours, crated or out of reach. */
function handRefusal(g: Game, c: Creature | undefined): string | null {
  if (!c) return 'Gone.';
  if (c.mode === 'wild' || c.mine === false) return c.mode === 'wild' ? 'Not yours.' : `${c.name}: not yours.`;
  if (c.mode === 'stored') return `${c.name} is in a wildermon crate: open it first.`;
  if (!near(g, c)) return `Stand next to ${c.name}.`;
  return null;
}

/** Why a piece of this slot cannot be fitted on it, or null. The island's `gear_refusal`. */
export function fitRefusal(g: Game, c: Creature | undefined, slot: GearSlot, uid?: number): string | null {
  const why = handRefusal(g, c);
  if (why || !c) return why;
  const size = GEAR_SIZES[denClass(c)];
  if (uid !== undefined) {
    const it = g.inventory.get(uid);
    if (!it || it.locked) return 'It is gone.';
    const of = gearOf(it.id);
    // The wrong slot: a harness chosen to fit as a pack.
    if (!of || of.slot !== slot) return `${gearName(it.id)}: not ${gearA(slot)}wildermon ${slot}.`;
  }
  if (c.gear?.[slot]) return `${c.name}: ${slot} already fitted.`;
  if (!carried(g, slot).length) return `Need ${gearA(slot)}${size} wildermon ${slot}.`;
  // The wrong size: it fits its own only (`denClass`).
  const it = pieceFor(g, c, slot, uid);
  if (!it || gearOf(it.id)?.size !== denClass(c)) return `${c.name}: ${size} gear only.`;
  return null;
}

/** Why the piece in this slot cannot be taken off, or null. */
export function removeRefusal(g: Game, c: Creature | undefined, slot: GearSlot): string | null {
  const why = handRefusal(g, c);
  if (why || !c) return why;
  return c.gear?.[slot] ? null : `${c.name}: no ${slot} fitted.`;
}

/** What fitting says: "Medium wildermon harness fitted on Ash: team pace +7.5%." */
export const fittedSays = (c: Pick<Creature, 'name'>, slot: GearSlot, it: Item): string =>
  `${gearName(it.id)} fitted on ${c.name}: ${gearSays(slot, it)}.`;
/** What taking it off says: "Medium wildermon harness removed from Ash." */
export const removedSays = (c: Pick<Creature, 'name'>, it: Pick<Item, 'id'>): string => `${gearName(it.id)} removed from ${c.name}.`;

function fitAction(slot: GearSlot): ActionDef {
  return {
    id: fitGearId(slot),
    label: `Fit ${gearA(slot)}wildermon ${slot}`,
    verb: `fitting the ${slot}`,
    stamina: 0.01,
    baseTime: 3,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.mode !== 'wild' && c.mine !== false && !c.gear?.[slot] && carried(g, slot).length > 0;
    },
    check: (t, g) => fitRefusal(g, creatureOf(g, t), slot, t.kind === 'creature' ? t.itemUid : undefined),
    perform: (t, g) => {
      const c = creatureOf(g, t);
      const uid = t.kind === 'creature' ? t.itemUid : undefined;
      if (!c || fitRefusal(g, c, slot, uid)) return;
      const it = pieceFor(g, c, slot, uid);
      if (!it || !g.inventory.remove(it.uid, 1)) return;
      const on: Item = { ...it, count: 1 };
      c.gear = { ...c.gear, [slot]: on };
      g.logMsg(fittedSays(c, slot, on), 'event');
      g.events.emit('creature');
      g.events.emit('inventory');
    },
  };
}

/** A piece off it and back in your pack as it was, its QL and damage kept. */
function unfit(g: Game, c: Creature, slot: GearSlot): Item | undefined {
  const it = c.gear?.[slot];
  if (!it) return undefined;
  const back = g.inventory.add(it.id, { ql: it.ql, extra: it.extra, rare: it.rare, mark: it.mark, maker: it.maker, enchant: it.enchant });
  back.dmg = it.dmg;
  const rest = { ...c.gear };
  delete rest[slot];
  c.gear = Object.keys(rest).length ? rest : undefined;
  return it;
}

/** Every piece off one you release or cull, back in your pack. The island's `gear_off`. */
export function takeGear(g: Game, c: Creature): void {
  for (const slot of GEAR_SLOTS) {
    const it = unfit(g, c, slot);
    if (it) g.logMsg(removedSays(c, it), 'event');
  }
}

function removeAction(slot: GearSlot): ActionDef {
  return {
    id: removeGearId(slot),
    label: `Remove the ${slot}`,
    verb: `removing the ${slot}`,
    stamina: 0.01,
    baseTime: 2,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.mode !== 'wild' && c.mine !== false && !!c.gear?.[slot];
    },
    check: (t, g) => removeRefusal(g, creatureOf(g, t), slot),
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || removeRefusal(g, c, slot)) return;
      const it = unfit(g, c, slot);
      if (!it) return;
      g.logMsg(removedSays(c, it), 'event');
      g.events.emit('creature');
      g.events.emit('inventory');
    },
  };
}

/** The six: fit and remove, a slot each. */
export const WILD_GEAR_ACTIONS: ActionDef[] = GEAR_SLOTS.flatMap((slot) => [fitAction(slot), removeAction(slot)]);

/**
 * The gear on it, for the Stats row of its card: "Harness: team pace +7.5%",
 * or "Pack: outgrown (small), no effect" on one grown out of it.
 */
export function gearTags(c: Creature): Array<{ text: string; title: string }> {
  const out: Array<{ text: string; title: string }> = [];
  for (const slot of GEAR_SLOTS) {
    const it = c.gear?.[slot];
    if (!it) continue;
    const of = gearOf(it.id);
    const state = `QL ${it.ql.toFixed(1)}, damage ${it.dmg.toFixed(1)}`;
    if (!gearOn(c, slot, denClass(c))) {
      out.push({ text: `${slotName(slot)}: outgrown (${of ? GEAR_SIZES[of.size] : '?'}), no effect`, title: `${gearName(it.id)}, ${state}: fits ${of ? GEAR_SIZES[of.size] : '?'} only.` });
      continue;
    }
    out.push({ text: `${slotName(slot)}: ${gearSays(slot, it)}`, title: `${gearName(it.id)}, ${state}: ${gearSays(slot, it)}.` });
  }
  return out;
}
